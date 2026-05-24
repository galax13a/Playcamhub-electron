/**
 * Albums — TikTok-style full-height vertical scroll.
 * Each album shows tag, color accent, importance stars, price, view count.
 * Full edit modal with all metadata fields.
 */
import API      from '../../../../src/renderer/utils/api.js';
import store    from '../../../../src/renderer/store.js';
import { openModal, showToast } from '../../../../src/renderer/components/Modal.js';
import { esc }  from '../../../../src/renderer/utils/html.js';

const TAG_META = {
  free:      { label: 'FREE',      color: '#06D6A0' },
  pro:       { label: 'PRO',       color: '#FFD700' },
  regalo:    { label: 'REGALO',    color: '#FF6B35' },
  vip:       { label: 'VIP',       color: '#E91E63' },
  amigos:    { label: 'AMIGOS',    color: '#1DB954' },
  membrecia: { label: 'MEMBRESÍA', color: '#6C63FF' },
  telegram:  { label: 'TELEGRAM',  color: '#0088CC' },
  wsp:       { label: 'WSP',       color: '#25D366' },
};

const CURRENCY_SYMBOL = {
  tokens: '🪙', usd: '$', eur: '€', cop: 'COP$',
  mxn: 'MX$', ars: 'AR$', pen: 'S/', crypto: '₿',
};

function _importanceStars(n) {
  const filled = Math.max(1, Math.min(5, parseInt(n) || 1));
  return Array.from({ length: 5 }, (_, i) =>
    `<span style="color:${i < filled ? '#FFD700' : 'rgba(255,255,255,.25)'}">★</span>`
  ).join('');
}

