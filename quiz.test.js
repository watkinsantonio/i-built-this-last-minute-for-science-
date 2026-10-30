'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('./quiz.js');

test('rng is deterministic per seed', () => {
  const a = Q.makeRng(42), b = Q.makeRng(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('every generated problem is solvable by its own answer', () => {
  for (const topic of Object.keys(Q.TOPICS)) {
    const rng = Q.makeRng(7);
    for (let level = 1; level <= Q.MAX_LEVEL; level++) {
      for (let i = 0; i < 50; i++) {
        const p = Q.generate(topic, level, rng);
        assert.deepEqual(Q.check(p, p.answer), { correct: true, reason: 'ok' }, `${topic} ${p.prompt}`);
      }
    }
  }
});

test('arithmetic answers are right', () => {
  const rng = Q.makeRng(1);
  for (let i = 0; i < 100; i++) {
    for (const [topic, op] of [['add', '+'], ['sub', '\u2212'], ['mul', '\u00d7'], ['div', '\u00f7']]) {
      const p = Q.generate(topic, 3, rng);
      const [x, y] = p.prompt.split(` ${op} `).map(Number);
      const want = { add: x + y, sub: x - y, mul: x * y, div: x / y }[topic];
      assert.equal(Number(p.answer), want);
      assert.ok(Number.isInteger(want) && want > 0);
    }
  }
});

test('fraction answers are in simplest form', () => {
  const rng = Q.makeRng(3);
  for (let i = 0; i < 100; i++) {
    const p = Q.generate('frac', 5, rng);
    assert.ok(Q.parseValue(p.answer).reduced, p.answer);
  }
});

test('check handles fractions, decimals and bad input', () => {
  const p = { answer: '3/4' };
  assert.equal(Q.check(p, ' 3/4 ').correct, true);
  assert.equal(Q.check(p, '0.75').correct, true);
  assert.equal(Q.check(p, '6/8').reason, 'not_simplified');
  assert.equal(Q.check(p, '1/2').reason, 'wrong');
  assert.equal(Q.check(p, 'abc').reason, 'invalid');
  assert.equal(Q.check(p, '').reason, 'empty');
  assert.equal(Q.check(p, '1/0').reason, 'invalid');
  assert.equal(Q.check({ answer: '12' }, '12').correct, true);
  assert.equal(Q.check({ answer: '12' }, '13').reason, 'wrong');
});

test('nextLevel rises after 3 right, falls after 2 wrong, stays in range', () => {
  assert.equal(Q.nextLevel(2, 3, 0).level, 3);
  assert.equal(Q.nextLevel(2, 0, 2).level, 1);
  assert.equal(Q.nextLevel(5, 3, 0).level, 5);
  assert.equal(Q.nextLevel(1, 0, 2).level, 1);
  assert.equal(Q.nextLevel(2, 1, 0).level, 2);
});

test('session scores a full round and ignores unusable input', () => {
  const s = Q.createSession({ topic: 'add', seed: 5, length: 4 });
  assert.equal(s.submit('').counted, false);
  assert.equal(s.submit('zzz').counted, false);
  assert.equal(s.state.answered, 0);
  let right = 0;
  for (let i = 0; i < 4; i++) {
    const ans = i === 1 ? '-999' : s.state.current.answer;
    const r = s.submit(ans);
    assert.equal(r.counted, true);
    if (r.correct) right++;
  }
  assert.equal(right, 3);
  assert.equal(s.state.score, 3);
  assert.equal(s.done, true);
  assert.equal(s.state.history.length, 4);
  assert.throws(() => s.submit('1'));
});

test('session adapts: perfect play climbs levels, same seed replays', () => {
  const run = () => {
    const s = Q.createSession({ topic: 'mul', seed: 9, length: 10 });
    const prompts = [];
    while (!s.done) { prompts.push(s.state.current.prompt); s.submit(s.state.current.answer); }
    return { prompts, level: s.state.level, best: s.state.bestStreak };
  };
  const a = run();
  assert.equal(a.level, 4);
  assert.equal(a.best, 3);
  assert.deepEqual(run(), a);
});

test('unknown topic is rejected', () => {
  assert.throws(() => Q.createSession({ topic: 'nope' }));
  assert.throws(() => Q.generate('nope', 1, Q.makeRng(1)));
});
