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

// ── App session store (SQLite-backed, configurable TTL) ───────────────────────

function getSessionTTL() {
  try {
    const row = getDb().prepare("SELECT value FROM settings WHERE key = 'session_ttl_days'").get();
    const days = parseInt(row?.value) || 30;
    return Math.max(1, Math.min(days, 365)) * 24 * 60 * 60 * 1000;
  } catch (_) {
    return 30 * 24 * 60 * 60 * 1000;
  }
}

function createAppSession(username) {
  const db        = getDb();
  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + getSessionTTL();
  db.prepare('INSERT OR REPLACE INTO app_sessions (token, username, expires_at) VALUES (?, ?, ?)').run(token, username, expiresAt);
  // Clean up expired sessions opportunistically
  db.prepare('DELETE FROM app_sessions WHERE expires_at < ?').run(Date.now());
  return { token, expiresAt };
}

function validateAppSession(token, renew = false) {
  if (!token) return null;
  const db  = getDb();
  const row = db.prepare('SELECT username, expires_at FROM app_sessions WHERE token = ? AND expires_at > ?').get(token, Date.now());
  if (!row) return null;
  // Rolling session: extend expiry on each validation so active users stay logged in
  if (renew) {
    const newExpiry = Date.now() + getSessionTTL();
    db.prepare('UPDATE app_sessions SET expires_at = ? WHERE token = ?').run(newExpiry, token);
  }
  return row.username;
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

// Validates a session token — called on app startup when a stored session exists.
// Also renews the session TTL (rolling window) so active users stay logged in.
router.get('/auth/validate', (req, res) => {
  const token    = req.query.token;
  const username = validateAppSession(token, true); // renew=true → rolling session
  if (!username) return res.status(401).json({ error: 'Sesión expirada o inválida' });
  try {
    const db   = getDb();
    const user = db.prepare('SELECT username FROM users WHERE username = ?').get(username);
    if (!user) { destroyAppSession(token); return res.status(401).json({ error: 'Usuario no encontrado' }); }
    const newExpiry = db.prepare('SELECT expires_at FROM app_sessions WHERE token = ?').get(token)?.expires_at;
    res.json({ ok: true, username: user.username, token, expiresAt: newExpiry });
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

// ── AI image editing ──────────────────────────────────────────────────────────

router.post('/ai/edit', requireAuth, async (req, res) => {
  const { prompt, provider, imageDataUrl, strength = 0.35 } = req.body;
  if (!prompt || !imageDataUrl) return res.status(400).json({ error: 'prompt e imageDataUrl requeridos' });

  const db = getDb();
  const getSetting = (key, def) => {
    try { return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value || def; } catch (_) { return def; }
  };

  const prov = provider || getSetting('ai_provider', 'openai');

  try {
    let resultDataUrl;

    if (prov === 'openai') {
      const apiKey = getSetting('ai_openai_key', '');
      if (!apiKey) return res.status(400).json({ error: 'OpenAI API key no configurada (Ajustes → IA)' });
      const base64 = imageDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
      const imgBuf = Buffer.from(base64, 'base64');
      const fd = new FormData();
      fd.append('image', new Blob([imgBuf], { type: 'image/png' }), 'image.png');
      fd.append('prompt', prompt);
      fd.append('n', '1');
      fd.append('size', '1024x1024');
      fd.append('response_format', 'b64_json');
      const r = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || 'OpenAI error');
      resultDataUrl = 'data:image/png;base64,' + data.data[0].b64_json;

    } else if (prov === 'stability') {
      const apiKey = getSetting('ai_stability_key', '');
      if (!apiKey) return res.status(400).json({ error: 'Stability AI API key no configurada (Ajustes → IA)' });
      const model  = getSetting('ai_stability_model', 'stable-diffusion-xl-1024-v1-0');
      const base64 = imageDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
      const imgBuf = Buffer.from(base64, 'base64');
      const fd = new FormData();
      fd.append('init_image', new Blob([imgBuf], { type: 'image/png' }), 'image.png');
      fd.append('init_image_mode', 'IMAGE_STRENGTH');
      fd.append('image_strength', String(Math.max(0.1, Math.min(1, 1 - strength))));
      fd.append('text_prompts[0][text]', prompt);
      fd.append('text_prompts[0][weight]', '1');
      fd.append('cfg_scale', '7');
      fd.append('samples', '1');
      fd.append('steps', '30');
      const r = await fetch(`https://api.stability.ai/v1/generation/${model}/image-to-image`, {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }, body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Stability AI error');
      resultDataUrl = 'data:image/png;base64,' + data.artifacts[0].base64;

    } else if (prov === 'replicate') {
      const apiKey = getSetting('ai_replicate_key', '');
      if (!apiKey) return res.status(400).json({ error: 'Replicate API key no configurada (Ajustes → IA)' });
      const model  = getSetting('ai_replicate_model', 'black-forest-labs/flux-dev-lora');
      const createR = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: model, input: { prompt, image: imageDataUrl, strength } }),
      });
      const pred = await createR.json();
      if (!createR.ok) throw new Error(pred.detail || 'Replicate error');
      let output = null;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const pollR  = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Token ${apiKey}` } });
        const pollD  = await pollR.json();
        if (pollD.status === 'succeeded') { output = pollD.output; break; }
        if (pollD.status === 'failed')    throw new Error('Replicate generation failed');
      }
      if (!output) throw new Error('Replicate timeout (>60s)');
      const imgUrl  = Array.isArray(output) ? output[0] : output;
      const imgResp = await fetch(imgUrl);
      const imgBuf  = Buffer.from(await imgResp.arrayBuffer());
      resultDataUrl = 'data:image/png;base64,' + imgBuf.toString('base64');

    } else {
      return res.status(400).json({ error: `Proveedor desconocido: ${prov}` });
    }

    res.json({ imageDataUrl: resultDataUrl });
  } catch (err) {
    console.error('[ai/edit]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
