import { Animatronic, type AiContext } from './animatronic';
import { Room } from './config';

/* ------------------------------------------------------------------ WEX */

/**
 * Wex the rabbit - the west-side pressure.
 *
 * Fast, restless, and completely indifferent to whether you are watching him.
 * He is the character that teaches the player to close a door. His quirk is
 * that a failed roll sometimes sends him *backwards*, so his approach is
 * jittery rather than a clean march, and flashing the hall light at him while
 * he waits outside only makes him linger longer.
 */
export class Rabbit extends Animatronic {
  /** How many more opportunities he will wait outside a closed door. */
  private patience = 3;

  protected opportunity(ctx: AiContext): void {
    if (this.atDoorway) {
      this.atDoor = true;
      if (this.doorClosed(ctx)) {
        if (this.rng.chance(0.35)) {
          this.hooks.cue('knock', this.room, this.id);
          this.hooks.doorImpact('left', 0.4);
        }
        if (--this.patience <= 0) {
          this.patience = 3;
          this.retreat();
        }
        return;
      }
      if (this.canAttack(ctx) && this.rng.rollAgainst(this.effectiveLevel(ctx))) {
        this.hooks.attack(this.id);
      }
      return;
    }

    if (this.rng.rollAgainst(this.effectiveLevel(ctx))) {
      this.advance(ctx);
      if (this.atDoorway) {
        this.atDoor = true;
        this.patience = 3;
        this.hooks.cue('breath', this.room, this.id);
      }
    } else if (this.pathIndex > 1 && this.rng.chance(0.2)) {
      this.retreat();
    }
  }

  protected override update(_dt: number, ctx: AiContext): void {
    // Staring back at him buys you nothing: the light resets his patience.
    if (this.atDoor && ctx.leftLightOn && this.patience < 5) this.patience = 4;
  }
}

/* ----------------------------------------------------------------- JUNE */

/**
 * June the hen - the east-side pressure, and the reason you cannot camp the
 * tablet. She moves *better* while the monitor is up, and she dwells in the
 * kitchen where the camera is dead, so the only warning you get is sound.
 */
export class Hen extends Animatronic {
  private kitchenDwell = 0;
  private patience = 4;

  protected override effectiveLevel(ctx: AiContext): number {
    if (this.level <= 0) return 0;
    const distracted = ctx.monitorUp ? 2 : 0;
    return Math.min(20, this.level + distracted + (ctx.blackout ? 4 : 0));
  }

  protected opportunity(ctx: AiContext): void {
    if (this.room === Room.Kitchen) {
      this.hooks.cue('kitchen', Room.Kitchen, this.id);
      if (this.rng.rollAgainst(this.effectiveLevel(ctx))) {
        if (++this.kitchenDwell >= 2) {
          this.kitchenDwell = 0;
          this.advance(ctx);
        }
      }
      return;
    }

    if (this.atDoorway) {
      this.atDoor = true;
      if (this.doorClosed(ctx)) {
        if (this.rng.chance(0.3)) {
          this.hooks.cue('knock', this.room, this.id);
          this.hooks.doorImpact('right', 0.5);
        }
        if (--this.patience <= 0) {
          this.patience = 4;
          this.retreat();
        }
        return;
      }
      if (this.canAttack(ctx) && this.rng.rollAgainst(this.effectiveLevel(ctx))) {
        this.hooks.attack(this.id);
      }
      return;
    }

    if (this.rng.rollAgainst(this.effectiveLevel(ctx))) {
      this.advance(ctx);
      if (this.atDoorway) {
        this.atDoor = true;
        this.patience = 4;
        this.hooks.cue('breath', this.room, this.id);
      }
    }
  }
}

/* -------------------------------------------------------------- BRAMBLE */

/**
 * Bramble the bear - the headliner, and the late-night problem.
 *
 * He will not move while you are looking at the room he is standing in, he
 * will not push past another animatronic, and he never retreats. Once he
 * reaches the east corner he simply waits for the right door to open - or for
 * you to hide behind the tablet too long, which he treats as an invitation.
 */
