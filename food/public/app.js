'use strict';
// Food Tasting UI. All user-supplied text is rendered with textContent (never innerHTML).
(function () {
  const $ = (id) => document.getElementById(id);
  let here = null;        // { lat, lng, label } once the user picked a location
  let selectedId = null;
  let listRequest = 0;    // guards against out-of-order responses
  let detailRequest = 0;

  function setStatus(el, message, isError) {
    el.textContent = message || '';
    el.classList.toggle('error', Boolean(isError));
  }

  async function api(path, options) {
    const res = await fetch(path, options);
    let body = {};
    try { body = await res.json(); } catch { /* non-JSON error */ }
    if (!res.ok) throw new Error(body.error || 'Request failed (' + res.status + ')');
    return body;
  }

  function postJson(path, data) {
    return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  }

  function stars(rating) {
    const n = Math.round(rating);
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function ratingText(s) {
    if (!s.reviewCount) return 'No reviews yet';
    return s.averageRating.toFixed(1) + ' (' + s.reviewCount + (s.reviewCount === 1 ? ' review)' : ' reviews)');
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderList(spots) {
    const list = $('list');
    list.replaceChildren();
    if (!spots.length) {
      list.appendChild(el('li', 'meta', 'No spots found. Try a bigger radius, another type, or "Find more nearby".'));
      return;
    }
    for (const s of spots) {
      const li = el('li', 'card' + (s.id === selectedId ? ' selected' : ''));
      const open = el('button', 'link', s.name);
      open.type = 'button';
      open.addEventListener('click', () => selectSpot(s.id));
      li.addEventListener('click', (e) => { if (e.target === li) selectSpot(s.id); });
      li.appendChild(open);
      const tags = el('p', 'meta');
      tags.appendChild(el('span', 'tag', s.category));
      if (s.cuisine) tags.appendChild(el('span', 'tag', s.cuisine));
      li.appendChild(tags);
      if (s.address) li.appendChild(el('p', 'meta', s.address));
      const line = el('p', 'meta');
      if (s.reviewCount) line.appendChild(el('span', 'stars', stars(s.averageRating) + ' '));
      line.appendChild(document.createTextNode(ratingText(s)));
      if (typeof s.distanceMiles === 'number') {
        line.appendChild(document.createTextNode(' · ' + s.distanceMiles.toFixed(1) + ' mi away'));
      }
      li.appendChild(line);
      list.appendChild(li);
    }
  }

  async function loadList() {
    const request = ++listRequest;
    const params = new URLSearchParams();
    if ($('category').value) params.set('category', $('category').value);
    if (here) {
      params.set('lat', here.lat);
      params.set('lng', here.lng);
      const radius = $('radius').value;
      if (radius) params.set('radius', radius);
    }
    try {
      const { spots } = await api('/api/spots?' + params);
      if (request !== listRequest) return;
      $('list-title').textContent = here ? 'Food near ' + here.label : 'Top rated spots';
      renderList(spots);
    } catch (err) {
      if (request === listRequest) setStatus($('status'), err.message, true);
    }
  }

  function renderDetail(spot, reviews) {
    $('detail').hidden = false;
    $('d-name').textContent = spot.name;
    $('d-meta').textContent = [spot.category, spot.cuisine, spot.address, ratingText(spot)].filter(Boolean).join(' · ');
    $('d-desc').textContent = spot.description || '';
    const link = $('d-link');
    link.replaceChildren();
    if (spot.website) {
      const a = el('a', '', 'Visit website');
      a.href = spot.website; // server only stores http(s) URLs
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      link.appendChild(a);
    }
    const ul = $('reviews');
    ul.replaceChildren();
    if (!reviews.length) ul.appendChild(el('li', 'meta', 'Be the first to review this spot.'));
    for (const r of reviews) {
      const li = el('li');
      const head = el('div');
      head.appendChild(el('span', 'who', r.author + ' '));
      head.appendChild(el('span', 'stars', stars(r.rating)));
      head.appendChild(el('span', 'meta', ' · ' + new Date(r.createdAt).toLocaleDateString()));
      li.appendChild(head);
      if (r.dish) li.appendChild(el('p', 'dish', 'Tried: ' + r.dish));
      if (r.comment) li.appendChild(el('p', '', r.comment));
      ul.appendChild(li);
    }
  }

  async function selectSpot(id) {
    selectedId = id;
    const request = ++detailRequest;
    setStatus($('review-status'), '');
    try {
      const { spot, reviews } = await api('/api/spots/' + encodeURIComponent(id));
      if (request !== detailRequest) return;
      renderDetail(spot, reviews);
      loadList();
    } catch (err) {
      if (request === detailRequest) setStatus($('status'), err.message, true);
    }
  }

  function setLocation(loc) {
    here = loc;
    $('discover').disabled = false;
    setStatus($('status'), 'Showing food near ' + loc.label + '.');
    loadList();
  }

  $('locate').addEventListener('click', () => {
    if (!navigator.geolocation) { setStatus($('status'), 'Location is not available in this browser. Type a city or ZIP instead.', true); return; }
    setStatus($('status'), 'Finding your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'you' }),
      () => setStatus($('status'), 'Could not get your location. Type a city or ZIP instead.', true),
      { timeout: 10000 });
  });

  $('place-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('place').value.trim();
    if (!q) return;
    setStatus($('status'), 'Searching…');
    try {
      const place = await api('/api/geocode?q=' + encodeURIComponent(q));
      setLocation({ lat: place.lat, lng: place.lng, label: place.label.split(',').slice(0, 2).join(',').trim() });
    } catch (err) {
      setStatus($('status'), err.message, true);
    }
  });

  $('discover').addEventListener('click', async () => {
    if (!here) return;
    const button = $('discover');
    button.disabled = true;
    setStatus($('status'), 'Looking for more food spots…');
    try {
      const miles = Number($('radius').value) || 5;
      const result = await postJson('/api/discover', { lat: here.lat, lng: here.lng, radiusMiles: miles });
      setStatus($('status'), 'Found ' + result.found + ', added ' + result.added + ' new.');
      await loadList();
    } catch (err) {
      setStatus($('status'), err.message, true);
    } finally {
      button.disabled = false;
    }
  });

  $('radius').addEventListener('change', loadList);
  $('category').addEventListener('change', loadList);

  $('review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedId) return;
    const form = e.target;
    const data = new FormData(form);
    try {
      await postJson('/api/spots/' + encodeURIComponent(selectedId) + '/reviews', {
        author: data.get('author'),
        dish: data.get('dish'),
        rating: Number(data.get('rating')),
        comment: data.get('comment'),
      });
      form.elements.comment.value = '';
      form.elements.dish.value = '';
      form.elements.rating.value = '';
      await selectSpot(selectedId);
      setStatus($('review-status'), 'Thanks for your review!');
    } catch (err) {
      setStatus($('review-status'), err.message, true);
    }
  });

  $('fill-coords').addEventListener('click', () => {
    const form = $('add-form');
    if (!here) { setStatus($('add-status'), 'Pick a location first.', true); return; }
    form.elements.lat.value = here.lat;
    form.elements.lng.value = here.lng;
    setStatus($('add-status'), '');
  });

  $('add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);
    try {
      const { spot } = await postJson('/api/spots', {
        name: data.get('name'),
        category: data.get('category'),
        cuisine: data.get('cuisine'),
        address: data.get('address'),
        website: data.get('website'),
        description: data.get('description'),
        lat: Number(data.get('lat')),
        lng: Number(data.get('lng')),
      });
      form.reset();
      setStatus($('add-status'), 'Added ' + spot.name + '.');
      await loadList();
      selectSpot(spot.id);
    } catch (err) {
      setStatus($('add-status'), err.message, true);
    }
  });

  async function init() {
    try {
      const { categories } = await api('/api/categories');
      for (const c of categories) {
        $('category').appendChild(new Option(c, c));
        $('add-category').appendChild(new Option(c, c));
      }
    } catch (err) {
      setStatus($('status'), err.message, true);
    }
    loadList();
  }

  init();
})();
