// The game clock: starts at 8:00 AM and goes up 1 minute every 60 real seconds.
import { SCHEDULE } from '../config.js';
import { SCHOOL_START, minutesToDate } from './schedule.js';

export class GameClock {
  constructor() {
    this.day = 1;
    this.minutes = SCHOOL_START;
  }

  /** Start a school day (8:00 AM unless a start time is given, in game minutes). */
  reset(startMinutes = SCHOOL_START, day = 1) {
    this.day = day;
    this.minutes = startMinutes;
  }

  advance(realSeconds) {
    this.minutes += realSeconds / SCHEDULE.realSecondsPerGameMinute;
  }

  date() {
    return minutesToDate(this.minutes);
  }
}
