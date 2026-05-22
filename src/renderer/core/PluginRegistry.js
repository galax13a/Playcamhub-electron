/**
 * PluginRegistry — Frontend plugin loader and registry.
 *
 * Collects nav items, view renderers, dashboard widgets, and config schemas
 * from every enabled plugin's frontend entry-point (dynamic import).
 * Broadcasts 'plugins:ready' so sidebar and router can refresh.
 */
import API      from '../utils/api.js';
import EventBus from '../utils/eventBus.js';

const _plugins          = []; // loaded plugin manifests for UI queries
const _navItems         = []; // { view, icon, label } from all plugins
const _views            = {}; // view-key → async render(el, extra) function
const _dashboardWidgets = []; // { id, zone, priority, title, render, pluginId }

const PluginRegistry = {

  /** Called once during boot after the API is ready. */
  async init() {
    let list = [];
    try { list = await API.plugins.list(); }
    catch (_) { return; } // graceful degradation if API is unreachable

    for (const meta of list) {
      if (!meta.enabled) continue;
      try {
        const mod    = await import(`../../../plugins/${meta.id}/frontend/index.js`);
        const plugin = mod.default || mod;

        if (typeof plugin.onLoad === 'function') plugin.onLoad();

        // Nav items contributed to the sidebar
        if (Array.isArray(plugin.navItems)) {
          _navItems.push(...plugin.navItems);
        }

        // View renderers for the router
        if (plugin.views && typeof plugin.views === 'object') {
          Object.assign(_views, plugin.views);
        }

        // Dashboard widgets — each plugin declares which zones it fills
        if (Array.isArray(plugin.dashboardWidgets)) {
          for (const w of plugin.dashboardWidgets) {
            _dashboardWidgets.push({ ...w, pluginId: meta.id });
          }
        }

        _plugins.push({ ...meta, _plugin: plugin });
      } catch (err) {
        console.warn(`[PluginRegistry] Failed to load frontend for "${meta.id}":`, err);
      }
    }

    EventBus.emit('plugins:ready', { navItems: _navItems });
  },

  /** Render a registered plugin view into an element. */
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

  /**
   * Render all registered dashboard widgets for a zone into a container.
   * Widgets are inserted in priority order (highest first).
   * Each widget gets an isolated wrapper div with a loading state while async.
   *
   * @param {'header'|'content'|'sidebar-panel'} zone
   * @param {HTMLElement} container
   */
  async renderDashboardZone(zone, container) {
    const widgets = _dashboardWidgets
      .filter(w => w.zone === zone)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    container.innerHTML = '';

    for (const w of widgets) {
      const wrap = document.createElement('div');
      wrap.className   = `dash-widget dash-widget--${zone}`;
      wrap.dataset.wid = w.id;
      wrap.innerHTML   = `
        <div class="dash-widget-hdr">
          <span class="dash-widget-title">${w.title || w.id}</span>
        </div>
        <div class="dash-widget-body">
          <div class="dash-widget-loading">Cargando…</div>
        </div>`;
      container.appendChild(wrap);

      const bodyEl = wrap.querySelector('.dash-widget-body');
      try {
        await w.render(bodyEl);
      } catch (err) {
        console.warn(`[PluginRegistry] Widget "${w.id}" render error:`, err);
        bodyEl.innerHTML = `<div class="dash-widget-empty">Error al cargar módulo</div>`;
      }
    }

    if (widgets.length === 0) {
      container.innerHTML = `<div class="dash-widget-empty">Sin módulos activos en esta zona</div>`;
    }
  },

  getNavItems()  { return _navItems; },
  getPlugins()   { return _plugins; },
  hasView(key)   { return key in _views; },

  /** Returns widgets for a given zone (all zones if omitted), sorted by priority. */
  getDashboardWidgets(zone) {
    return _dashboardWidgets
      .filter(w => !zone || w.zone === zone)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  },
};

export default PluginRegistry;
