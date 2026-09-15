// T10 World - procedural building geometry. Each lot becomes a stack of massed
// volumes with a baked-UV facade, a detailed roof and a real entrance you can
// walk up to.
import * as THREE from '../../vendor/three.module.js';
import { makeRng, clamp01, clampv, lerpv, TAU } from '../core/math.js';
import { boxUV, prism, cylinderUV, transformed, ribbon } from './geomutils.js';
import {
  facadeMaterial, FACADE_TILE, roofMaterial, concreteMaterial, metalMaterial,
  paintedMaterial, glassMaterial, emissiveMaterial, FACADE_STYLES,
} from './materials.js';
import { settings } from '../core/settings.js';

const FLOOR_H = 3.4;

/** Signage colours so shop fronts aren't all the same. */
const SIGN_COLORS = [0xd94f3d, 0x2f7fb8, 0x3f9a58, 0xd9a13d, 0x8b5fbf, 0xd9548a, 0x3ba9a0, 0xe06c2a];
const SHOP_NAMES = ['MARKET', 'DELI', 'COFFEE', 'LAUNDRY', 'PHARMACY', 'BOOKS', 'BARBER', 'PIZZA',
  'HARDWARE', 'FLORIST', 'BAKERY', 'RECORDS', 'NOODLES', 'GROCER', 'TAILOR', 'OPTICS'];

/**
 * Build one lot.
 * @returns { doors: [...], colliders: [...], lights: [...] } — geometry goes
 * straight into the batcher so a whole chunk merges into few draw calls.
 */
export function buildLot(lot, batcher, ctx) {
  const rng = makeRng(lot.seed);
  const out = { doors: [], colliders: [], lights: [], interiors: [] };
  const kind = lot.kind || 'office';

  switch (kind) {
    case 'house': buildHouse(lot, batcher, rng, out); break;
    case 'barn': buildBarn(lot, batcher, rng, out); break;
    case 'warehouse': case 'industrial': buildWarehouse(lot, batcher, rng, out); break;
    case 'gas': buildGasStation(lot, batcher, rng, out); break;
    case 'stadium': buildStadium(lot, batcher, rng, out); break;
    case 'church': buildChurch(lot, batcher, rng, out); break;
    case 'school': buildSchool(lot, batcher, rng, out); break;
    case 'fire': buildFireStation(lot, batcher, rng, out); break;
    case 'police': buildCivic(lot, batcher, rng, out, 0x2b4a7a, 'POLICE'); break;
    case 'hospital': buildCivic(lot, batcher, rng, out, 0xc23b3b, 'HOSPITAL'); break;
    case 'station': buildCivic(lot, batcher, rng, out, 0x4a6b52, 'UNION STATION'); break;
    case 'mall': buildMall(lot, batcher, rng, out); break;
    case 'shop': case 'restaurant': case 'cafe': case 'diner': case 'bar': case 'store': case 'arcade':
      buildShop(lot, batcher, rng, out, kind); break;
    case 'gym': buildBoxBuilding(lot, batcher, rng, out, { floors: 2, roof: 'flat', signText: 'GYM' }); break;
    case 'tower': buildTower(lot, batcher, rng, out); break;
    default: buildBoxBuilding(lot, batcher, rng, out, {}); break;
  }
  return out;
}

function styleFor(lot, rng) {
  if (lot.styleIndex != null) return lot.styleIndex;
  return rng.int(0, FACADE_STYLES.length - 1);
}

function addDoor(out, lot, x, y, z, facing, label) {
  out.doors.push({
    x, y, z, facing, label: label || lot.name || null, lot,
    kind: lot.kind, district: lot.district,
  });
}

// ---------------------------------------------------------------------------
// Massing helpers
// ---------------------------------------------------------------------------

function addMass(batcher, mat, w, h, d, x, y, z, rot) {
  batcher.add(mat, transformed(boxUV(w, h, d, FACADE_TILE.w, FACADE_TILE.h), x, y + h / 2, z, rot));
}

function addParapet(batcher, w, d, x, y, z, rot, height) {
  const mat = concreteMaterial(0xa3a099);
  const t = 0.45;
  const h = height || 1.1;
  for (const [ox, oz, sw, sd] of [
    [0, d / 2 - t / 2, w, t], [0, -d / 2 + t / 2, w, t],
    [w / 2 - t / 2, 0, t, d], [-w / 2 + t / 2, 0, t, d],
  ]) {
    const c = Math.cos(rot), s = Math.sin(rot);
    batcher.add(mat, transformed(boxUV(sw, h, sd, 3, 3), x + ox * c - oz * s, y + h / 2, z + ox * s + oz * c, rot));
  }
}

