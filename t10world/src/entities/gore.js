// T10 World - blood. Sprays when someone is hit, pools where they land, dries
// and fades over a few minutes, and smears under anyone who walks through it.
//
// Everything is one instanced quad mesh per kind plus one particle buffer, so a
// street full of it costs four draw calls no matter how bad it gets.
import * as THREE from '../../vendor/three.module.js';
import { clamp01, clampv, lerpv, makeRng, TAU } from '../core/math.js';
import { settings, perf } from '../core/settings.js';

const MAX_DECALS = 420;
const MAX_DROPS = 900;
const MAX_GIBS = 160;

/**
 * What comes out of a person. Each kind is one instanced mesh, so however much
 * of it ends up on the pavement it is five draw calls.
 */
const GIB_KINDS = [
  { id: 'flesh',  color: 0x8e1b18, rough: 0.52, scale: [0.055, 0.14], weight: 1.0 },
  { id: 'organ',  color: 0x5e0f14, rough: 0.34, scale: [0.070, 0.16], weight: 1.1 },
  { id: 'bone',   color: 0xdfd6c0, rough: 0.72, scale: [0.045, 0.11], weight: 0.9 },
  { id: 'rib',    color: 0xe6dcc4, rough: 0.70, scale: [0.090, 0.17], weight: 0.95 },
  { id: 'brain',  color: 0xc98b96, rough: 0.30, scale: [0.075, 0.13], weight: 1.05 },
];

