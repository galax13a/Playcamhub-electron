'use strict';

const { getDb } = require('../database/connection');

const Song = {
  findAll({ limit = 200, offset = 0, categoryId, search, favorite, type } = {}) {
    const db = getDb();
    let sql = `
      SELECT s.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
      FROM songs s LEFT JOIN categories c ON s.category_id = c.id WHERE 1=1`;
    const params = [];
    if (categoryId) { sql += ' AND s.category_id = ?'; params.push(categoryId); }
    if (favorite)   { sql += ' AND s.is_favorite = 1'; }
    if (type)       { sql += ' AND s.type = ?'; params.push(type); }
    if (search)     {
      sql += ' AND (s.title LIKE ? OR s.artist LIKE ? OR s.album LIKE ?)';
      const q = `%${search}%`; params.push(q, q, q);
    }
    sql += ' ORDER BY s.added_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return db.prepare(sql).all(...params);
  },

  findById(id) {
    return getDb().prepare(`
      SELECT s.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
      FROM songs s LEFT JOIN categories c ON s.category_id = c.id WHERE s.id = ?
    `).get(id);
  },

  create({ title, artist = 'Unknown', album = 'Unknown', duration = 0,
           file_path, thumbnail = null, youtube_url = null, youtube_id = null,
           category_id, type = 'audio' }) {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO songs (title, artist, album, duration, file_path, thumbnail,
                         youtube_url, youtube_id, category_id, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, artist, album, duration, file_path, thumbnail,
           youtube_url, youtube_id, category_id ?? null, type);
    return this.findById(result.lastInsertRowid);
  },

  update(id, fields) {
    const db   = getDb();
    const keys = Object.keys(fields).filter(k => k !== 'id');
    if (!keys.length) return this.findById(id);
    db.prepare(`UPDATE songs SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`)
      .run(...keys.map(k => fields[k]), id);
    return this.findById(id);
  },

  delete(id) { return getDb().prepare('DELETE FROM songs WHERE id = ?').run(id); },

  toggleFavorite(id) {
    getDb().prepare('UPDATE songs SET is_favorite = NOT is_favorite WHERE id = ?').run(id);
    return this.findById(id);
  },

  incrementPlayCount(id) {
    getDb().prepare('UPDATE songs SET play_count = play_count + 1 WHERE id = ?').run(id);
  },

  count() { return getDb().prepare('SELECT COUNT(*) AS n FROM songs').get().n; },

  countByType(type) {
    return getDb().prepare('SELECT COUNT(*) AS n FROM songs WHERE type = ?').get(type).n;
  },

  recent(limit = 12) {
    return getDb().prepare(`
      SELECT s.*, c.name AS category_name, c.color AS category_color
      FROM songs s LEFT JOIN categories c ON s.category_id = c.id
      ORDER BY s.added_at DESC LIMIT ?
    `).all(limit);
  },

  favorites() {
    return getDb().prepare(`
      SELECT s.*, c.name AS category_name, c.color AS category_color
      FROM songs s LEFT JOIN categories c ON s.category_id = c.id
      WHERE s.is_favorite = 1 ORDER BY s.added_at DESC
    `).all();
  },

  mostPlayed(limit = 12) {
    return getDb().prepare(`
      SELECT s.*, c.name AS category_name, c.color AS category_color
      FROM songs s LEFT JOIN categories c ON s.category_id = c.id
      WHERE s.play_count > 0
      ORDER BY s.play_count DESC LIMIT ?
    `).all(limit);
  },
};

module.exports = Song;
