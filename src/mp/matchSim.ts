/**
 * Authoritative co-op match simulation.
 *
 * This runs on the server and nowhere else. Clients send *intents* (a movement
 * vector, "I am holding the generator", "I am reviving Sam") and read the
 * result out of snapshots. The only part of this file a client executes is
 * `stepMovement`, and only to predict its own position between snapshots -
 * the server's answer always wins.
 *
 * Nothing here imports the DOM, three.js or the single-player code.
 */

import {
  BOT_RADIUS,
  ROOMS,
  INTERACT_BY_ID,
  INTERACT_RANGE,
  INTERACTABLES,
  NAV_BY_ID,
  PATROL_NODES,
  PLAYER_RADIUS,
  SPAWNS,
  findPath,
  hasLineOfSight,
  nearestNode,
  resolveCollision,
  roomAt,
  roomName,
} from './map';
import { STATUS_CODE, type BotSnap, type Difficulty, type GameMode, type InputFrame, type MatchEvent, type MatchSnapshot, type ObjectiveSnap, type PlayerSnap, type PlayerStatus } from '../net/protocol';

/* --------------------------------------------------------------- tuning */

export const MOVE = {
  walk: 2.7,
  sprint: 4.5,
  crouch: 1.35,
  /** Seconds of sprint available from full. */
  stamina: 5.5,
  staminaRegenPerSecond: 0.85,
  /** Server refuses to integrate more than this much time from one input. */
  maxInputDt: 0.2,
};

export const FLASHLIGHT = {
  drainPerSecond: 1.9,
  /** A dead light is not a dead player: it comes back very slowly. */
  trickleRegenPerSecond: 0.12,
  /** Charge needed before a dead torch will switch on again. */
  minimumToSwitchOn: 5,
  chargeStationPerSecond: 34,
  chargeStationCooldown: 40,
};

const DIFFICULTY: Record<Difficulty, {
  secondsPerHour: number;
  powerDrain: number;
  botSpeedScale: number;
  aggression: number;
  reviveSeconds: number;
  bleedOutSeconds: number;
}> = {
  relaxed:   { secondsPerHour: 70, powerDrain: 0.30, botSpeedScale: 0.88, aggression: 0.7, reviveSeconds: 6, bleedOutSeconds: 60 },
  standard:  { secondsPerHour: 60, powerDrain: 0.40, botSpeedScale: 1.0,  aggression: 1.0, reviveSeconds: 8, bleedOutSeconds: 45 },
  nightmare: { secondsPerHour: 52, powerDrain: 0.52, botSpeedScale: 1.12, aggression: 1.35, reviveSeconds: 10, bleedOutSeconds: 32 },
};

export const HOURS_PER_NIGHT = 6;

/* ------------------------------------------------------------- entities */

export interface MatchPlayer {
  id: string;
  name: string;
  x: number;
  z: number;
  yaw: number;
  status: PlayerStatus;
  battery: number;
  flashlight: boolean;
  sprinting: boolean;
  crouching: boolean;
  stamina: number;
  /** Interactable id currently held, or null. */
  holding: string | null;
  holdProgress: number;
  /** Player id being revived, or null. */
  reviving: string | null;
  /** Seconds left before bleed-out, when downed. */
  bleedOut: number;
  /** 0-1 progress of someone reviving this player. */
  revivedProgress: number;
  carrying: string | null;
  lastSeq: number;
  /** Rolling noise level, 0-1, decayed each tick. */
  noise: number;
}

type BotKind = 'bear' | 'rabbit' | 'hen' | 'fox';
type BotState = 'patrol' | 'investigate' | 'chase' | 'attack' | 'cooldown';

const BOT_STATE_CODE: Record<BotState, number> = { patrol: 0, investigate: 1, chase: 2, attack: 3, cooldown: 4 };

interface Bot {
  id: BotKind;
  x: number;
  z: number;
  yaw: number;
  state: BotState;
  target: string | null;
  path: string[];
  pathIndex: number;
  /** Where a heard noise is being investigated. */
  investigate: { x: number; z: number } | null;
  speedWalk: number;
  speedChase: number;
  /** Seconds until this bot may attack again. */
  attackCooldown: number;
  /** Seconds until it re-evaluates its target. */
  thinkTimer: number;
  /** How long it has been unable to see its target. */
  lostTimer: number;
  /** Fox only: charge burst timing. */
  burst: number;
  burstCooldown: number;
}

export type ObjectiveStep =
  | 'none'
  | 'findElectrical'
  | 'generator'
  | 'fuses'
  | 'breakers'
  | 'mainSwitch'
  | 'spinUp';

interface ObjectiveState {
  step: ObjectiveStep;
  generator: number;
  fusesFitted: number;
  fusesAvailable: Set<string>;
  breakers: Set<string>;
  mainHeld: Record<string, number>;
  spinUp: number;
  /** How many blackouts this match has had. */
  round: number;
}

