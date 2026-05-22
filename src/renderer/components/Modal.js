'use strict';
import EventBus from '../utils/eventBus.js';
import API      from '../utils/api.js';
import store    from '../store.js';
import { t }    from '../utils/i18n.js';

let _container = null;

export function initModal() {
  _container = document.getElementById('modal-container');
  // Global click to close context menu
  document.addEventListener('click', closeContextMenu);
}

// ── Toast ─────────────────────────────────────────────────────────────────────

export function showToast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '🔔'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ── Generic modal ─────────────────────────────────────────────────────────────

export function openModal({ title, content, actions = [] }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal anim-scale-in">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" id="modal-close-btn">✕</button>
      </div>
      <div class="modal-body">${content}</div>
      ${actions.length ? `
        <div class="modal-footer" style="display:flex;gap:10px;justify-content:flex-end;margin-top:24px">
          ${actions.map((a, i) => `
            <button class="btn ${a.class || 'btn-secondary'}" id="modal-action-${i}">
              ${a.label}
            </button>`).join('')}
        </div>` : ''}
    </div>`;
  _container.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  function close() { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 220); }

  overlay.querySelector('#modal-close-btn').onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  actions.forEach((a, i) => {
    overlay.querySelector(`#modal-action-${i}`).onclick = () => {
      if (a.action) a.action(close);
      else close();
    };
  });

  return { close };
}

// ── Create playlist modal ─────────────────────────────────────────────────────

export function openNewPlaylistModal(onCreated) {
  openModal({
    title: t('new_pl_btn'),
    content: `
      <div class="form-group">
        <label>${t('pl_name_label')}</label>
        <input class="form-control" id="pl-name" placeholder="${t('pl_name_ph')}" autofocus>
      </div>
      <div class="form-group">
        <label>${t('pl_desc_label')}</label>
        <input class="form-control" id="pl-desc" placeholder="${t('pl_desc_ph')}">
      </div>`,
    actions: [
      { label: t('cancel'), class: 'btn-secondary', action: (close) => close() },
      {
        label: t('create'), class: 'btn-primary',
        action: async (close) => {
          const name = document.getElementById('pl-name').value.trim();
          if (!name) { document.getElementById('pl-name').focus(); return; }
          const desc = document.getElementById('pl-desc').value.trim();
          close();
          if (onCreated) await onCreated({ name, description: desc });
        },
      },
    ],
  });
  setTimeout(() => document.getElementById('pl-name')?.focus(), 100);
}

// ── Context menu ──────────────────────────────────────────────────────────────

export function openContextMenu(e, items) {
  e.preventDefault();
  const menu = document.getElementById('context-menu');
  menu.innerHTML = items.map((item, i) => {
    if (item === 'divider') return `<div class="ctx-divider"></div>`;
    return `<div class="ctx-item ${item.danger ? 'danger' : ''}" data-idx="${i}">
      ${item.icon ? `<span>${item.icon}</span>` : ''}
      <span>${item.label}</span>
    </div>`;
  }).join('');

  // Position
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = e.clientX, y = e.clientY;
  menu.classList.remove('context-menu--hidden');
  const { offsetWidth: w, offsetHeight: h } = menu;
  if (x + w > vw) x = vw - w - 8;
  if (y + h > vh) y = vh - h - 8;
  menu.style.left = `${x}px`;
  menu.style.top  = `${y}px`;

  menu.querySelectorAll('.ctx-item').forEach(el => {
    const idx = parseInt(el.dataset.idx);
    const item = items[idx];
    if (item && item.action) {
      el.onclick = () => { item.action(); closeContextMenu(); };
    }
  });
}

function closeContextMenu() {
  const menu = document.getElementById('context-menu');
  if (menu) menu.classList.add('context-menu--hidden');
}

EventBus.on('modal:new-playlist', () => openNewPlaylistModal());

// ── Category picker (post-download) ──────────────────────────────────────────

