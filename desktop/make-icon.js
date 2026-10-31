'use strict';
// Draws the MathPath app icon (a rounded tile with + - x / symbols, in the
// app's indigo-to-teal colours) and writes it to desktop/assets/icon.png.
// No dependencies: the PNG is encoded by hand with zlib.
// Run `node make-icon.js` after changing the design. electron-builder turns
// the 1024px PNG into .ico (Windows) and .icns (macOS) itself.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TOP = [0x31, 0x2e, 0x81]; // #312e81, same as the app background
const BOTTOM = [0x0e, 0x74, 0x90]; // #0e7490

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// Distance from point to the segment a-b (all in 0..1 units).
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function roundedSquareDist(px, py, radius) {
  const qx = Math.abs(px - 0.5) - (0.5 - radius);
  const qy = Math.abs(py - 0.5) - (0.5 - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

// Each symbol is a list of round-capped strokes [ax, ay, bx, by] (dots have a == b).
const H = 0.115; // half-size of a symbol
const SYMBOLS = (() => {
  const cx1 = 0.3, cx2 = 0.7, cy1 = 0.3, cy2 = 0.7;
  const plus = (x, y) => [[x - H, y, x + H, y], [x, y - H, x, y + H]];
  const minus = (x, y) => [[x - H, y, x + H, y]];
  const times = (x, y) => [[x - H * 0.8, y - H * 0.8, x + H * 0.8, y + H * 0.8], [x - H * 0.8, y + H * 0.8, x + H * 0.8, y - H * 0.8]];
  const divide = (x, y) => [[x - H, y, x + H, y], [x, y - H * 1.05, x, y - H * 1.05], [x, y + H * 1.05, x, y + H * 1.05]];
  return [].concat(plus(cx1, cy1), minus(cx2, cy1), times(cx1, cy2), divide(cx2, cy2));
})();
const STROKE_R = 0.034;

// Returns an RGBA buffer (size*size*4).
function renderIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / size, py = (y + 0.5) / size;
      const tileCov = clamp01(0.5 - roundedSquareDist(px, py, 0.22) * size);
      let symCov = 0;
      for (const s of SYMBOLS) {
        const d = segDist(px, py, s[0], s[1], s[2], s[3]) - STROKE_R;
        symCov = Math.max(symCov, clamp01(0.5 - d * size));
      }
      const g = clamp01((px + py) / 2);
      const o = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        const bg = TOP[c] + (BOTTOM[c] - TOP[c]) * g;
        buf[o + c] = Math.round(bg + (255 - bg) * symCov);
      }
      buf[o + 3] = Math.round(255 * tileCov);
    }
  }
  return buf;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size); // filter byte 0 per row
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { renderIcon, encodePng, crc32 };

if (require.main === module) {
  const out = path.join(__dirname, 'assets', 'icon.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encodePng(renderIcon(1024), 1024));
  console.log('Wrote ' + out);
}
