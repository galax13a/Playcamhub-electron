/**
 * Dashboard — Welcome home screen.
 *
 * Layout (top → bottom):
 *  1. Header bar        — app branding, date, Settings + Edit-profile buttons
 *  2. Hero              — user avatar/name/plan + library stats
 *  3. System stats      — CPU %, RAM %, disk used (live-refreshed every 3 s)
 *  4. Plugin header zone — full-width widgets registered by plugins (e.g. Now Playing)
 *  5. Quick actions     — one button per active plugin nav item + core shortcuts
 *  6. Plugin content zone — grid of plugin summary cards (library, notes, tasks…)
 *  7. Footer            — app version + current date
 */
'use strict';
import store          from '../store.js';
import API            from '../utils/api.js';
import PluginRegistry from '../core/PluginRegistry.js';
import { openProfileModal } from './Modal.js';
import { greeting, dateStr, fmtBytes } from '../utils/formatters.js';
import { esc } from '../utils/html.js';

const DEFAULT_AVATAR = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='%23333'/><circle cx='32' cy='24' r='12' fill='%23666'/><ellipse cx='32' cy='56' rx='20' ry='14' fill='%23666'/></svg>`;

/** Exported render function called by the router when navigating to 'home'. */
export async function renderDashboard(el) {
  const settings   = store.state.settings;
  const loggedUser = store.state.loggedUser;
  const name       = settings.nickname || settings.full_name || loggedUser?.username || 'Usuario';
  const avatar     = settings.avatar   || DEFAULT_AVATAR;
  const plan       = settings.plan     || 'basic';
  const cfg        = store.state.appConfig || {};

  // Library stats (may be empty if starcho is disabled)
  const songs     = store.state.songs     || [];
  const playlists = store.state.playlists || [];
  let diskText    = '—';
  let audioCount  = songs.length;
  let videoCount  = 0;
  const starchoActive = PluginRegistry.getPlugins().some(p => p.id === 'starcho');
  if (starchoActive) {
    try {
      const stats = await API.media.stats();
      audioCount  = stats.photoCount ?? audioCount;
      videoCount  = stats.videoCount ?? 0;
      diskText    = fmtBytes(stats.diskBytes);
    } catch (_) {}
  }

  // Build quick-action list: core shortcuts + all plugin nav items
  const pluginNav = PluginRegistry.getNavItems();
  const quickActions = [
    { icon: '🏠', label: 'Inicio',      view: 'home'     },
    { icon: '⚙️', label: 'Ajustes',     view: 'settings' },
    ...pluginNav.map(n => ({ icon: n.icon, label: n.label, view: n.view })),
  ];

  // Scaffold the page — plugin widget zones are rendered asynchronously below
  el.innerHTML = `
    <div class="dash-wrap" id="dash-root">

      <!-- ── 1. Dashboard header bar ──────────────────────────────── -->
      <div class="dash-topbar">
        <div class="dash-topbar-left">
          <svg width="26" height="26" viewBox="0 0 64 64" fill="none">
            <defs>
              <linearGradient id="dh-lg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"  stop-color="#00D2FF"/>
                <stop offset="100%" stop-color="#7B2FBE"/>
              </linearGradient>
            </defs>
            <circle cx="32" cy="32" r="32" fill="url(#dh-lg)"/>
            <circle cx="32" cy="32" r="5" fill="white"/>
            <ellipse cx="32" cy="32" rx="20" ry="8" stroke="white" stroke-width="2" fill="none"/>
            <ellipse cx="32" cy="32" rx="20" ry="8" stroke="white" stroke-width="2" fill="none" transform="rotate(60 32 32)"/>
            <ellipse cx="32" cy="32" rx="20" ry="8" stroke="white" stroke-width="2" fill="none" transform="rotate(-60 32 32)"/>
          </svg>
          <div>
            <div class="dash-topbar-app">${esc(cfg.appName || 'Starcho Electron')}</div>
            <div class="dash-topbar-slogan">${esc(cfg.appSlogan || 'Desarrollo ágil con Electron')}</div>
          </div>
        </div>
        <div class="dash-topbar-right">
          <div class="dash-topbar-clock" id="dash-clock">
            <div class="dash-topbar-time" id="dash-time"></div>
            <div class="dash-topbar-date" id="dash-date">${dateStr()}</div>
          </div>
          <button class="dash-hdr-btn" id="dh-profile-btn" title="Editar perfil">👤</button>
          <button class="dash-hdr-btn dash-hdr-btn--primary" id="dh-settings-btn" title="Configuración">⚙️</button>
        </div>
      </div>

      <!-- ── 2. Hero — user info + library stats ───────────────────── -->
      <div class="dash-hero">
        <div class="dash-hero-left">
          <img class="dash-avatar" id="dh-avatar" src="${avatar}" alt="avatar">
          <div>
            <div class="dash-greeting">${greeting()}, bienvenido de vuelta</div>
            <div class="dash-name">${esc(name)}</div>
            <span class="dash-plan ${plan === 'premium' ? 'plan-premium' : ''}">
              ${plan === 'premium' ? '⭐ Premium' : '🔹 Basic'}
            </span>
          </div>
        </div>
        <div class="dash-stats">
          <div class="dash-stat">
            <span class="dash-stat-num">${audioCount}</span>
            <span class="dash-stat-lbl">🎵 Audio</span>
          </div>
          <div class="dash-stat">
            <span class="dash-stat-num">${videoCount}</span>
            <span class="dash-stat-lbl">🎬 Video</span>
          </div>
          <div class="dash-stat">
            <span class="dash-stat-num">${playlists.length}</span>
            <span class="dash-stat-lbl">📋 Listas</span>
          </div>
          <div class="dash-stat">
            <span class="dash-stat-num" style="font-size:18px">${diskText}</span>
            <span class="dash-stat-lbl">💾 Disco</span>
          </div>
        </div>
      </div>

      <!-- ── 3. System performance ─────────────────────────────────── -->
      <div style="margin-bottom:24px">
        <div class="dash-section-title">Rendimiento del sistema</div>
        <div class="dash-perf-grid" id="dash-perf">
          ${_perfSkeleton()}
        </div>
      </div>

      <!-- ── 4. Plugin header zone ─────────────────────────────────── -->
      <div style="margin-bottom:24px">
        <div class="dash-section-title">Estado de módulos</div>
        <div class="dash-header-widgets" id="dash-zone-header"></div>
      </div>

      <!-- ── 5. Quick actions ───────────────────────────────────────── -->
      <div style="margin-bottom:24px">
        <div class="dash-section-title">Acceso rápido</div>
        <div class="dash-quick">
          ${quickActions.map(a => `
            <button class="dash-quick-btn" data-view="${a.view}">
              <span class="dqb-icon">${a.icon}</span>
              <span class="dqb-label">${a.label}</span>
            </button>`).join('')}
        </div>
      </div>

      <!-- ── 6. Plugin content zone (widget grid) ───────────────────── -->
      <div style="margin-bottom:24px">
        <div class="dash-section-title">Módulos activos</div>
        <div class="dash-widgets-grid" id="dash-zone-content"></div>
      </div>

      <!-- ── 7. Footer ─────────────────────────────────────────────── -->
      <div class="dash-footer">
        <span>${esc(cfg.appName || 'Starcho Electron')} v${esc(cfg.appVersion || '1.0.0')}</span>
        <span style="color:var(--text-muted)" id="dash-footer-date">${dateStr()}</span>
      </div>

    </div>`;

  // ── Bind interactions ─────────────────────────────────────────────────────

  el.querySelector('#dh-settings-btn')?.addEventListener('click', () =>
    store.navigate('settings'));

  el.querySelector('#dh-profile-btn')?.addEventListener('click', () =>
    openProfileModal());

  el.querySelectorAll('.dash-quick-btn[data-view]').forEach(btn =>
    btn.addEventListener('click', () => store.navigate(btn.dataset.view)));

  // ── Live clock (updates every second while dashboard is visible) ──────────

  _startClock(el);

  // ── Async: system stats (live refresh every 3 s while dashboard is visible)─

  _startPerfMonitor(el);

  // ── Async: render plugin widget zones ─────────────────────────────────────

  await PluginRegistry.renderDashboardZone('header',  el.querySelector('#dash-zone-header'));
  await PluginRegistry.renderDashboardZone('content', el.querySelector('#dash-zone-content'));
}

// ── Live clock ─────────────────────────────────────────────────────────────────

/** Updates the clock every second. Stops when the dashboard unmounts. */
function _startClock(rootEl) {
  function tick() {
    const timeEl = rootEl.querySelector('#dash-time');
    if (!timeEl || !rootEl.isConnected) { clearInterval(timer); return; }
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateEl = rootEl.querySelector('#dash-date');
    if (dateEl) dateEl.textContent = dateStr();
    const footerDateEl = rootEl.querySelector('#dash-footer-date');
    if (footerDateEl) footerDateEl.textContent = dateStr();
  }
  tick();
  const timer = setInterval(tick, 1000);
  const obs = new MutationObserver(() => {
    if (!rootEl.isConnected) { clearInterval(timer); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

// ── System performance monitor ─────────────────────────────────────────────────

/** Polls system stats every 3 s. Stops automatically when the dashboard unmounts. */
function _startPerfMonitor(rootEl) {
  let timer = null;

  async function refresh() {
    const perfEl = rootEl.querySelector('#dash-perf');
    if (!perfEl || !rootEl.isConnected) {
      clearInterval(timer);
      return;
    }
    try {
      const s = await window.electronAPI?.getSystemStats?.();
      if (!s) return;

      const ramGb    = (s.memory.used  / 1024 ** 3).toFixed(1);
      const ramTotal = (s.memory.total / 1024 ** 3).toFixed(1);
      const diskText = s.disk
        ? `${fmtBytes(s.disk.used)} / ${fmtBytes(s.disk.total)}`
        : 'Sin datos';

      perfEl.innerHTML = `
        ${_perfCard('🖥️ CPU',   s.cpu,              `${s.cpu}%`,             _cpuColor(s.cpu))}
        ${_perfCard('🧠 RAM',   s.memory.percent,   `${ramGb} / ${ramTotal} GB`, _memColor(s.memory.percent))}
        ${_perfCard('💾 Disco', s.disk?.percent ?? null, diskText,            _diskColor(s.disk?.percent ?? 0))}`;
    } catch (_) {}
  }

  refresh();
  // Refresh every 3 s; observer cleans up when the element leaves the DOM
  timer = setInterval(refresh, 3000);

  const obs = new MutationObserver(() => {
    if (!rootEl.isConnected) { clearInterval(timer); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

/** Skeleton shown while first stats load. */
function _perfSkeleton() {
  return `
    ${_perfCard('🖥️ CPU',  null, 'Cargando…', 'var(--border)')}
    ${_perfCard('🧠 RAM',  null, 'Cargando…', 'var(--border)')}
    ${_perfCard('💾 Disco',null, 'Cargando…', 'var(--border)')}`;
}

/** Renders a single performance card with a progress bar. */
function _perfCard(label, pct, text, color) {
  return `
    <div class="dash-perf-card">
      <div class="dash-perf-label">${label}</div>
      <div class="dash-perf-bar-wrap">
        <div class="dash-perf-bar" style="width:${pct ?? 0}%;background:${color}"></div>
      </div>
      <div class="dash-perf-value">${text}</div>
    </div>`;
}

const _cpuColor  = pct => pct > 80 ? 'var(--red)' : pct > 50 ? '#f59e0b' : 'var(--green)';
const _memColor  = pct => pct > 85 ? 'var(--red)' : pct > 65 ? '#f59e0b' : 'var(--green)';
const _diskColor = pct => pct > 90 ? 'var(--red)' : pct > 75 ? '#f59e0b' : 'var(--green)';

// ── Formatters ─────────────────────────────────────────────────────────────────
// greeting(), dateStr(), fmtBytes() are imported from ../utils/formatters.js
// esc() is imported from ../utils/html.js
