'use strict';

const log = require('electron-log');

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      title          TEXT NOT NULL,
      content        TEXT,
      color          TEXT NOT NULL DEFAULT '#6366f1',
      important_date TEXT,
      user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at     DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_notes_user_color    ON notes(user_id, color);
    CREATE INDEX IF NOT EXISTS idx_notes_important_date ON notes(important_date);
  `);
  log.info('[notes] migrations complete');
}

module.exports = { migrate };
