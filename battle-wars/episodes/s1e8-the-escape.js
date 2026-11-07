// BATTLE WARS - Season 1, Episode 8: "THE ESCAPE"
import { createDirector, readTime } from '../src/director.js';
import { behemothRig, behParams } from '../src/behemothRig.js';

export const META = {
  id: 's1e8-the-escape', title: 'Battle Wars - S1E8 - The Escape', file: 'Battle_Wars_S1E8_The_Escape', costume: 'blue2',
  behemoth: true, e6: true, e7: true, e8: true,
  extras: { aaron: ['armor'], flare: ['armor'], eric: ['armor'], leon: ['armor'], greg: ['bucketHat'], cowboy: ['mustache', 'dusty'] },
};

const P = Math.PI;
const TEAM = ['aaron', 'flare', 'eric', 'greg', 'leon'];
const PEDS = ['ped1', 'ped2', 'ped3'];
const ALL = ['aaron', 'flare', 'eric', 'barista', 'leon', 'greg', 'newark', 'cowboy', 'guard', 'guard2', 'officer', 'officer2', ...PEDS,
  'clay1', 'clay2', 'clay3', 'clay4', 'clay5', 'clay6', 'clay7', 'clay8', 'water', 'soul', 'dog', 'birddog', 'tiger', 'beh', 'ufo', 'horse', 'cat', 'bird', 'pigeon1', 'pigeon2', 'pigeon3', 'pigeon4'];

