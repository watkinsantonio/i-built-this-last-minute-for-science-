# MathPath desktop app

An Electron wrapper around the MathPath web app. It runs offline in its own window; no browser needed.
The web files in the repo root are the source of truth: `prepare.js` copies them into `desktop/app/` (git-ignored) before every run or build.

You need [Node.js](https://nodejs.org) 18+ and internet for the first `npm install` (it downloads Electron).

## Run it

```
cd desktop
npm install
npm start
```

## Build an installer

Run on the OS you are building for (Windows builds on Windows, Mac on Mac, Linux on Linux):

```
cd desktop
npm run dist:win     # Windows installer (.exe, NSIS)
npm run dist:mac     # macOS .dmg
npm run dist:linux   # Linux .AppImage
```

The installer lands in `desktop/dist/`. Double-click it to install MathPath like any other app.
It is unsigned, so Windows SmartScreen / macOS Gatekeeper will warn the first time (choose "More info → Run anyway" on Windows, right-click → Open on Mac).

## Status

The tests (including the icon file and the security settings) and file-copy step are automated. The Electron window and the installer builds (`npm start`, `npm run dist:*`) have **not been run yet**: they were written in an environment that could not download Electron or open a window. If either fails on your machine, please report the error message.

Electron and electron-builder are pinned to current majors; Electron gets its security fixes through new releases, so bump `electron` in `package.json` periodically and rebuild.

## App icon

`assets/icon.png` (1024×1024, a tile with + − × ÷ in the app's indigo/teal) is used for the window, the taskbar and the installers; electron-builder converts it to `.ico`/`.icns`. To change the design, edit `make-icon.js` and run `npm run icon` (no dependencies; it writes the PNG by hand).

## Security

- **Sandboxed window:** context isolation, OS sandbox (`app.enableSandbox()`), no Node in the page, no `<webview>`, web security on, DevTools off in installed builds (still available with `npm start`).
- **Locked to its own page:** navigation, redirects and pop-ups to anything else are blocked, for every window.
- **Offline for real:** any `http(s)`/`ws(s)`/`ftp` request is cancelled, and a Content-Security-Policy (set in `index.html`, tested to match `security.js`) allows only the app's own script and style files, with no inline code or `eval`.
- **No permissions:** camera, microphone, location, notifications etc. are always denied.
- **Hardened installer:** electron-builder flips Electron "fuses" so the packaged app can't be run as plain Node (`ELECTRON_RUN_AS_NODE`), ignores `NODE_OPTIONS`/`--inspect`, and only loads (integrity-checked) code from its `app.asar`.
- **Single instance:** a second launch focuses the existing window.
- Not included: code signing (needs a paid certificate) and auto-update. Installers are unsigned, see above.
- The icon, window hardening and fuses have only been checked by unit tests and `node --check`; they have **not** been run in a real Electron window or installer build.

## Notes

- The window can only show MathPath's own page; links, redirects and pop-ups are blocked, and Node is not exposed to the page.
- Best scores are saved in the app's own storage (per user, per machine).
- Tests: `npm test` from the repo root also covers `desktop/` (it does not need Electron installed).
