# StarchoElectron

> Starkit para construir apps de escritorio con Electron + Express + SQLite + vanilla JS.

StarchoElectron es una plantilla de arranque ("starkit") lista para producción. Incluye autenticación local, temas visuales, i18n, sistema de plugins, mini-player IPC, seguridad por modo de ejecución y una app de música de ejemplo completa. Clona, crea tu plugin y lanza.

---

## ¿Qué incluye el starkit?

| Capa | Qué trae resuelto |
|------|-------------------|
| **Electron** | Ventana frameless, título bar custom, controles (min/max/close), single instance lock |
| **Seguridad** | `IS_PROD`/`IS_DEV` automático, sandbox, devTools off, Chromium flags, CSP en renderer |
| **Backend local** | Express en `localhost:PORT`, auto-incremento de puerto, CORS, rutas REST |
| **Base de datos** | SQLite (better-sqlite3), WAL mode, migraciones idempotentes al arrancar |
| **Frontend** | ES Modules sin bundler, router hash, store reactivo, EventBus, i18n (EN/ES/PT) |
| **Autenticación** | Login/registro local, "recordar sesión" con auto-login, hash SHA-256 |
| **Settings** | Todos los ajustes guardados en SQLite — cero localStorage para settings |
| **Temas UI** | 10 temas CSS (`data-theme`): dark, light, matrix, winamp, rickmorty, kick, pink, red, military, arcade |
| **Temas login** | 6 pantallas de login intercambiables: nebula, split, glass, kick, arcade, galax |
| **Plugins** | Sistema tipo WordPress — cada plugin registra rutas Express y vistas en el Sidebar |
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

El starkit detecta automáticamente si corre en producción o desarrollo y aplica configuraciones distintas:

| Comportamiento | Desarrollo (`npm run dev`) | Producción (app empaquetada) |
|----------------|---------------------------|------------------------------|
| DevTools | Disponible (F12, o `DEVTOOLS=true` en `.env`) | Completamente bloqueado |
| Sandbox renderer | Desactivado | Activado |
| `remote-debugging-port` | Abierto | Forzado a `0` |
| Chromium extensions | Habilitadas | Deshabilitadas |
| Bloqueo de navegación | Suave | Bloqueo estricto (solo `file://` y `127.0.0.1`) |
| Auto-updater | Desactivado | Activado |
| Log level | `info` | `warn` |

`IS_PROD` se activa cuando `app.isPackaged === true` (electron-builder) o `NODE_ENV=production`. Todo lo demás es `IS_DEV`.

---

## Pantallas de login

La pantalla de login se puede cambiar desde **Settings → Pantalla de login**. La preferencia se guarda en la base de datos SQLite y se aplica en el siguiente inicio.

| Tema | Estilo |
|------|--------|
| `nebula` | Fondo oscuro con blobs animados cyan + purple (default) |
| `split` | Panel izquierdo de branding + formulario a la derecha |
| `glass` | Gradiente espacial con card glassmorphism |
| `kick` | Negro total, acento neon green `#53FC18`, borde brillante |
| `arcade` | Pixel grid, scanlines CRT, bordes dobles magenta + cyan, animación pulsante |
| `galax` | Deep space con 18 estrellas CSS, banda aurora animada y card translúcida |

---

## Settings — todo en base de datos

Todos los ajustes de la app se guardan en la tabla `settings` de SQLite. No se usa `localStorage` para preferencias de usuario.

| Clave | Default | Descripción |
|-------|---------|-------------|
| `theme` | `dark` | Tema visual de la app |
| `volume` | `80` | Volumen del reproductor (0-100) |
| `auto_play` | `true` | Auto-play al cambiar de canción |
| `language` | `es` | Idioma de la interfaz (`es`, `en`, `pt`) |
| `login_theme` | `nebula` | Tema de la pantalla de login |
| `plan` | `basic` | Plan de suscripción (`basic` / `premium`) |

**La única excepción** es `auth_remember` (credenciales de sesión del "recordar sesión"), que se guarda en `localStorage` porque es necesario antes de que el servidor arranque.

---

## Estructura del proyecto

