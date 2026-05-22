/**
 * ui.js — Reusable UI block builders.
 *
 * Higher-level components that return HTML strings or attach DOM events.
 * Built on top of CSS classes already defined in main.css so they adapt
 * to all 12 app themes automatically.
 *
 * Import pattern (from a plugin view):
 *   import { emptyState, loading, viewHeader, filterBar, wireFilters, recentList, alertBanner }
 *     from '../../../../src/renderer/components/ui.js';
 *
 * Import pattern (from a renderer component):
 *   import { emptyState, loading, ... } from '../components/ui.js';
 *
 * @module ui
 */

/**
 * Full empty-state block: large icon + heading + optional description text.
 *
 * Renders using the `.empty-state` CSS class from main.css (centered, faded).
 * Pass a plugin-specific class (e.g. 'ct-empty') via `cls` if the plugin
 * defines its own empty-state styling.
 *
 * @param {object}  o
 * @param {string}  [o.icon='📭']  - Large emoji shown above the heading.
 * @param {string}  o.title        - Heading text (h3).
 * @param {string}  [o.desc]       - Optional sub-text (p tag).
 * @param {string}  [o.cls]        - Root element CSS class (default 'empty-state').
 * @returns {string} HTML string.
 *
 * @example
 *   container.innerHTML = emptyState({ icon: '👥', title: 'Sin contactos', desc: 'Agrega el primero.' });
 */
export function emptyState({ icon = '📭', title, desc = '', cls = 'empty-state' }) {
  return `<div class="${cls}">
    <div class="empty-icon">${icon}</div>
    <h3>${title}</h3>
    ${desc ? `<p>${desc}</p>` : ''}
  </div>`;
}

/**
 * Centered loading spinner block.
 *
 * Uses `.flex-center` and `.spinner` from main.css (spin animation included).
 *
 * @param {string} [height='200px'] - Fixed height of the container.
 * @returns {string} HTML string.
 *
 * @example
 *   listEl.innerHTML = loading();
 *   listEl.innerHTML = loading('120px');
 */
export function loading(height = '200px') {
  return `<div class="flex-center" style="height:${height}"><div class="spinner"></div></div>`;
}

/**
 * Page view header — title on the left, optional action area on the right.
 *
 * @param {string} title           - Header title (emoji + text, e.g. '👥 Contactos').
 * @param {string} [right]         - HTML injected right-aligned (search input, button…).
 * @param {string} [cls]           - Wrapper CSS class (default 'plugin-header').
 * @returns {string} HTML string.
 *
 * @example
 *   viewHeader('👥 Contactos',
 *     `<input id="search" class="form-control" placeholder="🔍 Buscar…" style="width:200px">
 *      <button id="new-btn">+ Nuevo</button>`,
 *     'ct-header')
 */
export function viewHeader(title, right = '', cls = 'plugin-header') {
  return `<div class="${cls}">
    <h2>${title}</h2>
    ${right ? `<div style="display:flex;gap:8px;align-items:center">${right}</div>` : ''}
  </div>`;
}

/**
 * Horizontal filter button strip.
 *
 * Generates a wrapper div containing one button per item. The active button
 * gets the `.active` class. Each button carries a `data-{dataAttr}` attribute
 * holding its value so wireFilters() can read it.
 *
 * @param {Array<{label:string, value:string}>} items  - Filter options.
 * @param {string} activeVal                           - Currently active value.
 * @param {object} [opts]
 * @param {string} [opts.dataAttr='filter']  - data-* attribute name on each button.
 * @param {string} [opts.btnClass]           - CSS class for each button.
 * @param {string} [opts.wrapClass]          - CSS class for the wrapper div.
 * @param {string} [opts.wrapId]             - Optional id for the wrapper div.
 * @returns {string} HTML string.
 *
 * @example
 *   filterBar(FILTERS, _activeStatus, { dataAttr: 'status', btnClass: 'ct-filter', wrapClass: 'ct-filters' })
 */
export function filterBar(items, activeVal, {
  dataAttr  = 'filter',
  btnClass  = 'filter-btn',
  wrapClass = 'filter-bar',
  wrapId    = '',
} = {}) {
  const idAttr = wrapId ? ` id="${wrapId}"` : '';
  return `<div class="${wrapClass}"${idAttr}>${items.map(f =>
    `<button class="${btnClass}${f.value === activeVal ? ' active' : ''}"
      data-${dataAttr}="${f.value}">${f.label}</button>`
  ).join('')}</div>`;
}

/**
 * Wires click events for a filter button strip produced by filterBar().
 *
 * Marks the clicked button as `.active`, removes it from all others, then
 * calls onChange with the new value string.
 *
 * @param {Element}  el        - Root element (scopes querySelectorAll).
 * @param {string}   btnSel    - CSS selector for the filter buttons (e.g. '.ct-filter').
 * @param {string}   dataAttr  - data-* attribute to read (camelCase into dataset, e.g. 'status').
 * @param {function(string):void} onChange - Called with the new active value.
 *
 * @example
 *   wireFilters(el, '.ct-filter', 'status', val => {
 *     _activeStatus = val;
 *     _refresh();
 *   });
 */
export function wireFilters(el, btnSel, dataAttr, onChange) {
  el.querySelectorAll(btnSel).forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll(btnSel).forEach(b => b.classList.toggle('active', b === btn));
      onChange(btn.dataset[dataAttr] ?? '');
    });
  });
}

/**
 * Recent-items list separated from stats above it by a top border.
 * Returns an empty string when items is empty (renders nothing — no border shown).
 *
 * @param {Array}    items      - Data items to render.
 * @param {function} renderItem - (item) => HTML string for one row.
 * @returns {string} HTML string (or '' if empty).
 *
 * @example
 *   recentList(contacts.slice(0, 3), c =>
 *     `<span>${esc(c.name)}</span>`)
 */
export function recentList(items, renderItem) {
  if (!items.length) return '';
  return `<div style="border-top:1px solid var(--border);padding-top:8px;
    display:flex;flex-direction:column;gap:5px">${items.map(renderItem).join('')}</div>`;
}

/**
 * Colored info/warning alert banner.
 *
 * Defaults to a red warning style (used for overdue-task banners).
 * Pass custom bg/border/color for other severity levels.
 *
 * @param {string} text - Banner message (can contain HTML).
 * @param {object} [opts]
 * @param {string} [opts.bg]     - Background CSS color (default low-opacity red).
 * @param {string} [opts.border] - Border CSS color (default low-opacity red).
 * @param {string} [opts.color]  - Text color (default 'var(--red)').
 * @returns {string} HTML string.
 *
 * @example
 *   alertBanner(`⚠ Tienes ${n} tareas vencidas`)
 *   alertBanner('✓ Guardado', { bg: 'rgba(16,185,129,.1)', border: 'rgba(16,185,129,.25)', color: 'var(--green)' })
 */
export function alertBanner(text, {
  bg     = 'rgba(255,50,50,.1)',
  border = 'rgba(255,50,50,.25)',
  color  = 'var(--red)',
} = {}) {
  return `<div style="background:${bg};border:1px solid ${border};
    border-radius:var(--radius-sm);padding:8px 12px;font-size:12px;color:${color}">${text}</div>`;
}
