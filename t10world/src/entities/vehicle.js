// T10 World - vehicles. Procedural bodies, arcade-realistic driving physics,
// working lights, opening doors and a simple damage model.
import * as THREE from '../../vendor/three.module.js';
import { clamp01, clampv, lerpv, damp, wrapAngle, makeRng, TAU, smooth01 } from '../core/math.js';
import { GeometryBatcher, boxUV, cylinderUV, transformed, mergeGeometries, disposeGroup } from '../world/geomutils.js';
import { paintedMaterial, metalMaterial, glassMaterial, emissiveMaterial } from '../world/materials.js';
import { settings } from '../core/settings.js';
import { audio } from '../core/audio.js';

export const VEHICLE_TYPES = {
  sedan:      { name: 'Sedan',        l: 4.6, w: 1.82, h: 1.45, mass: 1400, power: 4200, topSpeed: 47, seats: 4, cabinF: 0.06, cabinL: 0.50, roofH: 0.54 },
  hatchback:  { name: 'Hatchback',    l: 4.0, w: 1.76, h: 1.48, mass: 1200, power: 3600, topSpeed: 42, seats: 4, cabinF: 0.02, cabinL: 0.52, roofH: 0.56 },
  suv:        { name: 'SUV',          l: 4.9, w: 1.96, h: 1.78, mass: 2000, power: 5000, topSpeed: 44, seats: 5, cabinF: 0.04, cabinL: 0.58, roofH: 0.66 },
  sports:     { name: 'Sports Car',   l: 4.4, w: 1.90, h: 1.20, mass: 1250, power: 7600, topSpeed: 72, seats: 2, cabinF: 0.02, cabinL: 0.42, roofH: 0.38 },
  pickup:     { name: 'Pickup Truck', l: 5.5, w: 2.00, h: 1.86, mass: 2300, power: 5200, topSpeed: 42, seats: 3, cabinF: 0.22, cabinL: 0.36, roofH: 0.62, bed: true },
  van:        { name: 'Van',          l: 5.3, w: 1.98, h: 2.10, mass: 2200, power: 4200, topSpeed: 38, seats: 3, cabinF: 0.18, cabinL: 0.70, roofH: 0.92 },
  box_truck:  { name: 'Box Truck',    l: 7.4, w: 2.35, h: 3.10, mass: 6500, power: 9000, topSpeed: 32, seats: 3, cabinF: 0.32, cabinL: 0.22, roofH: 0.80, boxBody: true },
  bus:        { name: 'City Bus',     l: 11.2, w: 2.50, h: 3.20, mass: 12000, power: 14000, topSpeed: 28, seats: 30, cabinF: 0, cabinL: 0.92, roofH: 1.30, busBody: true },
  taxi:       { name: 'Taxi',         l: 4.7, w: 1.84, h: 1.50, mass: 1450, power: 4200, topSpeed: 45, seats: 4, cabinF: 0.06, cabinL: 0.52, roofH: 0.56, taxi: true },
  police:     { name: 'Police Cruiser', l: 4.9, w: 1.90, h: 1.48, mass: 1700, power: 6400, topSpeed: 58, seats: 4, cabinF: 0.06, cabinL: 0.50, roofH: 0.54, emergency: 'police' },
  ambulance:  { name: 'Ambulance',    l: 6.2, w: 2.25, h: 2.70, mass: 4200, power: 7000, topSpeed: 38, seats: 4, cabinF: 0.30, cabinL: 0.30, roofH: 0.86, boxBody: true, emergency: 'ambulance' },
  firetruck:  { name: 'Fire Engine',  l: 9.0, w: 2.50, h: 3.20, mass: 14000, power: 16000, topSpeed: 30, seats: 6, cabinF: 0.30, cabinL: 0.24, roofH: 0.90, boxBody: true, emergency: 'fire' },
  motorcycle: { name: 'Motorcycle',   l: 2.1, w: 0.80, h: 1.15, mass: 220, power: 2400, topSpeed: 62, seats: 2, bike: true },
  sportbike:  { name: 'Sport Bike',   l: 2.05, w: 0.74, h: 1.10, mass: 190, power: 3000, topSpeed: 78, seats: 2, bike: true },
  limo:       { name: 'Limousine',    l: 7.2, w: 1.95, h: 1.52, mass: 2600, power: 5200, topSpeed: 40, seats: 8, cabinF: -0.02, cabinL: 0.68, roofH: 0.56 },
  convertible:{ name: 'Convertible',  l: 4.5, w: 1.86, h: 1.28, mass: 1350, power: 5600, topSpeed: 60, seats: 2, cabinF: 0.02, cabinL: 0.34, roofH: 0.20 },
  jeep:       { name: 'Off-Roader',   l: 4.4, w: 1.94, h: 1.92, mass: 2100, power: 5400, topSpeed: 40, seats: 5, cabinF: 0.02, cabinL: 0.56, roofH: 0.74 },
  tractor:    { name: 'Tractor',      l: 4.2, w: 2.10, h: 2.60, mass: 5000, power: 8000, topSpeed: 14, seats: 1, cabinF: -0.12, cabinL: 0.30, roofH: 0.86 },
  garbage:    { name: 'Garbage Truck',l: 8.2, w: 2.45, h: 3.30, mass: 13000, power: 13000, topSpeed: 26, seats: 3, cabinF: 0.32, cabinL: 0.22, roofH: 0.80, boxBody: true },
  icecream:   { name: 'Ice Cream Van',l: 5.4, w: 2.00, h: 2.40, mass: 2400, power: 4200, topSpeed: 30, seats: 2, cabinF: 0.24, cabinL: 0.30, roofH: 0.86, boxBody: true },
  schoolbus:  { name: 'School Bus',   l: 10.6, w: 2.45, h: 3.05, mass: 11000, power: 12000, topSpeed: 26, seats: 40, cabinF: 0, cabinL: 0.92, roofH: 1.24, busBody: true },
};

