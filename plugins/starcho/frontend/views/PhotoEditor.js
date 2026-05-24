/**
 * PhotoEditor Pro — Canvas-based advanced image editor.
 * Tabs: Presets | Ajustes | Filtros | Texto | Enfoque
 * All effects rendered on HTML canvas. Save replaces server file. Download exports locally.
 */
import API   from '../../../../src/renderer/utils/api.js';
import store from '../../../../src/renderer/store.js';
import { showToast, openModal } from '../../../../src/renderer/components/Modal.js';
import { esc }       from '../../../../src/renderer/utils/html.js';

// ── Platform presets ──────────────────────────────────────────────────────────
const PLATFORM_PRESETS = {
  '📺 YouTube': [
    { name: 'Thumbnail',    w: 1280, h: 720  },
    { name: 'Banner',       w: 2560, h: 1440 },
    { name: 'Shorts Cover', w: 1080, h: 1920 },
    { name: 'Profile',      w: 800,  h: 800  },
    { name: 'End Screen',   w: 1920, h: 1080 },
  ],
  '📸 Instagram': [
    { name: 'Post ■',       w: 1080, h: 1080 },
    { name: 'Story / Reel', w: 1080, h: 1920 },
    { name: 'Landscape',    w: 1080, h: 566  },
    { name: 'Portrait',     w: 1080, h: 1350 },
    { name: 'Profile',      w: 320,  h: 320  },
  ],
  '🎵 TikTok': [
    { name: 'Video Cover',  w: 1080, h: 1920 },
    { name: 'Profile',      w: 200,  h: 200  },
    { name: 'Ad 9:16',      w: 1080, h: 1920 },
    { name: 'Ad 16:9',      w: 1920, h: 1080 },
  ],
  '🐦 Twitter / X': [
    { name: 'Post',         w: 1600, h: 900  },
    { name: 'Header',       w: 1500, h: 500  },
    { name: 'Profile',      w: 400,  h: 400  },
  ],
  '📘 Facebook': [
    { name: 'Post',         w: 1200, h: 630  },
    { name: 'Cover',        w: 820,  h: 312  },
    { name: 'Profile',      w: 180,  h: 180  },
    { name: 'Story',        w: 1080, h: 1920 },
  ],
  '🖥️ General': [
    { name: 'HD 1080p',     w: 1920, h: 1080 },
    { name: '2K / QHD',     w: 2560, h: 1440 },
    { name: '4K UHD',       w: 3840, h: 2160 },
    { name: 'Square',       w: 1024, h: 1024 },
    { name: 'Wallpaper',    w: 1920, h: 1200 },
  ],
};

// ── Filter presets ────────────────────────────────────────────────────────────
const FILTERS = [
  { id:'normal',   name:'Normal',    css:'',   emoji:'⭕' },
  { id:'bw',       name:'B&N',       css:'grayscale(100%)',  emoji:'◑' },
  { id:'sepia',    name:'Sepia',     css:'sepia(100%) contrast(1.05)', emoji:'🟤' },
  { id:'vintage',  name:'Vintage',   css:'sepia(45%) contrast(0.85) brightness(1.12) saturate(0.8) hue-rotate(8deg)', emoji:'📷' },
  { id:'vivid',    name:'Vívido',    css:'saturate(1.9) contrast(1.12) brightness(1.04)', emoji:'🌈' },
  { id:'cold',     name:'Frío',      css:'hue-rotate(195deg) saturate(0.9) brightness(1.05)', emoji:'❄️' },
  { id:'warm',     name:'Cálido',    css:'hue-rotate(-18deg) saturate(1.45) brightness(1.08)', emoji:'🔥' },
  { id:'fade',     name:'Fade',      css:'contrast(0.75) brightness(1.15) saturate(0.85)', emoji:'🌫️' },
  { id:'chrome',   name:'Chrome',    css:'contrast(1.6) saturate(0.05) brightness(1.08)', emoji:'🪞' },
  { id:'noir',     name:'Noir',      css:'grayscale(100%) contrast(1.65) brightness(0.82)', emoji:'🎬' },
  { id:'dramatic', name:'Dramático', css:'contrast(1.5) brightness(0.8) saturate(1.45)', emoji:'⚡' },
  { id:'lomo',     name:'Lomo',      css:'contrast(1.4) saturate(1.7) brightness(0.86) hue-rotate(6deg)', emoji:'🎞️' },
  { id:'matte',    name:'Matte',     css:'contrast(0.88) brightness(1.08) saturate(0.68)', emoji:'🪨' },
  { id:'golden',   name:'Golden',    css:'sepia(28%) saturate(1.9) hue-rotate(-12deg) brightness(1.12)', emoji:'✨' },
  { id:'cool-blue',name:'Azul',      css:'hue-rotate(210deg) saturate(1.25) brightness(1.06)', emoji:'💙' },
  { id:'punchy',   name:'Punchy',    css:'contrast(1.35) saturate(1.55) brightness(0.93)', emoji:'👊' },
  { id:'cyberpunk',name:'Cyberpunk', css:'hue-rotate(270deg) saturate(2.2) contrast(1.3) brightness(0.9)', emoji:'🌆' },
  { id:'sunset',   name:'Atardecer', css:'sepia(35%) hue-rotate(-25deg) saturate(2.1) brightness(1.1) contrast(1.15)', emoji:'🌅' },
];

// ── Styles ────────────────────────────────────────────────────────────────────
function _injectStyles() {
  if (document.getElementById('pe-pro-styles')) return;
  const s = document.createElement('style');
  s.id = 'pe-pro-styles';
  s.textContent = `
    .pe-tab { padding:7px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
              border:none;background:var(--bg-3);color:var(--text-muted);transition:background .15s,color .15s;
              white-space:nowrap; }
    .pe-tab.active { background:var(--accent);color:#fff; }
    .pe-tab:hover:not(.active) { background:var(--bg-2);color:var(--text-primary); }
    .pe-preset-platform { padding:5px 12px;border-radius:20px;cursor:pointer;font-size:11px;font-weight:700;
                          border:1px solid rgba(255,255,255,.15);background:var(--bg-3);color:var(--text-muted);
                          transition:all .15s;white-space:nowrap; }
    .pe-preset-platform.active,
    .pe-preset-platform:hover { background:var(--accent);color:#fff;border-color:var(--accent); }
    .pe-preset-size { padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;
                      border:1px solid rgba(255,255,255,.12);background:var(--bg-2);color:var(--text-muted);
                      transition:all .15s;text-align:left;width:100%; }
    .pe-preset-size:hover { background:var(--accent);color:#fff;border-color:var(--accent); }
    .pe-preset-size.active { background:var(--accent)22;color:var(--accent);border-color:var(--accent)55; }
    .pe-filter-card { cursor:pointer;border-radius:10px;overflow:hidden;border:2px solid transparent;
                      transition:border-color .15s,transform .15s;display:flex;flex-direction:column; }
    .pe-filter-card:hover { transform:scale(1.04); }
    .pe-filter-card.active { border-color:var(--accent); }
    .pe-filter-thumb { width:100%;aspect-ratio:4/3;object-fit:cover; }
    .pe-slider-row { display:flex;align-items:center;gap:8px;margin-bottom:10px; }
    .pe-slider-row label { font-size:11px;color:var(--text-muted);width:100px;flex-shrink:0; }
    .pe-slider-row input[type=range] { flex:1;accent-color:var(--accent); }
    .pe-slider-row .val { font-size:11px;color:var(--text-muted);width:40px;text-align:right;flex-shrink:0; }
    .pe-text-layer-item { display:flex;align-items:center;gap:8px;padding:6px 10px;
                          border-radius:8px;background:var(--bg-3);cursor:pointer;border:1px solid transparent; }
    .pe-text-layer-item:hover { border-color:rgba(255,255,255,.15); }
    .pe-text-layer-item.selected { border-color:var(--accent); }
    .pe-canvas-wrapper { position:relative;display:inline-block;cursor:crosshair;max-width:100%;line-height:0; }
    .pe-text-handle { position:absolute;cursor:move;user-select:none;pointer-events:auto;
                      padding:2px 6px;border:1px dashed rgba(255,255,255,.5);border-radius:4px;
                      white-space:pre;transform:translate(-50%,-50%); }
    .pe-text-handle.selected { border-color:var(--accent); }
  `;
  document.head.appendChild(s);
}

