import API        from '../../../../src/renderer/utils/api.js';
import { openModal, showToast, markFieldErrors, clearFieldErrors } from '../../../../src/renderer/components/Modal.js';
import store from '../../../../src/renderer/store.js';

const STATUS_META = {
  lead:     { label: 'Lead',      color: '#60a5fa' },
  prospect: { label: 'Prospect',  color: '#f59e0b' },
  customer: { label: 'Cliente',   color: '#10b981' },
  churned:  { label: 'Inactivo',  color: '#6b7280' },
};

const FILTERS = [
  { label: 'Todos',    value: '' },
  { label: '🔵 Lead',     value: 'lead' },
  { label: '🟡 Prospect', value: 'prospect' },
  { label: '🟢 Cliente',  value: 'customer' },
  { label: '⚫ Inactivo', value: 'churned' },
];

let _activeStatus = '';

export async function renderContactList(el) {
  _activeStatus = '';

  el.innerHTML = `
    <div class="ct-container">
      <div class="ct-header">
        <h2>👥 Contactos</h2>
        <div style="display:flex;gap:8px;align-items:center">
          <input class="ct-search form-control" id="ct-search" placeholder="🔍 Buscar…" style="width:200px">
          <button class="ct-new-btn" id="ct-new-btn">+ Nuevo contacto</button>
        </div>
      </div>

      <div class="ct-filters" id="ct-filters">
        ${FILTERS.map(f => `<button class="ct-filter ${f.value === '' ? 'active' : ''}"
          data-status="${f.value}">${f.label}</button>`).join('')}
      </div>

      <div class="ct-grid" id="ct-grid">
        <div class="ct-empty">Cargando…</div>
      </div>
    </div>`;

  let _searchTimer;
  el.querySelector('#ct-search').addEventListener('input', (e) => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => _refresh(e.target.value.trim()), 250);
  });

  el.querySelector('#ct-new-btn').addEventListener('click', () => _openForm(null, _refresh));

  el.querySelectorAll('.ct-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeStatus = btn.dataset.status;
      el.querySelectorAll('.ct-filter').forEach(b => b.classList.toggle('active', b === btn));
      _refresh(el.querySelector('#ct-search').value.trim());
    });
  });

  await _refresh('');

  async function _refresh(search = '') {
    const username = store.state.loggedUser?.username;
    const q = { search };
    if (_activeStatus) q.status = _activeStatus;
    if (username) q.username = username;
    const contacts = await API.contacts.list(q).catch(() => []);
    _renderGrid(el.querySelector('#ct-grid'), contacts, () => _refresh(search));
  }
}

// ── Grid ─────────────────────────────────────────────────────────────────────

function _renderGrid(container, contacts, refresh) {
  if (!contacts.length) {
    container.innerHTML = `<div class="ct-empty">
      <div style="font-size:48px;margin-bottom:12px">👥</div>
      <p>${_activeStatus ? 'Sin contactos con ese estado' : 'Aún no hay contactos. ¡Agrega el primero!'}</p>
    </div>`;
    return;
  }

  container.innerHTML = contacts.map(c => _card(c)).join('');

  container.querySelectorAll('.ct-card').forEach(card => {
    const id = parseInt(card.dataset.id);
    const c  = contacts.find(x => x.id === id);

    card.querySelector('.ct-edit')?.addEventListener('click', (e) => {
      e.stopPropagation();
      _openForm(c, refresh);
    });

    card.querySelector('.ct-del')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`¿Eliminar a ${c.name}?`)) return;
      await API.contacts.delete(id);
      showToast('Contacto eliminado', 'success');
      refresh();
    });

    card.querySelector('.ct-toggle-active')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await API.contacts.toggleActive(id);
      refresh();
    });
  });
}

