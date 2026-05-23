'use strict';

/**
 * _layout.js — HTML shell for every admin panel page.
 *
 * Renders a dark sidebar + topbar + content area.
 * All views call layout({ title, content, active }) and return the result.
 */

const NAV = [
  { key: 'dashboard', icon: '⬡',  label: 'Dashboard',      href: '/admin/dashboard' },
  { key: 'menu',      icon: '☰',  label: 'Menú & Plugins',  href: '/admin/menu' },
  { key: 'config',    icon: '⚙',  label: 'Configuración',   href: '/admin/config' },
  { key: 'users',     icon: '👤', label: 'Usuarios',        href: '/admin/users' },
];

/** @param {{ title:string, content:string, active?:string, flash?:{type:string,msg:string}, csrfToken?:string }} opts */
function layout({ title, content, active = 'dashboard', flash, csrfToken = '' }) {
  const navHtml = NAV.map(n => `
    <a href="${n.href}" class="nav-item${n.key === active ? ' active' : ''}">
      <span class="nav-icon">${n.icon}</span>
      <span class="nav-label">${n.label}</span>
    </a>`).join('');

  const flashHtml = flash
    ? `<div class="flash flash-${flash.type}">${flash.msg}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es" data-theme="admin">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="csrf-token" content="${csrfToken}">
  <title>${title} — Starcho Admin</title>
  <style>
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    :root {
      --bg:      #0d1117;
      --bg2:     #161b22;
      --bg3:     #21262d;
      --border:  #30363d;
      --text:    #c9d1d9;
      --muted:   #8b949e;
      --accent:  #f85149;
      --green:   #3fb950;
      --yellow:  #d29922;
      --blue:    #58a6ff;
      --font:    -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
      --r:       8px;
      --sw:      220px;
    }
    html, body { height:100%; }
    body { font-family:var(--font); background:var(--bg); color:var(--text); display:flex; font-size:14px; line-height:1.5; }

    /* ── Sidebar ── */
    .sidebar {
      width:var(--sw); background:var(--bg2); border-right:1px solid var(--border);
      display:flex; flex-direction:column; position:fixed; top:0; left:0; height:100vh; z-index:50;
    }
    .brand {
      padding:18px 16px; border-bottom:1px solid var(--border);
      display:flex; align-items:center; gap:12px; text-decoration:none;
    }
    .brand-logo {
      width:36px; height:36px; flex-shrink:0;
      background:linear-gradient(135deg,#f85149 0%,#9c3fe8 100%);
      border-radius:10px; display:flex; align-items:center; justify-content:center;
      font-size:18px; color:#fff; font-weight:900;
    }
    .brand-name  { font-size:14px; font-weight:700; color:#fff; letter-spacing:-.2px; }
    .brand-email { font-size:11px; color:var(--muted); margin-top:1px; }
    nav { flex:1; padding:10px 8px; overflow-y:auto; display:flex; flex-direction:column; gap:2px; }
    .nav-item {
      display:flex; align-items:center; gap:10px; padding:8px 12px;
      border-radius:6px; color:var(--muted); text-decoration:none; font-size:13px;
      transition:background .12s, color .12s;
    }
    .nav-item:hover { background:var(--bg3); color:var(--text); }
    .nav-item.active { background:rgba(248,81,73,.12); color:var(--accent); font-weight:600; }
    .nav-icon { font-size:15px; width:20px; text-align:center; }
    .sidebar-foot {
      padding:10px 8px; border-top:1px solid var(--border);
    }
    .logout-link {
      display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:6px;
      color:var(--muted); text-decoration:none; font-size:13px; transition:.12s;
    }
    .logout-link:hover { background:rgba(248,81,73,.08); color:var(--accent); }

    /* ── Main ── */
    .main { margin-left:var(--sw); flex:1; display:flex; flex-direction:column; min-height:100vh; }
    .topbar {
      padding:20px 28px 14px; border-bottom:1px solid var(--border);
      display:flex; align-items:center; justify-content:space-between;
      background:var(--bg2);
    }
    .page-title { font-size:20px; font-weight:700; color:#fff; }
    .topbar-right { display:flex; align-items:center; gap:10px; }
    .content { padding:24px 28px; }

    /* ── Flash ── */
    .flash {
      padding:10px 16px; border-radius:6px; font-size:13px; margin-bottom:20px; border:1px solid;
    }
    .flash-success { background:rgba(63,185,80,.08); border-color:rgba(63,185,80,.3); color:var(--green); }
    .flash-error   { background:rgba(248,81,73,.08); border-color:rgba(248,81,73,.3); color:var(--accent); }
    .flash-info    { background:rgba(88,166,255,.08); border-color:rgba(88,166,255,.3); color:var(--blue); }

    /* ── Cards ── */
    .card { background:var(--bg2); border:1px solid var(--border); border-radius:var(--r); padding:20px; margin-bottom:20px; }
    .card-title { font-size:13px; font-weight:600; color:#fff; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px; }
    .card-title-icon { font-size:16px; }
    .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    .grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
    .grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }

    /* ── Stat cards ── */
    .stat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:16px; margin-bottom:24px; }
    .stat { background:var(--bg2); border:1px solid var(--border); border-radius:var(--r); padding:18px 20px; }
    .stat.c-green  { border-color:rgba(63,185,80,.35);  background:rgba(63,185,80,.05); }
    .stat.c-red    { border-color:rgba(248,81,73,.35);  background:rgba(248,81,73,.05); }
    .stat.c-yellow { border-color:rgba(210,153,34,.35); background:rgba(210,153,34,.05); }
    .stat.c-blue   { border-color:rgba(88,166,255,.35); background:rgba(88,166,255,.05); }
    .stat-val  { font-size:30px; font-weight:700; color:#fff; line-height:1; }
    .stat-lbl  { font-size:12px; color:var(--muted); margin-top:6px; }

    /* ── Table ── */
    .tbl-wrap { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    thead th { text-align:left; padding:8px 12px; font-size:11px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.5px; border-bottom:1px solid var(--border); }
    tbody td { padding:11px 12px; border-bottom:1px solid rgba(48,54,61,.6); }
    tbody tr:last-child td { border-bottom:none; }
    tbody tr:hover td { background:rgba(255,255,255,.02); }

    /* ── Toggle switch ── */
    .toggle { position:relative; display:inline-flex; align-items:center; cursor:pointer; width:40px; height:22px; }
    .toggle input { opacity:0; width:0; height:0; position:absolute; }
    .t-track { position:absolute; inset:0; border-radius:22px; background:var(--bg3); border:1px solid var(--border); transition:.2s; }
    .t-thumb { position:absolute; left:4px; top:50%; transform:translateY(-50%); width:14px; height:14px; border-radius:50%; background:var(--muted); transition:.2s; }
    .toggle input:checked + .t-track { background:rgba(63,185,80,.2); border-color:rgba(63,185,80,.5); }
    .toggle input:checked ~ .t-thumb { left:22px; background:var(--green); }

    /* ── Badges ── */
    .badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:20px; font-size:11px; font-weight:600; }
    .b-green  { background:rgba(63,185,80,.15);  color:var(--green); }
    .b-muted  { background:var(--bg3); color:var(--muted); }
    .b-red    { background:rgba(248,81,73,.15); color:var(--accent); }
    .b-yellow { background:rgba(210,153,34,.15); color:var(--yellow); }
    .b-blue   { background:rgba(88,166,255,.15); color:var(--blue); }

    /* ── Forms ── */
    .fgroup { margin-bottom:16px; }
    .flabel { display:block; font-size:11px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
    .finput, .fselect {
      width:100%; padding:8px 12px; background:var(--bg3); border:1px solid var(--border);
      border-radius:6px; color:var(--text); font-size:13px; font-family:var(--font); outline:none;
      transition:border-color .12s;
    }
    .finput:focus, .fselect:focus { border-color:var(--accent); }
    .fhint { font-size:11px; color:var(--muted); margin-top:5px; }
    .frow { display:grid; grid-template-columns:1fr 1fr; gap:16px; }

    /* ── Buttons ── */
    .btn {
      display:inline-flex; align-items:center; gap:6px; padding:8px 16px;
      border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; border:none;
      text-decoration:none; transition:.12s; font-family:var(--font);
    }
    .btn-primary { background:var(--accent); color:#fff; }
    .btn-primary:hover { filter:brightness(1.1); }
    .btn-secondary { background:var(--bg3); color:var(--text); border:1px solid var(--border); }
    .btn-secondary:hover { border-color:var(--muted); color:#fff; }
    .btn-sm { padding:5px 10px; font-size:12px; }
    .btn-ghost { background:transparent; color:var(--muted); padding:4px 8px; }
    .btn-ghost:hover { color:var(--text); }

    /* ── Misc ── */
    .info-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(48,54,61,.6); font-size:13px; }
    .info-row:last-child { border-bottom:none; }
    .info-key { color:var(--muted); }
    .info-val { color:#fff; font-weight:500; font-family:monospace; font-size:12px; }
    .tag { display:inline-block; padding:1px 6px; border-radius:4px; font-size:11px; background:var(--bg3); color:var(--muted); font-family:monospace; }
    .divider { height:1px; background:var(--border); margin:20px 0; }
    .text-muted { color:var(--muted); }
    .text-sm { font-size:12px; }
    .mb-4 { margin-bottom:4px; }
    .mb-8 { margin-bottom:8px; }
    .mb-16 { margin-bottom:16px; }
    .flex { display:flex; align-items:center; gap:8px; }
    .ml-auto { margin-left:auto; }

    /* ── Toast ── */
    #toast {
      position:fixed; bottom:24px; right:24px; z-index:9999;
      background:var(--bg3); border:1px solid var(--border); border-radius:var(--r);
      padding:12px 18px; font-size:13px; display:none;
      box-shadow:0 8px 24px rgba(0,0,0,.5); transform:translateY(8px);
      transition:opacity .2s, transform .2s; opacity:0;
    }
    #toast.show { display:block; opacity:1; transform:translateY(0); }
    #toast.t-ok  { border-color:rgba(63,185,80,.4); color:var(--green); }
    #toast.t-err { border-color:rgba(248,81,73,.4); color:var(--accent); }

    /* ── Responsive ── */
    @media(max-width:768px) {
      :root { --sw:0px; }
      .sidebar { transform:translateX(-100%); }
      .frow { grid-template-columns:1fr; }
    }
  </style>
</head>
<body>
  <aside class="sidebar">
    <a href="/admin/dashboard" class="brand">
      <div class="brand-logo">✦</div>
      <div>
        <div class="brand-name">StarchoAdmin</div>
        <div class="brand-email">root@starcho.com</div>
      </div>
    </a>
    <nav>${navHtml}</nav>
    <div class="sidebar-foot">
      <a href="/admin/logout" class="logout-link">⏻ Cerrar sesión</a>
    </div>
  </aside>

  <div class="main">
    <div class="topbar">
      <h1 class="page-title">${title}</h1>
    </div>
    <div class="content">
      ${flashHtml}
      ${content}
    </div>
  </div>

  <div id="toast"></div>
  <script>
    // Auto-inject the CSRF hidden input into every POST form before submission
    (function () {
      const TOKEN = document.querySelector('meta[name="csrf-token"]')?.content || '';
      if (!TOKEN) return;
      document.querySelectorAll('form[method="POST"], form[method="post"]').forEach(form => {
        if (form.querySelector('input[name="_csrf"]')) return; // already present
        const inp = document.createElement('input');
        inp.type  = 'hidden';
        inp.name  = '_csrf';
        inp.value = TOKEN;
        form.appendChild(inp);
      });
      // Re-inject when the inline setting-edit form's action is set via JS
      document.addEventListener('submit', (e) => {
        const form = e.target;
        if (!form.querySelector('input[name="_csrf"]')) {
          const inp = document.createElement('input');
          inp.type  = 'hidden';
          inp.name  = '_csrf';
          inp.value = TOKEN;
          form.appendChild(inp);
        }
      }, true);
    })();

    function toast(msg, ok = true) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.className = 'show ' + (ok ? 't-ok' : 't-err');
      clearTimeout(window._toastTimer);
      window._toastTimer = setTimeout(() => { el.className = ''; }, 3000);
    }
  </script>
</body>
</html>`;
}

module.exports = { layout };
