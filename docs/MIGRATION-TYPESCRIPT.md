# Plan de migración incremental a TypeScript

> Estado: **Fase 0–2 parcialmente completadas** (ver "Progreso"). El proyecto sigue ejecutándose como JS/ESM puro; TypeScript se usa solo para chequeo de tipos, archivo por archivo, sin transpilación ni cambios en runtime.

## Progreso

- ✅ **Fase 0** — Scaffolding: `tsconfig.json`, script `typecheck`, devDeps (`typescript`, `@types/node`, `@types/better-sqlite3`).
- ✅ **Fase 2 (contratos)** — `src/types/global.d.ts` (IPC `window.electronAPI`), `src/types/plugin.d.ts` (manifest, backend/frontend, `Paginated<T>`), `src/types/db.d.ts` (filas de cada tabla).
- ✅ **Fase 1 (parcial)** — `// @ts-check` + typedefs `z.infer` en `src/backend/schemas/auth.js`, `songs.js` y `plugins/contacts/backend/schemas/contacts.js`. Piloto: `migrationRunner.js`.
- ⬜ **Pendiente (loop local con `npm run typecheck`)** — connection.js, models, middleware, controllers, routes y todo el renderer. Seguir la receta de abajo, un archivo por commit.

> Importante: los archivos que tocan filas de better-sqlite3 (`models`, `controllers`) requieren *casts* sobre el resultado de `.get()/.all()` (que es `unknown`). Activa `// @ts-check` en ellos **solo** corriendo `npm run typecheck` para validar cada uno; por eso no se activaron a ciegas.

## Por qué incremental (y no una reescritura)

PlaycamHub Studio tiene ~21.600 líneas de JS funcionando, un sistema de plugins maduro y la regla explícita de "sin bundler". Una reescritura completa a `.ts` con transpilación obligaría a introducir un build step en el renderer (que hoy usa ES Modules nativos vía `import()` dinámico) y a tocar Electron-builder. El enfoque incremental con `// @ts-check` + JSDoc da el 80% del valor (detección de bugs de tipos, autocompletado, contratos) con el 0% del riesgo: cada archivo se valida solo cuando se le añade el comentario, y nada se transpila.

## Cómo funciona el scaffolding (ya instalado)

- `tsconfig.json`: `noEmit: true`, `allowJs: true`, `checkJs: false`, `strict: true`. Un archivo se chequea solo si empieza con `// @ts-check` o si se renombra a `.ts`.
- `package.json`: devDeps `typescript`, `@types/node`, `@types/better-sqlite3`; script `npm run typecheck` (`tsc --noEmit`).
- Archivo piloto: `src/backend/database/migrationRunner.js` ya lleva `// @ts-check` y un `@typedef Migration`.

Antes de empezar: `npm install` (instala las nuevas devDeps).

## Fases

### Fase 1 — Tipar el backend núcleo (bajo acoplamiento, alto valor)

Añadir `// @ts-check` + JSDoc, uno por uno, en este orden:

1. `src/backend/database/connection.js`, `migrations.js` (el runner ya está).
2. `src/backend/schemas/*.js` — derivar tipos desde Zod con `/** @typedef {import('zod').infer<typeof LoginSchema>} LoginInput */`.
3. `src/backend/models/*.js` — tipar filas de SQLite con `@typedef` por tabla.
4. `src/backend/middleware/validate.js`, `controllers/*.js`, `routes/*.js`.

Tras cada archivo: `npm run typecheck` debe pasar antes de continuar.

### Fase 2 — Contratos compartidos (lo que más bugs atrapa)

- Crear `src/types/ipc.d.ts` con el contrato del `contextBridge` de `preload.js` (canales main↔renderer) y declarar `window.api` en el renderer. Esto detecta canales IPC mal escritos en tiempo de chequeo.
- Crear `src/types/plugin.d.ts` con la forma de `plugin.json`, el contrato del backend (`router`, `migrations`) y del frontend (`render*(el, extra)`, registro en `PluginRegistry`).

### Fase 3 — Renderer

- Tipar `store.js`, `router.js`, `utils/*.js`, `components/*.js` con `// @ts-check`.
- Tipar las vistas de plugins (`plugins/*/frontend/views/*.js`).
- El renderer sigue sin bundler: solo se añade JSDoc, los `import` ESM no cambian.

### Fase 4 — Renombrar a `.ts` (opcional, solo si aporta)

Solo si el equipo quiere sintaxis de tipos nativa. Requiere decidir transpilación:
- **Backend**: se puede transpilar con `tsc` a `dist-ts/` antes del empaquetado, o usar `tsx`/`ts-node` en dev.
- **Renderer sin bundler**: requeriría `tsc` emitiendo `.js` junto a cada módulo, o introducir esbuild/vite (rompe la regla "sin bundler"). **Recomendación: quedarse en `// @ts-check` para el renderer** y reservar `.ts` real solo para el backend si hace falta.

## Patrón: tipar un modelo que usa better-sqlite3

`Statement.get()/all()` devuelven `unknown`, así que bajo `// @ts-check` hay que castear el resultado a una fila de `src/types/db.d.ts`:

```js
'use strict';
// @ts-check
const { getDb } = require('../database/connection');

/** @typedef {import('../../types/db').SettingRow} SettingRow */
/** @typedef {import('../../types/db').CountRow} CountRow */

const Settings = {
  getAll() {
    const rows = /** @type {SettingRow[]} */ (
      getDb().prepare('SELECT key, value FROM settings').all()
    );
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },
  get(key) {
    const row = /** @type {SettingRow | undefined} */ (
      getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key)
    );
    return row ? row.value : null;
  },
};
```

Para agregados: `const { n } = /** @type {CountRow} */ (stmt.get());`.
Tras cada archivo: `npm run typecheck` debe quedar limpio antes del commit.

## Patrón: tipos desde Zod (evita duplicar)

```js
// @ts-check
const { z } = require('zod');

const LoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

/** @typedef {z.infer<typeof LoginSchema>} LoginInput */

/** @param {LoginInput} input */
function login(input) {
  /* input.username / input.password ya están tipados */
}
```

## Checklist por archivo

- [ ] Añadir `// @ts-check` al inicio.
- [ ] Anotar parámetros y retornos con JSDoc (`@param`, `@returns`, `@typedef`).
- [ ] `npm run typecheck` sin errores.
- [ ] `npm run lint && npm test` siguen verdes.
- [ ] Commit pequeño y enfocado (un archivo o un módulo por commit).

## Meta CI (cuando Fase 1 esté estable)

Añadir `npm run typecheck` al workflow `.github/workflows/ci.yml`, en el job `lint-and-test`, después de `lint`.
