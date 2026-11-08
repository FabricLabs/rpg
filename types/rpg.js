'use strict';

const {
  TICK_INTERVAL,
  GENESIS_HASH,
  FABRIC_PORT
} = require('../constants');

const Actor = require('@fabric/core/types/actor');
const Message = require('@fabric/core/types/message');
const Service = require('@fabric/core/types/service');
const WorldClock = require('./clock');

const {
  FabricNetwork,
  applicationResourceContract,
  contractPublishMessage,
  contractUpdateMessage,
  decodeFabricMessage
} = require('./network');

// Default cap on the players and places peers may add.
const MAX_NETWORK_RECORDS = 10000;

const DEFAULT_RESOURCES = {
  Player: {
    name: 'Player',
    description: 'A participant in the game.',
    routes: { list: '/players', view: '/players/:id' }
  },
  Place: {
    name: 'Place',
    description: 'A location in the game.',
    routes: { list: '/places', view: '/places/:id' }
  },
  Peer: {
    name: 'Peer',
    description: 'A Fabric network peer.',
    routes: { list: '/peers', view: '/peers/:id' }
  }
};

function ensureRoutes (resources) {
  const catalog = {};
  if (!resources || typeof resources !== 'object') return catalog;

  for (const name of Object.keys(resources)) {
    const resource = resources[name];
    if (!resource || typeof resource !== 'object') continue;

    const copy = Object.assign({}, resource);
    const slug = `${String(name).toLowerCase()}s`;
    if (!copy.routes || !copy.routes.list) {
      copy.routes = { list: `/${slug}`, view: `/${slug}/:id` };
    }
    copy.name = copy.name || name;
    catalog[name] = copy;
  }

  return catalog;
}

/**
 * Fabric game service. Local state is the source of truth; the 0.1.0
 * playnet receives signed `CONTRACT_PUBLISH` / `CONTRACT_MESSAGE` frames
 * when `networking` is enabled.
 */
class RPG extends Service {
  constructor (configuration = {}) {
    const requested = Object.assign({
      name: '@fabric/rpg',
      path: './stores/rpg',
      genesis: GENESIS_HASH,
      networking: false,
      listen: false,
      persistent: false,
      peers: [],
      port: FABRIC_PORT,
      interval: TICK_INTERVAL,
      autotick: true,
      // x-only pubkeys (hex) besides this node's own whose frames may write here.
      writers: [],
      // New records a peer may add; updates to known ones are always taken.
      maxPlayers: MAX_NETWORK_RECORDS,
      maxPlaces: MAX_NETWORK_RECORDS,
      state: {
        clock: 0,
        status: 'PAUSED',
        players: {},
        places: {},
        peers: {}
      }
    }, configuration);

    const catalog = ensureRoutes(Object.assign({}, DEFAULT_RESOURCES, requested.resources));

    // Service.networking starts an internal swarm. The playnet peer lives on
    // FabricNetwork so this process can publish frames without listening.
    super(Object.assign({}, requested, {
      networking: false,
      resources: {}
    }));

    this['@type'] = 'RPG';
    this['@genesis'] = requested.genesis || GENESIS_HASH;
    this.catalog = catalog;
    this._joinNetwork = !!requested.networking;
    this._writers = new Set((requested.writers || []).map((key) => String(key).toLowerCase()));
    this._limits = { players: Number(requested.maxPlayers), places: Number(requested.maxPlaces) };

    this.network = new FabricNetwork({
      alias: requested.name,
      listen: !!requested.listen,
      networking: this._joinNetwork,
      peers: requested.peers,
      port: requested.port
    });
    // Mesh frames go through the signer check; `ingestDocument` is for local input.
    this.network.attach((document, message) => {
      this.ingestMessage(message);
    });

    this._arc = applicationResourceContract({
      name: requested.name,
      description: requested.synopsis || requested.description || 'Fabric RPG'
    }, this.catalog);
    this.contract = {
      id: this._arc.contract.id,
      definition: this._arc.contract.definition
    };

    this._autotick = !!requested.autotick;
    this.worldClock = new WorldClock({ interval: requested.interval });
    this.worldClock.on('tick', () => this.beat());

    return this;
  }

  toApplicationResourceContract () {
    return this._arc;
  }

  async start () {
    await super.start();

    await this.network.start(this.key);

    const published = contractPublishMessage(this.contract.definition, this.key);
    this._lastPublish = published;
    if (this._joinNetwork) this.network.broadcast(published);

    this._state.content.status = 'STARTED';
    this.commit();
    return this;
  }

  /**
   * Service's heartbeat is the world tick: `WorldClock` drives `beat()`.
   * With `autotick: false` the host calls `beat()` (or `worldClock.advance()`).
   */
  async _startHeart () {
    if (this._heart) clearInterval(this._heart);
    this._heart = null;
    if (this._autotick) this.worldClock.start();
    return this;
  }

