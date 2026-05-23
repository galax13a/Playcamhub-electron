'use strict';

/**
 * login.js — Admin login page.
 * Standalone page (no sidebar). Uses same CSS variables as the layout.
 */

/** @param {{ error?:string }} opts */
function loginPage({ error } = {}) {
  const errorHtml = error
    ? `<div class="alert">${error}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin Login — Starcho</title>
  <style>
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    :root {
      --bg:     #0d1117;
      --bg2:    #161b22;
      --bg3:    #21262d;
      --border: #30363d;
      --text:   #c9d1d9;
      --muted:  #8b949e;
      --accent: #f85149;
      --font:   -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    }
    body {
      font-family:var(--font); background:var(--bg); color:var(--text);
      min-height:100vh; display:flex; align-items:center; justify-content:center;
      font-size:14px;
    }

    /* Background grid decoration */
    body::before {
      content:''; position:fixed; inset:0; pointer-events:none;
      background-image: linear-gradient(rgba(248,81,73,.04) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(248,81,73,.04) 1px, transparent 1px);
      background-size: 40px 40px;
    }

    .login-wrap {
      width:100%; max-width:380px; padding:20px;
      position:relative; z-index:1;
    }

    /* Logo */
    .login-logo {
      display:flex; flex-direction:column; align-items:center; margin-bottom:32px;
    }
    .logo-mark {
      width:52px; height:52px;
      background:linear-gradient(135deg,#f85149 0%,#9c3fe8 100%);
      border-radius:14px; display:flex; align-items:center; justify-content:center;
      font-size:26px; color:#fff; font-weight:900; margin-bottom:12px;
      box-shadow:0 8px 24px rgba(248,81,73,.3);
    }
    .logo-title { font-size:20px; font-weight:700; color:#fff; letter-spacing:-.3px; }
    .logo-sub   { font-size:12px; color:var(--muted); margin-top:3px; }

    /* Card */
    .login-card {
      background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:28px;
      box-shadow:0 16px 48px rgba(0,0,0,.4);
    }
    .card-head { font-size:16px; font-weight:700; color:#fff; margin-bottom:6px; }
    .card-sub  { font-size:12px; color:var(--muted); margin-bottom:24px; }

    /* Form */
    .fgroup { margin-bottom:16px; }
    .flabel { display:block; font-size:11px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
    .finput {
      width:100%; padding:10px 12px; background:var(--bg3); border:1px solid var(--border);
      border-radius:7px; color:var(--text); font-size:13px; font-family:var(--font); outline:none;
      transition:border-color .12s;
    }
    .finput:focus { border-color:var(--accent); }

    .btn-login {
      width:100%; padding:11px; background:var(--accent); color:#fff; border:none;
      border-radius:7px; font-size:14px; font-weight:600; cursor:pointer;
      font-family:var(--font); transition:.12s; margin-top:4px;
    }
    .btn-login:hover { filter:brightness(1.1); }
    .btn-login:active { transform:scale(.99); }

    /* Alert */
    .alert {
      background:rgba(248,81,73,.08); border:1px solid rgba(248,81,73,.3); color:var(--accent);
      border-radius:7px; padding:10px 14px; font-size:13px; margin-bottom:16px;
    }

    /* Footer hint */
    .login-hint {
      text-align:center; margin-top:20px; font-size:11px; color:var(--muted);
    }
  </style>
</head>
<body>
  <div class="login-wrap">

    <div class="login-logo">
      <div class="logo-mark">✦</div>
      <div class="logo-title">Starcho Admin</div>
      <div class="logo-sub">Panel de administración</div>
    </div>

    <div class="login-card">
      <div class="card-head">Iniciar sesión</div>
      <div class="card-sub">Introduce tus credenciales de administrador</div>

      ${errorHtml}

      <form method="POST" action="/admin/login">
        <div class="fgroup">
          <label class="flabel" for="email">Email</label>
          <input class="finput" type="email" id="email" name="email"
                 placeholder="root@starcho.com" required autocomplete="email">
        </div>
        <div class="fgroup">
          <label class="flabel" for="password">Contraseña</label>
          <input class="finput" type="password" id="password" name="password"
                 placeholder="••••••••" required autocomplete="current-password">
        </div>
        <button class="btn-login" type="submit">Entrar →</button>
      </form>
    </div>

    <div class="login-hint">StarchoElectron Admin · Solo acceso local</div>
  </div>

  <script>
    // Auto-focus email field
    document.getElementById('email').focus();
  </script>
</body>
</html>`;
}

module.exports = { loginPage };
