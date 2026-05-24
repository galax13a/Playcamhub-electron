/**
 * Albums View — Spotify-style album grid with hover effects and context menu.
 */
import API from '../../../../src/renderer/utils/api.js';
import store from '../../../../src/renderer/store.js';
import { viewHeader } from '../../../../src/renderer/components/ui.js';
import { showToast, openModal } from '../../../../src/renderer/components/Modal.js';
import { esc } from '../../../../src/renderer/utils/html.js';

const PALETTE = [
  'linear-gradient(135deg,#1DB954 0%,#0d7a38 100%)',
  'linear-gradient(135deg,#E91E63 0%,#880E4F 100%)',
  'linear-gradient(135deg,#FF6B35 0%,#c74a1a 100%)',
  'linear-gradient(135deg,#6C63FF 0%,#3d35cc 100%)',
  'linear-gradient(135deg,#00BCD4 0%,#006064 100%)',
  'linear-gradient(135deg,#FF9800 0%,#e65100 100%)',
  'linear-gradient(135deg,#9C27B0 0%,#4A148C 100%)',
  'linear-gradient(135deg,#F44336 0%,#B71C1C 100%)',
  'linear-gradient(135deg,#2196F3 0%,#0D47A1 100%)',
  'linear-gradient(135deg,#4CAF50 0%,#1B5E20 100%)',
];

export async function renderAlbums(el) {
  el.innerHTML = '';

  el.insertAdjacentHTML('beforeend', viewHeader(
    '📁 Albums',
    `<button id="new-album-btn" style="
      background:var(--red,#1DB954);color:#fff;border:none;cursor:pointer;
      border-radius:20px;padding:7px 18px;font-size:13px;font-weight:600;
      letter-spacing:.5px;transition:opacity .15s;
    " onmouseover="this.style.opacity='.82'" onmouseout="this.style.opacity='1'">＋ New Album</button>`,
  ));

  const grid = document.createElement('div');
  grid.style.cssText = `
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(175px,1fr));
    gap:22px;padding:8px 0 48px;
  `;
  el.appendChild(grid);

  async function load() {
    try {
      const albums = await API.albums.list();
      grid.innerHTML = '';
      if (!albums.length) {
        grid.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:72px 0;color:var(--text-muted)">
            <div style="font-size:52px;margin-bottom:14px">🎞️</div>
            <div style="font-size:15px;font-weight:600;margin-bottom:6px">No albums yet</div>
            <div style="font-size:12px">Create your first album to organize your photos</div>
          </div>`;
        return;
      }
      albums.forEach((a, i) => grid.appendChild(createCard(a, i, load)));
    } catch (err) {
      showToast('Error loading albums: ' + err.message, 'error');
    }
  }

  el.querySelector('#new-album-btn')?.addEventListener('click', () => {
    openModal({
      title: 'New Album',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div>
            <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                          margin-bottom:6px;color:var(--text-muted)">NAME</label>
            <input type="text" class="form-control" id="alb-name"
                   placeholder="My Album" style="width:100%">
          </div>
          <div>
            <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                          margin-bottom:6px;color:var(--text-muted)">DESCRIPTION</label>
            <textarea class="form-control" id="alb-desc" placeholder="Optional…"
                      style="width:100%;height:68px;resize:none"></textarea>
          </div>
        </div>`,
      buttons: [
        { label: 'Cancel', action: 'cancel' },
        { label: 'Create', action: 'create', primary: true },
      ],
      onClose: async (action) => {
        if (action !== 'create') return;
        const name = document.getElementById('alb-name')?.value.trim();
        const desc = document.getElementById('alb-desc')?.value.trim();
        if (!name) { showToast('Album name required', 'error'); return; }
        try {
          await API.albums.create({ name, description: desc });
          showToast('✅ Album created');
          load();
        } catch (err) {
          showToast('Error: ' + err.message, 'error');
        }
      },
    });
  });

  await load();
}

