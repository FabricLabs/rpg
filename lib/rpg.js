'use strict';

const Fabric = require('@fabric/core');

class RPG extends Fabric {
  constructor (configuration) {
    super(configuration);

    this['@type'] = 'RPG';
    this['@configuration'] = Object.assign({
      name: 'RPG',
      path: './stores/rpg',
      authority: 'rpg.verse.pub',
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
    this.remote = new Fabric.Remote({
      host: this['@configuration'].authority
    });

    return this;
  }

  async tick () {
    console.log('[RPG]', 'Beginning tick...', Date.now());
  }

  async _registerPlayer (data) {
    let result = null;

    try {
      result = await this._POST(`/players`, data);
    } catch (E) {
      this.error(E);
    }

    return result;
  }

  async start () {
    await super.start();

    let authority = this.remote;
    let options = await authority._OPTIONS('/');

    console.log('options:', options);

    this.timer = setInterval(this.tick.bind(this), this['@configuration'].interval);
    return this;
  }

  async stop () {
    clearInterval(this.timer);
    await super.stop();
    return this;
  }
}

module.exports = RPG;
