/**
 * Upload View — Separate drop zones for photos (JPG/PNG/WEBP) and videos.
 * Photos are always converted to WEBP on the server.
 */
import { getBase } from '../../../../src/renderer/utils/api.js';
import { viewHeader } from '../../../../src/renderer/components/ui.js';
import { showToast } from '../../../../src/renderer/components/Modal.js';
import { esc } from '../../../../src/renderer/utils/html.js';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp';
const VIDEO_ACCEPT = '.mp4,.webm,.mov,.avi';

export async function renderUpload(el) {
  el.innerHTML = '';
  el.insertAdjacentHTML('beforeend', viewHeader('📤 Upload Media'));

  el.insertAdjacentHTML('beforeend', `
    <p style="color:var(--text-muted);font-size:13px;margin:2px 0 20px">
      Photos are automatically optimized and saved as WEBP. Max 500 MB per file.
    </p>`);

  // ── Zone grid ──────────────────────────────────────────────────────────────
  const zonesRow = document.createElement('div');
  zonesRow.style.cssText = `
    display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;
  `;
  el.appendChild(zonesRow);

  const photoInput = _makeInput(PHOTO_ACCEPT, true);
  const videoInput = _makeInput(VIDEO_ACCEPT, true);
  el.appendChild(photoInput);
  el.appendChild(videoInput);

  const photoZone = _makeZone({
    icon: '🖼️',
    title: 'Drop photos here',
    tags: ['JPG', 'PNG', 'WEBP'],
    accent: '#1DB954',
    badge: 'PHOTO',
  });
  const videoZone = _makeZone({
    icon: '🎬',
    title: 'Drop videos here',
    tags: ['MP4', 'WebM', 'MOV', 'AVI'],
    accent: '#E91E63',
    badge: 'VIDEO',
  });
  zonesRow.appendChild(photoZone);
  zonesRow.appendChild(videoZone);

  // ── Progress list ──────────────────────────────────────────────────────────
  const progressList = document.createElement('div');
  progressList.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
  el.appendChild(progressList);

  _wireZone(photoZone, photoInput, PHOTO_TYPES, '#1DB954', progressList);
  _wireZone(videoZone, videoInput, VIDEO_TYPES, '#E91E63', progressList);
}

// ── Zone builder ───────────────────────────────────────────────────────────────
function _makeZone({ icon, title, tags, accent, badge }) {
  const zone = document.createElement('div');
  zone.dataset.accent = accent;
  zone.dataset.badge  = badge;
  zone.style.cssText = `
    border:2px dashed var(--text-muted);border-radius:14px;
    padding:36px 20px;text-align:center;cursor:pointer;
    transition:border-color .2s,background .2s,transform .15s;
    background:var(--bg-2);user-select:none;position:relative;overflow:hidden;
  `;

  zone.innerHTML = `
    <div style="
      position:absolute;top:0;left:0;right:0;height:3px;
      background:${accent};opacity:0;transition:opacity .2s;
    " class="zone-bar"></div>
    <div style="font-size:44px;margin-bottom:10px;line-height:1">${icon}</div>
    <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:8px">
      ${title}
    </div>
    <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
      ${tags.map(t => `
        <span style="
          font-size:10px;font-weight:700;letter-spacing:.8px;
          padding:3px 8px;border-radius:20px;
          background:${accent}22;color:${accent};
          border:1px solid ${accent}44;
        ">${t}</span>
      `).join('')}
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:12px">
      or click to select files
    </div>
  `;
  return zone;
}

function _makeInput(accept, multiple) {
  const inp = document.createElement('input');
  inp.type     = 'file';
  inp.accept   = accept;
  inp.multiple = multiple;
  inp.style.display = 'none';
  return inp;
}