/** Rooftop clutter — the thing that makes a skyline read as a real city. */
function addRoofDetails(batcher, rng, w, d, x, y, z, rot, scale) {
  const metal = metalMaterial(0x8d9296, 0.55);
  const dark = paintedMaterial(0x4a4f53, 0.8);
  const count = Math.max(1, Math.round(clamp01(Math.min(w, d) / 30) * rng.range(2, 6)));
  for (let i = 0; i < count; i++) {
    const uw = rng.range(1.4, 3.4) * (scale || 1);
    const ud = rng.range(1.2, 2.8) * (scale || 1);
    const uh = rng.range(0.8, 1.9);
    const ox = rng.range(-w * 0.34, w * 0.34);
    const oz = rng.range(-d * 0.34, d * 0.34);
    const c = Math.cos(rot), s = Math.sin(rot);
    batcher.add(metal, transformed(boxUV(uw, uh, ud, 3, 3), x + ox * c - oz * s, y + uh / 2, z + ox * s + oz * c, rot));
    if (rng.chance(0.5)) {
      batcher.add(dark, transformed(boxUV(uw * 0.7, 0.16, ud * 0.7, 3, 3), x + ox * c - oz * s, y + uh + 0.08, z + ox * s + oz * c, rot));
    }
  }
  // Stair bulkhead
  if (Math.min(w, d) > 12 && rng.chance(0.75)) {
    const bw = rng.range(3, 5.5), bd = rng.range(3, 5), bh = rng.range(2.4, 3.4);
    const ox = rng.range(-w * 0.25, w * 0.25), oz = rng.range(-d * 0.25, d * 0.25);
    const c = Math.cos(rot), s = Math.sin(rot);
    batcher.add(concreteMaterial(0x9d9a93), transformed(boxUV(bw, bh, bd, 4, 4), x + ox * c - oz * s, y + bh / 2, z + ox * s + oz * c, rot));
  }
  // Antenna / water tank
  if (rng.chance(0.35)) {
    const ph = rng.range(3, 9);
    batcher.add(metal, transformed(cylinderUV(0.09, 0.14, ph, 6, 1, 1), x, y + ph / 2, z, 0));
  }
  if (rng.chance(0.22) && Math.min(w, d) > 14) {
    const tr = rng.range(1.4, 2.4), th = rng.range(2.2, 3.4);
    batcher.add(metal, transformed(cylinderUV(tr, tr, th, 10, 3, 3), x + w * 0.2, y + th / 2 + 1.2, z - d * 0.2, 0));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      batcher.add(dark, transformed(boxUV(0.14, 1.2, 0.14, 1, 1), x + w * 0.2 + Math.cos(a) * tr * 0.8, y + 0.6, z - d * 0.2 + Math.sin(a) * tr * 0.8, 0));
    }
  }
}

/** Ground-floor entrance: recess, glass doors, canopy, step. */
function addEntrance(batcher, out, lot, rng, w, d, x, y, z, rot, opts) {
  opts = opts || {};
  const doorW = opts.width || 3.2;
  const doorH = opts.height || 2.7;
  const c = Math.cos(rot), s = Math.sin(rot);
  const front = d * 0.5;
  const dx = x + (0) * c - (front) * s;
  const dz = z + (0) * s + (front) * c;

  // Glass door panel set slightly proud of the facade.
  batcher.add(glassMaterial(0x42586a, 0.55),
    transformed(boxUV(doorW, doorH, 0.22, 3, 3), dx + Math.sin(rot) * 0.02, y + doorH / 2, dz + Math.cos(rot) * 0.02, rot));
  // Frame
  const frame = metalMaterial(0x6f747a, 0.45);
  batcher.add(frame, transformed(boxUV(doorW + 0.5, 0.24, 0.34, 2, 2), dx, y + doorH + 0.12, dz, rot));
  for (const sx of [-1, 1]) {
    batcher.add(frame, transformed(boxUV(0.25, doorH, 0.34, 2, 2),
      dx + sx * (doorW / 2 + 0.12) * c, y + doorH / 2, dz + sx * (doorW / 2 + 0.12) * s, rot));
  }
  // Step
  batcher.add(concreteMaterial(0xb2afa7),
    transformed(boxUV(doorW + 1.8, 0.18, 1.5, 3, 3), dx + Math.sin(rot) * 0.8, y + 0.09, dz + Math.cos(rot) * 0.8, rot));
  // Canopy
  if (opts.canopy !== false) {
    batcher.add(paintedMaterial(opts.canopyColor != null ? opts.canopyColor : 0x39414a, 0.6),
      transformed(boxUV(doorW + 2.2, 0.20, 1.7, 3, 3), dx + Math.sin(rot) * 0.85, y + doorH + 0.45, dz + Math.cos(rot) * 0.85, rot));
  }
  // Entrance light so doorways glow at night.
  out.lights.push({ x: dx + Math.sin(rot) * 0.9, y: y + doorH + 0.55, z: dz + Math.cos(rot) * 0.9, color: 0xffd9a0, intensity: 1.1, distance: 9 });
  addDoor(out, lot, dx, y, dz, rot, opts.label);
}

