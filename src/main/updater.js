'use strict';

/**
 * updater.js — Auto-update manager using electron-updater.
 *
 * Only active in production builds. Checks for updates on startup and every
 * 4 hours. Sends the following IPC events to the main renderer window:
 *
 *   updater:checking          — started looking for a new release
 *   updater:update-available  — new version found, download starting
 *   updater:update-not-available — already on the latest version
 *   updater:download-progress — download progress { percent, transferred, total, bytesPerSecond }
 *   updater:update-downloaded — installer ready, waiting for user to install
 *   updater:error             — something went wrong (error message string)
 *
 * Renderer installs by sending the 'updater:install' IPC message (handled in ipcHandlers.js).
 */

const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const { getMainWindow } = require('./windowManager');

/** Send an IPC event to the main renderer window (no-op if window is gone). */
function _send(channel, payload) {
  getMainWindow()?.webContents.send(channel, payload);
}

function initUpdater() {
  // Route electron-updater logs through electron-log so they appear in the log file
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';

  // Download automatically in the background as soon as a new version is found
  autoUpdater.autoDownload = true;

  // Install the update when the user quits (safest default — no forced restart)
  autoUpdater.autoInstallOnAppQuit = true;

  // ── Events ──────────────────────────────────────────────────────────────────

  autoUpdater.on('checking-for-update', () => {
    log.info('[updater] Checking for updates…');
    _send('updater:checking', null);
  });

  autoUpdater.on('update-available', (info) => {
    log.info(`[updater] New version available: ${info.version}`);
    _send('updater:update-available', {
      version:     info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info(`[updater] Up to date: ${info.version}`);
    _send('updater:update-not-available', { version: info.version });
  });

  autoUpdater.on('download-progress', (prog) => {
    const pct = Math.round(prog.percent);
    log.debug(`[updater] Download progress: ${pct}%`);
    _send('updater:download-progress', {
      percent:        pct,
      transferred:    prog.transferred,
      total:          prog.total,
      bytesPerSecond: prog.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`[updater] Download complete: ${info.version} — ready to install`);
    _send('updater:update-downloaded', {
      version:      info.version,
      releaseDate:  info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('error', (err) => {
    log.error('[updater] Error:', err.message);
    _send('updater:error', err.message);
  });

  // ── Schedule ─────────────────────────────────────────────────────────────────

  // First check shortly after app is ready (give window time to render)
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000);

  // Then check every 4 hours
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);

  log.info('[updater] Auto-updater initialized');
}

module.exports = { initUpdater };
