import store          from './store.js';
import EventBus        from './utils/eventBus.js';
import PluginRegistry  from './core/PluginRegistry.js';

import { renderDashboard } from './components/Dashboard.js';
import { renderSettings  } from './components/Settings.js';

// ── Core views (always available) ────────────────────────────────────────────
const CORE_VIEWS = {
  dashboard: { el: 'view-dashboard', render: renderDashboard },
  settings:  { el: 'view-settings',  render: renderSettings  },
};

let _current = null;

function showView(name, extra = {}) {
  // Hide all views
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));

  // Plugin view (contains ':')
  if (name.includes(':')) {
    const slot = document.getElementById('view-plugin');
    if (slot) {
      slot.classList.add('active');
      PluginRegistry.renderView(name, slot, extra);
    }
    _current = name;
    _updateSidebarActive(name);
    return;
  }

  // Special: playlist (served by the starcho plugin but triggered via core navigate API)
  if (name === 'playlist') {
    const slot = document.getElementById('view-plugin');
    if (slot) {
      slot.classList.add('active');
      PluginRegistry.renderView('starcho:playlist', slot, extra);
    }
    _current = name;
    _updateSidebarActive(name);
    return;
  }

  // Core view
  const def = CORE_VIEWS[name];
  if (!def) {
    // Fallback to dashboard
    showView('dashboard');
    return;
  }

  const el = document.getElementById(def.el);
  if (el) {
    el.classList.add('active');
    def.render(el, extra);
  }
  _current = name;
  _updateSidebarActive(name);
}

function _updateSidebarActive(name) {
  document.querySelectorAll('.nav-item').forEach(item =>
    item.classList.toggle('active', item.dataset.view === name)
  );
}

export function initRouter() {
  EventBus.on('navigate', ({ view, ...extra }) => showView(view, extra));

  // Re-render active view on language change
  EventBus.on('lang:change', () => {
    if (!_current) return;
    if (_current.includes(':')) {
      const slot = document.getElementById('view-plugin');
      if (slot) PluginRegistry.renderView(_current, slot);
      return;
    }
    const def = CORE_VIEWS[_current];
    if (def) {
      const el = document.getElementById(def.el);
      if (el) def.render(el, {});
    }
  });

  // Start on dashboard
  showView('dashboard');
}
