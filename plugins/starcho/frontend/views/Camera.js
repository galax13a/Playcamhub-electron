/**
 * Camera — Live camera preview with photo capture and video recording.
 *
 * Features:
 *  - Live preview via getUserMedia with camera + microphone selectors
 *  - Landscape / Portrait orientation toggle
 *  - Photo mode: timer countdown, CSS filters, canvas capture → upload JPEG
 *  - Video mode: MediaRecorder, pause/resume (timer continues), stop → upload
 *  - Six live filters applied via CSS on <video>
 *  - Focus/Blur slider (CSS contrast + blur applied to preview and capture)
 *  - Timed recording: auto-stop after N seconds
 *  - XHR upload with progress bar to /api/media/upload
 *  - Keyboard shortcuts: Space = capture/toggle rec | P = pause/resume | Esc = cancel
 *  - MutationObserver cleanup stops all tracks when view is unmounted
 */

import { viewHeader }         from '../../../../src/renderer/components/ui.js';
import { showToast }          from '../../../../src/renderer/components/Modal.js';
import { esc }                from '../../../../src/renderer/utils/html.js';
import { getBase }            from '../../../../src/renderer/utils/api.js';
import store                  from '../../../../src/renderer/store.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTERS = [
  { label: 'Normal',  css: '' },
  { label: 'B&N',     css: 'grayscale(100%)' },
  { label: 'Sepia',   css: 'sepia(100%)' },
  { label: 'Vívido',  css: 'saturate(1.9) contrast(1.1)' },
  { label: 'Frío',    css: 'hue-rotate(195deg) saturate(0.9)' },
  { label: 'Cálido',  css: 'hue-rotate(-18deg) saturate(1.4) brightness(1.08)' },
];

const TIMERS = [
  { label: 'Sin timer', value: 0 },
  { label: '3s',        value: 3 },
  { label: '5s',        value: 5 },
  { label: '10s',       value: 10 },
];

// ── Styles ────────────────────────────────────────────────────────────────────

function _injectStyles() {
  if (document.getElementById('cam-view-styles')) return;
  const s = document.createElement('style');
  s.id = 'cam-view-styles';
  s.textContent = `
    @keyframes cam-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
      50%       { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
    }
    @keyframes cam-countdown-pop {
      0%   { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
      20%  { opacity: 1; }
      80%  { transform: translate(-50%, -50%) scale(1);   opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
    }
    @keyframes cam-flash { 0% { opacity:0; } 10% { opacity:.85; } 100% { opacity:0; } }
    @keyframes cam-fav-burst {
      0%   { transform:translate(-50%,-50%) scale(1); opacity:1; }
      100% { transform:translate(-50%,-50%) scale(3.5); opacity:0; }
    }

    .cam-mode-btn {
      padding: 8px 20px; border-radius: 20px; border: none; cursor: pointer;
      font-size: 13px; font-weight: 700; transition: background .15s, color .15s, transform .1s;
    }
    .cam-mode-btn:hover { transform: translateY(-1px); }
    .cam-mode-btn.btn-primary  { background: var(--accent); color: #fff; }
    .cam-mode-btn.btn-secondary {
      background: var(--bg-3); color: var(--text-muted);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .cam-mode-btn.btn-secondary:hover { color: var(--text-primary); }

    .cam-filter-btn {
      padding: 5px 13px; border-radius: 16px;
      border: 1.5px solid transparent; cursor: pointer;
      font-size: 12px; font-weight: 600;
      background: var(--bg-3); color: var(--text-muted);
      transition: border-color .15s, color .15s, background .15s;
    }
    .cam-filter-btn.active { border-color: var(--accent); color: var(--accent); background: var(--bg-2); }
    .cam-filter-btn:hover:not(.active) { color: var(--text-primary); }

    .cam-timer-btn {
      padding: 5px 12px; border-radius: 14px;
      border: 1.5px solid transparent; cursor: pointer;
      font-size: 11px; font-weight: 700;
      background: var(--bg-3); color: var(--text-muted);
      transition: border-color .15s, color .15s;
    }
    .cam-timer-btn.active { border-color: var(--accent); color: var(--accent); }

    #cam-capture-btn {
      width: 72px; height: 72px; border-radius: 50%;
      border: 4px solid var(--accent); background: transparent;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-size: 26px; transition: transform .12s, background .12s; flex-shrink: 0;
    }
    #cam-capture-btn:hover:not(:disabled) { background: var(--accent); transform: scale(1.08); }
    #cam-capture-btn:disabled { opacity: .45; cursor: not-allowed; }

    #cam-record-btn {
      padding: 12px 28px; border-radius: 28px; border: none; cursor: pointer;
      font-size: 14px; font-weight: 700; background: var(--accent); color: #fff;
      transition: background .15s, transform .1s; letter-spacing: .3px;
    }
    #cam-record-btn:hover:not(:disabled) { transform: scale(1.04); }
    #cam-record-btn:disabled { opacity: .45; cursor: not-allowed; }
    #cam-record-btn.recording { background: #ef4444; animation: cam-pulse 1.5s ease infinite; }
    #cam-record-btn.paused    { background: #f59e0b; }

    #cam-stop-btn {
      padding: 12px 24px; border-radius: 28px;
      border: 2px solid #ef4444; background: transparent; color: #ef4444;
      cursor: pointer; font-size: 13px; font-weight: 700;
      transition: background .15s, color .15s, transform .1s;
    }
    #cam-stop-btn:hover { background: #ef4444; color: #fff; transform: scale(1.03); }

    .cam-section-label {
      font-size: 10px; font-weight: 700; letter-spacing: .8px;
      text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;
    }
    .cam-kbd {
      display:inline-block;padding:1px 6px;border-radius:4px;
      background:var(--bg-3);border:1px solid rgba(255,255,255,.15);
      font-size:10px;font-family:monospace;color:var(--text-muted);
    }

    #cam-progress-wrap { margin-top: 16px; display: none; flex-direction: column; gap: 4px; }
    #cam-progress-wrap.visible { display: flex; }
    #cam-progress-wrap progress {
      width: 100%; height: 6px; border-radius: 3px;
      appearance: none; -webkit-appearance: none; background: var(--bg-3); overflow: hidden;
    }
    #cam-progress-wrap progress::-webkit-progress-bar  { background: var(--bg-3); }
    #cam-progress-wrap progress::-webkit-progress-value { background: var(--accent); transition: width .1s; }
  `;
  document.head.appendChild(s);
}

