'use strict';

class Element {
  constructor (data) {
    this['@data'] = document.createElement('rpg-element');
    this.binding = document;
  }

  attach (element) {
    this.binding = element;
  }

  draw () {
    this.binding.appendChild(this['@data']);
  }
}

module.exports = Element;
