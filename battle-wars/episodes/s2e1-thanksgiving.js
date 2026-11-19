// BATTLE WARS - Season 2, Episode 1: "THANKSGIVING TURKEY RUSH"
import { createDirector, readTime } from '../src/director.js';

export const META = {
  id: 's2e1-thanksgiving', title: 'Battle Wars - S2E1 - Thanksgiving Turkey Rush', file: 'Battle_Wars_S2E1_Thanksgiving_Turkey_Rush',
  s2: true, s2e1: true, e6: true,
  s2Cast: ['gus', 'rose', 'kid1', 'kid2', 'shop1', 'shop2', 'shop3', 'shop4', 'shop5', 'shop6'],
  propHeroes: ['aaron', 'flare', 'eric', 'leon', 'greg', 'gus'],
  camBounds: { living: [-6.9, 6.9, -4.5, 5.2], market: [-8.8, 8.8, -11.8, 7.8], dining: [-6.7, 6.7, -5.7, 4.7], avenue: [-12.8, 12.8, -200, 100] },
  camBlocks: {
    market: [[-6.02, -4.78, -7.6, 2.6, 2.1], [-2.42, -1.18, -7.6, 2.6, 2.1], [1.18, 2.42, -7.6, 2.6, 2.1], [4.78, 6.02, -7.6, 2.6, 2.1], [-4.6, 4.6, -11.7, -10.1, 1.45], [-7.1, -6.1, 4.0, 6.8, 1.45], [-4.1, -3.1, 4.0, 6.8, 1.45], [2.9, 6.5, 3.9, 6.2, 1.3], [-2.5, -1.1, 2.8, 3.7, 1.25]],
    dining: [[-2.5, 2.5, 0.2, 1.8, 0.86], [-2.6, 0.2, -3.5, -2.3, 1.0], [-5.6, 3.6, -6.0, -5.1, 1.0], [4.0, 5.2, -6.0, -5.0, 2.2]],
    living: [[-1.4, 1.4, 0.3, 1.25, 0.95], [-1.05, 1.05, -1.35, -0.35, 0.55]],
  },
};

const P = Math.PI;
const K_SAY = 1.49, K_HOLD = 1.41; // pacing: reading time per caption and hold length per shot
const TEAM = ['aaron', 'flare', 'eric', 'leon', 'greg'];
const SHOP = ['shop1', 'shop2', 'shop3', 'shop4', 'shop5', 'shop6'];
const GUESTS = ['gus', 'rose', 'kid1', 'kid2', 'shop1'];
const ALL = [...TEAM, 'barista', 'newark', 'cowboy', 'gus', 'rose', 'kid1', 'kid2', ...SHOP, 'cat', 'horse', 'dog', 'birddog', 'water', 'soul'];

