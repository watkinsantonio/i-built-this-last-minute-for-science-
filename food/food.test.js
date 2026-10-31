'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store, ValidationError } = require('./store');
const { parseOverpass, buildOverpassQuery, categoryFromTags } = require('./osm');
const { createServer } = require('./server');

const AUSTIN = { lat: 30.2672, lng: -97.7431 };

test('store: seeds spots, adds reviews and averages ratings', () => {
  const store = new Store(null);
  const [first] = store.listSpots();
  assert.equal(first.reviewCount, 0);
  assert.equal(first.averageRating, null);
  store.addReview(first.id, { author: 'Ann', rating: 5, dish: 'Brisket', comment: 'Lovely' });
  store.addReview(first.id, { author: 'Bob', rating: 4 });
  const s = store.getSpot(first.id);
  assert.equal(s.reviewCount, 2);
  assert.equal(s.averageRating, 4.5);
  const reviews = store.listReviews(first.id);
  assert.equal(reviews.length, 2);
  assert.ok(reviews.some((r) => r.dish === 'Brisket'));
});

test('store: rejects bad reviews and unknown spots', () => {
  const store = new Store(null);
  const id = store.listSpots()[0].id;
  for (const bad of [
    { author: 'A', rating: 0 }, { author: 'A', rating: 6 }, { author: 'A', rating: 3.5 },
    { author: 'A', rating: '5' }, { author: '  ', rating: 3 }, { author: 'A', rating: 3, comment: 'x'.repeat(1001) },
    { author: 'A', rating: 3, dish: 'x'.repeat(101) }, { author: 'A', rating: 3, dish: 5 },
  ]) {
    assert.throws(() => store.addReview(id, bad), ValidationError);
  }
  assert.throws(() => store.addReview('nope', { author: 'A', rating: 3 }), (e) => e.status === 404);
});

test('store: addSpot validates fields, category, links and duplicates', () => {
  const store = new Store(null);
  const ok = { name: 'Taco Hut', category: 'Street Food', cuisine: 'Tacos', lat: 40, lng: -100, website: 'https://example.com' };
  const added = store.addSpot(ok);
  assert.match(added.id, /^s-/);
  assert.equal(added.category, 'street food');
  assert.equal(added.cuisine, 'tacos');
  assert.equal(store.addSpot({ name: 'No Category', lat: 1, lng: 1 }).category, 'other');
  assert.throws(() => store.addSpot(ok), (e) => e.status === 409);
  assert.throws(() => store.addSpot({ ...ok, name: 'Other', website: 'javascript:alert(1)' }), ValidationError);
  assert.throws(() => store.addSpot({ ...ok, name: 'Other', category: 'spaceship' }), ValidationError);
  assert.throws(() => store.addSpot({ ...ok, name: 'Other', lat: 91 }), ValidationError);
  assert.throws(() => store.addSpot({ ...ok, name: '' }), ValidationError);
});

test('store: listSpots filters by category and by text', () => {
  const store = new Store(null);
  const bakeries = store.listSpots({ category: 'bakery' });
  assert.ok(bakeries.length >= 2 && bakeries.every((s) => s.category === 'bakery'));
  assert.ok(store.listSpots({ q: 'pizza' }).every((s) => /pizza/i.test(s.name + s.cuisine + s.address)));
  assert.equal(store.listSpots({ q: 'pizza', category: 'bakery' }).length, 0);
});

