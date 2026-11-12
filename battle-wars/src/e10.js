// Episode 10 "Season 1 Finale": the power control room below HQ (core, blast door, consoles), the elevator,
// city destruction pieces (thrown cars, a bus, falling chunks of building), Fred's energy lasso and his boomerang hat.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, mk, grp, rng, hash, canvasTex, clamp, lerp, smoothstep } from './util.js';
import { box, plane, buildCar } from './sets.js';
import * as TX from './textures.js';

const P = Math.PI;
const glowTex = () => canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
const addMat = (o) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...o });

// ------------------------------------------------------------------ THE POWER CONTROL ROOM (below headquarters)
// A big arena: the glowing power core at the back (0, -6), a blast door at the front (z = +11), consoles and pillars.
export function buildPowerRoom() {
  const g = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0x9fb8e8, 0x1a1c28, 0.75); g.add(hemi);
  const key = new THREE.DirectionalLight(0xdfe8ff, 0.9); key.position.set(6, 14, 10); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; g.add(key);
  const floorTex = TX.metalFloorTex(); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(7, 6);
  plane(g, 28, 24, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.45, color: 0xaab4c8 }), [0, 0, 0]);
  const wallM = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.8, metalness: 0.2 });
  const H = 7;
  box(g, 28, H, 0.5, 0, [0, H / 2, -12], { material: wallM, noShadow: true });
  box(g, 0.5, H, 24, 0, [-14, H / 2, 0], { material: wallM, noShadow: true });
  box(g, 0.5, H, 24, 0, [14, H / 2, 0], { material: wallM, noShadow: true });
  // front wall with the doorway (x -2.4..2.4, 4.4 high)
  box(g, 11.6, H, 0.5, 0, [-8.2, H / 2, 12], { material: wallM, noShadow: true });
  box(g, 11.6, H, 0.5, 0, [8.2, H / 2, 12], { material: wallM, noShadow: true });
  box(g, 4.8, H - 4.4, 0.5, 0, [0, 4.4 + (H - 4.4) / 2, 12], { material: wallM, noShadow: true });
  box(g, 28, 0.3, 24, 0x161a24, [0, H + 0.1, 0], { noShadow: true });
  // corridor behind the door
  box(g, 5.2, 4.6, 8, 0x12141c, [0, 2.3, 16.4], { noShadow: true }).material = new THREE.MeshStandardMaterial({ color: 0x12141c, roughness: 1, side: THREE.BackSide });
  const corrL = new THREE.PointLight(0xff3030, 6, 9, 1.4); corrL.position.set(0, 3.4, 15); g.add(corrL);
  // glowing strips along the walls (blue; purple when the Soul Stealer takes over)
  const stripM = new THREE.MeshStandardMaterial({ color: 0x7fd4ff, emissive: 0x2f8cff, emissiveIntensity: 1.2, roughness: 0.4 });
  for (const y of [0.25, 5.2]) { box(g, 27.4, 0.12, 0.1, 0, [0, y, -11.7], { material: stripM, noShadow: true }); box(g, 0.1, 0.12, 23.4, 0, [-13.7, y, 0], { material: stripM, noShadow: true }); box(g, 0.1, 0.12, 23.4, 0, [13.7, y, 0], { material: stripM, noShadow: true }); }
  // pillars, pipes, crates
  const steel = mat(0x6a7284, { r: 0.4, m: 0.7 }), dark = mat(0x3a4050, { r: 0.5, m: 0.6 });
  for (const [x, z] of [[-9, -4.5], [9, -4.5], [-9, 5.5], [9, 5.5]]) { box(g, 1.1, H, 1.1, 0, [x, H / 2, z], { material: dark }); box(g, 1.3, 0.4, 1.3, 0, [x, 0.2, z], { material: steel }); box(g, 0.14, 4.5, 0.06, 0, [x, 3, z + 0.56], { material: stripM, noShadow: true }); }
  const pipeM = mat(0x5a6a7a, { r: 0.45, m: 0.65 });
  for (const y of [5.9, 6.3]) mk(new THREE.CylinderGeometry(0.16, 0.16, 27, 12), pipeM, g, [0, y, -11.3], [0, 0, P / 2]);
  for (const sx of [-1, 1]) mk(new THREE.CylinderGeometry(0.22, 0.22, 11, 12), pipeM, g, [sx * 13.3, 6.2, -6], [P / 2, 0, 0]);
  const R = rng(1010);
  for (const [x, z, s] of [[-11.5, 8.5, 1.1], [-12.2, 6.9, 0.9], [-11.6, 8.4, 0.8], [11.8, 8.8, 1.0], [12.2, -9.8, 1.2], [-12.0, -9.6, 1.0]]) box(g, s, s, s, 0x4a5a48, [x, s / 2 + (R() < 0.2 ? 1.0 : 0), z], { round: 0.03, rot: [0, R(), 0] });
  // ------------- the power core
  const core = grp(g, 0, 0, -6);
  mk(new THREE.CylinderGeometry(2.6, 3.0, 0.5, 40), steel, core, [0, 0.25, 0]);
  mk(new THREE.CylinderGeometry(1.9, 2.1, 0.5, 40), dark, core, [0, 0.75, 0]);
  const ringFloor = mk(new THREE.TorusGeometry(3.6, 0.06, 8, 64), stripM, core, [0, 0.05, 0], [P / 2, 0, 0], null, false);
  const glassM = new THREE.MeshStandardMaterial({ color: 0x9fdcff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, emissive: 0x2f8cff, emissiveIntensity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  mk(new THREE.CylinderGeometry(1.25, 1.25, 4.6, 36, 1, true), glassM, core, [0, 3.3, 0], [0, 0, 0], null, false);
  const coreM = new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: 0x3fb0ff, emissiveIntensity: 2.4, roughness: 0.3 });
  const column = mk(new THREE.CylinderGeometry(0.5, 0.5, 4.4, 24), coreM, core, [0, 3.3, 0], [0, 0, 0], null, false);
  const crystal = mk(new THREE.OctahedronGeometry(0.85, 0), coreM, core, [0, 3.3, 0], [0, 0, 0], [1, 1.5, 1], false);
  const veinM = new THREE.MeshBasicMaterial({ color: 0xc060ff });
  const veins = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * P * 2; const m = mk(new THREE.BoxGeometry(0.05, 4.4, 0.05), veinM, core, [Math.cos(a) * 1.27, 3.3, Math.sin(a) * 1.27], [0, 0, 0.12 * Math.sin(i * 2.3)], null, false); m.visible = false; veins.push(m); }
  const rings = [];
  for (const y of [1.6, 3.3, 5.0]) rings.push(mk(new THREE.TorusGeometry(1.5, 0.09, 10, 48), steel, core, [0, y, 0], [P / 2, 0, 0]));
  mk(new THREE.CylinderGeometry(1.7, 1.3, 0.7, 36), steel, core, [0, 5.95, 0]);
  mk(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 16), dark, core, [0, 6.6, 0]);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * P * 2; mk(new THREE.CylinderGeometry(0.07, 0.07, 4.7, 8), steel, core, [Math.cos(a) * 1.4, 3.3, Math.sin(a) * 1.4]); }
  for (const sd of [-1, 1]) mk(new THREE.CylinderGeometry(0.2, 0.2, 5.5, 10), pipeM, core, [sd * 3.6, 3.0, -1.2], [0, 0, sd * 0.75]);
  const coreGlow = mk(new THREE.PlaneGeometry(9, 9), addMat({ map: glowTex(), color: 0x4ab8ff, opacity: 0.55 }), core, [0, 3.3, 1.4], [0, 0, 0], null, false);
  const coreL = new THREE.PointLight(0x5ab8ff, 60, 30, 1.2); coreL.position.set(0, 3.4, 2.0); core.add(coreL);
  const coreL2 = new THREE.PointLight(0x5ab8ff, 30, 22, 1.3); coreL2.position.set(0, 2.0, 12.0); core.add(coreL2);
  // ------------- consoles + screens
  const scrTex = canvasTex(512, 256, () => {});
  const drawScr = (pct, purple, t) => {
    const c = scrTex.userData.ctx, w = 512, h = 256;
    c.fillStyle = purple > 0.5 ? '#12041e' : '#04101e'; c.fillRect(0, 0, w, h);
    const col = purple > 0.5 ? '#d080ff' : pct < 35 ? '#ff5a4a' : '#7fe0ff';
    c.strokeStyle = col; c.lineWidth = 4; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = col; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.fillText('POWER CORE', w / 2, 62);
    c.font = 'bold 92px sans-serif'; c.fillText(`${Math.round(pct)}%`, w / 2, 160);
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(40, 190, w - 80, 34);
    c.fillStyle = col; c.fillRect(40, 190, (w - 80) * clamp(pct / 100), 34);
    if (purple > 0.5 && Math.sin(t * 9) > 0) { c.font = 'bold 26px sans-serif'; c.fillText('SYSTEM OVERRIDE', w / 2, 248); }
    scrTex.needsUpdate = true;
  };
  const scrM = new THREE.MeshBasicMaterial({ map: scrTex });
  for (const sx of [-1, 1]) { box(g, 5.2, 2.8, 0.15, 0x10141c, [sx * 7.5, 3.6, -11.65]); plane(g, 4.8, 2.4, scrM, [sx * 7.5, 3.6, -11.55], [0, 0, 0], false); }
  // main console (Aaron's station) at the right of the core
  const con = grp(g, 5.2, 0, -6.6); con.rotation.y = -0.6;
  box(con, 3.0, 1.0, 0.9, 0x24305e, [0, 0.5, 0], { round: 0.04 });
  box(con, 3.0, 0.08, 1.0, 0x1a2244, [0, 1.04, 0.05], { rot: [0.25, 0, 0] });
  plane(con, 1.5, 0.75, scrM, [0, 1.75, -0.3], [-0.2, 0, 0], false);
  box(con, 1.6, 0.85, 0.06, 0x10141c, [0, 1.75, -0.35], { rot: [-0.2, 0, 0] });
  const btnM = [];
  for (let i = 0; i < 10; i++) { const m = mat([0x3fd2ff, 0xffc21a, 0xff4a4a, 0x6dff8a][i % 4], { e: [0x3fd2ff, 0xffc21a, 0xff4a4a, 0x6dff8a][i % 4], ei: 0.8 }).clone(); mk(new THREE.BoxGeometry(0.14, 0.05, 0.1), m, con, [-1.2 + i * 0.27, 1.1, 0.2 + (i % 2) * 0.14], [0.25, 0, 0], null, false); btnM.push(m); }
  const sparkL = new THREE.PointLight(0xffd080, 0, 6, 1.6); sparkL.position.set(0, 1.4, 0.3); con.add(sparkL);
  // second console on the left
  const con2 = grp(g, -5.2, 0, -6.6); con2.rotation.y = 0.6;
  box(con2, 3.0, 1.0, 0.9, 0x24305e, [0, 0.5, 0], { round: 0.04 }); box(con2, 3.0, 0.08, 1.0, 0x1a2244, [0, 1.04, 0.05], { rot: [0.25, 0, 0] });
  // ------------- the blast door (two panels) at z = 12
  const doorM = new THREE.MeshStandardMaterial({ color: 0x566070, roughness: 0.4, metalness: 0.75, emissive: 0xa040ff, emissiveIntensity: 0 });
  const stripeTex = TX.stripesTex(); stripeTex.wrapS = THREE.RepeatWrapping; stripeTex.repeat.set(3, 1);
  const panels = [];
  for (const sd of [-1, 1]) {
    const pv = grp(g, sd * 1.2, 0, 11.9);
    box(pv, 2.4, 4.4, 0.35, 0, [0, 2.2, 0], { material: doorM });
    plane(pv, 2.3, 0.4, new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.7 }), [0, 0.5, -0.19], [0, P, 0], false);
    box(pv, 0.3, 3.6, 0.1, 0x2a3040, [-sd * 0.9, 2.2, -0.2]);
    panels.push({ pv, sd });
  }
  box(g, 5.4, 0.3, 0.7, 0, [0, 4.55, 11.9], { material: steel }); for (const sd of [-1, 1]) box(g, 0.3, 4.6, 0.7, 0, [sd * 2.55, 2.3, 11.9], { material: steel });
  const doorGlow = mk(new THREE.PlaneGeometry(7, 6.5), addMat({ map: glowTex(), color: 0xb050ff, opacity: 0 }), g, [0, 2.3, 11.5], [0, P, 0], null, false);
  const doorL = new THREE.PointLight(0xa040ff, 0, 16, 1.3); doorL.position.set(0, 2.4, 10.4); g.add(doorL);
  // ceiling lights + alarm
  const panelsL = [];
  const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8f0ff, emissiveIntensity: 1.4 });
  for (const [x, z] of [[-6, 2], [6, 2], [-6, 8], [6, 8], [0, 5]]) { box(g, 2.2, 0.08, 0.7, 0, [x, H - 0.1, z], { material: lampM, noShadow: true }); const l = new THREE.PointLight(0xe8f0ff, 16, 14, 1.4); l.position.set(x, H - 0.6, z); g.add(l); panelsL.push(l); }
  const alarmL = new THREE.PointLight(0xff2020, 0, 30, 1.1); alarmL.position.set(0, 6, 3); g.add(alarmL);
  // damage decals on walls/floor (appear during the fight)
  const crackTex = canvasTex(256, 256, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(8,8,12,0.9)'; const r = rng(77); for (let i = 0; i < 14; i++) { let x = 128, y = 128; c.lineWidth = 5 - i * 0.25; c.beginPath(); c.moveTo(x, y); const a = r() * 7; for (let k = 0; k < 6; k++) { x += Math.cos(a + (r() - 0.5)) * 22; y += Math.sin(a + (r() - 0.5)) * 22; c.lineTo(x, y); } c.stroke(); } c.fillStyle = 'rgba(8,8,12,0.85)'; c.beginPath(); c.arc(128, 128, 26, 0, 7); c.fill(); });
  const crM = new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false });
  const dmg = [
    mk(new THREE.PlaneGeometry(4.5, 4.5), crM, g, [-13.7, 2.6, 2.0], [0, P / 2, 0], null, false),
    mk(new THREE.PlaneGeometry(4.5, 4.5), crM, g, [13.7, 2.4, -1.0], [0, -P / 2, 0], null, false),
    mk(new THREE.PlaneGeometry(5, 5), crM, g, [1.5, 0.02, 3.0], [-P / 2, 0, 0], null, false),
    mk(new THREE.PlaneGeometry(4, 4), crM, g, [-4.0, 0.02, 6.0], [-P / 2, 0, 0.7], null, false),
    mk(new THREE.PlaneGeometry(4.5, 4.5), crM, g, [6.0, 3.0, -11.7], [0, 0, 0], null, false),
  ];
  const BLUE = new THREE.Color(0x3fb0ff), PURPLE = new THREE.Color(0xb040ff), HOT = new THREE.Color(0xffc060), tmp = new THREE.Color(), STRIP0 = new THREE.Color(0x2f8cff);
  return {
    name: 'power', group: g, bg: new THREE.Color(0x05070c), exposure: 1.05,
    update(t, X) {
      const v = X.val;
      const lvl = v('core.level', 1), pur = v('core.purple', 0), hot = v('core.hot', 0), flick = v('core.flicker', 0);
      const fl = flick > 0 ? (Math.sin(t * 43) * Math.sin(t * 17.3) > -0.2 ? 1 : 1 - 0.8 * flick) : 1;
      tmp.copy(BLUE).lerp(PURPLE, pur).lerp(HOT, hot);
      const pulse = 0.85 + 0.15 * Math.sin(t * (2.4 + hot * 9 + pur * 3));
      coreM.emissive.copy(tmp); coreM.emissiveIntensity = (0.5 + 2.2 * lvl + 2.5 * hot) * pulse * fl;
      coreM.color.set(0xbfeaff).lerp(tmp, 0.5);
      coreGlow.material.color.copy(tmp); coreGlow.material.opacity = (0.15 + 0.45 * lvl + 0.35 * hot) * pulse * fl;
      coreGlow.scale.setScalar(1 + 0.5 * hot);
      coreL.color.copy(tmp); coreL.intensity = (10 + 55 * lvl + 90 * hot) * pulse * fl; coreL2.color.copy(tmp); coreL2.intensity = (5 + 25 * lvl + 40 * hot) * fl;
      glassM.emissive.copy(tmp);
      crystal.rotation.y = t * (0.8 + hot * 5); crystal.position.y = 3.3 + 0.12 * Math.sin(t * 1.7);
      rings.forEach((r, i) => { r.rotation.z = t * (0.5 + i * 0.3) * (i % 2 ? 1 : -1) * (1 + hot * 4); });
      veins.forEach((m, i) => { m.visible = pur > 0.02 + i * 0.06; m.scale.y = clamp((pur - i * 0.06) * 2.5); });
      veinM.color.setHex(Math.sin(t * 11) > 0 ? 0xc060ff : 0xe0a0ff);
      const tk = v('power.purple', 0);
      stripM.emissive.copy(STRIP0).lerp(PURPLE, tk); stripM.color.setHex(0x7fd4ff).lerp(PURPLE, tk * 0.7);
      stripM.emissiveIntensity = (1.2 + 0.5 * tk * Math.sin(t * 5)) * (1 - 0.7 * v('power.dim', 0));
      ringFloor.rotation.z = t * 0.2;
      const dim = v('power.dim', 0), al = v('power.alarm', 0);
      hemi.intensity = 0.75 * (1 - 0.6 * dim); key.intensity = 0.9 * (1 - 0.75 * dim);
      for (const l of panelsL) l.intensity = 16 * (1 - 0.92 * dim) * (v('power.flicker', 0) > 0.5 ? (hash(Math.floor(t * 13)) > 0.4 ? 1 : 0.1) : 1);
      lampM.emissiveIntensity = 1.4 * (1 - 0.9 * dim);
      alarmL.intensity = al * 26 * (0.5 + 0.5 * Math.sin(t * 6));
      drawScr(v('core.pct', 100), v('power.purple', 0), t);
      btnM.forEach((m, i) => { m.emissiveIntensity = Math.sin(t * 3 + i * 1.7) > 0 ? 1.0 : 0.25; });
      sparkL.intensity = v('console.sparks', 0) * (hash(Math.floor(t * 20)) > 0.5 ? 14 : 0);
      // blast door
      const gl = v('pdoor.glow', 0), bu = v('pdoor.burst', 0), sh = v('pdoor.shake', 0), op = v('pdoor.open', 0);
      doorM.emissiveIntensity = gl * (1.2 + 0.4 * Math.sin(t * 14));
      doorGlow.material.opacity = Math.min(1, gl) * 0.8 * (1 - 0.6 * bu);
      doorL.intensity = gl * 30 * (1 - 0.5 * bu) + bu * 12;
      for (const p of panels) {
        const k = smoothstep(0, 1, bu), land = smoothstep(0.55, 1, bu);
        // the panels fly in and land flat on the floor near the side walls (yaw applied last so they lie flat)
        p.pv.rotation.order = 'YXZ';
        p.pv.position.set(p.sd * (1.2 + 5.0 * k + 2.3 * op * (1 - k)) + Math.sin(t * 60 + p.sd) * 0.03 * sh, 0.18 * land, 11.9 - (2.0 + p.sd * 0.8) * k);
        p.pv.rotation.set(-1.5708 * land - (1 - land) * k * 0.6, -p.sd * 0.9 * k, p.sd * 0.4 * k * (1 - land));
        p.pv.position.y += Math.sin(Math.min(1, bu * 1.8) * P) * 1.6 * (1 - land);
      }
      dmg.forEach((m, i) => { m.visible = v(`power.dmg${i}`, 0) > 0.5; });
    },
  };
}

