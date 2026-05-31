/**
 * Workspace.js — vista principal del plugin Video Player.
 *
 * Características:
 *  - Mini reproductor por defecto (320×240) con todos los controles.
 *  - Múltiples ventanas flotantes simultáneas (drag&drop + resize).
 *  - 3 tamaños predefinidos: mini / medium / large.
 *  - Botón minimizar, cerrar, pantalla completa, velocidad de reproducción.
 *  - Historial automático (persistido en SQLite) + reanudar desde último segundo.
 *  - Playlist con drag-reorder, exportar/importar JSON.
 *  - Soporta URL directa (MP4, HLS) y archivos locales (FileReader / objectURL).
 *  - Manejo de errores con mensaje amigable.
 */

import store from '../../../../src/renderer/store.js';
import { getBase } from '../../../../src/renderer/utils/api.js';
import { showToast } from '../../../../src/renderer/components/Modal.js';

const SIZES = {
  mini:   { w: 320,  h: 240 },
  medium: { w: 640,  h: 360 },
  large:  { w: 1280, h: 720 },
};

let _workspaceEl  = null;
let _players      = new Map();      // playerId -> { window, video, historyId, ... }
let _zCounter     = 10;
let _playerSeq    = 0;
let _activeId     = null;
let _historyCache = [];
let _playlistCache = [];

// ── Entry ─────────────────────────────────────────────────────────────────────

export async function renderWorkspace(rootEl) {
  rootEl.innerHTML = `
    <div class="vp-root" id="vp-root">
      <div class="vp-toolbar">
        <h2>🎞️ Video Player</h2>
        <span class="spacer"></span>
        <button id="vp-btn-new" class="primary">➕ Nuevo reproductor</button>
        <button id="vp-btn-clear-hist">🗑️ Limpiar historial</button>
      </div>

      <aside class="vp-side">
        <h3>📺 Lista de reproducción</h3>
        <div class="vp-actions">
          <button id="vp-pl-add">Agregar</button>
          <button id="vp-pl-export">Exportar</button>
          <button id="vp-pl-import">Importar</button>
          <input type="file" id="vp-pl-import-file" accept="application/json" hidden>
        </div>
        <div class="vp-list" id="vp-playlist"></div>
      </aside>

      <main class="vp-workspace" id="vp-workspace">
        <div class="vp-empty" id="vp-empty">
          Haz clic en <b>➕ Nuevo reproductor</b> para empezar.<br>
          Soporta URLs (MP4, HLS) y archivos locales.
        </div>
      </main>

      <aside class="vp-side right">
        <h3>🕘 Historial</h3>
        <input type="text" class="vp-search" id="vp-hist-search" placeholder="Buscar en historial…">
        <div class="vp-list" id="vp-history"></div>
      </aside>

      <div class="vp-add-menu" id="vp-add-menu">
        <label>URL del video (MP4, HLS .m3u8, etc.)</label>
        <input type="text" id="vp-src-url" placeholder="https://…">
        <label>O selecciona un archivo local</label>
        <input type="file" id="vp-src-file" accept="video/*">
        <label>Tamaño inicial</label>
        <div class="vp-size-row">
          <button data-size="mini">Mini 320×240</button>
          <button data-size="medium">Medio 640×360</button>
          <button data-size="large">Grande 1280×720</button>
        </div>
        <div class="vp-size-row">
          <button id="vp-add-cancel">Cancelar</button>
          <button id="vp-add-confirm" class="primary">Abrir reproductor</button>
        </div>
      </div>
    </div>`;

  _workspaceEl = rootEl.querySelector('#vp-workspace');

  rootEl.querySelector('#vp-btn-new').addEventListener('click', () => _openAddMenu());
  rootEl.querySelector('#vp-btn-clear-hist').addEventListener('click', _clearHistory);

  // Add menu wiring
  const menu = rootEl.querySelector('#vp-add-menu');
  let pendingSize = 'mini';
  menu.querySelectorAll('button[data-size]').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingSize = btn.dataset.size;
      menu.querySelectorAll('button[data-size]').forEach(b => b.style.borderColor = '');
      btn.style.borderColor = '#7c3aed';
    });
  });
  // Default selection highlight
  menu.querySelector('button[data-size="mini"]').style.borderColor = '#7c3aed';
  rootEl.querySelector('#vp-add-cancel').addEventListener('click', () => menu.classList.remove('open'));
  rootEl.querySelector('#vp-add-confirm').addEventListener('click', () => {
    const url = rootEl.querySelector('#vp-src-url').value.trim();
    const file = rootEl.querySelector('#vp-src-file').files?.[0];
    if (!url && !file) { showToast('Indica una URL o selecciona un archivo', 'error'); return; }
    if (file) {
      _openPlayer({ title: file.name, source: URL.createObjectURL(file), sourceType: 'file', mime: file.type, size: pendingSize });
    } else {
      _openPlayer({ title: _titleFromUrl(url), source: url, sourceType: 'url', size: pendingSize });
    }
    menu.classList.remove('open');
    rootEl.querySelector('#vp-src-url').value = '';
    rootEl.querySelector('#vp-src-file').value = '';
  });

  // Playlist actions
  rootEl.querySelector('#vp-pl-add').addEventListener('click', _promptAddToPlaylist);
  rootEl.querySelector('#vp-pl-export').addEventListener('click', _exportPlaylist);
  rootEl.querySelector('#vp-pl-import').addEventListener('click', () =>
    rootEl.querySelector('#vp-pl-import-file').click());
  rootEl.querySelector('#vp-pl-import-file').addEventListener('change', _importPlaylist);

  // History search
  rootEl.querySelector('#vp-hist-search').addEventListener('input', e => {
    _renderHistory(e.target.value.trim());
  });

  await Promise.all([_loadHistory(), _loadPlaylist()]);

  // Abrir mini reproductor por defecto vacío
  _openPlayer({ title: 'Mini reproductor', source: '', sourceType: 'url', size: 'mini', autoplay: false });
}

