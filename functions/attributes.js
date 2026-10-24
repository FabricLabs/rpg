'use strict';

/**
 * @fileoverview Character attributes and derived stats. Attributes have no
 * ceiling; combat numbers that must keep pace with level use `levelScale`.
 */

const ATTRIBUTES = ['strength', 'dexterity', 'intelligence', 'wisdom', 'constitution', 'charisma', 'luck'];

const ATTRIBUTE_DEFAULT = 10;
const LEVEL_SCALE = 0.1;
const ARMOR_CONSTANT = 100;
const HP_PER_LEVEL = 20;
const HP_PER_STRENGTH = 8;
const STAMINA_BASE = 80;
const STAMINA_PER_LEVEL = 5;
const STAMINA_PER_DEXTERITY = 2;
const MANA_PER_LEVEL = 10;
const MANA_PER_INTELLIGENCE = 5;
const ATTRIBUTE_POINTS_PER_LEVEL = 1;

function whole (value, fallback) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function level (value) {
  const n = whole(value, 1);
  return n > 0 ? n : 1;
}

/**
 * Fill in missing attributes with the default (10); negatives and junk
 * become the default too.
 * @param {Object} [attributes]
 * @returns {Object}
 */
function normalize (attributes = {}) {
  const out = {};
  for (const name of ATTRIBUTES) {
    out[name] = whole(attributes && attributes[name], ATTRIBUTE_DEFAULT);
  }
  return out;
}

/**
 * Growth factor for anything that scales with level: `1 + 0.1 * (level - 1)`,
 * so level 11 is twice level 1 and level 101 eleven times.
 * @param {Number} lvl
 * @returns {Number}
 */
function levelScale (lvl) {
  return 1 + LEVEL_SCALE * (level(lvl) - 1);
}

function maxHealth (lvl, attributes = {}) {
  return HP_PER_LEVEL * level(lvl) + HP_PER_STRENGTH * whole(attributes.strength, ATTRIBUTE_DEFAULT);
}

function maxStamina (lvl, attributes = {}) {
  return STAMINA_BASE + STAMINA_PER_LEVEL * (level(lvl) - 1) + STAMINA_PER_DEXTERITY * whole(attributes.dexterity, ATTRIBUTE_DEFAULT);
}

function maxMana (lvl, attributes = {}) {
  return MANA_PER_LEVEL * level(lvl) + MANA_PER_INTELLIGENCE * whole(attributes.intelligence, ATTRIBUTE_DEFAULT);
}

/**
 * Natural armor from dexterity alone; gear armor is added by callers.
 * @param {Object} attributes
 * @returns {Number}
 */
function armor (attributes = {}) {
  return whole(attributes.dexterity, ATTRIBUTE_DEFAULT);
}

/**
 * Diminishing returns: `raw * K / (K + armor)` with `K = 100 * levelScale`
 * of the attacker, so the same armor stops less from a stronger foe. Any hit
 * deals at least 1.
 * @param {Number} raw
 * @param {Number} armorValue
 * @param {Number} [attackerLevel] Defaults to 1.
 * @returns {Number}
 */
function mitigate (raw, armorValue, attackerLevel = 1) {
  const amount = Math.floor(Number(raw) || 0);
  if (amount <= 0) return 0;
  const k = ARMOR_CONSTANT * levelScale(attackerLevel);
  const dealt = Math.floor((amount * k) / (k + whole(armorValue, 0)));
  return dealt > 0 ? dealt : 1;
}

function attackBonus (attributes = {}) {
  return Math.floor(whole(attributes.strength, ATTRIBUTE_DEFAULT) / 4);
}

function unarmedDamage (attributes = {}) {
  return Math.max(1, 2 + Math.floor(whole(attributes.strength, ATTRIBUTE_DEFAULT) / 2));
}

function effectiveLuck (attributes = {}) {
  return whole(attributes.luck, ATTRIBUTE_DEFAULT) + Math.floor(whole(attributes.wisdom, ATTRIBUTE_DEFAULT) / 2);
}

module.exports = {
  ARMOR_CONSTANT,
  ATTRIBUTES,
  ATTRIBUTE_DEFAULT,
  ATTRIBUTE_POINTS_PER_LEVEL,
  HP_PER_LEVEL,
  HP_PER_STRENGTH,
  LEVEL_SCALE,
  MANA_PER_INTELLIGENCE,
  MANA_PER_LEVEL,
  STAMINA_BASE,
  STAMINA_PER_DEXTERITY,
  STAMINA_PER_LEVEL,
  armor,
  attackBonus,
  effectiveLuck,
  levelScale,
  maxHealth,
  maxMana,
  maxStamina,
  mitigate,
  normalize,
  unarmedDamage
};