export async function renderAlbums(el) {
  el.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';
  el.innerHTML = '';

  // ── Top bar ───────────────────────────────────────────────────────────────
  const topBar = document.createElement('div');
  topBar.style.cssText = `
    display:flex;align-items:center;justify-content:space-between;
    padding:12px 20px;flex-shrink:0;
    background:linear-gradient(to bottom,var(--bg-1) 0%,transparent 100%);
    position:relative;z-index:10;
  `;
  topBar.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">📁</span>
      <span style="font-size:16px;font-weight:700;color:var(--text-primary)">Álbumes</span>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      <div style="display:flex;gap:2px;background:rgba(255,255,255,.07);border-radius:8px;padding:3px" id="alb-view-btns">
        <button class="alb-vbtn active" data-view="tiktok" title="Vista TikTok">📱</button>
        <button class="alb-vbtn" data-view="grid"   title="Vista cuadrícula">⊞</button>
        <button class="alb-vbtn" data-view="list"   title="Vista lista">≡</button>
      </div>
      <button id="alb-goto-gallery" class="btn btn-sm btn-secondary">🖼️ Galería</button>
      <button id="alb-new-btn" class="btn btn-sm btn-primary">＋ Nuevo álbum</button>
    </div>
  `;
  el.appendChild(topBar);

  // ── Feed ──────────────────────────────────────────────────────────────────
  const feed = document.createElement('div');
  feed.style.cssText = `
    flex:1;overflow-y:auto;overflow-x:hidden;
    scroll-snap-type:y mandatory;scroll-behavior:smooth;
  `;
  el.appendChild(feed);

  // Inject CSS once
  if (!document.getElementById('alb-tk-styles')) {
    const s = document.createElement('style');
    s.id = 'alb-tk-styles';
    s.textContent = `
      .alb-vbtn {
        background:none;border:none;cursor:pointer;color:rgba(255,255,255,.5);
        font-size:16px;width:30px;height:30px;border-radius:6px;
        display:flex;align-items:center;justify-content:center;transition:all .15s;
      }
      .alb-vbtn:hover { background:rgba(255,255,255,.1);color:#fff; }
      .alb-vbtn.active { background:var(--accent);color:#fff; }
      /* Grid view */
      .alb-grid-card {
        background:var(--bg-3);border-radius:12px;overflow:hidden;cursor:pointer;
        transition:transform .18s,box-shadow .18s;position:relative;
        display:flex;flex-direction:column;
      }
      .alb-grid-card:hover { transform:translateY(-4px) scale(1.015);box-shadow:0 12px 32px rgba(0,0,0,.55); }
      .alb-grid-thumb { width:100%;aspect-ratio:1;object-fit:cover;display:block; }
      .alb-grid-info  { padding:10px 12px 12px; }
      /* List view */
      .alb-list-card {
        background:var(--bg-3);border-radius:10px;overflow:hidden;cursor:pointer;
        display:flex;align-items:stretch;height:80px;
        transition:background .15s;
      }
      .alb-list-card:hover { background:var(--bg-2); }
      .alb-list-thumb { width:100px;min-width:100px;object-fit:cover;display:block; }
      .alb-list-thumb-placeholder { width:100px;min-width:100px;display:flex;align-items:center;justify-content:center;font-size:28px; }
      .alb-list-info  { flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 14px;min-width:0; }
      .alb-list-actions { display:flex;align-items:center;gap:4px;padding:0 10px;flex-shrink:0; }
      .alb-list-icon-btn { background:none;border:none;cursor:pointer;font-size:18px;padding:6px;border-radius:8px;color:rgba(255,255,255,.6);transition:background .12s,color .12s; }
      .alb-list-icon-btn:hover { background:rgba(255,255,255,.1);color:#fff; }
      .alb-tk-card { scroll-snap-align:start;position:relative;overflow:hidden;
                     display:flex;align-items:flex-end;cursor:default; }
      .alb-tk-bg   { position:absolute;inset:0;background-size:cover;background-position:center;
                     transition:transform .4s ease; }
      .alb-tk-card:hover .alb-tk-bg { transform:scale(1.03); }
      .alb-tk-grad { position:absolute;inset:0;
                     background:linear-gradient(to bottom,rgba(0,0,0,.15) 0%,rgba(0,0,0,.05) 30%,
                                rgba(0,0,0,.65) 70%,rgba(0,0,0,.92) 100%); }
      .alb-tk-sidebar {
        position:absolute;right:14px;top:50%;transform:translateY(-50%);
        display:flex;flex-direction:column;align-items:center;gap:10px;z-index:2;
      }
      .alb-tk-action {
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
        width:54px;height:54px;
        border-radius:16px;
        cursor:pointer;color:#fff;
        transition:filter .18s,transform .14s,box-shadow .18s;
        font-size:10px;font-weight:800;letter-spacing:.3px;
        border:1px solid rgba(255,255,255,.14);
        backdrop-filter:blur(10px);
        box-shadow:0 2px 12px rgba(0,0,0,.3);
        user-select:none;
      }
      .alb-tk-action:hover { filter:brightness(1.3);transform:scale(1.1);box-shadow:0 6px 20px rgba(0,0,0,.5); }
      .alb-tk-action:active { transform:scale(.95); }
      .alb-tk-action .tk-icon { font-size:22px;line-height:1;display:block; }
      .alb-tk-action.act-view    { background:rgba(29,185,84,.3);  border-color:rgba(29,185,84,.4); }
      .alb-tk-action.act-fav     { background:rgba(255,215,0,.2);  border-color:rgba(255,215,0,.35); }
      .alb-tk-action.act-fav.active { background:rgba(255,215,0,.45); color:#FFD700; }
      .alb-tk-action.act-comment { background:rgba(0,149,255,.25); border-color:rgba(0,149,255,.4); }
      .alb-tk-action.act-edit    { background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.2); }
      .alb-tk-action.act-del     { background:rgba(239,68,68,.25); border-color:rgba(239,68,68,.4); }
      .alb-tk-action.act-del:hover { background:rgba(239,68,68,.5); }
      @keyframes alb-fav-pop {
        0%   { transform:scale(1); }
        30%  { transform:scale(1.5); }
        60%  { transform:scale(0.85); }
        100% { transform:scale(1); }
      }
      .alb-tk-action.act-fav.pop { animation:alb-fav-pop .4s ease; }
      .alb-tk-info  { position:relative;z-index:2;padding:0 80px 28px 20px;color:#fff; }
      .alb-tk-counter { position:absolute;top:12px;right:16px;z-index:2;
                        font-size:11px;font-weight:700;color:rgba(255,255,255,.7);
                        background:rgba(0,0,0,.4);border-radius:20px;padding:3px 10px; }
      .alb-tk-dots { position:absolute;left:50%;transform:translateX(-50%);
                     top:12px;z-index:2;display:flex;gap:5px; }
      .alb-tk-dot  { width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.4);
                     transition:background .2s,transform .2s; }
      .alb-tk-dot.active { background:#fff;transform:scale(1.3); }
    `;
    document.head.appendChild(s);
  }

  let albums   = [];
  let viewMode = 'tiktok'; // 'tiktok' | 'grid' | 'list'

  // View mode toggle buttons
  topBar.querySelector('#alb-view-btns').addEventListener('click', e => {
    const btn = e.target.closest('.alb-vbtn');
    if (!btn) return;
    viewMode = btn.dataset.view;
    topBar.querySelectorAll('.alb-vbtn').forEach(b => b.classList.toggle('active', b === btn));
    // Update feed layout
    if (viewMode === 'tiktok') {
      feed.style.cssText = 'flex:1;overflow-y:auto;overflow-x:hidden;scroll-snap-type:y mandatory;scroll-behavior:smooth;';
    } else if (viewMode === 'grid') {
      feed.style.cssText = 'flex:1;overflow-y:auto;overflow-x:hidden;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;padding:16px;';
    } else {
      feed.style.cssText = 'flex:1;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:8px;padding:16px;';
    }
    load();
  });

  async function load() {
    feed.innerHTML = '';
    try {
      albums = await API.albums.list();
    } catch (err) {
      feed.innerHTML = `<div style="color:#FF3366;padding:40px;text-align:center">${esc(err.message)}</div>`;
      return;
    }

    const visible = albums.filter(a => !(a.id === 1 && !a.mediaCount));
    if (!visible.length) { feed.appendChild(emptyState()); return; }

    if (viewMode === 'grid') {
      visible.forEach(album => feed.appendChild(buildGridCard(album)));
      return;
    }
    if (viewMode === 'list') {
      visible.forEach(album => feed.appendChild(buildListCard(album)));
      return;
    }

    // TikTok view (default)
    const dotsBar = document.createElement('div');
    dotsBar.className = 'alb-tk-dots';
    const MAX_DOTS = 8;

    visible.forEach((album, idx) => {
      feed.appendChild(buildCard(album, idx, visible.length, dotsBar, MAX_DOTS));
    });

    const dotCount = Math.min(visible.length, MAX_DOTS);
    for (let i = 0; i < dotCount; i++) {
      const d = document.createElement('div');
      d.className = 'alb-tk-dot' + (i === 0 ? ' active' : '');
      dotsBar.appendChild(d);
    }
    feed.firstElementChild?.appendChild(dotsBar);

    let ticking = false;
    feed.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const h   = feed.firstElementChild?.offsetHeight || 1;
        const idx = Math.round(feed.scrollTop / h);
        dotsBar.querySelectorAll('.alb-tk-dot').forEach((d, i) =>
          d.classList.toggle('active', i === Math.min(idx, MAX_DOTS - 1))
        );
        ticking = false;
      });
    });
  }

  // ── Grid card ─────────────────────────────────────────────────────────────
  function buildGridCard(album) {
    const tagInfo = TAG_META[album.tag] || TAG_META.free;
    const card = document.createElement('div');
    card.className = 'alb-grid-card';

    const PALETTE = [
      'linear-gradient(135deg,#1DB954,#0d7a38)',
      'linear-gradient(135deg,#E91E63,#880E4F)',
      'linear-gradient(135deg,#FF6B35,#c74a1a)',
      'linear-gradient(135deg,#6C63FF,#3d35cc)',
      'linear-gradient(135deg,#00BCD4,#006064)',
    ];

    const thumb = document.createElement('div');
    thumb.style.cssText = 'width:100%;aspect-ratio:1;position:relative;overflow:hidden;' +
      `background:${PALETTE[album.id % PALETTE.length]};`;
    if (album.cover_id) {
      const img = new Image();
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;position:absolute;inset:0;';
      img.onload = () => thumb.appendChild(img);
      img.onerror = () => {};
      img.src = API.albumCoverUrl(album.id);
    }
    const tagBadge = document.createElement('div');
    tagBadge.style.cssText = `position:absolute;top:8px;left:8px;font-size:9px;font-weight:800;
      letter-spacing:1px;padding:2px 8px;border-radius:12px;
      background:${tagInfo.color}44;color:${tagInfo.color};border:1px solid ${tagInfo.color}66;`;
    tagBadge.textContent = tagInfo.label;
    thumb.appendChild(tagBadge);
    card.appendChild(thumb);

    const info = document.createElement('div');
    info.className = 'alb-grid-info';
    info.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:var(--text-primary);
                  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px">
        ${esc(album.name)}
      </div>
      <div style="font-size:11px;color:var(--text-muted);display:flex;gap:8px">
        <span>🖼 ${album.mediaCount ?? 0}</span>
        <span>👁 ${album.view_count || 0}</span>
        <span style="color:${tagInfo.color}">${_importanceStars(album.importance)}</span>
      </div>
    `;
    card.appendChild(info);

    card.addEventListener('click', () => {
      API.albums.recordView(album.id).catch(() => {});
      store.navigate('starcho:gallery', { albumId: album.id });
    });
    return card;
  }

  // ── List card ─────────────────────────────────────────────────────────────
  function buildListCard(album) {
    const tagInfo = TAG_META[album.tag] || TAG_META.free;
    const card = document.createElement('div');
    card.className = 'alb-list-card';

    const PALETTE = ['#1DB954','#E91E63','#FF6B35','#6C63FF','#00BCD4','#FF9800','#9C27B0'];
    const bgColor = album.color || PALETTE[album.id % PALETTE.length];

    const thumbEl = document.createElement('div');
    thumbEl.className = 'alb-list-thumb-placeholder';
    thumbEl.style.background = bgColor + '33';
    thumbEl.textContent = '📁';
    if (album.cover_id) {
      const img = document.createElement('img');
      img.className = 'alb-list-thumb';
      img.src = API.albumCoverUrl(album.id);
      img.onerror = () => { thumbEl.textContent = '📁'; };
      img.onload  = () => { thumbEl.innerHTML = ''; thumbEl.className = ''; thumbEl.style.cssText = ''; thumbEl.appendChild(img); };
    }
    card.appendChild(thumbEl);

    const info = document.createElement('div');
    info.className = 'alb-list-info';
    info.innerHTML = `
      <div style="font-size:14px;font-weight:700;color:var(--text-primary);
                  white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(album.name)}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:3px;display:flex;gap:10px">
        <span style="background:${tagInfo.color}33;color:${tagInfo.color};border-radius:10px;padding:1px 7px;font-weight:700">${tagInfo.label}</span>
        <span>🖼 ${album.mediaCount ?? 0} archivos</span>
        <span>👁 ${album.view_count || 0} vistas</span>
      </div>
    `;
    card.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'alb-list-actions';
    const viewB = document.createElement('button');
    viewB.className = 'alb-list-icon-btn';
    viewB.title = 'Ver galería';
    viewB.textContent = '🖼️';
    viewB.addEventListener('click', e => {
      e.stopPropagation();
      API.albums.recordView(album.id).catch(() => {});
      store.navigate('starcho:gallery', { albumId: album.id });
    });
    const editB = document.createElement('button');
    editB.className = 'alb-list-icon-btn';
    editB.title = 'Editar';
    editB.textContent = '✏️';
    editB.addEventListener('click', e => { e.stopPropagation(); editAlbum(album, load); });
    const delB = document.createElement('button');
    delB.className = 'alb-list-icon-btn';
    delB.title = 'Eliminar';
    delB.textContent = '🗑️';
    delB.style.color = 'rgba(239,68,68,.7)';
    delB.addEventListener('click', e => { e.stopPropagation(); deleteAlbum(album, load); });
    actions.append(viewB, editB, delB);
    card.appendChild(actions);

    card.addEventListener('click', () => {
      API.albums.recordView(album.id).catch(() => {});
      store.navigate('starcho:gallery', { albumId: album.id });
    });
    return card;
  }

  function buildCard(album, idx, total, dotsBar, maxDots) {
    const card = document.createElement('div');
    card.className = 'alb-tk-card';
    card.style.cssText = 'height:calc(100vh - 200px);min-height:400px;';

    const tagInfo  = TAG_META[album.tag] || TAG_META.free;
    const albumColor = album.color || '#1DB954';

    const PALETTE = [
      'linear-gradient(135deg,#1DB954,#0d7a38)',
      'linear-gradient(135deg,#E91E63,#880E4F)',
      'linear-gradient(135deg,#FF6B35,#c74a1a)',
      'linear-gradient(135deg,#6C63FF,#3d35cc)',
      'linear-gradient(135deg,#00BCD4,#006064)',
      'linear-gradient(135deg,#FF9800,#e65100)',
      'linear-gradient(135deg,#9C27B0,#4A148C)',
      'linear-gradient(135deg,#F44336,#B71C1C)',
    ];

    const bg = document.createElement('div');
    bg.className = 'alb-tk-bg';
    bg.style.background = PALETTE[idx % PALETTE.length];

    // Only probe cover if album has one (avoids 404 in console)
    if (album.cover_id) {
      const coverUrl = API.albumCoverUrl(album.id);
      const probe = new Image();
      probe.onload = () => { bg.style.backgroundImage = `url(${coverUrl})`; bg.style.backgroundSize = 'cover'; };
      probe.src = coverUrl;
    } else if (album.preview_ids) {
      // Mosaic of up to 3 thumbnails when no explicit cover
      const ids = String(album.preview_ids).split(',').slice(0, 3);
      if (ids.length === 1) {
        const probe = new Image();
        probe.onload = () => { bg.style.backgroundImage = `url(${probe.src})`; bg.style.backgroundSize = 'cover'; };
        probe.src = API.mediaThumbUrl(ids[0]);
      } else {
        // 2-3 item mosaic
        bg.style.display = 'grid';
        bg.style.gridTemplateColumns = ids.length === 2 ? '1fr 1fr' : '1fr 1fr';
        bg.style.gridTemplateRows = ids.length === 2 ? '1fr' : '1fr 1fr';
        ids.forEach((id, i) => {
          const cell = document.createElement('div');
          cell.style.cssText = 'overflow:hidden;position:relative;';
          if (ids.length === 3 && i === 0) cell.style.gridRow = '1 / 3';
          const img = document.createElement('img');
          img.src = API.mediaThumbUrl(id);
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
          img.onerror = () => { img.style.display = 'none'; };
          cell.appendChild(img);
          bg.appendChild(cell);
        });
      }
    }

    // Color accent bar at top
    const accentBar = document.createElement('div');
    accentBar.style.cssText = `
      position:absolute;top:0;left:0;right:0;height:4px;
      background:${albumColor};z-index:3;
    `;

    const grad    = document.createElement('div');
    grad.className = 'alb-tk-grad';

    const counter = document.createElement('div');
    counter.className = 'alb-tk-counter';
    counter.textContent = `${idx + 1} / ${total}`;

    // Sidebar buttons
    const sidebar = document.createElement('div');
    sidebar.className = 'alb-tk-sidebar';

    const viewBtn = _tkBtn('🖼️', 'Ver', 'act-view');
    viewBtn.addEventListener('click', e => {
      e.stopPropagation();
      API.albums.recordView(album.id).catch(() => {});
      store.navigate('starcho:gallery', { albumId: album.id });
    });

    const favBtn = _tkBtn(album.is_favorite ? '★' : '☆', 'Fav', 'act-fav');
    if (album.is_favorite) favBtn.classList.add('active');
    favBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const r = await API.albums.favorite(album.id);
        album.is_favorite = r.isFavorite ? 1 : 0;
        favBtn.querySelector('.tk-icon').textContent = album.is_favorite ? '★' : '☆';
        favBtn.classList.toggle('active', !!album.is_favorite);
        if (album.is_favorite) {
          favBtn.classList.remove('pop');
          void favBtn.offsetWidth; // reflow to restart animation
          favBtn.classList.add('pop');
          _burstStars(e);
        }
      } catch (err) { showToast('Error: ' + err.message, 'error'); }
    });

    const commentBtn = _tkBtn('💬', 'Comentar', 'act-comment');
    commentBtn.addEventListener('click', e => {
      e.stopPropagation();
      openAlbumCommentModal(album);
    });

    const editBtn = _tkBtn('✏️', 'Editar', 'act-edit');
    editBtn.addEventListener('click', e => { e.stopPropagation(); editAlbum(album, load); });

    const delBtn = _tkBtn('🗑️', 'Eliminar', 'act-del');
    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteAlbum(album, load); });

    sidebar.append(viewBtn, favBtn, commentBtn, editBtn, delBtn);

    // Bottom info
    const info = document.createElement('div');
    info.className = 'alb-tk-info';

    const hasPrice = album.price && parseFloat(album.price) > 0;
    const currSym  = CURRENCY_SYMBOL[album.currency] || album.currency || '';
    const priceStr = hasPrice ? `${currSym}${parseFloat(album.price).toLocaleString('es')}` : '';

    info.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span style="
          font-size:10px;font-weight:800;letter-spacing:1px;
          padding:3px 10px;border-radius:20px;
          background:${tagInfo.color}33;color:${tagInfo.color};
          border:1px solid ${tagInfo.color}66;
        ">${tagInfo.label}</span>
        ${hasPrice ? `<span style="
          font-size:11px;font-weight:700;
          background:rgba(255,255,255,.15);border-radius:20px;padding:3px 10px;
        ">💰 ${priceStr}</span>` : ''}
        ${album.payment_method ? `<span style="
          font-size:10px;background:rgba(255,255,255,.1);border-radius:20px;padding:2px 8px;
        ">💳 ${esc(album.payment_method)}</span>` : ''}
      </div>
      <div style="font-size:22px;font-weight:800;margin-bottom:4px;
                  text-shadow:0 2px 8px rgba(0,0,0,.6);line-height:1.2">
        ${esc(album.name)}
      </div>
      <div style="font-size:13px;margin-bottom:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="opacity:.8;font-weight:600">${album.mediaCount ?? 0} archivo${(album.mediaCount ?? 0) !== 1 ? 's' : ''}</span>
        <span style="opacity:.6;font-size:11px">${_importanceStars(album.importance)}</span>
        <span style="opacity:.55;font-size:11px">👁 ${album.view_count || 0} vistas</span>
      </div>
      ${album.description || album.objective
        ? `<div style="font-size:12px;opacity:.65;max-width:300px;line-height:1.5">
            ${esc(album.objective || album.description)}
           </div>`
        : ''}
    `;

    card.append(accentBar, bg, grad, counter, sidebar, info);

    card.addEventListener('click', e => {
      if (e.target.closest('.alb-tk-action')) return;
      API.albums.recordView(album.id).catch(() => {});
      store.navigate('starcho:gallery', { albumId: album.id });
    });

    return card;
  }

  function emptyState() {
    const div = document.createElement('div');
    div.style.cssText = `
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      height:calc(100vh - 200px);min-height:400px;
      color:var(--text-muted);text-align:center;padding:40px;
    `;
    div.innerHTML = `
      <div style="font-size:64px;margin-bottom:20px">📁</div>
      <div style="font-size:18px;font-weight:700;margin-bottom:8px;color:var(--text-primary)">Sin álbumes aún</div>
      <div style="font-size:13px;margin-bottom:24px;max-width:280px;line-height:1.5">
        Ve a la Galería, selecciona fotos o videos y toca <strong>Agregar a álbum</strong>
      </div>
      <button class="btn btn-primary" id="empty-gallery-btn">🖼️ Abrir Galería</button>
    `;
    div.querySelector('#empty-gallery-btn').addEventListener('click', () => store.navigate('starcho:gallery'));
    return div;
  }

  // ── Top bar events ────────────────────────────────────────────────────────
  topBar.querySelector('#alb-goto-gallery').addEventListener('click', () => store.navigate('starcho:gallery'));
  topBar.querySelector('#alb-new-btn').addEventListener('click', () => openCreateAlbumModal(load));

  await load();
}

// ── Album comment modal ───────────────────────────────────────────────────────

async function openAlbumCommentModal(album) {
  let rows = [];
  try { rows = await API.albums.comments(album.id); } catch (_) {}

  const commentList = rows.length
    ? rows.map(c => `
        <div style="padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="font-weight:700;font-size:12px;color:var(--text-primary)">${esc(c.author)}</span>
          <span style="color:var(--text-muted);font-size:11px;margin-left:6px">${new Date(c.created_at).toLocaleDateString()}</span>
          <div style="font-size:13px;color:var(--text-secondary);margin-top:3px">${esc(c.text)}</div>
        </div>`).join('')
    : '<p style="color:var(--text-muted);font-size:13px">Sin comentarios aún.</p>';

  openModal({
    title: `💬 Comentarios — ${esc(album.name)}`,
    body: `
      <div style="max-height:220px;overflow-y:auto;margin-bottom:16px">${commentList}</div>
      <div style="display:flex;gap:8px">
        <input type="text" class="form-control" id="alb-cm-inp" placeholder="Escribe un comentario…" style="flex:1">
        <button class="btn btn-primary" id="alb-cm-send">Enviar</button>
      </div>`,
    buttons: [{ label: 'Cerrar', action: 'close' }],
    onClose: () => {},
  });
  setTimeout(() => {
    const inp = document.getElementById('alb-cm-inp');
    const btn = document.getElementById('alb-cm-send');
    if (!inp || !btn) return;
    const send = async () => {
      const text = inp.value.trim();
      if (!text) return;
      try {
        await API.albums.addComment(album.id, text, 'Usuario');
        inp.value = '';
        showToast('✅ Comentario agregado');
      } catch (err) { showToast('Error: ' + err.message, 'error'); }
    };
    btn.addEventListener('click', send);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    inp.focus();
  }, 80);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _tkBtn(icon, label, type = '') {
  const btn = document.createElement('div');
  btn.className = 'alb-tk-action' + (type ? ' ' + type : '');
  btn.title = label;
  btn.innerHTML = `<span class="tk-icon">${icon}</span><span>${label}</span>`;
  return btn;
}

function _albumFormHTML(album = {}) {
  const tags = ['free','pro','regalo','vip','amigos','membrecia','telegram','wsp'];
  const currencies = [
    { v:'tokens', l:'🪙 Tokens' }, { v:'usd', l:'$ USD' }, { v:'eur', l:'€ EUR' },
    { v:'cop', l:'COP$ Pesos Col.' }, { v:'mxn', l:'MX$ Pesos Mex.' },
    { v:'ars', l:'AR$ Pesos Arg.' }, { v:'pen', l:'S/ Soles' }, { v:'crypto', l:'₿ Cripto' },
  ];

  return `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                      margin-bottom:6px;color:var(--text-muted)">NOMBRE</label>
        <input type="text" class="form-control" id="alb-f-name"
               value="${esc(album.name || '')}" placeholder="Nombre del álbum" style="width:100%">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                        margin-bottom:6px;color:var(--text-muted)">ETIQUETA</label>
          <select class="form-control" id="alb-f-tag" style="width:100%">
            ${tags.map(t => `<option value="${t}" ${album.tag === t ? 'selected' : ''}>${t.toUpperCase()}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                        margin-bottom:6px;color:var(--text-muted)">COLOR</label>
          <input type="color" id="alb-f-color" value="${album.color || '#1DB954'}"
                 style="width:100%;height:36px;border-radius:6px;border:none;cursor:pointer;background:none">
        </div>
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                      margin-bottom:8px;color:var(--text-muted)">IMPORTANCIA</label>
        <div id="alb-f-imp-stars" style="display:flex;gap:8px">
          ${Array.from({length:5},(_,i) => `
            <span data-imp="${i+1}" style="font-size:26px;cursor:pointer;
                  color:${i < (album.importance||1) ? '#FFD700' : 'rgba(255,255,255,.2)'};
                  transition:transform .1s">★</span>
          `).join('')}
        </div>
        <input type="hidden" id="alb-f-importance" value="${album.importance || 1}">
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                      margin-bottom:6px;color:var(--text-muted)">DESCRIPCIÓN / OBJETIVO</label>
        <textarea class="form-control" id="alb-f-obj" rows="2"
                  placeholder="Objetivo o descripción del álbum…"
                  style="width:100%;resize:vertical">${esc(album.objective || album.description || '')}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                        margin-bottom:6px;color:var(--text-muted)">PRECIO</label>
          <input type="number" class="form-control" id="alb-f-price" min="0" step="0.01"
                 value="${album.price || 0}" style="width:100%">
        </div>
        <div>
          <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                        margin-bottom:6px;color:var(--text-muted)">MONEDA</label>
          <select class="form-control" id="alb-f-currency" style="width:100%">
            ${currencies.map(c => `<option value="${c.v}" ${album.currency === c.v ? 'selected' : ''}>${c.l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.8px;
                      margin-bottom:6px;color:var(--text-muted)">FORMA DE PAGO</label>
        <input type="text" class="form-control" id="alb-f-payment"
               value="${esc(album.payment_method || '')}"
               placeholder="PayPal, transferencia, cripto…" style="width:100%">
      </div>
    </div>`;
}

function _burstStars(e) {
  const N = 8;
  for (let i = 0; i < N; i++) {
    const s = document.createElement('div');
    const angle = (360 / N) * i;
    const dist  = 50 + Math.random() * 30;
    s.textContent = '⭐';
    s.style.cssText = `
      position:fixed;left:${e.clientX}px;top:${e.clientY}px;
      font-size:${12 + Math.random() * 8}px;
      pointer-events:none;z-index:99999;
      transition:transform .6s ease-out,opacity .6s ease-out;
      transform:translate(-50%,-50%);
    `;
    document.body.appendChild(s);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const rad = angle * Math.PI / 180;
      s.style.transform = `translate(calc(-50% + ${Math.cos(rad)*dist}px), calc(-50% + ${Math.sin(rad)*dist}px)) scale(0)`;
      s.style.opacity = '0';
    }));
    setTimeout(() => s.remove(), 700);
  }
}

function _wireImpStars(defaultVal) {
  setTimeout(() => {
    const container = document.getElementById('alb-f-imp-stars');
    const hidden    = document.getElementById('alb-f-importance');
    if (!container || !hidden) return;
    let current = parseInt(defaultVal) || 1;

    function update(v) {
      current = v;
      hidden.value = v;
      container.querySelectorAll('span').forEach((s, i) => {
        s.style.color = i < v ? '#FFD700' : 'rgba(255,255,255,.2)';
      });
    }

    container.querySelectorAll('span').forEach(s => {
      s.addEventListener('click', () => update(parseInt(s.dataset.imp)));
      s.addEventListener('mouseover', () => {
        container.querySelectorAll('span').forEach((ss, i) => {
          ss.style.color = i < parseInt(s.dataset.imp) ? '#FFD700' : 'rgba(255,255,255,.2)';
        });
      });
      s.addEventListener('mouseout', () => update(current));
    });
  }, 80);
}

function _readForm() {
  return {
    name:           document.getElementById('alb-f-name')?.value.trim() || '',
    tag:            document.getElementById('alb-f-tag')?.value || 'free',
    color:          document.getElementById('alb-f-color')?.value || '#1DB954',
    importance:     parseInt(document.getElementById('alb-f-importance')?.value) || 1,
    objective:      document.getElementById('alb-f-obj')?.value.trim() || '',
    price:          parseFloat(document.getElementById('alb-f-price')?.value) || 0,
    currency:       document.getElementById('alb-f-currency')?.value || 'usd',
    payment_method: document.getElementById('alb-f-payment')?.value.trim() || '',
  };
}

function openCreateAlbumModal(reload) {
  openModal({
    title: '📁 Nuevo álbum',
    body: _albumFormHTML({}),
    buttons: [
      { label: 'Cancelar', action: 'cancel' },
      { label: '＋ Crear', action: 'create', primary: true },
    ],
    onClose: async (action) => {
      if (action !== 'create') return;
      const d = _readForm();
      if (!d.name) { showToast('Nombre requerido', 'error'); return; }
      try {
        await API.albums.create(d);
        showToast('✅ Álbum creado');
        reload();
      } catch (err) { showToast('Error: ' + err.message, 'error'); }
    },
  });
  _wireImpStars(1);
}

function editAlbum(album, reload) {
  openModal({
    title: '✏️ Editar álbum',
    body: _albumFormHTML(album),
    buttons: [
      { label: 'Cancelar', action: 'cancel' },
      { label: '💾 Guardar', action: 'save', primary: true },
    ],
    onClose: async (action) => {
      if (action !== 'save') return;
      const d = _readForm();
      if (!d.name) { showToast('Nombre requerido', 'error'); return; }
      try {
        await API.albums.update(album.id, d);
        showToast('✅ Álbum actualizado');
        reload();
      } catch (err) { showToast('Error: ' + err.message, 'error'); }
    },
  });
  _wireImpStars(album.importance || 1);
}

function deleteAlbum(album, reload) {
  const count = album.mediaCount ?? 0;
  openModal({
    title: '🗑️ Eliminar álbum',
    body: `
      <p style="color:var(--text-muted);font-size:14px;line-height:1.6">
        ¿Eliminar <strong style="color:var(--text-primary)">${esc(album.name)}</strong>?<br>
        ${count > 0
          ? `<span style="font-size:12px;color:#FF9800">⚠️ Este álbum contiene <strong>${count} archivo${count !== 1 ? 's' : ''}</strong>. No se eliminarán, solo se desvinculan del álbum.</span>`
          : `<span style="font-size:12px;opacity:.7">El álbum está vacío.</span>`}
      </p>`,
    buttons: [
      { label: 'Cancelar',     action: 'cancel' },
      { label: '🗑️ Eliminar',  action: 'del' },
    ],
    onClose: async (action) => {
      if (action !== 'del') return;
      try {
        await API.albums.delete(album.id);
        showToast('Álbum eliminado');
        reload();
      } catch (err) { showToast('Error: ' + err.message, 'error'); }
    },
  });
}
