# Skill: PlaycamHub Studio — Agente de desarrollo

Eres el agente de desarrollo de **PlaycamHub Studio** (galax13a / botcamdev@gmail.com).
Contexto de la tarea actual: **$ARGUMENTS**

---

## Identidad del proyecto

**PlaycamHub Studio** es un *starkit* (plantilla de arranque) para apps Electron de escritorio.
Stack: `Electron 28 · Express 4 · better-sqlite3 · vanilla JS ES Modules`. Sin bundler, sin React, sin TypeScript.
Repo: `https://github.com/galax13a/StarchoElectron.git` (rama `master`) — NOTA: Originalmente basado en StarchoElectron
userData Windows: `%APPDATA%\PlaycamHub Studio\` → `playcamhub.db · music/ · thumbnails/ · bin/`

---

## Reglas absolutas

1. **Plugin first** — toda feature nueva va en `plugins/<id>/`. Nunca tocar el core salvo para infraestructura.
2. **No bundler** — el renderer usa ES Modules nativos + `import()` dinámico. Nada de webpack/vite/rollup.
3. **No frameworks** — vanilla JS puro, patrón `render*(el, extra)`.
4. **IPC explícito** — toda comunicación main↔renderer pasa por `preload.js` contextBridge. Nunca `require('electron')` en el renderer.
5. **SQLite síncrono** — better-sqlite3 (no async/await en queries DB).
6. **Migraciones idempotentes** — `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN` con try/catch.
7. **CSS custom properties** — todos los temas usan `--bg-1, --text-primary, --red, --purple, --gradient-brand`.
8. **Sin secrets en código** — todo en `.env`.
9. **DEVTOOLS** — leer `process.env.DEVTOOLS === 'true'`, nunca hardcodeado.
10. **Git** — commits en inglés, descriptivos, `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.
11. **GitHub push** — SOLO cuando el usuario lo pida explícitamente en ese mensaje.

---

## Estructura de archivos clave

```
main.js                          ← Entrada principal (carga .env, arranca Express, crea ventana, IPC)
preload.js                       ← contextBridge → window.electronAPI
src/
  backend/
    server.js                    ← Express setup, activa plugins
    core/PluginManager.js        ← Singleton: discover → migrate → register
    database/connection.js       ← Singleton SQLite (WAL + foreign_keys)
    database/migrations.js       ← Tablas core: schema_version, users, settings, plugins
    routes/index.js              ← Core: /auth, /config, /settings, /plugins
    middleware/validate.js       ← validate(ZodSchema, 'body'|'query'|'params')
    admin/router.js              ← Panel admin /admin (SSR, cookie auth, CSRF)
    admin/sessions.js            ← Auth admin: tokens, CSRF, rate limiting
  main/
    ipcHandlers.js               ← Todos los ipcMain.handle/on
    windowManager.js             ← createWindow, mini player window
    updater.js                   ← electron-updater
  renderer/
    app.js                       ← Boot (10 pasos): port → settings → plugins → sidebar → router
    store.js                     ← Estado global reactivo + EventBus
    router.js                    ← Core views + delega vistas de plugins a PluginRegistry
    core/PluginRegistry.js       ← import() dinámico; registra navItems, views, dashboardWidgets
    utils/api.js                 ← API.songs.*, API.contacts.*, API.tasks.*, etc.
    utils/html.js                ← esc(), formGroup(), grid(), statRow(), badge()
    utils/formatters.js          ← greeting(), dateStr(), fmtBytes()
    utils/i18n.js                ← t(key), setLang(), LANGUAGES {en, es, pt}
    utils/Paginator.js           ← Paginador AJAX universal (Paginator class)
    utils/eventBus.js            ← EventBus.on/emit/off
    components/
      Dashboard.js               ← Home: reloj, stats sistema, widgets de plugins
      Sidebar.js                 ← Nav lateral colapsable, i18n reactivo
      Player.js                  ← Barra de reproducción inferior
      Modal.js                   ← openModal(), showToast(), openProfileModal()
      ui.js                      ← viewHeader(), filterBar(), wireFilters(), alertBanner()
    styles/
      main.css                   ← Estilos globales + componentes compartidos
      titlebar-themes.css        ← Temas mac/linux/cartoon del titlebar
      themes/                    ← 12 temas (dark, light, matrix, kick, neon, ocean, pink, red, arcade, military, winamp, rickmorty)
plugins/
  starcho/                       ← Plugin de música principal
  contacts/                      ← Agenda de contactos (paginación server-side)
  notes/                         ← Notas de texto
  tasks/                         ← Lista de tareas (paginación server-side)
```

