/**
 * SpeedTest — Animated network speed test with SVG gauge.
 * Tests: ping/jitter, download speed, upload speed.
 */
import { getBase } from '../../../../src/renderer/utils/api.js';

// ── Styles ────────────────────────────────────────────────────────────────────
function _injectStyles() {
  if (document.getElementById('st-styles')) return;
  const s = document.createElement('style');
  s.id = 'st-styles';
  s.textContent = `
    @keyframes st-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    @keyframes st-spin   { to{transform:rotate(360deg)} }
    @keyframes st-fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    .st-card {
      background:var(--bg-2);border-radius:16px;padding:20px;
      border:1px solid rgba(255,255,255,.06);transition:border-color .3s;
    }
    .st-card.active { border-color:rgba(0,188,212,.4); }
    .st-result-row {
      display:flex;align-items:center;justify-content:space-between;
      padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);
    }
    .st-result-row:last-child { border-bottom:none; }
    .st-gauge-track { fill:none;stroke:rgba(255,255,255,.07);stroke-width:12;stroke-linecap:round; }
    .st-gauge-fill  { fill:none;stroke-width:12;stroke-linecap:round;transition:stroke-dashoffset .25s ease; }
    .st-bar-bg { background:rgba(255,255,255,.06);border-radius:4px;height:4px;overflow:hidden;margin-top:8px; }
    .st-bar-fill { height:100%;border-radius:4px;transition:width .3s ease; }
    .st-log-item { font-size:11px;color:var(--text-muted);padding:3px 0;
                   animation:st-fadeUp .25s ease; }
    .st-log-item.ok  { color:#06D6A0; }
    .st-log-item.err { color:#FF3366; }
  `;
  document.head.appendChild(s);
}

// ── SVG Gauge ─────────────────────────────────────────────────────────────────
function _createGauge(color) {
  const R  = 80;
  const cx = 100;
  const cy = 100;
  const SW = 12;
  // Arc: 240 degrees, starting at -210deg from 3 o'clock = 210deg from positive x
  const startAngle = (210 * Math.PI) / 180;
  const endAngle   = (330 * Math.PI) / 180; // 330 = 360 - 30
  const totalArc   = (240 * Math.PI) / 180;
  const C          = 2 * Math.PI * R;
  const arcLen     = (totalArc / (2 * Math.PI)) * C;

  // SVG arc helpers
  const px = (a) => cx + R * Math.cos(a);
  const py = (a) => cy + R * Math.sin(a);

  const sa = (210 - 90) * Math.PI / 180; // rotate so 0° is at top
  const ea = (330 - 90) * Math.PI / 180;

  const trackD = `M ${px(sa).toFixed(2)} ${py(sa).toFixed(2)} A ${R} ${R} 0 1 1 ${px(ea).toFixed(2)} ${py(ea).toFixed(2)}`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 200 180');
  svg.style.cssText = 'width:100%;max-width:220px;';

  svg.innerHTML = `
    <defs>
      <linearGradient id="st-grad-${color.replace('#','')}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="${color}88"/>
        <stop offset="100%" stop-color="${color}"/>
      </linearGradient>
    </defs>
    <path class="st-gauge-track" d="${trackD}" stroke-dasharray="${arcLen.toFixed(2)}" stroke-dashoffset="0"/>
    <path class="st-gauge-fill" d="${trackD}"
          stroke="url(#st-grad-${color.replace('#','')})"
          stroke-dasharray="${arcLen.toFixed(2)}"
          stroke-dashoffset="${arcLen.toFixed(2)}"/>
    <text x="100" y="95" text-anchor="middle" font-size="28" font-weight="800"
          fill="${color}" class="gauge-num">0</text>
    <text x="100" y="118" text-anchor="middle" font-size="13" font-weight="700"
          fill="rgba(255,255,255,.5)" class="gauge-unit">Mbps</text>
    <text x="100" y="148" text-anchor="middle" font-size="11"
          fill="rgba(255,255,255,.35)" class="gauge-label"></text>
  `;

  function update(mbps, maxMbps = 1000, label = '') {
    const ratio = Math.min(mbps / maxMbps, 1);
    const dash  = arcLen * (1 - ratio);
    svg.querySelector('.st-gauge-fill').style.strokeDashoffset = dash.toFixed(2);
    svg.querySelector('.gauge-num').textContent  = mbps >= 1000 ? (mbps/1000).toFixed(2) : mbps < 10 ? mbps.toFixed(2) : mbps.toFixed(1);
    svg.querySelector('.gauge-unit').textContent = mbps >= 1000 ? 'Gbps' : 'Mbps';
    svg.querySelector('.gauge-label').textContent = label;
  }

  return { svg, update, arcLen };
}

