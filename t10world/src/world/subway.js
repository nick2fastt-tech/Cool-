// T10 World - the subway. Three lines under the city, with stations you walk
// into from the street, platforms, and trains you can board, ride and sit on.
//
// Nothing here streams with the surface chunks: a platform is built when a
// train or the player gets near it and torn down when they leave, so the whole
// system is a handful of groups no matter how big the network is.
import * as THREE from '../../vendor/three.module.js';
import { boxUV, cylinderUV, transformed, disposeGroup, GeometryBatcher } from './geomutils.js';
import { metalMaterial, paintedMaterial, concreteMaterial } from './materials.js';
import { clamp01, clampv, lerpv, makeRng, TAU } from '../core/math.js';
import { audio } from '../core/audio.js';

export const PLATFORM_Y = -11.5;
const PLATFORM_HALF_LEN = 46;     // half the length of a platform
const PLATFORM_W = 9;             // walkable width, one side of the track
const TUNNEL_H = 6.4;
const TRACK_OFFSET = 7.2;         // track centre from the platform centreline

/**
 * Three lines, laid on the city's own grid so the stations land on real
 * streets. Names are the stops, in order.
 */
export const SUBWAY_LINES = [
  {
    id: 'A', name: 'A Line', color: 0x2f6fd9, axis: 'z', at: -45,
    stops: [
      { name: 'Northgate', v: -700 },
      { name: 'Iris Street', v: -420 },
      { name: 'Midtown', v: -160 },
      { name: 'T10 Plaza', v: 60 },
      { name: 'Union', v: 300 },
      { name: 'Harbour End', v: 560 },
    ],
  },
  {
    id: 'C', name: 'C Line', color: 0xd98f2f, axis: 'x', at: 150,
    stops: [
      { name: 'Westfield', v: -660 },
      { name: 'Civic Centre', v: -330 },
      { name: 'Grand Central', v: -30 },
      { name: 'Eastside', v: 270 },
      { name: 'Stadium', v: 600 },
    ],
  },
  {
    id: 'F', name: 'F Line', color: 0x3fb37a, axis: 'x', at: -330,
    stops: [
      { name: 'Riverside', v: -560 },
      { name: 'Apartment Row', v: -240 },
      { name: 'Northside', v: 40 },
      { name: 'Fir Street', v: 330 },
      { name: 'The Yards', v: 640 },
    ],
  },
];

/** World position of a stop. Lines run along one axis at a fixed offset. */
function stopPos(line, stop) {
  return line.axis === 'z'
    ? { x: line.at, z: stop.v }
    : { x: stop.v, z: line.at };
}

/** Unit vector along the line. */
function lineDir(line) {
  return line.axis === 'z' ? { x: 0, z: 1 } : { x: 1, z: 0 };
}

export class Subway {
  constructor(game) {
    this.game = game;
    this.rng = makeRng(0x5b0a11);
    this.root = new THREE.Group();
    this.root.name = 'subway';
    this.root.matrixAutoUpdate = false;
    game.scene.add(this.root);

    this.platforms = new Map();   // key -> { group, line, stop }
    this.trains = [];
    this.entrances = [];
    this.playerStation = null;    // the stop the player is standing in
    this.ridingTrain = null;

    this.buildStops();
    this.buildTrains();
  }

  /** Flat list of every stop, with its line and world position. */
  buildStops() {
    this.stops = [];
    for (const line of SUBWAY_LINES) {
      line.stops.forEach((stop, i) => {
        const p = stopPos(line, stop);
        this.stops.push({
          key: line.id + ':' + i, line, stop, index: i,
          x: p.x, z: p.z, name: stop.name,
        });
      });
    }
  }

  /** One train per line, running back and forth along it. */
  buildTrains() {
    for (const line of SUBWAY_LINES) {
      const t = {
        line,
        index: 0,
        dir: 1,
        state: 'dwell',
        timer: 4,
        pos: line.stops[0].v,
        speed: 0,
        group: null,
        doorsOpen: 0,
        riders: [],
      };
      this.trains.push(t);
    }
  }

