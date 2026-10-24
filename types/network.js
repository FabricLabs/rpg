'use strict';

const { MAX_MESSAGE_SIZE, P2P_PORT } = require('@fabric/core/constants');
const Actor = require('@fabric/core/types/actor');
const Message = require('@fabric/core/types/message');
const Peer = require('@fabric/core/types/peer');

const { FABRIC_HUB, FABRIC_PORT } = require('../constants');

const ARC_TYPE = 'ApplicationResourceContract';
const ARC_VERSION = 1;

/**
 * Reject a body that cannot fit in one Fabric 0.1.0 frame.
 * @param {String} body
 * @returns {String}
 */
function assertBounded (body) {
  const bytes = Buffer.byteLength(body, 'utf8');
  if (bytes > MAX_MESSAGE_SIZE) {
    throw new Error(`Fabric message body exceeds MAX_MESSAGE_SIZE (${MAX_MESSAGE_SIZE})`);
  }
  return body;
}

/**
 * Application Resource Contract document (Fabric HTTP OPTIONS `/` shape).
 * @param {Object} settings
 * @param {Object} resources
 * @returns {Object}
 */
function applicationResourceContract (settings = {}, resources = {}) {
  const definition = {
    name: settings.name || '@fabric/rpg',
    description: settings.description || '',
    resources
  };
  const actor = new Actor(definition);

  return {
    '@type': ARC_TYPE,
    version: ARC_VERSION,
    name: definition.name,
    description: definition.description,
    contract: {
      id: String(actor.id),
      definition,
      messageType: 'CONTRACT_PUBLISH'
    },
    resources,
    capabilities: {
      http: {
        contentTypes: ['application/json']
      },
      fabric: {
        p2p: true,
        contractPublish: true,
        webrtcSignaling: false
      }
    }
  };
}

/**
 * Sign a field-encoded contract message when a key is available.
 * @param {Message} message
 * @param {Object} [signer]
 * @returns {Message}
 */
function signMessage (message, signer) {
  if (!signer) return message;
  message._setSigner(signer);
  if (signer.private && typeof signer.sign === 'function') message.sign();
  return message;
}

/**
 * `CONTRACT_PUBLISH` for the 0.1.0 playnet (field schema, not a raw JSON frame).
 * @param {Object|String} definition
 * @param {Object} [signer]
 * @returns {Message}
 */
function contractPublishMessage (definition, signer) {
  const body = assertBounded(typeof definition === 'string' ? definition : JSON.stringify(definition));
  return signMessage(Message.fromFields('CONTRACT_PUBLISH', { definition: body }), signer);
}

/**
 * `CONTRACT_MESSAGE` carrying a JSON payload that fits in one frame.
 * @param {String} contractId
 * @param {Object|String} payload
 * @param {Object} [signer]
 * @returns {Message}
 */
function contractUpdateMessage (contractId, payload, signer) {
  const body = assertBounded(typeof payload === 'string' ? payload : JSON.stringify(payload));
  return signMessage(Message.fromFields('CONTRACT_MESSAGE', {
    contract: String(contractId),
    payload: body
  }), signer);
}

/**
 * Decode a Fabric message buffer or {@link Message} into `{ type, fields }`.
 * @param {Message|Buffer|Object} message
 * @returns {{ type: String, fields: Object }|null}
 */
function decodeFabricMessage (message) {
  if (!message) return null;

  let parsed = message;
  if (Buffer.isBuffer(message)) parsed = Message.fromBuffer(message);
  if (!parsed) return null;

  if (typeof Message.tryParseMessageBody === 'function') {
    const result = Message.tryParseMessageBody(parsed);
    if (result && result.ok && result.value && typeof result.value === 'object') {
      return {
        type: parsed.type || parsed.wireType || null,
        fields: result.value
      };
    }
  }

  if (typeof parsed.toFields === 'function') {
    const fields = parsed.toFields();
    if (fields && typeof fields === 'object') {
      return { type: parsed.type || null, fields };
    }
  }

  return null;
}

/**
 * Optional NOISE peer for the Fabric 0.1.0 playnet.
 * Stays offline unless `networking` is set, so local games and tests
 * can still build signed contract messages.
 */
class FabricNetwork {
  constructor (settings = {}) {
    this.settings = Object.assign({
      alias: '@fabric/rpg',
      hub: FABRIC_HUB,
      listen: false,
      networking: false,
      peers: [],
      port: FABRIC_PORT || P2P_PORT
    }, settings);

    this.peer = null;
    this.onDocument = null;
  }

  attach (handler) {
    this.onDocument = handler;
    return this;
  }

  async start (signer) {
    if (!this.settings.networking) return this;

    const peers = (this.settings.peers && this.settings.peers.length)
      ? this.settings.peers
      : [this.settings.hub];

    const options = {
      alias: this.settings.alias,
      listen: !!this.settings.listen,
      networking: true,
      peers,
      port: this.settings.port
    };

    if (signer) options.key = signer;
    else if (this.settings.key) options.key = this.settings.key;

    this.peer = new Peer(options);
    this.peer.on('message', (message) => {
      const document = decodeFabricMessage(message);
      if (document && this.onDocument) this.onDocument(document, message);
    });

    await this.peer.start();
    return this;
  }

  async stop () {
    if (this.peer) {
      await this.peer.stop();
      this.peer = null;
    }
    return this;
  }

  /**
   * Write a frame to connected peers. Returns 0 when the node is offline.
   * @param {Message|Buffer} message
   * @returns {Number}
   */
  broadcast (message) {
    if (!this.peer || typeof this.peer.broadcast !== 'function') return 0;
    const frame = Buffer.isBuffer(message) ? message : message.toBuffer();
    return this.peer.broadcast(frame) || 0;
  }
}

module.exports = {
  ARC_TYPE,
  ARC_VERSION,
  FABRIC_HUB,
  FabricNetwork,
  applicationResourceContract,
  contractPublishMessage,
  contractUpdateMessage,
  decodeFabricMessage
};
