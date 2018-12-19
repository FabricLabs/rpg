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

  let ui = await UI();

  console.log('[FABRIC]', 'ui:', ui);
}

async function UI () {
  let userid = null;
  let copycat_mode = false;
  let default_walk_speed = 5;
  let default_jump_speed = 25;

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
    images:   {},
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
    preload:  function (sources, cb) {
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
      if (turned) {
        //this.context.save();
        //    this.context.translate(width2, 0);
        //  this.context.scale(-1, 1);
      } if (width2 && height2) {
        this.context.drawImage(img, left, top, width, height, x, y, width2, height2);
      } else {
        this.context.drawImage(img, left, top, width, height, x, y, width, height);
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
    height:768,
    padding: 500,
    padding2: 300
  };

  let scrollspeed = 20;
  let gravity = .98;
  let bricks = [];
  let players = [];
  let network_players = {};
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

  function logicFrame () {
    // update players position,
    // listen for collisions etc
    let player = players[0];

    runPhysics(player, true);
    scrollCamera(player);

    player.history.push({
      x: player.x,
      y: player.y,
      z: 1
    });

    Object.keys(network_players).forEach(function (k) {
      let p = network_players[k];
      //p.x += p.dx;
      //p.y += p.dy;
      runPhysics(p);
    });

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

    // process the game logic at a target of 60fps
    setTimeout(logicFrame, 1000/60);

    for (let n = 1; n < players.length; n++) {
      let npc = players[n];
      npc.x += -10  +  20 * Math.random();
      npc.y += -10  +  20 * Math.random();
    }
  }


  function loadMap () {
    //starting area
    /*let brick = images.getImage("brick.jpg");
    for(let i=0; i<30; i++){
        bricks.push(new Sprite(brick, 512, 512, 50, 50, i*50, 600));
    }*/
    let grass = images.getImage('grass.jpg');

    for (let j = 0; j< 50; j++) {
      for (let i = 0; i < 30; i++) {
        let tile = new Sprite(grass, 100, 100, 50, 50, i * 50, j * 50)
        tile.bg = true;
        bricks.push(tile);
      }
    }

    let wall = images.getImage('brick.png');

    for (let i = 1; i < 20; i++) { bricks.push(new Sprite(wall, 200, 200, 50, 50, i * 50, 1 * 50)); }
    for (let i = 1; i < 15; i++) { bricks.push(new Sprite(wall, 200, 200, 50, 50, i * 50, 12 * 50)); }
    for (let i = 1; i < 20; i++) { bricks.push(new Sprite(wall, 200, 200, 50, 50, 18 * 50, i * 50)); }
  }



  function loadPlayers () {
    let mario = images.getImage('mario.png');

    player = new Sprite(mario, 480, 640, 48, 64, 380, 380);
    player.dx = 0;
    player.dy = 0;
    player.walkspeed = default_walk_speed;
    player.jumpspeed = default_jump_speed;
    player.history = [];

    players = [player];

    if (copycat_mode) {
      let luigi = images.getImage('luigi.png');
      let player2 = new Sprite(luigi, 480, 640, 48, 64, 20, 300);
      players.push(player2);
    }

    for(let i = 0; i<7; i++) {
      let goomba = images.getImage('goomba.png');
      let player3 = new Sprite(goomba, 900, 900, 48, 64, i * 200, i * 200 + 100);

      player3.dx = 0;  player3.x0 = player3.x; player3.y0 = player3.y;
      player3.dy = 0;
      player3.walkspeed = default_walk_speed;
      player3.jumpspeed = default_jump_speed;
      player3.history = [];
      players.push(player3);
    }
  }

  loadMap();
  loadPlayers();

  function runPhysics (player, processKeys) {
    let dx = player.dx = processKeys ? 0 : player.dx;
    let dy = player.dy = processKeys ? 0 : player.dy;
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
        player.turned = true;
        dy = -walkspeed;
      }
      if (keys.down.down) {
        player.turned = false;
        dy = walkspeed;
      }

      /*if(keys.space.down){
          if(dy == 0){
              dy = -jumpspeed;
          }
      }*/
    }
    //dy += gravity;
    for (let i = 0; i < bricks.length; i++) {
        let brick = bricks[i];

        if (brick.bg) continue;

        let brickLeft = brick.x;
        let brickRight = brick.x + brick.width2;
        let brickTop = brick.y;
        let brickBottom = brick.y + brick.height2;
        let playerLeft = player.x + dx;
        let playerRight = player.x + player.width2 + dx;
        let playerTop = player.y + dy;
        let playerBottom = player.y + player.height2 + dy;
        let intersectHorizontal =
            (playerLeft >= brickLeft && playerLeft <= brickRight) || (playerLeft >= brickLeft && playerRight <= brickRight) ||
            (brickLeft >= playerLeft && brickLeft <= playerRight) || (brickRight >= playerLeft && brickRight <= playerRight)  ;

        //hit the ground
        if (playerBottom >= brickTop && playerBottom <= brickBottom && intersectHorizontal){
          if (dy > 0) {
            dy = 0;
          }
        }

        //hit the ceiling
        if (playerTop <= brickBottom && playerTop >= brickTop && intersectHorizontal){
          if (dy < 0){
            dy = 0.01;
          }
        }

        playerTop = player.y + dy;
        playerBottom = player.y + player.height2 + dy;

        let intersectVertical =
            (playerTop >= brickTop && playerTop <= brickBottom) || (playerBottom >= brickTop && playerBottom <= brickBottom) ||
            (brickTop >= playerTop && brickTop <= playerBottom) || (brickBottom >= playerTop && brickBottom <= playerBottom) ;
        //hit a wall on the right
        if (playerRight > brickLeft && playerRight < brickRight && intersectVertical) {
          dx = 0;
        }
        //hit a wall on the left
        if (playerLeft <= brickRight && playerLeft >= brickLeft && intersectVertical) {
          dx = 0;
        }
    }

    player.x += dx;
    player.y += dy;
    player.dx = dx;
    player.dy = dy;
  }

  function drawPlayers () {
    Object.keys(network_players).forEach(function (k) {
      let p = network_players[k];
      p.draw(p.x - camera.x, p.y - camera.y);
    });

    players.forEach(function (p) {
      p.draw(p.x - camera.x, p.y - camera.y);
      //console.log("drawing player")
    });
  }

  function drawMap () {
    bricks.forEach(function (b) {
      b.draw(b.x - camera.x, b.y - camera.y);
    });
  }

  function drawFrame () {
    let canvas = document.getElementById('canvas');
    let context = canvas.getContext('2d');

    context.clearRect(0, 0, canvas.width, canvas.height);
    images.context = context;

    //drawBackground();
    drawMap();
    drawPlayers();

    window.requestAnimationFrame(drawFrame);
  }

  drawFrame();
  logicFrame();

  // Get the canvas element form the page
  let canvas = document.querySelector('canvas');

  function fullscreen () {
    let el = document.getElementById('canvas');

    if (el.webkitRequestFullScreen) {
      el.webkitRequestFullScreen();
    } else {
     el.mozRequestFullScreen();
    }
  }

  canvas.addEventListener('click', fullscreen);

  return canvas;
}

module.exports = main();
