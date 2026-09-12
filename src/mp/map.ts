/**
 * The co-op map: "Depot".
 *
 * Shared by the server (collision, validation, AI navigation) and the client
 * (rendering, local prediction). One definition, so a wall can never exist on
 * one side and not the other - that class of desync is designed out rather
 * than debugged later.
 *
 * Layout, looking down (-Z is north):
 *
 *      BACKSTAGE |          STAGE          | KITCHEN
 *      ----------+ - - - - - - - - - - - - +---------
 *      CROW'S    |                         | FREEZER
 *      NEST      W       DINING HALL       E
 *      ----------O                         O---------
 *      ELECTRICAL|                         | RESTROOMS
 *      ----------+-------------------------+---------
 *          ===== MAIN CORRIDOR (loops both wings) =====
 *          SUPPLY      |   OFFICE   |   PARTS ROOM
 *
 * The two wings and the corridor form a loop on purpose: a map of dead ends
 * makes a chase a coin flip, a map with a loop makes it a decision.
 */

export interface Rect {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export type WallStyle = 'panel' | 'tile' | 'concrete' | 'show';

export interface MapRoom {
  id: string;
  name: string;
  rect: Rect;
  /** Which surface this room's walls are finished in. */
  style?: WallStyle;
  /**
   * Ceiling light, killed by a blackout. Intensity is in three.js physical
   * units (candela-ish): a room-scale fixture lands in the twenties, not
   * around 1.0 as it would with the legacy lighting model.
   */
  light?: { x: number; z: number; color: number; intensity: number };
}

/** Axis-aligned wall, stored as a solid box for collision and rendering. */
export interface Wall {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export type InteractKind =
  | 'generator'
  | 'fusePanel'
  | 'breaker'
  | 'mainSwitch'
  | 'fuse'
  | 'battery';

export interface Interactable {
  id: string;
  kind: InteractKind;
  x: number;
  z: number;
  room: string;
  label: string;
  /** Seconds of continuous holding required. 0 = instant. */
  holdSeconds: number;
}

export interface NavNode {
  id: string;
  x: number;
  z: number;
  room: string;
}

export const WALL_THICKNESS = 0.3;
export const WALL_HEIGHT = 3.2;
export const PLAYER_RADIUS = 0.34;
export const BOT_RADIUS = 0.42;
/** Nobody may leave this box, whatever the physics does. */
export const MAP_BOUNDS: Rect = { x1: -23.4, z1: -19.6, x2: 23.4, z2: 9.4 };

export const ROOMS: MapRoom[] = [
  { id: 'stage', name: 'Show Stage', style: 'show', rect: { x1: -6, z1: -20, x2: 6, z2: -16 }, light: { x: 0, z: -18, color: 0x9ab4ff, intensity: 31 } },
  { id: 'dining', name: 'Dining Hall', style: 'show', rect: { x1: -14, z1: -16, x2: 14, z2: 0 }, light: { x: 0, z: -8, color: 0xffcf9a, intensity: 34 } },
  { id: 'corrW', name: 'West Corridor', style: 'panel', rect: { x1: -17, z1: -19, x2: -14, z2: 3 }, light: { x: -15.5, z: -8, color: 0xbfd4ff, intensity: 22 } },
  { id: 'corrE', name: 'East Corridor', style: 'panel', rect: { x1: 14, z1: -19, x2: 17, z2: 3 }, light: { x: 15.5, z: -8, color: 0xbfd4ff, intensity: 22 } },
  { id: 'corrS', name: 'Main Corridor', style: 'panel', rect: { x1: -17, z1: 0, x2: 17, z2: 3 }, light: { x: 0, z: 1.5, color: 0xbfd4ff, intensity: 25 } },
  { id: 'backstage', name: 'Backstage', style: 'concrete', rect: { x1: -23, z1: -19, x2: -17, z2: -13 }, light: { x: -20, z: -16, color: 0xffd0a0, intensity: 20 } },
  { id: 'cove', name: "Crow's Nest", style: 'show', rect: { x1: -23, z1: -12, x2: -17, z2: -6 }, light: { x: -20, z: -9, color: 0xd07070, intensity: 17 } },
  { id: 'electrical', name: 'Electrical Room', style: 'concrete', rect: { x1: -23, z1: -5, x2: -17, z2: 1 }, light: { x: -20, z: -2, color: 0x9fe8c0, intensity: 22 } },
  { id: 'kitchen', name: 'Kitchen', style: 'tile', rect: { x1: 17, z1: -19, x2: 23, z2: -13 }, light: { x: 20, z: -16, color: 0xd8e6ff, intensity: 25 } },
  { id: 'freezer', name: 'Freezer', style: 'tile', rect: { x1: 17, z1: -12, x2: 23, z2: -7 }, light: { x: 20, z: -9.5, color: 0xc8e0ff, intensity: 20 } },
  { id: 'restrooms', name: 'Restrooms', style: 'tile', rect: { x1: 17, z1: -6, x2: 23, z2: 1 }, light: { x: 20, z: -2.5, color: 0xd8e6ff, intensity: 20 } },
  { id: 'supply', name: 'Supply Closet', style: 'concrete', rect: { x1: -14, z1: 3, x2: -7, z2: 9 }, light: { x: -10.5, z: 6, color: 0xffd0a0, intensity: 20 } },
  { id: 'office', name: 'Security Office', style: 'panel', rect: { x1: -4, z1: 3, x2: 4, z2: 9 }, light: { x: 0, z: 6, color: 0xffd8a0, intensity: 28 } },
  { id: 'parts', name: 'Parts & Service', style: 'concrete', rect: { x1: 7, z1: 3, x2: 14, z2: 9 }, light: { x: 10.5, z: 6, color: 0xffc890, intensity: 20 } },
];

/* ------------------------------------------------------------------ walls */

const walls: Wall[] = [];

/** Wall running along X at a fixed Z, with optional doorway gaps in X. */
function hwall(x1: number, x2: number, z: number, gaps: [number, number][] = []): void {
  let cursor = x1;
  for (const [from, to] of [...gaps].sort((a, b) => a[0] - b[0])) {
    if (from > cursor) walls.push({ x1: cursor, z1: z, x2: from, z2: z });
    cursor = Math.max(cursor, to);
  }
  if (cursor < x2) walls.push({ x1: cursor, z1: z, x2, z2: z });
}

/** Wall running along Z at a fixed X, with optional doorway gaps in Z. */
function vwall(z1: number, z2: number, x: number, gaps: [number, number][] = []): void {
  let cursor = z1;
  for (const [from, to] of [...gaps].sort((a, b) => a[0] - b[0])) {
    if (from > cursor) walls.push({ x1: x, z1: cursor, x2: x, z2: from });
    cursor = Math.max(cursor, to);
  }
  if (cursor < z2) walls.push({ x1: x, z1: cursor, x2: x, z2 });
}

// Outer shell, north edge.
hwall(-23, -17, -19);          // backstage
hwall(-17, -14, -19);          // west corridor cap
hwall(-6, 6, -20);             // stage back wall
hwall(14, 17, -19);            // east corridor cap
hwall(17, 23, -19);            // kitchen

// Stage sides, and the dining hall's north wall with the stage opening.
vwall(-20, -16, -6);
vwall(-20, -16, 6);
hwall(-14, 14, -16, [[-6, 6]]);

// Dining hall side walls, one doorway each into the wing corridors.
vwall(-19, 0, -14, [[-9, -6]]);
vwall(-19, 0, 14, [[-9, -6]]);

// Dining hall south wall: three doorways onto the main corridor.
hwall(-14, 14, 0, [[-11, -8], [-1.5, 1.5], [8, 11]]);

// West corridor outer wall, with doors to the three west rooms.
vwall(-19, 3, -17, [[-17, -14], [-10, -7], [-3, 0]]);
// East corridor outer wall, with doors to the three east rooms.
vwall(-19, 3, 17, [[-17, -14], [-11, -8], [-4, -1]]);

// West rooms.
vwall(-19, -13, -23); hwall(-23, -17, -13);
hwall(-23, -17, -12); vwall(-12, -6, -23); hwall(-23, -17, -6);
hwall(-23, -17, -5);  vwall(-5, 1, -23);   hwall(-23, -17, 1);

// East rooms.
vwall(-19, -13, 23); hwall(17, 23, -13);
hwall(17, 23, -12);  vwall(-12, -7, 23);   hwall(17, 23, -7);
hwall(17, 23, -6);   vwall(-6, 1, 23);     hwall(17, 23, 1);

// Main corridor: end caps and the south wall with three doors.
vwall(0, 3, -17);
vwall(0, 3, 17);
hwall(-17, 17, 3, [[-12, -9], [-1.5, 1.5], [9, 12]]);

// South rooms.
vwall(3, 9, -14); vwall(3, 9, -7); hwall(-14, -7, 9);
vwall(3, 9, -4);  vwall(3, 9, 4);  hwall(-4, 4, 9);
vwall(3, 9, 7);   vwall(3, 9, 14); hwall(7, 14, 9);

export const WALLS: readonly Wall[] = walls;

/**
 * Every doorway, as authored above.
 *
 * The collision walls already have the gaps in them; this is the same
 * information stated positively so the renderer can frame each opening and the
 * AI can reason about chokepoints. `axis` is the direction the opening spans.
 */
export interface Doorway {
  x: number;
  z: number;
  /** Width of the opening along `axis`. */
  width: number;
  axis: 'x' | 'z';
  /** Rooms either side, for AI and for signage. */
  between: [string, string];
}

export const DOORWAYS: readonly Doorway[] = [
  { x: -14, z: -7.5, width: 3, axis: 'z', between: ['dining', 'corrW'] },
  { x: 14, z: -7.5, width: 3, axis: 'z', between: ['dining', 'corrE'] },
  { x: -9.5, z: 0, width: 3, axis: 'x', between: ['dining', 'corrS'] },
  { x: 0, z: 0, width: 3, axis: 'x', between: ['dining', 'corrS'] },
  { x: 9.5, z: 0, width: 3, axis: 'x', between: ['dining', 'corrS'] },
  { x: -17, z: -15.5, width: 3, axis: 'z', between: ['corrW', 'backstage'] },
  { x: -17, z: -8.5, width: 3, axis: 'z', between: ['corrW', 'cove'] },
  { x: -17, z: -1.5, width: 3, axis: 'z', between: ['corrW', 'electrical'] },
  { x: 17, z: -15.5, width: 3, axis: 'z', between: ['corrE', 'kitchen'] },
  { x: 17, z: -9.5, width: 3, axis: 'z', between: ['corrE', 'freezer'] },
  { x: 17, z: -2.5, width: 3, axis: 'z', between: ['corrE', 'restrooms'] },
  { x: -10.5, z: 3, width: 3, axis: 'x', between: ['corrS', 'supply'] },
  { x: 0, z: 3, width: 3, axis: 'x', between: ['corrS', 'office'] },
  { x: 10.5, z: 3, width: 3, axis: 'x', between: ['corrS', 'parts'] },
  { x: 0, z: -16, width: 12, axis: 'x', between: ['dining', 'stage'] },
] as const;

/** Wall as a collision box, expanded by the wall's thickness. */
export function wallBox(w: Wall): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const h = WALL_THICKNESS / 2;
  return {
    minX: Math.min(w.x1, w.x2) - h,
    maxX: Math.max(w.x1, w.x2) + h,
    minZ: Math.min(w.z1, w.z2) - h,
    maxZ: Math.max(w.z1, w.z2) + h,
  };
}

const WALL_BOXES = WALLS.map(wallBox);

/**
 * Push a circle out of any wall it overlaps.
 *
 * Resolves along the axis of least penetration, one wall at a time, and is
 * run by the *server* for every player - the client runs the identical code
 * only to predict. It is deliberately simple: no tunnelling handling beyond a
 * capped step, because every mover here is slower than 6 m/s.
 */
export function resolveCollision(x: number, z: number, radius: number): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (let pass = 0; pass < 2; pass++) {
    let moved = false;
    for (const box of WALL_BOXES) {
      const nearestX = Math.max(box.minX, Math.min(px, box.maxX));
      const nearestZ = Math.max(box.minZ, Math.min(pz, box.maxZ));
      const dx = px - nearestX;
      const dz = pz - nearestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq >= radius * radius) continue;

      if (distSq > 1e-8) {
        const dist = Math.sqrt(distSq);
        px = nearestX + (dx / dist) * radius;
        pz = nearestZ + (dz / dist) * radius;
      } else {
        // Dead centre inside the box: leave by the closest face.
        const toLeft = px - box.minX;
        const toRight = box.maxX - px;
        const toTop = pz - box.minZ;
        const toBottom = box.maxZ - pz;
        const min = Math.min(toLeft, toRight, toTop, toBottom);
        if (min === toLeft) px = box.minX - radius;
        else if (min === toRight) px = box.maxX + radius;
        else if (min === toTop) pz = box.minZ - radius;
        else pz = box.maxZ + radius;
      }
      moved = true;
    }
    if (!moved) break;
  }
  px = Math.max(MAP_BOUNDS.x1, Math.min(MAP_BOUNDS.x2, px));
  pz = Math.max(MAP_BOUNDS.z1, Math.min(MAP_BOUNDS.z2, pz));
  return { x: px, z: pz };
}