export class Bear extends Animatronic {
  protected override readonly ownsTheDark = true;
  /** Seconds spent waiting in the east corner. */
  private cornerTime = 0;
  /** Blocked opportunities before he gives up and backs off one room. */
  private blocked = 0;
  /** How long the player may camp the monitor while he is at the corner. */
  private static readonly STALL_LIMIT = 11;
  private static readonly BLOCKED_LIMIT = 7;

  /** Shoved back down the hall when the lights come back on. */
  pushBack(): void {
    this.blocked = 0;
    this.cornerTime = 0;
    this.retreat();
    this.retreat();
  }

  protected override update(dt: number, ctx: AiContext): void {
    if (this.atDoorway) {
      this.atDoor = true;
      this.cornerTime += dt;
      if (
        this.canAttack(ctx) &&
        !this.doorClosed(ctx) &&
        ctx.monitorUp &&
        ctx.watchedRoom !== this.room &&
        ctx.monitorUpTime > Bear.STALL_LIMIT &&
        this.cornerTime > 4
      ) {
        // Hiding behind the tablet, watching some other room, door open.
        // He walks straight in. Watching *him* is the only safe stall.
        this.hooks.attack(this.id);
      }
    } else {
      this.cornerTime = 0;
      this.blocked = 0;
    }
  }

  protected opportunity(ctx: AiContext): void {
    // Being looked at pins him in place. This is his defining rule.
    if (ctx.watchedRoom === this.room) return;

    if (this.atDoorway) {
      if (this.doorClosed(ctx) || !this.canAttack(ctx)) {
        if (this.rng.chance(0.15)) this.hooks.cue('laugh', this.room, this.id);
        // He is patient, not infinite. Hold him off long enough and he drifts
        // back down the hall - which is the only reason holding a door is a
        // strategy rather than a slow death.
        if (++this.blocked >= Bear.BLOCKED_LIMIT) {
          this.blocked = 0;
          this.retreat();
        }
        return;
      }
      if (this.canAttack(ctx) && this.rng.rollAgainst(this.effectiveLevel(ctx))) {
        this.hooks.attack(this.id);
      }
      return;
    }

    if (this.rng.rollAgainst(this.effectiveLevel(ctx))) {
      const moved = this.advance(ctx);
      if (moved && this.rng.chance(0.25)) this.hooks.cue('laugh', this.room, this.id);
    }
  }
}

/* ------------------------------------------------------------- SPROCKET */

export type FoxState = 'lurking' | 'sprinting' | 'cooldown';

/**
 * Captain Sprocket - the fox. Not a walker: a timer with teeth.
 *
 * He advances through four curtain stages inside the Crow's Nest, and only
 * while nobody is watching that feed. Ignore the feed and he speeds up; check
 * it obsessively and you have no power left for doors. When he reaches stage
 * four he sprints the west hall - about two seconds of warning - and the only
 * answer is a shut left door, which costs you a chunk of power per slam.
 */
export class Fox extends Animatronic {
  state: FoxState = 'lurking';
  /** 0-3 curtain stages; 4 launches the sprint. */
  stage = 0;
  private sprintTimer = 0;
  private cooldownTimer = 0;
  private bangs = 0;

  private static readonly SPRINT_SECONDS = 2.4;
  private static readonly COOLDOWN_SECONDS = 7;

  override reset(level: number): void {
    super.reset(level);
    this.state = 'lurking';
    this.stage = 0;
    this.sprintTimer = 0;
    this.cooldownTimer = 0;
    this.bangs = 0;
    this.room = Room.Cove;
  }

  protected override effectiveLevel(ctx: AiContext): number {
    if (this.level <= 0) return 0;
    // Neglect bonus: every 10s past 20s without a Crow's Nest check adds a step.
    const neglect = Math.min(5, Math.max(0, Math.floor((ctx.sinceCoveChecked - 20) / 10)));
    return Math.min(20, this.level + neglect + ctx.noiseBonus + (ctx.blackout ? 4 : 0));
  }

