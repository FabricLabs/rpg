'use strict';

/**
 * @fileoverview Coinage: 100 copper is one
 * silver and 100 silver is one gold. Amounts are stored in copper.
 */

const COPPER_PER_SILVER = 100;
const SILVER_PER_GOLD = 100;
const COPPER_PER_GOLD = COPPER_PER_SILVER * SILVER_PER_GOLD;

function coins (copper) {
  const total = Math.max(0, Math.floor(Number(copper) || 0));
  return {
    gold: Math.floor(total / COPPER_PER_GOLD),
    silver: Math.floor((total % COPPER_PER_GOLD) / COPPER_PER_SILVER),
    copper: total % COPPER_PER_SILVER
  };
}

function toCopper ({ gold = 0, silver = 0, copper = 0 } = {}) {
  return gold * COPPER_PER_GOLD + silver * COPPER_PER_SILVER + copper;
}

/**
 * Short form, largest coin first: `3g 25s 40c`, `0c` for nothing.
 * @param {Number} copper
 * @returns {String}
 */
function format (copper) {
  const c = coins(copper);
  const parts = [];
  if (c.gold) parts.push(`${c.gold}g`);
  if (c.silver) parts.push(`${c.silver}s`);
  if (c.copper || !parts.length) parts.push(`${c.copper}c`);
  return parts.join(' ');
}

module.exports = {
  COPPER_PER_GOLD,
  COPPER_PER_SILVER,
  SILVER_PER_GOLD,
  coins,
  format,
  toCopper
};
