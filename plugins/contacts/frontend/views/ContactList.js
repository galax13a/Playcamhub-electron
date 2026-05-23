/**
 * ContactList.js — full-page contact list view for the Contacts plugin.
 *
 * Structure:
 *  - Header bar (title + search input + "New contact" button)
 *  - Status filter strip (All / Lead / Prospect / Customer / Inactive)
 *  - Universal Paginator (AJAX, server-side, 5/15/25/50/100 per page)
 */
import API        from '../../../../src/renderer/utils/api.js';
import { Paginator } from '../../../../src/renderer/utils/Paginator.js';
import { openModal, showToast, markFieldErrors, clearFieldErrors }
                  from '../../../../src/renderer/components/Modal.js';
import store      from '../../../../src/renderer/store.js';
import { esc, formGroup, grid }
                  from '../../../../src/renderer/utils/html.js';
import { viewHeader, filterBar, wireFilters }
                  from '../../../../src/renderer/components/ui.js';

const STATUS_META = {
  lead:     { label: 'Lead',      color: '#60a5fa' },
  prospect: { label: 'Prospect',  color: '#f59e0b' },
  customer: { label: 'Cliente',   color: '#10b981' },
  churned:  { label: 'Inactivo',  color: '#6b7280' },
};

const FILTERS = [
  { label: 'Todos',       value: '' },
  { label: '🔵 Lead',     value: 'lead' },
  { label: '🟡 Prospect', value: 'prospect' },
  { label: '🟢 Cliente',  value: 'customer' },
  { label: '⚫ Inactivo', value: 'churned' },
];

let _activeStatus = '';
let _search       = '';
let _paginator    = null;

export async function renderContactList(el) {
  _activeStatus = '';
  _search       = '';

  el.innerHTML = `
    <div class="ct-container">
      ${viewHeader('👥 Contactos',
        `<input class="ct-search form-control" id="ct-search" placeholder="🔍 Buscar…" style="width:200px">
         <button class="ct-new-btn" id="ct-new-btn">+ Nuevo contacto</button>`,
        'ct-header'
      )}
      ${filterBar(FILTERS, '', {
        dataAttr:  'status',
        btnClass:  'ct-filter',
        wrapClass: 'ct-filters',
        wrapId:    'ct-filters',
      })}
      <div id="ct-paginator"></div>
    </div>`;

  // Debounced search
  let _searchTimer;
  el.querySelector('#ct-search').addEventListener('input', e => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      _search = e.target.value.trim();
      _paginator?.setParams(_buildParams()).refresh();
    }, 250);
  });

  el.querySelector('#ct-new-btn').addEventListener('click', () =>
    _openForm(null, () => _paginator?.refresh())
  );

  wireFilters(el, '.ct-filter', 'status', val => {
    _activeStatus = val;
    _paginator?.setParams(_buildParams()).refresh();
  });

  _paginator = new Paginator({
    container:      el.querySelector('#ct-paginator'),
    fetchFn:        params => API.contacts.list({ ...params, ..._buildParams() }),
    renderFn:       _renderGrid,
    defaultPerPage: 12,
  });

  await _paginator.mount();
}

function _buildParams() {
  const username = store.state.loggedUser?.username;
  const q = {};
  if (_search)       q.search   = _search;
  if (_activeStatus) q.status   = _activeStatus;
  if (username)      q.username = username;
  return q;
}

// ── Grid renderer ──────────────────────────────────────────────────────────────

