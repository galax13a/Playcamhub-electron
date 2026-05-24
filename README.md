# StarchoElectron

> Starkit para construir apps de escritorio con Electron + Express + SQLite + vanilla JS.

StarchoElectron es una plantilla de arranque ("starkit") lista para producción. Incluye autenticación local con sesiones persistentes de 7 días, temas visuales, i18n (EN/ES/PT), sistema de plugins con dashboard widget API, sidebar colapsable y responsive, mini-player IPC, manejador de errores global, validación con Zod, perfil de usuario con avatar, panel de administración web y una app de música de ejemplo completa. Clona, crea tu plugin y lanza.

---

## ¿Qué incluye el starkit?

| Capa | Qué trae resuelto |
|------|-------------------|
| **Electron** | Ventana frameless, título bar custom con nombre + versión, controles (min/max/close), single instance lock, arranque maximizado |
| **Seguridad** | `IS_PROD`/`IS_DEV` automático, sandbox, devTools off, Chromium flags, CSP en renderer |
| **Backend local** | Express en `localhost:PORT`, auto-incremento de puerto, CORS, rutas REST, 404/500 handlers con logging |
| **Base de datos** | SQLite (better-sqlite3), WAL mode, migraciones idempotentes, settings de plugins en DB |
| **Frontend** | ES Modules sin bundler, router hash, store reactivo, EventBus, i18n (EN/ES/PT) reactivo |
| **Autenticación** | Login/registro local, sesiones por token (7 días, SQLite), sin contraseñas en localStorage, validación al arrancar |
| **Settings** | Todos los ajustes guardados en SQLite — cero localStorage para settings |
| **Temas UI** | 12 temas CSS (`data-theme`): dark, light, matrix, winamp, rickmorty, kick, pink, red, military, arcade, neon, ocean |
| **Temas login** | 8 pantallas de login intercambiables: nebula, split, glass, kick, arcade, galax, cyber, lux |
| **Plugins** | Sistema tipo WordPress — cada plugin registra rutas Express, vistas, widgets de dashboard, y etiquetas i18n |
| **Dashboard** | Home screen con widgets por zona (header/content), estadísticas CPU/RAM, acciones rápidas |
| **Sidebar** | Colapsable (icon-only), responsive, labels en el idioma activo, persistido en localStorage |
| **Perfil** | Modal de edición de avatar + datos de perfil desde cualquier punto de la app |
| **Error manager** | `window.onerror` + `unhandledrejection` → log en consola y archivo via electron-log |
| **Dev Log** | Viewer del log de errores en el panel admin (`/admin/logs`) — visible siempre para el administrador |
| **Validación** | Zod en todos los endpoints backend — errores con marcado de campo en el frontend |
| **Mini player** | Ventana always-on-top con 3 tamaños, IPC bidireccional, visualizer de audio y sync de tema |
| **Auto-updater** | electron-updater apuntando a GitHub Releases (solo en producción) |
| **Panel admin** | `/admin` SSR con login propio, dashboard, plugins, config, usuarios, dev log — CSRF + rate limiting |
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
| Dev Log | Visible en `/admin/logs` | Visible en `/admin/logs` |
| Sandbox renderer | Desactivado | Activado |
| `remote-debugging-port` | Abierto | Forzado a `0` |
| Chromium extensions | Habilitadas | Deshabilitadas |

---

## Autenticación y Sesiones

### Flujo de login

El sistema usa **tokens de sesión SQLite** — nunca se guarda la contraseña en localStorage.

```
1. Usuario introduce credenciales → POST /api/auth/login
2. Backend verifica hash SHA-256, genera token aleatorio de 32 bytes
3. Token se guarda en tabla app_sessions (SQLite) con expires_at = now + 7 días
4. Frontend guarda { token, username, expiresAt } en localStorage como auth_session
5. En el próximo arranque → GET /api/auth/validate?token=xxx
6. Si token válido → auto-login silencioso
7. Si token expirado/inválido → se borra y aparece formulario de login
```

### "Recordar sesión"

