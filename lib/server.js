'use strict';

const http = require('http');
const WebSocket = require('ws');

const Fabric = require('@fabric/core');
const RPG = require('./rpg');

class Server extends Fabric.Oracle {
  constructor (configuration = {}) {
    super(configuration);

    this.config = Object.assign({
      path: './stores/server',
      port: 9999
    }, configuration);

    this.players = {};
    this.connections = {};
    this.validator = new Fabric.Machine();

    this.http = http.createServer(this._handleRequest.bind(this));
    this.rpg = new RPG(this.config);
    this.wss = new WebSocket.Server({ server: this.http });

    this.wss.on('connection', this._handleWebSocket.bind(this));

    return this;
  }

  _handleRequest (req, res) {
    res.writeHead(200, {
      'Content-Type': 'application/json'
    });
    res.end(JSON.stringify(this.players));
  }

  _handleWebSocket (socket, request) {
    let buffer = Buffer.from(request.headers['sec-websocket-key'], 'base64');
    let server = this;
    let player = new Fabric.State({
      connection: buffer.toString('hex'),
      entropy: buffer.toString('hex')
    });

    server.connections[player['@data'].connection] = socket;
    server.players[player['@data'].connection] = player;

    socket.on('message', async function handler (msg) {
      socket.send(JSON.stringify({
        '@type': 'Receipt',
        '@actor': buffer.toString('hex'),
        '@data': msg,
        '@version': 1
      }));

      socket.send(JSON.stringify({
        '@type': 'PlayerList',
        '@data': Object.keys(server.players),
        '@version': 1
      }));

      socket.send(JSON.stringify({
        '@type': 'State',
        '@data': server.players,
        '@version': 1
      }));

      console.log('server received msg from connected client:', msg);

      try {
        let message = JSON.parse(msg);
        let type = message['@type'];

        switch (type) {
          default:
            console.log('unhandled type:', type);
            break;
          case 'POST':
            let link = await server._POST(message['@data']['path'], message['@data']['value']);
            console.log('posted link:', link);
            break;
        }

        server._relayFrom(buffer.toString('hex'), msg);
      } catch (E) {
        console.error('could not parse message:', E);
        console.log('you should disconnect from this peer:', buffer.toString('hex'));
      }
    });
  }

  _relayFrom (actor, msg) {
    let peers = Object.keys(this.connections).filter(key => {
      return key !== actor;
    });

    console.log(`relaying message from ${actor} to peers:`, peers);

    for (let i = 0; i < peers.length; i++) {
      try {
        this.connections[peers[i]].send(msg);
      } catch (E) {
        console.error('Could not relay to peer:', E);
      }
    }
  }

  define (name, definition) {
    super.define(name, definition);
  }

  trust (source) {
    source.on('message', function (msg) {
      console.log('[RPG:SERVER]', 'trusted source:', source.constructor.name, 'sent message:', msg);
    });
  }

  start () {
    this.http.listen(this.config.port);
  }
}

module.exports = Server;
