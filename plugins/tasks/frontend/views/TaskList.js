/**
 * TaskList.js — full-page task list view for the Tasks plugin.
 *
 * Structure:
 *  - Header bar (title + "New task" button)
 *  - Status filter strip (All / Pending / In-progress / Done / Cancelled)
 *  - Task item list (priority colour bar, status cycle button, due-date badge)
 *  - Edit / Create modal (title, description, status, priority, due date)
 *
 * Status cycle order (click the status button to advance):
 *   pending → in_progress → completed → cancelled → pending
 */
import API        from '../../../../src/renderer/utils/api.js';
import { openModal, showToast, markFieldErrors, clearFieldErrors }
                  from '../../../../src/renderer/components/Modal.js';
import store      from '../../../../src/renderer/store.js';
import { esc, formGroup, grid }
                  from '../../../../src/renderer/utils/html.js';
import { viewHeader, filterBar, wireFilters }
                  from '../../../../src/renderer/components/ui.js';

const STATUS_LABELS = {
  pending:     '⏳ Pendiente',
  in_progress: '🔄 En proceso',
  completed:   '✅ Completada',
  cancelled:   '❌ Cancelada',
};
const PRIORITY_LABELS = {
  low:    '🔽 Baja',
  medium: '▶️ Media',
  high:   '🔼 Alta',
  urgent: '🚨 Urgente',
};

// Filter strip items — value '' means "show all"
const FILTERS = [
  { label: 'Todas',           value: '' },
  { label: '⏳ Pendiente',    value: 'pending' },
  { label: '🔄 En proceso',   value: 'in_progress' },
  { label: '✅ Completada',   value: 'completed' },
  { label: '❌ Cancelada',    value: 'cancelled' },
];

// Module-level active filter (reset on each renderTaskList call)
let _activeFilter = '';

export async function renderTaskList(el) {
  _activeFilter = '';

  el.innerHTML = `<div class="tk-container">
    ${viewHeader('✅ Tareas', `<button class="tk-new-btn" id="tk-new-btn">+ Nueva tarea</button>`, 'tk-header')}
    ${filterBar(FILTERS, '', {
      dataAttr:  'status',
      btnClass:  'tk-filter',
      wrapClass: 'tk-filters',
      wrapId:    'tk-filters',
    })}
    <div class="tk-list" id="tk-list"><div class="tk-empty">Cargando…</div></div>
  </div>`;

  el.querySelector('#tk-new-btn').addEventListener('click', () => _openForm(null, _refresh));

  // Wire filter strip — updates _activeFilter and re-fetches
  wireFilters(el, '.tk-filter', 'status', val => {
    _activeFilter = val;
    _refresh();
  });

  await _refresh();

  async function _refresh() {
    const listEl   = el.querySelector('#tk-list');
    const username = store.state.loggedUser?.username;
    const q        = username ? { username } : {};
    if (_activeFilter) q.status = _activeFilter;

    try {
      const tasks = await API.tasks.list(q);
      _renderList(listEl, tasks, _refresh);
    } catch (err) {
      listEl.innerHTML = `<div class="tk-empty" style="color:var(--red)">
        Error al cargar tareas: ${err.message || 'Error desconocido'}
      </div>`;
    }
  }
}

// ── List renderer ──────────────────────────────────────────────────────────────

