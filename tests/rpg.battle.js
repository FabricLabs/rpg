'use strict';

const assert = require('assert');

const Battle = require('../types/battle');
const Encounter = require('../types/encounter');
const WorldClock = require('../types/clock');
const RPG = require('../types/rpg');
const creatures = require('../functions/creatures');
const experience = require('../functions/experience');
const items = require('../functions/items');
const { TICK_INTERVAL } = require('../constants');

const hero = {
  name: 'Hero',
  level: 5,
  attributes: { strength: 12, dexterity: 11, constitution: 11 },
  equipment: { 'main-hand': items.stack('club', { quality: 50 }) }
};

describe('@fabric/rpg battles', function () {
  describe('Battle', function () {
    it('derives combat numbers from attributes and gear', function () {
      const fighter = Battle.fighter(hero);
      assert.strictEqual(fighter.maxHealth, 196);
      assert.strictEqual(fighter.damage, items.gearStats(hero.equipment['main-hand']).damage + 3);
      assert.strictEqual(fighter.armor, 11);
      assert.strictEqual(Battle.fighter({ level: 1 }).damage, 7);
    });

    it('adds attribute bonuses from equipped affixes', function () {
      const ring = items.stack('copper-ring', { prefix: 'mighty', suffix: 'bear' });
      const fighter = Battle.fighter(Object.assign({}, hero, { equipment: Object.assign({ ring }, hero.equipment) }));
      assert.strictEqual(fighter.maxHealth, 196 + 8 * 5);
    });

    it('is decided by its seed and never mutates the fighters', function () {
      const foe = { name: 'Slime', level: 4, attributes: { strength: 4, dexterity: 1, constitution: 16 } };
      const before = JSON.stringify([hero, foe]);
      const a = new Battle([hero, foe], { random: 'fight' }).compute();
      const b = new Battle([hero, foe], { random: 'fight' }).compute();
      assert.deepStrictEqual(a, b);
      assert.strictEqual(JSON.stringify([hero, foe]), before);
      assert.ok(a.rounds > 0);
      assert.ok(a.health[a.winner] > 0);
    });

    it('requires two participants', function () {
      assert.throws(() => new Battle([hero]).compute());
    });
  });

  describe('Encounter', function () {
    it('repeats an outcome for the same seed', function () {
      const a = new Encounter({ actor: hero, biome: 'grassland', random: 'e1' }).outcome;
      const b = new Encounter({ actor: hero, biome: 'grassland', random: 'e1' }).outcome;
      assert.deepStrictEqual(a, b);
    });

    it('produces every encounter type', function () {
      const seen = {};
      for (let i = 0; i < 200; i++) {
        const outcome = new Encounter({ actor: hero, biome: 'temperate_forest', random: i }).outcome;
        seen[outcome.type] = true;
        assert.strictEqual(outcome.biome, 'temperate_forest');
      }
      assert.deepStrictEqual(Object.keys(seen).sort(), ['blessing', 'cache', 'item', 'monster']);
    });

    it('pays kill experience and loot only on a win', function () {
      let wins = 0;
      let losses = 0;
      for (let i = 0; i < 100; i++) {
        const outcome = new Encounter({ actor: hero, biome: 'wetland', weights: { monster: 1 }, random: i }).outcome;
        assert.strictEqual(outcome.type, 'monster');
        if (outcome.victory) {
          wins++;
          assert.strictEqual(outcome.experience, experience.killExperience(outcome.creature.level));
          for (const stack of outcome.loot) assert.ok(items.get(stack.id));
        } else {
          losses++;
          assert.strictEqual(outcome.experience, 0);
          assert.deepStrictEqual(outcome.loot, []);
        }
      }
      assert.ok(wins > losses);
    });

    it('meets creatures only from their minimum level', function () {
      assert.ok(!creatures.appears('ogre', 14));
      assert.ok(creatures.appears('ogre', 15));
      assert.ok(creatures.appears('sheep', 1));
      assert.ok(!creatures.appears('nope', 50));
      const met = (level) => {
        const ids = new Set();
        for (let i = 0; i < 400; i++) {
          ids.add(new Encounter({ actor: Object.assign({}, hero, { level }), biome: 'tundra', weights: { monster: 1 }, rareChance: 0, random: `min:${level}:${i}` }).outcome.creature.id);
        }
        return ids;
      };
      assert.ok(!met(3).has('yeti'));
      assert.ok(met(30).has('yeti'));
    });

    it('meets a lair beast at a lair, a few levels up', function () {
      const levels = new Set();
      for (let i = 0; i < 100; i++) {
        const outcome = new Encounter({
          actor: hero,
          place: { name: 'The Maw', kind: 'lair', biome: 'volcanic' },
          weights: { monster: 1 },
          lairChance: 1,
          random: `lair:${i}`
        }).outcome;
        assert.ok(outcome.creature.unique);
        assert.deepStrictEqual(outcome.place, { name: 'The Maw', kind: 'lair' });
        levels.add(outcome.creature.level);
      }
      const center = hero.level + Encounter.LAIR_LEVEL_BONUS;
      assert.deepStrictEqual([...levels].sort((a, b) => a - b), [center - 2, center - 1, center, center + 1, center + 2]);
    });

    it('levels monsters across a range centered on the actor', function () {
      const levelsFor = (actor, settings = {}) => {
        const levels = [];
        for (let i = 0; i < 500; i++) {
          levels.push(new Encounter(Object.assign({ actor, biome: 'grassland', weights: { monster: 1 }, random: `lvl:${i}` }, settings)).outcome.creature.level);
        }
        return levels;
      };

      const levels = levelsFor(Object.assign({}, hero, { level: 10 }));
      assert.deepStrictEqual([...new Set(levels)].sort((a, b) => a - b), [8, 9, 10, 11, 12]);
      const mean = levels.reduce((sum, n) => sum + n, 0) / levels.length;
      assert.ok(Math.abs(mean - 10) < 0.25, `mean ${mean}`);

      assert.deepStrictEqual([...new Set(levelsFor(Object.assign({}, hero, { level: 10 }), { levelRange: 5 }))].length, 11);
      assert.ok(levelsFor(Object.assign({}, hero, { level: 10 }), { levelRange: 0, levelSpread: 0 }).every((n) => n === 10));
      assert.ok(levelsFor(Object.assign({}, hero, { level: 1 })).every((n) => n >= 1 && n <= 3));

      const high = levelsFor(Object.assign({}, hero, { level: 200 }));
      assert.strictEqual(Math.min(...high), 180);
      assert.strictEqual(Math.max(...high), 220);
    });

    it('centers monsters a share of the actor level higher, up to a cap', function () {
      const centered = (level, settings) => {
        const levels = [];
        for (let i = 0; i < 50; i++) {
          levels.push(new Encounter(Object.assign({ actor: Object.assign({}, hero, { level }), biome: 'grassland', weights: { monster: 1 }, levelRange: 0, levelSpread: 0, random: `off:${i}` }, settings)).outcome.creature.level);
        }
        return [...new Set(levels)];
      };
      assert.deepStrictEqual(centered(40, { levelOffset: 0.1 }), [44]);
      assert.deepStrictEqual(centered(400, { levelOffset: 0.1 }), [440]);
      assert.deepStrictEqual(centered(400, { levelOffset: 0.1, levelOffsetMax: 15 }), [415]);
      assert.deepStrictEqual(centered(4, { levelOffset: 0.1, levelOffsetMax: 15 }), [4]);
      assert.deepStrictEqual(centered(40, {}), [40]);
    });

    it('scales kill and blessing experience by the experience rate', function () {
      const actor = Object.assign({}, hero, { level: 10 });
      const paid = (type, rate) => {
        for (let i = 0; i < 200; i++) {
          const outcome = new Encounter({ actor, biome: 'grassland', weights: { [type]: 1 }, levelRange: 0, levelSpread: 0, experienceRate: rate, random: `xp:${i}` }).outcome;
          if (type === 'blessing' || outcome.victory) return outcome.experience;
        }
        return null;
      };
      assert.strictEqual(paid('blessing'), experience.killExperience(10));
      assert.strictEqual(paid('blessing', 0.5), Math.round(experience.killExperience(10) * 0.5));
      assert.strictEqual(paid('monster', 2), experience.killExperience(10) * 2);
    });

    it('drops and finds gear of the monster level', function () {
      const actor = Object.assign({}, hero, { level: 40 });
      let gear = 0;
      for (let i = 0; i < 300; i++) {
        const outcome = new Encounter({ actor, biome: 'grassland', weights: { monster: 1, item: 1 }, random: `gear:${i}` }).outcome;
        const stacks = outcome.type === 'item' ? [outcome.item] : outcome.loot;
        const expected = outcome.type === 'item' ? null : outcome.creature.level;
        for (const stack of stacks.filter((s) => items.isGear(items.get(s.id)))) {
          gear++;
          if (expected) assert.strictEqual(stack.level, expected);
          else assert.ok(stack.level >= 36 && stack.level <= 44, `find level ${stack.level}`);
        }
      }
      assert.ok(gear > 20, `gear ${gear}`);
    });

    it('keeps fights short at any level', function () {
      const rounds = (level) => {
        let total = 0;
        const kit = (id) => items.stack(id, { level, quality: 60 });
        const s = Math.floor((level - 1) / 3);
        const actor = {
          name: 'Hero',
          level,
          attributes: { strength: 10 + s, dexterity: 10 + s, constitution: 10 + s },
          equipment: { 'main-hand': kit('sword'), body: kit('iron-armor'), helmet: kit('iron-helmet'), leggings: kit('leather-leggings') }
        };
        for (let i = 0; i < 50; i++) {
          const wolf = creatures.spawn('wolf', { level, random: i });
          total += new Battle([actor, wolf], { random: `short:${level}:${i}` }).compute().rounds;
        }
        return total / 50;
      };
      for (const level of [10, 150, 1500, 15000]) {
        const average = rounds(level);
        assert.ok(average > 3 && average < Battle.MAX_ROUNDS / 2, `level ${level}: ${average} rounds`);
      }
    });
  });

  describe('WorldClock', function () {
    it('ticks on the 10-minute world period', function () {
      const clock = new WorldClock({ now: () => TICK_INTERVAL * 7 + 5 });
      assert.strictEqual(clock.interval, 600000);
      assert.strictEqual(clock.epoch, 7);
      const ticks = [];
      clock.on('tick', (tick) => ticks.push(tick));
      clock.advance();
      clock.advance();
      assert.deepStrictEqual(ticks.map((t) => t.clock), [1, 2]);
      assert.strictEqual(ticks[0].epoch, 7);
    });

    it('starts and stops a timer', function (done) {
      const clock = new WorldClock({ interval: 5 });
      clock.once('tick', (tick) => {
        clock.stop();
        assert.strictEqual(tick.clock, 1);
        assert.strictEqual(clock.running, false);
        done();
      });
      clock.start();
      assert.strictEqual(clock.running, true);
    });

    it('drives RPG#beat', async function () {
      const rpg = new RPG({ persistent: false, networking: false, autotick: false });
      await rpg.start();
      assert.strictEqual(rpg.worldClock.running, false);
      rpg.worldClock.advance();
      assert.strictEqual(rpg._state.content.clock, 1);
      rpg.beat();
      assert.strictEqual(rpg.worldClock.clock, 2);
      await rpg.stop();
    });
  });
});
