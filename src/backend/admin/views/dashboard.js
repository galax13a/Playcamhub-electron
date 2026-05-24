'use strict';

const { layout } = require('./_layout');

/**
 * dashboard.js — Main overview page.
 *
 * Shows: stat cards (plugins, users, settings), plugin list summary,
 * app info from env, and a system info strip.
 */

/** @param {{ plugins:Array, users:Array, settings:Array }} data */
function dashboardPage({ plugins, users, settings, flash, csrfToken = '' } = {}) {
  const total    = plugins.length;
  const active   = plugins.filter(p => p.enabled).length;
  const inactive = total - active;

  const statsHtml = `
    <div class="stat-grid">
      <div class="stat c-green">
        <div class="stat-val">${active}</div>
        <div class="stat-lbl">🟢 Plugins activos</div>
      </div>
      <div class="stat c-red">
        <div class="stat-val">${inactive}</div>
        <div class="stat-lbl">⭕ Plugins inactivos</div>
      </div>
      <div class="stat c-blue">
        <div class="stat-val">${users.length}</div>
        <div class="stat-lbl">👤 Usuarios</div>
      </div>
      <div class="stat c-yellow">
        <div class="stat-val">${settings.length}</div>
        <div class="stat-lbl">⚙ Ajustes en DB</div>
      </div>
    </div>`;

  // Plugin quick table
  const pluginRows = plugins.map(p => `
    <tr>
      <td><strong style="color:#fff">${p.name}</strong></td>
      <td><span class="tag">${p.id}</span></td>
      <td>${p.version || '—'}</td>
      <td>
        <span class="badge ${p.enabled ? 'b-green' : 'b-muted'}">
          ${p.enabled ? '● Activo' : '○ Inactivo'}
        </span>
      </td>
      <td><a href="/admin/menu" class="btn btn-ghost btn-sm">Gestionar →</a></td>
    </tr>`).join('');

  // App info from env
  const envInfo = [
    ['APP_NAME',    process.env.APP_NAME    || 'Starcho Electron'],
    ['APP_VERSION', process.env.APP_VERSION || '1.0.0'],
    ['APP_SLOGAN',  process.env.APP_SLOGAN  || '—'],
    ['NODE_ENV',    process.env.NODE_ENV    || 'development'],
    ['DEVTOOLS',    process.env.DEVTOOLS    || 'false'],
  ].map(([k, v]) => `
    <div class="info-row">
      <span class="info-key">${k}</span>
      <span class="info-val">${v}</span>
    </div>`).join('');

  const content = `
    ${statsHtml}

    <div class="grid-2">
      <!-- Plugins summary -->
      <div class="card">
        <div class="card-title"><span class="card-title-icon">🧩</span> Plugins registrados</div>
        ${plugins.length ? `
          <div class="tbl-wrap">
            <table>
              <thead><tr>
                <th>Nombre</th><th>ID</th><th>Versión</th><th>Estado</th><th></th>
              </tr></thead>
              <tbody>${pluginRows}</tbody>
            </table>
          </div>` : `<p class="text-muted text-sm">No hay plugins registrados.</p>`}
      </div>

      <!-- App info -->
      <div>
        <div class="card">
          <div class="card-title"><span class="card-title-icon">📋</span> Variables de entorno</div>
          ${envInfo}
          <div class="fhint" style="margin-top:12px">
            💡 Para cambiar APP_NAME / APP_VERSION edita el archivo <code>.env</code> y reinicia la app.
          </div>
        </div>

        <div class="card">
          <div class="card-title"><span class="card-title-icon">🔗</span> Accesos rápidos</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <a href="/admin/menu"   class="btn btn-secondary">🧩 Gestionar plugins</a>
            <a href="/admin/config" class="btn btn-secondary">⚙ Configuración</a>
            <a href="/admin/users"  class="btn btn-secondary">👤 Ver usuarios</a>
          </div>
        </div>
      </div>
    </div>`;

  return layout({ title: 'Dashboard', content, active: 'dashboard', flash, csrfToken });
}

module.exports = { dashboardPage };
