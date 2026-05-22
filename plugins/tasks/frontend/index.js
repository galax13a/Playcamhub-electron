/**
 * Tasks plugin — frontend registration.
 *
 * Contributes:
 *  - 1 sidebar nav item  (labelKey: 'nav_tasks' → translated by Sidebar via i18n.t())
 *  - 1 view renderer     (tasks:list → TaskList.js)
 *  - 1 dashboard widget  (zone: content, priority 80 — status counts + overdue banner)
 */
import API from '../../../src/renderer/utils/api.js';
import { statRow, grid }  from '../../../src/renderer/utils/html.js';
import { alertBanner }    from '../../../src/renderer/components/ui.js';

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
    { view: 'tasks:list', icon: '✅', labelKey: 'nav_tasks', label: 'Tasks' },
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
      id: 'tasks-summary', zone: 'content', priority: 80, title: '✅ Tareas',
      async render(el) {
        let tasks = [];
        try { tasks = await API.tasks.list(); } catch (_) {}

        const pending = tasks.filter(t => t.status === 'pending').length;
        const inProg  = tasks.filter(t => t.status === 'in_progress').length;
        const done    = tasks.filter(t => t.status === 'completed').length;
        const overdue = tasks.filter(t => {
          if (!t.due_date || t.status === 'completed') return false;
          return new Date(t.due_date) < new Date();
        }).length;

        el.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">
          ${grid(2, '8px',
            statRow('🕐', 'Pendientes',  pending),
            statRow('🔄', 'En progreso', inProg),
            statRow('✅', 'Completadas', done),
            statRow('⚠️', 'Vencidas',    overdue),
          )}
          ${overdue > 0
            ? alertBanner(`⚠ Tienes ${overdue} tarea${overdue > 1 ? 's' : ''} vencida${overdue > 1 ? 's' : ''}`)
            : ''}
        </div>`;
      },
    },
  ],
};
