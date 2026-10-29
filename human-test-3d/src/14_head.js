// ============================================================================
// Procedural head: SDF-sculpted face projected onto a sphere grid; eyes, lids,
// jaw/mouth, ears, brows, hair styles, facial hair, neck.
// Head-local coordinates (reference head ~0.23 m): origin at eye level, +Z face.
// ============================================================================
function sdEll(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = (px - cx) / rx, y = (py - cy) / ry, z = (pz - cz) / rz;
  const k0 = Math.sqrt(x * x + y * y + z * z);
  const x2 = x / rx, y2 = y / ry, z2 = z / rz;
  const k1 = Math.sqrt(x2 * x2 + y2 * y2 + z2 * z2);
  return k1 < 1e-12 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
}
function sdSph(px, py, pz, cx, cy, cz, r) { return Math.hypot(px - cx, py - cy, pz - cz) - r; }
function sdCapR(px, py, pz, ax, ay, az, bx, by, bz, r1, r2) {
  const pax = px - ax, pay = py - ay, paz = pz - az, bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - lerp(r1, r2, h);
}
function smin(a, b, k) { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); }
function smax(a, b, k) { return -smin(-a, -b, k); }

function makeHeadShape(app, rig) {
  const F = app.face, male = app.male;
  const P = {
    jawW: (male ? 0.0565 : 0.0505) + 0.0045 * F.jaw,
    chinW: (male ? 0.0215 : 0.0175) + 0.003 * F.chin,
    chinProj: 0.0045 * F.chinProj,
    noseLen: 0.0045 * F.noseLen,
    noseW: 1 + 0.13 * F.noseWidth,
    noseProj: 0.0045 * F.noseProj,
    noseBridge: 1 + 0.25 * F.noseBridge,
    brow: (male ? 0.0075 : 0.0058) + 0.0018 * F.brow,
    lips: 1 + 0.2 * F.lips,
    mouthW: 1 + 0.08 * F.mouthW,
    cheek: 0.003 * F.cheek,
    cheekFull: 0.0035 * F.cheekFull,
    faceLen: 1 + 0.035 * F.faceLen,
    forehead: 0.004 * F.forehead,
    eye: rig.eyeLocal,
    eyeR: rig.eyeRadius
  };
  P.tipY = -0.0415 - P.noseLen; P.tipZ = 0.1045 + P.noseProj;
  P.upLipY = -0.0672; P.loLipY = -0.0808; P.mouthY = -0.0742;
  P.mouthHalf = 0.0205 * P.mouthW;
  // exact culling: smin(d, a, k) == d whenever a > d + k; bounding spheres give lower bounds of a
  const bs = (cx, cy, cz, r) => ({ cx, cy, cz, r });
  const BCHIN = bs(0, -0.101, 0.063 + P.chinProj, Math.max(P.chinW, 0.024) + 0.001);
  const BCHEEK = bs(0.0465, -0.017, 0.046, 0.032 + Math.abs(P.cheek) + Math.abs(P.cheekFull));
  const BMUZ = bs(0, -0.067, 0.064, 0.031 * P.mouthW);
  const BBROW = bs(0.0295, 0.0225, 0.077, 0.025);
  const tipY = P.tipY, tipZ = P.tipZ;
  const BNOSE = bs(0, (0.0055 + tipY) / 2, (0.0825 + tipZ) / 2, Math.hypot(tipY - 0.0055, tipZ - 0.0825) / 2 + 0.011 * P.noseW);
  const BALA = bs(0.0108 * P.noseW, tipY - 0.004, tipZ - 0.0135, 0.0076 * P.noseW);
  const BLIP = bs(0, (P.upLipY + P.loLipY) / 2, 0.0882, 0.0225 * P.mouthW + 0.002);
  const BEYE = bs(P.eye.x, P.eye.y + 0.0015, P.eye.z + 0.0128, 0.0156);
  const far = (B, x, y, z, d, k) => { const dx = x - B.cx, dy = y - B.cy, dz = z - B.cz; const lim = d + k + B.r; return lim < 0 || dx * dx + dy * dy + dz * dz > lim * lim; };
  const sdf = (x, y0, z) => {
    const y = y0 < -0.02 ? -0.02 + (y0 + 0.02) / P.faceLen : y0;
    const ax = Math.abs(x);
    let d = sdEll(x, y, z, 0, 0.024 + P.forehead * 0.5, -0.013, 0.0745, 0.0985, 0.0965);
    d = smin(d, sdEll(x, y, z, 0, -0.022, 0.024, 0.0655, 0.079, 0.068), 0.022);
    d = smin(d, sdEll(x, y, z, 0, -0.071, 0.025, P.jawW, 0.043, 0.058), 0.024);
    if (!far(BCHIN, x, y, z, d, 0.016)) d = smin(d, sdEll(x, y, z, 0, -0.101, 0.063 + P.chinProj, P.chinW, 0.0215, 0.024), 0.016);
    if (!far(BCHEEK, ax, y, z, d, 0.018)) d = smin(d, sdEll(ax, y, z, 0.0465, -0.017, 0.046, 0.024 + P.cheekFull, 0.020, 0.030 + P.cheek), 0.018);
    if (!far(BMUZ, x, y, z, d, 0.016)) d = smin(d, sdEll(x, y, z, 0, -0.067, 0.064, 0.030 * P.mouthW, 0.026, 0.030), 0.016);
    if (!far(BBROW, ax, y, z, d, 0.012)) d = smin(d, sdCapR(ax, y, z, 0.009, 0.0245, 0.0835, 0.050, 0.0205, 0.0705, P.brow, P.brow * 0.85), 0.012);
    if (!far(BNOSE, x, y, z, d, 0.0072)) d = smin(d, sdCapR(x, y, z, 0, 0.0055, 0.0825, 0, tipY, tipZ, 0.0052 * P.noseBridge, 0.0097 * P.noseW), 0.0072);
    if (!far(BALA, ax, y, z, d, 0.0045)) d = smin(d, sdEll(ax, y, z, 0.0108 * P.noseW, tipY - 0.004, tipZ - 0.0135, 0.0058 * P.noseW, 0.0055, 0.0075), 0.0045);
    if (!far(BLIP, x, y, z, d, 0.0045)) {
      d = smin(d, sdEll(x, y, z, 0, P.upLipY, 0.0885, 0.0215 * P.mouthW, 0.0058 * P.lips, 0.0112), 0.0045);
      d = smin(d, sdEll(x, y, z, 0, P.loLipY, 0.0876, 0.0192 * P.mouthW, 0.0072 * P.lips, 0.0112), 0.0045);
    }
    // eye socket subtraction: smax(d, -s, k) only differs when s < -d + k
    { const dx = ax - BEYE.cx, dy = y - BEYE.cy, dz = z - BEYE.cz; const lb = Math.sqrt(dx * dx + dy * dy + dz * dz) - BEYE.r; if (lb < -d + 0.0068) d = smax(d, -(lb), 0.0068); }
    return d;
  };
  const lipDist = (x, y0, z) => {
    const y = y0 < -0.02 ? -0.02 + (y0 + 0.02) / P.faceLen : y0;
    return Math.min(sdEll(x, y, z, 0, P.upLipY + 0.0004, 0.0885, 0.0205 * P.mouthW, 0.0050 * P.lips, 0.0102),
      sdEll(x, y, z, 0, P.loLipY - 0.0004, 0.0875, 0.0183 * P.mouthW, 0.0062 * P.lips, 0.0102));
  };
  P.sdf = sdf; P.lipDist = lipDist;
  P.mouthYScaled = -0.02 + (P.mouthY + 0.02) * P.faceLen;
  return P;
}