/** Blood, wet and dried, painted once into a canvas. */
function bloodTexture(seed, dried) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const rng = makeRng(seed);
  ctx.clearRect(0, 0, S, S);

  const base = dried ? [88, 20, 18] : [140, 12, 14];
  const blobs = 5 + rng.int(0, 5);
  for (let i = 0; i < blobs; i++) {
    const a = rng() * TAU;
    const r = rng.range(0, S * 0.22);
    const x = S / 2 + Math.cos(a) * r;
    const y = S / 2 + Math.sin(a) * r;
    const rad = rng.range(S * 0.12, S * 0.30);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const dark = rng.range(0.55, 1);
    g.addColorStop(0, 'rgba(' + Math.round(base[0] * dark) + ',' + Math.round(base[1] * dark) + ',' + Math.round(base[2] * dark) + ',0.95)');
    g.addColorStop(0.7, 'rgba(' + Math.round(base[0] * dark * 0.7) + ',' + Math.round(base[1] * 0.6) + ',' + Math.round(base[2] * 0.6) + ',0.7)');
    g.addColorStop(1, 'rgba(40,6,6,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  }
  // Flecks thrown out from the middle.
  for (let i = 0; i < 26; i++) {
    const a = rng() * TAU;
    const r = rng.range(S * 0.2, S * 0.48);
    const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
    const rad = rng.range(1, 4.5);
    ctx.fillStyle = 'rgba(' + base[0] + ',' + base[1] + ',' + base[2] + ',' + rng.range(0.35, 0.9) + ')';
    ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export class Gore {
  constructor(game) {
    this.game = game;
    this.rng = makeRng(0x9a3f17);
    this.group = new THREE.Group();
    this.group.name = 'gore';
    this.group.matrixAutoUpdate = false;
    game.scene.add(this.group);

    this.decals = [];
    this.dropCount = 0;
    this.gibs = [];
    this.buildDecals();
    this.buildDrops();
    this.buildGibs();
  }

  get level() { return settings.get('goreLevel'); }

  /** How much of the pool this device should actually use, right now. */
  get budget() {
    return clamp01((settings.preset.goreBudget == null ? 1 : settings.preset.goreBudget) * perf.load);
  }
  get decalCap() { return Math.max(40, Math.round(MAX_DECALS * this.budget)); }
  get gibCap() { return Math.max(12, Math.round(MAX_GIBS * this.budget)); }
  get dropCap() { return Math.max(80, Math.round(MAX_DROPS * this.budget)); }

  buildDecals() {
    this.decalMats = [];
    this.decalMesh = [0, 1].map((i) => {
      // Each mesh owns its geometry so it can carry its own per-instance alpha.
      const geo = new THREE.PlaneGeometry(1, 1);
      geo.rotateX(-Math.PI / 2);
      const alpha = new THREE.InstancedBufferAttribute(new Float32Array(MAX_DECALS).fill(1), 1);
      alpha.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aAlpha', alpha);

      const mat = new THREE.MeshBasicMaterial({
        map: bloodTexture(0x1234 + i * 77, i === 1),
        transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      });
      // Three.js has no per-instance opacity, so we add one.
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'attribute float aAlpha;\nvarying float vAlpha;\n' +
          sh.vertexShader.replace('void main() {', 'void main() {\n\tvAlpha = aAlpha;');
        sh.fragmentShader = 'varying float vAlpha;\n' +
          sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.a *= vAlpha;');
      };
      this.decalMats.push(mat);

      const m = new THREE.InstancedMesh(geo, mat, MAX_DECALS);
      m.count = 0;
      m.frustumCulled = false;
      m.renderOrder = 4;
      m.matrixAutoUpdate = false;
      m.castShadow = false;
      m.receiveShadow = false;
      m.userData.wantsShadow = false;
      m.alphaAttr = alpha;
      this.group.add(m);
      return m;
    });
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
  }

  buildDrops() {
    const geo = new THREE.BufferGeometry();
    this.dropPos = new Float32Array(MAX_DROPS * 3);
    this.dropVel = new Float32Array(MAX_DROPS * 3);
    this.dropLife = new Float32Array(MAX_DROPS);
    this.dropSize = new Float32Array(MAX_DROPS);
    geo.setAttribute('position', new THREE.BufferAttribute(this.dropPos, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.dropLife, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.dropSize, 1));
    geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x9b0f12) } },
      vertexShader: `
        attribute float aLife;
        attribute float aSize;
        varying float vLife;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * 160.0 / -mv.z, 1.0, 22.0);
          vLife = aLife;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vLife;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float m = smoothstep(0.5, 0.05, length(d));
          gl_FragColor = vec4(uColor, m * clamp(vLife, 0.0, 1.0));
        }`,
      transparent: true, depthWrite: false, fog: false,
    });
    this.drops = new THREE.Points(geo, mat);
    this.drops.frustumCulled = false;
    this.drops.renderOrder = 890;
    this.drops.matrixAutoUpdate = false;
    this.group.add(this.drops);
    this.dropGeo = geo;
  }

  buildGibs() {
    this.gibMesh = {};
    for (const kind of GIB_KINDS) {
      let geo;
      if (kind.id === 'rib') {
        // A curved sliver of cage, not a lump.
        geo = new THREE.TorusGeometry(0.5, 0.075, 5, 9, Math.PI * 1.15);
        geo.scale(1, 1, 0.42);
      } else if (kind.id === 'brain') {
        geo = new THREE.SphereGeometry(0.5, 7, 5);
        geo.scale(1, 0.82, 1.12);
        // Lobe it, so it isn't a ball.
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const f = 1 + Math.sin(x * 9) * 0.07 + Math.sin(z * 11 + y * 5) * 0.06;
          pos.setXYZ(i, x * f, y * f, z * f);
        }
        geo.computeVertexNormals();
      } else if (kind.id === 'bone') {
        geo = new THREE.CylinderGeometry(0.16, 0.22, 1, 5, 1);
      } else {
        geo = new THREE.IcosahedronGeometry(0.5, 0);
        // Knock it out of shape so no two chunks read the same.
        const pos = geo.attributes.position;
        const rng = makeRng(kind.id === 'organ' ? 31 : 17);
        for (let i = 0; i < pos.count; i++) {
          const f = 0.66 + rng() * 0.7;
          pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f * 0.8, pos.getZ(i) * f);
        }
        geo.computeVertexNormals();
      }
      const mat = new THREE.MeshStandardMaterial({
        color: kind.color, roughness: kind.rough, metalness: 0.02,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, MAX_GIBS);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData.wantsShadow = false;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      this.gibMesh[kind.id] = mesh;
    }
    this._gq = new THREE.Quaternion();
    this._ge = new THREE.Euler();
  }

  /**
   * Take someone apart. `amount` 0..1 decides how much of them there is and
   * whether the head goes with it.
   */
  gib(x, y, z, amount, dirX, dirZ) {
    const level = this.level;
    if (level <= 0) return 0;
    const a = clamp01(amount);
    // 16+ keeps the blood but not the pieces.
    if (level < 0.6) { this.hit(x, y, z, a, dirX, dirZ); return 0; }

    const n = Math.round(lerpv(5, 22, a) * level);
    let made = 0;
    const gibCap = this.gibCap;
    for (let i = 0; i < n && this.gibs.length < gibCap; i++) {
      // Mostly flesh, some bone, a rib or two, and the head's contents only
      // when it was the head.
      const roll = this.rng();
      let kind = roll < 0.44 ? 'flesh' : roll < 0.66 ? 'organ' : roll < 0.84 ? 'bone' : 'rib';
      if (a > 0.85 && i < 2) kind = 'brain';
      const def = GIB_KINDS.find((k) => k.id === kind);
      const spread = 2.2 + a * 5.5;
      this.gibs.push({
        kind,
        x: x + (this.rng() - 0.5) * 0.34,
        y: y + 0.4 + this.rng() * 0.9,
        z: z + (this.rng() - 0.5) * 0.34,
        vx: (dirX || 0) * (1.6 + a * 4) + (this.rng() - 0.5) * spread,
        vy: this.rng.range(1.6, 5.4) * (0.55 + a),
        vz: (dirZ || 0) * (1.6 + a * 4) + (this.rng() - 0.5) * spread,
        rx: this.rng() * TAU, ry: this.rng() * TAU, rz: this.rng() * TAU,
        spinX: (this.rng() - 0.5) * 13, spinY: (this.rng() - 0.5) * 13, spinZ: (this.rng() - 0.5) * 13,
        size: this.rng.range(def.scale[0], def.scale[1]) * lerpv(0.8, 1.15, a),
        drag: def.weight,
        rest: 0,
        age: 0,
        life: 55 + this.rng() * 50,
        bleed: 0.6,
      });
      made++;
    }
    // A burst of spray and a pool to go with it.
    this.spray(x, y + 0.8, z, Math.round(lerpv(20, 60, a)), dirX || 0, dirZ || 0, a);
    this.pool(x, z, lerpv(1.4, 2.6, a));
    return made;
  }

  // -------------------------------------------------------------------------

  /**
   * Somebody got hit here.
   * @param amount 0..1 — a shove versus something that ends badly.
   */
  hit(x, y, z, amount, dirX, dirZ) {
    const level = this.level;
    if (level <= 0) return;
    const a = clamp01(amount) * lerpv(0.45, 1, level);
    this.spray(x, y + 0.9, z, Math.round(lerpv(6, 42, a)), dirX || 0, dirZ || 0, a);
    this.splat(x, z, lerpv(0.5, 1.9, a) * lerpv(0.6, 1, level), a);
  }

  /** A body hitting the ground leaves a pool that keeps growing for a moment. */
  pool(x, z, size) {
    if (this.level <= 0) return;
    this.splat(x, z, (size || 1.4) * lerpv(0.6, 1.25, this.level), 0.9);
  }

  /** One decal on the ground. */
  splat(x, z, size, wetness) {
    const g = this.game;
    const y = (g.world ? g.world.groundAt(x, z) : 0) + 0.015 + this.rng() * 0.004;
    const rec = {
      x, y, z,
      size: size * this.rng.range(0.8, 1.3),
      rot: this.rng() * TAU,
      age: 0,
      // Wet for the first half-minute, then dried and slowly fading.
      life: lerpv(120, 260, clamp01(wetness)),
      alpha: 1,
    };
    this.decals.push(rec);
    const cap = this.decalCap;
    if (this.decals.length > cap) this.decals.splice(0, this.decals.length - cap);
    return rec;
  }

  /** A burst of droplets. */
  spray(x, y, z, count, dirX, dirZ, force) {
    const n = Math.min(count, this.dropCap - this.dropCount);
    for (let i = 0; i < n; i++) {
      const k = this.dropCount++;
      const i3 = k * 3;
      this.dropPos[i3] = x + (this.rng() - 0.5) * 0.3;
      this.dropPos[i3 + 1] = y + (this.rng() - 0.5) * 0.4;
      this.dropPos[i3 + 2] = z + (this.rng() - 0.5) * 0.3;
      const spread = 2.6 + force * 4;
      this.dropVel[i3] = dirX * (2 + force * 5) + (this.rng() - 0.5) * spread;
      this.dropVel[i3 + 1] = this.rng.range(1.2, 4.5) * (0.6 + force);
      this.dropVel[i3 + 2] = dirZ * (2 + force * 5) + (this.rng() - 0.5) * spread;
      this.dropLife[k] = 1;
      this.dropSize[k] = this.rng.range(0.012, 0.05);
    }
  }

  clear() {
    this.decals.length = 0;
    this.dropCount = 0;
    this.gibs.length = 0;
    for (const k of GIB_KINDS) if (this.gibMesh) this.gibMesh[k.id].count = 0;
    for (const m of this.decalMesh) m.count = 0;
    this.dropGeo.setDrawRange(0, 0);
  }

  // -------------------------------------------------------------------------
  update(dt, focus) {
    // ---- Droplets: ballistic, and they leave a mark where they land. ----
    for (let i = this.dropCount - 1; i >= 0; i--) {
      const i3 = i * 3;
      this.dropVel[i3 + 1] -= 16 * dt;
      this.dropPos[i3] += this.dropVel[i3] * dt;
      this.dropPos[i3 + 1] += this.dropVel[i3 + 1] * dt;
      this.dropPos[i3 + 2] += this.dropVel[i3 + 2] * dt;
      this.dropLife[i] -= dt * 0.55;
      const ground = this.game.world ? this.game.world.groundAt(this.dropPos[i3], this.dropPos[i3 + 2]) : 0;
      const landed = this.dropPos[i3 + 1] <= ground + 0.02;
      if (landed || this.dropLife[i] <= 0) {
        if (landed && this.rng() < 0.4) this.splat(this.dropPos[i3], this.dropPos[i3 + 2], this.rng.range(0.12, 0.34), 0.5);
        // Swap the last drop into this slot.
        const last = --this.dropCount;
        if (last !== i) {
          const l3 = last * 3;
          for (let k = 0; k < 3; k++) { this.dropPos[i3 + k] = this.dropPos[l3 + k]; this.dropVel[i3 + k] = this.dropVel[l3 + k]; }
          this.dropLife[i] = this.dropLife[last];
          this.dropSize[i] = this.dropSize[last];
        }
      }
    }
    this.dropGeo.setDrawRange(0, this.dropCount);
    this.dropGeo.attributes.position.needsUpdate = true;
    this.dropGeo.attributes.aLife.needsUpdate = true;
    this.dropGeo.attributes.aSize.needsUpdate = true;

    // ---- Gibs: ballistic until they settle, then they lie there. ----
    if (this.gibs.length) {
      const counts = {};
      for (const k of GIB_KINDS) counts[k.id] = 0;
      for (let i = this.gibs.length - 1; i >= 0; i--) {
        const g = this.gibs[i];
        g.age += dt;
        if (g.age > g.life) { this.gibs.splice(i, 1); continue; }
        if (g.rest <= 0) {
          g.vy -= 15.5 * dt * g.drag;
          g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
          g.rx += g.spinX * dt; g.ry += g.spinY * dt; g.rz += g.spinZ * dt;
          const ground = (this.game.world ? this.game.world.groundAt(g.x, g.z) : 0) + g.size * 0.45;
          if (g.y <= ground) {
            g.y = ground;
            // It leaves a mark every time it lands, until it stops bouncing.
            if (g.bleed > 0.05) { this.splat(g.x, g.z, g.size * this.rng.range(2.4, 5.0), 0.8); g.bleed *= 0.45; }
            if (Math.abs(g.vy) < 1.2) {
              g.rest = 1;
              g.vx = g.vz = g.vy = 0;
              g.spinX = g.spinY = g.spinZ = 0;
              // Lie flat.
              g.rx = Math.PI * 0.5 * (this.rng() < 0.5 ? 1 : -1) * 0.8;
            } else {
              g.vy = -g.vy * 0.28;
              g.vx *= 0.5; g.vz *= 0.5;
              g.spinX *= 0.4; g.spinY *= 0.4; g.spinZ *= 0.4;
            }
          }
        }
        const mesh = this.gibMesh[g.kind];
        const slot = counts[g.kind];
        if (mesh && slot < MAX_GIBS) {
          this._p.set(g.x, g.y, g.z);
          this._ge.set(g.rx, g.ry, g.rz);
          this._gq.setFromEuler(this._ge);
          const fade = g.age > g.life - 6 ? clamp01((g.life - g.age) / 6) : 1;
          this._s.setScalar(g.size * fade);
          this._m.compose(this._p, this._gq, this._s);
          mesh.setMatrixAt(slot, this._m);
          counts[g.kind] = slot + 1;
        }
      }
      for (const k of GIB_KINDS) {
        const mesh = this.gibMesh[k.id];
        mesh.count = counts[k.id];
        if (counts[k.id]) mesh.instanceMatrix.needsUpdate = true;
      }
    } else {
      for (const k of GIB_KINDS) this.gibMesh[k.id].count = 0;
    }

    // ---- Decals: age, dry out, fade, and only the near ones get drawn. ----
    const wet = [], dry = [];
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.age += dt;
      if (d.age > d.life) { this.decals.splice(i, 1); continue; }
      if (focus) {
        const dx = d.x - focus.x, dz = d.z - focus.z;
        if (dx * dx + dz * dz > 160 * 160) continue;
      }
      const t = d.age / d.life;
      d.alpha = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      (d.age < 26 ? wet : dry).push(d);
    }

    for (let k = 0; k < 2; k++) {
      const list = k === 0 ? wet : dry;
      const mesh = this.decalMesh[k];
      const n = Math.min(list.length, MAX_DECALS);
      for (let i = 0; i < n; i++) {
        const d = list[i];
        this._p.set(d.x, d.y, d.z);
        this._q.setFromAxisAngle(this._up, d.rot);
        this._s.set(d.size, 1, d.size);
        this._m.compose(this._p, this._q, this._s);
        mesh.setMatrixAt(i, this._m);
        mesh.alphaAttr.setX(i, d.alpha);
      }
      mesh.count = n;
      if (n) { mesh.instanceMatrix.needsUpdate = true; mesh.alphaAttr.needsUpdate = true; }
    }
  }
}
