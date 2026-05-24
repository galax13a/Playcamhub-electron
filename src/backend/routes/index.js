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

// ── App session store (SQLite-backed, 7-day tokens) ───────────────────────────
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

function createAppSession(username) {
  const db        = getDb();
  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL;
  db.prepare('INSERT OR REPLACE INTO app_sessions (token, username, expires_at) VALUES (?, ?, ?)').run(token, username, expiresAt);
  // Clean up expired sessions opportunistically
  db.prepare('DELETE FROM app_sessions WHERE expires_at < ?').run(Date.now());
  return { token, expiresAt };
}

function validateAppSession(token) {
  if (!token) return null;
  const db  = getDb();
  const row = db.prepare('SELECT username FROM app_sessions WHERE token = ? AND expires_at > ?').get(token, Date.now());
  return row ? row.username : null;
}

function destroyAppSession(token) {
  try { getDb().prepare('DELETE FROM app_sessions WHERE token = ?').run(token); } catch (_) {}
}

function ensureDefaultUser(db) {
  const { c } = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (c === 0) {
    const u = process.env.APP_USER     || 'admin';
    const p = process.env.APP_PASSWORD || 'admin123';
    db.prepare('INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)').run(u, hashPw(p));
  }
}

function parseBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return req.query.token || req.body.token || null;
}

function requireAuth(req, res, next) {
  const token = parseBearerToken(req);
  const username = validateAppSession(token);
  if (!username) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
  req.user = { username };
  next();
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
    const { token, expiresAt } = createAppSession(user.username);
    res.json({ ok: true, username: user.username, token, expiresAt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Validates a session token — called on app startup when a stored session exists
router.get('/auth/validate', (req, res) => {
  const token    = req.query.token;
  const username = validateAppSession(token);
  if (!username) return res.status(401).json({ error: 'Sesión expirada o inválida' });
  try {
    const db   = getDb();
    const user = db.prepare('SELECT username FROM users WHERE username = ?').get(username);
    if (!user) { destroyAppSession(token); return res.status(401).json({ error: 'Usuario no encontrado' }); }
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

// ── Public endpoints (no auth required) ──────────────────────────────────────

router.get('/config', (_req, res) => {
  res.json({
    appName:    process.env.APP_NAME    || 'Starcho Electron',
    appVersion: process.env.APP_VERSION || '1.0.0',
    appSlogan:  process.env.APP_SLOGAN  || 'Desarrollo ágil y rápido con Electron',
    logoText:   process.env.LOGO_TEXT   || 'Starcho',
    appTitle:   process.env.APP_TITLE   || 'Starcho Electron — Dev Platform',
  });
});

// GET settings is public (login screen needs the theme); writes remain protected below.
router.get('/settings', require('../controllers/settingsController').getAll);

router.use(requireAuth);

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

// ── Settings writes (protected — GET is public above) ────────────────────────

router.use('/settings', require('./settingsRoutes'));

// ── Plugin management ─────────────────────────────────────────────────────────

router.use('/plugins', require('./pluginsRoute'));

module.exports = router;
