'use strict';

const attributes = require('../functions/attributes');
const items = require('../functions/items');
const { toRandom } = require('../functions/random');

const MAX_ROUNDS = 50;
const VARIANCE = 0.15;
const CRITICAL_MULTIPLIER = 1.5;
const CRITICAL_MAX = 0.25;

/**
 * An automatic, seeded battle between two combatants.
 *
 * Health is `20 * level + 8 * STR`; a hit is the better of weapon gear damage
 * (which grows with item level) plus STR/4, and natural damage — the
 * participant's `naturalDamage` (creatures; see `creatures.naturalDamage`) or
 * else 2 + STR/2 for bare fists; damage is mitigated by `raw * K / (K + armor)`,
 * where armor is DEX plus equipped gear armor and `K` is 100 times the
 * attacker's `attributes.levelScale`. Every term grows about linearly with
 * level, so evenly matched fights last about as long at level 1000 as at 10.
 * The faster (higher DEX) side strikes first, each hit varies by ±15%, and
 * effective luck (LUCK + WIS/2) / 200 is the chance of a 1.5x critical,
 * capped at 25%. Attribute bonuses from equipped gear affixes count toward
 * every one of these. Only gear in slots the participant's body plan has
 * counts (`body`, default `humanoid`; see `functions/bodies.js`).
 *
 * Inputs are never mutated.
 */
class Battle {
  /**
   * @param {Array<Object>} participants Two `{ name, level, attributes, equipment, body, naturalDamage }`
   *   (`body` and `naturalDamage` optional).
   * @param {Object} [settings]
   * @param {Object|Function|String|Number} [settings.random] Generator, function, or seed.
   * @param {Number} [settings.maxRounds]
   */
  constructor (participants = [], settings = {}) {
    this.participants = participants;
    this.settings = Object.assign({ maxRounds: MAX_ROUNDS }, settings);
    this.random = toRandom(settings.random == null ? 'battle' : settings.random);
    this.result = null;
  }

  /**
   * Combat numbers for one participant.
   * @param {Object} entity
   * @returns {Object}
   */
  static fighter (entity = {}) {
    const level = Math.max(1, Math.floor(entity.level) || 1);
    const equipment = items.wearable(entity.equipment, entity.body);
    const base = attributes.normalize(entity.attributes);
    const bonus = items.equipmentAttributes(equipment);
    const stats = attributes.normalize(Object.fromEntries(
      Object.entries(base).map(([name, value]) => [name, value + (bonus[name] || 0)])
    ));
    const weapon = equipment['main-hand'] || null;
    const maxHealth = attributes.maxHealth(level, stats);
    const natural = Math.floor(Number(entity.naturalDamage)) > 0
      ? Math.floor(Number(entity.naturalDamage))
      : attributes.unarmedDamage(stats);
    const armed = weapon ? items.gearStats(weapon).damage + attributes.attackBonus(stats) : 0;
    return {
      name: entity.name || 'Unknown',
      level,
      maxHealth,
      health: maxHealth,
      damage: Math.max(armed, natural),
      armor: attributes.armor(stats) + items.equipmentArmor(equipment),
      speed: stats.dexterity,
      critical: Math.min(CRITICAL_MAX, attributes.effectiveLuck(stats) / 200)
    };
  }

  _strike (attacker, defender) {
    const swing = 1 - VARIANCE + 2 * VARIANCE * this.random.next();
    const critical = this.random.chance(attacker.critical);
    const raw = Math.max(1, Math.floor(attacker.damage * swing * (critical ? CRITICAL_MULTIPLIER : 1)));
    const damage = attributes.mitigate(raw, defender.armor, attacker.level);
    defender.health = Math.max(0, defender.health - damage);
    return { damage, critical };
  }

  /**
   * Fight until one side falls or the round limit is reached; then the side
   * with more health left (as a fraction) wins, the first participant on a tie.
   * @returns {{ winner: Number, victory: Boolean, rounds: Number, health: Array<Number>, maxHealth: Array<Number>, log: Array<Object> }}
   */
  compute () {
    const fighters = this.participants.slice(0, 2).map((entity) => Battle.fighter(entity));
    if (fighters.length < 2) throw new Error('A battle needs two participants.');

    const order = fighters[1].speed > fighters[0].speed ? [1, 0] : [0, 1];
    const log = [];
    let rounds = 0;

    while (rounds < this.settings.maxRounds && fighters[0].health > 0 && fighters[1].health > 0) {
      rounds += 1;
      for (const index of order) {
        const attacker = fighters[index];
        const defender = fighters[1 - index];
        if (attacker.health <= 0 || defender.health <= 0) continue;
        const hit = this._strike(attacker, defender);
        log.push({ round: rounds, attacker: index, damage: hit.damage, critical: hit.critical });
      }
    }

    let winner;
    if (fighters[1].health <= 0) winner = 0;
    else if (fighters[0].health <= 0) winner = 1;
    else {
      const left = fighters.map((f) => f.health / f.maxHealth);
      winner = left[1] > left[0] ? 1 : 0;
    }

    this.result = {
      winner,
      victory: winner === 0,
      rounds,
      health: fighters.map((f) => f.health),
      maxHealth: fighters.map((f) => f.maxHealth),
      log
    };
    return this.result;
  }
}

module.exports = Battle;
module.exports.MAX_ROUNDS = MAX_ROUNDS;
