// ============================================================================
// Procedural body + fitted clothing (lofted, skinned to the reusable rig)
// ============================================================================
const _colCache = new Map();
function C(hex) { let c = _colCache.get(hex); if (!c) { c = new THREE.Color(hex); _colCache.set(hex, c); } return c; }
function shadeColor(color, f) { return new THREE.Color(color.r * f, color.g * f, color.b * f); }
function mixColor(a, b, t) { return new THREE.Color().copy(a).lerp(b, t); }

function sampleTable(table, x, col) {
  const n = table.length;
  if (x <= table[0][0]) return table[0][col];
  if (x >= table[n - 1][0]) return table[n - 1][col];
  let i = 0; while (i < n - 2 && table[i + 1][0] < x) i++;
  const x0 = table[i][0], x1 = table[i + 1][0];
  const t = (x - x0) / (x1 - x0);
  const p0 = table[Math.max(0, i - 1)][col], p1 = table[i][col], p2 = table[i + 1][col], p3 = table[Math.min(n - 1, i + 2)][col];
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
function sortedUnique(arr, eps = 1e-4) {
  arr.sort((a, b) => a - b);
  const out = [];
  for (const v of arr) if (!out.length || Math.abs(v - out[out.length - 1]) > eps) out.push(v);
  return out;
}

// --- material presets ----------------------------------------------------------------
const FABRIC = {
  cotton: { type: MAT.COTTON, rough: 0.86 }, pique: { type: MAT.COTTON, rough: 0.88 }, denim: { type: MAT.DENIM, rough: 0.9 },
  twill: { type: MAT.COTTON, rough: 0.84 }, wool: { type: MAT.KNIT, rough: 0.9 }, fleece: { type: MAT.KNIT, rough: 0.95 },
  knit: { type: MAT.KNIT, rough: 0.93 }, nylon: { type: MAT.NYLON, rough: 0.45 }, leather: { type: MAT.LEATHER, rough: 0.42 },
  silk: { type: MAT.NYLON, rough: 0.38 }, lycra: { type: MAT.NYLON, rough: 0.5 }, canvas: { type: MAT.CANVAS, rough: 0.85 },
  mesh: { type: MAT.CANVAS, rough: 0.7 }
};
function layerFromGarment(colorHex, color2Hex, matName, pattern, extra = {}) {
  const f = FABRIC[matName] || FABRIC.cotton;
  return Object.assign({
    col: C(colorHex), col2: C(color2Hex != null ? color2Hex : colorHex),
    mat: [f.type, f.rough, PATTERN_IDS[pattern] || 0, extra.scale || 1], isSkin: false
  }, extra);
}

// Torso control table: u (0 crotch .. 1 neck base), male [hw fd bd cz], female [hw fd bd cz]  (units of H)
const TORSO_CTRL = [
  [0.00, 0.034, 0.016, 0.022, 0.000, 0.040, 0.018, 0.026, 0.000],
  [0.04, 0.070, 0.032, 0.046, 0.000, 0.078, 0.034, 0.052, 0.000],
  [0.10, 0.094, 0.048, 0.062, 0.000, 0.104, 0.049, 0.068, 0.000],
  [0.17, 0.096, 0.053, 0.061, 0.000, 0.107, 0.053, 0.066, 0.000],
  [0.27, 0.089, 0.053, 0.054, 0.001, 0.096, 0.051, 0.055, 0.001],
  [0.38, 0.079, 0.054, 0.050, 0.002, 0.072, 0.048, 0.046, 0.002],
  [0.50, 0.083, 0.057, 0.053, 0.003, 0.075, 0.050, 0.049, 0.003],
  [0.60, 0.089, 0.061, 0.056, 0.004, 0.079, 0.054, 0.052, 0.004],
  [0.70, 0.092, 0.060, 0.058, 0.003, 0.081, 0.054, 0.054, 0.003],
  [0.78, 0.092, 0.056, 0.058, 0.001, 0.081, 0.051, 0.054, 0.001],
  [0.86, 0.091, 0.049, 0.054, -0.002, 0.082, 0.045, 0.050, -0.002],
  [0.92, 0.086, 0.043, 0.049, -0.004, 0.077, 0.040, 0.046, -0.004],
  [0.96, 0.065, 0.037, 0.043, -0.005, 0.058, 0.034, 0.040, -0.005],
  [1.00, 0.036, 0.030, 0.035, -0.006, 0.032, 0.027, 0.032, -0.006]
];
const ARM_CTRL = [ // dist (H units, canonical), a (thumb axis), b (palm normal axis)
  // the deltoid cap stays under the shoulder line (it used to rise above it like a puffed sleeve)
  [-0.021, 0.009, 0.008], [-0.016, 0.0172, 0.0158], [-0.010, 0.0232, 0.0220], [-0.004, 0.0268, 0.0258], [0.004, 0.0287, 0.0278], [0.035, 0.0296, 0.0286], [0.070, 0.0275, 0.0260],
  [0.110, 0.0265, 0.0245], [0.150, 0.0235, 0.0225], [0.180, 0.0205, 0.0200], [0.200, 0.0215, 0.0205],
  [0.230, 0.0225, 0.0200], [0.270, 0.0195, 0.0170], [0.305, 0.0172, 0.0135], [0.332, 0.0160, 0.0112],
  [0.345, 0.0188, 0.0108], [0.368, 0.0222, 0.0104], [0.388, 0.0232, 0.0095]
];
const LEG_CTRL = [ // f (0 hip joint .. 1 ankle), a (lateral), b (front/back), cz  (H units)
  [-0.05, 0.046, 0.048, 0.000], [0.00, 0.050, 0.052, 0.003], [0.10, 0.050, 0.0515, 0.004], [0.22, 0.0465, 0.048, 0.005],
  [0.34, 0.041, 0.043, 0.005], [0.43, 0.035, 0.036, 0.005], [0.49, 0.032, 0.0325, 0.007], [0.54, 0.031, 0.032, 0.002],
  [0.61, 0.0335, 0.036, -0.006], [0.69, 0.0315, 0.0335, -0.006], [0.79, 0.0255, 0.0265, -0.003], [0.89, 0.0205, 0.0215, -0.001],
  [0.97, 0.0185, 0.0200, 0.000], [1.06, 0.0180, 0.0230, 0.006]
];

const QUALITY = {
  low: { torsoCols: 24, limbCols: 12, fingerCols: 5, ringStep: 1.6, headCols: 40, headRowScale: 0.65, hairDetail: 0.6 },
  high: { torsoCols: 36, limbCols: 16, fingerCols: 6, ringStep: 1.0, headCols: 56, headRowScale: 1.0, hairDetail: 1.0 },
  ultra: { torsoCols: 44, limbCols: 20, fingerCols: 8, ringStep: 0.75, headCols: 68, headRowScale: 1.3, hairDetail: 1.3 }
};

// Skin color helper with subtle per-area variation
function skinColorAt(base, redden, darken) {
  const c = base.clone();
  if (redden) { c.r *= 1 + 0.10 * redden; c.g *= 1 - 0.05 * redden; c.b *= 1 - 0.04 * redden; }
  if (darken) c.multiplyScalar(1 - darken);
  return c;
}

// ---------------------------------------------------------------------------------------
function buildBody(mb, app, rig, Q) {
  const H = rig.H, male = app.male, bd = app.body;
  const sc = H / 1.75;
  const skin = C(app.skin.hex);
  const skinMat = [MAT.SKIN, 0.52, 0, 1];
  const skinLayer = { col: skin, col2: skin, mat: skinMat, isSkin: true };
  const top = app.top, bot = app.bottom, tdef = top.def;
  const isDress = top.type === 'dress';
  const isSkirt = bot && bot.def.len === 'skirt';
  const topLayer = layerFromGarment(top.color, top.color2, tdef.mat, top.pattern);
  const bottomLayer = bot ? layerFromGarment(bot.color, bot.color2, bot.def.mat, bot.pattern) : null;
  const underColor = top.under ? C(top.under.color) : null;
  const tights = (isDress || isSkirt) && (hash32(app.seed, 77) % 100) < 30;
  const legSkinLayer = tights ? { col: C(0x1d1b1f), col2: C(0x1d1b1f), mat: [MAT.NYLON, 0.45, 0, 1], isSkin: false } : skinLayer;

  // ---------------- TORSO ----------------
  const crotchY = rig.crotchY, neckY = rig.neckBaseY, span = neckY - crotchY;
  const ci = male ? 1 : 5;
  const buildK = (u) => {
    // scale factors by region
    const hip = bd.hip, waist = bd.waist, chest = bd.chest, sh = bd.shoulder;
    let k;
    if (u < 0.17) k = hip;
    else if (u < 0.38) k = lerp(hip, waist, smoothstep(0.17, 0.38, u));
    else if (u < 0.62) k = lerp(waist, chest, smoothstep(0.38, 0.62, u));
    else if (u < 0.86) k = lerp(chest, sh, smoothstep(0.62, 0.86, u));
    else k = lerp(sh, 1.0, smoothstep(0.86, 1.0, u));
    return k;
  };
  const torsoP = (u) => {
    const k = buildK(u);
    const fatK = 1 + 0.07 * bd.fat;
    const depthK = lerp(1, k, 0.75) * fatK;
    return {
      hw: sampleTable(TORSO_CTRL, u, ci) * H * k * (u > 0.97 ? 1 : fatK) * (u > 0.92 ? bd.neck : 1),
      fd: sampleTable(TORSO_CTRL, u, ci + 1) * H * depthK,
      bd: sampleTable(TORSO_CTRL, u, ci + 2) * H * depthK,
      cz: sampleTable(TORSO_CTRL, u, ci + 3) * H
    };
  };
  const nTorso = male ? 2.2 : 2.12;
  const torsoBump = (u, th) => {
    let b = 0;
    if (!male && bd.bust > 0) {
      // natural bust under clothing: gentle upper slope, fuller lower curve, fabric spanning the middle
      const a = 0.0225 * H * bd.bust;
      const side = Math.max(gauss(th, 0.44, 0.36), gauss(th, TAU - 0.44, 0.36));
      const bridge = 0.72 * (gauss(th, 0, 0.5) + gauss(th, TAU, 0.5));
      b += a * Math.max(side, bridge) * gauss(u, 0.622, u > 0.622 ? 0.085 : 0.052);
    } else if (male) {
      b += 0.004 * H * (bd.muscle - 0.85) * (gauss(th, 0.5, 0.35) + gauss(th, TAU - 0.5, 0.35)) * gauss(u, 0.66, 0.05);
    }
    if (bd.belly > 0) b += 0.026 * H * bd.belly * (gauss(th, 0, 0.75) + gauss(th, TAU, 0.75)) * gauss(u, 0.40, 0.11);
    // gluteal curve (rounder and fuller for women), lower edge tighter than the slope up to the lower back
    b += (male ? 0.011 : 0.0185) * H * (gauss(th, Math.PI - 0.43, 0.42) + gauss(th, Math.PI + 0.43, 0.42)) * gauss(u, 0.125, u > 0.125 ? 0.085 : 0.056);
    b += 0.004 * H * (gauss(th, Math.PI - 0.62, 0.3) + gauss(th, Math.PI + 0.62, 0.3)) * gauss(u, 0.74, 0.06);
    // shoulder girdle (clavicle to acromion): carries the shoulder line out over the top of the arm,
    // so the deltoid continues the slope from the neck instead of sitting on the corner like a pad
    // (falls off quickly above the shoulder tip so the line still slopes down from the neck)
    b += (male ? 0.021 : 0.0185) * H * (gauss(th, Math.PI / 2, 0.6) + gauss(th, Math.PI * 1.5, 0.6)) * gauss(u, 0.872, u > 0.872 ? 0.03 : 0.05);
    return b;
  };
  const torsoXZ = (u, th, off) => {
    const P = torsoP(u);
    const s = Math.sin(th), c = Math.cos(th), ex = 2 / lerp(nTorso, 2.0, smoothstep(0.8, 1.0, u));
    let x = (P.hw + off) * Math.sign(s) * Math.pow(Math.abs(s), ex);
    let z = (c >= 0 ? P.fd + off : P.bd + off) * Math.sign(c) * Math.pow(Math.abs(c), ex);
    const bump = torsoBump(u, th);
    if (bump !== 0) { const r = Math.hypot(x, z) || 1; x *= 1 + bump / r; z *= 1 + bump / r; }
    // collar line slopes down toward the front (sternal notch lower than C7); only around the neck -
    // applied across the whole ring it used to drop the shoulder tops below the arms
    const tilt = 0.5 * clamp((u - 0.8) / 0.2, 0, 1) * (1 - 0.7 * smoothstep(0.3, 0.75, Math.abs(s)));
    const dy = tilt > 0 ? -tilt * (z + P.bd + off) : 0;
    return [x, P.cz + z, dy];
  };
  const torsoW = (u, th) => {
    const w = [];
    if (u < 0.22) w.push([B.hips, 1]);
    else if (u < 0.42) { const t = smoothstep(0.22, 0.42, u); w.push([B.hips, 1 - t], [B.spine, t]); }
    else if (u < 0.6) w.push([B.spine, 1]);
    else if (u < 0.74) { const t = smoothstep(0.6, 0.74, u); w.push([B.spine, 1 - t], [B.chest, t]); }
    else if (u < 0.95) w.push([B.chest, 1]);
    else { const t = smoothstep(0.95, 1.02, u) * 0.4; w.push([B.chest, 1 - t], [B.neck, t]); }
    const s = Math.sin(th);
    // thigh influence near the bottom
    const tb = (1 - smoothstep(0.02, 0.24, u)) * (0.22 + 0.4 * Math.abs(s));
    if (tb > 0.01) {
      w.push([B.thigh_L, tb * smoothstep(-0.45, 0.45, s)], [B.thigh_R, tb * smoothstep(0.45, -0.45, s)]);
      w[0][1] *= 1 - tb * 0.9;
    }
    // shoulder influence
    const shw = smoothstep(0.8, 0.95, u) * smoothstep(0.55, 0.98, Math.abs(s));
    if (shw > 0.01) {
      const side = s > 0 ? 0 : 1;
      w.push([SB('clavicle', side), 0.5 * shw], [SB('upperarm', side), 0.14 * shw]);
      w[0][1] *= 1 - 0.6 * shw;
    }
    return w;
  };
  const torsoReg = (u) => u < 0.27 ? REGION.PELVIS : u < 0.47 ? REGION.ABDOMEN : u < 0.66 ? REGION.TORSO : REGION.UPPER_CHEST;

  // --- clothing segments along u
  const thick = (tdef.thick || 0.006) * sc;
  const looseTop = (tdef.mat === 'knit' || tdef.mat === 'fleece' ? 0.012 : (tdef.mat === 'nylon' || tdef.mat === 'leather' ? 0.014 : 0.007)) * sc;
  const pantsOff = bot ? (0.0035 + 0.2 * bot.def.fit) * sc : 0;
  let waistband = bot ? (bot.type === 'sweatpants' || bot.type === 'leggings' ? 0.36 : 0.33) : 0.33;
  let hem;
  const untuckRoll = (hash32(app.seed, 91) % 100);
  if (isDress) hem = 0.38;
  else if (tdef.hem === 'tucked') hem = untuckRoll < 45 ? 0.15 : waistband;
  else if (tdef.hem === 'low') hem = 0.15;
  else if (tdef.hem === 'coat') hem = 0.20;
  else if (tdef.hem === 'hipband') hem = 0.16;
  else hem = 0.17;
  const tucked = hem >= waistband - 1e-3 && !isDress;
  const topOff = (u) => {
    let o = thick + looseTop * smoothstep(0.66, 0.36, u) * (1 - smoothstep(0.3, 0.15, u) * 0.3);
    if (u < 0.32 && !tucked) o += 0.009 * sc * smoothstep(0.32, hem, u); // drape at hem
    if (tdef.hem === 'hipband' && u < hem + 0.04) o -= 0.003 * sc * smoothstep(hem + 0.04, hem + 0.01, u);
    if (u > 0.9) o = lerp(o, thick * 0.8, smoothstep(0.9, 1.0, u));
    return o;
  };
  const hasBelt = bot && tucked && (bot.type === 'jeans' || bot.type === 'chinos' || bot.type === 'trousers');
  const beltLayer = { col: C(0x1d1714), col2: C(0x9a8a6a), mat: [MAT.LEATHER, 0.4, 0, 1], isSkin: false };
  const underLayer = { col: C(0x26262a), col2: C(0x26262a), mat: [MAT.COTTON, 0.9, 0, 1], isSkin: false }; // under skirts

  // Top garment features rendered in the shader (crisp V-necks, plackets, zippers)
  // pattern code = basePattern + 10 * feature; feature 1 = V opening (aMat.w = start height),
  // 2 = button placket, 3 = zipper, 4 = lapel V + buttons below
  let feat = 0;
  if (tdef.neck === 'v') feat = 1;
  else if (tdef.neck === 'lapel') feat = 4;
  else if (tdef.zipper) feat = 3;
  else if (tdef.buttons || top.type === 'polo') feat = 2;
  const vStartU = tdef.neck === 'lapel' ? (top.type === 'labcoat' ? 0.56 : 0.6) : 0.84;
  const vStartY = crotchY + vStartU * span;
  const fillCol = tdef.neck === 'lapel' ? (underColor || skin) : skin;
  const topTorso = Object.assign({}, topLayer);
  if (feat) {
    const basePat = topLayer.mat[2] === PAT.DOTS ? PAT.PLAIN : topLayer.mat[2];
    topTorso.mat = [topLayer.mat[0], topLayer.mat[1], basePat + 10 * feat, (feat === 1 || feat === 4) ? vStartY : 1];
    if (feat === 1 || feat === 4) topTorso.col2 = fillCol;
    else topTorso.col2 = tdef.zipper ? C(0x9a9a9e) : shadeColor(topLayer.col, 0.55);
  }
  // Build list of segments: {u0,u1,layer,off(u)}
  const segs = [];
  if (isDress || isSkirt) {
    segs.push({ u0: 0, u1: isDress ? hem : waistband, layer: underLayer, off: () => 0.003 * sc });
    if (isSkirt) segs.push({ u0: waistband, u1: 1, layer: topTorso, off: topOff, tucked: true });
    else segs.push({ u0: hem, u1: 1, layer: topTorso, off: topOff });
  } else if (bot) {
    if (tucked) {
      if (hasBelt) {
        segs.push({ u0: 0, u1: waistband - 0.035, layer: bottomLayer, off: () => pantsOff });
        segs.push({ u0: waistband - 0.035, u1: waistband, layer: beltLayer, off: () => pantsOff + 0.004 * sc });
      } else segs.push({ u0: 0, u1: waistband, layer: bottomLayer, off: () => pantsOff + 0.002 * sc });
      segs.push({ u0: waistband, u1: 1, layer: topTorso, off: topOff });
    } else {
      segs.push({ u0: 0, u1: hem, layer: bottomLayer, off: () => pantsOff });
      segs.push({ u0: hem, u1: 1, layer: topTorso, off: topOff });
    }
  } else {
    segs.push({ u0: 0, u1: 1, layer: topTorso, off: topOff });
  }

  // clothed torso surface (distance from the body axis along direction phi at height y), used to drape
  // long hair over the back and shoulders instead of through the clothes; 0 where there is no torso
  const hoodC = tdef.neck === 'hood' ? new V3(0, rig.neckBaseY - 0.03 * H, -0.062 * H) : null;
  rig.torsoSurf = (y, phi) => {
    const u = (y - crotchY) / span;
    if (u < 0.55 || u > 1.1) return 0;
    const uu = Math.min(1, u), th = ((phi % TAU) + TAU) % TAU;
    let off = 0;
    for (const sg of segs) if (uu >= sg.u0 - 1e-4 && uu <= sg.u1 + 1e-4) off = Math.max(off, sg.off(uu));
    if (u > 0.94 && (tdef.neck === 'collar' || tdef.neck === 'lapel')) off += 0.012 * sc * smoothstep(0.94, 1.0, u);
    const p = torsoXZ(uu, th, off);
    let r = Math.hypot(p[0], p[1]);
    if (u > 1) r *= 1 - (u - 1) * 2.5; // narrowing above the collar line
    if (hoodC) { // the hood lies on the upper back
      const rx = 0.068 * H, ry = 0.034 * H, rz = 0.03 * H, dy = (y - hoodC.y) / ry;
      if (Math.abs(dy) < 1) {
        const k = Math.sqrt(1 - dy * dy), sn = Math.sin(th), cs = Math.cos(th), hz = hoodC.z;
        const A = sn * sn / (rx * rx) + cs * cs / (rz * rz), Bq = -2 * cs * hz / (rz * rz), Cq = hz * hz / (rz * rz) - k * k;
        const disc = Bq * Bq - 4 * A * Cq;
        if (disc > 0) r = Math.max(r, (-Bq + Math.sqrt(disc)) / (2 * A) + 0.004 * sc);
      }
    }
    return r;
  };

  const torsoRings = [];
  const torsoStep = 0.05 * Q.ringStep;
  const baseUs = [];
  for (let u = 0; u <= 1.0001; u += torsoStep) baseUs.push(Math.min(1, u));
  baseUs.push(0.02, 0.6, 0.97, 0.99);
  const mkTorsoRing = (u, layer, off, strip) => {
    const y = crotchY + u * span;
    return {
      c: new V3(0, y, 0), e1: LEFT, e2: FWD, e3: UP,
      prof: (th) => torsoXZ(u, th, off),
      col: layer.col, mat: layer.mat, col2: layer.col2,
      wts: (th) => torsoW(u, th), reg: torsoReg(u), v: y, strip: !!strip
    };
  };
  for (let si = 0; si < segs.length; si++) {
    const sg = segs[si];
    const us = sortedUnique(baseUs.filter(u => u > sg.u0 + 1e-3 && u < sg.u1 - 1e-3).concat([sg.u0, sg.u1]));
    const isFirst = si === 0;
    if (!isFirst) {
      // transition from previous segment at sg.u0
      const prev = segs[si - 1];
      const rPrev = prev.off(sg.u0), rCur = sg.off(sg.u0);
      if (rPrev >= rCur) {
        // previous layer outer: its edge folds inward to our radius (belongs to prev)
        torsoRings.push(mkTorsoRing(sg.u0, prev.layer, rCur));
        torsoRings.push(mkTorsoRing(sg.u0, sg.layer, rCur, true));
      } else {
        // our layer outer: hem underside belongs to us
        torsoRings.push(mkTorsoRing(sg.u0, sg.layer, rPrev, true));
        torsoRings.push(mkTorsoRing(sg.u0 + 0.004, sg.layer, rCur));
      }
      us.shift();
    }
    for (const u of us) torsoRings.push(mkTorsoRing(u, sg.layer, sg.off(u)));
  }
  // collar fold-in at top (closes the gap around the neck)
  const lastSeg = segs[segs.length - 1];
  const collarIn = mkTorsoRing(1.0, lastSeg.layer, lastSeg.off(1.0) - 0.022 * H);
  collarIn.c = new V3(0, crotchY + span * 0.995, 0);
  torsoRings.push(collarIn);
  addLoft(mb, torsoRings, Q.torsoCols, {
    theta: (j) => -Math.PI + TAU * j / Q.torsoCols, uCenter: true,
    capStart: { offset: new V3(0, -0.012 * H, 0.0), reg: REGION.PELVIS }
  });

  // ---------------- SKIRT / DRESS / COAT TAILS ----------------
  const skirtSpec = isDress ? { u0: hem, len: 0.27 + (hash32(app.seed, 5) % 100) / 100 * 0.13, layer: topLayer }
    : isSkirt ? { u0: waistband, len: bot.def.skirtLen, layer: bottomLayer }
      : top.type === 'labcoat' ? { u0: 0.30, len: 0.30, layer: topLayer, slit: true }
        : tdef.hem === 'low' ? { u0: 0.24, len: 0.035, layer: topLayer, slit: true, slitHalf: 0.22 } : null;
  if (skirtSpec) buildSkirt(mb, app, rig, Q, skirtSpec, torsoXZ, torsoP, crotchY, span);

  // ---------------- COLLAR / HOOD ----------------
  if (tdef.neck === 'collar' || tdef.neck === 'lapel') buildCollar(mb, rig, Q, topLayer, tdef.neck === 'lapel', torsoXZ, crotchY, span, topOff(1.0));
  if (tdef.neck === 'hood') buildHood(mb, rig, Q, topLayer, top);

  // ---------------- ARMS ----------------
  for (let s = 0; s < 2; s++) buildArm(mb, app, rig, Q, s, topLayer, skinLayer, tdef);

  // ---------------- LEGS ----------------
  const coveredY = skirtSpec && (isDress || isSkirt) ? rig.hipJY - skirtSpec.len * H : null; // thighs hidden above this
  for (let s = 0; s < 2; s++) buildLeg(mb, app, rig, Q, s, bot, bottomLayer, legSkinLayer, app.shoes, coveredY);

  // ---------------- SHOES ----------------
  for (let s = 0; s < 2; s++) buildShoe(mb, app, rig, Q, s);
}

// ---------------------------------------------------------------------------------------
function buildSkirt(mb, app, rig, Q, spec, torsoXZ, torsoP, crotchY, span) {
  const H = rig.H, sc = H / 1.75;
  const yTop = crotchY + spec.u0 * span;
  const yHem = rig.hipJY - spec.len * H;
  const n = Math.max(6, Math.round(10 / Q.ringStep));
  const rings = [];
  const flare = (t) => 0.004 * sc + t * (spec.len < 0.1 ? 0.006 : (0.03 + 0.04 * spec.len)) * H;
  const baseOff = 0.008 * sc;
  const wFor = (th, t) => {
    const s = Math.sin(th);
    // the front/sides follow the thighs early (they push the fabric), the back hangs from the hips
    const down = smoothstep(-0.15, 0.6, t) * (0.8 + 0.2 * Math.max(0, Math.cos(th)));
    const tl = 0.92 * down * smoothstep(-0.5, 0.5, s), tr = 0.92 * down * smoothstep(0.5, -0.5, s);
    return [[B.hips, Math.max(0.05, 1 - tl - tr)], [B.thigh_L, tl], [B.thigh_R, tr]];
  };
  const regFor = (th, p, t) => t < 0.15 ? REGION.PELVIS : (p.x > 0 ? REGION.L_THIGH : REGION.R_THIGH);
  const slitHalf = spec.slit ? (spec.slitHalf || 0.14) : 0;
  // furthest extent of either thigh along direction (s, c) at height y (thighs modelled as ellipses)
  const bd = app.body, legK = Math.pow(bd.muscle, 0.7) * Math.pow(bd.limb, 0.6) * (1 + 0.08 * bd.fat) * (app.male ? 1 : 1.06);
  const thighEnv = (y, s, c) => {
    const fcan = clamp((rig.hipJY - y) / rig.thighLen * 0.49, -0.05, 0.45);
    const ea = sampleTable(LEG_CTRL, fcan, 1) * H * legK, eb = sampleTable(LEG_CTRL, fcan, 2) * H * legK;
    const ez = sampleTable(LEG_CTRL, fcan, 3) * H, ex = rig.hipHalf * lerp(0.8, 1.0, smoothstep(0.0, 0.28, fcan));
    let best = 0;
    for (const cx of [ex, -ex]) {
      const A = s * s / (ea * ea) + c * c / (eb * eb), Bq = -2 * (s * cx / (ea * ea) + c * ez / (eb * eb)), Cq = cx * cx / (ea * ea) + ez * ez / (eb * eb) - 1;
      const disc = Bq * Bq - 4 * A * Cq;
      if (disc > 0) best = Math.max(best, (-Bq + Math.sqrt(disc)) / (2 * A));
    }
    return best;
  };
  const ringAt = (t, off, strip, inner) => {
    const y = lerp(yTop, yHem, t);
    const uRef = clamp((y - crotchY) / span, 0.12, 1);
    const hipU = Math.max(uRef, 0.15);
    return {
      c: new V3(0, y, 0), e1: LEFT, e2: FWD,
      prof: (th) => {
        // take the max of body profile at this height and at hip level so the skirt hangs from the hips
        const a = torsoXZ(hipU, th, off + flare(t));
        // ...and never cuts into the thighs (they used to poke through the front of long skirts)
        if (y < rig.hipJY + 0.05 * rig.legLen) {
          const s = Math.sin(th), c = Math.cos(th), r = Math.hypot(a[0], a[1]) || 1e-4;
          const te = thighEnv(y, s, c) + off + 0.014 * sc + flare(t) * 0.5;
          if (te > r) { a[0] *= te / r; a[1] *= te / r; }
        }
        return a;
      },
      col: inner ? shadeColor(spec.layer.col, 0.7) : spec.layer.col, mat: spec.layer.mat, col2: spec.layer.col2,
      wts: (th) => wFor(th, t), reg: (th, p) => regFor(th, p, t), v: y, strip: !!strip
    };
  };
  for (let i = 0; i <= n; i++) rings.push(ringAt(i / n, baseOff, false, false));
  rings.push(ringAt(1.0, baseOff - 0.007 * sc, false, false));
  addLoft(mb, rings, Q.torsoCols, slitHalf ? { theta: skirtTheta(Q.torsoCols, slitHalf) } : {});
  // inner surface (visible from below), facing inward
  const inner = [];
  inner.push(ringAt(1.0, baseOff - 0.007 * sc, false, true));
  for (let i = n; i >= 0; i--) inner.push(ringAt(i / n, baseOff - 0.008 * sc, false, true));
  addLoft(mb, inner, Q.torsoCols, Object.assign({ inward: true }, slitHalf ? { theta: skirtTheta(Q.torsoCols, slitHalf) } : {}));
}
function skirtTheta(cols, slitHalf) {
  // columns spanning [slitHalf, TAU - slitHalf]; the last column wraps (closing seam) - we accept a narrow gap at front
  return (j) => slitHalf + (TAU - 2 * slitHalf) * (j / cols);
}

function buildCollar(mb, rig, Q, layer, lapel, torsoXZ, crotchY, span, baseOff) {
  const H = rig.H;
  const open = lapel ? 0.75 : 0.28; // front opening half-angle
  const ringAt = (dy, off, shrink, strip) => ({
    c: new V3(0, crotchY + span + dy, 0), e1: LEFT, e2: FWD, e3: UP,
    prof: (th) => { const p = torsoXZ(1.0, th, off); return [p[0] * shrink, p[1] * shrink, p[2]]; },
    col: layer.col, mat: layer.mat, col2: layer.col2,
    wts: [[B.chest, 0.55], [B.neck, 0.45]], reg: REGION.NECK, v: dy, strip: !!strip
  });
  const rings = [
    ringAt(-0.012 * H, baseOff + 0.0015 * H, 1.0),
    ringAt(0.006 * H, baseOff + 0.001 * H, 0.97),
    ringAt(0.015 * H, baseOff + 0.003 * H, 0.99),
    ringAt(0.006 * H, baseOff + 0.005 * H, 1.02),
    ringAt(-0.002 * H, baseOff + 0.003 * H, 1.01)
  ];
  addLoft(mb, rings, Q.torsoCols, { theta: (j) => open + (TAU - 2 * open) * (j / Q.torsoCols) });
}

function buildHood(mb, rig, Q, layer, top) {
  const H = rig.H;
  const c = new V3(0, rig.neckBaseY - 0.03 * H, -0.062 * H);
  const rx = 0.068 * H, ry = 0.034 * H, rz = 0.03 * H;
  const col = shadeColor(layer.col, 0.96);
  addSphereLike(mb, 10, 18, (th, ph) => new V3(c.x + Math.sin(ph) * Math.sin(th) * rx, c.y + Math.cos(ph) * ry, c.z + Math.sin(ph) * Math.cos(th) * rz),
    () => ({ col, mat: layer.mat, col2: layer.col2, wts: [[B.chest, 1]], reg: REGION.UPPER_CHEST }));
  // drawstrings
  for (let s = 0; s < 2; s++) {
    const x = SIDE_SIGN[s] * 0.018 * H;
    const p0 = new V3(x, rig.neckBaseY - 0.012 * H, 0.04 * H), p1 = new V3(x * 1.1, rig.neckBaseY - 0.1 * H, 0.062 * H);
    const rings = [];
    for (let i = 0; i <= 3; i++) {
      const t = i / 3; const p = new V3().lerpVectors(p0, p1, t);
      rings.push({
        c: p, e1: LEFT, e2: FWD, prof: (th) => [Math.sin(th) * 0.0035, Math.cos(th) * 0.0035],
        col: C(0xe8e6e0), mat: [MAT.COTTON, 0.9, 0, 1], col2: C(0xe8e6e0), wts: [[B.chest, 1]], reg: REGION.UPPER_CHEST, v: t
      });
    }
    addLoft(mb, rings, 5, { capEnd: { offset: new V3(0, -0.004, 0) } });
  }
}

// ---------------------------------------------------------------------------------------
function buildArm(mb, app, rig, Q, side, topLayer, skinLayer, tdef) {
  const H = rig.H, bd = app.body, sc = H / 1.75;
  const sg = SIDE_SIGN[side];
  const d = rig.armDir[side], e1 = rig.armE1[side], e2 = rig.armE2[side];
  const sh = rig.bindPos[SB('upperarm', side)];
  const upL = rig.upperArmLen, foL = rig.forearmLen, paL = rig.palmLen;
  const mapDist = (x) => {
    if (x <= 0.186) return x / 0.186 * upL;
    if (x <= 0.332) return upL + (x - 0.186) / 0.146 * foL;
    return upL + foL + (x - 0.332) / 0.058 * paL;
  };
  const muscle = Math.pow(bd.muscle, 0.85) * (app.male ? 1 : 0.9) * (1 + 0.07 * bd.fat);
  const radK = (x) => x < 0.332 ? muscle * Math.pow(bd.limb, 0.5) : (app.male ? 1 : 0.92);
  const prof = (x, off) => {
    const a = sampleTable(ARM_CTRL, x, 1) * H * radK(x) + off;
    const b = sampleTable(ARM_CTRL, x, 2) * H * radK(x) + off;
    return (th) => [Math.cos(th) * a, Math.sin(th) * b];
  };
  const wAt = (x, th) => {
    const elbow = 0.186, wrist = 0.332;
    // the shoulder cap follows the clavicle more than the arm - most of all over the top/outside
    // (th = -90 deg) - so it doesn't swing up over the shoulder line when the arm hangs down
    if (x < 0.07) {
      const outer = th == null ? 0 : smoothstep(0.3, -0.9, Math.sin(th)) * 0.32 * (1 - smoothstep(0.0, 0.07, x));
      const c = Math.min(0.75, 0.55 * (1 - smoothstep(-0.021, 0.05, x)) + outer);
      return [[SB('clavicle', side), c], [SB('upperarm', side), 1 - c]];
    }
    if (x < elbow - 0.018) return [[SB('upperarm', side), 1]];
    if (x < elbow + 0.016) { const t = smoothstep(elbow - 0.018, elbow + 0.016, x); return [[SB('upperarm', side), 1 - t], [SB('forearm', side), t]]; }
    if (x < wrist - 0.012) return [[SB('forearm', side), 1]];
    if (x < wrist + 0.01) { const t = smoothstep(wrist - 0.012, wrist + 0.01, x); return [[SB('forearm', side), 1 - t], [SB('hand', side), t]]; }
    return [[SB('hand', side), 1]];
  };
  const regAt = (x) => x < 0.186 ? sideRegion('UPPER_ARM', side) : x < 0.332 ? sideRegion('FOREARM', side) : sideRegion('HAND', side);
  // sleeve
  const sleeveEnd = tdef.sleeve === 'long' ? 0.322 : (tdef.sleeve === 'short' ? 0.085 : -0.02);
  const sleeveThick = (tdef.thick || 0.006) * sc;
  const sleeveLoose = (tdef.mat === 'knit' || tdef.mat === 'fleece' || tdef.mat === 'nylon' || tdef.mat === 'leather' ? 0.006 : 0.003) * sc;
  const capK = (x) => 0.45 + 0.55 * smoothstep(-0.021, 0.03, x); // fabric lies flat over the shoulder cap
  const sleeveOff = (x) => {
    if (tdef.sleeve === 'short') return (sleeveThick + sleeveLoose) * capK(x) + 0.005 * sc * smoothstep(0.0, sleeveEnd, x);
    let o = (sleeveThick + sleeveLoose * (0.6 + 0.8 * smoothstep(0.15, 0.28, x))) * capK(x);
    if (tdef.cuffs && x > sleeveEnd - 0.022) o = sleeveThick * 0.8;
    return o;
  };
  const xs = [];
  for (const row of ARM_CTRL) xs.push(row[0]);
  for (let x = 0.0; x < 0.388; x += 0.02 * Q.ringStep) xs.push(x);
  xs.push(sleeveEnd, 0.186 - 0.012, 0.186 + 0.012);
  const allX = sortedUnique(xs.filter(x => x >= -0.021 && x <= 0.388));
  const rings = [];
  const mk = (x, layer, off, strip) => {
    const dist = mapDist(x);
    const c = sh.clone().addScaledVector(d, dist);
    const p = prof(x, off);
    let col = layer.col;
    if (layer.isSkin && x > 0.37) col = skinColorAt(layer.col, 0.5, 0.02);
    else if (layer.isSkin && x > 0.17 && x < 0.2) col = skinColorAt(layer.col, 0.25, 0.0);
    return { c, e1, e2, prof: p, col, mat: layer.mat, col2: layer.col2, wts: x < 0.07 ? (th) => wAt(x, th) : wAt(x), reg: regAt(x), v: dist, strip: !!strip };
  };
  const hasSleeve = sleeveEnd > 0;
  for (const x of allX) {
    if (hasSleeve && x <= sleeveEnd) {
      rings.push(mk(x, topLayer, sleeveOff(x)));
      if (Math.abs(x - sleeveEnd) < 1e-6) {
        // hem: fold to skin radius, then start skin strip
        rings.push(mk(x, topLayer, 0));
        rings.push(mk(x, skinLayer, 0, true));
      }
    } else rings.push(mk(x, skinLayer, 0));
  }
  addLoft(mb, rings, Q.limbCols, { capStart: { offset: d.clone().multiplyScalar(-0.003 * H) }, capEnd: { offset: d.clone().multiplyScalar(0.004 * H) } });

  // fingers
  const kn = rig.bindPos[SB('fingers1', side)];
  const fingerSpec = [ // offset along e1 (H), length (H), radius (H), spread
    [0.0138, 0.0435, 0.0050, 0.06], [0.0046, 0.0480, 0.0052, 0.015], [-0.0046, 0.0455, 0.0049, -0.03], [-0.0135, 0.0365, 0.0043, -0.09]
  ];
  const fk = app.male ? 1.0 : 0.9;
  const skinHand = skinColorAt(skinLayer.col, 0.35, 0.0);
  for (const fs of fingerSpec) {
    const base = kn.clone().addScaledVector(e1, fs[0] * H).addScaledVector(d, -0.004 * H);
    const dir = d.clone().addScaledVector(e1, fs[3]).normalize();
    const L = fs[1] * H * rig.handLen / (0.106 * H);
    const r0 = fs[2] * H * fk;
    const fr = [];
    const n = 5;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const c = base.clone().addScaledVector(dir, t * L);
      const r = r0 * (1 - 0.28 * t) * (i === 0 ? 1.05 : 1);
      const w = t < 0.12 ? [[SB('hand', side), 0.6], [SB('fingers1', side), 0.4]] : t < 0.45 ? [[SB('fingers1', side), 1]]
        : t < 0.6 ? [[SB('fingers1', side), 0.5], [SB('fingers2', side), 0.5]] : [[SB('fingers2', side), 1]];
      fr.push({ c, e1, e2, prof: (th) => [Math.cos(th) * r, Math.sin(th) * r * 0.9], col: i >= n - 1 ? skinColorAt(skinLayer.col, 0.7, 0) : skinHand, mat: skinLayer.mat, col2: skinLayer.col2, wts: w, reg: sideRegion('HAND', side), v: t * L });
    }
    addLoft(mb, fr, Q.fingerCols, { capEnd: { offset: dir.clone().multiplyScalar(r0 * 0.7) } });
  }
  // thumb
  const tb = rig.bindPos[SB('thumb', side)];
  const tdir = d.clone().multiplyScalar(0.62).addScaledVector(e1, 0.70).addScaledVector(e2, 0.32).normalize();
  const tL = 0.042 * H * fk, tr0 = 0.0068 * H * fk;
  const tr = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    const c = tb.clone().addScaledVector(tdir, (t - 0.12) * tL);
    const r = tr0 * (1 - 0.32 * t);
    const w = t < 0.2 ? [[SB('hand', side), 0.6], [SB('thumb', side), 0.4]] : [[SB('thumb', side), 1]];
    const te1 = new V3().crossVectors(tdir, e2).normalize();
    tr.push({ c, e1: te1, e2, prof: (th) => [Math.cos(th) * r, Math.sin(th) * r * 0.85], col: skinHand, mat: skinLayer.mat, col2: skinLayer.col2, wts: w, reg: sideRegion('HAND', side), v: t * tL });
  }
  addLoft(mb, tr, Q.fingerCols, { capEnd: { offset: tdir.clone().multiplyScalar(tr0 * 0.6) } });
}

