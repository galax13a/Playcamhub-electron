'use strict';

const { layout } = require('./_layout');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** @param {{ logContent:string, flash?:object, csrfToken?:string }} opts */
function logsPage({ logContent = '', flash, csrfToken = '' } = {}) {
  const lines = logContent.trim() ? logContent.trim().split('\n').reverse() : [];

  const linesHtml = lines.length
    ? lines.map(line => {
        const isErr  = /\[error\]|ERROR/i.test(line);
        const isWarn = /\[warn\]|WARN/i.test(line);
        const color  = isErr ? 'var(--accent)' : isWarn ? 'var(--yellow)' : 'var(--text)';
        return `<div style="color:${color};border-bottom:1px solid rgba(48,54,61,.4);padding:3px 0">${esc(line)}</div>`;
      }).join('')
    : '<div style="color:var(--muted);text-align:center;padding:40px 0">Sin entradas en el log</div>';

  const content = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div style="font-size:13px;color:var(--muted)">${lines.length} línea${lines.length !== 1 ? 's' : ''} — más reciente primero</div>
      <form method="POST" action="/admin/logs/clear"
            onsubmit="return confirm('¿Limpiar el archivo de log? Esta acción no se puede deshacer.')">
        <button type="submit" class="btn btn-secondary btn-sm"
                style="color:var(--accent);border-color:rgba(248,81,73,.3)">
          🗑 Limpiar log
        </button>
      </form>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <div style="font-family:monospace;font-size:12px;line-height:1.65;padding:16px 20px;
                  max-height:72vh;overflow-y:auto;overflow-x:auto;
                  white-space:pre-wrap;word-break:break-all">
        ${linesHtml}
      </div>
    </div>`;

  return layout({ title: '📋 Dev Log', content, active: 'logs', flash, csrfToken });
}

module.exports = { logsPage };
