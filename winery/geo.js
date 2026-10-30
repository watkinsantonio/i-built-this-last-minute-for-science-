'use strict';
// Distance helpers. No dependencies, no I/O.

const EARTH_RADIUS_MILES = 3958.8;

function toRad(deg) { return (deg * Math.PI) / 180; }

function isValidLat(n) { return typeof n === 'number' && Number.isFinite(n) && n >= -90 && n <= 90; }
function isValidLng(n) { return typeof n === 'number' && Number.isFinite(n) && n >= -180 && n <= 180; }

// Great-circle distance in miles (haversine).
function distanceMiles(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Adds distanceMiles to each item (needs lat/lng) and sorts nearest first.
// Optionally drops anything farther than maxMiles and keeps only `limit` items.
function nearest(items, lat, lng, { maxMiles = Infinity, limit = Infinity } = {}) {
  return items
    .map((w) => ({ ...w, distanceMiles: distanceMiles(lat, lng, w.lat, w.lng) }))
    .filter((w) => w.distanceMiles <= maxMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, limit);
}

module.exports = { distanceMiles, nearest, isValidLat, isValidLng };
