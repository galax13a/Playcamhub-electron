'use strict';

const { getDb } = require('../database/connection');

const Category = {
  findAll() {
    return getDb().prepare(`
      SELECT c.*, COUNT(s.id) AS song_count
      FROM categories c
      LEFT JOIN songs s ON s.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `).all();
  },

  findById(id) {
    return getDb().prepare('SELECT * FROM categories WHERE id = ?').get(id);
  },

  create({ name, color = '#8B5CF6', icon = '🎵' }) {
    const db = getDb();
    const result = db.prepare(
      'INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)'
    ).run(name, color, icon);
    return this.findById(result.lastInsertRowid);
  },

  update(id, { name, color, icon }) {
    const db = getDb();
    db.prepare(`
      UPDATE categories SET name = COALESCE(?, name),
                            color = COALESCE(?, color),
                            icon = COALESCE(?, icon)
      WHERE id = ?
    `).run(name ?? null, color ?? null, icon ?? null, id);
    return this.findById(id);
  },

  delete(id) {
    return getDb().prepare('DELETE FROM categories WHERE id = ?').run(id);
  },
};

module.exports = Category;