export function openCategoryPickerModal(songId, songTitle, onDone) {
  const cats = store.state.categories;

  openModal({
    title: `${t('categorize')}: ${songTitle}`,
    content: `
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px">
        ${t('cat_assign_desc')}
      </p>
      <div class="form-group">
        <label>${t('category')}</label>
        <select class="form-control" id="cat-pick-select">
          <option value="">— ${t('no_category')} —</option>
          ${cats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
        <span style="font-size:12px;color:var(--text-muted)">Or create new:</span>
        <input class="form-control" id="cat-pick-new" placeholder="${t('cat_placeholder')}" style="flex:1">
        <input type="color" id="cat-pick-color" value="#8B5CF6"
               style="width:36px;height:36px;border:none;background:none;cursor:pointer;padding:0;border-radius:var(--radius-sm)">
      </div>`,
    actions: [
      {
        label: t('skip'), class: 'btn-secondary',
        action: (c) => { c(); onDone?.(); },
      },
      {
        label: t('assign_cat'), class: 'btn-primary',
        action: async (c) => {
          const newName  = document.getElementById('cat-pick-new').value.trim();
          const newColor = document.getElementById('cat-pick-color').value;
          let   catId    = document.getElementById('cat-pick-select').value;

          if (newName) {
            const created = await API.categories.create({ name: newName, color: newColor });
            catId = String(created.id);
            await store.loadCategories();
          }

          if (catId) {
            await API.songs.update(songId, { category_id: parseInt(catId) });
            await store.loadSongs();
            showToast('Category assigned', 'success');
          }
          c();
          onDone?.();
        },
      },
    ],
  });

  setTimeout(() => document.getElementById('cat-pick-select')?.focus(), 100);
}

// ── Video quality picker ──────────────────────────────────────────────────────

export function openVideoQualityModal(formats, onSelect) {
  const opts = formats.length
    ? formats.map(f => `<option value="${f.height}">${f.label}</option>`).join('')
    : `<option value="best">${t('quality_best')}</option>`;

  openModal({
    title: t('vq_title'),
    content: `
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px">
        ${t('vq_desc')}
      </p>
      <div class="form-group">
        <label>Resolution</label>
        <select class="form-control" id="vq-select" style="font-size:14px">
          ${opts}
        </select>
      </div>`,
    actions: [
      { label: t('cancel'), class: 'btn-secondary', action: (c) => c() },
      {
        label: '⬇ Download', class: 'btn-primary',
        action: (c) => {
          const val = document.getElementById('vq-select').value;
          c();
          onSelect(val === 'best' ? 'best' : String(val));
        },
      },
    ],
  });
  setTimeout(() => document.getElementById('vq-select')?.focus(), 100);
}

// ── Play-now prompt (after download) ─────────────────────────────────────────

// ── Import library confirmation ───────────────────────────────────────────────

export function openImportLibraryModal(data, onConfirm) {
  const withYt    = data.songs.filter(s => s.youtube_url).length;
  const withoutYt = data.songs.length - withYt;

  let redownload = true;

  const { close } = openModal({
    title: '📥 Import Library',
    content: `
      <div style="font-size:14px;line-height:1.7;color:var(--text-secondary)">
        <p style="margin-bottom:10px">Found <strong style="color:var(--text)">${data.songs.length} songs</strong> in this file:</p>
        <ul style="list-style:none;padding:0;margin:0 0 14px;display:flex;flex-direction:column;gap:4px">
          <li>🎵 ${withYt} songs with YouTube links</li>
          ${withoutYt ? `<li>📁 ${withoutYt} local-only songs (metadata only)</li>` : ''}
          ${data.categories?.length ? `<li>🏷 ${data.categories.length} categories</li>` : ''}
          ${data.playlists?.filter(p => p.id !== 1).length ? `<li>🎶 ${data.playlists.filter(p => p.id !== 1).length} playlists</li>` : ''}
        </ul>
        ${withYt ? `
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;
                      padding:10px 12px;border-radius:var(--radius-md);
                      background:var(--bg-3);border:1px solid var(--border)">
          <input type="checkbox" id="cb-redownload" checked
                 style="width:16px;height:16px;cursor:pointer;accent-color:var(--red)">
          <span>Re-download all songs from YouTube</span>
        </label>` : ''}
      </div>`,
    actions: [
      { label: t('cancel'), class: 'btn-secondary', action: (c) => c() },
      {
        label: '⬆ Import', class: 'btn-primary',
        action: (c) => {
          redownload = withYt > 0 && (document.getElementById('cb-redownload')?.checked ?? true);
          c();
          onConfirm(redownload);
        },
      },
    ],
  });
  return { close };
}

