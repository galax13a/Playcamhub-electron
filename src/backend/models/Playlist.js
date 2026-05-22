'use strict';

const { getDb } = require('../database/connection');

const Playlist = {
  findAll() {
    const db = getDb();
    return db.prepare(`
      SELECT p.*, COUNT(ps.song_id) AS song_count
      FROM playlists p
      LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
      GROUP BY p.id
      ORDER BY p.id ASC
    `).all();
  },

  findById(id) {
    return getDb().prepare('SELECT * FROM playlists WHERE id = ?').get(id);
  },

  getSongs(playlistId) {
    return getDb().prepare(`
      SELECT s.*, ps.position,
             c.name AS category_name, c.color AS category_color, c.icon AS category_icon
      FROM playlist_songs ps
      JOIN songs s ON s.id = ps.song_id
      LEFT JOIN categories c ON s.category_id = c.id
      WHERE ps.playlist_id = ?
      ORDER BY ps.position ASC, ps.added_at ASC
    `).all(playlistId);
  },

  create({ name, description = '', cover = null }) {
    const db = getDb();
    const result = db.prepare(
      'INSERT INTO playlists (name, description, cover) VALUES (?, ?, ?)'
    ).run(name, description, cover);
    return this.findById(result.lastInsertRowid);
  },

  update(id, { name, description, cover }) {
    const db = getDb();
    db.prepare(`
      UPDATE playlists SET name = COALESCE(?, name),
                           description = COALESCE(?, description),
                           cover = COALESCE(?, cover),
                           updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name ?? null, description ?? null, cover ?? null, id);
    return this.findById(id);
  },

  delete(id) {
    return getDb().prepare('DELETE FROM playlists WHERE id = ?').run(id);
  },

  addSong(playlistId, songId) {
    const db = getDb();
    const maxPos = db.prepare(
      'SELECT COALESCE(MAX(position), -1) AS m FROM playlist_songs WHERE playlist_id = ?'
    ).get(playlistId).m;
    db.prepare(
      'INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)'
    ).run(playlistId, songId, maxPos + 1);
    db.prepare('UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(playlistId);
  },

  removeSong(playlistId, songId) {
    getDb().prepare(
      'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?'
    ).run(playlistId, songId);
  },

  reorder(playlistId, orderedSongIds) {
    const db = getDb();
    const update = db.prepare(
      'UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_id = ?'
    );
    const tx = db.transaction((ids) => {
      ids.forEach((songId, idx) => update.run(idx, playlistId, songId));
    });
    tx(orderedSongIds);
  },
};

module.exports = Playlist;
