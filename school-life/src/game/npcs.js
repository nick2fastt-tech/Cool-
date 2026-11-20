// Students + teachers. Everyone is male (5'9") or female (5'3") with brown hair, a white
// t-shirt, jeans and black shoes. Body parts are instanced (one draw call per part type
// for everybody) and animated procedurally: walking, sitting, writing, talking.
import * as THREE from 'three';
import { BODY, COLORS } from '../config.js';
import * as L from '../world/layout.js';
import { npcRoomForPeriod } from '../core/schedule.js';
import { mulberry32 } from '../engine/textures.js';

const PI = Math.PI;
const SKIN = [0xf1c7a0, 0xe8b88f, 0xd6a073, 0xb57d55, 0x8e5c3c, 0x6b432b, 0xf5d3b6];
const STUDENTS = 48;

function angDiff(a, b) {
  return ((b - a + PI * 3) % (PI * 2)) - PI;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// ------------------------------------------------------------------ rig
class Rig {
  constructor() {
    const o = () => new THREE.Object3D();
    this.root = o();
    this.hips = o(); this.spine = o(); this.chest = o(); this.neck = o(); this.head = o();
    this.shL = o(); this.elL = o(); this.wrL = o();
    this.shR = o(); this.elR = o(); this.wrR = o();
    this.hipL = o(); this.knL = o(); this.anL = o();
    this.hipR = o(); this.knR = o(); this.anR = o();
    this.root.add(this.hips);
    this.hips.position.y = 0.95;
    this.hips.add(this.spine); this.spine.position.y = 0.06;
    this.spine.add(this.chest); this.chest.position.y = 0.2;
    this.chest.add(this.neck); this.neck.position.y = 0.24;
    this.neck.add(this.head); this.head.position.y = 0.07;
    this.chest.add(this.shL); this.shL.position.set(0.19, 0.2, 0);
    this.chest.add(this.shR); this.shR.position.set(-0.19, 0.2, 0);
    this.shL.add(this.elL); this.elL.position.y = -0.28;
    this.shR.add(this.elR); this.elR.position.y = -0.28;
    this.elL.add(this.wrL); this.wrL.position.y = -0.25;
    this.elR.add(this.wrR); this.wrR.position.y = -0.25;
    this.hips.add(this.hipL); this.hipL.position.set(0.095, -0.03, 0);
    this.hips.add(this.hipR); this.hipR.position.set(-0.095, -0.03, 0);
    this.hipL.add(this.knL); this.knL.position.y = -0.43;
    this.hipR.add(this.knR); this.knR.position.y = -0.43;
    this.knL.add(this.anL); this.anL.position.y = -0.41;
    this.knR.add(this.anR); this.anR.position.y = -0.41;
  }
}

// part: [name, node, offset[x,y,z]]
const PART_LIST = [
  ['head', 'head', [0, 0.11, 0]],
  ['hairM', 'head', [0, 0.112, 0]],
  ['hairF', 'head', [0, 0.112, 0]],
  ['neck', 'neck', [0, 0.03, 0]],
  ['torso', 'spine', [0, 0.26, 0]],
  ['pelvis', 'hips', [0, -0.03, 0]],
  ['sleeve', 'shL', [-0.006, -0.05, 0]],
  ['sleeve', 'shR', [0.006, -0.05, 0]],
  ['uarm', 'shL', [0, -0.15, 0]],
  ['uarm', 'shR', [0, -0.15, 0]],
  ['farm', 'elL', [0, -0.12, 0]],
  ['farm', 'elR', [0, -0.12, 0]],
  ['hand', 'wrL', [0, -0.055, 0.005]],
  ['hand', 'wrR', [0, -0.055, 0.005]],
  ['thigh', 'hipL', [0, -0.205, 0]],
  ['thigh', 'hipR', [0, -0.205, 0]],
  ['shin', 'knL', [0, -0.195, 0]],
  ['shin', 'knR', [0, -0.195, 0]],
  ['shoe', 'anL', [0, -0.04, 0.045]],
  ['shoe', 'anR', [0, -0.04, 0.045]],
];

function capsule(r, len, sx = 1, sz = 1) {
  const g = new THREE.CapsuleGeometry(r, len, 3, 8);
  g.scale(sx, 1, sz);
  return g;
}

function makeGeometries() {
  const G = {};
  G.head = new THREE.SphereGeometry(0.1, 20, 14);
  G.head.scale(0.94, 1.17, 1.04);
  // hair: a cap over the top (hairline at the forehead) + the back of the head down to the nape
  const hairCap = (r, front) => {
    const top = new THREE.SphereGeometry(r, 18, 8, 0, PI * 2, 0, PI * front);
    const back = new THREE.SphereGeometry(r * 0.995, 12, 10, PI, PI, 0, PI * 0.7);
    const g = mergeGeo([top, back]);
    g.scale(0.98, 1.12, 1.08);
    return g;
  };
  G.hairM = hairCap(0.107, 0.36);
  // long hair (female): same cap + hair falling down the back past the shoulders
  const back = new THREE.CapsuleGeometry(0.09, 0.22, 3, 10);
  back.scale(1.1, 1, 0.55);
  back.translate(0, -0.16, -0.06);
  const fcap = hairCap(0.109, 0.4);
  G.hairF = mergeGeo([fcap, back]);
  G.neck = new THREE.CylinderGeometry(0.048, 0.052, 0.12, 10);
  // torso: rounded tee shape, wider at the shoulders
  const torso = new THREE.CapsuleGeometry(0.15, 0.26, 4, 14);
  const tp = torso.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const k = 1.18 + Math.max(0, y) * 0.55; // shoulders wider
    tp.setX(i, tp.getX(i) * k);
    tp.setZ(i, tp.getZ(i) * 0.72);
  }
  torso.computeVertexNormals();
  G.torso = torso;
  const pelvis = new THREE.CapsuleGeometry(0.135, 0.07, 3, 12);
  pelvis.scale(1.25, 1, 0.82);
  G.pelvis = pelvis;
  G.sleeve = new THREE.CylinderGeometry(0.058, 0.054, 0.13, 10);
  G.uarm = capsule(0.046, 0.19);
  G.farm = capsule(0.041, 0.17);
  const hand = new THREE.SphereGeometry(0.05, 10, 8);
  hand.scale(0.85, 1.15, 0.5);
  G.hand = hand;
  G.thigh = capsule(0.073, 0.3, 1, 1.05);
  G.shin = capsule(0.058, 0.3, 1, 1.05);
  const shoe = new THREE.CapsuleGeometry(0.05, 0.16, 3, 8);
  shoe.rotateX(PI / 2);
  shoe.scale(1.05, 0.82, 1);
  G.shoe = shoe;
  return G;
}

