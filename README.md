# StarchoElectron

> Starkit para construir apps de escritorio con Electron + Express + SQLite + vanilla JS.

StarchoElectron es una plantilla de arranque ("starkit") lista para producción. Incluye autenticación local, temas visuales, i18n (EN/ES/PT), sistema de plugins con dashboard widget API, sidebar colapsable y responsive, mini-player IPC, manejador de errores global, validación con Zod, perfil de usuario con avatar, y una app de música de ejemplo completa. Clona, crea tu plugin y lanza.

---

## ¿Qué incluye el starkit?

| Capa | Qué trae resuelto |
|------|-------------------|
| **Electron** | Ventana frameless, título bar custom con nombre + versión, controles (min/max/close), single instance lock, arranque maximizado |
| **Seguridad** | `IS_PROD`/`IS_DEV` automático, sandbox, devTools off, Chromium flags, CSP en renderer |
| **Backend local** | Express en `localhost:PORT`, auto-incremento de puerto, CORS, rutas REST |
| **Base de datos** | SQLite (better-sqlite3), WAL mode, migraciones idempotentes, settings de plugins en DB |
| **Frontend** | ES Modules sin bundler, router hash, store reactivo, EventBus, i18n (EN/ES/PT) reactivo |
| **Autenticación** | Login/registro local, "recordar sesión" con auto-login, hash SHA-256, recuerda última ruta |
| **Settings** | Todos los ajustes guardados en SQLite — cero localStorage para settings |
| **Temas UI** | 12 temas CSS (`data-theme`): dark, light, matrix, winamp, rickmorty, kick, pink, red, military, arcade, neon, ocean |
| **Temas login** | 8 pantallas de login intercambiables: nebula, split, glass, kick, arcade, galax, cyber, lux |
| **Plugins** | Sistema tipo WordPress — cada plugin registra rutas Express, vistas, widgets de dashboard, y etiquetas i18n |
| **Dashboard** | Home screen con widgets por zona (header/content), estadísticas CPU/RAM, acciones rápidas |
| **Sidebar** | Colapsable (icon-only), responsive, labels en el idioma activo, persistido en localStorage |
| **Perfil** | Modal de edición de avatar + datos de perfil desde cualquier punto de la app |
| **Error manager** | `window.onerror` + `unhandledrejection` → log en consola y archivo `errors.log` (viewer en Settings, solo dev) |
| **Validación** | Zod v3 en todos los endpoints backend — errores con marcado de campo en el frontend |
| **Mini player** | Ventana always-on-top con 3 tamaños, IPC bidireccional, visualizer de audio y sync de tema |
| **Auto-updater** | electron-updater apuntando a GitHub Releases (solo en producción) |
| **Empaquetado** | electron-builder — Windows NSIS, macOS DMG/ZIP, Linux AppImage/deb |

---

## Inicio rápido

```bash
git clone https://github.com/galax13a/StarchoElectron.git
cd StarchoElectron
npm install
npm run rebuild       # Recompila better-sqlite3 para tu versión de Electron
cp .env.example .env  # Edita branding si quieres
npm run dev           # Abre la app en modo desarrollo
```

**Para empaquetar:**

```bash
npm run build:win     # Windows — instalador NSIS .exe
npm run build:mac     # macOS   — .dmg + .zip
npm run build         # Todas las plataformas
```

---

## Modos de ejecución

| Comportamiento | Desarrollo (`npm run dev`) | Producción (app empaquetada) |
|----------------|---------------------------|------------------------------|
| DevTools | Disponible (F12, o `DEVTOOLS=true` en `.env`) | Completamente bloqueado |
| Error log viewer | Visible en Settings → Dev Log | Oculto |
| Sandbox renderer | Desactivado | Activado |
| `remote-debugging-port` | Abierto | Forzado a `0` |
| Chromium extensions | Habilitadas | Deshabilitadas |

---

