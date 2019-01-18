'use strict';

const EventEmitter = require('events').EventEmitter;

class Peer extends EventEmitter {
  constructor (configuration = {}) {
    super(configuration);
    this.config = configuration;
    this.config.on('open', this._onOpen.bind(this));
    this.config.on('data', this._onData.bind(this));
  }

  async _onOpen () {
    this.emit('open');
  }

  async _onData (data) {
    this.emit('message', {
      '@actor': this.config.peer,
      '@type:': 'PeerMessage',
      '@data': data
    });
  }

  async send (msg) {
    this.config.send(msg);
  }
}

module.exports = Peer;
