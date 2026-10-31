'use strict';
// JSON-file storage for food spots and tasting reviews, plus input validation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { SEED } = require('./seed');
const { distanceMiles, isValidLat, isValidLng } = require('../winery/geo');

const CATEGORIES = ['restaurant', 'cafe', 'bakery', 'fast food', 'dessert', 'street food', 'other'];

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

function cleanCategory(value) {
  if (value === undefined || value === null || value === '') return 'other';
  if (typeof value !== 'string' || !CATEGORIES.includes(value.trim().toLowerCase())) {
    throw new ValidationError('category must be one of: ' + CATEGORIES.join(', '));
  }
  return value.trim().toLowerCase();
}

function validateSpot(input) {
  if (!input || typeof input !== 'object') throw new ValidationError('spot details are required');
  const { lat, lng } = input;
  if (!isValidLat(lat) || !isValidLng(lng)) {
    throw new ValidationError('lat and lng must be numbers (lat -90..90, lng -180..180)');
  }
  return {
    name: cleanText(input.name, 'name', { max: 100, required: true }),
    category: cleanCategory(input.category),
    cuisine: cleanText(input.cuisine, 'cuisine', { max: 50 }).toLowerCase(),
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
    dish: cleanText(input.dish, 'dish', { max: 100 }),
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
    if (!this.data || !Array.isArray(this.data.spots) || !Array.isArray(this.data.reviews)) {
      this.data = { spots: seed.map((s) => ({ ...s, source: 'seed' })), reviews: [] };
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

  _summary(spotId) {
    const reviews = this.data.reviews.filter((r) => r.spotId === spotId);
    const total = reviews.reduce((sum, r) => sum + r.rating, 0);
    return {
      reviewCount: reviews.length,
      averageRating: reviews.length ? Math.round((total / reviews.length) * 10) / 10 : null,
    };
  }

  _withSummary(spot) { return { ...spot, ...this._summary(spot.id) }; }

  _isDuplicate(fields) {
    return this.data.spots.some((s) =>
      s.name.toLowerCase() === fields.name.toLowerCase() &&
      distanceMiles(s.lat, s.lng, fields.lat, fields.lng) < 0.2);
  }

  // Spots with rating summaries. Optional text filter on name/cuisine/address and exact category.
  listSpots({ q = '', category = '' } = {}) {
    const needle = q.trim().toLowerCase();
    const cat = category.trim().toLowerCase();
    return this.data.spots
      .filter((s) => !cat || s.category === cat)
      .filter((s) => !needle || (s.name + ' ' + (s.cuisine || '') + ' ' + s.address).toLowerCase().includes(needle))
      .map((s) => this._withSummary(s));
  }

  getSpot(id) {
    const spot = this.data.spots.find((s) => s.id === id);
    return spot ? this._withSummary(spot) : null;
  }

  listReviews(spotId) {
    return this.data.reviews
      .filter((r) => r.spotId === spotId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  addSpot(input, { id = null, source = 'user' } = {}) {
    const fields = validateSpot(input);
    if (this._isDuplicate(fields)) throw new ValidationError('That spot is already listed', 409);
    const spot = { id: id || 's-' + crypto.randomUUID(), ...fields, source };
    this.data.spots.push(spot);
    this._save();
    return this._withSummary(spot);
  }

  // Imports many spots at once (e.g. from OpenStreetMap), skipping ones we already have.
  // Returns the number actually added.
  importSpots(items) {
    let added = 0;
    for (const item of items) {
      if (this.data.spots.some((s) => s.id === item.id)) continue;
      try {
        const fields = validateSpot(item);
        if (this._isDuplicate(fields)) continue;
        this.data.spots.push({ id: item.id, ...fields, source: 'osm' });
        added++;
      } catch (err) {
        if (!(err instanceof ValidationError)) throw err;
      }
    }
    if (added) this._save();
    return added;
  }

  addReview(spotId, input) {
    if (!this.data.spots.some((s) => s.id === spotId)) throw new ValidationError('Spot not found', 404);
    const fields = validateReview(input);
    const review = {
      id: 'r-' + crypto.randomUUID(),
      spotId,
      ...fields,
      createdAt: new Date().toISOString(),
    };
    this.data.reviews.push(review);
    this._save();
    return review;
  }
}

module.exports = { Store, ValidationError, validateSpot, validateReview, CATEGORIES };
