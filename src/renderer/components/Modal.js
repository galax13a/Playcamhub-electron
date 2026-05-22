'use strict';
import EventBus from '../utils/eventBus.js';
import API      from '../utils/api.js';
import store    from '../store.js';
import { t }    from '../utils/i18n.js';

// ── Field error helpers ───────────────────────────────────────────────────────

export function markFieldErrors(fields, containerEl) {
  if (!fields || !containerEl) return;
  let focusedFirst = false;
  Object.entries(fields).forEach(([name, msgs]) => {
    const el =
      containerEl.querySelector(`[data-field="${name}"]`) ||
      containerEl.querySelector(`[name="${name}"]`)       ||
      containerEl.querySelector(`#${name}`)               ||
      null;
    if (!el) return;
    el.classList.add('is-invalid');
    el.parentElement?.querySelector('.field-error-msg')?.remove();
    const div = document.createElement('div');
    div.className = 'field-error-msg';
    div.textContent = Array.isArray(msgs) ? msgs[0] : String(msgs);
    el.insertAdjacentElement('afterend', div);
    el.addEventListener('input', () => {
      el.classList.remove('is-invalid');
      el.parentElement?.querySelector('.field-error-msg')?.remove();
    }, { once: true });
    if (!focusedFirst) { el.focus(); focusedFirst = true; }
  });
}

