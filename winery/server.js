'use strict';
// Winery Finder server. Zero dependencies. Usage: node winery/server.js [port]
// Data is saved to winery/data/winery.json (override with WINERY_DATA=/path/file.json).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Store, ValidationError } = require('./store');
const { nearest, isValidLat, isValidLng } = require('./geo');
const { discoverWineries, geocode } = require('./osm');

const PUBLIC_DIR = path.join(__dirname, 'public');
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
};
const MAX_BODY = 64 * 1024;

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
      if (size > MAX_BODY) { reject(new ValidationError('Request body too large', 413)); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new ValidationError('Body must be valid JSON')); }
    });
    req.on('error', reject);
  });
}

// "" or missing -> undefined, otherwise a number (NaN if not numeric).
function numParam(value) {
  if (value === null || value === undefined || value === '') return undefined;
  return Number(value);
}

function createServer({ store, fetchImpl = globalThis.fetch } = {}) {
  async function handleApi(req, res, url) {
    const parts = url.pathname.split('/').filter(Boolean).slice(1); // drop "api"
    const method = req.method;

    if (parts[0] === 'wineries' && parts.length === 1 && method === 'GET') {
      const q = url.searchParams.get('q') || '';
      const lat = numParam(url.searchParams.get('lat'));
      const lng = numParam(url.searchParams.get('lng'));
      const radius = numParam(url.searchParams.get('radius'));
      const limit = numParam(url.searchParams.get('limit'));
      let wineries = store.listWineries({ q });
      if (lat !== undefined || lng !== undefined) {
        if (!isValidLat(lat) || !isValidLng(lng)) throw new ValidationError('lat and lng must both be valid numbers');
        if (radius !== undefined && !(radius > 0)) throw new ValidationError('radius must be a positive number of miles');
        if (limit !== undefined && !(limit >= 1)) throw new ValidationError('limit must be at least 1');
        wineries = nearest(wineries, lat, lng, { maxMiles: radius, limit });
      } else {
        wineries.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0) || a.name.localeCompare(b.name));
      }
      return sendJson(res, 200, { wineries });
    }

    if (parts[0] === 'wineries' && parts.length === 1 && method === 'POST') {
      const winery = store.addWinery(await readJson(req));
      return sendJson(res, 201, { winery });
    }

    if (parts[0] === 'wineries' && parts.length === 2 && method === 'GET') {
      const winery = store.getWinery(parts[1]);
      if (!winery) throw new ValidationError('Winery not found', 404);
      return sendJson(res, 200, { winery, reviews: store.listReviews(parts[1]) });
    }

    if (parts[0] === 'wineries' && parts[2] === 'reviews' && parts.length === 3 && method === 'POST') {
      const review = store.addReview(parts[1], await readJson(req));
      return sendJson(res, 201, { review, winery: store.getWinery(parts[1]) });
    }

    if (parts[0] === 'discover' && method === 'POST') {
      const body = await readJson(req);
      if (!isValidLat(body.lat) || !isValidLng(body.lng)) throw new ValidationError('lat and lng must be valid numbers');
      const radius = body.radiusMiles === undefined ? 25 : body.radiusMiles;
      if (typeof radius !== 'number' || !(radius > 0)) throw new ValidationError('radiusMiles must be a positive number');
      let found;
      try { found = await discoverWineries(fetchImpl, body.lat, body.lng, radius); }
      catch (err) { throw new ValidationError('Could not reach OpenStreetMap: ' + err.message, 502); }
      return sendJson(res, 200, { found: found.length, added: store.importWineries(found) });
    }

    if (parts[0] === 'geocode' && method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim();
      if (!q || q.length > 200) throw new ValidationError('q is required (up to 200 characters)');
      let place;
      try { place = await geocode(fetchImpl, q); }
      catch (err) { throw new ValidationError('Could not reach the place lookup service: ' + err.message, 502); }
      if (!place) throw new ValidationError('No place found for "' + q + '"', 404);
      return sendJson(res, 200, place);
    }

    throw new ValidationError('Not found', 404);
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      const entry = STATIC[url.pathname];
      if (!entry || req.method !== 'GET') { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': entry[1] });
      fs.createReadStream(path.join(PUBLIC_DIR, entry[0])).pipe(res);
    } catch (err) {
      if (err instanceof ValidationError) return sendJson(res, err.status, { error: err.message });
      console.error(err);
      sendJson(res, 500, { error: 'Something went wrong' });
    }
  });
}

if (require.main === module) {
  const file = process.env.WINERY_DATA || path.join(__dirname, 'data', 'winery.json');
  const port = Number(process.argv[2] || process.env.PORT || 8090);
  createServer({ store: new Store(file) }).listen(port, () => {
    console.log('Winery Finder running at http://localhost:' + port);
  });
}

module.exports = { createServer };
