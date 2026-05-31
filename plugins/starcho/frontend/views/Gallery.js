/**
 * Gallery — MediaHub grid with full interaction:
 * filter tabs, title search, likes/ratings, rich context menu,
 * multi-select → add to album or delete, preview lightbox with next/prev.
 */
import API      from '../../../../src/renderer/utils/api.js';
import store    from '../../../../src/renderer/store.js';
import { viewHeader } from '../../../../src/renderer/components/ui.js';
import { openModal, showToast } from '../../../../src/renderer/components/Modal.js';
import { esc }  from '../../../../src/renderer/utils/html.js';
import MultiPlayer from '../../../../src/renderer/components/MultiPlayer.js';

const PER_PAGE = 24;

const TAG_COLORS = {
  free: '#06D6A0', pro: '#FFD700', regalo: '#FF6B35',
  vip: '#E91E63', amigos: '#1DB954', membrecia: '#6C63FF',
  telegram: '#0088CC', wsp: '#25D366',
};

// ── Styles ────────────────────────────────────────────────────────────────────
function _injectStyles() {
  if (document.getElementById('gal-mh-styles')) return;
  const s = document.createElement('style');
  s.id = 'gal-mh-styles';
  s.textContent = `
    @keyframes mh-heart-float {
      0%   { transform:translateY(0) scale(1);  opacity:1; }
      100% { transform:translateY(-70px) scale(2.2); opacity:0; }
    }
    @keyframes gal-fav-burst-in {
      0%   { transform:scale(0) rotate(-20deg); opacity:0; }
      50%  { transform:scale(1.4) rotate(10deg); opacity:1; }
      100% { transform:scale(1) rotate(0deg); opacity:1; }
    }
    @keyframes gal-sel-pop {
      0%   { transform:scale(1); }
      40%  { transform:scale(1.06); }
      100% { transform:scale(1); }
    }
    /* ── Card base (Spotify style) ─────────────────────────── */
    .gal-card {
      background: #181818;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      transition: background .2s, transform .2s, box-shadow .2s;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .gal-card:hover {
      background: #282828 !important;
      transform: translateY(-4px) scale(1.015);
      box-shadow: 0 12px 32px rgba(0,0,0,.55);
    }
    .gal-thumb-area { position:relative; overflow:hidden; }
    .gal-thumb-area img { transition: transform .35s ease; }
    .gal-card:hover .gal-thumb-area img { transform: scale(1.06); }
    .gal-info { padding: 10px 12px 12px; }
    /* Selection */
    .gal-card.sel-mode .gal-check { display:flex !important; }
    .gal-card.sel-mode:hover { outline:2px solid var(--accent);outline-offset:2px; }
    .gal-card.sel-checked .gal-check {
      background:var(--accent) !important;border-color:var(--accent) !important;
    }
    .gal-card.sel-checked {
      outline:3px solid var(--accent);outline-offset:2px;
      animation:gal-sel-pop .2s ease;
    }
    .gal-card.sel-checked .gal-check::after { content:'✓';color:#fff;font-weight:900;font-size:12px; }
    /* List mode */
    .gal-card.list-mode { transform:none !important; box-shadow:none !important; border-radius:10px; }
    .gal-card.list-mode:hover { transform:none !important; }
    .gal-card.list-mode .gal-thumb-area {
      aspect-ratio:unset !important;width:90px !important;min-width:90px;height:72px;flex-shrink:0;
    }
    .gal-card.list-mode .gal-info {
      display:flex;flex-direction:column;justify-content:center;padding:0 12px !important;min-width:0;flex:1;
    }
    /* Tabs */
    .gal-tab { padding:6px 16px;border-radius:20px;cursor:pointer;font-size:12px;font-weight:700;
               border:none;background:rgba(255,255,255,.07);color:var(--text-muted);
               transition:background .15s,color .15s;white-space:nowrap; }
    .gal-tab.active { background:var(--accent);color:#fff; }
    .gal-tab:hover:not(.active) { background:rgba(255,255,255,.12);color:var(--text-primary); }
    /* Misc */
    .mh-heart-anim { position:fixed;pointer-events:none;z-index:9999;font-size:26px;
                     animation:mh-heart-float .9s ease forwards; }
    .mh-rating-heart { cursor:pointer;font-size:20px;transition:transform .1s; }
    .mh-rating-heart:hover { transform:scale(1.3); }
    /* Preview overlay */
    #gal-preview { animation:pv-in .2s ease; }
    @keyframes pv-in { from{opacity:0} to{opacity:1} }
    .pv-nav-btn {
      background:rgba(255,255,255,.12);border:none;color:#fff;
      width:52px;height:52px;border-radius:50%;cursor:pointer;font-size:28px;
      display:flex;align-items:center;justify-content:center;
      transition:background .15s;user-select:none;flex-shrink:0;
    }
    .pv-nav-btn:hover { background:rgba(255,255,255,.25); }
    .pv-nav-btn:disabled { opacity:.2;cursor:default; }
    /* Scroll-to-top */
    #gal-scroll-top {
      position:fixed;bottom:100px;right:28px;z-index:300;
      width:42px;height:42px;border-radius:50%;
      background:var(--accent);border:none;color:#fff;font-size:20px;
      cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.4);
      display:none;align-items:center;justify-content:center;
      transition:opacity .2s,transform .2s;
    }
    #gal-scroll-top.visible { display:flex; }
    #gal-scroll-top:hover { transform:scale(1.1); }
  `;
  document.head.appendChild(s);
}

