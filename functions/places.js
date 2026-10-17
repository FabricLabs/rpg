'use strict';

/**
 * @fileoverview Stable places named from the name tables in
 * `inputs/names.json`. The same key always yields the same place, so a host
 * can give any channel, room, or coordinate a name and a biome.
 */

const NAMES = require('../inputs/names.json');
const biomes = require('./biomes');
const { hash } = require('./random');

/**
 * Site kind from a hash: a shrine is one in 40, a lair one in 55, and a ruin
 * one in nine. The rest are hamlets and towns.
 * @param {Number} h
 * @returns {String}
 */
function kindFor (h) {
  if (h % 40 === 0) return 'shrine';
  if (h % 55 === 1) return 'lair';
  if (h % 9 === 2) return 'ruin';
  return (h >>> 8) % 3 === 0 ? 'town' : 'hamlet';
}

function nameFor (h, kind) {
  const sites = NAMES.sites;
  if (kind === 'ruin') return sites.ruins[h % sites.ruins.length];
  if (kind === 'lair') return sites.lairs[h % sites.lairs.length];
  if (kind === 'shrine') return sites.shrines[h % sites.shrines.length];
  return `${sites.prefixes[h % sites.prefixes.length]}${sites.suffixes[(h >>> 4) % sites.suffixes.length]}`;
}

/**
 * The place for a key.
 * @param {String} key Any stable identifier.
 * @param {Object} [options]
 * @param {String} [options.biome] Force a biome instead of deriving one.
 * @param {String} [options.kind] Force a site kind.
 * @returns {{ key: String, name: String, kind: String, biome: String }}
 */
function placeFor (key, options = {}) {
  const h = hash(`place:${key}`);
  const kind = options.kind || kindFor(h);
  const biome = options.biome && biomes.get(options.biome)
    ? options.biome
    : biomes.IDS[hash(`biome:${key}`) % biomes.IDS.length];
  return { key: String(key), name: nameFor(h, kind), kind, biome };
}

function artifactName (h) {
  const { names, themes } = NAMES.artifacts;
  return `${names[(h >>> 3) % names.length]} of ${themes[h % themes.length]}`;
}

module.exports = {
  NAMES,
  artifactName,
  kindFor,
  placeFor
};
