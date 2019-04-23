'use strict';

// Fabric Core
const Fabric = require('@fabric/core');

// Load in types...
const World = require('./world');

/**
 * Primary RPG builder.
 */
class RPG extends Fabric.App {
  /**
   * Build an RPG with the {@link Fabric} tools.
   * @param  {Object} configuration Settings to configure the RPG with.
   * @return {RPG} Instance of the RPG.
   */
  constructor (configuration) {
    super(configuration);

    this['@type'] = 'RPG';
    this['@configuration'] = Object.assign({
      name: 'RPG',
      path: './stores/rpg',
      authority: 'rpg.verse.pub',
      persistent: true,
      globals: {
        tick: 0
      },
      resources: {
        'Peer': {
          attributes: {
            address: { type: 'String', required: true, id: true }
          }
        }
      },
      canvas: {
        height: 300,
        width: 400
      },
      interval: 60000
    }, configuration);

    this['@world'] = new World(this['@configuration']['entropy']);
    this['@data'] = Object.assign({
      globals: {
        tick: 0
      }
    }, this['@configuration']);

    this.timer = null;
    this.remote = new Fabric.Remote({
      host: this['@configuration'].authority
    });

    return this;
  }

  async tick () {
    console.log('[RPG]', 'Beginning tick...', Date.now());

    let commit = this.commit();
    // console.log('tick:', commit);

    this.emit('tick'); // note: no return value
    return this;
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
    await this['@world'].start();
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
