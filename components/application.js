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
      authority: 'localhost:9999',
      canvas: {
        height: 768,
        width: 1024
      }
    }, configuration);

    this.rpg = new RPG(configuration);
    this.trust(this.rpg);

    return this;
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
      this.authority._connect();
    } catch (E) {
      this.error('Could not establish connection to authority:', E);
    }

    this.authority.post(`/players`, {
      name: Math.random()
    });

    this.log('[APP]', 'Started!');

    return this;
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
}

module.exports = Application;
