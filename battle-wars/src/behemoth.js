// Episode 5 ("Behemoth Awakens"): Behemoth, its crown, the UFO, Eric's tiger form,
// and the new sets (Greg's room, downtown intersection, damaged park).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, mk, grp, rng, hash, canvasTex, clamp, lerp, smoothstep, noise1 } from './util.js';
import { buildHero, pose, locomotion, EXPRESSIONS } from './characters.js';
import { lights, box, plane, streetLamp, tree, building, buildCar } from './sets.js';
import { BEH_N } from './behemothRig.js';
import * as TX from './textures.js';

const P = Math.PI;
const glowTex = () => canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });

// ------------------------------------------------------------------ BEHEMOTH
export function buildBehemoth() {
  const root = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xa4aec0, metalness: 0.3, roughness: 0.38 });
  const plateM = new THREE.MeshStandardMaterial({ color: 0x6c7a90, metalness: 0.35, roughness: 0.3 });
  const spikeM = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.4, roughness: 0.22 });
  const bellyM = new THREE.MeshStandardMaterial({ color: 0xa8aeb8, metalness: 0.4, roughness: 0.45 });
  const seamM = new THREE.MeshStandardMaterial({ color: 0x20102e, emissive: 0xb040ff, emissiveIntensity: 0, roughness: 0.4 });
  const BASE = { metal: new THREE.Color(0xa4aec0), plate: new THREE.Color(0x6c7a90) }, DARK = { metal: new THREE.Color(0x2e2a3a), plate: new THREE.Color(0x1a1622) };
  const sph = new THREE.SphereGeometry(1, 20, 14);
  const cap = new THREE.SphereGeometry(1.1, 20, 8, 0, P * 2, 0, P * 0.36);
  const segs = [];
  for (let i = 0; i < BEH_N; i++) {
    const g = grp(root);
    mk(sph, metal, g, [0, 0, 0], [0, 0, 0], [1.05, 0.95, 1.3]);
    mk(sph, bellyM, g, [0, -0.35, 0.05], [0, 0, 0], [0.8, 0.6, 1.1], false);
    const top = mk(cap, plateM, g, [0, 0.02, 0], [0, 0, 0], [1, 1, 1.25]);
    const sides = [];
    for (const sd of [1, -1]) sides.push(mk(new THREE.BoxGeometry(0.12, 0.7, 1.2), plateM, g, [sd * 0.98, 0.1, 0], [0, 0, sd * 0.25]));
    const spike = grp(g, 0, 0.95, -0.1);
    mk(new THREE.ConeGeometry(0.3, 1, 5), spikeM, spike, [0, 0.5, 0], [-0.35, 0, 0]);
    const seam = mk(new THREE.TorusGeometry(1.0, 0.08, 6, 22), seamM, g, [0, 0, -0.75], [0, 0, 0], null, false);
    const crack = mk(new THREE.BoxGeometry(0.05, 0.6, 0.05), seamM, g, [0.35, 0.55, 0.2], [0.4, 0, 0.9], null, false);
    segs.push({ g, top, spike, seam, crack, sides });
  }
  // legs with claws
  const legs = [];
  for (const [idx, sd] of [[10, 1], [10, -1], [14, 1], [14, -1]]) {
    const g = grp(root);
    mk(new THREE.CapsuleGeometry(0.22, 0.7, 4, 10), metal, g, [0, 0.55, 0], [0, 0, sd * 0.25]);
    mk(new THREE.SphereGeometry(0.3, 12, 10), plateM, g, [0, 0.08, 0.05], [0, 0, 0], [1.1, 0.6, 1.3]);
    const claws = grp(g, 0, 0.02, 0.25);
    for (const cx of [-0.14, 0, 0.14]) mk(new THREE.ConeGeometry(0.06, 0.38, 6), spikeM, claws, [cx, 0, 0.12], [P / 2 - 0.25, 0, 0]);
    legs.push({ g, idx, sd, claws });
  }
  // head
  const head = new THREE.Group(); head.rotation.order = 'YXZ'; root.add(head);
  mk(sph, metal, head, [0, 0, 0], [0, 0, 0], [0.058, 0.045, 0.07]);
  mk(cap, plateM, head, [0, 0.005, -0.005], [0, 0, 0], [0.058, 0.05, 0.075]);
  mk(new RoundedBoxGeometry(0.06, 0.03, 0.07, 2, 0.01), metal, head, [0, -0.006, 0.055]);
  mk(new RoundedBoxGeometry(0.062, 0.012, 0.072, 2, 0.004), plateM, head, [0, 0.012, 0.055]);
  for (const sd of [1, -1]) mk(new THREE.BoxGeometry(0.03, 0.008, 0.035), plateM, head, [sd * 0.03, 0.03, 0.03], [0.2, sd * 0.3, sd * -0.35]);
  // swept-back horns, nostrils and a longer snout so it reads as a dragon
  for (const sd of [1, -1]) {
    const hg = grp(head, sd * 0.035, 0.03, -0.035); hg.rotation.set(-1.15, 0, sd * -0.35);
    mk(new THREE.ConeGeometry(0.011, 0.075, 7), spikeM, hg, [0, 0.035, 0]);
    mk(new THREE.SphereGeometry(0.005, 6, 5), mat(0x111114), head, [sd * 0.012, 0.004, 0.1]);
  }
  mk(new RoundedBoxGeometry(0.045, 0.024, 0.04, 2, 0.008), metal, head, [0, -0.004, 0.085]);
  // teeth along the upper jaw
  const toothG = new THREE.ConeGeometry(0.0045, 0.014, 5);
  for (let i = 0; i < 9; i++) { const a = -1 + (i / 8) * 2; mk(toothG, spikeM, head, [a * 0.026, -0.024, 0.06 + 0.026 * (1 - Math.abs(a))], [P, 0, 0], null, false); }
  const jaw = grp(head, 0, -0.022, 0.0);
  mk(new RoundedBoxGeometry(0.055, 0.016, 0.085, 2, 0.006), metal, jaw, [0, -0.008, 0.045]);
  for (let i = 0; i < 8; i++) { const a = -1 + (i / 7) * 2; mk(toothG, spikeM, jaw, [a * 0.022, 0.004, 0.055 + 0.024 * (1 - Math.abs(a))], [0, 0, 0], null, false); }
  const throatM = new THREE.MeshBasicMaterial({ color: 0x7a1aa8 });
  const throat = mk(new THREE.CircleGeometry(0.024, 18), throatM, head, [0, -0.02, 0.065], [0, 0, 0], [1, 0.6, 1], false);
  // eyes
  const gt = glowTex();
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x7ff0ff });
  const eyes = [];
  for (const sd of [1, -1]) {
    const e = mk(new THREE.SphereGeometry(0.009, 12, 8), eyeM, head, [sd * 0.028, 0.016, 0.052], [0, 0, 0], [1.4, 0.8, 0.6], false);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.06), new THREE.MeshBasicMaterial({ map: gt, color: 0x7ff0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.set(sd * 0.03, 0.016, 0.058); head.add(glow);
    eyes.push({ e, glow });
  }
  // sticky goo Aaron sprays over its eyes (Episode 6)
  const gooM = new THREE.MeshStandardMaterial({ color: 0x7aff6a, roughness: 0.15, metalness: 0.1, emissive: 0x1a6a10, emissiveIntensity: 0.5 });
  const goo = grp(head);
  for (const [x, y, z, r] of [[0.028, 0.016, 0.056, 0.016], [-0.028, 0.016, 0.056, 0.016], [0.0, 0.022, 0.06, 0.012], [0.04, 0.005, 0.05, 0.01], [-0.04, 0.008, 0.05, 0.011], [0.015, 0.0, 0.062, 0.008], [-0.012, 0.003, 0.063, 0.009]]) mk(new THREE.SphereGeometry(r, 10, 8), gooM, goo, [x, y, z], [0, 0, 0], [1.3, 0.8, 0.7], false);
  for (const [x, z] of [[0.03, 0.058], [-0.026, 0.058]]) mk(new THREE.SphereGeometry(0.004, 6, 5), gooM, goo, [x, -0.004, z], [0, 0, 0], [1, 2.6, 1], false);
  goo.visible = false;
  // crest horns (they glow purple when the crown is gone)
  const crestM = new THREE.MeshStandardMaterial({ color: 0x3a3048, metalness: 0.6, roughness: 0.3, emissive: 0xb040ff, emissiveIntensity: 0 });
  for (const [x, y, z, rx] of [[0.022, 0.035, -0.04, -0.9], [-0.022, 0.035, -0.04, -0.9], [0.012, 0.03, -0.058, -1.2], [-0.012, 0.03, -0.058, -1.2]]) mk(new THREE.ConeGeometry(0.008, 0.045, 6), crestM, head, [x, y, z], [rx, 0, x * 8]);
  const headLight = new THREE.PointLight(0x7ff0ff, 0, 1, 1.6); headLight.position.set(0, 0.02, 0.12); head.add(headLight);
  // purple lightning crawling over the body
  const boltGeo = new THREE.BufferGeometry(); boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(160 * 3), 3));
  const bolts = new THREE.LineSegments(boltGeo, new THREE.LineBasicMaterial({ color: 0xe0a0ff, transparent: true, blending: THREE.AdditiveBlending }));
  bolts.frustumCulled = false; root.add(bolts);
  const bodyLight = new THREE.PointLight(0xb040ff, 0, 30, 1.4); root.add(bodyLight);
  const fw = new THREE.Vector3(), tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const cyan = new THREE.Color(0x7ff0ff), red = new THREE.Color(0xff2a2a), col = new THREE.Color();
  const seamPurple = new THREE.Color(0xb040ff), seamBlue = new THREE.Color(0x3aa8ff);
  return {
    root, head,
    // st: { t, rig, jaw, plates, dark, cracks, eyesRed, eyes, crest, bolts, claws }
    update(st) {
      const { rig, t } = st;
      const s = rig.s;
      metal.color.copy(BASE.metal).lerp(DARK.metal, st.dark);
      plateM.color.copy(BASE.plate).lerp(DARK.plate, st.dark);
      const fb = st.flickerBlue ?? 0, bl = Math.max(st.blue ?? 0, fb);
      seamM.emissive.copy(seamPurple).lerp(seamBlue, bl);
      seamM.emissiveIntensity = Math.max(st.cracks, bl * 0.8) * (2.2 + 0.8 * Math.sin(t * 7)) * (fb > 0 ? (Math.sin(t * 29) * Math.sin(t * 11) > 0 ? 1.6 : 0.2) : 1);
      goo.visible = (st.goo ?? 0) > 0.5;
      const dz = st.dissolve ?? 0;
      for (let i = 0; i < BEH_N; i++) {
        const S = segs[i], p = rig.pts[i], r = rig.rad[i];
        const q = rig.pts[Math.min(BEH_N - 1, i + 1)], b = rig.pts[Math.max(0, i - 1)];
        fw.set(q[0] - b[0], q[1] - b[1], q[2] - b[2]).normalize();
        S.g.position.set(p[0], p[1], p[2]);
        tmp.set(p[0] + fw.x, p[1] + fw.y, p[2] + fw.z);
        S.g.lookAt(tmp);
        const dk = clamp((dz * 1.3 - (i / BEH_N) * 0.3) / 1.0);
        S.g.scale.setScalar(r * (1 - dk)); S.g.visible = dk < 0.98;
        const pl = st.plates;
        S.spike.scale.set(1, 0.5 + 1.1 * pl * (0.6 + 0.4 * Math.sin(i * 1.7) ** 2) * (i > BEH_N - 3 ? 0.3 : 1), 1);
        S.top.scale.set(1 + 0.12 * pl, 1, 1.25 + 0.15 * pl);
        S.crack.visible = st.cracks > 0.05 && i % 3 === 1;
      }
      for (const L of legs) {
        const p = rig.pts[L.idx], q = rig.pts[L.idx + 1];
        const yaw = Math.atan2(q[0] - p[0], q[2] - p[2]);
        const r = rig.rad[L.idx];
        L.g.position.set(p[0] + Math.cos(yaw) * L.sd * r * 1.0, Math.max(0, p[1] - r * 1.25), p[2] - Math.sin(yaw) * L.sd * r * 1.0);
        L.g.rotation.set(0, yaw, 0);
        L.g.scale.setScalar(r * 0.75);
        L.claws.scale.setScalar(st.claws);
        L.g.visible = p[1] < r * 2.5;
      }
      head.position.set(rig.head[0], rig.head[1], rig.head[2]);
      head.rotation.set(-rig.pitch, rig.yaw, 0);
      head.scale.setScalar(s * (1 - smoothstep(0.75, 1, dz))); head.visible = dz < 0.99;
      for (const L of legs) L.g.visible = L.g.visible && dz < 0.5;
      jaw.rotation.x = st.jaw * 0.85;
      throat.visible = st.jaw > 0.15;
      throatM.color.setRGB(0.45 + 0.3 * Math.sin(t * 6), 0.1, 0.65);
      col.copy(cyan).lerp(red, st.eyesRed);
      eyeM.color.copy(col);
      for (const e of eyes) { e.glow.material.color.copy(col); e.glow.material.opacity = st.eyes * (0.75 + 0.25 * Math.sin(t * 8)); e.glow.scale.setScalar(0.8 + st.eyes * 0.6); }
      headLight.color.copy(col); headLight.intensity = Math.min(1.2, st.eyes) * s * 0.12; headLight.distance = 0.5 * s;
      crestM.emissiveIntensity = st.crest * (1.5 + Math.sin(t * 10));
      // lightning
      const bk = st.bolts;
      const pos = boltGeo.attributes.position.array;
      let n = 0;
      if (bk > 0.02) {
        const fr = Math.floor(t * 14);
        for (let b = 0; b < 8; b++) {
          if (hash(fr * 3.1 + b) > bk) continue;
          const i0 = 3 + Math.floor(hash(fr * 7.7 + b * 1.3) * (BEH_N - 5));
          let p = rig.pts[i0], r = rig.rad[i0];
          let x = p[0] + (hash(b + fr) - 0.5) * r * 2, y = p[1] + r * (0.4 + hash(b * 2 + fr)), z = p[2] + (hash(b * 3 + fr) - 0.5) * r * 2;
          for (let k = 0; k < 9 && n < 159; k++) {
            const nx = x + (hash(fr + b * 11 + k) - 0.5) * r * 1.4, ny = y + (hash(fr * 2 + b * 5 + k) - 0.45) * r * 1.0, nz = z + (hash(fr * 3 + b * 7 + k) - 0.5) * r * 1.4;
            pos.set([x, y, z, nx, ny, nz], n * 3); n += 2; x = nx; y = ny; z = nz;
          }
        }
      }
      boltGeo.setDrawRange(0, n);
      boltGeo.attributes.position.needsUpdate = true;
      bolts.visible = n > 0;
      const mid = rig.pts[Math.floor(BEH_N * 0.6)];
      bodyLight.position.set(mid[0], mid[1] + rig.rad[10] * 2, mid[2]);
      bodyLight.color.copy(seamPurple).lerp(seamBlue, bl);
      bodyLight.intensity = (Math.max(st.cracks, bl) * 0.5 + bk * (hash(Math.floor(t * 14)) > 0.4 ? 1 : 0.2)) * s * 0.06;
      bodyLight.distance = 2.5 * s;
    },
  };
}