// project along ray from origin o in direction d until leaving the SDF
function projectRay(sdf, ox, oy, oz, dx, dy, dz, tMax, tGuess) {
  let lo, hi;
  if (tGuess != null && tGuess > 0.004) {
    // warm start from a nearby solution
    let t = tGuess, d = sdf(ox + dx * t, oy + dy * t, oz + dz * t);
    let it = 0;
    if (d < 0) { // inside: march out
      lo = t;
      while (d < 0 && t < tMax && it++ < 60) { lo = t; t += Math.max(-d * 0.85, 0.001); d = sdf(ox + dx * t, oy + dy * t, oz + dz * t); }
      hi = Math.min(t, tMax);
    } else { // outside: march in
      hi = t;
      while (d >= 0 && t > 0 && it++ < 60) { hi = t; t -= Math.max(d * 0.85, 0.001); if (t < 0) t = 0; d = sdf(ox + dx * t, oy + dy * t, oz + dz * t); }
      lo = t;
    }
  } else {
    let t = 0, tPrev = 0, d = sdf(ox, oy, oz);
    if (d > 0) return 0;
    let it = 0;
    while (t < tMax && it < 80) {
      tPrev = t; t += Math.max(-d * 0.85, 0.0012);
      d = sdf(ox + dx * t, oy + dy * t, oz + dz * t); it++;
      if (d >= 0) break;
    }
    lo = tPrev; hi = Math.min(t, tMax);
  }
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) * 0.5;
    if (sdf(ox + dx * mid, oy + dy * mid, oz + dz * mid) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) * 0.5;
}

function hairlineY(app, phi) {
  // phi: 0 front, +-PI back; returns local y of hairline
  const a = Math.abs(phi);
  const male = app.male;
  const recede = male && app.age > 30 ? clamp((app.age - 30) / 40, 0, 1) * 0.012 * ((app.seed % 7) / 6) : 0;
  const tbl = [
    [0.0, 0.060 + 0.005 * app.face.forehead + recede],
    [0.45, 0.056 + recede * 1.2],
    [0.8, 0.044],
    [1.15, male ? -0.012 : 0.010],  // sideburn area in front of the ear
    [1.32, male ? -0.008 : 0.018],
    [1.5, 0.026],
    [1.75, 0.022],
    [2.1, -0.026],
    [2.6, -0.062],
    [Math.PI, -0.076]
  ];
  return sampleTable(tbl, a, 1);
}

