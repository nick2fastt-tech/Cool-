// ============================================================================
// MeshBuilder: accumulates skinned, vertex-colored geometry with material ids
// aMat = (materialType, roughness, patternCode, patternScale)
// ============================================================================
const MAT = {
  SKIN: 0, COTTON: 1, DENIM: 2, KNIT: 3, LEATHER: 4, RUBBER: 5, HAIR: 6, EYE: 7, LIPS: 8, NYLON: 9,
  MOUTH: 10, METAL: 11, BROW: 12, TEETH: 13, CANVAS: 14
};
const PAT = { PLAIN: 0, STRIPES: 1, PLAID: 2, HEATHER: 3, PINSTRIPE: 4, DOTS: 5, FLORAL: 6, RIB: 7 };
const PATTERN_IDS = { plain: 0, stripes: 1, plaid: 2, heather: 3, pinstripe: 4, dots: 5, floral: 6, knit: 7 };

class MeshBuilder {
  constructor() {
    this.P = []; this.UV = []; this.C = []; this.MT = []; this.C2 = []; this.SI = []; this.SW = []; this.RG = [];
    this.I = []; this.n = 0;
    this.weld = [];        // vertex -> canonical vertex for normal smoothing
    this.partV = 0; this.partI = 0;
    this.normals = null;
  }
  v(x, y, z, u, vv, col, mat, col2, wts, region) {
    this.P.push(x, y, z); this.UV.push(u, vv);
    this.C.push(col.r, col.g, col.b);
    this.MT.push(mat[0], mat[1], mat[2], mat[3]);
    const c2 = col2 || col; this.C2.push(c2.r, c2.g, c2.b);
    // weights: array of [bone, w]
    let w = wts;
    if (w.length > 1) {
      let dup = w.length > 4;
      for (let i = 0; i < w.length && !dup; i++) for (let j = i + 1; j < w.length; j++) if (w[i][0] === w[j][0]) { dup = true; break; }
      if (dup) {
        const m = {};
        for (const e of w) { if (e[1] > 1e-4) m[e[0]] = (m[e[0]] || 0) + e[1]; }
        w = Object.keys(m).map(k => [k | 0, m[k]]).sort((a, b) => b[1] - a[1]).slice(0, 4);
      }
    }
    let tot = 0; for (const e of w) tot += e[1];
    if (tot <= 1e-6) { w = [[B.hips, 1]]; tot = 1; }
    for (let i = 0; i < 4; i++) {
      if (i < w.length) { this.SI.push(w[i][0]); this.SW.push(w[i][1] / tot); }
      else { this.SI.push(0); this.SW.push(0); }
    }
    this.RG.push(region);
    this.weld.push(this.n);
    return this.n++;
  }
  tri(a, b, c) { this.I.push(a, b, c); }
  quad(a, b, c, d) { this.I.push(a, b, c, a, c, d); }
  beginPart() { this.partV = this.n; this.partI = this.I.length; }
  // Smooth normals for the current part (welded vertices share normals)
  endPart() {
    if (!this.normals) this.normals = [];
    const N = this.normals, P = this.P, I = this.I, W = this.weld;
    for (let i = this.partV; i < this.n; i++) { N[i * 3] = 0; N[i * 3 + 1] = 0; N[i * 3 + 2] = 0; }
    for (let k = this.partI; k < I.length; k += 3) {
      const a = I[k], b = I[k + 1], c = I[k + 2];
      const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
      const e1x = P[b * 3] - ax, e1y = P[b * 3 + 1] - ay, e1z = P[b * 3 + 2] - az;
      const e2x = P[c * 3] - ax, e2y = P[c * 3 + 1] - ay, e2z = P[c * 3 + 2] - az;
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      for (const v of [W[a], W[b], W[c]]) { N[v * 3] += nx; N[v * 3 + 1] += ny; N[v * 3 + 2] += nz; }
    }
    for (let i = this.partV; i < this.n; i++) {
      const w = W[i];
      if (w !== i) { N[i * 3] = N[w * 3]; N[i * 3 + 1] = N[w * 3 + 1]; N[i * 3 + 2] = N[w * 3 + 2]; }
    }
    for (let i = this.partV; i < this.n; i++) {
      const x = N[i * 3], y = N[i * 3 + 1], z = N[i * 3 + 2];
      const l = Math.hypot(x, y, z) || 1;
      N[i * 3] = x / l; N[i * 3 + 1] = y / l; N[i * 3 + 2] = z / l;
    }
  }
  // flip winding of triangles in current part
  flipPart(fromI) {
    const I = this.I;
    for (let k = fromI; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals || new Array(this.P.length).fill(0), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.UV, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.MT, 4));
    g.setAttribute('aColor2', new THREE.Float32BufferAttribute(this.C2, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4));
    g.setAttribute('aRegion', new THREE.Float32BufferAttribute(this.RG, 1));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ----------------------------------------------------------------------------
// Loft: rings of points around an axis. Each ring:
//  { c:V3, e1:V3, e2:V3, prof:(th)=>[a,b], col:Color|fn(th), mat:arr|fn(th), col2:Color|fn,
//    wts:arr|fn(th,p), reg:int|fn(th,p), v:number, strip:bool (start new strip: no faces to previous ring) }
// Point = c + e1*a + e2*b.  Columns: angle th in [0, 2PI).
// ----------------------------------------------------------------------------
const _lp = new V3(), _lc = new V3();
function addLoft(mb, rings, cols, opts = {}) {
  mb.beginPart();
  const startI = mb.I.length;
  const ringBase = [];
  const thetaOf = opts.theta || (j => (j / cols) * TAU);
  const pts = new Array(cols + 1), ths = new Array(cols + 1), arc = new Array(cols + 1);
  for (let j = 0; j <= cols; j++) { pts[j] = new V3(); }
  for (let i = 0; i < rings.length; i++) {
    const R = rings[i];
    const base = mb.n;
    // pass 1: positions + arc length
    for (let j = 0; j <= cols; j++) {
      const th = j === cols ? thetaOf(0) + TAU : thetaOf(j);
      ths[j] = th;
      const ab = R.prof(((th % TAU) + TAU) % TAU);
      pts[j].copy(R.c).addScaledVector(R.e1, ab[0]).addScaledVector(R.e2, ab[1]);
      if (ab.length > 2 && R.e3) pts[j].addScaledVector(R.e3, ab[2]);
      arc[j] = j === 0 ? 0 : arc[j - 1] + pts[j].distanceTo(pts[j - 1]);
    }
    let u0 = opts.uOffset || 0;
    if (opts.uCenter) { // u = signed arc length from the column at theta = 0 (front)
      let bj = 0, bd = 1e9;
      for (let j = 0; j < cols; j++) { const d = Math.abs(wrapAngle(ths[j])); if (d < bd) { bd = d; bj = j; } }
      u0 -= arc[bj];
    }
    // pass 2: emit
    for (let j = 0; j <= cols; j++) {
      const p = pts[j];
      const thn = ((ths[j] % TAU) + TAU) % TAU;
      const col = typeof R.col === 'function' ? R.col(thn, p) : R.col;
      const mat = typeof R.mat === 'function' ? R.mat(thn, p) : R.mat;
      const col2 = typeof R.col2 === 'function' ? R.col2(thn, p) : R.col2;
      const wts = typeof R.wts === 'function' ? R.wts(thn, p) : R.wts;
      const reg = typeof R.reg === 'function' ? R.reg(thn, p) : R.reg;
      mb.v(p.x, p.y, p.z, u0 + arc[j], R.v, col, mat, col2, wts, reg);
    }
    // weld seam
    mb.weld[base + cols] = base;
    ringBase.push(base);
  }
  // faces (+ orientation vote: face normal vs radial direction)
  let vote = 0;
  const P = mb.P;
  const vr = opts.voteRange;
  for (let i = 0; i < rings.length - 1; i++) {
    if (rings[i + 1].strip) continue;
    const a0 = ringBase[i], b0 = ringBase[i + 1];
    const rc = rings[i].c;
    for (let j = 0; j < cols; j++) {
      const a = a0 + j, b = a0 + j + 1, c = b0 + j + 1, d = b0 + j;
      mb.quad(a, b, c, d);
      if (vr && (j < vr[0] || j >= vr[1])) continue;
      for (const [p0, p1, p2] of [[a, b, c], [a, c, d]]) {
        const ax = P[p0 * 3], ay = P[p0 * 3 + 1], az = P[p0 * 3 + 2];
        const nx = (P[p1 * 3 + 1] - ay) * (P[p2 * 3 + 2] - az) - (P[p1 * 3 + 2] - az) * (P[p2 * 3 + 1] - ay);
        const ny = (P[p1 * 3 + 2] - az) * (P[p2 * 3] - ax) - (P[p1 * 3] - ax) * (P[p2 * 3 + 2] - az);
        const nz = (P[p1 * 3] - ax) * (P[p2 * 3 + 1] - ay) - (P[p1 * 3 + 1] - ay) * (P[p2 * 3] - ax);
        const dd = nx * (ax - rc.x) + ny * (ay - rc.y) + nz * (az - rc.z);
        vote += dd > 0 ? 1 : (dd < 0 ? -1 : 0);
      }
    }
  }
  // caps
  if (opts.capStart) addCap(mb, rings[0], ringBase[0], cols, opts.capStart, false);
  if (opts.capEnd) addCap(mb, rings[rings.length - 1], ringBase[rings.length - 1], cols, opts.capEnd, true);
  if (vote === 0 && opts.capEnd) vote = 1;
  let flip = vote < 0;
  if (opts.inward) flip = !flip;
  if (flip) mb.flipPart(startI);
  mb.endPart();
  return ringBase;
}
function findRing(ringBase, vi) {
  let lo = 0, hi = ringBase.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ringBase[mid] <= vi) lo = mid; else hi = mid - 1; }
  return lo;
}
function addCap(mb, R, base, cols, capOpt, isEnd) {
  // capOpt: { offset: V3 (tip offset from ring center), col, mat, col2, wts, reg }
  const tip = _lc.copy(R.c).add(capOpt.offset || new V3());
  const col = capOpt.col || (typeof R.col === 'function' ? R.col(0, tip) : R.col);
  const mat = capOpt.mat || (typeof R.mat === 'function' ? R.mat(0, tip) : R.mat);
  const col2 = capOpt.col2 || (typeof R.col2 === 'function' ? R.col2(0, tip) : R.col2);
  const wts = capOpt.wts || (typeof R.wts === 'function' ? R.wts(0, tip) : R.wts);
  const reg = capOpt.reg != null ? capOpt.reg : (typeof R.reg === 'function' ? R.reg(0, tip) : R.reg);
  const t = mb.v(tip.x, tip.y, tip.z, 0, R.v + (capOpt.vOff || 0.01), col, mat, col2, wts, reg);
  for (let j = 0; j < cols; j++) {
    if (isEnd) mb.tri(base + j, base + j + 1, t); else mb.tri(base + j + 1, base + j, t);
  }
}

