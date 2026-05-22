'use strict';

export function logError(err) {
  const msg = err instanceof Error
    ? `ERROR: ${err.name}: ${err.message}${err.stack ? '\n' + err.stack : ''}`
    : `ERROR: ${String(err)}`;
  console.error('[ErrorHandler]', err);
  window.electronAPI?.logError?.(msg);
}

export function logWarn(msg) {
  console.warn('[Warn]', msg);
  window.electronAPI?.logError?.(`WARN: ${String(msg)}`);
}

export function initErrorHandler() {
  window.onerror = (_msg, _src, _line, _col, err) => {
    logError(err || `${_msg} (${_src}:${_line}:${_col})`);
    return false;
  };
  window.addEventListener('unhandledrejection', (e) => {
    logError(e.reason || 'Unhandled promise rejection');
  });
}