// Build the head + neck + face features. Returns grid info used for hair shells.
function buildHead(mb, app, rig, Q) {
  const P = makeHeadShape(app, rig);
  const sdf = P.sdf;
  const S = rig.sHead, HC = rig.headCenter;
  const skinBase = C(app.skin.hex);
  const skinMat = [MAT.SKIN, 0.5, 0, 1];
  const hairCol = C(app.hairColor.hex);
  const F = app.face;
  const toChar = (x, y, z, out) => out.set(HC.x + x * S, HC.y + y * S, HC.z + z * S);

  // ---- grid parameterization
  const cols = Q.headCols;
  const phiOf = (j) => { const s = -1 + 2 * j / cols; return Math.PI * (0.55 * s + 0.45 * s * s * s); };
  const O = [0, 0.006, -0.008];
  // mouth row polar angle (front column)
  const mY = P.mouthYScaled, mZ = 0.0905;
  const mouthPolar = Math.atan2(mZ - O[2], -(mY - O[1])); // angle from down... convert
  const mouthPol = Math.PI - mouthPolar; // polar from +Y
  const rows = [0];
  const crown = [0.09, 0.19, 0.31, 0.44, 0.57, 0.70, 0.82, 0.92];
  for (const a of crown) rows.push(a);
  const faceStart = 0.99, faceEnd = 2.62;
  const step = 0.040 / Q.headRowScale;
  for (let a = faceStart; a <= faceEnd + 1e-6; a += step) rows.push(a);
  rows.push(2.70, 2.80, 2.92, 3.04);
  rows.push(Math.PI);
  // snap nearest row to mouth polar
  let best = -1, bd = 1e9;
  for (let i = 1; i < rows.length - 1; i++) { const dd = Math.abs(rows[i] - mouthPol); if (dd < bd) { bd = dd; best = i; } }
  rows[best] = mouthPol;
  const mouthRow = best;
  const nR = rows.length;

  // ---- projection
  const gp = []; // local positions [r][c] as arrays
  const tMax = 0.2;
  const prevT = new Float32Array(cols).fill(-1);
  for (let r = 0; r < nR; r++) {
    const pol = rows[r];
    const row = [];
    const nc = (r === 0 || r === nR - 1) ? 1 : cols;
    for (let c = 0; c < nc; c++) {
      const phi = phiOf(c);
      const dx = Math.sin(pol) * Math.sin(phi), dy = Math.cos(pol), dz = Math.sin(pol) * Math.cos(phi);
      const guess = nc === 1 ? null : (prevT[c] > 0 ? prevT[c] : (c > 0 && row.length ? Math.hypot(row[c - 1][0] - O[0], row[c - 1][1] - O[1], row[c - 1][2] - O[2]) : null));
      const t = projectRay(sdf, O[0], O[1], O[2], dx, dy, dz, tMax, guess);
      if (nc > 1) prevT[c] = t;
      row.push([O[0] + dx * t, O[1] + dy * t, O[2] + dz * t, phi]);
    }
    gp.push(row);
  }

  // ---- attributes
  const lipCol = (() => {
    const c = skinBase.clone();
    const k = 0.55 + F.lipTint * 0.45;
    c.r *= 1 - 0.04 * k; c.g *= 1 - 0.36 * k; c.b *= 1 - 0.30 * k;
    return c.multiplyScalar(0.86);
  })();
  const stubble = app.facialHair !== 'none';
  // facial hair regions as signed distances (positive inside), local meters
  const sdBeard = (x, y, z) => {
    const cheekLine = lerp(-0.010, -0.050, smoothstep(-0.012, 0.062, z));
    const a = cheekLine - y;                 // below the cheek line
    const b = z + 0.03;                      // in front of the ears
    const ld = P.lipDist(x, y, z) - 0.0025;  // away from the lips
    return Math.min(a, b, ld);
  };
  const sdMustache = (x, y, z) => {
    const ax = Math.abs(x);
    const a = y - (P.upLipY + 0.0048);       // above upper lip
    const b = (P.tipY - 0.0085) - y;         // below the nose
    const c = 0.026 - ax;
    const d = z - 0.062;
    return Math.min(a, b, c, d);
  };
  const sdGoatee = (x, y, z) => {
    const ax = Math.abs(x);
    const chin = Math.min((P.loLipY - 0.0085) - y, 0.021 - ax, z - 0.03);
    return Math.max(chin, sdMustache(x, y, z));
  };
  const sdFacial = (x, y, z) => {
    switch (app.facialHair) {
      case 'mustache': return sdMustache(x, y, z);
      case 'goatee': return sdGoatee(x, y, z);
      case 'short_beard': case 'full_beard': case 'stubble': return Math.max(sdBeard(x, y, z), sdMustache(x, y, z));
      default: return -1;
    }
  };
  const fhMask = (x, y, z) => smoothstep(-0.002, 0.006, sdFacial(x, y, z));
  const vtxColor = (x, y, z) => {
    const c = skinBase.clone();
    // subtle variation: cheeks/nose/ears redder, eye sockets darker
    const ax = Math.abs(x);
    const cheek = gauss(ax, 0.042, 0.014) * gauss(y, -0.032, 0.014) * smoothstep(0.03, 0.07, z);
    const noseTip = gauss(ax, 0, 0.01) * gauss(y, P.tipY, 0.01) * smoothstep(0.09, 0.105, z);
    const red = (app.male ? 0.25 : 0.45) * cheek + 0.3 * noseTip;
    c.r *= 1 + 0.12 * red; c.g *= 1 - 0.06 * red; c.b *= 1 - 0.05 * red;
    const socket = gauss(ax, P.eye.x, 0.012) * gauss(y, P.eye.y - 0.006, 0.006) * smoothstep(0.04, 0.07, z);
    c.multiplyScalar(1 - 0.12 * socket);
    // lips
    const ld = P.lipDist(x, y, z);
    const lm = 1 - smoothstep(-0.0005, 0.0024, ld);
    if (lm > 0) c.lerp(lipCol, lm);
    // stubble / facial hair shadow
    if (stubble) {
      const fm = fhMask(x, y, z);
      if (fm > 0) c.lerp(new THREE.Color().copy(hairCol).multiplyScalar(0.55).lerp(skinBase, 0.35), fm * (app.facialHair === 'stubble' ? 0.42 : 0.55));
    }
    // scalp under hair slightly tinted
    return { c, lm };
  };
  const jawW = (x, y, z) => {
    const below = smoothstep(P.mouthYScaled - 0.002, P.mouthYScaled - 0.016, y);
    const front = smoothstep(-0.04, 0.0, z);
    const under = 1 - smoothstep(-0.085, -0.115, y) * (1 - smoothstep(0.02, 0.05, z)) * 0.6;
    return clamp(below * front * under, 0, 1);
  };
  const headWeights = (x, y, z, forceJaw) => {
    const wj = forceJaw != null ? forceJaw : jawW(x, y, z);
    return [[B.head, 1 - wj], [B.jaw, wj]];
  };
  const regionOf = (x, y, z) => REGION.HEAD;

  // emit vertices
  mb.beginPart();
  const startI = mb.I.length;
  const idx = []; // [r][c] -> vertex index (upper copy for mouth row)
  const idxLower = {}; // mouth row lower copies: c -> index
  const vp = new V3();
  const isMouthCol = [];
  for (let r = 0; r < nR; r++) {
    const row = gp[r], ir = [];
    for (let c = 0; c < row.length; c++) {
      const [x, y, z, phi] = row[c];
      toChar(x, y, z, vp);
      const { c: col, lm } = vtxColor(x, y, z);
      const mat = lm > 0.5 ? [MAT.LIPS, 0.38, 0, 1] : skinMat;
      const u = phi * 0.1 * S, v = rows[r] * 0.1 * S;
      let w;
      const inMouth = r === mouthRow && Math.abs(x) < P.mouthHalf * 0.96 && z > 0.06;
      if (r === mouthRow) isMouthCol[c] = inMouth;
      if (inMouth) w = headWeights(x, y, z, 0.0);
      else w = headWeights(x, y, z);
      const vi = mb.v(vp.x, vp.y, vp.z, u, v, col, mat, col, w, regionOf(x, y, z));
      ir.push(vi);
      if (inMouth) {
        const vi2 = mb.v(vp.x, vp.y, vp.z, u, v, col, mat, col, headWeights(x, y, z, 1.0), regionOf(x, y, z));
        mb.weld[vi2] = vi; // share normal
        idxLower[c] = vi2;
      }
    }
    idx.push(ir);
  }
  // faces
  for (let r = 0; r < nR - 1; r++) {
    const top = idx[r], bot = idx[r + 1];
    if (top.length === 1) { // pole fan
      for (let c = 0; c < cols; c++) mb.tri(top[0], bot[(c + 1) % cols], bot[c]);
      continue;
    }
    if (bot.length === 1) {
      for (let c = 0; c < cols; c++) mb.tri(top[c], top[(c + 1) % cols], bot[0]);
      continue;
    }
    for (let c = 0; c < cols; c++) {
      const c1 = (c + 1) % cols;
      let a = top[c], b = top[c1];
      if (r === mouthRow) { if (idxLower[c] != null) a = idxLower[c]; if (idxLower[c1] != null) b = idxLower[c1]; }
      mb.quad(a, b, bot[c1], bot[c]);
    }
  }
  // orientation check
  orientPartOutward(mb, startI, toChar(0, 0, 0, new V3()));
  mb.endPart();

  // ---- neck tube
  buildNeck(mb, app, rig, P, Q);
  // ---- mouth interior + teeth
  buildMouthInside(mb, app, rig, P);
  // ---- eyes + lids
  for (let s = 0; s < 2; s++) buildEye(mb, app, rig, P, s, Q);
  // ---- ears
  for (let s = 0; s < 2; s++) buildEar(mb, app, rig, P, s);
  // ---- brows
  for (let s = 0; s < 2; s++) buildBrow(mb, app, rig, P, s);

  // ---- grid normals (from the mesh) for shells
  const gridN = [];
  for (let r = 0; r < nR; r++) {
    const row = [];
    for (let c = 0; c < idx[r].length; c++) {
      const vi = idx[r][c];
      row.push([mb.normals[vi * 3], mb.normals[vi * 3 + 1], mb.normals[vi * 3 + 2]]);
    }
    gridN.push(row);
  }
  const grid = { gp, gridN, rows, cols, nR, phiOf, mouthRow, P, idxLower };
  // ---- facial hair shells
  if (app.facialHair === 'mustache' || app.facialHair === 'goatee' || app.facialHair === 'short_beard' || app.facialHair === 'full_beard') {
    const thick = { mustache: 0.0035, goatee: 0.0045, short_beard: 0.0042, full_beard: 0.013 }[app.facialHair];
    const sd = (x, y, z) => {
      let d = sdFacial(x, y, z);
      if (app.facialHair === 'full_beard') d = Math.max(d, Math.min(-0.068 - y, z + 0.02, y + 0.135));
      return d;
    };
    addShell(mb, app, rig, grid, sd, (x, y, z, m) => thick * (0.5 + 0.5 * m) * (app.facialHair === 'full_beard' ? (1 + 0.6 * smoothstep(-0.07, -0.11, y)) : 1),
      C(app.hairColor.hex), MAT.BROW, true, 0.8);
  }
  // ---- hair
  buildHair(mb, app, rig, grid, Q);
  return grid;
}

