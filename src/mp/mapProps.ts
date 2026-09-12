import * as THREE from 'three';
import { DOORWAYS, ROOMS, WALL_HEIGHT } from './map';
import { litMaterial } from '../render/materials';

/**
 * Set dressing for the co-op map.
 *
 * The building has to read as a *place* - a kitchen you recognise as a kitchen
 * from the doorway, a parts room full of things that used to be somebody. That
 * means hundreds of objects, which on a phone means draw calls, which is the
 * one thing a mobile renderer cannot spend freely.
 *
 * So every prop here is collected by shape and material and emitted as a
 * single InstancedMesh. Roughly four hundred objects leave as about twenty
 * draw calls, all with their matrices frozen. None of it has collision: the
 * walls in `map.ts` remain the only truth about where you can walk, so a
 * decoration can never disagree with the server about the shape of the world.
 */

type ShapeKey = 'box' | 'cyl' | 'cone' | 'sphere' | 'plane';

interface Placement {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  ry?: number;
  rx?: number;
  rz?: number;
}

/** Collects transforms per (shape, material) and emits one mesh for each. */
class InstanceBuilder {
  private readonly buckets = new Map<string, { shape: ShapeKey; material: THREE.Material; items: Placement[] }>();

  add(shape: ShapeKey, material: THREE.Material, placement: Placement): void {
    const key = `${shape}|${material.uuid}`;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { shape, material, items: [] };
      this.buckets.set(key, bucket);
    }
    bucket.items.push(placement);
  }

  /** Convenience: a box given its centre and full size. */
  box(material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0): void {
    this.add('box', material, { x, y, z, sx, sy, sz, ry });
  }

  cylinder(material: THREE.Material, x: number, y: number, z: number, radius: number, height: number): void {
    this.add('cyl', material, { x, y, z, sx: radius * 2, sy: height, sz: radius * 2 });
  }

  build(): THREE.Group {
    const group = new THREE.Group();
    const geometries: Record<ShapeKey, THREE.BufferGeometry> = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
      cone: new THREE.ConeGeometry(0.5, 1, 8),
      sphere: new THREE.SphereGeometry(0.5, 8, 6),
      plane: new THREE.PlaneGeometry(1, 1),
    };
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();

    for (const bucket of this.buckets.values()) {
      const mesh = new THREE.InstancedMesh(geometries[bucket.shape], bucket.material, bucket.items.length);
      bucket.items.forEach((item, index) => {
        position.set(item.x, item.y, item.z);
        euler.set(item.rx ?? 0, item.ry ?? 0, item.rz ?? 0);
        quaternion.setFromEuler(euler);
        scale.set(item.sx, item.sy, item.sz);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false; // one mesh spans the building
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
    }
    return group;
  }
}

/** Unlit, so signage and screens still read when the grid is down. */
function glow(key: string, color: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color });
  material.toneMapped = false;
  material.name = key;
  return material;
}

let cachedGlow: Record<string, THREE.MeshBasicMaterial> | null = null;
function glows(): Record<string, THREE.MeshBasicMaterial> {
  if (!cachedGlow) {
    cachedGlow = {
      exit: glow('exit', 0x35c06a),
      screen: glow('screen', 0x4a9ad8),
      warn: glow('warn', 0xd8a32a),
    };
  }
  return cachedGlow;
}

