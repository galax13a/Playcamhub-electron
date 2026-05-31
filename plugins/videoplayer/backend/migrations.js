'use strict';

/**
 * Video Player plugin — migrations.
 * Tablas:
 *   - video_history          (un registro por video reproducido)
 *   - video_playlists        (listas de reproducción del usuario)
 *   - video_playlist_items   (ítems ordenados de una playlist)
 *
 * Las migraciones son idempotentes (CREATE IF NOT EXISTS + ALTER en try/catch).
 */

const log = require('electron-log');

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      title           TEXT NOT NULL,
      source          TEXT NOT NULL,                       -- url o file://path o blob:id
      source_type     TEXT NOT NULL DEFAULT 'url'
                        CHECK(source_type IN ('url','file','blob')),
      mime_type       TEXT,
      player_id       TEXT,                                -- id del reproductor en el que se vio
      started_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_position   REAL NOT NULL DEFAULT 0,             -- segundos
      duration        REAL,                                -- segundos
      user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at      DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_vp_hist_user_date ON video_history(user_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_vp_hist_source   ON video_history(source);

    CREATE TABLE IF NOT EXISTS video_playlists (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT DEFAULT '',
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at  DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_vp_playlists_user ON video_playlists(user_id);

    CREATE TABLE IF NOT EXISTS video_playlist_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id  INTEGER NOT NULL REFERENCES video_playlists(id) ON DELETE CASCADE,
      title        TEXT NOT NULL,
      source       TEXT NOT NULL,
      source_type  TEXT NOT NULL DEFAULT 'url'
                     CHECK(source_type IN ('url','file','blob')),
      position     INTEGER NOT NULL DEFAULT 0,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_vp_items_pl ON video_playlist_items(playlist_id, position);
  `);

  const safe = (sql) => { try { db.exec(sql); } catch (_) {} };
  // Idempotent column additions for upgrades
  safe('ALTER TABLE video_history ADD COLUMN player_id TEXT');
  safe('ALTER TABLE video_history ADD COLUMN duration REAL');
  safe('ALTER TABLE video_history ADD COLUMN deleted_at DATETIME');

  log.info('[videoplayer] migrations complete');
}

module.exports = { migrate };
