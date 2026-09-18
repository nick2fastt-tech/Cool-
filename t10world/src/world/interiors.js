// T10 World - building interiors. Every door in the city opens into a room you
// can walk around, generated from the lot it belongs to.
//
// Nothing is hand-authored. The lot's footprint is split into rooms by a binary
// partition; each split leaves a doorway, so the plan is connected by
// construction and no room is ever walled off. Rooms are then given roles from
// the building's kind — a house gets a hall, a living room, a kitchen and
// bedrooms; a shop gets a shop floor and a counter; an office gets a reception
// and desks — and each role knows how to furnish itself.
//
// One interior exists at a time. It is built when you walk in, kept while you
// are in the building, and thrown away when you leave.
import * as THREE from '../../vendor/three.module.js';
import { GeometryBatcher, boxUV, cylinderUV, transformed, disposeGroup } from './geomutils.js';
import { paintedMaterial, concreteMaterial, metalMaterial, glassMaterial, emissiveMaterial } from './materials.js';
import { clamp01, clampv, lerpv, makeRng, TAU } from '../core/math.js';
import { settings, perf } from '../core/settings.js';
import { audio } from '../core/audio.js';

const WALL_T = 0.16;          // partition thickness
const DOOR_W = 1.30;          // doorway gap
const MIN_ROOM = 3.0;         // no room narrower than this
const INSET = 0.55;           // gap between the outside wall and the inside one

/**
 * What each kind of building is like inside: how tall, how many rooms to aim
 * for, and which roles those rooms take once they are sorted biggest first.
 * The first role is always the room you walk into.
 */
export const INTERIOR_KINDS = {
  house:      { h: 2.75, span: 15, rooms: 5, roles: ['hall', 'living', 'kitchen', 'bedroom', 'bath', 'bedroom'], floor: 0x8a6a48, wall: 0xd8d2c4, name: 'house' },
  apartment:  { h: 2.70, span: 17, rooms: 5, roles: ['lobby', 'living', 'kitchen', 'bedroom', 'bath'], floor: 0x7f7a72, wall: 0xd2cec6, name: 'apartment' },
  shop:       { h: 3.40, span: 18, rooms: 3, roles: ['shopfloor', 'shopfloor', 'storage', 'shopfloor'], floor: 0xb4b0a8, wall: 0xe2ded4, name: 'shop' },
  store:      { h: 3.40, span: 20, rooms: 3, roles: ['shopfloor', 'shopfloor', 'storage', 'shopfloor'], floor: 0xb4b0a8, wall: 0xe2ded4, name: 'store' },
  market:     { h: 3.40, span: 20, rooms: 3, roles: ['shopfloor', 'shopfloor', 'storage', 'shopfloor'], floor: 0xb4b0a8, wall: 0xe2ded4, name: 'market' },
  cafe:       { h: 3.20, span: 15, rooms: 3, roles: ['dining', 'bar', 'kitchen', 'dining'], floor: 0x6f4f38, wall: 0xd8ccb8, name: 'cafe' },
  diner:      { h: 3.20, span: 16, rooms: 3, roles: ['dining', 'bar', 'kitchen', 'dining'], floor: 0x9a9690, wall: 0xdfe3e0, name: 'diner' },
  restaurant: { h: 3.40, span: 18, rooms: 4, roles: ['dining', 'dining', 'bar', 'kitchen', 'dining'], floor: 0x5f4432, wall: 0xcfc3b0, name: 'restaurant' },
  bar:        { h: 3.20, span: 16, rooms: 3, roles: ['bar', 'dining', 'storage', 'dining'], floor: 0x3f3228, wall: 0x6a5a48, name: 'bar' },
  arcade:     { h: 3.40, span: 17, rooms: 2, roles: ['arcade', 'arcade'], floor: 0x2a2a34, wall: 0x3a3a48, name: 'arcade' },
  office:     { h: 3.20, span: 22, rooms: 5, roles: ['reception', 'office', 'office', 'meeting', 'storage', 'office'], floor: 0x8e8a82, wall: 0xe4e2dc, name: 'office' },
  tower:      { h: 3.60, span: 24, rooms: 4, roles: ['reception', 'office', 'meeting', 'office', 'office'], floor: 0x6e6a64, wall: 0xdcdad4, name: 'lobby' },
  mall:       { h: 4.40, span: 34, rooms: 5, roles: ['concourse', 'shopfloor', 'shopfloor', 'dining', 'storage', 'shopfloor'], floor: 0xc6c2b8, wall: 0xe8e4da, name: 'mall' },
  warehouse:  { h: 5.20, span: 34, rooms: 2, roles: ['storage', 'storage'], floor: 0x6a6660, wall: 0x8a8880, name: 'warehouse' },
  industrial: { h: 5.20, span: 32, rooms: 2, roles: ['storage', 'storage'], floor: 0x6a6660, wall: 0x8a8880, name: 'works' },
  barn:       { h: 4.60, span: 20, rooms: 2, roles: ['storage', 'storage'], floor: 0x6a5238, wall: 0x7a4a34, name: 'barn' },
  gym:        { h: 4.00, span: 20, rooms: 3, roles: ['gym', 'gym', 'storage', 'gym'], floor: 0x4a4a52, wall: 0xd4d0c8, name: 'gym' },
  school:     { h: 3.40, span: 24, rooms: 5, roles: ['hall', 'classroom', 'classroom', 'office', 'storage', 'classroom'], floor: 0x9a8f7a, wall: 0xe0dcd0, name: 'school' },
  hospital:   { h: 3.40, span: 26, rooms: 5, roles: ['reception', 'ward', 'ward', 'office', 'storage', 'ward'], floor: 0xc8ccd0, wall: 0xeef2f4, name: 'hospital' },
  police:     { h: 3.30, span: 22, rooms: 4, roles: ['reception', 'office', 'office', 'storage', 'office'], floor: 0x7a8088, wall: 0xd6dae0, name: 'station' },
  fire:       { h: 5.00, span: 24, rooms: 2, roles: ['garage', 'office', 'garage'], floor: 0x5a5e62, wall: 0xc0392b, name: 'fire station' },
  station:    { h: 5.20, span: 30, rooms: 3, roles: ['concourse', 'reception', 'storage', 'concourse'], floor: 0xa8a49c, wall: 0xdedad0, name: 'station' },
  church:     { h: 6.00, span: 22, rooms: 2, roles: ['pews', 'office', 'pews'], floor: 0x6a5a44, wall: 0xdcd6c4, name: 'church' },
  stadium:    { h: 5.00, span: 34, rooms: 3, roles: ['concourse', 'shopfloor', 'storage', 'concourse'], floor: 0x8a8680, wall: 0xcfcbc2, name: 'stadium' },
  gas:        { h: 3.20, span: 12, rooms: 2, roles: ['shopfloor', 'storage'], floor: 0xb0aca4, wall: 0xdedad2, name: 'shop' },
};

