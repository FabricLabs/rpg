'use strict';

class Authority {
  constructor (configuration) {
    // super(configuration);

    this.config = Object.assign({
      host: 'localhost',
      port: 9999
    });

    this.timer = null;
    this.queue = [];

    return this;
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
    let attempt = 0;
    let reconnectionTimes = [0, 100, 1000, 10000, 30000, 60000, 120000, 300000];

    this.timer = setTimeout(function reconnect () {
      clearTimeout(this.timer);
      this._connect();
      attempt++;
    }, reconnectionTimes[attempt]);
  }
}

module.exports = Authority;
