'use strict';
// Optional online lookups (OpenStreetMap). Everything takes an injectable fetch so tests run offline.

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'FoodTasting/1.0 (local demo app)';

function buildOverpassQuery(lat, lng, radiusMeters) {
  const around = `(around:${Math.round(radiusMeters)},${lat},${lng})`;
  const amenity = 'restaurant|cafe|fast_food|ice_cream|food_court';
  return `[out:json][timeout:20];(` +
    `node["amenity"~"^(${amenity})$"]${around};way["amenity"~"^(${amenity})$"]${around};` +
    `node["shop"="bakery"]${around};way["shop"="bakery"]${around};` +
    `);out center tags 80;`;
}

function categoryFromTags(tags) {
  switch (tags.amenity) {
    case 'restaurant': return 'restaurant';
    case 'cafe': return 'cafe';
    case 'fast_food': return 'fast food';
    case 'ice_cream': return 'dessert';
    case 'food_court': return 'street food';
    default: return tags.shop === 'bakery' ? 'bakery' : 'other';
  }
}

function addressFromTags(tags) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  return [street, tags['addr:city'], tags['addr:state']].filter(Boolean).join(', ');
}

// Turns Overpass elements into spot objects. Unnamed places are skipped.
function parseOverpass(json) {
  const out = [];
  for (const el of (json && json.elements) || []) {
    const tags = el.tags || {};
    const lat = el.lat !== undefined ? el.lat : el.center && el.center.lat;
    const lng = el.lon !== undefined ? el.lon : el.center && el.center.lon;
    if (!tags.name || typeof lat !== 'number' || typeof lng !== 'number') continue;
    const website = tags.website || tags['contact:website'] || '';
    out.push({
      id: `osm-${el.type}-${el.id}`,
      name: tags.name.slice(0, 100),
      category: categoryFromTags(tags),
      cuisine: String(tags.cuisine || '').split(';')[0].replace(/_/g, ' ').slice(0, 50),
      address: addressFromTags(tags).slice(0, 200),
      lat,
      lng,
      website: /^https?:\/\//i.test(website) ? website : '',
      description: '',
    });
  }
  return out;
}

async function fetchJson(fetchImpl, url, options) {
  const res = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error('Upstream service returned ' + res.status);
  return res.json();
}

async function discoverSpots(fetchImpl, lat, lng, radiusMiles) {
  // Food is dense, so cap the search radius lower than for wineries.
  const meters = Math.min(Math.max(radiusMiles, 1), 15) * 1609.34;
  const json = await fetchJson(fetchImpl, OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
    body: 'data=' + encodeURIComponent(buildOverpassQuery(lat, lng, meters)),
  });
  return parseOverpass(json);
}

// Looks up a place name ("Austin, TX" or a ZIP code) and returns { lat, lng, label } or null.
async function geocode(fetchImpl, query) {
  const url = NOMINATIM_URL + '?format=json&limit=1&q=' + encodeURIComponent(query);
  const json = await fetchJson(fetchImpl, url, { headers: { 'User-Agent': USER_AGENT } });
  const hit = Array.isArray(json) ? json[0] : null;
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: String(hit.display_name || query) };
}

module.exports = { buildOverpassQuery, parseOverpass, categoryFromTags, discoverSpots, geocode };
