(function () {
  'use strict';

  var loginPg = document.getElementById('login-page');

  // Apply login theme from DB — data-ltheme="nebula" is the HTML default;
  // update as soon as the local API responds (always fast, same process).
  getPort().then(function (port) {
    return fetch('http://127.0.0.1:' + port + '/api/settings');
  }).then(function (res) { return res.json(); })
    .then(function (s) {
      if (s && s.login_theme) loginPg.setAttribute('data-ltheme', s.login_theme);
    }).catch(function () { /* keep HTML default 'nebula' */ });

  // ── SVG helpers ──────────────────────────────────────────────────────────
  var SVG_EYE_OPEN = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  var SVG_EYE_SHUT = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>' +
                     '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>' +
                     '<line x1="1" y1="1" x2="23" y2="23"/>';
  var SVG_LOGIN    = '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>' +
                     '<polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>';
  var SVG_REGISTER = '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>' +
                     '<circle cx="8.5" cy="7" r="4"/>' +
                     '<line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>';

  function makeSvg(inner) {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
           ' stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }

  // ── Enter app ────────────────────────────────────────────────────────────
  function enter() {
    loginPg.classList.add('lp-exit');
    setTimeout(function () {
      if (loginPg.parentNode) loginPg.parentNode.removeChild(loginPg);
    }, 500);
  }

  // ── Panel switcher ───────────────────────────────────────────────────────
  var panelLogin    = document.getElementById('lp-panel-login');
  var panelRegister = document.getElementById('lp-panel-register');

  function showPanel(id) {
    [panelLogin, panelRegister].forEach(function (p) {
      p.classList.remove('lp-panel--active', 'lp-panel--slide-right', 'lp-panel--slide-left');
    });
    var target = id === 'register' ? panelRegister : panelLogin;
    var dir    = id === 'register' ? 'lp-panel--slide-right' : 'lp-panel--slide-left';
    target.classList.add('lp-panel--active', dir);
    var first = target.querySelector('input');
    if (first) setTimeout(function () { first.focus(); }, 50);
  }

  document.getElementById('go-register').addEventListener('click', function () { showPanel('register'); });
  document.getElementById('go-login').addEventListener('click',    function () { showPanel('login'); });

  // ── Show/hide password ───────────────────────────────────────────────────
  function wireToggle(toggleId, inputId, eyeId) {
    var toggle = document.getElementById(toggleId);
    var input  = document.getElementById(inputId);
    var eye    = document.getElementById(eyeId);
    toggle.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eye.innerHTML = show ? SVG_EYE_SHUT : SVG_EYE_OPEN;
      toggle.style.color = show ? 'var(--red)' : '';
    });
  }
  wireToggle('lp-toggle-pw',  'lp-password',  'lp-eye-icon');
  wireToggle('reg-toggle-pw', 'reg-password', 'reg-eye-icon');

  // ── Auto-login via stored session token (7-day, no password stored) ─────────
  // Migrate old auth_remember (stored plaintext password) → remove it on first run
  localStorage.removeItem('auth_remember');

  var storedSession = null;
  try { storedSession = JSON.parse(localStorage.getItem('auth_session') || 'null'); } catch (_) {}

  // Discard client-side if expiry already passed (server is authoritative, but avoids a round-trip)
  if (storedSession && storedSession.expiresAt && Date.now() > storedSession.expiresAt) {
    localStorage.removeItem('auth_session');
    storedSession = null;
  }

  if (storedSession && storedSession.token) {
    loginPg.style.opacity = '0';

    getPort().then(function (port) {
      return fetch('http://127.0.0.1:' + port + '/api/auth/validate?token=' + encodeURIComponent(storedSession.token));
    }).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; });
    }).then(function (r) {
      if (r.ok) {
        window.dispatchEvent(new CustomEvent('user:login', { detail: r.data }));
        enter();
      } else {
        // Token expired or invalid — force re-login
        localStorage.removeItem('auth_session');
        loginPg.style.opacity = '';
        document.getElementById('lp-username').focus();
      }
    }).catch(function () {
      // Server not ready yet — keep the session and show the form so user can retry
      loginPg.style.opacity = '';
      if (storedSession.username) document.getElementById('lp-username').value = storedSession.username;
      document.getElementById('lp-password').focus();
    });
  } else {
    document.getElementById('lp-username').focus();
  }

  // ── API helper ───────────────────────────────────────────────────────────
  var _port = null;
  function getPort() {
    if (_port) return Promise.resolve(_port);
    return window.electronAPI.getServerPort().then(function (p) { _port = p; return p; });
  }
  function apiPost(path, body) {
    return getPort().then(function (port) {
      return fetch('http://127.0.0.1:' + port + '/api' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    });
  }

  // ── Error / button helpers ───────────────────────────────────────────────
  function showError(errEl, msg) {
    errEl.textContent = msg;
    errEl.style.display = 'flex';
    var card = document.querySelector('.lp-card');
    card.classList.remove('lp-shake');
    void card.offsetWidth;
    card.classList.add('lp-shake');
    setTimeout(function () { card.classList.remove('lp-shake'); }, 450);
  }
  function setLoading(btn, label) {
    btn.disabled = true;
    btn.innerHTML = '<span class="lp-spinner"></span> ' + label;
  }
  function resetBtn(btn, svgInner, label) {
    btn.disabled = false;
    btn.innerHTML = makeSvg(svgInner) + ' ' + label;
  }

  // ── Login form ───────────────────────────────────────────────────────────
  var loginForm  = document.getElementById('login-form');
  var loginBtn   = document.getElementById('login-btn');
  var loginErrEl = document.getElementById('lp-login-error');
  var rememberCk = document.getElementById('lp-remember');

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var user = document.getElementById('lp-username').value.trim();
    var pass = document.getElementById('lp-password').value;
    loginErrEl.style.display = 'none';

    if (!user) { document.getElementById('lp-username').focus(); showError(loginErrEl, 'Ingresa tu usuario'); return; }
    if (!pass) { document.getElementById('lp-password').focus(); showError(loginErrEl, 'Ingresa tu contraseña'); return; }

    setLoading(loginBtn, 'Verificando…');

    apiPost('/auth/login', { username: user, password: pass })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (r) {
        if (r.ok) {
          // Store session token (never the password) — always saved so the
          // app can validate on next restart without re-entering credentials.
          // "Remember me" controls whether to keep it for 7 days or just this session.
          if (rememberCk.checked && r.data.token) {
            localStorage.setItem('auth_session', JSON.stringify({
              token:      r.data.token,
              username:   r.data.username || user,
              expiresAt:  r.data.expiresAt,
            }));
          } else {
            // Not remembered — clear any previous session so next launch shows login
            localStorage.removeItem('auth_session');
          }
          loginBtn.innerHTML = makeSvg('<polyline points="20 6 9 17 4 12"/>') + ' Bienvenido';
          loginBtn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
          window.dispatchEvent(new CustomEvent('user:login', { detail: r.data }));
          setTimeout(enter, 500);
        } else {
          resetBtn(loginBtn, SVG_LOGIN, 'Iniciar sesión');
          showError(loginErrEl, r.data.error || 'Credenciales incorrectas');
        }
      })
      .catch(function () {
        resetBtn(loginBtn, SVG_LOGIN, 'Iniciar sesión');
        showError(loginErrEl, 'No se pudo conectar con el servidor');
      });
  });

  // ── Register form ────────────────────────────────────────────────────────
  var regForm  = document.getElementById('register-form');
  var regBtn   = document.getElementById('register-btn');
  var regErrEl = document.getElementById('lp-reg-error');

  regForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var user    = document.getElementById('reg-username').value.trim();
    var pass    = document.getElementById('reg-password').value;
    var confirm = document.getElementById('reg-confirm').value;
    regErrEl.style.display = 'none';

    if (!user)            { document.getElementById('reg-username').focus(); showError(regErrEl, 'Ingresa un nombre de usuario'); return; }
    if (user.length < 3)  { document.getElementById('reg-username').focus(); showError(regErrEl, 'El usuario debe tener al menos 3 caracteres'); return; }
    if (!pass)            { document.getElementById('reg-password').focus(); showError(regErrEl, 'Ingresa una contraseña'); return; }
    if (pass.length < 6)  { document.getElementById('reg-password').focus(); showError(regErrEl, 'La contraseña debe tener al menos 6 caracteres'); return; }
    if (pass !== confirm) { document.getElementById('reg-confirm').focus();  showError(regErrEl, 'Las contraseñas no coinciden'); return; }

    setLoading(regBtn, 'Creando cuenta…');

    apiPost('/auth/register', { username: user, password: pass })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (r) {
        if (r.ok) {
          regBtn.innerHTML = makeSvg('<polyline points="20 6 9 17 4 12"/>') + ' Cuenta creada';
          regBtn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
          setTimeout(function () {
            regBtn.style.background = '';
            resetBtn(regBtn, SVG_REGISTER, 'Crear cuenta');
            regForm.reset();
            showPanel('login');
          }, 1200);
        } else {
          resetBtn(regBtn, SVG_REGISTER, 'Crear cuenta');
          showError(regErrEl, r.data.error || 'Error al crear la cuenta');
        }
      })
      .catch(function () {
        resetBtn(regBtn, SVG_REGISTER, 'Crear cuenta');
        showError(regErrEl, 'No se pudo conectar con el servidor');
      });
  });

}());
