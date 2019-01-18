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
    this.identity = null;
    this.identities = {};
    this.networkPlayers = {};

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

    this.bgm = new Audio({ sources: ['madeon-icarus.mid'] } );
    this.channel = new Channel();

    return this;
  }

  async _handleAuthorityReady () {
    // TODO: load identity in caller
    if (!this.identity) {
      await this._createCharacter();
    }

    console.log('Authority ready!  calling _announcePlayer:', this.identity);

    await this._announcePlayer(this.identity);
    await this.swarm.identify(this.identity.address);
  }

  async _announcePlayer (identity) {
    let instance = await this.authority.post(`/peers`, identity);
    console.log('posted peer:', instance);

    let player = await this.stash._PUT(`/players/${identity.address}`, identity);
    console.log('player:', player);
  }

  async _createCharacter () {
    let item = null;
    let result = null;

    // TODO: async generation
    let key = new Fabric.Key();
    let struct = {
      name: prompt('What shall be your name?'),
      address: key.address,
      private: key.private.toString('hex'),
      public: key.public
    };

    console.log('key:', key);
    console.log('private:', key.private);

    try {
      item = await this.stash._POST(`/identities`, struct);
      result = await this.stash._GET(item);
    } catch (E) {
      console.error('broken:', E);
    }

    console.log('collection put:', item);
    console.log('result:', result);

    this.identities[struct.address] = struct;
    this.identity = struct;

    // TODO: remove public key from character, use only address (or direct hash)
    return {
      address: struct.address,
      public: struct.public
    };
  }

  async _requestName () {
    let name = prompt('What is your name?');
    let player = {
      name: name
    };

    await this.authority.post(`/players`, player);

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

    console.log('[APP:_restorePlayer]', 'identities:', identities);
  }

  async _handleMessage (msg) {
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

    console.log('hello:', parsed['@type'], parsed);

    switch (parsed['@type']) {
      default:
        console.error('[APP:_handleMessage]', `Unhandled type:`, parsed['type'], parsed);
        break;
      case 'PeerMessage':
        let content = parsed['@data'].object;

        switch (content['@type']) {
          default:
            console.log('[PEER:MESSAGE]', 'unhandled type', parsed['@data'].object['@type']);
            break;
          case 'PATCH':
            console.log('peer gave us PATCH:', content);

            try {
              let result = await this.authority.patch(content['@data'].path, content['@data'].value);
              let answer = await this.stash._PATCH(content['@data'].path, content['@data'].value);
              console.log('result:', result);
              console.log('answer:', answer);
            } catch (E) {
              console.log('could not patch:', E);
            }

            break;
        }
        break;
      case 'PATCH':
        this._processInstruction(parsed['@data']);
        break;
      case 'POST':
        this._processInstruction(parsed['@data']);
        break;
    }
  }

  async _onMessage (message) {
    console.log('hello, message:', message);

    switch (message['@type']) {
      default:
        console.log('application onMessage received unknown type:', message['@type']);
        break;
      case 'PeerMessage':
        console.log('hi peermessage:', message);

        await this.stash._POST(`/messages/${message.id}`, message);

        let fake = {
          data: JSON.stringify(message)
        };

        await this._handleMessage(fake);

        break;
    }
  }

  async _updatePosition (x, y, z) {
    if (!this.player) return;

    await this.authority.patch(`/players/${this.player.id}`, {
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
    console.log('process instruction:', instruction);
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
    console.log('[APP:DEBUG]', 'identities (in start):', identities);

    try {
      this.authority = new Authority(this['@data']);
      this.authority.on('connection:ready', this._handleAuthorityReady.bind(this));
      this.authority.on('message', this._handleMessage.bind(this));
      // this.authority.on('changes', this._handleChanges.bind(this));
      this.authority._connect();
    } catch (E) {
      this.error('Could not establish connection to authority:', E);
    }

    console.log('[SWARM]', 'beginning:', identities);

    this.swarm.on('message', this._onMessage.bind(this));
    // this.swarm.connect('test');

    this.log('[APP]', 'Started!');
    this.log('[APP]', 'State:', this.authority);

    return this;
  }
}

module.exports = Application;