## Sistema de Temas

### Temas de interfaz (`data-theme`)

12 temas precargados en `index.html`, aplicados con `document.documentElement.setAttribute('data-theme', id)`.

| ID | Nombre | Descripción |
|----|--------|-------------|
| `dark` | Dark | Oscuro por defecto |
| `light` | Light | Claro |
| `matrix` | Matrix | Verde terminal |
| `winamp` | WinAmp | Retro gris |
| `rickmorty` | Rick & Morty | Ciencia ficción |
| `kick` | Kick | Verde brillante |
| `pink` | Pink | Rosa vibrante |
| `red` | Red | Rojo intenso |
| `military` | Military | Verde oliva |
| `arcade` | Arcade | Retro pixelado |
| `neon` | Neon | Magenta/cyan cyberpunk |
| `ocean` | Ocean | Azul oceánico |

### Temas de pantalla de login (`data-ltheme`)

8 variantes con animaciones. Cambiables desde Settings → Apariencia → Pantalla de login.

| ID | Nombre | Características |
|----|--------|-----------------|
| `nebula` | Nebula | Blobs animados, fondo oscuro |
| `split` | Split | Panel lateral con branding |
| `glass` | Glass | Glassmorphism |
| `kick` | Kick | Minimalista verde |
| `arcade` | Arcade | Pixelado retro |
| `galax` | Galax | Galaxia animada |
| `cyber` | Cyber | Grid neón, glitch, scanlines |
| `lux` | Lux | Dorado premium |

---

## i18n — Sistema de internacionalización

El starkit soporta 3 idiomas de forma nativa: **Inglés (en)**, **Español (es)** y **Portugués (pt)**.

### Cómo funciona

```
src/renderer/utils/i18n.js
  └── T = { en: {...}, es: {...}, pt: {...} }   // diccionario
  └── t(key)           // traduce al idioma activo
  └── setLang(lang)    // cambia idioma → emite 'lang:change'
  └── getLang()        // idioma activo
  └── LANGUAGES[]      // lista de idiomas para el selector de Settings
```

Cuando el usuario cambia idioma en Settings:

1. `setLang('es')` actualiza `_lang` y el store emite `lang:change`.
2. **Sidebar** escucha `lang:change` → llama `_rebuild()` → re-renderiza todos los nav items usando `t(n.labelKey)`.
3. Cualquier otro componente puede escuchar `lang:change` en EventBus y actualizar su propio HTML.

### Agregar claves de traducción

```js
// src/renderer/utils/i18n.js — dentro del bloque en, es y pt:
en: { mi_clave: 'My value' },
es: { mi_clave: 'Mi valor' },
pt: { mi_clave: 'Meu valor' },
```

### Usar en componentes

```js
import { t } from '../utils/i18n.js';

// Render estático (regenera en rebuild)
el.innerHTML = `<h2>${t('mi_clave')}</h2>`;

// Escuchar cambios de idioma
EventBus.on('lang:change', () => el.innerHTML = renderFn());
```

### Nav items y `labelKey`

Los plugins registran sus nav items con **`labelKey`** en lugar de un label hardcodeado:

```js
// plugins/mi-plugin/frontend/index.js
navItems: [
  { view: 'mi-plugin:list', icon: '🔌', labelKey: 'nav_mi_plugin', label: 'Fallback' },
]
```

El Sidebar llama `t(n.labelKey)` al renderizar, así el label cambia de idioma automáticamente sin recargar el plugin. El campo `label` actúa de fallback si la clave no existe en el diccionario.

**Claves de nav registradas:**

