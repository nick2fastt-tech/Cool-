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
    lips: (male ? 1 : 1.06) + 0.2 * F.lips,
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
  const lipBow = (x) => 0.0009 * Math.exp(-(((Math.abs(x) - 0.0058) / 0.0034) ** 2)) - 0.0004 * Math.exp(-((x / 0.0024) ** 2));
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
    if (!far(BCHEEK, ax, y, z, d, 0.027)) d = smin(d, sdEll(ax, y, z, 0.0465, -0.017, 0.046, 0.024 + P.cheekFull, 0.020, 0.030 + P.cheek), 0.027); // a soft blend: no hard hollow under the cheekbone
    if (!far(BMUZ, x, y, z, d, 0.016)) d = smin(d, sdEll(x, y, z, 0, -0.067, 0.064, 0.030 * P.mouthW, 0.026, 0.030), 0.016);
    if (!far(BBROW, ax, y, z, d, 0.012)) d = smin(d, sdCapR(ax, y, z, 0.009, 0.0245, 0.0835, 0.050, 0.0205, 0.0705, P.brow, P.brow * 0.85), 0.012);
    if (!far(BNOSE, x, y, z, d, 0.0072)) d = smin(d, sdCapR(x, y, z, 0, 0.0055, 0.0825, 0, tipY, tipZ, 0.0052 * P.noseBridge, 0.0097 * P.noseW), 0.0072);
    if (!far(BALA, ax, y, z, d, 0.0045)) d = smin(d, sdEll(ax, y, z, 0.0108 * P.noseW, tipY - 0.004, tipZ - 0.0135, 0.0058 * P.noseW, 0.0055, 0.0075), 0.0045);
    if (!far(BLIP, x, y, z, d, 0.0045)) {
      d = smin(d, sdEll(x, y, z, 0, P.upLipY + lipBow(x), 0.0892, 0.0215 * P.mouthW, 0.0066 * P.lips, 0.0121 * Math.sqrt(P.lips)), 0.004);
      d = smin(d, sdEll(x, y, z, 0, P.loLipY - 0.0006, 0.0884, 0.0194 * P.mouthW, 0.0083 * P.lips, 0.0122 * Math.sqrt(P.lips)), 0.004);
    }
    // eye socket subtraction: smax(d, -s, k) only differs when s < -d + k
    { const dx = ax - BEYE.cx, dy = y - BEYE.cy, dz = z - BEYE.cz; const lb = Math.sqrt(dx * dx + dy * dy + dz * dz) - BEYE.r; if (lb < -d + 0.0068) d = smax(d, -(lb), 0.0068); }
    return d;
  };
  const lipDist = (x, y0, z) => {
    const y = y0 < -0.02 ? -0.02 + (y0 + 0.02) / P.faceLen : y0;
    return Math.min(sdEll(x, y, z, 0, P.upLipY + 0.0004 + lipBow(x), 0.0892, 0.0206 * P.mouthW, 0.0058 * P.lips, 0.0111 * Math.sqrt(P.lips)),
      sdEll(x, y, z, 0, P.loLipY - 0.001, 0.0884, 0.0185 * P.mouthW, 0.0073 * P.lips, 0.0112 * Math.sqrt(P.lips)));
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
  rig.headSdf = sdf; // head-local SDF (metres at sHead = 1), used to fit hats
  rig.mouth = { y: P.mouthYScaled, half: P.mouthHalf }; // for facial expressions (vertex shader)
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
    if (app.male) { c.r *= 1 - 0.04 * k; c.g *= 1 - 0.36 * k; c.b *= 1 - 0.30 * k; return c.multiplyScalar(0.86); }
    c.r *= 1 + 0.03 * k; c.g *= 1 - 0.44 * k; c.b *= 1 - 0.34 * k;
    return c.multiplyScalar(0.84);
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
    // V1.12: nostrils (dark openings under the tip), the philtrum groove, the shadowed line between the lips
    const nost = gauss(ax, 0.0062 * P.noseW, 0.0024) * gauss(y, P.tipY - 0.0062, 0.0024) * gauss(z, P.tipZ - 0.0095, 0.0042);
    c.multiplyScalar(1 - 0.7 * Math.min(1, nost * 1.3));
    const phil = gauss(ax, 0, 0.0018) * smoothstep(P.upLipY + 0.004, P.upLipY + 0.009, y) * smoothstep(P.tipY - 0.004, P.tipY - 0.012, y) * smoothstep(0.08, 0.095, z);
    c.multiplyScalar(1 - 0.06 * phil);
    const stom = gauss(y, P.mouthYScaled, 0.0011) * (1 - smoothstep(P.mouthHalf * 0.85, P.mouthHalf * 1.08, ax)) * smoothstep(0.075, 0.09, z);
    c.multiplyScalar(1 - 0.32 * stom);
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
    // the whole lower lip rides with the jaw; out on the cheeks the skin stretches more gradually
    const lat = smoothstep(P.mouthHalf * 0.8, P.mouthHalf * 1.6, Math.abs(x));
    const below = lerp(smoothstep(P.mouthYScaled + 0.0005, P.mouthYScaled - 0.0035, y), smoothstep(P.mouthYScaled - 0.002, P.mouthYScaled - 0.016, y), lat);
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
      // lips stay MAT.SKIN (no material-id seam); aMat.z carries a smooth lip factor for the shader
      const mat = lm > 0.01 ? [MAT.SKIN, lerp(0.5, 0.38, lm), lm, 1] : skinMat;
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
  if (app.mask !== 'plague') buildMouthInside(mb, app, rig, P); // (hidden under the doctor's hood)
  // ---- eyes + lids
  for (let s = 0; s < 2; s++) buildEye(mb, app, rig, P, s, Q);
  // ---- ears
  if (app.mask !== 'plague') for (let s = 0; s < 2; s++) buildEar(mb, app, rig, P, s); // the hood covers the ears
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
  if (app.mask) buildMask(mb, app, rig, P);
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

// Hockey-style mask (fan-made slasher): a moulded shell over the face. Radii come from rays against the
// head SDF, max-filtered (bridges nose and lips) and blurred, then pushed out a few millimetres. The oval
// outline is in the geometry; eye openings, breathing holes and red chevrons are drawn by the shader
// (uv = view angles; aColor2 carries the eye-opening position).
function buildMask(mb, app, rig, P) {
  if (app.mask === 'plague') return buildPlagueMask(mb, app, rig, P);
  const S = rig.sHead, HC = rig.headCenter, sdf = P.sdf;
  const nA = 18, nB = 20, aMax = 1.08, bTop = 1.02, bBot = -1.02, bc = (bTop + bBot) / 2, bh = (bTop - bBot) / 2;
  const dirOf = (a, b, out) => out.set(Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b));
  const G = [], A = [];
  const v = new V3();
  for (let i = 0; i <= nB; i++) {
    const b = lerp(bTop, bBot, i / nB), aw = aMax * Math.sqrt(Math.max(0.03, 1 - ((b - bc) / bh) ** 2));
    const row = [], arow = [];
    for (let j = 0; j <= nA; j++) {
      const a = lerp(-aw, aw, j / nA);
      dirOf(a, b, v);
      row.push(projectRay(sdf, 0, 0.004, 0, v.x, v.y, v.z, 0.22));
      arow.push(a);
    }
    G.push(row); A.push(arow);
  }
  const filt = (src, rad, fn) => src.map((row, i) => row.map((_, j) => {
    const vals = [];
    for (let di = -rad; di <= rad; di++) for (let dj = -rad; dj <= rad; dj++) { const r = src[i + di]; if (r && r[j + dj] != null) vals.push(r[j + dj]); }
    return fn(vals);
  }));
  let R = filt(G, 2, (vs) => Math.max(...vs));
  R = filt(R, 1, (vs) => vs.reduce((x, y) => x + y, 0) / vs.length);
  const eyeA = Math.atan2(P.eye.x, P.eye.z), eyeB = Math.atan2(P.eye.y - 0.004, Math.hypot(P.eye.x, P.eye.z));
  const col = C(0xdcd8cc), col2 = { r: eyeA, g: eyeB, b: 0 };
  const mat = [MAT.MASK, 0.45, 0, 1], wts = [[B.head, 1]];
  mb.beginPart();
  const st = mb.I.length, base = mb.n;
  for (let i = 0; i <= nB; i++) {
    const b = lerp(bTop, bBot, i / nB);
    for (let j = 0; j <= nA; j++) {
      const a = A[i][j];
      dirOf(a, b, v);
      const r = R[i][j] + 0.0065 + 0.004 * (1 - Math.cos(a));
      mb.v(HC.x + v.x * r * S, HC.y + (0.004 + v.y * r) * S, HC.z + v.z * r * S, a, b, col, mat, col2, wts, REGION.HEAD);
    }
  }
  for (let i = 0; i < nB; i++) for (let j = 0; j < nA; j++) { const q = base + i * (nA + 1) + j; mb.quad(q, q + 1, q + nA + 2, q + nA + 1); }
  orientPartOutward(mb, st, new V3(HC.x, HC.y, HC.z - 0.02 * S));
  mb.endPart();
}

