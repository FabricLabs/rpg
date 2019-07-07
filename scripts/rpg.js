'use strict';

const { TICK_INTERVAL } = require('../constants');
const config = require('../config');

// Core RPG lib
const Engine = require('../types/rpg');
const RPG = require('../components/rpg');

// Dependencies
const $ = require('jquery');
const Fabric = require('@fabric/core');
const Circuit = require('@fabric/core/types/circuit');
const Service = require('@fabric/core/types/service');

// Components
// const BrowserContent = require('@fabric/http/components/browser-content');
const FabricChannelList = require('@fabric/http/components/channel-list');
const FabricChannelView = require('@fabric/http/components/channel-view');
// const FabricPeerList = require('@fabric/http/components/peer-list');
const Prompt = require('@fabric/http/components/prompt');
const Modal = require('@fabric/http/components/modal');
const Introduction = require('../components/introduction');

// const FrontPage = require('../components/introduction');
const CharacterList = require('../components/character-list');
const CharacterView = require('../components/character-view');

// WIP Components
// TODO: sort and assign
const AssetList = require('../components/asset-list');
const AssetView = require('../components/asset-view');
const QuestList = require('../components/quest-list');
const QuestView = require('../components/quest-view');
const MapList = require('../components/map-list');
const MapView = require('../components/map-view');
const TileList = require('../components/tile-list');
const TileView = require('../components/tile-view');
const PeerList = require('../components/peer-list');
const PeerView = require('../components/peer-view');
const PlaceList = require('../components/place-list');
const PlaceView = require('../components/place-view');
const PlayerList = require('../components/player-list');
const PlayerView = require('../components/player-view');
const WorldList = require('../components/world-list');
const WorldView = require('../components/world-view');
const WorldTable = require('../components/world-table');