/** True when nothing solid stands between the two points. */
export function hasLineOfSight(ax: number, az: number, bx: number, bz: number): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  for (const box of WALL_BOXES) {
    if (segmentHitsBox(ax, az, dx, dz, box)) return false;
  }
  return true;
}

function segmentHitsBox(
  ax: number,
  az: number,
  dx: number,
  dz: number,
  box: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  // Slab test, clipped to the segment's 0..1 parameter range.
  let tMin = 0;
  let tMax = 1;
  for (const [origin, delta, min, max] of [
    [ax, dx, box.minX, box.maxX],
    [az, dz, box.minZ, box.maxZ],
  ] as const) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < min || origin > max) return false;
      continue;
    }
    let t1 = (min - origin) / delta;
    let t2 = (max - origin) / delta;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

export function roomAt(x: number, z: number): string {
  for (const room of ROOMS) {
    const r = room.rect;
    if (x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2) return room.id;
  }
  return 'void';
}

export function roomName(id: string): string {
  return ROOMS.find((r) => r.id === id)?.name ?? 'Somewhere';
}

/* ---------------------------------------------------------------- spawning */

export const SPAWNS: { x: number; z: number }[] = [
  { x: -2.4, z: 5.8 },
  { x: 2.4, z: 5.8 },
  { x: -2.4, z: 4.4 },
  { x: 2.4, z: 4.4 },
];