const DEFAULT_KIND = { h: 3.10, span: 20, rooms: 4, roles: ['lobby', 'office', 'office', 'storage'], floor: 0x8a8680, wall: 0xdedad4, name: 'building' };

export function kindPlan(kind) { return INTERIOR_KINDS[kind] || DEFAULT_KIND; }

/** Every building kind that has an inside — which is all of them. */
export function interiorName(lot) {
  return (lot && lot.name) || kindPlan(lot && lot.kind).name;
}

// ---------------------------------------------------------------------------
// The floor plan
// ---------------------------------------------------------------------------
/**
 * Split a rectangle into rooms. Each split records the wall it created and
 * where the doorway through it goes, so the plan is always walkable.
 */
function partition(x, z, w, d, rng, spec, rooms, walls, depth) {
  const enough = rooms.length + 1 >= spec.rooms;
  const canSplitX = w >= MIN_ROOM * 2 + WALL_T;
  const canSplitZ = d >= MIN_ROOM * 2 + WALL_T;
  if (enough || depth > 4 || (!canSplitX && !canSplitZ)) {
    rooms.push({ x, z, w, d });
    return;
  }
  // Split the long way, usually.
  const alongX = canSplitX && (!canSplitZ || (w > d ? rng() < 0.85 : rng() < 0.15));
  const t = rng.range(0.40, 0.60);
  if (alongX) {
    const cut = x - w * 0.5 + w * t;
    const leftW = cut - (x - w * 0.5) - WALL_T * 0.5;
    const rightW = (x + w * 0.5) - cut - WALL_T * 0.5;
    walls.push({ axis: 'x', pos: cut, from: z - d * 0.5, to: z + d * 0.5, door: z + rng.range(-0.28, 0.28) * d });
    partition(cut - WALL_T * 0.5 - leftW * 0.5, z, leftW, d, rng, spec, rooms, walls, depth + 1);
    partition(cut + WALL_T * 0.5 + rightW * 0.5, z, rightW, d, rng, spec, rooms, walls, depth + 1);
  } else {
    const cut = z - d * 0.5 + d * t;
    const nearD = cut - (z - d * 0.5) - WALL_T * 0.5;
    const farD = (z + d * 0.5) - cut - WALL_T * 0.5;
    walls.push({ axis: 'z', pos: cut, from: x - w * 0.5, to: x + w * 0.5, door: x + rng.range(-0.28, 0.28) * w });
    partition(x, cut - WALL_T * 0.5 - nearD * 0.5, w, nearD, rng, spec, rooms, walls, depth + 1);
    partition(x, cut + WALL_T * 0.5 + farD * 0.5, w, farD, rng, spec, rooms, walls, depth + 1);
  }
}

/** A complete plan in the lot's local space: rooms, walls, roles, entry point. */
export function planInterior(lot) {
  const spec = kindPlan(lot.kind);
  const rng = makeRng((lot.seed ^ 0x51a7c3) >>> 0);
  const w = Math.min(Math.max(lot.w - INSET * 2, MIN_ROOM * 2), spec.span);
  const d = Math.min(Math.max(lot.d - INSET * 2, MIN_ROOM * 2), spec.span);

  const rooms = [];
  const walls = [];
  partition(0, 0, w, d, rng, spec, rooms, walls, 0);

  // You come in through the middle of the front wall (local +z).
  const entry = { x: 0, z: d * 0.5 - 1.5 };
  let entryRoom = rooms[0];
  let best = Infinity;
  for (const r of rooms) {
    const inside = Math.abs(r.x - entry.x) <= r.w * 0.5 && Math.abs(r.z - entry.z) <= r.d * 0.5;
    const dist = Math.hypot(r.x - entry.x, r.z - entry.z) - (inside ? 1000 : 0);
    if (dist < best) { best = dist; entryRoom = r; }
  }
  // Put the entry inside whichever room owns the front door.
  entry.x = clampv(entry.x, entryRoom.x - entryRoom.w * 0.5 + 0.9, entryRoom.x + entryRoom.w * 0.5 - 0.9);
  entry.z = clampv(entry.z, entryRoom.z - entryRoom.d * 0.5 + 0.9, entryRoom.z + entryRoom.d * 0.5 - 0.9);

  // Roles: the entry room takes the first, and the rest go biggest-first down
  // the list and then round again. Cycling rather than repeating the last one
  // is the difference between a cafe with a dining room, a bar and a kitchen
  // and a cafe with three kitchens.
  const rest = rooms.filter((r) => r !== entryRoom).sort((a, b) => b.w * b.d - a.w * a.d);
  entryRoom.role = spec.roles[0];
  const pool = spec.roles.length > 1 ? spec.roles.slice(1) : spec.roles;
  for (let i = 0; i < rest.length; i++) rest[i].role = pool[i % pool.length];
  return { w, d, h: spec.h, rooms, walls, entry, entryRoom, spec, rng: (lot.seed ^ 0x51a7c3) >>> 0 };
}

