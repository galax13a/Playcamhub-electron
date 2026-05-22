'use strict';

const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const { getMainWindow } = require('./windowManager');

function initUpdater() {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version);
    getMainWindow()?.webContents.send('updater:update-available', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version);
    getMainWindow()?.webContents.send('updater:update-downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    log.error('Updater error:', err);
  });

  // Check immediately and then every 4 hours
  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
}

module.exports = { initUpdater };
