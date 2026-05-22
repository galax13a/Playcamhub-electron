'use strict';

// All music-related tables owned by the starcho plugin.
// Called once by PluginManager before routes are registered.

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      color      TEXT NOT NULL DEFAULT '#8B5CF6',
      icon       TEXT NOT NULL DEFAULT '🎵',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS songs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT    NOT NULL,
      artist       TEXT    NOT NULL DEFAULT 'Unknown',
      album        TEXT    NOT NULL DEFAULT 'Unknown',
      duration     INTEGER NOT NULL DEFAULT 0,
      file_path    TEXT    UNIQUE,
      thumbnail    TEXT,
      youtube_url  TEXT,
      youtube_id   TEXT    UNIQUE,
      category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      is_favorite  INTEGER NOT NULL DEFAULT 0,
      play_count   INTEGER NOT NULL DEFAULT 0,
      type         TEXT    NOT NULL DEFAULT 'audio',
      notes        TEXT    DEFAULT '',
      added_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      cover       TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS playlist_songs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL REFERENCES playlists(id)  ON DELETE CASCADE,
      song_id     INTEGER NOT NULL REFERENCES songs(id)      ON DELETE CASCADE,
      position    INTEGER NOT NULL DEFAULT 0,
      added_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (playlist_id, song_id)
    );

    CREATE TABLE IF NOT EXISTS download_queue (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      youtube_url  TEXT    NOT NULL,
      youtube_id   TEXT,
      title        TEXT    NOT NULL DEFAULT 'Unknown',
      thumbnail    TEXT,
      format       TEXT    NOT NULL DEFAULT 'audio',
      quality      TEXT    NOT NULL DEFAULT 'best',
      batch_id     TEXT,
      status       TEXT    NOT NULL DEFAULT 'pending',
      progress     INTEGER NOT NULL DEFAULT 0,
      error_msg    TEXT,
      song_id      INTEGER REFERENCES songs(id) ON DELETE SET NULL,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at  DATETIME
    );

    CREATE TABLE IF NOT EXISTS history (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id   INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_history_played_at ON history(played_at DESC);
  `);

  // Idempotent column additions for upgrades
  const safe = (sql) => { try { db.exec(sql); } catch (_) {} };
  safe("ALTER TABLE songs ADD COLUMN type  TEXT NOT NULL DEFAULT 'audio'");
  safe("ALTER TABLE songs ADD COLUMN notes TEXT DEFAULT ''");
  safe("ALTER TABLE download_queue ADD COLUMN format   TEXT NOT NULL DEFAULT 'audio'");
  safe("ALTER TABLE download_queue ADD COLUMN quality  TEXT NOT NULL DEFAULT 'best'");
  safe("ALTER TABLE download_queue ADD COLUMN batch_id TEXT");

  // Seed default categories
  const cats = [
    ['Pop',       '#FF3366', '🎤'],
    ['Rock',      '#FF6B35', '🎸'],
    ['Hip-Hop',   '#8B5CF6', '🎤'],
    ['Electronic','#06D6A0', '🎛'],
    ['Jazz',      '#FFD166', '🎷'],
    ['Classical', '#4CC9F0', '🎻'],
    ['Reggaeton', '#F72585', '💃'],
    ['Lo-Fi',     '#7B8CDE', '🌙'],
  ];
  const ins = db.prepare('INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)');
  cats.forEach(([n, c, i]) => ins.run(n, c, i));

  db.prepare(`INSERT OR IGNORE INTO playlists (id, name, description) VALUES (1, 'Favorites', 'Your liked songs')`).run();
}

module.exports = { migrate };