function addSign(batcher, text, color, w, h, x, y, z, rot) {
  batcher.add(emissiveMaterial(color, 1.6), transformed(boxUV(w, h, 0.22, 2, 2), x, y, z, rot));
  batcher.add(paintedMaterial(0x2a2d31, 0.7), transformed(boxUV(w + 0.28, h + 0.28, 0.14, 2, 2), x, y, z - 0.06, rot));
}

// ---------------------------------------------------------------------------
// Building types
// ---------------------------------------------------------------------------

function buildBoxBuilding(lot, batcher, rng, out, opts) {
  opts = opts || {};
  const style = styleFor(lot, rng);
  const mat = facadeMaterial(style, lot.seed);
  const floors = opts.floors || Math.max(1, Math.round(lot.height / FLOOR_H));
  const h = floors * FLOOR_H;
  const w = lot.w, d = lot.d, rot = lot.rot || 0;

  addMass(batcher, mat, w, h, d, lot.x, 0, lot.z, rot);
  addParapet(batcher, w, d, lot.x, h, lot.z, rot);
  batcher.add(roofMaterial('flat'),
    transformed(boxUV(w - 0.6, 0.3, d - 0.6, 4, 4), lot.x, h + 0.15, lot.z, rot));
  if (settings.preset.interiorDetail > 0) addRoofDetails(batcher, rng, w, d, lot.x, h + 0.3, lot.z, rot);
  addEntrance(batcher, out, lot, rng, w, d, lot.x, 0, lot.z, rot, { label: opts.signText });
  if (opts.signText) {
    addSign(batcher, opts.signText, rng.pick(SIGN_COLORS), Math.min(w * 0.5, 6), 1.1,
      lot.x - Math.sin(rot) * (d * 0.5 + 0.2), 4.2, lot.z - Math.cos(rot) * (d * 0.5 + 0.2) * -1, rot);
  }
  out.colliders.push({ x: lot.x, z: lot.z, w, d, rot, h });
}

function buildTower(lot, batcher, rng, out) {
  const style = styleFor(lot, rng);
  const mat = facadeMaterial(style, lot.seed);
  const rot = lot.rot || 0;
  let w = lot.w, d = lot.d;
  let y = 0;
  const totalH = lot.height;

  // Podium
  const podiumH = Math.min(totalH * 0.22, rng.range(7, 16));
  addMass(batcher, mat, w, podiumH, d, lot.x, 0, lot.z, rot);
  y += podiumH;
  if (lot.w > 26) addParapet(batcher, w, d, lot.x, y, lot.z, rot, 0.9);

  // Setback tiers.
  const tiers = clampv(Math.round(totalH / 32), 1, 4);
  let remaining = totalH - podiumH;
  for (let i = 0; i < tiers; i++) {
    const shrink = i === 0 ? rng.range(0.80, 0.92) : rng.range(0.78, 0.9);
    w *= shrink; d *= shrink;
    const th = i === tiers - 1 ? remaining : remaining * rng.range(0.4, 0.6);
    addMass(batcher, mat, w, th, d, lot.x, y, lot.z, rot);
    y += th;
    remaining -= th;
    if (remaining <= 1) break;
    addParapet(batcher, w, d, lot.x, y, lot.z, rot, 0.8);
  }
  batcher.add(roofMaterial('flat'), transformed(boxUV(w - 0.6, 0.3, d - 0.6, 4, 4), lot.x, y + 0.15, lot.z, rot));
  addParapet(batcher, w, d, lot.x, y, lot.z, rot, 1.2);
  addRoofDetails(batcher, rng, w, d, lot.x, y + 0.3, lot.z, rot, 1.2);

  // Aviation beacon on tall towers.
  if (totalH > 70) {
    const mastH = rng.range(6, 18);
    batcher.add(metalMaterial(0x9aa0a4, 0.5), transformed(cylinderUV(0.12, 0.2, mastH, 6, 1, 1), lot.x, y + mastH / 2, lot.z, 0));
    out.lights.push({ x: lot.x, y: y + mastH, z: lot.z, color: 0xff3030, intensity: 2.2, distance: 24, beacon: true });
  }
  addEntrance(batcher, out, lot, rng, lot.w, lot.d, lot.x, 0, lot.z, rot, { width: 4.4, height: 3.6, label: lot.name });
  out.colliders.push({ x: lot.x, z: lot.z, w: lot.w, d: lot.d, rot, h: totalH });
}