function orientPartOutward(mb, startI, center) {
  const P = mb.P, I = mb.I;
  let vote = 0;
  for (let k = startI; k < I.length; k += 3) {
    const a = I[k], b = I[k + 1], c = I[k + 2];
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const nx = (P[b * 3 + 1] - ay) * (P[c * 3 + 2] - az) - (P[b * 3 + 2] - az) * (P[c * 3 + 1] - ay);
    const ny = (P[b * 3 + 2] - az) * (P[c * 3] - ax) - (P[b * 3] - ax) * (P[c * 3 + 2] - az);
    const nz = (P[b * 3] - ax) * (P[c * 3 + 1] - ay) - (P[b * 3 + 1] - ay) * (P[c * 3] - ax);
    const d = nx * (ax - center.x) + ny * (ay - center.y) + nz * (az - center.z);
    vote += d > 0 ? 1 : (d < 0 ? -1 : 0);
  }
  if (vote < 0) mb.flipPart(startI);
}

// Shell over head grid region (hair/beard). thickFn(x,y,z,m) -> offset
function addShell(mb, app, rig, grid, sdFn, thickFn, color, matType, isBeard, slope = 0.7) {
  // sdFn(x,y,z,phi) -> signed distance (local meters) to region edge, positive inside.
  const { gp, gridN, nR, cols, rows } = grid;
  const S = rig.sHead, HC = rig.headCenter;
  const mat = [matType, matType === MAT.HAIR ? 0.5 : 0.75, 0, 1];
  mb.beginPart();
  const startI = mb.I.length;
  const inset = 0.016;
  const map = [];
  const vp = new V3();
  for (let r = 0; r < nR; r++) {
    const row = gp[r], mr = [];
    for (let c = 0; c < row.length; c++) {
      const [x, y, z, phi] = row[c];
      const sd = sdFn(x, y, z, phi);
      if (sd < -0.03) { mr.push(-1); continue; }
      const m = clamp(sd / 0.012, 0, 1);
      const t = thickFn(x, y, z, m, phi);
      const off = clamp(sd * slope, -inset, t);
      const n = gridN[r][c];
      const px = x + n[0] * off, py = y + n[1] * off, pz = z + n[2] * off;
      vp.set(HC.x + px * S, HC.y + py * S, HC.z + pz * S);
      const wj = isBeard ? clamp(smoothstep(grid.P.mouthYScaled - 0.002, grid.P.mouthYScaled - 0.016, y) * smoothstep(-0.04, 0.0, z), 0, 1) : 0;
      const w = isBeard ? [[B.head, 1 - wj], [B.jaw, wj]] : [[B.head, 1]];
      const col = color.clone().multiplyScalar(0.92 + 0.16 * hash2(r * 7 + 3, c * 13 + 1));
      mr.push(mb.v(vp.x, vp.y, vp.z, phi * 0.1 * S * 3, rows[r] * 0.1 * S * 3, col, mat, color, w, REGION.HEAD));
    }
    map.push(mr);
  }
  for (let r = 0; r < nR - 1; r++) {
    const top = map[r], bot = map[r + 1];
    if (top.length === 1 || bot.length === 1) {
      const single = top.length === 1 ? top : bot, many = top.length === 1 ? bot : top;
      if (single[0] < 0) continue;
      for (let c = 0; c < cols; c++) {
        const a = many[c], b = many[(c + 1) % cols];
        if (a < 0 || b < 0) continue;
        if (top.length === 1) mb.tri(single[0], b, a); else mb.tri(a, b, single[0]);
      }
      continue;
    }
    for (let c = 0; c < cols; c++) {
      const c1 = (c + 1) % cols;
      const a = top[c], b = top[c1], cc = bot[c1], d = bot[c];
      const cnt = (a >= 0) + (b >= 0) + (cc >= 0) + (d >= 0);
      if (cnt === 4) mb.quad(a, b, cc, d);
      else if (cnt === 3) {
        if (a < 0) mb.tri(b, cc, d); else if (b < 0) mb.tri(a, cc, d); else if (cc < 0) mb.tri(a, b, d); else mb.tri(a, b, cc);
      }
    }
  }
  orientPartOutward(mb, startI, HC);
  mb.endPart();
}

