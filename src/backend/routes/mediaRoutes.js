'use strict';

const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const sharp  = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/connection');

// Point fluent-ffmpeg at the bundled ffmpeg binary (ffmpeg-static)
let _ffmpeg = null;
try {
  _ffmpeg = require('fluent-ffmpeg');
  try {
    const ffmpegBin = require('ffmpeg-static');
    if (ffmpegBin) _ffmpeg.setFfmpegPath(ffmpegBin);
  } catch (_) { /* rely on system PATH */ }
} catch (_) { /* fluent-ffmpeg not installed */ }

// ── Ensure download_count column exists (idempotent) ─────────────────────────
function _ensureDownloadCount() {
  try {
    getDb().prepare('ALTER TABLE media ADD COLUMN download_count INTEGER DEFAULT 0').run();
  } catch (_) { /* column already exists — ignore */ }
}
_ensureDownloadCount();

// multer: destination resolves per-request from req.appPaths (set by server.js middleware)
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(req.appPaths.userData, 'media');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ok = [
      'image/jpeg','image/png','image/webp','image/gif','image/bmp',
      'video/mp4','video/quicktime','video/x-msvideo',
    ].includes(file.mimetype) || file.mimetype.startsWith('video/webm');
    cb(ok ? null : new Error('Tipo de archivo no permitido'), ok);
  },
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