function createCard(album, idx, reload) {
  const card  = document.createElement('div');
  const bg    = PALETTE[idx % PALETTE.length];
  const cover = API.albumCoverUrl(album.id);

  card.style.cssText = `
    position:relative;border-radius:10px;overflow:hidden;cursor:pointer;
    background:var(--bg-3);
    transition:transform .22s cubic-bezier(.25,.8,.25,1),
               box-shadow .22s cubic-bezier(.25,.8,.25,1);
    will-change:transform;
  `;

  card.innerHTML = `
    <div style="
      width:100%;aspect-ratio:1;
      background:${bg};
      position:relative;overflow:hidden;
    ">
      <img src="${esc(cover)}" alt=""
           style="width:100%;height:100%;object-fit:cover;
                  position:absolute;inset:0;display:block">

      <!-- shimmer overlay on hover -->
      <div class="alb-shimmer" style="
        position:absolute;inset:0;pointer-events:none;
        background:linear-gradient(135deg,rgba(255,255,255,.12) 0%,transparent 60%);
        opacity:0;transition:opacity .22s;
      "></div>

      <!-- play button -->
      <div class="alb-play" style="
        position:absolute;bottom:10px;right:10px;
        width:44px;height:44px;border-radius:50%;
        background:#1DB954;
        display:flex;align-items:center;justify-content:center;
        font-size:18px;color:#fff;
        box-shadow:0 6px 20px rgba(0,0,0,.45);
        opacity:0;transform:translateY(8px);
        transition:opacity .2s,transform .2s;
      ">▶</div>
    </div>

    <!-- info -->
    <div style="padding:12px 12px 14px">
      <div style="
        font-size:14px;font-weight:700;
        color:var(--text-primary);
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        margin-bottom:3px;
      " class="alb-name">${esc(album.name)}</div>
      <div style="font-size:12px;color:var(--text-muted)">
        ${album.mediaCount ?? 0} item${(album.mediaCount ?? 0) !== 1 ? 's' : ''}
      </div>
    </div>

    <!-- kebab menu -->
    <button class="alb-kebab" style="
      position:absolute;top:8px;right:8px;
      width:30px;height:30px;border-radius:50%;border:none;
      background:rgba(0,0,0,.58);backdrop-filter:blur(4px);
      color:#fff;font-size:18px;font-weight:700;
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;opacity:0;
      transition:opacity .18s,background .15s;
      line-height:1;padding-bottom:2px;
    " title="Options">⋯</button>
  `;

  const shimmer = card.querySelector('.alb-shimmer');
  const play    = card.querySelector('.alb-play');
  const kebab   = card.querySelector('.alb-kebab');

  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-5px) scale(1.015)';
    card.style.boxShadow = '0 16px 36px rgba(0,0,0,.4)';
    shimmer.style.opacity = '1';
    play.style.opacity    = '1';
    play.style.transform  = 'translateY(0)';
    kebab.style.opacity   = '1';
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform  = '';
    card.style.boxShadow  = '';
    shimmer.style.opacity = '0';
    play.style.opacity    = '0';
    play.style.transform  = 'translateY(8px)';
    kebab.style.opacity   = '0';
  });

  card.addEventListener('click', (e) => {
    if (e.target.closest('.alb-kebab')) return;
    store.navigate('starcho:gallery', { albumId: album.id });
  });

  kebab.addEventListener('click', (e) => {
    e.stopPropagation();
    showContextMenu(kebab, album, card, reload);
  });

  return card;
}

function showContextMenu(btn, album, card, reload) {
  document.querySelectorAll('.alb-ctx').forEach(m => m.remove());

  const menu = document.createElement('div');
  menu.className = 'alb-ctx';
  menu.style.cssText = `
    position:fixed;z-index:9999;
    background:var(--bg-3);
    border:1px solid rgba(255,255,255,.1);
    border-radius:10px;padding:5px;
    box-shadow:0 12px 32px rgba(0,0,0,.5);
    min-width:148px;
    animation:scaleIn .12s ease;
  `;

  const items = [
    { icon: '✏️', label: 'Rename', fn: () => renameAlbum(album, card) },
    { icon: '🗑️', label: 'Delete',  fn: () => deleteAlbum(album, card, reload), danger: true },
  ];

  items.forEach(({ icon, label, fn, danger }) => {
    const row = document.createElement('div');
    row.style.cssText = `
      display:flex;align-items:center;gap:8px;
      padding:9px 12px;border-radius:6px;cursor:pointer;
      font-size:13px;font-weight:500;
      color:${danger ? '#FF5555' : 'var(--text-primary)'};
      transition:background .12s;
    `;
    row.innerHTML = `<span>${icon}</span><span>${label}</span>`;
    row.addEventListener('mouseenter', () => row.style.background = 'var(--bg-2)');
    row.addEventListener('mouseleave', () => row.style.background = '');
    row.addEventListener('click', () => { menu.remove(); fn(); });
    menu.appendChild(row);
  });

  document.body.appendChild(menu);

  const rect = btn.getBoundingClientRect();
  const mw   = 160;
  let left = rect.right - mw;
  let top  = rect.bottom + 6;
  if (left < 8) left = 8;
  if (top + 100 > window.innerHeight) top = rect.top - 100;
  menu.style.left = left + 'px';
  menu.style.top  = top  + 'px';

  const dismiss = (ev) => {
    if (!menu.contains(ev.target)) {
      menu.remove();
      document.removeEventListener('click', dismiss, true);
    }
  };
  setTimeout(() => document.addEventListener('click', dismiss, true), 10);
}

function renameAlbum(album, card) {
  openModal({
    title: 'Rename Album',
    body: `
      <label style="display:block;font-size:11px;font-weight:700;
                    letter-spacing:.8px;margin-bottom:8px;color:var(--text-muted)">NAME</label>
      <input type="text" class="form-control" id="alb-rename"
             value="${esc(album.name)}" style="width:100%">`,
    buttons: [
      { label: 'Cancel', action: 'cancel' },
      { label: 'Save',   action: 'save',   primary: true },
    ],
    onClose: async (action) => {
      if (action !== 'save') return;
      const name = document.getElementById('alb-rename')?.value.trim();
      if (!name) return;
      try {
        await API.albums.update(album.id, { name });
        const nameEl = card.querySelector('.alb-name');
        if (nameEl) nameEl.textContent = name;
        showToast('✅ Renamed');
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    },
  });
}

function deleteAlbum(album, card, reload) {
  openModal({
    title: 'Delete Album',
    body: `
      <p style="color:var(--text-muted);font-size:14px">
        Delete <strong style="color:var(--text-primary)">${esc(album.name)}</strong>?<br>
        <span style="font-size:12px;opacity:.7">Photos inside will not be deleted.</span>
      </p>`,
    buttons: [
      { label: 'Cancel', action: 'cancel' },
      { label: '🗑️ Delete', action: 'del', primary: false },
    ],
    onClose: async (action) => {
      if (action !== 'del') return;
      try {
        await API.albums.delete(album.id);
        card.style.transition = 'opacity .2s,transform .2s';
        card.style.opacity    = '0';
        card.style.transform  = 'scale(.9)';
        setTimeout(() => card.remove(), 200);
        showToast('Album deleted');
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    },
  });
}
