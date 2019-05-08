'use strict';

const {
  TICK_INTERVAL
} = require('../constants');

// Fabric Core
const Fabric = require('@fabric/core');

// Load in types...
const World = require('./world');
const Player = require('./player');

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
      interval: TICK_INTERVAL
    }, configuration);

    // start with empty game state
    this.state = {};

    this['@world'] = new World(this['@configuration']['entropy']);
    this['@player'] = new Player();
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
    let origin = new Fabric.State(this.state);

    // Our first and primary order of business is to update the clock.  Once
    // we've computed the game state for the next round, we can share it with
    // the world.
    //
    // Let's finish our work up front.
    this.state.clock++;

    // Snapshot of our state...
    let state = new Fabric.State(this.state);
    let json = state.render();

    this.log('[RPG:TICK]', `#${state.id}`, 'game state:', json);

    // Save the game state to disk.
    await this.save();

    // Looks like we're all done, so let's be courteous and notify subscribers.
    this.emit('tick', state.id);

    return this;
  }

  async _POST (path, data) {
    let id = await super._POST(path, data);
    let obj = await super._GET(id);

    // assign state
    this.state['players'][obj.id] = obj;

    // commit
    this.commit();

    return id;
  }

  async _registerPlayer (data) {
    let result = null;
    let state = new Fabric.State(data);
    let transform = [state.id, state.render()];

    let profile = Object.assign({
      id: `local/${state.id}`,
      sharing: transform
    }, data);

    try {
      result = await this._POST(`/players`, profile);
    } catch (E) {
      return this.error('Cannot create player:', E);
    }

    return result;
  }

  async build () {
    this['@world'].map._build();
    this['@world'].map._dump();
  }

  async save () {
    let result = null;
    let data = JSON.stringify(this.state);
    try {
      let saved = await this._PUT('/memories', data);
      this.log('[RPG]', 'saved:', saved);
      result = saved;
    } catch (E) {
      this.error('cannot save:', E);
    }

    return result;
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

    // TODO: clean up the clock
    this.state.clock = this['@configuration'].globals.tick;
    this.state.entropy = {};
    this.state.players = {};
    this.state.peers = {};

    await this['@world'].start();

    // TODO: document the process
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