/**
 * Which room a wall belongs to, for finishing it.
 *
 * A wall is shared by whatever is on either side of it, so this samples just
 * inside both faces and takes the first real room it finds. Corridors lose the
 * tie, which is what you want: the tiled kitchen wall should read as kitchen
 * from inside the kitchen.
 */
export function wallStyleFor(wall: Wall): WallStyle {
  const midX = (wall.x1 + wall.x2) / 2;
  const midZ = (wall.z1 + wall.z2) / 2;
  const along = Math.abs(wall.x2 - wall.x1) > Math.abs(wall.z2 - wall.z1) ? 'x' : 'z';
  const offset = 0.5;
  const samples: [number, number][] = along === 'x'
    ? [[midX, midZ - offset], [midX, midZ + offset]]
    : [[midX - offset, midZ], [midX + offset, midZ]];
  let fallback: WallStyle = 'panel';
  for (const [x, z] of samples) {
    const room = ROOMS.find((r) => x >= r.rect.x1 && x <= r.rect.x2 && z >= r.rect.z1 && z <= r.rect.z2);
    if (!room) continue;
    if (!room.id.startsWith('corr')) return room.style ?? 'panel';
    fallback = room.style ?? 'panel';
  }
  return fallback;
}

/* ----------------------------------------------------------- interactables */

