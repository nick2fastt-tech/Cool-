import { POWER } from './config';
import { EventBus } from '../core/events';

export type Side = 'left' | 'right';

export interface DoorEvents {
  doorToggled: { side: Side; closed: boolean };
  doorBlocked: { side: Side };
  lightToggled: { side: Side; on: boolean };
  impact: { side: Side };
}

interface DoorState {
  closed: boolean;
  /** 0 = fully open, 1 = fully shut. Drives the mesh and the slam sound. */
  travel: number;
  lightOn: boolean;
}

/** Seconds for a shutter to travel its full height. */
const TRAVEL_SECONDS = 0.42;

/**
 * Doors and hall lights.
 *
 * Both are pure state here - the office renderer reads `travel` to place the
 * shutter mesh, and the power system reads `closed`/`lightOn` for usage bars.
 * Lights are momentary (hold) so a player cannot leave one on by accident;
 * doors are toggles because you need both thumbs elsewhere.
 */
export class DoorSystem {
  readonly events = new EventBus<DoorEvents>();

  private doors: Record<Side, DoorState> = {
    left: { closed: false, travel: 0, lightOn: false },
    right: { closed: false, travel: 0, lightOn: false },
  };

  /** Set false during a blackout: controls are dead and shutters spring open. */
  powered = true;

  reset(): void {
    this.doors.left = { closed: false, travel: 0, lightOn: false };
    this.doors.right = { closed: false, travel: 0, lightOn: false };
    this.powered = true;
  }

  isClosed(side: Side): boolean {
    return this.doors[side].closed;
  }

  travel(side: Side): number {
    return this.doors[side].travel;
  }

  isLightOn(side: Side): boolean {
    return this.powered && this.doors[side].lightOn;
  }

  /** Returns the power cost incurred, so the caller can bill it. */
  toggleDoor(side: Side): number {
    if (!this.powered) {
      this.events.emit('doorBlocked', { side });
      return 0;
    }
    const d = this.doors[side];
    d.closed = !d.closed;
    this.events.emit('doorToggled', { side, closed: d.closed });
    return POWER.doorToggleCost;
  }

  setLight(side: Side, on: boolean): void {
    if (!this.powered && on) {
      this.events.emit('doorBlocked', { side });
      return;
    }
    const d = this.doors[side];
    if (d.lightOn === on) return;
    d.lightOn = on;
    this.events.emit('lightToggled', { side, on });
  }

  /** An animatronic hit a closed shutter: rattle it and bill the player. */
  registerImpact(side: Side): number {
    this.events.emit('impact', { side });
    return POWER.doorImpactCost;
  }

  /** Called when the grid dies: shutters spring open, switches go dead. */
  cutPower(): void {
    this.powered = false;
    this.doors.left.closed = false;
    this.doors.right.closed = false;
    this.doors.left.lightOn = false;
    this.doors.right.lightOn = false;
  }

  restorePower(): void {
    this.powered = true;
  }

  tick(dt: number): void {
    for (const side of ['left', 'right'] as const) {
      const d = this.doors[side];
      const goal = d.closed ? 1 : 0;
      const step = dt / TRAVEL_SECONDS;
      if (d.travel < goal) d.travel = Math.min(goal, d.travel + step);
      else if (d.travel > goal) d.travel = Math.max(goal, d.travel - step);
    }
  }
}