// ── Token helper ──────────────────────────────────────────────────────────────

function _getToken() {
  if (window.playcamAuthToken) return window.playcamAuthToken;
  try {
    const raw = sessionStorage.getItem('auth_session') || localStorage.getItem('auth_session');
    return JSON.parse(raw || 'null')?.token || null;
  } catch (_) { return null; }
}

// ── XHR upload helper ─────────────────────────────────────────────────────────

function _upload(blob, filename, onProgress) {
  return new Promise((resolve, reject) => {
    const fd    = new FormData();
    fd.append('file', blob, filename);
    const xhr   = new XMLHttpRequest();
    const token = _getToken();
    xhr.open('POST', `${getBase()}/api/media/upload`);
    if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch (_) { resolve({}); }
      } else {
        let msg = `HTTP ${xhr.status}`;
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch (_) {}
        reject(new Error(msg));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.send(fd);
  });
}

// ── Video thumbnail capture ───────────────────────────────────────────────────

async function _captureVideoThumb(videoBlob, mediaId) {
  try {
    const vidEl = document.createElement('video');
    vidEl.muted = true;
    vidEl.src = URL.createObjectURL(videoBlob);
    await new Promise((resolve, reject) => {
      vidEl.addEventListener('loadeddata', resolve, { once: true });
      vidEl.addEventListener('error', reject, { once: true });
      vidEl.load();
    });
    // Seek to 0.5s or midpoint for a better frame
    vidEl.currentTime = Math.min(0.5, vidEl.duration / 4);
    await new Promise(resolve => vidEl.addEventListener('seeked', resolve, { once: true }));

    const canvas = document.createElement('canvas');
    canvas.width  = vidEl.videoWidth  || 640;
    canvas.height = vidEl.videoHeight || 360;
    canvas.getContext('2d').drawImage(vidEl, 0, 0);
    URL.revokeObjectURL(vidEl.src);

    canvas.toBlob(async (pngBlob) => {
      if (!pngBlob) return;
      const fd = new FormData();
      fd.append('thumb', pngBlob, 'thumb.png');
      const token = window.playcamAuthToken
        || (() => { try { return JSON.parse(localStorage.getItem('auth_session') || 'null')?.token; } catch (_) { return null; } })();
      fetch(`${getBase()}/api/media/${mediaId}/video-thumb`, {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: fd,
      }).catch(() => {});
    }, 'image/png');
  } catch (_) {}
}

// ── Main render ───────────────────────────────────────────────────────────────