export const INTERACTABLES: Interactable[] = [
  // The restoration chain, all inside the electrical room except the second
  // main switch - which is in the office, on purpose, so the last step of a
  // blackout forces the team to split across the map.
  { id: 'gen', kind: 'generator', x: -21.4, z: -3.4, room: 'electrical', label: 'Backup Generator', holdSeconds: 4 },
  { id: 'panel', kind: 'fusePanel', x: -18.2, z: -3.8, room: 'electrical', label: 'Fuse Panel', holdSeconds: 1.5 },
  { id: 'brk1', kind: 'breaker', x: -21.8, z: 0.2, room: 'electrical', label: 'Breaker 1', holdSeconds: 2 },
  { id: 'brk2', kind: 'breaker', x: -19.8, z: 0.2, room: 'electrical', label: 'Breaker 2', holdSeconds: 2 },
  { id: 'brk3', kind: 'breaker', x: -17.8, z: 0.2, room: 'electrical', label: 'Breaker 3', holdSeconds: 2 },
  { id: 'mainA', kind: 'mainSwitch', x: -22.4, z: -1.6, room: 'electrical', label: 'Main Switch A', holdSeconds: 3 },
  { id: 'mainB', kind: 'mainSwitch', x: 0, z: 8.6, room: 'office', label: 'Main Switch B', holdSeconds: 3 },

  // Fuses, scattered across three corners of the map.
  { id: 'fuseA', kind: 'fuse', x: -20.5, z: -15.2, room: 'backstage', label: 'Spare Fuse', holdSeconds: 0.8 },
  { id: 'fuseB', kind: 'fuse', x: 20.4, z: -16.4, room: 'kitchen', label: 'Spare Fuse', holdSeconds: 0.8 },
  { id: 'fuseC', kind: 'fuse', x: 11.4, z: 7.4, room: 'parts', label: 'Spare Fuse', holdSeconds: 0.8 },

  // Battery stations. Limited by a cooldown, not by being unlimited.
  { id: 'bat1', kind: 'battery', x: 0, z: -9.4, room: 'dining', label: 'Charging Station', holdSeconds: 2.5 },
  { id: 'bat2', kind: 'battery', x: -10.4, z: 8.2, room: 'supply', label: 'Charging Station', holdSeconds: 2.5 },
  { id: 'bat3', kind: 'battery', x: 20.4, z: -3.2, room: 'restrooms', label: 'Charging Station', holdSeconds: 2.5 },
];