| Clave | EN | ES | PT |
|-------|----|----|----|
| `nav_home` | Home | Inicio | Início |
| `nav_library` | Library | Biblioteca | Biblioteca |
| `nav_youtube` | YouTube | YouTube | YouTube |
| `nav_import` | Import | Importar | Importar |
| `nav_history` | History | Historial | Histórico |
| `nav_settings` | Settings | Configuración | Configurações |
| `nav_notes` | Notes | Notas | Notas |
| `nav_tasks` | Tasks | Tareas | Tarefas |
| `nav_contacts` | Contacts | Contactos | Contatos |
| `nav_modules` | Modules | Módulos | Módulos |
| `sidebar_collapse` | Collapse sidebar | Ocultar menú | Ocultar menu |
| `sidebar_expand` | Expand sidebar | Mostrar menú | Mostrar menu |

---

## Sidebar — Colapsable y Responsive

### Sidebar colapsable

El sidebar tiene un botón `‹ ›` en la zona del logo que alterna entre modo expandido y modo icon-only (56 px de ancho). El estado se persiste en `localStorage('sb_collapsed')`.

```
Expandido:   [Logo + texto]  [‹]     Nav items con icono + texto
Colapsado:   [Logo]         [›]     Solo iconos, sin texto ni separadores de sección
```

**Cómo funciona internamente:**

```js
// Sidebar.js
_collapsed = localStorage.getItem('sb_collapsed') === '1';

function _toggleCollapse(el) {
  _collapsed = !_collapsed;
  localStorage.setItem('sb_collapsed', _collapsed ? '1' : '0');
  el.classList.toggle('sidebar--collapsed', _collapsed);
  // Solo actualiza el botón — no necesita rebuild completo
}
```

La clase `.sidebar--collapsed` en `#sidebar` controla todo lo visual via CSS:

```css
/* main.css */
.sidebar--collapsed           { width: 56px !important; }
.sidebar--collapsed .nav-label,
.sidebar--collapsed .logo-text-group { display: none; }
.sidebar--collapsed .nav-item { justify-content: center; }
```

### Responsive layout

| Ancho de ventana | Comportamiento |
|-----------------|----------------|
| > 900 px | Sidebar expandido/colapsado según preferencia del usuario |
| 600 – 900 px | Sidebar se fuerza a modo icon-only (56 px), botón de colapso oculto |
| ≤ 600 px | Sidebar se convierte en overlay deslizable; hamburger `☰` en el title bar |

**Mobile overlay** (≤ 600 px):

```
Title bar: [☰ Hamburger] [Logo] [v1.0.0] [min][max][x]

Sidebar: position:fixed, transform:translateX(-100%)   ← oculto por defecto
         + clase .mobile-open → transform:translateX(0) ← visible al hacer tap en ☰
         + backdrop #sidebar-overlay con opacity fade
```

El sidebar se cierra automáticamente al tocar un nav item o el backdrop.

---

## Barra de título con versión

El campo central de la title bar muestra `AppName vX.Y.Z`. Los valores se leen de `APP_NAME` y `APP_VERSION` en `.env` vía el backend y se exponen en el config endpoint:

```js
// app.js — después de store.loadConfig()
const _cfg = store.state.appConfig;
_tb.textContent = `${_cfg.appName} v${_cfg.appVersion}`;
// → "StarchoElectron v1.0.0"
```

Para cambiar la versión edita `.env`:

```env
APP_NAME=Mi App
APP_VERSION=2.0.0
```

---

## Sistema de Plugins

### Estructura de un plugin

```
plugins/
  mi-plugin/
    backend/
      routes/
        index.js     # Rutas Express (GET/POST/etc.)
      schemas/       # Esquemas Zod de validación
    frontend/
      index.js       # Registro frontend (navItems, views, dashboardWidgets)
      styles/
        *.css
      views/
        *.js
```

### Registro frontend completo

