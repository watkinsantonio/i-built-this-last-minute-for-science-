'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Poll, PollError } = require('./poll');
const { createServer } = require('./server');

test('poll: counts votes, rounds percentages, empty poll has zero percent', () => {
  const poll = new Poll('  Best colour? ', ['Red', ' Blue ', 'Green']);
  assert.deepEqual(poll.results().options.map((o) => o.percent), [0, 0, 0]);
  poll.vote('a', 0);
  poll.vote('b', 1);
  poll.vote('c', 1);
  const r = poll.results();
  assert.equal(r.question, 'Best colour?');
  assert.equal(r.total, 3);
  assert.deepEqual(r.options.map((o) => o.votes), [1, 2, 0]);
  assert.deepEqual(r.options.map((o) => o.percent), [33, 67, 0]);
  assert.equal(r.options[1].label, 'Blue');
});

test('poll: one vote per voter, voting again changes the vote', () => {
  const poll = new Poll('Q', ['A', 'B']);
  poll.vote('a', 0);
  poll.vote('a', 0);
  assert.equal(poll.results().total, 1);
  poll.vote('a', 1);
  assert.deepEqual(poll.results().options.map((o) => o.votes), [0, 1]);
});

test('poll: rejects bad votes', () => {
  const poll = new Poll('Q', ['A', 'B']);
  for (const [voter, option] of [['', 0], [undefined, 0], [5, 0], ['x'.repeat(65), 0], ['a', -1], ['a', 2], ['a', 0.5], ['a', '0']]) {
    assert.throws(() => poll.vote(voter, option), PollError, JSON.stringify([voter, option]));
  }
  assert.equal(poll.results().total, 0);
});

test('poll: rejects bad polls', () => {
  assert.throws(() => new Poll('', ['A', 'B']), PollError);
  assert.throws(() => new Poll('Q', ['A']), PollError);
  assert.throws(() => new Poll('Q', 'AB'), PollError);
  assert.throws(() => new Poll('Q', ['A', ' a ']), /different/);
  assert.throws(() => new Poll('Q', ['A', '']), PollError);
  assert.throws(() => new Poll('Q', ['A', 'x'.repeat(81)]), PollError);
  assert.throws(() => new Poll('Q', Array.from({ length: 9 }, (_, i) => 'o' + i)), PollError);
  assert.throws(() => new Poll('x'.repeat(201), ['A', 'B']), PollError);
});

async function withServer(fn) {
  const server = createServer({ poll: new Poll('Pick one', ['Yes', 'No']) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try { await fn(base); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function post(base, p, body) {
  return fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('api: vote, read results, reject bad input', async () => {
  await withServer(async (base) => {
    assert.equal((await (await fetch(base + '/api/poll')).json()).total, 0);
    const res = await post(base, '/api/vote', { voter: 'a', option: 1 });
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).options.map((o) => o.votes), [0, 1]);
    assert.equal((await post(base, '/api/vote', { voter: 'a', option: 9 })).status, 400);
    assert.equal((await post(base, '/api/vote', {})).status, 400);
    const bad = await fetch(base + '/api/vote', { method: 'POST', body: '{nope' });
    assert.equal(bad.status, 400);
    const list = await fetch(base + '/api/vote', { method: 'POST', body: '[]' });
    assert.equal(list.status, 400);
    assert.equal((await fetch(base + '/api/nothing')).status, 404);
  });
});

test('api: starting a new poll resets the votes and validates input', async () => {
  await withServer(async (base) => {
    await post(base, '/api/vote', { voter: 'a', option: 0 });
    const res = await post(base, '/api/poll', { question: 'Cats or dogs?', options: ['Cats', 'Dogs', 'Both'] });
    assert.equal(res.status, 201);
    const poll = await res.json();
    assert.equal(poll.question, 'Cats or dogs?');
    assert.equal(poll.total, 0);
    assert.equal(poll.options.length, 3);
    assert.equal((await post(base, '/api/poll', { question: 'Q', options: ['only'] })).status, 400);
    assert.equal((await (await fetch(base + '/api/poll')).json()).question, 'Cats or dogs?');
  });
});

test('api: oversized bodies are rejected', async () => {
  await withServer(async (base) => {
    const big = await fetch(base + '/api/poll', { method: 'POST', body: JSON.stringify({ question: 'x'.repeat(20000) }) })
      .catch(() => ({ status: 413 }));
    assert.equal(big.status, 413);
  });
});

test('api: event stream sends the current results, then live updates', async () => {
  await withServer(async (base) => {
    const res = await fetch(base + '/api/stream');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    async function until(predicate) {
      while (!predicate(text)) {
        const { value, done } = await reader.read();
        assert.ok(!done, 'stream ended early');
        text += decoder.decode(value, { stream: true });
      }
    }
    await until((t) => t.includes('"total":0'));
    await post(base, '/api/vote', { voter: 'a', option: 0 });
    await until((t) => t.includes('"total":1'));
    await reader.cancel();
  });
});

test('static: serves both pages and 404s everything else', async () => {
  await withServer(async (base) => {
    assert.match(await (await fetch(base + '/')).text(), /data-mode="vote"/);
    assert.match(await (await fetch(base + '/results')).text(), /data-mode="results"/);
    assert.equal((await fetch(base + '/app.js')).status, 200);
    assert.equal((await fetch(base + '/style.css')).status, 200);
    assert.equal((await fetch(base + '/server.js')).status, 404);
    assert.equal((await fetch(base + '/poll.js')).status, 404);
  });
});
