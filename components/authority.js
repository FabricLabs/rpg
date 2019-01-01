'use strict';

const Fabric = require('@fabric/core');

class Authority extends Fabric.Oracle {
  constructor (configuration) {
    super(configuration);

    this.config = Object.assign({
      host: 'localhost',
      port: 9999
    });

    this.attempt = 1;
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
    this.socket = new WebSocket(`ws://${this.config.host}:${this.config.port}`);
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

    authority.timer = setTimeout(function reconnect () {
      clearTimeout(authority.timer);
      authority.attempt++;
      authority._connect();
    }, Math.pow(authority.attempt, 2.5) * 1000);
  }
}

module.exports = Authority;
