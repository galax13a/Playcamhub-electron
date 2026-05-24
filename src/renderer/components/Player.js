'use strict';
import store      from '../store.js';
import EventBus   from '../utils/eventBus.js';
import API        from '../utils/api.js';
import { formatDuration } from '../utils/formatters.js';
import { showToast } from './Modal.js';
import { t } from '../utils/i18n.js';

// Single long-lived media elements
const audio = new Audio();
const video = document.createElement('video');
audio.preload = 'auto';
video.preload = 'auto';

let isSeeking      = false;
let activeMedia    = audio;
let _vpMode        = 'small'; // 'small' | 'theater'
let _miniPlayerOpen = false;

export function initPlayer(el) {
  el.innerHTML = buildHTML();
  _createVideoPanel();
  bindMediaEvents();
  bindUIEvents(el);
  bindStoreEvents(el);
  _initMiniPlayerBridge(el);
}

// ── HTML ──────────────────────────────────────────────────────────────────────

function buildHTML() {
  return `
  <div class="player-inner">

    <!-- Left: vinyl + info + progress bar + like -->
    <div class="player-left">
      <div class="vinyl-wrap">
        <div class="vinyl-disc paused" id="vinyl-disc">
          <div class="vinyl-label" id="vinyl-label">
            <div class="vinyl-hole"></div>
          </div>
        </div>
      </div>
      <div class="player-meta">
        <div class="player-meta-top">
          <div class="player-info">
            <div class="player-title" id="player-title">No song playing</div>
            <div class="player-artist" id="player-artist">—</div>
          </div>
          <button class="btn-ghost btn-circle player-like-btn" id="btn-like" title="Favorite">♡</button>
        </div>
        <div class="player-progress">
          <span class="time-label" id="time-current">0:00</span>
          <div class="progress-wrap" id="progress-bar">
            <div class="progress-fill" id="progress-fill" style="width:0%"></div>
          </div>
          <span class="time-label right" id="time-total">0:00</span>
        </div>
      </div>
    </div>

    <!-- Center: controls only -->
    <div class="player-center">
      <div class="player-controls">
        <button class="ctrl-btn" id="btn-shuffle" title="${t('ctrl_shuffle')}">⇄</button>
        <button class="ctrl-btn" id="btn-prev"    title="${t('ctrl_prev')}">⏮</button>
        <button class="ctrl-btn play-pause" id="btn-play" title="${t('ctrl_play')}">▶</button>
        <button class="ctrl-btn" id="btn-next"    title="${t('ctrl_next')}">⏭</button>
        <button class="ctrl-btn" id="btn-repeat"  title="${t('ctrl_repeat')}">⇅</button>
      </div>
    </div>

    <!-- Right: video toggle + volume + cinema -->
    <div class="player-right">
      <button class="btn-ghost btn-circle player-video-btn" id="btn-video-panel"
              title="Show video" style="display:none">📺</button>
      <button class="btn-ghost btn-circle" id="btn-mini-player" title="Mini Player">⧉</button>
      <span class="vol-icon">🔊</span>
      <input type="range" class="vol-slider" id="vol-slider" min="0" max="100" value="80">
    </div>

  </div>`;
}

// ── Floating video panel ──────────────────────────────────────────────────────

function _createVideoPanel() {
  const panel = document.createElement('div');
  panel.id = 'video-panel';
  panel.className = 'video-panel mode-small';
  panel.innerHTML = `
    <div class="vp-header">
      <span class="vp-badge">📺 VIDEO</span>
      <span class="vp-title" id="vp-title">Now Playing</span>
      <button class="vp-btn vp-mode-btn active" data-mode="small"   title="Mini">◱</button>
      <button class="vp-btn vp-mode-btn"         data-mode="theater" title="Theater">▭</button>
      <button class="vp-btn" id="vp-fullscreen" title="Fullscreen">⛶</button>
      <button class="vp-btn" id="vp-close"      title="Hide">✕</button>
    </div>
    <div class="vp-body" id="vp-body"></div>`;

  document.body.appendChild(panel);

  video.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;display:block;';
  panel.querySelector('#vp-body').appendChild(video);

  panel.querySelectorAll('.vp-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _vpMode = btn.dataset.mode;
      panel.querySelectorAll('.vp-mode-btn').forEach(b => b.classList.toggle('active', b === btn));
      panel.classList.remove('mode-small', 'mode-theater');
      panel.classList.add(`mode-${_vpMode}`);
    });
  });

  panel.querySelector('#vp-fullscreen').addEventListener('click', () => {
    video.requestFullscreen?.().catch(() => {});
  });

  panel.querySelector('#vp-close').addEventListener('click', () => {
    panel.classList.remove('visible');
  });
}

// ── Media events ──────────────────────────────────────────────────────────────

