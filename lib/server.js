'use strict';

const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const PeerServer = require('peer').ExpressPeerServer;

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

    this.wss = null;
    this.http = null;
    this.express = express();
    this.peer = new PeerServer(this.express, {
      path: '/services/peering'
    });

    this.rpg = new RPG(this.config);

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

    socket.on('close', function () {
      delete server.connections[player['@data'].connection];
    });

    // TODO: message handler on base class
    socket.on('message', async function handler (msg) {
      socket.send(JSON.stringify({
        '@type': 'Receipt',
        '@actor': buffer.toString('hex'),
        '@data': msg,
        '@version': 1
      }));

      try {
        let message = JSON.parse(msg);
        let type = message['@type'];

        switch (type) {
          default:
            console.log('[SERVER]', 'unhandled type:', type);
            break;
          case 'GET':
            let answer = await server._GET(message['@data']['path']);
            console.log('answer:', answer);
            return answer;
          case 'POST':
            let link = await server._POST(message['@data']['path'], message['@data']['value']);
            console.log('[SERVER]', 'posted link:', link);
            break;
          case 'PATCH':
            let result = await server._PATCH(message['@data']['path'], message['@data']['value']);
            console.log('[SERVER]', 'patched:', result);
            break;
        }

        server._relayFrom(buffer.toString('hex'), msg);
      } catch (E) {
        console.error('could not parse message:', E);
        console.log('you should disconnect from this peer:', buffer.toString('hex'));
      }
    });

    server.connections[player['@data'].connection] = socket;
    server.players[player['@data'].connection] = player;

    socket.send(JSON.stringify({
      '@type': 'State',
      '@data': server.rpg['@data'],
      '@version': 1
    }));
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
    let server = this;

    // configure router
    server.express.use(express.static('assets'));
    server.express.get('/peers', async function (req, res) {
      let peers = await server._GET('/peers');
      res.send(peers);
    });

    server.http = http.createServer(server.express);

    this.wss = new WebSocket.Server({ server: this.http });
    this.wss.on('connection', this._handleWebSocket.bind(this));

    server.http.listen(this.config.port);

    return server;
  }
}

module.exports = Server;
