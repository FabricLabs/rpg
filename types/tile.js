'use strict';

const {
  MAGIC_NUMBER
} = require('../constants');

class Tile {
  constructor (settings = {}) {
    this.settings = Object.assign({
      magic: MAGIC_NUMBER
    }, settings);

    // 4 byte vector
    this.data = Buffer.from([
      0x00, // z
      0x00, // y
      0x00, // x
      0x01 // version number
    ]);

    this.id = this.data.toString('hex');
    this.status = 'ready';

    return this;
  }
}

module.exports = Tile;
