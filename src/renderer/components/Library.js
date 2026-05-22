import store    from '../store.js';
import EventBus from '../utils/eventBus.js';
import API      from '../utils/api.js';
import { formatDuration, sanitizeHTML } from '../utils/formatters.js';
import { openContextMenu, showToast, openModal } from './Modal.js';
import { t } from '../utils/i18n.js';

// ── Home view ──────────────────────────────────────────────────────────────────

let _homeUnsub = null;

export async function renderHome(el) {
  if (_homeUnsub) { _homeUnsub(); _homeUnsub = null; }

  el.innerHTML = `
    <div class="topbar">
      <span class="topbar-title">🎵 PlayRyu</span>
      <span class="topbar-spacer"></span>
    </div>
    <div id="home-content" style="padding:0 0 24px"></div>`;

  const container = el.querySelector('#home-content');

  async function _buildHome() {
    const [recent, favs, mostPlayed, stats] = await Promise.all([
      API.songs.recent(10),
      API.songs.favorites(),
      API.songs.mostPlayed(12),
      API.songs.stats(),
    ]);

    container.innerHTML = `
      <div class="section-heading">
        <h2>${t(`good_${getGreeting()}`)}, ${t('here_your_music')}</h2>
        <p>${stats.total} ${t('songs_in_lib')}</p>
      </div>
      ${mostPlayed.length ? `
        <div style="padding:0 24px 8px">
          <div class="home-section-header">
            <span>🔥 ${t('top_tracks')}</span>
            <span style="font-size:11px;color:var(--text-muted)">${t('most_listened')}</span>
          </div>
          <div class="top-tracks-list" id="top-tracks"></div>
        </div>` : ''}
      ${recent.length ? `
        <div style="padding:0 24px 8px">
          <div class="home-section-header">${t('recently_added')}</div>
          <div class="songs-grid" id="recent-grid"></div>
        </div>` : ''}
      ${favs.length ? `
        <div style="padding:0 24px 8px">
          <div class="home-section-header">${t('favs_section')}</div>
          <div class="songs-grid" id="favs-grid"></div>
        </div>` : ''}
      ${!recent.length ? `
        <div class="empty-state">
          <div class="empty-icon">🎵</div>
          <h3>${t('empty_lib')}</h3>
          <p>${t('empty_lib_sub')}</p>
          <button class="btn btn-primary" id="btn-goto-dl">${t('goto_download')}</button>
        </div>` : ''}`;

    el.querySelector('#btn-goto-dl')?.addEventListener('click', () => store.navigate('download'));

    const topList = el.querySelector('#top-tracks');
    if (topList) _renderTopTracks(topList, mostPlayed);

    const recentGrid = el.querySelector('#recent-grid');
    if (recentGrid) renderCards(recentGrid, recent);

    const favsGrid = el.querySelector('#favs-grid');
    if (favsGrid) renderCards(favsGrid, favs);
  }

  await _buildHome();

  // Refresh home page when songs change (e.g. after favoriting)
  _homeUnsub = EventBus.on('store:songs', () => _buildHome().catch(() => {}));
}

// ── Library view ───────────────────────────────────────────────────────────────

