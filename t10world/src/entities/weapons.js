// T10 World - the armoury. Twenty families crossed with twenty patterns makes
// four hundred distinct guns, each with its own stats and its own model, built
// from the family silhouette and the pattern's modifications.
//
// Nothing is an asset: a gun's mesh is assembled from boxes and cylinders the
// first time you hold it, then cached.
import * as THREE from '../../vendor/three.module.js';
import { boxUV, cylinderUV, transformed } from '../world/geomutils.js';
import { metalMaterial, paintedMaterial } from '../world/materials.js';
import { clampv, lerpv, makeRng } from '../core/math.js';

/**
 * A family is a shape and a role. Lengths are in metres; `rpm` is rounds per
 * minute, `spread` is radians of cone at the muzzle.
 */
export const WEAPON_FAMILIES = [
  { id: 'pistol',    name: 'Pistol',            cls: 'Sidearm',  dmg: 34, rpm: 420,  mag: 15,  range: 55,  spread: 0.012, recoil: 0.9,  reload: 1.5, barrel: 0.13, body: 0.20, stock: 0, grip: 1, auto: false, pellets: 1, weight: 0.9 },
  { id: 'revolver',  name: 'Revolver',          cls: 'Sidearm',  dmg: 62, rpm: 160,  mag: 6,   range: 65,  spread: 0.010, recoil: 1.9,  reload: 2.8, barrel: 0.16, body: 0.17, stock: 0, grip: 1, auto: false, pellets: 1, weight: 1.2, cylinder: true },
  { id: 'machpist',  name: 'Machine Pistol',    cls: 'Sidearm',  dmg: 24, rpm: 1100, mag: 24,  range: 42,  spread: 0.030, recoil: 1.1,  reload: 1.7, barrel: 0.12, body: 0.22, stock: 0, grip: 1, auto: true,  pellets: 1, weight: 1.1 },
  { id: 'smg',       name: 'SMG',               cls: 'Automatic', dmg: 27, rpm: 900, mag: 32,  range: 60,  spread: 0.022, recoil: 1.0,  reload: 2.1, barrel: 0.20, body: 0.34, stock: 1, grip: 1, auto: true,  pellets: 1, weight: 2.6 },
  { id: 'pdw',       name: 'PDW',               cls: 'Automatic', dmg: 30, rpm: 780, mag: 40,  range: 75,  spread: 0.018, recoil: 1.0,  reload: 2.0, barrel: 0.23, body: 0.33, stock: 1, grip: 1, auto: true,  pellets: 1, weight: 2.8 },
  { id: 'carbine',   name: 'Carbine',           cls: 'Rifle',    dmg: 38, rpm: 700,  mag: 30,  range: 130, spread: 0.014, recoil: 1.3,  reload: 2.3, barrel: 0.34, body: 0.40, stock: 1, grip: 1, auto: true,  pellets: 1, weight: 3.2 },
  { id: 'assault',   name: 'Assault Rifle',     cls: 'Rifle',    dmg: 42, rpm: 640,  mag: 30,  range: 170, spread: 0.012, recoil: 1.5,  reload: 2.4, barrel: 0.42, body: 0.42, stock: 1, grip: 1, auto: true,  pellets: 1, weight: 3.6 },
  { id: 'battle',    name: 'Battle Rifle',      cls: 'Rifle',    dmg: 58, rpm: 480,  mag: 20,  range: 220, spread: 0.010, recoil: 2.1,  reload: 2.6, barrel: 0.50, body: 0.46, stock: 1, grip: 1, auto: true,  pellets: 1, weight: 4.3 },
  { id: 'bullpup',   name: 'Bullpup',           cls: 'Rifle',    dmg: 40, rpm: 720,  mag: 30,  range: 165, spread: 0.012, recoil: 1.3,  reload: 2.5, barrel: 0.46, body: 0.30, stock: 0, grip: 1, auto: true,  pellets: 1, weight: 3.4, bullpup: true },
  { id: 'dmr',       name: 'Marksman Rifle',    cls: 'Precision', dmg: 78, rpm: 260, mag: 15,  range: 300, spread: 0.005, recoil: 2.4,  reload: 2.7, barrel: 0.58, body: 0.48, stock: 1, grip: 1, auto: false, pellets: 1, weight: 4.6, scope: true },
  { id: 'sniper',    name: 'Sniper Rifle',      cls: 'Precision', dmg: 130, rpm: 48, mag: 5,   range: 520, spread: 0.002, recoil: 3.6,  reload: 3.4, barrel: 0.68, body: 0.52, stock: 1, grip: 0, auto: false, pellets: 1, weight: 6.2, scope: true, bolt: true },
  { id: 'antimat',   name: 'Anti-Materiel',     cls: 'Precision', dmg: 240, rpm: 34, mag: 5,   range: 700, spread: 0.002, recoil: 5.2,  reload: 4.2, barrel: 0.86, body: 0.60, stock: 1, grip: 1, auto: false, pellets: 1, weight: 11.5, scope: true, muzzle: true },
  { id: 'pump',      name: 'Pump Shotgun',      cls: 'Shotgun',  dmg: 22, rpm: 70,   mag: 6,   range: 32,  spread: 0.075, recoil: 3.0,  reload: 3.6, barrel: 0.46, body: 0.44, stock: 1, grip: 0, auto: false, pellets: 9, weight: 3.4 },
  { id: 'semishot',  name: 'Semi Shotgun',      cls: 'Shotgun',  dmg: 20, rpm: 150,  mag: 8,   range: 34,  spread: 0.070, recoil: 2.6,  reload: 3.2, barrel: 0.44, body: 0.46, stock: 1, grip: 1, auto: false, pellets: 9, weight: 3.6 },
  { id: 'autoshot',  name: 'Auto Shotgun',      cls: 'Shotgun',  dmg: 17, rpm: 300,  mag: 12,  range: 30,  spread: 0.085, recoil: 2.4,  reload: 3.0, barrel: 0.40, body: 0.48, stock: 1, grip: 1, auto: true,  pellets: 8, weight: 4.4 },
  { id: 'lmg',       name: 'Light Machine Gun', cls: 'Support',  dmg: 44, rpm: 720,  mag: 100, range: 200, spread: 0.020, recoil: 1.8,  reload: 5.2, barrel: 0.56, body: 0.52, stock: 1, grip: 1, auto: true,  pellets: 1, weight: 8.4, bipod: true },
  { id: 'minigun',   name: 'Minigun',           cls: 'Support',  dmg: 30, rpm: 2400, mag: 300, range: 150, spread: 0.034, recoil: 1.2,  reload: 7.0, barrel: 0.62, body: 0.58, stock: 0, grip: 1, auto: true,  pellets: 1, weight: 22, rotary: true, spinUp: 0.55 },
  { id: 'grenade',   name: 'Grenade Launcher',  cls: 'Heavy',    dmg: 140, rpm: 55,  mag: 6,   range: 110, spread: 0.014, recoil: 3.2,  reload: 4.0, barrel: 0.30, body: 0.44, stock: 1, grip: 1, auto: false, pellets: 1, weight: 6.8, bore: 0.05, blast: 5.5 },
  { id: 'rocket',    name: 'Rocket Launcher',   cls: 'Heavy',    dmg: 260, rpm: 22,  mag: 1,   range: 240, spread: 0.008, recoil: 4.4,  reload: 4.6, barrel: 0.90, body: 0.24, stock: 0, grip: 1, auto: false, pellets: 1, weight: 9.5, bore: 0.07, blast: 9 },
  { id: 'railgun',   name: 'Railgun',           cls: 'Exotic',   dmg: 200, rpm: 40,  mag: 4,   range: 600, spread: 0.0,   recoil: 3.0,  reload: 3.8, barrel: 0.74, body: 0.46, stock: 1, grip: 1, auto: false, pellets: 1, weight: 7.6, scope: true, exotic: true },
];

