'use strict';

const RPG = require('../types/rpg');

async function main () {
  const game = new RPG({
    name: '@fabric/rpg',
    networking: false,
    persistent: false
  });

  game.on('log', (log) => {
    console.log('[FABRIC:GAME]', log);
  });

  game.on('tick', (tick) => {
    console.log('[FABRIC:GAME] tick', tick);
  });

  await game.start();
  game.beat();

  return {
    contract: game.contract.id,
    clock: game.clock
  };
}

if (require.main === module) {
  main().catch((exception) => {
    console.error('[FABRIC:GAME]', exception);
    process.exitCode = 1;
  }).then((output) => {
    if (output) console.log('[FABRIC:GAME]', output);
  });
}

module.exports = main;