function _card(c) {
  const initials = c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const sm       = STATUS_META[c.status] || STATUS_META.lead;
  const inactive = !c.active;

  return `
    <div class="ct-card ${inactive ? 'ct-inactive' : ''}" data-id="${c.id}">
      <div class="ct-card-top">
        <div class="ct-avatar">${initials}</div>
        <div class="ct-card-info">
          <div class="ct-name">${_esc(c.name)}</div>
          ${c.company ? `<div class="ct-company">${_esc(c.company)}</div>` : ''}
        </div>
        <span class="ct-status-badge" style="background:${sm.color}22;color:${sm.color};border-color:${sm.color}44">
          ${sm.label}
        </span>
      </div>

      <div class="ct-card-contact">
        ${c.email ? `<a href="mailto:${_esc(c.email)}" class="ct-contact-link" title="${_esc(c.email)}">✉️ ${_esc(c.email)}</a>` : ''}
        ${c.phone ? `<a href="tel:${_esc(c.phone)}"    class="ct-contact-link" title="${_esc(c.phone)}">📞 ${_esc(c.phone)}</a>` : ''}
      </div>

      ${c.notes ? `<div class="ct-notes-preview">${_esc(c.notes).slice(0, 80)}${c.notes.length > 80 ? '…' : ''}</div>` : ''}

      <div class="ct-card-actions">
        <button class="ct-action-btn ct-toggle-active" title="${c.active ? 'Desactivar' : 'Activar'}">
          ${c.active ? '🟢 Activo' : '🔴 Inactivo'}
        </button>
        <div style="display:flex;gap:6px">
          <button class="ct-action-btn ct-edit">✏️ Editar</button>
          <button class="ct-action-btn danger ct-del">🗑️</button>
        </div>
      </div>
    </div>`;
}

// ── Form modal (same openModal pattern as Notes/Tasks) ────────────────────────

function _openForm(contact, onSaved) {
  const isEdit = !!contact;
  const c      = contact || {};

  const statusOpts = Object.entries(STATUS_META).map(([v, m]) =>
    `<option value="${v}" ${(c.status || 'lead') === v ? 'selected' : ''}>${m.label}</option>`).join('');

  openModal({
    title: isEdit ? '✏️ Editar contacto' : '👥 Nuevo contacto',
    content: `
      <div class="form-group">
        <label>Nombre *</label>
        <input class="form-control" id="cf-name" data-field="name" placeholder="Nombre completo"
               value="${_esc(c.name || '')}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label>Empresa</label>
          <input class="form-control" id="cf-company" data-field="company" placeholder="Empresa S.A."
                 value="${_esc(c.company || '')}">
        </div>
        <div class="form-group">
          <label>Estado</label>
          <select class="form-control" id="cf-status" data-field="status">${statusOpts}</select>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input class="form-control" id="cf-email" data-field="email" type="email" placeholder="correo@ejemplo.com"
                 value="${_esc(c.email || '')}">
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input class="form-control" id="cf-phone" data-field="phone" placeholder="+1 555 000 0000"
                 value="${_esc(c.phone || '')}">
        </div>
      </div>
      <div class="form-group">
        <label>Notas</label>
        <textarea class="form-control" id="cf-notes" data-field="notes" rows="3" style="resize:vertical"
          placeholder="Información adicional…">${_esc(c.notes || '')}</textarea>
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:10px;margin-top:4px">
        <label style="margin:0;display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="cf-active" ${(c.active ?? 1) ? 'checked' : ''}
                 style="width:16px;height:16px;accent-color:var(--red);cursor:pointer">
          <span>Contacto activo</span>
        </label>
      </div>`,
    actions: [
      { label: 'Cancelar', class: 'btn-secondary', action: (close) => close() },
      {
        label: isEdit ? 'Guardar' : 'Crear',
        class: 'btn-primary',
        action: async (close, formEl) => {
          clearFieldErrors(formEl);
          const username = store.state.loggedUser?.username;
          const payload = {
            name:    document.getElementById('cf-name').value.trim(),
            company: document.getElementById('cf-company').value.trim() || null,
            email:   document.getElementById('cf-email').value.trim()   || null,
            phone:   document.getElementById('cf-phone').value.trim()   || null,
            status:  document.getElementById('cf-status').value,
            notes:   document.getElementById('cf-notes').value.trim()   || null,
            active:  document.getElementById('cf-active').checked ? 1 : 0,
            username,
          };
          try {
            if (isEdit) {
              await API.contacts.update(c.id, payload);
              showToast('Contacto actualizado', 'success');
            } else {
              await API.contacts.create(payload);
              showToast('Contacto creado', 'success');
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
  setTimeout(() => document.getElementById('cf-name')?.focus(), 80);
}

function _esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
