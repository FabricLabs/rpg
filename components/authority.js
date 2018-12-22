'use strict';

class Authority {
  constructor (configuration) {
    super(configuration);
    
    this.config = Object.assign({
      host: 'localhost',
      port: 9999
    });
  }

  _connect () {
    this.socket = new WebSocket(`ws://${this.config.host}:${this.config.port}`);
  }
}