export const INTERACT_BY_ID = new Map(INTERACTABLES.map((i) => [i.id, i]));
/** How close a player must be for the server to accept an interaction. */
export const INTERACT_RANGE = 2.2;

/* ------------------------------------------------------------ navigation */

export const NAV_NODES: NavNode[] = [
  { id: 'stage', x: 0, z: -18, room: 'stage' },
  { id: 'dinNW', x: -9, z: -13, room: 'dining' },
  { id: 'dinNE', x: 9, z: -13, room: 'dining' },
  { id: 'dinW', x: -10, z: -7.5, room: 'dining' },
  { id: 'dinC', x: 0, z: -8, room: 'dining' },
  { id: 'dinE', x: 10, z: -7.5, room: 'dining' },
  { id: 'dinSW', x: -9.5, z: -2.5, room: 'dining' },
  { id: 'dinS', x: 0, z: -2.5, room: 'dining' },
  { id: 'dinSE', x: 9.5, z: -2.5, room: 'dining' },
  { id: 'dDinW', x: -14, z: -7.5, room: 'dining' },
  { id: 'dDinE', x: 14, z: -7.5, room: 'dining' },
  { id: 'dDinSW', x: -9.5, z: 0, room: 'dining' },
  { id: 'dDinS', x: 0, z: 0, room: 'dining' },
  { id: 'dDinSE', x: 9.5, z: 0, room: 'dining' },
  { id: 'cwN', x: -15.5, z: -16, room: 'corrW' },
  { id: 'cwM', x: -15.5, z: -8.5, room: 'corrW' },
  { id: 'cwS', x: -15.5, z: -1.5, room: 'corrW' },
  { id: 'ceN', x: 15.5, z: -16, room: 'corrE' },
  { id: 'ceM', x: 15.5, z: -9.5, room: 'corrE' },
  { id: 'ceS', x: 15.5, z: -2.5, room: 'corrE' },
  { id: 'csW', x: -15.5, z: 1.5, room: 'corrS' },
  { id: 'csWM', x: -10.5, z: 1.5, room: 'corrS' },
  { id: 'csC', x: 0, z: 1.5, room: 'corrS' },
  { id: 'csEM', x: 10.5, z: 1.5, room: 'corrS' },
  { id: 'csE', x: 15.5, z: 1.5, room: 'corrS' },
  { id: 'dBack', x: -17, z: -15.5, room: 'corrW' },
  { id: 'dCove', x: -17, z: -8.5, room: 'corrW' },
  { id: 'dElec', x: -17, z: -1.5, room: 'corrW' },
  { id: 'dKit', x: 17, z: -15.5, room: 'corrE' },
  { id: 'dFrz', x: 17, z: -9.5, room: 'corrE' },
  { id: 'dRest', x: 17, z: -2.5, room: 'corrE' },
  { id: 'dSup', x: -10.5, z: 3, room: 'corrS' },
  { id: 'dOff', x: 0, z: 3, room: 'corrS' },
  { id: 'dPart', x: 10.5, z: 3, room: 'corrS' },
  { id: 'backstage', x: -20, z: -16, room: 'backstage' },
  { id: 'cove', x: -20, z: -9, room: 'cove' },
  { id: 'electrical', x: -20, z: -2, room: 'electrical' },
  { id: 'kitchen', x: 20, z: -16, room: 'kitchen' },
  { id: 'freezer', x: 20, z: -9.5, room: 'freezer' },
  { id: 'restrooms', x: 20, z: -2.5, room: 'restrooms' },
  { id: 'supply', x: -10.5, z: 6, room: 'supply' },
  { id: 'office', x: 0, z: 6, room: 'office' },
  { id: 'parts', x: 10.5, z: 6, room: 'parts' },
];

