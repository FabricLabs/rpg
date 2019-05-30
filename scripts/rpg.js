'use strict';

// Core RPG lib
const RPG = require('../types/rpg');

// Dependencies
const Circuit = require('@fabric/core').Circuit;
const Service = require('@fabric/core').Service;
const App = require('@fabric/http').App;

async function main () {
  window.App = App;
  window.Circuit = Circuit;
  window.Service = Service;

  // Core RPG Engine
  window.RPG = RPG;
  // window.D3GraphViz = D3GraphViz;

  window.app = new App();
  window.app.rpg = new RPG();

  window.app.rpg.on('tick', function (tick) {
    console.log('received tick from RPG:', tick);
  });

  window.app.rpg.on('message', function (msg) {
    console.log('received message from RPG:', msg);
  });

  window.app.service = new Service();
  window.app.circuit = new Circuit({
    gates: [],
    wires: [
      { name: 'ready', from: 'init', to: 'ready' }
    ]
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

  let elements = document.querySelectorAll('*[data-bind]');
  for (let i = 0; i < elements.length; i++) {
    let element = elements[i];
    let binding = element.getAttribute('data-bind');

    console.log('binding the element:', binding, element);

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
      return window.app.circuit[action](event);
    });
    window.app.actions.push(element);
  }

  // start the RPG :)
  await window.app.rpg.start();

  console.log('[RPG:CORE]', 'ready!');
}

main();