  async stop () {
    this.worldClock.stop();
    await this.network.stop();
    await super.stop();
    return this;
  }

  beat () {
    this._clock = (this._clock | 0) + 1;
    this._state.content.clock = this._clock;
    this.worldClock.clock = this._clock;

    const commitment = this.commit();
    const message = this.publishState();

    this.emit('tick', commitment);
    this.emit('beat', message);
    return this;
  }

  /**
   * Signed state digest small enough for one playnet frame.
   * @returns {Message}
   */
  publishState () {
    const players = this._state.content.players || {};
    const places = this._state.content.places || {};
    const message = contractUpdateMessage(this.contract.id, {
      type: 'RPGState',
      clock: this._state.content.clock || 0,
      players: Object.keys(players).length,
      places: Object.keys(places).length
    }, this.key);

    this._lastPublish = message;
    if (this._joinNetwork) this.network.broadcast(message);
    return message;
  }

  registerPlayer (data = {}) {
    return this._register('/players', data);
  }

  registerPlace (data = {}) {
    return this._register('/places', data);
  }

  registerPeer (data = {}) {
    return this._register('/peers', data);
  }

  _register (path, data, limit = Infinity) {
    const actor = new Actor(data || {});
    const collection = path.slice(1);

    if (!this._state.content[collection] || typeof this._state.content[collection] !== 'object' || Array.isArray(this._state.content[collection])) {
      this._state.content[collection] = {};
    }

    const records = this._state.content[collection];
    const known = Object.prototype.hasOwnProperty.call(records, actor.id);
    if (!known && Object.keys(records).length >= limit) {
      this.emit('warning', `Refused a new record in ${path}: ${limit} already`);
      return null;
    }

    const prior = known ? records[actor.id] : {};
    this._state.content[collection][actor.id] = Object.assign({}, prior, data, { id: actor.id });
    this.commit();

    return `${path}/${actor.id}`;
  }

  async _POST (path, data) {
    if (path === '/players') return this.registerPlayer(data);
    if (path === '/places') return this.registerPlace(data);
    if (path === '/peers') return this.registerPeer(data);
    return super._POST(path, data);
  }

  /**
   * Apply a frame from the mesh. Only a frame signed by this node or one of
   * `writers` is taken, and peers add at most `maxPlayers` / `maxPlaces`.
   * @param {Message|Buffer} message
   * @returns {String|Object|null}
   */
  ingestMessage (message) {
    const author = this._frameAuthor(message);
    if (!author || !this._mayWrite(author)) {
      this.emit('warning', 'Rejected a Fabric frame from a signer that may not write here');
      return null;
    }
    return this.ingestDocument(decodeFabricMessage(message), { network: true });
  }

  _frameAuthor (message) {
    if (!message || typeof Message.verifyFrameAuthor !== 'function') return null;
    let frame = null;
    try {
      frame = Buffer.isBuffer(message) ? message : (typeof message.toBuffer === 'function' ? message.toBuffer() : null);
    } catch (_) {
      return null;
    }
    if (!frame) return null;
    const verified = Message.verifyFrameAuthor(frame);
    return verified && verified.ok ? String(verified.author).toLowerCase() : null;
  }

  _mayWrite (author) {
    const own = this.key && this.key.pubkey ? String(this.key.pubkey).toLowerCase() : '';
    const ownXOnly = own.length === 66 ? own.slice(2) : own;
    return author === ownXOnly || this._writers.has(author);
  }

  /**
   * Apply a decoded playnet document aimed at this contract.
   * Players and places are stored locally. `WorldState` is recorded so other
   * game nodes and this service can share one contract stream.
   * @param {{ type: String, fields: Object }|null} document
   * @param {Object} [origin] `{ network: true }` for a frame from the mesh, which counts against the caps.
   * @returns {String|Object|null}
   */
  ingestDocument (document, origin = {}) {
    if (!document || !document.fields) return null;

    const fields = document.fields;
    if (fields.contract !== this.contract.id) return null;
    const limits = origin && origin.network ? this._limits : { players: Infinity, places: Infinity };

    let payload = fields.payload != null ? fields.payload : fields;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (exception) {
        this.emit('warning', `Rejected Fabric payload: ${exception.message}`);
        return null;
      }
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

    if (payload.type === 'Player') return this._register('/players', payload, limits.players);
    if (payload.type === 'Place') return this._register('/places', payload, limits.places);

    if (payload.type === 'WorldState') {
      this._state.content.world = {
        clock: payload.clock,
        commitment: payload.commitment || null,
        players: payload.players,
        places: payload.places
      };
      this.commit();
      this.emit('world', this._state.content.world);
      return this._state.content.world;
    }

    return null;
  }
}

module.exports = RPG;
module.exports.Network = FabricNetwork;
module.exports.WorldClock = WorldClock;