function _renderList(container, tasks, refresh) {
  if (!tasks.length) {
    container.innerHTML = `<div class="tk-empty">No hay tareas${_activeFilter ? ' con ese estado' : ''}.</div>`;
    return;
  }

  container.innerHTML = tasks.map(t => {
    const isDone  = t.status === 'completed' || t.status === 'cancelled';
    const overdue = t.due_date && !isDone && new Date(t.due_date) < new Date();
    return `<div class="tk-item ${isDone ? 'done' : ''}" data-id="${t.id}">
      <div class="tk-priority ${t.priority}"></div>
      <div class="tk-main">
        <div class="tk-title">${esc(t.title)}</div>
        ${t.description ? `<div class="tk-desc">${esc(t.description)}</div>` : ''}
      </div>
      <div class="tk-meta">
        <button class="tk-status ${t.status}" data-id="${t.id}" title="Cambiar estado">
          ${STATUS_LABELS[t.status] || t.status}
        </button>
        ${t.due_date ? `<span class="tk-due ${overdue ? 'overdue' : ''}">📅 ${t.due_date}</span>` : ''}
      </div>
      <div class="tk-actions">
        <button class="tk-btn tk-edit" data-id="${t.id}" title="Editar">✏️</button>
        <button class="tk-btn danger tk-del" data-id="${t.id}" title="Eliminar">🗑️</button>
      </div>
    </div>`;
  }).join('');

  // Click the status badge to cycle: pending → in_progress → completed → cancelled → …
  const CYCLE = ['pending', 'in_progress', 'completed', 'cancelled'];
  container.querySelectorAll('.tk-status').forEach(btn => {
    btn.addEventListener('click', async () => {
      const task = tasks.find(t => t.id === parseInt(btn.dataset.id));
      const next = CYCLE[(CYCLE.indexOf(task.status) + 1) % CYCLE.length];
      await API.tasks.updateStatus(parseInt(btn.dataset.id), next);
      refresh();
    });
  });

  // Edit
  container.querySelectorAll('.tk-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const task = tasks.find(t => t.id === parseInt(btn.dataset.id));
      if (task) _openForm(task, refresh);
    });
  });

  // Delete (soft)
  container.querySelectorAll('.tk-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta tarea?')) return;
      await API.tasks.delete(parseInt(btn.dataset.id));
      showToast('Tarea eliminada', 'success');
      refresh();
    });
  });
}

// ── Create / Edit form modal ───────────────────────────────────────────────────

function _openForm(task, onSaved) {
  const isEdit = !!task;

  const statusOpts   = Object.entries(STATUS_LABELS).map(([v, l]) =>
    `<option value="${v}" ${task?.status === v ? 'selected' : ''}>${l}</option>`).join('');
  const priorityOpts = Object.entries(PRIORITY_LABELS).map(([v, l]) =>
    `<option value="${v}" ${(task?.priority ?? 'medium') === v ? 'selected' : ''}>${l}</option>`).join('');

  openModal({
    title: isEdit ? '✏️ Editar tarea' : '✅ Nueva tarea',
    content: `
      ${formGroup({ label: 'Título *',    id: 'tk-f-title',    dataField: 'title',       placeholder: 'Título de la tarea',    value: esc(task?.title       || '') })}
      ${formGroup({ label: 'Descripción', id: 'tk-f-desc',     dataField: 'description', type: 'textarea', rows: 3, placeholder: 'Descripción opcional…', value: esc(task?.description || '') })}
      ${grid(2, '12px',
        formGroup({ label: 'Estado',    id: 'tk-f-status',   dataField: 'status',   type: 'select', options: statusOpts }),
        formGroup({ label: 'Prioridad', id: 'tk-f-priority', dataField: 'priority', type: 'select', options: priorityOpts }),
      )}
      ${formGroup({ label: 'Fecha límite', id: 'tk-f-due', dataField: 'due_date', type: 'date', value: task?.due_date || '' })}`,
    actions: [
      { label: 'Cancelar', class: 'btn-secondary', action: close => close() },
      {
        label: isEdit ? 'Guardar' : 'Crear',
        class: 'btn-primary',
        action: async (close, formEl) => {
          clearFieldErrors(formEl);
          const title    = formEl.querySelector('#tk-f-title').value.trim();
          const description = formEl.querySelector('#tk-f-desc').value.trim();
          const status   = formEl.querySelector('#tk-f-status').value;
          const priority = formEl.querySelector('#tk-f-priority').value;
          const due_date = formEl.querySelector('#tk-f-due').value;
          const username = store.state.loggedUser?.username;
          const payload  = { title, description: description || null, status, priority, due_date: due_date || null, username };

          try {
            if (isEdit) {
              await API.tasks.update(task.id, payload);
              showToast('Tarea actualizada', 'success');
            } else {
              await API.tasks.create(payload);
              showToast('Tarea creada', 'success');
            }
            close();
            onSaved();
          } catch (err) {
            markFieldErrors(err.fields, formEl);
            showToast(err.message || 'Error al guardar', 'error');
          }
        },
      },
    ],
  });

  // Scope focus to the last open modal overlay
  setTimeout(() => document.querySelector('.modal-overlay:last-child #tk-f-title')?.focus(), 80);
}
