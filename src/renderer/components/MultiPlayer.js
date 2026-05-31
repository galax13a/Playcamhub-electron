/**
 * MultiPlayer.js — gestor reutilizable de ventanas flotantes de video.
 *
 * Uso:
 *   import { openMany, openOne } from '../../components/MultiPlayer.js';
 *   openMany([{ id: 12, title: 'Mi video', src: 'http://...' }]);
 *
 * Características:
 *  - Ventanas flotantes con drag, resize, minimizar, cerrar, fullscreen.
 *  - 3 tamaños predefinidos: mini / medium / large.
 *  - Tamaño por defecto: mini (320×240).
 *  - Volumen muteado por defecto (autoplay-safe).
 *  - Like, rating ⭐, comentarios, favorito por video (usa API.media.*).
 *  - 3 temas: dark / light / rick-morty (selector global en barra de control).
 *  - Persistencia de historial vía POST /api/videoplayer/history.
 *
 * No requiere modificar el DOM principal: monta su propio overlay en document.body.
 */

import API, { getBase } from '../utils/api.js';
import { showToast } from './Modal.js';

const SIZES = {
  mini:   { w: 320,  h: 240 },
  medium: { w: 640,  h: 360 },
  large:  { w: 1280, h: 720 },
};

const THEME_KEY  = 'mp_theme';
const THEMES     = ['dark', 'light', 'rick-morty'];
let _currentTheme = (() => {
  try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch (_) { return 'dark'; }
})();

let _root      = null;     // contenedor overlay
let _players   = new Map();
let _seq       = 0;
let _zCounter  = 1000;
let _stylesInjected = false;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Abre un solo video.
 * @param {{id?:number, title:string, src:string, mime?:string, resumeAt?:number, size?:'mini'|'medium'|'large'}} item
 */
export function openOne(item) {
  _ensureMounted();
  return _spawn({ ...item, size: item.size || 'mini' });
}

/**
 * Abre múltiples videos en cascada (modo mini, mute on por defecto).
 * @param {Array<{id?:number, title:string, src:string, mime?:string}>} items
 */
export function openMany(items) {
  _ensureMounted();
  if (!items?.length) return;
  items.forEach((it, idx) => {
    setTimeout(() => _spawn({ ...it, size: 'mini' }), idx * 80);
  });
}

export function setTheme(t) {
  if (!THEMES.includes(t)) return;
  _currentTheme = t;
  try { localStorage.setItem(THEME_KEY, t); } catch (_) {}
  if (_root) _root.setAttribute('data-mp-theme', t);
}

export function getTheme() { return _currentTheme; }

// ── Internals ─────────────────────────────────────────────────────────────────

function _ensureMounted() {
  if (_stylesInjected === false) {
    if (!document.getElementById('multiplayer-css')) {
      const link = document.createElement('link');
      link.id   = 'multiplayer-css';
      link.rel  = 'stylesheet';
      link.href = new URL('../styles/multiplayer.css', import.meta.url).href;
      document.head.appendChild(link);
    }
    _stylesInjected = true;
  }
  if (!_root || !document.body.contains(_root)) {
    _root = document.createElement('div');
    _root.id = 'mp-overlay';
    _root.setAttribute('data-mp-theme', _currentTheme);
    document.body.appendChild(_root);
  }
}