// ------------------------------------------------------------------ THE ELEVATOR
export function buildElevator() {
  const g = new THREE.Group();
  g.add(new THREE.HemisphereLight(0xe8f0ff, 0x30343c, 0.9));
  const lampL = new THREE.PointLight(0xfff4e0, 14, 7, 1.4); lampL.position.set(0, 2.5, 0); g.add(lampL);
  const wallM = mat(0x8a94a4, { r: 0.35, m: 0.7 }), trim = mat(0x1d2a7a, { r: 0.5 });
  plane(g, 3.2, 3.2, mat(0x3a3f4a, { r: 0.7 }), [0, 0, 0]);
  box(g, 3.2, 2.9, 0.1, 0, [0, 1.45, -1.6], { material: wallM, noShadow: true });
  box(g, 0.1, 2.9, 3.2, 0, [-1.6, 1.45, 0], { material: wallM, noShadow: true });
  box(g, 0.1, 2.9, 3.2, 0, [1.6, 1.45, 0], { material: wallM, noShadow: true });
  box(g, 3.2, 0.1, 3.2, 0xdfe5ee, [0, 2.92, 0], { noShadow: true });
  box(g, 1.6, 0.05, 1.6, 0, [0, 2.86, 0], { material: mat(0xffffff, { e: 0xfff4e0, ei: 1.5 }), noShadow: true });
  for (const [x, z, w, d] of [[0, -1.52, 3.0, 0.06], [-1.52, 0, 0.06, 3.0], [1.52, 0, 0.06, 3.0]]) { box(g, w, 0.06, d, 0, [x, 1.0, z], { material: mat(0xd8dde6, { m: 0.8, r: 0.25 }) }); box(g, w, 0.3, d, 0, [x, 0.15, z], { material: trim }); }
  // front: door frame + two sliding doors + floor display
  box(g, 0.7, 2.9, 0.1, 0, [-1.25, 1.45, 1.6], { material: wallM, noShadow: true }); box(g, 0.7, 2.9, 0.1, 0, [1.25, 1.45, 1.6], { material: wallM, noShadow: true });
  box(g, 1.8, 0.7, 0.1, 0, [0, 2.55, 1.6], { material: wallM, noShadow: true });
  const doors = [];
  for (const sd of [-1, 1]) doors.push({ m: box(g, 0.9, 2.2, 0.06, 0, [sd * 0.45, 1.1, 1.56], { material: mat(0xb8c0cc, { m: 0.8, r: 0.3 }) }), sd });
  const dispTex = canvasTex(128, 64, () => {});
  let lastTxt = '';
  const drawDisp = (txt, arrow) => { const key2 = txt + arrow; if (key2 === lastTxt) return; lastTxt = key2; const c = dispTex.userData.ctx; c.fillStyle = '#081018'; c.fillRect(0, 0, 128, 64); c.fillStyle = '#ffb030'; c.font = 'bold 44px monospace'; c.textAlign = 'center'; c.fillText(txt, 50, 48); if (arrow) { c.beginPath(); c.moveTo(96, 20); c.lineTo(120, 20); c.lineTo(108, 46); c.fill(); } dispTex.needsUpdate = true; };
  plane(g, 0.6, 0.3, new THREE.MeshBasicMaterial({ map: dispTex }), [0, 2.55, 1.54], [0, P, 0], false);
  // speaker (the elevator music comes from here) + button panel
  mk(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 20), mat(0x2a2e36, { r: 0.6 }), g, [1.0, 2.5, -1.53], [P / 2, 0, 0]);
  box(g, 0.25, 0.6, 0.04, 0x2a2e36, [-1.53, 1.3, 0.9]);
  for (let i = 0; i < 4; i++) mk(new THREE.CircleGeometry(0.035, 12), mat(i === 3 ? 0xffb030 : 0xd8dde6, { e: i === 3 ? 0xffa010 : 0x000000, ei: 1 }), g, [-1.505, 1.5 - i * 0.12, 0.9], [0, P / 2, 0], null, false);
  // what is outside when the doors open
  const outM = new THREE.MeshBasicMaterial({ color: 0x4ab8ff });
  plane(g, 3, 3, outM, [0, 1.4, 2.4], [0, P, 0], false);
  const FLOORS = ['1', 'B1', 'B2', 'B3'];
  return {
    name: 'lift', group: g, bg: new THREE.Color(0x05070c), exposure: 1.0,
    update(t, X) {
      const v = X.val;
      const o = v('lift.door', 0);
      for (const d of doors) d.m.position.x = d.sd * (0.45 + 0.88 * o);
      const f = v('lift.floor', 0);
      drawDisp(FLOORS[Math.min(3, Math.round(f))], v('lift.moving', 0) > 0.5 && Math.sin(t * 6) > 0);
      lampL.intensity = 14 * (v('lift.flicker', 0) > 0.5 ? (hash(Math.floor(t * 15)) > 0.35 ? 1 : 0.15) : 1);
      outM.color.setHex(v('lift.outPurple', 0) > 0.5 ? 0x6a2ab0 : 0x4ab8ff);
    },
  };
}

