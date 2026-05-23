'use strict';

/**
 * router.js — Express router for the /admin panel.
 *
 * Route map:
 *   GET  /admin/                          → redirect
 *   GET  /admin/login                     → login form
 *   POST /admin/login                     → auth → cookie → redirect
 *   GET  /admin/logout                    → destroy session
 *   GET  /admin/dashboard                 → overview stats          [auth]
 *   GET  /admin/menu                      → plugin toggles          [auth]
 *   PATCH /admin/api/plugins/:id/toggle   → JSON toggle             [auth]
 *   GET  /admin/config                    → config editor           [auth]
 *   POST /admin/config                    → save quick settings     [auth]
 *   POST /admin/config/setting            → add new setting row     [auth]
 *   POST /admin/config/setting/:key/update → edit one setting       [auth]
 *   POST /admin/config/setting/:key/delete → delete one setting     [auth]
 *   POST /admin/env                       → save .env file          [auth]
 *   GET  /admin/users                     → user list (paginated)   [auth]
 *   POST /admin/users/create              → create user             [auth]
 *   POST /admin/users/:id/update          → edit user fields        [auth]
 *   POST /admin/users/:id/delete          → delete user             [auth]
 *   POST /admin/users/reset-password      → reset password          [auth]
 */

const router  = require('express').Router();
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const log     = require('electron-log');
const { getDb } = require('../database/connection');

const {
  checkCredentials,
  createSession,
  destroySession,
  getToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  requireCsrf,
  getCsrfToken,
  isRateLimited,
  recordFailedAttempt,
  clearAttempts,
  remainingAttempts,
} = require('./sessions');

const { loginPage }     = require('./views/login');
const { dashboardPage } = require('./views/dashboard');
const { menuPage }      = require('./views/menu');
const { configPage }    = require('./views/config');
const { usersPage }     = require('./views/users');

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
const ENV_PATH  = path.join(__dirname, '..', '..', '..', '.env');

const QUICK_KEYS = ['theme', 'language', 'volume', 'repeat', 'shuffle', 'titlebar_theme'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashPw(pw) {
  return crypto.createHash('sha256').update(pw + 'starcho-local-salt').digest('hex');
}

function readFlash(req) {
  const { ok, err } = req.query;
  if (ok)  return { type: 'success', msg: decodeURIComponent(ok) };
  if (err) return { type: 'error',   msg: decodeURIComponent(err) };
  return null;
}

/** Returns the CSRF token for the current session — passed to every page render. */
function csrf(req) { return getCsrfToken(getToken(req)); }

function flashOk(res, to, msg) {
  res.redirect(`${to}?ok=${encodeURIComponent(msg)}`);
}

function flashErr(res, to, msg) {
  res.redirect(`${to}?err=${encodeURIComponent(msg)}`);
}

function readEnv() {
  try { return fs.readFileSync(ENV_PATH, 'utf8'); } catch (_) { return ''; }
}

// ── Public routes ─────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  res.redirect(getToken(req) ? '/admin/dashboard' : '/admin/login');
});

router.get('/login', (_req, res) => res.send(loginPage()));

router.post('/login', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';

  // Rate limiting — reject locked-out IPs before touching credentials
  if (isRateLimited(ip)) {
    return res.status(429).send(loginPage({
      error: 'Demasiados intentos fallidos. Espera 15 minutos antes de intentarlo de nuevo.',
    }));
  }

  const { email = '', password = '' } = req.body;
  if (!checkCredentials(email.trim(), password)) {
    recordFailedAttempt(ip);
    const left = remainingAttempts(ip);
    const hint = left > 0
      ? ` (${left} intento${left !== 1 ? 's' : ''} restante${left !== 1 ? 's' : ''})`
      : ' — cuenta bloqueada 15 min';
    return res.status(401).send(loginPage({ error: `Credenciales incorrectas${hint}.` }));
  }

  clearAttempts(ip);          // reset counter on successful login
  setSessionCookie(res, createSession());
  log.info(`[admin] Login exitoso desde IP ${ip}`);
  res.redirect('/admin/dashboard');
});

router.get('/logout', (req, res) => {
  destroySession(getToken(req));
  clearSessionCookie(res);
  res.redirect('/admin/login');
});

// ── Auth guard ────────────────────────────────────────────────────────────────

// All routes below require a valid session
router.use(requireAuth);