function _spawn({ id: mediaId, title, src, mime, resumeAt = 0, size = 'mini' }) {
  if (!src) return;

  const id = `mp-${++_seq}`;
  const dims = SIZES[size] || SIZES.mini;

  const win = document.createElement('div');
  win.className = 'mp-window';
  win.dataset.playerId = id;
  win.style.width  = dims.w + 'px';
  win.style.height = (dims.h + 100) + 'px'; // titlebar + controls + footer
  const offset = (_players.size % 8) * 28;
  win.style.left = (40 + offset) + 'px';
  win.style.top  = (60 + offset) + 'px';
  win.style.zIndex = ++_zCounter;

  win.innerHTML = `
    <div class="mp-titlebar">
      <span class="mp-dot mp-close"  title="Cerrar"></span>
      <span class="mp-dot mp-min"    title="Minimizar"></span>
      <span class="mp-dot mp-resize-cycle" title="Cambiar tamaño"></span>
      <span class="mp-ttl" title="${_esc(title)}">${_esc(title)}</span>
      <select class="mp-theme-sel" title="Tema">
        <option value="dark">🌙 Dark</option>
        <option value="light">☀️ Light</option>
        <option value="rick-morty">🛸 Rick &amp; Morty</option>
      </select>
    </div>

    <div class="mp-video-area">
      <video preload="metadata" playsinline muted></video>
      <div class="mp-err">⚠ No se pudo cargar el video.</div>
      <button class="mp-unmute" title="Activar sonido">🔇</button>
    </div>

    <div class="mp-controls">
      <div class="mp-progress">
        <div class="mp-buf"></div>
        <div class="mp-bar"></div>
      </div>
      <div class="mp-row">
        <button class="mp-play"  title="Play/Pause">▶</button>
        <button class="mp-mute"  title="Silenciar">🔇</button>
        <input class="mp-vol" type="range" min="0" max="1" step="0.01" value="1" title="Volumen">
        <span class="mp-time">0:00 / 0:00</span>
        <span style="flex:1"></span>
        <select class="mp-rate" title="Velocidad">
          <option value="0.5">0.5x</option>
          <option value="0.75">0.75x</option>
          <option value="1" selected>1x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
        <button class="mp-fs" title="Pantalla completa">⛶</button>
      </div>
    </div>

    <div class="mp-footer">
      <button class="mp-act mp-fav"   title="Favorito">🤍</button>
      <button class="mp-act mp-like"  title="Me gusta">❤️ <span class="mp-likes">0</span></button>
      <div class="mp-rating" data-rating="0">
        ${[1,2,3,4,5].map(i => `<span class="mp-star" data-v="${i}">☆</span>`).join('')}
      </div>
      <button class="mp-act mp-cmt-btn" title="Comentarios">💬 <span class="mp-cmt-count">0</span></button>
    </div>

    <div class="mp-cmt-panel">
      <div class="mp-cmt-list"></div>
      <div class="mp-cmt-input">
        <input type="text" placeholder="Escribe un comentario…" maxlength="500">
        <button>Enviar</button>
      </div>
    </div>

    <div class="mp-resize-handle"></div>`;

  _root.appendChild(win);

  // Estado
  const video = win.querySelector('video');
  const state = {
    id, mediaId, win, video, title, src, mime,
    historyId: null, lastSaved: 0,
  };
  _players.set(id, state);

  // Activación / drag / resize
  win.addEventListener('mousedown', () => _setActive(id));
  _wireDrag(win, win.querySelector('.mp-titlebar'));
  _wireResize(win, win.querySelector('.mp-resize-handle'));

  // Titlebar buttons (dots)
  win.querySelector('.mp-close').addEventListener('click', e => { e.stopPropagation(); _closePlayer(id); });
  win.querySelector('.mp-min').addEventListener('click', e => { e.stopPropagation(); win.classList.toggle('mp-minimized'); });
  win.querySelector('.mp-resize-cycle').addEventListener('click', e => {
    e.stopPropagation();
    const order = ['mini', 'medium', 'large'];
    const cur = win.dataset.size || 'mini';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    _applySize(win, next);
  });
  _applySize(win, size);

  // Theme selector
  const themeSel = win.querySelector('.mp-theme-sel');
  themeSel.value = _currentTheme;
  themeSel.addEventListener('change', () => setTheme(themeSel.value));

  // Controls
  const playBtn  = win.querySelector('.mp-play');
  const muteBtn  = win.querySelector('.mp-mute');
  const unmute   = win.querySelector('.mp-unmute');
  const volSlider = win.querySelector('.mp-vol');
  const rateSel  = win.querySelector('.mp-rate');
  const fsBtn    = win.querySelector('.mp-fs');
  const progress = win.querySelector('.mp-progress');
  const bar      = win.querySelector('.mp-bar');
  const buf      = win.querySelector('.mp-buf');
  const timeEl   = win.querySelector('.mp-time');

  playBtn.addEventListener('click', () => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  });

  function syncMute() {
    muteBtn.textContent = video.muted ? '🔇' : '🔊';
    unmute.style.display = video.muted ? 'flex' : 'none';
    unmute.textContent  = '🔇';
  }
  muteBtn.addEventListener('click', () => { video.muted = !video.muted; syncMute(); });
  unmute.addEventListener('click',  () => { video.muted = false; syncMute(); });
  volSlider.addEventListener('input', () => {
    video.volume = parseFloat(volSlider.value);
    video.muted  = video.volume === 0;
    syncMute();
  });

  rateSel.addEventListener('change', () => { video.playbackRate = parseFloat(rateSel.value); });
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else win.querySelector('.mp-video-area').requestFullscreen?.();
  });

  // Progress bar — clic + drag
  const seek = e => {
    const rect = progress.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (video.duration) video.currentTime = ratio * video.duration;
  };
  let dragSeek = false;
  progress.addEventListener('mousedown', e => { dragSeek = true; seek(e); });
  document.addEventListener('mousemove', e => { if (dragSeek) seek(e); });
  document.addEventListener('mouseup',   () => { dragSeek = false; });
  progress.addEventListener('click', seek);

  // Video events
  video.addEventListener('play',  () => { playBtn.textContent = '⏸'; });
  video.addEventListener('pause', () => { playBtn.textContent = '▶'; });
  video.addEventListener('error', () => { win.classList.add('mp-has-error'); });
  video.addEventListener('loadedmetadata', () => {
    win.classList.remove('mp-has-error');
    if (resumeAt && resumeAt > 0 && resumeAt < video.duration) {
      video.currentTime = resumeAt;
    }
    // Autoplay solo si el browser lo permite (estamos muted, así debería ir)
    video.play().catch(() => {});
  });
  video.addEventListener('timeupdate', () => {
    if (video.duration) {
      bar.style.width = (100 * video.currentTime / video.duration) + '%';
      timeEl.textContent = `${_fmtTime(video.currentTime)} / ${_fmtTime(video.duration)}`;
    }
    if (video.buffered.length) {
      const end = video.buffered.end(video.buffered.length - 1);
      buf.style.width = (100 * end / (video.duration || 1)) + '%';
    }
    if (state.historyId && video.currentTime - state.lastSaved > 4) {
      state.lastSaved = video.currentTime;
      _apiCall(`/videoplayer/history/${state.historyId}`, {
        method: 'PUT',
        body: JSON.stringify({ last_position: video.currentTime, duration: video.duration || null }),
      }).catch(() => {});
    }
  });
  ['pause', 'ended'].forEach(ev => video.addEventListener(ev, () => {
    if (state.historyId) {
      _apiCall(`/videoplayer/history/${state.historyId}`, {
        method: 'PUT',
        body: JSON.stringify({ last_position: video.currentTime, duration: video.duration || null }),
      }).catch(() => {});
    }
  }));

  // Load source (HLS aware)
  _loadSource(state).then(() => _logHistory(state)).catch(() => {});

  // Footer actions: like / fav / rating / comments
  if (mediaId) _wireMediaActions(state);
  else {
    // Sin mediaId solo deshabilita acciones que requieren backend
    win.querySelector('.mp-footer').style.opacity = '.4';
    win.querySelector('.mp-footer').style.pointerEvents = 'none';
  }

  syncMute();
  _setActive(id);

  return state;
}

