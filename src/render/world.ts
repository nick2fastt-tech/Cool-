import * as THREE from 'three';
import { Room, type QualitySettings } from '../game/config';
import { carpetTexture, litMaterial, glowMaterial, posterTexture, tileTexture, wallTexture, whiteTileTexture } from './materials';

/**
 * The building.
 *
 * Single player never walks the map, so this is built as a set of stages
 * rather than a watertight architectural model: each room only has to hold up
 * from its own security camera and from the office. That keeps the whole venue
 * to a few hundred draw-call-cheap meshes, which is what makes it run on a
 * mid-range phone. The multiplayer milestone will thicken the walls into a
 * navigable mesh; the anchors and dimensions below are already laid out for it.
 *
 * Axes: -Z is deeper into the restaurant, +X is east, Y is up. The office sits
 * at the south end around z = +9.
 */

export interface RoomAnchor {
  /** Where a character stands. */
  pos: THREE.Vector3;
  /** Yaw they face, radians. */
  face: number;
  /** Offset applied per extra occupant so two characters do not overlap. */
  spread: THREE.Vector3;
}

export const ROOM_ANCHORS: Record<Room, RoomAnchor> = {
  [Room.Stage]:      { pos: new THREE.Vector3(0, 0.6, -16.0),  face: 0,            spread: new THREE.Vector3(1.9, 0, 0) },
  [Room.Dining]:     { pos: new THREE.Vector3(0, 0, -8.5),     face: 0,            spread: new THREE.Vector3(2.2, 0, 0.6) },
  [Room.Backstage]:  { pos: new THREE.Vector3(-11.4, 0, -16.0), face: Math.PI * 0.25, spread: new THREE.Vector3(1.4, 0, 0) },
  [Room.Cove]:       { pos: new THREE.Vector3(-12.0, 0, -8.4),  face: Math.PI * 0.35, spread: new THREE.Vector3(1.2, 0, 0) },
  [Room.WestHall]:   { pos: new THREE.Vector3(-6.2, 0, 3.6),    face: 0,            spread: new THREE.Vector3(0, 0, 1.6) },
  [Room.WestCorner]: { pos: new THREE.Vector3(-4.3, 0, 8.4),    face: Math.PI * 0.5, spread: new THREE.Vector3(0, 0, 0.9) },
  [Room.Supply]:     { pos: new THREE.Vector3(-11.6, 0, 4.2),   face: Math.PI * 0.4, spread: new THREE.Vector3(1.1, 0, 0) },
  [Room.EastHall]:   { pos: new THREE.Vector3(6.2, 0, 3.6),     face: 0,            spread: new THREE.Vector3(0, 0, 1.6) },
  [Room.EastCorner]: { pos: new THREE.Vector3(4.3, 0, 8.4),     face: -Math.PI * 0.5, spread: new THREE.Vector3(0, 0, 0.9) },
  [Room.Kitchen]:    { pos: new THREE.Vector3(12.2, 0, -13.6),  face: -Math.PI * 0.3, spread: new THREE.Vector3(1.2, 0, 0) },
  [Room.Restrooms]:  { pos: new THREE.Vector3(12.2, 0, -6.4),   face: -Math.PI * 0.3, spread: new THREE.Vector3(1.2, 0, 0) },
  [Room.Office]:     { pos: new THREE.Vector3(0, 0, 9.6),       face: Math.PI,      spread: new THREE.Vector3(0.8, 0, 0) },
};

export interface World {
  root: THREE.Group;
  /** Roller shutters; y is driven by door travel. */
  shutters: { left: THREE.Mesh; right: THREE.Mesh };
  /** Doorway flood lights, switched by the hall-light buttons. */
  hallLights: { left: THREE.PointLight; right: THREE.PointLight };
  /** Everything that dies in a blackout. */
  gridLights: THREE.Light[];
  /** Battery LED under the desk - the only light left when the grid dies. */
  emergencyLight: THREE.PointLight;
  /** Crow's Nest curtain; x-scale is driven by the fox's stage. */
  coveCurtain: THREE.Mesh;
  /** Office desk fan, spun for ambience. */
  fan: THREE.Object3D;
  /** The hand crank under the desk, animated while cranking. */
  crank: THREE.Object3D;
  dispose(): void;
}

const OFFICE = { x: 3.2, zNear: 11.8, zFar: 7.0, h: 3.0 };

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function floor(mat: THREE.Material, x1: number, z1: number, x2: number, z2: number, y = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x2 - x1), Math.abs(z2 - z1)), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  return m;
}

