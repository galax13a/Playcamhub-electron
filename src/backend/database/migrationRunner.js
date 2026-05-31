'use strict';
// @ts-check
// ↑ Pilot file for the incremental TypeScript migration. With `// @ts-check`,
//   `npm run typecheck` validates this module against its JSDoc types while it
//   stays plain runtime JS. See docs/MIGRATION-TYPESCRIPT.md.

/**
 * @typedef {Object} Migration
 * @property {number} version           Unique, monotonically increasing version.
 * @property {string} name              Human-readable migration name.
 * @property {(db: any) => void} up     Applies the migration (must be idempotent).
 */

/**
 * Applies an ordered list of migrations exactly once each, tracking applied
 * versions in the `schema_version` table. Every migration runs inside its own
 * transaction so a failure leaves the schema untouched.
 *
 * IMPORTANT: migrations must stay idempotent. Databases created before version
 * tracking existed have no rows in `schema_version`, so this runner will replay
 * every migration on them — using `CREATE TABLE IF NOT EXISTS` and guarded
 * `ALTER TABLE` keeps that replay safe.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {Migration[]} migrations
 * @param {(msg: string) => void} [logFn] optional logger
 * @returns {number[]} versions applied during this run
 */
function runVersionedMigrations(db, migrations, logFn = () => {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER PRIMARY KEY,
      name       TEXT,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // Older databases may have a schema_version table without the `name` column.
  try {
    db.exec('ALTER TABLE schema_version ADD COLUMN name TEXT');
  } catch (_) {
    /* column already exists */
  }

  const ordered = [...migrations].sort((a, b) => a.version - b.version);
  const isApplied = db.prepare('SELECT 1 FROM schema_version WHERE version = ?');
  const record = db.prepare(
    'INSERT OR IGNORE INTO schema_version (version, name) VALUES (?, ?)'
  );

  const appliedNow = [];
  for (const migration of ordered) {
    if (isApplied.get(migration.version)) continue;

    const tx = db.transaction(() => {
      migration.up(db);
      record.run(migration.version, migration.name);
    });
    tx();

    appliedNow.push(migration.version);
    logFn(`Applied migration ${migration.version} — ${migration.name}`);
  }
  return appliedNow;
}

module.exports = { runVersionedMigrations };
