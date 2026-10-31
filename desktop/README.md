# MathPath desktop app

An Electron wrapper around the MathPath web app. It runs offline in its own window; no browser needed.
The web files in the repo root are the source of truth: `prepare.js` copies them into `desktop/app/` (git-ignored) before every run or build.

You need [Node.js](https://nodejs.org) 22.12+ (Electron 45 and its downloader require it; the web version and `npm test` at the repo root only need Node 18+) and internet for the first `npm install` (it downloads Electron).

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

- **Sandboxed window:** context isolation, renderer sandbox (`sandbox: true`, plus `app.enableSandbox()`), no Node in the page, no `<webview>`, web security on, DevTools off in installed builds (still available with `npm start`).
- **Locked to its own page:** navigation, redirects and pop-ups to anything else are blocked, for every window.
- **Offline for real:** any `http(s)`/`ws(s)`/`ftp` request is cancelled, and a Content-Security-Policy (added to the desktop copy of `index.html` by `prepare.js`, so the plain web version is unaffected) allows only the app's own script and style files, with no inline code or `eval`.
- **No permissions:** camera, microphone, location, notifications etc. are always denied.
- **Hardened installer:** electron-builder flips Electron "fuses" so the packaged app can't be run as plain Node (`ELECTRON_RUN_AS_NODE`), ignores `NODE_OPTIONS`/`--inspect`, and only loads (integrity-checked) code from its `app.asar`.
- **Single instance:** a second launch focuses the existing window.
- Not included: code signing (needs a paid certificate) and auto-update. Installers are unsigned, see above.
- The icon, window hardening and fuses have only been checked by unit tests and `node --check`; they have **not** been run in a real Electron window or installer build.

## First-run checklist (not yet done by anyone)

1. `npm start`, then press Ctrl+Shift+I (Cmd+Opt+I on Mac) → Console. MathPath should be styled and playable, with **no** "Content Security Policy" errors. If the page is blank or unstyled, the policy's `'self'` is not matching `file://` in your Electron version: loosen `script-src`/`style-src` in `security.js` (e.g. add `file:`) and tell us.
2. Check the window and taskbar show the new icon.
3. `npm run dist:win` (or `dist:mac`/`dist:linux`), install and launch the result. If the **installed** app will not start, remove `enableEmbeddedAsarIntegrityValidation` from `FUSES` in `security.js` and from `build.electronFuses` in `package.json` (a test keeps them equal), rebuild, and report it. That fuse only has an effect on Windows and macOS.
4. Deleting any of the `electronFuses` entries is safe; they only harden the packaged app.

## Linux note

The AppImage runs Chromium's sandbox. On distros that restrict unprivileged user namespaces (for example Ubuntu 23.10 / 24.04) an AppImage can fail at start with a "SUID sandbox helper" error. Workaround: run it as `./MathPath-*.AppImage --no-sandbox` (this turns the OS sandbox off for that run, so only do it for this trusted app), or allow user namespaces on your system (`sysctl kernel.apparmor_restrict_unprivileged_userns=0`). Not tested here.

## Notes

- The window can only show MathPath's own page; links, redirects and pop-ups are blocked, and Node is not exposed to the page.
- Best scores are saved in the app's own storage (per user, per machine).
- Tests: `npm test` from the repo root also covers `desktop/` (it does not need Electron installed).
- See the first-run checklist and Linux note above before relying on the packaged app.