// ------------------------------------------------------------------ THE CROWN
export function buildCrown() {
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const gold = new THREE.MeshStandardMaterial({ color: 0x8a7a8a, metalness: 0.75, roughness: 0.3, side: THREE.DoubleSide });
  const runeM = new THREE.MeshStandardMaterial({ color: 0x2a0a40, emissive: 0xb040ff, emissiveIntensity: 1, roughness: 0.4 });
  mk(new THREE.CylinderGeometry(1, 0.92, 0.5, 28, 1, true), gold, root, [0, 0.25, 0]);
  mk(new THREE.TorusGeometry(0.96, 0.05, 6, 32), gold, root, [0, 0.0, 0], [P / 2, 0, 0]);
  const runes = mk(new THREE.CylinderGeometry(1.015, 0.97, 0.14, 28, 1, true), runeM, root, [0, 0.24, 0]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * P * 2;
    mk(new THREE.ConeGeometry(0.16, 0.6 + (i % 2) * 0.25, 5), gold, root, [Math.sin(a) * 0.97, 0.75 + (i % 2) * 0.12, Math.cos(a) * 0.97]);
    mk(new THREE.OctahedronGeometry(0.09, 0), runeM, root, [Math.sin(a) * 1.0, 0.36, Math.cos(a) * 1.0]);
  }
  const light = new THREE.PointLight(0xb040ff, 0, 4, 1.6); light.position.y = 0.4; root.add(light);
  return {
    root,
    update(st) {
      root.visible = st.vis;
      if (!st.vis) return;
      root.position.set(st.x, st.y, st.z);
      root.rotation.set(st.pitch ?? 0, st.yaw ?? 0, st.roll ?? 0);
      root.scale.setScalar(Math.max(0.001, st.size));
      const g = st.glow;
      runeM.emissive.setRGB(lerp(0.69, 0.23, st.blue ?? 0), lerp(0.25, 0.66, st.blue ?? 0), 1);
      light.color.copy(runeM.emissive);
      runeM.emissiveIntensity = 0.4 + g * (2.2 + 0.8 * Math.sin(st.t * 9));
      light.intensity = Math.min(g, 2.5) * 2.2 * Math.min(4, st.size * 3);
      light.distance = 2 + st.size * 3;
    },
  };
}

