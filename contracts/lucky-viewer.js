module.exports = function LuckyWinnner (input) {
  // Dependencies
  const Actor = require('@fabric/core/types/actor');
  const Machine = require('@fabric/core/types/machine');
  const { Swarm } = require('@fabric/core/types/peer');

  // Methods
  function OP_FIND_WINNER (state) {
    // TODO: random over currently active members of a channel
    // i.e., viewers of @remaeus' Star Citizen stream
    // # AMONG THE STARS
    // - 30 days idle music on channel (offline)
    // - initial live blast: playing Star Citizen!
    // - fade in, no hud, no camera
    // - first-time playthrough with commentary
    return false;
  }

  // Setup
  const created = new Date();
  const actor = new Actor(input);
  const contest = {
    created: created,
    duration: settings.duration,
    input: { ...actor.toObject(), '@id': actor.id }
  };

  // Data sourcing
  const swarm = new Swarm();

  // Execution
  const machine = new Machine({
    script: [
      OP_FIND_WINNER
    ],
    state: {
      contest
    }
  });

  // Spawn threads
  machine.start();
  machine.compute();

  swarm.start().then(OP_FIND_WINNER);

  // Report result
  return {
    type: 'LuckyWinner',
    object: {
      machine: machine.id,
      result: machine._result,
      state: machine.state
    }
  };
};