function buildNeck(mb, app, rig, P, Q) {
  const S = rig.sHead, HC = rig.headCenter, H = rig.H;
  const skin = C(app.skin.hex);
  const neckR = (app.male ? 0.059 : 0.0505) * app.body.neck * (1 + 0.06 * app.body.fat);
  const yTopL = -0.035, yBotL = (rig.neckBaseY - HC.y) / S - 0.095;
  const n = 7;
  const rings = [];
  const neckBaseLocal = (rig.neckBaseY - HC.y) / S;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const yl = lerp(yTopL, yBotL, t);
    const zc = lerp(-0.026, -0.006, t);
    const r = neckR * (1 + 0.1 * smoothstep(0.55, 1.0, t));
    const c = new V3(HC.x, HC.y + yl * S, HC.z + zc * S);
    // weights: head at top -> neck -> chest at bottom
    let w;
    if (yl > -0.07) { const k = smoothstep(-0.035, -0.075, yl); w = [[B.head, 1 - k], [B.neck, k]]; }
    else if (yl > neckBaseLocal - 0.01) w = [[B.neck, 1]];
    else { const k = smoothstep(neckBaseLocal - 0.01, neckBaseLocal - 0.05, yl); w = [[B.neck, 1 - k * 0.6], [B.chest, k * 0.6]]; }
    const adam = app.male ? 0.0055 * gauss(yl, -0.125, 0.012) : 0;
    rings.push({
      c, e1: LEFT, e2: FWD,
      prof: (th) => {
        const cz = Math.cos(th);
        const rr = r * S * (cz > 0 ? 0.93 : 1.0);
        let a = Math.sin(th) * rr * 1.04, b = cz * rr;
        if (adam && cz > 0.8) b += adam * S * Math.pow(cz, 18);
        return [a, b];
      },
      col: skin, mat: [MAT.SKIN, 0.52, 0, 1], col2: skin, wts: w, reg: yl < -0.09 ? REGION.NECK : REGION.HEAD, v: yl * S
    });
  }
  addLoft(mb, rings, Q.limbCols + 2);
}

function buildMouthInside(mb, app, rig, P) {
  const S = rig.sHead, HC = rig.headCenter;
  const dark = C(0x2a0c0c), teeth = C(0xe9e4d6);
  const cx = 0, cy = P.mouthYScaled - 0.004, cz = 0.068;
  addSphereLike(mb, 8, 12, (th, ph) => new V3(HC.x + (cx + Math.sin(ph) * Math.sin(th) * 0.019) * S, HC.y + (cy + Math.cos(ph) * 0.012) * S, HC.z + (cz + Math.sin(ph) * Math.cos(th) * 0.018) * S),
    (th, ph, p) => ({ col: dark, mat: [MAT.MOUTH, 0.6, 0, 1], col2: dark, wts: ph > Math.PI * 0.5 ? [[B.jaw, 1]] : [[B.head, 1]], reg: REGION.HEAD }));
  // teeth arcs
  for (let k = 0; k < 2; k++) {
    const up = k === 0;
    const y0 = P.mouthYScaled + (up ? 0.0005 : -0.0005), h = up ? 0.0065 : -0.0055;
    const rings = [];
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const a = lerp(-0.95, 0.95, i / n);
      const r = 0.0215;
      const x = Math.sin(a) * r, z = 0.0655 + Math.cos(a) * r * 0.85;
      rings.push([x, z]);
    }
    mb.beginPart();
    const st = mb.I.length;
    const base = mb.n;
    for (const [x, z] of rings) {
      for (const yy of [y0, y0 + h]) {
        mb.v(HC.x + x * S, HC.y + yy * S, HC.z + z * S, x, yy, teeth, [MAT.TEETH, 0.3, 0, 1], teeth, up ? [[B.head, 1]] : [[B.jaw, 1]], REGION.HEAD);
      }
    }
    for (let i = 0; i < n; i++) mb.quad(base + i * 2, base + i * 2 + 1, base + i * 2 + 3, base + i * 2 + 2);
    orientPartOutward(mb, st, new V3(HC.x, HC.y + y0 * S, HC.z + 0.04 * S));
    mb.endPart();
  }
}