export interface MatchOptions {
  seed: number;
  difficulty: Difficulty;
  /** Which game mode's rules to run. Defaults to co-op survival. */
  mode?: GameMode;
  aiLevel: number;
  players: { id: string; name: string }[];
  /**
   * Starting power. Server-side only, set from an environment variable, so
   * automated tests can reach a blackout in seconds instead of minutes. No
   * client can influence it.
   */
  startPower?: number;
}

/* ------------------------------------------------------------------ sim */

/** Rooms that count toward exploration in Free Roam. */
export const EXPLORABLE_ROOMS = ROOMS.map((r) => r.id);

export class MatchSim {
  readonly players = new Map<string, MatchPlayer>();
  readonly bots: Bot[] = [];
  readonly mode: GameMode;
  private readonly tuning: (typeof DIFFICULTY)[Difficulty];
  private readonly aggression: number;
  /** Free Roam: rooms the crew has set foot in. */
  private readonly explored = new Set<string>();

  power = 100;
  blackout = false;
  elapsed = 0;
  tick = 0;
  finished: { win: boolean; reason: string } | null = null;

  private objective: ObjectiveState = {
    step: 'none',
    generator: 0,
    fusesFitted: 0,
    fusesAvailable: new Set(['fuseA', 'fuseB', 'fuseC']),
    breakers: new Set(),
    mainHeld: {},
    spinUp: 0,
    round: 0,
  };
  private batteryCooldowns: Record<string, number> = {};
  private events: MatchEvent[] = [];
  private lastHour = 0;
  private rngState: number;

  constructor(options: MatchOptions) {
    this.mode = options.mode ?? 'coop-survival';
    this.rngState = options.seed >>> 0 || 1;
    this.tuning = DIFFICULTY[options.difficulty];
    if (typeof options.startPower === 'number') this.power = Math.max(0.01, options.startPower);
    this.aggression = (options.aiLevel / 10) * this.tuning.aggression;

    options.players.forEach((p, i) => {
      const spawn = SPAWNS[i % SPAWNS.length];
      this.players.set(p.id, {
        id: p.id,
        name: p.name,
        x: spawn.x,
        z: spawn.z,
        yaw: 0,
        status: 'alive',
        battery: 100,
        flashlight: false,
        sprinting: false,
        crouching: false,
        stamina: MOVE.stamina,
        holding: null,
        holdProgress: 0,
        reviving: null,
        bleedOut: 0,
        revivedProgress: 0,
        carrying: null,
        lastSeq: 0,
        noise: 0,
      });
    });

    const spawnNodes: Record<BotKind, string> = {
      bear: 'stage', rabbit: 'backstage', hen: 'kitchen', fox: 'cove',
    };
    const speeds: Record<BotKind, [number, number]> = {
      bear: [1.9, 3.5], rabbit: [2.4, 4.0], hen: [2.1, 3.7], fox: [2.2, 5.3],
    };
    for (const kind of ['bear', 'rabbit', 'hen', 'fox'] as BotKind[]) {
      const node = NAV_BY_ID.get(spawnNodes[kind])!;
      this.bots.push({
        id: kind,
        x: node.x,
        z: node.z,
        yaw: 0,
        state: 'patrol',
        target: null,
        path: [],
        pathIndex: 0,
        investigate: null,
        speedWalk: speeds[kind][0] * this.tuning.botSpeedScale,
        speedChase: speeds[kind][1] * this.tuning.botSpeedScale,
        attackCooldown: 6,
        thinkTimer: this.random() * 2,
        lostTimer: 0,
        burst: 0,
        burstCooldown: 8,
      });
    }
  }

  /**
   * Free Roam escalation.
   *
   * There is no clock running out and no grid draining, so the pressure has to
   * come from somewhere: the more of the building the crew has walked, and the
   * longer they have been in it, the more attention they attract. Capped, so
   * it ramps into "dangerous" rather than "impossible".
   */
  private escalation(): number {
    if (this.mode !== 'free-roam') return 1;
    const byRooms = this.explored.size * 0.07;
    const byTime = (this.elapsed / 60) * 0.12;
    return Math.min(2.4, 1 + byRooms + byTime);
  }

