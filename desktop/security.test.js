'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const { prepare } = require('./prepare');
const { renderIcon, encodePng, crc32 } = require('./make-icon');
const security = require('./security');

function parsePng(buf) {
  assert.deepStrictEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunks = {};
  for (let o = 8; o < buf.length; ) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    assert.strictEqual(buf.readUInt32BE(o + 8 + len), crc32(buf.subarray(o + 4, o + 8 + len)), type + ' CRC');
    chunks[type] = data;
    o += 12 + len;
  }
  return chunks;
}

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

test('icon: crc32 matches the known check value', () => {
  assert.strictEqual(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('icon: renders a rounded tile with transparent corners and white symbols', () => {
  const n = 64;
  const img = renderIcon(n);
  const px = (x, y) => [...img.subarray((y * n + x) * 4, (y * n + x) * 4 + 4)];
  assert.strictEqual(px(0, 0)[3], 0);
  assert.strictEqual(px(n - 1, n - 1)[3], 0);
  const bg = px(32, 6); // tile background between the symbols
  assert.strictEqual(bg[3], 255);
  assert.ok(bg[0] < 100, 'background is dark');
  assert.deepStrictEqual(px(Math.round(0.3 * n), Math.round(0.3 * n)), [255, 255, 255, 255]); // centre of the plus
});

test('icon: encodePng makes a valid RGBA PNG that decodes to the same pixels', () => {
  const n = 32;
  const rgba = renderIcon(n);
  const c = parsePng(encodePng(rgba, n));
  assert.strictEqual(c.IHDR.readUInt32BE(0), n);
  assert.strictEqual(c.IHDR.readUInt32BE(4), n);
  assert.strictEqual(c.IHDR[9], 6);
  const raw = zlib.inflateSync(c.IDAT);
  for (let y = 0; y < n; y++) {
    assert.strictEqual(raw[y * (n * 4 + 1)], 0);
    assert.deepStrictEqual(raw.subarray(y * (n * 4 + 1) + 1, (y + 1) * (n * 4 + 1)), rgba.subarray(y * n * 4, (y + 1) * n * 4));
  }
});

test('icon: committed assets/icon.png is a valid square PNG of at least 512px', () => {
  const c = parsePng(fs.readFileSync(path.join(__dirname, 'assets', 'icon.png')));
  const w = c.IHDR.readUInt32BE(0);
  assert.ok(w >= 512, 'electron-builder needs >= 512px to make .icns/.ico');
  assert.strictEqual(c.IHDR.readUInt32BE(4), w);
});

test('security: renderer is sandboxed, isolated and without Node or webviews', () => {
  const p = security.webPreferences(true);
  assert.strictEqual(p.contextIsolation, true);
  assert.strictEqual(p.sandbox, true);
  assert.strictEqual(p.nodeIntegration, false);
  assert.strictEqual(p.nodeIntegrationInWorker, false);
  assert.strictEqual(p.nodeIntegrationInSubFrames, false);
  assert.strictEqual(p.webSecurity, true);
  assert.strictEqual(p.allowRunningInsecureContent, false);
  assert.strictEqual(p.webviewTag, false);
});

test('security: DevTools only outside packaged builds', () => {
  assert.strictEqual(security.webPreferences(true).devTools, false);
  assert.strictEqual(security.webPreferences(false).devTools, true);
});

test('security: network requests are blocked for every web scheme', () => {
  for (const s of ['http', 'https', 'ws', 'wss', 'ftp']) {
    assert.ok(security.BLOCKED_URL_PATTERNS.includes(s + '://*/*'), s);
  }
});

test('security: the desktop copy of index.html carries the CSP; the root web page is untouched', () => {
  const rootHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(!/Content-Security-Policy/.test(rootHtml), 'root page must not carry the CSP (file:// risk)');
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'mathpath-csp-'));
  prepare(path.join(__dirname, '..'), dest);
  const html = fs.readFileSync(path.join(dest, 'index.html'), 'utf8');
  fs.rmSync(dest, { recursive: true, force: true });
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, 'CSP meta tag missing');
  assert.strictEqual(m[1], security.CSP);
  assert.ok(html.indexOf(m[0]) < html.indexOf('<script'), 'CSP must come before scripts');
  assert.ok(!/unsafe-inline|unsafe-eval/.test(security.CSP));
});

test('desktop: engines and README state the Node version Electron needs', () => {
  assert.strictEqual(pkg.engines.node, '>=22.12.0');
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  assert.ok(/Node\.js\]\([^)]*\) 22\.12\+/.test(readme));
});

test('security: the web app has nothing the CSP would block', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), 'inline <script>');
  assert.ok(!/<style[\s>]/.test(html) && !/\sstyle=/.test(html), 'inline style');
  assert.ok(!/\son[a-z]+=/.test(html), 'inline event handler');
  for (const f of ['quiz.js', 'app.js']) {
    const js = fs.readFileSync(path.join(root, f), 'utf8');
    assert.ok(!/\beval\s*\(|new Function\s*\(/.test(js), f + ' uses eval');
    assert.ok(!/style\s*:|setAttribute\(\s*['"]style/.test(js), f + ' sets a style attribute');
    assert.ok(!/innerHTML/.test(js.replace(/\/\*.*?\*\//g, '')), f + ' uses innerHTML');
  }
});

test('security: installer config applies the fuses and ships the icon and modules', () => {
  assert.deepStrictEqual(pkg.build.electronFuses, security.FUSES);
  assert.strictEqual(security.FUSES.runAsNode, false);
  assert.strictEqual(pkg.build.asar, true);
  for (const f of ['main.js', 'nav.js', 'security.js', 'assets/icon.png']) {
    assert.ok(pkg.build.files.includes(f), f + ' not packaged');
    assert.ok(fs.existsSync(path.join(__dirname, f)), f + ' missing');
  }
  for (const t of ['win', 'mac', 'linux']) assert.strictEqual(pkg.build[t].icon, 'assets/icon.png');
});

test('security: every local module main.js requires is packaged', () => {
  const src = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  const mods = [...src.matchAll(/require\('\.\/([\w-]+)'\)/g)].map((m) => m[1]);
  assert.ok(mods.length >= 2);
  for (const m of mods) assert.ok(pkg.build.files.includes(m + '.js'), m + '.js not packaged');
});
