'use strict';
// Copies the MathPath web files into desktop/app/ so Electron (and the
// installer builder) can package them. The repo root stays the single source
// of truth; desktop/app/ is generated and git-ignored.
const fs = require('fs');
const path = require('path');

const FILES = ['index.html', 'quiz.js', 'app.js', 'style.css'];

function prepare(srcDir, destDir) {
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of FILES) {
    fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
  }
  return FILES.slice();
}

module.exports = { prepare, FILES };

if (require.main === module) {
  const copied = prepare(path.join(__dirname, '..'), path.join(__dirname, 'app'));
  console.log('Copied ' + copied.join(', ') + ' to desktop/app/');
}