// ------------------------------------------------------------------ THE UFO
export function buildUFO() {
  const root = new THREE.Group();
  const nf = (m) => { m.fog = false; return m; };
  const hull = nf(new THREE.MeshStandardMaterial({ color: 0x9aa2b4, metalness: 0.45, roughness: 0.35, emissive: 0x3a4258, emissiveIntensity: 0.9 }));
  const dark = nf(new THREE.MeshStandardMaterial({ color: 0x3a3f4e, metalness: 0.5, roughness: 0.4, emissive: 0x141824, emissiveIntensity: 1 }));
  const prof = [[0, 0.2], [0.32, 0.17], [0.7, 0.08], [1, 0.01], [0.97, -0.04], [0.7, -0.09], [0.3, -0.12], [0, -0.125]].map(([x, y]) => new THREE.Vector2(x, y));
  mk(new THREE.LatheGeometry(prof, 64), hull, root, [0, 0, 0], [0, 0, 0], null, false);
  mk(new THREE.TorusGeometry(0.985, 0.025, 8, 64), dark, root, [0, -0.005, 0], [P / 2, 0, 0], null, false);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * P * 2; mk(new THREE.BoxGeometry(0.02, 0.03, 0.5), dark, root, [Math.sin(a) * 0.55, 0.13, Math.cos(a) * 0.55], [0, a, 0], null, false); }
  const domeM = nf(new THREE.MeshStandardMaterial({ color: 0x6a40c0, emissive: 0x6a30ff, emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.85 }));
  mk(new THREE.SphereGeometry(0.3, 32, 16, 0, P * 2, 0, P / 2), domeM, root, [0, 0.17, 0], [0, 0, 0], [1, 0.6, 1], false);
  const lightsG = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * P * 2;
    const m = nf(new THREE.MeshBasicMaterial({ color: i % 2 ? 0x4ab0ff : 0xb050ff }));
    lightsG.push(mk(new THREE.SphereGeometry(0.022, 8, 6), m, root, [Math.sin(a) * 0.93, -0.02, Math.cos(a) * 0.93], [0, 0, 0], null, false));
  }
  for (let i = 0; i < 16; i++) { const a = (i / 16) * P * 2; mk(new THREE.BoxGeometry(0.05, 0.01, 0.22), nf(new THREE.MeshBasicMaterial({ color: 0x6a8aff })), root, [Math.sin(a) * 0.68, -0.098, Math.cos(a) * 0.68], [0, a, 0], null, false); }
  mk(new THREE.TorusGeometry(0.75, 0.012, 6, 64), nf(new THREE.MeshBasicMaterial({ color: 0xb050ff })), root, [0, -0.085, 0], [P / 2, 0, 0], null, false);
  const ringM = nf(new THREE.MeshBasicMaterial({ color: 0x4ab0ff, transparent: true, opacity: 0.8 }));
  mk(new THREE.TorusGeometry(0.42, 0.02, 6, 48), ringM, root, [0, -0.115, 0], [P / 2, 0, 0], null, false);
  const coreM = nf(new THREE.MeshBasicMaterial({ color: 0xc070ff }));
  const core = mk(new THREE.CircleGeometry(0.17, 32), coreM, root, [0, -0.118, 0], [P / 2, 0, 0], null, false);
  const halves = [];
  for (const sd of [1, -1]) halves.push(mk(new THREE.CircleGeometry(0.175, 24, sd > 0 ? -P / 2 : P / 2, P), dark, root, [0, -0.122, 0], [P / 2, 0, 0], null, false));
  const beamM = nf(new THREE.MeshBasicMaterial({ color: 0xb070ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const beam = mk(new THREE.CylinderGeometry(0.16, 0.5, 1, 32, 1, true), beamM, root, [0, -0.62, 0], [0, 0, 0], null, false);
  return {
    root,
    update(st) {
      root.visible = st.vis;
      if (!st.vis) return;
      root.position.set(st.x, st.y + 0.6 * Math.sin(st.t * 0.6), st.z);
      root.scale.setScalar(st.size);
      root.rotation.set(0.04 * Math.sin(st.t * 0.4), st.t * 0.08, 0.03 * Math.sin(st.t * 0.5));
      lightsG.forEach((m, i) => { m.material.color.set(((i + Math.floor(st.t * 10)) % 6) < 2 ? 0xffffff : i % 2 ? 0x4ab0ff : 0xb050ff); });
      ringM.opacity = 0.6 + 0.4 * Math.sin(st.t * 5);
      const h = st.hatch;
      halves[0].position.x = 0.19 * h; halves[1].position.x = -0.19 * h;
      core.visible = h > 0.02;
      beamM.opacity = st.beam * 0.25 * (0.8 + 0.2 * Math.sin(st.t * 12));
      beam.visible = st.beam > 0.01;
    },
  };
}

// ------------------------------------------------------------------ ERIC'S TIGER FORM
export function buildTiger() {
  const root = new THREE.Group();
  const stripe = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#ff9a2e'; c.fillRect(0, 0, w, h);
    const R = rng(77);
    c.fillStyle = '#1a120c';
    for (let i = 0; i < 16; i++) {
      const y0 = (i / 16) * h + R() * 6, th = 5 + R() * 5;
      for (const seg of [[0.02, 0.4], [0.6, 0.98]]) {
        c.beginPath();
        const x0 = seg[0] * w + R() * 10, x1 = seg[1] * w - R() * 10;
        c.moveTo(x0, y0);
        for (let x = x0; x <= x1; x += 8) c.lineTo(x, y0 + Math.sin(x * 0.05 + i) * 5);
        for (let x = x1; x >= x0; x -= 8) c.lineTo(x, y0 + th * Math.sin(((x - x0) / (x1 - x0)) * P) + Math.sin(x * 0.05 + i) * 5);
        c.fill();
      }
    }
    c.fillStyle = 'rgba(255,240,220,0.9)'; c.fillRect(w * 0.44, 0, w * 0.12, h);
  });
  const fur = new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.85 });
  const orange = mat(0xff9a2e, { r: 0.8 }), white = mat(0xfff0dc, { r: 0.9 }), black = mat(0x1a120c, { r: 0.6 });
  const body = grp(root, 0, 0.78, 0);
  mk(new THREE.CapsuleGeometry(0.27, 0.8, 8, 18), fur, body, [0, 0, 0], [P / 2, 0, 0], [1, 0.95, 1]);
  mk(new THREE.SphereGeometry(0.31, 16, 12), fur, body, [0, 0.03, 0.42], [0, 0, 0], [1, 1, 1]);
  const headG = grp(body, 0, 0.18, 0.72);
  mk(new THREE.SphereGeometry(0.27, 20, 16), fur, headG, [0, 0, 0], [P / 2, 0, 0], [1.05, 0.95, 1]);
  for (const sd of [1, -1]) mk(new THREE.SphereGeometry(0.11, 12, 10), white, headG, [sd * 0.17, -0.08, 0.1], [0, 0, 0], [0.8, 0.9, 0.8]);
  mk(new THREE.SphereGeometry(0.13, 14, 10), white, headG, [0, -0.07, 0.17], [0, 0, 0], [1.1, 0.8, 0.9]);
  mk(new THREE.SphereGeometry(0.045, 10, 8), mat(0xd06070), headG, [0, -0.01, 0.27], [0, 0, 0], [1.2, 0.8, 0.8]);
  for (const sd of [1, -1]) {
    mk(new THREE.SphereGeometry(0.075, 10, 8), orange, headG, [sd * 0.15, 0.17, -0.02], [0, 0, 0], [1, 1, 0.5]);
    mk(new THREE.SphereGeometry(0.045, 8, 6), black, headG, [sd * 0.15, 0.17, -0.04], [0, 0, 0], [1, 1, 0.5]);
    mk(new THREE.SphereGeometry(0.042, 12, 10), mat(0xffd040, { e: 0x6a4a00, ei: 0.4 }), headG, [sd * 0.09, 0.05, 0.19], [0, 0, 0], [1, 0.85, 0.6]);
    mk(new THREE.SphereGeometry(0.02, 8, 6), black, headG, [sd * 0.093, 0.05, 0.215], [0, 0, 0], [0.6, 1.2, 0.5]);
    mk(new THREE.BoxGeometry(0.07, 0.012, 0.02), black, headG, [sd * 0.09, 0.105, 0.2], [0, 0, sd * 0.3]);
  }
  const jaw = grp(headG, 0, -0.11, 0.08);
  mk(new THREE.SphereGeometry(0.09, 12, 8), white, jaw, [0, -0.01, 0.07], [0, 0, 0], [1, 0.45, 1.1]);
  for (const sd of [1, -1]) mk(new THREE.ConeGeometry(0.012, 0.05, 5), mat(0xffffff), headG, [sd * 0.05, -0.13, 0.2], [P, 0, 0]);
  const mouthIn = mk(new THREE.SphereGeometry(0.07, 10, 8), mat(0x6a1a20), headG, [0, -0.12, 0.16], [0, 0, 0], [1, 0.5, 0.8]);
  const legs = [];
  for (const [x, z] of [[0.17, 0.45], [-0.17, 0.45], [0.17, -0.42], [-0.17, -0.42]]) {
    const up = grp(body, x, -0.05, z);
    mk(new THREE.CapsuleGeometry(0.09, 0.3, 4, 10), fur, up, [0, -0.2, 0]);
    const lo = grp(up, 0, -0.38, 0);
    mk(new THREE.CapsuleGeometry(0.07, 0.24, 4, 10), orange, lo, [0, -0.13, 0]);
    mk(new THREE.SphereGeometry(0.09, 10, 8), white, lo, [0, -0.3, 0.04], [0, 0, 0], [1, 0.6, 1.3]);
    legs.push({ up, lo, front: z > 0 });
  }
  const tail = [];
  let parent = grp(body, 0, 0.08, -0.6);
  for (let i = 0; i < 8; i++) {
    const g = grp(parent, 0, 0, i === 0 ? 0 : -0.1);
    mk(new THREE.SphereGeometry(0.05 - i * 0.003, 8, 6), i === 7 ? black : (i % 2 ? black : orange), g, [0, 0, -0.05], [0, 0, 0], [1, 1, 1.4]);
    tail.push(g); parent = g;
  }
  return {
    root, headG,
    // st: { t, act, a, speed, phase }
    update(st) {
      const { t, a } = st, act = st.act ?? 'idle';
      const run = clamp((st.speed ?? 0) / 2.5), ph = st.phase ?? 0;
      body.position.y = 0.78; body.rotation.set(0, 0, 0); headG.rotation.set(0, 0, 0); jaw.rotation.x = 0; mouthIn.visible = false;
      for (let i = 0; i < legs.length; i++) {
        const L = legs[i];
        const off = L.front ? 0 : P * 0.9, sd = i % 2 ? 0.25 : 0;
        const s = Math.sin(ph * 0.8 + off + sd);
        L.up.rotation.x = s * 0.9 * run;
        L.lo.rotation.x = Math.max(0, -Math.cos(ph * 0.8 + off + sd)) * 1.0 * run;
      }
      body.position.y += Math.abs(Math.sin(ph * 0.8)) * 0.08 * run;
      body.rotation.x = Math.sin(ph * 0.8) * 0.08 * run;
      tail.forEach((g, i) => { g.rotation.set(-0.25 + 0.12 * Math.sin(t * 2 + i), 0.25 * Math.sin(t * 2.4 - i * 0.6), 0); });
      if (act === 'idle') body.position.y += 0.01 * Math.sin(t * 2.2);
      if (act === 'roar') { const k = smoothstep(0, 0.25, a) * (1 - smoothstep(1.4, 1.8, a)); jaw.rotation.x = 0.7 * k; headG.rotation.x = -0.35 * k; mouthIn.visible = k > 0.1; body.rotation.x = -0.12 * k; }
      if (act === 'leap') { body.rotation.x = -0.25; legs.forEach((L) => { L.up.rotation.x = L.front ? -1.1 : 1.1; L.lo.rotation.x = 0.2; }); jaw.rotation.x = 0.5; mouthIn.visible = true; }
      if (act === 'crouch') { body.position.y = 0.6; legs.forEach((L) => { L.up.rotation.x = L.front ? 0.5 : -0.4; L.lo.rotation.x = 0.9; }); headG.rotation.x = 0.15; }
      if (act === 'tumble') { body.rotation.z = a * 9; body.rotation.x = a * 4; legs.forEach((L, i) => { L.up.rotation.x = Math.sin(a * 20 + i) * 1.2; }); jaw.rotation.x = 0.6; mouthIn.visible = true; }
    },
  };
}

