'use strict';
import store    from '../store.js';
import API      from '../utils/api.js';
import { sanitizeHTML } from '../utils/formatters.js';
import { showToast }    from './Modal.js';
import { t }            from '../utils/i18n.js';

export function renderHistory(el) {
  el.innerHTML = `
    <div class="topbar">
      <span class="topbar-title">${t('history')}</span>
      <span class="topbar-spacer"></span>
      <button class="btn btn-secondary btn-sm" id="btn-clear-history">🗑 ${t('clear_all')}</button>
    </div>
    <div class="history-list" id="history-list">
      <div class="flex-center" style="height:200px"><div class="spinner"></div></div>
    </div>`;

  el.querySelector('#btn-clear-history').addEventListener('click', async () => {
    await API.songs.clearHistory();
    el.querySelector('#history-list').innerHTML = _emptyHTML(t('hist_cleared'));
    showToast(t('hist_cleared'), 'info');
  });

  _loadHistory(el.querySelector('#history-list'));
}

async function _loadHistory(listEl) {
  let items;
  try { items = await API.songs.history(26); } catch (_) { items = []; }

  if (!items.length) {
    listEl.innerHTML = _emptyHTML(t('no_history'), t('history_sub'));
    return;
  }

  listEl.innerHTML = items.map((item, i) => {
    const typeClass = item.type === 'video' ? 'video' : 'audio';
    const typeIcon  = item.type === 'video' ? '🎬' : '🎵';

    const thumbHTML = item.thumbnail
      ? `<img class="history-thumb" src="${sanitizeHTML(API.thumbnailUrl(item.thumbnail))}" alt="">`
      : `<div class="history-thumb-placeholder">${typeIcon}</div>`;

    return `
      <div class="history-row" data-idx="${i}" role="button">
        <span class="history-num">${i + 1}</span>
        ${thumbHTML}
        <div class="history-info">
          <div class="history-title">${sanitizeHTML(item.title)}</div>
          <div class="history-meta">
            <span>${sanitizeHTML(item.artist || 'Unknown')}</span>
            <span class="history-dot">·</span>
            <span class="history-type-badge ${typeClass}">${item.type === 'video' ? t('type_video') : t('type_audio')}</span>
            <span class="history-dot">·</span>
            <span>${_timeAgo(item.played_at)}</span>
          </div>
        </div>
        <button class="history-play" title="Play">▶</button>
      </div>`;
  }).join('');

  // Build a clean queue from history (unique songs, keeping first occurrence)
  const seen   = new Set();
  const queue  = [];
  items.forEach(item => {
    if (!seen.has(item.id)) { seen.add(item.id); queue.push(item); }
  });

  listEl.querySelectorAll('.history-row').forEach((row, i) => {
    const song = items[i];
    row.addEventListener('click', () => store.playSong(song, queue));
    row.querySelector('.history-play').addEventListener('click', (e) => {
      e.stopPropagation();
      store.playSong(song, queue);
    });
  });
}

function _emptyHTML(heading, sub = '') {
  return `
    <div class="empty-state">
      <div class="empty-icon">🕐</div>
      <h3>${sanitizeHTML(heading)}</h3>
      ${sub ? `<p>${sanitizeHTML(sub)}</p>` : ''}
    </div>`;
}

function _timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return t('just_now');
  if (diff < 3600)  return `${Math.floor(diff / 60)}${t('time_ago_m')}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}${t('time_ago_h')}`;
  return `${Math.floor(diff / 86400)}${t('time_ago_d')}`;
}
