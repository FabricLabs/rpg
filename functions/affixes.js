'use strict';

/**
 * @fileoverview Prefixes and suffixes for rare gear. Each drop rolls a prefix
 * and a suffix independently, so one affix is rare and both together are
 * extremely rare. An affix may scale damage, armor, durability, and price,
 * and may grant attribute bonuses while the piece is equipped. `kinds`
 * limits an affix to weapons or armor; without it any gear can carry it.
 */

const AFFIXES = require('../inputs/affixes.json');
const { toRandom } = require('./random');

const PREFIX_CHANCE = 0.06;
const SUFFIX_CHANCE = 0.06;
const POSITIONS = { prefix: 'prefixes', suffix: 'suffixes' };

/**
 * One affix definition.
 * @param {String} position `prefix` or `suffix`.
 * @param {String} id
 * @returns {Object|null}
 */
function get (position, id) {
  const table = AFFIXES[POSITIONS[position]];
  const def = table && id ? table[id] : null;
  return def ? Object.assign({ id }, def) : null;
}

/**
 * Whether an affix can appear on an item.
 * @param {Object} affix
 * @param {Object} def Item definition with `kind`.
 * @returns {Boolean}
 */
function fits (affix, def) {
  return !affix.kinds || affix.kinds.includes(def.kind);
}

/**
 * Affixes that can appear on an item.
 * @param {String} position `prefix` or `suffix`.
 * @param {Object} def Item definition with `kind`.
 * @returns {Array<Object>}
 */
function eligible (position, def) {
  const table = AFFIXES[POSITIONS[position]] || {};
  return Object.keys(table).map((id) => get(position, id)).filter((affix) => fits(affix, def));
}

function pick (position, def, rng) {
  const options = eligible(position, def).map((affix) => [affix.id, affix.weight || 1]);
  return rng.weighted(options) || null;
}

/**
 * Roll affixes for a piece of gear.
 * @param {Object} def Item definition with `kind`.
 * @param {Object|Function|String|Number} random Generator, function, or seed.
 * @param {Object} [options]
 * @param {Number} [options.chance] Overrides both chances.
 * @param {Number} [options.prefixChance]
 * @param {Number} [options.suffixChance]
 * @returns {{ prefix: String|null, suffix: String|null }}
 */
function roll (def, random, options = {}) {
  const rng = toRandom(random);
  const prefixChance = options.chance != null ? options.chance : (options.prefixChance != null ? options.prefixChance : PREFIX_CHANCE);
  const suffixChance = options.chance != null ? options.chance : (options.suffixChance != null ? options.suffixChance : SUFFIX_CHANCE);
  const prefix = rng.chance(prefixChance) ? pick('prefix', def, rng) : null;
  const suffix = rng.chance(suffixChance) ? pick('suffix', def, rng) : null;
  return { prefix, suffix };
}

/**
 * The affixes on an item stack that still exist and fit it.
 * @param {Object} item Stack with optional `prefix` / `suffix` ids.
 * @param {Object} def Item definition.
 * @returns {Array<Object>}
 */
function on (item, def) {
  if (!item || !def) return [];
  return [get('prefix', item.prefix), get('suffix', item.suffix)].filter((affix) => affix && fits(affix, def));
}

/**
 * Combined multipliers and attribute bonuses from an item's affixes.
 * @param {Object} item
 * @param {Object} def
 * @returns {{ damage: Number, armor: Number, durability: Number, price: Number, attributes: Object }}
 */
function modifiers (item, def) {
  const out = { damage: 1, armor: 1, durability: 1, price: 1, attributes: {} };
  for (const affix of on(item, def)) {
    for (const key of ['damage', 'armor', 'durability', 'price']) {
      if (affix[key] > 0) out[key] *= affix[key];
    }
    for (const [name, bonus] of Object.entries(affix.attributes || {})) {
      out.attributes[name] = (out.attributes[name] || 0) + bonus;
    }
  }
  return out;
}

/**
 * `common` with no affixes, `rare` with one, `legendary` with both.
 * @param {Object} item
 * @param {Object} def
 * @returns {String}
 */
function rarity (item, def) {
  const count = on(item, def).length;
  if (count >= 2) return 'legendary';
  return count === 1 ? 'rare' : 'common';
}

module.exports = {
  AFFIXES,
  PREFIX_CHANCE,
  SUFFIX_CHANCE,
  eligible,
  fits,
  get,
  modifiers,
  on,
  rarity,
  roll
};
