'use strict';

const router = require('express').Router();
const { validate } = require('../../../../src/backend/middleware/validate');
const { IdParamsSchema, TaskQuerySchema, TaskCreateSchema, TaskUpdateSchema, TaskStatusSchema } = require('../schemas/tasks');

function userId(db, username) {
  if (!username) return null;
  const row = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  return row ? row.id : null;
}

// GET /api/tasks  — paginated: { items, total, page, perPage }
router.get('/', validate(TaskQuerySchema, 'query'), (req, res) => {
  try {
    const db     = req.db;
    const { username, status, page, per_page } = req.query;
    const uid    = userId(db, username);

    let where    = 'WHERE deleted_at IS NULL';
    const args   = [];
    if (uid)    { where += ' AND user_id = ?'; args.push(uid); }
    if (status) { where += ' AND status = ?';  args.push(status); }

    const orderBy = 'ORDER BY CASE priority WHEN "urgent" THEN 0 WHEN "high" THEN 1 WHEN "medium" THEN 2 ELSE 3 END, due_date ASC';
    const total   = db.prepare(`SELECT COUNT(*) as n FROM tasks ${where}`).get(...args).n;
    const offset  = (page - 1) * per_page;
    const items   = db.prepare(`SELECT * FROM tasks ${where} ${orderBy} LIMIT ? OFFSET ?`).all(...args, per_page, offset);

    res.json({ items, total, page, perPage: per_page });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/tasks/:id
router.get('/:id', validate(IdParamsSchema, 'params'), (req, res) => {
  try {
    const row = req.db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tasks
router.post('/', validate(TaskCreateSchema), (req, res) => {
  try {
    const db = req.db;
    const { title, description, status, priority, due_date, username } = req.body;
    const uid  = userId(db, username);
    const info = db.prepare(
      'INSERT INTO tasks (title, description, status, priority, due_date, user_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(title, description || null, status || 'pending', priority || 'medium', due_date || null, uid);
    res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/tasks/:id
router.put('/:id', validate(IdParamsSchema, 'params'), validate(TaskUpdateSchema), (req, res) => {
  try {
    const db = req.db;
    const { title, description, status, priority, due_date } = req.body;
    db.prepare(
      'UPDATE tasks SET title=?, description=?, status=?, priority=?, due_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL'
    ).run(title, description || null, status || 'pending', priority || 'medium', due_date || null, req.params.id);
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/tasks/:id/status
router.patch('/:id/status', validate(IdParamsSchema, 'params'), validate(TaskStatusSchema), (req, res) => {
  try {
    req.db.prepare('UPDATE tasks SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL')
      .run(req.body.status, req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/tasks/:id  (soft delete)
router.delete('/:id', validate(IdParamsSchema, 'params'), (req, res) => {
  try {
    req.db.prepare('UPDATE tasks SET deleted_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
