import {
  EMPTY_ROOM_TTL_MS,
  IMPLEMENTED_MODES,
  MAX_PLAYERS,
  MIN_PLAYERS,
  RECONNECT_GRACE_MS,
  SERVER_TICK_HZ,
  SNAPSHOT_HZ,
  defaultSettings,
  type LobbyPlayer,
  type LobbyState,
  type PlayerStatus,
  type PublicRoomInfo,
  type RoomSettings,
  type ServerMessage,
} from './protocol';
import { MatchSim } from '../mp/matchSim';
import { CrewAI, crewBotName } from '../mp/crewAI';

export interface Conn {
  id: string;
  name: string;
  send(message: ServerMessage): void;
  close(reason: string): void;
  room: Room | null;
  ping: number;
}

interface Member {
  id: string;
  name: string;
  conn: Conn | null;
  ready: boolean;
  isHost: boolean;
  joinedAt: number;
  resume: string;
  /** Set when the socket dropped; the slot is held until the grace expires. */
  disconnectedAt: number | null;
  /** Status the match had them in when they dropped. */
  prevStatus: PlayerStatus;
}

/**
 * One multiplayer session: a lobby that becomes a match.
 *
 * Authority lives here, not in any player's client. That is what makes host
 * migration a two-line operation - "host" is only a UI role that decides who
 * may press Start and change settings, so a host leaving mid-match does not
 * interrupt the simulation at all.
 */
