'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { distanceMiles, nearest } = require('./geo');
const { Store, ValidationError } = require('./store');
const { parseOverpass, buildOverpassQuery } = require('./osm');
const { createServer } = require('./server');

const NAPA = { lat: 38.2975, lng: -122.2869 };

test('distanceMiles: zero for same point, known city pair is about right', () => {
  assert.equal(distanceMiles(10, 10, 10, 10), 0);
  // San Francisco -> Los Angeles is ~347 miles
  const d = distanceMiles(37.7749, -122.4194, 34.0522, -118.2437);
  assert.ok(d > 340 && d < 355, 'got ' + d);
});

test('nearest: sorts by distance, applies radius and limit', () => {
  const items = [
    { id: 'far', lat: 45, lng: -123 },
    { id: 'close', lat: 38.3, lng: -122.3 },
    { id: 'mid', lat: 38.7, lng: -122.9 },
  ];
  assert.deepEqual(nearest(items, NAPA.lat, NAPA.lng).map((w) => w.id), ['close', 'mid', 'far']);
  assert.deepEqual(nearest(items, NAPA.lat, NAPA.lng, { maxMiles: 100 }).map((w) => w.id), ['close', 'mid']);
  assert.deepEqual(nearest(items, NAPA.lat, NAPA.lng, { limit: 1 }).map((w) => w.id), ['close']);
  assert.ok(nearest(items, NAPA.lat, NAPA.lng)[0].distanceMiles < 5);
});

test('store: seeds wineries, adds reviews and averages ratings', () => {
  const store = new Store(null);
  const [first] = store.listWineries();
  assert.equal(first.reviewCount, 0);
  assert.equal(first.averageRating, null);
  store.addReview(first.id, { author: 'Ann', rating: 5, comment: 'Lovely' });
  store.addReview(first.id, { author: 'Bob', rating: 4 });
  const w = store.getWinery(first.id);
  assert.equal(w.reviewCount, 2);
  assert.equal(w.averageRating, 4.5);
  assert.equal(store.listReviews(first.id).length, 2);
});

test('store: rejects bad reviews and unknown wineries', () => {
  const store = new Store(null);
  const id = store.listWineries()[0].id;
  for (const bad of [
    { author: 'A', rating: 0 }, { author: 'A', rating: 6 }, { author: 'A', rating: 3.5 },
    { author: 'A', rating: '5' }, { author: '  ', rating: 3 }, { author: 'A', rating: 3, comment: 'x'.repeat(1001) },
  ]) {
    assert.throws(() => store.addReview(id, bad), ValidationError);
  }
  assert.throws(() => store.addReview('nope', { author: 'A', rating: 3 }), (e) => e.status === 404);
});

test('store: addWinery validates fields, blocks javascript: links and duplicates', () => {
  const store = new Store(null);
  const ok = { name: 'Test Cellars', lat: 40, lng: -100, website: 'https://example.com' };
  const added = store.addWinery(ok);
  assert.match(added.id, /^w-/);
  assert.throws(() => store.addWinery(ok), (e) => e.status === 409);
  assert.throws(() => store.addWinery({ ...ok, name: 'Other', website: 'javascript:alert(1)' }), ValidationError);
  assert.throws(() => store.addWinery({ ...ok, name: 'Other', lat: 91 }), ValidationError);
  assert.throws(() => store.addWinery({ ...ok, name: '' }), ValidationError);
});

test('store: persists to disk and reloads', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winery-'));
  const file = path.join(dir, 'nested', 'data.json');
  try {
    const a = new Store(file);
    const id = a.listWineries()[0].id;
    a.addReview(id, { author: 'Ann', rating: 3 });
    const b = new Store(file);
    assert.equal(b.getWinery(id).reviewCount, 1);
    fs.writeFileSync(file, '{not json');
    assert.throws(() => new Store(file), /Could not read/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('osm: parses nodes and ways, skips unnamed, drops non-http websites', () => {
  const parsed = parseOverpass({ elements: [
    { type: 'node', id: 1, lat: 38.1, lon: -122.1, tags: { name: 'A Winery', website: 'https://a.example', 'addr:city': 'Napa', 'addr:state': 'CA' } },
    { type: 'way', id: 2, center: { lat: 38.2, lon: -122.2 }, tags: { name: 'B Winery', website: 'javascript:x' } },
    { type: 'node', id: 3, lat: 38.3, lon: -122.3, tags: {} },
  ] });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].id, 'osm-node-1');
  assert.equal(parsed[0].address, 'Napa, CA');
  assert.equal(parsed[1].lat, 38.2);
  assert.equal(parsed[1].website, '');
  assert.match(buildOverpassQuery(1, 2, 1000), /around:1000,1,2/);
});

async function withServer(fn, fetchImpl) {
  const store = new Store(null);
  const server = createServer({ store, fetchImpl });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try { await fn(base, store); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function post(base, p, body) {
  return fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('api: nearest wineries to Napa are Napa Valley ones, with distances', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/wineries?lat=${NAPA.lat}&lng=${NAPA.lng}&radius=60&limit=3`);
    assert.equal(res.status, 200);
    const { wineries } = await res.json();
    assert.equal(wineries.length, 3);
    for (let i = 1; i < wineries.length; i++) assert.ok(wineries[i - 1].distanceMiles <= wineries[i].distanceMiles);
    assert.ok(wineries.every((w) => w.distanceMiles <= 60));
    assert.equal(wineries[0].name, 'Domaine Carneros');
  });
});

test('api: bad coordinates and half-specified location are rejected', async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/api/wineries?lat=abc&lng=1`)).status, 400);
    assert.equal((await fetch(`${base}/api/wineries?lat=10`)).status, 400);
    assert.equal((await fetch(`${base}/api/wineries?lat=10&lng=10&radius=-5`)).status, 400);
    assert.equal((await fetch(`${base}/api/wineries`)).status, 200);
  });
});

