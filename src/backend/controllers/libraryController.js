'use strict';

const { getDb }     = require('../database/connection');
const Song          = require('../models/Song');
const DownloadQueue = require('../models/DownloadQueue');
const log           = require('electron-log');
const fs            = require('fs');
const path          = require('path');

function validateLicenseKey(key) {
  const clean = (key || '').trim().toUpperCase();
  if (!/^PRYU-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(clean)) return false;
  const chars = clean.replace(/-/g, '');
  const sum = [...chars].reduce((a, c) => {
    const v = c >= '0' && c <= '9' ? parseInt(c, 10) : c.charCodeAt(0) - 55;
    return a + v;
  }, 0);
  return sum % 43 === 0;
}

const libraryController = {
  exportLibrary(_req, res) {
    try {
      const db = getDb();
      const songs = db.prepare(`
        SELECT s.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
        FROM songs s LEFT JOIN categories c ON s.category_id = c.id
        ORDER BY s.added_at ASC
      `).all();
      const categories = db.prepare('SELECT * FROM categories ORDER BY id ASC').all();
      const playlists  = db.prepare('SELECT * FROM playlists ORDER BY id ASC').all();
      const playlistSongs = db.prepare('SELECT * FROM playlist_songs ORDER BY playlist_id, position ASC').all();

      const playlistData = playlists.map(pl => ({
        ...pl,
        songs: playlistSongs.filter(ps => ps.playlist_id === pl.id).map(ps => ps.song_id),
      }));

      res.json({
        version:     '1.0',
        app:         'PlayRyu',
        exported_at: new Date().toISOString(),
        songs: songs.map(s => ({
          id:             s.id,
          title:          s.title,
          artist:         s.artist,
          album:          s.album,
          duration:       s.duration,
          youtube_url:    s.youtube_url,
          youtube_id:     s.youtube_id,
          type:           s.type,
          is_favorite:    s.is_favorite,
          category_name:  s.category_name,
          category_color: s.category_color,
          category_icon:  s.category_icon,
        })),
        categories,
        playlists: playlistData,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async importLibrary(req, res) {
    try {
      const { data, redownload = false } = req.body;
      if (!data || !Array.isArray(data.songs)) {
        return res.status(400).json({ error: 'Invalid library file' });
      }

      const db    = getDb();
      const stats = { categories: 0, songs: 0, playlists: 0, queued: 0 };
      const batchId = redownload ? Date.now().toString() : null;

      // 1. Import categories
      const catMap = {};
      for (const cat of (data.categories || [])) {
        try {
          db.prepare('INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)')
            .run(cat.name, cat.color || '#8B5CF6', cat.icon || '🎵');
          stats.categories++;
        } catch (_) {}
        const found = db.prepare('SELECT id FROM categories WHERE name = ?').get(cat.name);
        if (found) catMap[cat.id] = found.id;
      }

      // 2. Import songs
      const songMap = {};
      const queueItems = [];

      for (const s of data.songs) {
        let existing = s.youtube_id
          ? db.prepare('SELECT id FROM songs WHERE youtube_id = ?').get(s.youtube_id)
          : null;

        let catId = null;
        if (s.category_name) {
          const cat = db.prepare('SELECT id FROM categories WHERE name = ?').get(s.category_name);
          catId = cat?.id ?? null;
        }

        if (!existing) {
          try {
            const r = db.prepare(`
              INSERT INTO songs (title, artist, album, duration, youtube_url, youtube_id,
                                 category_id, type, is_favorite)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(s.title, s.artist || 'Unknown', s.album || 'Unknown',
                   s.duration || 0, s.youtube_url || null, s.youtube_id || null,
                   catId, s.type || 'audio', s.is_favorite ? 1 : 0);
            existing = { id: r.lastInsertRowid };
            stats.songs++;
          } catch (_) {
            existing = s.youtube_id
              ? db.prepare('SELECT id FROM songs WHERE youtube_id = ?').get(s.youtube_id)
              : null;
          }
        }

        if (existing) {
          songMap[s.id] = existing.id;
          if (redownload && s.youtube_url) {
            queueItems.push({
              youtube_url: s.youtube_url,
              youtube_id:  s.youtube_id || null,
              title:       s.title,
              format:      s.type === 'video' ? 'video' : 'audio',
              batch_id:    batchId,
            });
          }
        }
      }

      // 3. Import playlists
      for (const pl of (data.playlists || [])) {
        if (pl.id === 1) continue; // skip favorites placeholder
        let plId;
        try {
          const r = db.prepare('INSERT OR IGNORE INTO playlists (name, description) VALUES (?, ?)')
            .run(pl.name, pl.description || '');
          if (r.changes) { plId = r.lastInsertRowid; stats.playlists++; }
        } catch (_) {}
        if (!plId) {
          const found = db.prepare('SELECT id FROM playlists WHERE name = ?').get(pl.name);
          plId = found?.id;
        }
        if (plId) {
          for (const oldSongId of (pl.songs || [])) {
            const newSongId = songMap[oldSongId];
            if (newSongId) {
              try {
                db.prepare('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, 0)')
                  .run(plId, newSongId);
              } catch (_) {}
            }
          }
        }
      }

      // 4. Queue downloads
      if (redownload && queueItems.length && req.appPaths) {
        const { _runDownload } = require('./downloadController');
        const created = queueItems.map(item => DownloadQueue.create(item));
        stats.queued = created.length;

        // Process sequentially in background
        (async () => {
          for (const item of created) {
            await _runDownload(item.id, item.format, 'best', req.appPaths).catch(() => {});
          }
          log.info(`[Migration] batch ${batchId} complete`);
        })();
      }

      res.json({ ...stats, batchId });
    } catch (err) {
      log.error('[Import] failed:', err.message);
      res.status(500).json({ error: err.message });
    }
  },

  migrationStatus(req, res) {
    const { batchId } = req.query;
    if (!batchId) return res.status(400).json({ error: 'batchId required' });
    try {
      const items = DownloadQueue.findByBatch(batchId);
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  activateLicense(req, res) {
    const { key } = req.body;
    if (!validateLicenseKey(key)) {
      return res.status(400).json({ error: 'Invalid license key' });
    }
    const Settings = require('../models/Settings');
    Settings.setMany({ pro: 'true', license_key: key.trim().toUpperCase() });
    res.json({ ok: true, pro: true });
  },

  resetLibrary(req, res) {
    try {
      const db       = getDb();
      const appPaths = req.appPaths;

      // 1. Delete music files from disk
      if (appPaths?.music && fs.existsSync(appPaths.music)) {
        fs.readdirSync(appPaths.music).forEach(f => {
          try { fs.unlinkSync(path.join(appPaths.music, f)); } catch (_) {}
        });
      }

      // 2. Delete thumbnail files from disk
      if (appPaths?.thumbnails && fs.existsSync(appPaths.thumbnails)) {
        fs.readdirSync(appPaths.thumbnails).forEach(f => {
          try { fs.unlinkSync(path.join(appPaths.thumbnails, f)); } catch (_) {}
        });
      }

      // 3. Wipe DB tables
      db.exec(`
        DELETE FROM history;
        DELETE FROM playlist_songs;
        DELETE FROM download_queue;
        DELETE FROM songs;
        DELETE FROM playlists;
        DELETE FROM categories;
        DELETE FROM settings;
      `);

      // 4. Re-seed defaults (mirrors migrations.js)
      const upsert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
      [
        ['theme',           'dark'],
        ['volume',          '80'],
        ['download_quality','bestaudio'],
        ['download_format', 'mp3'],
        ['auto_play',       'true'],
      ].forEach(([k, v]) => upsert.run(k, v));

      const catInsert = db.prepare('INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)');
      [
        ['Pop',       '#FF3366', '🎤'],
        ['Rock',      '#FF6B35', '🎸'],
        ['Hip-Hop',   '#8B5CF6', '🎤'],
        ['Electronic','#06D6A0', '🎛'],
        ['Jazz',      '#FFD166', '🎷'],
        ['Classical', '#4CC9F0', '🎻'],
        ['Reggaeton', '#F72585', '💃'],
        ['Lo-Fi',     '#7B8CDE', '🌙'],
      ].forEach(([n, c, i]) => catInsert.run(n, c, i));

      db.prepare(`INSERT OR IGNORE INTO playlists (id, name, description) VALUES (1, 'Favorites', 'Your liked songs')`).run();

      log.info('[Reset] Factory reset complete');
      res.json({ ok: true });
    } catch (err) {
      log.error('[Reset] failed:', err.message);
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = libraryController;
