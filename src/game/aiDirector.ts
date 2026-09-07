import { Animatronic, type AiContext, type AiHooks, type AudioCue } from './animatronic';
import { Bear, Fox, Hen, Husk, Rabbit } from './characters';
import { CHARACTERS, Room, type CharacterId, type NightConfig } from './config';
import { EventBus } from '../core/events';
import type { Rng } from '../core/rng';
import type { Side } from './doorSystem';

export interface DirectorEvents {
  attack: { id: CharacterId };
  doorImpact: { side: Side; drain: number };
  cue: { cue: AudioCue; room: Room; id: CharacterId };
  huskAppeared: void;
}

/** Live world inputs the director needs to build each character's context. */
export interface DirectorInput {
  monitorUp: boolean;
  watchedRoom: Room | null;
  monitorUpTime: number;
  leftDoorClosed: boolean;
  rightDoorClosed: boolean;
  leftLightOn: boolean;
  rightLightOn: boolean;
  blackout: boolean;
  hour: number;
  noiseBonus: number;
}

/**
 * Owns the cast, feeds each member a context, and routes what they do back out
 * as events. Nothing here knows about rendering or audio - it emits cues and
 * lets the presentation layer decide what a cue looks or sounds like.
 */
export class AiDirector {
  readonly events = new EventBus<DirectorEvents>();

  readonly rabbit: Rabbit;
  readonly hen: Hen;
  readonly bear: Bear;
  readonly fox: Fox;
  readonly husk: Husk;
  readonly roster: readonly Animatronic[];

  /** Seconds since the player last looked at the Crow's Nest. Drives the fox. */
  sinceCoveChecked = 0;
  private attacked = false;
  private huskHours = new Set<number>();
  private night: NightConfig | null = null;
  /** Easter egg counter: staring at the backstage poster tempts HUSK out. */
  private backstageViews = 0;

  constructor(private readonly rng: Rng) {
    const hooks: AiHooks = {
      attack: (id) => {
        if (this.attacked) return;
        this.attacked = true;
        this.events.emit('attack', { id });
      },
      doorImpact: (side, drain) => this.events.emit('doorImpact', { side, drain }),
      cue: (cue, room, id) => this.events.emit('cue', { cue, room, id }),
    };
    this.rabbit = new Rabbit(CHARACTERS.rabbit, rng.fork(11), hooks);
    this.hen = new Hen(CHARACTERS.hen, rng.fork(22), hooks);
    this.bear = new Bear(CHARACTERS.bear, rng.fork(33), hooks);
    this.fox = new Fox(CHARACTERS.fox, rng.fork(44), hooks);
    this.husk = new Husk(CHARACTERS.husk, rng.fork(55), hooks);
    this.roster = [this.rabbit, this.hen, this.bear, this.fox, this.husk];
  }

  reset(night: NightConfig): void {
    this.night = night;
    this.attacked = false;
    this.sinceCoveChecked = 0;
    this.backstageViews = 0;
    this.huskHours.clear();
    this.rabbit.reset(night.ai.rabbit);
    this.hen.reset(night.ai.hen);
    this.bear.reset(night.ai.bear);
    this.fox.reset(night.ai.fox);
    this.husk.reset(0);
  }

  /** Called at the top of each in-game hour. */
  onHour(hour: number): void {
    const night = this.night;
    if (!night) return;
    for (const [id, hours] of Object.entries(night.escalation)) {
      if (!hours?.includes(hour)) continue;
      switch (id as keyof typeof night.ai) {
        case 'rabbit': this.rabbit.bumpLevel(); break;
        case 'hen': this.hen.bumpLevel(); break;
        case 'bear': this.bear.bumpLevel(); break;
        case 'fox': this.fox.bumpLevel(); break;
      }
    }
    if (night.huskChancePerHour > 0 && !this.huskHours.has(hour) && this.rng.chance(night.huskChancePerHour)) {
      this.huskHours.add(hour);
      this.husk.schedule();
      this.events.emit('huskAppeared', undefined);
    }
  }

  /** The lights went out: everyone gets braver, and the bear gets promoted. */
  onBlackout(): void {
    this.bear.bumpLevel(2);
    this.fox.bumpLevel(1);
  }

  /**
   * The breaker tripped back in. The lights coming on push the bear out of the
   * doorway - winning the crank duel has to buy real breathing room, or a
   * restore just hands you back a tablet that is still booting while he is
   * already standing there.
   */
  onRestore(): void {
    this.bear.pushBack();
    if (this.fox.stage > 1) this.fox.stage -= 1;
  }

  /** The player looked at a feed. */
  onObserved(room: Room): void {
    if (room === Room.Cove) this.sinceCoveChecked = 0;
    if (room === Room.Backstage) {
      this.backstageViews++;
      // Rare: keep staring at that poster and something notices.
      if (this.backstageViews === 8 && this.rng.chance(0.35)) {
        this.husk.schedule();
        this.events.emit('huskAppeared', undefined);
      }
    }
  }

  tick(dt: number, input: DirectorInput): void {
    if (this.attacked) return;
    this.sinceCoveChecked += dt;

    const ctx: AiContext = {
      ...input,
      sinceCoveChecked: this.sinceCoveChecked,
      isRoomOccupied: (room, exclude) => this.isRoomOccupied(room, exclude),
    };

    for (const a of this.roster) a.tick(dt, ctx);
  }

  isRoomOccupied(room: Room, exclude: CharacterId): boolean {
    for (const a of this.roster) {
      if (a.id === exclude || a.id === 'husk') continue;
      if (a.room === room) return true;
    }
    return false;
  }

  /** Who is standing in a given room right now - used by the renderer. */
  occupantsOf(room: Room): CharacterId[] {
    const out: CharacterId[] = [];
    for (const a of this.roster) {
      if (a.id === 'husk') continue;
      if (a.room === room) out.push(a.id);
    }
    return out;
  }

  /** Snapshot for the mini-map and for save/telemetry. */
  snapshot(): Record<CharacterId, { room: Room; level: number; atDoor: boolean }> {
    const out = {} as Record<CharacterId, { room: Room; level: number; atDoor: boolean }>;
    for (const a of this.roster) {
      out[a.id] = { room: a.room, level: a.level, atDoor: a.atDoor };
    }
    return out;
  }
}