/** A wall panel standing on the floor, facing along its short axis. */
function wall(mat: THREE.Material, x: number, z: number, w: number, h: number, yaw = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, h / 2, z);
  m.rotation.y = yaw;
  return m;
}

function poster(kind: 'crew' | 'rules' | 'missing', x: number, y: number, z: number, yaw: number, size = 1.1): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshLambertMaterial({ map: posterTexture(kind) }),
  );
  m.position.set(x, y, z);
  m.rotation.y = yaw;
  return m;
}

export function buildWorld(quality: QualitySettings): World {
  const root = new THREE.Group();
  const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];

  const carpet = litMaterial('mat:carpet', { map: carpetTexture(8) });
  const tile = litMaterial('mat:tile', { map: tileTexture(10) });
  const wtile = litMaterial('mat:wtile', { map: whiteTileTexture(5) });
  const walls = litMaterial('mat:wall', { map: wallTexture(5), side: THREE.DoubleSide });
  const trim = litMaterial('mat:trim', { color: 0x241f1a });
  const metal = litMaterial('mat:metal', { color: 0x5b6068 });
  const wood = litMaterial('mat:wood', { color: 0x4a3524 });
  const cloth = litMaterial('mat:cloth', { color: 0x5c1420 });

  /* ------------------------------------------------------- dining + stage */
  root.add(floor(carpet, -9, -14, 9, -1));
  root.add(floor(tile, -9, -1, 9, 7));
  root.add(wall(walls, 0, -14.05, 18, 4));
  root.add(wall(walls, -9.05, -7.5, 13, 4, Math.PI / 2));
  root.add(wall(walls, 9.05, -7.5, 13, 4, Math.PI / 2));

  // Show stage: a low platform with a backdrop and three floor marks.
  root.add(floor(litMaterial('mat:stage', { color: 0x3a2a30 }), -5, -18, 5, -14, 0.6));
  root.add(box(10, 0.6, 0.2, trim, 0, 0.3, -14));
  root.add(wall(litMaterial('mat:curtain', { color: 0x4a1520 }), 0, -18, 10, 4.2));
  for (const x of [-1.9, 0, 1.9]) {
    const mark = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), litMaterial('mat:mark', { color: 0x6a5a2a }));
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(x, 0.61, -16);
    root.add(mark);
  }

  // Party tables. Cheap, but they sell the room on a grainy feed.
  for (const [tx, tz] of [[-5, -10], [0, -11], [5, -10], [-4, -5], [4, -5], [0, -6.5]] as const) {
    root.add(box(1.9, 0.12, 1.9, wood, tx, 0.74, tz));
    root.add(box(0.16, 0.74, 0.16, metal, tx, 0.37, tz));
    for (const [ox, oz] of [[-1.2, 0], [1.2, 0], [0, -1.2], [0, 1.2]] as const) {
      root.add(box(0.44, 0.06, 0.44, cloth, tx + ox, 0.48, tz + oz));
      root.add(box(0.1, 0.48, 0.1, metal, tx + ox, 0.24, tz + oz));
    }
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 8), litMaterial('mat:hat', { color: 0xc23a4a }));
    hat.position.set(tx + 0.3, 0.97, tz + 0.2);
    root.add(hat);
  }
  root.add(poster('crew', -2.5, 2.3, -13.95, 0, 1.6));
  root.add(poster('rules', 3.0, 2.2, -13.95, 0, 1.2));

  /* ----------------------------------------------------------- backstage */
  root.add(floor(litMaterial('mat:concrete', { color: 0x2a2724 }), -13.5, -18, -9, -13));
  root.add(wall(walls, -13.55, -15.5, 5, 3.4, Math.PI / 2));
  root.add(wall(walls, -11.25, -18.05, 4.5, 3.4));
  root.add(box(2.6, 0.1, 0.9, wood, -11.4, 0.95, -16.6));
  for (const x of [-12.2, -11.4, -10.6]) {
    // Spare heads on the workbench. Nothing in this game is ever finished.
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), litMaterial('mat:sparehead', { color: 0x6d5636 }));
    head.position.set(x, 1.3, -16.6);
    root.add(head);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), glowMaterial('eye:spare', 0xd8c88a, 1.2));
    e.position.set(x - 0.1, 1.34, -16.35);
    root.add(e);
  }
  root.add(poster('missing', -13.5, 2.0, -15.5, Math.PI / 2, 1.3));

  /* ---------------------------------------------------------- crow's nest */
  root.add(floor(litMaterial('mat:covefloor', { color: 0x22262a }), -14, -11, -9, -5));
  root.add(wall(walls, -14.05, -8, 6, 3.4, Math.PI / 2));
  const coveCurtain = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 3.2),
    litMaterial('mat:covecurtain', { color: 0x3b1030, side: THREE.DoubleSide }),
  );
  coveCurtain.position.set(-11.5, 1.6, -5.2);
  coveCurtain.rotation.y = 0.12;
  root.add(coveCurtain);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.8),
    new THREE.MeshLambertMaterial({ map: posterTexture('missing'), transparent: true }),
  );
  sign.position.set(-11.5, 2.5, -5.05);
  root.add(sign);

  /* ------------------------------------------------- kitchen and restrooms */
  root.add(floor(wtile, 9, -16, 14, -10));
  root.add(floor(wtile, 9, -9, 14, -3));
  root.add(wall(walls, 14.05, -13, 6, 3.4, Math.PI / 2));
  root.add(wall(walls, 14.05, -6, 6, 3.4, Math.PI / 2));
  root.add(box(4.4, 0.9, 0.8, metal, 12.0, 0.45, -15.4));
  root.add(box(0.8, 1.6, 2.4, metal, 13.4, 0.8, -12.4));
  for (const z of [-7.6, -5.2]) {
    root.add(box(1.2, 2.0, 0.1, litMaterial('mat:stall', { color: 0x38484a }), 12.6, 1.0, z));
  }
  root.add(box(0.7, 0.2, 0.5, wtile, 10.4, 0.9, -4.2));

  /* ---------------------------------------------------------------- halls */
  for (const side of [-1, 1] as const) {
    const x = 6.2 * side;
    root.add(floor(tile, x - 1.2, -1, x + 1.2, 7.2));
    root.add(wall(walls, x - 1.25 * side, 3, 8.2, 3.2, Math.PI / 2));
    root.add(wall(walls, x + 1.25 * side, 3, 8.2, 3.2, Math.PI / 2));
    root.add(poster(side < 0 ? 'crew' : 'rules', x + 1.2 * side, 1.9, 1.4, -Math.PI / 2 * side, 1.0));
    // Corner elbow linking the hall to the office doorway.
    root.add(floor(tile, x - 1.2 * side, 7.2, OFFICE.x * side, 9.6));
    root.add(wall(walls, (x + OFFICE.x * side) / 2, 9.65, 3.4, 3.2));
  }

  /* --------------------------------------------------------------- office */
  root.add(floor(litMaterial('mat:officefloor', { color: 0x2b2b2e }), -OFFICE.x, OFFICE.zFar, OFFICE.x, OFFICE.zNear));
  root.add(wall(walls, 0, OFFICE.zFar - 0.05, OFFICE.x * 2, OFFICE.h));
  root.add(wall(walls, 0, OFFICE.zNear + 0.05, OFFICE.x * 2, OFFICE.h));
  const ceiling = floor(litMaterial('mat:ceiling', { color: 0x1a1a1c }), -OFFICE.x, OFFICE.zFar, OFFICE.x, OFFICE.zNear, OFFICE.h);
  ceiling.rotation.x = Math.PI / 2;
  root.add(ceiling);

  // Side walls with a doorway gap between z 7.8 and 9.0.
  for (const side of [-1, 1] as const) {
    const x = OFFICE.x * side;
    root.add(wall(walls, x, 7.4, 0.9, OFFICE.h, Math.PI / 2));
    root.add(wall(walls, x, 10.4, 2.8, OFFICE.h, Math.PI / 2));
    // Door frame: a lit metal surround so the opening reads as a doorway on a
    // dark screen, and so a silhouette standing in it has an edge to break.
    root.add(box(0.22, 0.5, 1.5, trim, x, OFFICE.h - 0.25, 8.7));
    root.add(box(0.24, 2.6, 0.12, metal, x, 1.3, 8.02));
    root.add(box(0.24, 2.6, 0.12, metal, x, 1.3, 9.38));
    root.add(box(0.26, 0.1, 1.5, metal, x, 2.58, 8.7));
  }

  // Desk, tablet stand, fan, and the posters the night guard has to look at.
  root.add(box(3.4, 0.1, 1.15, wood, 0, 0.78, 9.95));
  root.add(box(0.12, 0.78, 0.9, metal, -1.5, 0.39, 9.95));
  root.add(box(0.12, 0.78, 0.9, metal, 1.5, 0.39, 9.95));
  root.add(box(0.9, 0.05, 0.5, metal, -1.0, 0.86, 9.9));
  const fan = new THREE.Group();
  const cage = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.02, 6, 14), metal);
  const blades = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.02), litMaterial('mat:blade', { color: 0x8a8f96 }));
  fan.add(cage, blades);
  fan.scale.setScalar(0.72);
  fan.position.set(1.62, 1.12, 9.5);
  root.add(fan);
  root.add(box(0.08, 0.3, 0.08, metal, 1.62, 0.95, 9.5));
  root.add(poster('crew', -1.9, 1.9, 7.0, 0, 0.9));
  root.add(poster('rules', 1.9, 1.9, 7.0, 0, 0.9));

  // Hand-crank breaker panel, bolted under the desk on the player's right.
  const crank = new THREE.Group();
  const panel = box(0.5, 0.6, 0.12, litMaterial('mat:panel', { color: 0x3d4348 }), 0, 0, 0);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 12), litMaterial('mat:crank', { color: 0xb07a2a }));
  handle.position.z = 0.12;
  const grip = box(0.05, 0.05, 0.14, metal, 0.13, 0, 0.16);
  crank.add(panel, handle, grip);
  crank.position.set(1.15, 0.44, 9.6);
  root.add(crank);

  /* --------------------------------------------------------------- lights */
  const gridLights: THREE.Light[] = [];
  const ambient = new THREE.AmbientLight(0x46587a, 1.05);
  root.add(ambient);

  const officeLight = new THREE.PointLight(0xffd8a0, 2.6, 16, 1.35);
  officeLight.position.set(0, 2.75, 9.6);
  root.add(officeLight);
  gridLights.push(officeLight);

  const stageLight = new THREE.PointLight(0x9ab4ff, 2.2, 24, 1.5);
  stageLight.position.set(0, 3.4, -15);
  root.add(stageLight);
  gridLights.push(stageLight);

  if (quality.extraLights > 0) {
    const diner = new THREE.PointLight(0xffcf9a, 1.9, 26, 1.5);
    diner.position.set(0, 3.6, -7);
    root.add(diner);
    gridLights.push(diner);
  }
  if (quality.extraLights > 1) {
    for (const side of [-1, 1] as const) {
      const l = new THREE.PointLight(0xbfd4ff, 1.5, 16, 1.6);
      l.position.set(6.2 * side, 2.9, 2.5);
      root.add(l);
      gridLights.push(l);
    }
  }
  if (quality.extraLights > 3) {
    const kitchen = new THREE.PointLight(0xd8e6ff, 1.6, 18, 1.6);
    kitchen.position.set(11.5, 3, -13);
    root.add(kitchen);
    gridLights.push(kitchen);
    const rest = new THREE.PointLight(0xd8e6ff, 1.4, 16, 1.6);
    rest.position.set(11.5, 3, -6);
    root.add(rest);
    gridLights.push(rest);
  }

  // Doorway floods: off by default, switched by the hall-light buttons.
  const hallLights = {
    left: new THREE.PointLight(0xf2f6ff, 0, 9, 1.3),
    right: new THREE.PointLight(0xf2f6ff, 0, 9, 1.3),
  };
  hallLights.left.position.set(-3.7, 2.15, 8.6);
  hallLights.right.position.set(3.7, 2.15, 8.6);
  root.add(hallLights.left, hallLights.right);

  const emergencyLight = new THREE.PointLight(0x4fd0a0, 0, 3.2, 2);
  emergencyLight.position.set(1.1, 0.75, 9.6);
  root.add(emergencyLight);

  /* -------------------------------------------------------------- shutters */
  const shutterMat = litMaterial('mat:shutter', { color: 0x6a6f76 });
  const mkShutter = (side: -1 | 1): THREE.Mesh => {
    const m = box(0.16, 2.6, 1.35, shutterMat, OFFICE.x * side, OFFICE.h + 1.3, 8.7);
    m.userData.openY = OFFICE.h + 1.3;
    m.userData.closedY = 1.3;
    return m;
  };
  const shutters = { left: mkShutter(-1), right: mkShutter(1) };
  root.add(shutters.left, shutters.right);

  if (quality.shadows) {
    officeLight.castShadow = true;
    officeLight.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    officeLight.shadow.camera.far = 12;
  }

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      if (mesh.geometry) disposables.push(mesh.geometry);
    }
  });
  // The shutters, fan and curtain animate, so they keep auto-updating.
  for (const o of [shutters.left, shutters.right, coveCurtain, fan, crank]) {
    o.matrixAutoUpdate = true;
    o.traverse?.((c) => (c.matrixAutoUpdate = true));
  }

  return {
    root,
    shutters,
    hallLights,
    gridLights,
    emergencyLight,
    coveCurtain,
    fan,
    crank,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

export { OFFICE };
