'use strict';

const Events = require('events');
const Fabric = require('@fabric/core');

/**
 * Generic example.
 * @type {Object}
 */
class Entity extends Events.EventEmitter {
  /**
   * Generic template for virtual objects.
   * @param  {Object} [data={}] Pass an object to use.
   * @return {Entity}           Instance of the {@link Entity}.
   */
  constructor (data = {}) {
    super(data);

    // allow this entity to be run without the new keyword
    if (!(this instanceof Entity)) return new Entity(data);

    // set internal properties
    this.machine = new Fabric.Machine();

    // configure defaults
    this.data = Object.assign({

    }, data);

    // return instance
    return this;
  }

  /**
   * Produces a string of JSON, representing the entity.
   * @return {String} JSON-encoded object.
   */
  toJSON () {
    return JSON.stringify(this.toObject());
  }

  /**
   * Converts the Fabric-native instance to a pure JSON object.
   * @return {Object} Basic JavaScript object.
   */
  toObject () {
    return this.data;
  }

  /**
   * As a {@link Buffer}.
   * @return {Buffer} Slice of memory.
   */
  toRaw () {
    return Buffer.from(this.toJSON(), 'utf8');
  }
}

module.exports = Entity;