```js
// plugins/mi-plugin/frontend/index.js
import API from '../../../src/renderer/utils/api.js';

export default {
  id: 'mi-plugin',

  // Se llama una vez al cargar — ideal para inyectar CSS
  onLoad() {
    if (document.getElementById('mi-plugin-css')) return;
    const link = document.createElement('link');
    link.id   = 'mi-plugin-css';
    link.rel  = 'stylesheet';
    link.href = new URL('./styles/mi-plugin.css', import.meta.url).href;
    document.head.appendChild(link);
  },

  // labelKey → el Sidebar llama t(labelKey) para traducción automática
  navItems: [
    { view: 'mi-plugin:list', icon: '🔌', labelKey: 'nav_mi_plugin', label: 'Mi Plugin' },
  ],

  // Vistas que el router puede renderizar
  views: {
    'mi-plugin:list': async (el) => {
      const { renderList } = await import('./views/List.js');
      renderList(el);
    },
  },

  // Widgets para el Dashboard (header o content zone)
  dashboardWidgets: [
    {
      id:       'mi-plugin-card',
      zone:     'content',   // 'header' | 'content'
      priority: 50,          // mayor = se muestra primero en la zona
      title:    '🔌 Mi Plugin',
      async render(el) {
        el.innerHTML = `<div>Hola desde mi plugin</div>`;
      },
    },
  ],
};
```

### Ciclo de vida de un plugin

```
boot()
  └── PluginRegistry.init()
        └── API.plugins.list()           → lista plugins habilitados en DB
        └── import(plugin/frontend/index.js)
              └── plugin.onLoad()        → inyecta CSS
              └── _navItems.push(...)    → aparece en Sidebar
              └── _views[key] = fn       → el router puede navegar a esa vista
              └── _dashboardWidgets.push → el Dashboard renderiza el widget
        └── EventBus.emit('plugins:ready')
              └── Sidebar._rebuild()     → usa t(labelKey) para traducir labels
              └── Dashboard.render()     → llama PluginRegistry.renderDashboardZone()
```

### Settings de plugin desde la base de datos

Cada plugin tiene su espacio de configuración en la tabla `settings` con el prefijo `plugin_{id}_`:

```js
// Leer configuración de un plugin
const cfg = await API.plugins.getSettings('mi-plugin');
// cfg = { sort_by: 'date', items_per_page: '20' }

// Guardar una clave
await API.plugins.setSetting('mi-plugin', 'sort_by', 'title');

// Guardar múltiples claves a la vez
await API.plugins.setSettings('mi-plugin', { sort_by: 'title', items_per_page: '50' });
```

**Backend:**

```
GET  /api/plugins/:id/settings  → lee plugin_{id}_* de la tabla settings, retorna sin prefijo
POST /api/plugins/:id/settings  → acepta { key, value } o { settings: { key: value, ... } }
```

---

## Dashboard y Widgets

El Dashboard (`home`) tiene zonas donde los plugins contribuyen contenido:

| Zona | Descripción | Quién la usa |
|------|-------------|--------------|
| `header` | Franja ancha superior | starcho-now-playing (transport controls) |
| `content` | Grid de tarjetas | starcho (biblioteca), notes, tasks, contacts |

Además muestra:
- **CPU y RAM** en tiempo real — muestreadas cada 3 s via IPC `system:stats`
- **Acciones rápidas** — un botón por cada nav item registrado por todos los plugins activos
- **Botón de perfil** — abre el modal de edición directamente

### Renderizado de una zona

```js
// Dashboard.js
await PluginRegistry.renderDashboardZone('content', container);

// PluginRegistry — filtra por zona, ordena por priority DESC, renderiza en paralelo
for (const w of widgets) {
  const wrapper = createElement('.dash-widget');
  wrapper.innerHTML = '<loading>';
  container.appendChild(wrapper);
  await w.render(wrapper.querySelector('.dash-widget-body'));
}
```

### Agregar un widget desde un plugin

```js
dashboardWidgets: [
  {
    id:       'mi-widget',
    zone:     'content',
    priority: 50,          // 100 = primero, 0 = último
    title:    '🔌 Mi widget',
    async render(el) {
      const data = await API.miPlugin.getData();
      el.innerHTML = `<div>${data.count} items</div>`;
    },
  },
],
```

