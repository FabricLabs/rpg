'use strict';

const Battle = require('./battle');
const creatures = require('../functions/creatures');
const biomes = require('../functions/biomes');
const items = require('../functions/items');
const { combine, rollLoot, GEAR_QUALITY_MIN, GEAR_QUALITY_MAX } = require('../functions/loot');
const { killExperience } = require('../functions/experience');
const { NAMES } = require('../functions/places');
const { toRandom } = require('../functions/random');

const DEFAULT_WEIGHTS = { monster: 6, item: 2, cache: 1, blessing: 1 };
const RARE_CHANCE = 0.08;
const LAIR_CHANCE = 0.15;
const LAIR_LEVEL_BONUS = 3;
const LEVEL_RANGE = 2;
const LEVEL_SPREAD = 0.1;
const LEVEL_OFFSET = 0;
const EXPERIENCE_RATE = 1;
const CACHE_MAX = 50;
const DEFAULT_BIOME = 'temperate_forest';

/**
 * One random encounter for an actor somewhere in the world. Pure: it reads
 * the actor and returns an outcome for the host to apply. `weights` picks
 * the type; leave a type out (e.g. `{ monster: 1 }`) and it never happens.
 *
 * - `monster`: a creature from `spawns`, or else the biome's spawn table
 *   (with `rareChance` one that roams anywhere, with `lairChance` at a lair
 *   the lair's beast), is fought with `Battle`. Only creatures whose
 *   `minLevel` the actor has reached are met unless none in the table has
 *   been; a win pays kill experience and the creature's loot. Its level is drawn evenly
 *   from the actor's level ± `levelRange` or ± `levelSpread` of it, whichever
 *   is wider (never below 1), centered `levelOffset` of the actor's level
 *   above it but at most `levelOffsetMax` levels (default 0: on the actor);
 *   a lair's beast is centered three levels higher still.
 * - `item`: a piece of gear the actor's body plan can wear is found.
 *
 * Gear from any source may roll a prefix and a suffix (`functions/affixes.js`).
 * Its item level is the creature's level, or for a find a level drawn like a
 * monster's.
 * - `cache`: a purse of `1..cacheMax` copper is found.
 * - `blessing`: a deity grants kill experience for the actor's level.
 *
 * Kill and blessing experience come from `killExperience` (default
 * `experience.killExperience`), multiplied by `experienceRate` and rounded,
 * so a host can set its own pace without changing the level curve.
 */
class Encounter {
  /**
   * @param {Object} settings
   * @param {Object} settings.actor `{ name, level, attributes, equipment, body }`
   *   (`body` defaults to `humanoid`).
   * @param {String} [settings.biome] Biome id; defaults to the place's biome.
   * @param {Object} [settings.place] `{ name, kind, biome }` from `places.placeFor`.
   * @param {Object|Function|String|Number} [settings.random] Generator, function, or seed.
   * @param {Object} [settings.weights] Relative weights of `monster`, `item`,
   *   `cache`, and `blessing` (default 6, 2, 1, 1).
   * @param {Object} [settings.spawns] `{ creatureId: weight }` met instead of
   *   the biome's spawn table, e.g. a dungeon floor's.
   * @param {Number} [settings.rareChance] Chance a monster is one that roams
   *   anywhere (default 0.08).
   * @param {Number} [settings.lairChance] Chance a monster at a lair is the
   *   lair's beast (default 0.15).
   * @param {Function} [settings.killExperience] `(level) => experience` for a
   *   kill or blessing at `level`.
   * @param {Object} [settings.battle] Settings for `Battle` (e.g. `maxRounds`).
   * @param {Number} [settings.cacheMax]
   * @param {Number} [settings.levelRange] Monster levels span at least the
   *   actor's level ± this many (default 2).
   * @param {Number} [settings.levelSpread] ...or ± this fraction of it, when
   *   wider (default 0.1).
   * @param {Number} [settings.levelOffset] Monsters are centered this
   *   fraction of the actor's level above it (default 0)...
   * @param {Number} [settings.levelOffsetMax] ...but at most this many levels
   *   (default no limit).
   * @param {Number} [settings.experienceRate] Multiplier on kill and blessing
   *   experience (default 1).
   */
  constructor (settings = {}) {
    this.settings = Object.assign({
      weights: DEFAULT_WEIGHTS,
      rareChance: RARE_CHANCE,
      lairChance: LAIR_CHANCE,
      cacheMax: CACHE_MAX,
      levelRange: LEVEL_RANGE,
      levelSpread: LEVEL_SPREAD,
      levelOffset: LEVEL_OFFSET,
      levelOffsetMax: null,
      experienceRate: EXPERIENCE_RATE
    }, settings);
    this.actor = settings.actor || {};
    this.place = settings.place || null;
    const biome = settings.biome || (this.place && this.place.biome);
    this.biome = biomes.get(biome) ? biome : (biomes.get(DEFAULT_BIOME) ? DEFAULT_BIOME : biomes.IDS[0]);
    this.random = toRandom(settings.random == null ? `${this.actor.name}:${this.actor.level}` : settings.random);
    this.outcome = this.compute();
  }

  get type () {
    return this.outcome.type;
  }

  get level () {
    return Math.max(1, Math.floor(this.actor.level) || 1);
  }

