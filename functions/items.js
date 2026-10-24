'use strict';

/**
 * @fileoverview Item catalog, gear stats, and prices. Prices are in copper.
 * Gear carries an item level: damage, armor, affix attribute bonuses, and
 * price grow by `attributes.levelScale(level)`.
 */

const ITEMS = require('../inputs/items.json');
const MATERIALS = require('../inputs/materials.json');
const affixes = require('./affixes');
const bodies = require('./bodies');
const { levelScale } = require('./attributes');

const SLOTS = bodies.SLOTS;
const DEFAULT_QUALITY = 50;

function get (id) {
  const def = ITEMS[id];
  return def ? Object.assign({ id }, def) : null;
}

function list (filter) {
  const all = Object.keys(ITEMS).map(get);
  return typeof filter === 'function' ? all.filter(filter) : all;
}

function material (id) {
  return MATERIALS[id] || MATERIALS.none;
}

function round (value, min) {
  const n = Math.floor(value + 0.5);
  return n < min ? min : n;
}

function clampQuality (quality) {
  const q = Math.floor(Number(quality) || DEFAULT_QUALITY);
  return Math.min(100, Math.max(1, q));
}

function qualityFactor (quality) {
  return 0.55 + 0.45 * (clampQuality(quality) / 100);
}

function isGear (def) {
  return !!def && !def.stackable && def.durability > 0;
}

function itemLevel (item) {
  const n = Math.floor(Number(item && item.level));
  return n > 1 ? n : 1;
}

/**
 * Whether a body plan can wear an item: it is gear and the body has its slot.
 * @param {String|Object} item Item id, definition, or stack.
 * @param {String} [body] Body plan id; defaults to `humanoid`.
 * @returns {Boolean}
 */
function canEquip (item, body) {
  const def = get(typeof item === 'string' ? item : item && item.id);
  return isGear(def) && bodies.has(body, def.slot);
}

/**
 * The part of an equipment map a body plan can actually wear: each piece in a
 * slot the body has and made for that slot.
 * @param {Object} equipment `{ slot: stack }`
 * @param {String} [body] Body plan id; defaults to `humanoid`.
 * @returns {Object}
 */
function wearable (equipment = {}, body) {
  const out = {};
  for (const slot of bodies.slots(body)) {
    const stack = equipment && equipment[slot];
    const def = stack && get(stack.id);
    if (def && def.slot === slot && isGear(def)) out[slot] = stack;
  }
  return out;
}

/**
 * Make an item stack. Gear (non-stackable with durability) gets an item
 * level, quality, material, full durability, and any affixes that fit it;
 * everything else is just `{ id, count }`.
 * @param {String} id
 * @param {Object} [options]
 * @param {Number} [options.count]
 * @param {Number} [options.level] Item level, at least 1.
 * @param {Number} [options.quality] 1–100
 * @param {String} [options.material] Defaults to the catalog material.
 * @param {String} [options.prefix] Prefix id from `inputs/affixes.json`.
 * @param {String} [options.suffix] Suffix id from `inputs/affixes.json`.
 * @returns {Object|null}
 */
function stack (id, options = {}) {
  const def = get(id);
  if (!def) return null;
  const count = Math.max(1, Math.floor(options.count || 1));
  if (!isGear(def)) return { id, count };

  const quality = clampQuality(options.quality);
  const mat = options.material && MATERIALS[options.material] ? options.material : def.material;
  const item = { id, count: 1, level: itemLevel(options), quality, material: mat };
  const prefix = affixes.get('prefix', options.prefix);
  const suffix = affixes.get('suffix', options.suffix);
  if (prefix && affixes.fits(prefix, def)) item.prefix = prefix.id;
  if (suffix && affixes.fits(suffix, def)) item.suffix = suffix.id;
  const mods = affixes.modifiers(item, def);
  const durabilityMax = round(def.durability * material(mat).durability * qualityFactor(quality) * mods.durability, 1);
  return Object.assign(item, { durability: durabilityMax, durabilityMax });
}

/**
 * Make a piece of gear with rolled affixes.
 * @param {String} id
 * @param {Object|Function|String|Number} random Generator, function, or seed.
 * @param {Object} [options] `stack()` options plus `affixChance`,
 *   `prefixChance`, and `suffixChance`.
 * @returns {Object|null}
 */
function roll (id, random, options = {}) {
  const def = get(id);
  if (!def) return null;
  if (!isGear(def)) return stack(id, options);
  const rolled = affixes.roll(def, random, {
    chance: options.affixChance,
    prefixChance: options.prefixChance,
    suffixChance: options.suffixChance
  });
  return stack(id, Object.assign({}, options, rolled));
}

function worn (item) {
  return item.durabilityMax > 0 && item.durability * 2 < item.durabilityMax;
}

/**
 * Damage and armor for one piece of gear, after item level and affixes.
 * Below half durability damage is x0.75 and armor x0.7.
 * @param {Object} item Stack from `stack()`.
 * @returns {{ damage: Number, armor: Number }}
 */
