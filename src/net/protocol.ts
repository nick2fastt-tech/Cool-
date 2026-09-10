/**
 * Wire protocol shared by the browser client and the Node server.
 *
 * One file, imported by both sides, so a message can never drift out of sync
 * between them. JSON over WebSocket: at four players and four animatronics a
 * full snapshot is well under a kilobyte, and readable frames are worth far
 * more during development than the bytes a binary codec would save.
 */

export const PROTOCOL_VERSION = 3;

/** Server simulation rate. */
export const SERVER_TICK_HZ = 30;
/** Snapshot broadcast rate. Clients interpolate between these. */
export const SNAPSHOT_HZ = 15;
/** Client input send rate. */
export const INPUT_HZ = 20;
/** How far behind the newest snapshot remote entities are rendered, in ms. */
export const INTERP_DELAY_MS = 120;
/** A disconnected player's slot is held this long for a reconnect. */
export const RECONNECT_GRACE_MS = 60_000;
/** Lobby is destroyed after this long with nobody in it. */
export const EMPTY_ROOM_TTL_MS = 30_000;

export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 4;

export type GameMode = 'coop-survival' | 'free-roam' | 'objective' | 'night-survival';
export type Difficulty = 'relaxed' | 'standard' | 'nightmare';
export type MapId = 'depot';

/** Modes that are actually implemented. The rest are shown as locked. */
export const IMPLEMENTED_MODES: GameMode[] = ['coop-survival', 'free-roam'];

export interface RoomSettings {
  maxPlayers: number;
  difficulty: Difficulty;
  map: MapId;
  mode: GameMode;
  isPublic: boolean;
  /** Every player must be ready before the host can start. */
  requireReady: boolean;
  /** 0-20 aggression scalar applied on top of the difficulty preset. */
  aiLevel: number;
}

export function defaultSettings(): RoomSettings {
  return {
    maxPlayers: 4,
    difficulty: 'standard',
    map: 'depot',
    mode: 'coop-survival',
    isPublic: true,
    requireReady: true,
    aiLevel: 10,
  };
}

export type PlayerStatus = 'lobby' | 'alive' | 'downed' | 'eliminated' | 'disconnected';

export interface LobbyPlayer {
  id: string;
  name: string;
  ready: boolean;
  isHost: boolean;
  /** Round-trip time in ms as measured by the server, or -1 before first ping. */
  ping: number;
  status: PlayerStatus;
}

export interface LobbyState {
  code: string;
  settings: RoomSettings;
  players: LobbyPlayer[];
  phase: 'lobby' | 'starting' | 'match' | 'ended';
  hostId: string;
  /** Set while phase === 'ended'. */
  result?: { win: boolean; reason: string };
}

export interface PublicRoomInfo {
  code: string;
  players: number;
  maxPlayers: number;
  mode: GameMode;
  difficulty: Difficulty;
  map: MapId;
  phase: LobbyState['phase'];
}

/* ------------------------------------------------------------ error codes */

export type ErrorCode =
  | 'BAD_VERSION'
  | 'INVALID_CODE'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ALREADY_STARTED'
  | 'NOT_HOST'
  | 'NOT_READY'
  | 'NO_PUBLIC_ROOMS'
  | 'ALREADY_IN_ROOM'
  | 'NOT_IN_ROOM'
  | 'RESUME_EXPIRED'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export const ERROR_TEXT: Record<ErrorCode, string> = {
  BAD_VERSION: 'CLIENT OUT OF DATE - RELOAD THE PAGE',
  INVALID_CODE: 'INVALID CODE',
  ROOM_NOT_FOUND: 'MATCH NO LONGER EXISTS',
  ROOM_FULL: 'LOBBY FULL',
  ALREADY_STARTED: 'MATCH ALREADY STARTED',
  NOT_HOST: 'ONLY THE HOST CAN DO THAT',
  NOT_READY: 'ALL PLAYERS MUST BE READY',
  NO_PUBLIC_ROOMS: 'NO PUBLIC MATCHES OPEN',
  ALREADY_IN_ROOM: 'ALREADY IN A MATCH',
  NOT_IN_ROOM: 'NOT IN A MATCH',
  RESUME_EXPIRED: 'YOUR SLOT EXPIRED - REJOINING AS NEW PLAYER',
  RATE_LIMITED: 'SLOW DOWN',
  INTERNAL: 'SERVER ERROR',
};

/* --------------------------------------------------------- client messages */

export interface InputFrame {
  /** Monotonic per-client sequence number, echoed back for reconciliation. */
  seq: number;
  /** Desired movement in world space, each component -1..1. */
  mx: number;
  mz: number;
  yaw: number;
  sprint: boolean;
  crouch: boolean;
  flashlight: boolean;
  /** Seconds this input covers. Server clamps it - see validateDt. */
  dt: number;
}

