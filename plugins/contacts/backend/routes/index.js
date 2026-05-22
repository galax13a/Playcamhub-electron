'use strict';

const router       = require('express').Router();
const ContactModel = require('../models/ContactModel');
const { validate } = require('../../../../src/backend/middleware/validate');
const { IdParamsSchema, ContactQuerySchema, ContactCreateSchema, ContactUpdateSchema } = require('../schemas/contacts');

const model = (req) => new ContactModel(req.db);

// GET /api/contacts
router.get('/', validate(ContactQuerySchema, 'query'), (req, res) => {
  try { res.json(model(req).list(req.query)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/contacts/:id
router.get('/:id', validate(IdParamsSchema, 'params'), (req, res) => {
  const c = model(req).get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Contacto no encontrado' });
  res.json(c);
});

// POST /api/contacts
router.post('/', validate(ContactCreateSchema), (req, res) => {
  try { res.status(201).json(model(req).create(req.body)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/contacts/:id
router.put('/:id', validate(IdParamsSchema, 'params'), validate(ContactUpdateSchema), (req, res) => {
  try { res.json(model(req).update(req.params.id, req.body)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/contacts/:id  (soft delete)
router.delete('/:id', validate(IdParamsSchema, 'params'), (req, res) => {
  try { model(req).delete(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/contacts/:id/toggle-active
router.post('/:id/toggle-active', validate(IdParamsSchema, 'params'), (req, res) => {
  try { res.json(model(req).toggleActive(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
