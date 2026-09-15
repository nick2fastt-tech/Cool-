// T10 World - the world itself. Owns terrain, chunk streaming, roads,
// buildings, props, collision and the interactable registry.
import * as THREE from '../../vendor/three.module.js';
import {
  CityLayout, WORLD_RADIUS, CITY_RADIUS, SHORE_Z, WATER_LEVEL, BLOCK_SIZE, ROAD_TYPES, DISTRICTS,
} from './city.js';
import { buildLot } from './buildings.js';
import * as Props from './props.js';
import { GeometryBatcher, groundPlane, ribbon, transformed, boxUV, disposeGroup, mergeGeometries } from './geomutils.js';
import {
  asphaltMaterial, concreteMaterial, grassMaterial, dirtMaterial, sandMaterial,
  roadMaterial, sidewalkMaterial, waterMaterial, paintedMaterial, setFacadeNightFactor,
  setWetness, updateWaterTime, metalMaterial,
} from './materials.js';
import { makeRng, fbm2, ridged2, clamp01, clampv, lerpv, smooth01, hash2, TAU } from '../core/math.js';
import { settings } from '../core/settings.js';

export const CHUNK_SIZE = 120;

const _v = new THREE.Vector3();

export class World {
  constructor(scene, seed) {
    this.scene = scene;
    this.seed = (seed >>> 0) || 20260914;
    this.city = new CityLayout(this.seed);
    this.root = new THREE.Group();
    this.root.name = 'world';
    scene.add(this.root);

    this.chunks = new Map();
    this.buildQueue = [];
    this.interactables = [];
    this.interactHash = new Map();
    this.colliders = [];
    this.colliderHash = new Map();
    this.lightSpecs = [];
    this.activeLights = [];
    this.lightPool = [];
    this.trafficLightMeshes = [];
    this.time = 0;
    this.nightFactor = 0;
    this.wetness = 0;
    this.spawnedProps = [];

    this.buildStatic();
  }

  // =========================================================================
  // Terrain
  // =========================================================================

  /** World height at a position. Flat through the city, rolling outside it. */
  heightAt(x, z) {
    const r = Math.max(Math.abs(x), Math.abs(z));
    // Beach ramp and seabed.
    if (z > SHORE_Z - 40) {
      const t = clamp01((z - (SHORE_Z - 40)) / 120);
      const beach = lerpv(0, WATER_LEVEL - 2.6, smooth01(t));
      const ripple = Math.sin(x * 0.02) * 0.25 * (1 - t);
      return beach + ripple;
    }
    const urban = clamp01((r - (CITY_RADIUS - 40)) / 220);
    if (urban <= 0) {
      // Barely-there variation keeps the city readable and drivable.
      return fbm2(x * 0.0016, z * 0.0016, 2, this.seed) * 0.5 - 0.25;
    }
    const hills = (fbm2(x * 0.0013, z * 0.0013, 4, this.seed + 11) - 0.5) * 26;
    const ridges = (ridged2(x * 0.0026, z * 0.0026, 3, this.seed + 29) - 0.4) * 14;
    const h = hills + ridges * clamp01((r - 760) / 400);
    return lerpv(fbm2(x * 0.0016, z * 0.0016, 2, this.seed) * 0.5 - 0.25, h, smooth01(urban));
  }

  /** Ground height accounting for roads, which are flattened into the terrain. */
  groundAt(x, z) {
    const near = this.city.nearestRoad(x, z);
    if (near && near.dist < near.road.width * 0.5 + near.road.sidewalk + 4) {
      const roadH = this.heightAt(near.x, near.z);
      const blend = clamp01((near.dist - (near.road.width * 0.5 + near.road.sidewalk)) / 4);
      const raw = this.heightAt(x, z);
      const curb = near.dist > near.road.width * 0.5 && near.dist < near.road.width * 0.5 + near.road.sidewalk ? 0.15 : 0;
      return lerpv(roadH + curb, raw, blend);
    }
    return this.heightAt(x, z);
  }

  normalAt(x, z, out) {
    const e = 0.9;
    const hL = this.groundAt(x - e, z), hR = this.groundAt(x + e, z);
    const hD = this.groundAt(x, z - e), hU = this.groundAt(x, z + e);
    out = out || new THREE.Vector3();
    out.set(hL - hR, 2 * e, hD - hU).normalize();
    return out;
  }

  /** Surface material underfoot — drives footstep sounds and vehicle grip. */
  surfaceAt(x, z) {
    if (z > SHORE_Z && this.heightAt(x, z) < WATER_LEVEL) return 'water';
    const kind = this.city.surfaceKind(x, z);
    if (kind === 'road') return 'asphalt';
    if (kind === 'sidewalk') return 'concrete';
    if (kind === 'sand') return 'sand';
    if (kind === 'grass') return 'grass';
    const d = this.city.districtAt(x, z);
    if (d === 'industrial') return 'concrete';
    if (d === 'countryside' || d === 'forest') return 'dirt';
    return 'concrete';
  }

  isWater(x, z) { return z > SHORE_Z && this.heightAt(x, z) < WATER_LEVEL; }

  // =========================================================================
  // Static world (built once): ocean, distant terrain shell, highway ring
  // =========================================================================

