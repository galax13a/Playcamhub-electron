# StarchoElectron

> Starkit para construir apps de escritorio con Electron + Express + SQLite + vanilla JS.

StarchoElectron es una plantilla de arranque ("starkit") lista para producción. Incluye autenticación, temas, i18n, sistema de plugins, mini-player IPC y una app de ejemplo completa (Starcho Music). Clona, agrega tu plugin y lanza.

---

## ¿Qué es un Starkit?

Un starkit es una base de proyecto preconfigurada que resuelve la infraestructura para que te puedas enfocar en la lógica de negocio. StarchoElectron cubre:

| Capa | Qué trae resuelto |
|------|-------------------|
| Electron | Ventana frameless, título bar custom, controles de ventana, single instance lock |
| Backend local | Express en `localhost:PORT`, CORS, rutas REST, middleware de autenticación |
| Base de datos | SQLite (better-sqlite3), WAL mode, migraciones idempotentes al arrancar |
| Frontend | ES Modules sin bundler, router hash, store reactivo, EventBus, i18n (EN/ES/PT) |
| Temas | 10 temas CSS (`data-theme`), dark/light/matrix/winamp/rickmorty/kick/pink/red/military/arcade |
| Plugins | Sistema tipo WordPress — cada plugin registra rutas Express y vistas en el Sidebar |
| Mini player | Ventana secundaria always-on-top con 3 tamaños, IPC bidireccional y sync de tema |
| Auto-updater | electron-updater apuntando a GitHub Releases |
| Empaquetado | electron-builder para Windows (NSIS), macOS (DMG/ZIP) y Linux (AppImage/deb) |

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
│   │   ├── windowManager.js      # Crea BrowserWindow (main + mini player)
│   │   ├── ipcHandlers.js        # Registra todos los canales IPC
│   │   ├── menuBuilder.js        # Menú nativo de la app
│   │   └── updater.js            # Integración con electron-updater
│   │
│   ├── backend/                  # API REST Express (patrón MVC)
│   │   ├── server.js             # Configura Express, rutas estáticas, encuentra puerto
│   │   ├── core/
│   │   │   └── PluginManager.js  # Descubre y activa plugins desde /plugins/
│   │   ├── database/
│   │   │   ├── connection.js     # Singleton SQLite (WAL mode, foreign keys)
│   │   │   └── migrations.js     # Schema base — users, settings, plugins
│   │   ├── models/               # Modelos SQLite (Song, Playlist, Category, Settings…)
│   │   ├── controllers/          # Lógica de negocio por recurso
│   │   └── routes/               # Definición de rutas REST (index.js = auth + config + settings)
│   │
│   └── renderer/                 # Frontend (vanilla JS ES Modules)
│       ├── index.html            # Shell SPA cargado con loadFile()
│       ├── mini-player.html      # Ventana mini player (3 tamaños, theme-aware)
│       ├── mini-player.js        # Lógica mini player — sync IPC, visualizer, tamaños
│       ├── app.js                # Secuencia de boot — port IPC, settings, plugins, router
│       ├── router.js             # Router hash del lado del cliente
│       ├── store.js              # Estado global reactivo + EventBus
│       ├── core/
│       │   └── PluginRegistry.js # Carga plugins frontend y despacha vistas
│       ├── components/           # Componentes UI (Player, Sidebar, Library, Search…)
│       ├── utils/
│       │   ├── api.js            # Helpers fetch → Express local
│       │   ├── i18n.js           # Sistema i18n (t(key), setLang, LANGUAGES)
│       │   ├── eventBus.js       # Pub/sub en-página
│       │   └── formatters.js     # Duración, tamaño de archivo, fechas
│       └── styles/
│           ├── main.css          # Estilos base + componentes
│           ├── animations.css    # Keyframes
│           └── themes/           # 10 archivos CSS de temas
│
└── plugins/                      # Plugins de la app (cada carpeta = un plugin)
    ├── starcho/                  # Plugin incluido: música + YouTube
    ├── contacts/                 # Plugin ejemplo: agenda de contactos
    ├── notes/                    # Plugin ejemplo: notas
    └── tasks/                    # Plugin ejemplo: tareas
