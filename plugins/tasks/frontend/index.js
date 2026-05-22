/**
 * Tasks plugin — frontend registration.
 * Contributes: 1 nav item, 1 view renderer, 1 dashboard content widget.
 */
import API from '../../../src/renderer/utils/api.js';

export default {
  id: 'tasks',

  // Inject plugin stylesheet once when the plugin loads
  onLoad() {
    if (document.getElementById('tasks-css')) return;
    const link = document.createElement('link');
    link.id   = 'tasks-css';
    link.rel  = 'stylesheet';
    link.href = new URL('./styles/tasks.css', import.meta.url).href;
    document.head.appendChild(link);
  },

  navItems: [
    { view: 'tasks:list', icon: '✅', label: 'Tareas' },
  ],

  views: {
    'tasks:list': async (el) => {
      const { renderTaskList } = await import('./views/TaskList.js');
      renderTaskList(el);
    },
  },

  // ── Dashboard widget ───────────────────────────────────────────────────────

  dashboardWidgets: [
    {
      id:       'tasks-summary',
      zone:     'content',
      priority: 80,
      title:    '✅ Tareas',
      async render(el) {
        let tasks = [];
        try { tasks = await API.tasks.list(); } catch (_) {}

        const pending   = tasks.filter(t => t.status === 'pending').length;
        const inProg    = tasks.filter(t => t.status === 'in_progress').length;
        const done      = tasks.filter(t => t.status === 'completed').length;
        const overdue   = tasks.filter(t => {
          if (!t.due_date || t.status === 'completed') return false;
          return new Date(t.due_date) < new Date();
        }).length;

        el.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              ${_row('🕐', 'Pendientes',  pending)}
              ${_row('🔄', 'En progreso', inProg)}
              ${_row('✅', 'Completadas', done)}
              ${_row('⚠️', 'Vencidas',    overdue)}
            </div>
            ${overdue > 0 ? `
              <div style="background:rgba(255,50,50,.1);border:1px solid rgba(255,50,50,.25);
                          border-radius:var(--radius-sm);padding:8px 12px;
                          font-size:12px;color:var(--red)">
                ⚠ Tienes ${overdue} tarea${overdue > 1 ? 's' : ''} vencida${overdue > 1 ? 's' : ''}
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