export async function renderGallery(el, extra = {}) {
  const albumId = extra?.albumId || null;
  el.innerHTML  = '';
  el.style.paddingLeft  = '20px';
  el.style.paddingRight = '20px';
  _injectStyles();

  // ── Header ────────────────────────────────────────────────────────────────
  if (albumId) {
    let albumName = '';
    try { albumName = (await API.albums.get(albumId)).name || ''; } catch (_) {}
    el.insertAdjacentHTML('beforeend', viewHeader(
      `📁 ${esc(albumName) || 'Album'}`,
      `<button class="btn btn-sm btn-secondary" id="back-btn">← Álbumes</button>
       <button class="btn btn-sm btn-secondary" id="sel-btn">☑ Seleccionar</button>`,
    ));
    el.querySelector('#back-btn').addEventListener('click', () => store.navigate('starcho:albums'));
  } else {
    el.insertAdjacentHTML('beforeend', viewHeader(
      '📸 MediaHub Gallery',
      `<button class="btn btn-sm btn-secondary" id="sel-btn">☑ Seleccionar</button>`,
    ));
  }

  // ── Stats banner ──────────────────────────────────────────────────────────
  const statsBanner = document.createElement('div');
  statsBanner.id = 'gal-stats';
  statsBanner.style.cssText = `
    display:flex;gap:12px;align-items:center;flex-wrap:wrap;
    padding:10px 0 4px;font-size:12px;color:var(--text-muted);
  `;
  el.appendChild(statsBanner);

  // Load stats async
  API.media.stats().then(s => {
    statsBanner.innerHTML = `
      <span>📷 <strong style="color:var(--text-primary)">${s.photoCount||0}</strong> fotos</span>
      <span style="color:rgba(255,255,255,.15)">│</span>
      <span>🎬 <strong style="color:var(--text-primary)">${s.videoCount||0}</strong> videos</span>
      <span style="color:rgba(255,255,255,.15)">│</span>
      <span>💾 <strong style="color:var(--text-primary)">${_fmtBytes(s.diskBytes||0)}</strong></span>
    `;
  }).catch(() => { statsBanner.style.display = 'none'; });

  // ── Filter tabs + search ──────────────────────────────────────────────────
  const filterBar = document.createElement('div');
  filterBar.style.cssText = 'display:flex;gap:8px;align-items:center;margin:10px 0 14px;flex-wrap:wrap';
  filterBar.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="gal-tab active" data-tab="all">Todos</button>
      <button class="gal-tab" data-tab="photo">📷 Fotos</button>
      <button class="gal-tab" data-tab="video">🎬 Videos</button>
      <button class="gal-tab" data-tab="favorite">⭐ Favoritos</button>
    </div>
    <input type="text" class="form-control" id="gal-search"
           placeholder="Buscar por nombre o título…"
           style="flex:1;min-width:160px;max-width:300px">
    <button class="btn btn-sm btn-secondary" id="gal-feed-btn" title="Ver feed de videos">📹 Feed</button>
  `;
  el.appendChild(filterBar);

  // ── Grid + pager ──────────────────────────────────────────────────────────
  const gridEl = document.createElement('div');
  gridEl.style.cssText = `
    display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));
    gap:14px;padding-bottom:120px;
  `;
  el.appendChild(gridEl);

  const pagerEl = document.createElement('div');
  pagerEl.style.cssText = 'display:flex;gap:8px;justify-content:center;padding:16px 0;flex-wrap:wrap';
  el.appendChild(pagerEl);

  // ── Floating selection bar ────────────────────────────────────────────────
  const selBar = document.createElement('div');
  selBar.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(80px);
    background:var(--bg-3);border:1px solid rgba(255,255,255,.12);
    border-radius:40px;padding:10px 20px;
    display:flex;align-items:center;gap:14px;
    box-shadow:0 8px 32px rgba(0,0,0,.5);
    transition:transform .25s cubic-bezier(.34,1.56,.64,1),opacity .2s;
    opacity:0;z-index:200;white-space:nowrap;
  `;
  selBar.innerHTML = `
    <span id="sel-count" style="font-size:13px;font-weight:700;color:var(--text-primary)">0 seleccionados</span>
    <button id="sel-open" class="btn btn-sm" disabled
      style="background:linear-gradient(90deg,#7c3aed,#a78bfa);color:#fff;border:none;padding:6px 14px;border-radius:8px;
             cursor:pointer;font-size:13px;font-weight:700">
      ▶ Abrir en mini-players
    </button>
    <button id="sel-album" class="btn btn-sm btn-primary" disabled>📁 Agregar a álbum</button>
    <button id="sel-delete" class="btn btn-sm" disabled
      style="background:#FF3355;color:#fff;border:none;padding:6px 14px;border-radius:8px;
             cursor:pointer;font-size:13px;font-weight:700">
      🗑️ Eliminar
    </button>
    <button id="sel-cancel" class="btn btn-sm btn-secondary">Cancelar</button>
  `;
  document.body.appendChild(selBar);

  // ── Scroll-to-top button ──────────────────────────────────────────────────
  const scrollTopBtn = document.createElement('button');
  scrollTopBtn.id = 'gal-scroll-top';
  scrollTopBtn.textContent = '↑';
  scrollTopBtn.title = 'Volver arriba';
  scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(scrollTopBtn);

  const onScroll = () => {
    scrollTopBtn.classList.toggle('visible', window.scrollY > 300);
  };
  window.addEventListener('scroll', onScroll);

  // ── View mode toggle ──────────────────────────────────────────────────────
  let viewMode = 'grid';
  const viewToggle = document.createElement('button');
  viewToggle.className = 'btn btn-sm btn-secondary';
  viewToggle.textContent = '≡ Lista';
  viewToggle.style.flexShrink = '0';
  filterBar.appendChild(viewToggle);
  viewToggle.addEventListener('click', () => {
    viewMode = viewMode === 'grid' ? 'list' : 'grid';
    viewToggle.textContent = viewMode === 'grid' ? '≡ Lista' : '🔲 Cuadrícula';
    _applyViewMode();
  });

  const filterToggle = document.createElement('button');
  filterToggle.className = 'btn btn-sm btn-secondary';
  filterToggle.textContent = '⚙ Filtros';
  filterToggle.style.flexShrink = '0';
  filterBar.appendChild(filterToggle);

  const filterPanel = document.createElement('div');
  filterPanel.id = 'gal-filter-panel';
  filterPanel.style.cssText = `
    display:none;background:var(--bg-3);border:1px solid rgba(255,255,255,.1);
    border-radius:12px;padding:16px;margin:8px 0;
    grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;
  `;
  filterPanel.innerHTML = `
    <div>
      <label style="font-size:11px;font-weight:700;letter-spacing:.6px;color:var(--text-muted);display:block;margin-bottom:6px">ORDENAR POR</label>
      <select class="form-control" id="gal-sort" style="font-size:13px">
        <option value="date_desc">📅 Más reciente</option>
        <option value="date_asc">📅 Más antiguo</option>
        <option value="modified">✏️ Último editado</option>
        <option value="size_desc">💾 Mayor tamaño</option>
        <option value="size_asc">💾 Menor tamaño</option>
        <option value="views">👁 Más vistas</option>
        <option value="downloads">⬇️ Más descargas</option>
        <option value="likes">❤️ Más likes</option>
        <option value="rating">⭐ Mejor rating</option>
      </select>
    </div>
    <div>
      <label style="font-size:11px;font-weight:700;letter-spacing:.6px;color:var(--text-muted);display:block;margin-bottom:6px">TIPO DE ARCHIVO</label>
      <select class="form-control" id="gal-type-filter" style="font-size:13px">
        <option value="all">Todos</option>
        <option value="photo">📷 Solo fotos</option>
        <option value="video">🎬 Solo videos</option>
      </select>
    </div>
    <div>
      <label style="font-size:11px;font-weight:700;letter-spacing:.6px;color:var(--text-muted);display:block;margin-bottom:6px">TAMAÑO (MB)</label>
      <div style="display:flex;gap:6px">
        <input type="number" class="form-control" id="gal-min-size" min="0" step="0.1" placeholder="Mín" style="font-size:13px;flex:1">
        <input type="number" class="form-control" id="gal-max-size" min="0" step="0.1" placeholder="Máx" style="font-size:13px;flex:1">
      </div>
    </div>
    <div>
      <label style="font-size:11px;font-weight:700;letter-spacing:.6px;color:var(--text-muted);display:block;margin-bottom:6px">RATING MÍNIMO ⭐</label>
      <select class="form-control" id="gal-min-rating" style="font-size:13px">
        <option value="">Todos</option>
        <option value="2">2+ ⭐⭐</option>
        <option value="4">4+ ⭐⭐⭐⭐</option>
        <option value="6">6+ ⭐⭐⭐⭐⭐⭐</option>
        <option value="8">8+ ⭐⭐⭐⭐⭐⭐⭐⭐</option>
      </select>
    </div>
    <div style="display:flex;align-items:flex-end">
      <button class="btn btn-sm btn-primary" id="gal-apply-filters" style="width:100%">✅ Aplicar filtros</button>
    </div>
  `;
  el.appendChild(filterPanel);

  let filterPanelOpen = false;
  filterToggle.addEventListener('click', () => {
    filterPanelOpen = !filterPanelOpen;
    filterPanel.style.display = filterPanelOpen ? 'grid' : 'none';
    filterToggle.textContent = filterPanelOpen ? '✕ Cerrar filtros' : '⚙ Filtros';
  });

  filterPanel.querySelector('#gal-apply-filters').addEventListener('click', () => {
    sortBy      = filterPanel.querySelector('#gal-sort').value;
    minSize     = filterPanel.querySelector('#gal-min-size').value || '';
    maxSize     = filterPanel.querySelector('#gal-max-size').value || '';
    minRating   = filterPanel.querySelector('#gal-min-rating').value || '';
    const typeFilter = filterPanel.querySelector('#gal-type-filter').value;
    if (typeFilter !== 'all') {
      activeTab = typeFilter;
      filterBar.querySelectorAll('.gal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === typeFilter));
    }
    page = 1;
    load();
    filterPanelOpen = false;
    filterPanel.style.display = 'none';
    filterToggle.textContent = '⚙ Filtros';
  });

  function _applyViewMode() {
    gridEl.style.cssText = viewMode === 'grid'
      ? 'display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;padding-bottom:120px;'
      : 'display:flex;flex-direction:column;gap:6px;padding-bottom:120px;';
    gridEl.querySelectorAll('.gal-card').forEach(c => _applyCardStyle(c, viewMode));
  }

  function _applyCardStyle(card, mode) {
    if (mode === 'list') {
      card.style.cssText = 'background:var(--bg-3);border-radius:10px;overflow:hidden;cursor:pointer;transition:background .15s,outline .1s;position:relative;display:flex;align-items:stretch;flex-direction:row;height:72px;';
      card.classList.add('list-mode');
    } else {
      card.style.cssText = 'background:var(--bg-3);border-radius:12px;overflow:hidden;cursor:pointer;transition:transform .18s,box-shadow .18s,outline .1s;position:relative;display:flex;flex-direction:column;';
      card.classList.remove('list-mode');
    }
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let page       = 1;
  let activeTab  = 'all';
  let search     = '';
  let selectMode = false;
  let sortBy     = 'date_desc';
  let minSize    = '';
  let maxSize    = '';
  let minRating  = '';
  let filterFavs = false;
  let currentItems = [];      // loaded items for preview navigation
  const selected = new Set();

  function showSelBar(v) {
    selBar.style.opacity   = v ? '1' : '0';
    selBar.style.transform = v ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(80px)';
  }
  function updateSelBar() {
    const n = selected.size;
    selBar.querySelector('#sel-count').textContent = `${n} seleccionado${n !== 1 ? 's' : ''}`;
    selBar.querySelector('#sel-album').disabled  = n === 0;
    selBar.querySelector('#sel-delete').disabled = n === 0;
    // Habilitar "Abrir" solo si hay al menos un video seleccionado
    const hasVideo = [...selected].some(id => {
      const m = currentItems.find(x => x.id === id);
      return m && m.media_type === 'video';
    });
    selBar.querySelector('#sel-open').disabled = !hasVideo;
  }
  function enterSelectMode() {
    selectMode = true;
    el.querySelector('#sel-btn').textContent = '✕ Cancelar selección';
    el.querySelector('#sel-btn').style.color = 'var(--accent)';
    gridEl.querySelectorAll('.gal-card').forEach(c => c.classList.add('sel-mode'));
    showSelBar(true);
  }
  function exitSelectMode() {
    selectMode = false;
    selected.clear();
    el.querySelector('#sel-btn').textContent = '☑ Seleccionar';
    el.querySelector('#sel-btn').style.color = '';
    gridEl.querySelectorAll('.gal-card').forEach(c => c.classList.remove('sel-mode','sel-checked'));
    showSelBar(false);
  }
  function toggleSelect(card, id) {
    if (selected.has(id)) { selected.delete(id); card.classList.remove('sel-checked'); }
    else                  { selected.add(id);    card.classList.add('sel-checked'); }
    updateSelBar();
  }

  // ── Load ──────────────────────────────────────────────────────────────────
  async function load() {
    gridEl.innerHTML  = '<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-muted)">Cargando…</div>';
    pagerEl.innerHTML = '';
    currentItems = [];
    try {
      const params = { page, perPage: PER_PAGE };
      if (activeTab === 'favorite') { params.favorite = 'true'; }
      else if (activeTab !== 'all') { params.type = activeTab; }
      if (search)    params.search    = search;
      if (albumId)   params.albumId   = albumId;
      if (sortBy)    params.sortBy    = sortBy;
      if (minSize)   params.minSize   = minSize;
      if (maxSize)   params.maxSize   = maxSize;
      if (minRating) params.minRating = minRating;

      const res   = await API.media.list(params);
      const items = res.items || [];
      const total = res.total || 0;

      currentItems = items;
      gridEl.innerHTML = '';

      if (!items.length) {
        gridEl.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:64px 0;color:var(--text-muted)">
            <div style="font-size:48px;margin-bottom:12px">🖼️</div>
            <div style="font-size:15px;font-weight:600">Sin resultados</div>
          </div>`;
      } else {
        items.forEach((m, idx) => {
          const c = createCard(m, idx);
          _applyCardStyle(c, viewMode);
          gridEl.appendChild(c);
        });
        if (selectMode) gridEl.querySelectorAll('.gal-card').forEach(c => c.classList.add('sel-mode'));
      }

      // Pagination
      const pages = Math.ceil(total / PER_PAGE);
      if (pages > 1) {
        const prev = document.createElement('button');
        prev.className = 'btn btn-sm btn-secondary';
        prev.textContent = '← Anterior';
        prev.disabled = page <= 1;
        prev.addEventListener('click', () => { page--; load(); });

        const info = document.createElement('span');
        info.style.cssText = 'line-height:28px;font-size:13px;color:var(--text-muted)';
        info.textContent = `${page} / ${pages}  (${total})`;

        const next = document.createElement('button');
        next.className = 'btn btn-sm btn-secondary';
        next.textContent = 'Siguiente →';
        next.disabled = page >= pages;
        next.addEventListener('click', () => { page++; load(); });

        pagerEl.append(prev, info, next);
      }
    } catch (err) {
      showToast('Error cargando media: ' + err.message, 'error');
      gridEl.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#FF3366">Error cargando media</p>';
    }
  }

  // ── Card factory ──────────────────────────────────────────────────────────
  function createCard(media, idx) {
    const card    = document.createElement('div');
    card.className = 'gal-card';
    card.dataset.id = media.id;
    const isVideo  = media.media_type === 'video';
    const thumb    = media.thumbnail_path ? API.mediaThumbUrl(media.id) : null;
    const displayName = media.title || media.file_name;

    const thumbHTML = thumb
      ? `<img src="${esc(thumb)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px">${isVideo ? '🎬' : '🖼️'}</div>`;

    card.innerHTML = `
      <div class="gal-thumb-area" style="aspect-ratio:1/1;position:relative;overflow:hidden;background:#282828;flex-shrink:0;border-radius:8px;margin:10px 10px 0;">
        ${thumbHTML}
        ${isVideo ? '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none"><div style="width:42px;height:42px;border-radius:50%;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;font-size:20px;backdrop-filter:blur(4px)">▶</div></div>' : ''}
        ${media.is_favorite ? '<div style="position:absolute;top:7px;right:7px;font-size:14px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.9))">⭐</div>' : ''}
        ${media.view_count > 0 ? `<div style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,.65);border-radius:20px;padding:2px 7px;font-size:10px;color:rgba(255,255,255,.8);font-weight:600;backdrop-filter:blur(4px)">👁 ${media.view_count}</div>` : ''}
        <div class="gal-check" style="
          position:absolute;top:8px;left:8px;
          width:22px;height:22px;border-radius:50%;
          background:rgba(0,0,0,.55);border:2px solid rgba(255,255,255,.7);
          display:none;align-items:center;justify-content:center;
          font-size:13px;transition:background .12s;pointer-events:none;
        "></div>
        ${media.rating > 0 ? `<div style="position:absolute;bottom:6px;left:6px;
          background:rgba(0,0,0,.7);border-radius:20px;padding:2px 8px;
          font-size:10px;color:#FFD700;font-weight:700;backdrop-filter:blur(4px)">⭐ ${(media.rating||0).toFixed(1)}</div>` : ''}
      </div>
      <div class="gal-info" style="padding:10px 12px 12px;flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:#fff;
                    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.3;margin-bottom:4px">
          ${esc(displayName)}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:11px;color:rgba(255,255,255,.4)">${isVideo ? 'Video' : 'Foto'}</span>
          ${media.likes > 0 ? `<span style="font-size:11px;color:rgba(255,107,157,.7)">❤️ ${media.likes}</span>` : ''}
          <span style="font-size:11px;color:rgba(255,255,255,.35);margin-left:auto">${_fmtSizeSmall(media.file_size)}</span>
        </div>
      </div>
    `;

    const imgEl = card.querySelector('.gal-thumb-area img');
    if (imgEl) {
      imgEl.addEventListener('error', function() {
        this.style.display = 'none';
        const fb = document.createElement('div');
        fb.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px';
        fb.textContent = isVideo ? '🎬' : '🖼️';
        this.parentElement.appendChild(fb);
      });
    }

    card.addEventListener('click', () => {
      if (selectMode) { toggleSelect(card, media.id); return; }
      openPreview(idx);
    });

    card.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (selectMode) return;
      showContextMenu(media, card);
    });

    return card;
  }

  // ── Preview lightbox ──────────────────────────────────────────────────────
  function openPreview(startIdx) {
    let idx = startIdx;

    const overlay = document.createElement('div');
    overlay.id = 'gal-preview';
    overlay.style.cssText = `
      position:fixed;top:var(--titlebar-height);left:0;right:0;bottom:0;
      background:rgba(0,0,0,.96);z-index:9000;
      display:flex;flex-direction:column;align-items:stretch;
    `;

    // Top bar
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      display:flex;align-items:center;justify-content:space-between;
      padding:10px 16px;flex-shrink:0;
      background:rgba(0,0,0,.6);border-bottom:1px solid rgba(255,255,255,.07);
    `;
    topBar.innerHTML = `
      <div id="pv-title" style="font-size:14px;font-weight:700;color:#fff;
           overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;margin-right:12px"></div>
      <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">
        <button id="pv-edit"  class="btn btn-sm btn-secondary">✏️ Editar</button>
        <button id="pv-open"  class="btn btn-sm btn-primary"   style="display:none">🖼️ Editor</button>
        <span id="pv-counter" style="font-size:11px;color:rgba(255,255,255,.4);line-height:28px;padding:0 6px"></span>
        <button id="pv-close" style="background:rgba(255,255,255,.15);border:none;color:#fff;
               width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px;
               display:flex;align-items:center;justify-content:center">✕</button>
      </div>
    `;
    overlay.appendChild(topBar);

    // Main row (prev | media | next)
    const mainRow = document.createElement('div');
    mainRow.style.cssText = `
      flex:1;display:flex;align-items:center;gap:12px;
      padding:12px 16px 110px;min-height:0;
    `;
    overlay.appendChild(mainRow);

    const prevBtn = document.createElement('button');
    prevBtn.className = 'pv-nav-btn';
    prevBtn.innerHTML = '‹';
    const nextBtn = document.createElement('button');
    nextBtn.className = 'pv-nav-btn';
    nextBtn.innerHTML = '›';

    const mediaBox = document.createElement('div');
    mediaBox.id = 'pv-media';
    mediaBox.style.cssText = `
      flex:1;display:flex;align-items:center;justify-content:center;
      min-width:0;min-height:0;height:100%;
    `;

    mainRow.append(prevBtn, mediaBox, nextBtn);

    // Bottom action strip — always visible
    const actionStrip = document.createElement('div');
    actionStrip.id = 'pv-actions';
    actionStrip.style.cssText = `
      position:absolute;bottom:0;left:0;right:0;z-index:7;
      background:rgba(0,0,0,.85);backdrop-filter:blur(12px);
      border-top:1px solid rgba(255,255,255,.08);
      padding:10px 20px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;
    `;
    overlay.appendChild(actionStrip);

    // Info panel (slides up above action strip)
    const infoPanel = document.createElement('div');
    infoPanel.id = 'pv-info';
    infoPanel.style.cssText = `
      position:absolute;bottom:56px;left:0;right:0;max-height:55vh;overflow-y:auto;
      background:linear-gradient(to top,rgba(0,0,0,.97) 70%,transparent);
      padding:40px 24px 16px;
      transform:translateY(100%);transition:transform .35s cubic-bezier(.25,.8,.25,1);
      z-index:6;
    `;
    overlay.appendChild(infoPanel);

    // Comment panel
    const commentPanel = document.createElement('div');
    commentPanel.id = 'pv-comments';
    commentPanel.style.cssText = `
      position:absolute;bottom:56px;left:0;right:0;max-height:55vh;overflow-y:auto;
      background:rgba(0,0,0,.97);backdrop-filter:blur(16px);
      padding:16px 20px;
      transform:translateY(100%);transition:transform .35s cubic-bezier(.25,.8,.25,1);
      z-index:6;border-top:1px solid rgba(255,255,255,.08);
    `;
    overlay.appendChild(commentPanel);

    document.body.appendChild(overlay);

    let activePanel = null; // 'info' | 'comments' | null
    function showPanel(which) {
      if (activePanel === which) {
        // toggle off
        infoPanel.style.transform    = 'translateY(100%)';
        commentPanel.style.transform = 'translateY(100%)';
        activePanel = null;
      } else {
        infoPanel.style.transform    = which === 'info'     ? 'translateY(0)' : 'translateY(100%)';
        commentPanel.style.transform = which === 'comments' ? 'translateY(0)' : 'translateY(100%)';
        activePanel = which;
      }
    }

    // ── Render one item ────────────────────────────────────────────────────
    function render() {
      const m = currentItems[idx];
      if (!m) return;
      const isVideo = m.media_type === 'video';

      // Close panels on navigate
      infoPanel.style.transform    = 'translateY(100%)';
      commentPanel.style.transform = 'translateY(100%)';
      activePanel = null;

      // Title + counter
      topBar.querySelector('#pv-title').textContent = m.title || m.file_name;
      topBar.querySelector('#pv-counter').textContent = `${idx + 1} / ${currentItems.length}`;
      const openBtn = topBar.querySelector('#pv-open');
      openBtn.style.display = isVideo ? 'none' : '';
      openBtn.onclick = () => {
        closePreview();
        store.navigate('starcho:photo-editor', { id: m.id });
      };

      // Nav state
      prevBtn.disabled = idx === 0;
      nextBtn.disabled = idx === currentItems.length - 1;

      // ── Action strip ─────────────────────────────────────────────────────
      actionStrip.innerHTML = `
        <button class="btn btn-sm btn-secondary" id="pv-like-btn">❤️ ${m.likes || 0}</button>
        <button class="btn btn-sm btn-secondary" id="pv-fav-btn"
          style="${m.is_favorite ? 'color:#FFD700;border-color:rgba(255,215,0,.45);background:rgba(255,215,0,.08)' : ''}"
        >${m.is_favorite ? '★ Fav' : '☆ Fav'}</button>
        <button class="btn btn-sm btn-secondary" id="pv-rate-btn">⭐ ${m.rating > 0 ? (m.rating).toFixed(1) : 'Calificar'}</button>
        <button class="btn btn-sm btn-secondary" id="pv-comment-btn">💬 Comentar</button>
        <button class="btn btn-sm btn-secondary" id="pv-info-btn">ℹ️ Info</button>
        <a id="pv-download-btn" class="btn btn-sm btn-secondary" href="${API.media.downloadUrl(m.id)}" download="${esc(m.file_name)}" style="text-decoration:none">⬇️ Descargar</a>
        <div style="flex:1"></div>
        ${isVideo ? `<button class="btn btn-sm btn-primary" id="pv-play-btn">▶️ Feed</button>` : ''}
        <button class="btn btn-sm" style="background:#FF3355;color:#fff;border:none;border-radius:8px;cursor:pointer;padding:6px 12px;font-size:12px;font-weight:700" id="pv-del-btn">🗑️</button>
      `;

      // Wire action buttons
      actionStrip.querySelector('#pv-like-btn').addEventListener('click', async () => {
        try { const r = await API.media.like(m.id); m.likes = r.likes; render(); }
        catch (err) { showToast('Error: ' + err.message, 'error'); }
      });
      actionStrip.querySelector('#pv-fav-btn').addEventListener('click', async (e) => {
        try {
          const r = await API.media.favorite(m.id);
          m.is_favorite = r.isFavorite ? 1 : 0;
          if (r.isFavorite) _burstStars(e);
          render();
        } catch (err) { showToast('Error: ' + err.message, 'error'); }
      });
      actionStrip.querySelector('#pv-rate-btn').addEventListener('click', () => openRateModal(m));
      actionStrip.querySelector('#pv-comment-btn').addEventListener('click', () => {
        showPanel('comments');
        loadComments(m);
      });
      actionStrip.querySelector('#pv-info-btn').addEventListener('click', () => {
        showPanel('info');
        renderInfoPanel(m, isVideo);
      });
      actionStrip.querySelector('#pv-editor-btn')?.addEventListener('click', () => {
        closePreview(); store.navigate('starcho:photo-editor', { id: m.id });
      });
      actionStrip.querySelector('#pv-play-btn')?.addEventListener('click', () => {
        closePreview(); store.navigate('starcho:video-viewer', { id: m.id });
      });
      actionStrip.querySelector('#pv-del-btn').addEventListener('click', () => {
        openModal({
          title: '🗑️ Eliminar archivo',
          body: `<p style="color:var(--text-muted);font-size:14px">
            ¿Eliminar <strong style="color:var(--text-primary)">${esc(m.title || m.file_name)}</strong>?<br>
            <span style="font-size:12px;color:#FF5555">Esta acción no se puede deshacer.</span>
          </p>`,
          buttons: [{ label:'Cancelar', action:'cancel' }, { label:'🗑️ Eliminar', action:'del' }],
          onClose: async (action) => {
            if (action !== 'del') return;
            try {
              await API.media.delete(m.id);
              showToast('✅ Eliminado');
              currentItems.splice(idx, 1);
              if (!currentItems.length) { closePreview(); load(); return; }
              if (idx >= currentItems.length) idx = currentItems.length - 1;
              render(); load();
            } catch (err) { showToast('Error: ' + err.message, 'error'); }
          },
        });
      });

      // ── Info panel content ────────────────────────────────────────────────
      function renderInfoPanel(m, isVideo) {
        infoPanel.innerHTML = `
          <div style="font-size:16px;font-weight:800;color:#fff;margin-bottom:4px">${esc(m.title || m.file_name)}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.45);margin-bottom:10px">📄 ${esc(m.file_name)}</div>
          ${m.description ? `<p style="font-size:13px;color:rgba(255,255,255,.65);margin:0 0 10px;line-height:1.6">${esc(m.description)}</p>` : ''}
          <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:rgba(255,255,255,.4)">
            <span>${isVideo ? '🎬 Video' : '📷 Foto'}</span>
            <span>💾 ${_fmtSizeSmall(m.file_size) || '—'}</span>
            ${m.view_count ? `<span>👁 ${m.view_count} vistas</span>` : ''}
            ${m.rating > 0 ? `<span>⭐ ${(m.rating).toFixed(1)}/10</span>` : ''}
          </div>
        `;
      }

      // ── Media element ─────────────────────────────────────────────────────
      mediaBox.innerHTML = '';
      if (isVideo) {
        const vidWrap = document.createElement('div');
        vidWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;width:var(--pv-vid-pct,75%);transition:width .25s;max-width:96%;';

        const vid = document.createElement('video');
        vid.src      = API.mediaViewUrl(m.id);
        vid.controls = true;
        vid.autoplay = true;
        vid.style.cssText = 'width:100%;border-radius:10px;display:block;outline:none;';

        // Video-specific control bar
        const vCtrl = document.createElement('div');
        vCtrl.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;';
        vCtrl.innerHTML = `
          <button class="btn btn-sm btn-secondary" id="pv-rw">⏪ −10s</button>
          <button class="btn btn-sm btn-secondary" id="pv-fw">+10s ⏩</button>
          <span style="font-size:11px;color:rgba(255,255,255,.35);margin:0 4px">│</span>
          <span style="font-size:11px;color:rgba(255,255,255,.4)">Tamaño:</span>
          <button class="btn btn-sm btn-secondary" data-pct="45" id="pv-sz-s">S</button>
          <button class="btn btn-sm btn-secondary" data-pct="70" id="pv-sz-m">M</button>
          <button class="btn btn-sm btn-primary"   data-pct="92" id="pv-sz-l">L</button>
        `;
        vCtrl.querySelector('#pv-rw').addEventListener('click', () => { vid.currentTime = Math.max(0, vid.currentTime - 10); });
        vCtrl.querySelector('#pv-fw').addEventListener('click', () => { vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 10); });
        vCtrl.querySelectorAll('[data-pct]').forEach(btn => {
          btn.addEventListener('click', () => {
            overlay.style.setProperty('--pv-vid-pct', btn.dataset.pct + '%');
            vCtrl.querySelectorAll('[data-pct]').forEach(b => b.className = 'btn btn-sm btn-secondary');
            btn.className = 'btn btn-sm btn-primary';
          });
        });

        vidWrap.append(vid, vCtrl);
        mediaBox.appendChild(vidWrap);
      } else {
        const img = document.createElement('img');
        img.src = API.mediaViewUrl(m.id);
        img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;border-radius:10px;display:block;';
        img.loading = 'eager';
        mediaBox.appendChild(img);
      }

    }

    // ── Comments loader ────────────────────────────────────────────────────
    async function loadComments(m) {
      commentPanel.innerHTML = `
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:12px">
          💬 Comentarios
        </div>
        <div id="pv-comment-list" style="margin-bottom:12px;font-size:12px;color:var(--text-muted)">Cargando…</div>
        <div style="display:flex;gap:8px">
          <input type="text" id="pv-comment-inp" class="form-control" placeholder="Escribe un comentario…" style="flex:1;font-size:13px">
          <button class="btn btn-sm btn-primary" id="pv-comment-send">Enviar</button>
        </div>
      `;
      try {
        const rows = await API.media.comments(m.id);
        const list = commentPanel.querySelector('#pv-comment-list');
        if (!rows.length) {
          list.textContent = 'Sin comentarios aún.';
        } else {
          list.innerHTML = rows.map(c => `
            <div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)">
              <span style="font-weight:700;color:var(--text-primary);font-size:11px">${esc(c.author)}</span>
              <span style="color:rgba(255,255,255,.35);font-size:10px;margin-left:6px">${new Date(c.created_at).toLocaleDateString()}</span>
              <div style="color:var(--text-secondary);font-size:12px;margin-top:2px">${esc(c.text)}</div>
            </div>
          `).join('');
        }
      } catch (_) {
        commentPanel.querySelector('#pv-comment-list').textContent = 'Error cargando comentarios';
      }
      commentPanel.querySelector('#pv-comment-send').addEventListener('click', async () => {
        const inp = commentPanel.querySelector('#pv-comment-inp');
        const text = inp.value.trim();
        if (!text) return;
        try {
          await API.media.addComment(m.id, text, 'Usuario');
          inp.value = '';
          loadComments(m);
        } catch (err) { showToast('Error: ' + err.message, 'error'); }
      });
      commentPanel.querySelector('#pv-comment-inp').addEventListener('keydown', e => {
        if (e.key === 'Enter') commentPanel.querySelector('#pv-comment-send').click();
      });
    }

    // ── Navigation ─────────────────────────────────────────────────────────
    prevBtn.addEventListener('click', () => {
      if (idx > 0) { idx--; render(); }
    });
    nextBtn.addEventListener('click', () => {
      if (idx < currentItems.length - 1) { idx++; render(); }
    });

    // ── Keyboard ───────────────────────────────────────────────────────────
    function onKey(e) {
      if (e.key === 'Escape') {
        if (activePanel) showPanel(activePanel); // close panel first
        else closePreview();
      }
      else if (e.key === 'ArrowLeft'  && idx > 0)                       { idx--; render(); }
      else if (e.key === 'ArrowRight' && idx < currentItems.length - 1)  { idx++; render(); }
    }
    document.addEventListener('keydown', onKey);

    // ── Edit button ────────────────────────────────────────────────────────
    topBar.querySelector('#pv-edit').addEventListener('click', () => {
      const cur = currentItems[idx];
      if (cur?.media_type === 'video') {
        // Videos go to the dedicated video editor page
        closePreview();
        store.navigate('starcho:video-editor', { id: cur.id });
      } else {
        openMetaModal(cur, () => {
          API.media.get(cur.id).then(updated => {
            Object.assign(currentItems[idx], updated);
            render();
          }).catch(() => {});
          load();
        });
      }
    });

    // ── Close ──────────────────────────────────────────────────────────────
    function closePreview() {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity .2s';
      setTimeout(() => overlay.remove(), 200);
      document.removeEventListener('keydown', onKey);
    }
    topBar.querySelector('#pv-close').addEventListener('click', closePreview);

    render();
  }

  // ── Context menu ──────────────────────────────────────────────────────────
  function showContextMenu(media, cardEl) {
    const isVideo = media.media_type === 'video';
    openModal({
      title: esc(media.title || media.file_name),
      body: `
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-sm btn-secondary" data-action="preview" style="width:100%;text-align:left">
            🔍 Vista previa
          </button>
          <button class="btn btn-sm btn-secondary" data-action="open" style="width:100%;text-align:left">
            ${isVideo ? '▶️ Reproducir video' : '✏️ Editar foto'}
          </button>
          <button class="btn btn-sm btn-secondary" data-action="like" style="width:100%;text-align:left">
            ❤️ Like · ${media.likes || 0} likes
          </button>
          <button class="btn btn-sm btn-secondary" data-action="rate" style="width:100%;text-align:left">
            ⭐ Calificar (1–10) · Prom: ${media.rating > 0 ? (media.rating||0).toFixed(1) : '—'}
          </button>
          <button class="btn btn-sm btn-secondary" data-action="meta" style="width:100%;text-align:left">
            📝 Editar info y renombrar
          </button>
          <button class="btn btn-sm btn-secondary" data-action="album" style="width:100%;text-align:left">
            📁 Agregar a álbum
          </button>
          <button class="btn btn-sm btn-secondary" data-action="fav" style="width:100%;text-align:left">
            ${media.is_favorite ? '☆ Quitar de Favoritos' : '⭐ Agregar a Favoritos'}
          </button>
          <button class="btn btn-sm btn-secondary" data-action="del"
                  style="width:100%;text-align:left;color:#FF5555">
            🗑️ Eliminar permanentemente
          </button>
        </div>`,
      onClose: async (action) => {
        const cardIdx = currentItems.findIndex(m => m.id === media.id);
        if (action === 'preview') {
          openPreview(cardIdx >= 0 ? cardIdx : 0);
        } else if (action === 'open') {
          store.navigate(isVideo ? 'starcho:video-viewer' : 'starcho:photo-editor', { id: media.id });
        } else if (action === 'like') {
          await _doLike(media.id);
          load();
        } else if (action === 'rate') {
          openRateModal(media);
        } else if (action === 'meta') {
          openMetaModal(media, load);
        } else if (action === 'album') {
          openAlbumModal([media.id]);
        } else if (action === 'fav') {
          try {
            const r = await API.media.favorite(media.id);
            showToast(r.isFavorite ? '⭐ Agregado a favoritos' : '☆ Quitado de favoritos');
            if (r.isFavorite) _burstStars({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 });
            load();
          } catch (err) { showToast('Error: ' + err.message, 'error'); }
        } else if (action === 'del') {
          openDeleteConfirm(media, cardEl);
        }
      },
    });
  }

  // ── Fav burst stars ───────────────────────────────────────────────────────
  function _burstStars(e) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const star  = document.createElement('div');
      const angle = (i / count) * 2 * Math.PI;
      const dist  = 48 + Math.random() * 36;
      star.textContent = '⭐';
      star.style.cssText = `
        position:fixed;pointer-events:none;z-index:9999;font-size:18px;
        left:${e.clientX - 9}px;top:${e.clientY - 9}px;
        transition:transform .65s ease-out,opacity .65s ease-out;
        will-change:transform,opacity;
      `;
      document.body.appendChild(star);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        star.style.transform = `translate(${Math.cos(angle) * dist}px,${Math.sin(angle) * dist}px) scale(0)`;
        star.style.opacity   = '0';
      }));
      setTimeout(() => star.remove(), 700);
    }
  }

  // ── Like ──────────────────────────────────────────────────────────────────
  async function _doLike(mediaId, fromEvent) {
    try {
      const r = await API.media.like(mediaId);
      if (fromEvent) _floatHeart(fromEvent);
      return r;
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
  }

  function _floatHeart(e) {
    const h = document.createElement('div');
    h.className = 'mh-heart-anim';
    h.textContent = '❤️';
    h.style.left = (e.clientX - 13) + 'px';
    h.style.top  = (e.clientY - 13) + 'px';
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 950);
  }

  // ── Rate modal ────────────────────────────────────────────────────────────
  function openRateModal(media) {
    let chosen = 0;
    openModal({
      title: '⭐ Calificar',
      body: `
        <div style="text-align:center;margin-bottom:12px">
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
            Toca para calificar del 1 al 10
          </div>
          <div id="rate-hearts" style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
            ${Array.from({ length: 10 }, (_, i) =>
              `<span class="mh-rating-heart" data-v="${i+1}" style="color:rgba(255,107,157,.3)">❤️</span>`
            ).join('')}
          </div>
          <div id="rate-val" style="margin-top:12px;font-size:20px;font-weight:800;color:#FF6B9D">—</div>
        </div>`,
      buttons: [
        { label: 'Cancelar', action: 'cancel' },
        { label: '✅ Guardar', action: 'save', primary: true },
      ],
      onClose: async (action) => {
        if (action !== 'save' || !chosen) return;
        try {
          await API.media.rate(media.id, chosen);
          showToast(`⭐ Calificado con ${chosen}/10`);
          load();
        } catch (err) { showToast('Error: ' + err.message, 'error'); }
      },
    });

    setTimeout(() => {
      const container = document.getElementById('rate-hearts');
      const valEl     = document.getElementById('rate-val');
      if (!container) return;
      container.querySelectorAll('.mh-rating-heart').forEach(h => {
        h.addEventListener('click', () => {
          chosen = parseInt(h.dataset.v);
          container.querySelectorAll('.mh-rating-heart').forEach((hh, i) => {
            hh.style.color = i < chosen ? '#FF6B9D' : 'rgba(255,107,157,.3)';
          });
          if (valEl) valEl.textContent = chosen + '/10';
        });
        h.addEventListener('mouseover', () => {
          const v = parseInt(h.dataset.v);
          container.querySelectorAll('.mh-rating-heart').forEach((hh, i) => {
            hh.style.color = i < v ? '#FF6B9D' : 'rgba(255,107,157,.3)';
          });
        });
        h.addEventListener('mouseout', () => {
          container.querySelectorAll('.mh-rating-heart').forEach((hh, i) => {
            hh.style.color = i < chosen ? '#FF6B9D' : 'rgba(255,107,157,.3)';
          });
        });
      });
    }, 80);
  }

  // ── Meta modal (includes rename) ──────────────────────────────────────────
  function openMetaModal(media, onSaved) {
    openModal({
      title: '📝 Editar información',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                          margin-bottom:6px;color:var(--text-muted)">NOMBRE DE ARCHIVO</label>
            <input type="text" class="form-control" id="meta-filename"
                   value="${esc(media.file_name || '')}" style="width:100%">
          </div>
          <div>
            <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                          margin-bottom:6px;color:var(--text-muted)">TÍTULO</label>
            <input type="text" class="form-control" id="meta-title"
                   value="${esc(media.title || '')}" placeholder="Título del archivo" style="width:100%">
          </div>
          <div>
            <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                          margin-bottom:6px;color:var(--text-muted)">DESCRIPCIÓN</label>
            <textarea class="form-control" id="meta-desc" rows="3"
                      style="width:100%;resize:vertical">${esc(media.description || '')}</textarea>
          </div>
        </div>`,
      buttons: [
        { label: 'Cancelar', action: 'cancel' },
        { label: '💾 Guardar', action: 'save', primary: true },
      ],
      onClose: async (action) => {
        if (action !== 'save') return;
        const fileName = document.getElementById('meta-filename')?.value.trim() || media.file_name;
        const title    = document.getElementById('meta-title')?.value.trim()    || '';
        const desc     = document.getElementById('meta-desc')?.value.trim()     || '';
        try {
          if (fileName && fileName !== media.file_name) {
            await API.media.rename(media.id, fileName);
            media.file_name = fileName;
          }
          await API.media.updateMeta(media.id, { title, description: desc });
          media.title       = title;
          media.description = desc;
          showToast('✅ Guardado');
          if (onSaved) onSaved();
        } catch (err) { showToast('Error: ' + err.message, 'error'); }
      },
    });
  }

  // ── Add to album modal ────────────────────────────────────────────────────
  async function openAlbumModal(mediaIds) {
    let albums = [];
    try { albums = await API.albums.list(); } catch (_) {}

    const existingOptions = albums.length
      ? albums.map(a => `
          <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;
                        border-radius:8px;cursor:pointer;border:1px solid transparent;
                        transition:background .12s" class="alb-opt">
            <input type="radio" name="alb-pick" value="${a.id}" style="accent-color:var(--accent)">
            <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${esc(a.name)}</span>
            <span style="font-size:11px;color:var(--text-muted);margin-left:auto">${a.mediaCount ?? 0} items</span>
          </label>`).join('')
      : '<p style="color:var(--text-muted);font-size:13px">No hay álbumes. Crea uno nuevo.</p>';

    openModal({
      title: '📁 Agregar a álbum',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:4px"
               id="alb-list">
            <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;
                          border-radius:8px;cursor:pointer;border:1px solid transparent" class="alb-opt">
              <input type="radio" name="alb-pick" value="new" style="accent-color:var(--accent)" checked>
              <span style="font-size:13px;font-weight:700;color:var(--accent)">＋ Crear nuevo álbum</span>
            </label>
            ${existingOptions}
          </div>
          <div id="alb-new-fields" style="display:flex;flex-direction:column;gap:10px">
            <input type="text" class="form-control" id="new-alb-name"
                   placeholder="Nombre del nuevo álbum" style="width:100%">
          </div>
          <div style="font-size:12px;color:var(--text-muted)">
            ${mediaIds.length} archivo${mediaIds.length !== 1 ? 's' : ''} seleccionado${mediaIds.length !== 1 ? 's' : ''}
          </div>
        </div>`,
      buttons: [
        { label: 'Cancelar', action: 'cancel' },
        { label: '✅ Agregar', action: 'add', primary: true },
      ],
      onClose: async (action) => {
        if (action !== 'add') return;
        const picked = document.querySelector('input[name="alb-pick"]:checked')?.value;
        try {
          if (picked === 'new' || !picked) {
            const name = document.getElementById('new-alb-name')?.value.trim();
            if (!name) { showToast('Nombre de álbum requerido', 'error'); return; }
            const album = await API.albums.create({ name });
            await API.albums.addMedia(album.id, mediaIds);
            showToast(`✅ Álbum "${name}" creado`);
          } else {
            await API.albums.addMedia(parseInt(picked), mediaIds);
            showToast('✅ Agregado al álbum');
          }
          exitSelectMode();
          load();
        } catch (err) { showToast('Error: ' + err.message, 'error'); }
      },
    });

    setTimeout(() => {
      const list      = document.getElementById('alb-list');
      const newFields = document.getElementById('alb-new-fields');
      if (!list || !newFields) return;
      list.addEventListener('change', () => {
        const v = document.querySelector('input[name="alb-pick"]:checked')?.value;
        newFields.style.display = v === 'new' ? 'flex' : 'none';
      });
    }, 80);
  }

  // ── Delete confirm ────────────────────────────────────────────────────────
  function openDeleteConfirm(media, cardEl) {
    openModal({
      title: '🗑️ Eliminar archivo',
      body: `
        <p style="color:var(--text-muted);font-size:14px;line-height:1.6">
          ¿Eliminar permanentemente <strong style="color:var(--text-primary)">${esc(media.title || media.file_name)}</strong>?<br>
          <span style="font-size:12px;opacity:.7;color:#FF5555">Esta acción no se puede deshacer.</span>
        </p>`,
      buttons: [
        { label: 'Cancelar', action: 'cancel' },
        { label: '🗑️ Eliminar', action: 'del' },
      ],
      onClose: async (action) => {
        if (action !== 'del') return;
        try {
          await API.media.delete(media.id);
          showToast('✅ Eliminado');
          cardEl.remove();
          currentItems = currentItems.filter(m => m.id !== media.id);
        } catch (err) { showToast('Error: ' + err.message, 'error'); }
      },
    });
  }

  // ── Wire events ───────────────────────────────────────────────────────────
  el.querySelector('#sel-btn').addEventListener('click', () => {
    if (selectMode) exitSelectMode();
    else enterSelectMode();
  });

  filterBar.querySelector('#gal-feed-btn')?.addEventListener('click', () =>
    store.navigate('starcho:video-feed')
  );

  filterBar.querySelectorAll('.gal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      filterBar.querySelectorAll('.gal-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      page = 1;
      load();
    });
  });

  filterBar.querySelector('#gal-search').addEventListener('input', e => {
    search = e.target.value;
    page   = 1;
    load();
  });

  selBar.querySelector('#sel-album').addEventListener('click', () => {
    if (selected.size === 0) return;
    openAlbumModal([...selected]);
  });

  selBar.querySelector('#sel-open').addEventListener('click', () => {
    if (selected.size === 0) return;
    // Filtrar a videos seleccionados, conservando el orden visual del grid
    const videos = [];
    [...gridEl.querySelectorAll('.gal-card')].forEach(card => {
      const id = Number(card.dataset.id);
      if (!selected.has(id)) return;
      const m = currentItems.find(x => x.id === id);
      if (!m || m.media_type !== 'video') return;
      videos.push({
        id: m.id,
        title: m.title || m.file_name || `Video #${m.id}`,
        src: API.mediaViewUrl(m.id),
        mime: m.mime_type,
      });
    });
    if (!videos.length) {
      showToast('No hay videos en la selección', 'info');
      return;
    }
    showToast(`Abriendo ${videos.length} mini-player(s)…`, 'success');
    MultiPlayer.openMany(videos);
    exitSelectMode();
  });

  selBar.querySelector('#sel-delete').addEventListener('click', () => {
    if (selected.size === 0) return;
    const n = selected.size;
    openModal({
      title: '🗑️ Eliminar selección',
      body: `
        <p style="color:var(--text-muted);font-size:14px;line-height:1.6">
          ¿Eliminar permanentemente
          <strong style="color:var(--text-primary)">${n} archivo${n !== 1 ? 's' : ''}</strong>?<br>
          <span style="font-size:12px;color:#FF5555">Esta acción no se puede deshacer.</span>
        </p>`,
      buttons: [
        { label: 'Cancelar', action: 'cancel' },
        { label: '🗑️ Eliminar', action: 'del' },
      ],
      onClose: async (action) => {
        if (action !== 'del') return;
        const ids = [...selected];
        let errors = 0;
        for (const id of ids) {
          try { await API.media.delete(id); } catch (_) { errors++; }
        }
        if (errors) showToast(`Eliminados con ${errors} error(es)`, 'error');
        else showToast(`✅ ${ids.length} archivo${ids.length !== 1 ? 's' : ''} eliminados`);
        exitSelectMode();
        load();
      },
    });
  });

  selBar.querySelector('#sel-cancel').addEventListener('click', exitSelectMode);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _fmtSizeSmall(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function _fmtBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }

  // Cleanup when view unmounts
  const obs = new MutationObserver(() => {
    if (!document.body.contains(el)) {
      selBar.remove();
      scrollTopBtn.remove();
      window.removeEventListener('scroll', onScroll);
      document.getElementById('gal-preview')?.remove();
      obs.disconnect();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  await load();
}
