'use strict';

const { BrowserWindow, screen, app } = require('electron');
const path = require('path');
const log = require('electron-log');

let mainWindow   = null;
let miniPlayerWin = null;

function createWindow(serverPort) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width:     Math.min(1400, width - 80),
    height:    Math.min(900,  height - 80),
    minWidth:  960,
    minHeight: 620,
    frame:          false,
    titleBarStyle:  'hidden',
    backgroundColor: '#0A0A0A',
    show: false,
    webPreferences: {
      preload:          path.join(__dirname, '..', '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
      webSecurity:      true,
    },
    icon: path.join(__dirname, '..', '..', 'assets', 'icons', 'icon.png'),
  });

  // Load renderer HTML as a file (no network needed for app shell)
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Open DevTools immediately in dev mode — before ready-to-show so it's always visible
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // F12 toggles DevTools at any time
  mainWindow.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      mainWindow.webContents.isDevToolsOpened()
        ? mainWindow.webContents.closeDevTools()
        : mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('maximize',   () => mainWindow.webContents.send('window:maximized',   true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized',   false));
  mainWindow.on('closed',     () => { mainWindow = null; });

  log.info('Main window created');
  return mainWindow;
}

function getMainWindow() { return mainWindow; }

function createMiniPlayerWindow() {
  if (miniPlayerWin && !miniPlayerWin.isDestroyed()) {
    miniPlayerWin.focus();
    return miniPlayerWin;
  }

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  miniPlayerWin = new BrowserWindow({
    width:       340,
    height:      420,
    minWidth:    300,
    minHeight:   360,
    maxWidth:    520,
    maxHeight:   620,
    x:           sw - 360,
    y:           sh - 450,
    frame:       false,
    transparent: false,
    resizable:   true,
    movable:     true,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#111114',
    show: false,
    webPreferences: {
      preload:          path.join(__dirname, '..', '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
      webSecurity:      true,
    },
    icon: path.join(__dirname, '..', '..', 'assets', 'icons', 'icon.png'),
  });

  miniPlayerWin.loadFile(path.join(__dirname, '..', 'renderer', 'mini-player.html'));

  miniPlayerWin.once('ready-to-show', () => miniPlayerWin.show());

  miniPlayerWin.on('closed', () => {
    miniPlayerWin = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mini-player:closed');
    }
  });

  log.info('Mini-player window created');
  return miniPlayerWin;
}

function getMiniPlayerWindow() { return miniPlayerWin; }

module.exports = { createWindow, getMainWindow, createMiniPlayerWindow, getMiniPlayerWindow };
