'use strict';
import store    from '../store.js';
import API      from '../utils/api.js';
import { t, LANGUAGES, THEMES, getLang } from '../utils/i18n.js';
import { showToast, openModal, openImportLibraryModal, openMigrationModal } from './Modal.js';

const DEFAULT_AVATAR = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='%23333'/><circle cx='32' cy='24' r='12' fill='%23666'/><ellipse cx='32' cy='56' rx='20' ry='14' fill='%23666'/></svg>`;

export async function renderSettings(el) {
  const settings    = await API.settings.getAll();
  const loggedUser  = store.state.loggedUser;
  // Merge user-table profile into settings so profile fields are populated
  let profile = {};
  if (loggedUser?.username) {
    try { profile = await API.auth.getProfile(loggedUser.username); } catch (_) {}
  }
  const merged     = { ...settings, ...profile };
  const activeTheme = merged.theme || 'dark';
  const activeLang  = getLang();

  const plugins        = await API.plugins.list().catch(() => []);
  const starchoEnabled = plugins.some(p => p.id === 'starcho' && p.enabled);
  el.innerHTML = `
    <div class="topbar">
      <span class="topbar-title">${t('settings_title')}</span>
    </div>

    <!-- ── Section quick-nav ──────────────────────────────────── -->
    <div class="settings-nav" id="settings-nav">
      <div class="settings-nav-inner">
        <button class="sn-btn active" data-sec="sec-profile">👤 ${t('profile')}</button>
        <button class="sn-btn" data-sec="sec-appearance">🎨 ${t('appearance')}</button>
        ${starchoEnabled ? `<button class="sn-btn" data-sec="sec-playback">🔊 ${t('playback')}</button>` : ''}
        ${starchoEnabled ? `<button class="sn-btn" data-sec="sec-categories">🏷 ${t('categories')}</button>` : ''}
        ${starchoEnabled ? `<button class="sn-btn" data-sec="sec-library">📦 ${t('lib_section')}</button>` : ''}
        <button class="sn-btn" data-sec="sec-plugins">🧩 Plugins</button>
        <button class="sn-btn" data-sec="sec-ai">🤖 IA</button>
        <button class="sn-btn" data-sec="sec-plan">⭐ ${t('plan_section')}</button>
        <button class="sn-btn" data-sec="sec-about">ℹ ${t('about')}</button>
      </div>
    </div>

    <div class="settings-scroll" id="settings-scroll">

      <!-- ── Profile ─────────────────────────────────────────── -->
      <div class="settings-section" id="sec-profile">
        <div class="settings-section-title">👤 ${t('profile')}</div>
        <div class="profile-card">
          <div class="profile-avatar-wrap">
            <img id="avatar-img" class="profile-avatar"
                 src="${merged.avatar || DEFAULT_AVATAR}" alt="Avatar">
            <label class="avatar-change-btn" title="${t('change_avatar')}">
              📷
              <input type="file" id="avatar-input" accept="image/*" style="display:none">
            </label>
          </div>
          <div class="profile-fields">
            <div class="form-group">
              <label>${t('full_name')}</label>
              <input class="form-control" id="p-fullname" value="${_safe(merged.full_name)}" placeholder="John Doe">
            </div>
            <div class="form-group">
              <label>${t('nickname')}</label>
              <input class="form-control" id="p-nickname" value="${_safe(merged.nickname)}" placeholder="@username">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group">
                <label>${t('email')}</label>
                <input class="form-control" id="p-email" type="email"
                       value="${_safe(loggedUser?.username || '')}"
                       placeholder="usuario" readonly
                       style="opacity:.65;cursor:default" title="El usuario no se puede cambiar">
              </div>
              <div class="form-group">
                <label>${t('whatsapp')}</label>
                <input class="form-control" id="p-whatsapp" value="${_safe(merged.whatsapp)}" placeholder="+1 555 000 0000">
              </div>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-save-profile">${t('save_profile')}</button>
          </div>
        </div>
      </div>

      <!-- ── Appearance ──────────────────────────────────────── -->
      <div class="settings-section" id="sec-appearance">
        <div class="settings-section-title">🎨 ${t('appearance')}</div>

        <!-- Theme -->
        <div class="appearance-group">
          <div class="appearance-group-label">${t('theme')}</div>
          <div class="theme-grid" id="theme-cards">
            ${THEMES.map(th => `
              <button class="theme-card2 ${activeTheme === th.id ? 'active' : ''}" data-theme="${th.id}" title="${th.label}">
                <div class="tc2-preview" style="background:${th.colors[0]}">
                  <span class="tc2-accent" style="background:${th.colors[1]}"></span>
                  <span class="tc2-accent tc2-accent2" style="background:${th.colors[2]}"></span>
                  ${activeTheme === th.id ? '<span class="tc2-check">✓</span>' : ''}
                </div>
                <div class="tc2-label">${th.icon} ${th.label}</div>
              </button>`).join('')}
          </div>
        </div>

        <!-- Language -->
        <div class="appearance-group" style="margin-top:20px">
          <div class="appearance-group-label">${t('language')}</div>
          <div class="lang-selector" id="lang-pills">
            ${LANGUAGES.map(l => `
              <button class="lang-card ${activeLang === l.code ? 'active' : ''}" data-lang="${l.code}">
                <span class="lang-flag">${l.flag}</span>
                <span class="lang-name">${l.label}</span>
                ${activeLang === l.code ? '<span class="lang-check">✓</span>' : ''}
              </button>`).join('')}
          </div>
        </div>

        <!-- Login screen theme -->
        <div class="appearance-group" style="margin-top:24px">
          <div class="appearance-group-label">Pantalla de login</div>
          <div class="ltheme-grid" id="ltheme-cards">

            <button class="ltheme-card ${(merged.login_theme||'nebula')==='nebula'?'active':''}" data-ltheme="nebula">
              <div class="ltheme-preview ltheme-preview--nebula">
                <span class="ltp-blob-a"></span>
                <span class="ltp-blob-b"></span>
                <span class="ltp-card-mock"></span>
              </div>
              <span class="ltheme-label">🌌 Nebula</span>
            </button>

            <button class="ltheme-card ${(merged.login_theme||'nebula')==='split'?'active':''}" data-ltheme="split">
              <div class="ltheme-preview ltheme-preview--split">
                <span class="ltp-left-panel"></span>
                <span class="ltp-right-panel"><span class="ltp-card-mock"></span></span>
              </div>
              <span class="ltheme-label">🪟 Split</span>
            </button>

            <button class="ltheme-card ${(merged.login_theme||'nebula')==='glass'?'active':''}" data-ltheme="glass">
              <div class="ltheme-preview ltheme-preview--glass">
                <span class="ltp-blob-a"></span>
                <span class="ltp-blob-b"></span>
                <span class="ltp-card-mock ltp-card-glass"></span>
              </div>
              <span class="ltheme-label">✨ Glass</span>
            </button>

            <button class="ltheme-card ${(merged.login_theme||'nebula')==='kick'?'active':''}" data-ltheme="kick">
              <div class="ltheme-preview ltheme-preview--kick">
                <span class="ltp-blob-a"></span>
                <span class="ltp-blob-b"></span>
                <span class="ltp-card-mock ltp-card-kick"></span>
              </div>
              <span class="ltheme-label">🟢 Kick</span>
            </button>

            <button class="ltheme-card ${(merged.login_theme||'nebula')==='arcade'?'active':''}" data-ltheme="arcade">
              <div class="ltheme-preview ltheme-preview--arcade">
                <span class="ltp-blob-a"></span>
                <span class="ltp-blob-b"></span>
                <span class="ltp-card-mock ltp-card-arcade"></span>
              </div>
              <span class="ltheme-label">🕹️ Arcade</span>
            </button>

            <button class="ltheme-card ${(merged.login_theme||'nebula')==='galax'?'active':''}" data-ltheme="galax">
              <div class="ltheme-preview ltheme-preview--galax">
                <span class="ltp-blob-a"></span>
                <span class="ltp-blob-b"></span>
                <span class="ltp-card-mock ltp-card-galax"></span>
              </div>
              <span class="ltheme-label">🌠 Galax</span>
            </button>

            <button class="ltheme-card ${(merged.login_theme||'nebula')==='cyber'?'active':''}" data-ltheme="cyber">
              <div class="ltheme-preview ltheme-preview--cyber">
                <span class="ltp-blob-a"></span>
                <span class="ltp-blob-b"></span>
                <span class="ltp-card-mock ltp-card-cyber"></span>
              </div>
              <span class="ltheme-label">⚡ Cyber</span>
            </button>

            <button class="ltheme-card ${(merged.login_theme||'nebula')==='lux'?'active':''}" data-ltheme="lux">
              <div class="ltheme-preview ltheme-preview--lux">
                <span class="ltp-blob-a"></span>
                <span class="ltp-blob-b"></span>
                <span class="ltp-card-mock ltp-card-lux"></span>
              </div>
              <span class="ltheme-label">✨ Lux</span>
            </button>

          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:10px">
            Se aplica en el próximo inicio de sesión o reinicio.
          </p>
        </div>

        <!-- Titlebar style -->
        <div class="appearance-group" style="margin-top:24px">
          <div class="appearance-group-label">Barra de título</div>
          <div class="tb-theme-grid" id="tb-theme-cards">
            ${[
              { id: 'default', label: 'Windows',     icon: '🪟', desc: 'Botones a la derecha, estilo Windows' },
              { id: 'mac',     label: 'macOS',        icon: '🍎', desc: 'Botones a la izquierda, vidrio esmerilado' },
              { id: 'linux',   label: 'Linux',        icon: '🐧', desc: 'Botones cuadrados, estilo GNOME/KDE' },
              { id: 'cartoon', label: 'Gamer/Arcade', icon: '🕹️', desc: 'Botones gigantes, neon y animaciones' },
              { id: 'stripe',  label: 'Stripe',       icon: '💳', desc: 'Gradiente azul púrpura, ultra limpio' },
            ].map(th => `
              <button class="tb-theme-card ${(merged.titlebar_theme || 'default') === th.id ? 'active' : ''}"
                      data-tbtheme="${th.id}" title="${th.desc}">
                <span class="tb-theme-icon">${th.icon}</span>
                <span class="tb-theme-label">${th.label}</span>
              </button>`).join('')}
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:10px">
            Se aplica inmediatamente sin reiniciar.
          </p>
        </div>
      </div>

      <!-- ── Playback ────────────────────────────────────────── -->
      ${starchoEnabled ? `
      <div class="settings-section" id="sec-playback">
        <div class="settings-section-title">🔊 ${t('playback')}</div>
        <div class="settings-row">
          <div class="settings-row-label">
            <h4>${t('volume')}</h4>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:13px;color:var(--text-muted)" id="vol-display">${settings.volume || 80}%</span>
            <input type="range" class="vol-slider" id="set-volume"
                   min="0" max="100" value="${settings.volume || 80}" style="width:120px">
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-label">
            <h4>${t('auto_play')}</h4>
            <p>${t('auto_play_desc')}</p>
          </div>
          <label class="switch">
            <input type="checkbox" id="set-autoplay" ${settings.auto_play !== 'false' ? 'checked' : ''}>
            <span class="sw-slider"></span>
          </label>
        </div>
      </div>` : ''}

      <!-- ── Categories ─────────────────────────────────────── -->
      ${starchoEnabled ? `
      <div class="settings-section" id="sec-categories">
        <div class="settings-section-title">🏷 ${t('categories')}</div>
        <div style="padding:0 0 12px">
          <div id="cat-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px"></div>
          <div style="display:flex;gap:8px">
            <input class="form-control" id="new-cat-name" placeholder="${t('cat_placeholder')}" style="flex:1">
            <input type="color" id="new-cat-color" value="#8B5CF6" title="Color"
                   style="width:42px;height:38px;border:none;background:none;cursor:pointer;padding:0;border-radius:var(--radius-sm)">
            <button class="btn btn-primary btn-sm" id="btn-add-cat">${t('add')}</button>
          </div>
        </div>
      </div>` : ''}

      <!-- ── Library ───────────────────────────────────────── -->
      ${starchoEnabled ? `
      <div class="settings-section" id="sec-library">
        <div class="settings-section-title">📦 ${t('lib_section')}</div>
        <div class="settings-row">
          <div class="settings-row-label">
            <h4>${t('lib_export_title')}</h4>
            <p>${t('lib_export_desc')}</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-export-lib">${t('lib_export_btn')}</button>
        </div>
        <div class="settings-row">
          <div class="settings-row-label">
            <h4>${t('lib_import_title')}</h4>
            <p>${t('lib_import_desc')}</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-import-lib">${t('lib_import_btn')}</button>
          <input type="file" id="import-file-input" accept=".json" style="display:none">
        </div>
      </div>` : ''}

      <!-- ── Plugins ──────────────────────────────────────── -->
      <div class="settings-section" id="sec-plugins">
        <div class="settings-section-title">🧩 Plugins instalados</div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
          Activa o desactiva plugins. Los cambios requieren reiniciar la app.
        </p>
        <div id="plugin-list" style="display:flex;flex-direction:column;gap:10px">
          <div style="color:var(--text-muted);font-size:13px">Cargando plugins…</div>
        </div>
      </div>

      <!-- ── Plan ───────────────────────────────────────────── -->
      <div class="settings-section" id="sec-plan">
        <div class="settings-section-title">⭐ ${t('plan_section')}</div>
        <div class="plan-cards" id="plan-cards">
          <div class="plan-card ${(settings.plan || 'basic') === 'basic' ? 'active' : ''}" data-plan="basic">
            <div class="plan-card-icon">🔹</div>
            <div class="plan-card-name">Basic</div>
            <ul class="plan-card-features">
              <li>✓ Unlimited local library</li>
              <li>✓ Local file import</li>
              <li>✓ 3 themes</li>
              <li>✗ Priority downloads</li>
              <li>✗ Premium themes</li>
            </ul>
            <div class="plan-card-price">${t('plan_free')}</div>
          </div>
          <div class="plan-card ${(settings.plan || 'basic') === 'premium' ? 'active' : ''}" data-plan="premium">
            <div class="plan-card-icon">⭐</div>
            <div class="plan-card-name" style="background:linear-gradient(90deg,#f59e0b,#f97316);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">Premium</div>
            <ul class="plan-card-features">
              <li>✓ Everything in Basic</li>
              <li>✓ Priority downloads</li>
              <li>✓ All 5 themes</li>
              <li>✓ Cloud sync (soon)</li>
              <li>✓ Early access features</li>
            </ul>
            <div class="plan-card-price" style="background:linear-gradient(90deg,#f59e0b,#f97316);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:900">$4.99/mo</div>
          </div>
        </div>

        <!-- Activation key -->
        <div class="settings-row" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
          <div class="settings-row-label">
            <h4>${t('license_title')}</h4>
            <p id="license-status">${settings.pro === 'true' ? t('license_active') : t('license_desc')}</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <input class="form-control" id="license-key-input"
                   placeholder="PRYU-XXXX-XXXX-XXXX"
                   value="${_safe(settings.license_key)}"
                   style="width:210px;font-family:monospace;letter-spacing:.05em"
                   ${settings.pro === 'true' ? 'disabled' : ''}>
            ${settings.pro === 'true'
              ? `<button class="btn btn-secondary btn-sm" id="btn-deactivate">${t('license_deactivate')}</button>`
              : `<button class="btn btn-primary btn-sm" id="btn-activate">${t('license_activate')}</button>`}
          </div>
        </div>
      </div>

      <!-- ── IA Providers ──────────────────────────────────── -->
      <div class="settings-section" id="sec-ai">
        <div class="settings-section-title">🤖 Inteligencia Artificial</div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;line-height:1.6">
          Configura las API keys de los proveedores para usar el editor IA en fotos.
          Guarda los cambios con el botón al final.
        </p>

        <!-- OpenAI -->
        <div style="background:var(--bg-3);border-radius:10px;padding:14px 16px;margin-bottom:12px;border:1px solid rgba(255,255,255,.07)">
          <div style="font-weight:700;font-size:13px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
            🤖 OpenAI (DALL-E)
            <span style="font-size:10px;padding:2px 7px;background:rgba(16,185,129,.15);color:#10b981;border-radius:4px">img2img</span>
          </div>
          <div class="form-group" style="margin-bottom:10px">
            <label style="font-size:11px;font-weight:700;color:var(--text-muted)">API KEY</label>
            <input class="form-control" id="ai-openai-key" type="password"
                   value="${_safe(settings.ai_openai_key)}"
                   placeholder="sk-proj-..." autocomplete="off">
          </div>
          <div class="form-group">
            <label style="font-size:11px;font-weight:700;color:var(--text-muted)">MODELO</label>
            <select class="form-control" id="ai-openai-model">
              <option value="dall-e-2" ${(settings.ai_openai_model||'dall-e-2')==='dall-e-2'?'selected':''}>DALL-E 2 (edición de imagen)</option>
              <option value="dall-e-3" ${(settings.ai_openai_model||'')==='dall-e-3'?'selected':''}>DALL-E 3 (generación)</option>
            </select>
          </div>
        </div>

        <!-- Stability AI -->
        <div style="background:var(--bg-3);border-radius:10px;padding:14px 16px;margin-bottom:12px;border:1px solid rgba(255,255,255,.07)">
          <div style="font-weight:700;font-size:13px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
            🎨 Stability AI
            <span style="font-size:10px;padding:2px 7px;background:rgba(99,102,241,.18);color:#818cf8;border-radius:4px">img2img</span>
          </div>
          <div class="form-group" style="margin-bottom:10px">
            <label style="font-size:11px;font-weight:700;color:var(--text-muted)">API KEY</label>
            <input class="form-control" id="ai-stability-key" type="password"
                   value="${_safe(settings.ai_stability_key)}"
                   placeholder="sk-..." autocomplete="off">
          </div>
          <div class="form-group">
            <label style="font-size:11px;font-weight:700;color:var(--text-muted)">MODELO</label>
            <select class="form-control" id="ai-stability-model">
              <option value="stable-diffusion-xl-1024-v1-0" ${(settings.ai_stability_model||'stable-diffusion-xl-1024-v1-0')==='stable-diffusion-xl-1024-v1-0'?'selected':''}>SDXL 1.0 (1024px)</option>
              <option value="stable-diffusion-v1-6" ${(settings.ai_stability_model||'')==='stable-diffusion-v1-6'?'selected':''}>SD 1.6 (512px, más rápido)</option>
            </select>
          </div>
        </div>

        <!-- Replicate -->
        <div style="background:var(--bg-3);border-radius:10px;padding:14px 16px;margin-bottom:16px;border:1px solid rgba(255,255,255,.07)">
          <div style="font-weight:700;font-size:13px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
            ⚡ Replicate (Flux)
            <span style="font-size:10px;padding:2px 7px;background:rgba(245,158,11,.15);color:#fbbf24;border-radius:4px">img2img</span>
          </div>
          <div class="form-group" style="margin-bottom:10px">
            <label style="font-size:11px;font-weight:700;color:var(--text-muted)">API KEY</label>
            <input class="form-control" id="ai-replicate-key" type="password"
                   value="${_safe(settings.ai_replicate_key)}"
                   placeholder="r8_..." autocomplete="off">
          </div>
          <div class="form-group">
            <label style="font-size:11px;font-weight:700;color:var(--text-muted)">MODELO (version ID)</label>
            <select class="form-control" id="ai-replicate-model">
              <option value="black-forest-labs/flux-dev" ${(settings.ai_replicate_model||'black-forest-labs/flux-dev')==='black-forest-labs/flux-dev'?'selected':''}>Flux Dev</option>
              <option value="black-forest-labs/flux-schnell" ${(settings.ai_replicate_model||'')==='black-forest-labs/flux-schnell'?'selected':''}>Flux Schnell (rápido)</option>
              <option value="stability-ai/sdxl" ${(settings.ai_replicate_model||'')==='stability-ai/sdxl'?'selected':''}>SDXL via Replicate</option>
            </select>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:12px">
          <div class="form-group" style="flex:1">
            <label style="font-size:11px;font-weight:700;color:var(--text-muted)">PROVEEDOR POR DEFECTO</label>
            <select class="form-control" id="ai-default-provider">
              <option value="openai"    ${(settings.ai_provider||'openai')==='openai'?'selected':''}>OpenAI</option>
              <option value="stability" ${(settings.ai_provider||'')==='stability'?'selected':''}>Stability AI</option>
              <option value="replicate" ${(settings.ai_provider||'')==='replicate'?'selected':''}>Replicate</option>
            </select>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-save-ai" style="margin-top:12px;white-space:nowrap">💾 Guardar IA</button>
        </div>
      </div>

      <!-- ── About ──────────────────────────────────────────── -->
      <div class="settings-section" id="sec-about">
        <div class="settings-section-title">ℹ ${t('about')}</div>
        <div class="settings-row">
          <div class="settings-row-label">
            <h4>${store.state.appConfig.appName}</h4>
            <p>Version ${store.state.appConfig.appVersion} — ${store.state.appConfig.appSlogan}</p>
          </div>
          <span class="badge badge-green">v${store.state.appConfig.appVersion}</span>
        </div>
        <div class="settings-row">
          <div class="settings-row-label">
            <h4>Library</h4>
            <p id="lib-stat">Loading…</p>
          </div>
          <span class="badge badge-purple" id="lib-disk-badge">—</span>
        </div>
      </div>

      <!-- ── Danger Zone ─────────────────────────────────── -->
      <div style="background:var(--bg-2);padding:16px 20px;margin-top:16px;position:relative;border:1px solid rgba(255,50,50,.25);border-radius:var(--radius-lg)">
        <div class="settings-section-title" style="color:var(--red)">⚠ ${t('danger_zone')}</div>
        <div class="settings-row">
          <div class="settings-row-label">
            <h4>${t('danger_reset_title')}</h4>
            <p>${t('danger_reset_desc')}</p>
          </div>
          <button class="btn btn-sm" id="btn-factory-reset"
                  style="background:rgba(255,50,50,.15);color:var(--red);border:1px solid rgba(255,50,50,.4);
                         white-space:nowrap;flex-shrink:0">
            ${t('danger_reset_btn')}
          </button>
        </div>
      </div>


      <div style="height:40px"></div>
    </div>`;

  _bindSectionNav(el);
  _bindPlugins(el);
  _bindAI(el);
  _bindProfile(el, merged);
  _bindAppearance(el);
  if (starchoEnabled) {
    _bindPlayback(el);
    _bindCategories(el);
    renderCategories(el.querySelector('#cat-list'));
  }
  _bindPlan(el);
  _bindLibrary(el);
  _bindActivation(el, settings);
  _bindReset(el);
  _loadLibraryStats(el);
}

// ── AI providers ─────────────────────────────────────────────────────────────

function _bindAI(el) {
  el.querySelector('#btn-save-ai')?.addEventListener('click', async () => {
    const btn = el.querySelector('#btn-save-ai');
    btn.disabled = true;
    btn.textContent = '⏳…';
    try {
      await API.settings.setMany({
        ai_provider:        el.querySelector('#ai-default-provider')?.value  || 'openai',
        ai_openai_key:      el.querySelector('#ai-openai-key')?.value        || '',
        ai_openai_model:    el.querySelector('#ai-openai-model')?.value      || 'dall-e-2',
        ai_stability_key:   el.querySelector('#ai-stability-key')?.value     || '',
        ai_stability_model: el.querySelector('#ai-stability-model')?.value   || 'stable-diffusion-xl-1024-v1-0',
        ai_replicate_key:   el.querySelector('#ai-replicate-key')?.value     || '',
        ai_replicate_model: el.querySelector('#ai-replicate-model')?.value   || 'black-forest-labs/flux-dev',
      });
      showToast('✅ Configuración IA guardada');
    } catch (err) {
      showToast('Error guardando: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Guardar IA';
    }
  });
}

// ── Section nav ──────────────────────────────────────────────────────────────

function _bindSectionNav(el) {
  const btns = el.querySelectorAll('.settings-nav-inner .sn-btn');
  let activeId = 'sec-profile';

  function showTab(targetId) {
    if (targetId === activeId) return;
    const outgoing = el.querySelector(`#${activeId}`);
    if (outgoing) {
      outgoing.classList.remove('tab-active');
      outgoing.classList.add('tab-exit');
      setTimeout(() => outgoing.classList.remove('tab-exit'), 180);
    }
    setTimeout(() => {
      el.querySelector(`#${targetId}`)?.classList.add('tab-active');
    }, 80);
    activeId = targetId;
    btns.forEach(b => b.classList.toggle('active', b.dataset.sec === targetId));
  }

  el.querySelector(`#${activeId}`)?.classList.add('tab-active');
  btns.forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.sec)));
}

