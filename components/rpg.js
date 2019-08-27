'use strict';

// Core application
const App = require('./application');

class RPG extends App {
  constructor (settings = {}) {
    super(settings);

    this.settings = Object.assign({
      name: 'RPG',
      handle: 'rpg-app'
    }, settings);

    return this;
  }

  render () {
    console.log('types:', this.types);

    return `<rpg-app route="${this.route}">
  <fabric-grid>
    <fabric-grid-row id="details">
      <h1>${this.settings.name}</h1>
      <fabric-channel></fabric-channel>
    </fabric-grid-row>
    <fabric-grid-row id="types">${this.types.render()}</fabric-grid-row>
    <fabric-grid-row id="circuit">${this.circuit.render()}</fabric-grid-row>
    <fabric-grid-row id="graph"></fabric-grid-row>
  </fabric-grid>
  <script type="text/javascript" src="/scripts/index.min.js"></script>
</rpg-app>`;
  }
}

module.exports = RPG;