- **Activado** → el token se persiste en localStorage por 7 días, el usuario entra automáticamente en los próximos arranques.
- **Desactivado** → el token no se guarda; al cerrar y reabrir la app se pide login de nuevo.

### Tabla `app_sessions`

```sql
CREATE TABLE IF NOT EXISTS app_sessions (
  token      TEXT PRIMARY KEY,       -- 64 hex chars (32 bytes aleatorios)
  username   TEXT NOT NULL,
  expires_at INTEGER NOT NULL,       -- Unix timestamp en ms
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Los tokens expirados se limpian automáticamente en cada nuevo login (limpieza oportunista).

### Endpoints de auth

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Valida credenciales, devuelve `{ ok, username, token, expiresAt }` |
| `GET`  | `/api/auth/validate` | Valida token de sesión, devuelve `{ ok, username }` o 401 |
| `POST` | `/api/auth/register` | Crea nuevo usuario |
| `GET`  | `/api/auth/profile` | Lee perfil de usuario |
| `PUT`  | `/api/auth/profile` | Actualiza perfil |

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

---

## Sidebar — Colapsable y Responsive

### Sidebar colapsable

El sidebar tiene un botón `‹ ›` en la zona del logo que alterna entre modo expandido y modo icon-only (56 px de ancho). El estado se persiste en `localStorage('sb_collapsed')`.

```
Expandido:   [Logo + texto]  [‹]     Nav items con icono + texto
Colapsado:   [Logo]         [›]     Solo iconos, sin texto ni separadores de sección
```

### Responsive layout

| Ancho de ventana | Comportamiento |
|-----------------|----------------|
| > 900 px | Sidebar expandido/colapsado según preferencia del usuario |
| 600 – 900 px | Sidebar se fuerza a modo icon-only (56 px), botón de colapso oculto |
| ≤ 600 px | Sidebar se convierte en overlay deslizable; hamburger `☰` en el title bar |

---

## Barra de título con versión

El campo central de la title bar muestra `AppName vX.Y.Z`. Los valores se leen de `APP_NAME` y `APP_VERSION` en `.env`:

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
      migrations.js  # CREATE TABLE IF NOT EXISTS idempotente
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
    link.href = '../../plugins/mi-plugin/frontend/styles/mi-plugin.css';
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
        // IMPORTANTE: API paginada devuelve { items, total } — no un array directo
        const result = await API.miPlugin.list();
        const items  = result.items ?? result;
        el.innerHTML = `<div>${items.length} registros</div>`;
      },
    },
  ],
};
```

### Widgets del dashboard — API paginada

Cuando el endpoint devuelve `{ items: [...], total: N, page: N, perPage: N }`, el widget **debe** extraer el array:

```js
// Correcto
const result = await API.contacts.list();
const contacts = result.items ?? result;

// Incorrecto — .filter() sobre el objeto lanzaría TypeError
const contacts = await API.contacts.list();
contacts.filter(c => c.active);  // ❌
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
```

### Settings de plugin desde la base de datos

```js
// Leer configuración de un plugin
const cfg = await API.plugins.getSettings('mi-plugin');

// Guardar múltiples claves a la vez
await API.plugins.setSettings('mi-plugin', { sort_by: 'title', items_per_page: '50' });
```

---

## Dashboard y Widgets

El Dashboard (`home`) tiene zonas donde los plugins contribuyen contenido:

| Zona | Descripción | Quién la usa |
|------|-------------|--------------|
| `header` | Franja ancha superior | starcho-now-playing |
| `content` | Grid de tarjetas | starcho, notes, tasks, contacts |

Además muestra:
- **CPU y RAM** en tiempo real — muestreadas cada 3 s via IPC `system:stats`
- **Disco usado** — solo cuando el plugin `starcho` está activo (evita 404 cuando está desactivado)
- **Acciones rápidas** — un botón por cada nav item registrado por todos los plugins activos
- **Botón de perfil** — abre el modal de edición directamente

---

## Librería de componentes compartidos

### `src/renderer/utils/html.js` — Constructores de HTML

