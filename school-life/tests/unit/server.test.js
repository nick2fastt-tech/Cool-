import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../../server/index.js';

let server;
let base;
let tmp;

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-test-'));
  const dist = path.join(tmp, 'dist');
  fs.mkdirSync(path.join(dist, 'audio'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><title>t</title></head><body>hi</body></html>');
  fs.writeFileSync(path.join(dist, 'audio', 'theme.mp3'), Buffer.alloc(1000, 7));
  fs.writeFileSync(path.join(tmp, 'secret.txt'), 'nope');
  server = createServer({ distDir: dist, dataDir: path.join(tmp, 'data'), env: { MAIL_TRANSPORT: 'json' }, quiet: true });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const post = async (p, body, token) => {
  const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};

test('health + page is marked as served by the School Life server', async () => {
  const h = await (await fetch(base + '/api/health')).json();
  assert.equal(h.app, 'school-life');
  assert.equal(h.email, true);
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /<meta name="school-life-server" content="1" \/>/);
});

test('register validates input (expected errors are 200 + ok:false)', async () => {
  let r = await post('/api/register', { email: 'kid@yahoo.com', password: 'secret12', gender: 'male' });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, false);
  assert.equal(r.body.field, 'email');
  r = await post('/api/register', { email: 'kid@gmail.com', password: '123', gender: 'male' });
  assert.equal(r.body.field, 'password');
  r = await post('/api/register', { email: 'kid@gmail.com', password: 'secret12', gender: 'robot' });
  assert.equal(r.body.field, 'gender');
});

test('register creates the account, locks it in and sends the welcome email', async () => {
  const r = await post('/api/register', { email: 'Nick.Player@Gmail.com', password: 'secret12', gender: 'female' });
  assert.equal(r.body.ok, true);
  assert.equal(r.body.user.email, 'nick.player@gmail.com');
  assert.equal(r.body.user.gender, 'female');
  assert.equal(r.body.emailStatus, 'sent');
  assert.ok(r.body.token.length > 30);
  const mail = server.mailer.sent.at(-1);
  const msg = JSON.parse(mail.info.message);
  assert.equal(msg.to[0].address, 'nick.player@gmail.com');
  assert.match(msg.subject, /Welcome to School Life/);
  assert.match(msg.text, /I hope you enjoy this game!/);
  assert.match(msg.text, /8 classes/);
  assert.match(msg.html, /106 Library/);
  // stored hashed, never in plain text
  const raw = fs.readFileSync(path.join(tmp, 'data', 'accounts.json'), 'utf8');
  assert.ok(!raw.includes('secret12'));
  // the same Gmail can't be registered again
  const again = await post('/api/register', { email: 'nick.player@gmail.com', password: 'other123', gender: 'male' });
  assert.equal(again.body.ok, false);
  assert.equal(again.body.code, 'exists');
});

test('login, session check and logout', async () => {
  let r = await post('/api/login', { email: 'nick.player@gmail.com', password: 'wrong-pass' });
  assert.equal(r.body.ok, false);
  assert.equal(r.body.code, 'wrong');
  r = await post('/api/login', { email: 'nobody@gmail.com', password: 'whatever1' });
  assert.equal(r.body.code, 'missing');
  r = await post('/api/login', { email: 'NICK.PLAYER@gmail.com', password: 'secret12' });
  assert.equal(r.body.ok, true);
  const token = r.body.token;
  let me = await (await fetch(base + '/api/me', { headers: { Authorization: 'Bearer ' + token } })).json();
  assert.equal(me.ok, true);
  assert.equal(me.user.email, 'nick.player@gmail.com');
  await post('/api/logout', {}, token);
  me = await (await fetch(base + '/api/me', { headers: { Authorization: 'Bearer ' + token } })).json();
  assert.equal(me.ok, false);
  assert.equal(me.code, 'auth');
});

test('too many wrong passwords locks the account for a while', async () => {
  await post('/api/register', { email: 'lock.test@gmail.com', password: 'goodpass1', gender: 'male' });
  for (let i = 0; i < 5; i++) await post('/api/login', { email: 'lock.test@gmail.com', password: 'badpass' + i });
  const r = await post('/api/login', { email: 'lock.test@gmail.com', password: 'goodpass1' });
  assert.equal(r.body.code, 'locked');
});

test('static files: range requests and no path traversal', async () => {
  const r = await fetch(base + '/audio/theme.mp3', { headers: { Range: 'bytes=0-99' } });
  assert.equal(r.status, 206);
  assert.equal((await r.arrayBuffer()).byteLength, 100);
  const bad = await fetch(base + '/..%2Fsecret.txt');
  assert.ok(bad.status === 403 || bad.status === 404);
  assert.notEqual(await bad.text(), 'nope');
});
