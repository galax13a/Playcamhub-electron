/**
 * Starcho plugin — frontend registration.
 *
 * Contributes:
 *  - 4 sidebar nav items (Library, YouTube, Import, History)
 *    Each item has a labelKey so the Sidebar can translate the label via i18n.t()
 *    when the language changes — no rebuild of the plugin is needed.
 *  - 5 view renderers (library, youtube, upload, history, playlist)
 *  - 3 dashboard widgets:
 *      • starcho-now-playing  zone:header  priority:100  — transport controls for current song
 *      • starcho-library-card zone:content priority:100  — song/playlist count + disk usage
 *      • starcho-youtube-card zone:content priority:90   — queue stats + quick-add URL input
 */
import store from '../../../src/renderer/store.js';
import API   from '../../../src/renderer/utils/api.js';

export default {
  id: 'starcho',
  hasSidebarPlaylists: true,

  navItems: [
    { view: 'starcho:library',  icon: '🎵', labelKey: 'nav_library',  label: 'Library'  },
    { view: 'starcho:youtube',  icon: '📥', labelKey: 'nav_youtube',  label: 'YouTube'  },
    { view: 'starcho:upload',   icon: '📂', labelKey: 'nav_import',   label: 'Import'   },
    { view: 'starcho:history',  icon: '🕐', labelKey: 'nav_history',  label: 'History'  },
  ],

  views: {
    'starcho:library': async (el, extra) => {
      const { renderLibrary } = await import('../../../src/renderer/components/Library.js');
      renderLibrary(el, extra);
    },
    'starcho:youtube': async (el) => {
      const { renderYouTubeDashboard } = await import('../../../src/renderer/components/Search.js');
      renderYouTubeDashboard(el);
    },
    'starcho:upload': async (el, extra) => {
      const { renderUpload } = await import('../../../src/renderer/components/Upload.js');
      renderUpload(el, extra);
    },
    'starcho:history': async (el, extra) => {
      const { renderHistory } = await import('../../../src/renderer/components/History.js');
      renderHistory(el, extra);
    },
    'starcho:playlist': async (el, extra) => {
      const { renderPlaylistView } = await import('../../../src/renderer/components/PlaylistView.js');
      renderPlaylistView(el, extra);
    },
  },

  // ── Dashboard widgets ──────────────────────────────────────────────────────

  dashboardWidgets: [

    // Header zone: currently playing song with transport controls
    {
      id:       'starcho-now-playing',
      zone:     'header',
      priority: 100,
      title:    '🎵 Reproduciendo ahora',
      async render(el) {
        const song = store.state.currentSong;

        if (!song) {
          el.innerHTML = `
            <div style="display:flex;align-items:center;gap:14px;padding:4px 0">
              <span style="font-size:28px">🎶</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text-primary)">Sin música activa</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Ve a Biblioteca para comenzar</div>
              </div>
              <button class="btn btn-sm btn-primary" style="margin-left:auto" id="sbtn-goto-lib">
                Ir a Biblioteca
              </button>
            </div>`;
          el.querySelector('#sbtn-goto-lib')?.addEventListener('click', () =>
            store.navigate('starcho:library'));
          return;
        }

        const thumb = song.thumbnail ? API.thumbnailUrl(song.thumbnail) : '';
        el.innerHTML = `
          <div style="display:flex;align-items:center;gap:14px;padding:4px 0">
            ${thumb
              ? `<img src="${_esc(thumb)}" width="48" height="48"
                      style="border-radius:8px;object-fit:cover;flex-shrink:0" data-err="bg">`
              : `<div style="width:48px;height:48px;border-radius:8px;background:var(--bg-3);
                             display:flex;align-items:center;justify-content:center;font-size:22px">🎵</div>`}
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:700;color:var(--text-primary);
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                ${_esc(song.title || song.filename || '—')}
              </div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
                ${_esc(song.artist || 'Artista desconocido')}
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0">
              <button class="btn btn-sm btn-secondary" id="sw-prev">⏮</button>
              <button class="btn btn-sm btn-primary"   id="sw-play">${store.state.isPlaying ? '⏸' : '▶'}</button>
              <button class="btn btn-sm btn-secondary" id="sw-next">⏭</button>
            </div>
          </div>`;

        el.querySelector('#sw-prev')?.addEventListener('click', () => store.prevSong());
        el.querySelector('#sw-play')?.addEventListener('click', () => store.togglePlay());
        el.querySelector('#sw-next')?.addEventListener('click', () => store.nextSong());
      },
    },

    // Content zone: library overview stats
    {
      id:       'starcho-library-card',
      zone:     'content',
      priority: 100,
      title:    '🎵 Biblioteca',
      async render(el) {
        const songs     = store.state.songs     || [];
        const playlists = store.state.playlists || [];
        const queue     = store.state.downloadQueue || [];
        const pending   = queue.filter(i => ['downloading', 'pending'].includes(i.status)).length;

        let diskText = '—';
        try {
          const stats = await API.songs.stats();
          diskText    = _fmtBytes(stats.diskBytes);
        } catch (_) {}

        el.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              ${_statRow('🎵', 'Canciones',  songs.length)}
              ${_statRow('📋', 'Playlists',  playlists.length)}
              ${_statRow('💾', 'En disco',   diskText)}
              ${_statRow('📥', 'Pendientes', pending)}
            </div>
            <button class="btn btn-sm btn-primary" style="width:100%;margin-top:2px" id="sbtn-lib">
              Abrir Biblioteca
            </button>
          </div>`;

        el.querySelector('#sbtn-lib')?.addEventListener('click', () =>
          store.navigate('starcho:library'));
      },
    },

    // Content zone: YouTube quick-add card
    {
      id:       'starcho-youtube-card',
      zone:     'content',
      priority: 90,
      title:    '📥 YouTube Downloader',
      async render(el) {
        const queue       = store.state.downloadQueue || [];
        const downloading = queue.filter(i => i.status === 'downloading').length;
        const completed   = queue.filter(i => i.status === 'completed').length;

        el.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              ${_statRow('⬇️', 'Descargando', downloading)}
              ${_statRow('✅', 'Completados', completed)}
            </div>
            <div style="display:flex;gap:6px;margin-top:2px">
              <input class="form-control" id="yt-quick-url"
                     placeholder="Pegar URL de YouTube…" style="flex:1;font-size:12px">
              <button class="btn btn-sm btn-primary" id="yt-quick-add">MP3</button>
            </div>
          </div>`;

        el.querySelector('#yt-quick-add')?.addEventListener('click', async () => {
          const inp = el.querySelector('#yt-quick-url');
          const url = inp.value.trim();
          if (!url) return;
          try {
            await API.downloads.add(url, 'mp3');
            inp.value = '';
            store.navigate('starcho:youtube');
          } catch (err) {
            console.error('[starcho] Quick-add error:', err);
          }
        });
      },
    },
  ],
};

// ── Shared helpers ─────────────────────────────────────────────────────────────

function _statRow(icon, label, value) {
  return `
    <div style="background:var(--bg-3);border-radius:var(--radius-sm);
                padding:10px 12px;display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">${icon}</span>
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--text-primary)">${value}</div>
        <div style="font-size:11px;color:var(--text-muted)">${label}</div>
      </div>
    </div>`;
}

function _fmtBytes(b) {
  if (!b) return '0 B';
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