/**
 * A pattern is a make and a set of modifications. Multipliers are applied on
 * top of the family, so a Compact Sniper really is shorter, faster to bring up
 * and less accurate than a Match one.
 */
export const WEAPON_PATTERNS = [
  { id: 'std',     name: 'Standard',    dmg: 1.00, rpm: 1.00, mag: 1.00, range: 1.00, spread: 1.00, recoil: 1.00, tint: 0x3b4046 },
  { id: 'mk2',     name: 'Mk II',       dmg: 1.06, rpm: 1.04, mag: 1.00, range: 1.05, spread: 0.94, recoil: 0.96, tint: 0x343a41 },
  { id: 'mk3',     name: 'Mk III',      dmg: 1.12, rpm: 1.08, mag: 1.10, range: 1.10, spread: 0.88, recoil: 0.92, tint: 0x2d3338 },
  { id: 'compact', name: 'Compact',     dmg: 0.92, rpm: 1.10, mag: 0.80, range: 0.72, spread: 1.30, recoil: 0.85, tint: 0x40464d, len: 0.70 },
  { id: 'long',    name: 'Longbarrel',  dmg: 1.14, rpm: 0.92, mag: 1.00, range: 1.45, spread: 0.72, recoil: 1.15, tint: 0x363c43, len: 1.35 },
  { id: 'match',   name: 'Match',       dmg: 1.10, rpm: 0.96, mag: 1.00, range: 1.25, spread: 0.55, recoil: 0.80, tint: 0x23272b, scope: true },
  { id: 'tac',     name: 'Tactical',    dmg: 1.00, rpm: 1.06, mag: 1.15, range: 1.05, spread: 0.85, recoil: 0.88, tint: 0x2a2f33, rail: true },
  { id: 'sup',     name: 'Suppressed',  dmg: 0.94, rpm: 1.00, mag: 1.00, range: 0.92, spread: 0.80, recoil: 0.72, tint: 0x1e2226, suppressor: true, quiet: true },
  { id: 'heavy',   name: 'Heavy',       dmg: 1.30, rpm: 0.78, mag: 0.85, range: 1.12, spread: 1.05, recoil: 1.45, tint: 0x30353a, bulk: 1.18 },
  { id: 'light',   name: 'Lightweight', dmg: 0.90, rpm: 1.18, mag: 0.90, range: 0.95, spread: 1.10, recoil: 0.78, tint: 0x555c63, bulk: 0.86 },
  { id: 'drum',    name: 'Drum',        dmg: 1.00, rpm: 1.00, mag: 2.20, range: 1.00, spread: 1.08, recoil: 1.10, tint: 0x353b41, drum: true },
  { id: 'burst',   name: 'Burst',       dmg: 1.08, rpm: 1.30, mag: 1.00, range: 1.05, spread: 0.90, recoil: 1.05, tint: 0x2f343a, burst: 3 },
  { id: 'rapid',   name: 'Rapid',       dmg: 0.86, rpm: 1.55, mag: 1.20, range: 0.92, spread: 1.20, recoil: 1.12, tint: 0x3a4148 },
  { id: 'vet',     name: 'Veteran',     dmg: 1.18, rpm: 1.05, mag: 1.05, range: 1.15, spread: 0.78, recoil: 0.86, tint: 0x4a3f30 },
  { id: 'proto',   name: 'Prototype',   dmg: 1.24, rpm: 1.12, mag: 1.10, range: 1.20, spread: 0.70, recoil: 0.90, tint: 0x2b3a44, glow: 0x39c9ff },
  { id: 'gold',    name: 'Gilded',      dmg: 1.15, rpm: 1.05, mag: 1.00, range: 1.10, spread: 0.82, recoil: 0.90, tint: 0xc9a227, shiny: true },
  { id: 'rust',    name: 'Salvaged',    dmg: 0.82, rpm: 0.90, mag: 0.85, range: 0.80, spread: 1.45, recoil: 1.25, tint: 0x6a4a34 },
  { id: 'urban',   name: 'Urban',       dmg: 1.00, rpm: 1.02, mag: 1.00, range: 0.98, spread: 0.96, recoil: 0.96, tint: 0x8d949b },
  { id: 'night',   name: 'Nightstalker', dmg: 1.05, rpm: 1.04, mag: 1.05, range: 1.02, spread: 0.84, recoil: 0.88, tint: 0x14181c, suppressor: true, quiet: true },
  { id: 'apex',    name: 'Apex',        dmg: 1.35, rpm: 1.15, mag: 1.25, range: 1.30, spread: 0.60, recoil: 0.75, tint: 0x191d21, scope: true, rail: true, glow: 0xff8a2b },
];

