'use strict';

const Fabric = require('@fabric/core');
const RPG = require('../lib/rpg');

const Authority = require('./authority');
const Canvas = require('./canvas');

/**
 * Primary Application Definition
 * @property {Object} rpg Instance of the RPG engine.
 */
class Application extends Fabric.App {
  /**
   * Create an instance of the RPG client.
   * @param  {Object} [configuration={}] Key/value map of configuration options.
   * @return {Application}               Instance of our {@link Application}.
   */
  constructor (configuration = {}) {
    super(configuration);

    // An authority is required when running in a browser.
    this.authority = null;

    this['@data'] = Object.assign({
      authority: 'rpg.fabric.pub',
      canvas: {
        height: 768,
        width: 1024
      }
    }, configuration);

    this.rpg = new RPG(configuration);
    this.trust(this.rpg);

    return this;
  }

  _handleMessage (msg) {
    //console.log('message from authority:', msg);

    let data = msg.data;

    if(data){
      let parsed = JSON.parse(data);

      //console.log("DATA",parsed);

      let atdata = parsed['@data'];

      if(atdata){
        if(typeof atdata == 'string') atdata = JSON.parse(atdata);

        //console.log("@DATA", atdata)

        if(atdata['@type'] == 'PATCH'){
          var patch = atdata['@data'];
          //console.log("player", patch.path);
          //console.log("new pos", patch.value);

          //console.log("YOU PLAYER", patch)

          if(this.dataCallback){
            this.dataCallback(patch);
          }
        }else{
          if(this.dataCallback && atdata.value){
            //console.log("OTHER PLAYER", atdata)
            this.dataCallback(atdata);
          }
        }
      }
    }
  }

  async _createCharacter () {
    // TODO: async generation
    let key = new Fabric.Key();
    let struct = {
      address: key.address,
      private: key.private.toString('hex'),
      public: key.public
    };

    console.log('key:', key);
    console.log('private:', key.private);

    let vector = new Fabric.State(struct);
    let result = await this.stash._PUT(`/identities/${key.address}`, struct);
    let item = await this.stash._POST(`/identities`, vector['@id']);

    console.log('saved key:', result);
    console.log('collection put:', item);
  }

  async _requestName () {
    let name = prompt('What is your name?');
    let player = {
      name: name
    };

    this.authority.post(`/players`, player);

    player.id = key.address;

    this.player = player;

    console.log('id', this.player.id)

    return this;
  }

  async _restorePlayer () {
    let identities = null;

    try {
      identities = await this.stash._GET(`/identities`);
    } catch (E) {
      console.error('Could not load history:', E);
    }

    console.log('identities:', identities);
  }

  _updatePosition(x, y, z){
    if(!this.player) return;
    this.authority.patch(`/players/${this.player.id}`, {id:this.player.id, x:x, y:y, z:z});
  }

  _toggleFullscreen () {
    if (this.element.webkitRequestFullScreen) {
      this.element.webkitRequestFullScreen();
    }
  }

  _onData (fn) {
    this.dataCallback = fn;
  }

  /**
   * Get the output of our program.
   * @return {String}           Output of the program.
   */
  render () {
    let canvas = new Canvas({
      height: this.config.height,
      width: this.config.width
    });

    // let drawn = canvas.draw();
    let content = canvas.render();
    let state = new Fabric.State(content);
    let rendered = `<rpg-application integrity="sha256:${state.id}">${canvas.render()}</rpg-application><rpg-debugger data-bind="${state.id}" />`;
    let sample = new Fabric.State(rendered);

    if (this.element) {
      this.element.setAttribute('integrity', `sha256:${sample.id}`);
      this.element.innerHTML = rendered;
    }

    canvas.envelop('rpg-application canvas');

    return rendered;
  }

  async start () {
    this.log('[APP]', 'Starting...');

    try {
      await this.rpg.start();
    } catch (E) {
      this.error('Could not start RPG:', E);
      return null;
    }

    let identities = await this._restorePlayer();
    console.log('identities (in start):', identities);

    try {
      this.authority = new Authority();
      this.authority.on('message', this._handleMessage.bind(this));
      // this.authority.on('changes', this._handleChanges.bind(this));
      this.authority._connect();
    } catch (E) {
      this.error('Could not establish connection to authority:', E);
    }

    this.log('[APP]', 'Started!');
    this.log('[APP]', 'State:', this.authority);

    return this;
  }
}

module.exports = Application;