async function _loadSource(state) {
  const { video, src, mime } = state;
  const isHls = /\.m3u8(\?|$)/i.test(src) || mime === 'application/vnd.apple.mpegurl';
  if (isHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
    try {
      const { default: Hls } = await import('https://cdn.jsdelivr.net/npm/hls.js@1.5.13/+esm');
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
        state._hls = hls;
        return;
      }
    } catch (_) {}
  }
  video.src = src;
}

async function _logHistory(state) {
  try {
    const rec = await _apiCall('/videoplayer/history', {
      method: 'POST',
      body: JSON.stringify({
        title: state.title,
        source: state.src,
        source_type: 'url',
        mime_type: state.mime || null,
        player_id: state.id,
        last_position: 0,
      }),
    });
    state.historyId = rec.id;
  } catch (_) { /* no bloquea reproducción */ }
}

function _wireMediaActions(state) {
  const { win, mediaId } = state;
  const favBtn   = win.querySelector('.mp-fav');
  const likeBtn  = win.querySelector('.mp-like');
  const likesSpan = win.querySelector('.mp-likes');
  const stars    = win.querySelectorAll('.mp-star');
  const ratingEl = win.querySelector('.mp-rating');
  const cmtBtn   = win.querySelector('.mp-cmt-btn');
  const cmtPanel = win.querySelector('.mp-cmt-panel');
  const cmtList  = win.querySelector('.mp-cmt-list');
  const cmtCount = win.querySelector('.mp-cmt-count');
  const cmtInput = cmtPanel.querySelector('input');
  const cmtSend  = cmtPanel.querySelector('button');

  // Cargar estado inicial
  API.media.get(mediaId).then(m => {
    likesSpan.textContent = m.likes || 0;
    favBtn.textContent = m.is_favorite ? '❤️' : '🤍';
    const r = Math.round((m.rating || 0) / 2); // backend usa 0-10, UI usa 5 estrellas
    _renderStars(stars, r);
    ratingEl.dataset.rating = String(r);
  }).catch(() => {});

  // Cargar comentarios (count)
  API.media.comments(mediaId).then(rows => {
    cmtCount.textContent = (rows || []).length;
    _renderComments(cmtList, rows || []);
  }).catch(() => {});

  favBtn.addEventListener('click', async () => {
    try {
      const res = await API.media.favorite(mediaId);
      favBtn.textContent = res.is_favorite ? '❤️' : '🤍';
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  });

  likeBtn.addEventListener('click', async () => {
    try {
      const res = await API.media.like(mediaId);
      likesSpan.textContent = res.likes;
      likeBtn.classList.add('mp-pulse');
      setTimeout(() => likeBtn.classList.remove('mp-pulse'), 400);
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  });

  stars.forEach(star => {
    star.addEventListener('mouseenter', () => {
      const v = Number(star.dataset.v);
      _renderStars(stars, v, true);
    });
    star.addEventListener('mouseleave', () => {
      _renderStars(stars, Number(ratingEl.dataset.rating || 0));
    });
    star.addEventListener('click', async () => {
      const v = Number(star.dataset.v);
      try {
        const res = await API.media.rate(mediaId, v * 2); // 5⭐ -> 10
        const newR = Math.round((res.rating || 0) / 2);
        ratingEl.dataset.rating = String(newR);
        _renderStars(stars, newR);
        showToast(`Calificado ⭐ ${v}`, 'success');
      } catch (err) { showToast('Error: ' + err.message, 'error'); }
    });
  });

  cmtBtn.addEventListener('click', () => {
    cmtPanel.classList.toggle('open');
  });
  cmtSend.addEventListener('click', async () => {
    const text = cmtInput.value.trim();
    if (!text) return;
    try {
      await API.media.addComment(mediaId, text);
      cmtInput.value = '';
      const rows = await API.media.comments(mediaId);
      cmtCount.textContent = (rows || []).length;
      _renderComments(cmtList, rows || []);
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  });
  cmtInput.addEventListener('keydown', e => { if (e.key === 'Enter') cmtSend.click(); });
}

function _renderStars(stars, value, hover = false) {
  stars.forEach((s, idx) => {
    s.textContent = idx < value ? '★' : '☆';
    s.classList.toggle('mp-hover', hover && idx < value);
  });
}

function _renderComments(listEl, rows) {
  if (!rows.length) {
    listEl.innerHTML = `<div class="mp-cmt-empty">Sin comentarios todavía.</div>`;
    return;
  }
  listEl.innerHTML = rows.map(c => `
    <div class="mp-cmt">
      <div class="mp-cmt-head">
        <strong>${_esc(c.author || 'Usuario')}</strong>
        <span>${_fmtDate(c.created_at)}</span>
      </div>
      <div class="mp-cmt-body">${_esc(c.text)}</div>
    </div>`).join('');
}

// ── Window mechanics ──────────────────────────────────────────────────────────

function _closePlayer(id) {
  const p = _players.get(id);
  if (!p) return;
  try { p.video.pause(); p.video.removeAttribute('src'); p.video.load(); } catch (_) {}
  if (p._hls) { try { p._hls.destroy(); } catch (_) {} }
  p.win.remove();
  _players.delete(id);
}

function _setActive(id) {
  _players.forEach((p, pid) => p.win.classList.toggle('mp-active', pid === id));
  const p = _players.get(id);
  if (p) p.win.style.zIndex = ++_zCounter;
}

function _applySize(win, size) {
  const dims = SIZES[size] || SIZES.mini;
  win.classList.remove('mp-minimized');
  win.dataset.size = size;
  win.style.width  = dims.w + 'px';
  win.style.height = (dims.h + 100) + 'px';
}

function _wireDrag(win, handle) {
  let sx = 0, sy = 0, ox = 0, oy = 0, drag = false;
  handle.addEventListener('mousedown', e => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.classList.contains('mp-dot')) return;
    drag = true; sx = e.clientX; sy = e.clientY;
    const rect = win.getBoundingClientRect();
    ox = rect.left; oy = rect.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!drag) return;
    win.style.left = Math.max(0, ox + e.clientX - sx) + 'px';
    win.style.top  = Math.max(0, oy + e.clientY - sy) + 'px';
  });
  document.addEventListener('mouseup', () => { drag = false; });
}