function buildHouse(lot, batcher, rng, out) {
  const style = rng.chance(0.5) ? 10 : 11;
  const mat = facadeMaterial(style, lot.seed);
  const rot = lot.rot || 0;
  const floors = rng.chance(0.42) ? 2 : 1;
  const h = floors * 2.9;
  const w = lot.w, d = lot.d;

  addMass(batcher, mat, w, h, d, lot.x, 0, lot.z, rot);
  // Pitched roof.
  const roofH = rng.range(1.6, 2.8);
  const roofMat = roofMaterial(rng.chance(0.7) ? 'shingle' : 'tile');
  batcher.add(roofMat, transformed(prism(w + 1.0, roofH, d + 1.0, 3, 3), lot.x, h, lot.z, rot));
  // Chimney
  if (rng.chance(0.55)) {
    const cw = 0.8;
    batcher.add(facadeMaterial(3, lot.seed + 1),
      transformed(boxUV(cw, roofH + 1.2, cw, 2, 2), lot.x + w * 0.26, h + (roofH + 1.2) / 2, lot.z + d * 0.2, rot));
  }
  // Porch
  const porchD = 1.6;
  const c = Math.cos(rot), s = Math.sin(rot);
  const pz = d * 0.5 + porchD * 0.5;
  batcher.add(paintedMaterial(0xe6e2d8, 0.75),
    transformed(boxUV(w * 0.55, 0.16, porchD, 3, 3), lot.x - pz * s, 0.08, lot.z + pz * c, rot));
  batcher.add(paintedMaterial(0xe6e2d8, 0.75),
    transformed(boxUV(w * 0.60, 0.18, porchD + 0.3, 3, 3), lot.x - pz * s, 2.45, lot.z + pz * c, rot));
  for (const sx of [-1, 1]) {
    batcher.add(paintedMaterial(0xe6e2d8, 0.75), transformed(cylinderUV(0.08, 0.08, 2.4, 6, 1, 1),
      lot.x + sx * w * 0.26 * c - pz * s, 1.2, lot.z + sx * w * 0.26 * s + pz * c, 0));
  }
  addEntrance(batcher, out, lot, rng, w, d, lot.x, 0, lot.z, rot, { width: 1.1, height: 2.2, canopy: false, label: 'Home' });

  // Garage on larger lots.
  if (w > 18 && rng.chance(0.5)) {
    const gw = 5.4, gd = 5.6, gh = 2.7;
    const gx = lot.x + (w * 0.5 + gw * 0.5 + 0.6) * c;
    const gz = lot.z + (w * 0.5 + gw * 0.5 + 0.6) * s;
    addMass(batcher, facadeMaterial(style, lot.seed + 2), gw, gh, gd, gx, 0, gz, rot);
    batcher.add(roofMat, transformed(prism(gw + 0.6, 1.1, gd + 0.6, 3, 3), gx, gh, gz, rot));
    batcher.add(paintedMaterial(0xd2cec4, 0.6),
      transformed(boxUV(gw * 0.8, 2.2, 0.16, 3, 3), gx - (gd * 0.5) * s, 1.1, gz + (gd * 0.5) * c, rot));
    out.colliders.push({ x: gx, z: gz, w: gw, d: gd, rot, h: gh });
  }
  // Fence around the garden.
  if (rng.chance(0.45)) {
    const fm = paintedMaterial(rng.pick([0xd6d2c8, 0x8a6f52, 0x9aa0a4]), 0.8);
    const fw = w + 3, fd = d + 3.5;
    for (const [ox, oz, sw, sd] of [[0, -fd / 2, fw, 0.12], [-fw / 2, 0, 0.12, fd], [fw / 2, 0, 0.12, fd]]) {
      batcher.add(fm, transformed(boxUV(sw, 1.05, sd, 2, 2), lot.x + ox * c - oz * s, 0.52, lot.z + ox * s + oz * c, rot));
    }
  }
  out.colliders.push({ x: lot.x, z: lot.z, w, d, rot, h });
}

function buildBarn(lot, batcher, rng, out) {
  const rot = lot.rot || 0;
  const w = lot.w, d = lot.d, h = rng.range(5.5, 8);
  const mat = paintedMaterial(rng.pick([0x8e3b2f, 0x7a4a34, 0xb5b0a4]), 0.9);
  addMass(batcher, mat, w, h, d, lot.x, 0, lot.z, rot);
  batcher.add(roofMaterial('shingle'), transformed(prism(w + 0.8, h * 0.45, d + 0.8, 4, 4), lot.x, h, lot.z, rot));
  batcher.add(paintedMaterial(0x4a3a2c, 0.85),
    transformed(boxUV(w * 0.34, h * 0.6, 0.2, 3, 3), lot.x - (d * 0.5) * Math.sin(rot), h * 0.3, lot.z + (d * 0.5) * Math.cos(rot), rot));
  addDoor(out, lot, lot.x - (d * 0.5) * Math.sin(rot), 0, lot.z + (d * 0.5) * Math.cos(rot), rot, 'Barn');
  out.colliders.push({ x: lot.x, z: lot.z, w, d, rot, h });
}

