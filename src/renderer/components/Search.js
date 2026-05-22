'use strict';
import API      from '../utils/api.js';
import { showToast } from './Modal.js';
import { sanitizeHTML } from '../utils/formatters.js';

// ── YouTube Dashboard ─────────────────────────────────────────────────────────

export async function renderYouTubeDashboard(el) {
  el.innerHTML = `
    <div class="topbar">
      <span class="topbar-title">📥 YouTube</span>
      <div class="yt-dash-stats" id="yt-stats"></div>
      <button class="btn btn-ghost btn-sm" id="yt-clear-btn" title="Limpiar completadas">🗑 Limpiar</button>
    </div>

    <div class="yt-dash-body">

      <!-- URL input -->
      <div class="yt-dash-input-card">
        <div class="yt-dash-input-label">Pega la URL del video o playlist de YouTube</div>
        <div class="yt-dash-input-row">
          <span class="yt-dash-url-icon">🔗</span>
          <input class="yt-dash-url-input" id="yt-url-input"
                 placeholder="https://youtube.com/watch?v=…"
                 autocomplete="off" spellcheck="false">
          <button class="btn btn-primary" id="yt-preview-btn">Vista previa</button>
        </div>
        <div id="yt-preview" class="yt-dash-preview"></div>
      </div>

      <!-- Download queue -->
      <div class="yt-dash-queue-card">
        <div class="yt-dash-queue-header">
          <span class="yt-dash-queue-title">Cola de descarga</span>
          <span class="yt-dash-badge" id="yt-queue-badge">0</span>
        </div>
        <div id="yt-queue-list" class="yt-dash-queue-list">
          <div class="yt-dash-empty">Cola vacía — pega una URL arriba para empezar</div>
        </div>
      </div>

    </div>`;

  const urlInput  = el.querySelector('#yt-url-input');
  const previewBtn = el.querySelector('#yt-preview-btn');
  const previewEl  = el.querySelector('#yt-preview');
  const clearBtn   = el.querySelector('#yt-clear-btn');

  // ── Preview ───────────────────────────────────────────────────────────────

  previewBtn.addEventListener('click', () => _loadPreview(urlInput.value.trim(), previewEl, el));

  urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') previewBtn.click();
  });

  // Auto-trigger on paste
  urlInput.addEventListener('paste', () => {
    setTimeout(() => {
      const v = urlInput.value.trim();
      if (v.startsWith('http')) _loadPreview(v, previewEl, el);
    }, 60);
  });

  // ── Clear ─────────────────────────────────────────────────────────────────

  clearBtn.addEventListener('click', async () => {
    await API.downloads.clearFinished().catch(() => {});
    showToast('Cola limpiada', 'success');
    _refreshQueue(el);
  });

  // ── Initial queue load + auto-refresh ────────────────────────────────────

  await _refreshQueue(el);

  const timer = setInterval(() => _refreshQueue(el), 3000);

  const obs = new MutationObserver(() => {
    if (!document.contains(el)) { clearInterval(timer); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

// ── Preview ───────────────────────────────────────────────────────────────────

async function _loadPreview(url, previewEl, rootEl) {
  if (!url) return;
  previewEl.innerHTML = `<div class="yt-dash-preview-loading">⏳ Cargando vista previa…</div>`;

  try {
    const m     = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    const vidId = m ? m[1] : null;
    const thumb = vidId
      ? `<img class="yt-dash-thumb" src="https://img.youtube.com/vi/${vidId}/mqdefault.jpg"
              alt="" loading="lazy">`
      : `<div class="yt-dash-thumb yt-dash-thumb-ph">📺</div>`;

    previewEl.innerHTML = `
      <div class="yt-dash-prev-card">
        ${thumb}
        <div class="yt-dash-prev-info">
          <div class="yt-dash-prev-url">${sanitizeHTML(url)}</div>
          <div class="yt-dash-prev-hint">Selecciona el formato de descarga:</div>
          <div class="yt-dash-prev-actions">
            <button class="btn btn-primary" id="dl-mp3">
              🎵 Solo audio (MP3)
            </button>
            <button class="btn btn-secondary" id="dl-mp4">
              🎬 Video (MP4)
            </button>
          </div>
        </div>
      </div>`;

    rootEl.querySelector('#dl-mp3')?.addEventListener('click', () => _download(url, 'audio', previewEl, rootEl));
    rootEl.querySelector('#dl-mp4')?.addEventListener('click', () => _download(url, 'video', previewEl, rootEl));
  } catch (err) {
    previewEl.innerHTML = `<div class="yt-dash-error">Error: ${sanitizeHTML(err.message)}</div>`;
  }
}

// ── Download ──────────────────────────────────────────────────────────────────

async function _download(url, format, previewEl, rootEl) {
  const mp3Btn = rootEl.querySelector('#dl-mp3');
  const mp4Btn = rootEl.querySelector('#dl-mp4');
  if (mp3Btn) mp3Btn.disabled = true;
  if (mp4Btn) mp4Btn.disabled = true;

  try {
    await API.downloads.add(url, format);
    rootEl.querySelector('#yt-url-input').value = '';
    previewEl.innerHTML = '';
    showToast('Descarga agregada a la cola', 'success');
    await _refreshQueue(rootEl);
  } catch (err) {
    showToast(err.message || 'Error al agregar descarga', 'error');
  } finally {
    if (mp3Btn) mp3Btn.disabled = false;
    if (mp4Btn) mp4Btn.disabled = false;
  }
}

// ── Queue refresh ─────────────────────────────────────────────────────────────

const STATUS_ICON = {
  pending:     '⏳',
  downloading: '⬇️',
  completed:   '✅',
  failed:      '❌',
};

const STATUS_LABEL = {
  pending:     'En espera',
  downloading: 'Descargando',
  completed:   'Completado',
  failed:      'Error',
};

async function _refreshQueue(el) {
  const listEl  = el.querySelector('#yt-queue-list');
  const statsEl = el.querySelector('#yt-stats');
  const badgeEl = el.querySelector('#yt-queue-badge');
  if (!listEl) return;

  let items = [];
  try { items = await API.downloads.list(); } catch (_) { return; }

  // Update stats pills
  if (statsEl) {
    const counts = {
      pending:     items.filter(i => i.status === 'pending').length,
      downloading: items.filter(i => i.status === 'downloading').length,
      completed:   items.filter(i => i.status === 'completed').length,
      failed:      items.filter(i => i.status === 'failed').length,
    };
    statsEl.innerHTML = [
      counts.downloading ? `<span class="yt-stat-pill yt-stat-dl">⬇️ ${counts.downloading} descargando</span>` : '',
      counts.pending     ? `<span class="yt-stat-pill yt-stat-pending">⏳ ${counts.pending} en espera</span>` : '',
      counts.completed   ? `<span class="yt-stat-pill yt-stat-done">✅ ${counts.completed} listas</span>` : '',
      counts.failed      ? `<span class="yt-stat-pill yt-stat-fail">❌ ${counts.failed} error</span>` : '',
    ].filter(Boolean).join('');
  }

  if (badgeEl) badgeEl.textContent = items.length;

  if (!items.length) {
    listEl.innerHTML = `<div class="yt-dash-empty">Cola vacía — pega una URL arriba para empezar</div>`;
    return;
  }

  listEl.innerHTML = items.map(item => {
    const icon  = STATUS_ICON[item.status]  || '⏳';
    const label = STATUS_LABEL[item.status] || item.status;
    const pct   = item.status === 'downloading' ? Math.round(item.progress || 0) : null;
    const fmt   = item.format === 'video' ? '🎬 MP4' : '🎵 MP3';
    const isDone = item.status === 'completed' || item.status === 'failed';

    return `
      <div class="yt-dash-item ${item.status}" data-id="${item.id}">
        <div class="yt-dash-item-icon">${icon}</div>
        <div class="yt-dash-item-body">
          <div class="yt-dash-item-title">${sanitizeHTML(item.title || item.youtube_url)}</div>
          <div class="yt-dash-item-meta">
            <span class="yt-fmt-badge">${fmt}</span>
            <span class="yt-status-label">${label}${pct !== null ? ` · ${pct}%` : ''}</span>
          </div>
          ${pct !== null ? `
            <div class="yt-progress-track">
              <div class="yt-progress-fill" style="width:${pct}%"></div>
            </div>` : ''}
        </div>
        ${isDone ? `<button class="yt-dash-del" data-id="${item.id}" title="Eliminar">✕</button>` : ''}
      </div>`;
  }).join('');

  listEl.querySelectorAll('.yt-dash-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await API.downloads.remove(parseInt(btn.dataset.id)).catch(() => {});
      _refreshQueue(el);
    });
  });
}