  private random(): number {
    this.rngState = (this.rngState + 0x6d2b79f5) >>> 0;
    let t = this.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  get hour(): number {
    return Math.min(HOURS_PER_NIGHT, Math.floor(this.elapsed / this.tuning.secondsPerHour));
  }

  get aliveCount(): number {
    let n = 0;
    for (const [, p] of this.players) if (p.status === 'alive') n++;
    return n;
  }

  /* ------------------------------------------------------ player intents */

  /** A client says where it wants to be. The server decides where it is. */
  applyInput(id: string, frame: InputFrame): void {
    const player = this.players.get(id);
    if (!player || player.status !== 'alive' || this.finished) return;
    // Never trust a client's clock: an inflated dt is a speed hack.
    const dt = Math.max(0, Math.min(MOVE.maxInputDt, frame.dt));
    if (frame.seq <= player.lastSeq) return;
    player.lastSeq = frame.seq;
    player.yaw = frame.yaw;
    // A dead torch needs a real charge before it will light again, otherwise
    // it strobes on and off frame by frame as the trickle regen crosses zero.
    player.flashlight = frame.flashlight && (player.flashlight ? player.battery > 0 : player.battery >= 5);
    player.crouching = frame.crouch;

    const result = stepMovement(
      { x: player.x, z: player.z, stamina: player.stamina },
      frame,
      dt,
      player.holding !== null || player.reviving !== null,
    );
    player.x = result.x;
    player.z = result.z;
    player.stamina = result.stamina;
    player.sprinting = result.sprinting;

    const moving = Math.abs(frame.mx) + Math.abs(frame.mz) > 0.05;
    const noise = !moving ? 0 : player.sprinting ? 1 : player.crouching ? 0.12 : 0.45;
    player.noise = Math.max(player.noise, noise);
  }

  /**
   * Client asks to hold an interactable. Validated here: right distance,
   * right step of the objective, right state. A client that lies about where
   * it is standing gets nothing, because the server owns its position.
   */
  setInteract(id: string, targetId: string | null, held: boolean): void {
    const player = this.players.get(id);
    if (!player || player.status !== 'alive' || this.finished) return;
    if (!held || !targetId) {
      if (player.holding) this.releaseHold(player);
      return;
    }
    const target = INTERACT_BY_ID.get(targetId);
    if (!target) return;
    const dx = player.x - target.x;
    const dz = player.z - target.z;
    if (dx * dx + dz * dz > INTERACT_RANGE * INTERACT_RANGE) return; // out of reach
    if (!this.isInteractAllowed(player, targetId)) return;
    if (player.holding !== targetId) {
      player.holding = targetId;
      player.holdProgress = 0;
    }
  }

  setRevive(id: string, targetId: string | null, held: boolean): void {
    const player = this.players.get(id);
    if (!player || player.status !== 'alive' || this.finished) return;
    if (!held || !targetId) {
      player.reviving = null;
      return;
    }
    const target = this.players.get(targetId);
    if (!target || target.status !== 'downed') return;
    const dx = player.x - target.x;
    const dz = player.z - target.z;
    if (dx * dx + dz * dz > 2.2 * 2.2) return;
    player.reviving = targetId;
  }

  addPlayer(id: string, name: string): void {
    if (this.players.has(id)) return;
    const spawn = SPAWNS[this.players.size % SPAWNS.length];
    this.players.set(id, {
      id, name, x: spawn.x, z: spawn.z, yaw: Math.PI, status: 'alive',
      battery: 60, flashlight: false, sprinting: false, crouching: false,
      stamina: MOVE.stamina, holding: null, holdProgress: 0, reviving: null,
      bleedOut: 0, revivedProgress: 0, carrying: null, lastSeq: 0, noise: 0,
    });
  }

  setStatus(id: string, status: PlayerStatus): void {
    const player = this.players.get(id);
    if (!player) return;
    if (player.carrying && status !== 'alive') {
      // Drop the fuse back where it came from rather than deleting it, so a
      // disconnect can never soft-lock the restoration objective.
      this.objective.fusesAvailable.add(player.carrying);
      player.carrying = null;
    }
    player.status = status;
    player.holding = null;
    player.reviving = null;
    if (status !== 'downed') player.revivedProgress = 0;
  }

  removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player?.carrying) this.objective.fusesAvailable.add(player.carrying);
    this.players.delete(id);
    for (const bot of this.bots) if (bot.target === id) bot.target = null;
  }

  /* ---------------------------------------------------------------- tick */

  step(dt: number): void {
    if (this.finished) return;
    this.tick++;
    this.elapsed += dt;

    const hour = this.hour;
    if (hour !== this.lastHour) {
      this.lastHour = hour;
      this.events.push({ e: 'hour', hour });
    }

    this.stepPower(dt);
    this.stepInteractions(dt);
    this.stepPlayers(dt);
    this.stepBots(dt);
    if (this.mode === 'free-roam') this.stepExploration();

    if (this.mode === 'free-roam') {
      if (this.explored.size >= EXPLORABLE_ROOMS.length) {
        this.finished = { win: true, reason: 'Every room in the building has been walked.' };
      }
    } else if (this.elapsed >= this.tuning.secondsPerHour * HOURS_PER_NIGHT) {
      this.finished = { win: true, reason: 'The shift ended at 6 AM.' };
    }
    if (!this.finished && this.players.size > 0 && this.aliveCount === 0 && this.noRevivablePlayers()) {
      this.finished = { win: false, reason: 'The whole crew was taken.' };
    }
  }

  /** Credit every room an living player is standing in. */
  private stepExploration(): void {
    for (const [, player] of this.players) {
      if (player.status !== 'alive') continue;
      const room = roomAt(player.x, player.z);
      if (room === 'void' || this.explored.has(room)) continue;
      this.explored.add(room);
      this.events.push({
        e: 'step',
        step: 'explore',
        label: `${roomName(room).toUpperCase()} - ${this.explored.size}/${EXPLORABLE_ROOMS.length} EXPLORED`,
      });
    }
  }

  /** Rooms walked so far, for the HUD and for tests. */
  get exploredRooms(): readonly string[] {
    return [...this.explored];
  }

  private noRevivablePlayers(): boolean {
    for (const [, p] of this.players) if (p.status === 'downed') return false;
    return true;
  }

  private stepPower(dt: number): void {
    if (this.mode === 'free-roam' || this.blackout) return;
    const scale = 1 + Math.max(0, this.players.size - 1) * 0.12;
    this.power -= this.tuning.powerDrain * scale * dt;
    if (this.power <= 0) {
      this.power = 0;
      this.blackout = true;
      this.objective.step = 'findElectrical';
      this.objective.round++;
      this.objective.generator = 0;
      this.objective.fusesFitted = 0;
      this.objective.breakers.clear();
      this.objective.mainHeld = {};
      this.objective.spinUp = 0;
      this.objective.fusesAvailable = new Set(['fuseA', 'fuseB', 'fuseC']);
      for (const [, p] of this.players) {
        if (p.carrying) p.carrying = null;
      }
      this.events.push({ e: 'blackout' });
      this.events.push({ e: 'step', step: 'findElectrical', label: this.objectiveLabel() });
      // Everything gets braver in the dark.
      for (const bot of this.bots) bot.thinkTimer = 0;
    }
  }

  private isInteractAllowed(player: MatchPlayer, id: string): boolean {
    const def = INTERACT_BY_ID.get(id);
    if (!def) return false;
    const obj = this.objective;
    switch (def.kind) {
      case 'battery':
        return (this.batteryCooldowns[id] ?? 0) <= 0 && player.battery < 99;
      case 'generator':
        return this.blackout && (obj.step === 'findElectrical' || obj.step === 'generator');
      case 'fuse':
        return this.blackout && obj.step === 'fuses' && !player.carrying && obj.fusesAvailable.has(id);
      case 'fusePanel':
        return this.blackout && obj.step === 'fuses' && player.carrying !== null;
      case 'breaker':
        return this.blackout && obj.step === 'breakers' && !obj.breakers.has(id);
      case 'mainSwitch':
        return this.blackout && obj.step === 'mainSwitch';
      default:
        return false;
    }
  }

  private releaseHold(player: MatchPlayer): void {
    if (player.holding) {
      const def = INTERACT_BY_ID.get(player.holding);
      // The main switches must be held *together*: letting go resets yours.
      if (def?.kind === 'mainSwitch') delete this.objective.mainHeld[player.holding];
    }
    player.holding = null;
    player.holdProgress = 0;
  }

  private stepInteractions(dt: number): void {
    for (const id of Object.keys(this.batteryCooldowns)) {
      this.batteryCooldowns[id] = Math.max(0, this.batteryCooldowns[id] - dt);
    }

    const obj = this.objective;
    const heldMain = new Set<string>();

    for (const [, player] of this.players) {
      if (!player.holding || player.status !== 'alive') continue;
      const def = INTERACT_BY_ID.get(player.holding);
      if (!def) {
        player.holding = null;
        continue;
      }
      // Re-validate every tick: a player who walked away stops progressing.
      const dx = player.x - def.x;
      const dz = player.z - def.z;
      if (dx * dx + dz * dz > INTERACT_RANGE * INTERACT_RANGE || !this.isInteractAllowed(player, def.id)) {
        this.releaseHold(player);
        continue;
      }

      player.holdProgress += dt;
      // Working on a panel is loud.
      if (def.kind !== 'fuse') player.noise = Math.max(player.noise, 0.75);

      if (def.kind === 'mainSwitch') {
        obj.mainHeld[def.id] = player.holdProgress;
        heldMain.add(def.id);
        continue;
      }
      if (player.holdProgress < def.holdSeconds) continue;

      player.holdProgress = 0;
      switch (def.kind) {
        case 'battery':
          player.battery = 100;
          this.batteryCooldowns[def.id] = FLASHLIGHT.chargeStationCooldown;
          player.holding = null;
          break;
        case 'generator':
          obj.generator = 1;
          this.advanceStep('fuses');
          player.holding = null;
          break;
        case 'fuse':
          obj.fusesAvailable.delete(def.id);
          player.carrying = def.id;
          this.events.push({ e: 'pickup', player: player.id, item: def.id });
          player.holding = null;
          break;
        case 'fusePanel':
          if (player.carrying) {
            player.carrying = null;
            obj.fusesFitted++;
            if (obj.fusesFitted >= 3) this.advanceStep('breakers');
          }
          player.holding = null;
          break;
        case 'breaker':
          obj.breakers.add(def.id);
          if (obj.breakers.size >= 3) this.advanceStep('mainSwitch');
          player.holding = null;
          break;
        default:
          break;
      }
    }

    for (const id of Object.keys(obj.mainHeld)) {
      if (!heldMain.has(id)) delete obj.mainHeld[id];
    }

    if (obj.step === 'mainSwitch') {
      // With a crew, both switches at once. Alone, the one switch takes longer.
      const needBoth = this.aliveCount > 1;
      const a = obj.mainHeld['mainA'] ?? 0;
      const b = obj.mainHeld['mainB'] ?? 0;
      const done = needBoth ? a >= 3 && b >= 3 : a >= 8 || b >= 8;
      if (done) this.advanceStep('spinUp');
    }

    if (obj.step === 'spinUp') {
      obj.spinUp += dt;
      if (obj.spinUp >= 10) this.restorePower();
    }

    if (obj.step === 'findElectrical') {
      // The step advances as soon as somebody is actually in the room.
      for (const [, p] of this.players) {
        if (p.status === 'alive' && p.x < -17 && p.z > -5 && p.z < 1) {
          this.advanceStep('generator');
          break;
        }
      }
    }
  }

  private advanceStep(step: ObjectiveStep): void {
    if (this.objective.step === step) return;
    this.objective.step = step;
    this.events.push({ e: 'step', step, label: this.objectiveLabel() });
  }

  private restorePower(): void {
    const give = [45, 32, 24, 18][Math.min(3, this.objective.round - 1)] ?? 15;
    this.power = give;
    this.blackout = false;
    this.objective.step = 'none';
    this.objective.spinUp = 0;
    this.events.push({ e: 'restored', power: give });
  }

  private stepPlayers(dt: number): void {
    const reviveSeconds = this.tuning.reviveSeconds;
    const beingRevived = new Map<string, number>();
    for (const [, p] of this.players) {
      if (p.status !== 'alive' || !p.reviving) continue;
      const target = this.players.get(p.reviving);
      if (!target || target.status !== 'downed') {
        p.reviving = null;
        continue;
      }
      const dx = p.x - target.x;
      const dz = p.z - target.z;
      if (dx * dx + dz * dz > 2.2 * 2.2) {
        p.reviving = null;
        continue;
      }
      beingRevived.set(target.id, (beingRevived.get(target.id) ?? 0) + dt);
    }

    for (const [, player] of this.players) {
      player.noise = Math.max(0, player.noise - dt * 1.4);

      if (player.status === 'downed') {
        const help = beingRevived.get(player.id);
        if (help) {
          player.revivedProgress = Math.min(1, player.revivedProgress + help / reviveSeconds);
          if (player.revivedProgress >= 1) {
            player.status = 'alive';
            player.revivedProgress = 0;
            player.bleedOut = 0;
            player.battery = Math.max(player.battery, 35);
            player.stamina = MOVE.stamina * 0.5;
            const rescuer = [...this.players.values()].find((p) => p.reviving === player.id);
            this.events.push({ e: 'revived', player: player.id, by: rescuer?.id ?? '' });
            for (const p of this.players.values()) if (p.reviving === player.id) p.reviving = null;
          }
        } else {
          // Bleeding out only pauses while somebody is actually working on you.
          player.revivedProgress = Math.max(0, player.revivedProgress - dt * 0.15);
          player.bleedOut -= dt;
          if (player.bleedOut <= 0) {
            player.status = 'eliminated';
            this.events.push({ e: 'eliminated', player: player.id });
          }
        }
        continue;
      }

      if (player.status !== 'alive') continue;

      if (player.flashlight && player.battery > 0) {
        player.battery = Math.max(0, player.battery - FLASHLIGHT.drainPerSecond * dt);
        if (player.battery <= 0) player.flashlight = false;
      } else if (!player.flashlight && player.battery < 100) {
        player.battery = Math.min(100, player.battery + FLASHLIGHT.trickleRegenPerSecond * dt);
      }
    }
  }

  /* ----------------------------------------------------------- bot brain */

  private stepBots(dt: number): void {
    for (const bot of this.bots) {
      bot.attackCooldown = Math.max(0, bot.attackCooldown - dt);
      bot.thinkTimer -= dt;
      bot.burstCooldown = Math.max(0, bot.burstCooldown - dt);

      if (bot.thinkTimer <= 0) {
        bot.thinkTimer = 0.55 + this.random() * 0.5;
        this.retarget(bot);
      }

      const target = bot.target ? this.players.get(bot.target) : null;
      if (target && target.status === 'alive') {
        const visible = hasLineOfSight(bot.x, bot.z, target.x, target.z);
        bot.lostTimer = visible ? 0 : bot.lostTimer + dt;
        if (bot.lostTimer > 4) {
          // Lost them: go and look where they were last seen.
          bot.investigate = { x: target.x, z: target.z };
          bot.target = null;
          bot.state = 'investigate';
          bot.path = [];
        } else {
          bot.state = 'chase';
          this.moveBotToward(bot, target.x, target.z, dt, visible);
          const dx = bot.x - target.x;
          const dz = bot.z - target.z;
          if (dx * dx + dz * dz < 1.5 * 1.5 && bot.attackCooldown <= 0) this.attack(bot, target);
          continue;
        }
      } else if (bot.target) {
        bot.target = null;
      }

      if (bot.state === 'investigate' && bot.investigate) {
        this.moveBotToward(bot, bot.investigate.x, bot.investigate.z, dt, false);
        const dx = bot.x - bot.investigate.x;
        const dz = bot.z - bot.investigate.z;
        if (dx * dx + dz * dz < 1.2 * 1.2) {
          bot.investigate = null;
          bot.state = 'patrol';
          bot.path = [];
        }
        continue;
      }

      bot.state = bot.attackCooldown > 4 ? 'cooldown' : 'patrol';
      this.patrol(bot, dt);
    }
  }

  /**
   * Target selection.
   *
   * Deliberately not "nearest player". Each character weighs the same signals
   * differently, which is what stops four animatronics from forming a queue
   * behind whoever is closest to the middle of the map.
   */
  private retarget(bot: Bot): void {
    let best: { id: string; score: number } | null = null;

    for (const [, player] of this.players) {
      if (player.status !== 'alive') continue;
      const dx = player.x - bot.x;
      const dz = player.z - bot.z;
      const dist = Math.hypot(dx, dz);
      const visible = hasLineOfSight(bot.x, bot.z, player.x, player.z);

      let score = 0;
      // Proximity, but flattened so the nearest player is not automatic.
      score += 6 / (1 + dist * 0.35);
      // Noise carries through walls; that is the point of it.
      score += player.noise * 7 * (1 - Math.min(1, dist / 26));
      if (visible) score += 5 * (1 - Math.min(1, dist / 20));
      if (player.flashlight) score += visible ? 4 : 1.2;
      if (bot.target === player.id) score += 2.5; // stickiness

      switch (bot.id) {
        case 'bear': {
          // Hunts whoever has strayed furthest from the rest of the crew.
          let nearestMate = 40;
          for (const [, other] of this.players) {
            if (other.id === player.id || other.status !== 'alive') continue;
            nearestMate = Math.min(nearestMate, Math.hypot(other.x - player.x, other.z - player.z));
          }
          score += Math.min(6, nearestMate * 0.4);
          break;
        }
        case 'rabbit':
          score += player.noise * 5;            // follows sound above all
          break;
        case 'hen':
          // Camps the objective: prefers whoever is near the live task.
          if (this.blackout && player.x < -14) score += 5;
          if (player.carrying) score += 4;      // and whoever holds a fuse
          break;
        case 'fox':
          if (visible && dist > 6) score += 5;  // wants a long clear run
          break;
      }

      if (this.blackout) score += 2;
      score *= this.aggression * this.escalation();
      if (!best || score > best.score) best = { id: player.id, score };
    }

    const threshold = this.blackout ? 3.2 : 4.4;
    if (best && best.score >= threshold) {
      if (bot.target !== best.id) bot.path = [];
      bot.target = best.id;
      return;
    }
    bot.target = null;

    // Nothing worth chasing: react to the loudest thing you can hear.
    let loudest: { x: number; z: number; noise: number } | null = null;
    for (const [, player] of this.players) {
      if (player.status !== 'alive' || player.noise < 0.4) continue;
      const dist = Math.hypot(player.x - bot.x, player.z - bot.z);
      const heard = player.noise * (1 - Math.min(1, dist / 30));
      if (heard > 0.18 && (!loudest || heard > loudest.noise)) {
        loudest = { x: player.x, z: player.z, noise: heard };
      }
    }
    if (loudest) {
      bot.investigate = { x: loudest.x, z: loudest.z };
      bot.state = 'investigate';
      bot.path = [];
    }
  }

  private attack(bot: Bot, player: MatchPlayer): void {
    bot.state = 'attack';
    bot.attackCooldown = 9;
    bot.target = null;
    bot.path = [];
    player.status = 'downed';
    player.bleedOut = this.tuning.bleedOutSeconds;
    player.revivedProgress = 0;
    player.flashlight = false;
    player.holding = null;
    player.reviving = null;
    if (player.carrying) {
      this.objective.fusesAvailable.add(player.carrying);
      player.carrying = null;
    }
    this.events.push({ e: 'attack', bot: bot.id, player: player.id });
    this.events.push({ e: 'down', player: player.id, by: bot.id });
  }

  private patrol(bot: Bot, dt: number): void {
    if (!bot.path.length || bot.pathIndex >= bot.path.length) {
      const from = nearestNode(bot.x, bot.z).id;
      const to = PATROL_NODES[Math.floor(this.random() * PATROL_NODES.length)];
      bot.path = findPath(from, to);
      bot.pathIndex = 1;
    }
    this.followPath(bot, dt, bot.speedWalk);
  }

  private moveBotToward(bot: Bot, x: number, z: number, dt: number, direct: boolean): void {
    const chasing = bot.state === 'chase';
    let speed = chasing ? bot.speedChase : bot.speedWalk * 1.15;

    // The fox commits to short, terrifying charges rather than a constant run.
    if (bot.id === 'fox' && chasing) {
      if (bot.burst > 0) {
        bot.burst -= dt;
        speed = bot.speedChase * 1.25;
      } else if (bot.burstCooldown <= 0) {
        bot.burst = 2.2;
        bot.burstCooldown = 9;
      } else {
        speed = bot.speedChase * 0.72;
      }
    }

    if (direct && hasLineOfSight(bot.x, bot.z, x, z)) {
      this.stepBotTo(bot, x, z, speed, dt);
      bot.path = [];
      return;
    }
    const goal = nearestNode(x, z).id;
    if (!bot.path.length || bot.path[bot.path.length - 1] !== goal) {
      bot.path = findPath(nearestNode(bot.x, bot.z).id, goal);
      bot.pathIndex = 1;
    }
    this.followPath(bot, dt, speed);
  }

  private followPath(bot: Bot, dt: number, speed: number): void {
    if (bot.pathIndex >= bot.path.length) {
      bot.path = [];
      return;
    }
    const node = NAV_BY_ID.get(bot.path[bot.pathIndex]);
    if (!node) {
      bot.path = [];
      return;
    }
    this.stepBotTo(bot, node.x, node.z, speed, dt);
    if (Math.hypot(bot.x - node.x, bot.z - node.z) < 0.7) bot.pathIndex++;
  }

  private stepBotTo(bot: Bot, x: number, z: number, speed: number, dt: number): void {
    const dx = x - bot.x;
    const dz = z - bot.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-4) return;
    const step = Math.min(dist, speed * dt);
    const next = resolveCollision(bot.x + (dx / dist) * step, bot.z + (dz / dist) * step, BOT_RADIUS);
    bot.x = next.x;
    bot.z = next.z;
    bot.yaw = Math.atan2(dx, dz);
  }

  /* ------------------------------------------------------------ snapshot */

  objectiveLabel(): string {
    const obj = this.objective;
    if (this.mode === 'free-roam' && obj.step === 'none') {
      return `EXPLORE THE DEPOT  ${this.explored.size}/${EXPLORABLE_ROOMS.length}`;
    }
    switch (obj.step) {
      case 'findElectrical': return 'GET TO THE ELECTRICAL ROOM';
      case 'generator': return 'START THE BACKUP GENERATOR';
      case 'fuses': return `FIT THE FUSES  ${obj.fusesFitted}/3`;
      case 'breakers': return `RESET THE BREAKERS  ${obj.breakers.size}/3`;
      case 'mainSwitch':
        return this.aliveCount > 1 ? 'HOLD BOTH MAIN SWITCHES TOGETHER' : 'HOLD THE MAIN SWITCH';
      case 'spinUp': return `SYSTEMS COMING BACK  ${Math.max(0, 10 - obj.spinUp).toFixed(0)}s`;
      default: return 'SURVIVE UNTIL 6 AM';
    }
  }

  private objectiveTargets(): string[] {
    const obj = this.objective;
    switch (obj.step) {
      case 'findElectrical':
      case 'generator': return ['gen'];
      case 'fuses': {
        const carried = [...this.players.values()].some((p) => p.carrying);
        return carried ? ['panel', ...obj.fusesAvailable] : [...obj.fusesAvailable];
      }
      case 'breakers': return ['brk1', 'brk2', 'brk3'].filter((id) => !obj.breakers.has(id));
      case 'mainSwitch': return this.aliveCount > 1 ? ['mainA', 'mainB'] : ['mainA'];
      default: return [];
    }
  }

  objectiveProgress(): number {
    const obj = this.objective;
    if (this.mode === 'free-roam' && obj.step === 'none') {
      return this.explored.size / EXPLORABLE_ROOMS.length;
    }
    switch (obj.step) {
      case 'findElectrical': return 0;
      case 'generator': return 0.1;
      case 'fuses': return 0.2 + (obj.fusesFitted / 3) * 0.3;
      case 'breakers': return 0.5 + (obj.breakers.size / 3) * 0.25;
      case 'mainSwitch': return 0.75;
      case 'spinUp': return 0.85 + Math.min(1, obj.spinUp / 10) * 0.15;
      default: return 0;
    }
  }

  snapshot(): MatchSnapshot {
    const players: PlayerSnap[] = [];
    for (const [, p] of this.players) {
      players.push({
        id: p.id,
        x: round2(p.x),
        z: round2(p.z),
        r: round2(p.yaw),
        s: STATUS_CODE[(p.status === 'lobby' ? 'alive' : p.status) as keyof typeof STATUS_CODE],
        f: p.flashlight,
        b: Math.round(p.battery),
        sp: p.sprinting,
        d: p.status === 'downed' ? round2(p.revivedProgress > 0 ? p.revivedProgress : -p.bleedOut) : 0,
        ...(p.carrying ? { it: p.carrying } : {}),
        ack: p.lastSeq,
      });
    }

    const bots: BotSnap[] = this.bots.map((b) => ({
      id: b.id,
      x: round2(b.x),
      z: round2(b.z),
      r: round2(b.yaw),
      s: BOT_STATE_CODE[b.state],
      ...(b.target ? { tg: b.target } : {}),
    }));

    const obj: ObjectiveSnap = {
      step: this.objective.step,
      label: this.objectiveLabel(),
      progress: round2(this.objectiveProgress()),
      detail: this.blackout
        ? `BLACKOUT ${this.objective.round}`
        : this.mode === 'free-roam'
          ? `FREE ROAM  x${this.escalation().toFixed(1)}`
          : '',
      targets: this.objectiveTargets(),
    };

    const ints: Record<string, number> = {};
    for (const item of INTERACTABLES) {
      if (item.kind === 'fuse') ints[item.id] = this.objective.fusesAvailable.has(item.id) ? 1 : 0;
      else if (item.kind === 'breaker') ints[item.id] = this.objective.breakers.has(item.id) ? 1 : 0;
      else if (item.kind === 'battery') ints[item.id] = (this.batteryCooldowns[item.id] ?? 0) > 0 ? 0 : 1;
      else if (item.kind === 'mainSwitch') ints[item.id] = (this.objective.mainHeld[item.id] ?? 0) > 0 ? 1 : 0;
      else if (item.kind === 'generator') ints[item.id] = this.objective.generator;
      else ints[item.id] = this.objective.fusesFitted;
    }

    return {
      t: 'snap',
      k: this.tick,
      ms: Math.round(this.elapsed * 1000),
      h: this.hour,
      power: round2(this.power),
      blackout: this.blackout,
      players,
      bots,
      obj,
      ints,
    };
  }

  drainEvents(): MatchEvent[] {
    if (!this.events.length) return [];
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Real seconds per in-game hour, so clients can render the clock. */
  get secondsPerHour(): number {
    return this.tuning.secondsPerHour;
  }

  /** Human-readable location, used by the HUD and by tests. */
  describe(id: string): string {
    const p = this.players.get(id);
    return p ? roomName(roomAt(p.x, p.z)) : 'unknown';
  }
}