function buildWarehouse(lot, batcher, rng, out) {
  const rot = lot.rot || 0;
  const w = lot.w, d = lot.d, h = Math.max(7, lot.height);
  const mat = facadeMaterial(8, lot.seed);
  addMass(batcher, mat, w, h, d, lot.x, 0, lot.z, rot);
  batcher.add(roofMaterial('flat'), transformed(boxUV(w + 0.5, 0.35, d + 0.5, 5, 5), lot.x, h + 0.18, lot.z, rot));
  addRoofDetails(batcher, rng, w, d, lot.x, h + 0.35, lot.z, rot, 1.5);
  // Loading bays.
  const bays = clampv(Math.floor(w / 7), 1, 5);
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < bays; i++) {
    const ox = (i - (bays - 1) / 2) * (w / bays);
    const bx = lot.x + ox * c - (d * 0.5) * s;
    const bz = lot.z + ox * s + (d * 0.5) * c;
    batcher.add(paintedMaterial(0x7d838a, 0.7), transformed(boxUV(4.2, 4.0, 0.25, 3, 3), bx, 2.0, bz, rot));
    batcher.add(concreteMaterial(0x9c9a93), transformed(boxUV(5.0, 1.0, 2.2, 3, 3), bx - s * 1.1, 0.5, bz + c * 1.1, rot));
  }
  addDoor(out, lot, lot.x - (d * 0.5) * s, 0, lot.z + (d * 0.5) * c, rot, lot.name || 'Warehouse');
  out.colliders.push({ x: lot.x, z: lot.z, w, d, rot, h });
}

function buildShop(lot, batcher, rng, out, kind) {
  const rot = lot.rot || 0;
  const style = lot.styleIndex != null ? lot.styleIndex : 9;
  const mat = facadeMaterial(style, lot.seed);
  const floors = rng.chance(0.4) ? 2 : 1;
  const h = 4.2 + (floors - 1) * 3.2;
  const w = lot.w, d = lot.d;
  const c = Math.cos(rot), s = Math.sin(rot);

  addMass(batcher, mat, w, h, d, lot.x, 0, lot.z, rot);
  // Shopfront glazing across the ground floor.
  const glassW = w * 0.82, glassH = 2.6;
  const fx = lot.x - (d * 0.5 + 0.06) * s;
  const fz = lot.z + (d * 0.5 + 0.06) * c;
  batcher.add(glassMaterial(0x50606b, 0.4), transformed(boxUV(glassW, glassH, 0.14, 3, 3), fx, glassH / 2 + 0.35, fz, rot));
  batcher.add(metalMaterial(0x50565c, 0.5), transformed(boxUV(glassW + 0.3, 0.2, 0.22, 2, 2), fx, glassH + 0.45, fz, rot));
  // Awning
  const awnColor = rng.pick(SIGN_COLORS);
  batcher.add(paintedMaterial(awnColor, 0.75),
    transformed(boxUV(w * 0.92, 0.16, 1.5, 3, 3), fx - s * 0.75, glassH + 0.9, fz + c * 0.75, rot));
  // Sign band
  const name = kind === 'cafe' ? 'COFFEE' : kind === 'bar' ? 'BAR' : kind === 'arcade' ? 'ARCADE'
    : kind === 'diner' ? 'DINER' : kind === 'restaurant' ? rng.pick(['NOODLES', 'PIZZA', 'GRILL', 'SUSHI']) : rng.pick(SHOP_NAMES);
  addSign(batcher, name, awnColor, Math.min(w * 0.55, 5.5), 0.85, fx - s * 0.3, glassH + 1.7, fz + c * 0.3, rot);
  out.lights.push({ x: fx - s * 0.6, y: glassH + 0.7, z: fz + c * 0.6, color: 0xfff0cc, intensity: 1.3, distance: 11 });

  batcher.add(roofMaterial('flat'), transformed(boxUV(w + 0.3, 0.28, d + 0.3, 4, 4), lot.x, h + 0.14, lot.z, rot));
  addParapet(batcher, w, d, lot.x, h, lot.z, rot, 0.8);
  addEntrance(batcher, out, lot, rng, w, d, lot.x + w * 0.30 * c, 0, lot.z + w * 0.30 * s, rot,
    { width: 1.3, height: 2.4, canopy: false, label: lot.name || name });
  out.colliders.push({ x: lot.x, z: lot.z, w, d, rot, h });
}