// ── Plugins ───────────────────────────────────────────────────────────────────

async function _bindPlugins(el) {
  const listEl = el.querySelector('#plugin-list');
  if (!listEl) return;
  try {
    const plugins = await API.plugins.list();
    if (!plugins.length) {
      listEl.innerHTML = `<div style="color:var(--text-muted);font-size:13px">No hay plugins instalados en la carpeta <code>plugins/</code>.</div>`;
      return;
    }
    listEl.innerHTML = plugins.map(p => `
      <div class="settings-row" style="padding:12px 16px;border-radius:var(--radius-md);border:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:12px;flex:1">
          <span style="font-size:28px">${p.icon}</span>
          <div>
            <div style="font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px">
              ${p.name}
              <span style="font-size:11px;color:var(--text-muted);font-weight:400">v${p.version}</span>
              ${p.active ? '<span style="font-size:10px;padding:2px 6px;background:rgba(16,185,129,.15);color:#10b981;border-radius:4px">activo</span>' : ''}
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${p.description}</div>
          </div>
        </div>
        <label class="switch" title="${p.enabled ? 'Desactivar' : 'Activar'} ${p.name}">
          <input type="checkbox" class="plugin-toggle" data-id="${p.id}" ${p.enabled ? 'checked' : ''}>
          <span class="sw-slider"></span>
        </label>
      </div>`).join('');

    listEl.querySelectorAll('.plugin-toggle').forEach(ck => {
      ck.addEventListener('change', async () => {
        const id      = ck.dataset.id;
        const enabled = ck.checked;
        const action  = enabled ? 'activado' : 'desactivado';

        await API.plugins.setEnabled(id, enabled);

        openModal({
          title: '🔄 Reiniciar aplicación',
          content: `
            <div style="display:flex;flex-direction:column;gap:14px">
              <p style="font-size:14px;color:var(--text-secondary);line-height:1.6">
                El plugin <strong style="color:var(--text-primary)">${id}</strong> fue
                <strong>${action}</strong>. Para que el cambio surta efecto es necesario
                reiniciar la aplicación.
              </p>
              <div style="background:var(--bg-3);border-radius:var(--radius-md);
                          padding:12px 14px;font-size:13px;color:var(--text-muted)">
                💡 Si eliges <em>Reiniciar después</em>, el cambio se aplicará la próxima
                vez que abras la app.
              </div>
            </div>`,
          actions: [
            {
              label: 'Reiniciar después',
              class: 'btn-secondary',
              action: (close) => {
                close();
                showToast(`Plugin "${id}" ${action} — reinicia la app para aplicar`, 'info');
              },
            },
            {
              label: '🔄 Reiniciar ahora',
              class: 'btn-primary',
              action: (close) => {
                close();
                window.electronAPI?.restart();
              },
            },
          ],
        });
      });
    });
  } catch (_) {
    listEl.innerHTML = `<div style="color:var(--text-muted);font-size:13px">No se pudo cargar la lista de plugins.</div>`;
  }
}

