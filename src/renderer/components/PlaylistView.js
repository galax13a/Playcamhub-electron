import store    from '../store.js';
import API      from '../utils/api.js';
import { sanitizeHTML, formatDuration } from '../utils/formatters.js';
import { showToast, openModal } from './Modal.js';
import { renderRows } from './Library.js';
import { t } from '../utils/i18n.js';

export async function renderPlaylistView(el, { currentPlaylistId } = {}) {
  const id = currentPlaylistId ?? store.state.currentPlaylistId;
  if (!id) { el.innerHTML = ''; return; }

  const [pl, songs] = await Promise.all([
    API.playlists.get(id),
    API.playlists.getSongs(id),
  ]);

  const isFav = id === 1;

  el.innerHTML = `
    <!-- Hero header -->
    <div style="position:relative;padding:32px 24px 24px;background:var(--gradient-brand-vert);
                background-size:cover;overflow:hidden">
      <div style="position:absolute;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(2px)"></div>
      <div style="position:relative;display:flex;align-items:flex-end;gap:24px">
        <div style="width:120px;height:120px;border-radius:var(--radius-lg);
                    background:var(--gradient-brand);display:flex;align-items:center;
                    justify-content:center;font-size:52px;flex-shrink:0;
                    box-shadow:var(--shadow-lg)">
          ${isFav ? '❤️' : '🎶'}
        </div>
        <div>
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;
                      letter-spacing:.8px;color:rgba(255,255,255,.7);margin-bottom:6px">${t('playlist_label')}</div>
          <h1 style="font-size:32px;font-weight:900;margin-bottom:6px">${sanitizeHTML(pl.name)}</h1>
          ${pl.description ? `<p style="color:rgba(255,255,255,.7);font-size:14px">${sanitizeHTML(pl.description)}</p>` : ''}
          <p style="color:rgba(255,255,255,.55);font-size:13px;margin-top:6px">${songs.length} ${t('songs_count')}</p>
        </div>
      </div>
    </div>

    <!-- Controls bar -->
    <div style="display:flex;align-items:center;gap:12px;padding:16px 24px">
      <button class="btn btn-primary" id="btn-play-all">▶ ${t('play_all')}</button>
      <button class="btn btn-secondary" id="btn-shuffle-play">⇄ ${t('shuffle_play')}</button>
      ${!isFav ? `
        <button class="btn btn-secondary" id="btn-add-songs" style="margin-left:auto">
          ＋ ${t('add_songs')}
        </button>
        <button class="btn btn-ghost btn-icon" id="btn-edit-pl" title="Edit playlist">✏️</button>` : ''}
    </div>

    <!-- Song list -->
    <div id="pl-songs"></div>`;

  const plSongsEl = el.querySelector('#pl-songs');

  function _renderSongs(list) {
    if (list.length) {
      renderRows(plSongsEl, list);
    } else {
      plSongsEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎵</div>
          <h3>${t('playlist_empty')}</h3>
          <p>${t('playlist_empty_sub')}</p>
          ${!isFav ? `<button class="btn btn-primary" id="btn-empty-add">${t('add_songs')}</button>` : ''}
        </div>`;
      plSongsEl.querySelector('#btn-empty-add')?.addEventListener('click', () => openAddSongsModal());
    }
  }

  _renderSongs(songs);

  function openAddSongsModal() {
    const libSongs    = store.state.songs;
    const plSongIds   = new Set(songs.map(s => s.id));
    const available   = libSongs.filter(s => !plSongIds.has(s.id));

    if (!available.length) {
      showToast(t('all_in_pl'), 'info');
      return;
    }

    openModal({
      title: `${t('add_songs')} — ${pl.name}`,
      content: `
        <div style="margin-bottom:10px">
          <input class="form-control" id="add-songs-search" placeholder="${t('search_ph')}" autocomplete="off">
        </div>
        <div id="add-songs-list" style="max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">
          ${available.map(s => `
            <label class="add-song-row" data-id="${s.id}">
              <input type="checkbox" value="${s.id}" style="flex-shrink:0">
              <div class="add-song-info">
                <div class="add-song-title">${sanitizeHTML(s.title)}</div>
                <div class="add-song-artist">${sanitizeHTML(s.artist || 'Unknown')} · ${formatDuration(s.duration)}</div>
              </div>
            </label>`).join('')}
        </div>
        <div style="margin-top:10px;font-size:12px;color:var(--text-muted)" id="add-songs-count">
          0 ${t('n_selected')}
        </div>`,
      actions: [
        { label: t('cancel'), class: 'btn-secondary', action: (c) => c() },
        {
          label: t('add'), class: 'btn-primary',
          action: async (c) => {
            const checked = [...document.querySelectorAll('#add-songs-list input:checked')];
            if (!checked.length) return;
            c();
            for (const cb of checked) {
              await API.playlists.addSong(id, parseInt(cb.value));
            }
            await store.loadPlaylists();
            showToast(`${checked.length} ${t('n_songs_added')}`, 'success');
            renderPlaylistView(el, { currentPlaylistId: id });
          },
        },
      ],
    });

    // Search filter inside modal
    setTimeout(() => {
      const searchEl = document.getElementById('add-songs-search');
      const listEl   = document.getElementById('add-songs-list');
      const countEl  = document.getElementById('add-songs-count');
      if (!searchEl) return;

      const updateCount = () => {
        const n = listEl.querySelectorAll('input:checked').length;
        countEl.textContent = `${n} ${t('n_selected')}`;
      };

      searchEl.addEventListener('input', () => {
        const q = searchEl.value.toLowerCase();
        listEl.querySelectorAll('.add-song-row').forEach(row => {
          const matches = row.textContent.toLowerCase().includes(q);
          row.style.display = matches ? '' : 'none';
        });
      });

      listEl.addEventListener('change', updateCount);
    }, 100);
  }

  el.querySelector('#btn-add-songs')?.addEventListener('click', () => openAddSongsModal());

  el.querySelector('#btn-play-all')?.addEventListener('click', () => {
    if (!songs.length) return;
    store.playSong(songs[0], songs);
  });

  el.querySelector('#btn-shuffle-play')?.addEventListener('click', () => {
    if (!songs.length) return;
    const shuffled = [...songs].sort(() => Math.random() - .5);
    store.setState({ shuffle: true });
    store.playSong(shuffled[0], shuffled);
  });

  el.querySelector('#btn-edit-pl')?.addEventListener('click', () => {
    openModal({
      title: `${t('edit')} Playlist`,
      content: `
        <div class="form-group">
          <label>${t('pl_name_label')}</label>
          <input class="form-control" id="edit-pl-name" value="${sanitizeHTML(pl.name)}">
        </div>
        <div class="form-group">
          <label>${t('pl_desc_label')}</label>
          <input class="form-control" id="edit-pl-desc" value="${sanitizeHTML(pl.description || '')}">
        </div>`,
      actions: [
        { label: `${t('delete')} Playlist`, class: 'btn btn-secondary', action: (close) => {
          close();
          openModal({
            title: `${t('delete')} Playlist`,
            content: `<p style="color:var(--text-secondary)">Are you sure you want to delete <strong>${sanitizeHTML(pl.name)}</strong>? This cannot be undone.</p>`,
            actions: [
              { label: t('cancel'), class: 'btn-secondary', action: (c) => c() },
              { label: t('delete'), class: 'btn-primary', action: async (c) => {
                c();
                await API.playlists.delete(id);
                await store.loadPlaylists();
                store.navigate('home');
                showToast(t('deleted'), 'info');
              }},
            ],
          });
        }},
        { label: t('save'), class: 'btn-primary', action: async (close) => {
          const name = document.getElementById('edit-pl-name').value.trim();
          const desc = document.getElementById('edit-pl-desc').value.trim();
          close();
          await API.playlists.update(id, { name, description: desc });
          await store.loadPlaylists();
          renderPlaylistView(el, { currentPlaylistId: id });
          showToast(t('saved'), 'success');
        }},
      ],
    });
  });
}