// Ellipsoid / generic small mesh helpers (UV sphere) ---------------------------------
// fnPoint(theta, phi) -> V3 (absolute); attrs(theta, phi, p) -> {col, mat, col2, wts, reg}
function addSphereLike(mb, rows, cols, fnPoint, attrs, opts = {}) {
  mb.beginPart();
  const startI = mb.I.length;
  const base = mb.n;
  for (let i = 0; i <= rows; i++) {
    const phi = (opts.phi0 || 0) + ((opts.phi1 != null ? opts.phi1 : Math.PI) - (opts.phi0 || 0)) * (i / rows);
    for (let j = 0; j <= cols; j++) {
      const th = (j / cols) * TAU;
      const p = fnPoint(th % TAU, phi);
      const a = attrs(th % TAU, phi, p);
      mb.v(p.x, p.y, p.z, a.u != null ? a.u : j / cols, a.v != null ? a.v : i / rows, a.col, a.mat, a.col2, a.wts, a.reg);
      if (j === cols) mb.weld[mb.n - 1] = mb.n - 1 - cols;
    }
  }
  // weld poles
  if ((opts.phi0 || 0) === 0) for (let j = 1; j <= cols; j++) mb.weld[base + j] = base;
  if ((opts.phi1 == null || opts.phi1 === Math.PI)) { const lb = base + rows * (cols + 1); for (let j = 1; j <= cols; j++) mb.weld[lb + j] = lb; }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = base + i * (cols + 1) + j, b = a + 1, c = a + cols + 2, d = a + cols + 1;
      mb.quad(a, d, c, b);
    }
  }
  if (opts.flip) mb.flipPart(startI);
  mb.endPart();
}
