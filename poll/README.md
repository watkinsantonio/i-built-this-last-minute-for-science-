# Live Poll

A live audience poll for presenting. People vote on their phones, and the bars on the big screen move as votes arrive. Zero dependencies, no build step, Node 18+.

## Run it

```
npm run start:poll        # http://localhost:8100  (or: node poll/server.js 3000)
```

- **Audience** opens `http://<your-ip>:8100/` on their phones (same Wi-Fi) and taps a choice. They can tap another choice to change their vote.
- **Presenter** opens `http://localhost:8100/results` on the projector. Use "Start a new poll" there to set a question and 2 to 8 options.

## Notes

- Live updates use Server-Sent Events (`/api/stream`); the browser reconnects by itself.
- One vote per browser (a random id kept in `localStorage`). This is a friendly demo limit, not security: anyone can clear storage and vote again.
- State is in memory only. Restarting the server starts a fresh default poll.
- There is no login. Anyone who can reach the server can open `/results` and start a new poll, so only use it on a trusted network.

## Files

- `poll.js` – poll rules: validation, one vote per voter, results (no HTTP, no DOM)
- `server.js` – HTTP API and event stream
- `public/` – the audience page (`index.html`), presenter page (`results.html`), `app.js`, `style.css`
- `poll.test.js` – tests: `npm test`

## API

- `GET /api/poll` – current results
- `POST /api/poll` `{question, options: [..]}` – start a new poll
- `POST /api/vote` `{voter, option}` – `option` is the index of the choice
- `GET /api/stream` – event stream of results
