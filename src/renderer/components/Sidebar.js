'use strict';
import store           from '../store.js';
import EventBus        from '../utils/eventBus.js';
import PluginRegistry  from '../core/PluginRegistry.js';
import { openProfileModal } from './Modal.js';

const DEFAULT_AVATAR = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='%23333'/><circle cx='32' cy='24' r='12' fill='%23666'/><ellipse cx='32' cy='56' rx='20' ry='14' fill='%23666'/></svg>`;

let _el = null;

export function initSidebar(el) {
  _el = el;
  _rebuild(el);

  EventBus.on('store:currentView', () => _highlightActive(el));
  EventBus.on('plugins:ready',     () => _rebuild(el));
  EventBus.on('lang:change',       () => _rebuild(el));

  EventBus.on('store:settings', (s) => {
    const avatarEl = el.querySelector('.sb-avatar');
    const nameEl   = el.querySelector('.sb-nickname');
    if (avatarEl) avatarEl.src = s.avatar || DEFAULT_AVATAR;
    if (nameEl)   nameEl.textContent = s.nickname || s.full_name || store.state.loggedUser?.username || 'You';
  });

  EventBus.on('store:loggedUser', () => _rebuild(el));
}

function _rebuild(el) {
  el.innerHTML = _html(store.state.settings || {});
  _bind(el);
  _highlightActive(el);
}

function _highlightActive(el) {
  const cur = store.state.currentView;
  el.querySelectorAll('.nav-item').forEach(item =>
    item.classList.toggle('active', item.dataset.view === cur)
  );
}

function _navItem(n, cur) {
  return `<a class="nav-item ${cur === n.view ? 'active' : ''}" data-view="${n.view}" role="button" tabindex="0">
    <span class="nav-icon">${n.icon}</span><span>${n.label}</span>
  </a>`;
}

function _html(s = {}) {
  const cfg         = store.state.appConfig;
  const loggedUser  = store.state.loggedUser;
  const displayName = s.nickname || s.full_name || loggedUser?.username || 'You';
  const pluginNav   = PluginRegistry.getNavItems();
  const cur         = store.state.currentView;

  // starcho items (music) come first, other plugins after a divider
  const musicItems  = pluginNav.filter(n => n.view.startsWith('starcho:'));
  const moduleItems = pluginNav.filter(n => !n.view.startsWith('starcho:'));

  const musicHtml = musicItems.map(n => _navItem(n, cur)).join('');

  const modulesHtml = moduleItems.length
    ? `<div class="nav-section-label">Módulos</div>
       ${moduleItems.map(n => _navItem(n, cur)).join('')}`
    : '';

  const settingsHtml = _navItem({ view: 'settings', icon: '⚙️', label: 'Configuración' }, cur);

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
    </div>

    <nav class="sidebar-nav" id="sidebar-nav">
      ${_navItem({ view: 'home', icon: '🏠', label: 'Inicio' }, cur)}
      ${musicHtml ? `<div class="nav-separator"></div>${musicHtml}` : ''}
      ${modulesHtml ? `<div class="nav-separator"></div>${modulesHtml}` : ''}
      <div class="nav-separator"></div>
      ${settingsHtml}
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
  el.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => store.navigate(item.dataset.view));
  });

  // Clicking the user row opens the profile popup; logout button is handled separately
  el.querySelector('#sidebar-user')?.addEventListener('click', (e) => {
    if (e.target.closest('#btn-logout')) return; // let logout button handle itself
    openProfileModal();
  });

  el.querySelector('#btn-logout')?.addEventListener('click', (e) => {
    e.stopPropagation();
    localStorage.removeItem('auth_remember');
    location.reload();
  });
}
