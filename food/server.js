'use strict';
// Food Tasting server. Zero dependencies. Usage: node food/server.js [port]
// Data is saved to food/data/food.json (override with FOOD_DATA=/path/file.json).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Store, ValidationError, CATEGORIES } = require('./store');
const { nearest, isValidLat, isValidLng } = require('../winery/geo');
const { discoverSpots, geocode } = require('./osm');

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

    if (parts[0] === 'categories' && parts.length === 1 && method === 'GET') {
      return sendJson(res, 200, { categories: CATEGORIES });
    }

    if (parts[0] === 'spots' && parts.length === 1 && method === 'GET') {
      const q = url.searchParams.get('q') || '';
      const category = url.searchParams.get('category') || '';
      if (category && !CATEGORIES.includes(category.trim().toLowerCase())) {
        throw new ValidationError('category must be one of: ' + CATEGORIES.join(', '));
      }
      const lat = numParam(url.searchParams.get('lat'));
      const lng = numParam(url.searchParams.get('lng'));
      const radius = numParam(url.searchParams.get('radius'));
      const limit = numParam(url.searchParams.get('limit'));
      let spots = store.listSpots({ q, category });
      if (lat !== undefined || lng !== undefined) {
        if (!isValidLat(lat) || !isValidLng(lng)) throw new ValidationError('lat and lng must both be valid numbers');
        if (radius !== undefined && !(radius > 0)) throw new ValidationError('radius must be a positive number of miles');
        if (limit !== undefined && !(limit >= 1)) throw new ValidationError('limit must be at least 1');
        spots = nearest(spots, lat, lng, { maxMiles: radius, limit });
      } else {
        spots.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0) || a.name.localeCompare(b.name));
      }
      return sendJson(res, 200, { spots });
    }

    if (parts[0] === 'spots' && parts.length === 1 && method === 'POST') {
      const spot = store.addSpot(await readJson(req));
      return sendJson(res, 201, { spot });
    }

    if (parts[0] === 'spots' && parts.length === 2 && method === 'GET') {
      const spot = store.getSpot(parts[1]);
      if (!spot) throw new ValidationError('Spot not found', 404);
      return sendJson(res, 200, { spot, reviews: store.listReviews(parts[1]) });
    }

    if (parts[0] === 'spots' && parts[2] === 'reviews' && parts.length === 3 && method === 'POST') {
      const review = store.addReview(parts[1], await readJson(req));
      return sendJson(res, 201, { review, spot: store.getSpot(parts[1]) });
    }

    if (parts[0] === 'discover' && method === 'POST') {
      const body = await readJson(req);
      if (!isValidLat(body.lat) || !isValidLng(body.lng)) throw new ValidationError('lat and lng must be valid numbers');
      const radius = body.radiusMiles === undefined ? 5 : body.radiusMiles;
      if (typeof radius !== 'number' || !(radius > 0)) throw new ValidationError('radiusMiles must be a positive number');
      let found;
      try { found = await discoverSpots(fetchImpl, body.lat, body.lng, radius); }
      catch (err) { throw new ValidationError('Could not reach OpenStreetMap: ' + err.message, 502); }
      return sendJson(res, 200, { found: found.length, added: store.importSpots(found) });
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
  const file = process.env.FOOD_DATA || path.join(__dirname, 'data', 'food.json');
  const port = Number(process.argv[2] || process.env.PORT || 8091);
  createServer({ store: new Store(file) }).listen(port, () => {
    console.log('Food Tasting running at http://localhost:' + port);
  });
}

module.exports = { createServer };