---

## Contrato de plugin

### `plugins/<id>/plugin.json`
```json
{
  "id": "mi-plugin",
  "name": "Mi Plugin",
  "version": "1.0.0",
  "description": "Qué hace este plugin.",
  "author": "Starcho Dev",
  "icon": "🧩",
  "color": "#8B5CF6"
}
```

### `plugins/<id>/backend/index.js`
```js
'use strict';
const { migrate } = require('./migrations');
const routes      = require('./routes/index');

module.exports = {
  migrate(db) { migrate(db); },
  register(router, db, _appPaths) {
    router.use('/mi-plugin', (req, _res, next) => { req.db = db; next(); }, routes);
  },
};
```

### `plugins/<id>/backend/migrations.js`
```js
'use strict';
const log = require('electron-log');

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mi_tabla (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_mi_tabla_user ON mi_tabla(user_id);
  `);
  log.info('[mi-plugin] migrations complete');
}

module.exports = { migrate };
```

### `plugins/<id>/backend/routes/index.js` (con paginación)
```js
'use strict';
const router       = require('express').Router();
const { validate } = require('../../../../src/backend/middleware/validate');
const { z }        = require('zod');

const QuerySchema = z.object({
  username: z.string().trim().max(64).optional(),
  page:     z.coerce.number().int().positive().optional().default(1),
  per_page: z.coerce.number().int().min(5).max(100).optional().default(25),
});