// All state-changing POST/PATCH requests must carry a valid CSRF token
router.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PATCH') return requireCsrf(req, res, next);
  next();
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get('/dashboard', (req, res) => {
  try {
    const db       = getDb();
    const plugins  = db.prepare('SELECT * FROM plugins ORDER BY name').all();
    const users    = db.prepare('SELECT id, username, full_name FROM users ORDER BY username').all();
    const settings = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
    res.send(dashboardPage({ plugins, users, settings, flash: readFlash(req), csrfToken: csrf(req) }));
  } catch (err) {
    log.error('Admin dashboard:', err);
    res.status(500).send('Error: ' + err.message);
  }
});

// ── Menu / plugins ────────────────────────────────────────────────────────────

router.get('/menu', (req, res) => {
  try {
    const plugins = getDb().prepare('SELECT * FROM plugins ORDER BY name').all();
    res.send(menuPage({ plugins, flash: readFlash(req), csrfToken: csrf(req) }));
  } catch (err) {
    log.error('Admin menu:', err);
    res.status(500).send('Error: ' + err.message);
  }
});

router.patch('/api/plugins/:id/toggle', (req, res) => {
  try {
    const db      = getDb();
    const { id }  = req.params;
    const enabled = req.body.enabled ? 1 : 0;
    const plugin  = db.prepare('SELECT id FROM plugins WHERE id = ?').get(id);
    if (!plugin) return res.status(404).json({ error: 'Plugin no encontrado' });
    db.prepare('UPDATE plugins SET enabled = ? WHERE id = ?').run(enabled, id);
    res.json({ ok: true, id, enabled });
  } catch (err) {
    log.error('Admin toggle:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Config — quick settings (selects) ────────────────────────────────────────

router.get('/config', (req, res) => {
  try {
    const db   = getDb();
    const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.send(configPage({ settings, envContent: readEnv(), flash: readFlash(req), csrfToken: csrf(req) }));
  } catch (err) {
    log.error('Admin config:', err);
    res.status(500).send('Error: ' + err.message);
  }
});

router.post('/config', (req, res) => {
  try {
    const db     = getDb();
    const upsert = db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
    );
    db.transaction(() => {
      QUICK_KEYS.forEach(key => upsert.run(key, (req.body[key] ?? '').toString().trim()));
    })();
    flashOk(res, '/admin/config', 'Ajustes guardados');
  } catch (err) {
    log.error('Admin config save:', err);
    flashErr(res, '/admin/config', err.message);
  }
});

// ── Config — full settings CRUD ───────────────────────────────────────────────

router.post('/config/setting', (req, res) => {
  try {
    const db  = getDb();
    const key = (req.body.key || '').trim();
    const val = (req.body.value ?? '').toString().trim();
    if (!key) return flashErr(res, '/admin/config', 'La clave es obligatoria');
    const exists = db.prepare('SELECT key FROM settings WHERE key = ?').get(key);
    if (exists) return flashErr(res, '/admin/config', `La clave "${key}" ya existe`);
    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, val);
    flashOk(res, '/admin/config', `Ajuste "${key}" creado`);
  } catch (err) {
    log.error('Admin setting add:', err);
    flashErr(res, '/admin/config', err.message);
  }
});

router.post('/config/setting/:key/update', (req, res) => {
  try {
    const db  = getDb();
    const key = req.params.key;
    const val = (req.body.value ?? '').toString().trim();
    const r   = db.prepare(
      'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
    ).run(val, key);
    if (r.changes === 0) return flashErr(res, '/admin/config', `Clave "${key}" no encontrada`);
    flashOk(res, '/admin/config', `"${key}" actualizado`);
  } catch (err) {
    log.error('Admin setting update:', err);
    flashErr(res, '/admin/config', err.message);
  }
});

router.post('/config/setting/:key/delete', (req, res) => {
  try {
    const db  = getDb();
    const key = req.params.key;
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    flashOk(res, '/admin/config', `Ajuste "${key}" eliminado`);
  } catch (err) {
    log.error('Admin setting delete:', err);
    flashErr(res, '/admin/config', err.message);
  }
});

// ── Env file editor ───────────────────────────────────────────────────────────

router.post('/env', (req, res) => {
  try {
    const content = (req.body.content ?? '');
    fs.writeFileSync(ENV_PATH, content, 'utf8');
    log.info('Admin: .env file saved');
    flashOk(res, '/admin/config', '.env guardado — reinicia la app para aplicar los cambios');
  } catch (err) {
    log.error('Admin env save:', err);
    flashErr(res, '/admin/config', 'Error guardando .env: ' + err.message);
  }
});

// ── Users ─────────────────────────────────────────────────────────────────────

router.get('/users', (req, res) => {
  try {
    const db     = getDb();
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const search = (req.query.search || '').trim();
    const like   = search ? `%${search}%` : '%';

    const total = db.prepare(
      'SELECT COUNT(*) as n FROM users WHERE username LIKE ? OR full_name LIKE ? OR nickname LIKE ?',
    ).get(like, like, like).n;

    const users = db.prepare(
      'SELECT id, username, full_name, nickname, whatsapp, avatar FROM users ' +
      'WHERE username LIKE ? OR full_name LIKE ? OR nickname LIKE ? ' +
      'ORDER BY username LIMIT ? OFFSET ?',
    ).all(like, like, like, PAGE_SIZE, (page - 1) * PAGE_SIZE);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    let editUser = null;
    if (req.query.edit) {
      editUser = db.prepare(
        'SELECT id, username, full_name, nickname, whatsapp FROM users WHERE id = ?',
      ).get(parseInt(req.query.edit));
    }

    res.send(usersPage({ users, flash: readFlash(req), page, totalPages, search, editUser, total, csrfToken: csrf(req) }));
  } catch (err) {
    log.error('Admin users:', err);
    res.status(500).send('Error: ' + err.message);
  }
});

router.post('/users/create', (req, res) => {
  try {
    const db       = getDb();
    const username = (req.body.username || '').trim();
    const password = (req.body.password || '').trim();
    if (!username)          return flashErr(res, '/admin/users', 'El nombre de usuario es obligatorio');
    if (password.length < 6) return flashErr(res, '/admin/users', 'La contraseña debe tener mínimo 6 caracteres');
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username))
      return flashErr(res, '/admin/users', `El usuario "${username}" ya existe`);
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashPw(password));
    log.info(`Admin: user "${username}" created`);
    flashOk(res, '/admin/users', `Usuario "${username}" creado`);
  } catch (err) {
    log.error('Admin user create:', err);
    flashErr(res, '/admin/users', err.message);
  }
});