function buildCivic(lot, batcher, rng, out, accent, label) {
  const rot = lot.rot || 0;
  const mat = facadeMaterial(lot.styleIndex != null ? lot.styleIndex : 2, lot.seed);
  const w = lot.w, d = lot.d, h = lot.height;
  addMass(batcher, mat, w, h, d, lot.x, 0, lot.z, rot);
  // Wings
  for (const sx of [-1, 1]) {
    const ww = w * 0.22, wd = d * 0.7, wh = h * 0.6;
    const c = Math.cos(rot), s = Math.sin(rot);
    const ox = sx * (w * 0.5 + ww * 0.5 - 0.5);
    addMass(batcher, mat, ww, wh, wd, lot.x + ox * c, 0, lot.z + ox * s, rot);
  }
  batcher.add(roofMaterial('flat'), transformed(boxUV(w, 0.3, d, 5, 5), lot.x, h + 0.15, lot.z, rot));
  addParapet(batcher, w, d, lot.x, h, lot.z, rot, 1.0);
  addRoofDetails(batcher, rng, w, d, lot.x, h + 0.3, lot.z, rot, 1.3);
  // Entrance colonnade.
  const c = Math.cos(rot), s = Math.sin(rot);
  const fz = d * 0.5 + 1.6;
  for (let i = -2; i <= 2; i++) {
    const ox = i * 3.2;
    batcher.add(concreteMaterial(0xcac6bd), transformed(cylinderUV(0.42, 0.48, 5.2, 10, 3, 3),
      lot.x + ox * c - fz * s, 2.6, lot.z + ox * s + fz * c, 0));
  }
  batcher.add(concreteMaterial(0xcac6bd), transformed(boxUV(16.5, 0.7, 3.6, 4, 4), lot.x - (fz) * s, 5.5, lot.z + (fz) * c, rot));
  addSign(batcher, label, accent, Math.min(w * 0.42, 9), 1.3, lot.x - (d * 0.5 + 0.2) * s, h * 0.55, lot.z + (d * 0.5 + 0.2) * c, rot);
  addEntrance(batcher, out, lot, rng, w, d, lot.x, 0, lot.z, rot, { width: 4.2, height: 3.4, canopyColor: accent, label: lot.name || label });
  out.lights.push({ x: lot.x - (d * 0.5 + 2) * s, y: 5.6, z: lot.z + (d * 0.5 + 2) * c, color: accent, intensity: 1.6, distance: 18 });
  out.colliders.push({ x: lot.x, z: lot.z, w, d, rot, h });
}

function buildSchool(lot, batcher, rng, out) {
  buildCivic(lot, batcher, rng, out, 0x3f7d52, 'SCHOOL');
  // Sports field beside it.
  const c = Math.cos(lot.rot || 0), s = Math.sin(lot.rot || 0);
  const fx = lot.x + (lot.w * 0.5 + 34) * c;
  const fz = lot.z + (lot.w * 0.5 + 34) * s;
  batcher.add(paintedMaterial(0x4a7a3c, 0.95), transformed(boxUV(58, 0.06, 38, 8, 8), fx, 0.03, fz, lot.rot || 0));
  for (const sx of [-1, 1]) {
    batcher.add(metalMaterial(0xcccccc, 0.4), transformed(boxUV(0.16, 2.4, 7.2, 2, 2), fx + sx * 26 * c, 1.2, fz + sx * 26 * s, lot.rot || 0));
  }
}

function buildFireStation(lot, batcher, rng, out) {
  const rot = lot.rot || 0;
  const mat = facadeMaterial(3, lot.seed);
  const w = lot.w, d = lot.d, h = lot.height;
  addMass(batcher, mat, w, h, d, lot.x, 0, lot.z, rot);
  batcher.add(roofMaterial('flat'), transformed(boxUV(w, 0.3, d, 5, 5), lot.x, h + 0.15, lot.z, rot));
  addParapet(batcher, w, d, lot.x, h, lot.z, rot, 0.9);
  const c = Math.cos(rot), s = Math.sin(rot);
  // Two engine bay doors.
  for (const sx of [-1, 1]) {
    const ox = sx * w * 0.22;
    const bx = lot.x + ox * c - (d * 0.5 + 0.08) * s;
    const bz = lot.z + ox * s + (d * 0.5 + 0.08) * c;
    batcher.add(paintedMaterial(0xc0392b, 0.6), transformed(boxUV(w * 0.34, 4.2, 0.2, 3, 3), bx, 2.1, bz, rot));
    batcher.add(metalMaterial(0x8a8f94, 0.5), transformed(boxUV(w * 0.36, 0.22, 0.3, 2, 2), bx, 4.35, bz, rot));
  }
  addSign(batcher, 'FIRE', 0xd9412c, Math.min(w * 0.3, 5), 1.1, lot.x - (d * 0.5 + 0.2) * s, h * 0.72, lot.z + (d * 0.5 + 0.2) * c, rot);
  addEntrance(batcher, out, lot, rng, w, d, lot.x + w * 0.42 * c, 0, lot.z + w * 0.42 * s, rot, { width: 1.4, height: 2.5, canopyColor: 0xc0392b, label: lot.name });
  out.colliders.push({ x: lot.x, z: lot.z, w, d, rot, h });
  out.lights.push({ x: lot.x - (d * 0.5 + 2) * s, y: 5, z: lot.z + (d * 0.5 + 2) * c, color: 0xff6644, intensity: 1.4, distance: 16 });
}