export const CIVILIAN_TYPES = ['sedan', 'hatchback', 'suv', 'sports', 'pickup', 'van', 'taxi', 'box_truck', 'motorcycle', 'sportbike', 'jeep', 'convertible', 'garbage', 'schoolbus'];
export const EMERGENCY_TYPES = ['police', 'ambulance', 'firetruck'];

const BODY_COLORS = [
  0x8a2b2b, 0x2b4a7a, 0x22252a, 0xd9d6ce, 0x37613f, 0x8a7a2b, 0x5f666d, 0xb5541f,
  0x6c3d7a, 0x1f6a6a, 0xa8a49b, 0x2f2f33, 0xc2c6cb, 0x6d4326, 0x244a33, 0x9c2f4a,
];

/** Build the visual body. Returns a Group plus references the sim needs. */
function buildBody(type, spec, color, rng) {
  const group = new THREE.Group();
  const batch = new GeometryBatcher();
  const body = paintedMaterial(color, 0.30);
  const trim = paintedMaterial(0x24262a, 0.55);
  const glass = glassMaterial(0x25333f, 0.62);
  const chrome = metalMaterial(0xbec4c9, 0.22);
  const L = spec.l, W = spec.w, H = spec.h;
  const refs = { wheels: [], doors: [], lights: {}, sirens: [] };

  if (spec.bike) {
    batch.add(body, transformed(boxUV(W * 0.5, 0.34, L * 0.55, 1, 1), 0, 0.68, 0, 0));
    batch.add(trim, transformed(boxUV(W * 0.46, 0.14, L * 0.32, 1, 1), 0, 0.90, -L * 0.10, 0));
    batch.add(chrome, transformed(cylinderUV(0.03, 0.03, W * 0.72, 6, 1, 1), 0, 1.02, L * 0.34, Math.PI / 2, { x: 1, y: 1, z: 1 }));
    batch.add(body, transformed(boxUV(W * 0.44, 0.34, 0.30, 1, 1), 0, 1.02, L * 0.40, 0));
    batch.add(trim, transformed(boxUV(W * 0.30, 0.44, 0.44, 1, 1), 0, 0.46, -L * 0.18, 0));
  } else if (spec.busBody) {
    batch.add(body, transformed(boxUV(W, H * 0.82, L, 2, 2), 0, H * 0.52, 0, 0));
    batch.add(glass, transformed(boxUV(W * 1.002, H * 0.30, L * 0.86, 2, 2), 0, H * 0.72, -L * 0.02, 0));
    batch.add(trim, transformed(boxUV(W * 1.01, 0.18, L * 1.005, 2, 2), 0, H * 0.30, 0, 0));
    batch.add(glass, transformed(boxUV(W * 0.92, H * 0.34, 0.12, 2, 2), 0, H * 0.70, L * 0.5, 0));
  } else if (spec.boxBody) {
    const cabL = L * 0.30;
    batch.add(body, transformed(boxUV(W * 0.96, H * 0.58, cabL, 2, 2), 0, H * 0.42, L * 0.5 - cabL * 0.5, 0));
    batch.add(glass, transformed(boxUV(W * 0.90, H * 0.26, cabL * 0.7, 2, 2), 0, H * 0.62, L * 0.5 - cabL * 0.55, 0));
    batch.add(paintedMaterial(spec.emergency ? color : 0xdedad2, 0.5),
      transformed(boxUV(W, H * 0.80, L - cabL, 2, 2), 0, H * 0.50, -cabL * 0.5, 0));
    batch.add(trim, transformed(boxUV(W * 1.01, 0.22, L * 0.99, 2, 2), 0, H * 0.14, 0, 0));
  } else {
    const cabinL = L * spec.cabinL;
    const cabinZ = L * spec.cabinF;
    const beltline = H * 0.52;
    // Lower body
    batch.add(body, transformed(boxUV(W, beltline, L, 2, 2), 0, beltline * 0.5 + 0.22, 0, 0));
    // Bonnet / boot shoulders
    batch.add(body, transformed(boxUV(W * 0.98, 0.12, L * 0.96, 2, 2), 0, beltline + 0.24, 0, 0));
    // Cabin
    const roofH = H * spec.roofH;
    batch.add(body, transformed(boxUV(W * 0.90, roofH, cabinL, 2, 2), 0, beltline + roofH * 0.5 + 0.2, cabinZ, 0));
    batch.add(glass, transformed(boxUV(W * 0.915, roofH * 0.80, cabinL * 0.98, 2, 2), 0, beltline + roofH * 0.48 + 0.2, cabinZ, 0));
    // Windscreen rake
    const ws = boxUV(W * 0.88, roofH * 0.9, 0.1, 2, 2);
    ws.rotateX(-0.42);
    batch.add(glass, transformed(ws, 0, beltline + roofH * 0.48 + 0.2, cabinZ + cabinL * 0.5, 0));
    const rw = boxUV(W * 0.86, roofH * 0.85, 0.1, 2, 2);
    rw.rotateX(0.36);
    batch.add(glass, transformed(rw, 0, beltline + roofH * 0.48 + 0.2, cabinZ - cabinL * 0.5, 0));
    if (spec.bed) {
      batch.add(trim, transformed(boxUV(W * 0.94, 0.42, L * 0.36, 2, 2), 0, beltline + 0.42, -L * 0.30, 0));
    }
    // Bumpers
    batch.add(trim, transformed(boxUV(W * 1.01, 0.26, 0.34, 2, 2), 0, 0.42, L * 0.5, 0));
    batch.add(trim, transformed(boxUV(W * 1.01, 0.26, 0.34, 2, 2), 0, 0.42, -L * 0.5, 0));
    // Mirrors
    for (const sx of [-1, 1]) {
      batch.add(trim, transformed(boxUV(0.22, 0.12, 0.10, 1, 1), sx * W * 0.55, beltline + 0.34, cabinZ + cabinL * 0.34, 0));
    }
  }

  // ---- Lights ----
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf0f2f0, emissive: 0xfff2d8, emissiveIntensity: 0, roughness: 0.2, metalness: 0.1 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x5a1b16, emissive: 0xff2010, emissiveIntensity: 0, roughness: 0.3 });
  const signalMat = new THREE.MeshStandardMaterial({ color: 0x6a4a12, emissive: 0xffa010, emissiveIntensity: 0, roughness: 0.3 });
  const reverseMat = new THREE.MeshStandardMaterial({ color: 0xdadada, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.3 });
  refs.lights.headMat = headMat;
  refs.lights.tailMat = tailMat;
  refs.lights.signalL = signalMat.clone();
  refs.lights.signalR = signalMat.clone();
  refs.lights.reverseMat = reverseMat;

  if (!spec.bike) {
    const fz = L * 0.5 + 0.02, bz = -L * 0.5 - 0.02;
    const hy = spec.boxBody || spec.busBody ? H * 0.28 : 0.68;
    for (const sx of [-1, 1]) {
      const hm = new THREE.Mesh(new THREE.BoxGeometry(W * 0.22, 0.16, 0.1), headMat);
      hm.position.set(sx * W * 0.32, hy, fz); group.add(hm);
      const tm = new THREE.Mesh(new THREE.BoxGeometry(W * 0.20, 0.14, 0.08), tailMat);
      tm.position.set(sx * W * 0.33, hy + 0.06, bz); group.add(tm);
      const sm = new THREE.Mesh(new THREE.BoxGeometry(W * 0.10, 0.12, 0.08), sx < 0 ? refs.lights.signalL : refs.lights.signalR);
      sm.position.set(sx * W * 0.45, hy, fz); group.add(sm);
      const sm2 = new THREE.Mesh(new THREE.BoxGeometry(W * 0.10, 0.12, 0.08), sx < 0 ? refs.lights.signalL : refs.lights.signalR);
      sm2.position.set(sx * W * 0.46, hy + 0.06, bz); group.add(sm2);
      const rv = new THREE.Mesh(new THREE.BoxGeometry(W * 0.10, 0.10, 0.07), reverseMat);
      rv.position.set(sx * W * 0.18, hy + 0.06, bz); group.add(rv);
    }
  } else {
    const hm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.1), headMat);
    hm.position.set(0, 1.0, L * 0.45); group.add(hm);
    const tm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.07), tailMat);
    tm.position.set(0, 0.78, -L * 0.42); group.add(tm);
  }

  // Emergency light bar.
  if (spec.emergency) {
    const barY = (spec.boxBody ? H * 0.82 : H * 0.98) + 0.06;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.76, 0.12, 0.34), metalMaterial(0x2a2d31, 0.5));
    bar.position.set(0, barY, spec.boxBody ? L * 0.34 : 0.1);
    group.add(bar);
    for (const [sx, col] of [[-1, 0xff2020], [1, 0x2060ff]]) {
      const m = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: col, emissiveIntensity: 0, roughness: 0.3 });
      const lm = new THREE.Mesh(new THREE.BoxGeometry(W * 0.30, 0.14, 0.30), m);
      lm.position.set(sx * W * 0.2, barY + 0.02, spec.boxBody ? L * 0.34 : 0.1);
      group.add(lm);
      refs.sirens.push({ mesh: lm, mat: m, color: col });
    }
  }
  if (spec.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.28), emissiveMaterial(0xffd23f, 1.2));
    sign.position.set(0, H * 0.98 + 0.1, L * 0.06);
    group.add(sign);
  }

  // ---- Interior: dashboard, wheel, seats ----
  if (!spec.bike) {
    const cabinZ = L * (spec.cabinF || 0);
    const floorY = spec.boxBody || spec.busBody ? H * 0.22 : 0.48;
    const seatMat = paintedMaterial(0x2a2d33, 0.85);
    const dashMat = paintedMaterial(0x1d2024, 0.7);
    // Dash and centre console
    batch.add(dashMat, transformed(boxUV(W * 0.86, 0.26, 0.34, 2, 2), 0, floorY + 0.40, cabinZ + L * 0.20, 0));
    batch.add(dashMat, transformed(boxUV(W * 0.26, 0.16, L * 0.22, 2, 2), 0, floorY + 0.16, cabinZ + L * 0.02, 0));
    // Instrument glow, visible at night from the driver's seat
    batch.add(emissiveMaterial(0x35c17a, 0.55), transformed(boxUV(W * 0.28, 0.10, 0.04, 1, 1), -W * 0.22, floorY + 0.44, cabinZ + L * 0.185, 0));
    // Seats
    const seatCount = Math.min(spec.seats, 4);
    for (let i = 0; i < Math.min(2, seatCount); i++) {
      const sx = i === 0 ? -1 : 1;
      batch.add(seatMat, transformed(boxUV(W * 0.34, 0.12, L * 0.16, 2, 2), sx * W * 0.24, floorY, cabinZ + L * 0.04, 0));
      const back = boxUV(W * 0.34, L * 0.20, 0.12, 2, 2);
      back.rotateX(-0.16);
      batch.add(seatMat, transformed(back, sx * W * 0.24, floorY + L * 0.10, cabinZ - L * 0.05, 0));
      batch.add(seatMat, transformed(boxUV(W * 0.20, 0.14, 0.12, 1, 1), sx * W * 0.24, floorY + L * 0.21, cabinZ - L * 0.06, 0));
    }
    if (spec.seats > 2 && !spec.boxBody) {
      batch.add(seatMat, transformed(boxUV(W * 0.80, 0.12, L * 0.16, 2, 2), 0, floorY, cabinZ - L * 0.20, 0));
      const back2 = boxUV(W * 0.80, L * 0.18, 0.12, 2, 2);
      back2.rotateX(-0.16);
      batch.add(seatMat, transformed(back2, 0, floorY + L * 0.09, cabinZ - L * 0.28, 0));
    }
    // Steering wheel on its own pivot so it turns with the input.
    const wheelPivot = new THREE.Group();
    wheelPivot.position.set(-W * 0.24, floorY + 0.46, cabinZ + L * 0.14);
    wheelPivot.rotation.x = -0.42;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.021, 6, 18), paintedMaterial(0x16181b, 0.6));
    wheelPivot.add(rim);
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.022, 0.022), paintedMaterial(0x24272b, 0.6));
      spoke.rotation.z = (i / 3) * TAU;
      wheelPivot.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 10), paintedMaterial(0x2c3036, 0.5));
    hub.rotation.x = Math.PI / 2;
    wheelPivot.add(hub);
    group.add(wheelPivot);
    refs.steeringWheel = wheelPivot;
    // Pedals
    batch.add(paintedMaterial(0x3a3f45, 0.7), transformed(boxUV(0.07, 0.02, 0.11, 1, 1), -W * 0.30, floorY - 0.10, cabinZ + L * 0.20, 0));
    batch.add(paintedMaterial(0x3a3f45, 0.7), transformed(boxUV(0.07, 0.02, 0.11, 1, 1), -W * 0.16, floorY - 0.10, cabinZ + L * 0.20, 0));
  }

  // ---- Wheels ----
  const wheelR = spec.bike ? 0.32 : (spec.boxBody || spec.busBody ? 0.52 : 0.34);
  const wheelW = spec.bike ? 0.12 : (spec.boxBody || spec.busBody ? 0.30 : 0.24);
  const tyreMat = paintedMaterial(0x141517, 0.92);
  const rimMat = metalMaterial(0xbfc4c8, 0.28);
  const wheelGeo = cylinderUV(wheelR, wheelR, wheelW, 14, 1, 1);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = cylinderUV(wheelR * 0.62, wheelR * 0.62, wheelW * 1.04, 10, 1, 1);
  rimGeo.rotateZ(Math.PI / 2);

  const axleF = L * (spec.bike ? 0.40 : 0.34);
  const axleR = -L * (spec.bike ? 0.40 : 0.32);
  const track = spec.bike ? 0 : W * 0.5 - wheelW * 0.45;
  const positions = spec.bike
    ? [[0, axleF, true], [0, axleR, false]]
    : [[-track, axleF, true], [track, axleF, true], [-track, axleR, false], [track, axleR, false]];
  for (const [wx, wz, steer] of positions) {
    const holder = new THREE.Group();
    holder.position.set(wx, wheelR, wz);
    const tyre = new THREE.Mesh(wheelGeo, tyreMat);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    holder.add(tyre); holder.add(rim);
    group.add(holder);
    refs.wheels.push({ holder, tyre, rim, steer, x: wx, z: wz, radius: wheelR, contact: 0 });
  }
  // Extra axle on the biggest vehicles.
  if (spec.busBody || (spec.boxBody && L > 8)) {
    for (const sx of [-1, 1]) {
      const holder = new THREE.Group();
      holder.position.set(sx * track, wheelR, axleR + 1.25);
      holder.add(new THREE.Mesh(wheelGeo, tyreMat));
      holder.add(new THREE.Mesh(rimGeo, rimMat));
      group.add(holder);
      refs.wheels.push({ holder, steer: false, x: sx * track, z: axleR + 1.25, radius: wheelR, contact: 0 });
    }
  }

  // ---- Doors (front pair opens) ----
  if (!spec.bike) {
    const cabinZ = L * (spec.cabinF || 0);
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * W * 0.5, 0.75, cabinZ + L * 0.16);
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, spec.boxBody || spec.busBody ? H * 0.5 : 0.95, L * 0.30),
        paintedMaterial(color, 0.30)
      );
      panel.position.set(0, 0, -L * 0.15);
      pivot.add(panel);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, L * 0.24), glass);
      win.position.set(0, 0.36, -L * 0.15);
      pivot.add(win);
      pivot.visible = false;   // only shown while open
      group.add(pivot);
      refs.doors.push({ pivot, side: sx, open: 0, target: 0 });
    }
  }

  const meshes = batch.build(group, { castShadow: true, receiveShadow: true });
  group.traverse((o) => { if (o.isMesh) { o.castShadow = settings.preset.shadows; o.receiveShadow = true; } });
  refs.bodyMeshes = meshes;
  return { group, refs };
}

