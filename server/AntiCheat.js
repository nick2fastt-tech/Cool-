/**
 * AntiCheat.js
 * ------------
 * Server-side validation. Because the server is authoritative, clients only
 * send *intent*; this module sanity-checks it before it is trusted/broadcast:
 *
 *   - movement speed clamp: reject/correct positions that imply teleporting
 *     faster than the max allowed speed since the last accepted update
 *   - bounds clamp: keep positions within sane world limits (no NaN/Infinity)
 *   - chat rate limiting: throttle spam per connection
 *
 * Each check returns a corrected value + a flag so the room can decide whether
 * to broadcast, correct the client, or (on repeated violations) kick.
 */

const MAX_SPEED = 30; // units/sec ceiling (sprint + boosts have headroom)
const WORLD_LIMIT = 500;
const CHAT_WINDOW_MS = 1000;
const CHAT_MAX_IN_WINDOW = 4;

export class AntiCheat {
  constructor() {
    this._chatTimestamps = [];
    this.violations = 0;
  }

  /**
   * Validate an incoming position update.
   * @param {object} last   previously accepted {x,y,z,t}
   * @param {object} next    incoming {x,y,z}
   * @param {number} now     ms
   * @returns {{x,y,z, corrected:boolean}}
   */
  validateMove(last, next, now) {
    // Reject non-finite numbers outright.
    if (![next.x, next.y, next.z].every(Number.isFinite)) {
      this.violations++;
      return { ...last, corrected: true };
    }

    // Clamp to world bounds.
    const x = clamp(next.x, -WORLD_LIMIT, WORLD_LIMIT);
    const y = clamp(next.y, -100, 300);
    const z = clamp(next.z, -WORLD_LIMIT, WORLD_LIMIT);

    if (last) {
      const dt = Math.max((now - last.t) / 1000, 1 / 60);
      const dist = Math.hypot(x - last.x, y - last.y, z - last.z);
      const maxDist = MAX_SPEED * dt * 1.5; // 50% slack for jitter/latency
      if (dist > maxDist) {
        this.violations++;
        // Correct toward the last valid position along the attempted vector.
        const s = maxDist / dist;
        return {
          x: last.x + (x - last.x) * s,
          y: last.y + (y - last.y) * s,
          z: last.z + (z - last.z) * s,
          corrected: true,
        };
      }
    }
    return { x, y, z, corrected: false };
  }

  /** Returns true if this chat message is allowed (not spam). */
  allowChat(now) {
    this._chatTimestamps = this._chatTimestamps.filter((t) => now - t < CHAT_WINDOW_MS);
    if (this._chatTimestamps.length >= CHAT_MAX_IN_WINDOW) return false;
    this._chatTimestamps.push(now);
    return true;
  }

  /** Whether this player has misbehaved enough to be removed. */
  shouldKick() {
    return this.violations > 40;
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