  protected override update(dt: number, ctx: AiContext): void {
    if (this.state === 'sprinting') {
      this.sprintTimer -= dt;
      if (this.sprintTimer <= 0) this.arrive(ctx);
      return;
    }
    if (this.state === 'cooldown') {
      this.cooldownTimer -= dt;
      if (this.cooldownTimer <= 0) {
        this.state = 'lurking';
        this.room = Room.Cove;
      }
    }
  }

  protected opportunity(ctx: AiContext): void {
    if (this.state !== 'lurking') return;
    // He will not move a muscle while the Crow's Nest feed is on screen.
    if (ctx.watchedRoom === Room.Cove) return;
    if (!this.rng.rollAgainst(this.effectiveLevel(ctx))) return;

    this.stage++;
    this.hooks.cue('curtain', Room.Cove, this.id);
    if (this.stage >= 4) this.launch();
  }

  private launch(): void {
    this.state = 'sprinting';
    this.room = Room.WestHall;
    this.sprintTimer = Fox.SPRINT_SECONDS;
    this.hooks.cue('run', Room.WestHall, this.id);
  }

  private arrive(ctx: AiContext): void {
    if (!this.canAttack(ctx)) {
      // The grid is down and the doorway is the bear's. He skids to a halt.
      this.state = 'cooldown';
      this.cooldownTimer = Fox.COOLDOWN_SECONDS;
      this.stage = 2;
      this.room = Room.Cove;
      return;
    }
    if (ctx.leftDoorClosed) {
      // Blocked - but he takes a bite out of the grid on his way back.
      this.bangs++;
      const drain = Math.min(9, 2 + 3 * this.bangs);
      this.hooks.cue('doorImpact', Room.WestHall, this.id);
      this.hooks.doorImpact('left', drain);
      this.state = 'cooldown';
      this.cooldownTimer = Fox.COOLDOWN_SECONDS;
      this.stage = ctx.hour >= 4 ? 1 : 0;
      this.room = Room.Cove;
      return;
    }
    this.hooks.attack(this.id);
  }

  /** Exposed for the renderer: how far open the curtain is drawn. */
  get curtainOpen(): number {
    return this.state === 'lurking' ? this.stage / 4 : 1;
  }
}

/* ------------------------------------------------------------------ HUSK */

export type HuskState = 'absent' | 'scheduled' | 'present';

/**
 * HUSK - the rare one.
 *
 * Not a pathing character. It is scheduled by the director, materialises in
 * the office only while the monitor is DOWN, and gives the player a few
 * seconds to do the one thing that dispels it: raise the tablet. Doing nothing
 * ends the night. It cannot be blocked by doors and it never appears twice in
 * the same hour.
 */
export class Husk extends Animatronic {
  state: HuskState = 'absent';
  private delay = 0;
  private timeout = 0;

  private static readonly VISIBLE_SECONDS = 4.2;

  override reset(level: number): void {
    super.reset(level);
    this.state = 'absent';
    this.delay = 0;
    this.timeout = 0;
    this.room = Room.Office;
  }

  /** Director call: queue an apparition somewhere in the next few seconds. */
  schedule(): void {
    if (this.state !== 'absent') return;
    this.state = 'scheduled';
    this.delay = this.rng.range(2, 14);
  }

  dismiss(): void {
    this.state = 'absent';
    this.timeout = 0;
  }

  protected override update(dt: number, ctx: AiContext): void {
    switch (this.state) {
      case 'scheduled':
        this.delay -= dt;
        // It only ever steps in while you are not hiding behind the tablet.
        if (this.delay <= 0 && !ctx.monitorUp && !ctx.blackout) {
          this.state = 'present';
          this.timeout = Husk.VISIBLE_SECONDS;
          this.hooks.cue('breath', Room.Office, this.id);
        }
        break;
      case 'present':
        if (ctx.monitorUp) {
          // Tablet up - it is gone when you lower it again.
          this.dismiss();
          return;
        }
        this.timeout -= dt;
        if (this.timeout <= 0) this.hooks.attack(this.id);
        break;
      default:
        break;
    }
  }

  protected opportunity(): void {
    /* HUSK does not use movement opportunities. */
  }
}
