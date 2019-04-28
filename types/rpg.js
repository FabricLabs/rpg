'use strict';

// Fabric Core
const Fabric = require('@fabric/core');

// Load in types...
const World = require('./world');

/**
 * Primary RPG builder.
 */
class RPG extends Fabric {
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

    // start with empty game state
    this.state = {};

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
    await this.save();
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

  async build () {
    this['@world'].map._build();
    this['@world'].map._dump();
  }

  async save () {
    let data = JSON.stringify(this.state);
    return this._PUT('/memories', data);
  }

  async restore () {
    let blob = await this._GET(`/memories`);
    let data = null;

    try {
      let result = JSON.parse(blob);
      if (result) {
        this.state = result;
      }
    } catch (E) {
      console.error('Could not load restore:', E);
    }

    return data;
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
