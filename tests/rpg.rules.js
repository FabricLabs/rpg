'use strict';

const assert = require('assert');

const Battle = require('../types/battle');
const Encounter = require('../types/encounter');
const attributes = require('../functions/attributes');
const biomes = require('../functions/biomes');
const bodies = require('../functions/bodies');
const content = require('../functions/content');
const creatures = require('../functions/creatures');
const currency = require('../functions/currency');
const equipment = require('../functions/equipment');
const experience = require('../functions/experience');
const items = require('../functions/items');
const loot = require('../functions/loot');
const places = require('../functions/places');
const random = require('../functions/random');

describe('@fabric/rpg rules', function () {
  describe('random', function () {
    it('repeats a sequence for the same seed', function () {
      const a = random.seeded('goon');
      const b = random.seeded('goon');
      const c = random.seeded('other');
      const left = [a.next(), a.next(), a.next()];
      assert.deepStrictEqual(left, [b.next(), b.next(), b.next()]);
      assert.notDeepStrictEqual(left, [c.next(), c.next(), c.next()]);
    });

    it('keeps helpers inside their ranges', function () {
      const rng = random.seeded(1);
      for (let i = 0; i < 500; i++) {
        const n = rng.between(3, 5);
        assert.ok(n >= 3 && n <= 5);
        assert.ok(rng.int(4) < 4);
      }
      assert.strictEqual(rng.weighted({ only: 1, never: 0 }), 'only');
      assert.strictEqual(rng.chance(0), false);
      assert.strictEqual(rng.chance(1), true);
    });

    it('accepts a generator, a function, or a seed', function () {
      const rng = random.seeded('x');
      assert.strictEqual(random.toRandom(rng), rng);
      assert.strictEqual(random.toRandom(() => 0).int(10), 0);
      assert.strictEqual(random.toRandom('x').next(), random.seeded('x').next());
      assert.throws(() => random.toRandom({}), TypeError);
    });
  });

  describe('attributes', function () {
    it('derives health, damage, and luck', function () {
      const base = attributes.normalize({});
      assert.strictEqual(base.strength, 10);
      assert.strictEqual(attributes.maxHealth(1, base), 100);
      assert.strictEqual(attributes.maxHealth(5, { strength: 14 }), 212);
      assert.strictEqual(attributes.attackBonus(base), 2);
      assert.strictEqual(attributes.unarmedDamage(base), 7);
      assert.strictEqual(attributes.armor({ dexterity: 13 }), 13);
      assert.strictEqual(attributes.effectiveLuck(base), 15);
    });

    it('mitigates with raw * K / (K + armor), at least 1', function () {
      assert.strictEqual(attributes.mitigate(10, 10), 9);
      assert.strictEqual(attributes.mitigate(100, 100), 50);
      assert.strictEqual(attributes.mitigate(1, 400), 1);
      assert.strictEqual(attributes.mitigate(100, 200, 11), 50);
    });

    it('scales with level and has no ceiling', function () {
      assert.strictEqual(attributes.levelScale(1), 1);
      assert.strictEqual(attributes.levelScale(11), 2);
      assert.strictEqual(attributes.levelScale(101), 11);
      assert.strictEqual(attributes.normalize({ strength: 450 }).strength, 450);
      assert.strictEqual(attributes.normalize({ strength: -3 }).strength, 10);
    });
  });

  describe('items', function () {
    it('scales gear by quality and material', function () {
      assert.strictEqual(items.qualityFactor(100), 1);
      assert.strictEqual(items.qualityFactor(50), 0.775);
      const sword = items.stack('sword', { quality: 50 });
      assert.deepStrictEqual(sword, { id: 'sword', count: 1, level: 1, quality: 50, material: 'iron', durability: 135, durabilityMax: 135 });
      assert.deepStrictEqual(items.gearStats(sword), { damage: 15, armor: 0 });
      assert.deepStrictEqual(items.gearStats(items.stack('sword', { quality: 100 })), { damage: 19, armor: 0 });
    });

    it('scales gear, bonuses, and price by item level', function () {
      const low = items.stack('sword', { quality: 50, suffix: 'bear' });
      const high = items.stack('sword', { level: 11, quality: 50, suffix: 'bear' });
      assert.strictEqual(high.level, 11);
      assert.strictEqual(items.stack('sword', { level: 0 }).level, 1);
      assert.strictEqual(items.itemLevel({ id: 'sword' }), 1);
      assert.ok(Math.abs(items.gearStats(high).damage - 2 * items.gearStats(low).damage) <= 1);
      assert.strictEqual(items.attributeBonus(high).strength, 2 * items.attributeBonus(low).strength);
      assert.ok(Math.abs(items.price(high) - 2 * items.price(low)) <= 1);
      assert.ok(items.gearScore(high) > items.gearScore(low));
      assert.ok(loot.rollLoot('hoard', 'lvl', { level: 30 }).filter((s) => s.durability).every((s) => s.level === 30));
    });

    it('weakens worn gear', function () {
      const sword = Object.assign(items.stack('sword', { quality: 100 }), { durability: 10 });
      assert.strictEqual(items.gearStats(sword).damage, 14);
    });

    it('prices gear by quality and sells for half', function () {
      assert.strictEqual(items.price(items.stack('sword', { quality: 100 })), 400);
      assert.strictEqual(items.sellPrice(items.stack('sword', { quality: 50 })), 100);
      assert.strictEqual(items.price(items.stack('wool', { count: 3 })), 24);
    });

    it('sums equipped armor', function () {
      const armor = items.equipmentArmor({
        body: items.stack('iron-armor', { quality: 100 }),
        'main-hand': items.stack('sword', { quality: 100 })
      });
      assert.strictEqual(armor, 17);
    });
  });

  describe('affixes', function () {
    it('names, scales, and prices gear with a prefix and a suffix', function () {
      const sword = items.stack('sword', { quality: 100, prefix: 'vicious', suffix: 'slaying' });
      assert.strictEqual(items.displayName(sword), 'Vicious Sword of Slaying');
      assert.strictEqual(items.rarity(sword), 'legendary');
      assert.strictEqual(items.gearStats(sword).damage, 32);
      assert.strictEqual(items.price(sword), 1600);
      assert.strictEqual(items.displayName(items.stack('club', { material: 'iron', prefix: 'keen' })), 'Keen Iron Club');
    });

    it('drops affixes that do not fit the item', function () {
      const sword = items.stack('sword', { prefix: 'sturdy', suffix: 'nope' });
      assert.strictEqual(sword.prefix, undefined);
      assert.strictEqual(sword.suffix, undefined);
      assert.strictEqual(items.rarity(sword), 'common');
      assert.strictEqual(items.rarity(items.stack('leather-helmet', { suffix: 'warding' })), 'rare');
    });

    it('grants attribute bonuses and counts them when comparing gear', function () {
      const ring = items.stack('copper-ring', { quality: 50, prefix: 'mighty', suffix: 'bear' });
      assert.deepStrictEqual(items.attributeBonus(ring), { strength: 5 });
      assert.ok(items.gearScore(ring) > items.gearScore(items.stack('copper-ring', { quality: 50 })));
      assert.deepStrictEqual(items.equipmentAttributes({ ring, necklace: items.stack('bone-necklace', { suffix: 'fox' }) }), { strength: 5, dexterity: 3 });
    });

    it('stretches durability', function () {
      const plain = items.stack('sword', { quality: 50 });
      assert.strictEqual(items.stack('sword', { quality: 50, suffix: 'ages' }).durabilityMax, plain.durabilityMax * 2);
    });

    it('rolls one affix rarely and both very rarely', function () {
      const rng = random.seeded('affixes');
      const counts = { common: 0, rare: 0, legendary: 0 };
      const trials = 40000;
      for (let i = 0; i < trials; i++) counts[items.rarity(items.roll('sword', rng))] += 1;
      assert.ok(counts.rare / trials > 0.08 && counts.rare / trials < 0.15, `rare ${counts.rare}`);
      assert.ok(counts.legendary / trials > 0.001 && counts.legendary / trials < 0.008, `legendary ${counts.legendary}`);
      assert.deepStrictEqual(items.roll('sword', 'seed'), items.roll('sword', 'seed'));
      assert.strictEqual(items.rarity(items.roll('sword', 'x', { affixChance: 1 })), 'legendary');
      assert.strictEqual(items.rarity(items.roll('sword', 'x', { affixChance: 0 })), 'common');
      assert.deepStrictEqual(items.roll('wool', 'x', { count: 2 }), { id: 'wool', count: 2 });
    });

    it('picks the article from the item name', function () {
      assert.strictEqual(items.article(items.stack('sword', { prefix: 'keen' })), 'a');
      assert.strictEqual(items.article(items.stack('club', { material: 'iron' })), 'an');
      assert.strictEqual(items.article(items.stack('leather-gauntlets', { suffix: 'fox' })), '');
      assert.strictEqual(items.article(items.stack('wool', { count: 3 })), '');
    });
  });

  describe('loot', function () {
    it('only references known items', function () {
      for (const [id, entries] of Object.entries(loot.TABLES)) {
        for (const entry of entries) {
          assert.ok(items.get(entry.item), `${id} drops unknown item ${entry.item}`);
        }
      }
    });

    it('every creature uses a known loot table and drops', function () {
      for (const creature of creatures.list()) {
        if (creature.loot) assert.ok(loot.table(creature.loot), `${creature.id} loot ${creature.loot}`);
        for (const drop of creature.drops || []) assert.ok(items.get(drop.item), `${creature.id} drop ${drop.item}`);
      }
    });

    it('rolls the same loot for the same seed', function () {
      const a = loot.rollLoot('guard', random.seeded('loot'));
      const b = loot.rollLoot('guard', random.seeded('loot'));
      assert.deepStrictEqual(a, b);
    });

    it('merges stackable items', function () {
      assert.deepStrictEqual(loot.combine([{ id: 'wool', count: 1 }, { id: 'wool', count: 2 }]), [{ id: 'wool', count: 3 }]);
    });
  });

  describe('bodies and equipment', function () {
    it('gives humanoids a full kit and beasts only what fits them', function () {
      assert.deepStrictEqual(bodies.slots('humanoid'), ['body', 'leggings', 'helmet', 'gauntlets', 'ring', 'necklace', 'main-hand']);
      assert.deepStrictEqual(bodies.slots(), bodies.slots('humanoid'));
      assert.deepStrictEqual(bodies.slots('quadruped'), ['collar', 'barding']);
      for (const id of ['avian', 'serpentine', 'arachnid', 'insect', 'amorphous', 'draconic']) assert.deepStrictEqual(bodies.slots(id), [], id);
      assert.deepStrictEqual(bodies.slots('nope'), []);
      assert.deepStrictEqual(items.SLOTS, bodies.SLOTS);
    });

    it('has a body plan for every slot an item takes', function () {
      for (const def of items.list((item) => !!item.slot)) {
        assert.ok(bodies.list((body) => body.slots.includes(def.slot)).length, `${def.id} slot ${def.slot}`);
      }
    });

    it('gives every creature a known body plan and a table that fits it', function () {
      for (const creature of creatures.list()) {
        assert.ok(bodies.get(creature.body), `${creature.id} body ${creature.body}`);
        if (!creature.equipment) continue;
        const kit = equipment.table(creature.equipment);
        assert.ok(kit, `${creature.id} equipment ${creature.equipment}`);
        for (const [slot, entry] of Object.entries(kit)) {
          assert.ok(bodies.has(creature.body, slot), `${creature.id} (${creature.body}) has no ${slot}`);
          for (const option of entry.items) {
            assert.strictEqual(items.get(option.item).slot, slot, `${creature.id} ${slot} ${option.item}`);
          }
        }
      }
    });

    it('only references known items and materials in equipment tables', function () {
      for (const [id, kit] of Object.entries(equipment.TABLES)) {
        for (const [slot, entry] of Object.entries(kit)) {
          assert.ok(bodies.SLOTS.includes(slot), `${id} slot ${slot}`);
          for (const option of entry.items) {
            assert.ok(items.isGear(items.get(option.item)), `${id} ${option.item}`);
            if (option.material) assert.ok(items.MATERIALS[option.material], `${id} material ${option.material}`);
          }
        }
      }
    });

    it('spawns creatures wearing only what their body plan allows', function () {
      for (const creature of creatures.list()) {
        for (const seed of ['a', 'b', 'c']) {
          const spawned = creatures.spawn(creature.id, { level: 7, random: seed });
          assert.strictEqual(spawned.body, creature.body);
          for (const [slot, stack] of Object.entries(spawned.equipment)) {
            assert.ok(bodies.has(creature.body, slot), `${creature.id} wears ${slot}`);
            assert.strictEqual(items.get(stack.id).slot, slot);
            assert.strictEqual(stack.level, 7);
          }
        }
      }
      assert.ok(creatures.spawn('war-hound', { level: 3, random: 'w' }).equipment.collar);
      assert.deepStrictEqual(creatures.spawn('wolf', { level: 3, random: 'w' }).equipment, {});
      assert.deepStrictEqual(creatures.spawn('spider', { level: 3, random: 'w' }).equipment, {});
    });

    it('rolls slot chances and weighted picks', function () {
      const rng = random.seeded('kit');
      const counts = { barding: 0, iron: 0, collar: 0 };
      const runs = 2000;
      for (let i = 0; i < runs; i++) {
        const kit = equipment.rollEquipment('war-hound', rng, { body: 'quadruped' });
        if (kit.collar) counts.collar += 1;
        if (kit.barding) counts.barding += 1;
        if (kit.barding && kit.barding.id === 'iron-barding') counts.iron += 1;
      }
      assert.strictEqual(counts.collar, runs);
      assert.ok(Math.abs(counts.barding / runs - 0.5) < 0.05);
      assert.ok(Math.abs(counts.iron / counts.barding - 0.2) < 0.05);
      assert.deepStrictEqual(equipment.rollEquipment('war-hound', 'x', { body: 'humanoid' }), {});
      assert.deepStrictEqual(equipment.rollEquipment('bandit', 'x', { body: 'avian' }), {});
    });

    it('accepts a fixed kit and applies table material and quality', function () {
      const kit = equipment.rollEquipment(['leather-armor', 'club', 'wool'], 'fixed', { level: 4 });
      assert.deepStrictEqual(Object.keys(kit).sort(), ['body', 'main-hand']);
      assert.strictEqual(kit.body.level, 4);
      const stone = equipment.rollEquipment({ 'main-hand': { items: [{ item: 'club', material: 'stone', qmin: 90, qmax: 90 }] } }, 'stone');
      assert.strictEqual(stone['main-hand'].material, 'stone');
      assert.strictEqual(stone['main-hand'].quality, 90);
    });

    it('decides who can wear what', function () {
      assert.strictEqual(items.canEquip('sword'), true);
      assert.strictEqual(items.canEquip('sword', 'quadruped'), false);
      assert.strictEqual(items.canEquip(items.stack('spiked-collar'), 'quadruped'), true);
      assert.strictEqual(items.canEquip('spiked-collar', 'humanoid'), false);
      assert.strictEqual(items.canEquip('wool'), false);
      assert.strictEqual(items.canEquip('sword', 'avian'), false);
    });

    it('fights only with gear the body can wear', function () {
      const sword = items.stack('sword', { quality: 100 });
      const collar = items.stack('spiked-collar', { quality: 100 });
      const misplaced = { 'main-hand': sword, collar, ring: items.stack('club') };
      assert.deepStrictEqual(items.wearable(misplaced), { 'main-hand': sword });
      assert.deepStrictEqual(items.wearable(misplaced, 'quadruped'), { collar });
      const wolf = { level: 1, attributes: { strength: 10 }, body: 'quadruped', equipment: misplaced };
      const fighter = Battle.fighter(wolf);
      assert.strictEqual(fighter.damage, attributes.unarmedDamage(attributes.normalize(wolf.attributes)));
      assert.strictEqual(fighter.armor, attributes.armor(attributes.normalize(wolf.attributes)) + items.gearStats(collar).armor);
    });

    it('finds gear the actor can wear', function () {
      const weights = { monster: 0, item: 1, cache: 0, blessing: 0 };
      for (let i = 0; i < 200; i++) {
        const found = new Encounter({ actor: { name: 'Ann', level: 5 }, weights, random: `find:${i}` }).outcome.item;
        assert.ok(items.canEquip(found, 'humanoid'), found.id);
        const fetched = new Encounter({ actor: { name: 'Rex', level: 5, body: 'quadruped' }, weights, random: `find:${i}` }).outcome.item;
        assert.ok(items.canEquip(fetched, 'quadruped'), fetched.id);
      }
    });
  });

  describe('experience and currency', function () {
    it('defaults to a power curve of base 100 and exponent 1.5', function () {
      assert.strictEqual(experience.levelFor(0), 1);
      assert.strictEqual(experience.levelFor(99), 1);
      assert.strictEqual(experience.levelFor(100), 2);
      assert.strictEqual(experience.levelFor(283), 3);
      assert.strictEqual(experience.experienceFor(3), 283);
      assert.strictEqual(experience.levelFor(250, 'linear'), 3);
    });

    it('takes a host base and exponent for the power curve', function () {
      const steep = { exponent: 1.65 };
      assert.strictEqual(experience.experienceFor(3, 'power', steep), 314);
      assert.strictEqual(experience.levelFor(313, 'power', steep), 2);
      assert.strictEqual(experience.levelFor(314, 'power', steep), 3);
      assert.strictEqual(experience.experienceFor(2, 'power', { base: 50 }), 50);
      assert.strictEqual(experience.experienceFor(3), 283);
    });

    it('finds the level without walking every level', function () {
      for (const level of [2, 17, 400, 12345]) {
        const xp = experience.experienceFor(level);
        assert.strictEqual(experience.levelFor(xp), level);
        assert.strictEqual(experience.levelFor(xp - 1), level - 1);
      }
    });

    it('pays kill experience that grows more slowly than a level costs', function () {
      assert.strictEqual(experience.killExperience(1), 30);
      assert.strictEqual(experience.killExperience(10), 75);
      const share = (level) => experience.killExperience(level) / (experience.experienceFor(level + 1) - experience.experienceFor(level));
      assert.ok(share(1000) < share(100) && share(100) < share(10));
    });

    it('formats copper as coins', function () {
      assert.strictEqual(currency.format(32540), '3g 25s 40c');
      assert.strictEqual(currency.format(0), '0c');
      assert.strictEqual(currency.toCopper({ gold: 1, silver: 2, copper: 3 }), 10203);
    });
  });

  describe('world', function () {
    it('spawns creatures grown to a level', function () {
      const low = creatures.spawn('bandit', { level: 1, random: 'a' });
      const high = creatures.spawn('bandit', { level: 10, random: 'a' });
      assert.ok(high.attributes.strength > low.attributes.strength);
      assert.ok(low.equipment['main-hand'].quality >= 35 && low.equipment['main-hand'].quality <= 85);
      assert.deepStrictEqual(creatures.spawn('stray', { level: 4, random: 'z' }), creatures.spawn('stray', { level: 4, random: 'z' }));
      assert.strictEqual(creatures.spawn('nope'), null);
      assert.strictEqual(high.equipment['main-hand'].level, 10);
    });

    it('sharpens natural weapons with level, slowly at first', function () {
      const base = attributes.normalize({ strength: 10 });
      assert.strictEqual(creatures.naturalDamage(base, 1), attributes.unarmedDamage(base));
      const perLevel = (level) => (creatures.naturalDamage(base, level) - attributes.unarmedDamage(base)) / (level - 1);
      assert.ok(perLevel(10) < 0.5);
      assert.ok(perLevel(100) > 1 && perLevel(100) < 2);
      assert.ok(perLevel(10000) > 2.7 && perLevel(10000) <= creatures.NATURAL_DAMAGE_PER_LEVEL);
      const bear = creatures.spawn('bear', { level: 50, random: 'b' });
      assert.strictEqual(bear.naturalDamage, creatures.naturalDamage(bear.attributes, 50));
    });

    it('every biome spawns known creatures', function () {
      for (const biome of biomes.list()) {
        for (const id of Object.keys(biome.spawns)) assert.ok(creatures.get(id), `${biome.id} spawns ${id}`);
      }
    });

    it('can meet every creature somewhere', function () {
      const spawned = new Set(biomes.list().flatMap((biome) => Object.keys(biome.spawns)));
      for (const creature of creatures.list()) {
        assert.ok(spawned.has(creature.id) || creature.anywhere > 0 || creature.lair, `${creature.id} is never met`);
      }
    });

    it('makes every item of a known material', function () {
      for (const item of items.list()) assert.ok(items.MATERIALS[item.material], `${item.id} material ${item.material}`);
    });

    it('classifies a climate', function () {
      assert.strictEqual(biomes.classify({ temperature: 0.1, moisture: 0.3, elevation: 0.3 }).primary, 'tundra');
      assert.strictEqual(biomes.classify({ temperature: 0.9, moisture: 0.1, elevation: 0.3 }).primary, 'desert');
    });

    it('names a place the same way every time', function () {
      const place = places.placeFor('general');
      assert.deepStrictEqual(place, places.placeFor('general'));
      assert.ok(biomes.get(place.biome));
      assert.strictEqual(places.placeFor('general', { biome: 'alpine' }).biome, 'alpine');
    });
  });

  describe('content packs', function () {
    const actor = { name: 'Ann', level: 20, attributes: { strength: 30, dexterity: 30, constitution: 30 } };
    const pack = {
      bodies: { serpent: { name: 'Serpent', slots: ['tail'] } },
      materials: { moonstone: { name: 'Moonstone', damage: 1.2, armor: 1.2, durability: 1.2 } },
      items: {
        'tail-blade': { name: 'Tail Blade', slot: 'tail', kind: 'weapon', material: 'moonstone', damage: 9, armor: 0, durability: 80, weight: 1, stackable: false, price: 90 },
        'moon-dust': { name: 'Moon Dust', slot: null, weight: 0.1, stackable: true, kind: 'material', material: 'moonstone', damage: 0, armor: 0, durability: 0, price: 4 }
      },
      loot: { lunar: [{ item: 'moon-dust', chance: 100, min: 1, max: 2 }] },
      equipment: { 'moon-serpent': { tail: { chance: 100, items: [{ item: 'tail-blade' }] } } },
      creatures: {
        'moon-serpent': { name: 'Moon Serpent', body: 'serpent', hostile: true, attributes: { strength: 6, dexterity: 6, constitution: 6 }, loot: 'lunar', equipment: 'moon-serpent' }
      },
      biomes: { lunar: { name: 'Lunar Mare', climate: { temperature: 0.1, moisture: 0, elevation: 0.9 }, spawns: { 'moon-serpent': 1 } } },
      affixes: { prefixes: { lunar: { name: 'Lunar', kinds: ['weapon'], weight: 4, damage: 1.2, price: 1.5 } } },
      names: { deities: ['Selene'] }
    };
    const undo = {
      bodies: { serpent: null },
      materials: { moonstone: null },
      items: { 'tail-blade': null, 'moon-dust': null },
      loot: { lunar: null },
      equipment: { 'moon-serpent': null },
      creatures: { 'moon-serpent': null },
      biomes: { lunar: null },
      affixes: { prefixes: { lunar: null } },
      names: { deities: places.NAMES.deities }
    };

    afterEach(function () {
      content.define(undo);
    });

    it('finds no problems in the built-in catalog', function () {
      assert.deepStrictEqual(content.problems(), []);
    });

    it('adds a game\'s own creatures, items, slots, and places', function () {
      assert.deepStrictEqual(content.define(pack), []);
      assert.ok(bodies.SLOTS.includes('tail') && items.SLOTS.includes('tail'));
      assert.ok(biomes.IDS.includes('lunar'));
      assert.strictEqual(biomes.classify({ temperature: 0.1, moisture: 0, elevation: 0.9 }).primary, 'lunar');
      const serpent = creatures.spawn('moon-serpent', { level: 3, random: 's' });
      assert.strictEqual(serpent.equipment.tail.id, 'tail-blade');
      const outcome = new Encounter({ actor, biome: 'lunar', weights: { monster: 1 }, rareChance: 0, random: 'moon' }).outcome;
      assert.strictEqual(outcome.creature.id, 'moon-serpent');
      assert.strictEqual(outcome.biome, 'lunar');
      const blessing = new Encounter({ actor, weights: { blessing: 1 }, random: 'pray' }).outcome;
      assert.strictEqual(blessing.deity, 'Selene');
    });

    it('removes content with null and restores the catalog', function () {
      content.define(pack);
      content.define(undo);
      assert.ok(!bodies.SLOTS.includes('tail'));
      assert.ok(!biomes.IDS.includes('lunar'));
      assert.strictEqual(creatures.get('moon-serpent'), null);
      assert.deepStrictEqual(content.problems(), []);
    });

    it('reports broken references', function () {
      const found = content.define({
        creatures: { 'moon-serpent': { name: 'Moon Serpent', body: 'cloud', loot: 'nowhere', drops: [{ item: 'nothing', chance: 100 }] } },
        biomes: { lunar: { name: 'Lunar Mare', climate: { temperature: 0, moisture: 0, elevation: 1 }, spawns: { ghost: 1 } } }
      });
      assert.ok(found.some((p) => p.includes('unknown body cloud')));
      assert.ok(found.some((p) => p.includes('unknown loot table nowhere')));
      assert.ok(found.some((p) => p.includes('unknown item nothing')));
      assert.ok(found.some((p) => p.includes('unknown creature ghost')));
    });
  });

  describe('encounter options', function () {
    const actor = { name: 'Ann', level: 10, attributes: { strength: 40, dexterity: 40, constitution: 40 } };

    it('never rolls a type left out of the weights', function () {
      for (let i = 0; i < 100; i++) {
        assert.strictEqual(new Encounter({ actor, weights: { monster: 1 }, random: `w:${i}` }).type, 'monster');
        assert.strictEqual(new Encounter({ actor, weights: { cache: 1, item: 1 }, random: `w:${i}` }).type !== 'monster', true);
      }
    });

    it('meets creatures from its own spawn table', function () {
      for (let i = 0; i < 50; i++) {
        const outcome = new Encounter({ actor, weights: { monster: 1 }, spawns: { rat: 1, wolf: 1 }, rareChance: 0, random: `s:${i}` }).outcome;
        assert.ok(['rat', 'wolf'].includes(outcome.creature.id), outcome.creature.id);
      }
    });

    it('meets a gated creature when nothing else in the table is reachable', function () {
      const outcome = new Encounter({ actor: Object.assign({}, actor, { level: 1 }), weights: { monster: 1 }, spawns: { ogre: 1 }, rareChance: 0, random: 'g' }).outcome;
      assert.strictEqual(outcome.creature.id, 'ogre');
      assert.throws(() => new Encounter({ actor, weights: { monster: 1 }, spawns: { nothing: 1 }, rareChance: 0 }), /no creatures/);
    });

    it('pays experience from the host\'s own formula', function () {
      const flat = { actor, weights: { blessing: 1 }, killExperience: () => 7, random: 'b' };
      assert.strictEqual(new Encounter(flat).outcome.experience, 7);
      assert.strictEqual(new Encounter(Object.assign({}, flat, { experienceRate: 3 })).outcome.experience, 21);
    });

    it('passes battle settings through', function () {
      const outcome = new Encounter({ actor, weights: { monster: 1 }, battle: { maxRounds: 1 }, random: 'r' }).outcome;
      assert.strictEqual(outcome.rounds, 1);
    });
  });
});