function buildEye(mb, app, rig, P, side, Q) {
  const sg = SIDE_SIGN[side];
  const S = rig.sHead;
  const ec = rig.bindPos[SB('eye', side)];
  const R = rig.eyeRadius * S;
  const sclera = C(0xe9e4dc), iris = C(app.eyes.hex);
  // eyeball: pole at +Z; uv.y = polar angle
  const rows = 14, cols = 18;
  mb.beginPart();
  const st = mb.I.length;
  const base = mb.n;
  for (let i = 0; i <= rows; i++) {
    const pol = Math.pow(i / rows, 1.35) * Math.PI;
    for (let j = 0; j <= cols; j++) {
      const az = (j / cols) * TAU;
      const x = Math.sin(pol) * Math.cos(az), y = Math.sin(pol) * Math.sin(az), z = Math.cos(pol);
      mb.v(ec.x + x * R, ec.y + y * R, ec.z + z * R, az, pol, sclera, [MAT.EYE, 0.12, 0, 1], iris, [[SB('eye', side), 1]], REGION.HEAD);
      if (j === cols) mb.weld[mb.n - 1] = mb.n - 1 - cols;
    }
  }
  for (let j = 1; j <= cols; j++) mb.weld[base + j] = base;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = base + i * (cols + 1) + j;
    mb.quad(a, a + 1, a + cols + 2, a + cols + 1);
  }
  orientPartOutward(mb, st, ec);
  mb.endPart();
  // lids
  const F = app.face;
  const open = 1 + 0.12 * F.eyeOpen;
  const tilt = 0.10 * F.eyeTilt;
  const skin = C(app.skin.hex);
  const lidCol = skinColorAt(skin, 0.25, 0.04);
  const lashCol = C(app.male ? 0x2a2420 : 0x14100e);
  const ac = 72 * DEG;
  const eUp = (a) => { const t = clamp(Math.abs(a) / ac, 0, 1); return (0.36 * open) * Math.pow(Math.max(0, Math.cos(t * Math.PI * 0.5)), 0.85) + tilt * (a * sg) * 0.6 - 0.02; };
  const eLo = (a) => { const t = clamp(Math.abs(a) / ac, 0, 1); return -(0.33 * open) * Math.pow(Math.max(0, Math.cos(t * Math.PI * 0.5)), 1.2) + tilt * (a * sg) * 0.4 - 0.02; };
  const Rl = R * 1.07;
  for (const upper of [true, false]) {
    const cols2 = 16, rows2 = 6;
    mb.beginPart();
    const st2 = mb.I.length;
    const b2 = mb.n;
    for (let i = 0; i <= rows2; i++) {
      for (let j = 0; j <= cols2; j++) {
        const a = lerp(-1.75, 1.75, j / cols2);
        const edge = upper ? eUp(a) : eLo(a);
        const lim = upper ? 1.45 : -1.45;
        const t = i / rows2;
        const e = lerp(edge, lim, Math.pow(t, 0.8));
        const rr = Rl * (i === 0 ? 1.03 : 1.0);
        const x = Math.sin(a) * Math.cos(e), y = Math.sin(e), z = Math.cos(a) * Math.cos(e);
        let col = lidCol;
        if (i === 0 && upper) col = lashCol;
        else if (i === 1 && upper) col = mixColor(lidCol, lashCol, 0.35);
        mb.v(ec.x + x * rr, ec.y + y * rr, ec.z + z * rr, a, e, col, [MAT.SKIN, upper && i === 0 ? 0.6 : 0.48, 0, 1], col,
          upper ? [[SB('lid', side), 1]] : [[B.head, 1]], REGION.HEAD);
      }
    }
    for (let i = 0; i < rows2; i++) for (let j = 0; j < cols2; j++) {
      const a = b2 + i * (cols2 + 1) + j;
      mb.quad(a, a + 1, a + cols2 + 2, a + cols2 + 1);
    }
    orientPartOutward(mb, st2, ec);
    mb.endPart();
  }
}

function buildEar(mb, app, rig, P, side) {
  const sg = SIDE_SIGN[side];
  const S = rig.sHead, HC = rig.headCenter;
  const k = 1 + 0.08 * app.face.ear;
  const c = new V3(sg * 0.068, -0.016, -0.014);
  const skin = skinColorAt(C(app.skin.hex), 0.45, 0.03);
  const rotBack = -0.28;
  const cr = Math.cos(rotBack), sr = Math.sin(rotBack);
  const H2 = 0.031 * k, W2 = 0.0175 * k;
  const st = mb.I.length;
  addSphereLike(mb, 10, 14, (th, ph) => {
    // local: lx outward (thickness), ly up, lz forward
    const cy = Math.cos(th), sz = Math.sin(th);
    // C-shaped outline: wider at top, narrower lobe
    const wz = W2 * (cy > 0 ? 1.0 : 0.78 + 0.22 * (1 + cy));
    let ly = Math.sin(ph) * cy * H2, lz = Math.sin(ph) * sz * wz;
    const rad = Math.sin(ph);
    let lx = Math.cos(ph) * 0.0055;
    if (lx > 0) lx = 0.0012 + lx * (0.15 + 0.85 * smoothstep(0.55, 0.92, rad)); // cupped outer face with rim
    // flare: back edge sticks out from the head
    lx += Math.max(0, -lz) * 0.55 + 0.0025;
    const y2 = ly * cr - lz * sr, z2 = ly * sr + lz * cr;
    const x = c.x + sg * lx, y = c.y + y2, z = c.z + z2;
    return new V3(HC.x + x * S, HC.y + y * S, HC.z + z * S);
  }, (th, ph) => ({ col: Math.cos(ph) > 0.3 && Math.sin(ph) < 0.6 ? skinColorAt(skin, 0.3, 0.12) : skin, mat: [MAT.SKIN, 0.5, 0, 1], col2: skin, wts: [[B.head, 1]], reg: REGION.HEAD }));
  orientPartOutward(mb, st, new V3(HC.x + (c.x - sg * 0.01) * S, HC.y + c.y * S, HC.z + c.z * S));
}

