/**
 * Contacts plugin — frontend registration.
 *
 * Contributes:
 *  - 1 sidebar nav item  (labelKey: 'nav_contacts' → translated by Sidebar via i18n.t())
 *  - 1 view renderer     (contacts:list → ContactList.js)
 *  - 1 dashboard widget  (zone: content, priority 60 — active/inactive counts + 3 recent names)
 */
import API from '../../../src/renderer/utils/api.js';
import { statRow, grid, esc } from '../../../src/renderer/utils/html.js';
import { recentList }         from '../../../src/renderer/components/ui.js';

export default {
  id: 'contacts',

  // Inject plugin stylesheet once when the plugin loads
  onLoad() {
    if (document.getElementById('contacts-css')) return;
    const link  = document.createElement('link');
    link.id     = 'contacts-css';
    link.rel    = 'stylesheet';
    link.href   = '../../plugins/contacts/frontend/styles/contacts.css';
    document.head.appendChild(link);
  },

  navItems: [
    { view: 'contacts:list', icon: '👥', labelKey: 'nav_contacts', label: 'Contacts' },
  ],

  views: {
    'contacts:list': async (el) => {
      const { renderContactList } = await import('./views/ContactList.js');
      renderContactList(el);
    },
  },

  // ── Dashboard widget ───────────────────────────────────────────────────────

  dashboardWidgets: [
    {
      id: 'contacts-summary', zone: 'content', priority: 60, title: '👥 Contactos',
      async render(el) {
        let contacts = [];
        try { contacts = await API.contacts.list(); } catch (_) {}

        const active   = contacts.filter(c => c.active !== 0).length;
        const inactive = contacts.length - active;
        const recent   = contacts.slice(0, 3);

        el.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">
          ${grid(2, '8px',
            statRow('👥', 'Total',     contacts.length),
            statRow('✅', 'Activos',   active),
            statRow('🚫', 'Inactivos', inactive),
          )}
          ${recentList(recent, c => `
            <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary)">
              <span>${c.avatar || '👤'}</span>
              <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                ${esc(c.name || 'Sin nombre')}
              </span>
            </div>`)}
        </div>`;
      },
    },
  ],
};
