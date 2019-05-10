'use strict';

// prime constants
const GENESIS_HASH = 'f8c3bf62a9aa3e6fc1619c250e48abe7519373d3edf41be62eb5dc45199af2ef';
const HTTP_HOST = 'api.roleplaygateway.com';
const TICK_INTERVAL = 10000;
const FRAMES_PER_BLOCK = 60 * 60 * 10 * 1000;

const HEADER_LENGTH = 64;
const MAGIC_NUMBER = 0xC0D3F33D;
const MAP_TILE_SIZE = 32;

// ephemeral constants
const BIG_LIST_LIMIT = 5; // change to exceed maximum id for final run...

module.exports = {
  GENESIS_HASH,
  BIG_LIST_LIMIT,
  FRAMES_PER_BLOCK,
  HEADER_LENGTH,
  MAGIC_NUMBER,
  MAP_TILE_SIZE,
  HTTP_HOST,
  TICK_INTERVAL
};