/**
 * Shared movement integrator.
 *
 * The server runs this to decide where a player is; the client runs the exact
 * same function to predict its own movement between snapshots. Keeping it in
 * one place is what keeps prediction from fighting the server.
 */
export function stepMovement(
  state: { x: number; z: number; stamina: number },
  frame: InputFrame,
  dt: number,
  anchored: boolean,
): { x: number; z: number; stamina: number; sprinting: boolean } {
  let { x, z, stamina } = state;
  let mx = frame.mx;
  let mz = frame.mz;
  const magnitude = Math.hypot(mx, mz);
  if (magnitude > 1) {
    mx /= magnitude;
    mz /= magnitude;
  }

  const wantsSprint = frame.sprint && !frame.crouch && magnitude > 0.1 && stamina > 0;
  const sprinting = wantsSprint && !anchored;
  if (sprinting) stamina = Math.max(0, stamina - dt);
  else stamina = Math.min(MOVE.stamina, stamina + dt * MOVE.staminaRegenPerSecond);

  // Holding a breaker or reviving a teammate pins you in place.
  const speed = anchored ? 0 : frame.crouch ? MOVE.crouch : sprinting ? MOVE.sprint : MOVE.walk;
  const next = resolveCollision(x + mx * speed * dt, z + mz * speed * dt, PLAYER_RADIUS);
  x = next.x;
  z = next.z;
  return { x, z, stamina, sprinting };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
