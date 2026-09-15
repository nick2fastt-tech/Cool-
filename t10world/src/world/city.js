// T10 World - city layout. Generates the road graph, blocks, lots and landmarks
// deterministically from a seed. Everything downstream (buildings, traffic,
// pedestrian routing, T10 teleports) reads from this.
import { makeRng, clamp01, clampv, lerpv, distToSeg2D, hashString } from '../core/math.js';

export const WORLD_RADIUS = 1200;          // half-extent of the playable map
export const CITY_RADIUS = 630;            // gridded urban area
export const BLOCK_SIZE = 90;
export const HIGHWAY_RING = 770;
export const SHORE_Z = 640;                // beach starts here, ocean beyond
export const WATER_LEVEL = -1.4;

export const ROAD_TYPES = {
  alley:   { width: 7,  lanes: 2, speed: 7,  sidewalk: 1.4, material: 'alley' },
  street:  { width: 12, lanes: 2, speed: 12, sidewalk: 3.6, material: 'two_lane' },
  avenue:  { width: 19, lanes: 4, speed: 16, sidewalk: 4.4, material: 'four_lane' },
  highway: { width: 27, lanes: 6, speed: 31, sidewalk: 0,   material: 'highway' },
};

export const DISTRICTS = {
  downtown:     { name: 'Downtown',            minH: 34, maxH: 130, density: 1.0, style: [0, 1, 7, 2] },
  midrise:      { name: 'Midtown',             minH: 16, maxH: 44,  density: 0.95, style: [1, 2, 7, 4] },
  apartments:   { name: 'Apartment Row',       minH: 12, maxH: 30,  density: 0.9, style: [3, 4, 2, 6] },
  commercial:   { name: 'Shopping District',   minH: 7,  maxH: 18,  density: 0.95, style: [9, 5, 6, 1] },
  residential:  { name: 'Residential',         minH: 4,  maxH: 9,   density: 0.7, style: [10, 11, 5, 6] },
  suburb:       { name: 'Suburbs',             minH: 4,  maxH: 8,   density: 0.5, style: [10, 11, 5] },
  industrial:   { name: 'Industrial Zone',     minH: 7,  maxH: 16,  density: 0.6, style: [8, 2, 9] },
  civic:        { name: 'Civic Centre',        minH: 9,  maxH: 24,  density: 0.7, style: [2, 1, 5] },
  park:         { name: 'Park',                minH: 0,  maxH: 0,   density: 0.0, style: [] },
  sports:       { name: 'Sports Complex',      minH: 6,  maxH: 18,  density: 0.35, style: [8, 2] },
  beach:        { name: 'Beachfront',          minH: 4,  maxH: 11,  density: 0.35, style: [5, 6, 9] },
  countryside:  { name: 'Countryside',         minH: 4,  maxH: 9,   density: 0.14, style: [11, 10, 8] },
  forest:       { name: 'Forest',              minH: 0,  maxH: 0,   density: 0.02, style: [11] },
};

/** Named buildings placed at fixed spots so the world has real landmarks. */
const LANDMARK_PLAN = [
  { name: 'T10 Tower',            type: 'tower',      x: 0,     z: -40,  w: 62, d: 62, h: 148, district: 'downtown' },
  { name: 'City Hospital',        type: 'hospital',   x: -320,  z: 210,  w: 92, d: 70, h: 30, district: 'civic' },
  { name: 'Central Police Dept',  type: 'police',     x: 250,   z: 215,  w: 74, d: 58, h: 20, district: 'civic' },
  { name: 'Fire Station 7',       type: 'fire',       x: 335,   z: -175, w: 58, d: 46, h: 14, district: 'civic' },
  { name: 'Northside High',       type: 'school',     x: -240,  z: -395, w: 118, d: 78, h: 16, district: 'civic' },
  { name: 'Riverside Elementary', type: 'school',     x: 415,   z: -420, w: 88, d: 62, h: 12, district: 'civic' },
  { name: 'Grand Central Mall',   type: 'mall',       x: 300,   z: 20,   w: 128, d: 96, h: 22, district: 'commercial' },
  { name: 'Union Station',        type: 'station',    x: -150,  z: 150,  w: 96, d: 64, h: 26, district: 'civic' },
  { name: 'Harbour Stadium',      type: 'stadium',    x: 620,   z: 300,  w: 168, d: 138, h: 34, district: 'sports' },
  { name: 'Westfield Power Plant',type: 'industrial', x: -690,  z: 120,  w: 140, d: 110, h: 44, district: 'industrial' },
  { name: 'Municipal Library',    type: 'civic',      x: -60,   z: 245,  w: 64, d: 48, h: 18, district: 'civic' },
  { name: 'The Old Church',       type: 'church',     x: 150,   z: -300, w: 40, d: 62, h: 34, district: 'residential' },
];