export async function renderLibrary(el) {
  const playlists = store.state.playlists || [];

  el.innerHTML = `
    <div class="topbar">
      <span class="topbar-title">🎵 Librería de Música YouTube</span>
      <span class="topbar-spacer"></span>
      <span style="font-size:11px;color:var(--text-muted)" id="lib-count"></span>
      <button class="btn btn-ghost btn-icon" id="toggle-view" title="Toggle view">⊞</button>
    </div>
    <div class="lib-filter-bar">
      <div class="lib-search-wrap">
        <span class="lib-search-icon">🔍</span>
        <input class="lib-search-input" id="lib-search" placeholder="${t('search_ph')}" autocomplete="off">
      </div>
      <div class="lib-cats" id="lib-cat-bar">
        <button class="cat-chip active" data-filter-type="all" data-filter-id="">
          <span class="cat-chip-icon">✨</span><span>${t('all_cats')}</span>
        </button>
        ${store.state.categories.map(c => `
          <button class="cat-chip" data-filter-type="cat" data-filter-id="${c.id}" style="--chip-color:${c.color}">
            <span class="cat-chip-icon">${c.icon}</span><span>${sanitizeHTML(c.name)}</span>
          </button>`).join('')}
        ${playlists.map(p => `
          <button class="cat-chip" data-filter-type="playlist" data-filter-id="${p.id}">
            <span class="cat-chip-icon">📋</span><span>${sanitizeHTML(p.name)}</span>
          </button>`).join('')}
      </div>
    </div>
    <div id="lib-songs"></div>`;

  let filteredSongs = [...store.state.songs];
  let filterType = 'all'; // 'all' | 'cat' | 'playlist'
  let filterId   = null;
  let isGrid     = true;
  let _playlistSongIds = null; // Set of ids when filtering by playlist

  function redraw() {
    const container = el.querySelector('#lib-songs');
    const count     = el.querySelector('#lib-count');
    count.textContent = `${filteredSongs.length} ${t('songs_count')}`;

    if (!filteredSongs.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>${t('no_songs_found')}</h3>
        </div>`;
      return;
    }

    if (isGrid) {
      container.innerHTML = '<div class="songs-grid" id="songs-render"></div>';
      renderCards(container.querySelector('#songs-render'), filteredSongs);
    } else {
      container.innerHTML = '<div class="song-list" id="songs-render"></div>';
      renderRows(container.querySelector('#songs-render'), filteredSongs);
    }
  }

  async function applyFilter() {
    const q = el.querySelector('#lib-search')?.value.toLowerCase() || '';
    let base = store.state.songs;

    if (filterType === 'playlist' && filterId !== null) {
      if (!_playlistSongIds) {
        try {
          const pSongs = await API.playlists.getSongs(filterId);
          _playlistSongIds = new Set(pSongs.map(s => s.id));
        } catch (_) { _playlistSongIds = new Set(); }
      }
      base = base.filter(s => _playlistSongIds.has(s.id));
    }

    filteredSongs = base.filter(s => {
      const matchQ = !q || s.title.toLowerCase().includes(q) ||
        (s.artist || '').toLowerCase().includes(q) ||
        (s.album  || '').toLowerCase().includes(q);
      const matchC = filterType !== 'cat' || filterId === null || s.category_id === filterId;
      return matchQ && matchC;
    });
    redraw();
  }

  // Search
  el.querySelector('#lib-search').addEventListener('input', () => applyFilter());

  // Filter chips
  el.querySelectorAll('.cat-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      el.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterType = chip.dataset.filterType || 'all';
      filterId   = chip.dataset.filterId ? parseInt(chip.dataset.filterId) : null;
      _playlistSongIds = null;
      await applyFilter();
    });
  });

  // View toggle
  el.querySelector('#toggle-view').addEventListener('click', () => {
    isGrid = !isGrid;
    el.querySelector('#toggle-view').textContent = isGrid ? '⊞' : '≡';
    redraw();
  });

  // React to store changes
  EventBus.on('store:songs', (songs) => {
    filteredSongs = [...songs];
    redraw();
  });

  applyFilter();
}

// ── Top tracks compact list ───────────────────────────────────────────────────

function _renderTopTracks(container, songs) {
  container.innerHTML = songs.map((s, i) => {
    const cover = s.thumbnail
      ? `<img class="tt-thumb" src="${API.thumbnailUrl(s.thumbnail)}" alt="" loading="lazy">`
      : `<div class="tt-thumb tt-thumb-ph">🎵</div>`;
    const maxPlays = songs[0]?.play_count || 1;
    const barPct   = Math.round((s.play_count / maxPlays) * 100);
    return `
      <div class="tt-row" data-id="${s.id}">
        <span class="tt-rank">${i + 1}</span>
        ${cover}
        <div class="tt-info">
          <div class="tt-title">${sanitizeHTML(s.title)}</div>
          <div class="tt-bar-wrap">
            <div class="tt-bar-fill" style="width:${barPct}%"></div>
          </div>
        </div>
        <span class="tt-plays">${s.play_count}</span>
      </div>`;
  }).join('');

  container.querySelectorAll('.tt-row').forEach(row => {
    const id   = parseInt(row.dataset.id);
    const song = songs.find(s => s.id === id);
    row.addEventListener('click', () => store.playSong(song, songs));
  });
}

// ── Shared card renderer ──────────────────────────────────────────────────────

export function renderCards(container, songs) {
  container.innerHTML = songs.map(s => {
    const cover = s.thumbnail
      ? `<img class="card-cover" src="${API.thumbnailUrl(s.thumbnail)}" alt="" loading="lazy">`
      : `<div class="card-cover-placeholder">🎵</div>`;
    const isPlaying = store.state.currentSong?.id === s.id;
    return `
      <div class="song-card ${isPlaying ? 'playing' : ''}" data-id="${s.id}">
        <div style="position:relative">
          ${cover}
          <div class="card-overlay">
            <button class="play-circle">▶</button>
          </div>
          ${s.is_favorite ? '<span style="position:absolute;top:8px;right:8px;font-size:16px">❤</span>' : ''}
        </div>
        <div class="card-info">
          <div class="card-title">${sanitizeHTML(s.title)}</div>
          <div class="card-artist">${sanitizeHTML(s.artist || 'Unknown')}</div>
          ${s.category_name ? `<div style="margin-top:6px"><span class="badge badge-purple">${s.category_icon || ''} ${sanitizeHTML(s.category_name)}</span></div>` : ''}
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.song-card').forEach(card => {
    const id   = parseInt(card.dataset.id);
    const song = songs.find(s => s.id === id);

    card.addEventListener('click',       () => store.playSong(song, songs));
    card.addEventListener('contextmenu', (e) => showSongContextMenu(e, song, songs));
    card.querySelector('.play-circle').addEventListener('click', (e) => {
      e.stopPropagation();
      store.playSong(song, songs);
    });
  });

  // Mark playing card
  EventBus.on('store:currentSong', (s) => {
    container.querySelectorAll('.song-card').forEach(c =>
      c.classList.toggle('playing', parseInt(c.dataset.id) === s?.id)
    );
  });
}

