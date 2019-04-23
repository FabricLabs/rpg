'use strict';

const Map = require('./map');

class World {
  constructor (settings = {}) {
    this.settings = Object.assign({}, settings);
    this.map = new Map();
    this.status = null;
  }

  async start () {
    this.status = 'starting';

    this.map.on('build', function (data) {
      console.log('map is done building:', data);
      let header = data[0];
      let body = data[1];

      console.log('header:', header);
      console.log('version:', header.slice(0, 4));
      console.log('magic:', header.slice(4, 12));
      console.log('magic:', header.slice(4, 12).toString('hex'));
      console.log('world:', body);
    });

    this.map._build();
    this.map._dump();

    this.status = 'started';
  }
}

module.exports = World;
