import {
  INPUT_HZ,
  INTERP_DELAY_MS,
  PROTOCOL_VERSION,
  type ClientMessage,
  type ErrorCode,
  type LobbyState,
  type MatchEvent,
  type MatchSnapshot,
  type PlayerSnap,
  type PublicRoomInfo,
  type RoomSettings,
  type ServerMessage,
} from '../net/protocol';
import { EventBus } from '../core/events';
import { LocalHost } from './localHost';
import { MOVE, stepMovement } from './matchSim';
import type { InputFrame } from '../net/protocol';

export type ConnectionState = 'offline' | 'connecting' | 'online' | 'reconnecting' | 'failed';

export interface NetEvents {
  connection: { state: ConnectionState; detail?: string };
  lobby: LobbyState;
  publicRooms: PublicRoomInfo[];
  error: { code: ErrorCode; message: string };
  matchStart: { seed: number; startedAt: number };
  matchEnd: { win: boolean; reason: string };
  snapshot: MatchSnapshot;
  matchEvents: MatchEvent[];
  kicked: { reason: string };
}

interface Interpolated {
  x: number;
  z: number;
  yaw: number;
}

/**
 * Browser-side network client.
 *
 * Three jobs, and it is worth being precise about which is which:
 *
 *  - **Transport.** One WebSocket to the origin the page came from, with
 *    automatic reconnection using the resume token so a phone that drops to
 *    cellular for two seconds does not lose its match.
 *  - **Prediction.** The local player moves the instant your thumb moves,
 *    using the same `stepMovement` the server runs. Every input is kept until
 *    the server acknowledges it; when a snapshot arrives we rewind to the
 *    server's position and replay the unacknowledged inputs on top. That is
 *    what makes the controls feel local while the server stays the authority.
 *  - **Interpolation.** Everyone else is drawn 120 ms in the past, between the
 *    two snapshots that bracket that moment, so 15 Hz updates look continuous
 *    instead of teleporting.
 */
export class NetClient {
  readonly events = new EventBus<NetEvents>();

  state: ConnectionState = 'offline';
  playerId = '';
  lobby: LobbyState | null = null;
  latestSnapshot: MatchSnapshot | null = null;
  ping = -1;
  /** Snapshots per second, measured - shown in the debug overlay. */
  snapshotRate = 0;

  private socket: WebSocket | null = null;
  /** Set instead of `socket` when hosting the match inside this page. */
  private local: LocalHost | null = null;
  private url = '';
  private resumeToken = '';
  private name = 'GUARD';
  private buffer: { at: number; snap: MatchSnapshot }[] = [];
  private snapTimes: number[] = [];
  private pending: InputFrame[] = [];
  private seq = 0;
  private inputTimer = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wantConnection = false;
  private deliberateClose = false;

  /** Local predicted state for the player at this device. */
  predicted = { x: 0, z: 0, yaw: Math.PI, stamina: MOVE.stamina };
  /** Server's own last word on us, for the debug overlay. */
  serverPosition = { x: 0, z: 0 };

  constructor(private readonly storage: Storage | null = safeStorage()) {
    this.resumeToken = this.storage?.getItem('hollow-shift.resume') ?? '';
  }

  /* ----------------------------------------------------------- transport */

  /** Defaults to the origin that served the page. */
  static defaultUrl(): string {
    const override = new URLSearchParams(location.search).get('server');
    if (override) return override;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    // A file:// build has no host to talk to; the player must supply one.
    if (!location.host) return '';
    return `${protocol}//${location.host}/ws`;
  }

  /**
   * Host the match in this page instead of over the network.
   *
   * Used for solo play with AI teammates, and as the fallback when the game is
   * opened from a file with no server behind it. It runs the real server code
   * (see LocalHost), so everything downstream of here is unchanged.
   */
  connectLocal(name: string): void {
    this.disconnect();
    this.name = name;
    this.wantConnection = true;
    this.deliberateClose = false;
    this.local = new LocalHost((message) => this.receive(message));
    this.setState('online', 'LOCAL');
    this.send({ t: 'hello', v: PROTOCOL_VERSION, name });
  }

  get isLocal(): boolean {
    return this.local !== null;
  }

  connect(name: string, url = NetClient.defaultUrl()): void {
    this.name = name;
    this.url = url;
    this.wantConnection = true;
    this.deliberateClose = false;
    if (!url) {
      this.setState('failed', 'NO SERVER ADDRESS - OPEN THE GAME FROM A HOSTED URL OR ADD ?server=ws://...');
      return;
    }
    this.openSocket();
  }

