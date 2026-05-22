'use strict';

const log = require('electron-log');

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      description TEXT,
      status      TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','in_progress','completed','cancelled')),
      priority    TEXT NOT NULL DEFAULT 'medium'
                    CHECK(priority IN ('low','medium','high','urgent')),
      due_date    TEXT,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at  DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date    ON tasks(due_date);
  `);
  // Idempotent column additions for existing databases
  const extraCols = [
    'user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE',
    'assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL',
    'deleted_at  DATETIME',
    'updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP',
  ];
  extraCols.forEach(col => {
    try { db.exec(`ALTER TABLE tasks ADD COLUMN ${col}`); } catch (_) {}
  });
  log.info('[tasks] migrations complete');
}

module.exports = { migrate };
