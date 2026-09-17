// T10 World - the creature sandbox. Twenty fictional species plus anything you
// design yourself, each one a body plan, a way of moving, a voice and a brain.
//
// Nothing here is an asset. A species is a row of numbers; `buildBody` reads
// those numbers and lofts a body out of boxes, cones and spheres, so a new
// creature costs one line in the bestiary and nothing on disk.
import * as THREE from '../../vendor/three.module.js';
import { GeometryBatcher, boxUV, transformed, disposeGroup } from '../world/geomutils.js';
import { paintedMaterial, emissiveMaterial } from '../world/materials.js';
import { clamp01, clampv, lerpv, damp, dampAngle, makeRng, TAU } from '../core/math.js';
import { settings, perf } from '../core/settings.js';
import { audio } from '../core/audio.js';

// -----------------------------------------------------------------------------
// The bestiary
// -----------------------------------------------------------------------------
// build:  height   overall height in metres
//         bulk     how wide and deep the torso is, relative to height
//         legs     2 or 4, or 0 for something that never touches the ground
//         arms     0 or 2 (a pair of forelimbs that reach)
//         hunch    0 = upright, 1 = folded right over
//         head     'jaw' | 'eyeless' | 'crest' | 'maw' | 'horned' | 'smooth' | 'split'
//         eyes     how many, and what colour they burn
//         spikes   a count along the spine
//         wings    membrane pair
//         tail     'lash' | 'heavy' | null
// move:   'walk' | 'lope' | 'crawl' | 'hop' | 'hover' | 'slither' | 'stalk'
// stats:  speed (cruise), chase (top), health, damage (seconds you're floored),
//         sight, jump
// powers: what it can do beyond walking into you
// voice:  [sound, pitch]
// mood:   'hostile' (hunts anyone) | 'feral' (hunts, but scared of crowds)
//         'skittish' (runs) | 'loyal' (only follows whoever summoned it)
export const CREATURES = {
  // ---- abnormal zombies ----------------------------------------------------
  shambler: {
    name: 'Shambler', family: 'zombie', blurb: 'The ordinary kind. Slow, patient, endless.',
    build: { height: 1.78, bulk: 0.30, legs: 2, arms: 2, hunch: 0.35, head: 'jaw', eyes: 2, eyeColor: 0xd4ff5a, skin: 0x7fa85e, spikes: 0 },
    move: 'walk', stats: { speed: 1.5, chase: 2.6, health: 60, damage: 4, sight: 34, jump: 0 },
    powers: [], voice: ['groan', 1.0], mood: 'hostile',
  },
  runner: {
    name: 'Runner', family: 'zombie', blurb: 'Fresh, fast and completely unbothered by fences.',
    build: { height: 1.74, bulk: 0.24, legs: 2, arms: 2, hunch: 0.55, head: 'jaw', eyes: 2, eyeColor: 0xffe35a, skin: 0x93b45f, spikes: 0 },
    move: 'lope', stats: { speed: 3.0, chase: 7.4, health: 40, damage: 3.5, sight: 48, jump: 1 },
    powers: ['pounce'], voice: ['screech', 1.25], mood: 'hostile',
  },
  brute: {
    name: 'Brute', family: 'zombie', blurb: 'Three metres of shoulders. Walks through walls of people.',
    build: { height: 2.85, bulk: 0.52, legs: 2, arms: 2, hunch: 0.42, head: 'maw', eyes: 2, eyeColor: 0xff7a3c, skin: 0x6e8a4e, spikes: 5 },
    move: 'walk', stats: { speed: 1.6, chase: 5.6, health: 320, damage: 7, sight: 40, jump: 0 },
    powers: ['charge', 'shockwave'], voice: ['roar', 0.72], mood: 'hostile',
  },
  crawler: {
    name: 'Crawler', family: 'zombie', blurb: 'Stays below knee height until it doesn\'t.',
    build: { height: 0.85, bulk: 0.34, legs: 4, arms: 0, hunch: 0.95, head: 'jaw', eyes: 4, eyeColor: 0xd4ff5a, skin: 0x86a05c, spikes: 3 },
    move: 'crawl', stats: { speed: 2.4, chase: 6.2, health: 45, damage: 3, sight: 30, jump: 1 },
    powers: ['pounce'], voice: ['chitter', 1.4], mood: 'hostile',
  },
  screamer: {
    name: 'Screamer', family: 'zombie', blurb: 'Does no damage. Brings everything that does.',
    build: { height: 1.62, bulk: 0.22, legs: 2, arms: 2, hunch: 0.15, head: 'split', eyes: 0, eyeColor: 0xfff27a, skin: 0xa8bf78, spikes: 0 },
    move: 'walk', stats: { speed: 1.9, chase: 3.8, health: 35, damage: 1.5, sight: 55, jump: 0 },
    powers: ['screech'], voice: ['screech', 1.0], mood: 'feral',
  },
  spitter: {
    name: 'Spitter', family: 'zombie', blurb: 'Hangs back and throws something you don\'t want on you.',
    build: { height: 1.70, bulk: 0.27, legs: 2, arms: 2, hunch: 0.5, head: 'maw', eyes: 3, eyeColor: 0x9dff5a, skin: 0x5f8f52, spikes: 2 },
    move: 'stalk', stats: { speed: 1.7, chase: 3.4, health: 55, damage: 3, sight: 46, jump: 0 },
    powers: ['spit'], voice: ['hiss', 1.1], mood: 'hostile',
  },
  bloater: {
    name: 'Bloater', family: 'zombie', blurb: 'Swollen with gas. Leaves a cloud where it falls.',
    build: { height: 1.95, bulk: 0.62, legs: 2, arms: 2, hunch: 0.25, head: 'eyeless', eyes: 0, eyeColor: 0x9dff5a, skin: 0x8fa04a, spikes: 0 },
    move: 'walk', stats: { speed: 1.1, chase: 1.9, health: 140, damage: 5, sight: 26, jump: 0 },
    powers: ['cloud'], voice: ['groan', 0.78], mood: 'hostile',
  },
  stalker: {
    name: 'Stalker', family: 'zombie', blurb: 'You see it once, then you don\'t, then it is behind you.',
    build: { height: 1.80, bulk: 0.22, legs: 2, arms: 2, hunch: 0.65, head: 'eyeless', eyes: 2, eyeColor: 0xbf5aff, skin: 0x4d5f47, spikes: 0 },
    move: 'stalk', stats: { speed: 2.2, chase: 6.4, health: 70, damage: 5, sight: 60, jump: 1 },
    powers: ['cloak', 'pounce'], voice: ['hiss', 0.9], mood: 'hostile',
  },

  // ---- mutation zombies ----------------------------------------------------
  tendril: {
    name: 'Tendril', family: 'mutation', blurb: 'Arms long enough to reach across the street.',
    build: { height: 2.10, bulk: 0.24, legs: 2, arms: 2, armLen: 2.3, hunch: 0.45, head: 'split', eyes: 6, eyeColor: 0xff5ad0, skin: 0x7d5a8f, spikes: 4 },
    move: 'walk', stats: { speed: 1.8, chase: 4.2, health: 110, damage: 5, sight: 52, jump: 0 },
    powers: ['drag'], voice: ['groan', 0.9], mood: 'hostile',
  },
  carrier: {
    name: 'Carrier', family: 'mutation', blurb: 'Carries its own little ones, and keeps putting them down.',
    build: { height: 2.00, bulk: 0.46, legs: 2, arms: 2, hunch: 0.35, head: 'crest', eyes: 4, eyeColor: 0xff8f5a, skin: 0x8a6a8f, spikes: 7 },
    move: 'walk', stats: { speed: 1.4, chase: 3.0, health: 180, damage: 4, sight: 44, jump: 0 },
    powers: ['brood'], voice: ['groan', 0.8], mood: 'hostile',
  },
  splitter: {
    name: 'Splitter', family: 'mutation', blurb: 'Put it down and you have two problems.',
    build: { height: 1.66, bulk: 0.38, legs: 2, arms: 2, hunch: 0.4, head: 'split', eyes: 2, eyeColor: 0x5affd0, skin: 0x59836f, spikes: 0 },
    move: 'walk', stats: { speed: 2.0, chase: 4.4, health: 90, damage: 4, sight: 40, jump: 0 },
    powers: ['split'], voice: ['chitter', 0.95], mood: 'hostile',
  },
  hive: {
    name: 'Hive', family: 'mutation', blurb: 'Tall, still, and rebuilding itself the whole time.',
    build: { height: 3.20, bulk: 0.44, legs: 2, arms: 2, armLen: 1.5, hunch: 0.2, head: 'crest', eyes: 8, eyeColor: 0xd45aff, skin: 0x6a4f7d, spikes: 9 },
    move: 'stalk', stats: { speed: 1.2, chase: 3.0, health: 420, damage: 6, sight: 60, jump: 0 },
    powers: ['brood', 'regen', 'screech'], voice: ['rumble', 0.9], mood: 'hostile',
  },

  // ---- other fictional monsters -------------------------------------------
  gargoyle: {
    name: 'Gargoyle', family: 'monster', blurb: 'Sits on a cornice until something walks under it.',
    build: { height: 1.90, bulk: 0.34, legs: 2, arms: 2, hunch: 0.6, head: 'horned', eyes: 2, eyeColor: 0xffb45a, skin: 0x6f6e6a, spikes: 4, wings: true },
    move: 'hover', stats: { speed: 3.4, chase: 8.0, health: 150, damage: 5, sight: 70, jump: 2 },
    powers: ['dive'], voice: ['screech', 0.85], mood: 'hostile',
  },
  golem: {
    name: 'Golem', family: 'monster', blurb: 'Pavement that stood up. Nothing you own will stop it.',
    build: { height: 3.40, bulk: 0.68, legs: 2, arms: 2, hunch: 0.15, head: 'smooth', eyes: 2, eyeColor: 0x5ad6ff, skin: 0x595c60, spikes: 0 },
    move: 'walk', stats: { speed: 1.3, chase: 3.6, health: 600, damage: 8, sight: 42, jump: 0 },
    powers: ['shockwave', 'charge'], voice: ['rumble', 0.7], mood: 'hostile',
  },
  wisp: {
    name: 'Wisp', family: 'monster', blurb: 'A light that follows you and takes something each time.',
    build: { height: 0.80, bulk: 0.40, legs: 0, arms: 0, hunch: 0, head: 'smooth', eyes: 1, eyeColor: 0x8fe8ff, skin: 0x9fd8ff, spikes: 0, glow: true },
    move: 'hover', stats: { speed: 2.6, chase: 5.4, health: 40, damage: 2, sight: 60, jump: 0 },
    powers: ['drain', 'cloak'], voice: ['chime', 1.2], mood: 'feral',
  },
  hopper: {
    name: 'Hopper', family: 'monster', blurb: 'All legs. Crosses a block in four jumps.',
    build: { height: 1.55, bulk: 0.26, legs: 2, arms: 0, legLen: 1.6, hunch: 0.5, head: 'eyeless', eyes: 4, eyeColor: 0x6dffc8, skin: 0x4f7d63, spikes: 2 },
    move: 'hop', stats: { speed: 2.8, chase: 7.0, health: 60, damage: 3, sight: 44, jump: 3 },
    powers: ['leap'], voice: ['chitter', 1.15], mood: 'feral',
  },
  lurker: {
    name: 'Lurker', family: 'monster', blurb: 'Goes under the street and comes up somewhere else.',
    build: { height: 0.70, bulk: 0.42, legs: 0, arms: 0, hunch: 1, head: 'maw', eyes: 6, eyeColor: 0xff5a5a, skin: 0x4a4038, spikes: 6, tail: 'heavy', long: 3.2 },
    move: 'slither', stats: { speed: 2.4, chase: 6.6, health: 120, damage: 5, sight: 38, jump: 0 },
    powers: ['burrow'], voice: ['hiss', 0.7], mood: 'hostile',
  },
  chimera: {
    name: 'Chimera', family: 'monster', blurb: 'Two heads, four legs, one very bad temper.',
    build: { height: 1.60, bulk: 0.44, legs: 4, arms: 0, hunch: 0.85, head: 'split', heads: 2, eyes: 4, eyeColor: 0xffd45a, skin: 0x8a5f3a, spikes: 5, tail: 'lash' },
    move: 'lope', stats: { speed: 3.2, chase: 9.0, health: 200, damage: 6, sight: 58, jump: 2 },
    powers: ['pounce', 'charge'], voice: ['roar', 1.05], mood: 'hostile',
  },
  shade: {
    name: 'Shade', family: 'monster', blurb: 'Barely there. Takes the warmth out of a street.',
    build: { height: 2.20, bulk: 0.28, legs: 0, arms: 2, armLen: 1.6, hunch: 0.2, head: 'eyeless', eyes: 2, eyeColor: 0xbf5aff, skin: 0x1f1b28, spikes: 0, ghost: true },
    move: 'hover', stats: { speed: 2.0, chase: 4.6, health: 90, damage: 4, sight: 65, jump: 0 },
    powers: ['cloak', 'drain'], voice: ['hiss', 0.65], mood: 'hostile',
  },
  leviathan: {
    name: 'Leviathan', family: 'monster', blurb: 'The one you do not summon indoors.',
    build: { height: 4.60, bulk: 0.62, legs: 4, arms: 0, hunch: 0.7, head: 'horned', eyes: 2, eyeColor: 0xff5a3c, skin: 0x3f4f5a, spikes: 12, tail: 'heavy', long: 2.4 },
    move: 'walk', stats: { speed: 1.9, chase: 6.0, health: 900, damage: 9, sight: 70, jump: 0 },
    powers: ['shockwave', 'charge', 'roar'], voice: ['roar', 0.58], mood: 'hostile',
  },
  seraph: {
    name: 'Seraph', family: 'monster', blurb: 'Six wings, no face, and an opinion about you.',
    build: { height: 2.60, bulk: 0.26, legs: 0, arms: 2, hunch: 0, head: 'smooth', eyes: 8, eyeColor: 0xfff5c8, skin: 0xe8e2d0, spikes: 0, wings: true, wingPairs: 3, glow: true },
    move: 'hover', stats: { speed: 3.0, chase: 7.2, health: 260, damage: 6, sight: 80, jump: 0 },
    powers: ['dive', 'shockwave'], voice: ['chime', 0.8], mood: 'hostile',
  },
};

