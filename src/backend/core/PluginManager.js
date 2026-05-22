'use strict';

const path = require('path');
const fs   = require('fs');
const log  = require('electron-log');

const PLUGINS_DIR = path.join(__dirname, '../../../plugins');

class PluginManager {
  constructor() {
    this._active = new Map(); // id -> { manifest, instance }
  }

  // ── Discovery ────────────────────────────────────────────────────────────

  discover() {
    if (!fs.existsSync(PLUGINS_DIR)) return [];
    return fs.readdirSync(PLUGINS_DIR)
      .filter(name => {
        const dir = path.join(PLUGINS_DIR, name);
        return fs.statSync(dir).isDirectory() &&
               fs.existsSync(path.join(dir, 'plugin.json'));
      })
      .map(name => {
        try {
          const manifest = JSON.parse(
            fs.readFileSync(path.join(PLUGINS_DIR, name, 'plugin.json'), 'utf8')
          );
          return { id: name, manifest, dir: path.join(PLUGINS_DIR, name) };
        } catch (_) { return null; }
      })
      .filter(Boolean);
  }

  // ── Activation (called once on server start) ─────────────────────────────

  activate(router, db, appPaths) {
    this._ensureTable(db);

    for (const { id, manifest, dir } of this.discover()) {
      // Register in DB on first sight (default: enabled)
      const row = db.prepare('SELECT enabled FROM plugins WHERE id = ?').get(id);
      if (!row) {
        db.prepare(
          'INSERT OR IGNORE INTO plugins (id, name, version, enabled) VALUES (?, ?, ?, 1)'
        ).run(id, manifest.name || id, manifest.version || '1.0.0');
      }

      const enabled = row ? row.enabled === 1 : true;
      if (!enabled) {
        log.info(`[plugins] "${id}" is disabled — skip`);
        continue;
      }

      const backendEntry = path.join(dir, 'backend', 'index.js');
      if (!fs.existsSync(backendEntry)) continue;

      try {
        const plugin = require(backendEntry);

        if (typeof plugin.migrate === 'function')   plugin.migrate(db);
        if (typeof plugin.register === 'function')  plugin.register(router, db, appPaths);

        this._active.set(id, { manifest, instance: plugin });
        log.info(`[plugins] "${manifest.name}" v${manifest.version} activated`);
      } catch (err) {
        log.error(`[plugins] Failed to activate "${id}":`, err.message);
      }
    }
  }

  // ── Public helpers (used by the plugins API route) ───────────────────────

  list(db) {
    this._ensureTable(db);
    return this.discover().map(({ id, manifest }) => {
      const row = db.prepare('SELECT enabled FROM plugins WHERE id = ?').get(id);
      return {
        id,
        name:        manifest.name        || id,
        version:     manifest.version     || '1.0.0',
        description: manifest.description || '',
        icon:        manifest.icon        || '🧩',
        color:       manifest.color       || '#8B5CF6',
        author:      manifest.author      || '',
        enabled:     row ? row.enabled === 1 : true,
        active:      this._active.has(id),
      };
    });
  }

  setEnabled(db, id, enabled) {
    this._ensureTable(db);
    db.prepare('INSERT OR IGNORE INTO plugins (id, name, version, enabled) VALUES (?, ?, ?, ?)')
      .run(id, id, '1.0.0', enabled ? 1 : 0);
    db.prepare('UPDATE plugins SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  _ensureTable(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS plugins (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        version      TEXT NOT NULL DEFAULT '1.0.0',
        enabled      INTEGER NOT NULL DEFAULT 1,
        installed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
}

module.exports = new PluginManager();