export class Vehicle {
  constructor(world, typeId, opts) {
    opts = opts || {};
    this.world = world;
    this.typeId = VEHICLE_TYPES[typeId] ? typeId : 'sedan';
    this.spec = VEHICLE_TYPES[this.typeId];
    this.rng = makeRng(opts.seed != null ? opts.seed : (Math.random() * 0xffffffff) >>> 0);
    this.color = opts.color != null ? opts.color
      : (this.spec.emergency === 'police' ? 0x1b2a4a
        : this.spec.emergency === 'fire' ? 0xb8241c
        : this.spec.emergency === 'ambulance' ? 0xe8e6e0
        : this.spec.taxi ? 0xf0b400
        : this.rng.pick(BODY_COLORS));

    const built = buildBody(this.typeId, this.spec, this.color, this.rng);
    this.group = built.group;
    this.refs = built.refs;
    this.group.userData.vehicle = this;

    this.position = new THREE.Vector3(opts.x || 0, 0, opts.z || 0);
    this.velocity = new THREE.Vector3();
    this.heading = opts.heading || 0;
    this.yawRate = 0;
    this.speed = 0;
    this.steer = 0;
    this.steerTarget = 0;
    this.throttle = 0;
    this.brake = 0;
    this.handbrake = 0;
    this.gear = 1;
    this.rpm = 800;
    this.wheelSpin = 0;
    this.pitch = 0;
    this.roll = 0;
    this.grounded = true;
    this.verticalVel = 0;

    this.headlightsOn = false;
    this.autoHeadlights = true;
    this.signalLeft = false;
    this.signalRight = false;
    this.signalPhase = 0;
    this.sirenOn = false;
    this.sirenPhase = 0;
    this.hornTimer = 0;

    this.damage = 0;
    this.health = 100;
    this.fuel = 100;
    this.locked = false;
    this.driver = null;
    this.passengers = [];
    this.isPlayerVehicle = false;
    this.engineOn = false;
    this.engineNodes = null;
    this.headlightSpots = [];

    this.position.y = world ? world.groundAt(this.position.x, this.position.z) : 0;
    this.group.position.copy(this.position);
    this.group.rotation.y = this.heading;

    this.name = this.spec.name;
    this.plate = this.makePlate();
  }