// GET /api/mi-plugin  → { items, total, page, perPage }
router.get('/', validate(QuerySchema, 'query'), (req, res) => {
  try {
    const { username, page, per_page } = req.query;
    const db    = req.db;
    let where   = 'WHERE deleted_at IS NULL';
    const args  = [];
    if (username) {
      const row = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (row) { where += ' AND user_id = ?'; args.push(row.id); }
    }
    const total  = db.prepare(`SELECT COUNT(*) as n FROM mi_tabla ${where}`).get(...args).n;
    const offset = (page - 1) * per_page;
    const items  = db.prepare(`SELECT * FROM mi_tabla ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, per_page, offset);
    res.json({ items, total, page, perPage: per_page });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/mi-plugin
router.post('/', validate(z.object({ title: z.string().trim().min(1).max(200) })), (req, res) => {
  try {
    const db   = req.db;
    const info = db.prepare('INSERT INTO mi_tabla (title) VALUES (?)').run(req.body.title);
    res.json(db.prepare('SELECT * FROM mi_tabla WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
```

### `plugins/<id>/frontend/index.js`
```js
import API         from '../../../src/renderer/utils/api.js';
import { statRow, grid } from '../../../src/renderer/utils/html.js';

export default {
  id: 'mi-plugin',

  onLoad() {
    if (document.getElementById('mi-plugin-css')) return;
    const link = document.createElement('link');
    link.id   = 'mi-plugin-css';
    link.rel  = 'stylesheet';
    link.href = new URL('./styles/mi-plugin.css', import.meta.url).href;
    document.head.appendChild(link);
  },

  navItems: [
    { view: 'mi-plugin:list', icon: '🧩', labelKey: 'nav_mi_plugin', label: 'Mi Plugin' },
  ],

  views: {
    'mi-plugin:list': async (el) => {
      const { renderList } = await import('./views/List.js');
      renderList(el);
    },
  },

  dashboardWidgets: [
    {
      id: 'mi-plugin-card', zone: 'content', priority: 50,
      title: '🧩 Mi Plugin',
      async render(el) {
        try {
          const { items, total } = await API.miPlugin.list({ per_page: 100 });
          el.innerHTML = grid(2, '8px', statRow('🧩', 'Total', total));
        } catch (_) { el.innerHTML = '<div style="color:var(--text-muted);font-size:12px">Sin datos</div>'; }
      },
    },
  ],
};
```

### `plugins/<id>/frontend/views/List.js` (con Paginator)
```js
import API          from '../../../../src/renderer/utils/api.js';
import { Paginator } from '../../../../src/renderer/utils/Paginator.js';
import { openModal, showToast } from '../../../../src/renderer/components/Modal.js';
import store        from '../../../../src/renderer/store.js';
import { esc, formGroup } from '../../../../src/renderer/utils/html.js';
import { viewHeader }     from '../../../../src/renderer/components/ui.js';

let _paginator = null;

export async function renderList(el) {
  el.innerHTML = `<div class="mp-container">
    ${viewHeader('🧩 Mi Plugin', `<button id="mp-new-btn">+ Nuevo</button>`, 'mp-header')}
    <div id="mp-paginator"></div>
  </div>`;

  el.querySelector('#mp-new-btn').addEventListener('click', () =>
    _openForm(null, () => _paginator?.refresh())
  );

  _paginator = new Paginator({
    container:      el.querySelector('#mp-paginator'),
    fetchFn:        params => API.miPlugin.list({ ...params, username: store.state.loggedUser?.username }),
    renderFn:       _renderItems,
    defaultPerPage: 25,
  });
  await _paginator.mount();
}

function _renderItems(items, container, refresh) {
  if (!items.length) { container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">Sin registros</div>'; return; }
  container.innerHTML = items.map(item => `
    <div class="mp-item" data-id="${item.id}">
      <span>${esc(item.title)}</span>
      <button class="mp-del" data-id="${item.id}">🗑️</button>
    </div>`).join('');
  container.querySelectorAll('.mp-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar?')) return;
      await API.miPlugin.delete(parseInt(btn.dataset.id));
      showToast('Eliminado', 'success');
      refresh();
    });
  });
}

function _openForm(item, onSaved) {
  openModal({
    title: item ? '✏️ Editar' : '🧩 Nuevo',
    content: formGroup({ label: 'Título *', id: 'mp-f-title', dataField: 'title', value: esc(item?.title || '') }),
    actions: [
      { label: 'Cancelar', class: 'btn-secondary', action: close => close() },
      { label: item ? 'Guardar' : 'Crear', class: 'btn-primary', action: async (close, formEl) => {
        const title = formEl.querySelector('#mp-f-title').value.trim();
        try {
          item ? await API.miPlugin.update(item.id, { title }) : await API.miPlugin.create({ title });
          showToast(item ? 'Actualizado' : 'Creado', 'success');
          close(); onSaved();
        } catch (err) { showToast(err.message || 'Error', 'error'); }
      }},
    ],
  });
  setTimeout(() => document.querySelector('.modal-overlay:last-child #mp-f-title')?.focus(), 80);
}
```

---

## Paginator universal

Ubicado en `src/renderer/utils/Paginator.js`. Úsalo en cualquier plugin:

```js
import { Paginator } from '../../../../src/renderer/utils/Paginator.js';

const pager = new Paginator({
  container:      el.querySelector('#mi-paginator'),   // div contenedor
  fetchFn:        params => API.miPlugin.list(params), // debe devolver { items, total }
  renderFn:       (items, listEl, refresh) => { ... }, // llena listEl con HTML
  defaultPerPage: 12,                                  // por defecto; opciones 5/12/25/50/100
  // perPageOptions: [5, 12, 25, 50, 100],             // opcional — sobreescribe opciones
});

pager.setParams({ username, status });  // extra params (encadenables)
await pager.mount();    // primer render
pager.refresh();        // re-fetch (tras CRUD)
```

El backend DEBE devolver `{ items: [...], total: N, page: N, perPage: N }`.

---

## Patrón IPC (agregar canal nuevo)

**1. `preload.js`:**
```js
miAccion:   (arg) => ipcRenderer.send('mi:accion', arg),
onMiEvento: (cb)  => ipcRenderer.on('mi:evento', (_, data) => cb(data)),
```

**2. `src/main/ipcHandlers.js`:**
```js
ipcMain.on('mi:accion', (_event, arg) => {
  const win = getMainWindow();
  if (win) win.webContents.send('mi:evento', resultado);
});
```

**3. Renderer:**
```js
window.electronAPI.miAccion(arg);
window.electronAPI.onMiEvento(data => { ... });
```

---

## Componentes compartidos — importación

| Desde | `html.js` | `ui.js` |
|-------|-----------|---------|
| plugin frontend view (4 niveles) | `import { esc, formGroup, grid, statRow, badge } from '../../../../src/renderer/utils/html.js'` | `import { viewHeader, filterBar, wireFilters, alertBanner } from '../../../../src/renderer/components/ui.js'` |
| plugin frontend index (3 niveles) | `import { statRow, grid, esc } from '../../../src/renderer/utils/html.js'` | `import { alertBanner } from '../../../src/renderer/components/ui.js'` |
| renderer component | `import { esc } from '../utils/html.js'` | `import { viewHeader } from '../components/ui.js'` |

---

## Temas CSS

12 temas disponibles en `data-theme`: `dark light matrix kick neon ocean pink red arcade military winamp rickmorty`
3 temas de titlebar en `data-titlebar`: `mac linux cartoon` (default = vacío)

Variables principales: `--bg-1, --bg-2, --bg-3, --text-primary, --text-secondary, --text-muted, --border, --red, --purple, --green, --gradient-brand`

---

## Admin panel (`/admin`)

- Auth: `root@starcho.com / 123456x` (hardcodeado en `sessions.js`)
- Rutas: `/admin/dashboard`, `/admin/menu`, `/admin/config`, `/admin/users`
- CSRF: auto-inyectado en forms por `_layout.js` via meta tag + JS
- Rate limiting: 5 intentos → 15 min lockout por IP

---

## Flujo de arranque (recordatorio)

```
main.js → startServer → initDatabase → PluginManager.activate
       → createWindow → registerIpcHandlers

renderer/app.js:
  1. initErrorHandler
  2. API.setBase(port)        ← IPC app:get-server-port
  3. store.loadSettings + loadConfig
  4. #tb-title = appName + version
  5. PluginRegistry.init()   ← GET /api/plugins → import() frontend plugins
  6. loadSongs/Playlists (si starcho activo)
  7. wireWindowControls
  8. initModal + initSidebar + initPlayer
  9. applyTitlebarTheme
  10. initRouter + wireUpdaterEvents + wireKeyboard → showView('home')
```

---

## i18n (agregar key para plugin nuevo)

En `src/renderer/utils/i18n.js` agregar en los 3 idiomas:
```js
en: { nav_mi_plugin: 'My Plugin' },
es: { nav_mi_plugin: 'Mi Plugin' },
pt: { nav_mi_plugin: 'Meu Plugin' },
```

---

## Checklist para nuevo plugin

- [ ] `plugins/<id>/plugin.json`
- [ ] `plugins/<id>/backend/index.js` (migrate + register)
- [ ] `plugins/<id>/backend/migrations.js`
- [ ] `plugins/<id>/backend/routes/index.js`
- [ ] `plugins/<id>/frontend/index.js` (onLoad, navItems con labelKey, views, dashboardWidgets)
- [ ] `plugins/<id>/frontend/views/List.js` (usa Paginator)
- [ ] `plugins/<id>/frontend/styles/<id>.css`
- [ ] Agregar `labelKey` a `src/renderer/utils/i18n.js` (en/es/pt)
- [ ] Si necesita endpoints en api.js → agregar grupo en `src/renderer/utils/api.js`

Si la tarea es un plugin completo, generar todos estos archivos en orden.
