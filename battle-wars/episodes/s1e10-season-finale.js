// BATTLE WARS - Season 1, Episode 10: "SEASON 1 FINALE"
import { createDirector, readTime } from '../src/director.js';
import { behemothRig, behParams } from '../src/behemothRig.js';

export const META = {
  id: 's1e10-season-finale', title: 'Battle Wars - S1E10 - Season 1 Finale', file: 'Battle_Wars_S1E10_Season_1_Finale', costume: 'blue2',
  behemoth: true, e6: true, e7: true, e8: true, e9: true, e10: true,
  extras: { aaron: ['armor'], flare: ['armor'], eric: ['armor'], leon: ['armor'], cowboy: ['mustache', 'dusty'] },
};

const P = Math.PI;
const TEAM = ['aaron', 'flare', 'eric', 'greg', 'leon'];
const SIX = [...TEAM, 'cowboy'];
const POWER3 = ['aaron', 'flare', 'leon'];
const CLAY4 = ['clay1', 'clay2', 'clay3', 'clay4'];
const ALL = ['aaron', 'flare', 'eric', 'barista', 'leon', 'greg', 'newark', 'cowboy', 'guard', 'guard2', 'officer', 'officer2', 'ped1', 'ped2', 'ped3', 'soulX', 'soulX2', 'soulX3',
  'clay1', 'clay2', 'clay3', 'clay4', 'clay5', 'clay6', 'clay7', 'clay8', 'water', 'soul', 'dog', 'birddog', 'tiger', 'beh', 'ufo', 'horse', 'cat', 'bird', 'pigeon1', 'pigeon2', 'pigeon3', 'pigeon4', 'titan', 'shadow'];
const CITY_OBJ = ['carC', 'carD', 'carE', 'bus', 'chunk0', 'chunk1', 'chunk2', 'chunk3'];