function mergeGeo(list) {
  let total = 0;
  for (const g of list) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const idx = [];
  let off = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, off * 3);
    nor.set(g.attributes.normal.array, off * 3);
    uv.set(g.attributes.uv.array, off * 2);
    const I = g.index.array;
    for (let i = 0; i < I.length; i++) idx.push(I[i] + off);
    off += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

// ------------------------------------------------------------------ npc
class NPC {
  constructor(i, gender, teacher, rand) {
    this.i = i;
    this.gender = gender;
    this.teacher = teacher;
    this.scale = gender === 'female' ? BODY.female.height / BODY.male.height : 1;
    this.rig = new Rig();
    this.rig.root.scale.setScalar(this.scale);
    this.skin = SKIN[(rand() * SKIN.length) | 0];
    this.x = 0; this.y = 0; this.z = 0;
    this.yaw = 0;
    this.speed = 1.15 + rand() * 0.3;
    this.lane = 0.3 + rand() * 0.6;
    this.state = 'idle';
    this.path = [];
    this.pi = 0;
    this.seat = null;
    this.walkPhase = rand() * PI * 2;
    this.walk = 0;
    this.sit = 0;
    this.t = rand() * 100;
    this.wait = 0;
    this.blockT = 0;
    this.ghost = 0;
    this.lookYaw = 0;
    this.lookTarget = 0;
    this.lookTimer = rand() * 4;
    this.gesture = 0;
    this.write = rand() < 0.6;
    this.visible = true;
    this.zone = 'corridor';
    this.sitFrom = null;
    this.sitT = 0;
    this.room = null;
    this.wanderT = 0;
    this.rand = rand;
  }
}

