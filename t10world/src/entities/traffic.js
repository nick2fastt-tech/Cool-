// T10 World - traffic simulation. Cars follow grid lanes, obey signals, queue
// behind each other and turn at intersections. Population is streamed around
// the player so the rest of the city keeps its traffic without simulating it.
import * as THREE from '../../vendor/three.module.js';
import { Vehicle, VEHICLE_TYPES, CIVILIAN_TYPES, EMERGENCY_TYPES } from './vehicle.js';
import { BLOCK_SIZE, CITY_RADIUS, ROAD_TYPES } from '../world/city.js';
import { clamp01, clampv, lerpv, wrapAngle, makeRng, TAU } from '../core/math.js';
import { settings, perf } from '../core/settings.js';

const DIRS = [
  { x: 0, z: 1, heading: 0 },            // north (+Z)
  { x: 1, z: 0, heading: Math.PI / 2 },  // east
  { x: 0, z: -1, heading: Math.PI },     // south
  { x: -1, z: 0, heading: -Math.PI / 2 },// west
];

export class TrafficManager {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.vehicles = [];
    this.rng = makeRng(world.seed ^ 0x7a5f);
    this.spawnTimer = 0;
    this.enabled = true;
    this.densityScale = 1;
    this.emergencyChance = 0.035;
    this.grid = new Map();
  }

  get budget() { return Math.round(settings.preset.vehicleBudget * this.densityScale * perf.load); }

  /** Snap a position to the nearest lane centre travelling in `dirIndex`. */
  laneAnchor(x, z, dirIndex, roadType) {
    const d = DIRS[dirIndex];
    const t = ROAD_TYPES[roadType] || ROAD_TYPES.street;
    const laneOffset = t.lanes >= 4 ? t.width * 0.25 : t.width * 0.24;
    // Right-hand traffic: offset to the right of the direction of travel.
    const rx = d.z, rz = -d.x;
    if (d.x !== 0) {
      const line = Math.round(z / BLOCK_SIZE) * BLOCK_SIZE;
      return { x, z: line + rz * laneOffset, line };
    }
    const line = Math.round(x / BLOCK_SIZE) * BLOCK_SIZE;
    return { x: line + rx * laneOffset, z, line };
  }

  roadTypeAtLine(line) {
    const i = Math.round((line + CITY_RADIUS) / BLOCK_SIZE);
    const total = Math.round((CITY_RADIUS * 2) / BLOCK_SIZE) + 1;
    const mid = Math.floor(total / 2);
    if (i === mid) return 'avenue';
    return i % 3 === 0 ? 'avenue' : 'street';
  }

  onGrid(v) { return Math.abs(v) <= CITY_RADIUS + 1; }

  spawnNear(px, pz, minDist, maxDist) {
    const rng = this.rng;
    // Pick a grid line and a point on it within the ring.
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const lineIdx = rng.int(0, Math.round((CITY_RADIUS * 2) / BLOCK_SIZE));
    const line = -CITY_RADIUS + lineIdx * BLOCK_SIZE;
    const along = clampv((axis === 'x' ? pz : px) + rng.range(-maxDist, maxDist), -CITY_RADIUS + 10, CITY_RADIUS - 10);
    const dirIndex = axis === 'x' ? (rng.chance(0.5) ? 0 : 2) : (rng.chance(0.5) ? 1 : 3);
    const roadType = this.roadTypeAtLine(line);
    let x, z;
    if (axis === 'x') { x = line; z = along; } else { x = along; z = line; }
    const dist = Math.hypot(x - px, z - pz);
    if (dist < minDist || dist > maxDist) return null;

    const anchor = this.laneAnchor(x, z, dirIndex, roadType);
    const typeId = rng.chance(this.emergencyChance) ? rng.pick(EMERGENCY_TYPES) : rng.pick(CIVILIAN_TYPES);
    const v = new Vehicle(this.world, typeId, {
      x: anchor.x, z: anchor.z,
      heading: DIRS[dirIndex].heading,
      seed: (rng() * 0xffffffff) >>> 0,
    });
    v.addTo(this.scene);
    v.engineOn = true;
    v.ai = {
      dirIndex, roadType,
      targetSpeed: (ROAD_TYPES[roadType].speed) * rng.range(0.82, 1.08),
      decision: null,
      turning: 0,
      patience: rng.range(1.5, 5),
      hornCooldown: 0,
      stuck: 0,
      emergency: !!v.spec.emergency && rng.chance(0.4),
    };
    if (v.ai.emergency) { v.sirenOn = true; v.ai.targetSpeed *= 1.45; }
    this.vehicles.push(v);
    return v;
  }

  despawnFar(px, pz, maxDist) {
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if (v.isPlayerVehicle || v.protected) continue;
      const d = Math.hypot(v.position.x - px, v.position.z - pz);
      if (d > maxDist) {
        v.dispose();
        this.vehicles.splice(i, 1);
      }
    }
  }

  rebuildGrid() {
    this.grid.clear();
    for (const v of this.vehicles) {
      const k = Math.floor(v.position.x / 24) + ':' + Math.floor(v.position.z / 24);
      let list = this.grid.get(k);
      if (!list) { list = []; this.grid.set(k, list); }
      list.push(v);
    }
  }

  /** Nearest vehicle ahead within a cone, used for car-following. */
  vehicleAhead(v, range) {
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    let best = null, bestD = range;
    const cx = Math.floor(v.position.x / 24), cz = Math.floor(v.position.z / 24);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const list = this.grid.get((cx + i) + ':' + (cz + j));
      if (!list) continue;
      for (const o of list) {
        if (o === v) continue;
        const dx = o.position.x - v.position.x, dz = o.position.z - v.position.z;
        const along = dx * fx + dz * fz;
        if (along <= 0.5 || along > bestD) continue;
        const lateral = Math.abs(dx * fz - dz * fx);
        if (lateral > (v.spec.w + o.spec.w) * 0.6) continue;
        bestD = along;
        best = o;
      }
    }
    return best ? { vehicle: best, distance: bestD } : null;
  }

  update(dt, focus, playerVehicle, pedestrians) {
    if (!this.enabled) return;
    const px = focus.x, pz = focus.z;
    const drawD = settings.preset.drawDistance;
    const keepDist = Math.min(drawD * 0.85, 320);

    this.despawnFar(px, pz, keepDist + 90);
    this.spawnTimer -= dt;
    // Shed the furthest car when the governor tightens the budget.
    if (this.vehicles.length > this.budget) {
      let worst = null, worstD = -1;
      for (const v of this.vehicles) {
        if (v.isPlayerVehicle || v.driver || v.protected) continue;
        const d = Math.hypot(v.position.x - focus.x, v.position.z - focus.z);
        if (d > worstD) { worstD = d; worst = v; }
      }
      if (worst && worstD > 70) {
        worst.dispose();
        this.vehicles.splice(this.vehicles.indexOf(worst), 1);
      }
    }

    if (this.spawnTimer <= 0 && this.vehicles.length < this.budget) {
      this.spawnTimer = 0.18;
      for (let a = 0; a < 3 && this.vehicles.length < this.budget; a++) {
        this.spawnNear(px, pz, 60, keepDist);
      }
    }

    this.rebuildGrid();
    for (const v of this.vehicles) {
      if (v.isPlayerVehicle || v.driver) { v.update(dt, focus); continue; }
      this.driveAI(v, dt, pedestrians);
      v.update(dt, focus);
    }
  }

  driveAI(v, dt, pedestrians) {
    const ai = v.ai;
    if (!ai) return;
    const d = DIRS[ai.dirIndex];
    const world = this.world;

    // Where is the next intersection in front of us?
    const alongPos = d.x !== 0 ? v.position.x : v.position.z;
    const step = d.x !== 0 ? d.x : d.z;
    const nextNodeAlong = (Math.floor(alongPos / BLOCK_SIZE) + (step > 0 ? 1 : 0)) * BLOCK_SIZE;
    const distToNode = Math.abs(nextNodeAlong - alongPos);

    // Decide a turn shortly before the intersection.
    if (!ai.decision && distToNode < 26) {
      const roll = this.rng();
      let turn = 0;
      if (roll < 0.20) turn = -1;
      else if (roll < 0.40) turn = 1;
      ai.decision = {
        turn,
        nodeX: d.x !== 0 ? nextNodeAlong : Math.round(v.position.x / BLOCK_SIZE) * BLOCK_SIZE,
        nodeZ: d.x !== 0 ? Math.round(v.position.z / BLOCK_SIZE) * BLOCK_SIZE : nextNodeAlong,
      };
      // Don't turn off the grid.
      const nd = DIRS[(ai.dirIndex + (turn === -1 ? 3 : turn === 1 ? 1 : 0)) % 4];
      const futureLine = nd.x !== 0 ? ai.decision.nodeZ : ai.decision.nodeX;
      if (Math.abs(futureLine) > CITY_RADIUS) ai.decision.turn = 0;
      v.signalLeft = ai.decision.turn === -1;
      v.signalRight = ai.decision.turn === 1;
    }

    // Traffic light state at the approaching node.
    let mustStop = false;
    if (ai.decision && distToNode < 30 && !ai.emergency) {
      const node = world.city.nodeAt(ai.decision.nodeX, ai.decision.nodeZ, 3);
      if (node && node.signal) {
        const travellingNS = d.x === 0;
        const green = travellingNS ? node.nsGreen : !node.nsGreen;
        if ((!green || node.amber) && distToNode > 5.5) mustStop = true;
      }
    }

    // Car ahead.
    const ahead = this.vehicleAhead(v, 24);
    let desired = ai.targetSpeed;
    if (ahead) {
      const gap = ahead.distance - (v.spec.l * 0.5 + ahead.vehicle.spec.l * 0.5);
      const safe = 3.0 + Math.abs(v.speed) * 0.85;
      if (gap < safe) desired = Math.min(desired, Math.max(0, ahead.vehicle.speed * clamp01(gap / safe)));
      if (gap < 1.2) desired = 0;
      if (gap < 2.5 && Math.abs(v.speed) < 0.4) {
        ai.patience -= dt;
        if (ai.patience < 0 && ai.hornCooldown <= 0) { v.honk(); ai.hornCooldown = 4; ai.patience = 3; }
      }
    }
    // Pedestrians in the road.
    if (pedestrians) {
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      for (const p of pedestrians) {
        const dx = p.position.x - v.position.x, dz = p.position.z - v.position.z;
        const along = dx * fx + dz * fz;
        if (along < 0 || along > 14) continue;
        if (Math.abs(dx * fz - dz * fx) > 2.4) continue;
        desired = Math.min(desired, along < 5 ? 0 : 3);
        break;
      }
    }
    if (mustStop) {
      const stopDist = Math.max(0.5, distToNode - 6);
      desired = Math.min(desired, stopDist < 2 ? 0 : Math.sqrt(2 * 5.5 * stopDist));
    }
    if (ai.hornCooldown > 0) ai.hornCooldown -= dt;

    // Speed control.
    const err = desired - v.speed;
    const throttle = clampv(err * 0.32, -1, 1);
    v.setInput(Math.max(0, throttle), Math.max(0, -throttle * 0.9), 0, 0);

    // ---- Lateral control: stay in lane, execute turns ----
    let targetHeading = d.heading;
    const anchor = this.laneAnchor(v.position.x, v.position.z, ai.dirIndex, ai.roadType);
    let lateralErr;
    if (d.x !== 0) lateralErr = anchor.z - v.position.z;
    else lateralErr = anchor.x - v.position.x;

    if (ai.decision && distToNode < 9 && ai.decision.turn !== 0) {
      // Commit to the turn: steer toward the new lane.
      const newDir = (ai.dirIndex + (ai.decision.turn === 1 ? 1 : 3)) % 4;
      targetHeading = DIRS[newDir].heading;
      ai.turning = 1;
      if (distToNode < 2.5 || (ai.turning && Math.abs(wrapAngle(v.heading - targetHeading)) < 0.22)) {
        ai.dirIndex = newDir;
        ai.roadType = this.roadTypeAtLine(DIRS[newDir].x !== 0 ? Math.round(v.position.z / BLOCK_SIZE) * BLOCK_SIZE : Math.round(v.position.x / BLOCK_SIZE) * BLOCK_SIZE);
        ai.decision = null;
        ai.turning = 0;
        v.signalLeft = v.signalRight = false;
      }
    } else if (ai.decision && distToNode < 3) {
      ai.decision = null;
      v.signalLeft = v.signalRight = false;
    }

    const headingErr = wrapAngle(targetHeading - v.heading);
    // Blend heading correction with lane centring.
    const perp = d.x !== 0 ? Math.sign(d.x) : Math.sign(d.z);
    const laneSteer = clampv(lateralErr * (d.x !== 0 ? -perp : perp) * 0.12, -0.5, 0.5);
    const steer = clampv(headingErr * 1.6 + (ai.turning ? 0 : laneSteer), -1, 1);
    v.setInput(Math.max(0, throttle), Math.max(0, -throttle * 0.9), steer, 0);

    // Unstick anything that's been pinned for too long.
    if (Math.abs(v.speed) < 0.2 && desired > 1) {
      ai.stuck += dt;
      if (ai.stuck > 6) {
        v.teleport(anchor.x, anchor.z, d.heading);
        ai.stuck = 0;
      }
    } else ai.stuck = 0;

    // Off-grid safety net.
    if (!this.onGrid(v.position.x) || !this.onGrid(v.position.z)) {
      ai.dirIndex = (ai.dirIndex + 2) % 4;
      v.heading = DIRS[ai.dirIndex].heading;
      ai.decision = null;
    }
  }

  /** Nearest vehicle to a point — used for "enter the car" and T10 commands. */
  nearest(x, z, maxDist, filter) {
    let best = null, bd = maxDist || 12;
    for (const v of this.vehicles) {
      if (filter && !filter(v)) continue;
      const d = Math.hypot(v.position.x - x, v.position.z - z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  /** Spawn a vehicle on demand (T10 command). */
  spawnAt(typeId, x, z, heading, opts) {
    const v = new Vehicle(this.world, typeId, Object.assign({ x, z, heading: heading || 0 }, opts || {}));
    v.addTo(this.scene);
    v.engineOn = false;
    v.protected = true;
    this.vehicles.push(v);
    return v;
  }

  remove(v) {
    const i = this.vehicles.indexOf(v);
    if (i >= 0) this.vehicles.splice(i, 1);
    v.dispose();
  }

  clear(keep) {
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if (v === keep || v.isPlayerVehicle) continue;
      v.dispose();
      this.vehicles.splice(i, 1);
    }
  }

  count() { return this.vehicles.length; }
}
