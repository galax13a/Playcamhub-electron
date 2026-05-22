'use strict';

// ── Core router — auth + config + settings + plugin management ──────────────
// Music, playlists, categories, upload, library → handled by the starcho plugin.
// Contacts, etc.                                → handled by their own plugins.

const crypto = require('crypto');
const router = require('express').Router();
const { getDb } = require('../database/connection');
const { validate } = require('../middleware/validate');
const { LoginSchema, RegisterSchema, ProfileQuerySchema, ProfileUpdateSchema } = require('../schemas/auth');

function hashPw(pw) {
  return crypto.createHash('sha256').update(pw + 'starcho-local-salt').digest('hex');
}

function ensureDefaultUser(db) {
  const { c } = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (c === 0) {
    const u = process.env.APP_USER     || 'admin';
    const p = process.env.APP_PASSWORD || 'admin123';
    db.prepare('INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)').run(u, hashPw(p));
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

router.post('/auth/login', validate(LoginSchema), (req, res) => {
  const { username, password } = req.body;
  try {
    const db = getDb();
    ensureDefaultUser(db);
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || user.password !== hashPw(password))
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    res.json({ ok: true, username: user.username });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/auth/register', validate(RegisterSchema), (req, res) => {
  const { username, password } = req.body;
  try {
    const db = getDb();
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username))
      return res.status(409).json({ error: 'Ese usuario ya existe' });
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashPw(password));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/auth/profile', validate(ProfileQuerySchema, 'query'), (req, res) => {
  const { username } = req.query;
  try {
    const db   = getDb();
    const user = db.prepare('SELECT username, full_name, nickname, whatsapp, avatar FROM users WHERE username = ?').get(username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/auth/profile', validate(ProfileUpdateSchema), (req, res) => {
  const { username, full_name, nickname, whatsapp, avatar } = req.body;
  try {
    const db = getDb();
    db.prepare('UPDATE users SET full_name=?, nickname=?, whatsapp=?, avatar=? WHERE username=?')
      .run(full_name, nickname, whatsapp, avatar, username);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── App config ────────────────────────────────────────────────────────────────

router.get('/config', (_req, res) => {
  res.json({
    appName:    process.env.APP_NAME    || 'Starcho Electron',
    appVersion: process.env.APP_VERSION || '1.0.0',
    appSlogan:  process.env.APP_SLOGAN  || 'Desarrollo ágil y rápido con Electron',
    logoText:   process.env.LOGO_TEXT   || 'Starcho',
    appTitle:   process.env.APP_TITLE   || 'Starcho Electron — Dev Platform',
  });
});

// ── Settings (global key-value store) ────────────────────────────────────────

router.use('/settings', require('./settingsRoutes'));

// ── Plugin management ─────────────────────────────────────────────────────────

router.use('/plugins', require('./pluginsRoute'));

module.exports = router;
