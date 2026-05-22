import API        from '../../../../src/renderer/utils/api.js';
import { openModal, showToast } from '../../../../src/renderer/components/Modal.js';
import store from '../../../../src/renderer/store.js';

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

const FILTERS = [
  { label: 'Todas',      value: '' },
  { label: '⏳ Pendiente',   value: 'pending' },
  { label: '🔄 En proceso',  value: 'in_progress' },
  { label: '✅ Completada',  value: 'completed' },
  { label: '❌ Cancelada',   value: 'cancelled' },
];

let _activeFilter = '';

export async function renderTaskList(el) {
  _activeFilter = '';

  el.innerHTML = `<div class="tk-container">
    <div class="tk-header">
      <h2>✅ Tareas</h2>
      <button class="tk-new-btn" id="tk-new-btn">+ Nueva tarea</button>
    </div>
    <div class="tk-filters" id="tk-filters">
      ${FILTERS.map(f => `<button class="tk-filter ${f.value === '' ? 'active' : ''}"
        data-status="${f.value}">${f.label}</button>`).join('')}
    </div>
    <div class="tk-list" id="tk-list"><div class="tk-empty">Cargando…</div></div>
  </div>`;

  el.querySelector('#tk-new-btn').addEventListener('click', () => _openForm(null, _refresh));

  el.querySelectorAll('.tk-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeFilter = btn.dataset.status;
      el.querySelectorAll('.tk-filter').forEach(b => b.classList.toggle('active', b === btn));
      _refresh();
    });
  });

  await _refresh();

  async function _refresh() {
    const username = store.state.loggedUser?.username;
    const q        = username ? { username } : {};
    if (_activeFilter) q.status = _activeFilter;
    const tasks = await API.tasks.list(q).catch(() => []);
    _renderList(el.querySelector('#tk-list'), tasks, _refresh);
  }
}

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
        <div class="tk-title">${_esc(t.title)}</div>
        ${t.description ? `<div class="tk-desc">${_esc(t.description)}</div>` : ''}
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

  // Cycle status on click
  const CYCLE = ['pending','in_progress','completed','cancelled'];
  container.querySelectorAll('.tk-status').forEach(btn => {
    btn.addEventListener('click', async () => {
      const task   = tasks.find(t => t.id === parseInt(btn.dataset.id));
      const next   = CYCLE[(CYCLE.indexOf(task.status) + 1) % CYCLE.length];
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

  // Delete
  container.querySelectorAll('.tk-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta tarea?')) return;
      await API.tasks.delete(parseInt(btn.dataset.id));
      showToast('Tarea eliminada', 'success');
      refresh();
    });
  });
}

function _openForm(task, onSaved) {
  const isEdit = !!task;

  const statusOpts = Object.entries(STATUS_LABELS).map(([v, l]) =>
    `<option value="${v}" ${task?.status === v ? 'selected' : ''}>${l}</option>`).join('');
  const priorityOpts = Object.entries(PRIORITY_LABELS).map(([v, l]) =>
    `<option value="${v}" ${(task?.priority ?? 'medium') === v ? 'selected' : ''}>${l}</option>`).join('');

  openModal({
    title: isEdit ? '✏️ Editar tarea' : '✅ Nueva tarea',
    content: `
      <div class="form-group">
        <label>Título *</label>
        <input class="form-control" id="tk-f-title" placeholder="Título de la tarea"
               value="${_esc(task?.title || '')}">
      </div>
      <div class="form-group">
        <label>Descripción</label>
        <textarea class="form-control" id="tk-f-desc" rows="3" style="resize:vertical"
          placeholder="Descripción opcional…">${_esc(task?.description || '')}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label>Estado</label>
          <select class="form-control" id="tk-f-status">${statusOpts}</select>
        </div>
        <div class="form-group">
          <label>Prioridad</label>
          <select class="form-control" id="tk-f-priority">${priorityOpts}</select>
        </div>
      </div>
      <div class="form-group">
        <label>Fecha límite</label>
        <input class="form-control" type="date" id="tk-f-due" value="${task?.due_date || ''}">
      </div>`,
    actions: [
      { label: 'Cancelar', class: 'btn-secondary', action: (close) => close() },
      {
        label: isEdit ? 'Guardar' : 'Crear',
        class: 'btn-primary',
        action: async (close) => {
          const title       = document.getElementById('tk-f-title').value.trim();
          const description = document.getElementById('tk-f-desc').value.trim();
          const status      = document.getElementById('tk-f-status').value;
          const priority    = document.getElementById('tk-f-priority').value;
          const due_date    = document.getElementById('tk-f-due').value;
          if (!title) { document.getElementById('tk-f-title').focus(); return; }

          const username = store.state.loggedUser?.username;
          const payload  = { title, description: description || null, status, priority, due_date: due_date || null, username };

          if (isEdit) {
            await API.tasks.update(task.id, payload);
            showToast('Tarea actualizada', 'success');
          } else {
            await API.tasks.create(payload);
            showToast('Tarea creada', 'success');
          }
          close();
          onSaved();
        },
      },
    ],
  });

  setTimeout(() => document.getElementById('tk-f-title')?.focus(), 80);
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
