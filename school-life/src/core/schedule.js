// Bell schedule on the game clock. Pure functions (no DOM) so they can be unit tested.
// Times are "game minutes": minutes since midnight (8:00 AM = 480).
import { SCHEDULE, GRADE_SCHEDULES, ROOMS } from '../config.js';

export const SCHOOL_START = SCHEDULE.startHour * 60 + SCHEDULE.startMinute;

/** The 8 periods of a grade's day with their start, end and late times. */
export function dayPeriods(grade) {
  const list = GRADE_SCHEDULES[grade] || GRADE_SCHEDULES[6];
  const rows = [];
  let t = SCHOOL_START;
  list.forEach(([cls, room], i) => {
    const len = i === list.length - 1 ? SCHEDULE.lastClassMinutes : SCHEDULE.classMinutes;
    rows.push({
      period: i + 1,
      cls,
      room,
      roomName: ROOMS[room] ? ROOMS[room].name : '',
      startMin: t,
      endMin: t + len,
      lateMin: t + SCHEDULE.lateAfterMinutes,
    });
    t += len + SCHEDULE.passingMinutes;
  });
  return rows;
}

export const SCHOOL_END = (() => {
  const rows = dayPeriods(6);
  return rows[rows.length - 1].endMin;
})();

/** A Date whose local hours/minutes/seconds show a game time (date part doesn't matter). */
export function minutesToDate(min) {
  const d = new Date(2026, 8, 1, 0, 0, 0, 0); // no daylight-saving change on this day
  d.setTime(d.getTime() + Math.round(min * 60000));
  return d;
}

/**
 * Where we are in the school day.
 * phase: 'before' (before 8:00) | 'class' | 'passing' (break before the next class) | 'after' (school's out)
 */
export function getScheduleState(gameMin, grade = 6, day = 1) {
  const rows = dayPeriods(grade);
  const last = rows[rows.length - 1];
  let phase;
  let index;
  if (gameMin < rows[0].startMin) {
    phase = 'before';
    index = 0;
  } else if (gameMin >= last.endMin) {
    phase = 'after';
    index = rows.length - 1;
  } else {
    index = rows.findIndex((r) => gameMin < r.endMin);
    phase = gameMin >= rows[index].startMin ? 'class' : 'passing';
  }
  const cur = rows[index];
  let leftMin = 0;
  let total = 1;
  if (phase === 'class') {
    leftMin = cur.endMin - gameMin;
    total = cur.endMin - cur.startMin;
  } else if (phase === 'passing' || phase === 'before') {
    leftMin = cur.startMin - gameMin;
    total = phase === 'passing' ? SCHEDULE.passingMinutes : Math.max(1, cur.startMin - gameMin);
  }
  // next bell: the next class start, or the end of school during the last class
  let bellMin = null;
  if (phase === 'class') bellMin = index + 1 < rows.length ? rows[index + 1].startMin : last.endMin;
  else if (phase !== 'after') bellMin = cur.startMin;
  return {
    grade,
    day,
    phase,
    index,
    period: cur.period,
    cls: cur.cls,
    room: cur.room,
    roomName: cur.roomName,
    startMin: cur.startMin,
    endMin: cur.endMin,
    lateMin: cur.lateMin,
    start: minutesToDate(cur.startMin),
    end: minutesToDate(cur.endMin),
    lateAt: minutesToDate(cur.lateMin),
    late: phase === 'class' && gameMin >= cur.lateMin,
    msLeft: Math.max(0, leftMin * 60000),
    msToBell: bellMin === null ? 0 : Math.max(0, (bellMin - gameMin) * 60000),
    progress: phase === 'class' ? 1 - leftMin / total : 0,
    next: rows[index + 1] || null,
    rows: rows.map((r, i) => ({
      ...r,
      start: minutesToDate(r.startMin),
      end: minutesToDate(r.endMin),
      current: i === index && phase === 'class',
      upcoming: i === index && (phase === 'passing' || phase === 'before'),
      past: r.endMin <= gameMin,
    })),
    key: day + ':' + phase + ':' + index,
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
