'use strict';

const config = require('./config');

const RPG = require('./types/rpg');
const Gateway = require('./services/rpg');
const Server = require('@fabric/http');

async function main () {
  let gateway = new Gateway();
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

  rpg.on('message', function (msg) {
    console.log('rpg message:', msg);
  });

  rpg.on('player', function (msg) {
    console.log('rpg player:', msg);
  });

  // Until Fabric has support for Resources, we'll manually add some routes.
  /* server.express.get('/objects/:id/signature', async function (req, res, next) {
    let entity = new Entity({ name: 'Moblin' });
    let const Signature = require('./types/signature');
    let signature = new Signature();
    let output = await signature._drawSignature();

    res.setHeader('Content-Type', 'image/png');
    res.send(output);
  }); */

  // Finally, launch our processes.  The server will manage
  // connections with the rest of the network, while any of
  // your clients will now be able to connect.
  await server.start();
  await rpg.start();

  // Let's register with the network.
  let player = await rpg._registerPlayer({
    name: process.env['PLAYER_HANDLE'] || 'ghost'
  });

  // start syncing with the Gateway...
  gateway._sync();

  // console.log('rpg:', rpg);
  console.log('player:', player);

  let after = await rpg._GET(player);
  console.log('after:', after);
  console.log('game state:', rpg.state);
  // console.log('server:', server);
}

main();
