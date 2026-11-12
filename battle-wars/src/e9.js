// Episode 9 "The Illusion": the Soul Stealer's dungeon (Fred's vision), the endless hallway (Greg's illusion),
// the blue-eyed titan, Aaron's energy barrier and the black cloak the Soul Stealer throws off.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, mk, grp, rng, hash, canvasTex, clamp, lerp, smoothstep } from './util.js';
import { box, plane } from './sets.js';
import * as TX from './textures.js';

const P = Math.PI;

function stoneTex(seed, base, line, rep = [4, 4]) {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    const R = rng(seed);
    for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -24 : 0; x < w; x += 48) {
      const k = 0.75 + R() * 0.25;
      c.fillStyle = `rgba(${Math.round(60 * k)},${Math.round(52 * k)},${Math.round(70 * k)},0.35)`; c.fillRect(x + 2, y + 2, 44, 28);
    }
    c.strokeStyle = line; c.lineWidth = 3;
    for (let y = 0; y < h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); for (let x = (y / 32) % 2 ? -24 : 0; x < w; x += 48) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 32); c.stroke(); } }
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(0,0,0,${0.15 * R()})`; c.beginPath(); c.arc(R() * w, R() * h, 2 + R() * 6, 0, 7); c.fill(); }
  }, { repeat: rep });
}
const glowTex = () => canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
const addMat = (o) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...o });

// ------------------------------------------------------------------ THE SOUL STEALER'S DUNGEON (seen in Fred's vision)
export function buildDungeon() {
  const g = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0x8a7ab0, 0x1a1424, 1.0); g.add(hemi);
  const lampL = new THREE.PointLight(0xffb070, 18, 11, 1.25); lampL.position.set(1.8, 3.1, 1.2); g.add(lampL);
  const cellL = new THREE.PointLight(0xb0b8ff, 22, 7, 1.2); cellL.position.set(0, 2.8, -2.0); g.add(cellL);
  const purpleL = new THREE.PointLight(0xa040ff, 0, 9, 1.3); purpleL.position.set(0.2, 1.8, -1.4); g.add(purpleL);
  const floorM = new THREE.MeshStandardMaterial({ map: stoneTex(91, '#2a2430', 'rgba(8,6,10,0.7)', [5, 5]), roughness: 0.95 });
  plane(g, 16, 16, floorM, [0, 0, 2]);
  const wallM = new THREE.MeshStandardMaterial({ map: stoneTex(92, '#2c2632', 'rgba(8,6,10,0.75)', [5, 2]), roughness: 1 });
  box(g, 16, 4.6, 0.4, 0, [0, 2.3, -4.4], { material: wallM, noShadow: true });
  box(g, 0.4, 4.6, 14, 0, [-6.2, 2.3, 2.6], { material: wallM, noShadow: true });
  box(g, 0.4, 4.6, 14, 0, [6.2, 2.3, 2.6], { material: wallM, noShadow: true });
  box(g, 16, 0.3, 14, 0x141018, [0, 4.6, 2.6], { noShadow: true });
  // the cell: stone side walls, a lintel and a row of iron bars
  box(g, 0.5, 3.2, 4.0, 0, [-2.6, 1.6, -2.4], { material: wallM });
  box(g, 0.5, 3.2, 4.0, 0, [2.6, 1.6, -2.4], { material: wallM });
  box(g, 5.7, 1.4, 0.5, 0, [0, 3.9, -0.4], { material: wallM });
  const iron = mat(0x34343c, { m: 0.75, r: 0.4 });
  const barG = new THREE.CylinderGeometry(0.045, 0.045, 3.2, 8);
  for (let x = -2.25; x <= 2.26; x += 0.3) mk(barG, iron, g, [x, 1.6, -0.4]);
  for (const y of [0.15, 1.3, 3.05]) box(g, 4.8, 0.1, 0.12, 0, [0, y, -0.4], { material: iron });
  // lock + chains + straw + bucket + stool
  box(g, 0.22, 0.28, 0.16, 0x5a4a3a, [1.15, 1.3, -0.3], { m: 0.6, r: 0.4 });
  for (const sx of [-1.4, 1.4]) for (let i = 0; i < 7; i++) mk(new THREE.TorusGeometry(0.05, 0.014, 6, 10), iron, g, [sx, 3.1 - i * 0.11, -4.15], [0, i % 2 ? P / 2 : 0, 0]);
  const R = rng(7);
  for (let i = 0; i < 70; i++) mk(new THREE.BoxGeometry(0.02, 0.01, 0.25 + R() * 0.2), mat(0xc8a648, { r: 0.9 }), g, [(R() - 0.5) * 4.4, 0.012 + R() * 0.03, -2.4 + (R() - 0.5) * 3.4], [0, R() * P, 0], null, false);
  mk(new THREE.CylinderGeometry(0.2, 0.16, 0.32, 14, 1, true), mat(0x5a4a3a, { r: 0.7, side: THREE.DoubleSide }), g, [-1.9, 0.16, -3.6]);
  box(g, 0.5, 0.05, 0.5, 0x4a3426, [-3.6, 0.5, 1.2], { round: 0.02 });
  for (const [x, z] of [[-3.8, 1.0], [-3.4, 1.0], [-3.8, 1.4], [-3.4, 1.4]]) box(g, 0.05, 0.5, 0.05, 0x3a2a1e, [x, 0.25, z]);
  // hanging lamp outside the cell
  mk(new THREE.CylinderGeometry(0.01, 0.01, 1.4, 4), iron, g, [1.8, 3.9, 1.2]);
  mk(new THREE.ConeGeometry(0.22, 0.2, 12, 1, true), mat(0x2a2a30, { m: 0.6, side: THREE.DoubleSide }), g, [1.8, 3.2, 1.2]);
  const bulb = mk(new THREE.SphereGeometry(0.07, 10, 8), mat(0xffc080, { e: 0xffa050, ei: 2.0 }).clone(), g, [1.8, 3.1, 1.2], [0, 0, 0], null, false);
  // wall torches
  const torches = [];
  for (const sx of [-5.95, 5.95]) {
    box(g, 0.12, 0.4, 0.12, 0x2a2a30, [sx, 2.3, -1.0], { m: 0.6 });
    const fl = mk(new THREE.ConeGeometry(0.12, 0.38, 8), mat(0xffa040, { e: 0xff7a20, ei: 2.2 }).clone(), g, [sx, 2.7, -1.0], [0, 0, 0], null, false);
    const l = new THREE.PointLight(0xff8a40, 10, 8, 1.4); l.position.set(sx * 0.9, 2.8, -1.0); g.add(l);
    torches.push({ fl, l });
  }
  return {
    name: 'dungeon', group: g, bg: new THREE.Color(0x040306), fog: [0x07040c, 9, 26], exposure: 1.4,
    update(t, X) {
      const v = X.val;
      torches.forEach((o, i) => { const f = 0.8 + 0.2 * Math.sin(t * 13 + i * 2) + 0.1 * Math.sin(t * 29 + i); o.fl.scale.set(1, f, 1); o.l.intensity = 10 * f; });
      const fl = hash(Math.floor(t * 9)) > 0.15 ? 1 : 0.4;
      lampL.intensity = 18 * fl; bulb.material.emissiveIntensity = 2 * fl;
      purpleL.intensity = v('dungeon.purple', 0) * (14 + 5 * Math.sin(t * 6));
    },
  };
}

// ------------------------------------------------------------------ THE ENDLESS HALLWAY (Greg's illusion)
export function buildEndlessHall() {
  const g = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0x9a3a7a, 0x1a0614, 0.55); g.add(hemi);
  const LEN = 240, W = 2.4, H = 3.0;
  const floorTex = TX.planksTex('#c69a6a', '#b98d5f'); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(1, 40);
  const floorM = new THREE.MeshStandardMaterial({ map: floorTex, color: 0x8a5a7a, roughness: 0.7 });
  plane(g, W, LEN, floorM, [0, 0, 2 - LEN / 2]);
  const paper = canvasTex(128, 256, (c, w, h) => {
    c.fillStyle = '#2a0f44'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { c.fillStyle = 'rgba(120,40,160,0.35)'; c.fillRect(x, 0, 12, h); }
    for (let y = 0; y < h; y += 64) { c.strokeStyle = 'rgba(200,120,255,0.18)'; c.lineWidth = 2; c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, y + 10 * Math.sin(x / 10)); c.stroke(); }
    c.fillStyle = 'rgba(10,2,16,0.6)'; c.fillRect(0, h - 40, w, 40);
  }, { repeat: [LEN / 1.6, 1] });
  const wallM = new THREE.MeshStandardMaterial({ map: paper, roughness: 0.9 });
  const walls = [];
  for (const sd of [-1, 1]) walls.push(plane(g, LEN, H, wallM, [sd * W / 2, H / 2, 2 - LEN / 2], [0, -sd * P / 2, 0], true));
  plane(g, W, LEN, mat(0x14060f, { r: 1 }), [0, H, 2 - LEN / 2], [P / 2, 0, 0], false);
  // doors along both sides and red ceiling lamps (instanced: cheap)
  const doorGeo = new RoundedBoxGeometry(0.06, 2.1, 0.95, 2, 0.02), frameGeo = new THREE.BoxGeometry(0.05, 2.25, 1.15), lampGeo = new THREE.BoxGeometry(0.5, 0.06, 0.5);
  const doorM = mat(0x1a0a22, { r: 0.6 }), frameM = mat(0x3a1250, { r: 0.6 });
  const lampM = new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff1020, emissiveIntensity: 2.2 });
  const nDoors = Math.floor(LEN / 3.5), nLamps = Math.floor(LEN / 4);
  const doors = new THREE.InstancedMesh(doorGeo, doorM, nDoors), frames = new THREE.InstancedMesh(frameGeo, frameM, nDoors), lamps = new THREE.InstancedMesh(lampGeo, lampM, nLamps);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < nDoors; i++) {
    const sd = i % 2 ? 1 : -1, z = -2 - i * 3.5;
    m4.makeTranslation(sd * (W / 2 - 0.035), 1.05, z); doors.setMatrixAt(i, m4);
    m4.makeTranslation(sd * (W / 2 - 0.02), 1.12, z); frames.setMatrixAt(i, m4);
  }
  for (let i = 0; i < nLamps; i++) { m4.makeTranslation(0, H - 0.03, -i * 4); lamps.setMatrixAt(i, m4); }
  for (const im of [doors, frames, lamps]) { im.receiveShadow = true; g.add(im); }
  // a few real red lights that travel with whoever runs down the hall
  const reds = [];
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xff2030, 12, 9, 1.4); g.add(l); reds.push(l); }
  // the far end: a door that keeps moving away
  const endG = grp(g, 0, 0, -20);
  box(endG, W, H, 0.2, 0, [0, H / 2, -0.1], { material: wallM, noShadow: true });
  box(endG, 1.1, 2.2, 0.05, 0, [0, 1.1, 0.02], { material: new THREE.MeshBasicMaterial({ color: 0xffe8f8 }), noShadow: true });
  const endGlow = mk(new THREE.PlaneGeometry(2.8, 3.4), addMat({ map: glowTex(), color: 0xff90e0, opacity: 0.7 }), endG, [0, 1.2, 0.1], [0, 0, 0], null, false);
  return {
    name: 'hall9', group: g, bg: new THREE.Color(0x05010a), fog: [0x12020e, 8, 70], exposure: 1.1,
    update(t, X) {
      const v = X.val;
      const far = v('hall.far', 20), warp = v('hall.warp', 1);
      endG.position.z = -far;
      endGlow.material.opacity = 0.55 + 0.2 * Math.sin(t * 3);
      for (let i = 0; i < 2; i++) walls[i].position.x = (i ? 1 : -1) * (W / 2 + 0.05 * warp * Math.sin(t * 2.2 + i * 1.3));
      const gz = v('greg.z', 0), base = Math.round(gz / 4) * 4;
      reds.forEach((l, i) => { l.position.set(0, H - 0.3, base + 4 - i * 4); l.intensity = 12 * (0.8 + 0.2 * Math.sin(t * 7 + i)); });
      lampM.emissiveIntensity = 2.0 + 0.4 * Math.sin(t * 9);
    },
  };
}

// ------------------------------------------------------------------ THE BLUE-EYED TITAN
// About 14 m tall: a hunched giant of dark stone, long arms down to the ground, crystal spikes on its back,
// four glowing blue eyes. Faces +z.
export function buildTitan() {
  const root = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x1c2030, roughness: 0.85, metalness: 0.15 });
  const plateM = new THREE.MeshStandardMaterial({ color: 0x2c3348, roughness: 0.55, metalness: 0.4 });
  const crystal = new THREE.MeshStandardMaterial({ color: 0x5ac8ff, emissive: 0x2a8cff, emissiveIntensity: 1.4, roughness: 0.2, metalness: 0.1 });
  const crackM = new THREE.MeshBasicMaterial({ color: 0x3aa8ff });
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xbff0ff });
  const gT = glowTex();
  const hips = grp(root, 0, 5.6, 0);
  mk(new THREE.SphereGeometry(2.3, 20, 14), stone, hips, [0, 0, 0], [0, 0, 0], [1.25, 0.8, 0.95]);
  const chest = grp(hips, 0, 1.0, 0);
  mk(new THREE.SphereGeometry(3.3, 26, 18), stone, chest, [0, 3.3, 0.2], [0.25, 0, 0], [1.28, 1.0, 0.86]);
  for (const sd of [1, -1]) mk(new RoundedBoxGeometry(2.3, 2.1, 0.8, 2, 0.35), plateM, chest, [sd * 1.25, 4.2, 2.55], [0.38, sd * 0.28, 0]);
  mk(new RoundedBoxGeometry(2.6, 1.3, 0.7, 2, 0.3), plateM, chest, [0, 2.1, 2.6], [0.1, 0, 0]);
  const core = mk(new THREE.IcosahedronGeometry(0.62, 1), crystal, chest, [0, 3.0, 2.95]);
  const coreGlow = mk(new THREE.PlaneGeometry(3.2, 3.2), addMat({ map: gT, color: 0x4ab0ff, opacity: 0.6 }), chest, [0, 3.0, 3.4], [0, 0, 0], null, false);
  // back crystals
  const R = rng(4242);
  for (let i = 0; i < 9; i++) {
    const a = (i - 4) * 0.32, h = 1.6 + R() * 1.4;
    mk(new THREE.ConeGeometry(0.35 + R() * 0.2, h, 5), crystal, chest, [Math.sin(a) * 2.6, 4.6 + Math.cos(a) * 1.4, -1.9 - Math.cos(a) * 0.6], [-0.6 + R() * 0.2, 0, -a * 0.8]);
  }
  // glowing cracks across the body
  for (let i = 0; i < 16; i++) {
    const a = R() * P * 1.2 - P * 0.1, y = 1.4 + R() * 4.2;
    const m = mk(new THREE.BoxGeometry(0.07, 0.9 + R() * 1.1, 0.07), crackM, chest, [Math.cos(a) * 3.5 * 1.0, y, Math.sin(a) * 2.6 + 0.3], [R() - 0.5, 0, R() - 0.5], null, false);
    m.lookAt(0, y, 0.2); m.rotateX(P / 2);
  }
  // head, sunk between the shoulders
  const neck = grp(chest, 0, 5.4, 2.0);
  const head = grp(neck, 0, 0, 0);
  mk(new THREE.SphereGeometry(1.35, 22, 16), stone, head, [0, 0.4, 0.4], [0, 0, 0], [1.15, 0.92, 1.12]);
  mk(new RoundedBoxGeometry(2.7, 0.55, 0.9, 2, 0.2), plateM, head, [0, 0.95, 1.2], [0.25, 0, 0]);
  for (const sd of [1, -1]) {
    const horn = grp(head, sd * 1.05, 1.1, 0.3);
    mk(new THREE.ConeGeometry(0.32, 2.4, 8), plateM, horn, [sd * 0.5, 0.9, -0.3], [-0.5, 0, -sd * 0.7]);
  }
  const eyes = [];
  for (const [x, y, z, s] of [[0.48, 0.56, 1.62, 0.2], [-0.48, 0.56, 1.62, 0.2], [0.95, 0.88, 1.38, 0.12], [-0.95, 0.88, 1.38, 0.12]]) {
    const e = mk(new THREE.SphereGeometry(s, 14, 10), eyeM, head, [x, y, z], [0, 0, 0], [1.4, 0.7, 0.6], false);
    const gl = mk(new THREE.PlaneGeometry(s * 9, s * 9), addMat({ map: gT, color: 0x40b8ff, opacity: 0.9 }), head, [x, y, z + 0.15], [0, 0, 0], null, false);
    eyes.push({ e, gl, s });
  }
  const jaw = grp(head, 0, -0.1, 0.5);
  mk(new THREE.SphereGeometry(1.05, 18, 12, 0, P * 2, P / 2, P / 2), stone, jaw, [0, 0.05, 0.35], [0, 0, 0], [1.1, 0.75, 1.1]);
  for (let i = 0; i < 6; i++) mk(new THREE.ConeGeometry(0.09, 0.32, 5), mat(0xd8e4f0, { r: 0.4 }), jaw, [-0.6 + i * 0.24, 0.12, 1.2 - Math.abs(i - 2.5) * 0.06], [0, 0, 0], null, false);
  const mouthGlow = mk(new THREE.PlaneGeometry(1.4, 0.7), addMat({ map: gT, color: 0x4ab0ff, opacity: 0 }), head, [0, 0.0, 1.55], [0, 0, 0], null, false);
  const faceL = new THREE.PointLight(0x4ab0ff, 30, 16, 1.5); faceL.position.set(0, 0.6, 3.2); head.add(faceL);
  // arms: long, knuckles near the ground
  const arms = [];
  for (const sd of [1, -1]) {
    mk(new THREE.SphereGeometry(1.75, 18, 14), stone, chest, [sd * 3.7, 5.0, 0.4]);
    mk(new RoundedBoxGeometry(2.2, 0.9, 2.3, 2, 0.35), plateM, chest, [sd * 3.9, 6.2, 0.4], [0, 0, sd * -0.35]);
    for (let i = 0; i < 3; i++) mk(new THREE.ConeGeometry(0.3, 1.5 + i * 0.3, 5), crystal, chest, [sd * (3.4 + i * 0.5), 6.9 + i * 0.1, 0.9 - i * 0.6], [-0.2, 0, -sd * (0.3 + i * 0.15)]);
    const sh = grp(chest, sd * 3.9, 5.0, 0.4); sh.rotation.order = 'ZXY';
    mk(new THREE.CapsuleGeometry(1.0, 3.0, 6, 14), stone, sh, [0, -2.2, 0]);
    const el = grp(sh, 0, -4.4, 0);
    mk(new THREE.CapsuleGeometry(0.9, 2.8, 6, 14), stone, el, [0, -2.0, 0.1]);
    for (let i = 0; i < 3; i++) mk(new THREE.ConeGeometry(0.22, 1.0, 5), crystal, el, [sd * 0.75, -0.8 - i * 1.1, -0.4], [0, 0, -sd * 1.1]);
    mk(new THREE.BoxGeometry(0.06, 2.4, 0.06), crackM, el, [sd * 0.1, -2.0, 0.98], [0, 0, 0], null, false);
    const fist = grp(el, 0, -4.2, 0.2);
    mk(new THREE.DodecahedronGeometry(1.25, 0), plateM, fist, [0, 0, 0], [0.3, 0.2, 0], [1.1, 0.95, 1.2]);
    arms.push({ sh, el, fist, sd });
  }
  // legs
  const legs = [];
  for (const sd of [1, -1]) {
    const hp = grp(hips, sd * 1.75, -0.4, 0);
    mk(new THREE.CapsuleGeometry(1.1, 1.6, 6, 14), stone, hp, [0, -1.3, 0]);
    const kn = grp(hp, 0, -2.6, 0);
    mk(new THREE.SphereGeometry(0.95, 14, 10), plateM, kn, [0, 0, 0.45]);
    mk(new THREE.CapsuleGeometry(0.95, 1.2, 6, 14), stone, kn, [0, -1.2, 0]);
    const an = grp(kn, 0, -2.4, 0);
    mk(new RoundedBoxGeometry(2.0, 0.9, 2.8, 2, 0.35), plateM, an, [0, -0.15, 0.5]);
    legs.push({ hp, kn, an, sd });
  }
  const stoneC = stone.color.clone(), plateC = plateM.color.clone(), GREY = new THREE.Color(0x6a6e78);
  return {
    root, head, fists: { L: arms[0].fist, R: arms[1].fist },
    // st: { t, jaw, look, nod, eyes, walk (0..1 stride), phase, roar (0..1), upL/upR (arm overhead), reachL/reachR (arm forward),
    //       lean (bend forward), kneel, crumble (turning to stone and falling apart) }
    update(st) {
      const t = st.t, br = Math.sin(t * 1.7), walk = st.walk ?? 0, ph = st.phase ?? 0, roar = st.roar ?? 0;
      const kn = st.kneel ?? 0, cr = st.crumble ?? 0, lean = st.lean ?? 0;
      hips.position.y = 5.6 - 0.25 * Math.abs(Math.sin(ph)) * walk - 2.3 * kn - 3.2 * cr;
      hips.rotation.set(0.25 * kn, 0.06 * Math.sin(ph) * walk, 0.04 * Math.sin(ph) * walk + 0.12 * cr);
      chest.rotation.set(0.12 + 0.03 * br * (1 - cr) - 0.28 * roar + 0.6 * lean + 0.7 * cr, 0, 0.1 * cr);
      chest.scale.set(1 + 0.012 * br, 1 + 0.02 * br, 1 + 0.012 * br);
      neck.rotation.set((st.nod ?? 0) - 0.35 * roar, st.look ?? 0, 0);
      jaw.rotation.x = 0.55 * clamp((st.jaw ?? 0) + roar * (0.8 + 0.2 * Math.sin(t * 30)));
      mouthGlow.material.opacity = 0.8 * clamp((st.jaw ?? 0) + roar);
      for (const A of arms) {
        const sw = Math.sin(ph + (A.sd > 0 ? P : 0)) * 0.3 * walk;
        const up = A.sd > 0 ? (st.upL ?? 0) : (st.upR ?? 0), reach = A.sd > 0 ? (st.reachL ?? 0) : (st.reachR ?? 0);
        A.sh.rotation.set(-0.25 + sw - 0.4 * roar + 0.03 * br - 2.55 * up - 1.25 * reach + 0.35 * cr, 0, A.sd * (0.12 + 0.55 * roar + 0.25 * up + 0.2 * cr));
        A.el.rotation.x = -0.35 - 0.5 * roar - 0.25 * up + 0.25 * reach;
        A.fist.rotation.x = 0.2 * roar;
      }
      for (const Lg of legs) {
        const s = Math.sin(ph + (Lg.sd > 0 ? 0 : P));
        Lg.hp.rotation.x = -s * 0.35 * walk - 1.1 * kn - 1.2 * cr;
        Lg.kn.rotation.x = Math.max(0, -Math.cos(ph + (Lg.sd > 0 ? 0 : P))) * 0.5 * walk + 1.9 * kn + 2.0 * cr;
        Lg.an.rotation.x = -0.8 * (kn + cr) * 0.5;
      }
      stone.color.copy(stoneC).lerp(GREY, cr); plateM.color.copy(plateC).lerp(GREY, cr);
      crackM.color.setHex(0x3aa8ff).multiplyScalar(1 - cr);
      const ey = (st.eyes ?? 1) * (1 - cr);
      for (const e of eyes) { e.gl.material.opacity = Math.min(1, ey) * (0.75 + 0.25 * Math.sin(t * 5 + e.s * 40)); e.gl.scale.setScalar(0.7 + 0.5 * ey); }
      eyeM.color.setHex(0x7ad8ff).lerp(new THREE.Color(0xeaffff), Math.min(1, ey * 0.7));
      faceL.intensity = 30 * ey;
      crystal.emissiveIntensity = (1.2 + 0.5 * Math.sin(t * 2.2) + 0.8 * roar) * (1 - 0.95 * cr);
      core.rotation.set(t * 0.6, t * 0.8, 0);
      coreGlow.material.opacity = (0.45 + 0.2 * Math.sin(t * 2.2) + 0.3 * roar) * (1 - cr);
    },
  };
}

// ------------------------------------------------------------------ AARON'S ENERGY BARRIER
export function buildDome() {
  const root = new THREE.Group();
  const hexTex = canvasTex(512, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(70,170,255,0.10)'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(200,240,255,0.95)'; c.lineWidth = 2.5;
    const s = 22, hgt = s * Math.sqrt(3);
    for (let row = -1; row < h / hgt + 1; row++) for (let col = -1; col < w / (s * 1.5) + 1; col++) {
      const cx = col * s * 1.5, cy = row * hgt + (col % 2 ? hgt / 2 : 0);
      c.beginPath(); for (let k = 0; k <= 6; k++) { const a = (k / 6) * P * 2; c[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * s * 0.92, cy + Math.sin(a) * s * 0.92); } c.stroke();
    }
  }, { repeat: [6, 2] });
  const shellM = addMat({ map: hexTex, color: 0x6ac8ff, opacity: 0.5, side: THREE.DoubleSide });
  const shell = mk(new THREE.SphereGeometry(1, 48, 20, 0, P * 2, 0, P / 2), shellM, root, [0, 0, 0], [0, 0, 0], null, false);
  const hazeM = addMat({ color: 0x2a8cff, opacity: 0.15, side: THREE.BackSide });
  mk(new THREE.SphereGeometry(1.02, 32, 14, 0, P * 2, 0, P / 2), hazeM, root, [0, 0, 0], [0, 0, 0], null, false);
  const ringM = addMat({ color: 0x9fe0ff, opacity: 0.9 });
  mk(new THREE.TorusGeometry(1, 0.012, 6, 64), ringM, root, [0, 0.01, 0], [P / 2, 0, 0], null, false);
  const rip = mk(new THREE.SphereGeometry(1, 32, 14, 0, P * 2, 0, P / 2), addMat({ color: 0xcff4ff, opacity: 0, side: THREE.DoubleSide }), root, [0, 0, 0], [0, 0, 0], null, false);
  const light = new THREE.PointLight(0x5ab8ff, 0, 12, 1.4); light.position.y = 1.2; root.add(light);
  root.visible = false;
  return {
    root,
    // st: { t, on 0..1 (grow), x, z, r, hit 0..1 (ripple flash), flicker }
    update(st) {
      const on = st.on ?? 0;
      root.visible = on > 0.01;
      if (!root.visible) return;
      const t = st.t, grow = 1 - Math.pow(1 - clamp(on), 3);
      root.position.set(st.x, 0, st.z);
      root.scale.set(st.r * grow, st.r * grow * (0.85 + 0.15 * grow), st.r * grow);
      const fl = st.flicker ? (Math.sin(t * 47) * Math.sin(t * 13) > 0 ? 1 : 0.4) : 1;
      shellM.opacity = (0.42 + 0.08 * Math.sin(t * 7)) * clamp(on) * fl + 0.4 * (st.hit ?? 0);
      hexTex.offset.set(t * 0.02, -t * 0.03);
      hazeM.opacity = 0.14 * clamp(on) * fl;
      ringM.opacity = 0.9 * clamp(on);
      const h = st.hit ?? 0;
      rip.material.opacity = 0.5 * h; rip.scale.setScalar(1 + 0.08 * (1 - h));
      light.intensity = 10 * clamp(on) * fl + 20 * h;
    },
  };
}

// ------------------------------------------------------------------ THE SOUL STEALER'S CLOAK (thrown off)
export function buildCloak() {
  const root = new THREE.Group();
  const inner = grp(root); inner.scale.setScalar(1.15);
  const prof = [[0.62, 0], [0.58, 0.3], [0.48, 0.8], [0.36, 1.3], [0.33, 1.6], [0.4, 1.78], [0.18, 1.9], [0.0, 1.92]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(prof, 32);
  const base = Float32Array.from(geo.attributes.position.array);
  const cloth = new THREE.MeshStandardMaterial({ color: 0x15101e, roughness: 0.92, side: THREE.DoubleSide, transparent: true });
  mk(geo, cloth, inner);
  const trim = new THREE.MeshStandardMaterial({ color: 0x5a0a14, roughness: 0.6, emissive: 0x400008, emissiveIntensity: 0.6, transparent: true });
  const trimRing = mk(new THREE.TorusGeometry(0.6, 0.025, 6, 32), trim, inner, [0, 0.03, 0], [P / 2, 0, 0]);
  const hoodM = new THREE.MeshStandardMaterial({ color: 0x1c1426, roughness: 0.9, side: THREE.DoubleSide, transparent: true });
  const hood = mk(new THREE.SphereGeometry(0.34, 24, 18, P * 0.62, P * 1.76, 0, P * 0.78), hoodM, inner, [0, 2.02, 0], [0, 0, 0], [1, 1.15, 1.05]);
  mk(new THREE.ConeGeometry(0.12, 0.3, 10), hoodM, inner, [0, 2.34, -0.1], [-0.5, 0, 0]);
  root.visible = false;
  return {
    root,
    // st: { t, vis, x, y, z, ry, rx, rz, spread (0..1 the hem flares out), flutter, alpha }
    update(st) {
      root.visible = !!st.vis && (st.alpha ?? 1) > 0.01;
      if (!root.visible) return;
      root.position.set(st.x, st.y, st.z);
      root.rotation.set(st.rx ?? 0, st.ry ?? 0, st.rz ?? 0);
      const t = st.t, sp = st.spread ?? 0, fl = st.flutter ?? 0;
      const a = geo.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) {
        const y = base[i + 1], k = Math.max(0, 1 - y / 1.9);
        const th = Math.atan2(base[i + 2], base[i]);
        const w = 1 + 0.05 * k * Math.sin(th * 5 + t * 2.2) + sp * k * 0.9 + fl * k * 0.25 * Math.sin(th * 3 + t * 9 + y * 3);
        a[i] = base[i] * w; a[i + 2] = base[i + 2] * w;
        a[i + 1] = y + fl * k * 0.12 * Math.sin(th * 4 + t * 11);
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
      trimRing.scale.setScalar(1 + sp * 0.9);
      const al = st.alpha ?? 1;
      for (const m of [cloth, trim, hoodM]) { m.opacity = al; m.depthWrite = al > 0.6; }
      hood.visible = true;
    },
  };
}
