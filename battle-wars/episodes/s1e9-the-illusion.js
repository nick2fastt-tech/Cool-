// BATTLE WARS - Season 1, Episode 9: "THE ILLUSION"
import { createDirector, readTime } from '../src/director.js';
import { behemothRig, behParams } from '../src/behemothRig.js';

export const META = {
  id: 's1e9-the-illusion', title: 'Battle Wars - S1E9 - The Illusion', file: 'Battle_Wars_S1E9_The_Illusion', costume: 'blue2',
  behemoth: true, e6: true, e7: true, e8: true, e9: true,
  extras: { aaron: ['armor'], flare: ['armor'], eric: ['armor'], leon: ['armor'], cowboy: ['mustache', 'dusty'] },
};

const P = Math.PI;
const TEAM = ['aaron', 'flare', 'eric', 'greg', 'leon'];
const SIX = [...TEAM, 'cowboy'];
const ALL = ['aaron', 'flare', 'eric', 'barista', 'leon', 'greg', 'newark', 'cowboy', 'guard', 'guard2', 'officer', 'officer2', 'ped1', 'ped2', 'ped3', 'soulX',
  'clay1', 'clay2', 'clay3', 'clay4', 'clay5', 'clay6', 'clay7', 'clay8', 'water', 'soul', 'dog', 'birddog', 'tiger', 'beh', 'ufo', 'horse', 'cat', 'bird', 'pigeon1', 'pigeon2', 'pigeon3', 'pigeon4', 'titan', 'shadow'];

