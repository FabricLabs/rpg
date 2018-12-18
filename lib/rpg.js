'use strict';

const Fabric = require('@fabric/core');

class RPG extends Fabric {
  constructor (configuration) {
    super(configuration);
  }

  async start () {
    await super.start();
    console.log('[RPG]', 'started:', this);
  }

  async stop () {
    await super.stop();
  }
}

module.exports = RPG;