function buildBrow(mb, app, rig, P, side) {
  const sg = SIDE_SIGN[side];
  const S = rig.sHead, HC = rig.headCenter;
  const F = app.face;
  const col = C(app.hairColor.hex).clone();
  if (app.hairColor.name === 'Platinum' || app.hairColor.name === 'White') col.multiplyScalar(0.8);
  if (app.hairColor.name.startsWith('Dyed')) col.lerp(C(0x2a1b12), 0.6);
  const n = 12;
  const thick = (app.male ? 0.0058 : 0.0042) * (1 + 0.25 * F.browThick);
  const arch = (app.male ? 0.0035 : 0.0062) * (1 + 0.4 * F.browArch);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = lerp(0.0105, 0.0545, t);
    const y = 0.0195 + arch * Math.sin(Math.PI * Math.pow(t, 0.75)) - 0.003 * t + 0.001 * F.brow;
    // project from inside the head outward along +z-ish
    const ox = x * 0.6, oy = y * 0.6, oz = 0.02;
    let dx = x - ox, dy = y - oy, dz = 0.09 - oz;
    const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
    const tt = projectRay(P.sdf, sg * ox, oy, oz, sg * dx, dy, dz, 0.15);
    const px = sg * ox + sg * dx * tt, py = oy + dy * tt, pz = oz + dz * tt;
    const w = thick * (0.65 + 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.25 + 0.05))) * (t > 0.85 ? (1 - t) / 0.15 * 0.7 + 0.3 : 1);
    pts.push([px, py, pz, w, dx * sg, dy, dz]);
  }
  mb.beginPart();
  const st = mb.I.length;
  const base = mb.n;
  for (let i = 0; i <= n; i++) {
    const [px, py, pz, w, nx, ny, nz] = pts[i];
    const off = 0.0011;
    for (const k of [-0.5, 0.0, 0.5]) {
      const lift = k === 0 ? 0.0009 : 0.0;
      const x = px + nx * (off + lift), y = py + ny * (off + lift) + k * w, z = pz + nz * (off + lift);
      mb.v(HC.x + x * S, HC.y + y * S, HC.z + z * S, i / n, k, col, [MAT.BROW, 0.8, 0, 1], col, [[B.head, 1]], REGION.HEAD);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = base + i * 3;
    mb.quad(a, a + 3, a + 4, a + 1);
    mb.quad(a + 1, a + 4, a + 5, a + 2);
  }
  orientPartOutward(mb, st, HC);
  mb.endPart();
}

// ---------------------------------------------------------------------------------------
// HAIR
function buildHair(mb, app, rig, grid, Q) {
  const style = app.hairStyle;
  if (style === 'bald') return;
  const col = C(app.hairColor.hex);
  const seed = app.seed;
  const partSide = (seed & 1) ? 1 : -1;
  const style2 = {
    buzz: { top: 0.0026, side: 0.0022 }, short: { top: 0.011, side: 0.0055 }, sidepart: { top: 0.016, side: 0.006, part: true },
    quiff: { top: 0.026, side: 0.0045, quiff: true }, pixie: { top: 0.013, side: 0.006, part: true },
    curly_short: { top: 0.022, side: 0.016, curl: 0.0065 }, afro: { top: 0.058, side: 0.045, curl: 0.009, afro: true },
    medium: { top: 0.014, side: 0.012, curtain: 'medium' }, long_straight: { top: 0.013, side: 0.011, curtain: 'long' },
    long_wavy: { top: 0.016, side: 0.013, curtain: 'long', wave: 0.008 }, curly_long: { top: 0.026, side: 0.022, curl: 0.006, curtain: 'long', wave: 0.012 },
    bob: { top: 0.014, side: 0.012, curtain: 'bob' }, ponytail: { top: 0.0065, side: 0.005, tail: true },
    bun: { top: 0.0065, side: 0.005, bun: true }
  }[style] || { top: 0.01, side: 0.006 };
  const sdHair = (x, y, z, phi) => y - hairlineY(app, phi);
  const thick = (x, y, z, m, phi) => {
    const topness = smoothstep(-0.02, 0.09, y);
    let t = lerp(style2.side, style2.top, topness);
    if (style2.part) t += 0.004 * smoothstep(0.03, 0.08, y) * (Math.sign(x) === partSide ? 1 : 0.3);
    if (style2.quiff) t += 0.012 * smoothstep(0.04, 0.09, y) * smoothstep(-0.02, 0.06, z);
    if (style2.afro) t *= 0.85 + 0.25 * smoothstep(-0.05, 0.08, y);
    if (style2.curl) t += style2.curl * (noise3(x * 160, y * 160, z * 160) - 0.5) * 2;
    if (style2.curtain) t *= 1.0;
    // thin out at the hairline edge
    return t * (0.55 + 0.45 * m);
  };
  addShell(mb, app, rig, grid, sdHair, thick, col, MAT.HAIR, false, style2.afro ? 1.4 : 0.75);
  if (style2.curtain) buildHairCurtain(mb, app, rig, grid, style2, col, Q);
  if (style2.tail) buildPonytail(mb, app, rig, col, Q);
  if (style2.bun) buildBun(mb, app, rig, col);
}

