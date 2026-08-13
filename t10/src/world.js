/* T10 WORLD — the city itself
 * Streamed, procedurally generated geometry: street grid, blocks, buildings,
 * parks, waterfront, bridges and hand-placed landmarks. Chunks are generated
 * on demand around the player and cached.
 */
(function (global) {
  'use strict';
  var T10 = global.T10;
  var P = T10.Places;
  var M = T10.M;
  var R = T10.Renderer;

  var W = T10.World = {};

  var CH = W.CH = 200;                 // chunk size in metres
  var CHUNK_RADIUS = CH * 0.71 + 90;   // bounding radius used for culling

  W.chunks = {};       // key -> chunk record (loaded on GPU)
  W.cache = {};        // key -> { arr, colliders } for quick re-upload
  W.cacheOrder = [];
  W.pending = [];
  W.generatedCount = 0;

  function key(cx, cz) { return cx + '_' + cz; }
  W.chunkOf = function (x, z) { return [Math.floor(x / CH), Math.floor(z / CH)]; };

  /* ------------------------------------------------------------ road grid */
  W.isRoad = function (x, z) {
    var ax = Math.abs(x - Math.round(x / P.AVE) * P.AVE);
    var az = Math.abs(z - Math.round(z / P.ST) * P.ST);
    var ai = Math.round(x / P.AVE), sj = Math.round(z / P.ST);
    var onAve = ai >= P.AVE_MIN - 12 && ai <= P.AVE_MAX + 14 && ax < P.AVE_HALF;
    var onSt = sj >= P.ST_MIN - 8 && sj <= P.ST_MAX + 14 && az < P.ST_HALF;
    return onAve || onSt;
  };
  W.laneCenter = function (i, isAve) { return i * (isAve ? P.AVE : P.ST); };

  /* Traffic light phase: 34s cycle shared by the whole city, offset per
     intersection so the grid does not blink in unison. */
  W.lightPhase = function (ai, sj, t) {
    var off = ((ai * 7 + sj * 13) % 5) * 3;
    var c = (t + off) % 34;
    if (c < 15) return { ns: 'green', ew: 'red' };
    if (c < 18) return { ns: 'yellow', ew: 'red' };
    if (c < 32) return { ns: 'red', ew: 'green' };
    return { ns: 'red', ew: 'yellow' };
  };

  /* --------------------------------------------------------------- bridges */
  function bridgeAt(x, z) {
    for (var i = 0; i < P.bridges.length; i++) {
      var b = P.bridges[i];
      var dx = b.x1 - b.x0, dz = b.z1 - b.z0;
      var len2 = dx * dx + dz * dz;
      var t = ((x - b.x0) * dx + (z - b.z0) * dz) / len2;
      if (t < -0.22 || t > 1.22) continue;
      var tc = M.clamp(t, 0, 1);
      var px = b.x0 + dx * tc, pz = b.z0 + dz * tc;
      var d = Math.hypot(x - px, z - pz);
      if (d > b.w * 0.5 + 1.5) continue;
      return { b: b, t: t, dist: d };
    }
    return null;
  }
  W.bridgeAt = bridgeAt;

  function bridgeHeight(b, t) {
    if (t <= 0) return M.lerp(0, b.deck * 0.35, M.clamp(1 + t / 0.22, 0, 1));
    if (t >= 1) return M.lerp(b.deck * 0.35, 0, M.clamp((t - 1) / 0.22, 0, 1));
    // ramp up over the first/last 18% then a gentle arc across the span
    var ramp = M.smoothstep(0, 0.18, t) * M.smoothstep(1, 0.82, t);
    return b.deck * (0.35 + 0.65 * ramp) + Math.sin(t * Math.PI) * b.deck * 0.16;
  }

  /* -------------------------------------------------------------- terrain */
  W.groundHeight = function (x, z) {
    var br = bridgeAt(x, z);
    if (br) return bridgeHeight(br.b, br.t);
    return 0;
  };

  /* The chunk builder paves the world in cells; a cell is either land or water.
     Walkability is decided the same way, so the ground you can see is exactly
     the ground you can stand on — no invisible edges. */
  var CELL = CH / 4;
  function cellCentre(v) { return Math.floor(v / CELL) * CELL + CELL / 2; }
  W.cellIsLand = function (x, z) { return P.landAt(cellCentre(x), cellCentre(z)) !== null; };

  function onPier(x, z) {
    for (var i = 0; i < P.features.length; i++) {
      var f = P.features[i];
      if (f.kind !== 'pier') continue;
      if (Math.abs(x - f.x) < f.w / 2 + 1 && Math.abs(z - f.z) < f.d / 2 + 1) return true;
    }
    return false;
  }

  W.isWalkable = function (x, z) {
    if (bridgeAt(x, z)) return true;
    if (P.landAt(x, z)) return true;
    if (onPier(x, z)) return true;
    return W.cellIsLand(x, z);
  };

  /* --------------------------------------------------------- block layout */
  function blockRect(ai, sj) {
    return {
      x0: ai * P.AVE + P.AVE_HALF, x1: (ai + 1) * P.AVE - P.AVE_HALF,
      z0: sj * P.ST + P.ST_HALF, z1: (sj + 1) * P.ST - P.ST_HALF
    };
  }

  function featureCovers(x, z, pad) {
    pad = pad || 0;
    for (var i = 0; i < P.features.length; i++) {
      var f = P.features[i];
      if (f.kind === 'elevated_park') continue;
      if (Math.abs(x - f.x) < f.w / 2 + pad && Math.abs(z - f.z) < f.d / 2 + pad) return f;
    }
    return null;
  }

  /* ------------------------------------------------------- geometry pieces */
  var GRASS = [0.24, 0.42, 0.20], PATH = [0.55, 0.51, 0.45];
  var SIDEWALK = [0.55, 0.55, 0.57], ASPHALT = [0.21, 0.21, 0.23];
  var WATER = [0.10, 0.20, 0.30];

  function addTree(B, x, z, y, rnd, scale) {
    scale = scale || 1;
    var h = rnd.range(4.5, 8.5) * scale;
    var tint = rnd.range(-0.05, 0.06);
    B.push(x, y, z, 0.55 * scale, h * 0.55, 0.55 * scale, 0, [0.28, 0.20, 0.14], 1, 0, 0);
    var cy = y + h * 0.45, cs = rnd.range(3.0, 4.6) * scale;
    B.push(x, cy, z, cs, cs * 0.72, cs, rnd.range(0, 1.5), [0.20 + tint, 0.40 + tint, 0.17], 1, 5, rnd.range(0, 9));
    B.push(x + rnd.range(-0.8, 0.8), cy + cs * 0.42, z + rnd.range(-0.8, 0.8), cs * 0.72, cs * 0.6, cs * 0.72,
      rnd.range(0, 1.5), [0.22 + tint, 0.44 + tint, 0.19], 1, 5, rnd.range(0, 9));
  }

  function addLamp(B, x, z, y, rot) {
    B.push(x, y, z, 0.22, 7.2, 0.22, 0, [0.18, 0.19, 0.21], 1, 0, 0);
    B.push(x + Math.sin(rot) * 1.1, y + 6.9, z - Math.cos(rot) * 1.1, 2.4, 0.24, 0.3, rot, [0.18, 0.19, 0.21], 1, 0, 0);
    B.push(x + Math.sin(rot) * 2.1, y + 6.6, z - Math.cos(rot) * 2.1, 0.72, 0.34, 0.5, rot, [1.0, 0.86, 0.62], 1, 10, 0);
  }

  function addCrosswalk(B, x, z, y, alongX) {
    var n = 6;
    var span = alongX ? (P.ST_HALF - 4) * 2 : (P.AVE_HALF - 4) * 2;   // kerb to kerb
    for (var i = 0; i < n; i++) {
      var o = (i - (n - 1) / 2) * 2.2;
      if (alongX) B.push(x + o, y + 0.02, z, 0.8, 0.03, span, 0, [0.78, 0.78, 0.76], 1, 0, 0);
      else B.push(x, y + 0.02, z + o, span, 0.03, 0.8, 0, [0.78, 0.78, 0.76], 1, 0, 0);
    }
  }

  function addTrafficSignal(B, x, z, y, rot) {
    B.push(x, y, z, 0.26, 6.4, 0.26, 0, [0.16, 0.17, 0.18], 1, 0, 0);
    B.push(x + Math.sin(rot) * 1.6, y + 6.1, z - Math.cos(rot) * 1.6, 3.4, 0.2, 0.24, rot, [0.16, 0.17, 0.18], 1, 0, 0);
    B.push(x + Math.sin(rot) * 3.1, y + 5.3, z - Math.cos(rot) * 3.1, 0.5, 1.3, 0.4, rot, [0.10, 0.10, 0.11], 1, 0, 0);
  }

  function addBench(B, x, z, y, rot) {
    B.push(x, y + 0.42, z, 1.9, 0.12, 0.6, rot, [0.42, 0.30, 0.20], 1, 0, 0);
    B.push(x - Math.cos(rot) * 0.28, y + 0.42, z - Math.sin(rot) * 0.28, 1.9, 0.55, 0.12, rot, [0.42, 0.30, 0.20], 1, 0, 0);
    B.push(x, y, z, 1.8, 0.42, 0.1, rot, [0.22, 0.22, 0.24], 1, 0, 0);
  }

  function addCarStatic(B, x, z, y, rot, rnd) {
    var c = [rnd.range(0.15, 0.7), rnd.range(0.15, 0.7), rnd.range(0.2, 0.75)];
    B.push(x, y + 0.35, z, 1.9, 0.75, 4.4, rot, c, 1, 9, 0);
    B.push(x, y + 1.05, z - 0.2, 1.72, 0.62, 2.3, rot, [0.10, 0.12, 0.16], 1, 4, 0);
    B.push(x, y + 0.16, z, 2.0, 0.32, 4.5, rot, [0.08, 0.08, 0.09], 1, 0, 0);
  }

  function addFireEscape(D, cx, cz, w, h, faceZ, rnd) {
    var levels = Math.min(6, Math.floor(h / 4));
    var fx = cx + rnd.range(-w * 0.2, w * 0.2);
    for (var i = 1; i <= levels; i++) {
      var y = 0.2 + i * 3.6;
      D.push(fx, y, faceZ, Math.min(4.2, w * 0.5), 0.12, 1.3, 0, [0.22, 0.20, 0.19], 1, 0, 0);   // platform
      D.push(fx, y, faceZ + (faceZ > cz ? 0.6 : -0.6), Math.min(4.2, w * 0.5), 1.0, 0.08, 0, [0.24, 0.22, 0.21], 1, 0, 0);
      D.push(fx + 1.6, y - 1.7, faceZ, 0.1, 1.8, 1.1, 0.5, [0.22, 0.20, 0.19], 1, 0, 0);          // ladder run
    }
    D.push(fx - 2.0, 0.2, faceZ, 0.1, 0.2 + levels * 3.6, 0.1, 0, [0.22, 0.20, 0.19], 1, 0, 0);
    D.push(fx + 2.0, 0.2, faceZ, 0.1, 0.2 + levels * 3.6, 0.1, 0, [0.22, 0.20, 0.19], 1, 0, 0);
  }

  function addAcUnits(D, cx, cz, w, h, faceZ, rnd) {
    var n = Math.min(4, Math.floor(h / 9));
    for (var i = 0; i < n; i++) {
      if (!rnd.chance(0.5)) continue;
      D.push(cx + rnd.range(-w * 0.4, w * 0.4), 4.0 + i * 3.6, faceZ, 0.7, 0.45, 0.45, 0, [0.34, 0.35, 0.37], 1, 9, 0);
    }
  }

  /* Kerbside clutter: meters, bollards, mailboxes, bags, grates, planters. */
  function addStreetProps(D, x, z, rnd, colliders) {
    var r = rnd();
    if (r < 0.16) {                                   // parking meter
      D.push(x, 0.17, z, 0.13, 1.25, 0.13, 0, [0.30, 0.32, 0.34], 1, 9, 0);
      D.push(x, 1.42, z, 0.22, 0.34, 0.18, 0, [0.16, 0.17, 0.19], 1, 0, 0);
    } else if (r < 0.28) {                            // mailbox
      D.push(x, 0.17, z, 0.75, 1.15, 0.6, rnd.range(0, 0.4), [0.14, 0.28, 0.55], 1, 9, 0);
      D.push(x, 1.32, z, 0.78, 0.18, 0.63, 0, [0.12, 0.24, 0.48], 1, 0, 0);
    } else if (r < 0.42) {                            // rubbish bags
      for (var b = 0; b < 3; b++) {
        D.push(x + rnd.range(-0.7, 0.7), 0.17, z + rnd.range(-0.35, 0.35),
          rnd.range(0.5, 0.8), rnd.range(0.4, 0.7), rnd.range(0.5, 0.8), rnd.range(0, 1.5), [0.09, 0.09, 0.10], 1, 0, 0);
      }
    } else if (r < 0.52) {                            // sidewalk grate
      D.push(x, 0.175, z, 1.5, 0.03, 1.1, 0, [0.20, 0.20, 0.21], 1, 9, 0);
    } else if (r < 0.60) {                            // planter
      D.push(x, 0.17, z, 1.1, 0.65, 1.1, 0, [0.42, 0.38, 0.34], 1, 6, 0);
      D.push(x, 0.8, z, 1.0, 0.9, 1.0, rnd.range(0, 1.5), [0.22, 0.42, 0.20], 1, 5, rnd.range(0, 9));
    } else if (r < 0.66) {                            // bollards
      for (var i = 0; i < 3; i++) D.push(x + (i - 1) * 1.3, 0.17, z, 0.2, 0.85, 0.2, 0, [0.35, 0.30, 0.14], 1, 9, 0);
    } else if (r < 0.70) {                            // news stand
      D.push(x, 0.17, z, 2.4, 2.3, 1.5, 0, [0.20, 0.24, 0.32], 1, 0, 0);
      D.push(x, 2.5, z, 2.6, 0.2, 1.7, 0, [0.55, 0.16, 0.14], 1, 0, 0);
      if (colliders) colliders.push(x - 1.2, z - 0.75, x + 1.2, z + 0.75);
    }
  }

  /* Lane markings — centre lines, lane dashes and stop bars. */
  function addRoadMarkings(D, x0, z0, size) {
    var i, t, dash = 2.4, gap = 5.0;
    var a0 = Math.floor(x0 / P.AVE), a1 = Math.ceil((x0 + size) / P.AVE);
    for (i = a0; i <= a1; i++) {
      var ax = i * P.AVE;
      if (ax < x0 || ax >= x0 + size) continue;
      for (t = z0; t < z0 + size; t += dash + gap) {
        if (Math.abs(t - Math.round(t / P.ST) * P.ST) < P.ST_HALF + 2) continue;   // skip junctions
        if (!P.landAt(ax, t)) continue;
        D.push(ax - 0.35, 0.04, t, 0.16, 0.03, dash, 0, [0.72, 0.62, 0.18], 1, 0, 0);
        D.push(ax + 0.35, 0.04, t, 0.16, 0.03, dash, 0, [0.72, 0.62, 0.18], 1, 0, 0);
        D.push(ax - 4.9, 0.04, t, 0.14, 0.03, dash, 0, [0.80, 0.80, 0.78], 1, 0, 0);
        D.push(ax + 4.9, 0.04, t, 0.14, 0.03, dash, 0, [0.80, 0.80, 0.78], 1, 0, 0);
      }
    }
    var s0 = Math.floor(z0 / P.ST), s1 = Math.ceil((z0 + size) / P.ST);
    for (i = s0; i <= s1; i++) {
      var sz = i * P.ST;
      if (sz < z0 || sz >= z0 + size) continue;
      for (t = x0; t < x0 + size; t += dash + gap) {
        if (Math.abs(t - Math.round(t / P.AVE) * P.AVE) < P.AVE_HALF + 2) continue;
        if (!P.landAt(t, sz)) continue;
        D.push(t, 0.04, sz, dash, 0.03, 0.16, 0, [0.72, 0.62, 0.18], 1, 0, 0);
      }
    }
  }

  /* One building: base mass + optional setback + roof clutter. */
  function addBuilding(B, D, cx, cz, w, d, h, rnd, pal, colliders, y, faceZ) {
    y = y || 0;
    var pc = pal[rnd.int(0, pal.length - 1)];
    var tint = rnd.range(-0.045, 0.045);
    var col = [M.clamp(pc[0] + tint, 0, 1), M.clamp(pc[1] + tint, 0, 1), M.clamp(pc[2] + tint, 0, 1)];
    var seed = rnd.range(0, 50);
    var setback = h > 70 && rnd.chance(0.65);
    var baseH = setback ? h * rnd.range(0.55, 0.75) : h;
    B.push(cx, y, cz, w, baseH, d, 0, col, 1, 1, seed);
    if (setback) {
      var w2 = w * rnd.range(0.6, 0.82), d2 = d * rnd.range(0.6, 0.82);
      B.push(cx, y + baseH, cz, w2, h - baseH, d2, 0, col, 1, 1, seed + 3);
      if (rnd.chance(0.4)) B.push(cx, y + h, cz, w2 * 0.3, rnd.range(6, 26), d2 * 0.3, 0, [0.3, 0.3, 0.33], 1, 0, 0);
    }
    // cornice
    B.push(cx, y + baseH, cz, w * 1.04, 0.6, d * 1.04, 0, [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8], 1, 0, 0);
    // roof clutter
    var top = y + h;
    if (h < 60 && rnd.chance(0.5)) {
      B.push(cx + rnd.range(-w * 0.25, w * 0.25), top, cz + rnd.range(-d * 0.25, d * 0.25),
        2.4, 3.2, 2.4, 0, [0.36, 0.28, 0.22], 1, 0, 0);   // water tower
      B.push(cx, top + 3.2, cz, 0.3, 0.3, 0.3, 0, [0.3, 0.3, 0.3], 1, 0, 0);
    }
    if (rnd.chance(0.6)) B.push(cx + rnd.range(-w * 0.3, w * 0.3), top, cz + rnd.range(-d * 0.3, d * 0.3), 1.6, 0.9, 1.6, 0, [0.4, 0.41, 0.43], 1, 0, 0);
    if (h > 120 && rnd.chance(0.7)) B.push(cx, top, cz, 0.4, rnd.range(8, 20), 0.4, 0, [0.5, 0.2, 0.2], 1, 10, 0);
    if (D) {
      // parapet, roof rails and a couple of vents read as detail up close
      D.push(cx, top, cz, w * 1.02, 0.9, d * 1.02, 0, [col[0] * 0.86, col[1] * 0.86, col[2] * 0.86], 1, 0, 0);
      if (rnd.chance(0.5)) D.push(cx + rnd.range(-w * 0.3, w * 0.3), top, cz + rnd.range(-d * 0.3, d * 0.3), 0.9, 1.4, 0.9, 0, [0.42, 0.42, 0.44], 1, 9, 0);
      if (faceZ !== undefined && h < 46 && rnd.chance(0.55)) addFireEscape(D, cx, cz, w, h, faceZ, rnd);
      if (faceZ !== undefined && rnd.chance(0.45)) addAcUnits(D, cx, cz, w, h, faceZ, rnd);
      // a single cornice band rather than a ledge per floor, which read as stripes
      if (faceZ !== undefined && h > 14) {
        D.push(cx, 0.2 + Math.min(h - 1.2, 11.0), faceZ, w * 0.98, 0.3, 0.3, 0,
          [col[0] * 0.72, col[1] * 0.72, col[2] * 0.74], 1, 0, 0);
      }
    }
    if (colliders) colliders.push(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
  }

  /* A city block: sidewalk slab, two rows of buildings, street furniture. */
  function buildBlock(B, D, ai, sj, dist, colliders) {
    var r = blockRect(ai, sj);
    var rnd = T10.rng((ai * 73856093) ^ (sj * 19349663) ^ 0x9e3779b9);
    var cxm = (r.x0 + r.x1) / 2, czm = (r.z0 + r.z1) / 2;
    var bw = r.x1 - r.x0, bd = r.z1 - r.z0;

    // sidewalk: the block plus a 5m strip out to the kerb on every side
    B.push(cxm, 0, czm, bw + 10, 0.17, bd + 10, 0, SIDEWALK, 1, 6, 0);

    if (dist.type === 'park') { buildParkBlock(B, D, r, rnd, dist, colliders); return; }
    if (dist.type === 'beach') { buildBeachBlock(B, D, r, rnd, colliders); return; }

    var pal = P.palettes[dist.pal] || P.palettes[0];
    var hmin = dist.h[0], hmax = dist.h[1];

    // occasional open lot: a small park, a court or a parking lot
    if (rnd.chance(0.09)) {
      var kind = rnd.int(0, 2);
      if (kind === 0) { buildParkBlock(B, D, r, rnd, dist, colliders); return; }
      if (kind === 1) { buildCourtBlock(B, D, r, rnd, colliders); return; }
      B.push(cxm, 0.18, czm, bw, 0.04, bd, 0, [0.20, 0.20, 0.22], 1, 2, 0);
      for (var pc = 0; pc < 8; pc++) addCarStatic(B, r.x0 + 3 + (pc % 4) * 6, r.z0 + 4 + Math.floor(pc / 4) * 9, 0.2, 0, rnd);
      return;
    }

    var rowDepth = Math.min(30, bd * 0.46);
    var rows = [
      { z: r.z0 + rowDepth / 2, d: rowDepth },
      { z: r.z1 - rowDepth / 2, d: rowDepth }
    ];
    for (var ri = 0; ri < rows.length; ri++) {
      var x = r.x0;
      var guard = 0;
      while (x < r.x1 - 6 && guard++ < 40) {
        var lw = Math.min(rnd.range(13, 30), r.x1 - x);
        if (r.x1 - (x + lw) < 10) lw = r.x1 - x;
        var corner = (x < r.x0 + 2) || (x + lw > r.x1 - 2);
        var h = rnd.range(hmin, hmax);
        if (corner) h *= rnd.range(1.0, 1.35);
        if (rnd.chance(0.05)) h *= rnd.range(1.4, 2.1);        // the odd tower
        h = Math.max(8, h);
        var side = ri === 0 ? -1 : 1;
        var faceZ = rows[ri].z + side * (rows[ri].d / 2 + 0.05);
        addBuilding(B, D, x + lw / 2, rows[ri].z, lw - 0.6, rows[ri].d, h, rnd, pal, colliders, 0.17, faceZ);
        // storefront awning toward the street
        if (rnd.chance(0.45)) {
          var az = rows[ri].z + side * (rows[ri].d / 2 + 1.0);
          D.push(x + lw / 2, 3.1, az, lw - 2, 0.25, 2.2, 0,
            [rnd.range(0.2, 0.8), rnd.range(0.15, 0.5), rnd.range(0.15, 0.5)], 1, 0, 0);
          if (rnd.chance(0.4)) D.push(x + lw / 2, 3.42, az, (lw - 2) * 0.6, 0.42, 0.12, 0, [0.14, 0.14, 0.16], 1, 7, rnd.range(0, 20));
        }
        // stoop with a rail
        if (rnd.chance(0.3)) {
          var sz2 = rows[ri].z + side * (rows[ri].d / 2 + 0.8);
          D.push(x + lw / 2, 0.17, sz2, 2.4, 0.9, 1.6, 0, [0.45, 0.42, 0.40], 1, 6, 0);
          D.push(x + lw / 2 - 1.1, 1.07, sz2, 0.1, 0.95, 1.6, 0, [0.20, 0.20, 0.22], 1, 9, 0);
          D.push(x + lw / 2 + 1.1, 1.07, sz2, 0.1, 0.95, 1.6, 0, [0.20, 0.20, 0.22], 1, 9, 0);
        }
        x += lw;
      }
    }

    // interior courtyard strip
    B.push(cxm, 0.17, czm, bw - 2, 0.05, Math.max(2, bd - rowDepth * 2 - 2), 0, [0.30, 0.30, 0.32], 1, 6, 0);

    // street furniture along the curbs
    var n = Math.max(2, Math.floor(bw / 30));
    for (var i = 0; i <= n; i++) {
      var lx = r.x0 + (bw / n) * i;
      addLamp(D, lx, r.z0 - 4.0, 0.17, Math.PI);
      addLamp(D, lx, r.z1 + 4.0, 0.17, 0);
      if (rnd.chance(0.6)) addTree(B, lx + 8, r.z0 - 3.8, 0.17, rnd, 0.9);
      if (rnd.chance(0.55)) addTree(B, lx - 6, r.z1 + 3.8, 0.17, rnd, 0.9);
      if (rnd.chance(0.35)) D.push(lx + 3, 0.17, r.z0 - 3.9, 0.5, 0.9, 0.5, 0, [0.7, 0.25, 0.2], 1, 0, 0);  // hydrant
      if (rnd.chance(0.3)) D.push(lx - 4, 0.17, r.z1 + 3.9, 0.8, 1.1, 0.8, 0, [0.16, 0.28, 0.20], 1, 0, 0); // trash can
      addStreetProps(D, lx + rnd.range(-6, 6), r.z0 - 3.7, rnd, colliders);
      addStreetProps(D, lx + rnd.range(-6, 6), r.z1 + 3.7, rnd, colliders);
    }
    // scaffolding — it is New York, after all
    if (rnd.chance(0.14)) {
      for (var sx = r.x0; sx < r.x1; sx += 4) {
        D.push(sx, 0.17, r.z0 - 2.2, 0.2, 5.2, 0.2, 0, [0.35, 0.32, 0.28], 1, 0, 0);
        D.push(sx, 0.17, r.z0 - 3.4, 0.2, 5.2, 0.2, 0, [0.35, 0.32, 0.28], 1, 0, 0);
      }
      D.push(cxm, 5.3, r.z0 - 2.8, bw, 0.3, 4.4, 0, [0.30, 0.30, 0.32], 1, 0, 0);
      D.push(cxm, 5.6, r.z0 - 2.8, bw, 0.5, 0.2, 0, [0.75, 0.35, 0.12], 1, 0, 0);
    }
  }

  function buildParkBlock(B, D, r, rnd, dist, colliders) {
    var cxm = (r.x0 + r.x1) / 2, czm = (r.z0 + r.z1) / 2;
    var bw = r.x1 - r.x0, bd = r.z1 - r.z0;
    B.push(cxm, 0.18, czm, bw + 10, 0.06, bd + 10, 0, GRASS, 1, 5, 0);
    B.push(cxm, 0.2, czm, bw + 10, 0.05, 4.2, 0, PATH, 1, 6, 0);
    B.push(cxm, 0.2, czm, 4.2, 0.05, bd + 10, 0, PATH, 1, 6, 0);
    var nt = Math.floor(bw * bd / 190);
    for (var i = 0; i < nt; i++) {
      var tx = rnd.range(r.x0, r.x1), tz = rnd.range(r.z0, r.z1);
      if (Math.abs(tx - cxm) < 3.5 || Math.abs(tz - czm) < 3.5) continue;
      addTree(B, tx, tz, 0.2, rnd, rnd.range(0.9, 1.5));
    }
    for (var b = 0; b < 4; b++) addBench(D, cxm + rnd.range(-bw / 3, bw / 3), czm + (b % 2 ? 3.2 : -3.2), 0.22, b % 2 ? 0 : Math.PI);
    for (var lp = 0; lp < 3; lp++) addLamp(D, cxm + rnd.range(-bw / 2, bw / 2), czm + rnd.range(-bd / 2, bd / 2), 0.2, rnd.range(0, 6));
    if (rnd.chance(0.35)) {
      B.push(cxm + rnd.range(-bw / 4, bw / 4), 0.1, czm + rnd.range(-bd / 4, bd / 4), bw * 0.35, 0.3, bd * 0.35, 0, WATER, 1, 3, 0);
    }
  }

  function buildCourtBlock(B, D, r, rnd, colliders) {
    var cxm = (r.x0 + r.x1) / 2, czm = (r.z0 + r.z1) / 2;
    var bw = r.x1 - r.x0, bd = r.z1 - r.z0;
    B.push(cxm, 0.18, czm, bw, 0.05, bd, 0, [0.30, 0.34, 0.38], 1, 6, 0);
    B.push(cxm, 0.21, czm, bw * 0.8, 0.02, bd * 0.7, 0, [0.34, 0.42, 0.40], 1, 6, 0);
    // hoops
    for (var s = -1; s <= 1; s += 2) {
      var hx = cxm + s * bw * 0.34;
      B.push(hx, 0.2, czm, 0.24, 3.2, 0.24, 0, [0.4, 0.4, 0.42], 1, 0, 0);
      B.push(hx - s * 0.6, 3.0, czm, 1.4, 1.0, 0.12, Math.PI / 2, [0.85, 0.85, 0.88], 1, 0, 0);
      B.push(hx - s * 1.0, 2.9, czm, 0.5, 0.06, 0.5, 0, [0.9, 0.45, 0.1], 1, 0, 0);
    }
    // fence
    for (var fx = r.x0; fx <= r.x1; fx += 5) {
      B.push(fx, 0.2, r.z0, 0.12, 3.0, 0.12, 0, [0.3, 0.32, 0.34], 1, 0, 0);
      B.push(fx, 0.2, r.z1, 0.12, 3.0, 0.12, 0, [0.3, 0.32, 0.34], 1, 0, 0);
    }
  }

  function buildBeachBlock(B, D, r, rnd, colliders) {
    var cxm = (r.x0 + r.x1) / 2, czm = (r.z0 + r.z1) / 2;
    var bw = r.x1 - r.x0, bd = r.z1 - r.z0;
    B.push(cxm, 0.1, czm, bw + 10, 0.12, bd + 10, 0, [0.72, 0.66, 0.50], 1, 6, 0);
    B.push(cxm, 0.24, r.z0 + 4, bw + 10, 0.16, 10, 0, [0.55, 0.42, 0.30], 1, 0, 0);  // boardwalk
    for (var i = 0; i < 5; i++) {
      if (rnd.chance(0.6)) B.push(rnd.range(r.x0, r.x1), 0.3, czm + rnd.range(-bd / 3, bd / 3), 3.2, 3.0, 3.2, 0,
        [rnd.range(0.5, 0.9), rnd.range(0.3, 0.7), rnd.range(0.2, 0.5)], 1, 0, 0);
    }
  }

  /* An open-air POI (court, pitch, gas station) owns its whole block, so the
     block generator lays down a bare lot instead of buildings. */
  function openAirBlock(r) {
    for (var i = 0; i < P.pois.length; i++) {
      var p = P.pois[i];
      if (p.cat !== 'basketball' && p.cat !== 'soccer' && p.cat !== 'gas') continue;
      if (p.x > r.x0 - 34 && p.x < r.x1 + 34 && p.z > r.z0 - 24 && p.z < r.z1 + 24) return p;
    }
    return null;
  }
  function buildClearing(B, r) {
    var cxm = (r.x0 + r.x1) / 2, czm = (r.z0 + r.z1) / 2;
    B.push(cxm, 0, czm, (r.x1 - r.x0) + 10, 0.17, (r.z1 - r.z0) + 10, 0, SIDEWALK, 1, 6, 0);
  }

  /* -------------------------------------------------------------- features */
  function buildFeature(B, D, f, colliders) {
    var rnd = T10.rng(f.id.length * 7919 + f.x + f.z * 31);
    var col = f.color || [0.5, 0.5, 0.52];
    var y = 0.18;
    switch (f.kind) {
      case 'tower_tiered': {
        var lv = 5, hAcc = 0;
        for (var i = 0; i < lv; i++) {
          var t = i / lv;
          var w = f.w * (1 - t * 0.62), d = f.d * (1 - t * 0.62);
          var hh = f.h / lv;
          B.push(f.x, y + hAcc, f.z, w, hh, d, 0, col, 1, 1, 4 + i);
          hAcc += hh;
        }
        B.push(f.x, y + f.h, f.z, 6, 26, 6, 0, [0.55, 0.55, 0.6], 1, 1, 2);
        B.push(f.x, y + f.h + 26, f.z, 1.2, 22, 1.2, 0, [0.7, 0.7, 0.75], 1, 0, 0);
        B.push(f.x, y + f.h + 48, f.z, 2.2, 2.2, 2.2, 0, [1, 0.3, 0.25], 1, 10, 0);
        colliders.push(f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2);
        break;
      }
      case 'tower_spire': {
        B.push(f.x, y, f.z, f.w, f.h * 0.82, f.d, 0, col, 1, 1, 9);
        for (var s = 0; s < 5; s++) {
          var sw = f.w * (0.8 - s * 0.14);
          B.push(f.x, y + f.h * 0.82 + s * 7, f.z, sw, 7, sw, 0, [0.62, 0.64, 0.68], 1, 4, 0);
        }
        B.push(f.x, y + f.h * 0.82 + 35, f.z, 1.4, 34, 1.4, 0, [0.75, 0.77, 0.8], 1, 0, 0);
        colliders.push(f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2);
        break;
      }
      case 'tower_taper': {
        var seg = 8;
        for (var k = 0; k < seg; k++) {
          var tt = k / seg;
          var ww = f.w * (1 - tt * 0.35);
          B.push(f.x, y + f.h / seg * k, f.z, ww, f.h / seg, ww, tt * 0.12, [0.42 + tt * 0.06, 0.5, 0.6], 1, 4, 0);
        }
        B.push(f.x, y + f.h, f.z, 2, 60, 2, 0, [0.8, 0.8, 0.85], 1, 0, 0);
        B.push(f.x, y + f.h + 60, f.z, 3, 3, 3, 0, [0.8, 0.9, 1.0], 1, 10, 0);
        colliders.push(f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2);
        break;
      }
      case 'tower_slab': {
        B.push(f.x, y, f.z, f.w, f.h, f.d, 0, col, 1, 1, 11);
        B.push(f.x, y + f.h, f.z, f.w * 0.4, 12, f.d * 0.4, 0, col, 1, 1, 12);
        for (var g = -1; g <= 1; g += 2) B.push(f.x + g * (f.w * 0.75), y, f.z, f.w * 0.4, f.h * 0.35, f.d * 0.9, 0, col, 1, 1, 13 + g);
        colliders.push(f.x - f.w * 1.0, f.z - f.d / 2, f.x + f.w * 1.0, f.z + f.d / 2);
        break;
      }
      case 'flatiron': {
        B.push(f.x, y, f.z, f.w, f.h, f.d, 0.32, col, 1, 1, 21);
        B.push(f.x - f.w * 0.4, y, f.z + f.d * 0.2, f.w * 0.5, f.h, f.d * 0.6, -0.25, col, 1, 1, 22);
        colliders.push(f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2);
        break;
      }
      case 'arena': {
        B.push(f.x, y, f.z, f.w, f.h * 0.7, f.d, 0, col, 1, 1, 31);
        B.push(f.x, y + f.h * 0.7, f.z, f.w * 0.94, f.h * 0.3, f.d * 0.94, 0, [0.3, 0.3, 0.33], 1, 0, 0);
        B.push(f.x, y + 8, f.z - f.d / 2 - 0.6, f.w * 0.5, 6, 1.2, 0, [0.9, 0.7, 0.2], 1, 7, 3);
        colliders.push(f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2);
        break;
      }
      case 'stadium': {
        for (var a = 0; a < 16; a++) {
          var ang = a / 16 * Math.PI * 2;
          var rx = f.w / 2 * Math.cos(ang), rz = f.d / 2 * Math.sin(ang);
          B.push(f.x + rx, y, f.z + rz, 34, f.h, 26, -ang, col, 1, 1, 40 + a);
        }
        B.push(f.x, y, f.z, f.w * 0.62, 0.2, f.d * 0.62, 0, [0.22, 0.44, 0.20], 1, 5, 0);
        colliders.push(f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2);
        break;
      }
      case 'terminal': {
        B.push(f.x, y, f.z, f.w, f.h, f.d, 0, col, 1, 1, 51);
        B.push(f.x, y + f.h, f.z, f.w * 0.5, 10, f.d * 0.5, 0, col, 1, 1, 52);
        for (var c = -2; c <= 2; c++) B.push(f.x + c * (f.w / 6), y, f.z - f.d / 2 - 1.2, 3.4, f.h * 0.8, 3.4, 0, [0.66, 0.62, 0.54], 1, 0, 0);
        B.push(f.x, y + f.h * 0.62, f.z - f.d / 2 - 1.6, f.w * 0.3, 4, 0.6, 0, [0.9, 0.85, 0.6], 1, 7, 1);
        colliders.push(f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2);
        break;
      }
      case 'civic': case 'museum': {
        B.push(f.x, y, f.z, f.w, f.h, f.d, 0, col, 1, 1, 61);
        B.push(f.x, y + f.h, f.z, f.w * 0.55, 6, f.d * 0.55, 0, col, 1, 0, 0);
        for (var p = -3; p <= 3; p++) B.push(f.x + p * (f.w / 8), y, f.z - f.d / 2 - 2.4, 2.2, f.h * 0.85, 2.2, 0, [0.72, 0.68, 0.6], 1, 0, 0);
        B.push(f.x, y, f.z - f.d / 2 - 4.5, f.w * 0.8, 1.2, 6, 0, [0.66, 0.63, 0.56], 1, 6, 0);
        colliders.push(f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2);
        break;
      }
      case 'plaza_neon': {
        B.push(f.x, 0.16, f.z, f.w, 0.06, f.d, 0, [0.28, 0.28, 0.31], 1, 6, 0);
        for (var nb = 0; nb < 16; nb++) {
          var side = nb % 2 ? 1 : -1;
          var zz = f.z - f.d / 2 + (nb / 16) * f.d;
          B.push(f.x + side * (f.w / 2 + 1), 12 + (nb % 3) * 11, zz, 1.0, 9, 16, 0,
            [0.9, 0.4 + (nb % 4) * 0.12, 0.3], 1, 7, nb);
        }
        for (var st = 0; st < 6; st++) {
          B.push(f.x + rnd.range(-f.w / 3, f.w / 3), 0.2, f.z + rnd.range(-f.d / 2, f.d / 2), 2.2, 0.5, 2.2, 0, [0.85, 0.35, 0.25], 1, 0, 0);
        }
        break;
      }
      case 'park_small': case 'park_big': case 'park_arch': {
        B.push(f.x, 0.17, f.z, f.w, 0.06, f.d, 0, GRASS, 1, 5, 0);
        B.push(f.x, 0.2, f.z, f.w, 0.05, 5, 0, PATH, 1, 6, 0);
        B.push(f.x, 0.2, f.z, 5, 0.05, f.d, 0, PATH, 1, 6, 0);
        var tn = Math.floor(f.w * f.d / 260);
        for (var t2 = 0; t2 < tn; t2++) {
          var tx = f.x + rnd.range(-f.w / 2 + 4, f.w / 2 - 4), tz = f.z + rnd.range(-f.d / 2 + 4, f.d / 2 - 4);
          if (Math.abs(tx - f.x) < 4 || Math.abs(tz - f.z) < 4) continue;
          addTree(B, tx, tz, 0.2, rnd, rnd.range(1.0, 1.7));
        }
        for (var bn = 0; bn < 8; bn++) addBench(D, f.x + rnd.range(-f.w / 2 + 5, f.w / 2 - 5), f.z + (bn % 2 ? 4 : -4), 0.22, bn % 2 ? 0 : Math.PI);
        for (var pl2 = 0; pl2 < 5; pl2++) addLamp(D, f.x + rnd.range(-f.w / 2, f.w / 2), f.z + rnd.range(-f.d / 2, f.d / 2), 0.2, rnd.range(0, 6));
        if (f.kind === 'park_arch') {
          B.push(f.x - 5.5, 0.2, f.z - f.d / 2 + 6, 3, 14, 3, 0, [0.80, 0.77, 0.70], 1, 0, 0);
          B.push(f.x + 5.5, 0.2, f.z - f.d / 2 + 6, 3, 14, 3, 0, [0.80, 0.77, 0.70], 1, 0, 0);
          B.push(f.x, 14, f.z - f.d / 2 + 6, 14, 4, 3, 0, [0.82, 0.79, 0.72], 1, 0, 0);
        }
        if (f.kind === 'park_big') {
          B.push(f.x + f.w * 0.2, 0.12, f.z - f.d * 0.2, f.w * 0.35, 0.3, f.d * 0.28, 0, WATER, 1, 3, 0);
        }
        break;
      }
      case 'statue': {
        B.push(f.x, 0.2, f.z, 46, 3, 46, 0, [0.42, 0.45, 0.38], 1, 5, 0);
        B.push(f.x, 3.2, f.z, 22, 16, 22, 0, [0.48, 0.44, 0.40], 1, 0, 0);
        B.push(f.x, 19, f.z, 12, 14, 12, 0, [0.52, 0.48, 0.44], 1, 0, 0);
        B.push(f.x, 33, f.z, 6, 34, 6, 0, col, 1, 0, 0);         // body
        B.push(f.x, 67, f.z, 3.4, 5, 3.4, 0, col, 1, 0, 0);      // head
        B.push(f.x + 2.6, 55, f.z, 1.6, 18, 1.6, 0.5, col, 1, 0, 0); // arm
        B.push(f.x + 5.4, 72, f.z, 1.6, 5, 1.6, 0, [1.0, 0.85, 0.4], 1, 10, 0); // torch
        for (var sp = 0; sp < 7; sp++) {
          var sa = (sp / 7 - 0.5) * 2.4;
          B.push(f.x + Math.sin(sa) * 3.4, 70, f.z + Math.cos(sa) * 3.4 - 3.4, 0.7, 4.5, 0.7, sa, col, 1, 0, 0);
        }
        break;
      }
      case 'ferris': {
        B.push(f.x, 0.2, f.z, 3, f.h * 0.55, 3, 0.4, [0.5, 0.5, 0.55], 1, 0, 0);
        B.push(f.x, 0.2, f.z, 3, f.h * 0.55, 3, -0.4, [0.5, 0.5, 0.55], 1, 0, 0);
        for (var w2 = 0; w2 < 18; w2++) {
          var wa = w2 / 18 * Math.PI * 2, rr = f.h * 0.42;
          B.push(f.x + Math.cos(wa) * rr, f.h * 0.55 + Math.sin(wa) * rr, f.z, 2.4, 2.4, 1.2, wa,
            [0.9, 0.3 + (w2 % 3) * 0.2, 0.25], 1, 10, 0);
        }
        break;
      }
      case 'airport': {
        B.push(f.x, 0.15, f.z, f.w, 0.08, f.d, 0, [0.24, 0.24, 0.26], 1, 2, 0);
        B.push(f.x, 0.2, f.z - f.d * 0.3, f.w * 0.55, f.h, f.d * 0.22, 0, col, 1, 1, 71);
        B.push(f.x, 0.2, f.z + f.d * 0.34, f.w * 0.9, 0.1, f.d * 0.14, 0, [0.30, 0.30, 0.32], 1, 2, 0); // runway
        for (var pl = 0; pl < 4; pl++) {
          var px2 = f.x - f.w * 0.35 + pl * (f.w * 0.22);
          B.push(px2, 3.4, f.z + f.d * 0.05, 5, 5, 34, 0, [0.86, 0.88, 0.92], 1, 9, 0);
          B.push(px2, 4.2, f.z + f.d * 0.05, 30, 1.2, 5, 0, [0.82, 0.84, 0.88], 1, 9, 0);
          B.push(px2, 5.4, f.z - f.d * 0.05, 1.2, 6, 5, 0, [0.3, 0.4, 0.8], 1, 0, 0);
        }
        colliders.push(f.x - f.w * 0.3, f.z - f.d * 0.4, f.x + f.w * 0.3, f.z - f.d * 0.2);
        break;
      }
      case 'pier': {
        B.push(f.x, 0.0, f.z, f.w, 0.5, f.d, 0, [0.42, 0.36, 0.30], 1, 6, 0);
        B.push(f.x, 0.5, f.z, f.w * 0.7, f.h, f.d * 0.55, 0, col, 1, 1, 81);
        for (var pi2 = 0; pi2 < 8; pi2++) {
          B.push(f.x - f.w / 2 + (pi2 % 4) * (f.w / 3.4), -3, f.z - f.d / 2 + Math.floor(pi2 / 4) * f.d, 0.8, 3.6, 0.8, 0, [0.3, 0.26, 0.22], 1, 0, 0);
        }
        break;
      }
      case 'elevated_park': {
        for (var ez = -f.d / 2; ez < f.d / 2; ez += 12) {
          B.push(f.x, 0.2, f.z + ez, 1.0, f.h, 1.0, 0, [0.32, 0.32, 0.34], 1, 0, 0);
          colliders.push(f.x - 0.5, f.z + ez - 0.5, f.x + 0.5, f.z + ez + 0.5);
        }
        B.push(f.x, f.h, f.z, f.w, 0.5, f.d, 0, [0.40, 0.42, 0.38], 1, 6, 0);
        for (var eg = -f.d / 2 + 6; eg < f.d / 2; eg += 16) addTree(B, f.x + rnd.range(-6, 6), f.z + eg, f.h + 0.5, rnd, 0.7);
        break;
      }
    }
  }

  function buildBridge(B, b, colliders) {
    var towerHalf = b.w * 0.6;
    var dx = b.x1 - b.x0, dz = b.z1 - b.z0;
    var len = Math.hypot(dx, dz);
    var ang = Math.atan2(dx, -dz);
    var steps = Math.ceil(len / 12);
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var x = b.x0 + dx * t, z = b.z0 + dz * t;
      var h = bridgeHeight(b, t);
      B.push(x, h - 0.7, z, b.w, 0.8, 13, ang, [0.38, 0.36, 0.34], 1, 2, 0);
      B.push(x - Math.cos(ang) * (b.w / 2), h - 0.7, z - Math.sin(ang) * (b.w / 2), 0.5, 1.6, 13, ang, [0.30, 0.30, 0.32], 1, 0, 0);
      B.push(x + Math.cos(ang) * (b.w / 2), h - 0.7, z + Math.sin(ang) * (b.w / 2), 0.5, 1.6, 13, ang, [0.30, 0.30, 0.32], 1, 0, 0);
      if (t > 0.02 && t < 0.98 && i % 3 === 0) {
        B.push(x, 0, z, 3.4, h - 1.2, 3.4, ang, [0.34, 0.32, 0.30], 1, 0, 0);   // pier
      }
    }
    if (b.towers) {
      for (var s = 0; s < 2; s++) {
        var tt = s === 0 ? 0.28 : 0.72;
        var tx = b.x0 + dx * tt, tz = b.z0 + dz * tt;
        var th = bridgeHeight(b, tt);
        B.push(tx, 0, tz, b.w * 1.15, th + 46, 9, ang, [0.46, 0.40, 0.34], 1, 0, 0);   // stone, not glazed
        B.push(tx, th + 46, tz, b.w * 0.4, 8, 8, ang, [0.46, 0.40, 0.34], 1, 0, 0);
        // the towers are solid: you walk around them, not through them
        if (colliders) colliders.push(tx - towerHalf, tz - 5.5, tx + towerHalf, tz + 5.5);
      }
    }
    if (b.cables) {
      for (var c = 0; c <= steps; c++) {
        var ct = c / steps;
        var cx2 = b.x0 + dx * ct, cz2 = b.z0 + dz * ct;
        var ch = bridgeHeight(b, ct);
        var sag = Math.abs(Math.sin((ct - 0.28) / 0.44 * Math.PI));
        var top = ch + 8 + 34 * (1 - sag * 0.92);
        for (var sd = -1; sd <= 1; sd += 2) {
          B.push(cx2 + Math.cos(ang) * sd * (b.w / 2), ch + 0.6, cz2 + Math.sin(ang) * sd * (b.w / 2),
            0.18, Math.max(0.4, top - ch), 0.18, 0, [0.55, 0.52, 0.48], 1, 0, 0);
        }
      }
    }
  }

  /* Subway entrance kiosks on the street. */
  function buildSubwayEntrance(B, poi, colliders) {
    if (colliders) colliders.push(poi.x - 2.2, poi.z - 2.7, poi.x + 2.2, poi.z + 2.7);
    B.push(poi.x, 0.18, poi.z, 4.2, 0.4, 5.0, 0, [0.28, 0.30, 0.32], 1, 6, 0);
    B.push(poi.x - 1.8, 0.2, poi.z, 0.5, 3.0, 5.0, 0, [0.18, 0.20, 0.22], 1, 0, 0);
    B.push(poi.x + 1.8, 0.2, poi.z, 0.5, 3.0, 5.0, 0, [0.18, 0.20, 0.22], 1, 0, 0);
    B.push(poi.x, 3.2, poi.z, 4.4, 0.35, 5.2, 0, [0.20, 0.22, 0.24], 1, 0, 0);
    B.push(poi.x, 3.6, poi.z, 1.6, 1.6, 0.2, 0, [0.10, 0.45, 0.20], 1, 10, 0);
    B.push(poi.x, 0.2, poi.z + 1.0, 3.0, 0.1, 3.0, 0, [0.08, 0.08, 0.09], 1, 0, 0);  // stairwell mouth
  }

  function buildPOIMarker(B, poi, colliders) {
    var rnd = T10.rng((poi.seed || 7) * 977 + Math.round(poi.x));
    if (colliders) colliders.push(poi.x - 2.9, poi.z - 0.3, poi.x + 2.9, poi.z + 0.3);
    var f = poi.face || -1;                        // which way the entrance looks
    var accent = [rnd.range(0.18, 0.62), rnd.range(0.12, 0.48), rnd.range(0.16, 0.55)];
    var frame = [0.19, 0.18, 0.19];
    // dark frame around a glazed shopfront, set into the building line
    B.push(poi.x, 0.18, poi.z, 5.8, 3.5, 0.34, 0, frame, 1, 0, 0);
    B.push(poi.x, 0.2, poi.z + f * 0.16, 4.9, 2.7, 0.14, 0, [0.14, 0.17, 0.22], 1, 4, 0);   // window
    B.push(poi.x + 1.9, 0.2, poi.z + f * 0.2, 1.1, 2.5, 0.12, 0, [0.10, 0.12, 0.16], 1, 4, 0); // door
    B.push(poi.x, 3.68, poi.z, 5.9, 0.62, 0.42, 0, [0.11, 0.12, 0.14], 1, 7, (poi.seed || 3) % 20); // sign
    B.push(poi.x, 3.0, poi.z + f * 0.85, 5.4, 0.18, 1.5, 0, accent, 1, 0, 0);                  // awning
    B.push(poi.x, 2.72, poi.z + f * 1.55, 5.4, 0.3, 0.1, 0, accent, 1, 0, 0);                  // awning valance
  }

  /* --------------------------------------------------------- chunk builder */
  function generateChunk(cx, cz) {
    var B = new R.Builder();     // structure: ground, buildings, landmarks
    var D = new R.Builder();     // street-level detail, drawn only up close
    var colliders = [];
    var x0 = cx * CH, z0 = cz * CH;
    var rnd = T10.rng((cx * 374761393 + cz * 668265263) >>> 0);

    // ground cells (asphalt over land, water otherwise)
    var CELLS = 4, cs = CH / CELLS;
    for (var gi = 0; gi < CELLS; gi++) {
      for (var gj = 0; gj < CELLS; gj++) {
        var gx = x0 + cs * (gi + 0.5), gz = z0 + cs * (gj + 0.5);
        if (P.landAt(gx, gz)) B.push(gx, -0.02, gz, cs + 0.4, 0.06, cs + 0.4, 0, ASPHALT, 1, 2, 0);
        else B.push(gx, -0.9, gz, cs + 0.4, 0.9, cs + 0.4, 0, WATER, 1, 3, 0);
      }
    }

    // seawall wherever paved ground meets water: the edge you can see is the
    // edge you stop at
    for (var wi = 0; wi < CELLS; wi++) {
      for (var wj = 0; wj < CELLS; wj++) {
        var wx = x0 + cs * (wi + 0.5), wz = z0 + cs * (wj + 0.5);
        if (!P.landAt(wx, wz)) continue;
        var sides = [[cs, 0], [-cs, 0], [0, cs], [0, -cs]];
        for (var si = 0; si < sides.length; si++) {
          var nx2 = wx + sides[si][0], nz2 = wz + sides[si][1];
          if (P.landAt(nx2, nz2)) continue;
          var ex = wx + sides[si][0] * 0.5, ez = wz + sides[si][1] * 0.5;
          if (bridgeAt(ex, ez) || onPier(ex, ez)) continue;      // leave the crossings open
          var alongX = sides[si][0] === 0;
          var ww = alongX ? cs + 0.6 : 0.7, wd = alongX ? 0.7 : cs + 0.6;
          B.push(ex, 0, ez, ww, 1.05, wd, 0, [0.44, 0.43, 0.41], 1, 6, 0);
          B.push(ex, 1.05, ez, ww, 0.16, wd + 0.3, 0, [0.34, 0.34, 0.33], 1, 0, 0);
          for (var pi3 = -1; pi3 <= 1; pi3++) {                   // handrail
            B.push(ex + (alongX ? pi3 * cs * 0.33 : 0), 1.2, ez + (alongX ? 0 : pi3 * cs * 0.33),
              alongX ? 0.14 : 0.14, 0.95, 0.14, 0, [0.30, 0.31, 0.33], 1, 0, 0);
          }
          B.push(ex, 2.05, ez, alongX ? cs + 0.6 : 0.14, 0.12, alongX ? 0.14 : cs + 0.6, 0, [0.30, 0.31, 0.33], 1, 0, 0);
          colliders.push(ex - ww / 2, ez - wd / 2, ex + ww / 2, ez + wd / 2);
        }
      }
    }

    // blocks whose centre lies in this chunk
    var ai0 = Math.floor(x0 / P.AVE) - 1, ai1 = Math.ceil((x0 + CH) / P.AVE) + 1;
    var sj0 = Math.floor(z0 / P.ST) - 1, sj1 = Math.ceil((z0 + CH) / P.ST) + 1;
    for (var ai = ai0; ai <= ai1; ai++) {
      for (var sj = sj0; sj <= sj1; sj++) {
        var r = blockRect(ai, sj);
        var bcx = (r.x0 + r.x1) / 2, bcz = (r.z0 + r.z1) / 2;
        if (bcx < x0 || bcx >= x0 + CH || bcz < z0 || bcz >= z0 + CH) continue;
        if (!P.landAt(bcx, bcz)) continue;
        if (featureCovers(bcx, bcz, 6)) continue;
        var dist = P.districtAt(bcx, bcz);
        if (!dist) continue;
        if (openAirBlock(r)) { buildClearing(B, r); continue; }
        buildBlock(B, D, ai, sj, dist, colliders);
      }
    }

    // intersections inside this chunk
    for (var iai = ai0; iai <= ai1; iai++) {
      for (var isj = sj0; isj <= sj1; isj++) {
        var ix = iai * P.AVE, iz = isj * P.ST;
        if (ix < x0 || ix >= x0 + CH || iz < z0 || iz >= z0 + CH) continue;
        if (!P.landAt(ix, iz)) continue;
        if (featureCovers(ix, iz, 0)) continue;
        addCrosswalk(D, ix, iz - P.ST_HALF + 2.0, 0, true);
        addCrosswalk(D, ix, iz + P.ST_HALF - 2.0, 0, true);
        addCrosswalk(D, ix - P.AVE_HALF + 2.0, iz, 0, false);
        addCrosswalk(D, ix + P.AVE_HALF - 2.0, iz, 0, false);
        addTrafficSignal(D, ix - P.AVE_HALF + 2.6, iz - P.ST_HALF + 2.6, 0.17, 0);
        addTrafficSignal(D, ix + P.AVE_HALF - 2.6, iz + P.ST_HALF - 2.6, 0.17, Math.PI);
        // stop bars on every approach
        D.push(ix, 0.04, iz - P.ST_HALF + 3.6, P.AVE_HALF - 4, 0.03, 0.4, 0, [0.82, 0.82, 0.80], 1, 0, 0);
        D.push(ix, 0.04, iz + P.ST_HALF - 3.6, P.AVE_HALF - 4, 0.03, 0.4, 0, [0.82, 0.82, 0.80], 1, 0, 0);
        D.push(ix - P.AVE_HALF + 3.6, 0.04, iz, 0.4, 0.03, P.ST_HALF - 4, 0, [0.82, 0.82, 0.80], 1, 0, 0);
        D.push(ix + P.AVE_HALF - 3.6, 0.04, iz, 0.4, 0.03, P.ST_HALF - 4, 0, [0.82, 0.82, 0.80], 1, 0, 0);
        // manhole
        D.push(ix + 3.5, 0.045, iz - 3.5, 1.1, 0.03, 1.1, 0, [0.24, 0.23, 0.22], 1, 9, 0);
      }
    }

    addRoadMarkings(D, x0, z0, CH);

    // hand-placed features centred in this chunk
    for (var fi = 0; fi < P.features.length; fi++) {
      var f = P.features[fi];
      if (f.x < x0 || f.x >= x0 + CH || f.z < z0 || f.z >= z0 + CH) continue;
      buildFeature(B, D, f, colliders);
    }

    // bridges whose midpoint is in this chunk
    for (var bi = 0; bi < P.bridges.length; bi++) {
      var b = P.bridges[bi];
      var mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2;
      if (mx < x0 || mx >= x0 + CH || mz < z0 || mz >= z0 + CH) continue;
      buildBridge(B, b, colliders);
    }

    // POI dressing
    for (var pi = 0; pi < P.pois.length; pi++) {
      var poi = P.pois[pi];
      if (poi.x < x0 || poi.x >= x0 + CH || poi.z < z0 || poi.z >= z0 + CH) continue;
      if (poi.cat === 'subway') buildSubwayEntrance(D, poi, colliders);
      else if (poi.cat === 'taxistand') {
        D.push(poi.x, 0.18, poi.z, 0.3, 3.2, 0.3, 0, [0.3, 0.3, 0.32], 1, 0, 0);
        D.push(poi.x, 3.2, poi.z, 1.6, 0.7, 0.2, 0, [0.95, 0.78, 0.15], 1, 10, 0);
      } else if (poi.cat === 'busstop') {
        colliders.push(poi.x - 2.0, poi.z - 0.9, poi.x + 2.0, poi.z - 0.5);
        D.push(poi.x, 0.18, poi.z, 4.0, 0.2, 1.6, 0, [0.35, 0.36, 0.38], 1, 6, 0);
        D.push(poi.x, 0.2, poi.z - 0.7, 4.0, 2.6, 0.2, 0, [0.25, 0.27, 0.30], 1, 4, 0);
        D.push(poi.x, 2.8, poi.z, 4.2, 0.2, 1.8, 0, [0.30, 0.32, 0.34], 1, 0, 0);
        D.push(poi.x, 2.55, poi.z - 0.75, 3.4, 0.45, 0.12, 0, [0.15, 0.35, 0.65], 1, 7, 4);
        D.push(poi.x + 1.6, 0.2, poi.z + 0.6, 0.2, 3.2, 0.2, 0, [0.3, 0.3, 0.32], 1, 0, 0);
        D.push(poi.x - 1.2, 0.2, poi.z + 0.3, 2.0, 0.45, 0.5, 0, [0.32, 0.33, 0.36], 1, 9, 0);
      } else if (poi.cat === 'basketball') {
        B.push(poi.x, 0.19, poi.z, 26, 0.06, 16, 0, [0.30, 0.34, 0.40], 1, 6, 0);
        for (var hs = -1; hs <= 1; hs += 2) {
          B.push(poi.x + hs * 11, 0.2, poi.z, 0.24, 3.2, 0.24, 0, [0.4, 0.4, 0.42], 1, 0, 0);
          B.push(poi.x + hs * 10.4, 3.0, poi.z, 0.12, 1.0, 1.4, 0, [0.88, 0.88, 0.9], 1, 0, 0);
        }
      } else if (poi.cat === 'soccer') {
        B.push(poi.x, 0.19, poi.z, 60, 0.06, 38, 0, [0.24, 0.46, 0.22], 1, 5, 0);
        for (var gs = -1; gs <= 1; gs += 2) {
          B.push(poi.x + gs * 28, 0.2, poi.z, 0.2, 2.4, 7.2, 0, [0.9, 0.9, 0.92], 1, 0, 0);
        }
      } else if (poi.cat === 'gas') {
        B.push(poi.x, 0.18, poi.z, 20, 0.08, 16, 0, [0.32, 0.32, 0.34], 1, 6, 0);
        B.push(poi.x, 5.2, poi.z, 16, 0.8, 10, 0, [0.86, 0.86, 0.88], 1, 0, 0);
        B.push(poi.x - 5, 0.2, poi.z, 0.5, 5.0, 0.5, 0, [0.5, 0.5, 0.52], 1, 0, 0);
        B.push(poi.x + 5, 0.2, poi.z, 0.5, 5.0, 0.5, 0, [0.5, 0.5, 0.52], 1, 0, 0);
        B.push(poi.x, 0.2, poi.z - 2, 1.0, 1.6, 0.8, 0, [0.85, 0.25, 0.2], 1, 0, 0);
      } else if (poi.enterable && poi.cat !== 'home') {
        buildPOIMarker(D, poi, colliders);
      } else if (poi.cat === 'home') {
        var hf = poi.face || -1;
        colliders.push(poi.x - 3.5, poi.z - 0.5, poi.x + 3.5, poi.z + 0.5);
        B.push(poi.x, 0.18, poi.z, 7.0, 5.4, 0.9, 0, [0.46, 0.30, 0.26], 1, 0, 0);
        B.push(poi.x, 0.2, poi.z + hf * 0.5, 2.2, 3.0, 0.5, 0, [0.30, 0.22, 0.18], 1, 0, 0);   // door
        B.push(poi.x, 3.4, poi.z + hf * 0.9, 3.0, 0.3, 1.4, 0, [0.55, 0.20, 0.18], 1, 0, 0);   // awning
        B.push(poi.x, 0.17, poi.z + hf * 1.4, 3.2, 0.35, 1.6, 0, [0.45, 0.42, 0.40], 1, 6, 0); // stoop
        B.push(poi.x + 2.4, 0.2, poi.z + hf * 0.8, 0.3, 3.0, 0.3, 0, [0.2, 0.2, 0.22], 1, 0, 0);
        B.push(poi.x + 2.4, 3.1, poi.z + hf * 0.8, 0.5, 0.4, 0.5, 0, [1.0, 0.86, 0.6], 1, 10, 0);
      }
    }

    var arr = new Float32Array(B.data.length + D.data.length);
    arr.set(B.array(), 0);
    arr.set(D.array(), B.data.length);
    return { arr: arr, colliders: new Float32Array(colliders), baseCount: B.count() };
  }

  /* -------------------------------------------------------------- streaming */
  function cacheStore(k, data) {
    W.cache[k] = data;
    W.cacheOrder.push(k);
    while (W.cacheOrder.length > 260) {
      var old = W.cacheOrder.shift();
      if (!W.chunks[old]) delete W.cache[old];
    }
  }

  function loadChunk(cx, cz) {
    var k = key(cx, cz);
    if (W.chunks[k]) return;
    var data = W.cache[k];
    if (!data) { data = generateChunk(cx, cz); cacheStore(k, data); W.generatedCount++; }
    R.setStatic('c' + k, data.arr, cx * CH + CH / 2, cz * CH + CH / 2, CHUNK_RADIUS, data.baseCount);
    W.chunks[k] = { cx: cx, cz: cz, colliders: data.colliders };
  }

  function unloadChunk(k) {
    R.dropStatic('c' + k);
    delete W.chunks[k];
  }

  W.reset = function () {
    for (var k in W.chunks) unloadChunk(k);
    W.pending.length = 0;
  };

  /* Called every frame; generates at most a couple of chunks per frame so the
     frame budget never collapses when the player moves fast. */
  W.update = function (px, pz, budgetMs, active) {
    var radius = (R.drawDist || 600) + 120;
    var cr = Math.ceil(radius / CH);
    var pc = W.chunkOf(px, pz);
    var need = {};
    var wanted = [];
    for (var dx = -cr; dx <= cr; dx++) {
      for (var dz = -cr; dz <= cr; dz++) {
        var cx = pc[0] + dx, cz = pc[1] + dz;
        var ccx = cx * CH + CH / 2, ccz = cz * CH + CH / 2;
        var d = Math.hypot(ccx - px, ccz - pz);
        if (d > radius) continue;
        var k = key(cx, cz);
        need[k] = true;
        if (!W.chunks[k]) wanted.push({ k: k, cx: cx, cz: cz, d: d });
      }
    }
    for (var kk in W.chunks) {
      if (!need[kk]) unloadChunk(kk);
    }
    if (!active) return;
    wanted.sort(function (a, b) { return a.d - b.d; });
    var t0 = performance.now();
    var made = 0;
    for (var i = 0; i < wanted.length; i++) {
      loadChunk(wanted[i].cx, wanted[i].cz);
      made++;
      if (performance.now() - t0 > (budgetMs || 6) && made >= 1) break;
    }
    W.loadingLeft = Math.max(0, wanted.length - made);
  };

  /* Load everything in a tight radius immediately (used on spawn/teleport). */
  W.preload = function (px, pz, radius) {
    radius = radius || 320;
    var cr = Math.ceil(radius / CH);
    var pc = W.chunkOf(px, pz);
    for (var dx = -cr; dx <= cr; dx++) {
      for (var dz = -cr; dz <= cr; dz++) loadChunk(pc[0] + dx, pc[1] + dz);
    }
  };

  /* ------------------------------------------------------------- collision */
  /* Push a circle out of every building AABB it overlaps. */
  W.resolve = function (x, z, radius) {
    var pc = W.chunkOf(x, z);
    var moved = false;
    for (var dx = -1; dx <= 1; dx++) {
      for (var dz = -1; dz <= 1; dz++) {
        var c = W.chunks[key(pc[0] + dx, pc[1] + dz)];
        if (!c) continue;
        var a = c.colliders;
        for (var i = 0; i < a.length; i += 4) {
          var x0 = a[i], z0 = a[i + 1], x1 = a[i + 2], z1 = a[i + 3];
          if (x + radius <= x0 || x - radius >= x1 || z + radius <= z0 || z - radius >= z1) continue;
          // find the shallowest axis to eject along
          var pxr = x1 - (x - radius), pxl = (x + radius) - x0;
          var pzr = z1 - (z - radius), pzl = (z + radius) - z0;
          var mn = Math.min(pxr, pxl, pzr, pzl);
          if (mn === pxr) x = x1 + radius;
          else if (mn === pxl) x = x0 - radius;
          else if (mn === pzr) z = z1 + radius;
          else z = z0 - radius;
          moved = true;
        }
      }
    }
    return { x: x, z: z, hit: moved };
  };

  W.blocked = function (x, z, radius) {
    var pc = W.chunkOf(x, z);
    for (var dx = -1; dx <= 1; dx++) {
      for (var dz = -1; dz <= 1; dz++) {
        var c = W.chunks[key(pc[0] + dx, pc[1] + dz)];
        if (!c) continue;
        var a = c.colliders;
        for (var i = 0; i < a.length; i += 4) {
          if (x + radius > a[i] && x - radius < a[i + 2] && z + radius > a[i + 1] && z - radius < a[i + 3]) return true;
        }
      }
    }
    return false;
  };

  /* Nearest walkable sidewalk point — used when teleporting or leaving interiors. */
  W.safeSpot = function (x, z) {
    if (W.isWalkable(x, z) && !W.blocked(x, z, 0.6)) return { x: x, z: z };
    for (var r = 4; r <= 90; r += 4) {
      for (var a = 0; a < 12; a++) {
        var ang = a / 12 * Math.PI * 2;
        var nx = x + Math.cos(ang) * r, nz = z + Math.sin(ang) * r;
        if (W.isWalkable(nx, nz) && !W.blocked(nx, nz, 0.6)) return { x: nx, z: nz };
      }
    }
    return { x: x, z: z };
  };

  /* Sidewalk position beside a POI (spawn point when you step outside). */
  W.doorstep = function (poi) {
    var f = poi.face || -1;
    return W.safeSpot(poi.x, poi.z + f * 3.2);
  };

  /* Visits every traffic signal head near the player so the game can light the
     lamp that matches the current phase. */
  W.forEachSignal = function (px, pz, radius, cb) {
    var a0 = Math.round((px - radius) / P.AVE), a1 = Math.round((px + radius) / P.AVE);
    var s0 = Math.round((pz - radius) / P.ST), s1 = Math.round((pz + radius) / P.ST);
    for (var ai = a0; ai <= a1; ai++) {
      for (var sj = s0; sj <= s1; sj++) {
        var ix = ai * P.AVE, iz = sj * P.ST;
        if (M.dist2(px, pz, ix, iz) > radius * radius) continue;
        if (!P.landAt(ix, iz) || featureCovers(ix, iz, 0)) continue;
        cb(ai, sj, ix - P.AVE_HALF + 2.6, iz - P.ST_HALF + 2.6, 0);
        cb(ai, sj, ix + P.AVE_HALF - 2.6, iz + P.ST_HALF - 2.6, Math.PI);
      }
    }
  };

  W.stats = function () {
    return { chunks: Object.keys(W.chunks).length, cached: W.cacheOrder.length, generated: W.generatedCount };
  };

})(typeof window !== 'undefined' ? window : globalThis);
