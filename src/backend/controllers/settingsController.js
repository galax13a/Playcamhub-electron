'use strict';

const Settings = require('../models/Settings');

const settingsController = {
  getAll(_req, res) {
    res.json(Settings.getAll());
  },

  setMany(req, res) {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'body must be a key/value object' });
    }
    const result = Settings.setMany(req.body);
    res.json(result);
  },
};

module.exports = settingsController;
