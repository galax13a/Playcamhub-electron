/**
 * Notes plugin — frontend registration.
 *
 * Contributes:
 *  - 1 sidebar nav item  (labelKey: 'nav_notes' → translated by Sidebar via i18n.t())
 *  - 1 view renderer     (notes:list → NoteList.js)
 *  - 1 dashboard widget  (zone: content, priority 70 — total/with-date counts + 3 recent titles)
 */
import API from '../../../src/renderer/utils/api.js';
import { statRow, grid, esc } from '../../../src/renderer/utils/html.js';
import { recentList }         from '../../../src/renderer/components/ui.js';

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
    { view: 'notes:list', icon: '📝', labelKey: 'nav_notes', label: 'Notes' },
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
      id: 'notes-summary', zone: 'content', priority: 70, title: '📝 Notas',
      async render(el) {
        let notes = [];
        try { notes = await API.notes.list(); } catch (_) {}

        const withDate = notes.filter(n => n.important_date).length;
        // API returns newest first — take the first 3 for a quick preview
        const recent   = notes.slice(0, 3);

        el.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">
          ${grid(2, '8px',
            statRow('📝', 'Total',     notes.length),
            statRow('📅', 'Con fecha', withDate),
          )}
          ${recentList(recent, n => `
            <div style="font-size:12px;color:var(--text-secondary);
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              📝 ${esc(n.title || 'Sin título')}
            </div>`)}
        </div>`;
      },
    },
  ],
};