function bindMediaEvents() {
  const onTimeUpdate = () => {
    if (isSeeking) return;
    store.setState({ progress: activeMedia.currentTime, duration: activeMedia.duration || 0 });
  };

  const onEnded = () => {
    if (store.state.repeat === 'one') {
      activeMedia.currentTime = 0;
      activeMedia.play().catch(() => {});
    } else {
      store.nextSong();
    }
  };

  const onError = (e) => {
    const err = e.target?.error;
    // MEDIA_ERR_ABORTED (1) = src changed while loading
    if (!err || err.code === MediaError.MEDIA_ERR_ABORTED) return;
    // Errors from the inactive element mean we just cleared its src — not a real failure
    if (e.target !== activeMedia) return;
    showToast(t('playback_failed'), 'error');
    store.setState({ isPlaying: false });
  };

  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('ended',      onEnded);
  audio.addEventListener('error',      onError);
  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('ended',      onEnded);
  video.addEventListener('error',      onError);

  EventBus.on('player:seek', (t) => {
    activeMedia.currentTime = t;
    store.setState({ progress: t });
  });
}

// ── UI events ─────────────────────────────────────────────────────────────────

function bindUIEvents(el) {
  el.querySelector('#btn-play').addEventListener('click', () => store.togglePlay());
  el.querySelector('#btn-next').addEventListener('click', () => store.nextSong());
  el.querySelector('#btn-prev').addEventListener('click', () => store.prevSong());

  el.querySelector('#btn-shuffle').addEventListener('click', () => {
    const next = !store.state.shuffle;
    store.setState({ shuffle: next });
    el.querySelector('#btn-shuffle').classList.toggle('active', next);
    showToast(next ? t('shuffle_on') : t('shuffle_off'), 'info');
  });

  el.querySelector('#btn-repeat').addEventListener('click', () => {
    const cycle    = { none: 'all', all: 'one', one: 'library', library: 'none' };
    const labels   = { none: '⇅', all: '🔁', one: '🔂', library: '🎲' };
    const tooltips = { none: t('repeat_none'), all: t('repeat_all'), one: t('repeat_one'), library: t('repeat_library') };
    const next = cycle[store.state.repeat] || 'all';
    store.setState({ repeat: next });
    const btn = el.querySelector('#btn-repeat');
    btn.textContent = labels[next];
    btn.title       = tooltips[next];
    btn.classList.toggle('active', next !== 'none');
    showToast(tooltips[next], 'info');
  });

  el.querySelector('#btn-like').addEventListener('click', async () => {
    const s = store.state.currentSong;
    if (!s) return;
    const updated = await API.songs.toggleFav(s.id);
    store.setState({ currentSong: updated });
    _updateLikeBtn(el, updated);
    store.loadSongs();
  });

  // Video panel toggle
  el.querySelector('#btn-video-panel').addEventListener('click', () => {
    document.getElementById('video-panel')?.classList.toggle('visible');
  });

  // Progress seek
  const progressBar = el.querySelector('#progress-bar');
  progressBar.addEventListener('mousedown', (e) => { isSeeking = true; _seek(e, progressBar); });
  progressBar.addEventListener('mousemove', (e) => { if (isSeeking) _seek(e, progressBar); });
  window.addEventListener('mouseup', () => { isSeeking = false; });

  // Volume
  const volSlider = el.querySelector('#vol-slider');
  volSlider.addEventListener('input', () => {
    const v = volSlider.value / 100;
    audio.volume = v;
    video.volume = v;
    store.setState({ volume: v });
    API.settings.setMany({ volume: String(volSlider.value) }).catch(() => {});
  });

  // Mini player toggle
  el.querySelector('#btn-mini-player').addEventListener('click', () => {
    if (_miniPlayerOpen) {
      window.electronAPI.closeMiniPlayer();
    } else {
      window.electronAPI.openMiniPlayer();
      _miniPlayerOpen = true;
      el.querySelector('#btn-mini-player').classList.add('active');
      _syncMiniPlayer();
    }
  });

}

// ── Store subscriptions ───────────────────────────────────────────────────────

