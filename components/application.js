'use strict';

const Fabric = require('@fabric/core');
const RPG = require('../lib/rpg');

const Authority = require('./authority');
const Canvas = require('./canvas');
const Swarm = require('./swarm');

/**
 * Primary Application Definition
 * @property {Object} rpg Instance of the RPG engine.
 */
class Application extends Fabric.App {
  /**
   * Create an instance of the RPG client.
   * @param  {Object} [configuration={}] Key/value map of configuration options.
   * @return {Application}               Instance of our {@link Application}.
   */
  constructor (configuration = {}) {
    super(configuration);

    // An authority is required when running in a browser.
    this.authority = null;

    this['@data'] = Object.assign({
      authority: 'rpg.fabric.pub',
      canvas: {
        height: 768,
        width: 1024
      }
    }, configuration);

    this.rpg = new RPG(configuration);
    this.swarm = new Swarm();
    this.trust(this.rpg);

    return this;
  }

  _handleMessage (msg) {
    if (!msg.data) return console.error(`Malformed message:`, msg);

    let parsed = null;

    try {
      parsed = JSON.parse(msg.data);
    } catch (E) {
      return console.error(`Couldn't parse data:`, E);
    }

    if (!parsed['@type']) return console.error(`No type provided:`, parsed);
    if (!parsed['@data']) return console.error(`No data provided:`, parsed);

    if (typeof parsed['@data'] === 'string') {
      console.warn('Found string:', parsed);
      parsed['@data'] = JSON.parse(parsed['@data']);
    }

    switch (parsed['@data']['@type']) {
      default:
        console.warn(`Unhandled type:`, parsed['@data']['@type']);
        this._processInstruction(parsed['@data']);
        break;
      case 'PATCH':
        this._processInstruction(parsed['@data']);
        break;
    }
  }

  async _createCharacter () {
    let item = null;
    let result = null;

    // TODO: async generation
    let key = new Fabric.Key();
    let struct = {
      address: key.address,
      private: key.private.toString('hex'),
      public: key.public
    };

    console.log('key:', key);
    console.log('private:', key.private);

    let vector = new Fabric.State(struct);
    // let result = await this.stash._PUT(`/identities/${key.address}`, struct);
    
    try {
      item = await this.stash._POST(`/identities`, vector['@id']);
      result = await this.stash._GET(item);
    } catch (E) {
      console.error('broken:', E);
    }

    console.log('collection put:', item);
    console.log('result:', result);

    return struct;
  }

  async _requestName () {
    let name = prompt('What is your name?');
    let player = {
      name: name
    };

    this.authority.post(`/players`, player);

    player.id = key.address;

    this.player = player;

    console.log('id', this.player.id);

    return this;
  }

  async _restorePlayer () {
    let identities = null;

    try {
      identities = await this.stash._GET(`/identities`);
    } catch (E) {
      console.error('Could not load history:', E);
    }

    console.log('identities:', identities);
  }

  _updatePosition (x, y, z) {
    if (!this.player) return;
    this.authority.patch(`/players/${this.player.id}`, {
      id: this.player.id,
      x: x,
      y: y,
      z: z
    });
  }

  _toggleFullscreen () {
    if (this.element.webkitRequestFullScreen) {
      this.element.webkitRequestFullScreen();
    }
  }

  _processInstruction (instruction) {
    console.log('process instruction:');
  }

  _onMessage (message) {
    console.log('hello, message:', message);
    let fake = {
      data: JSON.stringify({
        '@type': 'PeerMessage',
        '@data': message
      })
    };
    this.authority._onMessage(fake);
  }

  /**
   * Get the output of our program.
   * @return {String}           Output of the program.
   */
  render () {
    let canvas = this.canvas = new Canvas({
      height: this.config.height,
      width: this.config.width
    });

    // let drawn = canvas.draw();
    let content = canvas.render();
    let state = new Fabric.State(content);
    let rendered = `<rpg-application integrity="sha256:${state.id}">${canvas.render()}</rpg-application><rpg-debugger data-bind="${state.id}" />`;
    let sample = new Fabric.State(rendered);

    if (this.element) {
      this.element.setAttribute('integrity', `sha256:${sample.id}`);
      this.element.innerHTML = rendered;
    }

    canvas.envelop('rpg-application canvas');

    return rendered;
  }

  async start () {
    this.log('[APP]', 'Starting...');

    try {
      await this.rpg.start();
    } catch (E) {
      this.error('Could not start RPG:', E);
      return null;
    }

    let identities = await this._restorePlayer();
    console.log('identities (in start):', identities);

    if (!identities) {
      identities = [await this._createCharacter()];
    }

    try {
      this.authority = new Authority();
      this.authority.on('message', this._handleMessage.bind(this));
      // this.authority.on('changes', this._handleChanges.bind(this));
      this.authority._connect();
    } catch (E) {
      this.error('Could not establish connection to authority:', E);
    }

    console.log('[SWARM]', 'beginning:', identities);

    this.swarm.on('message', this._onMessage.bind(this));
    this.swarm.identify(identities[0].address);
    // this.swarm.connect('test');

    this.log('[APP]', 'Started!');
    this.log('[APP]', 'State:', this.authority);

    return this;
  }
}

module.exports = Application;