// ------------------------------------------------------------------ CITY DESTRUCTION PIECES (added to downtown)
function buildBus() {
  const g = new THREE.Group();
  const body = mat(0xf2b01a, { r: 0.4, m: 0.2 }), glass = mat(0x18222e, { r: 0.1, m: 0.5 }), dark = mat(0x16181e, { r: 0.6 });
  mk(new RoundedBoxGeometry(8.4, 2.5, 2.5, 3, 0.25), body, g, [0, 1.75, 0]);
  box(g, 8.42, 0.3, 2.52, 0x2a2e36, [0, 0.75, 0]);
  box(g, 7.4, 0.95, 2.54, 0, [-0.2, 2.2, 0], { material: glass });
  box(g, 0.1, 1.2, 2.2, 0, [4.18, 2.1, 0], { material: glass });
  box(g, 8.0, 0.12, 2.3, 0xd8d8de, [0, 3.03, 0]);
  for (let i = 0; i < 5; i++) for (const s of [1, -1]) { box(g, 0.1, 0.95, 0.04, 0, [-3.2 + i * 1.5, 2.2, s * 1.275], { material: body }); mk(new THREE.SphereGeometry(0.2, 10, 8), mat([0xe0ac86, 0xc48a62, 0x8a5a3c, 0xf2c4a0, 0xa8734f][i], { r: 0.6 }), g, [-2.5 + i * 1.5, 2.2, s * 0.8]); }
  for (const [x, z] of [[2.9, 1.15], [-2.9, 1.15], [2.9, -1.15], [-2.9, -1.15]]) mk(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 18), dark, g, [x, 0.5, z], [P / 2, 0, 0]);
  for (const z of [0.8, -0.8]) mk(new THREE.BoxGeometry(0.06, 0.2, 0.4), mat(0xffffee, { e: 0xffffcc, ei: 1.2 }), g, [4.22, 1.0, z]);
  const signT = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#101418'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffb030'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.fillText('AETHERFALL 9', w / 2, 46); });
  mk(new THREE.PlaneGeometry(1.8, 0.4), new THREE.MeshBasicMaterial({ map: signT }), g, [4.24, 2.85, 0], [0, P / 2, 0], null, false);
  return g;
}