  makePlate() {
    const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    let s = '';
    for (let i = 0; i < 3; i++) s += letters[this.rng.int(0, letters.length - 1)];
    return s + ' ' + this.rng.int(100, 999);
  }

  addTo(scene) { scene.add(this.group); return this; }

  setPlayerControlled(on) {
    this.isPlayerVehicle = on;
    if (on) {
      if (!this.engineNodes && audio.ready) this.engineNodes = audio.createEngine();
      if (settings.preset.maxDynamicLights > 2 && !this.headlightSpots.length) {
        for (const sx of [-1, 1]) {
          const spot = new THREE.SpotLight(0xfff0d8, 0, 55, 0.55, 0.45, 1.4);
          spot.position.set(sx * this.spec.w * 0.32, 0.7, this.spec.l * 0.5);
          spot.target.position.set(sx * this.spec.w * 0.4, -0.4, this.spec.l * 0.5 + 18);
          this.group.add(spot);
          this.group.add(spot.target);
          this.headlightSpots.push(spot);
        }
      }
    } else if (this.engineNodes) {
      audio.disposeEngine(this.engineNodes);
      this.engineNodes = null;
    }
  }

  /** Seat position in world space. 0 = driver. */
  seatPosition(index, out) {
    out = out || new THREE.Vector3();
    const s = this.spec;
    const side = index === 0 ? -1 : index === 1 ? 1 : (index % 2 === 0 ? -1 : 1);
    const row = index < 2 ? 0 : Math.floor(index / 2);
    const lx = s.bike ? 0 : side * s.w * 0.24;
    const lz = s.bike ? -row * 0.4 : (s.l * (s.cabinF || 0)) + s.l * 0.10 - row * 0.85;
    const ly = s.bike ? 0.78 : (s.boxBody || s.busBody ? s.h * 0.34 : 0.62);
    out.set(lx, ly, lz).applyAxisAngle(UP, this.heading).add(this.position);
    return out;
  }

