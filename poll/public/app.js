'use strict';
// Shared by the audience page (data-mode="vote") and the presenter page (data-mode="results").
// All server text is rendered with textContent, never innerHTML.
(function () {
  var mode = document.body.getAttribute('data-mode');
  var questionEl = document.getElementById('question');

  function voterId() {
    try {
      var saved = localStorage.getItem('poll-voter');
      if (saved) return saved;
      var fresh = 'v-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('poll-voter', fresh);
      return fresh;
    } catch (e) {
      return 'v-' + Math.random().toString(36).slice(2);
    }
  }

  function postJson(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'Request failed');
          return data;
        });
      });
  }

  function subscribe(onData) {
    var source = new EventSource('/api/stream');
    source.onmessage = function (event) { onData(JSON.parse(event.data)); };
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  if (mode === 'vote') {
    var choicesEl = document.getElementById('choices');
    var statusEl = document.getElementById('status');
    var me = voterId();
    var chosen = null; // { question, index }

    try { chosen = JSON.parse(localStorage.getItem('poll-choice')); } catch (e) { chosen = null; }

    var renderVote = function (poll) {
      questionEl.textContent = poll.question;
      var mine = chosen && chosen.question === poll.question ? chosen.index : -1;
      choicesEl.textContent = '';
      poll.options.forEach(function (option, index) {
        var button = el('button', 'choice' + (index === mine ? ' picked' : ''), option.label);
        button.type = 'button';
        button.addEventListener('click', function () {
          postJson('/api/vote', { voter: me, option: index }).then(function () {
            chosen = { question: poll.question, index: index };
            try { localStorage.setItem('poll-choice', JSON.stringify(chosen)); } catch (e) { /* ignore */ }
            statusEl.textContent = 'Vote counted. Tap another choice to change it.';
          }).catch(function (err) { statusEl.textContent = err.message; });
        });
        choicesEl.appendChild(button);
      });
    };
    subscribe(renderVote);
  } else {
    var barsEl = document.getElementById('bars');
    var totalEl = document.getElementById('total');
    document.getElementById('voteUrl').textContent = location.host;

    subscribe(function (poll) {
      questionEl.textContent = poll.question;
      barsEl.textContent = '';
      var top = Math.max.apply(null, poll.options.map(function (o) { return o.votes; }));
      poll.options.forEach(function (option) {
        var row = el('div', 'bar-row');
        row.appendChild(el('span', 'bar-label', option.label));
        var track = el('div', 'bar-track');
        var fill = el('div', 'bar-fill' + (top > 0 && option.votes === top ? ' lead' : ''));
        fill.style.width = option.percent + '%';
        track.appendChild(fill);
        row.appendChild(track);
        row.appendChild(el('span', 'bar-count', option.votes + ' (' + option.percent + '%)'));
        barsEl.appendChild(row);
      });
      totalEl.textContent = poll.total + (poll.total === 1 ? ' vote' : ' votes');
    });

    var form = document.getElementById('newPoll');
    var errorEl = document.getElementById('formError');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var options = form.elements.options.value.split('\n').map(function (line) { return line.trim(); })
        .filter(Boolean);
      errorEl.textContent = '';
      postJson('/api/poll', { question: form.elements.question.value, options: options })
        .then(function () { form.reset(); form.parentNode.open = false; })
        .catch(function (err) { errorEl.textContent = err.message; });
    });
  }
})();