  _creatureId () {
    const rng = this.random;
    if (this.place && this.place.kind === 'lair' && rng.chance(this.settings.lairChance)) {
      const lair = creatures.list((c) => c.lair).map((c) => c.id);
      if (lair.length) return { id: rng.pick(lair), lair: true };
    }
    if (rng.chance(this.settings.rareChance)) {
      const rare = creatures.list((c) => c.anywhere > 0 && creatures.appears(c, this.level)).map((c) => [c.id, c.anywhere]);
      const id = rng.weighted(rare);
      if (id) return { id, lair: false };
    }
    const biome = biomes.get(this.biome);
    const table = this.settings.spawns || (biome && biome.spawns) || {};
    const known = Object.entries(table).filter(([id]) => creatures.get(id));
    const id = rng.weighted(known.filter(([id]) => creatures.appears(id, this.level))) || rng.weighted(known);
    if (!id) throw new Error(`Encounter has no creatures to meet in ${this.settings.spawns ? 'its spawns' : this.biome}.`);
    return { id, lair: false };
  }

  /**
   * A monster level centered on `center`, evenly spread over ± the wider of
   * `levelRange` and `levelSpread * center`.
   * @param {Number} center
   * @returns {Number}
   */
  monsterLevel (center) {
    const fixed = Math.max(0, Math.floor(Number(this.settings.levelRange)) || 0);
    const relative = Math.floor(center * Math.max(0, Number(this.settings.levelSpread) || 0));
    const range = Math.max(fixed, relative);
    return Math.max(1, center + this.random.between(-range, range));
  }

  /**
   * Experience paid for a kill or blessing at `level`.
   * @param {Number} level
   * @returns {Number}
   */
  experienceFor (level) {
    const rate = Number(this.settings.experienceRate);
    const base = typeof this.settings.killExperience === 'function' ? this.settings.killExperience(level) : killExperience(level);
    return Math.max(0, Math.round((Number(base) || 0) * (rate >= 0 ? rate : EXPERIENCE_RATE)));
  }

  /**
   * Where monster levels are centered: the actor's level plus `levelOffset`
   * of it, rounded and capped at `levelOffsetMax`.
   * @returns {Number}
   */
  get monsterCenter () {
    const offset = Math.max(0, Number(this.settings.levelOffset) || 0);
    const max = this.settings.levelOffsetMax == null ? Infinity : Math.max(0, Number(this.settings.levelOffsetMax) || 0);
    return this.level + Math.min(max, Math.round(this.level * offset));
  }

  _monster () {
    const rng = this.random;
    const pick = this._creatureId();
    const level = this.monsterLevel(pick.lair ? this.monsterCenter + LAIR_LEVEL_BONUS : this.monsterCenter);
    const creature = creatures.spawn(pick.id, { level, random: rng });
    const battle = new Battle([this.actor, creature], Object.assign({}, this.settings.battle, { random: rng })).compute();
    const victory = battle.victory;
    const loot = victory
      ? combine([].concat(
        creature.loot ? rollLoot(creature.loot, rng, { level: creature.level }) : [],
        creature.drops,
        Object.values(creature.equipment)
      ))
      : [];

    return {
      type: 'monster',
      creature: {
        id: creature.id,
        name: creature.name,
        body: creature.body,
        level: creature.level,
        hostile: creature.hostile,
        unique: creature.unique
      },
      victory,
      rounds: battle.rounds,
      health: battle.health[0],
      maxHealth: battle.maxHealth[0],
      experience: victory ? this.experienceFor(creature.level) : 0,
      loot
    };
  }

  _item () {
    const rng = this.random;
    const wearable = items.list((item) => items.canEquip(item, this.actor.body));
    const def = rng.pick(wearable.length ? wearable : items.list((item) => items.isGear(item)));
    const level = this.monsterLevel(this.level);
    return {
      type: 'item',
      item: items.roll(def.id, rng, { level, quality: rng.between(GEAR_QUALITY_MIN, GEAR_QUALITY_MAX) })
    };
  }

  _cache () {
    return { type: 'cache', wealth: this.random.between(1, Math.max(1, this.settings.cacheMax)) };
  }

  _blessing () {
    return {
      type: 'blessing',
      deity: this.random.pick(NAMES.deities),
      experience: this.experienceFor(this.level)
    };
  }

  compute () {
    const type = this.random.weighted(this.settings.weights) || 'monster';
    let outcome;
    switch (type) {
      case 'item': outcome = this._item(); break;
      case 'cache': outcome = this._cache(); break;
      case 'blessing': outcome = this._blessing(); break;
      default: outcome = this._monster(); break;
    }
    outcome.biome = this.biome;
    outcome.place = this.place ? { name: this.place.name, kind: this.place.kind } : null;
    return outcome;
  }

  toObject () {
    return this.outcome;
  }
}

module.exports = Encounter;
module.exports.DEFAULT_WEIGHTS = DEFAULT_WEIGHTS;
module.exports.EXPERIENCE_RATE = EXPERIENCE_RATE;
module.exports.LAIR_LEVEL_BONUS = LAIR_LEVEL_BONUS;
module.exports.LEVEL_OFFSET = LEVEL_OFFSET;
module.exports.LEVEL_RANGE = LEVEL_RANGE;
module.exports.LEVEL_SPREAD = LEVEL_SPREAD;