function gearStats (item) {
  const def = item && get(item.id);
  if (!def) return { damage: 0, armor: 0 };
  const mat = material(item.material || def.material);
  const q = qualityFactor(item.quality) * levelScale(itemLevel(item));
  const mods = affixes.modifiers(item, def);
  let damage = def.damage ? def.damage * mat.damage * q * mods.damage : 0;
  let armor = def.armor ? def.armor * mat.armor * q * mods.armor : 0;
  if (worn(item)) {
    damage *= 0.75;
    armor *= 0.7;
  }
  return {
    damage: def.damage ? round(damage, 1) : 0,
    armor: def.armor ? round(armor, 0) : 0
  };
}

/**
 * Attribute bonuses a piece of gear grants while equipped.
 * @param {Object} item
 * @returns {Object} `{ attribute: bonus }`
 */
function attributeBonus (item) {
  const def = item && get(item.id);
  if (!def) return {};
  const scale = levelScale(itemLevel(item));
  return Object.fromEntries(Object.entries(affixes.modifiers(item, def).attributes)
    .map(([name, bonus]) => [name, Math.floor(bonus * scale)]));
}

/**
 * One number to compare two items for the same slot: damage plus armor plus
 * every attribute bonus.
 * @param {Object} item
 * @returns {Number}
 */
function gearScore (item) {
  const stats = gearStats(item);
  const bonus = Object.values(attributeBonus(item)).reduce((sum, n) => sum + n, 0);
  return stats.damage + stats.armor + bonus;
}

/**
 * Summed attribute bonuses across equipped gear.
 * @param {Object} equipment `{ slot: stack }`
 * @returns {Object}
 */
function equipmentAttributes (equipment = {}) {
  const total = {};
  for (const slot of SLOTS) {
    for (const [name, bonus] of Object.entries(attributeBonus(equipment[slot]))) {
      total[name] = (total[name] || 0) + bonus;
    }
  }
  return total;
}

/**
 * `common`, `rare` (one affix), or `legendary` (prefix and suffix).
 * @param {Object} item
 * @returns {String}
 */
function rarity (item) {
  const def = item && get(item.id);
  return def ? affixes.rarity(item, def) : 'common';
}

/**
 * Sum of armor across equipped gear.
 * @param {Object} equipment `{ slot: stack }`
 * @returns {Number}
 */
function equipmentArmor (equipment = {}) {
  let total = 0;
  for (const slot of SLOTS) {
    if (equipment[slot]) total += gearStats(equipment[slot]).armor;
  }
  return total;
}

/**
 * Name as shown to players: prefix, material (when not the usual one), item,
 * suffix — e.g. "Keen Iron Club of the Bear".
 * @param {Object} item
 * @returns {String}
 */
function displayName (item) {
  const def = item && get(item.id);
  if (!def) return 'Unknown item';
  if (!isGear(def)) return item.count > 1 ? `${def.name} x${item.count}` : def.name;
  const mat = item.material && item.material !== def.material ? `${material(item.material).name} ` : '';
  const prefix = affixes.get('prefix', item.prefix);
  const suffix = affixes.get('suffix', item.suffix);
  return [
    prefix && affixes.fits(prefix, def) ? prefix.name : '',
    `${mat}${def.name}`,
    suffix && affixes.fits(suffix, def) ? suffix.name : ''
  ].filter(Boolean).join(' ');
}

/**
 * Indefinite article for an item's display name: `a`, `an`, or `''` for
 * plural names like "Leather Gauntlets" and for stacks of several.
 * @param {Object} item
 * @returns {String}
 */
function article (item) {
  const def = item && get(item.id);
  if (!def || item.count > 1 || /s$/i.test(def.name)) return '';
  return /^[aeiou]/i.test(displayName(item)) ? 'an' : 'a';
}

function price (item) {
  const def = item && get(item.id);
  if (!def || !(def.price > 0)) return 0;
  if (!def.stackable) {
    const base = (def.price * (item.quality || DEFAULT_QUALITY) * levelScale(itemLevel(item))) / 50;
    return Math.max(1, Math.floor(base * affixes.modifiers(item, def).price));
  }
  return def.price * Math.max(1, Math.floor(item.count || 1));
}

function sellPrice (item) {
  const buy = price(item);
  if (buy <= 0) return 0;
  return Math.max(1, Math.floor(buy / 2));
}

module.exports = {
  DEFAULT_QUALITY,
  ITEMS,
  MATERIALS,
  SLOTS,
  article,
  attributeBonus,
  canEquip,
  displayName,
  equipmentArmor,
  equipmentAttributes,
  gearScore,
  gearStats,
  get,
  isGear,
  itemLevel,
  list,
  material,
  price,
  qualityFactor,
  rarity,
  roll,
  sellPrice,
  stack,
  wearable
};