export const CREATURE_IDS = Object.keys(CREATURES);
export const CREATURE_FAMILIES = { zombie: 'Abnormal zombies', mutation: 'Mutation zombies', monster: 'Monsters', custom: 'Your own' };

/** Ability cooldowns, in seconds. */
const ABILITY_COOLDOWN = {
  pounce: 4.5, charge: 7, shockwave: 9, screech: 12, spit: 3.2, cloak: 14,
  split: 0, brood: 11, regen: 0, drag: 5, dive: 6, leap: 3.4, burrow: 13,
  drain: 5, cloud: 0, roar: 16,
};

// -----------------------------------------------------------------------------
// Bodies
// -----------------------------------------------------------------------------
/**
 * Loft a body from the build numbers. Everything static goes into one batched
 * mesh; the parts that move (head, limbs, wings, tail) stay as small groups so
 * the animator has something to rotate.
 */
function buildBody(spec, rng) {
  const b = spec.build;
  const H = b.height;
  const W = H * b.bulk;
  const group = new THREE.Group();
  const batch = new GeometryBatcher();
  const skinRough = b.ghost ? 0.2 : 0.88;
  // World materials are cached and shared, so anything that fades in and out
  // (a cloaker, a ghost) needs its own copies — otherwise going invisible takes
  // half the city's paintwork with it.
  const ownMaterials = !!b.ghost || (spec.powers || []).indexOf('cloak') >= 0;
  const own = (m) => (ownMaterials ? m.clone() : m);
  const skin = own(paintedMaterial(b.skin, skinRough));
  const dark = own(paintedMaterial(0x1c1a18, 0.95));
  const eyeMat = own(emissiveMaterial(b.eyeColor || 0xd4ff5a, b.glow ? 2.6 : 1.5));
  const refs = { legs: [], arms: [], wings: [], heads: [], tail: null, eyes: [], body: null,
                 ownMaterials, materials: ownMaterials ? [skin, dark, eyeMat] : [] };

  const hunch = b.hunch || 0;
  const legLen = b.legs ? H * (b.legs === 4 ? 0.42 : 0.52) * (b.legLen || 1) : 0;
  const torsoH = H - legLen;
  const torsoY = legLen + torsoH * 0.5;
  const long = b.long || 1;

  // Torso. A four-legged or slithering body lies along its length instead of
  // standing up in it, which is the whole difference between a man and a dog.
  const lying = b.legs === 4 || spec.move === 'slither' || spec.move === 'crawl';
  // Where the head and the arms hang off. Everything else is built around
  // these two so no part of the body ends up floating next to another.
  const shoulderY = lying ? torsoY * 1.02 : legLen + torsoH * 0.88;
  const shoulderZ = lying ? H * 0.30 * long : 0;
  if (lying) {
    // A body that lies along its length: chest, barrel, haunches.
    batch.add(skin, transformed(boxUV(W * 1.55, torsoH * 0.76, H * 0.52 * long, 1, 1), 0, torsoY * 0.98, H * 0.16 * long, 0));
    batch.add(skin, transformed(boxUV(W * 1.35, torsoH * 0.64, H * 0.46 * long, 1, 1), 0, torsoY * 0.94, -H * 0.22 * long, 0));
    batch.add(skin, transformed(boxUV(W * 1.1, torsoH * 0.50, H * 0.26 * long, 1, 1), 0, torsoY * 0.90, -H * 0.46 * long, 0));
  } else {
    // Chest, waist and pelvis, each narrower than the last, and the pelvis
    // reaches down to where the legs start so the hips are never a gap.
    const chestH = torsoH * 0.40, waistH = torsoH * 0.26, pelvisH = torsoH * 0.30;
    const chestY = legLen + torsoH - chestH * 0.55;
    batch.add(skin, transformed(boxUV(W * 1.45, chestH, W * 1.0, 1, 1), 0, chestY, 0, 0));
    batch.add(skin, transformed(boxUV(W * 1.12, waistH, W * 0.8, 1, 1), 0, chestY - chestH * 0.5 - waistH * 0.45, 0, 0));
    batch.add(skin, transformed(boxUV(W * 1.3, pelvisH, W * 0.9, 1, 1), 0, legLen + pelvisH * 0.42, 0, 0));
    // Shoulders: one bar across the top that both arms hang from.
    batch.add(skin, transformed(boxUV(W * 1.8, torsoH * 0.18, W * 0.72, 1, 1), 0, shoulderY, 0, 0));
  }
  // A neck, so the head is attached to something.
  const neckH = lying ? H * 0.10 : torsoH * 0.14;
  batch.add(skin, transformed(boxUV(W * 0.44, neckH, W * 0.44, 1, 1),
    0, shoulderY + neckH * 0.45, shoulderZ + (lying ? H * 0.12 * long : W * 0.12), 0));

  // Spine spikes.
  for (let i = 0; i < (b.spikes || 0); i++) {
    const t = (i + 0.5) / (b.spikes || 1);
    const sp = transformed(
      new THREE.ConeGeometry(W * 0.13, H * lerpv(0.12, 0.22, rng()), 4),
      0,
      lying ? torsoY * 1.18 : legLen + torsoH * lerpv(0.35, 0.92, t),
      lying ? lerpv(H * 0.38 * long, -H * 0.42 * long, t) : -W * 0.5,
      0
    );
    batch.add(dark, sp);
  }

  // Heads, on a neck that can turn.
  const headCount = b.heads || 1;
  for (let hi = 0; hi < headCount; hi++) {
    const head = new THREE.Group();
    const side = headCount > 1 ? (hi === 0 ? -1 : 1) * W * 0.42 : 0;
    // On the neck, not hovering above it.
    head.position.set(side, shoulderY + neckH * 0.9 + W * 0.26,
      shoulderZ + (lying ? H * 0.26 * long : W * 0.16));
    const hb = new THREE.Mesh(new THREE.BoxGeometry(W * 0.54, W * 0.54, W * 0.66), skin);
    head.add(hb);
    if (b.head === 'jaw' || b.head === 'maw') {
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(W * 0.5, W * (b.head === 'maw' ? 0.32 : 0.18), W * 0.56), dark);
      jaw.position.set(0, -W * 0.28, W * 0.14);
      head.add(jaw);
      refs.jaw = refs.jaw || [];
      refs.jaw.push(jaw);
    } else if (b.head === 'horned') {
      for (const sx of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(W * 0.11, H * 0.24, 4), dark);
        horn.position.set(sx * W * 0.26, W * 0.42, 0);
        horn.rotation.z = sx * -0.5;
        head.add(horn);
      }
    } else if (b.head === 'crest') {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(W * 0.26, H * 0.28, 3), dark);
      crest.position.set(0, W * 0.44, -W * 0.08);
      head.add(crest);
    } else if (b.head === 'split') {
      for (const sx of [-1, 1]) {
        const half = new THREE.Mesh(new THREE.BoxGeometry(W * 0.26, W * 0.44, W * 0.54), skin);
        half.position.set(sx * W * 0.2, 0, W * 0.18);
        half.rotation.z = sx * 0.34;
        head.add(half);
      }
    }
    // Eyes, scattered but symmetric.
    const eyeCount = b.eyes || 0;
    for (let e = 0; e < eyeCount; e++) {
      const row = Math.floor(e / 2), sx = e % 2 === 0 ? -1 : 1;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(W * (eyeCount > 4 ? 0.055 : 0.085), 6, 5), eyeMat);
      eye.position.set(eyeCount === 1 ? 0 : sx * W * (0.13 + row * 0.065), W * (0.10 - row * 0.12), W * 0.32);
      head.add(eye);
      refs.eyes.push(eye);
    }
    group.add(head);
    refs.heads.push(head);
  }

  // Legs.
  const legPairs = b.legs === 4 ? [[-1, 1], [1, 1], [-1, -1], [1, -1]] : b.legs === 2 ? [[-1, 0], [1, 0]] : [];
  for (const [sx, sz] of legPairs) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * W * (b.legs === 4 ? 0.52 : 0.38), legLen + (lying ? 0 : torsoH * 0.06), sz * H * 0.30 * long);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(W * 0.26, legLen * 0.58, W * 0.26), skin);
    thigh.position.y = -legLen * 0.29;
    pivot.add(thigh);
    const shin = new THREE.Group();
    shin.position.y = -legLen * 0.58;
    const sm = new THREE.Mesh(new THREE.BoxGeometry(W * 0.21, legLen * 0.44, W * 0.21), skin);
    sm.position.y = -legLen * 0.22;
    shin.add(sm);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(W * 0.3, legLen * 0.10, W * 0.44), dark);
    foot.position.set(0, -legLen * 0.44, W * 0.12);
    shin.add(foot);
    pivot.add(shin);
    group.add(pivot);
    refs.legs.push({ pivot, shin, front: sz > 0, side: sx });
  }

  // Arms — always a two-segment reach, because everything interesting a
  // creature does with an arm happens at the elbow.
  if (b.arms) {
    const armLen = H * 0.46 * (b.armLen || 1);
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * W * 0.82, shoulderY, shoulderZ);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(W * 0.19, armLen * 0.52, W * 0.19), skin);
      upper.position.y = -armLen * 0.26;
      pivot.add(upper);
      const fore = new THREE.Group();
      fore.position.y = -armLen * 0.52;
      const fm = new THREE.Mesh(new THREE.BoxGeometry(W * 0.16, armLen * 0.48, W * 0.16), skin);
      fm.position.y = -armLen * 0.24;
      fore.add(fm);
      for (let c = 0; c < 3; c++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(W * 0.045, W * 0.28, 4), dark);
        claw.position.set((c - 1) * W * 0.08, -armLen * 0.5, 0);
        claw.rotation.x = Math.PI;
        fore.add(claw);
      }
      pivot.add(fore);
      group.add(pivot);
      refs.arms.push({ pivot, fore, side: sx });
    }
  }

  // Wings.
  if (b.wings) {
    const pairs = b.wingPairs || 1;
    for (let w = 0; w < pairs; w++) {
      for (const sx of [-1, 1]) {
        const wing = new THREE.Group();
        wing.position.set(sx * W * 0.6, shoulderY - torsoH * w * 0.18, shoulderZ - W * 0.28);
        // Three panels, each shorter than the last, so the membrane tapers to
        // a point instead of reading as one floating slab.
        const span = H * 0.86;
        for (let seg = 0; seg < 3; seg++) {
          const t = seg / 3;
          const len = span / 3;
          const depth = H * 0.40 * (1 - t * 0.55);
          const mem = new THREE.Mesh(new THREE.BoxGeometry(len, H * 0.012, depth), skin);
          mem.position.set(sx * (len * (seg + 0.5)), 0, -depth * 0.15);
          wing.add(mem);
        }
        // The leading edge: a spar you can see against the sky.
        const rib = new THREE.Mesh(new THREE.BoxGeometry(span, W * 0.09, W * 0.09), dark);
        rib.position.set(sx * span * 0.5, W * 0.02, H * 0.12);
        wing.add(rib);
        const claw = new THREE.Mesh(new THREE.ConeGeometry(W * 0.07, H * 0.16, 4), dark);
        claw.position.set(sx * span, 0, H * 0.12);
        claw.rotation.z = sx * -Math.PI / 2;
        wing.add(claw);
        group.add(wing);
        refs.wings.push({ wing, side: sx, row: w });
      }
    }
  }

  // Tail.
  if (b.tail) {
    const tail = new THREE.Group();
    tail.position.set(0, lying ? torsoY * 0.94 : legLen + torsoH * 0.30, lying ? -H * 0.56 * long : -W * 0.42);
    const len = b.tail === 'heavy' ? H * 0.9 : H * 0.7;
    const r = b.tail === 'heavy' ? W * 0.26 : W * 0.12;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(r * 2, r * 2, len), skin);
    seg.position.z = -len * 0.5;
    tail.add(seg);
    const tip = new THREE.Group();
    tip.position.z = -len;
    const tm = new THREE.Mesh(new THREE.BoxGeometry(r * 1.4, r * 1.4, len * 0.7), skin);
    tm.position.z = -len * 0.35;
    tip.add(tm);
    tail.add(tip);
    group.add(tail);
    refs.tail = { root: tail, tip };
  }

  batch.build(group, { castShadow: settings.preset.shadows, receiveShadow: false });
  group.traverse((o) => { if (o.isMesh) { o.castShadow = settings.preset.shadows; o.receiveShadow = false; } });

  // Horns, crests and spines all add height on top of the body, so a species
  // asking for 2.85 metres would stand 3.3. Measure what was actually built and
  // hand back the factor that makes the whole thing its stated height.
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const built = bounds.max.y - bounds.min.y;
  const fit = built > 0.05 ? H / built : 1;

  if (b.ghost) {
    skin.transparent = true; skin.opacity = 0.42;
    dark.transparent = true; dark.opacity = 0.42;
    group.traverse((o) => { if (o.isMesh && o.material !== eyeMat) o.castShadow = false; });
  }
  return { group, refs, fit };
}