export function buildEpisode() {
  const D = createDirector();
  // a little more reading time per caption (viewers are 9-14 and read the captions)
  const say0 = D.say;
  D.say = (who, text, opts = {}) => say0(who, text, { ...opts, dur: (opts.dur ?? readTime(text)) * 1.3, gap: opts.gap ?? 0.42 });
  // slightly longer holds on every shot, so the action has room to breathe
  const HOLD = 1.28, wait0 = D.wait, sound0 = D.sound;
  D.wait = (d) => wait0(d * HOLD);
  D.sound = (text, dur = 1.6, dt = 0) => sound0(text, dur * HOLD, dt);
  const F = (on, yaw, dist, h = 0.15, x = {}) => ({ type: 'frame', on: Array.isArray(on) ? on : [on], yaw, dist, h, ...x });
  const R = (on, yaw, dist, h = 0.15, x = {}) => F(on, yaw, dist, h, { rel: Array.isArray(on) ? on[0] : on, ...x });
  const FIX = (pos, look, x = {}) => ({ type: 'fixed', pos, look, ...x });
  const props = (c, r = 'none', l = 'none') => { D.set(`${c}.propR`, r); D.set(`${c}.propL`, l); };
  const cast = (list) => {
    for (const c of ALL) { if (!list.includes(c)) D.hide(c); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); D.set(`${c}.propR`, 'none'); D.set(`${c}.propL`, 'none'); }
    D.set('greg.stretch', 0); D.set('greg.wrap', 0); D.set('horse.alpha', 1); D.set('cowboy.alpha', 1); D.set('cowboy.y', 0); D.set('horse.scale', 1); D.set('horse.rz', 0); D.set('horse.y', 0);
    D.set('dome.on', 0); D.set('cloak.vis', 0); D.set('vision', 0); D.set('illusion', 0); D.set('cowboy.whiteEyes', 0);
  };
  const pos = (c, dt = 0) => [D.val(`${c}.x`, D.now + dt), D.val(`${c}.z`, D.now + dt)];
  const rigAt = (dt = 0) => behemothRig(behParams(D.val, D.now + dt));
  const roar = (dur = 2.2, text = 'RRRRRRAAAAAAAAHHHH!', opts = {}) => {
    D.anim('beh.jaw', 1, 0.3); D.anim('beh.nod', (opts.nod ?? -0.35), 0.4);
    D.sfx('monsterRoar', 0, opts.vol ?? 1); D.shake(opts.shake ?? 0.8, dur);
    D.say('behemoth', text, { dur, cam: opts.cam });
    D.anim('beh.jaw', 0, 0.4); D.anim('beh.nod', opts.after ?? 0, 0.5);
  };
  const fly = (c, x, y, z, dur, dt = 0, ease = 'inout') => { D.anim(`${c}.x`, x, dur, dt, ease); D.anim(`${c}.y`, y, dur, dt, ease); D.anim(`${c}.z`, z, dur, dt, ease); };
  const everyone = (fn, list = TEAM) => { for (const c of list) fn(c); };
  const FRED = { label: 'FRED' };

  for (const c of ALL) { D.hide(c); D.act(c, 'idle'); D.expr(c, 'neutral'); D.set(`${c}.y`, 0); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); D.set(`${c}.roll`, 0); props(c); }
  cast([]);
  D.set('fade', 1); D.set('cowboy.reveal', 1); D.set('cowboy.hatTilt', 0.22); D.set('cowboy.scuff', 1);
  D.set('beh.s', 10); D.set('beh.rear', 0.45); D.set('beh.plates', 1); D.set('beh.claws', 1.6); D.set('beh.eyes', 1); D.set('beh.sway', 0.3); D.set('beh.slither', 0.4);
  D.set('beh.jaw', 0); D.set('beh.nod', 0); D.set('beh.look', 0); D.set('beh.curl', 0); D.set('beh.tailLift', 0); D.set('beh.shake', 0); D.set('beh.dark', 0.35); D.set('beh.cracks', 0.35);
  D.set('beh.eyesRed', 0); D.set('beh.eyesPurple', 1); D.set('beh.aura', 0.4); D.set('beh.bolts', 0.15); D.set('beh.crest', 0); D.set('beh.blue', 0); D.set('beh.goo', 0); D.set('beh.dissolve', 0); D.set('beh.flickerBlue', 0); D.set('beh.y', 0);
  D.set('crown.mode', 'world'); D.set('crown.gone', 1); D.set('crown.rust', 1); D.set('crown.glow', 0); D.set('crown.size', 0.2);
  D.set('horse.glow', 0.3); D.set('horse.purple', 0); D.set('horse.act', 'idle');
  D.set('soul.eyes', 1); D.set('soul.palm', 0); D.set('soul.raise', 0); D.set('soul.violet', 1); D.set('soul.charge', 0); D.set('soul.y', 0);
  D.set('sky.mode', 3); D.set('night.purple', 0.3); D.set('roof.glow', 0); D.set('citizens.on', 0);
  D.set('night', 0); D.set('evening', 0); D.set('tv.off', 1); D.set('tv.fall', -1); D.set('laptop.on', 0); D.set('pizza', 0); D.set('table.held', 0);
  D.set('dome.on', 0); D.set('dome.hit', 0); D.set('titan.eyes', 1); D.set('titan.s', 1); D.set('shadow.s', 1); D.set('shadow.eyes', 0);
  D.set('soulX.eyeGlow', 1); D.set('soulX.energy', 0);
  D.set('living.dark', 0); D.set('living.emergency', 0); D.set('living.flicker', 0); D.set('door.open', 0); D.set('door.shake', 0); D.set('door.glass', 0); D.set('door.purple', 0);
  D.set('tv.soul', 0); D.set('hallShadow.vis', 0); D.set('wallShadow.vis', 0); D.set('living.equip', 0); D.set('living.burger', 0); D.set('pizza.single', 1);
  D.set('map.mode', 2); D.set('map.zoom', 0); D.set('map.blip', 0); D.set('hall.far', 14); D.set('hall.warp', 1);
  D.set('hq.purple', 0);

  // ===================================================================== SCENE 1: THE COUNTERATTACK
  D.scene('1. The Counterattack');
  D.location('downtown');
  cast([...SIX, 'beh']);
  D.set('ufo.vis', 0); D.set('ufo.shade', 0); D.set('facade.break', 0); D.set('lightning', 0);
  D.set('carA.vis', 1); D.set('carA.x', 39); D.set('carA.z', -6.6); D.set('carA.ry', 0.9); D.set('carA.roll', 1.55); D.set('carA.lift', 0);
  D.set('carB.vis', 1); D.set('carB.x', 40); D.set('carB.z', 7.2); D.set('carB.ry', P + 0.8); D.set('carB.roll', 0); D.set('carB.lift', 0);
  D.set('lampA.vis', 1); D.set('lampA.x', 33); D.set('lampA.z', -4.7); D.set('lampA.ry', 0); D.set('lampA.fall', 1);
  D.set('lampB.vis', 1); D.set('lampB.x', 35); D.set('lampB.z', 4.7); D.set('lampB.ry', P); D.set('lampB.fall', 0);
  D.set('cracks', 1); D.set('cracks.x', 0.6); D.set('cracks.z', 3.0); D.set('cracks.size', 7); D.set('mark', 0); D.set('can.vis', 0); D.set('cons.vis', 0); D.set('shards', 0); D.set('barrier.vis', 0);
  const LINE = [['leon', -2.6], ['flare', -1.35], ['aaron', -0.1], ['cowboy', 1.15], ['eric', 2.4], ['greg', 3.65]];
  for (const [c, z] of LINE) { D.place(c, 1.0, z, P / 2); D.act(c, c === 'cowboy' ? 'idle' : 'ready'); D.expr(c, 'determined'); }
  D.expr('cowboy', 'worried');
  D.show('beh'); D.place('beh', 19, 0.5, -P / 2); D.set('beh.rear', 0.45);
  D.music('action', 0.42, 0, 0.3);
  D.anim('fade', 0, 0.8);
  // Behemoth charges
  D.anim('beh.x', 12, 2.8, 0, 'in'); D.sfx('stampede', 0, 0.6);
  for (const tt of [0.5, 1.2, 1.9, 2.5]) { D.sfx('thud', tt, 0.9); D.shake(0.45, 0.4, tt); }
  D.cam(FIX([-2.0, 1.2, 8.5], [10, 4, -0.6], { fov: 52 }));
  D.sound('Behemoth is charging toward the team', 2.1, 0.4); D.wait(2.4);
  D.cam(FIX([10.5, 0.35, 6.5], [15, 2.2, 0.5], { fov: 54 }));
  D.sound('The ground shakes with every step', 1.6, 0.1); D.wait(1.6);
  D.say('aaron', 'EVERYBODY MOVE!', { cam: R('aaron', -30, 2.2, 0.15), act: 'point', expr: 'angry', dur: 1.1, gap: 0.1 });
  // the head swings toward them
  D.anim('beh.rear', 0.8, 0.8); D.anim('beh.nod', -0.35, 0.8); D.anim('beh.look', 0.45, 0.5); D.anim('beh.look', -0.15, 0.8, 0.5); D.anim('beh.jaw', 1, 0.4); D.anim('beh.jaw', 0.3, 0.6, 1.0);
  D.sfx('monsterRoar', 0, 0.8); D.sfx('whoosh', 0.6, 0.7); D.shake(0.5, 0.8);
  everyone((c) => { D.act(c, 'shield'); D.expr(c, 'shocked'); }, ['flare', 'eric', 'greg', 'leon', 'cowboy']);
  D.act('aaron', 'wristUp'); D.expr('aaron', 'determined');
  D.cam(FIX([4.5, 0.9, 9.0], [9, 5.5, 0.3], { fov: 58 }));
  D.sound('Behemoth swings its enormous head toward them', 2.2); D.wait(2.4);
  D.set('fade', 1); D.sfx('cutBlack', 0, 0.4); wait0(0.25);

  // ---- meanwhile, in the lair
  D.location('lair');
  cast(['soul', 'horse']);
  D.set('cage.open', 1); D.set('lock.float', 0); D.set('lock.gone', 1); D.set('lair.glow', 0.3);
  D.show('soul'); D.place('soul', -1.4, 7.2, P / 2 - 0.25); D.set('soul.y', 0); D.set('soul.raise', 0); D.set('soul.palm', 0); D.set('soul.eyes', 1);
  D.show('horse'); D.place('horse', 1.3, 7.4, -P / 2); D.set('horse.purple', 1); D.set('horse.glow', 1.0); D.set('horse.act', 'idle'); D.set('horse.rz', 0);
  D.music('villain', 0.36, 0, 0.3);
  D.anim('fade', 0, 0.4);
  D.cam(FIX([0.2, 2.0, 13.6], [0.0, 1.5, 7.0], { pos2: [0.3, 1.9, 12.8], fov: 44 }));
  D.card('location', 3.0, { text: "THE SOUL STEALER'S LAIR" });
  D.sound('Meanwhile, in the Soul Stealer’s lair, he stands beside Fred’s horse', 3.0, 0.3); D.wait(3.4);
  D.anim('soul.raise', 0.45, 0.8); D.anim('soul.palm', 0.5, 0.8); D.sfx('crystalHum', 0, 0.4);
  D.say('soul', 'I will be taking your powers now.', { cam: F(['soul'], 35, 3.0, 0.1, { lookY: -0.25, fov: 40 }), dur: 2.0 });
  D.say('soul', "They'll make me stronger.", { dur: 1.6 });
  D.anim('horse.glow', 2.2, 0.5); D.anim('horse.glow', 1.0, 0.8, 0.9); D.sfx('crystalPower', 0, 0.4);
  D.cam(F(['horse'], -150, 3.0, 0.3, { lookY: -0.4, fov: 44 }));
  D.sound('The glowing markings on the horse flicker purple', 2.0); D.wait(2.0);
  D.set('horse.act', 'snort'); D.sfx('horseSnort', 0.2, 0.6);
  D.cam(R('horse', 35, 2.4, 0.0, { lookY: -0.2, fov: 40 }));
  D.sound('The horse looks at him...', 1.6); D.wait(1.8);
  D.set('horse.act', 'idle');
  D.anim('horse.x', 2.5, 1.5, 0, 'inout'); D.sfx('hooves', 0.2, 0.4);
  D.cam(FIX([0.4, 1.6, 11.8], [1.6, 1.3, 7.2], { fov: 46 }));
  D.sound('...slowly steps backward...', 1.6, 0.1); D.wait(1.8);
  {
    D.face('horse', 0.2, 0.35);
    D.path('horse', [[3.2, 10.0], [3.6, 12.9]], 3.4, 0.3);
    D.sfx('gallop', 0.3, 0.7); D.sfx('horseNeigh', 0.2, 0.4);
    D.cam(FIX([8.4, 1.4, 11.6], [3.2, 1.3, 10.4], { fov: 48 }));
    D.sound('...and suddenly tries to run!', 1.3, 0.1); wait0(1.4);
    D.anim('soul.raise', 1, 0.4); D.anim('soul.palm', 1, 0.4); D.face('soul', 0.7, 0.4);
    D.say('soul', "Oh, no you don't.", { cam: F(['soul'], 25, 2.6, 0.1, { lookY: -0.25, fov: 40 }), dur: 1.2, gap: 0.1 });
    const px = 3.75, pz = 14.4;
    D.fx('portal', { x: px, y: 1.5, z: pz, ry: 0, radius: 2.0, dur: 4.6, color: 0xa040ff });
    D.sfx('portalOpen', 0, 0.9);
    D.set('horse.act', 'rear'); D.sfx('horseNeigh', 0.15, 0.8);
    D.cam(FIX([1.6, 1.7, 8.4], [3.7, 1.6, 14.4], { fov: 50 }));
    D.sound('He opens a purple portal directly in front of the horse', 2.0, 0.1); wait0(2.6);
    D.anim('horse.x', px, 0.9, 0, 'in'); D.anim('horse.z', pz + 0.4, 0.9, 0, 'in'); D.anim('horse.y', 1.0, 0.9, 0, 'in');
    D.anim('horse.scale', 0.05, 0.9, 0.05, 'in'); D.anim('horse.alpha', 0, 0.6, 0.4, 'in'); D.anim('horse.rz', 1.4, 0.9, 0, 'in');
    D.sfx('teleport', 0.15, 0.8); D.sfx('swirl', 0, 0.6);
    D.fx('sparks', { x: px, y: 1.5, z: pz, n: 70, color: 0xc070ff, speed: 2.6 }, 0.9);
    D.sound('The horse gets pulled into the portal!', 2.0, 0.6); wait0(3.4);
    D.hide('horse');
  }
  D.set('fade', 1); D.sfx('cutBlack', 0, 0.4); wait0(0.25);

  // ---- back in the city: the slam
  D.location('downtown');
  cast([...SIX, 'beh']);
  const CL = { leon: [1.7, -0.9], flare: [0.3, -1.1], aaron: [1.5, 0.6], cowboy: [-0.1, 0.4], eric: [0.9, 1.9], greg: [-0.9, 2.3] };
  for (const c of SIX) { D.place(c, CL[c][0], CL[c][1], P / 2 + (c === 'greg' ? 0.3 : 0)); D.act(c, 'shield'); D.expr(c, 'shocked'); }
  D.act('aaron', 'wristUp'); D.expr('aaron', 'determined');
  D.place('beh', 11, 0.5, -P / 2); D.set('beh.rear', 0.8); D.set('beh.nod', -0.35); D.set('beh.look', 0); D.set('beh.jaw', 0.3);
  D.music('none', 0, 0, 0.2);
  D.set('fade', 0);
  {
    D.anim('beh.rear', 0.0, 0.45, 0.35, 'in'); D.anim('beh.nod', 1.0, 0.45, 0.35, 'in'); D.anim('beh.jaw', 0, 0.3, 0.35);
    D.cam(FIX([-7.0, 2.4, 8.0], [5.0, 3.2, 0.5], { fov: 54 }));
    wait0(0.8);
    const h = rigAt(0).head;
    D.fx('flashBurst', { x: h[0], y: 0.6, z: h[2], dur: 0.9, radius: 3.8, color: 0xc070ff, light: 80 });
    D.fx('dustCloud', { x: 3.6, y: 0, z: 0.6, n: 150, dur: 7.5, radius: 9, size: 1.9, h: 4.2, color: 0xa8a0a0, color2: 0x8a8088 });
    D.fx('debris', { x: h[0], y: 0.3, z: h[2], n: 70, spread: 1.8, up: 1.4 });
    D.sfx('bigBlast', 0, 1.0); D.sfx('tailSlam', 0, 0.8); D.shake(1.8, 1.8); D.set('flashWhite', 0.5); D.anim('flashWhite', 0, 0.5);
    D.comic('BOOOOOOM!', 0, 1.3, { x: 0.5, y: 0.35, size: 130, rot: 5, c1: '#ffffff', c2: '#c060ff' });
    D.sound('Behemoth slams its head into the ground', 1.75, 0.2); wait0(2.5);
  }
  D.cam(FIX([2.2, 1.5, 9.5], [3.0, 1.6, 0.5], { fov: 62 }));
  D.sound('Dust covers the entire street', 2.2); D.wait(2.4);
  D.anim('beh.rear', 0.6, 2.8); D.anim('beh.nod', -0.1, 2.8); D.anim('beh.look', 0.1, 2.8); D.sfx('growRumble', 0.3, 0.5);
  D.cam(FIX([16, 1.0, 9.5], [9, 4.5, 0.5], { pos2: [15.5, 1.1, 9.0], fov: 54 }));
  D.sound('Behemoth slowly lifts its head, thinking it has defeated everyone', 3.2, 0.2); D.wait(3.4);
  // the barrier
  D.set('dome.x', 0.75); D.set('dome.z', 0.45); D.set('dome.r', 3.1); D.set('dome.hit', 1);
  D.anim('dome.on', 1, 1.0, 0, 'out'); D.anim('dome.hit', 0, 1.2, 0.1); D.sfx('barrierUp', 0, 1.0); D.sfx('shieldOn', 0.1, 0.6);
  D.music('heroic', 0.38, 0, 0.6);
  D.cam(FIX([-6.2, 2.0, 7.2], [0.8, 1.3, 0.5], { pos2: [-5.6, 1.9, 6.6], fov: 50 }));
  D.sound('Suddenly, a blue energy barrier appears!', 2.0, 0.2); D.wait(2.4);
  everyone((c) => { D.act(c, 'ready'); D.expr(c, 'surprised'); }, ['flare', 'eric', 'greg', 'leon']);
  D.act('cowboy', 'idle'); D.expr('cowboy', 'worried');
  D.cam(FIX([0.8, 1.7, 5.3], [0.8, 1.2, 0.3], { fov: 56 }));
  D.sound('Inside the barrier, Aaron, Greg, Eric, Leon, Flare, and Fred are completely safe', 3.4); D.wait(3.6);
  D.cam(R('aaron', 35, 1.9, 0.15, { lookY: -0.15, fov: 42 }));
  D.sound('Aaron holds the barrier up with his wrist device', 2.0); D.wait(2.2);
  D.faceChar('eric', 'aaron', 0.4); D.faceChar('greg', 'aaron', 0.4);
  D.say('eric', 'Okay, that was close.', { cam: R('eric', 25, 2.0, 0.15), expr: 'worried', dur: 1.5 });
  D.say('aaron', 'Everybody still here?', { cam: R('aaron', 30, 2.1, 0.15), act: 'wristUp', expr: 'determined', dur: 1.4 });
  D.say('greg', 'Unfortunately.', { cam: R('greg', -40, 2.1, 0.15), expr: 'smug', dur: 1.2 });
  D.face('leon', P / 2, 0.4);
  D.say('leon', 'We need to get this thing under control.', { cam: R('leon', 25, 2.1, 0.15), expr: 'determined', dur: 2.0 });
  D.face('greg', P / 2, 0.3);
  D.say('greg', 'LET ME HANDLE THIS!', { cam: R('greg', -40, 2.1, 0.15), act: 'fistPump', expr: 'grin', dur: 1.3 });
  // Greg flies out and wraps Behemoth up
  {
    D.act('greg', 'fly'); D.expr('greg', 'determined');
    fly('greg', 9.0, 3.6, 0.9, 1.5, 0.15, 'out'); D.face('greg', P / 2 + 0.1, 0.3, 0.15);
    D.sfx('springLaunch', 0.1, 0.6); D.sfx('whoosh', 0.25, 0.8); D.anim('dome.hit', 0.6, 0.15, 0.4); D.anim('dome.hit', 0, 0.5, 0.55);
    D.cam(FIX([1.5, 2.2, 7.4], [5.5, 2.8, 1.0], { fov: 56 }));
    D.sound('Greg flies out of the barrier!', 1.8, 0.2); D.wait(1.8);
    D.act('greg', 'hoverPull'); D.face('greg', 0.0, 0.4);
    D.set('greg.wrapU', 0.6); D.anim('greg.stretch', 1, 0.7); D.anim('greg.wrap', 1, 1.2, 0.2); D.sfx('stretchBoing', 0, 0.9); D.sfx('stretchBoing', 0.6, 0.6);
    D.anim('beh.shake', 0.5, 0.4, 0.6); D.anim('beh.look', -0.3, 0.8, 0.6);
    D.cam(FIX([6.6, 2.8, 5.8], [9.9, 1.9, 0.6], { fov: 48 }));
    D.sound('His arms stretch around Behemoth, wrapping tightly around its body', 3.2, 0.1); D.wait(3.2);
    D.say('greg', 'GOT YOU!', { cam: F(['greg'], 40, 2.4, 0.1, { lookY: -0.3 }), expr: 'laugh', dur: 1.0 });
    D.anim('beh.y', 3.4, 2.2, 0, 'inout'); D.anim('greg.y', 7.0, 2.2, 0, 'inout');
    D.anim('beh.curl', 0.25, 1.6); D.anim('beh.tailLift', 0.7, 1.6); D.anim('beh.rear', 0.3, 1.6); D.anim('beh.nod', 0.35, 1.6);
    D.sfx('rumbleDeep', 0, 0.6); D.sfx('growRumble', 0.2, 0.5); D.shake(0.4, 1.0);
    D.cam(FIX([2.0, 0.7, 13.5], [8.5, 4.6, 0.5], { fov: 58 }));
    D.sound('Greg lifts Behemoth into the air!', 2.0, 0.2); D.wait(2.4);
    roar(2.0, 'ROOOOOAR!', { cam: FIX([3.5, 3.0, 9.5], [6.5, 5.6, 0.5], { fov: 54 }), nod: 0.15, after: 0.35, shake: 0.7 });
    D.anim('beh.shake', 0, 0.4);
  }
  // Leon's punch
  D.set('aaron.act', 'ready');
  D.face('leon', P / 2 + 0.1, 0.3);
  D.say('leon', 'MY TURN!', { cam: R('leon', 25, 2.0, 0.15), act: 'powerFist', expr: 'angry', dur: 1.0, gap: 0.1 });
  {
    D.anim('dome.on', 0, 0.5); D.sfx('powerDown', 0, 0.4);
    const h = rigAt(1.2).head;
    D.act('leon', 'idle');
    const tr = D.path('leon', [[h[0] - 2.6, 0.5]], 7.5);
    D.act('leon', 'powerFist', tr - 0.1);
    fly('leon', h[0] - 0.85, Math.max(0, h[1] - 1.45), h[2] - 0.1, 0.5, tr, 'out'); D.act('leon', 'punch', tr + 0.32);
    D.sfx('whoosh', tr, 0.8);
    D.cam(FIX([-1.5, 1.0, 8.0], [h[0] - 1.0, h[1] - 1.0, 0.5], { fov: 58 }));
    D.sound('Leon charges forward and leaps!', Math.max(0.6, (tr + 0.3) / HOLD), 0.05); wait0(tr + 0.5);
    // BOOM
    const hh = rigAt(0).head;
    D.fx('flashBurst', { x: hh[0], y: hh[1], z: hh[2], dur: 0.8, radius: 2.6, color: 0xffe0a0, light: 60 });
    D.fx('sparks', { x: hh[0], y: hh[1], z: hh[2], n: 70, color: 0xffd080, speed: 4 });
    D.sfx('punchHit', 0, 1.0); D.sfx('boom', 0.05, 0.8); D.shake(1.4, 1.0); D.set('flashWhite', 0.4); D.anim('flashWhite', 0, 0.4);
    D.comic('BOOM!', 0, 1.0, { x: 0.5, y: 0.32, size: 130, rot: -6, c1: '#fff6a0', c2: '#ff7a45' });
    D.cam(FIX([hh[0] - 2.6, hh[1] - 1.2, 4.8], [hh[0] - 0.4, hh[1] - 0.4, 0.5], { fov: 50 }));
    D.sound('Leon punches Behemoth!', 0.62); wait0(0.9);
    // it shrinks; the crown falls off in a flash of light
    const c0 = rigAt(0).crown;
    D.anim('beh.s', 1.3, 0.6, 0, 'in'); D.sfx('shrink', 0, 0.9); D.set('flashViolet', 0.35); D.anim('flashViolet', 0, 0.5);
    D.anim('beh.y', 0, 0.6, 0.6, 'in'); D.anim('beh.rear', 0.05, 0.6, 0.6); D.anim('beh.nod', 0.2, 0.6, 0.6); D.anim('beh.curl', 0, 0.6, 0.6); D.anim('beh.tailLift', 0, 0.6, 0.6); D.anim('beh.eyes', 0.45, 0.8, 0.6);
    D.anim('greg.y', 0, 0.9, 0.4, 'in'); D.act('greg', 'heroLand', 1.3); D.anim('greg.x', 10.0, 0.9, 0.4); D.anim('greg.z', 1.6, 0.9, 0.4);
    D.anim('leon.y', 0, 0.55, 0.05, 'in'); D.act('leon', 'heroLand', 0.6); D.anim('leon.x', 4.2, 0.55, 0.05);
    D.set('crown.gone', 0); D.set('crown.x', c0[0]); D.set('crown.y', c0[1]); D.set('crown.z', c0[2]); D.set('crown.ry', 0); D.set('crown.rx', 0);
    D.anim('crown.x', 8.2, 1.0, 0.1, 'out'); D.anim('crown.z', 1.6, 1.0, 0.1); D.anim('crown.y', 0.1, 1.0, 0.1, 'in'); D.anim('crown.y', 0.45, 0.2, 1.1, 'out'); D.anim('crown.y', 0.1, 0.2, 1.3, 'in');
    D.anim('crown.ry', 5.5, 1.5, 0.1, 'out'); D.anim('crown.rx', 0.25, 1.0, 0.1); D.anim('crown.rx', 0.0, 0.4, 1.1);
    D.fx('flashBurst', { x: c0[0], y: c0[1], z: c0[2], dur: 0.9, radius: 2.4, color: 0xffd070, light: 60 }); D.sfx('crownFlash', 0, 0.8); D.sfx('crownClink', 1.1, 0.8);
    D.cam(FIX([2.5, 1.6, 12.5], [8.5, 4.2, 0.5], { fov: 60 }));
    D.cam(FIX([7.4, 1.6, 6.2], [9.6, 1.2, 1.0], { fov: 54 }), 1.3);
    D.sound('Behemoth suddenly shrinks! Its crown falls off in a flash of light', 3.0, 0.1); wait0(4.2);
  }
  everyone((c) => { D.act(c, 'idle'); D.expr(c, 'surprised'); }, ['aaron', 'flare', 'eric', 'cowboy']);
  D.act('leon', 'idle'); D.act('greg', 'examine');
  D.faceTo('aaron', 8.2, 1.6, 0.4); D.faceTo('flare', 8.2, 1.6, 0.4); D.faceTo('eric', 8.2, 1.6, 0.4); D.faceTo('cowboy', 8.2, 1.6, 0.4); D.faceTo('leon', 8.2, 1.6, 0.4);
  D.cam(FIX([6.2, 0.6, 3.6], [8.2, 0.25, 1.6], { fov: 40 }));
  D.sound('The crown rolls to a stop', 1.6); D.wait(1.8);
  D.say('aaron', "You've got to be kidding me! I thought we destroyed this crown!", { cam: R('aaron', 30, 2.1, 0.15), act: 'armsOut', expr: 'angry', dur: 3.0 });
  D.act('aaron', 'idle');
  // title sequence
  D.location('title');
  cast([]);
  D.set('fade', 0);
  D.music('theme', 0.55, 0, 0.1);
  D.set('title.theme', 0); D.set('title.subText', 'THE ILLUSION'); D.set('title.sub', 0); D.set('title.y', 0.3); D.set('title.subY', -1.1); D.set('title.k', 3.6); D.set('title.glitch', 1);
  D.cam(FIX([0, 0.2, 10.5], [0, -0.1, 0], { pos2: [0, 0.15, 9.8], fov: 42 }));
  D.anim('title.k', 1, 0.22, 0.2, 'in'); D.sfx('titleHit', 0.4, 0.9);
  D.anim('title.sub', 1, 0.45, 1.3, 'back'); D.sfx('illusionWarp', 1.2, 0.5); D.sfx('glitch', 2.4, 0.5);
  D.wait(4.4);
  D.anim('fade', 1, 0.5); D.wait(0.6);

  // ===================================================================== SCENE 2: THE FAKE CROWN
  D.scene('2. The Fake Crown');
  D.location('downtown');
  cast([...SIX, 'beh']);
  D.set('title.glitch', 0);
  D.set('cracks', 1); D.set('cracks.x', 3.0); D.set('cracks.z', 0.6); D.set('cracks.size', 6);
  D.place('beh', 11, 0.5, -P / 2); D.set('beh.s', 1.3); D.set('beh.y', 0); D.set('beh.rear', 0.05); D.set('beh.nod', 0.2); D.set('beh.eyes', 0.45); D.set('beh.look', 0.2); D.set('beh.sway', 0.6); D.set('beh.slither', 0.15); D.set('beh.aura', 0.15);
  D.set('greg.wrapU', 0.6); D.set('greg.wrap', 1); D.set('greg.stretch', 1);
  D.place('greg', 10.3, 1.45, P - 0.3); D.act('greg', 'examine'); D.expr('greg', 'determined');
  D.place('leon', 4.4, 0.4, P / 2 + 0.2); D.act('leon', 'idle'); D.expr('leon', 'neutral');
  D.place('aaron', 5.6, 3.0, P / 2 + 0.5); D.act('aaron', 'idle'); D.expr('aaron', 'annoyed');
  D.place('flare', 6.4, -0.6, 0.5); D.act('flare', 'idle'); D.expr('flare', 'neutral');
  D.place('eric', 7.2, 4.4, P - 0.4); D.act('eric', 'idle'); D.expr('eric', 'neutral');
  D.place('cowboy', 9.0, 4.2, P - 0.2); D.act('cowboy', 'idle'); D.expr('cowboy', 'worried');
  D.set('crown.mode', 'world'); D.set('crown.gone', 0); D.set('crown.x', 8.2); D.set('crown.y', 0.1); D.set('crown.z', 1.6); D.set('crown.rx', 0); D.set('crown.ry', 5.5); D.set('crown.size', 0.2);
  D.music('mystery', 0.32, 0, 0.6);
  D.anim('fade', 0, 0.5);
  {
    const tl = D.path('leon', [[7.7, 1.25]], 1.3);
    D.cam(FIX([3.2, 1.8, 7.0], [7.4, 0.9, 1.4], { pos2: [3.6, 1.7, 6.6], fov: 48 }));
    D.sound('Leon walks over and picks up the crown', 2.2, 0.3); D.wait(Math.max(1.8, tl / HOLD));
    D.faceTo('leon', 8.2, 1.6, 0.3); D.act('leon', 'kneelPick', 0.3);
    D.set('crown.mode', 'leon', 1.2); D.set('crown.size', 0.13, 1.2); D.act('leon', 'idle', 1.5); D.act('leon', 'showItem', 1.6); D.sfx('clink', 1.2, 0.5);
    D.cam(FIX([6.6, 1.0, 3.6], [7.9, 0.6, 1.3], { fov: 44 })); D.wait(2.0);
  }
  D.face('leon', 0.8, 0.4); D.look('leon', 0, 0.35, 0.4);
  D.say('leon', "I don't think this crown is a real one.", { cam: R('leon', 25, 1.9, 0.12, { lookY: -0.2 }), expr: 'thinking', dur: 2.1 });
  D.faceChar('aaron', 'leon', 0.3);
  D.say('aaron', 'What do you mean?', { cam: R('aaron', 20, 2.0, 0.15), expr: 'surprised', dur: 1.2 });
  D.look('leon', 0, 0.45, 0.3);
  D.say('leon', 'Look at the color. This one is rusty and yellow.', { cam: FIX([8.6, 1.35, 2.9], [7.95, 1.05, 1.4], { fov: 34 }), dur: 2.4 });
  D.look('leon', 0, 0.0, 0.4);
  D.say('leon', 'The original crown looked completely different.', { cam: R('leon', 25, 1.9, 0.12, { lookY: -0.2 }), expr: 'serious', dur: 2.2 });
  // Greg is still untangling Behemoth
  D.anim('greg.wrap', 0.6, 3.0); D.sfx('stretchBoing', 0.4, 0.4); D.sfx('squeak', 1.4, 0.4);
  D.anim('beh.look', -0.3, 1.2); D.anim('beh.look', 0.25, 1.2, 1.2);
  D.cam(FIX([12.6, 1.2, 3.6], [10.7, 0.4, 0.9], { fov: 46 }));
  D.sound('Greg is still untangling Behemoth’s arms and legs', 2.6, 0.2); D.wait(2.8);
  D.look('greg', -0.5, -0.1, 0.4);
  D.say('greg', 'Yeah, this could be a broken crown or something.', { cam: R('greg', 30, 1.9, 0.0, { lookY: -0.25 }), expr: 'neutral', dur: 2.2 });
  D.look('greg', 0, 0, 0.4);
  D.anim('beh.nod', 0.35, 1.0); D.sfx('tinyGrowl', 0.2, 0.5);
  D.cam(FIX([11.2, 0.6, 2.8], [10.6, 0.3, 0.6], { fov: 40 }));
  D.sound('Behemoth remains small and weakened', 2.0); D.wait(2.2);
  D.faceTo('eric', 8.0, 1.4, 0.3);
  D.say('eric', 'So we fought an entire monster just for a fake crown?', { cam: R('eric', 20, 2.0, 0.15), act: 'armsOut', expr: 'annoyed', dur: 2.4 });
  D.act('eric', 'idle');
  D.say('flare', 'Pretty much.', { cam: R('flare', -25, 2.0, 0.15), act: 'shrug', expr: 'smug', dur: 1.1 });
  D.act('flare', 'idle');
  // Greg lets go
  D.anim('greg.wrap', 0, 0.8); D.anim('greg.stretch', 0, 0.7, 0.3); D.sfx('stretchBoing', 0, 0.6); D.act('greg', 'idle', 0.7);
  D.cam(FIX([9.6, 1.4, 4.6], [10.4, 0.6, 1.2], { fov: 48 }));
  D.sound('Greg finally releases Behemoth', 1.8, 0.2); D.wait(2.0);
  D.say('greg', 'There. Problem solved.', { cam: R('greg', 25, 2.0, 0.15), act: 'brushOff', expr: 'happy', dur: 1.5 });
  D.act('greg', 'idle');
  // ...and the tiny Behemoth slips away
  {
    const r0 = rigAt(0);
    D.fx('portal', { x: r0.pts[12][0], y: 0.5, z: 0.5, ry: P / 2, radius: 0.8, dur: 1.8, color: 0xa040ff });
    D.anim('beh.dissolve', 1, 1.0, 0.4); D.sfx('teleport', 0.2, 0.6); D.hide('beh', 1.5);
    D.cam(FIX([12.8, 0.9, 2.6], [10.8, 0.4, 0.6], { fov: 44 }));
    D.sound('A tiny purple portal swallows Behemoth. It’s gone... for now', 2.6, 0.2); D.wait(2.8);
  }
  D.face('greg', P / 2 + 0.6, 0.4);
  for (const c of TEAM) if (c !== 'greg') D.faceChar(c, 'cowboy', 0.4);
  D.cam(FIX([4.6, 1.7, 5.6], [8.4, 1.3, 3.4], { fov: 46 }));
  D.sound('Everyone looks toward Fred', 1.6); D.wait(1.8);
  D.path('greg', [[9.2, 2.6]], 1.3);
  D.faceChar('greg', 'cowboy', 0.3, 0.7);
  D.say('greg', "Well, hold on. What makes you think you're not working with the Soul Stealer?", { cam: R('greg', 20, 2.1, 0.15), act: 'crossArms', expr: 'serious', dur: 3.2 });
  D.faceChar('cowboy', 'greg', 0.5);
  D.cam(R('cowboy', 25, 1.9, 0.05, { lookY: -0.05, fov: 40 })); D.sound('Fred turns toward him', 1.4); D.wait(1.5);
  D.say('cowboy', "I'm really not from this Earth. I don't even know who Soul Stealer is.", { ...FRED, cam: R('cowboy', 20, 1.8, 0.05, { lookY: -0.05, fov: 38 }), expr: 'serious', dur: 3.2 });
  D.say('cowboy', 'I just want my horse back.', { ...FRED, expr: 'sad', dur: 1.6 });
  D.faceChar('cowboy', 'aaron', 0.4);
  D.say('aaron', "You're not from Earth?", { cam: R('aaron', 20, 2.0, 0.15), expr: 'surprised', dur: 1.3 });
  D.say('cowboy', 'No.', { ...FRED, cam: R('cowboy', -25, 1.8, 0.05, { lookY: -0.05, fov: 38 }), expr: 'neutral', dur: 0.9 });
  D.act('greg', 'idle');
  D.say('leon', "Okay, well, at least you aren't a bad person.", { cam: R('leon', -25, 2.0, 0.15), act: 'showItem', expr: 'neutral', dur: 2.0 });
  D.faceChar('leon', 'cowboy', 0.4); D.faceChar('cowboy', 'leon', 0.4);
  D.cam(FIX([7.2, 1.6, -0.6], [8.2, 1.3, 3.0], { fov: 44 })); D.sound('Leon looks at Fred', 1.2); D.wait(1.3);
  D.say('leon', 'Do you still have your powers?', { cam: R('leon', 25, 2.0, 0.15), dur: 1.5 });
  D.say('cowboy', 'No. Not at all.', { ...FRED, cam: R('cowboy', 25, 1.8, 0.05, { lookY: -0.05, fov: 38 }), expr: 'sad', dur: 1.3 });
  D.say('leon', 'Nothing?', { cam: R('leon', 25, 2.0, 0.15), expr: 'surprised', dur: 0.9 });
  D.say('cowboy', 'I can locate where my horse is. We\'re very close.', { ...FRED, cam: R('cowboy', 25, 1.8, 0.05, { lookY: -0.05, fov: 38 }), expr: 'neutral', dur: 2.4 });
  D.say('cowboy', "It's in my genes.", { ...FRED, act: 'tipHat', dur: 1.2 });
  D.act('cowboy', 'idle');
  D.faceTo('eric', 9.0, 4.2, 0.3);
  D.say('eric', 'So you can track your horse?', { cam: R('eric', 20, 2.0, 0.15), expr: 'surprised', dur: 1.4 });
  D.say('cowboy', "Yes. But I can't teleport, make clay, or throw my hat anymore.", { ...FRED, cam: R('cowboy', 20, 1.8, 0.05, { lookY: -0.05, fov: 38 }), expr: 'sad', dur: 3.0 });
  D.say('greg', 'Wait, your hat does something?', { cam: R('greg', -30, 2.0, 0.15), expr: 'shocked', dur: 1.5 });
  D.say('cowboy', 'It comes back like a boomerang.', { ...FRED, cam: R('cowboy', 30, 1.8, 0.05, { lookY: -0.05, fov: 38 }), act: 'tipHat', expr: 'smug', dur: 1.8 });
  D.act('cowboy', 'idle');
  D.say('leon', 'Wow. You\'re very useless.', { cam: R('leon', -25, 2.0, 0.15), act: 'showItem', expr: 'smug', dur: 1.5 });
  D.faceChar('cowboy', 'leon', 1.4); D.expr('cowboy', 'annoyed');
  D.cam(R('cowboy', 40, 1.6, 0.05, { lookY: -0.05, fov: 36 }));
  D.sound('Fred slowly looks at Leon', 1.6); D.wait(1.8);
  D.say('cowboy', '...', { ...FRED, dur: 1.4 });
  D.say('aaron', 'Leon!', { cam: R('aaron', 20, 2.0, 0.15), act: 'facepalm', expr: 'annoyed', dur: 0.9 });
  D.act('aaron', 'idle');
  D.say('leon', "What? I'm just saying!", { cam: R('leon', 25, 2.0, 0.15), act: 'shrug', expr: 'surprised', dur: 1.4 });
  D.act('leon', 'showItem');

  // ===================================================================== SCENE 3: A NEW MEMBER?
  D.scene('3. A New Member?');
  D.music('chill', 0.3, 0, 1.0);
  D.expr('cowboy', 'neutral');
  D.path('flare', [[6.8, 0.8]], 1.1); D.faceChar('flare', 'aaron', 0.3, 1.0); D.path('leon', [[9.6, 0.4]], 1.1, 0.2); D.faceChar('leon', 'flare', 0.4, 1.6);
  D.cam(FIX([4.0, 1.7, -2.6], [7.0, 1.2, 1.5], { fov: 48 }));
  D.sound('Flare steps forward', 1.4, 0.2); D.wait(1.6);
  D.say('flare', 'Maybe we should give him some technology.', { cam: R('flare', -30, 2.0, 0.15), expr: 'thinking', dur: 2.0 });
  D.say('flare', 'Something that could help him get his abilities back.', { act: 'gesture', expr: 'neutral', dur: 2.4 });
  D.act('flare', 'idle'); D.faceChar('aaron', 'flare', 0.3);
  D.say('aaron', "I don't really trust people with my technology.", { cam: R('aaron', 25, 2.0, 0.15), act: 'crossArms', expr: 'serious', dur: 2.2 });
  D.say('flare', 'Fair enough.', { cam: R('flare', -30, 2.0, 0.15), act: 'shrug', expr: 'neutral', dur: 1.0 });
  D.act('flare', 'idle');
  D.say('aaron', "But I'll make something new.", { cam: R('aaron', 25, 2.0, 0.15), act: 'idle', expr: 'smug', dur: 1.6 });
  D.say('flare', 'Okay, fine with that too.', { cam: R('flare', -30, 2.0, 0.15), act: 'thumbsUp', expr: 'happy', dur: 1.4 });
  D.act('flare', 'idle');
  // Greg looks around
  D.look('greg', -0.45, 0, 0.6); D.look('greg', 0.45, 0, 0.8, 0.7); D.look('greg', 0, 0, 0.5, 1.6);
  D.cam(R('greg', 0, 2.2, 0.15)); D.sound('Greg looks around', 1.4); D.wait(1.8);
  D.say('greg', "Well, now we gotta find the Soul Stealer. We're not waiting any longer.", { act: 'point', expr: 'determined', dur: 3.0 });
  D.say('greg', 'Behemoth is probably gonna teleport back any second.', { act: 'idle', dur: 2.3 });
  D.expr('greg', 'thinking'); D.look('greg', 0.2, -0.25, 0.5);
  D.cam(R('greg', 20, 1.7, 0.1, { fov: 38 })); D.sound('He pauses', 1.2); D.wait(1.4);
  D.look('greg', 0, 0, 0.3);
  D.say('greg', 'Also, I gotta get some cheeseburgers and pizza.', { act: 'thumbsUp', expr: 'grin', dur: 2.2 });
  {
    D.act('greg', 'idle');
    D.path('greg', [[13.0, 6.0], [24, 16]], 9.0); D.sfx('whoosh', 0, 0.8); D.hide('greg', 2.2);
    D.cam(FIX([5.8, 1.6, -1.2], [10.0, 1.4, 5.5], { fov: 50 }));
    D.sound('Greg runs out of the frame', 1.4, 0.1); D.wait(1.6);
  }
  D.faceTo('aaron', 14, 8, 0.3);
  D.say('aaron', 'Oh, come on! You always want food! Can we ever be serious?', { cam: R('aaron', 20, 2.0, 0.15), act: 'armsOut', expr: 'annoyed', dur: 2.8 });
  D.act('aaron', 'idle'); D.faceTo('eric', 5.6, 3.0, 0.3);
  D.say('eric', "I'm actually hungry too.", { cam: R('eric', 20, 2.0, 0.15), act: 'shrug', expr: 'happy', dur: 1.4 });
  D.faceChar('aaron', 'eric', 0.3);
  D.say('aaron', 'Eric!', { cam: R('aaron', 20, 2.0, 0.15), act: 'point', expr: 'angry', dur: 0.9 });
  D.say('eric', 'What?!', { cam: R('eric', 20, 2.0, 0.15), act: 'armsOut', expr: 'surprised', dur: 0.9 });
  D.act('aaron', 'idle'); D.act('eric', 'idle');
  // Eric becomes a bird
  {
    const [ex, ez] = pos('eric');
    D.set('flashWhite', 0.5); D.anim('flashWhite', 0, 0.4); D.sfx('transform', 0, 0.9);
    D.fx('sparks', { x: ex, y: 1.0, z: ez, n: 60, color: 0x6dff8a, speed: 2.2 });
    D.hide('eric', 0.05); D.place('bird', ex, ez, P - 0.4, 0.05); D.set('bird.y', 1.2, 0.05); D.set('bird.act', 'hover', 0.05);
    D.cam(F(['bird'], 300, 1.8, 0.2, { lookY: -0.1, fov: 42 }));
    D.sound('Eric transforms into a bird', 1.6); D.wait(1.6);
    D.say('eric', "I'll fly ahead and look for the Soul Stealer's lair!", { dur: 2.4 });
    D.set('bird.act', 'takeoff'); D.sfx('flap', 0, 0.8); D.sfx('flap', 0.4, 0.6);
    D.anim('bird.y', 14, 1.8, 0, 'in'); D.anim('bird.x', ex + 2, 1.8, 0);
    D.cam(FIX([ex - 3.0, 0.8, ez + 3.5], [ex + 1, 5.0, ez], { fov: 56 }));
    D.sound('He flies upward and disappears', 1.8, 0.2); D.wait(2.0);
    D.set('bird.act', 'fly'); D.set('bird.y', 22); D.set('bird.x', ex - 20); D.set('bird.z', ez + 6); D.face('bird', P / 2, 0.01);
    D.anim('bird.x', ex + 30, 3.4, 0, 'linear'); D.anim('bird.y', 26, 3.4, 0, 'linear'); D.sfx('flap', 0.2, 0.5); D.sfx('wind', 0, 0.4);
    D.cam(F(['bird'], 200, 3.0, 0.6, { lookY: -0.5, fov: 54 }));
    D.sound('Eric soars high above the city...', 2.4, 0.2); D.wait(2.6);
    D.hide('bird');
  }
  everyone((c) => { D.look(c, 0, -0.35, 0.6); }, ['aaron', 'flare', 'leon', 'cowboy']);
  D.sfx('cricket', 0.3, 0.4);
  D.cam(FIX([4.0, 1.2, 6.2], [7.2, 2.4, 1.6], { fov: 48 }));
  D.sound('A few seconds pass...', 2.6); D.wait(3.6);
  {
    const ex = 7.2, ez = 4.4;
    D.show('bird'); D.set('bird.x', ex + 2); D.set('bird.z', ez); D.set('bird.y', 14); D.set('bird.act', 'fly');
    D.anim('bird.y', 1.3, 1.4, 0, 'out'); D.anim('bird.x', ex, 1.4, 0); D.set('bird.act', 'hover', 1.4); D.sfx('flap', 0, 0.8); D.sfx('flap', 0.5, 0.6);
    everyone((c) => { D.look(c, 0, 0, 0.6, 0.6); }, ['aaron', 'flare', 'leon', 'cowboy']);
    D.cam(FIX([9.8, 1.1, 7.2], [ex, 2.6, ez], { look2: [ex, 1.4, ez], fov: 50 }));
    D.sound('Eric suddenly flies back down', 1.8, 0.2); D.wait(2.0);
  }
  D.say('eric', 'Oh yeah, I forgot.', { cam: F(['bird'], 300, 1.6, 0.1, { lookY: -0.05, fov: 40 }), dur: 1.4 });
  D.say('aaron', 'What?', { cam: R('aaron', 20, 2.0, 0.15), expr: 'annoyed', dur: 0.9 });
  D.say('eric', "Where's the Soul Stealer's lair?", { cam: F(['bird'], 300, 1.6, 0.1, { lookY: -0.05, fov: 40 }), dur: 1.6 });
  everyone((c) => { D.faceTo(c, 7.2, 4.4, 0.4); D.expr(c, 'annoyed'); }, ['aaron', 'flare', 'leon']);
  D.cam(FIX([7.4, 1.4, 6.2], [6.2, 1.4, 1.0], { fov: 54 }));
  D.sound('Everyone looks at him', 1.4); D.wait(1.6);
  D.say('flare', "YOU DON'T KNOW?!", { cam: R('flare', -30, 2.0, 0.15), act: 'armsOut', expr: 'angry', dur: 1.2 });
  D.act('flare', 'idle');
  D.set('bird.act', 'shock');
  D.say('eric', 'I thought somebody knew!', { cam: F(['bird'], 300, 1.6, 0.1, { lookY: -0.05, fov: 40 }), dur: 1.5 });
  D.set('bird.act', 'hover');
  // Eric changes back; Fred steps forward
  {
    const ex = 7.2, ez = 4.4;
    D.set('flashWhite', 0.4); D.anim('flashWhite', 0, 0.4); D.sfx('transform', 0, 0.6);
    D.fx('sparks', { x: ex, y: 1.0, z: ez, n: 40, color: 0x6dff8a, speed: 2.0 });
    D.hide('bird', 0.05); D.place('eric', ex, ez, P - 0.4, 0.05); D.act('eric', 'idle', 0.05); D.expr('eric', 'worried', 0.05);
    D.path('cowboy', [[8.1, 2.9]], 0.9, 0.5); D.expr('cowboy', 'serious', 0.5);
    D.cam(FIX([10.8, 1.6, 6.0], [8.4, 1.4, 3.0], { fov: 46 }));
    D.sound('Fred slowly steps forward', 1.8, 0.4); D.wait(2.4);
  }
  D.face('cowboy', P - 0.5, 0.4);
  everyone((c) => { D.faceChar(c, 'cowboy', 0.4); D.expr(c, 'neutral'); }, ['aaron', 'flare', 'leon', 'eric']);
  D.say('cowboy', 'Let me see.', { ...FRED, cam: R('cowboy', 20, 1.7, 0.05, { lookY: -0.05, fov: 38 }), dur: 1.3 });

  // ===================================================================== SCENE 4: FRED'S VISION
  D.scene("4. Fred's Vision");
  D.music('none', 0, 0, 1.0);
  D.expr('cowboy', 'sleep');
  D.cam(R('cowboy', 15, 1.4, 0.0, { lookY: -0.02, fov: 34, dist2: 1.1 }));
  D.sound('Fred closes his eyes', 1.6, 0.2); D.wait(1.8);
  D.expr('cowboy', 'serious'); D.anim('cowboy.whiteEyes', 1, 1.6); D.sfx('electricHum', 0, 0.8);
  D.fx('bodyAura', { who: 'cowboy', dur: 3.2, color: 0xdfe8ff, power: 0.6 });
  D.cam(R('cowboy', 10, 1.0, 0.0, { lookY: -0.0, fov: 30, dist2: 0.85 }));
  D.sound('His eyes slowly turn completely white. A low electrical hum fills the air', 3.4); D.wait(3.2);
  D.set('flashWhite', 0.8); D.anim('flashWhite', 0, 0.5); D.sfx('glitch', 0, 0.5);
  // ---- the vision (first-person, blurry like an old camera)
  D.location('dungeon');
  cast(['horse', 'soul']);
  D.set('vision', 1); D.set('dungeon.purple', 0);
  D.show('horse'); D.place('horse', 0.1, -2.3, 0.35); D.set('horse.purple', 0.6); D.set('horse.glow', 0.8); D.set('horse.act', 'idle'); D.set('horse.scale', 1);
  D.show('soul'); D.place('soul', 1.5, 0.55, P + 0.45); D.set('soul.y', 0); D.set('soul.raise', 0); D.set('soul.palm', 0); D.set('soul.eyes', 1);
  D.music('eerie', 0.32, 0, 0.6); D.sfx('heartbeat', 0.3, 0.6); D.sfx('heartbeat', 1.3, 0.55); D.sfx('heartbeat', 2.3, 0.5);
  D.cam(FIX([-4.4, 2.0, 5.4], [0.0, 1.4, -1.2], { pos2: [-1.8, 1.9, 2.9], fov: 52, ease: 'linear' }));
  D.sound('First-person view: everything is blurry and distorted, like an old security camera', 3.6, 0.2); D.wait(4.2);
  D.cam(FIX([-0.5, 1.7, 1.1], [0.1, 1.2, -2.3], { pos2: [-0.35, 1.65, 0.75], fov: 48 }));
  D.sound('Fred’s horse is inside a dark prison-like room, behind metal bars', 3.2); D.wait(3.4);
  D.anim('soul.raise', 0.25, 0.8); D.sfx('muffled', 0.2, 0.7);
  D.cam(FIX([-1.2, 2.1, 2.6], [1.3, 1.7, -0.2], { fov: 46 }));
  D.sound('The Soul Stealer is speaking to the horse, but his voice is too muffled to understand', 3.2, 0.1); D.wait(3.4);
  D.say('soul', 'Mmmrh... hrrm... mm-mmh... rrrmm...', { label: 'SOUL STEALER (MUFFLED)', dur: 2.4 });
  D.sfx('muffled', 0, 0.6);
  D.say('soul', 'Hrrmmm... mm... power... rrrhh...', { label: 'SOUL STEALER (MUFFLED)', dur: 2.4 });
  {
    D.anim('soul.raise', 0.75, 1.0); D.anim('soul.palm', 1, 1.0); D.face('soul', P + 0.25, 0.8);
    D.anim('dungeon.purple', 1, 1.2, 0.6); D.anim('horse.purple', 1, 1.2, 0.6); D.anim('horse.glow', 2.2, 1.2, 0.6); D.set('horse.act', 'panic', 0.9);
    D.fx('bodyAura', { who: 'horse', dur: 6.0, color: 0xa040ff, power: 1.1 }, 0.6); D.sfx('drainHum', 0.6, 0.7); D.sfx('horseNeigh', 1.2, 0.4);
    D.cam(FIX([-0.3, 1.8, 1.2], [0.3, 1.3, -2.0], { pos2: [-0.15, 1.75, 0.85], fov: 50 }));
    D.sound('He places his hand near the horse. Purple energy begins surrounding it', 3.4, 0.2); D.wait(3.8);
    D.cam(FIX([-1.0, 1.55, 0.9], [0.1, 1.4, -2.3], { pos2: [-0.85, 1.55, 0.6], fov: 44 }));
    D.sound('The horse struggles as the purple energy grows stronger', 2.6, 0.1); D.wait(2.8);
  }
  D.set('flashWhite', 0.8); D.anim('flashWhite', 0, 0.5); D.sfx('glitch', 0, 0.6);
  // ---- back with the team
  D.location('downtown');
  cast([...SIX]);
  D.set('crown.mode', 'leon'); D.set('crown.gone', 0); D.set('crown.size', 0.13);
  D.place('cowboy', 8.1, 2.9, P - 0.5); D.act('cowboy', 'idle'); D.expr('cowboy', 'serious'); D.set('cowboy.whiteEyes', 1);
  D.place('leon', 9.6, 0.4, -0.6); D.act('leon', 'showItem'); D.expr('leon', 'neutral');
  D.place('aaron', 5.6, 3.0, 1.2); D.act('aaron', 'idle'); D.expr('aaron', 'worried');
  D.place('flare', 6.8, 0.8, 0.9); D.act('flare', 'idle'); D.expr('flare', 'worried');
  D.place('eric', 7.2, 4.4, P / 2 + 0.7); D.act('eric', 'idle'); D.expr('eric', 'worried');
  D.hide('greg');
  D.music('mystery', 0.3, 0, 0.8);
  D.anim('cowboy.whiteEyes', 0, 1.0, 0.3);
  D.cam(R('cowboy', 15, 1.2, 0.0, { lookY: -0.02, fov: 34 }));
  D.sound('Fred opens his eyes', 1.6, 0.2); D.wait(1.8);
  D.cam(FIX([4.6, 1.7, 0.2], [7.8, 1.4, 2.6], { fov: 50 }));
  D.sound('Everyone stares at him, waiting', 1.6); D.wait(1.8);
  D.say('cowboy', 'Well... my horse is in a jail.', { ...FRED, cam: R('cowboy', 20, 1.7, 0.05, { lookY: -0.05, fov: 38 }), expr: 'worried', dur: 1.9 });
  D.say('aaron', 'A jail?', { cam: R('aaron', 25, 2.0, 0.15), expr: 'surprised', dur: 0.9 });
  D.say('cowboy', "Yeah. My vision is kind of bad. I don't know what's going on.", { ...FRED, cam: R('cowboy', 20, 1.7, 0.05, { lookY: -0.05, fov: 38 }), act: 'lookHand', dur: 2.8 });
  D.act('cowboy', 'idle');
  D.say('eric', 'Is he going blind?', { cam: R('eric', -20, 2.0, 0.15), expr: 'shocked', dur: 1.2 });
  D.faceChar('cowboy', 'eric', 0.4);
  D.say('cowboy', 'No. His power must be getting taken.', { ...FRED, cam: R('cowboy', 25, 1.7, 0.05, { lookY: -0.05, fov: 38 }), expr: 'sad', dur: 2.1 });
  D.look('cowboy', 0, 0.3, 0.6); D.expr('cowboy', 'thinking');
  D.cam(R('cowboy', 30, 1.5, 0.0, { lookY: -0.05, fov: 36 })); D.sound('Fred pauses', 1.2); D.wait(1.5);
  D.look('cowboy', 0, 0, 0.4);
  D.say('cowboy', "But he can't take my power, though.", { ...FRED, expr: 'serious', dur: 1.9 });
  D.say('leon', 'Why not?', { cam: R('leon', 25, 2.0, 0.15), expr: 'surprised', dur: 0.9 });
  D.faceChar('cowboy', 'leon', 0.4);
  D.say('cowboy', "I don't know. It's just how our connection works.", { ...FRED, cam: R('cowboy', 30, 1.7, 0.05, { lookY: -0.05, fov: 38 }), act: 'shrug', expr: 'neutral', dur: 2.4 });
  D.act('cowboy', 'idle');
  D.say('flare', "We need to get him back before it's too late.", { cam: R('flare', -30, 2.0, 0.15), expr: 'determined', dur: 2.0 });
  D.say('aaron', 'Everyone back to headquarters. We need a plan.', { cam: R('aaron', 25, 2.0, 0.15), act: 'point', expr: 'determined', dur: 2.2 });
  D.act('aaron', 'idle');
  everyone((c) => { D.expr(c, 'determined'); }, ['flare', 'eric', 'leon']);
  D.anim('fade', 1, 0.5); D.wait(0.6);

  // ===================================================================== SCENE 5: SOMETHING IS WRONG
  D.scene('5. Something Is Wrong');
  D.location('living');
  cast([...TEAM, 'cowboy']);
  D.set('crown.gone', 1);
  D.set('night', 0); D.set('evening', 1); D.set('steelTable', 0); D.set('halloween', 0); D.set('kitchen', 0); D.set('tv.off', 1); D.set('laptop.on', 0);
  D.set('pizza', 0); D.set('pizza.single', 1); D.set('living.equip', 0); D.set('living.burger', 0); D.set('ctrl.couch', 0);
  D.set('door.open', 0); D.anim('door.open', 1, 0.6, 0.2); D.sfx('doorOpen', 0.2, 0.5);
  const ENTER = [-6.6, 2.6];
  D.place('aaron', -7.9, 2.6, P / 2); D.act('aaron', 'idle'); props('aaron', 'case'); D.expr('aaron', 'serious');
  D.place('leon', -8.4, 2.6, P / 2); D.act('leon', 'idle'); D.expr('leon', 'serious');
  D.place('flare', -8.9, 2.6, P / 2); D.act('flare', 'idle'); D.expr('flare', 'tired');
  D.place('eric', -9.4, 2.6, P / 2); D.act('eric', 'idle'); D.expr('eric', 'neutral');
  D.place('cowboy', -9.9, 2.6, P / 2); D.act('cowboy', 'idle'); D.expr('cowboy', 'neutral');
  D.hide('greg');
  D.music('hq', 0.28, 0, 0.6);
  D.anim('fade', 0, 0.6);
  const tIn = D.now;
  const taA = D.path('aaron', [ENTER, [-2.6, 1.4], [-1.9, -0.6], [-1.4, -0.85]], 1.5, 0.3);
  const taF = D.path('flare', [ENTER, [2.2, 2.0], [2.1, 0.05], [0.75, 0.05]], 1.5, 1.3);
  {
    D.path('leon', [ENTER, [2.5, 2.1], [4.8, 2.4]], 1.5, 0.8);
    D.path('eric', [ENTER, [-2.6, 1.8], [-2.8, 0.6]], 1.4, 1.8);
    D.path('cowboy', [ENTER, [-5.6, 0.4], [-6.25, -1.4]], 1.2, 2.3);
    D.cam(FIX([2.8, 2.4, -3.6], [-3.0, 1.1, 1.6], { pos2: [2.4, 2.3, -3.2], fov: 56 }));
    D.card('location', 3.0, { text: 'BATTLE WARS HQ  -  EVENING' });
    D.sound('The team arrives back at headquarters', 2.4, 0.4); D.wait(3.6);
    D.anim('door.open', 0, 0.6, 1.0); D.sfx('doorBang', 1.5, 0.3);
  }
  wait0(Math.max(0, tIn + 0.3 + taA + 0.2 - D.now));
  D.face('aaron', P / 2, 0.4); D.act('aaron', 'reach', 0.3); D.set('living.equip', 1, 1.0); D.set('aaron.propR', 'none', 1.0); D.act('aaron', 'idle', 1.4); D.sfx('clunk', 1.0, 0.5);
  D.cam(FIX([0.6, 1.5, -2.7], [-1.0, 0.9, -0.8], { fov: 48 }));
  D.sound('Aaron places his equipment on the table', 2.0, 0.3); D.wait(2.4);
  D.cam(FIX([1.2, 1.6, 4.6], [4.8, 1.3, 2.4], { fov: 50 }));
  D.sound('Leon walks toward the control room', 1.8); D.wait(1.8);
  wait0(Math.max(0, tIn + 1.3 + taF + 0.1 - D.now));
  D.act('flare', 'sitRelax'); D.face('flare', P, 0.3); D.anim('flare.z', 0.62, 0.5);
  D.cam(FIX([0.2, 1.4, -2.4], [0.75, 0.8, 0.6], { fov: 48 }));
  D.sound('Flare sits on the couch', 1.6, 0.2); D.wait(1.8);
  D.faceTo('cowboy', -8, -1.5, 0.4); D.look('cowboy', 0, -0.05, 0.6);
  D.cam(FIX([-4.6, 1.6, 0.6], [-6.6, 1.5, -1.6], { fov: 46 }));
  D.sound('Fred stands quietly by the window, looking out at the city', 2.6); D.wait(2.6);
  // Greg comes home with food
  {
    D.show('greg'); D.place('greg', -7.9, 2.6, P / 2); D.act('greg', 'carryFood'); props('greg', 'foodStack'); D.expr('greg', 'grin');
    D.anim('door.open', 1, 0.5); D.sfx('doorOpen', 0, 0.5); D.anim('door.open', 0, 0.6, 2.6);
    D.path('greg', [ENTER, [-2.6, 1.9], [-1.9, 1.9]], 1.6, 0.2);
    for (const c of ['aaron', 'eric', 'cowboy']) D.faceTo(c, -3.0, 2.2, 0.5, 0.6);
    D.cam(FIX([0.4, 1.6, 4.4], [-5.4, 1.2, 2.4], { look2: [-1.9, 1.2, 1.9], fov: 52 }));
    D.sound('Greg enters, carrying two cheeseburgers and a pizza box', 2.8, 0.2); D.wait(3.8);
  }
  for (const c of ['aaron', 'eric']) D.faceChar(c, 'greg', 0.4);
  D.faceChar('greg', 'aaron', 0.4); D.look('flare', -0.6, 0, 0.4);
  D.say('aaron', 'Where did you get all that?', { cam: R('aaron', 20, 2.0, 0.15), expr: 'surprised', dur: 1.5 });
  D.say('greg', 'Priorities.', { cam: R('greg', 25, 2.0, 0.15), expr: 'smug', dur: 1.1 });
  D.say('eric', 'You went shopping AGAIN?', { cam: R('eric', 20, 2.0, 0.15), act: 'armsOut', expr: 'annoyed', dur: 1.5 });
  D.act('eric', 'idle');
  D.say('greg', "A superhero's gotta eat.", { cam: R('greg', 25, 2.0, 0.15), expr: 'grin', dur: 1.5 });
  // he sits down and eats
  {
    const tg = D.path('greg', [[-2.1, 0.05], [-0.75, 0.05]], 1.3);
    D.face('greg', P, 0.3, tg); D.anim('greg.z', 0.62, 0.4, tg); wait0(tg); D.act('greg', 'sitEat', 0.9); D.set('greg.propR', 'burger', 0.9); D.set('greg.propL', 'none', 0.9); D.set('pizza', 1, 0.9); D.set('living.burger', 1, 0.9);
    D.look('flare', 0, 0, 0.4); D.sfx('cupSet', 0.9, 0.4); D.sfx('munch', 1.6, 0.6); D.sfx('munch', 3.0, 0.6);
    for (const c of ['aaron', 'eric']) D.faceTo(c, -0.75, 0.62, 0.4, 0.4);
    D.cam(FIX([-0.4, 1.3, -2.1], [-0.7, 0.9, 0.6], { fov: 48 }));
    D.sound('Greg sits down and starts eating', 2.2, 0.4); D.wait(3.4);
  }
  // the first shadow, in the hallway
  {
    D.cam(FIX([2.6, 1.5, 4.7], [7.0, 1.2, 3.6], { pos2: [4.6, 1.45, 4.4], fov: 48, ease: 'linear' }));
    D.music('none', 0, 0, 1.0); D.sfx('drone', 0.4, 0.35);
    D.sound('The camera slowly moves toward the hallway...', 2.4, 0.2); D.wait(2.6);
    D.set('hallShadow.vis', 1); D.set('hallShadow.z', 3.2); D.anim('hallShadow.z', 4.1, 0.9); D.set('hallShadow.vis', 0, 0.9); D.sfx('shadowWhoosh', 0, 0.6);
    D.sound('A strange shadow appears', 1.6, 0.1); D.wait(1.8);
  }
  D.act('greg', 'sitChew'); D.expr('greg', 'surprised');
  D.cam(R('greg', -35, 1.8, 0.05, { fov: 40 })); D.sound('Greg stops chewing', 1.4); D.wait(1.6);
  D.say('greg', '...', { dur: 1.2 });
  D.look('greg', -0.9, 0, 0.6);
  D.cam(R('greg', -40, 1.9, 0.05, { fov: 40 })); D.sound('He looks toward the hallway', 1.6); D.wait(1.6);
  D.say('greg', 'Did anybody see that?', { expr: 'worried', dur: 1.4 });
  D.say('eric', 'See what?', { cam: R('eric', 25, 2.0, 0.15), expr: 'neutral', dur: 0.9 });
  D.say('greg', 'Something just moved.', { cam: R('greg', -35, 1.8, 0.05, { fov: 40 }), expr: 'worried', dur: 1.3 });
  D.say('flare', 'Probably your imagination.', { cam: R('flare', -25, 1.9, 0.05, { fov: 40 }), act: 'sitRelax', expr: 'tired', dur: 1.6 });
  D.look('greg', 0, 0.2, 0.5); D.act('greg', 'sitEat'); D.expr('greg', 'neutral');
  D.cam(R('greg', -35, 1.8, 0.05, { fov: 40 })); D.sound('Greg looks back toward his food', 1.6); D.wait(1.6);
  // a second shadow, right behind him
  {
    D.set('wallShadow.vis', 1); D.set('wallShadow.x', -1.6); D.anim('wallShadow.x', 2.2, 1.6, 0, 'linear'); D.set('wallShadow.vis', 0, 1.6); D.sfx('shadowWhoosh', 0, 0.7); D.sfx('spookyStinger', 0.2, 0.5);
    D.cam(FIX([-0.75, 1.15, -1.6], [-0.7, 1.4, 4.0], { fov: 54 }));
    D.sound('Suddenly, a second shadow appears behind him', 2.0, 0.1); D.wait(2.2);
  }
  D.act('greg', 'sitChew'); D.expr('greg', 'scared'); D.look('greg', 0, 0, 0.3);
  D.say('greg', "Okay, no. I'm not imagining that.", { cam: R('greg', -35, 1.8, 0.05, { fov: 40 }), dur: 1.8 });
  D.act('greg', 'standUp'); D.set('greg.propR', 'none'); D.anim('greg.z', 0.2, 0.8); D.face('greg', 0.3, 0.6, 0.5);
  D.cam(FIX([-0.8, 1.4, -2.4], [-0.7, 1.4, 3.0], { fov: 54 }));
  D.sound('He stands up. The shadow disappears', 2.0, 0.2); D.wait(2.4);
  D.act('greg', 'ready'); D.faceChar('aaron', 'greg', 0.3);
  D.say('aaron', 'Greg, sit down.', { cam: R('aaron', 20, 2.0, 0.15), expr: 'tired', dur: 1.2 });
  D.faceChar('greg', 'aaron', 0.3);
  D.say('greg', "There's something in here!", { cam: R('greg', 20, 2.0, 0.15), act: 'armsOut', expr: 'scared', dur: 1.5 });
  // the lights flicker, the TV turns on
  D.set('living.flicker', 1); D.sfx('bzzt', 0, 0.9); D.sfx('bzzt', 0.8, 0.7); D.sfx('lightBuzz', 0.2, 0.6);
  D.comic('BZZZT!', 0.05, 1.0, { x: 0.5, y: 0.3, size: 96, rot: 4, c1: '#ffffff', c2: '#ffe066' });
  everyone((c) => { D.expr(c, 'shocked'); });
  D.cam(FIX([3.8, 2.6, 3.8], [-0.6, 1.0, -0.8], { fov: 60 }));
  D.sound('Suddenly, the lights flicker', 1.8); D.wait(2.0);
  D.set('tv.soul', 1); D.sfx('tvOn', 0, 0.7); D.sfx('glitch', 0.3, 0.6);
  everyone((c) => { D.faceTo(c, 0, -4.5, 0.4); });
  D.faceTo('cowboy', 0, -4.5, 0.5);
  D.cam(FIX([1.6, 1.6, 1.8], [0.0, 1.7, -4.5], { pos2: [1.2, 1.65, 0.6], fov: 50 }));
  D.sound('The television turns on by itself. It shows a distorted image of the Soul Stealer', 3.4, 0.2); D.wait(3.6);
  D.sfx('muffled', 0, 0.5); D.sfx('glitch', 0.8, 0.5);
  D.say('soul', '...', { label: 'SOUL STEALER (ON SCREEN)', cam: FIX([0, 1.75, -1.6], [0, 1.75, -4.5], { fov: 46 }), dur: 1.8 });
  D.set('tv.soul', 0); D.set('living.flicker', 0); D.sfx('tvOff', 0, 0.6);
  D.cam(FIX([0.8, 1.6, -2.2], [0.0, 1.7, -4.5], { fov: 48 }));
  D.sound('The screen goes black', 1.4, 0.2); D.wait(1.8);
  everyone((c) => { D.faceTo(c, 0.4, 0.4, 0.4); });
  D.say('eric', "Okay, that's definitely not normal.", { cam: R('eric', 20, 2.0, 0.15), expr: 'worried', dur: 1.8 });
  D.path('leon', [[3.4, 1.8]], 1.3); D.faceTo('leon', 0, 0.5, 0.3, 0.9);
  D.say('leon', 'Everybody stay alert.', { cam: R('leon', 25, 2.1, 0.15), act: 'idle', expr: 'serious', dur: 1.4 });
  // the control room
  D.path('leon', [[5.0, 2.4]], 1.4); D.act('flare', 'standUp', 0.2); D.anim('flare.z', 0.1, 0.6, 0.2); D.act('flare', 'idle', 1.0); D.path('flare', [[2.0, 0.1], [2.6, 1.8], [5.0, 2.6]], 1.4, 1.0);
  D.cam(FIX([-1.6, 1.8, -1.6], [4.4, 1.3, 2.4], { fov: 48 }));
  D.sound('Leon walks toward the control room. Flare follows', 2.4, 0.2); D.wait(2.6);
  D.location('control');
  cast(['leon', 'flare']);
  D.set('map.mode', 2); D.set('map.zoom', 0); D.set('map.blip', 0);
  D.place('leon', -0.2, -2.2, P); D.act('leon', 'leanTable'); D.expr('leon', 'serious');
  D.place('flare', 1.7, -0.7, P - 0.6); D.act('flare', 'idle'); D.expr('flare', 'worried');
  D.music('mystery', 0.28, 0, 0.6);
  D.cam(FIX([0.8, 2.6, 3.4], [0, 2.0, -3.5], { fov: 54 }));
  D.sound('He checks the security cameras. Everything looks normal', 2.8, 0.2); D.wait(3.2);
  D.say('leon', "That's strange.", { cam: R('leon', -30, 1.9, 0.15, { lookY: -0.1 }), expr: 'thinking', dur: 1.2 });
  D.say('flare', 'What?', { cam: R('flare', -30, 2.0, 0.15), expr: 'surprised', dur: 0.9 });
  D.say('leon', 'Nothing is showing up.', { cam: R('leon', -30, 1.9, 0.15, { lookY: -0.1 }), act: 'pointMap', expr: 'serious', dur: 1.5 });
  // the lights flicker again: for a split second, HQ looks completely different
  D.location('living');
  cast(['aaron', 'eric', 'greg', 'cowboy', 'leon', 'flare']);
  D.set('pizza', 1); D.set('living.equip', 1); D.set('living.burger', 1);
  D.place('aaron', -1.6, -0.2, 0.6); D.act('aaron', 'idle'); D.expr('aaron', 'serious');
  D.place('eric', -2.6, 0.5, 0.9); D.act('eric', 'idle'); D.expr('eric', 'worried');
  D.place('greg', -0.75, 0.1, 0.3); D.act('greg', 'ready'); D.expr('greg', 'worried');
  D.place('cowboy', -6.25, -1.4, P / 2); D.act('cowboy', 'idle'); D.expr('cowboy', 'serious');
  D.place('leon', 5.0, 2.4, -P / 2 - 0.4); D.act('leon', 'idle'); D.expr('leon', 'serious');
  D.place('flare', 5.6, 2.9, -P / 2 - 0.3); D.act('flare', 'idle'); D.expr('flare', 'worried');
  D.path('leon', [[3.6, 1.7]], 1.3); D.path('flare', [[4.4, 2.6]], 1.3, 0.2);
  D.set('living.flicker', 1); D.sfx('bzzt', 0, 0.8); D.sfx('bzzt', 0.6, 0.6);
  D.set('illusion', 1, 0.9); D.set('illusion', 0, 1.25); D.sfx('illusionWarp', 0.8, 0.6); D.sfx('glitch', 0.9, 0.6); D.set('living.flicker', 0, 1.6);
  D.cam(FIX([3.2, 2.6, -3.4], [-0.8, 1.0, 1.4], { fov: 60 }));
  D.sound('The lights flicker again. For a split second, the entire headquarters looks completely different', 3.6, 0.1); D.wait(3.6);
  everyone((c) => { D.expr(c, 'shocked'); });
  D.say('aaron', 'Did anybody else see that?', { cam: R('aaron', 20, 2.0, 0.15), expr: 'shocked', dur: 1.5 });
  D.say('greg', 'YES!', { cam: R('greg', 20, 2.0, 0.15), act: 'armsOut', expr: 'scared', dur: 0.8 });
  D.act('greg', 'idle');
  D.say('flare', "I think we're being watched.", { cam: R('flare', 25, 2.0, 0.15), expr: 'serious', dur: 1.7 });

  // ===================================================================== SCENE 6: THE ILLUSIONS
  D.scene('6. The Illusions');
  D.music('eerie', 0.28, 0, 1.0);
  {
    D.face('greg', P, 0.3); D.anim('greg.z', 0.62, 0.5, 0.3); D.act('greg', 'sitEat', 0.6); D.set('greg.propR', 'pizza', 0.8); D.expr('greg', 'neutral', 0.8);
    D.path('aaron', [[-2.2, -1.4]], 1.0); D.faceTo('aaron', -0.75, 0.62, 0.4, 1.0);
    D.cam(FIX([-0.5, 1.4, -2.2], [-0.7, 0.9, 0.5], { fov: 48 }));
    D.sound('Greg returns to the couch and grabs his pizza', 2.2, 0.2); D.wait(2.6);
  }
  D.sfx('munch', 0, 0.6); D.cam(R('greg', -35, 1.8, 0.05, { fov: 40 })); D.sound('He takes a bite', 1.2); D.wait(1.6);
  // the pizza vanishes
  D.set('pizza', 0); D.set('greg.propR', 'none'); D.sfx('vanish', 0, 0.6); D.act('greg', 'sitChew');
  D.cam(FIX([-0.3, 1.5, -2.3], [-0.2, 0.6, -0.4], { fov: 48 }));
  D.sound('Suddenly, the pizza box disappears', 1.8, 0.1); D.wait(2.0);
  D.say('greg', 'WAIT.', { cam: R('greg', -35, 1.8, 0.05, { fov: 40 }), expr: 'shocked', dur: 0.9 });
  D.act('greg', 'lookHand'); D.look('greg', 0, 0.35, 0.4);
  D.sound('He looks at his hands', 1.4); D.wait(1.4);
  D.act('greg', 'armsOut'); D.look('greg', 0, 0, 0.3);
  D.say('greg', "WHERE'S MY PIZZA?!", { expr: 'scared', dur: 1.3 });
  D.faceChar('eric', 'greg', 0.3);
  D.say('eric', 'What?', { cam: R('eric', 20, 2.0, 0.15), expr: 'surprised', dur: 0.8 });
  D.say('greg', 'MY PIZZA!', { cam: R('greg', -35, 1.8, 0.05, { fov: 40 }), expr: 'angry', dur: 1.0 });
  everyone((c) => { D.faceChar(c, 'greg', 0.4); D.expr(c, 'surprised'); }, ['aaron', 'eric', 'leon', 'flare']);
  D.cam(FIX([-3.6, 1.9, -2.6], [0.4, 1.0, 0.6], { fov: 52 }));
  D.sound('Everyone looks at him', 1.4); D.wait(1.6);
  D.say('aaron', "Greg, it's right there.", { cam: R('aaron', 25, 2.0, 0.15), act: 'point', expr: 'tired', dur: 1.5 });
  D.act('aaron', 'idle');
  D.set('pizza', 1); D.set('greg.propR', 'pizza'); D.sfx('appear', 0, 0.5);
  D.act('greg', 'sitChew'); D.look('greg', 0, 0.4, 0.4);
  D.cam(FIX([-0.3, 1.5, -2.3], [-0.2, 0.6, -0.4], { fov: 48 }));
  D.sound('Greg looks down. The pizza box is suddenly back', 2.2, 0.2); D.wait(2.4);
  D.look('greg', 0, 0, 0.4);
  D.say('greg', '...', { cam: R('greg', -35, 1.8, 0.05, { fov: 40 }), expr: 'surprised', dur: 1.2 });
  D.say('greg', "Okay. That's weird.", { expr: 'worried', dur: 1.3 });
  D.act('greg', 'sitEat'); D.sfx('munch', 0.3, 0.6);
  D.sound('He takes another bite', 1.2); D.wait(1.6);
  // Greg's illusion: the room changes
  {
    cast(['greg']);
    D.set('greg.propR', 'pizza'); D.set('pizza', 1);
    D.anim('illusion', 1, 2.4); D.sfx('illusionWarp', 0, 0.8); D.sfx('heartbeat', 1.0, 0.6); D.sfx('heartbeat', 2.0, 0.6);
    D.music('none', 0, 0, 0.5);
    D.cam(FIX([3.6, 2.4, -3.2], [0.4, 1.0, 0.8], { pos2: [3.2, 2.2, -2.6], fov: 58 }));
    D.sound('The room begins changing. The walls become dark purple. The lights turn red', 3.4, 0.2); D.wait(3.6);
    D.cam(FIX([-3.2, 2.9, 3.6], [0.4, 3.0, -1.0], { fov: 56 }));
    D.sound('Greg’s heart pounds', 1.6, 0.1); D.wait(1.8);
    D.sfx('vanish', 0, 0.6); D.sfx('thud', 0.12, 0.7);
    D.act('greg', 'sitFloor', 0.1); D.anim('greg.y', -0.1, 0.15, 0.05); D.set('greg.propR', 'none', 0.1);
    D.cam(FIX([-0.8, 1.2, -2.0], [-0.7, 0.6, 0.8], { fov: 54 }));
    D.sound('The couch disappears!', 1.4, 0.1); D.wait(1.6);
  }
  D.set('greg.y', 0);
  D.say('greg', 'GUYS?!', { cam: R('greg', 15, 1.8, 0.0, { fov: 42 }), expr: 'scared', dur: 1.0 });
  D.act('greg', 'standUp'); D.look('greg', -0.6, 0, 0.5); D.look('greg', 0.6, 0, 0.6, 0.6);
  D.cam(FIX([1.4, 1.6, -2.6], [-0.7, 1.2, 0.8], { fov: 50 }));
  D.sound('Greg stands up', 1.4); D.wait(1.8);
  D.act('greg', 'idle'); D.look('greg', 0, 0, 0.3);
  D.say('greg', 'AARON?!', { cam: R('greg', 25, 2.0, 0.1, { fov: 42 }), act: 'armsOut', expr: 'scared', dur: 1.0 });
  {
    D.act('greg', 'idle');
    D.path('greg', [[-0.75, 0.0], [2.0, 0.0], [4.6, 3.0], [6.8, 3.6]], 4.5);
    D.cam(FIX([-3.4, 1.7, -1.8], [4.0, 1.3, 2.4], { fov: 50 }));
    D.sound('He runs toward the hallway...', 1.6, 0.1); D.wait(1.6);
  }
  // the endless hallway
  D.location('hall9');
  cast(['greg']);
  D.place('greg', 0, 0, P); D.act('greg', 'idle'); D.expr('greg', 'scared');
  D.set('hall.far', 12); D.set('hall.warp', 1);
  {
    D.path('greg', [[0, -60]], 5.0);
    D.anim('hall.far', 110, 12.5, 0, 'linear'); D.sfx('illusionWarp', 0.3, 0.7); D.sfx('heartbeat', 0.6, 0.7); D.sfx('heartbeat', 1.6, 0.7); D.sfx('heartbeat', 2.6, 0.7); D.sfx('heartbeat', 3.6, 0.7);
    D.cam(F(['greg'], 0, 3.4, 0.25, { lookY: -0.25, fov: 34, dist2: 1.3, fov2: 78, h2: 0.15 }));
    D.sound('But the hallway seems to stretch endlessly', 3.0, 0.3); D.wait(3.2);
    D.cam(F(['greg'], 90, 1.0, 0.2, { lookY: -0.2, fov: 70 }));
    D.sound('He runs and runs... but the end of the hallway keeps moving farther away', 3.2, 0.1); D.wait(3.4);
    D.cam(F(['greg'], 180, 3.0, 0.1, { lookY: -0.15, fov: 52, dist2: 3.4 }));
    D.say('greg', 'AAAAAAH!', { expr: 'scared', dur: 1.2 });
    D.wait(0.6);
  }
  // ---- Aaron's perspective
  D.location('living');
  cast(['aaron', 'eric', 'greg', 'leon', 'flare', 'cowboy']);
  D.set('illusion', 0); D.set('pizza', 1);
  D.place('greg', 2.4, 2.2, P / 2 + 0.2); D.act('greg', 'frozenStare'); D.expr('greg', 'scared');
  D.place('aaron', -2.2, -1.4, 0.9); D.act('aaron', 'idle'); D.expr('aaron', 'worried');
  D.place('eric', -2.1, 0.2, 1.0); D.act('eric', 'idle'); D.expr('eric', 'worried');
  D.place('leon', 3.6, 1.0, -0.6); D.act('leon', 'idle'); D.expr('leon', 'worried');
  D.place('flare', 4.4, 2.0, -1.4); D.act('flare', 'idle'); D.expr('flare', 'worried');
  D.place('cowboy', -6.25, -1.4, 0.9); D.act('cowboy', 'idle'); D.expr('cowboy', 'serious');
  D.music('eerie', 0.24, 0, 0.5);
  D.cam(FIX([-2.6, 1.6, -2.2], [2.2, 1.3, 2.0], { pos2: [-2.4, 1.6, -2.0], fov: 46 }));
  D.sound('From Aaron’s perspective: Greg is standing perfectly still in the living room', 3.4, 0.2); D.wait(3.6);
  D.say('aaron', 'Greg?', { cam: R('aaron', 30, 2.0, 0.15), expr: 'worried', dur: 0.9 });
  {
    const tw = D.path('aaron', [[-1.6, 0.0], [0.6, 0.0]], 1.0);
    D.cam(FIX([-3.4, 1.5, -2.6], [1.6, 1.3, 1.6], { fov: 46 }));
    D.sound('Aaron walks toward him', 1.4, 0.2); wait0(tw * 0.65);
  }
  D.say('aaron', 'Greg, what are you doing?', { cam: R('aaron', 30, 2.0, 0.15), expr: 'worried', dur: 1.5 });
  D.stop('aaron'); D.faceChar('aaron', 'greg', 0.3);
  D.faceChar('greg', 'aaron', 0.18); D.act('greg', 'armsOut'); D.expr('greg', 'scared'); D.sfx('whoosh', 0, 0.5); D.sfx('spookyStinger', 0, 0.5);
  D.say('greg', "DON'T COME CLOSER!", { cam: R('greg', 15, 1.9, 0.1, { fov: 40 }), dur: 1.4 });
  D.act('aaron', 'armsOut'); D.expr('aaron', 'surprised');
  D.say('aaron', 'What are you talking about?', { cam: R('aaron', 20, 2.0, 0.15), dur: 1.5 });
  D.act('aaron', 'idle');
  // the illusion ends
  D.set('illusion', 1); D.anim('illusion', 0, 0.7, 0.1); D.sfx('glitch', 0, 0.6); D.sfx('illusionWarp', 0, 0.4); D.set('flashViolet', 0.4); D.anim('flashViolet', 0, 0.4);
  D.act('greg', 'idle'); D.expr('greg', 'surprised');
  D.cam(FIX([3.8, 1.6, 0.2], [2.4, 1.3, 2.2], { fov: 46 }));
  D.sound('The illusion disappears. Greg is back in the normal living room', 3.0, 0.2); D.wait(3.0);
  D.say('greg', '...', { cam: R('greg', 15, 1.9, 0.1, { fov: 40 }), dur: 1.2 });
  D.say('aaron', 'You okay?', { cam: R('aaron', 20, 2.0, 0.15), expr: 'worried', dur: 1.0 });
  D.say('greg', 'I think somebody is messing with us.', { cam: R('greg', 15, 1.9, 0.1, { fov: 40 }), expr: 'serious', dur: 1.9 });
  // Leon's monitor
  D.path('leon', [[5.0, 2.4]], 1.4);
  D.say('leon', 'Guys, come look at this!', { label: 'LEON (FROM THE CONTROL ROOM)', cam: FIX([-0.4, 1.8, -2.4], [4.4, 1.5, 2.2], { fov: 48 }), dur: 1.6 });
  D.location('control');
  cast([...TEAM, 'cowboy']);
  D.set('map.mode', 3);
  D.place('leon', -0.2, -2.2, P); D.act('leon', 'leanTable'); D.expr('leon', 'worried');
  D.place('flare', 1.0, -1.6, P - 0.3); D.act('flare', 'idle'); D.expr('flare', 'worried');
  D.place('aaron', -1.3, -1.3, P + 0.3); D.act('aaron', 'idle'); D.expr('aaron', 'worried');
  D.place('eric', 1.9, -0.6, P - 0.5); D.act('eric', 'idle'); D.expr('eric', 'worried');
  D.place('greg', -2.1, -0.4, P + 0.5); D.act('greg', 'idle'); D.expr('greg', 'scared');
  D.place('cowboy', 0.5, 0.4, P); D.act('cowboy', 'idle'); D.expr('cowboy', 'serious');
  D.sfx('glitch', 0.2, 0.5); D.sfx('blackPulse', 0.4, 0.5);
  D.cam(FIX([0.4, 2.4, 3.2], [0, 2.0, -3.5], { pos2: [0.3, 2.3, 2.6], fov: 54 }));
  D.sound('Everyone gathers around the screen. It shows a strange purple eye', 3.2, 0.2); D.wait(3.4);
  D.say('flare', "That's not good.", { cam: R('flare', 30, 1.9, 0.15), expr: 'worried', dur: 1.2 });
  D.say('aaron', 'What is it?', { cam: R('aaron', -30, 1.9, 0.15), expr: 'serious', dur: 1.0 });
  D.say('leon', "I don't know.", { cam: R('leon', 35, 1.9, 0.15, { lookY: -0.1 }), expr: 'worried', dur: 1.1 });
  D.set('map.mode', 4); D.sfx('tvOff', 0, 0.7); D.music('none', 0, 0, 0.2);
  everyone((c) => { D.expr(c, 'shocked'); });
  D.cam(FIX([0.8, 2.6, 3.4], [0, 2.0, -3.5], { fov: 54 }));
  D.sound('The screen suddenly shuts off', 1.6, 0.1); D.wait(1.8);
  D.sound('Silence...', 2.0); D.wait(2.6);
  D.say('eric', 'So... are we still having that party?', { cam: R('eric', 25, 2.0, 0.15), act: 'shrug', expr: 'happy', dur: 2.0 });
  D.faceChar('flare', 'eric', 0.25);
  D.say('flare', 'ERIC!', { cam: R('flare', 25, 2.0, 0.15), act: 'armsOut', expr: 'angry', dur: 1.0 });
  D.act('flare', 'idle');
  D.anim('fade', 1, 0.6); D.wait(0.7);

  // ===================================================================== SCENE 7: THE FINAL ARRIVAL
  D.scene('7. The Final Arrival');
  D.location('hqExt');
  cast(['soul']);
  D.set('night', 1); D.set('evening', 0); D.set('hq.doors', 0); D.set('hq.clear', 1); D.set('hq.skyline', 1); D.set('hq.balcony', 0); D.set('hcar.vis', 0); D.set('hq.doorBroken', 0);
  D.set('hq.purple', 0);
  D.hide('soul');
  D.music('ominous', 0.34, 0, 1.0); D.sfx('wind', 0.2, 0.5);
  D.anim('fade', 0, 1.2);
  D.cam(FIX([9.0, 3.4, 16.0], [0, 3.0, -4.0], { pos2: [7.6, 3.0, 13.0], fov: 50 }));
  D.card('location', 3.0, { text: 'OUTSIDE BATTLE WARS HQ  -  NIGHT' });
  D.sound('The street is completely quiet. No cars are moving. No people are walking', 3.6, 0.6); D.wait(4.4);
  // the portal
  const PZ = 21;
  D.fx('portal', { x: 0, y: 8.6, z: PZ, ry: 0, radius: 6.5, dur: 64, color: 0xa040ff });
  D.anim('hq.purple', 1, 1.5); D.sfx('portalOpen', 0, 1.0); D.sfx('rumbleDeep', 0.2, 0.7); D.shake(0.4, 1.6);
  D.cam(FIX([0, 2.0, -1.6], [0, 6.0, 20], { fov: 58 }));
  D.sound('Suddenly, a huge purple portal opens', 2.4, 0.2); D.wait(2.6);
  D.fx('bolt', { x: -5.5, y: 0.1, z: PZ, top: 15, dur: 0.3, size: 0.6, color: 0xc070ff }, 0.2); D.fx('bolt', { x: 5.8, y: 0.1, z: PZ + 0.5, top: 14, dur: 0.3, size: 0.6, color: 0xc070ff }, 0.9);
  D.sfx('electricSlam', 0.2, 0.5); D.sfx('electricSlam', 0.9, 0.4);
  D.cam(FIX([-6.0, 0.6, 10.0], [0, 8.5, PZ], { fov: 60 }));
  D.sound('Purple lightning crackles around it', 2.0, 0.1); D.wait(2.2);
  D.show('soul'); D.place('soul', 0.4, PZ + 0.6, P); D.set('soul.y', 0); D.set('soul.eyes', 1.2); D.set('soul.violet', 1); D.set('soul.raise', 0); D.set('soul.palm', 0);
  D.anim('soul.z', PZ - 3.0, 2.6, 0, 'out'); D.anim('soul.x', 2.6, 2.6, 0, 'out'); D.sfx('teleport', 0, 0.6);
  D.cam(FIX([4.6, 1.6, 12.5], [2.0, 2.4, PZ - 1.0], { fov: 46 }));
  D.sound('The Soul Stealer steps out', 1.8, 0.4); D.wait(2.4);
  // the creatures behind him
  D.show('beh'); D.place('beh', -12, PZ + 1, P); D.set('beh.s', 10); D.set('beh.dissolve', 0); D.set('beh.rear', 0.55); D.set('beh.nod', 0); D.set('beh.look', 0.15); D.set('beh.y', 0); D.set('beh.eyes', 1); D.set('beh.aura', 0.4); D.set('beh.sway', 0.3); D.set('beh.slither', 0.3);
  D.show('horse'); D.place('horse', 14, PZ + 1, P - 0.2); D.set('horse.scale', 4.6); D.set('horse.alpha', 1); D.set('horse.purple', 1); D.set('horse.glow', 1.8); D.set('horse.act', 'idle'); D.set('horse.rz', 0); D.set('horse.y', 0);
  D.show('titan'); D.place('titan', 0, PZ + 10, P); D.set('titan.s', 1.4); D.set('titan.eyes', 1.0); D.set('titan.jaw', 0); D.set('titan.roar', 0); D.set('titan.look', 0); D.set('titan.nod', 0.1);
  D.set('beh.crest', 0);
  D.cam(FIX([0, 2.2, -2.8], [0, 7.5, PZ + 4], { pos2: [0, 2.0, -1.8], fov: 64 }));
  D.sound('Behind him are several enormous creatures', 2.6, 0.3); D.wait(2.8);
  D.anim('beh.look', -0.15, 1.6); D.sfx('growRumble', 0.2, 0.5);
  D.cam(FIX([-5.6, 1.6, 9.0], [-12, 5.0, PZ - 2], { fov: 50 }));
  D.sound('Behemoth stands on one side', 1.8); D.wait(2.0);
  D.set('horse.act', 'snort'); D.sfx('horseSnort', 0.2, 0.7);
  D.cam(FIX([4.0, 2.0, 6.0], [13, 6.0, PZ], { fov: 50 }));
  D.sound('A massive horse stands on the other', 1.8); D.wait(2.0);
  D.set('horse.act', 'idle');
  D.anim('titan.eyes', 2.2, 1.2); D.anim('titan.nod', 0.25, 1.6); D.sfx('titanStep', 0.2, 0.6); D.sfx('drone', 0.3, 0.5);
  D.cam(FIX([0, 3.0, 5.0], [0, 15.5, PZ + 10], { fov: 56, pos2: [0, 3.2, 6.2] }));
  D.sound('Behind them is a huge monster with glowing blue eyes. It is unlike anything the team has seen before', 4.4, 0.2); D.wait(4.6);
  // another creature emerges from the portal
  D.show('shadow'); D.set('shadow.x', 0); D.set('shadow.z', PZ + 4); D.set('shadow.y', 0); D.set('shadow.s', 0.9); D.set('shadow.eyes', 0);
  D.anim('shadow.z', PZ + 0.5, 4.0, 0, 'out'); D.anim('shadow.eyes', 1, 1.5, 1.5); D.sfx('shadowWhoosh', 0.2, 0.7); D.sfx('breathing', 0.8, 0.5);
  D.cam(FIX([1.6, 2.4, 9.0], [0, 6.0, PZ + 2], { fov: 54 }));
  D.sound('Another creature slowly emerges from the portal...', 3.0, 0.3); D.wait(3.8);
  D.cam(FIX([0, 1.4, -3.0], [0, 8.0, PZ + 4], { fov: 70, pos2: [0, 1.5, -2.2] }));
  D.sound('The Soul Stealer’s monsters fill the street', 2.4, 0.1); D.wait(2.6);
  D.face('soul', P, 0.6);
  D.cam(F(['soul'], 195, 3.6, -0.2, { lookY: -0.2, fov: 42 }));
  D.sound('The Soul Stealer looks toward the headquarters', 2.0, 0.2); D.wait(2.2);
  D.say('soul', '...', { cam: F(['soul'], 180, 2.4, -0.1, { lookY: -0.1, fov: 40 }), dur: 1.6 });
  {
    D.anim('soul.z', -1.2, 9.0, 0, 'linear'); D.anim('soul.x', 0, 9.0, 0, 'linear');
    D.cam(FIX([3.6, 1.3, 7.0], [1.8, 2.0, 15], { look2: [0.6, 2.0, 9], fov: 52 }));
    D.sound('He walks forward', 1.6, 0.3); D.wait(2.0);
  }
  // inside
  D.location('living');
  cast([...TEAM, 'cowboy']);
  D.set('night', 1); D.set('evening', 0); D.set('illusion', 0); D.set('pizza', 1); D.set('living.equip', 1); D.set('living.burger', 1); D.set('tv.off', 1); D.set('map.mode', 4);
  D.set('door.open', 0); D.set('door.purple', 0); D.set('door.glass', 0); D.set('door.shake', 0); D.set('living.dark', 0); D.set('living.emergency', 0);
  D.place('leon', 1.4, -0.3, -1.0); D.act('leon', 'crossArms'); D.expr('leon', 'serious');
  D.place('aaron', -1.8, -1.0, 0.5); D.act('aaron', 'idle'); D.expr('aaron', 'serious');
  D.place('flare', 0.75, 0.62, P); D.act('flare', 'sitRelax'); D.expr('flare', 'worried');
  D.place('greg', -0.75, 0.62, P); D.act('greg', 'sitEat'); props('greg', 'pizza'); D.expr('greg', 'worried');
  D.place('eric', -3.2, -0.8, 1.2); D.act('eric', 'idle'); D.expr('eric', 'worried');
  D.place('cowboy', -6.0, -1.6, -P / 2 + 0.3); D.act('cowboy', 'idle'); D.expr('cowboy', 'serious');
  D.music('mystery', 0.26, 0, 0.6);
  D.cam(FIX([2.6, 2.3, -3.6], [-0.4, 1.0, 0.4], { fov: 54 }));
  D.sound('Inside, the team is still talking about the strange illusions', 2.8, 0.2); D.wait(3.0);
  D.say('leon', 'Whatever is happening, we need to figure it out.', { cam: R('leon', 25, 2.0, 0.15), expr: 'serious', dur: 2.2 });
  D.say('aaron', 'I agree.', { cam: R('aaron', 25, 2.0, 0.15), dur: 0.9 });
  // KNOCK. KNOCK. KNOCK.
  D.sfx('knock', 0.1, 1.0); D.music('none', 0, 0, 0.2);
  D.set('door.shake', 0.3, 0.1); D.set('door.shake', 0, 0.25); D.set('door.shake', 0.3, 0.52); D.set('door.shake', 0, 0.67); D.set('door.shake', 0.3, 0.94); D.set('door.shake', 0, 1.09);
  D.comic('KNOCK.', 0.1, 0.5, { x: 0.3, y: 0.3, size: 80, rot: -6, c1: '#ffffff', c2: '#c0c8d8' }); D.comic('KNOCK.', 0.52, 0.5, { x: 0.5, y: 0.26, size: 86, rot: 3, c1: '#ffffff', c2: '#c0c8d8' }); D.comic('KNOCK.', 0.94, 0.6, { x: 0.7, y: 0.3, size: 92, rot: -2, c1: '#ffffff', c2: '#c0c8d8' });
  D.cam(FIX([-4.6, 1.6, 1.0], [-7.1, 1.4, 2.6], { fov: 48 }));
  D.sound('Suddenly, a loud knock comes from the front door', 2.4, 0.2); D.wait(2.6);
  everyone((c) => { D.faceTo(c, -7.2, 2.6, 0.5); D.expr(c, 'surprised'); });
  D.faceTo('cowboy', -7.2, 2.6, 0.5); D.act('greg', 'sitChew');
  D.cam(FIX([2.6, 1.8, -2.6], [-1.6, 1.1, 1.0], { fov: 54 }));
  D.sound('Everyone stops talking', 1.6); D.wait(1.8);
  D.say('eric', 'Are we expecting somebody?', { cam: R('eric', 30, 2.0, 0.15), expr: 'worried', dur: 1.5 });
  D.say('greg', "If it's more cleaning supplies, I'm not answering.", { cam: R('greg', 30, 1.9, 0.05, { fov: 40 }), expr: 'annoyed', dur: 2.3 });
  {
    D.path('aaron', [[-2.4, 0.9], [-4.8, 2.3]], 0.75);
    D.cam(FIX([-1.0, 1.6, -1.6], [-5.6, 1.3, 2.4], { fov: 48 }));
    D.sound('Aaron slowly walks toward the door', 2.2, 0.2); wait0(2.4);
  }
  D.act('flare', 'standUp'); D.anim('flare.z', 0.2, 0.8);
  D.say('flare', 'Wait.', { cam: R('flare', 30, 1.9, 0.05, { fov: 40 }), expr: 'worried', dur: 0.9 });
  D.stop('aaron'); D.faceChar('aaron', 'flare', 0.5);
  D.cam(R('aaron', 30, 2.0, 0.15)); D.sound('Aaron stops', 1.2); D.wait(1.3);
  D.act('flare', 'idle');
  D.say('flare', "Something doesn't feel right.", { cam: R('flare', 30, 1.9, 0.05, { fov: 40 }), expr: 'serious', dur: 1.7 });
  // outside: the true form
  D.location('hqExt');
  cast(['soul', 'beh', 'horse', 'titan', 'shadow']);
  D.set('hq.purple', 1);
  D.place('soul', 0, -1.2, P); D.set('soul.y', 0); D.set('soul.eyes', 1.2); D.set('soul.raise', 0); D.set('soul.palm', 0);
  D.place('beh', -12, PZ, P - 0.2); D.set('beh.rear', 0.55); D.set('beh.look', -0.15);
  D.place('horse', 14, PZ - 1, P - 0.25); D.set('horse.scale', 4.6); D.set('horse.act', 'idle'); D.set('horse.purple', 1); D.set('horse.glow', 1.8);
  D.place('titan', 0, PZ + 10, P); D.set('titan.s', 1.4); D.set('titan.eyes', 2.2); D.set('titan.nod', 0.25);
  D.show('shadow'); D.set('shadow.x', 0); D.set('shadow.z', PZ + 0.5); D.set('shadow.eyes', 1); D.set('shadow.s', 0.9);
  D.music('villain', 0.34, 0, 0.4);
  D.cam(FIX([0.6, 1.0, -3.3], [0, 2.0, 2.0], { fov: 58 }));
  D.sound('Outside, the Soul Stealer stands directly in front of the entrance', 2.8, 0.2); D.wait(3.0);
  D.anim('soul.raise', 1, 1.2); D.anim('soul.palm', 1, 1.2); D.sfx('crystalHum', 0.2, 0.6);
  D.cam(FIX([2.2, 1.3, -3.2], [0, 1.9, -1.2], { fov: 50 }));
  D.sound('He slowly raises his hand', 1.8, 0.2); D.wait(2.2);
  D.fx('bodyAura', { who: 'soul', dur: 4.0, color: 0xa040ff, power: 1.4 }); D.anim('soul.charge', 0.8, 1.0); D.sfx('powerUp', 0, 0.6); D.anim('soul.eyes', 1.4, 1.0);
  D.cam(FIX([2.4, 1.8, -3.2], [0, 1.7, -1.2], { fov: 52 }));
  D.sound('Purple energy surrounds his body', 2.0, 0.2); D.wait(2.4);
  // he takes off the black cloak
  {
    D.hide('soul'); D.anim('soul.charge', 0, 0.1);
    D.show('soulX'); D.place('soulX', 0, -1.2, P); D.act('soulX', 'grabHem'); D.expr('soulX', 'serious'); D.set('soulX.energy', 0); D.set('soulX.eyeGlow', 1);
    D.set('cloak.vis', 1); D.set('cloak.x', 0); D.set('cloak.z', -1.2); D.set('cloak.y', 0); D.set('cloak.ry', P); D.set('cloak.rx', 0); D.set('cloak.rz', 0); D.set('cloak.spread', 0); D.set('cloak.flutter', 0); D.set('cloak.alpha', 1);
    D.fx('flashBurst', { x: 0, y: 1.2, z: -1.2, dur: 0.5, radius: 1.4, color: 0xa040ff, light: 20 });
    D.cam(FIX([1.3, 0.8, -3.2], [0, 0.7, -1.2], { fov: 46 }));
    D.anim('cloak.y', 0.6, 2.4, 0.4, 'inout'); D.anim('cloak.spread', 0.15, 2.4, 0.4); D.sfx('bagRustle', 0.6, 0.4);
    D.sound('He grabs the bottom of his black jacket...', 2.2, 0.2); D.wait(2.4);
    D.act('soulX', 'pullOff');
    D.anim('cloak.y', 2.3, 1.8, 0, 'inout'); D.anim('cloak.spread', 0.35, 1.0); D.anim('cloak.flutter', 1, 1.0);
    D.anim('cloak.y', 4.6, 1.2, 1.8, 'out'); D.anim('cloak.z', 5.5, 1.6, 1.7, 'out'); D.anim('cloak.rx', -1.6, 1.6, 1.7); D.anim('cloak.rz', 0.6, 1.6, 1.7); D.anim('cloak.alpha', 0, 0.6, 2.9);
    D.set('cloak.vis', 0, 3.6);
    D.sfx('bagRustle', 0.2, 0.7); D.sfx('whoosh', 1.8, 0.8); D.sfx('energyWave', 2.0, 0.6);
    D.cam(FIX([2.2, 1.5, -3.3], [0, 1.8, -1.2], { pos2: [1.8, 1.6, -3.2], fov: 50 }));
    D.sound('Slowly, he takes it off. His true form begins to appear', 3.2, 0.3); D.wait(3.6);
    D.act('soulX', 'powerStance');
    D.anim('soulX.energy', 1, 2.8); D.anim('soulX.eyeGlow', 3.0, 2.0); D.sfx('powerUpBlue', 0, 0.7); D.sfx('electricHum', 0.3, 0.5);
    D.fx('bodyAura', { who: 'soulX', dur: 9.0, color: 0x6a8aff, power: 1.2 }); D.fx('bodyAura', { who: 'soulX', dur: 9.0, color: 0xb050ff, power: 1.0 }, 0.4);
    D.fx('sparks', { x: 0, y: 1.4, z: -1.2, n: 60, color: 0x9a7aff, speed: 2.5 }, 0.3);
    D.cam(R('soulX', 0, 2.1, 0.2, { lookY: -0.25, fov: 46, dist2: 1.7 }));
    D.sound('His body changes. His glowing eyes become brighter', 3.0, 0.2); D.wait(3.3);
    D.cam(R('soulX', 25, 1.4, 0.1, { lookY: -0.08, fov: 38, dist2: 1.15 }));
    D.sound('Strange blue and purple energy spreads across his body', 2.8); D.wait(3.0);
  }
  // the monsters roar
  {
    D.anim('titan.roar', 1, 0.5); D.anim('titan.roar', 0, 0.8, 2.6); D.sfx('titanRoar', 0, 0.9);
    D.anim('beh.jaw', 1, 0.3, 0.2); D.anim('beh.rear', 0.75, 0.6, 0.2); D.anim('beh.jaw', 0, 0.5, 2.4); D.sfx('monsterRoar', 0.2, 0.8);
    D.set('horse.act', 'neigh', 0.4); D.sfx('giantNeigh', 0.4, 0.8); D.set('horse.act', 'idle', 2.6);
    D.shake(1.0, 3.0);
    D.cam(FIX([0, 1.0, -3.6], [0, 6.0, PZ], { fov: 66 }));
    D.say('behemoth', 'RRRRAAAAAAAHHHH!', { label: 'THE MONSTERS', dur: 2.6 });
  }
  // inside: lights out
  D.location('living');
  cast([...TEAM, 'cowboy']);
  D.set('night', 1); D.set('pizza', 1); D.set('living.equip', 1); D.set('living.burger', 1);
  D.place('leon', 1.4, -0.3, -1.6); D.act('leon', 'idle'); D.expr('leon', 'worried');
  D.place('aaron', -4.8, 2.3, -0.9); D.act('aaron', 'idle'); D.expr('aaron', 'worried');
  D.place('flare', 0.75, 0.1, -1.4); D.act('flare', 'idle'); D.expr('flare', 'worried');
  D.place('greg', -0.75, 0.62, P); D.act('greg', 'sitChew'); props('greg', 'pizza'); D.expr('greg', 'scared');
  D.place('eric', -3.2, -0.8, -1.6); D.act('eric', 'idle'); D.expr('eric', 'worried');
  D.place('cowboy', -6.0, -1.6, 0.2); D.act('cowboy', 'idle'); D.expr('cowboy', 'serious');
  D.set('living.dark', 1); D.sfx('powerCut', 0, 0.8);
  D.cam(FIX([2.6, 2.3, -3.6], [-0.4, 1.0, 0.4], { fov: 56 }));
  D.sound('The lights suddenly turn completely black', 2.0, 0.1); D.wait(2.0);
  D.say('greg', 'Guys?', { cam: R('greg', 20, 1.8, 0.05, { fov: 40 }), dur: 1.0 });
  D.set('living.emergency', 1); D.sfx('emergencyOn', 0, 0.7);
  D.set('greg.propR', 'none'); D.act('greg', 'standUp'); D.anim('greg.z', 0.2, 0.8);
  D.cam(FIX([3.0, 2.6, -3.6], [-1.2, 1.0, 1.0], { fov: 58 }));
  D.sound('Emergency lights activate', 1.8, 0.2); D.wait(2.0);
  everyone((c) => { D.faceTo(c, -7.2, 2.6, 0.5); D.act(c, 'idle'); D.expr(c, 'shocked'); });
  D.faceTo('cowboy', -7.2, 2.6, 0.5);
  D.cam(FIX([1.6, 1.5, -2.0], [-7.1, 1.4, 2.6], { fov: 52 }));
  D.sound('Everyone looks toward the front entrance', 2.0); D.wait(2.2);
  D.anim('door.shake', 1, 0.4); D.sfx('doorRattle', 0, 0.9); D.sfx('doorRattle', 0.8, 0.8);
  D.cam(FIX([-5.0, 1.4, 1.4], [-7.1, 1.4, 2.6], { fov: 46 }));
  D.sound('The door begins shaking', 1.8, 0.1); D.wait(2.2);
  // BOOOOOOM
  D.set('door.shake', 2.5); D.anim('door.shake', 0.4, 0.8); D.set('door.purple', 1); D.set('door.glass', 1);
  D.sfx('bigBlast', 0, 0.9); D.sfx('doorBang', 0, 0.8); D.shake(1.4, 1.2); D.set('flashViolet', 0.45); D.anim('flashViolet', 0, 0.5);
  D.comic('BOOOOOOM!', 0, 1.3, { x: 0.5, y: 0.35, size: 130, rot: -4, c1: '#ffffff', c2: '#c060ff' });
  everyone((c) => { D.act(c, 'jumpScare'); });
  D.cam(FIX([-3.6, 1.6, 0.6], [-7.1, 1.5, 2.6], { fov: 52 }));
  D.sound('BOOOOOOM!', 1.4, 0.1); D.wait(1.8);
  everyone((c) => { D.act(c, 'ready'); });
  D.act('cowboy', 'idle');
  D.anim('door.shake', 0, 0.6); D.set('door.glass', 2); D.sfx('blackPulse', 0, 0.6); D.sfx('heartbeat', 0.4, 0.7);
  D.cam(FIX([-5.4, 1.6, 2.4], [-7.1, 1.55, 2.6], { pos2: [-5.8, 1.6, 2.5], fov: 44 }));
  D.sound('The Soul Stealer’s silhouette appears through the glass', 2.6, 0.2); D.wait(2.8);
  D.say('aaron', '...Everybody get ready.', { cam: R('aaron', 25, 1.9, 0.12, { fov: 42 }), act: 'ready', expr: 'determined', dur: 1.8 });
  everyone((c) => { D.expr(c, 'determined'); }, ['flare', 'eric', 'leon']);
  // the door opens
  {
    D.show('soulX'); D.place('soulX', -7.75, 2.6, P / 2); D.act('soulX', 'idle'); D.set('soulX.energy', 1); D.set('soulX.eyeGlow', 3.0); D.expr('soulX', 'serious');
    D.anim('door.open', 1, 2.6, 0, 'inout'); D.set('door.glass', 1); D.sfx('cageCreak', 0, 0.6); D.sfx('drone', 0.2, 0.5);
    D.cam(FIX([-1.8, 1.55, 2.6], [-7.7, 1.7, 2.6], { pos2: [-4.9, 1.65, 2.6], fov: 46, ease: 'linear' }));
    D.sound('The door slowly opens. The camera moves toward the Soul Stealer’s revealed form', 3.6, 0.3); D.wait(4.0);
  }
  D.look('soulX', 0, 0.05, 0.6);
  D.cam(R('soulX', 0, 1.5, 0.05, { lookY: -0.05, fov: 38 }));
  D.sound('He looks directly at the team', 1.8, 0.1); D.wait(2.0);
  D.say('soulX', "It's time.", { cam: R('soulX', 10, 1.15, 0.05, { lookY: -0.05, fov: 36 }), dur: 1.8 });
  D.anim('soulX.eyeGlow', 4.0, 1.0); D.sfx('blackPulse', 0, 0.6);
  D.cam(R('soulX', 0, 0.9, 0.0, { lookY: 0.12, fov: 34, dist2: 0.7 }));
  D.sound('His eyes blaze even brighter', 1.8, 0.2); D.wait(2.4);
  // the final beats
  D.location('hqExt');
  cast(['beh', 'horse', 'titan', 'shadow']);
  D.set('hq.purple', 1); D.set('hq.doors', 1);
  D.place('beh', -12, PZ, P - 0.2); D.set('beh.rear', 0.55); D.set('beh.look', -0.15);
  D.place('horse', 14, PZ - 1, P - 0.25); D.set('horse.scale', 4.6); D.set('horse.act', 'idle');
  D.place('titan', 0, PZ + 10, P); D.set('titan.s', 1.4); D.set('titan.eyes', 2.4); D.set('titan.nod', 0.2);
  D.show('shadow'); D.set('shadow.x', 0); D.set('shadow.z', PZ + 0.5); D.set('shadow.eyes', 1);
  D.music('darkTheme', 0.4, 0, 0.3);
  D.anim('titan.z', PZ + 5, 3.2, 0, 'inout'); D.sfx('titanStep', 0.4, 1.0); D.sfx('titanStep', 1.6, 1.0); D.sfx('titanStep', 2.8, 1.0); D.shake(0.6, 0.5, 0.4); D.shake(0.6, 0.5, 1.6); D.shake(0.6, 0.5, 2.8);
  D.cam(FIX([0, 1.2, 4.0], [0, 14, PZ + 7], { fov: 60 }));
  D.sound('The blue-eyed monster steps forward', 2.2, 0.2); D.wait(3.2);
  roar(2.2, 'RRRRRRAAAAAAAAHHHH!', { cam: FIX([-6.5, 1.6, 9.0], [-11, 5.5, PZ - 3], { fov: 52 }), shake: 0.9 });
  D.set('horse.act', 'raiseHead'); D.sfx('horseSnort', 0.3, 0.8); D.anim('horse.glow', 3.0, 1.0);
  D.cam(FIX([6.0, 1.3, 6.0], [13, 10.0, PZ - 1], { fov: 56 }));
  D.sound('The horse raises its head', 1.8, 0.2); D.wait(2.6);
  D.location('living');
  cast([...TEAM, 'cowboy']);
  D.set('night', 1); D.set('living.dark', 1); D.set('living.emergency', 1); D.set('door.open', 1); D.set('door.purple', 1); D.set('door.glass', 1);
  D.place('leon', -2.4, -0.4, -1.4); D.act('leon', 'ready'); D.expr('leon', 'determined');
  D.place('aaron', -4.6, 2.0, -1.3); D.act('aaron', 'ready'); D.expr('aaron', 'determined');
  D.place('flare', -3.0, 0.7, -1.3); D.act('flare', 'ready'); D.expr('flare', 'determined');
  D.place('greg', -2.9, 2.4, -1.5); D.act('greg', 'ready'); D.expr('greg', 'scared');
  D.place('eric', -3.8, 3.4, -1.6); D.act('eric', 'ready'); D.expr('eric', 'worried');
  D.place('cowboy', -4.9, -0.8, -0.9); D.act('cowboy', 'idle'); D.expr('cowboy', 'serious');
  D.show('soulX'); D.place('soulX', -7.75, 2.6, P / 2); D.act('soulX', 'powerStance'); D.set('soulX.energy', 1); D.set('soulX.eyeGlow', 3.0);
  everyone((c) => { D.act(c, 'frozenStare'); });
  D.cam(FIX([1.2, 1.4, 1.4], [-6.6, 1.3, 2.2], { pos2: [0.6, 1.4, 1.5], fov: 52 }));
  D.sound('The team stands completely still', 2.4, 0.3); D.wait(2.8);
  D.sfx('heartbeat', 0, 0.7); D.sfx('heartbeat', 1.0, 0.7);
  D.cam(R('aaron', 20, 1.3, 0.08, { lookY: -0.05, fov: 38, dist2: 1.0 }));
  D.wait(2.2);
  D.set('fade', 1); D.sfx('cutBlack', 0, 0.5); D.music('none', 0, 0, 0.2); D.wait(1.6);

  // ===================================================================== END CARD
  D.scene('End');
  D.location('title');
  cast([]);
  D.set('fade', 1); D.anim('fade', 0, 0.8);
  D.music('theme', 0.6, 0, 0.1);
  D.set('title.theme', 0); D.set('title.k', 1); D.set('title.sub', 0); D.set('title.y', 1.4); D.set('title.jolt', 0); D.set('title.glitch', 0);
  D.cam(FIX([0, 0.6, 10.5], [0, 0.4, 0], { pos2: [0, 0.5, 10.0], fov: 42 }));
  const endDur = 12;
  D.card('credits', endDur, {
    lines: [
      { text: 'END OF EPISODE 9', big: true, y: 0.56, color: '#c79bff' },
      { text: 'TO BE CONTINUED...', bold: true, y: 0.66, color: '#ffd23f' },
      { text: 'Starring  Aaron  ·  Greg  ·  Flare  ·  Eric  ·  Leon  ·  Fred Yeehaw  ·  and the Soul Stealer', y: 0.76 },
      { text: 'Created by Nick', y: 0.83 },
    ],
  });
  wait0(endDur - 1.6);
  D.anim('fade', 1, 1.5); wait0(1.6);
  return D.end();
}
