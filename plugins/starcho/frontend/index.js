/**
 * MediaHub plugin (formerly Starcho) — frontend registration.
 *
 * Contributes:
 *  - 4 sidebar nav items (Gallery, Albums, Upload, Favorites)
 *    Each item has a labelKey so the Sidebar can translate the label via i18n.t()
 *    when the language changes — no rebuild of the plugin is needed.
 *  - 4 view renderers (gallery, albums, upload, photo editor)
 *  - 2 dashboard widgets:
 *      • mediahub-stats       zone:content priority:100  — media count + disk usage
 *      • mediahub-quick-upload zone:content priority:90   — quick upload input
 */
import store             from '../../../src/renderer/store.js';
import API, { getBase } from '../../../src/renderer/utils/api.js';

export default {
  id: 'starcho',
  hasSidebarPlaylists: false,

  navItems: [
    { view: 'starcho:gallery',  icon: '🖼️', labelKey: 'nav_gallery',   label: 'Gallery'   },
    { view: 'starcho:albums',   icon: '📁', labelKey: 'nav_albums',    label: 'Albums'    },
    { view: 'starcho:upload',   icon: '📤', labelKey: 'nav_upload',    label: 'Upload'    },
    { view: 'starcho:favorites',icon: '⭐', labelKey: 'nav_favorites', label: 'Favorites' },
  ],

  views: {
    'starcho:gallery': async (el, extra) => {
      const { renderGallery } = await import('./views/Gallery.js');
      renderGallery(el, extra);
    },
    'starcho:albums': async (el, extra) => {
      const { renderAlbums } = await import('./views/Albums.js');
      renderAlbums(el, extra);
    },
    'starcho:upload': async (el, extra) => {
      const { renderUpload } = await import('./views/Upload.js');
      renderUpload(el, extra);
    },
    'starcho:favorites': async (el, extra) => {
      const { renderFavorites } = await import('./views/Favorites.js');
      renderFavorites(el, extra);
    },
    'starcho:photo-editor': async (el, extra) => {
      const { renderPhotoEditor } = await import('./views/PhotoEditor.js');
      renderPhotoEditor(el, extra);
    },
    'starcho:video-viewer': async (el, extra) => {
      const { renderVideoViewer } = await import('./views/VideoViewer.js');
      renderVideoViewer(el, extra);
    },
  },

  // ── Dashboard widgets ──────────────────────────────────────────────────────

  dashboardWidgets: [

    // Content zone: MediaHub stats
    {
      id:       'mediahub-stats',
      zone:     'content',
      priority: 100,
      title:    '🖼️ MediaHub',
      async render(el) {
        let totalPhotos = 0;
        let totalVideos = 0;
        let diskText = '—';

        try {
          const stats = await API.media.stats();
          totalPhotos = stats.photoCount || 0;
          totalVideos = stats.videoCount || 0;
          diskText    = _fmtBytes(stats.diskBytes || 0);
        } catch (_) {
          // Fallback silently
        }

        el.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              ${_statRow('🖼️', 'Photos',  totalPhotos)}
              ${_statRow('🎬', 'Videos',  totalVideos)}
              ${_statRow('💾', 'Storage', diskText)}
              ${_statRow('📁', 'Albums',  0)}
            </div>
            <button class="btn btn-sm btn-primary" style="width:100%;margin-top:2px" id="sbtn-gallery">
              Open Gallery
            </button>
          </div>`;

        el.querySelector('#sbtn-gallery')?.addEventListener('click', () =>
          store.navigate('starcho:gallery'));
      },
    },

    // Content zone: Quick upload
    {
      id:       'mediahub-quick-upload',
      zone:     'content',
      priority: 90,
      title:    '📤 Quick Upload',
      async render(el) {
        el.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:8px">
            <input type="file" id="mh-quick-input" style="display:none"
                   accept="image/*,video/*" multiple>
            <button class="btn btn-sm btn-primary" style="width:100%"
                    id="mh-quick-btn">
              Choose Files to Upload
            </button>
            <div id="mh-upload-status" style="font-size:12px;color:var(--text-muted)"></div>
          </div>`;

        const fileInput = el.querySelector('#mh-quick-input');
        const btn = el.querySelector('#mh-quick-btn');
        const status = el.querySelector('#mh-upload-status');

        btn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async (e) => {
          const files = Array.from(e.target.files || []);
          if (!files.length) return;

          btn.disabled = true;
          let done = 0;

          for (const file of files) {
            status.textContent = `Uploading ${file.name}…`;
            try {
              await _xhrUpload(file);
              done++;
            } catch (err) {
              status.textContent = `❌ ${err.message}`;
              btn.disabled = false;
              return;
            }
          }

          status.textContent = `✅ ${done} file(s) uploaded`;
          fileInput.value = '';
          setTimeout(() => { status.textContent = ''; btn.disabled = false; }, 2500);
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

function _xhrUpload(file) {
  return new Promise((resolve, reject) => {
    const token = window.playcamAuthToken
      || (() => { try { return JSON.parse(sessionStorage.getItem('auth_session') || localStorage.getItem('auth_session') || 'null')?.token; } catch (_) { return null; } })();
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getBase()}/api/media/upload`);
    if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else { let m = `HTTP ${xhr.status}`; try { m = JSON.parse(xhr.responseText).error || m; } catch (_) {} reject(new Error(m)); }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}
