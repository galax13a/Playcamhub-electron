/**
 * VideoEditor — Professional 3-panel video editor.
 *
 * Layout: [Left 280px: info+stats+actions] [Center: player] [Right 320px: tools tabs]
 *
 * Features:
 *  - Thumbnail capture from canvas with frame-preview and upload
 *  - Stats: views, downloads, likes, rating
 *  - Like / Favorite / Album / Download / Delete actions
 *  - Video player with size presets (40/72/100%), ±10s skip, time badge, resolution badge
 *  - Tab: Trim — start/end inputs + range sliders + animated progress bar + cache-bust reload
 *  - Tab: Info — filename, title, description + metadata table
 *  - Tab: GIF — export first 10s (or trim segment) as animated GIF via POST /:id/gif
 */

import API         from '../../../../src/renderer/utils/api.js';
import store       from '../../../../src/renderer/store.js';
import { showToast, openModal } from '../../../../src/renderer/components/Modal.js';
import { viewHeader }           from '../../../../src/renderer/components/ui.js';
import { esc }                  from '../../../../src/renderer/utils/html.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function _fmtSec(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = String(Math.floor(s % 60)).padStart(2, '0');
  return `${m}:${sec}`;
}

function _fmtBytes(b) {
  if (!b) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(2) + ' MB';
}

function _fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch (_) { return s; }
}

// ── CSS injected once ─────────────────────────────────────────────────────────