// ---------------------------------------------------------------------------
// Furnishing
// ---------------------------------------------------------------------------
/** A box, batched, with an optional collider. */
function piece(ctx, mat, w, h, d, x, y, z, rot, solid) {
  ctx.b.add(mat, transformed(boxUV(w, h, d, Math.max(1, w), Math.max(1, h)), x, y + h * 0.5, z, rot || 0));
  if (solid !== false && h > 0.35) ctx.solids.push({ x, z, w, d, rot: rot || 0, h: y + h });
}

function tube(ctx, mat, r, h, x, y, z) {
  ctx.b.add(mat, transformed(cylinderUV(r, r, h, 8, 1, 1), x, y + h * 0.5, z, 0));
}

/** Chairs around a table, four sides. */
function chairsAround(ctx, pal, x, z, r, rot) {
  for (let i = 0; i < 4; i++) {
    const a = rot + i * Math.PI * 0.5;
    const cx = x + Math.sin(a) * r, cz = z + Math.cos(a) * r;
    piece(ctx, pal.wood, 0.42, 0.44, 0.42, cx, 0, cz, a, false);
    piece(ctx, pal.wood, 0.42, 0.46, 0.08, cx + Math.sin(a) * 0.18, 0.44, cz + Math.cos(a) * 0.18, a, false);
  }
}

