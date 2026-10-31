'use strict';
// Live Poll server. Zero dependencies. Usage: node poll/server.js [port]
// Audience votes at "/", the presenter shows "/results". State is in memory (restart = fresh poll).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Poll, PollError } = require('./poll');

const PUBLIC_DIR = path.join(__dirname, 'public');
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/results': ['results.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
};
const MAX_BODY = 8 * 1024;

function defaultPoll() {
  return new Poll('Which should we build next?', ['A game', 'A dashboard', 'A chat app', 'Something weird']);
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new PollError('Request body too large', 413)); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
        resolve(body);
      } catch { reject(new PollError('Body must be a JSON object')); }
    });
    req.on('error', reject);
  });
}

function createServer({ poll = defaultPoll() } = {}) {
  let current = poll;
  const clients = new Set();

  function broadcast() {
    const message = 'data: ' + JSON.stringify(current.results()) + '\n\n';
    for (const res of clients) res.write(message);
  }

  function openStream(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.write('retry: 2000\n\ndata: ' + JSON.stringify(current.results()) + '\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
  }

  async function handleApi(req, res, url) {
    const route = url.pathname;
    if (route === '/api/poll' && req.method === 'GET') return sendJson(res, 200, current.results());
    if (route === '/api/poll' && req.method === 'POST') {
      const body = await readJson(req);
      current = new Poll(body.question, body.options);
      broadcast();
      return sendJson(res, 201, current.results());
    }
    if (route === '/api/vote' && req.method === 'POST') {
      const body = await readJson(req);
      current.vote(body.voter, body.option);
      broadcast();
      return sendJson(res, 200, current.results());
    }
    if (route === '/api/stream' && req.method === 'GET') return openStream(req, res);
    throw new PollError('Not found', 404);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      const entry = STATIC[url.pathname];
      if (!entry || req.method !== 'GET') { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': entry[1] });
      fs.createReadStream(path.join(PUBLIC_DIR, entry[0])).pipe(res);
    } catch (err) {
      if (err instanceof PollError) return sendJson(res, err.status, { error: err.message });
      console.error(err);
      sendJson(res, 500, { error: 'Something went wrong' });
    }
  });

  // Open event streams never end by themselves, so end them before closing.
  const close = server.close.bind(server);
  server.close = (callback) => {
    for (const res of clients) res.end();
    clients.clear();
    return close(callback);
  };
  return server;
}

if (require.main === module) {
  const port = Number(process.argv[2] || process.env.PORT || 8100);
  createServer().listen(port, () => {
    console.log('Live Poll running. Audience: http://localhost:' + port + '/  Presenter: http://localhost:' + port + '/results');
  });
}

module.exports = { createServer };
