'use strict';

/**
 * @fileoverview Seeded randomness shared by every RPG rule. Rolls never call
 * `Math.random` directly: callers pass a seed (string or number) or their own
 * `random()` function, so the same seed always replays the same outcome.
 */

/**
 * 32-bit FNV-1a hash of a string.
 * @param {String} input
 * @returns {Number} Unsigned 32-bit integer.
 */
function hash (input) {
  const text = String(input);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * mulberry32 generator over a 32-bit state.
 * @param {Number} state
 * @returns {Function} Returns floats in [0, 1).
 */
function mulberry32 (state) {
  let a = state >>> 0;
  return function next () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Wrap a `() => [0, 1)` function with the helpers the rules use.
 * @param {Function} next
 * @returns {Object}
 */
function wrap (next) {
  const rng = {
    next,
    /** Integer in [0, n). */
    int (n) {
      return Math.floor(next() * n);
    },
    /** Integer in [min, max], inclusive. */
    between (min, max) {
      if (max <= min) return min;
      return min + Math.floor(next() * (max - min + 1));
    },
    chance (probability) {
      return next() < probability;
    },
    pick (list) {
      if (!list || !list.length) return undefined;
      return list[Math.floor(next() * list.length)];
    },
    /**
     * Weighted pick from `{ key: weight }` or `[[key, weight], ...]`.
     * @returns {*} The chosen key, or undefined when nothing has weight.
     */
    weighted (weights) {
      const entries = Array.isArray(weights) ? weights : Object.entries(weights || {});
      let total = 0;
      for (const [, weight] of entries) total += weight > 0 ? weight : 0;
      if (total <= 0) return undefined;
      let roll = next() * total;
      for (const [key, weight] of entries) {
        if (!(weight > 0)) continue;
        roll -= weight;
        if (roll < 0) return key;
      }
      return entries[entries.length - 1][0];
    }
  };
  return rng;
}

/**
 * Seeded generator. Strings are hashed; numbers are used as the state.
 * @param {String|Number} seed
 * @returns {Object}
 */
function seeded (seed) {
  const state = typeof seed === 'number' ? seed : hash(seed);
  return wrap(mulberry32(state));
}

/**
 * Normalize whatever a caller passed as randomness: a generator from
 * `seeded()`, a bare `() => [0, 1)` function, or a seed.
 * @param {Object|Function|String|Number} source
 * @returns {Object}
 */
function toRandom (source) {
  if (source && typeof source === 'object' && typeof source.next === 'function' && typeof source.weighted === 'function') return source;
  if (typeof source === 'function') return wrap(source);
  if (typeof source === 'string' || typeof source === 'number') return seeded(source);
  throw new TypeError('A seed or random() function is required.');
}

module.exports = {
  hash,
  mulberry32,
  seeded,
  toRandom,
  wrap
};