const FURNISH = {
  hall(ctx, r, pal) {
    piece(ctx, pal.wood, Math.min(1.1, r.w * 0.4), 0.78, 0.36, r.x, 0, r.z - r.d * 0.5 + 0.4, 0);
    piece(ctx, pal.dark, 0.08, 1.75, 0.08, r.x + Math.min(1.2, r.w * 0.3), 0, r.z - r.d * 0.5 + 0.35, 0, false);
    piece(ctx, pal.rug, Math.min(2.2, r.w * 0.6), 0.02, Math.min(1.4, r.d * 0.4), r.x, 0.01, r.z, 0, false);
  },
  lobby(ctx, r, pal, rng) {
    piece(ctx, pal.stone, Math.min(3.0, r.w * 0.5), 1.05, 0.7, r.x, 0, r.z - r.d * 0.5 + 0.9, 0);
    for (const sx of [-1, 1]) {
      piece(ctx, pal.soft, 1.7, 0.42, 0.75, r.x + sx * Math.min(2.4, r.w * 0.3), 0, r.z + r.d * 0.18, 0);
      piece(ctx, pal.soft, 1.7, 0.45, 0.2, r.x + sx * Math.min(2.4, r.w * 0.3), 0.42, r.z + r.d * 0.18 - 0.28, 0, false);
    }
    piece(ctx, pal.rug, Math.min(3.4, r.w * 0.6), 0.02, Math.min(2.4, r.d * 0.5), r.x, 0.01, r.z + r.d * 0.15, 0, false);
  },
  reception(ctx, r, pal) {
    piece(ctx, pal.stone, Math.min(3.6, r.w * 0.55), 1.08, 0.72, r.x, 0, r.z - r.d * 0.28, 0);
    piece(ctx, pal.dark, Math.min(3.8, r.w * 0.58), 0.06, 0.86, r.x, 1.08, r.z - r.d * 0.28, 0, false);
    piece(ctx, pal.soft, 1.6, 0.42, 0.72, r.x - r.w * 0.25, 0, r.z + r.d * 0.28, 0);
    piece(ctx, pal.soft, 1.6, 0.45, 0.2, r.x - r.w * 0.25, 0.42, r.z + r.d * 0.28 - 0.26, 0, false);
  },
  living(ctx, r, pal, rng) {
    const sw = Math.min(2.3, r.w * 0.55);
    piece(ctx, pal.soft, sw, 0.40, 0.9, r.x, 0, r.z + r.d * 0.28, 0);
    piece(ctx, pal.soft, sw, 0.48, 0.24, r.x, 0.40, r.z + r.d * 0.28 - 0.33, 0, false);
    for (const sx of [-1, 1]) piece(ctx, pal.soft, 0.22, 0.56, 0.9, r.x + sx * sw * 0.5, 0, r.z + r.d * 0.28, 0, false);
    piece(ctx, pal.wood, Math.min(1.3, r.w * 0.34), 0.38, 0.6, r.x, 0, r.z, 0);
    piece(ctx, pal.wood, Math.min(1.7, r.w * 0.42), 0.5, 0.36, r.x, 0, r.z - r.d * 0.35, 0);
    piece(ctx, pal.screen, Math.min(1.5, r.w * 0.38), 0.85, 0.07, r.x, 0.55, r.z - r.d * 0.35, 0, false);
    piece(ctx, pal.rug, Math.min(2.6, r.w * 0.6), 0.02, Math.min(1.9, r.d * 0.45), r.x, 0.01, r.z + r.d * 0.05, 0, false);
  },
  kitchen(ctx, r, pal) {
    const runW = Math.min(r.w - 0.6, 4.2);
    const bz = r.z - r.d * 0.5 + 0.35;
    piece(ctx, pal.unit, runW, 0.88, 0.62, r.x, 0, bz, 0);
    piece(ctx, pal.stone, runW + 0.06, 0.06, 0.68, r.x, 0.88, bz, 0, false);
    piece(ctx, pal.unit, runW * 0.8, 0.62, 0.34, r.x, 1.55, bz - 0.1, 0, false);
    piece(ctx, pal.metal, 0.72, 1.82, 0.68, r.x + runW * 0.5 - 0.4, 0, bz + 0.9, 0);
    piece(ctx, pal.metal, 0.58, 0.04, 0.42, r.x - runW * 0.2, 0.9, bz, 0, false);
    if (r.w > 4 && r.d > 4) {
      piece(ctx, pal.wood, 1.2, 0.74, 0.85, r.x, 0, r.z + r.d * 0.22, 0);
      chairsAround(ctx, pal, r.x, r.z + r.d * 0.22, 0.85, 0);
    }
  },
  bedroom(ctx, r, pal, rng) {
    const bw = Math.min(1.5, r.w * 0.45);
    piece(ctx, pal.wood, bw, 0.42, 2.0, r.x - r.w * 0.16, 0, r.z, 0);
    piece(ctx, pal.linen, bw - 0.08, 0.18, 1.9, r.x - r.w * 0.16, 0.42, r.z, 0, false);
    piece(ctx, pal.linen, bw - 0.3, 0.14, 0.42, r.x - r.w * 0.16, 0.6, r.z - 0.72, 0, false);
    piece(ctx, pal.wood, bw + 0.1, 0.55, 0.1, r.x - r.w * 0.16, 0.42, r.z - 1.02, 0, false);
    piece(ctx, pal.wood, 0.45, 0.52, 0.42, r.x - r.w * 0.16 + bw * 0.5 + 0.36, 0, r.z - 0.7, 0, false);
    piece(ctx, pal.wood, 1.0, 1.95, 0.58, r.x + r.w * 0.32, 0, r.z + r.d * 0.2, 0);
  },
  bath(ctx, r, pal) {
    piece(ctx, pal.porcelain, Math.min(1.65, r.w * 0.6), 0.55, 0.75, r.x, 0, r.z - r.d * 0.5 + 0.45, 0);
    piece(ctx, pal.porcelain, 0.55, 0.85, 0.42, r.x + r.w * 0.28, 0, r.z + r.d * 0.2, 0, false);
    piece(ctx, pal.porcelain, 0.42, 0.42, 0.6, r.x - r.w * 0.28, 0, r.z + r.d * 0.24, 0, false);
    piece(ctx, pal.glass, 0.9, 1.4, 0.05, r.x - r.w * 0.1, 0.4, r.z + r.d * 0.42, 0, false);
  },
  shopfloor(ctx, r, pal, rng) {
    const rows = Math.max(1, Math.floor((r.w - 1.6) / 2.4));
    for (let i = 0; i < rows; i++) {
      const x = r.x - (rows - 1) * 1.2 + i * 2.4;
      const len = Math.min(r.d - 1.8, 6.5);
      piece(ctx, pal.unit, 0.85, 1.85, len, x, 0, r.z, 0);
      for (let s = 0; s < 3; s++) {
        piece(ctx, pal.goods[(i + s) % pal.goods.length], 0.75, 0.24, len - 0.2, x, 0.45 + s * 0.48, r.z, 0, false);
      }
    }
    piece(ctx, pal.stone, Math.min(2.6, r.w * 0.5), 1.05, 0.66, r.x, 0, r.z + r.d * 0.5 - 0.7, 0);
  },
  counter(ctx, r, pal) {
    piece(ctx, pal.stone, Math.min(3.2, r.w * 0.6), 1.05, 0.7, r.x, 0, r.z, 0);
    piece(ctx, pal.screen, 0.34, 0.26, 0.24, r.x + 0.6, 1.05, r.z, 0, false);
  },
  dining(ctx, r, pal, rng) {
    const cols = Math.max(1, Math.floor((r.w - 1.4) / 2.3));
    const rows = Math.max(1, Math.floor((r.d - 1.4) / 2.3));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = r.x - (cols - 1) * 1.15 + i * 2.3;
        const z = r.z - (rows - 1) * 1.15 + j * 2.3;
        piece(ctx, pal.wood, 0.95, 0.74, 0.95, x, 0, z, 0);
        chairsAround(ctx, pal, x, z, 0.78, 0.4);
      }
    }
  },
  bar(ctx, r, pal) {
    const bw = Math.min(r.w - 1.2, 5.5);
    piece(ctx, pal.wood, bw, 1.12, 0.66, r.x, 0, r.z - r.d * 0.28, 0);
    piece(ctx, pal.dark, bw + 0.2, 0.08, 0.82, r.x, 1.12, r.z - r.d * 0.28, 0, false);
    piece(ctx, pal.unit, bw, 1.9, 0.4, r.x, 0, r.z - r.d * 0.5 + 0.3, 0);
    for (let s = 0; s < 3; s++) {
      piece(ctx, pal.bottles[s % pal.bottles.length], bw - 0.4, 0.22, 0.18, r.x, 0.75 + s * 0.42, r.z - r.d * 0.5 + 0.25, 0, false);
    }
    const stools = Math.max(2, Math.floor(bw / 0.9));
    for (let i = 0; i < stools; i++) {
      const x = r.x - (stools - 1) * 0.45 + i * 0.9;
      tube(ctx, pal.metal, 0.06, 0.72, x, 0, r.z - r.d * 0.28 + 0.75);
      piece(ctx, pal.soft, 0.36, 0.09, 0.36, x, 0.72, r.z - r.d * 0.28 + 0.75, 0, false);
    }
  },
  office(ctx, r, pal) {
    const cols = Math.max(1, Math.floor((r.w - 1.2) / 2.2));
    const rows = Math.max(1, Math.floor((r.d - 1.2) / 2.0));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = r.x - (cols - 1) * 1.1 + i * 2.2;
        const z = r.z - (rows - 1) * 1.0 + j * 2.0;
        piece(ctx, pal.unit, 1.5, 0.74, 0.75, x, 0, z, 0);
        piece(ctx, pal.screen, 0.52, 0.34, 0.05, x + 0.3, 0.74, z - 0.2, 0, false);
        piece(ctx, pal.soft, 0.5, 0.45, 0.5, x - 0.1, 0, z + 0.8, 0, false);
        piece(ctx, pal.soft, 0.5, 0.5, 0.1, x - 0.1, 0.45, z + 1.02, 0, false);
      }
    }
    piece(ctx, pal.metal, 0.5, 1.4, 0.7, r.x + r.w * 0.5 - 0.5, 0, r.z - r.d * 0.5 + 0.6, 0);
  },
  meeting(ctx, r, pal) {
    const tw = Math.min(r.w - 1.6, 3.4);
    piece(ctx, pal.wood, tw, 0.74, Math.min(r.d - 1.6, 1.4), r.x, 0, r.z, 0);
    const n = Math.max(2, Math.floor(tw / 0.8));
    for (let i = 0; i < n; i++) {
      const x = r.x - (n - 1) * 0.4 + i * 0.8;
      for (const sz of [-1, 1]) {
        piece(ctx, pal.soft, 0.46, 0.45, 0.46, x, 0, r.z + sz * 1.15, 0, false);
        piece(ctx, pal.soft, 0.46, 0.5, 0.1, x, 0.45, r.z + sz * 1.38, 0, false);
      }
    }
    piece(ctx, pal.screen, Math.min(1.6, r.w * 0.5), 0.9, 0.06, r.x, 1.0, r.z - r.d * 0.5 + 0.2, 0, false);
  },
  classroom(ctx, r, pal) {
    const cols = Math.max(1, Math.floor((r.w - 1.2) / 1.7));
    const rows = Math.max(1, Math.floor((r.d - 2.4) / 1.5));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = r.x - (cols - 1) * 0.85 + i * 1.7;
        const z = r.z - (rows - 1) * 0.75 + j * 1.5 + 0.5;
        piece(ctx, pal.wood, 1.2, 0.72, 0.55, x, 0, z, 0);
        piece(ctx, pal.soft, 0.4, 0.42, 0.4, x, 0, z + 0.6, 0, false);
      }
    }
    piece(ctx, pal.board, Math.min(3.2, r.w * 0.7), 1.2, 0.08, r.x, 0.9, r.z - r.d * 0.5 + 0.15, 0, false);
    piece(ctx, pal.wood, 1.3, 0.76, 0.6, r.x, 0, r.z - r.d * 0.5 + 1.1, 0);
  },
  ward(ctx, r, pal) {
    const n = Math.max(1, Math.floor((r.w - 1.2) / 2.0));
    for (let i = 0; i < n; i++) {
      const x = r.x - (n - 1) * 1.0 + i * 2.0;
      piece(ctx, pal.metal, 0.95, 0.56, 2.0, x, 0, r.z - r.d * 0.5 + 1.4, 0);
      piece(ctx, pal.linen, 0.88, 0.16, 1.9, x, 0.56, r.z - r.d * 0.5 + 1.4, 0, false);
      piece(ctx, pal.metal, 1.0, 0.5, 0.06, x, 0.56, r.z - r.d * 0.5 + 0.45, 0, false);
      piece(ctx, pal.unit, 0.42, 0.7, 0.42, x + 0.75, 0, r.z - r.d * 0.5 + 0.6, 0, false);
    }
  },
  storage(ctx, r, pal, rng) {
    const rows = Math.max(1, Math.floor((r.w - 1.4) / 2.6));
    for (let i = 0; i < rows; i++) {
      const x = r.x - (rows - 1) * 1.3 + i * 2.6;
      const len = Math.min(r.d - 1.4, 8);
      for (let s = 0; s < 3; s++) {
        piece(ctx, pal.metal, 1.0, 0.1, len, x, 0.5 + s * 0.9, r.z, 0, false);
      }
      for (const sz of [-1, 1]) {
        piece(ctx, pal.metal, 0.1, 2.6, 0.1, x, 0, r.z + sz * len * 0.5, 0, false);
      }
      piece(ctx, pal.crate, 1.0, 2.6, len, x, 0, r.z, 0);
      for (let s = 0; s < 3; s++) {
        for (let c = 0; c < 3; c++) {
          if (rng() < 0.35) continue;
          piece(ctx, pal.crate, 0.7, 0.6, 0.7, x, 0.6 + s * 0.9, r.z - len * 0.3 + c * len * 0.3, 0, false);
        }
      }
    }
  },
  garage(ctx, r, pal) {
    piece(ctx, pal.floorStripe, Math.min(r.w - 1, 4.0), 0.02, Math.min(r.d - 1, 9), r.x, 0.01, r.z, 0, false);
    piece(ctx, pal.metal, 0.6, 2.2, 0.5, r.x - r.w * 0.5 + 0.5, 0, r.z - r.d * 0.3, 0);
    for (let i = 0; i < 3; i++) {
      piece(ctx, pal.crate, 0.6, 0.5, 0.6, r.x + r.w * 0.5 - 0.6, i * 0.5, r.z + r.d * 0.3, 0, i === 0);
    }
  },
  gym(ctx, r, pal) {
    const n = Math.max(1, Math.floor((r.w - 1.2) / 2.2));
    for (let i = 0; i < n; i++) {
      const x = r.x - (n - 1) * 1.1 + i * 2.2;
      piece(ctx, pal.dark, 0.7, 0.45, 1.7, x, 0, r.z - r.d * 0.2, 0);
      piece(ctx, pal.metal, 0.5, 1.2, 0.4, x, 0.45, r.z - r.d * 0.2 - 0.6, 0, false);
      piece(ctx, pal.dark, 1.6, 0.3, 0.5, x, 0, r.z + r.d * 0.25, 0, false);
    }
    piece(ctx, pal.mirror, Math.min(r.w - 0.8, 6), 1.9, 0.06, r.x, 0.5, r.z - r.d * 0.5 + 0.12, 0, false);
  },
  arcade(ctx, r, pal) {
    const n = Math.max(2, Math.floor((r.w - 1) / 1.3));
    for (let i = 0; i < n; i++) {
      const x = r.x - (n - 1) * 0.65 + i * 1.3;
      for (const sz of [-1, 1]) {
        if (r.d < 4 && sz > 0) continue;
        const z = r.z + sz * (r.d * 0.5 - 0.9);
        piece(ctx, pal.dark, 0.8, 1.75, 0.7, x, 0, z, 0);
        piece(ctx, pal.neon[(i + (sz > 0 ? 1 : 0)) % pal.neon.length], 0.62, 0.5, 0.06, x, 1.0, z + (sz > 0 ? -0.38 : 0.38), 0, false);
      }
    }
  },
  concourse(ctx, r, pal) {
    const n = Math.max(2, Math.floor(r.w / 6));
    for (let i = 0; i < n; i++) {
      const x = r.x - (n - 1) * 3 + i * 6;
      piece(ctx, pal.stone, 0.7, 4.0, 0.7, x, 0, r.z, 0);
    }
    for (const sz of [-1, 1]) {
      piece(ctx, pal.soft, 2.2, 0.42, 0.6, r.x, 0, r.z + sz * Math.min(r.d * 0.3, 4), 0);
    }
  },
  pews(ctx, r, pal) {
    const rows = Math.max(2, Math.floor((r.d - 2) / 1.2));
    for (let i = 0; i < rows; i++) {
      const z = r.z - r.d * 0.5 + 1.8 + i * 1.2;
      for (const sx of [-1, 1]) {
        piece(ctx, pal.wood, Math.min(r.w * 0.38, 3), 0.45, 0.42, r.x + sx * r.w * 0.22, 0, z, 0, false);
        piece(ctx, pal.wood, Math.min(r.w * 0.38, 3), 0.55, 0.08, r.x + sx * r.w * 0.22, 0.45, z - 0.2, 0, false);
      }
    }
    piece(ctx, pal.stone, 1.6, 1.0, 0.8, r.x, 0, r.z - r.d * 0.5 + 0.9, 0);
  },
};