  doorPosition(index, out) {
    out = out || new THREE.Vector3();
    const s = this.spec;
    const side = index === 0 ? -1 : 1;
    out.set(side * (s.w * 0.5 + 0.75), 0.2, s.l * ((s.cabinF || 0) + 0.06))
      .applyAxisAngle(UP, this.heading).add(this.position);
    return out;
  }

  openDoor(index, open) {
    const d = this.refs.doors[index];
    if (!d) return;
    d.target = open ? 1 : 0;
    d.pivot.visible = true;
    audio.carDoor(open);
  }

  /** Drive inputs: throttle/brake/steer in [-1,1]. */
  setInput(throttle, brake, steer, handbrake) {
    this.throttle = clampv(throttle, -1, 1);
    this.brake = clamp01(brake);
    this.steerTarget = clampv(steer, -1, 1);
    this.handbrake = clamp01(handbrake || 0);
  }

  honk() {
    if (this.hornTimer > 0) return;
    this.hornTimer = 0.6;
    audio.horn(this.spec.busBody ? 'bus' : this.spec.boxBody ? 'truck' : 'car');
  }

  update(dt, listenerPos) {
    dt = Math.min(dt, 0.05);
    const s = this.spec;
    const world = this.world;

    // ---- Steering ----
    const speedFactor = 1 / (1 + Math.abs(this.speed) * 0.055);
    const maxSteer = (s.bike ? 0.62 : 0.52) * speedFactor;
    this.steer = damp(this.steer, this.steerTarget * maxSteer, 0.0002, dt);

    // ---- Longitudinal forces ----
    const mass = s.mass;
    const drag = 0.42 * (s.busBody || s.boxBody ? 2.0 : 1.0);
    const rollResist = 12 * (s.bike ? 0.5 : 1);
    let force = 0;
    if (this.fuel > 0 && this.engineOn) {
      // Torque falls off as speed approaches the top end.
      const powerCurve = 1 - clamp01(Math.abs(this.speed) / s.topSpeed) * 0.75;
      force += this.throttle * s.power * powerCurve;
    }
    force -= this.brake * (s.bike ? 4200 : 9000) * Math.sign(this.speed || 1);
    force -= drag * this.speed * Math.abs(this.speed);
    force -= rollResist * this.speed;
    if (this.handbrake > 0.1) force -= Math.sign(this.speed) * 5200 * this.handbrake;

    const damageFactor = 1 - clamp01(this.damage) * 0.45;
    this.speed += (force / mass) * dt * damageFactor;
    if (Math.abs(this.speed) < 0.06 && this.throttle === 0) this.speed *= 0.82;
    this.speed = clampv(this.speed, -s.topSpeed * 0.34, s.topSpeed);

    // ---- Yaw from a bicycle model ----
    const wheelbase = s.l * 0.62;
    const turnRadiusRate = Math.tan(this.steer) / wheelbase;
    let yawRate = this.speed * turnRadiusRate;
    // Handbrake and heavy power induce a little slide.
    const slide = clamp01(this.handbrake * 1.2 + clamp01(Math.abs(this.speed) / s.topSpeed - 0.55) * Math.abs(this.steer) * 1.4);
    yawRate *= 1 + slide * 0.55;
    this.yawRate = damp(this.yawRate, yawRate, 0.0001, dt);
    this.heading = wrapAngle(this.heading + this.yawRate * dt);

    // ---- Integrate ----
    const fwdX = Math.sin(this.heading), fwdZ = Math.cos(this.heading);
    this.velocity.set(fwdX * this.speed, this.verticalVel, fwdZ * this.speed);
    // Lateral slip during a slide.
    if (slide > 0.05) {
      const latX = Math.cos(this.heading), latZ = -Math.sin(this.heading);
      const slipAmt = -Math.sign(this.steer) * slide * Math.abs(this.speed) * 0.22;
      this.velocity.x += latX * slipAmt;
      this.velocity.z += latZ * slipAmt;
    }
    const prevX = this.position.x, prevZ = this.position.z;
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // ---- Suspension + ground ----
    let avgGround = 0, maxGround = -Infinity;
    for (const w of this.refs.wheels) {
      const wx = this.position.x + w.x * Math.cos(this.heading) + w.z * Math.sin(this.heading);
      const wz = this.position.z - w.x * Math.sin(this.heading) + w.z * Math.cos(this.heading);
      const g = world ? world.groundAt(wx, wz) : 0;
      w.groundY = g;
      avgGround += g;
      maxGround = Math.max(maxGround, g);
    }
    avgGround /= this.refs.wheels.length;

    this.verticalVel -= 22 * dt;
    this.position.y += this.verticalVel * dt;
    if (this.position.y <= avgGround) {
      if (this.verticalVel < -6 && this.isPlayerVehicle) audio.land(-this.verticalVel);
      this.position.y = avgGround;
      this.verticalVel = 0;
      this.grounded = true;
    } else if (this.position.y > avgGround + 0.35) {
      this.grounded = false;
    }

    // Pitch/roll from the wheel contact plane.
    const wheels = this.refs.wheels;
    if (wheels.length >= 4) {
      const front = (wheels[0].groundY + wheels[1].groundY) * 0.5;
      const rear = (wheels[2].groundY + wheels[3].groundY) * 0.5;
      const left = (wheels[0].groundY + wheels[2].groundY) * 0.5;
      const right = (wheels[1].groundY + wheels[3].groundY) * 0.5;
      const targetPitch = Math.atan2(rear - front, s.l * 0.66) + clampv(-this.throttle * 0.02 + this.brake * 0.035, -0.05, 0.05);
      const targetRoll = Math.atan2(right - left, s.w) + clampv(this.yawRate * this.speed * 0.006, -0.12, 0.12);
      this.pitch = damp(this.pitch, targetPitch, 0.0008, dt);
      this.roll = damp(this.roll, targetRoll, 0.0008, dt);
    } else {
      // Bikes lean into corners.
      this.roll = damp(this.roll, clampv(-this.yawRate * this.speed * 0.045, -0.7, 0.7), 0.0005, dt);
    }

    // ---- Collision ----
    if (world) {
      const radius = Math.max(s.w, s.l) * 0.38;
      const hit = world.resolveCollision(this.position, radius * 0.7);
      if (hit) {
        const impact = Math.abs(this.speed);
        if (impact > 3) {
          this.applyDamage(impact * 0.6);
          audio.noiseBurst({ dur: 0.3, gain: clamp01(impact / 25) * 0.5, freq: 260, q: 1.2, sweep: 0.4 });
        }
        this.speed *= -0.22;
        this.position.x = lerpv(this.position.x, prevX, 0.7);
        this.position.z = lerpv(this.position.z, prevZ, 0.7);
      }
    }

    // ---- Apply transform ----
    this.group.position.copy(this.position);
    this.group.rotation.set(this.pitch, this.heading, this.roll, 'YXZ');

    // ---- Wheels ----
    this.wheelSpin += (this.speed / (wheels[0] ? wheels[0].radius : 0.34)) * dt;
    for (const w of wheels) {
      w.holder.rotation.x = this.wheelSpin;
      if (w.steer) w.holder.rotation.y = this.steer;
      const local = w.groundY - this.position.y;
      w.holder.position.y = w.radius + clampv(local, -0.18, 0.18);
    }

    // ---- Steering wheel follows the input ----
    if (this.refs.steeringWheel) {
      this.refs.steeringWheel.rotation.z = -this.steer * 3.2;
    }

    // ---- Doors ----
    for (const d of this.refs.doors) {
      d.open = damp(d.open, d.target, 0.0004, dt);
      d.pivot.rotation.y = -d.side * d.open * 1.15;
      if (d.open < 0.01 && d.target === 0) d.pivot.visible = false;
      else d.pivot.visible = true;
    }

    // ---- Lights ----
    this.updateLights(dt);

    // ---- Engine sound ----
    if (this.hornTimer > 0) this.hornTimer -= dt;
    this.rpm = lerpv(800, 6400, clamp01(Math.abs(this.speed) / s.topSpeed) * 0.75 + Math.abs(this.throttle) * 0.35);
    if (this.engineNodes && listenerPos) {
      const d = this.position.distanceTo(listenerPos);
      const vol = clamp01(1 - d / 45) * (this.engineOn ? 1 : 0);
      audio.updateEngine(this.engineNodes, this.rpm, clamp01(Math.abs(this.throttle)), vol, 0);
    }

    // ---- Fuel ----
    if (this.engineOn) this.fuel = Math.max(0, this.fuel - Math.abs(this.throttle) * dt * 0.06);
    return this;
  }

