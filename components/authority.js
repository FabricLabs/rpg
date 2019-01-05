'use strict';

const Fabric = require('@fabric/core');

class Authority extends Fabric.Oracle {
  constructor (configuration) {
    super(configuration);

    this.config = Object.assign({
      host: 'rpg.verse.pub',
      port: 443
    }, configuration);

    this.attempt = 0;
    this.timer = null;
    this.queue = [];

    return this;
  }

  patch (key, value) {
    this.socket.send(JSON.stringify({
      '@type': 'PATCH',
      '@data': {
        path: key,
        value: value
      }
    }));
  }

  post (key, value) {
    this.socket.send(JSON.stringify({
      '@type': 'POST',
      '@data': {
        path: key,
        value: value
      }
    }));
  }

  _connect () {
    this.socket = new WebSocket(`wss://${this.config.host}:${this.config.port}/connections`);
    this.socket.onopen = this._onConnection.bind(this);
    this.socket.onmessage = this._onMessage.bind(this);
    this.socket.onclose = this._onClose.bind(this);
    this.socket.onerror = this._onClose.bind(this);
  }

  _onConnection (event) {
    this.status = 'connected';
  }

  _onMessage (event) {
    this.queue.push(event);
    this.emit('message', event);
  }

  _onClose (event) {
    this.status = 'disconnected';

    let authority = this;
    let distance = Math.pow(authority.attempt, 2) * 1000;

    console.log('[RPG:AUTHORITY]', `connection closed, retrying in ${distance} milliseconds.`);

    authority.timer = setTimeout(function reconnect () {
      clearTimeout(authority.timer);
      authority.attempt++;
      authority._connect();
    }, distance);
  }
}

module.exports = Authority;
