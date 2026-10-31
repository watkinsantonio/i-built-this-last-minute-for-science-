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

## Notes

- The window can only show MathPath's own page; links and pop-ups are blocked, and Node is not exposed to the page.
- Best scores are saved in the app's own storage (per user, per machine).
- Tests: `npm test` from the repo root also covers `desktop/` (it does not need Electron installed).