test('store: persists to disk and reloads', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'food-'));
  const file = path.join(dir, 'nested', 'data.json');
  try {
    const a = new Store(file);
    const id = a.listSpots()[0].id;
    a.addReview(id, { author: 'Ann', rating: 3 });
    const b = new Store(file);
    assert.equal(b.getSpot(id).reviewCount, 1);
    fs.writeFileSync(file, '{not json');
    assert.throws(() => new Store(file), /Could not read/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('osm: parses nodes and ways, maps categories, skips unnamed, drops non-http websites', () => {
  const parsed = parseOverpass({ elements: [
    { type: 'node', id: 1, lat: 30.1, lon: -97.1, tags: { name: 'A Cafe', amenity: 'cafe', cuisine: 'coffee_shop;pastry', website: 'https://a.example', 'addr:city': 'Austin', 'addr:state': 'TX' } },
    { type: 'way', id: 2, center: { lat: 30.2, lon: -97.2 }, tags: { name: 'B Bakery', shop: 'bakery', website: 'javascript:x' } },
    { type: 'node', id: 3, lat: 30.3, lon: -97.3, tags: { amenity: 'restaurant' } },
  ] });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].id, 'osm-node-1');
  assert.equal(parsed[0].category, 'cafe');
  assert.equal(parsed[0].cuisine, 'coffee shop');
  assert.equal(parsed[0].address, 'Austin, TX');
  assert.equal(parsed[1].category, 'bakery');
  assert.equal(parsed[1].lat, 30.2);
  assert.equal(parsed[1].website, '');
  assert.equal(categoryFromTags({ amenity: 'ice_cream' }), 'dessert');
  assert.equal(categoryFromTags({ amenity: 'fast_food' }), 'fast food');
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

test('api: nearest spots to Austin, with distances', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/spots?lat=${AUSTIN.lat}&lng=${AUSTIN.lng}&radius=50&limit=3`);
    assert.equal(res.status, 200);
    const { spots } = await res.json();
    assert.equal(spots.length, 1);
    assert.equal(spots[0].name, 'Franklin Barbecue');
    assert.ok(spots[0].distanceMiles < 3);
    const wide = await (await fetch(`${base}/api/spots?lat=40.73&lng=-74&limit=3`)).json();
    assert.equal(wide.spots.length, 3);
    for (let i = 1; i < 3; i++) assert.ok(wide.spots[i - 1].distanceMiles <= wide.spots[i].distanceMiles);
  });
});

test('api: category filter, categories list, and bad input', async () => {
  await withServer(async (base) => {
    const { categories } = await (await fetch(base + '/api/categories')).json();
    assert.ok(categories.includes('bakery'));
    const { spots } = await (await fetch(base + '/api/spots?category=bakery')).json();
    assert.ok(spots.length > 0 && spots.every((s) => s.category === 'bakery'));
    assert.equal((await fetch(base + '/api/spots?category=nope')).status, 400);
    assert.equal((await fetch(`${base}/api/spots?lat=abc&lng=1`)).status, 400);
    assert.equal((await fetch(`${base}/api/spots?lat=10`)).status, 400);
    assert.equal((await fetch(`${base}/api/spots?lat=10&lng=10&radius=-5`)).status, 400);
    assert.equal((await fetch(`${base}/api/spots`)).status, 200);
  });
});

test('api: post a review, rating shows in detail and list', async () => {
  await withServer(async (base) => {
    const { spots } = await (await fetch(base + '/api/spots')).json();
    const id = spots[0].id;
    const res = await post(base, `/api/spots/${id}/reviews`, { author: 'Ann', rating: 5, dish: 'Pie', comment: '<b>Great</b>' });
    assert.equal(res.status, 201);
    const detail = await (await fetch(`${base}/api/spots/${id}`)).json();
    assert.equal(detail.spot.averageRating, 5);
    assert.equal(detail.reviews[0].comment, '<b>Great</b>'); // stored as plain text; UI uses textContent
    assert.equal(detail.reviews[0].dish, 'Pie');
    assert.equal((await post(base, `/api/spots/${id}/reviews`, { author: 'Ann', rating: 9 })).status, 400);
    assert.equal((await post(base, '/api/spots/missing/reviews', { author: 'Ann', rating: 4 })).status, 404);
    assert.equal((await fetch(base + '/api/spots/missing')).status, 404);
    const top = await (await fetch(base + '/api/spots')).json();
    assert.equal(top.spots[0].id, id); // highest rated first when no location given
  });
});

test('api: add a spot, invalid JSON and oversized bodies', async () => {
  await withServer(async (base) => {
    const added = await post(base, '/api/spots', { name: 'Noodle Bar', category: 'restaurant', lat: 1, lng: 2 });
    assert.equal(added.status, 201);
    assert.equal((await post(base, '/api/spots', { name: 'Noodle Bar', lat: 1, lng: 2 })).status, 409);
    const bad = await fetch(base + '/api/spots', { method: 'POST', body: '{nope' });
    assert.equal(bad.status, 400);
    const big = await fetch(base + '/api/spots', { method: 'POST', body: JSON.stringify({ name: 'x'.repeat(70000) }) })
      .catch(() => ({ status: 413 }));
    assert.equal(big.status, 413);
  });
});

test('api: discover imports from a fake Overpass and does not duplicate', async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ elements: [{ type: 'node', id: 9, lat: 38.3, lon: -122.3, tags: { name: 'New Place', amenity: 'cafe' } }] }),
  });
  await withServer(async (base) => {
    const first = await (await post(base, '/api/discover', { lat: 38.3, lng: -122.3, radiusMiles: 3 })).json();
    assert.deepEqual(first, { found: 1, added: 1 });
    const second = await (await post(base, '/api/discover', { lat: 38.3, lng: -122.3 })).json();
    assert.deepEqual(second, { found: 1, added: 0 });
    assert.equal((await post(base, '/api/discover', { lat: 'x', lng: 1 })).status, 400);
    assert.equal((await post(base, '/api/discover', { lat: 1, lng: 1, radiusMiles: -1 })).status, 400);
  }, fakeFetch);
});

test('api: discover and geocode report upstream failures as 502; geocode works', async () => {
  const down = async () => { throw new Error('offline'); };
  await withServer(async (base) => {
    assert.equal((await post(base, '/api/discover', { lat: 1, lng: 1 })).status, 502);
    assert.equal((await fetch(base + '/api/geocode?q=Austin')).status, 502);
    assert.equal((await fetch(base + '/api/geocode')).status, 400);
  }, down);
  const ok = async () => ({ ok: true, json: async () => [{ lat: '30.26', lon: '-97.74', display_name: 'Austin, Texas, USA' }] });
  await withServer(async (base) => {
    assert.deepEqual(await (await fetch(base + '/api/geocode?q=Austin')).json(), { lat: 30.26, lng: -97.74, label: 'Austin, Texas, USA' });
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
    assert.match(await page.text(), /Food Tasting/);
    assert.equal((await fetch(base + '/app.js')).status, 200);
    assert.equal((await fetch(base + '/server.js')).status, 404);
    assert.equal((await fetch(base + '/../store.js')).status, 404);
  });
});
