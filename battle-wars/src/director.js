// Timeline builder. Pure JS (no three.js) so the audio tool can import it in Node.
// Everything in the episode is a function of time t, so any frame can be rendered on its own.

export const EASE = {
  linear: (k) => k,
  inout: (k) => k * k * (3 - 2 * k),
  in: (k) => k * k,
  out: (k) => 1 - (1 - k) * (1 - k),
  back: (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
};

export function evalTrack(keys, t) {
  if (!keys || !keys.length) return undefined;
  if (t < keys[0].t) return undefined;
  // binary search for last key with key.t <= t
  let lo = 0, hi = keys.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (keys[mid].t <= t) lo = mid; else hi = mid - 1; }
  const k0 = keys[lo], k1 = keys[lo + 1];
  if (!k1) return k0.v;
  if (typeof k0.v !== 'number' || k1.ease === 'step') return k0.v;
  const span = k1.t - k0.t;
  const k = span <= 0 ? 1 : (t - k0.t) / span;
  return k0.v + (k1.v - k0.v) * EASE[k1.ease](k);
}

// For discrete tracks: current value, previous value and time since the change.
export function evalStep(keys, t) {
  if (!keys || !keys.length) return { v: undefined, prev: undefined, since: 1e9 };
  let idx = -1;
  for (let i = 0; i < keys.length; i++) { if (keys[i].t <= t) idx = i; else break; }
  if (idx < 0) return { v: keys[0].v, prev: keys[0].v, since: 1e9 };
  return { v: keys[idx].v, prev: idx > 0 ? keys[idx - 1].v : keys[idx].v, since: t - keys[idx].t };
}

export function readTime(text) {
  return Math.min(6.5, Math.max(1.5, 0.9 + text.length * 0.058));
}