// ---------------------------------------------------------------------------
// Building the cell
// ---------------------------------------------------------------------------
function palette(spec, rng) {
  return {
    wood: paintedMaterial(0x8a6640, 0.78),
    dark: paintedMaterial(0x2a2a30, 0.8),
    soft: paintedMaterial(rng.pick([0x4a5a6a, 0x6a5a4a, 0x5a6a52, 0x6a4a52]), 0.9),
    unit: paintedMaterial(0xcfcbc2, 0.7),
    stone: concreteMaterial(0x9a968e),
    metal: metalMaterial(0x8a8f95, 0.4),
    glass: glassMaterial(0x9fc4d8, 0.35),
    linen: paintedMaterial(0xe8e4dc, 0.95),
    porcelain: paintedMaterial(0xf2f4f4, 0.4),
    rug: paintedMaterial(rng.pick([0x7a4a42, 0x3f5a52, 0x5a4a6a, 0x6a6a4a]), 0.95),
    screen: paintedMaterial(0x14181e, 0.35),
    board: paintedMaterial(0x2a4a3a, 0.85),
    crate: paintedMaterial(0x9a7a4a, 0.9),
    mirror: metalMaterial(0xc8d2d8, 0.12),
    floorStripe: paintedMaterial(0xc8a83a, 0.8),
    goods: [paintedMaterial(0xc0553a, 0.8), paintedMaterial(0x3a7ac0, 0.8), paintedMaterial(0x4aa05a, 0.8), paintedMaterial(0xd0a83a, 0.8)],
    bottles: [paintedMaterial(0x4a7a3a, 0.4), paintedMaterial(0x8a5a2a, 0.4), paintedMaterial(0x6a4a7a, 0.4)],
    neon: [emissiveMaterial(0xff4a7a, 1.6), emissiveMaterial(0x4affd0, 1.6), emissiveMaterial(0xffd44a, 1.6)],
  };
}

