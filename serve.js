'use strict';
// Optional: serve the app on http://localhost:8080 (no dependencies). Usage: npm start [port]
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/quiz.js': ['quiz.js', 'text/javascript; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
};

const port = Number(process.argv[2] || process.env.PORT || 8080);
http.createServer((req, res) => {
  const entry = FILES[(req.url || '/').split('?')[0]];
  if (!entry) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': entry[1] });
  fs.createReadStream(path.join(__dirname, entry[0])).pipe(res);
}).listen(port, () => console.log('MathPath running at http://localhost:' + port));
