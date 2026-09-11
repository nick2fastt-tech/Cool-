import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';

import { PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from '../src/net/protocol';
import { SessionHost, randomId, type HostedConn } from '../src/net/sessionHost';
import type { Room } from '../src/net/room';

/**
 * The dedicated multiplayer server.
 *
 * It is a thin shell: sockets, static files and abuse control. Every rule
 * lives in `SessionHost`, which the browser also runs for solo play, so the
 * two can never disagree about how a lobby or a match behaves.
 *
 * The game and the WebSocket share one origin, so a client connects back to
 * wherever the page came from and there is nothing to configure.
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

interface Client extends HostedConn {
  socket: WebSocket;
  budget: number;
  budgetResetAt: number;
  /** Consecutive one-second windows in which the budget was exceeded. */
  strikes: number;
  struckThisWindow: boolean;
}

export interface ServerHandle {
  port: number;
  rooms: Map<string, Room>;
  close(): Promise<void>;
}

export async function startServer(options: { port?: number; staticDir?: string } = {}): Promise<ServerHandle> {
  const staticDir = options.staticDir ? resolve(options.staticDir) : resolve(process.cwd(), 'dist');
  const host = new SessionHost();
  const clients = new Set<Client>();

  const http = createServer((req, res) => void serveStatic(req, res, staticDir));
  const wss = new WebSocketServer({ server: http, path: '/ws' });

  wss.on('connection', (socket: WebSocket) => {
    const client: Client = {
      id: randomId().slice(0, 8),
      name: 'GUARD',
      socket,
      room: null,
      ping: -1,
      helloed: false,
      budget: RATE_LIMIT,
      budgetResetAt: Date.now() + 1000,
      strikes: 0,
      struckThisWindow: false,
      send: (message: ServerMessage) => {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
      },
      close: (reason: string) => {
        client.send({ t: 'kick', reason });
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
          host.fail(client, 'RATE_LIMITED');
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
      host.handle(client, message);
    });

    socket.on('close', () => {
      clients.delete(client);
      host.leave(client, false);
    });
    socket.on('error', () => {
      /* the close handler does the cleanup */
    });
  });

  const sweeper = setInterval(() => host.sweep(), 2000);

  const port = await new Promise<number>((resolvePort, reject) => {
    http.once('error', reject);
    http.listen(options.port ?? Number(process.env.PORT ?? 8787), () => {
      const address = http.address();
      resolvePort(typeof address === 'object' && address ? address.port : 0);
    });
  });

  return {
    port,
    rooms: host.rooms,
    async close() {
      clearInterval(sweeper);
      host.dispose();
      for (const client of clients) client.socket.terminate();
      await new Promise<void>((done) => wss.close(() => done()));
      await new Promise<void>((done) => http.close(() => done()));
    },
  };
}

async function serveStatic(req: IncomingMessage, res: ServerResponse, root: string): Promise<void> {
  const url = (req.url ?? '/').split('?')[0];
  if (url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    // The pid lets an automated test prove it is talking to the server it just
    // started, rather than a stale one still holding the port.
    res.end(JSON.stringify({ ok: true, protocol: PROTOCOL_VERSION, pid: process.pid }));
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