// ── Shared row renderer ───────────────────────────────────────────────────────

export function renderRows(container, songs) {
  container.innerHTML = songs.map((s, i) => {
    const thumb = s.thumbnail
      ? `<img class="row-thumb" src="${API.thumbnailUrl(s.thumbnail)}" alt="" loading="lazy">`
      : `<div class="row-thumb" style="background:var(--gradient-brand);display:flex;align-items:center;justify-content:center;font-size:16px">🎵</div>`;
    const isPlaying = store.state.currentSong?.id === s.id;
    return `
      <div class="song-row ${isPlaying ? 'playing' : ''}" data-id="${s.id}">
        <span class="row-index">${i + 1}</span>
        <span class="row-playing"><div class="waveform">${'<span></span>'.repeat(5)}</div></span>
        ${thumb}
        <div class="row-info">
          <div class="row-title">${sanitizeHTML(s.title)}</div>
          <div class="row-artist">${sanitizeHTML(s.artist || 'Unknown')}</div>
        </div>
        <span class="row-duration">${formatDuration(s.duration)}</span>
        <div class="row-actions">
          <button class="btn-ghost btn-icon" data-action="fav" title="Favorite" style="font-size:16px">${s.is_favorite ? '♥' : '♡'}</button>
          <button class="btn-ghost btn-icon" data-action="more" title="More">⋯</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.song-row').forEach(row => {
    const id   = parseInt(row.dataset.id);
    const song = songs.find(s => s.id === id);

    row.addEventListener('click',       (e) => {
      if (e.target.closest('[data-action]')) return;
      store.playSong(song, songs);
    });
    row.addEventListener('contextmenu', (e) => showSongContextMenu(e, song, songs));

    row.querySelector('[data-action="fav"]')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const updated = await API.songs.toggleFav(id);
      e.currentTarget.textContent = updated.is_favorite ? '♥' : '♡';
      store.loadSongs();
    });

    row.querySelector('[data-action="more"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      showSongContextMenu(e, song, songs);
    });
  });

  EventBus.on('store:currentSong', (s) => {
    container.querySelectorAll('.song-row').forEach(r =>
      r.classList.toggle('playing', parseInt(r.dataset.id) === s?.id)
    );
  });
}

// ── Song context menu ─────────────────────────────────────────────────────────

function showSongContextMenu(e, song, queue) {
  const playlists = store.state.playlists.filter(p => p.id !== 1);

  openContextMenu(e, [
    { icon: '▶', label: 'Play',          action: () => store.playSong(song, queue) },
    { icon: '❤', label: song.is_favorite ? 'Remove from Favorites' : 'Add to Favorites',
      action: async () => { await API.songs.toggleFav(song.id); store.loadSongs(); } },
    'divider',
    ...playlists.map(p => ({
      icon: '🎶',
      label: `Add to ${p.name}`,
      action: async () => {
        await API.playlists.addSong(p.id, song.id);
        showToast(`Added to ${p.name}`, 'success');
      },
    })),
    ...(playlists.length ? ['divider'] : []),
    {
      icon: 'ℹ️', label: t('song_info'),
      action: () => showSongInfoModal(song),
    },
    {
      icon: '✏️', label: 'Edit info',
      action: () => editSongModal(song),
    },
    {
      icon: '🗑', label: 'Delete', danger: true,
      action: async () => {
        await API.songs.delete(song.id);
        await store.loadSongs();
        showToast(`"${song.title}" deleted`, 'info');
      },
    },
  ]);
}

function editSongModal(song) {
  const thumbSrc = song.thumbnail
    ? API.thumbnailUrl(song.thumbnail)
    : `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='%23333'/><text x='32' y='40' font-size='28' text-anchor='middle'>🎵</text></svg>`;

  openModal({
    title: t('edit'),
    content: `
      <div style="display:flex;gap:16px;align-items:flex-start">
        <div style="position:relative;flex-shrink:0">
          <img id="edit-thumb-preview" src="${thumbSrc}" alt=""
               style="width:80px;height:80px;border-radius:var(--radius-md);object-fit:cover;background:var(--bg-3)">
          <label title="Change Photo"
                 style="position:absolute;bottom:3px;right:3px;width:24px;height:24px;
                        border-radius:50%;background:var(--red);display:flex;align-items:center;
                        justify-content:center;cursor:pointer;font-size:12px;border:2px solid var(--bg-2)">
            📷<input type="file" id="edit-thumb-input" accept="image/*" style="display:none">
          </label>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:10px">
          <div class="form-group">
            <label>${t('title')}</label>
            <input class="form-control" id="edit-title" value="${sanitizeHTML(song.title)}">
          </div>
          <div class="form-group">
            <label>${t('artist')}</label>
            <input class="form-control" id="edit-artist" value="${sanitizeHTML(song.artist || '')}">
          </div>
          <div class="form-group">
            <label>${t('category')}</label>
            <select class="form-control" id="edit-cat">
              <option value="">${t('no_category')}</option>
              ${store.state.categories.map(c => `
                <option value="${c.id}" ${song.category_id === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>${t('notes')}</label>
            <textarea class="form-control" id="edit-notes" rows="3"
                      placeholder="${t('notes_ph')}"
                      style="resize:vertical;min-height:64px">${sanitizeHTML(song.notes || '')}</textarea>
          </div>
        </div>
      </div>`,
    actions: [
      { label: t('cancel'), class: 'btn-secondary', action: (close) => close() },
      {
        label: t('save'), class: 'btn-primary',
        action: async (close) => {
          const thumbInput = document.getElementById('edit-thumb-input');
          const thumbFile  = thumbInput?.files?.[0];

          const data = {
            title:       document.getElementById('edit-title').value.trim(),
            artist:      document.getElementById('edit-artist').value.trim(),
            category_id: document.getElementById('edit-cat').value || null,
            notes:       document.getElementById('edit-notes').value.trim(),
          };
          close();

          if (thumbFile && thumbFile.path) {
            await API.songs.changeThumbnail(song.id, thumbFile.path);
          }
          await API.songs.update(song.id, data);
          await store.loadSongs();
          showToast(t('saved'), 'success');
        },
      },
    ],
  });

  setTimeout(() => {
    document.getElementById('edit-thumb-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      document.getElementById('edit-thumb-preview').src = url;
    });
  }, 100);
}

function showSongInfoModal(song) {
  const thumbSrc = song.thumbnail
    ? API.thumbnailUrl(song.thumbnail)
    : `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='%23333'/><text x='32' y='40' font-size='28' text-anchor='middle'>🎵</text></svg>`;

  const catHtml = song.category_name
    ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 10px;
                    border-radius:var(--radius-full);background:${song.category_color}22;
                    border:1px solid ${song.category_color}44;color:${song.category_color};
                    font-size:12px;font-weight:600">
         ${song.category_icon || ''} ${sanitizeHTML(song.category_name)}
       </span>`
    : `<span style="color:var(--text-muted);font-size:13px">—</span>`;

  const ytHtml = song.youtube_url
    ? `<div style="display:flex;align-items:center;gap:8px;margin-top:4px">
         <code style="flex:1;font-size:11px;color:var(--text-muted);word-break:break-all;
                      background:var(--bg-3);padding:6px 10px;border-radius:var(--radius-sm)">
           ${sanitizeHTML(song.youtube_url)}
         </code>
         <button id="copy-yt-btn" class="btn btn-secondary btn-sm" style="flex-shrink:0">${t('copy_link')}</button>
       </div>`
    : `<span style="color:var(--text-muted);font-size:13px">—</span>`;

  openModal({
    title: t('song_info'),
    content: `
      <div style="display:flex;gap:16px">
        <img src="${thumbSrc}" alt="" style="width:100px;height:100px;border-radius:var(--radius-md);
             object-fit:cover;background:var(--bg-3);flex-shrink:0">
        <div style="flex:1;display:flex;flex-direction:column;gap:6px;min-width:0">
          <div style="font-size:16px;font-weight:700;color:var(--text)">${sanitizeHTML(song.title)}</div>
          <div style="font-size:13px;color:var(--text-secondary)">${sanitizeHTML(song.artist || '—')}</div>
          <div style="font-size:12px;color:var(--text-muted)">${sanitizeHTML(song.album || '—')}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
            ${catHtml}
            <span style="font-size:12px;color:var(--text-muted)">${formatDuration(song.duration)}</span>
            <span style="font-size:12px;color:var(--text-muted)">${song.play_count || 0} ${t('plays')}</span>
          </div>
        </div>
      </div>
      ${song.notes ? `
        <div style="margin-top:14px">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                      letter-spacing:.06em;margin-bottom:6px">${t('notes')}</div>
          <div style="font-size:13px;color:var(--text-secondary);background:var(--bg-3);
                      border-radius:var(--radius-md);padding:10px 12px;white-space:pre-wrap;
                      line-height:1.6">${sanitizeHTML(song.notes)}</div>
        </div>` : ''}
      <div style="margin-top:14px">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;
                    letter-spacing:.06em;margin-bottom:6px">Fuente</div>
        ${ytHtml}
      </div>`,
    actions: [
      { label: t('cancel'), class: 'btn-secondary', action: (c) => c() },
    ],
  });

  setTimeout(() => {
    document.getElementById('copy-yt-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(song.youtube_url).then(() => showToast(t('copied'), 'success'));
    });
  }, 100);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