export function buildEpisode() {
  const D = createDirector();
  const say0 = D.say;
  D.say = (who, text, opts = {}) => say0(who, text, { ...opts, dur: (opts.dur ?? readTime(text)) * K_SAY, gap: opts.gap ?? 0.5 });
  const HOLD = K_HOLD, wait0 = D.wait, sound0 = D.sound;
  D.wait = (d) => wait0(d * HOLD);
  D.sound = (text, dur = 1.6, dt = 0) => sound0(text, dur * HOLD, dt);
  const F = (on, yaw, dist, h = 0.15, x = {}) => ({ type: 'frame', on: Array.isArray(on) ? on : [on], yaw, dist, h, ...x });
  const R = (on, yaw, dist, h = 0.15, x = {}) => F(on, yaw, dist, h, { rel: Array.isArray(on) ? on[0] : on, ...x });
  const FIX = (pos, look, x = {}) => ({ type: 'fixed', pos, look, ...x });
  const props = (c, r = 'none', l = 'none') => { D.set(`${c}.propR`, r); D.set(`${c}.propL`, l); };
  const cast = (list) => {
    for (const c of ALL) { if (!list.includes(c)) D.hide(c); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); if (!['cat', 'horse', 'dog', 'birddog', 'water', 'soul'].includes(c)) { D.set(`${c}.propR`, 'none'); D.set(`${c}.propL`, 'none'); D.set(`${c}.y`, 0); } }
    D.set('greg.stretch', 0); D.set('cup.held', 0); D.set('turkey.hold', 'none'); D.set('aaron.shield', 0); D.set('aaron.holo', 0); D.set('cat.vis', 0);
  };
  const pos = (c, dt = 0) => [D.val(`${c}.x`, D.now + dt), D.val(`${c}.z`, D.now + dt)];
  const fly = (c, x, y, z, dur, dt = 0, ease = 'inout') => { D.anim(`${c}.x`, x, dur, dt, ease); D.anim(`${c}.y`, y, dur, dt, ease); D.anim(`${c}.z`, z, dur, dt, ease); };
  const tk = (x, y, z, dur = 0, dt = 0, ease = 'inout') => { if (dur <= 0) { D.set('turkey.x', x, dt); D.set('turkey.y', y, dt); D.set('turkey.z', z, dt); } else { D.anim('turkey.x', x, dur, dt, ease); D.anim('turkey.y', y, dur, dt, ease); D.anim('turkey.z', z, dur, dt, ease); } };
  // turkey thrown in an arc from where it is now to (x, y, z)
  const tkArc = (x, y, z, dur, h = 1.2, dt = 0) => {
    const x0 = D.val('turkey.x', D.now + dt), y0 = D.val('turkey.y', D.now + dt), z0 = D.val('turkey.z', D.now + dt);
    const n = 6;
    for (let i = 1; i <= n; i++) { const k = i / n; const tt = dt + dur * (i - 1) / n; D.anim('turkey.x', x0 + (x - x0) * k, dur / n, tt, 'linear'); D.anim('turkey.z', z0 + (z - z0) * k, dur / n, tt, 'linear'); D.anim('turkey.y', y0 + (y - y0) * k + Math.sin(k * P) * h, dur / n, tt, 'linear'); }
  };
  const clock = (from, to, dur) => { D.set('clock.left', from); D.anim('clock.left', to, dur, 0, 'linear'); D.set('mkt.clock', 60 - from / 60); D.anim('mkt.clock', 60 - to / 60, dur, 0, 'linear'); };
  const everyone = (fn, list = TEAM) => { for (const c of list) fn(c); };
  const sit = (c, x, z, ry, act = 'sitTable') => { D.place(c, x, z, ry); D.act(c, act); };

  // ---- defaults
  for (const c of ALL) { D.hide(c); D.act(c, 'idle'); D.expr(c, 'neutral'); D.set(`${c}.y`, 0); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); D.set(`${c}.roll`, 0); props(c); }
  cast([]);
  D.set('fade', 1); D.set('turkey.vis', 0); D.set('turkey.kind', 'frozen'); D.set('turkey.s', 1); D.set('turkey.spin', 0); D.set('turkey.rx', 0); D.set('turkey.ry', 0); D.set('turkey.rz', 0); D.set('turkey.hdy', 0);
  D.set('hud.clock', 0); D.set('clock.left', 1200); D.set('mkt.clock', 40); D.set('mkt.stock', 0); D.set('mkt.closed', 0); D.set('mkt.door', 0); D.set('mkt.cans', 0); D.set('mkt.spill', 0); D.set('mkt.tip', 0);
  for (let i = 1; i <= 3; i++) { D.set(`cart${i}.vis`, 0); D.set(`cart${i}.tip`, 0); }
  D.set('thx.decor', 1); D.set('night', 0); D.set('evening', 0); D.set('tv.off', 1); D.set('laptop.on', 0); D.set('pizza', 0); D.set('kitchen', 0);
  D.set('din.food', 1); D.set('din.turkey', 0); D.set('din.sides', 1); D.set('din.eaten', 0); D.set('din.night', 0); D.set('kit.oven', 0); D.set('kit.ovenOpen', 0); D.set('kit.tray', 1);
  D.set('crowd.cheer', 0); D.set('balloon.vis', 1); D.set('balloon.loose', 0); D.set('balloon.x', 0); D.set('balloon.y', 7); D.set('balloon.z', -22); D.set('balloon.rx', 0); D.set('balloon.ry', 0); D.set('balloon.rz', 0);
  D.set('float1.z', -40); D.set('float2.z', -60); D.set('sky.sunset', 0);
  D.set('hq.doors', 0); D.set('hq.takeover', 0); D.set('hq.purple', 0); D.set('hq.clear', 1); D.set('hq.skyline', 1);
  D.set('cat.spin', 0); D.set('cat.pizza', 0); D.set('flashWhite', 0); D.set('s2title.t0', 0);

  // =====================================================================================================================
  // INTRO: same theme song, quick scenes from Season 2, then the title rises with powers shooting out of both sides
  D.scene('Intro');
  D.music('theme', 0.6, 0, 0.5);
  // 1. the team sprints down a store aisle toward the camera
  D.location('market'); cast(['aaron', 'flare', 'eric', 'leon']);
  D.place('aaron', 0, -7, 0); D.place('flare', -0.6, -8, 0); D.place('leon', 0.6, -8.6, 0); D.place('eric', 0, -9.4, 0);
  everyone((c) => D.expr(c, 'determined'), ['aaron', 'flare', 'eric', 'leon']);
  for (const c of ['aaron', 'flare', 'eric', 'leon']) D.path(c, [[pos(c)[0], -1.4 - (c === 'aaron' ? 0 : 0.8)]], 6.4);
  D.set('fade', 0); D.anim('fade', 0, 0.3);
  D.cam(FIX([0, 0.9, 3.4], [0, 1.2, -6], { pos2: [0, 1.1, 2.8], fov: 50 }));
  D.wait(2.0);
  // 2. Greg flies over the parade, past the giant turkey balloon
  D.location('avenue'); cast(['greg']);
  D.set('float1.z', -6); D.anim('float1.z', -2, 3); D.set('balloon.z', -16); D.set('crowd.cheer', 1);
  D.place('greg', -12, -10, P / 2); D.set('greg.y', 6); D.act('greg', 'fly'); D.expr('greg', 'happy');
  fly('greg', 12, 6.5, -12, 2.6, 0, 'linear');
  D.cam(FIX([-4, 3.0, 2], [0, 6.2, -12], { pos2: [4, 3.4, 2], fov: 56 })); D.sfx('whoosh', 0.4, 0.7); D.sfx('crowdCheer', 0, 0.5);
  D.wait(2.0);
  // 3. Flare's hand bursts into flames
  D.location('market'); cast(['flare']); D.set('crowd.cheer', 0);
  D.place('flare', 0, -2, P); D.act('flare', 'flameHand'); D.expr('flare', 'smug');
  D.fx('flame', { who: 'flare', side: 'R', dur: 2.2, size: 0.4 }, 0.2); D.sfx('flameIgnite', 0.2, 0.7);
  D.cam(FIX([0.6, 1.5, -3.4], [0, 1.3, -2], { pos2: [0.45, 1.5, -3.1], fov: 40 })); D.wait(1.8);
  // 4. Leon catches a falling store shelf
  cast(['leon']); D.place('leon', 0.6, -3.0, -P / 2); D.act('leon', 'blockPipe'); D.expr('leon', 'determined');
  D.set('mkt.tip', 0.42); D.anim('mkt.tip', 0.32, 0.4, 0.1, 'out');
  D.cam(FIX([-0.9, 0.9, 0.5], [1.0, 1.6, -3.2], { fov: 54 })); D.sfx('metalCrash', 0, 0.6); D.shake(0.3, 0.4);
  D.wait(1.8);
  D.set('mkt.tip', 0);
  // 5. the frozen turkey spins through the air and Aaron dives for it
  cast(['aaron']); D.place('aaron', 0, 0.6, P); D.expr('aaron', 'determined');
  D.set('turkey.vis', 1); D.set('turkey.kind', 'frozen'); D.set('turkey.spin', 2.2); tk(0, 2.4, -2.5); tk(0, 1.25, 0.1, 1.8, 0, 'out');
  D.act('aaron', 'catchS2', 1.0); D.anim('aaron.z', 0.2, 0.4, 1.0);
  D.cam(FIX([0.95, 1.0, 1.8], [0, 1.6, -1.4], { pos2: [0.9, 1.1, 1.4], fov: 48 })); D.sfx('whoosh', 0, 0.6);
  D.wait(1.9);
  D.set('turkey.vis', 0); D.set('turkey.spin', 0);
  // 5b. cat Eric zips across the store floor
  D.location('market'); cast([]); D.place('cat', -2.0, 0.4, P / 2); D.set('cat.act', 'run'); D.path('cat', [[2.4, 0.4]], 2.2);
  D.cam(FIX([0.2, 0.25, 2.2], [0.2, 0.25, -1], { fov: 54 })); D.sfx('meow', 0.3, 0.5); D.wait(1.3);
  D.set('cat.vis', 0);
  // 5c. Gus flips the sign: CLOSED
  cast(['gus']); D.place('gus', -1.2, 6.9, 0); D.act('gus', 'point'); D.expr('gus', 'smug'); D.set('mkt.closed', 0); D.set('mkt.closed', 1, 0.6); D.sfx('clink', 0.6, 0.5);
  D.cam(FIX([-0.4, 1.7, 5.0], [-0.9, 1.6, 8.0], { fov: 46 })); D.wait(1.4);
  D.set('mkt.closed', 0);
  // 6. Thanksgiving dinner: everyone raises their glasses
  D.location('dining'); cast([...TEAM]); D.set('din.turkey', 1);
  sit('aaron', -0.55, -0.15, 0, 'sitToast'); sit('flare', 0.55, -0.15, 0, 'sitToast'); sit('eric', -1.65, -0.15, 0, 'sitToast'); sit('greg', 1.65, -0.15, 0, 'sitToast'); sit('leon', -2.95, 1.0, P / 2, 'sitToast');
  everyone((c) => D.expr(c, 'happy'));
  D.cam(FIX([0, 1.7, 3.6], [0, 1.0, 0.2], { pos2: [0, 1.6, 3.2], fov: 54 })); D.sfx('clink', 0.6, 0.6);
  D.wait(2.0);
  // 7. hero lineup + quick close-ups
  D.location('living'); cast([...TEAM]);
  ['eric', 'flare', 'aaron', 'leon', 'greg'].forEach((c, i) => { D.place(c, -2 + i, -2.6, 0); D.act(c, 'determinedS2'); D.expr(c, 'determined'); });
  D.cam(FIX([0, 1.1, 0.2], [0, 1.4, -2.6], { pos2: [0, 1.15, -0.3], fov: 50 })); D.sfx('titleHit', 0, 0.5);
  D.wait(1.6);
  for (const c of ['aaron', 'flare', 'eric', 'leon', 'greg']) { D.cam(R(c, 0, 0.95, 0.1, { fov: 38 })); D.sfx('whoosh', 0, 0.35); D.wait(0.6); }
  // 8. the title: BATTLE WARS rises, powers shoot out of both sides, SEASON 2
  D.location('s2title'); cast([]); D.set('s2title.t0', D.now);
  D.cam(FIX([0, 0.15, 8.5], [0, 0.15, 0], { pos2: [0, 0.2, 7.6], fov: 45 }));
  D.sfx('rumble', 0, 0.6); D.sfx('titleHit', 1.3, 0.9); D.sfx('fireRoar', 1.35, 0.6); D.sfx('electricHum', 1.35, 0.6); D.sfx('powerUp', 1.5, 0.6); D.sfx('sparkle', 2.0, 0.6);
  D.wait(4.4);
  D.card('titleSub', 2.6, { text: 'Season 2, Episode 1: THANKSGIVING TURKEY RUSH' });
  D.wait(2.0);
  D.anim('fade', 1, 0.5); D.wait(0.5);

  // =====================================================================================================================
  D.scene('1. Thanksgiving Morning');
  D.location('hqExt'); cast([]);
  D.set('evening', 0); D.set('night', 0); D.anim('fade', 0, 0.6);
  D.music('morning', 0.35, 0, 1.5); D.sfx('birds', 0.3, 0.4);
  D.cam(FIX([14, 3.0, 18], [0, 5, -6], { pos2: [12, 3.0, 16], fov: 52 }));
  D.card('location', 3.4, { text: 'BATTLE WARS HQ - THANKSGIVING MORNING' });
  D.sound('Leaves fall outside headquarters. It is Thanksgiving morning', 2.8, 0.2); D.wait(3.6);
  D.location('living'); cast([...TEAM]);
  D.place('greg', 0, 0.75, P); D.act('greg', 'sitSleep'); D.expr('greg', 'sleep');
  D.place('leon', -2.4, 2.8, P * 0.85); props('leon', 'notebook'); D.act('leon', 'readBook'); D.expr('leon', 'happy');
  D.place('flare', 2.2, 2.6, -P * 0.8); D.set('cup.held', 1); D.act('flare', 'idle'); D.expr('flare', 'tired');
  D.place('aaron', -5.6, 2.6, -P / 2); D.act('aaron', 'idle'); D.expr('aaron', 'happy');
  D.place('eric', 6.4, 3.6, -P / 2);
  D.cam(FIX([3.0, 2.2, 4.9], [-1.5, 0.9, -1.0], { pos2: [2.6, 2.1, 4.7], fov: 56 }));
  D.sfx('snore', 0.4, 0.5); D.sound('Greg snores on the couch. The whole room is decorated for Thanksgiving', 3.0, 0.2); D.wait(3.4);
  // Eric bursts in
  D.act('eric', 'cheerJump'); D.expr('eric', 'grin'); D.path('eric', [[3.2, 3.2], [0.8, 2.9]], 5.5); D.sfx('doorOpen', 0, 0.5);
  D.say('eric', "IT'S THANKSGIVING!!!", { cam: F(['eric'], 200, 3.2, 0.3, { lookY: -0.2, fov: 52 }), dur: 1.6 });
  D.act('eric', 'cheer');
  D.act('greg', 'sitWake'); D.expr('greg', 'surprised'); D.sfx('yawn', 0, 0.4);
  D.say('greg', 'Huh? What? Is it time to eat?', { cam: R('greg', 15, 1.5, 0.05, { lookY: -0.05, fov: 40 }), dur: 1.8 });
  D.act('eric', 'idle'); D.expr('eric', 'happy');
  D.say('flare', "It's nine in the morning, Greg.", { cam: R('flare', 25, 1.7, 0.1), act: 'idle', expr: 'tired', dur: 1.6 });
  D.say('greg', 'So... second breakfast?', { cam: R('greg', 15, 1.5, 0.05, { lookY: -0.05, fov: 40 }), expr: 'happy', dur: 1.4 });
  D.say('eric', 'Turkey! Stuffing! Pie! This is the BEST day of the whole year!', { cam: R('eric', 20, 1.8, 0.1), act: 'armsOut', expr: 'grin', dur: 2.3 });
  D.act('eric', 'idle');
  D.act('leon', 'presentS2'); props('leon');
  D.say('leon', 'The decorations are finally done. Well? What do you think?', { cam: FIX([-3.6, 1.7, 4.6], [1.0, 2.2, -4.4], { pos2: [-3.0, 1.7, 4.4], fov: 58 }), expr: 'happy', dur: 2.2 });
  D.act('leon', 'idle'); props('leon', 'notebook');
  D.say('eric', 'It looks AMAZING! It looks like a giant pumpkin exploded in here!', { cam: R('eric', 25, 1.7, 0.1), expr: 'grin', dur: 2.4 });
  D.say('leon', "...I'm going to take that as a compliment.", { cam: R('leon', 25, 1.6, 0.1), expr: 'tired', dur: 1.6 });
  D.say('flare', "It's nice. Very... orange.", { cam: R('flare', 25, 1.7, 0.1), expr: 'smug', dur: 1.4 });
  D.say('aaron', 'You outdid yourself this year, Leon.', { cam: R('aaron', 25, 1.7, 0.1), expr: 'happy', dur: 1.6 });
  D.say('greg', 'Did anybody decorate the fridge? You know... with food?', { cam: R('greg', 15, 1.5, 0.05, { lookY: -0.05, fov: 40 }), expr: 'happy', dur: 2.2 });
  D.path('aaron', [[-2.0, 3.6]], 1.6); D.path('leon', [[-1.6, 2.6]], 1.2);
  D.say('aaron', "Okay, team. Let's make sure we have everything for dinner. Leon, the list?", { cam: R('aaron', 25, 1.9, 0.12), dur: 2.4 });
  D.faceChar('aaron', 'leon', 0.3);
  D.act('leon', 'readBook');
  const listT = D.now;
  D.card('shopList', 12.5, { title: 'THANKSGIVING LIST', items: ['Mashed potatoes', 'Stuffing', 'Cranberry sauce', 'Corn', 'Green beans', 'Pumpkin pie', 'Dinner rolls', 'TURKEY'], big: 7, done: [0, 1, 2, 3, 4, 5, 6], doneAt: [listT + 1.6, listT + 2.4, listT + 3.2, listT + 4.0, listT + 4.8, listT + 5.6, listT + 6.4], circle: listT + 9.4 });
  D.cam(R('leon', 30, 1.6, 0.1, { lookY: -0.1, fov: 42 }));
  D.say('leon', 'Mashed potatoes. Stuffing. Cranberry sauce. Corn...', { dur: 2.6 });
  for (let i = 0; i < 7; i++) D.sfx('scribble', 1.6 + i * 0.8 - 2.6 * 1.32 - 0.45, 0.35);
  D.say('leon', 'Green beans. Pumpkin pie. Dinner rolls. Check, check, check.', { dur: 2.6 });
  D.say('leon', 'And the most important thing of all...', { expr: 'neutral', dur: 1.6 });
  D.act('leon', 'idle'); D.expr('leon', 'worried'); D.sfx('spookyStinger', 0, 0.3);
  D.say('leon', '...the turkey.', { cam: R('leon', 20, 1.1, 0.05, { fov: 36 }), dur: 1.2 });
  D.sound('Everyone slowly turns to look at Greg', 2.0); D.wait(0.2);
  everyone((c) => { D.faceChar(c, 'greg', 0.5); D.expr(c, 'serious'); }, ['aaron', 'flare', 'eric', 'leon']);
  D.cam(FIX([0, 1.5, 4.2], [0, 0.9, 0.7], { pos2: [0, 1.3, 3.0], fov: 46 })); D.wait(2.2);
  D.expr('greg', 'worried');
  D.say('leon', 'Greg. You were in charge of buying the turkey.', { cam: R('leon', 25, 1.6, 0.1), dur: 2.0 });
  D.say('greg', '...Define "in charge."', { cam: R('greg', 15, 1.4, 0.05, { lookY: -0.05, fov: 40 }), dur: 1.4 });
  D.act('greg', 'idle'); D.place('greg', 0, 1.7, P); D.act('greg', 'shrug');
  D.say('greg', 'Okay, okay. I went to the store last week to get it. Honest!', { cam: R('greg', 20, 1.8, 0.1), dur: 2.4 });
  D.say('greg', 'But then I got hungry. So I bought a pizza. And I ate the pizza. And then... I forgot.', { act: 'shrugBig', dur: 3.2 });
  D.act('greg', 'idle');
  everyone((c) => D.act(c, 'facepalm'), ['aaron', 'flare', 'leon']); D.act('eric', 'gasp'); D.expr('eric', 'shocked');
  D.cam(FIX([0, 1.6, -0.6], [0, 1.3, 3.0], { fov: 56 })); D.sfx('groan', 0, 0.5);
  D.sound('Everyone groans', 1.6); D.wait(1.8);
  everyone((c) => D.act(c, 'idle'), ['aaron', 'flare', 'leon', 'eric']);
  D.say('eric', 'NO TURKEY?! On THANKSGIVING?!', { cam: R('eric', 15, 1.4, 0.05, { fov: 40 }), act: 'flailS2', dur: 1.8 });
  D.act('eric', 'idle');
  D.act('aaron', 'checkWrist'); D.set('aaron.holo', 1, 0.3); D.sfx('holoOn', 0.3, 0.5); D.expr('aaron', 'thinking');
  D.say('aaron', 'Hold on. Every store in Aetherfall is closed today...', { cam: R('aaron', 30, 1.5, 0.05, { lookY: -0.15, fov: 40 }), dur: 2.2 });
  D.say('aaron', "...except one. Gus's Market. It's open until three o'clock.", { expr: 'happy', dur: 2.4 });
  D.say('leon', "Gus's Market? That's all the way across town!", { cam: R('leon', 25, 1.6, 0.1), expr: 'worried', dur: 2.0 });
  D.say('aaron', "And there's more bad news. Gus's website says they have exactly... one turkey left.", { cam: R('aaron', 30, 1.5, 0.05, { lookY: -0.15, fov: 40 }), expr: 'worried', dur: 3.0 });
  D.say('flare', 'What time is it now?', { cam: R('flare', 25, 1.7, 0.1), expr: 'neutral', dur: 1.3 });
  D.set('hud.clock', 0); D.anim('hud.clock', 1, 0.4); D.set('clock.left', 20 * 60); D.sfx('alarmBeep', 0, 0.6);
  D.say('aaron', "Wait... I read that wrong. It's not nine o'clock. My watch says it's 2:40!", { cam: R('aaron', 20, 1.4, 0.05, { fov: 40 }), expr: 'shocked', dur: 2.8 });
  D.say('greg', 'We slept until 2:40?!', { cam: R('greg', 15, 1.4, 0.05, { lookY: -0.05, fov: 40 }), expr: 'shocked', dur: 1.4 });
  D.say('flare', 'YOU slept until 2:40. We were decorating.', { cam: R('flare', 25, 1.7, 0.1), expr: 'annoyed', dur: 2.0 });
  D.set('aaron.holo', 0); D.act('aaron', 'idle');
  D.say('eric', "That's only twenty minutes! And the Thanksgiving parade is right in the middle of town!", { cam: R('eric', 20, 1.8, 0.1), expr: 'worried', dur: 3.0 });
  D.set('cup.held', 0); D.act('flare', 'stretch'); D.expr('flare', 'determined');
  D.say('flare', "Then we'd better stop talking and start running.", { cam: R('flare', 25, 1.7, 0.1), dur: 2.0 });
  everyone((c) => { D.act(c, 'determinedS2'); D.expr(c, 'determined'); D.faceChar(c, 'aaron', 0.3); }, ['flare', 'eric', 'leon', 'greg']);
  D.act('aaron', 'fistPump'); D.expr('aaron', 'determined');
  D.say('aaron', 'Battle Wars... LET\'S GO GET THAT TURKEY!', { cam: R('aaron', 15, 1.6, 0.05, { lookY: 0.1, fov: 44 }), dur: 2.0 });
  D.act('greg', 'raiseItem');
  D.say('greg', 'Can we get snacks too?', { cam: R('greg', -35, 1.6, 0.05, { fov: 40 }), expr: 'happy', dur: 1.3 });
  everyone((c) => D.faceChar(c, 'greg', 0.25), ['aaron', 'flare', 'eric', 'leon']);
  D.say('aaron', 'GREG!', { label: 'EVERYONE', cam: FIX([0, 1.6, -0.6], [0, 1.3, 3.0], { fov: 56 }), dur: 1.0 });
  D.act('greg', 'idle');
  everyone((c) => D.path(c, [[6.6, 3.6]], 5.8), [...TEAM]);
  D.cam(FIX([-4.5, 1.8, 4.6], [3, 1.0, 2.8], { fov: 56 })); D.sfx('whoosh', 0.3, 0.6); D.sfx('doorSlam', 1.6, 0.6);
  D.wait(1.9);
  D.anim('fade', 1, 0.4); D.wait(0.4);

  // =====================================================================================================================
  D.scene('2. Race Across Town');
  D.location('avenue'); cast([...TEAM]); D.anim('fade', 0, 0.4);
  D.music('adventure', 0.4, 0, 0.8); D.sfx('crowdCheer', 0, 0.4); D.set('crowd.cheer', 0.4);
  clock(15 * 60, 13 * 60, 60);
  D.set('float1.z', -30); D.anim('float1.z', 10, 90, 0, 'linear'); D.set('float2.z', -52); D.anim('float2.z', -12, 90, 0, 'linear');
  D.set('balloon.x', 0); D.set('balloon.y', 7); D.set('balloon.z', -16); D.anim('balloon.z', -6, 40, 0, 'linear');
  D.cam(FIX([-11, 6, 14], [0, 3, -14], { pos2: [-10, 5.5, 12], fov: 58 }));
  D.card('location', 3.4, { text: 'DOWNTOWN AETHERFALL - THE THANKSGIVING PARADE' });
  D.sound('Marching drums. Cheering crowds. The parade fills the whole avenue', 3.0, 0.2); D.wait(3.4);
  D.place('rose', 10.0, -5.9, -P / 2); D.place('kid1', 9.4, -6.4, -P / 2); D.place('kid2', 9.4, -5.4, -P / 2);
  D.act('kid1', 'cheerJump'); D.act('kid2', 'wave'); D.expr('kid1', 'grin'); D.expr('kid2', 'grin'); D.expr('rose', 'happy');
  D.say('kid2', 'Grandma, look! The giant turkey balloon!', { cam: F(['kid2', 'rose'], 230, 2.6, 0.0, { lookY: 0.2, fov: 44 }), dur: 1.8 });
  D.act('rose', 'heartS2');
  D.say('rose', "Isn't it wonderful? And right after the parade, we're going to Gus's Market to buy our turkey.", { cam: R('rose', -30, 1.5, 0.05, { fov: 40 }), dur: 3.0 });
  D.act('rose', 'idle'); D.act('kid1', 'idle'); D.act('kid2', 'idle');
  D.say('kid1', 'Our first Thanksgiving with a real turkey!', { cam: R('kid1', -30, 1.3, 0.0, { lookY: 0.15, fov: 40 }), dur: 1.8 });
  D.hide('rose'); D.hide('kid1'); D.hide('kid2');
  // the team arrives at the gap in the barricades
  D.place('aaron', -12, 4, 0); D.place('flare', -12.8, 5.2, 0); D.place('eric', -13.6, 4.6, 0); D.place('leon', -12.4, 6.4, 0); D.place('greg', -13.2, 6.8, 0);
  everyone((c) => { D.act(c, 'idle'); D.expr(c, 'determined'); });
  D.path('aaron', [[-9.0, -1.2]], 5.5); D.path('flare', [[-9.4, -2.4]], 5.5); D.path('eric', [[-9.6, -0.2]], 5.5); D.path('leon', [[-10.2, -1.8]], 5.5); D.path('greg', [[-10.4, -0.6]], 5.5);
  D.cam(FIX([-6.2, 1.4, -5.2], [-10, 1.2, 1.5], { fov: 54 })); D.wait(1.6);
  everyone((c) => { D.faceTo(c, 0, -2, 0.4); D.act(c, 'panting'); }, ['eric', 'greg']);
  D.act('aaron', 'idle'); D.faceTo('aaron', 0, -2, 0.3);
  D.say('aaron', "Gus's Market is on the other side of the parade. We have to get across.", { cam: R('aaron', 30, 1.7, 0.1), dur: 2.6 });
  D.cam(FIX([-8.4, 1.6, -3.6], [6, 1.6, -2], { pos2: [-8.4, 1.6, -3.0], fov: 54 }));
  D.set('float1.z', -16); D.anim('float1.z', 10, 9, 0, 'linear');
  D.sound('The giant pumpkin float rolls past, right in front of them', 2.4, 0.1); D.wait(2.6);
  D.act('eric', 'cheerJump'); D.expr('eric', 'grin');
  D.say('eric', 'Ooooh! A GIANT PUMPKIN! Can we stay and watch? Just for a minute?', { cam: R('eric', 25, 1.7, 0.1), dur: 2.4 });
  D.faceChar('flare', 'eric', 0.3);
  D.say('flare', 'Eric. Turkey. Focus.', { cam: R('flare', 25, 1.7, 0.1), expr: 'annoyed', dur: 1.2 });
  D.act('eric', 'idle'); D.expr('eric', 'determined');
  D.say('eric', 'Right. Turkey. Focusing.', { cam: R('eric', 25, 1.7, 0.1), dur: 1.2 });
  D.say('leon', "We can't stop the parade. People have been waiting all year for this.", { cam: R('leon', 25, 1.7, 0.1), dur: 2.6 });
  D.say('flare', 'Then we go around the floats. Wait for a gap...', { cam: R('flare', 25, 1.7, 0.1), dur: 2.0 });
  everyone((c) => D.act(c, 'ready'), ['aaron', 'flare', 'eric', 'leon']); D.act('greg', 'idle');
  D.wait(0.5);
  D.say('flare', 'NOW!', { cam: R('flare', 15, 1.2, 0.05, { fov: 40 }), dur: 0.8 });
  // they dash across between the floats; Greg flies over
  D.set('float1.z', 9); D.set('float2.z', -24); D.anim('float2.z', -10, 6, 0, 'linear');
  for (const [c, x, z] of [['aaron', 11, -1.4], ['flare', 11, -2.4], ['eric', 11.4, -0.4], ['leon', 11.6, -1.9]]) D.path(c, [[x, z]], 6.0, 0.1);
  D.act('greg', 'fly'); fly('greg', 11, 3, -1, 2.2, 0.3, 'inout'); D.face('greg', P / 2, 0.3);
  D.sfx('whoosh', 0.3, 0.6); D.sfx('crowdWow', 0.6, 0.4);
  D.cam(FIX([0, 0.6, 9], [0, 1.2, -2], { pos2: [0, 0.8, 7], fov: 60 })); D.wait(2.4);
  D.act('greg', 'idle'); D.anim('greg.y', 0, 0.4); D.set('greg.y', 0, 0.4);
  everyone((c) => { D.act(c, 'idle'); D.faceTo(c, 0, -10, 0.4); });
  D.say('eric', 'We made it! That was easy!', { cam: R('eric', 30, 1.7, 0.1), expr: 'grin', dur: 1.6 });
  // the balloon breaks loose
  D.set('balloon.loose', 1); D.sfx('glassCrack', 0, 0.6); D.sfx('whoosh', 0, 0.8); D.sfx('wind', 0, 0.6);
  D.anim('balloon.x', 6, 3.0, 0, 'inout'); D.anim('balloon.y', 9, 3.0); D.anim('balloon.z', -6, 3.0); D.anim('balloon.rz', -0.35, 3.0);
  D.cam(FIX([2, 1.6, 8], [3, 7.5, -10], { pos2: [2, 1.8, 7], fov: 58 }));
  D.sound('SNAP! A gust of wind rips the giant turkey balloon loose', 2.6, 0.1); D.wait(2.4);
  D.set('crowd.cheer', 0); D.sfx('citizensPanic', 0, 0.4);
  D.place('kid1', 9.4, -6.2, -P / 2); D.place('kid2', 9.4, -5.4, -P / 2); D.place('rose', 10.0, -5.9, -P / 2);
  D.act('kid1', 'gasp'); D.expr('kid1', 'scared'); D.act('kid2', 'gasp'); D.expr('kid2', 'scared'); D.expr('rose', 'worried');
  D.say('kid2', "The turkey balloon! It's going to hit the buildings!", { cam: R('kid2', 30, 1.3, 0.0, { lookY: 0.15, fov: 40 }), dur: 2.2 });
  D.say('aaron', "We can't just leave. Greg, grab the ropes! Leon, anchor it!", { cam: R('aaron', 25, 1.6, 0.1), expr: 'determined', dur: 2.4 });
  D.say('greg', 'On it!', { cam: R('greg', 25, 1.5, 0.1), expr: 'determined', dur: 0.9 });
  D.act('greg', 'fly'); fly('greg', 6, 5.2, -3.6, 1.2, 0, 'inout'); D.sfx('whoosh', 0, 0.7);
  D.cam(FIX([8, 2.0, 6], [6, 6.5, -6], { fov: 58 })); D.wait(1.4);
  D.act('greg', 'stretchBoth'); D.set('greg.stretch', 0); D.anim('greg.stretch', 1, 0.5); D.sfx('stretchBoing', 0, 0.8);
  for (const sd of ['L', 'R']) { D.set(`greg.t${sd}x`, sd === 'L' ? 5.2 : 6.8); D.set(`greg.t${sd}y`, 5.4); D.set(`greg.t${sd}z`, -5.8); }
  D.sound('Greg stretches his arms and grabs two of the ropes', 2.0, 0.1); D.wait(2.0);
  D.anim('greg.x', 7.5, 1.6); D.anim('greg.y', 6.4, 1.6); D.shake(0.2, 1.0);
  D.say('greg', "Whoa, whoa! This thing is STRONG! It's pulling me away!", { cam: R('greg', 30, 2.2, 0.0, { lookY: 0.1, fov: 46 }), expr: 'scared', dur: 2.2 });
  D.place('leon', 6.2, -1.8, P); D.act('leon', 'tugS2'); D.expr('leon', 'determined');
  D.say('leon', "I've got you, Greg! Hold on!", { cam: R('leon', 30, 1.8, 0.2, { lookY: 0.2 }), dur: 1.6 });
  D.sound('Leon grabs the last ropes and digs in his heels', 2.0, 0.1);
  D.anim('balloon.x', 4.0, 3.0); D.anim('balloon.y', 6.0, 3.0); D.anim('balloon.z', -5, 3.0); D.anim('balloon.rz', 0, 3.0); D.anim('greg.x', 5, 3.0); D.anim('greg.y', 4.6, 3.0);
  for (const sd of ['L', 'R']) { D.anim(`greg.t${sd}x`, sd === 'L' ? 3.2 : 4.8, 3.0); D.anim(`greg.t${sd}y`, 4.4, 3.0); D.anim(`greg.t${sd}z`, -4.8, 3.0); }
  D.cam(FIX([10, 1.2, 4], [4.5, 3.5, -4], { pos2: [9, 1.4, 3.4], fov: 60 })); D.sfx('rumble', 0, 0.4); D.wait(2.6);
  D.say('aaron', 'Pull it back to the middle of the street!', { cam: R('aaron', 25, 1.6, 0.1, { lookY: 0.2 }), dur: 1.8 });
  D.anim('balloon.x', 0, 2.4); D.anim('balloon.y', 7, 2.4); D.anim('balloon.z', -6, 2.4); D.anim('greg.x', 1.2, 2.4); D.anim('greg.y', 4.0, 2.4);
  for (const sd of ['L', 'R']) { D.anim(`greg.t${sd}x`, sd === 'L' ? -0.8 : 0.8, 2.4); D.anim(`greg.t${sd}y`, 5.4, 2.4); D.anim(`greg.t${sd}z`, -5.2, 2.4); }
  D.cam(FIX([-6, 2.0, 8], [1, 5, -6], { fov: 58 })); D.wait(2.2);
  D.set('balloon.loose', 0); D.anim('greg.stretch', 0, 0.4); D.act('greg', 'hover'); fly('greg', 1.2, 0, -0.6, 1.0, 0.4); D.act('greg', 'idle', 1.4);
  D.act('leon', 'idle'); D.set('crowd.cheer', 1); D.sfx('crowdCheer', 0, 0.7); D.sfx('applause', 0.4, 0.5);
  D.sound('The balloon floats back into place. The whole crowd cheers', 2.4, 0.1); D.wait(2.6);
  D.act('kid1', 'cheerJump'); D.act('kid2', 'cheerJump'); D.expr('kid1', 'grin'); D.expr('kid2', 'grin'); D.expr('rose', 'happy'); D.act('rose', 'clap');
  D.say('kid1', 'Thank you, Battle Wars!', { cam: R('kid1', 30, 1.4, 0.0, { lookY: 0.15, fov: 40 }), dur: 1.4 });
  D.say('rose', 'Such polite young heroes. Happy Thanksgiving, dears!', { cam: R('rose', 30, 1.5, 0.05, { fov: 40 }), dur: 2.2 });
  D.place('aaron', 9.0, -1.2, P / 2); D.place('flare', 9.2, -2.2, P / 2); D.place('eric', 8.6, -0.2, P / 2); D.place('leon', 7.6, -1.8, P / 2); D.place('greg', 8.0, -0.8, P / 2);
  everyone((c) => { D.act(c, 'idle'); D.expr(c, 'happy'); D.faceTo(c, 10, -5.8, 0.3); });
  D.act('aaron', 'wave');
  D.say('aaron', 'Happy Thanksgiving! Sorry, we have to run!', { cam: R('aaron', 25, 1.7, 0.1), dur: 1.8 });
  D.act('aaron', 'idle');
  clock(9 * 60 + 20, 9 * 60, 8);
  D.say('flare', "Aaron. We just lost almost four minutes.", { cam: R('flare', 25, 1.7, 0.1), expr: 'worried', dur: 1.8 });
  D.say('aaron', 'Then we run faster. GO!', { cam: R('aaron', 15, 1.4, 0.05), expr: 'determined', dur: 1.2 });
  for (const c of TEAM) D.path(c, [[10.5, -12]], 6.5);
  D.cam(FIX([9, 1.0, 2], [10.5, 1.0, -10], { fov: 54 })); D.wait(1.6);
  // a quick run through the streets, the clock ticking
  // Greg tries to speed things up
  D.location('avenue'); cast([...TEAM]); clock(8 * 60 + 30, 8 * 60, 20); D.set('crowd.cheer', 0.3);
  D.place('aaron', 10.4, -20, P); D.place('flare', 9.6, -20.8, P); D.place('eric', 11.0, -21.4, P); D.place('leon', 10.0, -22, P); D.place('greg', 9.0, -21.6, P);
  everyone((c) => { D.act(c, 'idle'); D.expr(c, 'determined'); });
  D.say('greg', 'This is taking too long. Eric, hop on. I will fly you there!', { cam: R('greg', 25, 1.7, 0.1), dur: 2.2 });
  D.expr('eric', 'scared');
  D.say('eric', 'Wait, wait! The last time you flew me, we landed in a dumpster!', { cam: R('eric', 25, 1.7, 0.1), dur: 2.4 });
  D.act('greg', 'fly'); D.set('greg.y', 0); fly('greg', 10.2, 3.5, -30, 1.6, 0.2, 'in');
  D.act('eric', 'flailS2'); D.set('eric.y', 0); fly('eric', 10.6, 3.0, -29.6, 1.6, 0.25, 'in'); D.face('eric', P, 0.2);
  D.sfx('whoosh', 0.2, 0.7);
  D.cam(FIX([8, 1.4, -15], [10.4, 2.2, -26], { fov: 52 }));
  D.say('eric', 'AAAAAAHHHH!', { dt: 0.3, dur: 1.4 });
  D.sound('Greg zooms off with Eric dangling under him', 1.8, 0.1); D.wait(1.4);
  D.hide('greg'); D.hide('eric');
  D.say('leon', '...Well. At least two of us will get there fast.', { cam: R('leon', 25, 1.7, 0.1), expr: 'tired', dur: 2.0 });
  D.say('flare', 'Come on. Race you.', { cam: R('flare', 25, 1.7, 0.1), expr: 'smug', dur: 1.2 });
  D.location('marketExt'); cast([...TEAM]); clock(6 * 60 + 40, 6 * 60, 12);
  D.place('aaron', -30, 6, P / 2); D.place('flare', -31.2, 7, P / 2); D.place('eric', -32, 5.6, P / 2); D.place('leon', -32.6, 6.8, P / 2); D.place('greg', -31.6, 8.2, P / 2);
  for (const c of TEAM) D.path(c, [[-4 + (c === 'flare' ? -1 : 0), 6 + (c === 'greg' ? 1.5 : 0)]], 7.5);
  D.cam(FIX([-14, 0.6, 10], [-20, 1.0, 6], { pos2: [-8, 0.6, 10], fov: 56 })); D.sfx('whoosh', 1.0, 0.5);
  D.wait(2.6);
  everyone((c) => D.path(c, [[pos(c, 0)[0] * 0.2, -8.6 - (c === 'greg' ? 0.6 : 0) + (c === 'eric' ? 0.4 : 0)]], 6.0));
  D.cam(FIX([0, 1.6, 4], [0, 2.2, -11], { fov: 54 })); D.wait(2.4);
  everyone((c) => { D.act(c, 'panting'); D.expr(c, 'tired'); }, ['eric', 'greg']);
  D.anim('fade', 1, 0.3); D.wait(0.3);

  // =====================================================================================================================
  D.scene("3. Gus's Market");
  D.location('marketExt'); cast([...TEAM]); D.anim('fade', 0, 0.3);
  D.music('store', 0.3, 0, 0.8);
  clock(5 * 60 + 40, 5 * 60 + 25, 15);
  D.place('aaron', 0.4, -8.6, P); D.place('flare', -0.8, -8.4, P); D.place('eric', 1.4, -8.2, P); D.place('leon', -1.6, -8.0, P); D.place('greg', 0.2, -7.6, P);
  everyone((c) => { D.act(c, 'idle'); D.expr(c, 'determined'); });
  D.act('eric', 'panting'); D.act('greg', 'panting');
  D.cam(FIX([0, 3.2, 2], [0, 3.8, -11], { pos2: [0, 2.6, -1], fov: 56 }));
  D.card('location', 3.2, { text: "GUS'S MARKET - 2:54 PM" });
  D.sound("They skid to a stop in front of Gus's Market", 2.2, 0.1); D.wait(2.6);
  D.say('greg', "I... ran... the whole way. I'm going to need SO much turkey.", { cam: R('greg', 25, 1.6, 0.1), expr: 'tired', dur: 2.4 });
  D.say('flare', 'You FLEW half the way.', { cam: R('flare', 25, 1.7, 0.1), expr: 'annoyed', dur: 1.2 });
  D.set('mkt.door', 0); D.anim('mkt.door', 1, 0.6); D.sfx('autoDoor', 0, 0.6);
  for (const c of TEAM) D.path(c, [[pos(c)[0] * 0.4, -12]], 4.5);
  D.cam(FIX([3.4, 1.4, -6.5], [0, 1.4, -11], { fov: 52 })); D.wait(1.4);
  // inside: busy shoppers and Gus at the register
  D.location('market'); cast([...TEAM, 'gus', ...SHOP, 'rose', 'kid1', 'kid2']);
  D.set('mkt.door', 1); D.anim('mkt.door', 0, 0.8, 1.4); D.set('mkt.cans', 0); D.set('mkt.spill', 0);
  D.place('gus', -7.4, 4.5, P / 2); D.act('gus', 'leanTable'); D.expr('gus', 'annoyed');
  D.place('shop1', -3.6, 1.0, P); D.act('shop1', 'pushCart'); D.set('cart1.vis', 1);
  D.place('shop2', 3.6, -1.5, 0); D.place('shop3', 4.2, 4.8, -P / 2); D.place('shop4', -0.4, -4.5, P); D.place('shop5', 2.4, 3.8, P / 2); D.place('shop6', 5.6, 6.0, P);
  D.place('rose', -1.6, 4.4, P / 2); D.place('kid1', -1.2, 5.0, P * 0.7); D.place('kid2', -2.0, 5.1, P * 0.6);
  D.act('kid1', 'idle'); D.act('kid2', 'idle'); D.expr('rose', 'happy');
  D.path('shop1', [[-3.6, -3]], 1.2); D.path('shop2', [[3.6, 2]], 1.1); D.path('shop5', [[5.0, 3.8]], 1.0);
  D.place('aaron', 0.3, 7.3, P); D.place('flare', -0.6, 7.6, P); D.place('eric', 0.9, 7.8, P); D.place('leon', -1.1, 8.0, P); D.place('greg', 0.0, 8.1, P);
  everyone((c) => D.path(c, [[pos(c)[0] * 1.2, pos(c)[1] - 1.8]], 2.2));
  D.cam(FIX([2.6, 3.0, -4], [0, 1.0, 6], { pos2: [2.2, 2.6, -3], fov: 58 }));
  D.sound('Gus\'s Market is packed with last-minute shoppers', 2.4, 0.1); D.wait(2.6);
  D.say('gus', "Welcome to Gus's Market! Store closes in FIVE minutes. No exceptions!", { cam: R('gus', 25, 1.7, 0.1), expr: 'annoyed', dur: 2.6 });
  D.act('gus', 'idle');
  D.place('greg', -5.9, 6.4, P / 2); D.act('greg', 'reach'); D.expr('greg', 'happy'); D.sfx('bagRustle', 0.3, 0.5);
  D.cam(FIX([-4.6, 1.5, 7.6], [-6.8, 1.1, 5.6], { fov: 50 }));
  D.sound('Greg grabs a candy bar from the rack', 1.8, 0.1); D.wait(1.6);
  D.say('gus', 'You gonna pay for that, Mister Trench Coat?', { cam: R('gus', 25, 1.6, 0.1), expr: 'annoyed', dur: 1.8 });
  D.act('greg', 'shrug');
  D.say('greg', '...Put it on Leon\'s tab.', { cam: R('greg', 25, 1.6, 0.1), expr: 'smug', dur: 1.3 });
  D.act('greg', 'idle'); D.place('greg', 0.0, 6.3, P);
  D.path('aaron', [[-5.4, 5.0]], 2.0); D.path('flare', [[-4.6, 5.6]], 2.0); D.path('leon', [[-4.9, 4.4]], 2.0); D.path('eric', [[-4.0, 5.0]], 2.0); D.path('greg', [[-4.2, 6.0]], 2.0);
  D.wait(1.3);
  everyone((c) => D.faceChar(c, 'gus', 0.3));
  D.say('aaron', 'Hi, Gus! Happy Thanksgiving! Please tell me you still have a turkey.', { cam: R('aaron', 30, 1.7, 0.1), expr: 'happy', dur: 2.6 });
  D.act('gus', 'point');
  D.say('gus', 'Just one left. Back freezer, under the big sign.', { cam: R('gus', 25, 1.6, 0.1), expr: 'neutral', dur: 2.0 });
  D.act('gus', 'idle');
  D.say('gus', "But I wouldn't celebrate yet, kids. You're not the only ones who want it.", { expr: 'smug', dur: 2.6 });
  // everyone in the store hears it
  D.sound('The whole store goes quiet', 1.8); D.wait(0.1);
  for (const c of [...SHOP]) { D.stop(c); D.act(c, 'idle'); D.expr(c, 'surprised'); D.faceChar(c, 'aaron', 0.4); }
  D.set('cart1.vis', 1);
  D.music('store', 0, 0, 0.3); D.sfx('cricket', 0.2, 0.3);
  D.cam(R('shop1', 10, 1.1, 0.0, { fov: 38 })); D.wait(0.9);
  D.cam(R('shop2', 10, 1.1, 0.0, { fov: 38 })); D.wait(0.9);
  D.cam(R('shop5', 10, 1.1, 0.0, { fov: 38 })); D.wait(0.9);
  everyone((c) => D.expr(c, 'determined'));
  D.cam(R('aaron', 0, 0.9, 0.0, { fov: 34 })); D.wait(0.9);
  D.sound('Everyone looks at the sign that says FRESH TURKEYS', 1.8);
  D.cam(FIX([0, 1.4, 2.8], [0, 2.4, -11], { fov: 40, pos2: [0, 1.6, 0.5] })); D.wait(1.6);
  D.say('shop1', "THAT TURKEY IS MINE!", { cam: R('shop1', 15, 1.4, 0.05), expr: 'angry', act: 'yell', dur: 1.4 });

  // =====================================================================================================================
  D.scene('4. The Turkey Battle');
  D.music('action', 0.42, 0, 0.3);
  clock(4 * 60 + 50, 4 * 60 + 50, 0.01); const battleT0 = D.now;
  // the mad dash to the back of the store
  for (const c of SHOP) D.act(c, 'idle');
  D.act('shop1', 'pushCart'); D.set('cart1.vis', 1);
  D.path('shop1', [[-3.6, -8.6], [-0.9, -9.5]], 5.2);
  D.path('shop2', [[3.6, -8.6], [0.9, -9.5]], 5.0);
  D.path('shop5', [[3.6, 3.5], [3.6, -7.5]], 3.0); D.path('shop3', [[3.2, 2.5], [3.0, -6.6]], 4.0); D.path('shop4', [[0.4, -6.4]], 2.8); D.path('shop6', [[4.2, 3.2], [4.2, -5.0]], 4.0);
  D.path('aaron', [[-1.0, 4.0], [0, 2.6], [0.0, -7.0]], 6.0, 0.4); D.path('flare', [[-0.6, 4.4], [0.4, 2.6], [0.5, -6.6]], 6.0, 0.4); D.path('leon', [[-1.6, 3.8], [-0.4, 2.6], [-0.5, -6.4]], 6.0, 0.5);
  D.path('eric', [[-2.4, 3.9], [-1.2, 3.6], [0.2, 2.6], [0.1, -6.0]], 6.0, 0.4); D.path('greg', [[-1.4, 4.6], [0.6, 3.0], [0.6, -5.6]], 5.6, 0.6);
  D.sfx('stampede', 0, 0.5); D.sfx('whoosh', 0.4, 0.5);
  D.cam(FIX([-6.4, 1.2, 3.0], [-2, 1.0, 3.6], { fov: 56 })); D.wait(0.9);
  D.set('mkt.cans', 0); D.anim('mkt.cans', 1, 1.6, 0.1, 'linear'); D.act('eric', 'stumble', 0.1);
  D.sfx('trashRoll', 0.15, 0.7); for (let i = 0; i < 6; i++) D.sfx('clank', 0.2 + i * 0.18, 0.45);
  D.cam(FIX([-2.8, 0.7, 5.2], [-1.6, 0.4, 3.0], { fov: 54 }));
  D.sound('CLANG! CLANG! CLANG! Eric bumps the can pyramid and it crashes down', 2.6, 0.1); D.wait(1.6);
  D.say('gus', 'WHO KNOCKED OVER MY CANS?!', { cam: R('gus', 20, 1.5, 0.1), act: 'yell', expr: 'angry', dur: 1.4 });
  D.act('gus', 'idle');
  D.say('eric', 'Sorry, Gus! Sorry! I will clean it up later!', { cam: F(['eric'], 160, 2.4, 0.2, { fov: 48 }), expr: 'worried', dur: 1.8 });
  // carts race down the aisles; Flare runs past them
  D.place('flare', 3.0, 1.6, P); D.place('shop2', 4.0, 0.4, P); D.set('cart2.vis', 1); D.set('cart2.x', 4.0); D.set('cart2.z', -0.5); D.set('cart2.ry', P);
  D.act('shop2', 'pushCart'); D.path('shop2', [[4.0, -6.0]], 4.5); D.anim('cart2.z', -7.0, 1.44, 0, 'linear');
  D.path('flare', [[3.2, -1.0], [3.2, -6.4]], 7.5); D.expr('flare', 'determined');
  D.cam(FIX([3.6, 1.0, -8.6], [3.6, 1.0, 0.0], { fov: 52 })); D.sfx('trashRoll', 0, 0.5);
  D.say('flare', 'Excuse me! Coming through! Super speed, coming through!', { dur: 2.0 });
  D.set('cart2.vis', 0);
  // shop1 gets to the freezer first
  D.stop('shop1'); D.place('shop1', -0.6, -9.5, P); D.place('shop2', 1.0, -9.6, P);
  D.set('cart1.x', -2.4); D.set('cart1.z', -8.4); D.set('cart1.ry', 1.4);
  D.set('turkey.vis', 1); D.set('turkey.kind', 'frozen'); D.set('turkey.spin', 0); tk(0.2, 0.92, -10.85); D.set('turkey.ry', 0.3);
  D.cam(FIX([2.6, 1.6, -7.2], [0, 1.0, -10.4], { fov: 48 })); D.wait(1.0);
  D.act('shop1', 'carryBig', 0.2); D.set('turkey.hold', 'shop1.both', 0.4); D.sfx('bagRustle', 0.3, 0.5); D.face('shop1', 0, 0.4, 0.6);
  D.say('shop1', "HA! I got it! This turkey is going home with ME!", { cam: R('shop1', 25, 2.2, 0.2, { lookY: 0.2, fov: 46 }), expr: 'grin', dur: 2.2 });
  D.faceChar('shop2', 'shop1', 0.3); D.act('shop2', 'grabS2'); D.expr('shop2', 'angry');
  D.say('shop2', 'Not so fast! I saw it first!', { cam: R('shop2', 25, 1.7, 0.1), dur: 1.6 });
  D.say('shop1', 'You did NOT! I was here first!', { cam: R('shop1', 25, 1.9, 0.2, { lookY: 0.2, fov: 46 }), expr: 'angry', dur: 1.6 });
  D.say('shop2', 'My family has been planning this dinner for MONTHS!', { cam: R('shop2', 25, 1.7, 0.1), dur: 2.0 });
  // tug-of-war
  D.set('turkey.hold', 'none'); tk(0.2, 1.05, -9.45); D.set('turkey.ry', P / 2);
  D.place('shop1', -0.55, -9.5, P / 2); D.place('shop2', 0.95, -9.5, -P / 2); D.act('shop1', 'tugS2'); D.act('shop2', 'tugS2');
  for (let i = 0; i < 6; i++) D.anim('turkey.x', 0.2 + (i % 2 ? 0.12 : -0.12), 0.35, i * 0.4);
  D.sfx('groan', 0, 0.4);
  D.cam(FIX([1.9, 1.7, -8.1], [0.2, 1.0, -9.6], { fov: 48 }));
  D.sound('A tug-of-war! Pulling, grunting, nobody lets go', 2.4, 0.1); D.wait(2.4);
  D.place('aaron', -0.2, -7.6, P); D.place('flare', 0.8, -7.4, P); D.place('leon', -1.2, -7.2, P); D.place('eric', 1.6, -7.0, P); D.place('greg', 0.4, -6.6, P);
  everyone((c) => D.act(c, 'idle'));
  D.say('aaron', "Hey! Please, let's all calm down and...", { cam: FIX([2.4, 1.7, -9.2], [-0.2, 1.4, -7.6], { fov: 46 }), expr: 'worried', act: 'stopS2', dur: 1.8 });
  // it pops loose and flies
  D.act('shop1', 'tumble'); D.act('shop2', 'tumble'); D.anim('shop1.x', -1.3, 0.4); D.anim('shop2.x', 1.7, 0.4); D.sfx('bonk', 0, 0.6);
  D.set('turkey.spin', 3); tkArc(0, 0.12, -5.8, 1.1, 2.4); D.sfx('whoosh', 0, 0.7);
  everyone((c) => { D.expr(c, 'shocked'); D.act(c, 'lookUp'); });
  D.cam(FIX([-0.9, 0.8, -3.8], [0, 2.0, -8], { fov: 58 })); D.wait(0.9);
  D.act('shop4', 'gasp', 0); D.place('shop4', 0.6, -4.8, P); D.set('mkt.spill', 0); D.set('spill.x', 0); D.set('spill.z', -4.2); D.anim('mkt.spill', 1, 0.3); D.sfx('slimeSplat', 0, 0.6);
  // it slides along the cranberry sauce
  D.set('turkey.spin', 1.5); tk(0, 0.12, -1.2, 1.6, 0, 'out');
  D.sound('SPLAT! A jar of cranberry sauce smashes, and the turkey slides across it', 2.6, 0.2);
  D.cam(FIX([0.9, 0.4, 0.2], [0, 0.2, -4], { fov: 54 })); D.wait(1.6);
  D.set('turkey.spin', 0); D.set('turkey.rz', 0); D.set('turkey.rx', 0);
  // everybody chases it and slips
  D.place('shop3', 0.6, -7.2, 0); D.place('shop6', -0.8, -7.8, 0); D.place('greg', 0.0, -7.0, 0);
  D.path('greg', [[0.1, -4.4]], 5.0); D.path('shop3', [[0.7, -4.6]], 5.0); D.path('shop6', [[-0.5, -4.2]], 5.0, 0.1);
  D.act('greg', 'slipS2', 0.55); D.act('shop3', 'slipS2', 0.65); D.act('shop6', 'slipS2', 0.6);
  D.act('greg', 'lieBack', 1.3); D.act('shop3', 'lieSide', 1.3); D.act('shop6', 'lieBack', 1.4);
  D.sfx('slideScrape', 0.6, 0.6); D.sfx('thud', 1.2, 0.7); D.sfx('thud', 1.35, 0.6); D.sfx('crowdLaugh', 1.5, 0.2);
  D.cam(FIX([0.9, 1.3, -1.6], [0, 0.6, -5], { fov: 56 }));
  D.sound('Greg and two shoppers run into the spill... and slip. WHOOOA!', 2.6, 0.2); D.wait(2.4);
  D.say('greg', "I'm okay! The floor is just... really comfortable.", { cam: F(['greg'], 120, 1.6, 0.0, { lookY: -0.6, fov: 44 }), expr: 'tired', dur: 2.0 });
  // the turkey slides into a crowd of shoppers' legs; Eric turns into a cat
  for (const [c, x, z] of [['shop5', -0.4, -0.6], ['shop2', 0.5, -0.4], ['shop1', -0.2, 0.3], ['shop4', 0.6, 0.6]]) { D.place(c, x, z, P * (x > 0 ? 0.8 : 1.2)); D.act(c, 'reach'); D.expr(c, 'determined'); }
  tk(0.05, 0.12, -0.1, 0.5, 0, 'out');
  D.sound('Four shoppers crowd around the turkey, pushing and shoving', 2.2, 0.1);
  D.cam(FIX([0.95, 1.9, -3.4], [0, 0.4, 0], { fov: 52 })); D.wait(1.6);
  D.place('eric', 0.2, -2.8, 0); D.act('eric', 'idle'); D.expr('eric', 'determined');
  D.say('eric', "Too many legs. You can't get through there... unless you're small. Like a CAT!", { cam: R('eric', 25, 1.6, 0.1), dur: 2.8 });
  D.set('flashWhite', 0.5); D.anim('flashWhite', 0, 0.4); D.sfx('transform', 0, 0.9); D.fx('smoke', { x: 0.2, y: 0.6, z: -2.8, n: 18, dur: 1.0, color: 0xffffff, color2: 0xd0d0ff });
  D.hide('eric', 0.05); D.place('cat', 0.2, -2.8, 0, 0.05); D.set('cat.act', 'idle', 0.05);
  D.cam(F(['cat'], 160, 1.6, 0.6, { lookY: -0.3, fov: 42 })); D.sound('POOF! Eric turns into a small orange cat', 2.0, 0.1); D.wait(1.8);
  D.set('cat.act', 'run'); D.path('cat', [[0.5, -1.4], [-0.3, -0.9], [0.4, -0.5], [0.1, -0.15]], 3.0); D.sfx('meow', 0.2, 0.6);
  D.cam(FIX([-0.95, 0.35, -2.9], [0.1, 0.2, -0.4], { pos2: [-0.8, 0.32, -2.1], fov: 52 }));
  D.sound('The cat zigzags between everyone\'s legs', 2.0, 0.1); D.wait(1.8);
  D.set('cat.act', 'idle'); D.set('turkey.spin', 0); tk(0.1, 0.12, -3.6, 0.9, 0, 'out'); D.face('cat', P, 0.3);
  D.place('aaron', 0.1, -4.6, 0); D.act('aaron', 'catchItem', 0.6); D.set('turkey.hold', 'aaron.both', 0.9); D.act('aaron', 'carryS2', 1.0); D.expr('aaron', 'grin');
  D.sfx('meow', 0, 0.6); D.sfx('slide', 0.1, 0.5); D.sfx('catchPlate', 0.9, 0.6);
  D.cam(FIX([0.9, 0.9, -5.4], [0, 0.6, -2.6], { fov: 52 })); D.sound('He pushes the turkey back out with his head... right to Aaron!', 2.6, 0.2); D.wait(2.4);
  D.say('aaron', 'Nice work, Eric!', { cam: R('aaron', 25, 1.8, 0.1), dur: 1.0 });
  D.set('cat.act', 'meow'); D.say('eric', 'Meow! I mean... you\'re welcome!', { cam: F(['cat'], 160, 1.3, 0.2, { lookY: -0.2, fov: 42 }), dur: 1.6 });
  D.set('flashWhite', 0.4); D.anim('flashWhite', 0, 0.3); D.sfx('transform', 0, 0.6); D.set('cat.vis', 0); D.place('eric', 0.1, -3.2, P); D.expr('eric', 'happy');
  // the tipping shelf: Leon to the rescue
  for (const c of SHOP) D.act(c, 'idle');
  D.place('shop1', 3.0, -3.0, -P / 2); D.act('shop1', 'pushCart'); D.set('cart1.x', 2.6); D.set('cart1.z', -3.0); D.set('cart1.ry', -P / 2);
  D.place('kid1', -0.4, -4.4, P / 2); D.place('kid2', -0.3, -5.0, P / 2); D.expr('kid1', 'neutral'); D.expr('kid2', 'neutral'); D.act('kid1', 'idle'); D.act('kid2', 'idle');
  D.place('leon', -1.0, -1.6, P); D.act('leon', 'idle');
  D.anim('cart1.x', 2.1, 0.3); D.sfx('metalCrash', 0.25, 0.8); D.shake(0.4, 0.5, 0.25);
  D.anim('mkt.tip', 0.5, 0.9, 0.3, 'in');
  D.cam(FIX([-1.0, 2.6, -1.2], [0.8, 1.2, -4.6], { fov: 56 }));
  D.sound('CRASH! A cart slams into the shelf, and it starts to tip... right over two kids!', 2.8, 0.1); D.wait(1.0);
  D.act('kid1', 'jumpScare'); D.act('kid2', 'jumpScare'); D.expr('kid1', 'scared'); D.expr('kid2', 'scared');
  D.say('rose', 'MY GRANDBABIES!', { label: 'GRANDMA ROSE', cam: FIX([-0.4, 1.2, 1.5], [-0.4, 1.0, -4.6], { fov: 44 }), dur: 1.0, gap: 0.1 });
  D.path('leon', [[-0.1, -4.7]], 7.5); D.act('leon', 'blockPipe', 0.3); D.expr('leon', 'determined');
  D.set('mkt.tip', 0.5); D.anim('mkt.tip', 0.36, 0.3, 0.35, 'out'); D.sfx('punchHit', 0.4, 0.7); D.shake(0.3, 0.3, 0.4);
  D.cam(FIX([-0.95, 0.9, -6.8], [0.4, 1.4, -4.4], { fov: 54 })); D.wait(1.6);
  D.say('leon', "I've got it! Kids, step out of the aisle. Slowly.", { cam: R('leon', 40, 1.8, 0.3, { lookY: 0.2 }), dur: 2.2 });
  D.path('kid1', [[-0.4, -8.2]], 2.0); D.path('kid2', [[0.3, -8.4]], 2.0);
  D.wait(1.2);
  D.anim('mkt.tip', 0, 1.0); D.act('leon', 'pushHeat'); D.sfx('rumble', 0, 0.4); D.sfx('clunk', 1.0, 0.7);
  D.cam(FIX([-3.0, 1.6, -1.0], [0.8, 1.2, -4.8], { fov: 54 })); D.sound('Leon pushes the whole shelf back up with one heave', 2.2, 0.1); D.wait(1.6);
  D.act('leon', 'idle'); D.sfx('crowdWow', 0, 0.5);
  D.say('shop1', "Whoa. You're really strong. I'm... gonna let go of this cart now.", { cam: R('shop1', 25, 1.7, 0.1), expr: 'scared', act: 'shrug', dur: 2.6 });
  D.act('shop1', 'idle');
  D.place('rose', -1.0, -7.6, 0); D.place('kid1', -0.6, -8.0, 0); D.place('kid2', 0.1, -8.2, 0); D.expr('rose', 'happy'); D.act('rose', 'heartS2');
  D.say('rose', 'Oh, thank you, young man! You saved my grandbabies!', { cam: R('rose', 30, 1.6, 0.05, { fov: 42 }), dur: 2.2 });
  D.faceChar('leon', 'rose', 0.3); D.expr('leon', 'happy');
  D.say('leon', 'Anytime, ma\'am. Everyone okay?', { cam: R('leon', 25, 1.7, 0.1), dur: 1.4 });
  D.act('rose', 'idle');
  D.hide('rose'); D.hide('kid1'); D.hide('kid2');
  // the old man grabs the turkey from Aaron, Greg's arm stretches across the store, flour everywhere
  D.place('shop5', 0.9, -4.0, -P / 2); D.place('aaron', 0.1, -4.2, P / 2); D.act('aaron', 'carryS2');
  D.act('shop5', 'grabS2'); D.set('turkey.hold', 'shop5.both', 0.3); D.act('aaron', 'gasp', 0.3); D.expr('aaron', 'shocked');
  D.say('shop5', "Excuse me, young man! I'll be taking THAT, thank you!", { cam: R('shop5', 25, 1.6, 0.1), expr: 'mischief', dur: 2.2 });
  D.act('shop5', 'carryS2'); D.path('shop5', [[3.6, -4.0], [3.6, 2.4], [2.0, 3.8]], 3.6);
  D.act('aaron', 'idle'); D.expr('aaron', 'worried');
  D.cam(FIX([3.6, 1.5, 3.3], [3.6, 1.2, -4], { fov: 50 })); D.sound('The old man takes off with the turkey... surprisingly fast', 2.4, 0.1); D.wait(2.2);
  D.place('greg', 0.0, 3.4, P / 2); D.act('greg', 'stretchReach'); D.expr('greg', 'determined');
  D.say('greg', 'Oh no you don\'t, grandpa!', { cam: R('greg', 25, 1.7, 0.1), dur: 1.4 });
  D.set('greg.stretch', 0); D.set('greg.tRx', 3.4); D.set('greg.tRy', 1.0); D.set('greg.tRz', 2.0); D.anim('greg.stretch', 1, 0.45); D.sfx('stretchBoing', 0, 0.8);
  D.set('turkey.hold', 'none', 0.45); tk(3.3, 0.9, 2.1, 0, 0.45);
  D.anim('greg.tRx', 1.0, 0.6, 0.6); D.anim('greg.tRz', 3.2, 0.6, 0.6); tk(0.95, 0.9, 3.25, 0.6, 0.6);
  D.act('shop5', 'gasp', 0.5); D.stop('shop5', 0.5);
  D.cam(FIX([1.6, 2.2, 6.8], [1.8, 0.9, 2.6], { fov: 56 })); D.sound('BOING! Greg\'s arm stretches across the store and snatches the turkey back', 2.6, 0.1); D.wait(1.6);
  D.anim('greg.stretch', 0, 0.3); D.set('turkey.hold', 'greg.R', 0.3); D.act('greg', 'raiseItem', 0.3);
  D.say('greg', 'YOINK!', { cam: R('greg', 25, 1.6, 0.1), expr: 'grin', dur: 0.9 });
  D.place('shop6', 2.6, 4.6, -P * 0.7); D.act('shop6', 'throw'); D.expr('shop6', 'mischief');
  D.say('shop6', 'Have some flour!', { cam: R('shop6', 25, 1.6, 0.1), dur: 1.1 });
  D.fx('smoke', { x: 0.2, y: 1.4, z: 3.5, n: 40, dur: 2.2, color: 0xffffff, color2: 0xf2f2f2 }, 0.3); D.sfx('blanket', 0.3, 0.7);
  D.act('greg', 'flailS2', 0.4); D.expr('greg', 'shocked', 0.4);
  D.cam(FIX([-1.8, 1.4, 6.4], [0.2, 1.3, 3.4], { fov: 52 })); D.sound('POOF! A cloud of flour explodes all over Greg', 2.0, 0.2); D.wait(1.4);
  D.say('greg', 'Ah... ah... AH-CHOO!', { dur: 1.4 });
  D.set('turkey.hold', 'none'); D.set('turkey.spin', 2.5); tk(0.3, 1.9, 3.4); tkArc(0.2, 3.4, 1.0, 1.0, 1.4); D.sfx('whoosh', 0, 0.6);
  D.act('greg', 'idle');
  D.cam(FIX([0.4, 1.2, 5.4], [0.2, 3.0, 0.8], { fov: 54 })); D.wait(0.9);
  // everyone runs at the falling turkey... Flare: FREEZE!
  for (const [c, x, z] of [['shop1', -2.4, 1.6], ['shop2', 2.6, 0.4], ['shop3', -2.0, -1.6], ['shop4', 2.4, -1.8], ['shop5', 2.8, 2.6], ['shop6', -2.8, 2.4]]) { D.place(c, x, z, Math.atan2(0.2 - x, 1.0 - z)); D.act(c, 'reach'); D.expr(c, 'determined'); D.path(c, [[x * 0.75, 1.0 + (z - 1.0) * 0.75]], 3, 0); }
  D.place('flare', 0.2, -0.6, 0); D.act('flare', 'fireRings'); D.expr('flare', 'determined');
  tk(0.2, 3.0, 1.0, 0, 0); D.anim('turkey.spin', 0.4, 0.3);
  D.fx('flame', { who: 'flare', side: 'R', dur: 4.0, size: 0.45 }); D.fx('flame', { who: 'flare', side: 'L', dur: 4.0, size: 0.45 }); D.sfx('fireRoar', 0, 0.8);
  D.say('flare', 'EVERYBODY... FREEZE!', { cam: R('flare', 20, 1.7, 0.1, { lookY: 0.15, fov: 46 }), dur: 1.4 });
  for (const c of SHOP) { D.stop(c); D.act(c, 'freeze'); D.expr(c, 'scared'); }
  D.say('shop3', "She wouldn't... would she?", { cam: R('shop3', 25, 1.5, 0.1, { fov: 40 }), dur: 1.4 });
  D.say('shop4', "I'm not moving. I'm a statue now.", { cam: R('shop4', 25, 1.5, 0.1, { fov: 40 }), dur: 1.6 });
  D.say('flare', 'Nobody move... or this turkey gets cooked RIGHT NOW.', { cam: FIX([0.2, 2.6, 5.8], [0.2, 1.0, 0.6], { fov: 58 }), dur: 2.4 });
  D.sound('Everyone freezes. The turkey hangs in the air for a second...', 2.4, 0.1); D.wait(0.6);
  tk(0.2, 1.25, -0.2, 1.2, 0, 'in'); D.set('turkey.spin', 0, 1.2);
  D.place('aaron', 0.2, -1.6, 0); D.act('aaron', 'dive', 0.6); D.anim('aaron.z', -0.6, 0.5, 0.6, 'out');
  D.set('turkey.hold', 'aaron.both', 1.2); D.act('aaron', 'hugTurkey', 1.3); D.expr('aaron', 'grin');
  D.cam(FIX([0.9, 0.8, -2.6], [0.2, 1.0, 0], { fov: 50 })); D.sfx('catchPlate', 1.2, 0.7); D.wait(2.0);
  D.say('aaron', 'GOT IT!', { cam: R('aaron', 25, 1.6, 0.1), dur: 1.0 });
  D.say('flare', "...Just so everyone knows, I wasn't really going to do anything. I just wanted everyone to stop.", { cam: R('flare', 25, 1.7, 0.1), act: 'shrug', expr: 'smug', dur: 3.4 });
  for (const c of SHOP) { D.act(c, 'idle'); D.expr(c, 'sad'); }
  D.act('flare', 'idle'); D.sfx('crowdLaugh', 0, 0.3);
  { const el = D.now - battleT0; D.anim('clock.left', 95, el, -el, 'linear'); D.anim('mkt.clock', 60 - 95 / 60, el, -el, 'linear'); }
  clock(1 * 60 + 30, 1 * 60 + 10, 20);
  // Grandma Rose and the kids
  D.music('sad', 0.3, 0, 1.0);
  D.place('rose', 0.3, 4.6, P); D.act('rose', 'idle'); D.expr('rose', 'sad');
  D.place('kid1', -0.5, 4.3, P * 0.85); D.place('kid2', 1.1, 4.3, -P * 0.85); D.expr('kid1', 'sad'); D.expr('kid2', 'sad'); D.act('kid1', 'lookDown'); D.act('kid2', 'idle');
  D.cam(R('rose', 30, 2.4, 0.0, { fov: 44 }));
  D.say('kid2', 'Grandma... does that mean we don\'t get a turkey?', { cam: R('kid2', 30, 1.3, 0.0, { lookY: 0.1, fov: 40 }), dur: 2.0 });
  D.act('rose', 'heartS2');
  D.say('rose', "It's alright, sweetheart. We'll have sandwiches. What matters is that we're together.", { cam: R('rose', 30, 1.5, 0.05, { fov: 40 }), dur: 3.0 });
  D.act('rose', 'idle');
  D.place('aaron', 0.0, 2.0, 0); D.place('flare', -0.7, 1.4, 0); D.place('leon', 0.7, 1.2, 0); D.place('eric', -0.5, 0.6, 0); D.place('greg', 0.6, 0.4, 0);
  everyone((c) => { D.act(c, 'idle'); D.expr(c, 'sad'); D.faceChar(c, 'rose', 0.3); });
  D.act('aaron', 'carryS2');
  D.cam(FIX([0.9, 1.8, -0.8], [0.2, 1.2, 3.6], { fov: 54 })); D.sound('The team hears every word', 1.8, 0.2); D.wait(2.2);
  D.cam(R('aaron', 20, 1.2, 0.05, { lookY: -0.1, fov: 40 }));
  D.sound('Aaron looks down at the turkey in his arms', 2.0, 0.1); D.wait(2.0);
  everyone((c) => D.faceChar(c, 'aaron', 0.3), ['flare', 'leon', 'eric', 'greg']);
  D.say('aaron', 'Guys... are you thinking what I\'m thinking?', { cam: R('aaron', 25, 1.6, 0.1), expr: 'neutral', dur: 1.8 });
  D.say('greg', 'That we should share it?', { cam: R('greg', 25, 1.6, 0.1), expr: 'happy', dur: 1.2 });
  D.say('greg', 'I was actually thinking about pie. But yeah. That too.', { dur: 2.0 });
  D.path('aaron', [[0.2, 3.4]], 1.0); D.face('aaron', P * 0.0, 0.3); D.expr('aaron', 'happy');
  D.say('aaron', "Ma'am? We'd like you to have Thanksgiving with us. At our headquarters. All of you.", { cam: R('aaron', 30, 1.6, 0.1), dur: 3.0 });
  D.expr('rose', 'surprised');
  D.say('rose', 'Oh, my! We couldn\'t possibly...', { cam: R('rose', 30, 1.5, 0.05, { fov: 40 }), dur: 1.6 });
  D.say('eric', 'You HAVE to! We have SO much food. Leon made three pies!', { cam: R('eric', 25, 1.7, 0.1), expr: 'grin', dur: 2.2 });
  D.say('leon', 'Four pies. There is plenty of room at our table.', { cam: R('leon', 25, 1.6, 0.1), expr: 'happy', dur: 2.0 });
  D.act('kid1', 'cheerJump'); D.act('kid2', 'cheerJump'); D.expr('kid1', 'grin'); D.expr('kid2', 'grin'); D.expr('rose', 'happy');
  D.music('chill', 0.32, 0, 1.0);
  D.say('kid1', 'Thanksgiving with REAL superheroes?!', { cam: R('kid1', 30, 1.3, 0.0, { lookY: 0.1, fov: 40 }), dur: 1.6 });
  D.say('rose', 'Well... then we would be honored. Thank you, dears.', { cam: R('rose', 30, 1.5, 0.05, { fov: 40 }), act: 'heartS2', dur: 2.2 });
  D.act('rose', 'idle');
  D.place('shop1', 1.0, 2.8, -P * 0.3); D.act('shop1', 'idle'); D.expr('shop1', 'worried');
  D.say('shop1', "Uh... does that invitation include big guys who started a tug-of-war?", { cam: R('shop1', 25, 1.7, 0.1), dur: 2.4 });
  D.say('leon', '...Sure. Why not!', { cam: R('leon', 25, 1.6, 0.1), expr: 'grin', dur: 1.0 });
  D.sfx('crowdLaugh', 0, 0.3); D.expr('shop1', 'grin');
  D.set('hud.clock', 1);
  D.sfx('alarmBeep', 0, 0.6); clock(25, 20, 5);
  D.say('flare', 'Guys! The CLOCK! We still have to PAY!', { cam: R('flare', 25, 1.6, 0.1), expr: 'shocked', dur: 1.6 });
  // the checkout: just in time
  D.music('action', 0.4, 0, 0.3);
  D.place('gus', -7.4, 4.5, P / 2); D.act('gus', 'idle'); D.expr('gus', 'neutral');
  D.place('aaron', -5.8, 2.6, 0); D.act('aaron', 'carryS2'); D.path('aaron', [[-5.8, 4.6]], 5);
  for (const [c, x, z] of [['flare', -5.0, 3.8], ['leon', -4.6, 4.8], ['eric', -5.0, 5.6], ['greg', -4.2, 6.2]]) D.place(c, x, z, -P / 2);
  clock(18, 3, 15);
  D.cam(FIX([-4.0, 1.6, 2.4], [-6.6, 1.1, 4.8], { fov: 52 })); D.wait(0.8);
  D.set('turkey.hold', 'none'); tk(-6.55, 1.0, 4.9); D.act('aaron', 'idle'); D.faceTo('aaron', -7.4, 4.5, 0.2);
  D.act('gus', 'reach'); D.sfx('scanBeep', 0.3, 0.8);
  D.say('gus', 'One turkey. That\'s twenty-four ninety-nine.', { cam: R('gus', 25, 1.6, 0.1), dur: 1.6 });
  D.act('aaron', 'pay'); D.sfx('register', 0, 0.7);
  D.cam(FIX([-6.0, 1.5, 6.6], [-6.8, 1.1, 4.6], { fov: 42 })); D.wait(1.0);
  D.set('clock.left', 0); D.sfx('doorBell', 0, 0.6); D.sfx('alarmRing', 0, 0.3);
  D.act('gus', 'idle');
  D.say('gus', "...And THAT'S three o'clock. The store is officially closed!", { cam: R('gus', 25, 1.6, 0.1), expr: 'happy', dur: 2.2 });
  D.anim('hud.clock', 0, 0.5); D.set('mkt.closed', 1); D.sfx('clink', 0, 0.4);
  D.say('gus', 'You made it with ZERO seconds to spare. Never seen anything like it.', { dur: 2.4 });
  everyone((c) => { D.act(c, 'cheer'); D.expr(c, 'grin'); }, ['flare', 'leon', 'eric', 'greg']);
  D.set('turkey.hold', 'aaron.both'); D.act('aaron', 'carryS2'); D.expr('aaron', 'grin');
  D.cam(FIX([-3.2, 1.7, 2.2], [-5.6, 1.2, 4.8], { fov: 56 })); D.sfx('crowdCheer', 0, 0.4);
  D.sound('The team cheers', 1.4); D.wait(1.6);
  everyone((c) => D.act(c, 'idle'), ['flare', 'leon', 'eric', 'greg']);
  D.music('chill', 0.3, 0, 1.0);
  D.say('aaron', 'Hey, Gus... what are you doing for Thanksgiving?', { cam: R('aaron', 25, 1.6, 0.1), expr: 'happy', dur: 1.8 });
  D.act('gus', 'shrug'); D.expr('gus', 'sad');
  D.say('gus', 'Me? Same as every year. Lock up, go home, and eat a frozen TV dinner. Alone.', { cam: R('gus', 25, 1.5, 0.1), dur: 3.0 });
  D.act('gus', 'idle');
  everyone((c) => D.faceChar(c, 'gus', 0.3), ['flare', 'leon', 'eric', 'greg']);
  D.say('aaron', 'Not this year.', { label: 'EVERYONE', cam: FIX([-3.6, 1.5, 3.4], [-6.6, 1.3, 4.6], { fov: 50 }), expr: 'grin', dur: 1.2 });
  D.expr('gus', 'surprised');
  D.say('gus', 'You mean... you want ME to come?', { cam: R('gus', 20, 1.3, 0.05, { fov: 40 }), dur: 1.6 });
  D.say('eric', 'Bring pie!', { cam: R('eric', 25, 1.6, 0.1), expr: 'grin', dur: 0.9 });
  D.expr('gus', 'happy'); D.act('gus', 'thumbsUp');
  D.say('gus', 'Heh. You kids are alright. I make a mean pecan pie.', { cam: R('gus', 25, 1.5, 0.1), dur: 2.2 });
  D.act('gus', 'idle');
  D.anim('fade', 1, 0.6); D.wait(0.6);

  // =====================================================================================================================
  D.scene('5. The Big Cook');
  D.location('dining'); cast([...TEAM]); D.anim('fade', 0, 0.5);
  D.music('comedy', 0.32, 0, 1.0); D.set('din.food', 0); D.set('kit.tray', 1); D.set('kit.oven', 0);
  D.card('location', 3.0, { text: 'BATTLE WARS HQ - THE KITCHEN' });
  D.set('turkey.vis', 1); D.set('turkey.kind', 'frozen'); D.set('turkey.hold', 'none'); tk(-1.05, 1.0, -2.8); D.set('turkey.ry', 0); D.set('turkey.spin', 0);
  D.place('leon', -1.6, -1.9, P); props('leon', 'notebook'); D.act('leon', 'readBook'); D.expr('leon', 'thinking');
  D.place('aaron', -0.4, -1.9, P); D.place('flare', 0.5, -2.1, -P * 0.75); D.place('eric', -2.6, -2.0, P * 0.8); D.place('greg', 1.2, -1.2, P);
  everyone((c) => { D.act(c, 'idle'); D.expr(c, 'happy'); }, ['aaron', 'flare', 'eric', 'greg']);
  D.cam(FIX([1.6, 1.9, 1.4], [-1.2, 1.0, -2.8], { pos2: [1.3, 1.8, 1.0], fov: 52 }));
  D.sound('Back at headquarters, the turkey sits on the kitchen island', 2.4, 0.2); D.wait(2.8);
  D.say('leon', 'Okay. The cookbook says a turkey this size needs to roast for... four hours.', { cam: R('leon', 30, 1.5, 0.05, { lookY: -0.1, fov: 40 }), dur: 2.8 });
  D.expr('greg', 'shocked'); D.expr('eric', 'shocked');
  D.say('eric', 'FOUR HOURS?!', { cam: R('eric', 25, 1.5, 0.05), act: 'flailS2', dur: 1.0 });
  D.act('eric', 'idle');
  D.act('greg', 'tumble'); D.act('greg', 'lieBack', 0.9); D.sfx('thud', 0.9, 0.7);
  D.say('greg', 'I will not survive four hours.', { cam: FIX([2.5, 1.9, -0.3], [1.2, 0.2, -1.2], { fov: 46 }), expr: 'tired', dur: 1.8 });
  D.act('flare', 'stretch'); D.expr('flare', 'smug');
  D.say('flare', "Relax. Leave the cooking to me.", { cam: R('flare', 25, 1.6, 0.1), dur: 1.6 });
  D.act('aaron', 'holdDevice'); props('aaron', 'scanner'); D.expr('aaron', 'thinking');
  D.say('aaron', 'Careful, Flare. My thermo-scanner says it has to be exactly 350 degrees. Not one degree hotter.', { cam: R('aaron', 30, 1.5, 0.05, { lookY: -0.1, fov: 40 }), dur: 3.2 });
  D.say('flare', 'Low and slow. Got it.', { cam: R('flare', 25, 1.6, 0.1), dur: 1.2 });
  D.place('flare', -0.9, -2.1, P); D.act('flare', 'conjure'); D.expr('flare', 'determined');
  D.set('turkey.kind', 'roast'); D.set('turkey.s', 1);
  D.fx('fire', { x: -1.05, y: 1.0, z: -2.8, dur: 6.0, size: 0.25 }); D.sfx('flameIgnite', 0, 0.6); D.sfx('fireCrackle', 0.2, 0.4);
  D.cam(FIX([-1.05, 1.6, -4.4], [-1.05, 1.0, -2.8], { pos2: [-1.0, 1.5, -4.2], fov: 46 }));
  D.sound('Soft, steady flames dance around the turkey', 2.4, 0.1); D.wait(2.6);
  D.say('aaron', '348... 349... 350. Perfect. Hold it right there.', { cam: R('aaron', 30, 1.4, 0.0, { lookY: -0.15, fov: 40 }), dur: 2.4 });
  D.act('flare', 'stretch'); D.expr('flare', 'tired');
  D.say('flare', 'This is kind of relaxing, actually... *yawn*', { cam: R('flare', 30, 1.5, 0.05), dur: 1.8 });
  D.fx('fire', { x: -1.05, y: 1.1, z: -2.8, dur: 1.0, size: 0.75 }); D.sfx('fireRoar', 0, 0.7); D.shake(0.2, 0.4);
  D.expr('aaron', 'shocked');
  D.say('aaron', '400! 450! FLARE!', { cam: R('aaron', 20, 1.3, 0.0, { fov: 40 }), act: 'flailS2', dur: 1.2 });
  D.act('flare', 'conjure'); D.expr('flare', 'worried');
  D.say('flare', 'SORRY! Sorry! Back to low and slow.', { cam: R('flare', 25, 1.5, 0.05), dur: 1.6 });
  D.act('aaron', 'holdDevice');
  // Greg sneaks a taste
  D.act('greg', 'idle'); D.place('greg', 1.2, -4.6, P); D.act('greg', 'sneakS2'); D.expr('greg', 'mischief');
  D.path('greg', [[0.4, -4.7]], 1.2);
  D.cam(FIX([2.6, 1.5, -3.2], [0.2, 1.0, -5.2], { fov: 50 })); D.sound('Greg tiptoes toward the stuffing', 2.0, 0.1); D.wait(1.8);
  D.act('greg', 'eatBar'); D.sfx('munch', 0, 0.5); D.sfx('munch', 0.6, 0.5);
  D.place('leon', -0.6, -3.9, -P * 0.7); D.act('leon', 'crossArms'); D.expr('leon', 'serious');
  D.say('leon', 'GREG.', { cam: R('leon', 25, 1.4, 0.05, { fov: 40 }), dur: 0.8 });
  D.faceChar('greg', 'leon', 0.3); D.expr('greg', 'surprised');
  D.say('greg', 'Mmf... quality control!', { cam: R('greg', 25, 1.4, 0.05, { fov: 40 }), dur: 1.4 });
  D.act('greg', 'idle'); D.sfx('crowdLaugh', 0, 0.2);
  // Leon mashes the potatoes... a little too hard
  D.place('leon', -1.9, -2.2, P); D.act('leon', 'groundPound'); D.expr('leon', 'determined'); props('leon');
  D.place('eric', -2.6, -2.1, P * 0.8); D.act('eric', 'idle'); D.expr('eric', 'happy');
  D.cam(FIX([-3.2, 1.5, -1.0], [-1.7, 1.0, -2.9], { fov: 48 }));
  D.sfx('punchHit', 0.3, 0.6); D.sfx('slimeSplat', 0.5, 0.7); D.fx('burst', { x: -1.85, y: 1.1, z: -3.05, n: 40, speed: 2.6, up: 1.2, size: 0.05, life: 0.9, color: 0xf6f0e0 }, 0.45);
  D.sound('Leon mashes the potatoes with super strength... SPLAT!', 2.4, 0.1); D.wait(1.4);
  D.act('leon', 'idle'); D.faceChar('eric', 'leon', 0.2); D.expr('eric', 'shocked');
  D.say('leon', 'Oops. Maybe a little too much strength.', { cam: R('leon', 25, 1.6, 0.1), expr: 'worried', dur: 1.8 });
  D.expr('eric', 'happy'); D.act('eric', 'lookHand');
  D.say('eric', "Mashed potatoes all over my face. And you know what? I'm not even mad. They're delicious.", { cam: R('eric', 25, 1.4, 0.05, { fov: 40 }), dur: 3.0 });
  D.act('eric', 'idle'); D.sfx('crowdLaugh', 0, 0.2);
  D.place('eric', -2.4, 2.4, P / 2); D.path('eric', [[2.4, 2.4], [2.4, -0.6], [-2.4, -0.6]], 6.0);
  D.cam(FIX([4.6, 2.2, 3.8], [0, 0.8, 0.9], { fov: 54 })); D.sfx('whoosh', 0.2, 0.5); D.sfx('clink', 0.6, 0.4); D.sfx('clink', 1.1, 0.4);
  D.sound('Eric races around the dining table, setting every plate', 2.4, 0.1); D.wait(2.2);
  // the reveal
  D.place('leon', -1.9, -2.1, P); D.place('greg', 0.4, -1.8, P); D.place('flare', -0.2, -2.1, P); D.act('flare', 'idle'); D.expr('flare', 'happy');
  everyone((c) => { D.act(c, 'idle'); D.expr(c, 'happy'); D.faceTo(c, -1.05, -2.8, 0.2); });
  props('aaron'); props('leon');
  D.set('turkey.s', 1.08); D.sfx('sparkle', 0.2, 0.7); D.fx('sparks', { x: -1.05, y: 1.3, z: -2.8, n: 30, color: 0xffe08a }, 0.2);
  D.cam(FIX([-1.05, 1.45, -4.45], [-1.05, 1.05, -2.8], { pos2: [-1.05, 1.35, -4.2], fov: 44 }));
  D.sound('Ding! A perfect, golden-brown roast turkey', 2.4, 0.1); D.wait(2.4);
  D.say('eric', 'Ooooooh.', { label: 'EVERYONE', cam: FIX([-0.6, 1.75, -4.6], [-0.6, 1.3, -1.8], { fov: 56 }), dur: 1.2 });
  D.say('aaron', "Flare... that's the best-looking turkey I've ever seen.", { cam: R('aaron', 25, 1.6, 0.1), dur: 2.0 });
  D.say('flare', 'I know. I\'m amazing.', { cam: R('flare', 25, 1.6, 0.1), expr: 'smug', dur: 1.2 });
  D.sfx('doorBell', 0, 0.7);
  D.say('leon', "That must be our guests. Everybody, to the table!", { cam: R('leon', 25, 1.6, 0.1), dur: 2.0 });
  D.anim('fade', 1, 0.5); D.wait(0.5);

  // =====================================================================================================================
  D.scene("6. What We're Thankful For");
  D.location('dining'); cast([...TEAM, ...GUESTS]); D.anim('fade', 0, 0.6);
  D.set('turkey.vis', 0); D.set('din.food', 1); D.set('din.turkey', 1); D.set('din.night', 1); D.set('din.eaten', 0);
  D.music('chill', 0.3, 0, 1.0);
  // the guests arrive
  D.set('din.night', 0.5);
  D.place('aaron', 4.4, 2.8, -P / 2); D.place('leon', 4.0, 1.6, -P / 2); D.place('eric', 3.6, 3.4, -P * 0.6); D.place('flare', 3.4, 0.4, -P / 2); D.place('greg', 2.8, 2.2, -P / 2);
  everyone((c) => { D.act(c, 'idle'); D.expr(c, 'happy'); });
  D.place('rose', -6.2, 2.6, P / 2); D.place('kid1', -6.6, 3.4, P / 2); D.place('kid2', -6.8, 2.0, P / 2); D.place('gus', -6.4, 1.2, P / 2); D.place('shop1', -7.0, 0.6, P / 2);
  props('gus', 'plate');
  D.path('rose', [[-3.6, 2.8]], 1.0); D.path('kid1', [[-3.2, 3.6]], 1.4); D.path('kid2', [[-3.6, 3.8]], 1.4); D.path('gus', [[-4.0, 1.6]], 1.2); D.path('shop1', [[-4.6, 1.0]], 1.2);
  D.cam(FIX([4.8, 1.8, 4.2], [-3.8, 1.2, 1.6], { fov: 52 })); D.sfx('doorOpen', 0, 0.5);
  D.sound('The guests walk in', 1.6, 0.2); D.wait(2.4);
  D.act('rose', 'gasp'); D.expr('rose', 'surprised');
  D.say('rose', 'Oh, my goodness. Look at this table!', { cam: R('rose', 30, 1.5, 0.05, { fov: 42 }), dur: 1.6 });
  D.act('rose', 'idle'); D.expr('rose', 'happy');
  D.act('gus', 'giveItem');
  D.say('gus', 'Brought the pecan pie. Like I promised.', { cam: R('gus', 25, 1.6, 0.1), expr: 'happy', dur: 1.6 });
  D.act('gus', 'idle'); props('gus');
  D.act('kid1', 'cheerJump'); D.expr('kid1', 'grin');
  D.say('kid1', 'Whoa! Is this the REAL Battle Wars headquarters?!', { cam: R('kid1', 30, 1.3, 0.0, { lookY: 0.15, fov: 40 }), dur: 2.0 });
  D.act('kid1', 'idle');
  D.say('eric', 'It sure is. Want to see me turn into a cat later?', { cam: R('eric', 25, 1.6, 0.1), expr: 'grin', dur: 2.0 });
  D.act('kid1', 'cheerJump'); D.act('kid2', 'cheerJump');
  D.say('kid2', 'YES!', { label: 'MARCUS & LILY', cam: F(['kid1', 'kid2'], 230, 2.6, 0.0, { lookY: 0.15, fov: 44 }), dur: 0.9 });
  D.say('leon', 'Welcome, everybody. Please, sit down. Dinner is ready!', { cam: R('leon', 25, 1.7, 0.1), dur: 2.0 });
  D.anim('fade', 1, 0.3); D.wait(0.3); D.anim('fade', 0, 0.4, 0.05);
  D.set('din.night', 1);
  sit('leon', -2.95, 1.0, P / 2); sit('rose', 2.95, 1.0, -P / 2);
  sit('aaron', -1.65, -0.15, 0); sit('flare', -0.55, -0.15, 0); sit('eric', 0.55, -0.15, 0); sit('greg', 1.65, -0.15, 0);
  sit('gus', -1.65, 2.15, P); sit('kid1', -0.55, 2.15, P); sit('kid2', 0.55, 2.15, P); sit('shop1', 1.65, 2.15, P);
  for (const c of [...TEAM, ...GUESTS]) D.expr(c, 'happy');
  D.cam(FIX([0, 2.6, 4.6], [0, 0.8, 0.8], { pos2: [0, 2.3, 4.0], fov: 56 }));
  D.sound('Everyone gathers around the table. The candles glow, the fire crackles', 3.0, 0.3); D.wait(3.6);
  D.act('leon', 'sitToast');
  D.say('leon', 'Before we eat, we have a Battle Wars tradition.', { cam: R('leon', 30, 1.7, 0.0, { lookY: -0.1 }), dur: 2.0 });
  D.say('leon', 'Everybody says one thing they are thankful for. Aaron, you start.', { dur: 2.6 });
  D.act('leon', 'sitTable');
  const thank = (who, lines, opts = {}) => {
    D.act(who, opts.act ?? 'sitHeart');
    for (const [i, l] of lines.entries()) D.say(who, l, { cam: i === 0 ? R(who, opts.yaw ?? 25, opts.dist ?? 1.5, 0.42, { lookY: -0.05, fov: 40, ...(opts.cam ?? {}) }) : undefined, expr: opts.expr, dur: opts.dur?.[i] });
    D.act(who, 'sitTable');
  };
  thank('aaron', ["I'm thankful for my team. We've fought monsters, villains... and a power core explosion.", 'And no matter what happened, we always stuck together.']);
  thank('flare', ["I'm thankful for coffee."], { act: 'sitTable' });
  D.sfx('crowdLaugh', 0, 0.3);
  D.act('flare', 'sitHeart');
  D.say('flare', '...And for you guys. You are my family.', { cam: R('flare', 20, 1.3, 0.0, { fov: 38 }), expr: 'happy', dur: 2.0 });
  D.act('flare', 'sitTable');
  thank('eric', ["I'm thankful I'm on a team that believes in me. Even when I turn into a cat at the worst possible time."]);
  thank('greg', ["I'm thankful for food. All of it. Especially THIS food."], { act: 'sitTable', expr: 'grin' });
  D.say('leon', 'Greg...', { cam: R('leon', 30, 1.6, 0.0), expr: 'tired', dur: 0.9 });
  D.act('greg', 'sitHeart'); D.expr('greg', 'happy');
  D.say('greg', "Okay, okay. I'm thankful I get to watch these kids grow up to be real heroes. I'm really proud of you.", { cam: R('greg', 20, 1.4, 0.0, { fov: 40 }), dur: 3.4 });
  D.say('greg', '...Now can we eat?', { expr: 'grin', dur: 1.2 });
  D.act('greg', 'sitTable');
  thank('leon', ["I built this headquarters with my own hands. And today, it's full of people I care about.", "That's what I'm thankful for."]);
  thank('rose', ["I'm thankful for kind strangers...", '...who turned out not to be strangers at all.'], { yaw: -25 });
  thank('kid1', ["I'm thankful for SUPERHEROES!"], { act: 'sitCheer', expr: 'grin', dist: 1.3 });
  thank('kid2', ['And turkey!'], { act: 'sitCheer', expr: 'grin', dist: 1.3 });
  D.sfx('crowdLaugh', 0, 0.3);
  thank('gus', ['Thirty years, I\'ve closed my store on Thanksgiving and gone home alone.', 'This year... I\'m thankful somebody asked me to stay.']);
  thank('shop1', ["I'm thankful I didn't win that tug-of-war against Leon."], { act: 'sitTable', expr: 'grin' });
  D.sfx('crowdLaugh', 0, 0.4);
  // a message from Fred
  D.act('aaron', 'checkWrist'); D.sfx('notify', 0, 0.7); D.set('aaron.holo', 1, 0.2); D.expr('aaron', 'surprised');
  D.say('aaron', "Hey, look! A message from Fred!", { cam: R('aaron', 30, 1.4, 0.0, { lookY: -0.15, fov: 40 }), dur: 1.6 });
  D.sound('"Happy Thanksgiving, partners! Save me some pie. - Fred"', 3.0); D.expr('aaron', 'happy'); D.wait(3.2);
  D.set('aaron.holo', 0); D.act('aaron', 'sitTable');
  D.say('eric', 'We miss you, Fred!', { cam: R('eric', 25, 1.4, 0.0), dur: 1.2 });
  D.act('leon', 'sitToast'); for (const c of [...TEAM, ...GUESTS]) { if (c !== 'leon') D.act(c, 'sitToast', 0.2); D.expr(c, 'grin'); }
  D.music('victory', 0.4, 0, 0.6);
  D.say('leon', 'Happy Thanksgiving, everyone!', { cam: R('leon', 30, 1.7, 0.0), dur: 1.4 });
  D.say('aaron', 'HAPPY THANKSGIVING!', { label: 'EVERYONE', cam: FIX([0, 2.4, 4.2], [0, 1.0, 0.8], { pos2: [0, 2.2, 3.8], fov: 58 }), dur: 1.6 });
  D.sfx('clink', 0, 0.7); D.sfx('crowdCheer', 0.2, 0.4);
  // eating and laughing
  for (const c of [...TEAM, ...GUESTS]) D.act(c, 'sitEatS2', 0.3);
  D.act('kid1', 'sitLaughS2', 0.3); D.act('gus', 'sitLaughS2', 0.3);
  D.anim('din.eaten', 0.6, 14, 0.5, 'linear');
  D.music('farewell', 0.3, 2.0, 2.0);
  D.cam(FIX([2.6, 1.5, 3.2], [0, 1.0, 1.0], { pos2: [2.2, 1.45, 2.8], fov: 50 }));
  D.sfx('munch', 0.5, 0.4); D.sfx('partyChatter', 0, 0.35);
  D.sound('Plates fill up. Everyone eats, laughs and tells stories', 3.0, 0.2); D.wait(3.2);
  D.cam(R('greg', 20, 1.4, 0.0, { fov: 40 })); D.sound('Greg goes back for his third plate', 1.8); D.wait(2.0);
  D.cam(R('gus', 25, 1.6, 0.42, { fov: 42 })); D.sound('Gus laughs so hard his glasses slip', 1.8); D.wait(2.0);
  D.cam(R('rose', -30, 1.5, 0.0, { fov: 42 })); D.act('rose', 'sitLaughS2'); D.wait(1.6);
  // dessert: Gus's pecan pie, and Eric's cat show for the kids
  D.say('greg', 'Gus... this pecan pie is incredible.', { cam: R('greg', 20, 1.4, 0.0, { fov: 40 }), expr: 'happy', dur: 1.6 });
  D.say('gus', 'Secret family recipe. Thirty years and I never told anybody.', { cam: R('gus', 25, 1.5, 0.42, { fov: 42 }), expr: 'smug', dur: 2.2 });
  D.say('greg', 'Can I have the secret?', { cam: R('greg', 20, 1.4, 0.0, { fov: 40 }), dur: 1.2 });
  D.say('gus', 'Nope.', { cam: R('gus', 25, 1.5, 0.42, { fov: 42 }), dur: 0.8 });
  D.sfx('crowdLaugh', 0, 0.3);
  D.say('kid2', 'Eric! You promised! The cat!', { cam: R('kid2', 25, 1.3, 0.42, { fov: 40 }), expr: 'grin', dur: 1.4 });
  D.place('eric', 0.6, -0.8, 0); D.act('eric', 'idle'); D.expr('eric', 'grin');
  D.set('flashWhite', 0.4); D.anim('flashWhite', 0, 0.3, 0.6); D.sfx('transform', 0.6, 0.8); D.fx('smoke', { x: 0.6, y: 0.6, z: -0.8, n: 14, dur: 0.9, color: 0xffffff, color2: 0xd0d0ff }, 0.6);
  D.hide('eric', 0.65); D.place('cat', 0.6, -0.8, 0, 0.65); D.set('cat.act', 'idle', 0.65);
  D.cam(FIX([0.6, 1.3, 3.6], [0.6, 0.5, 0.2], { fov: 46 })); D.wait(1.2);
  D.set('cat.act', 'run'); D.path('cat', [[2.6, -0.8], [3.4, 1.0], [2.6, 2.8]], 2.6); D.sfx('meow', 0.3, 0.7);
  D.act('kid1', 'sitLaughS2'); D.act('kid2', 'sitLaughS2'); D.act('rose', 'sitLaughS2');
  D.cam(FIX([-1.8, 1.4, 4.2], [2.6, 0.5, 1.2], { fov: 50 })); D.sfx('crowdLaugh', 0.6, 0.4);
  D.sound('The kids squeal with laughter as cat Eric chases his own tail', 2.4, 0.1); D.wait(2.4);
  D.set('cat.act', 'sit'); D.set('cat.vis', 0, 0.5); D.set('flashWhite', 0.3, 0.5); D.anim('flashWhite', 0, 0.3, 0.5); sit('eric', 0.55, -0.15, 0, 'sitLaughS2');
  D.hide('eric'); D.show('eric', 0.5); D.wait(0.8);
  // food coma
  for (const c of [...TEAM, ...GUESTS]) D.act(c, 'sitFull');
  D.set('din.eaten', 0.85);
  D.say('greg', "I can't move. I'm too full. I'm going to live in this chair now.", { cam: R('greg', 20, 1.5, 0.0, { fov: 40 }), expr: 'tired', dur: 2.6 });
  D.say('eric', 'Best. Thanksgiving. EVER.', { cam: R('eric', 25, 1.5, 0.0), expr: 'grin', dur: 1.6 });
  D.say('aaron', 'Same time next year?', { cam: R('aaron', 25, 1.5, 0.0), expr: 'happy', dur: 1.2 });
  D.say('flare', 'Only if Greg buys the turkey EARLY.', { cam: R('flare', 25, 1.5, 0.0), expr: 'smug', dur: 1.6 });
  D.say('greg', 'Deal. ...Probably.', { cam: R('greg', 20, 1.5, 0.0, { fov: 40 }), dur: 1.2 });
  D.sfx('crowdLaugh', 0, 0.4);
  D.cam(FIX([0, 2.8, 4.7], [0, 0.8, 0.6], { pos2: [0, 3.1, 4.6], fov: 60 }));
  D.sound('Everyone laughs together', 1.8); D.wait(2.4);
  // goodbyes at the door
  D.location('hqExt'); cast([...TEAM, ...GUESTS]); D.set('night', 1); D.set('evening', 0); D.set('hq.doors', 1);
  D.place('aaron', -0.6, 1.6, 0); D.place('leon', 0.6, 1.8, 0); D.place('flare', -1.6, 1.8, 0.2); D.place('eric', 1.6, 1.6, -0.2); D.place('greg', 0, 2.4, 0);
  D.place('rose', -0.8, 4.4, P); D.place('kid1', -1.4, 4.8, P); D.place('kid2', -0.2, 5.0, P); D.place('gus', 0.8, 4.6, P); D.place('shop1', 1.8, 4.8, P);
  for (const c of [...TEAM, ...GUESTS]) { D.act(c, 'idle'); D.expr(c, 'happy'); }
  props('gus', 'plate'); props('rose', 'none');
  D.cam(FIX([4.6, 1.8, 7.8], [0, 1.2, 3.0], { fov: 50 })); D.sfx('cricket', 0, 0.3);
  D.sound('Later that night, the guests head home with plates of leftovers', 2.6, 0.2); D.wait(2.8);
  D.act('rose', 'heartS2');
  D.say('rose', 'Thank you all. This was the most wonderful Thanksgiving we have ever had.', { cam: R('rose', 25, 1.6, 0.05, { fov: 42 }), dur: 2.8 });
  D.act('rose', 'idle');
  D.say('gus', "Same time next year. And I'm keeping the store open late for you. Just this once.", { cam: R('gus', 25, 1.6, 0.1), expr: 'happy', dur: 2.8 });
  D.act('kid1', 'wave'); D.act('kid2', 'wave'); D.act('shop1', 'wave');
  D.say('kid1', 'Bye, Battle Wars! Bye, cat Eric!', { cam: F(['kid1', 'kid2'], 200, 2.4, 0.0, { lookY: 0.15, fov: 44 }), dur: 1.6 });
  everyone((c) => D.act(c, 'wave'));
  for (const c of GUESTS) D.path(c, [[pos(c)[0] * 1.5, 12]], 1.2, 0.6);
  D.cam(FIX([0, 1.6, -1.6], [0, 1.2, 6], { fov: 54 })); D.wait(2.4);
  everyone((c) => D.act(c, 'idle'));
  // on the couch
  D.location('living'); cast([...TEAM]); D.set('thx.decor', 1); D.set('night', 1); D.set('tv.off', 1);
  D.place('aaron', -0.6, 0.75, P); D.act('aaron', 'sitRelax'); D.place('flare', 0.4, 0.75, P); D.act('flare', 'sitRelax'); D.place('greg', 1.3, 0.75, P); D.act('greg', 'sitSleep'); D.expr('greg', 'sleep');
  D.place('eric', -1.5, 0.75, P); D.act('eric', 'sitRelax'); D.place('leon', -3.0, -0.6, P / 2 + 0.4); D.act('leon', 'idle');
  for (const c of ['aaron', 'flare', 'eric', 'leon']) D.expr(c, 'happy');
  D.cam(FIX([0, 1.8, -3.3], [0, 0.95, 0.8], { pos2: [0, 1.7, -3.0], fov: 52 })); D.sfx('snore', 0.5, 0.4);
  D.sound('Back inside, the team flops onto the couch. Greg is already asleep', 2.6, 0.2); D.wait(2.8);
  D.say('aaron', 'You know what I just realized?', { cam: R('aaron', 20, 1.5, -0.2, { fov: 40 }), dur: 1.4 });
  D.say('aaron', "If Greg hadn't forgotten the turkey, we never would have met Grandma Rose, or the kids... or found out Gus makes amazing pie.", { dur: 4.0 });
  D.say('flare', 'Are you saying... Greg forgetting the turkey was a GOOD thing?', { cam: R('flare', 20, 1.5, -0.2, { fov: 40 }), dur: 2.4 });
  D.say('aaron', "I'm saying I'm thankful for it.", { cam: R('aaron', 20, 1.5, -0.2, { fov: 40 }), dur: 1.6 });
  D.act('greg', 'sitWake'); D.expr('greg', 'happy');
  D.say('greg', 'See? I TOLD you I had a plan.', { cam: R('greg', 15, 1.4, -0.2, { fov: 40 }), dur: 1.8 });
  D.say('aaron', 'GREG!', { label: 'EVERYONE', cam: FIX([0, 1.8, -3.3], [0, 0.95, 0.8], { fov: 52 }), dur: 1.0 });
  D.act('greg', 'sitLaugh'); for (const c of ['aaron', 'flare', 'eric']) D.act(c, 'sitLaugh'); D.act('leon', 'laugh'); D.sfx('crowdLaugh', 0, 0.4);
  D.sound('Everyone laughs', 1.6); D.wait(2.0);
  // outside: the lights of headquarters on Thanksgiving night
  D.location('hqExt'); cast([]); D.set('night', 1); D.set('evening', 0);
  D.cam(FIX([10, 2.6, 14], [0, 5, -6], { pos2: [16, 4.6, 22], fov: 52 }));
  D.sound('The windows of headquarters glow warm and bright. Happy Thanksgiving.', 3.4, 0.2); D.wait(4.6);
  D.anim('fade', 1, 1.4); D.wait(1.4);

  // ---- credits
  D.location('black'); cast([]);
  D.music('theme', 0.45, 0, 1.0);
  const endDur = 12;
  D.card('credits', endDur, {
    lines: [
      { text: 'BATTLE WARS', big: true, color: '#7fd4ff', y: 0.26 },
      { text: 'Season 2, Episode 1: Thanksgiving Turkey Rush', bold: true, y: 0.36 },
      { text: 'Starring Aaron, Flare, Eric, Leon and Greg', y: 0.48 },
      { text: 'With Gus, Grandma Rose, Marcus and Lily', y: 0.55 },
      { text: 'Happy Thanksgiving from the whole Battle Wars team!', color: '#ffc86a', bold: true, y: 0.68 },
      { text: 'See you next episode!', color: '#ffe08a', y: 0.78 },
    ],
  });
  D.set('fade', 0); D.wait(endDur / HOLD);
  // captions of the same kind never overlap: an earlier one ends just before the next one starts
  const caps = D.T.captions.sort((x, y) => x.t0 - y.t0);
  for (let i = 0; i < caps.length; i++) for (let j = i + 1; j < caps.length; j++) {
    const x = caps[i], y = caps[j];
    if (y.t0 >= x.t1) break;
    if (!!x.sound === !!y.sound) x.t1 = Math.max(x.t0 + 0.8, y.t0 - 0.05);
  }
  return D.end();
}
