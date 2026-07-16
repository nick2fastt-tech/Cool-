/**
 * Snapshot.js
 * -----------
 * Client-side entity interpolation buffer. Remote players are rendered slightly
 * in the past (Config.net.interpolationDelayMs) and interpolated between the two
 * server snapshots straddling that render time. This hides jitter and packet
 * timing so remote avatars move smoothly even at 20 Hz update rates.
 */

import * as THREE from 'three';
import { Config } from '../core/Config.js';

export class InterpolatedEntity {
  constructor() {
    /** Ring of recent states: {t, x, y, z, yaw}. */
    this._buffer = [];
    this.anim = 'idle';
    this.air = false;
  }

  /** Push a newly-received server state stamped with local receive time. */
  push(state, now = performance.now()) {
    this.anim = state.anim ?? this.anim;
    this.air = state.air ?? this.air;
    this._buffer.push({ t: now, x: state.x, y: state.y, z: state.z, yaw: state.yaw });
    // Keep ~1s of history.
    while (this._buffer.length > 2 && now - this._buffer[0].t > 1000) this._buffer.shift();
  }

  /**
   * Sample the interpolated transform at the render clock.
   * @param {THREE.Vector3} outPos
   * @returns {number} interpolated yaw
   */
  sample(outPos, now = performance.now()) {
    const renderT = now - Config.net.interpolationDelayMs;
    const buf = this._buffer;
    if (buf.length === 0) return 0;
    if (buf.length === 1) {
      outPos.set(buf[0].x, buf[0].y, buf[0].z);
      return buf[0].yaw;
    }
    // Find the pair straddling renderT.
    let a = buf[0];
    let b = buf[buf.length - 1];
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i].t <= renderT && buf[i + 1].t >= renderT) {
        a = buf[i];
        b = buf[i + 1];
        break;
      }
    }
    const span = b.t - a.t || 1;
    const k = THREE.MathUtils.clamp((renderT - a.t) / span, 0, 1);
    outPos.set(
      a.x + (b.x - a.x) * k,
      a.y + (b.y - a.y) * k,
      a.z + (b.z - a.z) * k
    );
    // Shortest-arc yaw interpolation.
    let dy = b.yaw - a.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    return a.yaw + dy * k;
  }
}