export class Room {
  readonly members = new Map<string, Member>();
  settings: RoomSettings = defaultSettings();
  phase: LobbyState['phase'] = 'lobby';
  sim: MatchSim | null = null;
  /** AI teammates, created with the match and torn down with it. */
  crew: CrewAI | null = null;
  result: { win: boolean; reason: string } | null = null;
  startedAt = 0;
  seed = 0;
  private hostId = '';
  private loop: ReturnType<typeof setInterval> | null = null;
  private tickCounter = 0;
  private emptySince: number | null = null;
  private endTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly code: string, settings: Partial<RoomSettings>) {
    this.settings = { ...defaultSettings(), ...sanitiseSettings(settings) };
  }

  /* --------------------------------------------------------- membership */

  get connectedCount(): number {
    let n = 0;
    for (const [, m] of this.members) if (m.conn) n++;
    return n;
  }

  /** Members that still hold a slot, connected or inside the grace window. */
  get slotCount(): number {
    return this.members.size;
  }

  get isFull(): boolean {
    return this.slotCount >= this.settings.maxPlayers;
  }

  get host(): Member | undefined {
    return this.members.get(this.hostId);
  }

  add(conn: Conn): Member {
    const member: Member = {
      id: conn.id,
      name: conn.name,
      conn,
      ready: false,
      isHost: this.members.size === 0,
      joinedAt: Date.now(),
      resume: conn.id,
      disconnectedAt: null,
      prevStatus: 'lobby',
    };
    if (member.isHost) this.hostId = member.id;
    this.members.set(member.id, member);
    this.emptySince = null;
    conn.room = this;
    // Joining mid-match is allowed: you spawn in with the crew.
    if (this.phase === 'match' && this.sim) this.sim.addPlayer(member.id, member.name);
    return member;
  }

  /**
   * Socket dropped. Hold the slot so the player can come back.
   *
   * `conn` is the socket that actually closed. On a page reload the browser
   * can open the replacement socket before the old one's close is processed,
   * so the player reattaches first and the stale close arrives afterwards -
   * without this check it would immediately knock the reconnected player back
   * offline.
   */
  markDisconnected(id: string, conn?: Conn): void {
    const member = this.members.get(id);
    if (!member) return;
    if (conn && member.conn !== conn) return;
    member.conn = null;
    member.disconnectedAt = Date.now();
    member.ready = false;
    if (this.sim) {
      const player = this.sim.players.get(id);
      member.prevStatus = player?.status ?? 'alive';
      this.sim.setStatus(id, 'disconnected');
    }
    if (member.isHost) this.migrateHost();
    if (this.connectedCount === 0) this.emptySince = Date.now();
    this.broadcastLobby();
  }

  /**
   * Player is back on a new socket within the grace window.
   *
   * If the old socket still looks attached - a reload can beat its own close
   * event to the server - the new connection takes the slot over and the stale
   * one is closed. Together with the identity check in `markDisconnected`,
   * that makes reconnection work regardless of which event lands first.
   */
  reattach(id: string, conn: Conn): boolean {
    const member = this.members.get(id);
    if (!member) return false;
    if (member.conn === conn) return true;
    if (member.conn) {
      const stale = member.conn;
      member.conn = null;
      stale.room = null;
      stale.close('session resumed elsewhere');
    }
    member.conn = conn;
    member.disconnectedAt = null;
    member.name = conn.name || member.name;
    conn.room = this;
    this.emptySince = null;
    if (this.sim) {
      if (!this.sim.players.has(id)) this.sim.addPlayer(id, member.name);
      // Never spawn a second body: the original entity is reused.
      this.sim.setStatus(id, member.prevStatus === 'disconnected' ? 'alive' : member.prevStatus);
    }
    if (!this.members.get(this.hostId)?.conn) this.migrateHost();
    this.broadcastLobby();
    return true;
  }

  remove(id: string): void {
    const member = this.members.get(id);
    if (!member) return;
    this.members.delete(id);
    this.sim?.removePlayer(id);
    if (member.isHost) this.migrateHost();
    if (this.connectedCount === 0) this.emptySince = Date.now();
    this.broadcastLobby();
  }

  private migrateHost(): void {
    const candidates = [...this.members.values()]
      .filter((m) => m.conn)
      .sort((a, b) => a.joinedAt - b.joinedAt);
    for (const [, m] of this.members) m.isHost = false;
    const next = candidates[0];
    if (!next) {
      this.hostId = '';
      return;
    }
    next.isHost = true;
    this.hostId = next.id;
  }

  /* -------------------------------------------------------------- lobby */

  setReady(id: string, ready: boolean): void {
    const member = this.members.get(id);
    if (!member) return;
    member.ready = ready;
    this.broadcastLobby();
  }

  setSettings(id: string, patch: Partial<RoomSettings>): boolean {
    if (id !== this.hostId) return false;
    if (this.phase !== 'lobby') return false;
    const next = { ...this.settings, ...sanitiseSettings(patch) };
    // Never set a cap below the number of people already standing here.
    next.maxPlayers = Math.max(next.maxPlayers, this.slotCount);
    this.settings = next;
    this.broadcastLobby();
    return true;
  }

  canStart(id: string): { ok: true } | { ok: false; reason: 'NOT_HOST' | 'NOT_READY' | 'ALREADY_STARTED' } {
    if (id !== this.hostId) return { ok: false, reason: 'NOT_HOST' };
    if (this.phase === 'match' || this.phase === 'starting') return { ok: false, reason: 'ALREADY_STARTED' };
    if (this.settings.requireReady) {
      for (const [, m] of this.members) {
        if (m.conn && !m.isHost && !m.ready) return { ok: false, reason: 'NOT_READY' };
      }
    }
    return { ok: true };
  }

  /* -------------------------------------------------------------- match */

  start(): void {
    if (this.phase === 'match') return;
    this.phase = 'match';
    this.result = null;
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    this.startedAt = Date.now();
    // Two test-only knobs, read from the environment so no client can reach
    // them. They let automated tests reach a blackout in seconds and keep the
    // animatronics calm while movement and objectives are being checked.
    const testPower = Number(process.env.HOLLOW_TEST_START_POWER ?? '');
    const testAi = Number(process.env.HOLLOW_TEST_AI_LEVEL ?? '');
    this.sim = new MatchSim({
      ...(Number.isFinite(testPower) && testPower > 0 ? { startPower: testPower } : {}),
      seed: this.seed,
      mode: this.settings.mode,
      difficulty: this.settings.difficulty,
      aiLevel: Number.isFinite(testAi) && testAi > 0 ? testAi : this.settings.aiLevel,
      players: [...this.members.values()]
        .filter((m) => m.conn)
        .map((m) => ({ id: m.id, name: m.name })),
    });
    // AI teammates fill whatever the humans have not taken. People always get
    // the seats first: bots never block a real player from joining.
    const humans = [...this.members.values()].filter((m) => m.conn).length;
    const botCount = Math.max(0, Math.min(this.settings.bots, this.settings.maxPlayers - humans));
    const botIds: string[] = [];
    for (let i = 0; i < botCount; i++) {
      const id = `bot-${i}`;
      this.sim.addPlayer(id, crewBotName(i), true);
      botIds.push(id);
    }
    this.crew = botIds.length ? new CrewAI(this.sim, botIds) : null;

    this.broadcast({ t: 'matchStart', seed: this.seed, map: this.settings.map, startedAt: this.startedAt });
    this.broadcastLobby();

    // The loop advances by *real* elapsed time in fixed steps, rather than
    // assuming the interval fired on time. Node timers drift and bunch up under
    // load; without this the match clock would run slow on a busy server and
    // snapshots would arrive in bursts.
    const stepSeconds = 1 / SERVER_TICK_HZ;
    const snapshotInterval = 1000 / SNAPSHOT_HZ;
    let last = Date.now();
    let accumulator = 0;
    let lastSnapshotAt = 0;
    this.tickCounter = 0;

    this.loop = setInterval(() => {
      const sim = this.sim;
      if (!sim) return;
      const now = Date.now();
      // Cap catch-up so a stalled process cannot fast-forward the whole night.
      accumulator += Math.min(0.25, (now - last) / 1000);
      last = now;

      let steps = 0;
      while (accumulator >= stepSeconds && steps < 8) {
        // Teammates decide before the world moves, exactly like a human client
        // whose input arrived between ticks.
        this.crew?.step(stepSeconds);
        sim.step(stepSeconds);
        accumulator -= stepSeconds;
        this.tickCounter++;
        steps++;
      }

      const events = sim.drainEvents();
      if (events.length) this.broadcast({ t: 'events', list: events });
      if (now - lastSnapshotAt >= snapshotInterval) {
        lastSnapshotAt = now;
        this.broadcast(sim.snapshot());
      }

      if (sim.finished) this.endMatch(sim.finished);
    }, 1000 / SERVER_TICK_HZ);
  }

  private endMatch(result: { win: boolean; reason: string }): void {
    this.stopLoop();
    this.result = result;
    this.phase = 'ended';
    this.broadcast({ t: 'matchEnd', win: result.win, reason: result.reason });
    this.broadcastLobby();
    // Back to the lobby so a crew can immediately run it again.
    this.endTimer = setTimeout(() => {
      this.phase = 'lobby';
      this.sim = null;
      this.crew = null;
      for (const [, m] of this.members) {
        m.ready = false;
        m.prevStatus = 'lobby';
      }
      this.broadcastLobby();
    }, 8000);
  }

  private stopLoop(): void {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
  }

  /* --------------------------------------------------------- housekeeping */

  /** Called on a timer by the server; returns true when the room should die. */
  sweep(now: number): boolean {
    for (const [id, member] of [...this.members]) {
      if (member.disconnectedAt && now - member.disconnectedAt > RECONNECT_GRACE_MS) {
        this.members.delete(id);
        this.sim?.removePlayer(id);
        if (member.isHost) this.migrateHost();
        this.broadcastLobby();
      }
    }
    if (this.connectedCount > 0) {
      this.emptySince = null;
      return false;
    }
    if (this.emptySince === null) this.emptySince = now;
    if (now - this.emptySince > EMPTY_ROOM_TTL_MS) {
      this.dispose();
      return true;
    }
    return false;
  }

  dispose(): void {
    this.stopLoop();
    if (this.endTimer) clearTimeout(this.endTimer);
    this.endTimer = null;
    for (const [, m] of this.members) m.conn?.close('room closed');
    this.members.clear();
    this.sim = null;
    this.crew = null;
  }

  /* ------------------------------------------------------------- comms */

  broadcast(message: ServerMessage): void {
    for (const [, m] of this.members) m.conn?.send(message);
  }

  lobbyState(): LobbyState {
    const players: LobbyPlayer[] = [...this.members.values()].map((m) => ({
      id: m.id,
      name: m.name,
      ready: m.ready,
      isHost: m.isHost,
      ping: m.conn?.ping ?? -1,
      status: !m.conn
        ? 'disconnected'
        : this.sim?.players.get(m.id)?.status ?? (this.phase === 'match' ? 'alive' : 'lobby'),
    }));
    // AI teammates appear in the crew list like anybody else, marked as bots.
    const botIds = this.crew?.ids ?? [];
    if (botIds.length) {
      for (const id of botIds) {
        players.push({
          id,
          name: this.sim?.players.get(id)?.name ?? 'CREW',
          ready: true,
          isHost: false,
          isBot: true,
          ping: 0,
          status: this.sim?.players.get(id)?.status ?? 'alive',
        });
      }
    } else if (this.phase === 'lobby' && this.settings.bots > 0) {
      const free = Math.max(0, this.settings.maxPlayers - this.members.size);
      for (let i = 0; i < Math.min(this.settings.bots, free); i++) {
        players.push({ id: `bot-${i}`, name: crewBotName(i), ready: true, isHost: false, isBot: true, ping: 0, status: 'lobby' });
      }
    }

    return {
      code: this.code,
      settings: this.settings,
      players,
      phase: this.phase,
      hostId: this.hostId,
      ...(this.result ? { result: this.result } : {}),
    };
  }

  broadcastLobby(): void {
    this.broadcast({ t: 'lobby', state: this.lobbyState() });
  }

  publicInfo(): PublicRoomInfo {
    return {
      code: this.code,
      players: this.slotCount,
      maxPlayers: this.settings.maxPlayers,
      mode: this.settings.mode,
      difficulty: this.settings.difficulty,
      map: this.settings.map,
      phase: this.phase,
    };
  }
}

function sanitiseSettings(patch: Partial<RoomSettings>): Partial<RoomSettings> {
  const out: Partial<RoomSettings> = {};
  if (typeof patch.maxPlayers === 'number') {
    out.maxPlayers = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Math.floor(patch.maxPlayers)));
  }
  if (patch.difficulty === 'relaxed' || patch.difficulty === 'standard' || patch.difficulty === 'nightmare') {
    out.difficulty = patch.difficulty;
  }
  if (patch.map === 'depot') out.map = patch.map;
  // Only implemented modes are accepted, whatever a client asks for.
  if (patch.mode && IMPLEMENTED_MODES.includes(patch.mode)) out.mode = patch.mode;
  if (typeof patch.isPublic === 'boolean') out.isPublic = patch.isPublic;
  if (typeof patch.requireReady === 'boolean') out.requireReady = patch.requireReady;
  if (typeof patch.aiLevel === 'number') {
    out.aiLevel = Math.max(1, Math.min(20, Math.round(patch.aiLevel)));
  }
  if (typeof patch.bots === 'number') {
    out.bots = Math.max(0, Math.min(MAX_PLAYERS - 1, Math.floor(patch.bots)));
  }
  return out;
}
