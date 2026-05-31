# Changelog

All notable changes to PlaycamHub Studio will be documented in this file.

## [Unreleased]

### Changed
- **Electron 28 → 42.3.0** (Chromium 148, Node 24) — Electron 28 reached end-of-life; 42.x is a supported release line
- Toolchain bumped for Electron 42 / Node 24 ABI compatibility: `electron-builder` 24 → 26, `@electron/rebuild` 3.6 → 4, `better-sqlite3` 9 → 12 (Electron 42 prebuilds)
- Auto-updater stack aligned with electron-builder 26: `electron-updater` 6.1 → 6.3+, `electron-log` 5.1 → 5.2+ (matching metadata/blockmap format)

### Fixed
- Auto-updater feed: `build.publish.repo` corrected `PlaycamHub-Studio` → `Playcamhub-electron` so update metadata is fetched from the actual releases repo (was a 404)

### Migration notes
- Run `npm install` then `npm run rebuild` to rebuild native modules (better-sqlite3, sharp) against the Electron 42 ABI
- Smoke-test the preload bridge: prod uses `sandbox: true`, so verify `window.electronAPI` and the embedded Express server still work after the upgrade

## [1.0.4] — 2026-05-28

### Added
- Vitest test suite covering Zod validation schemas and the database migration runner
- ESLint (flat config) + Prettier for consistent code style
- GitHub Actions CI workflow: lint + test + build on push and pull request
- Versioned, ordered schema migrations tracked in the `schema_version` table
- Incremental TypeScript scaffolding: `tsconfig.json` (type-check only, opt-in via `// @ts-check`), `npm run typecheck`, and a step-by-step plan in `docs/MIGRATION-TYPESCRIPT.md`
- Shared type contracts in `src/types/`: `global.d.ts` (IPC `window.electronAPI` surface), `plugin.d.ts` (plugin manifest/backend/frontend + `Paginated<T>`), `db.d.ts` (row shapes for every SQLite table)
- Type-checked (`// @ts-check`) backend validation schemas with `z.infer` typedefs (auth, songs, contacts)
- Project skill `skills/playcamhub/SKILL.md` documenting hard rules, dev workflow, migration system, and release checklist

### Changed
- `asar: true` enabled in electron-builder with `asarUnpack` for native modules (better-sqlite3, sharp, ffmpeg-static, yt-dlp) — application source is no longer shipped unpacked
- Unified version number to 1.0.4 across package.json, README, and CLAUDE.md

## [1.0.0] — 2024-01-01

### Added
- Initial release of PlaycamHub Studio
- Music library with grid and list views
- TikTok-style vertical swipe player with auto-play on scroll
- YouTube search and audio download via yt-dlp
- SQLite database (songs, playlists, categories, settings, download queue)
- Playlist management (create, edit, delete, reorder songs)
- Favorites system (heart toggle on any song)
- Category system with custom colors and icons (Pop, Rock, Hip-Hop, Electronic, Jazz, Classical, Reggaeton, Lo-Fi)
- Dark and light themes with smooth transition
- Persistent settings (volume, quality, format, theme)
- Custom frameless window with macOS-style traffic-light controls
- Auto-updater via GitHub Releases
- Keyboard shortcuts (Space, Ctrl+Left/Right, Ctrl+F, Ctrl+T)
- Context menu on every song (play, favorite, add to playlist, edit, delete)
- Download queue with real-time progress tracking (SSE)
- Search — local library filter + YouTube search in same view
- Waveform animation on now-playing rows
- Vinyl spinning cover in TikTok mode
- Background download with yt-dlp auto-install on first run
- Windows (NSIS) and macOS (DMG/ZIP) installers
