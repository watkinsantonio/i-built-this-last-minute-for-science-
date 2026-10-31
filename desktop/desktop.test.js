'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { prepare, withCsp, FILES } = require('./prepare');
const { isAllowedNavigation } = require('./nav');

test('prepare: copies the web files and replaces stale output', () => {
  const root = path.join(__dirname, '..');
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'mathpath-'));
  fs.writeFileSync(path.join(dest, 'stale.txt'), 'old');
  prepare(root, dest);
  assert.deepStrictEqual(fs.readdirSync(dest).sort(), FILES.slice().sort());
  for (const f of FILES.filter((x) => x !== 'index.html')) {
    assert.deepStrictEqual(fs.readFileSync(path.join(dest, f)), fs.readFileSync(path.join(root, f)));
  }
  // index.html is the same page plus the CSP meta tag.
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.strictEqual(fs.readFileSync(path.join(dest, 'index.html'), 'utf8'), withCsp(html));
  fs.rmSync(dest, { recursive: true, force: true });
});

test('prepare: index.html only references files that get copied', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 0);
  for (const r of refs) assert.ok(FILES.includes(r), r + ' is not packaged');
});

test('nav: only the local index page is allowed', () => {
  const index = path.join(__dirname, 'app', 'index.html');
  assert.strictEqual(isAllowedNavigation(pathToFileURL(index).href, index), true);
  assert.strictEqual(isAllowedNavigation(pathToFileURL(index).href + '#x', index), true);
  assert.strictEqual(isAllowedNavigation('https://example.com/', index), false);
  assert.strictEqual(isAllowedNavigation(pathToFileURL(path.join(__dirname, 'main.js')).href, index), false);
  assert.strictEqual(isAllowedNavigation('not a url', index), false);
});