// ── Profile ──────────────────────────────────────────────────────────────────

function _bindProfile(el, merged) {
  const avatarInput = el.querySelector('#avatar-input');
  const avatarImg   = el.querySelector('#avatar-img');
  const loggedUser  = store.state.loggedUser;

  avatarInput.addEventListener('change', () => {
    const file = avatarInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const size = Math.min(img.width, img.height);
        const sx   = (img.width  - size) / 2;
        const sy   = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        avatarImg.src = dataUrl;
        // Save avatar to users table
        if (loggedUser?.username) {
          API.auth.updateProfile({
            username:   loggedUser.username,
            full_name:  el.querySelector('#p-fullname').value.trim(),
            nickname:   el.querySelector('#p-nickname').value.trim(),
            whatsapp:   el.querySelector('#p-whatsapp').value.trim(),
            avatar:     dataUrl,
          }).catch(() => {});
        }
        const updated = { ...store.state.settings, avatar: dataUrl };
        store.setState({ settings: updated });
        showToast(t('saved'), 'success');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    avatarInput.value = '';
  });

  el.querySelector('#btn-save-profile').addEventListener('click', async () => {
    const full_name = el.querySelector('#p-fullname').value.trim();
    const nickname  = el.querySelector('#p-nickname').value.trim();
    const whatsapp  = el.querySelector('#p-whatsapp').value.trim();
    const avatar    = store.state.settings.avatar || merged.avatar || '';

    if (loggedUser?.username) {
      await API.auth.updateProfile({ username: loggedUser.username, full_name, nickname, whatsapp, avatar });
    }

    const s = { ...store.state.settings, full_name, nickname, whatsapp };
    store.setState({ settings: s });
    showToast(t('save_profile') + ' — ' + t('saved'), 'success');
  });
}

