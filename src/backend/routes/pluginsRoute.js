'use strict';

const router        = require('express').Router();
const { getDb }     = require('../database/connection');
const pluginManager = require('../core/PluginManager');
const { validate }  = require('../middleware/validate');
const { PluginParamsSchema, PluginToggleSchema } = require('../schemas/plugins');

// GET /api/plugins — list all discovered plugins with their enabled state
router.get('/', (_req, res) => {
  try {
    res.json(pluginManager.list(getDb()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/plugins/:id — enable or disable a plugin (requires app restart to take effect)
router.put('/:id',
  validate(PluginParamsSchema, 'params'),
  validate(PluginToggleSchema),
  (req, res) => {
    const { id }      = req.params;
    const { enabled } = req.body;
    try {
      pluginManager.setEnabled(getDb(), id, enabled);
      res.json({ ok: true, id, enabled, restartRequired: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ── Plugin settings (stored in the shared settings table with prefix plugin_{id}_) ──

// GET /api/plugins/:id/settings — returns all settings for a plugin as { key: value }
router.get('/:id/settings', (req, res) => {
  try {
    const db     = getDb();
    const prefix = `plugin_${req.params.id}_`;
    const rows   = db.prepare(
      "SELECT key, value FROM settings WHERE key LIKE ?"
    ).all(`${prefix}%`);

    // Strip the prefix from keys before returning
    const result = {};
    rows.forEach(r => { result[r.key.slice(prefix.length)] = r.value; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/plugins/:id/settings — upsert one or many settings for a plugin
// Body: { key: string, value: string } OR { settings: { key: value, ... } }
router.post('/:id/settings', (req, res) => {
  try {
    const db     = getDb();
    const prefix = `plugin_${req.params.id}_`;
    const upsert = db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
    );

    const { key, value, settings } = req.body;

    if (settings && typeof settings === 'object') {
      // Bulk update
      const bulk = db.transaction(() => {
        for (const [k, v] of Object.entries(settings)) {
          upsert.run(`${prefix}${k}`, String(v));
        }
      });
      bulk();
    } else if (key) {
      // Single key-value
      upsert.run(`${prefix}${key}`, String(value ?? ''));
    } else {
      return res.status(400).json({ error: 'Body must contain key+value or settings object' });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