// ── GET /api/media ────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { page = 1, perPage = 20, type, search, favorite, albumId, sortBy,
          minSize, maxSize, minRating } = req.query;
  const db = getDb();
  try {
    let q = 'SELECT * FROM media WHERE 1=1';
    const params = [];
    if (type && type !== 'all') { q += ' AND media_type = ?'; params.push(type); }
    if (favorite === 'true')    { q += ' AND is_favorite = 1'; }
    if (search)                 { q += ' AND (file_name LIKE ? OR COALESCE(title,"") LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (albumId)                { q += ' AND album_id = ?'; params.push(parseInt(albumId)); }
    if (minSize)    { q += ' AND file_size >= ?'; params.push(parseFloat(minSize) * 1024 * 1024); }
    if (maxSize)    { q += ' AND file_size <= ?'; params.push(parseFloat(maxSize) * 1024 * 1024); }
    if (minRating)  { q += ' AND COALESCE(rating,0) >= ?'; params.push(parseFloat(minRating)); }

    const cnt    = db.prepare(q.replace('SELECT *', 'SELECT COUNT(*) as cnt')).get(...params).cnt;
    const offset = (parseInt(page) - 1) * parseInt(perPage);
    const sortMap = {
      date_desc:  'created_at DESC',
      date_asc:   'created_at ASC',
      size_desc:  'file_size DESC',
      size_asc:   'file_size ASC',
      views:      'view_count DESC',
      likes:      'likes DESC',
      rating:     'rating DESC',
      downloads:  'COALESCE(download_count,0) DESC',
      modified:   'COALESCE(updated_at, created_at) DESC',
    };
    const orderBy = sortMap[sortBy] || 'created_at DESC';
    q += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(parseInt(perPage), offset);

    res.json({ items: db.prepare(q).all(...params), total: cnt, page: parseInt(page), perPage: parseInt(perPage) });
  } catch (err) {
    console.error('[media] list:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/media/stats ──────────────────────────────────────────────────────
router.get('/stats', (_req, res) => {
  const db = getDb();
  try {
    const photoCount = db.prepare("SELECT COUNT(*) as cnt FROM media WHERE media_type='photo'").get().cnt;
    const videoCount = db.prepare("SELECT COUNT(*) as cnt FROM media WHERE media_type='video'").get().cnt;
    const diskBytes  = db.prepare('SELECT COALESCE(SUM(file_size),0) as tot FROM media').get().tot;
    res.json({ photoCount, videoCount, diskBytes });
  } catch (err) {
    console.error('[media] stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/media/:id ────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const m = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    res.json(m);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/media/:id/view ───────────────────────────────────────────────────
router.get('/:id/view', (req, res) => {
  const db = getDb();
  try {
    const m = db.prepare('SELECT file_path FROM media WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE media SET view_count = view_count + 1 WHERE id = ?').run(req.params.id);
    res.sendFile(m.file_path);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/media/:id/thumb ──────────────────────────────────────────────────
router.get('/:id/thumb', (req, res) => {
  const db = getDb();
  try {
    const m = db.prepare('SELECT thumbnail_path FROM media WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (m.thumbnail_path && fs.existsSync(m.thumbnail_path)) return res.sendFile(m.thumbnail_path);
    res.status(404).json({ error: 'No thumbnail' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/media/upload ────────────────────────────────────────────────────
// Always converts photos to WEBP; videos are stored as-is.
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });

  const db        = getDb();
  const tmpPath   = req.file.path;
  const origName  = req.file.originalname;
  const mimeType  = req.file.mimetype;
  const isPhoto   = mimeType.startsWith('image/');
  const mediaType = isPhoto ? 'photo' : 'video';
  const mediaDir  = path.join(req.appPaths.userData, 'media');

  let filePath      = tmpPath;
  let fileSize      = req.file.size;
  let thumbnailPath = null;
  let width  = null;
  let height = null;
  let finalMime = mimeType;

  try {
    if (isPhoto) {
      const base      = path.join(mediaDir, uuidv4());
      const webpPath  = `${base}.webp`;
      const thumbPath = `${base}_thumb.webp`;

      const meta = await sharp(tmpPath).metadata();
      width  = meta.width  || null;
      height = meta.height || null;

      // Full resolution → WEBP quality 85
      await sharp(tmpPath).webp({ quality: 85 }).toFile(webpPath);

      // Thumbnail 300×300 → WEBP quality 75
      await sharp(tmpPath)
        .resize(300, 300, { fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toFile(thumbPath);

      // Remove original — only keep WEBP
      // On Windows, Sharp may hold the file handle briefly; retry async on EPERM
      if (fs.existsSync(tmpPath) && tmpPath !== webpPath) {
        try {
          fs.unlinkSync(tmpPath);
        } catch (_) {
          setTimeout(() => {
            try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
          }, 800);
        }
      }

      filePath      = webpPath;
      fileSize      = fs.statSync(webpPath).size;
      thumbnailPath = thumbPath;
      finalMime     = 'image/webp';
    }

    const result = db.prepare(`
      INSERT INTO media
        (file_name, file_path, file_size, mime_type, media_type,
         thumbnail_path, width, height, original_format, compressed_format)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      origName, filePath, fileSize, finalMime, mediaType,
      thumbnailPath, width, height,
      mimeType,
      isPhoto ? 'webp' : path.extname(origName).slice(1) || 'mp4'
    );

    res.json({
      id:             result.lastInsertRowid,
      file_name:      origName,
      file_path:      filePath,
      file_size:      fileSize,
      media_type:     mediaType,
      thumbnail_path: thumbnailPath,
    });
  } catch (err) {
    console.error('[media] upload:', err.message);
    if (fs.existsSync(tmpPath)) try { fs.unlinkSync(tmpPath); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/media/:id/like ──────────────────────────────────────────────────
router.post('/:id/like', (req, res) => {
  const db = getDb();
  try {
    const m = db.prepare('SELECT likes FROM media WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    const next = (m.likes || 0) + 1;
    db.prepare('UPDATE media SET likes = ? WHERE id = ?').run(next, req.params.id);
    res.json({ likes: next });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/media/:id/rate ──────────────────────────────────────────────────
router.post('/:id/rate', (req, res) => {
  const db = getDb();
  const r = parseFloat(req.body.rating);
  if (!r || r < 1 || r > 10) return res.status(400).json({ error: 'Rating must be 1–10' });
  try {
    const m = db.prepare('SELECT rating, rating_count FROM media WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    const count = (m.rating_count || 0) + 1;
    const avg   = ((m.rating || 0) * (m.rating_count || 0) + r) / count;
    db.prepare('UPDATE media SET rating = ?, rating_count = ? WHERE id = ?').run(avg, count, req.params.id);
    res.json({ rating: avg, rating_count: count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/media/:id/meta ─────────────────────────────────────────────────
router.patch('/:id/meta', (req, res) => {
  const db = getDb();
  const { title = '', description = '' } = req.body;
  try {
    const m = db.prepare('SELECT id FROM media WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE media SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(title, description, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/media/:id/video-thumb ──────────────────────────────────────────
// Receives a PNG blob from canvas capture and stores it as WEBP thumbnail.
const thumbUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(req.appPaths.userData, 'media');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, _file, cb) => cb(null, `${uuidv4()}_vthumb_tmp.png`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});
router.post('/:id/video-thumb', thumbUpload.single('thumb'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No thumbnail received' });
  const db = getDb();
  try {
    const m = db.prepare('SELECT id, thumbnail_path FROM media WHERE id = ?').get(req.params.id);
    if (!m) { try { fs.unlinkSync(req.file.path); } catch (_) {} return res.status(404).json({ error: 'Not found' }); }

    const mediaDir  = path.join(req.appPaths.userData, 'media');
    const thumbPath = path.join(mediaDir, `${uuidv4()}_thumb.webp`);

    await sharp(req.file.path)
      .resize(400, 225, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(thumbPath);

    try { fs.unlinkSync(req.file.path); } catch (_) {}
    if (m.thumbnail_path) { try { if (fs.existsSync(m.thumbnail_path)) fs.unlinkSync(m.thumbnail_path); } catch (_) {} }

    db.prepare('UPDATE media SET thumbnail_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(thumbPath, req.params.id);
    res.json({ success: true });
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/media/:id/favorite ─────────────────────────────────────────────
router.post('/:id/favorite', (req, res) => {
  const db = getDb();
  try {
    const m = db.prepare('SELECT is_favorite FROM media WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    const next = 1 - m.is_favorite;
    db.prepare('UPDATE media SET is_favorite = ? WHERE id = ?').run(next, req.params.id);
    res.json({ isFavorite: next === 1 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/media/:id/edit ──────────────────────────────────────────────────
// Accepts: rotation, width, height, crop {x,y,w,h}, effects {brightness,contrast,
//   saturation,blur,sharpen,grayscale,invert}, quality.
// Writes to new UUID-based files — never touches the input while Sharp holds a
// read handle on Windows (avoids EPERM on unlink/rename).
router.post('/:id/edit', async (req, res) => {
  const db = getDb();
  try {
    const m = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });

    const {
      rotation = 0,
      width,
      height,
      crop,
      effects = {},
      quality = 'high',
    } = req.body;

    const qualityMap = { high: 90, medium: 80, low: 60 };
    const q = qualityMap[quality] || 90;

    const mediaDir = path.dirname(m.file_path);
    const base     = path.join(mediaDir, uuidv4());
    const newPath  = `${base}.webp`;
    const newThumb = `${base}_thumb.webp`;

    // Read actual file dimensions first — DB values may lag after a previous edit
    const srcMeta = await sharp(m.file_path).metadata();
    const srcW    = srcMeta.width  || 99999;
    const srcH    = srcMeta.height || 99999;

    let pipeline = sharp(m.file_path);

    // 1. Crop first (coordinates must be clamped to actual image bounds or Sharp throws)
    if (crop && parseInt(crop.w) > 0 && parseInt(crop.h) > 0) {
      const cx = Math.max(0, Math.min(parseInt(crop.x) || 0, srcW - 1));
      const cy = Math.max(0, Math.min(parseInt(crop.y) || 0, srcH - 1));
      const cw = Math.max(1, Math.min(parseInt(crop.w), srcW - cx));
      const ch = Math.max(1, Math.min(parseInt(crop.h), srcH - cy));
      pipeline = pipeline.extract({ left: cx, top: cy, width: cw, height: ch });
    }

    // 2. Rotation
    if (rotation && parseInt(rotation) % 360 !== 0) {
      pipeline = pipeline.rotate(parseInt(rotation));
    }

    // 3. Resize — only if the caller explicitly requested dimensions smaller than source
    const rw = parseInt(width);
    const rh = parseInt(height);
    if ((rw > 0 && rw < srcW) || (rh > 0 && rh < srcH)) {
      pipeline = pipeline.resize(
        rw > 0 ? rw : null,
        rh > 0 ? rh : null,
        { withoutEnlargement: true, fit: 'inside' },
      );
    }

    // 4. Effects
    const {
      brightness = 1, saturation = 1, contrast = 1,
      blur = 0, sharpen = 0,
      grayscale = false, invert = false,
    } = effects;

    const brt = parseFloat(brightness) || 1;
    const sat = parseFloat(saturation) || 1;
    if (brt !== 1 || sat !== 1) {
      pipeline = pipeline.modulate({ brightness: brt, saturation: sat });
    }

    const con = parseFloat(contrast) || 1;
    if (con !== 1) {
      // linear: output = a*input + b, centered at midpoint 128
      pipeline = pipeline.linear(con, Math.round(128 * (1 - con)));
    }

    const blurVal = parseFloat(blur) || 0;
    if (blurVal > 0) {
      pipeline = pipeline.blur(Math.max(0.3, Math.min(blurVal, 100)));
    }

    const sharpVal = parseFloat(sharpen) || 0;
    if (sharpVal > 0) {
      pipeline = pipeline.sharpen(sharpVal);
    }

    if (grayscale) pipeline = pipeline.grayscale();
    if (invert)    pipeline = pipeline.negate();

    // 5. Output
    await pipeline.webp({ quality: q }).toFile(newPath);

    // 6. Regenerate thumbnail from the new file
    await sharp(newPath)
      .resize(300, 300, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(newThumb);

    const meta    = await sharp(newPath).metadata();
    const newSize = fs.statSync(newPath).size;

    db.prepare(`
      UPDATE media
        SET file_path = ?, thumbnail_path = ?, file_size = ?,
            width = ?, height = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPath, newThumb, newSize, meta.width || m.width, meta.height || m.height, req.params.id);

    // 7. Async-delete old files — Sharp may still hold handles on Windows
    const oldFiles = [m.file_path, m.thumbnail_path].filter(Boolean);
    setImmediate(() => {
      oldFiles.forEach(p => {
        const tryDelete = (n) => {
          try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {
            if (n > 0) setTimeout(() => tryDelete(n - 1), 1000);
          }
        };
        tryDelete(5);
      });
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[media] edit:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/media/:id/replace ──────────────────────────────────────────────
// Receives a rendered PNG/JPEG (from canvas export) and replaces the media file.
const replaceUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(req.appPaths.userData, 'media');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, _file, cb) => cb(null, `${uuidv4()}_replace_tmp.png`),
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
});
router.post('/:id/replace', replaceUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image received' });
  const db = getDb();
  try {
    const m = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
    if (!m) { try { fs.unlinkSync(req.file.path); } catch (_) {} return res.status(404).json({ error: 'Not found' }); }

    const mediaDir  = path.join(req.appPaths.userData, 'media');
    const base      = path.join(mediaDir, uuidv4());
    const newPath   = `${base}.webp`;
    const newThumb  = `${base}_thumb.webp`;

    const meta = await sharp(req.file.path).metadata();
    await sharp(req.file.path).webp({ quality: 90 }).toFile(newPath);
    await sharp(req.file.path)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(newThumb);

    try { fs.unlinkSync(req.file.path); } catch (_) {}

    const newSize = fs.statSync(newPath).size;
    db.prepare(`
      UPDATE media SET file_path=?, thumbnail_path=?, file_size=?,
        width=?, height=?, mime_type='image/webp', compressed_format='webp',
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(newPath, newThumb, newSize, meta.width || m.width, meta.height || m.height, req.params.id);

    const oldFiles = [m.file_path, m.thumbnail_path].filter(p => p && p !== newPath && p !== newThumb);
    setImmediate(() => oldFiles.forEach(p => {
      const tryDel = n => { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) { if (n > 0) setTimeout(() => tryDel(n-1), 1000); } };
      tryDel(4);
    }));

    res.json({ success: true, width: meta.width, height: meta.height });
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    console.error('[media] replace:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/media/:id/editor-state ────────────────────────────────────────
router.patch('/:id/editor-state', (req, res) => {
  const db = getDb();
  const editorState = req.body.editor_state;
  if (editorState === undefined) return res.status(400).json({ error: 'editor_state required' });
  try {
    const m = db.prepare('SELECT id FROM media WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    const val = editorState ? JSON.stringify(editorState) : null;
    db.prepare('UPDATE media SET editor_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(val, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/media/:id/rename ──────────────────────────────────────────────
// Updates file_name (display name) in DB only — actual file uses a UUID path.
router.patch('/:id/rename', (req, res) => {
  const db = getDb();
  const newName = (req.body.file_name || '').trim();
  if (!newName) return res.status(400).json({ error: 'file_name required' });
  try {
    const m = db.prepare('SELECT id FROM media WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE media SET file_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newName, req.params.id);
    res.json({ success: true, file_name: newName });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/media/:id/download ───────────────────────────────────────────────
router.get('/:id/download', (req, res) => {
  const db = getDb();
  try {
    const m = db.prepare('SELECT file_path, file_name FROM media WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (!fs.existsSync(m.file_path)) return res.status(404).json({ error: 'File not found on disk' });
    db.prepare('UPDATE media SET download_count = COALESCE(download_count,0) + 1 WHERE id = ?').run(req.params.id);
    res.download(m.file_path, m.file_name);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/media/:id/comments ───────────────────────────────────────────────
router.get('/:id/comments', (req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare(`SELECT * FROM comments WHERE entity_type='media' AND entity_id=? ORDER BY created_at DESC LIMIT 50`).all(req.params.id);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/media/:id/comments ──────────────────────────────────────────────
router.post('/:id/comments', (req, res) => {
  const db = getDb();
  const text   = (req.body.text || '').trim();
  const author = (req.body.author || 'Usuario').trim();
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const r = db.prepare(`INSERT INTO comments (entity_type, entity_id, text, author) VALUES ('media',?,?,?)`).run(req.params.id, text, author);
    res.json({ id: r.lastInsertRowid, text, author, created_at: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/media/:id/trim ──────────────────────────────────────────────────
// Trims a video using ffmpeg. Overwrites the original file with the trimmed segment.
router.post('/:id/trim', (req, res) => {
  const db       = getDb();
  const startSec = parseFloat(req.body.start);
  const endSec   = parseFloat(req.body.end);

  if (isNaN(startSec) || isNaN(endSec) || startSec < 0 || endSec <= startSec) {
    return res.status(400).json({ error: 'Parámetros start/end inválidos (start debe ser < end)' });
  }
  try {
    const m = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (m.media_type !== 'video') return res.status(400).json({ error: 'Solo se pueden cortar videos' });

    if (!_ffmpeg) return res.status(500).json({ error: 'FFmpeg no disponible en este servidor' });
    const inputPath  = m.file_path;
    const ext        = path.extname(inputPath);
    const outputPath = path.join(path.dirname(inputPath), uuidv4() + ext);

    _ffmpeg(inputPath)
      .setStartTime(startSec)
      .setDuration(endSec - startSec)
      .output(outputPath)
      .videoCodec('copy')
      .audioCodec('copy')
      .on('end', () => {
        try {
          const stat = fs.statSync(outputPath);
          db.prepare('UPDATE media SET file_path = ?, file_size = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(outputPath, stat.size, m.id);
          try { fs.unlinkSync(inputPath); } catch (_) {}
          res.json({ success: true, file_size: stat.size });
        } catch (err) { res.status(500).json({ error: err.message }); }
      })
      .on('error', (err) => {
        try { fs.unlinkSync(outputPath); } catch (_) {}
        res.status(500).json({ error: 'FFmpeg: ' + err.message });
      })
      .run();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/media/:id/gif ───────────────────────────────────────────────────
// Converts the first N seconds of a video to an animated GIF using ffmpeg.
// Body: { start?: number, duration?: number }  (duration capped at 10s)
// Returns: { id, file_path } on success, or { error } with 500 if ffmpeg unavailable.
router.post('/:id/gif', (req, res) => {
  const db = getDb();
  try {
    const m = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    if (m.media_type !== 'video') return res.status(400).json({ error: 'Solo se pueden convertir videos' });

    if (!_ffmpeg) return res.status(500).json({ error: 'FFmpeg no disponible' });
    const ffmpeg = _ffmpeg;

    const startSec    = Math.max(0, parseFloat(req.body.start)    || 0);
    const durationSec = Math.min(30, Math.max(0.5, parseFloat(req.body.duration) || 30));

    const inputPath = m.file_path;
    const gifName   = uuidv4() + '.gif';
    const gifPath   = path.join(path.dirname(inputPath), gifName);

    // Two-pass GIF with optimized palette
    const palettePath = path.join(path.dirname(inputPath), uuidv4() + '_palette.png');

    // Pass 1 — generate palette
    ffmpeg(inputPath)
      .setStartTime(startSec)
      .setDuration(durationSec)
      .videoFilters('fps=12,scale=480:-1:flags=lanczos,palettegen=stats_mode=diff')
      .output(palettePath)
      .on('end', () => {
        // Pass 2 — apply palette
        ffmpeg()
          .input(inputPath)
          .inputOptions([`-ss ${startSec}`, `-t ${durationSec}`])
          .input(palettePath)
          .complexFilter('fps=12,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle')
          .output(gifPath)
          .on('end', () => {
            try { if (fs.existsSync(palettePath)) fs.unlinkSync(palettePath); } catch (_) {}
            try {
              const stat    = fs.statSync(gifPath);
              const baseName = path.basename(m.file_name || 'video', path.extname(m.file_name || ''));
              const result  = db.prepare(`
                INSERT INTO media (file_name, file_path, file_size, mime_type, media_type, original_format, compressed_format)
                VALUES (?, ?, ?, 'image/gif', 'photo', 'gif', 'gif')
              `).run(`${baseName}.gif`, gifPath, stat.size);
              res.json({ id: result.lastInsertRowid, file_path: gifPath });
            } catch (err) { res.status(500).json({ error: err.message }); }
          })
          .on('error', (err) => {
            try { if (fs.existsSync(palettePath)) fs.unlinkSync(palettePath); } catch (_) {}
            try { if (fs.existsSync(gifPath))     fs.unlinkSync(gifPath);     } catch (_) {}
            if (err.message && err.message.toLowerCase().includes('ffmpeg')) {
              return res.status(500).json({ error: 'FFmpeg no disponible' });
            }
            res.status(500).json({ error: 'FFmpeg GIF pass 2: ' + err.message });
          })
          .run();
      })
      .on('error', (err) => {
        try { if (fs.existsSync(palettePath)) fs.unlinkSync(palettePath); } catch (_) {}
        if (err.message && err.message.toLowerCase().includes('ffmpeg')) {
          return res.status(500).json({ error: 'FFmpeg no disponible' });
        }
        res.status(500).json({ error: 'FFmpeg GIF pass 1: ' + err.message });
      })
      .run();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/media/:id ─────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const db = getDb();
  try {
    const m = db.prepare('SELECT file_path, thumbnail_path FROM media WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    [m.file_path, m.thumbnail_path].forEach(p => {
      if (p && fs.existsSync(p)) try { fs.unlinkSync(p); } catch (_) {}
    });
    db.prepare('DELETE FROM media WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
