/**
 * Photo Editor — Rotate, resize, crop, and apply effects to photos.
 *
 * Tabs: Transform (rotate + resize) | Crop (interactive) | Effects (filters)
 * Live preview uses CSS filters; all edits are applied server-side on save via Sharp.
 */
import API   from '../../../../src/renderer/utils/api.js';
import store  from '../../../../src/renderer/store.js';
import { viewHeader } from '../../../../src/renderer/components/ui.js';
import { showToast }  from '../../../../src/renderer/components/Modal.js';
import { esc }        from '../../../../src/renderer/utils/html.js';

export async function renderPhotoEditor(el, extra) {
  const mediaId = extra?.id;
  if (!mediaId) { el.innerHTML = '<p style="color:var(--text-muted)">No media selected</p>'; return; }

  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Loading…</div>';

  try {
    const media = await API.media.get(mediaId);
    const origW = media.width  || 1920;
    const origH = media.height || 1080;
    const aspect = origH / origW;

    const state = {
      rotation: 0,
      resize:  { w: origW, h: origH, lock: true },
      crop:    null,   // { x, y, w, h } in original pixels
      effects: { brightness: 1, contrast: 1, saturation: 1, blur: 0, sharpen: 0, grayscale: false, invert: false },
      tab:     'transform',
    };

    // ── Shell ─────────────────────────────────────────────────────────────────
    el.innerHTML = '';
    el.insertAdjacentHTML('beforeend', viewHeader(
      `✏️ ${esc(media.file_name)}`,
      `<button class="btn btn-sm btn-secondary" id="pe-back">← Back</button>
       <button class="btn btn-sm btn-secondary" id="pe-reset">↺ Reset all</button>
       <button class="btn btn-sm btn-primary"   id="pe-save">💾 Save</button>`,
    ));
    el.querySelector('#pe-back').addEventListener('click', () => store.navigate('starcho:gallery'));

    const layout = document.createElement('div');
    layout.style.cssText = `
      display:grid;grid-template-columns:1fr 288px;gap:20px;margin-top:20px;
    `;
    el.appendChild(layout);

    // ── Preview area ──────────────────────────────────────────────────────────
    const previewBox = document.createElement('div');
    previewBox.style.cssText = `
      background:#0a0a0a;border-radius:var(--radius-md);
      display:flex;align-items:center;justify-content:center;
      min-height:420px;position:relative;overflow:hidden;
    `;

    const imgWrapper = document.createElement('div');
    imgWrapper.style.cssText = 'position:relative;display:inline-block;line-height:0;';

    const img = document.createElement('img');
    img.src = API.mediaViewUrl(mediaId);
    img.style.cssText = 'max-width:100%;max-height:520px;object-fit:contain;display:block;transition:filter .15s,transform .25s;';
    imgWrapper.appendChild(img);
    previewBox.appendChild(imgWrapper);
    layout.appendChild(previewBox);

    // Crop overlay (created/destroyed when switching to Crop tab)
    let cropUI = null;

    // ── Sidebar ───────────────────────────────────────────────────────────────
    const sidebar = document.createElement('div');
    sidebar.style.cssText = `
      background:var(--bg-3);border-radius:var(--radius-md);padding:16px;
      display:flex;flex-direction:column;gap:0;overflow-y:auto;max-height:580px;
    `;
    layout.appendChild(sidebar);

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:16px;';
    tabBar.innerHTML = `
      <button class="pe-tab" data-tab="transform">Transform</button>
      <button class="pe-tab" data-tab="crop">Crop</button>
      <button class="pe-tab" data-tab="effects">Effects</button>
    `;
    sidebar.appendChild(tabBar);

    const panel = document.createElement('div');
    panel.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
    sidebar.appendChild(panel);

    // ── Tab renderer ──────────────────────────────────────────────────────────
    function switchTab(tab) {
      if (state.tab === 'crop' && tab !== 'crop') destroyCrop();
      state.tab = tab;

      tabBar.querySelectorAll('.pe-tab').forEach(b => {
        const on = b.dataset.tab === tab;
        b.style.cssText = `
          padding:6px 2px;font-size:11px;font-weight:700;letter-spacing:.5px;
          border-radius:var(--radius-sm);border:none;cursor:pointer;
          background:${on ? 'var(--accent)' : 'var(--bg-2)'};
          color:${on ? '#fff' : 'var(--text-muted)'};
        `;
      });

      panel.innerHTML = '';
      if (tab === 'transform') buildTransformTab();
      else if (tab === 'crop') buildCropTab();
      else buildEffectsTab();
    }

    tabBar.addEventListener('click', e => {
      const t = e.target.closest('.pe-tab')?.dataset.tab;
      if (t) switchTab(t);
    });

    // ── Transform tab ─────────────────────────────────────────────────────────
    function buildTransformTab() {
      // Rotate
      const rs = _sec('ROTATE');
      const rb = _row();
      ['↺ 90°L', '↻ 90°R', '180°'].forEach((lbl, i) => {
        const btn = _btn(lbl);
        btn.addEventListener('click', () => {
          state.rotation = (state.rotation + [-90, 90, 180][i] + 360) % 360;
          refreshPreview();
        });
        rb.appendChild(btn);
      });
      rs.appendChild(rb);
      panel.appendChild(rs);

      // Resize — inline form groups, no _field helper needed
      const rz = _sec('RESIZE');
      rz.insertAdjacentHTML('beforeend', `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:11px;color:var(--text-muted);">Width</label>
            <div style="display:flex;align-items:center;gap:6px;">
              <input id="pe-rw" type="number" class="form-control" style="flex:1;min-width:0;"
                     min="10" max="${origW * 4}" value="${state.resize.w}">
              <span style="font-size:11px;color:var(--text-muted);">px</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:11px;color:var(--text-muted);">Height</label>
            <div style="display:flex;align-items:center;gap:6px;">
              <input id="pe-rh" type="number" class="form-control" style="flex:1;min-width:0;"
                     min="10" max="${origH * 4}" value="${state.resize.h}">
              <span style="font-size:11px;color:var(--text-muted);">px</span>
            </div>
          </div>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted);cursor:pointer;">
            <input type="checkbox" id="pe-lock" ${state.resize.lock ? 'checked' : ''}> Lock aspect ratio
          </label>
        </div>
      `);
      panel.appendChild(rz);

      const wInp   = rz.querySelector('#pe-rw');
      const hInp   = rz.querySelector('#pe-rh');
      const lockChk = rz.querySelector('#pe-lock');

      lockChk.addEventListener('change', () => { state.resize.lock = lockChk.checked; });
      wInp.addEventListener('input', () => {
        state.resize.w = parseInt(wInp.value) || origW;
        if (state.resize.lock) { state.resize.h = Math.round(state.resize.w * aspect); hInp.value = state.resize.h; }
      });
      hInp.addEventListener('input', () => {
        state.resize.h = parseInt(hInp.value) || origH;
        if (state.resize.lock) { state.resize.w = Math.round(state.resize.h / aspect); wInp.value = state.resize.w; }
      });

      // Info
      const info = document.createElement('div');
      info.style.cssText = 'font-size:11px;color:var(--text-muted);line-height:1.7;';
      info.innerHTML = `Original: ${origW} × ${origH} px<br>${_fmtBytes(media.file_size)}`;
      panel.appendChild(info);
    }

    // ── Crop tab ──────────────────────────────────────────────────────────────
    function buildCropTab() {
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:11px;color:var(--text-muted);line-height:1.5;padding:8px;background:var(--bg-2);border-radius:var(--radius-sm);';
      hint.textContent = 'Drag on the image to select a crop region. Drag corners to resize.';
      panel.appendChild(hint);

      const cs = _sec('CROP REGION');
      cs.insertAdjacentHTML('beforeend', `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          ${_inpHtml('X', 'pe-cx', state.crop?.x ?? 0)}
          ${_inpHtml('Y', 'pe-cy', state.crop?.y ?? 0)}
          ${_inpHtml('W', 'pe-cw', state.crop?.w ?? origW)}
          ${_inpHtml('H', 'pe-ch', state.crop?.h ?? origH)}
        </div>
      `);
      panel.appendChild(cs);

      // Sync text inputs → overlay
      ['pe-cx','pe-cy','pe-cw','pe-ch'].forEach(id => {
        cs.querySelector(`#${id}`)?.addEventListener('input', () => {
          state.crop = {
            x: parseInt(cs.querySelector('#pe-cx').value) || 0,
            y: parseInt(cs.querySelector('#pe-cy').value) || 0,
            w: Math.max(1, parseInt(cs.querySelector('#pe-cw').value) || 1),
            h: Math.max(1, parseInt(cs.querySelector('#pe-ch').value) || 1),
          };
          redrawCropRect();
        });
      });

      const clearBtn = _btn('✕ Clear crop');
      clearBtn.style.width = '100%';
      clearBtn.addEventListener('click', () => { state.crop = null; destroyCrop(); buildCropTab(); initCropDraw(); });
      panel.appendChild(clearBtn);

      // Presets
      const presets = _sec('PRESETS');
      const presetsGrid = document.createElement('div');
      presetsGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px;';
      [
        { label: '1:1',  w: Math.min(origW, origH), h: Math.min(origW, origH) },
        { label: '4:3',  w: origW, h: Math.round(origW * 3/4) },
        { label: '16:9', w: origW, h: Math.round(origW * 9/16) },
        { label: '9:16', w: Math.round(origH * 9/16), h: origH },
      ].forEach(({ label, w, h }) => {
        const b = _btn(label);
        b.style.flex = '1';
        b.addEventListener('click', () => {
          const cx = Math.round((origW - Math.min(w, origW)) / 2);
          const cy = Math.round((origH - Math.min(h, origH)) / 2);
          state.crop = { x: cx, y: cy, w: Math.min(w, origW), h: Math.min(h, origH) };
          syncCropInputs();
          redrawCropRect();
        });
        presetsGrid.appendChild(b);
      });
      presets.appendChild(presetsGrid);
      panel.appendChild(presets);

      initCropDraw();
      if (state.crop) redrawCropRect();
    }

    function syncCropInputs() {
      if (state.tab !== 'crop') return;
      const c = state.crop;
      panel.querySelector('#pe-cx') && (panel.querySelector('#pe-cx').value = c ? c.x : 0);
      panel.querySelector('#pe-cy') && (panel.querySelector('#pe-cy').value = c ? c.y : 0);
      panel.querySelector('#pe-cw') && (panel.querySelector('#pe-cw').value = c ? c.w : origW);
      panel.querySelector('#pe-ch') && (panel.querySelector('#pe-ch').value = c ? c.h : origH);
    }

    // Interactive crop draw overlay
    function initCropDraw() {
      destroyCrop();

      cropUI = {};
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:absolute;inset:0;cursor:crosshair;z-index:10;';
      imgWrapper.appendChild(overlay);
      cropUI.overlay = overlay;

      let drag = null;
      overlay.addEventListener('mousedown', e => {
        if (e.target !== overlay) return;
        const r = img.getBoundingClientRect();
        drag = { x0: e.clientX - r.left, y0: e.clientY - r.top };
        e.preventDefault();
      });

      const onMove = e => {
        if (!drag) return;
        const r = img.getBoundingClientRect();
        const sx = origW / r.width;
        const sy = origH / r.height;
        const x0 = Math.max(0, Math.min(drag.x0, r.width));
        const y0 = Math.max(0, Math.min(drag.y0, r.height));
        const x1 = Math.max(0, Math.min(e.clientX - r.left, r.width));
        const y1 = Math.max(0, Math.min(e.clientY - r.top,  r.height));
        state.crop = {
          x: Math.round(Math.min(x0, x1) * sx),
          y: Math.round(Math.min(y0, y1) * sy),
          w: Math.round(Math.abs(x1 - x0) * sx),
          h: Math.round(Math.abs(y1 - y0) * sy),
        };
        redrawCropRect();
        syncCropInputs();
      };

      const onUp = () => {
        if (drag && state.crop && (state.crop.w < 10 || state.crop.h < 10)) {
          state.crop = null;
          destroyCropRect();
          syncCropInputs();
        }
        drag = null;
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
      cropUI.cleanup = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      };
    }

    function redrawCropRect() {
      destroyCropRect();
      if (!state.crop || !cropUI) return;

      const r  = img.getBoundingClientRect();
      const ix = img.offsetLeft;  // offset within imgWrapper
      const iy = img.offsetTop;
      const sx = r.width  / origW;
      const sy = r.height / origH;
      const { x, y, w, h } = state.crop;

      const rect = document.createElement('div');
      rect.style.cssText = `
        position:absolute;
        left:${ix + x * sx}px; top:${iy + y * sy}px;
        width:${w * sx}px;     height:${h * sy}px;
        border:2px solid #00D2FF;
        box-shadow:0 0 0 9999px rgba(0,0,0,.55);
        box-sizing:border-box;cursor:move;z-index:11;
      `;
      cropUI.rect = rect;
      cropUI.overlay.appendChild(rect);

      // 4 corner + 4 edge handles
      const handles = [
        { id:'nw', style:'left:-5px;top:-5px;cursor:nw-resize;' },
        { id:'n',  style:'left:50%;top:-5px;transform:translateX(-50%);cursor:n-resize;' },
        { id:'ne', style:'right:-5px;top:-5px;cursor:ne-resize;' },
        { id:'e',  style:'right:-5px;top:50%;transform:translateY(-50%);cursor:e-resize;' },
        { id:'se', style:'right:-5px;bottom:-5px;cursor:se-resize;' },
        { id:'s',  style:'left:50%;bottom:-5px;transform:translateX(-50%);cursor:s-resize;' },
        { id:'sw', style:'left:-5px;bottom:-5px;cursor:sw-resize;' },
        { id:'w',  style:'left:-5px;top:50%;transform:translateY(-50%);cursor:w-resize;' },
      ];
      handles.forEach(({ id, style }) => {
        const h = document.createElement('div');
        h.dataset.handle = id;
        h.style.cssText = `position:absolute;width:10px;height:10px;background:#00D2FF;border:1px solid #fff;border-radius:2px;${style}`;
        rect.appendChild(h);
      });

      // Move rect
      let mv = null;
      rect.addEventListener('mousedown', e => {
        if (e.target.dataset.handle) return;
        mv = { sx: e.clientX, sy: e.clientY, ox: state.crop.x, oy: state.crop.y };
        e.stopPropagation(); e.preventDefault();
      });

      // Handle resize
      let hv = null;
      rect.addEventListener('mousedown', e => {
        const hid = e.target.dataset.handle;
        if (!hid) return;
        hv = { hid, sx: e.clientX, sy: e.clientY, ...state.crop };
        e.stopPropagation(); e.preventDefault();
      });

      const onMove2 = e => {
        const r2  = img.getBoundingClientRect();
        const sx2 = origW / r2.width;
        const sy2 = origH / r2.height;

        if (mv) {
          const dx = Math.round((e.clientX - mv.sx) * sx2);
          const dy = Math.round((e.clientY - mv.sy) * sy2);
          state.crop.x = Math.max(0, Math.min(origW - state.crop.w, mv.ox + dx));
          state.crop.y = Math.max(0, Math.min(origH - state.crop.h, mv.oy + dy));
          redrawCropRect(); syncCropInputs();
        }

        if (hv) {
          const dx = Math.round((e.clientX - hv.sx) * sx2);
          const dy = Math.round((e.clientY - hv.sy) * sy2);
          let { x: cx, y: cy, w: cw, h: ch } = hv;

          if (hv.hid.includes('w')) { cx = Math.max(0, Math.min(cx + dx, cx + cw - 10)); cw = hv.x + hv.w - cx; }
          if (hv.hid.includes('e')) { cw = Math.max(10, Math.min(cw + dx, origW - cx)); }
          if (hv.hid.includes('n')) { cy = Math.max(0, Math.min(cy + dy, cy + ch - 10)); ch = hv.y + hv.h - cy; }
          if (hv.hid.includes('s')) { ch = Math.max(10, Math.min(ch + dy, origH - cy)); }

          state.crop = { x: cx, y: cy, w: cw, h: ch };
          redrawCropRect(); syncCropInputs();
        }
      };
      const onUp2 = () => { mv = null; hv = null; };
      document.addEventListener('mousemove', onMove2);
      document.addEventListener('mouseup',   onUp2);

      // Store cleanup so destroyCropRect can remove the listeners
      if (!cropUI.rectCleanup) cropUI.rectCleanup = [];
      cropUI.rectCleanup.push(() => {
        document.removeEventListener('mousemove', onMove2);
        document.removeEventListener('mouseup',   onUp2);
      });
    }

    function destroyCropRect() {
      cropUI?.rect?.remove();
      if (cropUI) cropUI.rect = null;
      cropUI?.rectCleanup?.forEach(fn => fn());
      if (cropUI) cropUI.rectCleanup = [];
    }

    function destroyCrop() {
      destroyCropRect();
      cropUI?.cleanup?.();
      cropUI?.overlay?.remove();
      cropUI = null;
    }

    // ── Effects tab ───────────────────────────────────────────────────────────
    function buildEffectsTab() {
      const sliders = [
        { key: 'brightness', label: 'Brightness', min: 0.1, max: 3,  step: 0.05, def: 1, fmt: v => v.toFixed(2) },
        { key: 'contrast',   label: 'Contrast',   min: 0.1, max: 3,  step: 0.05, def: 1, fmt: v => v.toFixed(2) },
        { key: 'saturation', label: 'Saturation', min: 0,   max: 3,  step: 0.05, def: 1, fmt: v => v.toFixed(2) },
        { key: 'blur',       label: 'Blur',       min: 0,   max: 20, step: 0.5,  def: 0, fmt: v => `${v}px` },
        { key: 'sharpen',    label: 'Sharpen',    min: 0,   max: 10, step: 0.1,  def: 0, fmt: v => v.toFixed(1) },
      ];

      const adj = _sec('ADJUSTMENTS');
      sliders.forEach(({ key, label, min, max, step, fmt }) => {
        const cur = state.effects[key];
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
        row.innerHTML = `
          <div style="display:flex;justify-content:space-between;font-size:11px;">
            <span style="color:var(--text-muted);font-weight:700;letter-spacing:.6px;">${label.toUpperCase()}</span>
            <span id="pe-v-${key}" style="color:var(--accent);font-weight:600;">${fmt(cur)}</span>
          </div>
          <input type="range" id="pe-s-${key}"
                 min="${min}" max="${max}" step="${step}" value="${cur}"
                 style="width:100%;cursor:pointer;accent-color:var(--accent);">
        `;
        adj.appendChild(row);
        row.querySelector(`#pe-s-${key}`).addEventListener('input', e => {
          state.effects[key] = parseFloat(e.target.value);
          row.querySelector(`#pe-v-${key}`).textContent = fmt(state.effects[key]);
          refreshPreview();
        });
      });
      panel.appendChild(adj);

      // Toggles
      const tog = _sec('FILTERS');
      const togGrid = document.createElement('div');
      togGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;';
      [
        { key: 'grayscale', label: '⬛ Grayscale' },
        { key: 'invert',    label: '🔄 Invert' },
      ].forEach(({ key, label }) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm';
        btn.style.cssText = state.effects[key]
          ? 'background:var(--accent);color:#fff;border:none;'
          : 'background:var(--bg-2);color:var(--text-muted);border:none;';
        btn.textContent = label;
        btn.addEventListener('click', () => {
          state.effects[key] = !state.effects[key];
          btn.style.cssText = state.effects[key]
            ? 'background:var(--accent);color:#fff;border:none;'
            : 'background:var(--bg-2);color:var(--text-muted);border:none;';
          refreshPreview();
        });
        togGrid.appendChild(btn);
      });
      tog.appendChild(togGrid);
      panel.appendChild(tog);

      // Reset effects
      const resetBtn = _btn('↺ Reset effects');
      resetBtn.style.width = '100%';
      resetBtn.addEventListener('click', () => {
        state.effects = { brightness: 1, contrast: 1, saturation: 1, blur: 0, sharpen: 0, grayscale: false, invert: false };
        refreshPreview();
        buildEffectsTab();
      });
      panel.appendChild(resetBtn);
    }

    // ── Live preview ──────────────────────────────────────────────────────────
    function refreshPreview() {
      const { brightness, contrast, saturation, blur, grayscale, invert } = state.effects;
      img.style.filter = [
        `brightness(${brightness})`,
        `contrast(${contrast})`,
        `saturate(${saturation})`,
        blur > 0   ? `blur(${Math.min(blur, 20)}px)` : '',
        grayscale  ? 'grayscale(1)' : '',
        invert     ? 'invert(1)'    : '',
      ].filter(Boolean).join(' ');
      img.style.transform = `rotate(${state.rotation}deg)`;
    }

    // ── Save ──────────────────────────────────────────────────────────────────
    el.querySelector('#pe-save').addEventListener('click', async () => {
      const btn = el.querySelector('#pe-save');
      btn.disabled = true; btn.textContent = '⏳ Saving…';
      try {
        // Only send resize dimensions if the user actually changed them — avoids
        // Sharp upscaling a cropped region back to the original image size.
        const resizeChanged = state.resize.w !== origW || state.resize.h !== origH;
        await API.media.edit(mediaId, {
          rotation: state.rotation,
          ...(resizeChanged ? { width: state.resize.w, height: state.resize.h } : {}),
          crop:     state.crop,
          effects:  state.effects,
          quality:  'high',
        });
        showToast('✅ Saved');
        state.rotation = 0;
        state.crop     = null;
        state.effects  = { brightness: 1, contrast: 1, saturation: 1, blur: 0, sharpen: 0, grayscale: false, invert: false };
        img.style.filter    = 'none';
        img.style.transform = '';
        img.src = API.mediaViewUrl(mediaId) + '&_t=' + Date.now();
        if (state.tab === 'crop') { destroyCrop(); buildCropTab(); }
        else switchTab(state.tab);
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      } finally {
        btn.disabled = false; btn.textContent = '💾 Save';
      }
    });

    // ── Reset all ─────────────────────────────────────────────────────────────
    el.querySelector('#pe-reset').addEventListener('click', () => {
      state.rotation = 0;
      state.resize   = { w: origW, h: origH, lock: true };
      state.crop     = null;
      state.effects  = { brightness: 1, contrast: 1, saturation: 1, blur: 0, sharpen: 0, grayscale: false, invert: false };
      img.style.filter    = 'none';
      img.style.transform = '';
      if (state.tab === 'crop') destroyCrop();
      switchTab(state.tab);
    });

    // Boot
    switchTab('transform');

  } catch (err) {
    el.innerHTML = `
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

// ── DOM helpers ───────────────────────────────────────────────────────────────

function _sec(label) {
  const d = document.createElement('div');
  d.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid var(--bg-2);';
  d.innerHTML = `<div style="font-size:11px;font-weight:700;letter-spacing:.7px;color:var(--text-muted)">${label}</div>`;
  return d;
}

function _row() {
  const d = document.createElement('div');
  d.style.cssText = 'display:flex;gap:4px;';
  return d;
}

function _btn(label) {
  const b = document.createElement('button');
  b.className = 'btn btn-sm btn-secondary';
  b.textContent = label;
  return b;
}

function _field(label) {
  const d = document.createElement('div');
  d.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
  d.innerHTML = `<label style="font-size:11px;color:var(--text-muted)">${label}</label>`;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:6px;';
  d.appendChild(row);
  return d; // caller appends inputs into d, which go after the label
}

function _numInput(attrs) {
  const inp = document.createElement('input');
  inp.type  = 'number';
  inp.className = 'form-control';
  inp.style.cssText = 'flex:1;min-width:0;';
  Object.assign(inp, attrs);
  return inp;
}

function _inpHtml(label, id, value) {
  return `<div style="display:flex;flex-direction:column;gap:2px;">
    <label style="font-size:10px;color:var(--text-muted)">${label}</label>
    <input id="${id}" type="number" value="${value}" min="0" class="form-control" style="width:100%;">
  </div>`;
}

function _fmtBytes(b) {
  if (!b) return '—';
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}
