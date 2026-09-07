import { describe, expect, it } from 'vitest';
import { NightSession } from '../src/game/nightManager';
import { NIGHTS, POWER, Room, TIME } from '../src/game/config';
import { PowerSystem } from '../src/game/powerSystem';
import { Rng } from '../src/core/rng';
import { NightClock } from '../src/core/clock';

const STEP = 1 / 30;

/** Run a session forward `seconds` with an optional per-tick controller. */
function run(session: NightSession, seconds: number, control?: (s: NightSession) => void): void {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    control?.(session);
    session.tick(STEP);
    if (session.isOver) return;
  }
}

/**
 * A QA bot that plays "perfectly" by cheating: it reads the director snapshot
 * directly. Used to prove a night is *survivable*, not to model a real player.
 */
function perfectPlay(s: NightSession): void {
  if (s.phase === 'blackout') {
    s.setCrank(true);
    return;
  }
  const snap = s.director.snapshot();
  const foxDanger = s.director.fox.state === 'sprinting';
  const wantLeft = snap.rabbit.room === Room.WestCorner || foxDanger;
  const wantRight = snap.hen.room === Room.EastCorner || snap.bear.room === Room.EastCorner;
  if (s.doors.isClosed('left') !== wantLeft) s.toggleDoor('left');
  if (s.doors.isClosed('right') !== wantRight) s.toggleDoor('right');
  // Keep the fox honest without burning the grid: peek at the Crow's Nest.
  if (s.director.sinceCoveChecked > 14) {
    if (!s.monitor.up) s.toggleMonitor();
    s.selectCamera(3);
  } else if (s.monitor.up && s.monitor.upTime > 1.2) {
    s.toggleMonitor();
  }
}

