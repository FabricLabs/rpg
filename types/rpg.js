'use strict';

const {
  TICK_INTERVAL,
  GENESIS_HASH
} = require('../constants');

// Fabric Core
const Fabric = require('@fabric/core');

// ### Internal Types
// Here we've created a few internal classes to keep IdleRPG well-organized.
const Encounter = require('./encounter');
const Entity = require('./entity');
const World = require('./world');
const Player = require('./player');

/**
 * Primary RPG builder.
 */
class RPG extends Fabric {
  /**
   * Build an RPG with the {@link Fabric} tools.
   * @param  {Object} configuration Settings to configure the RPG with.
   * @return {RPG} Instance of the RPG.
   */
  constructor (configuration) {
    super(configuration);

    this['@type'] = 'RPG';
    this['@configuration'] = Object.assign({
      name: 'RPG',
      path: './stores/rpg',
      authority: 'api.roleplaygateway.com',
      persistent: true,
      globals: {
        tick: 0
      },
      canvas: {
        height: 300,
        width: 400
      },
      interval: TICK_INTERVAL
    }, configuration);

    // ### Our Game State
    // The Game State holds all information necessary to reconstruct your game.
    // We use human-friendly names and keep things as small as possible, so do
    // your part in keeping this well-maintained!
    this.state = {
      channels: {}, // stores a list of channels.
      players: {}, // players are users... !
      services: {}, // services are networks
      users: {} // users are network clients
    };

    this['@world'] = new World(this['@configuration']['entropy']);
    this['@player'] = new Player();
    this['@genesis'] = this['@configuration'].genesis || GENESIS_HASH;
    this['@data'] = Object.assign({
      globals: {
        tick: 0
      }
    }, this['@configuration']);

    this.timer = null;
    this.remote = new Fabric.Remote({
      host: this['@configuration'].authority
    });

    return this;
  }

  static get Entity () {
    return Entity;
  }

  static get Encounter () {
    return Encounter;
  }

  async tick () {
    console.log('[RPG]', 'Beginning tick...', Date.now());
    console.log('[RPG]', 'STATE (@entity)', this['@entity']);

    // Our first and primary order of business is to update the clock.  Once
    // we've computed the game state for the next round, we can share it with
    // the world.
    //
    // Let's finish our work up front.
    this.state.clock++;
    this['@entity'].clock++;

    // let commit = this.commit();
    // console.log('tick:', commit);
    // let ticks = this.get(`/ticks`) || [];
    let origin = new Fabric.State(this['@entity']);

    // if (!ticks.length) ticks.push(origin.id);

    // Snapshot of our state...
    let data = Object.assign({}, this.state, this['@entity']);
    let state = new Fabric.State(data);
    // let json = state.render();

    // Update global for sanity checks...
    this.parent = origin.id;
    this.state = data;

    this.log('[RPG:TICK]', `#${state.id}`, data);

    // Save the game state to disk.
    await this.save();

    // Looks like we're all done, so let's be courteous and notify subscribers.
    this.emit('tick', state.id);

    return this;
  }

  async _POST (path, data) {
    let id = await super._POST(path, data);
    let obj = await super._GET(id);

    // assign state
    // this.state['players'][obj.id] = obj;

    // commit
    this.commit();

    return id;
  }

  /* async _registerActor (data) {
    await super._registerActor(data);

    let result = null;
    let state = new Fabric.State(data);
    let transform = [state.id, state.render()];

    let actor = Object.assign({
      id: `local/${state.id}`,
      type: data.type || 'Actor',
      sharing: transform
    }, data);

    try {
      result = await this._POST(`/actors`, actor);
    } catch (E) {
      return this.error('Cannot register place:', E);
    }

    return result;
  } */

  async _registerPlayer (data) {
    let result = null;
    let state = new Fabric.State(data);
    let transform = [state.id, state.render()];
    let prior = null;

    try {
      prior = this.get(`/players/${state.id}`);
    } catch (E) {
      console.warn('[RPG]', 'No previous player (registering new):', E);
    }

    let profile = Object.assign({
      type: 'Player',
      sharing: transform
    }, data, prior || {});

    try {
      await this.set(`/players/${state.id}`, profile);
      result = this.get(`/players/${state.id}`);
    } catch (E) {
      return console.error('Cannot register player:', E);
    }

    return result;
  }

  async _registerPlace (data) {
    let result = null;
    let state = new Fabric.State(data);
    let transform = [state.id, state.render()];

    console.log('registering place:', data);

    let place = Object.assign({
      id: `local/${state.id}`,
      type: 'Place',
      sharing: transform
    }, data);

    try {
      await this.set(`/places/${state.id}`, place);
      result = this.get(`/places/${state.id}`);
    } catch (E) {
      return console.error('Cannot register place:', E);
    }

    return result;
  }

  async _syncFromGateway () {
    let places = await this.remote._GET('/places');

    console.log('got places:', places);
    // TODO: make async
    for (let i = 0; i <= places.length; i++) {
      await this._registerPlace(places[i]);
    }

    return this;
  }

  async build () {
    this['@world'].map._build();
    this['@world'].map._dump();
  }

  async dump () {
    let id = await this.save();
    require('fs').writeSync(`inputs/${id}`, JSON.stringify(this.state));
  }

  async save () {
    let result = null;
    let data = JSON.stringify(this.state);
    let state = new Fabric.State(data);

    console.log('[RPG]', 'attempting to save:', data);

    try {
      let memory = await this._PUT('/memories', data);
      let doc = await this._PUT(`/blobs/${state.id}`, state.render());
      result = state.id;
    } catch (E) {
      this.error('cannot save:', E);
    }

    return result;
  }

  async restore () {
    let blob = await this._GET(`/memories`);
    let data = null;

    console.log('[RPG]', 'attempting to restore:', blob);

    try {
      let result = JSON.parse(blob);
      if (result) {
        this['@entity'] = result;
        this.state = result;
      }
    } catch (E) {
      console.error('Could not load restore:', E);
    }

    return data;
  }

  async start () {
    await super.start();

    // TODO: clean up the clock
    this.state.clock = this['@configuration'].globals.tick;
    this.state.entropy = {};
    this.state.players = {};
    this.state.peers = {};

    await this.restore();
    // await this._syncFromGateway();
    await this['@world'].start();

    // TODO: document the process
    this.timer = setInterval(this.tick.bind(this), this['@configuration'].interval);

    return this;
  }

  async stop () {
    clearInterval(this.timer);
    await super.stop();
    return this;
  }
}

module.exports = RPG;
