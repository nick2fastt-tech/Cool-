// ============================================================================
// First-person arms and hands (V1.12)
// Each hand is one skinned mesh: a palm with thenar and knuckle shapes, four fingers of three
// joints and a thumb, with nails. The forearm and upper arm are solved every frame from a fixed
// shoulder point beside and below the eye to the wrist (two-bone IK), so a hand can never float
// away from its arm and an arm never passes through the camera. Skin tone and sleeves come from
// the player's own appearance (the same generator as everyone else), so the arms match the body.
// Hand frame: -z = where straight fingers point, +y = back of the hand, +x = little-finger side
// (mirrored for the left hand). Flexion of a joint is a rotation about its local x axis.
// ============================================================================
const FP_FINGERS = [
  { x: -0.026, y: -0.003, z: -0.068, L: [0.041, 0.025, 0.020], r: [0.0094, 0.0086, 0.0078], yaw: -0.05 },
  { x: -0.008, y: -0.002, z: -0.072, L: [0.046, 0.029, 0.021], r: [0.0097, 0.0089, 0.0080], yaw: 0.0 },
  { x: 0.010, y: -0.003, z: -0.069, L: [0.043, 0.027, 0.020], r: [0.0092, 0.0084, 0.0076], yaw: 0.05 },
  { x: 0.026, y: -0.005, z: -0.061, L: [0.033, 0.020, 0.018], r: [0.0080, 0.0073, 0.0067], yaw: 0.12 }
];
const FP_THUMB = { base: [-0.021, -0.011, -0.004], dir: [-0.5, -0.32, -0.8], up: [-0.55, 0.75, 0.1], L: [0.038, 0.031, 0.027], r: [0.0128, 0.0108, 0.0098] };
// poses: curl per finger [mcp, pip, dip] (rad), spread, thumb [opposition, mcp, ip], wrist [flex, deviation]
const FP_POSES = {
  relaxed: { f: [[0.25, 0.3, 0.18], [0.3, 0.35, 0.2], [0.35, 0.4, 0.22], [0.42, 0.45, 0.25]], spread: 0.06, t: [0.35, 0.15, 0.12] },
  open: { f: [[0.08, 0.06, 0.04], [0.08, 0.06, 0.04], [0.1, 0.08, 0.05], [0.12, 0.1, 0.06]], spread: 0.16, t: [0.1, 0.05, 0.05] },
  fist: { f: [[1.35, 1.6, 0.95], [1.38, 1.62, 0.95], [1.4, 1.62, 0.95], [1.42, 1.6, 0.9]], spread: 0, t: [0.95, 0.55, 0.45] },
  grip: { f: [[0.6, 0.75, 0.42], [1.25, 1.5, 0.8], [1.3, 1.52, 0.8], [1.35, 1.5, 0.75]], spread: 0.02, t: [0.55, 0.22, 0.12] },
  gripSnug: { f: [[0.62, 0.82, 0.45], [1.3, 1.56, 0.85], [1.34, 1.56, 0.85], [1.38, 1.55, 0.8]], spread: 0, t: [0.6, 0.3, 0.2] },
  support: { f: [[0.95, 1.05, 0.55], [1.0, 1.1, 0.6], [1.05, 1.12, 0.6], [1.1, 1.1, 0.55]], spread: 0.02, t: [0.25, 0.08, 0.05] },
  cradle: { f: [[0.7, 0.85, 0.45], [0.75, 0.9, 0.5], [0.8, 0.95, 0.5], [0.85, 0.95, 0.5]], spread: 0.04, t: [0.45, 0.2, 0.1] },
  ball: { f: [[0.65, 0.75, 0.45], [0.7, 0.8, 0.5], [0.75, 0.85, 0.5], [0.85, 0.9, 0.5]], spread: 0.1, t: [0.75, 0.35, 0.25] },
  point: { f: [[0.05, 0.05, 0.03], [1.3, 1.5, 0.85], [1.35, 1.52, 0.85], [1.4, 1.5, 0.8]], spread: 0.03, t: [0.7, 0.4, 0.3] },
  pinch: { f: [[0.7, 0.75, 0.5], [0.95, 1.2, 0.65], [1.2, 1.4, 0.7], [1.3, 1.4, 0.7]], spread: 0.03, t: [0.95, 0.4, 0.35] },
  claw: { f: [[0.5, 0.95, 0.6], [0.5, 0.95, 0.6], [0.55, 0.95, 0.6], [0.6, 0.9, 0.55]], spread: 0.12, t: [0.6, 0.35, 0.3] }
};
// the player: a fixed person of their own (kept in the settings, no UI), drawn by the same generator
function playerAppearance() {
  let seed = Settings.data.player && Settings.data.player.seed;
  if (!seed) { seed = (Math.random() * 0x7fffffff) >>> 0 || 4242; Settings.set('player.seed', seed); }
  return generateAppearance(seed, {});
}
// skin: wrap lighting softens the terminator with a warm tint (light scattered under the skin)
function fpSkinMaterial(color) {
  const mat = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.88), roughness: 0.52, metalness: 0, vertexColors: true, bumpMap: fpSkinBump(), bumpScale: 0.35, envMapIntensity: 0.55 });
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace(
      'vec3 irradiance = dotNL * directLight.color;',
      'float htW = saturate((dot(geometryNormal, directLight.direction) + 0.4) / 1.4); vec3 irradiance = mix(vec3(dotNL), htW * vec3(1.0, 0.66, 0.55), 0.38) * directLight.color;'));
  };
  mat.customProgramCacheKey = () => 'ht3d-fpskin';
  return mat;
}
function fpSkinBump() {
  return Tex.make('fpSkinBump', 256, 256, (g, w, h) => {
    const img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const pore = hash2(x * 7, y * 13) < 0.08 ? -40 : 0, n = fbm2(x / w * 24, y / h * 24, 3) * 60 + hash2(x, y) * 30, crease = Math.sin(y / h * TAU * 18 + fbm2(x / w * 4, y / h * 4, 2) * 3) * 10;
      const v = clamp(128 + n - 45 + pore + crease, 0, 255), i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { color: false });
}
function fpFabricBump(kind) {
  return Tex.make('fpFabric-' + kind, 128, 128, (g, w, h) => {
    const img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v;
      if (kind === 'knit') v = 128 + 70 * Math.sin(x / w * TAU * 16) * Math.abs(Math.sin(y / h * TAU * 24));
      else if (kind === 'leather') v = 128 + fbm2(x / w * 18, y / h * 18, 3) * 80 - 40;
      else v = 128 + 40 * Math.sin(x / w * TAU * 32) + 40 * Math.sin(y / h * TAU * 32) + hash2(x, y) * 30;
      const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = clamp(v, 0, 255); d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { color: false });
}

class FPHand {
  constructor(side, look) {
    this.side = side; this.look = look;
    this.group = new THREE.Group(); this.group.name = side > 0 ? 'fpHandR' : 'fpHandL';
    this.buildSkeleton();
    this.buildMesh();
    this.cur = this.poseCopy(FP_POSES.relaxed); this.target = this.poseCopy(FP_POSES.relaxed);
    this.trigger = 0; this.tweak = 0; this.t = Math.random() * 10;
  }
  poseCopy(p) { return { f: p.f.map(a => a.slice()), spread: p.spread, t: p.t.slice() }; }
  setPose(name, extra) {
    const p = typeof name === 'string' ? FP_POSES[name] : name; if (!p) return;
    const T = this.target;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) T.f[i][j] = p.f[i][j];
    T.spread = p.spread; for (let j = 0; j < 3; j++) T.t[j] = p.t[j];
    if (extra && extra.index) for (let j = 0; j < 3; j++) T.f[0][j] = extra.index[j];
  }
  // a pose blended between two (e.g. relaxed -> grab while closing)
  blendPose(a, b, k) {
    const A = FP_POSES[a], Bp = FP_POSES[b], T = this.target;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) T.f[i][j] = lerp(A.f[i][j], Bp.f[i][j], k);
    T.spread = lerp(A.spread, Bp.spread, k); for (let j = 0; j < 3; j++) T.t[j] = lerp(A.t[j], Bp.t[j], k);
  }
  buildSkeleton() {
    const sg = this.side, bones = [];
    const wrist = new THREE.Bone(); wrist.name = 'wrist'; bones.push(wrist);
    this.fingers = [];
    for (const F of FP_FINGERS) {
      const mcp = new THREE.Bone(); mcp.rotation.order = 'YXZ'; mcp.position.set(F.x * sg, F.y, F.z); mcp.rotation.y = -F.yaw * sg;
      const pip = new THREE.Bone(); pip.position.set(0, 0, -F.L[0]);
      const dip = new THREE.Bone(); dip.position.set(0, 0, -F.L[1]);
      wrist.add(mcp); mcp.add(pip); pip.add(dip);
      bones.push(mcp, pip, dip);
      this.fingers.push({ F, j: [mcp, pip, dip], yaw0: -F.yaw * sg });
    }
    // thumb: its own frame (nail to the side), pointing forward, in and down from the heel of the hand
    const T = FP_THUMB, dir = new V3(T.dir[0] * sg, T.dir[1], T.dir[2]).normalize(), up0 = new V3(T.up[0] * sg, T.up[1], T.up[2]);
    const zAx = dir.clone().negate(), xAx = new V3().crossVectors(up0, zAx).normalize(), yAx = new V3().crossVectors(zAx, xAx);
    const cmc = new THREE.Bone(); cmc.position.set(T.base[0] * sg, T.base[1], T.base[2]); cmc.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, yAx, zAx));
    const tm = new THREE.Bone(); tm.position.set(0, 0, -T.L[0]);
    const ti = new THREE.Bone(); ti.position.set(0, 0, -T.L[1]);
    wrist.add(cmc); cmc.add(tm); tm.add(ti); bones.push(cmc, tm, ti);
    this.thumb = { j: [cmc, tm, ti], q0: cmc.quaternion.clone() };
    this.bones = bones; this.wrist = wrist;
    this.group.add(wrist);
    this.group.updateMatrixWorld(true);
  }
  // a tube along -z in a bone's frame: sections [d, rx, ry]; per-vertex weights from wfn(d) -> [[bone, w], ...]
  tube(out, frameBone, secs, seg, wfn, opts = {}) {
    const m = frameBone.matrixWorld, base = out.P.length / 3, ring = seg + 1;
    const nmat = new THREE.Matrix3().getNormalMatrix(m);
    for (let k = 0; k < secs.length; k++) {
      const [d, rx, ry, cy = 0, bulge = null] = secs[k];
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * TAU, ca = Math.cos(a), sa = Math.sin(a);
        let r = 1;
        if (bulge) r += bulge(a, d);
        // pads: the palm side of a finger is fuller than the back
        const px = ca * rx * r, py = sa * ry * r * (sa < 0 ? (opts.pad || 1.08) : 0.95) + cy;
        const v = _fpV.set(px, py, -d).applyMatrix4(m);
        out.P.push(v.x, v.y, v.z);
        const nv = _fpN.set(ca / Math.max(rx, 1e-4), sa / Math.max(ry, 1e-4), 0).normalize().applyMatrix3(nmat).normalize();
        out.N.push(nv.x, nv.y, nv.z);
        out.U.push(i / seg, d * 25);
        // palm side a touch lighter and warmer, knuckles and tips a touch redder
        const palm = smoothstep(0.1, -0.7, sa) * (opts.palmTint || 0.08);
        const red = (opts.red ? opts.red(d, sa) : 0);
        out.C.push(1 + palm * 0.8 + red * 0.05, 1 + palm * 0.5 - red * 0.06, 1 + palm * 0.45 - red * 0.08);
        const ws = wfn(d, ca, sa);
        for (let q = 0; q < 4; q++) { const e = ws[q]; out.SI.push(e ? e[0] : 0); out.SW.push(e ? e[1] : 0); }
      }
    }
    for (let k = 0; k < secs.length - 1; k++) for (let i = 0; i < seg; i++) {
      const a = base + k * ring + i, b = a + ring;
      out.I.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  buildMesh() {
    const sg = this.side, out = { P: [], N: [], U: [], C: [], SI: [], SW: [], I: [] };
    const bi = (b) => this.bones.indexOf(b);
    const W = bi(this.wrist);
    // palm: wrist to knuckles, a rounded slab with the thenar (thumb) and hypothenar pads underneath
    const palmSecs = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12, d = lerp(-0.018, 0.072, t);
      const rx = lerp(0.025, 0.043, smoothstep(0, 0.55, t)) - 0.004 * smoothstep(0.85, 1, t), ry = lerp(0.017, 0.0125, t) - 0.003 * smoothstep(0.88, 1, t);
      palmSecs.push([d, rx, ry, 0, (a, dd) => {
        const ca = Math.cos(a), sa = Math.sin(a);
        const thenar = Math.max(0, -sa) * Math.max(0, -ca * sg) * Math.exp(-(((dd - 0.022) / 0.024) ** 2)) * 0.45;
        const hypo = Math.max(0, -sa) * Math.max(0, ca * sg) * Math.exp(-(((dd - 0.03) / 0.03) ** 2)) * 0.18;
        let kn = 0; // knuckle ridge on the back of the hand
        if (sa > 0.4) for (const F of FP_FINGERS) kn += Math.exp(-(((ca * rx - F.x * sg) / 0.006) ** 2)) * Math.exp(-(((dd - (-F.z - 0.004)) / 0.006) ** 2)) * 0.12;
        const flat = sa > 0 ? -0.08 * Math.abs(ca) : 0;  // the back of the hand is flatter
        return thenar + hypo + kn + flat;
      }]);
    }
    // the end cap toward the fingers
    this.tube(out, this.wrist, palmSecs.map(s => [s[0], s[1], s[2], s[3], s[4]]), 22, (d, ca, sa) => {
      // the knuckle row bends a little with each finger; the heel of the thumb with the thumb
      const x = ca * 0.04;
      let best = 0, bd = 9; for (let i = 0; i < 4; i++) { const dd = Math.abs(x - FP_FINGERS[i].x * sg); if (dd < bd) { bd = dd; best = i; } }
      const kf = smoothstep(0.052, 0.072, d) * 0.45, kt = Math.max(0, -sa) * Math.max(0, -ca * sg) * Math.exp(-(((d - 0.012) / 0.02) ** 2)) * 0.5;
      return [[W, 1 - kf - kt], [bi(this.fingers[best].j[0]), kf], [bi(this.thumb.j[0]), kt]];
    }, { palmTint: 0.1 });
    // fingers
    for (const fg of this.fingers) {
      const F = fg.F, L = F.L, tot = L[0] + L[1] + L[2], R = F.r;
      const secs = [];
      const radAt = (d) => d < L[0] ? lerp(R[0] * 1.08, R[1], d / L[0]) : d < L[0] + L[1] ? lerp(R[1], R[2], (d - L[0]) / L[1]) : R[2] * (1 - 0.06 * (d - L[0] - L[1]) / L[2]);
      for (let d = -0.012; d < tot - R[2] * 0.95; d += 0.0032) {
        const r = radAt(Math.max(0, d)), jbump = Math.exp(-(((d - L[0]) / 0.004) ** 2)) * 0.06 + Math.exp(-(((d - L[0] - L[1]) / 0.004) ** 2)) * 0.05;
        secs.push([d, r * 1.05 * (1 + jbump), r * 0.9 * (1 + jbump * 0.5)]);
      }
      // rounded tip
      const r2 = radAt(tot), d0 = tot - r2 * 0.95;
      for (let k = 1; k <= 6; k++) { const a = k / 6 * Math.PI / 2; secs.push([d0 + Math.sin(a) * r2 * 0.95, r2 * 1.05 * Math.cos(a) + 1e-4, r2 * 0.9 * Math.cos(a) + 1e-4]); }
      const [b0, b1, b2] = fg.j.map(bi), bw = 0.0055;
      this.tube(out, fg.j[0], secs, 14, (d) => {
        if (d < 0) { const k = smoothstep(-0.012, 0, d); return [[W, 1 - k * 0.6], [b0, k * 0.6]]; }
        const k1 = smoothstep(L[0] - bw, L[0] + bw, d), k2 = smoothstep(L[0] + L[1] - bw, L[0] + L[1] + bw, d);
        return [[b0, 1 - k1], [b1, k1 - k2], [b2, k2]];
      }, { pad: 1.12, red: (d, sa) => Math.exp(-(((d - L[0]) / 0.005) ** 2)) * Math.max(0, sa) + smoothstep(tot - 0.01, tot, d) * 0.6 });
      // the nail: a thin curved plate over the back of the last joint, a pale free edge at the tip
      this.nail(fg.j[0], L[0] + L[1] + L[2] * 0.42, tot - R[2] * 0.25, R[2] * 0.9, b2);
    }
    // thumb
    {
      const T = FP_THUMB, L = T.L, R = T.r, tot = L[0] + L[1] + L[2], th = this.thumb;
      const secs = [];
      const radAt = (d) => d < L[0] ? lerp(R[0] * 1.15, R[1], d / L[0]) : d < L[0] + L[1] ? lerp(R[1], R[2], (d - L[0]) / L[1]) : R[2];
      for (let d = -0.012; d < tot - R[2] * 0.95; d += 0.0035) { const r = radAt(Math.max(0, d)); secs.push([d, r * 1.08, r * 0.88]); }
      const r2 = R[2], d0 = tot - r2 * 0.95;
      for (let k = 1; k <= 6; k++) { const a = k / 6 * Math.PI / 2; secs.push([d0 + Math.sin(a) * r2 * 0.95, r2 * 1.08 * Math.cos(a) + 1e-4, r2 * 0.88 * Math.cos(a) + 1e-4]); }
      const [b0, b1, b2] = th.j.map(bi), bw = 0.006;
      this.tube(out, th.j[0], secs, 14, (d) => {
        if (d < 0.012) { const k = smoothstep(-0.012, 0.012, d); return [[W, 1 - k], [b0, k]]; }
        const k1 = smoothstep(L[0] - bw, L[0] + bw, d), k2 = smoothstep(L[0] + L[1] - bw, L[0] + L[1] + bw, d);
        return [[b0, 1 - k1], [b1, k1 - k2], [b2, k2]];
      }, { pad: 1.1, red: (d) => smoothstep(tot - 0.012, tot, d) * 0.5 });
      this.nail(th.j[0], L[0] + L[1] + L[2] * 0.45, tot - R[2] * 0.25, R[2] * 0.95, b2);
    }
    this.emitNails(out);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(out.P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(out.N, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(out.U, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(out.C, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(out.SI, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(out.SW, 4));
    geo.setIndex(out.I);
    geo.computeVertexNormals();
    // nails are their own group (second material)
    geo.addGroup(0, this.nailStart, 0); geo.addGroup(this.nailStart, out.I.length - this.nailStart, 1);
    this.skin = fpSkinMaterial(new THREE.Color(this.look.skin));
    this.nailMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.look.skin).lerp(new THREE.Color(0xf3d6cc), 0.55), roughness: 0.22, metalness: 0, vertexColors: true, envMapIntensity: 0.9 });
    const mesh = new THREE.SkinnedMesh(geo, [this.skin, this.nailMat]);
    mesh.add(this.wrist);
    mesh.bind(new THREE.Skeleton(this.bones));
    mesh.frustumCulled = false;
    this.group.remove(this.wrist);
    this.group.add(mesh);
    this.mesh = mesh;
  }
  // nails: collected while the fingers are built, emitted after all the skin (a second material group)
  nail(fb, d0, d1, r, bone) { (this._nails || (this._nails = [])).push({ fb, d0, d1, r, bone }); }
  emitNails(out) {
    this.nailStart = out.I.length;
    for (const n of this._nails || []) {
      const m = n.fb.matrixWorld, base = out.P.length / 3, segA = 8, segL = 5;
      for (let k = 0; k <= segL; k++) {
        const d = lerp(n.d0, n.d1, k / segL), free = k === segL ? 1 : 0;
        for (let i = 0; i <= segA; i++) {
          const a = lerp(Math.PI * 0.2, Math.PI * 0.8, i / segA), ca = Math.cos(a), sa = Math.sin(a);
          const lift = n.r * (1.02 + 0.06 * Math.sin(Math.PI * k / segL)) + 0.0006;
          const v = _fpV.set(ca * lift * 1.02, sa * lift * 0.92, -d).applyMatrix4(m);
          out.P.push(v.x, v.y, v.z); out.N.push(0, 1, 0); out.U.push(i / segA, k / segL);
          const lun = k === 0 ? 0.08 : 0; // a pale lunula at the base, a whiter free edge
          out.C.push(1 + lun + free * 0.12, 1 + lun + free * 0.12, 1 + lun + free * 0.12);
          for (let q = 0; q < 4; q++) { out.SI.push(q === 0 ? n.bone : 0); out.SW.push(q === 0 ? 1 : 0); }
        }
      }
      for (let k = 0; k < segL; k++) for (let i = 0; i < segA; i++) { const a = base + k * (segA + 1) + i, b = a + segA + 1; out.I.push(a, b, a + 1, a + 1, b, b + 1); }
    }
  }
  update(dt) {
    this.t += dt;
    const C = this.cur, T = this.target, k = 1 - Math.exp(-dt * 16), sg = this.side;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) C.f[i][j] += (T.f[i][j] - C.f[i][j]) * k;
    C.spread += (T.spread - C.spread) * k; for (let j = 0; j < 3; j++) C.t[j] += (T.t[j] - C.t[j]) * k;
    // a living hand never holds perfectly still
    const micro = (i) => Math.sin(this.t * (1.3 + i * 0.37) + i * 2.1) * 0.025 * (1 - Math.min(1, C.f[i][1] / 1.4) * 0.6);
    for (let i = 0; i < 4; i++) {
      const fg = this.fingers[i], spreadA = (i - 1.5) * C.spread * 0.55 * sg;
      const trig = i === 0 ? this.trigger : 0;
      fg.j[0].rotation.set(-(C.f[i][0] + micro(i) + trig * 0.18), fg.yaw0 + spreadA, 0);
      fg.j[1].rotation.set(-(C.f[i][1] + trig * 0.42), 0, 0);
      fg.j[2].rotation.set(-(C.f[i][2] + trig * 0.3), 0, 0);
    }
    const th = this.thumb;
    // opposition swings the thumb across the palm and turns its pad toward the fingers
    th.j[0].quaternion.copy(th.q0).multiply(_fpQ.setFromEuler(_fpE.set(-C.t[0] * 0.55, C.t[0] * 0.6 * sg, C.t[0] * 0.5 * sg)));
    th.j[1].rotation.set(-C.t[1], 0, 0); th.j[2].rotation.set(-C.t[2], 0, 0);
  }
  setColors(look) {
    this.skin.color.set(look.skin);
    this.nailMat.color.set(new THREE.Color(look.skin).lerp(new THREE.Color(0xf3d6cc), 0.55));
  }
}
const _fpV = new V3(), _fpN = new V3(), _fpQ = new THREE.Quaternion(), _fpE = new THREE.Euler();
// forearm + upper arm: lofted, skin with a sleeve over it; solved from the shoulder to the wrist
class FPArm {
  constructor(side, look) {
    this.side = side; this.look = look;
    this.hand = new FPHand(side, look);
    this.group = new THREE.Group(); this.group.name = side > 0 ? 'fpArmR' : 'fpArmL';
    this.fore = new THREE.Group(); this.upper = new THREE.Group();
    this.group.add(this.fore, this.upper);
    this.buildMeshes();
    this.shoulder = new V3(0.205 * side, -0.27, 0.12);
    this.pole = new V3(0.9 * side, -1, 0.15).normalize();
    this.Lf = 0.265; this.Lu = 0.29;
  }
  loft(secs, seg, open, mat, noise) {
    const P = [], U = [], I = [], ring = seg + 1;
    for (let k = 0; k < secs.length; k++) {
      const [z, rx, ry] = secs[k];
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * TAU, n = noise ? noise(a, z) : 0;
        P.push(Math.cos(a) * rx * (1 + n), Math.sin(a) * ry * (1 + n), z); U.push(i / seg, z * 6);
      }
    }
    for (let k = 0; k < secs.length - 1; k++) for (let i = 0; i < seg; i++) { const a = k * ring + i, b = a + ring; I.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
    return m;
  }
  buildMeshes() {
    const look = this.look, long = look.sleeve !== 'short';
    this.skinMat = this.hand.skin;
    const fab = look.fabric;
    this.sleeveMat = new THREE.MeshStandardMaterial({ color: look.sleeveColor, roughness: fab === 'leather' ? 0.45 : fab === 'nylon' ? 0.55 : 0.9, metalness: 0, bumpMap: fpFabricBump(fab === 'knit' ? 'knit' : fab === 'leather' ? 'leather' : 'weave'), bumpScale: fab === 'leather' ? 0.4 : 0.6, side: THREE.DoubleSide, envMapIntensity: fab === 'leather' || fab === 'nylon' ? 0.8 : 0.35 });
    this.skinPlain = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.skin).multiplyScalar(0.88), roughness: 0.55, metalness: 0, bumpMap: fpSkinBump(), bumpScale: 0.25, envMapIntensity: 0.5 });
    // forearm skin: wrist (z=0) to elbow (z=Lf), oval and flatter at the wrist, rounder toward the elbow
    const fs = [];
    for (let k = 0; k <= 14; k++) { const t = k / 14, z = lerp(-0.012, 0.28, t); fs.push([z, lerp(0.0255, 0.041, smoothstep(0, 0.75, t)), lerp(0.0185, 0.036, smoothstep(0, 0.8, t))]); }
    this.foreSkin = this.loft(fs, 20, true, this.skinPlain);
    this.fore.add(this.foreSkin);
    // a rounded wrist end so the hand's heel blends into it
    { const s = new THREE.SphereGeometry(1, 16, 10); s.scale(0.0255, 0.0185, 0.02); const m = new THREE.Mesh(s, this.skinPlain); m.position.z = -0.008; this.fore.add(m); }
    if (long) {
      // sleeve: starts a few cm above the wrist with a hem, folds gathering toward the elbow
      const ss = [], z0 = look.cuffs ? 0.045 : 0.06;
      for (let k = 0; k <= 22; k++) {
        const t = k / 22, z = lerp(z0, 0.3, t);
        const base = 1 + (look.puffy ? 0.35 : 0.2), rx = lerp(0.0255, 0.041, smoothstep(0, 0.75, (z + 0.012) / 0.29)) * base + 0.004, ry = lerp(0.0185, 0.036, smoothstep(0, 0.8, (z + 0.012) / 0.29)) * base + 0.004;
        ss.push([z, rx, ry]);
      }
      const folds = (a, z) => 0.05 * Math.sin(a * 3 + z * 40) * smoothstep(0.08, 0.26, z) + 0.035 * Math.sin(a * 5 - z * 70 + 1.3) * smoothstep(0.1, 0.2, z) + 0.02 * Math.sin(z * 120 + a);
      this.sleeve = this.loft(ss, 24, true, this.sleeveMat, folds);
      this.fore.add(this.sleeve);
      if (look.cuffs) { // a ribbed cuff band
        const cs = [[z0 - 0.002, 0.03, 0.024], [z0 + 0.03, 0.031, 0.025], [z0 + 0.034, 0.0345, 0.0285]];
        const cuff = this.loft(cs, 24, true, this.sleeveMat, (a) => 0.04 * Math.max(0, Math.sin(a * 22)));
        this.fore.add(cuff);
      }
    }
    // upper arm (mostly off screen): sleeved or bare from the elbow to the shoulder
    const us = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8, z = lerp(-0.02, 0.31, t); us.push([z, lerp(0.043, 0.05, t) * (long || look.sleeve === 'short' ? 1.22 : 1), lerp(0.04, 0.047, t) * (long || look.sleeve === 'short' ? 1.22 : 1)]); }
    this.upperMesh = this.loft(us, 18, true, long || look.sleeve === 'short' ? this.sleeveMat : this.skinPlain);
    this.upper.add(this.upperMesh);
    // the elbow
    { const s = new THREE.SphereGeometry(1, 14, 10); s.scale(0.046, 0.044, 0.046); const m = new THREE.Mesh(s, long ? this.sleeveMat : this.skinPlain); this.upper.add(m); this.elbowBall = m; }
  }
  // place the arm for a wrist at W (vm space) with the hand's little-finger axis X (for the forearm's roll)
  solve(W, X) {
    // reaching far: the shoulder comes forward (and in) before the arm straightens
    const S0 = this.shoulder, d0 = _fa1.subVectors(W, S0), L0 = d0.length(), over = L0 - (this.Lu + this.Lf) * 0.97;
    const S = this._s || (this._s = new V3());
    S.copy(S0); if (over > 0) S.addScaledVector(d0, Math.min(over, 0.16) / L0);
    const d = _fa1.subVectors(W, S), L = d.length(), Lu = this.Lu, Lf = this.Lf;
    const reach = Math.min(L, Lu + Lf - 1e-3);
    const dir = d.clone().normalize();
    // elbow on the circle, toward the pole (down and out)
    const a = (Lu * Lu + reach * reach - Lf * Lf) / (2 * reach), h = Math.sqrt(Math.max(0, Lu * Lu - a * a));
    const pole = _fa2.copy(this.pole).addScaledVector(dir, -this.pole.dot(dir)).normalize();
    const E = _fa3.copy(S).addScaledVector(dir, a).addScaledVector(pole, h);
    if (L > Lu + Lf) E.copy(S).addScaledVector(dir, Lu);
    // forearm: +z from the wrist toward the elbow, its x axis along the hand's (pronation follows the hand)
    const zf = _fa4.subVectors(E, W).normalize(), xf = _fa5.copy(X).addScaledVector(zf, -X.dot(zf)).normalize(), yf = _fa6.crossVectors(zf, xf);
    this.fore.position.copy(W); this.fore.quaternion.setFromRotationMatrix(_faM.makeBasis(xf, yf, zf));
    const len = W.distanceTo(E); this.fore.scale.set(1, 1, Math.min(1.12, len / Lf));
    // upper arm: from the elbow toward the shoulder
    const zu = _fa4.subVectors(S, E).normalize(), xu = _fa5.copy(xf).addScaledVector(zu, -xf.dot(zu)).normalize(), yu = _fa6.crossVectors(zu, xu);
    this.upper.position.copy(E); this.upper.quaternion.setFromRotationMatrix(_faM.makeBasis(xu, yu, zu));
  }
}
const _fa1 = new V3(), _fa2 = new V3(), _fa3 = new V3(), _fa4 = new V3(), _fa5 = new V3(), _fa6 = new V3(), _faM = new THREE.Matrix4();
function fpLookFromAppearance(app) {
  const top = app.top, def = top.def || {};
  const sleeve = def.sleeve || 'long';
  const col = (top.type === 'blazer' || top.type === 'labcoat' || top.type === 'longcoat') ? top.color : top.color;
  return { skin: app.skin.hex, sleeve, sleeveColor: col, fabric: def.mat || 'cotton', cuffs: !!def.cuffs, puffy: top.type === 'jacket' || top.type === 'hoodie' || top.type === 'longcoat', app };
}
HT.FPArm = FPArm; HT.FPHand = FPHand;
// where each hand holds each weapon (in the weapon model's space): g = the palm centre, x = the way the
// little finger points, d = the back of the hand; pose = the finger pose; index = a trigger finger
const FP_HOLDS = {
  pistol: {
    R: { g: [0.017, -0.04, 0.03], x: [0, -0.96, 0.28], d: [0.86, 0.05, 0.5], pose: 'grip' },
    L: { g: [-0.024, -0.062, 0.006], x: [0.05, -0.96, 0.28], d: [-0.82, -0.25, 0.5], pose: 'support' }
  },
  sniper: {
    R: { g: [0.017, -0.048, 0.088], x: [0, -0.94, 0.34], d: [0.86, 0.05, 0.5], pose: 'grip' },
    L: { g: [-0.004, -0.05, -0.3], x: [0, 0.05, 1], d: [-0.25, -0.97, 0], pose: 'cradle' }
  },
  knife: { R: { g: [0.012, -0.004, 0.035], x: [0, 0, 1], d: [0.72, 0.69, 0], pose: 'fist' } },
  grenade: { R: { g: [0.0, -0.016, -0.012], x: [-1, 0, 0.1], d: [0.1, -0.85, 0.5], pose: 'ball' } },
  bazooka: {
    R: { g: [0.017, -0.07, 0.035], x: [0, -0.97, 0.25], d: [0.86, 0.05, 0.5], pose: 'grip' },
    L: { g: [-0.018, -0.072, -0.312], x: [0, -1, 0], d: [-0.9, 0, 0.42], pose: 'gripSnug' }
  },
  hand: { R: { g: [0, 0, 0], x: [0.95, -0.25, 0.1], d: [0.25, 0.85, 0.45], pose: 'relaxed' } },
  move: { R: { g: [0, 0, 0], x: [0.95, -0.25, 0.1], d: [0.25, 0.85, 0.45], pose: 'relaxed' } }
};
// hand frame from a hold: z = fingers back, y = dorsal, x = little-finger side (thumb side for the left hand)
function fpHoldMatrix(h, side, out) {
  const X = new V3(...h.x).normalize(), D = new V3(...h.d);
  const xh = side > 0 ? X : X.clone().negate();
  const y = D.addScaledVector(xh, -D.dot(xh)).normalize(), z = new V3().crossVectors(xh, y).normalize();
  out.makeBasis(xh, y, z);
  // the wrist sits behind the palm centre (palm centre at 4.5 cm along the hand, 6 mm into the palm)
  const off = new V3(0, -0.006, -0.045).applyMatrix4(new THREE.Matrix4().extractRotation(out));
  out.setPosition(new V3(...h.g).sub(off));
  return out;
}
HT.FP_HOLDS = FP_HOLDS;