---

## Librería de componentes compartidos

El starkit incluye dos módulos de utilidades que **eliminan la duplicación de código** entre plugins y componentes del renderer. Cualquier plugin puede importarlos usando rutas relativas desde su carpeta.

### `src/renderer/utils/html.js` — Constructores de HTML

Funciones puras que devuelven strings HTML. Cero manipulación del DOM.

| Función | Descripción |
|---------|-------------|
| `esc(v)` | Escapa un valor para inserción segura como texto HTML (`&`, `<`, `>`, `"`) |
| `attr(v)` | Escapa un valor para uso seguro dentro de un atributo HTML |
| `statRow(icon, label, value)` | Tarjeta de stat para widgets del dashboard (bg-3, icono + valor grande + label) |
| `badge(label, color)` | Badge inline coloreado (ej: estado de contacto) |
| `grid(cols, gap, ...children)` | Contenedor CSS grid — agrupa children en columnas iguales |
| `formGroup({ label, id, type, placeholder, value, ... })` | Bloque `.form-group > label + .form-control` completo |

**Uso desde un plugin:**

```js
import { esc, formGroup, grid, statRow, badge } from '../../../src/renderer/utils/html.js';

// En un widget del dashboard
el.innerHTML = grid(2, '8px',
  statRow('📝', 'Total', notes.length),
  statRow('📅', 'Con fecha', withDate),
);

// En un modal de formulario
content: `
  ${formGroup({ label: 'Nombre *', id: 'cf-name', dataField: 'name', value: esc(c.name) })}
  ${grid(2, '12px',
    formGroup({ label: 'Email', id: 'cf-email', type: 'email', value: esc(c.email) }),
    formGroup({ label: 'Estado', id: 'cf-status', type: 'select', options: statusOpts }),
  )}
  ${formGroup({ label: 'Notas', id: 'cf-notes', type: 'textarea', rows: 3, value: esc(c.notes) })}`,
```

**Tipos soportados por `formGroup`:** `text` | `email` | `tel` | `date` | `textarea` | `select` | `hidden`

El parámetro `dataField` controla el atributo `data-field` (usado por `markFieldErrors()`). Si se omite, toma el valor de `id`.

---

### `src/renderer/components/ui.js` — Bloques de UI

Componentes de nivel alto que devuelven HTML strings o vinculan eventos DOM.

| Función | Descripción |
|---------|-------------|
| `emptyState({ icon, title, desc, cls })` | Estado vacío completo: icono grande + h3 + párrafo |
| `loading(height)` | Spinner centrado (usa `.spinner` de main.css) |
| `viewHeader(title, right, cls)` | Cabecera de vista: título izquierda + botones/buscador derecha |
| `filterBar(items, activeVal, opts)` | Strip de botones de filtro con estado `.active` |
| `wireFilters(el, btnSel, dataAttr, onChange)` | Vincula los clicks del filterBar, llama `onChange(value)` |
| `recentList(items, renderItem)` | Lista de ítems recientes separada por borde superior |
| `alertBanner(text, { bg, border, color })` | Banner de alerta/advertencia coloreado |

**Uso desde un plugin:**

```js
import { viewHeader, filterBar, wireFilters, emptyState, alertBanner }
  from '../../../src/renderer/components/ui.js';

// Cabecera de vista
el.innerHTML = `<div class="ct-container">
  ${viewHeader('👥 Contactos',
    `<input id="ct-search" class="form-control" placeholder="🔍 Buscar…">
     <button id="ct-new-btn">+ Nuevo</button>`,
    'ct-header'
  )}
  ${filterBar(FILTERS, _activeStatus, { dataAttr: 'status', btnClass: 'ct-filter', wrapClass: 'ct-filters' })}
  <div class="ct-grid" id="ct-grid"></div>
