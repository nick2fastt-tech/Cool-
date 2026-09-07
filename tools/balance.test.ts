import { describe, expect, it } from 'vitest';
import { NightSession } from '../src/game/nightManager';
import { NIGHTS, Room, TIME } from '../src/game/config';
import { Rng } from '../src/core/rng';

/**
 * Difficulty regression sweep.
 *
 * Two scripted players run every night on a fixed set of seeds:
 *
 *  - "sharp"  reads the director directly and reacts instantly. It is a proxy
 *             for a player who has learned the game and is playing well.
 *  - "sloppy" misses a quarter of its door calls and checks the Crow's Nest
 *             half as often. A proxy for a competent first-timer.
 *
 * The assertions are deliberately loose bounds, not exact numbers - they exist
 * to catch a tuning change that flattens the curve or makes a night
 * unwinnable, without breaking on every balance nudge. Run `npm run balance`
 * to see the table.
 */

const STEP = 1 / 30;
const SEEDS = Array.from({ length: 40 }, (_, i) => (i + 1) * 7919);

interface Result {
  winRate: number;
  avgPowerLeft: number;
  blackoutsPerNight: number;
  deaths: Record<string, number>;
}

function makeBot(skill: 'sharp' | 'sloppy', rng: Rng) {
  return (s: NightSession) => {
    if (s.phase === 'blackout') {
      s.setCrank(true);
      return;
    }
    // A player who sees HUSK raises the tablet; the bot gets to react too.
    if (s.director.husk.state === 'present' && !s.monitor.up) {
      s.toggleMonitor();
      return;
    }
    const snap = s.director.snapshot();
    const foxIncoming = s.director.fox.state === 'sprinting';
    const reliability = skill === 'sharp' ? 1 : 0.75;
    const wantLeft = (snap.rabbit.room === Room.WestCorner || foxIncoming) && rng.chance(reliability);
    const wantRight =
      (snap.hen.room === Room.EastCorner || snap.bear.room === Room.EastCorner) && rng.chance(reliability);
    if (s.doors.isClosed('left') !== wantLeft) s.toggleDoor('left');
    if (s.doors.isClosed('right') !== wantRight) s.toggleDoor('right');

    const coveGap = skill === 'sharp' ? 14 : 26;
    if (s.director.sinceCoveChecked > coveGap) {
      if (!s.monitor.up) s.toggleMonitor();
      s.selectCamera(3);
    } else if (s.monitor.up && s.monitor.upTime > 1.2) {
      s.toggleMonitor();
    }
  };
}

function sweep(nightIndex: number, skill: 'sharp' | 'sloppy'): Result {
  const seconds = TIME.secondsPerHour * TIME.hoursPerNight + 2;
  let wins = 0;
  let power = 0;
  let blackouts = 0;
  const deaths: Record<string, number> = {};
  for (const seed of SEEDS) {
    const session = new NightSession(NIGHTS[nightIndex], { seed });
    const bot = makeBot(skill, new Rng(seed ^ 0x5f3759df));
    session.events.on('blackout', () => blackouts++);
    for (let i = 0; i < seconds / STEP; i++) {
      bot(session);
      session.tick(STEP);
      if (session.isOver) break;
    }
    if (session.phase === 'won') {
      wins++;
      power += session.power.percent;
    } else {
      const k = session.killer ?? 'unknown';
      deaths[k] = (deaths[k] ?? 0) + 1;
    }
  }
  return {
    winRate: wins / SEEDS.length,
    avgPowerLeft: wins ? power / wins : 0,
    blackoutsPerNight: blackouts / SEEDS.length,
    deaths,
  };
}

describe('difficulty curve', () => {
  const sharp = NIGHTS.map((_, i) => sweep(i, 'sharp'));
  const sloppy = NIGHTS.map((_, i) => sweep(i, 'sloppy'));

  it('prints the balance table', () => {
    const fmt = (label: string, rows: Result[]) =>
      `\n=== ${label} ===\n` +
      rows
        .map((r, i) => {
          const n = NIGHTS[i];
          return `N${n.night} ${n.difficulty.padEnd(15)} win ${String(Math.round(r.winRate * 100)).padStart(3)}%` +
            `  power left ${r.avgPowerLeft.toFixed(0).padStart(3)}%` +
            `  blackouts/night ${r.blackoutsPerNight.toFixed(2)}` +
            `  deaths ${JSON.stringify(r.deaths)}`;
        })
        .join('\n');
    console.log(fmt('SHARP PLAYER', sharp) + '\n' + fmt('SLOPPY PLAYER', sloppy));
    expect(sharp).toHaveLength(6);
  });

  it('night 1 is a tutorial: nobody competent should lose it', () => {
    expect(sharp[0].winRate).toBe(1);
    expect(sloppy[0].winRate).toBeGreaterThanOrEqual(0.8);
    expect(sharp[0].blackoutsPerNight).toBe(0);
  });

  it('difficulty rises monotonically for a sharp player', () => {
    for (let i = 1; i < sharp.length; i++) {
      // Allow a small wobble between adjacent nights, never an inversion.
      expect(sharp[i].winRate).toBeLessThanOrEqual(sharp[i - 1].winRate + 0.05);
    }
  });

  it('the last two nights are punishing but winnable', () => {
    expect(sharp[4].winRate).toBeLessThan(0.9);
    expect(sharp[5].winRate).toBeGreaterThan(0.02);
    expect(sharp[5].winRate).toBeLessThan(0.5);
  });

  it('a sloppy player stops coasting after night 2', () => {
    expect(sloppy[2].winRate).toBeLessThan(0.5);
  });

  it('blackouts stay rare early and become the late-night story', () => {
    expect(sharp[1].blackoutsPerNight).toBeLessThan(0.5);
    expect(sharp[5].blackoutsPerNight).toBeGreaterThan(1);
  });
});