// ── Player factory ────────────────────────────────────────────────────────────

function _openPlayer({ title, source, sourceType, mime, size = 'mini', resumeAt = 0, autoplay = true }) {
  const id = `vp-player-${++_playerSeq}`;
  const dims = SIZES[size] || SIZES.mini;

  const win = document.createElement('div');
  win.className = 'vp-window';
  win.dataset.playerId = id;
  win.style.width  = dims.w + 'px';
  win.style.height = (dims.h + 64) + 'px'; // titlebar + controls
  // Stack new windows offset
  const offset = (_players.size % 6) * 30;
  win.style.left = (40 + offset) + 'px';
  win.style.top  = (20 + offset) + 'px';
  win.style.zIndex = ++_zCounter;

  win.innerHTML = `
    <div class="vp-titlebar">
      <span class="vp-ttl" title="${_esc(title)}">${_esc(title)}</span>
      <button class="vp-size" data-size="mini"  title="Mini">▫</button>
      <button class="vp-size" data-size="medium" title="Medio">▢</button>
      <button class="vp-size" data-size="large"  title="Grande">▣</button>
      <button class="vp-min" title="Minimizar">—</button>
      <button class="vp-close" title="Cerrar">✕</button>
    </div>
    <div class="vp-video-area">
      <video preload="metadata" playsinline></video>
      <div class="vp-err">No se pudo cargar el video. Revisa la URL o el formato.</div>
    </div>
    <div class="vp-controls">
      <div class="vp-progress">
        <div class="vp-buf"></div>
        <div class="vp-bar"></div>
      </div>
      <div class="vp-row">
        <button class="vp-play"  title="Play/Pause">▶</button>
        <button class="vp-mute"  title="Mute">🔊</button>
        <input  class="vp-vol" type="range" min="0" max="1" step="0.01" value="1" title="Volumen">
        <span class="vp-time">0:00 / 0:00</span>
        <span style="flex:1"></span>
        <select class="vp-rate" title="Velocidad">
          <option value="0.5">0.5x</option>
          <option value="0.75">0.75x</option>
          <option value="1" selected>1x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
        <button class="vp-fs" title="Pantalla completa">⛶</button>
      </div>
    </div>
    <div class="vp-resize"></div>`;

  _workspaceEl.appendChild(win);
  _workspaceEl.querySelector('#vp-empty')?.remove();

  const video = win.querySelector('video');
  const state = { id, win, video, historyId: null, title, source, sourceType, mime };
  _players.set(id, state);

  _setActive(id);
  win.addEventListener('mousedown', () => _setActive(id));

  // Drag (titlebar)
  _wireDrag(win, win.querySelector('.vp-titlebar'));
  // Resize handle
  _wireResize(win, win.querySelector('.vp-resize'));

  // Controls
  win.querySelector('.vp-close').addEventListener('click', () => _closePlayer(id));
  win.querySelector('.vp-min').addEventListener('click', () => win.classList.toggle('vp-minimized'));
  win.querySelectorAll('.vp-size').forEach(b => {
    b.addEventListener('click', () => _resizeTo(win, b.dataset.size));
  });

  const playBtn = win.querySelector('.vp-play');
  playBtn.addEventListener('click', () => {
    if (!video.src) { showToast('Carga un video primero', 'info'); return; }
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  });

  const muteBtn = win.querySelector('.vp-mute');
  const volSlider = win.querySelector('.vp-vol');
  muteBtn.addEventListener('click', () => { video.muted = !video.muted; muteBtn.textContent = video.muted ? '🔇' : '🔊'; });
  volSlider.addEventListener('input', () => { video.volume = parseFloat(volSlider.value); video.muted = video.volume === 0; muteBtn.textContent = video.muted ? '🔇' : '🔊'; });

  win.querySelector('.vp-rate').addEventListener('change', e => { video.playbackRate = parseFloat(e.target.value); });

  win.querySelector('.vp-fs').addEventListener('click', () => {
    const area = win.querySelector('.vp-video-area');
    if (document.fullscreenElement) document.exitFullscreen();
    else area.requestFullscreen?.();
  });

  // Progress bar
  const progress = win.querySelector('.vp-progress');
  const bar = win.querySelector('.vp-bar');
  const buf = win.querySelector('.vp-buf');
  const timeEl = win.querySelector('.vp-time');

  const seekFromEvent = (e) => {
    const rect = progress.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (video.duration) video.currentTime = ratio * video.duration;
  };
  progress.addEventListener('click', seekFromEvent);
  let dragging = false;
  progress.addEventListener('mousedown', e => { dragging = true; seekFromEvent(e); });
  document.addEventListener('mousemove', e => { if (dragging) seekFromEvent(e); });
  document.addEventListener('mouseup', () => { dragging = false; });

  // Video events
  video.addEventListener('play',  () => { playBtn.textContent = '⏸'; });
  video.addEventListener('pause', () => { playBtn.textContent = '▶'; });
  video.addEventListener('error', () => {
    win.classList.add('vp-has-error');
    win.querySelector('.vp-err').textContent = '⚠ No se pudo cargar el video. Verifica la URL o el formato.';
  });
  video.addEventListener('loadedmetadata', () => {
    win.classList.remove('vp-has-error');
    if (resumeAt && resumeAt > 0 && resumeAt < video.duration) {
      video.currentTime = resumeAt;
    }
    if (autoplay) video.play().catch(() => {});
  });

  let lastSaved = 0;
  video.addEventListener('timeupdate', () => {
    if (video.duration) {
      bar.style.width = (100 * video.currentTime / video.duration) + '%';
      timeEl.textContent = `${_fmtTime(video.currentTime)} / ${_fmtTime(video.duration)}`;
    }
    if (video.buffered.length) {
      const end = video.buffered.end(video.buffered.length - 1);
      buf.style.width = (100 * end / (video.duration || 1)) + '%';
    }
    // Persistir cada 4 segundos
    if (state.historyId && video.currentTime - lastSaved > 4) {
      lastSaved = video.currentTime;
      _api(`/videoplayer/history/${state.historyId}`, {
        method: 'PUT',
        body: JSON.stringify({ last_position: video.currentTime, duration: video.duration || null }),
      }).catch(() => {});
    }
  });
  // Persistir al pausar/terminar
  ['pause', 'ended'].forEach(ev => video.addEventListener(ev, () => {
    if (state.historyId) {
      _api(`/videoplayer/history/${state.historyId}`, {
        method: 'PUT',
        body: JSON.stringify({ last_position: video.currentTime, duration: video.duration || null }),
      }).catch(() => {});
    }
  }));

  if (source) _loadSource(state, { source, sourceType, mime, title });

  return state;
}

