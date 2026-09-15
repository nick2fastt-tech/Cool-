// T10 World - animals. Procedural bodies with a simple gait rig, plus flocking,
// grazing, fleeing and sleeping behaviours that run independently of the player.
import * as THREE from '../../vendor/three.module.js';
import { GeometryBatcher, boxUV, cylinderUV, transformed, disposeGroup } from '../world/geomutils.js';
import { paintedMaterial, foliageMaterial } from '../world/materials.js';
import { clamp01, clampv, lerpv, damp, dampAngle, wrapAngle, makeRng, TAU, noise1 } from '../core/math.js';
import { settings } from '../core/settings.js';
import { audio } from '../core/audio.js';

export const ANIMAL_TYPES = {
  dog:     { name: 'Dog',     l: 0.85, h: 0.55, w: 0.28, legs: 4, speed: 3.2, run: 7.0, flee: 6, colors: [0x8a6a44, 0x3a3128, 0xd8cdbc, 0x6a5a48, 0x2a2622], social: 0.6, tail: 'wag', ears: 'flop' },
  cat:     { name: 'Cat',     l: 0.55, h: 0.34, w: 0.18, legs: 4, speed: 2.2, run: 8.0, flee: 9, colors: [0x2a2622, 0xb08a5a, 0xd8d2c8, 0x6a6258], social: 0.15, tail: 'long', ears: 'point' },
  bird:    { name: 'Pigeon',  l: 0.26, h: 0.20, w: 0.14, legs: 2, speed: 0.8, run: 2.0, flee: 14, colors: [0x6a7078, 0x8a8e94, 0x4a4e54], social: 0.95, fly: true },
  seagull: { name: 'Seagull', l: 0.42, h: 0.28, w: 0.18, legs: 2, speed: 1.0, run: 2.4, flee: 12, colors: [0xe8e6e0, 0xd8d6d0], social: 0.85, fly: true },
  deer:    { name: 'Deer',    l: 1.55, h: 1.25, w: 0.42, legs: 4, speed: 2.6, run: 11.0, flee: 26, colors: [0x8a6a44, 0x9a7a52, 0x6a5238], social: 0.7, antlers: true },
  rabbit:  { name: 'Rabbit',  l: 0.38, h: 0.28, w: 0.16, legs: 4, speed: 1.6, run: 8.0, flee: 12, colors: [0x8a7a68, 0xd8d2c4, 0x5a5048], social: 0.4, ears: 'long', hop: true },
  cow:     { name: 'Cow',     l: 2.2, h: 1.45, w: 0.70, legs: 4, speed: 1.1, run: 4.0, flee: 10, colors: [0xe8e4dc, 0x4a3a2a, 0x8a6a48], social: 0.85, graze: true },
  horse:   { name: 'Horse',   l: 2.3, h: 1.65, w: 0.62, legs: 4, speed: 2.4, run: 13.0, flee: 16, colors: [0x6a4a30, 0x2a2420, 0xb09a7a, 0xd8d2c8], social: 0.6, graze: true, mane: true },
  fox:     { name: 'Fox',     l: 0.75, h: 0.48, w: 0.22, legs: 4, speed: 2.8, run: 9.0, flee: 16, colors: [0xb5541f, 0xa8602a], social: 0.2, tail: 'bushy', ears: 'point' },
  squirrel:{ name: 'Squirrel',l: 0.26, h: 0.20, w: 0.12, legs: 4, speed: 2.0, run: 6.0, flee: 8, colors: [0x7a5a3a, 0x8a8078], social: 0.25, tail: 'bushy' },
  sheep:   { name: 'Sheep',   l: 1.10, h: 0.85, w: 0.38, legs: 4, speed: 1.2, run: 4.2, flee: 12, colors: [0xe4e0d6, 0xd0ccc2], social: 0.95, graze: true },
  goat:    { name: 'Goat',    l: 1.05, h: 0.85, w: 0.32, legs: 4, speed: 1.6, run: 5.4, flee: 11, colors: [0xd8cfc0, 0x7a6a54, 0x3a332c], social: 0.7, graze: true, ears: 'flop' },
  pig:     { name: 'Pig',     l: 1.20, h: 0.65, w: 0.42, legs: 4, speed: 1.3, run: 4.6, flee: 9, colors: [0xd8a89a, 0xc09080, 0x4a4038], social: 0.7, graze: true },
  chicken: { name: 'Chicken', l: 0.32, h: 0.34, w: 0.16, legs: 2, speed: 1.0, run: 3.2, flee: 7, colors: [0xe8e2d4, 0x8a5a34, 0x2a2622], social: 0.85 },
  duck:    { name: 'Duck',    l: 0.38, h: 0.28, w: 0.18, legs: 2, speed: 0.9, run: 2.6, flee: 9, colors: [0x4a5a34, 0xe8e2d4, 0x6a5a3a], social: 0.9, fly: true },
  crow:    { name: 'Crow',    l: 0.36, h: 0.26, w: 0.16, legs: 2, speed: 1.0, run: 2.6, flee: 13, colors: [0x1a1a1e, 0x24242a], social: 0.75, fly: true },
  wolf:    { name: 'Wolf',    l: 1.15, h: 0.78, w: 0.32, legs: 4, speed: 3.0, run: 10.5, flee: 20, colors: [0x6a6258, 0x4a4640, 0x8a8278], social: 0.8, tail: 'bushy', ears: 'point' },
  bear:    { name: 'Bear',    l: 1.85, h: 1.15, w: 0.62, legs: 4, speed: 2.0, run: 9.0, flee: 24, colors: [0x4a3a28, 0x2a2420, 0x7a6248], social: 0.1, ears: 'flop' },
};