router.post('/users/:id/update', (req, res) => {
  try {
    const db          = getDb();
    const id          = parseInt(req.params.id);
    const full_name   = (req.body.full_name  || '').trim();
    const nickname    = (req.body.nickname   || '').trim();
    const whatsapp    = (req.body.whatsapp   || '').trim();
    const newUsername = (req.body.username   || '').trim();

    if (!newUsername) return flashErr(res, '/admin/users', 'El nombre de usuario es obligatorio');

    const conflict = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(newUsername, id);
    if (conflict) return flashErr(res, '/admin/users', `El username "${newUsername}" ya está en uso`);

    db.prepare(
      'UPDATE users SET username = ?, full_name = ?, nickname = ?, whatsapp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ).run(newUsername, full_name, nickname, whatsapp || null, id);

    log.info(`Admin: user ${id} updated`);
    flashOk(res, '/admin/users', `Usuario actualizado correctamente`);
  } catch (err) {
    log.error('Admin user update:', err);
    flashErr(res, '/admin/users', err.message);
  }
});

router.post('/users/:id/delete', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(id);
    if (!user) return flashErr(res, '/admin/users', 'Usuario no encontrado');
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    log.info(`Admin: user ${id} ("${user.username}") deleted`);
    flashOk(res, '/admin/users', `Usuario "${user.username}" eliminado`);
  } catch (err) {
    log.error('Admin user delete:', err);
    flashErr(res, '/admin/users', err.message);
  }
});

router.post('/users/reset-password', (req, res) => {
  try {
    const db       = getDb();
    const username = (req.body.username || '').trim();
    const user     = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (!user) return flashErr(res, '/admin/users', `Usuario "${username}" no encontrado`);
    const tempPw = 'Reset_' + username.slice(0, 6);
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashPw(tempPw), user.id);
    log.info(`Admin: password reset for "${username}"`);
    flashOk(res, '/admin/users', `Contraseña de "${username}" reseteada → temporal: ${tempPw}`);
  } catch (err) {
    log.error('Admin pw reset:', err);
    flashErr(res, '/admin/users', err.message);
  }
});

module.exports = router;