function _closePlayer(id) {
  const p = _players.get(id);
  if (!p) return;
  // Si era blob/file, revocar
  if (p.sourceType === 'file' && p.source?.startsWith('blob:')) {
    try { URL.revokeObjectURL(p.source); } catch (_) {}
  }
  p.win.remove();
  _players.delete(id);
  if (_players.size === 0) {
    const empty = document.createElement('div');
    empty.className = 'vp-empty';
    empty.id = 'vp-empty';
    empty.innerHTML = `Haz clic en <b>➕ Nuevo reproductor</b> para empezar.`;
    _workspaceEl.appendChild(empty);
  }
}

function _setActive(id) {
  _activeId = id;
  _players.forEach((p, pid) => p.win.classList.toggle('active', pid === id));
  const p = _players.get(id);
  if (p) p.win.style.zIndex = ++_zCounter;
}

function _resizeTo(win, size) {
  const dims = SIZES[size] || SIZES.mini;
  win.classList.remove('vp-minimized');
  win.style.width  = dims.w + 'px';
  win.style.height = (dims.h + 64) + 'px';
}

// ── Source loading ────────────────────────────────────────────────────────────

async function _loadSource(state, { source, sourceType, mime, title }) {
  const { video, win } = state;
  state.source = source;
  state.sourceType = sourceType;
  state.mime = mime;
  state.title = title;
  win.querySelector('.vp-ttl').textContent = title;
  win.querySelector('.vp-ttl').title = title;
  win.classList.remove('vp-has-error');

  // HLS detection — usa hls.js si está disponible y el video no lo soporta nativo
  const isHls = /\.m3u8(\?|$)/i.test(source) || mime === 'application/vnd.apple.mpegurl';
  if (isHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
    try {
      const { default: Hls } = await import('https://cdn.jsdelivr.net/npm/hls.js@1.5.13/+esm');
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(source);
        hls.attachMedia(video);
        state._hls = hls;
      } else {
        video.src = source;
      }
    } catch (_) {
      video.src = source;
    }
  } else {
    video.src = source;
  }

  // Crear entrada de historial
  try {
    const username = store.state.loggedUser?.username;
    const rec = await _api('/videoplayer/history', {
      method: 'POST',
      body: JSON.stringify({
        title, source, source_type: sourceType, mime_type: mime || null,
        player_id: state.id, last_position: 0, username,
      }),
    });
    state.historyId = rec.id;
    await _loadHistory();
  } catch (err) {
    // No bloquea reproducción si falla el log
    console.warn('[videoplayer] No se pudo guardar historial:', err.message);
  }
}

