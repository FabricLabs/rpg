'use strict';

const RPG = require('./lib/rpg');

async function main () {
  let rpg = new RPG({
    path: './stores/rpg'
  });

  await rpg.start();

  let player = await rpg._registerPlayer({
    name: 'admin'
  });

  console.log('rpg:', rpg);
  console.log('player:', player);

  // TODO: fix broken
  try {
    let instance = await rpg._GET(player);
  } catch (E) {
    console.error(E);
  }

  await rpg.stop();
}

main();
