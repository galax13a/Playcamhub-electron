'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

// Load .env variables before anything else
const _envPath = path.join(__dirname, '.env');
if (fs.existsSync(_envPath)) {
  fs.readFileSync(_envPath, 'utf8')
    .replace(/^﻿/, '')      // strip BOM
    .split(/\r?\n/)              // handle \r\n and \n
    .forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;  // skip empty lines and comments
      const idx = line.indexOf('=');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key && !process.env[key]) process.env[key] = val;
    });
}
const { createWindow, getMainWindow } = require('./src/main/windowManager');
const { registerIpcHandlers } = require('./src/main/ipcHandlers');
const { buildMenu } = require('./src/main/menuBuilder');
const { startServer } = require('./src/backend/server');

log.transports.file.level = 'info';
log.info('PlayRyu starting…', app.getVersion());

// Set App User Model ID so Windows taskbar shows the custom icon
app.setAppUserModelId(process.env.APP_ID || 'com.playryu.app');

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

const APP_PATHS = {
  userData:    path.join(app.getPath('userData'), 'PlayRyu'),
  music:       path.join(app.getPath('userData'), 'PlayRyu', 'music'),
  thumbnails:  path.join(app.getPath('userData'), 'PlayRyu', 'thumbnails'),
  bin:         path.join(app.getPath('userData'), 'PlayRyu', 'bin'),
  db:          path.join(app.getPath('userData'), 'PlayRyu', 'playryu.db'),
};

global.APP_PATHS = APP_PATHS;

let serverPort = parseInt(process.env.PORT) || 3847;

app.whenReady().then(async () => {
  // Ensure data directories exist
  ['userData', 'music', 'thumbnails', 'bin'].forEach(key => {
    fs.mkdirSync(APP_PATHS[key], { recursive: true });
  });

  // Start Express backend
  try {
    serverPort = await startServer(APP_PATHS, serverPort);
    log.info(`Backend listening on port ${serverPort}`);
  } catch (err) {
    log.error('Failed to start server:', err);
  }

  global.SERVER_PORT = serverPort;

  buildMenu();
  createWindow(serverPort);
  registerIpcHandlers(APP_PATHS, serverPort);

  // Init auto-updater only in production
  if (app.isPackaged) {
    const { initUpdater } = require('./src/main/updater');
    initUpdater();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(serverPort);
  });
});

app.on('second-instance', () => {
  const win = getMainWindow();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => log.info('PlayRyu shutting down'));
