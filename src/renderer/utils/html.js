/**
 * html.js — Shared HTML string builder utilities.
 *
 * All functions return plain HTML strings — zero DOM manipulation.
 * Safe to import from any plugin or renderer component.
 *
 * Design rule: callers escape values before passing them in via esc()/attr().
 * These builders trust their inputs and compose them into markup.
 *
 * @module html
 */

/**
 * Escapes a value for safe insertion as HTML text content.
 * Replaces &, <, >, and " with HTML entities.
 * Handles null/undefined gracefully (returns empty string).
 *
 * @param {*} v
 * @returns {string}
 *
 * @example
 *   `<div>${esc(user.name)}</div>`
 */
export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Escapes a value for safe use inside a single-quoted HTML attribute.
 *
 * @param {*} v
 * @returns {string}
 *
 * @example
 *   `<img src='${attr(url)}'>`
 */
export function attr(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Stat row card — icon + large value + small label beneath it.
 * Used in dashboard plugin widgets to show quick counts.
 *
 * Renders with --bg-3 background and CSS variable colors, so it adapts
 * to all 12 app themes automatically.
 *
 * @param {string}        icon  - Emoji or SVG string shown on the left.
 * @param {string}        label - Caption shown below the value (small text).
 * @param {string|number} value - The main numeric or text value (large bold).
 * @returns {string} HTML string.
 *
 * @example
 *   grid(2, '8px', statRow('📝', 'Total', notes.length), statRow('📅', 'Con fecha', 3))
 */
export function statRow(icon, label, value) {
  return `<div style="background:var(--bg-3);border-radius:var(--radius-sm);
    padding:10px 12px;display:flex;align-items:center;gap:8px">
    <span style="font-size:18px">${icon}</span>
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text-primary)">${value}</div>
      <div style="font-size:11px;color:var(--text-muted)">${label}</div>
    </div>
  </div>`;
}

/**
 * Colored status badge span.
 * Background and border are derived from the same color at reduced opacity.
 *
 * @param {string} label - Badge text (HTML-escaped internally).
 * @param {string} color - Hex or CSS color value (e.g. '#10b981').
 * @returns {string} HTML <span> string.
 *
 * @example
 *   badge('Cliente', '#10b981')
 */
export function badge(label, color) {
  return `<span class="status-badge"
    style="background:${color}22;color:${color};border-color:${color}44">${esc(label)}</span>`;
}

/**
 * CSS grid wrapper.
 * Wraps children HTML strings in a display:grid container.
 *
 * @param {number}    cols       - Number of equal-width columns.
 * @param {string}    gap        - CSS gap value (e.g. '8px', '12px').
 * @param {...string} children   - HTML strings to place as grid cells.
 * @returns {string} HTML string.
 *
 * @example
 *   grid(2, '8px', statRow('📝', 'Total', 42), statRow('📅', 'Con fecha', 3))
 *   grid(2, '12px', formGroup({...}), formGroup({...}))
 */
export function grid(cols, gap, ...children) {
  return `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:${gap}">${children.join('')}</div>`;
}

/**
 * Form-group block — wrapper div + label + input/textarea/select control.
 *
 * Produces exactly the `.form-group > label + .form-control` structure
 * expected by main.css and markFieldErrors(). Use this instead of writing
 * the same three-line pattern in every modal.
 *
 * Supported types: 'text' | 'email' | 'tel' | 'date' | 'textarea' | 'select' | 'hidden'
 *
 * For 'hidden': returns a bare <input type="hidden"> (no wrapper, no label).
 *
 * @param {object}  o
 * @param {string}  o.label        - Visible label text (not escaped — can contain HTML).
 * @param {string}  o.id           - Element id, also used as data-field unless dataField is set.
 * @param {string}  [o.type]       - Control type (default 'text').
 * @param {string}  [o.placeholder]
 * @param {string}  [o.value]      - Pre-filled value. Caller must escape it with esc() first.
 * @param {number}  [o.rows]       - Textarea row height (default 3).
 * @param {string}  [o.options]    - Raw <option> HTML string for select.
 * @param {string}  [o.wrapStyle]  - Extra inline CSS on the .form-group wrapper div.
 * @param {string}  [o.dataField]  - data-field attribute value. Defaults to o.id.
 * @param {string}  [o.extra]      - Extra HTML appended inside .form-group after the control.
 * @returns {string} HTML string.
 *
 * @example
 *   formGroup({ label: 'Nombre *', id: 'cf-name', dataField: 'name', placeholder: 'Nombre completo', value: esc(c.name) })
 *   formGroup({ label: 'Notas', id: 'cf-notes', type: 'textarea', rows: 4, value: esc(c.notes) })
 *   formGroup({ label: 'Estado', id: 'cf-status', type: 'select', dataField: 'status', options: statusOpts })
 */
export function formGroup({
  label,
  id,
  type        = 'text',
  placeholder = '',
  value       = '',
  rows        = 3,
  options     = '',
  wrapStyle   = '',
  dataField,
  extra       = '',
}) {
  const df   = dataField || id;
  const wrap = wrapStyle ? ` style="${wrapStyle}"` : '';

  // Hidden inputs don't get a wrapper or label
  if (type === 'hidden') return `<input type="hidden" id="${id}" value="${value}">`;

  let ctrl;
  if (type === 'textarea') {
    ctrl = `<textarea class="form-control" id="${id}" data-field="${df}"
      rows="${rows}" placeholder="${placeholder}" style="resize:vertical">${value}</textarea>`;
  } else if (type === 'select') {
    ctrl = `<select class="form-control" id="${id}" data-field="${df}">${options}</select>`;
  } else {
    ctrl = `<input class="form-control" id="${id}" data-field="${df}"
      type="${type}" placeholder="${placeholder}" value="${value}">`;
  }

  return `<div class="form-group"${wrap}><label>${label}</label>${ctrl}${extra}</div>`;
}
