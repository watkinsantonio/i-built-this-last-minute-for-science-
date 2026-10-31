# MathPath

A tiny adaptive math practice app, built to show off to a group. No install, no internet, no build step.

## Run it

- **Easiest:** double-click `index.html` (any modern browser). It works offline.
- **Or serve it:** `npm start` then open http://localhost:8080 (or `node serve.js 3000`).

- **Desktop app:** see [`desktop/README.md`](desktop/README.md) (`cd desktop && npm install && npm start`, or build an installer with `npm run dist:win|mac|linux`).

Tip for presenting: press F11 for full screen. The text is large for projectors.

## What it does

- Pick a topic: addition, subtraction, multiplication, division, fractions or mixed.
- 10 questions per round. Difficulty (levels 1–5) goes up after 3 right in a row and down after 2 wrong in a row.
- Hints, instant feedback, an end-of-round review, and best score per topic (saved in the browser).
- Fraction answers must be in simplest form (`3/4`, not `6/8`). Decimals like `0.75` are accepted.

## Files

- `quiz.js` – question generation, grading and adaptive logic (no DOM, seeded and replayable)
- `app.js`, `style.css`, `index.html` – the UI
- `quiz.test.js` – tests: `npm test` (Node 18+)
- `serve.js` – optional zero-dependency static server
