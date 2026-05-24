/**
 * VideoFeed — TikTok-style vertical scroll of videos.
 * IntersectionObserver auto-plays/pauses. Like, rate, info sidebar.
 * Mini-player popup (draggable, floating, picture-in-picture style).
 */
import API   from '../../../../src/renderer/utils/api.js';
import store from '../../../../src/renderer/store.js';
import { openModal, showToast } from '../../../../src/renderer/components/Modal.js';
import { esc } from '../../../../src/renderer/utils/html.js';

const TAG_META = {
  free:'#06D6A0', pro:'#FFD700', regalo:'#FF6B35',
  vip:'#E91E63', amigos:'#1DB954', membrecia:'#6C63FF',
  telegram:'#0088CC', wsp:'#25D366',
};
const CURRENCY_SYMBOL = {
  tokens:'🪙', usd:'$', eur:'€', cop:'COP$',
  mxn:'MX$', ars:'AR$', pen:'S/', crypto:'₿',
};

// ── Styles (injected once) ────────────────────────────────────────────────────
function _injectStyles() {
  if (document.getElementById('vf-styles')) return;
  const s = document.createElement('style');
  s.id = 'vf-styles';
  s.textContent = `
    @keyframes vf-heart-burst {
      0%   { transform:scale(1) translateY(0); opacity:1; }
      40%  { transform:scale(1.8) translateY(-10px); opacity:1; }
      100% { transform:scale(2.5) translateY(-60px); opacity:0; }
    }
    @keyframes vf-heart-pop {
      0%,100% { transform:scale(1); }
      40%     { transform:scale(1.5); }
    }
    .vf-heart-float { position:fixed;pointer-events:none;z-index:9999;font-size:30px;
                      animation:vf-heart-burst 1s ease forwards; }
    .vf-btn { display:flex;flex-direction:column;align-items:center;gap:5px;
              cursor:pointer;color:#fff;transition:transform .15s;
              background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.15);
              backdrop-filter:blur(6px);border-radius:50px;
              padding:12px 14px;min-width:56px;text-align:center; }
    .vf-btn:hover { transform:scale(1.1); }
    .vf-btn .vf-icon { font-size:24px;line-height:1; }
    .vf-btn .vf-label { font-size:10px;font-weight:700;letter-spacing:.5px; }
    .vf-rating-heart { cursor:pointer;font-size:22px;transition:transform .1s; }
    .vf-rating-heart:hover { transform:scale(1.3); }
    #mh-mini-player { position:fixed;bottom:80px;right:20px;z-index:9998;
                      border-radius:14px;overflow:hidden;
                      box-shadow:0 8px 32px rgba(0,0,0,.6);
                      background:var(--bg-3);border:1px solid rgba(255,255,255,.1);
                      resize:both;min-width:240px;min-height:140px; }
    #mh-mini-player .mp-header { cursor:grab;padding:8px 10px;background:rgba(0,0,0,.4);
                                  display:flex;align-items:center;justify-content:space-between; }
    #mh-mini-player .mp-header:active { cursor:grabbing; }
    #mh-mini-player video { width:100%;display:block;max-height:220px;object-fit:contain;
                             background:#000; }
  `;
  document.head.appendChild(s);
}

// ── Mini player singleton ─────────────────────────────────────────────────────
function openMiniPlayer(mediaId, title) {
  document.getElementById('mh-mini-player')?.remove();

  const mp = document.createElement('div');
  mp.id = 'mh-mini-player';

  const videoUrl = API.mediaViewUrl(mediaId);
  mp.innerHTML = `
    <div class="mp-header">
      <span style="font-size:11px;font-weight:700;color:#fff;overflow:hidden;
                   text-overflow:ellipsis;white-space:nowrap;max-width:180px">
        ${esc(title || 'Video')}
      </span>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button id="mp-expand" title="Ver completo"
                style="background:none;border:none;color:rgba(255,255,255,.8);
                       cursor:pointer;font-size:16px;padding:0">⊡</button>
        <button id="mp-close" title="Cerrar"
                style="background:none;border:none;color:rgba(255,255,255,.8);
                       cursor:pointer;font-size:16px;padding:0">✕</button>
      </div>
    </div>
    <video src="${esc(videoUrl)}" controls autoplay
           style="width:100%;display:block;max-height:200px;object-fit:contain;background:#000"></video>
  `;

  document.body.appendChild(mp);
  _makeDraggable(mp, mp.querySelector('.mp-header'));

  mp.querySelector('#mp-close').addEventListener('click', () => mp.remove());
  mp.querySelector('#mp-expand').addEventListener('click', () => {
    mp.remove();
    store.navigate('starcho:video-viewer', { id: mediaId });
  });
}

