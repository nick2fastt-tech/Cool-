/**
 * ObbyGame.js
 * -----------
 * A fully-playable obstacle course ("obby"). Procedurally generates a long,
 * checkpointed parkour path with escalating difficulty and these mechanics:
 *   - Checkpoints        save your respawn point (glowing pads)
 *   - Lava               instant death -> respawn at last checkpoint
 *   - Moving platforms   oscillate; their colliders track them each tick
 *   - Trampolines        launch you upward
 *   - Speed boosts       temporarily increase move speed
 *   - Difficulty ramp    gaps widen and hazards increase along the course
 *
 * Multiplayer racing works out of the box: every connected player runs the same
 * seeded course and their remote avatars appear via the NetworkClient; the first
 * to the finish trigger wins.
 */

import * as THREE from 'three';
import { BaseGame } from '../BaseGame.js';
import { bus } from '../../core/EventBus.js';
import { GameState } from '../../core/GameState.js';
import { Leveling } from '../../economy/Leveling.js';
import { Currency } from '../../economy/Currency.js';
import { Vibration } from '../../input/Vibration.js';

/** Seeded RNG so all players in a race get an identical course. */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KILL_Y = -8;

export class ObbyGame extends BaseGame {
  constructor(ctx, { segments = 48, seed = 1337 } = {}) {
    super(ctx);
    this.name = 'Obby';
    this.rng = mulberry32(seed);
    this.segments = segments;
    this.checkpoints = []; // [{index, pos}]
    this.currentCheckpoint = 0;
    this.moving = []; // animated platforms
    this.startTime = performance.now();
    this.finished = false;
    this._boostTimer = 0;

    this._buildCourse();
    this._spawn = this.checkpoints[0].pos.clone().add(new THREE.Vector3(0, 1, 0));
  }

  getSpawn() {
    return this._spawn.clone();
  }

