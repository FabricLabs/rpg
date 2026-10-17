'use strict';

/**
 * @fileoverview Creature catalog and spawning at a
 * target level. Creatures gain one attribute point per level, like players,
 * spread across strength, dexterity, and constitution in proportion to the
 * creature's own build. Each has a body plan (`functions/bodies.js`) that
 * decides which equipment slots it has, and may name an equipment table
 * (`functions/equipment.js`) for what it wears in them.
 */

const CREATURES = require('../inputs/creatures.json');
const attributes = require('./attributes');
const bodies = require('./bodies');
const items = require('./items');
const { rollEquipment } = require('./equipment');
const { toRandom } = require('./random');

const GROWTH = ['strength', 'dexterity', 'constitution'];
const NATURAL_DAMAGE_PER_LEVEL = 2.8;
const NATURAL_DAMAGE_RAMP = 100;

function get (id) {
  const def = CREATURES[id];
  return def ? Object.assign({ id }, def) : null;
}

function list (filter) {
  const all = Object.keys(CREATURES).map(get);
  return typeof filter === 'function' ? all.filter(filter) : all;
}

/**
 * Whether a creature can be met by an actor of `level`: it appears from its
 * `minLevel` on (default 1), so giants and drakes wait until adventurers have
 * some gear.
 * @param {String|Object} creature Id or definition.
 * @param {Number} level Actor level.
 * @returns {Boolean}
 */
function appears (creature, level) {
  const def = typeof creature === 'string' ? get(creature) : creature;
  return !!def && (Math.floor(level) || 1) >= (Number(def.minLevel) || 1);
}

/**
 * Attributes for `base` grown to `level`.
 * @param {Object} base
 * @param {Number} level
 * @returns {Object}
 */
function grow (base, level) {
  const out = attributes.normalize(base);
  const points = (Math.max(1, Math.floor(level) || 1) - 1) * attributes.ATTRIBUTE_POINTS_PER_LEVEL;
  const weights = GROWTH.map((name) => Math.max(1, out[name]));
  const gained = GROWTH.map(() => 0);
  for (let i = 0; i < points; i++) {
    let best = 0;
    for (let k = 1; k < GROWTH.length; k++) {
      if (gained[k] / weights[k] < gained[best] / weights[best]) best = k;
    }
    gained[best] += 1;
  }
  GROWTH.forEach((name, k) => {
    out[name] += gained[k];
  });
  return out;
}

/**
 * Damage of a creature's claws, fangs, or fists: unarmed damage plus up to
 * 2.8 per level after the first. The per-level rate ramps in as
 * `level / (level + 100)`, so creatures toughen slowly while adventurers are
 * still gathering gear and keep pace with a full kit later.
 * @param {Object} grown Attributes at `level`.
 * @param {Number} level
 * @returns {Number}
 */
function naturalDamage (grown, level) {
  const n = Math.max(1, Math.floor(level) || 1);
  return Math.floor(attributes.unarmedDamage(grown) + NATURAL_DAMAGE_PER_LEVEL * (n - 1) * n / (n + NATURAL_DAMAGE_RAMP));
}

/**
 * A combatant for one creature at a level. It fights with natural weapons
 * (`naturalDamage`) or a carried weapon, whichever hits harder. What it
 * wears is rolled from its equipment table for the slots its body plan has,
 * at the creature's level, so a rare piece makes the creature stronger and
 * is dropped when it falls.
 * @param {String} id
 * @param {Object} [options]
 * @param {Number} [options.level]
 * @param {Object|Function|String|Number} [options.random]
 * @returns {Object|null}
 */
function spawn (id, options = {}) {
  const def = get(id);
  if (!def) return null;
  const rng = toRandom(options.random == null ? id : options.random);
  const level = Math.max(1, Math.floor(options.level) || 1);
  const variant = def.variants && def.variants.length ? rng.pick(def.variants) : null;
  const body = def.body || bodies.DEFAULT_BODY;
  const equipment = def.equipment ? rollEquipment(def.equipment, rng, { body, level }) : {};

  const grown = grow(def.attributes, level);
  return {
    id,
    name: variant ? variant.name : def.name,
    description: variant ? variant.description : def.description,
    type: def.type,
    body,
    hostile: !!def.hostile,
    unique: !!def.unique,
    level,
    attributes: grown,
    naturalDamage: naturalDamage(grown, level),
    equipment,
    loot: def.loot || null,
    drops: (def.drops || []).map((drop) => items.stack(drop.item, { count: drop.count })).filter(Boolean)
  };
}

module.exports = {
  CREATURES,
  NATURAL_DAMAGE_PER_LEVEL,
  NATURAL_DAMAGE_RAMP,
  appears,
  get,
  grow,
  list,
  naturalDamage,
  spawn
};
