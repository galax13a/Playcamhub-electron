'use strict';

const log = require('electron-log');

function migrate(db) {
  const cols = db.prepare("PRAGMA table_info(contacts)").all().map(c => c.name);

  if (cols.length === 0) {
    // Fresh install
    _createTable(db);
  } else if (!cols.includes('status')) {
    // Old schema — rebuild preserving existing data
    db.exec(`ALTER TABLE contacts RENAME TO contacts_v1_bak`);
    _createTable(db);
    // Migrate compatible columns from old table
    db.exec(`
      INSERT INTO contacts (id, name, company, email, phone, notes, created_at, updated_at)
      SELECT id,
             name,
             COALESCE(NULLIF(company,''), NULL),
             COALESCE(NULLIF(email,''),   NULL),
             COALESCE(NULLIF(phone,''),   NULL),
             COALESCE(NULLIF(notes,''),   NULL),
             created_at,
             updated_at
      FROM contacts_v1_bak
    `);
    db.exec(`DROP TABLE contacts_v1_bak`);
    log.info('[contacts] schema upgraded to v2');
  }

  log.info('[contacts] migrations complete');
}

function _createTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      company    TEXT,
      email      TEXT,
      phone      TEXT,
      status     TEXT    NOT NULL DEFAULT 'lead'
                   CHECK(status IN ('lead','prospect','customer','churned')),
      active     INTEGER NOT NULL DEFAULT 1,
      notes      TEXT,
      user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_name   ON contacts(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
    CREATE INDEX IF NOT EXISTS idx_contacts_user   ON contacts(user_id);
  `);
}

module.exports = { migrate };
