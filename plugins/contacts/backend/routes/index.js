'use strict';

const router       = require('express').Router();
const ContactModel = require('../models/ContactModel');

const model = (req) => new ContactModel(req.db);

// GET /api/contacts?search=&status=&active=&username=
router.get('/', (req, res) => {
  try { res.json(model(req).list(req.query)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/contacts/:id
router.get('/:id', (req, res) => {
  const c = model(req).get(parseInt(req.params.id));
  if (!c) return res.status(404).json({ error: 'Contact not found' });
  res.json(c);
});

// POST /api/contacts
router.post('/', (req, res) => {
  const { name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try { res.status(201).json(model(req).create(req.body)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/contacts/:id
router.put('/:id', (req, res) => {
  try { res.json(model(req).update(parseInt(req.params.id), req.body)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/contacts/:id  (soft delete)
router.delete('/:id', (req, res) => {
  try { model(req).delete(parseInt(req.params.id)); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/contacts/:id/toggle-active
router.post('/:id/toggle-active', (req, res) => {
  try { res.json(model(req).toggleActive(parseInt(req.params.id))); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