async function main () {
  // type definitions
  window.RPG = RPG;
  window.Engine = Engine;
  window.Circuit = Circuit;
  window.Service = Service;
  window.$ = $;
  window.jQuery = $;
  // window.D3GraphViz = D3GraphViz;

  window.app = new RPG(config);

  // Define Types for Fabric
  /* window.app.define('message', {
    name: 'message',
    type: 'String',
    field: 'text' // for monad~
  }); */

  // TODO: clean all of this up!!!
  // core pages to design for launch
  window.app._defineElement('rpg-index', RPG);
  window.app._defineElement('rpg-introduction', Introduction);
  window.app._defineElement('maki-modal', Modal);
  window.app._defineElement('maki-prompt', Prompt);
  window.app._defineElement('fabric-channel-list', FabricChannelList);
  window.app._defineElement('fabric-channel-view', FabricChannelView);
  // window.app._defineElement('fabric-peer-list', FabricPeerList);

  // various subpages
  window.app._defineElement('rpg-asset-list', AssetList);
  window.app._defineElement('rpg-asset-view', AssetView);
  window.app._defineElement('rpg-character-list', CharacterList);
  window.app._defineElement('rpg-character-view', CharacterView);
  window.app._defineElement('rpg-quest-list', QuestList);
  window.app._defineElement('rpg-quest-view', QuestView);
  window.app._defineElement('rpg-map-list', MapList);
  window.app._defineElement('rpg-map-view', MapView);
  window.app._defineElement('rpg-tile-list', TileList);
  window.app._defineElement('rpg-tile-view', TileView);
  window.app._defineElement('rpg-peer-list', PeerList);
  window.app._defineElement('rpg-peer-view', PeerView);
  window.app._defineElement('rpg-place-list', PlaceList);
  window.app._defineElement('rpg-place-view', PlaceView);
  window.app._defineElement('rpg-player-list', PlayerList);
  window.app._defineElement('rpg-player-view', PlayerView);
  window.app._defineElement('rpg-world-list', WorldList);
  window.app._defineElement('rpg-world-view', WorldView);
  window.app._defineElement('rpg-world-table', WorldTable);

  // Exchange Demo
  /*
  window.app._defineElement('exchange-introduction', ExchangeIntroduction);
  window.app._defineElement('exchange-menu', ExchangeMenu);
  window.app._defineElement('portal-block-list', BlockList);
  window.app._defineElement('portal-block-view', BlockView);
  window.app._defineElement('portal-chain-list', ChainList);
  window.app._defineElement('portal-chain-view', ChainView);
  window.app._defineElement('portal-depositor-list', DepositorList);
  window.app._defineElement('portal-depositor-view', DepositorView);
  window.app._defineElement('portal-transaction-list', TransactionList);
  window.app._defineElement('portal-transaction-view', TransactionView);
  window.app._defineElement('portal-order-list', OrderList);
  window.app._defineElement('portal-order-view', OrderView);
  window.app._defineElement('fabric-wallet', Wallet);
  window.app._defineElement('fabric-wallet-list', WalletList);
  window.app._defineElement('fabric-wallet-view', WalletView);
  window.app._defineElement('fabric-wallet-card', WalletCard);
  */

  // bind event listeners manually
  // TODO: write documentation using this example
  window.app.rpg.on('tick', function (tick) {
    console.log('[SCRIPTS:RPG]', 'received tick from RPG:', tick);
  });

  window.app.service = new Service(config);
  window.app.circuit = new Circuit({
    gates: [],
    loops: [ { name: 'tick', interval: TICK_INTERVAL } ],
    wires: [ { name: 'ready', from: 'init', to: 'ready' } ]
  });

  window.app.circuit._registerMethod('_generateIdentity', async function () {
    // TODO: move this entire function to be defined from config
    let identity = await window.app._generateIdentity();
    console.log('[TEST:CIRCUIT]', 'identity created:', identity);
    let profile = await window.app._restoreIdentity();
    console.log('[TEST:CIRCUIT]', 'got profile:', profile);
    let player = await window.app.rpg._announcePlayer(profile);
    console.log('[TEST:CIRCUIT]', 'announced player:', player);
  });

  window.app.circuit._registerMethod('_generateTile', async function () {
    // TODO: move this entire function to be defined from config
    let tile = new Engine.Tile({ seed: 32 });
    let after = tile.generate();
    let entity = Object.assign({}, tile.toObject(), {
      data: [after['z'], after['y'], after['x'], 1]
    });

    console.log('after:', after);
    console.log('entity:', entity);

    let posted = await window.app.rpg._POST(`/tiles`, entity);

    console.log('tile:', tile);
    console.log('tile.toObject():', tile.toObject());
    console.log('posted:', posted);
  });

  window.app.circuit._registerMethod('_generateWalletKey', async function (event) {
    event.preventDefault();

    let parent = event.target.querySelector(':parent');
    console.log('FOUND PARENT:', parent);

    // TODO: move this entire function to be defined from config
    let key = new Fabric.Key();
    let posted = await window.app._POST(`/keys`, key);

    console.log('key:', key);
    console.log('posted:', posted);

    return false;
  });

  window.app.circuit._registerMethod('_confirmFill', async function () {
    let confirmed = confirm('Are you sure you wish to fulfil this order?  Total received will equal 0.00 ETC, deducting 0.00 BTC from your balance.\n\nCaution: this is irreversible.');
  });

  /* window.graph = D3GraphViz.graphviz('#svg', {
    fit: true,
    width: 800,
    height: 600
  }).renderDot(window.app.circuit.dot); */

  // TODO: fix verification
  window.app._verifyElements();

  // TODO: move these into App
  window.app.actions = [];
  window.app.bindings = [];

  // TODO: bind service stuff
  window.app.service.on('source', function (source) {
    console.log('[SCRIPTS:RPG]', 'service emitted source:', source);
  });

  window.app.circuit.on('/', async function (msg) {
    console.log('[FABRIC:WEB]', 'Circuit emitted:', msg, msg['@data']);
    switch (msg['@type']) {
      default:
        console.error('unhandled circuit message type:', msg['@type']);
        break;
      case 'KeyUp':
        console.log('KeyUp:', msg['@data']);
        break;
      case 'Snapshot':
        console.log('Received snapshot:', msg['@data']);
        break;
    }
  });

  // TODO: bind updates from `@fabric/http` class
  let elements = document.querySelectorAll('*[data-bind]');

  // iterates over elements which claim binding, use sha256(path) as target
  for (let i = 0; i < elements.length; i++) {
    let element = elements[i];
    let binding = element.getAttribute('data-bind');

    // listen for changes from rendered element
    element.addEventListener('keyup', async function (event) {
      if (!event.target) return false;
      if (!event.target.value) return false;
      await window.app.service._PUT('/source', event.target.value);
    });

    console.log('binding:', binding, element);

    window.app.circuit.on(binding, function (data) {
      console.log('received replacement data (from circuit!) targeted for binding:', binding);
      element.innerHTML = data;
    });

    window.app.on(binding, function (data) {
      console.log('received replacement data targeted for binding:', binding);
      element.innerHTML = data;
    });

    window.app.bindings.push(element);
  }

  document.querySelector('body').addEventListener('click', async function (event) {
    let result = null;
    let action = event.target.getAttribute('data-action');
    let method = window.app.circuit.methods[action];
    if (!method) return console.error('NO METHOD ON CIRCUIT:', method, event);

    let circuit = new Circuit({
      gates: [ action ]
    });

    console.log('new circuit:', circuit);
    console.log('method:', method);

    result = await method.call(window.app, event);

    console.log('result:', result);

    return result;
  });

  // wires up router / push state / history
  // TODO: move this to SPA?
  window.app.handler();

  // start the RPG :)
  await window.app.start();

  console.log('[RPG:CORE]', 'ready!');
}

main();