function _renderGrid(contacts, container, refresh) {
  if (!contacts.length) {
    container.innerHTML = `<div class="ct-empty">
      <div style="font-size:48px;margin-bottom:12px">👥</div>
      <p>${_activeStatus ? 'Sin contactos con ese estado' : _search ? 'Sin resultados para esa búsqueda' : 'Aún no hay contactos. ¡Agrega el primero!'}</p>
    </div>`;
    return;
  }

  container.innerHTML = `<div class="ct-grid">${contacts.map(c => _card(c)).join('')}</div>`;

  container.querySelectorAll('.ct-card').forEach(card => {
    const id = parseInt(card.dataset.id);
    const c  = contacts.find(x => x.id === id);

    card.querySelector('.ct-edit')?.addEventListener('click', e => {
      e.stopPropagation();
      _openForm(c, refresh);
    });

    card.querySelector('.ct-del')?.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm(`¿Eliminar a ${c.name}?`)) return;
      await API.contacts.delete(id);
      showToast('Contacto eliminado', 'success');
      refresh();
    });

    card.querySelector('.ct-toggle-active')?.addEventListener('click', async e => {
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
          <div class="ct-name">${esc(c.name)}</div>
          ${c.company ? `<div class="ct-company">${esc(c.company)}</div>` : ''}
        </div>
        <span class="ct-status-badge" style="background:${sm.color}22;color:${sm.color};border-color:${sm.color}44">
          ${sm.label}
        </span>
      </div>

      <div class="ct-card-contact">
        ${c.email ? `<a href="mailto:${esc(c.email)}" class="ct-contact-link">${esc(c.email)}</a>` : ''}
        ${c.phone ? `<a href="tel:${esc(c.phone)}"    class="ct-contact-link">📞 ${esc(c.phone)}</a>` : ''}
      </div>

      ${c.notes ? `<div class="ct-notes-preview">${esc(c.notes).slice(0, 80)}${c.notes.length > 80 ? '…' : ''}</div>` : ''}

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

// ── Create / Edit form modal ───────────────────────────────────────────────────

function _openForm(contact, onSaved) {
  const isEdit = !!contact;
  const c      = contact || {};

  const statusOpts = Object.entries(STATUS_META).map(([v, m]) =>
    `<option value="${v}" ${(c.status || 'lead') === v ? 'selected' : ''}>${m.label}</option>`).join('');

  openModal({
    title: isEdit ? '✏️ Editar contacto' : '👥 Nuevo contacto',
    content: `
      ${formGroup({ label: 'Nombre *', id: 'cf-name', dataField: 'name', placeholder: 'Nombre completo', value: esc(c.name || '') })}
      ${grid(2, '12px',
        formGroup({ label: 'Empresa',  id: 'cf-company', dataField: 'company', placeholder: 'Empresa S.A.',       value: esc(c.company || '') }),
        formGroup({ label: 'Estado',   id: 'cf-status',  dataField: 'status',  type: 'select', options: statusOpts }),
        formGroup({ label: 'Email',    id: 'cf-email',   dataField: 'email',   type: 'email', placeholder: 'correo@ejemplo.com', value: esc(c.email || '') }),
        formGroup({ label: 'Teléfono', id: 'cf-phone',   dataField: 'phone',   type: 'tel',   placeholder: '+1 555 000 0000',    value: esc(c.phone || '') }),
      )}
      ${formGroup({ label: 'Notas', id: 'cf-notes', dataField: 'notes', type: 'textarea', rows: 3, placeholder: 'Información adicional…', value: esc(c.notes || '') })}
      <div class="form-group" style="display:flex;align-items:center;gap:10px;margin-top:4px">
        <label style="margin:0;display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="cf-active" ${(c.active ?? 1) ? 'checked' : ''}
                 style="width:16px;height:16px;accent-color:var(--red);cursor:pointer">
          <span>Contacto activo</span>
        </label>
      </div>`,
    actions: [
      { label: 'Cancelar', class: 'btn-secondary', action: close => close() },
      {
        label: isEdit ? 'Guardar' : 'Crear',
        class: 'btn-primary',
        action: async (close, formEl) => {
          clearFieldErrors(formEl);
          const username = store.state.loggedUser?.username;
          const payload  = {
            name:    formEl.querySelector('#cf-name').value.trim(),
            company: formEl.querySelector('#cf-company').value.trim() || null,
            email:   formEl.querySelector('#cf-email').value.trim()   || null,
            phone:   formEl.querySelector('#cf-phone').value.trim()   || null,
            status:  formEl.querySelector('#cf-status').value,
            notes:   formEl.querySelector('#cf-notes').value.trim()   || null,
            active:  formEl.querySelector('#cf-active').checked ? 1 : 0,
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

  setTimeout(() => document.querySelector('.modal-overlay:last-child #cf-name')?.focus(), 80);
}