// the containment doctor's head: a stitched leather hood over the whole head, round brass goggles,
// a long curved beak over the nose and mouth, and a wide-brimmed hat with a band and a brass emblem
function buildPlagueMask(mb, app, rig, P) {
  const S = rig.sHead, HC = rig.headCenter, sdf = P.sdf, wts = [[B.head, 1]], v = new V3();
  const leather = C(0x2c2119), beakC = C(0x5b412b), brass = C(0xb08b46), lens = C(0x0f1416), hatC = C(0x231c17), bandC = C(0x4a3828);
  const dirOf = (a, b, out) => out.set(Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b));
  // hood: a shell fitted over the head shape, all the way round
  // the lower edge drops further at the front so the hood wraps under the chin like a balaclava
  const nA = 28, nB = 18, b1 = 1.45, R = [], b0At = (a) => -0.85 - 0.32 * Math.pow(Math.max(0, Math.cos(a)), 1.5);
  for (let i = 0; i <= nB; i++) { const row = []; for (let j = 0; j <= nA; j++) { const a = -Math.PI + TAU * j / nA; dirOf(a, lerp(b1, b0At(a), i / nB), v); row.push(Math.min(projectRay(sdf, 0, 0.004, 0, v.x, v.y, v.z, 0.24), 0.165)); } R.push(row); }
  mb.beginPart();
  let st = mb.I.length, base = mb.n;
  for (let i = 0; i <= nB; i++) {
    for (let j = 0; j <= nA; j++) {
      const a = -Math.PI + TAU * j / nA, b = lerp(b1, b0At(a), i / nB); dirOf(a, b, v);
      const up = R[Math.max(0, i - 1)], dn = R[Math.min(nB, i + 1)];
      const mouth = 0.02 * Math.exp(-Math.pow(a / 0.5, 2) - Math.pow((b + 0.55) / 0.32, 2)); // lips and chin sit proud of the head shape
      const r = Math.max(R[i][j], R[i][(j + 1) % nA] || 0, R[i][(j + nA - 1) % nA] || 0, up[j], dn[j]) + 0.012 + mouth;
      mb.v(HC.x + v.x * r * S, HC.y + (0.004 + v.y * r) * S, HC.z + v.z * r * S, j / nA * 6, i / nB * 3, leather, [MAT.LEATHER, 0.62, 0, 1], leather, wts, REGION.HEAD);
    }
  }
  for (let i = 0; i < nB; i++) for (let j = 0; j < nA; j++) { const q = base + i * (nA + 1) + j; mb.quad(q, q + 1, q + nA + 2, q + nA + 1); }
  orientPartOutward(mb, st, new V3(HC.x, HC.y, HC.z));
  mb.endPart();
  const surf = (dx, dy, dz, extra) => { const L = Math.hypot(dx, dy, dz); const r = projectRay(sdf, 0, 0.004, 0, dx / L, dy / L, dz / L, 0.24) + 0.012 + (extra || 0); return new V3(HC.x + dx / L * r * S, HC.y + (0.004 + dy / L * r) * S, HC.z + dz / L * r * S); };
  const ring = (c, ax, r0, r1, len, col, mat, n = 14) => {
    const e1 = new V3().crossVectors(ax, UP).normalize(), e2 = new V3().crossVectors(e1, ax).normalize(), rings = [];
    for (let k = 0; k <= 1; k++) { const r = k ? r1 : r0; rings.push({ c: c.clone().addScaledVector(ax, len * k), e1, e2, prof: (t) => [Math.cos(t) * r, Math.sin(t) * r], col, mat, col2: col, wts, reg: REGION.HEAD, v: k * len }); }
    addLoft(mb, rings, n, { capEnd: { offset: ax.clone().multiplyScalar(0.0006) } });
  };
  // goggles: thick brass rims round recessed dark glass, sitting on the hood over the eyes. The hood is
  // max-filtered (it bridges the eye sockets), so the rim base is measured the same way.
  const hoodR = (dx, dy, dz) => {
    const L = Math.hypot(dx, dy, dz), a = Math.atan2(dx, dz), b = Math.asin(dy / L);
    let r = 0;
    for (const da of [-TAU / nA, 0, TAU / nA]) for (const db of [-0.08, 0, 0.08]) { dirOf(a + da, b + db, v); r = Math.max(r, projectRay(sdf, 0, 0.004, 0, v.x, v.y, v.z, 0.24)); }
    return r + 0.012;
  };
  for (const sg of [-1, 1]) {
    const ex = P.eye.x * sg * 1.05, ey = P.eye.y + 0.004, ez = P.eye.z, L = Math.hypot(ex, ey, ez), r = hoodR(ex, ey, ez) - 0.004;
    const c = new V3(HC.x + ex / L * r * S, HC.y + (0.004 + ey / L * r) * S, HC.z + ez / L * r * S), ax = new V3(ex * 0.9, 0.03, 1).normalize();
    const e1 = new V3().crossVectors(ax, UP).normalize(), e2 = new V3().crossVectors(e1, ax).normalize();
    const ro = 0.029 * S, ri = 0.021 * S, len = 0.02 * S, bm = [MAT.METAL, 0.3, 0, 1];
    const rr = (d, rad, col, mat) => ({ c: c.clone().addScaledVector(ax, d), e1, e2, prof: (t) => [Math.cos(t) * rad, Math.sin(t) * rad], col, mat, col2: col, wts, reg: REGION.HEAD, v: d });
    // the rim: out along the side, round the lip, and back in to the glass
    addLoft(mb, [rr(-0.006 * S, ro * 0.96, leather, [MAT.LEATHER, 0.6, 0, 1]), rr(0, ro, brass, bm), rr(len * 0.7, ro, brass, bm), rr(len, ro * 0.9, brass, bm), rr(len, ri, brass, bm), rr(len - 0.006 * S, ri, brass, bm)], 18);
    // the glass, slightly domed, and four little screws on the rim face
    addLoft(mb, [rr(len - 0.006 * S, ri, lens, [MAT.METAL, 0.05, 0, 1]), rr(len - 0.003 * S, ri * 0.6, lens, [MAT.METAL, 0.05, 0, 1])], 18, { capEnd: { offset: ax.clone().multiplyScalar(0.0012 * S) } });
    for (let k = 0; k < 4; k++) { const t = k * Math.PI / 2 + Math.PI / 4; addBox(mb, c.clone().addScaledVector(ax, len + 0.0005 * S).addScaledVector(e1, Math.cos(t) * (ro + ri) * 0.5).addScaledVector(e2, Math.sin(t) * (ro + ri) * 0.5), e1, e2, ax, 0.0018 * S, 0.0018 * S, 0.0012 * S, C(0x7d6230), bm, wts, REGION.HEAD); }
  }
  // a strap between the goggles across the bridge of the beak
  {
    const L = Math.hypot(0, P.eye.y, P.eye.z), r = hoodR(0, P.eye.y + 0.004, P.eye.z) + 0.002;
    addBox(mb, new V3(HC.x, HC.y + (0.004 + (P.eye.y + 0.004) / L * r) * S, HC.z + P.eye.z / L * r * S), new V3(1, 0, 0), new V3(0, 1, 0), new V3(0, 0, 1), Math.abs(P.eye.x) * 0.55 * S, 0.006 * S, 0.003 * S, C(0x1c140e), [MAT.LEATHER, 0.5, 0, 1], wts, REGION.HEAD);
  }
  // a leather cowl from the hood down over the neck, flaring onto the collar (no skin shows between)
  {
    const neckR = 0.059 * app.body.neck, nbl = (rig.neckBaseY - HC.y) / S, rows = [];
    // [height, side, back/front depth, extra reach forward under the chin]
    const spec = [[0.0, 1.28, 1.22, 1.05], [-0.045, 1.16, 1.1, 1.45], [-0.09, 1.0, 1.0, 1.5], [nbl + 0.02, 1.12, 1.08, 1.1], [nbl - 0.03, 1.55, 1.25, 1], [nbl - 0.065, 2.15, 1.6, 1], [nbl - 0.08, 2.25, 1.68, 1]];
    for (const [yl, kx, kz, kf] of spec) {
      const y = HC.y + yl * S, zc = HC.z - 0.016 * S, k = smoothstep(-0.035, -0.075, yl);
      let w;
      if (yl > -0.07) w = [[B.head, 1 - k], [B.neck, k]];
      else if (yl > nbl - 0.01) w = [[B.neck, 1]];
      else { const q = smoothstep(nbl - 0.01, nbl - 0.06, yl); w = [[B.neck, 1 - q * 0.7], [B.chest, q * 0.7]]; }
      rows.push({ c: new V3(HC.x, y, zc), e1: new V3(1, 0, 0), e2: new V3(0, 0, 1), prof: (t) => [Math.sin(t) * neckR * kx * 1.12 * S, Math.cos(t) * neckR * kz * (Math.cos(t) > 0 ? 1.2 * lerp(1, kf, Math.cos(t) ** 2) : 1.5) * S], col: leather, mat: [MAT.LEATHER, 0.6, 0, 1], col2: leather, wts: w, reg: yl < -0.09 ? REGION.NECK : REGION.HEAD, v: yl });
    }
    addLoft(mb, rows, 20);
  }
  // beak: elliptical rings from the face, forward and curving down to a point
  const nb = 12, nr = 14, beak = [];
  const bc = surf(0, P.mouthYScaled + 0.02, 0.1, -0.002);
  for (let k = 0; k <= nb; k++) {
    const t = k / nb, w = 0.038 * Math.pow(1 - t, 0.85) + 0.0015, h = 0.044 * Math.pow(1 - t, 0.8) + 0.0015;
    const c = new V3(bc.x, bc.y - (0.012 + 0.07 * t * t) * S, bc.z + (0.27 * t) * S);
    beak.push({ c, e1: new V3(1, 0, 0), e2: new V3(0, 1, 0), prof: (q) => [Math.cos(q) * w * S, Math.sin(q) * h * S * (Math.sin(q) > 0 ? 1 : 0.8)], col: k % 3 === 0 ? C(0x4e3824) : beakC, mat: [MAT.LEATHER, 0.5, 0, 1], col2: beakC, wts, reg: REGION.HEAD, v: t });
  }
  addLoft(mb, beak, nr, { capStart: { offset: new V3(0, 0, -0.02 * S) }, capEnd: { offset: new V3(0, -0.004 * S, 0.004 * S) } });
  for (let k = 1; k < nb - 2; k += 2) { const q = beak[k]; addBox(mb, q.c.clone().add(new V3(0, (0.044 * Math.pow(1 - k / nb, 0.8)) * S + 0.002 * S, 0)), new V3(1, 0, 0), new V3(0, 1, 0), new V3(0, 0, 1), 0.0035 * S, 0.002 * S, 0.0035 * S, brass, [MAT.METAL, 0.3, 0, 1], wts, REGION.HEAD); }
  // stitching along both sides of the beak, and two breathing holes near its base
  for (const sg of [-1, 1]) for (let k = 1; k < nb - 1; k++) {
    const t = k / nb, q = beak[k], w = (0.038 * Math.pow(1 - t, 0.85) + 0.0015) * S;
    if (k % 1 === 0) addBox(mb, q.c.clone().add(new V3(sg * w * 0.98, 0.004 * S * (1 - t), 0)), new V3(0, 0, 1), new V3(0, 1, 0), new V3(sg, 0, 0), 0.006 * S, 0.0011 * S, 0.0012 * S, C(0x2b1d12), [MAT.LEATHER, 0.6, 0, 1], wts, REGION.HEAD);
  }
  for (const sg of [-1, 1]) {
    const q = beak[2], t = 2 / nb, w = (0.038 * Math.pow(1 - t, 0.85) + 0.0015) * S;
    addCyl(mb, q.c.clone().add(new V3(sg * w * 0.93, -0.012 * S, 0.004 * S)), new V3(sg, -0.2, 0), 0.0045 * S, 0.0015 * S, C(0x0c0907), [MAT.LEATHER, 0.8, 0, 1], wts, REGION.HEAD, 10);
    addCyl(mb, q.c.clone().add(new V3(sg * (w * 0.93 + 0.0006 * S), -0.012 * S, 0.004 * S)), new V3(sg, -0.2, 0), 0.0058 * S, 0.0009 * S, brass, [MAT.METAL, 0.3, 0, 1], wts, REGION.HEAD, 10);
  }
  // a strap from the base of the beak round the back of the hood, buckled at the back
  {
    const yL = P.mouthYScaled + 0.035, pts = [], n = 22;
    for (let k = 0; k <= n; k++) { const a = lerp(0.62, TAU - 0.62, k / n); pts.push(surf(Math.sin(a), yL * 6, Math.cos(a), 0.004)); }
    mb.beginPart();
    const st = mb.I.length, b0 = mb.n, hw = 0.006 * S, sc0 = C(0x1c140e);
    for (let k = 0; k <= n; k++) { mb.v(pts[k].x, pts[k].y + hw, pts[k].z, k / n, 0, sc0, [MAT.LEATHER, 0.5, 0, 1], sc0, wts, REGION.HEAD); mb.v(pts[k].x, pts[k].y - hw, pts[k].z, k / n, 1, sc0, [MAT.LEATHER, 0.5, 0, 1], sc0, wts, REGION.HEAD); }
    for (let k = 0; k < n; k++) { const q = b0 + k * 2; mb.quad(q, q + 1, q + 3, q + 2); }
    orientPartOutward(mb, st, new V3(HC.x, HC.y, HC.z));
    mb.endPart();
    const back = pts[n >> 1];
    addBuckle(mb, back.clone().add(new V3(0, 0, -0.002 * S)), new V3(1, 0, 0), new V3(0, 1, 0), new V3(0, 0, -1), 0.009 * S, 0.008 * S, 0.0018 * S, brass, [MAT.METAL, 0.3, 0, 1], wts, REGION.HEAD);
  }
  // a raised seam down the middle of the hood, forehead to nape
  for (let k = 0; k <= 16; k++) {
    const a = k < 8 ? lerp(1.15, Math.PI / 2, k / 8) : lerp(Math.PI / 2, Math.PI + 0.55, (k - 8) / 8);
    const p = surf(0, Math.sin(a), Math.cos(a), 0.0015);
    addBox(mb, p, new V3(1, 0, 0), new V3(0, Math.cos(a), -Math.sin(a)), new V3(0, Math.sin(a), Math.cos(a)), 0.0016 * S, 0.006 * S, 0.0014 * S, C(0x221811), [MAT.LEATHER, 0.6, 0, 1], wts, REGION.HEAD);
  }
  // hat: a low flat crown with a band and emblem, on a wide brim tilted a touch forward
  const top = surf(0, 1, -0.05, 0), hy = top.y - 0.03 * S, tilt = 0.08;
  const hatRing = (r, y, col, mat) => ({ c: new V3(HC.x, y, HC.z - 0.01 * S + Math.sin(tilt) * (y - hy)), e1: new V3(1, 0, 0), e2: new V3(0, -Math.sin(tilt), Math.cos(tilt)), prof: (q) => [Math.cos(q) * r, Math.sin(q) * r * 1.08], col, mat, col2: col, wts, reg: REGION.HEAD, v: y });
  const hm = [MAT.CANVAS, 0.8, 0, 1];
  addLoft(mb, [hatRing(0.215 * S, hy - 0.004 * S, hatC, hm), hatRing(0.205 * S, hy + 0.004 * S, hatC, hm), hatRing(0.112 * S, hy + 0.006 * S, hatC, hm)], 28);
  addLoft(mb, [hatRing(0.108 * S, hy, bandC, [MAT.LEATHER, 0.5, 0, 1]), hatRing(0.108 * S, hy + 0.026 * S, bandC, [MAT.LEATHER, 0.5, 0, 1]), hatRing(0.104 * S, hy + 0.028 * S, hatC, hm), hatRing(0.1 * S, hy + 0.088 * S, hatC, hm)], 24, { capEnd: { offset: new V3(0, 0.002 * S, 0) } });
  addLoft(mb, [hatRing(0.215 * S, hy - 0.004 * S, hatC, hm), hatRing(0.2 * S, hy - 0.01 * S, hatC, hm), hatRing(0.1 * S, hy - 0.008 * S, hatC, hm)], 28);
  addBox(mb, new V3(HC.x, hy + 0.014 * S, HC.z + 0.108 * S), new V3(1, 0, 0), new V3(0, 1, 0), new V3(0, 0, 1), 0.012 * S, 0.012 * S, 0.003 * S, brass, [MAT.METAL, 0.3, 0, 1], wts, REGION.HEAD);
}

