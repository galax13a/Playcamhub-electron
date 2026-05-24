/**
 * Gallery View — Display all photos and videos with pagination.
 * Supports optional albumId filter (navigated from Albums view).
 */
import API from '../../../../src/renderer/utils/api.js';
import store from '../../../../src/renderer/store.js';
import { viewHeader } from '../../../../src/renderer/components/ui.js';
import { openModal, showToast } from '../../../../src/renderer/components/Modal.js';
import { esc } from '../../../../src/renderer/utils/html.js';

const PER_PAGE = 20;

export async function renderGallery(el, extra = {}) {
  const albumId = extra?.albumId || null;
  el.innerHTML = '';

  // Header: if albumId, show album name with back button
  let albumName = '';
  if (albumId) {
    try {
      const album = await API.albums.get(albumId);
      albumName = album.name || '';
    } catch (_) {}
    el.insertAdjacentHTML('beforeend', viewHeader(
      `📁 ${esc(albumName) || 'Album'}`,
      `<button class="btn btn-sm btn-secondary" id="back-albums-btn">← Albums</button>`,
    ));
    el.querySelector('#back-albums-btn')?.addEventListener('click', () => store.navigate('starcho:albums'));
  } else {
    el.insertAdjacentHTML('beforeend', viewHeader('🖼️ Gallery'));
  }

  el.insertAdjacentHTML('beforeend', `
    <div style="display:flex;gap:10px;align-items:center;margin:12px 0;flex-wrap:wrap">
      <input name="search" type="text" class="form-control"
             placeholder="Search media…" style="flex:1;min-width:160px;max-width:280px">
      <select name="filter" class="form-control" style="width:auto">
        <option value="all">All</option>
        <option value="photo">Photos</option>
        <option value="video">Videos</option>
      </select>
    </div>`);

  const gridEl = document.createElement('div');
  gridEl.id = 'media-grid';
  gridEl.style.cssText = `
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(200px,1fr));
    gap:12px;margin-top:16px;
  `;
  el.appendChild(gridEl);

  const loaderEl = document.createElement('div');
  loaderEl.style.cssText = 'text-align:center;padding:20px;color:var(--text-muted);display:none';
  loaderEl.textContent = 'Loading…';
  el.appendChild(loaderEl);

  const pagerEl = document.createElement('div');
  pagerEl.style.cssText = 'display:flex;gap:8px;justify-content:center;padding:16px 0;flex-wrap:wrap';
  el.appendChild(pagerEl);

  let page   = 1;
  let total  = 0;
  let filter = 'all';
  let search = '';

  async function load() {
    loaderEl.style.display = 'block';
    gridEl.innerHTML       = '';
    pagerEl.innerHTML      = '';

    try {
      const params = { page, perPage: PER_PAGE };
      if (filter !== 'all') params.type = filter;
      if (search) params.search = search;
      if (albumId) params.albumId = albumId;

      const res = await API.media.list(params);
      total = res.total || 0;

      if (!res.items || res.items.length === 0) {
        gridEl.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:64px 0;color:var(--text-muted)">
            <div style="font-size:48px;margin-bottom:12px">🖼️</div>
            <div style="font-size:15px;font-weight:600">No media found</div>
            ${albumId ? '<div style="font-size:12px;margin-top:6px">Upload photos to this album from the Upload view</div>' : ''}
          </div>`;
      } else {
        res.items.forEach(m => gridEl.appendChild(createCard(m)));
      }

      // Pagination
      const totalPages = Math.ceil(total / PER_PAGE);
      if (totalPages > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn btn-sm btn-secondary';
        prevBtn.textContent = '← Prev';
        prevBtn.disabled = page <= 1;
        prevBtn.addEventListener('click', () => { page--; load(); });

        const info = document.createElement('span');
        info.style.cssText = 'line-height:28px;font-size:13px;color:var(--text-muted)';
        info.textContent = `Page ${page} / ${totalPages}  (${total} items)`;

        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-sm btn-secondary';
        nextBtn.textContent = 'Next →';
        nextBtn.disabled = page >= totalPages;
        nextBtn.addEventListener('click', () => { page++; load(); });

        pagerEl.append(prevBtn, info, nextBtn);
      }
    } catch (err) {
      showToast('Failed to load media: ' + err.message, 'error');
      gridEl.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#FF3366">Error loading media</p>';
    } finally {
      loaderEl.style.display = 'none';
    }
  }

  el.querySelector('[name="search"]').addEventListener('input', e => {
    search = e.target.value;
    page   = 1;
    load();
  });

  el.querySelector('[name="filter"]').addEventListener('change', e => {
    filter = e.target.value;
    page   = 1;
    load();
  });

  await load();

  function createCard(media) {
    const card    = document.createElement('div');
    const isVideo = media.media_type === 'video';
    const thumb   = media.thumbnail_path ? API.mediaThumbUrl(media.id) : null;

    card.style.cssText = `
      background:var(--bg-3);border-radius:var(--radius-md);
      overflow:hidden;cursor:pointer;
      transition:transform .2s,box-shadow .2s;position:relative;
    `;

    card.innerHTML = `
      <div style="width:100%;aspect-ratio:1;background:var(--bg-2);position:relative;overflow:hidden">
        ${thumb
          ? `<img src="${esc(thumb)}" alt="${esc(media.file_name)}"
                  style="width:100%;height:100%;object-fit:cover;display:block"
                  onerror="this.style.display='none'">`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px">
               ${isVideo ? '🎬' : '🖼️'}
             </div>`}
        ${isVideo ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:32px;pointer-events:none">▶️</div>' : ''}
        ${media.is_favorite ? '<div style="position:absolute;top:4px;right:4px;font-size:18px">⭐</div>' : ''}
      </div>
      <div style="padding:8px;font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${esc(media.file_name)}
      </div>`;

    card.addEventListener('mouseover', () => {
      card.style.transform = 'scale(1.02)';
      card.style.boxShadow = '0 4px 12px rgba(0,0,0,.15)';
    });
    card.addEventListener('mouseout', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
    });
    card.addEventListener('click', () => {
      store.navigate(isVideo ? 'starcho:video-viewer' : 'starcho:photo-editor', { id: media.id });
    });
    card.addEventListener('contextmenu', e => {
      e.preventDefault();
      showContextMenu(media, card);
    });

    return card;
  }

  function showContextMenu(media, cardEl) {
    openModal({
      title: 'Options',
      body: `
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-sm btn-secondary" data-action="edit" style="width:100%;text-align:left">
            ✏️ Edit / View
          </button>
          <button class="btn btn-sm btn-secondary" data-action="favorite" style="width:100%;text-align:left">
            ${media.is_favorite ? '☆ Remove from Favorites' : '⭐ Add to Favorites'}
          </button>
          <button class="btn btn-sm btn-secondary" data-action="delete" style="width:100%;text-align:left;color:#FF5555">
            🗑️ Delete
          </button>
        </div>`,
      onClose: async (action) => {
        if (action === 'edit') {
          store.navigate(media.media_type === 'video' ? 'starcho:video-viewer' : 'starcho:photo-editor', { id: media.id });
        } else if (action === 'favorite') {
          try {
            const updated = await API.media.favorite(media.id);
            media.is_favorite = updated.isFavorite ? 1 : 0;
            showToast(media.is_favorite ? '⭐ Added to favorites' : '☆ Removed from favorites');
            load();
          } catch (err) {
            showToast('Error: ' + err.message, 'error');
          }
        } else if (action === 'delete') {
          if (confirm('Delete this media permanently?')) {
            try {
              await API.media.delete(media.id);
              showToast('✅ Deleted');
              cardEl.remove();
            } catch (err) {
              showToast('Error: ' + err.message, 'error');
            }
          }
        }
      }
    });
  }
}