const AMENITY_PLAN = [
  { name: 'Fuel Stop North',  type: 'gas',   x: -455, z: -250 },
  { name: 'Fuel Stop East',   type: 'gas',   x: 490,  z: 95 },
  { name: 'Fuel Stop South',  type: 'gas',   x: 60,   z: 505 },
  { name: 'Harbour Diner',    type: 'diner', x: 205,  z: 470 },
  { name: 'Corner Coffee',    type: 'cafe',  x: -110, z: 60 },
  { name: 'Late Night Mart',  type: 'store', x: 180,  z: -110 },
  { name: 'Sunset Bar',       type: 'bar',   x: -215, z: 335 },
  { name: 'Eastside Gym',     type: 'gym',   x: 405,  z: 205 },
  { name: 'Pier Arcade',      type: 'arcade', x: -40, z: 560 },
];

export class CityLayout {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed);
    this.roads = [];
    this.nodes = [];
    this.nodeIndex = new Map();
    this.blocks = [];
    this.lots = [];
    this.landmarks = [];
    this.parks = [];
    this.roadHash = new Map();
    this.lotHash = new Map();
    this.build();
  }

  // -------------------------------------------------------------------------
  build() {
    this.buildRoads();
    this.buildBlocks();
    this.buildLots();
    this.indexRoads();
    this.indexLots();
    this.buildNodes();
  }

  gridCoords() {
    const coords = [];
    for (let v = -CITY_RADIUS; v <= CITY_RADIUS; v += BLOCK_SIZE) coords.push(v);
    return coords;
  }

  roadTypeForIndex(i, total) {
    // Every third grid line is an avenue; the middle line is the main drag.
    const mid = Math.floor(total / 2);
    if (i === mid) return 'avenue';
    return i % 3 === 0 ? 'avenue' : 'street';
  }

  addRoad(ax, az, bx, bz, type, name) {
    const t = ROAD_TYPES[type];
    const road = {
      id: this.roads.length, ax, az, bx, bz, type, name: name || null,
      width: t.width, lanes: t.lanes, speed: t.speed, sidewalk: t.sidewalk,
      material: t.material,
      dx: bx - ax, dz: bz - az,
    };
    road.length = Math.hypot(road.dx, road.dz);
    road.ux = road.dx / (road.length || 1);
    road.uz = road.dz / (road.length || 1);
    road.horizontal = Math.abs(road.dx) > Math.abs(road.dz);
    this.roads.push(road);
    return road;
  }

  buildRoads() {
    const coords = this.gridCoords();
    const n = coords.length;
    const streetNames = ['Ash', 'Birch', 'Cedar', 'Dune', 'Elm', 'Fir', 'Grove', 'Harbour', 'Iris',
      'Juniper', 'Kestrel', 'Laurel', 'Maple', 'Nettle', 'Orchard'];

    // 1st, 2nd, 3rd, 4th — not "2th Street".
    const ordinal = (k) => {
      const rem100 = k % 100;
      if (rem100 >= 11 && rem100 <= 13) return k + 'th';
      switch (k % 10) {
        case 1: return k + 'st';
        case 2: return k + 'nd';
        case 3: return k + 'rd';
        default: return k + 'th';
      }
    };

    for (let i = 0; i < n; i++) {
      const v = coords[i];
      const type = this.roadTypeForIndex(i, n);
      // East-west
      this.addRoad(-CITY_RADIUS, v, CITY_RADIUS, v, type,
        (streetNames[i % streetNames.length]) + (type === 'avenue' ? ' Avenue' : ' Street'));
      // North-south
      this.addRoad(v, -CITY_RADIUS, v, CITY_RADIUS, type,
        ordinal(i + 1) + (type === 'avenue' ? ' Avenue' : ' Street'));
    }

    // Highway ring.
    const R = HIGHWAY_RING;
    this.addRoad(-R, -R, R, -R, 'highway', 'North Beltway');
    this.addRoad(R, -R, R, R, 'highway', 'East Beltway');
    this.addRoad(R, R, -R, R, 'highway', 'South Beltway');
    this.addRoad(-R, R, -R, -R, 'highway', 'West Beltway');
    // Connectors from the grid out to the ring.
    for (const v of [-450, -180, 180, 450]) {
      this.addRoad(v, -CITY_RADIUS, v, -R, 'avenue', 'North Connector');
      this.addRoad(v, CITY_RADIUS, v, R, 'avenue', 'South Connector');
      this.addRoad(-CITY_RADIUS, v, -R, v, 'avenue', 'West Connector');
      this.addRoad(CITY_RADIUS, v, R, v, 'avenue', 'East Connector');
    }
    // Country roads beyond the ring.
    this.addRoad(-R, -300, -WORLD_RADIUS + 60, -520, 'street', 'Old Mill Road');
    this.addRoad(-R, 300, -WORLD_RADIUS + 60, 460, 'street', 'Farm Road');
    this.addRoad(300, -R, 520, -WORLD_RADIUS + 60, 'street', 'Pine Ridge Road');
    this.addRoad(-300, R, -420, SHORE_Z + 120, 'street', 'Shore Drive');
    this.addRoad(400, R, 520, SHORE_Z + 100, 'street', 'Marina Way');
  }

  /** District for a world position, before lots are placed. */
  districtAt(x, z) {
    const r = Math.max(Math.abs(x), Math.abs(z));
    if (z > SHORE_Z + 60) return 'beach';
    if (z > SHORE_Z - 90) return 'beach';
    if (z < -820) return 'forest';
    if (x < -820 && z < 200) return 'countryside';
    if (x > 820 || z > 820 || x < -820 || z < -820) return 'countryside';

    // Fixed zones inside the ring.
    if (x > 470 && z > 180 && z < 470) return 'sports';
    if (x < -520 && Math.abs(z) < 330) return 'industrial';
    if (this.inPark(x, z)) return 'park';
    if (r < 190) return 'downtown';
    if (r < 330) return 'midrise';
    if (r < 430) return (x > 0 && z > -60) ? 'commercial' : 'apartments';
    if (r < 560) return (Math.abs(x) > Math.abs(z)) ? 'residential' : 'commercial';
    if (r <= CITY_RADIUS + 30) return 'residential';
    return 'suburb';
  }

  inPark(x, z) {
    for (const p of this.parkAreas()) {
      if (x > p.x - p.w / 2 && x < p.x + p.w / 2 && z > p.z - p.d / 2 && z < p.z + p.d / 2) return true;
    }
    return false;
  }

  parkAreas() {
    if (this._parks) return this._parks;
    this._parks = [
      { name: 'Central Park', x: -300, z: -230, w: 260, d: 175 },
      { name: 'Riverside Green', x: 250, z: 390, w: 175, d: 90 },
      { name: 'Hillcrest Park', x: 430, z: -330, w: 90, d: 175 },
      { name: 'Memorial Square', x: -110, z: -110, w: 90, d: 90 },
      { name: 'Dog Run', x: -470, z: 430, w: 90, d: 90 },
    ];
    return this._parks;
  }

  buildBlocks() {
    const coords = this.gridCoords();
    for (let i = 0; i < coords.length - 1; i++) {
      for (let j = 0; j < coords.length - 1; j++) {
        const x0 = coords[i], x1 = coords[i + 1];
        const z0 = coords[j], z1 = coords[j + 1];
        const ta = ROAD_TYPES[this.roadTypeForIndex(i, coords.length)];
        const tb = ROAD_TYPES[this.roadTypeForIndex(i + 1, coords.length)];
        const tc = ROAD_TYPES[this.roadTypeForIndex(j, coords.length)];
        const td = ROAD_TYPES[this.roadTypeForIndex(j + 1, coords.length)];
        const insetXa = ta.width / 2 + ta.sidewalk;
        const insetXb = tb.width / 2 + tb.sidewalk;
        const insetZa = tc.width / 2 + tc.sidewalk;
        const insetZb = td.width / 2 + td.sidewalk;
        const bx0 = x0 + insetXa, bx1 = x1 - insetXb;
        const bz0 = z0 + insetZa, bz1 = z1 - insetZb;
        const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
        this.blocks.push({
          x: cx, z: cz, w: bx1 - bx0, d: bz1 - bz0,
          x0: bx0, x1: bx1, z0: bz0, z1: bz1,
          district: this.districtAt(cx, cz),
          seed: (hashString('block' + i + '_' + j) ^ this.seed) >>> 0,
        });
      }
    }
    // Rural blocks outside the grid, sparsely built.
    const rng = makeRng(this.seed ^ 0x51ed);
    for (let i = 0; i < 90; i++) {
      const ang = rng() * Math.PI * 2;
      const rad = lerpv(CITY_RADIUS + 130, WORLD_RADIUS - 110, Math.sqrt(rng()));
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      if (z > SHORE_Z - 60) continue;
      const d = this.districtAt(x, z);
      if (d === 'forest') continue;
      this.blocks.push({
        x, z, w: rng.range(50, 96), d: rng.range(50, 96),
        x0: x - 40, x1: x + 40, z0: z - 40, z1: z + 40,
        district: d, rural: true,
        seed: (hashString('rural' + i) ^ this.seed) >>> 0,
      });
    }
  }

  buildLots() {
    // Landmarks claim their footprints first so nothing overlaps them.
    for (const lm of LANDMARK_PLAN) {
      const lot = {
        x: lm.x, z: lm.z, w: lm.w, d: lm.d, rot: 0,
        district: lm.district, kind: lm.type, height: lm.h,
        name: lm.name, landmark: true,
        seed: hashString(lm.name) >>> 0,
      };
      this.lots.push(lot);
      this.landmarks.push({ name: lm.name, x: lm.x, z: lm.z, type: lm.type, lot });
    }
    for (const am of AMENITY_PLAN) {
      const lot = {
        x: am.x, z: am.z, w: am.type === 'gas' ? 46 : 32, d: am.type === 'gas' ? 38 : 26, rot: 0,
        district: this.districtAt(am.x, am.z), kind: am.type, height: am.type === 'gas' ? 6 : 8,
        name: am.name, landmark: true, amenity: true,
        seed: hashString(am.name) >>> 0,
      };
      this.lots.push(lot);
      this.landmarks.push({ name: am.name, x: am.x, z: am.z, type: am.type, lot });
    }
    for (const p of this.parkAreas()) this.landmarks.push({ name: p.name, x: p.x, z: p.z, type: 'park' });

    // Fill the remaining blocks.
    for (const block of this.blocks) {
      if (block.district === 'park' || block.district === 'forest') { this.parks.push(block); continue; }
      if (this.blockBlockedByLandmark(block)) continue;
      this.fillBlock(block);
    }
  }

  blockBlockedByLandmark(block) {
    for (const lm of this.lots) {
      if (!lm.landmark) continue;
      if (Math.abs(lm.x - block.x) < (lm.w + block.w) * 0.5 &&
          Math.abs(lm.z - block.z) < (lm.d + block.d) * 0.5) return true;
    }
    return false;
  }

  fillBlock(block) {
    const rng = makeRng(block.seed);
    const dist = DISTRICTS[block.district] || DISTRICTS.residential;
    if (dist.density <= 0) return;

    const pushLot = (x, z, w, d, rot, kindHint) => {
      const kind = kindHint || this.kindForDistrict(block.district, rng);
      const h = lerpv(dist.minH, dist.maxH, Math.pow(rng(), block.district === 'downtown' ? 0.7 : 1.4));
      this.lots.push({
        x, z, w, d, rot,
        district: block.district, kind,
        height: Math.max(3.2, h),
        styleIndex: dist.style.length ? dist.style[rng.int(0, dist.style.length - 1)] : 2,
        seed: (rng() * 0xffffffff) >>> 0,
        block,
      });
    };

    if (block.district === 'downtown' || block.district === 'midrise') {
      // One or two big footprints per block with a small setback.
      if (rng.chance(0.55) && block.w > 60) {
        const halfW = block.w * 0.5 - 2;
        pushLot(block.x - block.w * 0.25, block.z, halfW * 0.92, block.d - 4, 0);
        pushLot(block.x + block.w * 0.25, block.z, halfW * 0.92, block.d - 4, 0);
      } else {
        pushLot(block.x, block.z, block.w - 4, block.d - 4, 0);
      }
    } else if (block.district === 'apartments') {
      const cols = rng.int(2, 3);
      const w = (block.w - 6) / cols;
      for (let i = 0; i < cols; i++) {
        pushLot(block.x0 + w * (i + 0.5) + 3, block.z, w - 3, block.d * rng.range(0.6, 0.85), 0);
      }
    } else if (block.district === 'commercial' || block.district === 'beach') {
      // Shop strips fronting each street edge.
      const depth = Math.min(26, block.d * 0.36);
      for (const side of [-1, 1]) {
        const count = Math.max(2, Math.round(block.w / rng.range(16, 26)));
        const w = (block.w - 4) / count;
        for (let i = 0; i < count; i++) {
          if (rng.chance(0.08)) continue;
          pushLot(block.x0 + 2 + w * (i + 0.5), block.z + side * (block.d * 0.5 - depth * 0.5), w - 1.2, depth, 0,
            rng.weighted([['shop', 5], ['restaurant', 2], ['cafe', 1], ['office', 1]]));
        }
      }
    } else if (block.district === 'industrial') {
      const count = rng.int(1, 2);
      for (let i = 0; i < count; i++) {
        const w = (block.w - 8) / count;
        pushLot(block.x0 + 4 + w * (i + 0.5), block.z, w - 4, block.d * rng.range(0.65, 0.9), 0, 'warehouse');
      }
    } else if (block.district === 'sports') {
      pushLot(block.x, block.z, block.w * 0.7, block.d * 0.55, 0, 'gym');
    } else {
      // Houses around the block perimeter with back gardens.
      const lotW = rng.range(19, 25);
      const perSide = Math.max(1, Math.floor((block.w - 6) / lotW));
      const actualW = (block.w - 6) / perSide;
      const depth = Math.min(block.d * 0.40, 22);
      for (const side of [-1, 1]) {
        for (let i = 0; i < perSide; i++) {
          if (rng.chance(block.district === 'suburb' || block.rural ? 0.45 : 0.10)) continue;
          const hw = actualW * rng.range(0.62, 0.82);
          pushLot(
            block.x0 + 3 + actualW * (i + 0.5),
            block.z + side * (block.d * 0.5 - depth * 0.5 - 1),
            hw, depth * rng.range(0.7, 0.95),
            rng.range(-0.03, 0.03),
            'house'
          );
        }
      }
      // A couple of houses on the short edges of deep blocks.
      if (block.d > 62) {
        for (const side of [-1, 1]) {
          if (rng.chance(0.4)) continue;
          pushLot(block.x + side * (block.w * 0.5 - 11), block.z, 17, 19, 0, 'house');
        }
      }
    }
  }

  kindForDistrict(d, rng) {
    switch (d) {
      case 'downtown': return rng.weighted([['tower', 6], ['office', 4], ['hotel', 1]]);
      case 'midrise': return rng.weighted([['office', 5], ['apartment', 4], ['hotel', 1]]);
      case 'apartments': return 'apartment';
      case 'commercial': return rng.weighted([['shop', 5], ['restaurant', 2], ['office', 2]]);
      case 'industrial': return 'warehouse';
      case 'beach': return rng.weighted([['shop', 2], ['restaurant', 2], ['house', 2]]);
      case 'countryside': return rng.weighted([['house', 3], ['barn', 2]]);
      default: return 'house';
    }
  }

  // -------------------------------------------------------------------------
  // Spatial indexes
  // -------------------------------------------------------------------------
  cellKey(x, z, size) { return Math.floor(x / size) + ':' + Math.floor(z / size); }

  indexRoads() {
    const CELL = 120;
    for (const r of this.roads) {
      const steps = Math.max(1, Math.ceil(r.length / CELL));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = r.ax + r.dx * t, z = r.az + r.dz * t;
        for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
          const k = this.cellKey(x + ox * CELL, z + oz * CELL, CELL);
          let list = this.roadHash.get(k);
          if (!list) { list = new Set(); this.roadHash.set(k, list); }
          list.add(r);
        }
      }
    }
    this.roadCell = CELL;
  }

  indexLots() {
    const CELL = 100;
    for (const l of this.lots) {
      const k = this.cellKey(l.x, l.z, CELL);
      let list = this.lotHash.get(k);
      if (!list) { list = []; this.lotHash.set(k, list); }
      list.push(l);
    }
    this.lotCell = CELL;
  }

  buildNodes() {
    // Grid intersections become traffic nodes; avenues get signals.
    const coords = this.gridCoords();
    for (let i = 0; i < coords.length; i++) {
      for (let j = 0; j < coords.length; j++) {
        const x = coords[i], z = coords[j];
        const ti = this.roadTypeForIndex(i, coords.length);
        const tj = this.roadTypeForIndex(j, coords.length);
        const major = ti === 'avenue' && tj === 'avenue';
        this.nodes.push({
          x, z, id: this.nodes.length,
          signal: major || (ti === 'avenue' || tj === 'avenue'),
          // Phase offset staggers lights so traffic isn't perfectly synchronised.
          phase: ((i * 7 + j * 11) % 10) / 10,
          nsGreen: true,
          major,
        });
        this.nodeIndex.set(x + ':' + z, this.nodes[this.nodes.length - 1]);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  roadsNear(x, z) {
    const set = this.roadHash.get(this.cellKey(x, z, this.roadCell));
    return set ? set : EMPTY_SET;
  }

  lotsNear(x, z, radius) {
    const out = [];
    const c = this.lotCell;
    const rr = Math.ceil((radius || c) / c);
    const cx = Math.floor(x / c), cz = Math.floor(z / c);
    for (let i = -rr; i <= rr; i++) for (let j = -rr; j <= rr; j++) {
      const list = this.lotHash.get((cx + i) + ':' + (cz + j));
      if (list) for (const l of list) out.push(l);
    }
    return out;
  }

  /** Closest point on the road network, with the road and lateral offset. */
  nearestRoad(x, z) {
    let best = null, bestDist = Infinity;
    for (const r of this.roadsNear(x, z)) {
      const d = distToSeg2D(x, z, r.ax, r.az, r.bx, r.bz);
      if (d.dist < bestDist) { bestDist = d.dist; best = { road: r, ...d }; }
    }
    if (!best) {
      for (const r of this.roads) {
        const d = distToSeg2D(x, z, r.ax, r.az, r.bx, r.bz);
        if (d.dist < bestDist) { bestDist = d.dist; best = { road: r, ...d }; }
      }
    }
    return best;
  }

  /** 'road' | 'sidewalk' | 'ground' at this position. */
  surfaceKind(x, z) {
    const near = this.nearestRoad(x, z);
    if (near) {
      if (near.dist < near.road.width * 0.5) return 'road';
      if (near.dist < near.road.width * 0.5 + near.road.sidewalk) return 'sidewalk';
    }
    if (z > SHORE_Z) return 'sand';
    const d = this.districtAt(x, z);
    if (d === 'park' || d === 'forest' || d === 'countryside' || d === 'suburb') return 'grass';
    return 'ground';
  }

  isOnRoad(x, z, margin) {
    const near = this.nearestRoad(x, z);
    return !!near && near.dist < near.road.width * 0.5 + (margin || 0);
  }

  /** Lot whose footprint contains the point (used for entering buildings). */
  lotAt(x, z) {
    for (const l of this.lotsNear(x, z, 60)) {
      const dx = x - l.x, dz = z - l.z;
      const c = Math.cos(-l.rot), s = Math.sin(-l.rot);
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < l.w * 0.5 && Math.abs(lz) < l.d * 0.5) return l;
    }
    return null;
  }

  /** Nearest free spot on a sidewalk — where NPCs and the player spawn. */
  nearestSidewalk(x, z) {
    const near = this.nearestRoad(x, z);
    if (!near) return { x, z };
    const r = near.road;
    const off = r.width * 0.5 + Math.max(1.6, r.sidewalk * 0.55);
    // Perpendicular to the road direction.
    const px = -r.uz, pz = r.ux;
    const side = ((x - near.x) * px + (z - near.z) * pz) >= 0 ? 1 : -1;
    return { x: near.x + px * off * side, z: near.z + pz * off * side, road: r, side };
  }

  findLandmark(query) {
    const FILLER = new Set(['the', 'a', 'an', 'to', 'me', 'my', 'of', 'please', 'go', 'take', 'and']);
    const q = String(query).toLowerCase().trim();
    const words = q.split(/\s+/).filter((w) => w && !FILLER.has(w));
    const core = words.join(' ');
    if (!core) return null;
    let best = null, bestScore = 0;
    for (const lm of this.landmarks) {
      const n = lm.name.toLowerCase();
      const nWords = n.split(/\s+/).filter((w) => !FILLER.has(w));
      let score = 0;
      if (n === q || n === core) score = 100;
      else if (core.length > 3 && n.includes(core)) score = 60 + core.length;
      else if (lm.type === core) score = 55;
      else {
        // Only count meaningful word hits, so "the beach" can't match "The Old Church".
        for (const w of words) {
          if (w.length < 3) continue;
          if (nWords.some((nw) => nw === w)) score += 22;
          else if (nWords.some((nw) => nw.startsWith(w) && w.length > 3)) score += 12;
        }
      }
      if (score > bestScore) { bestScore = score; best = lm; }
    }
    return bestScore >= 20 ? best : null;
  }

  districtName(x, z) {
    const d = DISTRICTS[this.districtAt(x, z)];
    return d ? d.name : 'Outskirts';
  }

  /** Human-readable address, e.g. "Maple Street, Downtown". */
  describeLocation(x, z) {
    const near = this.nearestRoad(x, z);
    const dn = this.districtName(x, z);
    if (near && near.road.name && near.dist < 60) return near.road.name + ', ' + dn;
    return dn;
  }

  /** Update traffic signals. Call once per frame with world time in seconds. */
  updateSignals(t) {
    const CYCLE = 24;
    for (const node of this.nodes) {
      if (!node.signal) continue;
      const p = ((t / CYCLE) + node.phase) % 1;
      node.nsGreen = p < 0.46;
      node.amber = (p >= 0.46 && p < 0.54) || p >= 0.96;
    }
  }

  nodeAt(x, z, tolerance) {
    const tol = tolerance || 12;
    const gx = Math.round(x / BLOCK_SIZE) * BLOCK_SIZE;
    const gz = Math.round(z / BLOCK_SIZE) * BLOCK_SIZE;
    if (Math.abs(gx - x) > tol || Math.abs(gz - z) > tol) return null;
    return this.nodeIndex.get(gx + ':' + gz) || null;
  }

  stats() {
    const byDistrict = {};
    for (const l of this.lots) byDistrict[l.district] = (byDistrict[l.district] || 0) + 1;
    return {
      roads: this.roads.length,
      blocks: this.blocks.length,
      lots: this.lots.length,
      landmarks: this.landmarks.length,
      parks: this.parkAreas().length,
      byDistrict,
    };
  }
}

const EMPTY_SET = new Set();
