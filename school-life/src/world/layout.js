// School floor plan (meters). +X = east, -Z = north, +Z = south (front entrance).
//
//  North:  [101 Math] [103 Algebra I]  ......  [105 English]
//  ===================== main corridor (z -2..2) =====================
//  South:  [102 Auditorium] [Lobby + grand stairs] [104 Photosynthesis][106 Library]
//                                                    [courtyard]        [Principal]

export const FLOOR2_Y = 4.0;
export const CEIL = 3.4; // standard 1st floor ceiling
export const ROOF = 7.4; // underside of roof
export const BUILDING = { x0: 0, x1: 60, z0: -11, z1: 20 };
export const CORRIDOR = { x0: 0, x1: 60, z0: -2, z1: 2 };

export const NORTH_ROOMS = [
  { id: 101, x0: 2, x1: 12, door: 10.6, board: 'chalk' },
  { id: 103, x0: 14, x1: 24, door: 22.6, board: 'white' },
  { id: 105, x0: 36, x1: 46, door: 44.6, board: 'chalk' },
];

export const AUD = { id: 102, x0: 0, x1: 18, z0: 2, z1: 20, door: 9.0, ceil: 7.0, backAisleZ: 4.0, slopeZ1: 14.0, frontY: -1.0, stageZ: 15.6, stageY: 0 };
export const LOBBY = { x0: 20, x1: 32, z0: 2, z1: 20, stairX0: 20.1, stairX1: 22.3, stairZTop: 5.8, stairZBot: 13.0, balconyZ: 5.8 };
export const SCI = { id: 104, x0: 34, x1: 44, z0: 2, z1: 11, door: 35.5 };
export const LIB = { id: 106, x0: 46, x1: 60, z0: 2, z1: 20, door: 49.5, ceil: 4.0 };
export const OFFICE = { x0: 54, x1: 60, z0: 15, z1: 20, doorZ: 16.9 };
export const COURTYARD = { x0: 34, x1: 44, z0: 11, z1: 20 };
export const FLOOR2 = { x0: 10, x1: 42, walkX0: 18.6, walkX1: 33.4 };

export const DOOR_W = 0.95;
export const DOOR_H = 2.15;

export const SPAWN = { x: 26, z: 16.5, yaw: 0 }; // yaw 0 = facing -Z (north, toward the corridor)

/** Door definitions used by the world builder, NPC routes and interactions. */
export const DOORS = [
  ...NORTH_ROOMS.map((r) => ({ id: 'd' + r.id, room: r.id, axis: 'x', x: r.door, z: -2, w: DOOR_W, into: -1, hinge: 'max' })),
  { id: 'd102', room: 102, axis: 'x', x: AUD.door, z: 2, w: 1.9, into: 1, double: true },
  { id: 'd104', room: 104, axis: 'x', x: SCI.door, z: 2, w: DOOR_W, into: 1, hinge: 'min' },
  { id: 'd106', room: 106, axis: 'x', x: LIB.door, z: 2, w: 1.9, into: 1, double: true },
  { id: 'dOffice', room: 'office', axis: 'z', x: OFFICE.x0, z: OFFICE.doorZ, w: DOOR_W, into: 1, hinge: 'min', locked: 'office' },
  { id: 'dFront', room: 'front', axis: 'x', x: 26, z: 20.15, w: 2.8, into: 1, double: true, locked: 'exit', glass: true },
  { id: 'dWest', room: 'exit', axis: 'z', x: -0.15, z: 0, w: 1.8, into: -1, double: true, locked: 'exit' },
  { id: 'dEast', room: 'exit', axis: 'z', x: 60.15, z: 0, w: 1.8, into: 1, double: true, locked: 'exit' },
];

export function doorFor(roomId) {
  return DOORS.find((d) => d.room === roomId);
}

/** Point just outside (corridor side) and inside a room's door. */
export function doorPoints(roomId) {
  const d = doorFor(roomId);
  if (d.axis === 'x') {
    const s = Math.sign(d.z) || 1; // north doors at z=-2 (s=-1), south doors at z=2 (s=1)
    return { out: { x: d.x, z: d.z - s * 0.85 }, in: { x: d.x, z: d.z + s * 0.95 } };
  }
  return { out: { x: d.x - d.into * 0.9, z: d.z }, in: { x: d.x + d.into * 0.9, z: d.z } };
}

/** Which named area a point is in. */
export function zoneAt(x, y, z) {
  if (y > 3.0 && x >= 9 && x <= 43 && z >= -2.2 && z <= LOBBY.balconyZ + 0.05) return 'floor2';
  for (const r of NORTH_ROOMS) if (x > r.x0 && x < r.x1 && z < -2.1 && z > -11) return 'r' + r.id;
  if (x > AUD.x0 && x < AUD.x1 && z > 2.1 && z < AUD.z1) return 'r102';
  if (x > SCI.x0 && x < SCI.x1 && z > 2.1 && z < SCI.z1) return 'r104';
  if (x > LIB.x0 && x < LIB.x1 && z > 2.1 && z < LIB.z1) return x > OFFICE.x0 && z > OFFICE.z0 ? 'office' : 'r106';
  if (x > LOBBY.x0 && x < LOBBY.x1 && z > 2.0 && z < LOBBY.z1) return 'lobby';
  if (x >= CORRIDOR.x0 && x <= CORRIDOR.x1 && z >= -2.1 && z <= 2.1) return 'corridor';
  return 'exterior';
}

export function roomOfZone(zone) {
  if (zone && zone[0] === 'r') return Number(zone.slice(1));
  return null;
}