| Función | Descripción |
|---------|-------------|
| `esc(v)` | Escapa un valor para inserción segura como texto HTML |
| `attr(v)` | Escapa un valor para uso seguro dentro de un atributo HTML |
| `statRow(icon, label, value)` | Tarjeta de stat para widgets del dashboard |
| `badge(label, color)` | Badge inline coloreado |
| `grid(cols, gap, ...children)` | Contenedor CSS grid |
| `formGroup({ label, id, type, ... })` | Bloque `.form-group > label + .form-control` completo |

### `src/renderer/components/ui.js` — Bloques de UI

| Función | Descripción |
|---------|-------------|
| `emptyState({ icon, title, desc })` | Estado vacío completo |
| `loading(height)` | Spinner centrado |
| `viewHeader(title, right, cls)` | Cabecera de vista con botones |
| `filterBar(items, activeVal, opts)` | Strip de botones de filtro |
| `wireFilters(el, btnSel, dataAttr, onChange)` | Vincula clicks del filterBar |
| `recentList(items, renderItem)` | Lista de ítems recientes |
| `alertBanner(text, opts)` | Banner de alerta coloreado |

### `src/renderer/utils/formatters.js`

| Función | Descripción |
|---------|-------------|
| `greeting()` | `"Buenos días"` / `"Buenas tardes"` / `"Buenas noches"` |
| `dateStr()` | Fecha larga en español |
| `fmtBytes(bytes)` | `"1.2 MB"`, `"3.4 GB"` |
| `formatDuration(s)` | `m:ss` |
| `timeAgo(dateStr)` | `"2h ago"`, `"3d ago"` |

---

## Paginación

Todos los endpoints de plugins devuelven `{ items, total, page, perPage }`. El frontend usa `Paginator.js`:

```js
import { Paginator } from '../../../../src/renderer/utils/Paginator.js';

const pager = new Paginator({
  container: el.querySelector('#list'),
  fetchFn:   (params) => API.tasks.list(params),  // params incluye { page, per_page }
  renderFn:  (items)  => items.map(renderRow).join(''),
  perPage:   12,
});
pager.load({ username: store.state.loggedUser?.username });
```

El `fetchFn` recibe `{ page, per_page, ...extraParams }` y debe devolver `{ items, total }`.

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
| `/admin/dashboard` | Vista general: conteo de plugins/usuarios/ajustes, env vars |
| `/admin/menu` | Activar / desactivar plugins con toggle (requiere reinicio) |
| `/admin/config` | Ajustes rápidos, editor de `.env`, CRUD completo de settings en DB |
| `/admin/users` | Lista paginada, búsqueda, editar, eliminar, crear, resetear contraseña |
| `/admin/logs` | Viewer del log de electron-log — líneas más recientes primero, botón limpiar |

### Seguridad del panel

- **Sesiones de 7 días** — cookie `starcho_admin` con `HttpOnly; SameSite=Lax; Max-Age=604800`.
- **Rate limiting** — 5 intentos fallidos por IP → bloqueo de 15 minutos.
- **CSRF protection** — token de 16 bytes por sesión; inyectado automáticamente en todos los forms POST; validación con `crypto.timingSafeEqual`.
- **Bug corregido** — todas las vistas ahora propagan `csrfToken` al layout para que la inyección automática funcione.

### Dev Log (`/admin/logs`)

Muestra el contenido del archivo de log de `electron-log` en tiempo real:

- Líneas coloreadas: rojo para `ERROR`, amarillo para `WARN`, gris para info
- Orden inverso (más reciente primero)
- Botón "Limpiar log" (POST con CSRF)
- No requiere reiniciar la app — accede directamente al archivo de log

---

## Temas de Barra de Título (`titlebar_theme`)

| Tema | Descripción |
|------|-------------|
| `default` | Windows-style: controles a la derecha |
| `mac` | Controles a la izquierda, frosted glass |
| `linux` | Botones cuadrados planos (GNOME/KDE) |
| `cartoon` | Botones grandes con bounce y neon glow |
| `stripe` | Gradiente azul-púrpura, ultra limpio |

---

## Auto-actualización

El sistema de actualizaciones usa **electron-updater** apuntando a GitHub Releases. Solo activo en builds de producción.

