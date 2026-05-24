'use strict';

// All multimedia-related tables owned by the starcho (MediaHub) plugin.
// Supports photos, videos, albums, editing history and metadata.
// Called once by PluginManager before routes are registered.

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS albums (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT DEFAULT '',
      cover_id    INTEGER REFERENCES media(id) ON DELETE SET NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS media (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name       TEXT NOT NULL,
      file_path       TEXT UNIQUE NOT NULL,
      file_size       INTEGER NOT NULL DEFAULT 0,
      mime_type       TEXT NOT NULL,
      media_type      TEXT NOT NULL CHECK(media_type IN ('photo', 'video')),
      width           INTEGER,
      height          INTEGER,
      duration        INTEGER,
      original_format TEXT,
      compressed_format TEXT DEFAULT 'webp',
      thumbnail_path  TEXT,
      album_id        INTEGER REFERENCES albums(id) ON DELETE SET NULL,
      is_favorite     INTEGER NOT NULL DEFAULT 0,
      view_count      INTEGER NOT NULL DEFAULT 0,
      tags            TEXT DEFAULT '[]',
      metadata        TEXT DEFAULT '{}',
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS media_edits (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      media_id        INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
      edit_type       TEXT NOT NULL CHECK(edit_type IN ('rotate', 'resize', 'crop', 'compress')),
      original_path   TEXT,
      edited_path     TEXT,
      parameters      TEXT,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS media_favorites (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      media_id  INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
      favorited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (media_id)
    );

    CREATE INDEX IF NOT EXISTS idx_media_album ON media(album_id);
    CREATE INDEX IF NOT EXISTS idx_media_type ON media(media_type);
    CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_media_edits_media ON media_edits(media_id);
  `);

  // Idempotent column additions for upgrades
  const safe = (sql) => { try { db.exec(sql); } catch (_) {} };
  safe("ALTER TABLE media ADD COLUMN compressed_format TEXT DEFAULT 'webp'");
  safe("ALTER TABLE media ADD COLUMN thumbnail_path TEXT");

  // MediaHub v2 — media enrichment
  safe("ALTER TABLE media ADD COLUMN title TEXT DEFAULT ''");
  safe("ALTER TABLE media ADD COLUMN description TEXT DEFAULT ''");
  safe("ALTER TABLE media ADD COLUMN likes INTEGER DEFAULT 0");
  safe("ALTER TABLE media ADD COLUMN rating REAL DEFAULT 0");
  safe("ALTER TABLE media ADD COLUMN rating_count INTEGER DEFAULT 0");

  // MediaHub v2 — album metadata
  safe("ALTER TABLE albums ADD COLUMN tag TEXT DEFAULT 'free'");
  safe("ALTER TABLE albums ADD COLUMN color TEXT DEFAULT '#1DB954'");
  safe("ALTER TABLE albums ADD COLUMN importance INTEGER DEFAULT 1");
  safe("ALTER TABLE albums ADD COLUMN objective TEXT DEFAULT ''");
  safe("ALTER TABLE albums ADD COLUMN price REAL DEFAULT 0");
  safe("ALTER TABLE albums ADD COLUMN currency TEXT DEFAULT 'usd'");
  safe("ALTER TABLE albums ADD COLUMN payment_method TEXT DEFAULT ''");
  safe("ALTER TABLE albums ADD COLUMN view_count INTEGER DEFAULT 0");

  // MediaHub v3 — comments + album favorites
  safe(`
    CREATE TABLE IF NOT EXISTS comments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('media','album')),
      entity_id   INTEGER NOT NULL,
      text        TEXT NOT NULL,
      author      TEXT DEFAULT 'Usuario',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  safe('CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id)');
  safe("ALTER TABLE albums ADD COLUMN is_favorite INTEGER DEFAULT 0");

  // Seed default album
  db.prepare(`INSERT OR IGNORE INTO albums (id, name, description) VALUES (1, 'Uncategorized', 'Media without album')`).run();
}

module.exports = { migrate };
