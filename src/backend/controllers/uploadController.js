'use strict';

const fs     = require('fs');
const path   = require('path');
const log    = require('electron-log');
const { v4: uuidv4 } = require('uuid');
const Song   = require('../models/Song');

const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.flac', '.ogg', '.wav', '.aac', '.wma', '.opus']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mkv', '.mov', '.avi', '.m4v']);

const uploadController = {
  async upload(req, res) {
    const { paths } = req.body;
    if (!Array.isArray(paths) || !paths.length) {
      return res.status(400).json({ error: 'paths array is required' });
    }

    const results = [];
    for (const srcPath of paths) {
      try {
        const song = _processFile(srcPath, req.appPaths);
        results.push({ ok: true, song });
      } catch (err) {
        log.error('[Upload] failed for', srcPath, '—', err.message);
        results.push({ ok: false, path: srcPath, error: err.message });
      }
    }

    res.json(results);
  },
};

function _processFile(srcPath, appPaths) {
  if (!fs.existsSync(srcPath)) throw new Error('File not found');

  const ext  = path.extname(srcPath).toLowerCase();
  const type = AUDIO_EXTS.has(ext) ? 'audio' : VIDEO_EXTS.has(ext) ? 'video' : null;
  if (!type) throw new Error(`Unsupported format: ${ext}`);

  const fileId   = uuidv4();
  const destName = `${fileId}${ext}`;
  const destPath = path.join(appPaths.music, destName);

  fs.copyFileSync(srcPath, destPath);

  let title     = path.basename(srcPath, ext).replace(/_/g, ' ');
  let artist    = 'Unknown';
  let album     = 'Unknown';
  let duration  = 0;
  let thumbnail = null;

  // Extract ID3 tags from MP3
  if (ext === '.mp3') {
    try {
      const NodeID3 = require('node-id3');
      const tags    = NodeID3.read(srcPath);
      if (tags.title)  title  = tags.title;
      if (tags.artist) artist = tags.artist;
      if (tags.album)  album  = tags.album;
      if (tags.image && tags.image.imageBuffer) {
        const thumbName = `${fileId}.jpg`;
        fs.writeFileSync(path.join(appPaths.thumbnails, thumbName), tags.image.imageBuffer);
        thumbnail = thumbName;
      }
    } catch (_) {}
  }

  return Song.create({ title, artist, album, duration, file_path: destName, thumbnail, type });
}

module.exports = uploadController;
