import {
  ERROR_TEXT,
  PROTOCOL_VERSION,
  generateCode,
  normaliseCode,
  type ClientMessage,
  type ErrorCode,
  type ServerMessage,
} from './protocol';
import { Room, type Conn } from './room';

/**
 * Transport-agnostic session host: the room registry and the message router.
 *
 * This is the whole server minus the sockets. It is deliberately free of any
 * Node import so the exact same code can run in three places:
 *
 *   - the dedicated server (`server/main.ts`), behind a WebSocket
 *   - the browser (`src/mp/localHost.ts`), for solo play with bot teammates
 *   - the tests, driven directly
 *
 * One router, one set of rules. A local game and an online game are the same
 * code path, so "works offline" cannot drift away from "works online".
 */

export interface HostedConn extends Conn {
  helloed: boolean;
  /** Token this connection may use to reclaim its slot after a drop. */
  resumeToken?: string;
}

const TOKEN_TTL_MS = 3_600_000;

export class SessionHost {
  readonly rooms = new Map<string, Room>();
  private readonly resumeTokens = new Map<string, { code: string; memberId: string; expires: number }>();

  /** Route one client message. Everything is a request, never a fact. */
  handle(conn: HostedConn, message: ClientMessage): void {
    if (!message || typeof message.t !== 'string') return;

    if (message.t === 'hello') {
      this.hello(conn, message);
      return;
    }
    if (!conn.helloed) return;

    switch (message.t) {
      case 'host': {
        if (conn.room) return this.fail(conn, 'ALREADY_IN_ROOM');
        const room = new Room(this.freshCode(), message.settings ?? {});
        this.rooms.set(room.code, room);
        room.add(conn);
        this.rememberSlot(conn, room);
        room.broadcastLobby();
        return;
      }

      case 'join': {
        if (conn.room) return this.fail(conn, 'ALREADY_IN_ROOM');
        const code = normaliseCode(message.code ?? '');
        if (!code) return this.fail(conn, 'INVALID_CODE');
        const room = this.rooms.get(code);
        if (!room) return this.fail(conn, 'ROOM_NOT_FOUND');
        if (room.isFull) return this.fail(conn, 'ROOM_FULL');
        // Joining a running match is allowed; joining a finished one is not.
        if (room.phase === 'ended') return this.fail(conn, 'ALREADY_STARTED');
        room.add(conn);
        this.rememberSlot(conn, room);
        room.broadcastLobby();
        if (room.phase === 'match' && room.sim) {
          conn.send({ t: 'matchStart', seed: room.seed, map: room.settings.map, startedAt: room.startedAt });
          conn.send(room.sim.snapshot());
        }
        return;
      }

      case 'quickJoin': {
        if (conn.room) return this.fail(conn, 'ALREADY_IN_ROOM');
        const open = [...this.rooms.values()]
          .filter((r) => r.settings.isPublic && !r.isFull && r.phase === 'lobby')
          .sort((a, b) => b.slotCount - a.slotCount); // fill lobbies, do not scatter
        const room = open[0];
        if (!room) return this.fail(conn, 'NO_PUBLIC_ROOMS');
        room.add(conn);
        this.rememberSlot(conn, room);
        room.broadcastLobby();
        return;
      }

      case 'listPublic': {
        const rooms = [...this.rooms.values()]
          .filter((r) => r.settings.isPublic && r.phase !== 'ended')
          .map((r) => r.publicInfo())
          .slice(0, 30);
        conn.send({ t: 'public', rooms });
        return;
      }

      case 'setSettings': {
        const room = conn.room as Room | null;
        if (!room) return this.fail(conn, 'NOT_IN_ROOM');
        if (!room.setSettings(conn.id, message.settings ?? {})) this.fail(conn, 'NOT_HOST');
        return;
      }

      case 'ready': {
        const room = conn.room as Room | null;
        if (!room) return this.fail(conn, 'NOT_IN_ROOM');
        room.setReady(conn.id, Boolean(message.ready));
        return;
      }

      case 'start': {
        const room = conn.room as Room | null;
        if (!room) return this.fail(conn, 'NOT_IN_ROOM');
        const verdict = room.canStart(conn.id);
        if (!verdict.ok) return this.fail(conn, verdict.reason);
        room.start();
        return;
      }

      case 'leave':
        this.leave(conn, true);
        return;

      case 'input': {
        const room = conn.room as Room | null;
        if (!room?.sim || !message.f) return;
        room.sim.applyInput(conn.id, message.f);
        return;
      }

      case 'interact': {
        const room = conn.room as Room | null;
        if (!room?.sim) return;
        room.sim.setInteract(conn.id, message.id ?? null, Boolean(message.held));
        return;
      }

      case 'revive': {
        const room = conn.room as Room | null;
        if (!room?.sim) return;
        room.sim.setRevive(conn.id, message.target ?? null, Boolean(message.held));
        return;
      }

      case 'ping': {
        conn.send({ t: 'pong', c: message.c, s: Date.now() });
        // Round-trip time is measured by the client and reported back purely so
        // the lobby can show it. It is display data and never touches gameplay,
        // so a client lying about it costs nothing.
        if (typeof message.rtt === 'number' && message.rtt >= 0 && message.rtt < 10_000) {
          conn.ping = Math.round(message.rtt);
        }
        return;
      }

      default:
        return;
    }
  }