</div>`;

// Vincular los filtros
wireFilters(el, '.ct-filter', 'status', val => {
  _activeStatus = val;
  _refresh();
});

// Estado vacío
container.innerHTML = emptyState({ icon: '👥', title: 'Sin contactos', desc: 'Agrega el primero.' });

// Banner de tareas vencidas
el.innerHTML += overdue > 0 ? alertBanner(`⚠ Tienes ${overdue} tareas vencidas`) : '';
```

---

### `src/renderer/utils/formatters.js` — Formatters compartidos

| Función | Descripción |
|---------|-------------|
| `formatDuration(seconds)` | `m:ss` — para Player y Library |
| `formatCount(n)` | `1.2K`, `3.4M` — para conteos grandes |
| `timeAgo(dateStr)` | `"2h ago"`, `"3d ago"` — tiempo relativo |
| `truncate(str, len)` | Corta y agrega `…` si supera el largo |
| `sanitizeHTML(str)` | Sanitiza via `textContent` |
| `greeting()` | `"Buenos días"` / `"Buenas tardes"` / `"Buenas noches"` |
| `dateStr()` | Fecha larga en español (`"viernes, 22 de mayo de 2026"`) |
| `fmtBytes(bytes)` | `"1.2 MB"`, `"3.4 GB"` — para tamaños de archivo |

---

## Perfil de usuario

El perfil se edita mediante un **popup modal** accesible desde:
- El avatar/nombre en la barra lateral (clic en el área del usuario)
- El botón 👤 en el Dashboard

Permite editar: avatar (crop 128×128), nombre completo, apodo, WhatsApp.
Los datos se guardan en la tabla `users` y se reflejan inmediatamente en el store y el sidebar.

```js
import { openProfileModal } from './components/Modal.js';
openProfileModal(); // abre desde cualquier lugar del renderer
```

---

## Manejador de Errores

```js
// src/renderer/utils/errorHandler.js
import { logError, logWarn, initErrorHandler } from './utils/errorHandler.js';

// Inicializado automáticamente en boot (app.js)
initErrorHandler(); // hookea window.onerror + unhandledrejection

// Uso manual en cualquier catch
try {
  await algoPeligroso();
} catch (err) {
  logError(err); // → consola + errors.log en userData
}
```

El log se guarda en `{userData}/errors.log` y se puede ver/limpiar desde **Settings → Dev Log** (solo en modo desarrollo).

---

## API REST

El backend Express expone los siguientes endpoints bajo `/api/`:

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/songs` | Lista canciones con filtros |
| GET | `/songs/stats` | Total audio/video, bytes en disco |
| GET | `/playlists` | Lista playlists |
| GET | `/plugins` | Lista plugins con estado enabled |
| PUT | `/plugins/:id` | Activar/desactivar plugin |
| GET | `/plugins/:id/settings` | Leer configuración de plugin desde DB |
| POST | `/plugins/:id/settings` | Guardar configuración de plugin en DB |
| GET | `/settings` | Leer todos los ajustes |
| POST | `/settings` | Guardar ajustes en bulk |
| POST | `/download-queue` | Agregar URL a la cola de descarga |
| GET | `/auth/profile` | Obtener perfil de usuario |
| PUT | `/auth/profile` | Actualizar perfil de usuario |

---

## Variables de entorno (`.env`)

```env
APP_NAME=Mi App           # Aparece en sidebar y title bar
APP_SLOGAN=Descripción    # Sub-texto del logo en sidebar
APP_VERSION=1.0.0         # Aparece en title bar como "Mi App v1.0.0"
LOGO_TEXT=Mi App

