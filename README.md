# PlayRyu — Music Player

> A Spotify + TikTok hybrid desktop music player — search, download from YouTube, organize and vibe.

Built with Electron, Express, SQLite, and vanilla JavaScript. No bundlers, no frameworks, no React.

---

## Features

| Feature | Description |
|---------|-------------|
| Music Library | Grid & list views with search, category filters, and animated waveform |
| TikTok Mode | Vertical scroll-snap player — songs auto-play as you swipe, vinyl cover spins |
| YouTube Download | Search YouTube and download audio (MP3) or video (MP4) — no ffmpeg needed |
| Download Queue | Live download queue with progress bar per item, cancel, and clear-finished |
| Playlists | Create, edit, reorder, and delete playlists |
| Favorites | Heart any song for instant access |
| Categories | Tag songs (Pop, Rock, Lo-Fi…) with custom color and emoji icon |
| 10 Themes | Dark, Light, Matrix, Winamp, Rick & Morty, Kick, Pink, Red, Military, Arcade |
| 3 Languages | English, Español, Português — persisted across sessions |
| User Profile | Avatar (128 px canvas resize), name, nickname, email, WhatsApp |
| Library Export / Import | Full JSON export; import re-creates songs and queues re-downloads |
| Mini Player | 3 sizes: Mini (270×88), Compact (330×200), Footer bar (full-width) — always on top, theme-synced |
| Video Panel | Floating resizable video window when playing video files |
| Auto-updater | Checks GitHub Releases on launch and installs in one click |
| Plugin System | WordPress-style plugin architecture — PlayRyu ships as a built-in plugin |

---

## Mini Player

The mini player opens as a separate always-on-top window and cycles through three sizes:

| Size | Label | Dimensions | Description |
|------|-------|-----------|-------------|
| Mini | M1 | 270 × 88 px | Drag bar + controls only |
| Compact | M2 | 330 × 200 px | Vinyl disc, track info, progress, controls |
| Footer | FU | Full-width × 196 px | Pinned to bottom of screen — horizontal bar layout with visualizer |

Features:
- Spinning vinyl disc with album art
- Audio visualizer (bar graph, real-time when connected to audio source)
- Queue panel with A-Z sort toggle
- Playlists panel
- Video hide/show toggle (visible when playing a video file)
- Theme-synced — follows the main app theme in real time
- App icon in drag bar, minimize and close buttons

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop shell | Electron 28 (frameless window, custom title bar) |
| Backend API | Node.js + Express (localhost REST on port 3847, auto-increments) |
| Database | SQLite via better-sqlite3 — WAL mode, foreign keys, idempotent migrations |
| YouTube engine | yt-dlp — auto-downloaded on first run, no system install needed |
| Frontend | Vanilla JS ES Modules (no bundler, no React) |
| Styling | CSS Custom Properties — 10 built-in themes via `data-theme` attribute |
| i18n | `src/renderer/utils/i18n.js` — `t(key)`, `setLang()`, `LANGUAGES` exports |
| Plugin system | Core + plugin split; plugins self-register routes onto the Express API router |

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- **Windows**: Visual Studio Build Tools (for better-sqlite3 native module)
- **macOS**: Xcode Command Line Tools — `xcode-select --install`

### Install & Run

```bash
git clone https://github.com/galax13a/StarchoElectron.git
cd StarchoElectron
npm install
npm run rebuild
npm run dev
```

### Build Installer

```bash
npm run build:win    # Windows NSIS .exe
npm run build:mac    # macOS .dmg + .zip
npm run build        # Both platforms
```

Output goes to `dist/`.

---

## Project Structure

```
StarchoElectron/
├── main.js                     # Electron entry — boots app, starts Express, wires IPC
├── preload.js                  # Context bridge — exposes electronAPI to renderer
├── .env                        # Optional overrides (PORT, DEVTOOLS, APP_ID)
├── src/
│   ├── main/                   # Electron main-process helpers
│   │   ├── windowManager.js    # BrowserWindow creation & frameless controls
│   │   ├── ipcHandlers.js      # IPC channel registration (includes mini-player IPC)
│   │   ├── menuBuilder.js      # Native app menu
│   │   └── updater.js          # electron-updater integration
│   ├── backend/                # Express REST API (MVC)
│   │   ├── server.js           # Express setup, static routes, icon endpoint, port finder
│   │   ├── database/
│   │   │   ├── connection.js   # SQLite singleton (WAL mode)
│   │   │   └── migrations.js   # Idempotent schema migrations — runs on every startup
│   │   ├── models/             # Song, Playlist, Category, Settings, DownloadQueue, History
│   │   ├── controllers/        # Business logic per resource + downloadController.js
│   │   └── routes/             # REST route definitions
│   └── renderer/               # Frontend (vanilla JS ES Modules)
│       ├── index.html          # Single-page shell loaded via loadFile()
│       ├── mini-player.html    # Mini player window (3-size, theme-aware)
│       ├── mini-player.js      # Mini player logic — state sync, visualizer, size cycling
│       ├── app.js              # Boot sequence — fetches port, mounts components
│       ├── router.js           # Client-side hash router
│       ├── store.js            # Reactive global state
│       ├── components/         # Library, Player, Sidebar, TikTokFeed, Search, Settings…
│       ├── utils/
│       │   ├── api.js          # Fetch helpers (songs, playlists, downloads, settings…)
│       │   ├── i18n.js         # Translation system (EN / ES / PT)
│       │   ├── eventBus.js     # In-page pub/sub
│       │   └── formatters.js   # Duration, file-size, date helpers
│       └── styles/
│           ├── main.css        # Base styles + component styles
│           ├── animations.css  # Keyframe animations
│           └── themes/         # 10 theme CSS files (dark, light, matrix, winamp…)
├── plugins/
│   └── playryu/                # PlayRyu plugin (music player frontend + routes)
│       ├── frontend/           # Plugin UI components registered via PluginManager
│       └── backend/            # Plugin-specific Express routes
├── assets/                     # Icons (.ico, .icns, .png) and static images
└── scripts/                    # Build/utility scripts
```

