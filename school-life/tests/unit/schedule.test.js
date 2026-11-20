import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getScheduleState, dayPeriods, npcRoomForPeriod, formatTime, formatCountdown, ordinal, minutesToDate, SCHOOL_START, SCHOOL_END } from '../../src/core/schedule.js';
import { GameClock } from '../../src/core/clock.js';
import { GRADE_SCHEDULES } from '../../src/config.js';

const t = (h, m, s = 0) => h * 60 + m + s / 60;
const fmt = (min) => formatTime(minutesToDate(min));

test('school starts at 8:00 AM and lets out at 12:22 PM', () => {
  assert.equal(fmt(SCHOOL_START), '8:00 AM');
  assert.equal(fmt(SCHOOL_END), '12:22 PM');
});

test('30-minute classes with a 1-minute break; the bell at 8:31 starts 2nd period', () => {
  const rows = dayPeriods(7);
  assert.equal(rows.length, 8);
  const times = rows.map((r) => `${fmt(r.startMin)}-${fmt(r.endMin)}`);
  assert.deepEqual(times, [
    '8:00 AM-8:30 AM', '8:31 AM-9:01 AM', '9:02 AM-9:32 AM', '9:33 AM-10:03 AM',
    '10:04 AM-10:34 AM', '10:35 AM-11:05 AM', '11:06 AM-11:36 AM', '11:37 AM-12:22 PM',
  ]);
  for (let i = 0; i < 7; i++) assert.equal(rows[i].endMin - rows[i].startMin, 30);
  assert.equal(rows[7].endMin - rows[7].startMin, 45, '8th period is 45 minutes');
});

test('late 15 minutes after each class starts', () => {
  const rows = dayPeriods(9);
  assert.equal(fmt(rows[0].lateMin), '8:15 AM');
  assert.equal(fmt(rows[1].lateMin), '8:46 AM');
  assert.equal(getScheduleState(t(8, 14, 59), 9).late, false);
  assert.equal(getScheduleState(t(8, 15), 9).late, true);
});

test('phases through the day', () => {
  let s = getScheduleState(t(8, 0), 6);
  assert.equal(s.phase, 'class');
  assert.equal(s.period, 1);
  assert.equal(s.cls, 'Homeroom');
  assert.equal(s.msLeft, 30 * 60000);
  s = getScheduleState(t(8, 30, 20), 6);
  assert.equal(s.phase, 'passing');
  assert.equal(s.period, 2, 'during the break it points at the next class');
  assert.equal(s.cls, 'English');
  assert.equal(Math.round(s.msToBell / 1000), 40, 'bell at 8:31');
  s = getScheduleState(t(8, 31), 6);
  assert.equal(s.phase, 'class');
  assert.equal(s.period, 2);
  s = getScheduleState(t(12, 0), 6);
  assert.equal(s.phase, 'class');
  assert.equal(s.period, 8);
  assert.equal(s.cls, 'Study Hall');
  assert.equal(getScheduleState(t(12, 22), 6).phase, 'after');
  assert.equal(getScheduleState(t(7, 59), 6).phase, 'before');
});

test('the clock goes up 1 minute every 60 seconds, starting at 8:00', () => {
  const c = new GameClock();
  c.reset();
  assert.equal(formatTime(c.date()), '8:00 AM');
  c.advance(59);
  assert.equal(formatTime(c.date()), '8:00 AM');
  c.advance(1);
  assert.equal(formatTime(c.date()), '8:01 AM');
  c.advance(30 * 60);
  assert.equal(formatTime(c.date()), '8:31 AM');
  assert.equal(getScheduleState(c.minutes, 7).period, 2);
});

test('every grade has 8 distinct classes', () => {
  for (const g of [6, 7, 8, 9]) {
    const names = GRADE_SCHEDULES[g].map((r) => r[0]);
    assert.equal(names.length, 8);
    assert.equal(new Set(names).size, 8, 'grade ' + g);
  }
});

test('NPC rooms are balanced each period', () => {
  for (let p = 0; p < 8; p++) {
    const count = {};
    for (let i = 0; i < 36; i++) {
      const r = npcRoomForPeriod(i, p);
      count[r] = (count[r] || 0) + 1;
    }
    assert.deepEqual(Object.values(count), [6, 6, 6, 6, 6, 6]);
  }
});

test('formatting helpers', () => {
  assert.equal(fmt(t(0, 5)), '12:05 AM');
  assert.equal(fmt(t(12, 0)), '12:00 PM');
  assert.equal(formatCountdown(61000), '1:01');
  assert.equal(formatCountdown(0), '0:00');
  assert.deepEqual([1, 2, 3, 4, 6, 11, 12, 13, 21, 22].map(ordinal), ['1st', '2nd', '3rd', '4th', '6th', '11th', '12th', '13th', '21st', '22nd']);
});
