# Prompt de handoff — PlaycamHub Studio (para otra IA / crear task)

> Copia todo lo de abajo y pégalo en la otra herramienta. Es autocontenido.

---

## Contexto del proyecto

**PlaycamHub Studio** es una app de escritorio Electron (reproductor de música estilo Spotify + experiencia TikTok; descarga/organiza audio y video con yt-dlp).

Stack y reglas duras (NO romper):
- **Electron 42 · Express 4 (embebido, escucha en 127.0.0.1) · better-sqlite3 (SQLite síncrono) · vanilla JS ES Modules.**
- **Sin bundler** (ES Modules nativos + `import()` dinámico), **sin React/Vue**, **sin transpilación**.
- Arquitectura **plugin-first**: toda feature nueva vive en `plugins/<id>/` (backend: `index.js`, `migrations.js`, `routes/index.js`; frontend: `index.js`, `views/` con patrón `render*(el, extra)`). El core solo cubre auth/settings/gestión de plugins.
- **IPC explícito** vía `preload.js` (contextBridge → `window.electronAPI`). Nunca `require('electron')` en el renderer.
- **Migraciones idempotentes y versionadas** vía tabla `schema_version` (runner en `src/backend/database/migrationRunner.js`).
- Validación con **Zod** (`src/backend/middleware/validate.js`). Paginación: endpoints devuelven `{ items, total, page, perPage }`.
- Idioma: respuestas al usuario en **español**; código y commits en **inglés**.
- **Git push SOLO cuando el usuario lo pida explícitamente.** Al commitear, hacerlo solo con los archivos de la tarea actual (no los ~136 archivos modificados preexistentes).
- App versión actual: **1.0.4**. La versión de `package.json` es la única fuente de verdad (README, CLAUDE.md y CHANGELOG deben coincidir).

Plugins activos: `starcho` (música/media), `contacts`, `notes`, `tasks`, `speedtest`.

---

## Lo que YA se hizo (últimas 3 cosas pedidas, ya completadas)

**1) Verificación de Electron + updater + buenas prácticas.**
Electron 28 estaba EOL. Se confirmó que conviene subir. Seguridad revisada y OK: `contextIsolation:true`, `nodeIntegration:false`, `sandbox` en prod, `webSecurity:true`, CSP estricta, server atado a `127.0.0.1`, lockdown de navegación. Pendientes señalados (ver abajo).

**2) Upgrade a Electron 42.3.0** (Node 24, Chromium 148). En `package.json`:
- `electron` ^28.3.3 → **^42.3.0**
- `electron-builder` ^24.9.1 → **^26.0.12**
- `@electron/rebuild` ^3.6.0 → **^4.0.1**
- `better-sqlite3` ^9.4.3 → **^12.9.0** (prebuilds para Electron 42)
- Docs actualizadas (README, CLAUDE.md, skills/playcamhub/SKILL.md, CHANGELOG). Falta `.claude/commands/starcho.md` línea 11 (ubicación protegida, cambiar a mano "Electron 28" → "Electron 42").

**3) Alineación del auto-updater con el nuevo electron-builder:**
- `electron-updater` ^6.1.8 → **^6.3.9**
- `electron-log` ^5.1.1 → **^5.2.0**
- El código de `src/main/updater.js` NO requiere cambios (usa API estándar: `autoDownload=true`, `autoInstallOnAppQuit=true`, chequeo a los 5s y cada 4h vía `checkForUpdatesAndNotify`).

---

## TAREA para la otra IA

Completar y validar el upgrade a Electron 42 en local (no se pudo desde el sandbox). Pasos:

1. `npm install`
2. `npm run rebuild` — recompila módulos nativos (better-sqlite3, sharp) contra el ABI de Electron 42 / Node 24.
3. `npm start` — smoke test: que arranque, que `window.electronAPI` exista (preload corre con `sandbox:true` en prod), y que el server Express embebido responda.
4. `npm test && npm run lint && npm run typecheck` — deben quedar verdes.
5. `npm run build:win` — verificar que electron-builder 26 empaqueta con `asar:true` + `asarUnpack` correctamente.
6. Probar el flujo del auto-updater contra un release de GitHub de prueba.

### Pendientes / riesgos a revisar (importantes)
- **`build.publish` apunta a `galax13a/PlaycamHub-Studio`** pero el repo declarado en CLAUDE.md es `StarchoElectron`. Si los releases están en otro repo, el auto-updater dará 404. **Confirmar el repo/owner correcto del feed de updates.**
- **Sin code signing.** El auto-updater en Windows/macOS idealmente requiere firma; sin ella, los instaladores muestran advertencias y en macOS el update puede fallar. Decidir si se firma.
- `main.js` tiene `app.commandLine.appendSwitch('remote-debugging-port', '0')` en prod — `'0'` usa puerto aleatorio, NO desactiva el debug remoto. Revisar si debe quitarse en prod.
- `src/backend/server.js` usa `cors({ origin: '*' })` (wildcard). El server es localhost-only, pero conviene restringir el origin.
- Secretos con placeholder `changeme` (JWT_SECRET, ADMIN_PASS) y un admin hardcodeado `root@starcho.com / 123456x` en sessions.js — quitar antes de publicar.
- Migración incremental a TypeScript en curso (solo `// @ts-check` + JSDoc, sin transpilar). Plan en `docs/MIGRATION-TYPESCRIPT.md`. Ya tipados: schemas (auth, songs, contacts) y migrationRunner. Pendiente: connection.js, models, controllers, routes, renderer — un archivo por commit, validando con `npm run typecheck`.

### Restricciones al ejecutar
- NO introducir bundler, React/Vue ni transpilación.
- NO hacer `git push` salvo orden explícita; commits solo de los archivos tocados en esta tarea.
- Respuestas al usuario en español; código/commits en inglés.
