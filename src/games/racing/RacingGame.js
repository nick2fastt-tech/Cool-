/**
 * RacingGame.js
 * -------------
 * An arcade racer. Builds a looped track from road segments and barrier walls,
 * places ordered gates for lap detection, and adds a nitro boost. Best lap times
 * persist as a local leaderboard. Multiple track layouts are selectable by index
 * (seeded so every racer in a room drives the identical circuit).
 *
 * The kart uses the shared PlayerController with a raised top speed + nitro. A
 * full wheeled-vehicle model (steering geometry, drift, suspension) is a
 * documented extension point — see NOTE below.
 */

import * as THREE from 'three';
import { BaseGame } from '../BaseGame.js';
import { bus } from '../../core/EventBus.js';
import { GameState } from '../../core/GameState.js';
import { Currency } from '../../economy/Currency.js';
import { Leveling } from '../../economy/Leveling.js';
import { Vibration } from '../../input/Vibration.js';

/** Selectable vehicles with simple stat differences. */
export const VEHICLES = [
  { id: 'speedster', name: 'Speedster', color: 0xff3b30, topSpeed: 2.4, nitro: 1.8 },
  { id: 'cruiser', name: 'Cruiser', color: 0x0a84ff, topSpeed: 2.0, nitro: 2.2 },
  { id: 'buggy', name: 'Buggy', color: 0x30d158, topSpeed: 2.2, nitro: 2.0 },
];

/** Track presets: control points for an oval-ish loop (x,z). */
const TRACKS = [
  { name: 'Sunset Loop', laps: 3, points: [[0, 30], [30, 20], [36, -10], [12, -34], [-16, -30], [-34, -6], [-26, 22]] },
  { name: 'Canyon Run', laps: 3, points: [[0, 40], [40, 24], [30, -20], [0, -40], [-34, -18], [-38, 18]] },
];

export class RacingGame extends BaseGame {
  constructor(ctx, { track = 0, vehicleId = 'speedster' } = {}) {
    super(ctx);
    this.name = 'Racing';
    this.track = TRACKS[track % TRACKS.length];
    this.vehicle = VEHICLES.find((v) => v.id === vehicleId) || VEHICLES[0];
    this.totalLaps = this.track.laps;
    this.lap = 0;
    this.nextGate = 0;
    this.gates = [];
    this.nitro = 100;
    this._nitroActive = false;
    this.lapStart = 0;
    this.bestLap = GameState.get('progress')[`bestLap_${this.track.name}`] || null;
    this.finished = false;

    this._buildTrack();
    this.player.speedMultiplier = this.vehicle.topSpeed;
  }

  getSpawn() {
    const p = this.track.points[0];
    return new THREE.Vector3(p[0], 2, p[1]);
  }

  _buildTrack() {
    const pts = this.track.points.map((p) => new THREE.Vector3(p[0], 0, p[1]));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    const samples = curve.getPoints(120);

    // Road: a ribbon of quads along the curve.
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.9 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffd60a, emissive: 0x554400, emissiveIntensity: 0.3 });
    const width = 7;

    for (let i = 0; i < samples.length; i++) {
      const a = samples[i];
      const b = samples[(i + 1) % samples.length];
      const dir = b.clone().sub(a);
      const len = dir.length();
      if (len < 0.001) continue;
      dir.normalize();
      const angle = Math.atan2(dir.x, dir.z);

      const seg = new THREE.Mesh(new THREE.BoxGeometry(width, 0.5, len + 0.5), roadMat);
      seg.position.copy(a.clone().lerp(b, 0.5));
      seg.rotation.y = angle;
      seg.receiveShadow = true;
      this.addSolid(seg); // drivable surface (collidable top)

      // Barrier walls every few segments.
      if (i % 4 === 0) {
        const normal = new THREE.Vector3(dir.z, 0, -dir.x);
        for (const s of [-1, 1]) {
          const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 2.2), wallMat);
          wall.position.copy(a).addScaledVector(normal, s * (width / 2));
          wall.position.y = 0.85;
          wall.rotation.y = angle;
          this.addSolid(wall);
        }
      }
    }

    // Ground under the track.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x3a5a40 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.3;
    ground.receiveShadow = true;
    this.group.add(ground);
    this.physics.groundHeight = () => -0.3;

    // Ordered lap gates at each control point.
    this.track.points.forEach((p, idx) => {
      const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(p[0], 2, p[1]), new THREE.Vector3(9, 5, 9));
      this.physics.addTrigger(box, { tag: `gate:${idx}`, onEnter: () => this._passGate(idx) });
      // Start/finish gets a visible arch.
      if (idx === 0) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.4, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        arch.position.set(p[0], 0, p[1]);
        arch.rotation.x = Math.PI / 2;
        this.group.add(arch);
      }
    });
    this.lapStart = performance.now();
    // NOTE: full vehicle physics (Ackermann steering, drift, suspension) would
    // replace PlayerController with a RaycastVehicle-style model here.
  }

  _passGate(idx) {
    if (idx !== this.nextGate) return; // must pass gates in order (anti-shortcut)
    this.nextGate++;
    if (this.nextGate >= this.track.points.length) {
      this.nextGate = 0;
      this._completeLap();
    }
  }

  _completeLap() {
    const seconds = (performance.now() - this.lapStart) / 1000;
    this.lapStart = performance.now();
    this.lap++;
    if (this.bestLap == null || seconds < this.bestLap) {
      this.bestLap = seconds;
      GameState.patch('progress', { [`bestLap_${this.track.name}`]: seconds });
      bus.emit('notify', { icon: '⏱️', title: 'New best lap!', text: `${seconds.toFixed(2)}s` });
    }
    Vibration.play('checkpoint');
    if (this.lap >= this.totalLaps) this._finish();
    else bus.emit('game:hud');
  }

  _finish() {
    if (this.finished) return;
    this.finished = true;
    GameState.patch('stats', { races: GameState.get('stats').races + 1, wins: GameState.get('stats').wins + 1 });
    Currency.add(200, 'race_finish');
    Leveling.award(120);
    bus.emit('stat:changed');
    bus.emit('notify', { icon: '🏆', title: 'Race Complete!', text: `${this.totalLaps} laps done` });
    bus.emit('game:finish', { mode: 'racing' });
  }

  actions() {
    return [{ id: 'nitro', label: '🔥 Nitro' }];
  }
  action(id) {
    if (id === 'nitro' && this.nitro > 10) {
      this._nitroActive = true;
      this._nitroTimer = 1.2;
      this.ctx.particles?.burst(this.player.position.clone(), 0xff9500, 20, 6);
      Vibration.play('jump');
    }
  }

  fixedUpdate(dt) {
    if (this._nitroActive) {
      this.nitro = Math.max(0, this.nitro - 40 * dt);
      this.player.speedMultiplier = this.vehicle.topSpeed * this.vehicle.nitro;
      this._nitroTimer -= dt;
      if (this._nitroTimer <= 0 || this.nitro <= 0) {
        this._nitroActive = false;
        this.player.speedMultiplier = this.vehicle.topSpeed;
      }
    } else if (this.nitro < 100) {
      this.nitro = Math.min(100, this.nitro + 12 * dt); // regen
    }
  }

  hud() {
    return {
      title: this.track.name,
      lap: `${Math.min(this.lap + 1, this.totalLaps)}/${this.totalLaps}`,
      nitro: Math.round(this.nitro),
      best: this.bestLap ? `${this.bestLap.toFixed(2)}s` : '—',
    };
  }

  dispose() {
    this.player.speedMultiplier = 1;
    super.dispose();
  }
}
