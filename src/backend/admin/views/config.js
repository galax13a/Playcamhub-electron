'use strict';

const { layout } = require('./_layout');

/**
 * config.js — Application configuration page.
 *
 * Sections:
 *  1. Quick settings — select dropdowns for theme, language, volume, repeat, shuffle
 *     with live theme color preview via JS
 *  2. Environment (.env) editor — raw textarea, saved to disk
 *  3. All DB settings — full CRUD table (edit inline + delete + add new row)
 */

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Theme definitions ─────────────────────────────────────────────────────────

const THEMES = [
  { id: 'dark',      label: 'Dark',       bg: '#111111', accent: '#FF3366', purple: '#8B5CF6' },
  { id: 'light',     label: 'Light',      bg: '#FAFAFF', accent: '#FF3366', purple: '#8B5CF6' },
  { id: 'matrix',    label: 'Matrix',     bg: '#000000', accent: '#00FF41', purple: '#00CC33' },
  { id: 'kick',      label: 'Kick',       bg: '#070d07', accent: '#53FC18', purple: '#39ff14' },
  { id: 'neon',      label: 'Neon',       bg: '#030012', accent: '#FF00FF', purple: '#39FF14' },
  { id: 'ocean',     label: 'Ocean',      bg: '#010C1A', accent: '#00B4D8', purple: '#52B788' },
  { id: 'pink',      label: 'Pink',       bg: '#0D0408', accent: '#FF2D78', purple: '#FF69B4' },
  { id: 'red',       label: 'Red',        bg: '#090202', accent: '#FF1744', purple: '#FF5252' },
  { id: 'arcade',    label: 'Arcade',     bg: '#05020F', accent: '#FFD700', purple: '#39FF14' },
  { id: 'military',  label: 'Military',   bg: '#0B0C07', accent: '#8FA820', purple: '#4E7C32' },
  { id: 'winamp',    label: 'Winamp',     bg: '#1c1c1c', accent: '#00B4D8', purple: '#48CAE4' },
  { id: 'rickmorty', label: 'Rick&Morty', bg: '#06090f', accent: '#39FF14', purple: '#0077FF' },
];

// ── Select options ─────────────────────────────────────────────────────────────

const LANGUAGE_OPTS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
];

const REPEAT_OPTS = [
  { value: 'none',    label: 'Sin repetición' },
  { value: 'all',     label: 'Repetir todo' },
  { value: 'one',     label: 'Repetir uno' },
  { value: 'library', label: 'Biblioteca completa' },
];

const SHUFFLE_OPTS = [
  { value: 'false', label: 'Desactivado' },
  { value: 'true',  label: 'Activado' },
];