// -----------------------------------------------------------------------------
// One creature
// -----------------------------------------------------------------------------
export class Creature {
  constructor(manager, id, x, z, opts) {
    this.manager = manager;
    this.world = manager.world;
    this.id = id;
    this.spec = manager.specFor(id);
    this.rng = makeRng(((Math.random() * 0xffffffff) >>> 0) || 7);
    this.scale = (opts && opts.scale) || 1;

    const built = buildBody(this.spec, this.rng);
    this.group = built.group;
    this.refs = built.refs;
    // `fit` normalises the built body to the height the species asks for; the
    // creature's own scale multiplies that.
    this.fit = built.fit || 1;
    this.group.scale.setScalar(this.scale * this.fit);
    this.group.userData.creature = this;

    this.position = new THREE.Vector3(x, this.world.groundAt(x, z), z);
    this.group.position.copy(this.position);
    this.heading = this.rng() * TAU;
    this.speed = 0;
    this.targetSpeed = 0;
    this.phase = this.rng() * TAU;
    this.verticalVel = 0;
    this.grounded = true;
    this.hover = this.spec.move === 'hover' ? this.spec.build.height * 0.55 : 0;

    const st = this.spec.stats;
    this.health = st.health;
    this.maxHealth = st.health;
    this.state = 'wander';
    this.stateTimer = this.rng.range(2, 8);
    this.target = null;
    this.prey = null;
    this.attackCooldown = 0;
    this.abilityCooldown = {};
    this.voiceTimer = this.rng.range(2, 14);
    this.cloaked = 0;
    this.buried = 0;
    this.frozen = 0;
    this.lodLevel = 0;
    this.updateAccumulator = 0;
    this.generation = (opts && opts.generation) || 0;
    // A summoned creature knows who called it and will not turn on them.
    this.loyal = !!(opts && opts.loyal);
    this.age = 0;
  }

