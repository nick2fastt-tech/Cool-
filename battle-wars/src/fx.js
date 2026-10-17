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
      n = 0; nb = 0;
      const list = X.T.fx;
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
      drops.count = n;
      drops.instanceMatrix.needsUpdate = true;
      brown.count = nb;
      brown.instanceMatrix.needsUpdate = true;
    },
  };
}
