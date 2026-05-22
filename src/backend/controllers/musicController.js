'use strict';

const Song    = require('../models/Song');
const History = require('../models/History');
const fs      = require('fs');
const path    = require('path');

const musicController = {
  list(req, res) {
    const { limit, offset, category, search, favorite, type } = req.query;
    const songs = Song.findAll({
      limit:      parseInt(limit)  || 200,
      offset:     parseInt(offset) || 0,
      categoryId: category ? parseInt(category) : null,
      search:     search   || null,
      favorite:   favorite === 'true',
      type:       type     || null,
    });
    res.json({ songs, total: songs.length });
  },

  getById(req, res) {
    const song = Song.findById(parseInt(req.params.id));
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json(song);
  },

  update(req, res) {
    const id      = parseInt(req.params.id);
    const allowed = ['title', 'artist', 'album', 'category_id', 'notes'];
    const fields  = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) fields[k] = req.body[k]; });
    const song = Song.update(id, fields);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json(song);
  },

  delete(req, res) {
    const id   = parseInt(req.params.id);
    const song = Song.findById(id);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    if (song.file_path) {
      const full = path.join(req.appPaths.music, song.file_path);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
    if (song.thumbnail) {
      const full = path.join(req.appPaths.thumbnails, song.thumbnail);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
    Song.delete(id);
    res.json({ ok: true });
  },

  toggleFavorite(req, res) {
    const song = Song.toggleFavorite(parseInt(req.params.id));
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json(song);
  },

  played(req, res) {
    const id = parseInt(req.params.id);
    Song.incrementPlayCount(id);
    History.add(id);
    res.json({ ok: true });
  },

  recent(req, res) {
    res.json(Song.recent(parseInt(req.query.limit) || 12));
  },

  favorites(req, res) {
    res.json(Song.favorites());
  },

  stats(req, res) {
    const total      = Song.count();
    const audioCount = Song.countByType('audio');
    const videoCount = Song.countByType('video');
    const diskBytes  = _diskUsage(req.appPaths?.music || '');
    res.json({ total, audioCount, videoCount, diskBytes });
  },

  mostPlayed(req, res) {
    res.json(Song.mostPlayed(parseInt(req.query.limit) || 12));
  },

  changeThumbnail(req, res) {
    const id   = parseInt(req.params.id);
    const song = Song.findById(id);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    const { filePath } = req.body;
    if (!filePath || !fs.existsSync(filePath)) return res.status(400).json({ error: 'filePath is required and must exist' });

    const ext      = path.extname(filePath).toLowerCase();
    const fileId   = path.basename(song.file_path, path.extname(song.file_path));
    const thumbName = `${fileId}${ext}`;
    const destPath  = path.join(req.appPaths.thumbnails, thumbName);

    if (song.thumbnail) {
      const old = path.join(req.appPaths.thumbnails, song.thumbnail);
      if (fs.existsSync(old) && old !== destPath) fs.unlinkSync(old);
    }

    fs.copyFileSync(filePath, destPath);
    const updated = Song.update(id, { thumbnail: thumbName });
    res.json(updated);
  },

  // History
  history(req, res) {
    const limit = parseInt(req.query.limit) || 26;
    res.json(History.getLast(limit));
  },

  clearHistory(_req, res) {
    History.clear();
    res.json({ ok: true });
  },
};

function _diskUsage(dir) {
  try {
    return fs.readdirSync(dir).reduce((total, f) => {
      try { return total + fs.statSync(path.join(dir, f)).size; }
      catch (_) { return total; }
    }, 0);
  } catch (_) { return 0; }
}

module.exports = musicController;
