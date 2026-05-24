/**
 * Favorites View — Display favorited photos and videos
 */
import API from '../../../../src/renderer/utils/api.js';
import store from '../../../../src/renderer/store.js';
import { viewHeader } from '../../../../src/renderer/components/ui.js';
import { showToast } from '../../../../src/renderer/components/Modal.js';
import { esc } from '../../../../src/renderer/utils/html.js';

export async function renderFavorites(el) {
  el.innerHTML = '';
  el.insertAdjacentHTML('beforeend', viewHeader('⭐ Favorites'));

  const gridEl = document.createElement('div');
  gridEl.style.cssText = `
    display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));
    gap:12px;margin-top:16px;
  `;
  el.appendChild(gridEl);

  const loaderEl = document.createElement('div');
  loaderEl.style.cssText = 'text-align:center;padding:20px;color:var(--text-muted)';
  loaderEl.textContent = 'Loading…';
  el.appendChild(loaderEl);

  try {
    const res = await API.media.list({ favorite: 'true', perPage: 100 });
    loaderEl.remove();
    const items = res.items || [];

    if (!items.length) {
      gridEl.innerHTML = `
        <p style="grid-column:1/-1;text-align:center;color:var(--text-muted)">
          No favorites yet — add some from the Gallery!
        </p>`;
      return;
    }

    items.forEach(m => gridEl.appendChild(createCard(m)));
  } catch (err) {
    loaderEl.textContent = '❌ Error: ' + err.message;
    showToast('Error loading favorites: ' + err.message, 'error');
  }
}

function createCard(media) {
  const card    = document.createElement('div');
  const isVideo = media.media_type === 'video';

  card.style.cssText = `
    background:var(--bg-3);border-radius:var(--radius-md);
    overflow:hidden;cursor:pointer;
    transition:transform .2s,box-shadow .2s;position:relative;
  `;

  const thumb = media.thumbnail_path ? API.mediaThumbUrl(media.id) : null;

  card.innerHTML = `
    <div style="width:100%;aspect-ratio:1;background:var(--bg-2);position:relative;overflow:hidden">
      ${thumb
        ? `<img src="${esc(thumb)}" alt="${esc(media.file_name)}" data-err="bg"
                style="width:100%;height:100%;object-fit:cover">`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;
                       justify-content:center;font-size:48px">${isVideo ? '🎬' : '🖼️'}</div>`}
      ${isVideo ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:32px;pointer-events:none">▶️</div>' : ''}
      <div style="position:absolute;top:4px;right:4px;font-size:18px">⭐</div>
    </div>
    <div style="padding:8px;font-size:12px;color:var(--text-muted);
                overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
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
  card.addEventListener('click', () =>
    store.navigate(isVideo ? 'starcho:video-viewer' : 'starcho:photo-editor', { id: media.id })
  );

  return card;
}
