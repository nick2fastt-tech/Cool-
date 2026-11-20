import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getScheduleState, npcRoomForPeriod, formatTime, formatCountdown, ordinal } from '../../src/core/schedule.js';
import { GRADE_SCHEDULES } from '../../src/config.js';

const at = (h, m, s = 0) => new Date(2026, 10, 20, h, m, s);

test('8:00 AM is 1st period, 30 min each', () => {
  const s = getScheduleState(at(8, 0, 0), 6);
  assert.equal(s.period, 1);
  assert.equal(s.cls, 'Homeroom');
  assert.equal(s.msLeft, 30 * 60000);
  assert.equal(getScheduleState(at(8, 29, 59), 6).period, 1);
  assert.equal(getScheduleState(at(8, 30, 0), 6).period, 2);
  assert.equal(getScheduleState(at(11, 45), 6).period, 8);
});

test('schedule repeats every 4 hours (always a class in the demo)', () => {
  assert.equal(getScheduleState(at(12, 0), 7).period, 1);
  assert.equal(getScheduleState(at(19, 10), 7).period, 7);
  assert.equal(formatTime(getScheduleState(at(19, 10), 7).start), '7:00 PM');
  assert.equal(getScheduleState(at(1, 0), 7).period, 3);
  assert.equal(getScheduleState(at(7, 59, 59), 7).period, 8);
});

test('rows are consecutive and cover 8 periods', () => {
  const s = getScheduleState(at(9, 15), 9);
  assert.equal(s.rows.length, 8);
  for (let i = 1; i < 8; i++) assert.equal(s.rows[i].start.getTime(), s.rows[i - 1].end.getTime());
  assert.equal(formatTime(s.rows[0].start), '8:00 AM');
  assert.equal(formatTime(s.rows[7].end), '12:00 PM');
  assert.equal(s.period, 3);
  assert.equal(s.rows.filter((r) => r.current).length, 1);
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
    for (let i = 0; i < 36; i++) { const r = npcRoomForPeriod(i, p); count[r] = (count[r] || 0) + 1; }
    assert.deepEqual(Object.values(count), [6, 6, 6, 6, 6, 6]);
  }
});

test('formatting helpers', () => {
  assert.equal(formatTime(at(0, 5)), '12:05 AM');
  assert.equal(formatTime(at(12, 0)), '12:00 PM');
  assert.equal(formatCountdown(61000), '1:01');
  assert.equal(formatCountdown(0), '0:00');
  assert.deepEqual([1, 2, 3, 4, 6, 11, 12, 13, 21, 22].map(ordinal), ['1st', '2nd', '3rd', '4th', '6th', '11th', '12th', '13th', '21st', '22nd']);
});