const EDGES: [string, string][] = [
  ['stage', 'dinNW'], ['stage', 'dinNE'],
  ['dinNW', 'dinW'], ['dinNE', 'dinE'], ['dinNW', 'dinC'], ['dinNE', 'dinC'],
  ['dinW', 'dinC'], ['dinC', 'dinE'], ['dinW', 'dinSW'], ['dinC', 'dinS'], ['dinE', 'dinSE'],
  ['dinSW', 'dinS'], ['dinS', 'dinSE'],
  ['dinW', 'dDinW'], ['dDinW', 'cwM'],
  ['dinE', 'dDinE'], ['dDinE', 'ceM'],
  ['dinSW', 'dDinSW'], ['dDinSW', 'csWM'],
  ['dinS', 'dDinS'], ['dDinS', 'csC'],
  ['dinSE', 'dDinSE'], ['dDinSE', 'csEM'],
  ['cwN', 'cwM'], ['cwM', 'cwS'], ['cwS', 'csW'],
  ['ceN', 'ceM'], ['ceM', 'ceS'], ['ceS', 'csE'],
  ['csW', 'csWM'], ['csWM', 'csC'], ['csC', 'csEM'], ['csEM', 'csE'],
  ['cwN', 'dBack'], ['dBack', 'backstage'],
  ['cwM', 'dCove'], ['dCove', 'cove'],
  ['cwS', 'dElec'], ['dElec', 'electrical'],
  ['ceN', 'dKit'], ['dKit', 'kitchen'],
  ['ceM', 'dFrz'], ['dFrz', 'freezer'],
  ['ceS', 'dRest'], ['dRest', 'restrooms'],
  ['csWM', 'dSup'], ['dSup', 'supply'],
  ['csC', 'dOff'], ['dOff', 'office'],
  ['csEM', 'dPart'], ['dPart', 'parts'],
];

export const NAV_BY_ID = new Map(NAV_NODES.map((n) => [n.id, n]));

const adjacency = new Map<string, string[]>();
for (const node of NAV_NODES) adjacency.set(node.id, []);
for (const [a, b] of EDGES) {
  adjacency.get(a)?.push(b);
  adjacency.get(b)?.push(a);
}

export function nearestNode(x: number, z: number): NavNode {
  let best = NAV_NODES[0];
  let bestDist = Infinity;
  for (const node of NAV_NODES) {
    const d = (node.x - x) ** 2 + (node.z - z) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = node;
    }
  }
  return best;
}

/** Breadth-first path between two nav nodes, inclusive of both ends. */
export function findPath(fromId: string, toId: string): string[] {
  if (fromId === toId) return [fromId];
  const prev = new Map<string, string>();
  const queue = [fromId];
  const seen = new Set([fromId]);
  while (queue.length) {
    const current = queue.shift() as string;
    for (const next of adjacency.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      prev.set(next, current);
      if (next === toId) {
        const path = [next];
        let step = next;
        while (prev.has(step)) {
          step = prev.get(step) as string;
          path.unshift(step);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return [fromId];
}

/** Rooms a patrolling animatronic will wander between. */
export const PATROL_NODES = [
  'stage', 'dinC', 'dinW', 'dinE', 'backstage', 'cove', 'electrical',
  'kitchen', 'freezer', 'restrooms', 'supply', 'office', 'parts',
  'cwM', 'ceM', 'csC',
];
