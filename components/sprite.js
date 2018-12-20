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

  render () {
    return this.element.draw();
  }
}

module.exports = Sprite;
