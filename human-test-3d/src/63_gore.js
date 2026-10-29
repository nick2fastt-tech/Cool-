// ============================================================================
// GORE: bind-space wounds (drawn by the character shader), blood droplets and
// mist, instanced blood decals (procedural splatter atlas), growing pools, gibs,
// dismemberment (skin-weight split + stump caps + ragdoll joint break), head
// explosions, bleeding out and screen blood.
// Settings.gore.level: 'off' | 'normal' | 'extreme'
// ============================================================================
const WOUND = { ENTRY: 1, EXIT: 2, SLASH: 3, BITE: 4, STUMP: 5, GAPING: 6, SMEAR: 7, BLAST: 8 };
const MAX_WOUNDS = 16;
const RAG_PARENT = [-1, 0, 1, 2, 2, 4, 5, 2, 7, 8, 0, 10, 11, 0, 13, 14];
const BONE_CHILDREN = BONE_NAMES.map(() => []);
BONE_PARENT.forEach((p, i) => { if (p >= 0) BONE_CHILDREN[p].push(i); });
function boneSubtree(b) {
  const out = new Uint8Array(NUM_BONES), st = [b];
  while (st.length) { const x = st.pop(); out[x] = 1; for (const c of BONE_CHILDREN[x]) st.push(c); }
  return out;
}
function ragSubtree(r) {
  const out = [];
  for (let i = 0; i < RAG_COUNT; i++) { let k = i; while (k >= 0 && k !== r) k = RAG_PARENT[k]; if (k === r) out.push(i); }
  return out;
}
// cut id -> root bone of the removed part, ragdoll joint, parent/child body, regions removed, side (0 L, 1 R, -1 centre)
const GORE_CUTS = {};
[
  ['head', B.head, 2, RAG.CHEST, RAG.HEAD, [0], -1],
  ['armL', B.upperarm_L, 3, RAG.CHEST, RAG.UARM_L, [6, 7, 8], 0], ['forearmL', B.forearm_L, 4, RAG.UARM_L, RAG.FARM_L, [7, 8], 0], ['handL', B.hand_L, 5, RAG.FARM_L, RAG.HAND_L, [8], 0],
  ['legL', B.thigh_L, 6, RAG.PELVIS, RAG.THIGH_L, [12, 13, 14], 0], ['shinL', B.shin_L, 7, RAG.THIGH_L, RAG.SHIN_L, [13, 14], 0], ['footL', B.foot_L, 8, RAG.SHIN_L, RAG.FOOT_L, [14], 0],
  ['armR', B.upperarm_R, 9, RAG.CHEST, RAG.UARM_R, [9, 10, 11], 1], ['forearmR', B.forearm_R, 10, RAG.UARM_R, RAG.FARM_R, [10, 11], 1], ['handR', B.hand_R, 11, RAG.FARM_R, RAG.HAND_R, [11], 1],
  ['legR', B.thigh_R, 12, RAG.PELVIS, RAG.THIGH_R, [15, 16, 17], 1], ['shinR', B.shin_R, 13, RAG.THIGH_R, RAG.SHIN_R, [16, 17], 1], ['footR', B.foot_R, 14, RAG.SHIN_R, RAG.FOOT_R, [17], 1]
].forEach(([id, bone, joint, rp, rc, regions, side]) => {
  GORE_CUTS[id] = { id, bone, joint, rp, rc, regions, side, sub: boneSubtree(bone), ragSub: ragSubtree(rc), isLeg: id.startsWith('leg') || id.startsWith('shin') || id.startsWith('foot'), isArm: id.startsWith('arm') || id.startsWith('forearm') || id.startsWith('hand') };
});
const REGION_CUT = ['head', 'head', null, null, null, null, 'armL', 'forearmL', 'handL', 'armR', 'forearmR', 'handR', 'legL', 'shinL', 'footL', 'legR', 'shinR', 'footR'];
const LIMB_CUTS = ['armL', 'armR', 'legL', 'legR', 'forearmL', 'forearmR', 'shinL', 'shinR', 'handL', 'handR', 'footL', 'footR'];
const _gv1 = new V3(), _gv2 = new V3(), _gv3 = new V3(), _gv4 = new V3(), _gv5 = new V3(), _gv6 = new V3(), _gv7 = new V3(), _gq1 = new QT();

// --- per-NPC gore state -----------------------------------------------------------------
class NPCGore {
  constructor(npc) {
    this.npc = npc; this.wounds = []; this.cuts = {}; this.headGone = false; this.anyCut = false;
    this.boneDetached = new Uint8Array(NUM_BONES); this.detachRoot = new Uint8Array(NUM_BONES);
    this.gone = null; this.capLoops = []; this.capMesh = null;
    this.bleed = 0; this.blood = 0; this.pool = null; this.spurts = []; this.dripT = 0;
    this.lostLegs = 0; this.lostArms = 0; this.dirty = true; this.gaping = null; this.feedT = 0;
  }
}

