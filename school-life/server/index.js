// School Life server: serves the built game (dist/) and the account API.
//   npm run build && npm start            -> http://localhost:3000
// Env: PORT, DATA_DIR, GMAIL_USER, GMAIL_APP_PASSWORD (or SMTP_URL + MAIL_FROM). See README.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Store } from './store.js';
import { createMailer } from './email.js';
import { validateEmail, validatePassword, normalizeEmail } from '../src/core/account.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
};

function scryptHash(password, saltHex) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key.toString('hex'))));
  });
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function createServer({ distDir = path.join(__dirname, '..', 'dist'), dataDir = process.env.DATA_DIR || path.join(__dirname, 'data'), env = process.env, quiet = false } = {}) {
  const store = new Store(path.join(dataDir, 'accounts.json')).load();
  const mailer = createMailer(env, { outboxDir: path.join(__dirname, 'outbox') });
  const hits = new Map(); // ip -> [timestamps]
  const fails = new Map(); // email -> {n, until}
  let indexHtml = null;

  const log = (...a) => { if (!quiet) console.log(...a); };

  function rateLimited(ip) {
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
    arr.push(now);
    hits.set(ip, arr);
    return arr.length > 30;
  }

  function send(res, status, body, headers = {}) {
    const json = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
    res.end(json);
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > 16 * 1024) {
          reject(Object.assign(new Error('Body too large'), { status: 413 }));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => {
        try {
          resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
        } catch (e) {
          reject(Object.assign(new Error('Bad JSON'), { status: 400 }));
        }
      });
      req.on('error', reject);
    });
  }

  function publicUser(email) {
    const u = store.data.users[email];
    return { email, gender: u.gender, createdAt: u.createdAt };
  }

  async function newSession(email) {
    const token = crypto.randomBytes(32).toString('base64url');
    store.data.sessions[sha256(token)] = { email, createdAt: Date.now() };
    await store.save();
    return token;
  }

  function sessionEmail(req) {
    const m = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || '');
    if (!m) return null;
    const s = store.data.sessions[sha256(m[1])];
    if (!s || !store.data.users[s.email]) return null;
    return s.email;
  }

  async function api(req, res, route) {
    const ip = req.socket.remoteAddress || 'x';
    if (route === 'health' && req.method === 'GET') return send(res, 200, { ok: true, app: 'school-life', email: mailer.configured });
    if (route === 'me' && req.method === 'GET') {
      const email = sessionEmail(req);
      if (!email) return send(res, 200, { ok: false, error: 'Please log in again.', code: 'auth' });
      return send(res, 200, { ok: true, user: publicUser(email) });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    if (rateLimited(ip)) return send(res, 200, { ok: false, error: 'Too many tries. Wait a minute and try again.', code: 'rate' });
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return send(res, e.status || 400, { error: e.message });
    }
    if (route === 'register') {
      const email = normalizeEmail(body.email);
      const eErr = validateEmail(email);
      if (eErr) return send(res, 200, { ok: false, error: eErr, code: 'email', field: 'email' });
      const password = typeof body.password === 'string' ? body.password : '';
      const pErr = validatePassword(password);
      if (pErr) return send(res, 200, { ok: false, error: pErr, code: 'password', field: 'password' });
      const gender = body.gender === 'female' ? 'female' : body.gender === 'male' ? 'male' : null;
      if (!gender) return send(res, 200, { ok: false, error: 'Pick Male or Female.', code: 'gender', field: 'gender' });
      if (store.data.users[email]) return send(res, 200, { ok: false, error: 'This Gmail already has an account. Log in instead.', code: 'exists', field: 'email' });
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = await scryptHash(password, salt);
      store.data.users[email] = { salt, hash, gender, createdAt: Date.now() };
      await store.save();
      const token = await newSession(email);
      const mail = await mailer.sendWelcome(email);
      log(`[account] created ${email} (welcome email: ${mail.status})`);
      return send(res, 200, { ok: true, token, user: publicUser(email), emailStatus: mail.status });
    }
    if (route === 'login') {
      const email = normalizeEmail(body.email);
      const password = typeof body.password === 'string' ? body.password : '';
      const f = fails.get(email);
      if (f && f.until > Date.now()) return send(res, 200, { ok: false, error: `Too many tries. Wait ${Math.ceil((f.until - Date.now()) / 1000)}s and try again.`, code: 'locked' });
      const u = store.data.users[email];
      if (!u) return send(res, 200, { ok: false, error: 'No account for this Gmail yet. Create one!', code: 'missing', field: 'email' });
      const hash = await scryptHash(password, u.salt);
      if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(u.hash, 'hex'))) {
        const n = (f ? f.n : 0) + 1;
        fails.set(email, { n: n >= 5 ? 0 : n, until: n >= 5 ? Date.now() + 60000 : 0 });
        return send(res, 200, { ok: false, error: 'Wrong password. Try again.', code: 'wrong', field: 'password' });
      }
      fails.delete(email);
      const token = await newSession(email);
      return send(res, 200, { ok: true, token, user: publicUser(email) });
    }
    if (route === 'logout') {
      const m = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || '');
      if (m) {
        delete store.data.sessions[sha256(m[1])];
        await store.save();
      }
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: 'Not found' });
  }

  async function serveStatic(req, res, urlPath) {
    let rel = decodeURIComponent(urlPath.split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(distDir, rel));
    if (!file.startsWith(path.normalize(distDir + path.sep)) && file !== path.normalize(distDir)) {
      res.writeHead(403).end();
      return;
    }
    let stat;
    try {
      stat = await fsp.stat(file);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    if (stat.isDirectory()) return serveStatic(req, res, rel.replace(/\/?$/, '/'));
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': rel.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    };
    if (path.basename(file) === 'index.html') {
      if (!indexHtml) {
        const raw = await fsp.readFile(file, 'utf8');
        indexHtml = /<meta charset=[^>]*>/i.test(raw)
          ? raw.replace(/(<meta charset=[^>]*>)/i, '$1\n    <meta name="school-life-server" content="1" />')
          : raw.replace('<head>', '<head>\n    <meta name="school-life-server" content="1" />');
      }
      res.writeHead(200, headers);
      res.end(indexHtml);
      return;
    }
    // Range support (audio streaming on mobile)
    const range = req.headers.range;
    if (range && /^bytes=\d*-\d*$/.test(range)) {
      const [s, e] = range.slice(6).split('-');
      const start = s ? Number(s) : Math.max(0, stat.size - Number(e));
      const end = s && e ? Math.min(Number(e), stat.size - 1) : stat.size - 1;
      if (start >= stat.size || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
        return;
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = req.url || '/';
      const m = /^\/api\/([a-z]+)\/?(\?.*)?$/.exec(url);
      if (m) return await api(req, res, m[1]);
      if (url.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
      return await serveStatic(req, res, url);
    } catch (e) {
      console.error('[server] error', e);
      if (!res.headersSent) send(res, 500, { error: 'Server error' });
      else res.end();
    }
  });
  server.store = store;
  server.mailer = mailer;
  return server;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  const server = createServer();
  server.listen(port, () => {
    console.log(`School Life server running on http://localhost:${port}`);
    console.log(server.mailer.configured ? `Welcome emails: ON (${server.mailer.kind})` : 'Welcome emails: OFF (set GMAIL_USER + GMAIL_APP_PASSWORD to send them; previews go to server/outbox/)');
  });
}