  updateLights(dt) {
    const night = this.world ? this.world.nightFactor : 0;
    if (this.autoHeadlights) this.headlightsOn = night > 0.35;
    const on = this.headlightsOn ? 1 : 0;
    this.refs.lights.headMat.emissiveIntensity = on * 2.6;
    const braking = this.brake > 0.05 || (this.speed > 0.5 && this.throttle < -0.1);
    this.refs.lights.tailMat.emissiveIntensity = braking ? 3.4 : on * 0.9;
    this.refs.lights.reverseMat.emissiveIntensity = this.speed < -0.4 ? 2.2 : 0;
    for (const spot of this.headlightSpots) spot.intensity = on * 3.2;

    this.signalPhase += dt * 2.6;
    const blink = (this.signalPhase % 1) < 0.5 ? 2.8 : 0;
    this.refs.lights.signalL.emissiveIntensity = this.signalLeft ? blink : 0;
    this.refs.lights.signalR.emissiveIntensity = this.signalRight ? blink : 0;

    if (this.refs.sirens.length) {
      if (this.sirenOn) {
        this.sirenPhase += dt * 6;
        const p = this.sirenPhase % 2;
        this.refs.sirens[0].mat.emissiveIntensity = p < 1 ? 3.5 : 0.05;
        this.refs.sirens[1].mat.emissiveIntensity = p >= 1 ? 3.5 : 0.05;
        if (!this._sirenSoundTimer || this._sirenSoundTimer <= 0) {
          audio.siren(this.spec.emergency);
          this._sirenSoundTimer = 3.0;
        }
        this._sirenSoundTimer -= dt;
      } else {
        this.refs.sirens[0].mat.emissiveIntensity = 0;
        this.refs.sirens[1].mat.emissiveIntensity = 0;
      }
    }
  }

