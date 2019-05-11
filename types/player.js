'use strict';

const Fabric = require('@fabric/core');

class Player {
  /**
   * In-game representation of our humble hero, the {@link User}.
   * @param  {Object} [settings={}] Settings to pass from the player's will.
   * @return {Player}               Player-controllable instance of themselves.
   */
  constructor (settings = {}) {
    this.settings = Object.assign({}, settings);
    this.position = null;
    this.key = new Fabric.Key();
    this.id = this.key.address;
    return this;
  }

  _isOther () {
    return this.other;
  }

  render () {
    return `<rpg-player><player-address>${this.key.address}</player-address></rpg-player>`;
  }
}

module.exports = Player;