function buildChurch(lot, batcher, rng, out) {
  const rot = lot.rot || 0;
  const mat = facadeMaterial(4, lot.seed);
  const w = lot.w, d = lot.d, h = 11;
  addMass(batcher, mat, w, h, d, lot.x, 0, lot.z, rot);
  batcher.add(roofMaterial('tile'), transformed(prism(w + 1.2, 5.5, d + 1.2, 4, 4), lot.x, h, lot.z, rot));
  // Steeple
  const c = Math.cos(rot), s = Math.sin(rot);
  const sx2 = lot.x - (d * 0.5 - 4) * s, sz2 = lot.z + (d * 0.5 - 4) * c;
  addMass(batcher, mat, 7, 22, 7, sx2, 0, sz2, rot);
  batcher.add(roofMaterial('tile'), transformed(prism(8, 9, 8, 4, 4), sx2, 22, sz2, rot));
  batcher.add(metalMaterial(0xd6c98a, 0.35), transformed(boxUV(0.25, 2.2, 0.25, 1, 1), sx2, 32, sz2, 0));
  batcher.add(metalMaterial(0xd6c98a, 0.35), transformed(boxUV(1.2, 0.25, 0.25, 1, 1), sx2, 31.6, sz2, 0));
  addEntrance(batcher, out, lot, rng, w, d, lot.x, 0, lot.z, rot, { width: 2.6, height: 3.4, label: lot.name || 'Church' });
  out.colliders.push({ x: lot.x, z: lot.z, w, d, rot, h });
  out.colliders.push({ x: sx2, z: sz2, w: 7, d: 7, rot, h: 31 });
}

function buildMall(lot, batcher, rng, out) {
  const rot = lot.rot || 0;
  const mat = facadeMaterial(1, lot.seed);
  const w = lot.w, d = lot.d, h = lot.height;
  addMass(batcher, mat, w, h, d, lot.x, 0, lot.z, rot);
  batcher.add(roofMaterial('flat'), transformed(boxUV(w, 0.35, d, 6, 6), lot.x, h + 0.18, lot.z, rot));
  addRoofDetails(batcher, rng, w, d, lot.x, h + 0.35, lot.z, rot, 2.0);
  // Glazed atrium entrance.
  const c = Math.cos(rot), s = Math.sin(rot);
  batcher.add(glassMaterial(0x5b7b8c, 0.5),
    transformed(boxUV(w * 0.3, h * 0.8, 1.2, 5, 5), lot.x - (d * 0.5) * s, h * 0.4, lot.z + (d * 0.5) * c, rot));
  addSign(batcher, 'MALL', 0x2f7fb8, Math.min(w * 0.3, 12), 2.0, lot.x - (d * 0.5 + 0.8) * s, h * 0.9, lot.z + (d * 0.5 + 0.8) * c, rot);
  addEntrance(batcher, out, lot, rng, w, d, lot.x, 0, lot.z, rot, { width: 6, height: 4, label: lot.name || 'Mall' });
  // Car park stripes.
  const px = lot.x + (d * 0.5 + 26) * s, pz = lot.z - (d * 0.5 + 26) * c;
  batcher.add(concreteMaterial(0x8e8b85), transformed(boxUV(w, 0.05, 40, 8, 8), px, 0.025, pz, rot));
  for (let i = -6; i <= 6; i++) {
    batcher.add(paintedMaterial(0xdedad0, 0.9),
      transformed(boxUV(0.14, 0.02, 5, 1, 1), px + i * 3 * c, 0.055, pz + i * 3 * s, rot));
  }
  out.colliders.push({ x: lot.x, z: lot.z, w, d, rot, h });
}

function buildStadium(lot, batcher, rng, out) {
  const rot = lot.rot || 0;
  const w = lot.w, d = lot.d;
  const concrete = concreteMaterial(0xb0ada5);
  // Bowl: a ring of angled stands around a pitch.
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const ow = w * (0.66 + t * 0.34), od = d * (0.66 + t * 0.34);
    const iw = w * (0.60 + t * 0.34), id = d * (0.60 + t * 0.34);
    const y = 3 + t * 22;
    const c = Math.cos(rot), s = Math.sin(rot);
    for (const [ox, oz, sw, sd] of [
      [0, od / 2, ow, (od - id) / 2], [0, -od / 2, ow, (od - id) / 2],
      [ow / 2, 0, (ow - iw) / 2, id], [-ow / 2, 0, (ow - iw) / 2, id],
    ]) {
      batcher.add(concrete, transformed(boxUV(sw, 4.5, sd, 6, 6), lot.x + ox * c - oz * s, y, lot.z + ox * s + oz * c, rot));
    }
  }
  batcher.add(paintedMaterial(0x3f7a38, 0.95), transformed(boxUV(w * 0.55, 0.08, d * 0.55, 10, 10), lot.x, 0.04, lot.z, rot));
  // Floodlights
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = lot.x + sx * w * 0.48, pz = lot.z + sz * d * 0.48;
    batcher.add(metalMaterial(0x9aa0a4, 0.5), transformed(cylinderUV(0.3, 0.42, 34, 8, 2, 2), px, 17, pz, 0));
    batcher.add(emissiveMaterial(0xfff4d8, 1.4), transformed(boxUV(5, 2.4, 0.6, 2, 2), px, 34, pz, 0));
    out.lights.push({ x: px, y: 33, z: pz, color: 0xfff4d8, intensity: 3.0, distance: 90 });
  }
  addEntrance(batcher, out, lot, rng, w, d, lot.x, 0, lot.z, rot, { width: 7, height: 4.4, label: lot.name || 'Stadium' });
  out.colliders.push({ x: lot.x, z: lot.z, w: w * 0.98, d: d * 0.98, rot, h: 28, hollow: true });
}