// ------------------------------------------------------------------ GREG'S ROOM (HQ bedroom)
function letterTex() {
  const tex = canvasTex(512, 680, () => {});
  const { ctx } = tex.userData;
  let last = -1;
  const lines = ['Dear Flare,', '', 'This seems crazy, but I', 'think I have X-ray vision—'];
  tex.draw = (k) => {
    const n = Math.round(k * 200);
    if (n === last) return;
    last = n;
    ctx.fillStyle = '#fbf8ee'; ctx.fillRect(0, 0, 512, 680);
    ctx.strokeStyle = 'rgba(80,130,210,0.35)'; ctx.lineWidth = 2;
    for (let y = 120; y < 680; y += 52) { ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(490, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(220,80,80,0.4)'; ctx.beginPath(); ctx.moveTo(70, 0); ctx.lineTo(70, 680); ctx.stroke();
    ctx.fillStyle = '#1a2a7a'; ctx.font = '700 46px Caveat, "DejaVu Serif", serif'; ctx.textBaseline = 'alphabetic';
    const total = lines.join('').length;
    let left = Math.round(k * total);
    lines.forEach((ln, i) => {
      if (left <= 0) return;
      const part = ln.slice(0, left); left -= ln.length;
      ctx.fillText(part, 84, 110 + i * 52);
    });
    tex.needsUpdate = true;
  };
  tex.draw(0);
  return tex;
}
function skylineTex() {
  return canvasTex(512, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7fbcf0'); g.addColorStop(1, '#e6f2ff');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const R = rng(12);
    for (let i = 0; i < 18; i++) {
      const bw = 20 + R() * 40, bh = 60 + R() * 140, x = R() * w;
      c.fillStyle = ['#8fa4c0', '#a6b6cc', '#7a90ae'][i % 3]; c.fillRect(x, h - bh, bw, bh);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      for (let y = h - bh + 8; y < h - 6; y += 12) for (let xx = x + 4; xx < x + bw - 6; xx += 9) if (R() < 0.6) c.fillRect(xx, y, 4, 5);
    }
  });
}
export function buildGregRoom() {
  const g = new THREE.Group();
  lights(g, { sunPos: [1, 5, -9], target: [0, 0, 0], shadowSize: 7, sunI: 1.6, hemi: 0.95, sky: 0xf2f6ff, ground: 0x6a5a4a, rimColor: 0xbfe0ff, rimI: 0.6, rimPos: [-4, 4, 6] });
  const fill = new THREE.PointLight(0xfff2e0, 5, 10, 1.4); fill.position.set(0, 2.8, 1.2); g.add(fill);
  plane(g, 10, 8, new THREE.MeshStandardMaterial({ map: TX.planksTex('#a8b4c8', '#98a4b8'), roughness: 0.75 }), [0, 0, 0.6]);
  const wall = mat(0xdfe6f2, { r: 0.9 });
  box(g, 10, 3.2, 0.2, 0, [-3.4, 1.6, -3.4], { material: wall, noShadow: true });
  box(g, 10, 3.2, 0.2, 0, [0, 1.6, 4.6], { material: wall, noShadow: true });
  box(g, 0.2, 3.2, 8, 0, [-5, 1.6, 0.6], { material: wall, noShadow: true });
  box(g, 0.2, 3.2, 8, 0, [4.6, 1.6, 0.6], { material: wall, noShadow: true });
  box(g, 10, 0.1, 8, 0, [0, 3.22, 0.6], { material: mat(0xf2f4fa), noShadow: true });
  // big glass window over the desk (the "X-ray" wall)
  plane(g, 3.4, 2.4, new THREE.MeshBasicMaterial({ map: skylineTex() }), [0.6, 1.7, -3.5], [0, 0, 0], false);
  const glass = mat(0xcfe8ff, { r: 0.05, m: 0.1, opacity: 0.18 });
  plane(g, 3.4, 2.4, glass, [0.6, 1.7, -3.3], [0, 0, 0], false);
  const frame = mat(0x1d2a7a, { r: 0.5 });
  for (const x of [-1.15, 0.6, 2.35]) box(g, 0.08, 2.5, 0.12, 0, [x, 1.7, -3.28], { material: frame });
  for (const y of [0.48, 2.92]) box(g, 3.6, 0.1, 0.14, 0, [0.6, y, -3.28], { material: frame });
  box(g, 1.2, 3.2, 0.2, 0, [2.9, 1.6, -3.4], { material: wall, noShadow: true });
  box(g, 1.0, 3.2, 0.2, 0, [4.1, 1.6, -3.4], { material: wall, noShadow: true });
  box(g, 10, 0.08, 0.1, 0, [0, 2.6, -3.28], { material: mat(0x7fd4ff, { e: 0x2f8cff, ei: 0.7 }) });
  // desk + chair + lamp
  box(g, 1.7, 0.06, 0.75, 0x3a4a6a, [0.6, 0.76, -2.75], { round: 0.02 });
  for (const [x, z] of [[-0.18, -3.05], [1.38, -3.05], [-0.18, -2.45], [1.38, -2.45]]) box(g, 0.06, 0.74, 0.06, 0x2a3040, [x, 0.37, z]);
  const chair = grp(g, 0.55, 0, -1.95);
  box(chair, 0.5, 0.06, 0.48, 0x1d2a7a, [0, 0.47, 0], { round: 0.02 });
  box(chair, 0.5, 0.55, 0.06, 0x1d2a7a, [0, 0.78, 0.23], { round: 0.02 });
  mk(new THREE.CylinderGeometry(0.03, 0.03, 0.44, 8), mat(0x333844), chair, [0, 0.23, 0]);
  mk(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 12), mat(0x333844), chair, [0, 0.02, 0]);
  mk(new THREE.CylinderGeometry(0.08, 0.1, 0.03, 12), mat(0x2a3040), g, [1.25, 0.8, -2.95]);
  mk(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6), mat(0x2a3040), g, [1.25, 1.0, -2.95]);
  mk(new THREE.ConeGeometry(0.12, 0.14, 14, 1, true), mat(0xffd040, { e: 0xffc040, ei: 0.5, side: THREE.DoubleSide }), g, [1.2, 1.2, -2.85], [0.5, 0, 0]);
  // the letter + pen
  const ltex = letterTex();
  const paper = plane(g, 0.24, 0.32, new THREE.MeshStandardMaterial({ map: ltex, roughness: 0.9 }), [0.55, 0.792, -2.62], [-P / 2, 0, 0.08], true);
  const pen = grp(g);
  mk(new THREE.CylinderGeometry(0.008, 0.008, 0.15, 8), mat(0x1a3a9a, { r: 0.4 }), pen, [0, 0, 0], [0, 0, P / 2]);
  mk(new THREE.ConeGeometry(0.008, 0.02, 8), mat(0xd0d0d8, { m: 0.7 }), pen, [0.085, 0, 0], [0, 0, -P / 2]);
  // books, pizza box, bed, posters
  for (let i = 0; i < 4; i++) box(g, 0.05, 0.24, 0.18, [0xd02a2a, 0x2f6dff, 0xffd040, 0x3a9a4a][i], [-0.05 + i * 0.055, 0.91, -3.0]);
  box(g, 0.42, 0.05, 0.42, 0xe8dcc4, [-3.5, 0.71, 1.5], { rot: [0, 0.3, 0] });
  const bed = grp(g, -3.6, 0, 0.8);
  box(bed, 1.3, 0.32, 2.3, 0x2a3040, [0, 0.2, 0], { round: 0.03 });
  box(bed, 1.2, 0.2, 2.15, 0xf2f2f4, [0, 0.46, 0], { round: 0.05 });
  box(bed, 1.32, 0.08, 1.3, 0x1d2a7a, [0, 0.6, 0.4], { round: 0.03 });
  box(bed, 0.8, 0.14, 0.38, 0xffffff, [0, 0.62, -0.85], { round: 0.06 });
  for (const [z, t, c1, c2] of [[-1.2, 'BE READY!', '#2f6dff', '#0b1440'], [1.6, 'PIZZA', '#ff8a3d', '#5a1a0a']]) mk(new THREE.PlaneGeometry(0.9, 1.25), new THREE.MeshStandardMaterial({ map: TX.posterTex(t, c1, c2), roughness: 0.8 }), g, [-4.88, 1.9, z], [0, P / 2, 0], null, false);
  mk(new THREE.CylinderGeometry(1.4, 1.4, 0.02, 30), mat(0x3a4a8a, { r: 1 }), g, [-0.8, 0.01, 0.4], [0, 0, 0], [1.3, 1, 0.8]);
  // door on the right wall, hinged at its back edge
  const doorPivot = grp(g, 4.48, 0, 0.1);
  box(doorPivot, 0.08, 2.3, 1.15, 0x1d2a7a, [0, 1.15, 0.58]);
  box(doorPivot, 0.1, 0.06, 0.06, 0xd8d8e0, [-0.06, 1.1, 1.0], { m: 0.7 });
  box(g, 0.14, 2.45, 0.1, 0x10183f, [4.5, 1.22, 0.05]); box(g, 0.14, 2.45, 0.1, 0x10183f, [4.5, 1.22, 1.3]); box(g, 0.14, 0.1, 1.35, 0x10183f, [4.5, 2.42, 0.68]);
  plane(g, 1.15, 2.3, mat(0x9aa8c0, { r: 0.9 }), [4.62, 1.15, 0.68], [0, -P / 2, 0], false);
  return {
    name: 'gregRoom', group: g, bg: new THREE.Color(0x101420), exposure: 1.05,
    update(t, X) {
      const v = X.val;
      ltex.draw(clamp(v('letter.k', 0)));
      doorPivot.rotation.y = v('room.door', 0) * 1.5;
      const r = v('pen.roll', 0);
      pen.visible = v('pen.desk', 1) > 0.5;
      const fall = smoothstep(0.55, 1, r);
      pen.position.set(0.82 + 0.3 * smoothstep(0, 0.55, r) + 0.12 * fall, 0.795 - 0.76 * fall * fall, -2.55 + 0.25 * r);
      pen.rotation.set(r * 14, 0.4, fall * 1.2);
      paper.visible = v('paper.vis', 1) > 0.5;
    },
  };
}

