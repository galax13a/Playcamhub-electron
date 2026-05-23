'use strict';

const { layout } = require('./_layout');

/**
 * users.js — User management page.
 * Features: paginated list, search, inline edit form, create, delete, reset password.
 */

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * @param {{
 *   users: Array,
 *   flash?: object,
 *   page: number,
 *   totalPages: number,
 *   total: number,
 *   search?: string,
 *   editUser?: object
 * }} data
 */
function usersPage({ users = [], flash, page = 1, totalPages = 1, total = 0, search = '', editUser = null } = {}) {

  // ── Edit panel (shown when ?edit=ID) ──────────────────────────────────────

  const editPanel = editUser ? `
    <div class="card" style="border-color:rgba(88,166,255,.35);background:rgba(88,166,255,.04)" id="edit-panel">
      <div class="card-title" style="color:var(--blue)">
        <span class="card-title-icon">✏️</span>
        Editar usuario — <code style="font-size:13px">${esc(editUser.username)}</code>
      </div>
      <form method="POST" action="/admin/users/${editUser.id}/update">
        <div class="frow">
          <div class="fgroup">
            <label class="flabel" for="eu-username">Usuario *</label>
            <input class="finput" type="text" id="eu-username" name="username"
                   value="${esc(editUser.username)}" required>
          </div>
          <div class="fgroup">
            <label class="flabel" for="eu-fullname">Nombre completo</label>
            <input class="finput" type="text" id="eu-fullname" name="full_name"
                   value="${esc(editUser.full_name)}" placeholder="Nombre Apellido">
          </div>
        </div>
        <div class="frow">
          <div class="fgroup">
            <label class="flabel" for="eu-nickname">Apodo</label>
            <input class="finput" type="text" id="eu-nickname" name="nickname"
                   value="${esc(editUser.nickname)}" placeholder="Apodo">
          </div>
          <div class="fgroup">
            <label class="flabel" for="eu-whatsapp">WhatsApp</label>
            <input class="finput" type="text" id="eu-whatsapp" name="whatsapp"
                   value="${esc(editUser.whatsapp)}" placeholder="+1 555 000 0000">
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-primary" type="submit">💾 Guardar cambios</button>
          <a href="/admin/users" class="btn btn-secondary">✕ Cancelar</a>
        </div>
      </form>
    </div>` : '';

  // ── User table rows ────────────────────────────────────────────────────────

  const rows = users.map(u => {
    const initials = (u.full_name || u.username || '?')
      .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    const isEditing = editUser && editUser.id === u.id;

    return `
      <tr${isEditing ? ' style="background:rgba(88,166,255,.06)"' : ''}>
        <td>
          ${u.avatar
            ? `<img src="${esc(u.avatar)}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:1px solid var(--border)">`
            : `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#f85149,#9c3fe8);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0">${initials}</div>`}
        </td>
        <td><strong style="color:#fff">${esc(u.username)}</strong></td>
        <td>${esc(u.full_name) || '<em class="text-muted">—</em>'}</td>
        <td>${esc(u.nickname)  || '<em class="text-muted">—</em>'}</td>
        <td>${esc(u.whatsapp)  || '<em class="text-muted">—</em>'}</td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <a href="/admin/users?edit=${u.id}#edit-panel" class="btn btn-secondary btn-sm">✏️ Editar</a>
            <form method="POST" action="/admin/users/reset-password" style="display:inline">
              <input type="hidden" name="username" value="${esc(u.username)}">
              <button class="btn btn-secondary btn-sm" type="submit"
                      onclick="return confirm('¿Resetear contraseña de ${esc(u.username)}?')">
                🔑 Reset
              </button>
            </form>
            <form method="POST" action="/admin/users/${u.id}/delete" style="display:inline">
              <button class="btn btn-sm" type="submit"
                      style="background:rgba(248,81,73,.1);color:var(--accent);border:1px solid rgba(248,81,73,.3)"
                      onclick="return confirm('¿Eliminar al usuario ${esc(u.username)}? Esta acción no se puede deshacer.')">
                🗑 Eliminar
              </button>
            </form>
          </div>
        </td>
      </tr>`;
  }).join('');

  const emptyMsg = `
    <tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)">
      ${search ? `Sin resultados para "<strong>${esc(search)}</strong>"` : 'No hay usuarios registrados.'}
    </td></tr>`;

  // ── Pagination ─────────────────────────────────────────────────────────────

  const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(`<a href="/admin/users?page=${i}${searchParam}"
      class="btn btn-sm ${i === page ? 'btn-primary' : 'btn-secondary'}">${i}</a>`);
  }

  const paginationHtml = totalPages > 1 ? `
    <div style="display:flex;align-items:center;gap:6px;margin-top:16px;flex-wrap:wrap">
      ${page > 1
        ? `<a href="/admin/users?page=${page - 1}${searchParam}" class="btn btn-secondary btn-sm">← Anterior</a>`
        : `<span class="btn btn-secondary btn-sm" style="opacity:.4;cursor:default">← Anterior</span>`}
      ${pages.join('')}
      ${page < totalPages
        ? `<a href="/admin/users?page=${page + 1}${searchParam}" class="btn btn-secondary btn-sm">Siguiente →</a>`
        : `<span class="btn btn-secondary btn-sm" style="opacity:.4;cursor:default">Siguiente →</span>`}
      <span class="text-muted text-sm" style="margin-left:8px">${total} usuarios · página ${page}/${totalPages}</span>
    </div>` : '';

  // ── Layout ─────────────────────────────────────────────────────────────────

  const content = `
    ${editPanel}

    <!-- User list -->
    <div class="card">
      <div class="card-title">
        <span class="card-title-icon">👤</span>
        Usuarios registrados
        <span class="badge b-blue ml-auto">${total} usuarios</span>
      </div>

      <!-- Search -->
      <form method="GET" action="/admin/users" style="display:flex;gap:10px;margin-bottom:16px">
        <input class="finput" type="text" name="search" placeholder="Buscar por usuario, nombre o apodo…"
               value="${esc(search)}" style="max-width:320px">
        <button class="btn btn-secondary" type="submit">🔍 Buscar</button>
        ${search ? `<a href="/admin/users" class="btn btn-ghost">✕ Limpiar</a>` : ''}
      </form>

      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th></th>
            <th>Usuario</th>
            <th>Nombre completo</th>
            <th>Apodo</th>
            <th>WhatsApp</th>
            <th>Acciones</th>
          </tr></thead>
          <tbody>
            ${users.length ? rows : emptyMsg}
          </tbody>
        </table>
      </div>
      ${paginationHtml}
    </div>

    <!-- Create user -->
    <div class="card">
      <div class="card-title"><span class="card-title-icon">➕</span> Crear usuario</div>
      <form method="POST" action="/admin/users/create">
        <div class="frow">
          <div class="fgroup">
            <label class="flabel" for="new-username">Nombre de usuario *</label>
            <input class="finput" type="text" id="new-username" name="username"
                   placeholder="john_doe" required>
          </div>
          <div class="fgroup">
            <label class="flabel" for="new-password">Contraseña *</label>
            <input class="finput" type="password" id="new-password" name="password"
                   placeholder="Mínimo 6 caracteres" required minlength="6">
          </div>
        </div>
        <button class="btn btn-primary" type="submit">➕ Crear usuario</button>
      </form>
    </div>

    <!-- Admin credentials note -->
    <div class="card" style="border-color:rgba(248,81,73,.3);background:rgba(248,81,73,.04)">
      <div class="card-title" style="color:var(--accent)">
        <span class="card-title-icon">🔒</span> Credenciales del panel admin
      </div>
      <div class="info-row">
        <span class="info-key">Email admin</span>
        <span class="info-val">root@starcho.com</span>
      </div>
      <div class="info-row">
        <span class="info-key">Contraseña admin</span>
        <span class="info-val">●●●●●●●</span>
      </div>
      <div class="fhint" style="margin-top:12px">
        ⚠ Las credenciales del panel admin están definidas en
        <code>src/backend/admin/sessions.js</code>. Son independientes de los usuarios de la app.
      </div>
    </div>`;

  return layout({ title: 'Usuarios', content, active: 'users', flash });
}

module.exports = { usersPage };
