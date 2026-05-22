'use strict';
import store from '../store.js';

export async function renderDashboard(el) {
  const settings   = store.state.settings;
  const loggedUser = store.state.loggedUser;
  const name       = settings.nickname || settings.full_name
                  || loggedUser?.username || 'Usuario';
  const avatar     = settings.avatar || _defaultAvatar();
  const greeting = _greeting();
  const dateStr  = _dateStr();
  const cfg      = store.state.appConfig || {};

  el.innerHTML = `
    <div class="dw-root">

      <!-- ambient blobs -->
      <div class="dw-blob dw-blob-1"></div>
      <div class="dw-blob dw-blob-2"></div>

      <div class="dw-card">

        <!-- App icon -->
        <div class="dw-app-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <defs>
              <linearGradient id="dw-lg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stop-color="#00D2FF"/>
                <stop offset="100%" stop-color="#7B2FBE"/>
              </linearGradient>
            </defs>
            <circle cx="32" cy="32" r="32" fill="url(#dw-lg)"/>
            <circle cx="32" cy="32" r="5" fill="white"/>
            <ellipse cx="32" cy="32" rx="20" ry="8" stroke="white" stroke-width="2" fill="none"/>
            <ellipse cx="32" cy="32" rx="20" ry="8" stroke="white" stroke-width="2" fill="none" transform="rotate(60 32 32)"/>
            <ellipse cx="32" cy="32" rx="20" ry="8" stroke="white" stroke-width="2" fill="none" transform="rotate(-60 32 32)"/>
          </svg>
        </div>

        <!-- App name -->
        <div class="dw-app-name">${_esc(cfg.appName || 'Starcho Electron')}</div>
        <div class="dw-app-slogan">${_esc(cfg.appSlogan || 'Desarrollo ágil y rápido con Electron')}</div>

        <!-- Divider -->
        <div class="dw-divider"></div>

        <!-- User greeting -->
        <div class="dw-greeting">${greeting}</div>

        <div class="dw-user-row">
          <img class="dw-avatar" src="${avatar}" alt="avatar">
          <div class="dw-username">${_esc(name)}</div>
        </div>

        <!-- Date -->
        <div class="dw-date">${dateStr}</div>

      </div>
    </div>`;
}

function _greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

function _dateStr() {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function _defaultAvatar() {
  return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='%23333'/><circle cx='32' cy='24' r='12' fill='%23666'/><ellipse cx='32' cy='56' rx='20' ry='14' fill='%23666'/></svg>`;
}
