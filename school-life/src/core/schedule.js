// Real-time bell schedule. Pure functions (no DOM) so they can be unit tested in Node.
import { SCHEDULE, GRADE_SCHEDULES, ROOMS } from '../config.js';

export const PERIOD_MS = SCHEDULE.periodMinutes * 60000;
export const BLOCK_MINUTES = SCHEDULE.periods * SCHEDULE.periodMinutes;

/**
 * Work out which period it is right now for a grade.
 * The clock is the real local time. Periods are back-to-back 30 minute blocks
 * starting at the anchor time (8:00 AM) and repeating every 8 periods.
 */
export function getScheduleState(now = new Date(), grade = 6) {
  const list = GRADE_SCHEDULES[grade] || GRADE_SCHEDULES[6];
  const minsOfDay = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000;
  const anchor = SCHEDULE.anchorHour * 60 + SCHEDULE.anchorMinute;
  let rel = (minsOfDay - anchor) % BLOCK_MINUTES;
  if (rel < 0) rel += BLOCK_MINUTES;
  let index = Math.floor(rel / SCHEDULE.periodMinutes);
  if (index >= SCHEDULE.periods) index = SCHEDULE.periods - 1; // float guard
  const blockStartMs = now.getTime() - rel * 60000;
  // Round to the nearest second so the period boundaries are stable.
  const blockStart = Math.round(blockStartMs / 1000) * 1000;

  const rows = list.map(([cls, room], i) => {
    const start = new Date(blockStart + i * PERIOD_MS);
    const end = new Date(blockStart + (i + 1) * PERIOD_MS);
    return {
      period: i + 1,
      cls,
      room,
      roomName: ROOMS[room] ? ROOMS[room].name : '',
      start,
      end,
      current: i === index,
      past: i < index,
    };
  });

  const cur = rows[index];
  const msLeft = Math.max(0, cur.end.getTime() - now.getTime());
  return {
    grade,
    index,
    period: index + 1,
    cls: cur.cls,
    room: cur.room,
    roomName: cur.roomName,
    start: cur.start,
    end: cur.end,
    msLeft,
    progress: 1 - msLeft / PERIOD_MS,
    next: rows[(index + 1) % rows.length],
    rows,
    key: blockStart + ':' + index,
  };
}

/** Which room an NPC student is in for a period (balanced Latin square over the 6 rooms). */
export function npcRoomForPeriod(npcIndex, periodIndex) {
  const rooms = [101, 102, 103, 104, 105, 106];
  return rooms[(npcIndex + periodIndex * 5) % rooms.length];
}

export function formatTime(date, withSeconds = false) {
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  let s = h + ':' + String(m).padStart(2, '0');
  if (withSeconds) s += ':' + String(date.getSeconds()).padStart(2, '0');
  return s + ' ' + ampm;
}

export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + String(s).padStart(2, '0');
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