function _injectCss() {
  if (document.getElementById('ve-styles')) return;
  const style = document.createElement('style');
  style.id = 've-styles';
  style.textContent = `
    .ve-root {
      display: grid;
      grid-template-columns: 280px 1fr 320px;
      gap: 16px;
      padding: 0 16px 40px;
      align-items: start;
    }
    @media (max-width: 1100px) {
      .ve-root { grid-template-columns: 1fr; }
    }
    .ve-panel {
      background: var(--bg-3);
      border-radius: 16px;
      padding: 20px;
    }
    .ve-center {
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
    }
    .ve-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 12px 0;
    }
    .ve-stat-chip {
      background: var(--bg-2);
      border-radius: 8px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
    }
    .ve-stat-chip span:first-child { font-size: 16px; }
    .ve-thumb-wrap {
      position: relative;
      border-radius: 10px;
      overflow: hidden;
      background: var(--bg-2);
      cursor: pointer;
      margin-bottom: 12px;
    }
    .ve-thumb-wrap img {
      width: 100%;
      aspect-ratio: 16/9;
      object-fit: cover;
      display: block;
    }
    .ve-thumb-overlay {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      background: rgba(0,0,0,0.55);
      color: #fff;
      font-size: 11px;
      text-align: center;
      padding: 6px 4px;
      opacity: 0;
      transition: opacity .2s;
    }
    .ve-thumb-wrap:hover .ve-thumb-overlay { opacity: 1; }
    .ve-thumb-preview {
      margin-top: 8px;
      border-radius: 8px;
      overflow: hidden;
      display: none;
    }
    .ve-thumb-preview img { width: 100%; display: block; }
    .ve-action-btn {
      width: 100%;
      margin-bottom: 8px;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg-2);
      color: var(--text-primary);
      cursor: pointer;
      font-size: 13px;
      text-align: left;
      transition: background .15s;
    }
    .ve-action-btn:hover { background: var(--bg-3); }
    .ve-action-btn.danger { color: var(--red); border-color: var(--red)33; }
    .ve-action-btn.danger:hover { background: var(--red)11; }
    .ve-action-btn.active { border-color: var(--accent); color: var(--accent); }

    /* Player */
    .ve-vid { width: 72%; transition: width .3s; }
    .ve-vid video {
      width: 100%;
      border-radius: 14px;
      display: block;
      background: #000;
    }
    .ve-size-bar { display: flex; align-items: center; gap: 6px; }
    .ve-skip-bar { display: flex; align-items: center; gap: 8px; }
    .ve-time-badge {
      font-size: 13px;
      color: var(--text-muted);
      background: var(--bg-3);
      padding: 4px 10px;
      border-radius: 20px;
    }
    .ve-res-badge {
      font-size: 11px;
      color: var(--text-muted);
      background: var(--bg-2);
      padding: 3px 8px;
      border-radius: 20px;
    }

    /* Tabs right panel */
    .ve-tabs-bar {
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
      background: var(--bg-2);
      border-radius: 10px;
      padding: 4px;
    }
    .ve-tab {
      flex: 1;
      padding: 6px 4px;
      border-radius: 7px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      transition: background .15s, color .15s;
      white-space: nowrap;
    }
    .ve-tab.active {
      background: var(--bg-3);
      color: var(--text-primary);
    }
    .ve-tab-pane { display: none; }
    .ve-tab-pane.active { display: block; }

    /* Trim */
    .ve-progress-bar-wrap {
      height: 4px;
      background: var(--bg-2);
      border-radius: 2px;
      overflow: hidden;
      margin: 10px 0;
      display: none;
    }
    .ve-progress-bar-wrap.running { display: block; }
    .ve-progress-bar {
      height: 100%;
      background: var(--accent, #7c3aed);
      border-radius: 2px;
      animation: ve-progress 1.5s ease-in-out infinite;
      width: 60%;
    }
    @keyframes ve-progress {
      0%,100% { width: 0;   margin-left: 0; }
      50%      { width: 60%; margin-left: 20%; }
    }

    /* Meta table */
    .ve-meta-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
    .ve-meta-table td { padding: 5px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
    .ve-meta-table td:first-child { color: var(--text-muted); width: 38%; }

    /* GIF */
    .ve-gif-result {
      margin-top: 12px;
      padding: 10px 14px;
      background: var(--bg-2);
      border-radius: 8px;
      font-size: 13px;
    }

    /* Section title */
    .ve-section-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-secondary);
      letter-spacing: .4px;
      margin: 0 0 10px;
    }
    /* Range inputs */
    .ve-range { width: 100%; accent-color: var(--accent, #7c3aed); }
  `;
  document.head.appendChild(style);
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function renderVideoEditor(el, extra = {}) {
  _injectCss();

  const mediaId = extra?.id;
  el.innerHTML = '';

  if (!mediaId) {
    el.innerHTML = '<p style="padding:32px;color:var(--text-muted)">No se especificó un video.</p>';
    return;
  }

  // Load media record
  let media;
  try { media = await API.media.get(mediaId); }
  catch (err) {
    el.innerHTML = `<p style="padding:32px;color:var(--red)">Error cargando video: ${esc(err.message)}</p>`;
    return;
  }

  if (media.media_type !== 'video') {
    showToast('Este archivo no es un video.', 'error');
    store.navigate('starcho:gallery');
    return;
  }

  // ── Header ────────────────────────────────────────────────────────────────

  const headerEl = document.createElement('div');
  headerEl.innerHTML = viewHeader(
    esc(media.title || media.file_name || 'Video'),
    `<button class="btn btn-sm btn-secondary" id="ve-back">← Galería</button>
     <button class="btn btn-sm btn-secondary" id="ve-hdr-fav" title="Favorito">
       ${media.is_favorite ? '⭐' : '☆'} Fav
     </button>
     <a id="ve-hdr-dl" class="btn btn-sm btn-primary"
        href="${esc(API.media.downloadUrl(mediaId))}" download>⬇ Descargar</a>`,
  );
  el.appendChild(headerEl);

  headerEl.querySelector('#ve-back').addEventListener('click', () => store.navigate('starcho:gallery'));

  const hdrFavBtn = headerEl.querySelector('#ve-hdr-fav');
  hdrFavBtn.addEventListener('click', async () => {
    try {
      const r = await API.media.favorite(mediaId);
      media.is_favorite = r.isFavorite ? 1 : 0;
      hdrFavBtn.innerHTML = `${media.is_favorite ? '⭐' : '☆'} Fav`;
      hdrFavBtn.classList.toggle('active', !!media.is_favorite);
      leftFavBtn && _syncFavBtn();
      showToast(media.is_favorite ? 'Agregado a favoritos' : 'Quitado de favoritos');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  });

  // ── 3-panel root ──────────────────────────────────────────────────────────

  const root = document.createElement('div');
  root.className = 've-root';
  el.appendChild(root);

  // ─────────────────────────────────────────────────────────────────────────
  // LEFT PANEL
  // ─────────────────────────────────────────────────────────────────────────

  const leftPanel = document.createElement('div');
  leftPanel.className = 've-panel';
  root.appendChild(leftPanel);

  // Thumbnail
  const thumbUrl = API.mediaThumbUrl(mediaId);
  leftPanel.innerHTML = `
    <div class="ve-thumb-wrap" id="ve-thumb-wrap" title="Capturar frame actual como thumbnail">
      <img id="ve-thumb-img" src="${esc(thumbUrl)}" alt="thumbnail" onerror="this.src=''">
      <div class="ve-thumb-overlay">📷 Cambiar thumbnail</div>
    </div>
    <div class="ve-thumb-preview" id="ve-thumb-preview">
      <img id="ve-thumb-preview-img" alt="preview">
      <button class="btn btn-sm btn-primary" id="ve-thumb-confirm" style="width:100%;margin-top:6px">
        ✅ Usar este frame
      </button>
    </div>

    <p class="ve-section-title" style="margin-top:12px">📊 Estadísticas</p>
    <div class="ve-stats-grid">
      <div class="ve-stat-chip"><span>👁</span><span id="ve-stat-views">${media.view_count || 0}</span> vistas</div>
      <div class="ve-stat-chip"><span>⬇</span><span id="ve-stat-dl">${media.download_count || 0}</span> dl</div>
      <div class="ve-stat-chip"><span>❤️</span><span id="ve-stat-likes">${media.likes || 0}</span> likes</div>
      <div class="ve-stat-chip"><span>⭐</span><span id="ve-stat-rating">${media.rating > 0 ? Number(media.rating).toFixed(1) : '—'}</span>/10</div>
    </div>

    <p class="ve-section-title">⚡ Acciones</p>
    <button class="ve-action-btn" id="ve-like-btn">❤️ Like <span id="ve-like-count">(${media.likes || 0})</span></button>
    <button class="ve-action-btn ${media.is_favorite ? 'active' : ''}" id="ve-fav-btn">
      ${media.is_favorite ? '⭐ En favoritos' : '☆ Agregar a favoritos'}
    </button>
    <button class="ve-action-btn" id="ve-album-btn">📁 Agregar a álbum</button>
    <a class="ve-action-btn" id="ve-dl-btn"
       href="${esc(API.media.downloadUrl(mediaId))}" download
       style="display:block;text-decoration:none">⬇ Descargar</a>
    <button class="ve-action-btn danger" id="ve-del-btn">🗑 Eliminar</button>

    <p style="font-size:11px;color:var(--text-muted);margin-top:8px">
      ⏱ Duración: <span id="ve-duration-left">cargando…</span>
    </p>
  `;

  // ── Thumbnail capture ────────────────────────────────────────────────────

  const thumbWrap    = leftPanel.querySelector('#ve-thumb-wrap');
  const thumbPreview = leftPanel.querySelector('#ve-thumb-preview');
  const thumbPrevImg = leftPanel.querySelector('#ve-thumb-preview-img');
  let _capturedBlob  = null;

  thumbWrap.addEventListener('click', () => {
    if (!vid) return;
    const canvas = document.createElement('canvas');
    canvas.width  = vid.videoWidth  || 480;
    canvas.height = vid.videoHeight || 270;
    canvas.getContext('2d').drawImage(vid, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) return showToast('No se pudo capturar el frame', 'error');
      _capturedBlob = blob;
      const url = URL.createObjectURL(blob);
      thumbPrevImg.src = url;
      thumbPreview.style.display = 'block';
    }, 'image/png');
  });

  leftPanel.querySelector('#ve-thumb-confirm').addEventListener('click', async () => {
    if (!_capturedBlob) return;
    const btn = leftPanel.querySelector('#ve-thumb-confirm');
    btn.disabled = true;
    btn.textContent = '⏳ Subiendo…';
    try {
      const fd = new FormData();
      fd.append('thumb', _capturedBlob, 'frame.png');
      const token = window.playcamAuthToken || (() => {
        try { return JSON.parse(sessionStorage.getItem('auth_session') || localStorage.getItem('auth_session') || 'null')?.token; } catch (_) { return null; }
      })();
      const base = API.getBase();
      const r = await fetch(`${base}/api/media/${mediaId}/video-thumb`, {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Error al subir thumbnail');
      showToast('✅ Thumbnail actualizado');
      // Refresh thumbnail image with cache buster
      leftPanel.querySelector('#ve-thumb-img').src = thumbUrl + '?_t=' + Date.now();
      thumbPreview.style.display = 'none';
      _capturedBlob = null;
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '✅ Usar este frame';
    }
  });

  // ── Left panel action listeners ──────────────────────────────────────────

  let leftFavBtn = leftPanel.querySelector('#ve-fav-btn');

  function _syncFavBtn() {
    leftFavBtn.className = `ve-action-btn ${media.is_favorite ? 'active' : ''}`;
    leftFavBtn.textContent = media.is_favorite ? '⭐ En favoritos' : '☆ Agregar a favoritos';
    hdrFavBtn.innerHTML = `${media.is_favorite ? '⭐' : '☆'} Fav`;
  }

  leftPanel.querySelector('#ve-like-btn').addEventListener('click', async () => {
    try {
      const r = await API.media.like(mediaId);
      media.likes = r.likes;
      leftPanel.querySelector('#ve-stat-likes').textContent = r.likes;
      leftPanel.querySelector('#ve-like-count').textContent = `(${r.likes})`;
      showToast('❤️ Like agregado');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  });

  leftFavBtn.addEventListener('click', async () => {
    try {
      const r = await API.media.favorite(mediaId);
      media.is_favorite = r.isFavorite ? 1 : 0;
      _syncFavBtn();
      showToast(media.is_favorite ? '⭐ Agregado a favoritos' : 'Quitado de favoritos');
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  });

  leftPanel.querySelector('#ve-album-btn').addEventListener('click', async () => {
    let albums = [];
    try { albums = await API.albums.list(); } catch (_) {}
    if (!Array.isArray(albums)) albums = albums?.items || [];

    openModal({
      title: '📁 Agregar a álbum',
      content: albums.length
        ? `<div style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto">
            ${albums.map(a => `
              <button class="ve-action-btn ve-alb-pick" data-id="${a.id}" style="width:100%">
                ${esc(a.name || a.title || `Álbum #${a.id}`)}
              </button>`).join('')}
          </div>`
        : '<p style="color:var(--text-muted)">No hay álbumes creados.</p>',
      actions: [{ label: 'Cancelar', class: 'btn-secondary', action: close => close() }],
    });
    setTimeout(() => {
      document.querySelectorAll('.ve-alb-pick').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await API.albums.addMedia(parseInt(btn.dataset.id), [mediaId]);
            showToast('✅ Agregado al álbum');
          } catch (err) { showToast('Error: ' + err.message, 'error'); }
        });
      });
    }, 80);
  });

  leftPanel.querySelector('#ve-del-btn').addEventListener('click', () => {
    openModal({
      title: '🗑 Eliminar video',
      content: `<p>¿Eliminar <strong>${esc(media.file_name)}</strong>? Esta acción no se puede deshacer.</p>`,
      actions: [
        { label: 'Cancelar', class: 'btn-secondary', action: close => close() },
        { label: 'Eliminar', class: 'btn-danger', action: async close => {
          try {
            await API.media.delete(mediaId);
            close();
            showToast('Video eliminado');
            store.navigate('starcho:gallery');
          } catch (err) { showToast('Error: ' + err.message, 'error'); }
        }},
      ],
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CENTER PANEL — Player
  // ─────────────────────────────────────────────────────────────────────────

  const centerPanel = document.createElement('div');
  centerPanel.className = 've-center';
  root.appendChild(centerPanel);

  // Size selector
  const sizeBar = document.createElement('div');
  sizeBar.className = 've-size-bar';
  sizeBar.innerHTML = `
    <span style="font-size:12px;color:var(--text-muted)">Tamaño:</span>
    <button class="btn btn-sm btn-secondary" data-pct="40">40%</button>
    <button class="btn btn-sm btn-primary"   data-pct="72">72%</button>
    <button class="btn btn-sm btn-secondary" data-pct="100">100%</button>
  `;

  const vidWrap = document.createElement('div');
  vidWrap.className = 've-vid';

  const vid = document.createElement('video');
  vid.src      = API.mediaViewUrl(mediaId);
  vid.controls = true;
  vidWrap.appendChild(vid);

  sizeBar.querySelectorAll('[data-pct]').forEach(btn => {
    btn.addEventListener('click', () => {
      vidWrap.style.width = btn.dataset.pct + '%';
      sizeBar.querySelectorAll('[data-pct]').forEach(b => {
        b.className = 'btn btn-sm btn-secondary';
      });
      btn.className = 'btn btn-sm btn-primary';
    });
  });

  // Skip controls + time badge
  const ctrlBar = document.createElement('div');
  ctrlBar.className = 've-skip-bar';
  ctrlBar.innerHTML = `
    <button class="btn btn-sm btn-secondary" id="ve-rw">⏪ −10s</button>
    <span class="ve-time-badge" id="ve-time-badge">⏱ 0:00 / 0:00</span>
    <button class="btn btn-sm btn-secondary" id="ve-fw">+10s ⏩</button>
  `;

  // Resolution badge (below player)
  const resBadge = document.createElement('span');
  resBadge.className = 've-res-badge';
  resBadge.style.display = 'none';
  if (media.width && media.height) {
    resBadge.textContent = `📐 ${media.width}×${media.height}`;
    resBadge.style.display = '';
  }

  ctrlBar.querySelector('#ve-rw').addEventListener('click', () => {
    vid.currentTime = Math.max(0, vid.currentTime - 10);
  });
  ctrlBar.querySelector('#ve-fw').addEventListener('click', () => {
    vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 10);
  });

  vid.addEventListener('timeupdate', () => {
    const tbadge = ctrlBar.querySelector('#ve-time-badge');
    tbadge.textContent = `⏱ ${_fmtSec(vid.currentTime)} / ${_fmtSec(vid.duration)}`;
  });

  vid.addEventListener('loadedmetadata', () => {
    const dur = vid.duration;
    ctrlBar.querySelector('#ve-time-badge').textContent = `⏱ 0:00 / ${_fmtSec(dur)}`;
    // Update duration in left panel
    leftPanel.querySelector('#ve-duration-left').textContent = _fmtSec(dur);
    // Resolution from video if not in DB
    if (!media.width && vid.videoWidth) {
      resBadge.textContent = `📐 ${vid.videoWidth}×${vid.videoHeight}`;
      resBadge.style.display = '';
    }
    // Sync trim end input
    const endInp = rightPanel?.querySelector('#ve-end');
    if (endInp && !endInp.value) {
      endInp.value = dur.toFixed(1);
      endInp.max   = dur;
    }
    const startInp = rightPanel?.querySelector('#ve-start');
    if (startInp) startInp.max = dur;
    const endRange  = rightPanel?.querySelector('#ve-end-range');
    const startRange = rightPanel?.querySelector('#ve-start-range');
    if (endRange)   { endRange.max   = dur; endRange.value   = dur; }
    if (startRange) { startRange.max = dur; }
    _updateTrimInfo();
  });

  centerPanel.append(sizeBar, vidWrap, ctrlBar, resBadge);

  // ─────────────────────────────────────────────────────────────────────────
  // RIGHT PANEL — Tabs
  // ─────────────────────────────────────────────────────────────────────────

  const rightPanel = document.createElement('div');
  rightPanel.className = 've-panel';
  rightPanel.innerHTML = `
    <div class="ve-tabs-bar">
      <button class="ve-tab active" data-tab="trim">✂️ Cortar</button>
      <button class="ve-tab"       data-tab="info">📝 Info</button>
      <button class="ve-tab"       data-tab="gif">🎬 GIF</button>
    </div>

    <!-- TAB: TRIM -->
    <div class="ve-tab-pane active" id="ve-pane-trim">
      <p class="ve-section-title">Inicio (segundos)</p>
      <div style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;margin-bottom:4px">
        <input type="number" class="form-control" id="ve-start" value="0" min="0" step="0.1">
        <button class="btn btn-sm btn-secondary" id="ve-set-start" title="Capturar tiempo actual">📍 Actual</button>
      </div>
      <input type="range" class="ve-range" id="ve-start-range" min="0" step="0.1" value="0" style="margin-bottom:12px">

      <p class="ve-section-title">Fin (segundos)</p>
      <div style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;margin-bottom:4px">
        <input type="number" class="form-control" id="ve-end" value="" min="0" step="0.1">
        <button class="btn btn-sm btn-secondary" id="ve-set-end" title="Capturar tiempo actual">📍 Actual</button>
      </div>
      <input type="range" class="ve-range" id="ve-end-range" min="0" step="0.1" value="0" style="margin-bottom:12px">

      <div id="ve-trim-info" style="font-size:12px;color:var(--text-muted);min-height:18px;margin-bottom:10px"></div>

      <div class="ve-progress-bar-wrap" id="ve-trim-progress">
        <div class="ve-progress-bar"></div>
      </div>

      <button class="btn btn-primary" id="ve-trim-btn" style="width:100%;padding:10px">✂️ Cortar y guardar</button>
      <p style="font-size:11px;color:var(--text-muted);margin-top:10px;line-height:1.55">
        ⚠️ El archivo original se reemplaza con el segmento cortado.<br>
        Requiere <strong>FFmpeg</strong> instalado en el sistema.
      </p>
    </div>

    <!-- TAB: INFO -->
    <div class="ve-tab-pane" id="ve-pane-info">
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px">NOMBRE DE ARCHIVO</label>
          <input type="text" class="form-control" id="ve-filename" value="${esc(media.file_name || '')}" style="width:100%">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px">TÍTULO</label>
          <input type="text" class="form-control" id="ve-title" value="${esc(media.title || '')}" placeholder="Título del video" style="width:100%">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px">DESCRIPCIÓN</label>
          <textarea class="form-control" id="ve-desc" rows="4" style="width:100%;resize:vertical">${esc(media.description || '')}</textarea>
        </div>
        <button class="btn btn-primary" id="ve-save-info" style="width:100%;padding:10px">💾 Guardar información</button>
      </div>

      <p class="ve-section-title" style="margin-top:18px">📋 Metadatos</p>
      <table class="ve-meta-table">
        <tr><td>Tipo</td><td>${esc(media.mime_type || media.media_type || '—')}</td></tr>
        <tr><td>Tamaño</td><td>${_fmtBytes(media.file_size)}</td></tr>
        <tr><td>Creado</td><td>${_fmtDate(media.created_at)}</td></tr>
        <tr><td>Formato orig.</td><td>${esc(media.original_format || '—')}</td></tr>
        ${media.width ? `<tr><td>Resolución</td><td>${media.width}×${media.height}</td></tr>` : ''}
      </table>
    </div>

    <!-- TAB: GIF -->
    <div class="ve-tab-pane" id="ve-pane-gif">
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;line-height:1.5">
        Convierte los primeros <strong>10 segundos</strong> del video a GIF animado
        (480px ancho, 12 fps, paleta optimizada).
      </p>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:14px;cursor:pointer">
        <input type="checkbox" id="ve-gif-use-trim">
        Usar segmento del corte (máx 10s)
      </label>
      <button class="btn btn-primary" id="ve-gif-btn" style="width:100%;padding:10px">🎬 Exportar como GIF</button>
      <div id="ve-gif-spinner" style="display:none;text-align:center;padding:12px;color:var(--text-muted);font-size:13px">
        ⏳ Generando GIF…
      </div>
      <div class="ve-gif-result" id="ve-gif-result" style="display:none"></div>
    </div>
  `;
  root.appendChild(rightPanel);

  // ── Tab switching ─────────────────────────────────────────────────────────

  rightPanel.querySelectorAll('.ve-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      rightPanel.querySelectorAll('.ve-tab').forEach(t => t.classList.remove('active'));
      rightPanel.querySelectorAll('.ve-tab-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      rightPanel.querySelector(`#ve-pane-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // ── Trim inputs & ranges ──────────────────────────────────────────────────

  const startInp   = rightPanel.querySelector('#ve-start');
  const endInp     = rightPanel.querySelector('#ve-end');
  const startRange = rightPanel.querySelector('#ve-start-range');
  const endRange   = rightPanel.querySelector('#ve-end-range');

  function _updateTrimInfo() {
    const s = parseFloat(startInp.value) || 0;
    const e = parseFloat(endInp.value);
    const info = rightPanel.querySelector('#ve-trim-info');
    if (!isNaN(e) && e > s) {
      info.textContent = `Duración del corte: ${_fmtSec(e - s)}`;
      info.style.color = 'var(--text-muted)';
    } else if (!isNaN(e) && e <= s) {
      info.textContent = '⚠ El fin debe ser mayor que el inicio';
      info.style.color = 'var(--red)';
    } else {
      info.textContent = '';
    }
  }

  // Number → Range
  startInp.addEventListener('input', () => { startRange.value = startInp.value; _updateTrimInfo(); });
  endInp.addEventListener('input',   () => { endRange.value   = endInp.value;   _updateTrimInfo(); });

  // Range → Number
  startRange.addEventListener('input', () => { startInp.value = parseFloat(startRange.value).toFixed(1); _updateTrimInfo(); });
  endRange.addEventListener('input',   () => { endInp.value   = parseFloat(endRange.value).toFixed(1);   _updateTrimInfo(); });

  rightPanel.querySelector('#ve-set-start').addEventListener('click', () => {
    startInp.value  = vid.currentTime.toFixed(1);
    startRange.value = vid.currentTime;
    _updateTrimInfo();
  });
  rightPanel.querySelector('#ve-set-end').addEventListener('click', () => {
    endInp.value   = vid.currentTime.toFixed(1);
    endRange.value = vid.currentTime;
    _updateTrimInfo();
  });

  // ── Trim action ────────────────────────────────────────────────────────────

  rightPanel.querySelector('#ve-trim-btn').addEventListener('click', async () => {
    const startVal = parseFloat(startInp.value);
    const endVal   = parseFloat(endInp.value);
    if (isNaN(startVal) || isNaN(endVal) || startVal >= endVal) {
      showToast('El tiempo de inicio debe ser menor que el fin.', 'error');
      return;
    }
    const btn      = rightPanel.querySelector('#ve-trim-btn');
    const progress = rightPanel.querySelector('#ve-trim-progress');
    btn.disabled    = true;
    btn.textContent = '⏳ Procesando…';
    progress.classList.add('running');
    try {
      await API.media.trim(mediaId, startVal, endVal);
      showToast('✅ Video cortado y guardado');
      const baseUrl = API.mediaViewUrl(mediaId);
      vid.src = baseUrl + (baseUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
      vid.load();
    } catch (err) {
      showToast('Error al cortar: ' + err.message, 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = '✂️ Cortar y guardar';
      progress.classList.remove('running');
    }
  });

  // ── Info save ─────────────────────────────────────────────────────────────

  rightPanel.querySelector('#ve-save-info').addEventListener('click', async () => {
    const fileName = rightPanel.querySelector('#ve-filename').value.trim();
    const title    = rightPanel.querySelector('#ve-title').value.trim();
    const desc     = rightPanel.querySelector('#ve-desc').value.trim();
    const btn      = rightPanel.querySelector('#ve-save-info');
    btn.disabled   = true;
    try {
      if (fileName && fileName !== media.file_name) {
        await API.media.rename(mediaId, fileName);
        media.file_name = fileName;
      }
      await API.media.updateMeta(mediaId, { title, description: desc });
      media.title       = title;
      media.description = desc;
      showToast('✅ Información guardada');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // ── GIF export ────────────────────────────────────────────────────────────

  rightPanel.querySelector('#ve-gif-btn').addEventListener('click', async () => {
    const useTrim  = rightPanel.querySelector('#ve-gif-use-trim').checked;
    const btn      = rightPanel.querySelector('#ve-gif-btn');
    const spinner  = rightPanel.querySelector('#ve-gif-spinner');
    const result   = rightPanel.querySelector('#ve-gif-result');

    let gifStart    = 0;
    let gifDuration = 10;

    if (useTrim) {
      const s = parseFloat(startInp.value) || 0;
      const e = parseFloat(endInp.value);
      if (!isNaN(e) && e > s) {
        gifStart    = s;
        gifDuration = Math.min(10, e - s);
      }
    }

    btn.disabled    = true;
    btn.textContent = '⏳ Exportando…';
    spinner.style.display = 'block';
    result.style.display  = 'none';

    try {
      // Build URL and auth token for raw fetch (FormData not needed — JSON body)
      const token = window.playcamAuthToken || (() => {
        try { return JSON.parse(sessionStorage.getItem('auth_session') || localStorage.getItem('auth_session') || 'null')?.token; } catch (_) { return null; }
      })();
      const base = API.getBase();
      const resp = await fetch(`${base}/api/media/${mediaId}/gif`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({ start: gifStart, duration: gifDuration }),
      });
      const data = await resp.json();

      if (!resp.ok || data.error) {
        const msg = data.error || `HTTP ${resp.status}`;
        if (msg.toLowerCase().includes('ffmpeg')) {
          result.innerHTML = `<span style="color:var(--red)">❌ FFmpeg no está disponible en este sistema.<br>
            Instala FFmpeg y reinicia la aplicación.</span>`;
        } else {
          result.innerHTML = `<span style="color:var(--red)">❌ ${esc(msg)}</span>`;
        }
        result.style.display = 'block';
        return;
      }

      result.innerHTML = `✅ GIF creado — <a href="#" id="ve-gif-gallery-link"
        style="color:var(--accent);text-decoration:underline;cursor:pointer">Ver en Galería</a>`;
      result.style.display = 'block';
      result.querySelector('#ve-gif-gallery-link').addEventListener('click', e => {
        e.preventDefault();
        store.navigate('starcho:gallery');
      });
      showToast('✅ GIF exportado correctamente');
    } catch (err) {
      result.innerHTML = `<span style="color:var(--red)">❌ Error: ${esc(err.message)}</span>`;
      result.style.display = 'block';
    } finally {
      btn.disabled    = false;
      btn.textContent = '🎬 Exportar como GIF';
      spinner.style.display = 'none';
    }
  });
}