// ── Appearance ───────────────────────────────────────────────────────────────

function _bindAppearance(el) {
  el.querySelectorAll('.theme-card2').forEach(card => {
    card.addEventListener('click', () => {
      store.applyTheme(card.dataset.theme);
      showToast(`${t('theme')}: ${card.dataset.theme}`, 'success');
      // Update active state without full re-render
      el.querySelectorAll('.theme-card2').forEach(c => {
        c.classList.toggle('active', c === card);
        const chk = c.querySelector('.tc2-check');
        if (c === card && !chk) {
          const prev = c.querySelector('.tc2-preview');
          const span = document.createElement('span');
          span.className = 'tc2-check';
          span.textContent = '✓';
          prev.appendChild(span);
        } else if (c !== card && chk) {
          chk.remove();
        }
      });
    });
  });

  el.querySelectorAll('.lang-card').forEach(btn => {
    btn.addEventListener('click', () => {
      store.setLanguage(btn.dataset.lang);
    });
  });

  el.querySelectorAll('.ltheme-card').forEach(card => {
    card.addEventListener('click', async () => {
      const ltheme = card.dataset.ltheme;
      await API.settings.setMany({ login_theme: ltheme });
      store.setState({ settings: { ...store.state.settings, login_theme: ltheme } });
      el.querySelectorAll('.ltheme-card').forEach(c => {
        c.classList.toggle('active', c === card);
        const lbl = c.querySelector('.ltheme-label');
        if (lbl) lbl.style.color = c === card ? 'var(--red)' : '';
      });
      showToast(`Login: ${ltheme.charAt(0).toUpperCase() + ltheme.slice(1)}`, 'success');
    });
  });

  el.querySelectorAll('.tb-theme-card').forEach(card => {
    card.addEventListener('click', async () => {
      const theme = card.dataset.tbtheme;
      await API.settings.setMany({ titlebar_theme: theme });
      store.setState({ settings: { ...store.state.settings, titlebar_theme: theme } });
      // Apply immediately — no restart needed
      const bar = document.getElementById('title-bar');
      if (bar) {
        const valid = ['mac', 'linux', 'cartoon', 'stripe'];
        bar.dataset.titlebar = valid.includes(theme) ? theme : 'default';
      }
      el.querySelectorAll('.tb-theme-card').forEach(c => c.classList.toggle('active', c === card));
      showToast(`Barra de título: ${card.querySelector('.tb-theme-label').textContent}`, 'success');
    });
  });
}

