'use strict';

const assert = require('assert');
const config = {
  persistent: false
};

const RPG = require('../lib/rpg');

describe('@fabric/rpg', function () {
  describe('RPG', function () {
    it('should expose a constructor', function () {
      assert.equal(RPG instanceof Function, true);
    });

    it('can start and stop smoothly', async function () {
      let rpg = new RPG(config);

      await rpg.start();
      await rpg.stop();

      assert.ok(rpg);
      assert.equal(rpg['@type'], 'RPG');
    });

    it('can register a player', async function () {
      let sample = null;
      let local = Object.assign({
        name: 'Betaverse',
        path: './stores/test.rpg.verse.pub'
      }, config);
      let rpg = new RPG(local);

      await rpg.start();
      await rpg._POST(`/players`, { name: 'Yorick' });

      try {
        sample = await rpg._GET(`/players`);
      } catch (E) {
        console.error(E);
      }

      await rpg.stop();

      console.log('rpg:', rpg);
      console.log('rendered:', rpg.render());
      console.log('sample:', sample);

      assert.ok(rpg);
      assert.equal(rpg['@type'], 'RPG');
    });
  });
});
