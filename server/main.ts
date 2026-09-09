import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';

import {
  ERROR_TEXT,
  PROTOCOL_VERSION,
  generateCode,
  normaliseCode,
  type ClientMessage,
  type ErrorCode,
  type ServerMessage,
} from '../src/net/protocol';
import { Room, type Conn } from './room';

/**
 * The multiplayer server.
 *
 * It serves the game's static build and the WebSocket endpoint from the same
 * origin, so a client never has to be told where its server is - it connects
 * back to wherever the page came from. One process, one port, no CORS.
 *
 * Everything a client sends is treated as a request, never as a fact.
 */

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** Message budget per connection per second. Input alone is 20/s. */
const RATE_LIMIT = 90;
const RATE_HARD_KILL = 400;

interface Client extends Conn {
  socket: WebSocket;
  helloed: boolean;
  budget: number;
  budgetResetAt: number;
  /** Consecutive one-second windows in which the budget was exceeded. */
  strikes: number;
  /** Whether this window has already been counted as a strike. */
  struckThisWindow: boolean;
}

export interface ServerHandle {
  port: number;
  rooms: Map<string, Room>;
  close(): Promise<void>;
}

export async function startServer(options: { port?: number; staticDir?: string } = {}): Promise<ServerHandle> {
  const staticDir = options.staticDir ? resolve(options.staticDir) : resolve(process.cwd(), 'dist');
  const rooms = new Map<string, Room>();
  /** resume token -> where that player was sitting. */
  const resumeTokens = new Map<string, { code: string; memberId: string; expires: number }>();

  const http = createServer((req, res) => void serveStatic(req, res, staticDir));
  const wss = new WebSocketServer({ server: http, path: '/ws' });

  const clients = new Set<Client>();

  function send(client: Client, message: ServerMessage): void {
    if (client.socket.readyState !== client.socket.OPEN) return;
    client.socket.send(JSON.stringify(message));
  }

  function fail(client: Client, code: ErrorCode): void {
    send(client, { t: 'error', code, message: ERROR_TEXT[code] });
  }

  function leaveRoom(client: Client, hard: boolean): void {
    const room = client.room as Room | null;
    if (!room) return;
    client.room = null;
    if (hard) room.remove(client.id);
    else room.markDisconnected(client.id, client);
    if (room.connectedCount === 0 && room.phase === 'lobby' && room.slotCount === 0) {
      room.dispose();
      rooms.delete(room.code);
    }
  }

  function freshCode(): string {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      if (!rooms.has(code)) return code;
    }
    return `DEPOT-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  }

  wss.on('connection', (socket: WebSocket) => {
    const client: Client = {
      id: randomUUID().slice(0, 8),
      name: 'GUARD',
      socket,
      room: null,
      ping: -1,
      helloed: false,
      budget: RATE_LIMIT,
      budgetResetAt: Date.now() + 1000,
      strikes: 0,
      struckThisWindow: false,
      send: (m) => send(client, m),
      close: (reason) => {
        send(client, { t: 'kick', reason });
        socket.close();
      },
    };
    clients.add(client);

    socket.on('message', (raw) => {
      // Rate limiting first: a flood must not get as far as JSON.parse.
      const now = Date.now();
      if (now > client.budgetResetAt) {
        client.budget = RATE_LIMIT;
        client.budgetResetAt = now + 1000;
        // A quiet second forgives a strike, so an occasional burst - a phone
        // flushing a backlog after a stall - never accumulates into a kick.
        if (!client.struckThisWindow) client.strikes = Math.max(0, client.strikes - 1);
        client.struckThisWindow = false;
      }
      if (--client.budget < 0) {
        if (!client.struckThisWindow) {
          client.struckThisWindow = true;
          client.strikes++;
          fail(client, 'RATE_LIMITED');
        }
        // Only a sustained flood, or an absurd single burst, drops the socket.
        if (client.budget < -RATE_HARD_KILL || client.strikes > 5) client.close('flooding');
        return;
      }

      let message: ClientMessage;
      try {
        const text = typeof raw === 'string' ? raw : raw.toString('utf8');
        if (text.length > 4096) return;
        message = JSON.parse(text) as ClientMessage;
      } catch {
        return;
      }
      handle(client, message);
    });

    socket.on('close', () => {
      clients.delete(client);
      leaveRoom(client, false);
    });
    socket.on('error', () => {
      /* the close handler does the cleanup */
    });
  });

  function handle(client: Client, message: ClientMessage): void {
    if (!message || typeof message.t !== 'string') return;

    if (message.t === 'hello') {
      if (message.v !== PROTOCOL_VERSION) {
        fail(client, 'BAD_VERSION');
        client.close('version');
        return;
      }
      client.name = cleanName(message.name);
      client.helloed = true;

      if (message.resume) {
        const token = resumeTokens.get(message.resume);
        const room = token ? rooms.get(token.code) : undefined;
        if (token && room && token.expires > Date.now() && room.reattach(token.memberId, client)) {
          client.id = token.memberId;
          send(client, { t: 'welcome', id: client.id, resume: message.resume, v: PROTOCOL_VERSION });
          send(client, { t: 'lobby', state: room.lobbyState() });
          if (room.phase === 'match' && room.sim) {
            send(client, { t: 'matchStart', seed: room.seed, map: room.settings.map, startedAt: room.startedAt });
            send(client, room.sim.snapshot());
          }
          return;
        }
        // Token is stale: carry on as a brand new player rather than failing.
        fail(client, 'RESUME_EXPIRED');
      }

      const token = randomUUID();
      resumeTokens.set(token, { code: '', memberId: client.id, expires: Date.now() + 3600_000 });
      client.resumeToken = token;
      send(client, { t: 'welcome', id: client.id, resume: token, v: PROTOCOL_VERSION });
      return;
    }

    if (!client.helloed) return;

    switch (message.t) {
      case 'host': {
        if (client.room) {
          fail(client, 'ALREADY_IN_ROOM');
          return;
        }
        const room = new Room(freshCode(), message.settings ?? {});
        rooms.set(room.code, room);
        room.add(client);
        rememberSlot(client, room);
        room.broadcastLobby();
        return;
      }

      case 'join': {
        if (client.room) {
          fail(client, 'ALREADY_IN_ROOM');
          return;
        }
        const code = normaliseCode(message.code ?? '');
        if (!code) {
          fail(client, 'INVALID_CODE');
          return;
        }
        const room = rooms.get(code);
        if (!room) {
          fail(client, 'ROOM_NOT_FOUND');
          return;
        }
        if (room.isFull) {
          fail(client, 'ROOM_FULL');
          return;
        }
        // Joining a running match is allowed; joining a finished one is not.
        if (room.phase === 'ended') {
          fail(client, 'ALREADY_STARTED');
          return;
        }
        room.add(client);
        rememberSlot(client, room);
        room.broadcastLobby();
        if (room.phase === 'match' && room.sim) {
          send(client, { t: 'matchStart', seed: room.seed, map: room.settings.map, startedAt: room.startedAt });
          send(client, room.sim.snapshot());
        }
        return;
      }

      case 'quickJoin': {
        if (client.room) {
          fail(client, 'ALREADY_IN_ROOM');
          return;
        }
        const open = [...rooms.values()]
          .filter((r) => r.settings.isPublic && !r.isFull && r.phase === 'lobby')
          .sort((a, b) => b.slotCount - a.slotCount); // fill lobbies, do not scatter
        const room = open[0];
        if (!room) {
          fail(client, 'NO_PUBLIC_ROOMS');
          return;
        }
        room.add(client);
        rememberSlot(client, room);
        room.broadcastLobby();
        return;
      }

      case 'listPublic': {
        const list = [...rooms.values()]
          .filter((r) => r.settings.isPublic && r.phase !== 'ended')
          .map((r) => r.publicInfo())
          .slice(0, 30);
        send(client, { t: 'public', rooms: list });
        return;
      }

      case 'setSettings': {
        const room = client.room as Room | null;
        if (!room) {
          fail(client, 'NOT_IN_ROOM');
          return;
        }
        if (!room.setSettings(client.id, message.settings ?? {})) fail(client, 'NOT_HOST');
        return;
      }

      case 'ready': {
        const room = client.room as Room | null;
        if (!room) {
          fail(client, 'NOT_IN_ROOM');
          return;
        }
        room.setReady(client.id, Boolean(message.ready));
        return;
      }

      case 'start': {
        const room = client.room as Room | null;
        if (!room) {
          fail(client, 'NOT_IN_ROOM');
          return;
        }
        const verdict = room.canStart(client.id);
        if (!verdict.ok) {
          fail(client, verdict.reason);
          return;
        }
        room.start();
        return;
      }

      case 'leave': {
        leaveRoom(client, true);
        return;
      }

      case 'input': {
        const room = client.room as Room | null;
        if (!room?.sim || !message.f) return;
        room.sim.applyInput(client.id, message.f);
        return;
      }

      case 'interact': {
        const room = client.room as Room | null;
        if (!room?.sim) return;
        room.sim.setInteract(client.id, message.id ?? null, Boolean(message.held));
        return;
      }

      case 'revive': {
        const room = client.room as Room | null;
        if (!room?.sim) return;
        room.sim.setRevive(client.id, message.target ?? null, Boolean(message.held));
        return;
      }

      case 'ping': {
        send(client, { t: 'pong', c: message.c, s: Date.now() });
        // The round trip is measured by the client and reported back purely so
        // the lobby can show it. It is display data, never used for anything
        // that affects gameplay, so a client lying about it costs nothing.
        if (typeof message.rtt === 'number' && message.rtt >= 0 && message.rtt < 10_000) {
          client.ping = Math.round(message.rtt);
        }
        return;
      }

      default:
        return;
    }
  }

  function rememberSlot(client: Client, room: Room): void {
    const token = client.resumeToken;
    if (!token) return;
    resumeTokens.set(token, { code: room.code, memberId: client.id, expires: Date.now() + 3600_000 });
  }

  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of [...rooms]) {
      if (room.sweep(now)) rooms.delete(code);
    }
    for (const [token, entry] of [...resumeTokens]) {
      if (entry.expires < now) resumeTokens.delete(token);
    }
  }, 2000);

  const port = await new Promise<number>((resolvePort, reject) => {
    http.once('error', reject);
    http.listen(options.port ?? Number(process.env.PORT ?? 8787), () => {
      const address = http.address();
      resolvePort(typeof address === 'object' && address ? address.port : 0);
    });
  });

  return {
    port,
    rooms,
    async close() {
      clearInterval(sweeper);
      for (const [, room] of rooms) room.dispose();
      rooms.clear();
      for (const client of clients) client.socket.terminate();
      await new Promise<void>((done) => wss.close(() => done()));
      await new Promise<void>((done) => http.close(() => done()));
    },
  };
}

declare module './room' {
  interface Conn {
    /** Token this connection may use to reclaim its slot after a drop. */
    resumeToken?: string;
  }
}

function cleanName(raw: unknown): string {
  const text = String(raw ?? '').replace(/[^\w \-.]/g, '').trim().slice(0, 16);
  return text || 'GUARD';
}

async function serveStatic(req: IncomingMessage, res: ServerResponse, root: string): Promise<void> {
  const url = (req.url ?? '/').split('?')[0];
  if (url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, protocol: PROTOCOL_VERSION }));
    return;
  }
  const rel = url === '/' ? 'index.html' : normalize(url).replace(/^(\.\.[/\\])+/, '').replace(/^\//, '');
  const path = join(root, rel);
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(path);
    res.writeHead(200, {
      'content-type': MIME[extname(path)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}
