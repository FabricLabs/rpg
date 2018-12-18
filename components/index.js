'use strict';

const App = require('../lib/application');

async function main () {
  let app = new App();
  let element = document.querySelector('*[data-bind=fabric]');
  let rendered = app.render();

  await app.start();

  element.innerHTML = rendered;

  console.log('[FABRIC]', 'rendered:', rendered);
  console.log('[FABRIC]', 'booted:', app);
}

module.exports = main();