// ------------------------------------------------------------------ DOWNTOWN INTERSECTION
function crackTex() {
  return canvasTex(512, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const R = rng(31);
    c.strokeStyle = 'rgba(20,16,20,0.9)'; c.lineCap = 'round';
    for (let b = 0; b < 11; b++) {
      let x = w / 2, y = h / 2, a = (b / 11) * P * 2 + R() * 0.4;
      c.lineWidth = 9;
      c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 14; k++) { a += (R() - 0.5) * 0.9; x += Math.cos(a) * 18; y += Math.sin(a) * 18; c.lineTo(x, y); c.lineWidth = Math.max(1.5, 9 - k * 0.6); }
      c.stroke();
    }
    c.fillStyle = 'rgba(30,26,30,0.6)'; c.beginPath(); c.arc(w / 2, h / 2, 46, 0, P * 2); c.fill();
  });
}
function markTex() {
  return canvasTex(512, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.translate(w / 2, h / 2);
    c.shadowColor = '#c060ff'; c.shadowBlur = 30;
    c.strokeStyle = '#e0b0ff'; c.lineWidth = 10;
    c.beginPath(); c.arc(0, 0, 200, 0, P * 2); c.stroke();
    c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 150, 0, P * 2); c.stroke();
    for (let i = 0; i < 7; i++) {
      c.save(); c.rotate((i / 7) * P * 2);
      c.beginPath(); c.moveTo(-28, -160); c.lineTo(0, -230); c.lineTo(28, -160); c.stroke();
      c.beginPath(); c.moveTo(0, -150); c.lineTo(0, -60); c.stroke();
      c.restore();
    }
    c.lineWidth = 8; c.beginPath(); c.arc(0, 0, 50, 0, P * 2); c.stroke();
  });
}
export function buildJersey(g, x, z, len, ry = 0) {
  const b = grp(g, x, 0, z); b.rotation.y = ry;
  const m = mat(0xbab4aa, { r: 0.95 });
  const shape = new THREE.Shape();
  shape.moveTo(-0.32, 0); shape.lineTo(0.32, 0); shape.lineTo(0.22, 0.3); shape.lineTo(0.12, 1.0); shape.lineTo(-0.12, 1.0); shape.lineTo(-0.22, 0.3); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
  geo.translate(0, 0, -len / 2);
  mk(geo, m, b, [0, 0, 0], [0, P / 2, 0]);
  for (let i = -len / 2 + 1; i < len / 2; i += 2) box(b, 0.03, 0.12, 0.66, 0xff7a1a, [i, 0.85, 0], { noShadow: true });
  return b;
}
export function buildDowntown() {
  const g = new THREE.Group();
  const L = lights(g, { sunPos: [16, 30, 18], target: [0, 0, 0], shadowSize: 40, sunI: 2.5, hemi: 1.15 });
  L.sun.shadow.camera.far = 120;
  const purple = new THREE.PointLight(0xa050ff, 0, 120, 1.0); purple.position.set(0, 40, 0); g.add(purple);
  const fillPurple = new THREE.HemisphereLight(0x8a50ff, 0x201030, 0); g.add(fillPurple);
  const road = new THREE.MeshStandardMaterial({ map: TX.roadTex(), roughness: 0.9 }); road.map.repeat.set(18, 1);
  plane(g, 180, 8, road, [0, 0, 0]);
  const road2 = new THREE.MeshStandardMaterial({ map: TX.roadTex(), roughness: 0.9 }); road2.map.repeat.set(18, 1);
  plane(g, 180, 8, road2, [0, 0.001, 0], [-P / 2, 0, P / 2]);
  plane(g, 8, 8, mat(0x3d4048, { r: 0.9 }), [0, 0.003, 0]);
  const walkM = new THREE.MeshStandardMaterial({ map: TX.sidewalkTex(), roughness: 0.9 }); walkM.map.repeat.set(45, 1.5);
  for (const z of [-5.5, 5.5]) plane(g, 180, 3, walkM, [0, 0.004, z]);
  const walkM2 = new THREE.MeshStandardMaterial({ map: TX.sidewalkTex(), roughness: 0.9 }); walkM2.map.repeat.set(45, 1.5);
  for (const x of [-5.5, 5.5]) plane(g, 180, 3, walkM2, [x, 0.005, 0], [-P / 2, 0, P / 2]);
  plane(g, 400, 400, mat(0x6a6c70, { r: 1 }), [0, -0.02, 0]);
  for (const s of [-4.05, 4.05]) {
    mk(new THREE.BoxGeometry(180, 0.08, 0.12), mat(0xcfcac0), g, [0, 0.04, s]);
    mk(new THREE.BoxGeometry(0.12, 0.08, 180), mat(0xcfcac0), g, [s, 0.04, 0]);
  }
  // crosswalks on all four sides
  const white = mat(0xf0f0f0, { r: 0.8 });
  for (let i = 0; i < 7; i++) {
    const o = -3 + i;
    for (const s of [-5.2, 5.2]) { plane(g, 0.5, 2.0, white, [o, 0.006, s], [-P / 2, 0, 0]); plane(g, 0.5, 2.0, white, [s, 0.006, o], [-P / 2, 0, P / 2]); }
  }
  // city blocks (the south side opens into a wide city-center plaza)
  const cols = [0xd9c7a7, 0xc9d6e3, 0xe6b8a2, 0xbcd5c0, 0xd8d0e8, 0xf0dcb0, 0xb7c4d6, 0xcfc2b0];
  const R = rng(55);
  let bi = 0;
  const plazaHit = (xc, zc, w, d) => zc > 0 && Math.abs(xc) - w / 2 < 26 && zc - d / 2 < 46;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    // buildings facing the main street (along x)
    let x = 8;
    while (x < 80) {
      const w = 7 + R() * 6, d = 12 + R() * 6, h = 10 + R() * 16 + (R() < 0.15 ? 14 : 0);
      if (!(sx < 0 && sz < 0 && x > 18 && x < 30) && !plazaHit(sx * (x + w / 2), sz * (7 + d / 2), w, d)) building(g, sx * (x + w / 2), sz * (7 + d / 2), w - 0.4, d, h, cols[bi % cols.length], 600 + bi);
      x += w; bi++;
    }
    // buildings facing the cross street (along z)
    let z = 8 + 18;
    while (z < 80) {
      const w = 7 + R() * 6, d = 12 + R() * 6, h = 10 + R() * 18;
      if (!plazaHit(sx * (7 + d / 2), sz * (z + w / 2), d, w)) building(g, sx * (7 + d / 2), sz * (z + w / 2), d, w - 0.4, h, cols[bi % cols.length], 600 + bi);
      z += w; bi++;
    }
  }
  // plaza paving, planters, benches and lamps
  const plazaM = new THREE.MeshStandardMaterial({ map: TX.sidewalkTex(), roughness: 0.9, color: 0xd8d2c8 }); plazaM.map.repeat.set(14, 11);
  plane(g, 52, 40, plazaM, [0, 0.007, 27]);
  for (const [x, z] of [[-18, 14], [18, 14], [-20, 30], [20, 30], [-10, 38], [10, 38]]) {
    mk(new THREE.CylinderGeometry(1.4, 1.5, 0.6, 18), mat(0x9a948a), g, [x, 0.3, z]);
    tree(g, x, z, 1.2, Math.round(x * 7 + z));
  }
  for (const x of [-22, -12, 12, 22]) streetLamp(g, x, 44, -1);
  for (const [x, z, ry] of [[-14, 20, P / 2], [14, 20, -P / 2], [0, 42, P]]) {
    const b = grp(g, x, 0, z); b.rotation.y = ry;
    box(b, 1.8, 0.08, 0.5, 0x8a5a32, [0, 0.45, 0]); box(b, 1.8, 0.4, 0.06, 0x8a5a32, [0, 0.7, -0.22]);
    for (const sx2 of [-0.8, 0.8]) box(b, 0.08, 0.45, 0.45, 0x2b2f36, [sx2, 0.22, 0]);
  }
  // distant towers
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * P * 2, r = 105 + R() * 20;
    building(g, Math.cos(a) * r, Math.sin(a) * r, 10 + R() * 8, 10, 25 + R() * 45, [0xaebcd0, 0xbfc9d8, 0x9fb0c8][i % 3], 900 + i);
  }
  // lamps, lights, trees, benches, a bus stop and parked cars
  for (let x = -60; x <= 60; x += 14) if (Math.abs(x) > 6) { streetLamp(g, x, -4.6, 1); streetLamp(g, x + 7, 4.6, -1); }
  for (const [x, z] of [[-4.6, 4.6], [4.6, -4.6], [4.6, 4.6], [-4.6, -4.6]]) {
    mk(new THREE.CylinderGeometry(0.09, 0.09, 4.4, 8), mat(0x2b2f36), g, [x, 2.2, z]);
    box(g, 0.36, 0.95, 0.32, 0x1c1f24, [x, 4.4, z]);
    mk(new THREE.SphereGeometry(0.1, 10, 8), mat(0xffb020, { e: 0xffa010, ei: 1 }), g, [x, 4.4, z + (z < 0 ? 0.17 : -0.17)]);
  }
  for (const x of [-26, -14, 14, 26, 40]) { tree(g, x, -6.2, 1, x + 31); tree(g, x + 5, 6.2, 1, x + 57); }
  for (const [x, z, ry] of [[-11, 6.4, P], [11, -6.4, 0]]) {
    const b = grp(g, x, 0, z); b.rotation.y = ry;
    box(b, 1.8, 0.08, 0.5, 0x8a5a32, [0, 0.45, 0]);
    box(b, 1.8, 0.4, 0.06, 0x8a5a32, [0, 0.7, -0.22]);
    for (const sx2 of [-0.8, 0.8]) box(b, 0.08, 0.45, 0.45, 0x2b2f36, [sx2, 0.22, 0]);
  }
  const shelter = grp(g, 17, 0, 6.4);
  box(shelter, 3.0, 0.1, 1.3, 0x2b2f36, [0, 2.5, 0]);
  for (const sx2 of [-1.4, 1.4]) box(shelter, 0.08, 2.5, 0.08, 0x2b2f36, [sx2, 1.25, -0.5]);
  plane(shelter, 2.8, 2.2, mat(0xbfe0ff, { r: 0.1, opacity: 0.35 }), [0, 1.3, -0.55], [0, 0, 0], false);
  for (const [x, z, ry, c] of [[-34, -3.0, 0, 0xd02a2a], [28, 3.0, P, 0x2f6dff], [3.0, -30, P / 2, 0xffd040]]) {
    const car = buildCar(); car.position.set(x, 0, z); car.rotation.y = ry; g.add(car);
    car.traverse((o) => {
      if (!o.isMesh) return;
      const hex = o.material?.color?.getHex?.();
      if (hex === 0x1f55e0) o.material = mat(c, { r: 0.35, m: 0.3 });
      else if (hex === 0x7fd4ff) o.material = mat(0x2a2a30, { r: 0.5 });
      else if (hex === 0x2f8cff || o.material.map) o.visible = false;
    });
  }
  // the empty building facade Behemoth smashes through (north-west block)
  const fac = grp(g, -24, 0, -12.5);
  const facM = mat(0xc8b8a0, { r: 0.9 }), facDark = mat(0x3a3640, { r: 0.9 });
  const facPieces = [];
  for (let ix = 0; ix < 4; ix++) for (let iy = 0; iy < 4; iy++) {
    const p = box(fac, 2.9, 2.9, 0.4, 0, [-4.5 + ix * 3, 1.5 + iy * 3, 4.6], { material: facM });
    const w = plane(fac, 1.5, 1.6, facDark, [-4.5 + ix * 3, 1.6 + iy * 3, 4.81], [0, 0, 0], false);
    facPieces.push({ p, w, ix, iy });
  }
  box(fac, 12.4, 0.5, 0.6, 0, [0, 12.3, 4.6], { material: mat(0x8a8078, { r: 0.9 }) });
  const scaffold = mat(0x5a5a62, { r: 0.6, m: 0.5 });
  for (let i = 0; i < 5; i++) mk(new THREE.CylinderGeometry(0.05, 0.05, 12, 6), scaffold, fac, [-6 + i * 3, 6, 5.4]);
  for (let j = 0; j < 4; j++) mk(new THREE.CylinderGeometry(0.04, 0.04, 12, 6), scaffold, fac, [0, 1.5 + j * 3, 5.4], [0, 0, P / 2]);
  const rubble = grp(fac); rubble.visible = false;
  for (let i = 0; i < 26; i++) box(rubble, 0.6 + R() * 1.4, 0.4 + R() * 0.8, 0.6 + R() * 1.2, i % 3 ? 0xc8b8a0 : 0x8a8078, [-5 + R() * 10, 0.3, 4.5 + R() * 4], { rot: [R(), R() * 3, R()] });
  // trash can (Eric lands in it)
  const can = grp(g);
  const canBody = grp(can);
  const canM = mat(0x6a7480, { r: 0.4, m: 0.6 });
  mk(new THREE.CylinderGeometry(0.42, 0.36, 1.05, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0x6a7480, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }), canBody, [0, 0.53, 0]);
  mk(new THREE.CylinderGeometry(0.36, 0.36, 0.03, 18), canM, canBody, [0, 0.02, 0]);
  for (const y of [0.25, 0.75]) mk(new THREE.TorusGeometry(0.4, 0.02, 6, 24), canM, canBody, [0, y, 0], [P / 2, 0, 0]);
  mk(new THREE.CircleGeometry(0.4, 18), mat(0x111114), canBody, [0, 0.9, 0], [-P / 2, 0, 0], null, false);
  const lid = grp(can, 0, 1.06, 0);
  mk(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 18), canM, lid, [0, 0, 0]);
  mk(new THREE.BoxGeometry(0.2, 0.05, 0.05), canM, lid, [0, 0.05, 0]);
  const canStripes = grp(canBody); // trash bits peeking out
  for (let i = 0; i < 6; i++) mk(new THREE.IcosahedronGeometry(0.1, 0), mat([0xd8d0b0, 0x8a6a3a, 0x3a8a4a][i % 3], { r: 0.9 }), canStripes, [Math.sin(i * 2) * 0.2, 0.95, Math.cos(i * 2) * 0.2]);
  // purple mark, road cracks
  const mark = plane(g, 1, 1, new THREE.MeshBasicMaterial({ map: markTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xc070ff }), [0, 0.03, 0]);
  const cracks = plane(g, 1, 1, new THREE.MeshStandardMaterial({ map: crackTex(), transparent: true, depthWrite: false, roughness: 1 }), [0, 0.02, 0]);
  const barrier = buildJersey(g, 0, 0, 6);
  // Episode 6: citizens running for safety
  const CIT = [
    { shirt: 0xd04a3a, pants: 0x2a3a5a, hair: 'wavy', hairColor: 0x2a1a10, skin: 0xe0ac86 }, { shirt: 0x3a8a5a, pants: 0x1a1a22, hair: 'spiky', hairColor: 0x6a3a1e, skin: 0xc48a62 },
    { shirt: 0xf0c040, pants: 0x3a2a1a, hair: 'tall', hairColor: 0x15100c, skin: 0x8a5a3c }, { shirt: 0x8a5ad0, pants: 0x2a2a3a, hair: 'wavy', hairColor: 0x8a3a1a, skin: 0xf2c4a0 },
    { shirt: 0x3a9ad0, pants: 0x1a2a3a, hair: 'spiky', hairColor: 0x15151a, skin: 0xa8734f }, { shirt: 0xe07a2a, pants: 0x2a2a2a, hair: 'wavy', hairColor: 0x4a2a14, skin: 0xe8b28c },
    { shirt: 0xd0d0d8, pants: 0x3a3a50, hair: 'tall', hairColor: 0x2a1a10, skin: 0xd8a07a }, { shirt: 0xc03a7a, pants: 0x1a1a1a, hair: 'spiky', hairColor: 0xb0b0b8, skin: 0xf0c4a0 },
  ];
  const citizens = CIT.map((look, i) => {
    const h = buildHero({ name: `cit${i}`, seed: 40 + i, scale: 0.78 + 0.06 * (i % 3), browColor: 0x1a120c, eyeColor: 0x2a1a10, casual: true, emblem: false, bareHands: true, boot: 0x1a1a1a, belt: 0x1a1a1a, skinDark: look.skin, ...look });
    h.root.visible = false; g.add(h.root);
    const a0 = (i / CIT.length) * P * 2;
    return { h, x0: -6 + (i % 4) * 4 + Math.sin(i * 2.1), z0: 4.5 + (i % 3) * 1.2, dx: Math.sin(i * 1.9) * 0.35, dz: 1, speed: 3.4 + (i % 3) * 0.5, delay: i * 0.45, len: 34 };
  });
  // street signs that get knocked over, abandoned construction barriers, crown shards
  const signs = [];
  for (const [x, z] of [[-6.2, 6.0], [6.2, 6.0], [-6.2, -6.0]]) {
    const sg = grp(g, x, 0, z);
    mk(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 8), mat(0x8a929e, { m: 0.6 }), sg, [0, 1.4, 0]);
    mk(new THREE.BoxGeometry(0.9, 0.22, 0.03), mat(0x2a8a3a, { r: 0.5 }), sg, [0, 2.7, 0]);
    mk(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 8), mat(0xd02a2a, { r: 0.5 }), sg, [0, 2.25, 0.03], [P / 2, 0, 0]);
    signs.push(sg);
  }
  const cons = grp(g, 2, 0, 18);
  const consPieces = [];
  for (let i = 0; i < 5; i++) {
    const b = grp(cons, -4 + i * 2.0, 0, 0);
    box(b, 1.8, 0.25, 0.08, 0xff7a1a, [0, 0.95, 0]); box(b, 1.8, 0.25, 0.08, 0xffffff, [0, 0.62, 0]);
    for (const sx2 of [-0.8, 0.8]) box(b, 0.08, 1.1, 0.5, 0x2a2a30, [sx2, 0.55, 0]);
    consPieces.push(b);
  }
  const shards = grp(g); shards.visible = false;
  const shardM = new THREE.MeshStandardMaterial({ color: 0x8a7a8a, metalness: 0.75, roughness: 0.3, emissive: 0x2a8aff, emissiveIntensity: 0.4 });
  for (let i = 0; i < 9; i++) mk(new THREE.ConeGeometry(0.06 + 0.04 * (i % 3), 0.25, 5), shardM, shards, [Math.cos(i * 2.3) * 0.5 * (0.4 + (i % 3) * 0.3), 0.06, Math.sin(i * 2.3) * 0.45], [P / 2, i, 0.4 * i]);
  const spring = grp(g); spring.visible = false;
  for (let i = 0; i < 8; i++) mk(new THREE.TorusGeometry(0.28, 0.025, 6, 20), mat(0xc8c8d0, { m: 0.8, r: 0.3 }), spring, [0, 0.06 + i * 0.07, 0], [P / 2, 0, 0]);
  const skyDay = TX.skyTex('#3f8fe0', '#9fd0f5', '#e8f4ff');
  const skyShade = TX.skyTex('#33405a', '#5d6d88', '#8e9db4');
  const skyDark = TX.skyTex('#07040e', '#1d0b33', '#3a1a55');
  const skyEve = TX.skyTex('#2b2f6e', '#a0507a', '#ff9a5a');
  const darkBg = new THREE.Color();
  return {
    name: 'downtown', group: g, bg: skyDay, fog: [0xcfe4f5, 60, 220], exposure: 1.0,
    update(t, X) {
      const v = X.val;
      const mode = v('sky.mode', 0); // 0 day, 1 dark storm, 2 evening
      const shade = v('ufo.shade', 0);
      const flash = v('lightning', 0) > 0.5 ? Math.max(0, Math.sin(t * 23) * Math.sin(t * 7.3)) * (hash(Math.floor(t * 9)) > 0.55 ? 1 : 0) : 0;
      if (mode < 0.5) {
        X.scene.background = shade > 0.5 ? skyShade : skyDay;
        X.scene.fog.color.set(shade > 0.5 ? 0x8a96aa : 0xcfe4f5);
        L.sun.intensity = 2.5 * (1 - 0.75 * shade); L.hemi.intensity = 1.15 * (1 - 0.45 * shade);
        L.sun.color.set(0xfff2dd); L.sun.position.set(16, 30, 18);
        fillPurple.intensity = 0.3 * shade; purple.intensity = 0;
      } else if (mode < 1.5) {
        X.scene.background = flash > 0.3 ? darkBg.setRGB(0.35, 0.2, 0.55) : skyDark;
        X.scene.fog.color.set(0x241438);
        L.sun.intensity = 0.9 + flash * 2.5; L.sun.color.set(0xb8b4ff); L.sun.position.set(-14, 30, 20);
        L.hemi.intensity = 0.4 + flash * 0.8;
        fillPurple.intensity = 0.45 + flash * 1.2;
        purple.intensity = 60 * (0.5 + flash * 3);
      } else {
        X.scene.background = skyEve;
        X.scene.fog.color.set(0xb07888);
        L.sun.intensity = 1.5 + flash * 2; L.sun.color.set(0xffa070); L.sun.position.set(-40, 14, 20);
        L.hemi.intensity = 0.7 + flash * 0.6;
        fillPurple.intensity = 0.25 + flash * 1.2;
        purple.intensity = 300 * flash;
      }
      // facade
      const fb = v('facade.break', 0) > 0.5;
      for (const f of facPieces) { const keep = !fb || f.iy >= 3 || (f.ix === 0 && f.iy >= 1) || (f.ix === 3 && f.iy >= 2); f.p.visible = keep; f.w.visible = keep; }
      rubble.visible = fb;
      // trash can
      can.visible = v('can.vis', 1) > 0.5;
      can.position.set(v('can.x', -6.2), v('can.y', 0), v('can.z', 5.6));
      can.scale.set(1, v('can.sq', 1), 1);
      const sp = v('can.spring', 0); spring.visible = sp > 0.01 && can.visible; spring.position.set(can.position.x, 0, can.position.z); spring.scale.set(1, sp, 1);
      if (spring.visible) can.position.y += sp * 0.6;
      const roll = v('can.roll', 0);
      can.rotation.set(0, v('can.ry', 0), 0);
      canBody.rotation.set(roll * P / 2, 0, 0);
      canBody.position.set(0, roll * 0.42, 0);
      canBody.rotation.y = v('can.spin', 0);
      canBody.position.x = Math.sin(t * 50) * 0.03 * v('can.shake', 0);
      lid.visible = v('can.lid', 1) > 0.5 && roll < 0.5;
      lid.rotation.z = Math.sin(t * 40) * 0.15 * v('can.shake', 0);
      const mk2 = v('mark', 0);
      mark.visible = mk2 > 0.01;
      mark.position.set(v('mark.x', 0), 0.03, v('mark.z', 0));
      mark.scale.setScalar(v('mark.size', 4));
      mark.rotation.z = t * 0.2;
      mark.material.opacity = mk2 * (0.75 + 0.25 * Math.sin(t * 4));
      const ck = v('cracks', 0);
      cracks.visible = ck > 0.01;
      cracks.position.set(v('cracks.x', 0), 0.02, v('cracks.z', 0));
      cracks.scale.setScalar(Math.max(0.01, ck * v('cracks.size', 10)));
      // citizens
      const con = v('citizens.on', 0) > 0.5, ct0 = v('citizens.t0', 0);
      for (const c of citizens) {
        const tt = t - ct0 - c.delay, d = tt * c.speed;
        const vis = con && tt > 0 && d < c.len;
        c.h.root.visible = vis;
        if (!vis) continue;
        const nx = c.dx, nz = c.dz, ln = Math.hypot(nx, nz);
        c.h.root.position.set(c.x0 + (nx / ln) * d, 0, c.z0 + (nz / ln) * d);
        c.h.root.rotation.y = Math.atan2(nx, nz);
        const p = locomotion(d / 2.6 * P * 2, 1);
        p.aLF = 2.4 + 0.4 * Math.sin(tt * 13); p.aRF = 2.2 - 0.4 * Math.sin(tt * 13); p.aLO = 0.6; p.aRO = 0.6; p.eL = 0.4; p.eR = 0.4;
        c.h.applyPose(pose(p));
        c.h.applyFace(EXPRESSIONS.shocked, 0.3 + 0.3 * Math.abs(Math.sin(tt * 9)), 0, { x: 0, y: 0 });
      }
      signs.forEach((sg, i) => { const f = v(`sign${i}.fall`, 0); sg.rotation.set(0, 0, f * 1.45 * (i % 2 ? 1 : -1)); });
      const sm = v('cons.smash', 0);
      cons.visible = v('cons.vis', 0) > 0.5; cons.position.set(v('cons.x', 2), 0, v('cons.z', 18)); cons.rotation.y = v('cons.ry', 0);
      consPieces.forEach((b, i) => { b.position.y = sm > 0.5 ? -5 : 0; });
      shards.visible = v('shards', 0) > 0.5; shards.position.set(v('shards.x', 0), 0, v('shards.z', 0));
      shardM.emissiveIntensity = 0.3 + 0.3 * Math.sin(t * 3);
      barrier.visible = v('barrier.vis', 0) > 0.5;
      barrier.position.set(v('barrier.x', 0), 0, v('barrier.z', 0));
      barrier.rotation.y = v('barrier.ry', 0);
    },
  };
}

