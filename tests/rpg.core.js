'use strict';

const assert = require('assert');
const RPG = require('../lib/rpg');

describe('@fabric/rpg', function () {
  describe('RPG', function () {
    it('should expose a constructor', function () {
      assert.equal(RPG instanceof Function, true);
    });
  });
});
