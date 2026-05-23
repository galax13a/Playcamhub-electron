/**
 * app.js — Renderer entry point.
 *
 * Boot sequence:
 *   1. Start global error handler (window.onerror → errors.log via IPC)
 *   2. Resolve Express port from IPC and point the API client at it
 *   3. Load settings + app config from the backend (parallel)
 *   4. Write app name + version to the custom title bar
 *   5. Init PluginRegistry (loads enabled plugin front-ends, populates nav + widgets)
 *   6. Load Starcho data (songs, playlists, categories) — only if plugin is active
 *   7. Wire window controls (min/max/close) and mobile sidebar toggle
 *   8. Init Sidebar, Player, Router (in that order — sidebar must be ready before routing)
 *   9. Wire macOS menu shortcuts and auto-updater events
 *  10. Wire global keyboard shortcuts (Space, Ctrl+←/→, Ctrl+F)
 */
import API            from './utils/api.js';
import store          from './store.js';
import PluginRegistry from './core/PluginRegistry.js';
import { initErrorHandler, logError } from './utils/errorHandler.js';

// CSP-compliant global image error handler (replaces inline onerror attributes)
document.addEventListener('error', (e) => {
  const el = e.target;
  if (el.tagName !== 'IMG') return;
  if (el.dataset.err === 'bg') {
    el.style.background = 'var(--bg-3)';
  } else {
    el.style.display = 'none';
  }
}, true);
import EventBus  from './utils/eventBus.js';
import { initRouter } from './router.js';
import { initSidebar } from './components/Sidebar.js';
import { initPlayer  } from './components/Player.js';
import { initModal, showToast } from './components/Modal.js';

async function boot() {
  // Hook window.onerror + unhandledrejection → console + errors.log in userData
  initErrorHandler();

  // 1. Resolve backend port from Electron IPC (auto-increments if busy)
  if (window.electronAPI) {
    const port = await window.electronAPI.getServerPort();
    API.setBase(`http://127.0.0.1:${port}`);
  }

  // 2. Load persisted settings + app config in parallel
  await Promise.all([
    store.loadSettings(),
    store.loadConfig(),
  ]);

  // 3. Show "AppName vX.Y.Z" in the custom title bar — reads from .env via backend config
  const _tb  = document.getElementById('tb-title');
  const _cfg = store.state.appConfig;
  if (_tb) _tb.textContent = `${_cfg.appName || 'StarchoElectron'} v${_cfg.appVersion || '1.0.0'}`;

  // 4. Load plugin front-ends — must happen before Sidebar so nav items are available
  await PluginRegistry.init();

  // 5. Load Starcho-specific store data only when the plugin is active
  if (PluginRegistry.getPlugins().some(p => p.id === 'starcho')) {
    await Promise.all([
      store.loadSongs(),
      store.loadPlaylists(),
      store.loadCategories(),
    ]);
  }

  // 6. Wire window controls (includes mobile hamburger sidebar toggle)
  wireWindowControls();

  // 7. Init global UI components
  initModal();
  initSidebar(document.getElementById('sidebar'));
  initPlayer(document.getElementById('player-bar'));

  // 8. Init router — renders initial view after sidebar is ready
  initRouter();

  // 9. Apply titlebar theme from DB settings (must run before first paint)
  applyTitlebarTheme(store.state.settings?.titlebar_theme);

  // 10. Platform integrations
  if (window.electronAPI) {
    wireMacOSMenu();
    wireUpdaterEvents();
  }

  // 11. Global keyboard shortcuts
  wireKeyboard();

  console.log('StarchoElectron v1.0.2-beta.1 ready 🚀');
}

function wireWindowControls() {
  document.getElementById('btn-minimize')?.addEventListener('click', () =>
    window.electronAPI?.minimize());
  document.getElementById('btn-maximize')?.addEventListener('click', () =>
    window.electronAPI?.maximize());
  document.getElementById('btn-close')?.addEventListener('click', () =>
    window.electronAPI?.close());

  // Mobile hamburger: wires the ☰ button in the title bar to show/hide the sidebar overlay.
  // Only visible at ≤600 px via CSS; on desktop these elements still exist but are hidden.
  const hamburger = document.getElementById('btn-hamburger');
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebar-overlay');
  if (hamburger && sidebar && overlay) {
    const openSidebar  = () => { sidebar.classList.add('mobile-open'); overlay.classList.add('visible'); };
    const closeSidebar = () => { sidebar.classList.remove('mobile-open'); overlay.classList.remove('visible'); };

    hamburger.addEventListener('click', () =>
      sidebar.classList.contains('mobile-open') ? closeSidebar() : openSidebar()
    );
    // Tapping the backdrop dismisses the sidebar
    overlay.addEventListener('click', closeSidebar);
    // Auto-close sidebar after a nav item is tapped on mobile
    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('.nav-item') && window.innerWidth <= 600) closeSidebar();
    });
  }
}

function wireMacOSMenu() {
  const map = {
    'menu:play-pause': () => store.togglePlay(),
    'menu:next':       () => store.nextSong(),
    'menu:prev':       () => store.prevSong(),
    'menu:shuffle':    () => store.setState({ shuffle: !store.state.shuffle }),
    'menu:repeat':     () => {
      const cycle = { none: 'all', all: 'one', one: 'none' };
      store.setState({ repeat: cycle[store.state.repeat] });
    },
    'menu:new-playlist': () => EventBus.emit('modal:new-playlist'),
    'menu:about':        () => EventBus.emit('modal:about'),
  };
  Object.entries(map).forEach(([ch, fn]) => {
    window.electronAPI.onUpdateAvailable && // guard — ipcRenderer.on not exposed directly
    window.addEventListener('electron-menu', e => {
      if (e.detail === ch) fn();
    });
  });
}

