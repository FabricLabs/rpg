# `@fabric/rpg`

Fabric game service for the 0.1.0 playnet. Local state stays on this process. When networking is enabled, the service publishes signed `CONTRACT_PUBLISH` and `CONTRACT_MESSAGE` frames through `@fabric/core` and can listen as a peer.

Other game nodes can use the same frames. A `WorldState` payload on this contract is stored beside players and places.

## Quick start

```
npm install
npm test
npm start
```

`npm start` stays local. Join the playnet with:

```
FABRIC_NETWORK=1 npm start
```

`FABRIC_LISTEN=1` also accepts inbound peers on port 7777. `FABRIC_PEER` overrides the default hub (`hub.fabric.pub:7777`).

An HTTP content gateway is optional and off unless `GATEWAY_HOST` is set. It is not the Fabric network.

## Contract

Resource discovery matches the Fabric Application Resource Contract (`OPTIONS /` on `@fabric/http`): players, places, and peers, plus any extra resources passed in settings. State updates are counts and a clock, small enough for one 0.1.0 frame.

## Universe

The rules and content live here, so any game (an idle game, a Discord bot, a roguelike, a web game) can build on the same world. They are plain functions and classes: none of them need the `RPG` service, a Store, or the network, so `require` what you use.

- `inputs/` — creatures, body plans, items, item affixes, materials, loot and equipment tables, biomes, and place and deity names as JSON.
- `functions/` — pure rules: `random` (seeded), `attributes` (health, damage, armor, luck), `items` (gear quality, durability, prices in copper, who can wear what), `affixes`, `loot`, `bodies` (equipment slots per body plan), `equipment` (what a creature wears), `experience`, `currency`, `creatures` (spawn at a level), `biomes`, `places` (a stable name and biome for any key).
- `functions/content` — add, replace, or remove catalog entries at runtime (see [Your own game](#your-own-game)).
- `types/clock` — `WorldClock`, a world tick (10 minutes unless you pass `interval`). `RPG#beat` runs on it; pass `autotick: false` to drive it yourself.
- `types/battle` and `types/encounter` — seeded, automatic fights and random encounters. They read actors and return outcomes; the host applies them. Monsters are leveled evenly across the actor's level ± `levelRange` (default 2) or ± `levelSpread` of it (default 10%), whichever is wider; a lair's beast is centered three levels higher.

```js
const Encounter = require('@fabric/rpg/types/encounter');
const { placeFor } = require('@fabric/rpg/functions/places');

const outcome = new Encounter({
  actor: { name: 'Ann', level: 5 },
  place: placeFor('general'),
  random: 'any seed'
}).outcome;
```

Battles derive health, damage, and armor (dexterity plus equipped gear) from attributes. The faster side strikes first, hits vary by ±15%, and luck sets the chance of a critical.

The catalog holds 72 creatures: wild animals, folk of the wilds (goblins, kobolds, orcs, gnolls, lizardfolk, ogres), the undead and spirits (skeletons, ghouls, wraiths, will-o'-wisps), elementals, beasts of legend (griffins, basilisks, manticores, owlbears, wyverns, unicorns), walking plants, and six unique lair beasts. Each biome weights its own spawns; a few roam anywhere (`anywhere`); lair beasts guard lairs. A creature with a `minLevel` is met only once the actor reaches that level (`creatures.appears`), so ogres, yetis, and wyverns wait until adventurers have some gear.

Every creature has a body plan, and the body plan decides its equipment slots. Humanoids (players by default, bandits, orcs, goblins, skeletons, golems, trolls) wear body armor, leggings, a helmet, gauntlets, a ring, and a necklace, and wield a main-hand weapon. Quadrupeds take only a collar and barding. Avian, serpentine, arachnid, insect, amorphous, draconic, and plant bodies carry nothing and fight with natural weapons. A creature's equipment table (`inputs/equipment.json`) gives each of its slots a chance to be filled and weighted picks, so a bandit usually has a dagger and leather armor, sometimes a helmet, and rarely a ring. A war hound always wears a spiked collar and wears barding half the time. Battles count only gear in slots the fighter's body has, and finds are gear the actor can wear. Pass `body` on an actor to change it.

Progression has no ceiling. Attributes are uncapped, and everything that must keep pace with level grows with `attributes.levelScale(level)` (`1 + 0.1 * (level - 1)`): gear carries an item level (the creature's level for drops, about the actor's for finds) that scales its damage, armor, affix bonuses, and price; armor stops `raw * K / (K + armor)` with `K` scaled to the attacker's level; and creatures fight with natural weapons that sharpen with level (`creatures.naturalDamage`), so fights stay short at any level. A kill is worth `30 * level^0.4` experience, which grows more slowly than the cost of a level, so each level takes a little longer than the last.

Gear from loot, finds, and creatures' own equipment rolls a prefix and a suffix independently (6% each by default; a loot entry may set `affixChance`). One affix makes a piece **rare** ("Keen Sword"), both make it **legendary** ("Keen Sword of the Bear"). Affixes scale damage, armor, durability, and price, or grant attribute bonuses that count in battle while equipped. `items.roll(id, random)` makes a piece with rolled affixes; `items.rarity(item)` reads it back.

## Your own game

The pacing belongs to your game, not to these rules. Nothing here grants experience over time, decides how often an encounter happens, or stores players: the host does. An idle game might pay experience every tick and roll an encounter now and then; a roguelike might roll one per room and never pay for time at all.

Every rule takes its knobs as options, with defaults:

| Option | Where | Default |
|--------|-------|---------|
| `weights` | `Encounter` | `{ monster: 6, item: 2, cache: 1, blessing: 1 }`; leave a type out and it never happens (`{ monster: 1 }` only fights) |
| `spawns` | `Encounter` | the biome's spawn table; pass `{ creatureId: weight }` for a dungeon floor, arena, or quest |
| `rareChance`, `lairChance` | `Encounter` | 0.08, 0.15 |
| `levelRange`, `levelSpread`, `levelOffset`, `levelOffsetMax` | `Encounter` | 2, 0.1, 0, none |
| `killExperience` | `Encounter` | `experience.killExperience` (`30 * level^0.4`) |
| `experienceRate` | `Encounter` | 1 |
| `cacheMax` | `Encounter` | 50 copper |
| `battle` | `Encounter` | settings passed to `Battle`, e.g. `{ maxRounds: 20 }` |
| `maxRounds` | `Battle` | 50 |
| curve, `{ base, exponent }` | `experience.levelFor`, `experienceFor` | `power`, 100, 1.5 (or `linear`) |
| `interval`, `autotick` | `WorldClock`, `RPG` | 600000 ms, on |

Bring your own content with `content.define`. Each entry adds or replaces one definition by id, and `null` removes it, so a game can extend the built-in world or replace it outright. It returns the broken references it finds (unknown bodies, items, materials, loot or equipment tables, spawns); `content.problems()` checks at any time.

```js
const content = require('@fabric/rpg/functions/content');

const problems = content.define({
  materials: { moonstone: { name: 'Moonstone', damage: 1.2, armor: 1.2, durability: 1.2 } },
  items: {
    'moon-dust': { name: 'Moon Dust', slot: null, weight: 0.1, stackable: true, kind: 'material', material: 'moonstone', damage: 0, armor: 0, durability: 0, price: 4 }
  },
  loot: { lunar: [{ item: 'moon-dust', chance: 100, min: 1, max: 2 }] },
  creatures: {
    'moon-crab': { name: 'Moon Crab', body: 'arachnid', hostile: true, attributes: { strength: 8, dexterity: 4, constitution: 14 }, loot: 'lunar' }
  },
  biomes: {
    lunar: { name: 'Lunar Mare', climate: { temperature: 0.1, moisture: 0, elevation: 0.9 }, spawns: { 'moon-crab': 1 } }
  },
  names: { deities: ['Selene'] }
});
if (problems.length) throw new Error(problems.join('\n'));
```

A pack may also carry `bodies` (new slots join `bodies.SLOTS`), `equipment` tables, and `affixes` (`{ prefixes, suffixes }`). Catalogs are shared by every rule in the process, so define content once at startup.
