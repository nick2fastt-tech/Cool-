/**
 * Matchmaker.js
 * -------------
 * Owns the room registry and assignment logic. Public rooms are pooled per game
 * mode; quick-play picks the fullest non-full room (to fill games faster) or
 * spins up a new one. Private rooms are created on demand with a share code and
 * are excluded from public listings.
 *
 * Empty rooms are reaped after a grace period to free resources.
 */

import { Room } from './Room.js';

const EMPTY_TTL_MS = 60000;

export class Matchmaker {
  constructor() {
    /** code -> Room */
    this.rooms = new Map();
    setInterval(() => this._reap(), 30000);
  }

  /** Public rooms for a mode, as lightweight listings. */
  list(mode) {
    return [...this.rooms.values()]
      .filter((r) => !r.private && (!mode || r.mode === mode))
      .map((r) => ({ code: r.code, mode: r.mode, players: r.count, max: 16, region: 'default' }));
  }

  getOrCreate(code, mode) {
    let room = this.rooms.get(code);
    if (!room) {
      room = new Room(code, mode || 'lobby', false);
      this.rooms.set(code, room);
    }
    return room;
  }

  /** Create a fresh public/private room and return it. */
  create(mode, isPrivate) {
    const code = this._genCode(mode);
    const room = new Room(code, mode, isPrivate);
    this.rooms.set(code, room);
    return room;
  }

  /** Quick-play: fullest joinable room for a mode, else a new one. */
  quickPlay(mode) {
    const joinable = [...this.rooms.values()]
      .filter((r) => !r.private && r.mode === mode && !r.full)
      .sort((a, b) => b.count - a.count);
    return joinable[0] || this.create(mode, false);
  }

  _genCode(mode) {
    let code;
    do {
      code = `${mode}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    } while (this.rooms.has(code));
    return code;
  }

  _reap() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (room.count === 0) {
        room._emptySince = room._emptySince || now;
        if (now - room._emptySince > EMPTY_TTL_MS && code !== 'lobby') {
          room.dispose();
          this.rooms.delete(code);
        }
      } else {
        room._emptySince = null;
      }
    }
  }
}