export const URBAN_ANIMALS = ['dog', 'cat', 'bird', 'squirrel'];
export const PARK_ANIMALS = ['dog', 'bird', 'squirrel', 'rabbit'];
export const BEACH_ANIMALS = ['seagull', 'dog'];
export const FOREST_ANIMALS = ['deer', 'rabbit', 'fox', 'bird', 'squirrel', 'wolf', 'crow'];
export const FARM_ANIMALS = ['cow', 'horse', 'dog', 'sheep', 'goat', 'pig', 'chicken', 'duck'];

function buildAnimal(spec, color, rng) {
  const group = new THREE.Group();
  const batch = new GeometryBatcher();
  const body = paintedMaterial(color, 0.85);
  const dark = paintedMaterial(0x2a2622, 0.9);
  const L = spec.l, H = spec.h, W = spec.w;
  const refs = { legs: [], tail: null, head: null };

  const bodyH = H * (spec.legs === 4 ? 0.42 : 0.62);
  const bodyY = H - bodyH * 0.55;

  // Torso
  batch.add(body, transformed(boxUV(W * 2, bodyH, L * 0.72, 1, 1), 0, bodyY, 0, 0));
  if (spec.graze) batch.add(body, transformed(boxUV(W * 2.1, bodyH * 0.9, L * 0.3, 1, 1), 0, bodyY - bodyH * 0.06, -L * 0.18, 0));

  // Head on a neck
  const head = new THREE.Group();
  const neckLen = spec.legs === 4 ? L * 0.26 : L * 0.16;
  head.position.set(0, bodyY + bodyH * (spec.graze ? 0.55 : 0.35), L * 0.36);
  const hb = new THREE.Mesh(new THREE.BoxGeometry(W * 1.5, H * 0.24, L * 0.28), body);
  hb.position.set(0, H * 0.10, neckLen * 0.6);
  head.add(hb);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(W * 1.0, H * 0.14, L * 0.16), body);
  snout.position.set(0, H * 0.04, neckLen * 0.6 + L * 0.18);
  head.add(snout);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(W * 0.5, H * 0.06, L * 0.04), dark);
  nose.position.set(0, H * 0.05, neckLen * 0.6 + L * 0.26);
  head.add(nose);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.012, W * 0.14), 6, 5), dark);
    eye.position.set(sx * W * 0.58, H * 0.16, neckLen * 0.6 + L * 0.08);
    head.add(eye);
    if (spec.ears === 'long') {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(W * 0.28, H * 0.42, W * 0.16), body);
      ear.position.set(sx * W * 0.45, H * 0.36, neckLen * 0.6 - L * 0.02);
      head.add(ear);
    } else if (spec.ears === 'point') {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(W * 0.30, H * 0.20, 4), body);
      ear.position.set(sx * W * 0.62, H * 0.24, neckLen * 0.6);
      head.add(ear);
    } else if (spec.ears === 'flop') {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(W * 0.18, H * 0.22, W * 0.40), body);
      ear.position.set(sx * W * 0.78, H * 0.10, neckLen * 0.6);
      head.add(ear);
    }
  }
  if (spec.antlers) {
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const a = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, H * (0.18 + i * 0.06), 4), paintedMaterial(0x8a7a5a, 0.9));
        a.position.set(sx * (W * 0.5 + i * 0.05), H * (0.34 + i * 0.05), neckLen * 0.6 - i * 0.04);
        a.rotation.z = sx * 0.4;
        head.add(a);
      }
    }
  }
  if (spec.mane) {
    const mane = new THREE.Mesh(new THREE.BoxGeometry(W * 0.3, H * 0.2, L * 0.3), paintedMaterial(0x2a2420, 0.95));
    mane.position.set(0, H * 0.22, neckLen * 0.2);
    head.add(mane);
  }
  group.add(head);
  refs.head = head;

  // Legs
  const legLen = H - bodyH * 0.6;
  const legR = W * 0.28;
  const pairs = spec.legs === 4
    ? [[-1, 1], [1, 1], [-1, -1], [1, -1]]
    : [[-1, 0], [1, 0]];
  for (const [sx, sz] of pairs) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * W * 0.7, bodyY - bodyH * 0.4, sz * L * 0.26);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(legR * 2, legLen, legR * 2), body);
    seg.position.y = -legLen * 0.5;
    pivot.add(seg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(legR * 2.2, legR * 1.2, legR * 3), dark);
    foot.position.set(0, -legLen + legR * 0.4, legR * 0.4);
    pivot.add(foot);
    group.add(pivot);
    refs.legs.push({ pivot, front: sz > 0, side: sx });
  }

  // Tail
  if (spec.tail || spec.legs === 4) {
    const tail = new THREE.Group();
    tail.position.set(0, bodyY + bodyH * 0.2, -L * 0.36);
    const tl = spec.tail === 'long' ? L * 0.55 : spec.tail === 'bushy' ? L * 0.5 : L * 0.28;
    const tr = spec.tail === 'bushy' ? W * 0.7 : W * 0.25;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(tr * 2, tr * 2, tl), body);
    seg.position.z = -tl * 0.5;
    tail.add(seg);
    group.add(tail);
    refs.tail = tail;
  }

  // Wings for birds
  if (spec.fly) {
    refs.wings = [];
    for (const sx of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(sx * W * 0.8, bodyY + bodyH * 0.1, 0);
      const wm = new THREE.Mesh(new THREE.BoxGeometry(L * 0.6, 0.02, L * 0.36), body);
      wm.position.x = sx * L * 0.3;
      wing.add(wm);
      group.add(wing);
      refs.wings.push({ wing, side: sx });
    }
  }

  batch.build(group, { castShadow: settings.preset.shadows, receiveShadow: true });
  group.traverse((o) => { if (o.isMesh) { o.castShadow = settings.preset.shadows; o.receiveShadow = true; } });
  return { group, refs };
}