// ── Playback ──────────────────────────────────────────────────────────────────

function _bindPlayback(el) {
  el.querySelector('#set-volume').addEventListener('input', async (e) => {
    const v = e.target.value;
    el.querySelector('#vol-display').textContent = `${v}%`;
    store.setState({ volume: v / 100 });
    await API.settings.setMany({ volume: v });
  });

  el.querySelector('#set-autoplay').addEventListener('change', async (e) => {
    const val = String(e.target.checked);
    await API.settings.setMany({ auto_play: val });
    store.setState({ settings: { ...store.state.settings, auto_play: val } });
  });
}

// ── Plan ─────────────────────────────────────────────────────────────────────

function _bindPlan(el) {
  el.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', async () => {
      const plan = card.dataset.plan;
      el.querySelectorAll('.plan-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const updated = { ...store.state.settings, plan };
      store.setState({ settings: updated });
      await API.settings.setMany({ plan });
      showToast(`Plan: ${plan.charAt(0).toUpperCase() + plan.slice(1)}`, 'success');
    });
  });
}

// ── Categories ────────────────────────────────────────────────────────────────

function _bindCategories(el) {
  el.querySelector('#btn-add-cat').addEventListener('click', async () => {
    const name  = el.querySelector('#new-cat-name').value.trim();
    const color = el.querySelector('#new-cat-color').value;
    if (!name) return;
    await API.categories.create({ name, color });
    await store.loadCategories();
    el.querySelector('#new-cat-name').value = '';
    renderCategories(el.querySelector('#cat-list'));
    showToast(`${t('cat_created')}: "${name}"`, 'success');
  });
}

