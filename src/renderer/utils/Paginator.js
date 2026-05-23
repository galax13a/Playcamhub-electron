'use strict';

/**
 * Paginator — universal AJAX paginator component.
 *
 * Usage:
 *   const pager = new Paginator({
 *     container:      el.querySelector('#my-section'),
 *     fetchFn:        async ({ page, perPage, ...params }) => ({ items: [...], total: N }),
 *     renderFn:       (items, listEl, refresh) => { listEl.innerHTML = ...; },
 *     defaultPerPage: 12,          // optional — defaults to 12
 *     perPageOptions: [5,12,25,50,100], // optional — override available choices
 *   });
 *   // optionally set extra query params (search, status, etc.)
 *   pager.setParams({ status: 'pending' });
 *   await pager.mount();
 *
 * Renders inside `container`:
 *   <div class="pgr-list">   ← plugin fills this via renderFn
 *   <div class="pgr-foot">   ← paginator controls (info + pages + per-page)
 */

const PER_PAGE_OPTIONS_DEFAULT = [5, 12, 25, 50, 100];

export class Paginator {
  constructor({ container, fetchFn, renderFn, defaultPerPage = 12, perPageOptions } = {}) {
    this._perPageOptions = perPageOptions ?? PER_PAGE_OPTIONS_DEFAULT;
    this._container  = container;
    this._fetchFn    = fetchFn;
    this._renderFn   = renderFn;
    this._page       = 1;
    this._perPage    = perPageOptions?.includes(defaultPerPage) ?? true ? defaultPerPage : (perPageOptions?.[0] ?? defaultPerPage);
    this._total      = 0;
    this._loading    = false;
    this._params     = {};
    this._listEl     = null;
    this._footEl     = null;
    this._mounted    = false;
  }

  /** Update extra query params (resets to page 1). Chainable. */
  setParams(params) {
    this._params = { ...params };
    this._page   = 1;
    return this;
  }

  /** Initial mount + first fetch. Call once. */
  async mount() {
    this._container.innerHTML = `
      <div class="pgr-list" id="pgr-list-${this._uid()}"></div>
      <div class="pgr-foot" id="pgr-foot-${this._uid()}"></div>`;
    this._listEl  = this._container.querySelector('[id^="pgr-list"]');
    this._footEl  = this._container.querySelector('[id^="pgr-foot"]');
    this._mounted = true;
    await this._fetch();
  }

  /** Re-fetch with current page + params (called after create/update/delete). */
  async refresh() {
    if (!this._mounted) return this.mount();
    await this._fetch();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  async _fetch() {
    if (this._loading) return;
    this._loading = true;
    this._listEl.innerHTML = '<div class="pgr-loading">Cargando…</div>';
    try {
      const result = await this._fetchFn({ page: this._page, perPage: this._perPage, ...this._params });
      this._total  = result.total ?? 0;
      // Clamp page to valid range after deletion, etc.
      const maxPage = Math.max(1, Math.ceil(this._total / this._perPage));
      if (this._page > maxPage) { this._page = maxPage; return this._fetch(); }
      this._renderFn(result.items, this._listEl, () => this.refresh());
      this._renderFooter();
    } catch (err) {
      const is404 = err.status === 404;
      this._listEl.innerHTML = `<div class="pgr-empty" style="color:var(--text-muted)">
        ${is404 ? '⚠ Plugin no disponible. Actívalo desde el panel de administración.' : `Error: ${err.message || 'Error desconocido'}`}
      </div>`;
      this._footEl.innerHTML = '';
    } finally {
      this._loading = false;
    }
  }

  _renderFooter() {
    const totalPages = Math.max(1, Math.ceil(this._total / this._perPage));
    const start      = this._total === 0 ? 0 : (this._page - 1) * this._perPage + 1;
    const end        = Math.min(this._page * this._perPage, this._total);

    const perPageOpts = this._perPageOptions.map(n =>
      `<option value="${n}" ${n === this._perPage ? 'selected' : ''}>${n}</option>`
    ).join('');

    const pages   = _buildPageRange(this._page, totalPages);
    const pagesBtns = pages.map(p =>
      p === '…'
        ? `<span class="pgr-ellipsis">…</span>`
        : `<button class="pgr-page-btn ${p === this._page ? 'pgr-active' : ''}" data-p="${p}">${p}</button>`
    ).join('');

    this._footEl.innerHTML = `
      <div class="pgr-foot-inner">
        <span class="pgr-info">${this._total} registros · ${start}–${end}</span>
        <div class="pgr-pages">
          <button class="pgr-nav-btn" data-p="${this._page - 1}" ${this._page <= 1 ? 'disabled' : ''} title="Anterior">‹</button>
          ${pagesBtns}
          <button class="pgr-nav-btn" data-p="${this._page + 1}" ${this._page >= totalPages ? 'disabled' : ''} title="Siguiente">›</button>
        </div>
        <label class="pgr-per-page-wrap">
          Por página
          <select class="pgr-per-page-sel">${perPageOpts}</select>
        </label>
      </div>`;

    this._footEl.querySelectorAll('[data-p]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.p);
        if (!isNaN(p) && p >= 1 && p <= totalPages && p !== this._page) {
          this._page = p;
          this._fetch();
        }
      });
    });

    this._footEl.querySelector('.pgr-per-page-sel')?.addEventListener('change', e => {
      this._perPage = parseInt(e.target.value);
      this._page    = 1;
      this._fetch();
    });
  }

  _uid() {
    if (!this.__uid) this.__uid = Math.random().toString(36).slice(2, 8);
    return this.__uid;
  }
}

/** Compact page range builder: [1, …, 4, 5, 6, …, 12] */
function _buildPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set();
  set.add(1); set.add(total);
  for (let d = -2; d <= 2; d++) {
    const p = current + d;
    if (p >= 1 && p <= total) set.add(p);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i]);
    if (i + 1 < sorted.length && sorted[i + 1] - sorted[i] > 1) result.push('…');
  }
  return result;
}
