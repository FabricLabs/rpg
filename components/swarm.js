'use strict';

const EventEmitter = require('events').EventEmitter;
const Peer = require('peerjs');
const Fabric = require('@fabric/core');

class Swarm extends EventEmitter {
  constructor (configuration = {}) {
    super(configuration);
    this.config = configuration;
    this.agent = null;
    this.connections = {};
  }

  identify (id) {
    this.agent = new Peer(id);
    this.agent.on('open', this._onOpen.bind(this));
    this.agent.on('connection', this._onInbound.bind(this));
  }

  connect (id) {
    if (this.connections[id]) return console.error(`Cannot connect to peer ${id} more than once.`);
    this.connections[id] = this.agent.connect(id);
    this.connections[id].on('open', this._onOpen.bind(this));
  }

  _onOpen (connection) {
    console.log('[SWARM:_onOpen]', 'opened! agent:', this.agent.id);
    console.log('[SWARM:_onOpen]', 'connection:', connection);
  }

  _onInbound (connection) {
    console.log(`incoming connection:`, connection);
    this.connections[connection.peer] = connection;
    this.connections[connection.peer].on('open', this._onOpen.bind(this));
    this.connections[connection.peer].on('data', this._onMessage.bind(this));
  }

  _onMessage (msg) {
    console.log('message:', msg);

    let vector = new Fabric.State({
      actor: `/actors/${this.agent.id}`,
      target: `/messages`,
      object: msg
    });

    this.emit('message', {
      '@type': 'PeerMessage',
      '@data': vector['@data']
    });
  }
}

module.exports = Swarm;
