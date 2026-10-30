'use strict';
// JSON-file storage for wineries and reviews, plus input validation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { SEED } = require('./seed');
const { distanceMiles, isValidLat, isValidLng } = require('./geo');

class ValidationError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function cleanText(value, field, { max, required = false }) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ValidationError(field + ' is required');
    return '';
  }
  if (typeof value !== 'string') throw new ValidationError(field + ' must be text');
  const text = value.trim();
  if (required && !text) throw new ValidationError(field + ' is required');
  if (text.length > max) throw new ValidationError(field + ' must be at most ' + max + ' characters');
  return text;
}

// Only http(s) links are allowed so a stored URL can never be a javascript: link.
function cleanUrl(value) {
  const text = cleanText(value, 'website', { max: 300 });
  if (!text) return '';
  let url;
  try { url = new URL(text); } catch { throw new ValidationError('website must be a valid http(s) URL'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ValidationError('website must be a valid http(s) URL');
  }
  return url.href;
}

function validateWinery(input) {
  if (!input || typeof input !== 'object') throw new ValidationError('winery details are required');
  const lat = input.lat;
  const lng = input.lng;
  if (!isValidLat(lat) || !isValidLng(lng)) {
    throw new ValidationError('lat and lng must be numbers (lat -90..90, lng -180..180)');
  }
  return {
    name: cleanText(input.name, 'name', { max: 100, required: true }),
    address: cleanText(input.address, 'address', { max: 200 }),
    lat,
    lng,
    website: cleanUrl(input.website),
    description: cleanText(input.description, 'description', { max: 500 }),
  };
}

function validateReview(input) {
  if (!input || typeof input !== 'object') throw new ValidationError('review details are required');
  const rating = input.rating;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError('rating must be a whole number from 1 to 5');
  }
  return {
    author: cleanText(input.author, 'author', { max: 50, required: true }),
    rating,
    comment: cleanText(input.comment, 'comment', { max: 1000 }),
  };
}

class Store {
  // file: path of the JSON file, or null for an in-memory store (used by tests).
  constructor(file = null, seed = SEED) {
    this.file = file;
    this.data = null;
    if (file && fs.existsSync(file)) {
      try {
        this.data = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (err) {
        throw new Error('Could not read ' + file + ': ' + err.message + '. Fix or delete the file.');
      }
    }
    if (!this.data || !Array.isArray(this.data.wineries) || !Array.isArray(this.data.reviews)) {
      this.data = { wineries: seed.map((w) => ({ ...w, source: 'seed' })), reviews: [] };
      this._save();
    }
  }

  _save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  _summary(wineryId) {
    const reviews = this.data.reviews.filter((r) => r.wineryId === wineryId);
    const total = reviews.reduce((sum, r) => sum + r.rating, 0);
    return {
      reviewCount: reviews.length,
      averageRating: reviews.length ? Math.round((total / reviews.length) * 10) / 10 : null,
    };
  }

  _withSummary(winery) { return { ...winery, ...this._summary(winery.id) }; }

  // Wineries with rating summaries. Optional text filter on name/address.
  listWineries({ q = '' } = {}) {
    const needle = q.trim().toLowerCase();
    return this.data.wineries
      .filter((w) => !needle || (w.name + ' ' + w.address).toLowerCase().includes(needle))
      .map((w) => this._withSummary(w));
  }

  getWinery(id) {
    const winery = this.data.wineries.find((w) => w.id === id);
    return winery ? this._withSummary(winery) : null;
  }

  listReviews(wineryId) {
    return this.data.reviews
      .filter((r) => r.wineryId === wineryId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  addWinery(input, { id = null, source = 'user' } = {}) {
    const fields = validateWinery(input);
    const duplicate = this.data.wineries.find((w) =>
      w.name.toLowerCase() === fields.name.toLowerCase() &&
      distanceMiles(w.lat, w.lng, fields.lat, fields.lng) < 0.2);
    if (duplicate) throw new ValidationError('That winery is already listed', 409);
    const winery = { id: id || 'w-' + crypto.randomUUID(), ...fields, source };
    this.data.wineries.push(winery);
    this._save();
    return this._withSummary(winery);
  }

  // Imports many wineries at once (e.g. from OpenStreetMap), skipping ones we already have.
  // Returns the number actually added.
  importWineries(items) {
    let added = 0;
    for (const item of items) {
      if (this.data.wineries.some((w) => w.id === item.id)) continue;
      try {
        const fields = validateWinery(item);
        const dup = this.data.wineries.some((w) =>
          w.name.toLowerCase() === fields.name.toLowerCase() &&
          distanceMiles(w.lat, w.lng, fields.lat, fields.lng) < 0.2);
        if (dup) continue;
        this.data.wineries.push({ id: item.id, ...fields, source: 'osm' });
        added++;
      } catch (err) {
        if (!(err instanceof ValidationError)) throw err;
      }
    }
    if (added) this._save();
    return added;
  }

  addReview(wineryId, input) {
    if (!this.data.wineries.some((w) => w.id === wineryId)) throw new ValidationError('Winery not found', 404);
    const fields = validateReview(input);
    const review = {
      id: 'r-' + crypto.randomUUID(),
      wineryId,
      ...fields,
      createdAt: new Date().toISOString(),
    };
    this.data.reviews.push(review);
    this._save();
    return review;
  }
}

module.exports = { Store, ValidationError, validateWinery, validateReview };