// ── History ───────────────────────────────────────────────────────────────────

async function _loadHistory() {
  try {
    const username = store.state.loggedUser?.username;
    const q = new URLSearchParams({ per_page: '100' });
    if (username) q.set('username', username);
    const res = await _api(`/videoplayer/history?${q.toString()}`);
    _historyCache = res.items || [];
    _renderHistory();
  } catch (_) {}
}

function _renderHistory(filter = '') {
  const list = document.querySelector('#vp-history');
  if (!list) return;
  const items = filter
    ? _historyCache.filter(h => h.title?.toLowerCase().includes(filter.toLowerCase()))
    : _historyCache;
  if (!items.length) {
    list.innerHTML = `<div style="padding:10px;color:var(--text-muted);font-size:12px">Historial vacío</div>`;
    return;
  }
  list.innerHTML = items.map(h => `
    <div class="vp-item" data-id="${h.id}">
      <div class="vp-it-title">${_esc(h.title)}</div>
      <div class="vp-it-meta">
        <span>${_fmtDate(h.started_at)}</span>
        <span>${_fmtTime(h.last_position)} / ${_fmtTime(h.duration)}</span>
      </div>
      <div class="vp-it-actions">
        <button class="vp-it-resume" data-id="${h.id}">▶ Reanudar</button>
        <button class="vp-it-del vp-danger" data-id="${h.id}">🗑️</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.vp-it-resume').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const h = _historyCache.find(x => x.id === Number(b.dataset.id));
      if (!h) return;
      if (h.source_type === 'file') {
        showToast('Los archivos locales no pueden reanudarse automáticamente. Vuelve a abrirlos.', 'info');
        return;
      }
      _openPlayer({
        title: h.title, source: h.source, sourceType: h.source_type, mime: h.mime_type,
        size: 'medium', resumeAt: h.last_position || 0, autoplay: true,
      });
    });
  });
  list.querySelectorAll('.vp-it-del').forEach(b => {
    b.addEventListener('click', async e => {
      e.stopPropagation();
      await _api(`/videoplayer/history/${b.dataset.id}`, { method: 'DELETE' });
      await _loadHistory();
    });
  });
}

async function _clearHistory() {
  if (!confirm('¿Limpiar todo el historial?')) return;
  await _api('/videoplayer/history', { method: 'DELETE' });
  await _loadHistory();
  showToast('Historial limpiado', 'success');
}

// ── Playlist ──────────────────────────────────────────────────────────────────

async function _loadPlaylist() {
  // Usamos UNA playlist principal por usuario (la primera) — simple y útil
  try {
    const username = store.state.loggedUser?.username;
    const q = username ? `?username=${encodeURIComponent(username)}` : '';
    const res = await _api(`/videoplayer/playlists${q}`);
    let pl = (res.items || [])[0];
    if (!pl) {
      pl = await _api('/videoplayer/playlists', {
        method: 'POST',
        body: JSON.stringify({ name: 'Mi playlist', description: '', username }),
      });
    }
    const full = await _api(`/videoplayer/playlists/${pl.id}`);
    _playlistCache = full.items || [];
    _renderPlaylist(pl.id);
  } catch (_) {}
}

function _renderPlaylist(playlistId) {
  const list = document.querySelector('#vp-playlist');
  if (!list) return;
  if (!_playlistCache.length) {
    list.innerHTML = `<div style="padding:10px;color:var(--text-muted);font-size:12px">Playlist vacía</div>`;
    return;
  }
  list.innerHTML = _playlistCache.map((it, idx) => `
    <div class="vp-item" draggable="true" data-id="${it.id}" data-idx="${idx}">
      <div class="vp-it-title">${_esc(it.title)}</div>
      <div class="vp-it-meta">
        <span>#${idx + 1}</span>
        <span>${it.source_type}</span>
      </div>
      <div class="vp-it-actions">
        <button class="vp-pl-play" data-id="${it.id}">▶ Reproducir</button>
        <button class="vp-pl-del vp-danger" data-id="${it.id}">🗑️</button>
      </div>
    </div>`).join('');

  // Reproducir
  list.querySelectorAll('.vp-pl-play').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const it = _playlistCache.find(x => x.id === Number(b.dataset.id));
      if (!it) return;
      // Reproducir en activo si existe, si no abrir uno nuevo
      const active = _players.get(_activeId);
      if (active) {
        _loadSource(active, { source: it.source, sourceType: it.source_type, title: it.title });
        active.video.play().catch(() => {});
      } else {
        _openPlayer({ title: it.title, source: it.source, sourceType: it.source_type, size: 'medium' });
      }
    });
  });
  // Eliminar
  list.querySelectorAll('.vp-pl-del').forEach(b => {
    b.addEventListener('click', async e => {
      e.stopPropagation();
      await _api(`/videoplayer/playlists/${playlistId}/items/${b.dataset.id}`, { method: 'DELETE' });
      await _loadPlaylist();
    });
  });

  // Drag-reorder
  let draggedEl = null;
  list.querySelectorAll('.vp-item').forEach(el => {
    el.addEventListener('dragstart', () => { draggedEl = el; el.classList.add('vp-dragging'); });
    el.addEventListener('dragend',   () => { el.classList.remove('vp-dragging'); draggedEl = null; });
    el.addEventListener('dragover', e => { e.preventDefault(); });
    el.addEventListener('drop', async e => {
      e.preventDefault();
      if (!draggedEl || draggedEl === el) return;
      const items = Array.from(list.querySelectorAll('.vp-item'));
      const from = items.indexOf(draggedEl);
      const to   = items.indexOf(el);
      const moved = _playlistCache.splice(from, 1)[0];
      _playlistCache.splice(to, 0, moved);
      const order = _playlistCache.map(x => x.id);
      await _api(`/videoplayer/playlists/${playlistId}/reorder`, {
        method: 'PATCH', body: JSON.stringify({ order }),
      });
      _renderPlaylist(playlistId);
    });
  });
}

async function _promptAddToPlaylist() {
  const url = prompt('URL del video a agregar a la playlist:');
  if (!url) return;
  // Obtén la primera playlist
  const username = store.state.loggedUser?.username;
  const q = username ? `?username=${encodeURIComponent(username)}` : '';
  const res = await _api(`/videoplayer/playlists${q}`);
  const pl = (res.items || [])[0];
  if (!pl) { showToast('No hay playlist', 'error'); return; }
  await _api(`/videoplayer/playlists/${pl.id}/items`, {
    method: 'POST',
    body: JSON.stringify({ title: _titleFromUrl(url), source: url, source_type: 'url' }),
  });
  await _loadPlaylist();
  showToast('Agregado a la playlist', 'success');
}

async function _exportPlaylist() {
  const username = store.state.loggedUser?.username;
  const q = username ? `?username=${encodeURIComponent(username)}` : '';
  const res = await _api(`/videoplayer/playlists${q}`);
  const pl = (res.items || [])[0];
  if (!pl) return;
  const full = await _api(`/videoplayer/playlists/${pl.id}`);
  const blob = new Blob([JSON.stringify(full, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `playlist-${pl.id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  showToast('Playlist exportada', 'success');
}

async function _importPlaylist(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const username = store.state.loggedUser?.username;
    await _api('/videoplayer/playlists/import', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name || `Imported ${new Date().toLocaleDateString()}`,
        description: data.description || '',
        items: (data.items || []).map(it => ({
          title: it.title, source: it.source, source_type: it.source_type || 'url',
        })),
        username,
      }),
    });
    await _loadPlaylist();
    showToast('Playlist importada', 'success');
  } catch (err) {
    showToast('JSON inválido: ' + err.message, 'error');
  } finally {
    e.target.value = '';
  }
}

