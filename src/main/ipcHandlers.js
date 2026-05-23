'use strict';

const { ipcMain, app, shell, Notification } = require('electron');
const { getMainWindow, createMiniPlayerWindow, getMiniPlayerWindow } = require('./windowManager');
const { IS_DEV } = require('./env');
const log = require('electron-log');
const fs   = require('fs');
const path = require('path');

function registerIpcHandlers(appPaths, serverPort) {

  // ── App info ──────────────────────────────────────────────────────────────
  ipcMain.handle('app:get-server-port', () => serverPort);
  ipcMain.handle('app:get-version',     () => app.getVersion());
  ipcMain.handle('app:get-paths',       () => appPaths);
  ipcMain.handle('app:is-dev',          () => IS_DEV);

  // ── Error log ─────────────────────────────────────────────────────────────
  const logPath = path.join(app.getPath('userData'), 'errors.log');

  ipcMain.on('log:write', (_event, msg) => {
    try {
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`, 'utf8');
    } catch (_) {}
  });

  ipcMain.handle('log:read', () => {
    try { return fs.readFileSync(logPath, 'utf8'); } catch (_) { return ''; }
  });

  ipcMain.handle('log:clear', () => {
    try { fs.writeFileSync(logPath, '', 'utf8'); } catch (_) {}
  });

  // ── System performance stats ──────────────────────────────────────────────
  // Returns { cpu, memory, disk } sampled over a 300 ms window.
  ipcMain.handle('system:stats', async () => {
    const os = require('os');

    // Sample CPU tick counters before and after a short delay
    const snap = () => os.cpus().map(c => ({ ...c.times }));
    const before = snap();
    await new Promise(r => setTimeout(r, 300));
    const after  = snap();

    let totalDiff = 0, idleDiff = 0;
    before.forEach((b, i) => {
      const a = after[i];
      const total = (a.user - b.user) + (a.nice - b.nice) + (a.sys - b.sys) + (a.idle - b.idle);
      totalDiff += total;
      idleDiff  += (a.idle - b.idle);
    });
    const cpuPercent = totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 100) : 0;

    // Memory from OS (total physical RAM)
    const totalMem   = os.totalmem();
    const freeMem    = os.freemem();
    const usedMem    = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);

    // Disk space via fs.statfs (Node 18.15+)
    let disk = null;
    try {
      const diskPath = process.platform === 'win32'
        ? (process.env.SYSTEMDRIVE || 'C:') + '\\'
        : '/';
      const stat = await fs.promises.statfs(diskPath);
      const diskTotal = stat.bsize * stat.blocks;
      const diskFree  = stat.bsize * stat.bavail;
      const diskUsed  = diskTotal - diskFree;
      disk = { total: diskTotal, used: diskUsed, free: diskFree, percent: Math.round((diskUsed / diskTotal) * 100) };
    } catch (_) {}

    return {
      cpu:    cpuPercent,
      memory: { total: totalMem, used: usedMem, percent: memPercent },
      disk,
    };
  });

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
  // Install the already-downloaded update and restart
  ipcMain.on('updater:install', () => {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.quitAndInstall();
  });

  // Manual update check triggered from the renderer (e.g. Settings page)
  ipcMain.on('updater:check', () => {
    if (!IS_DEV) {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        log.error('[updater] Manual check failed:', err.message);
      });
    }
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
