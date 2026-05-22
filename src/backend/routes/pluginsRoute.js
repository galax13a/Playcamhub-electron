'use strict';

const router        = require('express').Router();
const { getDb }     = require('../database/connection');
const pluginManager = require('../core/PluginManager');

// GET /api/plugins — list all discovered plugins with their enabled state
router.get('/', (_req, res) => {
  try {
    res.json(pluginManager.list(getDb()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/plugins/:id — enable or disable a plugin (requires app restart to take effect)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean')
    return res.status(400).json({ error: '"enabled" (boolean) required' });
  try {
    pluginManager.setEnabled(getDb(), id, enabled);
    res.json({ ok: true, id, enabled, restartRequired: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