DEVTOOLS=false     # true → abre DevTools al arrancar (solo dev)
NODE_ENV=development
```

---

## Almacenamiento en producción

| Sistema | Ubicación |
|---------|-----------|
| Base de datos SQLite | `%APPDATA%/{appName}/{appName}.db` (Windows) |
| Error log | `%APPDATA%/{appName}/errors.log` |
| Media descargada | `%APPDATA%/{appName}/music/` |
| Thumbnails | `%APPDATA%/{appName}/thumbnails/` |

---

## Arquitectura del renderer

```
src/renderer/
  app.js              ← Boot, wiring, versión en title bar, hamburger mobile
  router.js           ← Hash router, mapa view-key → elemento DOM
  store.js            ← Estado global reactivo (setState → EventBus.emit)
  core/
    PluginRegistry.js ← Carga plugins, colecciona navItems/views/widgets
  components/
    Sidebar.js        ← Nav colapsable, i18n via t(labelKey), EventBus listener
    Dashboard.js      ← Zonas header/content, system stats, quick actions
    Player.js         ← Barra de reproducción, IPC con mini-player
    Modal.js          ← Modales genéricos + openProfileModal()
    Settings.js       ← Tabs de configuración, dev log, plugin settings
    ui.js             ← Bloques de UI reutilizables: emptyState, viewHeader, filterBar, wireFilters, recentList, alertBanner, loading
  utils/
    api.js            ← Cliente HTTP hacia Express backend
    i18n.js           ← Diccionario EN/ES/PT, t(key), setLang(), THEMES, LANGUAGES
    eventBus.js       ← Pub/sub liviano (on, off, emit)
    errorHandler.js   ← initErrorHandler, logError, logWarn
    html.js           ← Constructores HTML puros: esc, attr, statRow, badge, grid, formGroup
    formatters.js     ← greeting, dateStr, fmtBytes, timeAgo, formatDuration, truncate
```

---

## Requisitos

- Node.js 18+
- npm 9+
- Python 3 + Build Tools (para `better-sqlite3`)
- yt-dlp en PATH (para descarga de YouTube)
- ffmpeg en PATH (para conversión de audio/video)

---

## Panel de Administración Web (`/admin`)

El starkit incluye un panel de administración server-side renderizado accesible en `http://127.0.0.1:{PORT}/admin`.

### Acceso

| Campo | Valor |
|-------|-------|
| Email | `root@starcho.com` |
| Contraseña | `123456x` |

Las credenciales se definen en `src/backend/admin/sessions.js`. Son independientes de la tabla de usuarios de la app.

### Secciones

| Ruta | Descripción |
|------|-------------|
| `/admin/dashboard` | Vista general: conteo de plugins/usuarios/ajustes, env vars, accesos rápidos |
| `/admin/menu` | Activar / desactivar plugins con toggle (requiere reinicio) |
| `/admin/config` | Ajustes rápidos con `<select>`, editor de `.env`, CRUD completo de todos los ajustes en DB |
| `/admin/users` | Lista paginada (10/página), búsqueda, editar usuario, eliminar, crear, resetear contraseña |

### Seguridad del panel

- **Rate limiting** — 5 intentos fallidos por IP → bloqueo de 15 minutos.
- **CSRF protection** — token de 16 bytes embebido en cada sesión; se inyecta automáticamente en todos los formularios POST vía JS; validación en el servidor con `crypto.timingSafeEqual`.
- **Sesiones HttpOnly** — cookie `starcho_admin` con `HttpOnly; SameSite=Lax; Max-Age=86400`.
- **Feedback de intentos** — el formulario de login indica cuántos intentos quedan antes del bloqueo.

### Configuración de ajustes rápidos

Desde `/admin/config` se pueden cambiar con `<select>`:

| Clave | Opciones |
|-------|---------|
| `theme` | 12 temas de UI con preview de colores en tiempo real |
| `language` | es / en / pt |
| `volume` | Slider 0–100 con indicador de % |
| `repeat` | none / all / one / library |
| `shuffle` | true / false |
| `titlebar_theme` | default / mac / linux / cartoon |

---