```

---

## Cómo funciona el sistema de plugins

### Estructura de un plugin

Cada plugin vive en su propia carpeta dentro de `plugins/`. La carpeta puede tener cualquier nombre — ese nombre se convierte en el `id` del plugin.

```
plugins/
└── mi-plugin/
    ├── plugin.json          # Manifiesto del plugin
    ├── backend/
    │   ├── index.js         # Punto de entrada backend (migrate + register)
    │   ├── migrations.js    # Tablas SQLite propias del plugin
    │   └── routes/
    │       └── index.js     # Rutas Express que el plugin aporta
    └── frontend/
        └── index.js         # Registro de vistas y nav items
```

### plugin.json — Manifiesto

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

### Backend — `plugins/mi-plugin/backend/index.js`

El PluginManager llama `migrate(db)` y luego `register(router, db, appPaths)` en cada inicio.

```js
'use strict';

const { migrate } = require('./migrations');
const routes      = require('./routes/index');

module.exports = {
  // Se ejecuta una vez al arrancar — crea tablas si no existen
  migrate(db) {
    migrate(db);
  },

  // Registra rutas en el router compartido de Express
  register(router, db, appPaths) {
    router.use('/mi-recurso', routes);
  },
};
```

### Backend — `plugins/mi-plugin/backend/migrations.js`

```js
'use strict';

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mi_tabla (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre     TEXT NOT NULL,
      creado_en  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

module.exports = { migrate };
```

### Backend — `plugins/mi-plugin/backend/routes/index.js`

Rutas Express normales. `req.appPaths` tiene `{ userData, music, thumbnails, bin, db }`.

```js
'use strict';

const router = require('express').Router();

router.get('/', (req, res) => {
  const { getDb } = require('../../../../src/backend/database/connection');
  const filas = getDb().prepare('SELECT * FROM mi_tabla').all();
  res.json(filas);
});

router.post('/', (req, res) => {
  const { nombre } = req.body;
  const { getDb } = require('../../../../src/backend/database/connection');
  const result = getDb().prepare('INSERT INTO mi_tabla (nombre) VALUES (?)').run(nombre);
  res.json({ id: result.lastInsertRowid, nombre });
});

module.exports = router;
```

### Frontend — `plugins/mi-plugin/frontend/index.js`

Exporta un objeto con `id`, `navItems` y `views`. El PluginRegistry lo carga automáticamente.

```js
export default {
  id: 'mi-plugin',

  // Items que aparecen en el Sidebar
  navItems: [
    { view: 'mi-plugin:lista', icon: '🧩', label: 'Mi lista' },
  ],

  // Si el plugin quiere la sección de playlists en el sidebar
  hasSidebarPlaylists: false,

  // Mapa view-key → función que renderiza en el slot
  views: {
    'mi-plugin:lista': async (el, extra) => {
      // Importación dinámica — solo carga cuando el usuario navega aquí
      const { renderMiLista } = await import('./views/MiLista.js');
      renderMiLista(el, extra);
    },
  },
};
```

### Cómo el framework carga los plugins

**Backend (al iniciar Express):**

```
main.js
  └─ startServer(appPaths, port)
       └─ PluginManager.activate(router, db, appPaths)
            └─ Para cada carpeta en /plugins/:
                 1. Lee plugin.json
                 2. Registra en tabla "plugins" de SQLite (default: enabled)
                 3. Si enabled → requiere backend/index.js
                 4. Llama plugin.migrate(db)
                 5. Llama plugin.register(router, db, appPaths)
```

**Frontend (al bootear el renderer):**

```
app.js
  └─ PluginRegistry.init()
       └─ GET /api/plugins  (lista qué plugins están activos)
            └─ Para cada plugin activo:
                 import(`/plugins/${id}/frontend/index.js`)
                 → registra navItems en el Sidebar
                 → registra views en el Router
```

---

## Cómo construir tu app sobre el starkit

### 1. Clona el repositorio

```bash
git clone https://github.com/galax13a/StarchoElectron.git
cd StarchoElectron
npm install
npm run rebuild   # Recompila better-sqlite3 para tu versión de Electron
```

### 2. Crea tu plugin

```bash
# Crea la estructura mínima
mkdir -p plugins/mi-app/backend/routes
mkdir -p plugins/mi-app/frontend/views
```

Agrega `plugin.json`, `backend/index.js`, `backend/migrations.js`, `backend/routes/index.js` y `frontend/index.js` siguiendo los ejemplos de arriba.

### 3. Configura `.env`

```bash
cp .env.example .env
```

Edita los valores de branding:

```env
PORT=3847
APP_ID=com.tuempresa.tuapp
APP_NAME=Mi App
APP_TITLE=Mi App — La mejor app
APP_SLOGAN=Tu slogan aquí
DEVTOOLS=true   # Abre DevTools en desarrollo
```

### 4. Ejecuta en desarrollo

```bash
npm run dev
```

### 5. Empaqueta para producción

```bash
npm run build:win    # Windows NSIS .exe
npm run build:mac    # macOS .dmg + .zip
npm run build        # Todas las plataformas
```

---

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| PORT | 3847 | Puerto Express (auto-incrementa si está ocupado) |
| APP_ID | com.starcho.electron | Windows App User Model ID |
| APP_NAME | StarchoElectron | Nombre mostrado en la UI |
| APP_TITLE | StarchoElectron — Dev Platform | Título de la barra de título |
| APP_SLOGAN | Starkit para apps Electron | Slogan mostrado en el dashboard |
| LOGO_TEXT | Starcho | Texto del logo en el sidebar |
| DEVTOOLS | false | `true` abre DevTools al iniciar |

---

## API REST del core

El servidor local corre en `http://127.0.0.1:PORT/api/`:

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /config | Configuración de la app (branding desde .env) |
| GET | /settings | Todos los settings guardados en SQLite |
| POST | /settings | Actualiza settings en bulk |
| POST | /auth/login | Login de usuario |
| POST | /auth/register | Registro de usuario |
| GET | /auth/profile | Perfil del usuario |
| PUT | /auth/profile | Actualiza perfil |
| GET | /plugins | Lista plugins con estado enabled/disabled |
| PUT | /plugins/:id | Habilita o deshabilita un plugin |

Los endpoints de música, playlists, categorías, descarga, etc. los aporta el plugin `starcho`.

---

## Mini player IPC

El mini player es una `BrowserWindow` separada (`always-on-top`). La comunicación es bidireccional:

```
Main renderer
  └─ electronAPI.updateMiniPlayerState(state)
       │  IPC: mini-player:state-update  →  main process
       └─ mini-player window recibe el estado y re-renderiza

Mini player
  └─ electronAPI.miniPlayerControl('toggle' | 'next' | 'prev' | 'seek', value)
       │  IPC: mini-player:control  →  main process
       └─ main renderer ejecuta la acción en el store
```

**Canales disponibles en `preload.js`:**

| Canal | Dirección | Descripción |
|-------|-----------|-------------|
| `mini-player:open` | renderer → main | Abre el mini player |
| `mini-player:close` | renderer → main | Cierra el mini player |
| `mini-player:state-update` | renderer → main | Envía estado al mini player |
| `mini-player:state` | main → mini player | Mini player recibe el estado |
| `mini-player:control` | mini player → main | Mini player envía control |
| `mini-player:resize` | mini player → main | Cambia tamaño de la ventana |
| `mini-player:set-footer` | mini player → main | Modo footer (full-width, pinned bottom) |
| `mini-player:exit-footer` | mini player → main | Sale del modo footer |
| `self:minimize` | mini player → main | El mini player se minimiza a sí mismo |

---

## Almacenamiento de datos

Todos los datos del usuario van en `userData` de Electron — nunca en la carpeta de instalación.

- **Windows**: `%APPDATA%\StarchoElectron\`
- **macOS**: `~/Library/Application Support/StarchoElectron/`

Contenido: `starcho.db`, `music/`, `thumbnails/`, `bin/yt-dlp[.exe]`

---

## Prerrequisitos

- Node.js 18+
- npm 9+
- **Windows**: Visual Studio Build Tools (para compilar better-sqlite3)
- **macOS**: Xcode Command Line Tools — `xcode-select --install`

---

## Licencia

MIT © 2024 StarchoElectron