function bindStoreEvents(el) {
  EventBus.on('store:currentSong', (song) => {
    if (!song) return;
    document.getElementById('player-bar')?.classList.add('active');
    const isVideo = song.type === 'video';
    const src     = API.musicUrl(song.file_path);

    // Switch media element
    if (isVideo) {
      audio.pause(); audio.src = '';
      video.src = src;
      activeMedia = video;
    } else {
      video.pause(); video.src = '';
      audio.src = src;
      activeMedia = audio;
    }
    activeMedia.load();
    if (store.state.isPlaying) {
      activeMedia.addEventListener('canplay', function _play() {
        activeMedia.removeEventListener('canplay', _play);
        activeMedia.play().catch(() => {});
      }, { once: true });
    }

    // Song info
    el.querySelector('#player-title').textContent  = song.title;
    el.querySelector('#player-artist').textContent = song.artist || '—';

    // Vinyl disc
    const disc  = el.querySelector('#vinyl-disc');
    const label = el.querySelector('#vinyl-label');
    if (isVideo) {
      disc.classList.add('vinyl-video');
      label.innerHTML = '<span class="vinyl-video-icon">📺</span>';
    } else {
      disc.classList.remove('vinyl-video');
      label.innerHTML = song.thumbnail
        ? `<img src="${API.thumbnailUrl(song.thumbnail)}" class="vinyl-art" alt="">`
        : '<div class="vinyl-hole"></div>';
    }

    // Like btn
    _updateLikeBtn(el, song);

    // Video panel
    const panelBtn = el.querySelector('#btn-video-panel');
    const panel    = document.getElementById('video-panel');
    if (isVideo) {
      panelBtn.style.display = '';
      if (panel) {
        panel.classList.add('visible');
        const vt = panel.querySelector('#vp-title');
        if (vt) vt.textContent = song.title;
      }
    } else {
      panelBtn.style.display = 'none';
      if (panel) panel.classList.remove('visible');
    }

    // Title bar
    const tb = document.getElementById('tb-title');
    if (tb) tb.textContent = song
      ? `${song.title} — ${song.artist || 'Unknown'}`
      : (store.state.appConfig.appTitle || 'PlaycamHub Studio');
  });

  EventBus.on('store:isPlaying', (playing) => {
    const disc = document.getElementById('vinyl-disc');
    if (playing) {
      // Only play if media is ready (src is loaded); the canplay listener handles new songs
      if (activeMedia.readyState >= 2) activeMedia.play().catch(() => {});
      disc?.classList.remove('paused');
    } else {
      activeMedia.pause();
      disc?.classList.add('paused');
    }
    el.querySelector('#btn-play').textContent = playing ? '⏸' : '▶';
  });

  EventBus.on('store:progress', (t) => {
    if (isSeeking) return;
    const dur = store.state.duration || 0;
    const pct = dur > 0 ? (t / dur) * 100 : 0;
    el.querySelector('#progress-fill').style.width = `${pct}%`;
    el.querySelector('#time-current').textContent  = formatDuration(t);
    el.querySelector('#time-total').textContent    = formatDuration(dur);
  });

  EventBus.on('store:volume', (v) => {
    audio.volume = v;
    video.volume = v;
    const slider = el.querySelector('#vol-slider');
    if (slider) slider.value = Math.round(v * 100);
  });

  audio.volume = store.state.volume;
  video.volume = store.state.volume;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _updateLikeBtn(el, song) {
  const btn = el.querySelector('#btn-like');
  if (!btn) return;
  btn.textContent = song.is_favorite ? '♥' : '♡';
  btn.style.color = song.is_favorite ? 'var(--red)' : '';
}

function _seek(e, bar) {
  const rect = bar.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const t    = pct * (activeMedia.duration || 0);
  activeMedia.currentTime = t;
  store.setState({ progress: t });
}

// ── Mini player bridge ────────────────────────────────────────────────────────

function _syncMiniPlayer() {
  if (!_miniPlayerOpen) return;
  window.electronAPI.updateMiniPlayerState({
    currentSong: store.state.currentSong,
    isPlaying:   store.state.isPlaying,
    progress:    store.state.progress,
    duration:    store.state.duration,
    shuffle:     store.state.shuffle,
    repeat:      store.state.repeat,
    volume:      store.state.volume,
    queue:       store.state.queue,
    queueIndex:  store.state.queueIndex,
    playlists:   store.state.playlists,
    theme:       store.state.theme || 'dark',
  });
}

function _initMiniPlayerBridge(el) {
  // Forward all relevant store changes to mini-player
  ['currentSong', 'isPlaying', 'progress', 'shuffle', 'repeat', 'volume', 'queue', 'queueIndex', 'playlists', 'theme'].forEach(key => {
    EventBus.on(`store:${key}`, () => _syncMiniPlayer());
  });

  // Control commands coming from mini-player
  window.electronAPI.onMiniPlayerControl((action, value) => {
    const { queue, repeat } = store.state;
    switch (action) {
      case 'toggle': store.togglePlay(); break;
      case 'next':   store.nextSong();   break;
      case 'prev':   store.prevSong();   break;
      case 'shuffle':
        store.setState({ shuffle: !store.state.shuffle });
        break;
      case 'repeat': {
        const cycle = { none: 'all', all: 'one', one: 'library', library: 'none' };
        store.setState({ repeat: cycle[repeat] || 'none' });
        break;
      }
      case 'playQueueItem':
        if (typeof value === 'number' && queue[value]) {
          store.playSong(queue[value], queue);
        }
        break;
      case 'playPlaylist':
        if (typeof value === 'number') {
          import('../utils/api.js').then(({ default: API }) => {
            API.playlists.getSongs(value).then(songs => {
              if (songs.length) store.playSong(songs[0], songs);
            }).catch(() => {});
          });
        }
        break;
      case 'seek':
        if (typeof value === 'number') {
          activeMedia.currentTime = value;
          store.setState({ progress: value });
        }
        break;
    }
  });

  // Mini-player window closed by user (X button)
  window.electronAPI.onMiniPlayerClosed(() => {
    _miniPlayerOpen = false;
    const btn = el.querySelector('#btn-mini-player');
    if (btn) btn.classList.remove('active');
  });
}
