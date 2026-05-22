'use strict';

const router = require('express').Router();
const { validate } = require('../../../../src/backend/middleware/validate');
const { IdParamsSchema, NoteQuerySchema, NoteCreateSchema, NoteUpdateSchema } = require('../schemas/notes');

function userId(db, username) {
  if (!username) return null;
  const row = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  return row ? row.id : null;
}

// GET /api/notes
router.get('/', validate(NoteQuerySchema, 'query'), (req, res) => {
  try {
    const db  = req.db;
    const uid = userId(db, req.query.username);
    const rows = uid
      ? db.prepare('SELECT * FROM notes WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC').all(uid)
      : db.prepare('SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC').all();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/notes/:id
router.get('/:id', validate(IdParamsSchema, 'params'), (req, res) => {
  try {
    const row = req.db.prepare('SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/notes
router.post('/', validate(NoteCreateSchema), (req, res) => {
  try {
    const db  = req.db;
    const { title, content, color, important_date, username } = req.body;
    const uid = userId(db, username);
    const info = db.prepare(
      'INSERT INTO notes (title, content, color, important_date, user_id) VALUES (?, ?, ?, ?, ?)'
    ).run(title, content || null, color || '#6366f1', important_date || null, uid);
    res.json(db.prepare('SELECT * FROM notes WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/notes/:id
router.put('/:id', validate(IdParamsSchema, 'params'), validate(NoteUpdateSchema), (req, res) => {
  try {
    const db = req.db;
    const { title, content, color, important_date } = req.body;
    db.prepare(
      'UPDATE notes SET title=?, content=?, color=?, important_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL'
    ).run(title, content || null, color || '#6366f1', important_date || null, req.params.id);
    const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/notes/:id  (soft delete)
router.delete('/:id', validate(IdParamsSchema, 'params'), (req, res) => {
  try {
    req.db.prepare('UPDATE notes SET deleted_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