  // -------------------------------------------------------------------------
  // Street entrances — registered with the world so USE picks them up.
  // -------------------------------------------------------------------------

  /** Called once the world exists; adds a stair head above every stop. */
  buildEntrances(world) {
    for (const s of this.stops) {
      // Put the head on the nearest pavement so it isn't in the road.
      const sw = world.city.nearestSidewalk(s.x, s.z);
      const y = world.groundAt(sw.x, sw.z);
      const g = new THREE.Group();
      g.position.set(sw.x, y, sw.z);
      g.matrixAutoUpdate = false;
      g.updateMatrix();

      const b = new GeometryBatcher();
      const rail = metalMaterial(0x2a2e33, 0.5);
      const kiosk = paintedMaterial(0x1d2227, 0.66);
      const trim = paintedMaterial(s.line.color, 0.4);

      // Stair mouth: a dark opening with a railed surround and a lit sign.
      b.add(concreteMaterial(0x8e8a82), transformed(boxUV(4.6, 0.32, 3.4, 1, 1), 0, 0.16, 0, 0));
      b.add(kiosk, transformed(boxUV(4.2, 0.9, 3.0, 1, 1), 0, 0.45, 0, 0));
      b.add(paintedMaterial(0x07090b, 0.95), transformed(boxUV(3.2, 0.7, 2.0, 1, 1), 0, 0.62, 0, 0));
      for (const sx of [-1, 1]) {
        b.add(rail, transformed(cylinderUV(0.05, 0.05, 1.1, 6, 1, 1), sx * 1.8, 1.0, 1.3, 0));
        b.add(rail, transformed(cylinderUV(0.05, 0.05, 1.1, 6, 1, 1), sx * 1.8, 1.0, -1.3, 0));
        b.add(rail, transformed(boxUV(0.08, 0.08, 2.8, 1, 1), sx * 1.8, 1.5, 0, 0));
      }
      // Sign pole with the line's colour.
      b.add(rail, transformed(cylinderUV(0.06, 0.06, 3.0, 6, 1, 1), 2.5, 1.5, 0, 0));
      b.add(trim, transformed(boxUV(0.9, 0.9, 0.1, 1, 1), 2.5, 2.9, 0, 0));
      b.build(g, { name: 'subway-entrance', castShadow: true });

      this.root.add(g);
      const it = {
        x: sw.x, y, z: sw.z, radius: 3.2,
        type: 'subway', label: s.line.name + ' — ' + s.name,
        action: 'subway', stopKey: s.key,
      };
      world.registerInteractable(it);
      this.entrances.push({ group: g, it, stop: s });
    }
  }

  // -------------------------------------------------------------------------
  // Platforms
  // -------------------------------------------------------------------------