function _wireResize(win, handle) {
  let sx = 0, sy = 0, sw = 0, sh = 0, on = false;
  handle.addEventListener('mousedown', e => {
    on = true; sx = e.clientX; sy = e.clientY;
    sw = win.offsetWidth; sh = win.offsetHeight;
    e.preventDefault(); e.stopPropagation();
  });
  document.addEventListener('mousemove', e => {
    if (!on) return;
    win.style.width  = Math.max(260, sw + e.clientX - sx) + 'px';
    win.style.height = Math.max(180, sh + e.clientY - sy) + 'px';
  });
  document.addEventListener('mouseup', () => { on = false; });
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function _esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

function _fmtTime(sec) {
  sec = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${m}:${String(s).padStart(2,'0')}`;
}

function _fmtDate(s) {
  if (!s) return '';
  try {
    const d = new Date(String(s).replace(' ', 'T') + (String(s).endsWith('Z') ? '' : 'Z'));
    return d.toLocaleString();
  } catch (_) { return s; }
}

async function _apiCall(path, opts = {}) {
  const token = (() => {
    try {
      const raw = sessionStorage.getItem('auth_session') || localStorage.getItem('auth_session');
      return JSON.parse(raw || 'null')?.token || null;
    } catch (_) { return null; }
  })();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(`${getBase()}/api${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
  return data;
}

export default { openOne, openMany, setTheme, getTheme };
