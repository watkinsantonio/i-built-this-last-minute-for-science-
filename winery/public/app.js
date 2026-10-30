'use strict';
// Winery Finder UI. All user-supplied text is rendered with textContent (never innerHTML).
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

  function ratingText(w) {
    if (!w.reviewCount) return 'No reviews yet';
    return w.averageRating.toFixed(1) + ' (' + w.reviewCount + (w.reviewCount === 1 ? ' review)' : ' reviews)');
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderList(wineries) {
    const list = $('list');
    list.replaceChildren();
    if (!wineries.length) {
      list.appendChild(el('li', 'meta', 'No wineries found. Try a bigger radius or "Find more nearby".'));
      return;
    }
    for (const w of wineries) {
      const li = el('li', 'card' + (w.id === selectedId ? ' selected' : ''));
      const open = el('button', 'link', w.name);
      open.type = 'button';
      open.addEventListener('click', () => selectWinery(w.id));
      li.addEventListener('click', (e) => { if (e.target === li) selectWinery(w.id); });
      li.appendChild(open);
      if (w.address) li.appendChild(el('p', 'meta', w.address));
      const line = el('p', 'meta');
      if (w.reviewCount) line.appendChild(el('span', 'stars', stars(w.averageRating) + ' '));
      line.appendChild(document.createTextNode(ratingText(w)));
      if (typeof w.distanceMiles === 'number') {
        line.appendChild(document.createTextNode(' · ' + w.distanceMiles.toFixed(1) + ' mi away'));
      }
      li.appendChild(line);
      list.appendChild(li);
    }
  }

  async function loadList() {
    const request = ++listRequest;
    const params = new URLSearchParams();
    if (here) {
      params.set('lat', here.lat);
      params.set('lng', here.lng);
      const radius = $('radius').value;
      if (radius) params.set('radius', radius);
    }
    try {
      const { wineries } = await api('/api/wineries?' + params);
      if (request !== listRequest) return;
      $('list-title').textContent = here ? 'Wineries near ' + here.label : 'Top rated wineries';
      renderList(wineries);
    } catch (err) {
      if (request === listRequest) setStatus($('status'), err.message, true);
    }
  }

  function renderDetail(winery, reviews) {
    $('detail').hidden = false;
    $('d-name').textContent = winery.name;
    $('d-meta').textContent = [winery.address, ratingText(winery)].filter(Boolean).join(' · ');
    $('d-desc').textContent = winery.description || '';
    const link = $('d-link');
    link.replaceChildren();
    if (winery.website) {
      const a = el('a', '', 'Visit website');
      a.href = winery.website; // server only stores http(s) URLs
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      link.appendChild(a);
    }
    const ul = $('reviews');
    ul.replaceChildren();
    if (!reviews.length) ul.appendChild(el('li', 'meta', 'Be the first to review this winery.'));
    for (const r of reviews) {
      const li = el('li');
      const head = el('div');
      head.appendChild(el('span', 'who', r.author + ' '));
      head.appendChild(el('span', 'stars', stars(r.rating)));
      head.appendChild(el('span', 'meta', ' · ' + new Date(r.createdAt).toLocaleDateString()));
      li.appendChild(head);
      if (r.comment) li.appendChild(el('p', '', r.comment));
      ul.appendChild(li);
    }
  }

  async function selectWinery(id) {
    selectedId = id;
    const request = ++detailRequest;
    setStatus($('review-status'), '');
    try {
      const { winery, reviews } = await api('/api/wineries/' + encodeURIComponent(id));
      if (request !== detailRequest) return;
      renderDetail(winery, reviews);
      loadList();
    } catch (err) {
      if (request === detailRequest) setStatus($('status'), err.message, true);
    }
  }

  function setLocation(loc) {
    here = loc;
    $('discover').disabled = false;
    setStatus($('status'), 'Showing wineries near ' + loc.label + '.');
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
    setStatus($('status'), 'Looking for more wineries…');
    try {
      const miles = Number($('radius').value) || 50;
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

  $('review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedId) return;
    const form = e.target;
    const data = new FormData(form);
    try {
      await postJson('/api/wineries/' + encodeURIComponent(selectedId) + '/reviews', {
        author: data.get('author'),
        rating: Number(data.get('rating')),
        comment: data.get('comment'),
      });
      form.elements.comment.value = '';
      form.elements.rating.value = '';
      setStatus($('review-status'), 'Thanks for your review!');
      await selectWinery(selectedId);
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
      const { winery } = await postJson('/api/wineries', {
        name: data.get('name'),
        address: data.get('address'),
        website: data.get('website'),
        description: data.get('description'),
        lat: Number(data.get('lat')),
        lng: Number(data.get('lng')),
      });
      form.reset();
      setStatus($('add-status'), 'Added ' + winery.name + '.');
      await loadList();
      selectWinery(winery.id);
    } catch (err) {
      setStatus($('add-status'), err.message, true);
    }
  });

  loadList();
})();
