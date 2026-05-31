import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

import runner from '../src/backend/database/migrationRunner.js';
const { runVersionedMigrations } = runner;

function newDb() {
  return new Database(':memory:');
}

function makeMigrations(log) {
  return [
    {
      version: 1,
      name: 'create_items',
      up(db) {
        db.exec('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY)');
        log.push('m1');
      },
    },
    {
      version: 2,
      name: 'add_label',
      up(db) {
        try {
          db.exec('ALTER TABLE items ADD COLUMN label TEXT');
        } catch (_) {
          /* idempotent */
        }
        log.push('m2');
      },
    },
  ];
}

describe('runVersionedMigrations', () => {
  it('applies all pending migrations in order and records them', () => {
    const db = newDb();
    const log = [];
    const applied = runVersionedMigrations(db, makeMigrations(log));

    expect(applied).toEqual([1, 2]);
    expect(log).toEqual(['m1', 'm2']);

    const rows = db
      .prepare('SELECT version, name FROM schema_version ORDER BY version')
      .all();
    expect(rows).toEqual([
      { version: 1, name: 'create_items' },
      { version: 2, name: 'add_label' },
    ]);
  });

  it('is idempotent — re-running applies nothing', () => {
    const db = newDb();
    runVersionedMigrations(db, makeMigrations([]));

    const log = [];
    const applied = runVersionedMigrations(db, makeMigrations(log));
    expect(applied).toEqual([]);
    expect(log).toEqual([]);
  });

  it('applies only newly added migrations on a second run', () => {
    const db = newDb();
    runVersionedMigrations(db, makeMigrations([]));

    const extended = [
      ...makeMigrations([]),
      {
        version: 3,
        name: 'create_tags',
        up(db2) {
          db2.exec('CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY)');
        },
      },
    ];
    const applied = runVersionedMigrations(db, extended);
    expect(applied).toEqual([3]);

    const count = db
      .prepare('SELECT COUNT(*) AS n FROM schema_version')
      .get();
    expect(count.n).toBe(3);
  });

  it('runs migrations regardless of array order, sorted by version', () => {
    const db = newDb();
    const order = [];
    const applied = runVersionedMigrations(db, [
      { version: 2, name: 'second', up: () => order.push(2) },
      { version: 1, name: 'first', up: () => order.push(1) },
    ]);
    expect(applied).toEqual([1, 2]);
    expect(order).toEqual([1, 2]);
  });

  it('rolls back a failing migration without recording its version', () => {
    const db = newDb();
    expect(() =>
      runVersionedMigrations(db, [
        {
          version: 1,
          name: 'boom',
          up(db2) {
            db2.exec('CREATE TABLE ok (id INTEGER)');
            db2.exec('THIS IS NOT VALID SQL');
          },
        },
      ])
    ).toThrow();

    const recorded = db
      .prepare('SELECT COUNT(*) AS n FROM schema_version')
      .get();
    expect(recorded.n).toBe(0);

    // The table created before the error must have been rolled back too.
    const tbl = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ok'")
      .get();
    expect(tbl).toBeUndefined();
  });
});
