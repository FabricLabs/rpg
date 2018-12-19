'use strict';

const Fabric = require('@fabric/core');

class Entity extends Fabric.State {
  constructor (entity = {}) {
    super(entity);

    this['@data'] = Object.assign({
      position: {
        x: 0,
        y: 0,
        z: 1
      }
    }, entity);

    return this;
  }
}

module.exports = Entity;