export class Animal {
  constructor(manager, typeId, x, z) {
    this.manager = manager;
    this.world = manager.world;
    this.typeId = ANIMAL_TYPES[typeId] ? typeId : 'dog';
    this.spec = ANIMAL_TYPES[this.typeId];
    this.rng = makeRng((Math.random() * 0xffffffff) >>> 0);
    this.color = this.rng.pick(this.spec.colors);
    const built = buildAnimal(this.spec, this.color, this.rng);
    this.group = built.group;
    this.refs = built.refs;
    this.group.userData.animal = this;

    this.position = new THREE.Vector3(x, this.world.groundAt(x, z), z);
    this.heading = this.rng() * TAU;
    this.speed = 0;
    this.targetSpeed = 0;
    this.phase = this.rng() * TAU;
    this.flyHeight = this.spec.fly ? 0 : 0;
    this.flying = false;

    this.state = 'wander';
    this.stateTimer = this.rng.range(3, 14);
    this.target = null;
    this.flock = null;
    this.alarm = 0;
    this.soundTimer = this.rng.range(5, 30);
    this.controlled = null;
    this.group.position.copy(this.position);
  }

  get name() { return this.spec.name; }

  update(dt, playerPos, threats) {
    if (this.controlled === 'freeze') { this.targetSpeed = 0; this.speed = 0; return; }
    this.stateTimer -= dt;
    this.soundTimer -= dt;

    // --- Threat check: humans and vehicles scare animals off ---
    let fleeFrom = null, fleeDist = Infinity;
    const fleeRange = this.spec.flee;
    if (playerPos) {
      const d = this.position.distanceTo(playerPos);
      if (d < fleeRange) { fleeFrom = playerPos; fleeDist = d; }
    }
    if (threats) {
      for (const t of threats) {
        const d = this.position.distanceTo(t.position);
        if (d < fleeRange * 1.4 && d < fleeDist) { fleeFrom = t.position; fleeDist = d; }
      }
    }

    if (this.controlled === 'follow' && playerPos) {
      this.state = 'follow';
      this.target = { x: playerPos.x, z: playerPos.z };
      const d = this.position.distanceTo(playerPos);
      this.targetSpeed = d > 6 ? this.spec.run * 0.6 : d > 2.5 ? this.spec.speed : 0;
    } else if (fleeFrom && this.controlled !== 'follow') {
      this.state = 'flee';
      this.alarm = 1;
      const dx = this.position.x - fleeFrom.x, dz = this.position.z - fleeFrom.z;
      const len = Math.hypot(dx, dz) || 1;
      this.target = { x: this.position.x + (dx / len) * 22, z: this.position.z + (dz / len) * 22 };
      this.targetSpeed = this.spec.run * clamp01(1.2 - fleeDist / fleeRange);
      if (this.spec.fly) this.flying = true;
      if (this.soundTimer <= 0 && playerPos && this.position.distanceTo(playerPos) < 22) {
        audio.animal(this.typeId === 'seagull' ? 'seagull' : this.typeId === 'bird' ? 'bird' : this.typeId);
        this.soundTimer = this.rng.range(4, 18);
      }
    } else {
      this.alarm = Math.max(0, this.alarm - dt * 0.4);
      if (this.stateTimer <= 0) this.pickState();
    }

    // --- Flocking ---
    if (this.flock && this.state === 'wander' && this.spec.social > 0.5) {
      const leader = this.flock.leader;
      if (leader && leader !== this) {
        const d = this.position.distanceTo(leader.position);
        if (d > 4) {
          this.target = { x: leader.position.x + this.rng.range(-2, 2), z: leader.position.z + this.rng.range(-2, 2) };
          this.targetSpeed = this.spec.speed * (d > 12 ? 1.7 : 1);
        }
      }
    }

    // --- Move ---
    if (this.target) {
      const dx = this.target.x - this.position.x, dz = this.target.z - this.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.8) {
        this.target = null;
        if (this.state !== 'follow') this.targetSpeed = 0;
      } else {
        this.heading = dampAngle(this.heading, Math.atan2(dx, dz), 0.0006, dt);
      }
    }
    this.speed = damp(this.speed, this.targetSpeed, 0.002, dt);
    this.position.x += Math.sin(this.heading) * this.speed * dt;
    this.position.z += Math.cos(this.heading) * this.speed * dt;