export async function renderPhotoEditor(el, extra) {
  const mediaId = extra?.id;
  if (!mediaId) { el.innerHTML = '<p style="padding:40px;color:var(--text-muted)">Sin media seleccionada</p>'; return; }
  _injectStyles();

  el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)">Cargando editor…</div>';

  let media;
  try {
    media = await API.media.get(mediaId);
  } catch (err) {
    el.innerHTML = `<p style="color:#FF3366;padding:40px">${esc(err.message)}</p>`;
    return;
  }

  const srcUrl = API.mediaViewUrl(mediaId);
  const origW  = media.width  || 1920;
  const origH  = media.height || 1080;

  // ── Navigation guard ──────────────────────────────────────────────────────
  const _origNavigate = store.navigate.bind(store);

  // ── Editor state ─────────────────────────────────────────────────────────
  // Restore persisted canvas objects if present
  let _savedElements   = [];
  let _savedTextLayers = [];
  if (media.editor_state) {
    try {
      const saved = typeof media.editor_state === 'string'
        ? JSON.parse(media.editor_state)
        : media.editor_state;
      if (saved.elements)   _savedElements   = saved.elements;
      if (saved.textLayers) _savedTextLayers = saved.textLayers;
    } catch (_) {}
  }

  const state = {
    tab:      'presets',
    preset:   { platform: '🖥️ General', name: null, w: origW, h: origH },
    filter:   'normal',
    adj:      { brightness: 1, contrast: 1, saturation: 1, hueRotate: 0, sepia: 0, blur: 0 },
    rotate:   0,
    flipH:    false,
    flipV:    false,
    focus:    { enabled: false, x: 0.5, y: 0.5, radius: 0.27, blur: 12, shape: 'circle' },
    blurBrush: { radius: 40, strength: 14 },
    blurMask:  null,
    blurMaskHasContent: false,
    blurBrushPainting: false,
    crop:     null,
    cropDrag: null,
    textLayers:  _savedTextLayers,
    loadedFonts: [],
    nextId:   1,
    selTextId:null,
    dragging: null,
    cinema:   null,
    bgRemoved: null,
    elements: _savedElements,
    selectedElement: null,
  };

  // ── Undo/Redo ─────────────────────────────────────────────────────────────
  const _undoStack = [];
  const _redoStack = [];
  function _pushUndo() {
    _undoStack.push(JSON.stringify({ elements: state.elements, textLayers: state.textLayers }));
    if (_undoStack.length > 50) _undoStack.shift();
    _redoStack.length = 0;
    _updateUndoButtons();
  }
  function _undo() {
    if (!_undoStack.length) return;
    _redoStack.push(JSON.stringify({ elements: state.elements, textLayers: state.textLayers }));
    const prev = JSON.parse(_undoStack.pop());
    state.elements   = prev.elements   || [];
    state.textLayers = prev.textLayers || [];
    state.selectedElement = null;
    setDirty();
    _refreshElementList();
    _renderElements(elemCanvas, canvas.width, canvas.height);
    if (state.tab === 'text') buildTextPanel();
    _updateUndoButtons();
  }
  function _redo() {
    if (!_redoStack.length) return;
    _undoStack.push(JSON.stringify({ elements: state.elements, textLayers: state.textLayers }));
    const next = JSON.parse(_redoStack.pop());
    state.elements   = next.elements   || [];
    state.textLayers = next.textLayers || [];
    state.selectedElement = null;
    setDirty();
    _refreshElementList();
    _renderElements(elemCanvas, canvas.width, canvas.height);
    if (state.tab === 'text') buildTextPanel();
    _updateUndoButtons();
  }
  function _updateUndoButtons() {
    const undoBtn = document.getElementById('pe-undo');
    const redoBtn = document.getElementById('pe-redo');
    if (undoBtn) undoBtn.disabled = _undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = _redoStack.length === 0;
  }

  let isDirty = false;
  function setDirty() { isDirty = true; }

  // Override store.navigate to warn on unsaved changes
  store.navigate = function(view, extra = {}) {
    if (isDirty) {
      openModal({
        title: '⚠️ Cambios sin guardar',
        body: '<p style="color:var(--text-muted);font-size:14px;line-height:1.6">Tienes cambios sin guardar en el editor.<br><strong style="color:#fff">¿Deseas salir sin guardar?</strong></p>',
        buttons: [
          { label: 'Cancelar', action: 'cancel' },
          { label: '🚪 Salir sin guardar', action: 'exit' },
        ],
        onClose: (action) => {
          if (action === 'exit') {
            isDirty = false;
            store.navigate = _origNavigate;
            _origNavigate(view, extra);
          }
        },
      });
    } else {
      store.navigate = _origNavigate;
      _origNavigate(view, extra);
    }
  };

  // Source image (full resolution)
  const srcImg = new Image();
  srcImg.crossOrigin = 'anonymous';
  srcImg.src = srcUrl + (srcUrl.includes('?') ? '&' : '?') + '_noc=' + Date.now();

  // ── DOM ───────────────────────────────────────────────────────────────────
  el.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display:flex;align-items:center;justify-content:space-between;
    padding:12px 0;margin-bottom:14px;gap:10px;flex-wrap:wrap;
  `;
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <button class="btn btn-sm btn-secondary" id="pe-back">← Galería</button>
      <span style="font-size:14px;font-weight:700;color:var(--text-primary);
                   overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px">
        ✏️ ${esc(media.title || media.file_name)}
      </span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <span id="pe-dim" style="font-size:11px;color:var(--text-muted);line-height:28px">
        ${origW}×${origH}px
      </span>
      <button class="btn btn-sm btn-secondary" id="pe-undo" disabled title="Deshacer (Ctrl+Z)">↩ Deshacer</button>
      <button class="btn btn-sm btn-secondary" id="pe-redo" disabled title="Rehacer (Ctrl+Y)">↪ Rehacer</button>
      <button class="btn btn-sm btn-secondary" id="pe-reset">↺ Reset</button>
      <button class="btn btn-sm btn-secondary" id="pe-dl">⬇️ Descargar</button>
      <button class="btn btn-sm btn-secondary" id="pe-save-state" title="Guarda los elementos del canvas para reeditarlos luego">📌 Guardar estado</button>
      <button class="btn btn-sm btn-primary"   id="pe-save">💾 Guardar</button>
    </div>
  `;
  el.appendChild(header);

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap';
  const TABS = [
    { id:'presets',  label:'📐 Presets' },
    { id:'adjust',   label:'🎛️ Ajustes' },
    { id:'filters',  label:'✨ Filtros' },
    { id:'text',     label:'📝 Texto' },
    { id:'focus',    label:'🔍 Enfoque' },
    { id:'brush',    label:'🖌️ Pincel' },
    { id:'crop',     label:'✂️ Recorte' },
    { id:'cinema',   label:'🎬 Cine' },
    { id:'bg',       label:'✂️ Fondo' },
    { id:'elements', label:'✨ Elementos' },
    { id:'ai',       label:'🤖 IA' },
  ];
  TABS.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'pe-tab' + (t.id === state.tab ? ' active' : '');
    btn.dataset.tab = t.id;
    btn.textContent = t.label;
    btn.addEventListener('click', () => switchTab(t.id));
    tabBar.appendChild(btn);
  });
  el.appendChild(tabBar);

  // Main layout: canvas left, controls right
  const layout = document.createElement('div');
  layout.style.cssText = `
    display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start;
  `;
  el.appendChild(layout);

  // Canvas area
  const canvasArea = document.createElement('div');
  canvasArea.style.cssText = `
    background:#080808;border-radius:12px;
    display:flex;align-items:center;justify-content:center;
    min-height:400px;position:relative;overflow:visible;padding:16px;
  `;
  layout.appendChild(canvasArea);

  const canvasWrapper = document.createElement('div');
  canvasWrapper.className = 'pe-canvas-wrapper';
  canvasArea.appendChild(canvasWrapper);

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'max-width:100%;border-radius:6px;display:block;';
  canvasWrapper.appendChild(canvas);
  const ctx = canvas.getContext('2d', { willReadFrequently: false });

  // Elements overlay canvas
  const elemCanvas = document.createElement('canvas');
  elemCanvas.id = 'pe-elem-canvas';
  elemCanvas.style.cssText = `
    position:absolute;top:0;left:0;width:100%;height:100%;
    border-radius:6px;pointer-events:none;
  `;
  canvasWrapper.appendChild(elemCanvas);

  // Controls panel
  const panel = document.createElement('div');
  panel.style.cssText = `
    background:var(--bg-2);border-radius:12px;padding:16px;
    max-height:600px;overflow-y:auto;
  `;
  layout.appendChild(panel);

  // ── Canvas rendering ──────────────────────────────────────────────────────
  let renderRaf = null;
  function scheduleRender() {
    if (renderRaf) return;
    renderRaf = requestAnimationFrame(() => { renderRaf = null; doRender(); });
  }

  function _drawSrc(ctx, w, h) {
    const r90 = state.rotate === 90 || state.rotate === 270;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(state.rotate * Math.PI / 180);
    ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
    const sw = r90 ? h : w;
    const sh = r90 ? w : h;
    if (state.crop) {
      ctx.drawImage(srcImg, state.crop.sx, state.crop.sy, state.crop.sw, state.crop.sh, -sw / 2, -sh / 2, sw, sh);
    } else {
      ctx.drawImage(srcImg, -sw / 2, -sh / 2, sw, sh);
    }
    ctx.restore();
  }

  function _applyBlurMask(ctx, dispW, dispH) {
    if (!state.blurMaskHasContent || !state.blurMask) return;
    const blurTmp = document.createElement('canvas');
    blurTmp.width = dispW; blurTmp.height = dispH;
    const bCtx = blurTmp.getContext('2d');
    bCtx.filter = `blur(${state.blurBrush.strength}px)`;
    _drawSrc(bCtx, dispW, dispH);
    bCtx.filter = 'none';

    const maskTmp = document.createElement('canvas');
    maskTmp.width = dispW; maskTmp.height = dispH;
    const mCtx = maskTmp.getContext('2d');
    mCtx.drawImage(state.blurMask, 0, 0, dispW, dispH);
    mCtx.globalCompositeOperation = 'source-in';
    mCtx.drawImage(blurTmp, 0, 0);
    ctx.drawImage(maskTmp, 0, 0);
  }

  function _buildFilter(excludeBlur = false) {
    const preset = FILTERS.find(f => f.id === state.filter)?.css || '';
    const adj = [
      state.adj.brightness !== 1 ? `brightness(${state.adj.brightness})` : '',
      state.adj.contrast   !== 1 ? `contrast(${state.adj.contrast})`     : '',
      state.adj.saturation !== 1 ? `saturate(${state.adj.saturation})`   : '',
      state.adj.hueRotate  !== 0 ? `hue-rotate(${state.adj.hueRotate}deg)` : '',
      state.adj.sepia      >  0  ? `sepia(${state.adj.sepia})`           : '',
      (!excludeBlur && state.adj.blur > 0) ? `blur(${state.adj.blur}px)` : '',
    ].filter(Boolean).join(' ');
    return [preset, adj].filter(Boolean).join(' ') || 'none';
  }

  function _drawSrcOrBg(targetCtx, w, h) {
    if (state.bgRemoved) {
      targetCtx.drawImage(state.bgRemoved, 0, 0, w, h);
    } else {
      _drawSrc(targetCtx, w, h);
    }
  }

  function doRender() {
    if (!srcImg.complete || !srcImg.naturalWidth) return;

    // Target canvas size — swap W/H if rotated 90° or 270°
    const rotated90 = state.rotate === 90 || state.rotate === 270;
    const tw = state.preset.w || origW;
    const th = state.preset.h || origH;
    const cw = rotated90 ? th : tw;
    const ch = rotated90 ? tw : th;
    const maxDisp = 900;
    const scale   = Math.min(maxDisp / cw, maxDisp / ch, 1);
    const dispW   = Math.round(cw * scale);
    const dispH   = Math.round(ch * scale);

    if (canvas.width !== dispW || canvas.height !== dispH) {
      canvas.width  = dispW;
      canvas.height = dispH;
    }

    const filterStr = _buildFilter(state.focus.enabled);

    if (state.focus.enabled) {
      // 1. Draw sharp (filtered) image
      ctx.filter = filterStr;
      _drawSrcOrBg(ctx, dispW, dispH);
      ctx.filter = 'none';

      // 2. Create blurred layer on temp canvas
      const tmp = document.createElement('canvas');
      tmp.width = dispW; tmp.height = dispH;
      const tCtx = tmp.getContext('2d');
      const blurFilter = (filterStr !== 'none' ? filterStr + ' ' : '') + `blur(${state.focus.blur}px)`;
      tCtx.filter = blurFilter;
      _drawSrcOrBg(tCtx, dispW, dispH);
      tCtx.filter = 'none';

      // 3. Cut focus ellipse hole in blurred layer (destination-out is reliable in Chromium)
      const cx = state.focus.x * dispW;
      const cy = state.focus.y * dispH;
      const rx = state.focus.radius * Math.min(dispW, dispH);
      const ry = state.focus.shape === 'oval' ? rx * 0.6 : rx;
      tCtx.globalCompositeOperation = 'destination-out';
      tCtx.beginPath();
      tCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.globalCompositeOperation = 'source-over';

      // 4. Composite blurred layer (with hole) on top of sharp image
      ctx.drawImage(tmp, 0, 0);

      // 4b. Painted blur mask
      _applyBlurMask(ctx, dispW, dispH);

      // 5. Draw focus ring
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.filter = filterStr;
      _drawSrcOrBg(ctx, dispW, dispH);
      ctx.filter = 'none';
      _applyBlurMask(ctx, dispW, dispH);
    }

    // Cinema effects
    if (state.cinema) {
      _applyCinemaToCtx(ctx, dispW, dispH);
    }

    // Draw text layers
    state.textLayers.forEach(t => _drawText(ctx, t, dispW, dispH, t.id === state.selTextId));

    // Update text handle positions
    _updateTextHandles(dispW, dispH);

    // Update dimension display
    const dimEl = el.querySelector('#pe-dim');
    if (dimEl) dimEl.textContent = `${tw}×${th}px`;

    // Render elements overlay
    elemCanvas.width  = dispW;
    elemCanvas.height = dispH;
    _renderElements(elemCanvas, dispW, dispH);
  }

  // Draw a text layer on ctx (positions 0-1 relative)
  function _drawText(ctx, t, W, H, selected) {
    const px   = t.x * W;
    const py   = t.y * H;
    const size = Math.round(t.size * (W / origW));
    ctx.save();
    ctx.font = `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${size}px ${t.font || 'Arial'}`;
    ctx.textAlign = t.align || 'center';
    ctx.textBaseline = 'middle';
    if (t.shadow) {
      ctx.shadowColor   = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur    = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    }
    ctx.fillStyle = t.color;
    if (t.letterSpacing) { try { ctx.letterSpacing = t.letterSpacing + 'px'; } catch (_) {} }
    if (t.vertical) {
      const chars = [...(t.text || '')];
      const lineH = size * 1.2;
      const totalH = chars.length * lineH;
      chars.forEach((ch, ci) => {
        ctx.fillText(ch, px, py + ci * lineH - totalH / 2 + lineH / 2);
      });
    } else {
      ctx.fillText(t.text || '', px, py);
    }
    try { ctx.letterSpacing = '0px'; } catch (_) {}
    ctx.restore();
  }

  // ── Text handles (draggable DOM overlays) ─────────────────────────────────
  function _updateTextHandles(dispW, dispH) {
    // Remove old handles
    canvasWrapper.querySelectorAll('.pe-text-handle').forEach(h => h.remove());

    state.textLayers.forEach(t => {
      const h = document.createElement('div');
      h.className = 'pe-text-handle' + (t.id === state.selTextId ? ' selected' : '');
      h.style.cssText = `
        left:${t.x * 100}%;top:${t.y * 100}%;
        font-size:${t.size * (dispW / origW)}px;
        color:${t.color};
        font-family:${t.font || 'Arial'};
        font-weight:${t.bold ? 'bold' : 'normal'};
        font-style:${t.italic ? 'italic' : 'normal'};
        text-shadow:${t.shadow ? '0 2px 6px rgba(0,0,0,.8)' : 'none'};
        text-align:${t.align || 'center'};
        letter-spacing:${t.letterSpacing || 0}px;
        writing-mode:${t.vertical ? 'vertical-rl' : 'horizontal-tb'};
      `;
      h.textContent = t.text || ' ';

      h.addEventListener('mousedown', e => {
        e.stopPropagation();
        state.selTextId = t.id;
        state.dragging  = { layer: t, sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y };
        renderPanel();
        scheduleRender();
      });

      canvasWrapper.appendChild(h);
    });
  }

  // Drag text layers on canvas
  canvasWrapper.addEventListener('mousemove', e => {
    if (!state.dragging) return;
    const rect = canvas.getBoundingClientRect();
    const dx = (e.clientX - state.dragging.sx) / rect.width;
    const dy = (e.clientY - state.dragging.sy) / rect.height;
    state.dragging.layer.x = Math.max(0, Math.min(1, state.dragging.ox + dx));
    state.dragging.layer.y = Math.max(0, Math.min(1, state.dragging.oy + dy));
    scheduleRender();
  });
  canvasWrapper.addEventListener('mouseup', () => { state.dragging = null; });
  canvasWrapper.addEventListener('mouseleave', () => { state.dragging = null; });

  // ── Blur brush painting ───────────────────────────────────────────────────
  function _ensureBlurMask() {
    if (!state.blurMask) {
      state.blurMask = document.createElement('canvas');
      state.blurMask.width  = srcImg.naturalWidth  || origW;
      state.blurMask.height = srcImg.naturalHeight || origH;
    }
    return state.blurMask;
  }

  function _paintBlur(e) {
    if (state.tab !== 'brush' || !state.blurBrushPainting) return;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top)  / rect.height;
    const mask = _ensureBlurMask();
    const mx = px * mask.width;
    const my = py * mask.height;
    const mr = state.blurBrush.radius * (mask.width / (canvas.width || 1));
    const mCtx = mask.getContext('2d');
    const grad = mCtx.createRadialGradient(mx, my, 0, mx, my, mr);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    mCtx.fillStyle = grad;
    mCtx.beginPath();
    mCtx.arc(mx, my, mr, 0, Math.PI * 2);
    mCtx.fill();
    state.blurMaskHasContent = true;
    setDirty();
    scheduleRender();
  }

  canvasWrapper.addEventListener('mousedown', e => {
    if (state.tab === 'brush') {
      state.blurBrushPainting = true;
      _paintBlur(e);
    } else if (state.tab === 'crop') {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top)  / rect.height;
      state.cropDrag = { startX: x, startY: y, endX: x, endY: y };
      scheduleRender();
    }
  });
  canvasWrapper.addEventListener('mousemove', e => {
    if (state.tab === 'brush') {
      _paintBlur(e);
      return;
    }
    if (state.tab === 'crop' && state.cropDrag) {
      const rect = canvas.getBoundingClientRect();
      state.cropDrag.endX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      state.cropDrag.endY = Math.max(0, Math.min(1, (e.clientY - rect.top)  / rect.height));
      _renderCropOverlay();
      return;
    }
  });
  canvasWrapper.addEventListener('mouseup', e => {
    state.blurBrushPainting = false;
    if (state.tab === 'crop' && state.cropDrag) {
      // finalize drag — overlay stays; user clicks Apply in panel
    }
  });
  canvasWrapper.addEventListener('mouseleave', e => {
    state.blurBrushPainting = false;
  });

  let cropOverlay = null;
  function _renderCropOverlay() {
    if (!cropOverlay) {
      cropOverlay = document.createElement('div');
      cropOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
      canvasWrapper.appendChild(cropOverlay);
    }
    if (!state.cropDrag) { cropOverlay.innerHTML = ''; return; }
    const { startX, startY, endX, endY } = state.cropDrag;
    const x1 = Math.min(startX, endX) * 100;
    const y1 = Math.min(startY, endY) * 100;
    const x2 = Math.max(startX, endX) * 100;
    const y2 = Math.max(startY, endY) * 100;
    cropOverlay.innerHTML = `
      <div style="position:absolute;
        left:${x1}%;top:${y1}%;width:${x2-x1}%;height:${y2-y1}%;
        background:transparent;
        box-shadow:0 0 0 9999px rgba(0,0,0,.58);
        border:2px dashed rgba(255,255,255,.75);
        pointer-events:none;">
      </div>
    `;
  }

  // Focus position: click on canvas to set focus point
  canvasWrapper.addEventListener('click', e => {
    if (state.tab !== 'focus' || !state.focus.enabled) return;
    const rect = canvas.getBoundingClientRect();
    state.focus.x = (e.clientX - rect.left) / rect.width;
    state.focus.y = (e.clientY - rect.top)  / rect.height;
    scheduleRender();
    // Update focus sliders
    panel.querySelector('#foc-x') && (panel.querySelector('#foc-x').value = Math.round(state.focus.x * 100));
    panel.querySelector('#foc-y') && (panel.querySelector('#foc-y').value = Math.round(state.focus.y * 100));
    panel.querySelector('#foc-xv') && (panel.querySelector('#foc-xv').textContent = Math.round(state.focus.x * 100));
    panel.querySelector('#foc-yv') && (panel.querySelector('#foc-yv').textContent = Math.round(state.focus.y * 100));
  });

  // ── Tab panels ────────────────────────────────────────────────────────────
  function switchTab(id) {
    state.tab = id;
    tabBar.querySelectorAll('.pe-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    canvas.style.cursor = (id === 'brush' || id === 'crop') ? 'crosshair' : 'default';
    // Clear crop overlay when leaving crop tab
    if (id !== 'crop' && cropOverlay) cropOverlay.innerHTML = '';
    // Elements canvas pointer-events
    elemCanvas.style.pointerEvents = (id === 'elements') ? 'auto' : 'none';
    renderPanel();
  }

  function renderPanel() {
    panel.innerHTML = '';
    if      (state.tab === 'presets')   buildPresetsPanel();
    else if (state.tab === 'adjust')    buildAdjustPanel();
    else if (state.tab === 'filters')   buildFiltersPanel();
    else if (state.tab === 'text')      buildTextPanel();
    else if (state.tab === 'focus')     buildFocusPanel();
    else if (state.tab === 'brush')     buildBrushPanel();
    else if (state.tab === 'crop')      buildCropPanel();
    else if (state.tab === 'cinema')    buildCinemaPanel();
    else if (state.tab === 'bg')        buildBgPanel();
    else if (state.tab === 'elements')  buildElementsPanel();
    else if (state.tab === 'ai')        buildAiPanel();
  }

  // ── Presets panel ─────────────────────────────────────────────────────────
  function buildPresetsPanel() {
    panel.innerHTML = '';
    const platformRow = document.createElement('div');
    platformRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px';

    Object.keys(PLATFORM_PRESETS).forEach(plat => {
      const btn = document.createElement('button');
      btn.className = 'pe-preset-platform' + (plat === state.preset.platform ? ' active' : '');
      btn.textContent = plat;
      btn.addEventListener('click', () => {
        state.preset.platform = plat;
        state.preset.name = null;
        buildPresetsPanel(); // Re-render to show new sizes
      });
      platformRow.appendChild(btn);
    });
    panel.appendChild(platformRow);

    // Custom size
    const customDiv = document.createElement('div');
    customDiv.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:14px';
    customDiv.innerHTML = `
      <input type="number" class="form-control" id="ps-cw" value="${state.preset.w}" min="1" max="8000"
             style="width:80px" placeholder="W">
      <span style="color:var(--text-muted);font-size:13px">×</span>
      <input type="number" class="form-control" id="ps-ch" value="${state.preset.h}" min="1" max="8000"
             style="width:80px" placeholder="H">
      <button class="btn btn-sm btn-secondary" id="ps-apply-custom">Aplicar</button>
      <button class="btn btn-sm btn-secondary" id="ps-original">Original</button>
    `;
    panel.appendChild(customDiv);
    panel.querySelector('#ps-apply-custom').addEventListener('click', () => {
      const w = parseInt(panel.querySelector('#ps-cw').value);
      const h = parseInt(panel.querySelector('#ps-ch').value);
      if (w > 0 && h > 0) { state.preset.w = w; state.preset.h = h; state.preset.name = 'Custom'; scheduleRender(); }
    });
    panel.querySelector('#ps-original').addEventListener('click', () => {
      state.preset.w = origW; state.preset.h = origH; state.preset.name = null; scheduleRender();
      panel.querySelector('#ps-cw').value = origW;
      panel.querySelector('#ps-ch').value = origH;
    });

    // Platform sizes
    const sizes = PLATFORM_PRESETS[state.preset.platform] || [];
    const sizeGrid = document.createElement('div');
    sizeGrid.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    sizes.forEach(sz => {
      const btn = document.createElement('button');
      const isActive = state.preset.name === sz.name && state.preset.platform;
      btn.className = 'pe-preset-size' + (isActive ? ' active' : '');
      btn.innerHTML = `
        <span style="font-weight:700;font-size:12px">${sz.name}</span>
        <span style="float:right;font-size:10px;color:var(--text-muted)">${sz.w}×${sz.h}</span>
      `;
      btn.addEventListener('click', () => {
        state.preset.name = sz.name;
        state.preset.w = sz.w;
        state.preset.h = sz.h;
        panel.querySelector('#ps-cw').value = sz.w;
        panel.querySelector('#ps-ch').value = sz.h;
        sizeGrid.querySelectorAll('.pe-preset-size').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        scheduleRender();
      });
      sizeGrid.appendChild(btn);
    });
    panel.appendChild(sizeGrid);
  }

  // ── Adjust panel ──────────────────────────────────────────────────────────
  function buildAdjustPanel() {
    const sliders = [
      { key:'brightness', label:'Brillo',     min:0.2, max:2.5, step:0.05, def:1 },
      { key:'contrast',   label:'Contraste',  min:0.2, max:2.5, step:0.05, def:1 },
      { key:'saturation', label:'Saturación', min:0,   max:3,   step:0.05, def:1 },
      { key:'hueRotate',  label:'Matiz',      min:0,   max:360, step:1,    def:0, unit:'°' },
      { key:'sepia',      label:'Sepia',      min:0,   max:1,   step:0.05, def:0, pct:true },
      { key:'blur',       label:'Blur global',min:0,   max:20,  step:0.5,  def:0, unit:'px' },
    ];

    sliders.forEach(sl => {
      const row = document.createElement('div');
      row.className = 'pe-slider-row';
      const val = state.adj[sl.key];
      const display = sl.pct ? Math.round(val * 100) + '%' : (sl.unit ? val.toFixed(sl.unit === 'px' ? 1 : 0) + sl.unit : val.toFixed(2));
      row.innerHTML = `
        <label>${sl.label}</label>
        <input type="range" min="${sl.min}" max="${sl.max}" step="${sl.step}" value="${val}"
               id="adj-${sl.key}">
        <span class="val" id="adjv-${sl.key}">${display}</span>
      `;
      row.querySelector(`#adj-${sl.key}`).addEventListener('input', e => {
        state.adj[sl.key] = parseFloat(e.target.value);
        const v = state.adj[sl.key];
        const d = sl.pct ? Math.round(v * 100) + '%' : (sl.unit ? v.toFixed(sl.unit === 'px' ? 1 : 0) + sl.unit : v.toFixed(2));
        row.querySelector(`#adjv-${sl.key}`).textContent = d;
        setDirty();
        scheduleRender();
      });
      panel.appendChild(row);
    });

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-sm btn-secondary';
    resetBtn.textContent = '↺ Reset ajustes';
    resetBtn.style.marginTop = '8px';
    resetBtn.addEventListener('click', () => {
      state.adj = { brightness:1, contrast:1, saturation:1, hueRotate:0, sepia:0, blur:0 };
      buildAdjustPanel();
      scheduleRender();
    });
    panel.appendChild(resetBtn);

    // ── Rotate / Flip ────────────────────────────────────────────────────────
    const rotSep = document.createElement('div');
    rotSep.style.cssText = 'margin:14px 0 8px;font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.6px';
    rotSep.textContent = 'ROTAR / VOLTEAR';
    panel.appendChild(rotSep);

    const rotRow = document.createElement('div');
    rotRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
    rotRow.innerHTML = `
      <button class="btn btn-sm btn-secondary" id="rot-ccw" title="Rotar 90° izquierda">↺ 90°</button>
      <button class="btn btn-sm btn-secondary" id="rot-cw"  title="Rotar 90° derecha">↻ 90°</button>
      <button class="btn btn-sm btn-secondary" id="flip-h"  title="Voltear horizontal">↔️ H</button>
      <button class="btn btn-sm btn-secondary" id="flip-v"  title="Voltear vertical">↕️ V</button>
      <button class="btn btn-sm btn-secondary" id="rot-180" title="Rotar 180°">🔄 180°</button>
    `;
    rotRow.querySelector('#rot-ccw').addEventListener('click', () => { state.rotate = (state.rotate - 90 + 360) % 360; setDirty(); scheduleRender(); });
    rotRow.querySelector('#rot-cw').addEventListener('click',  () => { state.rotate = (state.rotate + 90) % 360; setDirty(); scheduleRender(); });
    rotRow.querySelector('#flip-h').addEventListener('click',  () => { state.flipH = !state.flipH; setDirty(); scheduleRender(); });
    rotRow.querySelector('#flip-v').addEventListener('click',  () => { state.flipV = !state.flipV; setDirty(); scheduleRender(); });
    rotRow.querySelector('#rot-180').addEventListener('click', () => { state.rotate = (state.rotate + 180) % 360; setDirty(); scheduleRender(); });
    panel.appendChild(rotRow);
  }

  // ── Filters panel ─────────────────────────────────────────────────────────
  function buildFiltersPanel() {
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px';

    FILTERS.forEach(f => {
      const card = document.createElement('div');
      card.className = 'pe-filter-card' + (f.id === state.filter ? ' active' : '');
      card.title = f.name;

      // Mini preview using CSS filter on a copy of the src image
      const thumb = document.createElement('img');
      thumb.src = srcUrl;
      thumb.className = 'pe-filter-thumb';
      thumb.style.filter = f.css || 'none';
      thumb.loading = 'lazy';

      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:10px;font-weight:700;text-align:center;padding:4px;background:var(--bg-3);color:var(--text-muted)';
      lbl.textContent = f.emoji + ' ' + f.name;

      card.append(thumb, lbl);
      card.addEventListener('click', () => {
        state.filter = f.id;
        grid.querySelectorAll('.pe-filter-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        setDirty();
        scheduleRender();
      });
      grid.appendChild(card);
    });
    panel.appendChild(grid);
  }

  // ── Text panel ────────────────────────────────────────────────────────────
  function buildTextPanel() {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-sm btn-primary';
    addBtn.style.width = '100%';
    addBtn.textContent = '＋ Agregar texto';
    addBtn.addEventListener('click', () => {
      const layer = {
        id: state.nextId++, text: 'Texto', x: 0.5, y: 0.3,
        size: 48, color: '#ffffff', font: 'Arial',
        bold: false, italic: false, shadow: true, align: 'center',
      };
      state.textLayers.push(layer);
      state.selTextId = layer.id;
      setDirty();
      buildTextPanel();
      scheduleRender();
    });
    panel.appendChild(addBtn);

    if (!state.textLayers.length) {
      const hint = document.createElement('p');
      hint.style.cssText = 'font-size:12px;color:var(--text-muted);text-align:center;margin-top:20px';
      hint.textContent = 'Agrega texto y arrástralo sobre la imagen';
      panel.appendChild(hint);
      return;
    }

    // List of layers
    const listDiv = document.createElement('div');
    listDiv.style.cssText = 'margin-top:12px;display:flex;flex-direction:column;gap:6px';

    state.textLayers.forEach(t => {
      const item = document.createElement('div');
      item.className = 'pe-text-layer-item' + (t.id === state.selTextId ? ' selected' : '');
      item.innerHTML = `
        <span style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(t.text || '…')}
        </span>
        <button data-del="${t.id}" style="background:none;border:none;color:#FF5555;cursor:pointer;font-size:16px;padding:0">✕</button>
      `;
      item.addEventListener('click', e => {
        if (e.target.dataset.del) {
          state.textLayers = state.textLayers.filter(x => x.id !== parseInt(e.target.dataset.del));
          if (state.selTextId === parseInt(e.target.dataset.del)) state.selTextId = null;
          buildTextPanel(); scheduleRender(); return;
        }
        state.selTextId = t.id;
        buildTextPanel(); scheduleRender();
      });
      listDiv.appendChild(item);
    });
    panel.appendChild(listDiv);

    // Editor for selected layer
    const sel = state.textLayers.find(t => t.id === state.selTextId);
    if (!sel) return;

    const edDiv = document.createElement('div');
    edDiv.style.cssText = 'margin-top:14px;display:flex;flex-direction:column;gap:10px';
    edDiv.innerHTML = `
      <div>
        <label style="display:block;font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:.8px;margin-bottom:4px">TEXTO</label>
        <input type="text" class="form-control" id="txt-text" value="${esc(sel.text)}" style="width:100%">
      </div>
      <div class="pe-slider-row">
        <label>Tamaño</label>
        <input type="range" id="txt-size" min="12" max="200" step="1" value="${sel.size}">
        <span class="val" id="txtv-size">${sel.size}px</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label style="font-size:11px;color:var(--text-muted);width:60px">Color</label>
        <input type="color" id="txt-color" value="${sel.color}"
               style="width:48px;height:32px;border-radius:6px;border:none;cursor:pointer;flex-shrink:0">
        <select id="txt-font" class="form-control" style="flex:1;min-width:100px;font-size:12px">
          ${[
            'Arial','Arial Black','Georgia','Impact','Verdana',
            'Courier New','Trebuchet MS','Tahoma','Times New Roman',
            'Comic Sans MS','Palatino Linotype','Book Antiqua',
            'Garamond','Century Gothic','Lucida Console',
            'Lucida Sans Unicode','Franklin Gothic Medium',
            ...state.loadedFonts,
          ].map(f => `<option ${f===sel.font?'selected':''}>${f}</option>`).join('')}
        </select>
        <button id="txt-load-font" class="btn btn-sm btn-secondary"
                title="Cargar fuente personalizada (.ttf .otf .woff .woff2)"
                style="flex-shrink:0;padding:0 10px;font-size:16px">📂</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="txt-bold"     class="btn btn-sm ${sel.bold     ? 'btn-primary':'btn-secondary'}" style="font-weight:900">B</button>
        <button id="txt-italic"   class="btn btn-sm ${sel.italic   ? 'btn-primary':'btn-secondary'}" style="font-style:italic">I</button>
        <button id="txt-shadow"   class="btn btn-sm ${sel.shadow   ? 'btn-primary':'btn-secondary'}">◈ Sombra</button>
        <button id="txt-vertical" class="btn btn-sm ${sel.vertical ? 'btn-primary':'btn-secondary'}" title="Texto vertical">⬇ V</button>
        <select id="txt-align" class="form-control" style="width:auto;font-size:12px">
          <option value="left"   ${sel.align==='left'  ?'selected':''}>← Izq</option>
          <option value="center" ${sel.align==='center'?'selected':''}>↔ Centro</option>
          <option value="right"  ${sel.align==='right' ?'selected':''}>→ Der</option>
        </select>
      </div>
      <div class="pe-slider-row">
        <label>Espaciado</label>
        <input type="range" id="txt-letter-spacing" min="0" max="30" step="1" value="${sel.letterSpacing || 0}">
        <span class="val" id="txtv-ls">${sel.letterSpacing || 0}px</span>
      </div>
    `;

    // Wire
    edDiv.querySelector('#txt-text').addEventListener('input', e => { sel.text = e.target.value; setDirty(); scheduleRender(); });
    edDiv.querySelector('#txt-size').addEventListener('input', e => {
      sel.size = parseInt(e.target.value);
      edDiv.querySelector('#txtv-size').textContent = sel.size + 'px';
      setDirty();
      scheduleRender();
    });
    edDiv.querySelector('#txt-color').addEventListener('input', e => { sel.color = e.target.value; setDirty(); scheduleRender(); });
    edDiv.querySelector('#txt-font').addEventListener('change', e => { sel.font = e.target.value; setDirty(); scheduleRender(); });
    edDiv.querySelector('#txt-load-font').addEventListener('click', () => {
      const fi = document.createElement('input');
      fi.type   = 'file';
      fi.accept = '.ttf,.otf,.woff,.woff2';
      fi.addEventListener('change', async () => {
        const file = fi.files[0];
        if (!file) return;
        try {
          const fontName = file.name.replace(/\.[^.]+$/, '');
          const buf  = await file.arrayBuffer();
          const face = new FontFace(fontName, buf);
          await face.load();
          document.fonts.add(face);
          if (!state.loadedFonts.includes(fontName)) state.loadedFonts.push(fontName);
          sel.font = fontName;
          buildTextPanel();
          scheduleRender();
          showToast(`✅ Fuente "${fontName}" cargada`);
        } catch (err) {
          showToast('Error cargando fuente: ' + err.message, 'error');
        }
      });
      fi.click();
    });
    edDiv.querySelector('#txt-bold').addEventListener('click', () => {
      sel.bold = !sel.bold;
      edDiv.querySelector('#txt-bold').className = `btn btn-sm ${sel.bold ? 'btn-primary':'btn-secondary'}`;
      setDirty(); scheduleRender();
    });
    edDiv.querySelector('#txt-italic').addEventListener('click', () => {
      sel.italic = !sel.italic;
      edDiv.querySelector('#txt-italic').className = `btn btn-sm ${sel.italic ? 'btn-primary':'btn-secondary'}`;
      setDirty(); scheduleRender();
    });
    edDiv.querySelector('#txt-shadow').addEventListener('click', () => {
      sel.shadow = !sel.shadow;
      edDiv.querySelector('#txt-shadow').className = `btn btn-sm ${sel.shadow ? 'btn-primary':'btn-secondary'}`;
      setDirty(); scheduleRender();
    });
    edDiv.querySelector('#txt-align').addEventListener('change', e => { sel.align = e.target.value; setDirty(); scheduleRender(); });
    edDiv.querySelector('#txt-vertical').addEventListener('click', () => {
      sel.vertical = !sel.vertical;
      edDiv.querySelector('#txt-vertical').className = `btn btn-sm ${sel.vertical ? 'btn-primary':'btn-secondary'}`;
      setDirty(); scheduleRender();
    });
    edDiv.querySelector('#txt-letter-spacing').addEventListener('input', e => {
      sel.letterSpacing = parseInt(e.target.value) || 0;
      edDiv.querySelector('#txtv-ls').textContent = sel.letterSpacing + 'px';
      setDirty(); scheduleRender();
    });

    panel.appendChild(edDiv);
  }

  // ── Focus / Bokeh panel ───────────────────────────────────────────────────
  function buildFocusPanel() {
    const foc = state.focus;
    panel.innerHTML = '';

    const toggle = document.createElement('label');
    toggle.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:14px;cursor:pointer';
    toggle.innerHTML = `
      <input type="checkbox" id="foc-enabled" ${foc.enabled ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent)">
      <span style="font-size:14px;font-weight:700;color:var(--text-primary)">Efecto Bokeh / Enfoque</span>
    `;
    panel.appendChild(toggle);

    panel.querySelector('#foc-enabled').addEventListener('change', e => {
      foc.enabled = e.target.checked;
      scheduleRender();
    });

    const hint = document.createElement('p');
    hint.style.cssText = 'font-size:11px;color:var(--text-muted);margin-bottom:14px;line-height:1.5';
    hint.textContent = '💡 Haz clic sobre la imagen para mover el punto de enfoque.';
    panel.appendChild(hint);

    const sliders = [
      { key:'x',      label:'Pos. X',      min:0,   max:1,   step:0.01, unit:'%', toDisp: v => Math.round(v*100), fromDisp: v => v/100, id:'foc-x', vid:'foc-xv' },
      { key:'y',      label:'Pos. Y',      min:0,   max:1,   step:0.01, unit:'%', toDisp: v => Math.round(v*100), fromDisp: v => v/100, id:'foc-y', vid:'foc-yv' },
      { key:'radius', label:'Radio foco',  min:0.05,max:0.7, step:0.01, unit:'%', toDisp: v => Math.round(v*100), fromDisp: v => v/100, id:'foc-r', vid:'foc-rv' },
      { key:'blur',   label:'Intensidad',  min:1,   max:30,  step:0.5,  unit:'px', toDisp: v => v.toFixed(1), fromDisp: v => parseFloat(v), id:'foc-b', vid:'foc-bv' },
    ];

    sliders.forEach(sl => {
      const row = document.createElement('div');
      row.className = 'pe-slider-row';
      const cur = sl.key === 'x' ? foc.x : sl.key === 'y' ? foc.y : sl.key === 'radius' ? foc.radius : foc.blur;
      const dispVal = sl.toDisp(cur);
      row.innerHTML = `
        <label>${sl.label}</label>
        <input type="range" id="${sl.id}" min="${sl.min}" max="${sl.max}" step="${sl.step}" value="${cur}">
        <span class="val" id="${sl.vid}">${dispVal}${sl.unit}</span>
      `;
      row.querySelector(`#${sl.id}`).addEventListener('input', e => {
        const raw = parseFloat(e.target.value);
        if (sl.key === 'x')      foc.x      = raw;
        else if (sl.key === 'y') foc.y      = raw;
        else if (sl.key === 'radius') foc.radius = raw;
        else foc.blur = raw;
        row.querySelector(`#${sl.vid}`).textContent = sl.toDisp(raw) + sl.unit;
        scheduleRender();
      });
      panel.appendChild(row);
    });

    // Shape
    const shapeDiv = document.createElement('div');
    shapeDiv.style.cssText = 'display:flex;gap:8px;margin-top:8px';
    shapeDiv.innerHTML = `
      <span style="font-size:11px;color:var(--text-muted);line-height:28px;width:100px">Forma</span>
      <button class="btn btn-sm ${foc.shape==='circle'?'btn-primary':'btn-secondary'}" id="sh-circle">⭕ Círculo</button>
      <button class="btn btn-sm ${foc.shape==='oval'  ?'btn-primary':'btn-secondary'}" id="sh-oval">🥚 Óvalo</button>
    `;
    panel.appendChild(shapeDiv);
    panel.querySelector('#sh-circle').addEventListener('click', () => {
      foc.shape = 'circle';
      buildFocusPanel(); scheduleRender();
    });
    panel.querySelector('#sh-oval').addEventListener('click', () => {
      foc.shape = 'oval';
      buildFocusPanel(); scheduleRender();
    });
  }

  // ── Brush panel ───────────────────────────────────────────────────────────
  function buildBrushPanel() {
    const info = document.createElement('p');
    info.style.cssText = 'font-size:11px;color:var(--text-muted);line-height:1.6;margin-bottom:14px';
    info.textContent = '🖌️ Arrastra sobre la imagen para pintar zonas de desenfoque.';
    panel.appendChild(info);

    [
      { key:'radius',   label:'Tamaño pincel', min:8, max:150, step:2, unit:'px', obj: state.blurBrush },
      { key:'strength', label:'Intensidad blur', min:2, max:30, step:1, unit:'px', obj: state.blurBrush },
    ].forEach(sl => {
      const row = document.createElement('div');
      row.className = 'pe-slider-row';
      row.innerHTML = `
        <label>${sl.label}</label>
        <input type="range" min="${sl.min}" max="${sl.max}" step="${sl.step}" value="${sl.obj[sl.key]}" id="br-${sl.key}">
        <span class="val" id="brv-${sl.key}">${sl.obj[sl.key]}${sl.unit}</span>
      `;
      row.querySelector(`#br-${sl.key}`).addEventListener('input', e => {
        sl.obj[sl.key] = parseFloat(e.target.value);
        row.querySelector(`#brv-${sl.key}`).textContent = sl.obj[sl.key] + sl.unit;
        scheduleRender();
      });
      panel.appendChild(row);
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn btn-sm btn-secondary';
    clearBtn.textContent = '🗑️ Limpiar todo el desenfoque';
    clearBtn.style.cssText = 'margin-top:12px;width:100%';
    clearBtn.addEventListener('click', () => {
      state.blurMask = null;
      state.blurMaskHasContent = false;
      scheduleRender();
    });
    panel.appendChild(clearBtn);

    const hint = document.createElement('p');
    hint.style.cssText = 'font-size:11px;color:var(--text-muted);margin-top:16px;line-height:1.5;';
    hint.textContent = '💡 El desenfoque pintado se aplica al guardar/descargar.';
    panel.appendChild(hint);
  }

  // ── Crop panel ────────────────────────────────────────────────────────────
  function buildCropPanel() {
    const info = document.createElement('p');
    info.style.cssText = 'font-size:11px;color:var(--text-muted);line-height:1.6;margin-bottom:14px';
    info.textContent = '✂️ Arrastra sobre la imagen para seleccionar el área de recorte.';
    panel.appendChild(info);

    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn btn-sm btn-primary';
    applyBtn.textContent = '✅ Aplicar recorte';
    applyBtn.style.cssText = 'width:100%;margin-bottom:8px';
    applyBtn.addEventListener('click', () => {
      if (!state.cropDrag) { showToast('Selecciona una región primero', 'error'); return; }
      const { startX, startY, endX, endY } = state.cropDrag;
      const x1 = Math.min(startX, endX);
      const y1 = Math.min(startY, endY);
      const x2 = Math.max(startX, endX);
      const y2 = Math.max(startY, endY);
      if (x2 - x1 < 0.02 || y2 - y1 < 0.02) { showToast('Área demasiado pequeña', 'error'); return; }

      // Convert display-space coords to source-image pixel coords
      const iw = srcImg.naturalWidth  || origW;
      const ih = srcImg.naturalHeight || origH;
      const sx = Math.round(x1 * iw);
      const sy = Math.round(y1 * ih);
      const sw = Math.round((x2 - x1) * iw);
      const sh = Math.round((y2 - y1) * ih);

      state.crop = { sx, sy, sw, sh };
      state.preset.w = sw;
      state.preset.h = sh;
      state.cropDrag = null;
      if (cropOverlay) cropOverlay.innerHTML = '';
      setDirty();
      scheduleRender();
      showToast('✅ Recorte aplicado');
      buildCropPanel(); // refresh panel
    });
    panel.appendChild(applyBtn);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-sm btn-secondary';
    resetBtn.textContent = '↺ Quitar recorte';
    resetBtn.style.cssText = 'width:100%;margin-bottom:12px';
    resetBtn.addEventListener('click', () => {
      state.crop = null;
      state.cropDrag = null;
      state.preset.w = origW;
      state.preset.h = origH;
      if (cropOverlay) cropOverlay.innerHTML = '';
      scheduleRender();
      showToast('Recorte eliminado');
      buildCropPanel();
    });
    panel.appendChild(resetBtn);

    if (state.crop) {
      const info2 = document.createElement('div');
      info2.style.cssText = 'font-size:12px;color:var(--accent);background:rgba(0,0,0,.2);border-radius:8px;padding:10px;';
      info2.textContent = `Recorte activo: ${state.crop.sw}×${state.crop.sh}px desde (${state.crop.sx}, ${state.crop.sy})`;
      panel.appendChild(info2);
    }
  }

  // ── Export helpers ────────────────────────────────────────────────────────
  async function _renderToBlob(mimeType = 'image/png', quality = 0.92) {
    const rotated90 = state.rotate === 90 || state.rotate === 270;
    const tw = state.preset.w || origW;
    const th = state.preset.h || origH;
    const cw = rotated90 ? th : tw;
    const ch = rotated90 ? tw : th;

    await new Promise(resolve => {
      if (srcImg.complete && srcImg.naturalWidth) { resolve(); return; }
      srcImg.onload = resolve;
    });

    const expCanvas = document.createElement('canvas');
    expCanvas.width  = cw;
    expCanvas.height = ch;
    const eCtx = expCanvas.getContext('2d');

    const filterStr = _buildFilter(state.focus.enabled);

    if (state.focus.enabled) {
      eCtx.filter = filterStr;
      _drawSrcOrBg(eCtx, cw, ch);
      eCtx.filter = 'none';

      const tmp = document.createElement('canvas');
      tmp.width = cw; tmp.height = ch;
      const tCtx = tmp.getContext('2d');
      const blurFilter = (filterStr !== 'none' ? filterStr + ' ' : '') + `blur(${state.focus.blur}px)`;
      tCtx.filter = blurFilter;
      _drawSrcOrBg(tCtx, cw, ch);
      tCtx.filter = 'none';

      const cx = state.focus.x * cw;
      const cy = state.focus.y * ch;
      const rx = state.focus.radius * Math.min(cw, ch);
      const ry = state.focus.shape === 'oval' ? rx * 0.6 : rx;
      tCtx.globalCompositeOperation = 'destination-out';
      tCtx.beginPath();
      tCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.globalCompositeOperation = 'source-over';

      eCtx.drawImage(tmp, 0, 0);
      _applyBlurMask(eCtx, cw, ch);
    } else {
      eCtx.filter = filterStr;
      _drawSrcOrBg(eCtx, cw, ch);
      eCtx.filter = 'none';
      _applyBlurMask(eCtx, cw, ch);
    }

    // Cinema effects on export
    if (state.cinema) _applyCinemaToCtx(eCtx, cw, ch);

    state.textLayers.forEach(t => _drawText(eCtx, t, cw, ch, false));

    // Elements on export
    if (state.elements.length > 0) {
      const elExpCanvas = document.createElement('canvas');
      elExpCanvas.width = cw; elExpCanvas.height = ch;
      _renderElements(elExpCanvas, cw, ch);
      eCtx.drawImage(elExpCanvas, 0, 0);
    }

    // Use PNG when bgRemoved to preserve transparency
    const finalMime = state.bgRemoved ? 'image/png' : mimeType;
    return new Promise(res => expCanvas.toBlob(res, finalMime, quality));
  }

  // ── Wire header buttons ───────────────────────────────────────────────────
  header.querySelector('#pe-back').addEventListener('click', () => store.navigate('starcho:gallery'));

  header.querySelector('#pe-undo').addEventListener('click', _undo);
  header.querySelector('#pe-redo').addEventListener('click', _redo);

  // Keyboard shortcuts for undo/redo
  el.setAttribute('tabindex', '-1');
  el.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { _undo(); e.preventDefault(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { _redo(); e.preventDefault(); }
  });

  header.querySelector('#pe-save-state').addEventListener('click', async () => {
    const btn = header.querySelector('#pe-save-state');
    btn.disabled = true;
    btn.textContent = '⏳…';
    try {
      await API.media.saveEditorState(mediaId, { elements: state.elements, textLayers: state.textLayers });
      showToast('📌 Estado del canvas guardado');
    } catch (err) {
      showToast('Error guardando estado: ' + err.message, 'error');
    } finally { btn.disabled = false; btn.textContent = '📌 Guardar estado'; }
  });

  header.querySelector('#pe-reset').addEventListener('click', () => {
    state.filter = 'normal';
    state.adj    = { brightness:1, contrast:1, saturation:1, hueRotate:0, sepia:0, blur:0 };
    state.focus  = { enabled:false, x:0.5, y:0.5, radius:0.27, blur:12, shape:'circle' };
    state.textLayers  = [];
    state.selTextId   = null;
    state.preset.w = origW; state.preset.h = origH; state.preset.name = null;
    renderPanel();
    scheduleRender();
  });

  header.querySelector('#pe-dl').addEventListener('click', async () => {
    const btn = header.querySelector('#pe-dl');
    btn.disabled = true;
    btn.textContent = '⏳…';
    try {
      const blob = await _renderToBlob('image/png', 0.95);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = (media.title || media.file_name || 'image').replace(/\.[^.]+$/, '') + '_edited.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast('✅ Descarga iniciada');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally { btn.disabled = false; btn.textContent = '⬇️ Descargar'; }
  });

  header.querySelector('#pe-save').addEventListener('click', async () => {
    const btn = header.querySelector('#pe-save');
    btn.disabled = true;
    btn.textContent = '⏳ Guardando…';
    try {
      const mimeType = state.bgRemoved ? 'image/png' : 'image/png';
      const blob = await _renderToBlob(mimeType, 0.95);
      const res  = await API.media.replace(mediaId, blob);
      isDirty = false;
      showToast('✅ Guardado en galería');
      // Bust image cache
      srcImg.src = API.mediaViewUrl(mediaId) + '&_t=' + Date.now();
    } catch (err) {
      showToast('Error guardando: ' + err.message, 'error');
    } finally { btn.disabled = false; btn.textContent = '💾 Guardar'; }
  });

  // ── Cinema effects ────────────────────────────────────────────────────────
  const CINEMA_GRADES = [
    { id:'none',    label:'Normal',        css:'' },
    { id:'teal',    label:'Teal & Orange', css:'sepia(15%) hue-rotate(165deg) saturate(1.3) contrast(1.1)' },
    { id:'bleach',  label:'Bleach Bypass', css:'saturate(0.3) contrast(1.7) brightness(0.85)' },
    { id:'warm',    label:'Warm Film',     css:'sepia(30%) contrast(1.1) brightness(1.05) saturate(1.2)' },
    { id:'cold',    label:'Cold Steel',    css:'hue-rotate(200deg) saturate(0.7) contrast(1.2)' },
    { id:'noir',    label:'Film Noir',     css:'grayscale(100%) contrast(1.5) brightness(0.8)' },
  ];

  function _applyCinemaToCtx(targetCtx, w, h) {
    const cin = state.cinema;
    if (!cin) return;
    // Color grade via canvas style filter is display-only; for export we overdraw
    if (cin.grade && cin.grade.css) {
      const gradeCanvas = document.createElement('canvas');
      gradeCanvas.width = w; gradeCanvas.height = h;
      const gCtx = gradeCanvas.getContext('2d');
      gCtx.filter = cin.grade.css;
      gCtx.drawImage(targetCtx.canvas, 0, 0);
      gCtx.filter = 'none';
      targetCtx.drawImage(gradeCanvas, 0, 0);
    }
    // Letterbox: top 12% and bottom 12%
    if (cin.letterbox) {
      const barH = Math.round(h * 0.12);
      targetCtx.fillStyle = '#000';
      targetCtx.fillRect(0, 0, w, barH);
      targetCtx.fillRect(0, h - barH, w, barH);
    }
    // Vignette: radial gradient
    if (cin.vignette) {
      const cx = w / 2, cy = h / 2;
      const rad = Math.sqrt(cx * cx + cy * cy);
      const grad = targetCtx.createRadialGradient(cx, cy, rad * 0.4, cx, cy, rad);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.72)');
      targetCtx.fillStyle = grad;
      targetCtx.fillRect(0, 0, w, h);
    }
  }

  function buildCinemaPanel() {
    panel.innerHTML = '';

    let selectedGradeId = state.cinema?.grade?.id || 'none';

    function _applyCinemaState() {
      const letterbox = wrap.querySelector('#pe-cinema-letterbox').checked;
      const vignette  = wrap.querySelector('#pe-cinema-vignette').checked;
      const grade     = CINEMA_GRADES.find(g => g.id === selectedGradeId) || CINEMA_GRADES[0];
      state.cinema = (letterbox || vignette || grade.id !== 'none')
        ? { letterbox, vignette, grade }
        : null;
      setDirty();
      scheduleRender();
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px';
    wrap.innerHTML = `
      <div style="font-size:12px;color:var(--text-muted);line-height:1.6">
        Efectos de cine en tiempo real — activa opciones y elige una gradación.
      </div>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
        <input type="checkbox" id="pe-cinema-letterbox" ${state.cinema?.letterbox ? 'checked' : ''}>
        <span style="font-size:13px">📽️ Barras de cine (letterbox)</span>
      </label>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
        <input type="checkbox" id="pe-cinema-vignette" ${state.cinema?.vignette ? 'checked' : ''}>
        <span style="font-size:13px">🔲 Viñeta</span>
      </label>
      <div style="font-size:11px;font-weight:700;letter-spacing:.6px;color:var(--text-muted);margin-top:4px">GRADACIÓN DE COLOR</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap" id="pe-cinema-grades"></div>
      <button class="btn btn-sm btn-secondary" id="pe-cinema-reset" style="margin-top:4px">✕ Quitar efecto cine</button>
    `;
    panel.appendChild(wrap);

    wrap.querySelector('#pe-cinema-letterbox').addEventListener('change', _applyCinemaState);
    wrap.querySelector('#pe-cinema-vignette').addEventListener('change', _applyCinemaState);

    const gradesDiv = wrap.querySelector('#pe-cinema-grades');
    CINEMA_GRADES.forEach(g => {
      const chip = document.createElement('button');
      chip.className = 'pe-preset-platform' + (g.id === selectedGradeId ? ' active' : '');
      chip.textContent = g.label;
      chip.dataset.gradeId = g.id;
      chip.addEventListener('click', () => {
        selectedGradeId = g.id;
        gradesDiv.querySelectorAll('.pe-preset-platform').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        _applyCinemaState();
      });
      gradesDiv.appendChild(chip);
    });

    wrap.querySelector('#pe-cinema-reset').addEventListener('click', () => {
      state.cinema = null;
      setDirty();
      scheduleRender();
      buildCinemaPanel();
    });
  }

  // ── Background removal ────────────────────────────────────────────────────
  function _removeBg(srcImgEl, tolerance, smooth) {
    const tmpC = document.createElement('canvas');
    tmpC.width  = srcImgEl.naturalWidth  || srcImgEl.width;
    tmpC.height = srcImgEl.naturalHeight || srcImgEl.height;
    const tmpCtx = tmpC.getContext('2d');
    tmpCtx.drawImage(srcImgEl, 0, 0);

    const w = tmpC.width, h = tmpC.height;
    const imgData = tmpCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const corners = [
      [0, 0], [w-1, 0], [0, h-1], [w-1, h-1],
      [Math.floor(w/2), 0], [0, Math.floor(h/2)],
      [w-1, Math.floor(h/2)], [Math.floor(w/2), h-1],
    ];

    let tr = 0, tg = 0, tb = 0;
    for (const [cx, cy] of corners) {
      const i = (cy * w + cx) * 4;
      tr += data[i]; tg += data[i+1]; tb += data[i+2];
    }
    const n = corners.length;
    const bgR = Math.round(tr/n), bgG = Math.round(tg/n), bgB = Math.round(tb/n);

    const visited = new Uint8Array(w * h);
    const queue = [];

    function colorDist(pi) {
      return Math.sqrt(
        Math.pow(data[pi]   - bgR, 2) +
        Math.pow(data[pi+1] - bgG, 2) +
        Math.pow(data[pi+2] - bgB, 2)
      );
    }

    for (const [cx, cy] of corners) {
      const startIdx = cy * w + cx;
      if (!visited[startIdx]) queue.push(startIdx);
    }

    while (queue.length) {
      const idx = queue.pop();
      if (idx < 0 || idx >= w * h || visited[idx]) continue;
      visited[idx] = 1;
      const pi = idx * 4;
      if (colorDist(pi) <= tolerance) {
        data[pi + 3] = 0;
        const x = idx % w, y = Math.floor(idx / w);
        if (x > 0)   queue.push(idx - 1);
        if (x < w-1) queue.push(idx + 1);
        if (y > 0)   queue.push(idx - w);
        if (y < h-1) queue.push(idx + w);
      }
    }

    if (smooth) {
      const result = new Uint8ClampedArray(data);
      for (let i = 0; i < w * h; i++) {
        if (data[i*4+3] === 0) {
          const x = i % w, y = Math.floor(i / w);
          let opaqueNeighbors = 0;
          for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nx = x+dx, ny = y+dy;
            if (nx>=0 && nx<w && ny>=0 && ny<h) {
              if (data[(ny*w+nx)*4+3] > 0) opaqueNeighbors++;
            }
          }
          if (opaqueNeighbors > 0) result[i*4+3] = Math.round(128 * opaqueNeighbors / 4);
        }
      }
      tmpCtx.putImageData(new ImageData(result, w, h), 0, 0);
    } else {
      tmpCtx.putImageData(imgData, 0, 0);
    }

    return tmpC;
  }

  function buildBgPanel() {
    panel.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px';
    wrap.innerHTML = `
      <div style="font-size:12px;color:var(--text-muted);line-height:1.6">
        Elimina el fondo de la imagen basándose en color. Mejor con fondos uniformes.
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:6px">TOLERANCIA</label>
        <input type="range" id="pe-bg-tol" min="10" max="120" value="40" style="width:100%">
        <span id="pe-bg-tol-val" style="font-size:12px;color:var(--text-muted)">40</span>
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="pe-bg-smooth" checked>
        Suavizar bordes (anti-aliasing)
      </label>
      <button class="btn btn-sm btn-primary" id="pe-bg-remove">✂️ Eliminar fondo</button>
      <button class="btn btn-sm btn-secondary" id="pe-bg-reset" style="display:${state.bgRemoved ? 'block' : 'none'}">↩ Restaurar fondo</button>
      <div id="pe-bg-info" style="font-size:12px;color:var(--text-muted)">
        El resultado se exporta como PNG con transparencia.
      </div>
    `;
    panel.appendChild(wrap);

    const tolInput = wrap.querySelector('#pe-bg-tol');
    const tolVal   = wrap.querySelector('#pe-bg-tol-val');
    tolInput.addEventListener('input', () => { tolVal.textContent = tolInput.value; });

    wrap.querySelector('#pe-bg-remove').addEventListener('click', async () => {
      const btn = wrap.querySelector('#pe-bg-remove');
      btn.disabled = true;
      btn.textContent = '⏳ Procesando…';
      await new Promise(r => setTimeout(r, 50)); // allow repaint before heavy BFS
      const tolerance = parseInt(tolInput.value);
      const smooth    = wrap.querySelector('#pe-bg-smooth').checked;
      try {
        state.bgRemoved = _removeBg(srcImg, tolerance, smooth);
        setDirty();
        scheduleRender();
        wrap.querySelector('#pe-bg-reset').style.display = 'block';
        showToast('✅ Fondo eliminado — exporta como PNG para transparencia');
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '✂️ Eliminar fondo';
      }
    });

    wrap.querySelector('#pe-bg-reset').addEventListener('click', () => {
      state.bgRemoved = null;
      scheduleRender();
      wrap.querySelector('#pe-bg-reset').style.display = 'none';
      showToast('Fondo restaurado');
    });
  }

  // ── Elements layer ────────────────────────────────────────────────────────
  const ELEMENT_EMOJIS = ['❤️','⭐','🔥','✨','💎','🎯','🎵','📸','🌟','💪','🎬','🏆','👑','🌈','🚀','💫','🎨','🎭','🌺','🦋','⚡','🎪','🔮','💣','🎸','🎤'];
  const SHAPES = [
    { id:'circle',  label:'⭕ Círculo' },
    { id:'rect',    label:'▪ Rect' },
    { id:'star',    label:'⭐ Estrella' },
    { id:'heart',   label:'❤️ Corazón' },
    { id:'hexagon', label:'⬡ Hexágono' },
    { id:'arrow',   label:'➡ Flecha' },
  ];

  let _pendingElementType = 'text';  // for click-to-place
  let _pendingShape = 'circle';

  function _drawShape(targetCtx, elObj) {
    const size = (elObj.fontSize || 80) * elObj.scale;
    const r = size / 2;
    targetCtx.fillStyle   = elObj.color;
    targetCtx.strokeStyle = elObj.strokeColor || '#000';
    targetCtx.lineWidth   = elObj.strokeWidth || 0;

    if (elObj.content === 'circle') {
      targetCtx.beginPath();
      targetCtx.arc(0, 0, r, 0, Math.PI * 2);
      targetCtx.fill();
      if (elObj.strokeWidth > 0) targetCtx.stroke();
    } else if (elObj.content === 'rect') {
      targetCtx.fillRect(-r, -r, size, size);
      if (elObj.strokeWidth > 0) targetCtx.strokeRect(-r, -r, size, size);
    } else if (elObj.content === 'star') {
      targetCtx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const rad2  = i % 2 === 0 ? r : r * 0.4;
        const x = Math.cos(angle) * rad2;
        const y = Math.sin(angle) * rad2;
        i === 0 ? targetCtx.moveTo(x, y) : targetCtx.lineTo(x, y);
      }
      targetCtx.closePath();
      targetCtx.fill();
      if (elObj.strokeWidth > 0) targetCtx.stroke();
    } else if (elObj.content === 'heart') {
      targetCtx.beginPath();
      targetCtx.moveTo(0, r * 0.3);
      targetCtx.bezierCurveTo(-r, -r * 0.3, -r, r * 0.6, 0, r);
      targetCtx.bezierCurveTo(r, r * 0.6, r, -r * 0.3, 0, r * 0.3);
      targetCtx.fill();
      if (elObj.strokeWidth > 0) targetCtx.stroke();
    } else if (elObj.content === 'hexagon') {
      targetCtx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 - Math.PI / 6;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        i === 0 ? targetCtx.moveTo(x, y) : targetCtx.lineTo(x, y);
      }
      targetCtx.closePath();
      targetCtx.fill();
      if (elObj.strokeWidth > 0) targetCtx.stroke();
    } else if (elObj.content === 'arrow') {
      const aw = size * 0.6, ah = size * 0.35, shaft = size * 0.25;
      targetCtx.beginPath();
      targetCtx.moveTo(-r, -shaft / 2);
      targetCtx.lineTo(r - aw * 0.5, -shaft / 2);
      targetCtx.lineTo(r - aw * 0.5, -ah / 2);
      targetCtx.lineTo(r, 0);
      targetCtx.lineTo(r - aw * 0.5, ah / 2);
      targetCtx.lineTo(r - aw * 0.5, shaft / 2);
      targetCtx.lineTo(-r, shaft / 2);
      targetCtx.closePath();
      targetCtx.fill();
      if (elObj.strokeWidth > 0) targetCtx.stroke();
    }
  }

  function _renderElements(targetCanvas, w, h) {
    if (!targetCanvas) return;
    targetCanvas.width  = w;
    targetCanvas.height = h;
    const eCtx = targetCanvas.getContext('2d');
    eCtx.clearRect(0, 0, w, h);
    for (let i = 0; i < state.elements.length; i++) {
      const elObj = state.elements[i];
      const px = elObj.x * w;
      const py = elObj.y * h;
      eCtx.save();
      eCtx.translate(px, py);
      eCtx.rotate(elObj.rotation * Math.PI / 180);
      eCtx.scale(elObj.scale, elObj.scale);

      if (elObj.shadow) {
        eCtx.shadowColor   = 'rgba(0,0,0,0.7)';
        eCtx.shadowBlur    = 8;
        eCtx.shadowOffsetX = 2;
        eCtx.shadowOffsetY = 2;
      }

      if (elObj.type === 'text') {
        eCtx.font         = `bold ${elObj.fontSize}px ${elObj.font || 'sans-serif'}`;
        eCtx.fillStyle    = elObj.color;
        eCtx.textAlign    = 'center';
        eCtx.textBaseline = 'middle';
        if (elObj.letterSpacing) {
          try { eCtx.letterSpacing = elObj.letterSpacing + 'px'; } catch (_) {}
        }
        if (elObj.vertical) {
          const chars = [...(elObj.content || '')];
          const lineH = elObj.fontSize * 1.2;
          const totalH = chars.length * lineH;
          chars.forEach((ch, ci) => {
            eCtx.fillText(ch, 0, ci * lineH - totalH / 2 + lineH / 2);
          });
        } else {
          eCtx.fillText(elObj.content, 0, 0);
        }
        try { eCtx.letterSpacing = '0px'; } catch (_) {}
      } else if (elObj.type === 'emoji') {
        eCtx.font         = `${elObj.fontSize}px serif`;
        eCtx.textAlign    = 'center';
        eCtx.textBaseline = 'middle';
        eCtx.fillText(elObj.content, 0, 0);
      } else if (elObj.type === 'shape') {
        _drawShape(eCtx, elObj);
      }

      // Selection handle
      if (i === state.selectedElement) {
        eCtx.shadowColor = 'transparent';
        eCtx.shadowBlur  = 0;
        eCtx.strokeStyle = '#00D2FF';
        eCtx.lineWidth   = 2 / elObj.scale;
        eCtx.setLineDash([5, 3]);
        const size = (elObj.fontSize || elObj.scale * 80);
        eCtx.strokeRect(-size/2, -size/2, size, size);
        eCtx.setLineDash([]);
      }

      eCtx.restore();
    }
  }

  function _refreshElementList() {
    const listDiv = panel.querySelector('#el-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    state.elements.forEach((elObj, i) => {
      const item = document.createElement('div');
      item.style.cssText = `display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;
        background:var(--bg-3);cursor:pointer;border:1px solid ${i === state.selectedElement ? 'var(--accent)' : 'transparent'};`;
      const icon = elObj.type === 'text' ? 'T' : elObj.type === 'emoji' ? elObj.content : '◼';
      const preview = elObj.type === 'text' ? elObj.content.slice(0, 12) : elObj.content;
      const editBtn = elObj.type === 'text'
        ? `<button data-edit="${i}" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:13px;padding:2px" title="Editar texto">✏</button>`
        : '';
      item.innerHTML = `
        <span style="font-size:13px;min-width:18px;text-align:center">${icon}</span>
        <span style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted)">${esc(preview)}</span>
        ${editBtn}
        <button data-scale="0.8"  style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;padding:2px" title="Reducir">🔽</button>
        <button data-scale="1.25" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;padding:2px" title="Agrandar">🔼</button>
        <button data-rot="-15" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:2px">↩</button>
        <button data-rot="15"  style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:2px">↻</button>
        <button data-del="${i}"  style="background:none;border:none;color:#FF5555;cursor:pointer;font-size:14px;padding:2px">✕</button>
      `;
      item.addEventListener('click', e => {
        if (e.target.dataset.edit !== undefined) {
          const idx = parseInt(e.target.dataset.edit);
          const el2 = state.elements[idx];
          const newText = prompt('Editar texto:', el2.content);
          if (newText !== null) {
            _pushUndo();
            el2.content = newText;
            setDirty();
            _refreshElementList();
            _renderElements(elemCanvas, canvas.width, canvas.height);
          }
          return;
        }
        if (e.target.dataset.del !== undefined) {
          _pushUndo();
          const idx = parseInt(e.target.dataset.del);
          state.elements.splice(idx, 1);
          if (state.selectedElement >= state.elements.length) state.selectedElement = null;
          setDirty();
          _refreshElementList();
          _renderElements(elemCanvas, canvas.width, canvas.height);
          return;
        }
        if (e.target.dataset.scale !== undefined) {
          _pushUndo();
          state.elements[i].scale = Math.max(0.1, Math.min(10, state.elements[i].scale * parseFloat(e.target.dataset.scale)));
          setDirty();
          _refreshElementList();
          _renderElements(elemCanvas, canvas.width, canvas.height);
          return;
        }
        if (e.target.dataset.rot !== undefined) {
          _pushUndo();
          const deg = parseInt(e.target.dataset.rot);
          state.elements[i].rotation = (state.elements[i].rotation + deg + 360) % 360;
          setDirty();
          _refreshElementList();
          _renderElements(elemCanvas, canvas.width, canvas.height);
          return;
        }
        state.selectedElement = i;
        _refreshElementList();
        _renderElements(elemCanvas, canvas.width, canvas.height);
      });
      listDiv.appendChild(item);
    });
  }

  // Element canvas mouse interaction
  let _elemDragging = null;

  elemCanvas.addEventListener('mousedown', e => {
    if (state.tab !== 'elements') return;
    const rect = elemCanvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top)  / rect.height;

    // Check if clicking on an existing element
    let hitIdx = null;
    for (let i = state.elements.length - 1; i >= 0; i--) {
      const elObj = state.elements[i];
      const dx = Math.abs(nx - elObj.x) * canvas.width;
      const dy = Math.abs(ny - elObj.y) * canvas.height;
      const sz = (elObj.fontSize || 80) / 2 + 10;
      if (dx < sz && dy < sz) { hitIdx = i; break; }
    }

    if (hitIdx !== null) {
      state.selectedElement = hitIdx;
      _elemDragging = { idx: hitIdx, startNx: nx, startNy: ny,
        ox: state.elements[hitIdx].x, oy: state.elements[hitIdx].y };
      _refreshElementList();
      _renderElements(elemCanvas, canvas.width, canvas.height);
    } else {
      // Place new element
      state.selectedElement = null;
    }
  });

  elemCanvas.addEventListener('dblclick', e => {
    if (state.tab !== 'elements' || state.selectedElement === null) return;
    const elObj = state.elements[state.selectedElement];
    const newRot = prompt('Rotación (0-360°):', elObj.rotation);
    if (newRot !== null) {
      elObj.rotation = ((parseInt(newRot) || 0) + 360) % 360;
      setDirty();
      _renderElements(elemCanvas, canvas.width, canvas.height);
      _refreshElementList();
    }
  });

  elemCanvas.addEventListener('mousemove', e => {
    if (!_elemDragging) return;
    const rect = elemCanvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top)  / rect.height;
    const elObj = state.elements[_elemDragging.idx];
    elObj.x = Math.max(0, Math.min(1, _elemDragging.ox + (nx - _elemDragging.startNx)));
    elObj.y = Math.max(0, Math.min(1, _elemDragging.oy + (ny - _elemDragging.startNy)));
    _renderElements(elemCanvas, canvas.width, canvas.height);
  });

  elemCanvas.addEventListener('mouseup', () => { _elemDragging = null; });
  elemCanvas.addEventListener('mouseleave', () => { _elemDragging = null; });

  function buildElementsPanel() {
    panel.innerHTML = '';

    // Sub-tab state
    let activeSubTab = 'text';
    let selectedShape = 'circle';
    let selectedEmoji = '❤️';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:14px';

    // Sub-tab bar
    const subBar = document.createElement('div');
    subBar.style.cssText = 'display:flex;gap:6px';
    const SUB_TABS = [
      { id:'text', label:'T Texto' },
      { id:'shape', label:'◼ Formas' },
      { id:'emoji', label:'😀 Emoji' },
    ];
    SUB_TABS.forEach(st => {
      const btn = document.createElement('button');
      btn.className = 'pe-tab' + (st.id === activeSubTab ? ' active' : '');
      btn.id = `el-sub-${st.id}`;
      btn.textContent = st.label;
      btn.addEventListener('click', () => {
        activeSubTab = st.id;
        subBar.querySelectorAll('.pe-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        textPanel.style.display  = st.id === 'text'  ? '' : 'none';
        shapePanel.style.display = st.id === 'shape' ? '' : 'none';
        emojiPanel.style.display = st.id === 'emoji' ? '' : 'none';
      });
      subBar.appendChild(btn);
    });
    wrap.appendChild(subBar);

    // ── Text sub-panel ──
    const textPanel = document.createElement('div');
    textPanel.id = 'el-panel-text';
    textPanel.innerHTML = `
      <input type="text" class="form-control" id="el-text-inp" placeholder="Escribe aquí..." style="width:100%;margin-bottom:8px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div>
          <label style="font-size:11px;color:var(--text-muted)">Color</label>
          <input type="color" id="el-text-color" value="#ffffff" style="width:100%;height:36px;border-radius:6px;border:none">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text-muted)">Fuente</label>
          <select id="el-text-font" class="form-control" style="font-size:11px;width:100%">
            ${['Arial','Arial Black','Georgia','Impact','Verdana','Courier New','Times New Roman'].map(f=>`<option>${f}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <label style="font-size:11px;color:var(--text-muted);flex:1">Tamaño</label>
          <span id="el-font-size-val" style="font-size:11px;color:var(--text-muted);min-width:36px;text-align:right">40px</span>
        </div>
        <input type="range" id="el-font-size" min="12" max="300" value="40" style="width:100%">
      </div>
      <div style="margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <label style="font-size:11px;color:var(--text-muted);flex:1">Espaciado letras</label>
          <span id="el-letter-spacing-val" style="font-size:11px;color:var(--text-muted);min-width:36px;text-align:right">0px</span>
        </div>
        <input type="range" id="el-letter-spacing" min="0" max="30" value="0" style="width:100%">
      </div>
      <div style="display:flex;gap:10px;margin-bottom:8px">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="el-text-shadow"> Sombra
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" id="el-text-vertical"> Vertical
        </label>
      </div>
      <button class="btn btn-sm btn-primary" id="el-add-text" style="width:100%">➕ Agregar texto</button>
    `;
    textPanel.querySelector('#el-font-size').addEventListener('input', e => {
      textPanel.querySelector('#el-font-size-val').textContent = e.target.value + 'px';
    });
    textPanel.querySelector('#el-letter-spacing').addEventListener('input', e => {
      textPanel.querySelector('#el-letter-spacing-val').textContent = e.target.value + 'px';
    });
    wrap.appendChild(textPanel);

    // ── Shape sub-panel ──
    const shapePanel = document.createElement('div');
    shapePanel.id = 'el-panel-shape';
    shapePanel.style.display = 'none';

    const shapeGrid = document.createElement('div');
    shapeGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px';
    SHAPES.forEach(sh => {
      const btn = document.createElement('button');
      btn.className = 'pe-preset-platform' + (sh.id === selectedShape ? ' active' : '');
      btn.textContent = sh.label;
      btn.addEventListener('click', () => {
        selectedShape = sh.id;
        shapeGrid.querySelectorAll('.pe-preset-platform').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      shapeGrid.appendChild(btn);
    });
    shapePanel.appendChild(shapeGrid);
    // FIX: use appendChild to not destroy shapeGrid event listeners
    const shapeControls = document.createElement('div');
    shapeControls.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div><label style="font-size:11px;color:var(--text-muted)">Relleno</label>
             <input type="color" id="el-shape-color" value="#ffffff" style="width:100%;height:36px;border-radius:6px;border:none"></div>
        <div>
          <div style="display:flex;justify-content:space-between">
            <label style="font-size:11px;color:var(--text-muted)">Tamaño</label>
            <span id="el-shape-size-val" style="font-size:11px;color:var(--text-muted)">80px</span>
          </div>
          <input type="range" id="el-shape-size" min="20" max="300" value="80" style="width:100%">
        </div>
      </div>
      <div><label style="font-size:11px;color:var(--text-muted);margin-bottom:4px;display:block">Borde</label>
           <input type="range" id="el-shape-stroke" min="0" max="20" value="0" style="width:100%"></div>
      <button class="btn btn-sm btn-primary" id="el-add-shape" style="width:100%;margin-top:8px">➕ Agregar forma</button>
    `;
    shapeControls.querySelector('#el-shape-size').addEventListener('input', e => {
      shapeControls.querySelector('#el-shape-size-val').textContent = e.target.value + 'px';
    });
    shapePanel.appendChild(shapeControls);
    wrap.appendChild(shapePanel);

    // ── Emoji sub-panel ──
    const emojiPanel = document.createElement('div');
    emojiPanel.id = 'el-panel-emoji';
    emojiPanel.style.display = 'none';
    const emojiGrid = document.createElement('div');
    emojiGrid.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-bottom:10px;max-height:160px;overflow-y:auto';
    emojiGrid.id = 'el-emoji-grid';
    ELEMENT_EMOJIS.forEach(em => {
      const btn = document.createElement('button');
      btn.style.cssText = 'background:var(--bg-3);border:1px solid transparent;border-radius:6px;font-size:20px;cursor:pointer;padding:4px;';
      btn.textContent = em;
      btn.addEventListener('click', () => {
        selectedEmoji = em;
        emojiGrid.querySelectorAll('button').forEach(b => b.style.borderColor = 'transparent');
        btn.style.borderColor = 'var(--accent)';
        btn.style.background = 'rgba(var(--accent-rgb,0,210,255),.18)';
        const customInp = emojiPanel.querySelector('#el-emoji-custom');
        if (customInp) customInp.value = em;
        const prev = emojiPanel.querySelector('#el-emoji-preview');
        if (prev) prev.textContent = em;
      });
      emojiGrid.appendChild(btn);
    });
    // Preview of currently selected emoji (shown above grid)
    const emojiPreview = document.createElement('div');
    emojiPreview.id = 'el-emoji-preview';
    emojiPreview.style.cssText = 'text-align:center;font-size:44px;line-height:64px;height:64px;border:1px dashed rgba(255,255,255,.15);border-radius:8px;background:var(--bg-3);margin-bottom:8px';
    emojiPreview.textContent = selectedEmoji;
    emojiPanel.appendChild(emojiPreview);
    emojiPanel.appendChild(emojiGrid);
    // FIX: use appendChild to not destroy emojiGrid event listeners
    const emojiControls = document.createElement('div');
    emojiControls.innerHTML = `
      <input type="text" class="form-control" id="el-emoji-custom" placeholder="Pega tu emoji..." style="width:100%;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <label style="font-size:11px;color:var(--text-muted);white-space:nowrap">Tamaño</label>
        <input type="range" id="el-emoji-size" min="20" max="200" value="60" style="flex:1">
        <span id="el-emoji-size-val" style="font-size:11px;color:var(--text-muted);min-width:30px">60px</span>
      </div>
      <button class="btn btn-sm btn-primary" id="el-add-emoji" style="width:100%">➕ Agregar emoji</button>
    `;
    emojiPanel.appendChild(emojiControls);
    emojiControls.querySelector('#el-emoji-size').addEventListener('input', e => {
      emojiControls.querySelector('#el-emoji-size-val').textContent = e.target.value + 'px';
    });
    wrap.appendChild(emojiPanel);

    // ── Element list ──
    const listSection = document.createElement('div');
    listSection.style.cssText = 'border-top:1px solid rgba(255,255,255,.08);padding-top:12px';
    listSection.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px">ELEMENTOS EN CANVAS</div>
      <div id="el-list" style="display:flex;flex-direction:column;gap:4px;max-height:120px;overflow-y:auto"></div>
      <button class="btn btn-sm btn-secondary" id="el-clear-all" style="width:100%;margin-top:8px">🗑 Limpiar todo</button>
    `;
    wrap.appendChild(listSection);
    panel.appendChild(wrap);

    // Wire text add
    wrap.querySelector('#el-add-text').addEventListener('click', () => {
      const content       = wrap.querySelector('#el-text-inp').value.trim() || 'Texto';
      const fontSize      = parseInt(wrap.querySelector('#el-font-size').value);
      const color         = wrap.querySelector('#el-text-color').value;
      const shadow        = wrap.querySelector('#el-text-shadow').checked;
      const vertical      = wrap.querySelector('#el-text-vertical').checked;
      const letterSpacing = parseInt(wrap.querySelector('#el-letter-spacing').value) || 0;
      const font          = wrap.querySelector('#el-text-font').value || 'Arial';
      _pushUndo();
      state.elements.push({
        type: 'text', x: 0.5, y: 0.5, rotation: 0, scale: 1,
        content, color, fontSize, font, strokeColor: '#000000', strokeWidth: 0, shadow, vertical, letterSpacing,
      });
      state.selectedElement = state.elements.length - 1;
      setDirty();
      _refreshElementList();
      _renderElements(elemCanvas, canvas.width, canvas.height);
    });

    // Wire shape add
    shapePanel.querySelector('#el-add-shape').addEventListener('click', () => {
      const color       = shapePanel.querySelector('#el-shape-color').value;
      const fontSize    = parseInt(shapePanel.querySelector('#el-shape-size').value);
      const strokeWidth = parseInt(shapePanel.querySelector('#el-shape-stroke').value);
      _pushUndo();
      state.elements.push({
        type: 'shape', x: 0.5, y: 0.5, rotation: 0, scale: 1,
        content: selectedShape, color, fontSize, strokeColor: '#000000', strokeWidth, shadow: false,
      });
      state.selectedElement = state.elements.length - 1;
      setDirty();
      _refreshElementList();
      _renderElements(elemCanvas, canvas.width, canvas.height);
    });

    // Wire emoji add
    emojiPanel.querySelector('#el-add-emoji').addEventListener('click', () => {
      const content  = emojiPanel.querySelector('#el-emoji-custom').value.trim() || selectedEmoji;
      const fontSize = parseInt(emojiPanel.querySelector('#el-emoji-size').value);
      _pushUndo();
      state.elements.push({
        type: 'emoji', x: 0.5, y: 0.5, rotation: 0, scale: 1,
        content, color: '#ffffff', fontSize, strokeColor: '#000000', strokeWidth: 0, shadow: false,
      });
      state.selectedElement = state.elements.length - 1;
      setDirty();
      _refreshElementList();
      _renderElements(elemCanvas, canvas.width, canvas.height);
    });

    // Wire clear all
    wrap.querySelector('#el-clear-all').addEventListener('click', () => {
      _pushUndo();
      state.elements = [];
      state.selectedElement = null;
      setDirty();
      _refreshElementList();
      _renderElements(elemCanvas, canvas.width, canvas.height);
    });

    // Populate list
    _refreshElementList();
  }

  // ── AI image editing panel ────────────────────────────────────────────────
  if (!state.aiHistory) state.aiHistory = [];

  function _renderAiHistory(container) {
    let histDiv = container.querySelector('#pe-ai-history');
    if (!histDiv) {
      histDiv = document.createElement('div');
      histDiv.id = 'pe-ai-history';
      container.appendChild(histDiv);
    }
    histDiv.innerHTML = '';
    if (!state.aiHistory.length) return;
    const header = document.createElement('div');
    header.style.cssText = 'border-top:1px solid rgba(255,255,255,.08);padding-top:12px;margin-top:4px';
    header.innerHTML = '<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px;letter-spacing:.6px">HISTORIAL IA</div>';
    histDiv.appendChild(header);
    state.aiHistory.forEach((item, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;border-radius:8px;background:var(--bg-3);padding:8px';
      row.innerHTML = `
        <img src="${item.imageDataUrl}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;flex-shrink:0;cursor:pointer" title="Ver original">
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.prompt)}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${esc(item.provider)} · ${item.timestamp}</div>
          <button class="btn btn-sm btn-primary" data-idx="${i}" style="margin-top:4px;font-size:11px;padding:3px 8px">↑ Usar esta</button>
        </div>
      `;
      row.querySelector('[data-idx]').addEventListener('click', () => {
        const img = new Image();
        img.onload = () => { srcImg.src = item.imageDataUrl; setDirty(); scheduleRender(); showToast('✅ Imagen IA cargada en el editor'); };
        img.src = item.imageDataUrl;
      });
      header.appendChild(row);
    });
  }

  async function buildAiPanel() {
    panel.innerHTML = '';
    const base  = (typeof API.getBase === 'function') ? API.getBase() : 'http://127.0.0.1:3026';
    const token = window.playcamAuthToken || (() => { try { return JSON.parse(localStorage.getItem('auth_session') || 'null')?.token; } catch(_){return null;} })();

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px';
    wrap.innerHTML = `
      <div style="font-size:12px;color:var(--text-muted);line-height:1.6">
        Edita la imagen con IA. El proveedor se configura en <strong>Ajustes → IA</strong>.
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:6px">PROVEEDOR</label>
        <select id="pe-ai-provider" class="form-control" style="font-size:12px">
          <option value="openai">🤖 OpenAI (DALL-E)</option>
          <option value="stability">🎨 Stability AI</option>
          <option value="replicate">⚡ Replicate (Flux)</option>
        </select>
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:6px">PROMPT</label>
        <textarea id="pe-ai-prompt" class="form-control" rows="3"
          placeholder="Ej: Cambia el cielo a dramático, elimina el objeto de la izquierda, agrega niebla..."
          style="width:100%;resize:vertical;font-size:12px;line-height:1.5"></textarea>
      </div>
      <div>
        <label style="font-size:11px;color:var(--text-muted)">Intensidad: <span id="pe-ai-strength-val">35%</span></label>
        <input type="range" id="pe-ai-strength" min="10" max="100" value="35" style="width:100%">
      </div>
      <button class="btn btn-primary" id="pe-ai-generate" style="width:100%;padding:10px;font-weight:700">🤖 Generar con IA</button>
      <div id="pe-ai-status" style="font-size:12px;color:var(--text-muted);text-align:center;min-height:18px"></div>
    `;
    panel.appendChild(wrap);

    wrap.querySelector('#pe-ai-strength').addEventListener('input', e => {
      wrap.querySelector('#pe-ai-strength-val').textContent = e.target.value + '%';
    });

    wrap.querySelector('#pe-ai-generate').addEventListener('click', async () => {
      const prompt   = wrap.querySelector('#pe-ai-prompt').value.trim();
      const provider = wrap.querySelector('#pe-ai-provider').value;
      const strength = parseInt(wrap.querySelector('#pe-ai-strength').value) / 100;
      const btn      = wrap.querySelector('#pe-ai-generate');
      const status   = wrap.querySelector('#pe-ai-status');
      if (!prompt) { showToast('Escribe un prompt', 'error'); return; }

      btn.disabled = true;
      btn.textContent = '⏳ Generando…';
      status.textContent = 'Enviando imagen al proveedor de IA…';
      try {
        const blob    = await _renderToBlob('image/png', 0.85);
        const dataUrl = await new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(blob); });
        const resp = await fetch(`${base}/api/ai/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          body: JSON.stringify({ prompt, provider, imageDataUrl: dataUrl, strength }),
        });
        const result = await resp.json();
        if (!resp.ok || result.error) throw new Error(result.error || 'Error en IA');
        state.aiHistory.unshift({ prompt, provider, imageDataUrl: result.imageDataUrl, timestamp: new Date().toLocaleTimeString() });
        status.textContent = '✅ Generado — ver historial abajo';
        showToast('✅ IA generó una imagen');
        _renderAiHistory(panel);
      } catch (err) {
        status.textContent = '❌ ' + err.message;
        showToast('Error IA: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '🤖 Generar con IA';
      }
    });

    if (state.aiHistory.length > 0) _renderAiHistory(panel);
  }

  // ── MutationObserver: cleanup on el removal ───────────────────────────────
  const _cleanupObserver = new MutationObserver(() => {
    if (!document.body.contains(el)) {
      _cleanupObserver.disconnect();
      store.navigate = _origNavigate;
      if (renderRaf) { cancelAnimationFrame(renderRaf); renderRaf = null; }
    }
  });
  _cleanupObserver.observe(document.body, { childList: true, subtree: true });

  // ── Initial render ────────────────────────────────────────────────────────
  renderPanel();

  if (srcImg.complete && srcImg.naturalWidth) {
    scheduleRender();
  } else {
    srcImg.onload = () => scheduleRender();
    srcImg.onerror = () => showToast('Error cargando imagen', 'error');
  }
}
