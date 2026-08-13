/* T10 WORLD — agents
 * Pedestrians walking a sidewalk graph, grid traffic that obeys signals, and
 * the shared character renderer used by NPCs and the player alike.
 */
(function (global) {
  'use strict';
  var T10 = global.T10;
  var P = T10.Places;
  var W = T10.World;
  var M = T10.M;

  var A = T10.Agents = {};

  A.npcs = [];
  A.vehicles = [];
  A.interiorNpcs = [];
  A.maxNpc = 54;
  A.maxVeh = 42;

  /* ------------------------------------------------------- character look */
  var SKINS = [[0.86, 0.68, 0.54], [0.74, 0.55, 0.40], [0.55, 0.38, 0.26], [0.38, 0.26, 0.18], [0.92, 0.78, 0.66], [0.64, 0.46, 0.32]];
  var HAIRS = [[0.10, 0.08, 0.07], [0.28, 0.18, 0.10], [0.55, 0.42, 0.20], [0.62, 0.60, 0.58], [0.35, 0.14, 0.08], [0.16, 0.14, 0.20]];
  var TOPS = [[0.20, 0.24, 0.34], [0.62, 0.20, 0.20], [0.16, 0.16, 0.18], [0.30, 0.45, 0.35], [0.72, 0.70, 0.66],
  [0.35, 0.30, 0.55], [0.85, 0.60, 0.25], [0.20, 0.42, 0.55], [0.55, 0.55, 0.60], [0.75, 0.35, 0.50]];
  var BOTTOMS = [[0.18, 0.20, 0.28], [0.24, 0.24, 0.26], [0.34, 0.30, 0.26], [0.14, 0.14, 0.16], [0.42, 0.40, 0.36]];
  var HAIRSTYLES = ['short', 'buzz', 'long', 'bun', 'cap', 'hat', 'afro'];

  var FIRST = ['Alex', 'Maya', 'Jordan', 'Sofia', 'Marcus', 'Nina', 'Devon', 'Rosa', 'Eli', 'Priya', 'Tariq', 'Grace',
    'Leo', 'Fatima', 'Sam', 'Yuki', 'Andre', 'Chloe', 'Omar', 'Hannah', 'Diego', 'Iris', 'Kwame', 'Lena',
    'Nico', 'Ava', 'Ruben', 'Zoe', 'Malik', 'Clara'];
  var LAST = ['Rivera', 'Chen', 'Okafor', 'Kowalski', 'Delgado', 'Nguyen', 'Bianchi', 'Hassan', 'Murphy', 'Silva',
    'Bergman', 'Park', 'Alvarez', 'Osei', 'Rossi', 'Kaur', 'Fisher', 'Moreau', 'Petrov', 'Yamada'];
  var PERSONALITIES = ['friendly', 'rushed', 'tired', 'chatty', 'guarded', 'cheerful', 'blunt', 'dreamy'];
  var JOBS = ['barista', 'nurse', 'teacher', 'construction worker', 'graphic designer', 'chef', 'bus driver',
    'student', 'musician', 'paralegal', 'bartender', 'delivery rider', 'dog walker', 'photographer',
    'stagehand', 'librarian', 'EMT', 'line cook', 'software engineer', 'super'];

  function makeLook(rnd) {
    return {
      height: rnd.range(1.58, 1.92),
      build: rnd.range(0.86, 1.16),
      skin: rnd.pick(SKINS),
      hair: rnd.pick(HAIRS),
      style: rnd.pick(HAIRSTYLES),
      top: rnd.pick(TOPS),
      bottom: rnd.pick(BOTTOMS),
      shoes: [0.12, 0.11, 0.12],
      bag: rnd.chance(0.28),
      coat: rnd.chance(0.3),
      umbrella: false
    };
  }
  A.makeLook = makeLook;

  A.outfitLook = function (outfit, base) {
    var l = base || makeLook(T10.rng(7));
    var o = {
      casual: { top: [0.24, 0.34, 0.52], bottom: [0.20, 0.22, 0.28] },
      hoodie: { top: [0.30, 0.30, 0.34], bottom: [0.18, 0.20, 0.26] },
      suit: { top: [0.14, 0.15, 0.20], bottom: [0.12, 0.13, 0.17] },
      gym: { top: [0.85, 0.35, 0.25], bottom: [0.16, 0.16, 0.18] },
      rain: { top: [0.18, 0.36, 0.50], bottom: [0.20, 0.22, 0.26] },
      work: { top: [0.30, 0.45, 0.35], bottom: [0.26, 0.26, 0.30] },
      taxi: { top: [0.85, 0.72, 0.18], bottom: [0.20, 0.20, 0.24] }
    }[outfit] || null;
    if (o) { l.top = o.top; l.bottom = o.bottom; }
    return l;
  };

  /* Draws a person out of nine boxes with a procedural walk cycle. */
  A.drawPerson = function (push, x, y, z, yaw, phase, moveAmt, look, pose) {
    var h = look.height, b = look.build;
    var rot = -yaw;
    var fx = Math.sin(yaw), fz = -Math.cos(yaw);
    var rx = Math.cos(yaw), rz = Math.sin(yaw);
    var sitting = pose === 'sit';
    var legLen = h * (sitting ? 0.24 : 0.46);
    var torsoLen = h * 0.33, headS = h * 0.135;
    var swing = Math.sin(phase) * 0.85 * moveAmt;
    var swing2 = Math.sin(phase + Math.PI) * 0.85 * moveAmt;
    var bob = Math.abs(Math.sin(phase)) * 0.035 * moveAmt;
    var hipY = y + legLen + bob - (sitting ? h * 0.16 : 0);
    var lw = 0.15 * b;

    // legs — the pitch slot swings them from the hip
    push(x + rx * lw * 1.2, hipY - legLen, z + rz * lw * 1.2, lw, legLen, 0.2 * b, rot, look.bottom, 1, 8, sitting ? 1.1 : swing);
    push(x - rx * lw * 1.2, hipY - legLen, z - rz * lw * 1.2, lw, legLen, 0.2 * b, rot, look.bottom, 1, 8, sitting ? 1.1 : swing2);
    // shoes
    push(x + rx * lw * 1.2 + fx * swing * 0.25, hipY - legLen - 0.02, z + rz * lw * 1.2 + fz * swing * 0.25, lw + 0.03, 0.09, 0.28 * b, rot, look.shoes, 1, 0, 0);
    push(x - rx * lw * 1.2 + fx * swing2 * 0.25, hipY - legLen - 0.02, z - rz * lw * 1.2 + fz * swing2 * 0.25, lw + 0.03, 0.09, 0.28 * b, rot, look.shoes, 1, 0, 0);
    // torso
    push(x, hipY, z, 0.42 * b, torsoLen, 0.24 * b, rot, look.top, 1, 8, 0);
    if (look.coat) push(x, hipY - 0.06, z, 0.47 * b, torsoLen * 0.92, 0.29 * b, rot, [look.top[0] * 0.7, look.top[1] * 0.7, look.top[2] * 0.75], 1, 8, 0);
    // arms
    var shoulderY = hipY + torsoLen * 0.92, armLen = h * 0.30;
    push(x + rx * 0.26 * b, shoulderY - armLen, z + rz * 0.26 * b, 0.12 * b, armLen, 0.15 * b, rot, look.top, 1, 8, sitting ? 0.9 : swing2 * 0.8);
    push(x - rx * 0.26 * b, shoulderY - armLen, z - rz * 0.26 * b, 0.12 * b, armLen, 0.15 * b, rot, look.top, 1, 8, sitting ? 0.9 : swing * 0.8);
    // head + hair
    var neckY = hipY + torsoLen;
    push(x, neckY, z, headS * 1.5, headS * 1.7, headS * 1.5, rot, look.skin, 1, 8, 0);
    if (look.style === 'cap' || look.style === 'hat') {
      push(x, neckY + headS * 1.55, z, headS * 1.7, headS * 0.5, headS * 1.7, rot, look.hair, 1, 8, 0);
      if (look.style === 'cap') push(x + fx * headS * 1.1, neckY + headS * 1.6, z + fz * headS * 1.1, headS * 1.5, headS * 0.16, headS * 1.1, rot, look.hair, 1, 8, 0);
    } else if (look.style === 'long') {
      push(x, neckY + headS * 0.2, z, headS * 1.65, headS * 1.7, headS * 1.65, rot, look.hair, 1, 8, 0);
      push(x - fx * headS * 0.7, neckY - headS * 0.4, z - fz * headS * 0.7, headS * 1.3, headS * 1.1, headS * 0.5, rot, look.hair, 1, 8, 0);
    } else if (look.style === 'afro') {
      push(x, neckY + headS * 1.0, z, headS * 2.2, headS * 1.4, headS * 2.2, rot, look.hair, 1, 8, 0);
    } else if (look.style === 'bun') {
      push(x, neckY + headS * 1.5, z, headS * 1.55, headS * 0.45, headS * 1.55, rot, look.hair, 1, 8, 0);
      push(x - fx * headS * 0.9, neckY + headS * 1.5, z - fz * headS * 0.9, headS * 0.8, headS * 0.8, headS * 0.8, rot, look.hair, 1, 8, 0);
    } else {
      push(x, neckY + headS * 1.35, z, headS * 1.58, headS * (look.style === 'buzz' ? 0.28 : 0.45), headS * 1.58, rot, look.hair, 1, 8, 0);
    }
    if (look.bag) {
      push(x - rx * 0.30 * b, hipY + torsoLen * 0.25, z - rz * 0.30 * b, 0.14, 0.34, 0.26, rot, [0.28, 0.22, 0.18], 1, 8, 0);
    }
    if (look.umbrella) {
      push(x + rx * 0.3, shoulderY - 0.1, z + rz * 0.3, 0.05, 0.9, 0.05, rot, [0.2, 0.2, 0.22], 1, 0, 0);
      push(x + rx * 0.3, shoulderY + 0.75, z + rz * 0.3, 1.3, 0.22, 1.3, rot, [0.15, 0.18, 0.30], 1, 0, 0);
    }
  };

  /* --------------------------------------------------- sidewalk graph nodes */
  // Sidewalks are the 5m strip between the block face and the kerb; the walking
  // line runs down the middle of it.
  var SW_A = P.AVE_HALF - 2.5;
  var SW_S = P.ST_HALF - 2.5;

  function nodePos(ai, sj, cx, cz) {
    return { x: ai * P.AVE + cx * SW_A, z: sj * P.ST + cz * SW_S };
  }

  function pickNextNode(n, rnd) {
    // n = {ai, sj, cx, cz}
    var opts = [];
    // walk along the avenue (same corner sign in x, step in sj)
    opts.push({ ai: n.ai, sj: n.sj + n.cz, cx: n.cx, cz: -n.cz, cross: false });
    // walk along the street
    opts.push({ ai: n.ai + n.cx, sj: n.sj, cx: -n.cx, cz: n.cz, cross: false });
    // cross the street (change cz at the same intersection)
    opts.push({ ai: n.ai, sj: n.sj, cx: n.cx, cz: -n.cz, cross: 'street' });
    // cross the avenue
    opts.push({ ai: n.ai, sj: n.sj, cx: -n.cx, cz: n.cz, cross: 'avenue' });
    var out = [];
    for (var i = 0; i < opts.length; i++) {
      var o = opts[i];
      var p = nodePos(o.ai, o.sj, o.cx, o.cz);
      if (!P.landAt(p.x, p.z)) continue;
      o.x = p.x; o.z = p.z;
      o.w = o.cross ? 1 : 3;
      out.push(o);
    }
    if (!out.length) return null;
    var total = 0; for (var j = 0; j < out.length; j++) total += out[j].w;
    var r = rnd() * total;
    for (var k = 0; k < out.length; k++) { r -= out[k].w; if (r <= 0) return out[k]; }
    return out[out.length - 1];
  }

  function nearestNode(x, z) {
    var ai = Math.round(x / P.AVE), sj = Math.round(z / P.ST);
    var cx = (x - ai * P.AVE) >= 0 ? 1 : -1;
    var cz = (z - sj * P.ST) >= 0 ? 1 : -1;
    return { ai: ai, sj: sj, cx: cx, cz: cz, x: ai * P.AVE + cx * SW_A, z: sj * P.ST + cz * SW_S };
  }
  A.nearestSidewalkNode = nearestNode;

  /* ------------------------------------------------------------------ NPCs */
  var npcSeed = 1;

  function makeNPC(x, z) {
    var rnd = T10.rng((npcSeed++ * 2654435761) >>> 0);
    var node = nearestNode(x, z);
    var look = makeLook(rnd);
    var n = {
      x: node.x, z: node.z, y: 0, yaw: rnd.range(0, 6.28),
      node: node, target: null, phase: rnd.range(0, 6.28),
      speed: rnd.range(1.15, 1.85), moveAmt: 0, wait: 0, state: 'walk',
      look: look,
      name: rnd.pick(FIRST) + ' ' + rnd.pick(LAST),
      personality: rnd.pick(PERSONALITIES),
      job: rnd.pick(JOBS),
      age: rnd.int(17, 74),
      voice: rnd.range(0.75, 1.4),
      id: 'npc' + npcSeed,
      rnd: rnd,
      talkCooldown: 0
    };
    n.target = pickNextNode(node, rnd);
    return n;
  }

  A.densityForHour = function (mins) {
    var h = (mins / 60) % 24;
    if (h >= 7 && h < 10) return 1.25;
    if (h >= 10 && h < 12) return 0.95;
    if (h >= 12 && h < 14) return 1.15;
    if (h >= 14 && h < 17) return 0.95;
    if (h >= 17 && h < 20) return 1.3;
    if (h >= 20 && h < 23) return 0.85;
    if (h >= 23 || h < 2) return 0.45;
    return 0.22;
  };

  function npcStep(n, dt, ctx) {
    if (n.state === 'wait') {
      n.wait -= dt; n.moveAmt = M.damp(n.moveAmt, 0, 8, dt);
      if (n.wait <= 0) n.state = 'walk';
      return;
    }
    var t = n.target;
    if (!t) { n.target = pickNextNode(n.node, n.rnd); return; }
    var dx = t.x - n.x, dz = t.z - n.z;
    var d = Math.hypot(dx, dz);
    if (d < 0.6) {
      n.node = { ai: t.ai, sj: t.sj, cx: t.cx, cz: t.cz, x: t.x, z: t.z };
      n.x = t.x; n.z = t.z;
      n.target = pickNextNode(n.node, n.rnd);
      if (n.rnd.chance(0.06)) { n.state = 'wait'; n.wait = n.rnd.range(1.5, 6); }
      return;
    }
    // crossing a roadway: obey the signal
    if (t.cross && d > 1.0 && Math.hypot(n.x - n.node.x, n.z - n.node.z) < 0.7) {
      var ph = W.lightPhase(n.node.ai, n.node.sj, ctx.tsec);
      var ok = t.cross === 'street' ? (ph.ns === 'green') : (ph.ew === 'green');
      if (!ok) { n.moveAmt = M.damp(n.moveAmt, 0, 8, dt); return; }
    }
    var sp = n.speed * ctx.speedMul;
    var vx = dx / d * sp, vz = dz / d * sp;
    var nx = n.x + vx * dt, nz = n.z + vz * dt;
    if (W.blocked(nx, nz, 0.35)) {
      var res = W.resolve(nx, nz, 0.35); nx = res.x; nz = res.z;
      if (n.rnd.chance(0.3)) { n.target = pickNextNode(n.node, n.rnd); }
    }
    n.x = nx; n.z = nz;
    n.yaw = M.lerpAngle(n.yaw, Math.atan2(vx, -vz), 1 - Math.exp(-9 * dt));
    n.moveAmt = M.damp(n.moveAmt, 1, 8, dt);
    n.phase += dt * sp * 3.4;
  }

  /* ------------------------------------------------------------- vehicles */
  var VTYPES = [
    { id: 'sedan', w: 1.9, l: 4.5, h: 1.35, weight: 26, speed: 12, cabin: true },
    { id: 'suv', w: 2.05, l: 4.9, h: 1.75, weight: 16, speed: 11.5, cabin: true },
    { id: 'taxi', w: 1.95, l: 4.7, h: 1.5, weight: 20, speed: 12.5, color: [0.95, 0.78, 0.12], taxi: true, cabin: true },
    { id: 'van', w: 2.1, l: 5.4, h: 2.2, weight: 9, speed: 10.5, cabin: true },
    { id: 'truck', w: 2.4, l: 8.2, h: 3.2, weight: 5, speed: 9, box: true },
    { id: 'bus', w: 2.6, l: 12.0, h: 3.3, weight: 4, speed: 9, bus: true },
    { id: 'police', w: 2.0, l: 4.8, h: 1.5, weight: 3, speed: 14, emergency: true, color: [0.12, 0.16, 0.34], cabin: true },
    { id: 'ambulance', w: 2.3, l: 6.0, h: 2.7, weight: 2, speed: 13, emergency: true, color: [0.92, 0.93, 0.95], box: true },
    { id: 'firetruck', w: 2.5, l: 9.0, h: 3.2, weight: 1, speed: 11, emergency: true, color: [0.72, 0.12, 0.10], box: true },
    { id: 'motorcycle', w: 0.8, l: 2.1, h: 1.1, weight: 6, speed: 14, bike: true },
    { id: 'bicycle', w: 0.6, l: 1.7, h: 1.0, weight: 8, speed: 6, bike: true, cyclist: true }
  ];
  A.VTYPES = VTYPES;

  function pickType(rnd) {
    var total = 0, i;
    for (i = 0; i < VTYPES.length; i++) total += VTYPES[i].weight;
    var r = rnd() * total;
    for (i = 0; i < VTYPES.length; i++) { r -= VTYPES[i].weight; if (r <= 0) return VTYPES[i]; }
    return VTYPES[0];
  }

  var vehSeed = 1;
  function makeVehicle(ai, sj, isAve, dir, laneIdx, type) {
    var rnd = T10.rng((vehSeed++ * 40503) >>> 0);
    type = type || pickType(rnd);
    var v = {
      id: 'veh' + vehSeed, type: type, isAve: isAve, idx: isAve ? ai : sj,
      dir: dir, lane: laneIdx, speed: 0, maxSpeed: type.speed * rnd.range(0.85, 1.12),
      x: 0, z: 0, yaw: 0, color: type.color || [rnd.range(0.12, 0.75), rnd.range(0.12, 0.7), rnd.range(0.15, 0.78)],
      along: 0, turnTimer: 0, siren: !!type.emergency && rnd.chance(0.6), rnd: rnd,
      wheelPhase: 0, drivable: false, stoppedFor: 0
    };
    return v;
  }

  function laneOffset(v) {
    // right-hand traffic: +dir sits on the correct side of the centreline.
    // Avenues carry two lanes each way; the narrower cross streets carry one.
    var base = v.isAve ? (3.0 + v.lane * 3.4) : 2.2;
    return -v.dir * base;
  }
  function vehPos(v) {
    if (v.isAve) return { x: v.idx * P.AVE + laneOffset(v), z: v.along };
    return { x: v.along, z: v.idx * P.ST - laneOffset(v) };
  }
  function vehYaw(v) {
    if (v.isAve) return v.dir > 0 ? Math.PI : 0;         // +Z is south
    return v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  A.spawnVehicleNear = function (px, pz, forceType) {
    var rnd = T10.rng((vehSeed * 7919 + Math.floor(px) * 31 + Math.floor(pz)) >>> 0);
    for (var attempt = 0; attempt < 12; attempt++) {
      var isAve = rnd.chance(0.55);
      var idx = isAve ? Math.round(px / P.AVE) + rnd.int(-1, 1) : Math.round(pz / P.ST) + rnd.int(-2, 2);
      var dir = rnd.chance(0.5) ? 1 : -1;
      var lane = isAve ? rnd.int(0, 1) : 0;
      var v = makeVehicle(isAve ? idx : 0, isAve ? 0 : idx, isAve, dir, lane, forceType);
      var ahead = rnd.range(60, 130) * (rnd.chance(0.5) ? 1 : -1);
      v.along = (isAve ? pz : px) + ahead;
      var p = vehPos(v);
      if (!P.landAt(p.x, p.z)) continue;
      if (!W.isRoad(p.x, p.z)) continue;
      v.x = p.x; v.z = p.z; v.yaw = vehYaw(v); v.speed = v.maxSpeed * 0.7;
      A.vehicles.push(v);
      return v;
    }
    return null;
  };

  /* A car the player can actually drive. */
  A.spawnDrivable = function (typeId, x, z, yaw) {
    var type = null;
    for (var i = 0; i < VTYPES.length; i++) if (VTYPES[i].id === typeId) type = VTYPES[i];
    if (!type) type = VTYPES[0];
    var v = makeVehicle(0, 0, true, 1, 0, type);
    v.drivable = true; v.free = true;
    v.x = x; v.z = z; v.yaw = yaw === undefined ? 0 : yaw; v.speed = 0;
    A.vehicles.push(v);
    return v;
  };

  function vehicleAheadDistance(v, limit) {
    var best = limit;
    for (var i = 0; i < A.vehicles.length; i++) {
      var o = A.vehicles[i];
      if (o === v || o.free) continue;
      if (o.isAve !== v.isAve || o.idx !== v.idx || o.dir !== v.dir || o.lane !== v.lane) continue;
      var gap = (o.along - v.along) * v.dir;
      if (gap > 0 && gap < best) best = gap;
    }
    return best;
  }

  function vehStep(v, dt, ctx) {
    if (v.driven) return;   // the player is at the wheel
    if (v.free) { v.speed = M.damp(v.speed, 0, 3, dt); return; }
    var target = v.maxSpeed * ctx.speedMul;

    // signal ahead
    var axisPos = v.along;
    var nextGrid = v.isAve ? P.ST : P.AVE;
    var nextIdx = v.dir > 0 ? Math.ceil(axisPos / nextGrid) : Math.floor(axisPos / nextGrid);
    var stopLine = nextIdx * nextGrid - v.dir * (v.isAve ? P.ST_HALF + 2.5 : P.AVE_HALF + 2.5);
    var toStop = (stopLine - axisPos) * v.dir;
    var ai = v.isAve ? v.idx : nextIdx, sj = v.isAve ? nextIdx : v.idx;
    var ph = W.lightPhase(ai, sj, ctx.tsec);
    var myLight = v.isAve ? ph.ns : ph.ew;
    if (!v.type.emergency && (myLight === 'red' || (myLight === 'yellow' && toStop > 6)) && toStop > -1 && toStop < 26) {
      target = Math.min(target, Math.max(0, (toStop - 1.5) * 1.4));
    }
    // car in front
    var gap = vehicleAheadDistance(v, 40);
    var safe = v.type.l * 0.8 + 3 + v.speed * 0.55;
    if (gap < safe) target = Math.min(target, Math.max(0, v.speed * (gap / Math.max(safe, 0.001)) - 1.2));
    // pedestrians in the roadway right in front
    for (var i = 0; i < ctx.peds.length; i++) {
      var n = ctx.peds[i];
      var rel = ((v.isAve ? n.z : n.x) - v.along) * v.dir;
      if (rel < 0 || rel > 12) continue;
      var lat = Math.abs((v.isAve ? n.x : n.z) - (v.isAve ? v.x : v.z));
      if (lat < 2.2) { target = 0; break; }
    }
    var accel = target > v.speed ? 4.5 : 11;
    v.speed += M.clamp(target - v.speed, -accel * dt, accel * dt);
    v.speed = Math.max(0, v.speed);
    v.along += v.speed * v.dir * dt;
    v.wheelPhase += v.speed * dt;

    var p = vehPos(v);
    v.x = p.x; v.z = p.z; v.yaw = vehYaw(v);

    // turn at an intersection now and then
    var atNode = Math.abs(((v.along % nextGrid) + nextGrid) % nextGrid);
    if (v.speed > 1 && (atNode < 1.2) && v.turnTimer <= 0 && v.rnd.chance(0.35)) {
      v.turnTimer = 3;
      var cross = Math.round(v.along / nextGrid);
      var newIsAve = !v.isAve;
      var newIdx = cross;
      var p2 = { isAve: newIsAve, idx: newIdx, dir: v.rnd.chance(0.5) ? 1 : -1, lane: v.lane };
      var probe = { isAve: newIsAve, idx: newIdx, dir: p2.dir, lane: v.lane, along: v.isAve ? v.idx * P.AVE : v.idx * P.ST };
      var pp = vehPos(probe);
      if (P.landAt(pp.x, pp.z) && W.isRoad(pp.x, pp.z)) {
        v.isAve = newIsAve; v.idx = newIdx; v.dir = p2.dir;
        if (!newIsAve) v.lane = 0;
        v.along = probe.along;
        var np = vehPos(v); v.x = np.x; v.z = np.z; v.yaw = vehYaw(v);
      }
    }
    v.turnTimer -= dt;
  }

  A.drawVehicle = function (push, v, t) {
    var ty = v.type;
    var rot = -v.yaw;
    var y = W.groundHeight(v.x, v.z);
    var fx = Math.sin(v.yaw), fz = -Math.cos(v.yaw);
    if (ty.bike) {
      push(v.x, y + 0.25, v.z, ty.w, 0.35, ty.l, rot, v.color, 1, 9, 0);
      push(v.x, y + 0.05, v.z + 0, 0.14, 0.5, 0.5, rot, [0.08, 0.08, 0.09], 1, 0, 0);
      if (ty.cyclist || ty.id === 'motorcycle') {
        var look = v.riderLook || (v.riderLook = makeLook(v.rnd));
        A.drawPerson(push, v.x, y + 0.5, v.z, v.yaw, v.wheelPhase * 3, ty.cyclist ? 0.7 : 0.05, look, 'sit');
      }
      return;
    }
    var bodyH = ty.h * 0.55;
    push(v.x, y + 0.28, v.z, ty.w, bodyH, ty.l, rot, v.color, 1, 9, 0);
    if (ty.cabin) {
      push(v.x, y + 0.28 + bodyH, v.z - fz * 0.2, ty.w * 0.9, ty.h - bodyH - 0.28, ty.l * 0.52, rot, [0.10, 0.12, 0.16], 1, 4, 0);
    } else if (ty.box) {
      push(v.x, y + 0.28 + bodyH, v.z + fz * (ty.l * 0.18), ty.w * 0.98, ty.h - bodyH - 0.3, ty.l * 0.66, rot, v.color, 1, 9, 0);
      push(v.x, y + 0.28 + bodyH, v.z - fz * (ty.l * 0.34), ty.w * 0.92, ty.h - bodyH - 0.5, ty.l * 0.3, rot, [0.10, 0.12, 0.16], 1, 4, 0);
    } else if (ty.bus) {
      push(v.x, y + 0.28 + bodyH, v.z, ty.w * 0.98, ty.h - bodyH - 0.3, ty.l * 0.94, rot, v.color, 1, 4, 0);
      push(v.x, y + ty.h, v.z, ty.w * 0.9, 0.18, ty.l * 0.9, rot, [0.5, 0.5, 0.52], 1, 0, 0);
    }
    // wheels
    var wz = ty.l * 0.32, wx = ty.w * 0.46;
    for (var s = -1; s <= 1; s += 2) {
      for (var f = -1; f <= 1; f += 2) {
        push(v.x + Math.cos(v.yaw) * wx * s + fx * wz * f, y + 0.02, v.z + Math.sin(v.yaw) * wx * s + fz * wz * f,
          0.24, 0.62, 0.62, rot, [0.07, 0.07, 0.08], 1, 0, 0);
      }
    }
    // lamps
    var night = 1;
    push(v.x + fx * ty.l * 0.48 + Math.cos(v.yaw) * ty.w * 0.3, y + 0.5, v.z + fz * ty.l * 0.48 + Math.sin(v.yaw) * ty.w * 0.3, 0.22, 0.16, 0.12, rot, [1.0, 0.95, 0.8], night, 10, 0);
    push(v.x + fx * ty.l * 0.48 - Math.cos(v.yaw) * ty.w * 0.3, y + 0.5, v.z + fz * ty.l * 0.48 - Math.sin(v.yaw) * ty.w * 0.3, 0.22, 0.16, 0.12, rot, [1.0, 0.95, 0.8], night, 10, 0);
    push(v.x - fx * ty.l * 0.48, y + 0.55, v.z - fz * ty.l * 0.48, ty.w * 0.8, 0.14, 0.1, rot, [0.9, 0.12, 0.08], 1, 10, 0);
    if (ty.taxi) {
      push(v.x, y + ty.h * 0.92, v.z, 0.8, 0.22, 0.3, rot, [0.95, 0.8, 0.2], v.hired ? 0.2 : 1.4, 10, 0);
    }
    if (ty.emergency) {
      var blink = Math.sin(t * 14) > 0;
      push(v.x - 0.4, y + ty.h * 0.95, v.z, 0.5, 0.16, 0.3, rot, blink ? [1, 0.15, 0.1] : [0.3, 0.05, 0.05], blink ? 2.2 : 0.2, 10, 0);
      push(v.x + 0.4, y + ty.h * 0.95, v.z, 0.5, 0.16, 0.3, rot, blink ? [0.15, 0.3, 1] : [0.05, 0.06, 0.3], blink ? 0.2 : 2.2, 10, 0);
    }
  };

  /* ------------------------------------------------------------ interiors */
  A.setInterior = function (scene) {
    A.interiorNpcs.length = 0;
    if (!scene) return;
    for (var i = 0; i < scene.npcs.length; i++) {
      var sp = scene.npcs[i];
      var rnd = T10.rng((i * 6247 + scene.title.length * 31) >>> 0);
      A.interiorNpcs.push({
        x: sp.x, z: sp.z, y: 0, floor: sp.floor || 0, yaw: sp.yaw === undefined ? rnd.range(0, 6.28) : sp.yaw,
        look: makeLook(rnd), phase: rnd.range(0, 6.28), moveAmt: 0,
        role: sp.role, sit: !!sp.sit,
        name: rnd.pick(FIRST) + ' ' + rnd.pick(LAST),
        personality: rnd.pick(PERSONALITIES),
        job: sp.role || rnd.pick(JOBS),
        age: rnd.int(18, 70), id: 'inpc' + i, rnd: rnd,
        home: { x: sp.x, z: sp.z }, wander: rnd.range(0, 6.28)
      });
    }
  };

  function interiorStep(n, dt, t) {
    if (n.sit) { n.moveAmt = 0; return; }
    n.wander += dt * 0.3;
    var tx = n.home.x + Math.sin(n.wander * 0.7) * 1.8;
    var tz = n.home.z + Math.cos(n.wander * 0.5) * 1.8;
    var dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
    if (d > 0.12) {
      var sp = Math.min(0.8, d * 2);
      n.x += dx / d * sp * dt; n.z += dz / d * sp * dt;
      n.yaw = M.lerpAngle(n.yaw, Math.atan2(dx, -dz), 1 - Math.exp(-6 * dt));
      n.moveAmt = M.damp(n.moveAmt, Math.min(1, sp), 6, dt);
      n.phase += dt * sp * 4;
    } else n.moveAmt = M.damp(n.moveAmt, 0, 6, dt);
  }

  /* ---------------------------------------------------------------- update */
  A.clear = function () { A.npcs.length = 0; A.vehicles.length = 0; };

  A.update = function (dt, px, pz, ctx) {
    var st = T10.state;
    var hourMul = A.densityForHour(st.time.minutes);
    var weatherMul = ctx.weatherCrowdMul === undefined ? 1 : ctx.weatherCrowdMul;
    var wantNpc = Math.round(A.maxNpc * hourMul * weatherMul * st.world.npcDensity * ctx.perfMul);
    var wantVeh = Math.round(A.maxVeh * hourMul * st.world.trafficDensity * ctx.perfMul);

    // despawn far away
    var i, n;
    for (i = A.npcs.length - 1; i >= 0; i--) {
      n = A.npcs[i];
      if (M.dist2(n.x, n.z, px, pz) > 190 * 190) A.npcs.splice(i, 1);
    }
    for (i = A.vehicles.length - 1; i >= 0; i--) {
      var v = A.vehicles[i];
      if (v.driven || v.free) continue;
      if (M.dist2(v.x, v.z, px, pz) > 230 * 230) A.vehicles.splice(i, 1);
    }
    // spawn up to the target
    var guard = 0;
    while (A.npcs.length < wantNpc && guard++ < 6) {
      var ang = Math.random() * Math.PI * 2, rad = 60 + Math.random() * 110;
      var sx = px + Math.cos(ang) * rad, sz = pz + Math.sin(ang) * rad;
      if (!P.landAt(sx, sz)) continue;
      A.npcs.push(makeNPC(sx, sz));
    }
    guard = 0;
    while (A.vehicles.length < wantVeh && guard++ < 5) { if (!A.spawnVehicleNear(px, pz)) break; }

    var pedsNear = [];
    for (i = 0; i < A.npcs.length; i++) {
      n = A.npcs[i];
      if (W.isRoad(n.x, n.z)) pedsNear.push(n);
    }
    var vctx = { tsec: ctx.tsec, speedMul: ctx.trafficSpeedMul || 1, peds: pedsNear };
    var nctx = { tsec: ctx.tsec, speedMul: ctx.pedSpeedMul || 1 };

    for (i = 0; i < A.npcs.length; i++) {
      n = A.npcs[i];
      n.look.umbrella = ctx.rain > 0.35 && (i % 3 !== 0);
      if (n.talkCooldown > 0) n.talkCooldown -= dt;
      npcStep(n, dt, nctx);
      n.y = W.groundHeight(n.x, n.z);
    }
    for (i = 0; i < A.vehicles.length; i++) vehStep(A.vehicles[i], dt, vctx);
    for (i = 0; i < A.interiorNpcs.length; i++) interiorStep(A.interiorNpcs[i], dt, ctx.tsec);
  };

  A.draw = function (push, t, indoor, floor) {
    var i;
    if (indoor) {
      var O = T10.Interiors.ORIGIN;
      for (i = 0; i < A.interiorNpcs.length; i++) {
        var n = A.interiorNpcs[i];
        if ((n.floor || 0) !== floor) continue;
        A.drawPerson(push, O.x + n.x, floor * T10.Interiors.FLOOR_H, O.z + n.z, n.yaw, n.phase, n.moveAmt, n.look, n.sit ? 'sit' : null);
      }
      return;
    }
    for (i = 0; i < A.npcs.length; i++) {
      var p = A.npcs[i];
      A.drawPerson(push, p.x, p.y, p.z, p.yaw, p.phase, p.moveAmt, p.look, null);
    }
    for (i = 0; i < A.vehicles.length; i++) A.drawVehicle(push, A.vehicles[i], t);
  };

  A.nearestNPC = function (x, z, radius, indoor, floor) {
    var list = indoor ? A.interiorNpcs : A.npcs;
    var best = null, bd = radius * radius;
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (indoor && (n.floor || 0) !== floor) continue;
      var d = M.dist2(x, z, n.x, n.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  };

  A.nearestVehicle = function (x, z, radius, filter) {
    var best = null, bd = radius * radius;
    for (var i = 0; i < A.vehicles.length; i++) {
      var v = A.vehicles[i];
      if (filter && !filter(v)) continue;
      var d = M.dist2(x, z, v.x, v.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  };

  /* ------------------------------------------------------------- dialogue */
  var SMALLTALK = {
    friendly: ['Beautiful day to be out here, right?', 'You look like you know where you\'re going. Lucky you.',
      'I moved here five years ago and I still get lost.', 'If you need directions, just ask. Seriously.'],
    rushed: ['Sorry — running late. Always running late.', 'Can\'t talk, the train\'s coming.', 'Excuse me, excuse me!'],
    tired: ['Double shift. Don\'t ask.', 'I have been awake since four in the morning.', 'Coffee is the only thing holding me together.'],
    chatty: ['Did you hear they\'re redoing the whole block? Took them two years last time.',
      'My cousin swears the pizza two streets over is better. He\'s wrong.',
      'You ever notice how the city smells different after it rains?'],
    guarded: ['Yeah?', 'I\'m good, thanks.', 'Mm-hm.'],
    cheerful: ['Hey! Great to see a friendly face.', 'I love this block. Best light in the afternoon.', 'Have a good one!'],
    blunt: ['You\'re standing in the way.', 'What do you need?', 'Make it quick.'],
    dreamy: ['Sometimes I just watch the lights come on and forget where I was headed.',
      'The buildings look taller at night, don\'t they?', 'I was going somewhere. It\'ll come back to me.']
  };
  var WEATHER_TALK = {
    rain: ['This rain came out of nowhere.', 'My shoes are done for.', 'Should have brought the good umbrella.'],
    storm: ['Did you hear that thunder?', 'I\'m getting inside before this gets worse.'],
    snow: ['Snow always makes it quiet for about an hour.', 'They never salt this block.'],
    fog: ['Can\'t see the tops of the buildings today.', 'Feels like the city ends two blocks over.'],
    clear: ['Not a cloud up there.', 'Perfect walking weather.']
  };
  var TIME_TALK = {
    morning: ['Morning. Or what\'s left of it.', 'Commute was brutal today.'],
    afternoon: ['Lunch rush is finally over.', 'Half the day gone already.'],
    evening: ['Heading home. Finally.', 'Everyone leaves at the same time. Every day.'],
    night: ['City looks good this time of night.', 'The good places are just opening up.'],
    late: ['You\'re out late too, huh?', 'Nothing good happens after two. That\'s why I like it.']
  };

  A.talkLine = function (n, ctx) {
    var pool = [];
    pool = pool.concat(SMALLTALK[n.personality] || SMALLTALK.friendly);
    if (WEATHER_TALK[ctx.weather]) pool = pool.concat(WEATHER_TALK[ctx.weather]);
    if (TIME_TALK[ctx.period]) pool = pool.concat(TIME_TALK[ctx.period]);
    var rel = T10.state.progress.relationships[n.id];
    if (rel && rel.level >= 2) {
      pool = pool.concat(['Good to see you again.', 'You again! This city is smaller than it looks.',
        'How\'ve you been? Still walking everywhere?']);
    }
    if (n.job) pool.push('I\'m a ' + n.job + '. Pays the rent. Barely.');
    return pool[Math.floor(Math.random() * pool.length)];
  };

  A.meet = function (n) {
    var rels = T10.state.progress.relationships;
    var r = rels[n.id];
    if (!r) {
      r = rels[n.id] = { name: n.name, level: 1, met: 1, job: n.job, personality: n.personality };
      T10.emit('met_npc', { npc: n, first: true });
    } else {
      r.met++;
      if (r.met % 3 === 0) r.level = Math.min(5, r.level + 1);
    }
    return r;
  };

})(typeof window !== 'undefined' ? window : globalThis);