// --- procedural blood splatter atlas (4x4 tiles: splats, sprays, pools, drops) ----------
function makeBloodAtlas() {
  const S = 1024, T = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const rng = new RNG(9001);
  g.clearRect(0, 0, S, S);
  const blob = (cx, cy, r, irr, shade, a, n = 34) => {
    const ph = rng.next() * 10, ph2 = rng.next() * 10;
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n * TAU;
      const rr = r * (1 + irr * (Math.sin(t * 3 + ph) * 0.45 + Math.sin(t * 7 + ph2) * 0.3 + Math.sin(t * 13 + ph) * 0.15));
      const x = cx + Math.cos(t) * rr, y = cy + Math.sin(t) * rr;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath(); g.fillStyle = `rgba(${shade},${shade},${shade},${a})`; g.fill();
  };
  const ell = (cx, cy, rx, ry, ang, shade, a) => {
    g.save(); g.translate(cx, cy); g.rotate(ang); g.beginPath(); g.ellipse(0, 0, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, TAU);
    g.fillStyle = `rgba(${shade},${shade},${shade},${a})`; g.fill(); g.restore();
  };
  for (let tile = 0; tile < 16; tile++) {
    const ox = (tile % 4) * T, oy = Math.floor(tile / 4) * T, cx = ox + T / 2, cy = oy + T / 2;
    g.save(); g.beginPath(); g.rect(ox + 6, oy + 6, T - 12, T - 12); g.clip();
    if (tile < 4) { // splat: core + satellites + streaks
      const r = 46 + rng.next() * 18;
      blob(cx, cy, r * 1.06, 0.3, 235, 0.55); blob(cx, cy, r, 0.28, 220, 1); blob(cx + 4, cy - 3, r * 0.55, 0.3, 150, 0.8);
      const nSat = 14 + rng.int(0, 10);
      for (let i = 0; i < nSat; i++) {
        const a = rng.next() * TAU, d = r * (1.0 + rng.next() * 1.6), sr = 2 + rng.next() * 9 * (1.6 - d / (r * 2.6));
        ell(cx + Math.cos(a) * d, cy + Math.sin(a) * d, sr * (1 + rng.next() * 1.4), sr, a, 210, 0.95);
      }
      for (let i = 0; i < 6; i++) { const a = rng.next() * TAU, d = r * 0.9; ell(cx + Math.cos(a) * d * 1.25, cy + Math.sin(a) * d * 1.25, r * 0.5, 3 + rng.next() * 4, a, 215, 0.9); }
    } else if (tile < 8) { // directional spray toward +x
      const y0 = cy;
      blob(ox + 46, y0, 28 + rng.next() * 8, 0.3, 200, 1);
      for (let i = 0; i < 70; i++) {
        const u = Math.pow(rng.next(), 0.8), x = ox + 50 + u * (T - 70);
        const spread = (rng.next() - 0.5) * (18 + u * 110);
        const sz = (1 - u) * 9 + 1.5 + rng.next() * 3;
        ell(x, y0 + spread, sz * (1.6 + u * 2.4), sz, Math.atan2(spread, 60 + u * 80) * 0.6, 205, 0.95);
      }
      for (let i = 0; i < 5; i++) { const sp = (rng.next() - 0.5) * 50; ell(ox + 95, y0 + sp, 55 + rng.next() * 30, 3 + rng.next() * 3, sp * 0.004, 210, 0.9); }
    } else if (tile < 12) { // pool: big smooth blob, darker core, glossy rim
      const r = 92 + rng.next() * 14;
      blob(cx, cy, r * 1.05, 0.14, 230, 0.45, 48); blob(cx, cy, r, 0.12, 205, 1, 48);
      blob(cx - 6, cy + 4, r * 0.75, 0.12, 150, 0.7, 40); blob(cx + 3, cy - 2, r * 0.45, 0.15, 120, 0.6, 32);
      for (let i = 0; i < 5; i++) { const a = rng.next() * TAU; blob(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85, r * (0.18 + rng.next() * 0.15), 0.25, 205, 1, 20); }
    } else { // drops / small clusters / smear
      const nD = 6 + rng.int(0, 9);
      for (let i = 0; i < nD; i++) {
        const a = rng.next() * TAU, d = rng.next() * 70, sr = 6 + rng.next() * 18;
        blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, sr, 0.25, 205 - rng.next() * 40, 1, 20);
      }
      if (tile === 15) { for (let i = 0; i < 4; i++) ell(cx, cy + (i - 1.5) * 22, 90, 7 + rng.next() * 5, (rng.next() - 0.5) * 0.15, 190, 0.85); }
    }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

// --- instanced blood decals ---------------------------------------------------------------
const DECAL_TILES = { splat: [0, 4], spray: [4, 4], pool: [8, 4], drop: [12, 4] };
class BloodDecals {
  constructor(game, max) {
    this.game = game; this.max = max; this.next = 0; this.used = 0;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.aTile = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.aBirth = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    geo.setAttribute('aTile', this.aTile); geo.setAttribute('aBirth', this.aBirth);
    this.uTime = { value: 0 };
    const mat = new THREE.MeshStandardMaterial({ map: makeBloodAtlas(), color: 0x5a0807, roughness: 0.15, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aTile; attribute float aBirth; uniform float uTime; varying float vAge;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vMapUv * 0.25 + vec2(mod(aTile, 4.0), 3.0 - floor(aTile / 4.0)) * 0.25;\n#endif\n vAge = uTime - aBirth;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAge;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float htDry = smoothstep(6.0, 80.0, vAge);
          diffuseColor.rgb *= mix(vec3(1.0), vec3(0.5, 0.42, 0.42), htDry);
          float htMin = max(length(dFdx(vMapUv)), length(dFdy(vMapUv))) * 1024.0;
          float htA = min(1.0, diffuseColor.a * (1.0 + 0.9 * log2(max(htMin, 1.0))));
          diffuseColor.a = smoothstep(0.02, 0.3, htA) * smoothstep(0.0, 0.08, vAge);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(0.08, 0.55, htDry);');
    };
    mat.customProgramCacheKey = () => 'ht3d-blood-decal';
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.receiveShadow = true; this.mesh.renderOrder = 1;
    this.mesh.name = 'bloodDecals';
    game.scene.add(this.mesh);
    this.growing = [];
    this._m = new M4(); this._q = new QT(); this._s = new V3(); this._p = new V3();
  }
  // returns slot index
  add(p, n, size, kind, dir, opts) {
    const k = DECAL_TILES[kind] || DECAL_TILES.splat;
    const slot = this.next; this.next = (this.next + 1) % this.max; this.used = Math.min(this.max, this.used + 1);
    this.growing = this.growing.filter(gr => gr.slot !== slot);
    const q = this._q.setFromUnitVectors(FWD, _gv5.copy(n).normalize());
    let ang = Math.random() * TAU;
    if (dir) { // align the tile's +x with the projected direction
      const t = _gv6.copy(dir).addScaledVector(n, -dir.dot(n));
      if (t.lengthSq() > 1e-6) {
        t.normalize();
        const ax = _gv7.set(1, 0, 0).applyQuaternion(q);
        ang = Math.atan2(_gv4.crossVectors(ax, t).dot(n), ax.dot(t));
      }
    }
    q.multiply(_gq1.setFromAxisAngle(FWD, ang));
    const sx = size * (kind === 'spray' ? 1.7 : 1), sy = size;
    const pos = this._p.copy(p).addScaledVector(n, 0.003 + Math.random() * 0.002);
    const grow = opts && opts.grow;
    this._m.compose(pos, q, this._s.set(grow ? sx * 0.08 : sx, grow ? sy * 0.08 : sy, 1));
    this.mesh.setMatrixAt(slot, this._m);
    this.aTile.array[slot] = k[0] + Math.floor(Math.random() * k[1]);
    this.aBirth.array[slot] = this.game.time;
    this.aTile.needsUpdate = true; this.aBirth.needsUpdate = true; this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.count = this.used;
    if (grow) this.growing.push({ slot, t: 0, dur: opts.grow, sx, sy, pos: pos.clone(), q: q.clone() });
    return slot;
  }
  update(dt) {
    this.uTime.value = this.game.time;
    if (!this.growing.length) return;
    for (let i = this.growing.length - 1; i >= 0; i--) {
      const gr = this.growing[i];
      gr.t += dt;
      const f = Math.sqrt(smooth01(gr.t / gr.dur));
      this._m.compose(gr.pos, gr.q, this._s.set(gr.sx * Math.max(0.08, f), gr.sy * Math.max(0.08, f), 1));
      this.mesh.setMatrixAt(gr.slot, this._m);
      if (gr.t >= gr.dur) this.growing.splice(i, 1);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { this.mesh.count = 0; this.used = 0; this.next = 0; this.growing.length = 0; }
}

// --- blood droplets (points with ground/wall collision -> decals) ----------------------------
class BloodDrops {
  constructor(game, max) {
    this.game = game; this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.life = new Float32Array(max); this.size = new Float32Array(max); this.dc = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos); geo.setAttribute('aSize', this.aSize);
    geo.boundingSphere = new THREE.Sphere(new V3(), 1e5);
    this.uniforms = { uScale: { value: 400 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      vertexShader: `attribute float aSize; uniform float uScale; varying float vS;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; vS = aSize;
          gl_PointSize = clamp(aSize * uScale / max(0.05, -mv.z), 1.5, 64.0); }`,
      fragmentShader: `varying float vS;
        void main() { vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard;
          float a = 1.0 - smoothstep(0.32, 0.5, r);
          vec3 col = vec3(0.30, 0.01, 0.01) * (0.8 + 0.4 * (0.5 - c.y));
          col += vec3(0.5, 0.25, 0.25) * smoothstep(0.12, 0.0, length(c - vec2(-0.14, -0.14)));
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false; this.points.renderOrder = 2;
    game.scene.add(this.points);
    this.decalBudget = 0;
  }
  emit(x, y, z, vx, vy, vz, size, life, decalChance) {
    let i;
    if (this.n < this.max) i = this.n++; else i = Math.floor(Math.random() * this.max);
    const k = i * 3;
    this.p[k] = x; this.p[k + 1] = y; this.p[k + 2] = z; this.v[k] = vx; this.v[k + 1] = vy; this.v[k + 2] = vz;
    this.size[i] = size; this.life[i] = life; this.dc[i] = decalChance;
  }
  update(dt, gore) {
    const g = this.game, env = g.env, planes = g.physics.planes;
    const P = this.aPos.array, S = this.aSize.array;
    this.decalBudget = Math.min(this.decalBudget + dt * 40, 14);
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      let l = this.life[i] - dt;
      if (l <= 0) continue;
      const k = i * 3;
      this.v[k + 1] -= 9.8 * dt;
      const dr = 1 - 0.35 * dt;
      this.v[k] *= dr; this.v[k + 2] *= dr;
      let x = this.p[k] + this.v[k] * dt, y = this.p[k + 1] + this.v[k + 1] * dt, z = this.p[k + 2] + this.v[k + 2] * dt;
      // collisions -> decals
      let hitN = null;
      const gy = env.groundHeight(x, z);
      if (y <= gy + 0.004) { y = gy + 0.004; hitN = env.groundNormal(x, z, _gv3); }
      else for (const pl of planes) {
        if (pl.n.y > 0.5) continue; // floor handled above
        const d = pl.n.x * x + pl.n.y * y + pl.n.z * z - pl.d;
        if (d < 0.004) { x -= pl.n.x * (d - 0.004); y -= pl.n.y * (d - 0.004); z -= pl.n.z * (d - 0.004); hitN = _gv3.copy(pl.n); break; }
      }
      if (hitN) {
        if (this.decalBudget >= 1 && Math.random() < this.dc[i]) {
          this.decalBudget -= 1;
          const sp = Math.hypot(this.v[k], this.v[k + 1], this.v[k + 2]);
          const big = this.size[i] > 0.022;
          _gv4.set(this.v[k], this.v[k + 1], this.v[k + 2]);
          gore.decals.add(_gv1.set(x, y, z), hitN, (big ? 0.09 : 0.04) + this.size[i] * 2.2 + Math.min(sp, 6) * 0.012, sp > 3.5 && hitN.y < 0.5 ? 'spray' : 'drop', sp > 2 ? _gv4 : null);
        }
        continue;
      }
      this.p[k] = x; this.p[k + 1] = y; this.p[k + 2] = z;
      const o = w * 3;
      if (o !== k) { this.p[o] = x; this.p[o + 1] = y; this.p[o + 2] = z; this.v[o] = this.v[k]; this.v[o + 1] = this.v[k + 1]; this.v[o + 2] = this.v[k + 2]; this.size[w] = this.size[i]; this.dc[w] = this.dc[i]; }
      this.life[w] = l;
      P[o] = x; P[o + 1] = y; P[o + 2] = z; S[w] = this.size[w];
      w++;
    }
    this.n = w;
    this.points.geometry.setDrawRange(0, w);
    this.aPos.needsUpdate = true; this.aSize.needsUpdate = true;
    const h = g.renderer.domElement.height;
    this.uniforms.uScale.value = h / (2 * Math.tan(g.camera.fov * DEG / 2));
  }
  clear() { this.n = 0; this.points.geometry.setDrawRange(0, 0); }
}

// --- gibs: instanced chunks with simple rigid physics ----------------------------------------
const GIB_COLORS = {
  flesh: [[0.42, 0.04, 0.035], [0.55, 0.09, 0.07], [0.3, 0.02, 0.02]],
  bone: [[0.86, 0.81, 0.7], [0.92, 0.88, 0.8]],
  brain: [[0.74, 0.55, 0.55], [0.66, 0.45, 0.47]],
  organ: [[0.38, 0.06, 0.1], [0.5, 0.12, 0.16], [0.6, 0.3, 0.32]],
  fat: [[0.85, 0.72, 0.45]]
};
class Gibs {
  constructor(game, max) {
    this.game = game; this.max = max; this.list = []; this.next = 0;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const h = hash2(Math.round(x * 97 + 500), Math.round(y * 89 + z * 61 + 500));
      const k = 0.7 + 0.55 * h;
      pa.setXYZ(i, x * k, y * k * 0.75, z * k * 1.1);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0 });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0; this.mesh.castShadow = true; this.mesh.frustumCulled = false; this.mesh.name = 'gibs';
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    game.scene.add(this.mesh);
    this._m = new M4(); this._c = new THREE.Color(); this._s = new V3();
  }
  spawn(p, v, size, type, color) {
    let gb;
    if (this.list.length < this.max) { gb = { p: new V3(), v: new V3(), q: new QT(), w: new V3(), s: 1, rest: false, splat: false, idx: this.list.length }; this.list.push(gb); }
    else { gb = this.list[this.next]; this.next = (this.next + 1) % this.max; }
    gb.p.copy(p); gb.v.copy(v); gb.q.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    gb.w.set((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24);
    gb.s = size; gb.rest = false; gb.splat = false; gb.t = 0;
    const pal = GIB_COLORS[type] || GIB_COLORS.flesh;
    const c = color || pal[Math.floor(Math.random() * pal.length)];
    this._c.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
    this.mesh.setColorAt(gb.idx, this._c);
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.count = this.list.length;
    return gb;
  }
  burst(p, dir, count, type, speed = 4, spread = 0.7, size = 1, color) {
    for (let i = 0; i < count; i++) {
      const d = _gv1.set(dir.x + (Math.random() - 0.5) * spread * 2, dir.y + (Math.random() - 0.3) * spread * 2, dir.z + (Math.random() - 0.5) * spread * 2).normalize();
      const sp = speed * (0.4 + Math.random() * 0.9);
      this.spawn(p, _gv2.copy(d).multiplyScalar(sp), (0.012 + Math.random() * 0.03) * size, type, color);
    }
  }
  update(dt, gore) {
    if (!this.list.length) return;
    const env = this.game.env, planes = this.game.physics.planes;
    let any = false;
    for (const gb of this.list) {
      if (gb.rest) continue;
      any = true; gb.t += dt;
      gb.v.y -= 9.8 * dt;
      gb.p.addScaledVector(gb.v, dt);
      quatFromRotVec(_gv1.copy(gb.w).multiplyScalar(dt), _gq1); gb.q.premultiply(_gq1);
      const gy = env.groundHeight(gb.p.x, gb.p.z) + gb.s * 0.7;
      if (gb.p.y < gy) {
        gb.p.y = gy;
        if (!gb.splat && gb.v.y < -1.2) { gb.splat = true; gore.decals.add(_gv2.set(gb.p.x, gy - gb.s * 0.7, gb.p.z), env.groundNormal(gb.p.x, gb.p.z, _gv3), 0.07 + gb.s * 4, 'drop'); }
        gb.v.y *= -0.22; gb.v.x *= 0.55; gb.v.z *= 0.55; gb.w.multiplyScalar(0.5);
        if (gb.v.lengthSq() < 0.04) { gb.v.set(0, 0, 0); gb.w.set(0, 0, 0); gb.rest = true; }
      }
      for (const pl of planes) {
        if (pl.n.y > 0.5) continue;
        const d = pl.n.dot(gb.p) - pl.d - gb.s;
        if (d < 0) { gb.p.addScaledVector(pl.n, -d); const vn = gb.v.dot(pl.n); if (vn < 0) gb.v.addScaledVector(pl.n, -vn * 1.3); if (!gb.splat && vn < -2) { gb.splat = true; gore.decals.add(_gv2.copy(gb.p).addScaledVector(pl.n, -gb.s), pl.n, 0.1 + gb.s * 5, 'splat'); } }
      }
      this._m.compose(gb.p, gb.q, this._s.set(gb.s, gb.s, gb.s));
      this.mesh.setMatrixAt(gb.idx, this._m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { this.list.length = 0; this.next = 0; this.mesh.count = 0; }
}

// --- screen blood (2D overlay) -----------------------------------------------------------------
class ScreenBlood {
  constructor() {
    const c = document.createElement('canvas'); c.id = 'screenBlood';
    c.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:4;';
    document.body.appendChild(c);
    this.c = c; this.ctx = c.getContext('2d'); this.splats = []; this.dirty = false;
    this.resize(); window.addEventListener('resize', () => this.resize());
  }
  resize() { this.c.width = Math.max(1, Math.floor(innerWidth / 2)); this.c.height = Math.max(1, Math.floor(innerHeight / 2)); }
  add(x, y, r, a) {
    if (this.splats.length > 18) this.splats.shift();
    const pts = [], n = 22, ph = Math.random() * 9;
    for (let i = 0; i < n; i++) { const t = i / n * TAU; pts.push(1 + 0.3 * Math.sin(t * 3 + ph) + 0.2 * Math.sin(t * 7 + ph * 2) + (Math.random() - 0.5) * 0.3); }
    const drops = [];
    for (let i = 0; i < 6 + Math.random() * 8; i++) { const ang = Math.random() * TAU, d = r * (1.1 + Math.random() * 1.6); drops.push({ x: Math.cos(ang) * d, y: Math.sin(ang) * d, r: r * (0.05 + Math.random() * 0.18) }); }
    const drips = [];
    for (let i = 0; i < 1 + Math.random() * 3; i++) drips.push({ x: (Math.random() - 0.5) * r * 1.2, len: 0, speed: r * (0.15 + Math.random() * 0.5), w: r * (0.08 + Math.random() * 0.1) });
    this.splats.push({ x, y, r, a, life: 3.2, max: 3.2, pts, drops, drips });
  }
  update(dt) {
    const g = this.ctx, W = this.c.width, H = this.c.height;
    if (!this.splats.length) { if (this.dirty) { g.clearRect(0, 0, W, H); this.dirty = false; } return; }
    g.clearRect(0, 0, W, H); this.dirty = true;
    for (let i = this.splats.length - 1; i >= 0; i--) {
      const s = this.splats[i];
      s.life -= dt;
      if (s.life <= 0) { this.splats.splice(i, 1); continue; }
      const al = s.a * Math.min(1, s.life / (s.max * 0.6));
      const cx = s.x * W, cy = s.y * H, r = s.r * H;
      g.fillStyle = `rgba(110,4,4,${al * 0.9})`;
      g.beginPath();
      s.pts.forEach((k, j) => { const t = j / s.pts.length * TAU; const x = cx + Math.cos(t) * r * k, y = cy + Math.sin(t) * r * k; if (j) g.lineTo(x, y); else g.moveTo(x, y); });
      g.closePath(); g.fill();
      g.fillStyle = `rgba(70,0,0,${al * 0.6})`;
      g.beginPath(); g.arc(cx + r * 0.1, cy + r * 0.1, r * 0.55, 0, TAU); g.fill();
      g.fillStyle = `rgba(120,6,6,${al * 0.85})`;
      for (const d of s.drops) { g.beginPath(); g.arc(cx + d.x * H, cy + d.y * H, Math.max(1, d.r * H), 0, TAU); g.fill(); }
      for (const d of s.drips) {
        d.len = Math.min(s.r * 3.5, d.len + d.speed * dt);
        const dx = cx + d.x * H, dw = Math.max(1, d.w * H), dl = (s.r * 0.6 + d.len) * H;
        g.fillRect(dx - dw / 2, cy, dw, dl);
        g.beginPath(); g.arc(dx, cy + dl, dw * 0.75, 0, TAU); g.fill();
      }
    }
  }
  clear() { this.splats.length = 0; }
}

// --- stump cap material (flesh rings, fat layer, bone and marrow) -------------------------------
function makeFleshMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aCap; varying vec3 vCap;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCap = aCap;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCap;\nfloat fhH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float R = max(vCap.z, 0.005);
        float cr = length(vCap.xy); float rm = cr * R; float an = atan(vCap.y, vCap.x);
        float wob = 0.035 * sin(an * 7.0) + 0.025 * sin(an * 13.0 + 1.3);
        vec3 fc = mix(vec3(0.36, 0.025, 0.025), vec3(0.6, 0.09, 0.07), 0.5 + 0.5 * sin(an * 24.0 + rm * 900.0));
        fc *= 0.72 + 0.4 * fhH(floor(vCap.xy * R * 900.0));
        float boneR = clamp(R * 0.3, 0.008, 0.017) * (1.0 + wob);
        fc = mix(fc, mix(vec3(0.84, 0.78, 0.64), vec3(0.95, 0.92, 0.85), rm / boneR), 1.0 - smoothstep(boneR - 0.0015, boneR + 0.0015, rm));
        fc = mix(fc, vec3(0.34, 0.04, 0.03), 1.0 - smoothstep(boneR * 0.42, boneR * 0.55, rm));
        float edge = R - rm;
        float fat = smoothstep(0.0015, 0.003, edge) * (1.0 - smoothstep(0.004 + wob * 0.05, 0.007 + wob * 0.05, edge));
        fc = mix(fc, vec3(0.82, 0.68, 0.4), fat);
        fc = mix(fc, vec3(0.25, 0.015, 0.015), 1.0 - smoothstep(0.0, 0.0018, edge));
        diffuseColor.rgb = fc;`);
  };
  m.customProgramCacheKey = () => 'ht3d-flesh';
  return m;
}

// ============================================================================
class GoreSystem {
  constructor(game) {
    this.game = game;
    const low = Settings.data.graphics.preset === 'low';
    this.decals = new BloodDecals(game, low ? 280 : 700);
    this.drops = new BloodDrops(game, low ? 700 : 1800);
    this.gibs = new Gibs(game, low ? 90 : 240);
    this.screen = new ScreenBlood();
    this.capMat = makeFleshMaterial();
    this.soundT = 0;
  }
  get level() { return Settings.data.gore.level; }
  get on() { return Settings.data.gore.level !== 'off'; }
  get extreme() { return Settings.data.gore.level === 'extreme'; }
  state(npc) { return npc.gore || (npc.gore = new NPCGore(npc)); }
  // ---------------------------------------------------------------------------------------
  // bind-space point + normal on the mesh from a precise hit; returns the nearest vertex index
  bindFromHit(npc, hit, outP, outN) {
    const g = npc.mesh.geometry, P = g.attributes.position.array, N = g.attributes.normal.array, idx = g.index.array, t = hit.tri * 3;
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const u = hit.u || 0, v = hit.v || 0, w = 1 - u - v;
    outP.set(P[a * 3] * w + P[b * 3] * u + P[c * 3] * v, P[a * 3 + 1] * w + P[b * 3 + 1] * u + P[c * 3 + 1] * v, P[a * 3 + 2] * w + P[b * 3 + 2] * u + P[c * 3 + 2] * v);
    outN.set(N[a * 3] * w + N[b * 3] * u + N[c * 3] * v, N[a * 3 + 1] * w + N[b * 3 + 1] * u + N[c * 3 + 1] * v, N[a * 3 + 2] * w + N[b * 3 + 2] * u + N[c * 3 + 2] * v);
    if (outN.lengthSq() < 1e-8) outN.set(0, 0, 1); else outN.normalize();
    return w >= u && w >= v ? a : (u >= v ? b : c);
  }
  // closest (visible) vertex to a world point, optionally limited to regions
  nearestVertex(npc, wp, regions) {
    const S = npc.skinnedPositions(), reg = npc.mesh.geometry.attributes.aRegion.array, gone = npc.gore && npc.gore.gone;
    let best = -1, bd = 1e9;
    for (let i = 0; i < reg.length; i++) {
      if (regions && regions.indexOf(reg[i] | 0) < 0) continue;
      if (gone && gone[i]) continue;
      const dx = S[i * 3] - wp.x, dy = S[i * 3 + 1] - wp.y, dz = S[i * 3 + 2] - wp.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  vertexBind(npc, vi, outP, outN) {
    const g = npc.mesh.geometry, P = g.attributes.position.array, N = g.attributes.normal.array;
    outP.set(P[vi * 3], P[vi * 3 + 1], P[vi * 3 + 2]); outN.set(N[vi * 3], N[vi * 3 + 1], N[vi * 3 + 2]).normalize();
    return vi;
  }
  addWound(npc, type, bp, bn, r, o = {}) {
    if (!this.on) return null;
    const G = this.state(npc);
    for (const w of G.wounds) {
      if (w.type === type && type !== WOUND.STUMP && w.p.distanceTo(bp) < (w.r + r) * 0.7) { w.r = Math.min(w.r * 1.18, Math.max(w.r, r) * 2.2); w.k = Math.min(0.99, w.k + 0.12); w.bleed += (o.bleed || 0) * 0.5; G.bleed += (o.bleed || 0) * 0.5; G.dirty = true; return w; }
    }
    if (G.wounds.length >= MAX_WOUNDS) {
      let oi = -1, ob = 1e9;
      for (let i = 0; i < G.wounds.length; i++) { const w = G.wounds[i]; if (w.type === WOUND.STUMP || w.type === WOUND.GAPING) continue; if (w.born < ob) { ob = w.born; oi = i; } }
      if (oi < 0) return null;
      G.bleed = Math.max(0, G.bleed - G.wounds[oi].bleed);
      G.wounds.splice(oi, 1);
    }
    const w = { type, p: bp.clone(), n: bn.clone(), r, k: o.k != null ? o.k : 0.05, vi: o.vi != null ? o.vi : -1, bleed: o.bleed || 0, born: this.game.time, grow: o.grow != null ? o.grow : 0.025 };
    G.wounds.push(w); G.bleed += w.bleed; G.dirty = true;
    return w;
  }
  uploadWounds(npc) {
    const G = npc.gore, U = npc.material.userData.u;
    if (!U.uWA) return;
    const n = Math.min(G.wounds.length, MAX_WOUNDS);
    for (let i = 0; i < n; i++) {
      const w = G.wounds[i];
      U.uWA.value[i].set(w.p.x, w.p.y, w.p.z, w.r);
      U.uWB.value[i].set(w.n.x, w.n.y, w.n.z, w.type + Math.min(0.99, w.k));
    }
    U.uWN.value = n; U.uBlood.value = Math.min(1, G.blood);
    G.dirty = false;
  }
  // --- particles -----------------------------------------------------------------------------
  spray(p, dir, count, speed, spread, size = 1, decalChance = 0.45) {
    if (!this.on) return;
    const mul = this.extreme ? 1 : 0.6;
    count = Math.round(count * mul * Settings.data.gore.blood);
    for (let i = 0; i < count; i++) {
      const d = _gv1.set(dir.x + (Math.random() - 0.5) * spread * 2, dir.y + (Math.random() - 0.5) * spread * 2, dir.z + (Math.random() - 0.5) * spread * 2).normalize();
      const sp = speed * (0.35 + Math.random() * 0.85);
      const sz = (0.006 + Math.random() * 0.016) * size * (Math.random() < 0.12 ? 2.2 : 1);
      this.drops.emit(p.x, p.y, p.z, d.x * sp, d.y * sp, d.z * sp, sz, 2.5, decalChance);
    }
  }
  mist(p, dir, count, size) {
    if (!this.on) return;
    const sm = this.game.fx.smoke;
    for (let i = 0; i < count; i++) {
      const d = _gv1.set(dir.x + (Math.random() - 0.5) * 1.2, dir.y + (Math.random() - 0.5) * 1.2 + 0.1, dir.z + (Math.random() - 0.5) * 1.2).normalize();
      const sp = 0.4 + Math.random() * 1.6 * size * 2;
      sm.emit(p.x, p.y, p.z, d.x * sp, d.y * sp, d.z * sp, 0.6 + Math.random() * 0.7, size * 0.25, size * (0.8 + Math.random() * 0.6), 0.42, 0.02, 0.02, 0.55, 0.15, 3);
    }
  }
  splatAt(p, size, kind = 'splat', dir = null) {
    const env = this.game.env;
    const gy = env.groundHeight(p.x, p.z);
    this.decals.add(_gv2.set(p.x, gy, p.z), env.groundNormal(p.x, p.z, _gv3), size, kind, dir);
  }
  // blood thrown onto the nearest surface along a direction (walls / floor)
  wallSplat(from, dir, size, maxDist) {
    if (!this.on) return;
    const e = this.game.weapons.rayEnv(from, dir, maxDist);
    if (e) this.decals.add(e.point, e.normal, size * (0.55 + e.dist * 0.3), 'spray', dir);
    const down = _gv6.copy(dir).setY(Math.min(dir.y, -0.6)).normalize();
    const e2 = this.game.weapons.rayEnv(from, down, maxDist);
    if (e2) this.decals.add(e2.point, e2.normal, size * (0.5 + e2.dist * 0.2), 'spray', dir);
  }
  screenNear(p, strength) {
    if (!this.on || !Settings.data.gore.screenBlood) return;
    const cam = this.game.camera, d = cam.position.distanceTo(p);
    if (d > 3.2) return;
    const s = _gv7.copy(p).project(cam);
    if (s.z > 1) return;
    const k = strength * (1 - d / 3.2);
    const n = Math.ceil(k * 5);
    for (let i = 0; i < n; i++) {
      const x = clamp(s.x * 0.5 + 0.5 + (Math.random() - 0.5) * 0.5, 0.05, 0.95), y = clamp(-s.y * 0.5 + 0.5 + (Math.random() - 0.5) * 0.45, 0.05, 0.95);
      this.screen.add(x, y, 0.025 + Math.random() * 0.07 * k + 0.02, clamp(0.5 + k, 0.4, 0.95));
    }
  }
  sound(p, name, gain = 0.8) {
    const a = this.game.audio;
    if (name === 'splat') a.play('splat' + Math.floor(Math.random() * 3), { pos: p, gain });
    else a.play(name, { pos: p, gain });
  }
  // --- dismemberment ------------------------------------------------------------------------
  canSever(npc, cutId) {
    const G = npc.gore, cut = GORE_CUTS[cutId];
    if (!cut || !this.extreme || !Settings.data.gore.dismember) return false;
    if (!G) return true;
    if (G.cuts[cutId] || (cutId === 'head' && G.headGone)) return false;
    if (G.boneDetached[cut.bone]) return false;
    return true;
  }
  sever(npc, cutId, o = {}) {
    if (!this.canSever(npc, cutId)) return false;
    const cut = GORE_CUTS[cutId], G = this.state(npc), game = this.game;
    const explode = !!o.explode;
    const geo = npc.mesh.geometry;
    const si = geo.attributes.skinIndex.array, sw = geo.attributes.skinWeight.array, P = geo.attributes.position.array, RG = geo.attributes.aRegion.array;
    const n = geo.attributes.position.count, sub = cut.sub;
    const side = new Uint8Array(n);
    const inPart = new Uint8Array(REGION_COUNT); for (const r of cut.regions) inPart[r] = 1;
    if (cut.id === 'head') inPart[REGION.HEAD] = 1;
    for (let v = 0; v < n; v++) {
      const o4 = v * 4; let wl = 0, wt = 0;
      for (let k = 0; k < 4; k++) { const w = sw[o4 + k]; wt += w; if (sub[si[o4 + k]]) wl += w; }
      if (wl <= 1e-5) continue;
      // the severed piece = vertices mostly driven by the part's bones AND belonging to its body regions
      const lim = wl >= 0.5 * wt && inPart[RG[v] | 0] === 1;
      side[v] = lim ? 1 : 0;
      if (wl < wt - 1e-5) {
        let s2 = 0;
        for (let k = 0; k < 4; k++) { if ((sub[si[o4 + k]] === 1) !== lim) sw[o4 + k] = 0; s2 += sw[o4 + k]; }
        if (s2 > 1e-6) for (let k = 0; k < 4; k++) sw[o4 + k] /= s2;
        else { si[o4] = lim ? cut.bone : BONE_PARENT[cut.bone]; sw[o4] = 1; }
      }
    }
    if (explode) { if (!G.gone) G.gone = new Uint8Array(n); for (let v = 0; v < n; v++) if (side[v]) G.gone[v] = 1; }
    const idx = geo.index.array, bodyE = [], limbE = [];
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      if (a === b && a === c) continue;
      const sa = side[a], sb = side[b], sc = side[c];
      if (sa === sb && sb === sc) { if (explode && sa) { idx[t + 1] = a; idx[t + 2] = a; } continue; }
      if (sa === sb) (sa ? limbE : bodyE).push(a, b);
      else if (sb === sc) (sb ? limbE : bodyE).push(b, c);
      else (sc ? limbE : bodyE).push(c, a);
      idx[t + 1] = a; idx[t + 2] = a;
    }
    geo.index.needsUpdate = true; geo.attributes.skinIndex.needsUpdate = true; geo.attributes.skinWeight.needsUpdate = true;
    npc.skinCacheFrame = -1;
    // stump caps (body side always, limb side unless destroyed)
    const pb = BONE_PARENT[cut.bone], rig = npc.rig;
    const axisV = cut.side < 0 ? new V3(0, 1, 0) : (cut.isArm ? rig.armDir[cut.side].clone() : new V3(0, -1, cut.id.startsWith('foot') ? 0.3 : 0).normalize());
    const jointB = rig.bindPos[cut.bone];
    const limbR = cut.side < 0 ? 0.05 * rig.H / 1.75 : npc.rag.defs[cut.rc].r * (cut.isLeg ? 1.05 : 1.15);
    const bodyLoops = this.makeLoops(P, bodyE, pb);
    let limbLoops = explode ? [] : this.makeLoops(P, limbE, cut.bone);
    // separate limb surfaces: close the severed tube's open end, add a flesh disc on the body
    if (!explode && !limbLoops.length) limbLoops = this.openLoops(P, idx, side, 1, jointB, limbR * 3, cut.bone);
    if (!bodyLoops.length) bodyLoops.push(this.discLoop(jointB.clone().addScaledVector(axisV, cut.isLeg && cut.id.startsWith('leg') ? 0.05 * rig.H / 1.75 : 0.01), axisV, limbR, pb));
    G.capLoops.push(...bodyLoops, ...limbLoops);
    this.rebuildCaps(npc);
    // stump wound (torn rim on both sides of the cut)
    const axis = _gv1.copy(axisV);
    let cen = null, rad = 0, cnt = 0;
    for (const L of bodyLoops.concat(limbLoops)) { cen = cen ? cen.addScaledVector(L.center, L.count) : L.center.clone().multiplyScalar(L.count); cnt += L.count; rad = Math.max(rad, L.radius); }
    if (cen) cen.multiplyScalar(1 / cnt); else cen = rig.bindPos[cut.bone].clone();
    if (!rad) rad = limbR;
    rad = Math.min(rad, limbR * 1.6);
    this.addWound(npc, WOUND.STUMP, cen, axis, Math.min(rad, limbR), { bleed: 0, k: 0.3, grow: 0.02 });
    // physics: break the joint, free the severed part
    const rag = npc.rag;
    if (!explode) {
      const j = rag.joints[cut.joint]; j.broken = true; j.enabled = false;
      for (const ri of cut.ragSub) {
        rag.detached[ri] = 1;
        const b = rag.bodies[ri];
        if (b.kinematic) { b.vel.copy(b.kinVel); b.omega.copy(b.kinOmega); b.kinematic = false; }
        b.sleeping = false;
      }
      for (const jj of rag.joints) if (!jj.broken && rag.detached[jj.b0.index] && rag.detached[jj.b1.index]) { jj.enabled = true; jj.rotDamping = jj.baseDamp * 0.4; }
      rag.asleep = false; rag.sleepTimer = 0;
      for (let b = 0; b < NUM_BONES; b++) if (sub[b]) G.boneDetached[b] = 1;
      G.detachRoot[cut.bone] = 1;
      if (o.impulse && rag.world) rag.world.applyImpulse(rag.bodies[cut.rc], o.impulse, null);
      G.cuts[cutId] = { time: game.time };
      if (cut.isLeg) G.lostLegs++; if (cut.isArm) G.lostArms++;
    } else {
      const hb = rag.bodies[RAG.HEAD]; hb.noCollide = true;
      G.headGone = true; G.cuts.head = { time: game.time, explode: true };
    }
    G.anyCut = true;
    // bleeding: arterial spurts from the stump (and briefly from the severed piece)
    const alive = npc.lifeState === 'alive';
    G.spurts.push({ cut, body: true, t: 0, dur: alive ? 14 : 6, beat: 0 });
    if (!explode) G.spurts.push({ cut, body: false, t: 0, dur: 2.5, beat: 0 });
    G.bleed += alive ? (cut.side < 0 ? 40 : (cut.id.startsWith('hand') || cut.id.startsWith('foot') ? 2.5 : 5)) : 0;
    // effects at the joint
    const jp = this.jointWorld(npc, cut, true, _gv4), jd = this.jointDir(npc, cut, true, _gv5);
    this.spray(jp, jd, 26, 3.2, 0.55, 1.1, 0.6);
    this.spray(jp, _gv6.copy(jd).negate(), 14, 2.4, 0.6, 1.0, 0.6);
    this.mist(jp, jd, 6, 0.4);
    if (Settings.data.gore.gibs) { this.gibs.burst(jp, jd, 3 + Math.floor(Math.random() * 3), 'flesh', 3, 0.8); if (Math.random() < 0.6) this.gibs.burst(jp, jd, 1 + Math.floor(Math.random() * 2), 'bone', 3, 0.8, 0.8); }
    this.splatAt(jp, 0.35 + Math.random() * 0.25, 'splat');
    this.sound(jp, 'crack', 0.9); this.sound(jp, 'splat', 0.9);
    this.screenNear(jp, 0.6);
    this.afterSever(npc, cut, explode, o);
    Events.emit('gore', { npc, kind: explode ? 'headExplode' : 'sever', cut: cutId });
    HT.log('hit', `${npc.idStr} ${npc.name}: ${explode ? 'HEAD DESTROYED' : cutId + ' severed'}`);
    return true;
  }
  afterSever(npc, cut, explode, o) {
    const G = npc.gore;
    if (cut.id === 'head') {
      npc.criticalHead = true;
      if (npc.lifeState === 'alive') npc.die({ weapon: o.weapon || 'gore' });
      else if (npc.lifeState === 'zombie') { npc.health = 0; npc.destroyZombie({ weapon: o.weapon || 'gore' }); }
      else if (npc.lifeState === 'reanimating') { npc.health = 0; }
      if (npc.physMode !== 'ragdoll') npc.goRagdoll('Ragdoll (Decapitated)', true);
      npc.lastReaction = explode ? 'Head Destroyed' : 'Decapitated';
      return;
    }
    if (cut.isLeg) {
      if (npc.physMode !== 'ragdoll' && (npc.lifeState === 'alive' || npc.lifeState === 'zombie')) npc.goRagdoll('Ragdoll (Leg Severed)');
      npc.anim.crawl = 1; npc.downTimer = Math.max(npc.downTimer, 1.2);
      npc.lastReaction = npc.lifeState === 'zombie' ? 'Crawling (Leg Lost)' : 'Collapsed (Leg Severed)';
    } else if (cut.isArm && npc.lifeState === 'alive') {
      npc.fear = 1; npc.lastReaction = 'Shock (Arm Severed)';
      if (npc.brain && npc.physMode === 'anim') { npc.brain.state = 'flee'; npc.brain.t = 0; npc.brain.fleeT = 8; }
      this.game.audio.play('scream' + Math.floor(Math.random() * 3), { pos: npc.boneWPos[B.head].clone(), gain: 1, important: true });
    }
  }
  // world position / outward direction of a cut's stump (body side or severed side)
  jointWorld(npc, cut, bodySide, out) {
    const p = BONE_PARENT[cut.bone];
    if (bodySide) return out.copy(npc.rig.localOffset[cut.bone]).applyQuaternion(npc.boneWRot[p]).add(npc.boneWPos[p]);
    return out.copy(npc.boneWPos[cut.bone]);
  }
  jointDir(npc, cut, bodySide, out) {
    const rig = npc.rig;
    if (cut.side < 0) out.set(0, 1, 0); else if (cut.isArm) out.copy(rig.armDir[cut.side]); else out.set(0, -1, 0);
    out.applyQuaternion(npc.boneWRot[bodySide ? BONE_PARENT[cut.bone] : cut.bone]);
    if (!bodySide) out.negate();
    return out;
  }
  // group boundary edges into loops (union-find) -> cap fans
  makeLoops(P, edges, bone, maxR) {
    if (edges.length < 6) return [];
    const par = new Map();
    const find = (x) => { let r = x; while (par.get(r) !== r) r = par.get(r); let y = x; while (par.get(y) !== r) { const nx = par.get(y); par.set(y, r); y = nx; } return r; };
    for (const v of edges) if (!par.has(v)) par.set(v, v);
    for (let i = 0; i < edges.length; i += 2) { const a = find(edges[i]), b = find(edges[i + 1]); if (a !== b) par.set(a, b); }
    const groups = new Map();
    for (let i = 0; i < edges.length; i += 2) { const r = find(edges[i]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(edges[i], edges[i + 1]); }
    const loops = [];
    for (const e of groups.values()) {
      if (e.length < 6) continue;
      // only cap closed rings (open chains are cloth edges); seams duplicate vertices, so compare positions
      const deg = new Map();
      for (const v of e) deg.set(v, (deg.get(v) || 0) + 1);
      const ends = []; for (const [v, d] of deg) if (d === 1) ends.push(v);
      if (ends.length > 2 || (ends.length === 2 && Math.hypot(P[ends[0] * 3] - P[ends[1] * 3], P[ends[0] * 3 + 1] - P[ends[1] * 3 + 1], P[ends[0] * 3 + 2] - P[ends[1] * 3 + 2]) > 0.003)) continue;
      const c = new V3(); const seen = new Set();
      for (const v of e) if (!seen.has(v)) { seen.add(v); c.x += P[v * 3]; c.y += P[v * 3 + 1]; c.z += P[v * 3 + 2]; }
      c.multiplyScalar(1 / seen.size);
      const nrm = new V3(); let rad = 0;
      for (let i = 0; i < e.length; i += 2) {
        const a = e[i], b = e[i + 1];
        _gv1.set(P[a * 3], P[a * 3 + 1], P[a * 3 + 2]); _gv2.set(P[b * 3], P[b * 3 + 1], P[b * 3 + 2]);
        _gv3.subVectors(_gv2, _gv1).cross(_gv4.subVectors(c, _gv1)); nrm.add(_gv3);
        rad = Math.max(rad, _gv1.distanceTo(c));
      }
      if (nrm.lengthSq() < 1e-12 || (maxR && rad > maxR)) continue;
      nrm.normalize();
      loops.push({ edges: Int32Array.from(e), center: c, normal: nrm, radius: rad, bone, count: seen.size });
    }
    return loops;
  }
  // boundary edges (used by one triangle) of one side near a point -> loops (cap traverses them reversed)
  openLoops(P, idx, side, want, center, maxD, bone) {
    const cnt = new Map(), N = P.length / 3;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      if (a === b && a === c) continue;
      if (side[a] !== want || side[b] !== want || side[c] !== want) continue;
      for (let k = 0; k < 3; k++) {
        const u = k === 0 ? a : (k === 1 ? b : c), v = k === 0 ? b : (k === 1 ? c : a);
        const key = u < v ? u * N + v : v * N + u;
        const e = cnt.get(key);
        if (e) e[2]++; else cnt.set(key, [u, v, 1]);
      }
    }
    const edges = [], md2 = maxD * maxD;
    for (const e of cnt.values()) {
      if (e[2] !== 1) continue;
      const u = e[0], dx = P[u * 3] - center.x, dy = P[u * 3 + 1] - center.y, dz = P[u * 3 + 2] - center.z;
      if (dx * dx + dy * dy + dz * dz > md2) continue;
      edges.push(e[1], e[0]);
    }
    return this.makeLoops(P, edges, bone, maxD * 0.55);
  }
  // synthetic n-gon cap (explicit points), normal along +axis
  discLoop(center, axis, radius, bone) {
    const U = anyPerp(axis, FWD), V = new V3().crossVectors(axis, U);
    const pts = [];
    for (let i = 0; i <= 18; i++) { const a = i / 18 * TAU, r = radius * (0.92 + 0.12 * Math.sin(a * 5 + radius * 50)); pts.push(center.clone().addScaledVector(U, Math.cos(a) * r).addScaledVector(V, Math.sin(a) * r)); }
    return { pts, center: center.clone(), normal: axis.clone().normalize(), radius, bone, count: 18 };
  }
  rebuildCaps(npc) {
    const G = npc.gore, src = npc.mesh.geometry;
    const P = src.attributes.position.array, SI = src.attributes.skinIndex.array, SW = src.attributes.skinWeight.array;
    let tris = 0; for (const L of G.capLoops) tris += L.pts ? L.pts.length - 1 : L.edges.length / 2;
    if (!tris) return;
    const nv = tris * 3;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), cap = new Float32Array(nv * 3), sI = new Uint16Array(nv * 4), sW = new Float32Array(nv * 4);
    let v = 0;
    const U = new V3(), Vv = new V3();
    for (const L of G.capLoops) {
      const N = L.normal; U.copy(anyPerp(N, FWD)); Vv.crossVectors(N, U);
      const R = Math.max(1e-4, L.radius);
      const put = (x, y, z, srcV) => {
        pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
        nor[v * 3] = N.x; nor[v * 3 + 1] = N.y; nor[v * 3 + 2] = N.z;
        const dx = x - L.center.x, dy = y - L.center.y, dz = z - L.center.z;
        cap[v * 3] = (dx * U.x + dy * U.y + dz * U.z) / R; cap[v * 3 + 1] = (dx * Vv.x + dy * Vv.y + dz * Vv.z) / R; cap[v * 3 + 2] = R;
        if (srcV >= 0) for (let k = 0; k < 4; k++) { sI[v * 4 + k] = SI[srcV * 4 + k]; sW[v * 4 + k] = SW[srcV * 4 + k]; }
        else { sI[v * 4] = L.bone; sW[v * 4] = 1; }
        v++;
      };
      if (L.pts) {
        for (let i = 0; i < L.pts.length - 1; i++) {
          const a = L.pts[i], b = L.pts[i + 1];
          put(a.x, a.y, a.z, -1); put(b.x, b.y, b.z, -1); put(L.center.x, L.center.y, L.center.z, -1);
        }
        continue;
      }
      for (let i = 0; i < L.edges.length; i += 2) {
        const a = L.edges[i], b = L.edges[i + 1];
        put(P[a * 3], P[a * 3 + 1], P[a * 3 + 2], a);
        put(P[b * 3], P[b * 3 + 1], P[b * 3 + 2], b);
        put(L.center.x, L.center.y, L.center.z, -1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('aCap', new THREE.BufferAttribute(cap, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sI, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sW, 4));
    geo.boundingSphere = new THREE.Sphere(new V3(), 3);
    if (!G.capMesh) {
      const m = new THREE.SkinnedMesh(geo, this.capMat);
      m.bind(npc.mesh.skeleton, npc.mesh.bindMatrix);
      m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.name = 'stumps' + npc.id;
      this.game.scene.add(m); G.capMesh = m;
    } else { G.capMesh.geometry.dispose(); G.capMesh.geometry = geo; }
  }
  explodeHead(npc, point, dir, power = 1) {
    if (!this.canSever(npc, 'head')) return false;
    const hp = npc.boneWPos[B.head].clone().add(_gv1.set(0, 0.06, 0));
    const ok = this.sever(npc, 'head', { explode: true, weapon: 'sniper' });
    if (!ok) return false;
    const d = dir ? dir.clone() : new V3(0, 1, 0);
    // skull, brain, scalp, eyes
    if (Settings.data.gore.gibs) {
      const hair = npc.app.hair && npc.app.hair.color ? new THREE.Color(npc.app.hair.color) : null;
      const scalp = hair ? [hair.r, hair.g, hair.b] : null;
      this.gibs.burst(hp, d, 9, 'bone', 5 * power, 0.9, 1.1);
      this.gibs.burst(hp, d, 10, 'brain', 4.5 * power, 1.0, 1.0);
      this.gibs.burst(hp, d, 10, 'flesh', 5 * power, 1.0, 1.0);
      if (scalp) this.gibs.burst(hp, d, 4, 'flesh', 4 * power, 0.9, 1.3, scalp);
      this.gibs.burst(hp, d, 2, 'bone', 3, 0.9, 0.55, [0.95, 0.95, 0.93]);
    }
    this.spray(hp, d, 70, 6 * power, 0.7, 1.3, 0.55);
    this.spray(hp, _gv2.set(0, 1, 0), 24, 3.5, 0.9, 1.0, 0.5);
    this.mist(hp, d, 22, 0.7);
    this.wallSplat(hp, d, 1.8, 4.5);
    for (let i = 0; i < 3; i++) this.wallSplat(hp, _gv3.set(d.x + (Math.random() - 0.5), d.y - Math.random() * 0.5, d.z + (Math.random() - 0.5)).normalize(), 1.0, 4);
    this.splatAt(hp, 0.9 + Math.random() * 0.4, 'splat');
    const G = npc.gore; G.blood = Math.min(1, G.blood + 0.35); G.dirty = true;
    this.sound(hp, 'gib', 1.0);
    this.screenNear(hp, 1.2);
    return true;
  }
  // --- weapon hooks --------------------------------------------------------------------------
  onBullet(npc, hit, dir, tool, res) {
    if (!this.on) return false;
    const g = this.game, sn = tool.id === 'sniper';
    const head = hit.region === REGION.HEAD;
    const vi = this.bindFromHit(npc, hit, _gv6, _gv7);
    this.addWound(npc, WOUND.ENTRY, _gv6, _gv7, sn ? 0.012 : 0.0078, { vi, bleed: npc.lifeState === 'alive' ? 0.5 : 0.1, k: 0.12 });
    this.spray(hit.point, _gv3.copy(dir).negate(), sn ? 10 : 6, 1.3, 0.6, 0.7, 0.3);
    this.mist(hit.point, _gv3, sn ? 4 : 2, sn ? 0.3 : 0.18);
    // exit wound + blowback onto walls/floor
    let exitP = null;
    if (!npc.gore || !npc.gore.headGone || !head) {
      const ex = g.hits.rayMesh(npc, _gv4.copy(hit.point).addScaledVector(dir, 1.0), _gv5.copy(dir).negate(), 0.985);
      if (ex && ex.dist < 0.975 && ex.point.distanceTo(hit.point) > 0.02) {
        exitP = ex.point.clone();
        const vi2 = this.bindFromHit(npc, ex, _gv6, _gv7);
        this.addWound(npc, WOUND.EXIT, _gv6, _gv7, sn ? 0.034 : 0.017, { vi: vi2, bleed: npc.lifeState === 'alive' ? (sn ? 1.5 : 0.8) : 0.2, k: 0.18 });
        this.spray(exitP, dir, sn ? 46 : 18, sn ? 6.5 : 3.6, sn ? 0.32 : 0.42, 1.0, 0.5);
        this.mist(exitP, dir, sn ? 12 : 5, sn ? 0.55 : 0.3);
        this.wallSplat(exitP, dir, sn ? 1.3 : 0.75, sn ? 3.2 : 2.2);
        if (sn && !head && Settings.data.gore.gibs && this.extreme) this.gibs.burst(exitP, dir, 4, 'flesh', 5, 0.4);
      }
    }
    if (this.extreme) {
      if (head && (sn || npc.regionDamage[REGION.HEAD] > 170)) this.explodeHead(npc, hit.point, dir, sn ? 1 : 0.7);
      else if (head && exitP && Settings.data.gore.gibs) { this.gibs.burst(exitP, dir, 5, 'brain', 3.5, 0.5, 0.8); this.gibs.burst(exitP, dir, 3, 'bone', 3.5, 0.5, 0.6); this.mist(exitP, dir, 8, 0.5); }
      else if (hit.region === REGION.NECK) { if (sn || npc.regionDamage[REGION.NECK] > 130) this.sever(npc, 'head', { impulse: dir.clone().multiplyScalar(sn ? 5 : 2.5).add(_gv3.set(0, 2.5, 0)), weapon: tool.id }); }
      else {
        const cutId = REGION_CUT[hit.region];
        if (cutId) {
          const dmg = npc.regionDamage[hit.region];
          if ((sn && Math.random() < 0.85) || dmg > 120) this.sever(npc, cutId, { impulse: dir.clone().multiplyScalar(sn ? 7 : 3).add(_gv3.set(0, 1.5, 0)), weapon: tool.id });
        }
      }
    }
    const G = this.state(npc); G.blood = Math.min(1, G.blood + (sn ? 0.08 : 0.03)); G.dirty = true;
    this.sound(hit.point, 'splat', head ? 1 : 0.75);
    this.screenNear(exitP || hit.point, sn ? 0.7 : 0.35);
    return true;
  }
  onKnife(npc, hit, dir, res, swing) {
    if (!this.on) return false;
    const bone = REGION_BONE[hit.region];
    const vi = this.bindFromHit(npc, hit, _gv6, _gv7);
    // slash direction (camera-right swing) in bind space of the struck bone
    const sd = _gv3.copy(swing || _gv3.set(1, 0, 0)).applyQuaternion(_gq1.copy(npc.boneWRot[bone]).invert());
    sd.addScaledVector(_gv7, -sd.dot(_gv7)); if (sd.lengthSq() < 1e-6) sd.set(1, 0, 0); sd.normalize();
    this.addWound(npc, WOUND.SLASH, _gv6, sd, 0.008 + Math.random() * 0.004, { vi, bleed: npc.lifeState === 'alive' ? 0.9 : 0.15, k: 0.15 });
    const sw = (swing || new V3(1, 0, 0)).clone();
    this.spray(hit.point, _gv5.copy(sw).add(_gv1.copy(dir).multiplyScalar(-0.4)).normalize(), 22, 3, 0.35, 0.9, 0.55);
    this.mist(hit.point, dir, 3, 0.25);
    if (this.extreme) {
      if (hit.region === REGION.NECK || hit.region === REGION.HEAD) { if (npc.regionDamage[REGION.NECK] + npc.regionDamage[REGION.HEAD] * 0.3 > 95) this.sever(npc, 'head', { impulse: sw.clone().multiplyScalar(2).add(new V3(0, 2.5, 0)), weapon: 'knife' }); }
      else { const cutId = REGION_CUT[hit.region]; if (cutId && npc.regionDamage[hit.region] > 140) this.sever(npc, cutId, { impulse: sw.clone().multiplyScalar(2.5), weapon: 'knife' }); }
    }
    this.sound(hit.point, 'splat', 0.8);
    this.screenNear(hit.point, 0.5);
    return true;
  }
  onBlast(npc, center, f, res) {
    if (!this.on) return;
    const G = this.state(npc);
    const vi = this.nearestVertex(npc, center, null);
    if (vi >= 0) { this.vertexBind(npc, vi, _gv6, _gv7); this.addWound(npc, WOUND.BLAST, _gv6, _gv7, 0.06 + f * 0.1, { vi, bleed: npc.lifeState === 'alive' ? 1.5 * f : 0.2, k: 0.4 + f * 0.4 }); }
    // shrapnel
    const S = npc.skinnedPositions(), N = npc.mesh.geometry.attributes.position.count;
    for (let i = 0; i < 3 + Math.floor(f * 6); i++) {
      const v = Math.floor(Math.random() * N);
      if (npc.gore && npc.gore.gone && npc.gore.gone[v]) continue;
      _gv1.set(S[v * 3] - center.x, S[v * 3 + 1] - center.y, S[v * 3 + 2] - center.z);
      this.vertexBind(npc, v, _gv6, _gv7); this.addWound(npc, WOUND.ENTRY, _gv6, _gv7, 0.006 + Math.random() * 0.006, { vi: v, bleed: 0.3, k: 0.2 });
    }
    G.blood = Math.min(1, G.blood + 0.25 + f * 0.6); G.dirty = true;
    const c = npc.boneWPos[B.chest].clone(), away = new V3().subVectors(c, center).normalize();
    this.spray(c, away, 20 + f * 50, 4 + f * 4, 0.7, 1.1, 0.55);
    this.mist(c, away, 4 + Math.floor(f * 10), 0.6);
    if (!this.extreme || !Settings.data.gore.dismember) return;
    const imp = (k) => away.clone().multiplyScalar(k).add(_gv3.set((Math.random() - 0.5) * 2, 2 + Math.random() * 3, (Math.random() - 0.5) * 2));
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    if (f > 0.86) { // body torn apart
      for (const id of ['armL', 'armR', 'legL', 'legR']) if (Math.random() < 0.85) this.sever(npc, id, { impulse: imp(14 + Math.random() * 10), weapon: 'grenade' });
      if (Math.random() < 0.6) this.explodeHead(npc, c, away, 1.1); else this.sever(npc, 'head', { impulse: imp(10), weapon: 'grenade' });
      const vg = this.nearestVertex(npc, npc.boneWPos[B.spine], [REGION.ABDOMEN, REGION.TORSO]);
      if (vg >= 0) { this.vertexBind(npc, vg, _gv6, _gv7); G.gaping = this.addWound(npc, WOUND.GAPING, _gv6, _gv7, 0.15, { vi: vg, bleed: 3, k: 0.6 }); }
      if (Settings.data.gore.gibs) { this.gibs.burst(c, away, 14, 'flesh', 7, 1.0, 1.2); this.gibs.burst(c, away, 8, 'organ', 6, 1.0, 1.3); this.gibs.burst(c, away, 6, 'bone', 6, 1.0, 1.0); }
      this.splatAt(c, 1.6, 'splat');
      this.sound(c, 'gib', 1.0);
    } else if (f > 0.55) {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.sever(npc, pick(['armL', 'armR', 'legL', 'legR', 'forearmL', 'forearmR', 'shinL', 'shinR']), { impulse: imp(10 + Math.random() * 6), weapon: 'grenade' });
      if (Math.random() < 0.25) this.sever(npc, 'head', { impulse: imp(8), weapon: 'grenade' });
      if (Settings.data.gore.gibs) this.gibs.burst(c, away, 8, 'flesh', 5, 1.0, 1.0);
    } else if (f > 0.32 && Math.random() < 0.55) {
      this.sever(npc, pick(['handL', 'handR', 'footL', 'footR', 'forearmL', 'forearmR', 'shinL', 'shinR']), { impulse: imp(7), weapon: 'grenade' });
    }
  }
  // zombie bite: ragged wound, spurting, mouth smeared
  onBite(victim, zombie, regionList) {
    if (!this.on) return;
    const regs = regionList || [REGION.NECK, REGION.UPPER_CHEST];
    const mouth = _gv4.copy(zombie.boneWPos[B.jaw]).add(_gv5.set(0, -0.02, 0));
    const vi = this.nearestVertex(victim, mouth, regs);
    let wp = mouth.clone();
    if (vi >= 0) {
      this.vertexBind(victim, vi, _gv6, _gv7);
      this.addWound(victim, WOUND.BITE, _gv6, _gv7, 0.03 + Math.random() * 0.012, { vi, bleed: 2.2, k: 0.25 });
      victim.skinVertexWorld(vi, wp);
    }
    const out = _gv3.subVectors(wp, victim.boneWPos[B.chest]).normalize();
    this.spray(wp, out.add(_gv1.set(0, 0.5, 0)).normalize(), 26, 2.6, 0.5, 1.0, 0.6);
    this.mist(wp, out, 3, 0.25);
    const G = this.state(victim); G.blood = Math.min(1, G.blood + 0.06); G.dirty = true;
    if (regs.indexOf(REGION.NECK) >= 0 && vi >= 0) G.spurts.push({ vi, t: 0, dur: 7, beat: 0 });
    this.smear(zombie, B.jaw, 0.045);
    this.sound(wp, 'bite', 0.95);
    this.screenNear(wp, 0.5);
  }
  // zombie feeding on a corpse: gaping abdomen, chunks, pool, smeared hands/face
  onFeed(corpse, zombie, dt, bite) {
    if (!this.on) return;
    const G = this.state(corpse);
    if (!G.gaping || G.wounds.indexOf(G.gaping) < 0) {
      const vi = this.nearestVertex(corpse, corpse.boneWPos[B.spine], [REGION.ABDOMEN, REGION.TORSO]);
      if (vi >= 0) { this.vertexBind(corpse, vi, _gv6, _gv7); G.gaping = this.addWound(corpse, WOUND.GAPING, _gv6, _gv7, 0.05, { vi, bleed: 0.8, k: 0.2 }); }
    }
    if (G.gaping) { G.gaping.r = Math.min(this.extreme ? 0.17 : 0.1, G.gaping.r + dt * 0.006); G.gaping.k = Math.min(0.99, G.gaping.k + dt * 0.03); G.dirty = true; }
    if (bite) {
      const p = _gv1.copy(zombie.boneWPos[B.jaw]);
      this.spray(p, _gv2.set(0, 0.6, 0), 10, 1.4, 0.8, 0.9, 0.5);
      if (this.extreme && Settings.data.gore.gibs && Math.random() < 0.45) this.gibs.burst(p, _gv2.set(0, 0.5, 0), 1 + Math.floor(Math.random() * 2), Math.random() < 0.6 ? 'organ' : 'flesh', 1.6, 0.8, 0.9);
      this.smear(zombie, B.jaw, 0.06); this.smear(zombie, B.hand_L, 0.05); this.smear(zombie, B.hand_R, 0.05);
      this.sound(p, Math.random() < 0.5 ? 'chew' : 'squelch', 0.75);
      // the body bleeds into a pool
      if (!G.pool) G.pool = this.decals.add(_gv2.copy(corpse.boneWPos[B.spine]).setY(this.game.env.groundHeight(corpse.boneWPos[B.spine].x, corpse.boneWPos[B.spine].z)), this.game.env.groundNormal(corpse.boneWPos[B.spine].x, corpse.boneWPos[B.spine].z, _gv3), 1.5 + Math.random() * 0.5, 'pool', null, { grow: 16 });
    }
  }
  smear(npc, bone, r) {
    const G = this.state(npc);
    const vi = this.nearestVertex(npc, npc.boneWPos[bone], null);
    if (vi < 0) return;
    this.vertexBind(npc, vi, _gv6, _gv7);
    this.addWound(npc, WOUND.SMEAR, _gv6, _gv7, r, { vi: -1, bleed: 0, k: 0.5, grow: 0.01 });
    G.dirty = true;
  }
  // --- per frame -------------------------------------------------------------------------------
  update(dt) {
    const g = this.game;
    this.decals.update(dt);
    this.drops.update(dt, this);
    this.gibs.update(dt, this);
    this.screen.update(dt);
    if (!this.on) return;
    for (const npc of g.npcs.list) {
      const G = npc.gore; if (!G) continue;
      for (const w of G.wounds) if (w.k < 0.99 && w.grow > 0) { w.k = Math.min(0.99, w.k + dt * w.grow); G.dirty = true; }
      const alive = npc.lifeState === 'alive', dead = npc.lifeState === 'dead' || npc.lifeState === 'destroyed';
      const bleedK = alive ? 1 : (dead ? Math.max(0, 1 - (g.time - npc.deathTime) / 30) : 0.12);
      // drips from open wounds
      G.dripT -= dt;
      if (G.dripT <= 0 && bleedK > 0.02) {
        G.dripT = 0.1 + Math.random() * 0.18;
        for (const w of G.wounds) {
          if (w.vi < 0 || w.bleed <= 0 || Math.random() > bleedK * Math.min(1, w.bleed * 0.6)) continue;
          npc.skinVertexWorld(w.vi, _gv1);
          this.drops.emit(_gv1.x, _gv1.y, _gv1.z, (Math.random() - 0.5) * 0.3, -0.2 - Math.random() * 0.3, (Math.random() - 0.5) * 0.3, 0.006 + Math.random() * 0.01, 2, 0.5);
        }
      }
      // arterial spurts (stumps / torn throat), pulsing with the heartbeat
      for (let i = G.spurts.length - 1; i >= 0; i--) {
        const s = G.spurts[i];
        s.t += dt;
        const k = (alive || npc.lifeState === 'reanimating' ? 1 : bleedK) * Math.max(0, 1 - s.t / s.dur);
        if (s.t > s.dur || k <= 0.01) { G.spurts.splice(i, 1); continue; }
        s.beat -= dt;
        if (s.beat > 0) continue;
        s.beat = 0.62 + Math.random() * 0.12;
        let p, d;
        if (s.cut) { p = this.jointWorld(npc, s.cut, s.body, _gv4); d = this.jointDir(npc, s.cut, s.body, _gv5); }
        else { p = npc.skinVertexWorld(s.vi, _gv4); d = _gv5.subVectors(p, npc.boneWPos[B.neck]).normalize(); }
        this.spray(p, d, Math.round(10 * k + 3), 1.6 + 2.6 * k, 0.22, 1.0, 0.65);
        if (Math.random() < 0.5) this.sound(p, 'gush', 0.35 * k + 0.1);
      }
      // pooling under a still body
      if (dead && !G.pool && npc.physMode === 'ragdoll' && (npc.rag.asleep || npc.rag.maxSpeed() < 0.25) && (G.wounds.length || G.anyCut) && Settings.data.gore.pools) {
        const c = npc.rag.bodies[G.headGone ? RAG.CHEST : RAG.SPINE].pos;
        const sz = clamp(0.8 + G.wounds.length * 0.12 + (G.anyCut ? 0.6 : 0), 0.8, 2.4) * (this.extreme ? 1 : 0.7);
        G.pool = this.decals.add(_gv1.set(c.x, g.env.groundHeight(c.x, c.z), c.z), g.env.groundNormal(c.x, c.z, _gv2), sz, 'pool', null, { grow: 10 + sz * 6 });
        if (G.headGone) { const hp = npc.rag.bodies[RAG.CHEST].pos; this.decals.add(_gv1.set(hp.x, g.env.groundHeight(hp.x, hp.z), hp.z), g.env.groundNormal(hp.x, hp.z, _gv2), 0.9, 'pool', null, { grow: 9 }); }
      }
      // bleeding out
      if (alive && G.bleed > 0) {
        npc.health -= G.bleed * dt * 0.6;
        if (npc.health <= 0) { npc.health = 0; npc.die({ weapon: 'bleeding' }); HT.log('death', `${npc.idStr} ${npc.name} bled out`); }
      }
      if (G.dirty) this.uploadWounds(npc);
    }
  }
  // gore cleanup when an NPC is removed / reset
  releaseNPC(npc) {
    const G = npc.gore; if (!G) return;
    if (G.capMesh) { this.game.scene.remove(G.capMesh); G.capMesh.geometry.dispose(); G.capMesh = null; }
    const U = npc.material.userData.u; if (U.uWN) { U.uWN.value = 0; U.uBlood.value = 0; }
    npc.gore = null;
  }
  clear() { this.decals.clear(); this.drops.clear(); this.gibs.clear(); this.screen.clear(); }
}
HT.GoreSystem = GoreSystem;
