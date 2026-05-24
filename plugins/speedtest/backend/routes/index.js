'use strict';

const router = require('express').Router();
const crypto = require('crypto');

// ── GET /api/speedtest/ping ───────────────────────────────────────────────────
router.get('/ping', (_req, res) => {
  res.json({ pong: true, ts: Date.now() });
});

// ── GET /api/speedtest/download ───────────────────────────────────────────────
// Streams N megabytes of pseudo-random data (no cache).
router.get('/download', (req, res) => {
  const mb   = Math.min(Math.max(parseInt(req.query.mb) || 5, 1), 100);
  const size = mb * 1024 * 1024;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', size);
  res.setHeader('Cache-Control', 'no-store, no-cache');
  res.setHeader('X-Test-Size', size);

  // Stream in 64KB chunks to avoid blocking the event loop
  const CHUNK = 64 * 1024;
  let sent = 0;

  function sendChunk() {
    if (sent >= size) { res.end(); return; }
    const chunk = Math.min(CHUNK, size - sent);
    const buf   = crypto.randomBytes(chunk);
    sent += chunk;
    if (!res.write(buf)) {
      res.once('drain', sendChunk);
    } else {
      setImmediate(sendChunk);
    }
  }

  sendChunk();
});

// ── POST /api/speedtest/upload ────────────────────────────────────────────────
// Receives binary data, discards it, returns timing info.
router.post('/upload', (req, res) => {
  let received = 0;
  req.on('data', chunk => { received += chunk.length; });
  req.on('end', () => {
    res.json({ received, ts: Date.now() });
  });
  req.on('error', () => res.status(500).json({ error: 'Upload error' }));
});

module.exports = router;
