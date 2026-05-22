'use strict';

const { BrowserWindow, screen, app, shell } = require('electron');
const path = require('path');
const log  = require('electron-log');
const { IS_PROD, IS_DEV, DEVTOOLS } = require('./env');

let mainWindow    = null;
let miniPlayerWin = null;

// ── Opciones de webPreferences según el modo ─────────────────────────────────

function _webPrefs() {
  return {
    preload:                    path.join(__dirname, '..', '..', 'preload.js'),
    contextIsolation:           true,   // renderer no accede al proceso principal
    nodeIntegration:            false,  // no exponer Node.js al renderer
    sandbox:                    IS_PROD,// proceso renderer sandboxed en producción
    webSecurity:                true,   // bloquea mixed-content y same-origin violations
    allowRunningInsecureContent: false, // nunca cargar http dentro de https
    experimentalFeatures:       false,  // sin APIs experimentales de Chromium
    devTools:                   IS_DEV, // DevTools completamente deshabilitado en producción
  };
}

// ── Seguridad de navegación (aplicada a cualquier webContents) ────────────────

function _lockdown(win) {
  const wc = win.webContents;

  // Bloquear toda navegación que no sea file:// (el renderer no debe navegar a URLs externas)
  wc.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      log.warn(`[security] Blocked navigation → ${url}`);
    }
  });

  // Bloquear apertura de nuevas ventanas desde el renderer
  wc.setWindowOpenHandler(({ url }) => {
    // En dev permitir DevTools protocol (chrome-devtools://)
    if (IS_DEV && url.startsWith('chrome-devtools://')) return { action: 'allow' };
    log.warn(`[security] Blocked new-window → ${url}`);
    // Si la URL es http/https, abrirla en el navegador del sistema
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Bloquear redirecciones de frames internos a URLs externas
  wc.on('will-redirect', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://127.0.0.1')) {
      event.preventDefault();
      log.warn(`[security] Blocked redirect → ${url}`);
    }
  });

  // En producción: interceptar errores de certificado y denegarlos
  if (IS_PROD) {
    wc.on('certificate-error', (event, _url, _error, _cert, callback) => {
      event.preventDefault();
      callback(false); // denegar
    });
  }
}

// ── Ventana principal ─────────────────────────────────────────────────────────

function createWindow(serverPort) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width:           Math.min(1400, width  - 80),
    height:          Math.min(900,  height - 80),
    minWidth:        960,
    minHeight:       620,
    frame:           false,
    titleBarStyle:   'hidden',
    backgroundColor: '#0A0A0A',
    show:            false,
    webPreferences:  _webPrefs(),
    icon: path.join(__dirname, '..', '..', 'assets', 'icons', 'icon.png'),
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // DevTools: solo en desarrollo y solo si DEVTOOLS=true en .env
  if (DEVTOOLS) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // F12 toggle — solo disponible en modo desarrollo
  if (IS_DEV) {
    mainWindow.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') {
        mainWindow.webContents.isDevToolsOpened()
          ? mainWindow.webContents.closeDevTools()
          : mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    });
  }

  _lockdown(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });
  mainWindow.on('maximize',   () => mainWindow.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized', false));
  mainWindow.on('closed',     () => { mainWindow = null; });

  log.info(`Main window created [sandbox=${IS_PROD}, devTools=${IS_DEV}]`);
  return mainWindow;
}

// ── Ventana mini player ───────────────────────────────────────────────────────

function createMiniPlayerWindow() {
  if (miniPlayerWin && !miniPlayerWin.isDestroyed()) {
    miniPlayerWin.focus();
    return miniPlayerWin;
  }

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  miniPlayerWin = new BrowserWindow({
    width:           340,
    height:          420,
    minWidth:        300,
    minHeight:       360,
    maxWidth:        520,
    maxHeight:       620,
    x:               sw - 360,
    y:               sh - 450,
    frame:           false,
    transparent:     false,
    resizable:       true,
    movable:         true,
    alwaysOnTop:     true,
    skipTaskbar:     false,
    backgroundColor: '#111114',
    show:            false,
    webPreferences:  _webPrefs(),
    icon: path.join(__dirname, '..', '..', 'assets', 'icons', 'icon.png'),
  });

  miniPlayerWin.loadFile(path.join(__dirname, '..', 'renderer', 'mini-player.html'));

  _lockdown(miniPlayerWin);

  miniPlayerWin.once('ready-to-show', () => miniPlayerWin.show());
  miniPlayerWin.on('closed', () => {
    miniPlayerWin = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mini-player:closed');
    }
  });

  log.info('Mini-player window created');
  return miniPlayerWin;
}

function getMainWindow()     { return mainWindow; }
function getMiniPlayerWindow() { return miniPlayerWin; }

module.exports = { createWindow, getMainWindow, createMiniPlayerWindow, getMiniPlayerWindow };
