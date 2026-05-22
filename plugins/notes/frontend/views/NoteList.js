import API        from '../../../../src/renderer/utils/api.js';
import { openModal, showToast, markFieldErrors, clearFieldErrors } from '../../../../src/renderer/components/Modal.js';
import store from '../../../../src/renderer/store.js';

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#ef4444','#64748b'];

export async function renderNoteList(el) {
  el.innerHTML = `<div class="nt-container">
    <div class="nt-header">
      <h2>📝 Notas</h2>
      <button class="nt-new-btn" id="nt-new-btn">+ Nueva nota</button>
    </div>
    <div class="nt-list" id="nt-list"><div class="nt-empty">Cargando…</div></div>
  </div>`;

  el.querySelector('#nt-new-btn').addEventListener('click', () => _openForm(null, _refresh));

  await _refresh();

  async function _refresh() {
    const username = store.state.loggedUser?.username;
    const notes    = await API.notes.list(username ? { username } : {}).catch(() => []);
    _renderList(el.querySelector('#nt-list'), notes, _refresh);
  }
}

function _renderList(container, notes, refresh) {
  if (!notes.length) {
    container.innerHTML = `<div class="nt-empty">No hay notas todavía.<br>Crea tu primera nota con el botón de arriba.</div>`;
    return;
  }

  container.innerHTML = notes.map(n => `
    <div class="nt-card" data-id="${n.id}" style="--note-color:${n.color}">
      <div class="nt-card-head">
        <div class="nt-color-bar"></div>
        <div class="nt-card-title">
          <span class="nt-title">${_esc(n.title)}</span>
          ${n.important_date ? `<span class="nt-date">📅 ${n.important_date}</span>` : ''}
        </div>
        <button class="nt-toggle-btn" title="Expandir / Colapsar">▼</button>
      </div>
      <div class="nt-card-body">
        ${n.content
          ? `<div class="nt-content">${_esc(n.content)}</div>`
          : `<div class="nt-content-empty">Sin contenido</div>`}
        <div class="nt-actions">
          <button class="nt-action-btn nt-edit" data-id="${n.id}">✏️ Editar</button>
          <button class="nt-action-btn danger nt-del" data-id="${n.id}">🗑️ Eliminar</button>
        </div>
      </div>
    </div>`).join('');

  // Toggle expand/collapse
  container.querySelectorAll('.nt-card-head').forEach(head => {
    head.addEventListener('click', () => {
      head.closest('.nt-card').classList.toggle('expanded');
    });
  });

  // Edit
  container.querySelectorAll('.nt-edit').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const note = notes.find(n => n.id === parseInt(btn.dataset.id));
      if (note) _openForm(note, refresh);
    });
  });

  // Delete
  container.querySelectorAll('.nt-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('¿Eliminar esta nota?')) return;
      await API.notes.delete(parseInt(btn.dataset.id));
      showToast('Nota eliminada', 'success');
      refresh();
    });
  });
}

function _openForm(note, onSaved) {
  const isEdit     = !!note;
  const selColor   = note?.color || '#6366f1';

  const colorSwatches = COLORS.map(c => `
    <span class="nt-color-swatch ${c === selColor ? 'selected' : ''}"
          data-color="${c}" style="background:${c}" title="${c}"></span>`).join('');

  openModal({
    title: isEdit ? '✏️ Editar nota' : '📝 Nueva nota',
    content: `
      <div class="form-group">
        <label>Título *</label>
        <input class="form-control" id="nt-f-title" data-field="title" placeholder="Título de la nota" value="${_esc(note?.title || '')}">
      </div>
      <div class="form-group">
        <label>Contenido</label>
        <textarea class="form-control" id="nt-f-content" data-field="content" rows="5" style="resize:vertical"
          placeholder="Escribe aquí tu nota…">${_esc(note?.content || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Fecha importante</label>
        <input class="form-control" type="date" id="nt-f-date" data-field="important_date" value="${note?.important_date || ''}">
      </div>
      <div class="form-group">
        <label>Color</label>
        <div class="nt-color-row" id="nt-color-row">
          ${colorSwatches}
        </div>
        <input type="hidden" id="nt-f-color" value="${selColor}">
      </div>`,
    actions: [
      { label: 'Cancelar', class: 'btn-secondary', action: (close) => close() },
      {
        label: isEdit ? 'Guardar' : 'Crear',
        class: 'btn-primary',
        action: async (close, formEl) => {
          clearFieldErrors(formEl);
          const title   = document.getElementById('nt-f-title').value.trim();
          const content = document.getElementById('nt-f-content').value.trim();
          const date    = document.getElementById('nt-f-date').value;
          const color   = document.getElementById('nt-f-color').value;
          const username = store.state.loggedUser?.username;
          const payload  = { title, content: content || null, color, important_date: date || null, username };

          try {
            if (isEdit) {
              await API.notes.update(note.id, payload);
              showToast('Nota actualizada', 'success');
            } else {
              await API.notes.create(payload);
              showToast('Nota creada', 'success');
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

  // Color swatch picker
  setTimeout(() => {
    document.querySelectorAll('.nt-color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        document.querySelectorAll('.nt-color-swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        document.getElementById('nt-f-color').value = swatch.dataset.color;
      });
    });
    document.getElementById('nt-f-title')?.focus();
  }, 80);
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