function _wireZone(zone, input, allowedTypes, accent, progressList) {
  const bar = zone.querySelector('.zone-bar');

  zone.addEventListener('click', () => input.click());

  input.addEventListener('change', e => {
    const files = Array.from(e.target.files || []).filter(f => allowedTypes.includes(f.type));
    if (!files.length) { showToast('No valid files selected', 'error'); return; }
    _handleFiles(files, accent, progressList);
    input.value = '';
  });

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.style.borderColor = accent;
    zone.style.background  = 'var(--bg-3)';
    zone.style.transform   = 'scale(1.015)';
    if (bar) bar.style.opacity = '1';
  });

  zone.addEventListener('dragleave', e => {
    if (zone.contains(e.relatedTarget)) return;
    _resetZone(zone, bar);
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    _resetZone(zone, bar);
    const files = Array.from(e.dataTransfer.files).filter(f => allowedTypes.includes(f.type));
    if (!files.length) {
      showToast(`Only ${zone.dataset.badge} files are accepted here`, 'error');
      return;
    }
    _handleFiles(files, accent, progressList);
  });
}

function _resetZone(zone, bar) {
  zone.style.borderColor = 'var(--text-muted)';
  zone.style.background  = 'var(--bg-2)';
  zone.style.transform   = '';
  if (bar) bar.style.opacity = '0';
}

async function _handleFiles(files, accent, progressList) {
  for (const file of files) {
    await _uploadOne(file, accent, progressList);
  }
}

async function _uploadOne(file, accent, progressList) {
  const isPhoto = file.type.startsWith('image/');

  const row = document.createElement('div');
  row.style.cssText = `
    background:var(--bg-3);border-radius:10px;padding:12px 14px;
    display:grid;grid-template-rows:auto auto;gap:8px;
    animation:slideInUp .18s ease;
  `;
  row.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">${isPhoto ? '🖼️' : '🎬'}</span>
      <div style="flex:1;min-width:0">
        <div style="
          font-size:13px;font-weight:600;color:var(--text-primary);
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        ">${esc(file.name)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${_fmtSize(file.size)}</div>
      </div>
      <span class="up-badge" style="
        font-size:10px;font-weight:700;letter-spacing:.6px;
        padding:3px 8px;border-radius:20px;
        background:${accent}22;color:${accent};flex-shrink:0;
      ">${isPhoto ? 'PHOTO' : 'VIDEO'}</span>
      <span class="up-status" style="font-size:12px;color:var(--text-muted);white-space:nowrap">
        0%
      </span>
    </div>
    <div style="width:100%;height:4px;background:var(--bg-2);border-radius:2px;overflow:hidden">
      <div class="up-bar" style="
        width:0%;height:100%;
        background:${accent};
        border-radius:2px;
        transition:width .15s;
      "></div>
    </div>
  `;
  progressList.prepend(row);

  const statusEl = row.querySelector('.up-status');
  const barEl    = row.querySelector('.up-bar');

  try {
    const token = _getToken();
    const base  = getBase();

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${base}/api/media/upload`);
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);

      xhr.upload.addEventListener('progress', e => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        barEl.style.width    = pct + '%';
        statusEl.textContent = pct + '%';
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          let msg = `HTTP ${xhr.status}`;
          try { msg = JSON.parse(xhr.responseText).error || msg; } catch (_) {}
          reject(new Error(msg));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error')));

      const fd = new FormData();
      fd.append('file', file);
      xhr.send(fd);
    });

    barEl.style.width    = '100%';
    barEl.style.background = '#06D6A0';
    statusEl.textContent = isPhoto ? '✅ Done (WEBP)' : '✅ Done';
    statusEl.style.color = '#06D6A0';
  } catch (err) {
    barEl.style.background = '#FF3366';
    barEl.style.width      = '100%';
    statusEl.textContent   = '❌ ' + err.message;
    statusEl.style.color   = '#FF3366';
    showToast('Upload failed: ' + err.message, 'error');
  }
}

function _getToken() {
  if (window.playcamAuthToken) return window.playcamAuthToken;
  try {
    const raw = sessionStorage.getItem('auth_session') || localStorage.getItem('auth_session');
    return JSON.parse(raw || 'null')?.token || null;
  } catch (_) { return null; }
}

function _fmtSize(bytes) {
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
