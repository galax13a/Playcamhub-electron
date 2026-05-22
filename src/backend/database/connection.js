'use strict';

const Database = require('better-sqlite3');
const log      = require('electron-log');
const { runMigrations } = require('./migrations');

let db = null;

function initDatabase(dbPath) {
  if (db) return db;
  db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? log.debug : null });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  log.info('SQLite database initialized at', dbPath);
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDatabase first.');
  return db;
}

module.exports = { initDatabase, getDb };
