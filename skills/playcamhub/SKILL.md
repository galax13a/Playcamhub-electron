---
name: playcamhub
description: >-
  Project skill for PlaycamHub Studio — an Electron 42 desktop starter kit
  (Express 4 + better-sqlite3 + vanilla JS ES Modules, no bundler, no framework).
  Use whenever working in this repo: adding a feature/plugin, editing the core,
  writing API routes or SQLite migrations, touching IPC, running or adding tests,
  linting/formatting, doing a release/version bump, building installers, or
  continuing the incremental TypeScript migration. Enforces the project's hard
  rules and the dev workflow (test/lint/typecheck/build).
---

# PlaycamHub Studio — project skill

Electron desktop starter kit. Owner: galax13a / botcamdev@gmail.com.
Stack: **Electron 42 · Express 4 (embedded) · better-sqlite3 (sync) · vanilla JS ES Modules**. No bundler, no React, no transpilation. Repo branch: `master`.

## Hard rules (always apply)

1. **Plugin first** — every new feature lives in `plugins/<id>/`. Core = auth/settings/plugin-management only.
2. **No bundler** — native ES Modules + dynamic `import()`. No webpack/vite/rollup.
3. **No frameworks** — vanilla JS, `render*(el, extra)` view pattern.
4. **Explicit IPC** — all main↔renderer through `preload.js` contextBridge. Never `require('electron')` in the renderer.
5. **Synchronous SQLite** — better-sqlite3. No async/await in DB queries.
6. **Idempotent migrations** — see migration system below.
7. **No secrets in code** — everything in `.env`.
8. **DEVTOOLS** — read `process.env.DEVTOOLS === 'true'`, never hardcode.
9. **Language** — replies to the user in Spanish; code and commits in English.
10. **Pagination** — plugin endpoints return `{ items, total, page, perPage }`; frontend uses `Paginator.js`.
11. **git push only when the user explicitly asks in that message.**
12. **Version = single source of truth** — the number in `package.json` is official. README, CLAUDE.md and CHANGELOG must match it on every release.

## Dev workflow (run before committing)

```bash
npm install            # installs runtime + dev deps (vitest, eslint, prettier, typescript)
npm run format         # Prettier write   (check-only: npm run format:check)
npm run lint           # ESLint flat config (fix: npm run lint:fix)
npm test               # Vitest — schemas + migration runner
npm run typecheck      # tsc --noEmit over // @ts-check files (incremental TS)
npm run build          # electron-builder (asar:true + asarUnpack for native mods)
```

Tests live in `tests/`. Add a Vitest test for any new Zod schema and any pure logic module. CI (`.github/workflows/ci.yml`) runs format-check + lint + test on push/PR, then build on Windows/macOS.

## Database migrations (versioned)

Core migrations use an ordered, version-tracked runner:

- `src/backend/database/migrationRunner.js` → `runVersionedMigrations(db, migrations, logFn)`. Applies each migration once, in a transaction, recording the version in `schema_version`. Idempotent on legacy DBs.
- `src/backend/database/migrations.js` → exports `MIGRATIONS` (array of `{ version, name, up(db) }`).

To add a core migration: append a new entry with the next `version`. Keep `up()` idempotent (`CREATE TABLE IF NOT EXISTS`, guarded `ALTER TABLE`). Plugin migrations stay in `plugins/<id>/backend/migrations.js` (`migrate(db)`), also idempotent.

## Release checklist (e.g. bump to x.y.z)

1. `package.json` `version` → x.y.z.
2. Update README badge + `APP_VERSION` env, CLAUDE.md "Estado actual", CHANGELOG.md (new dated entry).
3. `npm run format && npm run lint && npm test && npm run typecheck`.
4. Commit in English; push **only if the user asked**.

## Incremental TypeScript migration

Scaffold is in place: `tsconfig.json` (`noEmit`, `allowJs`, `checkJs:false`, `strict`). A file is type-checked only when it starts with `// @ts-check` (or is renamed `.ts`). Pilot: `src/backend/database/migrationRunner.js`. Full plan: `docs/MIGRATION-TYPESCRIPT.md`. Prefer JSDoc + `// @ts-check` over renaming to `.ts` (keeps the no-bundler rule, esp. in the renderer). Derive types from Zod with `z.infer`.

## Plugin contract & code templates

For full backend + frontend plugin templates (plugin.json, backend index/migrations/routes, frontend index/views with Paginator, IPC channel pattern, shared-component imports, i18n keys, theme variables, admin panel), run the `/starcho` command in `.claude/commands/starcho.md` — it carries the complete, up-to-date scaffolding.

## Key files

| Need | File |
|------|------|
| Add API route | `plugins/<id>/backend/routes/index.js` |
| Add DB table (plugin) | `plugins/<id>/backend/migrations.js` |
| Add core migration | `src/backend/database/migrations.js` (`MIGRATIONS`) |
| Add renderer view | `plugins/<id>/frontend/views/` + register in `frontend/index.js` |
| Add IPC channel | `preload.js` + `src/main/ipcHandlers.js` |
| Zod validation | `src/backend/middleware/validate.js` |
| Pagination | `src/renderer/utils/Paginator.js` |
| HTML/UI helpers | `src/renderer/utils/html.js`, `src/renderer/components/ui.js` |
| Global state | `src/renderer/store.js` |
| Tests | `tests/` (Vitest) |
