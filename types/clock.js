'use strict';

const EventEmitter = require('events');
const { TICK_INTERVAL } = require('../constants');

/**
 * A world tick: one epoch every `interval` ms (default 600000, so hosts
 * that keep the default stay in step). `RPG#beat` runs on it. `clock`
 * counts ticks this world has seen and is restored by the host; `epoch` is
 * the wall-clock period index. What a tick does is up to the host.
 *
 * Emits `tick` with `{ clock, epoch, now }`.
 */
class WorldClock extends EventEmitter {
  /**
   * @param {Object} [settings]
   * @param {Number} [settings.interval] Milliseconds per tick (default 600000).
   * @param {Number} [settings.clock] Ticks already elapsed.
   * @param {Function} [settings.now] Clock source, for tests.
   */
  constructor (settings = {}) {
    super();
    this.interval = Number(settings.interval == null ? TICK_INTERVAL : settings.interval);
    this.clock = Math.max(0, Math.floor(Number(settings.clock) || 0));
    this.now = typeof settings.now === 'function' ? settings.now : () => Date.now();
    this._timer = null;
  }

  get epoch () {
    return this.interval > 0 ? Math.floor(this.now() / this.interval) : 0;
  }

  get running () {
    return !!this._timer;
  }

  /**
   * Advance one tick immediately.
   * @returns {{ clock: Number, epoch: Number, now: Number }}
   */
  advance () {
    this.clock += 1;
    const tick = { clock: this.clock, epoch: this.epoch, now: this.now() };
    this.emit('tick', tick);
    return tick;
  }

  /**
   * Tick every `interval` ms. The timer never holds the process open.
   * @returns {WorldClock}
   */
  start () {
    if (this._timer || !(this.interval > 0)) return this;
    this._timer = setInterval(() => this.advance(), this.interval);
    if (this._timer && typeof this._timer.unref === 'function') this._timer.unref();
    return this;
  }

  stop () {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    return this;
  }
}

module.exports = WorldClock;
