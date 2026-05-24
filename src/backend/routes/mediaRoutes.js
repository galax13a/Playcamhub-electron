'use strict';

const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const sharp  = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/connection');

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
      'video/mp4','video/quicktime','video/webm','video/x-msvideo',
    ].includes(file.mimetype);
    cb(ok ? null : new Error('Tipo de archivo no permitido'), ok);
  },
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

// ── GET /api/media ────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { page = 1, perPage = 20, type, search, favorite, albumId } = req.query;
  const db = getDb();
  try {
    let q = 'SELECT * FROM media WHERE 1=1';
    const params = [];
    if (type && type !== 'all') { q += ' AND media_type = ?'; params.push(type); }
    if (favorite === 'true')    { q += ' AND is_favorite = 1'; }
    if (search)                 { q += ' AND file_name LIKE ?'; params.push(`%${search}%`); }
    if (albumId)                { q += ' AND album_id = ?'; params.push(parseInt(albumId)); }

    const cnt    = db.prepare(q.replace('SELECT *', 'SELECT COUNT(*) as cnt')).get(...params).cnt;
    const offset = (parseInt(page) - 1) * parseInt(perPage);
    q += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
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

    let pipeline = sharp(m.file_path);

    // 1. Crop first (before rotation/resize so coordinates match original pixels)
    if (crop && parseInt(crop.w) > 0 && parseInt(crop.h) > 0) {
      pipeline = pipeline.extract({
        left:   Math.max(0, parseInt(crop.x) || 0),
        top:    Math.max(0, parseInt(crop.y) || 0),
        width:  Math.max(1, parseInt(crop.w)),
        height: Math.max(1, parseInt(crop.h)),
      });
    }

    // 2. Rotation
    if (rotation && parseInt(rotation) % 360 !== 0) {
      pipeline = pipeline.rotate(parseInt(rotation));
    }

    // 3. Resize (width and/or height)
    const rw = parseInt(width);
    const rh = parseInt(height);
    if (rw > 0 || rh > 0) {
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
