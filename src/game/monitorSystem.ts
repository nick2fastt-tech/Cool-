import { CAMERAS, Room, type CameraDef } from './config';
import { EventBus } from '../core/events';

export interface MonitorEvents {
  opened: { camera: CameraDef };
  closed: void;
  switched: { camera: CameraDef; from: CameraDef };
  /** Fires when the player looks at a feed - the AI listens for this. */
  observed: { room: Room };
}

/** Seconds the feed is unusable after raising or switching. */
const RAISE_STATIC = 0.55;
const SWITCH_STATIC = 0.3;
/** Raising and lowering the tablet is a deliberate, animated commitment. */
const FLIP_SECONDS = 0.35;

/**
 * The camera monitor.
 *
 * Raising it is the single most important decision in the game: it is the only
 * way to see the building, it costs power, it blinds you to the office, and it
 * is what the hen waits for. All of that is expressed here as plain state the
 * renderer and AI can both read.
 */
export class MonitorSystem {
  readonly events = new EventBus<MonitorEvents>();

  up = false;
  /** 0 = tablet down, 1 = tablet fully raised. */
  flip = 0;
  index = 1; // Dining Hall - a sane default first look
  staticTimer = 0;
  /** Seconds the monitor has been continuously up. Used for stall pressure. */
  upTime = 0;
  powered = true;

  get camera(): CameraDef {
    return CAMERAS[this.index];
  }

  /** The room the player can actually see right now (null while blind). */
  get watchedRoom(): Room | null {
    if (!this.up || !this.powered || this.flip < 0.98) return null;
    if (this.staticTimer > 0) return null;
    if (this.camera.audioOnly) return null;
    return this.camera.room;
  }

  reset(): void {
    this.up = false;
    this.flip = 0;
    this.index = 1;
    this.staticTimer = 0;
    this.upTime = 0;
    this.powered = true;
  }

  open(): void {
    if (this.up || !this.powered) return;
    this.up = true;
    this.staticTimer = RAISE_STATIC;
    this.upTime = 0;
    this.events.emit('opened', { camera: this.camera });
  }

  close(): void {
    if (!this.up) return;
    this.up = false;
    this.upTime = 0;
    this.events.emit('closed', undefined);
  }

  toggle(): void {
    if (this.up) this.close();
    else this.open();
  }

  select(index: number): void {
    if (!this.up || !this.powered) return;
    if (index < 0 || index >= CAMERAS.length || index === this.index) return;
    const from = this.camera;
    this.index = index;
    this.staticTimer = SWITCH_STATIC;
    this.events.emit('switched', { camera: this.camera, from });
  }

  selectById(id: string): void {
    const i = CAMERAS.findIndex((c) => c.id === id);
    if (i >= 0) this.select(i);
  }

  cutPower(): void {
    this.powered = false;
    this.up = false;
    this.upTime = 0;
  }

  restorePower(): void {
    this.powered = true;
  }

  tick(dt: number): void {
    const goal = this.up ? 1 : 0;
    const step = dt / FLIP_SECONDS;
    if (this.flip < goal) this.flip = Math.min(goal, this.flip + step);
    else if (this.flip > goal) this.flip = Math.max(goal, this.flip - step);

    if (this.staticTimer > 0) this.staticTimer = Math.max(0, this.staticTimer - dt);
    if (this.up) this.upTime += dt;

    const room = this.watchedRoom;
    if (room) this.events.emit('observed', { room });
  }
}
