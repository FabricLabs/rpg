'use strict';

const {
  HTTP_HOST,
  TICK_INTERVAL
} = require('../constants');

const Fabric = require('@fabric/core');

class Agent {
  constructor (settings = {}) {
    this.settings = Object.assign({}, settings);
    this.remote = new Fabric.Remote({ host: HTTP_HOST });
    this.current = null;
    this.heartbeat = null;
    this.ticks = 0;
  }

  async move (direction) {
    let agent = this;

    let result = await this.remote._POST(`/movements`, {
      direction: direction,
      mobID: agent.id
    });

    console.log('result of movement:', result);

    return result;
  }

  async compute () {
    ++this.ticks;
    console.log(`[AGENT:${this.id}]`, `beginning tick:`, this.ticks, 'mood:', this.current.mood);

    if (this.current.mood && this.current.mood === 'aggressive') {
      let place = await this.getCurrentLocation();

      if (place.active.length) {
        console.log('found character!', place.active[0]);
        // TODO: attack!
      } else {
        console.log('No nearby characters found.  Moving...');

        let exits = await this.getExits();
        let choice = this.randomFrom(exits);

        console.log('options:', exits);
        console.log('choice:', choice);

        let movement = await this.move(choice.direction);

        console.log('movement:', movement);
      }
    }
  }

  async start () {
    let agent = this;

    agent.id = this.settings.id;
    agent.current = await agent.getState();
    agent.heartbeat = setInterval(agent.compute.bind(agent), TICK_INTERVAL);

    return agent;
  }

  async getState () {
    let mob = await this.remote._GET(`/mobs/${this.id}`);
    return mob;
  }

  async getCurrentLocation () {
    let place = await this.remote._GET(`/places/${this.current.location}`);
    return place;
  }

  async getExits () {
    let place = await this.remote._GET(`/places/${this.current.location}`);
    return place.exits;
  }

  randomFrom (items) {
    return items[Math.floor(Math.random() * items.length)];
  }
}

module.exports = Agent;
