/**
 * Animations.js
 * -------------
 * Procedural skeletal animation for the Avatar. Rather than shipping baked
 * animation clips, we drive the limb pivots with sine waves whose frequency and
 * amplitude depend on the movement state. This is tiny, deterministic, and
 * blends smoothly between states (idle ↔ walk ↔ run ↔ jump ↔ emote).
 */

const STATES = {
  idle: { freq: 1.6, swing: 0.06, bob: 0.02 },
  walk: { freq: 7.0, swing: 0.6, bob: 0.05 },
  run: { freq: 11.0, swing: 0.95, bob: 0.09 },
};

export class Animator {
  /** @param {Avatar} avatar */
  constructor(avatar) {
    this.avatar = avatar;
    this.state = 'idle';
    this.phase = 0;
    this._blend = 0; // 0..1 toward current state's swing
    this._emote = null;
    this._emoteT = 0;
    this._airborne = false;
  }

  setState(state) {
    if (STATES[state]) this.state = state;
  }
  setAirborne(v) {
    this._airborne = v;
  }

  /** Play a one-shot emote for `duration` seconds. */
  playEmote(id, duration = 1.6) {
    this._emote = id;
    this._emoteT = duration;
  }

  update(dt) {
    const a = this.avatar;
    if (!a || !a.leftArm) return;

    // Emotes take over the whole body while active.
    if (this._emote) {
      this._emoteT -= dt;
      this._updateEmote(dt);
      if (this._emoteT <= 0) this._emote = null;
      return;
    }

    if (this._airborne) {
      // Tuck-ish jump pose.
      this._lerpPivot(a.leftLeg.pivot, 0.5, 0.15);
      this._lerpPivot(a.rightLeg.pivot, -0.3, 0.15);
      this._lerpPivot(a.leftArm.pivot, -0.8, 0.15);
      this._lerpPivot(a.rightArm.pivot, -0.8, 0.15);
      a.hips.position.y = 1.0;
      return;
    }

    const cfg = STATES[this.state];
    this.phase += dt * cfg.freq;
    const s = Math.sin(this.phase) * cfg.swing;

    // Arms and legs swing in opposition for a natural gait.
    this._lerpPivot(a.rightArm.pivot, -s, 0.25);
    this._lerpPivot(a.leftArm.pivot, s, 0.25);
    this._lerpPivot(a.rightLeg.pivot, s, 0.25);
    this._lerpPivot(a.leftLeg.pivot, -s, 0.25);

    // Vertical bob synced to double the stride frequency.
    a.hips.position.y = 1.0 + Math.abs(Math.sin(this.phase)) * cfg.bob;

    // Idle sway: gentle torso lean.
    if (this.state === 'idle') a.hips.rotation.z = Math.sin(this.phase * 0.5) * 0.02;
    else a.hips.rotation.z *= 0.9;
  }

  _updateEmote(dt) {
    const a = this.avatar;
    const t = this._emoteT;
    switch (this._emote) {
      case 'wave': {
        a.rightArm.pivot.rotation.z = 2.2;
        a.rightArm.pivot.rotation.x = Math.sin(t * 12) * 0.4;
        break;
      }
      case 'dance': {
        const p = Math.sin(t * 10);
        a.leftArm.pivot.rotation.z = 1.2 + p * 0.6;
        a.rightArm.pivot.rotation.z = -1.2 - p * 0.6;
        a.hips.rotation.y = Math.sin(t * 5) * 0.4;
        a.hips.position.y = 1.0 + Math.abs(p) * 0.08;
        break;
      }
      case 'sit': {
        a.leftLeg.pivot.rotation.x = 1.4;
        a.rightLeg.pivot.rotation.x = 1.4;
        a.hips.position.y = 0.55;
        break;
      }
      default:
        this._emote = null;
    }
  }

  _lerpPivot(pivot, targetX, k) {
    pivot.rotation.x += (targetX - pivot.rotation.x) * k;
  }
}
