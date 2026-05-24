'use strict';
/**
 * Sidebar — Left navigation panel.
 *
 * Responsibilities:
 *  - Renders the app logo, plugin nav items, settings link, and user footer.
 *  - Translates nav labels live via i18n (responds to 'lang:change').
 *  - Supports collapsible icon-only mode persisted to localStorage.
 *  - On mobile (≤600 px) the sidebar becomes a fixed overlay toggled by
 *    the hamburger button in the title bar.
 *
 * State machine:
 *   expanded ↔ collapsed   (toggled by #sb-collapse-btn, key: 'sb_collapsed')
 *   CSS class .sidebar--collapsed drives all visual changes via main.css.
 */
import store           from '../store.js';
import EventBus        from '../utils/eventBus.js';
import PluginRegistry  from '../core/PluginRegistry.js';
import API             from '../utils/api.js';
import { openProfileModal } from './Modal.js';
import { t } from '../utils/i18n.js';

const DEFAULT_AVATAR = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='%23333'/><circle cx='32' cy='24' r='12' fill='%23666'/><ellipse cx='32' cy='56' rx='20' ry='14' fill='%23666'/></svg>`;

// Module-level so these survive _rebuild() which wipes innerHTML
let _el              = null;
let _collapsed       = false;
let _multimediaOpen  = true;

export function initSidebar(el) {
  _el = el;

  // Restore collapse preferences from previous session
  _collapsed      = localStorage.getItem('sb_collapsed') === '1';
  _multimediaOpen = localStorage.getItem('ng_multimedia') !== '0';

  _rebuild(el);

  // Re-render when view changes (to update active highlight)
  EventBus.on('store:currentView', () => _highlightActive(el));

  // Re-render when plugins load or language changes
  // — this is what makes nav labels switch language without a page reload
  EventBus.on('plugins:ready', () => _rebuild(el));
  EventBus.on('lang:change',   () => _rebuild(el));

  // Lightweight avatar/name patch — avoids a full rebuild on profile save
  EventBus.on('store:settings', (s) => {
    const avatarEl = el.querySelector('.sb-avatar');
    const nameEl   = el.querySelector('.sb-nickname');
    if (avatarEl) avatarEl.src = s.avatar || DEFAULT_AVATAR;
    if (nameEl)   nameEl.textContent = s.nickname || s.full_name || store.state.loggedUser?.username || 'You';
  });

  EventBus.on('store:loggedUser', () => _rebuild(el));
}

// Full re-render; re-applies collapsed class because innerHTML wipes element classes
function _rebuild(el) {
  el.innerHTML = _html(store.state.settings || {});
  if (_collapsed) el.classList.add('sidebar--collapsed');
  _bind(el);
  _highlightActive(el);
}

function _highlightActive(el) {
  const cur = store.state.currentView;
  el.querySelectorAll('.nav-item').forEach(item =>
    item.classList.toggle('active', item.dataset.view === cur)
  );
}

// Toggle sidebar between expanded and icon-only collapsed mode
function _toggleCollapse(el) {
  _collapsed = !_collapsed;
  localStorage.setItem('sb_collapsed', _collapsed ? '1' : '0');
  el.classList.toggle('sidebar--collapsed', _collapsed);

  // Update button arrow without rebuilding; t() resolves to current language
  const btn = el.querySelector('#sb-collapse-btn');
  if (btn) {
    btn.title     = _collapsed ? t('sidebar_expand') : t('sidebar_collapse');
    btn.innerHTML = _collapsed ? '›' : '‹';
  }
}

/**
 * Build a single nav anchor.
 * labelKey → i18n lookup (updates when language changes via _rebuild).
 * Falls back to n.label for items that don't carry a key (legacy compat).
 */
function _navItem(n, cur) {
  const label = n.labelKey ? t(n.labelKey) : (n.label || '');
  return `<a class="nav-item${cur === n.view ? ' active' : ''}" data-view="${n.view}" role="button" tabindex="0">
    <span class="nav-icon">${n.icon}</span><span class="nav-label">${label}</span>
  </a>`;
}

/** Build a sub-item anchor (indented, used inside a nav-group). */
function _navSubItem(n, cur) {
  const label = n.labelKey ? t(n.labelKey) : (n.label || '');
  return `<a class="nav-item nav-sub-item${cur === n.view ? ' active' : ''}" data-view="${n.view}" role="button" tabindex="0">
    <span class="nav-icon">${n.icon}</span><span class="nav-label">${label}</span>
  </a>`;
}

/** Toggle the multimedia group open/closed and persist to localStorage. */
function _toggleGroup(el) {
  _multimediaOpen = !_multimediaOpen;
  localStorage.setItem('ng_multimedia', _multimediaOpen ? '1' : '0');
  const group = el.querySelector('#ng-multimedia');
  if (group) group.classList.toggle('open', _multimediaOpen);
}

// Build full sidebar HTML from current store + plugin state
function _html(s = {}) {
  const cfg         = store.state.appConfig;
  const loggedUser  = store.state.loggedUser;
  const displayName = s.nickname || s.full_name || loggedUser?.username || 'You';
  const pluginNav   = PluginRegistry.getNavItems();
  const cur         = store.state.currentView;

  // Starcho (multimedia) items shown as a collapsible group; all others below as "Modules"
  const musicItems  = pluginNav.filter(n => n.view.startsWith('starcho:'));
  const moduleItems = pluginNav.filter(n => !n.view.startsWith('starcho:'));

  const multimediaGroupHtml = musicItems.length ? `
    <div class="nav-group${_multimediaOpen ? ' open' : ''}" id="ng-multimedia">
      <div class="nav-group-header" id="ng-multimedia-hdr" role="button" tabindex="0">
        <span class="nav-icon">🎬</span>
        <span class="nav-label">${t('nav_multimedia')}</span>
        <span class="nav-group-arrow">▾</span>
      </div>
      <div class="nav-group-items">
        ${musicItems.map(n => _navSubItem(n, cur)).join('')}
      </div>
    </div>` : '';

  const modulesHtml = moduleItems.length
    ? `<div class="nav-section-label">${t('nav_modules')}</div>
       ${moduleItems.map(n => _navItem(n, cur)).join('')}`
    : '';

  // Arrow icon reflects current state so it's correct after a _rebuild triggered by lang:change
  const collapseTitle = _collapsed ? t('sidebar_expand') : t('sidebar_collapse');
  const collapseIcon  = _collapsed ? '›' : '‹';

  return `
    <div class="sidebar-logo">
      <svg class="logo-svg" width="30" height="30" viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stop-color="#00D2FF"/>
            <stop offset="100%" stop-color="#7B2FBE"/>
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="15" fill="url(#lg1)"/>
        <circle cx="16" cy="16" r="3.5" fill="white"/>
        <ellipse cx="16" cy="16" rx="11" ry="4.5" stroke="white" stroke-width="1.8" fill="none"/>
        <ellipse cx="16" cy="16" rx="11" ry="4.5" stroke="white" stroke-width="1.8" fill="none" transform="rotate(60 16 16)"/>
        <ellipse cx="16" cy="16" rx="11" ry="4.5" stroke="white" stroke-width="1.8" fill="none" transform="rotate(-60 16 16)"/>
      </svg>
      <div class="logo-text-group">
        <span class="logo-text">${cfg.appName}</span>
        <span class="logo-slogan">${cfg.logoText || cfg.appSlogan}</span>
      </div>
      <!-- Collapse toggle: ‹ collapse / › expand -->
      <button class="sb-collapse-btn" id="sb-collapse-btn" title="${collapseTitle}">${collapseIcon}</button>
    </div>

    <nav class="sidebar-nav" id="sidebar-nav">
      ${_navItem({ view: 'home', icon: '🏠', labelKey: 'nav_home' }, cur)}
      ${multimediaGroupHtml ? `<div class="nav-separator"></div>${multimediaGroupHtml}` : ''}
      ${modulesHtml ? `<div class="nav-separator"></div>${modulesHtml}` : ''}
      <div class="nav-separator"></div>
      ${_navItem({ view: 'settings', icon: '⚙️', labelKey: 'nav_settings' }, cur)}
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-user" id="sidebar-user">
        <img class="sb-avatar" src="${s.avatar || DEFAULT_AVATAR}" alt="avatar">
        <div class="sb-user-info">
          <div class="sb-nickname">${displayName}</div>
        </div>
        <button class="sb-logout-icon-btn" id="btn-logout" title="Cerrar sesión">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </div>`;
}

function _bind(el) {
  // Each nav item navigates to its view
  el.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => store.navigate(item.dataset.view));
  });

  el.querySelector('#sb-collapse-btn')?.addEventListener('click', () => _toggleCollapse(el));
  el.querySelector('#ng-multimedia-hdr')?.addEventListener('click', () => _toggleGroup(el));

  // User row opens profile modal; stops before reaching the logout button
  el.querySelector('#sidebar-user')?.addEventListener('click', (e) => {
    if (e.target.closest('#btn-logout')) return;
    openProfileModal();
  });

  el.querySelector('#btn-logout')?.addEventListener('click', (e) => {
    e.stopPropagation();
    // Clear all stored session data so auto-login does not fire after reload
    try { localStorage.removeItem('auth_session');   } catch (_) {}
    try { sessionStorage.removeItem('auth_session'); } catch (_) {}
    try { localStorage.removeItem('auth_remember');  } catch (_) {}
    window.playcamAuthToken = null;
    API.setAuthToken(null);
    location.reload();
  });
}
