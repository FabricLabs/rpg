'use strict';

const {
  MAGIC_NUMBER
} = require('../constants');

const crypto = require('crypto');
const Entity = require('./entity');

class Tile extends Entity {
  constructor (settings = {}) {
    super(settings);

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

    this.address = this.data.toString('hex');
    this.status = 'ready';

    return this;
  }

  get id () {
    let data = this.toJSON();
    let hash = crypto.createHash('sha256').update(data).digest('hex');
    return hash;
  }

  toJSON () {
    return JSON.stringify(this._downsample(this.data));
  }

  toObject () {
    return {
      id: this.id,
      address: this.address,
      stack: [...this.data],
      status: 'ready'
    };
  }

  _renderWith (sprite) {
    return `<foo>sprite to render with: ${sprite}</foo>`;
  }
}

module.exports = Tile;
