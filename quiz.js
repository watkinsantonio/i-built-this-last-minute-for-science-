/* MathPath quiz engine: pure logic, no DOM. Works in the browser (window.MathQuiz) and Node (require). */
(function (root) {
  'use strict';

  var TOPICS = {
    add: 'Addition',
    sub: 'Subtraction',
    mul: 'Multiplication',
    div: 'Division',
    frac: 'Fractions',
    mix: 'Mixed',
  };
  var MIN_LEVEL = 1;
  var MAX_LEVEL = 5;

  // Small seeded random generator so a round can be replayed from its seed.
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInt(rng, lo, hi) {
    return lo + Math.floor(rng() * (hi - lo + 1));
  }

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      var t = a % b;
      a = b;
      b = t;
    }
    return a || 1;
  }

  function clampLevel(n) {
    return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, n));
  }

  function fracText(n, d) {
    return d === 1 ? String(n) : n + '/' + d;
  }

  // Build one problem: { topic, level, prompt, answer (string), hint }
  function generate(topic, level, rng) {
    level = clampLevel(level);
    if (topic === 'mix') {
      var all = ['add', 'sub', 'mul', 'div', 'frac'];
      topic = all[randInt(rng, 0, all.length - 1)];
    }
    var max = [0, 10, 20, 50, 100, 500][level];
    var a, b, p;
    switch (topic) {
      case 'add':
        a = randInt(rng, 1, max);
        b = randInt(rng, 1, max);
        return { topic: topic, level: level, prompt: a + ' + ' + b, answer: String(a + b),
          hint: 'Start from ' + Math.max(a, b) + ' and count up ' + Math.min(a, b) + '.' };
      case 'sub':
        a = randInt(rng, 2, max);
        b = randInt(rng, 1, a - 1);
        return { topic: topic, level: level, prompt: a + ' \u2212 ' + b, answer: String(a - b),
          hint: 'How far is it from ' + b + ' up to ' + a + '?' };
      case 'mul':
        var mm = [0, 5, 9, 12, 15, 20][level];
        a = randInt(rng, 2, mm);
        b = randInt(rng, 2, mm);
        return { topic: topic, level: level, prompt: a + ' \u00d7 ' + b, answer: String(a * b),
          hint: 'Think of ' + a + ' groups of ' + b + '.' };
      case 'div':
        var dm = [0, 5, 9, 12, 15, 20][level];
        b = randInt(rng, 2, dm);
        var q = randInt(rng, 2, dm);
        return { topic: topic, level: level, prompt: b * q + ' \u00f7 ' + b, answer: String(q),
          hint: 'What number times ' + b + ' gives ' + b * q + '?' };
      case 'frac':
        var dmax = [0, 4, 6, 8, 10, 12][level];
        var den = randInt(rng, 2, dmax);
        var n1 = randInt(rng, 1, den - 1);
        var n2 = randInt(rng, 1, den - 1);
        var sum = n1 + n2;
        var g = gcd(sum, den);
        p = { topic: 'frac', level: level, prompt: fracText(n1, den) + ' + ' + fracText(n2, den),
          answer: fracText(sum / g, den / g),
          hint: 'Same bottom number: add the tops, then simplify. Answer like 3/4 or 2.' };
        return p;
      default:
        throw new Error('Unknown topic: ' + topic);
    }
  }

  // Parse "12", "-3", "3/4", "0.5" into a reduced [num, den] pair, or null.
  function parseValue(input) {
    var s = String(input == null ? '' : input).trim();
    var m;
    if ((m = /^(-?\d+)\s*\/\s*(\d+)$/.exec(s))) {
      var n = parseInt(m[1], 10);
      var d = parseInt(m[2], 10);
      if (d === 0) return null;
      var g = gcd(n, d);
      return { n: n / g, d: d / g, reduced: g === 1 };
    }
    if ((m = /^-?\d+$/.exec(s))) return { n: parseInt(s, 10), d: 1, reduced: true };
    if (/^-?\d*\.\d+$/.test(s)) {
      var dec = s.split('.')[1];
      var den = Math.pow(10, dec.length);
      var num = Math.round(parseFloat(s) * den);
      var gg = gcd(num, den);
      return { n: num / gg, d: den / gg, reduced: true };
    }
    return null;
  }

  // Returns { correct: bool, reason: 'ok' | 'empty' | 'invalid' | 'not_simplified' | 'wrong' }
  function check(problem, input) {
    if (String(input == null ? '' : input).trim() === '') return { correct: false, reason: 'empty' };
    var got = parseValue(input);
    if (!got) return { correct: false, reason: 'invalid' };
    var want = parseValue(problem.answer);
    if (got.n === want.n && got.d === want.d) {
      if (!got.reduced) return { correct: false, reason: 'not_simplified' };
      return { correct: true, reason: 'ok' };
    }
    return { correct: false, reason: 'wrong' };
  }

  // Level goes up after 3 correct in a row, down after 2 wrong in a row.
  function nextLevel(level, correctStreak, wrongStreak) {
    if (correctStreak >= 3) return { level: clampLevel(level + 1), correctStreak: 0, wrongStreak: 0 };
    if (wrongStreak >= 2) return { level: clampLevel(level - 1), correctStreak: 0, wrongStreak: 0 };
    return { level: level, correctStreak: correctStreak, wrongStreak: wrongStreak };
  }

  // A round of `length` questions.
  function createSession(opts) {
    opts = opts || {};
    var topic = opts.topic || 'mix';
    if (!TOPICS[topic]) throw new Error('Unknown topic: ' + topic);
    var seed = opts.seed == null ? Date.now() : opts.seed;
    var rng = makeRng(seed);
    var s = {
      topic: topic,
      seed: seed,
      length: opts.length || 10,
      level: clampLevel(opts.level || 1),
      correctStreak: 0,
      wrongStreak: 0,
      bestStreak: 0,
      score: 0,
      answered: 0,
      history: [],
      current: null,
    };
    s.current = generate(topic, s.level, rng);

    return {
      state: s,
      get done() { return s.answered >= s.length; },
      // Submit an answer. Invalid/empty input is not counted so the learner can retry.
      submit: function (input) {
        if (s.answered >= s.length) throw new Error('Round is finished');
        var r = check(s.current, input);
        if (r.reason === 'empty' || r.reason === 'invalid' || r.reason === 'not_simplified') {
          return { counted: false, correct: false, reason: r.reason, answer: s.current.answer };
        }
        var problem = s.current;
        s.answered += 1;
        if (r.correct) {
          s.score += 1;
          s.correctStreak += 1;
          s.wrongStreak = 0;
          s.bestStreak = Math.max(s.bestStreak, s.correctStreak);
        } else {
          s.wrongStreak += 1;
          s.correctStreak = 0;
        }
        s.history.push({ prompt: problem.prompt, answer: problem.answer, given: String(input).trim(),
          correct: r.correct, level: problem.level, topic: problem.topic });
        var nl = nextLevel(s.level, s.correctStreak, s.wrongStreak);
        s.level = nl.level;
        s.correctStreak = nl.correctStreak;
        s.wrongStreak = nl.wrongStreak;
        if (s.answered < s.length) s.current = generate(topic, s.level, rng);
        else s.current = null;
        return { counted: true, correct: r.correct, reason: r.reason, answer: problem.answer };
      },
    };
  }

  var api = {
    TOPICS: TOPICS, MAX_LEVEL: MAX_LEVEL, makeRng: makeRng, generate: generate,
    parseValue: parseValue, check: check, nextLevel: nextLevel, createSession: createSession,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MathQuiz = api;
})(typeof window !== 'undefined' ? window : this);