export async function renderCamera(el, extra = {}) {
  _injectStyles();
  el.innerHTML = '';

  // ── State ────────────────────────────────────────────────────────────────────
  let stream          = null;
  let mode            = 'photo';
  let filterIndex     = 0;
  let focusCss        = '';   // extra CSS filter for focus/blur
  let timerSeconds    = 0;
  let countdownTimer  = null;
  let recorder        = null;
  let recChunks       = [];
  let recState        = 'idle';
  let recDurSecs      = 0;
  let recInterval     = null;
  let recMaxSecs      = 0;    // 0 = unlimited
  let recAutoStopTimer = null;
  let uploading       = false;
  let orientation     = 'landscape'; // 'landscape' | 'portrait'
  let micDeviceId     = null;

  // ── DOM skeleton ──────────────────────────────────────────────────────────────
  el.insertAdjacentHTML('beforeend', viewHeader('📷 Cámara / Grabar'));

  const wrap = document.createElement('div');
  wrap.style.cssText = `
    display: grid; grid-template-columns: 1fr 340px;
    gap: 24px; align-items: start; max-width: 1100px; margin: 0 auto;
  `;
  el.appendChild(wrap);

  // ── Left column ───────────────────────────────────────────────────────────────
  const previewCol = document.createElement('div');
  previewCol.style.cssText = 'display:flex;flex-direction:column;gap:14px;';
  wrap.appendChild(previewCol);

  const previewWrap = document.createElement('div');
  previewWrap.style.cssText = 'position:relative;border-radius:14px;overflow:hidden;background:#000;transition:height .3s;';
  previewCol.appendChild(previewWrap);

  const video = document.createElement('video');
  video.id          = 'cam-preview';
  video.autoplay    = true;
  video.muted       = true;
  video.playsInline = true;
  video.style.cssText = 'width:100%;display:block;border-radius:0;background:#000;min-height:240px;max-height:560px;object-fit:contain;transition:filter .2s;';
  previewWrap.appendChild(video);

  const flashEl = document.createElement('div');
  flashEl.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;';
  previewWrap.appendChild(flashEl);

  const countdownEl = document.createElement('div');
  countdownEl.style.cssText = `
    position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    font-size:96px;font-weight:900;color:#fff;
    text-shadow:0 4px 24px rgba(0,0,0,.7);
    pointer-events:none;display:none;line-height:1;
  `;
  previewWrap.appendChild(countdownEl);

  const recBadge = document.createElement('div');
  recBadge.style.cssText = `
    position:absolute;top:12px;left:12px;
    background:rgba(239,68,68,.9);color:#fff;
    font-size:11px;font-weight:800;letter-spacing:.8px;
    padding:4px 10px;border-radius:20px;display:none;align-items:center;gap:6px;
    backdrop-filter:blur(4px);
  `;
  recBadge.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#fff;display:inline-block;animation:cam-pulse 1.5s ease infinite"></span><span id="cam-rec-dur">00:00</span>`;
  previewWrap.appendChild(recBadge);

  // Camera selector
  const camSelectWrap = document.createElement('div');
  camSelectWrap.style.cssText = 'display:none;flex-direction:column;gap:6px;';
  camSelectWrap.innerHTML = `
    <div class="cam-section-label">Cámara</div>
    <select id="cam-select" class="form-control" style="background:var(--bg-3);color:var(--text-primary);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:7px 10px;font-size:13px;cursor:pointer;"></select>
  `;
  previewCol.appendChild(camSelectWrap);

  // Microphone selector
  const micSelectWrap = document.createElement('div');
  micSelectWrap.style.cssText = 'display:none;flex-direction:column;gap:6px;';
  micSelectWrap.innerHTML = `
    <div class="cam-section-label">Micrófono</div>
    <select id="mic-select" class="form-control" style="background:var(--bg-3);color:var(--text-primary);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:7px 10px;font-size:13px;cursor:pointer;"></select>
  `;
  previewCol.appendChild(micSelectWrap);

  // Filter strip
  const filterWrap = document.createElement('div');
  filterWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
  filterWrap.innerHTML = `<div class="cam-section-label">Filtro visual</div>`;
  const filterRow = document.createElement('div');
  filterRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  FILTERS.forEach((f, i) => {
    const btn = document.createElement('button');
    btn.className = 'cam-filter-btn' + (i === 0 ? ' active' : '');
    btn.textContent = f.label;
    btn.dataset.filterIndex = i;
    btn.addEventListener('click', () => {
      filterIndex = i;
      _applyVideoFilter();
      filterRow.querySelectorAll('.cam-filter-btn').forEach((b, bi) => {
        b.classList.toggle('active', bi === i);
      });
    });
    filterRow.appendChild(btn);
  });
  filterWrap.appendChild(filterRow);
  previewCol.appendChild(filterWrap);

  // Upload progress
  const progressWrap = document.createElement('div');
  progressWrap.id = 'cam-progress-wrap';
  progressWrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:12px;color:var(--text-muted);" id="cam-progress-label">Subiendo…</span>
      <span style="font-size:12px;font-weight:700;color:var(--accent);" id="cam-progress-pct">0%</span>
    </div>
    <progress id="cam-progress-bar" value="0" max="100"></progress>
  `;
  previewCol.appendChild(progressWrap);

  // Keyboard shortcut hint
  const kbdHint = document.createElement('div');
  kbdHint.style.cssText = 'font-size:11px;color:var(--text-muted);line-height:1.8;';
  kbdHint.innerHTML = `
    <span class="cam-kbd">Espacio</span> Capturar / Grabar &nbsp;
    <span class="cam-kbd">P</span> Pausar/Reanudar &nbsp;
    <span class="cam-kbd">Esc</span> Cancelar
  `;
  previewCol.appendChild(kbdHint);

  // ── Right column ──────────────────────────────────────────────────────────────
  const controlCol = document.createElement('div');
  controlCol.style.cssText = `
    display:flex;flex-direction:column;gap:18px;
    background:var(--bg-2);border-radius:16px;padding:20px;
    border:1px solid rgba(255,255,255,0.06);
  `;
  wrap.appendChild(controlCol);

  // Mode toggle
  const modeRow = document.createElement('div');
  modeRow.innerHTML = `<div class="cam-section-label">Modo</div>`;
  const modeBtns = document.createElement('div');
  modeBtns.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
  modeBtns.innerHTML = `
    <button class="cam-mode-btn btn-primary"   id="cam-mode-photo">📷 Foto</button>
    <button class="cam-mode-btn btn-secondary" id="cam-mode-video">🎥 Video</button>
  `;
  modeRow.appendChild(modeBtns);
  controlCol.appendChild(modeRow);

  // Orientation + Focus row
  const orientFocusRow = document.createElement('div');
  orientFocusRow.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
  orientFocusRow.innerHTML = `
    <div class="cam-section-label">Orientación</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button class="cam-mode-btn btn-primary"   id="cam-orient-land">📺 Landscape</button>
      <button class="cam-mode-btn btn-secondary" id="cam-orient-port">📱 Vertical</button>
    </div>
    <div class="cam-section-label" style="margin-top:4px;">Nitidez / Desenfoque</div>
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:11px;color:var(--text-muted);width:80px;flex-shrink:0">Nitidez</span>
      <input type="range" id="cam-focus-slider" min="-10" max="10" step="1" value="0"
             style="flex:1;accent-color:var(--accent)">
      <span style="font-size:11px;color:var(--text-muted);width:28px;text-align:right" id="cam-focus-val">0</span>
    </div>
  `;
  controlCol.appendChild(orientFocusRow);

  const div1 = document.createElement('hr');
  div1.style.cssText = 'border:none;border-top:1px solid rgba(255,255,255,0.07);margin:0;';
  controlCol.appendChild(div1);

  // Photo panel
  const photoPanel = document.createElement('div');
  photoPanel.id = 'cam-photo-panel';
  photoPanel.style.cssText = 'display:flex;flex-direction:column;gap:14px;';
  photoPanel.innerHTML = `
    <div>
      <div class="cam-section-label">Temporizador</div>
      <div id="cam-timer-row" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
      <button id="cam-capture-btn" title="Capturar foto (Espacio)">📸</button>
      <span style="font-size:11px;color:var(--text-muted);">Capturar</span>
    </div>
  `;
  controlCol.appendChild(photoPanel);

  // Video panel
  const videoPanel = document.createElement('div');
  videoPanel.id = 'cam-video-panel';
  videoPanel.style.cssText = 'display:none;flex-direction:column;gap:14px;';
  videoPanel.innerHTML = `
    <div id="cam-rec-clock" style="
      display:none;align-items:center;justify-content:center;gap:10px;
      background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);
      border-radius:12px;padding:10px 16px;
    ">
      <span style="width:10px;height:10px;border-radius:50%;background:#ef4444;flex-shrink:0;animation:cam-pulse 1.5s ease infinite"></span>
      <span id="cam-rec-timer-big" style="font-size:28px;font-weight:900;font-variant-numeric:tabular-nums;color:#ef4444;letter-spacing:2px">00:00</span>
    </div>
    <div>
      <div class="cam-section-label">Inicio de grabación</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">Inicio:</span>
        <select id="cam-vid-countdown" class="form-control" style="font-size:12px;max-width:90px;padding:4px 8px">
          <option value="0">Ya</option>
          <option value="3">3 s</option>
          <option value="5">5 s</option>
          <option value="10">10 s</option>
        </select>
      </div>
    </div>
    <div>
      <div class="cam-section-label">Grabar por (segundos)</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="number" id="cam-max-secs" class="form-control" min="0" max="3600"
               value="0" placeholder="0 = ilimitado" style="width:120px;font-size:13px;">
        <span style="font-size:11px;color:var(--text-muted);">0 = ilimitado</span>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;align-items:center;">
      <div style="display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;">
        <button id="cam-record-btn">⏺ Iniciar grabación</button>
        <button id="cam-stop-btn" style="display:none;">⏹ Detener</button>
      </div>
      <div id="cam-rec-info" style="font-size:12px;color:var(--text-muted);min-height:18px;text-align:center;"></div>
    </div>
  `;
  controlCol.appendChild(videoPanel);

  // Tip
  const tipEl = document.createElement('div');
  tipEl.style.cssText = 'font-size:11px;color:var(--text-muted);line-height:1.6;margin-top:auto;padding-top:4px;';
  tipEl.innerHTML = `💡 Fotos: JPEG alta calidad → WebP. Videos: WebM (VP9).`;
  controlCol.appendChild(tipEl);

  // ── Build timer buttons ───────────────────────────────────────────────────────
  const timerRow = photoPanel.querySelector('#cam-timer-row');
  TIMERS.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'cam-timer-btn' + (t.value === 0 ? ' active' : '');
    btn.textContent = t.label;
    btn.dataset.timerVal = t.value;
    btn.addEventListener('click', () => {
      timerSeconds = t.value;
      timerRow.querySelectorAll('.cam-timer-btn').forEach(b => {
        b.classList.toggle('active', Number(b.dataset.timerVal) === t.value);
      });
    });
    timerRow.appendChild(btn);
  });

  // ── DOM refs ──────────────────────────────────────────────────────────────────
  const modePhotoBtn  = el.querySelector('#cam-mode-photo');
  const modeVideoBtn  = el.querySelector('#cam-mode-video');
  const captureBtn    = el.querySelector('#cam-capture-btn');
  const recordBtn     = el.querySelector('#cam-record-btn');
  const stopBtn       = el.querySelector('#cam-stop-btn');
  const recInfo       = el.querySelector('#cam-rec-info');
  const recDurEl      = el.querySelector('#cam-rec-dur');
  const progressBar   = el.querySelector('#cam-progress-bar');
  const progressPct   = el.querySelector('#cam-progress-pct');
  const progressLabel = el.querySelector('#cam-progress-label');
  const maxSecsInput  = el.querySelector('#cam-max-secs');

  // ── Helper: apply video CSS filter ───────────────────────────────────────────
  function _applyVideoFilter() {
    const f = FILTERS[filterIndex].css;
    video.style.filter = [f, focusCss].filter(Boolean).join(' ') || 'none';
  }

  // ── Focus slider ──────────────────────────────────────────────────────────────
  el.querySelector('#cam-focus-slider').addEventListener('input', e => {
    const v = parseInt(e.target.value);
    el.querySelector('#cam-focus-val').textContent = v;
    if (v > 0) {
      focusCss = `contrast(${1 + v * 0.05}) saturate(${1 + v * 0.03})`;
    } else if (v < 0) {
      focusCss = `blur(${Math.abs(v) * 0.4}px)`;
    } else {
      focusCss = '';
    }
    _applyVideoFilter();
  });

  // ── Orientation ────────────────────────────────────────────────────────────────
  const orientLandBtn = el.querySelector('#cam-orient-land');
  const orientPortBtn = el.querySelector('#cam-orient-port');

  function setOrientation(o) {
    orientation = o;
    orientLandBtn.className = 'cam-mode-btn ' + (o === 'landscape' ? 'btn-primary' : 'btn-secondary');
    orientPortBtn.className = 'cam-mode-btn ' + (o === 'portrait'  ? 'btn-primary' : 'btn-secondary');
    if (o === 'portrait') {
      video.style.maxHeight = '600px';
      video.style.aspectRatio = '9/16';
    } else {
      video.style.aspectRatio = '';
      video.style.maxHeight   = '560px';
    }
    initCamera(null);
  }

  orientLandBtn.addEventListener('click', () => setOrientation('landscape'));
  orientPortBtn.addEventListener('click', () => setOrientation('portrait'));

  // ── Mode switching ────────────────────────────────────────────────────────────
  function setMode(m) {
    if (countdownTimer !== null) { clearTimeout(countdownTimer); countdownTimer = null; countdownEl.style.display = 'none'; }
    mode = m;
    const isPhoto = m === 'photo';
    modePhotoBtn.className = 'cam-mode-btn ' + (isPhoto ? 'btn-primary' : 'btn-secondary');
    modeVideoBtn.className = 'cam-mode-btn ' + (!isPhoto ? 'btn-primary' : 'btn-secondary');
    photoPanel.style.display = isPhoto ? 'flex' : 'none';
    videoPanel.style.display = !isPhoto ? 'flex' : 'none';
  }

  modePhotoBtn.addEventListener('click', () => setMode('photo'));
  modeVideoBtn.addEventListener('click', () => setMode('video'));

  // ── Progress helpers ──────────────────────────────────────────────────────────
  function showProgress(label = 'Subiendo…') {
    progressWrap.classList.add('visible');
    progressLabel.textContent = label;
    progressBar.value = 0;
    progressPct.textContent = '0%';
  }
  function updateProgress(pct) { progressBar.value = pct; progressPct.textContent = pct + '%'; }
  function hideProgress() { progressWrap.classList.remove('visible'); }

  // ── Flash effect ──────────────────────────────────────────────────────────────
  function triggerFlash() {
    flashEl.style.transition = 'none';
    flashEl.style.opacity = '0.85';
    requestAnimationFrame(() => {
      flashEl.style.transition = 'opacity 0.5s ease';
      flashEl.style.opacity = '0';
    });
  }

  // ── Photo capture ─────────────────────────────────────────────────────────────
  async function doCapture() {
    if (!stream || uploading) return;
    const W = video.videoWidth  || 1280;
    const H = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const filterCss = [FILTERS[filterIndex].css, focusCss].filter(Boolean).join(' ');
    if (filterCss) ctx.filter = filterCss;
    ctx.drawImage(video, 0, 0, W, H);
    triggerFlash();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
    if (!blob) { showToast('Error al capturar la imagen', 'error'); return; }
    uploading = true;
    captureBtn.disabled = true;
    showProgress('Subiendo foto…');
    try {
      await _upload(blob, `foto_${Date.now()}.jpg`, pct => updateProgress(pct));
      hideProgress();
      showToast('✅ Foto guardada — abriendo galería');
      store.navigate('starcho:gallery');
    } catch (err) {
      hideProgress();
      showToast('Error al subir la foto: ' + err.message, 'error');
    } finally { uploading = false; captureBtn.disabled = false; }
  }

  captureBtn.addEventListener('click', () => {
    if (!stream || uploading) return;
    if (timerSeconds > 0) {
      captureBtn.disabled = true;
      let remaining = timerSeconds;
      countdownEl.style.display = 'block';
      countdownEl.textContent = remaining;
      function tick() {
        remaining--;
        if (remaining <= 0) {
          countdownEl.style.display = 'none';
          countdownTimer = null;
          captureBtn.disabled = false;
          doCapture();
          return;
        }
        countdownEl.textContent = remaining;
        countdownTimer = setTimeout(tick, 1000);
      }
      countdownTimer = setTimeout(tick, 1000);
    } else {
      doCapture();
    }
  });

  // ── Recording timer ───────────────────────────────────────────────────────────
  function _fmtDur(secs) {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function startRecDurationTimer(resetTimer = true) {
    if (resetTimer) recDurSecs = 0;
    recInterval = setInterval(() => {
      recDurSecs++;
      const fmt = _fmtDur(recDurSecs);
      if (recDurEl) recDurEl.textContent = fmt;
      const bigTimer = el.querySelector('#cam-rec-timer-big');
      if (bigTimer) bigTimer.textContent = fmt;
      if (recInfo) recInfo.textContent = `Grabando… ${fmt}`;
      // Auto-stop
      const maxS = parseInt(maxSecsInput?.value) || 0;
      if (maxS > 0 && recDurSecs >= maxS) {
        stopRecording();
      }
    }, 1000);
  }

  function stopRecDurationTimer() {
    if (recInterval) { clearInterval(recInterval); recInterval = null; }
  }

  function _updateRecordUI() {
    const clock = el.querySelector('#cam-rec-clock');
    if (recState === 'idle') {
      recordBtn.textContent = '⏺ Iniciar grabación';
      recordBtn.className = '';
      recordBtn.id = 'cam-record-btn';
      stopBtn.style.display = 'none';
      recBadge.style.display = 'none';
      recInfo.textContent = '';
      if (clock) clock.style.display = 'none';
    } else if (recState === 'recording') {
      recordBtn.textContent = '⏸ Pausar';
      recordBtn.className = 'recording';
      recordBtn.id = 'cam-record-btn';
      stopBtn.style.display = '';
      recBadge.style.display = 'flex';
      recBadge.style.opacity = '1';
      recInfo.textContent = `Grabando… ${_fmtDur(recDurSecs)}`;
      if (clock) { clock.style.display = 'flex'; clock.style.opacity = '1'; }
    } else if (recState === 'paused') {
      recordBtn.textContent = '▶ Reanudar';
      recordBtn.className = 'paused';
      recordBtn.id = 'cam-record-btn';
      stopBtn.style.display = '';
      recBadge.style.display = 'flex';
      recBadge.style.opacity = '0.5';
      recInfo.textContent = `En pausa — ${_fmtDur(recDurSecs)}`;
      if (clock) { clock.style.display = 'flex'; clock.style.opacity = '0.6'; }
    }
  }

  // ── Stop recording (shared) ───────────────────────────────────────────────────
  function stopRecording() {
    if (recorder && recState !== 'idle') {
      recState = 'idle';
      stopRecDurationTimer();
      if (recAutoStopTimer) { clearTimeout(recAutoStopTimer); recAutoStopTimer = null; }
      recorder.stop();
    }
  }

  // ── Record button ─────────────────────────────────────────────────────────────

  // Extracted start logic so countdown can call it after delay
  function _doStartRecording() {
    recChunks = [];
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
    try { recorder = new MediaRecorder(stream, { mimeType }); }
    catch (_) { recorder = new MediaRecorder(stream); }

    recorder.addEventListener('dataavailable', e => {
      if (e.data && e.data.size > 0) recChunks.push(e.data);
    });

    recorder.addEventListener('stop', async () => {
      stopRecDurationTimer();
      _updateRecordUI();

      // Always use plain video/webm type for upload compatibility
      const videoBlob = new Blob(recChunks, { type: 'video/webm' });
      recChunks = [];

      if (videoBlob.size < 100) { showToast('El video grabado está vacío', 'error'); return; }

      uploading = true;
      recordBtn.disabled = true;
      showProgress('Subiendo video…');
      try {
        const result = await _upload(videoBlob, `video_${Date.now()}.webm`, pct => updateProgress(pct));
        hideProgress();
        showToast('✅ Video guardado — abriendo galería');
        // Capture thumbnail from the recorded video
        if (result && result.id) {
          _captureVideoThumb(videoBlob, result.id);
        }
        store.navigate('starcho:gallery');
      } catch (err) {
        hideProgress();
        showToast('Error al subir el video: ' + err.message, 'error');
      } finally { uploading = false; recordBtn.disabled = false; }
    });

    recorder.start(1000);
    recState = 'recording';
    startRecDurationTimer(true); // reset timer on new recording
    _updateRecordUI();
  }

  recordBtn.addEventListener('click', () => {
    if (!stream) return;

    if (recState === 'idle') {
      const vidCountdownSecs = parseInt(el.querySelector('#cam-vid-countdown')?.value || '0');
      if (vidCountdownSecs > 0) {
        // Show countdown overlay on the preview wrap
        let countVidEl = document.getElementById('cam-vid-countdown-overlay');
        if (!countVidEl) {
          countVidEl = document.createElement('div');
          countVidEl.id = 'cam-vid-countdown-overlay';
          countVidEl.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:72px;font-weight:900;color:#fff;text-shadow:0 4px 24px rgba(0,0,0,.8);pointer-events:none;z-index:10;';
          previewWrap.appendChild(countVidEl);
        }
        recordBtn.disabled = true;
        let remaining = vidCountdownSecs;
        const tick = () => {
          countVidEl.textContent = remaining;
          countVidEl.style.animation = 'none';
          void countVidEl.offsetWidth;
          countVidEl.style.animation = 'cam-countdown-pop .9s ease both';
          if (remaining <= 0) {
            countVidEl.remove();
            recordBtn.disabled = false;
            _doStartRecording();
            return;
          }
          remaining--;
          setTimeout(tick, 1000);
        };
        tick();
      } else {
        _doStartRecording();
      }

    } else if (recState === 'recording') {
      recorder.pause();
      stopRecDurationTimer();
      recState = 'paused';
      _updateRecordUI();

    } else if (recState === 'paused') {
      recorder.resume();
      startRecDurationTimer(false); // continue without resetting
      recState = 'recording';
      _updateRecordUI();
    }
  });

  stopBtn.addEventListener('click', stopRecording);

  // ── Camera initialisation ─────────────────────────────────────────────────────
  async function initCamera(deviceId) {
    if (stream) stream.getTracks().forEach(t => t.stop());

    const videoBase = deviceId ? { deviceId: { exact: deviceId } } : true;
    const vidConstraint = orientation === 'portrait'
      ? { width: { ideal: 1080 }, height: { ideal: 1920 } }
      : { width: { ideal: 1280 }, height: { ideal: 720 } };

    const profiles = [
      {
        video: deviceId
          ? { deviceId: { exact: deviceId }, ...vidConstraint }
          : vidConstraint,
        audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
      },
      { video: videoBase, audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true },
      { video: videoBase, audio: false },
    ];

    let lastErr = null;
    for (const constraints of profiles) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        _applyVideoFilter();
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (err.name === 'NotAllowedError') break;
      }
    }

    if (lastErr) {
      const err = lastErr;
      stream = null;
      const friendly = err.name === 'NotAllowedError'
        ? 'Permiso de cámara denegado. Habilita el acceso en la configuración del sistema.'
        : err.name === 'NotFoundError'
          ? 'No se encontró ninguna cámara conectada.'
          : `No se pudo acceder a la cámara: ${err.message}`;

      previewWrap.innerHTML = `
        <div style="
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          min-height:280px;gap:16px;padding:32px;text-align:center;
          background:var(--bg-3);border-radius:14px;
        ">
          <div style="font-size:52px;">📷</div>
          <div style="font-size:14px;font-weight:600;color:var(--text-primary);">Cámara no disponible</div>
          <div style="font-size:13px;color:var(--text-muted);max-width:320px;line-height:1.6;">${esc(friendly)}</div>
          <button id="cam-retry-btn" class="btn btn-primary" style="margin-top:8px;">🔄 Reintentar</button>
        </div>
      `;
      el.querySelector('#cam-retry-btn')?.addEventListener('click', () => renderCamera(el, extra));
      captureBtn.disabled = true;
      recordBtn.disabled  = true;
      return;
    }

    // Enumerate all input devices
    try {
      const devices  = await navigator.mediaDevices.enumerateDevices();
      const cams     = devices.filter(d => d.kind === 'videoinput');
      const mics     = devices.filter(d => d.kind === 'audioinput');
      const camSel   = camSelectWrap.querySelector('#cam-select');
      const micSel   = micSelectWrap.querySelector('#mic-select');

      if (cams.length > 1) {
        camSelectWrap.style.display = 'flex';
        camSel.innerHTML = cams.map((c, i) =>
          `<option value="${esc(c.deviceId)}" ${deviceId && c.deviceId === deviceId ? 'selected' : ''}>
            ${esc(c.label || `Cámara ${i + 1}`)}</option>`
        ).join('');
        camSel.addEventListener('change', () => initCamera(camSel.value));
      } else {
        camSelectWrap.style.display = 'none';
      }

      if (mics.length > 0) {
        micSelectWrap.style.display = 'flex';
        micSel.innerHTML = `<option value="">Micrófono por defecto</option>` + mics.map((m, i) =>
          `<option value="${esc(m.deviceId)}" ${micDeviceId === m.deviceId ? 'selected' : ''}>
            ${esc(m.label || `Micrófono ${i + 1}`)}</option>`
        ).join('');
        micSel.addEventListener('change', () => { micDeviceId = micSel.value || null; initCamera(camSel?.value || null); });
      }
    } catch (_) {
      camSelectWrap.style.display = 'none';
    }

    captureBtn.disabled = false;
    recordBtn.disabled  = false;
  }

  await initCamera(null);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  function onKey(e) {
    // Ignore when typing in inputs
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (mode === 'photo') {
        captureBtn.click();
      } else {
        if (recState === 'idle' || recState === 'recording' || recState === 'paused') {
          recordBtn.click();
        }
      }
    } else if (e.code === 'KeyP') {
      if (mode === 'video' && (recState === 'recording' || recState === 'paused')) {
        recordBtn.click();
      }
    } else if (e.code === 'Escape') {
      if (countdownTimer !== null) {
        clearTimeout(countdownTimer);
        countdownTimer = null;
        countdownEl.style.display = 'none';
        captureBtn.disabled = false;
      }
    }
  }
  document.addEventListener('keydown', onKey);

  // ── MutationObserver cleanup ──────────────────────────────────────────────────
  const observer = new MutationObserver(() => {
    if (!document.body.contains(el)) {
      observer.disconnect();
      document.removeEventListener('keydown', onKey);
      if (countdownTimer !== null) clearTimeout(countdownTimer);
      stopRecDurationTimer();
      if (recAutoStopTimer) clearTimeout(recAutoStopTimer);
      if (recorder && recState !== 'idle') { try { recorder.stop(); } catch (_) {} }
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