function _makeDraggable(el, handle) {
  let ox = 0, oy = 0, sx = 0, sy = 0;
  handle.addEventListener('mousedown', e => {
    ox = el.offsetLeft; oy = el.offsetTop;
    sx = e.clientX;    sy = e.clientY;
    const onMove = e2 => {
      el.style.right  = 'auto';
      el.style.bottom = 'auto';
      el.style.left   = Math.max(0, ox + e2.clientX - sx) + 'px';
      el.style.top    = Math.max(0, oy + e2.clientY - sy) + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ── Main render ───────────────────────────────────────────────────────────────
export async function renderVideoFeed(el) {
  _injectStyles();
  el.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';
  el.innerHTML = '';

  // Top bar
  const topBar = document.createElement('div');
  topBar.style.cssText = `
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 16px;flex-shrink:0;z-index:10;
    background:linear-gradient(to bottom,var(--bg-1) 0%,transparent 100%);
  `;
  topBar.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">📹</span>
      <span style="font-size:15px;font-weight:700;color:var(--text-primary)">Video Feed</span>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <select id="vf-album-filter" class="form-control" style="font-size:12px">
        <option value="">Todos los videos</option>
      </select>
      <button class="btn btn-sm btn-secondary" id="vf-gallery-btn">🖼️ Galería</button>
    </div>
  `;
  el.appendChild(topBar);

  // Feed container
  const feed = document.createElement('div');
  feed.style.cssText = `
    flex:1;overflow-y:auto;overflow-x:hidden;
    scroll-snap-type:y mandatory;
  `;
  el.appendChild(feed);

  // State
  let videos  = [];
  let albums  = [];
  let albumMap= {};
  let filterAlbumId = '';

  // Load albums for filter
  try {
    albums = await API.albums.list();
    const sel = topBar.querySelector('#vf-album-filter');
    albums.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      sel.appendChild(opt);
    });
    albumMap = Object.fromEntries(albums.map(a => [a.id, a]));
  } catch (_) {}

  async function load() {
    feed.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted)">Cargando videos…</div>';
    try {
      const params = { type: 'video', perPage: 50 };
      if (filterAlbumId) params.albumId = filterAlbumId;
      const res = await API.media.list(params);
      videos = res.items || [];
    } catch (err) {
      feed.innerHTML = `<div style="color:#FF3366;padding:40px;text-align:center">${esc(err.message)}</div>`;
      return;
    }

    if (!videos.length) {
      feed.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                    height:100%;color:var(--text-muted);text-align:center;padding:40px">
          <div style="font-size:64px;margin-bottom:16px">🎬</div>
          <div style="font-size:16px;font-weight:700;color:var(--text-primary)">Sin videos</div>
          <div style="font-size:13px;margin:8px 0 20px">Sube videos desde la pestaña Upload</div>
          <button class="btn btn-primary" id="vf-go-upload">📤 Ir a Upload</button>
        </div>`;
      feed.querySelector('#vf-go-upload')?.addEventListener('click', () => store.navigate('starcho:upload'));
      return;
    }

    feed.innerHTML = '';
    const cards = videos.map(v => buildCard(v));

    // IntersectionObserver for autoplay
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const vid = entry.target.querySelector('video.vf-vid');
        if (!vid) return;
        if (entry.isIntersecting) { vid.play().catch(() => {}); }
        else { vid.pause(); }
      });
    }, { threshold: 0.55 });

    cards.forEach(c => { feed.appendChild(c); observer.observe(c); });

    // Disconnect on navigation away
    const obs = new MutationObserver(() => {
      if (!document.body.contains(el)) { observer.disconnect(); obs.disconnect(); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function buildCard(media) {
    const card = document.createElement('div');
    card.style.cssText = `
      position:relative;overflow:hidden;display:flex;align-items:flex-end;
      height:calc(100vh - 150px);min-height:400px;background:#000;
      scroll-snap-align:start;
    `;

    const videoUrl = API.mediaViewUrl(media.id);
    const album    = albumMap[media.album_id];
    const tagColor = album ? (TAG_META[album.tag] || '#06D6A0') : null;
    const displayTitle = media.title || media.file_name;

    // Video element
    const vid = document.createElement('video');
    vid.className = 'vf-vid';
    vid.src   = videoUrl;
    vid.loop  = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.style.cssText = `
      position:absolute;inset:0;width:100%;height:100%;
      object-fit:contain;background:#000;
    `;

    // Unmute on click (browser autoplay policy)
    let muted = true;
    vid.addEventListener('click', () => { muted = !muted; vid.muted = muted; muteBtn.textContent = muted ? '🔇' : '🔊'; });

    // Mute toggle
    const muteBtn = document.createElement('button');
    muteBtn.textContent = '🔇';
    muteBtn.title = 'Activar sonido';
    muteBtn.style.cssText = `
      position:absolute;top:14px;left:14px;z-index:4;
      background:rgba(0,0,0,.5);border:none;border-radius:50%;
      width:36px;height:36px;cursor:pointer;font-size:16px;
      color:#fff;display:flex;align-items:center;justify-content:center;
    `;
    muteBtn.addEventListener('click', e => {
      e.stopPropagation();
      muted = !muted;
      vid.muted = muted;
      muteBtn.textContent = muted ? '🔇' : '🔊';
    });

    // Gradient overlay
    const grad = document.createElement('div');
    grad.style.cssText = `
      position:absolute;inset:0;
      background:linear-gradient(to bottom,
        rgba(0,0,0,.1) 0%,rgba(0,0,0,0) 35%,
        rgba(0,0,0,.7) 70%,rgba(0,0,0,.95) 100%);
      pointer-events:none;
    `;

    // Right sidebar
    const sidebar = document.createElement('div');
    sidebar.style.cssText = `
      position:absolute;right:14px;bottom:100px;z-index:3;
      display:flex;flex-direction:column;align-items:center;gap:14px;
    `;

    // Like button
    const likeBtn = document.createElement('div');
    likeBtn.className = 'vf-btn';
    likeBtn.innerHTML = `<span class="vf-icon">❤️</span><span class="vf-label" id="lc-${media.id}">${_fmtNum(media.likes || 0)}</span>`;
    likeBtn.addEventListener('click', async e => {
      e.stopPropagation();
      try {
        const r = await API.media.like(media.id);
        const lc = document.getElementById(`lc-${media.id}`);
        if (lc) lc.textContent = _fmtNum(r.likes);
        _floatHeart(e);
        likeBtn.style.animation = 'vf-heart-pop .3s ease';
        setTimeout(() => likeBtn.style.animation = '', 350);
      } catch (_) {}
    });

    // Rate button
    const rateBtn = document.createElement('div');
    rateBtn.className = 'vf-btn';
    rateBtn.innerHTML = `
      <span class="vf-icon">⭐</span>
      <span class="vf-label">${media.rating > 0 ? media.rating.toFixed(1) : '—'}</span>
    `;
    rateBtn.addEventListener('click', e => {
      e.stopPropagation();
      openRateModal(media, rateBtn);
    });

    // Info button (album details)
    const infoBtn = document.createElement('div');
    infoBtn.className = 'vf-btn';
    infoBtn.innerHTML = `<span class="vf-icon">ℹ️</span><span class="vf-label">Info</span>`;
    infoBtn.addEventListener('click', e => {
      e.stopPropagation();
      openInfoModal(media, album);
    });

    // Mini player button
    const miniBtn = document.createElement('div');
    miniBtn.className = 'vf-btn';
    miniBtn.innerHTML = `<span class="vf-icon">⊡</span><span class="vf-label">Mini</span>`;
    miniBtn.addEventListener('click', e => {
      e.stopPropagation();
      openMiniPlayer(media.id, media.title || media.file_name);
    });

    // Expand to full viewer
    const expandBtn = document.createElement('div');
    expandBtn.className = 'vf-btn';
    expandBtn.innerHTML = `<span class="vf-icon">⛶</span><span class="vf-label">Abrir</span>`;
    expandBtn.addEventListener('click', e => {
      e.stopPropagation();
      vid.pause();
      store.navigate('starcho:video-viewer', { id: media.id });
    });

    sidebar.append(likeBtn, rateBtn, infoBtn, miniBtn, expandBtn);

    // Bottom info
    const info = document.createElement('div');
    info.style.cssText = `
      position:relative;z-index:3;padding:0 80px 24px 16px;color:#fff;
    `;
    info.innerHTML = `
      ${album ? `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="font-size:10px;font-weight:800;letter-spacing:.8px;
                       padding:2px 9px;border-radius:20px;
                       background:${tagColor}33;color:${tagColor};border:1px solid ${tagColor}55">
            ${(album.tag || 'free').toUpperCase()}
          </span>
          <span style="font-size:11px;opacity:.75">📁 ${esc(album.name)}</span>
        </div>` : ''}
      <div style="font-size:17px;font-weight:800;margin-bottom:4px;line-height:1.3;
                  text-shadow:0 2px 8px rgba(0,0,0,.7)">
        ${esc(displayTitle)}
      </div>
      ${media.description ? `
        <div style="font-size:12px;opacity:.75;max-width:280px;line-height:1.5;margin-top:4px">
          ${esc(media.description)}
        </div>` : ''}
    `;

    card.append(vid, muteBtn, grad, sidebar, info);

    // Double-tap to like
    let lastTap = 0;
    card.addEventListener('click', e => {
      const now = Date.now();
      if (now - lastTap < 350) {
        e.stopPropagation();
        API.media.like(media.id).then(r => {
          const lc = document.getElementById(`lc-${media.id}`);
          if (lc) lc.textContent = _fmtNum(r.likes);
          _floatHeart(e);
        }).catch(() => {});
      }
      lastTap = now;
    });

    return card;
  }

  // ── Rate modal ────────────────────────────────────────────────────────────
  function openRateModal(media, triggerEl) {
    let chosen = 0;
    openModal({
      title: '⭐ Calificar video',
      body: `
        <div style="text-align:center">
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
            Toca para calificar del 1 al 10
          </div>
          <div id="vf-rate-hearts" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            ${Array.from({length:10},(_,i)=>`
              <span class="vf-rating-heart" data-v="${i+1}"
                    style="color:rgba(255,107,157,.3)">❤️</span>`).join('')}
          </div>
          <div id="vf-rate-val" style="margin-top:14px;font-size:22px;font-weight:800;color:#FF6B9D">—</div>
        </div>`,
      buttons: [
        { label: 'Cancelar', action: 'cancel' },
        { label: '✅ Calificar', action: 'save', primary: true },
      ],
      onClose: async (action) => {
        if (action !== 'save' || !chosen) return;
        try {
          const r = await API.media.rate(media.id, chosen);
          triggerEl.querySelector('.vf-label').textContent = r.rating.toFixed(1);
          showToast(`⭐ Calificado ${chosen}/10`);
        } catch (err) { showToast('Error: ' + err.message, 'error'); }
      },
    });

    setTimeout(() => {
      const container = document.getElementById('vf-rate-hearts');
      const valEl     = document.getElementById('vf-rate-val');
      if (!container) return;
      container.querySelectorAll('.vf-rating-heart').forEach(h => {
        h.addEventListener('click', () => {
          chosen = parseInt(h.dataset.v);
          _updateHearts(container, chosen);
          if (valEl) valEl.textContent = chosen + '/10';
        });
        h.addEventListener('mouseover', () => _updateHearts(container, parseInt(h.dataset.v)));
        h.addEventListener('mouseout',  () => _updateHearts(container, chosen));
      });
    }, 80);
  }

  function _updateHearts(container, v) {
    container.querySelectorAll('.vf-rating-heart').forEach((h, i) => {
      h.style.color = i < v ? '#FF6B9D' : 'rgba(255,107,157,.3)';
    });
  }

  // ── Info modal (album details) ────────────────────────────────────────────
  function openInfoModal(media, album) {
    const currSym = CURRENCY_SYMBOL[album?.currency] || album?.currency || '';
    const hasPrice = album && album.price && parseFloat(album.price) > 0;
    openModal({
      title: '📋 Información',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);
                        letter-spacing:.8px;margin-bottom:4px">TÍTULO</div>
            <div style="font-size:15px;font-weight:700;color:var(--text-primary)">
              ${esc(media.title || media.file_name)}
            </div>
          </div>
          ${media.description ? `
            <div>
              <div style="font-size:11px;font-weight:700;color:var(--text-muted);
                          letter-spacing:.8px;margin-bottom:4px">DESCRIPCIÓN</div>
              <div style="font-size:13px;color:var(--text-primary);line-height:1.5">
                ${esc(media.description)}
              </div>
            </div>` : ''}
          <div style="display:flex;gap:12px;font-size:12px;color:var(--text-muted)">
            <span>❤️ ${media.likes || 0} likes</span>
            <span>⭐ ${media.rating > 0 ? media.rating.toFixed(1) + '/10' : '—'}</span>
            <span>👁 ${media.view_count || 0} vistas</span>
          </div>
          ${album ? `
            <div style="border-top:1px solid rgba(255,255,255,.08);padding-top:12px">
              <div style="font-size:11px;font-weight:700;color:var(--text-muted);
                          letter-spacing:.8px;margin-bottom:8px">ÁLBUM</div>
              <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:6px">
                📁 ${esc(album.name)}
              </div>
              ${album.objective || album.description ? `
                <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">
                  ${esc(album.objective || album.description)}
                </div>` : ''}
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px;
                             background:rgba(255,255,255,.1);color:rgba(255,255,255,.8)">
                  ${(album.tag || 'free').toUpperCase()}
                </span>
                ${hasPrice ? `<span style="font-size:11px;font-weight:700;
                                  background:rgba(255,255,255,.1);border-radius:20px;padding:2px 9px">
                  💰 ${currSym}${parseFloat(album.price).toLocaleString('es')}
                </span>` : ''}
                ${album.payment_method ? `<span style="font-size:11px;
                    background:rgba(255,255,255,.08);border-radius:20px;padding:2px 9px">
                  💳 ${esc(album.payment_method)}
                </span>` : ''}
                <span style="font-size:11px;background:rgba(255,255,255,.08);
                             border-radius:20px;padding:2px 9px">
                  👁 ${album.view_count || 0} vistas
                </span>
              </div>
            </div>` : ''}
        </div>`,
      buttons: [{ label: 'Cerrar', action: 'close' }],
    });
  }

  // ── Wire top bar ──────────────────────────────────────────────────────────
  topBar.querySelector('#vf-gallery-btn').addEventListener('click', () =>
    store.navigate('starcho:gallery')
  );
  topBar.querySelector('#vf-album-filter').addEventListener('change', e => {
    filterAlbumId = e.target.value;
    load();
  });

  await load();
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function _floatHeart(e) {
  const h = document.createElement('div');
  h.className = 'vf-heart-float';
  h.textContent = '❤️';
  h.style.left = (e.clientX - 15) + 'px';
  h.style.top  = (e.clientY - 15) + 'px';
  document.body.appendChild(h);
  setTimeout(() => h.remove(), 1050);
}

function _fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return String(n || 0);
}
