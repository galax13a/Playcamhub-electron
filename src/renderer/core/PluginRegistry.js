// ── PluginRegistry ───────────────────────────────────────────────────────────
// Loads every enabled plugin's frontend entry-point (dynamic import),
// collects nav items + view renderers, then signals the app to refresh.

import API      from '../utils/api.js';
import EventBus from '../utils/eventBus.js';

const _plugins   = [];  // loaded plugin manifests (for UI)
const _navItems  = [];  // { view, icon, label } contributed by all plugins
const _views     = {};  // view-key -> async render function

const PluginRegistry = {
  // Called once during app boot after the API is ready
  async init() {
    let list = [];
    try { list = await API.plugins.list(); }
    catch (_) { return; }  // graceful degradation if API is unreachable

    for (const meta of list) {
      if (!meta.enabled) continue;
      try {
        // Dynamic import from the plugin's frontend entry relative to project root
        const mod = await import(`../../../plugins/${meta.id}/frontend/index.js`);
        const plugin = mod.default || mod;

        if (typeof plugin.onLoad === 'function') plugin.onLoad();

        // Collect nav items
        if (Array.isArray(plugin.navItems)) {
          _navItems.push(...plugin.navItems);
        }

        // Collect view renderers
        if (plugin.views && typeof plugin.views === 'object') {
          Object.assign(_views, plugin.views);
        }

        _plugins.push({ ...meta, _plugin: plugin });
      } catch (err) {
        console.warn(`[PluginRegistry] Failed to load frontend for "${meta.id}":`, err);
      }
    }

    // Notify sidebar and router that plugins are ready
    EventBus.emit('plugins:ready', { navItems: _navItems });
  },

  // Render a plugin view into a DOM element
  async renderView(viewKey, el, extra = {}) {
    const renderer = _views[viewKey];
    if (!renderer) {
      el.innerHTML = `<div style="padding:40px;color:var(--text-muted);text-align:center">
        <p>Vista no encontrada: <code>${viewKey}</code></p>
      </div>`;
      return;
    }
    try { await renderer(el, extra); }
    catch (err) { console.error(`[PluginRegistry] Error rendering "${viewKey}":`, err); }
  },

  getNavItems()  { return _navItems; },
  getPlugins()   { return _plugins; },
  hasView(key)   { return key in _views; },
};

export default PluginRegistry;