  get name() { return this.spec.name; }
  get mood() { return this.loyal ? 'loyal' : this.spec.mood; }
  has(power) { return this.spec.powers.indexOf(power) >= 0; }

  // ---------------------------------------------------------------------------
  say(kind) {
    const listener = this.manager.listener;
    if (!listener) return;
    const d = this.position.distanceTo(listener);
    if (d > 46) return;
    const pan = clampv((this.position.x - listener.x) / 30, -1, 1);
    const v = this.spec.voice;
    audio.creature(kind || v[0], (v[1] || 1) / Math.max(0.4, this.scale), pan);
  }

  /** Hold it where it stands. */
  freeze(seconds) {
    this.frozen = Math.max(this.frozen, seconds || 8);
    this.prey = null;
    this.charging = 0;
    this.lunge = 0;
    return true;
  }

  /** @returns true if this took it down. */
  damage(amount, from) {
    this.health -= amount;
    if (this.health <= 0) { this.die(from); return true; }
    if (this.rng.chance(0.4)) this.say();
    // Anything that gets hurt stops wandering and looks for who did it.
    if (from && this.state === 'wander') { this.prey = from; this.state = 'hunt'; }
    return false;
  }

  die(from) {
    if (this.has('split') && this.generation < 2) {
      // Two smaller ones, each with a share of what was left.
      for (let i = 0; i < 2; i++) {
        const a = this.rng() * TAU;
        const c = this.manager.spawn(this.id, this.position.x + Math.cos(a) * 1.4, this.position.z + Math.sin(a) * 1.4, {
          scale: this.scale * 0.68, generation: this.generation + 1, loyal: this.loyal,
        });
        if (c) { c.health = c.maxHealth * 0.6; c.prey = from || null; c.state = from ? 'hunt' : 'wander'; }
      }
      this.say('chitter');
    }
    if (this.has('cloud')) this.manager.gasCloud(this.position, this.spec.build.height * 1.6);
    this.manager.remove(this);
  }

  // ---------------------------------------------------------------------------
  update(dt, playerPos, lod) {
    this.lodLevel = lod || 0;
    this.age += dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    for (const k in this.abilityCooldown) {
      this.abilityCooldown[k] -= dt;
      if (this.abilityCooldown[k] <= 0) delete this.abilityCooldown[k];
    }
    if (this.cloaked > 0) this.cloaked -= dt;
    if (this.frozen > 0) {
      // Held in place: it still exists, it just cannot do anything.
      this.frozen -= dt;
      this.speed = 0;
      this.targetSpeed = 0;
      this.group.position.copy(this.position);
      if (this.frozen <= 0 && this.refs.ownMaterials) this._opacity = null;
      return;
    }
    if (this.has('regen') && this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + this.maxHealth * 0.035 * dt);

    if (this.buried > 0) {
      this.buried -= dt;
      this.group.visible = false;
      if (this.buried <= 0) this.surface(playerPos);
      return;
    }

    this.think(dt, playerPos);
    this.move(dt);
    if (this.lodLevel < 2) this.animate(dt);
    this.applyCloak();

    this.voiceTimer -= dt;
    if (this.voiceTimer <= 0) {
      this.voiceTimer = this.rng.range(6, 26);
      if (this.lodLevel < 2 && this.rng.chance(0.55)) this.say();
    }
  }