export function buildEpisode() {
  const D = createDirector();
  // a little more reading time per caption (viewers are 9-14 and read the captions)
  const say0 = D.say;
  D.say = (who, text, opts = {}) => say0(who, text, { ...opts, dur: (opts.dur ?? readTime(text)) * 1.34, gap: opts.gap ?? 0.5 });
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
    D.set('dome.on', 0); D.set('cloak.vis', 0); D.set('vision', 0); D.set('illusion', 0); D.set('cowboy.whiteEyes', 0); D.set('lasso.on', 0); D.set('lasso.twirl', 0); D.set('lasso.flicker', 0); D.set('lasso.target', 'none');
    D.set('hat.vis', 0); D.set('aaron.holo', 0); D.set('aaron.shield', 0); D.set('leon.field', 0); D.set('flashViolet', 0); D.set('flashWhite', 0);
    for (const o of CITY_OBJ) { D.set(`${o}.vis`, 0); D.set(`${o}.hold`, 0); }
    for (let i = 0; i < 4; i++) D.set(`rubble${i}.vis`, 0);
    for (const s of ['soulX', 'soulX2', 'soulX3']) D.set(`${s}.alpha`, 1);
  };
  const pos = (c, dt = 0) => [D.val(`${c}.x`, D.now + dt), D.val(`${c}.z`, D.now + dt)];
  const rigAt = (dt = 0) => behemothRig(behParams(D.val, D.now + dt));
  const roar = (dur = 2.2, text = 'RRRRRRAAAAAAAAHHHH!', opts = {}) => {
    D.anim('beh.jaw', 1, 0.3); D.anim('beh.nod', (opts.nod ?? -0.35), 0.4);
    D.sfx('monsterRoar', 0, opts.vol ?? 1); D.shake(opts.shake ?? 0.8, dur);
    D.say('behemoth', text, { dur, cam: opts.cam, label: opts.label });
    D.anim('beh.jaw', 0, 0.4); D.anim('beh.nod', opts.after ?? 0, 0.5);
  };
  const fly = (c, x, y, z, dur, dt = 0, ease = 'inout') => { D.anim(`${c}.x`, x, dur, dt, ease); D.anim(`${c}.y`, y, dur, dt, ease); D.anim(`${c}.z`, z, dur, dt, ease); };
  const everyone = (fn, list = TEAM) => { for (const c of list) fn(c); };
  // where a character's hand roughly is (for energy blasts that start at a hand)
  const handAt = (c, dt = 0, side = 1) => { const [x, z] = pos(c, dt), ry = D.val(`${c}.ry`, D.now + dt); return [x + Math.sin(ry) * 0.45 + Math.cos(ry) * 0.18 * side, D.val(`${c}.y`, D.now + dt) + 1.3, z + Math.cos(ry) * 0.45 - Math.sin(ry) * 0.18 * side]; };
  const chest = (c, dt = 0, h = 1.2) => { const [x, z] = pos(c, dt); return [x, D.val(`${c}.y`, D.now + dt) + h, z]; };
  const FIRE = { core: 0xfff0a0, glowC: 0xff7a20, trail: 0xff4010, lightC: 0xff8a30, spark: 0xffa040, debris: 6 };
  const fireball = (from, to, dt = 0, dur = 0.45, size = 1.1) => { D.fx('dark', { from, to, dur, size, arc: 0.15, ...FIRE }, dt); D.sfx('fireRoar', dt, 0.5); D.sfx('blastImpact', dt + dur, 0.6); };
  const purpleBolt = (from, to, dt = 0, dur = 0.4, size = 1.0) => { D.fx('dark', { from, to, dur, size, arc: 0.1, debris: 10 }, dt); D.sfx('darkBlast', dt, 0.6); D.sfx('blastImpact', dt + dur, 0.6); };
  const hit = (p, dt = 0, color = 0xffd080, n = 50) => { D.fx('sparks', { x: p[0], y: p[1], z: p[2], n, color, speed: 3.5 }, dt); D.fx('flashBurst', { x: p[0], y: p[1], z: p[2], dur: 0.5, radius: 1.4, color, light: 30 }, dt); };
  const FRED = { label: 'FRED' };
  const TIGER = { label: 'ERIC (TIGER)' };

  for (const c of ALL) { D.hide(c); D.act(c, 'idle'); D.expr(c, 'neutral'); D.set(`${c}.y`, 0); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); D.set(`${c}.roll`, 0); props(c); }
  cast([]);
  D.set('fade', 1); D.set('cowboy.reveal', 1); D.set('cowboy.hatTilt', 0.1); D.set('cowboy.scuff', 1); D.set('cowboy.hatOff', 0);
  D.set('beh.s', 10); D.set('beh.rear', 0.55); D.set('beh.plates', 1); D.set('beh.claws', 1.6); D.set('beh.eyes', 1); D.set('beh.sway', 0.3); D.set('beh.slither', 0.3);
  D.set('beh.jaw', 0); D.set('beh.nod', 0); D.set('beh.look', 0); D.set('beh.curl', 0); D.set('beh.tailLift', 0); D.set('beh.shake', 0); D.set('beh.dark', 0.35); D.set('beh.cracks', 0.35);
  D.set('beh.eyesRed', 0); D.set('beh.eyesPurple', 1); D.set('beh.aura', 0.4); D.set('beh.bolts', 0.15); D.set('beh.crest', 0); D.set('beh.blue', 0); D.set('beh.goo', 0); D.set('beh.dissolve', 0); D.set('beh.flickerBlue', 0); D.set('beh.y', 0);
  D.set('crown.mode', 'world'); D.set('crown.gone', 1);
  D.set('horse.glow', 1.8); D.set('horse.purple', 1); D.set('horse.act', 'idle');
  D.set('soul.eyes', 1); D.set('soul.violet', 1); D.set('sky.mode', 3); D.set('night.purple', 0.4); D.set('roof.glow', 0); D.set('citizens.on', 0);
  D.set('night', 1); D.set('evening', 0); D.set('tv.off', 1); D.set('tv.fall', -1); D.set('laptop.on', 0); D.set('table.held', 0);
  D.set('dome.on', 0); D.set('dome.hit', 0); D.set('titan.eyes', 2.2); D.set('titan.s', 1.4); D.set('titan.roar', 0); D.set('titan.jaw', 0); D.set('titan.nod', 0.2);
  for (const k of ['upL', 'upR', 'reachL', 'reachR', 'lean', 'kneel', 'crumble', 'rx', 'y']) D.set(`titan.${k}`, 0);
  D.set('shadow.s', 0.9); D.set('shadow.eyes', 1); D.set('shadow.lean', 0); D.set('shadow.swipeL', 0); D.set('shadow.swipeR', 0); D.set('shadow.dissolve', 0); D.set('shadow.y', 0);
  for (const s of ['soulX', 'soulX2', 'soulX3']) { D.set(`${s}.eyeGlow`, 3); D.set(`${s}.energy`, 1); }
  D.set('living.dark', 1); D.set('living.emergency', 1); D.set('living.flicker', 0); D.set('living.purple', 0); D.set('door.open', 1); D.set('door.shake', 0); D.set('door.glass', 1); D.set('door.purple', 1);
  D.set('tv.soul', 0); D.set('hallShadow.vis', 0); D.set('wallShadow.vis', 0); D.set('living.equip', 1); D.set('living.burger', 1); D.set('pizza', 1); D.set('pizza.single', 1);
  D.set('map.mode', 4); D.set('hq.purple', 0.6); D.set('hq.takeover', 0); D.set('hq.doors', 1); D.set('hq.clear', 1); D.set('hq.skyline', 1); D.set('hcar.vis', 0);
  D.set('core.level', 1); D.set('core.pct', 100); D.set('core.purple', 0); D.set('core.hot', 0); D.set('core.flicker', 0); D.set('power.purple', 0); D.set('power.dim', 0); D.set('power.alarm', 0); D.set('power.flicker', 0); D.set('console.sparks', 0);
  for (let i = 0; i < 5; i++) D.set(`power.dmg${i}`, 0);
  D.set('pdoor.open', 0); D.set('pdoor.glow', 0); D.set('pdoor.burst', 0); D.set('pdoor.shake', 0);
  D.set('lift.door', 0); D.set('lift.floor', 0); D.set('lift.moving', 0); D.set('lift.flicker', 0); D.set('lift.outPurple', 0);
  D.set('hud.core', 0); D.set('tiger.s', 1); D.set('tiger.y', 0); D.set('greg.redEyes', 0); D.set('title.glitch', 0);
  for (const c of CLAY4) { D.set(`${c}.rise`, 0); D.set(`${c}.mound`, 0); D.set(`${c}.crumble`, 0); D.set(`${c}.melt`, 0); }
  D.set('lasso.r', 0.5); D.set('lasso.flat', 0); D.set('hat.glow', 1);

  // ===================================================================== SCENE 1: THE FINAL SHOWDOWN
  D.scene('1. The Final Showdown');
  D.location('living');
  cast([...SIX, 'soulX']);
  D.place('leon', -2.4, -0.4, -1.4); D.act('leon', 'ready'); D.expr('leon', 'determined');
  D.place('aaron', -4.6, 2.0, -1.3); D.act('aaron', 'ready'); D.expr('aaron', 'determined');
  D.place('flare', -3.0, 0.7, -1.3); D.act('flare', 'ready'); D.expr('flare', 'determined');
  D.place('greg', -2.9, 2.4, -1.5); D.act('greg', 'ready'); D.expr('greg', 'scared');
  D.place('eric', -2.6, 3.9, -1.6); D.act('eric', 'ready'); D.expr('eric', 'worried');
  D.place('cowboy', -4.9, -0.8, -0.9); D.act('cowboy', 'idle'); D.expr('cowboy', 'serious');
  D.place('soulX', -7.75, 2.6, P / 2); D.act('soulX', 'powerStance'); D.expr('soulX', 'serious');
  D.music('villain', 0.36, 0, 0.6); D.sfx('heartbeatSlow', 0.6, 0.6);
  D.anim('fade', 0, 1.2);
  D.cam(FIX([1.2, 1.4, 1.4], [-6.6, 1.3, 2.2], { pos2: [0.4, 1.4, 1.6], fov: 52 }));
  D.card('location', 3.2, { text: 'BATTLE WARS HQ  -  THAT SAME NIGHT' });
  D.sound('The Soul Stealer stands in the doorway. Nobody moves', 3.0, 0.8); D.wait(3.8);
  D.expr('soulX', 'smug'); D.anim('soulX.eyeGlow', 4.2, 1.0); D.sfx('blackPulse', 0.2, 0.6);
  D.cam(R('soulX', 0, 1.1, 0.05, { lookY: 0.08, fov: 34, dist2: 0.9 }));
  D.sound('He gives the team an evil look', 2.0, 0.2); D.wait(2.4);
  // the team's faces
  D.cam(R('greg', 18, 1.5, 0.1, { fov: 40 })); D.sfx('gulp', 0.4, 0.6); D.sound('Greg gulps', 1.2, 0.1); D.wait(1.5);
  D.act('flare', 'flameHand'); D.fx('flame', { who: 'flare', side: 'R', dur: 2.4, size: 0.3 }); D.sfx('flameIgnite', 0.1, 0.5);
  D.cam(R('flare', 15, 1.5, 0.1, { fov: 40 })); D.sound('Flare’s hand lights up', 1.4, 0.1); D.wait(1.6);
  D.act('flare', 'ready');
  D.cam(R('aaron', 15, 1.6, 0.1, { fov: 40 })); D.sound('Aaron doesn’t even blink', 1.3, 0.1); D.wait(1.5);
  D.say('soulX', 'Did you really think a few tricks with the lights were the worst I could do?', { cam: R('soulX', 12, 1.4, 0.05, { lookY: -0.02, fov: 38 }), dur: 3.4 });
  D.path('soulX', [[-6.1, 2.6]], 0.7);
  everyone((c) => { D.anim(`${c}.x`, D.val(`${c}.x`, D.now) + 0.5, 1.2, 0.3); }, SIX);
  D.cam(FIX([-1.2, 1.5, 0.2], [-6.4, 1.6, 2.6], { fov: 48 }));
  D.sound('He steps inside. The team backs away', 2.2, 0.2); D.wait(2.6);
  D.say('soulX', 'This headquarters... belongs to me now.', { cam: R('soulX', -15, 1.6, 0.05, { lookY: -0.02, fov: 40 }), dur: 2.4 });
  D.say('leon', 'I built this place with my own hands. It belongs to US.', { cam: R('leon', 25, 2.0, 0.15), act: 'fistsClench', expr: 'angry', dur: 2.6 });
  D.act('leon', 'ready');
  D.say('soulX', 'You built it. I will keep it.', { cam: R('soulX', -15, 1.6, 0.05, { lookY: -0.02, fov: 40 }), expr: 'smug', dur: 1.8 });
  // Flare tries a fireball
  {
    D.act('flare', 'oneHandBlast'); fireball(handAt('flare', 0.1), chest('soulX', 0.5, 1.4), 0.1, 0.4);
    D.act('soulX', 'soulBlock', 0.2); D.fx('flashBurst', { x: -5.8, y: 1.4, z: 2.6, dur: 0.5, radius: 1.2, color: 0xffa040, light: 20 }, 0.5);
    D.fx('smoke', { x: -5.8, y: 1.4, z: 2.6, n: 24, dur: 1.8, color: 0x4a3a3a, color2: 0x2a2a2a }, 0.6); D.sfx('energyFizzle', 0.6, 0.7);
    D.cam(FIX([-1.0, 1.5, 4.6], [-4.6, 1.4, 1.6], { fov: 54 }));
    D.sound('Flare throws a fireball. He stops it with one hand, and it fizzles out like a candle', 3.2, 0.2); wait0(3.8);
    D.act('soulX', 'powerStance'); D.act('flare', 'ready'); D.expr('flare', 'shocked');
  }
  D.say('soulX', 'Cute.', { cam: R('soulX', 10, 1.3, 0.05, { lookY: -0.02, fov: 38 }), dur: 0.9 });
  // he takes control of the building
  {
    D.act('soulX', 'soulRaiseBoth'); D.anim('living.purple', 1, 2.4, 0.4); D.set('living.flicker', 1, 0.2); D.set('living.flicker', 0, 2.6);
    D.sfx('mindControl', 0.2, 0.8); D.sfx('corrupt', 0.6, 0.6); D.sfx('electricSlam', 1.0, 0.4); D.shake(0.4, 2.0, 0.4);
    D.fx('bodyAura', { who: 'soulX', dur: 4.0, color: 0xb050ff, power: 1.4 });
    D.set('tv.soul', 1, 1.6); D.sfx('tvOn', 1.6, 0.6);
    everyone((c) => { D.expr(c, 'shocked'); D.act(c, 'gasp'); }, ['greg', 'eric']);
    D.cam(FIX([3.0, 2.6, -3.6], [-2.4, 1.2, 1.2], { fov: 60 }));
    D.sound('Purple energy crawls across the walls. Every light, screen and machine turns purple', 3.6, 0.3); D.wait(4.0);
  }
  D.act('greg', 'ready');
  D.say('greg', 'He took over the TV too?! I was going to watch cartoons on that!', { cam: R('greg', 25, 2.0, 0.15), act: 'armsOut', expr: 'shocked', dur: 2.6 });
  D.act('greg', 'ready');
  // outside: headquarters turns purple, the monsters get ready
  D.location('hqExt');
  cast(['beh', 'horse', 'titan', 'shadow']);
  const PZ = 21;
  D.set('night', 1); D.set('evening', 0);
  D.place('beh', -12, PZ, P - 0.2); D.set('beh.rear', 0.55); D.set('beh.look', -0.15);
  D.place('horse', 14, PZ - 1, P - 0.25); D.set('horse.scale', 4.6); D.set('horse.act', 'idle'); D.set('horse.purple', 1); D.set('horse.glow', 1.8);
  D.place('titan', 0, PZ + 10, P); D.set('titan.s', 1.4); D.set('titan.eyes', 2.2);
  D.show('shadow'); D.set('shadow.x', 0); D.set('shadow.z', PZ + 0.5); D.set('shadow.eyes', 1);
  D.anim('hq.takeover', 1, 2.4, 0.3); D.sfx('powerDown', 0.2, 0.5); D.sfx('crystalHum', 0.6, 0.5);
  D.cam(FIX([24, 4.5, 14], [0, 6, -2], { pos2: [22, 4.8, 12], fov: 58 }));
  D.sound('Outside, every window of the headquarters turns purple', 2.8, 0.3); D.wait(3.4);
  {
    D.anim('titan.roar', 1, 0.5); D.anim('titan.roar', 0, 0.8, 2.4); D.anim('titan.upL', 0.6, 0.6); D.anim('titan.upL', 0, 0.8, 2.4); D.sfx('titanRoar', 0, 0.9);
    D.anim('beh.jaw', 1, 0.3, 0.3); D.anim('beh.rear', 0.8, 0.6, 0.3); D.anim('beh.jaw', 0, 0.5, 2.4); D.sfx('monsterRoar', 0.3, 0.8);
    D.anim('shadow.swipeL', 1, 0.6, 0.6); D.anim('shadow.swipeL', 0, 0.8, 1.6); D.anim('shadow.eyes', 2.5, 0.5, 0.6); D.sfx('shadowWhoosh', 0.6, 0.6);
    D.set('horse.act', 'neigh', 0.8); D.sfx('giantNeigh', 0.8, 0.7); D.set('horse.act', 'idle', 2.8);
    D.shake(0.9, 2.6);
    D.cam(FIX([0, 1.2, -2.4], [0, 8.0, PZ + 3], { fov: 68 }));
    D.say('behemoth', 'RRRRAAAAAAAHHHH!', { label: 'THE MONSTERS', dur: 2.4 });
    D.sound('The monsters prepare to attack', 1.8); D.wait(1.6);
  }
  // inside again
  D.location('living');
  cast([...SIX, 'soulX']);
  D.set('living.purple', 1); D.set('tv.soul', 1);
  D.place('leon', -1.9, -0.4, -1.4); D.act('leon', 'ready'); D.expr('leon', 'determined');
  D.place('aaron', -4.1, 2.0, -1.3); D.act('aaron', 'ready'); D.expr('aaron', 'determined');
  D.place('flare', -2.5, 0.7, -1.3); D.act('flare', 'ready'); D.expr('flare', 'determined');
  D.place('greg', -2.4, 2.4, -1.5); D.act('greg', 'ready'); D.expr('greg', 'shocked');
  D.place('eric', -2.1, 3.9, -1.6); D.act('eric', 'ready'); D.expr('eric', 'worried');
  D.place('cowboy', -4.4, -0.8, -0.9); D.act('cowboy', 'idle'); D.expr('cowboy', 'serious');
  D.place('soulX', -6.1, 2.6, P / 2); D.act('soulX', 'powerStance'); D.expr('soulX', 'smug');
  D.say('greg', 'He just took over our HOUSE?!', { cam: R('greg', 25, 2.0, 0.15), act: 'armsOut', expr: 'shocked', dur: 1.6 });
  D.act('greg', 'ready');
  D.say('soulX', "Thanks to Fred's horse, I can take any power I want. Every light. Every door. Every machine.", { cam: R('soulX', 10, 1.5, 0.05, { lookY: -0.02, fov: 40 }), dur: 4.2 });
  D.faceTo('cowboy', -6.1, 2.6, 0.4); D.expr('cowboy', 'angry');
  D.cam(R('cowboy', 25, 1.8, 0.05, { lookY: -0.05, fov: 40 })); D.sound('Fred clenches his fists', 1.6); D.wait(1.6);
  D.say('soulX', 'And deep below this building is the biggest power source in the entire city.', { cam: R('soulX', -10, 1.5, 0.05, { lookY: -0.02, fov: 40 }), dur: 3.4 });
  D.say('leon', 'The power core!', { cam: R('leon', 20, 2.0, 0.15), expr: 'shocked', dur: 1.2 });
  D.say('aaron', 'If he gets the core, he controls all the power in Aetherfall City. All of it.', { cam: R('aaron', 30, 2.0, 0.15), expr: 'worried', dur: 3.2 });
  D.say('eric', "Then we stop you. Right here. Six against one!", { cam: R('eric', 20, 2.0, 0.15), act: 'fistsClench', expr: 'angry', dur: 2.2 });
  D.act('eric', 'ready');
  D.say('soulX', 'Six against one? Look outside, little tiger. I am never alone.', { cam: R('soulX', 10, 1.4, 0.05, { lookY: -0.02, fov: 40 }), dur: 3.0 });
  D.say('soulX', 'Exactly. Enjoy your last night as heroes.', { cam: R('soulX', 10, 1.3, 0.05, { lookY: -0.02, fov: 38 }), act: 'powerStance', dur: 2.4 });
  // he sinks through the floor
  {
    D.fx('smoke', { x: -6.1, y: 0.2, z: 2.6, n: 50, dur: 2.6, color: 0x3a1a5a, color2: 0x6a2aa0 });
    D.fx('flashBurst', { x: -6.1, y: 1.0, z: 2.6, dur: 0.6, radius: 1.6, color: 0xa040ff, light: 30 });
    D.anim('soulX.y', -2.4, 1.6, 0.3, 'in'); D.anim('soulX.alpha', 0, 1.2, 0.6); D.hide('soulX', 2.0);
    D.sfx('smokeDissolve', 0, 0.7); D.sfx('teleport', 0.3, 0.6);
    everyone((c) => D.expr(c, 'shocked'), SIX);
    D.cam(FIX([-6.6, 1.6, 0.4], [-6.1, 0.9, 2.6], { fov: 52 }));
    D.sound('He sinks into the floor in a cloud of purple smoke', 2.6, 0.2); D.wait(3.0);
  }
  // outside: the horse vanishes, the monsters head for the city
  D.location('hqExt');
  cast(['beh', 'horse', 'titan', 'shadow']);
  D.place('beh', -12, PZ, P - 0.2); D.set('beh.rear', 0.55);
  D.place('horse', 14, PZ - 1, P - 0.25); D.set('horse.scale', 4.6); D.set('horse.purple', 1); D.set('horse.glow', 1.8);
  D.place('titan', 0, PZ + 10, P); D.set('titan.s', 1.4);
  D.show('shadow'); D.set('shadow.x', 0); D.set('shadow.z', PZ + 0.5); D.set('shadow.eyes', 1);
  D.set('hq.takeover', 1);
  {
    D.anim('horse.scale', 1.0, 1.6, 0.2, 'in'); D.anim('horse.alpha', 0, 1.0, 1.0); D.anim('horse.y', -0.6, 1.0, 1.0);
    D.fx('smoke', { x: 14, y: 0.5, z: PZ - 1, n: 60, dur: 3.0, color: 0x3a1a5a, color2: 0x6a2aa0 }, 0.6);
    D.fx('flashBurst', { x: 14, y: 2.0, z: PZ - 1, dur: 0.8, radius: 3.0, color: 0xa040ff, light: 40 }, 1.2);
    D.sfx('smokeDissolve', 0.5, 0.7); D.sfx('horseNeigh', 0.2, 0.6);
    D.cam(FIX([4, 2.5, 6], [14, 4, PZ - 1], { fov: 52 }));
    D.sound('Fred’s horse shrinks and vanishes in purple smoke', 2.6, 0.2); D.wait(3.2);
    D.hide('horse');
    D.face('titan', P / 2, 1.2); D.anim('titan.x', 30, 7.0, 0.8, 'in'); D.anim('titan.z', PZ + 14, 7.0, 0.8);
    for (const tt of [1.4, 2.8, 4.2]) { D.sfx('titanStep', tt, 0.8); D.shake(0.5, 0.5, tt); }
    D.face('beh', P / 2 + 0.3, 1.2); D.anim('beh.x', 10, 7.0, 0.6, 'in'); D.anim('beh.z', PZ + 6, 7.0, 0.6);
    D.anim('shadow.x', 18, 7.0, 0.4, 'in'); D.anim('shadow.z', PZ + 8, 7.0, 0.4);
    D.cam(FIX([-10, 3.0, 4], [10, 7, PZ + 6], { pos2: [-9, 3.2, 5], fov: 56 }));
    D.sound('The monsters turn toward the city and start marching', 3.0, 0.4); D.wait(3.6);
  }
  // inside: the plan
  D.location('living');
  cast([...SIX]);
  D.set('living.purple', 1); D.set('tv.soul', 1);
  D.place('leon', -1.9, -0.4, -1.8); D.act('leon', 'idle'); D.expr('leon', 'serious');
  D.place('aaron', -3.4, 1.0, -1.8); D.act('aaron', 'idle'); D.expr('aaron', 'serious');
  D.place('flare', -2.4, 0.4, -1.2); D.act('flare', 'idle'); D.expr('flare', 'worried');
  D.place('greg', -2.0, 2.2, -1.9); D.act('greg', 'idle'); D.expr('greg', 'worried');
  D.place('eric', -5.6, -0.6, -P / 2); D.act('eric', 'idle'); D.expr('eric', 'shocked');
  D.place('cowboy', -4.4, -0.8, -1.2); D.act('cowboy', 'idle'); D.expr('cowboy', 'serious');
  D.cam(FIX([-4.0, 1.6, 0.6], [-7.0, 1.5, -1.6], { fov: 46 }));
  D.sound('Eric runs to the window', 1.6, 0.2); D.wait(1.8);
  D.face('eric', 0.9, 0.4);
  D.say('eric', 'Guys! The monsters are heading for the city!', { cam: R('eric', 15, 2.0, 0.15), act: 'point', expr: 'shocked', dur: 2.2 });
  D.act('eric', 'idle');
  D.face('cowboy', -0.6, 0.4); D.look('cowboy', 0, 0.3, 0.6);
  D.say('cowboy', 'And he took my horse down there with him. I can feel it.', { ...FRED, cam: R('cowboy', 20, 1.8, 0.05, { lookY: -0.05, fov: 40 }), expr: 'sad', dur: 2.8 });
  D.look('cowboy', 0, 0, 0.4);
  D.act('aaron', 'thinkChin'); D.expr('aaron', 'thinking'); D.look('aaron', 0, -0.2, 0.6);
  D.cam(R('aaron', 20, 1.6, 0.1, { fov: 38 })); D.sound('Aaron thinks fast', 1.6); D.wait(1.8);
  D.act('aaron', 'idle'); D.look('aaron', 0, 0, 0.3); D.expr('aaron', 'determined');
  everyone((c) => D.faceChar(c, 'aaron', 0.4), ['leon', 'flare', 'greg', 'eric', 'cowboy']);
  D.say('aaron', "Okay. Listen. We can't fight him and the monsters at the same time.", { cam: R('aaron', 25, 2.1, 0.15), dur: 3.0 });
  D.say('aaron', 'So we split up. Two teams of three.', { act: 'gesture', dur: 1.8 });
  D.say('aaron', "Flare, Leon, you're with me. We protect the power core.", { act: 'point', dur: 2.6 });
  D.say('aaron', 'Greg, Eric, Fred... you protect the city.', { act: 'gesture', dur: 2.2 });
  D.act('aaron', 'idle');
  D.say('eric', 'Three of us... against ALL of those monsters?', { cam: R('eric', 20, 2.0, 0.15), act: 'armsOut', expr: 'shocked', dur: 2.2 });
  D.act('eric', 'idle');
  D.say('greg', 'I like those odds.', { cam: R('greg', 40, 1.9, 0.12), act: 'crossArms', expr: 'smug', dur: 1.3 });
  D.expr('greg', 'thinking'); D.cam(R('greg', 40, 1.8, 0.1, { fov: 38 })); D.sound('Greg thinks about it', 1.4); D.wait(1.5);
  D.say('greg', "...No, wait. I don't like those odds.", { act: 'armsOut', expr: 'worried', dur: 2.0 });
  D.act('greg', 'idle');
  D.say('cowboy', "How can I help? I don't have my powers anymore.", { ...FRED, cam: R('cowboy', 20, 1.8, 0.05, { lookY: -0.05, fov: 40 }), act: 'lookHand', expr: 'sad', dur: 2.4 });
  D.act('cowboy', 'idle');
  // Aaron's new invention
  {
    const tw = D.path('aaron', [[-1.4, -0.95]], 1.2);
    D.face('aaron', P / 2, 0.3, tw); D.act('aaron', 'reach', tw); D.set('aaron.propR', 'scanner', tw + 0.5); D.act('aaron', 'idle', tw + 0.9);
    D.cam(FIX([0.4, 1.6, -2.4], [-1.2, 0.9, -0.9], { fov: 48 }));
    D.sound('Aaron grabs something from his equipment case', 2.2, 0.2); wait0(Math.max(2.8, tw + 1.1));
    D.path('aaron', [[-3.7, -0.7]], 1.3);
    D.faceChar('cowboy', 'aaron', 0.4, 1.0);
    D.wait(1.6);
    D.faceChar('aaron', 'cowboy', 0.3);
  }
  D.say('aaron', "Remember when I said I'd make something new? I finished it last night.", { cam: R('aaron', 60, 1.9, 0.12), act: 'giveItem', expr: 'smug', dur: 3.0 });
  D.set('aaron.propR', 'none'); D.set('cowboy.propR', 'scanner'); D.act('aaron', 'idle'); D.act('cowboy', 'lookHand');
  D.say('aaron', 'It turns your energy into a rope of pure light.', { dur: 2.2 });
  {
    D.set('cowboy.propR', 'none'); D.act('cowboy', 'lassoTwirl'); D.set('lasso.twirl', 1); D.anim('lasso.on', 1, 0.5);
    D.sfx('lassoZap', 0, 0.7); D.sfx('lassoTwirl', 0.4, 0.6);
    D.fx('sparks', { x: -4.4, y: 1.5, z: -0.8, n: 40, color: 0x7fe0ff, speed: 2.0 });
    everyone((c) => D.expr(c, 'surprised'), ['leon', 'flare', 'greg', 'eric']);
    D.cam(R('cowboy', 35, 2.6, 0.4, { lookY: 0.3, fov: 46 }));
    D.sound('A glowing rope of light spins above Fred’s hand', 2.4, 0.2); D.wait(2.8);
  }
  D.say('cowboy', '...A lasso.', { ...FRED, cam: R('cowboy', 20, 1.6, 0.05, { lookY: -0.05, fov: 38 }), expr: 'surprised', dur: 1.2 });
  D.expr('cowboy', 'grin');
  D.say('cowboy', "Now we're talking.", { ...FRED, dur: 1.3 });
  D.anim('lasso.on', 0, 0.4); D.set('lasso.twirl', 0, 0.4); D.act('cowboy', 'idle', 0.4);
  D.path('aaron', [[-3.1, -0.3]], 1.0, 0.3); D.faceChar('aaron', 'cowboy', 0.3, 1.0);
  D.say('cowboy', 'Can I ask something? Why does everybody always listen to Aaron?', { ...FRED, cam: R('cowboy', 20, 1.8, 0.05, { lookY: -0.05, fov: 40 }), expr: 'thinking', dur: 2.8 });
  D.say('leon', "I'm the one who built this headquarters. But Aaron is the smartest one of us.", { cam: R('leon', 25, 2.0, 0.15), expr: 'happy', dur: 3.0 });
  D.say('flare', "We've known each other our whole lives. He always has a plan.", { cam: R('flare', -35, 1.8, 0.15), expr: 'happy', dur: 2.6 });
  D.say('eric', 'Even when the plan is weird.', { cam: R('eric', 20, 2.0, 0.15), expr: 'grin', dur: 1.4 });
  D.say('aaron', 'ESPECIALLY when the plan is weird.', { cam: R('aaron', 60, 1.9, 0.12), expr: 'smug', dur: 1.6 });
  D.say('greg', "And I've been looking out for these guys since they were little kids. I'm not stopping now.", { cam: R('greg', 25, 2.0, 0.15), expr: 'happy', dur: 3.4 });
  D.say('cowboy', '...Thank you. For trusting me.', { ...FRED, cam: R('cowboy', 20, 1.8, 0.05, { lookY: -0.05, fov: 40 }), expr: 'happy', dur: 1.8 });
  D.say('aaron', "You're one of us now, Fred.", { cam: R('aaron', 60, 1.9, 0.12), expr: 'happy', dur: 1.6 });
  D.say('leon', 'Then what are we waiting for?', { cam: R('leon', 25, 2.0, 0.15), act: 'fistsClench', expr: 'determined', dur: 1.6 });
  everyone((c) => D.expr(c, 'determined'), SIX);
  D.say('aaron', 'Battle Wars... MOVE!', { cam: R('aaron', 60, 1.9, 0.12, { fov: 42 }), act: 'point', dur: 1.3 });
  D.act('aaron', 'idle');
  D.say('greg', 'Wait! Can I grab a snack first?', { cam: R('greg', 25, 2.0, 0.15), act: 'raiseHand', expr: 'happy', dur: 1.6 });
  D.say('aaron', 'GREG!', { label: 'EVERYONE', cam: FIX([0.6, 1.7, -1.6], [-3.0, 1.4, 1.0], { fov: 58 }), dur: 0.8 });
  D.say('greg', 'Okay, okay! Saving the city on an empty stomach. Again.', { cam: R('greg', 25, 2.0, 0.15), expr: 'tired', dur: 2.4 });
  // the team splits up
  {
    D.music('action', 0.42, 0, 0.3);
    D.act('greg', 'fly'); D.face('greg', -P / 2, 0.3); fly('greg', -7.0, 1.2, 2.6, 1.0, 0.2, 'in'); fly('greg', -9.5, 1.4, 2.6, 0.5, 1.2, 'linear'); D.hide('greg', 1.7); D.sfx('whoosh', 0.3, 0.8);
    D.path('cowboy', [[-6.6, 2.6], [-9.6, 2.6]], 3.8, 0.4); D.hide('cowboy', 2.0);
    D.path('eric', [[-6.6, 2.4], [-9.6, 2.4]], 3.8, 0.7); D.hide('eric', 2.1);
    D.path('aaron', [[1.9, 0.0], [4.6, 2.9], [6.9, 3.6]], 3.6, 0.2); D.path('flare', [[1.9, 0.2], [4.6, 3.0], [6.9, 3.6]], 3.6, 0.5); D.path('leon', [[2.0, 0.0], [4.6, 2.9], [6.9, 3.6]], 3.6, 0.8);
    D.cam(FIX([1.6, 2.8, -3.8], [-1.0, 1.0, 1.4], { fov: 64 }));
    D.sound('The team splits up', 1.6, 0.2); D.wait(2.4);
  }
  D.set('fade', 1); D.sfx('cutBlack', 0, 0.4); wait0(0.4);

  // ===================================================================== SCENE 2: PROTECT THE POWER
  D.scene('2. Protect the Power');
  D.location('lift');
  cast([...POWER3]);
  D.place('aaron', 0, -0.6, 0); D.act('aaron', 'idle'); D.expr('aaron', 'serious');
  D.place('flare', -0.85, 0.15, 0); D.act('flare', 'idle'); D.expr('flare', 'neutral');
  D.place('leon', 0.85, 0.15, 0); D.act('leon', 'crossArms'); D.expr('leon', 'neutral');
  D.set('lift.door', 0); D.set('lift.floor', 0); D.set('lift.moving', 1); D.anim('lift.floor', 3, 40, 2.0, 'linear');
  D.music('none', 0, 0, 0.3); D.sfx('liftHum', 0.2, 0.5);
  D.anim('fade', 0, 0.5);
  D.cam(FIX([0, 1.62, 1.38], [0, 1.35, -1.0], { fov: 66 }));
  D.sound('Aaron, Flare and Leon ride the elevator down to the power core', 3.0, 0.3); D.wait(3.4);
  D.music('elevator', 0.34, 0, 0.6);
  D.sound('Soft, cheerful elevator music starts playing', 2.2); D.wait(2.6);
  D.look('flare', -0.3, -0.2, 0.6); D.expr('flare', 'annoyed');
  D.say('flare', 'Seriously? Elevator music? Right now?', { cam: R('flare', 10, 1.3, 0.1, { fov: 46 }), act: 'armsOut', dur: 2.0 });
  D.act('flare', 'idle'); D.look('flare', 0, 0, 0.3);
  D.say('leon', 'I picked it. It helps people stay calm.', { cam: R('leon', -10, 1.3, 0.1, { fov: 46 }), expr: 'smug', dur: 2.0 });
  D.say('leon', 'I built this whole place, remember? I picked everything.', { dur: 2.4 });
  D.say('flare', 'Remind me to never let you pick music again.', { cam: R('flare', 10, 1.3, 0.1, { fov: 46 }), expr: 'tired', dur: 2.2 });
  D.say('leon', 'Fun fact. The core runs on a giant crystal I found when I was building this place.', { cam: R('leon', -10, 1.3, 0.1, { fov: 46 }), expr: 'happy', dur: 3.4 });
  D.say('flare', 'You found a giant glowing crystal... and put it under our HOUSE?', { cam: R('flare', 10, 1.3, 0.1, { fov: 46 }), act: 'armsOut', expr: 'shocked', dur: 2.8 });
  D.act('flare', 'idle');
  D.say('leon', '...Yes.', { cam: R('leon', -10, 1.3, 0.1, { fov: 46 }), expr: 'smug', dur: 0.9 });
  D.say('aaron', 'To be fair, it does power the whole city.', { cam: R('aaron', 0, 1.3, 0.1, { fov: 46 }), dur: 2.0 });
  D.act('aaron', 'wristUp'); D.set('aaron.holo', 1, 0.3); D.sfx('holoOn', 0.3, 0.5); D.anim('core.pct', 97, 2.4, 0.5);
  D.cam(R('aaron', 20, 1.2, 0.1, { lookY: -0.1, fov: 46 })); D.sound('Aaron checks the power core on his wrist', 2.0, 0.2); D.wait(2.4);
  D.say('aaron', "The core is at ninety-eight percent... no. Ninety-seven.", { dur: 2.6 });
  D.expr('aaron', 'worried');
  D.say('aaron', "He's already pulling power out of it.", { dur: 1.8 });
  D.set('aaron.holo', 0); D.act('aaron', 'idle');
  D.expr('aaron', 'determined');
  D.say('aaron', 'Here is the plan. Flare, you keep him busy from far away. Leon, you take him up close.', { cam: R('aaron', 0, 1.3, 0.1, { fov: 46 }), act: 'gesture', dur: 3.6 });
  D.say('aaron', "I'll be at the control console. It can fire energy straight out of the core.", { act: 'point', dur: 3.0 });
  D.act('aaron', 'idle');
  D.say('flare', 'And if that does not work?', { cam: R('flare', 10, 1.3, 0.1, { fov: 46 }), expr: 'worried', dur: 1.5 });
  D.say('aaron', 'Then I come up with a new plan. I always do.', { cam: R('aaron', 0, 1.3, 0.1, { fov: 46 }), expr: 'smug', dur: 2.2 });
  D.set('lift.flicker', 1); D.sfx('bzzt', 0, 0.6); D.sfx('bzzt', 0.7, 0.5); D.set('lift.flicker', 0, 1.6);
  everyone((c) => { D.expr(c, 'surprised'); D.look(c, 0, -0.35, 0.4); }, POWER3);
  D.cam(FIX([0, 1.62, 1.38], [0, 1.6, -1.0], { fov: 66 }));
  D.sound('The elevator lights flicker', 1.6, 0.1); D.wait(2.0);
  everyone((c) => { D.look(c, 0, 0, 0.4); D.expr(c, 'serious'); }, POWER3);
  D.say('leon', "He's close.", { cam: R('leon', -10, 1.3, 0.1, { fov: 46 }), dur: 1.0 });
  D.set('lift.floor', 3); D.set('lift.moving', 0); D.sfx('elevatorDing', 0, 0.7); D.music('none', 0, 0, 0.3);
  D.anim('lift.door', 1, 1.0, 0.6); D.sfx('doorSlide', 0.6, 0.5);
  D.cam(FIX([0, 1.5, -1.4], [0, 1.4, 2.0], { fov: 62 }));
  D.sound('Ding. The doors open', 1.6, 0.2); D.wait(2.0);
  // the power room
  D.location('power');
  cast([...POWER3]);
  D.set('pdoor.open', 1); D.set('core.pct', 96); D.set('hud.core', 0);
  D.place('aaron', -0.3, 16.0, P); D.place('flare', -1.3, 16.6, P); D.place('leon', 0.9, 16.8, P);
  everyone((c) => { D.act(c, 'idle'); D.expr(c, 'determined'); }, POWER3);
  D.music('tense', 0.3, 0, 0.6); D.sfx('coreHum', 0.2, 0.5);
  D.path('aaron', [[0.2, 6.0], [4.7, -5.8]], 3.8); D.path('flare', [[-1.0, 6.4], [-2.6, 3.0]], 3.6, 0.3); D.path('leon', [[1.0, 6.6], [2.6, 3.2]], 3.6, 0.5);
  D.cam(FIX([-6.5, 5.6, -10.6], [1.5, 1.4, 8], { pos2: [-6.2, 5.4, -10.1], fov: 58 }));
  D.card('location', 3.4, { text: 'THE POWER CORE  -  DEEP BELOW HQ' });
  D.sound('Deep below headquarters, the power core glows bright blue', 3.2, 0.3); D.wait(4.0);
  D.set('hud.core', 1); D.anim('core.pct', 95, 1.0);
  D.cam(FIX([2.2, 1.4, 2.0], [0, 3.6, -6], { fov: 52 }));
  D.sound('The core keeps the whole city running', 2.2); D.wait(2.4);
  D.face('aaron', 2.55, 0.3); D.act('aaron', 'leanTable');
  D.say('aaron', 'Locking the blast door.', { cam: FIX([6.5, 1.65, -6.1], [4.7, 1.4, -5.8], { fov: 44 }), dur: 1.3 });
  D.anim('pdoor.open', 0, 1.4, 0.2); D.sfx('doorSlide', 0.2, 0.6); D.sfx('blastDoor', 1.5, 0.9); D.shake(0.3, 0.4, 1.5);
  D.cam(FIX([0.5, 1.8, 4.0], [0, 2.0, 11.8], { fov: 52 }));
  D.sound('The heavy blast door slams shut', 2.0, 0.6); D.wait(2.6);
  D.say('aaron', 'Core shield... on.', { cam: FIX([6.5, 1.65, -6.1], [4.7, 1.4, -5.8], { fov: 44 }), dur: 1.2 });
  D.set('dome.x', 0); D.set('dome.z', -6); D.set('dome.r', 3.9); D.anim('dome.on', 1, 1.0, 0, 'out'); D.sfx('barrierUp', 0, 0.8);
  D.cam(FIX([-6.5, 2.4, 2.5], [0, 2.5, -6], { fov: 50 }));
  D.sound('A blue energy shield forms around the core', 2.2, 0.2); D.wait(2.6);
  D.say('leon', 'That shield can hold for about five minutes against someone like him.', { cam: R('leon', 25, 2.0, 0.15), expr: 'serious', dur: 2.8 });
  D.say('aaron', 'Then we make those five minutes count.', { cam: FIX([6.5, 1.65, -6.1], [4.7, 1.4, -5.8], { fov: 44 }), expr: 'determined', dur: 1.8 });
  D.face('aaron', -0.6, 0.4); D.act('aaron', 'wristUp', 0.3); D.set('aaron.holo', 1, 0.5); D.sfx('policeRadio', 0.4, 0.6);
  D.cam(R('aaron', 25, 1.7, 0.1)); D.sound('Aaron’s wrist radio crackles', 1.4, 0.3); D.wait(1.8);
  D.say('greg', "Aaron! We made it downtown. It's... really bad up here.", { label: 'GREG (ON THE RADIO)', cam: R('aaron', 25, 1.4, 0.1, { lookY: -0.12, fov: 42 }), dur: 2.8 });
  D.say('aaron', 'Do your best, Greg. Keep the people safe. We will protect the core.', { cam: R('aaron', 25, 1.7, 0.1), dur: 3.0 });
  D.say('greg', "Got it. Oh! And if there's any pizza down there, save me some.", { label: 'GREG (ON THE RADIO)', cam: R('aaron', 25, 1.4, 0.1, { lookY: -0.12, fov: 42 }), dur: 2.8 });
  D.expr('aaron', 'annoyed');
  D.say('aaron', "There's no pizza down here, Greg.", { cam: R('aaron', 25, 1.7, 0.1), dur: 1.6 });
  D.say('greg', 'Worth a shot. Over and out!', { label: 'GREG (ON THE RADIO)', cam: R('aaron', 25, 1.4, 0.1, { lookY: -0.12, fov: 42 }), dur: 1.6 });
  D.set('aaron.holo', 0); D.act('aaron', 'idle'); D.expr('aaron', 'determined');
  D.faceTo('flare', 4.7, -5.8, 0.4); D.faceTo('leon', 4.7, -5.8, 0.4);
  D.say('flare', 'So now what? We just wait for him?', { cam: R('flare', -25, 2.0, 0.15), expr: 'worried', dur: 1.9 });
  D.face('aaron', -0.6, 0.4); D.act('aaron', 'idle');
  D.say('aaron', "He'll come through that door. When he does, we hold him back as long as we can.", { cam: R('aaron', 20, 2.0, 0.15), dur: 3.4 });
  D.say('leon', 'And if he gets past us?', { cam: R('leon', 25, 2.0, 0.15), expr: 'serious', dur: 1.4 });
  D.cam(R('aaron', 15, 1.6, 0.1, { fov: 38 })); D.sound('Aaron pauses', 1.2); D.wait(1.4);
  D.say('aaron', "...He won't.", { dur: 1.2 });
  D.face('flare', 0, 0.5); D.face('leon', 0, 0.5); D.anim('core.pct', 93, 3.0);
  D.cam(FIX([0, 1.0, -1.0], [0, 1.6, 11.5], { fov: 54 }));
  D.sound('Silence. Only the hum of the core', 2.4, 0.3); D.wait(3.0);
  D.say('flare', 'I really hate waiting.', { cam: R('flare', -25, 2.0, 0.15), expr: 'tired', dur: 1.3 });
  D.say('leon', 'Same.', { cam: R('leon', 25, 2.0, 0.15), dur: 0.8 });
  D.say('flare', 'Do you think Greg and Eric and Fred are okay up there?', { cam: R('flare', -25, 2.0, 0.15), expr: 'worried', dur: 2.4 });
  D.say('aaron', "Greg has been looking out for us since we were little kids. He won't let anything happen to them.", { cam: R('aaron', 20, 2.0, 0.15), expr: 'happy', dur: 3.6 });
  D.say('leon', 'And Eric is braver than he thinks.', { cam: R('leon', 25, 2.0, 0.15), expr: 'happy', dur: 1.8 });
  D.faceChar('flare', 'leon', 0.4); D.faceChar('leon', 'flare', 0.4);
  D.say('leon', 'Hey. Whatever happens down here... we stick together.', { cam: R('leon', 20, 1.9, 0.15), dur: 2.4 });
  D.say('flare', 'Always.', { cam: R('flare', -20, 1.9, 0.15), expr: 'happy', dur: 1.0 });
  D.face('flare', 0, 0.5); D.face('leon', 0, 0.5); D.expr('flare', 'serious'); D.expr('leon', 'serious');
  {
    D.anim('core.flicker', 0.7, 0.3); D.anim('core.flicker', 0, 0.5, 0.8); D.anim('core.pct', 91, 1.0); D.sfx('bzzt', 0, 0.5); D.sfx('powerCut', 0.2, 0.4);
    D.cam(FIX([-2.4, 1.4, 1.6], [0, 3.0, -6], { fov: 52 }));
    D.sound('The core flickers. Somewhere above them, the Soul Stealer is getting closer', 3.0, 0.2); D.wait(3.4);
  }
  // he's here
  {
    D.act('aaron', 'leanTable'); D.face('aaron', 2.55, 0.3);
    D.act('leon', 'fistsClench'); D.act('flare', 'stretch');
    D.cam(FIX([0, 1.3, -1.4], [0, 1.4, 4.0], { fov: 56 }));
    D.sound('Leon cracks his knuckles. Flare stretches. Aaron takes his place at the console', 3.2, 0.2); D.wait(3.6);
    D.act('leon', 'idle'); D.act('flare', 'idle');
    for (const tt of [0.2, 1.0, 1.8]) D.sfx('thud', tt, 0.35);
    D.anim('pdoor.glow', 1, 2.2, 0.6); D.sfx('crystalHum', 0.6, 0.6); D.anim('core.flicker', 1, 0.4, 1.0);
    everyone((c) => { D.expr(c, 'shocked'); }, POWER3);
    D.cam(FIX([0.4, 1.2, 6.5], [0, 2.4, 11.8], { pos2: [0.3, 1.2, 7.4], fov: 50, ease: 'linear' }));
    D.sound('Slow footsteps echo behind the door. The door starts to glow purple', 3.2, 0.2); D.wait(3.4);
  }
  D.say('soulX', 'Knock, knock.', { label: 'SOUL STEALER (BEHIND THE DOOR)', cam: FIX([0, 1.6, 9.0], [0, 2.2, 11.8], { fov: 44 }), dur: 1.5 });
  D.say('flare', "...Who's there?", { cam: R('flare', -25, 2.0, 0.15), expr: 'surprised', dur: 1.2 });
  D.say('leon', "Flare! Don't answer him!", { cam: R('leon', 25, 2.0, 0.15), act: 'armsOut', expr: 'shocked', dur: 1.4 });
  D.say('flare', 'Sorry! Habit!', { cam: R('flare', -25, 2.0, 0.15), expr: 'annoyed', dur: 1.0 });
  D.act('leon', 'idle');
  {
    D.act('flare', 'flameHand'); D.fx('flame', { who: 'flare', side: 'R', dur: 4.0, size: 0.4 }); D.fx('flame', { who: 'flare', side: 'L', dur: 4.0, size: 0.4 }); D.sfx('flameIgnite', 0, 0.7);
    D.act('leon', 'powerFist'); D.sfx('powerUp', 0.3, 0.5);
    D.expr('flare', 'determined'); D.expr('leon', 'angry');
    D.cam(FIX([0, 1.3, 8.4], [0, 1.3, 3.0], { fov: 56 }));
    D.sound('Flare’s hands burst into flames. Leon raises his fists', 2.6, 0.2); D.wait(2.8);
  }
  D.set('fade', 1); D.sfx('cutBlack', 0, 0.4); wait0(0.5);

  // ===================================================================== SCENE 3: THE CITY ATTACK
  D.scene('3. The City Attack');
  D.location('downtown');
  cast(['beh', 'titan', 'shadow', 'ped3']);
  D.set('sky.mode', 3); D.set('night.purple', 0.45); D.set('lightning', 0); D.set('ufo.vis', 0); D.set('ufo.shade', 0); D.set('facade.break', 0);
  D.set('carA.vis', 1); D.set('carA.x', 15); D.set('carA.z', -2.2); D.set('carA.ry', 0); D.set('carA.roll', 0); D.set('carA.lift', 0);
  D.set('carB.vis', 1); D.set('carB.x', -24); D.set('carB.z', 2.3); D.set('carB.ry', P); D.set('carB.roll', 0); D.set('carB.lift', 0);
  D.set('lampA.vis', 1); D.set('lampA.x', 12); D.set('lampA.z', -4.6); D.set('lampA.fall', 0); D.set('lampB.vis', 1); D.set('lampB.x', 20); D.set('lampB.z', 4.6); D.set('lampB.fall', 0);
  D.set('cracks', 0); D.set('mark', 0); D.set('can.vis', 0); D.set('cons.vis', 0); D.set('shards', 0); D.set('barrier.vis', 0);
  D.set('citizens.on', 1); D.set('citizens.t0', D.now - 0.5);
  D.place('titan', 62, 0.5, -P / 2); D.set('titan.s', 1.25); D.set('titan.eyes', 2.2);
  D.place('beh', 0, -46, 0); D.set('beh.s', 10); D.set('beh.rear', 0.55); D.set('beh.look', 0);
  D.show('shadow'); D.set('shadow.x', 10); D.set('shadow.z', 26); D.set('shadow.y', -9); D.set('shadow.s', 0.9); D.set('shadow.eyes', 0);
  D.set('carD.vis', 1); D.set('carD.x', 23); D.set('carD.z', 3.0); D.set('carD.ry', P); D.set('carD.rz', 0); D.set('carD.rx', 0); D.set('carD.y', 0);
  D.set('carC.vis', 1); D.set('carC.x', 26); D.set('carC.z', -2.6); D.set('carC.ry', 0); D.set('carC.rz', 0); D.set('carC.rx', 0); D.set('carC.y', 0);
  D.place('ped3', -9.2, -5.3, 0.4); D.act('ped3', 'frozenStare'); D.expr('ped3', 'scared');
  D.music('darkTheme', 0.4, 0, 0.6); D.sfx('siren', 0.4, 0.3); D.sfx('alarmBeep', 1.0, 0.3);
  D.anim('fade', 0, 0.6);
  // the monsters arrive downtown
  D.anim('titan.x', 30, 7.5, 0, 'linear'); for (const tt of [0.8, 2.2, 3.6, 5.0, 6.4]) { D.sfx('titanStep', tt, 0.8); D.shake(0.35, 0.5, tt); }
  D.anim('beh.z', -20, 7.5, 0, 'linear'); D.sfx('stampede', 0.4, 0.4);
  D.anim('shadow.y', 0, 4.0, 2.5, 'out'); D.anim('shadow.eyes', 1.5, 1.2, 5.5); D.sfx('shadowWhoosh', 3.0, 0.6);
  D.cam(FIX([-16, 3.2, 12], [16, 8, -4], { pos2: [-14, 3.4, 11], fov: 62 }));
  D.card('location', 3.2, { text: 'DOWNTOWN AETHERFALL CITY' });
  D.sound('Downtown, the monsters tear into the city. People run for their lives', 3.6, 0.3); D.wait(4.2);
  D.cam(FIX([22, 0.6, 9], [30, 9, 0], { fov: 58 }));
  D.sound('The titan stomps down the main street', 1.8); D.wait(1.6);
  D.cam(FIX([6, 1.0, -6], [0, 5, -24], { fov: 58 }));
  D.sound('Behemoth slithers in from the north', 1.8); D.wait(1.6);
  D.cam(FIX([-2, 1.2, 12], [10, 5, 26], { fov: 56 }));
  D.sound('And in the plaza, a shadow rises out of the ground', 2.4); D.wait(2.4);
  {
    D.anim('lampA.fall', 1, 0.9, 0.6, 'in'); D.sfx('lampCreak', 0.2, 0.7); D.sfx('metalCrash', 1.5, 0.7); D.sfx('citizensPanic', 0, 0.5);
    D.fx('sparks', { x: 9.0, y: 0.4, z: -4.6, n: 50, color: 0xffd080, speed: 3 }, 1.5); D.shake(0.4, 0.4, 1.5);
    D.cam(FIX([6.5, 1.0, 1.5], [11, 2.2, -4.6], { fov: 58 }));
    D.sound('A street lamp crashes down as people run for cover', 2.4, 0.3); D.wait(2.4);
  }
  // the titan throws a car
  {
    D.face('titan', -P / 2 - 0.25, 0.6); D.anim('titan.reachR', 0.85, 0.9, 0.3); D.anim('titan.lean', 0.5, 0.9, 0.3);
    D.set('carC.hold', 1, 1.2); D.sfx('metalCrash', 1.2, 0.5);
    D.anim('titan.reachR', 0, 0.8, 1.6); D.anim('titan.lean', 0, 0.8, 1.6); D.anim('titan.upR', 1, 0.8, 1.6);
    D.cam(FIX([16, 1.4, 12], [28, 7, -1], { fov: 60 }));
    D.sound('The titan picks up a car...', 2.0, 0.3); wait0(2.7);
    D.anim('titan.upR', 0.1, 0.35, 0, 'in'); D.anim('titan.reachR', 0.6, 0.35, 0, 'in'); D.sfx('whoosh', 0, 0.8);
    D.set('carC.hold', 0, 0.3); D.set('carC.x', 26, 0.3); D.set('carC.y', 14, 0.3); D.set('carC.z', -1, 0.3);
    D.anim('carC.x', -2, 1.3, 0.3, 'linear'); D.anim('carC.y', 0, 1.3, 0.3, 'in'); D.anim('carC.z', -9.5, 1.3, 0.3); D.anim('carC.rz', 4.2, 1.3, 0.3); D.anim('carC.rx', 1.2, 1.3, 0.3);
    D.cam(FIX([-12, 2.0, 8], [4, 4, -6], { fov: 60 }), 0.35);
    D.sound('...and throws it!', 1.2, 0.3); wait0(1.6);
    D.set('carC.rz', P, 0); D.set('carC.rx', 0, 0); D.set('carC.y', 0, 0);
    D.fx('dustCloud', { x: -2, y: 0, z: -9, n: 50, dur: 3, radius: 3, size: 0.8 }); D.fx('debris', { x: -2, y: 0.5, z: -9, n: 40 }); D.fx('sparks', { x: -2, y: 0.6, z: -9, n: 40, color: 0xffd080, speed: 3 });
    D.sfx('metalCrash', 0, 1.0); D.sfx('glassShatter', 0.05, 0.6); D.shake(0.8, 0.6);
    D.comic('CRASH!', 0, 1.0, { x: 0.5, y: 0.34, size: 120, rot: -6, c1: '#ffffff', c2: '#ff8a45' });
    D.anim('titan.reachR', 0, 0.8, 0.2); wait0(1.6);
  }
  // the heroes arrive
  D.show('greg'); D.place('greg', -42, 0.6, P / 2); D.set('greg.y', 5); D.act('greg', 'fly'); D.expr('greg', 'determined');
  D.show('tiger'); D.place('tiger', -46, 1.4, P / 2); D.set('tiger.s', 1.7); D.set('tiger.act', 'idle');
  D.show('cowboy'); D.place('cowboy', -46, 1.4, P / 2); D.set('cowboy.y', 1.15); D.act('cowboy', 'ride'); D.expr('cowboy', 'determined');
  {
    fly('greg', -16, 3.2, 0.2, 3.6, 0, 'out');
    D.anim('tiger.x', -18, 3.6, 0, 'out'); D.anim('cowboy.x', -18, 3.6, 0, 'out'); D.sfx('tigerRoar', 0.4, 0.6); D.sfx('whoosh', 0.2, 0.7);
    D.cam(FIX([-24, 1.3, 7], [-34, 2.4, 1], { look2: [-18, 2.4, 0.8], fov: 56 }));
    D.sound('Greg flies in. Eric, as a huge tiger, charges down the street with Fred riding on his back', 3.6, 0.2); D.wait(3.8);
  }
  D.act('greg', 'hover'); D.anim('greg.y', 2.6, 0.6);
  D.say('greg', "Whoa. They're even bigger in the city.", { cam: R('greg', 20, 2.4, 0.1, { lookY: -0.2 }), expr: 'shocked', dur: 2.0 });
  D.say('eric', 'Why is it always GIANT monsters? Why never tiny ones?', { ...TIGER, cam: F(['tiger'], 120, 3.2, 0.2, { lookY: -0.3, fov: 46 }), dur: 2.4 });
  D.say('greg', 'Tiny monsters would be cute.', { cam: R('greg', 20, 2.4, 0.1, { lookY: -0.2 }), expr: 'happy', dur: 1.4 });
  D.say('cowboy', 'Eric... you can let me down now.', { ...FRED, cam: F(['cowboy'], 200, 2.6, 0.0, { lookY: -0.15, fov: 44 }), expr: 'tired', dur: 1.9 });
  D.set('tiger.act', 'crouch'); D.act('cowboy', 'mount'); D.anim('cowboy.y', 0, 0.6, 0.2); D.anim('cowboy.z', 2.6, 0.6, 0.2); D.act('cowboy', 'idle', 0.8); D.set('tiger.act', 'idle', 1.0);
  D.sfx('thud', 0.7, 0.4);
  D.cam(FIX([-14, 1.0, 5.5], [-18, 1.0, 1.6], { fov: 48 }));
  D.sound('Fred hops off', 1.2, 0.2); D.wait(1.6);
  D.face('cowboy', P / 2, 0.3);
  D.say('greg', "Here's the plan. I take the big guy.", { cam: R('greg', 25, 2.4, 0.1, { lookY: -0.2 }), act: 'point', expr: 'determined', dur: 2.0 });
  D.act('greg', 'hover');
  D.set('tiger.act', 'roar'); D.sfx('tigerRoar', 0, 0.8);
  D.say('eric', "I've got the shadow guy!", { ...TIGER, cam: F(['tiger'], 120, 3.2, 0.2, { lookY: -0.3, fov: 46 }), dur: 1.6 });
  D.set('tiger.act', 'idle'); D.path('tiger', [[-10, 7], [-2, 13]], 7.0, 1.2);
  D.say('cowboy', "And I'll get these people to safety.", { ...FRED, cam: R('cowboy', 25, 1.9, 0.05, { lookY: -0.05, fov: 40 }), dur: 1.9 });
  // Greg grabs Behemoth
  {
    D.act('greg', 'fly'); D.face('greg', P, 0.3); fly('greg', 2.2, 3.6, -18.0, 2.2, 0.2, 'inout'); D.sfx('whoosh', 0.2, 0.8);
    D.face('greg', -P / 2 - 0.6, 0.4, 2.0); D.act('greg', 'hoverPull', 2.2);
    D.cam(FIX([-12, 2.4, 4], [0, 5, -18], { fov: 58 }));
    D.sound('Greg flies straight at Behemoth', 1.8, 0.3); wait0(2.6);
    D.set('greg.wrapU', 0.6); D.anim('greg.stretch', 1, 0.6); D.anim('greg.wrap', 1, 1.0, 0.2); D.sfx('stretchBoing', 0, 0.9);
    D.anim('beh.shake', 0.6, 0.4, 0.8); D.anim('beh.curl', 0.3, 0.8, 0.8); D.sfx('monsterRoar', 0.9, 0.7); D.shake(0.5, 1.0, 0.9);
    D.cam(FIX([9, 3.4, -9], [0.5, 2.6, -18.5], { fov: 54 }));
    D.sound('His arms stretch around its neck like two giant ropes', 2.6, 0.3); wait0(3.0);
  }
  D.say('greg', 'Hey, big guy! Remember me?', { cam: FIX([4.8, 4.4, -14.8], [1.8, 3.8, -18.0], { fov: 50 }), expr: 'smug', dur: 1.6 });
  {
    D.anim('beh.shake', 1, 0.3); D.anim('beh.look', 0.8, 0.5); D.anim('beh.look', -0.8, 0.6, 0.5); D.anim('beh.look', 0.5, 0.6, 1.1); D.anim('beh.look', 0, 0.6, 2.0);
    D.act('greg', 'flail', 0.2); D.act('greg', 'hoverPull', 2.0); D.sfx('monsterRoar', 0.1, 0.8); D.shake(0.6, 2.0);
    D.cam(FIX([7, 2.4, -10], [1, 3.4, -18], { fov: 58 }));
    D.sound('Behemoth thrashes back and forth. Greg holds on tight', 2.6, 0.2); wait0(2.8);
  }
  D.say('greg', 'Whoa! Whoa! WHOA! Okay! I am NOT letting go!', { cam: FIX([4.8, 4.4, -14.8], [1.8, 3.8, -18.0], { fov: 46 }), expr: 'shocked', dur: 2.2 });
  D.anim('beh.shake', 0, 0.4); D.anim('beh.curl', 0, 0.6);
  // Fred moves the people out
  D.show('ped1'); D.show('ped2');
  D.place('ped1', -12.5, -2.0, P / 2); D.act('ped1', 'runScared'); D.expr('ped1', 'scared');
  D.place('ped2', -13.5, -3.2, P / 2); D.act('ped2', 'runScared'); D.expr('ped2', 'scared');
  D.face('cowboy', -P / 2 + 0.3, 0.3); D.act('cowboy', 'point');
  D.path('ped1', [[-15.5, 0.6], [-30, 1.2]], 4.5, 0.6); D.path('ped2', [[-16.0, -0.2], [-30, 0.2]], 4.5, 0.9); D.hide('ped1', 4.6); D.hide('ped2', 4.9);
  D.say('cowboy', 'Everybody! This way! Away from the monsters! Go, go, go!', { ...FRED, cam: FIX([-21, 1.6, 4.5], [-15, 1.2, 0.2], { fov: 52 }), dur: 2.6 });
  D.act('cowboy', 'idle');
  // Greg lets go of Behemoth (he is needed for the bus)
  D.set('greg.wrap', 0); D.set('greg.stretch', 0); D.place('greg', -16, 0.2, P / 2); D.set('greg.y', 3.2); D.act('greg', 'hover');
  D.anim('beh.shake', 0, 0.1); D.anim('beh.curl', 0, 0.1);
  // the titan swats a car
  {
    D.place('titan', 21.5, -0.5, -P / 2 - 0.15); D.set('titan.reachR', 0); D.set('titan.upR', 0); D.set('titan.lean', 0);
    D.set('carA.vis', 1); D.set('carA.x', 15); D.set('carA.z', -2.2); D.set('carA.roll', 0); D.set('carA.lift', 0);
    D.anim('titan.reachR', 0.9, 0.7, 0.2); D.anim('titan.lean', 0.55, 0.7, 0.2); D.anim('titan.reachR', 0, 0.8, 1.0); D.anim('titan.lean', 0, 0.8, 1.0);
    D.anim('carA.x', 4, 1.0, 0.85, 'out'); D.anim('carA.roll', 2 * P, 1.0, 0.85, 'out'); D.anim('carA.lift', 2.0, 0.5, 0.85, 'out'); D.anim('carA.lift', 0, 0.5, 1.35, 'in');
    D.sfx('metalCrash', 0.85, 0.9); D.sfx('metalCrash', 1.85, 0.8); D.shake(0.6, 0.5, 1.85); D.fx('sparks', { x: 4, y: 0.4, z: -2.2, n: 50, color: 0xffd080, speed: 3 }, 1.85);
    D.cam(FIX([8, 1.6, 9], [16, 4, -2], { fov: 60 }));
    D.sound('The titan swats a parked car out of its way', 2.4, 0.3); wait0(3.0);
  }
  // the bus
  D.set('bus.vis', 1); D.set('bus.x', -70); D.set('bus.z', 2.0); D.set('bus.y', 0); D.set('bus.ry', 0); D.set('bus.rz', 0); D.set('bus.rx', 0);
  {
    D.anim('bus.x', -26, 3.0, 0, 'linear');
    D.cam(FIX([-30, 1.6, -3.0], [-50, 1.6, 2.0], { look2: [-30, 1.8, 2], fov: 56 }));
    D.sound('A city bus full of people drives straight toward the fight', 2.6, 0.2); wait0(3.0);
    // a chunk of building falls in front of it
    D.set('chunk1.vis', 1); D.set('chunk1.x', -16); D.set('chunk1.y', 26); D.set('chunk1.z', -7); D.set('chunk1.rx', 0); D.set('chunk1.ry', 0.3); D.set('chunk1.rz', 0);
    D.anim('chunk1.y', 0, 1.1, 0, 'in'); D.anim('chunk1.z', 1.0, 1.1, 0); D.anim('chunk1.rz', 0.8, 1.1, 0); D.sfx('buildingFall', 0, 0.8);
    D.anim('bus.x', -21.5, 0.9, 0, 'out'); D.anim('bus.ry', 0.5, 0.9, 0); D.anim('bus.rz', -0.45, 0.6, 0.4, 'out'); D.sfx('busScreech', 0, 0.9);
    D.cam(FIX([-8, 3.0, 12], [-19, 3.0, 0], { fov: 60 }));
    D.sound('A huge chunk of building crashes down in front of the bus. The bus skids and starts to tip over!', 3.4, 0.1); wait0(1.1);
    D.fx('dustCloud', { x: -16, y: 0, z: 1, n: 70, dur: 3.5, radius: 4, size: 1.0 }); D.fx('debris', { x: -16, y: 0.5, z: 1, n: 60, spread: 1.6 }); D.shake(1.0, 0.8); D.set('cracks', 1); D.set('cracks.x', -16); D.set('cracks.z', 1); D.set('cracks.size', 6);
    D.comic('KRA-KOOM!', 0, 1.1, { x: 0.5, y: 0.34, size: 120, rot: 5, c1: '#ffffff', c2: '#ffb045' });
    wait0(3.0);
  }
  {
    // Greg catches the bus
    D.place('greg', -19, -2.6, 0); D.set('greg.y', 2.8); D.act('greg', 'stretchArms'); D.expr('greg', 'determined');
    D.set('greg.tLx', -22.5); D.set('greg.tLy', 2.4); D.set('greg.tLz', 1.0); D.set('greg.tRx', -20.0); D.set('greg.tRy', 2.6); D.set('greg.tRz', 1.2); D.set('greg.sag', -0.2); D.set('greg.bendL', 0.2); D.set('greg.bendR', -0.2);
    D.anim('greg.stretch', 1, 0.5); D.sfx('stretchBoing', 0, 0.9);
    D.anim('bus.rz', 0, 1.2, 0.6, 'inout'); D.sfx('thud', 1.8, 0.7);
    D.anim('greg.stretch', 0, 0.5, 2.6);
    D.cam(FIX([-24, 1.6, 9], [-20.5, 2.2, 0.5], { fov: 56 }));
    D.sound('Greg’s arms stretch out and catch the bus, then set it gently back on its wheels', 3.2, 0.2); D.wait(3.4);
  }
  D.say('bus', 'THANK YOU!!', { label: 'BUS DRIVER', cam: FIX([-17.4, 1.9, 3.6], [-18.0, 2.0, 1.6], { fov: 50 }), dur: 1.2 });
  D.sfx('crowdCheer', 0, 0.4);
  D.say('greg', 'No problem! Drive safe!', { cam: R('greg', 20, 2.2, 0.1, { lookY: -0.2 }), act: 'thumbsUp', expr: 'happy', dur: 1.4 });
  D.act('greg', 'hover');
  // the kid
  {
    D.place('cowboy', -15.5, 0.8, 0); D.act('cowboy', 'idle');
    D.set('chunk0.vis', 1); D.set('chunk0.x', -9.4); D.set('chunk0.y', 30); D.set('chunk0.z', -9.5); D.set('chunk0.rx', 0.2); D.set('chunk0.ry', 0.6); D.set('chunk0.rz', 0);
    D.cam(FIX([-6.5, 1.0, -1.5], [-9.4, 1.5, -5.4], { fov: 50 }));
    D.sound('A kid is frozen on the sidewalk. Something is falling above him', 2.6, 0.2); D.wait(2.6);
    D.say('ped3', 'HELP!', { label: 'KID', cam: R('ped3', 0, 1.6, 0.0, { lookY: -0.05, fov: 44 }), dur: 0.9, gap: 0.1 });
    D.faceTo('cowboy', -9.2, -5.3, 0.25); D.act('cowboy', 'lassoThrow'); D.set('lasso.target', 'ped3'); D.anim('lasso.on', 1, 0.35); D.sfx('lassoWhip', 0, 0.8); D.sfx('lassoZap', 0.2, 0.5);
    D.anim('chunk0.y', 7, 1.4, 0, 'in');
    D.cam(FIX([-17.5, 1.6, 3.4], [-11, 1.4, -3.4], { fov: 54 }));
    D.sound('Fred throws his lasso of light. It loops around the kid', 2.0); wait0(1.4);
    D.act('cowboy', 'lassoPull'); D.act('ped3', 'flail');
    D.anim('ped3.x', -13.6, 0.7, 0, 'inout'); D.anim('ped3.z', -0.4, 0.7, 0, 'inout'); D.anim('ped3.y', 0.6, 0.35, 0, 'out'); D.anim('ped3.y', 0, 0.35, 0.35, 'in');
    D.anim('chunk0.y', 0, 0.45, 0.2, 'in'); D.anim('chunk0.z', -6.2, 0.45, 0.2);
    D.sfx('buildingFall', 0.2, 0.9);
    D.cam(FIX([-6, 1.4, 4.5], [-11, 1.2, -3.6], { fov: 58 }));
    wait0(0.7);
    D.fx('dustCloud', { x: -9.4, y: 0, z: -6, n: 70, dur: 3.5, radius: 4, size: 1.0 }); D.fx('debris', { x: -9.4, y: 0.5, z: -6, n: 60 }); D.shake(1.0, 0.7);
    D.comic('BOOM!', 0, 1.0, { x: 0.62, y: 0.32, size: 110, rot: -5, c1: '#ffffff', c2: '#ffb045' });
    D.anim('lasso.on', 0, 0.4, 0.4); D.act('cowboy', 'idle', 0.6); D.act('ped3', 'idle', 0.6); D.expr('ped3', 'surprised', 0.6);
    D.sound('The chunk smashes down right where the kid was standing', 2.4, 0.3); D.wait(2.6);
    D.set('lasso.target', 'none');
  }
  D.faceChar('ped3', 'cowboy', 0.3); D.faceChar('cowboy', 'ped3', 0.3); D.expr('ped3', 'grin');
  D.say('ped3', 'Whoa! A real cowboy!', { label: 'KID', cam: R('ped3', 15, 1.4, 0.0, { lookY: -0.05, fov: 42 }), act: 'cheer', dur: 1.5 });
  D.act('ped3', 'idle');
  D.say('ped3', 'Are you a superhero?', { label: 'KID', cam: R('ped3', 15, 1.4, 0.0, { lookY: -0.05, fov: 42 }), expr: 'happy', dur: 1.3 });
  D.cam(R('cowboy', 20, 1.6, 0.05, { lookY: -0.05, fov: 38 })); D.sound('Fred thinks about it', 1.4, 0.1); D.wait(1.6);
  D.say('cowboy', '...I guess I am now.', { ...FRED, expr: 'happy', dur: 1.5 });
  D.say('cowboy', 'Run home, partner.', { ...FRED, cam: R('cowboy', 20, 1.7, 0.05, { lookY: -0.05, fov: 40 }), act: 'tipHat', expr: 'happy', dur: 1.4 });
  D.act('cowboy', 'idle');
  D.path('ped3', [[-22, -1.0], [-40, -1.2]], 3.4); D.hide('ped3', 6);
  // tiger vs shadow
  {
    D.place('tiger', 0, 14, P * 0.15); D.set('tiger.s', 1.7); D.set('tiger.act', 'idle');
    D.set('shadow.x', 10); D.set('shadow.z', 26); D.set('shadow.y', 0); D.set('shadow.eyes', 1.5);
    D.set('tiger.act', 'leap'); fly('tiger', 6.5, 3.5, 21.5, 0.7, 0.1, 'out'); D.sfx('tigerRoar', 0, 0.8); D.sfx('whoosh', 0.2, 0.6);
    D.anim('shadow.swipeR', 1, 0.35, 0.5, 'in'); D.anim('shadow.swipeR', 0, 0.6, 0.9);
    D.set('tiger.act', 'tumble', 0.85); fly('tiger', -2, 0, 17, 0.9, 0.85, 'out'); D.set('tiger.act', 'crouch', 1.8);
    D.sfx('punchHit', 0.85, 0.8); D.sfx('thud', 1.7, 0.7);
    D.cam(FIX([-6, 2.4, 9], [6, 4, 22], { fov: 60 }));
    D.sound('Eric leaps at the shadow creature... and gets swatted out of the air', 3.0, 0.2); D.wait(2.8);
    D.set('tiger.act', 'roar'); D.sfx('tigerRoar', 0, 0.9); D.set('tiger.act', 'idle', 1.6);
    D.cam(F(['tiger'], 60, 3.6, 0.3, { lookY: -0.3, fov: 46 }));
    D.sound('He shakes it off and roars', 1.8, 0.2); D.wait(2.0);
  }
  // the shadow plays tricks
  {
    D.set('tiger.act', 'idle');
    D.anim('shadow.y', -9, 1.2, 0, 'in'); D.anim('shadow.eyes', 0, 0.6, 0.4); D.sfx('shadowWhoosh', 0, 0.7);
    D.cam(FIX([-8, 2.2, 10], [4, 3.5, 22], { fov: 58 }));
    D.sound('The shadow creature melts into the ground...', 2.0, 0.2); wait0(2.6);
    D.set('shadow.x', -9); D.set('shadow.z', 23); D.anim('shadow.y', 0, 1.0, 0, 'out'); D.anim('shadow.eyes', 1.5, 0.4, 0.6); D.sfx('shadowWhoosh', 0, 0.8);
    D.cam(FIX([5, 1.6, 10.5], [-6, 3.6, 21], { fov: 60 }));
    D.sound('...and rises up right behind Eric!', 1.8, 0.2); wait0(2.2);
    D.set('tiger.act', 'leap'); fly('tiger', 4, 0, 13.5, 0.7, 0, 'out'); D.anim('shadow.swipeL', 1, 0.35, 0, 'in'); D.anim('shadow.swipeL', 0, 0.5, 0.4); D.sfx('whoosh', 0.1, 0.7); D.sfx('tigerRoar', 0.2, 0.6);
    D.set('tiger.act', 'crouch', 0.75); D.face('tiger', -0.9, 0.3, 0.8);
    wait0(1.6);
  }
  D.say('eric', "Hey! No fair! You can't just disappear like that!", { ...TIGER, cam: F(['tiger'], 200, 4.0, 0.3, { lookY: -0.3, fov: 48 }), dur: 2.4 });
  D.set('tiger.act', 'idle');
  {
    D.face('tiger', -0.94, 0.3);
    D.set('tiger.act', 'leap', 0.3); fly('tiger', -8.5, 3.0, 22.5, 0.6, 0.4, 'out'); fly('tiger', -12.5, 0, 25.5, 0.5, 1.0, 'in'); D.set('tiger.act', 'crouch', 1.5);
    D.fx('smoke', { x: -9, y: 3, z: 23, n: 50, dur: 2.0, color: 0x2a2030, color2: 0x4a4050 }, 0.9); D.sfx('shadowWhoosh', 0.9, 0.8); D.sfx('tigerRoar', 0.4, 0.7);
    D.cam(FIX([2, 2.0, 13], [-9, 3, 23], { fov: 58 }));
    D.sound('Eric pounces... and flies right through it. The creature is made of shadow!', 3.0, 0.2); wait0(3.4);
    D.face('tiger', 2.19, 0.4); D.set('tiger.act', 'idle', 0.3);
  }
  D.say('eric', "How do you fight something you can't even touch?!", { ...TIGER, cam: F(['tiger'], 160, 4.2, 0.3, { lookY: -0.3, fov: 48 }), dur: 2.2 });
  D.say('cowboy', "Light! Shadows can't stand bright light!", { ...FRED, cam: R('cowboy', 20, 1.8, 0.05, { lookY: -0.05, fov: 40 }), act: 'point', dur: 2.0 });
  D.say('eric', "It's the middle of the night, Fred!", { ...TIGER, cam: F(['tiger'], 160, 4.2, 0.3, { lookY: -0.3, fov: 48 }), dur: 1.8 });
  D.act('cowboy', 'idle');
  {
    D.anim('beh.tailLift', 1, 0.6); D.anim('beh.tailLift', 0, 0.5, 0.8); D.sfx('tailSlam', 0.8, 0.9);
    D.set('chunk3.vis', 1, 0.8); D.set('chunk3.x', 5, 0.8); D.set('chunk3.y', 30, 0.8); D.set('chunk3.z', -14, 0.8); D.set('chunk3.rx', 0.3, 0.8); D.set('chunk3.ry', 0.4, 0.8); D.set('chunk3.rz', 0, 0.8);
    D.anim('chunk3.y', 0, 1.1, 0.9, 'in'); D.anim('chunk3.z', -11, 1.1, 0.9); D.anim('chunk3.rz', 0.6, 1.1, 0.9); D.sfx('buildingFall', 0.9, 0.9);
    D.fx('dustCloud', { x: 5, y: 0, z: -11, n: 80, dur: 3.5, radius: 5, size: 1.2 }, 2.0); D.fx('debris', { x: 5, y: 0.5, z: -11, n: 60, spread: 2 }, 2.0); D.shake(1.2, 0.8, 2.0);
    D.cam(FIX([-6, 2.0, 6], [3, 8, -14], { fov: 62 }));
    D.sound('Behemoth’s tail smashes the top off a building', 2.4, 0.3); wait0(3.6);
  }
  // the titan throws a car at Greg
  {
    D.place('greg', -6, 1.5, P / 2); D.set('greg.y', 3.4); D.act('greg', 'hover');
    D.place('titan', 26, 0.8, -P / 2); D.set('titan.reachR', 0); D.set('titan.upR', 0); D.set('titan.lean', 0);
    D.anim('titan.reachR', 0.85, 0.8); D.anim('titan.lean', 0.5, 0.8); D.set('carD.hold', 1, 0.9);
    D.anim('titan.reachR', 0, 0.6, 1.1); D.anim('titan.lean', 0, 0.6, 1.1); D.anim('titan.upR', 1, 0.6, 1.1);
    D.cam(FIX([10, 1.3, 10], [25, 8, 0], { fov: 58 }));
    D.sound('The titan grabs another car and aims it at Greg', 2.2, 0.2); wait0(2.0);
    D.anim('titan.upR', 0.1, 0.3, 0, 'in'); D.anim('titan.reachR', 0.6, 0.3, 0, 'in'); D.sfx('whoosh', 0, 0.9);
    D.set('carD.hold', 0, 0.25); D.set('carD.x', 23, 0.25); D.set('carD.y', 14, 0.25); D.set('carD.z', 1.5, 0.25);
    D.anim('carD.x', -24, 1.4, 0.25, 'linear'); D.anim('carD.y', 1.0, 1.4, 0.25, 'linear'); D.anim('carD.z', -6.0, 1.4, 0.25); D.anim('carD.rz', -5.0, 1.4, 0.25); D.anim('carD.rx', 0.8, 1.4, 0.25);
    D.act('greg', 'dodge', 0.6); fly('greg', -6, 6.5, 3.5, 0.4, 0.6, 'out'); D.act('greg', 'hover', 1.2);
    D.cam(FIX([-2, 2.8, 10], [-8, 4, 0], { fov: 64 }), 0.3);
    D.sound('Greg dodges at the last second', 1.6, 0.6); wait0(1.7);
    D.set('carD.rz', -P, 0); D.set('carD.rx', 0, 0); D.set('carD.y', 0, 0);
    D.fx('dustCloud', { x: -24, y: 0, z: -6, n: 50, dur: 3, radius: 3, size: 0.8 }); D.fx('debris', { x: -24, y: 1, z: -6, n: 50 }); D.sfx('metalCrash', 0, 1.0); D.sfx('glassShatter', 0.05, 0.7); D.shake(0.6, 0.5);
    D.comic('SMASH!', 0, 1.0, { x: 0.3, y: 0.34, size: 110, rot: 6, c1: '#ffffff', c2: '#ff8a45' });
    wait0(1.0);
    D.anim('titan.reachR', 0, 0.6);
  }
  D.face('greg', -P / 2, 0.4);
  D.say('greg', "HEY! That's somebody's car!", { cam: R('greg', 15, 2.3, 0.1, { lookY: -0.2 }), act: 'point', expr: 'angry', dur: 1.6 });
  D.act('greg', 'hover');
  {
    D.act('greg', 'fly'); D.face('greg', -P / 2 + 0.1, 0.2); fly('greg', 22.8, 9.5, 1.0, 1.2, 0.2, 'in'); D.sfx('whoosh', 0.2, 0.8);
    D.act('greg', 'punch', 1.25); D.fx('flashBurst', { x: 23.6, y: 9.6, z: 0.9, dur: 0.5, radius: 1.4, color: 0xffd080, light: 30 }, 1.4); D.sfx('punchHit', 1.4, 1.0); D.sfx('bonk', 1.45, 0.8); D.shake(0.5, 0.4, 1.4);
    D.act('greg', 'flail', 1.6); fly('greg', 15, 6, 3, 0.8, 1.6, 'out'); D.act('greg', 'hover', 2.5);
    D.comic('BONK!', 1.4, 0.9, { x: 0.6, y: 0.3, size: 110, rot: 8, c1: '#ffffff', c2: '#ffb045' });
    D.cam(FIX([8, 4.0, 12], [20, 8, 1], { fov: 58 }));
    D.sound('Greg flies up and punches the titan right in the chest...', 2.6, 0.2); wait0(3.2);
  }
  D.say('greg', "OW! OW! It's made of ROCK!", { cam: R('greg', 20, 2.4, 0.1, { lookY: -0.2 }), act: 'flail', expr: 'shocked', dur: 1.6 });
  D.act('greg', 'hover');
  {
    D.face('titan', -P / 2, 0.3); D.anim('titan.roar', 1, 0.4); D.anim('titan.roar', 0, 0.7, 2.6); D.anim('titan.upL', 0.7, 0.5); D.anim('titan.upR', 0.7, 0.5); D.anim('titan.upL', 0, 0.7, 2.6); D.anim('titan.upR', 0, 0.7, 2.6);
    D.sfx('titanRoar', 0, 1.0); D.shake(1.0, 2.8);
    D.anim('beh.rear', 0.85, 0.6); D.anim('beh.jaw', 1, 0.3, 0.4); D.anim('beh.jaw', 0, 0.4, 2.4); D.sfx('monsterRoar', 0.4, 0.7);
    D.cam(FIX([12, 0.8, 7], [26, 12, 0.5], { fov: 62 }));
    D.say('behemoth', 'RRRRRRAAAAAAAAAHHHHH!', { label: 'THE MONSTERS', dur: 2.6 });
  }
  D.cam(FIX([-30, 6, 18], [6, 6, -2], { pos2: [-31, 7, 19], fov: 54 }));
  D.sound('Three heroes. Three giant monsters. And the city is falling apart', 3.0, 0.3); D.wait(3.4);
  D.cam(R('greg', 20, 2.3, 0.1, { lookY: -0.2 }));
  D.say('greg', 'Aaron! How is it going down there?', { dur: 1.6 });
  D.sfx('policeRadio', 0, 0.5);
  D.say('aaron', "He's here.", { label: 'AARON (ON THE RADIO)', cam: R('greg', 20, 2.0, 0.1, { lookY: -0.2, fov: 40 }), dur: 1.0 });
  D.expr('greg', 'worried'); D.sfx('glitch', 0, 0.3);
  D.cam(R('greg', 20, 1.8, 0.1, { lookY: -0.2, fov: 38 })); D.sound('The radio cuts out', 1.4, 0.1); D.wait(1.6);
  D.expr('greg', 'determined');
  D.say('greg', '...Okay. Then we hold the city. No matter what.', { dur: 2.2 });
  D.say('eric', 'No matter what!', { ...TIGER, cam: F(['tiger'], 160, 4.2, 0.3, { lookY: -0.3, fov: 48 }), dur: 1.1 });
  D.say('cowboy', 'No matter what.', { ...FRED, cam: R('cowboy', 20, 1.8, 0.05, { lookY: -0.05, fov: 40 }), expr: 'determined', dur: 1.1 });
  D.set('fade', 1); D.sfx('cutBlack', 0, 0.4); wait0(0.5);

  // ===================================================================== SCENE 4: THE CONTROL ROOM BATTLE (no dialogue)
  D.scene('4. The Control Room Battle');
  D.location('power');
  cast([...POWER3]);
  D.set('hud.core', 1); D.set('core.pct', 90); D.set('pdoor.open', 0); D.set('pdoor.glow', 1); D.set('pdoor.burst', 0); D.set('dome.x', 0); D.set('dome.z', -6); D.set('dome.r', 3.9); D.set('dome.on', 1); D.set('core.flicker', 0.6);
  D.place('aaron', 4.7, -5.8, 2.55); D.act('aaron', 'leanTable'); D.expr('aaron', 'determined');
  D.place('flare', -2.6, 3.0, 0); D.act('flare', 'flameHand'); D.expr('flare', 'determined');
  D.place('leon', 2.6, 3.2, 0); D.act('leon', 'powerFist'); D.expr('leon', 'angry');
  D.fx('flame', { who: 'flare', side: 'R', dur: 14, size: 0.35 });
  D.music('epic', 0.46, 0, 0.3);
  D.anim('fade', 0, 0.3);
  // the door
  for (const tt of [0.3, 1.3, 2.3]) { D.sfx('doorBang', tt, 0.9); D.shake(0.3, 0.3, tt); D.set('pdoor.shake', 1, tt); D.set('pdoor.shake', 0, tt + 0.4); }
  D.cam(FIX([-2.4, 1.2, 6.0], [-0.2, 1.6, 2.8], { fov: 50 }));
  D.sound('BOOM. BOOM. BOOM. Something is pounding on the door', 2.4, 0.2); D.wait(2.4);
  D.set('pdoor.shake', 1); D.sfx('doorRattle', 0, 0.9); D.sfx('doorRattle', 0.8, 0.9);
  D.cam(FIX([0, 1.6, 5.5], [0, 2.4, 11.8], { pos2: [0, 1.6, 6.5], fov: 52 }));
  D.sound('The blast door shakes', 1.6, 0.1); D.wait(1.8);
  {
    D.set('pdoor.shake', 0); D.anim('pdoor.burst', 1, 0.9, 0, 'out'); D.set('flashViolet', 0.55); D.anim('flashViolet', 0, 0.5);
    D.sfx('bigBlast', 0, 1.0); D.sfx('blastDoor', 0.1, 1.0); D.sfx('metalCrash', 0.5, 0.8); D.shake(1.6, 1.4);
    D.fx('smoke', { x: 0, y: 0.5, z: 11, n: 70, dur: 4.5, color: 0x3a2a4a, color2: 0x6a3a9a });
    D.fx('debris', { x: 0, y: 2, z: 11.5, n: 60, spread: 1.6 });
    D.comic('KRA-KOOOM!', 0, 1.3, { x: 0.5, y: 0.35, size: 130, rot: -4, c1: '#ffffff', c2: '#c060ff' });
    everyone((c) => D.act(c, 'shield'), ['flare', 'leon']);
    D.cam(FIX([-3.5, 1.0, 4.0], [0, 2.0, 10.5], { fov: 62 }));
    D.sound('The blast door explodes!', 1.6, 0.1); wait0(2.4);
  }
  D.set('pdoor.glow', 0);
  D.show('soulX'); D.place('soulX', 0, 14.5, P); D.act('soulX', 'idle'); D.expr('soulX', 'serious'); D.set('soulX.y', 0); D.set('soulX.alpha', 1); D.set('soulX.energy', 1); D.set('soulX.eyeGlow', 3.2);
  D.show('horse'); D.place('horse', 1.8, 15.5, P); D.set('horse.scale', 1); D.set('horse.alpha', 1); D.set('horse.purple', 1); D.set('horse.glow', 1.6); D.set('horse.act', 'idle');
  {
    D.path('soulX', [[0, 7.6]], 1.1, 0.2); D.path('horse', [[2.8, 8.6]], 1.1, 0.4);
    D.fx('bodyAura', { who: 'horse', dur: 60, color: 0xa040ff, power: 0.9 });
    D.act('flare', 'flameHand'); D.act('leon', 'powerFist');
    D.cam(FIX([0, 1.1, 2.0], [0, 1.9, 12], { fov: 46 }));
    D.sound('Through the smoke, the Soul Stealer walks in. Fred’s horse follows him, trapped in purple energy', 3.8, 0.4); D.wait(5.4);
  }
  // the standoff
  {
    D.set('horse.act', 'rear', 0.4); D.sfx('giantNeigh', 0.5, 0.6); D.set('horse.act', 'idle', 2.4); D.anim('horse.glow', 2.6, 0.6, 0.4);
    D.anim('soulX.eyeGlow', 4.2, 0.8); D.act('soulX', 'powerStance', 0.6);
    D.cam(FIX([5.2, 1.0, 4.2], [2.2, 1.6, 8.4], { fov: 50 }));
    D.sound('The horse rears up, glowing with stolen purple power', 2.4, 0.3); wait0(3.2);
    D.sfx('heartbeatSlow', 0, 0.7);
    D.cam(FIX([1.6, 1.9, 10.2], [-0.6, 1.3, 3.0], { pos2: [1.2, 1.9, 10.0], fov: 46 }));
    D.sound('Flare and Leon stand their ground. Nobody moves', 2.4, 0.3); wait0(3.2);
    D.cam(FIX([-0.6, 1.6, 3.6], [0, 1.7, 7.6], { pos2: [-0.4, 1.6, 4.4], fov: 40, ease: 'linear' }));
    D.sound('Then...', 1.0, 0.2); wait0(1.6);
  }
  // round 1: Flare's fireballs
  {
    D.face('flare', 0.25, 0.2);
    D.act('flare', 'oneHandBlast'); fireball(handAt('flare', 0.2), chest('soulX', 0.6, 1.4), 0.2, 0.42);
    D.act('soulX', 'soulBlock', 0.2); hit(chest('soulX', 0.62, 1.5), 0.62, 0xffa040, 40);
    D.cam(FIX([-6.0, 1.5, 3.0], [-0.4, 1.6, 6.8], { fov: 54 }));
    wait0(1.5);
    D.act('flare', 'blastPose'); fireball(handAt('flare', 0.1), [0.2, 1.6, 7.3], 0.1, 0.4);
    D.act('soulX', 'soulSweep', 0.3); D.fx('dark', { from: [0.3, 1.6, 7.2], to: [-13.6, 2.6, 2.2], dur: 0.45, size: 1.0, ...FIRE }, 0.55);
    D.set('power.dmg0', 1, 1.0); D.shake(0.5, 0.4, 1.0); D.sfx('blastImpact', 1.0, 0.8);
    D.cam(FIX([4.0, 1.4, 11.0], [-2, 1.6, 4.5], { fov: 58 }));
    D.sound('He swats the fireball away like it’s nothing', 2.0, 0.3); wait0(2.4);
  }
  // round 1b: rapid fire
  {
    D.act('flare', 'oneHandBlast', 0); D.act('flare', 'blastPose', 0.6); D.act('flare', 'oneHandBlast', 1.2);
    [0, 0.6, 1.2].forEach((dt, i) => { fireball(handAt('flare', dt), chest('soulX', dt + 0.38, 1.25 + 0.15 * i), dt, 0.38, 0.9); hit(chest('soulX', dt + 0.38, 1.5), dt + 0.38, 0xffa040, 25); });
    D.act('soulX', 'soulBlock', 0.2); D.act('soulX', 'soulSweep', 0.8); D.act('soulX', 'soulBlock', 1.4);
    D.cam(FIX([-3.6, 1.2, 10.5], [-1.4, 1.5, 5.0], { fov: 56 }));
    D.sound('Fire, fire and more fire. He blocks every single one', 2.6, 0.2); wait0(3.6);
    D.act('soulX', 'idle'); D.act('flare', 'ready');
  }
  // round 1c: Aaron's light trick
  {
    D.sfx('buttonClick', 0.1, 0.8); D.sfx('computerBeep', 0.2, 0.6);
    D.cam(FIX([7.6, 1.6, -3.0], [4.8, 1.2, -6.0], { fov: 48 }));
    D.sound('Aaron hits a switch on the console', 1.6, 0.1); wait0(1.6);
    for (const dt of [0, 0.5, 1.0]) { D.set('flashWhite', 0.65, dt); D.anim('flashWhite', 0, 0.3, dt + 0.05); D.sfx('electricSlam', dt, 0.4); }
    D.set('power.flicker', 1); D.set('power.flicker', 0, 1.6);
    D.act('soulX', 'cover', 0.1); D.expr('soulX', 'shocked', 0.1);
    D.act('flare', 'oneHandBlast', 1.3); fireball(handAt('flare', 1.3), chest('soulX', 1.7, 1.3), 1.3, 0.38, 1.2); hit(chest('soulX', 1.7, 1.4), 1.7, 0xffa040, 60);
    D.act('soulX', 'knockBack', 1.75); D.anim('soulX.z', 9.2, 0.5, 1.75, 'out'); D.act('soulX', 'idle', 2.6); D.anim('soulX.z', 7.6, 1.0, 2.8);
    D.comic('FWOOSH!', 1.7, 0.9, { x: 0.55, y: 0.33, size: 110, rot: -6, c1: '#fff6a0', c2: '#ff7a20' });
    D.cam(FIX([-4.5, 1.4, 4.2], [0, 1.5, 7.6], { fov: 56 }));
    D.sound('Every light in the room flashes. Blinded, the Soul Stealer takes a fireball to the chest!', 3.4, 0.2); wait0(4.0);
    D.expr('soulX', 'angry'); D.act('flare', 'ready');
  }
  // round 1d: purple bolts
  {
    D.act('soulX', 'soulBlast'); D.act('soulX', 'soulBlast', 0.7); D.act('soulX', 'soulBlast', 1.4);
    purpleBolt(handAt('soulX', 0.1), [-2.6, 1.2, 3.0], 0.1, 0.3, 0.9); purpleBolt(handAt('soulX', 0.8), [-1.4, 1.0, 3.4], 0.8, 0.3, 0.9); purpleBolt(handAt('soulX', 1.5), [-3.4, 1.0, 2.6], 1.5, 0.3, 0.9);
    D.act('flare', 'dodge', 0.25); D.anim('flare.x', -1.4, 0.35, 0.25, 'out'); D.anim('flare.z', 3.4, 0.35, 0.25);
    D.act('flare', 'dodge', 0.95); D.anim('flare.x', -3.4, 0.35, 0.95, 'out'); D.anim('flare.z', 2.6, 0.35, 0.95);
    D.act('flare', 'dive', 1.65); D.anim('flare.x', -2.6, 0.4, 1.65, 'out'); D.anim('flare.z', 3.0, 0.4, 1.65); D.act('flare', 'getUp', 2.3); D.act('flare', 'ready', 3.2);
    hit([-2.6, 0.4, 3.0], 0.4, 0xc070ff, 25); hit([-1.4, 0.4, 3.4], 1.1, 0xc070ff, 25); hit([-3.4, 0.4, 2.6], 1.8, 0xc070ff, 25);
    D.cam(FIX([-7.5, 1.2, 6.5], [-1.6, 1.2, 4.0], { fov: 56 }));
    D.sound('He fires back. Flare dodges left, right, and dives out of the way', 3.0, 0.2); wait0(3.6);
    D.face('flare', 0.25, 0.3);
  }
  // round 2: Leon charges
  {
    D.act('leon', 'idle');
    const tr = D.path('leon', [[0.6, 6.2]], 8.0);
    D.act('leon', 'punch', tr - 0.05); D.sfx('whoosh', tr - 0.1, 0.7);
    D.cam(FIX([6.0, 1.3, 4.0], [0.5, 1.4, 7.0], { fov: 54 }));
    wait0(tr + 0.12);
    D.fx('flashBurst', { x: 0, y: 1.3, z: 7.6, dur: 0.45, radius: 1.4, color: 0xa040ff, light: 30 }); D.sfx('teleport', 0, 0.7);
    D.place('soulX', 0.4, 3.9, 0.15); D.act('soulX', 'soulBlast', 0.15);
    D.cam(FIX([-4.0, 1.5, 3.5], [0.6, 1.4, 5.4], { fov: 56 }));
    D.sound('He vanishes... and appears right behind Leon', 2.0, 0.2); wait0(0.75);
    purpleBolt(handAt('soulX'), chest('leon', 0, 1.2), 0, 0.2, 1.2);
    D.act('leon', 'knockBack', 0.2); D.anim('leon.x', 5.6, 0.7, 0.2, 'out'); D.anim('leon.z', 9.6, 0.7, 0.2, 'out'); D.anim('leon.y', 0.6, 0.35, 0.2, 'out'); D.anim('leon.y', 0, 0.35, 0.55, 'in');
    D.act('leon', 'lieBack', 1.0); D.sfx('thud', 0.9, 0.9); D.set('power.dmg1', 0, 0);
    D.comic('WHAM!', 0.25, 0.9, { x: 0.58, y: 0.34, size: 110, rot: 6, c1: '#fff6a0', c2: '#c060ff' });
    wait0(2.0);
  }
  // round 3: Aaron's shield saves Leon
  {
    D.face('soulX', 1.0, 0.3); D.act('soulX', 'soulBlast', 0.3);
    D.act('aaron', 'idle'); D.path('aaron', [[4.3, 8.0]], 9.0); D.act('aaron', 'shieldUp', 0.95); D.anim('aaron.shield', 1, 0.2, 0.95); D.face('aaron', -2.2, 0.15, 0.95); D.sfx('shieldOn', 0.95, 0.8);
    purpleBolt(handAt('soulX', 0.8), [4.0, 1.4, 7.6], 1.05, 0.25, 1.3); hit([4.1, 1.4, 7.7], 1.3, 0xc070ff, 60);
    D.cam(FIX([9.0, 1.6, 10.8], [3.5, 1.4, 7.0], { fov: 56 }));
    D.sound('Aaron dives in front of Leon. His wrist shield blocks the blast', 2.6, 0.2); wait0(3.0);
    D.anim('aaron.shield', 0, 0.3); D.act('aaron', 'ready'); D.act('leon', 'getUp'); D.act('leon', 'ready', 1.6);
  }
  // round 3b: close combat
  {
    wait0(1.8);
    D.place('leon', 4.6, 8.6, -2.5); D.act('leon', 'ready'); D.face('soulX', 0.9, 0.2);
    const tr = D.path('leon', [[1.3, 4.9]], 7.0); D.act('leon', 'punch', tr - 0.1); D.sfx('whoosh', tr - 0.1, 0.6);
    D.act('soulX', 'soulBlock', tr - 0.15); hit([0.9, 1.4, 4.5], tr + 0.05, 0xffd060, 30); D.sfx('punchHit', tr + 0.05, 0.8);
    D.cam(FIX([-3.2, 1.3, 7.2], [0.8, 1.4, 4.4], { fov: 52 }));
    wait0(tr + 0.7);
    D.act('leon', 'punch'); D.act('soulX', 'dodge'); D.sfx('whoosh', 0.1, 0.6);
    D.act('leon', 'punch', 0.7); D.act('soulX', 'soulBlock', 0.6); hit([0.9, 1.5, 4.5], 0.8, 0xffd060, 30); D.sfx('punchHit', 0.8, 0.8);
    D.act('leon', 'punch', 1.4); D.act('soulX', 'dodge', 1.35); D.sfx('whoosh', 1.45, 0.6);
    D.cam(FIX([3.8, 1.2, 2.4], [0.8, 1.4, 4.4], { fov: 50 }));
    D.sound('Punch. Dodge. Punch. Block. Leon is fast... but the Soul Stealer is faster', 3.2, 0.1); wait0(2.6);
    D.act('soulX', 'soulBlast'); purpleBolt(handAt('soulX', 0.1), chest('leon', 0.25, 1.2), 0.1, 0.18, 1.0);
    D.act('leon', 'knockBack', 0.3); D.anim('leon.x', 3.4, 0.6, 0.3, 'out'); D.anim('leon.z', 7.6, 0.6, 0.3, 'out'); D.act('leon', 'lieBack', 0.9); D.sfx('thud', 0.9, 0.8);
    D.act('aaron', 'shieldUp', 0.5); D.anim('aaron.shield', 1, 0.2, 0.5); D.sfx('shieldOn', 0.5, 0.6); D.anim('aaron.shield', 0, 0.3, 2.0); D.act('aaron', 'ready', 2.0);
    D.cam(FIX([-4.5, 1.6, 4.0], [1.8, 1.1, 6.2], { fov: 56 }));
    wait0(2.4);
  }
  // round 3d: the horse vs Aaron's shield
  {
    D.place('aaron', 3.4, 6.4, -2.2); D.act('aaron', 'shieldUp'); D.anim('aaron.shield', 1, 0.3);
    D.path('horse', [[3.2, 7.6]], 3.0, 0.2); D.set('horse.act', 'rear', 0.8); D.sfx('giantNeigh', 0.8, 0.7);
    D.fx('flashBurst', { x: 3.3, y: 1.6, z: 6.9, dur: 0.5, radius: 1.4, color: 0x7fd4ff, light: 30 }, 1.6); D.sfx('shieldOn', 1.6, 0.8); D.sfx('punchHit', 1.6, 0.7); D.shake(0.5, 0.4, 1.6);
    D.anim('aaron.z', 5.6, 0.4, 1.65, 'out'); D.set('horse.act', 'idle', 2.6);
    D.cam(FIX([7.4, 1.4, 4.2], [3.2, 1.4, 7.0], { fov: 52 }));
    D.sound('The horse rears up and stomps on Aaron’s shield. It holds... barely', 2.8, 0.3); wait0(3.4);
    D.anim('aaron.shield', 0, 0.3); D.act('aaron', 'ready'); D.path('horse', [[2.8, 8.6]], 3.0);
    wait0(1.2);
  }
  // round 3c: the horse charges
  {
    D.set('horse.act', 'rear'); D.sfx('giantNeigh', 0, 0.7); D.set('horse.act', 'idle', 0.9);
    D.path('horse', [[-2.4, 3.2], [-5.4, 0.0]], 9.0, 1.0); D.sfx('gallop', 1.0, 0.9);
    D.act('flare', 'dive', 1.6); D.anim('flare.x', -0.2, 0.5, 1.6, 'out'); D.anim('flare.z', 2.2, 0.5, 1.6, 'out'); D.act('flare', 'getUp', 2.4);
    D.cam(FIX([-6.5, 1.3, 7.5], [-0.5, 1.3, 4.0], { fov: 58 }));
    D.sound('Fred’s horse charges straight at Flare!', 2.0, 0.6); wait0(3.4);
    D.act('flare', 'flameHand'); D.face('flare', -1.97, 0.3); D.face('horse', 1.17, 0.6); D.fx('flame', { who: 'flare', side: 'R', dur: 2.6, size: 0.35 });
    D.cam(FIX([3.0, 1.9, 1.0], [-4.0, 1.2, 0.6], { fov: 56 }));
    D.sound('Her hands light up... but she can’t do it. It’s Fred’s horse', 2.8, 0.2); wait0(3.4);
    D.act('flare', 'ready'); D.expr('flare', 'sad');
    D.path('horse', [[1.8, 9.4]], 4.0); D.sfx('hooves', 0, 0.5);
    D.cam(FIX([-4.5, 1.5, 5.5], [0.5, 1.2, 7.5], { fov: 56 }));
    D.sound('The horse trots back to the Soul Stealer’s side', 2.0, 0.2); wait0(2.8);
    D.expr('flare', 'determined');
  }
  // round 4: illusions
  {
    D.place('soulX', 0, 4.0, 0); D.act('soulX', 'powerStance'); D.expr('soulX', 'smug'); D.place('horse', 6.2, 9.4, -2.3);
    D.place('aaron', 3.6, 8.0, -2.4); D.place('leon', 5.0, 8.8, -2.4); D.place('flare', -2.8, 6.8, 2.2);
    D.act('soulX', 'soulRaiseBoth'); D.sfx('magicFloat', 0, 0.6);
    D.show('soulX2', 0.6); D.place('soulX2', -4.6, 2.0, 0.9, 0.6); D.act('soulX2', 'powerStance', 0.6);
    D.show('soulX3', 0.9); D.place('soulX3', 5.6, 2.5, -0.9, 0.9); D.act('soulX3', 'powerStance', 0.9);
    D.fx('flashBurst', { x: -4.6, y: 1.2, z: 2.0, dur: 0.5, radius: 1.4, color: 0xa040ff, light: 30 }, 0.6); D.fx('flashBurst', { x: 5.6, y: 1.2, z: 2.5, dur: 0.5, radius: 1.4, color: 0xa040ff, light: 30 }, 0.9);
    D.sfx('teleport', 0.6, 0.6); D.sfx('teleport', 0.9, 0.6);
    D.cam(FIX([0, 3.6, 11.0], [0, 1.4, 3.5], { fov: 64 }));
    D.sound('He splits into three. Which one is real?', 2.4, 0.4); wait0(3.4);
    D.path('soulX2', [[-3.6, 5.2], [-1.6, 6.4]], 2.0); D.path('soulX3', [[4.4, 5.4], [2.4, 6.2]], 2.0);
    D.sfx('illusionWarp', 0, 0.5); D.sfx('magicFloat', 0.6, 0.4);
    D.cam(FIX([-6.5, 2.2, 10.5], [0, 1.4, 5.0], { fov: 60 }));
    D.sound('The copies circle closer', 1.6, 0.1); wait0(2.4);
    D.path('soulX2', [[-4.6, 2.0]], 4.0); D.path('soulX3', [[5.6, 2.5]], 4.0);
    D.face('soulX2', 0.9, 0.3, 0.8); D.face('soulX3', -0.9, 0.3, 0.8); wait0(1.0);
    for (const [s, dt] of [['soulX', 0], ['soulX2', 0.15], ['soulX3', 0.3]]) { D.act(s, 'soulBlast', dt); }
    purpleBolt([0, 2.0, 4.4], [3.6, 1.0, 8.4], 0.25, 0.35); purpleBolt([-4.3, 2.0, 2.4], [-2.8, 1.0, 7.2], 0.4, 0.35); purpleBolt([5.3, 2.0, 2.9], [5.0, 1.0, 9.2], 0.55, 0.35);
    D.act('aaron', 'dive', 0.2); D.act('flare', 'dive', 0.35); D.act('leon', 'dive', 0.5);
    D.anim('aaron.x', 2.0, 0.5, 0.2, 'out'); D.anim('flare.x', -1.2, 0.5, 0.35, 'out'); D.anim('leon.x', 7.0, 0.5, 0.5, 'out');
    D.act('aaron', 'getUp', 1.2); D.act('flare', 'getUp', 1.3); D.act('leon', 'getUp', 1.4);
    D.cam(FIX([-8, 1.6, 11], [2, 1.2, 6], { fov: 62 }));
    D.sound('Three blasts at once. They dive out of the way', 2.2, 0.3); wait0(2.8);
  }
  // round 5: Flare's heat wave breaks the illusions
  {
    D.place('flare', -1.0, 7.0, P); D.act('flare', 'blastPose'); D.expr('flare', 'angry');
    D.fx('heatWave', { x: -1.0, z: 7.0, dir: P, spread: P * 1.9, speed: 9, maxR: 11, dur: 1.6, size: 0.42, n: 40 }, 0.3);
    D.sfx('heatWave', 0.3, 0.9); D.sfx('fireRoar', 0.3, 0.8);
    D.fx('flashBurst', { x: -4.6, y: 1.2, z: 2.0, dur: 0.6, radius: 1.8, color: 0xc070ff, light: 40 }, 0.9); D.anim('soulX2.alpha', 0, 0.3, 0.9); D.hide('soulX2', 1.25); D.sfx('glassShatter', 0.9, 0.5);
    D.fx('flashBurst', { x: 5.6, y: 1.2, z: 2.5, dur: 0.6, radius: 1.8, color: 0xc070ff, light: 40 }, 1.0); D.anim('soulX3.alpha', 0, 0.3, 1.0); D.hide('soulX3', 1.35); D.sfx('glassShatter', 1.0, 0.5);
    D.act('soulX', 'soulBlock', 0.8);
    D.cam(FIX([-1.0, 6.4, 11.0], [-0.5, 0.5, 3.6], { fov: 66 }));
    D.sound('Flare sends a ring of fire in every direction. The fake copies burst into purple sparks', 3.2, 0.2); wait0(4.4);
  }
  // round 5b: the beam clash
  {
    D.act('soulX', 'idle');
    D.place('leon', 1.6, 7.4, P - 0.25); D.act('leon', 'powerFist'); D.face('flare', P + 0.15, 0.2);
    D.cam(FIX([6.5, 1.3, 6.0], [-0.2, 1.5, 5.6], { fov: 56 }));
    D.sound('Flare and Leon attack together', 1.6, 0.2); wait0(0.8);
    D.act('flare', 'blastPose'); D.fx('beam', { who: 'flare', side: 'R', to: [-0.15, 1.5, 5.4], dur: 4.6, width: 0.24, color: 0xff7a20 }); D.sfx('fireRoar', 0, 0.9);
    D.fx('beam', { who: 'leon', side: 'R', to: [0.15, 1.5, 5.4], dur: 4.4, width: 0.2, color: 0xf2b632 }, 0.2); D.sfx('energyCharge', 0.2, 0.8);
    D.act('soulX', 'soulBlast', 0.3); D.fx('beam', { who: 'soulX', side: 'R', to: [0, 1.5, 5.4], dur: 4.2, width: 0.24, color: 0xb050ff }, 0.4); D.sfx('beamFire', 0.4, 0.8);
    for (let i = 0; i < 7; i++) D.fx('sparks', { x: 0, y: 1.5, z: 5.4, n: 30, color: i % 2 ? 0xffa040 : 0xc070ff, speed: 3 }, 0.6 + i * 0.5);
    D.fx('flashBurst', { x: 0, y: 1.5, z: 5.4, dur: 3.6, radius: 1.0, color: 0xffd0ff, light: 30 }, 0.6); D.shake(0.3, 3.4, 0.6);
    wait0(1.8);
    D.cam(R('flare', 20, 1.7, 0.15, { fov: 42 }));
    D.sound('Fire and gold against purple. Neither side gives an inch', 2.6, 0.1); wait0(1.6);
    D.cam(R('soulX', 20, 1.7, 0.1, { fov: 42 }));
    wait0(1.4);
    D.fx('flashBurst', { x: 0, y: 1.5, z: 5.4, dur: 0.8, radius: 3.4, color: 0xffffff, light: 90 }); D.fx('sphere', { x: 0, y: 1.5, z: 5.4, radius: 7, dur: 0.8, color: 0xffb070 });
    D.sfx('bigBlast', 0, 1.0); D.shake(1.4, 1.0); D.set('flashWhite', 0.6); D.anim('flashWhite', 0, 0.5);
    D.act('flare', 'knockBack', 0.05); D.anim('flare.z', 8.4, 0.5, 0.05, 'out'); D.act('flare', 'getUp', 0.8); D.act('flare', 'ready', 2.2);
    D.act('leon', 'knockBack', 0.05); D.anim('leon.z', 8.6, 0.5, 0.05, 'out'); D.act('leon', 'getUp', 0.8); D.act('leon', 'ready', 2.2);
    D.act('soulX', 'knockBack', 0.05); D.anim('soulX.z', 3.0, 0.5, 0.05, 'out'); D.act('soulX', 'idle', 0.8);
    D.comic('KA-POW!', 0, 1.0, { x: 0.5, y: 0.34, size: 120, rot: -5, c1: '#ffffff', c2: '#ffb045' });
    D.cam(FIX([-6.5, 2.2, 9.5], [0, 1.2, 5.2], { fov: 62 }));
    D.sound('The clash explodes and throws everyone back', 2.4, 0.1); wait0(2.8);
  }
  // round 5c: now you see him...
  {
    const spots = [[-3.6, 6.4, 1.2], [3.6, 6.6, -1.2], [0, 10.2, P]];
    let prev = pos('soulX');
    spots.forEach(([x, z, ry], i) => {
      const dt = 0.3 + i * 0.9;
      D.fx('flashBurst', { x: prev[0], y: 1.2, z: prev[1], dur: 0.4, radius: 1.2, color: 0xa040ff, light: 20 }, dt); prev = [x, z];
      D.place('soulX', x, z, ry, dt); D.fx('flashBurst', { x, y: 1.2, z, dur: 0.4, radius: 1.2, color: 0xa040ff, light: 20 }, dt + 0.05); D.sfx('teleport', dt, 0.5);
    });
    D.faceTo('flare', -3.6, 6.4, 0.2, 0.4); D.faceTo('flare', 3.6, 6.6, 0.2, 1.3); D.faceTo('flare', 0, 10.2, 0.2, 2.2);
    D.cam(FIX([0, 4.0, 1.4], [0, 1.0, 8.0], { fov: 64 }));
    D.sound('He teleports left... right... behind them! Flare spins, trying to keep up', 3.2, 0.2); wait0(4.2);
    D.fx('flashBurst', { x: 0, y: 1.2, z: 10.2, dur: 0.4, radius: 1.2, color: 0xa040ff, light: 20 });
    D.place('soulX', 0, 4.0, 0);
    D.fx('flashBurst', { x: 0, y: 1.2, z: 4.0, dur: 0.4, radius: 1.2, color: 0xa040ff, light: 20 }); D.sfx('teleport', 0, 0.5);
  }
  // round 6: Leon's time field, the shockwave
  {
    D.place('leon', 1.3, 6.0, P); D.act('leon', 'powerFist'); D.anim('leon.field', 1, 0.4); D.sfx('timeStop', 0, 0.8); D.set('freezeTint', 0.8); D.anim('freezeTint', 0, 2.6, 0.4);
    D.act('soulX', 'soulBlock');
    D.cam(FIX([4.5, 1.6, 7.8], [0.6, 1.4, 4.6], { fov: 52 }));
    D.sound('Leon’s purple time field slows everything down', 2.2, 0.2); wait0(2.4);
    D.act('leon', 'groundPound'); D.fx('ring', { x: 1.0, y: 0.15, z: 5.0, radius: 7, dur: 0.9, color: 0xf2b632 }, 0.35); D.fx('dustCloud', { x: 1.0, y: 0, z: 5.0, n: 50, dur: 2.5, radius: 3.5, size: 0.8 }, 0.35);
    D.sfx('shockwave', 0.35, 1.0); D.shake(1.2, 0.8, 0.35); D.anim('leon.field', 0, 0.3, 0.4);
    D.set('power.dmg2', 1, 0.4);
    D.act('soulX', 'knockBack', 0.4); D.anim('soulX.x', 3.8, 0.8, 0.4, 'out'); D.anim('soulX.z', -3.4, 0.8, 0.4, 'out'); D.anim('soulX.y', 0.8, 0.4, 0.4, 'out'); D.anim('soulX.y', 0, 0.4, 0.8, 'in');
    D.set('console.sparks', 1, 1.2); D.set('console.sparks', 0, 3.0); D.fx('sparks', { x: 4.4, y: 1.3, z: -5.6, n: 70, color: 0xffd080, speed: 4 }, 1.2); D.sfx('electricSlam', 1.2, 0.7);
    D.comic('BOOOM!', 0.35, 1.1, { x: 0.5, y: 0.33, size: 120, rot: -5, c1: '#fff6a0', c2: '#f2b632' });
    D.cam(FIX([-4.0, 2.4, 10.0], [2.0, 1.0, 0.5], { fov: 60 }));
    D.sound('Leon punches the floor. The shockwave throws the Soul Stealer into the console', 3.0, 0.3); wait0(3.4);
    D.act('soulX', 'hurtKneel');
  }
  // round 6b: a ring of fire
  {
    const tf = D.path('flare', [[1.0, 1.6]], 5.0); D.faceTo('flare', 3.8, -3.4, 0.2, tf); D.act('flare', 'blastPose', tf);
    D.fx('fireCircle', { x: 3.8, z: -3.4, radius: 1.5, dur: 3.4, size: 0.6, light: 30 }, tf + 0.2); D.sfx('fireRoar', tf + 0.2, 0.9); D.sfx('fireCrackle', tf + 0.4, 0.6);
    D.cam(FIX([-1.5, 2.6, 2.5], [3.6, 0.8, -3.2], { fov: 54 }));
    D.sound('Flare traps him inside a ring of fire', 2.2, tf); wait0(tf + 2.6);
    D.act('flare', 'ready');
  }
  // round 7: he gets angry
  {
    D.act('soulX', 'soulRaiseBoth', 1.0); D.expr('soulX', 'angry'); D.anim('soulX.eyeGlow', 4.5, 1.0); D.sfx('heartbeat', 0.2, 0.7);
    D.cam(R('soulX', 0, 2.2, 0.2, { lookY: -0.2, fov: 46 }));
    D.sound('He rises slowly, eyes blazing', 2.0, 0.2); D.wait(2.4);
    for (const c of ['flare', 'leon']) { D.act(c, 'struggle', 0.2); D.anim(`${c}.y`, 1.3, 1.4, 0.2, 'out'); D.fx('bodyAura', { who: c, dur: 3.4, color: 0xa040ff, power: 1.0 }, 0.2); }
    D.sfx('magicFloat', 0.2, 0.8); D.sfx('mindControl', 0.4, 0.6);
    D.cam(FIX([-7.0, 1.5, 10.8], [0.5, 1.8, 5.6], { fov: 62 }));
    D.sound('Purple energy lifts Flare and Leon right off the floor', 2.6, 0.3); wait0(3.4);
    D.fx('sphere', { x: 3.8, y: 1.2, z: -3.4, radius: 16, dur: 1.2, color: 0xa040ff });
    D.fx('flashBurst', { x: 3.8, y: 1.5, z: -3.4, dur: 0.9, radius: 4, color: 0xc070ff, light: 80 });
    D.sfx('darkBlast', 0, 1.0); D.sfx('bigBlast', 0.05, 0.8); D.shake(1.8, 1.4); D.set('flashViolet', 0.5); D.anim('flashViolet', 0, 0.6);
    for (const [c, dx, dz] of [['aaron', 1.8, 2.4], ['flare', -2.2, 2.4], ['leon', 0.8, 2.6]]) { const [x, z] = pos(c); D.act(c, 'knockBack', 0.15); D.anim(`${c}.x`, x + dx, 0.7, 0.15, 'out'); D.anim(`${c}.z`, Math.min(z + dz, 10.6), 0.7, 0.15, 'out'); D.anim(`${c}.y`, 0, 0.6, 0.15, 'in'); D.act(c, 'lieBack', 0.9); }
    D.anim('power.dim', 0.65, 0.6, 0.3); D.set('power.alarm', 1, 0.6); D.sfx('alarmKlaxon', 0.8, 0.5);
    D.comic('KA-BOOOM!', 0, 1.3, { x: 0.5, y: 0.35, size: 130, rot: 4, c1: '#ffffff', c2: '#c060ff' });
    D.cam(FIX([0, 5.6, 11.0], [1.5, 0.8, 1.0], { fov: 68 }));
    D.sound('A huge wave of purple energy knocks all three heroes off their feet', 3.0, 0.3); wait0(3.6);
  }
  // everything goes quiet
  {
    D.sfx('heartbeatSlow', 0, 0.8); D.music('epic', 0.18, 0, 0.8);
    const [fx, fz] = pos('flare');
    D.cam(FIX([fx + 1.4, 0.45, fz - 1.2], [fx - 0.2, 0.3, fz + 0.2], { fov: 46 }));
    D.sound('Everything goes quiet. Flare can barely lift her head', 2.8, 0.3); wait0(3.6);
    D.cam(FIX([fx + 0.6, 0.35, fz - 0.4], [1.4, 1.4, 0.0], { fov: 50 }));
    D.sound('Through the smoke, she sees him standing over them', 2.4, 0.2); wait0(3.0);
    D.music('epic', 0.46, 0, 0.6);
  }
  // round 8: he goes for the core
  {
    D.act('soulX', 'idle'); D.expr('soulX', 'smug');
    D.path('soulX', [[1.6, -1.4]], 1.0);
    D.cam(FIX([-5.0, 0.6, 8.0], [1.5, 1.6, -2.0], { fov: 50 }));
    D.sound('The Soul Stealer walks toward the core', 1.8, 0.3); D.wait(2.6);
    D.face('soulX', P + 0.25, 0.3); D.act('soulX', 'soulReach', 0.2);
    D.set('dome.flicker', 1, 0.6); D.anim('dome.hit', 1, 0.15, 0.6); D.anim('dome.hit', 0, 0.4, 0.75); D.sfx('electricSlam', 0.6, 0.7);
    D.anim('dome.on', 0, 0.4, 1.6); D.set('dome.flicker', 0, 2.0); D.fx('sparks', { x: 1.2, y: 1.6, z: -2.2, n: 80, color: 0x7fd4ff, speed: 4 }, 1.6); D.sfx('glassShatter', 1.6, 0.8);
    D.cam(FIX([4.5, 1.8, 1.5], [0.6, 1.8, -3.2], { fov: 52 }));
    D.sound('He tears through the core shield', 2.0, 0.6); wait0(2.8);
    {
      const [fx, fz] = pos('flare');
      D.act('flare', 'oneHandBlast', 0.3); fireball([fx + 0.2, 0.5, fz - 0.4], [1.3, 1.4, -1.6], 0.3, 0.6, 0.6);
      D.fx('smoke', { x: 1.3, y: 1.4, z: -1.4, n: 16, dur: 1.4, color: 0x4a3a3a, color2: 0x2a2a2a }, 0.9); D.sfx('energyFizzle', 0.9, 0.6);
      D.act('flare', 'lieBack', 1.6);
      D.cam(FIX([fx + 1.2, 0.6, fz + 1.0], [1.3, 1.2, -1.6], { fov: 46 }));
      D.sound('From the floor, Flare throws one last tiny fireball. It fizzles out before it reaches him', 3.2, 0.2); wait0(3.6);
    }
    D.path('soulX', [[0.6, -4.2]], 1.2);
    D.act('soulX', 'soulReach', 0.9);
    D.fx('beam', { who: 'soulX', side: 'R', to: [0, 3.0, -6], dur: 7.0, width: 0.16, color: 0xb050ff }, 1.0);
    D.anim('core.purple', 0.75, 4.0, 1.0); D.anim('core.pct', 45, 6.0, 1.0, 'linear'); D.anim('power.purple', 1, 2.0, 1.2); D.anim('horse.glow', 3.0, 1.0, 1.2);
    D.sfx('drainHum', 1.0, 0.9); D.sfx('coreHum', 1.4, 0.6);
    D.cam(FIX([-3.0, 1.4, -0.6], [0.2, 2.6, -5.4], { fov: 50 }));
    D.sound('He puts his hand on the core and starts draining its power', 2.8, 1.0); wait0(4.6);
    D.cam(FIX([0, 3.6, -1.2], [0, 3.4, -6], { fov: 48 }));
    D.sound('Blue turns to purple. The power drops fast', 2.4, 0.2); wait0(3.2);
    {
      const [lx, lz] = pos('leon');
      D.act('leon', 'getUp'); D.act('leon', 'lieBack', 0.9); D.sfx('thud', 1.0, 0.5);
      D.cam(FIX([lx + 1.6, 0.6, lz - 1.4], [lx, 0.4, lz], { fov: 48 }));
      D.sound('Leon tries to push himself up... but he’s too weak', 2.6, 0.2); wait0(3.0);
    }
    {
      D.anim('horse.glow', 0.8, 0.4, 0.2); D.anim('horse.purple', 0.3, 0.3, 0.2); D.anim('horse.purple', 1, 0.5, 1.6); D.anim('horse.glow', 3.0, 0.5, 1.6); D.sfx('crystalHum', 0.2, 0.5);
      D.cam(F(['horse'], 160, 3.2, 0.2, { lookY: -0.3, fov: 44 }));
      D.sound('For just a second, the purple glow around the horse flickers... as if it’s fighting back', 3.0, 0.2); wait0(3.4);
    }
    {
      const [ax, az] = pos('aaron');
      D.cam(FIX([ax - 1.4, 0.5, az + 1.2], [0.4, 2.4, -5.0], { fov: 50 }));
      D.sound('Aaron watches the core meter drop... and gets an idea', 2.6, 0.2); wait0(3.0);
    }
  }
  // Aaron crawls
  {
    const [ax, az] = pos('aaron');
    D.face('aaron', P, 0.2); D.act('aaron', 'lieFront', 0.2); D.anim('aaron.z', az - 1.2, 3.0, 0.4, 'linear');
    D.cam(FIX([ax - 1.8, 0.6, az - 2.6], [ax, 0.3, az - 0.4], { fov: 48 }));
    D.sound('Aaron crawls through the smoke', 2.4, 0.3); wait0(3.4);
  }
  // round 9: Aaron fights back with the console
  {
    D.act('aaron', 'getUp'); D.place('aaron', 5.6, 1.2, 2.6, 0); D.path('aaron', [[4.7, -5.4]], 1.6, 1.2); D.face('aaron', 2.55, 0.3, 3.6); D.act('aaron', 'leanTable', 3.6);
    D.cam(FIX([8.0, 1.0, 1.0], [4.8, 0.9, -4.6], { fov: 50 }));
    D.sound('Aaron drags himself to the console', 2.0, 0.3); wait0(4.2);
    D.fx('bolt', { x: 0.4, y: 0.1, z: -4.4, top: 4.0, dur: 0.35, size: 0.6, color: 0x7fd4ff }, 0.3); D.fx('flashBurst', { x: 0.4, y: 1.6, z: -4.4, dur: 0.6, radius: 2.0, color: 0x7fd4ff, light: 60 }, 0.3);
    D.sfx('electricSlam', 0.3, 1.0); D.shake(0.8, 0.5, 0.3);
    D.act('soulX', 'knockBack', 0.35); D.anim('soulX.z', -1.6, 0.5, 0.35, 'out'); D.act('soulX', 'idle', 1.2);
    D.anim('core.purple', 0.5, 0.6, 0.3); D.anim('core.pct', 40, 0.3, 0.3);
    D.comic('ZZZAP!', 0.3, 1.0, { x: 0.45, y: 0.34, size: 110, rot: -6, c1: '#ffffff', c2: '#7fd4ff' });
    D.cam(FIX([-3.6, 1.6, 1.4], [0.4, 1.6, -3.2], { fov: 54 }));
    D.sound('A burst of electricity throws his hand off the core', 2.2, 0.4); wait0(2.8);
    D.face('soulX', 1.0, 1.2); D.expr('soulX', 'angry'); D.anim('soulX.eyeGlow', 5.0, 1.0);
    D.cam(R('soulX', 0, 1.1, 0.05, { lookY: 0.06, fov: 34, dist2: 0.85 }));
    D.sound('He slowly turns toward Aaron', 1.8, 0.2); D.wait(2.4);
    D.expr('aaron', 'determined'); D.act('aaron', 'ready');
    D.cam(R('aaron', 20, 1.6, 0.1, { fov: 40 })); D.sfx('heartbeat', 0, 0.6);
    D.sound('Aaron stands his ground', 1.6, 0.2); D.wait(2.0);
  }
  D.set('fade', 1); D.sfx('cutBlack', 0, 0.5); wait0(0.6);

  // ===================================================================== SCENE 5: THE CITY'S LAST STAND
  D.scene("5. The City's Last Stand");
  D.location('downtown');
  cast(['greg', 'tiger', 'cowboy', 'titan', 'beh', 'shadow', 'ped1', 'ped2']);
  D.set('sky.mode', 3); D.set('night.purple', 0.5); D.set('citizens.on', 0); D.set('hud.core', 1); D.set('core.pct', 40); D.set('power.purple', 1);
  D.set('carC.vis', 1); D.set('carC.x', -2); D.set('carC.z', -9); D.set('carC.y', 0); D.set('carC.rz', P); D.set('carC.rx', 0); D.set('carC.ry', 0);
  D.set('carD.vis', 1); D.set('carD.x', -24); D.set('carD.z', -6); D.set('carD.y', 0); D.set('carD.rz', -P); D.set('carD.rx', 0); D.set('carD.ry', P);
  D.set('chunk0.vis', 1); D.set('chunk0.x', -9.4); D.set('chunk0.y', 0); D.set('chunk0.z', -6.2); D.set('chunk0.rx', 0.2); D.set('chunk0.ry', 0.6); D.set('chunk0.rz', 0);
  D.set('chunk1.vis', 1); D.set('chunk1.x', -16); D.set('chunk1.y', 0); D.set('chunk1.z', 1.0); D.set('chunk1.rx', 0); D.set('chunk1.ry', 0.3); D.set('chunk1.rz', 0.8);
  D.set('cracks', 1); D.set('cracks.x', -16); D.set('cracks.z', 1); D.set('cracks.size', 6);
  D.place('beh', 0, -20, 0); D.set('beh.s', 10); D.set('beh.rear', 0.5); D.set('beh.look', 0); D.set('beh.shake', 0); D.set('beh.curl', 0);
  D.place('titan', 20, 0.5, -P / 2); D.set('titan.s', 1.25); D.set('titan.eyes', 2.2); D.set('titan.rx', 0);
  D.show('shadow'); D.set('shadow.x', 10); D.set('shadow.z', 26); D.set('shadow.y', 0); D.set('shadow.eyes', 1.5);
  D.place('greg', 2.2, -18.0, -P / 2 - 0.6); D.set('greg.y', 3.6); D.act('greg', 'hoverPull'); D.expr('greg', 'determined');
  D.place('tiger', 2, 16, 0.6); D.set('tiger.s', 2.2); D.set('tiger.act', 'idle');
  D.place('cowboy', 3.0, 9.0, P / 2 + 0.6); D.act('cowboy', 'idle'); D.expr('cowboy', 'determined');
  D.set('carE.vis', 1); D.set('carE.x', 11); D.set('carE.z', 5.2); D.set('carE.y', 0); D.set('carE.ry', 0.2); D.set('carE.rz', 0); D.set('carE.rx', 0);
  D.place('ped1', 10.4, 6.7, P); D.act('ped1', 'crouchHide'); D.expr('ped1', 'scared');
  D.place('ped2', 11.7, 6.9, P); D.act('ped2', 'crouchHide'); D.expr('ped2', 'scared');
  D.music('action', 0.42, 0, 0.3);
  D.anim('fade', 0, 0.4);
  D.cam(FIX([-24, 9, 30], [4, 4, -4], { pos2: [-22, 9.5, 28], fov: 56 }));
  D.sfx('siren', 0, 0.3); D.sfx('citizensPanic', 0.4, 0.4);
  D.sound('Smoke, sirens and falling buildings. The city is in big trouble', 3.0, 0.3); wait0(3.6);
  // Greg wraps Behemoth... and gets thrown
  {
    D.set('greg.wrapU', 0.6); D.anim('greg.stretch', 1, 0.6); D.anim('greg.wrap', 1, 1.0, 0.2); D.sfx('stretchBoing', 0, 0.9);
    D.cam(FIX([9, 3.4, -9], [0.5, 2.6, -18.5], { fov: 54 }));
    D.card('location', 3.0, { text: 'MEANWHILE, IN THE CITY...' });
    D.sound('Greg wraps his arms around Behemoth again...', 2.4, 0.3); D.wait(2.8);
    D.anim('beh.shake', 1, 0.4); D.anim('beh.curl', 0.4, 0.8); D.anim('beh.look', 0.7, 0.5); D.anim('beh.look', -0.8, 0.5, 0.5); D.sfx('monsterRoar', 0, 0.8);
    D.anim('greg.wrap', 0, 0.3, 1.0); D.anim('greg.stretch', 0, 0.3, 1.0); D.act('greg', 'flail', 1.0);
    fly('greg', -10.5, 6.5, -9.5, 0.7, 1.0, 'out'); fly('greg', -11, 0.2, -9, 0.4, 1.7, 'in'); D.act('greg', 'lieBack', 2.1);
    D.set('rubble0.vis', 1, 2.1); D.set('rubble0.x', -11); D.set('rubble0.z', -9.4);
    D.fx('dustCloud', { x: -11, y: 0, z: -9, n: 60, dur: 3, radius: 3, size: 0.9 }, 2.1); D.fx('debris', { x: -11, y: 1, z: -9, n: 50 }, 2.1); D.sfx('buildingFall', 2.0, 0.6); D.sfx('thud', 2.1, 0.9); D.shake(0.8, 0.6, 2.1);
    D.anim('beh.shake', 0, 0.4, 1.4); D.anim('beh.curl', 0, 0.8, 1.4);
    D.cam(FIX([-3, 2.0, -0.5], [-7, 4, -12], { fov: 60 }), 0.9);
    D.sound('...but Behemoth thrashes and throws him into a building', 2.6, 0.9); wait0(4.2);
  }
  D.say('greg', 'Ow. Okay... that one hurt.', { cam: R('greg', 0, 2.0, 0.6, { lookY: -0.6, fov: 46 }), expr: 'tired', dur: 1.8 });
  D.act('greg', 'getUp'); D.sfx('stretchBoing', 0.4, 0.6); D.act('greg', 'brushOff', 1.6);
  D.cam(R('greg', 20, 2.4, 0.3, { fov: 46 })); D.sound('Greg pops back up and brushes himself off', 2.2, 0.2); D.wait(2.6);
  D.say('greg', 'Good thing I bounce.', { expr: 'grin', dur: 1.2 });
  D.act('greg', 'idle');
  {
    D.set('tiger.act', 'roar'); D.sfx('tigerRoar', 0, 1.0); D.anim('shadow.lean', 0.3, 0.6, 0.3); D.anim('shadow.eyes', 2.2, 0.4, 0.3);
    D.cam(FIX([-6, 1.6, 9], [4, 4, 22], { fov: 58 }));
    D.sound('Eric roars to pull the shadow creature away from the people', 2.4, 0.2); wait0(2.8);
    D.set('tiger.act', 'idle'); D.anim('shadow.lean', 0, 0.4);
  }
  // the shadow throws Eric
  {
    D.anim('shadow.swipeL', 1, 0.4, 0.3, 'in'); D.anim('shadow.swipeL', 0, 0.6, 0.8); D.sfx('shadowWhoosh', 0.3, 0.8);
    D.set('tiger.act', 'tumble', 0.6); fly('tiger', -6, 0, 19.5, 0.9, 0.6, 'out'); D.sfx('punchHit', 0.6, 0.9); D.sfx('thud', 1.5, 0.8);
    D.cam(FIX([-10, 2.2, 10], [2, 3, 20], { fov: 60 }));
    D.sound('The shadow creature swats Eric across the plaza', 2.2, 0.2); wait0(2.4);
    D.set('flashWhite', 0.4); D.anim('flashWhite', 0, 0.4); D.sfx('transform', 0, 0.7);
    D.hide('tiger', 0.05); D.show('eric', 0.05); D.place('eric', -6, 19.5, 0.8, 0.05); D.act('eric', 'lieBack', 0.05); D.expr('eric', 'tired', 0.05);
    D.cam(FIX([-3.6, 1.0, 17.2], [-6, 0.4, 19.5], { fov: 48 }));
    D.sound('He turns back into his normal self', 1.8, 0.3); D.wait(2.0);
  }
  D.say('eric', "I can't... hold him much longer!", { cam: FIX([-4.4, 1.5, 17.8], [-6.0, 0.35, 19.5], { fov: 46 }), dur: 1.9 });
  {
    const tw = D.path('cowboy', [[-4.9, 18.6]], 4.5); D.faceChar('cowboy', 'eric', 0.3, tw); D.act('cowboy', 'kneelPick', tw);
    D.cam(FIX([-8.6, 1.4, 15.2], [-5.0, 0.7, 19.0], { fov: 50 }));
    D.sound('Fred runs over to help him up', 2.0, 0.3); wait0(tw + 1.2);
    D.act('eric', 'getUp'); D.act('cowboy', 'idle', 0.4); D.act('eric', 'idle', 1.6); D.faceChar('eric', 'cowboy', 0.3, 1.6);
    wait0(2.0);
  }
  D.say('cowboy', "Up you get, kid. We're not done yet.", { ...FRED, cam: R('cowboy', 25, 1.8, 0.05, { lookY: -0.05, fov: 40 }), dur: 2.0 });
  D.say('eric', 'Fred... you sound just like Greg.', { cam: R('eric', 25, 1.8, 0.1), expr: 'happy', dur: 1.8 });
  D.say('cowboy', "I'll take that as a compliment.", { ...FRED, cam: R('cowboy', 25, 1.8, 0.05, { lookY: -0.05, fov: 40 }), expr: 'grin', dur: 1.6 });
  D.place('cowboy', 3.0, 9.0, P / 2 + 0.6); D.act('cowboy', 'idle'); D.expr('cowboy', 'determined');
  D.place('eric', -4.6, 18.4, 2.4); D.act('eric', 'catchBreath');
  // the titan goes after the people behind the car
  {
    D.face('titan', -P / 2 - 0.35, 0.5); D.anim('titan.upR', 1, 1.0, 0.3); D.anim('titan.lean', 0.2, 1.0, 0.3); D.sfx('titanRoar', 0.3, 0.7);
    D.cam(FIX([4, 0.8, 11], [14, 10, 2], { fov: 62 }));
    D.sound('The titan raises its fist over a car. Two people are hiding behind it', 3.0, 0.2); wait0(3.0);
    D.say('ped1', 'HELP US!', { label: 'CITIZEN', cam: FIX([8.6, 1.0, 9.0], [11, 0.9, 6.4], { fov: 50 }), dur: 1.0, gap: 0.1 });
    D.faceTo('cowboy', 14, 3, 0.25); D.act('cowboy', 'lassoThrow'); D.set('lasso.target', 'titanR'); D.anim('lasso.on', 1, 0.4); D.set('lasso.r', 0.9); D.sfx('lassoWhip', 0, 0.8); D.sfx('lassoZap', 0.3, 0.6);
    D.cam(FIX([-1.6, 1.2, 12.5], [9, 7, 2], { fov: 58 }));
    D.sound('Fred lassos the titan’s arm!', 1.8, 0.3); wait0(1.6);
    D.act('cowboy', 'lassoPull'); D.anim('titan.upR', 0.75, 0.6); D.anim('titan.lean', 0, 0.6);
    D.path('ped1', [[2, 9], [-8, 14]], 4.5, 0.5); D.path('ped2', [[3, 10], [-7, 15.5]], 4.5, 0.7); D.act('ped1', 'idle', 0.5); D.act('ped2', 'idle', 0.7); D.expr('ped1', 'shocked', 0.5); D.expr('ped2', 'shocked', 0.7);
    D.cam(R('cowboy', 35, 2.3, 0.05, { lookY: -0.05, fov: 44 }));
    wait0(0.6);
  }
  D.say('ped1', 'THANK YOU, COWBOY!', { label: 'CITIZEN', dur: 1.3 });
  D.set('lasso.flicker', 1); D.sfx('lassoZap', 0, 0.6); D.sfx('bzzt', 0.4, 0.5);
  D.say('cowboy', 'Come on... hold!', { ...FRED, cam: R('cowboy', 25, 1.8, 0.05, { lookY: -0.05, fov: 40 }), expr: 'angry', dur: 1.4 });
  {
    D.anim('lasso.on', 0, 0.15, 0.2); D.set('lasso.flicker', 0, 0.4); D.fx('sparks', { x: 3.0, y: 1.4, z: 9.0, n: 60, color: 0x7fe0ff, speed: 3.5 }, 0.2); D.sfx('electricSlam', 0.2, 0.8);
    D.act('cowboy', 'knockBack', 0.25); D.anim('cowboy.x', 1.4, 0.6, 0.25, 'out'); D.anim('cowboy.z', 10.6, 0.6, 0.25, 'out'); D.act('cowboy', 'lieBack', 0.9); D.sfx('thud', 0.8, 0.7);
    D.anim('titan.upR', 0, 0.35, 0.5, 'in'); D.anim('titan.reachR', 0.55, 0.35, 0.5, 'in'); D.anim('titan.lean', 0.5, 0.35, 0.5, 'in');
    D.anim('carE.rz', 2.6, 0.5, 0.8); D.anim('carE.x', 8, 0.5, 0.8); D.anim('carE.z', 8.5, 0.5, 0.8); D.sfx('metalCrash', 0.8, 1.0); D.fx('dustCloud', { x: 10, y: 0, z: 6, n: 50, dur: 3, radius: 3, size: 0.8 }, 0.8); D.shake(1.0, 0.6, 0.8);
    D.comic('SNAP!', 0.2, 0.8, { x: 0.36, y: 0.32, size: 100, rot: -8, c1: '#ffffff', c2: '#7fe0ff' }); D.comic('SMASH!', 0.85, 1.0, { x: 0.62, y: 0.36, size: 115, rot: 6, c1: '#ffffff', c2: '#ff8a45' });
    D.cam(FIX([-5, 2.2, 14], [8, 3, 4], { fov: 60 }));
    D.sound('The lasso snaps. The titan smashes the empty car', 2.6, 0.3); wait0(3.0);
    D.anim('titan.reachR', 0, 0.8); D.anim('titan.lean', 0, 0.8); D.set('lasso.target', 'none');
  }
  // Greg holds up a falling piece of building
  {
    D.show('ped1'); D.show('ped2'); D.place('ped1', -7.6, 14.6, 0.3); D.place('ped2', -6.6, 15.4, 0.1); D.act('ped1', 'cover'); D.act('ped2', 'cover'); D.expr('ped1', 'scared'); D.expr('ped2', 'scared');
    D.place('greg', -7.0, 12.4, 0.2); D.set('greg.y', 0); D.act('greg', 'stretchArms'); D.expr('greg', 'determined');
    D.set('chunk2.vis', 1); D.set('chunk2.x', -7.2); D.set('chunk2.y', 26); D.set('chunk2.z', 14.8); D.set('chunk2.rx', 0.2); D.set('chunk2.ry', 0.5); D.set('chunk2.rz', 0.1);
    D.set('greg.tLx', -8.0); D.set('greg.tLy', 3.5); D.set('greg.tLz', 14.4); D.set('greg.tRx', -6.4); D.set('greg.tRy', 3.5); D.set('greg.tRz', 14.6); D.set('greg.sag', 0); D.set('greg.bendL', 0.2); D.set('greg.bendR', -0.2);
    D.anim('chunk2.y', 4.6, 1.0, 0, 'in'); D.anim('greg.stretch', 1, 0.4, 0.6); D.sfx('buildingFall', 0, 0.7); D.sfx('stretchBoing', 0.6, 0.8); D.sfx('thud', 1.0, 0.8); D.shake(0.6, 0.4, 1.0);
    D.anim('chunk2.y', 4.3, 0.3, 1.0, 'out');
    D.cam(FIX([-1.5, 1.2, 9.5], [-7.0, 3.0, 14.4], { fov: 58 }));
    D.sound('A piece of building falls toward two people. Greg catches it just in time!', 3.2, 0.2); wait0(3.6);
  }
  D.say('greg', "RUN! I've got it!", { cam: FIX([-4.6, 1.6, 10.6], [-7.0, 1.8, 12.6], { fov: 48 }), expr: 'angry', dur: 1.2 });
  {
    D.act('ped1', 'runScared'); D.act('ped2', 'runScared'); D.path('ped1', [[-2, 12], [6, 16]], 4.5); D.path('ped2', [[-1, 13.5], [6, 17.5]], 4.5, 0.2); D.hide('ped1', 3.0); D.hide('ped2', 3.2);
    D.anim('chunk2.x', -15, 0.8, 1.6, 'out'); D.anim('chunk2.y', 0, 0.8, 1.6, 'in'); D.anim('chunk2.rz', 1.6, 0.8, 1.6); D.anim('greg.stretch', 0, 0.4, 1.6); D.act('greg', 'idle', 2.1);
    D.fx('dustCloud', { x: -15, y: 0, z: 14.8, n: 50, dur: 3, radius: 3, size: 0.9 }, 2.4); D.sfx('buildingFall', 2.3, 0.8); D.shake(0.6, 0.5, 2.4);
    D.cam(FIX([-1.0, 2.2, 8.0], [-9, 1.6, 14.4], { fov: 60 }));
    D.sound('The people get away. Greg tosses the rubble aside', 2.6, 0.2); wait0(3.4);
  }
  // regroup in the plaza
  D.place('greg', -1.4, 12.2, P * 0.75); D.set('greg.y', 0); D.act('greg', 'catchBreath'); D.expr('greg', 'tired');
  D.place('eric', 0.6, 13.4, P * 0.95); D.act('eric', 'catchBreath'); D.expr('eric', 'tired');
  D.place('cowboy', 1.8, 11.8, P * 1.15); D.act('cowboy', 'idle'); D.expr('cowboy', 'serious');
  D.hide('ped1'); D.hide('ped2');
  D.music('tense', 0.34, 0, 0.6);
  D.cam(FIX([-4.5, 2.6, 7.0], [0.4, 1.2, 12.6], { pos2: [-4.0, 2.4, 7.6], fov: 50 }));
  D.sound('The three of them regroup in the plaza, out of breath', 2.6, 0.3); D.wait(3.0);
  D.act('greg', 'idle');
  D.say('greg', "These guys don't get tired!", { cam: R('greg', 20, 2.0, 0.15), act: 'armsOut', expr: 'annoyed', dur: 1.6 });
  D.act('greg', 'idle');
  D.say('eric', "Neither do we!", { cam: R('eric', 20, 2.0, 0.15), act: 'fistPump', expr: 'determined', dur: 1.2 });
  D.act('eric', 'catchBreath');
  D.say('eric', '...Okay, maybe a little.', { expr: 'tired', dur: 1.4 });
  D.say('cowboy', "And my lasso is getting weaker. It runs on my energy... and I'm running out.", { ...FRED, cam: R('cowboy', 20, 1.9, 0.05, { lookY: -0.05, fov: 40 }), expr: 'worried', dur: 3.2 });
  D.say('greg', 'Aaron would know what to do.', { cam: R('greg', 20, 2.0, 0.15), expr: 'thinking', dur: 1.6 });
  D.say('eric', "Aaron isn't here. So WE have to be the smart ones.", { cam: R('eric', 20, 2.0, 0.15), expr: 'determined', dur: 2.2 });
  D.say('greg', '...Uh oh.', { cam: R('greg', 20, 1.8, 0.15, { fov: 40 }), expr: 'worried', dur: 1.0 });
  D.say('cowboy', "You know... where I come from, I always had to fight alone. It's nice. Not being alone.", { ...FRED, cam: R('cowboy', 20, 1.9, 0.05, { lookY: -0.05, fov: 40 }), expr: 'happy', dur: 3.4 });
  D.say('eric', "You're never alone with us, Fred.", { cam: R('eric', 20, 2.0, 0.15), expr: 'happy', dur: 1.8 });
  D.look('cowboy', 0, 0.2, 0.6);
  D.say('cowboy', "Their power isn't theirs. It's coming from the Soul Stealer. I can feel it through my horse.", { ...FRED, cam: R('cowboy', 20, 1.9, 0.05, { lookY: -0.05, fov: 40 }), dur: 4.0 });
  D.look('cowboy', 0, 0, 0.4);
  D.say('greg', 'So if Aaron and the guys stop him down there...', { cam: R('greg', 20, 2.0, 0.15), expr: 'thinking', dur: 2.2 });
  D.say('cowboy', '...these monsters lose their power.', { ...FRED, cam: R('cowboy', 20, 1.9, 0.05, { lookY: -0.05, fov: 40 }), dur: 1.9 });
  D.expr('greg', 'determined');
  D.say('greg', 'Then we buy them time. Together. On three.', { cam: R('greg', 20, 2.0, 0.15), act: 'point', dur: 2.2 });
  everyone((c) => { D.expr(c, 'determined'); D.act(c, 'ready'); }, ['greg', 'eric']);
  D.say('eric', 'Wait. Do we go ON three, or AFTER three?', { cam: R('eric', 20, 2.0, 0.15), expr: 'thinking', dur: 2.0 });
  D.say('greg', 'ON three!', { cam: R('greg', 20, 2.0, 0.15), expr: 'annoyed', dur: 0.8 });
  D.expr('eric', 'determined');
  D.say('eric', 'One...', { cam: R('eric', 20, 2.0, 0.15), dur: 0.8 });
  D.say('cowboy', 'Two...', { ...FRED, cam: R('cowboy', 20, 1.9, 0.05, { lookY: -0.05, fov: 40 }), dur: 0.8 });
  D.say('greg', 'THREE!', { cam: R('greg', 20, 2.0, 0.15, { fov: 44 }), act: 'fistPump', dur: 0.8 });
  // teamwork: the titan goes down
  {
    D.place('titan', 17, 1.0, -P / 2); D.set('titan.upR', 0); D.set('titan.reachR', 0); D.set('titan.lean', 0); D.set('titan.rx', 0);
    D.set('flashWhite', 0.5); D.anim('flashWhite', 0, 0.4); D.sfx('transform', 0, 0.9);
    D.hide('eric', 0.05); D.show('tiger', 0.05); D.place('tiger', 0.6, 14, P / 2, 0.05); D.set('tiger.s', 1.0, 0.05); D.anim('tiger.s', 3.4, 1.2, 0.1, 'out'); D.set('tiger.act', 'roar', 0.4); D.sfx('growRumble', 0.1, 0.8); D.sfx('tigerRoar', 0.5, 1.0);
    D.cam(FIX([-6, 1.2, 22], [1, 4, 14], { fov: 58 }));
    D.sound('Eric turns into a GIANT tiger', 2.0, 0.3); wait0(2.8);
    D.set('tiger.act', 'idle');
    D.act('cowboy', 'lassoTwirl'); D.set('lasso.twirl', 1); D.anim('lasso.on', 1, 0.3); D.sfx('lassoTwirl', 0, 0.7);
    D.cam(R('cowboy', 30, 2.6, 0.3, { lookY: 0.2, fov: 46 }));
    wait0(1.2);
    D.set('lasso.twirl', 0); D.act('cowboy', 'lassoThrow'); D.set('lasso.x', 16.4); D.set('lasso.y', 2.4); D.set('lasso.z', 1.0); D.set('lasso.r', 2.4); D.set('lasso.flat', 1); D.sfx('lassoWhip', 0, 0.8);
    D.act('greg', 'fly'); fly('greg', 8, 9, 3, 0.8, 0.3, 'out'); D.act('greg', 'stretchArms', 1.1);
    D.set('greg.tLx', 15.5); D.set('greg.tLy', 13.5); D.set('greg.tLz', -2.6); D.set('greg.tRx', 15.5); D.set('greg.tRy', 13.5); D.set('greg.tRz', 4.6); D.set('greg.sag', -0.3); D.set('greg.bendL', 0.4); D.set('greg.bendR', -0.4);
    D.anim('greg.stretch', 1, 0.6, 1.1); D.sfx('stretchBoing', 1.1, 0.9);
    D.cam(FIX([2, 3.0, 18], [13, 7, 1], { fov: 62 }));
    D.sound('Fred’s lasso loops around the titan’s legs. Greg’s arms wrap around its arms', 3.2, 0.2); wait0(4.2);
    D.set('tiger.act', 'leap'); fly('tiger', 12.0, 6.5, 2.0, 0.7, 0, 'out'); D.sfx('tigerRoar', 0, 1.0); D.sfx('whoosh', 0.1, 0.9);
    D.anim('titan.rx', -1.5, 1.4, 0.6, 'in'); D.anim('titan.roar', 1, 0.3, 0.6); D.sfx('titanRoar', 0.6, 0.8);
    D.anim('lasso.on', 0, 0.3, 0.8); D.anim('greg.stretch', 0, 0.4, 0.9); D.act('greg', 'hover', 1.3);
    fly('tiger', 15, 0, 4.5, 1.0, 0.8, 'in'); D.set('tiger.act', 'crouch', 1.8);
    D.cam(FIX([2, 1.6, 22], [16, 5, 0], { fov: 64 }));
    D.sound('Eric leaps onto its chest... and the titan topples over!', 2.6, 0.2); wait0(2.0);
    D.fx('dustCloud', { x: 26, y: 0, z: 1, n: 120, dur: 5, radius: 9, size: 1.6, h: 3.5, color: 0xa8a0a0, color2: 0x8a8088 }); D.fx('debris', { x: 26, y: 1, z: 1, n: 80, spread: 2 });
    D.sfx('bigBlast', 0, 1.0); D.sfx('buildingFall', 0.1, 0.8); D.shake(2.0, 1.6); D.anim('titan.roar', 0, 0.4);
    D.comic('KA-THOOOM!', 0, 1.3, { x: 0.5, y: 0.35, size: 130, rot: -4, c1: '#ffffff', c2: '#ffb045' });
    wait0(2.4);
  }
  D.place('greg', 6, 9.0, P / 2); D.set('greg.y', 2.5); D.act('greg', 'hover'); D.expr('greg', 'grin');
  D.say('eric', 'WE DID IT!', { ...TIGER, cam: FIX([21, 6.5, 9.5], [15, 3.4, 4.5], { fov: 48 }), dur: 1.1 });
  D.say('eric', 'Did you see that? I knocked down a GIANT!', { ...TIGER, dur: 1.9 });
  D.say('greg', 'WOOHOO!', { cam: R('greg', 20, 2.4, 0.1, { lookY: -0.2 }), act: 'cheer', dur: 0.9 });
  D.say('cowboy', "Yeehaw! Now THAT'S teamwork!", { ...FRED, cam: R('cowboy', 25, 2.0, 0.05, { lookY: -0.05, fov: 42 }), act: 'fistPump', expr: 'grin', dur: 1.6 });
  D.act('cowboy', 'idle');
  {
    D.anim('titan.eyes', 3.5, 0.6); D.sfx('blackPulse', 0, 0.8); D.sfx('rumbleDeep', 0.4, 0.7);
    D.anim('titan.rx', 0, 2.2, 0.8, 'inout'); D.sfx('titanStep', 2.8, 1.0); D.shake(0.8, 0.6, 2.8);
    D.set('tiger.act', 'idle'); fly('tiger', 8, 0, 12.5, 0.8, 0.3);
    D.expr('greg', 'shocked'); D.act('greg', 'hover');
    D.cam(FIX([-2, 2.4, 6], [18, 7, 1], { fov: 56 }));
    D.sound('The titan’s eyes flare brighter. It slowly gets back up', 2.6, 0.3); wait0(3.6);
    D.anim('shadow.x', 6, 3.0, 0); D.anim('shadow.z', 20, 3.0, 0); D.anim('shadow.eyes', 2.5, 1.0); D.sfx('shadowWhoosh', 0.5, 0.7);
    D.cam(FIX([-2, 1.4, 6], [6, 6, 22], { fov: 58 }));
    D.sound('And the shadow creature closes in behind them', 2.2, 0.2); wait0(2.8);
  }
  D.say('eric', 'Oh, come ON!', { ...TIGER, cam: F(['tiger'], 200, 7.0, 0.5, { lookY: -0.8, fov: 48 }), dur: 1.1 });
  D.say('greg', 'Is it just me, or did it get BIGGER?', { cam: R('greg', 20, 2.4, 0.1, { lookY: -0.2 }), expr: 'shocked', dur: 1.8 });
  D.place('cowboy', 2.4, 10.6, P / 2); D.act('cowboy', 'idle'); D.expr('cowboy', 'worried');
  D.anim('core.pct', 30, 2.0);
  D.say('cowboy', "They're getting stronger... he's taking more power!", { ...FRED, cam: R('cowboy', 25, 1.9, 0.05, { lookY: -0.05, fov: 40 }), dur: 2.4 });
  D.say('greg', 'Aaron! Come in! Aaron! Can you hear me?', { cam: R('greg', 20, 2.4, 0.1, { lookY: -0.2 }), expr: 'worried', dur: 2.0 });
  D.sfx('glitch', 0, 0.4); D.cam(R('greg', 20, 2.0, 0.1, { lookY: -0.2, fov: 40 })); D.sound('Nothing but static', 1.6, 0.1); D.wait(1.8);
  D.say('eric', "Why isn't he answering?", { ...TIGER, cam: F(['tiger'], 200, 7.0, 0.5, { lookY: -0.8, fov: 48 }), dur: 1.4 });
  D.say('cowboy', "Then we keep fighting until he does.", { ...FRED, cam: R('cowboy', 25, 1.9, 0.05, { lookY: -0.05, fov: 40 }), expr: 'determined', dur: 1.8 });
  D.set('fade', 1); D.sfx('cutBlack', 0, 0.4); wait0(0.5);

  // ===================================================================== SCENE 6: THE FINAL POWER BATTLE
  D.scene('6. The Final Power Battle');
  D.location('power');
  cast([...POWER3, 'soulX', 'horse']);
  D.set('hud.core', 1); D.set('core.pct', 30); D.set('core.purple', 0.8); D.set('core.hot', 0); D.set('power.purple', 1); D.set('power.dim', 0.65); D.set('power.alarm', 1); D.set('pdoor.burst', 1); D.set('pdoor.glow', 0);
  for (let i = 0; i < 3; i++) D.set(`power.dmg${i}`, 1);
  D.place('soulX', 0.6, -4.2, P + 0.1); D.act('soulX', 'soulReach'); D.expr('soulX', 'smug'); D.set('soulX.energy', 1); D.set('soulX.eyeGlow', 4.5); D.set('soulX.alpha', 1);
  D.place('horse', 4.6, 2.6, -2.0); D.set('horse.scale', 1); D.set('horse.purple', 1); D.set('horse.glow', 3.0); D.set('horse.act', 'idle');
  D.place('aaron', 4.7, -5.4, 2.55); D.act('aaron', 'leanTable'); D.expr('aaron', 'determined');
  D.place('flare', -3.4, -1.0, 2.6); D.act('flare', 'getUp'); D.expr('flare', 'tired');
  D.place('leon', 3.0, 0.2, -2.6); D.act('leon', 'getUp'); D.expr('leon', 'tired');
  D.fx('beam', { who: 'soulX', side: 'R', to: [0, 3.0, -6], dur: 40, width: 0.16, color: 0xb050ff });
  D.fx('bodyAura', { who: 'horse', dur: 40, color: 0xa040ff, power: 1.0 });
  D.music('epic', 0.44, 0, 0.3); D.sfx('drainHum', 0, 0.8);
  D.anim('core.pct', 22, 10, 0, 'linear');
  D.anim('fade', 0, 0.4);
  D.cam(FIX([-6, 2.4, 4], [0.4, 2.2, -4.6], { pos2: [-5.4, 2.3, 3.4], fov: 54 }));
  D.sound('Back in the power room, the core is turning purple. Flare and Leon struggle to their feet', 3.4, 0.3); D.wait(3.8);
  D.act('flare', 'ready'); D.act('leon', 'ready');
  D.say('soulX', 'Give up. In a few more seconds, every bit of this power belongs to me.', { cam: FIX([3.2, 1.75, -4.3], [0.6, 1.7, -4.3], { fov: 36 }), dur: 3.2 });
  {
    D.act('flare', 'oneHandBlast'); fireball(handAt('flare'), chest('soulX', 0, 1.4), 0.1, 0.4);
    D.act('soulX', 'soulBlock', 0.1); hit(chest('soulX', 0.5, 1.5), 0.5, 0xffa040, 30);
    D.act('leon', 'punch', 0.9); D.fx('dark', { from: handAt('leon', 0.9), to: chest('soulX', 1.3, 1.3), dur: 0.35, size: 1.0, core: 0xfff4c0, glowC: 0xf2b632, trail: 0xd09020, lightC: 0xffd060, spark: 0xffd060, debris: 0 }, 0.9);
    hit(chest('soulX', 1.3, 1.5), 1.25, 0xffd060, 30); D.sfx('punchHit', 1.25, 0.8);
    D.act('soulX', 'soulReach', 1.6);
    D.cam(FIX([-1.5, 1.7, 3.6], [0.4, 1.6, -4.2], { fov: 54 }));
    D.sound('They attack from both sides. He blocks them without even looking', 2.8, 0.2); wait0(3.4);
  }
  D.say('soulX', 'Do you know why I take powers? Because nobody ever gave me anything.', { cam: FIX([3.2, 1.75, -4.3], [0.6, 1.7, -4.3], { fov: 36 }), dur: 3.4 });
  D.say('leon', "That doesn't give you the right to take everyone else's.", { cam: R('leon', 25, 2.0, 0.15), expr: 'angry', dur: 2.4 });
  D.say('soulX', 'Then stop me... if you can.', { cam: FIX([3.2, 1.75, -4.3], [0.6, 1.7, -4.3], { fov: 36 }), expr: 'smug', dur: 1.8 });
  {
    const tr = D.path('leon', [[1.6, -3.0]], 5.0); D.act('leon', 'grabArm', tr); D.sfx('punchHit', tr, 0.6);
    D.cam(FIX([-3.0, 1.6, 0.6], [1.0, 1.4, -3.8], { fov: 52 }));
    D.sound('Leon grabs his arm and tries to pull him away from the core', 2.6, 0.2); wait0(tr + 2.7);
    D.act('soulX', 'soulSweep'); D.fx('sphere', { x: 0.6, y: 1.4, z: -4.2, radius: 4, dur: 0.6, color: 0xa040ff }, 0.2); D.sfx('darkBlast', 0.2, 0.8);
    D.act('leon', 'knockBack', 0.25); D.anim('leon.x', 3.0, 0.6, 0.25, 'out'); D.anim('leon.z', 0.2, 0.6, 0.25, 'out'); D.act('leon', 'getUp', 1.0); D.act('leon', 'ready', 2.4); D.sfx('thud', 0.85, 0.7);
    D.act('soulX', 'soulReach', 0.9);
    D.cam(FIX([5.5, 1.4, 1.5], [1.5, 1.0, -2.0], { fov: 56 }));
    D.sound('A burst of purple energy throws him back', 2.0, 0.2); wait0(2.8);
  }
  D.face('aaron', -0.6, 0.4); D.act('aaron', 'idle');
  D.say('aaron', "Guys! Fighting him isn't working!", { cam: R('aaron', 25, 2.0, 0.15), act: 'armsOut', expr: 'worried', dur: 1.8 });
  D.act('aaron', 'idle');
  D.say('aaron', "He's pulling the power out through his hand. So we give the core MORE power than he can take!", { act: 'gesture', expr: 'determined', dur: 4.0 });
  D.faceChar('leon', 'aaron', 0.4); D.faceChar('flare', 'aaron', 0.4);
  D.say('leon', 'You want to overload the core? With him still touching it?', { cam: R('leon', 25, 2.0, 0.15), expr: 'surprised', dur: 2.6 });
  D.say('aaron', 'When I say now, hit the core with everything you have. All of it.', { cam: R('aaron', 25, 2.0, 0.15), act: 'point', dur: 2.8 });
  D.act('aaron', 'idle');
  D.say('flare', 'Are you sure this will work?', { cam: R('flare', -25, 2.0, 0.15), expr: 'worried', dur: 1.6 });
  D.cam(R('aaron', 20, 1.6, 0.1, { fov: 38 })); D.sound('Aaron hesitates', 1.2); D.wait(1.3);
  D.say('aaron', "...No. But I'm the smartest guy here. Trust me.", { expr: 'smug', dur: 2.4 });
  D.expr('leon', 'happy');
  D.say('leon', "That's why you're the leader.", { cam: R('leon', 25, 2.0, 0.15), expr: 'grin', dur: 1.6 });
  D.act('aaron', 'wristUp'); D.set('aaron.holo', 1, 0.2); D.sfx('policeRadio', 0, 0.5);
  D.say('aaron', 'Greg! If this works, the monsters lose their power. Hold on for one more minute!', { cam: R('aaron', 25, 1.8, 0.12), expr: 'determined', dur: 3.6 });
  D.say('greg', 'One minute? We can do one minute!', { label: 'GREG (ON THE RADIO)', cam: R('aaron', 25, 1.5, 0.1, { lookY: -0.12, fov: 42 }), dur: 1.8 });
  D.say('greg', '...Probably!', { label: 'GREG (ON THE RADIO)', dur: 1.0 });
  D.set('aaron.holo', 0); D.act('aaron', 'idle');
  // the city: the titan goes for the bus
  D.location('downtown');
  cast(['greg', 'tiger', 'cowboy', 'titan', 'beh', 'shadow']);
  D.set('sky.mode', 3); D.set('night.purple', 0.55); D.set('hud.core', 1); D.set('core.pct', 18);
  D.set('carC.vis', 1); D.set('carC.x', -2); D.set('carC.z', -9); D.set('carC.y', 0); D.set('carC.rz', P);
  D.set('carE.vis', 1); D.set('carE.x', 8); D.set('carE.z', 8.5); D.set('carE.y', 0); D.set('carE.rz', 2.6);
  D.set('chunk1.vis', 1); D.set('chunk1.x', -16); D.set('chunk1.y', 0); D.set('chunk1.z', 1.0); D.set('chunk1.rz', 0.8);
  D.set('bus.vis', 1); D.set('bus.x', 6.5); D.set('bus.z', 2.4); D.set('bus.y', 0); D.set('bus.ry', 0.1); D.set('bus.rz', 0); D.set('bus.rx', 0);
  D.place('titan', 16, 1.0, -P / 2); D.set('titan.s', 1.25); D.set('titan.eyes', 3.5); D.set('titan.rx', 0); D.set('titan.upR', 0); D.set('titan.reachR', 0); D.set('titan.lean', 0);
  D.place('beh', 0, -20, 0); D.set('beh.rear', 0.55); D.set('beh.aura', 0.5);
  D.show('shadow'); D.set('shadow.x', 6); D.set('shadow.z', 20); D.set('shadow.y', 0); D.set('shadow.eyes', 2.5); D.set('shadow.dissolve', 0);
  D.place('greg', 3.8, 6.6, P / 2); D.set('greg.y', 3.0); D.act('greg', 'hover'); D.expr('greg', 'determined');
  D.place('tiger', 10.5, 8.2, P); D.set('tiger.s', 3.4); D.set('tiger.act', 'idle');
  D.place('cowboy', 2.0, 8.2, P / 2); D.act('cowboy', 'idle'); D.expr('cowboy', 'determined');
  D.music('action', 0.44, 0, 0.3);
  {
    D.anim('titan.upR', 1, 1.0); D.anim('titan.lean', 0.25, 1.0); D.sfx('titanRoar', 0, 0.8); D.shake(0.6, 1.0);
    D.cam(FIX([-2, 1.0, 10], [10, 8, 1.5], { fov: 62 }));
    D.sound('In the city, the titan raises its fist over the bus. There are still people inside!', 3.2, 0.3); wait0(3.8);
  }
  D.say('greg', 'Not the bus!', { cam: R('greg', 20, 2.3, 0.1, { lookY: -0.2 }), act: 'point', expr: 'angry', dur: 1.0 });
  D.say('greg', 'Everything we have... NOW!', { act: 'fistPump', dur: 1.4 });
  {
    D.anim('greg.redEyes', 1, 0.4); D.sfx('powerUp', 0, 0.7); D.act('greg', 'stretchArms', 0.4);
    D.set('greg.tLx', 13.5); D.set('greg.tLy', 19); D.set('greg.tLz', -1.5); D.set('greg.tRx', 13.5); D.set('greg.tRy', 19); D.set('greg.tRz', 3.0); D.set('greg.sag', -0.2); D.set('greg.bendL', 0.3); D.set('greg.bendR', -0.3);
    D.anim('greg.stretch', 1, 0.5, 0.5); D.sfx('stretchBoing', 0.5, 0.9);
    D.act('cowboy', 'lassoThrow', 0.6); D.set('lasso.target', 'titanL', 0.6); D.set('lasso.r', 1.0, 0.6); D.set('lasso.flat', 0, 0.6); D.anim('lasso.on', 1, 0.35, 0.6); D.sfx('lassoWhip', 0.6, 0.8); D.act('cowboy', 'lassoPull', 1.1);
    D.set('tiger.act', 'leap', 1.0); fly('tiger', 13.2, 0, 4.6, 0.6, 1.0, 'out'); D.set('tiger.act', 'roar', 1.7); D.sfx('tigerRoar', 1.1, 1.0);
    D.anim('titan.upR', 0.8, 0.8, 1.2); D.anim('titan.lean', 0, 0.8, 1.2);
    D.cam(FIX([-4, 3.2, 14], [10, 8, 2], { fov: 64 }));
    D.sound('Greg’s eyes glow red. His arms grab the fist, Fred’s lasso grabs the other arm, and giant Eric bites down on the titan’s leg', 4.0, 0.3); wait0(5.4);
    D.anim('titan.upR', 0.95, 0.6); D.shake(0.5, 2.0);
    D.cam(F(['greg'], 25, 2.4, 0.1, { lookY: -0.2, fov: 46 }));
    D.sound('They hold it... but the titan is too strong', 2.4, 0.2); wait0(2.8);
    D.say('greg', 'Come on, Aaron... any time now!', { cam: R('greg', 20, 2.3, 0.1, { lookY: -0.2 }), expr: 'angry', dur: 1.6 });
    D.say('eric', 'My teeth are getting TIRED!', { ...TIGER, cam: F(['tiger'], 230, 7.0, 0.5, { lookY: -0.8, fov: 50 }), dur: 1.4 });
  }
  D.anim('core.pct', 10, 1.0);
  // the power room: NOW!
  D.location('power');
  cast([...POWER3, 'soulX', 'horse']);
  D.set('hud.core', 1); D.set('core.pct', 10); D.set('core.purple', 0.9); D.set('power.purple', 1); D.set('power.dim', 0.65); D.set('power.alarm', 1); D.set('pdoor.burst', 1);
  for (let i = 0; i < 3; i++) D.set(`power.dmg${i}`, 1);
  D.place('soulX', 0.6, -4.2, P + 0.1); D.act('soulX', 'soulReach'); D.expr('soulX', 'smug'); D.set('soulX.energy', 1); D.set('soulX.eyeGlow', 4.8);
  D.place('horse', 4.6, 2.6, -2.0); D.set('horse.purple', 1); D.set('horse.glow', 3.0);
  D.place('aaron', 3.2, -2.6, -2.0); D.act('aaron', 'ready'); D.expr('aaron', 'determined');
  D.place('flare', -3.2, -2.4, 2.2); D.act('flare', 'ready'); D.expr('flare', 'determined');
  D.place('leon', -1.2, -1.6, 2.7); D.act('leon', 'ready'); D.expr('leon', 'determined');
  D.fx('beam', { who: 'soulX', side: 'R', to: [0, 3.0, -6], dur: 5.5, width: 0.16, color: 0xb050ff });
  D.fx('bodyAura', { who: 'horse', dur: 6, color: 0xa040ff, power: 1.0 });
  D.say('leon', 'He has to hold still for this to work. Leave that to me.', { cam: R('leon', 25, 2.0, 0.15), expr: 'determined', dur: 2.6 });
  {
    D.act('leon', 'powerFist'); D.anim('leon.field', 1, 0.4); D.sfx('timeStop', 0, 0.8); D.set('freezeTint', 0.7); D.anim('freezeTint', 0.25, 1.6, 0.4);
    D.cam(FIX([-3.6, 1.6, -0.2], [0.4, 1.6, -4.0], { fov: 54 }));
    D.sound('Leon’s time field slows the Soul Stealer down to a crawl', 2.6, 0.2); wait0(3.0);
    D.anim('leon.field', 0, 0.4, 0.6); D.anim('freezeTint', 0, 0.5, 0.6);
  }
  D.say('aaron', 'NOW!', { cam: R('aaron', 20, 2.0, 0.15, { fov: 42 }), act: 'point', dur: 0.9, gap: 0.1 });
  {
    D.act('flare', 'blastPose'); D.fx('beam', { who: 'flare', side: 'R', to: [-0.9, 3.0, -5.4], dur: 6.4, width: 0.26, color: 0xff7a20 }); D.sfx('fireRoar', 0, 1.0);
    D.act('leon', 'powerFist'); D.fx('beam', { who: 'leon', side: 'R', to: [-0.3, 2.4, -5.2], dur: 6.2, width: 0.22, color: 0xf2b632 }, 0.2); D.sfx('energyCharge', 0.2, 0.8);
    D.act('aaron', 'wristUp'); D.fx('beam', { who: 'aaron', side: 'L', to: [0.8, 3.4, -5.4], dur: 6.0, width: 0.22, color: 0x4ab0ff }, 0.4); D.sfx('powerUpBlue', 0.4, 0.8);
    D.anim('core.hot', 1, 3.6, 0.4); D.anim('core.purple', 0, 3.0, 0.6); D.anim('core.pct', 100, 3.6, 0.6, 'in'); D.sfx('coreOverload', 0.6, 1.0); D.shake(0.3, 1.0, 0.6); D.shake(0.9, 1.6, 2.4);
    D.expr('soulX', 'shocked', 1.6);
    D.cam(FIX([-6.5, 1.4, 1.5], [-0.5, 2.6, -5.4], { fov: 58 }));
    D.sound('Fire, strength and light pour into the core all at once', 2.8, 0.3); wait0(3.9);
    D.cam(FIX([0, 3.4, -1.5], [0, 3.3, -6], { fov: 54 }));
    D.sound('The core blazes white-hot. The meter shoots back up', 2.0, 0.1); wait0(2.0);
  }
  D.say('soulX', 'What?! No... NO!', { cam: R('soulX', 0, 1.3, 0.05, { lookY: 0.02, fov: 40 }), expr: 'shocked', dur: 1.4, gap: 0.1 });
  {
    D.act('soulX', 'soulBlock'); D.fx('beam', { who: 'soulX', side: 'L', to: [0.1, 3.0, -5.4], dur: 4.6, width: 0.2, color: 0xb050ff });
    D.fx('beam', { who: 'flare', side: 'R', to: [-0.9, 3.0, -5.4], dur: 4.8, width: 0.26, color: 0xff7a20 }); D.fx('beam', { who: 'leon', side: 'R', to: [-0.3, 2.4, -5.2], dur: 4.8, width: 0.22, color: 0xf2b632 }); D.fx('beam', { who: 'aaron', side: 'L', to: [0.8, 3.4, -5.4], dur: 4.8, width: 0.22, color: 0x4ab0ff });
    D.act('flare', 'blastPose'); D.act('leon', 'powerFist'); D.act('aaron', 'wristUp'); D.sfx('beamFire', 0, 0.8); D.sfx('energyCharge', 0.3, 0.7); D.shake(0.5, 4.4);
    D.say('soulX', "You can't... beat... ME!", { cam: FIX([3.2, 1.75, -4.3], [0.6, 1.7, -4.3], { fov: 36 }), expr: 'angry', dur: 1.8 });
    D.say('flare', 'WATCH US!', { cam: R('flare', 20, 1.7, 0.15), expr: 'angry', dur: 1.0, gap: 0.1 });
  }
  {
    D.fx('chargeBeam', { from: [0, 3.0, -5.4], to: [0.8, 1.6, 6.0], charge: 0.2, dur: 0.8, size: 2.2, width: 1.0, color: 0x9fe0ff });
    D.set('flashWhite', 0.85); D.anim('flashWhite', 0, 0.8, 0.2); D.sfx('bigBlast', 0.2, 1.0); D.sfx('energyWave', 0.25, 0.9); D.shake(2.2, 1.6, 0.2);
    D.act('soulX', 'knockBack', 0.25); D.anim('soulX.x', 0.8, 0.8, 0.25, 'out'); D.anim('soulX.z', 6.5, 0.8, 0.25, 'out'); D.anim('soulX.y', 1.4, 0.4, 0.25, 'out'); D.anim('soulX.y', 0, 0.4, 0.65, 'in');
    D.act('soulX', 'lieBack', 1.1); D.sfx('thud', 1.05, 1.0);
    D.fx('drain', { who: ['soulX'], to: [0, 3.3, -6], dur: 3.0, power: 1.3 }, 1.0); D.anim('soulX.energy', 0, 2.6, 1.1); D.anim('soulX.eyeGlow', 1.2, 2.6, 1.1);
    D.anim('core.hot', 0.3, 2.0, 1.2);
    D.comic('KRAKA-BOOOM!', 0.2, 1.4, { x: 0.5, y: 0.35, size: 130, rot: -3, c1: '#ffffff', c2: '#7fe0ff' });
    D.cam(FIX([-7, 2.0, 8.5], [0.5, 1.6, 0], { fov: 64 }));
    D.sound('A huge blast of blue energy throws the Soul Stealer across the room. All the stolen power is ripped out of him', 4.0, 0.3); wait0(5.4);
  }
  {
    D.anim('horse.purple', 0, 1.0); D.anim('horse.glow', 1.6, 1.0); D.fx('flashBurst', { x: 4.6, y: 1.4, z: 2.6, dur: 0.8, radius: 2.0, color: 0x40e8ff, light: 40 }); D.sfx('glassShatter', 0, 0.6); D.sfx('crystalPower', 0.1, 0.6);
    D.set('horse.act', 'rear', 0.6); D.sfx('horseNeigh', 0.7, 0.9);
    D.cam(F(['horse'], 140, 3.4, 0.2, { lookY: -0.3, fov: 46 }));
    D.sound('The purple energy around Fred’s horse shatters. It’s free!', 2.6, 0.2); wait0(2.8);
    D.say('soulX', 'No! Come back! Your power belongs to ME!', { cam: FIX([2.8, 0.9, 4.6], [0.8, 0.5, 6.5], { fov: 46 }), expr: 'angry', dur: 2.2 });
    D.set('horse.act', 'neigh'); D.sfx('horseNeigh', 0, 0.9); D.cam(F(['horse'], 140, 3.4, 0.2, { lookY: -0.3, fov: 46 }));
    D.sound('The horse snorts at him. It belongs to Fred, not him', 2.2, 0.2); wait0(2.8);
    D.set('horse.act', 'idle'); D.path('horse', [[2.0, 9.0], [0.4, 17]], 6.0); D.sfx('gallop', 0, 0.8);
    D.cam(FIX([-4, 1.4, 6.0], [1.4, 1.3, 11], { fov: 54 }));
    D.sound('The horse gallops out through the broken door', 2.0, 0.2); wait0(2.4);
    D.expr('soulX', 'sad');
    D.cam(FIX([2.6, 0.7, 4.8], [0.8, 0.5, 6.6], { fov: 44 }));
    D.sound('The Soul Stealer can only watch it go', 2.2, 0.2); wait0(2.6);
  }
  D.act('aaron', 'idle'); D.act('flare', 'idle'); D.act('leon', 'idle');
  D.cam(FIX([0, 2.4, 1.0], [0, 3.4, -6], { fov: 52 }));
  D.sound('The core glows bright blue again. The meter reads one hundred percent', 2.8, 0.2); D.wait(3.0);
  D.say('aaron', 'It worked... It actually worked!', { cam: R('aaron', 20, 2.0, 0.15), expr: 'grin', dur: 1.8 });
  D.say('flare', 'Aaron... you are a genius.', { cam: R('flare', 20, 2.0, 0.15), expr: 'happy', dur: 1.6 });
  D.say('aaron', 'I know.', { cam: R('aaron', 20, 2.0, 0.15), expr: 'smug', dur: 0.8 });
  D.say('leon', "Please don't make him say it again.", { cam: R('leon', 20, 2.0, 0.15), expr: 'tired', dur: 1.6 });
  // the city: the monsters weaken, Fred's powers return
  D.location('downtown');
  cast(['greg', 'tiger', 'cowboy', 'titan', 'beh', 'shadow', ...CLAY4]);
  D.set('sky.mode', 3); D.set('night.purple', 0.15); D.set('hud.core', 1); D.set('core.pct', 100); D.set('power.purple', 0);
  D.set('carC.vis', 1); D.set('carC.x', -2); D.set('carC.z', -9); D.set('carC.rz', P);
  D.set('carE.vis', 1); D.set('carE.x', 8); D.set('carE.z', 8.5); D.set('carE.rz', 2.6);
  D.set('chunk1.vis', 1); D.set('chunk1.x', -16); D.set('chunk1.y', 0); D.set('chunk1.z', 1.0); D.set('chunk1.rz', 0.8);
  D.set('bus.vis', 1); D.set('bus.x', 6.5); D.set('bus.z', 2.4); D.set('bus.ry', 0.1); D.set('bus.rz', 0);
  D.place('titan', 16, 1.0, -P / 2); D.set('titan.upR', 0.95); D.set('titan.lean', 0); D.set('titan.eyes', 3.5);
  D.place('beh', 0, -20, 0); D.set('beh.rear', 0.55); D.set('beh.aura', 0.5); D.set('beh.eyesPurple', 1);
  D.show('shadow'); D.set('shadow.x', 6); D.set('shadow.z', 20); D.set('shadow.eyes', 2.5);
  D.place('greg', 3.8, 6.6, P / 2); D.set('greg.y', 3.0); D.act('greg', 'stretchArms'); D.set('greg.stretch', 1); D.set('greg.redEyes', 1);
  D.set('greg.tLx', 13.5); D.set('greg.tLy', 19); D.set('greg.tLz', -1.5); D.set('greg.tRx', 13.5); D.set('greg.tRy', 19); D.set('greg.tRz', 3.0);
  D.place('tiger', 13.2, 4.6, P / 2); D.set('tiger.s', 3.4); D.set('tiger.act', 'roar');
  D.place('cowboy', 2.0, 8.2, P / 2); D.act('cowboy', 'lassoPull'); D.set('lasso.target', 'titanL'); D.set('lasso.on', 1); D.set('lasso.r', 1.0);
  for (const [c, x, z] of [['clay1', 13.0, -1.6], ['clay2', 13.4, 3.6], ['clay3', 17.6, -2.8], ['clay4', 18.0, 4.2]]) { D.place(c, x, z, Math.atan2(16 - x, 1 - z)); D.act(c, 'golemReach'); D.set(`${c}.rise`, 0); D.set(`${c}.mound`, 0); }
  {
    D.anim('titan.eyes', 0.6, 0.3); D.anim('titan.eyes', 2.0, 0.3, 0.3); D.anim('titan.eyes', 0.5, 0.3, 0.6); D.anim('titan.eyes', 1.6, 0.3, 0.9);
    D.anim('beh.aura', 0, 0.8); D.anim('beh.eyesPurple', 0, 0.8); D.anim('shadow.eyes', 0.8, 0.8); D.sfx('powerDown', 0, 0.9);
    D.cam(FIX([-2, 1.4, 14], [10, 9, 0], { fov: 62 }));
    D.sound('In the city, the purple glow flickers out of every monster', 2.6, 0.3); wait0(3.0);
  }
  D.say('greg', "They're getting weaker! Aaron did it!", { cam: R('greg', 20, 2.4, 0.1, { lookY: -0.2 }), expr: 'grin', dur: 1.8 });
  {
    D.anim('cowboy.whiteEyes', 0.8, 0.8); D.fx('bodyAura', { who: 'cowboy', dur: 6.0, color: 0x40e8ff, power: 1.2 }); D.sfx('powerUpBlue', 0, 0.8);
    D.anim('lasso.on', 0, 0.3); D.act('cowboy', 'lookHand', 0.3);
    D.cam(R('cowboy', 25, 1.7, 0.05, { lookY: -0.05, fov: 40 }));
    D.sound('Fred feels something come back to him', 2.0, 0.2); D.wait(2.2);
  }
  D.say('cowboy', 'My horse is free... and my powers are BACK!', { ...FRED, expr: 'grin', dur: 2.2 });
  {
    D.act('cowboy', 'summon'); D.anim('cowboy.whiteEyes', 0, 0.6, 1.0);
    for (const [i, c] of CLAY4.entries()) { const dt = 0.3 + i * 0.35; D.anim(`${c}.mound`, 1, 0.5, dt); D.anim(`${c}.rise`, 1, 1.4, dt + 0.3, 'out'); D.sfx('clayRise', dt, 0.7); }
    D.anim('titan.upR', 0.6, 0.8, 1.6); D.anim('titan.lean', -0.2, 0.8, 1.6); D.shake(0.4, 1.0, 1.6);
    D.cam(FIX([21, 7.5, 10], [15, 0.5, 0.5], { fov: 60 }));
    D.sound('Clay creatures rise out of the street around the titan’s feet... and this time, they’re on the heroes’ side', 3.6, 0.3); wait0(4.2);
  }
  D.say('greg', "CLAY GUYS! They're on OUR side now!", { cam: R('greg', 20, 2.4, 0.1, { lookY: -0.2 }), expr: 'grin', dur: 2.0 });
  D.set('cowboy.hatOff', 0);
  D.say('cowboy', "Let's finish this.", { ...FRED, cam: R('cowboy', 25, 1.8, 0.05, { lookY: -0.05, fov: 40 }), expr: 'determined', dur: 1.3 });
  // the boomerang hat
  {
    D.act('cowboy', 'hatThrow'); D.set('cowboy.hatOff', 1, 0.3); D.set('hat.vis', 1, 0.3); D.set('hat.x', 2.3, 0.3); D.set('hat.y', 1.6, 0.3); D.set('hat.z', 7.8, 0.3); D.sfx('hatWhoosh', 0.3, 0.9);
    D.anim('hat.x', 12.3, 0.9, 0.3, 'linear'); D.anim('hat.y', 12.0, 0.9, 0.3, 'out'); D.anim('hat.z', 1.0, 0.9, 0.3);
    D.cam(FIX([0, 1.6, 12], [9, 8, 2], { fov: 60 }));
    D.sound('Fred throws his hat like a boomerang', 0.85, 0.05); wait0(1.2);
    D.fx('flashBurst', { x: 12.3, y: 12.0, z: 1.0, dur: 0.7, radius: 2.4, color: 0x40e8ff, light: 50 }); D.fx('sparks', { x: 12.3, y: 12.0, z: 1.0, n: 80, color: 0x9feaff, speed: 4 });
    D.sfx('glassCrack', 0, 1.0); D.sfx('crystalPower', 0.05, 0.7); D.shake(0.8, 0.5);
    D.comic('CRACK!', 0, 1.0, { x: 0.55, y: 0.3, size: 120, rot: 6, c1: '#ffffff', c2: '#7fe0ff' });
    D.anim('hat.x', 6, 0.5, 0, 'linear'); D.anim('hat.y', 9, 0.5, 0); D.anim('hat.z', -2.5, 0.5, 0); D.anim('hat.x', 2.3, 0.5, 0.5, 'linear'); D.anim('hat.y', 2.0, 0.5, 0.5); D.anim('hat.z', 7.8, 0.5, 0.5);
    D.cam(FIX([7, 7, 9], [12.3, 12, 1], { fov: 50 }));
    D.sound('It smashes into the glowing crystal in the titan’s chest... and flies right back', 2.6, 0.1); wait0(1.0);
    D.act('cowboy', 'catchHat'); D.set('hat.vis', 0, 0.05); D.set('cowboy.hatOff', 0, 0.3); D.act('cowboy', 'idle', 1.0);
    wait0(1.4);
  }
  D.say('cowboy', 'Nice throw, if I do say so myself.', { ...FRED, cam: R('cowboy', 25, 1.8, 0.05, { lookY: -0.05, fov: 40 }), act: 'tipHat', expr: 'smug', dur: 1.8 });
  D.act('cowboy', 'idle');
  {
    D.anim('greg.stretch', 0, 0.4); D.set('lasso.target', 'none'); D.act('greg', 'hover', 0.3); D.set('tiger.act', 'idle'); fly('tiger', 9.5, 0, 8, 0.8, 0, 'out');
    D.anim('titan.roar', 1, 0.4); D.anim('titan.upR', 0, 0.6); D.sfx('titanRoar', 0, 0.9);
    D.anim('titan.crumble', 1, 3.0, 0.8, 'in'); D.anim('titan.roar', 0, 0.6, 1.4); D.sfx('rockCrumble', 0.8, 1.0); D.shake(1.2, 3.0, 0.8);
    for (const [i, c] of CLAY4.entries()) D.anim(`${c}.crumble`, 1, 0.6, 2.4 + i * 0.15);
    D.fx('dustCloud', { x: 16, y: 0, z: 1, n: 140, dur: 6, radius: 8, size: 1.6, h: 5, color: 0x9a96a0, color2: 0x7a7680 }, 2.2); D.fx('debris', { x: 16, y: 4, z: 1, n: 90, spread: 2.4, up: 1.4, size: 2 }, 2.4);
    D.set('rubble1.vis', 1, 3.6); D.set('rubble1.x', 16); D.set('rubble1.z', 1); D.hide('titan', 3.8);
    D.cam(FIX([2, 1.4, 16], [16, 7, 0], { fov: 60 }));
    D.sound('Cracks spread across the titan’s body. It crumbles into a mountain of stone', 3.6, 0.3); wait0(5.0);
  }
  D.say('cowboy', 'Thank you, little buddies.', { ...FRED, cam: R('cowboy', 25, 1.8, 0.05, { lookY: -0.05, fov: 40 }), act: 'tipHat', expr: 'happy', dur: 1.5 });
  D.act('cowboy', 'idle');
  // sunrise: the shadow creature and Behemoth
  D.set('sky.mode', 4); D.set('night.purple', 0);
  {
    D.place('tiger', 0, 13, 0.4); D.set('tiger.act', 'leap'); fly('tiger', 4.5, 5, 18.5, 0.7, 0.2, 'out'); D.sfx('tigerRoar', 0.1, 1.0);
    D.anim('shadow.dissolve', 1, 2.6, 0.7); D.anim('shadow.eyes', 0, 1.2, 0.7); D.sfx('smokeDissolve', 0.7, 0.9); D.sfx('shadowWhoosh', 0.8, 0.7);
    D.fx('smoke', { x: 6, y: 3, z: 20, n: 70, dur: 3.5, color: 0x2a2030, color2: 0x4a4050 }, 0.8);
    fly('tiger', 6, 0, 21, 0.7, 0.9, 'in'); D.set('tiger.act', 'crouch', 1.6); D.hide('shadow', 3.4);
    D.cam(FIX([-6, 2.4, 10], [6, 5, 22], { fov: 60 }));
    D.sound('The sun rises. Eric pounces... and the shadow creature dissolves into nothing', 3.2, 0.3); wait0(3.8);
  }
  D.say('eric', 'And STAY gone!', { ...TIGER, cam: F(['tiger'], 25, 7.5, 0.5, { lookY: -0.8, fov: 48 }), dur: 1.2 });
  {
    D.place('greg', 2.0, -16.5, -P / 2 - 0.5); D.set('greg.y', 3.6); D.act('greg', 'hoverPull'); D.set('greg.redEyes', 0);
    D.set('greg.wrapU', 0.6); D.anim('greg.stretch', 1, 0.5); D.anim('greg.wrap', 1, 0.8, 0.2); D.sfx('stretchBoing', 0, 0.8);
    D.cam(FIX([9, 3.2, -9], [0.5, 2.6, -18.5], { fov: 54 }));
    D.sound('Greg wraps up Behemoth one last time', 2.0, 0.3); wait0(2.4);
    D.say('greg', 'Sorry, big guy. Time to go home.', { cam: R('greg', 25, 2.4, 0.1, { lookY: -0.2 }), expr: 'determined', dur: 1.8 });
    D.anim('beh.s', 0.6, 1.2, 0, 'in'); D.anim('beh.dissolve', 1, 0.8, 1.0); D.fx('behDissolve', { dur: 2.2, size: 1.2 }); D.sfx('shrink', 0, 0.9); D.sfx('sparkle', 0.8, 0.7);
    D.anim('greg.wrap', 0, 0.5, 0.6); D.anim('greg.stretch', 0, 0.5, 0.8); D.act('greg', 'hover', 0.9); D.hide('beh', 1.8);
    D.cam(FIX([7, 2.0, -9], [0, 1.5, -18], { fov: 52 }));
    D.sound('Behemoth shrinks smaller and smaller... and vanishes in a shower of sparkles', 3.0, 0.2); wait0(3.4);
  }
  D.set('fade', 1); D.music('none', 0, 0, 0.5); D.sfx('cutBlack', 0, 0.4); wait0(0.8);

  // ===================================================================== SCENE 7: THE VICTORY
  D.scene('7. The Victory');
  D.location('power');
  cast([...POWER3, 'soulX']);
  D.set('hud.core', 0); D.set('core.pct', 100); D.set('core.purple', 0); D.set('core.hot', 0.2); D.set('power.purple', 0); D.set('power.dim', 0.4); D.set('power.alarm', 0); D.set('pdoor.burst', 1); D.set('core.flicker', 0);
  for (let i = 0; i < 3; i++) D.set(`power.dmg${i}`, 1);
  D.place('soulX', 0.8, 6.5, P); D.act('soulX', 'hurtKneel'); D.expr('soulX', 'angry'); D.set('soulX.energy', 0); D.set('soulX.eyeGlow', 1.2); D.set('soulX.alpha', 1); D.set('soulX.y', 0);
  D.place('aaron', 0.6, 3.0, 0); D.act('aaron', 'ready'); D.expr('aaron', 'determined');
  D.place('flare', -1.4, 3.6, 0.3); D.act('flare', 'flameHand'); D.expr('flare', 'determined');
  D.place('leon', 2.6, 3.8, -0.3); D.act('leon', 'powerFist'); D.expr('leon', 'determined');
  D.anim('core.hot', 0, 3.0); D.anim('power.dim', 0, 3.0, 1.0);
  D.music('tense', 0.26, 0, 0.8);
  D.anim('fade', 0, 0.8);
  D.cam(FIX([6.0, 2.2, -1.5], [0.8, 1.2, 5.0], { pos2: [5.4, 2.1, -1.0], fov: 52 }));
  D.sound('The Soul Stealer is on his knees. His stolen power is gone', 2.8, 0.4); D.wait(3.2);
  D.say('soulX', "You overloaded your own power core... while I was holding it. That's insane.", { cam: R('soulX', 15, 1.6, 0.0, { lookY: -0.1, fov: 42 }), dur: 3.4 });
  D.say('aaron', "No. That's called being smart.", { cam: R('aaron', 20, 2.0, 0.15), expr: 'smug', dur: 1.8 });
  D.act('soulX', 'idle'); D.expr('soulX', 'serious');
  D.say('soulX', "This isn't over, heroes. You'll see me again.", { cam: R('soulX', 10, 1.4, 0.05, { lookY: -0.02, fov: 40 }), dur: 2.6 });
  {
    D.fx('smoke', { x: 0.8, y: 0.4, z: 6.5, n: 60, dur: 2.6, color: 0x3a1a5a, color2: 0x6a2aa0 }); D.fx('flashBurst', { x: 0.8, y: 1.2, z: 6.5, dur: 0.6, radius: 1.8, color: 0xa040ff, light: 30 });
    D.anim('soulX.alpha', 0, 0.8, 0.2); D.hide('soulX', 1.1); D.sfx('teleport', 0, 0.8); D.sfx('smokeDissolve', 0.1, 0.6);
    D.path('flare', [[0.4, 5.6]], 4.0, 0.3); D.act('flare', 'reach', 0.8);
    D.cam(FIX([-3.5, 1.5, 3.2], [0.8, 1.2, 6.4], { fov: 50 }));
    D.sound('He vanishes in a cloud of purple smoke before Flare can grab him', 2.8, 0.2); D.wait(3.0);
  }
  D.act('flare', 'idle'); everyone((c) => D.expr(c, 'serious'), POWER3);
  D.say('leon', "...He's gone.", { cam: R('leon', -25, 2.0, 0.15), dur: 1.1 });
  D.face('aaron', P, 0.6); D.expr('aaron', 'happy');
  D.cam(FIX([0, 2.4, 1.0], [0, 3.4, -6], { fov: 52 }));
  D.sound('Behind them, the core glows calm and blue again. The lights come back on', 2.8, 0.2); D.wait(3.0);
  D.say('aaron', "But the core is safe. Headquarters is safe.", { cam: R('aaron', 160, 2.0, 0.15), dur: 2.2 });
  D.faceChar('aaron', 'flare', 0.4); D.faceChar('flare', 'aaron', 0.4); D.faceChar('leon', 'aaron', 0.4);
  D.say('flare', 'Did we... actually win?', { cam: R('flare', 20, 2.0, 0.15), expr: 'surprised', dur: 1.6 });
  D.expr('aaron', 'grin');
  D.say('aaron', 'We won.', { cam: R('aaron', 20, 2.0, 0.15), dur: 1.0 });
  everyone((c) => { D.act(c, 'cheerJump'); D.expr(c, 'grin'); }, POWER3);
  D.music('victory', 0.4, 0, 0.3); D.sfx('crowdCheer', 0, 0.3);
  D.cam(FIX([0, 1.4, 8.5], [0.6, 1.4, 3.4], { fov: 54 }));
  D.sound('They cheer', 1.4, 0.2); D.wait(2.0);
  everyone((c) => D.act(c, 'idle'), POWER3);
  D.say('flare', 'Ow. I think my hair is a little burnt.', { cam: R('flare', 20, 1.9, 0.15), act: 'touchHair', expr: 'annoyed', dur: 1.8 });
  D.say('leon', 'It looks great. Very... smoky.', { cam: R('leon', -20, 1.9, 0.15), expr: 'grin', dur: 1.6 });
  D.act('flare', 'idle');
  D.say('leon', 'And I need to build a new blast door. Again.', { cam: R('leon', -20, 1.9, 0.15), expr: 'tired', dur: 2.0 });
  {
    D.path('flare', [[0.0, 3.4]], 1.0); D.path('leon', [[1.4, 3.6]], 1.0);
    everyone((c) => { D.act(c, 'hug', 1.0); D.expr(c, 'happy', 1.0); }, POWER3);
    D.cam(FIX([0.6, 1.5, 6.4], [0.7, 1.3, 3.3], { fov: 48 }));
    D.sound('The three of them share a quick group hug', 1.8, 0.8); D.wait(2.6);
    everyone((c) => D.act(c, 'idle'), POWER3);
    D.path('flare', [[-1.2, 2.6]], 1.4); D.path('leon', [[2.4, 2.6]], 1.4); D.faceChar('flare', 'aaron', 0.3, 1.0); D.faceChar('leon', 'aaron', 0.3, 1.0); D.face('aaron', 0, 0.4);
    D.wait(1.0);
  }
  D.say('aaron', "Come on. Let's go find the others.", { cam: R('aaron', 20, 2.0, 0.15), expr: 'happy', dur: 1.8 });
  D.say('leon', 'Race you to the elevator!', { cam: R('leon', -20, 1.9, 0.15), expr: 'grin', dur: 1.4 });
  D.say('flare', 'No running near the power core!', { cam: R('flare', 20, 1.9, 0.15), act: 'point', expr: 'annoyed', dur: 1.6 });
  D.act('flare', 'idle');
  // the city at sunrise
  D.location('downtown');
  cast(['greg', 'eric', 'cowboy', 'ped1', 'ped2', 'ped3']);
  D.set('sky.mode', 4); D.set('night.purple', 0); D.set('citizens.on', 0);
  D.set('carC.vis', 1); D.set('carC.x', -2); D.set('carC.z', -9); D.set('carC.rz', P);
  D.set('carE.vis', 1); D.set('carE.x', 8); D.set('carE.z', 8.5); D.set('carE.rz', 2.6);
  D.set('chunk1.vis', 1); D.set('chunk1.x', -16); D.set('chunk1.y', 0); D.set('chunk1.z', 1.0); D.set('chunk1.rz', 0.8);
  D.set('bus.vis', 1); D.set('bus.x', 6.5); D.set('bus.z', 2.4); D.set('bus.ry', 0.1); D.set('bus.rz', 0);
  D.set('rubble1.vis', 1); D.set('rubble1.x', 16); D.set('rubble1.z', 1);
  D.place('greg', 5.4, 10.4, 0.4); D.act('greg', 'lieBack'); D.expr('greg', 'tired'); D.set('greg.redEyes', 0);
  D.place('eric', 2.8, 8.6, 1.3); D.act('eric', 'sitFloor'); D.expr('eric', 'tired');
  D.place('cowboy', 2.4, 10.6, 1.2); D.act('cowboy', 'idle'); D.expr('cowboy', 'happy');
  D.place('ped1', -6, 15, 1.4); D.act('ped1', 'idle'); D.expr('ped1', 'happy');
  D.place('ped2', -7.2, 16.2, 1.3); D.act('ped2', 'idle'); D.expr('ped2', 'happy');
  D.place('ped3', -12, 2, 0.8); D.act('ped3', 'idle'); D.expr('ped3', 'grin');
  D.music('dawn', 0.36, 0, 1.0); D.sfx('birds', 0.5, 0.4);
  D.anim('fade', 0, 0.4);
  D.cam(FIX([-22, 7, 26], [8, 6, -4], { pos2: [-20, 7.5, 24], fov: 56 }));
  D.card('location', 3.2, { text: 'AETHERFALL CITY  -  SUNRISE' });
  D.sound('The sun rises over Aetherfall City. The monsters are gone', 3.2, 0.4); D.wait(3.8);
  D.cam(FIX([3.6, 0.8, 7.8], [5.6, 0.3, 10.6], { fov: 46 }));
  D.say('greg', 'Is it over? Somebody tell me it’s over.', { dur: 2.0 });
  D.say('eric', "It's over, Greg.", { cam: R('eric', 30, 1.9, 0.0, { lookY: -0.3, fov: 44 }), expr: 'happy', dur: 1.2 });
  D.act('greg', 'getUp'); D.act('greg', 'idle', 1.6);
  D.say('greg', "Good. Because I am SO hungry.", { cam: R('greg', 20, 2.2, 0.15), expr: 'happy', dur: 1.8 });
  {
    D.path('ped1', [[-1.2, 12.4]], 1.6); D.path('ped2', [[-1.4, 13.8]], 1.6, 0.3); D.sfx('crowdCheer', 0.4, 0.6); D.sfx('applause', 1.0, 0.5);
    D.path('ped3', [[-4, 6], [1.2, 9.6]], 3.2, 0.2);
    D.cam(FIX([-6, 2.4, 4], [2, 1.2, 11], { fov: 56 }));
    D.sound('People come out of hiding, cheering', 2.4, 0.2); D.wait(3.0);
  }
  D.faceChar('ped3', 'cowboy', 0.3); D.faceChar('cowboy', 'ped3', 0.3);
  D.say('ped3', 'Mister cowboy! You saved my life!', { label: 'KID', cam: R('ped3', 20, 1.4, 0.0, { lookY: -0.05, fov: 42 }), act: 'cheer', expr: 'grin', dur: 2.0 });
  D.act('ped3', 'idle'); D.act('cowboy', 'kneel');
  D.say('cowboy', 'You were very brave, partner.', { ...FRED, cam: R('cowboy', 30, 1.6, -0.3, { lookY: -0.3, fov: 42 }), expr: 'happy', dur: 1.8 });
  D.say('ped3', 'Can I have your autograph?', { label: 'KID', cam: R('ped3', 20, 1.4, 0.0, { lookY: -0.05, fov: 42 }), expr: 'grin', dur: 1.4 });
  D.say('cowboy', "Partner, I don't even know how to spell Yeehaw.", { ...FRED, cam: R('cowboy', 30, 1.6, -0.3, { lookY: -0.3, fov: 42 }), expr: 'grin', dur: 2.0 });
  D.act('cowboy', 'idle');
  D.act('ped3', 'hug'); D.act('cowboy', 'hug', 0.1); D.sfx('crowdWow', 0.2, 0.3);
  D.cam(FIX([-0.4, 1.0, 8.0], [1.3, 0.8, 9.9], { fov: 46 })); D.sound('The kid gives Fred a big hug', 1.8, 0.2); D.wait(2.2);
  D.act('ped3', 'idle'); D.act('cowboy', 'idle');
  // a free burger
  {
    D.set('ped1.propR', 'burger');
    const tw = D.path('ped1', [[4.4, 11.4]], 1.6); D.faceChar('ped1', 'greg', 0.3, tw); D.faceChar('greg', 'ped1', 0.3, tw); D.act('ped1', 'giveItem', tw);
    D.cam(FIX([7.6, 1.5, 13.4], [4.6, 1.2, 10.8], { fov: 48 }));
    D.sound('The owner of the burger shop walks up to Greg', 2.0, 0.2); wait0(tw + 1.2);
  }
  D.say('ped1', 'You saved my restaurant! Here. A burger, on the house!', { label: 'CITIZEN', cam: R('ped1', 20, 1.6, 0.05, { fov: 42 }), dur: 2.4 });
  D.set('ped1.propR', 'none'); D.set('greg.propR', 'burger'); D.act('ped1', 'idle'); D.act('greg', 'raiseItem');
  D.say('greg', 'A free burger? This is the best day of my LIFE.', { cam: R('greg', 20, 1.8, 0.15), expr: 'grin', dur: 2.2 });
  D.say('eric', 'Greg, you just fought three giant monsters.', { cam: R('eric', 20, 1.8, 0.0, { lookY: -0.3, fov: 44 }), expr: 'smug', dur: 1.8 });
  D.act('greg', 'eatBar'); D.sfx('munch', 0.3, 0.6); D.sfx('munch', 1.0, 0.6);
  D.say('greg', 'And THEN I got a burger. Best. Day. Ever.', { cam: R('greg', 20, 1.8, 0.15), expr: 'happy', dur: 2.0 });
  D.act('greg', 'idle'); D.sfx('policeRadio', 0, 0.5);
  D.say('aaron', 'Greg? Eric? Fred? Come in!', { label: 'AARON (ON THE RADIO)', cam: R('greg', 20, 1.8, 0.15, { fov: 42 }), dur: 1.6 });
  D.say('greg', 'Aaron! We did it! The monsters are gone! The city is safe!', { cam: R('greg', 20, 1.8, 0.15), expr: 'grin', dur: 2.2 });
  D.say('aaron', 'So is headquarters. Meet us in the plaza.', { label: 'AARON (ON THE RADIO)', cam: R('greg', 20, 1.8, 0.15, { fov: 42 }), dur: 2.0 });
  D.say('greg', 'On our way! ...Right after I finish this burger.', { cam: R('greg', 20, 1.8, 0.15), expr: 'smug', dur: 2.2 });
  D.set('greg.propR', 'none');
  // headquarters is safe
  D.location('hqExt');
  cast([]);
  D.set('night', 0); D.set('evening', 1); D.set('hq.takeover', 1); D.anim('hq.takeover', 0, 3.0, 0.8); D.set('hq.purple', 0); D.set('hq.doors', 0); D.set('hq.clear', 1); D.set('hq.skyline', 1); D.set('hcar.vis', 0);
  D.sfx('crystalPower', 0.8, 0.5); D.sfx('sparkle', 1.6, 0.4);
  D.cam(FIX([14, 3.0, 18], [0, 6, -6], { pos2: [12, 3.2, 16], fov: 52 }));
  D.sound('At headquarters, the purple glow fades from every window. The headquarters is safe', 3.4, 0.3); D.wait(4.4);
  // everyone together again
  D.location('downtown');
  cast([...SIX]);
  D.set('sky.mode', 4);
  D.set('carE.vis', 1); D.set('carE.x', 8); D.set('carE.z', 8.5); D.set('carE.rz', 2.6);
  D.set('rubble1.vis', 1); D.set('rubble1.x', 16); D.set('rubble1.z', 1);
  D.place('greg', 0.6, 18.4, -P / 2 - 0.6); D.act('greg', 'idle'); D.expr('greg', 'happy');
  D.place('eric', 1.6, 19.6, -P / 2 - 0.2); D.act('eric', 'idle'); D.expr('eric', 'happy');
  D.place('cowboy', 1.0, 16.0, -P / 2 - 1.0); D.act('cowboy', 'idle'); D.expr('cowboy', 'happy');
  D.place('aaron', -9, 15.0, P / 2); D.place('flare', -9.8, 16.2, P / 2); D.place('leon', -9.4, 17.4, P / 2);
  everyone((c) => { D.act(c, 'idle'); D.expr(c, 'happy'); }, POWER3);
  D.path('aaron', [[-2.4, 16.6]], 1.5); D.path('flare', [[-2.8, 18.0]], 1.5, 0.2); D.path('leon', [[-2.2, 19.4]], 1.5, 0.4);
  D.cam(FIX([-1.0, 2.2, 28], [-2.0, 1.3, 17.5], { pos2: [-1.2, 2.0, 26.5], fov: 50 }));
  D.sound('Aaron, Flare and Leon arrive in the plaza. The whole team is together again', 3.4, 0.3); D.wait(4.8);
  everyone((c) => D.faceTo(c, -0.8, 18.0, 0.4), SIX);
  D.say('aaron', 'You three saved the whole city.', { cam: R('aaron', 25, 2.0, 0.15), expr: 'happy', dur: 1.8 });
  D.say('greg', 'And you three saved the house. So... we’re even.', { cam: R('greg', 25, 2.0, 0.15), act: 'shrug', expr: 'smug', dur: 2.4 });
  D.act('greg', 'idle');
  D.say('eric', 'So now can we PLEASE have that party?', { cam: R('eric', 20, 2.0, 0.15), act: 'armsOut', expr: 'grin', dur: 1.9 });
  D.act('eric', 'idle'); D.faceChar('flare', 'eric', 0.4);
  D.cam(R('flare', 25, 1.7, 0.1, { fov: 40 })); D.sound('Everyone looks at Flare', 1.4); D.wait(1.6);
  D.say('flare', '...Yes, Eric. We can have the party.', { expr: 'smug', dur: 2.0 });
  D.act('eric', 'cheerJump'); D.expr('eric', 'grin'); D.sfx('crowdLaugh', 0.3, 0.4);
  everyone((c) => { D.act(c, 'laugh'); D.expr(c, 'laugh'); }, ['aaron', 'greg', 'leon', 'cowboy']);
  D.cam(FIX([-1.0, 1.6, 23.5], [-0.8, 1.3, 18.0], { fov: 54 }));
  D.sound('Everyone laughs', 1.6, 0.2); D.wait(2.4);
  everyone((c) => { D.act(c, 'idle'); D.expr(c, 'happy'); }, SIX);
  D.faceChar('aaron', 'cowboy', 0.4);
  D.say('aaron', "Fred... we couldn't have done this without you.", { cam: R('aaron', 25, 2.0, 0.15), dur: 2.0 });
  D.say('cowboy', "And I couldn't have done it without your lasso. You're a smart one, partner.", { ...FRED, cam: R('cowboy', 20, 1.9, 0.05, { lookY: -0.05, fov: 40 }), expr: 'happy', dur: 3.0 });
  D.say('leon', 'You three look terrible, by the way.', { cam: R('leon', 25, 2.0, 0.15), expr: 'grin', dur: 1.6 });
  D.say('eric', 'You should see the monsters.', { cam: R('eric', 20, 2.0, 0.15), expr: 'smug', dur: 1.4 });
  D.faceChar('greg', 'aaron', 0.4); D.faceChar('aaron', 'greg', 0.4);
  D.say('greg', 'Nice plan down there, leader.', { cam: R('greg', 25, 2.0, 0.15), expr: 'happy', dur: 1.6 });
  D.say('aaron', 'Nice job up here, big guy.', { cam: R('aaron', 25, 2.0, 0.15), expr: 'happy', dur: 1.4 });
  everyone((c) => D.act(c, 'idle'), SIX);

  // ===================================================================== SCENE 8: GOODBYE, FRED
  D.scene('8. Goodbye, Fred');
  D.place('greg', -0.7, 20.0, P / 2); D.place('leon', -1.3, 18.8, P / 2); D.place('flare', -1.4, 17.6, P / 2); D.place('aaron', -1.2, 16.5, P / 2); D.place('eric', -0.6, 15.4, P / 2); D.place('cowboy', 0.6, 17.8, P / 2);
  D.show('horse'); D.place('horse', 36, 22, -P / 2); D.set('horse.scale', 1); D.set('horse.alpha', 1); D.set('horse.purple', 0); D.set('horse.glow', 1.4); D.set('horse.act', 'idle'); D.set('horse.y', 0); D.set('horse.rz', 0);
  D.music('farewell', 0.32, 0, 1.2);
  {
    D.sfx('gallop', 0.2, 0.6); D.sfx('gallop', 1.6, 0.6);
    D.path('horse', [[9, 20.2], [4.2, 19.4]], 7.0);
    everyone((c) => D.faceTo(c, 14, 20, 0.5, 0.6), SIX);
    D.cam(FIX([-4, 1.4, 21.5], [12, 1.4, 20], { look2: [4, 1.4, 19.4], fov: 50 }));
    D.sound('Hoofbeats. A glowing horse gallops across the plaza', 2.8, 0.3); D.wait(4.0);
  }
  D.faceTo('horse', 0.6, 17.8, 0.4); D.set('horse.act', 'snort'); D.sfx('horseSnort', 0, 0.6);
  D.faceChar('cowboy', 'horse', 0.4); D.expr('cowboy', 'surprised');
  D.cam(R('cowboy', 30, 1.8, 0.05, { lookY: -0.05, fov: 40 })); D.sound('Fred turns around', 1.4); D.wait(1.6);
  D.say('cowboy', '...There you are.', { ...FRED, expr: 'happy', dur: 1.4 });
  {
    const tw = D.path('cowboy', [[2.4, 18.5]], 1.4); D.faceTo('cowboy', 3.1, 18.9, 0.3, tw); D.act('cowboy', 'hug', tw + 0.2);
    D.set('horse.act', 'raiseHead', 0.6); D.set('horse.act', 'snort', 2.4); D.sfx('horseSnort', 2.4, 0.5);
    D.cam(FIX([2.0, 1.6, 21.4], [2.8, 1.4, 18.7], { fov: 44 }));
    D.sound('Fred hugs his horse. They are finally together again', 2.8, 0.3); D.wait(3.8);
  }
  D.act('cowboy', 'idle'); D.set('horse.act', 'idle');
  D.say('cowboy', "I'm sorry I let him take you, partner. Never again.", { ...FRED, cam: FIX([2.0, 1.55, 15.9], [2.7, 1.4, 18.6], { fov: 42 }), expr: 'sad', dur: 2.4 });
  D.set('horse.act', 'snort'); D.sfx('horseSnort', 0, 0.6);
  D.cam(F(['horse'], 150, 3.0, 0.2, { lookY: -0.2, fov: 44 })); D.sound('The horse nudges Fred with its nose', 2.0, 0.2); D.wait(2.4);
  D.set('horse.act', 'idle'); D.expr('cowboy', 'happy');
  D.say('cowboy', 'Okay, okay. I missed you too.', { ...FRED, cam: FIX([2.0, 1.55, 15.9], [2.7, 1.4, 18.6], { fov: 42 }), dur: 1.6 });
  everyone((c) => D.faceTo(c, 2.4, 18.5, 0.4), TEAM);
  D.faceTo('cowboy', -1.0, 17.7, 0.6);
  D.say('cowboy', 'When I came to this world, I was alone. Everybody thought I was a villain.', { ...FRED, cam: R('cowboy', 20, 1.9, 0.05, { lookY: -0.05, fov: 40 }), expr: 'sad', dur: 3.4 });
  D.say('cowboy', 'But you guys... you treated me like family.', { ...FRED, expr: 'happy', dur: 2.2 });
  D.say('cowboy', "I learned something here. Being strong isn't about having powers. It's about having friends.", { ...FRED, dur: 3.6 });
  D.say('aaron', "That's the smartest thing anyone has said all day.", { cam: R('aaron', 20, 2.0, 0.15), expr: 'happy', dur: 2.0 });
  D.say('greg', 'Hey!', { cam: R('greg', 20, 2.0, 0.15), act: 'armsOut', expr: 'annoyed', dur: 0.8 });
  D.act('greg', 'idle'); D.sfx('crowdLaugh', 0, 0.25);
  D.say('leon', 'You were never really a villain, Fred.', { cam: R('leon', 20, 2.0, 0.15), expr: 'happy', dur: 1.8 });
  D.say('cowboy', 'Well... except for the bank thing.', { ...FRED, cam: R('cowboy', 20, 1.9, 0.05, { lookY: -0.05, fov: 40 }), expr: 'smug', dur: 1.8 });
  D.act('eric', 'laugh'); D.sfx('crowdLaugh', 0, 0.3);
  D.say('greg', 'And the clay army thing.', { cam: R('greg', 20, 2.0, 0.15), expr: 'smug', dur: 1.4 });
  D.act('eric', 'idle');
  D.say('cowboy', '...And the clay army thing.', { ...FRED, cam: R('cowboy', 20, 1.9, 0.05, { lookY: -0.05, fov: 40 }), expr: 'happy', dur: 1.6 });
  D.say('cowboy', 'My horse can open a door back to my world now. It’s time for me to go home.', { ...FRED, expr: 'serious', dur: 3.2 });
  everyone((c) => D.expr(c, 'sad'), TEAM);
  D.say('eric', 'Wait... like, forever?', { cam: R('eric', 20, 2.0, 0.15), dur: 1.3 });
  D.say('cowboy', 'Not forever. Just for now, partner.', { ...FRED, cam: R('cowboy', 20, 1.9, 0.05, { lookY: -0.05, fov: 40 }), expr: 'happy', dur: 2.0 });
  D.say('cowboy', "If you ever need me, look for a blue light in the sky. I'll come riding.", { ...FRED, dur: 3.0 });
  everyone((c) => D.expr(c, 'happy'), TEAM);
  // hugs
  const hugWith = (c, line, lineWho = 'cowboy', extra = 0) => {
    // Fred steps in from the open middle of the half-circle; the camera looks over his shoulder at the friend
    const [cx, cz] = pos(c);
    const vd = Math.hypot(2.4 - cx, 18.5 - cz), vx = (2.4 - cx) / vd, vz = (18.5 - cz) / vd;
    const tx = cx + vx * 0.5, tz = cz + vz * 0.5, mx = (tx + cx) / 2, mz = (tz + cz) / 2;
    const tw = D.path('cowboy', [[tx, tz]], 1.2);
    D.faceChar('cowboy', c, 0.3, tw); D.faceTo(c, tx, tz, 0.3, tw - 0.2);
    D.act('cowboy', 'hug', tw + 0.1); D.act(c, 'hug', tw + 0.1); D.expr(c, 'happy', tw);
    D.cam(FIX([mx + vx * 2.2 - vz * 1.5, 1.6, mz + vz * 2.2 + vx * 1.5], [mx, 1.35, mz], { fov: 44 }));
    D.sound(`Fred hugs ${c[0].toUpperCase() + c.slice(1)}`, 1.6, tw * 0.6); wait0(tw + 0.9 + extra);
    if (line) D.say(lineWho, line, lineWho === 'cowboy' ? { ...FRED, dur: readTime(line) } : {});
    D.act('cowboy', 'idle'); D.act(c, 'idle');
  };
  hugWith('aaron', 'Thank you for the lasso.');
  D.say('aaron', 'Anytime, cowboy.', { expr: 'happy', dur: 1.2 });
  hugWith('flare', 'Keep that fire burning, Flare.');
  D.say('flare', 'I will. Take care, Fred.', { expr: 'happy', dur: 1.6 });
  hugWith('eric', 'Never stop being brave, Eric.');
  D.say('eric', "I won't. I promise.", { expr: 'happy', dur: 1.4 });
  hugWith('leon', 'Thanks for letting a cowboy stay in your headquarters.');
  D.say('leon', 'Take care of yourself out there.', { expr: 'happy', dur: 1.6 });
  hugWith('greg', null, 'cowboy', 1.0);
  D.say('greg', "I'm not crying. You're crying.", { act: 'hug', expr: 'sad', dur: 1.8 });
  D.say('cowboy', "I'm not crying either.", { ...FRED, act: 'hug', expr: 'sad', dur: 1.4 });
  D.say('cowboy', 'Eat a sandwich for me, big guy.', { ...FRED, act: 'hug', expr: 'happy', dur: 1.6 });
  D.say('greg', "I'll eat TEN.", { act: 'hug', expr: 'grin', dur: 1.0 });
  D.act('greg', 'idle'); D.act('cowboy', 'idle'); everyone((c) => D.expr(c, 'happy'), TEAM);
  // he rides home
  {
    const [hx, hz] = pos('horse');
    const tm = D.path('cowboy', [[hx - 0.7, hz + 0.05]], 1.4); D.face('cowboy', P / 2, 0.3, tm);
    D.cam(FIX([-1.6, 1.6, 22.6], [3.4, 1.3, 18.6], { fov: 48 }));
    D.sound('Fred climbs onto his horse', 1.8, 0.3); wait0(Math.max(2.4, tm + 0.4));
    D.act('cowboy', 'mount'); D.anim('cowboy.x', hx, 1.2, 0.1); D.anim('cowboy.z', hz, 1.2, 0.1); D.anim('cowboy.y', 1.18, 1.2, 0.1); D.sfx('bagRustle', 0.2, 0.4);
    D.face('horse', P / 2, 0.6, 0.4);
    wait0(1.6);
    D.set('cowboy.y', 1.18); D.act('cowboy', 'ride'); D.set('cowboy.x', hx); D.set('cowboy.z', hz);
    everyone((c) => D.faceTo(c, hx, hz, 0.4), TEAM);
  }
  D.say('cowboy', 'Battle Wars... it was an honor riding with you.', { ...FRED, cam: F(['cowboy'], 65, 3.0, 0.1, { lookY: -0.2, fov: 42 }), expr: 'happy', dur: 2.4 });
  D.act('cowboy', 'rideTip');
  D.say('cowboy', 'Yeehaw.', { ...FRED, cam: F(['cowboy'], 65, 2.8, 0.1, { lookY: -0.2, fov: 42 }), expr: 'grin', dur: 1.2 });
  D.act('cowboy', 'ride');
  {
    const [hx, hz] = pos('horse');
    D.set('horse.act', 'rear'); D.sfx('horseNeigh', 0, 0.8); D.anim('horse.glow', 3.2, 0.8);
    D.fx('portal', { x: hx + 11, y: 1.8, z: hz, ry: P / 2, radius: 2.2, dur: 9.0, color: 0x40e8ff }, 0.8); D.sfx('portalHome', 0.8, 0.9);
    D.cam(FIX([hx - 2, 1.4, hz + 7.5], [hx + 6, 1.8, hz], { fov: 54 }));
    D.sound('The horse’s markings glow, and a shimmering blue portal opens in the sunrise', 3.4, 0.3); wait0(4.6);
    D.set('horse.act', 'idle');
    D.path('horse', [[hx + 11.6, hz]], 5.0); D.path('cowboy', [[hx + 11.6, hz]], 5.0); D.sfx('gallop', 0, 0.8);
    D.anim('horse.alpha', 0, 0.4, 2.2); D.anim('cowboy.alpha', 0, 0.4, 2.2); D.fx('flashBurst', { x: hx + 11.2, y: 1.8, z: hz, dur: 0.9, radius: 2.4, color: 0x40e8ff, light: 50 }, 2.3); D.sfx('teleport', 2.3, 0.7);
    D.hide('horse', 2.7); D.hide('cowboy', 2.7);
    everyone((c) => D.act(c, 'waveBig'), TEAM);
    D.cam(FIX([hx - 8, 1.6, hz + 3.0], [hx + 10, 1.6, hz], { fov: 52 }));
    D.sound('Fred rides into the portal. In a flash of light, he’s gone', 2.8, 0.3); wait0(4.0);
  }
  D.say('aaron', 'See you around, cowboy.', { cam: R('aaron', 30, 1.9, 0.12), act: 'waveBig', expr: 'happy', dur: 1.6 });
  D.say('eric', 'Bye, Fred! Bye, horse!', { cam: R('eric', 30, 1.9, 0.12), act: 'waveBoth', expr: 'happy', dur: 1.3 });
  everyone((c) => D.act(c, 'idle'), TEAM);
  D.cam(FIX([4.6, 1.6, 17.8], [-1.0, 1.3, 17.8], { fov: 54 })); D.sound('For a moment, nobody says anything', 2.2, 0.2); D.wait(2.6);
  D.say('greg', "I'm gonna miss that guy.", { cam: R('greg', 25, 2.0, 0.15), expr: 'sad', dur: 1.6 });
  D.say('flare', 'Me too.', { cam: R('flare', 25, 2.0, 0.15), expr: 'sad', dur: 1.0 });
  D.say('leon', '...Does anybody else suddenly want to learn how to ride a horse?', { cam: R('leon', 25, 2.0, 0.15), expr: 'smug', dur: 2.6 });
  everyone((c) => { D.act(c, 'laugh'); D.expr(c, 'laugh'); }, TEAM); D.sfx('crowdLaugh', 0.2, 0.3);
  D.cam(FIX([4.6, 1.6, 17.8], [-1.0, 1.3, 17.8], { fov: 58 })); D.sound('Everyone laughs', 1.4, 0.2); D.wait(2.0);
  everyone((c) => D.act(c, 'idle'), TEAM);
  D.set('fade', 1); D.anim('fade', 1, 0.01); D.wait(0.6);

  // ===================================================================== SCENE 9: THE END OF SEASON 1
  D.scene('9. The End of Season 1');
  D.location('hqExt');
  cast([...TEAM]);
  D.set('night', 0); D.set('evening', 1); D.set('hq.takeover', 0); D.set('hq.purple', 0); D.set('hq.doors', 0); D.set('hq.clear', 1); D.set('hq.skyline', 1); D.set('hcar.vis', 0);
  D.place('aaron', -0.8, 8.5, P); D.place('flare', -2.0, 9.2, P); D.place('eric', 0.4, 9.4, P); D.place('leon', 1.6, 8.9, P); D.place('greg', -0.4, 10.2, P);
  everyone((c) => { D.act(c, 'idle'); D.expr(c, 'happy'); });
  D.music('farewell', 0.3, 0, 0.8);
  D.anim('fade', 0, 1.0);
  D.cam(FIX([30, 14, 40], [0, 4, -4], { pos2: [28, 13, 37], fov: 50 }));
  D.sfx('birds', 0.4, 0.3);
  D.sound('The sky glows orange and pink over Aetherfall City', 2.8, 0.4); D.wait(3.4);
  D.path('aaron', [[-0.8, 0.6]], 1.2); D.path('flare', [[-2.2, 1.2]], 1.2, 0.2); D.path('eric', [[0.6, 1.4]], 1.2, 0.1); D.path('leon', [[1.9, 0.9]], 1.2, 0.3); D.path('greg', [[-0.4, 5.0]], 1.2, 0.4);
  D.cam(FIX([9, 2.0, 12], [0, 2.2, -2], { pos2: [8, 2.0, 10.5], fov: 50 }));
  D.card('location', 3.2, { text: 'BATTLE WARS HQ  -  SUNSET' });
  D.sound('That evening, the team walks home to headquarters', 2.8, 0.4); D.wait(5.0);
  everyone((c) => D.look(c, 0, 0.25, 0.8));
  D.say('leon', 'Look at this place. Scorch marks, broken doors... a giant hole in the basement.', { cam: R('leon', 25, 2.0, 0.15), dur: 3.0 });
  D.say('aaron', "We'll fix it. Together. Like always.", { cam: R('aaron', 25, 2.0, 0.15), expr: 'happy', dur: 2.0 });
  D.say('eric', 'Can we fix it AFTER the party?', { cam: R('eric', 20, 2.0, 0.15), expr: 'grin', dur: 1.6 });
  D.say('flare', 'Yes, Eric.', { cam: R('flare', 20, 2.0, 0.15), expr: 'smug', dur: 1.0 });
  everyone((c) => D.look(c, 0, 0, 0.6));
  D.face('greg', P, 0.3); D.expr('greg', 'serious');
  D.say('greg', 'Hey, guys... I think it’s time for me to go home too.', { cam: R('greg', 20, 2.0, 0.15), dur: 2.6 });
  everyone((c) => { D.faceChar(c, 'greg', 0.5); D.expr(c, 'surprised'); }, ['aaron', 'flare', 'eric', 'leon']);
  D.cam(FIX([-4.5, 1.7, -2.0], [-0.2, 1.4, 1.8], { fov: 50 })); D.sound('Everyone turns around', 1.4); D.wait(1.6);
  D.face('greg', P, 0.4);
  D.say('aaron', 'Home? But you live here!', { cam: R('aaron', 20, 2.0, 0.15), act: 'armsOut', dur: 1.6 });
  D.act('aaron', 'idle');
  D.say('greg', 'I mean my REAL home. I’ve been away for a really long time.', { cam: R('greg', 25, 2.0, 0.15), expr: 'sad', dur: 2.8 });
  D.say('eric', "But you'll come back, right?", { cam: R('eric', 20, 2.0, 0.15), expr: 'sad', dur: 1.6 });
  D.expr('greg', 'happy');
  D.say('greg', "Are you kidding? I've been with you guys since you were little kids. I always come back.", { cam: R('greg', 25, 2.0, 0.15), dur: 3.8 });
  D.say('leon', "You'd better. Who else is going to eat all the pizza?", { cam: R('leon', 20, 2.0, 0.15), expr: 'smug', dur: 2.4 });
  D.say('greg', 'Exactly. Save me a slice.', { cam: R('greg', 25, 2.0, 0.15), act: 'thumbsUp', expr: 'grin', dur: 1.6 });
  D.act('greg', 'idle');
  D.faceChar('greg', 'aaron', 0.4);
  D.say('greg', 'Take care of them, leader.', { cam: R('greg', 25, 2.0, 0.15), expr: 'happy', dur: 1.4 });
  D.say('aaron', 'I always do.', { cam: R('aaron', 20, 2.0, 0.15), expr: 'happy', dur: 1.0 });
  D.faceChar('greg', 'flare', 0.4);
  D.say('greg', "Flare, don't burn down the kitchen while I'm gone.", { cam: R('greg', 25, 2.0, 0.15), expr: 'smug', dur: 2.0 });
  D.say('flare', 'That was ONE time!', { cam: R('flare', 20, 2.0, 0.15), act: 'armsOut', expr: 'annoyed', dur: 1.2 });
  D.act('flare', 'idle'); D.faceChar('greg', 'eric', 0.4);
  D.say('greg', 'Eric. No parties without me.', { cam: R('greg', 25, 2.0, 0.15), dur: 1.4 });
  D.say('eric', '...What about small parties?', { cam: R('eric', 20, 2.0, 0.15), expr: 'grin', dur: 1.4 });
  D.say('greg', 'Small ones are okay.', { cam: R('greg', 25, 2.0, 0.15), expr: 'grin', dur: 1.2 });
  D.faceChar('greg', 'leon', 0.4);
  D.say('greg', 'And Leon... keep building cool stuff.', { cam: R('greg', 25, 2.0, 0.15), dur: 1.6 });
  D.say('leon', "I'll build you a bigger fridge for when you come back.", { cam: R('leon', 20, 2.0, 0.15), expr: 'happy', dur: 2.2 });
  D.say('greg', '...Now THAT is a reason to come back.', { cam: R('greg', 25, 2.0, 0.15), expr: 'grin', dur: 1.6 });
  D.face('greg', P, 0.4);
  // one last group hug
  {
    D.path('greg', [[-0.4, 3.2]], 1.2);
    D.path('aaron', [[-0.85, 2.5]], 1.0, 1.0); D.path('eric', [[0.15, 2.55]], 1.0, 1.1); D.path('flare', [[-1.15, 3.35]], 1.0, 1.0); D.path('leon', [[0.4, 3.3]], 1.0, 1.0);
    everyone((c) => { D.faceChar(c, 'greg', 0.3, 3.8); D.act(c, 'hug', 3.9); }, ['aaron', 'flare', 'eric', 'leon']);
    D.act('greg', 'hug', 3.9);
    D.cam(FIX([3.4, 1.8, 6.8], [-0.3, 1.3, 2.9], { pos2: [3.0, 1.8, 6.2], fov: 48 }));
    D.sound('One last group hug', 1.6, 3.6); D.wait(5.4);
  }
  everyone((c) => D.act(c, 'idle'));
  {
    D.path('aaron', [[-1.4, 1.6]], 1.4); D.path('eric', [[0.9, 1.6]], 1.4); D.path('flare', [[-2.4, 2.6]], 1.4); D.path('leon', [[1.8, 2.8]], 1.4);
    D.face('greg', -P / 2 - 0.6, 0.4, 1.0);
    D.wait(1.6);
    D.say('greg', 'Battle Wars forever!', { cam: R('greg', 60, 2.0, 0.15), act: 'fistPump', expr: 'grin', dur: 1.3 });
    everyone((c) => { D.act(c, 'fistPump'); D.expr(c, 'grin'); }, ['aaron', 'flare', 'eric', 'leon']);
    D.say('aaron', 'BATTLE WARS FOREVER!', { label: 'EVERYONE', cam: FIX([4.2, 1.5, 6.4], [-0.4, 1.4, 2.6], { fov: 54 }), dur: 1.4 });
    everyone((c) => { D.act(c, 'idle'); D.expr(c, 'happy'); }, ['aaron', 'flare', 'eric', 'leon']);
    D.act('greg', 'waveBig'); D.sfx('flyAway', 0.6, 0.8);
    D.act('greg', 'fly', 1.2); D.face('greg', -P / 2 - 0.3, 0.4, 1.2); fly('greg', -14, 9, 12, 2.4, 1.2, 'in'); fly('greg', -40, 22, 26, 2.2, 3.6, 'linear'); D.hide('greg', 5.8);
    D.fx('sparks', { x: -0.4, y: 0.4, z: 2.6, n: 30, color: 0xffffff, speed: 2 }, 1.2);
    everyone((c) => { D.faceTo(c, -14, 12, 0.6, 1.4); D.act(c, 'waveBoth', 1.4); D.look(c, 0, -0.35, 0.8, 1.8); }, ['aaron', 'flare', 'eric', 'leon']);
    D.cam(FIX([4.5, 1.2, -1.0], [-6, 5, 8], { fov: 60 }));
    D.sound('Greg waves one last time, then flies away into the sunset', 3.0, 0.4); D.wait(4.6);
  }
  D.cam(FIX([-1.0, 1.8, 8.0], [-0.4, 1.5, 1.8], { fov: 48 }));
  D.sound('The rest of the team stands together and waves goodbye', 2.6, 0.2); D.wait(3.0);
  everyone((c) => { D.act(c, 'idle'); D.look(c, 0, 0, 0.6); }, ['aaron', 'flare', 'eric', 'leon']);
  D.say('aaron', '...Best team ever.', { cam: R('aaron', 35, 1.6, 0.12, { fov: 42 }), expr: 'happy', dur: 1.6 });
  D.say('flare', 'Best team ever.', { cam: R('flare', -20, 1.8, 0.12, { fov: 42 }), expr: 'happy', dur: 1.3 });
  D.say('eric', "So... who's going to eat all the snacks now?", { cam: R('eric', 20, 1.8, 0.12, { fov: 42 }), expr: 'thinking', dur: 2.0 });
  D.say('leon', '...Us.', { cam: R('leon', 20, 1.8, 0.12, { fov: 42 }), expr: 'grin', dur: 0.9 });
  everyone((c) => { D.act(c, 'laugh'); D.expr(c, 'laugh'); }, ['aaron', 'flare', 'eric', 'leon']); D.sfx('crowdLaugh', 0.1, 0.3);
  D.cam(FIX([-1.0, 1.8, 8.0], [-0.4, 1.5, 1.8], { fov: 48 })); D.sound('They laugh together', 1.4, 0.1); D.wait(2.0);
  everyone((c) => { D.act(c, 'idle'); D.expr(c, 'happy'); }, ['aaron', 'flare', 'eric', 'leon']);
  {
    everyone((c) => D.face(c, P, 0.8), ['aaron', 'flare', 'eric', 'leon']);
    D.music('theme', 0.5, 0, 2.0);
    D.cam(FIX([0, 1.8, 8], [0, 3, -4], { pos2: [0, 30, 66], look2: [0, 6, -8], fov: 52, ease: 'linear' }));
    D.sound('The camera slowly pulls away from headquarters', 2.8, 1.0); D.wait(13.0);
    D.anim('fade', 1, 3.0); D.wait(2.6);
  }

  // ===================================================================== END CARD
  D.scene('End');
  D.location('title');
  cast([]);
  D.set('fade', 1); D.anim('fade', 0, 1.0);
  D.music('theme', 0.55, 0, 0.1);
  D.set('title.theme', 0); D.set('title.k', 1); D.set('title.sub', 0); D.set('title.y', 1.4); D.set('title.jolt', 0); D.set('title.glitch', 0);
  D.cam(FIX([0, 0.6, 10.5], [0, 0.4, 0], { pos2: [0, 0.5, 10.0], fov: 42 }));
  const endDur = 18;
  D.card('credits', endDur, {
    lines: [
      { text: 'END OF SEASON 1', big: true, y: 0.55, color: '#ffd23f' },
      { text: 'Thank you for watching!', bold: true, y: 0.645, color: '#7fd4ff' },
      { text: 'Starring  Aaron  ·  Greg  ·  Flare  ·  Eric  ·  Leon  ·  Fred Yeehaw  ·  and the Soul Stealer', y: 0.73 },
      { text: 'Created by Nick', y: 0.8 },
      { text: 'Battle Wars will return...', bold: true, y: 0.88, color: '#c79bff' },
    ],
  });
  wait0(endDur - 2.0);
  D.anim('fade', 1, 1.8); wait0(2.0);

  const T = D.end();
  // never show two captions of the same kind at once: end the earlier one just before the next starts
  const cs = [...T.captions].sort((a, b) => a.t0 - b.t0);
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const a = cs[i], b = cs[j];
    if (b.t0 >= a.t1) break;
    if (!!a.sound === !!b.sound) a.t1 = Math.max(a.t0 + 1.2, b.t0 - 0.05);
  }
  return T;
}
