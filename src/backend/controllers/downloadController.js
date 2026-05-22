'use strict';

const path  = require('path');
const fs    = require('fs');
const { v4: uuidv4 } = require('uuid');
const log   = require('electron-log');
const YTDlpWrap = require('yt-dlp-wrap').default;
const Song  = require('../models/Song');
const DownloadQueue = require('../models/DownloadQueue');

// Active download processes keyed by queue id
const _active = new Map();

function _getBinary(appPaths) {
  const bin = path.join(appPaths.bin, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  if (!fs.existsSync(bin)) throw new Error('yt-dlp binary not found at ' + bin);
  return new YTDlpWrap(bin);
}

const downloadController = {
  // GET /download-queue
  async list(req, res) {
    try {
      const items = DownloadQueue.findAll();
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // POST /download-queue
  async add(req, res) {
    const { url, format = 'audio' } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url is required' });

    try {
      const yt = _getBinary(req.appPaths);
      const info = await yt.getVideoInfo(url);
      const title     = info.title     || 'Unknown';
      const thumbnail = info.thumbnail || null;
      const youtubeId = info.id        || null;

      const item = DownloadQueue.create({
        youtube_url: url,
        youtube_id:  youtubeId,
        title,
        thumbnail,
        format,
      });

      // Start download in the background
      _startDownload(item, req.appPaths).catch(err => {
        log.error('[Download] background error for', item.id, err.message);
      });

      res.json(item);
    } catch (err) {
      log.error('[Download] add failed:', err.message);
      res.status(500).json({ error: err.message });
    }
  },

  // DELETE /download-queue/:id
  async remove(req, res) {
    const id = parseInt(req.params.id);
    try {
      const proc = _active.get(id);
      if (proc) { try { proc.kill(); } catch (_) {} _active.delete(id); }
      DownloadQueue.delete(id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // DELETE /download-queue  (clear finished)
  async clearFinished(req, res) {
    try {
      DownloadQueue.clearFinished();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

async function _startDownload(item, appPaths) {
  const fileId   = uuidv4();
  const ext      = item.format === 'video' ? '.mp4' : '.mp3';
  // Use %(ext)s so yt-dlp picks the real extension; we rename after
  const destBase = path.join(appPaths.music, fileId);
  const dest     = `${destBase}.%(ext)s`;
  const yt       = _getBinary(appPaths);

  const args = item.format === 'video'
    ? [item.youtube_url, '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
       '--merge-output-format', 'mp4', '-o', dest, '--no-playlist']
    : [item.youtube_url, '-x', '--audio-format', 'mp3', '--audio-quality', '0',
       '-o', dest, '--no-playlist'];

  log.info('[Download] starting', item.id, item.format, item.youtube_url);
  DownloadQueue.updateProgress(item.id, 0);

  await new Promise((resolve, reject) => {
    const proc = yt.exec(args)
      .on('progress', (p) => {
        if (p && typeof p.percent === 'number') {
          DownloadQueue.updateProgress(item.id, p.percent);
        }
      })
      .on('error', (err) => {
        _active.delete(item.id);
        DownloadQueue.fail(item.id, err.message);
        reject(err);
      })
      .on('close', () => {
        _active.delete(item.id);
        resolve();
      });

    _active.set(item.id, proc);
  });

  // Find the actual output file (yt-dlp may pick the real extension)
  const possibleExts = item.format === 'video'
    ? ['.mp4', '.webm', '.mkv']
    : ['.mp3', '.m4a', '.ogg', '.opus', '.wav'];
  let actualName = `${fileId}${ext}`;
  for (const e of possibleExts) {
    if (fs.existsSync(path.join(appPaths.music, `${fileId}${e}`))) {
      actualName = `${fileId}${e}`;
      break;
    }
  }

  const song = Song.create({
    title:       item.title,
    artist:      'YouTube',
    album:       '',
    duration:    0,
    file_path:   actualName,
    thumbnail:   null,
    youtube_url: item.youtube_url,
    youtube_id:  item.youtube_id,
    type:        item.format === 'video' ? 'video' : 'audio',
  });

  DownloadQueue.complete(item.id, song.id);
  log.info('[Download] completed', item.id, '->', song.id);
}

// Called by libraryController for import/migration re-downloads
async function _runDownload(itemId, format, quality, appPaths) {
  const item = DownloadQueue.findById(itemId);
  if (!item) throw new Error('Queue item not found: ' + itemId);
  return _startDownload(item, appPaths);
}

module.exports = downloadController;
module.exports._runDownload = _runDownload;
