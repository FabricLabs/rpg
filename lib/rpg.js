'use strict';

const Fabric = require('@fabric/core');

class RPG extends Fabric {
  constructor (configuration) {
    super(configuration);
  }

  async start () {
    await super.start();
  }

  async stop () {
    await super.stop();
  }
}

module.exports = RPG;