/**
 * Build one interior. Everything is in the lot's local space inside a group
 * that carries the lot's position and rotation, so the plan lines up with the
 * building above it.
 */
export function buildInterior(game, lot) {
  const plan = planInterior(lot);
  const spec = plan.spec;
  const rng = makeRng(plan.rng);
  const pal = palette(spec, rng);
  const floorY = game.world.groundAt(lot.x, lot.z);
  const rot = lot.rot || 0;

  const group = new THREE.Group();
  group.name = 'interior';
  group.position.set(lot.x, floorY, lot.z);
  group.rotation.y = rot;
  group.matrixAutoUpdate = false;
  group.updateMatrix();

  const b = new GeometryBatcher();
  const ctx = { b, solids: [] };
  const W = plan.w, D = plan.d, H = plan.h;

  const floorMat = paintedMaterial(spec.floor, 0.86);
  const wallMat = paintedMaterial(spec.wall, 0.92);
  const ceilMat = paintedMaterial(0xe8e6e0, 0.95);

  // Shell: floor, ceiling, four outside walls with a gap for the front door.
  b.add(floorMat, transformed(boxUV(W, 0.14, D, W * 0.5, D * 0.5), 0, -0.07, 0, 0));
  b.add(ceilMat, transformed(boxUV(W, 0.14, D, W * 0.4, D * 0.4), 0, H + 0.07, 0, 0));
  b.add(wallMat, transformed(boxUV(W + WALL_T * 2, H, WALL_T, W, H), 0, H * 0.5, -D * 0.5 - WALL_T * 0.5, 0));
  for (const sx of [-1, 1]) {
    b.add(wallMat, transformed(boxUV(WALL_T, H, D, D, H), sx * (W * 0.5 + WALL_T * 0.5), H * 0.5, 0, 0));
  }
  // Front wall, split around the doorway you came through.
  const gapHalf = 1.1;
  for (const sx of [-1, 1]) {
    const segW = W * 0.5 - gapHalf;
    if (segW > 0.05) {
      b.add(wallMat, transformed(boxUV(segW, H, WALL_T, segW, H),
        sx * (gapHalf + segW * 0.5), H * 0.5, D * 0.5 + WALL_T * 0.5, 0));
    }
  }
  // Lintel over the doorway, and a glass door panel you can see the street through.
  b.add(wallMat, transformed(boxUV(gapHalf * 2, H - 2.3, WALL_T, 2, 1), 0, 2.3 + (H - 2.3) * 0.5, D * 0.5 + WALL_T * 0.5, 0));

  // Outside walls are solid.
  ctx.solids.push({ x: 0, z: -D * 0.5 - WALL_T, w: W + 1, d: WALL_T * 2, rot: 0, h: H });
  for (const sx of [-1, 1]) ctx.solids.push({ x: sx * (W * 0.5 + WALL_T), z: 0, w: WALL_T * 2, d: D + 1, rot: 0, h: H });
  for (const sx of [-1, 1]) {
    const segW = W * 0.5 - gapHalf;
    if (segW > 0.05) ctx.solids.push({ x: sx * (gapHalf + segW * 0.5), z: D * 0.5 + WALL_T, w: segW, d: WALL_T * 2, rot: 0, h: H });
  }

  // Partitions, each with a doorway cut through it.
  for (const wall of plan.walls) {
    const doorHalf = DOOR_W * 0.5;
    if (wall.axis === 'x') {
      const dz = clampv(wall.door, wall.from + doorHalf + 0.2, wall.to - doorHalf - 0.2);
      for (const side of [-1, 1]) {
        const a = side < 0 ? wall.from : dz + doorHalf;
        const bEdge = side < 0 ? dz - doorHalf : wall.to;
        const len = bEdge - a;
        if (len <= 0.05) continue;
        b.add(wallMat, transformed(boxUV(WALL_T, H, len, len, H), wall.pos, H * 0.5, a + len * 0.5, 0));
        ctx.solids.push({ x: wall.pos, z: a + len * 0.5, w: WALL_T, d: len, rot: 0, h: H });
      }
      b.add(wallMat, transformed(boxUV(WALL_T, H - 2.1, DOOR_W, 1, 1), wall.pos, 2.1 + (H - 2.1) * 0.5, dz, 0));
    } else {
      const dx = clampv(wall.door, wall.from + doorHalf + 0.2, wall.to - doorHalf - 0.2);
      for (const side of [-1, 1]) {
        const a = side < 0 ? wall.from : dx + doorHalf;
        const bEdge = side < 0 ? dx - doorHalf : wall.to;
        const len = bEdge - a;
        if (len <= 0.05) continue;
        b.add(wallMat, transformed(boxUV(len, H, WALL_T, len, H), a + len * 0.5, H * 0.5, wall.pos, 0));
        ctx.solids.push({ x: a + len * 0.5, z: wall.pos, w: len, d: WALL_T, rot: 0, h: H });
      }
      b.add(wallMat, transformed(boxUV(DOOR_W, H - 2.1, WALL_T, 1, 1), dx, 2.1 + (H - 2.1) * 0.5, wall.pos, 0));
    }
  }

  // Furniture and ceiling lights, room by room.
  const lampMat = emissiveMaterial(0xfff2d8, 1.5);
  const lights = [];
  for (const room of plan.rooms) {
    const fn = FURNISH[room.role] || FURNISH.storage;
    try { fn(ctx, room, pal, rng); } catch (e) { console.warn('[T10] furnishing failed', room.role, e); }
    const lw = Math.min(room.w * 0.5, 1.3), ld = Math.min(room.d * 0.5, 1.3);
    b.add(lampMat, transformed(boxUV(lw, 0.06, ld, 1, 1), room.x, H - 0.09, room.z, 0));
    lights.push({ x: room.x, z: room.z, y: H - 0.3, room });
  }

  b.build(group, { name: 'interior', castShadow: false, receiveShadow: true });
  group.traverse((o) => { if (o.isMesh) { o.matrixAutoUpdate = false; o.updateMatrix(); } });

  // Colliders in world space, so the world's own resolver can use them.
  const c = Math.cos(rot), s = Math.sin(rot);
  const colliders = ctx.solids.map((q) => ({
    x: lot.x + q.x * c - q.z * s,
    z: lot.z + q.x * s + q.z * c,
    // h is measured from the floor, and baseY says where that floor is.
    w: q.w, d: q.d, rot: rot + (q.rot || 0), h: q.h || H, baseY: floorY,
  }));

  const toWorld = (lx, lz) => ({ x: lot.x + lx * c - lz * s, z: lot.z + lx * s + lz * c });
  const entryWorld = toWorld(plan.entry.x, plan.entry.z);

  return {
    lot, plan, group, colliders, floorY, height: H,
    name: interiorName(lot),
    entry: { x: entryWorld.x, z: entryWorld.z, y: floorY },
    lightSpots: lights.map((l) => Object.assign(toWorld(l.x, l.z), { y: floorY + l.y })),
    rooms: plan.rooms.map((r) => Object.assign({ role: r.role, w: r.w, d: r.d }, toWorld(r.x, r.z))),
  };
}

