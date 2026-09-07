import { BLACKOUT, POWER } from './config';
import { EventBus } from '../core/events';
import type { Rng } from '../core/rng';

export type PowerPhase = 'online' | 'blackout' | 'lost';

/** Charge required to trip the breaker on the n-th blackout of a night. */
export function crankTargetFor(blackoutIndex: number): number {
  return Math.round(BLACKOUT.crankTargetBase * BLACKOUT.crankTargetGrowth ** blackoutIndex);
}

/** Which power-drawing systems are active this tick. */
export interface PowerDraw {
  leftDoor: boolean;
  rightDoor: boolean;
  leftLight: boolean;
  rightLight: boolean;
  monitor: boolean;
}

export interface PowerEvents {
  blackout: { index: number };
  restored: { power: number; index: number };
  lost: void;
  usage: { usage: number };
  crankTick: { charge: number; target: number };
}

/**
 * Power economy, blackout, and the hand-crank recovery mechanic.
 * See the BLACKOUT block in config.ts for the design rationale.
 */
export class PowerSystem {
  readonly events = new EventBus<PowerEvents>();

  power: number = POWER.start;
  phase: PowerPhase = 'online';
  usage = 1;

  /** How many blackouts have happened this night. Drives escalating cost. */
  blackoutIndex = 0;
  /** Seconds left on the music box before the night ends. */
  tuneRemaining = 0;
  crankCharge = 0;
  crankTarget = 0;
  cranking = false;
  /** Total seconds spent cranking this blackout - the noise the fox hears. */
  crankNoise = 0;

  private drainMultiplier = 1;

  reset(drainMultiplier: number): void {
    this.power = POWER.start;
    this.phase = 'online';
    this.usage = 1;
    this.blackoutIndex = 0;
    this.tuneRemaining = 0;
    this.crankCharge = 0;
    this.crankTarget = 0;
    this.cranking = false;
    this.crankNoise = 0;
    this.drainMultiplier = drainMultiplier;
  }

  get percent(): number {
    return Math.max(0, this.power);
  }

  get isOnline(): boolean {
    return this.phase === 'online';
  }

  /** 0..1 progress on the crank bar during a blackout. */
  get crankProgress(): number {
    return this.crankTarget > 0 ? Math.min(1, this.crankCharge / this.crankTarget) : 0;
  }

  /** One-off cost, e.g. slamming a door. Ignored while the grid is down. */
  spend(amount: number): void {
    if (this.phase !== 'online') return;
    this.power = Math.max(0, this.power - amount);
    if (this.power <= 0) this.triggerBlackout();
  }

  tick(dt: number, draw: PowerDraw, crankHeld: boolean, rng: Rng): void {
    if (this.phase === 'lost') return;

    if (this.phase === 'online') {
      const active =
        (draw.leftDoor ? 1 : 0) +
        (draw.rightDoor ? 1 : 0) +
        (draw.leftLight ? 1 : 0) +
        (draw.rightLight ? 1 : 0) +
        (draw.monitor ? 1 : 0);
      const usage = Math.min(POWER.maxUsage, 1 + active);
      if (usage !== this.usage) {
        this.usage = usage;
        this.events.emit('usage', { usage });
      }
      this.power -= POWER.drainPerUsagePerSecond * usage * this.drainMultiplier * dt;
      if (this.power <= 0) {
        this.power = 0;
        this.triggerBlackout(rng);
      }
      return;
    }

    // --- blackout: music box running, crank available -------------------
    this.cranking = crankHeld;
    if (crankHeld) {
      this.crankCharge += BLACKOUT.crankRatePerSecond * dt;
      this.crankNoise += dt;
      // Cranking is loud. It literally shortens your remaining time.
      this.tuneRemaining -= BLACKOUT.tunePenaltyPerCrankSecond * dt;
    } else {
      this.crankCharge = Math.max(0, this.crankCharge - BLACKOUT.crankDecayPerSecond * dt);
    }
    this.events.emit('crankTick', { charge: this.crankCharge, target: this.crankTarget });

    if (this.crankCharge >= this.crankTarget) {
      this.restore();
      return;
    }

    this.tuneRemaining -= dt;
    if (this.tuneRemaining <= 0) {
      this.tuneRemaining = 0;
      this.phase = 'lost';
      this.events.emit('lost', undefined);
    }
  }

  private triggerBlackout(rng?: Rng): void {
    if (this.phase !== 'online') return;
    this.phase = 'blackout';
    this.power = 0;
    this.usage = 0;
    this.crankCharge = 0;
    this.crankNoise = 0;
    this.crankTarget = crankTargetFor(this.blackoutIndex);
    this.tuneRemaining = rng
      ? rng.range(BLACKOUT.tuneSeconds.min, BLACKOUT.tuneSeconds.max)
      : BLACKOUT.tuneSeconds.min;
    this.events.emit('blackout', { index: this.blackoutIndex });
  }

  private restore(): void {
    const i = Math.min(this.blackoutIndex, BLACKOUT.restorePower.length - 1);
    const given = BLACKOUT.restorePower[i];
    this.blackoutIndex++;
    this.phase = 'online';
    this.power = given;
    this.usage = 1;
    this.crankCharge = 0;
    this.crankTarget = 0;
    this.cranking = false;
    this.tuneRemaining = 0;
    this.events.emit('restored', { power: given, index: this.blackoutIndex });
  }

  /** Test/debug hook. */
  forceBlackout(rng?: Rng): void {
    this.power = 0;
    this.triggerBlackout(rng);
  }
}