### Publicar una actualización

1. Incrementa `version` en `package.json`.
2. Crea un GitHub Release con el tag `vX.Y.Z`.
3. Sube los binarios generados por `electron-builder` al release.
4. Las apps en producción detectarán la nueva versión al arrancar o cada 4 h.

---

## API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login — devuelve `{ ok, username, token, expiresAt }` |
| `GET`  | `/api/auth/validate` | Valida token de sesión — devuelve `{ ok, username }` o 401 |
| `POST` | `/api/auth/register` | Registro de usuario |
| `GET`  | `/api/auth/profile` | Perfil de usuario |
| `PUT`  | `/api/auth/profile` | Actualizar perfil |
| `GET`  | `/api/settings` | Todos los ajustes |
| `POST` | `/api/settings` | Guardar ajustes en bulk |
| `GET`  | `/api/plugins` | Lista plugins con estado enabled |
| `PUT`  | `/api/plugins/:id` | Activar/desactivar plugin |
| `GET`  | `/api/plugins/:id/settings` | Configuración de plugin |
| `POST` | `/api/plugins/:id/settings` | Guardar configuración de plugin |
| `GET`  | `/api/tasks` | Tareas paginadas `{ items, total, page, perPage }` |
| `POST` | `/api/tasks` | Crear tarea |
| `PUT`  | `/api/tasks/:id` | Actualizar tarea |
| `PATCH`| `/api/tasks/:id/status` | Cambiar estado de tarea |
| `DELETE`| `/api/tasks/:id` | Soft-delete de tarea |
| `GET`  | `/api/contacts` | Contactos paginados |
| `GET`  | `/api/notes` | Notas paginadas |

---

## Variables de entorno (`.env`)

```env
APP_NAME=Mi App           # Aparece en sidebar y title bar
APP_SLOGAN=Descripción    # Sub-texto del logo en sidebar
APP_VERSION=1.0.0         # Aparece en title bar como "Mi App v1.0.0"
LOGO_TEXT=Mi App

DEVTOOLS=false     # true → abre DevTools al arrancar (solo dev)
NODE_ENV=development

APP_USER=admin          # Usuario por defecto si la tabla users está vacía
APP_PASSWORD=admin123   # Contraseña por defecto
```

---

## Almacenamiento en producción

| Sistema | Ubicación |
|---------|-----------|
| Base de datos SQLite | `%APPDATA%/{appName}/{appName}.db` (Windows) |
| Log de errores | `%APPDATA%/{appName}/logs/main.log` (electron-log) |
| Media descargada | `%APPDATA%/{appName}/music/` |
| Thumbnails | `%APPDATA%/{appName}/thumbnails/` |

---

## Arquitectura del renderer

```
src/renderer/
  app.js              ← Boot, wiring, versión en title bar, hamburger mobile
  router.js           ← Hash router — navega solo si hay usuario logueado (EventBus guard)
  store.js            ← Estado global reactivo (setState → EventBus.emit)
  login.js            ← Login/registro, auto-login por token, migración de auth_remember
  core/
    PluginRegistry.js ← Carga plugins, colecciona navItems/views/widgets
  components/
    Sidebar.js        ← Nav colapsable, i18n via t(labelKey), EventBus listener
    Dashboard.js      ← Zonas header/content, system stats, quick actions
    Player.js         ← Barra de reproducción, IPC con mini-player
    Modal.js          ← Modales genéricos + openProfileModal()
    Settings.js       ← Tabs de configuración, plugin settings
    ui.js             ← Bloques de UI reutilizables
  utils/
    api.js            ← Cliente HTTP hacia Express backend
    i18n.js           ← Diccionario EN/ES/PT, t(key), setLang(), THEMES, LANGUAGES
    eventBus.js       ← Pub/sub liviano (on, off, emit)
    errorHandler.js   ← initErrorHandler, logError, logWarn
    html.js           ← Constructores HTML puros: esc, attr, statRow, badge, grid, formGroup
    formatters.js     ← greeting, dateStr, fmtBytes, timeAgo, formatDuration, truncate
    Paginator.js      ← Paginación AJAX universal — fetchFn recibe { page, per_page }
    dialog.js         ← Promise-based confirm/alert compatible con Notiflix
```

