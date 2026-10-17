'use strict';

/**
 * @fileoverview Experience curves. `power` (100 * level^1.5 to leave each
 * level by default; a host may pass its own base and exponent) and `linear`
 * (100 XP per level). A kill is worth
 * `30 * level^0.4`: it grows more slowly than the cost of a level
 * (about `150 * level^0.5`), so each level takes a little longer than the
 * last, forever.
 */

const LEVEL_BASE_EXPERIENCE = 100;
const LEVEL_EXPONENT = 1.5;
const KILL_EXPERIENCE_BASE = 30;
const KILL_EXPERIENCE_EXPONENT = 0.4;

const CURVES = {
  power: {
    levelFor (experience, base = LEVEL_BASE_EXPERIENCE, exponent = LEVEL_EXPONENT) {
      const xp = Math.max(0, Number(experience) || 0);
      let level = Math.max(1, Math.floor(Math.pow(xp / base, 1 / exponent)));
      while (level > 1 && xp < base * Math.pow(level - 1, exponent)) level -= 1;
      while (xp >= base * Math.pow(level, exponent)) level += 1;
      return level;
    },
    experienceFor (level, base = LEVEL_BASE_EXPERIENCE, exponent = LEVEL_EXPONENT) {
      const target = Math.max(1, Math.floor(level));
      return target <= 1 ? 0 : Math.ceil(base * Math.pow(target - 1, exponent));
    }
  },
  linear: {
    levelFor (experience, base = LEVEL_BASE_EXPERIENCE) {
      return Math.floor(Math.max(0, Number(experience) || 0) / base) + 1;
    },
    experienceFor (level, base = LEVEL_BASE_EXPERIENCE) {
      return (Math.max(1, Math.floor(level)) - 1) * base;
    }
  }
};

function curve (name) {
  const found = CURVES[name || 'power'];
  if (!found) throw new Error(`Unknown experience curve: ${name}`);
  return found;
}

/**
 * Level reached with `experience` on the named curve.
 * @param {Number} experience
 * @param {String} [name] `power` (default) or `linear`.
 * @param {Object} [options]
 * @param {Number} [options.base] Experience scale (default 100).
 * @param {Number} [options.exponent] `power` curve exponent (default 1.5).
 * @returns {Number}
 */
function levelFor (experience, name, options = {}) {
  return curve(name).levelFor(experience, options.base, options.exponent);
}

/**
 * Experience needed to reach `level` on the named curve.
 * @param {Number} level
 * @param {String} [name]
 * @param {Object} [options] Same as `levelFor`.
 * @returns {Number}
 */
function experienceFor (level, name, options = {}) {
  return curve(name).experienceFor(level, options.base, options.exponent);
}

function killExperience (level) {
  return Math.round(KILL_EXPERIENCE_BASE * Math.pow(Math.max(1, Math.floor(level) || 1), KILL_EXPERIENCE_EXPONENT));
}

module.exports = {
  CURVES,
  KILL_EXPERIENCE_BASE,
  KILL_EXPERIENCE_EXPONENT,
  LEVEL_BASE_EXPERIENCE,
  LEVEL_EXPONENT,
  experienceFor,
  killExperience,
  levelFor
};