  applyDamage(amount) {
    this.damage = clamp01(this.damage + amount / 100);
    this.health = Math.max(0, 100 - this.damage * 100);
    // Visible damage: darken and dent the body colour.
    const c = new THREE.Color(this.color);
    c.multiplyScalar(1 - this.damage * 0.4);
    for (const m of this.refs.bodyMeshes) {
      if (m.material && m.material.color) m.material = paintedMaterial(c.getHex(), 0.3 + this.damage * 0.5);
    }
  }

  repair() {
    this.damage = 0;
    this.health = 100;
    for (const m of this.refs.bodyMeshes) {
      if (m.material && m.material.color) m.material = paintedMaterial(this.color, 0.3);
    }
    return this;
  }

  setColor(hex) {
    this.color = hex;
    this.repair();
    for (const d of this.refs.doors) {
      d.pivot.children[0].material = paintedMaterial(hex, 0.3);
    }
  }

  teleport(x, z, heading) {
    this.position.set(x, this.world ? this.world.groundAt(x, z) : 0, z);
    if (heading != null) this.heading = heading;
    this.speed = 0;
    this.velocity.set(0, 0, 0);
    this.group.position.copy(this.position);
  }

  dispose() {
    if (this.engineNodes) audio.disposeEngine(this.engineNodes);
    disposeGroup(this.group);
  }

  describe() {
    return this.spec.name + ' (' + this.plate + '), ' +
      (this.damage > 0.4 ? 'badly damaged' : this.damage > 0.1 ? 'scuffed' : 'clean') +
      ', fuel ' + Math.round(this.fuel) + '%';
  }
}

const UP = new THREE.Vector3(0, 1, 0);
