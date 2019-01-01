'use strict';

const config = require('./config');

const RPG = require('./lib/rpg');
const Server = require('./lib/server');

async function main () {
  let server = new Server(config);
  let rpg = new RPG({
    path: './stores/rpg'
  });

  // For our main loop, we want to monitor the game world
  // and present some output to the user.  Here, we catch
  // events from the server (our trusted oracle) as well
  // as the local RPG instance.  Both will stay in sync!
  server.on('info', function (msg) {
    console.log('server info:', msg);
  });

  rpg.on('info', function (msg) {
    console.log('rpg info:', msg);
  });

  // Finally, launch our processes.  The server will manage
  // connections with the rest of the network, while any of
  // your clients will now be able to connect.
  await server.start();
  await rpg.start();

  // Let's register with the network.
  let player = await rpg._registerPlayer({
    name: process.env['PLAYER_HANDLE'] || 'admin'
  });

  console.log('rpg:', rpg);
  console.log('player:', player);
}

main();
