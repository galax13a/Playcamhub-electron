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

  // Attach appPaths and db to every request
  expressApp.set('db', db);
  expressApp.use((req, _res, next) => { req.appPaths = appPaths; next(); });

  // 3. Build API router (core routes only)
  const apiRouter = require('./routes/index');

  // 4. Activate all enabled plugins — they self-register onto apiRouter
  pluginManager.activate(apiRouter, db, appPaths);

  // 404 fallback for unknown API routes — must be added AFTER plugin activation
  apiRouter.use((req, res) => {
    log.warn(`[API] 404 Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `No route: ${req.method} ${req.path}` });
  });

  expressApp.use('/api', apiRouter);
  expressApp.get('/ping', (_req, res) => res.json({ ok: true, version: '1.0.0' }));

  // 5. Admin panel (served at /admin — SSR HTML, cookie auth)
  expressApp.use('/admin', require('./admin/router'));

  // Global error handler — catches any unhandled throw from route handlers
  // eslint-disable-next-line no-unused-vars
  expressApp.use((err, req, res, _next) => {
    log.error(`[API] 500 ${req.method} ${req.originalUrl}:`, err.message, err.stack);
    if (!res.headersSent) res.status(500).json({ error: err.message || 'Internal server error' });
  });

  // 6. Start listening
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