function buildMouthInside(mb, app, rig, P) {
  const S = rig.sHead, HC = rig.headCenter;
  const dark = C(0x2a0c0c);
  const cx = 0, cy = P.mouthYScaled - 0.004, cz = 0.068;
  addSphereLike(mb, 8, 12, (th, ph) => new V3(HC.x + (cx + Math.sin(ph) * Math.sin(th) * 0.019) * S, HC.y + (cy + Math.cos(ph) * 0.012) * S, HC.z + (cz + Math.sin(ph) * Math.cos(th) * 0.018) * S),
    (th, ph, p) => ({ col: dark, mat: [MAT.MOUTH, 0.6, 0, 1], col2: dark, wts: ph > Math.PI * 0.5 ? [[B.jaw, 1]] : [[B.head, 1]], reg: REGION.HEAD }));
  // V1.12: individual teeth on the dental arch (upper ones a little in front of the lower), gums, a tongue
  const rng = new RNG((app.seed * 7 + 3) >>> 0);
  const yellow = rng.range(0, 0.16) + (app.age > 50 ? 0.12 : 0);
  const toothCol = C(0xeee8da).lerp(C(0xd8c69c), yellow), gumCol = C(0xc06468).lerp(C(app.skin.hex), 0.2), tongueCol = C(0xb4585e);
  const my = P.mouthYScaled;
  const archPt = (a, r, dz) => [Math.sin(a) * r, 0.0655 + dz + Math.cos(a) * r * 0.85];
  const emitBox = (corners, col, mat, w) => { // corners: 8 points [x,y,z] (0-3 one end, 4-7 the other)
    mb.beginPart();
    const st = mb.I.length, base = mb.n;
    for (const [x, y, z] of corners) mb.v(HC.x + x * S, HC.y + y * S, HC.z + z * S, x * 40, y * 40, col, mat, col, w, REGION.HEAD);
    const q = (a, b2, c2, d) => mb.quad(base + a, base + b2, base + c2, base + d);
    q(0, 1, 2, 3); q(7, 6, 5, 4); q(0, 4, 5, 1); q(1, 5, 6, 2); q(2, 6, 7, 3); q(3, 7, 4, 0);
    let mx = 0, my2 = 0, mz = 0; for (const c of corners) { mx += c[0]; my2 += c[1]; mz += c[2]; }
    orientPartOutward(mb, st, new V3(HC.x + mx / 8 * S, HC.y + my2 / 8 * S, HC.z + mz / 8 * S));
    mb.endPart();
  };
  const tooth = (a, w, h, t, up, r, dz, jitter) => {
    const [x, z] = archPt(a, r, dz), tx = Math.cos(a), tz = -Math.sin(a) * 0.85, tl = Math.hypot(tx, tz), ux = tx / tl, uz = tz / tl;
    const nx = -uz, nz = ux; // outward (toward the lips)
    const sgn = up ? -1 : 1, y0 = up ? my + 0.0082 : my - 0.0078, y1 = y0 + sgn * (h + jitter), hw = w / 2, ht = t / 2;
    const ring = (yy, k, kt) => [[x - ux * hw * k + nx * ht * kt, yy, z - uz * hw * k + nz * ht * kt], [x + ux * hw * k + nx * ht * kt, yy, z + uz * hw * k + nz * ht * kt],
      [x + ux * hw * k - nx * ht, yy, z + uz * hw * k - nz * ht], [x - ux * hw * k - nx * ht, yy, z - uz * hw * k - nz * ht]];
    emitBox(ring(y0, 0.92, 1).concat(ring(y1, 0.86, 0.45)), toothCol, [MAT.TEETH, 0.28, 0, 1], up ? [[B.head, 1]] : [[B.jaw, 1]]);
  };
  const U = [[0.165, 0.0084, 0.0074], [0.47, 0.0066, 0.0066], [0.77, 0.0074, 0.0078], [1.02, 0.0068, 0.0064], [1.24, 0.0066, 0.006]];
  const L = [[0.12, 0.0052, 0.0062], [0.345, 0.0056, 0.0062], [0.6, 0.0066, 0.007], [0.86, 0.0066, 0.006], [1.08, 0.0066, 0.0058]];
  for (const sg of [-1, 1]) {
    for (const [a, w, h] of U) tooth(sg * a, w, h, 0.0062, true, 0.0215, 0, rng.range(-0.0004, 0.0004));
    for (const [a, w, h] of L) tooth(sg * a, w, h, 0.0055, false, 0.0196, -0.0016, rng.range(-0.0004, 0.0003));
  }
  // gums: a band along each arch at the roots of the teeth
  for (const up of [true, false]) {
    const r = up ? 0.0219 : 0.0199, dz = up ? 0 : -0.0016, y0 = up ? my + 0.0078 : my - 0.0074, y1 = up ? my + 0.0118 : my - 0.0112;
    mb.beginPart(); const st = mb.I.length, base = mb.n, n = 14;
    for (let i = 0; i <= n; i++) {
      const a = lerp(-1.32, 1.32, i / n);
      for (const [yy, rr] of [[y0, r + 0.0006], [y1, r - 0.0018]]) { const [x, z] = archPt(a, rr, dz); mb.v(HC.x + x * S, HC.y + yy * S, HC.z + z * S, i / n, yy * 40, gumCol, [MAT.LIPS, 0.4, 0, 1], gumCol, up ? [[B.head, 1]] : [[B.jaw, 1]], REGION.HEAD); }
    }
    for (let i = 0; i < n; i++) mb.quad(base + i * 2, base + i * 2 + 1, base + i * 2 + 3, base + i * 2 + 2);
    orientPartOutward(mb, st, new V3(HC.x, HC.y + (y0 + y1) / 2 * S, HC.z + 0.05 * S));
    mb.endPart();
  }
  // the tongue resting on the floor of the mouth, behind the lower teeth
  addSphereLike(mb, 6, 10, (th, ph) => new V3(HC.x + Math.sin(ph) * Math.sin(th) * 0.0145 * S, HC.y + (my - 0.0085 + Math.cos(ph) * 0.0045) * S, HC.z + (0.059 + Math.sin(ph) * Math.cos(th) * 0.017) * S),
    () => ({ col: tongueCol, mat: [MAT.MOUTH, 0.45, 0, 1], col2: tongueCol, wts: [[B.jaw, 1]], reg: REGION.HEAD }));
  // fangs (everyone has them hidden behind the upper lip; the shader extends them for vampires:
  // aMat.w on the tip = how far it grows, in metres)
  const fangCol = C(0xf2eee2), y0 = P.mouthYScaled + 0.0025;
  for (const sg of [1, -1]) {
    const a = sg * 0.77, r = 0.0212;
    const fx = Math.sin(a) * r, fz = 0.0655 + Math.cos(a) * r * 0.85 + 0.0004;
    mb.beginPart();
    const st = mb.I.length, base = mb.n, n = 6, rad = 0.0025;
    for (let i = 0; i < n; i++) {
      const t = i / n * TAU;
      mb.v(HC.x + (fx + Math.cos(t) * rad) * S, HC.y + (y0 + 0.002) * S, HC.z + (fz + Math.sin(t) * rad * 0.8) * S, i / n, 0, fangCol, [MAT.FANG, 0.3, 0, 0], fangCol, [[B.head, 1]], REGION.HEAD);
    }
    const tip = mb.v(HC.x + fx * S, HC.y + (y0 - 0.0005) * S, HC.z + (fz + 0.0006) * S, 0.5, 1, fangCol, [MAT.FANG, 0.3, 0, 0.0085 * S], fangCol, [[B.head, 1]], REGION.HEAD);
    for (let i = 0; i < n; i++) mb.tri(base + i, base + (i + 1) % n, tip);
    orientPartOutward(mb, st, new V3(HC.x + fx * S, HC.y + (y0 + 0.004) * S, HC.z + fz * S));
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
  // eyelashes: a dark fringe curling out and up from the upper lid edge (longer for women)
  {
    const len = (app.male ? 0.0042 : 0.0072) * S, cols3 = 14;
    mb.beginPart();
    const st3 = mb.I.length, b3 = mb.n;
    for (let i = 0; i <= 2; i++) {
      for (let j = 0; j <= cols3; j++) {
        const a = lerp(-1.25, 1.25, j / cols3);
        const e = eUp(a);
        const prof = Math.pow(Math.max(0, Math.cos(a / 1.25 * Math.PI * 0.5)), 0.6) * (1 + 0.25 * a * sg); // longer at the outer corner
        const k = i / 2, L = len * prof * k;
        const nx = Math.sin(a) * Math.cos(e), ny = Math.sin(e), nz = Math.cos(a) * Math.cos(e);
        const rr = Rl * 1.03 + L * 0.75;
        const x = ec.x + nx * rr, y = ec.y + ny * rr + L * (0.55 + 0.35 * k), z = ec.z + nz * rr;
        mb.v(x, y, z, a, k, lashCol, [MAT.HAIR, 0.6, 0, 1], lashCol, [[SB('lid', side), 1]], REGION.HEAD);
      }
    }
    for (let i = 0; i < 2; i++) for (let j = 0; j < cols3; j++) {
      const a = b3 + i * (cols3 + 1) + j;
      mb.quad(a, a + 1, a + cols3 + 2, a + cols3 + 1);
    }
    orientPartOutward(mb, st3, ec);
    mb.endPart();
  }
}

// V1.12 ears: an outline wider at the top and narrowing to a soft lobe, tilted back about 16 deg, with the
// real relief on the outer face - the rolled rim (helix) and the groove inside it, the inner ridge
// (antihelix) with its upper fork, the bowl (concha) leading into the canal, the small flap in front
// (tragus) and the one below it (antitragus). The front edge joins the head; the back edge stands out
// from it (less under long hair, which then lies over the ear instead of being pierced by it).
function buildEar(mb, app, rig, P, side) {
  const sg = SIDE_SIGN[side];
  const S = rig.sHead, HC = rig.headCenter;
  const k = 1 + 0.08 * app.face.ear;
  const c = new V3(sg * 0.0675, -0.017, -0.013);
  const base = C(app.skin.hex), skin = skinColorAt(base, 0.45, 0.03);
  const deep = skin.clone().multiplyScalar(0.62), rimCol = skin.clone().multiply(new THREE.Color(1.06, 0.9, 0.86));
  const longHair = /long|medium|bob|curly_long/.test(app.hairStyle) && app.hairStyle !== 'medium_short';
  const rotBack = -0.28, cr = Math.cos(rotBack), sr = Math.sin(rotBack);
  const H2 = 0.031 * k, W2 = 0.0178 * k;
  const flare = longHair ? 0.0042 : 0.0095;
  const g = (x, s2) => Math.exp(-x * x / (s2 * s2));
  // relief of the outer face at normalised ear coordinates (ny up, nz forward), d = 1 - radius
  const relief = (ny, nz, d) => {
    const hMask = smoothstep(-0.78, -0.4, ny) * (1 - 0.8 * smoothstep(0.15, 0.75, nz) * smoothstep(0.0, 0.6, ny));
    const helix = 0.0042 * g(d - 0.065, 0.06) * hMask;
    const scapha = -0.0019 * g(d - 0.2, 0.065) * hMask;
    const anti = 0.0025 * g(d - 0.37, 0.08) * smoothstep(-0.6, -0.25, ny) * (1 - smoothstep(0.05, 0.55, nz));
    const fork = 0.0015 * g(ny - 0.42, 0.11) * smoothstep(-0.35, 0.15, nz) * (1 - smoothstep(0.45, 0.8, nz)) * smoothstep(0.2, 0.35, d);
    const concha = -0.0062 * Math.exp(-(((ny + 0.06) / 0.37) ** 2 + ((nz - 0.12) / 0.33) ** 2));
    const canal = -0.0036 * Math.exp(-(((ny + 0.12) / 0.11) ** 2 + ((nz - 0.36) / 0.1) ** 2));
    const tragus = 0.0034 * Math.exp(-(((ny + 0.12) / 0.13) ** 2 + ((nz - 0.72) / 0.1) ** 2));
    const antitragus = 0.0018 * Math.exp(-(((ny + 0.43) / 0.1) ** 2 + ((nz - 0.24) / 0.12) ** 2));
    const lobe = 0.0016 * smoothstep(-0.55, -0.9, ny);
    return { r: 0.0017 + helix + scapha + anti + fork + concha + canal + tragus + antitragus + lobe, rim: helix / 0.0042, hollow: Math.min(0, concha + canal + scapha) };
  };
  const st = mb.I.length;
  addSphereLike(mb, 14, 22, (th, ph) => {
    // local: lx outward, ly up, lz forward
    const cy = Math.cos(th), sz = Math.sin(th);
    const wz = W2 * (cy > 0 ? 1.0 : 0.76 + 0.24 * (1 + cy)) * (sz > 0 ? 0.88 : 1.0);
    const rad = Math.sin(ph), front = Math.cos(ph);
    let ly = rad * cy * H2, lz = rad * sz * wz;
    if (app.vampEars) { const tip = Math.pow(Math.max(0, cy), 3) * clamp(0.5 - sz * 0.7, 0, 1) * rad; ly += tip * 0.017; lz -= tip * 0.011; } // pointed tips
    let lx;
    if (front > 0) { const R = relief(rad * cy, rad * sz, 1 - rad); lx = R.r * Math.pow(front, 0.35); }
    else lx = front * (sz > 0.45 ? 0.0065 : 0.0034);   // the back is smooth; its front part sinks into the head
    // the back edge stands out from the head
    lx += Math.max(0, -lz) / W2 * flare + 0.0022;
    const y2 = ly * cr - lz * sr, z2 = ly * sr + lz * cr;
    return new V3(HC.x + (c.x + sg * lx) * S, HC.y + (c.y + y2) * S, HC.z + (c.z + z2) * S);
  }, (th, ph) => {
    const cy = Math.cos(th), sz = Math.sin(th), rad = Math.sin(ph), front = Math.cos(ph);
    let col = skin;
    if (front > 0) {
      const R = relief(rad * cy, rad * sz, 1 - rad);
      col = skin.clone().lerp(deep, clamp(-R.hollow / 0.0062, 0, 1) * 0.75).lerp(rimCol, clamp(R.rim, 0, 1) * 0.5);
    } else col = skin.clone().multiplyScalar(0.92);
    return { col, mat: [MAT.SKIN, 0.5, 0, 1], col2: skin, wts: [[B.head, 1]], reg: REGION.HEAD };
  });
  orientPartOutward(mb, st, new V3(HC.x + (c.x - sg * 0.012) * S, HC.y + c.y * S, HC.z + c.z * S));
}

function buildBrow(mb, app, rig, P, side) {
  const sg = SIDE_SIGN[side];
  const S = rig.sHead, HC = rig.headCenter;
  const F = app.face;
  const col = C(app.hairColor.hex).clone();
  if (app.hairColor.name === 'Platinum' || app.hairColor.name === 'White') col.multiplyScalar(0.8);
  if (app.hairColor.name.startsWith('Dyed')) col.copy(C(0x2a1b12)).lerp(C(0x4a3424), (app.seed % 5) / 8); // dyed hair, natural brows
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
    if (style2.curtain) t += 0.0028 * (noise3(x * 70, y * 22, z * 70) - 0.5) * 2 + 0.0015 * Math.sin(Math.atan2(x, z) * 26 + y * 40); // locks, not a shell
    // long hair lies over the ears: the scalp hair bulges with the curtain there (no seam between them)
    if (style2.curtain) { const ap = Math.abs(wrapAngle(phi)); t += 0.0072 * Math.exp(-(((ap - 1.62) / 0.36) ** 2) - (((y + 0.024) / 0.03) ** 2)) * smoothstep(0.012, -0.004, y); }
    // thin out at the hairline edge
    return t * (0.55 + 0.45 * m);
  };
  addShell(mb, app, rig, grid, sdHair, thick, col, MAT.HAIR, false, style2.afro ? 1.4 : 0.75);
  if (style2.curtain) {
    // hanging hair moves more toward its ends (nothing above the ears)
    const HC = rig.headCenter, S = rig.sHead;
    mb.flexFn = (x, y) => Math.pow(clamp((-0.02 - (y - HC.y) / S) / 0.2, 0, 1), 1.2) * 0.8;
    buildHairCurtain(mb, app, rig, grid, style2, col, Q);
    mb.flexFn = null;
  }
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
  // the curtain must clear the clothed upper back (it used to sit inside the shirt and vanish)
  const shoulderW = (rig.shoulderHalf / S) * 1.05, backD = ((app.male ? 0.06 : 0.058) * rig.H + 0.02 * (rig.H / 1.75)) / S;
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
    let phiLim = lerp(phiLimTop, kind === 'long' ? 2.05 : 1.6, smoothstep(-0.06, yBot, y) * (kind === 'bob' ? 0.3 : 1));
    // below the neck the hair falls down the back (not over the shoulder tops like a cape)
    if (y < neckBaseL + 0.02) phiLim = Math.max(phiLim, lerp(1.75, 2.3, smoothstep(neckBaseL + 0.02, neckBaseL - 0.08, y)));
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
          r = Math.max(r, lerp(r, Math.hypot(bx * 0.6, bz) + 0.016, below));
        }
        // hair lies over the ears (never pierced by them): a bulge where each ear stands out
        { const ap = Math.abs(wrapAngle(phi)); r += 0.0072 * Math.exp(-(((ap - 1.62) / 0.36) ** 2) - (((y + 0.024) / 0.03) ** 2)) * smoothstep(0.012, -0.004, y); }
        if (st.wave) r += st.wave * Math.sin(y * 90 + phi * 3) * smoothstep(0.0, -0.05, y);
        if (st.curl) r += st.curl * (noise3(Math.cos(phi) * 30, y * 60, Math.sin(phi) * 30) - 0.5) * 2;
        // lie on top of the clothed neck/back/shoulders (never through the collar, hood or shirt)
        if (rig.torsoSurf && y < 0.0) {
          const back = smoothstep(1.65, 2.15, Math.abs(wrapAngle(phi))); // the sides hang free, the back lies on the body
          const ts = back > 0 ? rig.torsoSurf(HC.y + y * S, phi) : 0;
          if (ts > 0) r = Math.max(r, lerp(r, (ts - Math.cos(phi) * (HC.z - 0.01 * S) + 0.007) / S + thick, back));
        }
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