// ------------------------------------------------------------------ DAMAGED CITY PARK
export function buildParkRuin() {
  const g = new THREE.Group();
  const L = lights(g, { sunPos: [-12, 18, 14], target: [0, 0, 0], shadowSize: 20, sunI: 1.5, hemi: 0.9, sky: 0xc8c0e0, ground: 0x4a5a3a, rimColor: 0xb090ff, rimI: 0.7 });
  L.sun.shadow.camera.far = 90;
  const grass = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#5a8a44'; c.fillRect(0, 0, w, h);
    const r2 = rng(3);
    for (let i = 0; i < 2500; i++) { c.fillStyle = r2() < 0.5 ? 'rgba(40,90,40,0.35)' : 'rgba(120,150,80,0.3)'; c.fillRect(r2() * w, r2() * h, 2, 4); }
  }, { repeat: [16, 16] });
  plane(g, 140, 140, new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }), [0, 0, 0]);
  const R = rng(17);
  const path = mat(0xc9b890, { r: 0.95 });
  for (let i = -10; i <= 10; i++) mk(new THREE.CylinderGeometry(1.4, 1.4, 0.02, 20), path, g, [i * 1.5, 0.01, -3 + Math.sin(i * 0.3) * 1.5], [0, 0, 0], [1, 1, 0.75], false).receiveShadow = true;
  // big concrete barrier the team hides behind
  buildJersey(g, 0, 1.4, 8);
  buildJersey(g, 4.6, 0.2, 3, P / 3);
  // fallen + standing trees, broken bench, rubble, toppled lamp
  for (const [x, z, s] of [[-9, -6, 1.3], [-14, 4, 1.4], [8, -8, 1.2], [13, 6, 1.5], [-6, 10, 1.2], [18, -2, 1.3]]) tree(g, x, z, s, Math.round(x * 3 + z));
  for (const [x, z, ry] of [[-4, 6.5, 0.6], [7, 4.5, -1.1]]) {
    const ft = grp(g, x, 0.25, z); ft.rotation.set(0, ry, P / 2 - 0.05);
    mk(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 8), mat(0x6b4a2e), ft, [0, 1.6, 0]);
    for (let i = 0; i < 3; i++) mk(new THREE.IcosahedronGeometry(0.7, 1), mat(0x4a8a3e, { r: 0.8 }), ft, [(i - 1) * 0.4, 3.4 + i * 0.2, (i % 2) * 0.4]);
  }
  const bench = grp(g, -5, 0, -1.5); bench.rotation.set(0.2, 0.7, 0.35);
  box(bench, 1.8, 0.08, 0.5, 0x8a5a32, [0, 0.45, 0]); box(bench, 1.8, 0.4, 0.06, 0x8a5a32, [0, 0.7, -0.22]);
  const lamp = grp(g, 3, 0, -6); lamp.rotation.z = 1.2;
  mk(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 10), mat(0x2c3340), lamp, [0, 2.1, 0]);
  for (let i = 0; i < 40; i++) box(g, 0.2 + R() * 0.7, 0.15 + R() * 0.4, 0.2 + R() * 0.6, i % 2 ? 0xa8a29a : 0x7a756e, [(R() - 0.5) * 30, 0.1, (R() - 0.5) * 20 + 4], { rot: [R(), R() * 3, R()] });
  // broken fountain
  mk(new THREE.CylinderGeometry(2.2, 2.4, 0.5, 24, 1, false, 0, P * 1.6), mat(0xb8b2a8), g, [-9, 0.25, 0.5]);
  mk(new THREE.CylinderGeometry(0.3, 0.4, 1.4, 12), mat(0xb8b2a8), g, [-9, 0.7, 0.5], [0.3, 0, 0.2]);
  // the street and buildings beyond the park (Behemoth patrols there)
  const road = new THREE.MeshStandardMaterial({ map: TX.roadTex(), roughness: 0.9 }); road.map.repeat.set(16, 1);
  plane(g, 200, 10, road, [0, 0.01, 34]);
  for (let i = 0; i < 16; i++) {
    const x = -70 + i * 9.5 + R() * 2;
    if (Math.abs(x + 4) < 6) continue;
    building(g, x, 46 + R() * 3, 8, 10, 10 + R() * 14, [0xd9c7a7, 0xc9d6e3, 0xe6b8a2, 0xbcd5c0][i % 4], 700 + i);
  }
  for (let i = 0; i < 30; i++) { const a = (i / 30) * P * 2; building(g, Math.cos(a) * 110, Math.sin(a) * 110 + 30, 12, 12, 30 + R() * 40, [0xaebcd0, 0xbfc9d8, 0x9fb0c8][i % 3], 800 + i); }
  for (let x = -40; x <= 40; x += 12) streetLamp(g, x, 28.5, 1);
  return {
    name: 'parkRuin', group: g, bg: TX.skyTex('#2a2240', '#5a4a78', '#9a8ab0'), fog: [0x7a6a90, 50, 200], exposure: 1.0,
    update() {},
  };
}