export function buildFinaleCity() {
  const g = new THREE.Group();
  const objs = {};
  for (const [name, color] of [['carC', 0x3a9ad0], ['carD', 0x6dc06a], ['carE', 0xd8d8e0]]) {
    const car = buildCar();
    car.traverse((o) => {
      if (!o.isMesh) return;
      const hex = o.material?.color?.getHex?.();
      if (hex === 0x1f55e0) o.material = mat(color, { r: 0.35, m: 0.3 });
      else if (hex === 0x7fd4ff) o.material = mat(0x2a2a30, { r: 0.5 });
      else if (hex === 0x2f8cff || o.material.map) o.visible = false;
    });
    car.position.y = -0.7;                       // pivot near the middle of the car so it can tumble
    const holder = grp(g); holder.add(car); objs[name] = { holder, y0: 0.7 };
  }
  { const bus = buildBus(); bus.position.y = -1.7; const holder = grp(g); holder.add(bus); objs.bus = { holder, y0: 1.7 }; }
  // big chunks of building that fall into the street
  const wTex = TX.windowsTex(321, 0xb7c4d6, true); wTex.wrapS = wTex.wrapT = THREE.RepeatWrapping; wTex.repeat.set(1, 1);
  const chM = new THREE.MeshStandardMaterial({ map: wTex, roughness: 0.85, color: 0x8a94a8 }), chPlain = mat(0x5a5e68, { r: 0.9 });
  for (let i = 0; i < 4; i++) {
    const holder = grp(g);
    const s = [5, 4, 3.4, 6][i];
    mk(new THREE.BoxGeometry(s, s * 0.8, s * 0.9), [chM, chM, chPlain, chPlain, chM, chM], holder);
    for (let k = 0; k < 4; k++) mk(new THREE.DodecahedronGeometry(s * 0.22, 0), chPlain, holder, [(k % 2 ? 1 : -1) * s * 0.45, -s * 0.3, (k < 2 ? 1 : -1) * s * 0.4], [k, k * 2, 0]);
    objs[`chunk${i}`] = { holder, y0: s * 0.4 };
  }
  // rubble piles left behind
  const R = rng(2025);
  const rub = [];
  for (let i = 0; i < 4; i++) {
    const pile = grp(g); pile.visible = false;
    for (let k = 0; k < 16; k++) box(pile, 0.6 + R() * 1.6, 0.4 + R() * 0.9, 0.6 + R() * 1.4, k % 3 ? 0x8a8e98 : 0x5a5e68, [(R() - 0.5) * 6, 0.25 + R() * 0.5, (R() - 0.5) * 5], { rot: [R(), R() * 3, R()] });
    rub.push(pile);
  }
  for (const o of Object.values(objs)) o.holder.visible = false;
  return {
    group: g,
    update(t, X) {
      const v = X.val;
      for (const [name, o] of Object.entries(objs)) {
        const vis = v(`${name}.vis`, 0) > 0.5;
        o.holder.visible = vis;
        if (!vis) continue;
        const hold = v(`${name}.hold`, 0);
        if (hold > 0.5 && X.titanFist) { const p = X.titanFist(hold > 1.5 ? 'L' : 'R'); o.holder.position.set(p.x, p.y - 0.4, p.z); }
        else o.holder.position.set(v(`${name}.x`, 0), v(`${name}.y`, 0) + o.y0, v(`${name}.z`, 0));
        o.holder.rotation.set(v(`${name}.rx`, 0), v(`${name}.ry`, 0), v(`${name}.rz`, 0));
        const sh = v(`${name}.shake`, 0); if (sh > 0) o.holder.position.x += Math.sin(t * 40) * 0.05 * sh;
      }
      rub.forEach((p, i) => { p.visible = v(`rubble${i}.vis`, 0) > 0.5; p.position.set(v(`rubble${i}.x`, 0), 0, v(`rubble${i}.z`, 0)); });
    },
  };
}

