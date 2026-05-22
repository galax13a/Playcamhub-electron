'use strict';

const { ipcMain, app, shell, Notification } = require('electron');
const { getMainWindow, createMiniPlayerWindow, getMiniPlayerWindow } = require('./windowManager');

function registerIpcHandlers(appPaths, serverPort) {

  // ── App info ──────────────────────────────────────────────────────────────
  ipcMain.handle('app:get-server-port', () => serverPort);
  ipcMain.handle('app:get-version',     () => app.getVersion());
  ipcMain.handle('app:get-paths',       () => appPaths);

  // ── Window controls ───────────────────────────────────────────────────────
  ipcMain.on('window:minimize', () => {
    const win = getMainWindow();
    if (win) win.minimize();
  });

  ipcMain.on('window:maximize', () => {
    const win = getMainWindow();
    if (!win) return;
    win.isMaximized() ? win.unmaximize() : win.maximize();
  });

  ipcMain.on('window:close', () => {
    const win = getMainWindow();
    if (win) win.close();
  });

  ipcMain.handle('window:is-maximized', () => {
    const win = getMainWindow();
    return win ? win.isMaximized() : false;
  });

  // ── Theme ─────────────────────────────────────────────────────────────────
  ipcMain.on('app:set-theme', (_event, theme) => {
    const win = getMainWindow();
    if (win) win.webContents.send('app:theme-changed', theme);
  });

  // ── System notification ───────────────────────────────────────────────────
  ipcMain.on('app:notification', (_event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  // ── Open external URL ─────────────────────────────────────────────────────
  ipcMain.on('app:open-external', (_event, url) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
  });

  // ── App restart ───────────────────────────────────────────────────────────
  ipcMain.on('app:restart', () => {
    app.relaunch();
    app.exit(0);
  });

  // ── Updater ───────────────────────────────────────────────────────────────
  ipcMain.on('updater:install', () => {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.quitAndInstall();
  });

  // ── Mini player ───────────────────────────────────────────────────────────
  ipcMain.on('mini-player:open', () => {
    createMiniPlayerWindow();
  });

  ipcMain.on('mini-player:close', () => {
    const win = getMiniPlayerWindow();
    if (win && !win.isDestroyed()) win.close();
  });

  // Main renderer → broadcast player state to mini-player window
  ipcMain.on('mini-player:state-update', (_event, state) => {
    const win = getMiniPlayerWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('mini-player:state', state);
    }
  });

  // Mini-player control command → forward to main renderer
  ipcMain.on('mini-player:control', (_event, action, value) => {
    const main = getMainWindow();
    if (main && !main.isDestroyed()) {
      main.webContents.send('mini-player:control', action, value);
    }
  });

  // ── Mini player resize ────────────────────────────────────────────────────
  ipcMain.on('mini-player:resize', (_event, w, h) => {
    const win = getMiniPlayerWindow();
    if (win && !win.isDestroyed()) {
      win.setResizable(true);
      win.setMovable(true);
      win.setSize(w, h, true);
    }
  });

  // ── Mini player footer mode (full-width, pinned at bottom) ────────────────
  ipcMain.on('mini-player:set-footer', () => {
    const win = getMiniPlayerWindow();
    if (!win || win.isDestroyed()) return;
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    win.setResizable(true);
    win.setMovable(true);
    win.setSize(sw, 196, true);
    win.setPosition(0, sh - 196, true);
    win.setResizable(false);
    win.setMovable(false);
  });

  ipcMain.on('mini-player:exit-footer', () => {
    const win = getMiniPlayerWindow();
    if (!win || win.isDestroyed()) return;
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    win.setResizable(true);
    win.setMovable(true);
    win.setSize(330, 200, true);
    win.setPosition(sw - 350, sh - 220, true);
  });

  // ── Self minimize (mini player window minimizes itself) ───────────────────
  const { BrowserWindow } = require('electron');
  ipcMain.on('self:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });
}

module.exports = { registerIpcHandlers };
