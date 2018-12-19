'use strict';

const Fabric = require('@fabric/core');

class RPG extends Fabric {
  constructor (configuration) {
    super(configuration);

    this['@type'] = 'RPG';
    this['@configuration'] = Object.assign({
      name: 'RPG',
      path: './data/rpg',
      persistent: true,
      canvas: {
        height: 300,
        width: 400
      },
      interval: 60000
    }, configuration);

    this['@data'] = Object.assign({
      globals: {}
    }, this['@configuration']);

    this.timer = null;

    return this;
  }

  async tick () {
    console.log('[RPG]', 'Beginning tick...', Date.now());
  }

  async start () {
    await super.start();

    //
    this.timer = setInterval(this.tick.bind(this), this['@configuration'].interval);
  }

  async stop () {
    clearInterval(this.timer);

    await super.stop();
  }
}

module.exports = RPG;
