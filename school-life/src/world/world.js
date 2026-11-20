// Builds the whole world with loading progress.
import * as THREE from 'three';
import { TextureLib } from '../engine/textures.js';
import { createMaterials } from '../engine/materials.js';
import { Builder } from '../engine/builder.js';
import { Env } from '../engine/env.js';
import { SchoolBuilder } from './school.js';
import { RoomsBuilder } from './rooms.js';
import { buildExterior } from './exterior.js';
import { installSchoolTextures } from './assets.js';
import { Doors } from './doors.js';
import { Clocks } from './clocks.js';
import * as L from './layout.js';

const yieldUI = () => new Promise((r) => {
  let done = false;
  const fin = () => { if (!done) { done = true; r(); } };
  requestAnimationFrame(fin);
  setTimeout(fin, 60);
});

export async function buildWorld(gr, onProgress) {
  const scene = new THREE.Scene();
  const T = new TextureLib(gr.r);
  const steps = [
    ['Sharpening pencils…', () => T.initNoise(), 4],
    ['Waxing the hallway floors…', () => { T.floorTile(); T.terrazzo(); }, 10],
    ['Painting the walls…', () => { T.wallBlock(); T.plaster(); }, 9],
    ['Laying the bricks…', () => { T.brick(); T.ceilingTile(); }, 9],
    ['Polishing the desks…', () => { T.wood(); T.planks(); T.metal('metal'); T.metal('brushed', true); T.cache.set('lockerFront', T.lockerFront()); }, 10],
    ['Vacuuming the carpets…', () => { T.carpet(); T.fabric('fabric'); T.fabric('velvet', true); }, 6],
    ['Mowing the lawn…', () => { T.concrete(); T.concrete('sidewalk', '#cbc8c0', 1.5); T.asphalt(); T.grass(); T.leaves(); }, 8],
    ['Stacking library books…', () => { T.bookSpineTex = T.bookSpine(); T.cork(); T.blinds(); T.osb(); T.plastic(); T.hazardTex = T.hazard(); T.hair(); T.denim(); T.blobTex = T.blob(); }, 6],
    ['Writing on the chalkboards…', () => installSchoolTextures(T), 8],
  ];
  const total = steps.reduce((a, s) => a + s[2], 0) + 30;
  let acc = 0;
  for (const [label, fn, w] of steps) {
    onProgress(acc / total, label);
    await yieldUI();
    fn();
    acc += w;
  }

  onProgress(acc / total, 'Building the school…');
  await yieldUI();
  const M = createMaterials(T);
  M.outdoorGlow = M.lampGlow.clone();
  M.outdoorGlow.name = 'outdoorGlow';
  const b = new Builder();
  const sb = new SchoolBuilder(b, M, T);
  sb.build();
  acc += 8;
  onProgress(acc / total, 'Setting up the classrooms…');
  await yieldUI();
  const rb = new RoomsBuilder(sb);
  const { seats, teachers } = rb.build();
  acc += 8;
  onProgress(acc / total, 'Parking the school bus…');
  await yieldUI();
  const ext = buildExterior(b, M, T);
  b.build(scene);
  acc += 6;
  onProgress(acc / total, 'Turning on the lights…');
  await yieldUI();

  const env = new Env(gr.r, scene);
  env.outdoorGlow = M.outdoorGlow;
  env.outdoorMats = [M.brick, M.grass, M.asphalt, M.sidewalk, M.leaves, M.trunk];
  const doors = new Doors(scene, b.physics, M);
  for (const spec of L.DOORS) doors.create(spec);
  const clocks = new Clocks(scene, sb.clocks, M);
  const flag = makeFlag(scene, ext.flag, T);

  // Interactables from the world (doors are added by the game)
  const interactables = sb.interactables.slice();

  return {
    scene, T, M, env, doors, clocks, flag,
    physics: b.physics,
    zones: b.zones,
    seats, teachers, interactables,
    lights: sb.lights,
    stats: b.stats,
    progressDone: (acc + 8) / total,
  };
}

function makeFlag(scene, f, T) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1b1f3b';
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = '#ffc72c';
  ctx.fillRect(0, 0, 256, 18);
  ctx.fillRect(0, 142, 256, 18);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 16 : 38;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(128 + Math.cos(a) * r, 80 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  const tex = T.tex(c, { wrap: false });
  const geo = new THREE.PlaneGeometry(f.w, f.h, 16, 8);
  geo.translate(f.w / 2, 0, 0);
  const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 });
  mat.name = 'flag';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(f.x, f.y, f.z);
  mesh.castShadow = false;
  scene.add(mesh);
  const base = geo.attributes.position.array.slice();
  let t = 0;
  let frame = 0;
  return {
    mesh,
    update(dt) {
      t += dt;
      if ((frame++ & 1) === 1) return;
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3];
        const k = x / f.w;
        p.setZ(i, Math.sin(x * 2.6 - t * 5.2) * 0.16 * k + Math.sin(x * 5.1 - t * 7.3) * 0.04 * k);
        p.setY(i, base[i * 3 + 1] - k * k * 0.12);
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
    },
  };
}
