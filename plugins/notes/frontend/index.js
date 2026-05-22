/**
 * Notes plugin — frontend registration.
 * Contributes: 1 nav item, 1 view renderer, 1 dashboard content widget.
 */
import API from '../../../src/renderer/utils/api.js';

export default {
  id: 'notes',

  // Inject plugin stylesheet once when the plugin loads
  onLoad() {
    if (document.getElementById('notes-css')) return;
    const link = document.createElement('link');
    link.id   = 'notes-css';
    link.rel  = 'stylesheet';
    link.href = new URL('./styles/notes.css', import.meta.url).href;
    document.head.appendChild(link);
  },

  navItems: [
    { view: 'notes:list', icon: '📝', label: 'Notas' },
  ],

  views: {
    'notes:list': async (el) => {
      const { renderNoteList } = await import('./views/NoteList.js');
      renderNoteList(el);
    },
  },

  // ── Dashboard widget ───────────────────────────────────────────────────────

  dashboardWidgets: [
    {
      id:       'notes-summary',
      zone:     'content',
      priority: 70,
      title:    '📝 Notas',
      async render(el) {
        let notes = [];
        try { notes = await API.notes.list(); } catch (_) {}

        const withDate = notes.filter(n => n.important_date).length;
        // API returns newest first — take the last 3 for a quick preview
        const recent   = notes.slice(0, 3);

        el.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              ${_row('📝', 'Total',     notes.length)}
              ${_row('📅', 'Con fecha', withDate)}
            </div>
            ${recent.length ? `
              <div style="border-top:1px solid var(--border);padding-top:8px;
                          display:flex;flex-direction:column;gap:5px">
                ${recent.map(n => `
                  <div style="font-size:12px;color:var(--text-secondary);
                              white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                    📝 ${_esc(n.title || 'Sin título')}
                  </div>`).join('')}
              </div>` : ''}
          </div>`;
      },
    },
  ],
};

function _row(icon, label, value) {
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

function _esc(s) {
  return String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