// ── Main render ───────────────────────────────────────────────────────────────
export function renderSpeedTest(el) {
  _injectStyles();
  el.innerHTML = '';

  // Header
  el.insertAdjacentHTML('beforeend', `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <div>
        <div style="font-size:22px;font-weight:800;color:var(--text-primary)">⚡ Speed Test</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
          Test de velocidad local — ping 16 muestras · descarga 30 MB · subida 8 MB
        </div>
      </div>
      <button class="btn btn-primary" id="st-start" style="min-width:120px">▶ Iniciar</button>
    </div>
  `);

  // Gauge row
  const gaugeRow = document.createElement('div');
  gaugeRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px';

  const dlGauge = _createGauge('#00BCD4');
  const ulGauge = _createGauge('#1DB954');
  const pingGauge = _createGauge('#FF6B35');

  function _gaugeCard(gauge, title, id) {
    const card = document.createElement('div');
    card.className = 'st-card';
    card.id = id;
    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:12px;font-weight:700;color:var(--text-muted);letter-spacing:.8px;text-align:center;margin-bottom:8px';
    titleEl.textContent = title;
    card.append(titleEl, gauge.svg);

    // Mini bar
    const barBg = document.createElement('div');
    barBg.className = 'st-bar-bg';
    const barFill = document.createElement('div');
    barFill.className = 'st-bar-fill';
    barFill.style.width = '0%';
    barFill.style.background = gauge.svg.querySelector('.st-gauge-fill').getAttribute('stroke') || '#00BCD4';
    barBg.appendChild(barFill);
    card.appendChild(barBg);
    gauge._bar = barFill;
    gauge._card = card;
    return card;
  }

  // Ping card: different layout (shows ms not Mbps)
  const pingCard = document.createElement('div');
  pingCard.className = 'st-card';
  pingCard.id = 'st-ping-card';
  pingCard.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:var(--text-muted);letter-spacing:.8px;text-align:center;margin-bottom:16px">
      🏓 PING / JITTER
    </div>
    <div style="text-align:center;padding:20px 0">
      <div id="st-ping-ms" style="font-size:52px;font-weight:900;color:#FF6B35;line-height:1">—</div>
      <div style="font-size:13px;color:rgba(255,255,255,.4);margin-top:4px">ms</div>
      <div style="margin-top:14px;display:flex;justify-content:center;gap:20px">
        <div style="text-align:center">
          <div id="st-jitter" style="font-size:18px;font-weight:800;color:rgba(255,255,255,.7)">—</div>
          <div style="font-size:10px;color:var(--text-muted)">JITTER</div>
        </div>
        <div style="text-align:center">
          <div id="st-min-ping" style="font-size:18px;font-weight:800;color:rgba(255,255,255,.7)">—</div>
          <div style="font-size:10px;color:var(--text-muted)">MIN</div>
        </div>
        <div style="text-align:center">
          <div id="st-max-ping" style="font-size:18px;font-weight:800;color:rgba(255,255,255,.7)">—</div>
          <div style="font-size:10px;color:var(--text-muted)">MAX</div>
        </div>
      </div>
    </div>
    <div class="st-bar-bg"><div class="st-bar-fill" id="ping-bar" style="background:#FF6B35;width:0%"></div></div>
  `;

  gaugeRow.append(
    _gaugeCard(dlGauge, '⬇ DESCARGA', 'st-dl-card'),
    _gaugeCard(ulGauge, '⬆ SUBIDA',   'st-ul-card'),
    pingCard,
  );
  el.appendChild(gaugeRow);

  // Results summary
  const results = document.createElement('div');
  results.className = 'st-card';
  results.style.marginBottom = '16px';
  results.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:var(--text-muted);letter-spacing:.8px;margin-bottom:12px">
      📊 RESULTADOS
    </div>
    <div id="st-results-body" style="color:var(--text-muted);font-size:13px">
      Presiona ▶ Iniciar para comenzar el test
    </div>
  `;
  el.appendChild(results);

  // Log
  const logBox = document.createElement('div');
  logBox.className = 'st-card';
  logBox.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:var(--text-muted);letter-spacing:.8px;margin-bottom:10px">
      📋 LOG
    </div>
    <div id="st-log" style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:2px"></div>
  `;
  el.appendChild(logBox);

  // ── State ─────────────────────────────────────────────────────────────────
  let running = false;
  const BASE = getBase();

  function _getToken() {
    if (window.playcamAuthToken) return window.playcamAuthToken;
    try {
      const raw = sessionStorage.getItem('auth_session') || localStorage.getItem('auth_session');
      return JSON.parse(raw || 'null')?.token || null;
    } catch (_) { return null; }
  }

  function _authHeaders() {
    const t = _getToken();
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  function _log(msg, type = '') {
    const log = document.getElementById('st-log');
    if (!log) return;
    const item = document.createElement('div');
    item.className = `st-log-item ${type}`;
    item.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    log.insertBefore(item, log.firstChild);
    // Keep max 40 entries
    while (log.children.length > 40) log.removeChild(log.lastChild);
  }

  function _setActive(cardId, active) {
    document.getElementById(cardId)?.classList.toggle('active', active);
  }

  function _fmtMbps(mbps) {
    if (mbps >= 1000) return (mbps / 1000).toFixed(2) + ' Gbps';
    if (mbps >= 10)   return mbps.toFixed(1) + ' Mbps';
    return mbps.toFixed(2) + ' Mbps';
  }

  // ── Ping test ─────────────────────────────────────────────────────────────
  async function runPing(samples = 16) {
    _log(`Iniciando test de ping (${samples} muestras)…`);
    _setActive('st-ping-card', true);
    const rttList = [];

    for (let i = 0; i < samples; i++) {
      const t0 = performance.now();
      try {
        await fetch(`${BASE}/api/speedtest/ping?t=${t0}`, { headers: _authHeaders() });
        const rtt = performance.now() - t0;
        rttList.push(rtt);

        const avg = rttList.reduce((a, b) => a + b, 0) / rttList.length;
        const bar = Math.min((avg / 200) * 100, 100);

        document.getElementById('st-ping-ms').textContent = avg.toFixed(1);
        document.getElementById('ping-bar').style.width = bar + '%';
        _log(`Ping #${i+1}: ${rtt.toFixed(1)} ms`, rtt < 50 ? 'ok' : '');
        await _sleep(100);
      } catch (err) {
        _log('Ping error: ' + err.message, 'err');
      }
    }

    const avg = rttList.reduce((a, b) => a + b, 0) / rttList.length;
    const min = Math.min(...rttList);
    const max = Math.max(...rttList);
    const jitter = Math.sqrt(rttList.reduce((s, v) => s + (v - avg) ** 2, 0) / rttList.length);

    document.getElementById('st-ping-ms').textContent = avg.toFixed(1);
    document.getElementById('st-jitter').textContent   = jitter.toFixed(1) + ' ms';
    document.getElementById('st-min-ping').textContent = min.toFixed(1) + ' ms';
    document.getElementById('st-max-ping').textContent = max.toFixed(1) + ' ms';

    _setActive('st-ping-card', false);
    _log(`Ping completo: avg=${avg.toFixed(1)}ms jitter=${jitter.toFixed(1)}ms`, 'ok');
    return { avg, min, max, jitter };
  }

  // ── Download test ─────────────────────────────────────────────────────────
  async function runDownload() {
    const MB = 30;
    _log(`Iniciando test de descarga (${MB} MB)…`);
    _setActive('st-dl-card', true);
    dlGauge.update(0, 1000, 'Descargando…');

    try {
      const t0  = performance.now();
      const res = await fetch(`${BASE}/api/speedtest/download?mb=${MB}&t=${t0}`, {
        headers: _authHeaders(),
      });

      const reader = res.body.getReader();
      let received = 0;
      let lastUpdate = t0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        const now    = performance.now();
        const elapsed = (now - t0) / 1000;
        if (elapsed > 0) {
          const mbps = (received * 8 / 1_000_000) / elapsed;
          if (now - lastUpdate > 100) {
            lastUpdate = now;
            dlGauge.update(mbps, 1000, `${_fmtMbps(mbps)}`);
            if (dlGauge._bar) dlGauge._bar.style.width = Math.min((mbps / 1000) * 100, 100) + '%';
            _log(`⬇ ${_fmtMbps(mbps)} — ${(received/1024/1024).toFixed(1)}/${MB} MB`);
          }
        }
      }

      const total = (performance.now() - t0) / 1000;
      const finalMbps = (received * 8 / 1_000_000) / total;
      dlGauge.update(finalMbps, 1000, 'Completo');
      if (dlGauge._bar) dlGauge._bar.style.width = Math.min((finalMbps / 1000) * 100, 100) + '%';
      _log(`⬇ Descarga: ${_fmtMbps(finalMbps)} (${(received/1024/1024).toFixed(1)} MB en ${total.toFixed(1)}s)`, 'ok');
      _setActive('st-dl-card', false);
      return finalMbps;
    } catch (err) {
      _log('Error descarga: ' + err.message, 'err');
      _setActive('st-dl-card', false);
      return 0;
    }
  }

  // ── Upload test ───────────────────────────────────────────────────────────
  async function runUpload() {
    const MB = 8;
    _log(`Iniciando test de subida (${MB} MB)…`);
    _setActive('st-ul-card', true);
    ulGauge.update(0, 1000, 'Subiendo…');

    const data = new Uint8Array(MB * 1024 * 1024);
    crypto.getRandomValues(data.slice(0, Math.min(data.length, 65536)));
    const blob = new Blob([data]);

    let uploadedMbps = 0;
    try {
      const t0 = performance.now();
      await fetch(`${BASE}/api/speedtest/upload?t=${t0}`, {
        method: 'POST',
        body: blob,
        headers: { 'Content-Type': 'application/octet-stream', ..._authHeaders() },
      });
      const total  = (performance.now() - t0) / 1000;
      uploadedMbps = (blob.size * 8 / 1_000_000) / total;
      ulGauge.update(uploadedMbps, 1000, 'Completo');
      if (ulGauge._bar) ulGauge._bar.style.width = Math.min((uploadedMbps / 1000) * 100, 100) + '%';
      _log(`⬆ Subida: ${_fmtMbps(uploadedMbps)} (${MB} MB en ${total.toFixed(1)}s)`, 'ok');
    } catch (err) {
      _log('Error subida: ' + err.message, 'err');
    }
    _setActive('st-ul-card', false);
    return uploadedMbps;
  }

  // ── Full test ─────────────────────────────────────────────────────────────
  async function startTest() {
    if (running) return;
    running = true;

    const startBtn = el.querySelector('#st-start');
    startBtn.disabled = true;
    startBtn.textContent = '⏳ Probando…';
    startBtn.style.animation = 'st-pulse 1s infinite';

    // Reset gauges
    dlGauge.update(0, 1000, '');
    ulGauge.update(0, 1000, '');
    document.getElementById('st-ping-ms').textContent = '—';
    document.getElementById('st-jitter').textContent  = '—';
    document.getElementById('st-min-ping').textContent = '—';
    document.getElementById('st-max-ping').textContent = '—';
    document.getElementById('ping-bar').style.width = '0%';
    if (dlGauge._bar) dlGauge._bar.style.width = '0%';
    if (ulGauge._bar) ulGauge._bar.style.width = '0%';
    document.getElementById('st-log').innerHTML = '';
    document.getElementById('st-results-body').innerHTML = '<div style="color:var(--text-muted)">Ejecutando…</div>';

    _log('=== Test iniciado ===');
    const t0 = performance.now();

    const ping   = await runPing(16);
    await _sleep(300);
    const dlMbps = await runDownload();
    await _sleep(400);
    const ulMbps = await runUpload();

    const totalTime = ((performance.now() - t0) / 1000).toFixed(1);
    _log(`=== Test completado en ${totalTime}s ===`, 'ok');

    // Quality rating
    const rating = _rateConnection(dlMbps, ulMbps, ping.avg);

    document.getElementById('st-results-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;animation:st-fadeUp .4s ease">
        <div class="st-result-row" style="grid-column:1/-1">
          <span style="font-size:13px;color:var(--text-muted)">Calidad de conexión</span>
          <span style="font-size:16px;font-weight:800;color:${rating.color}">${rating.emoji} ${rating.label}</span>
        </div>
        <div class="st-result-row">
          <span style="font-size:12px;color:var(--text-muted)">⬇ Descarga</span>
          <span style="font-size:14px;font-weight:800;color:#00BCD4">${_fmtMbps(dlMbps)}</span>
        </div>
        <div class="st-result-row">
          <span style="font-size:12px;color:var(--text-muted)">⬆ Subida</span>
          <span style="font-size:14px;font-weight:800;color:#1DB954">${_fmtMbps(ulMbps)}</span>
        </div>
        <div class="st-result-row">
          <span style="font-size:12px;color:var(--text-muted)">🏓 Ping</span>
          <span style="font-size:14px;font-weight:800;color:#FF6B35">${ping.avg.toFixed(1)} ms</span>
        </div>
        <div class="st-result-row">
          <span style="font-size:12px;color:var(--text-muted)">〜 Jitter</span>
          <span style="font-size:14px;font-weight:800;color:rgba(255,255,255,.7)">${ping.jitter.toFixed(1)} ms</span>
        </div>
        <div class="st-result-row" style="grid-column:1/-1">
          <span style="font-size:11px;color:var(--text-muted)">Duración del test</span>
          <span style="font-size:12px;color:var(--text-muted)">${totalTime}s</span>
        </div>
        <div style="grid-column:1/-1;font-size:11px;color:rgba(255,255,255,.25);padding-top:8px">
          ⚠️ Medición del servidor local (127.0.0.1). Para Internet use speedtest.net
        </div>
      </div>
    `;

    running = false;
    startBtn.disabled = false;
    startBtn.textContent = '🔄 Repetir test';
    startBtn.style.animation = '';
  }

  function _rateConnection(dl, ul, ping) {
    if (dl >= 100 && ul >= 50 && ping < 20) return { label: 'Excelente', emoji: '🚀', color: '#06D6A0' };
    if (dl >= 50  && ul >= 20 && ping < 50) return { label: 'Muy buena', emoji: '✅', color: '#1DB954' };
    if (dl >= 20  && ul >= 10 && ping < 80) return { label: 'Buena',     emoji: '👍', color: '#FFD700' };
    if (dl >= 5   && ul >= 2  && ping < 150)return { label: 'Regular',   emoji: '⚠️', color: '#FF6B35' };
    return { label: 'Lenta',  emoji: '🐢', color: '#FF3366' };
  }

  el.querySelector('#st-start').addEventListener('click', startTest);
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