  // ---------------------------------------------------------------------------
  think(dt, playerPos) {
    this.stateTimer -= dt;
    const st = this.spec.stats;

    if (this.mood === 'loyal') return this.thinkLoyal(dt, playerPos);

    // Pick something to go after: whoever is closest, player included. Someone
    // who has gone, gone down, gone out of range or gone invisible is dropped.
    const lost = !this.prey || this.prey.removed || this.prey.downed > 3 ||
      (this.prey === 'player' && (!playerPos || this.manager.game.player.invisible)) ||
      this.position.distanceTo(this.preyPos(playerPos)) > st.sight * 1.4;
    if (lost) this.prey = this.findPrey(st.sight, playerPos);

    if (this.prey) {
      const tp = this.preyPos(playerPos);
      const d = this.position.distanceTo(tp);
      this.state = d < 2.2 + this.scale ? 'attack' : 'hunt';
      this.faceToward(tp.x, tp.z, dt);
      if (this.state === 'hunt') {
        this.targetSpeed = st.chase * (this.mood === 'feral' ? 0.85 : 1) * this.scale;
        this.tryAbilities(d, tp, playerPos);
      } else {
        this.targetSpeed = 0;
        this.strike(playerPos);
      }
      return;
    }

    // Nothing to chase: wander.
    if (this.stateTimer <= 0 || !this.target) {
      this.state = 'wander';
      this.stateTimer = this.rng.range(4, 14);
      const a = this.rng() * TAU, r = this.rng.range(5, 28);
      this.target = { x: this.position.x + Math.cos(a) * r, z: this.position.z + Math.sin(a) * r };
      this.targetSpeed = st.speed * this.rng.range(0.5, 1.0) * this.scale;
    }
    if (this.target) {
      const d = Math.hypot(this.target.x - this.position.x, this.target.z - this.position.z);
      if (d < 1.4) { this.target = null; this.targetSpeed = 0; }
      else this.faceToward(this.target.x, this.target.z, dt);
    }
  }

  thinkLoyal(dt, playerPos) {
    const st = this.spec.stats;
    // A summoned creature keeps pace with you and takes your enemies.
    const threat = this.findHostile(st.sight, playerPos);
    if (threat) {
      const d = this.position.distanceTo(threat.position);
      this.faceToward(threat.position.x, threat.position.z, dt);
      if (d < 2.2 + this.scale) { this.targetSpeed = 0; this.strikeNpc(threat); }
      else { this.targetSpeed = st.chase * this.scale; this.tryAbilities(d, threat.position, playerPos); }
      return;
    }
    if (!playerPos) { this.targetSpeed = 0; return; }
    const d = this.position.distanceTo(playerPos);
    if (d > 5) { this.faceToward(playerPos.x, playerPos.z, dt); this.targetSpeed = clampv(d * 0.7, 1, st.chase) * this.scale; }
    else this.targetSpeed = 0;
  }

  preyPos(playerPos) {
    if (this.prey === 'player') return playerPos || this.position;
    return this.prey ? this.prey.position : this.position;
  }

  findPrey(radius, playerPos) {
    const npcs = this.manager.game.npcs;
    let best = null, bd = radius;
    if (playerPos && !this.manager.game.player.invisible) {
      // Zombies leave their own kind alone, and you become their own kind.
      const sameSide = this.spec.family !== 'monster' && this.manager.game.player.isZombie;
      if (!sameSide) {
        const d = this.position.distanceTo(playerPos);
        if (d < bd) { bd = d; best = 'player'; }
      }
    }
    if (npcs) {
      for (const n of npcs.npcs) {
        if (n.indoors || n.downed > 0) continue;
        if (this.spec.family !== 'monster' && n.infected) continue;
        const d = this.position.distanceTo(n.position);
        if (d < bd) { bd = d; best = n; }
      }
    }
    return best;
  }

