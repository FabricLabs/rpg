'use strict';

const Fabric = require('@fabric/core');

class Canvas extends Fabric.App {
  constructor (entity = {}) {
    super(entity);

    this.config = Object.assign({
      height: 300,
      width: 400
    }, entity);

    this['@data'] = this.config;

    return this;
  }

  draw () {
    let canvas = document.querySelector('rpg-application canvas');
    let context = canvas.getContext('2d');

    context.clearRect(0, 0, canvas.width, canvas.height);
    images.context = context;

    //drawBackground();
    drawMap();
    drawPlayers();

    window.requestAnimationFrame(drawFrame);
  }

  render () {
    return `<canvas width="${this.config.width}" height="${this.config.height}" integrity="sha256:${this.id}" />`;
  }
}

module.exports = Canvas;
