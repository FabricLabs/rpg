'use strict';

const Service = require('@fabric/core/types/service');

/**
 * Optional HTTP gateway. Fabric playnet membership is {@link RPG} in
 * `types/rpg.js`; this client only runs when `gateway` is a host name.
 */
class Gateway extends Service {
  constructor (settings = {}) {
    super(Object.assign({
      networking: false,
      persistent: false
    }, settings));

    this.gateway = settings.gateway || settings.host || process.env.GATEWAY_HOST || null;
    this.remote = null;
    return this;
  }

  async start () {
    if (!this.gateway) return this;

    const Remote = require('@fabric/core/types/remote');
    this.remote = new Remote({
      host: this.gateway,
      secure: this.settings.secure !== false
    });

    return super.start();
  }

  async _broadcast (msg) {
    if (!this.remote) return null;
    this._lastMessage = msg;
    return this.remote._POST('/messages', msg);
  }

  async _listPlaces (count = 100) {
    if (!this.remote) return [];
    return this.remote._GET('/places', { limit: count });
  }

  async _listUsers (count = 100) {
    if (!this.remote) return [];
    return this.remote._GET('/authors', { limit: count });
  }

  async _sync () {
    const users = await this._listUsers();
    return users || [];
  }
}

module.exports = Gateway;
