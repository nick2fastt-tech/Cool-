// First-person player controller.
import { BODY } from '../config.js';

const TAU = Math.PI * 2;
const PITCH_MAX = 1.35;

function angleLerp(a, b, t) {
  let d = ((b - a) % TAU + TAU * 1.5) % TAU - TAU / 2;
  return a + d * t;
}

export class Player {
  constructor(physics, gender = 'male') {
    this.physics = physics;
    this.setGender(gender);
    this.radius = 0.24;
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, z: 0 };
    this.vy = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.seat = null;
    this.trans = null; // camera transition {from, to, t, dur, done}
    this.bobPhase = 0;
    this.bob = 0;
    this.speed = 0;
    this.lastStep = 0;
    this.standPos = null;
    this.onStep = null;
    this.onLand = null;
  }

  setGender(gender) {
    this.gender = gender === 'female' ? 'female' : 'male';
    this.height = BODY[this.gender].height;
    this.eye = this.height * 0.936;
    this.seatedEye = this.height * 0.45;
  }

  spawn(x, z, yaw, y = 0) {
    this.pos.x = x;
    this.pos.z = z;
    this.pos.y = y;
    this.yaw = yaw;
    this.pitch = -0.04;
    this.vel.x = this.vel.z = 0;
    this.vy = 0;
    this.seat = null;
    this.trans = null;
  }

  look(dx, dy, type) {
    const sens = type === 'mouse' ? 0.0032 : 0.0046;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    if (this.pitch > PITCH_MAX) this.pitch = PITCH_MAX;
    if (this.pitch < -PITCH_MAX) this.pitch = -PITCH_MAX;
  }

  get busy() {
    return !!this.trans;
  }

  sit(seat) {
    this.standPos = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
    const to = { x: seat.x, y: seat.y + seat.seatH + this.seatedEye, z: seat.z, yaw: seat.yaw, pitch: -0.1 };
    this.trans = { from: this.cameraPose(), to, t: 0, dur: 0.65, sit: true };
    this.seat = seat;
    this.vel.x = this.vel.z = 0;
  }

  standUp() {
    if (!this.seat) return;
    const seat = this.seat;
    // stand on the approach point (aisle) if it's free, else where we came from
    let sx = seat.ax, sz = seat.az;
    const gy = this.physics.groundAt(sx, sz, seat.y + 0.5);
    const blocked = gy === null || this.physics.blocked(sx, sz, gy, this.radius, this.height);
    if (blocked && this.standPos) {
      sx = this.standPos.x;
      sz = this.standPos.z;
    }
    const y = this.physics.groundAt(sx, sz, seat.y + 0.5);
    const to = { x: sx, y: (y === null ? seat.y : y) + this.eye, z: sz, yaw: this.yaw, pitch: this.pitch * 0.5 };
    this.trans = { from: this.cameraPose(), to, t: 0, dur: 0.5, sit: false, ground: y === null ? seat.y : y };
    this.seat = null;
  }

  cameraPose() {
    if (this.seat && !this.trans) {
      const s = this.seat;
      return { x: s.x, y: s.y + s.seatH + this.seatedEye, z: s.z, yaw: this.yaw, pitch: this.pitch };
    }
    return { x: this.pos.x, y: this.pos.y + this.eye + this.bob, z: this.pos.z, yaw: this.yaw, pitch: this.pitch };
  }

  update(dt, mv, audio) {
    if (this.trans) {
      const tr = this.trans;
      tr.t = Math.min(1, tr.t + dt / tr.dur);
      const e = tr.t < 0.5 ? 4 * tr.t ** 3 : 1 - Math.pow(-2 * tr.t + 2, 3) / 2;
      this._camOverride = {
        x: tr.from.x + (tr.to.x - tr.from.x) * e,
        y: tr.from.y + (tr.to.y - tr.from.y) * e - Math.sin(e * Math.PI) * (tr.sit ? 0.08 : 0.05),
        z: tr.from.z + (tr.to.z - tr.from.z) * e,
        yaw: angleLerp(tr.from.yaw, tr.to.yaw, e),
        pitch: tr.from.pitch + (tr.to.pitch - tr.from.pitch) * e,
      };
      if (tr.t >= 1) {
        if (tr.sit) {
          this.yaw = tr.to.yaw;
          this.pitch = tr.to.pitch;
        } else {
          this.pos.x = tr.to.x;
          this.pos.z = tr.to.z;
          this.pos.y = tr.ground;
          this.yaw = tr.to.yaw;
        }
        this.trans = null;
        this._camOverride = null;
      }
      return;
    }
    if (this.seat) {
      this.bob *= 0.8;
      return;
    }
    // movement relative to view yaw
    const maxSpeed = mv.sprint ? 4.2 : 3.1;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const tx = (rx * mv.x + fx * mv.y) * maxSpeed;
    const tz = (rz * mv.x + fz * mv.y) * maxSpeed;
    const accel = Math.hypot(tx, tz) > 0.01 ? 10 : 12;
    const k = Math.min(1, accel * dt);
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.z += (tz - this.vel.z) * k;
    if (mv.turn) this.yaw -= mv.turn * 2.2 * dt;

    const P = this.physics;
    const old = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
    const steps = Math.max(1, Math.ceil((Math.hypot(this.vel.x, this.vel.z) * dt) / 0.12));
    for (let i = 0; i < steps; i++) {
      const nx = this.pos.x + (this.vel.x * dt) / steps;
      const nz = this.pos.z + (this.vel.z * dt) / steps;
      const np = { x: nx, y: this.pos.y, z: nz };
      P.collide(np, this.radius, this.height);
      const g = P.groundAt(np.x, np.z, this.pos.y);
      if (g === null) break; // no floor there: treat as a wall
      this.pos.x = np.x;
      this.pos.z = np.z;
      this.ground = g;
    }
    // vertical: snap to ground on slopes/steps, fall when it drops away
    const g = this.ground !== undefined ? this.ground : P.groundAt(this.pos.x, this.pos.z, this.pos.y);
    if (g !== null && g !== undefined) {
      if (this.pos.y > g + 0.3 || this.vy < 0) {
        this.vy -= 18 * dt;
        this.pos.y += this.vy * dt;
        if (this.pos.y <= g) {
          if (this.vy < -3 && this.onLand) this.onLand(-this.vy);
          this.pos.y = g;
          this.vy = 0;
        }
      } else {
        this.pos.y += (g - this.pos.y) * Math.min(1, dt * 18);
        this.vy = 0;
      }
    }
    this.ground = undefined;
    // head bob + footsteps
    const sp = Math.hypot(this.pos.x - old.x, this.pos.z - old.z) / Math.max(dt, 1e-4);
    this.speed += (sp - this.speed) * Math.min(1, dt * 10);
    if (this.speed > 0.25) {
      const prev = this.bobPhase;
      this.bobPhase += dt * (4.6 + this.speed * 1.35);
      const amp = Math.min(1, this.speed / 3.1);
      this.bob = Math.sin(this.bobPhase * 2) * 0.032 * amp;
      if (Math.floor(prev / Math.PI) !== Math.floor(this.bobPhase / Math.PI)) {
        if (this.onStep) this.onStep(amp);
      }
    } else {
      this.bob *= Math.max(0, 1 - dt * 8);
    }
  }

  applyCamera(camera) {
    const p = this._camOverride || this.cameraPose();
    camera.position.set(p.x, p.y, p.z);
    camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
  }
}
