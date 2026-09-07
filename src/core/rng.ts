/**
 * Deterministic pseudo-random source.
 *
 * Every gameplay roll (AI movement, rare events, blackout tune length) goes
 * through one of these so a night can be replayed exactly from a seed. That is
 * what makes the AI unit-testable and, later, what lets the multiplayer server
 * stay authoritative without shipping RNG state to clients.
 */
export class Rng {
  private state: number;

  constructor(seed = Date.now() >>> 0) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** Raw float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * The classic movement check: roll a 20-sided die, succeed when the roll is
   * at or below the character's current aggression level. Level 0 can never
   * succeed; level 20 always does.
   */
  rollAgainst(level: number): boolean {
    if (level <= 0) return false;
    return this.int(1, 20) <= level;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** Chance in [0,1]. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  fork(salt: number): Rng {
    return new Rng((this.state ^ Math.imul(salt, 0x85ebca6b)) >>> 0);
  }
}
