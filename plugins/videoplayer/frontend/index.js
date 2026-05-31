/**
 * Video Player plugin — frontend registration.
 *
 * Contributes:
 *  - 1 sidebar nav item (Video Player)
 *  - 1 view renderer    (videoplayer:workspace → views/Workspace.js)
 *  - 1 dashboard widget (zone: content, priority 70 — historial reciente + acceso rápido)
 */

import store from '../../../src/renderer/store.js';
import { getBase } from '../../../src/renderer/utils/api.js';

export default {
  id: 'videoplayer',

  // Inject plugin stylesheet once when the plugin loads
  onLoad() {
    if (document.getElementById('videoplayer-css')) return;
    const link = document.createElement('link');
    link.id   = 'videoplayer-css';
    link.rel  = 'stylesheet';
    link.href = new URL('./styles/videoplayer.css', import.meta.url).href;
    document.head.appendChild(link);
  },

  navItems: [
    { view: 'videoplayer:workspace', icon: '🎞️', labelKey: 'nav_videoplayer', label: 'Video Player' },
  ],

  views: {
    'videoplayer:workspace': async (el, extra) => {
      const { renderWorkspace } = await import('./views/Workspace.js');
      renderWorkspace(el, extra);
    },
  },

  dashboardWidgets: [
    {
      id: 'videoplayer-recent',
      zone: 'content',
      priority: 70,
      title: '🎞️ Video Player',
      async render(el) {
        let items = [];
        try {
          const res = await _api('/videoplayer/history?per_page=5');
          items = res.items || [];
        } catch (_) {}

        el.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:10px">
            <button class="btn btn-sm btn-primary" id="vp-open">
              Abrir reproductor multi-ventana
            </button>
            ${items.length === 0
              ? `<div style="font-size:12px;color:var(--text-muted)">Sin historial todavía</div>`
              : `<div style="display:flex;flex-direction:column;gap:6px">
                   ${items.map(h => `
                     <div style="font-size:12px;display:flex;justify-content:space-between;gap:8px">
                       <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">
                         ${_esc(h.title)}
                       </span>
                       <span style="color:var(--text-muted)">${_fmtTime(h.last_position)}</span>
                     </div>`).join('')}
                 </div>`}
          </div>`;

        el.querySelector('#vp-open')?.addEventListener('click', () =>
          store.navigate('videoplayer:workspace'));
      },
    },
  ],
};

// ── helpers locales ──────────────────────────────────────────────────────────
function _esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

function _fmtTime(sec) {
  sec = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${m}:${String(s).padStart(2,'0')}`;
}

async function _api(path, opts = {}) {
  const token = (() => {
    try {
      const raw = sessionStorage.getItem('auth_session') || localStorage.getItem('auth_session');
      return JSON.parse(raw || 'null')?.token || null;
    } catch (_) { return null; }
  })();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(`${getBase()}/api${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
  return data;
}