const TITLEBAR_OPTS = [
  { value: 'default', label: 'Default (Windows-style, controles a la derecha)' },
  { value: 'mac',     label: 'Mac — controles a la izquierda + frosted glass' },
  { value: 'linux',   label: 'Linux — botones cuadrados planos (GNOME/KDE)' },
  { value: 'cartoon', label: 'Cartoon / Game — botones gigantes animados 🎮' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function select(id, name, opts, current) {
  const options = opts.map(o => {
    const sel = String(o.value) === String(current) ? ' selected' : '';
    return `<option value="${esc(o.value)}"${sel}>${esc(o.label)}</option>`;
  }).join('');
  return `<select class="finput fselect" id="${id}" name="${name}">${options}</select>`;
}

/**
 * @param {{
 *   settings: Object<string,string>,
 *   envContent: string,
 *   flash?: object,
 *   editKey?: string
 * }} data
 */
function configPage({ settings = {}, envContent = '', flash, csrfToken = '' } = {}) {

  const cur = k => settings[k] || '';

  // ── 1. Quick settings ──────────────────────────────────────────────────────

  // Build theme select options with color swatches via data attributes
  const themeOpts = THEMES.map(t => {
    const sel = cur('theme') === t.id ? ' selected' : '';
    return `<option value="${t.id}"${sel} data-bg="${t.bg}" data-accent="${t.accent}" data-purple="${t.purple}">${t.label}</option>`;
  }).join('');

  // Find current theme data for initial preview
  const activeThem = THEMES.find(t => t.id === cur('theme')) || THEMES[0];

  const quickSettings = `
    <div class="card">
      <div class="card-title">
        <span class="card-title-icon">⚙</span> Ajustes rápidos (base de datos)
      </div>
      <form method="POST" action="/admin/config">
        <div class="frow" style="grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

          <!-- Theme -->
          <div class="fgroup" style="margin-bottom:0">
            <label class="flabel" for="s-theme">Tema de la interfaz</label>
            <select class="finput fselect" id="s-theme" name="theme" onchange="updateThemePreview(this)">
              ${themeOpts}
            </select>
            <div id="theme-preview" style="display:flex;gap:6px;margin-top:10px;align-items:center;flex-wrap:wrap">
              <div id="tp-bg"     style="width:24px;height:24px;border-radius:5px;border:1px solid rgba(255,255,255,.15);background:${activeThem.bg};title:'Fondo'"></div>
              <div id="tp-accent" style="width:24px;height:24px;border-radius:5px;border:1px solid rgba(255,255,255,.15);background:${activeThem.accent}"></div>
              <div id="tp-purple" style="width:24px;height:24px;border-radius:5px;border:1px solid rgba(255,255,255,.15);background:${activeThem.purple}"></div>
              <span id="tp-label" class="text-muted text-sm" style="margin-left:4px">${activeThem.label}</span>
            </div>
            <div class="fhint">Tema visual activo del renderer</div>
          </div>

          <!-- Language -->
          <div class="fgroup" style="margin-bottom:0">
            <label class="flabel" for="s-language">Idioma</label>
            ${select('s-language', 'language', LANGUAGE_OPTS, cur('language'))}
            <div class="fhint">Idioma de la interfaz (es, en, pt)</div>
          </div>

        </div>

        <div class="frow" style="grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">

          <!-- Volume -->
          <div class="fgroup" style="margin-bottom:0">
            <label class="flabel" for="s-volume">Volumen <span id="vol-val" style="color:#fff;font-size:12px">${cur('volume') || 80}%</span></label>
            <input class="finput" type="range" id="s-volume" name="volume"
                   min="0" max="100" step="1" value="${esc(cur('volume') || '80')}"
                   style="padding:6px 0;cursor:pointer"
                   oninput="document.getElementById('vol-val').textContent = this.value + '%'">
            <div class="fhint">Volumen del reproductor (0–100)</div>
          </div>

          <!-- Repeat -->
          <div class="fgroup" style="margin-bottom:0">
            <label class="flabel" for="s-repeat">Modo de repetición</label>
            ${select('s-repeat', 'repeat', REPEAT_OPTS, cur('repeat'))}
            <div class="fhint">Comportamiento al terminar una pista</div>
          </div>

          <!-- Shuffle -->
          <div class="fgroup" style="margin-bottom:0">
            <label class="flabel" for="s-shuffle">Aleatorio</label>
            ${select('s-shuffle', 'shuffle', SHUFFLE_OPTS, cur('shuffle'))}
            <div class="fhint">Reproducción en orden aleatorio</div>
          </div>

        </div>

        <!-- Titlebar theme — full-width row -->
        <div class="fgroup" style="margin-bottom:20px">
          <label class="flabel" for="s-titlebar-theme">Tema de la barra de título</label>
          ${select('s-titlebar-theme', 'titlebar_theme', TITLEBAR_OPTS, cur('titlebar_theme') || 'default')}
          <div class="fhint">
            Cambia el estilo de los controles de ventana (min/max/cerrar).
            Los cambios se aplican al <strong>reiniciar la app</strong>.
          </div>
        </div>

        <button class="btn btn-primary" type="submit">💾 Guardar ajustes</button>
      </form>
    </div>

    <script>
    (function () {
      function updateThemePreview(sel) {
        const opt   = sel.options[sel.selectedIndex];
        const bg     = opt.dataset.bg;
        const accent = opt.dataset.accent;
        const purple = opt.dataset.purple;
        document.getElementById('tp-bg').style.background     = bg;
        document.getElementById('tp-accent').style.background = accent;
        document.getElementById('tp-purple').style.background = purple;
        document.getElementById('tp-label').textContent       = opt.textContent.trim();
      }
      window.updateThemePreview = updateThemePreview;
    })();
    </script>`;

  // ── 2. .env editor ────────────────────────────────────────────────────────

  const envEditor = `
    <div class="card" style="border-color:rgba(210,153,34,.3);background:rgba(210,153,34,.04)">
      <div class="card-title" style="color:var(--yellow)">
        <span class="card-title-icon">📄</span> Variables de entorno (.env)
      </div>
      <div class="flash flash-info" style="margin-bottom:14px">
        ⚠ Guardar este archivo reiniciará las variables de entorno al próximo arranque de la app.
        No elimines claves necesarias. Los cambios no se aplican hasta reiniciar.
      </div>
      <form method="POST" action="/admin/env">
        <div class="fgroup">
          <textarea class="finput" name="content" rows="14"
                    style="font-family:monospace;font-size:12px;line-height:1.6;resize:vertical"
                    spellcheck="false">${esc(envContent)}</textarea>
        </div>
        <button class="btn btn-primary" type="submit"
                onclick="return confirm('¿Guardar el archivo .env? Los cambios se aplicarán al reiniciar la app.')">
          💾 Guardar .env
        </button>
      </form>
    </div>`;

  // ── 3. All DB settings CRUD ────────────────────────────────────────────────

  const settingEntries = Object.entries(settings);

  const settingRows = settingEntries.length
    ? settingEntries.map(([k, v]) => `
        <tr id="row-${esc(k)}">
          <td><span class="tag">${esc(k)}</span></td>
          <td style="max-width:280px">
            <span id="val-${esc(k)}" style="font-size:12px;color:var(--text);word-break:break-all">${
              v && v.length > 60 ? esc(v.slice(0, 60)) + '…' : esc(v || '')
            }</span>
          </td>
          <td style="width:1%;white-space:nowrap">
            <div style="display:flex;gap:6px">
              <button class="btn btn-secondary btn-sm"
                      onclick="openEdit('${esc(k)}', ${JSON.stringify(esc(v))})">✏️ Editar</button>
              <form method="POST" action="/admin/config/setting/${encodeURIComponent(k)}/delete" style="display:inline">
                <button class="btn btn-sm" type="submit"
                        style="background:rgba(248,81,73,.1);color:var(--accent);border:1px solid rgba(248,81,73,.3)"
                        onclick="return confirm('¿Eliminar la clave \\'${esc(k)}\\'?')">
                  🗑
                </button>
              </form>
            </div>
          </td>
        </tr>`)
      .join('')
    : `<tr><td colspan="3" class="text-muted text-sm" style="text-align:center;padding:24px">
        No hay ajustes en la base de datos.
       </td></tr>`;

  const allSettings = `
    <div class="card">
      <div class="card-title">
        <span class="card-title-icon">🗄</span>
        Todos los ajustes en DB
        <span class="badge b-muted ml-auto">${settingEntries.length} claves</span>
      </div>

      <!-- Inline edit form (hidden by default) -->
      <div id="setting-edit-panel" style="display:none;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:16px;margin-bottom:16px">
        <div class="flabel" style="margin-bottom:10px">Editar: <code id="edit-key-label" style="color:#fff"></code></div>
        <form method="POST" id="setting-edit-form" action="">
          <div style="display:flex;gap:10px;align-items:flex-end">
            <div class="fgroup" style="flex:1;margin-bottom:0">
              <textarea class="finput" id="edit-val-input" name="value" rows="3"
                        style="font-family:monospace;font-size:12px;resize:vertical"></textarea>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
              <button class="btn btn-primary btn-sm" type="submit">💾</button>
              <button class="btn btn-secondary btn-sm" type="button" onclick="closeEdit()">✕</button>
            </div>
          </div>
        </form>
      </div>

      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Clave</th><th>Valor actual</th><th></th></tr></thead>
          <tbody id="settings-tbody">${settingRows}</tbody>
        </table>
      </div>

      <!-- Add new key-value -->
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
        <div class="flabel" style="margin-bottom:10px">Agregar nueva clave</div>
        <form method="POST" action="/admin/config/setting" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
          <div class="fgroup" style="margin-bottom:0;min-width:160px">
            <label class="flabel" for="new-key">Clave</label>
            <input class="finput" type="text" id="new-key" name="key"
                   placeholder="mi_ajuste" pattern="[\\w_\\-\\.:]+"
                   title="Solo letras, números, _, -, ., :" required>
          </div>
          <div class="fgroup" style="margin-bottom:0;flex:1;min-width:200px">
            <label class="flabel" for="new-val">Valor</label>
            <input class="finput" type="text" id="new-val" name="value" placeholder="valor">
          </div>
          <button class="btn btn-secondary" type="submit">➕ Agregar</button>
        </form>
      </div>
    </div>

    <script>
    function openEdit(key, val) {
      document.getElementById('edit-key-label').textContent = key;
      document.getElementById('setting-edit-form').action   = '/admin/config/setting/' + encodeURIComponent(key) + '/update';
      document.getElementById('edit-val-input').value       = val;
      document.getElementById('setting-edit-panel').style.display = 'block';
      document.getElementById('edit-val-input').focus();
    }
    function closeEdit() {
      document.getElementById('setting-edit-panel').style.display = 'none';
    }
    </script>`;

  const content = `
    <div class="grid-2" style="align-items:start">
      <div>
        ${quickSettings}
        ${envEditor}
      </div>
      <div>
        ${allSettings}
      </div>
    </div>`;

  return layout({ title: 'Configuración', content, active: 'config', flash, csrfToken });
}

module.exports = { configPage };