    const ground = this.world.groundAt(this.position.x, this.position.z);
    if (this.spec.fly) {
      const wantFly = this.flying || this.state === 'flee';
      this.flyHeight = damp(this.flyHeight, wantFly ? lerpv(4, 16, clamp01(this.alarm)) : 0, 0.0015, dt);
      if (this.flyHeight < 0.2 && !wantFly) this.flying = false;
      this.position.y = ground + this.flyHeight;
    } else {
      this.position.y = ground;
      this.world.resolveCollision(this.position, 0.3);
    }
    this.group.position.copy(this.position);
    this.group.rotation.y = this.heading;

    this.animate(dt);

    // Idle vocalisations.
    if (this.soundTimer <= 0 && playerPos && this.position.distanceTo(playerPos) < 24 && this.rng.chance(0.4)) {
      audio.animal(this.typeId === 'seagull' ? 'seagull' : this.typeId === 'bird' ? 'bird' : this.typeId);
      this.soundTimer = this.rng.range(8, 45);
    } else if (this.soundTimer <= 0) {
      this.soundTimer = this.rng.range(8, 45);
    }
  }

  pickState() {
    const r = this.rng;
    const night = this.manager.atmosphere ? this.manager.atmosphere.nightFactor : 0;
    if (night > 0.7 && r.chance(0.55) && !this.spec.fly) {
      this.state = 'sleep';
      this.stateTimer = r.range(20, 90);
      this.targetSpeed = 0;
      this.target = null;
      return;
    }
    const roll = r();
    if (this.spec.graze && roll < 0.42) {
      this.state = 'graze'; this.stateTimer = r.range(8, 30); this.targetSpeed = 0; this.target = null;
    } else if (roll < 0.55) {
      this.state = 'idle'; this.stateTimer = r.range(3, 12); this.targetSpeed = 0; this.target = null;
    } else {
      this.state = 'wander';
      this.stateTimer = r.range(5, 20);
      const a = r() * TAU, d = r.range(4, 26);
      this.target = { x: this.position.x + Math.cos(a) * d, z: this.position.z + Math.sin(a) * d };
      this.targetSpeed = this.spec.speed * r.range(0.5, 1.1);
      if (this.spec.fly && r.chance(0.35)) { this.flying = true; this.stateTimer = r.range(4, 12); }
    }
  }

  animate(dt) {
    const moving = this.speed > 0.15;
    const gaitRate = this.spec.hop ? 4.5 : lerpv(4, 9, clamp01(this.speed / this.spec.run));
    if (moving) this.phase += dt * gaitRate * (0.6 + this.speed * 0.35);

    if (this.spec.fly && this.flyHeight > 0.5) {
      // Flap.
      const flap = Math.sin(this.phase * 4) * 0.9;
      if (this.refs.wings) for (const w of this.refs.wings) w.wing.rotation.z = w.side * (0.2 + flap * 0.7);
      for (const l of this.refs.legs) l.pivot.rotation.x = -1.1;
      this.group.rotation.x = -clamp01(this.speed / this.spec.run) * 0.18;
      return;
    }
    if (this.refs.wings) for (const w of this.refs.wings) w.wing.rotation.z = w.side * 0.15;

    if (this.spec.hop && moving) {
      const hop = Math.max(0, Math.sin(this.phase));
      this.group.position.y = this.position.y + hop * 0.22;
      for (const l of this.refs.legs) l.pivot.rotation.x = -hop * 0.9;
    } else {
      for (const l of this.refs.legs) {
        const off = (l.front ? 0 : Math.PI) + (l.side > 0 ? Math.PI : 0);
        l.pivot.rotation.x = moving ? Math.sin(this.phase + off) * 0.62 * clamp01(this.speed / this.spec.speed) : 0;
      }
    }

    // Head: down to graze, up and alert otherwise.
    const headDown = (this.state === 'graze' || this.state === 'sleep') ? 1 : 0;
    const alert = this.alarm;
    if (this.refs.head) {
      this.refs.head.rotation.x = damp(this.refs.head.rotation.x, headDown * 0.85 - alert * 0.2, 0.002, dt);
      this.refs.head.rotation.y = moving ? 0 : Math.sin(this.phase * 0.4) * 0.25;
    }
    // Tail.
    if (this.refs.tail) {
      const wag = this.spec.tail === 'wag' ? Math.sin(this.phase * 3.2) * (0.5 + (this.state === 'follow' ? 0.8 : 0.2)) : Math.sin(this.phase * 1.2) * 0.2;
      this.refs.tail.rotation.y = wag;
      this.refs.tail.rotation.x = this.state === 'flee' ? 0.5 : -0.1;
    }
    if (this.state === 'sleep') {
      this.group.position.y = this.position.y - this.spec.h * 0.28;
      for (const l of this.refs.legs) l.pivot.rotation.x = 1.3;
    }
  }

  dispose() { disposeGroup(this.group); }
  describe() { return this.spec.name + ' — ' + this.state; }
}

