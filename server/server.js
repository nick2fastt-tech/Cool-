/**
 * server.js
 * ---------
 * NovaVerse authoritative multiplayer server. One process serves:
 *   - a small REST API for matchmaking:
 *       GET  /rooms?mode=obby   -> list public rooms
 *       POST /rooms { mode, private } -> create a room, returns { code }
 *       GET  /health            -> liveness probe
 *   - a WebSocket endpoint (same host/port) for real-time gameplay
 *
 * Run:  npm install && npm start   (from the server/ directory)
 * Then point the client at it with ?server=ws://HOST:8080
 *
 * The protocol is shared with the client (../src/net/Protocol.js) so both ends
 * can never drift out of sync.
 */

import http from 'http';
import { WebSocketServer } from 'ws';
import { MSG, decode, encode, PROTOCOL_VERSION } from '../src/net/Protocol.js';
import { Matchmaker } from './Matchmaker.js';

const PORT = process.env.PORT || 8080;
const matchmaker = new Matchmaker();
// Ensure a persistent lobby always exists.
matchmaker.getOrCreate('lobby', 'lobby');

// ---------------------------------------------------------------------------
// REST (matchmaking) + health
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  // Permissive CORS so the web client can call from any origin during dev.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    return json(res, 200, { ok: true, version: PROTOCOL_VERSION, rooms: matchmaker.rooms.size });
  }

  if (url.pathname === '/rooms' && req.method === 'GET') {
    return json(res, 200, matchmaker.list(url.searchParams.get('mode')));
  }

  if (url.pathname === '/rooms' && req.method === 'POST') {
    return readBody(req, (body) => {
      const mode = body?.mode || 'lobby';
      const room = matchmaker.create(mode, !!body?.private);
      json(res, 200, { code: room.code });
    });
  }

  json(res, 404, { error: 'not found' });
});

// ---------------------------------------------------------------------------
// WebSocket (gameplay)
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let player = null;
  let room = null;

  ws.on('message', (raw) => {
    const msg = decode(raw.toString());
    if (!msg) return;

    // The first message must be HELLO; it joins the player to a room.
    if (!player) {
      if (msg.t !== MSG.HELLO) return ws.close();
      const id = sanitizeId(msg.id) || genId();
      const username = sanitizeName(msg.username);
      room = matchmaker.getOrCreate(msg.room || 'lobby', roomMode(msg.room));
      if (room.full) {
        ws.send(encode(MSG.KICK, { reason: 'Server full' }));
        return ws.close();
      }
      player = room.addPlayer({ id, username, avatar: msg.avatar || {}, ws });
      log(`+ ${username} joined ${room.code} (${room.count})`);
      broadcastPresence();
      return;
    }

    // Subsequent messages.
    switch (msg.t) {
      case MSG.INPUT:
        room.onInput(player.id, msg);
        break;
      case MSG.CHAT:
        room.onChat(player.id, msg);
        break;
      case MSG.PING:
        ws.send(encode(MSG.PONG, { ts: msg.ts }));
        break;
      case MSG.LEAVE:
        ws.close();
        break;
    }
  });

  ws.on('close', () => {
    if (player && room) {
      room.removePlayer(player.id);
      log(`- ${player.username} left ${room.code} (${room.count})`);
      broadcastPresence();
    }
  });

  ws.on('error', () => {}); // errors are followed by 'close'; nothing to do here
});

/** Broadcast a coarse presence list (who's online + which room) to everyone. */
function broadcastPresence() {
  const entries = [];
  for (const room of matchmaker.rooms.values()) {
    for (const p of room.players.values()) entries.push({ id: p.id, online: true, room: room.code });
  }
  const msg = encode(MSG.PRESENCE, { entries });
  for (const room of matchmaker.rooms.values()) room._broadcast(MSG.PRESENCE, { entries });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function roomMode(code) {
  if (!code) return 'lobby';
  return code.split('-')[0];
}
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}
function readBody(req, cb) {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => {
    try { cb(JSON.parse(data || '{}')); } catch { cb({}); }
  });
}
function sanitizeId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_]{4,32}$/.test(id) ? id : null;
}
function sanitizeName(n) {
  const s = String(n || 'Player').replace(/[^A-Za-z0-9_ ]/g, '').slice(0, 16);
  return s || 'Player';
}
function genId() {
  return 'u' + Math.random().toString(36).slice(2, 12);
}
function log(...a) {
  console.log(new Date().toISOString(), ...a);
}

server.listen(PORT, () => log(`NovaVerse server listening on :${PORT} (ws + http)`));
