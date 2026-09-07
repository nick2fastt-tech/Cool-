/**
 * The night clock: 12 AM -> 6 AM.
 *
 * Hour 0 is displayed as "12 AM"; reaching hour 6 ends the shift. The clock is
 * pure data - it does not know about rendering - so the night manager and the
 * (future) multiplayer server can both own one.
 */
export class NightClock {
  /** Elapsed in-game seconds since 12:00 AM. */
  private elapsed = 0;
  private lastHour = 0;

  constructor(
    /** Real seconds per in-game hour. */
    public secondsPerHour: number,
    /** Hours in a shift. */
    public readonly hours = 6,
  ) {}

  get hour(): number {
    return Math.min(this.hours, Math.floor(this.elapsed / this.secondsPerHour));
  }

  /** 0..1 across the whole night. */
  get progress(): number {
    return Math.min(1, this.elapsed / (this.secondsPerHour * this.hours));
  }

  /** 0..1 within the current hour. */
  get hourProgress(): number {
    return (this.elapsed % this.secondsPerHour) / this.secondsPerHour;
  }

  get isComplete(): boolean {
    return this.elapsed >= this.secondsPerHour * this.hours;
  }

  get label(): string {
    const h = this.hour;
    return h === 0 ? '12 AM' : `${h} AM`;
  }

  reset(): void {
    this.elapsed = 0;
    this.lastHour = 0;
  }

  /** Advance; returns the new hour when the hour just rolled over, else null. */
  advance(dt: number): number | null {
    this.elapsed += dt;
    const h = this.hour;
    if (h !== this.lastHour) {
      this.lastHour = h;
      return h;
    }
    return null;
  }

  /** Test/debug helper - jump the clock forward. */
  skipTo(hour: number): void {
    this.elapsed = hour * this.secondsPerHour;
    this.lastHour = this.hour;
  }
}
