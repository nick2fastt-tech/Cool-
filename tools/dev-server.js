/**
 * dev-server.js
 * -------------
 * A zero-dependency static file server for local development. Serves the client
 * (index.html + /src + /assets) so ES-module imports and the import map resolve
 * over http:// (they don't work from file://). Run: `npm start`.
 *
 * This is a dev convenience only — production ships the same static files inside
 * the Capacitor Android bundle (see docs/BUILD_ANDROID.md).
 */

import http from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';

const ROOT = normalize(join(fileURLToPath(import.meta.url), '..', '..'));
const PORT = process.env.PORT || 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/index.html';
    // Prevent path traversal outside the project root.
    const filePath = normalize(join(ROOT, path));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`NovaVerse dev server → http://localhost:${PORT}`);
  console.log('Tip: run the multiplayer server too with `npm run server` (from ./server).');
});