test('api: post a review, rating shows in detail and list', async () => {
  await withServer(async (base) => {
    const { wineries } = await (await fetch(base + '/api/wineries')).json();
    const id = wineries[0].id;
    const res = await post(base, `/api/wineries/${id}/reviews`, { author: 'Ann', rating: 5, comment: '<b>Great</b>' });
    assert.equal(res.status, 201);
    const detail = await (await fetch(`${base}/api/wineries/${id}`)).json();
    assert.equal(detail.winery.averageRating, 5);
    assert.equal(detail.reviews[0].comment, '<b>Great</b>'); // stored as plain text; UI uses textContent
    assert.equal((await post(base, `/api/wineries/${id}/reviews`, { author: 'Ann', rating: 9 })).status, 400);
    assert.equal((await post(base, '/api/wineries/missing/reviews', { author: 'Ann', rating: 4 })).status, 404);
    assert.equal((await fetch(base + '/api/wineries/missing')).status, 404);
    const top = await (await fetch(base + '/api/wineries')).json();
    assert.equal(top.wineries[0].id, id); // highest rated first when no location given
  });
});

test('api: invalid JSON and oversized bodies', async () => {
  await withServer(async (base) => {
    const bad = await fetch(base + '/api/wineries', { method: 'POST', body: '{nope' });
    assert.equal(bad.status, 400);
    const big = await fetch(base + '/api/wineries', { method: 'POST', body: JSON.stringify({ name: 'x'.repeat(70000) }) })
      .catch(() => ({ status: 413 }));
    assert.equal(big.status, 413);
  });
});

test('api: discover imports from a fake Overpass and does not duplicate', async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ elements: [{ type: 'node', id: 9, lat: 38.3, lon: -122.3, tags: { name: 'New Place' } }] }),
  });
  await withServer(async (base) => {
    const first = await (await post(base, '/api/discover', { lat: 38.3, lng: -122.3, radiusMiles: 10 })).json();
    assert.deepEqual(first, { found: 1, added: 1 });
    const second = await (await post(base, '/api/discover', { lat: 38.3, lng: -122.3 })).json();
    assert.deepEqual(second, { found: 1, added: 0 });
    assert.equal((await post(base, '/api/discover', { lat: 'x', lng: 1 })).status, 400);
  }, fakeFetch);
});

test('api: discover and geocode report upstream failures as 502; geocode works', async () => {
  const down = async () => { throw new Error('offline'); };
  await withServer(async (base) => {
    assert.equal((await post(base, '/api/discover', { lat: 1, lng: 1 })).status, 502);
    assert.equal((await fetch(base + '/api/geocode?q=Napa')).status, 502);
    assert.equal((await fetch(base + '/api/geocode')).status, 400);
  }, down);
  const ok = async () => ({ ok: true, json: async () => [{ lat: '38.29', lon: '-122.28', display_name: 'Napa, California, USA' }] });
  await withServer(async (base) => {
    assert.deepEqual(await (await fetch(base + '/api/geocode?q=Napa')).json(), { lat: 38.29, lng: -122.28, label: 'Napa, California, USA' });
  }, ok);
  const none = async () => ({ ok: true, json: async () => [] });
  await withServer(async (base) => {
    assert.equal((await fetch(base + '/api/geocode?q=zzzz')).status, 404);
  }, none);
});

test('static: serves the UI and 404s everything else', async () => {
  await withServer(async (base) => {
    const page = await fetch(base + '/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Winery Finder/);
    assert.equal((await fetch(base + '/app.js')).status, 200);
    assert.equal((await fetch(base + '/server.js')).status, 404);
    assert.equal((await fetch(base + '/../store.js')).status, 404);
  });
});
