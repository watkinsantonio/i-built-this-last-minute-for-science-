/* MathPath UI. Everything user-visible is rendered with textContent (no innerHTML). */
(function () {
  'use strict';
  var Q = window.MathQuiz;
  var app = document.getElementById('app');
  var BEST_KEY = 'mathpath.best';

  function el(tag, props, children) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'text') n.textContent = props[k];
      else if (k === 'class') n.className = props[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), props[k]);
      else n.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  // Set through the DOM (not a style="" attribute) so the page's Content-Security-Policy can forbid inline styles.
  function progressFill(fraction) {
    var n = el('div');
    n.style.width = fraction * 100 + '%';
    return n;
  }

  function render(nodes) {
    app.textContent = '';
    nodes.forEach(function (n) { app.appendChild(n); });
  }

  function loadBest() {
    try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveBest(topic, score, length) {
    var best = loadBest();
    var pct = Math.round((score / length) * 100);
    if (best[topic] == null || pct > best[topic]) {
      best[topic] = pct;
      try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch (e) { /* storage unavailable */ }
      return true;
    }
    return false;
  }

  function home() {
    var best = loadBest();
    var grid = el('div', { class: 'topics' }, Object.keys(Q.TOPICS).map(function (t) {
      var label = Q.TOPICS[t] + (best[t] != null ? '  \u2605 ' + best[t] + '%' : '');
      return el('button', { text: label, onclick: function () { play(t); } });
    }));
    render([
      el('h1', { text: 'MathPath' }),
      el('p', { class: 'sub', text: 'Pick a topic. 10 questions. It gets harder as you get better.' }),
      grid,
      el('p', { class: 'footer', text: 'Tip: press Enter to submit. Works offline.' }),
    ]);
  }

  var MESSAGES = {
    invalid: 'Type a number like 12 (or a fraction like 3/4).',
    empty: 'Type an answer first.',
    not_simplified: 'Right value! Now write it in simplest form.',
  };

  function play(topic) {
    var session = Q.createSession({ topic: topic, length: 10 });
    var hintShown = false;
    var locked = false;
    var quit = false;

    function show(msg, cls) {
      var m = document.getElementById('msg');
      m.textContent = msg;
      m.className = 'msg ' + (cls || '');
    }

    function draw() {
      var s = session.state;
      var input = el('input', { type: 'text', id: 'answer', autocomplete: 'off', 'aria-label': 'Your answer', inputmode: 'text' });
      var submit = function () {
        if (locked) return;
        var r = session.submit(input.value);
        if (!r.counted) { show(MESSAGES[r.reason] || 'Try again.', 'info'); input.focus(); return; }
        if (r.correct) show('Correct! \uD83C\uDF89', 'good');
        else show('Not quite. The answer was ' + r.answer + '.', 'bad');
        locked = true;
        setTimeout(function () {
          locked = false;
          hintShown = false;
          if (quit) return;
          if (session.done) results(session); else draw();
        }, r.correct ? 700 : 1600);
      };
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      render([
        el('div', { class: 'bar' }, [
          el('span', { text: 'Question ' + (s.answered + 1) + ' / ' + s.length }),
          el('span', { text: 'Level ' + s.level + '   Score ' + s.score }),
        ]),
        el('div', { class: 'progress' }, [progressFill(s.answered / s.length)]),
        el('div', { class: 'problem', text: s.current.prompt + ' = ?' }),
        el('div', { class: 'row' }, [
          input,
          el('button', { text: 'Check', onclick: submit }),
          el('button', { class: 'secondary', text: 'Hint', onclick: function () {
            hintShown = true; show(s.current.hint, 'info'); input.focus();
          } }),
        ]),
        el('div', { id: 'msg', class: 'msg', role: 'status' }),
        el('button', { class: 'secondary', text: 'Quit', onclick: function () { quit = true; home(); } }),
      ]);
      if (hintShown) show(s.current.hint, 'info');
      input.focus();
    }
    draw();
  }

  function results(session) {
    var s = session.state;
    var isBest = saveBest(s.topic, s.score, s.length);
    var list = el('ul', { class: 'review' }, s.history.map(function (h) {
      return el('li', { class: h.correct ? 'good' : 'bad',
        text: (h.correct ? '\u2713 ' : '\u2717 ') + h.prompt + ' = ' + h.answer + (h.correct ? '' : '   (you said ' + h.given + ')') });
    }));
    render([
      el('h1', { text: 'Round complete!' }),
      el('div', { class: 'big', text: s.score + ' / ' + s.length }),
      el('p', { class: 'sub', text: 'Best streak: ' + s.bestStreak + ' \u00b7 Reached level ' + s.level + (isBest ? ' \u00b7 New best! \u2605' : '') }),
      list,
      el('div', { class: 'row' }, [
        el('button', { text: 'Play again', onclick: function () { play(s.topic); } }),
        el('button', { class: 'secondary', text: 'Topics', onclick: home }),
      ]),
    ]);
  }

  home();
})();
