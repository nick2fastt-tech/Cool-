// Tiny static file server for the renderer pages.
import http from 'http';
import fs from 'fs';
import path from 'path';

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };

export function serve(root, port) {
  const srv = http.createServer((q, s) => {
    const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
    if (!p.startsWith(root)) { s.writeHead(403); s.end(); return; }
    fs.readFile(p, (e, d) => {
      if (e) { s.writeHead(404); s.end(); return; }
      s.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      s.end(d);
    });
  });
  return new Promise((res) => srv.listen(port, () => res(srv)));
}
