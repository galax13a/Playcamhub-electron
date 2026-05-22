'use strict';

const crypto = require('crypto');
const log    = require('electron-log');

function hashPw(pw) {
  return crypto.createHash('sha256').update(pw + 'starcho-local-salt').digest('hex');
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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
  `);

  // ── Idempotent column additions ────────────────────────────────────────────
  const safe = (sql) => { try { db.exec(sql); } catch (_) {} };

  // Legacy profile fields (kept for Settings UI backward compat)
  safe("ALTER TABLE users ADD COLUMN full_name TEXT NOT NULL DEFAULT ''");
  safe("ALTER TABLE users ADD COLUMN nickname  TEXT NOT NULL DEFAULT ''");
  safe("ALTER TABLE users ADD COLUMN whatsapp  TEXT");
  safe("ALTER TABLE users ADD COLUMN avatar    TEXT");

  // New fields matching Laravel schema
  safe("ALTER TABLE users ADD COLUMN name                      TEXT NOT NULL DEFAULT ''");
  safe("ALTER TABLE users ADD COLUMN email                     TEXT");
  safe("ALTER TABLE users ADD COLUMN google_id                 TEXT");
  safe("ALTER TABLE users ADD COLUMN email_verified_at         DATETIME");
  safe("ALTER TABLE users ADD COLUMN whatsapp_verified_at      DATETIME");
  safe("ALTER TABLE users ADD COLUMN two_factor_secret         TEXT");
  safe("ALTER TABLE users ADD COLUMN two_factor_recovery_codes TEXT");
  safe("ALTER TABLE users ADD COLUMN two_factor_confirmed_at   DATETIME");
  safe("ALTER TABLE users ADD COLUMN remember_token            TEXT");
  safe("ALTER TABLE users ADD COLUMN locale                    TEXT DEFAULT 'es'");
  safe("ALTER TABLE users ADD COLUMN subscription_level        TEXT NOT NULL DEFAULT 'free'");
  safe("ALTER TABLE users ADD COLUMN is_banned                 INTEGER NOT NULL DEFAULT 0");
  safe("ALTER TABLE users ADD COLUMN banned_until              DATETIME");
  safe("ALTER TABLE users ADD COLUMN ban_reason                TEXT");
  safe("ALTER TABLE users ADD COLUMN updated_at                DATETIME");

  // Sync email = username for existing rows where email is null
  safe("UPDATE users SET email = username WHERE email IS NULL");
  // Sync name = full_name for existing rows where name is empty
  safe("UPDATE users SET name = full_name WHERE (name IS NULL OR name = '') AND full_name != ''");

  // Default settings
  const defaults = [
    ['theme',       'dark'],
    ['volume',      '80'],
    ['auto_play',   'true'],
    ['language',    'es'],
    ['login_theme', 'nebula'],
  ];
  const upsert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  defaults.forEach(([k, v]) => upsert.run(k, v));

  // Seed demo user
  db.prepare('INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)')
    .run('demo@starcho.com', hashPw('123456'));

  log.info('Core database migrations complete');
}

module.exports = { runMigrations };
