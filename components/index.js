'use strict';

const config = require('../config');
const Application = require('./application');

// main program
async function main () {
  let rpg = window.application = new Application(config);

  rpg.on('error', function (err) {
    console.error(err);
  });

  rpg.envelop('*[data-bind=fabric]');
  rpg.render();

  await rpg.start();

  // TODO: move to envelop()
  document.querySelector('*[data-action=generate-identity]').addEventListener('click', rpg._createIdentity.bind(rpg));
  document.querySelector('*[data-action=toggle-fullscreen]').addEventListener('click', rpg._toggleFullscreen.bind(rpg));
  // document.querySelector('*[data-action=request-name]').addEventListener('click', rpg._requestName.bind(rpg));

  console.log('[FABRIC]', 'booted:', rpg);

  let ui = await UI();

  console.log('[FABRIC]', 'ui:', ui);
}

async function UI () {
  var hash = document.location.hash;
  let myid = hash ? hash.substr(1) : '0';

  let userid = null;
  let copycat_mode = false;
  let default_walk_speed = 5;
  let default_jump_speed = 25;
  let map_size = 32;
  let worldSize = 64;
  let tile_index = {};

  //keyboard stuff
  function Key (code) {
    this.code = code;
  }

  Key.prototype = {
    down: false
  };

  function KeySet () {
    this.up =    new Key(38);
    this.down =  new Key(40);
    this.left =  new Key(37);
    this.right = new Key(39);
    this.space = new Key(32);
  }

  let keys = new KeySet();

  function getKey (code) {
    for (let key in keys) {
      if (keys.hasOwnProperty(key)) {
        if (keys[key].code === code) {
          return keys[key];
        }
      }
    }
  }

  // Keyboard event listeners
  window.addEventListener('keydown', function (e) {
    let key = getKey(e.which);
    if (key) {
      key.down = true;
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', function (e) {
    // console.log('keyup', e.which);
    let key = getKey(e.which);
    if (key) {
      key.down = false;
      e.preventDefault();
    }
  });

  //image stuff
  let images = {
    drawRotatedImage: function (image, x, y, angle) {
      this.context.save();
      this.context.translate(x, y);
      this.context.rotate(angle * TO_RADIANS);
      this.context.drawImage(image, -(image.width / 2), -(image.height / 2));
      this.context.restore();
    },
    drawDot: function (x, y) {
      this.context.fillRect(x, y, 1, 1);
    },
    images: {},
    getImage: function (src, cb) {
      let img = this.images[src];
      if (img && cb){
        cb.call(img);
        return img;
      } else {
        img = new Image();
        img.onload = cb;
        img.src = src;
        this.images[src] = img;
        return img;
      }
    },
    preload: function (sources, cb) {
      let self = this;
      let ln = sources.length;

      sources.forEach(function (src) {
        self.getImage(src, function () {
          if (--ln === 0 && cb) {
            cb.call(self, sources);
          }
        });
      });
    },
    drawSprite: function (img, left, top, width, height, x, y, width2, height2, turned) {

      var x_scale = 1;

      if (turned) {
        /*this.context.save();
        this.context.translate(width2, 0);
        this.context.scale(-1, 1);
        x_scale = -1;*/
      }

      if (width2 && height2) {
        this.context.drawImage(img, left, top, width, height, x, y, width2*x_scale, height2);
      } else {
        this.context.drawImage(img, left, top, width, height, x, y, width*x_scale, height);
      }

      if (turned) {
        //this.context.restore();
      }
    }
  };

  function Sprite (img, width, height, width2, height2, x, y, positions) {
    this.img = img;
    this.width = width;
    this.height = height;
    this.width2 = width2;
    this.height2 = height2;
    this.x = x;
    this.y = y;
    this.z = 1; // layer 1
    this.positions = positions;
  }

  Sprite.prototype = {
    animate: 0,
    frames: 0,
    pos: 0,
    draw: function (x, y, position) {
      if (typeof position !== 'undefined') {
        this.pos = position;
      } else {
        if (this.animate) {
          if (this.frames === 0){
            this.frames = this.animate;
            this.pos = this.pos === 0 ? this.positions.length-1 : this.pos -1;
          } else {
            this.frames--;
          }
        } else {
          this.pos = 0;
        }
      }
      if (this.positions) {
        let pos = this.positions[this.pos];
        images.drawSprite(this.img, pos[0], pos[1], this.width, this.height, x, y, this.width2, this.height2, this.turned);
      } else {
        images.drawSprite(this.img, 0, 0, this.width, this.height, x, y, this.width2, this.height2, this.turned);
      }
    }
  };

  let camera = {
    x: 0,
    y: 0,
    z: 1,
    width: 1024,
    height: 768,
    padding: 500,
    padding2: 300
  };

  let scrollspeed = 20;
  let gravity = .98;
  let bricks = [];
  let players = [];
  let missiles = [];
  let player = null;
  let background = null;

  function scrollCamera(player) {
    //scroll camera left
    if (player.x < camera.x + camera.padding){
      camera.x = player.x - camera.padding;
    }
    //scroll camera right
    if (player.x > camera.x + camera.width - camera.padding){
      camera.x = player.x - camera.width + camera.padding;
    }
    //scroll camera up
    if (player.y < camera.y + camera.padding2){
      camera.y = player.y - camera.padding2;
    }
    //scroll camera down
    if (player.y > camera.y + camera.height - camera.padding2){
      camera.y = player.y - camera.height + camera.padding2;
    }
  }

  function networkFrame () {
    let player = players[0];
    window.application._updatePosition(player.x, player.y, player.z);
    setTimeout(networkFrame, 1000/10);
  }

  async function logicFrame () {
    // update players position,
    // listen for collisions etc
    let player = players[0];

    runPhysics(player, true, false);
    scrollCamera(player);

    player.history.push({
      x: player.x,
      y: player.y,
      z: 1
    });

    Object.keys(window.application.networkPlayers).forEach(function (k) {
      let p = window.application.networkPlayers[k];
      //p.x += p.dx;
      //p.y += p.dy;
      runPhysics(p);
    });

    Object.keys(missiles).forEach(function(k){
      let m = missiles[k];
      runPhysics(m, false, true);
      if(m.deleted) delete missiles[k];
    })

    for(var i = 1 ; i<players.length; i++){
      runPhysics(players[i], false, true);
    }

    if (copycat_mode) {
      //player2
      let player2 = players[1];
      let cloneDelay = 100;

      if (player.history.length > cloneDelay) {
        let targetState = player.history[player.history.length - cloneDelay];
        player2.x = targetState.x;
        player2.y = targetState.y;
      }
    }

    // TODO: commit to game state (hash) 60x per second
    // in practice, the below line updates (broadcasts) a new player position
    // at the expected interval of 60/s
    /* await window.application.stash._PATCH(`/players/${window.application.swarm.agent.id}`, {
      id: window.application.swarm.agent.id,
      position: {
        x: player.x,
        y: player.y,
        z: player.z
      }
    }); */

    let identity = window.application.swarm.agent.id;
    if (identity && false) {
      await window.application._applyChanges([
        {
          op: 'replace',
          path: `/players/0/position`,
          value: player.position
        }
      ]);
    }

    // process the game logic at a target of 60fps
    setTimeout(logicFrame, 1000/60);
  }

  function loadMap () {
    //starting area
    /*let brick = images.getImage("brick.jpg");
    for(let i=0; i<30; i++){
        bricks.push(new Sprite(brick, 512, 512, 50, 50, i*50, 600));
    }*/
    let grass = images.getImage('grass-32x32.png');

    for (let j = 0; j< map_size; j++) {
      for (let i = 0; i < map_size; i++) {
        let tile = new Sprite(grass, 32, 32, 32, 32, i * 32, j * 32)
        tile.bg = true;
        bricks.push(tile);
      }
    }

    let rocks = images.getImage('dark-earth-01.png');

    for (let j = 0; j< map_size; j++) {
      bricks.push(new Sprite(rocks, 32, 32, 32, 32, j * worldSize, -worldSize));
      bricks.push(new Sprite(rocks, 32, 32, 32, 32, j * worldSize, map_size * worldSize));
      bricks.push(new Sprite(rocks, 32, 32, 32, 32, -worldSize, j * worldSize));
      bricks.push(new Sprite(rocks, 32, 32, 32, 32, map_size * worldSize, j * worldSize));
    }

    let wall = images.getImage('earth-01.png');

    for (let i = 2; i < 20; i++) { bricks.push(new Sprite(wall, 32, 32, 32, 32, i * 50, 2 * 50)); }
    for (let i = 2; i < 15; i++) { bricks.push(new Sprite(wall, 32, 32, 32, 32, i * 50, 12 * 50)); }
    for (let i = 2; i < 20; i++) { bricks.push(new Sprite(wall, 32, 32, 32, 32, 18 * 50, i * 50)); }
  }



  function loadPlayers () {
    let avatar = images.getImage('avatar-sheet.png');

    player = new Sprite(avatar, 19, 26, 19, 26, 380, 380);
    player.dx = 0;
    player.dy = 0;
    player.walkspeed = default_walk_speed;
    player.jumpspeed = default_jump_speed;
    player.damage = 3;
    player.hp = player.max_hp = 10;
    player.team = 0;
    player.history = [];

    players = [player];

    if (copycat_mode) {
      let luigi = images.getImage('luigi.png');
      let player2 = new Sprite(luigi, 480, 640, 48, 64, 20, 300);
      players.push(player2);
    }

    let slime = images.getImage('slime-blue.png');

    for(let i = 0; i<7; i++) {
      let player3 = new Sprite(slime, 32, 32, 64, 64, i * 200, i * 200 + 100);

      player3.dx = Math.floor( application.machine.generator.next.percent() * 3 + 2 );
      player3.dy = Math.floor( application.machine.generator.next.percent() * 3 + 2);
      player3.x0 = player3.x; player3.y0 = player3.y;
      player3.max_bounces = 100000;
      player3.bounces = 0;
      player3.walkspeed = default_walk_speed;
      player3.jumpspeed = default_jump_speed;
      player3.history = [];
      player3.hp = player3.max_hp = 10;
      player3.damage = 3;
      player3.team = 1;
      players.push(player3);
    }
  }

  loadMap();
  loadPlayers();

  let fireball = images.getImage('fireball.ico');
  let lastFire = 0;

  function runPhysics (player, processKeys, processUnits) {
    let dx = player.dx = processKeys ? 0 : player.dx;
    let dy = player.dy = processKeys ? 0 : player.dy;
    let dx0 = dx; let dy0 = dy;
    let walkspeed = player.walkspeed;
    let jumpspeed = player.jumpspeed;

    if (processKeys) {
      if (keys.left.down) {
        player.turned = true;
        dx = -walkspeed;
      }
      if (keys.right.down) {
        player.turned = false;
        dx = walkspeed;
      }
      if (keys.up.down) {
        //player.turned = true;
        dy = -walkspeed;
      }
      if (keys.down.down) {
        //player.turned = false;
        dy = walkspeed;
      }

      /*if(keys.space.down){
          if(dy == 0){
              dy = -jumpspeed;
          }
      }*/
      if(!player.dead && keys.space.down && new Date() - lastFire > 500){
          let missile = new Sprite(fireball, 250, 250, 40, 40, player.x, player.y);
          missile.dx = dx + (player.turned ? -1 : 1);
          missile.dy = dy;
          missile.max_bounces = 5;
          missile.bounces = 0;
          missile.damage = player.damage;
          missile.team = player.team;
          missile.missile = true;
          missiles.push(missile);
          lastFire = new Date();
      }

    }

    var ybounce; var xbounce;

    function processDamage(brick){

      //if(false && player.hp) player.hp -= brick.damage;
      if(!player.dead){
        brick.hp -= player.damage;
        if (brick.hp <= 0) {
          brick.dead = true;
          setTimeout(function(){
            brick.dead = false;
            brick.hp = brick.max_hp;
          }, 15000)
        }
      }
      player.deleted = true;
    }

    function bounceLogicY(brick){
      if(brick.hp && player.team != brick.team) processDamage(brick);

      if(player.max_bounces){
        if(player.bounces < player.max_bounces){ dy *= -1; ybounce = true; }
        else{ player.deleted = true; dy = 0; }
        player.bounces++;
      }
      else{
        dy = 0; //0.01;
        //console.log('stop vert')
      }
    }
    function bounceLogicX(brick){
      if(brick.hp && player.team != brick.team) processDamage(brick);

      if(player.max_bounces){
        if(player.bounces < player.max_bounces){ dx *= -1; xbounce = true; }
        else{ player.deleted = true; dx = 0; }
        player.bounces++;
      }
      else{
        dx = 0;
      }
    }

    var cols = bricks//.concat(players)

    if(processUnits) cols = players.concat(cols);

    //dy += gravity;
    for (let i = 0; i < cols.length; i++) {
        let brick = cols[i];

        if(brick == player) continue;
        if (brick.bg) continue;
        if (brick.dead) continue;
        if (brick.team == player.team && player.missile) continue;

        let brickLeft = brick.x;
        let brickRight = brick.x + brick.width2;
        let brickTop = brick.y;
        let brickBottom = brick.y + brick.height2;
        let playerLeft = player.x + dx;
        let playerRight = player.x + player.width2 + dx;
        let playerTop = player.y + dy;
        let playerBottom = player.y + player.height2 + dy;


        /*let intersectHorizontal =
            (playerLeft >= brickLeft && playerLeft <= brickRight) || (playerLeft >= brickLeft && playerRight <= brickRight) ||
            (brickLeft >= playerLeft && brickLeft <= playerRight) || (brickRight >= playerLeft && brickRight <= playerRight)  */
        let intersectHorizontal =
            (playerLeft >= brickLeft && playerLeft <= brickRight) || (playerRight >= brickLeft && playerRight <= brickRight) ||
            (brickLeft >= playerLeft && brickLeft <= playerRight) || (brickRight >= playerLeft && brickRight <= playerRight);

        //hit the ceiling
        if (playerTop <= brickBottom && playerTop >= brickTop && intersectHorizontal){
          //console.log('ceiling')
          if(dy < 0) bounceLogicY(brick)
        }
        //hit the ground
        if (playerBottom >= brickTop && playerBottom <= brickBottom && intersectHorizontal){
          //console.log('floor')
          if(dy > 0) bounceLogicY(brick);
        }

        playerTop = player.y + dy;
        playerBottom = player.y + player.height2 + dy;

        let intersectVertical =
            (playerTop >= brickTop && playerTop <= brickBottom) || (playerBottom >= brickTop && playerBottom <= brickBottom) ||
            (brickTop >= playerTop && brickTop <= playerBottom) || (brickBottom >= playerTop && brickBottom <= playerBottom) ;
        //hit a wall on the right
        if (playerRight > brickLeft && playerRight < brickRight && intersectVertical) {
          if(dx > 0) bounceLogicX(brick);
        }
        //hit a wall on the left
        if (playerLeft <= brickRight && playerLeft >= brickLeft && intersectVertical) {
          if(dx < 0)  bounceLogicX(brick);
        }

        /*if(brick.deleted){
          //delete players[ players.indexOf(brick) ]
        }*/
    }

    if(xbounce && ybounce) dy = dy0;

    player.x += dx;
    player.y += dy;
    player.dx = dx;
    player.dy = dy;
  }

  function drawPlayers () {
    Object.keys(window.application.networkPlayers).forEach(function (k) {
      let p = window.application.networkPlayers[k];
      p.draw(p.x - camera.x, p.y - camera.y);
    });

    players.forEach(function (p) {
      if(p.dead) return;
      p.draw(p.x - camera.x, p.y - camera.y);
      //console.log("drawing player")
    });
  }

  function drawMissiles(){
    missiles.forEach(function (m) {
      m.draw(m.x - camera.x, m.y - camera.y);
      //console.log("drawing player")
    });
  }

  function drawMap () {
    bricks.forEach(function (b) {
      b.draw(b.x - camera.x, b.y - camera.y);
    });
  }

  function drawUi(ctx){
    var player = players[0];


    ctx.fillStyle = "#000000";
    ctx.fillRect(i * 20, 20, 150, 100);

    ctx.fillStyle = "#00FF00";

    for(var i = 0; i<player.hp; i++){
      ctx.fillRect(20 + i * 20, 20, 10, 20);
    }

    ctx.font = "30px Courier New";
    ctx.fillText(player.hp + " HP", 40 + 10 * 20, 40);
  }

  async function drawFrame () {
    let canvas = document.querySelector('rpg-application canvas');
    let context = canvas.getContext('2d');

    context.clearRect(0, 0, canvas.width, canvas.height);
    images.context = context;

    //drawBackground();
    drawMap();
    drawPlayers();
    drawMissiles();
    drawUi(context);

    window.requestAnimationFrame(drawFrame);

    return canvas;
  }

  drawFrame();
  await logicFrame();
  networkFrame();

  function dataCallback(data){
    //console.log("DATA CB", data)

    let path = data.path;

    let np = network_players[path];
    if(!np && data.value.id != myid){
      let wario = images.getImage('wario.png');

      np = new Sprite(wario, 480, 640, 48, 64, 380, 380);
      np.dx = 0;
      np.dy = 0;

      network_players[path] = np;
    }

    if(np) {
      np.x = data.value.x;
      np.y = data.value.y;
    }
  }

  return this;
}

module.exports = main();
