# StarchoElectron

> Starkit para construir apps de escritorio con Electron + Express + SQLite + vanilla JS.

StarchoElectron es una plantilla de arranque ("starkit") lista para producción. Incluye autenticación local, temas visuales, i18n, sistema de plugins con dashboard widget API, mini-player IPC, manejador de errores, validación con Zod, y una app de música de ejemplo completa. Clona, crea tu plugin y lanza.

---

## ¿Qué incluye el starkit?

| Capa | Qué trae resuelto |
|------|-------------------|
| **Electron** | Ventana frameless, título bar custom, controles (min/max/close), single instance lock, arranque maximizado |
| **Seguridad** | `IS_PROD`/`IS_DEV` automático, sandbox, devTools off, Chromium flags, CSP en renderer |
| **Backend local** | Express en `localhost:PORT`, auto-incremento de puerto, CORS, rutas REST |
| **Base de datos** | SQLite (better-sqlite3), WAL mode, migraciones idempotentes, settings de plugins en DB |
| **Frontend** | ES Modules sin bundler, router hash, store reactivo, EventBus, i18n (EN/ES/PT) |
| **Autenticación** | Login/registro local, "recordar sesión" con auto-login, hash SHA-256, recuerda última ruta |
| **Settings** | Todos los ajustes guardados en SQLite — cero localStorage para settings |
| **Temas UI** | 12 temas CSS (`data-theme`): dark, light, matrix, winamp, rickmorty, kick, pink, red, military, arcade, neon, ocean |
| **Temas login** | 8 pantallas de login intercambiables: nebula, split, glass, kick, arcade, galax, cyber, lux |
| **Plugins** | Sistema tipo WordPress — cada plugin registra rutas Express, vistas en Sidebar, y widgets en el Dashboard |
| **Dashboard** | Home screen con widgets por zona (header/content), estadísticas del sistema (CPU, RAM), acciones rápidas |
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

El starkit detecta automáticamente si corre en producción o desarrollo:

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
| `winamp` | Winamp | Retro gris |
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
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = new URL('./styles/mi-plugin.css', import.meta.url).href;
    document.head.appendChild(link);
  },

  // Ítems que aparecen en el Sidebar bajo "Módulos"
  navItems: [
    { view: 'mi-plugin:list', icon: '🔌', label: 'Mi Plugin' },
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
      priority: 50,          // mayor = se muestra primero
      title:    '🔌 Mi Plugin',
      async render(el) {
        // Render HTML + bind events in el
        el.innerHTML = `<div>Hola desde mi plugin</div>`;
      },
    },
  ],
};
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

---

## Manejador de Errores

```js
// src/renderer/utils/errorHandler.js
import { logError, logWarn, initErrorHandler } from './utils/errorHandler.js';

// Inicializado en boot (app.js)
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

## Dashboard y Widgets

El Dashboard (`home`) tiene estas zonas donde los plugins pueden contribuir contenido:

| Zona | CSS container | Descripción |
|------|--------------|-------------|
| `header` | `#dash-zone-header` | Franja ancha superior (ej. "Reproduciendo ahora") |
| `content` | `#dash-zone-content` | Grid de tarjetas resumen por plugin |

El Dashboard también muestra:
- **Rendimiento del sistema**: CPU %, RAM usada/total — refrescado cada 3 s via IPC
- **Acciones rápidas**: Un botón por cada nav item registrado por todos los plugins activos
- **Botón de perfil** (👤): Abre el modal de edición de perfil directamente

---

## Perfil de usuario

El perfil se edita mediante un **popup modal** accesible desde:
- El avatar/nombre en la barra lateral (clic en el área del usuario)
- El botón 👤 en el Dashboard

Permite editar: avatar (crop 128×128), nombre completo, apodo, WhatsApp.
Los datos se guardan en la tabla `users` y se reflejan inmediatamente en el store.

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
APP_NAME=Mi App
APP_SLOGAN=Descripción breve
APP_VERSION=1.0.0
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

## Requisitos

- Node.js 18+
- npm 9+
- Python 3 + Build Tools (para `better-sqlite3`)
- yt-dlp en PATH (para descarga de YouTube)
- ffmpeg en PATH (para conversión de audio/video)

---

## Licencia

MIT — úsalo, modifícalo y compártelo libremente.
