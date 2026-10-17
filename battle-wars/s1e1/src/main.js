// Episode renderer: builds the world once, then draws any time t on request.
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { buildHero, buildWaterGuy, CAST, ACTIONS, EXPRESSIONS, pose, blendPose, locomotion, attachProp } from './characters.js';
import { buildCity, buildCoffee, buildHQExterior, buildLiving, buildControl, buildTitle } from './sets.js';
import { buildFX } from './fx.js';
import { evalTrack, evalStep, buildGaitTables, gaitAt } from './director.js';
import { drawOverlay } from './overlay.js';
import { clamp, lerp, smoothstep, noise1, mk, mat } from './util.js';
import { buildEpisode } from './episode.js';

const P = Math.PI;
const LEG_KEYS = ['y', 'lean', 'lLF', 'lLO', 'kL', 'fL', 'lRF', 'lRO', 'kR', 'fR'];

export async function createEpisode(canvasW = 1280, canvasH = 720) {
  await document.fonts.load('40px Bangers');
  await document.fonts.load('bold 40px "Inter Display"').catch(() => {});
  const T = buildEpisode();

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(canvasW, canvasH);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const out = document.createElement('canvas');
  out.width = canvasW; out.height = canvasH;
  const octx = out.getContext('2d');

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe4f5, 40, 140);
  const camera = new THREE.PerspectiveCamera(40, canvasW / canvasH, 0.05, 400);

  const font = await new Promise((res) => new FontLoader().load('/node_modules/three/examples/fonts/helvetiker_bold.typeface.json', res));
  const fxRoot = new THREE.Group();
  scene.add(fxRoot);
  const fx = buildFX(fxRoot);
  const SETS = {
    city: buildCity(fx), coffee: buildCoffee(), hqExt: buildHQExterior(), living: buildLiving(), control: buildControl(), title: buildTitle(font, TextGeometry),
    black: { name: 'black', group: new THREE.Group(), bg: new THREE.Color(0x000000), update() {} },
  };
  for (const s of Object.values(SETS)) { s.group.visible = false; scene.add(s.group); }

  // cast
  const heroes = {};
  for (const n of ['aaron', 'flare', 'eric', 'barista']) { heroes[n] = buildHero(CAST[n]); scene.add(heroes[n].root); }
  const water = buildWaterGuy();
  scene.add(water.root);
  // hand props
  const ctrlHeld = new THREE.Group(); mk(new THREE.BoxGeometry(0.2, 0.05, 0.11), mat(0x222831), ctrlHeld);
  attachProp(heroes.eric, 'R', ctrlHeld, [0.07, -0.09, 0.05], [0, 0, 0.3]);
  const cupHeld = new THREE.Group();
  mk(new THREE.CylinderGeometry(0.06, 0.045, 0.16, 14), mat(0xffffff, { r: 0.4 }), cupHeld, [0, 0, 0]);
  mk(new THREE.CylinderGeometry(0.062, 0.062, 0.05, 14), mat(0x8a5a32), cupHeld, [0, 0.01, 0]);
  attachProp(heroes.flare, 'R', cupHeld, [0, -0.08, 0.06], [P / 2, 0, 0]);
  const billHeld = mk(new THREE.PlaneGeometry(0.16, 0.08), mat(0x7fc77f, { side: THREE.DoubleSide }), null);
  attachProp(heroes.flare, 'L', billHeld, [0, -0.09, 0.05], [0, P / 2, 0]);
  const device = new THREE.Group(); mk(new THREE.BoxGeometry(0.12, 0.22, 0.1), mat(0xffcc1a), device); mk(new THREE.BoxGeometry(0.13, 0.05, 0.11), mat(0x1a1a1a), device, [0, 0.05, 0]);
  attachProp(heroes.eric, 'R', device, [0, -0.1, 0.06], [0, 0, 0]);
  const slices = {};
  const sliceGeo = new THREE.CircleGeometry(0.14, 3, -P / 6 + P / 2, P / 3);
  for (const n of ['aaron', 'flare', 'eric']) {
    const m = mk(sliceGeo, mat(0xe0602a, { side: THREE.DoubleSide }), null);
    slices[n] = attachProp(heroes[n], 'R', m, [0, -0.12, 0.08], [0.4, 0, 0]);
  }

  const gait = buildGaitTables(T, ['aaron', 'flare', 'eric', 'barista', 'water']);
  const val = (name, d = 0) => { const v = evalTrack(T.tracks[name], curT); return v === undefined ? d : v; };
  let curT = 0;
  const X = { T, scene, val: (n, d = 0) => val(n, d) };

  function talkAmount(who, t) {
    for (const c of T.captions) {
      if (c.who === who && t >= c.t0 && t < c.t1 - 0.12) {
        const seed = who.length * 3.1;
        const base = 0.22 + 0.4 * Math.abs(noise1(t * 7 + seed));
        const syl = 0.55 + 0.45 * Math.abs(Math.sin(t * 13 + seed));
        return base * syl * (c.loud ? 1.35 : 1);
      }
    }
    return 0;
  }

  function updateHero(name, t) {
    const h = heroes[name];
    const vis = val(`${name}.vis`, 0) > 0.5;
    h.root.visible = vis;
    if (!vis) return;
    h.root.position.set(val(`${name}.x`), val(`${name}.y`), val(`${name}.z`));
    h.root.rotation.y = val(`${name}.ry`);
    const st = evalStep(T.tracks[`${name}.act`], t);
    const cur = ACTIONS[st.v] ?? ACTIONS.idle, prev = ACTIONS[st.prev] ?? ACTIONS.idle;
    const ctx = { seed: h.seed };
    let p = pose(cur.f(st.since, t, ctx));
    const w = smoothstep(0, 0.28, st.since);
    if (w < 1) p = blendPose(pose(prev.f(st.since + 2, t, ctx)), p, w);
    const g = gaitAt(gait[name], t);
    const moveW = cur.sit ? 0 : smoothstep(0.12, 0.6, g.speed);
    if (moveW > 0) {
      const loco = locomotion(g.phase, smoothstep(1.9, 3.4, g.speed));
      if (cur.upper) { for (const k of LEG_KEYS) p[k] = lerp(p[k], loco[k], moveW); }
      else p = blendPose(p, loco, moveW);
    }
    const talk = talkAmount(name, t);
    if (talk > 0 && (cur.gest) && moveW < 0.5) {
      const n1 = noise1(t * 1.3 + h.seed * 5), n2 = noise1(t * 1.1 + h.seed * 9);
      p.aRF += 0.35 + 0.25 * n1; p.eR += 0.7 + 0.35 * n2; p.aRT += 0.3;
      p.aLF += 0.12 * n2; p.eL += 0.25 * Math.max(0, n1);
      p.hdN += 0.04 * Math.sin(t * 6.5); p.hdT += 0.06 * n1;
    }
    p.hdY += val(`${name}.hy`); p.hdN += val(`${name}.hn`);
    h.applyPose(p);
    const es = evalStep(T.tracks[`${name}.expr`], t);
    const e0 = EXPRESSIONS[es.prev] ?? EXPRESSIONS.neutral, e1 = EXPRESSIONS[es.v] ?? EXPRESSIONS.neutral;
    const ew = smoothstep(0, 0.25, es.since);
    const e = {}; for (const k in e1) e[k] = e0[k] + (e1[k] - e0[k]) * ew;
    const bp = (t + h.seed * 1.37) % 3.9;
    const blink = bp < 0.14 ? Math.sin((bp / 0.14) * P) : 0;
    h.applyFace(e, talk, blink, { x: val(`${name}.lookX`), y: val(`${name}.lookY`) });
  }

  // Water Guy "actions" produce arm targets etc.
  function updateWater(t) {
    const vis = val('water.vis', 0) > 0.5;
    water.root.visible = vis;
    if (!vis) return;
    water.root.position.set(val('water.x'), val('water.y'), val('water.z'));
    water.root.rotation.y = val('water.ry');
    const st = evalStep(T.tracks['water.act'], t);
    const a = st.since;
    const W = (act) => {
      const s = { armL: [0.85, 1.05 + 0.1 * Math.sin(t * 2), 0.35], armR: [-0.85, 1.05 + 0.1 * Math.sin(t * 2.2), 0.35], big: 1, lean: 0, headTilt: 0, stretch: 1, open: 0 };
      switch (act) {
        case 'raise': s.armL = [1.1, 2.7 + 0.15 * Math.sin(t * 6), 0.3]; s.armR = [-1.1, 2.7 + 0.15 * Math.sin(t * 6 + 1), 0.3]; s.stretch = 1.05; break;
        case 'laugh': s.armL = [0.5, 0.95, 0.6]; s.armR = [-0.5, 0.95, 0.6]; s.headTilt = 0.1 * Math.sin(t * 14); s.stretch = 1 + 0.04 * Math.sin(t * 14); s.open = 0.5; break;
        case 'throwR': { const k = (a % 1.1) / 1.1; const f = smoothstep(0.3, 0.55, k); s.armR = [lerp(-0.9, -0.5, f), lerp(2.0, 1.4, f), lerp(-0.6, 1.9, f)]; s.lean = 0.15 * f; break; }
        case 'throwL': { const k = (a % 1.1) / 1.1; const f = smoothstep(0.3, 0.55, k); s.armL = [lerp(0.9, 0.5, f), lerp(2.0, 1.4, f), lerp(-0.6, 1.9, f)]; s.lean = 0.15 * f; break; }
        case 'push': { const f = smoothstep(0.1, 0.45, a); s.armL = [0.7, 1.4, lerp(0.3, 1.8, f)]; s.armR = [-0.7, 1.4, lerp(0.3, 1.8, f)]; s.lean = 0.2 * f; s.big = 1.3; s.bigL = 1.3; break; }
        case 'bigArm': {
          const up = smoothstep(0, 0.9, a), slam = smoothstep(1.6, 1.85, a);
          s.big = 1 + 1.6 * up; s.armR = [lerp(-1.0, -0.6, slam), lerp(lerp(1.1, 3.6, up), 0.35, slam), lerp(0.2, 2.6, slam)];
          s.lean = 0.25 * slam - 0.1 * up * (1 - slam); s.open = 0.3; break;
        }
        case 'reach': { const f = smoothstep(0, 0.6, a); s.armR = [lerp(-0.85, -0.4, f), lerp(1.05, 1.3, f), lerp(0.35, val('water.reach', 4), f)]; s.lean = 0.15 * f; break; }
        case 'shocked': s.armL = [0.6, 2.0, 0.5]; s.armR = [-0.6, 2.0, 0.5]; s.stretch = 1.05; s.open = 0.6; break;
        case 'tiny': { s.armL = [0.8, 1.6 + 0.4 * Math.sin(a * 9), 0.4]; s.armR = [-0.8, 1.6 + 0.4 * Math.sin(a * 9 + 2), 0.4]; break; }
        case 'flail': { s.armL = [1.0, 1.4 + 0.6 * Math.sin(a * 14), 0.4]; s.armR = [-1.0, 1.4 + 0.6 * Math.sin(a * 14 + 2), 0.4]; s.headTilt = 0.15 * Math.sin(a * 10); break; }
        case 'slide': s.armL = [1.0, 1.7, -0.2]; s.armR = [-1.0, 1.7, -0.2]; s.lean = -0.25; s.headTilt = 0.2; break;
        case 'bonk': { const k = 1 - smoothstep(0, 0.8, a); s.lean = -0.3 * k; s.headTilt = 0.4 * Math.sin(a * 20) * k; s.stretch = 1 - 0.15 * k; break; }
        case 'dramatic': { const f = smoothstep(0, 0.5, a); s.armL = [1.0, lerp(1.0, 2.4, f), 0.5]; s.armR = [-0.8, lerp(1.0, 1.9, f), 0.8]; s.stretch = 1 + 0.1 * f; s.headNod = -0.15 * f; break; }
        case 'turn': s.armL = [0.9, 1.3, 0.6]; s.armR = [-0.9, 1.3, 0.6]; break;
      }
      return s;
    };
    let s = W(st.v);
    const w = smoothstep(0, 0.3, st.since);
    if (w < 1) {
      const sp = W(st.prev);
      const L = (a1, b1) => a1.map((x, i) => lerp(x, b1[i], w));
      s = { ...s, armL: L(sp.armL, s.armL), armR: L(sp.armR, s.armR), big: lerp(sp.big, s.big, w), lean: lerp(sp.lean, s.lean, w), stretch: lerp(sp.stretch, s.stretch, w) };
    }
    const talk = talkAmount('water', t) * 1.2;
    water.update({ t, scale: val('water.scale', 1), ...s, stretch: s.stretch * val('water.stretch', 1), expr: evalStep(T.tracks['water.expr'], t).v ?? 'mischief', talk, puddle: val('water.puddle', 1), tilt: val('water.tilt', 0) });
  }

  const tmpV = new THREE.Vector3();
  function headPos(name) {
    if (name === 'water') {
      const s = val('water.scale', 1);
      return tmpV.set(val('water.x'), val('water.y') + 1.95 * s * val('water.stretch', 1), val('water.z')).clone();
    }
    heroes[name].J.head.getWorldPosition(tmpV);
    return tmpV.clone().add(new THREE.Vector3(0, 0.12, 0));
  }

  function updateCamera(t) {
    let i = -1;
    for (let k = 0; k < T.shots.length; k++) { if (T.shots[k].t0 <= t) i = k; else break; }
    const s = T.shots[Math.max(0, i)];
    const next = T.shots[i + 1];
    const dur = (next ? next.t0 : T.duration) - s.t0;
    const kRaw = clamp((t - s.t0) / Math.max(0.01, dur));
    const k = s.ease === 'linear' ? kRaw : smoothstep(0, 1, kRaw);
    let pos, look;
    if (s.type === 'frame') {
      const c = new THREE.Vector3();
      for (const n of s.on) c.add(headPos(n));
      c.multiplyScalar(1 / s.on.length);
      c.y += s.lookY ?? -0.1;
      if (s.offset) { c.x += s.offset[0]; c.y += s.offset[1]; c.z += s.offset[2]; }
      let yaw = (s.yaw ?? 0) * P / 180;
      if (s.rel) yaw += val(`${s.rel}.ry`);
      yaw += ((s.orbit ?? 0) * P / 180) * (t - s.t0);
      if (s.yaw2 != null) yaw = lerp(yaw, s.yaw2 * P / 180 + (s.rel ? val(`${s.rel}.ry`) : 0), k);
      const dist = lerp(s.dist ?? 4, s.dist2 ?? s.dist ?? 4, k);
      const hh = lerp(s.h ?? 0.2, s.h2 ?? s.h ?? 0.2, k);
      pos = new THREE.Vector3(c.x + Math.sin(yaw) * dist, c.y + hh, c.z + Math.cos(yaw) * dist);
      look = c;
    } else {
      pos = new THREE.Vector3(...s.pos);
      look = new THREE.Vector3(...s.look);
      if (s.pos2) pos.lerp(new THREE.Vector3(...s.pos2), k);
      if (s.look2) look.lerp(new THREE.Vector3(...s.look2), k);
    }
    const hand = (s.hand ?? 1) * 0.012;
    const sh = val('shake', 0);
    pos.x += noise1(t * 0.9 + 3) * hand + noise1(t * 31) * sh * 0.25;
    pos.y += noise1(t * 0.8 + 9) * hand + noise1(t * 29 + 4) * sh * 0.25;
    look.x += noise1(t * 0.7 + 1) * hand;
    camera.position.copy(pos);
    camera.lookAt(look);
    camera.fov = lerp(s.fov ?? 40, s.fov2 ?? s.fov ?? 40, k);
    camera.updateProjectionMatrix();
  }

  let activeSet = null;
  function frame(t) {
    curT = t;
    let setEntry = T.sets[0];
    for (const s of T.sets) if (s.t0 <= t) setEntry = s;
    const set = SETS[setEntry.set];
    if (activeSet !== set) {
      if (activeSet) activeSet.group.visible = false;
      set.group.visible = true;
      activeSet = set;
      scene.background = set.bg;
      if (set.fog) { scene.fog.color.set(set.fog[0]); scene.fog.near = set.fog[1]; scene.fog.far = set.fog[2]; }
      else { scene.fog.near = 500; scene.fog.far = 1000; }
      renderer.toneMappingExposure = set.exposure ?? 1;
    }
    set.update(t, X);
    for (const n of Object.keys(heroes)) updateHero(n, t);
    updateWater(t);
    fxRoot.visible = setEntry.set === 'city' || setEntry.set === 'coffee';
    if (fxRoot.visible) fx.update(t, X);
    // hand props
    ctrlHeld.visible = val('ctrl.held', 0) > 0.5;
    cupHeld.visible = val('cup.held', 0) > 0.5;
    billHeld.visible = val('bill.held', 0) > 0.5;
    device.visible = val('device', 0) > 0.5;
    for (const n in slices) slices[n].visible = val(`${n}.slice`, 0) > 0.5;
    scene.updateMatrixWorld(true);
    updateCamera(t);
    renderer.render(scene, camera);
    octx.drawImage(renderer.domElement, 0, 0);
    drawOverlay(octx, canvasW, canvasH, t, T, X.val);
    return out;
  }

  return { T, frame, canvas: out, renderer };
}
