'use strict';
// Security settings for the MathPath desktop window. Kept free of Electron
// imports so they can be unit-tested with plain Node.

// Same policy is set as a <meta> tag in the root index.html (file:// pages get
// no HTTP headers); a test keeps the two in sync. Own scripts and styles only:
// no inline script, no eval, no network, no plugins.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// Network schemes the app never needs; every request to them is cancelled.
const BLOCKED_URL_PATTERNS = ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*', 'ftp://*/*'];

function webPreferences(isPackaged) {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
    experimentalFeatures: false,
    safeDialogs: true,
    // DevTools only when running from source (npm start).
    devTools: !isPackaged,
  };
}

// Fuses are flipped in the packaged binary by electron-builder (build.electronFuses).
const FUSES = {
  runAsNode: false,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableEmbeddedAsarIntegrityValidation: true,
  onlyLoadAppFromAsar: true,
};

module.exports = { CSP, BLOCKED_URL_PATTERNS, webPreferences, FUSES };