/** The full catalogue: every family in every pattern. */
export const WEAPONS = [];
const BY_ID = new Map();

for (const fam of WEAPON_FAMILIES) {
  for (const pat of WEAPON_PATTERNS) {
    const id = fam.id + '_' + pat.id;
    const w = {
      id,
      family: fam.id,
      pattern: pat.id,
      name: pat.id === 'std' ? fam.name : pat.name + ' ' + fam.name,
      cls: fam.cls,
      damage: Math.round(fam.dmg * pat.dmg),
      rpm: Math.round(fam.rpm * pat.rpm),
      mag: Math.max(1, Math.round(fam.mag * pat.mag)),
      range: Math.round(fam.range * pat.range),
      spread: fam.spread * pat.spread,
      recoil: fam.recoil * pat.recoil,
      reload: +(fam.reload * lerpv(1, 0.85, pat.mag > 1 ? 0 : 1)).toFixed(2),
      auto: !!fam.auto,
      burst: pat.burst || 0,
      pellets: fam.pellets,
      weight: +(fam.weight * (pat.bulk || 1)).toFixed(1),
      quiet: !!pat.quiet,
      blast: fam.blast || 0,
      spinUp: fam.spinUp || 0,
      fam, pat,
    };
    w.dps = Math.round(w.damage * w.pellets * (w.rpm / 60));
    WEAPONS.push(w);
    BY_ID.set(id, w);
  }
}