export class AnimalManager {
  constructor(world, scene, atmosphere) {
    this.world = world;
    this.scene = scene;
    this.atmosphere = atmosphere;
    this.animals = [];
    this.flocks = [];
    this.rng = makeRng(world.seed ^ 0x3c7e);
    this.spawnTimer = 0;
    this.enabled = true;
    this.densityScale = 1;
  }

  get budget() { return Math.round(settings.preset.animalBudget * this.densityScale); }

  typesFor(x, z) {
    const d = this.world.city.districtAt(x, z);
    if (d === 'forest') return FOREST_ANIMALS;
    if (d === 'countryside' || d === 'suburb') return FARM_ANIMALS.concat(FOREST_ANIMALS);
    if (d === 'beach') return BEACH_ANIMALS;
    if (d === 'park') return PARK_ANIMALS;
    return URBAN_ANIMALS;
  }

  spawnNear(px, pz, minDist, maxDist, forcedType) {
    const r = this.rng;
    const a = r() * TAU, dd = lerpv(minDist, maxDist, Math.sqrt(r()));
    const x = px + Math.cos(a) * dd, z = pz + Math.sin(a) * dd;
    if (Math.abs(x) > 1150 || Math.abs(z) > 1150) return null;
    if (this.world.isWater(x, z)) return null;
    if (this.world.city.isOnRoad(x, z, 2)) return null;
    const pool = this.typesFor(x, z);
    const typeId = forcedType || r.pick(pool);
    const animal = new Animal(this, typeId, x, z);
    this.scene.add(animal.group);
    this.animals.push(animal);

    // Social species arrive in small groups.
    const spec = ANIMAL_TYPES[typeId];
    if (spec.social > 0.6 && r.chance(0.6)) {
      const flock = { leader: animal, members: [animal] };
      this.flocks.push(flock);
      animal.flock = flock;
      const n = r.int(2, spec.fly ? 7 : 4);
      for (let i = 0; i < n && this.animals.length < this.budget; i++) {
        const mx = x + r.range(-4, 4), mz = z + r.range(-4, 4);
        const m = new Animal(this, typeId, mx, mz);
        m.flock = flock;
        flock.members.push(m);
        this.scene.add(m.group);
        this.animals.push(m);
      }
    }
    return animal;
  }

