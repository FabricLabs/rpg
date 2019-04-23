'use strict';

const {
  HEADER_LENGTH,
  MAP_TILE_SIZE
} = require('../constants.js');

const Event = require('events');
const Fabric = require('@fabric/core');
const Tile = require('./tile');

class Map extends Event.EventEmitter {
  constructor (data = {}) {
    super(data);

    // Maps are matrices of a particular dimension.
    this.settings = Object.assign({
      height: 256,
      width: 256,
      depth: 256
    }, data);

    // Map memory: 64 byte header, 32 bytes per cell
    // ~16MB per map...
    this.size = HEADER_LENGTH + (MAP_TILE_SIZE * (
      this.settings.height *
      this.settings.width *
      this.settings.depth
    ));

    // TODO: replace with random from Fabric.Machine
    this.key = new Fabric.Key();
    console.log('fabric seed:', this.key.id);
    this.seed = this.key.id.toString('hex');
    console.log('local seed:', typeof this.seed, this.seed.length, this.seed);
    console.log('magic length:', 0xC0D3F33D.toString().length);
    this.data = Buffer.alloc(this.size);

    this.header = Buffer.alloc(HEADER_LENGTH);
    this.header.writeInt32BE(0x01, 0);
    this.header.write(0xC0D3F33D.toString(), 4);
    this.header.writeInt32BE(this.seed, 32);

    return this;
  }

  _build () {
    this.status = 'building';
    console.log(`[MAP]`, 'Building map (this can take a while)...');
    let number = (this.settings.height * this.settings.width * this.settings.depth);

    for (let i = 0; i < number; i++) {
      let tile = new Tile();
      let offset = 64 + (2 * i);
      this.data.writeInt32BE(tile.data, offset);
    }

    this.emit('build', [this.header, this.data]);
    this.status = 'ready';
  }

  _dump () {
    console.log('memory:', this.data);
  }
}

module.exports = Map;
