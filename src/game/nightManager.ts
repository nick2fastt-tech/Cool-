import { AiDirector } from './aiDirector';
import { BLACKOUT, TIME, type CharacterId, type NightConfig } from './config';
import { DoorSystem, type Side } from './doorSystem';
import { EventBus } from '../core/events';
import { MonitorSystem } from './monitorSystem';
import { NightClock } from '../core/clock';
import { PowerSystem } from './powerSystem';
import { Rng } from '../core/rng';
import type { AudioCue } from './animatronic';
import type { Room } from './config';

export type NightPhase = 'playing' | 'blackout' | 'won' | 'lost';

export interface NightEvents {
  hour: { hour: number };
  blackout: { index: number };
  restored: { power: number };
  win: { night: number };
  lose: { id: CharacterId };
  cue: { cue: AudioCue; room: Room; id: CharacterId };
  impact: { side: Side };
  usage: { usage: number };
  husk: void;
}

export interface NightOptions {
  seed?: number;
  secondsPerHour?: number;
}

/**
 * One playable night, fully headless.
 *
 * This class is the single source of truth for a shift: it owns the clock,
 * power, doors, monitor and cast, wires them to each other, and exposes player
 * intents as plain methods. Rendering, audio and input all sit *above* it and
 * are free to be swapped - which is exactly what the multiplayer server will
 * do when it hosts the same simulation.
 */
export class NightSession {
  readonly events = new EventBus<NightEvents>();
  readonly clock: NightClock;
  readonly power = new PowerSystem();
  readonly doors = new DoorSystem();
  readonly monitor = new MonitorSystem();
  readonly director: AiDirector;
  readonly config: NightConfig;

  phase: NightPhase = 'playing';
  killer: CharacterId | null = null;
  /** Real seconds this session has been running - for the stats screen. */
  elapsed = 0;
  private crankHeld = false;
  private readonly rng: Rng;

  constructor(config: NightConfig, opts: NightOptions = {}) {
    this.config = config;
    this.rng = new Rng(opts.seed ?? (Date.now() >>> 0));
    this.clock = new NightClock(opts.secondsPerHour ?? TIME.secondsPerHour, TIME.hoursPerNight);
    this.director = new AiDirector(this.rng.fork(7));
    this.wire();
    this.reset();
  }

  private wire(): void {
    this.power.events.on('blackout', ({ index }) => {
      this.phase = 'blackout';
      this.doors.cutPower();
      this.monitor.cutPower();
      this.director.onBlackout();
      this.events.emit('blackout', { index });
    });

    this.power.events.on('restored', ({ power }) => {
      this.phase = 'playing';
      this.doors.restorePower();
      this.monitor.restorePower();
      this.director.onRestore();
      this.events.emit('restored', { power });
    });

    // The music box ran out: the bear was already in the doorway.
    this.power.events.on('lost', () => this.lose('bear'));
    this.power.events.on('usage', (p) => this.events.emit('usage', p));

    this.monitor.events.on('observed', ({ room }) => this.director.onObserved(room));

    this.director.events.on('attack', ({ id }) => this.lose(id));
    this.director.events.on('cue', (p) => this.events.emit('cue', p));
    this.director.events.on('huskAppeared', () => this.events.emit('husk', undefined));
    this.director.events.on('doorImpact', ({ side, drain }) => {
      this.power.spend(this.doors.registerImpact(side) + drain);
      this.events.emit('impact', { side });
    });
  }

  reset(): void {
    this.phase = 'playing';
    this.killer = null;
    this.elapsed = 0;
    this.crankHeld = false;
    this.clock.reset();
    this.power.reset(this.config.drainMultiplier);
    this.doors.reset();
    this.monitor.reset();
    this.director.reset(this.config);
  }

  /* ------------------------------------------------------- player intents */

  toggleDoor(side: Side): void {
    if (this.phase !== 'playing') return;
    this.power.spend(this.doors.toggleDoor(side));
  }

  setLight(side: Side, on: boolean): void {
    if (this.phase !== 'playing') return;
    this.doors.setLight(side, on);
  }

  toggleMonitor(): void {
    if (this.phase !== 'playing') return;
    this.monitor.toggle();
  }

  selectCamera(index: number): void {
    if (this.phase !== 'playing') return;
    this.monitor.select(index);
  }

  /** Hold the hand crank during a blackout. */
  setCrank(held: boolean): void {
    this.crankHeld = held && this.phase === 'blackout';
  }

  get isCranking(): boolean {
    return this.crankHeld && this.phase === 'blackout';
  }

  /* ---------------------------------------------------------------- loop */

  /** True once the night has resolved either way. */
  get isOver(): boolean {
    return this.phase === 'won' || this.phase === 'lost';
  }

  tick(dt: number): void {
    if (this.isOver) return;
    this.elapsed += dt;

    this.doors.tick(dt);
    this.monitor.tick(dt);

    this.power.tick(
      dt,
      {
        leftDoor: this.doors.isClosed('left'),
        rightDoor: this.doors.isClosed('right'),
        leftLight: this.doors.isLightOn('left'),
        rightLight: this.doors.isLightOn('right'),
        monitor: this.monitor.up,
      },
      this.crankHeld,
      this.rng,
    );
    if (this.isOver) return;

    this.director.tick(dt, {
      monitorUp: this.monitor.up,
      watchedRoom: this.monitor.watchedRoom,
      monitorUpTime: this.monitor.upTime,
      leftDoorClosed: this.doors.isClosed('left'),
      rightDoorClosed: this.doors.isClosed('right'),
      leftLightOn: this.doors.isLightOn('left'),
      rightLightOn: this.doors.isLightOn('right'),
      blackout: this.phase === 'blackout',
      hour: this.clock.hour,
      noiseBonus: this.power.cranking ? BLACKOUT.foxNoiseBonus : 0,
    });
    if (this.isOver) return;

    // The clock keeps running through a blackout - surviving it is the point.
    const newHour = this.clock.advance(dt);
    if (newHour !== null && newHour < this.clock.hours) {
      this.director.onHour(newHour);
      this.events.emit('hour', { hour: newHour });
    }
    if (this.clock.isComplete) this.win();
  }

  private win(): void {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.phase = 'won';
    this.events.emit('win', { night: this.config.night });
  }

  private lose(id: CharacterId): void {
    if (this.phase === 'lost' || this.phase === 'won') return;
    this.phase = 'lost';
    this.killer = id;
    this.events.emit('lose', { id });
  }

  /** Debug/QA helper: jump the clock. Never reachable from a shipped build. */
  debugSkipToHour(hour: number): void {
    this.clock.skipTo(hour);
    if (this.clock.isComplete) this.win();
  }
}