  ensurePlatform(stop) {
    if (this.platforms.has(stop.key)) return this.platforms.get(stop.key);
    const group = new THREE.Group();
    group.position.set(stop.x, PLATFORM_Y, stop.z);
    const d = lineDir(stop.line);
    group.rotation.y = stop.line.axis === 'z' ? 0 : Math.PI / 2;
    group.matrixAutoUpdate = false;
    group.updateMatrix();

    const b = new GeometryBatcher();
    const wall = concreteMaterial(0xdad5c8);
    const floor = concreteMaterial(0x9a958c);
    const dark = paintedMaterial(0x0a0c0f, 0.95);
    const steel = metalMaterial(0x4a5058, 0.42);
    const trim = paintedMaterial(stop.line.color, 0.36);
    const L = PLATFORM_HALF_LEN;

    // Platform slab, one metre above the track bed.
    b.add(floor, transformed(boxUV(PLATFORM_W, 1.0, L * 2, 3, 12), -PLATFORM_W * 0.5 - 0.6, 0.5, 0, 0));
    // Yellow edge strip.
    b.add(paintedMaterial(0xd8b13a, 0.6), transformed(boxUV(0.7, 0.06, L * 2, 1, 12), -1.0, 1.03, 0, 0));
    // Track bed and rails.
    b.add(dark, transformed(boxUV(TRACK_OFFSET, 0.4, L * 2.6, 2, 14), 1.4, 0.2, 0, 0));
    for (const r of [-0.72, 0.72]) {
      b.add(steel, transformed(boxUV(0.1, 0.14, L * 2.6, 1, 40), 1.4 + r, 0.47, 0, 0));
    }
    // Back wall, tiled, with the line's stripe.
    b.add(wall, transformed(boxUV(0.5, TUNNEL_H, L * 2, 1, 10), -PLATFORM_W - 0.85, TUNNEL_H * 0.5, 0, 0));
    b.add(trim, transformed(boxUV(0.06, 0.55, L * 2, 1, 10), -PLATFORM_W - 0.58, 2.5, 0, 0));
    // Far wall past the track.
    b.add(concreteMaterial(0x6a665f), transformed(boxUV(0.5, TUNNEL_H, L * 2, 1, 10), 5.6, TUNNEL_H * 0.5, 0, 0));
    // Ceiling.
    b.add(concreteMaterial(0x5d5a55), transformed(boxUV(PLATFORM_W + 8, 0.5, L * 2, 6, 12), -2.0, TUNNEL_H, 0, 0));

    // Columns down the platform, benches between them.
    for (let i = -3; i <= 3; i++) {
      const v = i * (L / 3.4);
      b.add(steel, transformed(boxUV(0.34, TUNNEL_H - 1.0, 0.34, 1, 1), -PLATFORM_W * 0.5 - 0.6, 1.0 + (TUNNEL_H - 1.0) * 0.5, v, 0));
      if (i % 2 === 0) {
        b.add(paintedMaterial(0x3a3128, 0.7), transformed(boxUV(1.1, 0.12, 2.2, 1, 1), -PLATFORM_W - 0.2, 1.46, v, 0));
        b.add(steel, transformed(boxUV(0.9, 0.42, 0.12, 1, 1), -PLATFORM_W - 0.2, 1.24, v - 1.0, 0));
        b.add(steel, transformed(boxUV(0.9, 0.42, 0.12, 1, 1), -PLATFORM_W - 0.2, 1.24, v + 1.0, 0));
      }
    }
    b.build(group, { name: 'subway-platform', castShadow: false, receiveShadow: true });

    // Strip lights along the ceiling.
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2d8 });
    for (let i = -4; i <= 4; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.2), lightMat);
      strip.position.set(-3.0, TUNNEL_H - 0.35, i * (L / 4.5));
      strip.matrixAutoUpdate = false;
      strip.updateMatrix();
      group.add(strip);
    }
    const lamp = new THREE.PointLight(0xffeccc, 2.4, 34, 2);
    lamp.position.set(-4, TUNNEL_H - 1.0, 0);
    group.add(lamp);

    this.root.add(group);
    const rec = { group, stop, lamp };
    this.platforms.set(stop.key, rec);
    return rec;
  }

  disposePlatform(key) {
    const rec = this.platforms.get(key);
    if (!rec) return;
    disposeGroup(rec.group);
    this.platforms.delete(key);
  }

  // -------------------------------------------------------------------------
  // Trains
  // -------------------------------------------------------------------------

  buildTrainMesh(line) {
    const group = new THREE.Group();
    const body = paintedMaterial(0xb9bec4, 0.34);
    const dark = paintedMaterial(0x23272c, 0.5);
    const glass = new THREE.MeshStandardMaterial({
      color: 0x2a3a46, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.55,
    });
    const trim = paintedMaterial(line.color, 0.3);
    const seat = paintedMaterial(0x2e3f5c, 0.72);
    const CARS = 3, CAR_L = 17.5, CAR_W = 3.1, CAR_H = 3.4;

    for (let c = 0; c < CARS; c++) {
      const off = (c - (CARS - 1) / 2) * (CAR_L + 0.8);
      const b = new GeometryBatcher();
      // Shell: floor, roof, two long sides with a window band, two ends.
      b.add(dark, transformed(boxUV(CAR_W, 0.25, CAR_L, 2, 8), 0, 0.12, off, 0));
      b.add(body, transformed(boxUV(CAR_W, 0.22, CAR_L, 2, 8), 0, CAR_H, off, 0));
      for (const sx of [-1, 1]) {
        // Below the windows.
        b.add(body, transformed(boxUV(0.14, 1.15, CAR_L, 1, 8), sx * CAR_W * 0.5, 0.82, off, 0));
        // Window band.
        b.add(glass, transformed(boxUV(0.08, 1.15, CAR_L - 1.2, 1, 8), sx * CAR_W * 0.5, 2.05, off, 0));
        // Above the windows, with the line stripe.
        b.add(body, transformed(boxUV(0.14, 0.7, CAR_L, 1, 8), sx * CAR_W * 0.5, 2.95, off, 0));
        b.add(trim, transformed(boxUV(0.03, 0.22, CAR_L, 1, 8), sx * CAR_W * 0.5 + sx * 0.08, 1.48, off, 0));
      }
      b.add(body, transformed(boxUV(CAR_W, CAR_H, 0.2, 2, 2), 0, CAR_H * 0.5, off - CAR_L * 0.5, 0));
      b.add(body, transformed(boxUV(CAR_W, CAR_H, 0.2, 2, 2), 0, CAR_H * 0.5, off + CAR_L * 0.5, 0));
      // Bench seats down both sides, and grab poles.
      for (const sx of [-1, 1]) {
        for (const seg of [-1, 1]) {
          b.add(seat, transformed(boxUV(0.62, 0.1, CAR_L * 0.36, 1, 3), sx * (CAR_W * 0.5 - 0.42), 0.68, off + seg * CAR_L * 0.22, 0));
          b.add(seat, transformed(boxUV(0.1, 0.72, CAR_L * 0.36, 1, 3), sx * (CAR_W * 0.5 - 0.10), 1.06, off + seg * CAR_L * 0.22, 0));
        }
      }
      for (let i = -2; i <= 2; i++) {
        b.add(metalMaterial(0x9aa0a6, 0.3), transformed(cylinderUV(0.035, 0.035, CAR_H - 0.5, 6, 1, 1), 0, (CAR_H - 0.5) * 0.5 + 0.2, off + i * 3.2, 0));
      }
      b.build(group, { name: 'subway-car', castShadow: false, receiveShadow: false });

      // Doors: two per side per car, and they slide.
      for (const sx of [-1, 1]) {
        for (const dz of [-CAR_L * 0.26, CAR_L * 0.26]) {
          for (const leaf of [-1, 1]) {
            const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.15, 0.78), dark);
            door.position.set(sx * CAR_W * 0.5, 1.28, off + dz + leaf * 0.40);
            door.userData.slide = { base: off + dz + leaf * 0.40, dir: leaf, open: 0.78 };
            group.add(door);
          }
        }
      }
    }

    const interior = new THREE.PointLight(0xfff0d8, 1.8, 26, 2);
    interior.position.set(0, 2.6, 0);
    group.add(interior);
    group.userData.carLen = CAR_L;
    group.userData.cars = CARS;
    group.userData.halfLen = (CARS * (CAR_L + 0.8)) * 0.5;
    return group;
  }

  ensureTrainMesh(t) {
    if (t.group) return t.group;
    t.group = this.buildTrainMesh(t.line);
    t.doors = [];
    t.group.traverse((o) => { if (o.userData && o.userData.slide) t.doors.push(o); });
    this.root.add(t.group);
    return t.group;
  }

  hideTrain(t) {
    if (!t.group) return;
    disposeGroup(t.group);
    t.group = null;
    t.doors = null;
  }

  /** Where a train is, in world space. */
  trainPos(t) {
    return t.line.axis === 'z'
      ? { x: t.line.at, z: t.pos }
      : { x: t.pos, z: t.line.at };
  }

  // -------------------------------------------------------------------------
  update(dt, focus) {
    const g = this.game;
    const player = g.player;
    const underground = !!player.inSubway;

    // Which stops matter right now: the one you're in, and the ones any train
    // is approaching.
    const wanted = new Set();
    if (this.playerStation) wanted.add(this.playerStation.key);

    for (const t of this.trains) {
      this.updateTrain(dt, t, wanted);
    }

    // Build what's wanted, drop what isn't.
    for (const key of wanted) {
      const stop = this.stops.find((s) => s.key === key);
      if (stop) this.ensurePlatform(stop);
    }
    for (const key of [...this.platforms.keys()]) {
      if (!wanted.has(key)) this.disposePlatform(key);
    }

    this.root.visible = underground;
    // The city above is pointless while you're down here, and expensive.
    if (underground !== this._wasUnder) {
      this._wasUnder = underground;
      if (g.world) g.world.root.visible = !underground;
      if (g.atmosphere) g.atmosphere.setUnderground(underground);
    }
  }

  updateTrain(dt, t, wanted) {
    const line = t.line;
    const stops = line.stops;
    const target = stops[t.index];

    if (t.state === 'dwell') {
      t.timer -= dt;
      t.doorsOpen = clamp01(t.doorsOpen + dt * 1.6);
      if (t.timer <= 0) {
        t.state = 'closing';
        t.timer = 1.2;
        if (this.ridingTrain === t) this.game.t10Say('Doors closing. Next stop: ' + this.nextStopName(t) + '.');
      }
    } else if (t.state === 'closing') {
      t.timer -= dt;
      t.doorsOpen = clamp01(t.doorsOpen - dt * 1.4);
      if (t.timer <= 0) {
        t.state = 'run';
        // Turn round at the ends of the line.
        if (t.index + t.dir < 0 || t.index + t.dir >= stops.length) t.dir *= -1;
        t.index += t.dir;
      }
    } else {
      t.doorsOpen = clamp01(t.doorsOpen - dt * 2);
      const dest = stops[t.index].v;
      const gap = dest - t.pos;
      const dist = Math.abs(gap);
      // Accelerate away, coast, brake into the platform.
      const want = clampv(Math.sqrt(Math.max(0, dist - 2)) * 3.4, 0, 22);
      t.speed = lerpv(t.speed, want, clamp01(dt * 1.1));
      t.pos += Math.sign(gap) * t.speed * dt;
      if (dist < 1.2) {
        t.pos = dest;
        t.speed = 0;
        t.state = 'dwell';
        t.timer = 6;
        if (this.ridingTrain === t) {
          this.game.t10Say('This is ' + stops[t.index].name + '. Use to get off.');
          audio.ui('tick');
        }
      }
    }

    // A train is only worth drawing when you might see it.
    const p = this.trainPos(t);
    const near = this.ridingTrain === t ||
      (this.playerStation && this.playerStation.line === line &&
       Math.abs((line.axis === 'z' ? this.playerStation.z : this.playerStation.x) - t.pos) < 200);
    if (near) {
      const mesh = this.ensureTrainMesh(t);
      mesh.position.set(p.x, PLATFORM_Y, p.z);
      mesh.rotation.y = line.axis === 'z' ? 0 : Math.PI / 2;
      // Offset onto the track, which sits beside the platform.
      const d = lineDir(line);
      mesh.position.x += (line.axis === 'z' ? TRACK_OFFSET * 0.6 : 0);
      mesh.position.z += (line.axis === 'x' ? -TRACK_OFFSET * 0.6 : 0);
      mesh.updateMatrixWorld();
      for (const door of t.doors) {
        const s = door.userData.slide;
        const slide = s.open * t.doorsOpen * s.dir;
        if (line.axis === 'z') door.position.z = s.base + slide;
        else door.position.z = s.base + slide;
      }
      // Keep the station it's sitting in loaded.
      if (t.state !== 'run') {
        const st = this.stops.find((x) => x.line === line && x.index === t.index);
        if (st) wanted.add(st.key);
      }
    } else if (t.group) {
      this.hideTrain(t);
    }

    // Riders move with the train.
    if (this.ridingTrain === t) {
      const player = this.game.player;
      const d = lineDir(line);
      if (this._lastRidePos == null) this._lastRidePos = t.pos;
      const delta = t.pos - this._lastRidePos;
      this._lastRidePos = t.pos;
      player.position.x += d.x * delta;
      player.position.z += d.z * delta;
      player.root.position.copy(player.position);
    } else if (this.ridingTrain == null) {
      this._lastRidePos = null;
    }
  }

  nextStopName(t) {
    const stops = t.line.stops;
    let i = t.index + t.dir;
    if (i < 0 || i >= stops.length) i = t.index - t.dir;
    return stops[clampv(i, 0, stops.length - 1)].name;
  }

  // -------------------------------------------------------------------------
  // Getting in and out
  // -------------------------------------------------------------------------

  /** Walk down into a station. @returns the stop, or null. */
  enter(stopKey) {
    const stop = this.stops.find((s) => s.key === stopKey);
    if (!stop) return null;
    const g = this.game;
    this.playerStation = stop;
    this.ensurePlatform(stop);
    g.player.inSubway = true;
    // Stand back from the platform edge.
    const d = lineDir(stop.line);
    const nx = -d.z, nz = d.x;
    g.player.teleport(stop.x + nx * 5.0, stop.z + nz * 5.0, PLATFORM_Y + 1.0);
    g.player.groundOverride = PLATFORM_Y + 1.0;
    g.player.verticalVel = 0;
    audio.doorOpen();
    return stop;
  }

  /** Back up to the street. */
  leave() {
    const g = this.game;
    const stop = this.playerStation;
    this.ridingTrain = null;
    this.playerStation = null;
    g.player.inSubway = false;
    g.player.groundOverride = null;
    if (stop) {
      const sw = g.world.city.nearestSidewalk(stop.x, stop.z);
      g.player.teleport(sw.x + 3.4, sw.z, g.world.groundAt(sw.x + 3.4, sw.z));
    }
    audio.doorClose();
    return true;
  }

  /** The train standing at this platform with its doors open, if any. */
  trainAtPlatform() {
    const stop = this.playerStation;
    if (!stop) return null;
    for (const t of this.trains) {
      if (t.line !== stop.line) continue;
      if (t.state === 'run' || t.doorsOpen < 0.6) continue;
      if (t.index !== stop.index) continue;
      return t;
    }
    return null;
  }

  board() {
    const t = this.trainAtPlatform();
    if (!t) return null;
    const g = this.game;
    const p = this.trainPos(t);
    const d = lineDir(t.line);
    this.ridingTrain = t;
    this._lastRidePos = t.pos;
    g.player.teleport(p.x + (t.line.axis === 'z' ? TRACK_OFFSET * 0.6 : 0),
      p.z + (t.line.axis === 'x' ? -TRACK_OFFSET * 0.6 : 0), PLATFORM_Y + 0.4);
    g.player.groundOverride = PLATFORM_Y + 0.4;
    g.player.verticalVel = 0;
    return t;
  }

  alight() {
    const t = this.ridingTrain;
    if (!t) return false;
    if (t.state === 'run' || t.doorsOpen < 0.5) return false;
    const stop = this.stops.find((s) => s.line === t.line && s.index === t.index);
    this.ridingTrain = null;
    this._lastRidePos = null;
    if (stop) {
      this.playerStation = stop;
      this.ensurePlatform(stop);
      const d = lineDir(stop.line);
      const nx = -d.z, nz = d.x;
      this.game.player.teleport(stop.x + nx * 4.2, stop.z + nz * 4.2, PLATFORM_Y + 1.0);
      this.game.player.groundOverride = PLATFORM_Y + 1.0;
    }
    return true;
  }

  dispose() {
    for (const key of [...this.platforms.keys()]) this.disposePlatform(key);
    for (const t of this.trains) this.hideTrain(t);
    disposeGroup(this.root);
  }
}