function buildHairCurtain(mb, app, rig, grid, st, col, Q) {
  const S = rig.sHead, HC = rig.headCenter;
  const P = grid.P;
  const kind = st.curtain;
  const neckBaseL = (rig.neckBaseY - HC.y) / S;
  const yTop = 0.05;
  const yBot = kind === 'bob' ? -0.088 : kind === 'medium' ? neckBaseL - 0.07 : neckBaseL - 0.24;
  const rowsN = Math.round((kind === 'long' ? 14 : 9) * Q.hairDetail);
  const colsN = Math.round(30 * Q.hairDetail);
  const thick = 0.007;
  // radius of head surface along direction phi at height y (approximate by projecting)
  const sCache = new Map();
  const surfR = (phi, y) => {
    const key = Math.round(phi * 400) * 100000 + Math.round(y * 4000);
    let t = sCache.get(key);
    if (t !== undefined) return t;
    const dx = Math.sin(phi), dz = Math.cos(phi);
    t = projectRay(P.sdf, 0, y, -0.01, dx, 0, dz, 0.2, 0.08);
    sCache.set(key, t);
    return t;
  };
  const neckR = (app.male ? 0.056 : 0.0475) * app.body.neck * 1.1;
  const shoulderW = (rig.shoulderHalf / S) * 1.05, backD = 0.075 * (rig.H / 1.75) / S;
  const phiLimTop = kind === 'bob' ? 0.72 : 1.0;
  const rings = [];
  const wFor = (y) => {
    if (y > -0.06) return [[B.head, 1]];
    if (y > neckBaseL) { const k = smoothstep(-0.06, neckBaseL, y); return [[B.head, 1 - 0.6 * k], [B.neck, 0.6 * k]]; }
    const k = smoothstep(neckBaseL, neckBaseL - 0.1, y);
    return [[B.head, 0.4 * (1 - k)], [B.neck, 0.6 * (1 - k)], [B.chest, k]];
  };
  for (let i = 0; i <= rowsN; i++) {
    const t = i / rowsN;
    const y = lerp(yTop, yBot, Math.pow(t, 1.05));
    const below = y < neckBaseL ? smoothstep(neckBaseL, neckBaseL - 0.08, y) : 0;
    const phiLim = lerp(phiLimTop, kind === 'long' ? 2.05 : 1.6, smoothstep(-0.06, yBot, y) * (kind === 'bob' ? 0.3 : 1));
    const end = i === rowsN;
    const ring = {
      c: new V3(HC.x, HC.y + y * S, HC.z - 0.01 * S), e1: LEFT, e2: FWD,
      prof: (th) => {
        // th in [0,PI): outer arc; [PI, 2PI): inner arc back
        const outer = th < Math.PI;
        const u = outer ? th / Math.PI : (th - Math.PI) / Math.PI;
        const phi = outer ? lerp(phiLim, TAU - phiLim, u) : lerp(TAU - phiLim, phiLim, u);
        let r;
        if (y > -0.075) r = surfR(phi, Math.max(y, -0.07)) + lerp(st.side * 0.55, st.side + 0.003, smoothstep(0.045, 0.0, y));
        else r = Math.max(neckR + 0.012, surfR(phi, -0.07) * lerp(1, 0.7, smoothstep(-0.075, -0.11, y)) + st.side);
        if (below > 0) {
          const bx = Math.abs(Math.sin(phi)) * shoulderW, bz = Math.max(0, -Math.cos(phi)) * backD;
          r = Math.max(r, lerp(r, Math.hypot(bx * 0.55, bz) + 0.02, below));
        }
        if (st.wave) r += st.wave * Math.sin(y * 90 + phi * 3) * smoothstep(0.0, -0.05, y);
        if (st.curl) r += st.curl * (noise3(Math.cos(phi) * 30, y * 60, Math.sin(phi) * 30) - 0.5) * 2;
        let rr = outer ? r : r - (end ? 0 : thick);
        // the face-front ends taper
        return [Math.sin(phi) * rr, Math.cos(phi) * rr];
      },
      col: (th) => col.clone().multiplyScalar(th < Math.PI ? 1.0 : 0.72), mat: [MAT.HAIR, 0.5, 0, 1], col2: col,
      wts: wFor(y), reg: REGION.HEAD, v: y * S * 3
    };
    rings.push(ring);
  }
  // scale prof to head size: positions are local*S; wrap prof
  for (const r of rings) {
    const p0 = r.prof;
    r.prof = (th) => { const p = p0(th); return [p[0] * S, p[1] * S]; };
  }
  addLoft(mb, rings, colsN * 2, { voteRange: [0, colsN] });
}

function buildPonytail(mb, app, rig, col, Q) {
  const S = rig.sHead, HC = rig.headCenter;
  const root = rig.bindPos[B.hair];
  const n = 9;
  const L = 0.24 * S;
  const rings = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = new V3(root.x, root.y - t * L - 0.01 * S * t, root.z - 0.018 * S * Math.sin(t * Math.PI * 0.5) - 0.005 * S);
    const r = (t < 0.08 ? 0.011 : 0.018 * Math.sin(Math.PI * Math.min(1, 0.25 + t * 0.85)) + 0.004) * S;
    const w = t < 0.1 ? [[B.head, 1]] : [[B.head, 0.3 * (1 - t)], [B.hair, 0.7 + 0.3 * t]];
    rings.push({ c, e1: LEFT, e2: FWD, prof: (th) => [Math.sin(th) * r, Math.cos(th) * r * 0.85], col, mat: [MAT.HAIR, 0.5, 0, 1], col2: col, wts: w, reg: REGION.HEAD, v: t * L * 4 });
  }
  addLoft(mb, rings, 10, { capEnd: { offset: new V3(0, -0.01 * S, 0) } });
  // hair tie
  const tie = C(0x1a1a1a);
  const rr = 0.0125 * S;
  addSphereLike(mb, 4, 10, (th, ph) => new V3(root.x + Math.sin(th) * rr, root.y + Math.cos(ph) * 0.004 * S, root.z - 0.002 * S + Math.cos(th) * rr * 0.85),
    () => ({ col: tie, mat: [MAT.NYLON, 0.5, 0, 1], col2: tie, wts: [[B.head, 1]], reg: REGION.HEAD }));
}

function buildBun(mb, app, rig, col) {
  const S = rig.sHead, HC = rig.headCenter;
  const c = HC.clone().add(new V3(0, 0.055, -0.088).multiplyScalar(S));
  const r = 0.033 * S;
  addSphereLike(mb, 9, 14, (th, ph) => {
    const n = 1 + 0.06 * Math.sin(th * 5 + ph * 3);
    return new V3(c.x + Math.sin(ph) * Math.sin(th) * r * n, c.y + Math.cos(ph) * r * 0.8 * n, c.z + Math.sin(ph) * Math.cos(th) * r * 0.9 * n);
  }, () => ({ col, mat: [MAT.HAIR, 0.5, 0, 1], col2: col, wts: [[B.head, 1]], reg: REGION.HEAD }));
  orientPartOutward(mb, mb.partI, c);
}