  spawnAt(typeId, x, z) {
    const animal = new Animal(this, typeId, x, z);
    animal.protected = true;
    this.scene.add(animal.group);
    this.animals.push(animal);
    return animal;
  }

  update(dt, playerPos, vehicles) {
    if (!this.enabled) return;
    const keep = Math.min(settings.preset.drawDistance * 0.5, 170);
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      if (a.protected || a.controlled === 'follow') continue;
      if (a.position.distanceTo(playerPos) > keep + 60) {
        a.dispose();
        this.animals.splice(i, 1);
      }
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.animals.length < this.budget) {
      this.spawnTimer = 0.6;
      this.spawnNear(playerPos.x, playerPos.z, 25, keep);
    }
    const threats = vehicles ? vehicles.filter((v) => Math.abs(v.speed) > 2) : null;
    for (const a of this.animals) a.update(dt, playerPos, threats);
    // Keep flock leaders valid.
    for (const f of this.flocks) {
      if (!f.leader || f.leader.disposed) f.leader = f.members.find((m) => this.animals.includes(m)) || null;
    }
  }

  nearest(pos, maxDist) {
    let best = null, bd = maxDist || 12;
    for (const a of this.animals) {
      const d = a.position.distanceTo(pos);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  within(pos, radius) { return this.animals.filter((a) => a.position.distanceTo(pos) <= radius); }

  remove(a) {
    const i = this.animals.indexOf(a);
    if (i >= 0) this.animals.splice(i, 1);
    a.dispose();
  }

  clear() { while (this.animals.length) this.remove(this.animals[0]); this.flocks.length = 0; }
  count() { return this.animals.length; }
}