export function renderCategories(container) {
  if (!container) return;
  const cats = store.state.categories;
  container.innerHTML = cats.map(c => `
    <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;
                border-radius:var(--radius-full);border:2px solid ${c.color}22;
                background:${c.color}11;font-size:13px">
      <span>${c.icon}</span>
      <span style="color:${c.color};font-weight:600">${c.name}</span>
      <button data-del="${c.id}" style="background:none;border:none;cursor:pointer;
              color:var(--text-muted);font-size:13px;padding:0;margin-left:2px" title="${t('delete')}">✕</button>
    </div>`).join('');

  container.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await API.categories.delete(parseInt(btn.dataset.del));
      await store.loadCategories();
      renderCategories(container);
    });
  });
}

// ── Library export / import ───────────────────────────────────────────────────

function _bindLibrary(el) {
  // Export
  el.querySelector('#btn-export-lib')?.addEventListener('click', async () => {
    try {
      const data = await API.library.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href     = url;
      a.download = `starcho-library-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Library exported (${data.songs.length} songs)`, 'success');
    } catch (err) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  });

  // Import
  const fileInput = el.querySelector('#import-file-input');
  el.querySelector('#btn-import-lib')?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    fileInput.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
      let data;
      try { data = JSON.parse(ev.target.result); }
      catch (_) { showToast('Invalid JSON file', 'error'); return; }

      if (!data?.songs) { showToast('Not a valid PlaycamHub Studio library file', 'error'); return; }

      openImportLibraryModal(data, async (redownload) => {
        try {
          const result = await API.library.import(data, redownload);
          showToast(`Imported: ${result.songs} songs, ${result.playlists} playlists`, 'success');
          await Promise.all([store.loadSongs(), store.loadPlaylists(), store.loadCategories()]);
          if (redownload && result.batchId && result.queued > 0) {
            openMigrationModal(result.batchId, result.queued);
          }
        } catch (err) {
          showToast(`Import failed: ${err.message}`, 'error');
        }
      });
    };
    reader.readAsText(file);
  });
}

