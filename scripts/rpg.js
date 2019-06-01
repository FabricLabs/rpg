'use strict';

const { TICK_INTERVAL } = require('../constants');
const config = require('../config');

// Core RPG lib
const RPG = require('../types/rpg');
const SPA = require('@fabric/http/types/spa');

// Dependencies
const Circuit = require('@fabric/core/lib/circuit');
const Service = require('@fabric/core/lib/service');

async function main () {
  // type definitions
  window.App = SPA;
  window.Service = Service;

  // Core RPG Engine
  window.RPG = RPG;
  // window.D3GraphViz = D3GraphViz;

  window.app = new SPA(config);
  window.app.rpg = window.rpg = new RPG(config);

  window.app.rpg.on('tick', function (tick) {
    console.log('received tick from RPG:', tick);
  });

  window.app.rpg.on('message', function (msg) {
    console.log('received message from RPG:', msg);
    switch (msg['@type']) {
      default:
        console.error('Unhandled message type from RPG:', msg['@type']);
        break;
      case 'Transaction':
        window.app.rpg._applyChanges(msg['@data'].changes);
        break;
    }
  });

  window.app.service = new Service();
  window.app.circuit = new Circuit({
    gates: [],
    loops: [ { name: 'tick', interval: TICK_INTERVAL } ],
    wires: [ { name: 'ready', from: 'init', to: 'ready' } ]
  });

  window.app.circuit._registerMethod('_generateIdentity', async function () {
    console.log('todo: generate here!');
    let identity = await window.app.rpg._createIdentity();
    console.log('identity created:', identity);
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

  let actionables = document.querySelectorAll('*[data-action]');
  for (let i = 0; i < actionables.length; i++) {
    let element = actionables[i];
    let action = element.getAttribute('data-action');
    element.addEventListener('click', async function (event) {
      console.log('click event on actionable element:', action, event);
      let method = window.app.circuit.methods[action];
      if (!method) console.warn('NO METHOD ON CIRCUIT:', method);
      let circuit = new Circuit({
        gates: [ action ]
      });
      console.log('new circuit:', circuit);
      console.log('method:', method);

      let result = await method.call(window.app);

      console.log('result:', result);

      return result;
    });
    window.app.actions.push(element);
  }

  // wires up router / push state / history
  window.app.handler();

  // start the RPG :)
  await window.app.rpg.start();

  console.log('[RPG:CORE]', 'ready!');
}

main();