  buildStatic() {
    // Ocean plane.
    const oceanGeo = new THREE.PlaneGeometry(WORLD_RADIUS * 3, 900, 60, 12);
    oceanGeo.rotateX(-Math.PI / 2);
    const ocean = new THREE.Mesh(oceanGeo, waterMaterial());
    ocean.position.set(0, WATER_LEVEL, SHORE_Z + 420);
    ocean.receiveShadow = false;
    ocean.name = 'ocean';
    this.root.add(ocean);
    this.ocean = ocean;

    // Far terrain shell so the horizon isn't an abrupt edge.
    const shellGeo = new THREE.RingGeometry(WORLD_RADIUS - 80, WORLD_RADIUS + 1600, 64, 4);
    shellGeo.rotateX(-Math.PI / 2);
    const shellPos = shellGeo.attributes.position;
    for (let i = 0; i < shellPos.count; i++) {
      const x = shellPos.getX(i), z = shellPos.getZ(i);
      const d = Math.hypot(x, z);
      const t = clamp01((d - WORLD_RADIUS) / 900);
      shellPos.setY(i, lerpv(-1, 46, smooth01(t)) + (fbm2(x * 0.001, z * 0.001, 3, this.seed) - 0.5) * 28 * t);
    }
    shellGeo.computeVertexNormals();
    const shell = new THREE.Mesh(shellGeo, grassMaterial());
    shell.name = 'far-terrain';
    shell.receiveShadow = false;
    this.root.add(shell);
  }

  // =========================================================================
  // Chunk streaming
  // =========================================================================

  chunkKey(cx, cz) { return cx + ':' + cz; }

