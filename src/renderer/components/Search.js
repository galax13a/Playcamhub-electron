'use strict';
import store    from '../store.js';
import API      from '../utils/api.js';
import { renderCards } from './Library.js';
import { showToast } from './Modal.js';
import { sanitizeHTML } from '../utils/formatters.js';

export async function renderSearch(el) {
  el.innerHTML = `
    <div class="topbar">
      <span class="topbar-title">🔍 Búsqueda</span>
    </div>
    <div class="search-tabs">
      <button class="search-tab active" data-tab="youtube">🌐 YouTube</button>
      <button class="search-tab"        data-tab="local">💾 Local</button>
    </div>
    <div id="search-tab-youtube" class="search-tab-panel">
      ${_buildYouTubePanel()}
    </div>
    <div id="search-tab-local" class="search-tab-panel" style="display:none">
      ${_buildLocalPanel()}
    </div>`;

  // Tab switching
  el.querySelectorAll('.search-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.search-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      el.querySelector('#search-tab-youtube').style.display = tab === 'youtube' ? '' : 'none';
      el.querySelector('#search-tab-local').style.display   = tab === 'local'   ? '' : 'none';
      if (tab === 'local') el.querySelector('#local-input')?.focus();
    });
  });

  _bindYouTube(el);
  _bindLocal(el);
}

// ── YouTube tab ───────────────────────────────────────────────────────────────

function _buildYouTubePanel() {
  return `
    <div class="yt-panel">
      <div class="yt-input-row">
        <div class="topbar-search" style="flex:1">
          <span class="search-icon">🔗</span>
          <input id="yt-url-input" placeholder="Pega la URL de YouTube…" autocomplete="off">
        </div>
        <button class="btn btn-secondary btn-sm" id="yt-info-btn">Vista previa</button>
      </div>
      <div id="yt-preview" class="yt-preview"></div>
      <div id="yt-queue-section">
        <div class="yt-queue-header">
          <span>Cola de descarga</span>
          <button class="btn btn-ghost btn-sm" id="yt-clear-btn">Limpiar</button>
        </div>
        <div id="yt-queue-list" class="yt-queue-list"></div>
      </div>
    </div>`;
}