describe('night clock', () => {
  it('runs 12 AM to 6 AM and labels hours', () => {
    const clock = new NightClock(60, 6);
    expect(clock.label).toBe('12 AM');
    clock.skipTo(1);
    expect(clock.label).toBe('1 AM');
    expect(clock.isComplete).toBe(false);
    clock.skipTo(6);
    expect(clock.isComplete).toBe(true);
  });

  it('reports each hour rollover exactly once', () => {
    const clock = new NightClock(1, 6);
    const seen: number[] = [];
    // One extra step: 180 additions of 1/30 land a hair under 6.0 in binary FP.
    for (let i = 0; i <= 6 * 30; i++) {
      const h = clock.advance(1 / 30);
      if (h !== null) seen.push(h);
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('power economy', () => {
  const idle = { leftDoor: false, rightDoor: false, leftLight: false, rightLight: false, monitor: false };

  it('drains one usage bar when idle', () => {
    const p = new PowerSystem();
    p.reset(1);
    const rng = new Rng(1);
    for (let i = 0; i < 30; i++) p.tick(STEP, idle, false, rng);
    expect(p.usage).toBe(1);
    expect(p.power).toBeCloseTo(100 - POWER.drainPerUsagePerSecond, 2);
  });

  it('counts every active system as a usage bar, capped at five', () => {
    const p = new PowerSystem();
    p.reset(1);
    const rng = new Rng(1);
    p.tick(STEP, { leftDoor: true, rightDoor: true, leftLight: true, rightLight: true, monitor: true }, false, rng);
    expect(p.usage).toBe(POWER.maxUsage);
  });

  it('survives an idle six-minute night with margin', () => {
    const p = new PowerSystem();
    p.reset(1);
    const rng = new Rng(1);
    const seconds = TIME.secondsPerHour * TIME.hoursPerNight;
    for (let i = 0; i < seconds * 30; i++) p.tick(STEP, idle, false, rng);
    expect(p.phase).toBe('online');
    expect(p.power).toBeGreaterThan(45);
  });

  it('blacks out at zero and hands the player a crank', () => {
    const p = new PowerSystem();
    p.reset(1);
    const rng = new Rng(9);
    p.forceBlackout(rng);
    expect(p.phase).toBe('blackout');
    expect(p.crankTarget).toBeGreaterThan(0);
    expect(p.tuneRemaining).toBeGreaterThan(0);
  });

  it('restores power when the crank bar fills, and gives less each time', () => {
    const p = new PowerSystem();
    p.reset(1);
    const rng = new Rng(3);
    p.forceBlackout(rng);
    const first = p.crankTarget;
    for (let i = 0; i < 30 * 10 && p.phase === 'blackout'; i++) p.tick(STEP, idle, true, rng);
    expect(p.phase).toBe('online');
    const firstRestore = p.power;
    expect(firstRestore).toBeGreaterThan(0);

    p.forceBlackout(rng);
    expect(p.crankTarget).toBeGreaterThan(first); // harder every time
    for (let i = 0; i < 30 * 20 && p.phase === 'blackout'; i++) p.tick(STEP, idle, true, rng);
    expect(p.power).toBeLessThan(firstRestore); // and worth less every time
  });

  it('loses the night if the music box finishes first', () => {
    const p = new PowerSystem();
    p.reset(1);
    const rng = new Rng(5);
    p.forceBlackout(rng);
    for (let i = 0; i < 30 * 40 && p.phase === 'blackout'; i++) p.tick(STEP, idle, false, rng);
    expect(p.phase).toBe('lost');
  });

  it('cranking shortens the tune - noise costs you time', () => {
    const quiet = new PowerSystem();
    const loud = new PowerSystem();
    quiet.reset(1);
    loud.reset(1);
    quiet.forceBlackout();
    loud.forceBlackout();
    const rng = new Rng(2);
    for (let i = 0; i < 30; i++) {
      quiet.tick(STEP, idle, false, rng);
      loud.tick(STEP, idle, true, rng);
    }
    expect(loud.tuneRemaining).toBeLessThan(quiet.tuneRemaining);
  });
});

describe('animatronic behaviour', () => {
  it('never moves a character whose aggression is zero', () => {
    const s = new NightSession(NIGHTS[0], { seed: 42 });
    run(s, 300);
    // Night 1 starts hen, bear and fox at 0 with no escalation entries.
    expect(s.director.hen.room).toBe(Room.Stage);
    expect(s.director.bear.room).toBe(Room.Stage);
    expect(s.director.fox.stage).toBe(0);
  });

  it('the bear will not move while you are watching his room', () => {
    const s = new NightSession(NIGHTS[5], { seed: 7 });
    s.director.bear.bumpLevel(20);
    s.toggleMonitor();
    run(s, 60, (sess) => {
      // Pin the feed to whichever room he is standing in.
      const idx = ['STAGE', 'DINING', 'RESTROOMS', 'KITCHEN', 'EAST_HALL', 'EAST_CORNER'].indexOf(
        sess.director.bear.room,
      );
      const cam = [0, 1, 10, 9, 6, 7][Math.max(0, idx)];
      sess.selectCamera(cam);
    });
    expect(s.director.bear.room).toBe(Room.Stage);
  });

  it('the fox advances through curtain stages and sprints', () => {
    const s = new NightSession(NIGHTS[5], { seed: 3 });
    s.director.fox.bumpLevel(20);
    run(s, 40, (sess) => {
      // Hold the left door shut so the sprint resolves as a block, not a kill.
      if (!sess.doors.isClosed('left')) sess.toggleDoor('left');
    });
    expect(s.director.fox.stage + (s.director.fox.state === 'cooldown' ? 4 : 0)).toBeGreaterThan(0);
  });

  it('a closed door stops the west-side attacker while the grid holds', () => {
    const s = new NightSession(NIGHTS[5], { seed: 11 });
    s.director.rabbit.bumpLevel(20);
    let blackouts = 0;
    s.events.on('blackout', () => blackouts++);
    run(s, 120, (sess) => {
      if (!sess.doors.isClosed('left')) sess.toggleDoor('left');
      if (!sess.doors.isClosed('right')) sess.toggleDoor('right');
    });
    // Shutters hold. The only way anyone gets in is if the grid dies first
    // (holding both doors on Night 6 while the fox bangs on them is expensive).
    if (s.phase === 'lost') expect(blackouts).toBeGreaterThan(0);
    else expect(s.director.rabbit.room).not.toBe(Room.Office);
  });
});

describe('full nights', () => {
  it('night 1 is survivable with competent play, on every seed tried', () => {
    for (const seed of [1, 2, 3, 17, 99, 12345]) {
      const s = new NightSession(NIGHTS[0], { seed });
      run(s, TIME.secondsPerHour * TIME.hoursPerNight + 2, perfectPlay);
      expect(`${seed}:${s.phase}`).toBe(`${seed}:won`);
    }
  });

  it('night 6 resolves cleanly and is meaningfully harder', () => {
    let survived = 0;
    for (const seed of [1, 2, 3, 17, 99, 12345]) {
      const s = new NightSession(NIGHTS[5], { seed });
      run(s, TIME.secondsPerHour * TIME.hoursPerNight + 2, perfectPlay);
      expect(['won', 'lost']).toContain(s.phase);
      if (s.phase === 'won') survived++;
    }
    expect(survived).toBeLessThan(6); // an omniscient bot should not sweep it
  });

  it('idling through night 1 with the doors open still ends the shift', () => {
    const s = new NightSession(NIGHTS[0], { seed: 8 });
    run(s, TIME.secondsPerHour * TIME.hoursPerNight + 2);
    expect(['won', 'lost']).toContain(s.phase);
  });
});
