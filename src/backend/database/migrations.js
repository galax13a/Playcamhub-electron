'use strict';

const crypto = require('crypto');
const log = require('electron-log');
const { runVersionedMigrations } = require('./migrationRunner');

function hashPw(pw) {
  return crypto
    .createHash('sha256')
    .update(pw + 'starcho-local-salt')
    .digest('hex');
}

// ── Ordered, versioned migrations ─────────────────────────────────────────────
// Each entry runs once and is recorded in `schema_version`. Keep every step
// idempotent so databases created before version tracking can be replayed safely.
const MIGRATIONS = [
  {
    version: 1,
    name: 'core_tables',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key        TEXT PRIMARY KEY,
          value      TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          username   TEXT UNIQUE NOT NULL,
          password   TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS plugins (
          id           TEXT PRIMARY KEY,
          name         TEXT NOT NULL,
          version      TEXT NOT NULL DEFAULT '1.0.0',
          enabled      INTEGER NOT NULL DEFAULT 1,
          installed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS app_sessions (
          token      TEXT PRIMARY KEY,
          username   TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
  {
    version: 2,
    name: 'user_profile_and_auth_columns',
    up(db) {
      const safe = (sql) => {
        try {
          db.exec(sql);
        } catch (_) {
          /* column already exists */
        }
      };

      // Legacy profile fields (kept for Settings UI backward compat)
      safe("ALTER TABLE users ADD COLUMN full_name TEXT NOT NULL DEFAULT ''");
      safe("ALTER TABLE users ADD COLUMN nickname  TEXT NOT NULL DEFAULT ''");
      safe('ALTER TABLE users ADD COLUMN whatsapp  TEXT');
      safe('ALTER TABLE users ADD COLUMN avatar    TEXT');

      // New fields matching Laravel schema
      safe("ALTER TABLE users ADD COLUMN name                      TEXT NOT NULL DEFAULT ''");
      safe('ALTER TABLE users ADD COLUMN email                     TEXT');
      safe('ALTER TABLE users ADD COLUMN google_id                 TEXT');
      safe('ALTER TABLE users ADD COLUMN email_verified_at         DATETIME');
      safe('ALTER TABLE users ADD COLUMN whatsapp_verified_at      DATETIME');
      safe('ALTER TABLE users ADD COLUMN two_factor_secret         TEXT');
      safe('ALTER TABLE users ADD COLUMN two_factor_recovery_codes TEXT');
      safe('ALTER TABLE users ADD COLUMN two_factor_confirmed_at   DATETIME');
      safe('ALTER TABLE users ADD COLUMN remember_token            TEXT');
      safe("ALTER TABLE users ADD COLUMN locale                    TEXT DEFAULT 'es'");
      safe("ALTER TABLE users ADD COLUMN subscription_level        TEXT NOT NULL DEFAULT 'free'");
      safe('ALTER TABLE users ADD COLUMN is_banned                 INTEGER NOT NULL DEFAULT 0');
      safe('ALTER TABLE users ADD COLUMN banned_until              DATETIME');
      safe('ALTER TABLE users ADD COLUMN ban_reason                TEXT');
      safe('ALTER TABLE users ADD COLUMN updated_at                DATETIME');

      // Media editor state (the media table is created by the starcho plugin;
      // guarded so this is a no-op when the table is not present yet)
      safe('ALTER TABLE media ADD COLUMN editor_state TEXT');

      // Backfill: email = username, name = full_name where missing
      safe('UPDATE users SET email = username WHERE email IS NULL');
      safe(
        "UPDATE users SET name = full_name WHERE (name IS NULL OR name = '') AND full_name != ''"
      );
    },
  },
  {
    version: 3,
    name: 'default_settings_and_demo_user',
    up(db) {
      const defaults = [
        ['theme', 'dark'],
        ['volume', '80'],
        ['auto_play', 'true'],
        ['language', 'es'],
        ['login_theme', 'nebula'],
        ['session_ttl_days', '30'],
        ['ai_provider', 'openai'],
        ['ai_openai_key', ''],
        ['ai_openai_model', 'dall-e-2'],
        ['ai_stability_key', ''],
        ['ai_stability_model', 'stable-diffusion-xl-1024-v1-0'],
        ['ai_replicate_key', ''],
        ['ai_replicate_model', 'black-forest-labs/flux-dev'],
        // Login side panel branding
        ['login_side_title', 'PlaycamHub Studio'],
        [
          'login_side_sub',
          'Plataforma de desarrollo ágil para aplicaciones de escritorio',
        ],
        [
          'login_side_features',
          '["Sistema de plugins modular","Base de datos SQLite integrada","Multi-idioma y 10+ temas","Reproductor de medios completo"]',
        ],
        ['login_side_badge', 'Beta 1.0.2 — Acceso restringido'],
        ['login_logo_svg', ''],
      ];
      const upsert = db.prepare(
        'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
      );
      defaults.forEach(([k, v]) => upsert.run(k, v));

      // Seed demo user
      db.prepare(
        'INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)'
      ).run('demo@starcho.com', hashPw('123456'));
    },
  },
];

function runMigrations(db) {
  const applied = runVersionedMigrations(db, MIGRATIONS, (msg) => log.info(msg));
  log.info(
    `Core database migrations complete (${applied.length} applied this run)`
  );
  return applied;
}

module.exports = { runMigrations, MIGRATIONS, hashPw };