export function weaponById(id) { return BY_ID.get(id) || null; }

/** Best match for a spoken name, e.g. "gilded sniper" or "ak" -> closest gun. */
export function findWeapon(query) {
  const q = String(query || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!q) return null;
  const words = q.split(' ').filter(Boolean);
  let best = null, bestScore = 0;
  for (const w of WEAPONS) {
    const name = w.name.toLowerCase();
    let score = 0;
    if (name === q) score = 100;
    else if (name.includes(q)) score = 60 + q.length;
    else {
      for (const word of words) {
        if (word.length < 2) continue;
        if (name.includes(word)) score += 8 + word.length;
        if (w.cls.toLowerCase() === word) score += 6;
      }
      // Prefer the plain pattern when only the family was named.
      if (w.pattern === 'std') score += 3;
    }
    if (score > bestScore) { bestScore = score; best = w; }
  }
  return bestScore >= 8 ? best : null;
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------
const meshCache = new Map();

/** Build (or fetch) the mesh for a gun. Shared — clone before parenting. */
export function weaponMesh(w) {
  if (meshCache.has(w.id)) return meshCache.get(w.id);
  const fam = w.fam, pat = w.pat;
  const lenK = pat.len || 1;
  const bulk = pat.bulk || 1;

  const body = paintedMaterial(pat.tint, pat.shiny ? 0.18 : 0.62);
  const dark = metalMaterial(pat.shiny ? 0xd8b23a : 0x24282c, pat.shiny ? 0.15 : 0.42);
  const grip = paintedMaterial(pat.id === 'vet' ? 0x53402b : 0x1b1e21, 0.78);

  const group = new THREE.Group();
  const add = (mat, geo) => { const m = new THREE.Mesh(geo, mat); m.castShadow = false; m.receiveShadow = false; group.add(m); };

  const bodyLen = fam.body * lenK;
  const barrelLen = fam.barrel * lenK;
  const h = 0.075 * bulk;

  // Receiver.
  add(body, transformed(boxUV(bodyLen, h, 0.055 * bulk, 1, 1), bodyLen * 0.5, 0, 0, 0));
  // Barrel. The cylinder helper builds along Y, so every tube here is laid
  // along X by hand — the gun points down its own +X axis.
  const bore = (fam.bore || 0.011) * bulk;
  const barrelGeo = cylinderUV(bore, bore * 1.08, barrelLen, fam.rotary ? 12 : 8, 1, 1);
  barrelGeo.rotateZ(Math.PI / 2);
  barrelGeo.translate(bodyLen + barrelLen * 0.5, 0.004, 0);
  add(dark, barrelGeo);

  if (fam.rotary) {
    // Minigun: a ring of barrels around the axis.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const g = cylinderUV(bore * 0.7, bore * 0.7, barrelLen, 6, 1, 1);
      g.rotateZ(Math.PI / 2);
      g.translate(bodyLen + barrelLen * 0.5, 0.004 + Math.sin(a) * 0.035, Math.cos(a) * 0.035);
      add(dark, g);
    }
  }

  // Grip.
  const gripGeo = boxUV(0.045, 0.13 * bulk, 0.04, 1, 1);
  gripGeo.translate(bodyLen * (fam.bullpup ? 0.28 : 0.20), -0.095 * bulk, 0);
  add(grip, gripGeo);

  // Fore grip.
  if (fam.grip) {
    const fg = boxUV(0.04, 0.085, 0.036, 1, 1);
    fg.translate(bodyLen + barrelLen * 0.32, -0.062, 0);
    add(grip, fg);
  }

  // Stock.
  if (fam.stock) {
    const st = boxUV(0.17 * lenK, 0.075, 0.045, 1, 1);
    st.translate(-0.085 * lenK, -0.012, 0);
    add(grip, st);
  }

  // Magazine, or a drum, or a revolver cylinder.
  if (fam.cylinder) {
    const cyl = cylinderUV(0.035, 0.035, 0.05, 10, 1, 1);
    cyl.rotateZ(Math.PI / 2);
    cyl.translate(bodyLen * 0.62, -0.006, 0);
    add(dark, cyl);
  } else if (pat.drum) {
    const drum = cylinderUV(0.072, 0.072, 0.05, 14, 1, 1);
    drum.rotateX(Math.PI / 2);
    drum.translate(bodyLen * 0.52, -0.105, 0);
    add(dark, drum);
  } else if (w.mag > 1) {
    const magLen = clampv(0.06 + w.mag * 0.0022, 0.07, 0.21);
    const mg = boxUV(0.035, magLen, 0.05, 1, 1);
    mg.translate(bodyLen * (fam.bullpup ? 0.74 : 0.52), -0.04 - magLen * 0.5, 0);
    add(dark, mg);
  }

  // Optic.
  if (fam.scope || pat.scope) {
    const tube = cylinderUV(0.021, 0.021, fam.scope ? 0.20 : 0.11, 10, 1, 1);
    tube.rotateZ(Math.PI / 2);
    tube.translate(bodyLen * 0.58, h * 0.5 + 0.03, 0);
    add(dark, tube);
    const mount = boxUV(0.03, 0.03, 0.03, 1, 1);
    mount.translate(bodyLen * 0.58, h * 0.5 + 0.012, 0);
    add(dark, mount);
  } else if (pat.rail) {
    const rail = boxUV(bodyLen * 0.5, 0.012, 0.03, 1, 1);
    rail.translate(bodyLen * 0.6, h * 0.5 + 0.007, 0);
    add(dark, rail);
  }

  // Suppressor.
  if (pat.suppressor) {
    const sup = cylinderUV(bore * 2.6, bore * 2.6, 0.16, 10, 1, 1);
    sup.rotateZ(Math.PI / 2);
    sup.translate(bodyLen + barrelLen + 0.08, 0.004, 0);
    add(dark, sup);
  } else if (fam.muzzle) {
    const brake = cylinderUV(bore * 2.2, bore * 2.2, 0.06, 8, 1, 1);
    brake.rotateZ(Math.PI / 2);
    brake.translate(bodyLen + barrelLen + 0.03, 0.004, 0);
    add(dark, brake);
  }

  if (fam.bipod) {
    for (const side of [-1, 1]) {
      const leg = boxUV(0.012, 0.11, 0.012, 1, 1);
      leg.translate(bodyLen + barrelLen * 0.6, -0.075, side * 0.03);
      add(dark, leg);
    }
  }

  // A prototype or apex pattern glows a little.
  if (pat.glow) {
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x101418, emissive: pat.glow, emissiveIntensity: 2.2, roughness: 0.4,
    });
    const strip = boxUV(bodyLen * 0.6, 0.008, 0.01, 1, 1);
    strip.translate(bodyLen * 0.55, 0.004, 0.031);
    add(glowMat, strip);
  }

  // Where the muzzle actually is, for flashes and tracers.
  group.userData.muzzle = new THREE.Vector3(
    bodyLen + barrelLen + (pat.suppressor ? 0.16 : 0.02), 0.004, 0
  );
  group.userData.weaponId = w.id;
  meshCache.set(w.id, group);
  return group;
}

export const WEAPON_CLASSES = [...new Set(WEAPON_FAMILIES.map((f) => f.cls))];
