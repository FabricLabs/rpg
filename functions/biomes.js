'use strict';

/**
 * @fileoverview The nine biomes with their climate centers and wildlife
 * spawn weights.
 */

const BIOMES = require('../inputs/biomes.json');

const IDS = Object.keys(BIOMES);

function get (id) {
  const def = BIOMES[id];
  return def ? Object.assign({ id }, def) : null;
}

function list () {
  return IDS.map(get);
}

/**
 * Soft biome weights from a climate sample: each biome scores by inverse
 * squared distance to its climate center.
 * @param {Object} climate `{ temperature, moisture, elevation }`, each 0–1.
 * @returns {{ primary: String, weights: Object }}
 */
function classify (climate = {}) {
  const t = Number(climate.temperature) || 0;
  const m = Number(climate.moisture) || 0;
  const e = Number(climate.elevation) || 0;
  const scores = {};
  let sum = 0;

  for (const id of IDS) {
    const center = BIOMES[id].climate;
    const dt = t - center.temperature;
    const dm = m - center.moisture;
    const de = e - center.elevation;
    const s = 1 / (0.04 + dt * dt + dm * dm + de * de);
    scores[id] = s;
    sum += s;
  }

  const weights = {};
  let primary = 'temperate_forest';
  let best = -1;
  for (const id of IDS) {
    weights[id] = sum > 0 ? scores[id] / sum : 0;
    if (weights[id] > best) {
      best = weights[id];
      primary = id;
    }
  }
  return { primary, weights };
}

module.exports = {
  BIOMES,
  IDS,
  classify,
  get,
  list
};