// ── Titlebar theme ────────────────────────────────────────────────────────────

/**
 * Reads titlebar_theme from DB settings and applies the data-titlebar attribute.
 * Valid values: 'default' | 'mac' | 'linux' | 'cartoon'
 */
function applyTitlebarTheme(theme) {
  const bar = document.getElementById('title-bar');
  if (!bar) return;
  const valid = ['mac', 'linux', 'cartoon'];
  bar.dataset.titlebar = valid.includes(theme) ? theme : 'default';
}

// ── Auto-updater UI ───────────────────────────────────────────────────────────

/**
 * Wires all updater IPC events to the #update-banner element.
 *
 * Banner states:
 *  - update-available  → slide in, show progress bar, spin icon
 *  - download-progress → update bar width and message
 *  - update-downloaded → swap to "install" state with action buttons
 *  - error             → show a brief toast (banner stays hidden)
 */
function wireUpdaterEvents() {
  const api = window.electronAPI;
  if (!api) return;

  // DOM references
  const banner  = document.getElementById('update-banner');
  const iconEl  = document.getElementById('upd-icon');
  const msgEl   = document.getElementById('upd-msg');
  const barTrack= document.getElementById('upd-bar-track');
  const barFill = document.getElementById('upd-bar-fill');
  const btnsEl  = document.getElementById('upd-btns');
  const closeBtn= document.getElementById('upd-close');

  if (!banner) return;

  /** Slide the banner up into view. */
  function showBanner() { banner.classList.add('upd-visible'); }

  /** Slide the banner back down and hide. */
  function hideBanner() { banner.classList.remove('upd-visible'); }

  /** Switch icon to a static emoji (stops spinner). */
  function setIcon(emoji) {
    iconEl.textContent = emoji;
    iconEl.classList.add('upd-done');
  }

  /** Show the progress bar track. */
  function showBar() { barTrack.classList.add('upd-bar-visible'); }

  /** Hide the progress bar track. */
  function hideBar() { barTrack.classList.remove('upd-bar-visible'); }

  closeBtn?.addEventListener('click', hideBanner);

  // ── New version found — download starting in background ──────────────────
  api.onUpdateAvailable?.((info) => {
    iconEl.textContent = '⬇';
    iconEl.classList.remove('upd-done');
    msgEl.textContent  = `Nueva versión disponible: v${info.version} — descargando en segundo plano…`;
    barFill.style.width = '0%';
    btnsEl.innerHTML   = '';
    showBar();
    showBanner();
  });

  // ── Download progress — update the bar width ──────────────────────────────
  api.onUpdateProgress?.((prog) => {
    const pct = Math.round(prog.percent ?? 0);
    const mb  = prog.transferred ? ` (${(prog.transferred / 1048576).toFixed(1)} MB)` : '';
    msgEl.textContent  = `Descargando actualización… ${pct}%${mb}`;
    barFill.style.width = `${pct}%`;
  });

  // ── Download complete — prompt the user to install ────────────────────────
  api.onUpdateDownloaded?.((info) => {
    setIcon('✅');
    msgEl.textContent = `Actualización v${info.version} lista. Reinicia para aplicar los cambios.`;
    hideBar();

    // Build action buttons (created as DOM nodes to avoid innerHTML script injection)
    btnsEl.innerHTML = '';

    const installBtn = document.createElement('button');
    installBtn.type      = 'button';
    installBtn.className = 'upd-btn-install';
    installBtn.textContent = 'Instalar y reiniciar';
    installBtn.addEventListener('click', () => api.installUpdate());

    const laterBtn = document.createElement('button');
    laterBtn.type      = 'button';
    laterBtn.className = 'upd-btn-later';
    laterBtn.textContent = 'Más tarde';
    laterBtn.addEventListener('click', hideBanner);

    btnsEl.append(installBtn, laterBtn);
    showBanner();

    // Also fire an OS-level notification so the user notices even if the window is minimized
    api.showNotification?.(
      'StarchoElectron',
      `Actualización v${info.version} lista — abre la app para instalar`,
    );
  });

  // ── Updater error — show toast, keep banner hidden ────────────────────────
  api.onUpdaterError?.((msg) => {
    showToast(`Error de actualización: ${msg}`, 'error');
  });
}

function wireKeyboard() {
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        store.togglePlay();
        break;
      case 'ArrowRight':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); store.nextSong(); }
        break;
      case 'ArrowLeft':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); store.prevSong(); }
        break;
      case 'KeyF':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); store.navigate('starcho:youtube'); }
        break;
    }
  });
}

// After successful login, login.js dispatches 'user:login' with the user payload.
// We load the full profile then navigate to the last route the user was on.
window.addEventListener('user:login', async (e) => {
  store.setState({ loggedUser: e.detail });
  await store.loadUserProfile();
  const lastView = (() => { try { return localStorage.getItem('last_view'); } catch (_) { return null; } })();
  store.navigate(lastView || 'home');
});

boot().catch(err => {
  logError(err);
  console.error('StarchoElectron boot failed:', err);
  document.getElementById('app').innerHTML = `
    <div style="color:#fff;background:#0a0a0a;height:100vh;display:flex;align-items:center;
                justify-content:center;font-family:sans-serif;flex-direction:column;gap:16px">
      <h2 style="color:#FF3366">StarchoElectron failed to start</h2>
      <pre style="color:#888;font-size:12px">${err.message}</pre>
    </div>`;
});