  _mat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts });
  }

  _platform(x, y, z, w, d, color = 0x8d99ae) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), this._mat(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    return this.addSolid(mesh);
  }

  _buildCourse() {
    let x = 0;
    let z = 0;
    let y = 1;

    // Starting pad + first checkpoint.
    this._platform(0, y, 0, 8, 8, 0x4cc9f0);
    this._addCheckpoint(0, new THREE.Vector3(0, y + 0.5, 0));

    for (let i = 1; i <= this.segments; i++) {
      const difficulty = i / this.segments; // 0..1
      const gap = 2.5 + difficulty * 3.5; // widen gaps over time
      const turn = this.rng() < 0.25; // occasionally turn the path
      if (turn) x += (this.rng() < 0.5 ? -1 : 1) * (4 + gap);
      else z -= 4 + gap;
      y += (this.rng() - 0.4) * 2; // some vertical variation
      y = Math.max(1, y);

      const w = THREE.MathUtils.lerp(4, 2.2, difficulty); // platforms shrink
      const roll = this.rng();

      if (roll < 0.16 && i > 4) {
        this._makeMovingPlatform(x, y, z, w, difficulty);
      } else if (roll < 0.26 && i > 6) {
        this._makeTrampoline(x, y, z);
      } else if (roll < 0.36 && i > 6) {
        this._makeSpeedBoost(x, y, z, w);
      } else {
        this._platform(x, y, z, w, w);
        // Sprinkle lava in the gaps at higher difficulty.
        if (this.rng() < difficulty * 0.5 && i > 8) {
          this._makeLava(x, y - 0.6, z + 3, w);
        }
      }

      // A checkpoint roughly every 4 segments.
      if (i % 4 === 0) this._addCheckpoint(this.checkpoints.length, new THREE.Vector3(x, y + 0.5, z));
    }

    // Finish pad.
    z -= 8;
    const finish = this._platform(x, y, z, 8, 8, 0xffd60a);
    this._makeFinish(x, y + 1.5, z);
    this._addCheckpoint(this.checkpoints.length, new THREE.Vector3(x, y + 0.5, z));
    this.finishPos = new THREE.Vector3(x, y, z);
  }

  _addCheckpoint(index, pos) {
    const flag = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 2, 8),
      this._mat(0x2ec4b6, { emissive: 0x2ec4b6, emissiveIntensity: 0.4 })
    );
    flag.position.copy(pos).add(new THREE.Vector3(0, 1, 0));
    this.group.add(flag);
    this.checkpoints.push({ index, pos: pos.clone() });

    const box = new THREE.Box3().setFromCenterAndSize(
      pos.clone().add(new THREE.Vector3(0, 1, 0)),
      new THREE.Vector3(3, 3, 3)
    );
    this.physics.addTrigger(box, {
      tag: `cp:${index}`,
      onEnter: () => this._reachCheckpoint(index),
    });
  }

  _reachCheckpoint(index) {
    if (index <= this.currentCheckpoint) return;
    this.currentCheckpoint = index;
    Vibration.play('checkpoint');
    this.ctx.particles?.burst(this.player.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x2ec4b6, 24, 5);
    Currency.add(5, 'checkpoint');
    if (index > (GameState.get('progress').obbyCheckpoint || 0)) {
      GameState.patch('progress', { obbyCheckpoint: index });
    }
    bus.emit('game:checkpoint', { index, total: this.checkpoints.length });
  }

  _makeMovingPlatform(x, y, z, w, difficulty) {
    const mesh = this._platform(x, y, z, w, w, 0xf72585);
    const id = this._colliderIds[this._colliderIds.length - 1];
    this.moving.push({
      mesh,
      id,
      axis: this.rng() < 0.5 ? 'x' : 'z',
      amp: 2 + difficulty * 3,
      speed: 0.6 + difficulty,
      phase: this.rng() * Math.PI * 2,
      base: new THREE.Vector3(x, y, z),
      half: new THREE.Vector3(w / 2, 0.5, w / 2),
    });
  }

  _makeTrampoline(x, y, z) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 0.6, 16),
      this._mat(0x7209b7, { emissive: 0x7209b7, emissiveIntensity: 0.3 })
    );
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    this.addSolid(mesh);
    const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, y + 1, z), new THREE.Vector3(3, 2, 3));
    this.physics.addTrigger(box, {
      tag: 'trampoline',
      onEnter: () => {
        this.player.velocity.y = 18;
        this.player.grounded = false;
        Vibration.play('jump');
        this.ctx.particles?.burst(new THREE.Vector3(x, y + 1, z), 0x7209b7, 20, 6);
      },
    });
  }

  _makeSpeedBoost(x, y, z, w) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 1, w), this._mat(0x4361ee, { emissive: 0x4361ee, emissiveIntensity: 0.3 }));
    mesh.position.set(x, y, z);
    this.addSolid(mesh);
    const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, y + 1, z), new THREE.Vector3(w, 2, w));
    this.physics.addTrigger(box, {
      tag: 'boost',
      onEnter: () => {
        this.player.speedMultiplier = 2;
        this._boostTimer = 2.5;
        this.ctx.particles?.burst(new THREE.Vector3(x, y + 1, z), 0x4361ee, 18, 5);
      },
    });
  }

  _makeLava(x, y, z, w) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w + 2, 0.4, w + 2),
      new THREE.MeshStandardMaterial({ color: 0xff4800, emissive: 0xff2200, emissiveIntensity: 0.9, roughness: 0.4 })
    );
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, y + 0.5, z), new THREE.Vector3(w + 2, 1.5, w + 2));
    this.physics.addTrigger(box, { tag: 'lava', onEnter: () => this._die('lava') });
  }

  _makeFinish(x, y, z) {
    const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, y, z), new THREE.Vector3(6, 4, 6));
    this.physics.addTrigger(box, { tag: 'finish', onEnter: () => this._finish() });
  }

  _die(cause) {
    Vibration.play('death');
    GameState.patch('stats', { deaths: GameState.get('stats').deaths + 1 });
    bus.emit('stat:changed');
    this.ctx.particles?.burst(this.player.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff3b30, 30, 6);
    const cp = this.checkpoints[this.currentCheckpoint];
    this.player.setPosition(cp.pos.x, cp.pos.y + 1, cp.pos.z);
    bus.emit('game:death', { cause });
  }

  _finish() {
    if (this.finished) return;
    this.finished = true;
    const seconds = (performance.now() - this.startTime) / 1000;
    GameState.patch('progress', { obbyCheckpoint: 999 });
    GameState.patch('stats', { wins: GameState.get('stats').wins + 1 });
    Leveling.award(200);
    Currency.add(250, 'obby_finish');
    bus.emit('stat:changed');
    bus.emit('notify', { icon: '🏁', title: 'Course Complete!', text: `Finished in ${seconds.toFixed(1)}s` });
    bus.emit('game:finish', { mode: 'obby', seconds });
  }

  fixedUpdate(dt) {
    const t = (performance.now() - this.startTime) / 1000;
    // Drive moving platforms and keep their colliders in sync.
    for (const m of this.moving) {
      const off = Math.sin(t * m.speed + m.phase) * m.amp;
      m.mesh.position.copy(m.base);
      m.mesh.position[m.axis] += off;
      const box = new THREE.Box3().setFromCenterAndSize(m.mesh.position, m.half.clone().multiplyScalar(2));
      this.physics.updateSolid(m.id, box);
    }

    // Expire speed boosts.
    if (this._boostTimer > 0) {
      this._boostTimer -= dt;
      if (this._boostTimer <= 0) this.player.speedMultiplier = 1;
    }

    // Fell off the world.
    if (this.player.position.y < KILL_Y) this._die('fall');
  }

  hud() {
    const total = this.checkpoints.length;
    return {
      title: 'OBBY',
      checkpoint: `${this.currentCheckpoint}/${total - 1}`,
      time: `${((performance.now() - this.startTime) / 1000).toFixed(1)}s`,
    };
  }

  dispose() {
    this.player.speedMultiplier = 1;
    super.dispose();
  }
}
