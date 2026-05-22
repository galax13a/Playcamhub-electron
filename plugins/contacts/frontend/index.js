/**
 * Contacts plugin — frontend registration.
 * Contributes: 1 nav item, 1 view renderer, 1 dashboard content widget.
 */
import API from '../../../src/renderer/utils/api.js';

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
    { view: 'contacts:list', icon: '👥', label: 'Contactos' },
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
      id:       'contacts-summary',
      zone:     'content',
      priority: 60,
      title:    '👥 Contactos',
      async render(el) {
        let contacts = [];
        try { contacts = await API.contacts.list(); } catch (_) {}

        const active   = contacts.filter(c => c.active !== 0).length;
        const inactive = contacts.length - active;
        const recent   = contacts.slice(0, 3);

        el.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              ${_row('👥', 'Total',    contacts.length)}
              ${_row('✅', 'Activos',  active)}
              ${_row('🚫', 'Inactivos',inactive)}
            </div>
            ${recent.length ? `
              <div style="border-top:1px solid var(--border);padding-top:8px;
                          display:flex;flex-direction:column;gap:5px">
                ${recent.map(c => `
                  <div style="display:flex;align-items:center;gap:8px;font-size:12px;
                              color:var(--text-secondary)">
                    <span>${c.avatar || '👤'}</span>
                    <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                      ${_esc(c.name || 'Sin nombre')}
                    </span>
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