// ---------------------------------------------------------------------------------------
function buildLeg(mb, app, rig, Q, side, bot, bottomLayer, skinLayer, shoes, coveredY) {
  const H = rig.H, bd = app.body, sc = H / 1.75;
  const sg = SIDE_SIGN[side];
  const x0 = sg * rig.hipHalf;
  const fKnee = rig.thighLen / rig.legLen;
  const yAt = (f) => f <= fKnee ? rig.hipJY - (f / fKnee) * rig.thighLen
    : rig.kneeY - ((f - fKnee) / (1 - fKnee)) * rig.shinLen;
  const fc = (f) => f < 0.49 ? f / 0.49 * fKnee : fKnee + (f - 0.49) / 0.51 * (1 - fKnee); // canonical -> actual
  const muscle = Math.pow(bd.muscle, 0.7) * Math.pow(bd.limb, 0.6) * (1 + 0.08 * bd.fat);
  const femK = (f) => app.male ? 1 : (f < 0.35 ? 1.06 : (f < 0.49 ? 1.0 : 0.95));
  // under a skirt/dress the (hidden) upper thighs are slimmed a little so they never poke through the fabric
  const hiddenK = (fcan) => {
    if (coveredY == null) return 1;
    const y = yAt(fc(Math.max(0, fcan)));
    return 1 - 0.3 * smoothstep(coveredY + 0.02 * H, coveredY + 0.08 * H, y);
  };
  const profAt = (fcan, off) => {
    const k = muscle * femK(fcan) * hiddenK(fcan);
    const a = sampleTable(LEG_CTRL, fcan, 1) * H * k + off;
    const b = sampleTable(LEG_CTRL, fcan, 2) * H * k + off;
    const cz = sampleTable(LEG_CTRL, fcan, 3) * H;
    return (th) => [Math.sin(th) * a, cz + Math.cos(th) * b];
  };
  const wAt = (fcan) => {
    if (fcan < 0.02) { const t = smoothstep(-0.05, 0.03, fcan); return [[B.hips, 0.5 * (1 - t)], [SB('thigh', side), 0.5 + 0.5 * t]]; }
    if (fcan < 0.45) return [[SB('thigh', side), 1]];
    if (fcan < 0.54) { const t = smoothstep(0.45, 0.54, fcan); return [[SB('thigh', side), 1 - t], [SB('shin', side), t]]; }
    if (fcan < 0.93) return [[SB('shin', side), 1]];
    { const t = smoothstep(0.93, 1.02, fcan); return [[SB('shin', side), 1 - t], [SB('foot', side), t]]; }
  };
  const regAt = (fcan) => fcan < 0.49 ? sideRegion('THIGH', side) : (fcan < 0.98 ? sideRegion('LOWER_LEG', side) : sideRegion('FOOT', side));
  // pants
  const hasPants = bot && bot.def.len !== 'skirt';
  const pantsEnd = !hasPants ? -1 : (bot.def.len === 'short' ? 0.36 : 0.955);
  const fit = hasPants ? bot.def.fit * sc : 0;
  const kneeR = sampleTable(LEG_CTRL, 0.49, 1) * H * muscle;
  const pantsOff = (fcan) => {
    if (!hasPants) return 0;
    let o = 0.0035 * sc + fit * (0.25 + 0.75 * smoothstep(0.0, 0.5, fcan));
    if (fcan > 0.5 && bot.type !== 'leggings') {
      const body = sampleTable(LEG_CTRL, fcan, 1) * H * muscle;
      const straight = kneeR + fit * 0.8 - body;
      const k = bot.type === 'jeans' ? 0.55 : 0.85;
      o = Math.max(o, lerp(o, straight, k));
    }
    if (bot.def.cuffed && fcan > pantsEnd - 0.04) o = 0.004 * sc;
    if (bot.def.len === 'short') o += 0.008 * sc * smoothstep(0.1, pantsEnd, fcan);
    return o;
  };
  const sockCol = C(shoes.sock);
  const showSocks = (!hasPants || bot.def.len === 'short') && (shoes.type === 'sneakers' || shoes.type === 'runners' || shoes.type === 'hightops');
  const fs = [];
  for (const row of LEG_CTRL) fs.push(row[0]);
  for (let f = -0.05; f < 1.06; f += 0.05 * Q.ringStep) fs.push(f);
  if (hasPants) fs.push(pantsEnd);
  fs.push(0.86, 0.9);
  const all = sortedUnique(fs.filter(f => f >= -0.05 && f <= 1.06));
  const rings = [];
  const mk = (fcan, layer, off, strip) => {
    const y = yAt(fc(Math.max(0, fcan))) + (fcan < 0 ? -fcan * rig.legLen * 1.0 : 0);
    let col = layer.col, mat = layer.mat;
    if (layer.isSkin && showSocks && fcan > 0.87) { col = sockCol; mat = [MAT.KNIT, 0.95, 7, 1]; }
    else if (layer.isSkin && fcan > 0.46 && fcan < 0.53) col = skinColorAt(layer.col, 0.2, 0);
    const inward = lerp(0.8, 1.0, smoothstep(0.0, 0.28, fcan));
    return { c: new V3(x0 * inward, y, 0), e1: LEFT, e2: FWD, prof: profAt(fcan, off), col, mat, col2: layer.col2, wts: wAt(fcan), reg: regAt(fcan), v: y, strip: !!strip };
  };
  for (const f of all) {
    if (hasPants && f <= pantsEnd + 1e-6) {
      rings.push(mk(f, bottomLayer, pantsOff(f)));
      if (Math.abs(f - pantsEnd) < 1e-6) {
        rings.push(mk(f, bottomLayer, 0.001));
        rings.push(mk(f, skinLayer, 0, true));
      }
    } else rings.push(mk(f, skinLayer, 0));
  }
  addLoft(mb, rings, Q.limbCols, { capEnd: { offset: new V3(0, -0.01 * H, 0.01 * H) } });
}

