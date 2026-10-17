'use strict';

const config = require('../settings/default');
const { FABRIC_HUB } = require('../constants');
const RPG = require('../types/rpg');

async function main () {
  const networking = process.env.FABRIC_NETWORK === '1';
  const rpg = new RPG(Object.assign({}, config, {
    name: '@fabric/rpg',
    networking,
    listen: networking && process.env.FABRIC_LISTEN === '1',
    peers: networking ? [process.env.FABRIC_PEER || FABRIC_HUB] : [],
    persistent: false
  }));

  rpg.on('log', (msg) => {
    console.log('[RPG]', msg);
  });

  rpg.on('tick', (id) => {
    console.log('[RPG] tick', id);
  });

  rpg.on('world', (state) => {
    console.log('[RPG] world', state);
  });

  await rpg.start();

  const player = await rpg.registerPlayer({
    name: process.env.PLAYER_HANDLE || 'ghost'
  });

  const arc = rpg.toApplicationResourceContract();
  console.log('[RPG] contract', rpg.contract.id);
  console.log('[RPG] player', player);
  console.log('[RPG] resources', Object.keys(arc.resources));
  console.log('[RPG] networking', networking ? 'playnet' : 'local');
}

main().catch((exception) => {
  console.error('[RPG]', exception);
  process.exitCode = 1;
});
