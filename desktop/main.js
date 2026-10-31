'use strict';
const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const { isAllowedNavigation } = require('./nav');
const { webPreferences, BLOCKED_URL_PATTERNS } = require('./security');

const INDEX = path.join(__dirname, 'app', 'index.html');
const ICON = path.join(__dirname, 'assets', 'icon.png');

// Run every renderer in the OS sandbox (must be called before the app is ready).
app.enableSandbox();
// Gives the Windows taskbar/installer the right identity and icon.
app.setAppUserModelId('com.mathpath.desktop');

// Applies to every window and frame, including ones created later.
app.on('web-contents-created', (_event, contents) => {
  const guard = (event, url) => {
    if (!isAllowedNavigation(url, INDEX)) event.preventDefault();
  };
  contents.on('will-navigate', guard);
  contents.on('will-redirect', guard);
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

function lockDownSession(ses) {
  // MathPath needs no camera, microphone, location, notifications, etc.
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  // Fully offline app: cancel any network request.
  ses.webRequest.onBeforeRequest({ urls: BLOCKED_URL_PATTERNS }, (_details, callback) => callback({ cancel: true }));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 760,
    minWidth: 480,
    minHeight: 560,
    title: 'MathPath',
    icon: ICON,
    autoHideMenuBar: true,
    webPreferences: webPreferences(app.isPackaged),
  });
  win.loadFile(INDEX);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    lockDownSession(session.defaultSession);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
