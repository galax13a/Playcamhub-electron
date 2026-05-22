'use strict';

const express = require('express');
const cors    = require('cors');
const http    = require('http');
const log     = require('electron-log');

const { initDatabase, getDb } = require('./database/connection');
const pluginManager           = require('./core/PluginManager');

async function startServer(appPaths, preferredPort) {
  // 1. Init SQLite
  initDatabase(appPaths.db);
  const db = getDb();

  // 2. Build Express app
  const expressApp = express();
  expressApp.use(cors({ origin: '*' }));
  expressApp.use(express.json({ limit: '10mb' }));
  expressApp.use(express.urlencoded({ extended: true }));

  // Static assets
  expressApp.use('/music',      express.static(appPaths.music));
  expressApp.use('/thumbnails', express.static(appPaths.thumbnails));

  // App icon (used by mini player)
  const path = require('path');
  expressApp.get('/icon.png', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'assets', 'icons', 'icon.png'));
  });

  // Attach appPaths to every request
  expressApp.use((req, _res, next) => { req.appPaths = appPaths; next(); });

  // 3. Build API router (core routes only)
  const apiRouter = require('./routes/index');

  // 4. Activate all enabled plugins — they self-register onto apiRouter
  pluginManager.activate(apiRouter, db, appPaths);

  expressApp.use('/api', apiRouter);
  expressApp.get('/ping', (_req, res) => res.json({ ok: true, version: '1.0.0' }));

  // 5. Start listening
  const port   = await findPort(preferredPort);
  const server = http.createServer(expressApp);

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      log.info(`Starcho API running at http://127.0.0.1:${port}`);
      resolve(port);
    });
    server.on('error', reject);
  });
}

function findPort(start) {
  return new Promise((resolve) => {
    const srv = http.createServer();
    srv.listen(start, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', () => resolve(findPort(start + 1)));
  });
}

module.exports = { startServer };
