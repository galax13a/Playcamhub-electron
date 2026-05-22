'use strict';
import store    from '../store.js';
import API      from '../utils/api.js';
import { sanitizeHTML } from '../utils/formatters.js';
import { showToast } from './Modal.js';

const ACCEPTED_EXTS = '.mp3,.m4a,.flac,.ogg,.wav,.aac,.wma,.opus,.mp4,.webm,.mkv,.mov,.avi,.m4v';

export function renderUpload(el) {
  el.innerHTML = `
    <div class="topbar">
      <span class="topbar-title">Importar Archivos</span>
    </div>
    <div style="padding:24px">
      <div class="upload-drop-zone" id="upload-drop-zone">
        <div class="upload-drop-icon">📂</div>
        <div class="upload-drop-title">Arrastra archivos aquí</div>
        <div class="upload-drop-sub">MP3, FLAC, WAV, OGG, M4A y más</div>
        <label class="btn btn-primary upload-browse-btn">
          Seleccionar archivos
          <input type="file" id="file-input" multiple accept="${ACCEPTED_EXTS}" style="display:none">
        </label>
      </div>
      <div id="upload-results" style="margin-top:16px"></div>
    </div>`;

  const dropZone  = el.querySelector('#upload-drop-zone');
  const fileInput = el.querySelector('#file-input');
  const resultsEl = el.querySelector('#upload-results');

  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files);
    fileInput.value = '';
    _uploadFiles(files, resultsEl);
  });

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragging');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragging');
    _uploadFiles(Array.from(e.dataTransfer.files), resultsEl);
  });
}

async function _uploadFiles(files, resultsEl) {
  if (!files.length) return;

  const paths = files.map(f => f.path).filter(Boolean);
  if (!paths.length) {
    showToast('No se pudieron leer las rutas de los archivos', 'error');
    return;
  }

  resultsEl.innerHTML = `
    <div class="upload-pending-list">
      ${paths.map(p => `
        <div class="upload-result-row pending" data-path="${sanitizeHTML(p)}">
          <div class="upload-result-icon">⏳</div>
          <div class="upload-result-name">${sanitizeHTML(_basename(p))}</div>
          <div class="upload-result-status">Importando...</div>
        </div>`).join('')}
    </div>`;

  try {
    const results = await API.upload.files(paths);
    let added = 0;

    resultsEl.querySelectorAll('.upload-result-row').forEach((row, i) => {
      const r = results[i];
      if (r && r.ok) {
        row.classList.replace('pending', 'success');
        row.querySelector('.upload-result-icon').textContent   = '✅';
        row.querySelector('.upload-result-status').textContent = r.song.title;
        added++;
      } else {
        row.classList.replace('pending', 'failed');
        row.querySelector('.upload-result-icon').textContent   = '❌';
        row.querySelector('.upload-result-status').textContent = r?.error || 'Error al importar';
      }
    });

    if (added > 0) {
      showToast(`${added} archivo(s) agregado(s)`, 'success');
      store.loadSongs().catch(() => {});
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

function _basename(p) {
  return p.split(/[\\/]/).pop() || p;
}
