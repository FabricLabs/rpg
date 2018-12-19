'use strict';

const RPG = require('./rpg');

class Application {
  constructor (configuration = {}) {
    this['@data'] = Object.assign({}, configuration);

    this.rpg = new RPG(configuration);

    return this;
  }

  async start () {
    console.log('[APP]', 'Starting...');
    await this.rpg.start();
    console.log('[APP]', 'Started!');
    return this;
  }

  render () {
    return `<Application><canvas id="canvas" width="1024" height="768"></canvas></Application>`;
  }
}

module.exports = Application;