// ── Migration progress panel ──────────────────────────────────────────────────

export function openMigrationModal(batchId, total) {
  let _timer = null;
  let _closed = false;

  const { close } = openModal({
    title: '📥 Migration Progress',
    content: `
      <div id="migration-summary" style="margin-bottom:14px;font-size:14px">
        <span id="mig-count" style="font-weight:700">0 / ${total}</span>
        <span style="color:var(--text-muted)"> downloaded</span>
        <div style="margin-top:8px;height:6px;background:var(--bg-3);border-radius:var(--radius-full);overflow:hidden">
          <div id="mig-bar" style="height:100%;background:var(--gradient-brand);width:0%;transition:width .5s ease;border-radius:var(--radius-full)"></div>
        </div>
      </div>
      <div id="migration-list" style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;font-size:13px"></div>`,
    actions: [
      { label: 'Close', class: 'btn-secondary', action: (c) => { _closed = true; clearInterval(_timer); c(); } },
    ],
  });

  const statusIcon = { pending: '⏳', downloading: '⬇', completed: '✅', failed: '❌' };

  async function _poll() {
    if (_closed) return;
    try {
      const items = await API.library.migrationStatus(batchId);
      const done  = items.filter(i => i.status === 'completed').length;
      const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

      const countEl = document.getElementById('mig-count');
      const barEl   = document.getElementById('mig-bar');
      const listEl  = document.getElementById('migration-list');
      if (!countEl) { _closed = true; clearInterval(_timer); return; }

      countEl.textContent = `${done} / ${total}`;
      barEl.style.width = `${pct}%`;
      listEl.innerHTML = items.map(i => `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;
                    border-bottom:1px solid var(--border)">
          <span style="font-size:16px;flex-shrink:0">${statusIcon[i.status] || '⏳'}</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i.title}</span>
          ${i.status === 'downloading' ? `<span style="color:var(--text-muted)">${i.progress || 0}%</span>` : ''}
        </div>`).join('');

      if (items.every(i => i.status === 'completed' || i.status === 'failed')) {
        clearInterval(_timer);
        if (countEl) countEl.textContent = `${done} / ${total} — Done`;
      }
    } catch (_) {}
  }

  _poll();
  _timer = setInterval(_poll, 2000);
}

export function openPlayNowModal(song) {
  const isVideo = song.type === 'video';
  openModal({
    title: t('dl_complete'),
    content: `
      <div style="text-align:center;padding:8px 0 4px">
        <div style="font-size:40px;margin-bottom:12px">${isVideo ? '🎬' : '🎵'}</div>
        <p style="font-weight:600;font-size:15px;margin-bottom:6px">${song.title}</p>
        <p style="font-size:13px;color:var(--text-muted)">
          ${isVideo ? t('dl_watch_q') : t('dl_listen_q')}
        </p>
      </div>`,
    actions: [
      { label: t('play_later'), class: 'btn-secondary', action: (c) => c() },
      {
        label: isVideo ? t('btn_watch_now') : t('btn_play_now'),
        class: 'btn-primary',
        action: (c) => { c(); store.playSong(song); },
      },
    ],
  });
}
