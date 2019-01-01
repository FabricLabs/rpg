'use strict';

const Fabric = require('@fabric/core');
const RPG = require('../lib/rpg');

const Authority = require('./authority');
const Canvas = require('./canvas');

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
    this.trust(this.rpg);

    this.bgm = new Audio({ sources: ['madeon-icarus.mid'] } );

    return this;
  }

  _handleMessage (msg) {
    console.log('message from authority:', msg);
  }

  _requestName () {
    let name = prompt('What is your name?');
    let player = {
      name: name
    };

    this.authority.post(`/players`, player);

    console.log('chosen name:', name);

    this.player = player;

    return this;
  }

  _toggleFullscreen () {
    if (this.element.webkitRequestFullScreen) {
      this.element.webkitRequestFullScreen();
    }
  }

  /**
   * Get the output of our program.
   * @return {String}           Output of the program.
   */
  render () {
    let canvas = new Canvas({
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

    try {
      this.authority = new Authority();
      this.authority.on('message', this._handleMessage.bind(this));
      // this.authority.on('changes', this._handleMessage.bind(this));
      this.authority._connect();
    } catch (E) {
      this.error('Could not establish connection to authority:', E);
    }

    this.log('[APP]', 'Started!');
    this.log('[APP]', 'State:', this.authority);

    return this;
  }
}

module.exports = Application;
