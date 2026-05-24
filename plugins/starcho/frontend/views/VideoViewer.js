/**
 * Video Viewer — Play videos with controls, info panel, and inline edit.
 */
import API from '../../../../src/renderer/utils/api.js';
import store from '../../../../src/renderer/store.js';
import { viewHeader } from '../../../../src/renderer/components/ui.js';
import { openModal, showToast } from '../../../../src/renderer/components/Modal.js';
import { esc } from '../../../../src/renderer/utils/html.js';

export async function renderVideoViewer(el, extra) {
  const mediaId = extra?.id;

  if (!mediaId) {
    el.innerHTML = '<p style="color:var(--text-muted);padding:40px">Sin video seleccionado</p>';
    return;
  }

  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Cargando…</div>';

  let media;
  try {
    media = await API.media.get(mediaId);
  } catch (err) {
    el.innerHTML = `
      <div style="text-align:center;padding:64px 0">
        <div style="font-size:48px;margin-bottom:12px">⚠️</div>
        <p style="color:#FF3366">${esc(err.message)}</p>
        <button class="btn btn-sm btn-secondary" id="err-back" style="margin-top:12px">← Galería</button>
      </div>`;
    el.querySelector('#err-back')?.addEventListener('click', () => store.navigate('starcho:gallery'));
    return;
  }

  el.innerHTML = '';
  el.insertAdjacentHTML('beforeend', viewHeader(
    `🎬 ${esc(media.title || media.file_name)}`,
    `<button class="btn btn-sm btn-secondary" id="back-btn">← Galería</button>
     <button class="btn btn-sm btn-secondary" id="feed-btn">📹 Feed</button>
     <button class="btn btn-sm btn-primary"   id="edit-info-btn">✏️ Editar info</button>`,
  ));
  el.querySelector('#back-btn')?.addEventListener('click', () => store.navigate('starcho:gallery'));
  el.querySelector('#feed-btn')?.addEventListener('click', () => store.navigate('starcho:video-feed'));

  // Video player
  const playerWrap = document.createElement('div');
  playerWrap.style.cssText = `
    background:#000;border-radius:12px;margin-top:20px;
    display:flex;align-items:center;justify-content:center;
    min-height:400px;position:relative;overflow:hidden;
  `;
  const video = document.createElement('video');
  video.src      = API.mediaViewUrl(mediaId);
  video.controls = true;
  video.autoplay = false;
  video.style.cssText = 'width:100%;max-height:72vh;border-radius:12px;display:block;';
  playerWrap.appendChild(video);
  el.appendChild(playerWrap);

  // Info panel
  const infoPanel = document.createElement('div');
  infoPanel.id = 'vv-info';
  infoPanel.style.cssText = `
    background:var(--bg-3);border-radius:12px;
    padding:20px;margin-top:16px;
    display:grid;grid-template-columns:1fr 1fr;gap:16px;
  `;
  _renderInfo(infoPanel, media);
  el.appendChild(infoPanel);

  // Edit info button
  el.querySelector('#edit-info-btn')?.addEventListener('click', () => {
    openEditModal(media, (updated) => {
      Object.assign(media, updated);
      // Update header title
      const hTitle = el.querySelector('h1, [data-view-title]');
      if (hTitle) hTitle.textContent = `🎬 ${media.title || media.file_name}`;
      _renderInfo(infoPanel, media);
      showToast('✅ Info actualizada');
    });
  });
}

function _renderInfo(panel, media) {
  panel.innerHTML = `
    ${_infoRow('Nombre de archivo', esc(media.file_name))}
    ${_infoRow('Título', esc(media.title || '—'))}
    ${_infoRow('Duración', _fmtDuration(media.duration))}
    ${_infoRow('Tamaño', _fmtBytes(media.file_size))}
    ${_infoRow('Reproducciones', media.view_count || 0)}
    ${_infoRow('Likes', media.likes || 0)}
    ${media.description
      ? `<div style="grid-column:1/-1">
           ${_infoRow('Descripción', esc(media.description))}
         </div>`
      : ''}
  `;
}

function openEditModal(media, onSaved) {
  openModal({
    title: '✏️ Editar información del video',
    body: `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                        margin-bottom:6px;color:var(--text-muted)">NOMBRE DE ARCHIVO</label>
          <input type="text" class="form-control" id="vv-filename"
                 value="${esc(media.file_name || '')}"
                 placeholder="nombre_del_archivo.mp4" style="width:100%">
        </div>
        <div>
          <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                        margin-bottom:6px;color:var(--text-muted)">TÍTULO</label>
          <input type="text" class="form-control" id="vv-title"
                 value="${esc(media.title || '')}"
                 placeholder="Título del video" style="width:100%">
        </div>
        <div>
          <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                        margin-bottom:6px;color:var(--text-muted)">DESCRIPCIÓN</label>
          <textarea class="form-control" id="vv-desc" rows="3"
                    placeholder="Descripción del video…"
                    style="width:100%;resize:vertical">${esc(media.description || '')}</textarea>
        </div>
      </div>`,
    buttons: [
      { label: 'Cancelar', action: 'cancel' },
      { label: '💾 Guardar', action: 'save', primary: true },
    ],
    onClose: async (action) => {
      if (action !== 'save') return;
      const newFileName = document.getElementById('vv-filename')?.value.trim() || media.file_name;
      const newTitle    = document.getElementById('vv-title')?.value.trim()    || '';
      const newDesc     = document.getElementById('vv-desc')?.value.trim()     || '';

      const updates = {};
      let hasErrors = false;

      try {
        // Rename file_name if changed
        if (newFileName && newFileName !== media.file_name) {
          await API.media.rename(media.id, newFileName);
          updates.file_name = newFileName;
        }
        // Update meta
        await API.media.updateMeta(media.id, { title: newTitle, description: newDesc });
        updates.title       = newTitle;
        updates.description = newDesc;
      } catch (err) {
        showToast('Error guardando: ' + err.message, 'error');
        hasErrors = true;
      }

      if (!hasErrors && onSaved) onSaved(updates);
    },
  });
}

function _infoRow(label, value) {
  return `
    <div>
      <div style="font-size:11px;color:var(--text-muted);font-weight:700;letter-spacing:.7px;
                  text-transform:uppercase">${label}</div>
      <div style="font-size:14px;font-weight:600;margin-top:4px;color:var(--text-primary);
                  overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${value}</div>
    </div>`;
}

function _fmtDuration(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function _fmtBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
