'use strict';

const router  = require('express').Router();
const fs      = require('fs');
const path    = require('path');
const { getDb } = require('../database/connection');

// GET /api/albums - List all albums (includes mediaCount + 3 preview thumb IDs)
router.get('/', (_req, res) => {
  const db = getDb();
  try {
    const albums = db.prepare(`
      SELECT a.*,
        (SELECT COUNT(*) FROM media WHERE album_id = a.id) AS mediaCount,
        (SELECT GROUP_CONCAT(id) FROM
          (SELECT id FROM media WHERE album_id = a.id ORDER BY created_at DESC LIMIT 3)
        ) AS preview_ids
      FROM albums a
      ORDER BY a.created_at DESC
    `).all();
    res.json(albums);
  } catch (err) {
    console.error('[albums] List error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/albums/:id - Get album by ID
router.get('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  try {
    const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(id);
    if (!album) return res.status(404).json({ error: 'Album not found' });

    const media = db.prepare('SELECT * FROM media WHERE album_id = ? ORDER BY created_at DESC').all(id);

    res.json({ ...album, media });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/albums/:id/cover - Get album cover
router.get('/:id/cover', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  try {
    const album = db.prepare('SELECT cover_id FROM albums WHERE id = ?').get(id);
    if (!album || !album.cover_id) return res.status(404).json({ error: 'No cover' });

    const cover = db.prepare('SELECT file_path, thumbnail_path FROM media WHERE id = ?').get(album.cover_id);
    if (!cover) return res.status(404).json({ error: 'Cover not found' });

    const coverPath = cover.thumbnail_path || cover.file_path;
    if (!coverPath || !fs.existsSync(coverPath)) {
      return res.status(404).json({ error: 'Cover file not found' });
    }

    res.sendFile(coverPath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/albums - Create new album
router.post('/', (req, res) => {
  const db = getDb();
  const { name, description, tag, color, importance, objective, price, currency, payment_method } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Album name required' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO albums (name, description, tag, color, importance, objective, price, currency, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      description || '',
      tag || 'free',
      color || '#1DB954',
      importance ? parseInt(importance) : 1,
      objective || '',
      price ? parseFloat(price) : 0,
      currency || 'usd',
      payment_method || ''
    );

    res.json({
      id: result.lastInsertRowid,
      name: name.trim(),
      description: description || '',
      tag: tag || 'free',
      color: color || '#1DB954',
      importance: importance ? parseInt(importance) : 1,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('[albums] Create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/albums/:id/add-media - Add media to album
// Also sets the cover to the first photo in the list if the album has no cover yet.
router.post('/:id/add-media', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { mediaIds } = req.body;

  if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
    return res.status(400).json({ error: 'No media IDs provided' });
  }

  try {
    const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(id);
    if (!album) return res.status(404).json({ error: 'Album not found' });

    const updateStmt = db.prepare('UPDATE media SET album_id = ? WHERE id = ?');
    mediaIds.forEach(mid => updateStmt.run(id, mid));

    // Auto-set cover to the first photo if the album has none
    if (!album.cover_id) {
      const firstPhoto = mediaIds
        .map(mid => db.prepare('SELECT id, media_type FROM media WHERE id = ?').get(mid))
        .find(m => m && m.media_type === 'photo');
      if (firstPhoto) {
        db.prepare('UPDATE albums SET cover_id = ? WHERE id = ?').run(firstPhoto.id, id);
      }
    }

    res.json({ success: true, addedCount: mediaIds.length });
  } catch (err) {
    console.error('[albums] add-media:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/albums/:id - Update album
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, description, coverId, tag, color, importance, objective, price, currency, payment_method } = req.body;

  try {
    const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(id);
    if (!album) return res.status(404).json({ error: 'Album not found' });

    db.prepare(`
      UPDATE albums SET
        name = ?, description = ?, cover_id = ?,
        tag = ?, color = ?, importance = ?,
        objective = ?, price = ?, currency = ?, payment_method = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name        !== undefined ? name        : album.name,
      description !== undefined ? description : album.description,
      coverId     !== undefined ? coverId     : album.cover_id,
      tag         !== undefined ? tag         : (album.tag || 'free'),
      color       !== undefined ? color       : (album.color || '#1DB954'),
      importance  !== undefined ? parseInt(importance) : (album.importance || 1),
      objective   !== undefined ? objective   : (album.objective || ''),
      price       !== undefined ? parseFloat(price) : (album.price || 0),
      currency    !== undefined ? currency    : (album.currency || 'usd'),
      payment_method !== undefined ? payment_method : (album.payment_method || ''),
      id
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/albums/:id/favorite - Toggle favorite
router.post('/:id/favorite', (req, res) => {
  const db = getDb();
  try {
    const a = db.prepare('SELECT is_favorite FROM albums WHERE id = ?').get(req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    const newVal = a.is_favorite ? 0 : 1;
    db.prepare('UPDATE albums SET is_favorite = ? WHERE id = ?').run(newVal, req.params.id);
    res.json({ isFavorite: !!newVal });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/albums/:id/comments
router.get('/:id/comments', (req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare(`SELECT * FROM comments WHERE entity_type='album' AND entity_id=? ORDER BY created_at DESC LIMIT 50`).all(req.params.id);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/albums/:id/comments
router.post('/:id/comments', (req, res) => {
  const db = getDb();
  const text   = (req.body.text || '').trim();
  const author = (req.body.author || 'Usuario').trim();
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const r = db.prepare(`INSERT INTO comments (entity_type, entity_id, text, author) VALUES ('album',?,?,?)`).run(req.params.id, text, author);
    res.json({ id: r.lastInsertRowid, text, author, created_at: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/albums/:id/view - Increment view counter
router.post('/:id/view', (req, res) => {
  const db = getDb();
  try {
    const r = db.prepare('UPDATE albums SET view_count = COALESCE(view_count,0) + 1 WHERE id = ?').run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: 'Album not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/albums/:id - Delete album (id=1 "Uncategorized" is protected)
router.delete('/:id', (req, res) => {
  const db  = getDb();
  const id  = parseInt(req.params.id);
  if (id === 1) return res.status(400).json({ error: 'Cannot delete the default album' });

  try {
    const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(id);
    if (!album) return res.status(404).json({ error: 'Album not found' });

    // Detach all media first, then remove album
    db.prepare('UPDATE media SET album_id = NULL WHERE album_id = ?').run(id);
    db.prepare('DELETE FROM albums WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (err) {
    console.error('[albums] delete:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
