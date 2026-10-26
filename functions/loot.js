'use strict';

/**
 * @fileoverview Drop tables: each entry
 * rolls `chance` (percent), then a count in `[min, max]`; gear rolls a quality
 * in `[qmin, qmax]` (default 30–70) and its affixes, at `affixChance` each when
 * the entry sets one (see `functions/affixes.js`).
 */

const TABLES = require('../inputs/loot.json');
const items = require('./items');
const { toRandom } = require('./random');

const GEAR_QUALITY_MIN = 30;
const GEAR_QUALITY_MAX = 70;

function table (id) {
  return TABLES[id] || null;
}

/**
 * Roll one loot table.
 * @param {String} id Table id from `inputs/loot.json`.
 * @param {Object|Function|String|Number} random Generator, function, or seed.
 * @param {Object} [options]
 * @param {Number} [options.level] Item level for gear (default 1).
 * @returns {Array<Object>} Item stacks.
 */
function rollLoot (id, random, options = {}) {
  const entries = table(id);
  if (!entries) return [];
  const rng = toRandom(random);
  const out = [];

  for (const entry of entries) {
    if (rng.int(100) >= entry.chance) continue;
    const count = rng.between(entry.min, entry.max);
    if (count <= 0) continue;
    const def = items.get(entry.item);
    if (!def) continue;
    if (def.stackable || !def.durability) {
      out.push(items.stack(entry.item, { count }));
      continue;
    }
    for (let k = 0; k < count; k++) {
      const quality = rng.between(entry.qmin || GEAR_QUALITY_MIN, entry.qmax || GEAR_QUALITY_MAX);
      out.push(items.roll(entry.item, rng, { level: options.level, quality, material: entry.material, affixChance: entry.affixChance }));
    }
  }

  return out;
}

/**
 * Merge stackable items with the same id so a drop reads as "Fang x3".
 * @param {Array<Object>} stacks
 * @returns {Array<Object>}
 */
function combine (stacks = []) {
  const out = [];
  const byId = {};
  for (const item of stacks) {
    if (!item) continue;
    const def = items.get(item.id);
    if (def && (def.stackable || !def.durability)) {
      if (byId[item.id]) {
        byId[item.id].count += item.count || 1;
        continue;
      }
      byId[item.id] = Object.assign({}, item);
      out.push(byId[item.id]);
      continue;
    }
    out.push(Object.assign({}, item));
  }
  return out;
}

module.exports = {
  GEAR_QUALITY_MAX,
  GEAR_QUALITY_MIN,
  TABLES,
  combine,
  rollLoot,
  table
};
