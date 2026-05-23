# StarchoElectron — Contexto permanente para Claude Code

Proyecto: **StarchoElectron** — starkit Electron de escritorio.
Owner: galax13a · botcamdev@gmail.com
Repo: https://github.com/galax13a/StarchoElectron.git (rama `master`)
Stack: Electron 28 · Express 4 · better-sqlite3 · vanilla JS ES Modules. Sin bundler, sin React.

---

## Reglas críticas (siempre aplicar)

1. **Plugin first** — toda feature nueva va en `plugins/<id>/`. Core = solo auth/settings/plugin-management.
2. **No bundler** — ES Modules nativos + `import()` dinámico. Sin webpack/vite/rollup.
3. **No frameworks** — vanilla JS puro. Patrón `render*(el, extra)` para vistas.
4. **IPC explícito** — toda comun main↔renderer por `preload.js` contextBridge. Nunca `require('electron')` en renderer.
5. **SQLite síncrono** — better-sqlite3. No async/await en queries de DB.
6. **Migraciones idempotentes** — `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE … ADD COLUMN` con try/catch.
7. **DEVTOOLS** — leer `process.env.DEVTOOLS === 'true'`, nunca hardcodeado.
8. **Git push** — SOLO cuando el usuario lo pida explícitamente en ese mensaje.
9. **Idioma** — respuestas al usuario en español; código y commits en inglés.
10. **Paginación** — endpoints de plugins devuelven `{ items, total, page, perPage }`. Frontend usa `Paginator.js`.

---

## Archivos de referencia rápida

| ¿Qué necesitas? | Archivo |
|----------------|---------|
| Agregar ruta API | `plugins/<id>/backend/routes/index.js` |
| Agregar tabla DB | `plugins/<id>/backend/migrations.js` |
| Agregar vista al renderer | `plugins/<id>/frontend/views/` + registrar en `frontend/index.js` |
| Agregar canal IPC | `preload.js` + `src/main/ipcHandlers.js` |
| Sistema de temas | `src/renderer/styles/themes/` + `store.applyTheme()` |
| Paginador AJAX | `src/renderer/utils/Paginator.js` |
| HTML helpers | `src/renderer/utils/html.js` — `esc(), formGroup(), grid(), statRow()` |
| UI components | `src/renderer/components/ui.js` — `viewHeader(), filterBar(), wireFilters()` |
| Estado global | `src/renderer/store.js` — `store.setState(), store.navigate()` |
| Admin panel | `src/backend/admin/router.js` + `views/` |
| Validación Zod | `src/backend/middleware/validate.js` → `validate(Schema, 'body'|'query'|'params')` |

---

## Componentes compartidos — importación desde plugin

```js
// En plugins/<id>/frontend/views/MiVista.js  (4 niveles de profundidad)
import { esc, formGroup, grid, statRow }   from '../../../../src/renderer/utils/html.js';
import { viewHeader, filterBar, wireFilters } from '../../../../src/renderer/components/ui.js';
import { Paginator }                          from '../../../../src/renderer/utils/Paginator.js';
import API                                    from '../../../../src/renderer/utils/api.js';
import store                                  from '../../../../src/renderer/store.js';
import { openModal, showToast }               from '../../../../src/renderer/components/Modal.js';
```

---

## Usar el skill completo

Escribe `/starcho` para obtener el contexto completo del proyecto con plantillas de código para:
- Crear un plugin nuevo (backend + frontend completo)
- Agregar canal IPC
- Usar el Paginator universal
- Checklist de plugin

---

## Estado actual (2026-05-23)

- Electron 28.3.3 · versión app `1.0.2-beta.1`
- 4 plugins activos: `starcho` (música), `contacts`, `notes`, `tasks`
- Auto-updater GitHub Releases activado
- Panel admin en `/admin` (SSR, CSRF, rate limiting)
- 3 temas de titlebar: `mac`, `linux`, `cartoon`
- Paginación server-side en `tasks` y `contacts` con Paginator universal
- Live clock + disco duro real en Dashboard
- Sistema de temas: 12 temas UI + 8 temas de login
