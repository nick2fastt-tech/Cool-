// Behemoth's body shape as pure math (no three.js), shared by the renderer and the episode script.
// The spine runs from the tail tip (u = 0) to the back of the head (u = 1). At scale 1 the
// creature is about 1.2 m long; everything is multiplied by `s`.

export const BEH_N = 24;
const L = 1.2;          // body length at scale 1
const U_NECK = 0.5;    // where the neck starts rising
const sm = (a, b, v) => { const k = Math.min(1, Math.max(0, (v - a) / (b - a))); return k * k * (3 - 2 * k); };

export function behRadius(u) {
  return 0.018 + 0.057 * sm(0, 0.45, u) - 0.015 * sm(0.55, 0.92, u);
}

// p: { x, y, z, ry, s, t, rear, look, nod, sway, slither, curl, tailLift, shake, headYaw }
export function behemothRig(p) {
  const N = BEH_N, da = L / (N - 1);
  const t = p.t ?? 0, rear = p.rear ?? 0.1, curl = p.curl ?? 0, slither = p.slither ?? 0.4;
  const iN = Math.round(U_NECK * (N - 1));
  const loc = new Array(N);
  // ground part, integrated from the tail tip toward the neck
  let x = 0, z = 0, ph = 0;
  const heading = (a) => slither * 0.55 * Math.sin(a * 6.5 - t * 3.2) * (1 - a / (U_NECK * L)) + curl * (U_NECK * L - a) * 6.2 + (p.tailSwing ?? 0) * (1 - a / (U_NECK * L)) * 1.4;
  const raw = [];
  for (let i = 0; i <= iN; i++) {
    const a = i * da;
    raw.push([x, z, ph]);
    ph = heading(a);
    x += Math.sin(ph) * da; z += Math.cos(ph) * da;
  }
  // shift so the neck base sits at the origin, facing +z
  const [bx, bz, bph] = raw[iN];
  const cb = Math.cos(-bph), sb = Math.sin(-bph);
  for (let i = 0; i <= iN; i++) {
    const u = i / (N - 1);
    const dx = raw[i][0] - bx, dz = raw[i][1] - bz;
    const lx = dx * cb + dz * sb, lz = -dx * sb + dz * cb;
    const tl = p.tailLift ?? 0;
    const lift = tl * 0.45 * Math.pow(Math.max(0, 1 - u / 0.38), 1.6);
    loc[i] = [lx, behRadius(u) + lift, lz];
  }
  // neck: rises with `rear`, turns with `look`
  let nx = 0, ny = loc[iN][1], nz = 0;
  const look = (p.look ?? 0) + (p.sway ?? 0) * 0.25 * Math.sin(t * 1.1);
  let pitch = 0, yaw = 0;
  for (let i = iN + 1; i < N; i++) {
    const u2 = (i - iN) / (N - 1 - iN);
    pitch = rear * 1.45 * sm(0, 0.6, u2) - rear * 0.55 * sm(0.68, 1, u2) + (1 - rear) * 0.35 * u2;
    yaw = look * sm(0, 1, u2);
    nx += Math.sin(yaw) * Math.cos(pitch) * da;
    ny += Math.sin(pitch) * da;
    nz += Math.cos(yaw) * Math.cos(pitch) * da;
    loc[i] = [nx, ny, nz];
  }
  // head
  const shake = (p.shake ?? 0) * 0.45 * Math.sin(t * 24);
  const hYaw = yaw + (p.headYaw ?? 0) + shake;
  const hPitch = pitch - rear * 0.85 - (p.nod ?? 0);
  const hd = [Math.sin(hYaw) * Math.cos(hPitch), Math.sin(hPitch), Math.cos(hYaw) * Math.cos(hPitch)];
  const last = loc[N - 1];
  const headLoc = [last[0] + hd[0] * 0.07, last[1] + hd[1] * 0.07 + 0.01, last[2] + hd[2] * 0.07];
  // to world
  const s = p.s ?? 1, ry = p.ry ?? 0, c = Math.cos(ry), si = Math.sin(ry);
  const W = (v) => [p.x + (v[0] * c + v[2] * si) * s, (p.y ?? 0) + v[1] * s, p.z + (-v[0] * si + v[2] * c) * s];
  const Wd = (v) => [v[0] * c + v[2] * si, v[1], -v[0] * si + v[2] * c];
  const pts = loc.map(W);
  const head = W(headLoc);
  const dir = Wd(hd);
  const mouth = [head[0] + dir[0] * 0.09 * s, head[1] + dir[1] * 0.09 * s - 0.012 * s, head[2] + dir[2] * 0.09 * s];
  const crown = [head[0] - dir[0] * 0.015 * s, head[1] + 0.047 * s, head[2] - dir[2] * 0.015 * s];
  const rad = pts.map((_, i) => behRadius(i / (N - 1)) * s);
  return { pts, rad, head, dir, mouth, crown, yaw: ry + hYaw, pitch: hPitch, s };
}

// Read the rig parameters from director tracks at time t (val(name, t, default)).
export function behParams(val, t) {
  return {
    t, x: val('beh.x', t, 0), y: val('beh.y', t, 0), z: val('beh.z', t, 0), ry: val('beh.ry', t, 0), s: val('beh.s', t, 1),
    rear: val('beh.rear', t, 0.1), look: val('beh.look', t, 0), nod: val('beh.nod', t, 0), sway: val('beh.sway', t, 0.3),
    slither: val('beh.slither', t, 0.4), curl: val('beh.curl', t, 0), tailLift: val('beh.tailLift', t, 0), shake: val('beh.shake', t, 0),
    headYaw: val('beh.headYaw', t, 0), tailSwing: val('beh.tailSwing', t, 0),
  };
}

// A point on the creature's back at spine position u (0 tail .. 1 head), for riders.
export function behBack(rig, u) {
  const f = u * (rig.pts.length - 1), i = Math.min(rig.pts.length - 2, Math.floor(f)), k = f - i;
  const a = rig.pts[i], b = rig.pts[i + 1];
  const r = rig.rad[i] + (rig.rad[i + 1] - rig.rad[i]) * k;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + r * 0.95, a[2] + (b[2] - a[2]) * k];
}
