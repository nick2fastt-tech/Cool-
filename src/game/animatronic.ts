import { Room, type CharacterDef, type CharacterId } from './config';
import type { Rng } from '../core/rng';
import type { Side } from './doorSystem';

/** Everything an animatronic is allowed to know about the world this tick. */
export interface AiContext {
  monitorUp: boolean;
  /** Room the player can actually see right now (null while blind). */
  watchedRoom: Room | null;
  /** Seconds the monitor has been continuously raised. */
  monitorUpTime: number;
  leftDoorClosed: boolean;
  rightDoorClosed: boolean;
  leftLightOn: boolean;
  rightLightOn: boolean;
  /** True while the grid is down - doors are useless and everyone knows it. */
  blackout: boolean;
  hour: number;
  /** Seconds since the player last looked at the Crow's Nest feed. */
  sinceCoveChecked: number;
  /** Extra aggression from noise the player is making (hand crank). */
  noiseBonus: number;
  isRoomOccupied(room: Room, exclude: CharacterId): boolean;
}

export type AudioCue =
  | 'step'
  | 'knock'
  | 'kitchen'
  | 'curtain'
  | 'run'
  | 'breath'
  | 'laugh'
  | 'doorImpact';

export interface AiHooks {
  /** A character reached the player. The night is over. */
  attack(id: CharacterId): void;
  /** A character hit a closed shutter; returns nothing, billing is the caller's. */
  doorImpact(side: Side, drain: number): void;
  cue(cue: AudioCue, room: Room, id: CharacterId): void;
}

/**
 * Base movement model shared by every character.
 *
 * Each character gets a "movement opportunity" on its own interval. On an
 * opportunity it rolls a d20 against its aggression level; success means it
 * acts. Everything that makes a character *feel* different - what a success
 * means, what blocks it, what the player can do about it - lives in the
 * subclass, never here.
 */
export abstract class Animatronic {
  room: Room;
  pathIndex = 0;
  /** Current aggression, 0-20. */
  level = 0;
  protected baseLevel = 0;
  protected timer = 0;
  /** Set while the character is standing in a doorway staring in. */
  atDoor = false;

  constructor(
    readonly def: CharacterDef,
    protected readonly rng: Rng,
    protected readonly hooks: AiHooks,
  ) {
    this.room = def.path[0];
  }

  get id(): CharacterId {
    return this.def.id;
  }

  reset(level: number): void {
    this.baseLevel = level;
    this.level = level;
    this.pathIndex = 0;
    this.room = this.def.path[0];
    this.timer = this.rng.range(0, this.def.moveInterval);
    this.atDoor = false;
  }

  /** Escalation at the top of an hour, plus any one-off bumps. */
  bumpLevel(amount = 1): void {
    this.level = Math.min(20, this.level + amount);
  }

  tick(dt: number, ctx: AiContext): void {
    this.update(dt, ctx);
    this.timer += dt;
    while (this.timer >= this.def.moveInterval) {
      this.timer -= this.def.moveInterval;
      this.opportunity(ctx);
    }
  }

  /** Per-frame behaviour that is not tied to a movement opportunity. */
  protected update(_dt: number, _ctx: AiContext): void {}

  /** One movement opportunity. Subclasses decide what a success means. */
  protected abstract opportunity(ctx: AiContext): void;

  /**
   * Aggression actually used for this roll.
   *
   * Level 0 means "switched off for this night" and no situational bonus may
   * ever wake a character up - that guarantee is what keeps Night 1 gentle.
   */
  protected effectiveLevel(ctx: AiContext): number {
    if (this.level <= 0) return 0;
    return Math.min(20, this.level + (ctx.blackout && this.ownsTheDark ? 4 : 0));
  }

  /**
   * A blackout belongs to one character: the bear in the doorway with the
   * music box. He gets the aggression bump, and when the tune ends the night
   * is scored as his kill.
   */
  protected readonly ownsTheDark: boolean = false;

  /**
   * Nobody lands a normal attack while the grid is down.
   *
   * The blackout is a single, readable duel - crank versus music box - and it
   * stays that way. Without this, a blackout at 4 AM is an unavoidable instant
   * loss: every doorway is open and half the cast is already standing in one.
   * They keep closing in, so the moment the breaker trips back you are in
   * serious trouble; they just do not get a free kill in the dark.
   */
  protected canAttack(ctx: AiContext): boolean {
    return !ctx.blackout;
  }

  /** Step one room forward along the path. Returns false if blocked. */
  protected advance(ctx: AiContext): boolean {
    const next = this.def.path[this.pathIndex + 1];
    if (next === undefined) return false;
    if (next !== Room.Office && ctx.isRoomOccupied(next, this.id)) return false;
    this.pathIndex++;
    this.room = next;
    this.hooks.cue('step', this.room, this.id);
    return true;
  }

  protected retreat(minIndex = 1): void {
    if (this.pathIndex <= minIndex) return;
    this.pathIndex--;
    this.room = this.def.path[this.pathIndex];
    this.atDoor = false;
    this.hooks.cue('step', this.room, this.id);
  }

  /** True when the character is in the last room before the office. */
  protected get atDoorway(): boolean {
    return this.pathIndex === this.def.path.length - 2;
  }

  protected doorClosed(ctx: AiContext): boolean {
    if (ctx.blackout) return false; // shutters are dead weight with no power
    return this.def.side === 'left' ? ctx.leftDoorClosed : ctx.rightDoorClosed;
  }
}