// ── Activation key ────────────────────────────────────────────────────────────

function _bindActivation(el, settings) {
  el.querySelector('#btn-activate')?.addEventListener('click', async () => {
    const key = el.querySelector('#license-key-input')?.value.trim();
    if (!key) return;
    try {
      await API.library.activate(key);
      const updated = { ...store.state.settings, pro: 'true', license_key: key.toUpperCase() };
      store.setState({ settings: updated });
      showToast('✅ Pro activated! Restart to apply all changes.', 'success');
      el.querySelector('#license-status').textContent = '✅ Pro activated';
      el.querySelector('#license-key-input').disabled = true;
      const deactivateBtn = document.createElement('button');
      deactivateBtn.className = 'btn btn-secondary btn-sm';
      deactivateBtn.id = 'btn-deactivate';
      deactivateBtn.textContent = 'Deactivate';
      deactivateBtn.addEventListener('click', () => _deactivate(el));
      el.querySelector('#btn-activate').replaceWith(deactivateBtn);
    } catch (_) {
      showToast('Invalid license key', 'error');
      el.querySelector('#license-key-input').style.borderColor = 'var(--red)';
      setTimeout(() => { el.querySelector('#license-key-input').style.borderColor = ''; }, 2000);
    }
  });

  el.querySelector('#btn-deactivate')?.addEventListener('click', () => _deactivate(el));
}

