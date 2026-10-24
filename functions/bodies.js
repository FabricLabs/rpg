'use strict';

/**
 * @fileoverview Body plans and the equipment slots each one has. A humanoid
 * (players, bandits, skeletons) wears armor from head to toe, a ring, and a
 * necklace, and wields a weapon; a quadruped takes only a collar and barding;
 * birds, serpents, plants, and the like carry nothing. Anything without a body plan
 * is humanoid; a body plan missing from the catalog has no slots.
 */

const BODIES = require('../inputs/bodies.json');

const DEFAULT_BODY = 'humanoid';
const SLOTS = Object.values(BODIES).reduce((all, def) => all.concat(def.slots.filter((slot) => !all.includes(slot))), []);

function get (id) {
  const key = id == null ? DEFAULT_BODY : id;
  const def = BODIES[key];
  return def ? Object.assign({ id: key }, def, { slots: def.slots.slice() }) : null;
}

function list (filter) {
  const all = Object.keys(BODIES).map(get);
  return typeof filter === 'function' ? all.filter(filter) : all;
}

/**
 * Equipment slots of a body plan.
 * @param {String} [id] Defaults to `humanoid`.
 * @returns {Array<String>}
 */
function slots (id) {
  const def = get(id);
  return def ? def.slots : [];
}

/**
 * Whether a body plan has a slot.
 * @param {String} id
 * @param {String} slot
 * @returns {Boolean}
 */
function has (id, slot) {
  return !!slot && slots(id).includes(slot);
}

module.exports = {
  BODIES,
  DEFAULT_BODY,
  SLOTS,
  get,
  has,
  list,
  slots
};
