'use strict';

(function () {
  // ── State ──────────────────────────────────────────────────────────────────
  let _state       = {};
  let _apiBase     = '';
  let _sz          = 'minimalista';  // 'mini' | 'minimalista' | 'full'
  let _activePanel = 'queue';
  let _queueSort   = 'default';      // 'default' | 'name'
  let _videoHidden = false;
  let _seeking     = false;
  let _rafId       = null;
  let _analyser    = null;
  let _vizAudioCtx = null;
  let _vizSrc      = null;
  let _lastSongId  = null;

  const SZ_ORDER  = ['mini', 'minimalista', 'full'];
  const SZ_LABELS = { mini: 'M1', minimalista: 'M2', full: 'FU' };
  const SZ_SIZES  = { mini: [270, 88], minimalista: [330, 200] };

  const REPEAT_LABELS = { none: '⇅', all: '🔁', one: '🔂', library: '🎲' };

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    try {
      const port = await window.electronAPI.getServerPort();
      _apiBase = `http://127.0.0.1:${port}`;
    } catch (_) {}

    const iconEl = document.getElementById('mp-app-icon');
    if (iconEl && _apiBase) iconEl.src = `${_apiBase}/icon.png`;

    _applySz(_sz, true);
    _bindDragBar();
    _bindControls();
    _bindProgressBars();
    _bindTabs();
    _bindPanel();
    _startDrawLoop();

    window.electronAPI.onMiniPlayerState((state) => {
      _state = state;
      _applyTheme(state.theme);
      _render();
    });
  }

  // ── Theme ──────────────────────────────────────────────────────────────────
  function _applyTheme(theme) {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
  }

  // ── Size management ────────────────────────────────────────────────────────
  function _applySz(sz, skipExit) {
    const prev = _sz;
    _sz = sz;
    document.getElementById('mini-root').setAttribute('data-sz', sz);
    document.getElementById('btn-sz').textContent = SZ_LABELS[sz] || 'M2';

    if (sz === 'full') {
      window.electronAPI.setMiniPlayerFooter();
    } else {
      if (!skipExit && prev === 'full') window.electronAPI.exitMiniPlayerFooter();
      const [w, h] = SZ_SIZES[sz];
      window.electronAPI.resizeMiniPlayer(w, h);
    }
  }

  function _cycleSz() {
    const cur  = SZ_ORDER.indexOf(_sz);
    const next = SZ_ORDER[(cur + 1) % SZ_ORDER.length];
    _applySz(next);
  }

  // ── Drag bar ───────────────────────────────────────────────────────────────
  function _bindDragBar() {
    document.getElementById('btn-sz').addEventListener('click', _cycleSz);

    document.getElementById('btn-minimize-mini').addEventListener('click', () =>
      window.electronAPI.minimizeSelf()
    );

    document.getElementById('btn-close-mini').addEventListener('click', () =>
      window.electronAPI.closeMiniPlayer()
    );

    document.getElementById('btn-video-toggle').addEventListener('click', () => {
      _videoHidden = !_videoHidden;
      const btn = document.getElementById('btn-video-toggle');
      btn.classList.toggle('active', _videoHidden);
      btn.title = _videoHidden ? 'Mostrar video' : 'Ocultar video';
      _renderVideo();
    });

    document.getElementById('btn-tab-queue').addEventListener('click', () => _showPanel('queue'));
    document.getElementById('btn-tab-playlist').addEventListener('click', () => _showPanel('playlists'));
  }

  // ── Controls ───────────────────────────────────────────────────────────────
  function _ctrl(action, value) {
    window.electronAPI.miniPlayerControl(action, value);
  }

  function _bindControls() {
    const map = {
      'mc-play': 'toggle', 'mc-prev': 'prev', 'mc-next': 'next',
      'mc-shuffle': 'shuffle', 'mc-repeat': 'repeat',
      'mc-f-play': 'toggle', 'mc-f-prev': 'prev', 'mc-f-next': 'next',
      'mc-f-shuffle': 'shuffle', 'mc-f-repeat': 'repeat',
    };
    Object.entries(map).forEach(([id, action]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => _ctrl(action));
    });
  }

  // ── Progress bars ──────────────────────────────────────────────────────────
  function _bindProgressBars() {
    function bindBar(id) {
      const bar = document.getElementById(id);
      if (!bar) return;
      bar.addEventListener('mousedown', (e) => { _seeking = true; _seekFromBar(e, bar); });
      bar.addEventListener('mousemove', (e) => { if (_seeking) _seekFromBar(e, bar); });
    }
    bindBar('mp-bar');
    bindBar('mp-full-track');
    window.addEventListener('mouseup', () => { _seeking = false; });
  }

  function _seekFromBar(e, bar) {
    const rect = bar.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    _ctrl('seek', pct * (_state.duration || 0));
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────
  function _bindTabs() {
    document.querySelectorAll('.mp-tab').forEach(btn => {
      btn.addEventListener('click', () => _showPanel(btn.dataset.panel));
    });
  }

  function _showPanel(panel) {
    _activePanel = panel;
    document.querySelectorAll('.mp-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.panel === panel)
    );
    document.getElementById('panel-queue').classList.toggle('mp-hidden', panel !== 'queue');
    document.getElementById('panel-playlists').classList.toggle('mp-hidden', panel !== 'playlists');
  }

  // ── Queue sort button (delegated) ──────────────────────────────────────────
  function _bindPanel() {
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-q-sort') {
        _queueSort = _queueSort === 'default' ? 'name' : 'default';
        e.target.classList.toggle('active', _queueSort === 'name');
        e.target.textContent = _queueSort === 'name' ? 'A-Z ✓' : 'A-Z';
        _renderQueue();
      }
    });
  }

  // ── Main render ────────────────────────────────────────────────────────────
  function _render() {
    if (!_state) return;
    const song    = _state.currentSong;
    const playing = !!_state.isPlaying;

    _renderVideo();
    _renderNowPlaying(song, playing);
    _renderProgress();
    _renderPlayButtons(playing);
    _renderShuffle();
    _renderRepeat();
    _renderQueue();
    _renderPlaylists();
    _renderFullBar(song, playing);
    _syncVizAudio(song);
  }

  // ── Video section ──────────────────────────────────────────────────────────
  function _renderVideo() {
    const song  = _state.currentSong;
    const isVid = song?.type === 'video';
    const wrap  = document.getElementById('mp-video-wrap');
    const btn   = document.getElementById('btn-video-toggle');

    btn.style.display = isVid ? '' : 'none';
    if (isVid && !_videoHidden) {
      wrap.classList.remove('mp-hidden');
    } else {
      wrap.classList.add('mp-hidden');
    }
  }

  // ── Now-playing section ────────────────────────────────────────────────────
  function _renderNowPlaying(song, playing) {
    const ids    = ['mp-now', 'mp-progress-section', 'mp-controls', 'mp-visualizer', 'mp-divider', 'mp-tabs', 'mp-panel'];
    const noSong = document.getElementById('mp-no-song');

    if (!song) {
      noSong.classList.remove('mp-hidden');
      ids.forEach(id => document.getElementById(id)?.classList.add('mp-hidden'));
      return;
    }

    noSong.classList.add('mp-hidden');
    ids.forEach(id => document.getElementById(id)?.classList.remove('mp-hidden'));

    document.getElementById('mp-title').textContent  = song.title  || '—';
    document.getElementById('mp-artist').textContent = song.artist || '—';

    const repeat = _state.repeat || 'none';
    const bShuffle = document.getElementById('badge-shuffle');
    const bRepeat  = document.getElementById('badge-repeat');
    const bType    = document.getElementById('badge-type');
    bShuffle.classList.toggle('on', !!_state.shuffle);
    bRepeat.classList.toggle('on', repeat !== 'none');
    bRepeat.textContent = REPEAT_LABELS[repeat] || '⇅';
    bType.textContent   = song.type === 'video' ? '📺' : '🎵';

    _setVinylArt('mp-vinyl-disc', song, playing);
  }

  function _setVinylArt(discId, song, playing) {
    const disc = document.getElementById(discId);
    if (!disc) return;

    if (song?.thumbnail && _apiBase) {
      disc.innerHTML = `<img class="mp-vinyl-art" src="${_apiBase}/thumbnails/${_esc(song.thumbnail)}" alt="">`;
    } else if (song?.type === 'video') {
      disc.innerHTML = '<span style="font-size:14px;z-index:2">📺</span>';
    } else {
      disc.innerHTML = '<div class="mp-vinyl-hole"></div>';
    }

    disc.classList.toggle('spinning',        playing);
    disc.classList.toggle('spinning-paused', !playing);
  }

  // ── Progress ───────────────────────────────────────────────────────────────
  function _renderProgress() {
    if (_seeking) return;
    const progress = _state.progress || 0;
    const duration = _state.duration || 0;
    const pct      = duration > 0 ? (progress / duration) * 100 : 0;

    _set('mp-bar-fill', el => el.style.width = `${pct}%`);
    _set('mp-cur',      el => el.textContent  = _fmt(progress));
    _set('mp-dur',      el => el.textContent  = _fmt(duration));
  }

  // ── Play buttons ───────────────────────────────────────────────────────────
  function _renderPlayButtons(playing) {
    const txt = playing ? '⏸' : '▶';
    _set('mc-play',   el => el.textContent = txt);
    _set('mc-f-play', el => el.textContent = txt);
  }

  // ── Shuffle ────────────────────────────────────────────────────────────────
  function _renderShuffle() {
    const on = !!_state.shuffle;
    _set('mc-shuffle',   el => el.classList.toggle('on', on));
    _set('mc-f-shuffle', el => el.classList.toggle('on', on));
  }

  // ── Repeat ─────────────────────────────────────────────────────────────────
  function _renderRepeat() {
    const repeat = _state.repeat || 'none';
    const label  = REPEAT_LABELS[repeat] || '⇅';
    const on     = repeat !== 'none';
    ['mc-repeat', 'mc-f-repeat'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = label;
      el.classList.toggle('on', on);
    });
  }

  // ── Queue ──────────────────────────────────────────────────────────────────
  function _renderQueue() {
    const container = document.getElementById('panel-queue');
    if (!container) return;
    const queue = _state.queue || [];
    const idx   = _state.queueIndex ?? -1;

    let html = `
      <div class="q-header">
        <span>Cola (${queue.length})</span>
        <button type="button" class="q-sort-btn${_queueSort === 'name' ? ' active' : ''}" id="btn-q-sort">
          ${_queueSort === 'name' ? 'A-Z ✓' : 'A-Z'}
        </button>
      </div>`;

    if (!queue.length) {
      html += '<div class="mp-empty"><div class="mp-empty-icon">🎵</div><span>Cola vacía</span></div>';
      container.innerHTML = html;
      return;
    }

    let items = queue.map((s, i) => ({ ...s, _i: i }));
    if (_queueSort === 'name') {
      items = [...items].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    html += items.map(s => {
      const isCur = s._i === idx;
      const thumb = s.thumbnail && _apiBase
        ? `<img src="${_apiBase}/thumbnails/${_esc(s.thumbnail)}" style="width:100%;height:100%;object-fit:cover;border-radius:3px;" alt="">`
        : (s.type === 'video' ? '📺' : '🎵');
      return `
        <div class="q-item${isCur ? ' current' : ''}" data-qi="${s._i}">
          <span class="q-num">${s._i + 1}</span>
          <div class="q-thumb">${thumb}</div>
          <div class="q-info">
            <div class="q-title">${_esc(s.title || '—')}</div>
            <div class="q-artist">${_esc(s.artist || '—')}</div>
          </div>
          ${isCur ? '<span class="q-playing">▶</span>' : ''}
        </div>`;
    }).join('');

    container.innerHTML = html;

    container.querySelectorAll('.q-item').forEach(el => {
      el.addEventListener('click', () => _ctrl('playQueueItem', parseInt(el.dataset.qi, 10)));
    });
  }

  // ── Playlists ──────────────────────────────────────────────────────────────
  function _renderPlaylists() {
    const container = document.getElementById('panel-playlists');
    if (!container) return;
    const playlists = _state.playlists || [];

    if (!playlists.length) {
      container.innerHTML = '<div class="mp-empty"><div class="mp-empty-icon">📋</div><span>Sin playlists</span></div>';
      return;
    }

    container.innerHTML = playlists.map(pl => `
      <div class="pl-item">
        <div class="pl-icon">📋</div>
        <div class="pl-info">
          <div class="pl-name">${_esc(pl.name || '—')}</div>
          <div class="pl-count">${pl.song_count ?? 0} canciones</div>
        </div>
        <button type="button" class="pl-play" data-plid="${pl.id}" title="Reproducir">▶</button>
      </div>`).join('');

    container.querySelectorAll('.pl-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        _ctrl('playPlaylist', parseInt(btn.dataset.plid, 10));
      });
    });
  }

  // ── Full-footer bar ────────────────────────────────────────────────────────
  function _renderFullBar(song, playing) {
    const progress = _state.progress || 0;
    const duration = _state.duration || 0;
    const pct      = duration > 0 ? (progress / duration) * 100 : 0;

    if (song) {
      _set('mp-full-title',  el => el.textContent = song.title  || '—');
      _set('mp-full-artist', el => el.textContent = song.artist || '—');
      _setVinylArt('mp-full-vinyl', song, playing);
    }

    if (!_seeking) {
      _set('mp-full-bar-fill', el => el.style.width = `${pct}%`);
      _set('mp-full-cur',      el => el.textContent  = _fmt(progress));
      _set('mp-full-dur',      el => el.textContent  = _fmt(duration));
    }
  }

  // ── Visualizer ─────────────────────────────────────────────────────────────
  function _syncVizAudio(song) {
    const audio = document.getElementById('mp-viz-audio');
    if (!audio || !_apiBase || !song) return;
    if (song.id === _lastSongId) return;
    _lastSongId = song.id;

    audio.muted = true;
    audio.src   = `${_apiBase}/music/${encodeURIComponent(song.file_path)}`;

    if (!_vizAudioCtx) {
      try {
        _vizAudioCtx = new AudioContext();
        _analyser    = _vizAudioCtx.createAnalyser();
        _analyser.fftSize = 64;
        _vizSrc = _vizAudioCtx.createMediaElementSource(audio);
        _vizSrc.connect(_analyser);
        // intentionally NOT connected to destination — silent analysis only
      } catch (_) { _analyser = null; }
    }

    if (_vizAudioCtx?.state === 'suspended') _vizAudioCtx.resume().catch(() => {});

    audio.currentTime = _state.progress || 0;
    if (_state.isPlaying) audio.play().catch(() => {});
  }

  function _startDrawLoop() {
    const c1 = document.getElementById('mp-canvas');
    const c2 = document.getElementById('mp-full-canvas');
    function loop() {
      _drawBars(c1);
      _drawBars(c2);
      _rafId = requestAnimationFrame(loop);
    }
    _rafId = requestAnimationFrame(loop);
  }

  function _drawBars(canvas) {
    if (!canvas) return;
    const W = canvas.offsetWidth  || 200;
    const H = canvas.offsetHeight || 24;
    if (canvas.width !== W)  canvas.width  = W;
    if (canvas.height !== H) canvas.height = H;

    const ctx   = canvas.getContext('2d');
    const barW  = 3;
    const gap   = 2;
    const count = Math.max(1, Math.floor(W / (barW + gap)));

    ctx.clearRect(0, 0, W, H);

    if (_analyser && _state.isPlaying) {
      const buf = new Uint8Array(_analyser.frequencyBinCount);
      _analyser.getByteFrequencyData(buf);
      for (let i = 0; i < count; i++) {
        const v  = buf[Math.floor((i / count) * buf.length * 0.7)] / 255;
        const h  = Math.max(2, v * H * 0.92);
        const x  = i * (barW + gap);
        const gr = ctx.createLinearGradient(0, H - h, 0, H);
        gr.addColorStop(0, 'rgba(255,51,102,0.9)');
        gr.addColorStop(1, 'rgba(139,92,246,0.55)');
        ctx.fillStyle = gr;
        ctx.fillRect(x, H - h, barW, h);
      }
    } else {
      const t = Date.now() / 700;
      for (let i = 0; i < count; i++) {
        const amplitude = _state.isPlaying ? 0.28 : 0.08;
        const h = H * 0.08 + H * amplitude * Math.abs(Math.sin(i * 0.5 + t));
        ctx.fillStyle = 'rgba(255,51,102,0.22)';
        ctx.fillRect(i * (barW + gap), H - h, barW, h);
      }
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  function _set(id, fn) {
    const el = document.getElementById(id);
    if (el) fn(el);
  }

  function _fmt(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
})();