```
StarchoElectron/
├── main.js                       # Entrada Electron — arranca Express, registra IPC, crea ventana
├── preload.js                    # contextBridge — expone electronAPI al renderer
├── .env / .env.example           # Variables de entorno (PORT, APP_NAME, DEVTOOLS…)
│
├── src/
│   ├── main/                     # Proceso principal de Electron
│   │   ├── env.js                # IS_PROD / IS_DEV / DEVTOOLS — detección central de modo
│   │   ├── windowManager.js      # BrowserWindow main + mini player, lockdown de seguridad
│   │   ├── ipcHandlers.js        # Todos los canales IPC (window, mini-player, updater…)
│   │   ├── menuBuilder.js        # Menú nativo de la app
│   │   └── updater.js            # Integración con electron-updater
│   │
│   ├── backend/                  # API REST Express (patrón MVC)
│   │   ├── server.js             # Configura Express, rutas, encuentra puerto libre
│   │   ├── core/
│   │   │   └── PluginManager.js  # Descubre y activa plugins desde /plugins/
│   │   ├── database/
│   │   │   ├── connection.js     # Singleton SQLite (WAL mode, foreign keys on)
│   │   │   └── migrations.js     # Schema base — users, settings, plugins + seeds
│   │   ├── models/               # Modelos SQLite (Song, Playlist, Category, Settings…)
│   │   ├── controllers/          # Lógica de negocio por recurso
│   │   └── routes/               # Rutas REST (auth, config, settings, plugins)
│   │
│   └── renderer/                 # Frontend (vanilla JS ES Modules, sin bundler)
│       ├── index.html            # Shell SPA — cargado con loadFile()
│       ├── mini-player.html      # Ventana mini player (3 tamaños, theme-aware)
│       ├── mini-player.js        # Lógica mini player — sync IPC, visualizer, tamaños
│       ├── app.js                # Secuencia de boot — port IPC, settings, plugins, router
│       ├── router.js             # Router hash del lado del cliente
│       ├── store.js              # Estado global reactivo + EventBus
│       ├── login.js              # Pantalla de login — auth, auto-login, tema desde DB
│       ├── core/
│       │   └── PluginRegistry.js # Carga plugins frontend y despacha vistas
│       ├── components/           # Componentes UI (Player, Sidebar, Library, Search, Settings…)
│       ├── utils/
│       │   ├── api.js            # Helpers fetch → Express local
│       │   ├── i18n.js           # Sistema i18n (t(key), setLang, LANGUAGES, THEMES)
│       │   ├── eventBus.js       # Pub/sub en-página
│       │   └── formatters.js     # Duración, tamaño de archivo, fechas
│       └── styles/
│           ├── main.css          # Estilos base + layout + login page
│           ├── login-themes.css  # 6 temas de login + previews del picker
│           ├── animations.css    # Keyframes globales
│           └── themes/           # 10 archivos CSS de temas de app
│
└── plugins/                      # Plugins (cada carpeta = un plugin)
    ├── starcho/                  # Plugin incluido: música, YouTube, playlists
    ├── contacts/                 # Plugin ejemplo: agenda
    ├── notes/                    # Plugin ejemplo: notas
    └── tasks/                    # Plugin ejemplo: tareas
```

---

## Sistema de plugins

### Estructura de un plugin

```
plugins/
└── mi-plugin/
    ├── plugin.json          # Manifiesto
    ├── backend/
    │   ├── index.js         # migrate(db) + register(router, db, appPaths)
    │   ├── migrations.js    # Tablas SQLite del plugin
    │   └── routes/
    │       └── index.js     # Rutas Express
    └── frontend/
        └── index.js         # navItems + views map
```

### `plugin.json`

```json
{
  "id":          "mi-plugin",
  "name":        "Mi Plugin",
  "version":     "1.0.0",
  "description": "Descripción corta.",
  "author":      "Tu nombre",
  "icon":        "🧩",
  "color":       "#8B5CF6"
}
```

### Backend — `backend/index.js`

```js
'use strict';
const { migrate } = require('./migrations');
const routes      = require('./routes/index');

module.exports = {
  migrate(db) { migrate(db); },
  register(router, db, appPaths) {
    router.use('/mi-recurso', routes);
  },
};
```

### Backend — `backend/migrations.js`

```js
'use strict';
function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mi_tabla (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre    TEXT NOT NULL,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
module.exports = { migrate };
```

### Backend — `backend/routes/index.js`

```js
'use strict';
const router = require('express').Router();
const { getDb } = require('../../../../src/backend/database/connection');

router.get('/',  (_req, res) => res.json(getDb().prepare('SELECT * FROM mi_tabla').all()));
router.post('/', (req, res) => {
  const r = getDb().prepare('INSERT INTO mi_tabla (nombre) VALUES (?)').run(req.body.nombre);
  res.json({ id: r.lastInsertRowid, nombre: req.body.nombre });
});

module.exports = router;
```