export function createDirector() {
  const T = { tracks: {}, shots: [], captions: [], sfx: [], music: [], sets: [], comics: [], cards: [], scenes: [], fx: [], duration: 0 };
  let now = 0;

  const push = (name, t, v, ease = 'inout') => {
    const arr = (T.tracks[name] ||= []);
    arr.push({ t, v, ease });
    arr.sort((a, b) => a.t - b.t);
  };
  const val = (name, t, dflt = 0) => { const v = evalTrack(T.tracks[name], t); return v === undefined ? dflt : v; };

  const D = {
    T,
    get now() { return now; },
    at(t) { now = t; return D; },
    wait(d) { now += d; return D; },
    val,
    // instant set
    set(name, v, dt = 0) { push(name, now + dt, v, 'step'); return D; },
    // tween from current value
    anim(name, v, dur, dt = 0, ease = 'inout') {
      const t0 = now + dt;
      push(name, t0, val(name, t0, typeof v === 'number' ? 0 : v), 'step');
      push(name, t0 + dur, v, ease);
      return D;
    },
    // ---- characters
    place(c, x, z, ry = 0, dt = 0) {
      for (const k of ['x', 'z', 'ry', 'y']) { const arr = T.tracks[`${c}.${k}`]; if (arr) T.tracks[`${c}.${k}`] = arr.filter((e) => e.t <= now + dt); }
      D.set(`${c}.x`, x, dt); D.set(`${c}.z`, z, dt); D.set(`${c}.ry`, ry, dt); D.set(`${c}.vis`, 1, dt); D.set(`${c}.y`, 0, dt);
      return D;
    },
    // stop any movement in progress: drop future position keys and hold where they are now
    stop(c, dt = 0) {
      const t0 = now + dt;
      const cur = {};
      for (const k of ['x', 'z', 'y']) cur[k] = val(`${c}.${k}`, t0);
      for (const k of ['x', 'z', 'y']) { const arr = T.tracks[`${c}.${k}`]; if (arr) T.tracks[`${c}.${k}`] = arr.filter((e) => e.t <= t0); push(`${c}.${k}`, t0, cur[k], 'step'); }
      return D;
    },
    hide(c, dt = 0) { return D.set(`${c}.vis`, 0, dt); },
    show(c, dt = 0) { return D.set(`${c}.vis`, 1, dt); },
    act(c, a, dt = 0) { return D.set(`${c}.act`, a, dt); },
    expr(c, e, dt = 0) { return D.set(`${c}.expr`, e, dt); },
    face(c, ry, dur = 0.35, dt = 0) {
      const t0 = now + dt;
      let cur = val(`${c}.ry`, t0);
      let d = ry - cur;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return D.anim(`${c}.ry`, cur + d, dur, dt);
    },
    faceTo(c, x, z, dur = 0.35, dt = 0) {
      const t0 = now + dt;
      const cx = val(`${c}.x`, t0), cz = val(`${c}.z`, t0);
      return D.face(c, Math.atan2(x - cx, z - cz), dur, dt);
    },
    faceChar(c, o, dur = 0.35, dt = 0) {
      const t0 = now + dt;
      return D.faceTo(c, val(`${o}.x`, t0), val(`${o}.z`, t0), dur, dt);
    },
    move(c, x, z, dur, dt = 0, opts = {}) {
      const t0 = now + dt;
      const cx = val(`${c}.x`, t0), cz = val(`${c}.z`, t0);
      if (opts.face !== false && (Math.abs(x - cx) + Math.abs(z - cz)) > 0.05) D.faceTo(c, x, z, Math.min(0.3, dur * 0.4), dt);
      const ease = opts.ease ?? 'linear';
      // gentle start/stop for walks
      D.anim(`${c}.x`, x, dur, dt, ease);
      D.anim(`${c}.z`, z, dur, dt, ease);
      if (opts.y != null) D.anim(`${c}.y`, opts.y, dur, dt, ease);
      return D;
    },
    // walk along a list of points at a given speed (m/s); returns end time offset
    path(c, pts, speed, dt = 0, opts = {}) {
      let t = dt;
      let px = val(`${c}.x`, now + dt), pz = val(`${c}.z`, now + dt);
      for (const p of pts) {
        const d = Math.hypot(p[0] - px, p[1] - pz);
        const dur = Math.max(0.05, d / speed);
        D.move(c, p[0], p[1], dur, t, { ...opts, y: p[2] });
        t += dur; px = p[0]; pz = p[1];
      }
      return t - dt;
    },
    look(c, yaw, nod = 0, dur = 0.4, dt = 0) { D.anim(`${c}.hy`, yaw, dur, dt); D.anim(`${c}.hn`, nod, dur, dt); return D; },
    // ---- dialogue: adds caption and advances time
    say(who, text, opts = {}) {
      const dur = opts.dur ?? readTime(text);
      const t0 = now + (opts.dt ?? 0);
      if (opts.cam) D.cam(opts.cam, opts.dt ?? 0);
      if (opts.expr) D.expr(who, opts.expr, opts.dt ?? 0);
      if (opts.act) D.act(who, opts.act, opts.dt ?? 0);
      T.captions.push({ t0, t1: t0 + dur, who, label: opts.label, text, loud: /[A-Z]{3,}/.test(text) && text === text.toUpperCase() });
      if (opts.hold !== false) now = t0 + dur + (opts.gap ?? 0.2);
      return D;
    },
    // caption for a sound (accessibility: [SOUND] style)
    sound(text, dur = 1.6, dt = 0) { T.captions.push({ t0: now + dt, t1: now + dt + dur, who: null, text, sound: true }); return D; },
    // ---- camera
    cam(spec, dt = 0) { T.shots.push({ t0: now + dt, ...spec }); T.shots.sort((a, b) => a.t0 - b.t0); return D; },
    shake(amp, dur = 0.6, dt = 0) { D.set('shake', amp, dt); D.anim('shake', 0, dur, dt, 'out'); return D; },
    // ---- audio + fx
    sfx(name, dt = 0, vol = 1, extra = {}) { T.sfx.push({ t: now + dt, name, vol, ...extra }); return D; },
    music(name, vol = 0.5, dt = 0, fade = 1) { T.music.push({ t: now + dt, name, vol, fade }); return D; },
    fx(kind, opts = {}, dt = 0) { T.fx.push({ t: now + dt, kind, ...opts }); return D; },
    comic(text, dt = 0, dur = 1.2, opts = {}) { T.comics.push({ t0: now + dt, t1: now + dt + dur, text, ...opts }); return D; },
    card(kind, dur, opts = {}) { T.cards.push({ t0: now, t1: now + dur, kind, ...opts }); return D; },
    location(set, opts = {}) { T.sets.push({ t0: now, set, ...opts }); T.sets.sort((a, b) => a.t0 - b.t0); return D; },
    scene(name) { T.scenes.push({ t0: now, name }); return D; },
    end() { T.duration = now; return T; },
  };
  return D;
}

// Precompute walk/run phase per character so legs move in step with travel distance.
export function buildGaitTables(T, chars, dt = 1 / 48) {
  const tables = {};
  for (const c of chars) {
    const xs = T.tracks[`${c}.x`], zs = T.tracks[`${c}.z`];
    const n = Math.ceil(T.duration / dt) + 2;
    const phase = new Float32Array(n), speed = new Float32Array(n);
    let ph = 0, px = evalTrack(xs, 0) ?? 0, pz = evalTrack(zs, 0) ?? 0;
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const x = evalTrack(xs, t) ?? 0, z = evalTrack(zs, t) ?? 0;
      const d = Math.hypot(x - px, z - pz);
      const v = d / dt;
      const sp = v > 12 ? 0 : v; // teleports are not movement
      const stride = 1.25 + Math.min(1, Math.max(0, (sp - 1.6) / 2)) * 1.5;
      if (sp > 0) ph += (d / stride) * Math.PI * 2;
      phase[i] = ph; speed[i] = sp;
      px = x; pz = z;
    }
    // smooth speed a little
    const sm = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0, w = 0;
      for (let j = -3; j <= 3; j++) { const k = i + j; if (k >= 0 && k < n) { s += speed[k]; w++; } }
      sm[i] = s / w;
    }
    tables[c] = { phase, speed: sm, dt };
  }
  return tables;
}

export function gaitAt(tab, t) {
  const i = Math.min(tab.phase.length - 1, Math.max(0, Math.round(t / tab.dt)));
  return { phase: tab.phase[i], speed: tab.speed[i] };
}