async function _deactivate(el) {
  await API.settings.setMany({ pro: 'false', license_key: '' });
  store.setState({ settings: { ...store.state.settings, pro: 'false', license_key: '' } });
  showToast('License deactivated', 'info');
  el.querySelector('#license-status').textContent = 'Enter your key to unlock Pro features';
  const input = el.querySelector('#license-key-input');
  if (input) { input.value = ''; input.disabled = false; }
  const activateBtn = document.createElement('button');
  activateBtn.className = 'btn btn-primary btn-sm';
  activateBtn.id = 'btn-activate';
  activateBtn.textContent = 'Activate';
  activateBtn.addEventListener('click', async () => {
    const key = el.querySelector('#license-key-input')?.value.trim();
    if (!key) return;
    try {
      await API.library.activate(key);
      const updated = { ...store.state.settings, pro: 'true', license_key: key.toUpperCase() };
      store.setState({ settings: updated });
      showToast('✅ Pro activated!', 'success');
    } catch (_) {
      showToast('Invalid license key', 'error');
    }
  });
  el.querySelector('#btn-deactivate')?.replaceWith(activateBtn);
}

// ── Factory reset ─────────────────────────────────────────────────────────────

function _bindReset(el) {
  el.querySelector('#btn-factory-reset')?.addEventListener('click', () => {
    openModal({
      title: t('danger_warn_title'),
      content: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="background:rgba(255,50,50,.1);border:1px solid rgba(255,50,50,.3);
                      border-radius:var(--radius-md);padding:12px 14px;font-size:13px;
                      color:var(--text-secondary);line-height:1.6">
            <strong style="color:var(--red);font-size:14px">⚠ ${t('danger_warn_deletes')}</strong>
            <ul style="margin:8px 0 0;padding-left:16px;display:flex;flex-direction:column;gap:3px">
              <li>${t('danger_warn_songs')}</li>
              <li>${t('danger_warn_playlists')}</li>
              <li>${t('danger_warn_settings')}</li>
            </ul>
          </div>
          <div style="background:var(--bg-3);border-radius:var(--radius-md);
                      padding:12px 14px;font-size:13px;color:var(--text-secondary)">
            💡 ${t('danger_warn_tip')}
          </div>
        </div>`,
      actions: [
        { label: t('cancel'), class: 'btn-secondary', action: (c) => c() },
        {
          label: t('danger_export_first'),
          class: 'btn-secondary',
          action: async (c) => {
            c();
            try {
              const data = await API.library.export();
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement('a');
              a.href = url; a.download = 'starcho-backup.json'; a.click();
              URL.revokeObjectURL(url);
              showToast(t('lib_export_title') + ' ✅', 'success');
            } catch (err) {
              showToast(`${t('error')}: ${err.message}`, 'error');
            }
          },
        },
        {
          label: t('danger_continue'),
          class: 'btn-primary',
          action: (c) => { c(); _confirmReset(); },
        },
      ],
    });
  });
}

function _confirmReset() {
  openModal({
    title: t('danger_sure_title'),
    content: `
      <div style="font-size:14px;line-height:1.7;color:var(--text-secondary)">
        <p style="margin-bottom:12px">${t('danger_sure_body')}</p>
        <p>${t('danger_type_reset')}</p>
        <input class="form-control" id="reset-confirm-input"
               placeholder="RESET" autocomplete="off"
               style="margin-top:8px;font-family:monospace;letter-spacing:.1em;text-transform:uppercase">
      </div>`,
    actions: [
      { label: t('cancel'), class: 'btn-secondary', action: (c) => c() },
      {
        label: t('danger_delete_btn'),
        class: 'btn-primary',
        action: async (c) => {
          const val = document.getElementById('reset-confirm-input')?.value.trim().toUpperCase();
          if (val !== 'RESET') {
            document.getElementById('reset-confirm-input').style.borderColor = 'var(--red)';
            document.getElementById('reset-confirm-input').focus();
            return;
          }
          c();
          await _executeReset();
        },
      },
    ],
  });
  setTimeout(() => document.getElementById('reset-confirm-input')?.focus(), 100);
}

async function _executeReset() {
  try {
    showToast(t('danger_resetting'), 'info');
    await API.library.reset();
    await Promise.all([
      store.loadSongs(),
      store.loadPlaylists(),
      store.loadCategories(),
      store.loadSettings(),
    ]);
    store.setState({ currentSong: null, queue: [], queueIndex: -1, isPlaying: false, history: [], downloadQueue: [] });
    store.navigate('home');
    showToast(t('danger_done'), 'success');
  } catch (err) {
    showToast(`${t('error')}: ${err.message}`, 'error');
  }
}

async function _loadLibraryStats(el) {
  try {
    const stats   = await API.media.stats();
    const statEl  = el.querySelector('#lib-stat');
    const diskEl  = el.querySelector('#lib-disk-badge');
    if (statEl) {
      statEl.innerHTML =
        `🖼️ ${stats.photoCount ?? 0} photos &nbsp;·&nbsp; 🎬 ${stats.videoCount ?? 0} videos`;
    }
    if (diskEl && stats.diskBytes != null) {
      diskEl.textContent = _fmtBytes(stats.diskBytes);
    }
  } catch (_) {}
}

function _fmtBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 ** 2)        return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)        return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}


function _safe(v) { return v ? String(v).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''; }
