'use strict';
// Copies the MathPath web files into desktop/app/ so Electron (and the
// installer builder) can package them. The repo root stays the single source
// of truth; desktop/app/ is generated and git-ignored.
// The Content-Security-Policy is added only to the desktop copy of index.html,
// so the plain double-click web version is not affected by it.
const fs = require('fs');
const path = require('path');
const { CSP } = require('./security');

const FILES = ['index.html', 'quiz.js', 'app.js', 'style.css'];
const CSP_ANCHOR = '<meta charset="utf-8">';

function withCsp(html) {
  if (!html.includes(CSP_ANCHOR)) throw new Error('index.html has no ' + CSP_ANCHOR + ' to place the CSP after');
  return html.replace(CSP_ANCHOR, CSP_ANCHOR + '\n  <meta http-equiv="Content-Security-Policy" content="' + CSP + '">');
}

function prepare(srcDir, destDir) {
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of FILES) {
    if (f === 'index.html') {
      fs.writeFileSync(path.join(destDir, f), withCsp(fs.readFileSync(path.join(srcDir, f), 'utf8')));
    } else {
      fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
    }
  }
  return FILES.slice();
}

module.exports = { prepare, withCsp, FILES };

if (require.main === module) {
  const copied = prepare(path.join(__dirname, '..'), path.join(__dirname, 'app'));
  console.log('Copied ' + copied.join(', ') + ' to desktop/app/ (index.html gets a Content-Security-Policy)');
}
