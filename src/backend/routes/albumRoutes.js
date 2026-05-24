'use strict';

const router  = require('express').Router();
const fs      = require('fs');
const path    = require('path');
const { getDb } = require('../database/connection');

// GET /api/albums - List all albums
router.get('/', (_req, res) => {
  const db = getDb();

  try {
    const albums = db.prepare(`
      SELECT a.*, COUNT(m.id) as mediaCount
      FROM albums a
      LEFT JOIN media m ON m.album_id = a.id
      GROUP BY a.id
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
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Album name required' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO albums (name, description)
      VALUES (?, ?)
    `);

    const result = stmt.run(name.trim(), description || '');

    res.json({
      id: result.lastInsertRowid,
      name: name.trim(),
      description: description || '',
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('[albums] Create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/albums/:id/add-media - Add media to album
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

    // Update media with album_id
    const updateStmt = db.prepare('UPDATE media SET album_id = ? WHERE id = ?');
    mediaIds.forEach(mediaId => {
      updateStmt.run(id, mediaId);
    });

    res.json({ success: true, addedCount: mediaIds.length });
  } catch (err) {
    console.error('[albums] Add media error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/albums/:id - Update album
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, description, coverId } = req.body;

  try {
    const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(id);
    if (!album) return res.status(404).json({ error: 'Album not found' });

    const stmt = db.prepare(`
      UPDATE albums SET
        name = ?,
        description = ?,
        cover_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      name !== undefined ? name : album.name,
      description !== undefined ? description : album.description,
      coverId !== undefined ? coverId : album.cover_id,
      id
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/albums/:id - Delete album
router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  try {
    const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(id);
    if (!album) return res.status(404).json({ error: 'Album not found' });

    // Remove album_id from all media
    db.prepare('UPDATE media SET album_id = NULL WHERE album_id = ?').run(id);

    // Delete album
    db.prepare('DELETE FROM albums WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