// ---------------------------------------------------------------------------------------
function buildShoe(mb, app, rig, Q, side) {
  const H = rig.H, sc = H / 1.75;
  const sd = app.shoes.def;
  const sg = SIDE_SIGN[side];
  const ank = rig.bindPos[SB('foot', side)];
  const L = rig.footLen * 1.07;
  const zHeel = -0.26 * L, zToe = 0.74 * L;
  const width = 0.058 * H * (app.male ? 1 : 0.92);
  const sole = rig.sole;
  const upperCol = C(app.shoes.color), soleCol = C(app.shoes.sole);
  const f = FABRIC[sd.mat] || FABRIC.leather;
  const upperMat = [f.type, f.rough, 0, 1];
  const soleMat = [MAT.RUBBER, 0.8, 0, 1];
  const heightAt = (t) => { // t 0 heel..1 toe -> top height above floor
    const collar = sd.height * sc, toe = sd.toe * sc;
    if (t < 0.32) return lerp(collar, collar * 0.92, t / 0.32);
    if (t < 0.62) return lerp(collar * 0.92, toe * 1.12, smoothstep(0.32, 0.62, t));
    if (t < 0.88) return lerp(toe * 1.12, toe, (t - 0.62) / 0.26);
    return toe * (1 - 0.55 * smoothstep(0.88, 1.0, t));
  };
  const widthAt = (t) => {
    let w;
    if (t < 0.15) w = lerp(0.62, 0.72, t / 0.15);
    else if (t < 0.7) w = lerp(0.72, 1.0, smoothstep(0.15, 0.7, t));
    else w = lerp(1.0, sd.pointy ? 0.45 : 0.72, smoothstep(0.7, 1.0, t));
    return w * width * 0.5;
  };
  const xOff = (t) => sg * (0.0 + 0.006 * H * smoothstep(0.4, 1.0, t)) * -1; // toes slightly toward inside
  const n = Math.round(14 / Math.max(0.8, Q.ringStep));
  const ring = (t, isSole, strip, edge) => {
    const z = ank.z + lerp(zHeel, zToe, t);
    const wv = widthAt(t) + (isSole ? 0.0025 * sc : 0);
    const yb = isSole ? 0 : sole * 0.65;
    const yt = isSole ? sole : heightAt(t);
    const yc = (yb + yt) * 0.5, hh = (yt - yb) * 0.5;
    const cx = ank.x + xOff(t);
    return {
      c: new V3(cx, yc, z), e1: LEFT, e2: UP,
      prof: (th) => {
        // th: 0 = +X side... use superellipse in (x,y)
        const c = Math.cos(th), s = Math.sin(th);
        const ex = isSole ? 0.25 : 0.62;
        let x = wv * Math.sign(c) * Math.pow(Math.abs(c), ex);
        let y = hh * Math.sign(s) * Math.pow(Math.abs(s), isSole ? 0.2 : (s > 0 ? 0.9 : 0.35));
        if (edge) { x *= edge; y *= edge; }
        return [x, y];
      },
      col: isSole ? soleCol : upperCol, mat: isSole ? soleMat : upperMat, col2: upperCol,
      wts: [[SB('foot', side), 1]], reg: sideRegion('FOOT', side), v: z, strip: !!strip
    };
  };
  for (const isSole of [true, false]) {
    const rings = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      rings.push(ring(t, isSole));
    }
    addLoft(mb, rings, isSole ? 14 : 16, {
      capStart: { offset: new V3(0, 0, -0.008 * H) }, capEnd: { offset: new V3(0, isSole ? 0 : -0.004 * H, 0.012 * H) }
    });
  }
}
