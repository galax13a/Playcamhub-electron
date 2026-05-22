'use strict';

const { app } = require('electron');

/**
 * IS_PROD — true cuando la app está empaquetada por electron-builder
 *            o cuando NODE_ENV=production.
 *           Controla DevTools, sandbox, flags de Chromium y CSP estricto.
 *
 * IS_DEV   — inverso de IS_PROD.
 *
 * DEVTOOLS — abre DevTools automáticamente SOLO en modo dev.
 *            Actívalo con DEVTOOLS=true en .env.
 *            En producción siempre es false, sin excepción.
 */
const IS_PROD  = app.isPackaged || process.env.NODE_ENV === 'production';
const IS_DEV   = !IS_PROD;
const DEVTOOLS = IS_DEV && process.env.DEVTOOLS === 'true';

module.exports = { IS_PROD, IS_DEV, DEVTOOLS };
