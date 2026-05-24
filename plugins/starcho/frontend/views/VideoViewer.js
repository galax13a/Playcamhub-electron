/**
 * Video Viewer — Play videos with controls and info panel.
 */
import API from '../../../../src/renderer/utils/api.js';
import store from '../../../../src/renderer/store.js';
import { viewHeader } from '../../../../src/renderer/components/ui.js';
import { esc } from '../../../../src/renderer/utils/html.js';

export async function renderVideoViewer(el, extra) {
  const container = el;
  const mediaId = extra?.id;

  if (!mediaId) {
    container.innerHTML = '<p style="color:var(--text-muted)">No video selected</p>';
    return;
  }

  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Loading…</div>';

  try {
    const media = await API.media.get(mediaId);

    container.innerHTML = '';
    container.insertAdjacentHTML('beforeend', viewHeader(
      `🎬 ${esc(media.file_name)}`,
      `<button class="btn btn-sm btn-secondary" id="back-btn">← Gallery</button>`,
    ));
    container.querySelector('#back-btn')?.addEventListener('click', () => store.navigate('starcho:gallery'));

    const playerContainer = document.createElement('div');
    playerContainer.style.cssText = `
      background:#000;border-radius:var(--radius-md);margin-top:20px;
      display:flex;align-items:center;justify-content:center;
      min-height:400px;position:relative;overflow:hidden;
    `;

    const video = document.createElement('video');
    video.src      = API.mediaViewUrl(mediaId);
    video.controls = true;
    video.style.cssText = 'width:100%;max-height:70vh;border-radius:var(--radius-md)';
    playerContainer.appendChild(video);
    container.appendChild(playerContainer);

    // Info panel
    const infoPanel = document.createElement('div');
    infoPanel.style.cssText = `
      background:var(--bg-3);border-radius:var(--radius-md);
      padding:16px;margin-top:20px;
      display:grid;grid-template-columns:1fr 1fr;gap:16px;
    `;

    infoPanel.innerHTML = `
      ${_infoRow('Filename', esc(media.file_name))}
      ${_infoRow('Duration', _fmtDuration(media.duration))}
      ${_infoRow('File Size', _fmtBytes(media.file_size))}
      ${_infoRow('Views', media.view_count || 0)}
    `;

    container.appendChild(infoPanel);

  } catch (err) {
    container.innerHTML = `
      <div style="text-align:center;padding:64px 0">
        <div style="font-size:48px;margin-bottom:12px">⚠️</div>
        <p style="color:#FF3366">${esc(err.message)}</p>
        <button class="btn btn-sm btn-secondary" style="margin-top:12px"
                onclick="import('../../../../src/renderer/store.js').then(m=>m.default.navigate('starcho:gallery'))">
          ← Back
        </button>
      </div>`;
  }
}

function _infoRow(label, value) {
  return `
    <div>
      <div style="font-size:11px;color:var(--text-muted);font-weight:700;letter-spacing:.7px">${label.toUpperCase()}</div>
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
