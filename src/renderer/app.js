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
  initErrorHandler();

  // 1. Get server port from Electron IPC
  if (window.electronAPI) {
    const port = await window.electronAPI.getServerPort();
    API.setBase(`http://127.0.0.1:${port}`);
  }

  // 2. Load persisted settings + app config in parallel
  await Promise.all([
    store.loadSettings(),
    store.loadConfig(),
  ]);

  // Apply APP_TITLE to the title bar
  const _tb = document.getElementById('tb-title');
  if (_tb) _tb.textContent = store.state.appConfig.appTitle || 'StarchoElectron — Dev Platform';

  // 3. Load plugins (frontend) — populates nav items before sidebar renders
  await PluginRegistry.init();

  // 4. Load starcho plugin data only if the plugin is active
  if (PluginRegistry.getPlugins().some(p => p.id === 'starcho')) {
    await Promise.all([
      store.loadSongs(),
      store.loadPlaylists(),
      store.loadCategories(),
    ]);
  }

  // 5. Wire window controls
  wireWindowControls();

  // 6. Init global UI components
  initModal();
  initSidebar(document.getElementById('sidebar'));
  initPlayer(document.getElementById('player-bar'));

  // 7. Init router (renders first view)
  initRouter();

  // 8. Wire menu shortcuts from main process
  if (window.electronAPI) {
    wireMacOSMenu();
    wireUpdaterEvents();
  }

  // 8. Wire global keyboard shortcuts
  wireKeyboard();

  console.log('StarchoElectron v1.0.0 ready 🚀');
}

function wireWindowControls() {
  document.getElementById('btn-minimize')?.addEventListener('click', () =>
    window.electronAPI?.minimize());
  document.getElementById('btn-maximize')?.addEventListener('click', () =>
    window.electronAPI?.maximize());
  document.getElementById('btn-close')?.addEventListener('click', () =>
    window.electronAPI?.close());
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

function wireUpdaterEvents() {
  window.electronAPI?.onUpdateDownloaded?.((info) => {
    showToast(`Update v${info.version} ready — restart to install`, 'info');
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


// After login, login.js dispatches 'user:login' — load user profile then render
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