export function buildMapProps(detail: 'low' | 'full'): THREE.Group {
  const b = new InstanceBuilder();

  const wood = litMaterial('prop:wood', { color: 0x4a3524 });
  const darkWood = litMaterial('prop:darkwood', { color: 0x33241a });
  const metal = litMaterial('prop:metal', { color: 0x5d636b });
  const steel = litMaterial('prop:steel', { color: 0x8b939c });
  const dark = litMaterial('prop:dark', { color: 0x1d1f24 });
  const cloth = litMaterial('prop:cloth', { color: 0x6a1f2a });
  const white = litMaterial('prop:white', { color: 0xb9bcc0 });
  const plastic = litMaterial('prop:plastic', { color: 0xc23a4a });
  const trim = litMaterial('prop:trim', { color: 0x2a2420 });
  const suit = litMaterial('prop:suit', { color: 0x6d5636 });
  const lights = glows();

  const rich = detail === 'full';

  /* ---------------------------------------------------------- structure */

  // Skirting around every room, and a rail at chest height in the corridors.
  for (const room of ROOMS) {
    const { x1, z1, x2, z2 } = room.rect;
    const width = x2 - x1;
    const depth = z2 - z1;
    b.box(trim, (x1 + x2) / 2, 0.09, z1 + 0.06, width, 0.18, 0.12);
    b.box(trim, (x1 + x2) / 2, 0.09, z2 - 0.06, width, 0.18, 0.12);
    b.box(trim, x1 + 0.06, 0.09, (z1 + z2) / 2, 0.12, 0.18, depth);
    b.box(trim, x2 - 0.06, 0.09, (z1 + z2) / 2, 0.12, 0.18, depth);
    if (room.id.startsWith('corr')) {
      b.box(trim, (x1 + x2) / 2, 1.15, z1 + 0.08, width, 0.09, 0.08);
      b.box(trim, (x1 + x2) / 2, 1.15, z2 - 0.08, width, 0.09, 0.08);
    }
  }

  // Doorframes: posts and a lintel, so an opening reads as a door on a dark
  // screen instead of a hole.
  for (const door of DOORWAYS) {
    const half = door.width / 2;
    const post = 0.18;
    if (door.axis === 'z') {
      b.box(metal, door.x, 1.25, door.z - half, 0.34, 2.5, post);
      b.box(metal, door.x, 1.25, door.z + half, 0.34, 2.5, post);
      b.box(metal, door.x, 2.55, door.z, 0.38, 0.2, door.width);
      b.box(lights.exit, door.x, 2.78, door.z, 0.1, 0.16, 0.44);
    } else {
      b.box(metal, door.x - half, 1.25, door.z, post, 2.5, 0.34);
      b.box(metal, door.x + half, 1.25, door.z, post, 2.5, 0.34);
      b.box(metal, door.x, 2.55, door.z, door.width, 0.2, 0.38);
      b.box(lights.exit, door.x, 2.78, door.z, 0.44, 0.16, 0.1);
    }
  }

  /* ------------------------------------------------------------- dining */

  // Party tables with chairs. The room is meant to feel abandoned mid-party.
  const tables: [number, number][] = rich
    ? [[-9, -13], [-3, -13], [3, -13], [9, -13], [-9, -7], [-3, -7], [3, -7], [9, -7], [-6, -2.5], [6, -2.5]]
    : [[-9, -13], [3, -13], [-9, -7], [3, -7], [6, -2.5]];
  for (const [tx, tz] of tables) {
    b.cylinder(wood, tx, 0.76, tz, 0.85, 0.08);
    b.cylinder(metal, tx, 0.38, tz, 0.09, 0.76);
    b.cylinder(metal, tx, 0.04, tz, 0.45, 0.06);
    // Four chairs facing in. `facing` points from the chair at the table, so
    // the backrest goes on the far side of the seat from it.
    for (const facing of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const cx = tx - Math.sin(facing) * 1.25;
      const cz = tz - Math.cos(facing) * 1.25;
      b.box(plastic, cx, 0.44, cz, 0.42, 0.06, 0.42, facing);
      b.box(plastic, cx - Math.sin(facing) * 0.2, 0.68, cz - Math.cos(facing) * 0.2, 0.42, 0.44, 0.05, facing);
      for (const [lx, lz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]] as const) {
        const rx = lx * Math.cos(facing) + lz * Math.sin(facing);
        const rz = -lx * Math.sin(facing) + lz * Math.cos(facing);
        b.box(metal, cx + rx, 0.21, cz + rz, 0.04, 0.42, 0.04);
      }
    }
    // A hat somebody left behind.
    b.add('cone', plastic, { x: tx + 0.3, y: 0.88, z: tz + 0.2, sx: 0.2, sy: 0.24, sz: 0.2 });
  }
  // Bunting along the dining walls.
  if (rich) {
    for (let i = 0; i < 12; i++) {
      const x = -13 + i * 2.2;
      b.add('cone', i % 2 ? plastic : litMaterial('prop:bunting', { color: 0x2f6f9f }),
        { x, y: 2.62, z: -15.85, sx: 0.28, sy: 0.36, sz: 0.05, rx: Math.PI });
    }
  }

  /* -------------------------------------------------------------- stage */

  b.box(darkWood, 0, 0.25, -18, 11, 0.5, 3.4);
  b.box(trim, 0, 0.52, -16.35, 11, 0.06, 0.16);
  b.box(cloth, 0, 1.9, -19.7, 11.6, 3.2, 0.2);           // backdrop
  b.box(cloth, -5.2, 1.9, -18, 0.6, 3.2, 3.6);           // side curtains
  b.box(cloth, 5.2, 1.9, -18, 0.6, 3.2, 3.6);
  for (const x of [-2.4, 0, 2.4]) {
    b.cylinder(litMaterial('prop:mark', { color: 0x6a5a2a }), x, 0.51, -18, 0.55, 0.02);
  }
  // A drum kit and a mic stand, still set up.
  b.cylinder(white, 2.9, 0.86, -17.4, 0.42, 0.62);
  b.cylinder(metal, -2.9, 1.25, -17.6, 0.04, 1.5);
  b.add('sphere', dark, { x: -2.9, y: 2.02, z: -17.6, sx: 0.14, sy: 0.14, sz: 0.14 });
  for (const x of [-4, 4]) {
    b.add('cone', metal, { x, y: 2.85, z: -17, sx: 0.34, sy: 0.4, sz: 0.34, rx: Math.PI });
  }

  /* ---------------------------------------------------------- backstage */

  b.box(wood, -20, 0.9, -16.6, 3.4, 0.12, 0.9);          // workbench
  for (const x of [-21.4, -18.6]) b.box(metal, x, 0.45, -16.6, 0.1, 0.9, 0.8);
  for (const x of [-21, -20, -19]) {
    b.add('sphere', suit, { x, y: 1.28, z: -16.6, sx: 0.6, sy: 0.6, sz: 0.6 });
    b.add('sphere', glows().warn, { x: x - 0.12, y: 1.34, z: -16.28, sx: 0.1, sy: 0.1, sz: 0.1 });
    b.add('sphere', glows().warn, { x: x + 0.12, y: 1.34, z: -16.28, sx: 0.1, sy: 0.1, sz: 0.1 });
  }
  for (let i = 0; i < 4; i++) {
    b.box(wood, -22.2 + (i % 2) * 0.9, 0.35 + Math.floor(i / 2) * 0.72, -14.2, 0.8, 0.7, 0.8, i * 0.3);
  }
  b.box(metal, -17.6, 1.4, -17.5, 0.2, 2.6, 2.4);        // shelving rack
  b.box(darkWood, -20, 1.9, -18.88, 2.2, 1.2, 0.06);     // crew rota board
  for (let i = 0; i < 4; i++) b.box(white, -20.7 + i * 0.46, 1.9, -18.84, 0.34, 0.5, 0.02, (i - 1) * 0.05);

  /* -------------------------------------------------------- crow's nest */

  b.box(darkWood, -20, 0.2, -9, 5.4, 0.4, 4.4);          // low stage
  b.box(litMaterial('prop:covecurtain', { color: 0x3b1030 }), -17.6, 1.8, -9, 0.25, 3.2, 5.6);
  b.box(wood, -21.6, 0.9, -10.6, 1.6, 1.0, 0.9, 0.4);    // broken crate
  b.box(metal, -19, 2.6, -7.4, 3.4, 0.1, 0.1);           // rigging bar
  for (const z of [-8.2, -9.8]) b.cylinder(metal, -21.8, 1.6, z, 0.05, 2.2);

  /* --------------------------------------------------------- electrical */

  // Conduit and cable trays along the walls, plus a transformer.
  for (const z of [-4.4, -0.6]) {
    b.add('cyl', metal, { x: -20, y: 2.72, z, sx: 0.14, sy: 5.6, sz: 0.14, rz: Math.PI / 2 });
  }
  for (const x of [-22.4, -17.8]) {
    b.add('cyl', metal, { x, y: 2.72, z: -2, sx: 0.12, sy: 5.6, sz: 0.12, rx: Math.PI / 2 });
  }
  b.box(metal, -22.4, 1.1, -4.2, 0.8, 2.2, 1.2);
  b.box(dark, -22.4, 2.35, -4.2, 0.9, 0.3, 1.3);
  b.box(glows().warn, -22.55, 1.7, -3.4, 0.05, 0.3, 0.4);
  for (let i = 0; i < 3; i++) b.box(metal, -18.4, 0.4 + i * 0.55, 0.6, 1.4, 0.08, 0.6);

  /* ------------------------------------------------------------ kitchen */

  b.box(steel, 20, 0.45, -18.4, 5.4, 0.9, 0.8);          // counter run
  b.box(steel, 20, 0.92, -18.4, 5.5, 0.06, 0.9);
  b.box(steel, 22.4, 0.45, -16, 1.0, 0.9, 3.6);
  b.box(steel, 20, 2.3, -18.3, 5.0, 0.1, 0.7);           // overhead shelf
  for (const [x, radius, height] of [[18.6, 0.24, 0.3], [19.4, 0.3, 0.36], [20.4, 0.2, 0.26]] as const) {
    b.cylinder(steel, x, 1.05 + height / 2, -18.4, radius, height);
  }
  b.box(dark, 18.2, 1.6, -13.6, 1.4, 3.2, 0.2);          // range hood duct
  b.box(steel, 21.6, 1.0, -13.4, 1.6, 2.0, 0.9);         // fridge

  /* ------------------------------------------------------------ freezer */

  for (const z of [-11.4, -7.8]) {
    for (let shelf = 0; shelf < 3; shelf++) {
      b.box(metal, 20, 0.5 + shelf * 0.7, z, 5.0, 0.07, 0.7);
    }
    b.box(metal, 17.8, 1.0, z, 0.08, 2.0, 0.7);
    b.box(metal, 22.2, 1.0, z, 0.08, 2.0, 0.7);
  }
  for (let i = 0; i < 5; i++) {
    b.box(white, 18.6 + (i % 3) * 1.1, 0.32 + Math.floor(i / 3) * 0.62, -9.6, 0.9, 0.6, 0.8, i * 0.4);
  }

  /* ---------------------------------------------------------- restrooms */

  for (const z of [-5.2, -3.6, -2.0]) {
    b.box(white, 21.4, 1.05, z, 2.8, 2.1, 0.08);          // stall divider
  }
  b.box(white, 20, 1.05, -5.9, 0.08, 2.1, 4.0);
  for (const z of [-1.0, 0.2]) {
    b.box(white, 18.4, 0.85, z, 0.6, 0.18, 0.5);          // basin
    b.box(litMaterial('prop:mirror', { color: 0x2a3240 }), 18.15, 1.5, z, 0.06, 0.8, 0.5);
  }

  /* ------------------------------------------------------------- supply */

  for (const x of [-13.2, -8.0]) {
    for (let shelf = 0; shelf < 4; shelf++) b.box(metal, x, 0.4 + shelf * 0.62, 6, 0.7, 0.06, 5.2);
    b.box(metal, x, 1.2, 3.6, 0.08, 2.4, 0.08);
    b.box(metal, x, 1.2, 8.4, 0.08, 2.4, 0.08);
  }
  b.box(metal, -10.5, 1.9, 3.12, 1.4, 1.0, 0.06);        // inventory board
  b.cylinder(plastic, -10.5, 0.22, 4.2, 0.3, 0.44);      // mop bucket
  b.cylinder(wood, -10.5, 1.0, 4.2, 0.04, 1.6);
  for (let i = 0; i < 4; i++) b.box(wood, -10.8 + (i % 2) * 0.85, 0.3 + Math.floor(i / 2) * 0.62, 7.4, 0.8, 0.6, 0.8, i);

  /* ------------------------------------------------------------- office */

  b.box(wood, 0, 0.74, 7.6, 3.2, 0.1, 1.0);              // desk
  b.box(metal, -1.5, 0.37, 7.6, 0.1, 0.74, 0.9);
  b.box(metal, 1.5, 0.37, 7.6, 0.1, 0.74, 0.9);
  for (const [x, ry] of [[-0.8, 0.2], [0.5, -0.15]] as const) {
    b.box(dark, x, 1.05, 7.5, 0.7, 0.45, 0.06, ry);      // monitor shell
    b.box(lights.screen, x, 1.05, 7.44, 0.62, 0.38, 0.02, ry);
  }
  b.box(dark, 0, 0.25, 6.4, 0.5, 0.5, 0.5);              // chair base
  b.box(dark, 0, 0.62, 6.4, 0.6, 0.12, 0.6);
  b.box(dark, 0, 1.0, 6.1, 0.6, 0.7, 0.1);
  b.box(metal, -3.4, 0.6, 5.0, 0.6, 1.2, 0.8);           // filing cabinet
  b.box(metal, -3.4, 1.25, 5.0, 0.64, 0.08, 0.84);
  // Wall dressing, so the first thing you look at is not blank plaster.
  b.box(darkWood, 2.4, 1.8, 3.12, 1.6, 1.1, 0.06);       // notice board
  for (let i = 0; i < 6; i++) {
    b.box(white, 1.85 + (i % 3) * 0.55, 1.5 + Math.floor(i / 3) * 0.55, 3.08, 0.32, 0.4, 0.02, (i - 2) * 0.06);
  }
  b.cylinder(white, -2.6, 2.2, 3.1, 0.24, 0.06);         // wall clock
  b.box(dark, -2.6, 2.2, 3.06, 0.03, 0.16, 0.02);
  for (const x of [3.4, 3.4]) {                           // lockers
    b.box(metal, x, 1.0, 5.4, 0.5, 2.0, 0.9);
    b.box(trim, x - 0.26, 1.0, 5.4, 0.02, 1.9, 0.8);
  }
  b.box(trim, -3.7, 1.7, 7.4, 0.08, 1.0, 1.6);           // pinned rota

  /* -------------------------------------------------------------- parts */

  b.box(wood, 10.5, 0.8, 4.4, 3.0, 0.12, 1.0);           // work table
  for (const x of [9.2, 11.8]) b.box(metal, x, 0.4, 4.4, 0.1, 0.8, 0.9);
  // Disassembled crew. Heads on the bench, limbs in the crates.
  for (const [x, z] of [[9.6, 4.3], [10.5, 4.5], [11.4, 4.2]] as const) {
    b.add('sphere', suit, { x, y: 1.06, z, sx: 0.5, sy: 0.5, sz: 0.5 });
  }
  for (let i = 0; i < 6; i++) {
    b.box(suit, 8.2 + (i % 3) * 0.4, 0.2 + Math.floor(i / 3) * 0.3, 7.2 + (i % 2) * 0.5, 0.22, 0.22, 0.9, i * 0.7);
  }
  for (let i = 0; i < 3; i++) b.box(wood, 12.6, 0.35 + i * 0.72, 6.4 + i * 0.2, 1.0, 0.7, 1.0, i * 0.5);
  b.box(metal, 13.2, 0.5, 4.0, 0.7, 1.0, 0.5);           // toolbox

  /* ---------------------------------------------------------- corridors */

  // Ceiling pipe runs, so the corridors are not featureless tubes. The unit
  // cylinder stands along Y, so a run along X is a rotation about Z and a run
  // along Z is a rotation about X.
  for (const z of [1.0, 2.2]) {
    b.add('cyl', metal, { x: 0, y: WALL_HEIGHT - 0.32, z, sx: 0.16, sy: 33, sz: 0.16, rz: Math.PI / 2 });
  }
  for (const x of [-15.5, 15.5]) {
    b.add('cyl', metal, { x, y: WALL_HEIGHT - 0.32, z: -8, sx: 0.16, sy: 21, sz: 0.16, rx: Math.PI / 2 });
  }
  if (rich) {
    // Wall panels and a few vents, spaced along the main corridor.
    for (let i = 0; i < 10; i++) {
      const x = -15 + i * 3.4;
      b.box(trim, x, 1.9, 0.14, 1.4, 1.1, 0.06);
      if (i % 3 === 0) b.box(metal, x, 2.5, 2.86, 0.7, 0.5, 0.06);
    }
  }

  const group = b.build();
  group.name = 'map-props';
  return group;
}