  findHostile(radius, playerPos) {
    const npcs = this.manager.game.npcs;
    if (!npcs) return null;
    let best = null, bd = radius;
    for (const n of npcs.npcs) {
      if (n.indoors || n.downed > 0) continue;
      if (!n.infected && !n.hostile) continue;
      const d = this.position.distanceTo(n.position);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  faceToward(x, z, dt) {
    const want = Math.atan2(x - this.position.x, z - this.position.z);
    this.heading = dampAngle(this.heading, want, 0.08, dt);
  }

  // ---------------------------------------------------------------------------
  strike(playerPos) {
    if (this.attackCooldown > 0) return;
    this.attackCooldown = 1.6;
    this.swing = 0.45;
    this.say();
    if (this.prey === 'player') {
      const p = this.manager.game.player;
      if (p.knockDown(this.spec.stats.damage, this.name)) this.manager.game.onCreatureHitPlayer(this);
    } else if (this.prey && this.prey.position) {
      this.strikeNpc(this.prey);
    }
  }

  strikeNpc(npc) {
    if (this.attackCooldown > 0) return;
    this.attackCooldown = 1.6;
    this.swing = 0.45;
    npc.downed = Math.max(npc.downed, this.spec.stats.damage);
    npc.hitPoints = Math.max(0, (npc.hitPoints || 100) - 45);
    const apo = this.manager.game.apocalypse;
    // A zombie's bite carries. A monster's claw just puts you on the ground.
    if (this.spec.family !== 'monster' && apo && apo.active) apo.infect(npc);
    else if (npc.hitPoints <= 0 && this.spec.family !== 'monster') npc.reanimate = 5 + this.rng() * 5;
    const g = this.manager.game.gore;
    if (g) g.hit(npc.position.x, npc.position.y + 1.0, npc.position.z, 0.5, Math.sin(this.heading), Math.cos(this.heading));
    this.say();
  }

  // ---------------------------------------------------------------------------
  /** Abilities fire on their own cooldowns while hunting. */
  tryAbilities(dist, targetPos, playerPos) {
    const ready = (k) => this.has(k) && !this.abilityCooldown[k];
    const arm = (k) => { this.abilityCooldown[k] = ABILITY_COOLDOWN[k] || 6; };

    if (ready('pounce') && dist > 4 && dist < 14 && this.grounded) {
      arm('pounce');
      const dx = targetPos.x - this.position.x, dz = targetPos.z - this.position.z;
      const d = Math.hypot(dx, dz) || 1;
      this.verticalVel = 6.5;
      this.grounded = false;
      this.lungeX = (dx / d) * 11;
      this.lungeZ = (dz / d) * 11;
      this.lunge = 0.9;
      this.say('screech');
    } else if (ready('leap') && dist > 3 && this.grounded) {
      arm('leap');
      const dx = targetPos.x - this.position.x, dz = targetPos.z - this.position.z;
      const d = Math.hypot(dx, dz) || 1;
      this.verticalVel = 9;
      this.grounded = false;
      this.lungeX = (dx / d) * 9;
      this.lungeZ = (dz / d) * 9;
      this.lunge = 1.4;
    } else if (ready('charge') && dist > 8 && dist < 40) {
      arm('charge');
      this.charging = 2.4;
      this.say('roar');
    } else if (ready('shockwave') && dist < 9) {
      arm('shockwave');
      this.manager.shockwave(this.position, 9 * this.scale, this, playerPos);
      this.say('rumble');
    } else if (ready('spit') && dist > 5 && dist < 30) {
      arm('spit');
      this.manager.spit(this, targetPos);
      this.say('hiss');
    } else if (ready('screech') && dist < 40) {
      arm('screech');
      this.manager.rally(this.position, 60);
      this.say('screech');
    } else if (ready('cloak') && dist > 10) {
      arm('cloak');
      this.cloaked = 6;
    } else if (ready('brood') && dist < 28) {
      arm('brood');
      for (let i = 0; i < 2; i++) {
        const a = this.rng() * TAU;
        const c = this.manager.spawn(this.rng.chance(0.5) ? 'crawler' : 'runner',
          this.position.x + Math.cos(a) * 2, this.position.z + Math.sin(a) * 2,
          { scale: 0.7, generation: this.generation + 1, loyal: this.loyal });
        if (c) c.prey = this.prey;
      }
      this.say('groan');
    } else if (ready('burrow') && dist > 12) {
      arm('burrow');
      this.buried = 2.2;
      this.burrowTo = { x: targetPos.x, z: targetPos.z };
      this.say('rumble');
    } else if (ready('dive') && dist > 6 && this.hover > 2) {
      arm('dive');
      this.diving = 1.2;
    } else if (ready('drag') && dist > 3 && dist < 12) {
      arm('drag');
      this.manager.drag(this, targetPos, playerPos);
    } else if (ready('drain') && dist < 8) {
      arm('drain');
      this.manager.drain(this, playerPos);
    } else if (ready('roar') && dist < 50) {
      arm('roar');
      this.say('roar');
      this.manager.terrify(this.position, 34);
    }
  }

  surface(playerPos) {
    const to = this.burrowTo || { x: this.position.x, z: this.position.z };
    this.position.set(to.x, this.world.groundAt(to.x, to.z), to.z);
    this.group.position.copy(this.position);
    this.group.visible = true;
    this.verticalVel = 5;
    this.grounded = false;
    this.say('roar');
    this.manager.dustRing(this.position);
  }

  // ---------------------------------------------------------------------------
  move(dt) {
    const st = this.spec.stats;
    if (this.charging > 0) { this.charging -= dt; this.targetSpeed = st.chase * 1.9 * this.scale; }
    if (this.diving > 0) { this.diving -= dt; this.hover = Math.max(0.2, this.hover - dt * 6); }
    else if (this.spec.move === 'hover') this.hover = damp(this.hover, this.spec.build.height * 0.55, 0.9, dt);

    if (this.lunge > 0) {
      this.lunge -= dt;
      this.position.x += this.lungeX * dt;
      this.position.z += this.lungeZ * dt;
    }

    this.speed = damp(this.speed, this.targetSpeed, 0.12, dt);
    if (this.speed > 0.02) {
      this.position.x += Math.sin(this.heading) * this.speed * dt;
      this.position.z += Math.cos(this.heading) * this.speed * dt;
    }

    const ground = this.world.groundAt(this.position.x, this.position.z);
    if (this.spec.move === 'hover') {
      this.position.y = damp(this.position.y, ground + this.hover, 0.25, dt);
    } else if (!this.grounded) {
      this.verticalVel -= 19.6 * dt;
      this.position.y += this.verticalVel * dt;
      if (this.position.y <= ground) { this.position.y = ground; this.verticalVel = 0; this.grounded = true; this.lunge = 0; }
    } else {
      this.position.y = ground;
    }
    // Something four metres tall does not squeeze between two parked cars.
    this.world.resolveCollision(this.position, 0.35 * this.scale * (1 + (this.spec.build.bulk || 0.3)));

    this.group.position.copy(this.position);
    this.group.rotation.y = this.heading;
  }

  // ---------------------------------------------------------------------------
  animate(dt) {
    const st = this.spec.stats;
    const moving = this.speed > 0.15;
    const gait = clamp01(this.speed / Math.max(0.6, st.chase));
    const style = this.spec.move;
    const rate = style === 'hop' ? 3.2 : style === 'lope' ? lerpv(4, 12, gait) : lerpv(3.4, 9, gait);
    if (moving || style === 'hover') this.phase += dt * rate;
    const swing = Math.sin(this.phase);
    const detail = this.lodLevel === 0;

    // Legs.
    if (style === 'hop') {
      const hop = Math.max(0, Math.sin(this.phase));
      for (const l of this.refs.legs) { l.pivot.rotation.x = -hop * 1.2; if (detail) l.shin.rotation.x = hop * 1.5; }
      this.group.position.y = this.position.y + (moving ? hop * 0.4 : 0);
    } else if (style === 'slither') {
      this.group.rotation.z = Math.sin(this.phase * 0.8) * 0.16 * gait;
    } else if (style === 'hover') {
      this.group.position.y = this.position.y + Math.sin(this.phase * 0.7) * 0.12;
      for (const l of this.refs.legs) l.pivot.rotation.x = -0.9;
    } else {
      for (const l of this.refs.legs) {
        const off = (l.front ? 0 : Math.PI) + (l.side > 0 && this.refs.legs.length === 4 ? Math.PI : 0);
        const a = Math.sin(this.phase + off);
        l.pivot.rotation.x = moving ? a * lerpv(0.35, 0.95, gait) : 0;
        if (detail) l.shin.rotation.x = moving ? Math.max(0, -a) * lerpv(0.3, 1.1, gait) : 0;
      }
    }

    // Arms. A hunched body reaches; an idle one lets them hang and sway.
    const reach = this.swing > 0 ? 1 : 0;
    if (this.swing > 0) this.swing -= dt;
    for (const a of this.refs.arms) {
      const hunt = this.state === 'hunt' || this.state === 'attack' ? 1 : 0;
      const base = lerpv(0.1, -1.15, hunt * 0.8 + reach * 0.2);
      a.pivot.rotation.x = damp(a.pivot.rotation.x, base + (moving ? Math.sin(this.phase + (a.side > 0 ? Math.PI : 0)) * 0.3 * (1 - hunt * 0.7) : 0), 0.06, dt);
      a.pivot.rotation.z = damp(a.pivot.rotation.z, a.side * lerpv(0.18, 0.5, hunt), 0.1, dt);
      if (detail) a.fore.rotation.x = damp(a.fore.rotation.x, lerpv(-0.25, -0.9, hunt) - reach * 0.6, 0.05, dt);
    }

    // Wings beat while hovering and fold back otherwise. The beat stays inside
    // a shallow arc — a full sweep to vertical reads as broken, not powerful —
    // and each row lags the one above it.
    for (const w of this.refs.wings) {
      const lag = w.row * 0.55;
      const flap = style === 'hover' ? Math.sin(this.phase * 2.2 - lag) * 0.42 : 0;
      w.wing.rotation.z = w.side * (0.22 + flap);
      w.wing.rotation.y = w.side * (style === 'hover' ? -0.12 - flap * 0.25 : -0.55);
      if (detail) w.wing.rotation.x = Math.cos(this.phase * 2.2 - lag) * 0.18;
    }

    // Heads track the hunt; jaws work while striking.
    for (let i = 0; i < this.refs.heads.length; i++) {
      const h = this.refs.heads[i];
      const hunt = this.state === 'hunt' || this.state === 'attack' ? 1 : 0;
      h.rotation.x = damp(h.rotation.x, lerpv(0.08, -0.22, hunt) + this.spec.build.hunch * 0.3, 0.06, dt);
      if (detail) h.rotation.y = moving ? Math.sin(this.phase * 0.5 + i) * 0.1 : Math.sin(this.age * 0.8 + i * 2) * 0.35;
    }
    if (this.refs.jaw && detail) {
      const open = reach ? 0.55 : (this.state === 'hunt' ? 0.22 : 0.05);
      for (const j of this.refs.jaw) j.rotation.x = damp(j.rotation.x, open, 0.04, dt);
    }

    // Tail counterbalances.
    if (this.refs.tail) {
      this.refs.tail.root.rotation.y = swing * lerpv(0.1, 0.4, gait);
      if (detail) this.refs.tail.tip.rotation.y = Math.sin(this.phase - 0.8) * 0.4;
      this.refs.tail.root.rotation.x = lerpv(-0.15, -0.5, gait);
    }

    // The whole body leans into a run and hunches when it hunts.
    const lean = this.spec.build.hunch * 0.55 + gait * 0.2;
    this.group.rotation.x = damp(this.group.rotation.x, lean * (this.spec.move === 'slither' ? 0 : 1) * 0.6, 0.08, dt);
  }

  applyCloak() {
    if (!this.refs.ownMaterials) return;
    const want = this.cloaked > 0 ? 0.12 : (this.spec.build.ghost ? 0.42 : 1);
    if (this._opacity === want) return;
    this._opacity = want;
    for (const m of this.refs.materials) {
      m.transparent = want < 1;
      m.opacity = want;
      m.depthWrite = want >= 1;
    }
  }

  dispose() {
    disposeGroup(this.group);
    // Only the copies this body made are ours to throw away.
    for (const m of this.refs.materials) m.dispose();
  }
}

// -----------------------------------------------------------------------------
// The manager
// -----------------------------------------------------------------------------
export class CreatureManager {
  constructor(game) {
    this.game = game;
    this.world = game.world;
    this.scene = game.scene;
    this.creatures = [];
    this.custom = {};          // id -> spec, designed in-world and saved with it
    this.listener = null;
    this.rng = makeRng(0x7c31a9);
    this.group = new THREE.Group();
    this.group.name = 'creatures';
    this.scene.add(this.group);
    this.projectiles = [];
    this.buildEffects();
  }

  get budget() { return Math.max(4, Math.round(22 * perf.load)); }

  specFor(id) { return this.custom[id] || CREATURES[id] || CREATURES.shambler; }

  /** Everything you can summon by name, built-ins and your own designs. */
  catalogue() {
    const out = [];
    for (const id of CREATURE_IDS) out.push({ id, spec: CREATURES[id] });
    for (const id in this.custom) out.push({ id, spec: this.custom[id] });
    return out;
  }

  find(query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return null;
    for (const entry of this.catalogue()) {
      if (entry.id === q || entry.spec.name.toLowerCase() === q) return entry.id;
    }
    for (const entry of this.catalogue()) {
      if (entry.spec.name.toLowerCase().indexOf(q) >= 0 || q.indexOf(entry.id) >= 0) return entry.id;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  buildEffects() {
    // Shared pools: spit balls, gas clouds and dust rings, all instanced.
    const ballGeo = new THREE.SphereGeometry(0.22, 8, 6);
    this.ballMesh = new THREE.InstancedMesh(ballGeo,
      new THREE.MeshBasicMaterial({ color: 0x9dff5a, transparent: true, opacity: 0.85, depthWrite: false }), 24);
    this.ballMesh.count = 0;
    this.ballMesh.frustumCulled = false;
    this.group.add(this.ballMesh);

    const cloudGeo = new THREE.SphereGeometry(1, 10, 8);
    this.cloudMesh = new THREE.InstancedMesh(cloudGeo,
      new THREE.MeshBasicMaterial({ color: 0x8fbf5a, transparent: true, opacity: 0.22, depthWrite: false }), 16);
    this.cloudMesh.count = 0;
    this.cloudMesh.frustumCulled = false;
    this.group.add(this.cloudMesh);
    this.clouds = [];

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  // ---------------------------------------------------------------------------
  /** Put one in the world. Returns the creature, or null if it wouldn't fit. */
  spawn(id, x, z, opts) {
    const key = this.find(id) || (this.custom[id] ? id : null) || (CREATURES[id] ? id : null);
    if (!key) return null;
    if (this.creatures.length >= this.budget + 8) {
      // Over budget: drop the furthest one rather than refusing.
      const p = this.game.player ? this.game.player.position : null;
      if (p) {
        let worst = null, wd = -1;
        for (const c of this.creatures) {
          const d = c.position.distanceTo(p);
          if (d > wd && !c.loyal) { wd = d; worst = c; }
        }
        if (worst) this.remove(worst);
      }
      if (this.creatures.length >= this.budget + 8) return null;
    }
    const c = new Creature(this, key, x, z, opts);
    this.creatures.push(c);
    this.group.add(c.group);
    return c;
  }

  /** What a power calls: pick something appropriate and put it in front of you. */
  summon(id, at, opts) {
    const p = at || (this.game.player ? this.game.player.position : new THREE.Vector3());
    let key = id ? this.find(id) : null;
    if (!key) {
      const pool = this.game.apocalypse && this.game.apocalypse.active
        ? ['runner', 'brute', 'crawler', 'stalker', 'tendril', 'splitter']
        : ['gargoyle', 'hopper', 'wisp', 'chimera', 'lurker', 'shade', 'golem'];
      key = this.rng.pick(pool);
    }
    const c = this.spawn(key, p.x, p.z, Object.assign({ loyal: true }, opts || {}));
    if (!c) return null;
    this.dustRing(c.position);
    c.say('roar');
    return c.name;
  }

  remove(c) {
    const i = this.creatures.indexOf(c);
    if (i >= 0) this.creatures.splice(i, 1);
    this.group.remove(c.group);
    c.dispose();
    c.removed = true;
  }

  clear() {
    while (this.creatures.length) this.remove(this.creatures[0]);
  }

  count(family) {
    if (!family) return this.creatures.length;
    return this.creatures.filter((c) => c.spec.family === family).length;
  }

  // ---------------------------------------------------------------------------
  // Design your own. Words in, a species out.
  // ---------------------------------------------------------------------------
  design(name, description) {
    const text = String(description || '').toLowerCase();
    const has = (...words) => words.some((w) => text.indexOf(w) >= 0);
    const r = makeRng(hashText(name + '|' + text));

    let height = 1.9;
    if (has('tiny', 'small', 'little')) height = 0.8;
    if (has('huge', 'giant', 'massive', 'enormous', 'towering')) height = 4.2;
    if (has('tall')) height = 3.0;
    const legs = has('four legs', 'four-legged', 'on all fours', 'dog', 'beast', 'quadruped') ? 4
      : has('no legs', 'floating', 'flying', 'hovering', 'ghost', 'wisp', 'spirit') ? 0 : 2;
    const wings = has('wing', 'flying', 'winged', 'bat');
    const move = has('flying', 'floating', 'hover', 'ghost') ? 'hover'
      : has('crawl') ? 'crawl'
      : has('slither', 'snake', 'worm') ? 'slither'
      : has('hop', 'jump', 'leap') ? 'hop'
      : legs === 4 ? 'lope' : has('stalk', 'sneak', 'creep') ? 'stalk' : 'walk';
    const fast = has('fast', 'quick', 'swift', 'runner');
    const slow = has('slow', 'heavy', 'lumbering');
    const tough = has('tough', 'armoured', 'armored', 'stone', 'tank', 'strong');

    const colors = {
      red: 0xa33a30, green: 0x5f8f52, blue: 0x3a5f8f, black: 0x24242a, white: 0xdedbd2,
      purple: 0x6a4f8f, grey: 0x6f6e6a, gray: 0x6f6e6a, orange: 0xb5651f, yellow: 0xbfa53a,
      pink: 0xb06a8a, gold: 0xb59a3a, silver: 0x9aa0a6, brown: 0x6a4a30,
    };
    let skin = 0x6a7a5a;
    for (const k in colors) if (text.indexOf(k) >= 0) { skin = colors[k]; break; }

    const powers = [];
    if (has('leap', 'jump', 'pounce')) powers.push('pounce');
    if (has('charge', 'ram')) powers.push('charge');
    if (has('scream', 'screech', 'howl')) powers.push('screech');
    if (has('spit', 'acid', 'venom', 'poison')) powers.push('spit');
    if (has('invisible', 'cloak', 'vanish')) powers.push('cloak');
    if (has('split', 'divide')) powers.push('split');
    if (has('heal', 'regenerate', 'regen')) powers.push('regen');
    if (has('burrow', 'dig', 'underground')) powers.push('burrow');
    if (has('drain', 'steal')) powers.push('drain');
    if (has('shock', 'quake', 'slam', 'stomp')) powers.push('shockwave');
    if (has('spawn', 'brood', 'babies', 'swarm')) powers.push('brood');
    if (wings) powers.push('dive');
    if (!powers.length) powers.push(r.pick(['pounce', 'charge', 'screech', 'cloak']));

    const family = has('zombie', 'undead', 'infected') ? 'zombie' : has('mutant', 'mutation') ? 'mutation' : 'monster';
    const spec = {
      name: String(name || 'Creature').slice(0, 28),
      family,
      blurb: String(description || '').slice(0, 90) || 'One of yours.',
      custom: true,
      build: {
        height,
        bulk: tough ? 0.52 : has('thin', 'slender', 'skinny') ? 0.20 : 0.32,
        legs,
        arms: has('no arms', 'armless') ? 0 : 2,
        armLen: has('long arms', 'tendril', 'reaching') ? 2.1 : 1,
        legLen: has('long legs', 'stilts') ? 1.5 : 1,
        hunch: move === 'crawl' ? 0.95 : legs === 4 ? 0.85 : has('hunched', 'crouched') ? 0.6 : 0.25,
        head: has('horn') ? 'horned' : has('no eyes', 'eyeless', 'blind') ? 'eyeless'
          : has('maw', 'mouth', 'teeth', 'jaws') ? 'maw' : has('crest', 'crown') ? 'crest'
          : has('split', 'two heads') ? 'split' : 'jaw',
        heads: has('two heads', 'twin') ? 2 : 1,
        eyes: has('many eyes', 'eyes everywhere') ? 8 : has('one eye', 'cyclops') ? 1 : has('no eyes', 'eyeless') ? 0 : 2,
        eyeColor: has('red eyes') ? 0xff4a3c : has('blue eyes') ? 0x5ad6ff : has('white eyes') ? 0xf2f7ff : 0xd4ff5a,
        skin,
        spikes: has('spike', 'spine', 'thorn') ? 8 : tough ? 4 : 0,
        wings,
        wingPairs: has('six wings') ? 3 : 1,
        tail: has('heavy tail', 'club tail') ? 'heavy' : has('tail') ? 'lash' : null,
        ghost: has('ghost', 'shade', 'spirit', 'phantom'),
        glow: has('glow', 'shining', 'burning', 'light'),
        long: legs === 4 || move === 'slither' ? 2.2 : 1,
      },
      move,
      stats: {
        speed: fast ? 3.2 : slow ? 1.1 : 2.0,
        chase: fast ? 8.4 : slow ? 3.0 : 5.4,
        health: tough ? 420 : height > 3 ? 300 : height < 1 ? 45 : 110,
        damage: tough || height > 3 ? 7 : 4,
        sight: 50,
        jump: powers.indexOf('pounce') >= 0 ? 2 : 0,
      },
      powers,
      voice: [has('scream', 'screech') ? 'screech' : has('chime', 'sing', 'angel') ? 'chime'
        : height > 3 ? 'roar' : has('hiss', 'snake') ? 'hiss' : has('zombie', 'undead') ? 'groan' : 'growl',
        clampv(2.0 / Math.max(0.6, height), 0.55, 1.6)],
      mood: has('friendly', 'tame', 'pet', 'loyal') ? 'loyal' : has('shy', 'timid', 'skittish') ? 'skittish' : 'hostile',
    };
    const id = 'custom_' + slug(spec.name) + '_' + (Object.keys(this.custom).length + 1);
    this.custom[id] = spec;
    return { id, spec };
  }

  // ---------------------------------------------------------------------------
  // Shared abilities, run by the manager so they can touch the whole world
  // ---------------------------------------------------------------------------
  shockwave(at, radius, from, playerPos) {
    const npcs = this.game.npcs;
    if (npcs) {
      for (const n of npcs.within(at, radius)) {
        n.downed = Math.max(n.downed, 4);
      }
    }
    if (playerPos && at.distanceTo(playerPos) < radius) {
      this.game.player.knockDown(3.5, from ? from.name : 'shockwave');
    }
    this.dustRing(at, radius * 0.5);
    audio.explosion(3);
  }

  rally(at, radius) {
    // A scream pulls everything hostile toward the noise.
    for (const c of this.creatures) {
      if (c.position.distanceTo(at) > radius || c.loyal) continue;
      c.target = { x: at.x + (this.rng() - 0.5) * 6, z: at.z + (this.rng() - 0.5) * 6 };
      c.state = 'wander';
      c.stateTimer = 6;
      c.targetSpeed = c.spec.stats.chase * 0.8;
    }
    const npcs = this.game.npcs;
    if (npcs) for (const n of npcs.within(at, radius)) { if (n.infected) n.combatTarget = null; }
  }

  terrify(at, radius) {
    const npcs = this.game.npcs;
    if (!npcs) return;
    for (const n of npcs.within(at, radius)) {
      if (n.infected || n.hostile) continue;
      n.panicking = true;
      n.stamina = 18;
    }
  }

  drag(from, targetPos, playerPos) {
    // Long arms pull whatever they reach a few metres closer.
    const dx = from.position.x - targetPos.x, dz = from.position.z - targetPos.z;
    const d = Math.hypot(dx, dz) || 1;
    const pull = Math.min(5, d - 1.6);
    if (from.prey === 'player' && playerPos) {
      this.game.player.position.x += (dx / d) * pull;
      this.game.player.position.z += (dz / d) * pull;
      this.game.player.camShake = 0.9;
    } else if (from.prey && from.prey.position) {
      from.prey.position.x += (dx / d) * pull;
      from.prey.position.z += (dz / d) * pull;
      from.prey.root.position.copy(from.prey.position);
      from.prey.downed = Math.max(from.prey.downed, 2.5);
    }
    from.swing = 0.5;
  }

  drain(from, playerPos) {
    if (from.prey === 'player' && playerPos && this.game.powers) {
      this.game.powers.energy = Math.max(0, this.game.powers.energy - 14);
      this.game.player.camShake = 0.5;
    } else if (from.prey && from.prey.position) {
      from.prey.downed = Math.max(from.prey.downed, 2);
    }
    from.health = Math.min(from.maxHealth, from.health + 20);
  }

  spit(from, targetPos) {
    if (this.projectiles.length >= 20) this.projectiles.shift();
    const dx = targetPos.x - from.position.x;
    const dy = (targetPos.y + 1) - (from.position.y + from.spec.build.height * 0.7);
    const dz = targetPos.z - from.position.z;
    const d = Math.hypot(dx, dz) || 1;
    const speed = 18;
    this.projectiles.push({
      x: from.position.x, y: from.position.y + from.spec.build.height * 0.7, z: from.position.z,
      vx: (dx / d) * speed, vy: dy / d * speed * 0.4 + 3.2, vz: (dz / d) * speed,
      life: 3, owner: from,
    });
  }

  gasCloud(at, radius) {
    if (this.clouds.length >= 16) this.clouds.shift();
    this.clouds.push({ x: at.x, y: at.y + radius * 0.4, z: at.z, r: radius, t: 0, life: 9 });
    audio.noiseBurst({ dur: 0.9, gain: 0.12, freq: 700, q: 1.1, sweep: 0.3 });
  }

  dustRing(at, scale) {
    if (this.game.powers) this.game.powers.burst(at, 0xb8a888, scale || 1.1);
  }

  // ---------------------------------------------------------------------------
  update(dt, playerPos) {
    this.listener = playerPos;
    if (!this.creatures.length && !this.projectiles.length && !this.clouds.length) return;

    // Distance tiers, the same three the crowd uses: full, coarse, frozen.
    const near = settings.preset.npcDetailDistance * perf.lodBias;
    const simD = (settings.preset.npcSimDistance || near * 5) * perf.physics;
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      const d = c.position.distanceTo(playerPos);
      if (d > simD * 1.6 && !c.loyal) { this.remove(c); continue; }
      let lod = 0;
      if (d > simD) lod = 2;
      else if (d > near * 1.6) lod = 1;
      if (lod === 0) { c.update(dt, playerPos, 0); continue; }
      c.updateAccumulator += dt;
      const animK = Math.max(0.3, perf.animation);
      const interval = lod === 1 ? 1 / (15 * animK) : 1 / (4 * animK);
      if (c.updateAccumulator >= interval) {
        c.update(c.updateAccumulator, playerPos, lod);
        c.updateAccumulator = 0;
      }
    }

    this.updateProjectiles(dt, playerPos);
    this.updateClouds(dt, playerPos);
  }

  updateProjectiles(dt, playerPos) {
    let n = 0;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.vy -= 12 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const ground = this.world.groundAt(p.x, p.z);
      let done = p.life <= 0;
      if (p.y <= ground) {
        done = true;
        this.gasCloud({ x: p.x, y: ground, z: p.z }, 2.2);
      }
      if (!done && playerPos && Math.hypot(p.x - playerPos.x, p.z - playerPos.z) < 0.8 && Math.abs(p.y - playerPos.y - 1) < 1.2) {
        done = true;
        this.game.player.knockDown(3, 'spit');
      }
      if (done) { this.projectiles.splice(i, 1); continue; }
      this._v.set(p.x, p.y, p.z);
      this._s.setScalar(1);
      this._m.compose(this._v, this._q, this._s);
      if (n < 24) this.ballMesh.setMatrixAt(n++, this._m);
    }
    this.ballMesh.count = n;
    if (n) this.ballMesh.instanceMatrix.needsUpdate = true;
  }

  updateClouds(dt, playerPos) {
    let n = 0;
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.t += dt;
      if (c.t > c.life) { this.clouds.splice(i, 1); continue; }
      const k = c.t / c.life;
      const r = c.r * lerpv(0.3, 1.5, k);
      // Anything standing in it keeps getting knocked about.
      if (playerPos && Math.hypot(playerPos.x - c.x, playerPos.z - c.z) < r && Math.random() < dt * 0.6) {
        this.game.player.knockDown(2.5, 'gas');
      }
      this._v.set(c.x, c.y, c.z);
      this._s.setScalar(r);
      this._m.compose(this._v, this._q, this._s);
      if (n < 16) this.cloudMesh.setMatrixAt(n++, this._m);
    }
    this.cloudMesh.count = n;
    if (n) this.cloudMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------
  status() {
    if (!this.creatures.length) return 'Nothing out there but people.';
    const tally = {};
    for (const c of this.creatures) tally[c.name] = (tally[c.name] || 0) + 1;
    return Object.keys(tally).map((k) => tally[k] + ' × ' + k).join(', ') + '.';
  }

  serialize() {
    return {
      custom: this.custom,
      live: this.creatures.filter((c) => c.loyal).map((c) => ({ id: c.id, x: c.position.x, z: c.position.z, scale: c.scale })),
    };
  }

  restore(data) {
    if (!data) return;
    if (data.custom) this.custom = data.custom;
    if (data.live) for (const s of data.live) this.spawn(s.id, s.x, s.z, { loyal: true, scale: s.scale });
  }
}

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'one'; }
function hashText(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
