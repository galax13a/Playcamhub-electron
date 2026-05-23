'use strict';

const { layout } = require('./_layout');

/**
 * menu.js — Plugin & menu management page.
 *
 * Shows all registered plugins with enable/disable toggles.
 * Toggling sends PATCH /admin/api/plugins/:id/toggle (JSON response).
 * Also shows the hardcoded core nav items (Home, Settings) as read-only reference.
 */

const CORE_ITEMS = [
  { icon: '🏠', label: 'Inicio',   view: 'home',     always: true },
  { icon: '⚙️', label: 'Ajustes', view: 'settings', always: true },
];

/** @param {{ plugins:Array, flash?:object }} data */
function menuPage({ plugins, flash } = {}) {

  // Core nav — always visible, no toggle
  const coreRows = CORE_ITEMS.map(n => `
    <tr>
      <td>${n.icon}</td>
      <td><strong style="color:#fff">${n.label}</strong></td>
      <td><span class="tag">${n.view}</span></td>
      <td>—</td>
      <td><span class="badge b-blue">Core — siempre visible</span></td>
      <td></td>
    </tr>`).join('');

  // Plugin nav items — toggleable
  const pluginRows = plugins.map(p => `
    <tr data-plugin="${p.id}">
      <td style="font-size:20px">${p.icon || '🔌'}</td>
      <td>
        <strong style="color:#fff">${p.name}</strong>
        ${p.description ? `<div class="text-sm text-muted mb-4">${p.description}</div>` : ''}
      </td>
      <td><span class="tag">${p.id}</span></td>
      <td><span class="tag" style="color:var(--muted)">${p.version || '?'}</span></td>
      <td>
        <span class="badge ${p.enabled ? 'b-green' : 'b-muted'}" id="badge-${p.id}">
          ${p.enabled ? '● Activo' : '○ Inactivo'}
        </span>
      </td>
      <td>
        <label class="toggle" title="${p.enabled ? 'Desactivar plugin' : 'Activar plugin'}">
          <input type="checkbox" ${p.enabled ? 'checked' : ''}
                 onchange="togglePlugin('${p.id}', this.checked)">
          <div class="t-track"></div>
          <div class="t-thumb"></div>
        </label>
      </td>
    </tr>`).join('');

  const content = `
    <!-- Info banner -->
    <div class="flash flash-info" style="margin-bottom:20px">
      ℹ Los cambios de estado de plugins se aplican al <strong>reiniciar la aplicación</strong>.
      Las rutas y las vistas del frontend de un plugin solo se cargan durante el arranque.
    </div>

    <!-- Core nav items -->
    <div class="card">
      <div class="card-title">
        <span class="card-title-icon">🔒</span>
        Elementos del menú — Core (siempre visibles)
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th></th><th>Nombre</th><th>Vista</th><th>Autor</th><th>Estado</th><th></th>
          </tr></thead>
          <tbody>${coreRows}</tbody>
        </table>
      </div>
    </div>

    <!-- Plugin nav items -->
    <div class="card">
      <div class="card-title">
        <span class="card-title-icon">🧩</span>
        Plugins — Controla qué aparece en el menú lateral
      </div>
      ${plugins.length ? `
        <div class="tbl-wrap">
          <table>
            <thead><tr>
              <th></th><th>Plugin</th><th>ID</th><th>Versión</th><th>Estado</th><th>Toggle</th>
            </tr></thead>
            <tbody>${pluginRows}</tbody>
          </table>
        </div>` : `
        <p class="text-muted text-sm">
          No hay plugins registrados en la base de datos. Coloca la carpeta del plugin en
          <code>plugins/</code> y reinicia la app.
        </p>`}
    </div>

    <script>
      async function togglePlugin(id, enable) {
        try {
          const res = await fetch('/admin/api/plugins/' + id + '/toggle', {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ enabled: enable ? 1 : 0 }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error desconocido');

          // Update badge text without page reload
          const badge = document.getElementById('badge-' + id);
          if (badge) {
            badge.textContent = enable ? '● Activo' : '○ Inactivo';
            badge.className   = 'badge ' + (enable ? 'b-green' : 'b-muted');
          }
          toast(enable ? '✅ Plugin activado — reinicia la app para aplicar' : '⏸ Plugin desactivado — reinicia la app para aplicar');
        } catch (err) {
          toast('❌ ' + err.message, false);
          // Revert toggle on error
          event.target.checked = !enable;
        }
      }
    </script>`;

  return layout({ title: 'Menú & Plugins', content, active: 'menu', flash });
}

module.exports = { menuPage };