export type ClientMessage =
  | { t: 'hello'; v: number; name: string; resume?: string }
  | { t: 'host'; settings: Partial<RoomSettings> }
  | { t: 'join'; code: string }
  | { t: 'quickJoin' }
  | { t: 'listPublic' }
  | { t: 'setSettings'; settings: Partial<RoomSettings> }
  | { t: 'ready'; ready: boolean }
  | { t: 'start' }
  | { t: 'leave' }
  | { t: 'input'; f: InputFrame }
  | { t: 'interact'; id: string; held: boolean }
  | { t: 'revive'; target: string; held: boolean }
  | { t: 'ping'; c: number; rtt?: number };

/* --------------------------------------------------------- server messages */

/** Per-player snapshot row. Short keys: this ships 15 times a second. */
export interface PlayerSnap {
  id: string;
  x: number;
  z: number;
  /** Yaw in radians. */
  r: number;
  /** Status, packed: 0 alive, 1 downed, 2 eliminated, 3 disconnected. */
  s: number;
  /** Flashlight on. */
  f: boolean;
  /** Battery 0-100. */
  b: number;
  /** Sprinting, for remote animation. */
  sp: boolean;
  /** Downed bleed-out seconds remaining, or revive progress 0-1 when > 0. */
  d: number;
  /** Id of a carried item, if any. */
  it?: string;
  /** Last acknowledged input sequence - used for client reconciliation. */
  ack?: number;
}

export interface BotSnap {
  id: string;
  x: number;
  z: number;
  r: number;
  /** 0 patrol, 1 investigate, 2 chase, 3 attack, 4 stunned. */
  s: number;
  /** Id of the player being chased, if any. */
  tg?: string;
}

export interface ObjectiveSnap {
  /** Active step id, or 'none' when the grid is healthy. */
  step: string;
  label: string;
  /** 0-1 progress on the current step. */
  progress: number;
  /** Sub-counters, e.g. fuses fitted. */
  detail: string;
  /** Interactables that are currently lit up as the thing to do. */
  targets: string[];
}

export interface MatchSnapshot {
  t: 'snap';
  /** Server tick number. */
  k: number;
  /** Server time in ms since match start - drives the clock on every client. */
  ms: number;
  /** In-game hour, 0-6. */
  h: number;
  power: number;
  blackout: boolean;
  players: PlayerSnap[];
  bots: BotSnap[];
  obj: ObjectiveSnap;
  /** Interactable states that changed recently: id -> state code. */
  ints: Record<string, number>;
}

export type MatchEvent =
  | { e: 'down'; player: string; by: string }
  | { e: 'revived'; player: string; by: string }
  | { e: 'eliminated'; player: string }
  | { e: 'blackout' }
  | { e: 'restored'; power: number }
  | { e: 'step'; step: string; label: string }
  | { e: 'noise'; x: number; z: number; kind: string }
  | { e: 'hour'; hour: number }
  | { e: 'attack'; bot: string; player: string }
  | { e: 'pickup'; player: string; item: string };

export type ServerMessage =
  | { t: 'welcome'; id: string; resume: string; v: number }
  | { t: 'lobby'; state: LobbyState }
  | { t: 'public'; rooms: PublicRoomInfo[] }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'matchStart'; seed: number; map: MapId; startedAt: number }
  | { t: 'matchEnd'; win: boolean; reason: string }
  | MatchSnapshot
  | { t: 'events'; list: MatchEvent[] }
  | { t: 'pong'; c: number; s: number }
  | { t: 'kick'; reason: string };

/* ------------------------------------------------------------- join codes */

/** No I/O/0/1 - they are indistinguishable in the game's font. */
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 4; i++) out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return `DEPOT-${out}`;
}

const CODE_RE = /^(DEPOT-)?[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/;

/** Accepts "depot-7k2p", "7K2P", " 7k2p " - returns the canonical form. */
export function normaliseCode(input: string): string | null {
  const raw = input.trim().toUpperCase().replace(/\s+/g, '');
  const withDash = raw.includes('-') ? raw : raw.length === 4 ? `DEPOT-${raw}` : raw;
  if (!CODE_RE.test(withDash.replace('DEPOT-', ''))) return null;
  return withDash.startsWith('DEPOT-') ? withDash : `DEPOT-${withDash}`;
}

export const STATUS_CODE: Record<Exclude<PlayerStatus, 'lobby'>, number> = {
  alive: 0,
  downed: 1,
  eliminated: 2,
  disconnected: 3,
};

export const CODE_STATUS: Record<number, PlayerStatus> = {
  0: 'alive',
  1: 'downed',
  2: 'eliminated',
  3: 'disconnected',
};