function buildGasStation(lot, batcher, rng, out) {
  const rot = lot.rot || 0;
  const c = Math.cos(rot), s = Math.sin(rot);
  // Kiosk
  const kw = 12, kd = 9, kh = 4.2;
  const kx = lot.x - (lot.w * 0.5 - kw * 0.5) * c;
  const kz = lot.z - (lot.w * 0.5 - kw * 0.5) * s;
  addMass(batcher, facadeMaterial(9, lot.seed), kw, kh, kd, kx, 0, kz, rot);
  batcher.add(roofMaterial('flat'), transformed(boxUV(kw + 0.4, 0.28, kd + 0.4, 4, 4), kx, kh + 0.14, kz, rot));
  addSign(batcher, 'FUEL', 0xe04a2a, 4.5, 1.1, kx - (kd * 0.5 + 0.2) * s, 3.2, kz + (kd * 0.5 + 0.2) * c, rot);
  addEntrance(batcher, out, lot, rng, kw, kd, kx, 0, kz, rot, { width: 1.6, height: 2.4, canopy: false, label: lot.name || 'Gas Station' });

  // Forecourt canopy on columns.
  const cw = 20, cd = 13, ch = 5.4;
  const cx = lot.x + (lot.w * 0.28) * c;
  const cz = lot.z + (lot.w * 0.28) * s;
  batcher.add(paintedMaterial(0xe8e5dd, 0.6), transformed(boxUV(cw, 0.7, cd, 5, 5), cx, ch, cz, rot));
  batcher.add(emissiveMaterial(0xfff2d0, 0.9), transformed(boxUV(cw - 1.2, 0.18, cd - 1.2, 5, 5), cx, ch - 0.42, cz, rot));
  out.lights.push({ x: cx, y: ch - 0.6, z: cz, color: 0xfff2d0, intensity: 2.4, distance: 26 });
  for (const [ox, oz] of [[-cw * 0.4, -cd * 0.34], [cw * 0.4, -cd * 0.34], [-cw * 0.4, cd * 0.34], [cw * 0.4, cd * 0.34]]) {
    batcher.add(metalMaterial(0xb9bdc0, 0.4), transformed(cylinderUV(0.22, 0.26, ch, 8, 2, 2),
      cx + ox * c - oz * s, ch / 2, cz + ox * s + oz * c, 0));
  }
  // Pumps
  for (const ox of [-4.5, 4.5]) {
    const px = cx + ox * c, pz = cz + ox * s;
    batcher.add(paintedMaterial(0xd8d5cd, 0.5), transformed(boxUV(1.1, 1.8, 0.7, 2, 2), px, 0.9, pz, rot));
    batcher.add(paintedMaterial(0x2f3338, 0.6), transformed(boxUV(1.2, 0.5, 0.8, 2, 2), px, 1.95, pz, rot));
    batcher.add(concreteMaterial(0x9c9a93), transformed(boxUV(3.2, 0.18, 1.6, 3, 3), px, 0.09, pz, rot));
    out.interiors.push({ kind: 'pump', x: px, y: 0, z: pz });
  }
  batcher.add(concreteMaterial(0x8e8b85), transformed(boxUV(lot.w, 0.05, lot.d, 8, 8), lot.x, 0.025, lot.z, rot));
  out.colliders.push({ x: kx, z: kz, w: kw, d: kd, rot, h: kh });
}

/** Simple interior shell so entering a building isn't a black void. */
export function buildInteriorShell(lot, batcher) {
  const rot = lot.rot || 0;
  const w = Math.min(lot.w - 1.6, 22), d = Math.min(lot.d - 1.6, 18), h = 3.1;
  const floor = paintedMaterial(0x8a8680, 0.85);
  const wall = paintedMaterial(0xd8d4ca, 0.9);
  batcher.add(floor, transformed(boxUV(w, 0.12, d, 3, 3), lot.x, 0.06, lot.z, rot));
  batcher.add(wall, transformed(boxUV(w, 0.1, d, 3, 3), lot.x, h, lot.z, rot));
  const c = Math.cos(rot), s = Math.sin(rot);
  for (const [ox, oz, sw, sd] of [[0, -d / 2, w, 0.18], [-w / 2, 0, 0.18, d], [w / 2, 0, 0.18, d]]) {
    batcher.add(wall, transformed(boxUV(sw, h, sd, 3, 3), lot.x + ox * c - oz * s, h / 2, lot.z + ox * s + oz * c, rot));
  }
  return { x: lot.x, z: lot.z, w, d, h };
}