export function buildEpisode() {
  const D = createDirector();
  // a little more reading time per caption (viewers are 9-14 and read the captions)
  const say0 = D.say;
  D.say = (who, text, opts = {}) => say0(who, text, { ...opts, dur: (opts.dur ?? readTime(text)) * 1.3, gap: opts.gap ?? 0.42 });
  // slightly longer holds on every shot, so the action has room to breathe
  const HOLD = 1.2, wait0 = D.wait, sound0 = D.sound;
  D.wait = (d) => wait0(d * HOLD);
  D.sound = (text, dur = 1.6, dt = 0) => sound0(text, dur * HOLD, dt);
  const F = (on, yaw, dist, h = 0.15, x = {}) => ({ type: 'frame', on: Array.isArray(on) ? on : [on], yaw, dist, h, ...x });
  const R = (on, yaw, dist, h = 0.15, x = {}) => F(on, yaw, dist, h, { rel: Array.isArray(on) ? on[0] : on, ...x });
  const FIX = (pos, look, x = {}) => ({ type: 'fixed', pos, look, ...x });
  const cast = (list) => {
    for (const c of ALL) { if (!list.includes(c)) D.hide(c); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); D.set(`${c}.propR`, 'none'); D.set(`${c}.propL`, 'none'); }
    D.set('greg.bucket', 0); D.set('greg.stretch', 0); D.set('horse.alpha', 1); D.set('cowboy.alpha', 1); D.set('cowboy.y', 0);
  };
  const props = (c, r = 'none', l = 'none') => { D.set(`${c}.propR`, r); D.set(`${c}.propL`, l); };
  const pos = (c, dt = 0) => [D.val(`${c}.x`, D.now + dt), D.val(`${c}.z`, D.now + dt)];
  const rigAt = (dt = 0) => behemothRig(behParams(D.val, D.now + dt));
  const roar = (dur = 2.2, text = 'RRRRRRAAAAAAAAHHHH!', opts = {}) => {
    D.anim('beh.jaw', 1, 0.3); D.anim('beh.nod', (opts.nod ?? -0.35), 0.4);
    D.sfx('monsterRoar', 0, opts.vol ?? 1); D.shake(opts.shake ?? 0.8, dur);
    D.say('behemoth', text, { dur, cam: opts.cam });
    D.anim('beh.jaw', 0, 0.4); D.anim('beh.nod', opts.after ?? 0, 0.5);
  };
  const everyone = (fn) => { for (const c of TEAM) fn(c); };
  const walkPed = (c, from, to, speed, dt = 0) => { D.hide(c); D.place(c, from[0], from[1], Math.atan2(to[0] - from[0], to[1] - from[1]), dt); D.act(c, 'idle', dt); D.path(c, [to], speed, dt); };

  for (const c of ALL) { D.hide(c); D.act(c, 'idle'); D.expr(c, 'neutral'); D.set(`${c}.y`, 0); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); D.set(`${c}.roll`, 0); props(c); }
  cast([]);
  D.set('fade', 1); D.set('cowboy.reveal', 0); D.set('cowboy.hatTilt', 0); D.set('cowboy.scuff', 0);
  D.set('mart.door', 0); D.set('spill.vis', 1); D.set('mart.sprayTaken', 0); D.set('mart.mopTaken', 0); D.set('mart.bucketTaken', 0); D.set('mart.beep', 0);
  D.set('cell.open', 0); D.set('prison.flicker', 0); D.set('prison.alarm', 0); D.set('prison.exit', 0); D.set('prisonExt.door', 0);
  D.set('wh.purple', 0); D.set('wh.loot', 1); D.set('whExt.purple', 0); D.set('police.lights', 0); D.set('pcar0.vis', 0); D.set('pcar1.vis', 0);
  D.set('beh.s', 10); D.set('beh.rear', 0.4); D.set('beh.plates', 1); D.set('beh.claws', 1.6); D.set('beh.eyes', 1); D.set('beh.sway', 0.3); D.set('beh.slither', 0.4);
  D.set('beh.jaw', 0); D.set('beh.nod', 0); D.set('beh.look', 0); D.set('beh.curl', 0); D.set('beh.tailLift', 0); D.set('beh.shake', 0); D.set('beh.dark', 0.35); D.set('beh.cracks', 0.35);
  D.set('beh.eyesRed', 0); D.set('beh.eyesPurple', 1); D.set('beh.aura', 0.4); D.set('beh.bolts', 0.15); D.set('beh.crest', 0); D.set('beh.blue', 0); D.set('beh.goo', 0); D.set('beh.dissolve', 0); D.set('beh.flickerBlue', 0);
  D.set('crown.mode', 'world'); D.set('crown.gone', 1);
  D.set('horse.glow', 0.3); D.set('horse.purple', 0); D.set('horse.act', 'idle');
  D.set('soul.eyes', 1); D.set('soul.palm', 0); D.set('soul.raise', 0); D.set('soul.violet', 1); D.set('soul.charge', 0); D.set('soul.y', 0);
  D.set('sky.mode', 3); D.set('night.purple', 0.5); D.set('roof.glow', 0); D.set('citizens.on', 0);
  D.set('night', 0); D.set('evening', 0); D.set('tv.off', 1); D.set('tv.fall', -1); D.set('laptop.on', 0); D.set('pizza', 0); D.set('table.held', 0);

  // ===================================================================== SCENE 1: THE CLEANING SUPPLIES
  D.scene('1. The Cleaning Supplies');
  D.location('shopSt');
  cast([...TEAM, 'ped1', 'ped2']);
  const start = { leon: [-9.4, 1.5], flare: [-9.2, 2.7], aaron: [-11.2, 1.4], eric: [-11.4, 2.5], greg: [-11.6, 3.5] };
  const stop = { leon: [-4.8, 1.5], flare: [-4.4, 2.8], aaron: [-6.6, 1.3], eric: [-6.9, 2.5], greg: [-7.3, 3.5] };
  for (const c of TEAM) { D.place(c, start[c][0], start[c][1], P / 2); D.act(c, 'idle'); D.expr(c, 'neutral'); }
  D.act('leon', 'holdBox'); props('leon', 'box'); D.expr('leon', 'annoyed');
  for (const c of TEAM) D.path(c, [stop[c]], 1.25);
  walkPed('ped1', [16, 13.6], [-30, 13.4], 1.3); walkPed('ped2', [-26, 13.9], [24, 14.2], 1.2, 0.6);
  D.music('comedy', 0.38, 0, 1.0); D.sfx('birds', 0.4, 0.35);
  D.anim('fade', 0, 1.0);
  D.cam(FIX([-5.5, 2.4, 13.0], [-7.6, 1.2, 2.0], { pos2: [-4.6, 2.3, 12.6], fov: 50 }));
  D.card('location', 3.0, { text: 'AETHERFALL CITY  -  AFTERNOON' });
  D.sound('The whole team walks down the sidewalk. Leon carries an empty cardboard box', 3.4, 0.4); D.wait(4.4);
  D.cam(FIX([-11.2, 0.9, 0.7], [-9.3, 0.05, 2.5], { pos2: [-11.0, 0.95, 0.8], fov: 50 }));
  D.sound('Cleaning supplies are scattered all over the sidewalk behind them', 2.6); D.wait(2.6);
  D.face('leon', -P / 2 + 0.2, 0.5); D.face('flare', -P / 2 + 0.6, 0.5);
  D.sfx('sigh', 0.1, 0.6);
  D.cam(R('leon', 15, 2.2, 0.15)); D.sound('Leon sighs', 1.2); D.wait(1.2);
  D.say('leon', 'Just great, Eric.', { act: 'holdBox', expr: 'annoyed', dur: 1.4 });
  D.faceChar('eric', 'leon', 0.3);
  D.say('eric', "Well, man, everything just spilled! I couldn't grab them all!", { cam: R('eric', 20, 2.2, 0.15), act: 'armsOut', expr: 'worried', dur: 2.8 });
  D.act('eric', 'idle'); D.faceChar('greg', 'leon', 0.3);
  D.say('greg', "Eric couldn't do it. Isn't his fault?", { cam: R('greg', -45, 2.2, 0.15), act: 'shrug', expr: 'happy', dur: 2.0 });
  D.act('greg', 'idle');
  D.say('leon', "Greg, you're not helping.", { cam: R('leon', 15, 2.2, 0.15), expr: 'annoyed', dur: 1.5 });
  D.say('greg', "I'm just saying!", { cam: R('greg', -45, 2.0, 0.15), act: 'armsOut', expr: 'smug', dur: 1.2 });
  D.act('greg', 'idle');
  D.faceTo('aaron', 0, 0, 0.5); D.look('aaron', 0, 0, 0.2);
  D.cam(FIX([-8.8, 1.8, 0.7], [-1.0, 1.6, 0.4], { fov: 46 })); D.sound('Aaron looks toward a nearby store', 1.8); D.wait(1.8);
  D.say('aaron', "Come on. Let's just get everything we need.", { cam: R('aaron', 30, 2.2, 0.15), act: 'point', expr: 'determined', dur: 2.2 });
  D.act('aaron', 'idle');
  // Aaron, Eric and Greg walk into the store; the automatic doors slide open
  {
    D.path('aaron', [[-1.2, 1.4], [0, 0.6], [0, -1.0]], 1.5);
    D.path('eric', [[-2.0, 2.2], [0.1, 0.9], [0.1, -1.0]], 1.5, 0.4);
    D.path('greg', [[-2.6, 3.0], [-0.1, 1.3], [-0.1, -1.0]], 1.5, 0.8);
    D.anim('mart.door', 1, 0.6, 2.6); D.sfx('autoDoor', 2.6, 0.6); D.sfx('storeBell', 2.8, 0.4);
    D.face('leon', 0.4, 0.5, 1.0); D.face('flare', 0.0, 0.5, 1.0); D.act('leon', 'holdBox');
    D.cam(FIX([-6.8, 1.7, 9.0], [-1.6, 1.2, 0.6], { pos2: [-6.2, 1.7, 8.6], fov: 48 }));
    D.sound('Aaron, Eric, and Greg walk into the store. Leon and Flare stay outside', 3.4, 0.6); D.wait(5.4);
  }
  // inside the store
  D.location('mart');
  cast(['aaron', 'eric', 'greg']);
  D.set('mart.door', 1);
  D.place('aaron', 0.0, 3.2, P); D.place('eric', -0.8, 3.8, P); D.place('greg', 0.8, 3.9, P);
  for (const c of ['aaron', 'eric', 'greg']) { D.act(c, 'idle'); D.expr(c, 'neutral'); }
  D.path('aaron', [[0.2, 1.1]], 1.4); D.path('eric', [[-1.0, 1.5]], 1.4); D.path('greg', [[1.2, 1.7]], 1.4);
  D.anim('mart.door', 0, 0.6, 1.2); D.sfx('autoDoor', 1.2, 0.4);
  D.music('comedy', 0.32, 0, 0.3);
  D.cam(FIX([3.6, 2.3, -5.0], [0.0, 1.1, 1.6], { pos2: [3.3, 2.2, -4.4], fov: 50 }));
  D.sound('Inside Aether Mart', 1.6, 0.3); D.wait(2.0);
  D.faceTo('eric', 0.2, 1.1, 0.3); D.faceTo('greg', 0.2, 1.1, 0.3); D.faceTo('aaron', -0.4, 1.7, 0.4);
  D.say('aaron', 'We need to find a new mop, towels, and cleaning spray.', { cam: R('aaron', 25, 2.2, 0.15), act: 'point', dur: 2.6 });
  D.act('aaron', 'idle');
  D.say('greg', 'On it!', { cam: R('greg', 55, 2.0, 0.15), act: 'thumbsUp', expr: 'grin', dur: 0.9 });
  D.act('greg', 'idle', 0.4); D.path('greg', [[4.6, -1.2], [4.7, -6.0]], 2.2, 0.3);
  D.cam(FIX([-2.4, 1.8, 2.6], [3.8, 1.0, -3.0], { fov: 50 })); D.sound('Greg immediately walks toward the cleaning aisle', 2.0); D.wait(2.0);
  D.say('eric', "Alright, I'll get the cleaning spray.", { cam: R('eric', 15, 2.2, 0.15), dur: 1.8 });
  D.path('eric', [[-5.3, -0.8], [-5.0, -4.6]], 1.8, 0.2);
  D.say('aaron', "Just make sure you don't drop it.", { cam: R('aaron', 25, 2.2, 0.15), expr: 'smug', dur: 1.7 });
  D.stop('eric'); D.faceTo('eric', 0.2, 1.1, 0.35);
  D.say('eric', 'Bro, that happened ONE TIME!', { cam: F(['eric'], 40, 2.6, 0.15), act: 'armsOut', expr: 'annoyed', dur: 1.8 });
  D.act('eric', 'idle');
  // Aaron heads for the mops, Eric for the spray, Greg finds the buckets
  {
    const ta = D.path('aaron', [[4.4, -0.8], [5.3, -9.6]], 2.0);
    const te = D.path('eric', [[-5.0, -4.6], [-4.35, -5.0]], 1.6, 0.3);
    D.face('eric', P / 2, 0.3, 0.3 + te); D.act('eric', 'reach', 0.6 + te); D.set('mart.sprayTaken', 1, 1.2 + te); D.set('eric.propR', 'spray', 1.2 + te); D.act('eric', 'idle', 1.6 + te);
    D.cam(FIX([-6.6, 1.7, -1.0], [-4.0, 1.1, -5.2], { fov: 46 }));
    D.sound('Eric finds the cleaning spray and holds it VERY carefully', 2.4, 1.0); D.wait(3.6);
    D.path('greg', [[3.9, -9.9]], 1.4); D.face('greg', P, 0.3, 3.0);
    D.cam(F(['aaron'], 210, 3.4, 0.3, { lookY: -0.3, fov: 46 }));
    D.sound('Aaron heads for the mops', 1.6, 0.2); D.wait(Math.max(1.8, ta - 3.6));
  }
  D.face('aaron', P, 0.3);
  D.place('greg', 6.7, -6.4, P / 2); D.act('greg', 'idle'); D.look('greg', 0, 0.1, 0.4);
  D.cam(FIX([4.6, 1.7, -4.6], [7.4, 1.3, -6.8], { fov: 44 }));
  D.sound('Greg stops at the snack shelf and stares...', 2.2); D.wait(2.4);
  D.look('greg', 0, 0, 0.3); D.place('greg', 3.9, -9.9, P);
  D.say('greg', 'Anybody need a bucket?', { cam: FIX([2.5, 1.5, -11.5], [4.3, 1.3, -9.8], { fov: 44 }), expr: 'happy', dur: 1.5 });
  D.faceChar('aaron', 'greg', 0.3);
  D.say('aaron', 'Yeah, grab one!', { cam: R('aaron', -30, 2.0, 0.15), dur: 1.1 });
  // the bucket ends up on Greg's head
  D.act('greg', 'reach'); D.set('mart.bucketTaken', 1, 0.5); D.set('greg.propR', 'bucket', 0.5); D.sfx('bucketClonk', 0.5, 0.5);
  D.act('greg', 'holdHigh', 1.0); D.set('greg.propR', 'none', 1.5); D.set('greg.bucket', 1, 1.5); D.sfx('bucketClonk', 1.5, 0.9); D.act('greg', 'armsOut', 1.7);
  D.cam(FIX([4.2, 1.6, -7.6], [3.9, 1.5, -10.0], { fov: 40 }));
  D.sound('Greg picks up a bucket and accidentally puts it on his head', 2.6); D.wait(2.6);
  D.face('greg', 0.3, 0.4);
  D.say('greg', 'I FOUND ONE!', { cam: R('greg', 0, 2.0, 0.2), act: 'armsOut', expr: 'grin', dur: 1.2 });
  D.place('eric', 2.6, -6.4, 2.6); D.act('eric', 'idle'); props('eric', 'spray');
  D.say('eric', "That's a bucket, not a helmet!", { cam: FIX([5.5, 1.6, -7.0], [3.0, 1.3, -7.6], { fov: 44 }), act: 'point', expr: 'laugh', dur: 1.7 });
  D.act('eric', 'idle');
  // gathering supplies
  D.act('aaron', 'reach'); D.set('mart.mopTaken', 1, 0.5); D.set('aaron.propR', 'mop', 0.5); D.act('aaron', 'holdMop', 0.9); D.sfx('clink', 0.5, 0.4);
  D.set('greg.bucket', 0, 1.6); D.set('greg.propR', 'bucket', 1.6); D.act('greg', 'idle', 1.6); D.set('greg.propL', 'towels', 1.6);
  D.cam(FIX([3.0, 2.6, -6.4], [4.6, 0.9, -10.0], { fov: 50 }));
  D.sound('They continue gathering supplies', 2.0, 0.3); D.wait(2.6);
  D.act('eric', 'catchItem'); D.expr('eric', 'shocked'); D.sfx('whoosh', 0, 0.4); D.set('eric.propR', 'none', 0.1); D.set('eric.propR', 'spray', 0.7);
  D.cam(R('eric', 20, 2.2, 0.15, { fov: 42 }));
  D.sound('Eric fumbles the spray bottle... and catches it just in time', 2.2); D.wait(2.3);
  D.act('eric', 'idle'); D.expr('eric', 'smug');
  D.sound('He looks around to make sure nobody saw', 1.6); D.wait(1.6);
  D.anim('fade', 1, 0.4); D.wait(0.5);

  // ===================================================================== SCENE 2: A PARTY IDEA
  D.scene('2. A Party Idea');
  D.location('shopSt');
  cast(['leon', 'flare', 'ped1', 'ped2', 'ped3']);
  D.set('mart.door', 0);
  D.place('leon', -4.3, 1.7, 0.2); D.act('leon', 'holdBox'); D.expr('leon', 'neutral'); props('leon', 'box');
  D.place('flare', -3.1, 2.1, -0.2); D.act('flare', 'idle'); D.expr('flare', 'neutral');
  walkPed('ped1', [14, 3.8], [-26, 3.6], 1.25); walkPed('ped2', [-24, 13.8], [26, 14.0], 1.3, 2.0); walkPed('ped3', [-20, 3.7], [20, 3.9], 1.1, 9.0);
  D.anim('fade', 0, 0.5); D.music('chill', 0.32, 0, 0.6);
  D.cam(FIX([-3.6, 1.6, 7.4], [-3.7, 1.3, 2.0], { pos2: [-3.6, 1.6, 7.0], fov: 46 }));
  D.sound('Outside, Leon and Flare watch people walk past', 2.4, 0.3); D.wait(3.0);
  D.faceChar('leon', 'flare', 0.4);
  D.say('leon', "You know, I hope the Soul Stealer doesn't come back.", { cam: R('leon', -45, 2.1, 0.15), dur: 2.6 });
  D.faceChar('flare', 'leon', 0.4);
  D.say('flare', 'Yeah. I hope so too.', { cam: R('flare', 55, 2.0, 0.15), dur: 1.4 });
  D.say('leon', "We've already dealt with Behemoth, Fred, and everything else. We could use a break.", { cam: R('leon', -45, 2.1, 0.15), expr: 'tired', dur: 3.6 });
  D.say('flare', 'Definitely.', { cam: R('flare', 55, 2.0, 0.15), dur: 1.0 });
  // Leon looks down the street at headquarters
  D.face('leon', P / 2 - 0.05, 0.6); D.expr('leon', 'happy');
  D.cam(FIX([-5.6, 1.85, 1.1], [60, 8, 8.2], { fov: 30 }));
  D.sound('Leon looks toward the headquarters in the distance', 2.4); D.wait(2.6);
  D.say('leon', 'Actually, Flare, should we do a party in our base?', { cam: R('leon', 30, 2.0, 0.15), dur: 2.4 });
  D.faceChar('leon', 'flare', 0.4);
  D.say('flare', 'A party?', { cam: R('flare', 55, 2.0, 0.15), expr: 'surprised', dur: 1.0 });
  D.say('leon', 'Yeah. Just something to relax.', { cam: R('leon', -45, 2.1, 0.15), expr: 'happy', dur: 1.6 });
  D.say('flare', "I don't think we should. It isn't that serious.", { cam: R('flare', 55, 2.0, 0.15), act: 'shrug', expr: 'serious', dur: 2.2 });
  D.act('flare', 'thinkChin'); D.expr('flare', 'thinking'); D.look('flare', 0, -0.35, 0.8);
  D.cam(R('flare', -20, 1.8, 0.1, { fov: 36 })); D.sound('Flare pauses. He looks upward, thinking...', 2.6); D.wait(2.8);
  D.say('flare', '...Actually.', { dur: 1.1 });
  D.look('flare', 0, 0, 0.4); D.act('flare', 'idle');
  D.say('leon', 'What?', { cam: R('leon', -45, 2.1, 0.15), expr: 'surprised', dur: 0.8 });
  D.say('flare', "Maybe a little celebration wouldn't hurt.", { cam: R('flare', 55, 2.0, 0.15), expr: 'smug', dur: 2.0 });
  D.say('leon', 'Exactly!', { cam: R('leon', -45, 2.1, 0.15), act: 'cheer', expr: 'grin', dur: 1.0 });
  D.act('leon', 'holdBox');
  D.face('leon', 0.05, 0.6); D.face('flare', -0.15, 0.6); D.look('leon', 0, 0, 0.3);
  D.cam(FIX([-3.6, 1.5, 5.6], [-2.0, 1.4, 0.0], { fov: 44 })); D.sound('They both look toward the store entrance', 2.0); D.wait(2.0);
  // inside: the self checkout
  D.location('mart');
  cast(['aaron', 'eric', 'greg']);
  D.place('aaron', 4.4, 1.15, 0); D.act('aaron', 'holdMop'); props('aaron', 'mop'); D.expr('aaron', 'happy');
  D.place('eric', 3.4, 0.4, 0.5); D.act('eric', 'idle'); props('eric', 'spray', 'towels'); D.expr('eric', 'happy');
  D.place('greg', 5.6, 0.3, -0.3); D.act('greg', 'idle'); props('greg', 'bucket'); D.expr('greg', 'happy');
  D.sfx('scanBeep', 0.4, 0.5); D.sfx('scanBeep', 1.1, 0.5); D.sfx('register', 1.9, 0.5);
  D.set('mart.beep', 1, 0.4); D.set('mart.beep', 0, 0.6); D.set('mart.beep', 1, 1.1); D.set('mart.beep', 0, 1.3);
  D.cam(FIX([3.0, 2.0, 3.4], [4.6, 1.1, 0.6], { fov: 48 }));
  D.sound('Inside, Aaron, Greg, and Eric are finally finished shopping', 2.8, 0.2); D.wait(3.2);
  D.anim('fade', 1, 0.3); D.wait(0.35);

  // ===================================================================== SCENE 3: THE FROZEN FLARE
  D.scene('3. The Frozen Flare');
  D.location('shopSt');
  cast([...TEAM]);
  D.place('leon', -4.3, 1.7, 0.6); D.act('leon', 'holdBox'); D.expr('leon', 'neutral'); props('leon', 'box');
  D.place('flare', -3.0, 2.2, P / 2 + 0.25); D.act('flare', 'frozenStare'); D.expr('flare', 'thinking');
  D.place('aaron', 0.0, -0.6, 0); D.act('aaron', 'holdMop'); props('aaron', 'mop'); D.expr('aaron', 'happy');
  D.place('eric', 0.1, -1.4, 0); D.act('eric', 'idle'); props('eric', 'spray', 'towels');
  D.place('greg', -0.1, -2.2, 0); D.act('greg', 'idle'); props('greg', 'bucket');
  D.set('mart.door', 1);
  D.path('aaron', [[-1.4, 1.6]], 1.4); D.path('eric', [[-0.6, 2.6]], 1.4, 0.4); D.path('greg', [[-1.2, 3.4]], 1.4, 0.8);
  D.anim('mart.door', 0, 0.6, 2.4);
  D.anim('fade', 0, 0.3); D.sfx('autoDoor', 0, 0.5); D.music('none', 0, 0, 0.6);
  D.cam(FIX([-1.2, 1.7, 7.6], [-1.6, 1.2, 1.2], { fov: 46 })); D.wait(1.6);
  D.say('aaron', 'Alright, I got the suppli—', { cam: R('aaron', 20, 2.2, 0.15), dur: 1.4 });
  D.stop('aaron'); D.faceChar('aaron', 'flare', 0.3); D.expr('aaron', 'surprised');
  D.cam(FIX([-1.8, 1.65, 4.4], [-3.0, 1.55, 2.2], { fov: 40 })); D.sound('He notices Flare standing completely still, staring into the distance', 3.0); D.wait(3.0);
  D.say('aaron', '...What are you doing?', { cam: R('aaron', 20, 2.2, 0.15), dur: 1.4 });
  D.cam(F(['flare'], 120, 2.0, 0.1, { fov: 38 })); D.sound("Flare doesn't respond", 1.6); D.wait(1.6);
  D.faceChar('eric', 'flare', 0.3); D.faceChar('greg', 'flare', 0.3);
  D.say('eric', 'Is he okay?', { cam: R('eric', 20, 2.2, 0.15), expr: 'worried', dur: 1.0 });
  D.say('greg', "I think he's thinking again.", { cam: R('greg', 15, 2.2, 0.15), expr: 'neutral', dur: 1.5 });
  D.say('leon', "He's been doing that for a minute.", { cam: R('leon', -45, 2.2, 0.15), act: 'holdBox', expr: 'tired', dur: 1.7 });
  D.say('aaron', 'Flare?', { cam: R('aaron', 20, 2.2, 0.15), dur: 0.9 });
  // the slow zoom toward Flare's face
  D.cam(FIX([-0.4, 1.62, 3.4], [-3.0, 1.62, 2.2], { pos2: [-2.1, 1.62, 2.6], fov: 34, ease: 'linear' }));
  D.sound('Flare remains frozen. The camera slowly zooms toward his face', 3.0); D.wait(3.4);
  D.say('greg', 'Should we leave him here?', { cam: R('greg', 15, 2.2, 0.15), expr: 'happy', dur: 1.4 });
  // WAIT!
  D.act('flare', 'idea'); D.expr('flare', 'grin'); D.shake(0.2, 0.4);
  for (const c of ['aaron', 'eric', 'greg', 'leon']) { D.act(c, 'jumpScare'); D.expr(c, 'shocked'); }
  D.sfx('whoosh', 0, 0.5); D.comic('WAIT!', 0, 0.9, { x: 0.5, y: 0.32, size: 110, rot: -5, c1: '#fff6a0', c2: '#ff7a45' });
  D.say('flare', 'WAIT!', { cam: R('flare', -30, 2.4, 0.15), dur: 0.9 });
  D.say('flare', 'I HAVE AN IDEA!', { dur: 1.3 });
  for (const c of ['aaron', 'greg']) { D.act(c, c === 'aaron' ? 'holdMop' : 'idle'); D.expr(c, 'surprised'); }
  D.act('leon', 'holdBox');
  D.say('eric', 'Here we go.', { cam: R('eric', 20, 2.0, 0.15), act: 'facepalm', expr: 'tired', dur: 1.2 });
  // title sequence
  D.location('title');
  cast([]);
  D.set('fade', 0);
  D.music('theme', 0.55, 0, 0.1);
  D.set('title.theme', 0); D.set('title.subText', 'THE ESCAPE'); D.set('title.sub', 0); D.set('title.y', 0.3); D.set('title.subY', -1.1); D.set('title.k', 3.6);
  D.cam(FIX([0, 0.2, 10.5], [0, -0.1, 0], { pos2: [0, 0.15, 9.8], fov: 42 }));
  D.anim('title.k', 1, 0.22, 0.2, 'in'); D.sfx('titleHit', 0.4, 0.9);
  D.anim('title.sub', 1, 0.45, 1.3, 'back'); D.sfx('alarmKlaxon', 1.3, 0.25);
  D.wait(4.4);
  D.anim('fade', 1, 0.5); D.wait(0.6);

  // ===================================================================== SCENE 4: THE PRISON BREAK
  D.scene('4. The Prison Break');
  D.location('prisonExt');
  cast([]);
  D.music('mystery', 0.34, 0, 0.8); D.set('title.theme', 0);
  D.anim('fade', 0, 1.0); D.sfx('wind', 0.2, 0.4);
  D.cam(FIX([16, 3.2, 30], [-2, 5, 0], { pos2: [14, 3.0, 27], fov: 50 }));
  D.card('location', 3.0, { text: 'AETHERFALL CITY PRISON  -  NIGHT' });
  D.sound('The city prison at night. A searchlight sweeps the yard', 2.8, 0.6); D.wait(4.2);
  D.location('prison');
  cast(['cowboy', 'guard', 'guard2']);
  D.place('cowboy', 0, -2.42, 0); D.set('cowboy.y', -0.1); D.act('cowboy', 'sitCar'); D.expr('cowboy', 'neutral'); D.set('cowboy.reveal', 0); D.set('cowboy.scuff', 0); D.set('cowboy.hatTilt', 0);
  D.place('guard', 9.0, 1.9, -1.6); D.act('guard', 'idle'); D.expr('guard', 'neutral');
  D.place('guard2', 10.0, 1.3, -1.9); D.act('guard2', 'crossArms'); D.expr('guard2', 'neutral');
  D.cam(FIX([1.6, 1.5, 2.8], [0, 0.9, -2.2], { pos2: [1.3, 1.45, 2.4], fov: 46 }));
  D.sound('Inside a prison cell, Fred Yeehaw sits silently on a bench', 3.0, 0.3); D.wait(3.8);
  D.look('cowboy', 0.95, -0.55, 1.2);
  D.cam(FIX([-1.1, 1.3, -0.6], [0.2, 2.1, -2.9], { fov: 46 }));
  D.sound('He looks toward the small window', 2.0); D.wait(2.6);
  D.look('cowboy', 0, 0, 0.8);
  D.cam(FIX([0.5, 1.25, -0.4], [0, 1.15, -2.4], { pos2: [0.2, 1.2, -1.3], fov: 36, ease: 'linear' }));
  D.sound('The camera moves toward his face', 2.0); D.wait(2.8);
  // the lights flicker, the door opens
  D.set('prison.flicker', 1); D.sfx('bzzt', 0, 0.9); D.sfx('bzzt', 0.9, 0.7);
  D.comic('BZZZT!', 0.1, 1.0, { x: 0.5, y: 0.3, size: 96, rot: 4, c1: '#ffffff', c2: '#ffe066' });
  D.cam(FIX([3.2, 2.4, 2.6], [-1.0, 1.4, -1.0], { fov: 54 }));
  D.sound('Suddenly, the prison lights flicker', 2.0); D.wait(2.0);
  D.anim('cell.open', 1, 1.3); D.sfx('cellSlide', 0, 0.8); D.set('prison.flicker', 0, 1.6);
  D.cam(FIX([-1.8, 1.3, 1.6], [0.8, 1.1, -0.6], { fov: 48 }));
  D.sound('The cell door opens', 1.8); D.wait(2.2);
  D.act('cowboy', 'standUp'); D.anim('cowboy.y', 0, 1.2);
  D.cam(FIX([1.4, 1.2, 0.9], [0, 1.1, -2.2], { fov: 46 }));
  D.sound('Fred slowly stands up', 1.8); D.wait(2.2);
  D.act('cowboy', 'idle');
  {
    const t1 = D.path('cowboy', [[0, 0.9], [2.4, 1.0]], 1.2);
    D.cam(FIX([-4.2, 1.6, 2.6], [1.0, 1.2, 0.5], { fov: 46 }));
    D.sound('He walks into the hallway', 1.8, 0.4); D.wait(t1);
  }
  D.faceChar('guard', 'cowboy', 0.3); D.faceChar('guard2', 'cowboy', 0.3); D.act('guard2', 'idle'); D.expr('guard', 'surprised'); D.expr('guard2', 'surprised');
  D.cam(FIX([2.0, 1.7, 2.2], [9.4, 1.4, 1.6], { fov: 40 })); D.sound('Two guards notice him', 1.6); D.wait(1.6);
  D.say('guard', "Hey! You're not supposed to be out!", { label: 'GUARD 1', cam: R('guard', 15, 2.3, 0.15), act: 'point', expr: 'angry', dur: 2.0 });
  D.act('guard', 'idle');
  D.look('cowboy', 0.2, 0, 0.4);
  D.cam(R('cowboy', 25, 2.2, 0.0, { fov: 38 })); D.sound('Fred looks at them', 1.4); D.wait(1.6);
  {
    const t0 = D.now;
    const t2 = D.path('cowboy', [[8.0, 0.6], [12.5, 0.7], [15.2, 1.7], [17.0, 1.7]], 2.6);
    D.look('cowboy', 0, 0, 0.3);
    D.faceTo('guard', 12, 0.7, 0.6, 1.6); D.faceTo('guard2', 12, 0.7, 0.6, 1.4);
    D.anim('prison.exit', 1, 0.6, t2 - 1.4); D.sfx('doorOpen', t2 - 1.4, 0.4);
    D.cam(FIX([6.4, 1.5, 3.0], [9.6, 1.2, 0.8], { fov: 54 }));
    D.sound('He quickly walks past them', 1.8, 0.2); D.wait(2.4);
    D.say('guard2', 'GET BACK HERE!', { cam: R('guard2', 10, 2.2, 0.15), act: 'point', expr: 'angry', dur: 1.3 });
    D.set('prison.alarm', 1); D.sfx('prisonAlarm', 0, 0.8); D.sfx('prisonAlarm', 3.1, 0.7);
    D.comic('WEE-OO! WEE-OO!', 0.1, 1.6, { x: 0.5, y: 0.25, size: 80, rot: -3, c1: '#ffffff', c2: '#ff3a3a' });
    D.path('guard', [[13.0, 1.6]], 3.2, 0.3); D.path('guard2', [[13.6, 1.0]], 3.4, 0.5);
    D.cam(FIX([9.0, 1.7, 2.7], [15.6, 1.4, 1.5], { fov: 46 }));
    D.sound('An alarm begins sounding. Fred reaches an exit and escapes into the night', 2.6);
    D.wait(Math.max(2.6, t0 + t2 + 0.4 - D.now));
  }
  // outside the prison
  D.location('prisonExt');
  cast(['cowboy']);
  D.set('prison.alarm', 0);
  D.place('cowboy', 0, -0.8, 0); D.act('cowboy', 'idle'); D.set('prisonExt.door', 1);
  D.sfx('siren', 0, 0.25);
  D.path('cowboy', [[0, 3.4]], 1.3);
  D.cam(FIX([3.6, 1.4, 7.4], [0, 1.6, 0.6], { fov: 46 }));
  D.sound('Fred walks into the open air', 2.0, 0.3); D.wait(3.2);
  D.act('cowboy', 'crouchHide'); D.sfx('whoosh', 0, 0.3);
  D.cam(FIX([-7, 6, 12], [0, 0.8, 3.4], { fov: 46 }));
  D.sound('The searchlight sweeps past. He keeps low', 2.0); D.wait(2.2);
  D.act('cowboy', 'idle');
  D.look('cowboy', 0, -0.12, 0.6);
  D.cam(FIX([-0.8, 1.9, 1.4], [3, 3, 80], { fov: 44 }));
  D.sound('He looks toward the city', 1.8); D.wait(2.2);
  D.act('cowboy', 'tipHat'); D.look('cowboy', 0, 0, 0.5);
  D.cam(F(['cowboy'], 20, 2.0, 0.05, { lookY: -0.08, fov: 38 }));
  D.sound('He slowly adjusts his cowboy hat', 2.0); D.wait(2.2);
  D.act('cowboy', 'idle');
  D.path('cowboy', [[0.2, 14], [1.2, 24]], 1.3);
  D.cam(FIX([-5.0, 2.2, 1.6], [0.5, 1.2, 12], { fov: 46 }));
  D.sound('He begins walking', 1.6, 0.2); D.wait(3.0);
  D.set('fade', 1); D.sfx('cutBlack', 0, 0.4); D.wait(0.9);

  // ===================================================================== SCENE 5: THE SOUL STEALER'S PLAN
  D.scene("5. The Soul Stealer's Plan");
  D.location('whExt');
  cast(['cowboy']);
  D.set('whExt.purple', 0); D.set('police.lights', 0); D.set('pcar0.vis', 0); D.set('pcar1.vis', 0);
  D.place('cowboy', 3.2, 22, P); D.act('cowboy', 'idle');
  D.music('ominous', 0.36, 0, 0.8); D.sfx('wind', 0.3, 0.5);
  D.anim('fade', 0, 0.8);
  D.path('cowboy', [[5.2, 12], [7.8, 7.0]], 1.3);
  D.cam(FIX([-2.5, 1.7, 13.0], [4.2, 1.3, 18.5], { look2: [4.6, 1.3, 15.5], fov: 50 }));
  D.card('location', 3.0, { text: 'ABANDONED INDUSTRIAL AREA  -  NIGHT' });
  D.sound('Fred arrives at an abandoned industrial area', 2.6, 0.4); D.wait(4.4);
  D.faceTo('cowboy', 11.5, 4.5, 0.5); D.look('cowboy', 0.5, 0, 0.6); D.look('cowboy', -0.6, 0, 0.8, 1.2); D.look('cowboy', 0, 0, 0.5, 2.4);
  D.cam(FIX([10.4, 1.7, 9.2], [8.0, 1.4, 6.6], { fov: 42 }));
  D.sound('He looks around, searching for his horse. The horse trailer is empty', 3.0); D.wait(3.2);
  D.anim('whExt.purple', 1, 1.6); D.sfx('crystalHum', 0.2, 0.5);
  D.faceTo('cowboy', 0, 0, 0.6, 0.4);
  D.cam(FIX([9.6, 1.2, 10.4], [0, 2.2, 0], { fov: 46 }));
  D.sound('He notices strange purple lights coming from inside a large building', 3.0); D.wait(3.2);
  D.anim('fade', 1, 0.3); D.wait(0.35);
  // inside: the Soul Stealer and Fred's horse
  D.location('warehouse');
  cast(['cowboy', 'soul', 'horse', 'beh']);
  D.set('wh.purple', 1); D.set('wh.loot', 0); D.set('wh.heat', 0);
  D.place('soul', -0.6, -4.2, P); D.set('soul.y', 0); D.set('soul.eyes', 1); D.set('soul.violet', 1); D.set('soul.raise', 0); D.set('soul.palm', 0);
  D.place('horse', 1.6, -4.8, P - 0.3); D.set('horse.alpha', 1); D.set('horse.purple', 1); D.set('horse.glow', 1.3); D.set('horse.act', 'idle');
  D.place('cowboy', 0.6, 9.4, P); D.act('cowboy', 'idle');
  D.hide('beh'); D.set('beh.s', 5.5); D.set('beh.dissolve', 1);
  D.fx('bodyAura', { who: 'horse', dur: 44, color: 0xa040ff, power: 0.9 });
  D.anim('fade', 0, 0.3);
  D.cam(FIX([1.4, 2.1, 10.6], [0.4, 1.5, -4.6], { fov: 42 }));
  D.sound('Inside, the Soul Stealer stands in the middle of the room. Beside him is Fred’s horse, surrounded by purple energy', 4.2, 0.2); D.wait(4.6);
  D.path('cowboy', [[0.6, 5.6]], 1.0); D.expr('cowboy', 'neutral');
  D.cam(FIX([-2.6, 1.6, 8.2], [0.8, 1.4, 4.6], { fov: 44 }));
  D.sound('Fred recognizes his horse and slowly steps forward', 2.6); D.wait(3.2);
  D.face('soul', 0.1, 1.2);
  D.cam(F(['soul'], 20, 3.6, 0.2, { lookY: -0.3, fov: 40 })); D.sound('The Soul Stealer turns his head', 1.6); D.wait(1.6);
  D.say('soul', 'Well, well. Look who’s escaped.', { cam: F(['soul'], 15, 3.0, 0.1, { lookY: -0.25, fov: 40 }), dur: 2.0 });
  D.cam(F(['cowboy'], 200, 2.4, 0.0, { lookY: -0.1, fov: 38 })); D.sound('Fred remains silent', 1.6); D.wait(1.8);
  D.say('soul', 'Looking for your horse?', { cam: F(['soul'], 15, 3.0, 0.1, { lookY: -0.25, fov: 40 }), dur: 1.6 });
  D.path('soul', [[0.6, -4.5]], 0.8); D.face('soul', 0.5, 0.6, 1.4);
  D.anim('soul.raise', 0.35, 0.8, 1.4);
  D.cam(FIX([3.6, 1.8, -0.8], [1.0, 1.5, -4.6], { fov: 44 })); D.sound('The Soul Stealer places a hand on the horse', 2.2, 0.6); D.wait(2.6);
  D.say('soul', 'Unfortunately, it belongs to me now.', { dur: 2.0 });
  D.look('cowboy', 0.2, 0.05, 0.6);
  D.cam(F(['cowboy'], 210, 2.2, 0.0, { lookY: -0.1, fov: 38 })); D.sound('Fred looks toward his horse', 1.6); D.wait(1.8);
  D.set('horse.act', 'snort'); D.sfx('horseSnort', 0, 0.5); D.look('cowboy', 0, 0, 0.5);
  D.cam(F(['horse'], 150, 2.6, 0.0, { lookY: -0.3, fov: 40 })); D.sound('The horse makes a quiet sound', 1.6); D.wait(1.8);
  D.set('horse.act', 'idle'); D.anim('soul.raise', 0, 0.6);
  D.say('soul', 'You see, your little abilities are quite interesting. But I have bigger plans.', { cam: F(['soul'], 25, 3.4, 0.1, { lookY: -0.25, fov: 40 }), dur: 3.6 });
  // the portal and Behemoth
  {
    D.anim('soul.raise', 1, 0.6); D.anim('soul.palm', 1, 0.6); D.sfx('portalOpen', 0.3, 0.9);
    D.fx('portal', { x: -4.0, y: 3.2, z: -9.6, ry: 0.25, radius: 3.2, dur: 9.0, color: 0xa040ff }, 0.4);
    D.cam(FIX([3.6, 2.4, 3.6], [-3.0, 2.6, -8.0], { fov: 54 }));
    D.sound('The Soul Stealer raises his hand. A purple portal opens', 2.6, 0.3); D.wait(2.8);
    D.fx('bolt', { x: -2.0, y: 0.1, z: -7.0, top: 6.5, dur: 0.3, size: 0.4, color: 0xc070ff }, 0.2); D.fx('bolt', { x: -7.6, y: 0.1, z: -6.2, top: 6.0, dur: 0.3, size: 0.4, color: 0xc070ff }, 0.9);
    D.sfx('electricSlam', 0.2, 0.5); D.sfx('electricSlam', 0.9, 0.4); D.shake(0.3, 1.2);
    D.cam(F(['soul'], 160, 4.6, 0.4, { lookY: 0.4, fov: 50 }));
    D.sound('Purple lightning crackles around the portal', 2.0); D.wait(2.2);
    D.show('beh'); D.place('beh', -4.8, -13.5, 0.25); D.set('beh.y', 0); D.set('beh.rear', 0.55); D.set('beh.nod', 0.1); D.set('beh.look', 0);
    D.anim('beh.dissolve', 0, 2.2); D.anim('beh.x', -3.6, 3.0, 0, 'out'); D.anim('beh.z', -8.4, 3.0, 0, 'out'); D.sfx('rumbleDeep', 0, 0.7); D.sfx('metalGrow', 0.6, 0.5);
    D.cam(FIX([2.8, 1.6, 2.2], [-3.4, 3.2, -8.4], { fov: 52 }));
    D.sound("Behemoth emerges from the portal. Its metallic armor glows with purple energy", 3.4); D.wait(3.6);
  }
  D.say('soul', 'Behemoth.', { cam: F(['soul'], 25, 3.4, 0.2, { lookY: -0.2, fov: 42 }), dur: 1.2 });
  D.anim('soul.raise', 0.2, 0.6); D.anim('soul.palm', 0, 0.6);
  D.anim('beh.nod', 0.55, 1.0); D.anim('beh.rear', 0.35, 1.0);
  D.cam(FIX([1.6, 2.2, -2.4], [-3.4, 2.4, -7.6], { fov: 48 })); D.sound('Behemoth lowers its head', 1.6); D.wait(1.8);
  D.say('soul', "It's time to collect some power.", { cam: F(['soul'], 25, 3.2, 0.1, { lookY: -0.25, fov: 40 }), dur: 1.8 });
  D.face('soul', -0.4, 1.0);
  D.cam(FIX([-1.2, 1.9, 0.6], [0.8, 2.0, -4.6], { fov: 42 })); D.sound('He looks toward the city', 1.4); D.wait(1.6);
  D.say('soul', 'Find them.', { dur: 1.2 });
  D.anim('beh.nod', 0, 0.4); D.anim('beh.rear', 0.6, 0.6);
  roar(2.4, 'RRRRRRAAAAAAAAHHHH!', { cam: FIX([0.6, 1.2, 1.8], [-3.6, 3.6, -8.0], { fov: 54 }), shake: 0.8 });
  D.anim('horse.glow', 3.0, 0.8); D.fx('flashBurst', { x: 1.6, y: 1.4, z: -4.8, dur: 0.8, radius: 1.6, color: 0xa040ff, light: 40 }); D.sfx('crystalPower', 0, 0.6);
  D.cam(F(['horse'], 160, 3.0, 0.1, { lookY: -0.3, fov: 42 })); D.sound("The Soul Stealer's horse glows", 1.8); D.wait(2.0);
  D.expr('cowboy', 'shocked'); D.path('cowboy', [[0.6, 7.2]], 0.7); D.act('cowboy', 'gasp');
  D.cam(F(['cowboy'], 195, 2.6, 0.0, { lookY: -0.1, fov: 40 })); D.sound('Fred realizes what is happening. He slowly steps backward', 2.8); D.wait(2.8);
  D.anim('beh.look', -0.55, 1.2); D.anim('beh.headYaw', -0.2, 1.2);
  D.cam(FIX([-1.2, 1.4, 9.6], [-3.0, 3.0, -7.0], { fov: 46 })); D.sound('Behemoth turns toward him', 1.8); D.wait(2.0);
  D.set('fade', 1); D.sfx('cutBlack', 0, 0.4); D.wait(0.9);
  D.anim('beh.headYaw', 0, 0.1);

  // ===================================================================== SCENE 6: THE CITY ATTACK
  D.scene('6. The City Attack');
  D.location('living');
  cast([...TEAM]);
  D.set('night', 1); D.set('evening', 0); D.set('steelTable', 0); D.set('halloween', 0); D.set('kitchen', 0); D.set('pizza', 0); D.set('tv.off', 1); D.set('laptop.on', 0);
  D.place('greg', 1.6, -1.6, -0.9); D.act('greg', 'holdMop'); props('greg', 'mop'); D.expr('greg', 'neutral');
  D.place('eric', -1.9, -1.0, 0.8); D.act('eric', 'idle'); props('eric', 'spray'); D.expr('eric', 'neutral');
  D.place('aaron', -0.4, -2.2, 0.1); D.act('aaron', 'idle'); props('aaron', 'none', 'towels'); D.expr('aaron', 'neutral');
  D.place('flare', 0.55, 0.62, P); D.act('flare', 'sitRead'); props('flare', 'none', 'paper'); D.expr('flare', 'happy');
  D.place('leon', 2.8, 0.1, -2.0); D.act('leon', 'crossArms'); D.expr('leon', 'neutral');
  D.music('hq', 0.3, 0, 0.6);
  D.anim('fade', 0, 0.6);
  D.cam(FIX([0.2, 2.5, -3.9], [0, 0.9, -0.4], { pos2: [0.2, 2.3, -3.6], fov: 56 }));
  D.card('location', 3.0, { text: 'BATTLE WARS HQ  -  THAT NIGHT' });
  D.sound('Back at headquarters, the team organizes the cleaning supplies', 3.0, 0.3); D.wait(3.6);
  D.say('greg', 'So are we actually cleaning today?', { cam: R('greg', 10, 2.2, 0.15), dur: 1.7 });
  D.faceChar('eric', 'greg', 0.3);
  D.say('eric', "That's literally why we went to the store.", { cam: R('eric', 15, 2.2, 0.15), act: 'armsOut', expr: 'annoyed', dur: 2.0 });
  D.act('eric', 'idle');
  D.say('greg', 'I thought we were getting snacks too.', { cam: R('greg', 10, 2.2, 0.15), expr: 'happy', dur: 1.8 });
  D.faceChar('aaron', 'greg', 0.3);
  D.say('aaron', 'Greg!', { cam: R('aaron', 20, 2.0, 0.15), act: 'facepalm', expr: 'annoyed', dur: 0.9 });
  D.act('aaron', 'idle');
  D.say('greg', 'What?', { cam: R('greg', 10, 2.0, 0.15), act: 'shrug', expr: 'surprised', dur: 0.9 });
  D.act('greg', 'holdMop');
  D.say('flare', 'So about that party idea...', { cam: R('flare', -15, 2.0, 0.15), expr: 'smug', dur: 1.6 });
  D.say('leon', 'We can discuss it later.', { cam: R('leon', 15, 2.2, 0.15), expr: 'smug', dur: 1.4 });
  // KABOOM
  D.shake(1.0, 1.4); D.sfx('bigBlast', 0, 0.8); D.sfx('rumbleDeep', 0.2, 0.7); D.set('flashWhite', 0.25); D.anim('flashWhite', 0, 0.4);
  D.comic('KABOOOOOM!', 0, 1.2, { x: 0.5, y: 0.32, size: 120, rot: -4, c1: '#ffffff', c2: '#ff7a45' });
  everyone((c) => D.expr(c, 'shocked'));
  D.act('flare', 'sitRelax'); D.act('greg', 'gasp'); D.act('eric', 'gasp'); D.act('leon', 'idle'); D.act('aaron', 'idle');
  D.cam(FIX([0.2, 2.5, -3.9], [0, 0.9, -0.4], { fov: 56 }));
  D.sound('A loud crash echoes from outside. Everyone stops', 2.4); D.wait(2.4);
  D.say('aaron', 'What was that?', { cam: R('aaron', 20, 2.2, 0.15), dur: 1.1 });
  D.say('eric', "That definitely wasn't a cleaning accident.", { cam: R('eric', 15, 2.2, 0.15), expr: 'worried', dur: 2.0 });
  D.shake(0.9, 1.2); D.sfx('boom', 0, 0.8); D.sfx('rumble', 0.1, 0.6);
  D.cam(FIX([2.6, 1.8, -3.4], [-0.6, 1.0, 0.0], { fov: 54 })); D.sound('Another explosion shakes the building', 2.0); D.wait(2.0);
  D.act('flare', 'idle'); D.set('flare.propL', 'none'); D.anim('flare.z', 0.2, 0.4);
  D.say('leon', 'Everybody outside! NOW!', { cam: R('leon', 15, 2.2, 0.15), act: 'point', expr: 'angry', dur: 1.4 });
  for (const c of TEAM) { D.act(c, 'idle'); D.set(`${c}.propR`, 'none'); D.set(`${c}.propL`, 'none'); D.path(c, [[-4.6, 0.6], [-6.6, 0.9]], 4.5, 0.15 * TEAM.indexOf(c)); }
  D.sfx('doorBang', 0.6, 0.5);
  D.cam(FIX([1.0, 1.9, -2.6], [-4.6, 1.2, 0.6], { fov: 52 })); D.wait(1.6);
  // they run out of HQ
  D.location('hqExt');
  cast([...TEAM]);
  D.set('night', 1); D.set('hq.doors', 0); D.set('hq.clear', 0); D.set('hq.skyline', 1); D.set('hq.balcony', 0); D.set('hcar.vis', 0);
  D.anim('hq.doors', 1, 0.4);
  TEAM.forEach((c, i) => { D.place(c, (i - 2) * 0.5, -3.6, 0); D.act(c, 'idle'); D.expr(c, 'determined'); D.path(c, [[(i - 2) * 1.6, 2.0 + (i % 2) * 0.6]], 5.0, 0.2 + i * 0.15); });
  D.music('action', 0.4, 0, 0.4);
  D.cam(FIX([7.0, 1.6, 8.0], [0, 1.6, -2.0], { fov: 50 }));
  D.sound('The team rushes outside', 1.6, 0.2); D.wait(2.0);
  everyone((c) => { D.face(c, -0.9, 0.5); D.look(c, 0, -0.2, 0.5); });
  D.fx('flashBurst', { x: -6, y: 60, z: -80, dur: 1.2, radius: 24, size: 9, color: 0xa040ff, light: 0 }, 0.3); D.fx('flashBurst', { x: 16, y: 50, z: -90, dur: 1.0, radius: 18, size: 7, color: 0xa040ff, light: 0 }, 1.4);
  D.sfx('boom', 0.3, 0.4); D.sfx('boom', 1.4, 0.3); D.shake(0.3, 0.8, 0.3);
  D.fx('pillar', { x: -14, y: 0, z: -40, dur: 3.6, height: 70, radius: 2.5, size: 2.6, color: 0xa040ff }, 0.1); D.fx('pillar', { x: 22, y: 0, z: -48, dur: 3.0, height: 60, radius: 2.0, size: 2.2, color: 0xc060ff }, 0.9);
  D.cam(FIX([0.5, 1.2, 15], [0, 16, -40], { fov: 60 }));
  D.sound('In the distance, something huge glows purple in the city', 2.6); D.wait(2.6);
  D.anim('fade', 1, 0.3); D.wait(0.35);
  // downtown
  D.location('downtown');
  D.sfx('stampede', 0.2, 0.3);
  cast([...TEAM, 'beh']);
  D.set('sky.mode', 3); D.set('night.purple', 0.3); D.set('lightning', 0); D.set('ufo.vis', 0); D.set('ufo.shade', 0); D.set('facade.break', 0);
  D.set('carA.vis', 1); D.set('carA.x', 37); D.set('carA.z', -2.2); D.set('carA.ry', 0.05); D.set('carA.roll', 0); D.set('carA.lift', 0);
  D.set('carB.vis', 1); D.set('carB.x', 38); D.set('carB.z', 2.3); D.set('carB.ry', P); D.set('carB.roll', 0); D.set('carB.lift', 0);
  D.set('lampA.vis', 1); D.set('lampA.x', 33); D.set('lampA.z', -4.7); D.set('lampA.ry', 0); D.set('lampA.fall', 0);
  D.set('lampB.vis', 1); D.set('lampB.x', 35); D.set('lampB.z', 4.7); D.set('lampB.ry', P); D.set('lampB.fall', 0);
  D.set('cracks', 0); D.set('mark', 0); D.set('can.vis', 0); D.set('cons.vis', 0); D.set('shards', 0); D.set('barrier.vis', 0);
  D.show('beh'); D.place('beh', 44, -0.6, -P / 2); D.set('beh.s', 10); D.set('beh.dissolve', 0); D.set('beh.rear', 0.42); D.set('beh.look', 0); D.set('beh.nod', 0); D.set('beh.y', 0);
  D.set('crown.gone', 1);
  D.anim('fade', 0, 0.3);
  // Behemoth moves through the city: cars shoved aside, a street light falls, dust
  {
    D.anim('beh.x', 33, 6.0, 0, 'linear'); D.sfx('rumbleDeep', 0, 0.6); D.sfx('stampede', 0.2, 0.5);
    D.anim('carA.x', 39, 0.7, 2.0, 'out'); D.anim('carA.z', -6.6, 0.7, 2.0, 'out'); D.anim('carA.ry', 0.9, 0.7, 2.0, 'out'); D.anim('carA.roll', 1.55, 0.6, 2.1, 'out'); D.sfx('metalCrash', 2.0, 0.8);
    D.fx('dustCloud', { x: 39, y: 0, z: -5.5, n: 40, dur: 3, radius: 3, size: 0.7 }, 2.1);
    D.anim('lampA.fall', 1, 1.0, 3.2, 'in'); D.sfx('lampCreak', 3.0, 0.6); D.sfx('metalCrash', 4.1, 0.6); D.sfx('glassShatter', 4.15, 0.5);
    D.fx('sparks', { x: 33, y: 0.3, z: -0.2, n: 50, color: 0xffd080, speed: 3 }, 4.2);
    D.anim('carB.x', 40, 0.8, 4.4, 'out'); D.anim('carB.z', 7.2, 0.8, 4.4, 'out'); D.anim('carB.ry', P + 0.8, 0.8, 4.4, 'out'); D.sfx('metalCrash', 4.4, 0.6);
    D.fx('dustCloud', { x: 40, y: 0, z: 5.5, n: 40, dur: 3, radius: 3, size: 0.7 }, 4.5);
    D.cam(FIX([20, 2.2, 8.5], [36, 5, 0], { pos2: [21, 2.4, 8.0], fov: 56 }));
    D.sound('Behemoth is moving through the city. Cars are pushed aside, streetlights fall, and dust fills the air', 4.6, 0.3);
    D.wait(6.2);
  }
  // the team arrives
  D.set('citizens.on', 1); D.set('citizens.t0', D.now - 1.0);
  TEAM.forEach((c, i) => { D.place(c, -2 + i * 1.0, 16 + (i % 2) * 0.8, P); D.act(c, 'idle'); D.expr(c, 'determined'); D.path(c, [[-2.2 + i * 1.1, 3.4 + (i % 2) * 0.7]], 4.8); });
  D.anim('beh.x', 29, 4.0, 0, 'linear');
  D.cam(FIX([-4.0, 1.4, 1.0], [0.0, 1.3, 12.0], { pos2: [-3.6, 1.4, 1.6], fov: 52 }));
  D.sound('People run past them, away from the danger. The team runs toward it', 2.3, 0.05); D.wait(2.4);
  D.cam(FIX([3.0, 1.7, -4.0], [-0.4, 1.3, 8.0], { fov: 52 }));
  D.sound('The team runs to the street', 1.8, 0.2); D.wait(1.8);
  everyone((c) => D.face(c, P / 2, 0.5));
  D.say('greg', 'OH, COME ON! NOT HIM AGAIN!', { cam: R('greg', -15, 2.2, 0.15), act: 'armsOut', expr: 'annoyed', dur: 1.8 });
  D.act('greg', 'ready');
  D.say('aaron', 'BEHEMOTH?!', { cam: R('aaron', -20, 2.2, 0.15), expr: 'shocked', dur: 1.1 });
  D.act('aaron', 'ready'); D.set('citizens.on', 0);
  roar(2.2, 'RRRRRRAAAAAAAAHHHH!', { cam: FIX([4, 1.0, 5.5], [24, 7, -0.6], { fov: 50 }), shake: 0.8 });
  // Fred runs across the street, Behemoth chasing him
  D.show('cowboy'); D.place('cowboy', 20, 1.0, -P / 2); D.set('cowboy.y', 0); D.act('cowboy', 'runScared'); D.expr('cowboy', 'scared');
  D.set('cowboy.scuff', 1); D.set('cowboy.hatTilt', 0.22); D.set('cowboy.reveal', 0); D.set('cowboy.alpha', 1);
  {
    const tf = D.path('cowboy', [[3.6, 1.6]], 4.2);
    D.anim('beh.x', 24, tf, 0, 'linear'); D.anim('beh.look', 0.12, tf); D.sfx('stampede', 0, 0.5);
    D.cam(FIX([12, 1.1, 7.0], [16, 1.4, 0.6], { fov: 46 }));
    D.sound('Someone runs across the street. It’s Fred Yeehaw, running away from Behemoth', 2.35, 0.0); D.wait(2.4);
    D.cam(R('cowboy', 30, 3.2, 0.1, { lookY: -0.2, fov: 44 }));
    D.sound('His hat is tilted and his clothes are covered in dust. He looks behind him', 2.6); D.wait(2.3);
    D.say('eric', 'WAIT A MINUTE!', { cam: R('eric', -20, 2.2, 0.15), act: 'point', expr: 'shocked', dur: 1.1 });
    D.say('flare', 'IS THAT FRED?!', { cam: R('flare', -20, 2.2, 0.15), expr: 'shocked', dur: 1.1 });
    D.say('leon', 'WHAT IS HE DOING OUT OF PRISON?!', { cam: R('leon', -25, 2.2, 0.15), expr: 'angry', dur: 1.6 });
    D.wait(Math.max(0, tf - 3.6 - 1.1 * 1.15 - 1.1 * 1.15 - 1.6 * 1.15 - 1.0));
  }
  D.act('eric', 'ready'); D.act('flare', 'ready'); D.act('leon', 'ready');
  // Aaron grabs his arm
  {
    const [fx, fz] = pos('cowboy');
    D.path('aaron', [[fx - 0.9, fz + 0.2]], 2.0); D.faceChar('aaron', 'cowboy', 0.2, 0.5);
    D.act('cowboy', 'catchBreath'); D.face('cowboy', -P / 2 - 0.25, 0.4);
    D.act('aaron', 'grabArm', 0.4);
    D.cam(FIX([fx - 0.4, 1.6, fz + 3.4], [fx - 0.5, 1.3, fz], { fov: 44 }));
    D.sound('Aaron steps forward and grabs him by the arm', 2.2, 0.2); D.wait(2.2);
  }
  D.act('cowboy', 'idle'); D.faceChar('cowboy', 'aaron', 0.4);
  D.say('aaron', 'What are you doing out of jail?!', { cam: R('aaron', 30, 1.9, 0.12), expr: 'angry', dur: 1.8 });
  // Fred looks up at Aaron: for the first time we see his face, and he speaks
  D.anim('cowboy.reveal', 1, 1.6); D.expr('cowboy', 'worried'); D.look('cowboy', 0, -0.1, 0.8);
  D.cam(R('cowboy', 48, 1.5, 0.02, { lookY: -0.02, fov: 34, dist2: 1.25 }));
  D.sound('Fred looks directly at Aaron. He opens his mouth. For the first time, he speaks', 3.6); D.wait(3.6);
  D.say('cowboy', 'Finally...', { label: 'FRED', act: 'catchBreath', dur: 1.4 });
  D.act('cowboy', 'idle');
  D.say('cowboy', 'SOUL STEALER IS GONNA TAKE OUR POWER!', { label: 'FRED', cam: R('cowboy', 35, 2.1, 0.1, { lookY: -0.1, fov: 40 }), act: 'armsOut', expr: 'scared', dur: 2.4 });
  D.act('cowboy', 'idle');
  for (const c of TEAM) { D.act(c, 'frozenStare'); D.expr(c, 'shocked'); }
  D.cam(FIX([5.2, 1.7, 6.4], [1.2, 1.3, 2.4], { fov: 50 })); D.sound('Everyone freezes', 1.4); D.wait(1.6);
  D.say('aaron', '...What?', { cam: R('aaron', 30, 1.9, 0.12), dur: 1.2 });

  // ===================================================================== SCENE 7: THE WARNING
  D.scene('7. The Warning');
  for (const c of TEAM) D.act(c, 'ready');
  D.act('aaron', 'idle');
  roar(2.4, 'RRRRRRRAAAAAAAAAHHHH!', { cam: FIX([6, 0.9, 6.8], [21, 8, -0.4], { fov: 52 }), shake: 1.0 });
  D.say('greg', 'DID HE JUST SAY THE SOUL STEALER?!', { cam: R('greg', -15, 2.2, 0.15), act: 'gasp', expr: 'shocked', dur: 1.9 });
  D.act('greg', 'ready');
  D.say('cowboy', "He's got my horse.", { label: 'FRED', cam: R('cowboy', 20, 1.8, 0.02, { lookY: -0.02, fov: 38 }), act: 'catchBreath', dur: 1.4 });
  D.act('cowboy', 'idle');
  D.say('leon', 'Your horse?', { cam: R('leon', -25, 2.2, 0.15), expr: 'surprised', dur: 1.0 });
  D.say('cowboy', "He's using it.", { label: 'FRED', cam: R('cowboy', 20, 1.8, 0.02, { lookY: -0.02, fov: 38 }), expr: 'worried', dur: 1.2 });
  D.say('flare', 'For what?', { cam: R('flare', -25, 2.2, 0.15), dur: 0.9 });
  D.face('cowboy', P / 2, 0.4); D.act('cowboy', 'point', 0.2);
  D.say('cowboy', 'Power.', { label: 'FRED', cam: FIX([-0.6, 1.7, 4.4], [8, 3.6, -0.2], { fov: 48 }), dur: 1.1 });
  D.act('cowboy', 'idle'); D.faceChar('cowboy', 'aaron', 0.4);
  D.say('aaron', 'What does he want with us?', { cam: R('aaron', 20, 2.0, 0.15), expr: 'worried', dur: 1.5 });
  D.say('cowboy', 'Everything.', { label: 'FRED', cam: R('cowboy', 20, 1.6, 0.02, { lookY: -0.02, fov: 36 }), expr: 'serious', dur: 1.2 });
  // Behemoth stomps forward
  D.anim('beh.x', 19, 1.6, 0, 'inout'); D.shake(0.5, 0.4, 0.4); D.shake(0.5, 0.4, 1.2); D.sfx('thud', 0.4, 0.9); D.sfx('thud', 1.2, 0.9);
  D.cam(FIX([6, 0.8, 7], [18, 6, 0], { fov: 54 })); D.sound('Behemoth stomps forward', 1.6); D.wait(1.8);
  D.say('eric', 'Okay, I think we should probably move!', { cam: R('eric', -15, 2.2, 0.15), act: 'armsOut', expr: 'worried', dur: 1.9 });
  D.act('eric', 'ready');
  // Fred's powers are gone
  D.face('cowboy', P / 2, 0.4); D.act('cowboy', 'tryPower', 0.3); D.expr('cowboy', 'determined'); D.sfx('energyFizzle', 1.0, 0.5);
  D.cam(R('cowboy', 40, 2.4, 0.05, { lookY: -0.15, fov: 42 })); D.sound('Fred tries to raise his hand. Nothing happens', 2.6, 0.3); D.wait(2.6);
  D.say('aaron', 'What are you doing?', { cam: R('aaron', 20, 2.0, 0.15), expr: 'surprised', dur: 1.2 });
  D.act('cowboy', 'lookHand'); D.expr('cowboy', 'worried');
  D.cam(R('cowboy', 30, 1.4, 0.0, { lookY: -0.3, fov: 38 })); D.sound('Fred looks at his hand', 1.4); D.wait(1.5);
  D.say('cowboy', 'My clay...', { label: 'FRED', dur: 1.2 });
  D.act('cowboy', 'tryPower'); D.sfx('energyFizzle', 0.5, 0.5);
  D.cam(R('cowboy', 40, 2.2, 0.05, { lookY: -0.15, fov: 42 })); D.sound('He tries again. Nothing', 1.8); D.wait(2.0);
  D.act('cowboy', 'idle'); D.faceChar('cowboy', 'aaron', 0.4); D.expr('cowboy', 'sad');
  D.say('cowboy', "It's gone.", { label: 'FRED', cam: R('cowboy', 20, 1.6, 0.02, { lookY: -0.02, fov: 36 }), dur: 1.2 });
  D.say('greg', "Wait, so you can't make those clay creatures anymore?", { cam: R('greg', -15, 2.2, 0.15), expr: 'surprised', dur: 2.2 });
  D.look('cowboy', 0.3, 0, 0.25); D.look('cowboy', -0.3, 0, 0.25, 0.3); D.look('cowboy', 0.3, 0, 0.25, 0.6); D.look('cowboy', 0, 0, 0.25, 0.9);
  D.cam(R('cowboy', 20, 1.8, 0.02, { lookY: -0.02, fov: 38 })); D.sound('Fred shakes his head', 1.4); D.wait(1.5);
  D.say('leon', "He's taken your abilities too.", { cam: R('leon', -25, 2.2, 0.15), expr: 'serious', dur: 1.7 });
  D.say('flare', "If he's using Fred's horse, he might be using its invisibility power to get close without being noticed.", { cam: R('flare', -25, 2.2, 0.15), expr: 'serious', dur: 4.2 });
  D.say('aaron', 'And Behemoth is doing the rest.', { cam: R('aaron', 20, 2.0, 0.15), expr: 'determined', dur: 1.7 });
  // the purple blast (timed exactly: charge, dive, hit)
  {
    const t0 = D.now;
    D.anim('beh.jaw', 1, 0.4); D.anim('beh.rear', 0.6, 0.8); D.anim('beh.nod', -0.15, 0.8);
    const m = rigAt(0.9).mouth;
    const target = [0.6, 0.1, 3.0];
    D.fx('chargeBeam', { from: m, to: target, charge: 2.6, dur: 0.6, size: 1.6, width: 0.6, color: 0xa040ff }, 0.2);
    D.sfx('beamCharge', 1.4, 0.9);
    D.cam(FIX([10, 1.2, 8.5], [m[0], m[1], m[2]], { fov: 46 }));
    D.sound('Behemoth opens its mouth. A massive purple energy blast begins charging', 2.0, 0.1);
    wait0(1.5);
    everyone((c) => D.expr(c, 'shocked'));
    D.say('leon', 'EVERYBODY MOVE!', { cam: R('leon', -25, 2.2, 0.15), act: 'point', expr: 'angry', dur: 0.85, gap: 0 });
    // the team scatters
    const dives = { aaron: [-2.6, 7.6], flare: [-6.2, 2.6], eric: [4.4, 8.2], greg: [-5.4, -2.2], leon: [5.4, -1.8], cowboy: [-1.6, -3.2] };
    for (const [c, [x, z]] of Object.entries(dives)) {
      const [cx, cz] = pos(c);
      D.act(c, 'dive'); D.face(c, Math.atan2(x - cx, z - cz), 0.15);
      D.anim(`${c}.x`, x, 0.6, 0, 'out'); D.anim(`${c}.z`, z, 0.6, 0, 'out');
      D.act(c, 'lieFront', 0.6);
    }
    D.cam(FIX([1.2, 6.5, 14], [0.6, 0, 2.6], { fov: 58 })); D.sound('The team scatters', 0.6);
    wait0(Math.max(0.5, t0 + 3.35 - D.now));
    // impact
    D.fx('flashBurst', { x: target[0], y: 0.6, z: target[2], dur: 0.9, radius: 3.5, color: 0xa040ff, light: 80 });
    D.fx('dustCloud', { x: target[0], y: 0, z: target[2], n: 90, dur: 4.5, radius: 6, size: 1.4, h: 3.2, color: 0xa8a0a0, color2: 0x8a8088 });
    D.fx('debris', { x: target[0], y: 0.3, z: target[2], n: 60, spread: 1.6, up: 1.3 });
    D.set('cracks', 1); D.set('cracks.x', target[0]); D.set('cracks.z', target[2]); D.set('cracks.size', 7);
    D.sfx('bigBlast', 0, 1.0); D.shake(1.6, 1.6); D.set('flashWhite', 0.6); D.anim('flashWhite', 0, 0.6);
    D.comic('BOOOOOOM!', 0, 1.3, { x: 0.5, y: 0.35, size: 130, rot: 5, c1: '#ffffff', c2: '#c060ff' });
    D.cam(FIX([9, 2.4, 11], [0.6, 1.0, 2.6], { fov: 56 }));
    D.sound('The blast hits the street where they were standing', 2.4, 0.3); D.wait(2.6);
  }
  D.cam(FIX([3.0, 1.0, 5.5], [0.6, 0.6, 2.6], { fov: 64 })); D.sound('Dust fills the screen', 1.6); D.wait(1.8);
  D.cam(FIX([-3.0, 0.6, 9.5], [0.6, 0.8, 2.6], { pos2: [-2.6, 0.7, 8.6], fov: 54 }));
  D.sound('Slowly, the dust begins to clear...', 2.2); D.wait(2.6);
  D.anim('beh.jaw', 0, 0.5); D.anim('beh.look', -0.9, 1.4); D.anim('beh.rear', 0.7, 1.4);
  // getting back up
  D.act('aaron', 'getUp'); D.expr('aaron', 'determined');
  D.cam(R('aaron', 20, 2.6, 0.2, { lookY: -0.3, fov: 46 })); D.sound('Aaron gets back up', 1.4); D.wait(1.8);
  D.act('aaron', 'ready');
  D.say('aaron', "Everyone okay?!", { cam: R('aaron', 20, 2.4, 0.15, { fov: 44 }), dur: 1.2 });
  D.act('eric', 'getUp'); D.say('eric', "I'M GOOD!", { cam: R('eric', 20, 2.6, 0.15, { fov: 44 }), dur: 0.9 });
  D.act('greg', 'getUp'); D.say('greg', "I'M ALIVE!", { cam: R('greg', 20, 2.6, 0.15, { fov: 44 }), dur: 0.9 });
  D.act('flare', 'getUp'); D.say('flare', 'LEON?!', { cam: R('flare', 20, 2.6, 0.15, { fov: 44 }), expr: 'worried', dur: 0.9 });
  D.act('leon', 'getUp'); D.say('leon', "I'm here!", { cam: R('leon', 20, 2.6, 0.15, { fov: 44 }), dur: 0.9 });
  for (const c of ['eric', 'greg', 'flare', 'leon']) D.act(c, 'ready');
  D.act('cowboy', 'getUp'); D.expr('cowboy', 'worried');
  D.cam(R('cowboy', 20, 2.6, 0.1, { lookY: -0.2, fov: 44 })); D.sound('Fred slowly stands up', 1.6); D.wait(2.2);
  D.act('cowboy', 'idle');
  {
    const [fx, fz] = pos('cowboy');
    D.path('aaron', [[fx - 1.0, fz + 0.9]], 2.4); D.faceChar('aaron', 'cowboy', 0.3, 1.6); D.faceChar('cowboy', 'aaron', 0.4, 1.4);
    D.cam(FIX([fx + 2.2, 1.6, fz + 3.2], [fx - 0.5, 1.4, fz + 0.4], { fov: 46 })); D.wait(2.0);
  }
  D.say('aaron', 'We need to get you somewhere safe.', { cam: R('aaron', 25, 1.9, 0.12), dur: 1.8 });
  D.say('cowboy', 'No.', { label: 'FRED', cam: R('cowboy', 15, 1.6, 0.02, { lookY: -0.02, fov: 36 }), act: 'idle', expr: 'serious', dur: 1.0 });
  D.cam(R('aaron', 25, 1.9, 0.12)); D.sound('Aaron looks at him', 1.2); D.wait(1.3);
  D.say('cowboy', "He's coming.", { label: 'FRED', cam: R('cowboy', 15, 1.5, 0.02, { lookY: -0.02, fov: 34 }), dur: 1.3 });
  // the Soul Stealer on a rooftop, the horse glowing beside him
  {
    D.show('soul'); D.place('soul', 0, -52.9, 0); D.set('soul.y', 30.35); D.set('soul.eyes', 1); D.set('soul.violet', 1); D.set('soul.raise', 0); D.set('soul.palm', 0);
    D.show('horse'); D.place('horse', 2.4, -53.5, -0.3); D.set('horse.y', 30.35); D.set('horse.purple', 1); D.set('horse.glow', 2.0); D.set('horse.alpha', 1); D.set('horse.act', 'idle');
    D.set('roof.glow', 1);
    D.music('villain', 0.4, 0, 0.6);
    D.cam(FIX([-3.6, 30.9, -45.5], [0.6, 32.4, -53.0], { pos2: [-3.2, 30.9, -46.2], fov: 44 }));
    D.sound('Far away, the Soul Stealer stands on top of a building. His horse stands beside him, glowing purple', 4.0, 0.3); D.wait(4.4);
    D.say('soul', 'Soon...', { cam: F(['soul'], 20, 3.2, -0.3, { lookY: -0.2, fov: 40 }), dur: 1.4 });
    D.anim('soul.raise', 1, 0.6); D.anim('soul.palm', 1, 0.6); D.sfx('crystalHum', 0, 0.5);
    D.cam(FIX([-2.6, 30.6, -47.0], [0.2, 32.6, -53.0], { fov: 44 })); D.sound('He raises one hand', 1.4); D.wait(1.6);
    D.set('horse.act', 'rear'); D.sfx('horseNeigh', 0, 0.6); D.anim('horse.glow', 3.2, 0.6); D.fx('bodyAura', { who: 'horse', dur: 3.0, color: 0xa040ff, power: 1.3 });
    D.cam(F(['horse'], 150, 4.2, 0.2, { lookY: -0.2, fov: 44 })); D.sound('The horse rears up, blazing with purple light', 2.2); D.wait(2.4);
    D.set('horse.act', 'idle');
  }
  D.anim('beh.look', 0.08, 1.2); D.anim('beh.rear', 0.45, 1.2); D.anim('beh.nod', -0.1, 1.2);
  D.cam(FIX([12, 1.0, 9], [20, 7, -1], { fov: 52 })); D.sound('Behemoth turns toward the heroes', 1.6); D.wait(1.8);
  D.say('soul', 'Their power will be mine.', { cam: F(['soul'], 15, 2.8, -0.2, { lookY: -0.2, fov: 40 }), dur: 1.8 });
  D.anim('soul.raise', 0.2, 0.6); D.anim('soul.palm', 0, 0.6);
  // Aaron looks up
  D.face('aaron', P, 0.6); D.look('aaron', 0, -0.35, 0.6); D.act('aaron', 'idle');
  D.cam(R('aaron', 20, 2.0, 0.0, { lookY: -0.1 })); D.sound('Back on the street, Aaron looks up', 1.8); D.wait(1.8);
  D.say('aaron', 'Guys...', { dur: 1.0 });
  for (const c of ['eric', 'greg', 'flare', 'leon', 'cowboy']) { D.face(c, P, 0.6); D.look(c, 0, -0.3, 0.6); D.act(c, 'idle'); D.expr(c, 'shocked'); }
  D.cam(FIX([0.4, 1.4, 9.5], [0, 8, -50], { fov: 46 })); D.sound('Everyone turns', 1.4); D.wait(1.6);
  D.say('aaron', "We're not dealing with just Behemoth anymore.", { cam: R('aaron', 25, 1.9, 0.12, { lookY: -0.05 }), expr: 'determined', dur: 2.2 });
  {
    const line = [['leon', -2.6], ['flare', -1.35], ['aaron', -0.1], ['cowboy', 1.15], ['eric', 2.4], ['greg', 3.65]];
    for (const [c, z] of line) { D.place(c, 1.0, z, P / 2); D.act(c, c === 'cowboy' ? 'idle' : 'ready'); D.expr(c, 'determined'); D.look(c, 0, 0, 0.3); }
    D.cam(FIX([-6.0, 0.8, 0.6], [19, 5, 0.2], { pos2: [-5.2, 0.8, 0.6], fov: 54 }));
    D.sound('The team stands together, face to face with Behemoth', 2.6); D.wait(2.8);
  }
  // the Soul Stealer's eyes light up
  D.anim('soul.eyes', 3.0, 1.2); D.sfx('blackPulse', 0, 0.7);
  D.cam(F(['soul'], 10, 1.6, -0.1, { lookY: -0.05, fov: 36, dist2: 1.3 })); D.sound("The Soul Stealer's eyes begin glowing", 2.0); D.wait(2.0);
  D.say('soul', 'Let the collection begin.', { dur: 2.0 });
  roar(2.6, 'RRRRRRRAAAAAAAAAAHHHHH!', { cam: FIX([14, 1.0, 10], [16, 8, -1], { fov: 52 }), shake: 1.2 });
  D.anim('beh.x', 13, 2.0, 0, 'in'); D.shake(0.6, 0.5, 0.6); D.shake(0.6, 0.5, 1.4); D.sfx('thud', 0.6, 1.0); D.sfx('thud', 1.4, 1.0);
  for (const c of TEAM) D.act(c, 'ready');
  D.cam(FIX([-2.0, 1.2, 8.5], [10, 4, -0.6], { fov: 52 })); D.sound('Behemoth charges toward the team', 2.0); D.wait(1.8);
  D.set('fade', 1); D.sfx('cutBlack', 0, 0.5); D.music('none', 0, 0, 0.2); D.wait(1.4);

  // ===================================================================== END CARD
  D.scene('End');
  D.location('title');
  cast([]);
  D.set('fade', 1); D.anim('fade', 0, 0.8);
  D.music('theme', 0.6, 0, 0.1);
  D.set('title.theme', 0); D.set('title.k', 1); D.set('title.sub', 0); D.set('title.y', 1.4); D.set('title.jolt', 0);
  D.cam(FIX([0, 0.6, 10.5], [0, 0.4, 0], { pos2: [0, 0.5, 10.0], fov: 42 }));
  const endDur = 11;
  D.card('credits', endDur, {
    lines: [
      { text: 'END OF EPISODE 8', big: true, y: 0.56, color: '#7fd4ff' },
      { text: 'TO BE CONTINUED...', bold: true, y: 0.66, color: '#ffd23f' },
      { text: 'Starring  Aaron  ·  Greg  ·  Flare  ·  Eric  ·  Leon  ·  Fred Yeehaw  ·  and the Soul Stealer', y: 0.76 },
      { text: 'Created by Nick', y: 0.83 },
    ],
  });
  wait0(endDur - 1.6);
  D.anim('fade', 1, 1.5); wait0(1.6);
  return D.end();
}
