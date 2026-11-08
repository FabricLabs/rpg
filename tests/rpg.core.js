'use strict';

const assert = require('assert');
const { MAX_MESSAGE_SIZE, HEADER_SIZE } = require('@fabric/core/constants');
const Key = require('@fabric/core/types/key');
const Message = require('@fabric/core/types/message');

const RPG = require('../types/rpg');
const {
  ARC_TYPE,
  ARC_VERSION,
  contractUpdateMessage
} = require('../types/network');

const config = {
  persistent: false,
  networking: false
};

describe('@fabric/rpg', function () {
  this.timeout(20000);

  describe('RPG', function () {
    it('should expose a constructor', function () {
      assert.equal(typeof RPG, 'function');
    });

    it('can start and stop without joining the playnet', async function () {
      const rpg = new RPG(config);

      await rpg.start();
      try {
        assert.equal(rpg.status, 'READY');
        assert.equal(rpg._joinNetwork, false);
      } finally {
        await rpg.stop();
      }

      assert.ok(rpg);
      assert.equal(rpg['@type'], 'RPG');
    });

    it('can register a player', async function () {
      const rpg = new RPG(config);

      await rpg.start();
      const link = await rpg._POST('/players', { name: 'Yorick' });
      const sample = await rpg._GET('/players');
      await rpg.stop();

      assert.ok(link);
      assert.equal(sample[link.split('/')[2]].name, 'Yorick');
    });

    it('publishes a 0.1.0 contract message inside one frame', async function () {
      const rpg = new RPG(config);

      await rpg.start();
      const message = rpg.publishState();
      const frame = message.toBuffer();
      const fields = message.toFields();
      await rpg.stop();

      assert.ok(fields);
      assert.equal(fields.contract, rpg.contract.id);
      assert.equal(JSON.parse(fields.payload).type, 'RPGState');
      assert.ok(frame.length <= HEADER_SIZE + MAX_MESSAGE_SIZE);
      assert.ok(Buffer.byteLength(fields.payload, 'utf8') <= MAX_MESSAGE_SIZE);
    });

    it('ingests a player announced on the contract', async function () {
      const rpg = new RPG(config);
      await rpg.start();

      const outbound = contractUpdateMessage(rpg.contract.id, {
        type: 'Player',
        name: 'Wanderer'
      }, rpg.key);
      const inbound = Message.fromBuffer(outbound.toBuffer());
      const link = rpg.ingestMessage(inbound);
      const players = await rpg._GET('/players');

      await rpg.stop();

      assert.ok(String(link).indexOf('/players/') === 0);
      assert.equal(Object.values(players).filter((player) => player.name === 'Wanderer').length, 1);
    });

    it('takes mesh frames only from its own key or a listed writer', async function () {
      const stranger = new Key();
      const open = new RPG(config);
      await open.start();
      const frame = () => Message.fromBuffer(contractUpdateMessage(open.contract.id, { type: 'Player', name: 'Intruder' }, stranger).toBuffer());
      assert.equal(open.ingestMessage(frame()), null);
      await open.stop();

      const listed = new RPG(Object.assign({}, config, { writers: [stranger.pubkey.slice(2)] }));
      await listed.start();
      const outbound = contractUpdateMessage(listed.contract.id, { type: 'Player', name: 'Friend' }, stranger);
      const link = listed.ingestMessage(Message.fromBuffer(outbound.toBuffer()));
      await listed.stop();
      assert.ok(String(link).indexOf('/players/') === 0);
    });

    it('refuses a document that names no contract, and caps what peers add', async function () {
      const rpg = new RPG(Object.assign({}, config, { maxPlayers: 1 }));
      await rpg.start();
      assert.equal(rpg.ingestDocument({ type: 'CONTRACT_MESSAGE', fields: { payload: JSON.stringify({ type: 'Player', name: 'Nobody' }) } }), null);
      const announce = (name) => rpg.ingestMessage(Message.fromBuffer(contractUpdateMessage(rpg.contract.id, { type: 'Player', name }, rpg.key).toBuffer()));
      const first = announce('One');
      assert.ok(String(first).indexOf('/players/') === 0);
      assert.equal(announce('Two'), null);
      assert.equal(announce('One'), first);
      await rpg.stop();
    });

    it('ignores documents for a different contract', async function () {
      const rpg = new RPG(config);
      await rpg.start();

      const outbound = contractUpdateMessage('00'.repeat(32), {
        type: 'Player',
        name: 'Other'
      }, rpg.key);
      const link = rpg.ingestMessage(Message.fromBuffer(outbound.toBuffer()));

      await rpg.stop();
      assert.equal(link, null);
    });

    it('records a world state commitment on the same contract', async function () {
      const rpg = new RPG(config);
      await rpg.start();

      const outbound = contractUpdateMessage(rpg.contract.id, {
        type: 'WorldState',
        clock: 3,
        commitment: 'abc',
        players: 1,
        places: 2
      }, rpg.key);
      const recorded = rpg.ingestMessage(Message.fromBuffer(outbound.toBuffer()));

      await rpg.stop();

      assert.equal(recorded.clock, 3);
      assert.equal(recorded.commitment, 'abc');
    });

    it('advertises an application resource contract', function () {
      const rpg = new RPG(Object.assign({}, config, {
        resources: {
          Character: { description: 'A story character.' }
        }
      }));
      const arc = rpg.toApplicationResourceContract();

      assert.equal(arc['@type'], ARC_TYPE);
      assert.equal(arc.version, ARC_VERSION);
      assert.equal(arc.contract.id, rpg.contract.id);
      assert.equal(arc.contract.messageType, 'CONTRACT_PUBLISH');
      assert.equal(arc.resources.Player.routes.list, '/players');
      assert.equal(arc.resources.Character.routes.list, '/characters');
      assert.equal(arc.capabilities.fabric.p2p, true);
    });
  });
});
