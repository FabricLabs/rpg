'use strict';

/**
 * @fileoverview Content packs. A game brings its own creatures, items, and
 * places by defining them on top of, or instead of, the built-in catalog:
 *
 *   content.define({
 *     items: { 'ray-gun': { name: 'Ray Gun', slot: 'main-hand', kind: 'weapon', material: 'iron', damage: 12, armor: 0, durability: 90, weight: 1, stackable: false, price: 120 } },
 *     creatures: { 'moon-crab': { name: 'Moon Crab', body: 'arachnid', hostile: true, attributes: { strength: 8, dexterity: 4, constitution: 14 } } },
 *     biomes: { lunar: { name: 'Lunar Mare', climate: { temperature: 0.1, moisture: 0, elevation: 0.5 }, spawns: { 'moon-crab': 1 } } }
 *   });
 *
 * Each entry adds or replaces one definition by id, and `null` removes it.
 * Catalogs are shared by every rule in the process, so define content once
 * at startup. `define` returns what `problems` finds afterwards.
 */

const affixes = require('./affixes');
const biomes = require('./biomes');
const bodies = require('./bodies');
const creatures = require('./creatures');
const equipment = require('./equipment');
const items = require('./items');
const loot = require('./loot');
const places = require('./places');

const CATALOGS = {
  bodies: bodies.BODIES,
  materials: items.MATERIALS,
  items: items.ITEMS,
  loot: loot.TABLES,
  equipment: equipment.TABLES,
  creatures: creatures.CREATURES,
  biomes: biomes.BIOMES
};

function merge (target, entries) {
  for (const [id, def] of Object.entries(entries || {})) {
    if (def == null) delete target[id];
    else target[id] = def;
  }
}

function mergeNames (target, entries) {
  for (const [key, value] of Object.entries(entries || {})) {
    if (Array.isArray(value) || value == null || typeof value !== 'object') target[key] = value;
    else target[key] = Object.assign({}, target[key], value);
  }
}

// Modules keep these index arrays from load time, so they change in place.
function refresh () {
  const slots = Object.values(bodies.BODIES).reduce((all, def) => all.concat((def.slots || []).filter((slot) => !all.includes(slot))), []);
  bodies.SLOTS.splice(0, bodies.SLOTS.length, ...slots);
  biomes.IDS.splice(0, biomes.IDS.length, ...Object.keys(biomes.BIOMES));
}

/**
 * Add, replace, or remove content.
 * @param {Object} pack Any of `bodies`, `materials`, `items`, `loot`,
 *   `equipment`, `creatures`, `biomes` (maps of id to definition or `null`),
 *   `affixes` (`{ prefixes, suffixes }`, each a map of id to definition or
 *   `null`), and `names` (`sites`, `deities`, `artifacts`; arrays replace,
 *   objects merge one level).
 * @returns {Array<String>} Problems in the catalog afterwards (see `problems`).
 */
function define (pack = {}) {
  for (const [kind, catalog] of Object.entries(CATALOGS)) merge(catalog, pack[kind]);
  if (pack.affixes) {
    for (const position of ['prefixes', 'suffixes']) {
      if (!pack.affixes[position]) continue;
      if (!affixes.AFFIXES[position]) affixes.AFFIXES[position] = {};
      merge(affixes.AFFIXES[position], pack.affixes[position]);
    }
  }
  if (pack.names) mergeNames(places.NAMES, pack.names);
  refresh();
  return problems();
}

function equipmentProblems (where, spec, body) {
  const out = [];
  const kit = equipment.table(spec);
  if (!kit) return [`${where} uses unknown equipment table ${JSON.stringify(spec)}`];
  for (const [slot, entry] of Object.entries(kit)) {
    if (body !== undefined && !bodies.has(body, slot)) out.push(`${where} (${body}) has no ${slot} slot`);
    for (const option of (entry && entry.items) || []) {
      const def = items.get(option.item);
      if (!def) out.push(`${where} ${slot} uses unknown item ${option.item}`);
      else if (def.slot !== slot) out.push(`${where} puts ${option.item} (${def.slot}) in ${slot}`);
      if (option.material && !items.MATERIALS[option.material]) out.push(`${where} ${slot} uses unknown material ${option.material}`);
    }
  }
  return out;
}

/**
 * Broken references in the catalog: creatures with unknown bodies, loot,
 * equipment, or drops; items of unknown materials or slots no body has;
 * loot and equipment entries naming unknown items; biomes spawning unknown
 * creatures.
 * @returns {Array<String>} Empty when everything resolves.
 */
function problems () {
  const out = [];
  for (const def of items.list()) {
    if (!items.MATERIALS[def.material]) out.push(`item ${def.id} uses unknown material ${def.material}`);
    if (def.slot && !bodies.SLOTS.includes(def.slot)) out.push(`item ${def.id} takes slot ${def.slot}, which no body has`);
  }
  for (const [id, entries] of Object.entries(loot.TABLES)) {
    for (const entry of entries || []) {
      if (!items.get(entry.item)) out.push(`loot ${id} drops unknown item ${entry.item}`);
    }
  }
  for (const id of Object.keys(equipment.TABLES)) out.push(...equipmentProblems(`equipment ${id}`, id));
  for (const def of creatures.list()) {
    const body = def.body || bodies.DEFAULT_BODY;
    if (!bodies.get(body)) out.push(`creature ${def.id} has unknown body ${body}`);
    if (def.loot && !loot.table(def.loot)) out.push(`creature ${def.id} uses unknown loot table ${def.loot}`);
    for (const drop of def.drops || []) {
      if (!items.get(drop.item)) out.push(`creature ${def.id} drops unknown item ${drop.item}`);
    }
    if (def.equipment) out.push(...equipmentProblems(`creature ${def.id}`, def.equipment, body));
  }
  for (const def of biomes.list()) {
    for (const id of Object.keys(def.spawns || {})) {
      if (!creatures.get(id)) out.push(`biome ${def.id} spawns unknown creature ${id}`);
    }
  }
  return out;
}

module.exports = {
  define,
  problems
};
