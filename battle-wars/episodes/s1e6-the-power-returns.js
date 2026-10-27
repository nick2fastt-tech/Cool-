// BATTLE WARS - Season 1, Episode 6: "THE POWER RETURNS"
import { createDirector, readTime } from '../src/director.js';
import { behemothRig, behParams, behBack } from '../src/behemothRig.js';

export const META = {
  id: 's1e6-the-power-returns', title: 'Battle Wars - S1E6 - The Power Returns', file: 'Battle_Wars_S1E6_The_Power_Returns', costume: 'blue2',
  behemoth: true, e6: true, extras: { aaron: ['armor'], flare: ['armor'], eric: ['armor'], leon: ['armor'] },
};

const P = Math.PI;
const ALL = ['aaron', 'flare', 'eric', 'barista', 'leon', 'greg', 'newark', 'cowboy', 'water', 'soul', 'dog', 'birddog', 'tiger', 'beh', 'ufo', 'horse', 'cat'];
const TEAM = ['aaron', 'flare', 'eric', 'greg', 'leon'];

export function buildEpisode() {
  const D = createDirector();
  // a little more reading time per caption (viewers are 9-14 and read the captions)
  const say0 = D.say;
  D.say = (who, text, opts = {}) => say0(who, text, { ...opts, dur: (opts.dur ?? readTime(text)) * 1.26, gap: opts.gap ?? 0.38 });
  // and slightly longer holds on every shot, so the action has room to breathe
  const HOLD = 1.12, wait0 = D.wait, sound0 = D.sound;
  D.wait = (d) => wait0(d * HOLD);
  D.sound = (text, dur = 1.6, dt = 0) => sound0(text, dur * HOLD, dt);
  const F = (on, yaw, dist, h = 0.15, x = {}) => ({ type: 'frame', on: Array.isArray(on) ? on : [on], yaw, dist, h, ...x });
  const R = (on, yaw, dist, h = 0.15, x = {}) => F(on, yaw, dist, h, { rel: Array.isArray(on) ? on[0] : on, ...x });
  const FIX = (pos, look, x = {}) => ({ type: 'fixed', pos, look, ...x });
  const cast = (list) => { for (const c of ALL) { if (!list.includes(c)) D.hide(c); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); D.set(`${c}.propR`, 'none'); D.set(`${c}.propL`, 'none'); } };
  const props = (c, r = 'none', l = 'none') => { D.set(`${c}.propR`, r); D.set(`${c}.propL`, l); };
  const pos = (c, dt = 0) => [D.val(`${c}.x`, D.now + dt), D.val(`${c}.z`, D.now + dt)];
  const rigAt = (dt = 0) => behemothRig(behParams(D.val, D.now + dt));
  const arc = (c, x, z, y1, dur, peak, dt = 0) => {
    const y0 = D.val(`${c}.y`, D.now + dt);
    D.anim(`${c}.x`, x, dur, dt, 'linear'); D.anim(`${c}.z`, z, dur, dt, 'linear');
    D.anim(`${c}.y`, Math.max(y0, y1) + peak, dur / 2, dt, 'out'); D.anim(`${c}.y`, y1, dur / 2, dt + dur / 2, 'in');
  };
  const roar = (dur = 2.2, text = 'RRRRRRAAAAAAAAHHHH!', opts = {}) => {
    D.anim('beh.jaw', 1, 0.3); D.anim('beh.nod', (opts.nod ?? -0.35), 0.4);
    D.sfx('monsterRoar', 0, opts.vol ?? 1); D.shake(opts.shake ?? 0.8, dur);
    D.say('behemoth', text, { dur, cam: opts.cam });
    D.anim('beh.jaw', 0, 0.4); D.anim('beh.nod', opts.after ?? 0, 0.5);
  };
  const flyThrow = (kind, from, to, dur, peak, dt = 0) => {
    D.set('fly.kind', kind, dt); D.set('fly.x', from[0], dt); D.set('fly.y', from[1], dt); D.set('fly.z', from[2], dt);
    D.anim('fly.x', to[0], dur, dt, 'linear'); D.anim('fly.z', to[2], dur, dt, 'linear');
    D.anim('fly.y', Math.max(from[1], to[1]) + peak, dur / 2, dt, 'out'); D.anim('fly.y', to[1], dur / 2, dt + dur / 2, 'in');
    D.set('fly.kind', 'none', dt + dur);
  };

  for (const c of ALL) { D.hide(c); D.act(c, 'idle'); D.expr(c, 'neutral'); D.set(`${c}.y`, 0); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); D.set(`${c}.roll`, 0); props(c); }
  D.set('fade', 1); D.set('fly.kind', 'none'); D.set('aaron.holo', 0); D.set('aaron.shield', 0); D.set('aaron.suitGlow', 0); D.set('greg.eyeGlow', 0); D.set('flare.suitGlow', 0);
  D.set('beh.s', 9); D.set('beh.rear', 0.45); D.set('beh.plates', 1); D.set('beh.claws', 1.6); D.set('beh.eyes', 1); D.set('beh.sway', 0.3); D.set('beh.slither', 0.3);
  D.set('beh.jaw', 0); D.set('beh.nod', 0); D.set('beh.look', 0); D.set('beh.curl', 0); D.set('beh.tailLift', 0); D.set('beh.shake', 0); D.set('beh.dark', 0.3); D.set('beh.cracks', 0); D.set('beh.eyesRed', 0); D.set('beh.bolts', 0); D.set('beh.crest', 0);
  D.set('beh.blue', 1); D.set('beh.goo', 0); D.set('beh.dissolve', 0); D.set('beh.flickerBlue', 0);
  D.set('crown.mode', 'head'); D.set('crown.glow', 0.8); D.set('crown.blue', 1); D.set('crown.lift', 0); D.set('crown.gone', 0);
  D.set('cat.pizza', 0); D.set('table.held', 0); D.set('tv.fall', -1); D.set('tv.off', 0); D.set('tv.boss', 0); D.set('tv.win', 0);

  // ===================================================================== SCENE 1: THE SOUL STEALER'S PLAN
  D.scene("1. The Soul Stealer's Plan");
  D.location('lair');
  cast(['soul', 'beh']);
  D.place('beh', 0, -7.5, 0); D.set('beh.s', 14); D.set('beh.rear', 0.3); D.set('beh.nod', 0.25);
  D.place('soul', 3.2, 9, P - 0.3); D.set('soul.eyes', 1); D.set('soul.palm', 0); D.set('soul.raise', 0); D.set('soul.violet', 0);
  D.set('cage.open', 0); D.set('lock.float', 0); D.set('lock.gone', 0); D.set('lair.glow', 0.5);
  D.music('soul', 0.6, 0, 0.5);
  D.anim('fade', 0, 1.4);
  D.cam(FIX([6, 3.0, 12], [0, 3.5, -4], { pos2: [4, 2.6, 9], fov: 52 }));
  D.card('location', 3.4, { text: "THE SOUL STEALER'S LAIR  -  FLASHBACK" });
  D.anim('beh.jaw', 0.4, 0.4, 0.8); D.anim('beh.jaw', 0, 0.5, 1.6); D.sfx('bossRoar', 0.8, 0.5);
  D.wait(3.6);
  D.cam(FIX([1.5, 2.4, 6.5], [0, 3.6, -3], { fov: 46 }));
  D.sound('Inside the cage, the Behemoth growls, its body glowing with blue energy', 3.0); D.wait(3.0);
  D.path('soul', [[1.2, 6.2]], 1.2); D.set('soul.raise', 0); D.anim('soul.raise', 1, 0.8, 1.0); D.anim('soul.palm', 0.8, 0.6, 1.2);
  D.cam(FIX([-3.2, 2.2, 9.5], [1.0, 3.2, 4.5], { fov: 48 })); D.wait(2.0);
  D.anim('lock.float', 1, 1.6); D.sfx('magicFloat', 0, 0.7); D.sfx('lockClick', 0.9, 0.8);
  D.fx('sparks', { x: 0, y: 6.5, z: 4.6, n: 40, color: 0xb050ff, speed: 1.4 }, 1.0);
  D.cam(FIX([2.5, 3.2, 8.5], [0, 5.6, 4.5], { fov: 44 })); D.sound('He raises one hand. The lock begins floating in the air', 2.4); D.wait(2.4);
  D.say('soul', "It's your time now to shine.", { cam: F(['soul'], 85, 3.4, 0.0, { lookY: -0.2 }), dur: 2.2 });
  D.say('soul', 'Do what you have to do.', { dur: 2.0 });
  D.set('lock.gone', 1);
  D.anim('cage.open', 1, 2.6); D.sfx('cageCreak', 0, 0.9);
  D.cam(FIX([0.5, 2.2, 13], [0, 3.6, 0], { fov: 50 })); D.sound('The cage doors slowly open', 2.0); D.wait(2.8);
  D.anim('beh.z', 0, 2.4); D.anim('beh.nod', 0, 1.0); D.anim('beh.rear', 0.5, 2.0); D.sfx('boom', 0.4, 0.5); D.sfx('boom', 1.4, 0.5); D.shake(0.4, 2.2);
  D.cam(FIX([-4, 1.4, 12], [0, 4, 2], { fov: 54 })); D.sound('The Behemoth steps forward', 1.6); D.wait(2.4);
  D.anim('beh.shake', 1, 0.2); D.anim('beh.shake', 0, 0.3, 1.0); D.sfx('metalCrash', 0, 0.4);
  D.wait(1.3);
  roar(2.4, 'RRRRRRAAAAAAAAHHHH!', { cam: FIX([3, 2.0, 14], [0, 5.5, 4], { fov: 50 }), shake: 1.0 });
  D.anim('soul.raise', 1.3, 0.4); D.anim('soul.charge', 1, 0.6); D.sfx('energyCharge', 0, 0.8);
  D.fx('portal', { x: 0, y: 4, z: 1.5, radius: 5, dur: 3.0, color: 0x8a40ff, ry: 0 }, 0.4);
  D.say('soul', 'Go.', { cam: F(['soul'], 85, 3.2, 0.0, { lookY: -0.2 }), dur: 1.6 });
  D.set('flashWhite', 1); D.anim('flashWhite', 0, 0.9); D.sfx('teleport', 0, 1.0); D.hide('beh', 0.05);
  D.fx('sparks', { x: 0, y: 4, z: 1, n: 120, color: 0x6ab0ff, speed: 6, life: 1.2 });
  D.anim('soul.charge', 0, 0.6); D.anim('soul.raise', 0.3, 0.8);
  D.cam(FIX([0.5, 2.2, 13], [0, 3.6, 0], { fov: 50 })); D.sound('The Behemoth is teleported away', 1.8); D.wait(2.0);
  D.anim('fade', 1, 0.4); D.wait(0.5);

  // ===================================================================== SCENE 2: A NEW STRATEGY
  D.scene('2. A New Strategy');
  D.location('living');
  cast(['aaron', 'flare', 'eric', 'greg', 'leon']);
  D.set('fade', 0); D.set('night', 0); D.set('evening', 0); D.set('steelTable', 0); D.set('halloween', 0); D.set('kitchen', 0); D.set('pizza', 1); D.set('tv.off', 1); D.set('ctrl.couch', 0);
  D.place('greg', -0.5, 0.62, P); D.act('greg', 'sitRelax'); D.expr('greg', 'serious');
  D.place('eric', 0.75, 0.62, P); D.act('eric', 'sitEat'); D.expr('eric', 'happy'); props('eric', 'pizza');
  D.place('aaron', -2.1, -1.5, 0.55); D.act('aaron', 'idle'); D.expr('aaron', 'neutral');
  D.place('leon', 2.2, -1.7, -0.6); D.act('leon', 'crossArms'); D.expr('leon', 'neutral');
  D.place('flare', -3.4, 0.6, 1.9); D.act('flare', 'idle'); D.expr('flare', 'neutral');
  D.music('hq', 0.4, 0, 0.6);
  D.cam(FIX([0.2, 2.6, -3.9], [0, 0.9, 0.0], { pos2: [0.2, 2.3, -3.5], fov: 54 }));
  D.card('location', 3.0, { text: 'PRESENT DAY  -  BATTLE WARS HQ' });
  D.sound('Greg sits on the couch. Eric eats pizza, completely relaxed', 3.0, 0.2); D.wait(3.4);
  D.say('greg', 'We might have won, but I feel like we should go out stronger this time.', { cam: R('greg', 10, 2.0, 0.15), dur: 3.4 });
  D.faceChar('aaron', 'greg', 0.3);
  D.say('aaron', "You've got a good idea. But what's the plan?", { cam: R('aaron', 15, 2.2, 0.1), dur: 2.6 });
  D.say('greg', 'Maybe we should all find a way to get our powers back.', { cam: R('greg', 10, 2.0, 0.15), dur: 2.8 });
  D.say('greg', 'We need to think of another strategy, too.', { dur: 2.2 });
  D.say('eric', "All right, so what's your strategy?", { cam: R('eric', -10, 2.0, 0.15), act: 'sitRelax', dur: 2.0 });
  D.act('eric', 'sitEat'); D.sfx('munch', 0.1, 0.6);
  D.cam(R('eric', -10, 1.8, 0.15)); D.sound('Eric takes another bite of pizza', 1.6); D.wait(1.6);
  D.say('greg', 'What if we just combine our new powers?', { cam: R('greg', 10, 2.0, 0.15), expr: 'happy', dur: 2.2 });
  D.say('aaron', 'Hold up, hold up. NEW powers? How are we gonna get new powers?', { cam: R('aaron', 15, 2.2, 0.1), act: 'armsOut', expr: 'surprised', dur: 3.2 });
  D.say('aaron', 'What if we just use technology?', { act: 'point', expr: 'happy', dur: 1.9 });
  D.act('aaron', 'idle');
  D.say('greg', "Oh, that's not bad either.", { cam: R('greg', 10, 2.0, 0.15), dur: 1.8 });
  D.say('aaron', "Yeah, you know, I'm the leader of this team. My powers are obviously from technology.", { cam: R('aaron', 15, 2.2, 0.1), act: 'handsHips', expr: 'smug', dur: 3.6 });
  D.say('aaron', "I'm not the weakest here.", { dur: 1.7 });
  // Aaron looks straight at the camera
  D.music('none', 0, 0, 0.3);
  D.faceTo('aaron', -2.1, -3.7, 0.25); D.act('aaron', 'idle'); D.expr('aaron', 'neutral');
  D.cam(FIX([-2.1, 1.5, -3.7], [-2.1, 1.42, -1.5], { pos2: [-2.1, 1.48, -3.4], fov: 38, fov2: 30 }));
  D.sound('Aaron suddenly turns his head and looks directly at the camera...', 2.6, 0.3); D.wait(3.4);
  D.say('greg', 'What are you looking at?', { cam: R('greg', 10, 2.0, 0.15), expr: 'surprised', dur: 1.8 });
  D.say('aaron', 'Nothing.', { cam: FIX([-2.1, 1.5, -3.4], [-2.1, 1.42, -1.5], { fov: 30 }), dur: 1.2 });
  D.faceChar('aaron', 'greg', 0.15); D.expr('aaron', 'smug');
  D.cam(R('aaron', 15, 2.4, 0.1)); D.sound('Aaron quickly looks away', 1.4); D.wait(1.4);
  D.music('hq', 0.35, 0, 0.4);
  D.say('eric', 'Is he talking to somebody?', { cam: R('eric', -10, 2.0, 0.15), act: 'sitRelax', expr: 'surprised', dur: 1.9 });
  D.faceChar('flare', 'eric', 0.3);
  D.say('flare', "Don't worry about it.", { cam: R('flare', -15, 2.2, 0.1), act: 'shrug', dur: 1.6 });
  // Flare steps out... and comes back with news
  D.act('flare', 'idle'); D.path('flare', [[-5.6, 1.9], [-7.4, 2.6]], 2.2); D.hide('flare', 1.6);
  D.act('eric', 'sitEat');
  D.cam(FIX([2.0, 2.0, -3.4], [-2.8, 1.0, 1.0], { fov: 52 })); D.wait(2.4);
  D.place('flare', -7.4, 2.6, -1.0); D.expr('flare', 'worried'); D.path('flare', [[-5.2, 1.6], [-3.2, 0.6]], 2.8);
  D.cam(FIX([-1.2, 1.6, -1.2], [-5.0, 1.3, 1.6], { fov: 46 }));
  D.sound('Flare walks back into the room, looking concerned', 2.0); D.wait(1.6);
  D.say('flare', 'Yo, guys! I think the Behemoth is destroying the city!', { act: 'yell', dur: 2.8 });
  for (const c of ['aaron', 'leon']) D.faceChar(c, 'flare', 0.25);
  D.look('greg', -1.0, 0, 0.25); D.look('eric', -1.1, 0, 0.25); D.expr('greg', 'shocked'); D.expr('eric', 'shocked'); D.expr('aaron', 'shocked'); D.expr('leon', 'shocked');
  D.cam(FIX([0, 2.4, -3.8], [-0.6, 1.0, 0.3], { fov: 56 })); D.sound('Everyone immediately turns toward him', 1.6); D.wait(1.6);
  D.act('flare', 'idle'); D.expr('aaron', 'determined');
  D.say('aaron', "Okay, I'll take care of this quickly. You guys can only watch because you don't have your powers right now.", { cam: R('aaron', 25, 2.2, 0.1), act: 'handsHips', dur: 4.4 });
  D.say('aaron', "I'm your only hope.", { act: 'pointUp', dur: 1.6 });
  D.look('eric', -0.6, 0, 0.25);
  D.say('eric', 'Could you at least bring me some pizza when you come back?', { cam: R('eric', -10, 2.0, 0.15), act: 'sitRelax', expr: 'happy', dur: 2.8 });
  D.say('aaron', 'ERIC!', { cam: R('aaron', 25, 2.2, 0.1), act: 'armsOut', expr: 'annoyed', dur: 1.2 });
  D.say('eric', "What? I'm hungry!", { cam: R('eric', -10, 2.0, 0.15), act: 'sitEat', dur: 1.6 });
  D.act('aaron', 'idle'); D.path('aaron', [[-4.4, 1.4], [-7.4, 2.6]], 4.2); D.hide('aaron', 2.0);
  D.look('greg', -1.3, 0, 0.4);
  D.say('greg', 'Be careful!', { cam: FIX([1.2, 1.7, -2.6], [-4.5, 1.2, 1.8], { fov: 50 }), act: 'sitCheer', dur: 1.4 });
  D.say('aaron', 'I will!', { dur: 1.2 });
  D.sfx('doorSlam', 0, 0.9); D.act('greg', 'sitRelax');
  D.cam(FIX([-4.6, 1.4, -1.0], [-7.0, 1.2, 2.6], { fov: 46 })); D.sound('The door slams shut', 1.4); D.wait(1.5);
  D.anim('fade', 1, 0.4); D.wait(0.5);

  // ===================================================================== SCENE 3: THE BEHEMOTH RETURNS
  D.scene('3. The Behemoth Returns');
  D.location('downtown');
  cast(['beh']);
  D.set('fade', 0); D.set('sky.mode', 0); D.set('ufo.shade', 0); D.set('lightning', 0); D.set('facade.break', 1); D.set('mark', 0); D.set('cracks', 0); D.set('barrier.vis', 0);
  D.set('can.vis', 1); D.set('can.roll', 0); D.set('can.x', 21); D.set('can.z', 5.6); D.set('can.y', 0); D.set('can.spin', 0); D.set('can.ry', 0); D.set('can.lid', 1); D.set('can.spring', 0); D.set('can.sq', 1);
  D.set('cons.vis', 1); D.set('cons.x', -17); D.set('cons.z', 5.2); D.set('cons.ry', 0); D.set('cons.smash', 0);
  for (let i = 0; i < 3; i++) D.set(`sign${i}.fall`, 0);
  D.set('shards', 0);
  D.place('beh', -46, 0.5, P / 2); D.set('beh.s', 26); D.set('beh.rear', 0.6); D.set('beh.nod', 0.15); D.set('beh.sway', 0.35); D.set('beh.slither', 0.35); D.set('beh.dark', 0.35); D.set('beh.blue', 0.7); D.set('crown.glow', 1.0);
  D.music('action', 0.55, 0, 0.3);
  D.anim('beh.x', -24, 9, 0, 'linear');
  D.sfx('boom', 0.5, 0.6); D.sfx('boom', 1.8, 0.6); D.sfx('boom', 3.1, 0.6); D.sfx('boom', 4.4, 0.6); D.sfx('boom', 5.7, 0.6);
  D.set('citizens.on', 1); D.set('citizens.t0', D.now + 0.5); D.sfx('citizensPanic', 0.6, 0.8); D.sfx('scream', 1.2, 0.5);
  D.cam(FIX([10, 2.0, 26], [-10, 7, 2], { pos2: [9, 1.9, 27], fov: 60 }));
  D.card('location', 3.0, { text: 'AETHERFALL CITY  -  DAY' });
  D.sound('The Behemoth stomps through the city. Citizens hurry to safety', 3.2, 0.3); D.wait(3.6);
  D.say('citizen', 'Everybody get out of the way!', { cam: FIX([7, 1.6, 26], [-1, 1.6, 10], { fov: 50 }), dur: 2.0 });
  // it smashes the construction barriers and knocks over a sign
  D.set('cons.smash', 1, 0.2); D.sfx('metalCrash', 0.2, 0.8);
  D.fx('debris', { x: -17, y: 0.8, z: 5.2, n: 40, color: 0xff7a1a, color2: 0xffffff, spread: 2, size: 2 }, 0.2);
  D.set('sign2.fall', 0); D.anim('sign2.fall', 1, 0.6, 0.9, 'in'); D.sfx('metalCrash', 1.4, 0.5);
  D.anim('beh.nod', 0.9, 0.5, 1.6); D.anim('beh.nod', 0.15, 0.6, 2.2); D.sfx('tailSlam', 2.0, 0.8); D.shake(0.8, 0.8, 2.0);
  D.fx('dustCloud', { x: -14, z: 1, radius: 4, dur: 3, n: 50, size: 1.2, h: 2.5 }, 2.0);
  D.cam(FIX([-6, 1.4, 6.5], [-20, 8, 0], { fov: 58 })); D.sound('It smashes the construction barriers and pounds the pavement', 2.6, 0.2); D.wait(3.2);
  // Aaron runs around the corner
  D.place('aaron', 14, -2.0, -P / 2); D.act('aaron', 'idle'); D.expr('aaron', 'determined');
  D.path('aaron', [[6.5, 2.6]], 6.5);
  D.cam(FIX([3.5, 1.5, 6.4], [9, 1.3, 1.0], { pos2: [3.0, 1.5, 6.6], fov: 50 })); D.wait(1.3);
  D.faceTo('aaron', -12, 0, 0.3); D.expr('aaron', 'shocked');
  D.say('aaron', 'Oh, dang! I need Leon!', { cam: R('aaron', 20, 2.3, 0.1), act: 'jumpScare', dur: 1.9 });
  D.act('aaron', 'idle'); D.wait(0.5);
  D.say('aaron', "Wait. I forgot Leon doesn't have super strength right now.", { act: 'facepalm', expr: 'tired', dur: 3.0 });
  D.act('aaron', 'idle'); D.expr('aaron', 'determined');
  D.anim('beh.look', 0.8, 1.6); D.anim('beh.nod', 0.25, 1.6);
  D.cam(FIX([2, 1.0, 9], [-16, 9, -4], { fov: 56 })); D.sound('The Behemoth turns toward another building', 1.8); D.wait(1.8);
  D.say('aaron', 'HEY! BEHEMOTH!', { cam: R('aaron', 20, 2.6, 0.1), act: 'yell', expr: 'angry', dur: 1.6 });
  D.cam(FIX([2, 1.0, 9], [-16, 9, -4], { fov: 56 })); D.sound('The creature ignores him', 1.5); D.wait(1.5);
  // the debris throw
  D.act('aaron', 'crouchTreat'); D.wait(0.6);
  {
    D.act('aaron', 'throw'); D.expr('aaron', 'angry');
    const r = rigAt(0.6);
    const [ax, az] = pos('aaron');
    flyThrow('rock', [ax - 0.2, 1.6, az], [r.head[0] + 0.4, r.head[1], r.head[2] + 0.2], 1.0, 1.5, 0.2);
    D.sfx('whoosh', 0.2, 0.6); D.sfx('bonk', 1.2, 0.9);
    D.fx('sparks', { x: r.head[0], y: r.head[1], z: r.head[2], n: 20, color: 0xc8b8a0, speed: 1.5 }, 1.2);
    D.say('aaron', "REMEMBER ME?! I DIDN'T LOSE MY POWERS!", { cam: FIX([10.5, 1.7, 1.6], [-6, 6, 0], { fov: 54 }), dur: 2.6 });
  }
  D.act('aaron', 'idle');
  D.anim('beh.look', -0.3, 2.0); D.anim('beh.nod', 0.3, 2.0);
  D.cam(FIX([11, 1.3, 2.2], [-10, 9, 0], { fov: 54 })); D.sound('The Behemoth slowly turns around...', 1.8); D.wait(2.0);
  roar(2.4, 'RRRRRRRAAAAAAAAAHHHH!', { cam: FIX([12, 1.0, 3.0], [-10, 10, 0], { fov: 50 }), shake: 1.2 });
  D.expr('aaron', 'worried');
  D.say('aaron', "Okay. Maybe I should've thought that through.", { cam: R('aaron', 20, 2.2, 0.1), act: 'shrug', dur: 2.4 });
  // it shrinks to a medium size; the crown glows brighter
  {
    const SH = 3.0;
    D.anim('beh.s', 9, SH, 0, 'inout'); D.anim('beh.x', -5, SH, 0); D.anim('beh.look', -0.2, SH); D.anim('beh.rear', 0.55, SH); D.anim('beh.plates', 1.3, SH);
    D.anim('crown.glow', 3, SH); D.sfx('shrink', 0, 1.0); D.sfx('metalGrow', 0.4, 0.5);
    D.act('aaron', 'idle'); D.expr('aaron', 'surprised');
    D.cam(FIX([6.5, 1.4, 9.5], [-3, 4, 0], { pos2: [6.0, 1.4, 8.5], fov: 52 }));
    D.sound("The Behemoth's body shrinks to a medium size. Its armor shifts, and the crown on its head glows brighter", 3.6); D.wait(SH + 0.6);
  }
  D.say('aaron', "There it is. That crown must be what's keeping it powered up!", { cam: R('aaron', 20, 2.2, 0.1), act: 'point', expr: 'determined', dur: 3.0 });
  // fire!
  {
    const r = rigAt(0.5);
    const [ax, az] = pos('aaron');
    D.anim('beh.jaw', 1, 0.3); D.anim('beh.look', -0.05, 0.4);
    D.fx('breath', { from: r.mouth, to: [ax + 1.0, 0.4, az + 0.8], dur: 1.3, spread: 1.6, size: 0.35 }, 0.4);
    D.sfx('fireBreath', 0.4, 1.0);
    D.act('aaron', 'dodge', 0.75); D.move('aaron', ax - 1.2, az - 2.2, 0.4, 0.75, { face: false });
    D.say('aaron', 'WHOA!', { cam: FIX([ax + 5, 1.6, az + 6], [ax - 2, 1.5, az - 1], { fov: 54 }), dur: 1.4, dt: 0.5 });
    D.fx('fire', { x: ax + 1.0, y: 0.05, z: az + 0.8, dur: 3.0, size: 0.9 }, -0.6);
    D.set('cracks', 1); D.set('cracks.x', ax + 1.0); D.set('cracks.z', az + 0.8); D.set('cracks.size', 3);
    D.anim('beh.jaw', 0, 0.4);
    D.cam(FIX([ax + 3.5, 0.8, az + 4.5], [ax + 1, 0.5, az + 0.8], { fov: 46 })); D.sound('The fire hits the pavement behind him', 1.8); D.wait(1.6);
  }
  D.act('aaron', 'ready'); D.expr('aaron', 'determined');
  D.say('aaron', "All right. Let's do this!", { cam: R('aaron', 15, 2.2, 0.08), act: 'fistPump', dur: 1.8 });

  // ===================================================================== SCENE 4: AARON'S SOLO BATTLE
  D.scene("4. Aaron's Solo Battle");
  D.music('heroic', 0.55, 0, 0.3);
  D.set('citizens.on', 0);
  D.anim('beh.x', 5, 3.2, 0.3, 'inout'); D.sfx('boom', 0.6, 0.6); D.sfx('boom', 1.5, 0.6); D.sfx('boom', 2.4, 0.6); D.shake(0.5, 3);
  D.act('aaron', 'idle'); D.path('aaron', [[9, 1.2], [17.2, 1.0]], 6.0, 0.4);
  D.say('aaron', 'Come on, big guy! You gotta be faster than that!', { cam: FIX([22, 1.8, -2.5], [8, 2.5, 1], { fov: 54 }), dur: 2.8 });
  D.cam(FIX([24, 1.4, 4.2], [10, 3, 0], { fov: 56 })); D.sound('Aaron runs down the street as the Behemoth follows him', 2.0); D.wait(2.2);
  // it lunges and snaps
  D.anim('beh.look', 0.25, 0.4); D.anim('beh.nod', 0.6, 0.4); D.anim('beh.jaw', 1, 0.2, 0.2); D.anim('beh.jaw', 0, 0.12, 0.45); D.sfx('gulp', 0.45, 0.6); D.sfx('punchHit', 0.45, 0.5);
  D.act('aaron', 'dive', 0.3); D.move('aaron', 17.2, -0.6, 0.45, 0.3, { face: false }); D.act('aaron', 'getUp', 0.8);
  D.cam(FIX([20, 1.0, -4.5], [13, 2.4, 0.5], { fov: 54 })); D.sound('The Behemoth lunges and snaps at him. Aaron dives out of the way', 2.6); D.wait(2.6);
  D.anim('beh.look', 0, 0.5); D.anim('beh.nod', 0.15, 0.5);
  // the tail sweep knocks over a street sign
  D.anim('beh.tailSwing', 1.2, 0.8); D.anim('beh.tailSwing', 0, 0.9, 1.0); D.sfx('whoosh', 0.3, 0.8); D.sfx('metalCrash', 0.7, 0.7);
  D.set('sign1.fall', 0); D.anim('sign1.fall', 1, 0.5, 0.7, 'in'); D.shake(0.5, 0.6, 0.7);
  D.act('aaron', 'idle'); D.path('aaron', [[17.2, 1.0]], 3.0, 0.6);
  D.cam(FIX([2, 2.5, 20], [4, 2, 2], { fov: 58 })); D.sound('Its tail sweeps across the street and flattens a street sign', 2.4); D.wait(2.6);
  D.face('aaron', -P / 2 - 0.2, 0.3);
  // the wrist hologram + the trash can
  D.act('aaron', 'wristUp'); D.anim('aaron.holo', 1, 0.3); D.sfx('holoOn', 0, 0.8);
  D.say('aaron', 'Technology, I need a little help!', { cam: R('aaron', 30, 1.7, 0.2, { lookY: -0.15 }), dur: 2.0 });
  {
    const [ax, az] = pos('aaron');
    D.set('can.y', 0); D.anim('can.y', 1.2, 0.35, 0, 'out'); D.anim('can.x', ax + 0.35, 0.8, 0.2, 'inout'); D.anim('can.z', az - 0.45, 0.8, 0.2, 'inout'); D.anim('can.y', 0.7, 0.45, 0.55, 'in');
    D.sfx('whoosh', 0.1, 0.6); D.sfx('clank', 0.9, 0.9);
    D.comic('CLAMP!', 0.9, 0.8, { x: 0.6, y: 0.35, size: 90, rot: 6, c1: '#bff4ff', c2: '#3fb0ff' });
    D.cam(FIX([ax - 4.5, 1.6, az + 4.5], [ax + 1.5, 1.0, az + 1.5], { fov: 50 })); D.sound('A nearby trash can flies toward him and locks onto his arm', 2.4); D.wait(2.0);
    D.say('aaron', 'Perfect!', { cam: R('aaron', 30, 2.0, 0.1), act: 'thumbsUp', expr: 'grin', dur: 1.2 });
    D.anim('aaron.holo', 0, 0.3);
    // set it down and jump on it: a spring-powered launch pad
    D.anim('can.x', ax - 0.7, 0.4); D.anim('can.z', az, 0.4); D.anim('can.y', 0, 0.4, 0, 'in'); D.sfx('clunk', 0.4, 0.7);
    D.anim('can.spring', 0.35, 0.3, 0.5);
    D.act('aaron', 'dive', 0.6); arc('aaron', ax - 0.7, az, 1.3, 0.5, 0.4, 0.6); D.act('aaron', 'crouchHide', 1.1);
    D.anim('can.sq', 0.75, 0.25, 1.1); D.anim('aaron.y', 1.2, 0.25, 1.1);
    D.cam(FIX([ax - 1, 1.2, az + 6], [ax - 0.7, 1.2, az], { fov: 48 })); D.wait(1.4);
  }
  {
    const r = rigAt(1.0);
    const b = behBack(r, 0.58);
    D.anim('can.sq', 1, 0.1); D.anim('can.spring', 1.2, 0.15); D.sfx('springLaunch', 0, 1.0); D.sfx('powerUpBlue', 0, 0.5);
    D.fx('sparks', { x: D.val('can.x', D.now), y: 1.6, z: D.val('can.z', D.now), n: 50, color: 0x4ab0ff, speed: 3 });
    D.act('aaron', 'fly'); arc('aaron', b[0] + 0.3, b[2] + 0.2, b[1], 2.0, 4.5, 0.05);
    D.say('aaron', 'HERE WE GO!', { cam: FIX([20, 1.0, 12], [10, 6, 0], { fov: 56 }), dur: 1.4 });
    D.cam(F(['aaron'], 150, 5.0, 0.4, { lookY: -0.6, fov: 50 })); D.wait(0.7);
    D.anim('can.spring', 0, 0.6);
    D.act('aaron', 'hang'); D.sfx('thud', 0, 0.7); D.sfx('metalCrash', 0, 0.4);
    D.cam(FIX([b[0] + 3, b[1] + 1.0, b[2] + 6.5], [b[0], b[1] + 0.8, b[2]], { fov: 46 })); D.sound("He sails over the Behemoth and grabs onto its shoulder", 2.0); D.wait(1.0);
  }
  // it shakes violently
  D.set('beh.sway', 0); D.set('beh.slither', 0);
  D.anim('beh.shake', 0.5, 0.2); D.anim('beh.tailSwing', 0.5, 0.4); D.anim('beh.tailSwing', -0.5, 0.5, 0.4); D.anim('beh.tailSwing', 0, 0.4, 0.9);
  D.sfx('bossRoar', 0, 0.7); D.shake(0.7, 1.6);
  D.say('aaron', 'HOLD STILL!', { cam: R('aaron', 160, 2.6, 0.3), act: 'hang', expr: 'angry', dur: 1.6 });
  D.anim('beh.shake', 0, 0.3);
  // climb toward the head
  {
    const r = rigAt(0);
    D.act('aaron', 'climbHead');
    for (const [u, d] of [[0.68, 1.0], [0.78, 1.0], [0.86, 0.9]]) { const b = behBack(r, u); D.anim('aaron.x', b[0] + 0.25, d, 0, 'linear'); D.anim('aaron.y', b[1] - 0.1, d, 0, 'linear'); D.anim('aaron.z', b[2] + 0.1, d, 0, 'linear'); D.wait(d); }
    D.cam(FIX([r.head[0] + 6, r.head[1] + 1, r.head[2] + 5], [r.head[0] - 1, r.head[1] - 0.6, r.head[2]], { fov: 48 }), -2.9);
    D.sound('Aaron climbs toward its head', 1.8, -2.8);
    // fire upward, narrowly missing
    D.anim('beh.nod', -0.9, 0.4); D.anim('beh.jaw', 1, 0.3);
    const r2 = rigAt(0.4);
    D.fx('breath', { from: r2.mouth, to: [r2.mouth[0] + 2, r2.mouth[1] + 9, r2.mouth[2] + 0.5], dur: 1.2, spread: 1.2, size: 0.3 }, 0.4);
    D.sfx('fireBreath', 0.4, 0.9);
    D.act('aaron', 'cover', 0.5);
    D.cam(FIX([r.head[0] + 7, r.head[1] - 1, r.head[2] + 7], [r.head[0], r.head[1] + 2, r.head[2]], { fov: 54 })); D.sound('The Behemoth blows fire upward, narrowly missing him', 2.0); D.wait(1.8);
    D.anim('beh.nod', 0.2, 0.5); D.anim('beh.jaw', 0, 0.4);
    D.say('aaron', 'Okay, that was WAY too close!', { cam: R('aaron', 140, 2.2, 0.3), act: 'climbHead', expr: 'shocked', dur: 2.0 });
    // the adhesive canister
    D.act('aaron', 'hang'); props('aaron', 'canister'); D.expr('aaron', 'determined');
    D.say('aaron', "Let's see how you like this!", { cam: R('aaron', 120, 1.8, 0.2), dur: 1.9 });
    const r3 = rigAt(0.2);
    const eye = [r3.head[0] + r3.dir[0] * 0.05 * r3.s, r3.head[1] + 0.016 * r3.s, r3.head[2] + r3.dir[2] * 0.05 * r3.s];
    D.act('aaron', 'spray');
    D.fx('goo', { who: 'aaron', side: 'R', to: eye, dur: 1.2 }, 0.1); D.sfx('sprayHiss', 0.1, 0.9);
    D.set('beh.goo', 1, 0.9); D.sfx('slimeSplat', 0.9, 0.6);
    D.comic('SPLURT!', 0.8, 0.9, { x: 0.45, y: 0.32, size: 96, rot: -6, c1: '#e8ffd0', c2: '#5ad84a' });
    D.cam(FIX([r3.head[0] + 3.5, r3.head[1] + 0.4, r3.head[2] + 3.5], [r3.head[0], r3.head[1], r3.head[2]], { fov: 46 })); D.sound("He sprays a special adhesive across the Behemoth's eyes", 2.2); D.wait(2.0);
  }
  D.act('aaron', 'hang'); props('aaron');
  D.anim('beh.shake', 0.25, 0.3); D.anim('beh.rear', 0.62, 0.6); D.anim('beh.x', 4.6, 0.6); D.anim('beh.x', 5.2, 0.6, 0.7); D.anim('beh.x', 5.0, 0.6, 1.4);
  roar(2.2, 'RRRRRAAAAGH!', { cam: FIX([16, 1.6, 9], [4, 5, 0], { fov: 54 }), nod: -0.2 });
  D.anim('beh.shake', 0, 0.4);
  D.sound('The creature stumbles around, unable to see clearly', 2.0); D.wait(1.6);
  D.anim('beh.x', 3.6, 0.8); D.anim('beh.look', -0.5, 0.8); D.anim('beh.x', 5.6, 0.9, 1.0); D.anim('beh.look', 0.4, 0.9, 1.0); D.anim('beh.look', 0, 0.6, 2.0);
  D.sfx('boom', 0.6, 0.6); D.sfx('boom', 1.6, 0.6); D.sfx('glassCrack', 1.2, 0.5); D.shake(0.7, 2.2);
  D.act('aaron', 'hang');
  D.cam(FIX([18, 2.0, -5], [5, 4, 0], { fov: 56 })); D.sound('It bumps into the buildings, shaking Aaron back and forth', 2.4); D.wait(2.6);
  {
    const r = rigAt(0);
    const c = r.crown;
    D.act('aaron', 'climbHead'); D.anim('aaron.x', c[0] - 0.9, 0.8); D.anim('aaron.y', c[1] - 0.95, 0.8); D.anim('aaron.z', c[2] + 0.35, 0.8);
    D.wait(0.8);
    D.act('aaron', 'reach'); D.face('aaron', P / 2, 0.3);
    D.say('aaron', 'Time to take off your hat!', { cam: FIX([c[0] - 3.5, c[1] + 1.2, c[2] + 3.2], [c[0] - 0.4, c[1], c[2]], { fov: 46 }), expr: 'grin', dur: 2.0 });
    D.act('aaron', 'heave'); D.anim('crown.lift', 0.8, 0.5); D.sfx('crownCrack', 0.5, 0.8);
    D.wait(0.6);
    D.set('crown.mode', 'aaron'); D.set('crown.size', 0.2); D.act('aaron', 'holdHigh');
    D.comic('YOINK!', 0, 0.8, { x: 0.55, y: 0.3, size: 96, rot: 8 });
    D.set('beh.sway', 0); D.anim('beh.flickerBlue', 1, 0.2); D.sfx('powerDown', 0.2, 0.8);
    D.cam(FIX([c[0] - 4, c[1] + 0.4, c[2] + 5], [c[0] - 0.6, c[1] - 0.5, c[2]], { fov: 48 })); D.sound('He pulls the crown free. The Behemoth suddenly stops moving. Its body flickers with blue light', 3.4); D.wait(2.6);
    // hop down to the street
    D.act('aaron', 'dive'); arc('aaron', 9.5, 2.6, 0, 1.0, 1.0); D.wait(1.0);
    D.act('aaron', 'heroLand'); D.sfx('thud', 0, 0.8); D.face('aaron', -P / 2, 0.3, 0.3); D.wait(0.8);
  }
  D.act('aaron', 'showItem'); D.expr('aaron', 'smug');
  D.say('aaron', 'Huh. That was easier than I thought.', { cam: R('aaron', 25, 2.1, 0.1), dur: 2.2 });
  D.anim('crown.glow', 2.5, 0.2); D.anim('crown.glow', 0.6, 0.2, 0.3); D.anim('crown.glow', 3, 0.2, 0.6); D.anim('crown.glow', 0.8, 0.2, 0.9); D.anim('crown.glow', 4, 0.2, 1.2);
  D.sfx('crownFlash', 0.2, 0.6); D.sfx('crownHum', 0.4, 0.8);
  D.cam(R('aaron', 30, 1.9, 0.45, { lookY: -0.45, fov: 42 })); D.sound('The crown begins pulsing in his hands', 1.8); D.wait(1.8);
  D.expr('aaron', 'worried');
  D.say('aaron', 'Uh... why is it doing that?', { cam: R('aaron', 25, 2.0, 0.1), dur: 1.9 });
  // the blue aura shoots into the sky
  {
    D.set('crown.mode', 'world'); const [ax, az] = pos('aaron'); const ry = D.val('aaron.ry', D.now);
    const cx = ax + Math.sin(ry) * 0.7, cz = az + Math.cos(ry) * 0.7;
    D.set('crown.x', cx); D.set('crown.y', 1.3); D.set('crown.z', cz); D.set('crown.ry', 0); D.set('crown.rx', 0); D.set('crown.size', 0.22);
    D.act('aaron', 'cover'); D.expr('aaron', 'shocked'); D.move('aaron', ax - Math.sin(ry) * 0.8, az - Math.cos(ry) * 0.8, 0.5, 0, { face: false });
    D.fx('pillar', { x: cx, y: 1.3, z: cz, height: 80, radius: 0.8, dur: 4.5, size: 1.0 });
    D.set('flashBlue', 0.35); D.anim('flashBlue', 0, 0.8); D.sfx('energyWave', 0, 0.9); D.sfx('powerUpBlue', 0.1, 0.8);
    D.music('none', 0, 0, 0.3);
    D.cam(FIX([ax + 7, 1.0, az + 9], [cx, 12, cz], { fov: 60 })); D.sound('The crown releases a brilliant blue aura that shoots into the sky', 2.6); D.wait(2.0);
    D.say('aaron', 'GUYS?!', { cam: FIX([ax + 6, 1.4, az + 5], [ax, 1.6, az], { fov: 44 }), act: 'armsOut', dur: 1.4 });
    D.fx('ring', { x: cx, z: cz, y: 1.2, radius: 90, dur: 2.0, color: 0x4ab0ff });
    D.fx('sphere', { x: cx, z: cz, y: 6, radius: 80, dur: 2.0, color: 0x4ab0ff });
    D.set('flashBlue', 0.8); D.anim('flashBlue', 0, 1.4, 0.3); D.sfx('shockwave', 0, 1.0); D.shake(0.8, 1.2);
    D.cam(FIX([0, 30, 60], [cx, 4, cz], { fov: 60 })); D.sound('The light expands into a giant wave of energy', 2.2); D.wait(2.4);
  }

  // ===================================================================== SCENE 5: THE POWERS RETURN
  D.scene('5. The Powers Return');
  D.location('living');
  cast(['flare', 'eric', 'greg', 'leon']);
  D.set('pizza', 0); D.set('tv.off', 1); D.set('table.held', 0);
  D.place('greg', 0, 0.62, P); D.act('greg', 'sitRelax'); D.expr('greg', 'tired');
  D.place('leon', -0.95, 0.62, P); D.act('leon', 'sitRelax'); D.expr('leon', 'tired');
  D.place('eric', 1.55, -0.2, -2.6); D.act('eric', 'idle'); D.expr('eric', 'tired'); props('eric');
  D.place('flare', -4.6, 1.9, 1.2); D.act('flare', 'idle'); D.expr('flare', 'tired');
  D.music('mystery', 0.45, 0, 0.4);
  D.set('flashBlue', 0.7); D.anim('flashBlue', 0, 1.6); D.sfx('energyArrive', 0, 1.0);
  D.cam(FIX([3.5, 2.4, -3.6], [-0.5, 1.0, 0.4], { fov: 56 }));
  D.sound('The blue energy wave travels across the city and reaches headquarters', 3.0); D.wait(3.0);
  // Greg floats
  D.act('greg', 'floatSit'); D.anim('greg.y', 0.35, 1.2); D.expr('greg', 'surprised'); D.sfx('magicFloat', 0, 0.6);
  D.cam(R('greg', 0, 2.2, 0.2)); D.wait(1.2);
  D.say('greg', 'Whoa. Why am I floating?', { dur: 1.8 });
  D.fx('orbs', { who: 'greg', dur: 2.6, n: 7, merge: 1.6, to: [0, 1.5, 0.62], color: 0x4ab0ff }); D.sfx('orbHum', 0, 0.6);
  D.cam(R('greg', 20, 2.6, 0.3)); D.sound('Blue energy swirls around him before disappearing into his body', 2.4); D.wait(2.6);
  D.anim('greg.eyeGlow', 1, 0.2); D.anim('greg.eyeGlow', 0, 0.5, 0.9); D.sfx('sparkle', 0, 0.6);
  D.cam(R('greg', 0, 1.0, 0.05, { fov: 36 })); D.sound('His eyes glow briefly', 1.4); D.wait(1.4);
  D.say('greg', "Oh, that's new.", { cam: R('greg', 0, 1.6, 0.1), expr: 'happy', dur: 1.5 });
  // Flare
  D.face('flare', 2.5, 0.3);
  D.say('flare', "Wait, what's that light?", { cam: R('flare', 0, 2.2, 0.1), expr: 'surprised', dur: 1.8 });
  D.fx('orbs', { who: 'flare', dur: 2.0, n: 6, merge: 1.2, to: [-4.6, 1.2, 2.1], color: 0x4ab0ff }); D.sfx('orbHum', 0, 0.5);
  D.act('flare', 'fireRings', 1.4);
  D.fx('flame', { who: 'flare', side: 'R', dur: 4.0, size: 0.24 }, 1.6); D.fx('flame', { who: 'flare', side: 'L', dur: 4.0, size: 0.24 }, 1.6);
  D.anim('flare.suitGlow', 1, 0.5, 1.6); D.sfx('flameIgnite', 1.6, 0.9);
  D.cam(R('flare', 20, 2.6, 0.2)); D.sound('The energy enters his hands. Flames ignite around his fingers, and glowing lines appear along his arms', 3.4); D.wait(3.2);
  D.expr('flare', 'grin');
  D.say('flare', 'MY POWERS! I GOT THEM BACK!', { cam: R('flare', 15, 2.4, 0.1), dur: 2.0 });
  D.anim('flare.suitGlow', 0.3, 1.0);
  // Leon
  D.place('leon', -0.95, 0.62, P); D.act('leon', 'idle'); D.expr('leon', 'determined'); D.move('leon', -0.95, 0.05, 0.6, 0, { face: false });
  D.sfx('floorCreak', 0.2, 0.9); D.fx('bodyAura', { who: 'leon', dur: 3.0, color: 0xf2b632 });
  D.act('leon', 'flex', 0.5);
  D.cam(R('leon', 15, 2.6, 0.2)); D.sound('Leon suddenly stands up. He clenches his fists, and the floor creaks beneath his feet', 3.0); D.wait(2.8);
  D.say('leon', 'I feel... STRONG AGAIN!', { dur: 2.0 });
  D.act('leon', 'idle'); D.path('leon', [[-0.6, -0.4]], 1.8); D.face('leon', P, 0.3, 0.3);
  D.wait(0.7);
  D.set('table.held', 1); props('leon', 'table'); D.act('leon', 'holdTable'); D.sfx('whoosh', 0, 0.6); D.sfx('thud', 0.1, 0.4);
  D.cam(F(['leon'], 30, 4.2, 0.4, { lookY: 0.2 })); D.sound('He lifts the heavy table with one hand', 1.8); D.wait(1.8);
  D.say('leon', 'YES! SUPER STRENGTH!', { cam: F(['leon'], 20, 3.6, 0.3, { lookY: 0.2 }), expr: 'grin', dur: 1.8 });
  // Eric becomes a cat
  D.faceTo('eric', -1.0, 0.3, 0.3); D.expr('eric', 'shocked');
  D.say('eric', 'Wait, wait, wait! What is it gonna do to me?!', { cam: R('eric', 0, 2.2, 0.1), act: 'armsOut', dur: 2.4 });
  D.fx('orbs', { who: 'eric', dur: 1.8, n: 7, merge: 1.0, to: [1.55, 1.0, -0.2], color: 0x4ab0ff });
  D.wait(1.2);
  {
    const [ex, ez] = pos('eric');
    D.set('flashWhite', 0.5); D.anim('flashWhite', 0, 0.4); D.sfx('transform', 0, 0.9); D.sfx('whoosh', 0, 0.8);
    D.comic('WHOOSH!', 0, 0.9, { x: 0.55, y: 0.35, size: 100, rot: -6, c1: '#ffffff', c2: '#7fd4ff' });
    D.fx('sparks', { x: ex, y: 0.6, z: ez, n: 60, color: 0x6fc4ff, speed: 2 });
    D.hide('eric', 0.05); D.place('cat', ex, ez, D.val('eric.ry', D.now), 0.05); D.set('cat.act', 'idle', 0.05); D.set('cat.spin', 0);
    D.cam(F(['cat'], 210, 1.4, 0.3, { lookY: -0.2, fov: 40 })); D.sound('Eric transforms into a small cat', 1.6); D.wait(1.8);
  }
  D.set('cat.act', 'meow'); D.sfx('meow', 0, 0.9);
  D.say('eric', 'MEO—', { label: 'CAT ERIC', cam: F(['cat'], 210, 1.0, 0.15, { lookY: -0.1, fov: 38 }), dur: 1.2 });
  D.set('cat.act', 'sad');
  D.cam(F(['cat'], 190, 0.8, 0.3, { lookY: -0.2, fov: 38 })); D.sound('He pauses, looks at his paws... and laughs', 2.0); D.wait(2.0);
  D.set('cat.act', 'laugh');
  D.say('eric', "HAHAHA! I'M A CAT AGAIN!", { label: 'CAT ERIC', cam: F(['cat'], 210, 1.1, 0.15, { lookY: -0.1, fov: 38 }), dur: 2.2 });
  {
    D.set('cat.act', 'run');
    const [cx, cz] = pos('cat');
    const pts = []; for (let i = 1; i <= 16; i++) { const a = (i / 8) * P * 2; pts.push([cx + 0.45 - Math.cos(a) * 0.45, cz + Math.sin(a) * 0.45]); }
    D.path('cat', pts, 3.2); D.sfx('meow', 0.8, 0.5);
    D.cam(F(['cat'], 200, 2.2, 0.8, { lookY: -0.5, fov: 44 })); D.sound('He runs in a circle, chasing his own tail', 2.0); D.wait(1.8);
  }
  D.say('flare', 'Eric! Focus!', { cam: R('flare', 15, 2.4, 0.1), act: 'point', expr: 'annoyed', dur: 1.4 });
  D.say('eric', "I CAN'T! LOOK AT MY TAIL!", { label: 'CAT ERIC', cam: F(['cat'], 200, 2.0, 0.8, { lookY: -0.5, fov: 44 }), dur: 1.8 });
  D.set('cat.act', 'sit'); D.act('flare', 'idle');
  // back to Aaron
  D.location('downtown');
  cast(['aaron', 'beh']); D.show('beh');
  D.set('crown.mode', 'world'); D.set('beh.flickerBlue', 1); D.set('beh.sway', 0); D.set('beh.slither', 0); D.set('table.held', 0);
  D.place('aaron', 9.5, 2.6, -P / 2); D.act('aaron', 'idle'); D.expr('aaron', 'surprised'); D.set('aaron.y', 0);
  D.music('heroic', 0.5, 0, 0.4);
  D.fx('orbs', { who: 'aaron', dur: 3.0, n: 9, merge: 2.0, to: [9.5, 1.2, 2.6], color: 0x4ab0ff }); D.sfx('energyArrive', 0, 0.8);
  D.cam(FIX([13.5, 1.6, 6.5], [9.5, 1.3, 2.6], { fov: 48 }));
  D.sound("Meanwhile, the remaining energy rushes back toward Aaron", 2.6); D.wait(2.6);
  D.anim('aaron.suitGlow', 1, 0.8); D.fx('bodyAura', { who: 'aaron', dur: 6.0, color: 0x4ab0ff }); D.sfx('powerUpBlue', 0, 0.9);
  D.cam(R('aaron', 20, 2.4, 0.1)); D.sound('Blue circuits light up across his arms, chest and gloves', 2.4); D.wait(2.4);
  D.say('aaron', 'My powers are different now...', { act: 'lookHand', expr: 'surprised', dur: 2.0 });
  D.act('aaron', 'shieldUp'); D.anim('aaron.shield', 1, 0.25); D.sfx('shieldOn', 0, 1.0);
  D.cam(R('aaron', 40, 2.8, 0.1)); D.sound('He raises his hand. A powerful holographic shield forms instantly', 2.4); D.wait(2.0);
  D.say('aaron', 'My technology is stronger!', { expr: 'grin', dur: 1.9 });
  D.anim('aaron.shield', 0, 0.4); D.act('aaron', 'fistPump'); D.expr('aaron', 'happy');
  D.say('aaron', 'I did it!', { cam: R('aaron', 15, 2.2, 0.1), dur: 1.4 });
  D.act('aaron', 'idle');
  // the Behemoth dissolves; the crown breaks apart
  D.anim('beh.dissolve', 1, 3.2); D.fx('behDissolve', { dur: 3.6, size: 1.6 }); D.sfx('smokeDissolve', 0, 0.9); D.sfx('sparkle', 0.5, 0.6);
  D.set('crown.gone', 1, 1.6); D.sfx('crownBreak', 1.6, 1.0);
  {
    const cx = D.val('crown.x', D.now), cz = D.val('crown.z', D.now);
    D.fx('debris', { x: cx, y: 1.3, z: cz, n: 30, color: 0x8a7a8a, color2: 0x4ab0ff, spread: 0.6, size: 0.8, up: 0.6 }, 1.6);
    D.fx('sparks', { x: cx, y: 1.3, z: cz, n: 50, color: 0x6ab0ff, speed: 2.5 }, 1.6);
    D.set('shards', 1, 1.8); D.set('shards.x', cx, 1.8); D.set('shards.z', cz, 1.8);
  }
  D.faceTo('aaron', 2, 0, 0.4);
  D.cam(FIX([15, 2.2, 9], [3, 3, 0], { fov: 54 })); D.sound("The Behemoth's body dissolves into glowing particles. The crown breaks apart completely", 3.6); D.wait(3.8);
  D.hide('beh');

  // ===================================================================== SCENE 6: WHERE DID THE BEHEMOTH GO?
  D.scene('6. Where Did the Behemoth Go?');
  cast(['aaron', 'flare', 'greg', 'leon', 'cat']);
  D.set('beh.dissolve', 0); D.set('crown.gone', 1);
  D.place('aaron', 8.0, 2.2, P); D.act('aaron', 'idle'); D.expr('aaron', 'neutral'); D.set('aaron.suitGlow', 0.6);
  D.place('flare', 18, 5.0, -P / 2); D.place('leon', 18.5, 0.2, -P / 2); D.place('cat', 17, 2.6, -P / 2); D.set('cat.act', 'run');
  D.place('greg', 19, 3.5, -P / 2); D.set('greg.y', 1.4); D.act('greg', 'fly');
  D.path('flare', [[10.2, 4.0]], 4.5); D.path('leon', [[10.4, 0.6]], 4.2); D.path('cat', [[9.4, 3.6]], 4.2);
  D.anim('greg.x', 10.8, 2.0); D.anim('greg.z', 2.4, 2.0); D.anim('greg.y', 0.7, 2.0); D.act('greg', 'hover', 1.4);
  D.music('hq', 0.4, 0, 0.5);
  D.cam(FIX([2.6, 1.6, 5.8], [12, 1.2, 2.6], { fov: 52 }));
  D.sound('Moments later, Flare, Greg, Eric and Leon arrive', 2.4); D.wait(2.0);
  D.set('cat.act', 'sit');
  for (const c of ['flare', 'leon', 'greg']) D.faceChar(c, 'aaron', 0.3);
  D.say('flare', 'Aaron! I think you did it!', { cam: R('flare', -20, 2.2, 0.1), act: 'cheer', expr: 'grin', dur: 1.9 });
  D.act('flare', 'idle'); D.face('aaron', -P / 2 + 0.2, 0.4);
  D.say('aaron', "Where's the Behemoth?", { cam: R('aaron', 20, 2.2, 0.1), expr: 'surprised', dur: 1.7 });
  for (const [c, y] of [['flare', 0.8], ['leon', -0.9], ['greg', 1.2], ['aaron', -1.0]]) D.look(c, y, 0, 0.5);
  D.cam(FIX([9.5, 4.5, 9], [9.5, 0.8, 2.6], { fov: 54 })); D.sound('Everyone looks around. There is no sign of the creature', 2.4); D.wait(2.4);
  for (const c of ['flare', 'leon', 'greg', 'aaron']) D.look(c, 0, 0, 0.3);
  D.say('flare', "That doesn't matter! You destroyed the crown. This was faster than I thought!", { cam: R('flare', -20, 2.2, 0.1), act: 'armsOut', expr: 'happy', dur: 3.4 });
  D.say('aaron', "Yeah. I'm kind of a smart person, right?", { cam: R('aaron', 20, 2.2, 0.1), act: 'handsHips', expr: 'smug', dur: 2.2 });
  D.say('greg', 'Yeah, I guess, man.', { cam: R('greg', 20, 2.4, 0.1), act: 'shrug', dur: 1.6 });
  // Greg floats upside down
  D.act('greg', 'hover'); D.anim('greg.roll', P, 0.9); D.anim('greg.y', 0.9, 0.9); D.sfx('magicFloat', 0, 0.5);
  D.cam(F(['greg'], 40, 3.4, 0.0, { lookY: -0.6 })); D.sound('Greg floats upside down for a moment, testing his powers', 2.2); D.wait(2.2);
  D.say('greg', 'Well, now what should we do?', { dur: 1.8 });
  D.anim('greg.roll', 0, 0.8); D.anim('greg.y', 0.6, 0.8);
  D.say('aaron', "First, we need to find the Soul Stealer's lair. We don't even know where it is.", { cam: R('aaron', 20, 2.2, 0.1), act: 'point', expr: 'determined', dur: 3.4 });
  D.act('aaron', 'idle');
  D.say('greg', "No, that's not what we should do first.", { cam: R('greg', 20, 2.4, 0.1), act: 'hover', expr: 'serious', dur: 2.0 });
  D.say('greg', 'If we attack them before defending our headquarters, our base could be destroyed!', { act: 'armsOut', dur: 3.4 });
  D.act('greg', 'hover');
  D.say('aaron', "Oh, yeah. You're right.", { cam: R('aaron', 20, 2.2, 0.1), expr: 'neutral', dur: 1.6 });
  D.faceChar('aaron', 'leon', 0.3);
  D.say('aaron', 'Leon, what should we do?', { dur: 1.6 });
  D.faceChar('leon', 'aaron', 0.3);
  D.say('leon', 'Maybe we should use a disguise. Make it look like our headquarters is untouched and nobody knows about our plans.', { cam: R('leon', -15, 2.4, 0.1), expr: 'serious', dur: 4.6 });
  D.say('leon', 'Then we can set a trap at the headquarters and figure out where the Soul Stealer is hiding.', { act: 'orate', dur: 4.0 });
  D.act('leon', 'idle');
  D.say('aaron', "Okay, that may not be a good idea. What if they notice the traps?", { cam: R('aaron', 30, 2.2, 0.1), act: 'shrug', expr: 'worried', dur: 3.0 });
  D.say('leon', "No, that's not gonna happen. Trust me.", { cam: R('leon', -15, 2.4, 0.1), act: 'crossArms', expr: 'smug', dur: 2.2 });
  D.act('leon', 'idle');
  // Greg drifts higher; his eyes change color
  D.anim('greg.y', 2.4, 3.0); D.expr('greg', 'serious');
  D.say('greg', "Maybe I'll just go there myself and destroy him. Who knows?", { cam: F(['greg'], 30, 3.6, -0.4, { lookY: 0.1 }), dur: 3.0 });
  D.anim('greg.eyeGlow', 1, 0.2); D.anim('greg.eyeGlow', 0, 0.4, 1.1); D.sfx('crownHum', 0, 0.4);
  D.cam(F(['greg'], 10, 1.4, -0.1, { fov: 36 })); D.sound("His eyes briefly change color", 1.6); D.wait(1.6);
  D.faceChar('flare', 'greg', 0.3); D.look('flare', 0, -0.3, 0.3);
  D.say('flare', 'Greg? You okay?', { cam: R('flare', -20, 2.2, 0.1, { lookY: 0.2 }), expr: 'worried', dur: 1.6 });
  D.anim('greg.y', 0.6, 1.2); D.look('flare', 0, 0, 0.6, 0.6);
  D.cam(F(['greg'], 30, 3.4, 0.0)); D.sound('Greg stops floating and looks down', 1.6); D.wait(1.4);
  D.say('greg', "Yeah. I'm fine.", { cam: R('greg', 20, 2.2, 0.1), expr: 'neutral', dur: 1.5 });
  // cat Eric throws a pizza slice
  {
    D.set('cat.pizza', 1); D.set('cat.act', 'sit');
    D.cam(F(['cat'], 30, 1.2, 0.2, { lookY: -0.1, fov: 40 })); D.sound('Eric, still a cat, suddenly has a slice of pizza', 1.8); D.wait(1.4);
    D.set('cat.act', 'swipe'); D.set('cat.pizza', 0, 0.15);
    const [cx, cz] = pos('cat'), [gx, gz] = pos('greg');
    flyThrow('pizza', [cx, 0.4, cz], [gx + 0.25, 1.6, gz + 0.15], 0.75, 1.2, 0.15);
    D.sfx('whoosh', 0.15, 0.6); D.sfx('catchPlate', 0.9, 0.5);
    D.act('greg', 'catchSide', 0.7); props('greg', 'none'); D.set('greg.propR', 'pizza', 0.9); D.look('greg', -0.4, 0, 0.3, 0.6);
    D.cam(FIX([gx - 3.2, 1.6, gz + 3.0], [(cx + gx) / 2, 1.0, (cz + gz) / 2], { fov: 52 })); D.sound('Greg catches it in midair without looking', 2.0); D.wait(2.0);
    D.set('cat.act', 'sit');
  }
  D.act('greg', 'eatBar'); D.look('greg', 0, 0, 0.3); D.expr('greg', 'smug');
  D.say('greg', "Just like this pizza, I'm gonna beat him up just as easily as this pizza tastes good.", { cam: R('greg', 20, 2.2, 0.1), dur: 4.0 });
  D.sfx('munch', 0, 0.7);
  D.say('greg', 'Mmm. Delicious.', { expr: 'happy', dur: 1.6 });
  D.act('aaron', 'laugh'); D.expr('aaron', 'laugh'); D.sfx('claps', 0, 0.2);
  D.cam(R('aaron', 20, 2.2, 0.1)); D.sound('Aaron laughs', 1.2); D.wait(1.2);
  D.act('aaron', 'idle'); D.expr('aaron', 'happy');
  D.say('aaron', "Okay, okay. We can't do this today. We just got our powers back.", { dur: 3.0 });
  D.say('aaron', "We don't even know how strong they are yet.", { dur: 2.2 });
  D.say('greg', 'Well, it was the Behemoth, obviously.', { cam: R('greg', 20, 2.2, 0.1), act: 'shrug', dur: 2.0 });
  D.expr('aaron', 'serious');
  D.say('aaron', "No, it wasn't just the Behemoth. The Soul Stealer's power was connected to it.", { cam: R('aaron', 20, 2.2, 0.1), dur: 3.4 });
  D.say('aaron', 'And I feel like it all connected just that fast.', { dur: 2.4 });
  {
    const sx = D.val('shards.x', D.now), sz = D.val('shards.z', D.now);
    D.faceTo('aaron', sx, sz, 0.4); D.act('aaron', 'lookDown');
    D.cam(FIX([sx + 1.6, 1.0, sz + 1.6], [sx, 0.1, sz], { pos2: [sx + 1.3, 0.8, sz + 1.3], fov: 44 })); D.sound('Aaron looks at the broken remains of the crown', 2.0); D.wait(2.2);
  }
  D.say('aaron', "The Soul Stealer isn't the only person we're dealing with.", { cam: R('aaron', 25, 1.9, 0.08), act: 'idle', expr: 'serious', dur: 3.0 });
  D.anim('fade', 1, 0.6); D.wait(0.7);

  // ===================================================================== SCENE 7: BACK TO BUSINESS
  D.scene('7. Back to Business');
  D.location('living');
  cast(['aaron', 'flare', 'greg', 'leon', 'cat']);
  D.set('fade', 0); D.set('evening', 1); D.set('tv.off', 0); D.set('tv.fall', 0); D.set('pizza', 1); D.set('table.held', 0); D.set('aaron.suitGlow', 0);
  D.place('cat', 0.2, 0.55, P); D.set('cat.y', 0.45); D.set('cat.act', 'play'); D.set('cat.pizza', 1);
  D.place('aaron', -2.4, -1.4, 0.6); D.place('flare', -1.2, -2.0, 0.3); D.place('greg', 1.8, -1.6, -0.5); D.set('greg.y', 0.3); D.act('greg', 'hover'); D.place('leon', 2.8, -0.5, -1.0);
  for (const c of ['aaron', 'flare', 'leon']) { D.act(c, 'idle'); D.expr(c, 'happy'); }
  D.music('chill', 0.35, 0, 0.6);
  D.cam(FIX([3.6, 2.2, 4.0], [0, 1.0, -1.0], { fov: 56 }));
  D.card('location', 3.0, { text: 'BATTLE WARS HQ  -  EVENING' });
  D.sound('Back at headquarters, Eric, still a cat, plays a video game while eating pizza', 3.2, 0.2); D.wait(3.4);
  D.say('aaron', "Well, why don't we just eat something? I'm starving.", { cam: R('aaron', 20, 2.2, 0.1), act: 'armsOut', dur: 2.6 });
  D.act('aaron', 'idle');
  D.say('flare', 'You just defeated a giant monster. I think we can take a break.', { cam: R('flare', 0, 2.2, 0.1), act: 'handsHips', dur: 3.0 });
  D.say('aaron', 'Exactly!', { cam: R('aaron', 20, 2.2, 0.1), act: 'pointUp', expr: 'grin', dur: 1.2 });
  D.act('aaron', 'idle');
  D.say('greg', "I'm still thinking about going after the Soul Stealer.", { cam: R('greg', -15, 2.2, 0.1), expr: 'serious', dur: 2.6 });
  D.faceChar('aaron', 'greg', 0.3); D.expr('aaron', 'serious');
  D.say('aaron', "We need to be careful. If the Behemoth comes back with another crown, we'll have to fight all over again.", { cam: R('aaron', 65, 2.2, 0.1), dur: 4.4 });
  D.say('aaron', "I don't want that happening.", { dur: 1.7 });
  D.say('flare', "All right. Greg and I will keep watch. We're the only ones taking this seriously.", { cam: R('flare', 0, 2.2, 0.1), act: 'crossArms', expr: 'serious', dur: 3.6 });
  D.act('flare', 'idle'); D.faceTo('aaron', 0.2, 0.5, 0.3); D.expr('aaron', 'happy');
  D.say('aaron', 'Eric, you do you. We know you love pizza.', { cam: R('aaron', 30, 2.2, 0.1), act: 'point', dur: 2.4 });
  D.act('aaron', 'idle');
  D.set('cat.act', 'meow'); D.sfx('meow', 0, 0.8);
  D.say('eric', 'MEOW!', { label: 'CAT ERIC', cam: F(['cat'], 160, 1.2, 0.2, { lookY: -0.1, fov: 40 }), dur: 1.2 });
  D.set('cat.act', 'play');
  // the game falls off a cliff
  D.anim('tv.fall', 1, 2.2, 0.2, 'linear'); D.sfx('gameFall', 0.9, 0.8); D.sfx('buttonMash', 0.1, 0.5);
  D.cam(FIX([0.3, 1.25, -1.2], [0, 1.75, -4.55], { fov: 46 })); D.sound("Eric accidentally hits a button, and his character falls off a cliff", 2.6); D.wait(2.6);
  D.set('cat.act', 'sad');
  D.say('eric', "NOOOOO! I WAS RIGHT THERE!", { label: 'CAT ERIC', cam: F(['cat'], 170, 1.3, 0.25, { lookY: -0.1, fov: 40 }), dur: 2.2 });
  D.set('tv.fall', 0);
  D.faceChar('leon', 'cat', 0.3); D.expr('leon', 'happy');
  D.say('leon', "I'll play with you. I don't mind.", { cam: R('leon', 10, 2.2, 0.1), act: 'shrug', dur: 2.0 });
  D.act('leon', 'idle'); D.path('leon', [[1.2, 1.2], [0.85, 0.62]], 1.6); D.face('leon', P, 0.3, 1.6);
  D.wait(1.8);
  D.act('leon', 'sitGame'); props('leon', 'controller'); D.set('cat.act', 'play'); D.set('cat.pizza', 0);
  D.cam(FIX([0.5, 1.5, -1.6], [0.5, 0.8, 0.6], { fov: 48 })); D.sound('Leon sits beside Eric', 1.4); D.wait(1.4);
  D.faceTo('aaron', 0.5, 0.6, 0.3); D.expr('aaron', 'annoyed');
  D.say('aaron', 'You two are supposed to be watching for danger!', { cam: R('aaron', 25, 2.2, 0.1), act: 'armsOut', dur: 2.6 });
  D.say('leon', "We're watching the screen.", { cam: FIX([0.5, 1.5, -1.6], [0.6, 1.0, 0.6], { fov: 44 }), dur: 1.7 });
  D.say('aaron', "THAT'S NOT WHAT I MEANT!", { cam: R('aaron', 25, 2.2, 0.1), act: 'yell', expr: 'angry', dur: 1.8 });
  D.act('aaron', 'idle');
  D.act('flare', 'facepalm'); D.wait(0.6);
  D.act('flare', 'idle'); D.path('flare', [[3.0, -0.4], [5.0, 1.0]], 2.4); D.path('greg', [[3.4, 0.2], [5.4, 1.6]], 2.4, 0.4);
  D.cam(FIX([-1.5, 2.0, -3.0], [3.5, 1.4, 0.4], { fov: 52 })); D.sound('Flare shakes his head and heads toward the Controller Room. Greg follows him', 3.0); D.wait(3.0);
  // the Controller Room
  D.location('control');
  cast(['flare', 'greg']);
  D.set('map.mode', 2); D.set('map.zoom', 0); D.set('map.blip', 0);
  D.place('flare', -1.2, -2.3, P); D.act('flare', 'leanTable'); D.expr('flare', 'serious');
  D.place('greg', 1.6, -0.6, P - 0.3); D.set('greg.y', 1.9); D.act('greg', 'hover'); D.expr('greg', 'neutral');
  D.music('mystery', 0.35, 0, 0.5);
  D.cam(FIX([0.8, 2.6, 3.4], [0, 2.0, -3.5], { fov: 54 }));
  D.card('location', 2.6, { text: 'CONTROLLER ROOM' });
  D.sound("Flare checks the city's security cameras while Greg floats near the ceiling", 3.0, 0.2); D.wait(3.2);
  D.say('flare', 'Nothing unusual so far.', { cam: FIX([-2.4, 1.8, -0.4], [-1.2, 1.4, -2.3], { fov: 44 }), dur: 1.7 });
  D.say('greg', 'Good.', { cam: F(['greg'], 180, 2.2, -0.2, { lookY: 0.1 }), dur: 1.2 });
  D.anim('greg.eyeGlow', 1, 0.2); D.anim('greg.eyeGlow', 0, 0.5, 1.0); D.sfx('crownHum', 0, 0.35);
  D.cam(F(['greg'], 175, 1.2, -0.1, { fov: 36 })); D.sound("Greg's eyes briefly glow again", 1.6); D.wait(1.6);
  D.face('flare', 0.4, 0.4); D.act('flare', 'idle'); D.look('flare', 0, -0.35, 0.3);
  D.say('flare', "You sure you're okay? You've been acting strange since that energy wave hit us.", { cam: R('flare', -10, 2.2, 0.15, { lookY: 0.25 }), expr: 'worried', dur: 3.6 });
  D.anim('greg.y', 0, 1.0, 0, 'in');
  D.cam(F(['greg'], 160, 3.0, 0.0)); D.sound('Greg stops floating', 1.4); D.wait(1.2);
  D.look('flare', 0, 0, 0.3);
  D.say('greg', "I'm fine, Flare. Just testing my powers.", { cam: F(['greg'], 170, 2.0, 0.05), expr: 'happy', dur: 2.4 });
  D.say('flare', "All right. Just don't float through the ceiling.", { cam: R('flare', -10, 2.2, 0.15), act: 'point', expr: 'smug', dur: 2.4 });
  D.act('flare', 'idle'); D.face('flare', P, 0.4); D.act('flare', 'leanTable', 0.4);
  D.act('greg', 'laugh'); D.expr('greg', 'laugh'); D.sfx('claps', 0, 0.15);
  D.cam(F(['greg'], 170, 1.8, 0.05)); D.sound('Greg chuckles...', 1.2); D.wait(1.3);
  D.act('greg', 'idle'); D.expr('greg', 'serious'); D.anim('greg.eyeGlow', 0.6, 0.3); D.anim('greg.eyeGlow', 0, 0.6, 1.6);
  D.cam(F(['greg'], 170, 1.15, 0.0, { fov: 34, dist2: 0.95, lookY: 0.1 })); D.sound('...but his expression becomes serious as Flare looks away', 2.4); D.wait(2.4);
  // the window
  D.location('living');
  cast(['aaron', 'leon', 'cat']);
  D.set('tv.fall', -1);
  D.place('aaron', -6.2, -1.2, -P / 2); D.act('aaron', 'idle'); D.expr('aaron', 'serious');
  D.place('leon', -3.6, -3.2, -1.2); D.act('leon', 'idle'); D.expr('leon', 'serious'); props('leon');
  D.cam(FIX([-3.4, 1.8, -0.6], [-6.8, 1.6, -1.6], { fov: 48 }));
  D.sound('Aaron stands near the window, looking out over the city', 2.6, 0.2); D.wait(2.8);
  D.say('aaron', "We need to get ready. Something tells me this isn't over.", { cam: FIX([-6.3, 1.55, 0.7], [-6.2, 1.45, -1.2], { fov: 40 }), dur: 3.0 });
  D.path('leon', [[-6.1, -2.4]], 1.4); D.face('leon', -P / 2, 0.3, 1.5);
  D.cam(FIX([-3.4, 1.8, -0.6], [-6.4, 1.5, -1.9], { fov: 48 })); D.sound('Leon walks up beside him', 1.6); D.wait(1.8);
  D.faceChar('leon', 'aaron', 0.3);
  D.say('leon', "Then we'll be ready.", { cam: FIX([-4.8, 1.55, -0.9], [-6.1, 1.45, -2.4], { fov: 40 }), dur: 1.7 });
  D.faceChar('aaron', 'leon', 0.4); D.act('aaron', 'idle');
  D.look('aaron', 0, 0.2, 0.2); D.look('aaron', 0, 0, 0.2, 0.3);
  D.say('aaron', "Yeah. We'll be ready.", { cam: FIX([-5.0, 1.55, -2.9], [-6.2, 1.45, -1.2], { fov: 40 }), expr: 'determined', dur: 1.9 });
  D.anim('fade', 1, 1.0); D.wait(1.2);

  // ===================================================================== SCENE 8: THE COWBOY
  D.scene('8. The Cowboy');
  D.location('alley');
  cast(['cowboy', 'horse']);
  D.set('alley.flicker', 1); D.set('alley.eyes', 0); D.set('clay.ground', 1); D.set('clay.x', 0.45); D.set('clay.z', -1.7); D.set('clay.glow', 0);
  D.place('horse', -0.75, -3.8, 0.15); D.set('horse.act', 'idle');
  D.place('cowboy', 0.45, -3.4, 0.1); D.act('cowboy', 'idle'); D.expr('cowboy', 'neutral'); props('cowboy');
  D.music('none', 0, 0, 0.1);
  D.sfx('wind', 0.2, 0.8); D.sfx('horseSnort', 2.2, 0.8);
  D.sound('Distant wind. A horse quietly snorts', 2.6, 0.4); D.wait(3.2);
  D.music('western', 0.45, 0, 2.0);
  D.anim('fade', 0, 2.2);
  D.cam(FIX([0, 1.6, 9], [0, 1.4, -3.4], { pos2: [0, 1.55, 6.5], fov: 44, ease: 'linear' }));
  D.card('location', 3.0, { text: 'A DARK CITY ALLEY  -  NIGHT' });
  D.sound('A narrow alley lit by a flickering streetlight', 2.4, 3.2); D.wait(6.2);
  D.set('horse.act', 'shift'); D.sfx('hooves', 0.1, 0.3);
  D.cam(FIX([2.0, 1.4, 1.6], [0, 1.4, -3.6], { fov: 44 }));
  D.sound('A mysterious cowboy stands beside a dark horse. His face remains hidden beneath a wide-brimmed hat', 3.6); D.wait(3.8);
  D.set('horse.act', 'idle');
  D.look('cowboy', 0, -0.55, 1.4);
  D.cam(FIX([1.2, 1.0, -1.4], [0.45, 1.9, -3.4], { pos2: [0.9, 1.1, -2.1], fov: 40 }));
  D.sound('He slowly raises his head and looks toward the sky', 2.4); D.wait(3.0);
  D.cam(F(['cowboy'], 20, 1.3, -0.1, { fov: 38, dist2: 1.0 }));
  D.sound('The camera moves closer, but his face remains hidden in shadow', 2.6); D.wait(2.8);
  D.look('cowboy', 0, 0, 0.6);
  // the clay figure
  D.faceTo('cowboy', 0.45, -1.7, 0.6); D.look('cowboy', 0, 0.4, 0.6, 0.4);
  D.cam(FIX([1.4, 0.5, -0.6], [0.45, 0.2, -1.7], { fov: 40 }));
  D.sound('He turns his attention to a small clay figure lying on the ground. It resembles the Behemoth', 3.4); D.wait(3.4);
  D.look('cowboy', 0, 0, 0.3); D.path('cowboy', [[0.45, -2.25]], 0.8);
  D.act('cowboy', 'kneelPick', 1.2);
  D.cam(FIX([1.8, 1.1, -0.8], [0.45, 0.6, -2.0], { fov: 44 })); D.wait(2.4);
  D.set('clay.ground', 0); props('cowboy', 'clay'); D.act('cowboy', 'idle'); D.sfx('bagRustle', 0, 0.3);
  D.act('cowboy', 'studyHand', 0.5);
  D.cam(FIX([1.0, 1.4, -1.0], [0.22, 1.28, -1.9], { fov: 40 }));
  D.sound('He kneels, picks up the figure, and studies it silently', 2.6); D.wait(3.6);
  D.anim('clay.glow', 0.6, 0.6); D.sfx('clayHum', 0, 0.7);
  D.cam(FIX([0.66, 1.6, -1.12], [0.17, 1.4, -1.75], { fov: 30 })); D.sound('A faint blue glow flickers across its surface', 2.2); D.wait(3.0);
  D.act('cowboy', 'fistsClench');
  D.cam(FIX([1.6, 1.2, -0.6], [0.45, 0.8, -2.2], { fov: 40 })); D.sound('The cowboy closes his hand around it', 1.8); D.wait(2.4);
  // the horse neighs; two small lights in the darkness
  D.set('horse.act', 'neigh'); D.sfx('horseNeigh', 0, 1.0); D.sfx('hooves', 0.6, 0.4);
  D.cam(FIX([1.7, 1.5, 0.8], [-0.75, 2.0, -3.4], { fov: 46 })); D.sound('The horse suddenly raises its head and lets out a loud neigh', 2.4); D.wait(2.6);
  D.set('horse.act', 'idle');
  D.faceTo('cowboy', 0, -26, 0.6);
  D.cam(FIX([0.9, 1.6, 0.2], [0, 1.4, -20], { fov: 40 })); D.sound('The cowboy looks toward the end of the alley', 2.0); D.wait(2.2);
  D.anim('alley.eyes', 1, 1.2); D.sfx('spookyStinger', 0.3, 0.6);
  D.cam(FIX([0.2, 1.5, -3.0], [0, 1.4, -24], { fov: 22 })); D.sound('Two small lights appear in the darkness', 2.0); D.wait(3.2);
  // he mounts the horse
  {
    const hx = D.val('horse.x', D.now), hz = D.val('horse.z', D.now), hry = D.val('horse.ry', D.now);
    const lx = hx + Math.cos(hry) * 0.7, lz = hz - Math.sin(hry) * 0.7;
    D.path('cowboy', [[lx, lz]], 1.2); D.face('cowboy', hry, 0.3, 1.0);
    D.cam(FIX([1.9, 1.5, 0.6], [hx, 1.4, hz], { fov: 46 })); D.wait(1.5);
    D.act('cowboy', 'mount'); D.sfx('bagRustle', 0.2, 0.4);
    D.anim('cowboy.x', hx, 1.3, 0.2); D.anim('cowboy.z', hz + Math.cos(hry) * 0.02, 1.3, 0.2); D.anim('cowboy.y', 1.18, 1.3, 0.2);
    D.sound('He places one foot in the stirrup and climbs onto his horse', 2.4); D.wait(1.6);
    D.act('cowboy', 'ride'); D.set('horse.act', 'snort'); D.sfx('horseSnort', 0, 0.7);
    D.wait(1.0);
  }
  // he rides toward the darkness
  {
    D.set('horse.act', 'walk');
    const pts = [[-0.4, -8], [-0.1, -14], [0, -24]];
    D.path('horse', pts, 2.2); D.path('cowboy', pts, 2.2);
    D.sfx('hooves', 0.0, 0.7, { repeat: 6, every: 2.5 });
    D.anim('clay.glow', 1.2, 1.0);
    D.cam(FIX([0, 1.2, 1.5], [0, 1.6, -10], { pos2: [0, 1.3, 0.5], fov: 44 }));
    D.sound('The camera focuses on the cowboy’s silhouette as he rides toward the darkness. Hooves echo against the pavement', 4.0); D.wait(4.6);
    D.cam(FIX([0.9, 1.4, -5.5], [0, 1.6, -14], { fov: 36 })); D.sound('The small clay figure remains visible for one final moment, glowing faintly blue', 3.4); D.wait(3.8);
  }
  D.set('fade', 1); D.sfx('cutBlack', 0, 0.4); D.wait(1.4);

  // ===================================================================== END CARD
  D.scene('End');
  D.location('title');
  cast([]);
  D.set('fade', 1); D.anim('fade', 0, 0.8);
  D.music('theme', 0.6, 0, 0.1);
  D.set('title.theme', 0); D.set('title.k', 1); D.set('title.sub', 0); D.set('title.y', 1.4); D.set('title.jolt', 0);
  D.cam(FIX([0, 0.6, 10.5], [0, 0.4, 0], { pos2: [0, 0.5, 10.0], fov: 42 }));
  const endDur = 12;
  D.card('credits', endDur, {
    lines: [
      { text: 'END OF EPISODE 6', big: true, y: 0.56, color: '#7fd4ff' },
      { text: 'New episodes every Saturday at 8:00 AM.', bold: true, y: 0.66, color: '#ffd23f' },
      { text: 'Starring  Aaron  ·  Greg  ·  Flare  ·  Eric  ·  Leon  ·  the Soul Stealer  ·  and the Cowboy', y: 0.76 },
      { text: 'Created by Nick', y: 0.83 },
    ],
  });
  wait0(endDur - 1.6);
  D.anim('fade', 1, 1.5); wait0(1.6);
  return D.end();
}
