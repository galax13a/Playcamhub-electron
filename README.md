# PlaycamHub Studio

Desktop app for content creators — music player, multimedia manager, and productivity tools built with Electron.

![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![Version](https://img.shields.io/badge/version-1.0.3-orange)

---

## Features

### Music Player
- Library with grid and list views, waveform animation on the now-playing row
- TikTok-style vertical swipe player with auto-play on scroll and spinning vinyl cover
- YouTube search + audio download via yt-dlp (auto-installs on first run)
- Download queue with real-time progress (Server-Sent Events)
- Playlists, favorites, and category system with custom colors and icons
- Shuffle, repeat (none / all / one / library-random) modes
- Keyboard shortcuts: `Space` play/pause · `Ctrl+←/→` prev/next · `Ctrl+F` search

### MediaHub Plugin — Photos & Videos
- Upload photos (auto-converted to WebP) and videos up to 500 MB
- Gallery with type filter, favorites, text search, and album filter
- Album management with cover image and description
- **Photo Editor** — full non-destructive editor:
  - **Transform**: rotate left/right/180°, resize by width + height with aspect-ratio lock
  - **Crop**: interactive drag-to-select with 8 resize handles (corners + edges) and aspect-ratio presets (1:1, 4:3, 16:9, 9:16)
  - **Effects**: brightness, contrast, saturation, blur, sharpen sliders + grayscale/invert toggles — live CSS preview before saving
- **Video Viewer** — native `<video>` player with metadata panel
- Thumbnail generation (300×300 WebP) on upload
- All image edits applied server-side via Sharp; output always saved to a new UUID file (avoids Windows file-locking)

### Productivity Plugins
| Plugin | Description |
|--------|-------------|
| **Contacts** | Personal and business contacts with notes and tags |
| **Notes** | Color-coded notes with important dates and collapse/expand |
| **Tasks** | Task manager with priorities, statuses, and due dates |

### Platform & UI
- 12 UI themes + 4 titlebar styles (default / Mac / Linux / Cartoon)
- Collapsible sidebar with icon-only mode, persisted per session
- i18n — language switching (EN / ES / PT) without page reload
- Custom frameless window with traffic-light controls
- Auto-updater via GitHub Releases with download progress banner
- Admin panel at `/admin` (SSR, CSRF, rate limiting, dev log)
- Token-based auth with session persistence (remember me / 7-day tokens)

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Shell | Electron 28 |
| Backend | Express 4 (embedded, auto-port) |
| Database | better-sqlite3 (synchronous SQLite) |
| Frontend | Vanilla JS ES Modules — no bundler, no React |
| Image processing | Sharp |
| Video download | yt-dlp-wrap + fluent-ffmpeg |
| Validation | Zod |

---

## Getting Started

### Prerequisites
- Node.js ≥ 22
- npm

### Install & run

```bash
git clone https://github.com/galax13a/Playcamhub-electron.git
cd Playcamhub-electron
npm install
npm start
```

### Development mode (DevTools open)

```bash
# macOS / Linux
DEVTOOLS=true npm start

# Windows PowerShell
$env:DEVTOOLS="true"; npm start
```

### Build installers

```bash
npm run build:win   # Windows NSIS (.exe)
npm run build:mac   # macOS DMG + ZIP
npm run build       # current platform
```

> **Note:** `better-sqlite3` is a native module and must be rebuilt for your Electron version.  
> Run `npm run rebuild` if you see a native module error after switching Electron versions.

---

## Project Structure

```
playcamhub-studio/
├── main.js                     # Electron main process
├── preload.js                  # contextBridge API surface
├── src/
│   ├── backend/
│   │   ├── routes/             # Core API routes (auth, settings, config, media, albums)
│   │   ├── controllers/        # Business logic
│   │   ├── middleware/         # Auth guard, Zod validation, rate limiting
│   │   ├── database/           # SQLite connection + core migrations
│   │   └── admin/              # SSR admin panel (CSRF + rate limiting)
│   └── renderer/
│       ├── app.js              # Boot sequence & event wiring
│       ├── store.js            # Reactive global state (setState + EventBus)
│       ├── router.js           # Client-side view router
│       ├── core/PluginRegistry.js
│       ├── components/         # Sidebar, Player, Modal, Settings, Dashboard, ui helpers
│       ├── utils/              # API client, EventBus, i18n, Paginator, html helpers
│       └── styles/             # CSS themes (12 UI + 4 titlebar)
└── plugins/
    ├── starcho/                # MediaHub — photos, videos, albums, editor
    ├── contacts/               # Contacts manager
    ├── notes/                  # Notes with colors and dates
    └── tasks/                  # Task manager with priorities
```

---

## Plugin Architecture

Every feature lives in its own plugin folder. Core = auth, settings, plugin management only.

```
plugins/<id>/
├── plugin.json          # id, name, version, description, icon, color
├── backend/
│   ├── routes/index.js  # Express router — mounted at /api/<id>/
│   └── migrations.js    # Idempotent SQLite migrations (CREATE IF NOT EXISTS)
└── frontend/
    ├── index.js         # Registers nav items + view renderers with PluginRegistry
    └── views/           # render*(el, extra) functions — one file per view
```

---

## Environment Variables

Copy `.env.example` to `.env`:

```env
PORT=3025              # Express port (auto-increments if busy)
DEVTOOLS=false         # Open Electron DevTools on start
JWT_SECRET=changeme    # Token signing secret — change in production
ADMIN_USER=admin       # Admin panel username
ADMIN_PASS=changeme    # Admin panel password
APP_NAME=PlaycamHub Studio
APP_VERSION=1.0.3
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play / Pause |
| `Ctrl + →` | Next track |
| `Ctrl + ←` | Previous track |
| `Ctrl + F` | Open YouTube search |

---

## Changelog

### v1.0.3 — 2026-05-24
- **Advanced Photo Editor**: rotate, resize (W+H with aspect lock), interactive crop with 8 handles + aspect presets (1:1, 4:3, 16:9, 9:16), effects panel (brightness, contrast, saturation, blur, sharpen, grayscale, invert) with live CSS preview
- **MediaHub**: album creation and filtering in gallery; token-based `<img>` URLs for authenticated thumbnails
- **Fix**: image edits now write to a new UUID file instead of overwriting the original — eliminates Windows EPERM file-locking errors
- **Fix**: `POST /api/settings` 401 on boot — `applyTheme` no longer writes to DB before user is logged in
- **Fix**: logout now clears all session keys; auto-login no longer fires after signing out
- **Fix**: `PluginRegistry.reset()` before `init()` prevents double nav registration on re-login

### v1.0.2-beta.1
- Universal paginator (`Paginator.js`) for all plugins
- Real disk usage in Dashboard via IPC
- Live clock in Dashboard

### v1.0.1-beta.1
- Auto-updater with download progress banner and install buttons
- Titlebar themes: mac, linux, cartoon
- Admin panel `/admin` with CSRF, rate limiting, dev log

### v1.0.0
- Initial release: music player, YouTube downloader, playlists, favorites, 12 themes, i18n, auto-updater

---

## License

MIT © PlaycamHub Dev — [botcamdev@gmail.com](mailto:botcamdev@gmail.com)