---

## Architecture

The HTML shell is loaded via `loadFile()` — Express does NOT serve it. The renderer discovers the API port through IPC, then makes normal `fetch()` calls.

```
Renderer (index.html / mini-player.html)
  └─ window.electronAPI.getServerPort()  ← IPC
         │
         ▼
  http://127.0.0.1:PORT/api/*   ← Express (main process)
         │
         ▼
  SQLite  +  yt-dlp  +  file system
  (playryu.db, music/, thumbnails/, bin/)
```

### Mini Player IPC Flow

```
Main Renderer (Player.js)
  └─ electronAPI.updateMiniPlayerState(state)
         │  IPC: mini-player:state-update
         ▼
  ipcHandlers.js → mini-player window
         │  IPC: mini-player:state
         ▼
  mini-player.js → render UI

Mini Player → electronAPI.miniPlayerControl(action, value)
         │  IPC: mini-player:control
         ▼
  ipcHandlers.js → main window
         │  IPC: mini-player:control
         ▼
  Player.js (store.togglePlay, nextSong, seek…)
```

---

## REST API Reference

The local server runs at `http://127.0.0.1:PORT/api/`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /songs | List songs (filter: category, search, favorite) |
| GET | /songs/recent | Recently added songs |
| GET | /songs/favorites | Favorited songs |
| PUT | /songs/:id | Update song metadata |
| DELETE | /songs/:id | Delete song + file from disk |
| POST | /songs/:id/favorite | Toggle favorite flag |
| POST | /songs/:id/thumbnail | Replace thumbnail |
| GET | /playlists | List all playlists |
| POST | /playlists | Create playlist |
| PUT | /playlists/:id | Rename / update playlist |
| DELETE | /playlists/:id | Delete playlist (id=1 Favorites is protected) |
| GET | /playlists/:id/songs | Songs in a playlist |
| POST | /playlists/:id/songs | Add song to playlist |
| DELETE | /playlists/:id/songs/:songId | Remove song from playlist |
| GET | /categories | List categories |
| POST | /categories | Create category |
| PUT | /categories/:id | Update category |
| DELETE | /categories/:id | Delete category |
| GET | /download-queue | Download queue (status, progress per item) |
| POST | /download-queue | Add URL to download queue (format: mp3 or video) |
| DELETE | /download-queue/clear | Clear finished downloads |
| DELETE | /download-queue/:id | Cancel and remove a download |
| GET | /settings | Get all settings |
| POST | /settings | Bulk-update settings |
| GET | /library/export | Export full library as JSON |
| POST | /library/import | Import library JSON |
| GET | /icon.png | App icon (used by mini player header) |

---

## Data Storage

All user data lives in Electron userData — never touches the install folder.

- **Windows**: `%APPDATA%\PlayRyu\PlayRyu\`
- **macOS**: `~/Library/Application Support/PlayRyu/PlayRyu/`

Contents: `playryu.db`, `music/`, `thumbnails/`, `bin/yt-dlp[.exe]`

---

## Environment Variables (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3847 | Express API port (auto-increments if busy) |
| APP_ID | com.playryu.app | Windows App User Model ID |
| DEVTOOLS | false | Set to `true` to open DevTools on launch |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| Ctrl + Right | Next track |
| Ctrl + Left | Previous track |
| Ctrl + F | Focus search |
| Ctrl + T | Toggle TikTok mode |

---

## Plugin System

Plugins live in `plugins/<name>/`. Each plugin exports a manifest and optionally registers:
- **Backend routes** onto the shared Express API router
- **Frontend components** (nav items, pages) via `PluginManager.activate()`

The built-in `playryu` plugin contains the full music player UI and its API routes.

---

## License

MIT © 2024 PlayRyu