export function clearFieldErrors(containerEl) {
  if (!containerEl) return;
  containerEl.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  containerEl.querySelectorAll('.field-error-msg').forEach(el => el.remove());
}

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

  function close() {
    overlay.querySelector('.modal')?.classList.add('closing');
    overlay.classList.add('closing');
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 300);
  }

  const bodyEl = overlay.querySelector('.modal-body');

  overlay.querySelector('#modal-close-btn').onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  actions.forEach((a, i) => {
    overlay.querySelector(`#modal-action-${i}`).onclick = () => {
      if (a.action) a.action(close, bodyEl);
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
        <input class="form-control" id="pl-name" data-field="name" placeholder="${t('pl_name_ph')}" autofocus>
      </div>
      <div class="form-group">
        <label>${t('pl_desc_label')}</label>
        <input class="form-control" id="pl-desc" data-field="description" placeholder="${t('pl_desc_ph')}">
      </div>`,
    actions: [
      { label: t('cancel'), class: 'btn-secondary', action: (close) => close() },
      {
        label: t('create'), class: 'btn-primary',
        action: async (close, formEl) => {
          clearFieldErrors(formEl);
          const name = document.getElementById('pl-name').value.trim();
          if (!name) { document.getElementById('pl-name').focus(); return; }
          const desc = document.getElementById('pl-desc').value.trim();
          try {
            if (onCreated) await onCreated({ name, description: desc });
            close();
          } catch (err) {
            markFieldErrors(err.fields, formEl);
            showToast(err.message || 'Error al crear playlist', 'error');
          }
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

// ── Profile edit modal ────────────────────────────────────────────────────────

/**
 * Opens a popup where the user can update their avatar, name, nickname,
 * and WhatsApp number. Changes are persisted via API.auth.updateProfile
 * and reflected immediately in the store + sidebar avatar.
 */
export function openProfileModal() {
  const s          = store.state.settings   || {};
  const loggedUser = store.state.loggedUser || {};
  const DEFAULT_AV = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='%23333'/><circle cx='32' cy='24' r='12' fill='%23666'/><ellipse cx='32' cy='56' rx='20' ry='14' fill='%23666'/></svg>`;

  const { close } = openModal({
    title: '👤 Editar perfil',
    content: `
      <div style="display:flex;flex-direction:column;gap:18px">

        <!-- Avatar row -->
        <div style="display:flex;align-items:center;gap:16px">
          <div style="position:relative;flex-shrink:0">
            <img id="pm-avatar-preview" src="${s.avatar || DEFAULT_AV}"
                 style="width:72px;height:72px;border-radius:50%;object-fit:cover;
                        border:2px solid var(--border-strong)">
            <label style="position:absolute;bottom:0;right:0;width:24px;height:24px;
                          border-radius:50%;background:var(--red);display:flex;
                          align-items:center;justify-content:center;cursor:pointer;
                          font-size:12px;border:2px solid var(--bg-2)"
                   title="Cambiar foto">
              📷
              <input type="file" id="pm-avatar-input" accept="image/*" style="display:none">
            </label>
          </div>
          <div style="font-size:12px;color:var(--text-muted);line-height:1.6">
            <strong style="color:var(--text-primary)">${_safeStr(loggedUser.username || '')}</strong><br>
            Haz clic en el ícono de cámara para cambiar tu foto de perfil.
          </div>
        </div>

        <!-- Fields -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group" style="margin:0">
            <label style="font-size:12px;color:var(--text-muted)">Nombre completo</label>
            <input class="form-control" id="pm-fullname" data-field="full_name"
                   value="${_safeStr(s.full_name)}" placeholder="John Doe" style="margin-top:4px">
          </div>
          <div class="form-group" style="margin:0">
            <label style="font-size:12px;color:var(--text-muted)">Apodo / Nickname</label>
            <input class="form-control" id="pm-nickname" data-field="nickname"
                   value="${_safeStr(s.nickname)}" placeholder="@username" style="margin-top:4px">
          </div>
        </div>
        <div class="form-group" style="margin:0">
          <label style="font-size:12px;color:var(--text-muted)">WhatsApp</label>
          <input class="form-control" id="pm-whatsapp" data-field="whatsapp"
                 value="${_safeStr(s.whatsapp)}" placeholder="+1 555 000 0000" style="margin-top:4px">
        </div>

        <div id="pm-msg" style="font-size:12px;color:var(--green);display:none;margin-top:-6px">
          ✅ Perfil guardado correctamente
        </div>
      </div>`,

    actions: [
      { label: 'Cancelar', class: 'btn-secondary', action: (c) => c() },
      {
        label: '💾 Guardar',
        class: 'btn-primary',
        action: async (c, bodyEl) => {
          const full_name = bodyEl.querySelector('#pm-fullname').value.trim();
          const nickname  = bodyEl.querySelector('#pm-nickname').value.trim();
          const whatsapp  = bodyEl.querySelector('#pm-whatsapp').value.trim();
          const avatar    = store.state.settings?.avatar || s.avatar || '';

          try {
            if (loggedUser?.username) {
              await API.auth.updateProfile({ username: loggedUser.username, full_name, nickname, whatsapp, avatar });
            }
            const updated = { ...store.state.settings, full_name, nickname, whatsapp };
            store.setState({ settings: updated });
            const msgEl = bodyEl.querySelector('#pm-msg');
            if (msgEl) { msgEl.style.display = 'block'; }
            setTimeout(c, 1000);
          } catch (err) {
            showToast(`Error al guardar: ${err.message}`, 'error');
          }
        },
      },
    ],
  });

  // Wire avatar upload after modal is mounted
  requestAnimationFrame(() => {
    const input   = document.getElementById('pm-avatar-input');
    const preview = document.getElementById('pm-avatar-preview');
    if (!input || !preview) return;

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        // Crop to square at 128×128
        const img  = new Image();
        img.onload = () => {
          const canvas   = document.createElement('canvas');
          canvas.width   = canvas.height = 128;
          const ctx      = canvas.getContext('2d');
          const size     = Math.min(img.width, img.height);
          const sx       = (img.width  - size) / 2;
          const sy       = (img.height - size) / 2;
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
          const dataUrl  = canvas.toDataURL('image/jpeg', 0.85);
          preview.src    = dataUrl;
          // Persist avatar immediately so it's used when "Guardar" is clicked
          const updated  = { ...store.state.settings, avatar: dataUrl };
          store.setState({ settings: updated });
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
      input.value = '';
    });
  });
}

/** HTML-encode a value for safe use in attribute values. */
function _safeStr(v) {
  return v ? String(v).replace(/"/g, '&quot;').replace(/</g, '&lt;') : '';
}
