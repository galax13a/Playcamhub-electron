'use strict';

const { Menu } = require('electron');

function buildMenu() {
  Menu.setApplicationMenu(null);
}

module.exports = { buildMenu };