// ------------------------------------------------------------------ FRED'S ENERGY LASSO
// A rope of light from his hand to a glowing loop. Twirl mode spins the loop above his hand.
export function buildLasso() {
  const root = new THREE.Group();
  const N = 44;
  const beadM = addMat({ color: 0x7fe0ff, opacity: 0.95 });
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), beadM, N); beads.frustumCulled = false; root.add(beads);
  const loopM = addMat({ color: 0x9feaff, opacity: 0.95, side: THREE.DoubleSide });
  const loop = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 48), loopM); root.add(loop);
  const loopGlow = new THREE.Mesh(new THREE.TorusGeometry(1, 0.09, 8, 48), addMat({ color: 0x3fb0ff, opacity: 0.35 })); loop.add(loopGlow);
  const light = new THREE.PointLight(0x5ac8ff, 0, 9, 1.4); root.add(light);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  root.visible = false;
  return {
    root,
    // st: { t, on 0..1, hand: Vector3, x, y, z, r, flat 0/1, twirl 0/1, flicker, tiltX, tiltZ }
    update(st) {
      const on = st.on ?? 0;
      root.visible = on > 0.01 && !!st.hand;
      if (!root.visible) return;
      const t = st.t, h = st.hand;
      let cx = st.x, cy = st.y, cz = st.z, r = st.r ?? 0.5, flat = st.flat ?? 0;
      if ((st.twirl ?? 0) > 0.5) { cx = h.x + 0.35 * Math.cos(t * 9); cy = h.y + 0.75; cz = h.z + 0.35 * Math.sin(t * 9); r = 0.42; flat = 1; }
      const fl = st.flicker ? (Math.sin(t * 41) * Math.sin(t * 13) > 0 ? 1 : 0.2) : 1;
      // the loop
      loop.position.set(lerp(h.x, cx, on), lerp(h.y, cy, on), lerp(h.z, cz, on));
      loop.rotation.set(flat > 0.5 ? P / 2 + (st.tiltX ?? 0) : (st.tiltX ?? 0), flat > 0.5 ? 0 : Math.atan2(cx - h.x, cz - h.z), flat > 0.5 ? t * 3 : (st.tiltZ ?? 0));
      loop.scale.setScalar(Math.max(0.01, r * (0.3 + 0.7 * on)));
      loopM.opacity = 0.95 * fl; beadM.opacity = 0.95 * fl;
      // the rope: from the hand to the near edge of the loop, sagging a little
      const ex = loop.position.x, ey = loop.position.y - (flat > 0.5 ? 0 : r * 0.0), ez = loop.position.z;
      const d = Math.hypot(ex - h.x, ey - h.y, ez - h.z), sag = Math.min(1.2, d * 0.08);
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        ps.set(lerp(h.x, ex, u), lerp(h.y, ey, u) - Math.sin(u * P) * sag + 0.02 * Math.sin(t * 20 + i), lerp(h.z, ez, u));
        sc.setScalar(0.028 * (0.8 + 0.4 * Math.sin(t * 15 - i * 0.6)));
        m4.compose(ps, q, sc); beads.setMatrixAt(i, m4);
      }
      beads.instanceMatrix.needsUpdate = true;
      light.position.copy(loop.position); light.intensity = 6 * on * fl;
    },
  };
}

