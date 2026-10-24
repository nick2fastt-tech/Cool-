// BATTLE WARS - Season 1, Episode 5: "BEHEMOTH AWAKENS"
import { createDirector, readTime } from '../src/director.js';
import { behemothRig, behParams, behBack } from '../src/behemothRig.js';

export const META = {
  id: 's1e5-behemoth-awakens', title: 'Battle Wars - S1E5 - Behemoth Awakens', file: 'Battle_Wars_S1E5_Behemoth_Awakens', costume: 'blue2',
  behemoth: true, extras: { aaron: ['armor', 'scuffs'], flare: ['armor', 'scuffs'], eric: ['armor', 'scuffs'], leon: ['armor', 'scuffs'], greg: ['slime', 'scuffs'] },
};

const P = Math.PI;
const ALL = ['aaron', 'flare', 'eric', 'barista', 'leon', 'greg', 'newark', 'water', 'soul', 'dog', 'birddog', 'tiger', 'beh', 'ufo'];
const TEAM = ['aaron', 'flare', 'eric', 'greg', 'leon'];

export function buildEpisode() {
  const D = createDirector();
  // a little more reading time per caption (viewers are 9-14 and read the captions)
  const say0 = D.say;
  D.say = (who, text, opts = {}) => say0(who, text, { ...opts, dur: (opts.dur ?? readTime(text)) * 1.12, gap: opts.gap ?? 0.34 });
  const F = (on, yaw, dist, h = 0.15, x = {}) => ({ type: 'frame', on: Array.isArray(on) ? on : [on], yaw, dist, h, ...x });
  const R = (on, yaw, dist, h = 0.15, x = {}) => F(on, yaw, dist, h, { rel: Array.isArray(on) ? on[0] : on, ...x });
  const FIX = (pos, look, x = {}) => ({ type: 'fixed', pos, look, ...x });
  const cast = (list) => { for (const c of ALL) { if (!list.includes(c)) D.hide(c); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); } };
  const props = (c, r = 'none', l = 'none') => { D.set(`${c}.propR`, r); D.set(`${c}.propL`, l); };
  const pos = (c, dt = 0) => [D.val(`${c}.x`, D.now + dt), D.val(`${c}.z`, D.now + dt)];
  const rigAt = (dt = 0) => behemothRig(behParams(D.val, D.now + dt));
  // move along x/z while y follows an arc (jumps, throws, being flung)
  const arc = (c, x, z, y1, dur, peak, dt = 0) => {
    const y0 = D.val(`${c}.y`, D.now + dt);
    D.anim(`${c}.x`, x, dur, dt, 'linear'); D.anim(`${c}.z`, z, dur, dt, 'linear');
    D.anim(`${c}.y`, Math.max(y0, y1) + peak, dur / 2, dt, 'out'); D.anim(`${c}.y`, y1, dur / 2, dt + dur / 2, 'in');
  };
  const fly = (c, x, y, z, dur, dt = 0, ease = 'inout') => { D.anim(`${c}.x`, x, dur, dt, ease); D.anim(`${c}.y`, y, dur, dt, ease); D.anim(`${c}.z`, z, dur, dt, ease); };
  // ride a point on Behemoth's back while it changes (keys sampled from the rig)
  const ride = (c, u, dur, steps = 8, dt = 0, lift = 0) => {
    for (let i = 1; i <= steps; i++) {
      const b = behBack(rigAt(dt + (dur * i) / steps), u);
      const d = dur / steps, at = dt + (dur * (i - 1)) / steps;
      D.anim(`${c}.x`, b[0], d, at, 'linear'); D.anim(`${c}.y`, b[1] + lift, d, at, 'linear'); D.anim(`${c}.z`, b[2], d, at, 'linear');
    }
  };
  const roar = (dur = 2.2, text = 'RRRRRRAAAAAAAAHHHH!', opts = {}) => {
    D.anim('beh.jaw', 1, 0.3); D.anim('beh.nod', (opts.nod ?? -0.35), 0.4);
    D.sfx('monsterRoar', 0, opts.vol ?? 1); D.shake(opts.shake ?? 0.8, dur);
    D.say('behemoth', text, { dur, cam: opts.cam });
    D.anim('beh.jaw', 0, 0.4); D.anim('beh.nod', opts.after ?? 0, 0.5);
  };
  const toTiger = (dt = 0) => {
    const [ex, ez] = pos('eric', dt);
    D.set('flashWhite', 0.5, dt); D.anim('flashWhite', 0, 0.45, dt); D.sfx('transform', dt, 0.9);
    D.fx('sparks', { x: ex, y: 1.0, z: ez, n: 70, color: 0x6fc4ff, speed: 2.6 }, dt);
    D.hide('eric', dt + 0.08); D.place('tiger', ex, ez, D.val('eric.ry', D.now + dt), dt + 0.08); D.set('tiger.act', 'idle', dt + 0.08);
  };
  const toEric = (dt = 0, act = 'idle') => {
    const [tx, tz] = pos('tiger', dt);
    D.set('flashWhite', 0.45, dt); D.anim('flashWhite', 0, 0.45, dt); D.sfx('transform', dt, 0.7);
    D.fx('sparks', { x: tx, y: 0.9, z: tz, n: 50, color: 0x6fc4ff, speed: 2.2 }, dt);
    D.hide('tiger', dt + 0.08); D.place('eric', tx, tz, D.val('tiger.ry', D.now + dt), dt + 0.08); D.act('eric', act, dt + 0.08);
  };

  for (const c of ALL) { D.hide(c); D.act(c, 'idle'); D.expr(c, 'neutral'); D.set(`${c}.y`, 0); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); props(c); }
  for (const c of TEAM) { D.set(`${c}.dim`, 0); D.set(`${c}.scuff`, 0); D.set(`${c}.flicker`, 0); }
  D.set('fade', 1); D.set('greg.redEyes', 0); D.set('greg.slime', 0); D.set('greg.stretch', 0);
  D.set('beh.s', 1); D.set('beh.rear', 0.2); D.set('beh.plates', 0); D.set('beh.claws', 1); D.set('beh.eyes', 1); D.set('beh.sway', 0.3); D.set('beh.slither', 0.4);
  D.set('beh.jaw', 0); D.set('beh.nod', 0); D.set('beh.look', 0); D.set('beh.curl', 0); D.set('beh.tailLift', 0); D.set('beh.shake', 0); D.set('beh.dark', 0); D.set('beh.cracks', 0); D.set('beh.eyesRed', 0); D.set('beh.bolts', 0); D.set('beh.crest', 0);
  D.set('crown.mode', 'head'); D.set('crown.glow', 0.35); D.set('crown.lift', 0);
  D.set('ufo.vis', 0); D.set('ufo.shade', 0); D.set('ufo.hatch', 0); D.set('ufo.beam', 0);
  D.set('sky.mode', 0); D.set('lightning', 0); D.set('facade.break', 0); D.set('mark', 0); D.set('cracks', 0); D.set('barrier.vis', 0);
  D.set('can.x', 5.8); D.set('can.z', 9.0); D.set('can.ry', P / 2); D.set('can.roll', 0); D.set('can.spin', 0); D.set('can.vis', 1);

  // ===================================================================== SCENE 1: DEAR FLARE...
  D.scene('1. Dear Flare...');
  D.location('gregRoom');
  cast(['greg']);
  D.place('greg', 0.55, -1.95, P); D.act('greg', 'write'); D.expr('greg', 'neutral'); props('greg', 'pen');
  D.set('letter.k', 0); D.set('pen.desk', 0); D.set('pen.roll', 0); D.set('room.door', 0); D.set('paper.vis', 1);
  D.music('morning', 0.35, 0, 0.8);
  D.anim('fade', 0, 1.2);
  D.cam(FIX([0.4, 1.16, -2.3], [0.5, 0.79, -2.62], { pos2: [0.66, 1.12, -2.3], look2: [0.62, 0.79, -2.62], fov: 34, ease: 'linear' }));
  D.card('location', 3.2, { text: 'BATTLE WARS HQ  -  BEDROOM  -  MORNING' });
  D.sound('Someone is writing a letter with a pen', 2.4, 3.3);
  D.sfx('scribble', 0.4, 0.5, { repeat: 9, every: 0.8 });
  D.anim('letter.k', 0.19, 4.4, 0.6, 'linear');
  D.wait(5.4);
  D.say('computer', 'Dear Flare,', { label: 'LETTER', dur: 1.8 });
  D.anim('letter.k', 0.97, 5.0, 0, 'linear');
  D.say('computer', 'This seems crazy, but I think I have X-ray vision—', { label: 'LETTER', dur: 4.6 });
  // the door bursts open
  D.set('room.door', 0); D.anim('room.door', 1, 0.35); D.sfx('doorBang', 0, 0.9);
  D.place('aaron', 4.05, 0.7, -P / 2); D.act('aaron', 'pointUp'); D.expr('aaron', 'grin');
  D.music('hq', 0.45, 0, 0.3);
  D.say('aaron', 'WE GOT A MISSION!', { cam: R('aaron', 0, 2.8, 0.15), dur: 1.9 });
  D.act('aaron', 'idle');
  D.look('greg', -1.1, 0, 0.3); D.act('greg', 'sitRelax'); D.expr('greg', 'happy');
  D.cam(FIX([-2.6, 1.9, 1.6], [0.8, 0.9, -2.0], { pos2: [-3.2, 2.1, 2.4], fov: 48 }));
  D.say('greg', 'Yo!', { act: 'sitRelax', dur: 1.3 });
  D.path('aaron', [[2.6, -0.2], [1.9, -1.15]], 1.6);
  D.look('greg', -1.4, 0, 0.5, 0.6);
  D.cam(FIX([-1.4, 1.6, -0.3], [1.2, 1.1, -1.6], { fov: 46 })); D.sound('Aaron walks in, wearing his upgraded blue uniform', 2.0); D.wait(1.8);
  D.faceChar('aaron', 'greg', 0.3); D.expr('aaron', 'neutral');
  D.say('aaron', 'What are you doing?', { cam: R('aaron', -20, 2.3, 0.12), dur: 1.6 });
  D.say('greg', 'Before we go, I think I have X-ray vision.', { cam: R('greg', -95, 1.9, 0.18), expr: 'happy', dur: 2.6 });
  D.expr('aaron', 'tired');
  D.say('aaron', '...', { cam: R('aaron', -20, 2.1, 0.12), act: 'crossArms', dur: 1.6 });
  D.say('greg', 'What?', { cam: R('greg', -95, 1.9, 0.18), expr: 'neutral', dur: 1.2 });
  D.say('aaron', "That's your eyes adjusting to your powers again. Come on!", { cam: R('aaron', -20, 2.3, 0.12), act: 'idle', expr: 'annoyed', dur: 3.0 });
  D.look('greg', -0.6, 0, 0.3);
  D.say('greg', 'No, bro! I looked at the wall and thought I could see through it!', { cam: R('greg', -95, 1.9, 0.18), act: 'sitCheer', expr: 'surprised', dur: 3.2 });
  D.act('greg', 'sitRelax');
  D.faceTo('aaron', 0.6, -3.4, 0.3);
  D.say('aaron', 'You were staring at a glass window.', { cam: FIX([-0.9, 1.45, -1.0], [1.0, 1.2, -2.6], { fov: 46 }), act: 'point', expr: 'tired', dur: 2.4 });
  D.look('greg', 0, -0.1, 0.4);
  D.cam(FIX([0.55, 1.35, -3.15], [0.55, 1.15, -1.95], { fov: 44 })); D.sound('Greg looks at the window... it is definitely glass', 2.0); D.wait(1.5);
  D.say('greg', 'Oh.', { expr: 'neutral', dur: 1.3 });
  D.look('greg', 0, 0.45, 0.4); D.act('greg', 'write');
  D.faceChar('aaron', 'greg', 0.3); D.act('aaron', 'idle');
  D.say('greg', "I'm still sending this to Flare.", { cam: FIX([1.6, 1.5, -1.3], [0.55, 0.95, -2.3], { fov: 44 }), expr: 'smug', dur: 2.2 });
  D.say('aaron', 'GET UP!', { cam: R('aaron', -25, 2.2, 0.12), act: 'yell', expr: 'angry', dur: 1.4 });
  // Aaron drags Greg out by the shoulder
  props('greg'); D.set('pen.desk', 1);
  D.look('greg', 0, 0, 0.2); D.place('greg', 0.85, -1.75, P / 2); D.act('greg', 'dragged'); D.expr('greg', 'shocked');
  D.place('aaron', 1.55, -1.35, P / 2 + 0.3); D.act('aaron', 'dragging'); D.expr('aaron', 'determined');
  D.path('aaron', [[2.4, -0.75], [3.1, -0.2]], 0.55, 0.3); D.path('aaron', [[4.0, 0.65], [5.6, 0.7]], 2.6, 4.1);
  D.path('greg', [[1.8, -1.15], [2.4, -0.6]], 0.55, 0.35); D.path('greg', [[3.5, 0.35], [5.4, 0.62]], 2.6, 4.2);
  D.cam(FIX([-0.6, 1.7, 2.6], [2.8, 1.0, -0.4], { pos2: [0.2, 1.7, 2.8], fov: 48 }));
  D.say('greg', "WAIT! I DIDN'T FINISH MY LETTER!", { dur: 2.0 });
  D.say('aaron', "YOU DON'T HAVE X-RAY VISION!", { dur: 1.8 });
  D.say('greg', "YOU DON'T KNOW THAT!", { dur: 1.6 });
  D.hide('aaron', -0.3); D.hide('greg', -0.2); D.sfx('doorSlam', -0.2, 0.5);
  D.music('none', 0, 0, 0.6);
  // the unfinished letter... and the pen rolls away
  D.cam(FIX([0.66, 1.18, -2.18], [0.68, 0.79, -2.62], { pos2: [0.7, 1.1, -2.24], fov: 40 }));
  D.sound('The room is quiet. The unfinished letter sits on the desk', 2.6); D.wait(2.8);
  D.anim('pen.roll', 1, 1.5, 0, 'in'); D.sfx('penRoll', 0, 0.6); D.sfx('penDrop', 1.3, 0.7);
  D.sound('The pen rolls off the desk', 1.8, 0.3); D.wait(2.0);
  D.anim('fade', 1, 0.3); D.wait(0.35);

  // ===================================================================== TITLE
  D.scene('Title');
  D.location('title');
  cast([]);
  D.set('fade', 0);
  D.set('flashWhite', 0.8); D.anim('flashWhite', 0, 0.6);
  D.music('theme', 0.8, 0, 0.05);
  D.set('title.theme', 0); D.set('title.subText', 'BEHEMOTH AWAKENS'); D.set('title.sub', 0); D.set('title.y', 0.3); D.set('title.subY', -1.1); D.set('title.k', 3.6);
  D.anim('title.k', 1, 0.22, 0.2, 'in'); D.sfx('titleHit', 0.4, 0.9);
  D.anim('title.sub', 1, 0.45, 1.3, 'back'); D.sfx('monsterRoar', 1.3, 0.55);
  D.cam(FIX([0, -0.2, 11.6], [0, -0.3, 0], { pos2: [0, -0.2, 10.8], fov: 40 }));
  D.wait(4.8);
  D.anim('fade', 1, 0.3); D.wait(0.35);

  // ===================================================================== SCENE 2: THE SKY ISN'T NORMAL
  D.scene("2. The Sky Isn't Normal");
  D.location('hqExt');
  cast(['aaron', 'greg']);
  D.set('hq.skyline', 1); D.set('hq.balcony', 1); D.set('hq.clear', 1); D.set('hq.doors', 0); D.set('hq.doorBroken', 0); D.set('evening', 0); D.set('night', 0); D.set('hcar.vis', 0);
  for (const c of TEAM) { D.act(c, 'idle'); D.expr(c, 'neutral'); D.set(`${c}.y`, 0); }
  D.anim('fade', 0, 0.5);
  D.music('hq', 0.5, 0, 0.3);
  D.anim('hq.doors', 1, 0.5); D.sfx('doorOpen', 0, 0.6);
  D.place('aaron', -0.4, -3.7, 0); D.place('greg', 0.5, -3.75, 0);
  D.path('aaron', [[-1.5, -0.4]], 1.5, 0.3); D.path('greg', [[1.0, -0.6]], 1.4, 0.45);
  D.cam(FIX([0.5, 2.0, 10.5], [0, 4.6, -5], { pos2: [0.3, 1.8, 9.0], fov: 50 }));
  D.card('location', 3.0, { text: 'BATTLE WARS HQ  -  OUTSIDE' });
  D.sound('Aaron and Greg step outside. The headquarters stands tall behind them', 3.0); D.wait(3.3);
  D.anim('hq.doors', 0, 0.6);
  D.face('aaron', 0.5, 0.3); D.face('greg', -0.6, 0.3);
  D.cam(F(['aaron', 'greg'], 25, 3.0, -0.3, { yaw2: -20, lookY: -0.45, fov: 46 }));
  D.sound('Their blue uniforms have been upgraded: brighter glowing accents and reinforced armor', 3.2); D.wait(3.4);
  D.say('greg', "Okay, so what's the mission?", { cam: R('greg', -25, 2.3, 0.12), dur: 2.0 });
  D.say('aaron', "We received a strange signal from the city. Something's happening in the sky.", { cam: R('aaron', 25, 2.3, 0.12), act: 'pointUp', dur: 3.6 });
  D.act('aaron', 'idle');
  D.say('greg', 'Is it another alien?', { cam: R('greg', -25, 2.3, 0.12), expr: 'surprised', dur: 1.7 });
  D.say('aaron', 'Probably not.', { cam: R('aaron', 25, 2.3, 0.12), act: 'shrug', dur: 1.5 });
  D.say('greg', 'You said that last time!', { cam: R('greg', -25, 2.3, 0.12), act: 'point', expr: 'annoyed', dur: 1.9 });
  D.act('greg', 'idle'); D.act('aaron', 'idle');
  // Flare leaps from the balcony
  D.place('flare', 4.5, -3.05, 0.2); D.set('flare.y', 6.7); D.act('flare', 'cheer'); D.expr('flare', 'grin');
  D.say('flare', 'MAKE WAY!', { cam: FIX([2.2, 1.4, 4.2], [4.5, 7.2, -3.2], { fov: 46 }), dur: 1.4 });
  D.act('flare', 'dive'); arc('flare', 2.3, -0.4, 0, 1.0, 0.9);
  D.cam(FIX([-1.2, 1.5, 5.5], [2.2, 2.0, -1.0], { fov: 52 })); D.sfx('whoosh', 0, 0.7); D.wait(1.0);
  D.act('flare', 'heroLand'); D.sfx('fireLand', 0, 1.0); D.shake(0.3, 0.4);
  D.fx('fire', { x: 2.3, y: 0.05, z: -0.4, dur: 0.9, size: 0.7 });
  D.fx('fireCircle', { x: 2.3, z: -0.4, radius: 0.7, dur: 0.9, size: 0.4, light: 12 });
  D.act('greg', 'jumpScare'); D.expr('greg', 'shocked'); D.face('greg', 1.4, 0.2);
  D.comic('FWOOSH!', 0, 0.9, { x: 0.6, y: 0.35, size: 90, rot: 6, c1: '#fff0a0', c2: '#ff6a20' });
  D.wait(1.2);
  D.act('flare', 'idle'); D.face('flare', -1.3, 0.3);
  D.say('flare', 'Perfect landing.', { cam: R('flare', 20, 2.2, 0.12), act: 'handsHips', expr: 'smug', dur: 1.7 });
  D.say('greg', 'You almost landed on my foot!', { cam: R('greg', 30, 2.2, 0.12), act: 'point', expr: 'annoyed', dur: 2.0 });
  D.say('flare', 'Details.', { cam: R('flare', 20, 2.2, 0.12), expr: 'smug', dur: 1.3 });
  D.act('greg', 'idle'); D.act('flare', 'idle');
  // Eric charges out as a tiger
  D.anim('hq.doors', 1, 0.3); D.sfx('doorOpen', 0, 0.6);
  D.place('eric', 0, -3.6, 0); D.act('eric', 'fistPump'); D.expr('eric', 'grin');
  D.cam(FIX([0.2, 1.5, 3.2], [0, 1.2, -3.6], { fov: 46 })); D.wait(0.6);
  toTiger(0); D.wait(0.3);
  D.set('tiger.act', 'roar');
  D.say('eric', 'ROOOOAR!', { label: 'ERIC (TIGER)', dur: 1.6 });
  D.sfx('tigerRoar', -1.5, 0.9);
  D.set('tiger.act', 'run');
  { const pts = []; for (let i = 0; i <= 14; i++) { const a = -P / 2 + (i / 14) * P * 2; pts.push([0.4 + Math.cos(a) * 3.4, -1.2 + Math.sin(a) * 2.6 + (i === 0 ? 0 : 0)]); } pts[0] = [0.4, -3.4]; pts.push([-1.0, 0.6], [-2.6, 0.3]); D.path('tiger', pts, 7.0); }
  for (const c of ['aaron', 'greg', 'flare']) D.expr(c, 'surprised');
  D.cam(FIX([0.4, 3.6, 7.5], [0.2, 0.4, -1.0], { fov: 50 })); D.sound('The tiger runs a full circle around the team', 2.2); D.wait(3.4);
  D.set('tiger.act', 'idle'); D.face('tiger', 0, 0.2);
  toEric(0.2, 'fistPump'); D.wait(0.5);
  D.expr('eric', 'grin');
  D.say('eric', "All right! I'm ready!", { cam: R('eric', 0, 2.3, 0.12), dur: 1.8 });
  D.act('eric', 'idle'); D.anim('hq.doors', 0, 0.5);
  for (const c of ['aaron', 'greg', 'flare']) { D.faceChar(c, 'eric', 0.3); D.expr(c, 'neutral'); }
  D.faceChar('eric', 'aaron', 0.3, 0.5);
  D.say('aaron', 'Why did you turn into a tiger just to walk outside?', { cam: R('aaron', 50, 2.2, 0.12), act: 'armsOut', expr: 'annoyed', dur: 2.8 });
  D.say('eric', 'Because I can.', { cam: R('eric', -55, 2.2, 0.12), act: 'shrug', expr: 'smug', dur: 1.6 });
  D.say('greg', 'Fair enough.', { cam: R('greg', 45, 2.2, 0.12), act: 'shrug', dur: 1.4 });
  for (const c of ['aaron', 'eric', 'greg']) D.act(c, 'idle');
  // CRASH: Leon bursts through the doors
  D.set('hq.doors', 1, 0.05); D.set('hq.doorBroken', 1, 0.05); D.sfx('doorsCrash', 0, 1.0); D.shake(0.5, 0.5);
  D.comic('CRASH!', 0.05, 0.9, { x: 0.5, y: 0.3, size: 110, rot: -8 });
  D.place('leon', 0, -3.6, 0); D.act('leon', 'punch'); D.expr('leon', 'determined');
  D.fx('debris', { x: 0, y: 1.2, z: -3.4, n: 20, color: 0x2a3a8a, color2: 0x8fc8f0 });
  for (const c of ['aaron', 'eric', 'greg', 'flare']) { D.faceTo(c, 0, -3.6, 0.2); D.act(c, 'jumpScare'); D.expr(c, 'shocked'); }
  D.cam(FIX([0.8, 1.6, 2.8], [0, 1.4, -3.5], { fov: 50 })); D.wait(0.6);
  D.path('leon', [[-0.2, -1.6]], 3.5);
  D.say('leon', "EVERYBODY MOVE! WE'VE GOT A PROBLEM!", { cam: R('leon', 0, 3.0, 0.15), act: 'yell', expr: 'angry', dur: 2.4 });
  for (const c of ['aaron', 'eric', 'greg']) D.act(c, 'idle');
  D.say('flare', 'LEON! THE DOORS!', { cam: R('flare', -20, 2.2, 0.12), act: 'point', expr: 'shocked', dur: 1.7 });
  D.cam(FIX([1.5, 1.5, -0.8], [0, 1.5, -3.8], { fov: 44 })); D.sound('One door hangs crooked from its hinges', 1.6); D.wait(1.4);
  D.say('leon', "I'LL FIX THEM LATER!", { cam: R('leon', 15, 2.6, 0.12), act: 'armsOut', expr: 'worried', dur: 1.7 });
  D.say('flare', 'YOU SAID THAT LAST WEEK!', { cam: R('flare', -20, 2.2, 0.12), act: 'armsOut', expr: 'annoyed', dur: 1.9 });
  D.act('flare', 'idle'); D.act('leon', 'idle');
  // Leon looks up... the UFO
  D.set('ufo.vis', 1); D.set('ufo.x', 0); D.set('ufo.y', 80); D.set('ufo.z', 118); D.set('ufo.size', 62);
  D.face('leon', 0, 0.5); D.act('leon', 'lookUp'); D.expr('leon', 'surprised');
  D.say('leon', '...What is that?', { cam: R('leon', 0, 2.0, -0.1, { lookY: 0.05 }), dur: 1.9 });
  D.place('eric', -3.0, 0.4, 0); D.place('aaron', -1.6, 0.0, 0); D.place('greg', 1.1, 0.0, 0); D.place('flare', 2.5, 0.3, 0); D.place('leon', -0.2, 0.6, 0);
  for (const c of TEAM) { D.act(c, 'lookUp'); D.expr(c, 'surprised'); }
  D.music('ominous', 0.55, 0, 0.5);
  D.sfx('ufoHum', 0, 0.9); D.sfx('drone', 0.3, 0.5);
  D.anim('ufo.shade', 1, 2.5, 0.3);
  D.cam(FIX([0.3, 1.05, -3.2], [0, 26, 60], { pos2: [0.3, 0.9, -3.8], fov: 64 }));
  D.sound('A gigantic UFO hovers above the city, blocking the sunlight', 3.2); D.wait(3.6);
  D.cam(FIX([2, 1.6, 4], [0, 80, 118], { pos2: [2, 1.6, 4.5], fov: 30 }));
  D.sound('Blue and purple lights flash across its metal surface', 2.6); D.wait(2.8);
  D.say('greg', "That's definitely not a weather balloon.", { cam: R('greg', 0, 2.0, -0.05), dur: 2.4 });
  D.act('aaron', 'ready'); D.expr('aaron', 'determined');
  D.say('aaron', 'Everybody, get ready.', { cam: R('aaron', 0, 2.2, 0.0), dur: 1.8 });
  for (const c of TEAM) D.act(c, 'ready');
  D.cam(FIX([2, 1.6, 4], [0, 77, 118], { fov: 22 }));
  D.anim('ufo.hatch', 1, 1.2); D.anim('ufo.beam', 1, 0.8, 0.8); D.sfx('hatchOpen', 0, 0.9);
  D.sound('The UFO opens a hatch underneath itself', 2.0); D.wait(2.0);
  D.fx('dark', { from: [0, 72, 118], to: [6, 10, 70], dur: 1.6, size: 1.8, arc: 0.2, debris: 0 });
  D.sfx('fallWhistle', 0, 0.8);
  D.cam(FIX([2, 1.6, 4], [3, 40, 95], { fov: 34 }));
  D.sound('Something small and metallic drops from the sky', 1.8); D.wait(1.6);
  // the crash in the intersection
  D.location('downtown');
  cast([]);
  D.set('ufo.x', 0); D.set('ufo.y', 85); D.set('ufo.z', -70); D.set('ufo.size', 60); D.set('ufo.hatch', 1); D.set('ufo.beam', 0.5);
  D.place('beh', 0, 0, P / 2); D.set('beh.y', 30); D.set('beh.curl', 1); D.set('beh.rear', 0); D.set('beh.look', 0);
  D.anim('beh.y', 0, 0.6, 0, 'in');
  D.cam(FIX([4, 3.0, 22], [0, 2.5, 0], { fov: 46 }));
  D.wait(0.6);
  D.sfx('boom', 0, 1.0); D.shake(0.9, 0.8); D.set('cracks', 1); D.set('cracks.x', 0); D.set('cracks.z', 0); D.set('cracks.size', 4);
  D.fx('dustCloud', { x: 0, z: 0, radius: 4, dur: 3.6, n: 80, size: 0.9, h: 2.5 });
  D.fx('debris', { x: 0, y: 0.3, z: 0, n: 40 });
  D.comic('BOOM!', 0, 1.2, { x: 0.5, y: 0.32, size: 130, rot: -6 });
  D.card('location', 3.0, { text: 'AETHERFALL CITY  -  INTERSECTION' });
  D.wait(1.4);
  // the team runs up
  for (const [c, x, z, dt] of [['eric', -2.8, 4.4, 0], ['aaron', -1.3, 3.6, 0.1], ['leon', 0.2, 4.7, 0.2], ['greg', 1.4, 3.7, 0.05], ['flare', 2.8, 4.3, 0.15]]) {
    D.place(c, x * 1.3, z + 14, P); D.act(c, 'idle'); D.expr(c, 'determined');
    D.path(c, [[x, z]], 6.0, dt);
  }
  D.cam(FIX([1.5, 1.4, 10.5], [0, 0.6, 0], { fov: 44 }));
  D.sound('Dust rises around the creature...', 2.2); D.wait(2.6);
  D.anim('beh.curl', 0, 1.6); D.anim('beh.rear', 0.2, 1.4, 0.3); D.anim('beh.look', -0.3, 1.0, 1.4);
  for (const c of TEAM) D.expr(c, 'neutral');
  D.cam(F(['beh'], 35, 0.75, 0.05, { lookY: -0.05, dist2: 0.6, fov: 42 }));
  D.sound('As the dust clears, they see a small, worm-like dragon covered in metallic armor', 3.4); D.wait(3.6);
  D.cam(F(['beh'], 80, 0.55, 0.06, { lookY: -0.02, fov: 40 }));
  D.sound('Glowing eyes, sharp metal plates, tiny claws... and a strange crown on its head', 3.2); D.wait(3.2);
  D.anim('beh.jaw', 0.4, 0.2); D.anim('beh.jaw', 0, 0.3, 0.6); D.sfx('tinyGrowl', 0, 0.8);
  D.cam(F(['beh'], 70, 0.5, 0.05, { lookY: -0.03, fov: 40 }));
  D.sound('The creature lets out a tiny growl', 1.6); D.wait(1.8);
  D.say('greg', '...', { cam: R('greg', 0, 1.6, 0.0), expr: 'neutral', dur: 1.1 });
  D.say('eric', '...', { cam: R('eric', 0, 1.6, 0.0), dur: 1.1 });
  D.say('flare', '...', { cam: R('flare', 0, 1.6, 0.0), dur: 1.1 });
  D.say('aaron', 'Is this what we were fighting?', { cam: R('aaron', 10, 2.0, 0.05), expr: 'tired', dur: 2.0 });
  D.act('aaron', 'crossArms');
  D.say('aaron', "This wasn't a threat.", { cam: F(['aaron', 'greg'], 175, 3.2, 0.2), expr: 'smug', dur: 1.9 });
  D.anim('beh.jaw', 0.3, 0.1); D.anim('beh.jaw', 0, 0.2, 0.3); D.sfx('squeak', 0, 0.8);
  D.cam(F(['beh'], 75, 0.45, 0.04, { lookY: -0.03, fov: 40 })); D.sound('The tiny creature squeaks', 1.5); D.wait(1.6);
  D.say('greg', "Bro, I've seen bigger worms in the garden.", { cam: R('greg', -15, 2.0, 0.08), act: 'laugh', expr: 'laugh', dur: 2.6 });
  D.act('greg', 'idle');
  D.anim('beh.look', -1.6, 1.6); D.anim('beh.nod', -0.15, 1.6);
  D.cam(F(['beh'], 15, 0.6, 0.02, { lookY: -0.02, fov: 38 })); D.sound('The creature slowly turns its head toward them', 2.2); D.wait(2.4);
  D.say('eric', 'I think it heard you.', { cam: R('eric', 0, 2.0, 0.05), expr: 'worried', dur: 1.8 });
  D.say('greg', "GOOD. MAYBE IT'LL GO HOME!", { cam: R('greg', 0, 2.0, 0.05), act: 'yell', expr: 'angry', dur: 2.0 });
  D.act('greg', 'idle');
  // the crown flashes... the sky goes black
  D.anim('crown.glow', 4, 0.3); D.sfx('crownFlash', 0, 1.0);
  D.set('flashViolet', 0.6); D.anim('flashViolet', 0, 0.6);
  D.cam(F(['beh'], 10, 0.42, 0.06, { lookY: 0.0, fov: 36 }));
  D.sound("The creature's crown flashes purple", 1.6); D.wait(1.4);
  D.set('sky.mode', 1); D.set('ufo.vis', 0); D.set('lightning', 1);
  D.sfx('thunder', 0, 1.0); D.sfx('rumbleDeep', 0.2, 0.8);
  D.music('none', 0, 0, 0.2);
  D.cam(FIX([1.5, 1.2, 12], [0, 6, -10], { fov: 60 }));
  for (const c of TEAM) { D.act(c, 'lookUp'); D.expr(c, 'shocked'); }
  D.sound('The entire sky goes black', 2.0); D.wait(2.2);
  D.anim('crown.glow', 1.2, 0.8);

  // ===================================================================== SCENE 3: THE MONSTER THAT GROWS
  D.scene('3. The Monster That Grows');
  D.music('villain', 0.5, 0, 0.5);
  D.card('lightning', 5.0, { n: 4 });
  D.sfx('thunder', 0.4, 0.8); D.sfx('thunder', 2.6, 0.6);
  D.fx('bolt', { x: -30, z: -40, y: 20, dur: 0.3, size: 1.5 }, 0.5); D.fx('bolt', { x: 35, z: -60, y: 25, dur: 0.3, size: 1.5 }, 2.7);
  D.cam(FIX([0, 1.0, 13], [0, 9, -20], { pos2: [0.5, 1.2, 12], fov: 62 }));
  D.sound('Purple lightning cracks across the sky. A massive shadow stretches across the buildings', 3.4); D.wait(3.6);
  for (const c of TEAM) { D.act(c, 'look'); D.expr(c, 'worried'); }
  D.look('aaron', 0.6, -0.2, 0.6); D.look('eric', -0.7, -0.1, 0.8); D.look('greg', 0.5, -0.3, 0.7); D.look('flare', -0.5, -0.2, 0.6); D.look('leon', 0.3, -0.35, 0.6);
  D.sfx('echo', 0, 0.5);
  D.say('soul', 'You all will meet your fate.', { label: 'SOUL STEALER (V.O.)', cam: F(['aaron', 'leon', 'greg'], 180, 4.2, 0.4, { lookY: -0.2 }), dur: 2.6 });
  D.look('aaron', -0.5, -0.25, 0.8); D.look('eric', 0.4, -0.3, 0.8); D.look('greg', -0.4, -0.1, 0.8); D.look('flare', 0.6, -0.3, 0.6);
  D.say('soul', 'This is Behemoth. A monster waiting to enlarge.', { label: 'SOUL STEALER (V.O.)', cam: F(['eric', 'aaron'], 165, 3.4, 0.3, { lookY: -0.2 }), dur: 3.2 });
  D.say('soul', 'You will give me your power!', { label: 'SOUL STEALER (V.O.)', cam: F(['beh'], 10, 0.45, 0.05, { lookY: -0.02, fov: 36 }), dur: 2.4 });
  for (const c of TEAM) { D.look(c, 0, 0, 0.3); D.act(c, 'ready'); D.expr(c, 'determined'); }
  D.say('aaron', 'Not today! We just noticed!', { cam: R('aaron', 0, 2.2, 0.08), act: 'fistsClench', dur: 2.0 });
  D.say('greg', 'Yeah! We literally just got here!', { cam: R('greg', 0, 2.2, 0.08), act: 'point', expr: 'angry', dur: 2.0 });
  // Greg's eyes turn red
  D.act('greg', 'idle'); D.anim('greg.redEyes', 1, 0.4); D.sfx('powerUp', 0, 0.7);
  D.cam(R('greg', 0, 1.0, 0.05, { lookY: 0.0, fov: 34 })); D.sound("Greg's eyes suddenly turn bright red", 1.8); D.wait(1.8);
  D.say('greg', 'WHOA. WHY ARE MY EYES DOING THAT?!', { act: 'jumpScare', expr: 'shocked', dur: 2.2 });
  D.act('greg', 'blastPose'); D.expr('greg', 'shocked');
  D.fx('aura', { who: 'greg', side: 'R', dur: 5.0, color: 0xff3030, power: 1.3 }); D.fx('aura', { who: 'greg', side: 'L', dur: 5.0, color: 0xff3030, power: 1.3 });
  D.sfx('energyCharge', 0, 0.8);
  D.cam(R('greg', 30, 2.4, 0.1)); D.sound('Red energy builds around his hands', 1.6); D.wait(1.6);
  D.say('aaron', 'Greg, control it!', { cam: R('aaron', -20, 2.2, 0.1), act: 'point', expr: 'worried', dur: 1.6 });
  D.say('greg', "I'M TRYING!", { cam: R('greg', 30, 2.2, 0.1), expr: 'shocked', dur: 1.4 });
  {
    const r = rigAt(0.3);
    D.fx('beam', { who: 'greg', side: 'R', to: [r.head[0], r.head[1], r.head[2]], dur: 0.9, color: 0xff3030, width: 0.28 }, 0.3);
    D.sfx('bigBlast', 0.3, 0.9); D.set('flashRed', 0.45, 0.3); D.anim('flashRed', 0, 0.5, 0.3);
    D.say('greg', 'TAKE THAT!', { cam: FIX([4.4, 1.2, 6.4], [0.3, 0.6, 1.2], { fov: 50 }), act: 'blastPose', expr: 'angry', dur: 1.5, dt: 0.1 });
    D.fx('sparks', { x: r.head[0], y: r.head[1], z: r.head[2], n: 60, color: 0xff5040, speed: 2.4 }, -0.3);
    D.anim('beh.x', -1.6, 0.5, -0.3, 'out'); D.anim('beh.rear', 0.05, 0.3, -0.3); D.anim('beh.rear', 0.2, 0.6, 0.3);
    D.sfx('slideScrape', -0.3, 0.7);
  }
  D.act('greg', 'idle');
  for (const c of TEAM) { D.act(c, 'idle'); D.expr(c, 'surprised'); }
  D.cam(FIX([-2.2, 0.45, -2.2], [0, 1.0, 3.8], { fov: 50 }));
  D.sound('The tiny creature slides backward several feet. For one second, everyone stares', 3.2); D.wait(3.4);
  D.say('eric', "...That's it?", { cam: R('eric', 0, 2.0, 0.05), expr: 'tired', dur: 1.6 });
  D.say('flare', 'We might actually be finished before lunch.', { cam: R('flare', -10, 2.2, 0.08), act: 'handsHips', expr: 'smug', dur: 2.6 });
  // KRRRRMMMM: it grows
  D.music('behemoth', 0.65, 0, 0.3);
  D.anim('crown.glow', 4, 0.4); D.sfx('metalGrow', 0, 1.0); D.sfx('growRumble', 0.3, 0.9);
  D.comic('KRRRRRRMMMMM!', 0.2, 1.6, { x: 0.5, y: 0.3, size: 96, rot: -4, c1: '#e8c8ff', c2: '#a040ff' });
  D.cam(F(['beh'], 15, 0.6, 0.05, { lookY: -0.02, dist2: 2.2, fov: 40 })); D.wait(1.6);
  const GROW = 5.4;
  D.anim('beh.s', 40, GROW, 0, 'in'); D.anim('beh.z', -14, GROW, 0); D.anim('beh.x', 0, GROW, 0); D.anim('beh.ry', 0, GROW * 0.8, 0);
  D.anim('beh.look', 0, GROW, 0); D.anim('beh.nod', 0, GROW, 0); D.anim('beh.rear', 0.9, GROW, 0); D.anim('beh.plates', 1, GROW * 0.7, GROW * 0.2); D.anim('beh.claws', 2.2, GROW, 0);
  D.shake(0.6, GROW + 1);
  D.sfx('metalCrash', 1.5, 0.6); D.sfx('rumbleDeep', 2.0, 0.9); D.sfx('metalCrash', 3.5, 0.7);
  for (const [c, x, z, dt] of [['eric', -5.6, 13.5, 0.3], ['aaron', -2.6, 11.5, 0.2], ['leon', 0.2, 13.0, 0.4], ['greg', 2.6, 12.0, 0.1], ['flare', 5.4, 13.6, 0.3]]) {
    D.act(c, 'idle'); D.expr(c, 'shocked'); D.path(c, [[x, z]], 3.6, dt); D.face(c, P, 0.4, dt + 2.9);
  }
  D.cam(FIX([7, 1.4, 27], [0, 9, -6], { pos2: [6, 1.5, 29], look2: [0, 13, -6], fov: 58 }));
  D.sound('Its metal plates stretch and lock into place', 2.0, 0.2);
  D.sound('Its tail grows longer. Its claws become enormous', 2.0, 2.4);
  D.wait(GROW + 0.2);
  D.cam(FIX([3, 0.7, 24], [0, 16, -4], { fov: 60 }));
  D.sound('Within seconds, Behemoth towers over the street', 2.0); D.wait(1.6);
  roar(2.6, 'RRRRRRAAAAAAAAHHHH!', { cam: FIX([2, 0.9, 22], [0, 18, 0], { fov: 56 }), shake: 1.0 });
  D.sfx('glassCrack', -2.2, 0.7);
  for (const c of TEAM) D.act(c, 'cover');
  D.say('greg', "OH, THAT'S NOT GOOD!", { cam: R('greg', 10, 2.2, 0.1), act: 'jumpScare', expr: 'shocked', dur: 1.8 });
  D.say('eric', 'YOU THINK?!', { cam: R('eric', -10, 2.2, 0.1), act: 'armsOut', expr: 'angry', dur: 1.5 });
  // tail slam
  {
    D.anim('beh.tailLift', 1, 0.9); D.anim('beh.tailLift', 0, 0.22, 1.0, 'in');
    D.cam(FIX([22, 3.5, 14], [0, 6, -22], { fov: 58 })); D.sfx('whoosh', 0.4, 0.8);
    D.wait(1.2);
    const tail = rigAt(0).pts[2];
    D.sfx('tailSlam', 0, 1.0); D.shake(1.2, 1.0);
    D.fx('ring', { x: tail[0], z: tail[2], y: 0.3, radius: 26, dur: 1.0, color: 0xc8b8a0 });
    D.fx('dustCloud', { x: tail[0], z: tail[2], radius: 6, dur: 3.0, n: 60, size: 1.4, h: 3 });
    D.fx('debris', { x: tail[0], y: 0.5, z: tail[2], n: 40, size: 3, spread: 2 });
    D.set('cracks.x', tail[0]); D.set('cracks.z', tail[2]); D.set('cracks.size', 16);
    D.comic('SLAM!', 0, 1.0, { x: 0.45, y: 0.35, size: 120, rot: 8 });
    for (const c of TEAM) D.act(c, 'stumble');
    D.wait(1.0);
  }
  D.say('leon', 'EVERYBODY, SPREAD OUT!', { cam: R('leon', 0, 2.4, 0.12), act: 'yell', expr: 'angry', dur: 1.9 });
  for (const [c, x, z] of [['eric', -6.2, 16], ['aaron', -3.2, 14.5], ['greg', 3.0, 15.0], ['flare', 6.2, 16.5], ['leon', 0.3, 17.5]]) { D.act(c, 'idle'); D.path(c, [[x, z]], 5.5); D.face(c, P, 0.3, 0.8); }
  D.cam(FIX([0, 2.5, 30], [0, 3, 10], { fov: 48 })); D.sound('The team scatters', 1.6); D.wait(1.5);
  D.say('aaron', 'So much for it not being a threat!', { cam: R('aaron', 20, 2.2, 0.1), expr: 'annoyed', dur: 2.1 });
  D.say('greg', "I'M SORRY! I DIDN'T KNOW IT HAD A GROWTH SPURT!", { cam: R('greg', -20, 2.2, 0.1), act: 'armsOut', expr: 'worried', dur: 2.8 });
  D.say('flare', 'IT JUST GREW FIFTY TIMES ITS SIZE!', { cam: R('flare', -20, 2.2, 0.1), act: 'point', expr: 'shocked', dur: 2.3 });
  D.say('greg', 'THEN STOP COUNTING AND RUN!', { cam: R('greg', -20, 2.2, 0.1), act: 'yell', expr: 'angry', dur: 1.9 });
  for (const c of TEAM) D.act(c, 'ready');
  D.anim('beh.look', 0.2, 1.2); D.anim('beh.nod', 0.35, 1.2);
  D.cam(FIX([1.5, 1.0, 21], [0, 15, 0], { fov: 56 })); D.sound('Behemoth turns toward them', 1.6); D.wait(1.6);
  D.say('aaron', 'All right, team. We need to figure out what that crown does!', { cam: R('aaron', 20, 2.3, 0.1), expr: 'determined', dur: 3.0 });
  D.say('leon', 'First, we keep it away from the buildings!', { cam: R('leon', 0, 2.4, 0.1), act: 'point', expr: 'determined', dur: 2.4 });
  D.act('leon', 'ready');
  roar(2.2, 'RRRRRAAAAAHHH!', { cam: FIX([-4, 1.2, 24], [0, 16, 0], { fov: 58 }), after: 0.2 });

  // ===================================================================== SCENE 4: THE FIRST BATTLE
  D.scene('4. The First Battle');
  D.music('action', 0.6, 0, 0.2);
  D.set('beh.sway', 0.25);
  // Eric's tiger charge... and the headbutt
  toTiger(0); D.wait(0.4);
  D.set('tiger.act', 'run');
  D.say('eric', "LET'S SEE HOW YOU HANDLE THIS!", { label: 'ERIC (TIGER)', cam: R('tiger', -30, 3.4, 0.3, { lookY: -0.3 }), dur: 2.0 });
  D.path('tiger', [[-6.5, 8], [-5.5, 2]], 9.0);
  D.cam(FIX([-11, 1.4, 14], [-4, 3, -2], { fov: 54 })); D.wait(1.0);
  D.anim('beh.look', -0.75, 0.6); D.anim('beh.rear', 0.25, 0.6); D.anim('beh.nod', 0.75, 0.6);
  {
    const r = rigAt(0.6);
    D.set('tiger.act', 'leap');
    arc('tiger', r.head[0] - 0.8, r.head[2] + 1.2, r.head[1] - 1.0, 0.6, 1.2);
    D.cam(FIX([-14, 3, 10], [r.head[0], r.head[1] - 1, r.head[2]], { fov: 52 }));
    D.wait(0.6);
    D.sfx('punchHit', 0, 1.0); D.sfx('metalCrash', 0.02, 0.6); D.shake(0.5, 0.4);
    D.comic('BONK!', 0, 0.8, { x: 0.45, y: 0.35, size: 110, rot: -10 });
    D.anim('beh.look', -0.35, 0.3); D.anim('beh.nod', 0.2, 0.5);
    D.set('tiger.act', 'tumble');
    arc('tiger', 5.8, 9.0, 0.6, 1.4, 4.0);
  }
  D.say('eric', 'WHOAAAAAA!', { label: 'ERIC (TIGER)', cam: FIX([0, 4, 22], [3, 3, 5], { fov: 58 }), dur: 1.5 });
  D.hide('tiger');
  D.set('can.shake', 1); D.anim('can.shake', 0, 0.8); D.sfx('trashClang', 0, 1.0);
  D.comic('CLANG!', 0, 0.9, { x: 0.55, y: 0.35, size: 110, rot: 8 });
  D.anim('can.roll', 1, 0.35, 0.3); D.anim('can.z', 11.4, 1.4, 0.5, 'out'); D.anim('can.spin', -4, 1.4, 0.5, 'out'); D.set('can.lid', 0, 0.3);
  D.sfx('trashRoll', 0.5, 0.8);
  D.cam(FIX([2.6, 1.3, 13.6], [5.8, 0.4, 10.4], { fov: 46 })); D.sound('He lands directly inside a large trash can. It rolls several feet', 2.6); D.wait(2.2);
  D.say('eric', "I'M OKAY!", { label: 'ERIC (IN THE TRASH CAN)', dur: 1.5 });
  D.wait(0.6);
  D.say('eric', 'I THINK!', { label: 'ERIC (IN THE TRASH CAN)', dur: 1.3 });
  D.expr('aaron', 'tired'); D.faceTo('aaron', 5.8, 11.4, 0.3); D.act('aaron', 'idle');
  D.say('aaron', "I'm not even going to ask.", { cam: R('aaron', 0, 2.2, 0.08), dur: 2.0 });
  D.face('aaron', P, 0.3); D.act('aaron', 'ready'); D.expr('aaron', 'determined');
  D.say('aaron', 'I got this!', { cam: R('aaron', 0, 2.2, 0.08), act: 'fistPump', dur: 1.4 });
  // Aaron + Leon sprint in, Leon throws Aaron
  D.act('aaron', 'idle'); D.act('leon', 'idle');
  D.path('aaron', [[-1.6, 9.4]], 6.5); D.path('leon', [[-0.6, 9.8]], 6.0);
  D.cam(FIX([-6, 1.4, 20], [-1, 4, 6], { fov: 54 }));
  D.say('leon', 'GET READY!', { dur: 1.5, dt: 0.2 });
  D.face('leon', P, 0.2); D.act('leon', 'liftOver'); D.expr('leon', 'determined');
  { const [lx, lz] = pos('leon'); D.place('aaron', lx, lz - 0.05, P); D.set('aaron.y', 1.65); D.act('aaron', 'carried'); D.expr('aaron', 'shocked'); }
  D.sfx('whoosh', 0, 0.5);
  D.say('aaron', "WAIT! YOU'RE THROWING ME?!", { cam: FIX([2.2, 2.2, 13.5], [-0.6, 2.2, 9.6], { fov: 48 }), dur: 2.0 });
  D.say('leon', 'TRUST ME!', { cam: R('leon', 25, 3.4, -0.7, { lookY: 0.45, fov: 46 }), dur: 1.3 });
  D.say('aaron', "THAT'S WHAT I'M WORRIED ABOUT!", { cam: FIX([2.2, 2.2, 13.5], [-0.6, 2.2, 9.6], { fov: 48 }), dur: 2.0 });
  {
    const r = rigAt(0);
    D.act('leon', 'throwOver'); D.sfx('whoosh', 0.1, 1.0); D.sfx('punchHit', 0.05, 0.4);
    D.act('aaron', 'fly', 0.1);
    D.anim('aaron.x', r.mouth[0] + 0.8, 1.3, 0.12, 'linear'); D.anim('aaron.z', r.mouth[2] + 2.6, 1.3, 0.12, 'linear'); D.anim('aaron.y', r.mouth[1] - 1.6, 1.3, 0.12, 'out');
    D.cam(FIX([5, 3, 22], [0, 12, 6], { pos2: [4, 6, 18], look2: [0, 18, 6], fov: 56 }));
    D.wait(1.4);
    D.act('aaron', 'blastPose');
    D.fx('flashBurst', { x: r.mouth[0], y: r.mouth[1] + 0.6, z: r.mouth[2] + 1.0, radius: 3, dur: 0.9, color: 0x7fd4ff, light: 80 });
    D.set('flash', 0.85); D.anim('flash', 0, 0.7); D.sfx('blueFlash', 0, 1.0);
    D.say('aaron', 'BLUE FLASH!', { cam: FIX([5, r.mouth[1] - 1, r.mouth[2] + 9], [r.mouth[0], r.mouth[1], r.mouth[2]], { fov: 50 }), dur: 1.4 });
    D.comic('FLASH!', -1.3, 0.9, { x: 0.4, y: 0.3, size: 110, rot: -6, c1: '#ffffff', c2: '#7fd4ff' });
    D.anim('beh.shake', 1, 0.2); D.anim('beh.rear', 0.7, 0.6); D.anim('beh.z', -16, 0.8);
    D.act('aaron', 'flail'); arc('aaron', -1.8, 8.5, 0, 1.2, 0.5);
  }
  roar(1.8, 'RRRRAAAAAH!', { cam: FIX([8, 2, 24], [0, 16, -2], { fov: 54 }), nod: -0.2 });
  D.act('aaron', 'heroLand'); D.sfx('thud', 0, 0.8);
  D.anim('beh.shake', 0, 0.6);
  D.cam(FIX([2, 2.6, 26], [0, 12, -4], { fov: 54 })); D.sound('Behemoth staggers backward, shaking its head', 1.8); D.wait(1.6);
  D.act('leon', 'fistPump'); D.expr('leon', 'grin');
  D.say('leon', 'NICE SHOT!', { cam: R('leon', 0, 2.4, 0.1), dur: 1.4 });
  D.act('leon', 'idle'); D.act('aaron', 'idle');
  // Greg flies in and stretches
  D.act('greg', 'fly'); D.expr('greg', 'grin');
  fly('greg', 6.5, 9, 3.0, 2.0);
  D.say('greg', 'MY TURN!', { cam: R('greg', -30, 3.0, 0.2), dur: 1.4 });
  D.cam(FIX([14, 4, 18], [4, 10, 2], { fov: 54 })); D.wait(0.8);
  {
    const r = rigAt(0);
    const n1 = behBack(r, 0.78), n2 = behBack(r, 0.86);
    D.act('greg', 'stretchArms'); D.face('greg', -P / 2 - 0.5, 0.3);
    D.set('greg.tLx', n1[0] - 4.5); D.set('greg.tLy', n1[1]); D.set('greg.tLz', n1[2] - 3); D.set('greg.tRx', n2[0] - 4.5); D.set('greg.tRy', n2[1] + 1.5); D.set('greg.tRz', n2[2] + 3);
    D.set('greg.sag', -0.6); D.set('greg.bendL', 0.6); D.set('greg.bendR', -0.6);
    D.anim('greg.stretch', 1, 1.0); D.sfx('stretchBoing', 0, 0.9);
    D.say('greg', "I'M GOING TO WRAP THIS GUY UP!", { cam: FIX([16, 8, 12], [2, 12, -2], { fov: 56 }), dur: 2.2 });
    D.fx('web', { x: n1[0], y: (n1[1] + n2[1]) / 2, z: (n1[2] + n2[2]) / 2, radius: 5.5, rings: 6, gap: 1.6, dur: 4.4, size: 1.6 });
    D.sfx('energyCharge', 0, 0.7); D.sfx('crystalHum', 0.3, 0.6);
    D.say('greg', 'BARRIER MODE!', { cam: FIX([18, 6, 20], [0, 13, -3], { fov: 54 }), dur: 1.6 });
    D.say('greg', 'HA! GOT YOU!', { cam: R('greg', 0, 2.8, 0.2), act: 'stretchArms', expr: 'laugh', dur: 1.5 });
  }
  // it twists... and Greg gets pulled into its mouth
  D.anim('beh.look', 0.55, 0.8); D.anim('beh.rear', 0.75, 0.8); D.sfx('metalCrash', 0, 0.5);
  D.expr('greg', 'shocked'); D.act('greg', 'flail');
  {
    const r = rigAt(1.2);
    fly('greg', r.mouth[0] + 2.5, r.mouth[1] + 0.4, r.mouth[2] + 2.0, 1.4);
    D.say('greg', 'WAIT. WAIT. WAIT—', { cam: FIX([16, 12, 20], [3, 16, 2], { fov: 54 }), dur: 1.6 });
    D.anim('beh.jaw', 1, 0.3);
    D.anim('greg.stretch', 0, 0.4);
    fly('greg', r.mouth[0], r.mouth[1], r.mouth[2], 0.6, 0, 'in');
    D.say('greg', 'AAAAAAAAAAAAAAH!', { cam: FIX([r.mouth[0] + 12, r.mouth[1] - 2, r.mouth[2] + 12], [r.mouth[0], r.mouth[1], r.mouth[2]], { fov: 48 }), dur: 1.0 });
    D.hide('greg', -0.4);
    D.anim('beh.jaw', 0, 0.2, -0.35); D.sfx('gulp', -0.3, 1.0);
    D.comic('GULP!', -0.3, 1.0, { x: 0.55, y: 0.3, size: 110, rot: 6, c1: '#e8c8ff', c2: '#a040ff' });
  }
  D.music('comedy', 0.35, 0, 0.3);
  for (const c of ['flare', 'aaron', 'leon']) { D.act(c, 'idle'); D.expr(c, 'shocked'); }
  D.cam(F(['aaron', 'leon', 'flare'], 180, 6, 0.6, { lookY: -0.3 })); D.sound('Everyone freezes', 1.4); D.wait(1.4);
  D.say('flare', '...', { cam: R('flare', 0, 1.6, 0.05), dur: 1.0 });
  D.say('aaron', '...', { cam: R('aaron', 0, 1.6, 0.05), dur: 1.0 });
  D.say('leon', '...', { cam: R('leon', 0, 1.6, 0.05), dur: 1.0 });
  // Eric climbs out of the trash can
  D.place('eric', 5.4, 12.2, -0.6); D.act('eric', 'getUp'); D.expr('eric', 'shocked'); D.set('eric.scuff', 1);
  D.say('eric', 'DID HE JUST GET EATEN?!', { cam: FIX([3.0, 1.2, 15.0], [5.6, 0.8, 11.8], { fov: 46 }), dur: 1.9 });
  D.act('eric', 'idle');
  D.say('aaron', 'GREG?!', { cam: R('aaron', 0, 2.2, 0.1), act: 'yell', dur: 1.3 });
  D.anim('beh.shake', 0.25, 0.2);
  D.say('greg', "I'M INSIDE SOMETHING!", { label: 'GREG (INSIDE BEHEMOTH)', cam: FIX([10, 4, 24], [0, 17, 2], { fov: 46 }), dur: 1.8 });
  D.say('aaron', 'WE NOTICED!', { cam: R('aaron', 0, 2.2, 0.1), act: 'armsOut', expr: 'annoyed', dur: 1.4 });
  D.say('greg', 'IT SMELLS TERRIBLE IN HERE!', { label: 'GREG (INSIDE BEHEMOTH)', cam: FIX([10, 4, 24], [0, 17, 2], { fov: 40 }), dur: 1.9 });
  D.faceTo('eric', 0, 2, 0.3);
  D.say('eric', "THAT'S WHAT YOU GET FOR TRYING TO WRAP UP A DRAGON!", { cam: R('eric', 0, 2.3, 0.1), act: 'point', expr: 'laugh', dur: 2.8 });
  D.act('eric', 'idle');
  D.music('action', 0.55, 0, 0.3);
  D.anim('beh.shake', 1, 0.3); D.anim('beh.sway', 1.2, 0.3); D.sfx('metalCrash', 0.2, 0.6); D.sfx('bossRoar', 0.4, 0.6);
  D.cam(FIX([12, 2, 26], [0, 15, 0], { fov: 54 })); D.sound('Behemoth shakes violently', 1.4); D.wait(1.0);
  D.say('greg', "I'M GETTING OUT! I'M GETTING OUT!", { label: 'GREG (INSIDE BEHEMOTH)', dur: 2.2 });
  D.anim('beh.shake', 0, 0.4); D.anim('beh.sway', 0.25, 0.4);
  {
    const r = rigAt(0.3);
    D.anim('beh.jaw', 1, 0.3);
    D.place('greg', r.mouth[0], r.mouth[2], 0, 0.35); D.set('greg.y', r.mouth[1], 0.35); D.set('greg.slime', 1, 0.35); D.act('greg', 'flail', 0.35); D.expr('greg', 'disgust', 0.35);
    D.set('greg.redEyes', 0, 0.35);
    D.sfx('slimeSplat', 0.35, 1.0);
    D.fx('sparks', { x: r.mouth[0], y: r.mouth[1], z: r.mouth[2], n: 60, color: 0xb050ff, speed: 3 }, 0.35);
    arc('greg', 3.2, 9.5, 0, 1.4, 2.0, 0.4);
    D.fx('slimeDrip', { who: 'greg', dur: 14 }, 0.4);
    D.cam(F(['greg'], 40, 9, 1.0, { lookY: -0.5, fov: 54 }));
    D.sound('Greg stretches back out of its mouth, covered in glowing purple slime', 2.4, 0.3);
    D.wait(1.8);
    D.anim('beh.jaw', 0, 0.4);
    D.act('greg', 'lieBack'); D.sfx('slimeSplat', 0, 0.8); D.sfx('thud', 0, 0.7); D.shake(0.3, 0.3);
    D.comic('SPLAT!', 0, 0.9, { x: 0.5, y: 0.35, size: 100, rot: -6, c1: '#e8c8ff', c2: '#a040ff' });
    D.wait(0.9);
  }
  D.say('greg', 'I AM NEVER DOING THAT AGAIN.', { cam: FIX([4.4, 0.9, 11.6], [3.2, 0.3, 9.5], { fov: 46 }), dur: 2.0 });
  D.act('greg', 'getUp'); D.place('flare', 5.2, 11.6, -2.2); D.act('flare', 'handsHips'); D.expr('flare', 'smug');
  D.say('flare', 'You say that about everything.', { cam: R('flare', 15, 2.2, 0.1), dur: 1.9 });
  D.act('greg', 'idle'); D.faceChar('greg', 'flare', 0.3);
  D.say('greg', 'THIS TIME I MEAN IT!', { cam: R('greg', -20, 2.0, 0.1), act: 'yell', expr: 'angry', dur: 1.7 });
  // it stomps forward, team falls back, the facade
  D.act('greg', 'idle'); D.act('flare', 'idle');
  D.anim('beh.z', -12.5, 1.6); D.anim('beh.rear', 0.6, 1.6); D.sfx('boom', 0, 0.6); D.sfx('boom', 0.8, 0.6); D.shake(0.7, 1.8);
  D.cam(FIX([3, 0.6, 22], [0, 12, -8], { fov: 58 })); D.sound('Behemoth stomps forward', 1.4); D.wait(1.0);
  D.say('leon', 'FALL BACK! WE NEED A PLAN!', { cam: R('leon', 0, 2.4, 0.1), act: 'yell', expr: 'angry', dur: 1.9 });
  for (const [c, x, z] of [['aaron', -3, 22], ['leon', -1.0, 23], ['greg', 3.4, 22.5], ['flare', 4.8, 23], ['eric', 6.0, 21.5]]) { D.act(c, 'idle'); D.expr(c, 'worried'); D.path(c, [[x, z]], 5.0); }
  {
    D.anim('beh.ry', -1.25, 1.3); D.anim('beh.look', -0.2, 1.3); D.anim('beh.rear', 0.3, 1.3); D.anim('beh.nod', 0.35, 1.3); D.anim('beh.x', -4, 1.3);
    D.cam(FIX([-8, 2.5, 26], [-20, 7, -6], { fov: 56 })); D.wait(1.3);
    D.set('facade.break', 1); D.sfx('metalCrash', 0, 0.9); D.sfx('boom', 0.05, 1.0); D.sfx('glassShatter', 0.1, 0.7); D.shake(1.0, 0.9);
    D.fx('debris', { x: -24, y: 6, z: -8, n: 60, size: 6, spread: 3, up: 1.5, color: 0xc8b8a0, color2: 0x8a8078 });
    D.fx('dustCloud', { x: -24, z: -6.5, radius: 8, dur: 3.6, n: 80, size: 2.2, h: 6 });
    D.comic('KRASH!', 0, 1.0, { x: 0.35, y: 0.3, size: 120, rot: -8 });
    D.sound('It smashes through an empty building facade', 2.0); D.wait(2.2);
  }
  for (const c of TEAM) D.face(c, P, 0.3);
  D.say('aaron', "We're not defeating this thing with regular attacks!", { cam: R('aaron', 20, 2.4, 0.1), expr: 'determined', dur: 2.6 });
  D.sfx('monsterRoar', 0, 0.45); D.anim('beh.jaw', 0.8, 0.3); D.anim('beh.jaw', 0, 0.4, 1.4);
  D.cam(FIX([0, 2.2, 38], [-12, 8, -6], { fov: 50 })); D.sound('The monster roars in the distance', 1.6); D.wait(1.8);
  D.say('aaron', 'We need to find out what that crown does.', { cam: R('aaron', 10, 2.0, 0.08), dur: 2.4 });
  D.anim('fade', 1, 0.5); D.wait(0.6);

  // ===================================================================== SCENE 5: THE CROWN THEORY
  D.scene('5. The Crown Theory');
  D.location('parkRuin');
  cast(['aaron', 'flare', 'eric', 'greg', 'leon', 'beh']);
  D.set('fade', 0); D.set('lightning', 0); D.set('greg.stretch', 0);
  D.place('beh', -26, 66, P / 2); D.set('beh.s', 40); D.set('beh.rear', 0.8); D.set('beh.nod', 0.2); D.set('beh.look', 0); D.set('beh.sway', 0.4); D.set('beh.jaw', 0); D.set('beh.shake', 0);
  D.anim('beh.x', 18, 95, 0, 'linear');
  { const C = [0.3, -0.9]; for (const [c, a] of [['eric', -72], ['greg', -36], ['flare', 0], ['aaron', 36], ['leon', 72]]) { const r = a * P / 180; D.place(c, C[0] + Math.sin(r) * 1.75, C[1] + Math.cos(r) * 1.75, r + P); } }
  for (const c of TEAM) { D.expr(c, 'tired'); D.act(c, 'crouchHide'); }
  D.act('greg', 'sitFloor'); D.act('eric', 'brushOff');
  D.music('mystery', 0.35, 0, 0.5);
  D.cam(FIX([0.4, 2.3, -6.5], [0, 5, 30], { pos2: [0.4, 2.0, -5.5], fov: 58 }));
  D.card('location', 3.0, { text: 'DAMAGED CITY PARK  -  LATER' });
  D.sound('The team takes cover behind a concrete barrier. Behemoth patrols the street several blocks away', 3.6); D.wait(3.8);
  const HC = [0.3, -0.9];
  const HA = { eric: -72, greg: -36, flare: 0, aaron: 36, leon: 72 };
  const hcam = (c, side = 0) => { const r = (HA[c] + side) * P / 180, hh = c === 'greg' ? 0.78 : 1.08; return FIX([HC[0] + Math.sin(r) * 0.2, 1.05, HC[1] + Math.cos(r) * 0.2], [HC[0] + Math.sin(HA[c] * P / 180) * 1.75, hh, HC[1] + Math.cos(HA[c] * P / 180) * 1.75], { fov: 44 }); };
  const heads = (who) => { for (const c of Object.keys(HA)) if (c !== who) D.look(c, -Math.sign(HA[who] - HA[c]) * Math.min(0.9, Math.abs(HA[who] - HA[c]) / 80), 0, 0.3); D.look(who, 0, 0, 0.3); };
  heads('eric');
  D.say('eric', 'Okay. New rule. Nobody gets eaten.', { cam: hcam('eric'), act: 'brushOff', expr: 'annoyed', dur: 2.4 });
  D.act('eric', 'crouchHide'); heads('greg');
  D.say('greg', "I DIDN'T PLAN ON IT!", { cam: hcam('greg'), expr: 'angry', dur: 1.6 });
  heads('eric');
  D.say('eric', 'You flew directly into its mouth!', { cam: hcam('eric'), dur: 2.0 });
  heads('greg');
  D.say('greg', 'I THOUGHT I WAS MAKING A BARRIER!', { cam: hcam('greg'), expr: 'angry', dur: 2.0 });
  heads('flare');
  D.say('flare', 'Perhaps the barrier should have been made around the monster instead of inside it.', { cam: hcam('flare'), expr: 'smug', dur: 3.6 });
  heads('greg');
  D.say('greg', 'THANK YOU, FLARE. VERY HELPFUL.', { cam: hcam('greg'), expr: 'annoyed', dur: 2.2 });
  // Leon's wrist display
  heads('leon');
  D.act('leon', 'checkWrist'); D.expr('leon', 'serious'); D.sfx('computerBeep', 0, 0.6);
  D.say('leon', 'Look at this.', { cam: hcam('leon'), dur: 1.5 });
  D.card('wrist', 9.4);
  D.sfx('zoomBeep', 0.3, 0.6); D.sfx('holoChime', 1.6, 0.5);
  D.cam(FIX([HC[0] + 0.9, 1.6, HC[1] - 0.6], [2.0, 0.9, -0.4], { fov: 46 })); D.sound('He zooms in on the crown', 1.6); D.wait(1.8);
  D.say('aaron', 'The crown is glowing every time it changes size.', { dur: 2.7 });
  D.say('leon', "Exactly. The crown isn't just decoration. It's controlling the monster's size.", { dur: 3.8 });
  D.act('leon', 'crouchHide'); heads('flare');
  D.say('flare', 'So if we remove it, we can shrink Behemoth?', { cam: hcam('flare'), expr: 'surprised', dur: 2.4 });
  heads('leon');
  D.say('leon', "That's our best theory.", { cam: hcam('leon'), expr: 'serious', dur: 1.8 });
  heads('eric');
  D.say('eric', 'And how do we get a crown off a giant metal dragon that just ate Greg?', { cam: hcam('eric'), act: 'armsOut', expr: 'annoyed', dur: 3.4 });
  D.act('eric', 'crouchHide'); heads('greg');
  D.say('greg', "It didn't eat me! I was briefly inside it!", { cam: hcam('greg'), expr: 'angry', dur: 2.4 });
  heads('eric');
  D.say('eric', "THAT'S WORSE!", { cam: hcam('eric'), expr: 'shocked', dur: 1.4 });
  heads('aaron');
  D.say('aaron', 'We distract it, get to the crown, and pull it off.', { cam: hcam('aaron'), expr: 'determined', dur: 2.8 });
  heads('leon');
  D.say('leon', 'Carefully. If the crown controls its size, removing it could make things unpredictable.', { cam: hcam('leon'), expr: 'serious', dur: 3.8 });
  heads('flare');
  D.say('flare', 'What could possibly go wrong?', { cam: hcam('flare'), expr: 'happy', dur: 1.9 });
  for (const c of ['greg', 'eric', 'leon', 'aaron']) D.expr(c, 'annoyed');
  D.cam(FIX([HC[0], 2.4, HC[1] - 2.6], [HC[0], 0.8, HC[1] + 0.8], { fov: 54 })); D.sound('Everyone stares at Flare', 1.6); D.wait(1.8);
  D.say('flare', 'Right. Sorry.', { cam: hcam('flare'), expr: 'worried', dur: 1.5 });
  D.sfx('monsterRoar', 0, 0.4); D.anim('beh.jaw', 0.8, 0.3); D.anim('beh.jaw', 0, 0.5, 1.5);
  for (const c of TEAM) { D.look(c, 0, 0, 0.2); D.face(c, 0, 0.4); D.expr(c, 'determined'); }
  D.cam(FIX([1.5, 1.8, -4.0], [-4, 14, 60], { fov: 46 })); D.sound("Behemoth's roar echoes across the city", 2.0); D.wait(2.2);
  for (const c of TEAM) D.act(c, 'idle');
  D.say('aaron', "Let's move.", { cam: FIX([2.6, 1.5, -1.8], [1.3, 1.2, 0.4], { fov: 46 }), dur: 1.4 });
  D.anim('fade', 1, 0.5); D.wait(0.6);

  // ===================================================================== SCENE 6: REMOVING THE CROWN
  D.scene('6. Removing the Crown');
  D.location('downtown');
  cast(['beh']);
  D.set('fade', 0); D.set('sky.mode', 2); D.set('lightning', 0); D.set('facade.break', 1);
  D.set('cracks', 1); D.set('cracks.x', 0); D.set('cracks.z', -34); D.set('cracks.size', 16);
  D.set('can.vis', 1); D.set('can.roll', 1); D.set('can.x', 5.8); D.set('can.z', 11.4);
  D.place('beh', 0, -10, 0); D.set('beh.s', 40); D.set('beh.rear', 0.55); D.set('beh.nod', 0.1); D.set('beh.look', 0); D.set('beh.sway', 0.25); D.set('beh.jaw', 0); D.set('beh.shake', 0);
  D.set('crown.glow', 1.4);
  D.music('heroic', 0.55, 0, 0.4);
  D.cam(FIX([10, 2.5, 30], [0, 14, -4], { pos2: [8, 2.2, 28], fov: 52 }));
  D.card('location', 3.0, { text: 'CITY CENTER  -  EVENING' });
  D.sound('Behemoth stands in the middle of the street. Its crown glows with purple runes', 3.4); D.wait(3.6);
  for (const [c, x0, z0, x, z] of [['aaron', -2, 28, -3, 9], ['leon', -18, 6, -6, 5], ['flare', 18, 8, 6.5, 6.5], ['eric', -26, 1.5, -14, 1.5]]) {
    D.place(c, x0, z0, 0); D.act(c, 'idle'); D.expr(c, 'determined'); D.path(c, [[x, z]], 6.5); D.faceTo(c, 0, -6, 0.3, 3.2);
  }
  D.place('greg', 14, 20, -2.4); D.set('greg.y', 9); D.act('greg', 'fly'); D.expr('greg', 'determined');
  fly('greg', 8, 11, 10, 3.0);
  D.cam(FIX([0, 3.5, 34], [0, 6, 0], { fov: 58 })); D.sound('The team approaches from different directions', 2.0); D.wait(3.2);
  D.act('greg', 'hover');
  D.say('leon', 'Positions!', { cam: R('leon', 10, 2.4, 0.1), act: 'point', dur: 1.3 });
  D.act('leon', 'ready');
  // Eric distracts it as a tiger
  toTiger(0); D.wait(0.4);
  D.set('tiger.act', 'roar'); D.sfx('tigerRoar', 0, 0.9);
  D.say('eric', 'HEY, METAL HEAD!', { label: 'ERIC (TIGER)', cam: R('tiger', -40, 3.6, 0.3, { lookY: -0.3 }), dur: 1.7 });
  D.set('tiger.act', 'run');
  D.anim('beh.look', -0.6, 0.8); D.anim('beh.nod', 0.4, 0.8);
  D.path('tiger', [[-8, 3], [-4, 10], [3, 5], [7, 11], [10, 4]], 9.5);
  D.anim('beh.look', 0.4, 1.4, 0.9); D.anim('beh.look', -0.3, 1.2, 2.4);
  D.cam(FIX([-16, 3.5, 22], [0, 7, 2], { pos2: [-12, 3, 24], fov: 58 })); D.sound('Eric runs between its legs, distracting it', 2.4); D.wait(3.6);
  D.set('beh.sway', 0); D.anim('beh.look', 0, 0.6);
  D.set('tiger.act', 'idle');
  D.say('leon', 'NOW!', { cam: R('leon', 10, 2.4, 0.1), act: 'yell', dur: 1.0 });
  {
    const r = rigAt(0);
    const b1 = behBack(r, 0.6), b2 = behBack(r, 0.74);
    D.act('leon', 'dive'); arc('leon', b1[0] - 0.4, b1[2], b1[1], 1.1, 3.0); D.sfx('whoosh', 0, 0.8); D.sfx('punchHit', 0, 0.4);
    D.cam(FIX([-14, 4, 10], [-3, 6, -4], { fov: 54 })); D.wait(1.1);
    D.act('leon', 'heroLand'); D.sfx('metalCrash', 0, 0.5); D.face('leon', 0, 0.2);
    D.sound('Leon leaps onto Behemoth’s back with his super strength', 1.8); D.wait(1.9);
    D.act('leon', 'climb');
    D.anim('leon.x', b2[0] - 0.4, 2.0, 0, 'linear'); D.anim('leon.y', b2[1], 2.0, 0, 'linear'); D.anim('leon.z', b2[2], 2.0, 0, 'linear');
    D.cam(FIX([-10, 8, 6], [0, 8, -3], { pos2: [-9, 9, 7], fov: 52 })); D.sound('He climbs toward the crown', 1.6); D.wait(2.0);
    D.act('leon', 'idle');
    D.say('leon', 'Aaron, I need a boost!', { cam: FIX([b2[0] - 9, b2[1] + 1.5, b2[2] + 6], [b2[0], b2[1] + 1.3, b2[2]], { fov: 34 }), act: 'point', dur: 1.8 });
    D.say('aaron', 'ON IT!', { cam: R('aaron', 20, 2.4, 0.1), act: 'oneHandBlast', dur: 1.2 });
    D.fx('beam', { who: 'aaron', side: 'R', to: [b2[0] - 0.4, b2[1], b2[2]], dur: 0.6, color: 0x4aa8ff, width: 0.18 });
    D.sfx('beamFire', 0, 0.8);
    const c = r.crown;
    D.act('leon', 'cheer', 0.4); arc('leon', c[0], c[2] - 1.7, c[1] + 0.15, 1.0, 2.0, 0.4); D.sfx('whoosh', 0.4, 0.8);
    D.fx('flashBurst', { x: b2[0], y: b2[1], z: b2[2], radius: 1.5, dur: 0.6, color: 0x4aa8ff, light: 30 }, 0.45);
    D.cam(FIX([-12, 10, 18], [0, 15, 4], { fov: 52 })); D.sound('A controlled blue blast launches Leon up to Behemoth’s head', 2.2); D.wait(1.5);
    D.act('leon', 'heave'); D.face('leon', 0, 0.1); D.sfx('clunk', 0, 0.8);
    D.say('leon', 'GOT IT!', { cam: FIX([c[0] - 7, c[1] + 3.2, c[2] - 5], [c[0], c[1] + 1.2, c[2] - 1.0], { fov: 40 }), expr: 'determined', dur: 1.4 });
  }
  D.anim('beh.shake', 0.12, 0.3); D.sfx('bossRoar', 0, 0.8); D.shake(0.6, 1.8);
  D.anim('beh.jaw', 1, 0.3);
  D.say('behemoth', 'RRRRAAAAAHHH!', { cam: FIX([6, 3, 32], [0, 15, 4], { fov: 48 }), dur: 1.8 });
  D.anim('beh.jaw', 0, 0.3); D.anim('beh.shake', 0.06, 0.3);
  D.say('leon', 'SOMEBODY HOLD IT STILL!', { cam: FIX([-6.5, 21.5, 4.5], [0, 19.6, 8.4], { fov: 38 }), dur: 1.9 });
  // Flare's fire rings + Greg wraps the neck
  {
    const r = rigAt(0);
    const L1 = r.pts[10], L2 = r.pts[14];
    D.act('flare', 'fireRings'); D.expr('flare', 'determined');
    D.fx('flame', { who: 'flare', side: 'R', dur: 4.0, size: 0.22 }); D.fx('flame', { who: 'flare', side: 'L', dur: 4.0, size: 0.22 });
    D.fx('fireCircle', { x: (L1[0] + L2[0]) / 2, z: (L1[2] + L2[2]) / 2, offsets: [[-3.4, -4.2], [3.4, -4.2], [-3.4, 4.2], [3.4, 4.2]], n: 4, radius: 2.2, dur: 12, size: 1.2, light: 40 }, 0.5);
    D.sfx('fireRoar', 0.5, 0.9); D.sfx('flameIgnite', 0.4, 0.8);
    D.say('flare', "YOU'RE NOT GOING ANYWHERE!", { cam: R('flare', -55, 3.0, 0.1), dur: 2.0 });
    D.cam(FIX([14, 2.5, 8], [0, 3, -8], { fov: 54 })); D.sound('Glowing rings of fire wrap around Behemoth’s legs', 2.0); D.wait(2.0);
    const n1 = behBack(r, 0.8), n2 = behBack(r, 0.86);
    fly('greg', n1[0] + 6.5, n1[1] + 3, n1[2] + 1, 1.2); D.act('greg', 'stretchArms');
    D.set('greg.tLx', n1[0] - 4); D.set('greg.tLy', n1[1] - 1); D.set('greg.tLz', n1[2] - 2.5); D.set('greg.tRx', n2[0] - 4); D.set('greg.tRy', n2[1]); D.set('greg.tRz', n2[2] + 2.5);
    D.set('greg.sag', -0.4); D.set('greg.bendL', 0.5); D.set('greg.bendR', -0.5);
    D.anim('greg.stretch', 1, 0.8, 1.0); D.sfx('stretchBoing', 1.0, 0.8); D.face('greg', -P / 2, 0.3);
    D.say('greg', 'LEON! PULL!', { cam: FIX([16, 13, 16], [1, 15, 2], { fov: 52 }), dur: 1.8, dt: 0.4 });
  }
  D.act('leon', 'heave'); D.anim('crown.lift', 0.5, 1.4); D.sfx('valveCreak', 0, 0.8); D.sfx('metalCrash', 0.6, 0.4);
  D.cam(FIX([-7, 22, 5], [0, 19.6, 9], { fov: 40 })); D.sound('Leon pulls the crown upward. It begins to detach', 2.0); D.wait(1.6);
  D.say('aaron', 'ALMOST THERE!', { cam: R('aaron', 20, 2.4, 0.1), act: 'fistsClench', dur: 1.5 });
  D.anim('crown.lift', 1.1, 0.5); D.wait(0.5);
  D.set('crown.mode', 'leon'); D.set('crown.size', 1.12); D.act('leon', 'holdHigh');
  D.sfx('crownCrack', 0, 1.0); D.shake(0.6, 0.6);
  D.comic('KRAAAK!', 0, 1.0, { x: 0.5, y: 0.3, size: 120, rot: -6, c1: '#e8c8ff', c2: '#a040ff' });
  D.cam(FIX([-7, 22.5, 5], [0, 20, 9], { fov: 42 })); D.sound('With one final effort, Leon removes the crown', 2.0); D.wait(1.6);
  D.anim('greg.stretch', 0, 0.6); D.act('greg', 'hover');
  D.set('beh.sway', 0); D.set('beh.slither', 0); D.anim('beh.shake', 0, 0.2);
  D.music('none', 0, 0, 0.4);
  D.cam(FIX([10, 2, 30], [0, 13, 0], { fov: 50 })); D.sound('For a moment, Behemoth becomes completely still', 2.2); D.wait(2.4);
  // it shrinks
  {
    const SH = 3.4;
    D.anim('beh.s', 6, SH, 0, 'inout'); D.anim('beh.rear', 0.4, SH, 0); D.anim('crown.size', 0.42, SH, 0); D.anim('crown.glow', 0.8, SH, 0);
    ride('leon', 0.84, SH, 10, 0, 0.05);
    fly('greg', 6, 4, 2, SH);
    D.sfx('shrink', 0, 1.0); D.sfx('growRumble', 0, 0.5);
    D.music('victory', 0.5, 0.4, 0.3);
    D.cam(FIX([12, 3, 26], [0, 8, -4], { pos2: [10, 2.0, 18], look2: [0, 2, -7], fov: 52 }));
    D.sound('Its body begins shrinking', 1.6, 0.2);
    D.say('eric', "IT'S WORKING!", { label: 'ERIC (TIGER)', dur: 1.6, dt: 0.4 });
    D.say('greg', "WE'RE ACTUALLY DOING IT!", { dur: 1.6 });
    D.wait(0.2);
    D.cam(FIX([7, 2.2, 3], [0, 1.6, -8], { fov: 50 }));
    D.sound('Behemoth shrinks to the size of a truck', 1.8); D.wait(1.2);
  }
  D.say('flare', 'SUCCESS!', { cam: R('flare', -20, 2.4, 0.1), act: 'fistPump', expr: 'grin', dur: 1.4 });
  D.expr('leon', 'serious');
  D.say('leon', 'Everybody, back away!', { cam: R('leon', 0, 3.2, 0.2, { lookY: 0.2 }), dur: 1.8 });
  // the crown flashes... it grows again
  D.music('darkTheme', 0.6, 0, 0.2);
  D.anim('crown.glow', 5, 0.3); D.sfx('crownFlash', 0, 1.0); D.sfx('energyCharge', 0, 0.7);
  D.set('flashViolet', 0.35); D.anim('flashViolet', 0, 0.4);
  D.act('aaron', 'reach'); D.expr('aaron', 'shocked');
  D.say('aaron', 'Leon! DROP IT!', { cam: R('aaron', 20, 2.4, 0.1), dur: 1.6 });
  {
    const [lx, lz] = pos('leon');
    const ly = D.val('leon.y', D.now);
    D.fx('ring', { x: lx, z: lz, y: ly + 1, radius: 22, dur: 1.0, color: 0xb040ff });
    D.fx('sphere', { x: lx, z: lz, y: ly + 1, radius: 12, dur: 1.0, color: 0xa040ff });
    D.set('flashViolet', 0.7); D.anim('flashViolet', 0, 0.6); D.sfx('shockwave', 0, 1.0); D.shake(1.0, 0.8);
    for (const c of ['aaron', 'flare']) D.act(c, 'cover');
    D.cam(FIX([9, 2, 8], [0, 1.5, -7], { fov: 50 })); D.sound('The crown releases a powerful purple shockwave', 2.0); D.wait(1.6);
    D.anim('crown.glow', 1.6, 0.6);
    D.anim('beh.eyesRed', 1, 0.3); D.anim('beh.eyes', 2, 0.3); D.sfx('eyesOpen', 0, 0.8);
    D.cam(F(['beh'], 15, 4.0, 0.1, { lookY: -0.05, fov: 40 })); D.sound("Behemoth's eyes flare red", 1.6); D.wait(1.6);
  }
  {
    const GR = 3.6;
    D.music('behemoth', 0.7, 0, 0.2);
    D.anim('beh.s', 65, GR, 0, 'in'); D.anim('beh.rear', 0.95, GR, 0); D.anim('beh.dark', 1, GR, 0); D.anim('beh.cracks', 1, GR, 0.5); D.anim('beh.plates', 1.4, GR, 0); D.anim('beh.bolts', 1, 0.5, GR - 0.5); D.anim('beh.claws', 2.6, GR, 0);
    D.sfx('metalGrow', 0, 1.0); D.sfx('growRumble', 0.2, 1.0); D.sfx('rumbleDeep', 1.2, 0.9); D.shake(0.9, GR + 0.6);
    ride('leon', 0.84, 1.0, 4, 0, 0.05);
    D.act('leon', 'tumble', 1.0);
    arc('leon', -4.5, 9, 0, 1.4, 6, 1.0);
    D.fx('sparks', { x: -4.5, y: 0.3, z: 9, n: 30, color: 0xc8b8a0, speed: 2 }, 2.4);
    D.sfx('thud', 2.4, 1.0); D.sfx('punchHit', 2.4, 0.5);
    D.cam(FIX([16, 1.2, 30], [0, 6, -6], { pos2: [14, 1.4, 34], look2: [0, 18, -4], fov: 58 }));
    D.say('eric', 'WAIT! WHY IS IT GETTING BIGGER?!', { label: 'ERIC (TIGER)', dur: 2.2, dt: 0.2 });
    D.wait(Math.max(0, GR - 2.6));
  }
  D.act('leon', 'sitFloor'); D.expr('leon', 'worried');
  D.say('leon', 'THE CROWN WAS LIMITING ITS POWER!', { cam: R('leon', 10, 2.2, 0.1), dur: 2.2 });
  D.say('flare', 'YOU MEAN WE JUST MADE IT STRONGER?!', { cam: R('flare', -20, 2.4, 0.1), act: 'armsOut', expr: 'shocked', dur: 2.2 });
  D.say('greg', 'WE TOOK OFF ITS HAT AND IT GOT ANGRY!', { cam: R('greg', -30, 2.8, 0.2), act: 'flail', expr: 'shocked', dur: 2.3 });
  D.act('greg', 'hover');
  D.cam(FIX([6, 0.6, 34], [0, 22, 0], { fov: 64 }));
  D.sound('Behemoth towers above the tallest buildings. Its armor turns dark, and purple lightning runs through its body', 3.8); D.wait(3.6);
  roar(2.4, 'RRRRRRRAAAAAAAAAAAHHHH!', { cam: FIX([10, 2, 36], [0, 30, 6], { fov: 56 }), shake: 1.4 });
  D.say('aaron', 'LEON!', { cam: R('aaron', 20, 2.4, 0.1), act: 'reach', expr: 'shocked', dur: 1.2 });
  D.act('aaron', 'idle'); D.path('aaron', [[-3.6, 9.6]], 6.0); D.faceChar('aaron', 'leon', 0.2, 0.2);
  D.act('leon', 'getUp', 0.6);
  D.cam(FIX([-1.5, 1.2, 13.6], [-4.2, 0.8, 9.2], { fov: 46 })); D.sound('Aaron rushes to help him', 1.4); D.wait(1.4);
  D.act('aaron', 'kneel');
  D.say('leon', "I'm okay.", { cam: R('leon', 30, 2.0, 0.05), dur: 1.4 });
  D.act('leon', 'idle'); D.act('aaron', 'idle'); D.faceTo('leon', 0, 0, 0.4); D.act('leon', 'lookUp');
  D.say('leon', "But we're in trouble.", { cam: R('leon', 10, 2.0, 0.0, { lookY: 0.05 }), expr: 'worried', dur: 2.0 });
  // the energy wave
  {
    D.anim('beh.nod', -0.6, 0.6); D.anim('beh.jaw', 1, 0.5);
    D.sfx('energyCharge', 0, 0.9);
    D.cam(FIX([8, 1, 36], [0, 32, 10], { fov: 58 })); D.wait(1.0);
    const r = rigAt(0);
    D.fx('sphere', { x: r.head[0], y: r.head[1], z: r.head[2], radius: 60, dur: 1.4, color: 0xa040ff });
    D.fx('ring', { x: 0, z: 4, y: 1.0, radius: 40, dur: 1.2, color: 0xb050ff });
    D.set('flashViolet', 0.8); D.anim('flashViolet', 0, 0.8); D.sfx('energyWave', 0, 1.0); D.sfx('boom', 0.1, 0.9); D.shake(1.5, 1.0);
    for (const c of ['aaron', 'flare', 'leon', 'greg']) { D.act(c, 'knockBack'); const [x, z] = pos(c); D.anim(`${c}.x`, x * 1.1, 0.6, 0, 'out'); D.anim(`${c}.z`, z + 4.5, 0.6, 0, 'out'); }
    D.anim('greg.y', 0, 0.6, 0, 'in');
    { const [tx, tz] = pos('tiger'); D.set('tiger.act', 'tumble'); D.anim('tiger.z', tz + 4, 0.6, 0, 'out'); D.anim('tiger.x', tx, 0.6); }
    D.cam(FIX([2, 1.6, 22], [0, 6, 4], { fov: 60 }));
    D.sound('Behemoth releases a powerful energy wave. The entire team is knocked backward', 2.4); D.wait(1.2);
    D.anim('beh.nod', 0, 0.8); D.anim('beh.jaw', 0, 0.6);
  }
  D.set('fade', 1); D.music('none', 0, 0, 0.1); D.wait(1.5);

  // ===================================================================== SCENE 7: THE POWER DRAIN
  D.scene('7. The Power Drain');
  toEric(0, 'lieBack');
  D.place('aaron', -3.4, 15.0, P); D.place('leon', -5.0, 13.6, P); D.place('flare', 4.0, 15.5, P); D.place('greg', 0.8, 16.5, P); D.place('eric', -0.5, 14.0, P);
  for (const c of TEAM) { D.act(c, 'lieBack'); D.expr(c, 'tired'); D.set(`${c}.y`, 0); D.set(`${c}.scuff`, 1); }
  D.set('crown.mode', 'leon'); D.set('crown.size', 0.42); D.set('crown.glow', 1.2);
  D.set('beh.nod', 0.1); D.set('beh.sway', 0.2); D.set('beh.slither', 0.3);
  D.anim('fade', 0, 0.8);
  D.music('ominous', 0.5, 0, 0.5);
  for (const [c, dt] of [['aaron', 0.4], ['eric', 1.0], ['flare', 0.8], ['greg', 1.6], ['leon', 1.2]]) D.act(c, 'getUp', dt);
  D.cam(FIX([1, 1.6, 23], [0, 3, 8], { pos2: [0.6, 1.8, 22], look2: [0, 12, 4], fov: 58 }));
  D.sound('The team slowly gets back to its feet. Behemoth is now enormous, with glowing purple cracks in its armor', 3.8); D.wait(3.6);
  for (const c of TEAM) D.act(c, 'idle');
  D.say('aaron', 'Everybody still with me?', { cam: R('aaron', 20, 2.2, 0.1), act: 'doubleOver', dur: 1.8 });
  D.act('aaron', 'idle');
  D.say('eric', 'Physically, yes. Emotionally, no.', { cam: R('eric', -10, 2.2, 0.1), expr: 'tired', dur: 2.2 });
  D.say('greg', 'My entire body hurts.', { cam: R('greg', -20, 2.0, 0.1), act: 'doubleOver', expr: 'tired', dur: 1.8 });
  D.fx('dustCloud', { x: 4.0, z: 15.5, radius: 0.3, dur: 2.6, n: 26, size: 0.18, h: 2.2, color: 0x6a6a6a, color2: 0x4a4a4a });
  D.say('flare', 'My uniform is smoking.', { cam: R('flare', -20, 2.2, 0.1), act: 'lookDown', expr: 'disgust', dur: 1.9 });
  D.act('greg', 'idle'); D.act('flare', 'idle');
  D.say('leon', 'Focus. We need to stop it before it reaches the headquarters.', { cam: R('leon', 10, 2.4, 0.1), expr: 'serious', dur: 3.2 });
  D.anim('beh.nod', 0.5, 1.4); D.anim('beh.rear', 0.75, 1.4);
  D.cam(FIX([6, 1, 28], [0, 22, 6], { fov: 58 })); D.sound('Behemoth lowers its head', 1.6); D.wait(1.6);
  // the drain begins
  D.music('mystery', 0.4, 0, 0.4);
  D.anim('crown.glow', 3, 0.8); D.sfx('drainHum', 0, 0.9, { repeat: 8, every: 2.4 });
  D.fx('drain', { who: ['aaron', 'flare', 'eric', 'greg'], to: 'crown', dur: 24, power: 1 });
  D.act('leon', 'holdHigh'); D.expr('leon', 'shocked');
  D.cam(FIX([-1, 2.4, 20.5], [-4.5, 1.8, 13.6], { fov: 54 })); D.sound("The crown, still held by Leon, begins pulling energy from the team's uniforms", 3.0); D.wait(2.8);
  D.say('aaron', "What's happening?!", { cam: R('aaron', 20, 2.2, 0.1), expr: 'shocked', dur: 1.6 });
  D.say('leon', "It's draining our power!", { cam: R('leon', 15, 2.6, 0.2, { lookY: 0.1 }), act: 'heave', dur: 1.9 });
  D.fx('bodyAura', { who: 'aaron', dur: 4.0, color: 0x4aa8ff, flicker: 1 }); D.set('aaron.flicker', 1);
  D.say('aaron', "I can't hold my energy!", { cam: R('aaron', 20, 2.4, 0.15), act: 'powerFail', expr: 'worried', dur: 2.0 });
  D.wait(0.6);
  // Greg can't fly
  D.act('greg', 'hover'); jump('greg', 1.0, 0.9); D.sfx('powerDown', 0.4, 0.6);
  D.cam(R('greg', -20, 3.2, 0.4, { lookY: -0.3 })); D.wait(0.95);
  D.act('greg', 'stumble'); D.sfx('thud', 0, 0.6);
  D.say('greg', "WHY CAN'T I FLY?!", { act: 'armsOut', expr: 'shocked', dur: 1.8 });
  // Eric can't transform
  D.act('eric', 'fistPump'); D.set('flashWhite', 0.15); D.anim('flashWhite', 0, 0.3); D.sfx('energyFizzle', 0, 0.9);
  D.fx('sparks', { x: -0.5, y: 1.0, z: 14, n: 18, color: 0x6fc4ff, speed: 1.2, size: 0.04 });
  D.cam(R('eric', 0, 2.4, 0.1)); D.sound('Eric tries to transform into a tiger. His body flashes blue... and nothing happens', 2.8); D.wait(2.6);
  D.say('eric', 'OH, COME ON!', { act: 'armsOut', expr: 'angry', dur: 1.4 });
  // Flare's flame fizzles
  D.act('flare', 'flameHand'); D.fx('flame', { who: 'flare', side: 'R', dur: 0.55, size: 0.12 }, 0.3); D.sfx('energyFizzle', 0.8, 0.6);
  D.cam(R('flare', -15, 1.6, 0.0, { lookY: -0.2 })); D.sound('A tiny flame appears... then immediately disappears', 2.2); D.wait(2.0);
  D.say('flare', 'My fire is gone!', { expr: 'shocked', dur: 1.6 });
  D.act('flare', 'idle');
  D.say('leon', 'Everybody, get away from it!', { cam: R('leon', 15, 2.6, 0.2, { lookY: 0.1 }), act: 'heave', expr: 'worried', dur: 2.0 });
  // another wave
  D.anim('beh.jaw', 1, 0.3); D.sfx('monsterRoar', 0, 0.9); D.shake(0.8, 1.2);
  D.anim('crown.glow', 5, 0.3);
  D.fx('ring', { x: -5.0, z: 13.6, y: 1.8, radius: 12, dur: 0.9, color: 0xb040ff }, 0.3); D.sfx('shockwave', 0.3, 0.8);
  D.set('flashViolet', 0.4, 0.3); D.anim('flashViolet', 0, 0.5, 0.3);
  D.fx('drain', { who: ['aaron', 'flare', 'eric', 'greg'], to: 'crown', dur: 10, power: 1.6 }, 0.3);
  for (const c of ['aaron', 'flare', 'eric', 'greg', 'leon']) D.anim(`${c}.dim`, 0.85, 6, 0.3);
  D.cam(FIX([3, 1.4, 24], [-2, 6, 10], { fov: 58 })); D.sound('Behemoth roars. The crown releases another wave, and their energy drains faster', 3.0); D.wait(2.6);
  D.anim('beh.jaw', 0, 0.5);
  for (const c of ['aaron', 'eric', 'flare']) D.act(c, 'powerFail');
  D.say('aaron', "We're losing our powers!", { cam: R('aaron', 20, 2.2, 0.1), dur: 1.8 });
  D.say('greg', 'I JUST GOT MINE BACK!', { cam: R('greg', -20, 2.2, 0.1), act: 'armsOut', dur: 1.7 });
  D.say('eric', 'THIS IS THE WORST DAY EVER!', { cam: R('eric', 0, 2.2, 0.1), act: 'armsOut', expr: 'angry', dur: 1.9 });
  D.act('aaron', 'doubleOver');
  D.cam(R('aaron', 30, 2.6, 0.2)); D.sound('Aaron forces himself to stand', 1.6); D.wait(1.5);
  D.act('aaron', 'idle'); D.expr('aaron', 'determined');
  D.say('aaron', "We can't give up!", { cam: R('aaron', 20, 2.2, 0.1), act: 'fistsClench', dur: 1.6 });
  D.act('aaron', 'reachTremble');
  D.fx('sparks', { x: -3.4, y: 1.45, z: 14.3, n: 10, color: 0x7fd4ff, speed: 0.8, size: 0.035, life: 0.5 }, 0.6);
  D.sfx('energyFizzle', 0.6, 0.6);
  D.say('aaron', 'Come on...', { cam: FIX([-1.8, 1.6, 16.2], [-3.6, 1.4, 13.6], { fov: 44 }), dur: 1.8 });
  D.fx('sparks', { x: -3.4, y: 1.45, z: 14.3, n: 6, color: 0x7fd4ff, speed: 0.6, size: 0.03, life: 0.4 }, 0.3);
  D.sfx('energyFizzle', 0.3, 0.5);
  D.say('aaron', 'No!', { cam: R('aaron', 20, 2.0, 0.08), expr: 'angry', dur: 1.3 });
  D.set('aaron.flicker', 0);
  // it stops... and shrinks
  D.set('beh.sway', 0); D.set('beh.slither', 0);
  D.cam(FIX([4, 1, 30], [0, 18, -2], { fov: 56 })); D.sound('Behemoth suddenly stops moving', 1.6); D.wait(1.4);
  {
    const SH = 2.8;
    D.anim('beh.s', 0.45, SH, 0, 'in'); D.anim('beh.z', 4, SH, 0, 'in'); D.anim('beh.rear', 0.25, SH); D.anim('beh.nod', 0, SH); D.anim('beh.bolts', 0, 0.5); D.anim('beh.plates', 0.4, SH);
    D.anim('crown.glow', 0.5, SH); D.sfx('shrink', 0, 1.0);
    D.say('flare', 'Wait. Look!', { cam: R('flare', -20, 2.2, 0.1), act: 'point', expr: 'surprised', dur: 1.5 });
    D.cam(FIX([3, 2, 22], [0, 2, 4], { fov: 54 }));
    D.sound('Its enormous body shrinks rapidly... until it is barely larger than a small dog', 3.0); D.wait(2.6);
  }
  D.anim('beh.curl', 1, 0.8); D.anim('beh.rear', 0.05, 0.8);
  for (const c of TEAM) D.expr(c, 'surprised');
  D.say('greg', 'Is it... tiny again?', { cam: R('greg', -20, 2.0, 0.1), dur: 1.9 });
  D.cam(F(['beh'], 150, 1.1, 0.25, { lookY: -0.1, fov: 42 })); D.sound('The tiny Behemoth curls into a defensive position', 2.2); D.wait(2.2);
  for (const [c, x, z] of [['aaron', -1.8, 9.0], ['eric', 0.2, 8.6], ['flare', 2.2, 9.2], ['greg', 1.0, 10.0], ['leon', -3.2, 9.8]]) { D.act(c, 'idle'); D.path(c, [[x, z]], 2.5); }
  D.say('eric', 'We should grab it now!', { cam: R('eric', 0, 2.4, 0.1), expr: 'determined', dur: 1.8 });
  D.act('eric', 'fistPump'); D.set('flashWhite', 0.1); D.anim('flashWhite', 0, 0.2); D.sfx('energyFizzle', 0, 0.6);
  D.cam(R('eric', 10, 2.4, 0.1)); D.sound('Eric tries to transform again. Nothing happens', 2.0); D.wait(1.8);
  D.say('eric', '...Okay, I officially hate this thing.', { act: 'idle', expr: 'tired', dur: 2.4 });
  D.act('aaron', 'reachTremble'); D.expr('aaron', 'worried');
  D.cam(FIX([-0.4, 1.3, 10.6], [-1.6, 1.2, 8.4], { fov: 48 })); D.sound("Aaron reaches toward Behemoth, but his arm trembles from exhaustion", 2.4); D.wait(2.2);
  D.say('aaron', "I can't use my powers.", { cam: R('aaron', 20, 2.0, 0.1), dur: 1.9 });
  D.act('aaron', 'idle');
  D.say('leon', 'None of us can.', { cam: R('leon', 15, 2.4, 0.15), expr: 'serious', dur: 1.7 });
  // the tiny crown flashes; purple energy builds
  D.anim('beh.crest', 3, 0.3); D.sfx('crownFlash', 0, 0.9);
  D.cam(F(['beh'], 160, 0.6, 0.12, { lookY: -0.05, fov: 40 })); D.sound("Behemoth's tiny crown flashes again", 1.6); D.wait(1.6);
  D.set('mark.x', 0); D.set('mark.z', 4); D.set('mark.size', 0.5); D.anim('mark', 0.9, 2.0); D.anim('mark.size', 5, 2.0);
  D.fx('sphere', { x: 0, y: 0.3, z: 4, radius: 2.5, dur: 2.2, color: 0xa040ff });
  D.sfx('rumbleDeep', 0, 1.0); D.sfx('energyCharge', 0.3, 0.8); D.shake(0.6, 2.4);
  D.set('barrier.vis', 1); D.set('barrier.x', -0.3); D.set('barrier.z', 11.6); D.set('barrier.ry', 0);
  D.cam(FIX([5, 1.4, 14], [0, 0.5, 5], { fov: 50 })); D.sound('The ground shakes as purple energy builds beneath its body', 2.4); D.wait(1.6);
  D.say('flare', 'Everybody, move!', { cam: R('flare', -20, 2.2, 0.1), act: 'yell', expr: 'shocked', dur: 1.4 });
  for (const [c, x, dt] of [['aaron', -2.2, 0], ['eric', -0.8, 0.05], ['flare', 0.6, 0.1], ['greg', 1.9, 0.08], ['leon', -3.4, 0.02]]) {
    D.act(c, 'dive', dt); arc(c, x, 12.6, 0, 0.7, 0.6, dt); D.act(c, 'crouchHide', dt + 0.75); D.face(c, P, 0.2, dt + 0.7);
  }
  D.cam(FIX([6, 1.6, 16], [0, 0.8, 9], { fov: 54 })); D.sound('The team dives behind a concrete wall', 1.6); D.wait(1.0);
  // the blast
  D.fx('sphere', { x: 0, y: 1, z: 4, radius: 16, dur: 1.2, color: 0xa040ff });
  D.fx('ring', { x: 0, z: 4, y: 0.4, radius: 20, dur: 1.0, color: 0xc060ff });
  D.fx('bolt', { x: 0, z: 4, y: 0, top: 50, dur: 0.4, size: 2 });
  D.fx('dustCloud', { x: 0, z: 4, radius: 6, dur: 4.0, n: 90, size: 1.3, h: 4, color: 0x7a5a9a, color2: 0x5a4a6a });
  D.fx('sparks', { x: 0, y: 1, z: 4, n: 120, color: 0xc060ff, speed: 6, life: 1.2 });
  D.set('flashViolet', 0.85); D.anim('flashViolet', 0, 0.9); D.sfx('darkBlast', 0, 1.0); D.sfx('boom', 0.05, 1.0); D.shake(1.4, 1.2);
  D.comic('KA-BOOOM!', 0.1, 1.2, { x: 0.5, y: 0.3, size: 120, rot: -6, c1: '#f0d8ff', c2: '#a040ff' });
  D.hide('beh', 0.5);
  D.set('cracks', 1); D.set('cracks.x', 0, 0.5); D.set('cracks.z', 4, 0.5); D.set('cracks.size', 7, 0.5);
  D.cam(FIX([-6, 3, 18], [0, 2, 4], { fov: 56 })); D.sound('A purple blast erupts from the street', 2.0); D.wait(2.6);
  D.music('sad', 0.45, 0, 1.0);
  for (const [c, dt] of [['aaron', 0], ['eric', 0.2], ['flare', 0.3], ['greg', 0.1], ['leon', 0.4]]) { D.act(c, 'getUp', dt); }
  D.cam(FIX([0, 3.2, 14.5], [0, 0, 4], { pos2: [0, 2.8, 13.5], fov: 50 }));
  D.sound('When the dust clears, Behemoth is gone. Only a glowing purple mark remains on the pavement', 3.6); D.wait(3.8);
  for (const c of TEAM) { D.act(c, 'idle'); D.faceTo(c, 0, 4, 0.4); D.expr(c, 'tired'); }
  D.say('greg', '...', { cam: R('greg', -20, 2.0, 0.1), dur: 1.0 });
  D.say('eric', '...', { cam: R('eric', 0, 2.0, 0.1), dur: 1.0 });
  D.say('aaron', 'It escaped.', { cam: R('aaron', 20, 2.0, 0.1), expr: 'serious', dur: 1.6 });
  D.say('leon', 'And it took most of our energy with it.', { cam: R('leon', 20, 2.2, 0.1), act: 'lookDown', expr: 'serious', dur: 2.4 });
  D.cam(FIX([0.5, 1.6, 15], [0, 0.2, 4], { pos2: [0.5, 1.4, 14], fov: 48 })); D.sound('The team looks at the mark', 1.6); D.wait(1.8);
  D.act('leon', 'idle');
  D.say('aaron', "We're not finished with Behemoth.", { cam: R('aaron', 15, 1.9, 0.08), expr: 'determined', dur: 2.2 });
  D.say('leon', "No. We're not.", { cam: R('leon', 15, 2.0, 0.08), expr: 'determined', dur: 1.8 });
  D.anim('fade', 1, 0.8); D.wait(1.0);

  // ===================================================================== SCENE 8: BACK TO HEADQUARTERS
  D.scene('8. Back to Headquarters');
  D.location('living');
  cast(['aaron', 'flare', 'eric', 'greg', 'leon']);
  D.set('night', 1); D.set('steelTable', 1); D.set('tv.off', 1); D.set('halloween', 0); D.set('kitchen', 0); D.set('pizza', 0); D.set('ctrl.couch', 0); D.set('evening', 0);
  D.set('crown.mode', 'leon'); D.set('crown.size', 0.42); D.set('crown.glow', 0.25); D.set('greg.slime', 0);
  for (const c of TEAM) { D.set(`${c}.dim`, 0.85); D.set(`${c}.scuff`, 1); D.expr(c, 'tired'); D.act(c, 'tired'); }
  D.place('greg', 2.6, 3.6, P + 0.4); D.place('aaron', 1.0, 3.8, P); D.place('eric', -0.4, 4.2, P); D.place('flare', 3.0, 4.6, P); D.place('leon', -1.6, 4.6, P);
  D.act('leon', 'holdCase');
  D.path('greg', [[0.9, 1.3], [0.2, 0.75]], 1.8); D.path('aaron', [[-1.2, 1.6]], 1.6, 0.3); D.path('eric', [[1.8, 1.7]], 1.5, 0.2); D.path('flare', [[-2.0, 2.4]], 1.5, 0.4); D.path('leon', [[-3.6, -0.6]], 1.6, 0.1);
  D.anim('fade', 0, 0.8);
  D.music('chill', 0.3, 0, 0.8);
  D.cam(FIX([3.6, 2.4, 4.6], [-0.4, 0.9, 0], { fov: 54 }));
  D.card('location', 3.0, { text: 'BATTLE WARS HQ  -  MAIN ROOM  -  NIGHT' });
  D.sound('The team returns to headquarters, exhausted and frustrated. Their glowing accents are dim', 3.4); D.wait(3.2);
  D.face('greg', P, 0.3); D.act('greg', 'sitSlump'); D.sfx('thud', 0.2, 0.5); D.place('greg', 0, 0.62, P, 0.3);
  D.cam(FIX([0.6, 1.3, -1.6], [0, 0.8, 0.6], { fov: 46 })); D.sound('Greg drops onto the couch', 1.4); D.wait(1.6);
  D.say('greg', 'I vote that our next mission involves absolutely nothing.', { expr: 'tired', dur: 3.0 });
  for (const c of ['eric', 'flare', 'aaron']) D.faceChar(c, 'greg', 0.3);
  D.say('eric', 'I second that.', { cam: R('eric', -10, 2.2, 0.1), act: 'raiseHand', dur: 1.4 });
  D.say('flare', 'I third it.', { cam: R('flare', 10, 2.2, 0.1), act: 'raiseHand', dur: 1.3 });
  D.act('eric', 'tired'); D.act('flare', 'tired');
  D.say('aaron', "We can't just sit around. Behemoth is still out there.", { cam: R('aaron', 15, 2.2, 0.1), act: 'idle', expr: 'serious', dur: 2.8 });
  D.say('greg', 'And I am still recovering from being inside its mouth.', { cam: FIX([0.6, 1.3, -1.6], [0, 0.8, 0.6], { fov: 46 }), dur: 2.8 });
  D.say('eric', 'WE KNOW!', { cam: R('eric', -10, 2.2, 0.1), act: 'armsOut', expr: 'annoyed', dur: 1.3 });
  D.act('eric', 'tired');
  // Leon sets the crown on the steel table
  D.act('leon', 'holdCase'); D.path('leon', [[-2.1, -1.1], [-2.3, -3.0], [-3.6, -3.05]], 1.8); D.wait(2.2);
  D.faceTo('leon', -3.6, -1.7, 0.3); D.act('leon', 'giveItem'); D.sfx('clunk', 1.0, 0.9);
  D.set('crown.mode', 'world', 1.0); D.set('crown.x', -3.6, 1.0); D.set('crown.y', 0.965, 1.0); D.set('crown.z', -1.7, 1.0); D.set('crown.ry', 0.3, 1.0); D.set('crown.rx', 0, 1.0); D.set('crown.size', 0.42, 1.0);
  D.cam(FIX([-1.6, 1.9, 1.2], [-3.6, 0.95, -1.7], { fov: 46 })); D.sound('Leon places the recovered crown on a reinforced table', 2.4); D.wait(2.4);
  D.act('leon', 'idle');
  // everyone gathers around it
  D.place('greg', 0, 0.62, P); D.act('greg', 'idle'); D.set('greg.y', 0);
  const TB = [-3.6, -1.7], TA = { leon: 180, aaron: 110, eric: 50, greg: -50, flare: -110 };
  const tpos = (c) => { const r = TA[c] * P / 180; return [TB[0] + Math.sin(r) * 1.35, TB[1] + Math.cos(r) * 1.35]; };
  const tcam = (c, x = {}) => { const r = TA[c] * P / 180, [px, pz] = tpos(c); return FIX([TB[0] + Math.sin(r) * 0.2, 1.72, TB[1] + Math.cos(r) * 0.2], [px, 1.42, pz], { fov: 46, ...x }); };
  for (const c of ['aaron', 'flare', 'eric', 'greg']) { const [x, z] = tpos(c); D.act(c, 'idle'); D.path(c, [[x, z]], 1.6); D.faceTo(c, TB[0], TB[1], 0.3, 1.5); }
  D.cam(FIX([-3.4, 2.6, 2.2], [-3.6, 0.9, -1.7], { fov: 52 })); D.sound('Everyone gathers around it', 1.6); D.wait(2.4);
  D.say('leon', "The crown is the key. It controls Behemoth's size, but removing it releases something much more dangerous.", { cam: tcam('leon'), expr: 'serious', dur: 4.6 });
  D.say('flare', 'And the energy drain means it can weaken us without even fighting us directly.', { cam: tcam('flare'), expr: 'serious', dur: 3.6 });
  D.say('aaron', 'We need to understand how the crown works before we go after it again.', { cam: tcam('aaron'), expr: 'determined', dur: 3.4 });
  D.say('eric', 'So what do we do?', { cam: tcam('eric'), expr: 'worried', dur: 1.5 });
  D.say('leon', 'We study the crown, restore our powers, and develop a plan.', { cam: tcam('leon'), act: 'orate', expr: 'determined', dur: 3.2 });
  D.say('leon', "Next time, we won't rush in without understanding what we're facing.", { dur: 3.2 });
  D.act('leon', 'idle');
  D.act('greg', 'raiseHand'); D.expr('greg', 'happy');
  D.say('greg', 'Can the plan include food?', { cam: tcam('greg'), dur: 1.8 });
  D.say('leon', 'Greg.', { cam: tcam('leon'), act: 'crossArms', expr: 'annoyed', dur: 1.2 });
  D.act('greg', 'shrug');
  D.say('greg', "I'm just asking!", { cam: tcam('greg'), dur: 1.4 });
  D.act('greg', 'idle'); D.act('leon', 'idle');
  // Aaron at the window
  D.expr('aaron', 'happy'); D.faceTo('aaron', -7.0, -1.5, 0.6, 0.6); D.expr('aaron', 'serious', 1.0);
  D.cam(tcam('aaron')); D.sound('Aaron smiles slightly, then looks toward the darkened window', 2.4); D.wait(2.2);
  D.say('aaron', 'Whatever Behemoth is, it was sent here for a reason.', { cam: FIX([-6.2, 1.6, -3.0], [-2.33, 1.45, -2.16], { fov: 38 }), dur: 2.8 });
  D.say('flare', 'You think the Soul Stealer is behind it?', { cam: tcam('flare'), expr: 'worried', dur: 2.2 });
  D.say('aaron', "Maybe. But we can't prove that yet.", { cam: FIX([-6.2, 1.6, -3.0], [-2.33, 1.45, -2.16], { fov: 38 }), dur: 2.2 });
  // the crown hums
  D.music('none', 0, 0, 0.6);
  D.cam(FIX([-3.0, 1.5, -0.6], [-3.6, 1.05, -1.7], { pos2: [-3.3, 1.35, -1.0], fov: 40, ease: 'linear' }));
  D.anim('crown.glow', 1.5, 0.15, 1.2); D.anim('crown.glow', 0.3, 0.15, 1.45); D.anim('crown.glow', 1.8, 0.15, 1.7); D.anim('crown.glow', 0.4, 0.2, 2.0);
  D.sfx('crownHum', 1.2, 0.9);
  D.sound('The camera moves toward the crown. Its purple runes suddenly flicker', 2.4); D.wait(2.2);
  D.sound('HUMMMMM...', 1.6); D.wait(1.6);
  for (const c of TEAM) { D.faceTo(c, -3.6, -1.7, 0.25); D.expr(c, 'surprised'); }
  D.cam(FIX([-3.4, 2.4, 1.9], [-3.6, 1.0, -1.7], { fov: 52 })); D.sound('Everyone turns', 1.2); D.wait(1.3);
  D.say('eric', 'Uh... did anybody touch that?', { cam: tcam('eric'), expr: 'worried', dur: 2.0 });
  D.say('greg', 'NOPE!', { cam: tcam('greg'), act: 'armsOut', expr: 'shocked', dur: 1.2 });
  D.anim('crown.glow', 4, 0.6); D.sfx('crownFlash', 0.2, 0.7); D.anim('crown.glow', 0, 0.8, 1.4); D.sfx('powerDown', 1.4, 0.5);
  D.cam(FIX([-2.8, 1.4, -0.9], [-3.6, 1.05, -1.7], { fov: 42 })); D.sound('The crown glows brighter for a moment... then goes dark', 2.6); D.wait(2.8);
  D.act('leon', 'idle'); D.move('leon', -3.6, -2.75, 0.8, 0, { face: false });
  D.say('leon', 'Nobody touches it until we know what it does.', { cam: tcam('leon'), expr: 'serious', dur: 2.6 });
  D.expr('aaron', 'determined'); D.act('aaron', 'fistsClench'); D.faceTo('aaron', TB[0], TB[1], 0.3);
  D.say('aaron', "Next time, we're taking Behemoth down.", { cam: tcam('aaron', { fov: 36 }), dur: 2.6 });
  // pull away from HQ
  D.music('theme', 0.5, 0, 1.0);
  D.location('hqExt');
  cast([]);
  D.set('night', 1); D.set('evening', 0); D.set('ufo.shade', 0); D.set('hq.doors', 0.15); D.set('hq.doorBroken', 1); D.set('hq.balcony', 1); D.set('hq.skyline', 1);
  D.cam(FIX([0, 3, 12], [0, 6, -6], { pos2: [0, 12, 38], look2: [0, 6, -9], fov: 48 }));
  D.sound('The camera slowly pulls away from the headquarters', 2.6); D.wait(5.0);
  D.anim('fade', 1, 1.4); D.wait(1.6);

  // ===================================================================== END CARD
  D.scene('End');
  D.location('title');
  cast([]);
  D.set('fade', 1); D.anim('fade', 0, 0.8);
  D.music('darkTheme', 0.6, 0, 0.1);
  D.set('title.theme', 0); D.set('title.k', 1); D.set('title.sub', 0); D.set('title.y', 1.65); D.set('title.jolt', 0);
  D.cam(FIX([0, 0.6, 10.5], [0, 0.4, 0], { pos2: [0, 0.5, 10.0], fov: 42 }));
  const endDur = 15;
  D.card('credits', endDur, {
    lines: [
      { text: 'END OF EPISODE 5', big: true, y: 0.5, color: '#c78bff' },
      { text: 'NEXT EPISODE: TO BE ANNOUNCED', bold: true, y: 0.585, color: '#ffd23f' },
      { text: 'Behemoth is still out there. The team has lost much of its power,', y: 0.655 },
      { text: "the crown's secrets remain unknown, and the next battle could be their toughest one yet.", y: 0.705 },
      { text: 'Starring  Aaron  ·  Greg  ·  Flare  ·  Eric  ·  Leon  ·  and the Soul Stealer', y: 0.79 },
      { text: 'Created by Nick', y: 0.85 },
      { text: 'New episodes every Saturday at 8:00 AM.', y: 0.91, color: '#7fd4ff' },
    ],
  });
  D.wait(endDur - 1.6);
  D.anim('fade', 1, 1.5); D.wait(1.6);
  return D.end();

  function jump(c, h, dur, dt = 0) { D.anim(`${c}.y`, D.val(`${c}.y`, D.now + dt) + h, dur / 2, dt, 'out'); D.anim(`${c}.y`, D.val(`${c}.y`, D.now + dt), dur / 2, dt + dur / 2, 'in'); }
}