// ── Drag & resize ─────────────────────────────────────────────────────────────

function _wireDrag(win, handle) {
  let sx = 0, sy = 0, ox = 0, oy = 0, drag = false;
  handle.addEventListener('mousedown', e => {
    if (e.target.tagName === 'BUTTON') return;
    drag = true; sx = e.clientX; sy = e.clientY;
    const rect = win.getBoundingClientRect();
    const parent = _workspaceEl.getBoundingClientRect();
    ox = rect.left - parent.left;
    oy = rect.top - parent.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!drag) return;
    win.style.left = (ox + e.clientX - sx) + 'px';
    win.style.top  = (oy + e.clientY - sy) + 'px';
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
    win.style.width  = Math.max(240, sw + e.clientX - sx) + 'px';
    win.style.height = Math.max(120, sh + e.clientY - sy) + 'px';
  });
  document.addEventListener('mouseup', () => { on = false; });
}

// ── Add menu toggle ───────────────────────────────────────────────────────────

function _openAddMenu() {
  const m = document.querySelector('#vp-add-menu');
  m.classList.toggle('open');
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function _titleFromUrl(url) {
  try {
    const u = new URL(url, location.href);
    const last = u.pathname.split('/').filter(Boolean).pop() || u.hostname;
    return decodeURIComponent(last);
  } catch (_) {
    return url.slice(-60);
  }
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
    const d = new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'));
    return d.toLocaleString();
  } catch (_) { return s; }
}

function _esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

async function _api(path, opts = {}) {
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