// ------------------------------------------------------------------ FRED'S HAT, THROWN LIKE A BOOMERANG
export function buildFlyHat() {
  const root = new THREE.Group();
  const felt = mat(0x2a1c12, { r: 0.85 });
  const spin = grp(root);
  mk(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 30), felt, spin, [0, 0, 0], [0, 0, 0], [1, 1, 0.92]);
  mk(new THREE.CylinderGeometry(0.15, 0.18, 0.2, 22), felt, spin, [0, 0.1, 0]);
  mk(new THREE.SphereGeometry(0.16, 16, 8, 0, P * 2, 0, P / 2), felt, spin, [0, 0.19, 0], [0, 0, 0], [1, 0.35, 1.05]);
  mk(new THREE.CylinderGeometry(0.182, 0.182, 0.04, 22), mat(0x0a0806, { r: 0.6 }), spin, [0, 0.03, 0]);
  const trail = mk(new THREE.TorusGeometry(0.5, 0.03, 6, 32), addMat({ color: 0x40e8ff, opacity: 0.7 }), root, [0, 0, 0], [P / 2, 0, 0], null, false);
  const light = new THREE.PointLight(0x40e8ff, 0, 6, 1.5); root.add(light);
  root.visible = false;
  return {
    root,
    update(st) {
      root.visible = !!st.vis;
      if (!root.visible) return;
      root.position.set(st.x, st.y, st.z);
      spin.rotation.set(0.25, st.t * 22, 0.15);
      trail.rotation.z = st.t * 30; trail.material.opacity = 0.7 * (st.glow ?? 1); trail.scale.setScalar(1 + 0.15 * Math.sin(st.t * 30));
      light.intensity = 5 * (st.glow ?? 1);
    },
  };
}