export class NPCs {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.physics = world.physics;
    this.doors = world.doors;
    const rand = mulberry32(777);
    this.rand = rand;
    this.list = [];
    for (let i = 0; i < STUDENTS; i++) this.list.push(new NPC(i, rand() < 0.5 ? 'male' : 'female', false, rand));
    this.teachers = world.teachers.map((t, k) => {
      const n = new NPC(STUDENTS + k, k % 2 ? 'female' : 'male', true, rand);
      n.spot = t;
      n.room = t.room;
      n.speed = 0.85;
      return n;
    });
    this.all = this.list.concat(this.teachers);
    this.seatsByRoom = {};
    for (const s of world.seats) (this.seatsByRoom[s.room] = this.seatsByRoom[s.room] || []).push(s);
    this._m = new THREE.Matrix4();
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this._pos = [];
    this.buildMeshes();
    this.period = -1;
  }

  buildMeshes() {
    const T = this.world.T;
    const G = makeGeometries();
    const std = (p) => new THREE.MeshStandardMaterial(p);
    const skin = std({ color: 0xffffff, roughness: 0.62 });
    const face = std({ color: 0xffffff, roughness: 0.6, map: T.face() });
    const hair = std({ color: COLORS.hair, roughness: 0.75, map: T.get('hair').map });
    const shirt = std({ color: COLORS.shirt, roughness: 0.85 });
    const jeans = std({ color: COLORS.jeans, roughness: 0.9, map: T.get('denim').map });
    const shoes = std({ color: COLORS.shoes, roughness: 0.38 });
    const mats = { head: face, hairM: hair, hairF: hair, neck: skin, torso: shirt, pelvis: jeans, sleeve: shirt, uarm: skin, farm: skin, hand: skin, thigh: jeans, shin: jeans, shoe: shoes };
    for (const k of Object.keys(mats)) mats[k].name = 'npc_' + k;
    const counts = {};
    for (const [name] of PART_LIST) counts[name] = (counts[name] || 0) + 1;
    const N = this.all.length;
    this.meshes = {};
    this.slots = []; // per part entry: {mesh, perNpc, k}
    const used = {};
    for (const [name, node, off] of PART_LIST) {
      if (!this.meshes[name]) {
        const im = new THREE.InstancedMesh(G[name], mats[name], counts[name] * N);
        im.frustumCulled = false;
        im.castShadow = false;
        im.receiveShadow = true;
        im.name = 'npc:' + name;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(im);
        this.meshes[name] = im;
        used[name] = 0;
      }
      this.slots.push({ name, node, mesh: this.meshes[name], k: used[name]++, per: counts[name], off: new THREE.Matrix4().makeTranslation(off[0], off[1], off[2]) });
    }
    // skin tones (written per visible slot, see update())
    this._col = new THREE.Color(0xffffff);
    for (const s of this.slots) {
      s.skin = ['head', 'neck', 'uarm', 'farm', 'hand'].includes(s.name);
      if (s.skin) for (let i = 0; i < s.mesh.count; i++) s.mesh.setColorAt(i, this._col);
    }
    this.skinMeshes = ['head', 'neck', 'uarm', 'farm', 'hand'].map((n) => this.meshes[n]);
    this.visKey = '';
    // blob shadows
    const blobGeo = new THREE.PlaneGeometry(0.75, 0.75).rotateX(-PI / 2);
    this.blobs = new THREE.InstancedMesh(blobGeo, this.world.M.shadowBlob, N);
    this.blobs.frustumCulled = false;
    this.blobs.renderOrder = 1;
    this.blobs.name = 'npc:blobs';
    this.scene.add(this.blobs);
    this.hideAll();
  }

  hideAll() {
    for (const n of this.all) n.visible = false;
    for (const m of Object.values(this.meshes)) m.count = 0;
    this.blobs.count = 0;
    this.visKey = '';
  }

  actorPositions() {
    const a = this._pos;
    a.length = 0;
    for (const n of this.all) if (n.state === 'walk' || n.state === 'pace') a.push(n);
    return a;
  }

  // ---------------------------------------------------------------- routing
  doorPts(room) {
    const d = this.doors.forRoom(room);
    const p = L.doorPoints(room);
    return { door: d, out: { x: p.out.x, z: p.out.z, door: d }, in: { x: p.in.x, z: p.in.z, door: d } };
  }

  /** Points from a seat back out to the room's door (outside), reversed seat path. */
  leaveSeatPath(seat) {
    const pts = [{ x: seat.ax, z: seat.az }];
    for (let i = seat.path.length - 2; i >= 1; i--) pts.push({ x: seat.path[i].x, z: seat.path[i].z });
    const dp = this.doorPts(seat.room);
    pts.push(dp.in, dp.out);
    return pts;
  }

  corridorPath(from, to, lane) {
    const east = to.x > from.x;
    const z = east ? lane : -lane;
    return [{ x: from.x + (east ? 0.6 : -0.6), z }, { x: to.x + (east ? -0.6 : 0.6), z }];
  }

  enterSeatPath(seat) {
    const dp = this.doorPts(seat.room);
    const pts = [dp.out, dp.in];
    for (let i = 1; i < seat.path.length; i++) pts.push({ x: seat.path[i].x, z: seat.path[i].z });
    return pts;
  }

  pickSeat(room, n) {
    const free = (this.seatsByRoom[room] || []).filter((s) => !s.occupant);
    if (!free.length) return null;
    // classrooms: fill from the front rows first, a little randomness
    free.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const idx = Math.floor(Math.pow(n.rand(), 1.6) * Math.min(free.length, 14));
    return free[Math.min(idx, free.length - 1)];
  }

  wanderTarget(n) {
    const r = n.rand();
    if (r < 0.55) {
      const x = 2 + n.rand() * 56;
      return { x, z: n.rand() < 0.5 ? -1.0 : 1.0, idle: 3 + n.rand() * 6, face: n.rand() < 0.5 ? 0 : PI };
    }
    if (r < 0.8) return { x: 24 + n.rand() * 6, z: 7 + n.rand() * 10, idle: 4 + n.rand() * 6, face: n.rand() * PI * 2, lobby: true };
    return { x: 33.2 + (n.rand() - 0.5) * 0.3, z: -1.0, idle: 3, face: 0 };
  }

  pathToHall(n) {
    // from wherever n is to the corridor lane
    if (n.seat) return this.leaveSeatPath(n.seat);
    const z = L.zoneAt(n.x, n.y + 0.5, n.z);
    if (z === 'lobby') return [{ x: Math.min(Math.max(n.x, 23.2), 30.8), z: Math.min(n.z, 15) }, { x: 26, z: 2.6 }, { x: 26, z: 0.6 }];
    return [];
  }

  routeTo(n, dest, seat = null) {
    const pts = this.pathToHall(n);
    const start = pts.length ? pts[pts.length - 1] : { x: n.x, z: n.z };
    let tail;
    if (seat) tail = this.enterSeatPath(seat);
    else if (dest.lobby) tail = [{ x: 26, z: 0.6 }, { x: 26, z: 2.8 }, { x: dest.x, z: dest.z }];
    else tail = [{ x: dest.x, z: dest.z }];
    const first = tail[0];
    const hall = this.corridorPath(start, first, n.lane);
    return pts.concat(hall, tail);
  }

  // ---------------------------------------------------------------- lifecycle
  reset(now, periodIndex) {
    for (const s of this.world.seats) if (s.occupant && s.occupant !== 'player') s.occupant = null;
    this.period = periodIndex;
    for (const n of this.list) {
      n.seat = null;
      n.path = [];
      n.sit = 0;
      n.walk = 0;
      const role = this.roleFor(n, periodIndex);
      if (role.wander) {
        const t = this.wanderTarget(n);
        this.place(n, t.x, t.z, t.face);
        n.state = 'idle';
        n.wait = n.rand() * 5;
      } else {
        const seat = this.pickSeat(role.room, n);
        if (!seat) {
          const t = this.wanderTarget(n);
          this.place(n, t.x, t.z, t.face);
          n.state = 'idle';
          continue;
        }
        seat.occupant = n;
        n.seat = seat;
        this.place(n, seat.x, seat.z, seat.yaw + PI, seat.y);
        n.state = 'seated';
        n.sit = 1;
      }
    }
    for (const t of this.teachers) {
      t.state = 'pace';
      t.pi = 0;
      this.place(t, t.spot.x, t.spot.z, t.spot.yaw + PI);
      t.wait = 1 + t.rand() * 3;
      t.paceIdx = 0;
    }
  }

  roleFor(n, periodIndex) {
    // 4 students per period roam the halls instead of going to class, each from a different room
    if (this.wanderSet(periodIndex).has(n.i)) return { wander: true };
    return { room: npcRoomForPeriod(n.i, periodIndex) };
  }

  wanderSet(p) {
    this._wander = this._wander || new Map();
    if (!this._wander.has(p)) {
      const set = new Set();
      for (let r = 0; r < 4; r++) {
        const t = (r + p) % 6;
        for (let i = r * 12; i < r * 12 + 12; i++) {
          if ((i + p * 5) % 6 === t) { set.add(i); break; }
        }
      }
      this._wander.set(p, set);
    }
    return this._wander.get(p);
  }

  place(n, x, z, yaw, y = null) {
    n.x = x;
    n.z = z;
    n.y = y !== null ? y : this.physics.groundAt(x, z, 0.5) || 0;
    n.yaw = yaw;
  }

  onPeriodChange(now, periodIndex) {
    this.period = periodIndex;
    let k = 0;
    for (const n of this.list) {
      const role = this.roleFor(n, periodIndex);
      const delay = 0.3 + (k++ % 9) * 0.35 + n.rand() * 1.5;
      n.pending = { role, delay };
    }
  }

  startTrip(n, role) {
    if (n.seat && n.seat.occupant === n) n.seat.occupant = null;
    const prevSeat = n.seat;
    let seat = null;
    let dest = null;
    if (!role.wander) {
      seat = this.pickSeat(role.room, n);
      if (seat) seat.occupant = n;
    }
    if (!seat) dest = this.wanderTarget(n);
    n.seat = prevSeat;
    const path = this.routeTo(n, dest, seat);
    n.seat = seat;
    n.target = dest;
    n.path = path;
    n.pi = 0;
    if (n.sit > 0.01) {
      n.state = 'standing';
      n.sitT = 0;
      n.sitFrom = { x: n.x, z: n.z, y: n.y };
    } else n.state = 'walk';
  }

  /** The player sat in a seat this NPC wanted: pick another one. */
  seatTaken(seat) {
    for (const n of this.list) {
      if (n.seat === seat && n.state !== 'seated') {
        const s2 = this.pickSeat(seat.room, n);
        n.seat = s2;
        if (s2) {
          s2.occupant = n;
          n.path = this.enterSeatPath(s2).slice(1);
          n.pi = 0;
          n.state = 'walk';
        } else {
          n.target = this.wanderTarget(n);
          n.path = this.routeTo(n, n.target, null);
          n.pi = 0;
          n.state = 'walk';
        }
      }
    }
  }

  teacherTalk(room) {
    const t = this.teachers.find((x) => x.room === room);
    if (t) t.gesture = 1.6;
  }

  /** Push a circle (the player) out of standing/walking NPCs. */
  pushOut(pos, radius) {
    for (const n of this.all) {
      if (n.state === 'seated' || !n.visible) continue;
      const dx = pos.x - n.x, dz = pos.z - n.z;
      const r = radius + 0.22 * n.scale;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-6 && Math.abs(pos.y - n.y) < 1.2) {
        const d = Math.sqrt(d2);
        pos.x = n.x + (dx / d) * r;
        pos.z = n.z + (dz / d) * r;
      }
    }
  }

  // ---------------------------------------------------------------- update
  update(dt, now, player, vis) {
    for (const n of this.list) this.think(n, dt, player);
    for (const t of this.teachers) this.thinkTeacher(t, dt, player);
    // render: pack the visible people into the first instance slots
    let j = 0;
    let key = '';
    for (const n of this.all) {
      n.zone = L.zoneAt(n.x, n.y + 0.5, n.z);
      const zn = n.zone === 'office' ? 'r106' : n.zone;
      n.visible = vis ? !!vis[zn] : true;
      if (!n.visible) continue;
      this.pose(n, dt);
      this.writeMatrices(n, j);
      key += n.i + ',';
      j++;
    }
    if (key !== this.visKey) {
      this.visKey = key;
      let k = 0;
      for (const n of this.all) {
        if (!n.visible) continue;
        this._col.setHex(n.skin);
        for (const s of this.slots) if (s.skin) s.mesh.setColorAt(k * s.per + s.k, this._col);
        k++;
      }
      for (const m of this.skinMeshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    for (const s of this.slots) s.mesh.count = j * s.per;
    this.blobs.count = j;
    for (const m of Object.values(this.meshes)) m.instanceMatrix.needsUpdate = true;
    this.blobs.instanceMatrix.needsUpdate = true;
    if (player) this.pushOut(player.pos, player.radius);
  }

  think(n, dt, player) {
    n.t += dt;
    if (n.pending) {
      n.pending.delay -= dt;
      if (n.pending.delay <= 0) {
        const r = n.pending.role;
        n.pending = null;
        this.startTrip(n, r);
      }
    }
    switch (n.state) {
      case 'seated':
        n.sit = 1;
        n.walk = Math.max(0, n.walk - dt * 4);
        break;
      case 'standing': {
        n.sitT += dt / 0.7;
        n.sit = 1 - smooth(Math.min(1, n.sitT));
        const s = n.sitFrom;
        const tx = n.path[0] ? n.path[0].x : n.x;
        const tz = n.path[0] ? n.path[0].z : n.z;
        const k = smooth(Math.min(1, n.sitT));
        if (s) {
          n.x = s.x + (tx - s.x) * k;
          n.z = s.z + (tz - s.z) * k;
        }
        if (n.sitT >= 1) {
          n.sitFrom = null;
          n.sit = 0;
          n.state = 'walk';
          n.pi = Math.min(1, n.path.length - 1);
        }
        n.y = this.physics.groundAt(n.x, n.z, n.y + 0.3) ?? n.y;
        break;
      }
      case 'walk':
        this.walkAlong(n, dt, player);
        break;
      case 'sitting': {
        n.sitT += dt / 0.8;
        const k = smooth(Math.min(1, n.sitT));
        n.sit = k;
        n.walk = Math.max(0, n.walk - dt * 5);
        const s = n.seat;
        n.x = n.sitFrom.x + (s.x - n.sitFrom.x) * k;
        n.z = n.sitFrom.z + (s.z - n.sitFrom.z) * k;
        n.y = n.sitFrom.y + (s.y - n.sitFrom.y) * k;
        const want = s.yaw + PI;
        n.yaw += angDiff(n.yaw, want) * Math.min(1, dt * 8);
        if (n.sitT >= 1) {
          n.state = 'seated';
          n.sitFrom = null;
          n.yaw = want;
        }
        break;
      }
      case 'idle':
        n.walk = Math.max(0, n.walk - dt * 4);
        n.wait -= dt;
        if (n.target && n.target.face !== undefined) n.yaw += angDiff(n.yaw, n.target.face) * Math.min(1, dt * 3);
        if (n.wait <= 0 && !n.seat && !n.pending) {
          n.target = this.wanderTarget(n);
          n.path = this.routeTo(n, n.target, null);
          n.pi = 0;
          n.state = 'walk';
        }
        break;
      default:
        break;
    }
  }

  walkAlong(n, dt, player) {
    const pt = n.path[n.pi];
    if (!pt) {
      this.arrive(n);
      return;
    }
    if (pt.door && this.doors.isOpen(pt.door) === false) {
      const ddx = pt.x - n.x, ddz = pt.z - n.z;
      if (ddx * ddx + ddz * ddz < 4.5) this.doors.open(pt.door, 'npc');
    }
    // open any door we are about to pass through
    const nx = n.path[n.pi + 1];
    if (nx && nx.door && !this.doors.isOpen(nx.door)) {
      const ddx = nx.x - n.x, ddz = nx.z - n.z;
      if (ddx * ddx + ddz * ddz < 6) this.doors.open(nx.door, 'npc');
    }
    let dx = pt.x - n.x, dz = pt.z - n.z;
    const dist = Math.hypot(dx, dz);
    const reach = n.pi === n.path.length - 1 ? 0.06 : 0.35;
    if (dist < reach) {
      n.pi++;
      if (n.pi >= n.path.length) this.arrive(n);
      return;
    }
    dx /= dist;
    dz /= dist;
    // wait for doors to swing open
    let blocked = false;
    if (pt.door && pt.door.t < 0.85 && dist < 1.4) blocked = true;
    // don't walk into the player
    if (player && n.ghost <= 0) {
      const px = player.pos.x - n.x, pz = player.pos.z - n.z;
      const pd = Math.hypot(px, pz);
      if (pd < 0.85 && (px * dx + pz * dz) / Math.max(pd, 1e-3) > 0.3 && Math.abs(player.pos.y - n.y) < 1.2) blocked = true;
    }
    // keep a little distance from the person in front
    if (!blocked && n.ghost <= 0) {
      for (const o of this.list) {
        if (o === n || o.state !== 'walk' && o.state !== 'idle') continue;
        const ox = o.x - n.x, oz = o.z - n.z;
        const od2 = ox * ox + oz * oz;
        if (od2 > 0.42 || od2 < 1e-6) continue;
        const od = Math.sqrt(od2);
        if ((ox * dx + oz * dz) / od > 0.55) {
          blocked = true;
          break;
        }
      }
    }
    if (blocked) {
      n.blockT += dt;
      if (n.blockT > 1.4) {
        n.ghost = 1.2;
        n.blockT = 0;
      }
    } else n.blockT = 0;
    if (n.ghost > 0) n.ghost -= dt;
    const target = blocked ? 0 : n.speed * (n.pi === n.path.length - 1 && dist < 0.8 ? 0.6 : 1);
    n.curSpeed = (n.curSpeed || 0) + (target - (n.curSpeed || 0)) * Math.min(1, dt * 6);
    const step = Math.min(dist, n.curSpeed * dt);
    n.x += dx * step;
    n.z += dz * step;
    const gy = this.physics.groundAt(n.x, n.z, n.y + 0.3);
    if (gy !== null) n.y += (gy - n.y) * Math.min(1, dt * 14);
    n.walkPhase += (step / (0.62 * n.scale)) * PI;
    n.walk += ((n.curSpeed > 0.15 ? 1 : 0) - n.walk) * Math.min(1, dt * 6);
    const want = Math.atan2(dx, dz);
    n.yaw += angDiff(n.yaw, want) * Math.min(1, dt * 7);
  }

  arrive(n) {
    if (n.seat && n.seat.occupant === n) {
      n.state = 'sitting';
      n.sitT = 0;
      n.sitFrom = { x: n.x, z: n.z, y: n.y };
      return;
    }
    if (n.seat && n.seat.occupant !== n) {
      // someone took our seat on the way
      const s2 = this.pickSeat(n.seat.room, n);
      n.seat = s2;
      if (s2) {
        s2.occupant = n;
        n.path = s2.path.slice(1).map((p) => ({ x: p.x, z: p.z }));
        n.pi = 0;
        return;
      }
    }
    n.seat = null;
    n.state = 'idle';
    n.wait = n.target ? n.target.idle || 4 : 4;
  }

  thinkTeacher(t, dt) {
    t.t += dt;
    t.gesture = Math.max(0, t.gesture - dt);
    const sp = t.spot;
    if (t.wait > 0) {
      t.wait -= dt;
      t.walk = Math.max(0, t.walk - dt * 4);
      const want = sp.yaw + PI;
      t.yaw += angDiff(t.yaw, want) * Math.min(1, dt * 4);
      if (t.wait <= 0) {
        t.paceIdx = (t.paceIdx + 1) % sp.pace.length;
      }
      return;
    }
    const p = sp.pace[t.paceIdx];
    const dx = p.x - t.x, dz = p.z - t.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) {
      t.wait = 2.5 + t.rand() * 4;
      return;
    }
    const step = Math.min(d, t.speed * dt);
    t.x += (dx / d) * step;
    t.z += (dz / d) * step;
    t.walkPhase += (step / (0.6 * t.scale)) * PI;
    t.walk += (1 - t.walk) * Math.min(1, dt * 5);
    t.yaw += angDiff(t.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
    const gy = this.physics.groundAt(t.x, t.z, t.y + 0.3);
    if (gy !== null) t.y = gy;
  }

  // ---------------------------------------------------------------- animation
  pose(n, dt) {
    const R = n.rig;
    const w = n.walk;
    const s = n.sit;
    const ph = n.walkPhase;
    const sinP = Math.sin(ph);
    const cosP = Math.cos(ph);
    // head look-around
    n.lookTimer -= dt;
    if (n.lookTimer <= 0) {
      n.lookTimer = 2 + n.rand() * 5;
      n.lookTarget = (n.rand() - 0.5) * (n.state === 'seated' ? 0.9 : 0.6);
    }
    n.lookYaw += (n.lookTarget - n.lookYaw) * Math.min(1, dt * 2.5);
    const breathe = Math.sin(n.t * 1.7) * 0.015;
    // legs (walk)
    const A = 0.5 * w;
    const kneeL = 0.06 + 0.95 * w * Math.pow(Math.max(0, cosP), 1.6);
    const kneeR = 0.06 + 0.95 * w * Math.pow(Math.max(0, -cosP), 1.6);
    const thL = -A * sinP, thR = A * sinP;
    // sitting legs
    const sThigh = n.seat && n.seat.type === 'beanbag' ? -1.25 : -1.5;
    const sKnee = n.seat && n.seat.type === 'beanbag' ? 1.0 : 1.45;
    R.hipL.rotation.set(thL * (1 - s) + sThigh * s, 0, 0.03 * (1 - s));
    R.hipR.rotation.set(thR * (1 - s) + sThigh * s, 0, -0.03 * (1 - s));
    R.knL.rotation.x = kneeL * (1 - s) + sKnee * s;
    R.knR.rotation.x = kneeR * (1 - s) + sKnee * s;
    R.anL.rotation.x = (-(thL + kneeL) * 0.35) * (1 - s) + (-0.05) * s;
    R.anR.rotation.x = (-(thR + kneeR) * 0.35) * (1 - s) + (-0.05) * s;
    // hips + torso
    const seatH = n.seat ? n.seat.seatH : 0.47;
    const standY = 0.95 + 0.022 * w * Math.cos(2 * ph) + breathe * 0.3;
    const sitLocal = (seatH + 0.09) / n.scale;
    R.hips.position.y = standY * (1 - s) + sitLocal * s;
    R.hips.position.z = -0.06 * s;
    R.hips.rotation.set(0, 0.07 * sinP * w, 0.035 * sinP * w);
    const lean = n.seat ? (n.seat.type === 'sofa' || n.seat.type === 'armchair' || n.seat.type === 'beanbag' ? -0.12 : n.seat.type === 'aud' ? -0.06 : 0.1) : 0;
    R.spine.rotation.set(0.05 * w + lean * s + breathe, -0.1 * sinP * w, 0);
    R.chest.rotation.set(breathe * 0.5, 0, 0);
    // arms
    const armSw = 0.42 * w;
    let shLx = armSw * sinP, shRx = -armSw * sinP;
    let elL = -0.22 - 0.25 * w * Math.max(0, -sinP), elR = -0.22 - 0.25 * w * Math.max(0, sinP);
    let shLz = 0.07, shRz = -0.07;
    if (s > 0) {
      const desk = n.seat && (n.seat.type === 'desk' || n.seat.type === 'stool' || n.seat.type === 'chair');
      const tsx = desk ? -0.62 : -0.25;
      const tel = desk ? -1.05 : -0.8;
      const wr = desk && n.write ? Math.sin(n.t * 7) * 0.06 : 0;
      shLx = shLx * (1 - s) + tsx * s;
      shRx = shRx * (1 - s) + (tsx + wr) * s;
      elL = elL * (1 - s) + tel * s;
      elR = elR * (1 - s) + (tel - wr) * s;
      shLz = 0.07 * (1 - s) + -0.05 * s;
      shRz = -0.07 * (1 - s) + 0.05 * s;
    }
    if (n.teacher && n.gesture > 0) {
      const g = Math.min(1, n.gesture / 0.4, (1.6 - n.gesture) / 0.3 + 0.0001);
      const gg = Math.max(0, Math.min(1, g));
      shRx = shRx * (1 - gg) + (-1.15 + Math.sin(n.t * 5) * 0.12) * gg;
      shRz = shRz * (1 - gg) + -0.35 * gg;
      elR = elR * (1 - gg) + -0.55 * gg;
    }
    R.shL.rotation.set(shLx, 0, shLz);
    R.shR.rotation.set(shRx, 0, shRz);
    R.elL.rotation.x = elL;
    R.elR.rotation.x = elR;
    R.wrL.rotation.x = 0.1;
    R.wrR.rotation.x = 0.1;
    // head
    const headDown = n.state === 'seated' && n.write ? 0.22 + Math.sin(n.t * 0.6) * 0.08 : 0;
    R.neck.rotation.set(headDown * 0.5, n.lookYaw * 0.4, 0);
    R.head.rotation.set(headDown * 0.5 - 0.02 * w, n.lookYaw * 0.6 - 0.07 * sinP * w, 0);
    // root
    R.root.position.set(n.x, n.y, n.z);
    R.root.rotation.set(0, n.yaw, 0);
  }

  writeMatrices(n, slot) {
    const R = n.rig;
    R.root.updateMatrixWorld(true);
    const m = this._m;
    const base = slot;
    for (const s of this.slots) {
      if ((s.name === 'hairM' && n.gender === 'female') || (s.name === 'hairF' && n.gender === 'male')) {
        s.mesh.setMatrixAt(base * s.per + s.k, this._zero);
        continue;
      }
      m.multiplyMatrices(R[s.node].matrixWorld, s.off);
      s.mesh.setMatrixAt(base * s.per + s.k, m);
    }
    m.makeScale(n.scale * (1 - n.sit * 0.2), 1, n.scale * (1 - n.sit * 0.2));
    m.setPosition(n.x, n.y + 0.012, n.z);
    this.blobs.setMatrixAt(slot, m);
  }
}
