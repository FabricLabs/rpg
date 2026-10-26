'use strict';

const Remote = require('@fabric/core/types/remote');

// internal types
const Agent = require('../types/agent');

async function main () {
  const host = process.env.GATEWAY_HOST;
  if (!host) {
    console.log('[RPG:AGENTS] Set GATEWAY_HOST to sync agents from an HTTP gateway. The playnet node is `npm start`.');
    return;
  }

  let api = new Remote({ host });
  let mobs = await api._GET('/mobs') || [];
  let shuttles = await api._GET('/shuttles');
  let agents = [];

  // Mobs (NPCs)
  mobs.map(function (mob) {
    return new Agent(Object.assign({
      type: 'Mob'
    }, mob));
  }).forEach((agent) => agents.push(agent));

  // Shuttles (Automated Vehicles)
  shuttles.map(function (shuttle) {
    return new Agent(Object.assign({
      type: 'Shuttle'
    }, shuttle));
  }).forEach((agent) => agents.push(agent));

  // let server = new Server();
  // server.define('Agent', Agent);
  // await server.start();

  console.log(`[RPG:AGENTS]`, `Controlling actions for ${agents.length} agents.`);

  for (let i = 0; i < agents.length; i++) {
    agents[i].start();
  }

  console.log(`${agents.length} agents now running.`);
}

main();