function _bindYouTube(el) {
  const urlInput  = el.querySelector('#yt-url-input');
  const infoBtn   = el.querySelector('#yt-info-btn');
  const preview   = el.querySelector('#yt-preview');
  const clearBtn  = el.querySelector('#yt-clear-btn');

  let _previewUrl = null;

  infoBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;
    infoBtn.disabled = true;
    infoBtn.textContent = '⏳ Cargando…';
    preview.innerHTML = '';
    try {
      // Use yt-dlp via backend: add with format 'info' trick — actually we do a preview
      // by calling info through the backend. For now show the URL and download buttons.
      _previewUrl = url;
      preview.innerHTML = _previewHtml(url);
      _bindPreviewBtns(el, url);
    } catch (err) {
      preview.innerHTML = `<div class="yt-error">Error: ${sanitizeHTML(err.message)}</div>`;
    } finally {
      infoBtn.disabled = false;
      infoBtn.textContent = 'Vista previa';
    }
  });

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') infoBtn.click();
  });

  // Paste auto-trigger
  urlInput.addEventListener('paste', () => {
    setTimeout(() => {
      if (urlInput.value.trim().startsWith('http')) infoBtn.click();
    }, 50);
  });

  clearBtn.addEventListener('click', async () => {
    await API.downloads.clearFinished().catch(() => {});
    _refreshQueue(el);
  });

  _refreshQueue(el);

  // Auto-refresh queue every 3 s while tab is shown
  const timer = setInterval(() => {
    if (el.querySelector('#search-tab-youtube')?.style.display !== 'none') {
      _refreshQueue(el);
    }
  }, 3000);

  // Clean up timer when the view is replaced
  const observer = new MutationObserver(() => {
    if (!document.contains(el)) { clearInterval(timer); observer.disconnect(); }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function _previewHtml(url) {
  const safe = sanitizeHTML(url);
  // Extract video ID for thumbnail preview
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  const thumb = m
    ? `<img class="yt-prev-thumb" src="https://img.youtube.com/vi/${m[1]}/mqdefault.jpg" alt="" loading="lazy">`
    : '<div class="yt-prev-thumb yt-prev-thumb-ph">📺</div>';

  return `
    <div class="yt-preview-card">
      ${thumb}
      <div class="yt-prev-info">
        <div class="yt-prev-url">${safe}</div>
        <div class="yt-prev-actions">
          <button class="btn btn-primary btn-sm" id="dl-mp3">⬇ MP3</button>
          <button class="btn btn-secondary btn-sm" id="dl-mp4">🎬 Video MP4</button>
        </div>
      </div>
    </div>`;
}

function _bindPreviewBtns(el, url) {
  el.querySelector('#dl-mp3')?.addEventListener('click', () => _download(el, url, 'audio'));
  el.querySelector('#dl-mp4')?.addEventListener('click', () => _download(el, url, 'video'));
}

async function _download(el, url, format) {
  const btn = el.querySelector(format === 'audio' ? '#dl-mp3' : '#dl-mp4');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Agregando…'; }
  try {
    await API.downloads.add(url, format);
    showToast('Descarga iniciada', 'success');
    el.querySelector('#yt-url-input').value = '';
    el.querySelector('#yt-preview').innerHTML = '';
    _refreshQueue(el);
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = format === 'audio' ? '⬇ MP3' : '🎬 Video MP4'; }
  }
}

async function _refreshQueue(el) {
  const listEl = el.querySelector('#yt-queue-list');
  if (!listEl) return;
  try {
    const items = await API.downloads.list();
    if (!items.length) {
      listEl.innerHTML = '<div class="yt-empty">Cola vacía</div>';
      return;
    }
    listEl.innerHTML = items.map(item => {
      const icon = { pending: '⏳', downloading: '⬇', completed: '✅', failed: '❌' }[item.status] || '⏳';
      const pct  = item.status === 'downloading' ? `${Math.round(item.progress || 0)}%` : '';
      return `
        <div class="yt-q-row" data-id="${item.id}">
          <span class="yt-q-icon">${icon}</span>
          <div class="yt-q-info">
            <div class="yt-q-title">${sanitizeHTML(item.title || item.youtube_url)}</div>
            <div class="yt-q-meta">${item.format === 'video' ? '🎬 MP4' : '🎵 MP3'} ${pct}</div>
          </div>
          <button class="btn-ghost btn-icon yt-q-del" data-id="${item.id}" title="Eliminar">✕</button>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.yt-q-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        await API.downloads.remove(id).catch(() => {});
        _refreshQueue(el);
      });
    });
  } catch (_) {}
}

// ── Local tab ─────────────────────────────────────────────────────────────────

function _buildLocalPanel() {
  return `
    <div style="padding:20px 24px 0">
      <div class="topbar-search" style="max-width:600px;margin-bottom:20px">
        <span class="search-icon">🔍</span>
        <input id="local-input" placeholder="Busca en tu biblioteca…" autocomplete="off">
      </div>
      <div id="local-results"></div>
    </div>`;
}

function _bindLocal(el) {
  let timer = null;
  const input   = el.querySelector('#local-input');
  const results = el.querySelector('#local-results');

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) { results.innerHTML = ''; return; }
    timer = setTimeout(() => _doLocalSearch(q, results), 300);
  });
}

function _doLocalSearch(q, results) {
  const lq = q.toLowerCase();
  const matches = store.state.songs.filter(s =>
    s.title.toLowerCase().includes(lq) ||
    (s.artist || '').toLowerCase().includes(lq) ||
    (s.album  || '').toLowerCase().includes(lq)
  );
  if (!matches.length) {
    results.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><h3>Sin resultados</h3></div>`;
    return;
  }
  results.innerHTML = '<div class="songs-grid"></div>';
  renderCards(results.querySelector('.songs-grid'), matches);
}