## Temas de Barra de Título (`titlebar_theme`)

El starkit incluye 4 estilos para los controles de ventana (min/max/close). Se configuran con el atributo `data-titlebar` en `#title-bar`.

| Tema | Descripción |
|------|-------------|
| `default` | Windows-style: controles a la derecha, circles rojos/amarillos/verdes |
| `mac` | Controles a la **izquierda** en orden Close→Min→Max, efecto frosted glass con `backdrop-filter` |
| `linux` | Botones **cuadrados** planos (GNOME/KDE palette), iconos siempre visibles, hover colorido |
| `cartoon` | Botones grandes con animación de bounce, rebote y glow en hover; título con animación `hue-rotate` arco iris |

El tema se lee de la clave `titlebar_theme` en la tabla `settings` durante el arranque:

```js
// app.js — applyTitlebarTheme()
const bar = document.getElementById('title-bar');
bar.dataset.titlebar = settings.titlebar_theme ?? 'default';
```

Para cambiar el tema: `/admin/config` → Ajustes rápidos → "Tema de la barra de título" → Guardar → Reiniciar app.

---

## Auto-actualización

El sistema de actualizaciones usa **electron-updater** apuntando a GitHub Releases. Solo activo en builds de producción.

### Canales IPC del updater

| Canal (main → renderer) | Payload | Cuándo |
|--------------------------|---------|--------|
| `updater:checking` | — | Inicia verificación |
| `updater:update-available` | `{ version, releaseDate, releaseNotes }` | Nueva versión encontrada |
| `updater:update-not-available` | `{ version }` | App ya está actualizada |
| `updater:download-progress` | `{ percent, transferred, total, bytesPerSecond }` | Cada ~500 ms durante descarga |
| `updater:update-downloaded` | `{ version, releaseDate }` | Instalador listo |
| `updater:error` | `string` (mensaje) | Error en cualquier fase |

| Canal (renderer → main) | Descripción |
|--------------------------|-------------|
| `updater:install` | Llama `quitAndInstall()` (instala y reinicia) |
| `updater:check` | Verifica actualizaciones manualmente |

### Banner de actualización

Cuando hay una actualización disponible, aparece un banner animado en la parte inferior de la app con:

- **Descargando** → barra de progreso con porcentaje y bytes transferidos, icono giratorio.
- **Lista para instalar** → botones "Instalar y reiniciar" / "Más tarde" + notificación del SO.

El banner se implementa en `src/renderer/styles/titlebar-themes.css` (clases `.update-banner`, `.upd-inner`, etc.) y se controla desde `wireUpdaterEvents()` en `app.js`.

### Publicar una actualización

1. Incrementa `version` en `package.json` (ej: `1.0.2`).
2. Crea un GitHub Release con el tag `v1.0.2`.
3. Sube los binarios generados por `electron-builder` al release.
4. Las apps en producción detectarán la nueva versión al arrancar o cada 4 h.

---

## Changelog

### v1.0.1-beta.1

- **Auto-updater mejorado** — eventos `download-progress`, `checking-for-update`, `update-not-available` y `updater:error`; banner de UI con barra de progreso y botones de instalación.
- **Temas de titlebar** — estilos `mac`, `linux` y `cartoon` via CSS `[data-titlebar]`; cambiables desde el panel admin.
- **Panel de administración** — `/admin` con login protegido, dashboard, gestión de plugins, configuración completa y gestión de usuarios con paginación/búsqueda/CRUD.
- **Seguridad admin** — rate limiting de login (5 intentos → 15 min lockout), tokens CSRF por sesión, validación timing-safe.
- **`titlebar_theme`** en la tabla `settings` — persiste el estilo de la barra de título entre reinicios.

### v1.0.0

- Lanzamiento inicial del starkit con plugins, temas, i18n, mini-player y auto-updater básico.

---

## Licencia

MIT — úsalo, modifícalo y compártelo libremente.
