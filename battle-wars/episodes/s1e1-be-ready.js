// BATTLE WARS - Season 1, Episode 1: "BE READY!"
// The whole episode as a timeline: blocking, camera, captions, sound and effects.
import { createDirector } from '../src/director.js';

export const META = { id: 's1e1-be-ready', title: 'Battle Wars - S1E1 - Be Ready!', file: 'Battle_Wars_S1E1_Be_Ready' };

const P = Math.PI;
const FACE = { px: P / 2, nx: -P / 2, pz: 0, nz: P };
const HEROES = ['aaron', 'flare', 'eric'];
const ALL = ['aaron', 'flare', 'eric', 'barista', 'water'];

export function buildEpisode() {
  const D = createDirector();
  const F = (on, yaw, dist, h = 0.15, x = {}) => ({ type: 'frame', on: Array.isArray(on) ? on : [on], yaw, dist, h, ...x });
  const R = (on, yaw, dist, h = 0.15, x = {}) => F(on, yaw, dist, h, { rel: Array.isArray(on) ? on[0] : on, ...x });
  const FIX = (pos, look, x = {}) => ({ type: 'fixed', pos, look, ...x });
  const cast = (list) => { for (const c of ALL) if (!list.includes(c)) D.hide(c); };
  const v = (n, d = 0) => D.val(n, D.now, d);

  // everyone off-stage, neutral faces
  for (const c of ALL) { D.hide(c); D.act(c, 'idle'); D.expr(c, 'neutral'); D.set(`${c}.y`, 0); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); }
  D.set('water.scale', 1); D.set('water.expr', 'mischief');
  D.set('fade', 1);

  // ===================================================================== COLD OPEN
  D.scene('Cold open');
  D.location('city');
  D.set('car.x', -60); D.set('water.vis', 0);
  D.music('morning', 0.62, 0, 0.5);
  D.anim('fade', 0, 1.2);
  D.cam(FIX([-26, 16, 26], [8, 3, -12], { pos2: [-14, 9, 20], fov: 45, ease: 'linear' }));
  D.card('location', 3.2, { text: 'AETHERFALL CITY  -  MORNING' });
  D.sfx('birds', 0.2, 0.6);
  D.wait(3.4);

  // ===================================================================== SCENE 1: THE COFFEE EMERGENCY
  D.scene('1. The Coffee Emergency');
  D.location('coffee');
  cast(['flare', 'barista']);
  D.place('barista', 0.45, -2.95, 0); D.act('barista', 'idle'); D.expr('barista', 'happy');
  D.place('flare', -5.7, 0.8, FACE.px); D.act('flare', 'tired'); D.expr('flare', 'tired');
  D.set('door', 0); D.anim('door', 1, 0.5, 0.1); D.anim('door', 0, 0.8, 2.0);
  D.sfx('doorBell', 0.15, 0.8);
  D.cam(FIX([3.4, 2.1, 3.6], [-2.5, 1.2, -0.6], { pos2: [2.6, 1.9, 2.4], fov: 42 }));
  D.path('flare', [[-3.0, 0.2], [-0.15, -1.3]], 1.35, 0.3);
  D.wait(4.9);
  D.face('flare', FACE.nz, 0.4);
  D.wait(0.3);
  D.say('flare', 'One coffee, please.', { cam: R('flare', 115, 2.3, 0.1), dur: 2.0 });
  D.set('barista.act', 'reach'); D.expr('barista', 'happy');
  D.set('cup.vis', 1); D.set('cup.x', 0.45); D.set('cup.y', 1.08); D.set('cup.z', -2.6);
  D.anim('cup.x', 0.15, 0.7, 0.2); D.anim('cup.z', -2.0, 0.7, 0.2);
  D.sfx('cupSet', 0.9, 0.7);
  D.cam(F(['flare', 'barista'], 90, 3.6, 0.1, { lookY: -0.3, fov: 38 }));
  D.act('flare', 'pay', 0.9); D.set('bill.held', 1, 0.9);
  D.act('flare', 'reach', 1.6);
  D.act('barista', 'idle', 1.3);
  D.wait(2.3);
  D.set('cup.vis', 0); D.set('cup.held', 1);
  D.act('flare', 'freeze');
  D.wait(0.25);
  // BAM - Aaron bursts in
  D.place('aaron', -6.6, 0.8, FACE.px); D.act('aaron', 'idle'); D.expr('aaron', 'determined');
  D.anim('door', 1, 0.14); D.move('aaron', -5.0, 0.8, 0.45, 0, { ease: 'out' });
  D.sfx('doorBang'); D.shake(0.12, 0.5); D.comic('BAM!', 0, 0.9, { x: 0.3, y: 0.3, rot: -12 });
  D.expr('flare', 'surprised'); D.expr('barista', 'surprised');
  D.say('aaron', 'HEY, FLARE! THIS ONE IS AN EMERGENCY!', { cam: R('aaron', 18, 2.9, 0.1), act: 'point', dur: 2.9, dt: 0.2 });
  D.act('aaron', 'idle');
  // Flare slowly turns his head
  D.cam(R('flare', 100, 1.9, 0.05, { lookY: -0.05 }));
  D.expr('flare', 'annoyed', 0.2);
  D.look('flare', 1.05, 0, 1.4, 0.2);
  D.wait(1.8);
  D.say('flare', '...Are you serious?', { dur: 2.0 });
  D.say('aaron', 'We need you. NOW!', { cam: R('aaron', -15, 2.4, 0.1), act: 'point', expr: 'determined', dur: 1.9 });
  D.act('aaron', 'handsHips');
  // sigh + drop the coffee
  D.cam(R('flare', 120, 2.8, 0.2, { lookY: -0.35 }));
  D.look('flare', 0, 0, 0.5);
  D.act('flare', 'sigh'); D.sound('Flare sighs', 1.4);
  D.sfx('sigh', 0.1, 0.6);
  D.wait(1.0);
  D.set('cup.held', 0); D.set('cup.vis', 1); D.set('cup.x', 0.17); D.set('cup.y', 0.72); D.set('cup.z', -1.32);
  D.anim('cup.y', 0.06, 0.32, 0, 'in'); D.anim('cup.rz', 1.5, 0.32, 0, 'in'); D.anim('cup.x', 0.3, 0.32);
  D.set('spill.x', 0.35); D.set('spill.z', -1.45); D.anim('spill', 1, 0.6, 0.3, 'out');
  D.fx('coffee', { x: 0.3, y: 0.08, z: -1.35, n: 40, speed: 1.6, up: 0.9, size: 0.035, life: 0.7 }, 0.32);
  D.sfx('cupDrop', 0.3); D.comic('SPLAT!', 0.32, 0.8, { x: 0.62, y: 0.7, size: 70, rot: 8, c1: '#ffe0b0', c2: '#b0622a' });
  D.expr('barista', 'worried', 0.4);
  D.wait(0.9);
  D.face('flare', FACE.nz, 0.3); D.act('flare', 'pay');
  D.set('bill.held', 0, 0.6); D.set('bill', 1, 0.6); D.sfx('cupSet', 0.6, 0.3);
  D.say('flare', 'Keep the money.', { cam: R('flare', 110, 2.4, 0.1), expr: 'annoyed', dur: 1.6 });
  D.act('flare', 'tired');
  D.look('flare', 0.9, 0, 0.4);
  D.say('flare', "Apparently, I'm not allowed to have a normal morning.", { dur: 3.4 });
  D.expr('barista', 'happy');
  // Aaron grabs Flare and rushes out
  D.cam(FIX([2.8, 2.0, 3.4], [-2.6, 1.0, -0.2], { pos2: [1.5, 1.8, 3.2], fov: 44 }));
  D.act('aaron', 'run'); D.expr('aaron', 'determined');
  D.path('aaron', [[-0.9, -0.95]], 4.2);
  D.wait(1.05);
  D.look('flare', 0, 0, 0.2);
  D.act('aaron', 'dragging'); D.act('flare', 'dragged'); D.expr('flare', 'shocked');
  D.path('aaron', [[-4.2, 0.7], [-7.0, 0.8]], 4.6);
  D.path('flare', [[-3.4, 0.4], [-7.0, 0.8]], 4.4, 0.18);
  D.sfx('whoosh', 0.1);
  D.wait(1.7);
  D.anim('fade', 1, 0.35);
  D.wait(0.45);

  // ===================================================================== TITLE CARD
  D.scene('Title');
  D.location('title');
  cast([]);
  D.set('fade', 0);
  D.music('theme', 0.85, 0, 0.05);
  D.set('title.k', 0); D.set('title.sub', 0); D.set('title.y', 0.25); D.set('title.subY', -1.2);
  D.anim('title.k', 1, 0.7, 0.1, 'back');
  D.anim('title.sub', 1, 0.5, 1.1, 'back');
  D.set('flash', 0.9, 0.1); D.anim('flash', 0, 0.5, 0.1);
  D.sfx('titleHit', 0.1); D.sfx('titleHit', 1.1, 0.7);
  D.cam(FIX([0, 0.2, 9.5], [0, -0.3, 0], { pos2: [0, 0, 7.8], fov: 40 }));
  D.wait(4.6);
  D.anim('fade', 1, 0.3);
  D.wait(0.35);

  // ===================================================================== SCENE 2: THE HEADQUARTERS
  D.scene('2. The Headquarters');
  D.location('hqExt');
  D.set('fade', 0); D.set('evening', 0);
  D.music('hq', 0.55, 0, 0.6);
  D.set('hcar.vis', 1); D.set('hcar.x', -34); D.set('hcar.z', 5.4);
  D.anim('hcar.x', -2.5, 2.6, 0, 'out');
  D.sfx('carArrive', 0);
  D.cam(FIX([15, 2.2, 19], [0, 5.5, -6], { pos2: [11, 2.6, 15.5], fov: 48 }));
  D.card('location', 3.0, { text: 'BATTLE WARS HQ' });
  D.wait(3.4);

  D.location('living');
  cast(['eric']);
  D.place('eric', 0.0, 0.82, FACE.nz); D.act('eric', 'sitGame'); D.expr('eric', 'determined');
  D.set('ctrl.held', 1); D.set('ctrl.couch', 0); D.set('tv.win', 0); D.set('tv.off', 0); D.set('pizza', 0);
  D.sfx('gamePew', 0.3, 0.5, { repeat: 6, every: 0.32 });
  D.say('eric', 'Come on! Come on!', { cam: F('eric', 180, 2.3, 0.0, { lookY: -0.1 }), dur: 2.0 });
  D.cam(FIX([0.9, 1.25, 2.9], [0, 1.4, -4.5], { fov: 42 }));
  D.set('tv.win', 1); D.act('eric', 'sitCheer'); D.expr('eric', 'grin');
  D.sfx('gameWin', 0);
  D.wait(0.9);
  D.say('eric', "YES! That's what I'm talking about!", { cam: F('eric', 175, 2.6, 0.1), dur: 2.6 });
  // Flare and Aaron walk in
  D.place('flare', -6.8, 2.6, FACE.px); D.place('aaron', -7.4, 2.0, FACE.px);
  D.act('flare', 'idle'); D.act('aaron', 'idle'); D.expr('flare', 'neutral'); D.expr('aaron', 'neutral');
  D.act('eric', 'sitGame'); D.expr('eric', 'happy');
  D.sfx('doorOpen', 0, 0.6);
  D.path('flare', [[-2.4, 1.2]], 1.5);
  D.path('aaron', [[-3.0, 0.1]], 1.5);
  D.cam(FIX([3.2, 1.7, -2.6], [-3.5, 1.2, 1.2], { fov: 44 }));
  D.wait(3.0);
  D.faceChar('flare', 'eric'); D.faceChar('aaron', 'eric');
  D.say('flare', 'We got another mission.', { cam: F(['flare', 'aaron'], 110, 4.2, 0.2), act: 'idle', dur: 2.1 });
  // Eric drops the controller and dances
  D.set('ctrl.held', 0); D.set('ctrl.couch', 1); D.sfx('thud', 0.05, 0.5);
  D.set('tv.win', 0);
  D.act('eric', 'idle'); D.expr('eric', 'grin');
  D.move('eric', -0.35, 0.05, 0.5, 0.05, { face: false, y: 0 });
  D.faceChar('eric', 'flare', 0.4, 0.2);
  D.cam(R('eric', -35, 3.6, 0.3, { lookY: -0.3 }));
  D.wait(0.6);
  D.act('eric', 'dance');
  D.music('dance', 0.5, 0, 0.2);
  D.say('eric', "LET'S GOOOO! ANOTHER MISSION! FINALLY!", { dur: 3.0 });
  D.say('aaron', 'Can you please be serious for five seconds?', { cam: R('aaron', 10, 2.6, 0.1), act: 'handsHips', expr: 'annoyed', dur: 3.0 });
  D.say('eric', 'No promises!', { cam: R('eric', 35, 3.0, 0.25), expr: 'grin', dur: 1.8 });
  D.music('hq', 0.55, 0, 0.4);
  // Eric runs up the stairs
  D.act('eric', 'idle');
  D.cam(FIX([-3.2, 2.0, 4.6], [3.5, 1.8, -0.5], { fov: 46 }));
  D.path('eric', [[4.9, 2.2, 0], [4.9, 1.75, 0.15], [4.9, -2.45, 3.0]], 4.2);
  D.sfx('whoosh', 0.2, 0.6);
  D.faceChar('flare', 'eric', 0.6, 0.4); D.faceChar('aaron', 'eric', 0.6, 0.5);
  D.wait(2.2);
  D.hide('eric', 0.3);
  D.faceChar('flare', 'aaron', 0.5); D.faceChar('aaron', 'flare', 0.5);
  D.say('flare', "At least somebody's happy.", { cam: F(['flare', 'aaron'], 160, 3.8, 0.15), act: 'crossArms', expr: 'smug', dur: 2.3 });
  D.say('aaron', "That's what worries me.", { cam: R('aaron', -20, 2.2, 0.08), expr: 'worried', act: 'idle', dur: 2.2 });
  D.wait(0.3);

  // ===================================================================== SCENE 3: SOMETHING UNDER THE STREET
  D.scene('3. Something Under the Street');
  D.location('control');
  cast(['eric']);
  D.set('map.mode', 0); D.set('map.zoom', 0); D.set('map.blip', 0);
  D.music('mystery', 0.62, 0, 0.5);
  D.sfx('alarmBeep', 0, 0.35, { repeat: 4, every: 0.8 });
  D.place('eric', 6.4, 1.4, FACE.nx); D.act('eric', 'idle'); D.expr('eric', 'happy');
  D.cam(FIX([-2.6, 2.6, 5.4], [0.8, 1.7, -3], { pos2: [-1.6, 2.4, 4.6], fov: 48 }));
  D.card('location', 3.0, { text: 'CONTROLLER ROOM  -  3RD FLOOR' });
  D.path('eric', [[0.3, -2.15]], 3.6);
  D.wait(2.0);
  D.face('eric', FACE.nz, 0.3);
  D.act('eric', 'lean'); D.expr('eric', 'determined');
  D.wait(0.5);
  D.say('eric', "Hmmm... there's some problems with a fire hydrant.", { cam: FIX([1.9, 1.8, -0.4], [-0.4, 2.0, -4.6], { fov: 46 }), dur: 3.4 });
  D.place('flare', 6.4, 1.4, FACE.nx); D.act('flare', 'idle'); D.expr('flare', 'neutral');
  D.place('aaron', 6.9, 1.0, FACE.nx); D.act('aaron', 'idle'); D.expr('aaron', 'determined');
  D.path('flare', [[-1.4, -1.25]], 3.8);
  D.path('aaron', [[1.6, -1.0]], 3.4, 0.5);
  D.cam(FIX([0, 2.3, 4.2], [0, 1.4, -2.2], { fov: 50 }));
  D.wait(1.9);
  D.face('flare', FACE.nz, 0.4);
  D.say('flare', 'Apparently, yeah...', { cam: R('flare', -15, 2.4, 0.1), act: 'crossArms', dur: 1.9 });
  D.face('aaron', FACE.nz, 0.4);
  D.move('aaron', 1.3, -1.8, 0.7, 0.2);
  D.say('aaron', 'The fire hydrants have been acting up across the city.', { cam: R('aaron', 20, 2.6, 0.1), expr: 'determined', dur: 3.3 });
  D.say('aaron', 'Water pressure keeps going crazy, and some of them are shaking underground.', { cam: FIX([0, 2.15, -1.6], [0, 2.15, -4.6], { pos2: [0.2, 2.15, -2.0], fov: 52 }), dur: 4.2 });
  D.say('aaron', "We don't know what's underneath them.", { cam: R('aaron', -25, 2.2, 0.1), dur: 2.6 });
  D.act('eric', 'idle'); D.face('eric', 0.4, 0.4);
  D.say('eric', "So we're fighting a fire hydrant?", { cam: R('eric', 10, 2.3, 0.1), expr: 'surprised', dur: 2.4 });
  D.say('flare', 'If you want to fight a metal pipe, be my guest.', { cam: R('flare', 15, 2.4, 0.1), expr: 'smug', dur: 3.2 });
  D.say('eric', "I mean, I've fought weirder things.", { cam: R('eric', -15, 2.3, 0.1), act: 'shrug', expr: 'happy', dur: 2.6 });
  D.act('eric', 'idle');
  D.face('eric', FACE.nz, 0.4);
  D.say('aaron', 'Focus. Look at this reading.', { cam: F(['aaron', 'eric'], 25, 3.6, 0.4, { lookY: 0.1 }), act: 'point', expr: 'determined', dur: 2.3 });
  D.anim('map.zoom', 1, 1.6, 0); D.sfx('zoomBeep', 0, 0.6);
  D.say('aaron', "There's something moving through the water system.", { cam: FIX([0.2, 2.2, -1.4], [0.2, 2.15, -4.6], { pos2: [0.4, 2.2, -2.2], fov: 50 }), dur: 3.3 });
  D.act('aaron', 'idle');
  D.say('aaron', "Whatever it is, it's heading toward the city center.", { cam: R('aaron', 15, 2.3, 0.1), dur: 3.3 });
  D.face('eric', 0.6, 0.4);
  D.say('eric', "Something moving through the pipes? That's disgusting.", { cam: R('eric', 0, 2.2, 0.1), expr: 'disgust', dur: 3.4 });
  D.face('flare', 2.6, 0.4);
  D.say('flare', "Get your stuff. We're leaving.", { cam: F(['flare', 'aaron', 'eric'], 180, 5.2, 0.3), act: 'idle', expr: 'determined', dur: 2.4 });
  D.say('eric', 'FINALLY!', { cam: R('eric', 15, 2.4, 0.1), act: 'fistPump', expr: 'grin', dur: 1.5 });
  D.act('eric', 'idle');
  D.cam(FIX([-2.6, 2.4, 3.6], [3, 1.4, 0], { fov: 50 }));
  D.path('eric', [[6.6, 1.4]], 5.0);
  D.sfx('whoosh', 0.1, 0.7);
  D.wait(0.7);
  D.faceTo('aaron', 6.6, 1.4, 0.3);
  D.say('aaron', 'Eric! Wait for us!', { act: 'yell', expr: 'worried', dur: 2.0 });
  D.hide('eric');
  D.wait(0.3);

  // ===================================================================== SCENE 4: THE WATER GUY
  D.scene('4. The Water Guy');
  D.location('city');
  cast([]);
  D.set('car.vis', 1); D.set('car.x', -45); D.set('car.z', 1.6); D.set('car.ry', 0);
  D.set('hyd.flow', 0); D.set('hyd.shake', 0); D.set('flood', 0); D.set('rune', 0); D.set('cover', 0);
  for (let i = 0; i < 6; i++) D.set(`barr${i}`, 0);
  D.music('drive', 0.5, 0, 0.3);
  D.anim('car.x', -9.5, 2.6, 0, 'out');
  D.sfx('carArrive', 0); D.sfx('skid', 1.9);
  D.cam(FIX([-3.5, 0.7, 3.6], [-20, 1.0, 1.2], { look2: [-9, 1.0, 1.2], fov: 46 }));
  D.card('location', 3.0, { text: 'DOWNTOWN AETHERFALL' });
  D.wait(2.9);
  D.sfx('carDoor', 0.1); D.sfx('carDoor', 0.35); D.sfx('carDoor', 0.6);
  D.place('aaron', -9.0, 3.0, 0.7); D.place('flare', -10.2, 3.1, 0.7); D.place('eric', -7.8, 3.0, 0.7);
  for (const c of HEROES) { D.act(c, 'idle'); D.expr(c, 'determined'); }
  D.expr('eric', 'happy');
  D.music('none', 0, 0, 1.0);
  D.cam(FIX([-1.0, 1.6, 6.8], [-6.5, 1.3, 0.5], { pos2: [0.5, 1.7, 6.2], fov: 50 }));
  D.path('aaron', [[-2.8, -2.3]], 1.45, 0.4);
  D.path('flare', [[-3.6, -1.1]], 1.45, 0.3);
  D.path('eric', [[-2.1, -0.2]], 1.45, 0.6);
  D.wait(1.0);
  D.say('eric', "All right. Where's the problem?", { dur: 2.4 });
  D.wait(2.5);
  for (const c of HEROES) D.faceTo(c, 0, -4.7, 0.5);
  // rumble... BOOM
  D.cam(FIX([-2.0, 1.0, 1.6], [0, 0.6, -4.7], { pos2: [-1.6, 0.8, 0.4], fov: 40 }));
  D.anim('hyd.shake', 1, 1.5);
  D.sfx('rumble', 0, 1.0); D.shake(0.08, 2.2);
  D.sound('Rumbling underground', 2.0);
  D.comic('KRRRRRR...', 0.2, 1.9, { x: 0.5, y: 0.25, size: 80, rot: -4, c1: '#d8f0ff', c2: '#6aa8d8' });
  D.expr('eric', 'worried', 0.6); D.expr('flare', 'worried', 0.6);
  D.wait(2.2);
  D.set('hyd.shake', 0); D.set('hyd.h', 6); D.anim('hyd.flow', 1, 0.25);
  D.sfx('boom'); D.sfx('gush', 0.05, 0.9); D.shake(0.7, 1.0);
  D.set('flash', 0.7); D.anim('flash', 0, 0.4);
  D.comic('BOOM!', 0, 1.2, { x: 0.5, y: 0.32, size: 150, rot: -6 });
  D.cam(F(['aaron', 'flare', 'eric'], 200, 6.8, 0.6, { lookY: 0.4, fov: 48 }));
  for (const c of HEROES) { D.act(c, 'stumble'); D.expr(c, 'shocked'); }
  D.move('aaron', -4.0, -0.9, 0.7, 0, { face: false }); D.move('flare', -4.9, 0.2, 0.7, 0, { face: false }); D.move('eric', -3.4, 1.0, 0.7, 0, { face: false });
  D.fx('burst', { x: 0, y: 0.8, z: -4.6, n: 120, speed: 5, up: 1.4, size: 0.1, life: 1.4 });
  D.say('flare', 'WHOA!', { dur: 1.4, dt: 0.2 });
  for (const c of HEROES) D.act(c, 'idle');
  // the Water Guy forms
  D.set('hyd.flow', 0.7); D.set('hyd.h', 4);
  D.fx('swirl', { x: 0, z: -1.6, y: 3.0, dur: 2.4 });
  D.sfx('swirl', 0, 0.8);
  D.set('water.x', 0); D.set('water.z', -1.4); D.set('water.ry', -0.6); D.set('water.y', 2.6);
  D.set('water.scale', 0.01); D.set('water.vis', 1, 0.4); D.anim('water.scale', 1, 1.8, 0.4, 'out');
  D.set('water.act', 'idle'); D.set('water.expr', 'mischief');
  D.anim('water.y', 0, 0.45, 2.15, 'in');
  D.sfx('splashLand', 2.55); D.fx('burst', { x: 0, y: 0.1, z: -1.4, n: 90, speed: 4, up: 0.8, size: 0.09 }, 2.55);
  D.shake(0.25, 0.5, 2.55);
  D.cam(FIX([-3.2, 0.5, 3.4], [0, 2.4, -1.4], { pos2: [-2.4, 0.4, 2.6], fov: 44 }));
  D.wait(3.0);
  D.music('villain', 0.5, 0, 0.2);
  D.set('water.act', 'raise');
  D.say('water', "There's no need to worry!", { cam: R('water', 15, 4.2, 0.0, { lookY: -0.4 }), dur: 2.0 });
  D.set('flood.cx', 0); D.anim('flood', 0.35, 3.5, 0); D.sfx('floodRush', 0, 0.7);
  D.say('water', "I'm gonna flood this city!", { cam: R('water', -10, 5.6, -0.6, { lookY: -0.4, fov: 46 }), dur: 2.4 });
  D.set('water.act', 'laugh');
  D.say('eric', "Oh, so we're fighting WATER now?!", { cam: R('eric', 20, 2.6, 0.1), expr: 'shocked', dur: 2.6 });
  D.set('water.act', 'idle');
  D.say('aaron', "Eric, block the city's path!", { cam: R('aaron', -20, 2.5, 0.1), act: 'point', expr: 'determined', dur: 2.3 });
  D.act('aaron', 'idle');
  D.set('device', 1, 0.2);
  D.say('eric', 'ON IT!', { cam: R('eric', 0, 2.2, 0.1), act: 'holdDevice', expr: 'grin', dur: 1.5 });

  // ===================================================================== SCENE 5: THE FLOOD FIGHT
  D.scene('5. The Flood Fight');
  D.music('action', 0.55, 0, 0.3);
  D.act('eric', 'idle');
  D.cam(FIX([-6, 3.6, 8.5], [3.5, 0.8, 0], { pos2: [-3, 3.2, 8.0], fov: 52 }));
  D.path('eric', [[2.0, 3.0], [7.2, 2.4], [7.3, 0.0]], 5.2);
  D.wait(2.1);
  D.face('eric', FACE.nx, 0.25);
  D.act('eric', 'throw');
  D.set('barr.sx', 7.2); D.set('barr.sz', 0);
  D.cam(FIX([10.5, 2.4, 5.5], [6.0, 0.8, -0.5], { fov: 50 }));
  const barOrder = [2, 3, 1, 4, 0, 5];
  barOrder.forEach((b, i) => { D.anim(`barr${b}`, 1, 0.5, 0.25 + i * 0.42, 'linear'); D.sfx('clank', 0.75 + i * 0.42, 0.7); });
  D.comic('CLANK!', 0.8, 0.7, { x: 0.35, y: 0.35, size: 80, rot: 10, c1: '#ffffff', c2: '#ffcc1a' });
  D.wait(3.0);
  D.set('device', 0);
  D.say('eric', "Road's closed! No flooding allowed!", { cam: R('eric', 25, 3.0, 0.2), act: 'handsHips', expr: 'grin', dur: 2.6 });
  D.set('water.act', 'laugh'); D.face('water', FACE.px, 0.5);
  D.say('water', 'You think a few barriers can stop ME?!', { cam: R('water', -30, 5.0, -0.3, { lookY: -0.3 }), expr: 'mischief', dur: 2.8 });
  D.set('water.act', 'push');
  D.fx('wave', { from: [1.0, -0.4], to: [5.5, -0.4], dur: 1.3, width: 7.4, height: 1.1, back: -1 }, 0.3);
  D.sfx('waveWhoosh', 0.3); D.sfx('waveCrash', 1.6); D.anim('flood', 0.6, 1.4, 0.3);
  D.set('barr.shake', 1, 1.6); D.anim('barr.shake', 0, 1.2, 1.6);
  D.act('eric', 'brace', 1.2); D.expr('eric', 'worried', 1.4);
  D.cam(FIX([2.5, 2.4, 7.5], [3.2, 0.8, -0.5], { pos2: [3.5, 2.0, 6.6], fov: 52 }));
  D.comic('SPLASH!', 1.65, 0.9, { x: 0.68, y: 0.3, size: 100, rot: 8, c1: '#e0f7ff', c2: '#3aa0ff' });
  D.wait(3.0);
  D.set('water.act', 'idle'); D.act('eric', 'idle');
  D.faceChar('aaron', 'flare', 0.4); D.faceChar('flare', 'aaron', 0.4);
  D.say('aaron', "Flare, get his attention! I'll figure out how to stop the water!", { cam: F(['aaron', 'flare'], 230, 4.2, 0.2), act: 'point', expr: 'determined', dur: 3.8 });
  D.act('aaron', 'idle');
  D.say('flare', 'Why am I always the distraction?!', { cam: R('flare', 15, 2.4, 0.1), act: 'shrug', expr: 'annoyed', dur: 2.4 });
  D.say('aaron', "Because you're good at it!", { cam: R('aaron', -15, 2.4, 0.1), expr: 'smug', dur: 2.0 });
  D.act('flare', 'idle');
  D.say('flare', "...I hate that you're right.", { cam: R('flare', -10, 2.0, 0.08), expr: 'annoyed', dur: 2.3 });
  // Flare runs at the Water Guy, dodging splashes
  D.expr('flare', 'determined'); D.expr('aaron', 'determined');
  D.cam(F(['flare', 'water'], 160, 9.0, 1.6, { lookY: -0.6, fov: 48 }));
  D.path('flare', [[-2.2, 1.6], [-3.4, 2.9]], 4.6);
  D.faceChar('water', 'flare', 0.4);
  D.set('water.act', 'throwR', 0.1);
  const jet = (tx, tz, dt, size = 0.3, dur = 0.7) => {
    const t0 = D.now + dt;
    const wx = D.val('water.x', t0), wz = D.val('water.z', t0), s = D.val('water.scale', t0, 1);
    D.fx('jet', { from: [wx, 1.6 * s, wz], to: [tx, 0.1, tz], dur, size, arc: 1.0 + size }, dt);
    D.sfx('splashShot', dt, 0.6); D.sfx('splash', dt + dur, 0.8);
    D.anim('rune', 1, 0.15, dt); D.anim('rune', 0.45, 0.6, dt + 0.2);
  };
  jet(-2.0, 0.9, 0.3); jet(-2.9, 2.2, 1.0); jet(-4.0, 3.4, 1.7);
  D.path('aaron', [[-1.0, -3.0]], 2.2, 0.8);
  D.wait(2.0);
  D.faceChar('flare', 'water', 0.3);
  D.set('water.act', 'idle');
  D.say('flare', 'HEY, WATER FACE! YOU MISSED!', { cam: R('flare', 25, 3.0, 0.2), act: 'taunt', expr: 'smug', dur: 2.6 });
  D.say('water', 'WATER FACE?!', { cam: R('water', 0, 4.2, -0.2, { lookY: -0.2 }), expr: 'shocked', dur: 1.6 });
  D.set('water.expr', 'shocked');
  D.say('flare', 'Yeah! You got a better name?!', { cam: R('flare', -20, 3.0, 0.2), act: 'handsHips', expr: 'smug', dur: 2.3 });
  D.set('water.expr', 'angry');
  D.set('water.act', 'push');
  {
    const fx0 = D.val('flare.x', D.now), fz0 = D.val('flare.z', D.now);
    const wx = D.val('water.x', D.now), wz = D.val('water.z', D.now);
    D.fx('jet', { from: [wx, 1.8, wz], to: [fx0, 0.1, fz0], dur: 0.8, size: 0.75, arc: 1.4, n: 130 }, 0.35);
    D.sfx('splashShot', 0.35); D.sfx('bigSplash', 1.15);
    D.anim('rune', 1, 0.15, 0.3); D.anim('rune', 0.5, 0.6, 0.5);
    D.act('flare', 'dodge', 0.7);
    D.move('flare', fx0 - 1.9, fz0 + 1.0, 0.75, 0.7, { face: false });
    D.anim('flare.y', 0.9, 0.38, 0.7, 'out'); D.anim('flare.y', 0, 0.37, 1.08, 'in');
    D.cam(F(['flare'], 120, 6.5, 0.8, { lookY: -0.5, fov: 48 }));
    D.comic('SPLOOSH!', 1.15, 0.9, { x: 0.45, y: 0.32, size: 120, rot: -8, c1: '#e0f7ff', c2: '#3aa0ff' });
    D.wait(1.6);
    D.act('flare', 'ready');
  }
  // Aaron finds the symbol
  D.set('water.act', 'idle');
  D.move('aaron', -0.4, -2.9, 0.6);
  D.act('aaron', 'examine', 0.6);
  D.cam(FIX([-1.4, 0.6, -0.2], [0.2, 0.2, -1.6], { pos2: [-1.6, 0.8, 0.2], fov: 46 }));
  D.wait(0.9);
  D.anim('rune', 0.7, 0.4);
  D.say('aaron', 'Wait a second...', { cam: R('aaron', -40, 2.0, -0.1, { lookY: -0.2 }), expr: 'surprised', dur: 2.0 });
  // he watches: every attack makes the symbol flash
  D.cam(FIX([-2.2, 1.2, -4.4], [0.2, 0.4, -0.8], { fov: 48 }));
  D.set('water.act', 'throwL');
  jet(-3.6, 2.4, 0.2); jet(-2.4, 3.0, 1.3);
  D.wait(2.2);
  D.set('water.act', 'idle');
  D.act('aaron', 'idle');
  D.say('aaron', 'His power is connected to the hydrant!', { cam: R('aaron', 20, 2.4, 0.1), expr: 'surprised', act: 'point', dur: 2.7 });
  D.act('aaron', 'idle');
  D.faceChar('eric', 'aaron', 0.3);
  D.say('eric', "You figured that out while I'm out here building a whole WALL?!", { cam: R('eric', 10, 2.8, 0.15), act: 'shrug', expr: 'annoyed', dur: 3.6 });
  D.act('eric', 'idle');
  D.say('aaron', 'Eric, keep those barricades up!', { cam: R('aaron', -15, 2.4, 0.1), act: 'point', expr: 'determined', dur: 2.2 });
  D.act('aaron', 'idle');
  // the Water Guy grows and slams
  D.set('water.expr', 'angry');
  D.face('water', 0.9, 0.5);
  D.anim('water.scale', 1.5, 1.6, 0, 'out'); D.anim('rune', 1, 0.5);
  D.sfx('growRumble', 0, 0.9); D.shake(0.15, 1.6);
  D.cam(FIX([-5.5, 0.4, 6.5], [0, 2.8, -1.4], { pos2: [-4.6, 0.3, 5.6], fov: 50 }));
  D.wait(1.0);
  D.set('water.act', 'bigArm');
  D.say('water', "ENOUGH! I'LL FLOOD EVERYTHING!", { dur: 2.6, hold: false });
  D.fx('wave', { from: [1.6, -0.4], to: [5.5, -0.4], dur: 1.2, width: 8.2, height: 1.6 }, 1.85);
  D.sfx('boom', 1.75); D.sfx('waveCrash', 3.0); D.shake(0.6, 0.8, 1.75);
  D.comic('SLAM!', 1.8, 0.9, { x: 0.55, y: 0.3, size: 140, rot: -5 });
  D.anim('flood', 0.85, 1.5, 1.8);
  D.set('barr.shake', 1, 3.0);
  D.wait(3.0);
  D.cam(R('eric', 15, 2.6, 0.15));
  D.set('water.act', 'idle');
  D.act('eric', 'brace');
  D.say('eric', 'Uh-oh.', { expr: 'worried', dur: 1.5 });
  D.anim('barr.shake', 0.5, 1.5);
  D.say('flare', 'AARON! WE COULD USE A PLAN RIGHT ABOUT NOW!', { cam: R('flare', 15, 2.6, 0.15), act: 'yell', expr: 'worried', dur: 3.0 });
  D.act('flare', 'ready');
  D.act('aaron', 'examine');
  D.say('aaron', 'Flare! Keep him busy!', { cam: R('aaron', -30, 2.2, -0.05, { lookY: -0.2 }), expr: 'determined', dur: 1.9 });
  D.say('aaron', "Eric, don't let that water reach the main intersection!", { dur: 3.2 });
  D.anim('barr.shake', 1, 0.3);
  D.say('eric', "I'M TRYING!", { cam: R('eric', -20, 2.4, 0.1), act: 'brace', expr: 'worried', dur: 1.6 });
  D.anim('barr.shake', 0.3, 1.0);
  // Flare runs circles around him
  {
    const cx = D.val('water.x', D.now), cz = D.val('water.z', D.now);
    const pts = [];
    for (let i = 1; i <= 10; i++) { const a = 2.6 + i * 0.75; pts.push([cx + Math.sin(a) * 3.4, cz + Math.cos(a) * 3.4]); }
    const dur = D.path('flare', pts, 4.6);
    for (let i = 0; i < 8; i++) D.face('water', 2.6 + 0.3 + (i + 1) * 0.75 * (pts.length / 8) * 0.95, 0.5, (i * dur) / 8);
    D.cam(F(['water'], 200, 10.5, 2.4, { lookY: -1.2, orbit: 8, fov: 50 }));
    D.set('water.act', 'turn');
    D.act('flare', 'idle');
    D.say('flare', 'Hey! Over here!', { dur: 1.7 });
    D.say('flare', 'No, over here!', { dur: 1.6 });
    D.say('flare', "You know, for a guy made of water, you're pretty slow!", { cam: R('flare', 180 + 30, 3.0, 0.3), dur: 3.4 });
  }
  D.faceChar('water', 'flare', 0.3); D.faceChar('flare', 'water', 0.3);
  D.set('water.act', 'throwR');
  D.say('water', 'STOP MOVING!', { cam: R('water', 10, 5.0, -0.2, { lookY: -0.3 }), expr: 'angry', dur: 1.6 });
  jet(D.val('flare.x', D.now) + 1.2, D.val('flare.z', D.now) + 0.4, -0.6);
  D.say('flare', 'STOP MISSING!', { cam: R('flare', 20, 2.6, 0.15), act: 'taunt', expr: 'smug', dur: 1.6 });
  D.set('water.act', 'idle');
  // Aaron spots the valve
  D.act('aaron', 'idle'); D.faceTo('aaron', 1.5, -4.9, 0.4);
  D.cam(FIX([2.8, 1.3, -2.2], [1.5, 0.9, -4.9], { pos2: [2.4, 1.1, -3.0], fov: 42 }));
  D.wait(1.1);
  D.say('aaron', "That's it! The hydrant is feeding his body.", { cam: R('aaron', -25, 2.4, 0.1), expr: 'surprised', dur: 3.0 });
  D.say('aaron', 'If we shut off the water supply, we can weaken him!', { expr: 'determined', act: 'point', dur: 3.2 });
  D.act('aaron', 'idle');
  D.say('eric', "You could've said that BEFORE I built the Great Wall of Aetherfall!", { cam: R('eric', 15, 2.8, 0.15), act: 'brace', expr: 'annoyed', dur: 3.8 });
  D.say('aaron', 'Eric, hold the line!', { cam: R('aaron', 15, 2.3, 0.1), dur: 1.8 });
  // another wave hits
  D.set('water.act', 'push'); D.face('water', P / 2, 0.4);
  D.fx('wave', { from: [1.4, -0.4], to: [5.5, -0.4], dur: 1.1, width: 7.8, height: 1.3 }, 0.2);
  D.sfx('waveWhoosh', 0.2); D.sfx('waveCrash', 1.3); D.set('barr.shake', 1, 1.3); D.shake(0.3, 0.6, 1.3);
  D.cam(FIX([9.8, 1.6, 3.8], [6.2, 1.0, -0.4], { fov: 48 }));
  D.wait(1.3);
  D.say('eric', "I'M HOLDING! I'M HOLDING!", { act: 'brace', expr: 'worried', dur: 2.4 });
  D.anim('barr.shake', 0.3, 0.8);
  // Aaron rushes to the valve
  D.set('water.act', 'idle');
  D.act('aaron', 'idle');
  D.cam(F(['aaron'], 140, 5.5, 0.8, { lookY: -0.4 }));
  D.path('aaron', [[1.5, -4.05]], 4.5);
  D.wait(0.75);
  D.face('aaron', FACE.nz, 0.3);
  D.wait(0.3);

  // ===================================================================== SCENE 6: SHUT IT DOWN!
  D.scene('6. Shut It Down!');
  D.music('tense', 0.55, 0, 0.3);
  D.faceChar('water', 'aaron', 0.4);
  D.set('water.reach', 2.6); D.set('water.act', 'reach', 0.4);
  D.say('water', "HEY! DON'T TOUCH THAT!", { cam: F(['water', 'aaron'], 250, 7.0, 0.6, { lookY: -0.6 }), expr: 'angry', dur: 2.2 });
  // Flare jumps in front
  {
    D.act('flare', 'dodge');
    const tx = 0.9, tz = -2.6;
    D.move('flare', tx, tz, 0.6);
    D.anim('flare.y', 0.8, 0.3, 0, 'out'); D.anim('flare.y', 0, 0.3, 0.3, 'in');
    D.wait(0.6);
    D.faceChar('flare', 'water', 0.25);
    D.set('water.act', 'turn');
    D.say('flare', 'NOT SO FAST!', { cam: F(['flare', 'water'], 100, 6.5, 0.4, { lookY: -0.5 }), act: 'ready', expr: 'determined', dur: 1.7 });
    D.say('flare', 'You want somebody to fight? Fight ME!', { act: 'taunt', dur: 2.6 });
    D.act('flare', 'ready');
  }
  D.set('water.act', 'push');
  {
    const wx = D.val('water.x', D.now), wz = D.val('water.z', D.now);
    D.fx('wave', { from: [wx + 0.4, wz + 0.6], to: [wx + 2.0, wz + 5.2], dur: 1.0, width: 3.5, height: 1.2, back: 0 }, 0.3);
    D.sfx('waveWhoosh', 0.3); D.sfx('waveCrash', 1.3);
    D.act('flare', 'dodge', 0.5);
    D.move('flare', 2.6, -2.0, 0.6, 0.5, { face: false });
    D.anim('flare.y', 0.8, 0.3, 0.5, 'out'); D.anim('flare.y', 0, 0.3, 0.8, 'in');
    D.cam(F(['flare', 'water'], 330, 8.5, 1.4, { lookY: -0.6 }));
    D.wait(1.6);
    D.act('flare', 'ready');
  }
  D.set('water.act', 'idle');
  D.act('aaron', 'valve'); D.expr('aaron', 'determined');
  D.anim('valve.rot', 0.15, 0.4); D.anim('valve.rot', 0.05, 0.4, 0.5); D.anim('valve.rot', 0.25, 0.5, 1.0);
  D.sfx('valveCreak', 0.2, 0.7);
  D.say('aaron', 'Just a little more...', { cam: FIX([3.4, 1.4, -3.9], [1.4, 1.15, -4.4], { fov: 44 }), dur: 2.2 });
  D.sfx('valveCreak', 0, 0.8);
  D.anim('valve.rot', 0.5, 1.5);
  D.say('aaron', 'Come on! TURN!', { cam: R('aaron', 30, 1.9, 0.05), dur: 2.0 });
  D.say('eric', 'Need a hand?!', { cam: R('eric', 20, 2.6, 0.15), act: 'brace', dur: 1.6 });
  D.say('aaron', 'KEEP THE WATER BACK!', { cam: R('aaron', -30, 2.0, 0.05), dur: 1.9 });
  D.set('barr.shake', 1); D.anim('flood', 0.8, 1.0);
  D.cam(FIX([9.0, 1.4, 4.2], [5.8, 0.8, -0.6], { pos2: [8.6, 1.2, 3.4], fov: 46 }));
  D.wait(0.8);
  D.anim('barr.shake', 0.2, 1.4);
  D.say('eric', "I'M STARTING TO REGRET SAYING I LOVE MISSIONS!", { cam: R('eric', 10, 2.6, 0.15), act: 'brace', expr: 'worried', dur: 3.2 });
  D.look('eric', -0.7, 0, 0.4);
  D.wait(0.6);
  D.say('eric', "...Actually, no, I'm not!", { expr: 'grin', dur: 2.0 });
  D.look('eric', 0, 0, 0.4);
  D.act('eric', 'laugh'); D.expr('eric', 'laugh');
  D.sound('Eric laughs', 1.0);
  D.wait(1.0);
  D.act('eric', 'brace'); D.expr('eric', 'determined');
  // CLUNK
  D.act('aaron', 'valveTurn');
  D.anim('valve.rot', 3.4, 0.5, 0, 'out');
  D.sfx('clunk', 0.45); D.shake(0.2, 0.4, 0.45);
  D.comic('CLUNK!', 0.45, 1.0, { x: 0.5, y: 0.3, size: 130, rot: 6, c1: '#ffffff', c2: '#ffc21a' });
  D.cam(FIX([2.4, 1.3, -3.0], [1.5, 1.0, -4.6], { fov: 40 }));
  D.anim('hyd.flow', 0, 0.5, 0.5); D.anim('rune', 0, 0.6, 0.5);
  D.music('none', 0, 0.45, 0.2);
  D.wait(1.4);
  D.set('water.act', 'shocked'); D.set('water.expr', 'shocked');
  D.say('water', 'Wait... WHAT?!', { cam: R('water', 0, 5.5, -0.6, { lookY: -0.5 }), dur: 2.0 });
  D.anim('water.scale', 0.35, 1.8, 0, 'inout');
  D.sfx('shrink', 0); D.anim('flood', 0.12, 3.0);
  D.cam(F(['water'], 30, 3.2, 0.8, { lookY: -0.2, dist2: 2.0, h2: 0.5 }));
  D.wait(2.2);
  D.music('comedy', 0.45, 0, 0.3);
  for (const c of HEROES) D.faceChar(c, 'water', 0.4);
  D.act('aaron', 'idle'); D.expr('aaron', 'smug');
  D.say('flare', 'Ohhh! Look at you now!', { cam: R('flare', -15, 2.6, 0.1), act: 'handsHips', expr: 'smug', dur: 2.0 });
  D.set('water.act', 'tiny'); D.set('water.expr', 'angry');
  D.fx('burst', { x: D.val('water.x', D.now), y: 0.5, z: D.val('water.z', D.now), n: 10, speed: 1.2, up: 0.6, size: 0.04, life: 0.6 }, 0.6);
  D.say('water', 'This is temporary!', { cam: F(['water'], 20, 2.0, 0.4, { lookY: -0.1 }), dur: 2.0 });
  D.say('eric', 'Bro went from a flood to a water bottle!', { cam: R('eric', 15, 2.6, 0.15), act: 'laugh', expr: 'laugh', dur: 2.9 });
  D.act('eric', 'idle'); D.expr('eric', 'happy');
  {
    const wx = D.val('water.x', D.now), wz = D.val('water.z', D.now);
    D.path('aaron', [[wx - 1.3, wz - 1.1]], 1.3);
    D.faceChar('aaron', 'water', 0.3, 1.0);
  }
  D.say('aaron', "It's over. You can't flood the city anymore.", { cam: R('aaron', 20, 2.6, 0.1), expr: 'determined', dt: 0.4, dur: 3.0 });
  D.set('water.act', 'dramatic'); D.set('water.expr', 'mischief');
  D.say('water', 'You may have stopped me today, but—', { cam: F(['water'], -20, 2.4, 0.4, { lookY: -0.1 }), dur: 2.3, gap: 0 });
  // slides into a barricade
  D.set('water.act', 'slide'); D.set('water.expr', 'shocked');
  D.move('water', 5.3, -0.65, 1.0, 0, { ease: 'in', face: false });
  D.sfx('slide', 0); D.sfx('bonk', 1.0); D.set('barr.shake', 0.6, 1.0); D.anim('barr.shake', 0, 0.5, 1.05);
  D.comic('BONK!', 1.0, 0.8, { x: 0.6, y: 0.4, size: 100, rot: 10 });
  D.cam(FIX([3.6, 1.2, 3.4], [4.8, 0.3, -0.6], { fov: 44 }));
  D.wait(1.0);
  D.set('water.act', 'bonk');
  D.wait(0.5);
  D.say('water', 'Ow.', { cam: F(['water'], -40, 1.8, 0.3, { lookY: -0.1 }), dur: 1.3 });
  for (const c of HEROES) D.faceChar(c, 'water', 0.4);
  D.say('flare', 'Terrifying.', { cam: R('flare', 15, 2.4, 0.1), act: 'crossArms', expr: 'smug', dur: 1.6 });
  // escape attempt toward the drain
  D.set('water.act', 'flail'); D.set('water.expr', 'mischief');
  D.move('water', 3.9, -2.4, 1.6, 0, { face: true });
  D.sfx('splashSteps', 0, 0.6);
  D.cam(F(['water'], 40, 4.0, 1.0, { lookY: -0.3 }));
  D.say('aaron', 'Eric, block the drain!', { act: 'point', dur: 1.6, hold: false, dt: 0.2 });
  D.wait(0.2);
  D.wait(1.6);
  D.act('aaron', 'idle');
  D.path('eric', [[4.6, -2.9]], 4.5);
  D.say('eric', 'WITH PLEASURE!', { cam: R('eric', 20, 2.6, 0.1), expr: 'grin', dur: 1.4, hold: false });
  D.wait(0.7);
  D.anim('cover', 1, 0.35, 0, 'in'); D.sfx('clank', 0.35, 1.0);
  D.move('water', 3.1, -2.2, 0.4, 0.35, { face: false, ease: 'out' });
  D.cam(FIX([2.0, 1.4, -0.4], [3.4, 0.3, -3.0], { fov: 44 }));
  D.comic('CLANG!', 0.35, 0.8, { x: 0.6, y: 0.35, size: 100, rot: -8 });
  D.wait(1.2);
  D.set('water.act', 'flail'); D.set('water.expr', 'angry'); D.set('water.puddle', 1.6);
  for (let i = 0; i < 4; i++) D.fx('burst', { x: 3.1, y: 0.3, z: -2.2, n: 12, speed: 1.4, up: 0.7, size: 0.04, life: 0.6 }, i * 0.5);
  D.sfx('splashSteps', 0, 0.5);
  D.say('water', "YOU HAVEN'T SEEN THE LAST OF ME!", { cam: F(['water'], 30, 2.2, 0.5, { lookY: -0.1 }), dur: 2.6 });
  D.faceChar('eric', 'water', 0.3);
  D.say('eric', "Yeah, yeah. We've heard that one before.", { cam: R('eric', -20, 2.4, 0.1), act: 'handsHips', expr: 'smug', dur: 2.8 });
  D.set('water.act', 'idle');
  D.say('aaron', 'City water pressure is returning to normal.', { cam: R('aaron', 25, 1.8, 0.0, { lookY: -0.2 }), act: 'checkWrist', expr: 'happy', dur: 2.8 });
  D.sfx('beep', -2.6, 0.6);
  D.say('aaron', 'Mission complete.', { act: 'idle', dur: 1.6 });
  D.fx('drip', { who: 'flare', dur: 4.2, rate: 26, h: 1.3 }, 0);
  D.say('flare', "Great. First I lose my coffee, and now I'm soaked.", { cam: R('flare', 20, 2.4, 0.1), act: 'lookDown', expr: 'annoyed', dur: 3.4 });
  D.act('flare', 'idle');
  D.faceChar('eric', 'aaron', 0.4);
  D.say('eric', 'So... did we win?', { cam: F(['eric', 'aaron'], 200, 4.0, 0.2), act: 'shrug', expr: 'surprised', dur: 2.0 });
  D.say('aaron', 'We won.', { cam: R('aaron', 15, 2.2, 0.1), act: 'thumbsUp', expr: 'happy', dur: 1.6 });
  D.music('victory', 0.6, 0, 0.1);
  D.say('eric', "LET'S GOOOOOO!", { cam: R('eric', 0, 3.4, 0.4, { lookY: -0.3 }), act: 'dance', expr: 'grin', dur: 2.4 });
  D.act('flare', 'crossArms'); D.expr('flare', 'smug'); D.act('aaron', 'idle'); D.expr('aaron', 'happy');
  D.cam(F(['aaron', 'flare', 'eric'], 200, 9, 2.0, { lookY: -0.4, dist2: 12, h2: 3.5 }));
  D.wait(2.8);
  D.anim('fade', 1, 0.4);
  D.wait(0.5);

  // ===================================================================== SCENE 7: MISSION COMPLETE
  D.scene('7. Mission Complete');
  D.location('control');
  cast(['aaron', 'flare', 'eric']);
  D.set('fade', 0); D.set('map.mode', 1); D.set('map.zoom', 0); D.set('map.blip', 0);
  D.music('hq', 0.55, 0, 0.5);
  D.place('aaron', 0.5, -1.9, FACE.nz); D.place('flare', -1.3, -1.4, FACE.nz); D.place('eric', 2.0, -1.3, FACE.nz);
  for (const c of HEROES) { D.act(c, 'idle'); D.expr(c, 'happy'); D.set(`${c}.hy`, 0); }
  D.expr('flare', 'neutral');
  D.cam(FIX([0, 2.2, 3.6], [0.2, 1.7, -3.5], { pos2: [0, 2.0, 2.6], fov: 48 }));
  D.wait(1.0);
  D.say('aaron', 'All systems are back to normal.', { cam: FIX([0.6, 2.0, -0.6], [0, 2.1, -4.6], { fov: 50 }), dur: 2.4 });
  D.face('flare', 1.4, 0.4); D.face('aaron', -1.2, 0.4); D.face('eric', -1.4, 0.4);
  D.say('flare', "Good. I'm going to get another coffee.", { cam: F(['aaron', 'flare'], 250, 3.8, 0.25, { lookY: -0.2 }), expr: 'neutral', dur: 2.8 });
  D.say('eric', "And I'm going back to my game!", { cam: R('eric', 0, 2.6, 0.1), expr: 'grin', dur: 2.3 });
  D.cam(FIX([-3.0, 2.2, 3.4], [2.5, 1.3, -0.5], { fov: 50 }));
  D.path('eric', [[6.6, 1.4]], 5.0);
  D.sfx('whoosh', 0.1, 0.6);
  D.path('flare', [[1.0, 0.2]], 1.3, 0.4);
  D.wait(1.6);
  D.hide('eric');
  D.faceChar('aaron', 'flare', 0.3);
  D.say('aaron', 'Hold on. We did save the city from getting flooded.', { cam: F(['aaron', 'flare'], 290, 3.8, 0.25, { lookY: -0.2 }), act: 'handsHips', expr: 'smug', dur: 3.4 });
  D.faceChar('flare', 'aaron', 0.4);
  D.say('flare', 'Correct.', { cam: F(['aaron', 'flare'], 250, 3.8, 0.25, { lookY: -0.2 }), expr: 'neutral', dur: 1.4 });
  D.say('aaron', 'We worked together.', { cam: F(['aaron', 'flare'], 290, 3.8, 0.25, { lookY: -0.2 }), dur: 1.8 });
  D.say('flare', 'Also correct.', { cam: F(['aaron', 'flare'], 250, 3.8, 0.25, { lookY: -0.2 }), act: 'crossArms', dur: 1.6 });
  D.say('aaron', 'And we deserve a reward.', { cam: F(['aaron', 'flare'], 290, 3.8, 0.25, { lookY: -0.2 }), dur: 2.0 });
  D.wait(0.6);
  D.say('flare', 'What kind of reward?', { cam: F(['aaron', 'flare'], 250, 3.8, 0.25, { lookY: -0.2 }), act: 'idle', expr: 'surprised', dur: 1.9 });
  D.say('aaron', 'Pizza.', { cam: F(['aaron', 'flare'], 290, 3.8, 0.25, { lookY: -0.2 }), expr: 'happy', dur: 1.5 });
  D.say('flare', "Now you're talking.", { cam: F(['aaron', 'flare'], 250, 3.8, 0.25, { lookY: -0.2 }), expr: 'grin', act: 'thumbsUp', dur: 2.0 });
  D.sfx('stampede', 0.1, 0.9);
  D.say('eric', 'DID SOMEBODY SAY PIZZA?!', { label: 'ERIC (FROM DOWNSTAIRS)', cam: FIX([-2.4, 2.0, 3.2], [3.8, 1.3, 0.4], { fov: 48 }), dur: 2.4 });
  D.place('eric', 6.6, 1.4, FACE.nx); D.act('eric', 'idle'); D.expr('eric', 'grin');
  D.path('eric', [[2.6, -0.1]], 5.5);
  D.faceChar('flare', 'eric', 0.3, 0.3); D.faceChar('aaron', 'eric', 0.3, 0.3);
  D.expr('flare', 'surprised'); D.expr('aaron', 'surprised');
  D.wait(0.8);
  D.say('eric', "I'M ALREADY READY!", { cam: F(['eric', 'aaron', 'flare'], 230, 5.4, 0.3, { lookY: -0.2 }), act: 'cheer', dur: 1.9 });
  D.act('eric', 'idle');
  D.say('aaron', "You weren't even listening!", { cam: F(['aaron', 'flare'], 290, 3.8, 0.25, { lookY: -0.2 }), act: 'shrug', expr: 'annoyed', dur: 2.2 });
  D.say('eric', 'I heard the important part!', { cam: F(['eric', 'aaron', 'flare'], 230, 5.4, 0.3, { lookY: -0.2 }), act: 'thumbsUp', expr: 'grin', dur: 2.2 });
  for (const c of HEROES) { D.act(c, 'laugh'); D.expr(c, 'laugh'); }
  D.sound('Everyone laughs', 1.8);
  D.cam(F(['aaron', 'flare', 'eric'], 160, 5.5, 0.4));
  D.wait(1.8);
  for (const c of HEROES) { D.act(c, 'idle'); D.expr(c, 'happy'); }
  D.path('eric', [[6.6, 1.4]], 3.6); D.path('aaron', [[6.4, 0.9]], 3.4); D.path('flare', [[6.3, 1.9]], 3.4, 0.2);
  D.wait(1.4);
  D.anim('fade', 1, 0.5);
  D.wait(0.6);

  // ===================================================================== SCENE 8: PIZZA TIME
  D.scene('8. Pizza Time');
  D.location('living');
  cast(['aaron', 'flare', 'eric']);
  D.set('fade', 0); D.set('evening', 1); D.set('pizza', 1); D.set('tv.off', 1); D.set('ctrl.couch', 0); D.set('ctrl.held', 0);
  D.music('chill', 0.62, 0, 0.6);
  D.place('eric', -0.85, 0.82, FACE.nz); D.place('aaron', 0.0, 0.82, FACE.nz); D.place('flare', 0.85, 0.82, FACE.nz);
  for (const c of HEROES) { D.act(c, 'sitEat'); D.expr(c, 'happy'); D.set(`${c}.slice`, 1); D.set(`${c}.hy`, 0); }
  D.act('flare', 'sitRelax'); D.set('flare.slice', 0);
  D.cam(F(['aaron'], 180, 4.4, 0.2, { lookY: -0.2, dist2: 3.6 }));
  D.card('location', 2.6, { text: 'LATER THAT EVENING' });
  D.sfx('pizzaBox', 0.3, 0.6);
  D.wait(1.2);
  D.say('eric', 'Best mission EVER!', { cam: R('eric', -15, 2.0, 0.1), act: 'sitCheer', expr: 'grin', dur: 2.0 });
  D.act('eric', 'sitEat');
  D.act('flare', 'sitEat', 0.0); D.set('flare.slice', 1);
  D.look('flare', -0.5, 0, 0.4);
  D.say('flare', 'You say that about every mission.', { cam: R('flare', 15, 2.0, 0.1), expr: 'smug', dur: 2.4 });
  D.look('flare', 0, 0, 0.4);
  D.say('eric', 'Because every mission is awesome!', { cam: R('eric', -10, 2.0, 0.1), act: 'sitCheer', dur: 2.4 });
  D.act('eric', 'sitEat');
  D.say('aaron', 'At least the city is safe.', { cam: R('aaron', 0, 1.9, 0.08), expr: 'happy', act: 'sitRelax', dur: 2.2 });
  D.look('flare', -0.55, 0, 0.4);
  D.say('flare', "And next time, we're stopping for my coffee FIRST.", { cam: F(['flare', 'aaron'], 190, 2.8, 0.15), act: 'sitRelax', expr: 'determined', dur: 3.2 });
  D.look('aaron', 0.5, 0, 0.4);
  D.say('aaron', "I'll think about it.", { cam: R('aaron', 10, 1.9, 0.08), expr: 'smug', dur: 1.8 });
  D.say('flare', "That's not a yes.", { cam: R('flare', -10, 1.9, 0.08), expr: 'annoyed', dur: 1.6 });
  D.say('aaron', "It's a maybe.", { cam: R('aaron', 10, 1.9, 0.08), expr: 'smug', dur: 1.5 });
  D.say('flare', 'AARON!', { cam: R('flare', 0, 2.1, 0.1), expr: 'angry', dur: 1.3 });
  D.look('eric', 0.5, 0, 0.3);
  D.say('eric', 'HAHAHA! HE GOT YOU!', { cam: F(['eric', 'aaron', 'flare'], 180, 3.4, 0.2), act: 'sitLaugh', expr: 'laugh', dur: 2.4 });
  D.act('aaron', 'sitLaugh'); D.expr('aaron', 'laugh');
  D.look('aaron', 0, 0, 0.4); D.look('flare', 0, 0, 0.4); D.look('eric', 0, 0, 0.4);
  D.act('flare', 'sitEat', 1.0); D.expr('flare', 'happy', 1.0);
  D.act('aaron', 'sitEat', 1.6); D.expr('aaron', 'happy', 1.6);
  D.act('eric', 'sitEat', 1.8); D.expr('eric', 'happy', 1.8);
  D.sound('The three keep laughing and joking', 2.4);
  D.cam(F(['aaron'], 180, 3.0, 0.3, { lookY: -0.3, dist2: 5.0, h2: 1.4, fov: 40, fov2: 62 }));
  D.wait(4.2);
  // headquarters in the evening
  D.location('hqExt');
  cast([]);
  D.set('hcar.vis', 1); D.set('hcar.x', -2.5);
  D.cam(FIX([16, 3.0, 22], [0, 6.0, -8], { pos2: [12, 3.2, 17], fov: 46 }));
  D.wait(0.8);
  D.say('aaron', 'You know, I have a feeling this is only the beginning.', { dur: 3.6 });
  D.say('flare', 'What makes you say that?', { dur: 2.2 });
  D.say('aaron', 'Just a feeling.', { dur: 2.0 });
  D.wait(0.3);
  // the tiny blue signal nobody notices
  D.location('control');
  cast([]);
  D.set('map.mode', 1); D.set('map.zoom', 0);
  D.music('none', 0, 0, 0.8);
  D.cam(FIX([0, 2.2, -0.2], [0.6, 2.15, -4.6], { pos2: [0.9, 2.2, -1.6], fov: 50 }));
  D.set('map.blip', 0);
  D.anim('map.blip', 1, 0.1, 1.2); D.anim('map.blip', 0, 0.3, 1.5);
  D.anim('map.blip', 1, 0.1, 2.1); D.anim('map.blip', 0, 0.4, 2.4);
  D.sfx('blip', 1.2, 0.45); D.sfx('blip', 2.1, 0.45);
  D.sound('A tiny blue signal flashes on the monitor', 2.4, 1.2);
  D.wait(3.6);
  D.set('fade', 1);
  D.sfx('cutBlack', 0, 0.5);
  D.wait(1.0);

  // ===================================================================== END CREDITS
  D.scene('End Credits');
  D.location('title');
  D.set('fade', 1); D.anim('fade', 0, 1.0);
  D.music('theme', 0.8, 0, 0.1);
  D.set('title.k', 1); D.set('title.sub', 0); D.set('title.y', 1.65);
  D.cam(FIX([0, 0.6, 10.5], [0, 0.4, 0], { pos2: [0, 0.5, 10.0], fov: 42 }));
  const endAt = 450;
  const credDur = endAt - D.now;
  D.card('credits', credDur, {
    lines: [
      { text: 'Season 1, Episode 1:  "BE READY!"', bold: true, y: 0.5, color: '#ffd23f' },
      { text: 'Starring  Aaron  ·  Flare  ·  Eric  ·  and the Water Guy', y: 0.58 },
      { text: 'Created by Nick', y: 0.65 },
      { text: 'New episodes every Saturday at 8:00 AM.', big: true, y: 0.77, color: '#7fd4ff' },
      { text: 'END OF EPISODE 1', bold: true, y: 0.88 },
    ],
  });
  D.wait(credDur - 1.6);
  D.anim('fade', 1, 1.5);
  D.wait(1.6);
  return D.end();
}