  private openSocket(): void {
    this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.name, ...(this.resumeToken ? { resume: this.resumeToken } : {}) });
      this.setState('online');
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.sendPing(), 2000);
      this.sendPing();
    };

    socket.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      this.receive(message);
    };

    socket.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      this.socket = null;
      if (this.deliberateClose || !this.wantConnection) {
        this.setState('offline');
        return;
      }
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      /* onclose does the work; a socket error alone is not actionable */
    };
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    if (this.reconnectAttempts > 6) {
      this.setState('failed', 'CONNECTION LOST');
      return;
    }
    const delay = Math.min(8000, 500 * 2 ** (this.reconnectAttempts - 1));
    this.setState('reconnecting', `RECONNECTING (${this.reconnectAttempts}/6)`);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
  }

  disconnect(): void {
    this.wantConnection = false;
    this.deliberateClose = true;
    this.local?.close();
    this.local = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.socket?.close();
    this.socket = null;
    this.lobby = null;
    this.latestSnapshot = null;
    this.buffer.length = 0;
    this.setState('offline');
  }

  private setState(state: ConnectionState, detail?: string): void {
    this.state = state;
    this.events.emit('connection', { state, detail });
  }

  private send(message: ClientMessage): void {
    if (this.local) {
      this.local.send(message);
      return;
    }
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }

  private sendPing(): void {
    if (this.local) {
      this.ping = 0;
      return;
    }
    const sentAt = performance.now();
    this.pendingPing = sentAt;
    this.send({ t: 'ping', c: sentAt, ...(this.ping >= 0 ? { rtt: this.ping } : {}) });
  }

  private pendingPing = 0;

  /* ------------------------------------------------------------ receive */

  private receive(message: ServerMessage): void {
    switch (message.t) {
      case 'welcome':
        this.playerId = message.id;
        this.resumeToken = message.resume;
        // A local session dies with the page, so its token is worthless and
        // must not overwrite a real one from an online match.
        if (this.local) break;
        try {
          this.storage?.setItem('hollow-shift.resume', message.resume);
        } catch {
          /* storage unavailable - reconnect will just come back as a new player */
        }
        break;
      case 'lobby':
        this.lobby = message.state;
        this.events.emit('lobby', message.state);
        break;
      case 'public':
        this.events.emit('publicRooms', message.rooms);
        break;
      case 'error':
        this.events.emit('error', { code: message.code, message: message.message });
        break;
      case 'matchStart':
        this.buffer.length = 0;
        this.pending.length = 0;
        this.seq = 0;
        this.events.emit('matchStart', { seed: message.seed, startedAt: message.startedAt });
        break;
      case 'matchEnd':
        this.events.emit('matchEnd', { win: message.win, reason: message.reason });
        break;
      case 'snap':
        this.onSnapshot(message);
        break;
      case 'events':
        this.events.emit('matchEvents', message.list);
        break;
      case 'pong':
        if (message.c === this.pendingPing) this.ping = Math.round(performance.now() - message.c);
        break;
      case 'kick':
        this.wantConnection = false;
        this.events.emit('kicked', { reason: message.reason });
        break;
    }
  }

  private onSnapshot(snap: MatchSnapshot): void {
    const now = performance.now();
    this.latestSnapshot = snap;
    this.buffer.push({ at: now, snap });
    // Two seconds of history is far more than the interpolation delay needs.
    while (this.buffer.length > 2 && now - this.buffer[0].at > 2000) this.buffer.shift();

    this.snapTimes.push(now);
    while (this.snapTimes.length && now - this.snapTimes[0] > 1000) this.snapTimes.shift();
    this.snapshotRate = this.snapTimes.length;

    this.reconcile(snap);
    this.events.emit('snapshot', snap);
  }

  /**
   * Rewind to the server's authoritative position, then replay every input it
   * has not acknowledged yet. Without this the local player rubber-bands on
   * every snapshot; with it, the server can still correct you at any moment.
   */
  private reconcile(snap: MatchSnapshot): void {
    const mine = snap.players.find((p) => p.id === this.playerId);
    if (!mine) return;
    this.serverPosition = { x: mine.x, z: mine.z };
    if (mine.s !== 0) {
      // Downed or eliminated: the server is entirely in charge of the body.
      this.predicted.x = mine.x;
      this.predicted.z = mine.z;
      this.pending.length = 0;
      return;
    }

    const ack = mine.ack ?? 0;
    this.pending = this.pending.filter((f) => f.seq > ack);

    let state = { x: mine.x, z: mine.z, stamina: this.predicted.stamina };
    for (const frame of this.pending) {
      const result = stepMovement(state, frame, Math.min(MOVE.maxInputDt, frame.dt), false);
      state = { x: result.x, z: result.z, stamina: result.stamina };
    }

    const drift = Math.hypot(state.x - this.predicted.x, state.z - this.predicted.z);
    if (drift > 1.5) {
      // A big correction means the server rejected something. Snap, do not slide.
      this.predicted.x = state.x;
      this.predicted.z = state.z;
    } else {
      // Small disagreements are eased out so the camera never jerks.
      this.predicted.x += (state.x - this.predicted.x) * 0.25;
      this.predicted.z += (state.z - this.predicted.z) * 0.25;
    }
    this.predicted.stamina = state.stamina;
  }

  /* -------------------------------------------------------------- input */

  /**
   * Called every rendered frame with the current control state. Applies the
   * move locally straight away and ships it to the server at a fixed rate.
   */
  pushInput(
    dt: number,
    control: { mx: number; mz: number; yaw: number; sprint: boolean; crouch: boolean; flashlight: boolean },
    anchored: boolean,
  ): void {
    const clamped = Math.min(dt, MOVE.maxInputDt);
    this.predicted.yaw = control.yaw;
    const result = stepMovement(this.predicted, { ...control, seq: 0, dt: clamped }, clamped, anchored);
    this.predicted.x = result.x;
    this.predicted.z = result.z;
    this.predicted.stamina = result.stamina;

    this.inputTimer += dt;
    const interval = 1 / INPUT_HZ;
    if (this.inputTimer < interval) return;
    const frame: InputFrame = {
      seq: ++this.seq,
      mx: control.mx,
      mz: control.mz,
      yaw: control.yaw,
      sprint: control.sprint,
      crouch: control.crouch,
      flashlight: control.flashlight,
      dt: Math.min(MOVE.maxInputDt, this.inputTimer),
    };
    this.inputTimer = 0;
    this.pending.push(frame);
    if (this.pending.length > 60) this.pending.shift();
    this.send({ t: 'input', f: frame });
  }

  /* ------------------------------------------------------ interpolation */

  /** Where a remote entity should be drawn right now. */
  sample(id: string, kind: 'player' | 'bot'): Interpolated | null {
    const renderTime = performance.now() - INTERP_DELAY_MS;
    let older: { at: number; snap: MatchSnapshot } | null = null;
    let newer: { at: number; snap: MatchSnapshot } | null = null;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].at <= renderTime) {
        older = this.buffer[i];
        newer = this.buffer[i + 1] ?? null;
        break;
      }
    }
    if (!older) older = this.buffer[0] ?? null;
    if (!older) return null;

    const pick = (snap: MatchSnapshot) =>
      kind === 'player'
        ? (snap.players.find((p) => p.id === id) as PlayerSnap | undefined)
        : snap.bots.find((b) => b.id === id);

    const a = pick(older.snap);
    if (!a) return null;
    const b = newer ? pick(newer.snap) : undefined;
    if (!b || !newer) return { x: a.x, z: a.z, yaw: a.r };

    const span = newer.at - older.at;
    const t = span > 0 ? Math.max(0, Math.min(1, (renderTime - older.at) / span)) : 1;
    return {
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
      yaw: a.r + shortestAngle(a.r, b.r) * t,
    };
  }

  /** The most recent authoritative row for a player, without interpolation. */
  playerSnap(id: string): PlayerSnap | undefined {
    return this.latestSnapshot?.players.find((p) => p.id === id);
  }

  get me(): PlayerSnap | undefined {
    return this.playerSnap(this.playerId);
  }

  /* ------------------------------------------------------- lobby actions */

  host(settings: Partial<RoomSettings>): void {
    this.send({ t: 'host', settings });
  }

  join(code: string): void {
    this.send({ t: 'join', code });
  }

  quickJoin(): void {
    this.send({ t: 'quickJoin' });
  }

  listPublic(): void {
    this.send({ t: 'listPublic' });
  }

  setSettings(settings: Partial<RoomSettings>): void {
    this.send({ t: 'setSettings', settings });
  }

  setReady(ready: boolean): void {
    this.send({ t: 'ready', ready });
  }

  startMatch(): void {
    this.send({ t: 'start' });
  }

  leave(): void {
    this.send({ t: 'leave' });
    this.lobby = null;
    this.latestSnapshot = null;
    this.buffer.length = 0;
  }

  interact(id: string | null, held: boolean): void {
    this.send({ t: 'interact', id: id ?? '', held });
  }

  revive(target: string | null, held: boolean): void {
    this.send({ t: 'revive', target: target ?? '', held });
  }
}

function shortestAngle(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function safeStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
