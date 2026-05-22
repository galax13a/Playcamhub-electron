'use strict';

const { getDb } = require('../database/connection');

const DownloadQueue = {
  findAll() {
    return getDb().prepare('SELECT * FROM download_queue ORDER BY created_at DESC').all();
  },
  findById(id) {
    return getDb().prepare('SELECT * FROM download_queue WHERE id = ?').get(id);
  },
  findByStatus(status) {
    return getDb().prepare('SELECT * FROM download_queue WHERE status = ? ORDER BY created_at ASC').all(status);
  },
  create({ youtube_url, youtube_id, title, thumbnail, format = 'audio', quality = 'best', batch_id = null }) {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO download_queue (youtube_url, youtube_id, title, thumbnail, format, quality, batch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(youtube_url, youtube_id ?? null, title, thumbnail ?? null, format, quality, batch_id);
    return this.findById(result.lastInsertRowid);
  },
  findByBatch(batchId) {
    return getDb().prepare('SELECT * FROM download_queue WHERE batch_id = ? ORDER BY id ASC').all(batchId);
  },
  updateProgress(id, progress) {
    getDb().prepare("UPDATE download_queue SET progress = ?, status = 'downloading' WHERE id = ?").run(progress, id);
  },
  complete(id, songId) {
    getDb().prepare(`
      UPDATE download_queue SET status = 'completed', progress = 100,
             song_id = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(songId, id);
  },
  fail(id, errorMsg) {
    getDb().prepare(`
      UPDATE download_queue SET status = 'failed', error_msg = ?,
             finished_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(errorMsg, id);
  },
  delete(id) {
    return getDb().prepare('DELETE FROM download_queue WHERE id = ?').run(id);
  },
  clearFinished() {
    return getDb().prepare("DELETE FROM download_queue WHERE status IN ('completed', 'failed')").run();
  },
};

module.exports = DownloadQueue;