### Frontend — `frontend/index.js`

```js
export default {
  id: 'mi-plugin',

  navItems: [
    { view: 'mi-plugin:lista', icon: '🧩', label: 'Mi lista' },
  ],

  hasSidebarPlaylists: false,

  views: {
    'mi-plugin:lista': async (el, extra) => {
      const { renderMiLista } = await import('./views/MiLista.js');
      renderMiLista(el, extra);
    },
  },
};
```

### Flujo de carga

**Backend** (al arrancar Express):
```
main.js → startServer()
  └─ PluginManager.activate(router, db, appPaths)
       └─ Por cada carpeta en /plugins/:
            1. Lee plugin.json
            2. INSERT OR IGNORE en tabla "plugins"
            3. Si enabled → require backend/index.js
            4. plugin.migrate(db)
            5. plugin.register(router, db, appPaths)
```

**Frontend** (al bootear el renderer):
```
app.js → PluginRegistry.init()
  └─ GET /api/plugins
       └─ Por cada plugin activo:
            import(`/plugins/${id}/frontend/index.js`)
            → registra navItems en el Sidebar
            → registra views en el Router
```

---

## API REST del core

Base URL: `http://127.0.0.1:PORT/api/`

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/config` | Branding de la app (desde `.env`) |
| GET | `/settings` | Todos los settings (público, sin auth) |
| POST | `/settings` | Actualiza settings en bulk `{ key: value, … }` |
| POST | `/auth/login` | Login — `{ username, password }` |
| POST | `/auth/register` | Registro — `{ username, password }` |
| GET | `/auth/profile?username=` | Perfil de usuario |
| PUT | `/auth/profile` | Actualiza perfil (full_name, nickname, avatar…) |
| GET | `/plugins` | Lista plugins con estado enabled/disabled |
| PUT | `/plugins/:id` | Habilita o deshabilita un plugin |

Los endpoints de música, playlists, categorías, descarga y YouTube los aporta el plugin `starcho`.

---

## Mini player

El mini player es una `BrowserWindow` separada (`always-on-top`). Tiene 3 modos de tamaño:

| Modo | Dimensiones | Descripción |
|------|-------------|-------------|
| `mini` | 270 × 88 px | Compacto — solo controles básicos |
| `minimalista` | 330 × 200 px | Carátula + controles + progreso |
| `full` | 100vw × 196 px | Footer full-width, anclado al fondo |

**Canales IPC disponibles:**

| Canal | Dirección | Descripción |
|-------|-----------|-------------|
| `mini-player:open` | renderer → main | Abre el mini player |
| `mini-player:close` | renderer → main | Cierra el mini player |
| `mini-player:state-update` | renderer → main | Envía estado completo al mini player |
| `mini-player:state` | main → mini player | Mini player recibe el estado |
| `mini-player:control` | bidireccional | Controles (toggle, next, prev, seek…) |
| `mini-player:resize` | mini player → main | Cambia tamaño de ventana |
| `mini-player:set-footer` | mini player → main | Activa modo footer |
| `mini-player:exit-footer` | mini player → main | Sale del modo footer |

---

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3847` | Puerto Express (auto-incrementa si está ocupado) |
| `APP_ID` | `com.starcho.electron` | Windows App User Model ID (taskbar grouping) |
| `APP_NAME` | `StarchoElectron` | Nombre mostrado en la UI |
| `APP_TITLE` | `StarchoElectron — Dev Platform` | Título de la barra de título |
| `APP_SLOGAN` | `Starkit para apps Electron` | Slogan en el dashboard |
| `LOGO_TEXT` | `Starcho` | Texto del logo en el sidebar |
| `DEVTOOLS` | `false` | `true` abre DevTools al iniciar (solo en modo dev) |
| `NODE_ENV` | — | `production` activa IS_PROD aunque no esté empaquetado |

---

## Almacenamiento de usuario

Todos los datos van en `userData` de Electron — nunca en la carpeta de instalación.

| Sistema | Ruta |
|---------|------|
| Windows | `%APPDATA%\StarchoElectron\` |
| macOS | `~/Library/Application Support/StarchoElectron/` |

Contenido: `starcho.db` · `music/` · `thumbnails/` · `bin/yt-dlp[.exe]`

---

## Prerrequisitos

- **Node.js 18+** · npm 9+
- **Windows**: Visual Studio Build Tools (para compilar `better-sqlite3`)
- **macOS**: Xcode Command Line Tools — `xcode-select --install`

---

## Licencia

MIT © 2025 StarchoElectron
