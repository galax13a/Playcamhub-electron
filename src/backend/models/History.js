'use strict';

const { getDb } = require('../database/connection');

const History = {
  add(songId) {
    const db = getDb();
    db.prepare('INSERT INTO history (song_id) VALUES (?)').run(songId);
    // Keep only last 200 rows in DB
    db.prepare(`
      DELETE FROM history WHERE id NOT IN (
        SELECT id FROM history ORDER BY played_at DESC LIMIT 200
      )`).run();
  },

  getLast(limit = 26) {
    return getDb().prepare(`
      SELECT h.id AS history_id, h.played_at,
             s.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
      FROM history h
      JOIN songs s ON s.id = h.song_id
      LEFT JOIN categories c ON s.category_id = c.id
      ORDER BY h.played_at DESC
      LIMIT ?
    `).all(limit);
  },

  clear() {
    return getDb().prepare('DELETE FROM history').run();
  },
};

module.exports = History;
