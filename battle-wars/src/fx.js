// Water effects. Every effect is computed from time t alone (no simulation state),
// so frames can be rendered in any order or in parallel.
import * as THREE from 'three';
import { hash, clamp, lerp, smoothstep } from './util.js';

const G = -9.8;

export function buildFX(parent) {
  const MAX = 2600;
  const dropMat = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85, emissive: 0x1f6fd0, emissiveIntensity: 0.35 });
  const drops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), dropMat, MAX);
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  drops.frustumCulled = false;
  parent.add(drops);
  const brownMat = new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.2 });
  const brown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), brownMat, 200);
  brown.frustumCulled = false;
  parent.add(brown);

  const waterMat = new THREE.MeshStandardMaterial({ color: 0x4fb4ff, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.78, emissive: 0x0a3a90, emissiveIntensity: 0.35, side: THREE.DoubleSide });
  // flood sheet
  const floodGeo = new THREE.PlaneGeometry(1, 1, 60, 24);
  floodGeo.rotateX(-Math.PI / 2);
  const floodBase = Float32Array.from(floodGeo.attributes.position.array);
  const flood = new THREE.Mesh(floodGeo, waterMat);
  flood.receiveShadow = true;
  parent.add(flood);
  // geyser column
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 1, 16, 1, true), waterMat);
  parent.add(column);
  // waves + jets
  const waves = [];
  for (let i = 0; i < 4; i++) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, 0, Math.PI);
    geo.rotateZ(Math.PI / 2); // axis along x
    geo.rotateY(Math.PI / 2); // axis along z
    const m = new THREE.Mesh(geo, waterMat);
    parent.add(m); waves.push(m);
  }
  const jets = [];
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), waterMat); parent.add(m); jets.push(m); }

  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  // glowing particles (fire, energy) and solid ones (debris, smoke, dust), both with per-particle colour
  const GMAX = 3000, SMAX = 1500;
  const glow = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), GMAX);
  const solid = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.85 }), SMAX);
  for (const m of [glow, solid]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.setColorAt(0, new THREE.Color()); parent.add(m); }
  const rings = [];
  for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 48), new THREE.MeshBasicMaterial({ color: 0xff3040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); r.rotation.x = Math.PI / 2; parent.add(r); rings.push(r); }
  const spheres = [];
  for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xa040ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); parent.add(m); spheres.push(m); }
  const fxLights = [];
  for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xff8a30, 0, 6, 1.6); l.visible = false; parent.add(l); fxLights.push(l); }
  const col = new THREE.Color();
  let ng = 0, ns = 0, nl = 0;
  const addG = (x, y, z, s, c) => { if (ng >= GMAX || s <= 0) return; pos.set(x, y, z); sc.setScalar(s); mtx.compose(pos, q, sc); glow.setMatrixAt(ng, mtx); glow.setColorAt(ng, col.set(c)); ng++; };
  const addS = (x, y, z, s, c) => { if (ns >= SMAX || s <= 0) return; pos.set(x, Math.max(0.01, y), z); sc.setScalar(s); mtx.compose(pos, q, sc); solid.setMatrixAt(ns, mtx); solid.setColorAt(ns, col.set(c)); ns++; };
  const light = (x, y, z, c, i) => { if (nl >= fxLights.length) return; const l = fxLights[nl++]; l.visible = true; l.position.set(x, y, z); l.color.set(c); l.intensity = i; };
  const FIRE = [0xfff2a0, 0xffc040, 0xff7a20, 0xff4010];
  function fire(x, y, z, t, rate, size, seed) {
    const life = 0.7;
    const i0 = Math.floor((t - life) * rate), i1 = Math.floor(t * rate);
    for (let i = i0; i <= i1; i++) {
      const a = t - i / rate; if (a < 0 || a > life) continue;
      const h1 = hash(i * 1.7 + seed), h2 = hash(i * 5.3 + seed), h3 = hash(i * 9.1 + seed);
      const k = a / life;
      addG(x + (h1 - 0.5) * size * 0.8 + Math.sin(a * 12 + i) * 0.03 * size, y + a * (0.9 + h2) * size * 1.4, z + (h3 - 0.5) * size * 0.8, size * 0.18 * (1 - k) * (0.6 + h2), FIRE[Math.min(3, Math.floor(k * 4))]);
    }
  }
  function sparkBurst(e, t, color) {
    const a = t - e.t, life = e.life ?? 0.9; if (a < 0 || a > life) return;
    for (let i = 0; i < (e.n ?? 40); i++) {
      const h1 = hash(i * 3.1 + e.t * 7), h2 = hash(i * 7.7 + e.t), h3 = hash(i * 1.3 + e.t * 3);
      const th = h1 * Math.PI * 2, ph = (h2 - 0.3) * Math.PI;
      const sp = (e.speed ?? 4) * (0.4 + h3);
      addG(e.x + Math.cos(th) * Math.cos(ph) * sp * a, e.y + Math.sin(ph) * sp * a - 2 * a * a, e.z + Math.sin(th) * Math.cos(ph) * sp * a, (e.size ?? 0.05) * (1 - a / life), color ?? e.color ?? 0xc060ff);
    }
  }
  function debris(e, t) {
    const a = t - e.t, life = 1.4; if (a < 0 || a > life) return;
    for (let i = 0; i < (e.n ?? 30); i++) {
      const h1 = hash(i * 2.1 + e.t * 5), h2 = hash(i * 6.7 + e.t), h3 = hash(i * 4.4 + e.t * 2);
      const th = h1 * Math.PI * 2, sp = 1 + h2 * 3;
      addS(e.x + Math.cos(th) * sp * a * (e.spread ?? 1), (e.y ?? 1) + (2 + h3 * 3) * a * (e.up ?? 1) - 4.9 * a * a, e.z + Math.sin(th) * sp * a * (e.spread ?? 1), (0.03 + h2 * 0.06) * (e.size ?? 1), e.color ? (h3 < 0.5 ? e.color : (e.color2 ?? e.color)) : (h3 < 0.5 ? 0x8a8378 : 0x5a554e));
    }
    for (let i = 0; i < 14; i++) {
      const h1 = hash(i * 9.9 + e.t), h2 = hash(i * 3.7 + e.t);
      addS(e.x + (h1 - 0.5) * 2 * a, (e.y ?? 1) + h2 * a, e.z + (h2 - 0.5) * 2 * a, (0.15 + 0.4 * a) * (1 - a / life), 0xb0a898);
    }
  }
  function smoke(e, t) {
    const a = t - e.t, life = e.dur ?? 2; if (a < 0 || a > life) return;
    for (let i = 0; i < (e.n ?? 30); i++) {
      const h1 = hash(i * 4.1 + e.t), h2 = hash(i * 8.3 + e.t), h3 = hash(i * 2.9 + e.t);
      const th = h1 * Math.PI * 2, r = (0.2 + h2 * 1.2) * (0.3 + a);
      addS(e.x + Math.cos(th + a) * r, (e.y ?? 1) + h3 * 2 * (0.4 + a * 0.5), e.z + Math.sin(th + a) * r, (0.15 + h2 * 0.25) * (1 + a) * (1 - a / life), h3 < 0.5 ? 0x2a1a3a : 0x3a2a4a);
    }
  }
  let n = 0, nb = 0;
  const add = (x, y, z, s, sy = s) => {
    if (n >= MAX || y < -0.05) return;
    pos.set(x, Math.max(0.01, y), z); sc.set(s, sy, s);
    mtx.compose(pos, q, sc); drops.setMatrixAt(n++, mtx);
  };
  const addB = (x, y, z, s) => { if (nb >= 200) return; pos.set(x, Math.max(0.01, y), z); sc.set(s, s * 0.7, s); mtx.compose(pos, q, sc); brown.setMatrixAt(nb++, mtx); };

  function burst(e, t, adder = add) {
    const a = t - e.t;
    const life = e.life ?? 1.1;
    if (a < 0 || a > life) return;
    const N = e.n ?? 40;
    for (let i = 0; i < N; i++) {
      const h1 = hash(i * 3.1 + e.t * 17), h2 = hash(i * 7.7 + e.t * 3), h3 = hash(i * 1.3 + e.t * 11);
      const ang = h1 * Math.PI * 2;
      const sp = (e.speed ?? 4) * (0.4 + h2 * 0.8);
      const up = (e.up ?? 1) * (0.5 + h3) * (e.speed ?? 4);
      const dirX = e.dir ? e.dir[0] : 0, dirZ = e.dir ? e.dir[1] : 0;
      const x = e.x + (Math.cos(ang) * sp + dirX * (e.speed ?? 4)) * a;
      const z = e.z + (Math.sin(ang) * sp + dirZ * (e.speed ?? 4)) * a;
      const y = (e.y ?? 0.2) + up * a + 0.5 * G * a * a;
      const s = (e.size ?? 0.07) * (0.5 + h2) * (1 - a / life * 0.6);
      adder(x, y, z, s);
    }
  }

  return {
    update(t, X) {
      const v = X.val;
      n = 0; nb = 0; ng = 0; ns = 0; nl = 0;
      const list = X.T.fx;
      for (const r of rings) r.visible = false;
      for (const m of spheres) m.visible = false;
      let ri = 0, si = 0;
      for (const e of list) {
        const a = t - e.t;
        const heroGone = (e.kind === 'flame' || e.kind === 'aura' || e.kind === 'flameSwirl') && X.val(`${e.who}.vis`, 0) < 0.5;
        if (heroGone) continue;
        if (e.kind === 'flame' && a >= 0 && a <= e.dur) {
          const hp = X.hand(e.who, e.side ?? 'R');
          const k = Math.min(1, a / 0.2, (e.dur - a) / 0.25);
          fire(hp.x, hp.y + 0.05, hp.z, t, 90 * k, (e.size ?? 0.35) * k, e.t);
          light(hp.x, hp.y + 0.3, hp.z, 0xff8a30, 4 * k * (0.85 + 0.15 * Math.sin(t * 30)));
        } else if (e.kind === 'fire' && a >= 0 && a <= e.dur) {
          const k = Math.min(1, a / 0.3, (e.dur - a) / 0.5);
          fire(e.x, e.y, e.z, t, 120 * k, (e.size ?? 0.5) * k, e.t);
          light(e.x, e.y + 0.4, e.z, 0xff8a30, 5 * k * (0.85 + 0.15 * Math.sin(t * 25)));
        } else if (e.kind === 'flameSwirl' && a >= 0 && a <= e.dur) {
          const k = Math.min(1, a / 0.5, (e.dur - a) / 0.6);
          const cx = X.val(`${e.who}.x`), cz = X.val(`${e.who}.z`), cy = X.val(`${e.who}.y`);
          for (let j = 0; j < 4; j++) {
            const th = t * 3 + j * Math.PI / 2, r = 0.9;
            fire(cx + Math.cos(th) * r, cy + 0.3 + j * 0.35 + 0.2 * Math.sin(t * 2 + j), cz + Math.sin(th) * r, t, 45 * k, 0.45 * k, e.t + j);
          }
          light(cx, cy + 1.6, cz + 0.5, 0xff8a30, 9 * k);
        } else if (e.kind === 'aura' && a >= 0 && a <= e.dur) {
          const hp = X.hand(e.who, e.side ?? 'R');
          const k = Math.min(1, a / 0.3, (e.dur - a) / 0.4) * (e.power ?? 1);
          for (let j = 0; j < 30; j++) {
            const ag = ((t * 1.5 + hash(j * 3.3)) % 1);
            const th = hash(j * 7.1) * Math.PI * 2 + t * 3;
            addG(hp.x + Math.cos(th) * 0.12 * (1 - ag), hp.y - 0.05 + ag * 0.45, hp.z + Math.sin(th) * 0.12 * (1 - ag), 0.03 * k * (1 - ag) + 0.005, e.color ?? 0xff3040);
          }
          addG(hp.x, hp.y - 0.04, hp.z, 0.13 * k * (0.9 + 0.1 * Math.sin(t * 20)), e.color ?? 0xff3040);
          light(hp.x, hp.y + 0.1, hp.z + 0.2, e.color ?? 0xff3040, 4 * k);
        } else if (e.kind === 'dark' && a >= 0) {
          const k = a / e.dur;
          if (k <= 1) {
            const x = e.from[0] + (e.to[0] - e.from[0]) * k, y = e.from[1] + (e.to[1] - e.from[1]) * k + Math.sin(k * Math.PI) * (e.arc ?? 0.3), z = e.from[2] + (e.to[2] - e.from[2]) * k;
            addG(x, y, z, 0.22 * (e.size ?? 1), 0xd8a0ff);
            addG(x, y, z, 0.38 * (e.size ?? 1), 0x7020c0);
            for (let j = 0; j < 16; j++) { const kk = Math.max(0, k - j * 0.025); addG(e.from[0] + (e.to[0] - e.from[0]) * kk + (hash(j + e.t) - 0.5) * 0.15, e.from[1] + (e.to[1] - e.from[1]) * kk + Math.sin(kk * Math.PI) * (e.arc ?? 0.3), e.from[2] + (e.to[2] - e.from[2]) * kk, 0.12 * (1 - j / 16) * (e.size ?? 1), 0x9040e0); }
            light(x, y, z, 0xa040ff, 6);
          } else {
            const b = { t: e.t + e.dur, x: e.to[0], y: e.to[1], z: e.to[2], n: 50, speed: 3.5, size: 0.06 };
            sparkBurst(b, t, 0xc060ff);
            debris({ t: e.t + e.dur, x: e.to[0], y: e.to[1], z: e.to[2], n: e.debris ?? 30 }, t);
            if (a - e.dur < 0.3) light(e.to[0], e.to[1] + 0.3, e.to[2], 0xa040ff, 8 * (1 - (a - e.dur) / 0.3));
          }
        } else if (e.kind === 'portal' && a >= 0 && a <= e.dur) {
          const k = Math.min(1, a / 0.5, (e.dur - a) / 0.5), r = (e.radius ?? 1.2) * k;
          const ry = e.ry ?? 0, cx = Math.cos(ry), sx = Math.sin(ry);
          for (let j = 0; j < 160; j++) {
            const h1 = hash(j * 2.7), h2 = hash(j * 9.3);
            const ang = h1 * Math.PI * 2 + t * (2 + h2 * 3), rr = r * (0.25 + 0.75 * Math.sqrt(h2));
            const lx = Math.cos(ang) * rr, ly = Math.sin(ang) * rr * 1.3;
            addG(e.x + lx * cx, (e.y ?? 1.3) + ly, e.z - lx * sx, 0.035 + 0.04 * (1 - h2), j % 3 ? (e.color ?? 0xa050ff) : 0xffffff);
          }
          light(e.x, e.y ?? 1.3, e.z, e.color ?? 0xa050ff, 6 * k);
        } else if (e.kind === 'beam' && a >= 0 && a <= e.dur) {
          const hp = X.hand(e.who, e.side ?? 'R');
          const k = Math.min(1, a / 0.1, (e.dur - a) / 0.2);
          const n2 = 40;
          for (let j = 0; j < n2; j++) {
            const u = ((j / n2) + t * 3) % 1;
            const x = hp.x + (e.to[0] - hp.x) * u, y = hp.y + (e.to[1] - hp.y) * u, z = hp.z + (e.to[2] - hp.z) * u;
            addG(x, y, z, (e.width ?? 0.12) * k * (0.8 + 0.4 * hash(j + Math.floor(t * 30))), e.color ?? 0x4aa8ff);
            addG(x, y, z, (e.width ?? 0.12) * 0.45 * k, 0xffffff);
          }
          addG(e.to[0], e.to[1], e.to[2], 0.35 * k, e.color ?? 0x4aa8ff);
          light(hp.x, hp.y, hp.z, e.color ?? 0x4aa8ff, 5 * k);
        } else if (e.kind === 'bodyAura' && a >= 0 && a <= e.dur) {
          // glow rising around a whole character
          if (X.val(`${e.who}.vis`, 0) < 0.5) continue;
          const k = Math.min(1, a / 0.4, (e.dur - a) / 0.5) * (e.power ?? 1);
          const cx = X.val(`${e.who}.x`), cz = X.val(`${e.who}.z`), cy = X.val(`${e.who}.y`);
          for (let j = 0; j < 70; j++) {
            const ag = ((t * 0.9 + hash(j * 3.3)) % 1), th = hash(j * 7.1) * Math.PI * 2 + t * 2;
            const r = 0.42 + 0.1 * Math.sin(t * 3 + j);
            addG(cx + Math.cos(th) * r, cy + ag * 2.0, cz + Math.sin(th) * r, 0.045 * k * (1 - ag) + 0.004, e.color ?? 0x4aa8ff);
          }
          light(cx, cy + 1.2, cz + 0.6, e.color ?? 0x4aa8ff, 6 * k);
        } else if (e.kind === 'fireRings' && a >= 0 && a <= e.dur) {
          // spinning rings of fire orbiting a point like a little galaxy
          const k = Math.min(1, a / 0.6, (e.dur - a) / 0.3);
          const n = e.n ?? 5, R = (e.orbit ?? 1.1) * (0.4 + 0.6 * Math.min(1, a / 0.8));
          for (let i = 0; i < n; i++) {
            const th = t * 1.6 + (i / n) * Math.PI * 2;
            const cx = e.x + Math.cos(th) * R, cz = e.z + Math.sin(th) * R * 0.75, cy = e.y + 0.35 * Math.sin(th * 2 + i);
            const tilt = t * 2 + i;
            for (let j = 0; j < 22; j++) {
              const u = (j / 22) * Math.PI * 2;
              const rx = Math.cos(u) * 0.3, ry = Math.sin(u) * 0.3;
              addG(cx + rx * Math.cos(tilt), cy + ry, cz + rx * Math.sin(tilt), (0.05 + 0.02 * hash(j + Math.floor(t * 20))) * k, FIRE[(j + Math.floor(t * 15)) % 3]);
            }
          }
          addG(e.x, e.y, e.z, 0.12 * k, 0xffe08a);
          light(e.x, e.y + 0.3, e.z + 0.5, 0xff8a30, 10 * k * (0.85 + 0.15 * Math.sin(t * 25)));
        } else if (e.kind === 'orbs' && a >= 0 && a <= e.dur) {
          // energy orbs orbit a character, then fly together to `to`
          const cx = X.val(`${e.who}.x`), cz = X.val(`${e.who}.z`), cy = X.val(`${e.who}.y`);
          const n = e.n ?? 6, m = smoothstep(e.merge ?? e.dur, (e.merge ?? e.dur) + 0.8, a);
          const k = Math.min(1, a / 0.5) * (1 - smoothstep(e.dur - 0.3, e.dur, a));
          for (let i = 0; i < n; i++) {
            const th = t * 2.2 + (i / n) * Math.PI * 2;
            const ox = cx + Math.cos(th) * 0.8, oz = cz + Math.sin(th) * 0.8, oy = cy + 1.1 + 0.4 * Math.sin(th * 2 + i);
            const x = lerp(ox, e.to[0], m), y = lerp(oy, e.to[1], m), z = lerp(oz, e.to[2], m);
            addG(x, y, z, 0.11 * k * (1 - 0.5 * m), e.color ?? 0x4aa8ff);
            addG(x, y, z, 0.05 * k, 0xffffff);
            for (let j = 0; j < 5; j++) { const b = th - 0.12 * (j + 1); addG(lerp(cx + Math.cos(b) * 0.8, e.to[0], m), lerp(cy + 1.1 + 0.4 * Math.sin(b * 2 + i), e.to[1], m), lerp(cz + Math.sin(b) * 0.8, e.to[2], m), 0.05 * k * (1 - j / 5), e.color ?? 0x4aa8ff); }
          }
          light(cx, cy + 1.4, cz + 0.5, e.color ?? 0x4aa8ff, 6 * k);
        } else if (e.kind === 'vring' && a >= 0 && a <= e.dur) {
          // upright ring that grows and cycles through colours
          const k = a / e.dur, r = 0.3 + (e.radius ?? 1.6) * smoothstep(0, 0.7, k);
          const fade = 1 - smoothstep(0.85, 1, k);
          for (let j = 0; j < 72; j++) {
            const u = (j / 72) * Math.PI * 2;
            col.setHSL(((e.hue ?? 0) + k * 1.2 + j / 72 * 0.3) % 1, 1, 0.6);
            const c = col.getHex();
            addG(e.x + Math.cos(u) * r, e.y + Math.sin(u) * r, e.z, 0.07 * fade, c);
          }
          light(e.x, e.y, e.z + 0.6, 0xff60a0, 8 * fade);
        } else if (e.kind === 'rain' && a >= 0 && a <= e.dur) {
          // glittering sparkles drifting down over an area
          const k = Math.min(1, a / 0.3, (e.dur - a) / 0.6);
          for (let j = 0; j < (e.n ?? 160); j++) {
            const h1 = hash(j * 1.9 + e.t), h2 = hash(j * 4.7 + e.t), h3 = hash(j * 8.2 + e.t);
            const fall = (a * (0.7 + h3 * 0.6) + h1 * 0.3);
            const y = (e.top ?? 3.6) - fall * 1.6;
            if (y < 0.05) continue;
            addG(e.x + (h1 - 0.5) * (e.w ?? 6), y, e.z + (h2 - 0.5) * (e.d ?? 4), (0.025 + 0.02 * Math.abs(Math.sin(t * 12 + j))) * k, h3 < 0.7 ? (e.color ?? 0x7fd4ff) : 0xffffff);
          }
        } else if (e.kind === 'sparks') sparkBurst(e, t);
        else if (e.kind === 'debris') debris(e, t);
        else if (e.kind === 'smoke') smoke(e, t);
        else if (e.kind === 'ring' && a >= 0 && a <= (e.dur ?? 0.8) && ri < rings.length) {
          const k = a / (e.dur ?? 0.8), r = rings[ri++];
          r.visible = true; r.position.set(e.x, e.y ?? 0.15, e.z);
          r.scale.set((e.radius ?? 5) * k + 0.2, (e.radius ?? 5) * k + 0.2, 1 + 3 * (1 - k));
          r.material.color.set(e.color ?? 0xff3040); r.material.opacity = 1 - k;
        } else if (e.kind === 'sphere' && a >= 0 && a <= (e.dur ?? 1.2) && si < spheres.length) {
          const k = a / (e.dur ?? 1.2), m = spheres[si++];
          m.visible = true; m.position.set(e.x, e.y ?? 1, e.z); m.scale.setScalar((e.radius ?? 8) * k + 0.1);
          m.material.color.set(e.color ?? 0xa040ff); m.material.opacity = 0.45 * (1 - k);
        } else if (e.kind === 'dust' && a >= 0 && a <= e.dur) {
          // falling dust specks in the area around (x, z)
          for (let j = 0; j < (e.n ?? 120); j++) {
            const h1 = hash(j * 1.9 + e.t), h2 = hash(j * 4.7 + e.t), h3 = hash(j * 8.2 + e.t);
            const fall = ((t * (0.35 + h3 * 0.4) + h1 * 4) % 4);
            addS(e.x + (h1 - 0.5) * (e.w ?? 10), 3.6 - fall, e.z + (h2 - 0.5) * (e.d ?? 6), 0.012 + h3 * 0.012, 0xc8bca8);
          }
        }
      }
      // ---- geyser from hydrant
      const flow = v('hyd.flow', 0);
      column.visible = flow > 0.02;
      if (column.visible) {
        const h = 0.6 + flow * v('hyd.h', 5);
        column.scale.set(0.8 + 0.1 * Math.sin(t * 20), h, 0.8 + 0.1 * Math.cos(t * 23));
        column.position.set(0, 0.7 + h / 2, -4.7);
        const rate = 140 * flow;
        const life = 1.4;
        const i0 = Math.floor((t - life) * rate), i1 = Math.floor(t * rate);
        for (let i = i0; i <= i1; i++) {
          const tb = i / rate, a = t - tb;
          if (a < 0 || a > life) continue;
          const h1 = hash(i * 1.7), h2 = hash(i * 9.1), h3 = hash(i * 4.3);
          const vy = (5 + h1 * 4) * Math.sqrt(flow), ang = h2 * Math.PI * 2, hs = 0.8 + h3 * 1.6;
          add(Math.cos(ang) * hs * a, 0.7 + h + vy * a * 0.4 + 0.5 * G * a * a, -4.7 + Math.sin(ang) * hs * a, 0.06 + h3 * 0.06);
        }
      }
      // ---- swirl (Water Guy forming)
      for (const e of list) {
        if (e.kind === 'swirl') {
          const a = t - e.t;
          if (a < 0 || a > e.dur) continue;
          const k = a / e.dur;
          for (let i = 0; i < 160; i++) {
            const h1 = hash(i * 2.3), h2 = hash(i * 5.9);
            const ang = h1 * Math.PI * 2 + a * (5 + h2 * 4);
            const r = (1.6 - k * 1.2) * (0.5 + h2 * 0.6);
            const y = (e.y ?? 1.5) + (h1 - 0.5) * 3.0 * (1 - k * 0.6);
            add(e.x + Math.cos(ang) * r, y, e.z + Math.sin(ang) * r, 0.05 + h2 * 0.06);
          }
        } else if (e.kind === 'burst') burst(e, t);
        else if (e.kind === 'coffee') burst(e, t, addB);
        else if (e.kind === 'drip') {
          // continuous drips from a character between e.t and e.t + e.dur
          const a = t - e.t;
          if (a < 0 || a > e.dur + 0.6) continue;
          const cx = v(`${e.who}.x`, 0), cz = v(`${e.who}.z`, 0);
          const rate = e.rate ?? 30;
          const i0 = Math.floor((a - 0.6) * rate), i1 = Math.floor(Math.min(a, e.dur) * rate);
          for (let i = Math.max(0, i0); i <= i1; i++) {
            const ag = a - i / rate;
            const h1 = hash(i * 3.3 + e.t), h2 = hash(i * 6.1 + e.t);
            const y = (e.h ?? 1.2) * (0.3 + h1 * 0.7) + 0.5 * G * ag * ag;
            add(cx + (h2 - 0.5) * 0.5, y, cz + (h1 - 0.5) * 0.4, 0.035);
          }
        }
      }
      // ---- jets (water blobs fired by Water Guy)
      let ji = 0;
      for (const j of jets) j.visible = false;
      for (const e of list) {
        if (e.kind !== 'jet') continue;
        const a = t - e.t;
        if (a < 0) continue;
        if (a <= e.dur && ji < jets.length) {
          const k = a / e.dur;
          const m = jets[ji++];
          m.visible = true;
          m.position.set(lerp(e.from[0], e.to[0], k), lerp(e.from[1], e.to[1], k) + Math.sin(k * Math.PI) * (e.arc ?? 1.2), lerp(e.from[2], e.to[2], k));
          const s = e.size ?? 0.3;
          m.scale.set(s, s * 0.85, s * 1.4);
          m.lookAt(e.to[0], e.to[1], e.to[2]);
          // trail
          for (let i = 0; i < 10; i++) {
            const kk = Math.max(0, k - i * 0.03);
            add(lerp(e.from[0], e.to[0], kk) + (hash(i + e.t) - 0.5) * 0.2, lerp(e.from[1], e.to[1], kk) + Math.sin(kk * Math.PI) * (e.arc ?? 1.2), lerp(e.from[2], e.to[2], kk), s * 0.3 * (1 - i / 10));
          }
        }
        if (a > e.dur) burst({ t: e.t + e.dur, x: e.to[0], y: 0.1, z: e.to[2], n: e.n ?? 50, speed: 3.2, up: 1.1, size: 0.08 }, t);
      }
      // ---- waves
      let wi = 0;
      for (const w of waves) w.visible = false;
      for (const e of list) {
        if (e.kind !== 'wave') continue;
        const a = t - e.t;
        if (a < 0) continue;
        const k = a / e.dur;
        if (k <= 1 && wi < waves.length) {
          const m = waves[wi++];
          m.visible = true;
          const hgt = (e.height ?? 1.2) * Math.sin(Math.min(1, k * 1.5) * Math.PI * 0.5) * (1 - 0.2 * k);
          m.position.set(lerp(e.from[0], e.to[0], k), 0, lerp(e.from[1], e.to[1], k));
          m.scale.set(hgt * 0.9, hgt, (e.width ?? 6) / 2);
          m.rotation.y = Math.atan2(e.to[0] - e.from[0], e.to[1] - e.from[1]) - Math.PI / 2;
          // foam along crest
          for (let i = 0; i < 40; i++) {
            const zz = (hash(i * 1.9) - 0.5) * (e.width ?? 6);
            const dx = Math.cos(m.rotation.y), dz = -Math.sin(m.rotation.y);
            add(m.position.x + dx * zz + Math.sin(t * 9 + i) * 0.1, hgt * (0.9 + 0.2 * hash(i + Math.floor(t * 12))), m.position.z + dz * zz, 0.07);
          }
        }
        if (k > 1) {
          const nn = Math.round((e.width ?? 6) * 12);
          const a2 = t - (e.t + e.dur);
          if (a2 < 1.3) {
            for (let i = 0; i < nn; i++) {
              const zz = (hash(i * 2.9 + e.t) - 0.5) * (e.width ?? 6);
              const h1 = hash(i * 4.1 + e.t), h2 = hash(i * 8.3 + e.t);
              const dx = Math.cos(Math.atan2(e.to[0] - e.from[0], e.to[1] - e.from[1]) - Math.PI / 2);
              const dz = -Math.sin(Math.atan2(e.to[0] - e.from[0], e.to[1] - e.from[1]) - Math.PI / 2);
              const back = e.back ?? -1;
              const x = e.to[0] + dx * zz + back * (1 + h1 * 2) * a2;
              const z = e.to[1] + dz * zz + (h2 - 0.5) * 2 * a2;
              const y = 0.3 + (5 + h2 * 4) * (e.height ?? 1.2) * 0.6 * a2 + 0.5 * G * a2 * a2;
              add(x, y, z, 0.09 * (1 - a2 / 1.6));
            }
          }
        }
      }
      // ---- flood sheet
      const fk = v('flood', 0);
      flood.visible = fk > 0.005;
      if (flood.visible) {
        const cx = v('flood.cx', 0), cz = -0.5;
        const x0 = cx - fk * 16, x1 = Math.min(v('flood.stop', 5.8), cx + fk * 12);
        const z0 = cz - Math.min(1, fk * 1.5) * 5.6, z1 = cz + Math.min(1, fk * 1.5) * 5.0;
        flood.position.set((x0 + x1) / 2, 0.02 + 0.13 * fk, (z0 + z1) / 2);
        flood.scale.set(x1 - x0, 1, z1 - z0);
        const arr = floodGeo.attributes.position.array;
        for (let i = 0; i < arr.length; i += 3) {
          const bx = floodBase[i], bz = floodBase[i + 2];
          const wx = flood.position.x + bx * (x1 - x0), wz = flood.position.z + bz * (z1 - z0);
          const edge = Math.min(1, (0.5 - Math.abs(bx)) * 8) * Math.min(1, (0.5 - Math.abs(bz)) * 8);
          arr[i + 1] = (0.05 * Math.sin(wx * 1.3 + t * 3) + 0.04 * Math.sin(wz * 1.7 - t * 2.4)) * edge * fk - (1 - edge) * 0.1;
        }
        floodGeo.attributes.position.needsUpdate = true;
        floodGeo.computeVertexNormals();
      }
      glow.count = ng; glow.instanceMatrix.needsUpdate = true; if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
      solid.count = ns; solid.instanceMatrix.needsUpdate = true; if (solid.instanceColor) solid.instanceColor.needsUpdate = true;
      for (let i = nl; i < fxLights.length; i++) { fxLights[i].intensity = 0; fxLights[i].visible = false; }
      drops.count = n;
      drops.instanceMatrix.needsUpdate = true;
      brown.count = nb;
      brown.instanceMatrix.needsUpdate = true;
    },
  };
}