  update(dt, focusX, focusZ, budgetMs) {
    this.time += dt;
    const preset = settings.preset;
    // Draw distance governs fog and the far plane; geometry streaming is capped
    // well below it, because buildings past ~600m cost chunks and add nothing
    // the horizon haze doesn't already give you.
    const streamDistance = Math.min(preset.drawDistance, 620);
    const radius = Math.ceil(streamDistance / CHUNK_SIZE);
    const ccx = Math.floor(focusX / CHUNK_SIZE);
    const ccz = Math.floor(focusZ / CHUNK_SIZE);

    // Queue missing chunks nearest-first.
    const wanted = new Set();
    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        const cx = ccx + i, cz = ccz + j;
        const dx = (cx + 0.5) * CHUNK_SIZE - focusX;
        const dz = (cz + 0.5) * CHUNK_SIZE - focusZ;
        const dist = Math.hypot(dx, dz);
        if (dist > streamDistance + CHUNK_SIZE) continue;
        const key = this.chunkKey(cx, cz);
        wanted.add(key);
        if (!this.chunks.has(key) && !this.queued(key)) {
          this.buildQueue.push({ key, cx, cz, dist });
        }
      }
    }
    this.buildQueue.sort((a, b) => a.dist - b.dist);

    // Build within a time budget so streaming never stalls a frame.
    const t0 = performance.now();
    const budget = budgetMs == null ? 6 : budgetMs;
    while (this.buildQueue.length && performance.now() - t0 < budget) {
      const job = this.buildQueue.shift();
      if (this.chunks.has(job.key)) continue;
      this.buildChunk(job.cx, job.cz);
    }

    // Release chunks that fell out of range.
    for (const [key, chunk] of this.chunks) {
      if (!wanted.has(key)) {
        const dx = chunk.centerX - focusX, dz = chunk.centerZ - focusZ;
        if (Math.hypot(dx, dz) > streamDistance + CHUNK_SIZE * 2) this.disposeChunk(key);
      }
    }

    this.updateLights(focusX, focusZ);
    this.city.updateSignals(this.time);
    this.updateTrafficLights();
    updateWaterTime(this.time);
  }

  queued(key) {
    for (const j of this.buildQueue) if (j.key === key) return true;
    return false;
  }

  buildChunk(cx, cz) {
    const key = this.chunkKey(cx, cz);
    const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
    const centerX = x0 + CHUNK_SIZE / 2, centerZ = z0 + CHUNK_SIZE / 2;
    const group = new THREE.Group();
    group.name = 'chunk' + key;
    const batcher = new GeometryBatcher();
    const rng = makeRng(hash2(cx, cz, this.seed) * 0xffffffff);
    const chunk = {
      key, cx, cz, centerX, centerZ, group,
      interactables: [], colliders: [], lights: [], trafficLights: [],
    };

    this.buildTerrainTile(batcher, x0, z0, rng);
    this.buildRoadsInChunk(batcher, x0, z0, chunk);
    this.buildLotsInChunk(batcher, x0, z0, chunk);
    this.buildPropsInChunk(batcher, x0, z0, rng, chunk);
    this.buildNatureInChunk(group, x0, z0, rng);

    batcher.build(group, { name: 'chunk-batch' });
    this.root.add(group);
    this.chunks.set(key, chunk);

    for (const it of chunk.interactables) this.registerInteractable(it);
    for (const col of chunk.colliders) this.registerCollider(col);
    return chunk;
  }

  disposeChunk(key) {
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    for (const it of chunk.interactables) this.unregisterInteractable(it);
    for (const col of chunk.colliders) this.unregisterCollider(col);
    disposeGroup(chunk.group);
    this.chunks.delete(key);
  }

  // ---- terrain tile -------------------------------------------------------
  buildTerrainTile(batcher, x0, z0, rng) {
    const SEG = 8;
    const cellW = CHUNK_SIZE / SEG;
    // Split the tile by dominant surface so grass, sand and concrete each batch.
    const byMat = new Map();
    for (let i = 0; i < SEG; i++) {
      for (let j = 0; j < SEG; j++) {
        const cx = x0 + (i + 0.5) * cellW;
        const cz = z0 + (j + 0.5) * cellW;
        const surf = this.surfaceAt(cx, cz);
        let mat;
        if (surf === 'sand') mat = sandMaterial();
        else if (surf === 'grass') mat = grassMaterial();
        else if (surf === 'dirt') mat = dirtMaterial();
        else mat = concreteMaterial(0xa9a69f);
        const g = new THREE.PlaneGeometry(cellW + 0.05, cellW + 0.05, 2, 2);
        g.rotateX(-Math.PI / 2);
        const pos = g.attributes.position;
        for (let k = 0; k < pos.count; k++) {
          const px = cx + pos.getX(k), pz = cz + pos.getZ(k);
          pos.setY(k, this.heightAt(px, pz));
        }
        g.computeVertexNormals();
        const uv = g.attributes.uv;
        const tile = surf === 'grass' ? 6 : surf === 'sand' ? 8 : 5;
        for (let k = 0; k < uv.count; k++) {
          uv.setXY(k, (cx + pos.getX(k)) / tile, (cz + pos.getZ(k)) / tile);
        }
        g.translate(cx, 0, cz);
        let list = byMat.get(mat);
        if (!list) { list = []; byMat.set(mat, list); }
        list.push(g);
      }
    }
    for (const [mat, list] of byMat) {
      const merged = mergeGeometries(list);
      for (const g of list) if (g !== merged) g.dispose();
      batcher.add(mat, merged);
    }
  }

  // ---- roads --------------------------------------------------------------
  buildRoadsInChunk(batcher, x0, z0, chunk) {
    const x1 = x0 + CHUNK_SIZE, z1 = z0 + CHUNK_SIZE;
    const sidewalkMat = sidewalkMaterial();
    for (const road of this.city.roads) {
      // Clip the road to this chunk's span.
      const minX = Math.min(road.ax, road.bx) - road.width, maxX = Math.max(road.ax, road.bx) + road.width;
      const minZ = Math.min(road.az, road.bz) - road.width, maxZ = Math.max(road.az, road.bz) + road.width;
      if (maxX < x0 || minX > x1 || maxZ < z0 || minZ > z1) continue;

      let tA = 0, tB = 1;
      if (road.horizontal) {
        const len = road.bx - road.ax;
        tA = clamp01((x0 - road.ax) / len);
        tB = clamp01((x1 - road.ax) / len);
      } else {
        const len = road.bz - road.az;
        tA = clamp01((z0 - road.az) / len);
        tB = clamp01((z1 - road.az) / len);
      }
      if (tB <= tA) { const t = tA; tA = tB; tB = t; }
      if (tB - tA < 0.0005) continue;
      const ax = road.ax + road.dx * tA, az = road.az + road.dz * tA;
      const bx = road.ax + road.dx * tB, bz = road.az + road.dz * tB;
      const y = this.heightAt((ax + bx) / 2, (az + bz) / 2) + 0.03;

      batcher.add(roadMaterial(road.material), ribbon(ax, az, bx, bz, road.width, y, 12, road.width));
      if (road.sidewalk > 0) {
        const px = -road.uz, pz = road.ux;
        const off = road.width * 0.5 + road.sidewalk * 0.5;
        for (const side of [-1, 1]) {
          batcher.add(sidewalkMat, ribbon(
            ax + px * off * side, az + pz * off * side,
            bx + px * off * side, bz + pz * off * side,
            road.sidewalk, y + 0.15, 6, road.sidewalk
          ));
          // Kerb face.
          const kOff = road.width * 0.5;
          batcher.add(concreteMaterial(0x969289), transformed(
            boxUV(Math.hypot(bx - ax, bz - az), 0.17, 0.16, 4, 1),
            (ax + bx) / 2 + px * kOff * side, y + 0.08, (az + bz) / 2 + pz * kOff * side,
            -Math.atan2(bz - az, bx - ax)
          ));
        }
      }
    }
  }

  // ---- lots ---------------------------------------------------------------
  buildLotsInChunk(batcher, x0, z0, chunk) {
    const x1 = x0 + CHUNK_SIZE, z1 = z0 + CHUNK_SIZE;
    for (const lot of this.city.lots) {
      if (lot.x < x0 || lot.x >= x1 || lot.z < z0 || lot.z >= z1) continue;
      const result = buildLot(lot, batcher, this);
      for (const door of result.doors) {
        chunk.interactables.push({
          type: 'door', x: door.x, y: door.y, z: door.z, facing: door.facing,
          label: door.label ? ('Enter ' + door.label) : 'Enter building',
          name: door.label || (DISTRICTS[lot.district] ? DISTRICTS[lot.district].name + ' building' : 'Building'),
          lot, radius: 2.4, action: 'enter',
        });
      }
      for (const c of result.colliders) chunk.colliders.push(c);
      for (const l of result.lights) chunk.lights.push(l);
    }
  }

  // ---- props --------------------------------------------------------------
  buildPropsInChunk(batcher, x0, z0, rng, chunk) {
    const density = settings.preset.propDensity;
    const x1 = x0 + CHUNK_SIZE, z1 = z0 + CHUNK_SIZE;

    // Street lights and traffic signals along road edges.
    for (const road of this.city.roads) {
      if (road.sidewalk <= 0 && road.type !== 'highway') continue;
      const spacing = road.type === 'highway' ? 46 : road.type === 'avenue' ? 30 : 38;
      const steps = Math.ceil(road.length / spacing);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = road.ax + road.dx * t, z = road.az + road.dz * t;
        if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
        if (rng() > density) continue;
        const px = -road.uz, pz = road.ux;
        const side = (i % 2 === 0) ? 1 : -1;
        const off = road.width * 0.5 + Math.max(0.9, road.sidewalk * 0.32);
        const lx = x + px * off * side, lz = z + pz * off * side;
        const y = this.groundAt(lx, lz);
        const sub = new GeometryBatcher();
        const lightsOut = { lights: [] };
        Props.addStreetLight(sub, 0, 0, side > 0 ? Math.atan2(-pz, -px) : Math.atan2(pz, px), lightsOut, road.type);
        this.emitLocal(batcher, sub, lx, y, lz);
        for (const l of lightsOut.lights) chunk.lights.push({ ...l, x: l.x + lx, y: l.y + y, z: l.z + lz });
      }
    }

    // Intersection signals.
    for (const node of this.city.nodes) {
      if (!node.signal) continue;
      if (node.x < x0 || node.x >= x1 || node.z < z0 || node.z >= z1) continue;
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        const off = 9;
        const lx = node.x + Math.cos(a) * off, lz = node.z + Math.sin(a) * off;
        const y = this.groundAt(lx, lz);
        const sub = new GeometryBatcher();
        const lenses = Props.addTrafficLight(sub, 0, 0, a + Math.PI, null);
        this.emitLocal(batcher, sub, lx, y, lz);
        for (const m of lenses) {
          m.position.x += lx; m.position.y += y; m.position.z += lz;
          chunk.group.add(m);
        }
        chunk.trafficLights.push({ node, lenses, axis: (k % 2 === 0) ? 'ew' : 'ns' });
      }
    }

    // Sidewalk furniture.
    const cellCount = 5;
    for (let i = 0; i < cellCount; i++) {
      for (let j = 0; j < cellCount; j++) {
        if (rng() > density * 0.85) continue;
        const px = x0 + (i + rng()) * (CHUNK_SIZE / cellCount);
        const pz = z0 + (j + rng()) * (CHUNK_SIZE / cellCount);
        const kind = this.city.surfaceKind(px, pz);
        const district = this.city.districtAt(px, pz);
        const y = this.groundAt(px, pz);
        const sub = new GeometryBatcher();
        const out = { lights: [] };
        let placed = null;

        if (kind === 'sidewalk') {
          const roll = rng();
          const near = this.city.nearestRoad(px, pz);
          const rot = near ? Math.atan2(near.road.uz, near.road.ux) : 0;
          if (roll < 0.18) { Props.addBench(sub, 0, 0, rot); placed = { type: 'bench', label: 'Sit', radius: 1.6, action: 'sit' }; }
          else if (roll < 0.34) { Props.addTrashCan(sub, 0, 0); placed = { type: 'bin', label: 'Search bin', radius: 1.2, action: 'search' }; }
          else if (roll < 0.44) { Props.addHydrant(sub, 0, 0); placed = { type: 'hydrant', label: 'Fire hydrant', radius: 1.2, action: 'inspect' }; }
          else if (roll < 0.52) { Props.addMailbox(sub, 0, 0, rot); placed = { type: 'mailbox', label: 'Mailbox', radius: 1.2, action: 'inspect' }; }
          else if (roll < 0.60 && (district === 'downtown' || district === 'commercial')) {
            Props.addATM(sub, 0, 0, rot, out); placed = { type: 'atm', label: 'Use ATM', radius: 1.8, action: 'atm' };
          } else if (roll < 0.68) { Props.addPlanter(sub, 0, 0, rng); }
          else if (roll < 0.74) { Props.addParkingMeter(sub, 0, 0, rot); }
          else if (roll < 0.80 && near && near.road.type === 'avenue') {
            Props.addBusStop(sub, 0, 0, rot, out); placed = { type: 'busstop', label: 'Wait for bus', radius: 2.6, action: 'bus' };
          } else if (roll < 0.86) { Props.addSignpost(sub, 0, 0, rot, near && near.road.name); }
          else {
            const bucket = rng.int(0, 3);
            const ti = district === 'beach' ? 3 : rng.int(0, TREE_INDEX_MAX);
            this.addTreeTo(chunk.group, ti, bucket, px, y, pz, rng);
          }
        } else if (kind === 'road') {
          continue;
        } else if (district === 'park') {
          const roll = rng();
          if (roll < 0.30) { Props.addBench(sub, 0, 0, rng() * TAU); placed = { type: 'bench', label: 'Sit', radius: 1.6, action: 'sit' }; }
          else if (roll < 0.45) { Props.addPicnicTable(sub, 0, 0, rng() * TAU); placed = { type: 'table', label: 'Sit', radius: 1.8, action: 'sit' }; }
          else if (roll < 0.52) { Props.addTrashCan(sub, 0, 0); }
          else this.addTreeTo(chunk.group, rng.int(0, TREE_INDEX_MAX), rng.int(1, 3), px, y, pz, rng);
        } else if (kind === 'grass' || kind === 'sand') {
          if (rng() < 0.6) this.addTreeTo(chunk.group, district === 'beach' ? 3 : rng.int(0, TREE_INDEX_MAX), rng.int(0, 3), px, y, pz, rng);
          else if (rng() < 0.4) Props.addRock(sub, 0, 0, 0, rng.range(0.3, 1.1), rng);
        }

        this.emitLocal(batcher, sub, px, y, pz);
        for (const l of out.lights) chunk.lights.push({ ...l, x: l.x + px, y: l.y + y, z: l.z + pz });
        if (placed) {
          chunk.interactables.push(Object.assign({ x: px, y, z: pz }, placed));
        }
      }
    }

    // Parked cars along kerbs.
    for (const road of this.city.roads) {
      if (road.type !== 'street') continue;
      const spacing = 13;
      const steps = Math.ceil(road.length / spacing);
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        const x = road.ax + road.dx * t, z = road.az + road.dz * t;
        if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
        if (rng() > 0.34 * density) continue;
        const px = -road.uz, pz = road.ux;
        const side = rng.chance(0.5) ? 1 : -1;
        const off = road.width * 0.5 - 1.15;
        const cx = x + px * off * side, cz = z + pz * off * side;
        const y = this.groundAt(cx, cz);
        const sub = new GeometryBatcher();
        Props.addParkedCar(sub, 0, 0, 0, rng);
        const rot = Math.atan2(road.uz, road.ux) + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        this.emitLocal(batcher, sub, cx, y, cz, rot);
        chunk.colliders.push({ x: cx, z: cz, w: 2.0, d: 4.6, rot, h: 1.5 });
      }
    }

    // Park amenities, one per park chunk.
    for (const p of this.city.parkAreas()) {
      if (p.x < x0 || p.x >= x1 || p.z < z0 || p.z >= z1) continue;
      const y = this.groundAt(p.x, p.z);
      const sub = new GeometryBatcher();
      const fOut = { lights: [] };
      Props.addFountain(sub, 0, 0, fOut);
      this.emitLocal(batcher, sub, p.x, y, p.z);
      for (const l of fOut.lights) chunk.lights.push({ ...l, x: l.x + p.x, y: l.y + y, z: l.z + p.z });
      chunk.interactables.push({ type: 'fountain', x: p.x, y, z: p.z, label: 'Fountain', radius: 4, action: 'inspect', name: p.name });
      if (p.w > 150) {
        const sub2 = new GeometryBatcher();
        Props.addPlayground(sub2, 0, 0, rng);
        this.emitLocal(batcher, sub2, p.x + 40, this.groundAt(p.x + 40, p.z + 30), p.z + 30);
        const sub3 = new GeometryBatcher();
        Props.addBasketballCourt(sub3, 0, 0, 0);
        this.emitLocal(batcher, sub3, p.x - 45, this.groundAt(p.x - 45, p.z - 25), p.z - 25);
        chunk.interactables.push({ type: 'court', x: p.x - 45, y: this.groundAt(p.x - 45, p.z - 25), z: p.z - 25, label: 'Play basketball', radius: 7, action: 'play' });
      }
    }
  }

  /** Re-emit a sub-batch translated into world space. */
  emitLocal(batcher, sub, x, y, z, rot) {
    for (const [mat, list] of sub.groups) {
      for (const g of list) {
        if (rot) g.rotateY(rot);
        g.translate(x, y, z);
        batcher.add(mat, g);
      }
    }
    sub.groups.clear();
  }

  addTreeTo(group, kindIndex, bucket, x, y, z, rng) {
    const t = Props.treeGeometry(kindIndex, bucket);
    const mats = Props.treeMaterials(kindIndex);
    const scale = rng.range(0.85, 1.2);
    const rot = rng() * TAU;
    const trunk = mergeGeometries(t.trunk.map((g) => g.clone()));
    const leaves = mergeGeometries(t.leaves.map((g) => {
      const c = g.clone();
      if (!c.attributes.uv) {
        const uv = new Float32Array(c.attributes.position.count * 2);
        for (let i = 0; i < c.attributes.position.count; i++) { uv[i * 2] = c.attributes.position.getX(i) * 0.25; uv[i * 2 + 1] = c.attributes.position.getY(i) * 0.25; }
        c.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      }
      if (!c.attributes.normal) c.computeVertexNormals();
      return c;
    }));
    const tm = new THREE.Mesh(trunk, mats.bark);
    const lm = new THREE.Mesh(leaves, mats.leaf);
    tm.castShadow = lm.castShadow = settings.preset.shadows;
    tm.receiveShadow = lm.receiveShadow = true;
    const holder = new THREE.Group();
    holder.add(tm); holder.add(lm);
    holder.position.set(x, y, z);
    holder.rotation.y = rot;
    holder.scale.setScalar(scale);
    holder.userData.isTree = true;
    group.add(holder);
  }

  buildNatureInChunk(group, x0, z0, rng) {
    const district = this.city.districtAt(x0 + CHUNK_SIZE / 2, z0 + CHUNK_SIZE / 2);
    if (district !== 'forest' && district !== 'countryside') return;
    const count = Math.round((district === 'forest' ? 34 : 9) * settings.preset.treeDensity);
    for (let i = 0; i < count; i++) {
      const x = x0 + rng() * CHUNK_SIZE, z = z0 + rng() * CHUNK_SIZE;
      if (this.city.isOnRoad(x, z, 6)) continue;
      const y = this.groundAt(x, z);
      if (y < WATER_LEVEL) continue;
      this.addTreeTo(group, district === 'forest' ? (rng.chance(0.6) ? 2 : rng.int(0, 5)) : rng.int(0, 5), rng.int(1, 3), x, y, z, rng);
    }
  }

  // =========================================================================
  // Registries
  // =========================================================================
  hashKey(x, z) { return Math.floor(x / 20) + ':' + Math.floor(z / 20); }

  registerInteractable(it) {
    this.interactables.push(it);
    const k = this.hashKey(it.x, it.z);
    let list = this.interactHash.get(k);
    if (!list) { list = []; this.interactHash.set(k, list); }
    list.push(it);
  }
  unregisterInteractable(it) {
    const i = this.interactables.indexOf(it);
    if (i >= 0) this.interactables.splice(i, 1);
    const list = this.interactHash.get(this.hashKey(it.x, it.z));
    if (list) { const j = list.indexOf(it); if (j >= 0) list.splice(j, 1); }
  }
  registerCollider(c) {
    // Cache the collider's base height so it can act as a walkable surface.
    if (c.baseY == null) c.baseY = this.groundAt(c.x, c.z);
    this.colliders.push(c);
    const k = this.hashKey(c.x, c.z);
    let list = this.colliderHash.get(k);
    if (!list) { list = []; this.colliderHash.set(k, list); }
    list.push(c);
  }
  unregisterCollider(c) {
    const i = this.colliders.indexOf(c);
    if (i >= 0) this.colliders.splice(i, 1);
    const list = this.colliderHash.get(this.hashKey(c.x, c.z));
    if (list) { const j = list.indexOf(c); if (j >= 0) list.splice(j, 1); }
  }

  /** Nearest interactable within range of a position and facing direction. */
  findInteractable(x, y, z, dirX, dirZ, maxDist) {
    let best = null, bestScore = -Infinity;
    const range = maxDist || 3.2;
    const cells = Math.ceil(range / 20) + 1;
    const cx = Math.floor(x / 20), cz = Math.floor(z / 20);
    for (let i = -cells; i <= cells; i++) {
      for (let j = -cells; j <= cells; j++) {
        const list = this.interactHash.get((cx + i) + ':' + (cz + j));
        if (!list) continue;
        for (const it of list) {
          const dx = it.x - x, dz = it.z - z;
          const d = Math.hypot(dx, dz);
          const reach = (it.radius || 1.5) + range * 0.5;
          if (d > reach) continue;
          if (Math.abs((it.y || 0) - y) > 4) continue;
          const dot = d > 0.01 ? (dx / d) * dirX + (dz / d) * dirZ : 1;
          if (dot < 0.15 && d > 1.2) continue;
          const score = dot * 2 - d * 0.5;
          if (score > bestScore) { bestScore = score; best = it; }
        }
      }
    }
    return best;
  }

  /**
   * Height of whatever is holding you up at (x, z): the terrain, or the top of
   * a building you're standing on. `fromY` is the current height, so you only
   * land on surfaces at or below you.
   */
  supportAt(x, z, fromY) {
    let best = this.groundAt(x, z);
    const cx = Math.floor(x / 20), cz = Math.floor(z / 20);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const list = this.colliderHash.get((cx + i) + ':' + (cz + j));
        if (!list) continue;
        for (const c of list) {
          const top = (c.baseY || 0) + (c.h || 0);
          if (top <= best || top > fromY + 0.35) continue;
          const dx = x - c.x, dz = z - c.z;
          const cs = Math.cos(-(c.rot || 0)), sn = Math.sin(-(c.rot || 0));
          const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
          if (Math.abs(lx) < c.w * 0.5 && Math.abs(lz) < c.d * 0.5) best = top;
        }
      }
    }
    return best;
  }

  /** Push a circle out of any building/vehicle collider it overlaps. */
  resolveCollision(pos, radius) {
    const cells = 2;
    const cx = Math.floor(pos.x / 20), cz = Math.floor(pos.z / 20);
    let hit = false;
    for (let i = -cells; i <= cells; i++) {
      for (let j = -cells; j <= cells; j++) {
        const list = this.colliderHash.get((cx + i) + ':' + (cz + j));
        if (!list) continue;
        for (const c of list) {
          if (c.hollow) continue;
          if (pos.y > (c.h || 6) + 0.5) continue;
          const dx = pos.x - c.x, dz = pos.z - c.z;
          const cs = Math.cos(-(c.rot || 0)), sn = Math.sin(-(c.rot || 0));
          const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
          const hw = c.w * 0.5 + radius, hd = c.d * 0.5 + radius;
          // Standing on top of it isn't a collision.
          if (pos.y > (c.baseY || 0) + (c.h || 0) - 0.25) continue;
          if (Math.abs(lx) < hw && Math.abs(lz) < hd) {
            // Push out along the shallowest axis.
            const penX = hw - Math.abs(lx), penZ = hd - Math.abs(lz);
            let nlx = lx, nlz = lz;
            if (penX < penZ) nlx = Math.sign(lx || 1) * hw;
            else nlz = Math.sign(lz || 1) * hd;
            const cs2 = Math.cos(c.rot || 0), sn2 = Math.sin(c.rot || 0);
            pos.x = c.x + nlx * cs2 - nlz * sn2;
            pos.z = c.z + nlx * sn2 + nlz * cs2;
            hit = true;
          }
        }
      }
    }
    return hit;
  }

  // =========================================================================
  // Lights
  // =========================================================================
  updateLights(focusX, focusZ) {
    const max = settings.preset.maxDynamicLights;
    // Collect nearby light specs from loaded chunks.
    const candidates = [];
    for (const chunk of this.chunks.values()) {
      const dx = chunk.centerX - focusX, dz = chunk.centerZ - focusZ;
      if (Math.hypot(dx, dz) > 130) continue;
      for (const l of chunk.lights) {
        const d = Math.hypot(l.x - focusX, l.z - focusZ);
        if (d < 60) candidates.push({ l, d });
      }
    }
    candidates.sort((a, b) => a.d - b.d);
    const want = Math.min(max, candidates.length);
    while (this.activeLights.length < want) {
      const pl = new THREE.PointLight(0xffffff, 0, 20, 2);
      pl.castShadow = false;
      this.root.add(pl);
      this.activeLights.push(pl);
    }
    for (let i = 0; i < this.activeLights.length; i++) {
      const pl = this.activeLights[i];
      if (i < want) {
        const { l } = candidates[i];
        pl.position.set(l.x, l.y, l.z);
        pl.color.setHex(l.color);
        const nightScale = l.streetLight || l.beacon ? this.nightFactor : lerpv(0.35, 1, this.nightFactor);
        pl.intensity = l.intensity * nightScale * 2.2;
        pl.distance = l.distance;
        pl.visible = pl.intensity > 0.02;
      } else {
        pl.visible = false;
        pl.intensity = 0;
      }
    }
  }

  updateTrafficLights() {
    for (const chunk of this.chunks.values()) {
      for (const tl of chunk.trafficLights) {
        const green = tl.axis === 'ns' ? tl.node.nsGreen : !tl.node.nsGreen;
        const amber = tl.node.amber;
        tl.lenses[0].material.emissiveIntensity = (!green && !amber) ? 2.4 : 0.02;
        tl.lenses[1].material.emissiveIntensity = amber ? 2.4 : 0.02;
        tl.lenses[2].material.emissiveIntensity = (green && !amber) ? 2.4 : 0.02;
      }
    }
  }

  setNightFactor(f) {
    this.nightFactor = clamp01(f);
    setFacadeNightFactor(this.nightFactor);
  }
  setWetness(w) {
    this.wetness = clamp01(w);
    setWetness(this.wetness);
  }

  /** Spawn a standalone prop at runtime — used by T10 commands. */
  spawnProp(kind, x, z, opts) {
    opts = opts || {};
    const rng = makeRng((Math.random() * 0xffffffff) >>> 0);
    const y = this.groundAt(x, z);
    const batcher = new GeometryBatcher();
    const out = { lights: [] };
    const group = new THREE.Group();
    let label = kind, radius = 1.5, action = 'inspect';
    switch (kind) {
      case 'bench': Props.addBench(batcher, 0, 0, opts.rot || 0); label = 'Sit'; action = 'sit'; radius = 1.6; break;
      case 'tree': this.addTreeTo(group, opts.treeKind != null ? opts.treeKind : rng.int(0, 5), rng.int(1, 3), 0, 0, 0, rng); label = 'Tree'; radius = 1.8; break;
      case 'streetlight': Props.addStreetLight(batcher, 0, 0, opts.rot || 0, out); label = 'Street light'; radius = 1.2; break;
      case 'bin': case 'trashcan': Props.addTrashCan(batcher, 0, 0); label = 'Search bin'; action = 'search'; break;
      case 'hydrant': Props.addHydrant(batcher, 0, 0); label = 'Fire hydrant'; break;
      case 'atm': Props.addATM(batcher, 0, 0, opts.rot || 0, out); label = 'Use ATM'; action = 'atm'; radius = 1.8; break;
      case 'fountain': Props.addFountain(batcher, 0, 0, out); label = 'Fountain'; radius = 4; break;
      case 'table': case 'picnictable': Props.addPicnicTable(batcher, 0, 0, opts.rot || 0); label = 'Sit'; action = 'sit'; radius = 1.8; break;
      case 'playground': Props.addPlayground(batcher, 0, 0, rng); label = 'Playground'; radius = 7; break;
      case 'court': case 'basketball': Props.addBasketballCourt(batcher, 0, 0, opts.rot || 0); label = 'Play basketball'; action = 'play'; radius = 7; break;
      case 'rock': Props.addRock(batcher, 0, 0, 0, opts.scale || rng.range(0.4, 1.4), rng); label = 'Rock'; break;
      case 'busstop': Props.addBusStop(batcher, 0, 0, opts.rot || 0, out); label = 'Wait for bus'; action = 'bus'; radius = 2.6; break;
      case 'mailbox': Props.addMailbox(batcher, 0, 0, opts.rot || 0); label = 'Mailbox'; break;
      case 'planter': Props.addPlanter(batcher, 0, 0, rng); label = 'Planter'; break;
      case 'fence': Props.addFence(batcher, -4, 0, 4, 0, opts.color); label = 'Fence'; radius = 4; break;
      case 'cone': case 'trafficcone': Props.addTrafficCone(batcher, 0, 0); label = 'Traffic cone'; radius = 0.8; break;
      case 'barrier': Props.addBarrier(batcher, 0, 0, opts.rot || 0); label = 'Barrier'; radius = 2.2; break;
      case 'dumpster': Props.addDumpster(batcher, 0, 0, opts.rot || 0); label = 'Search dumpster'; action = 'search'; radius = 2; break;
      case 'crate': case 'box': Props.addCrate(batcher, 0, 0, opts.rot || 0, opts.scale); label = 'Crate'; action = 'search'; break;
      case 'barrel': Props.addBarrel(batcher, 0, 0, opts.color); label = 'Barrel'; break;
      case 'pallet': Props.addPallet(batcher, 0, 0, opts.rot || 0); label = 'Pallet'; break;
      case 'bollard': Props.addBollard(batcher, 0, 0); label = 'Bollard'; radius = 0.8; break;
      case 'statue': Props.addStatue(batcher, 0, 0, opts.rot || 0); label = 'Statue'; radius = 2.4; break;
      case 'flagpole': case 'flag': Props.addFlagpole(batcher, 0, 0); label = 'Flagpole'; radius = 1.2; break;
      case 'vending': case 'vendingmachine': Props.addVendingMachine(batcher, 0, 0, opts.rot || 0, out); label = 'Use vending machine'; action = 'vend'; radius = 1.6; break;
      case 'newsbox': case 'newspaper': Props.addNewsBox(batcher, 0, 0, opts.rot || 0); label = 'Newspaper box'; break;
      case 'bikerack': Props.addBikeRack(batcher, 0, 0, opts.rot || 0); label = 'Bike rack'; radius = 2; break;
      case 'phonebooth': case 'phone': Props.addPhoneBooth(batcher, 0, 0, opts.rot || 0, out); label = 'Use payphone'; action = 'phone'; radius = 1.5; break;
      case 'tent': Props.addTent(batcher, 0, 0, opts.rot || 0, opts.color); label = 'Tent'; radius = 2; break;
      case 'campfire': case 'fire': Props.addCampfire(batcher, 0, 0, out); label = 'Campfire'; radius = 1.6; break;
      case 'umbrella': case 'parasol': Props.addUmbrella(batcher, 0, 0, opts.color); label = 'Umbrella'; radius = 1.6; break;
      case 'ladder': Props.addLadder(batcher, 0, 0, opts.rot || 0, opts.height); label = 'Climb ladder'; action = 'climb'; radius = 1.2; break;
      case 'generator': Props.addGenerator(batcher, 0, 0, opts.rot || 0); label = 'Generator'; radius = 1.4; break;
      case 'dish': case 'satellite': Props.addSatelliteDish(batcher, 0, 0, opts.rot || 0); label = 'Satellite dish'; radius = 1.4; break;
      case 'sign': case 'streetsign': Props.addStreetSign(batcher, 0, 0, opts.rot || 0, opts.color); label = 'Street sign'; break;
      case 'pottedtree': case 'pottedplant': Props.addPottedTree(batcher, 0, 0, rng); label = 'Potted tree'; radius = 1.2; break;
      case 'solarpanel': case 'solar': Props.addSolarPanel(batcher, 0, 0, opts.rot || 0); label = 'Solar panel'; radius = 1.6; break;
      case 'boat': Props.addBoat(batcher, 0, 0, opts.rot || 0, opts.color); label = 'Boat'; radius = 3; break;
      default: return null;
    }
    batcher.build(group, {});
    group.position.set(x, y, z);
    this.root.add(group);
    const rec = {
      kind, group, x, y, z,
      interactable: { type: kind, x, y, z, label, radius, action, spawned: true },
    };
    this.registerInteractable(rec.interactable);
    for (const l of out.lights) {
      const spec = { ...l, x: l.x + x, y: l.y + y, z: l.z + z };
      const anyChunk = this.chunkAt(x, z);
      if (anyChunk) anyChunk.lights.push(spec);
    }
    this.spawnedProps.push(rec);
    return rec;
  }

  removeProp(rec) {
    const i = this.spawnedProps.indexOf(rec);
    if (i >= 0) this.spawnedProps.splice(i, 1);
    this.unregisterInteractable(rec.interactable);
    disposeGroup(rec.group);
  }

  removeNearestProp(x, z, maxDist) {
    let best = null, bd = maxDist || 12;
    for (const p of this.spawnedProps) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) { this.removeProp(best); return best; }
    return null;
  }

  clearSpawnedProps() {
    const n = this.spawnedProps.length;
    while (this.spawnedProps.length) this.removeProp(this.spawnedProps[0]);
    return n;
  }

  chunkAt(x, z) {
    return this.chunks.get(this.chunkKey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)));
  }

  /** A safe place to stand: on a sidewalk, above water, clear of colliders. */
  findSpawnPoint(nearX, nearZ) {
    const sw = this.city.nearestSidewalk(nearX == null ? -40 : nearX, nearZ == null ? 60 : nearZ);
    const p = new THREE.Vector3(sw.x, 0, sw.z);
    for (let i = 0; i < 12; i++) {
      p.y = this.groundAt(p.x, p.z) + 1;
      if (!this.resolveCollision(p, 0.45) && !this.isWater(p.x, p.z)) break;
      p.x += (Math.random() - 0.5) * 6;
      p.z += (Math.random() - 0.5) * 6;
    }
    p.y = this.groundAt(p.x, p.z);
    return p;
  }

  stats() {
    let tris = 0;
    for (const chunk of this.chunks.values()) {
      chunk.group.traverse((o) => { if (o.isMesh && o.geometry.index) tris += o.geometry.index.count / 3; });
    }
    return {
      chunks: this.chunks.size,
      queued: this.buildQueue.length,
      interactables: this.interactables.length,
      colliders: this.colliders.length,
      triangles: Math.round(tris),
      city: this.city.stats(),
    };
  }

  dispose() {
    for (const key of [...this.chunks.keys()]) this.disposeChunk(key);
    disposeGroup(this.root);
  }
}

const TREE_INDEX_MAX = Props.TREE_KINDS.length - 1;