// ---------------------------------------------------------------------------
// The manager
// ---------------------------------------------------------------------------
export class Interiors {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.cells = new Map();       // lot -> cell, at most KEEP of them
    this.current = null;
    this.lamps = [];
    this.ambient = null;
    this.rng = makeRng(0x2f81bd);
  }

  get inside() { return !!this.current; }
  get KEEP() { return 2; }

  key(lot) { return lot.x.toFixed(1) + ':' + lot.z.toFixed(1); }

  /** Build or fetch the interior for a lot. */
  ensure(lot) {
    const k = this.key(lot);
    const had = this.cells.get(k);
    if (had) return had;
    let cell;
    try {
      cell = buildInterior(this.game, lot);
    } catch (e) {
      console.warn('[T10] could not build an interior', e);
      return null;
    }
    cell.key = k;
    this.cells.set(k, cell);
    // Keep at most a couple built; the rest go back to the heap.
    while (this.cells.size > this.KEEP) {
      const oldest = this.cells.keys().next().value;
      if (oldest === k || (this.current && this.current.key === oldest)) break;
      this.dispose(oldest);
    }
    return cell;
  }

  dispose(key) {
    const cell = this.cells.get(key);
    if (!cell) return;
    if (cell.group.parent) cell.group.parent.remove(cell.group);
    disposeGroup(cell.group);
    this.cells.delete(key);
  }

  clear() {
    if (this.current) this.leave();
    for (const k of [...this.cells.keys()]) this.dispose(k);
  }

  /**
   * Walk in. Returns the interior, or null if this door leads nowhere.
   * @param door the door interactable, which carries its lot
   */
  enter(door) {
    const lot = door && door.lot;
    if (!lot) return null;
    const cell = this.ensure(lot);
    if (!cell) return null;
    if (this.current && this.current !== cell) this.leave(true);

    this.current = cell;
    this.scene.add(cell.group);
    const g = this.game;

    // The lot's own walls stop being solid while you are inside them, and the
    // interior's walls take over.
    g.world.insideLot = lot;
    g.world.setInteriorColliders(cell.colliders);

    g.player.indoors = cell;
    g.player.teleport(cell.entry.x, cell.entry.z, cell.floorY + 0.02);
    g.player.groundOverride = cell.floorY;
    g.player.verticalVel = 0;

    this.addLights(cell);
    this.populate(cell);
    if (g.atmosphere) g.atmosphere.setIndoors(true);
    audio.doorOpen();
    return cell;
  }

  /** Back out to the street. */
  leave(quiet) {
    const cell = this.current;
    if (!cell) return false;
    const g = this.game;
    this.current = null;
    this.removeLights();
    this.depopulate(cell);
    if (cell.group.parent) cell.group.parent.remove(cell.group);

    g.world.insideLot = null;
    g.world.setInteriorColliders(null);
    g.player.indoors = null;
    g.player.groundOverride = null;

    // Step back out through the door you came in by.
    const lot = cell.lot;
    const rot = lot.rot || 0;
    const outX = lot.x - Math.sin(rot) * (lot.d * 0.5 + 2.2);
    const outZ = lot.z + Math.cos(rot) * (lot.d * 0.5 + 2.2);
    g.player.teleport(outX, outZ, g.world.groundAt(outX, outZ));
    g.player.verticalVel = 0;
    if (g.atmosphere) g.atmosphere.setIndoors(false);
    if (!quiet) audio.doorClose();
    return true;
  }

  /**
   * A couple of people who belong here. They stand where they are — the crowd
   * AI does not know about interior walls, and someone strolling through a
   * kitchen wall would be worse than an empty room — but they are alive, they
   * look around, and you can talk to them.
   */
  populate(cell) {
    const npcs = this.game.npcs;
    if (!npcs || !npcs.enabled) return;
    cell.people = [];
    // Never more than the room count, and never more than the crowd budget likes.
    const want = Math.min(cell.rooms.length - 1, Math.round(clampv(cell.rooms.length * 0.5, 0, 3) * perf.load));
    const spare = cell.rooms.filter((r) => r.role !== 'hall' && r.role !== 'lobby');
    for (let i = 0; i < want && i < spare.length; i++) {
      const room = spare[i];
      const jx = (this.rng() - 0.5) * Math.min(room.w, 2) * 0.5;
      const jz = (this.rng() - 0.5) * Math.min(room.d, 2) * 0.5;
      const npc = npcs.spawnNear(0, 0, 0, 0, { x: room.x + jx, z: room.z + jz });
      if (!npc) continue;
      npc.position.y = cell.floorY;
      npc.root.position.copy(npc.position);
      npc.controlled = 'indoor';
      npc.activity = 'work';
      npc.activityTimer = 2;
      npc.interiorOf = cell;
      cell.people.push(npc);
    }
  }

  /** They go when you do. */
  depopulate(cell) {
    const npcs = this.game.npcs;
    if (!cell || !cell.people) return;
    for (const npc of cell.people) {
      if (npcs && !npc.removed) npcs.remove(npc);
    }
    cell.people = null;
  }

  /** Lights for the rooms nearest you, within the preset's budget. */
  addLights(cell) {
    this.removeLights();
    const budget = Math.max(2, Math.round(settings.preset.maxDynamicLights * 0.5 * perf.load));
    const spots = cell.lightSpots.slice(0, budget);
    for (const s of spots) {
      const l = new THREE.PointLight(0xffeccd, 0.85, 13, 2);
      l.position.set(s.x, s.y, s.z);
      l.castShadow = false;
      this.scene.add(l);
      this.lamps.push(l);
    }
    if (!this.ambient) {
      this.ambient = new THREE.AmbientLight(0xbfc8d4, 0.42);
      this.scene.add(this.ambient);
    }
  }

  removeLights() {
    for (const l of this.lamps) this.scene.remove(l);
    this.lamps.length = 0;
    if (this.ambient) { this.scene.remove(this.ambient); this.ambient = null; }
  }

  /** The doorway you came in by, for the prompt and for USE. */
  exitPrompt() {
    const cell = this.current;
    if (!cell) return null;
    const p = this.game.player.position;
    const d = Math.hypot(p.x - cell.entry.x, p.z - cell.entry.z);
    return d < 3.0 ? { label: 'Leave the ' + cell.name, distance: d } : null;
  }

  /** Which room you are standing in. */
  roomAt(x, z) {
    const cell = this.current;
    if (!cell) return null;
    let best = null, bd = Infinity;
    for (const r of cell.rooms) {
      const d = Math.hypot(r.x - x, r.z - z);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  update(dt) {
    const cell = this.current;
    if (!cell) return;
    // Walking out through the front door is the same as asking to leave.
    const p = this.game.player.position;
    const lot = cell.lot;
    const rot = lot.rot || 0;
    const dx = p.x - lot.x, dz = p.z - lot.z;
    const lz = -dx * Math.sin(rot) + dz * Math.cos(rot);
    if (lz > cell.plan.d * 0.5 + 0.9) this.leave();
  }

  status() {
    if (!this.current) return 'You\'re outside.';
    const room = this.roomAt(this.game.player.position.x, this.game.player.position.z);
    return 'Inside the ' + this.current.name + (room ? ', in the ' + room.role : '') +
      '. ' + this.current.rooms.length + ' rooms. Say "T10 take me outside" to leave.';
  }
}
