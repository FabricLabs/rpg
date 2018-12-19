'use strict';

class Sprite {
  constructor (entity) {
    this['@data'] = Object.assign({
      element: {
        position: {
          x: 0,
          y: 0,
          z: 0
        }
      }
    }, entity);
  }
}

module.exports = Sprite;