  private hello(conn: HostedConn, message: Extract<ClientMessage, { t: 'hello' }>): void {
    if (message.v !== PROTOCOL_VERSION) {
      this.fail(conn, 'BAD_VERSION');
      conn.close('version');
      return;
    }
    conn.name = cleanName(message.name);
    conn.helloed = true;

    if (message.resume) {
      const token = this.resumeTokens.get(message.resume);
      const room = token ? this.rooms.get(token.code) : undefined;
      if (token && room && token.expires > Date.now() && room.reattach(token.memberId, conn)) {
        conn.id = token.memberId;
        conn.resumeToken = message.resume;
        conn.send({ t: 'welcome', id: conn.id, resume: message.resume, v: PROTOCOL_VERSION });
        conn.send({ t: 'lobby', state: room.lobbyState() });
        if (room.phase === 'match' && room.sim) {
          conn.send({ t: 'matchStart', seed: room.seed, map: room.settings.map, startedAt: room.startedAt });
          conn.send(room.sim.snapshot());
        }
        return;
      }
      // Stale token: carry on as a brand new player rather than failing.
      this.fail(conn, 'RESUME_EXPIRED');
    }

    const token = randomId();
    this.resumeTokens.set(token, { code: '', memberId: conn.id, expires: Date.now() + TOKEN_TTL_MS });
    conn.resumeToken = token;
    conn.send({ t: 'welcome', id: conn.id, resume: token, v: PROTOCOL_VERSION });
  }

  /** A connection went away. `hard` means they chose to; otherwise the slot is held. */
  leave(conn: HostedConn, hard: boolean): void {
    const room = conn.room as Room | null;
    if (!room) return;
    conn.room = null;
    if (hard) room.remove(conn.id);
    else room.markDisconnected(conn.id, conn);
    if (room.connectedCount === 0 && room.phase === 'lobby' && room.slotCount === 0) {
      room.dispose();
      this.rooms.delete(room.code);
    }
  }

  fail(conn: HostedConn, code: ErrorCode): void {
    conn.send({ t: 'error', code, message: ERROR_TEXT[code] });
  }

  send(conn: HostedConn, message: ServerMessage): void {
    conn.send(message);
  }

  /** Drop expired rooms and tokens. Call every couple of seconds. */
  sweep(now = Date.now()): void {
    for (const [code, room] of [...this.rooms]) {
      if (room.sweep(now)) this.rooms.delete(code);
    }
    for (const [token, entry] of [...this.resumeTokens]) {
      if (entry.expires < now) this.resumeTokens.delete(token);
    }
  }

  dispose(): void {
    for (const [, room] of this.rooms) room.dispose();
    this.rooms.clear();
    this.resumeTokens.clear();
  }

  private rememberSlot(conn: HostedConn, room: Room): void {
    const token = conn.resumeToken;
    if (!token) return;
    this.resumeTokens.set(token, { code: room.code, memberId: conn.id, expires: Date.now() + TOKEN_TTL_MS });
  }

  private freshCode(): string {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      if (!this.rooms.has(code)) return code;
    }
    return `DEPOT-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  }
}

export function cleanName(raw: unknown): string {
  const text = String(raw ?? '').replace(/[^\w \-.]/g, '').trim().slice(0, 16);
  return text || 'GUARD';
}

/** Random id that works in Node, in a browser, and on a file:// page. */
export function randomId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(8);
    cryptoApi.getRandomValues(bytes);
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}
