'use strict';

/**
 * @fileoverview Equipment tables: what a creature wears when it spawns. A
 * table maps slots to `{ chance, items }`: the slot is filled `chance`
 * percent of the time (default 100) with one weighted pick from `items`
 * (`{ item, weight, material, qmin, qmax }`). Pieces roll a quality in
 * `[qmin, qmax]` (default 35–85) and their affixes. Only slots the wearer's
 * body plan has are rolled, in the body's slot order.
 */

const TABLES = require('../inputs/equipment.json');
const bodies = require('./bodies');
const items = require('./items');
const { toRandom } = require('./random');

const QUALITY_MIN = 35;
const QUALITY_MAX = 85;

/**
 * An equipment table: an id from `inputs/equipment.json`, a table object, or
 * a list of item ids that are always worn.
 * @param {String|Object|Array<String>} spec
 * @returns {Object|null}
 */
function table (spec) {
  if (typeof spec === 'string') return TABLES[spec] || null;
  if (Array.isArray(spec)) {
    const kit = {};
    for (const id of spec) {
      const def = items.get(id);
      if (def && def.slot) kit[def.slot] = { chance: 100, items: [{ item: id }] };
    }
    return kit;
  }
  return spec && typeof spec === 'object' ? spec : null;
}

/**
 * Roll what a wearer has on.
 * @param {String|Object|Array<String>} spec Table (see `table`).
 * @param {Object|Function|String|Number} random Generator, function, or seed.
 * @param {Object} [options]
 * @param {String} [options.body] Body plan id; defaults to `humanoid`.
 * @param {Number} [options.level] Item level (default 1).
 * @returns {Object} `{ slot: stack }`
 */
function rollEquipment (spec, random, options = {}) {
  const kit = table(spec);
  const out = {};
  if (!kit) return out;
  const rng = toRandom(random);

  for (const slot of bodies.slots(options.body)) {
    const entry = kit[slot];
    if (!entry || !Array.isArray(entry.items)) continue;
    if (rng.int(100) >= (entry.chance == null ? 100 : entry.chance)) continue;
    const pick = rng.weighted(entry.items.map((option) => [option, option.weight == null ? 1 : option.weight]));
    if (!pick || !items.canEquip(pick.item, options.body) || items.get(pick.item).slot !== slot) continue;
    const quality = rng.between(pick.qmin || QUALITY_MIN, pick.qmax || QUALITY_MAX);
    out[slot] = items.roll(pick.item, rng, { level: options.level, quality, material: pick.material });
  }

  return out;
}

module.exports = {
  QUALITY_MAX,
  QUALITY_MIN,
  TABLES,
  rollEquipment,
  table
};