---

## Arquitectura del backend

```
src/backend/
  server.js           ← Express app, rutas, 404/500 handlers, plugin activation
  database/
    connection.js     ← initDatabase(path), getDb() — singleton better-sqlite3
    migrations.js     ← runMigrations(db) — CREATE TABLE IF NOT EXISTS, ALTER TABLE safe
  routes/
    index.js          ← Auth (login/validate/register/profile), config, settings, plugins
                         Session store SQLite-backed — tokens 7 días, limpieza oportunista
  admin/
    router.js         ← Panel SSR: dashboard, menu, config, users, logs
    sessions.js       ← Sesiones admin 7 días, CSRF, rate limiting
    views/
      _layout.js      ← Shell HTML con nav, estilos y auto-inyección CSRF
      dashboard.js    ← Stats overview
      menu.js         ← Plugin toggles
      config.js       ← Quick settings + .env editor + CRUD settings
      users.js        ← CRUD usuarios paginado
      logs.js         ← Viewer del log de electron-log
```

---

## Requisitos

- Node.js 18+
- npm 9+
- Python 3 + Build Tools (para `better-sqlite3`)
- yt-dlp en PATH (para descarga de YouTube, solo plugin starcho)
- ffmpeg en PATH (para conversión, solo plugin starcho)

---

## Changelog

### v1.0.3

**Seguridad y sesiones**
- Autenticación por token — el login ya no guarda la contraseña en `localStorage`. Se genera un token aleatorio de 32 bytes, se almacena en SQLite (`app_sessions`) con TTL de 7 días y se valida al arrancar via `GET /api/auth/validate`.
- Migración automática: `auth_remember` (viejo formato con contraseña) se elimina de localStorage en el primer arranque.
- Sesión del panel admin extendida de 24 h a **7 días**.
- Corrección CSRF admin: todas las vistas (`config`, `menu`, `users`, `dashboard`) ahora propagan correctamente el token al layout, resolviendo el error "Token de seguridad inválido" al guardar.

**Dev Log movido a `/admin/logs`**
- El Dev Log se quitó de Settings (donde solo era visible en modo dev) y se movió al panel de administración (`/admin/logs`), donde es siempre accesible para el administrador.
- Nueva vista SSR con colores por severidad (ERROR/WARN/info), orden inverso cronológico y botón "Limpiar log".

**Bug fixes**
- Tasks: el ORDER BY con `CASE priority WHEN "urgent"` usaba comillas dobles — SQLite las interpreta como identificadores de columna, causando error "no such column: urgent". Corregido a comillas simples `'urgent'`.
- Contacts: el widget del dashboard llamaba `.filter()` sobre el objeto paginado `{ items, total }` en lugar del array `items`, causando TypeError. Corregido con patrón `result.items ?? result`.
- Dashboard: se eliminaron peticiones `GET /api/songs/stats` cuando el plugin `starcho` está desactivado (causaban 404 en consola).
- API: agregados handlers 404 y 500 al router Express con logging via `electron-log`.
- Router: eliminado el auth guard que bloqueaba la renderización inicial del dashboard antes del login.

**Paginación**
- Paginator: corregido el parámetro `per_page` (era `perPage` en camelCase, el backend espera snake_case).

### v1.0.2-beta.1

- Paginador universal (`Paginator.js`) para todos los plugins
- Disco duro real en Dashboard via `getSystemStats` IPC
- Live clock en Dashboard (actualización cada segundo)

### v1.0.1-beta.1

- Auto-updater con banner de progreso y botones de instalación
- Temas de titlebar: mac, linux, cartoon, stripe
- Panel de administración `/admin` con login, dashboard, plugins, config, usuarios
- Seguridad admin: rate limiting, CSRF, sesiones HttpOnly

### v1.0.0

- Lanzamiento inicial del starkit con plugins, temas, i18n, mini-player y auto-updater básico.

---

## Licencia

MIT — úsalo, modifícalo y compártelo libremente.
