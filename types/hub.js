'use strict';

const { FABRIC_HUB, FABRIC_PORT } = require('../constants');
const RPG = require('./rpg');

/**
 * Playnet host. Listens for Fabric peers and serves the RPG contract.
 */
class Hub {
  constructor (configuration = {}) {
    this.settings = Object.assign({
      alias: '@fabric/rpg',
      listen: true,
      networking: true,
      peers: [FABRIC_HUB],
      port: FABRIC_PORT,
      persistent: false
    }, configuration);

    this.rpg = new RPG(this.settings);
    return this;
  }

  async start () {
    await this.rpg.start();
    return this;
  }

  async stop () {
    await this.rpg.stop();
    return this;
  }
}

module.exports = Hub;
