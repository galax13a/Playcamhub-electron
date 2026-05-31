'use strict';

const router = require('express').Router();
const { validate } = require('../../../../src/backend/middleware/validate');
const {
  IdParamsSchema,
  HistoryQuerySchema, HistoryCreateSchema, HistoryUpdateSchema,
  PlaylistCreateSchema, PlaylistUpdateSchema,
  PlaylistItemSchema, PlaylistReorderSchema, PlaylistImportSchema,
} = require('../schemas/videoplayer');

function userId(db, username) {
  if (!username) return null;
  const row = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  return row ? row.id : null;
}

// ────────────────────────────────────────────────────────────────────────────────
// HISTORY
// ────────────────────────────────────────────────────────────────────────────────

// GET /api/videoplayer/history  — paginado
router.get('/history', validate(HistoryQuerySchema, 'query'), (req, res) => {
  try {
    const db = req.db;
    const { username, search, page, per_page } = req.query;
    const uid = userId(db, username);

    let where = 'WHERE deleted_at IS NULL';
    const args = [];
    if (uid)    { where += ' AND user_id = ?'; args.push(uid); }
    if (search) { where += ' AND title LIKE ?'; args.push(`%${search}%`); }

    const total  = db.prepare(`SELECT COUNT(*) AS n FROM video_history ${where}`).get(...args).n;
    const offset = (page - 1) * per_page;
    const items  = db.prepare(
      `SELECT * FROM video_history ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`
    ).all(...args, per_page, offset);

    res.json({ items, total, page, perPage: per_page });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/videoplayer/history
router.post('/history', validate(HistoryCreateSchema), (req, res) => {
  try {
    const db = req.db;
    const { title, source, source_type, mime_type, player_id, duration, last_position, username } = req.body;
    const uid = userId(db, username);
    const info = db.prepare(
      `INSERT INTO video_history
       (title, source, source_type, mime_type, player_id, duration, last_position, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(title, source, source_type || 'url', mime_type || null, player_id || null,
          duration ?? null, last_position ?? 0, uid);
    res.json(db.prepare('SELECT * FROM video_history WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/videoplayer/history/:id  — actualizar posición / duración
router.put('/history/:id',
  validate(IdParamsSchema, 'params'),
  validate(HistoryUpdateSchema),
  (req, res) => {
    try {
      const { last_position, duration } = req.body;
      req.db.prepare(
        `UPDATE video_history
            SET last_position = ?, duration = COALESCE(?, duration), updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND deleted_at IS NULL`
      ).run(last_position, duration ?? null, req.params.id);
      const row = req.db.prepare('SELECT * FROM video_history WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// DELETE /api/videoplayer/history/:id  (soft delete)
router.delete('/history/:id', validate(IdParamsSchema, 'params'), (req, res) => {
  try {
    req.db.prepare('UPDATE video_history SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/videoplayer/history  — limpiar todo (soft)
router.delete('/history', (req, res) => {
  try {
    req.db.prepare('UPDATE video_history SET deleted_at = CURRENT_TIMESTAMP WHERE deleted_at IS NULL').run();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ────────────────────────────────────────────────────────────────────────────────
// PLAYLISTS
// ────────────────────────────────────────────────────────────────────────────────

// GET /api/videoplayer/playlists
router.get('/playlists', (req, res) => {
  try {
    const db = req.db;
    const uid = userId(db, req.query.username);
    const where = uid ? 'WHERE deleted_at IS NULL AND user_id = ?' : 'WHERE deleted_at IS NULL';
    const args  = uid ? [uid] : [];
    const items = db.prepare(`SELECT * FROM video_playlists ${where} ORDER BY updated_at DESC`).all(...args);
    res.json({ items });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/videoplayer/playlists/:id  (con items)
router.get('/playlists/:id', validate(IdParamsSchema, 'params'), (req, res) => {
  try {
    const db = req.db;
    const pl = db.prepare('SELECT * FROM video_playlists WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!pl) return res.status(404).json({ error: 'Playlist no encontrada' });
    pl.items = db.prepare(
      'SELECT * FROM video_playlist_items WHERE playlist_id = ? ORDER BY position ASC, id ASC'
    ).all(req.params.id);
    res.json(pl);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/videoplayer/playlists
router.post('/playlists', validate(PlaylistCreateSchema), (req, res) => {
  try {
    const db = req.db;
    const { name, description, username } = req.body;
    const uid = userId(db, username);
    const info = db.prepare(
      'INSERT INTO video_playlists (name, description, user_id) VALUES (?, ?, ?)'
    ).run(name, description || '', uid);
    res.json(db.prepare('SELECT * FROM video_playlists WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/videoplayer/playlists/:id
router.put('/playlists/:id',
  validate(IdParamsSchema, 'params'),
  validate(PlaylistUpdateSchema),
  (req, res) => {
    try {
      const { name, description } = req.body;
      req.db.prepare(
        'UPDATE video_playlists SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL'
      ).run(name, description || '', req.params.id);
      const row = req.db.prepare('SELECT * FROM video_playlists WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// DELETE /api/videoplayer/playlists/:id  (soft delete)
router.delete('/playlists/:id', validate(IdParamsSchema, 'params'), (req, res) => {
  try {
    req.db.prepare('UPDATE video_playlists SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/videoplayer/playlists/:id/items
router.post('/playlists/:id/items',
  validate(IdParamsSchema, 'params'),
  validate(PlaylistItemSchema),
  (req, res) => {
    try {
      const db = req.db;
      const { title, source, source_type, position } = req.body;
      const pl = db.prepare('SELECT id FROM video_playlists WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
      if (!pl) return res.status(404).json({ error: 'Playlist no encontrada' });
      const pos = position ?? (db.prepare(
        'SELECT COALESCE(MAX(position), -1) + 1 AS p FROM video_playlist_items WHERE playlist_id = ?'
      ).get(req.params.id).p);
      const info = db.prepare(
        'INSERT INTO video_playlist_items (playlist_id, title, source, source_type, position) VALUES (?, ?, ?, ?, ?)'
      ).run(req.params.id, title, source, source_type || 'url', pos);
      db.prepare('UPDATE video_playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
      res.json(db.prepare('SELECT * FROM video_playlist_items WHERE id = ?').get(info.lastInsertRowid));
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// DELETE /api/videoplayer/playlists/:id/items/:itemId
router.delete('/playlists/:id/items/:itemId',
  (req, res) => {
    try {
      req.db.prepare('DELETE FROM video_playlist_items WHERE id = ? AND playlist_id = ?')
        .run(req.params.itemId, req.params.id);
      req.db.prepare('UPDATE video_playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// PATCH /api/videoplayer/playlists/:id/reorder  body: { order: [itemId, itemId, ...] }
router.patch('/playlists/:id/reorder',
  validate(IdParamsSchema, 'params'),
  validate(PlaylistReorderSchema),
  (req, res) => {
    try {
      const db   = req.db;
      const { order } = req.body;
      const upd  = db.prepare('UPDATE video_playlist_items SET position = ? WHERE id = ? AND playlist_id = ?');
      const tx   = db.transaction((ids) => {
        ids.forEach((id, idx) => upd.run(idx, id, req.params.id));
      });
      tx(order);
      db.prepare('UPDATE video_playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// POST /api/videoplayer/playlists/import  — importar playlist desde JSON
router.post('/playlists/import', validate(PlaylistImportSchema), (req, res) => {
  try {
    const db = req.db;
    const { name, description, items, username } = req.body;
    const uid = userId(db, username);
    const tx  = db.transaction(() => {
      const pl = db.prepare(
        'INSERT INTO video_playlists (name, description, user_id) VALUES (?, ?, ?)'
      ).run(name, description || '', uid);
      const ins = db.prepare(
        'INSERT INTO video_playlist_items (playlist_id, title, source, source_type, position) VALUES (?, ?, ?, ?, ?)'
      );
      (items || []).forEach((it, idx) => {
        ins.run(pl.lastInsertRowid, it.title, it.source, it.source_type || 'url', it.position ?? idx);
      });
      return pl.lastInsertRowid;
    });
    const id = tx();
    res.json(db.prepare('SELECT * FROM video_playlists WHERE id = ?').get(id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
