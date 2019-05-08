'use strict';

// Fabric Core & HTTP (for the Legacy Web)
const Fabric = require('@fabric/core');
const HTTP = require('@fabric/http');

// internal types
const Agent = require('./types/agent');

async function main () {
  let api = new Fabric.Remote({ host: 'api.roleplaygateway.com' });
  let mobs = await api._GET('/mobs');
  let server = new HTTP();
  let agents = mobs.map(function (mob) {
    let agent = new Agent(mob);
    return agent;
  });

  if (this.status && this.status === 'ready') {
    await server.start();
  }

  console.log(`[RPG:AGENTS]`, `Controlling actions for ${agents.length} agents.`);

  for (let i = 0; i < agents.length; i++) {
    agents[i].start();
  }

  console.log(`${agents.length} agents now running.`);
}

main();
