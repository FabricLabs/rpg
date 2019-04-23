'use strict';

const crypto = require('crypto');

class Tile {
  constructor (settings = {}) {
    this.id = crypto.createHash('sha256').update(Math.random()).digest('hex');
    this.settings = settings;
  }
}

module.exports = Tile;
