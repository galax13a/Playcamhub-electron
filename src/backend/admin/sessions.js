'use strict';

/**
 * sessions.js — In-memory session store for the admin panel.
 *
 * Security features:
 *  • 32-byte random session token stored as an HttpOnly SameSite=Lax cookie.
 *  • 16-byte CSRF token stored inside each session entry.
 *  • Login rate limiting: 5 failed attempts per IP → 15-minute lockout.
 *  • Sessions expire after 24 h. Cleared on app restart (expected for a local app).
 *
 * Admin credentials (root@starcho.com / 123456x) are hardcoded here and are
 * completely separate from the application user table.
 */

const crypto = require('crypto');
const log    = require('electron-log');

// ── Config ────────────────────────────────────────────────────────────────────

const ADMIN_EMAIL    = 'root@starcho.com';
const ADMIN_PASSWORD = '123456x';
const COOKIE_NAME    = 'starcho_admin';
const MAX_AGE_MS     = 24 * 60 * 60 * 1000;   // 24 h session lifetime

const RATE_MAX_ATTEMPTS = 5;                   // failed logins before lockout
const RATE_LOCKOUT_MS   = 15 * 60 * 1000;     // 15-minute lockout window

// ── Session store ─────────────────────────────────────────────────────────────

// token → { createdAt: number, csrf: string }
const _store = new Map();

/** Creates a new session token + embedded CSRF token. Returns the session token. */
function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const csrf  = crypto.randomBytes(16).toString('hex');
  _store.set(token, { createdAt: Date.now(), csrf });
  return token;
}

/** Returns true if the session token is present and not expired. */
function validateSession(token) {
  if (!token) return false;
  const entry = _store.get(token);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > MAX_AGE_MS) {
    _store.delete(token);
    return false;
  }
  return true;
}

/** Removes a session (logout). */
function destroySession(token) {
  _store.delete(token);
}

// ── CSRF helpers ──────────────────────────────────────────────────────────────

/** Returns the CSRF token for a given session token, or '' if session not found. */
function getCsrfToken(sessionToken) {
  return _store.get(sessionToken)?.csrf ?? '';
}

/**
 * Returns true when the CSRF token in the request body matches the one stored
 * in the session. Uses a constant-time comparison to prevent timing attacks.
 */
function validateCsrf(sessionToken, bodyToken) {
  const stored = _store.get(sessionToken)?.csrf;
  if (!stored || !bodyToken) return false;
  // Both buffers must be the same byte length for timingSafeEqual
  const a = Buffer.from(stored,    'hex');
  const b = Buffer.from(bodyToken, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── Credentials ───────────────────────────────────────────────────────────────

/** Returns true when email + password match the admin credentials. */
function checkCredentials(email, password) {
  return email === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

// ip → { count: number, lockUntil: number | null }
const _attempts = new Map();

/** Returns true if the IP is currently in lockout. Clears expired lockouts automatically. */
function isRateLimited(ip) {
  const rec = _attempts.get(ip);
  if (!rec) return false;
  if (rec.lockUntil && Date.now() < rec.lockUntil) return true;
  if (rec.lockUntil && Date.now() >= rec.lockUntil) {
    // Lockout expired — reset the record
    _attempts.delete(ip);
  }
  return false;
}

/** Records a failed login attempt for the given IP. Triggers lockout at threshold. */
function recordFailedAttempt(ip) {
  const rec = _attempts.get(ip) ?? { count: 0, lockUntil: null };
  rec.count++;
  if (rec.count >= RATE_MAX_ATTEMPTS) {
    rec.lockUntil = Date.now() + RATE_LOCKOUT_MS;
    log.warn(`[admin] IP ${ip} locked out after ${RATE_MAX_ATTEMPTS} failed login attempts`);
  }
  _attempts.set(ip, rec);
}

/** Clears failed-attempt history for an IP (called on successful login). */
function clearAttempts(ip) {
  _attempts.delete(ip);
}

/** Returns the number of remaining attempts before lockout (for UI feedback). */
function remainingAttempts(ip) {
  const rec = _attempts.get(ip);
  if (!rec) return RATE_MAX_ATTEMPTS;
  return Math.max(0, RATE_MAX_ATTEMPTS - rec.count);
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

/** Parses the Cookie header into a plain key/value object. */
function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  raw.split(';').forEach(pair => {
    const [k, ...v] = pair.split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('=').trim());
  });
  return out;
}

/** Reads the admin session token from the request cookies. */
function getToken(req) {
  return parseCookies(req)[COOKIE_NAME];
}

/** Sets the admin session cookie on the response. */
function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/admin; Max-Age=${MAX_AGE_MS / 1000}; SameSite=Lax`,
  );
}

/** Clears the admin session cookie (forces re-login). */
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/admin; Max-Age=0`);
}

// ── Express middleware ────────────────────────────────────────────────────────

/**
 * requireAuth — redirect to /admin/login if the session is invalid or expired.
 * Attach this before protected route groups.
 */
function requireAuth(req, res, next) {
  if (validateSession(getToken(req))) return next();
  res.redirect('/admin/login');
}

/**
 * requireCsrf — validate the _csrf field in POST bodies against the session token.
 * Returns 403 if the token is missing or doesn't match.
 * Attach this to all state-changing POST routes.
 */
function requireCsrf(req, res, next) {
  const sessionToken = getToken(req);
  const bodyToken    = req.body?._csrf;
  if (!validateCsrf(sessionToken, bodyToken)) {
    log.warn('[admin] CSRF token mismatch on', req.method, req.path);
    return res.status(403).send('Token de seguridad inválido. Vuelve atrás y reintenta.');
  }
  next();
}

module.exports = {
  // Session
  createSession,
  validateSession,
  destroySession,
  // CSRF
  getCsrfToken,
  validateCsrf,
  // Credentials
  checkCredentials,
  // Rate limiting
  isRateLimited,
  recordFailedAttempt,
  clearAttempts,
  remainingAttempts,
  // Cookies
  getToken,
  setSessionCookie,
  clearSessionCookie,
  // Middleware
  requireAuth,
  requireCsrf,
  // Exposed for layout template
  ADMIN_EMAIL,
};
