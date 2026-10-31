// BATTLE WARS - Season 1, Episode 7: "WESTERN DISASTER"
import { createDirector, readTime } from '../src/director.js';

export const META = {
  id: 's1e7-western-disaster', title: 'Battle Wars - S1E7 - Western Disaster', file: 'Battle_Wars_S1E7_Western_Disaster', costume: 'blue2',
  behemoth: true, e6: true, e7: true, extras: { aaron: ['armor'], flare: ['armor'], eric: ['armor'], leon: ['armor'] },
};

const P = Math.PI;
const CLAY = ['clay1', 'clay2', 'clay3', 'clay4', 'clay5', 'clay6', 'clay7', 'clay8'];
const ALL = ['aaron', 'flare', 'eric', 'barista', 'leon', 'greg', 'newark', 'cowboy', 'guard', 'officer', 'officer2', ...CLAY, 'water', 'soul', 'dog', 'birddog', 'tiger', 'beh', 'ufo', 'horse', 'cat', 'bird', 'pigeon1', 'pigeon2', 'pigeon3', 'pigeon4'];

export function buildEpisode() {
  const D = createDirector();
  // a little more reading time per caption (viewers are 9-14 and read the captions)
  const say0 = D.say;
  D.say = (who, text, opts = {}) => say0(who, text, { ...opts, dur: (opts.dur ?? readTime(text)) * 1.12, gap: opts.gap ?? 0.32 });
  const F = (on, yaw, dist, h = 0.15, x = {}) => ({ type: 'frame', on: Array.isArray(on) ? on : [on], yaw, dist, h, ...x });
  const R = (on, yaw, dist, h = 0.15, x = {}) => F(on, yaw, dist, h, { rel: Array.isArray(on) ? on[0] : on, ...x });
  const FIX = (pos, look, x = {}) => ({ type: 'fixed', pos, look, ...x });
  const cast = (list) => {
    for (const c of ALL) { if (!list.includes(c)) D.hide(c); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); D.set(`${c}.propR`, 'none'); D.set(`${c}.propL`, 'none'); }
    for (const c of CLAY) { D.set(`${c}.mound`, 0); D.set(`${c}.melt`, 0); D.set(`${c}.crumble`, 0); D.set(`${c}.rise`, 1); }
    D.set('cowboy.alpha', 1); D.set('horse.alpha', 1); D.set('greg.stretch', 0); D.set('ghost.vis', 0); D.set('cctv', 0);
  };
  const props = (c, r = 'none', l = 'none') => { D.set(`${c}.propR`, r); D.set(`${c}.propL`, l); };
  const pos = (c, dt = 0) => [D.val(`${c}.x`, D.now + dt), D.val(`${c}.z`, D.now + dt)];
  const ride = (dt = 0) => { // keep Fred on the horse's back
    D.set('cowboy.y', 1.18, dt); D.act('cowboy', 'ride', dt);
  };
  const rideTo = (pts, speed, dt = 0) => { D.path('horse', pts, speed, dt); return D.path('cowboy', pts, speed, dt); };
  const vanish = (who, dur = 0.9, dt = 0) => {
    for (const w of who) {
      D.anim(`${w}.alpha`, 0, dur, dt);
      const [x, z] = pos(w, dt);
      D.fx('sparks', { x, y: w === 'horse' ? 1.3 : 1.4, z, n: 60, color: 0x6af0ff, speed: 1.6, size: 0.05 }, dt + dur * 0.4);
    }
    D.sfx('vanish', dt, 0.8);
  };
  const appear = (who, dur = 0.8, dt = 0) => {
    for (const w of who) {
      D.anim(`${w}.alpha`, 1, dur, dt);
      const [x, z] = pos(w, dt);
      D.fx('sparks', { x, y: 1.4, z, n: 50, color: 0x6af0ff, speed: 1.4, size: 0.05 }, dt);
    }
    D.sfx('appear', dt, 0.8);
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
  // a clay creature climbs out of the pavement
  const rise = (c, x, z, ry, dur = 1.8, dt = 0) => {
    D.place(c, x, z, ry, dt); D.set(`${c}.rise`, 0, dt); D.act(c, 'golem', dt);
    D.set(`${c}.mound`, 0, dt); D.anim(`${c}.mound`, 0.8, 0.4, dt); D.anim(`${c}.rise`, 1, dur, dt + 0.2, 'out'); D.anim(`${c}.mound`, 0, 0.6, dt + dur);
    D.fx('debris', { x, y: 0.1, z, n: 26, color: 0x8a6a4e, color2: 0x5a4434, spread: 0.6, up: 0.7 }, dt + 0.15);
  };
  // Aaron's blue energy blast from his right hand to a point
  const blast = (from, to, dur = 0.35, dt = 0) => {
    D.fx('dark', { from, to, dur, arc: 0.05, size: 0.8, core: 0xe0f6ff, glowC: 0x2f8cff, trail: 0x5ab8ff, lightC: 0x4aa8ff, spark: 0x8fd8ff, debris: 18, debrisC: 0x8a6a4e, debrisC2: 0x5a4434 }, dt);
    D.sfx('beamFire', dt, 0.7); D.sfx('blastImpact', dt + dur, 0.8);
  };

  for (const c of ALL) { D.hide(c); D.act(c, 'idle'); D.expr(c, 'neutral'); D.set(`${c}.y`, 0); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); D.set(`${c}.roll`, 0); props(c); }
  cast([]);
  D.set('fade', 1); D.set('aaron.suitGlow', 0); D.set('greg.eyeGlow', 0); D.set('horse.glow', 0.3); D.set('horse.act', 'idle');
  D.set('bank.inside', 0); D.set('bank.door', 0); D.set('vault.open', 0); D.set('loot.taken', 0); D.set('bank.flicker', 0); D.set('bank.clock', '2:13 AM');
  D.set('laptop.on', 0); D.set('laptop.mode', 0); D.set('police.lights', 0); D.set('pcar0.vis', 0); D.set('pcar1.vis', 0); D.set('wh.heat', 0); D.set('oldSt.flicker', 1);
  D.set('tv.off', 1); D.set('tv.fall', -1); D.set('table.held', 0); D.set('cat.pizza', 0);

  // ===================================================================== SCENE 1: THE MIDNIGHT ROBBERY
  D.scene('1. The Midnight Robbery');
  D.location('bank');
  cast(['horse', 'cowboy']);
  D.place('horse', -15, 8.0, P / 2); D.set('horse.act', 'idle'); D.set('horse.glow', 0.3);
  D.place('cowboy', -15, 8.0, P / 2); ride(); D.expr('cowboy', 'neutral');
  D.hide('horse'); D.hide('cowboy');
  D.music('mystery', 0.4, 0, 1.0); D.sfx('wind', 0.2, 0.7);
  D.anim('fade', 0, 2.2);
  D.cam(FIX([-3, 7.5, 28], [0, 3.4, 0], { pos2: [-1.5, 4.8, 19], fov: 48, ease: 'linear' }));
  D.card('location', 3.2, { text: 'AETHERFALL CITY BANK  -  NIGHT' });
  D.sound('A quiet city street. Everything is still', 2.4, 2.2); D.wait(4.8);
  D.sfx('blip', 0.3, 0.5);
  D.cam(FIX([5.3, 3.25, 5.0], [4.4, 3.2, 2.6], { pos2: [5.15, 3.25, 4.5], fov: 26 }));
  D.sound('The clock reads 2:13 AM', 2.0); D.wait(2.2);
  // Fred rides in
  D.show('horse'); D.show('cowboy');
  {
    const t = rideTo([[0.4, 8.0]], 1.8);
    D.sfx('hooves', 0, 0.6, { repeat: 4, every: 2.5 });
    D.cam(FIX([7.5, 0.9, 11.5], [-7, 1.7, 8], { pos2: [7.0, 0.9, 11.8], fov: 40 }));
    D.sound('A mysterious cowboy approaches on a strange-looking horse', 3.4); D.wait(3.6);
    D.cam(F(['cowboy'], 55, 4.4, -0.2, { lookY: -0.3 }));
    D.card('nameTag', 3.4, { text: 'FRED YEEHAW', sub: 'Dark western outfit. Boots. Gloves. A large hat.' });
    D.wait(t - 3.6 + 0.2);
  }
  D.set('horse.act', 'snort'); D.sfx('horseSnort', 0, 0.6);
  D.face('horse', P, 0.9); D.face('cowboy', P, 0.9);
  D.cam(FIX([1.9, 3.0, 11.4], [0, 3.4, 0], { fov: 46 }));
  D.sound("He doesn't say anything. He looks at the bank...", 2.4); D.wait(2.5);
  D.set('horse.act', 'idle');
  D.look('cowboy', 0, 0.55, 0.6);
  D.cam(F(['cowboy'], 200, 2.1, -0.15, { lookY: -0.15, fov: 38 }));
  D.sound('...then looks at his horse', 1.8); D.wait(2.0);
  D.look('cowboy', 0, 0, 0.4);
  D.act('cowboy', 'rideSummon'); D.anim('horse.glow', 2.2, 1.2, 0.3); D.sfx('crystalHum', 0.2, 0.6);
  D.cam(F(['cowboy'], 160, 4.2, 0.0, { lookY: -0.4, fov: 40 }));
  D.sound('He raises one hand. The horse begins to glow', 2.4); D.wait(2.0);
  vanish(['cowboy', 'horse'], 0.9);
  D.sound('Suddenly, both Fred and his horse disappear', 2.4, 0.4); D.wait(2.8);
  // inside the bank
  D.set('bank.inside', 1); D.act('cowboy', 'idle'); D.set('cowboy.y', 0); D.hide('cowboy'); D.hide('horse');
  D.show('guard'); D.place('guard', -4.6, -4.0, 0.9); D.act('guard', 'flashlight'); D.expr('guard', 'worried'); props('guard', 'flashlight');
  D.set('bank.flicker', 1); D.sfx('lightBuzz', 0, 0.6); D.sfx('lightBuzz', 1.3, 0.5);
  D.cam(FIX([3.6, 2.5, -1.0], [-3.2, 1.4, -6.5], { pos2: [3.2, 2.4, -1.4], fov: 52 }));
  D.sound('Inside the bank, the security lights flicker', 2.6); D.wait(2.8);
  D.say('guard', 'Hello? Is somebody there?', { cam: R('guard', 25, 2.3, 0.1), dur: 2.0 });
  // the invisible robber's shadow crosses the floor
  D.set('ghost.vis', 1); D.set('ghost.x', -1.2); D.set('ghost.z', -1.8); D.set('ghost.ry', -0.55);
  D.anim('ghost.x', 1.4, 2.6, 0, 'linear'); D.anim('ghost.z', -6.6, 2.6, 0, 'linear');
  D.sfx('whoosh', 0.3, 0.35);
  D.cam(FIX([-3.4, 4.8, -1.4], [0.4, 0, -4.6], { fov: 50 }));
  D.sound('A mysterious shadow moves across the room', 2.4); D.wait(2.7);
  D.set('ghost.vis', 0);
  D.face('guard', -0.6, 0.5); D.expr('guard', 'shocked');
  D.say('guard', '...What?', { cam: R('guard', 15, 1.8, 0.12), dur: 1.3 });
  D.anim('vault.open', 1, 2.6, 0.2); D.sfx('cageCreak', 0.2, 0.6);
  D.cam(FIX([2.3, 1.7, -9.4], [0, 1.4, -14.2], { fov: 46 }));
  D.sound('The storage room door slowly opens', 2.4); D.wait(2.6);
  // Fred becomes visible inside the storage room
  D.show('cowboy'); D.place('cowboy', 0, -15.0, P); D.set('cowboy.alpha', 0); D.act('cowboy', 'idle'); props('cowboy', 'none', 'sack');
  appear(['cowboy'], 0.9, 0.1);
  D.cam(FIX([0.0, 1.9, -13.25], [0, 1.1, -17.4], { fov: 58 }));
  D.sound('Fred becomes visible again', 1.6, 0.2); D.wait(1.7);
  D.path('cowboy', [[1.85, -16.3]], 1.6); D.face('cowboy', P / 2, 0.3, 1.2);
  D.cam(FIX([-1.6, 2.1, -14.7], [1.6, 1.1, -16.6], { fov: 50 }));
  D.sound('He walks inside and takes several valuable objects', 3.0); D.wait(1.4);
  D.act('cowboy', 'reach'); D.set('loot.taken', 1, 0.6); D.sfx('clink', 0.6, 0.6); D.wait(1.3);
  D.act('cowboy', 'idle'); D.path('cowboy', [[-1.85, -15.9]], 1.8); D.face('cowboy', -P / 2, 0.3, 2.0);
  D.cam(FIX([2.1, 2.1, -14.7], [-1.8, 1.0, -16.2], { fov: 50 })); D.wait(2.2);
  D.act('cowboy', 'reach'); D.set('loot.taken', 2, 0.5); D.sfx('bagRustle', 0.5, 0.6); D.set('loot.taken', 3, 1.2); D.sfx('bagRustle', 1.2, 0.6); D.wait(1.8);
  D.act('cowboy', 'idle');
  // his horse waits outside
  D.set('bank.inside', 0); D.set('bank.flicker', 0);
  D.show('horse'); D.place('horse', 0.4, 8.0, P); D.set('horse.alpha', 1); D.set('horse.glow', 0.4); D.set('horse.act', 'shift');
  D.hide('guard'); D.hide('cowboy');
  D.cam(FIX([5.0, 1.2, 13.2], [0.4, 1.4, 8.0], { fov: 42 }));
  D.sound('His horse waits outside', 1.8); D.wait(1.9);
  D.set('horse.act', 'idle');
  // Fred comes out with the sack and climbs on
  {
    const hx = 0.4, hz = 8.0;
    const lx = hx - 0.7, lz = hz;
    D.place('cowboy', -0.4, 3.2, 0); D.act('cowboy', 'idle'); props('cowboy', 'none', 'sack');
    D.path('cowboy', [[lx, lz - 0.05]], 2.0); D.face('cowboy', P, 0.3, 2.5);
    D.cam(FIX([6.0, 1.7, 12.2], [0, 1.3, 6.0], { fov: 46 }));
    D.sound('Fred carries his loot outside and climbs onto the horse', 3.0); D.wait(2.7);
    D.act('cowboy', 'mount'); D.sfx('bagRustle', 0.2, 0.4);
    D.anim('cowboy.x', hx, 1.3, 0.2); D.anim('cowboy.z', hz, 1.3, 0.2); D.anim('cowboy.y', 1.18, 1.3, 0.2);
    D.wait(1.7);
    ride(); D.set('horse.act', 'snort'); D.sfx('horseSnort', 0, 0.6);
    D.wait(0.6);
  }
  // they ride off and disappear
  {
    D.face('horse', P / 2, 0.6); D.face('cowboy', P / 2, 0.6);
    D.wait(0.5);
    rideTo([[6, 8.4], [24, 8.6]], 4.0);
    D.anim('horse.glow', 2.0, 0.8, 0.6);
    D.sfx('gallop', 0, 0.7);
    D.cam(FIX([-5.5, 1.3, 12.5], [6, 1.5, 8], { fov: 44 }));
    D.sound('Fred and his horse disappear into the darkness', 2.6, 0.6);
    D.wait(1.3);
    vanish(['cowboy', 'horse'], 0.9);
    D.wait(1.9);
  }
  D.set('fade', 1); D.sfx('cutBlack', 0, 0.5); D.music('none', 0, 0, 0.3); D.wait(0.9);
  // title card
  D.location('title');
  cast([]);
  D.set('fade', 0);
  D.music('showdown', 0.55, 0, 0.2);
  D.set('title.theme', 3); D.set('title.subText', 'WESTERN DISASTER'); D.set('title.sub', 0); D.set('title.y', 0.3); D.set('title.subY', -1.1); D.set('title.k', 3.6);
  D.cam(FIX([0, 0.2, 10.5], [0, -0.1, 0], { pos2: [0, 0.15, 9.8], fov: 42 }));
  D.anim('title.k', 1, 0.22, 0.2, 'in'); D.sfx('titleHit', 0.4, 0.9);
  D.anim('title.sub', 1, 0.45, 1.3, 'back'); D.sfx('horseNeigh', 1.3, 0.6);
  D.wait(4.6);
  D.anim('fade', 1, 0.5); D.wait(0.6);

  // ===================================================================== SCENE 2: SOMETHING STRANGE IS HAPPENING
  D.scene('2. Something Strange Is Happening');
  D.location('living');
  cast(['aaron', 'flare']);
  D.set('night', 0); D.set('evening', 0); D.set('steelTable', 0); D.set('halloween', 0); D.set('kitchen', 0); D.set('pizza', 0); D.set('tv.off', 1);
  D.set('title.theme', 0);
  D.set('laptop.on', 1); D.set('laptop.mode', 0);
  D.place('aaron', -0.5, 0.62, P); D.act('aaron', 'sitRelax'); D.expr('aaron', 'neutral');
  D.place('flare', 0.55, 0.62, P); D.act('flare', 'sitGame'); D.expr('flare', 'serious');
  D.music('hq', 0.35, 0, 0.6);
  D.anim('fade', 0, 0.6);
  D.cam(FIX([0.2, 2.5, -3.8], [0, 0.9, 0.0], { pos2: [0.2, 2.2, -3.4], fov: 54 }));
  D.card('location', 3.0, { text: 'BATTLE WARS HQ  -  MORNING' });
  D.sound('Aaron sits on the couch while Flare checks something on the computer', 3.0, 0.2); D.wait(3.6);
  D.say('aaron', 'Anything interesting happening today?', { cam: R('aaron', 15, 2.0, 0.15), dur: 2.0 });
  D.say('flare', 'Apparently, another bank was robbed last night.', { cam: FIX([0.95, 1.3, 0.15], [0.42, 0.62, -0.9], { fov: 40 }), dur: 2.4 });
  D.look('aaron', -0.4, 0, 0.3);
  D.say('aaron', 'Again?', { cam: R('aaron', 15, 2.0, 0.15), expr: 'surprised', dur: 1.0 });
  D.act('flare', 'sitRelax'); D.look('flare', 0.5, 0, 0.3);
  D.say('flare', "That's the third one this week.", { cam: R('flare', -15, 2.0, 0.15), dur: 1.9 });
  // Eric walks in
  D.show('eric'); D.place('eric', -5.4, 0.9, P / 2); D.act('eric', 'idle'); D.expr('eric', 'happy'); props('eric');
  D.path('eric', [[-2.3, -0.8]], 1.8); D.sfx('doorOpen', 0, 0.4); D.sfx('doorBang', 0.8, 0.3);
  D.cam(FIX([1.6, 1.9, -2.6], [-3.4, 1.2, 0.0], { fov: 52 })); D.wait(1.8);
  D.faceTo('eric', 0, 0.62, 0.3);
  D.say('eric', "What's going on?", { cam: R('eric', 10, 2.2, 0.15), dur: 1.3 });
  D.say('flare', 'Someone keeps robbing banks at night.', { cam: R('flare', -15, 2.0, 0.15), dur: 2.0 });
  D.say('eric', "So? Isn't that what criminals do?", { cam: R('eric', 10, 2.2, 0.15), act: 'shrug', expr: 'smug', dur: 2.0 });
  D.act('eric', 'idle'); D.look('aaron', -0.6, 0, 0.3);
  D.say('aaron', "Yeah, but nobody knows who's doing it.", { cam: R('aaron', 30, 2.0, 0.15), expr: 'serious', dur: 2.2 });
  // Greg comes downstairs eating breakfast
  D.show('greg'); D.place('greg', 4.9, -2.45, 0); D.set('greg.y', 3.0); D.act('greg', 'eatBar'); D.expr('greg', 'happy'); props('greg', 'toast', 'plate');
  D.path('greg', [[4.9, 1.75, 0.15], [4.9, 2.2, 0], [2.6, 1.4, 0]], 1.4); D.sfx('stairs', 0.2, 0.5); D.sfx('munch', 1.6, 0.5); D.sfx('munch', 3.4, 0.5);
  D.cam(FIX([1.4, 2.1, 3.6], [4.9, 1.6, -0.6], { fov: 54 }));
  D.sound('Greg walks downstairs eating breakfast', 2.4, 0.4); D.wait(4.6);
  D.faceTo('greg', -0.5, 0.0, 0.3); D.act('greg', 'idle');
  D.say('greg', 'Did somebody say food?', { cam: R('greg', -30, 2.2, 0.15), expr: 'happy', dur: 1.6 });
  D.look('aaron', 0.6, 0, 0.3);
  D.say('aaron', 'Nobody said food.', { cam: R('aaron', 15, 2.0, 0.15), expr: 'annoyed', dur: 1.4 });
  D.say('greg', 'Oh.', { cam: R('greg', 0, 1.9, 0.15), expr: 'sad', dur: 0.9 });
  D.sfx('munch', 0.2, 0.5); D.act('greg', 'eatBar');
  D.cam(R('greg', 0, 2.1, 0.15)); D.sound('Greg keeps eating anyway', 1.4); D.wait(1.5);
  D.act('greg', 'idle');
  // Leon arrives
  D.show('leon'); D.place('leon', -5.4, 0.9, P / 2); D.act('leon', 'idle'); D.expr('leon', 'serious'); props('leon');
  D.path('leon', [[-1.8, -1.9]], 1.6); D.sfx('doorOpen', 0, 0.4);
  D.cam(FIX([1.6, 1.9, -2.6], [-3.0, 1.2, -0.6], { fov: 52 })); D.wait(2.0);
  D.faceTo('leon', 0, 0.62, 0.4);
  D.say('leon', "We should investigate. Whoever's doing this hasn't left any clear evidence.", { cam: R('leon', 10, 2.3, 0.15), act: 'crossArms', dur: 3.6 });
  D.faceChar('eric', 'leon', 0.3);
  D.say('eric', "I'll figure it out.", { cam: R('eric', 60, 2.2, 0.15), act: 'thumbsUp', expr: 'determined', dur: 1.4 });
  D.act('eric', 'idle'); D.look('aaron', -0.5, 0, 0.3);
  D.say('aaron', 'How?', { cam: R('aaron', 30, 2.0, 0.15), expr: 'surprised', dur: 0.9 });
  D.faceTo('eric', -0.5, 0.62, 0.3);
  D.say('eric', 'Leave that to me.', { cam: R('eric', 0, 1.7, 0.12), expr: 'mischief', dur: 1.5 });
  D.expr('eric', 'grin'); D.sfx('sparkle', 0, 0.5);
  D.cam(R('eric', 0, 1.2, 0.1, { fov: 34 })); D.sound('Eric grins', 1.3); D.wait(1.5);
  D.anim('fade', 1, 0.5); D.wait(0.6);

  // ===================================================================== SCENE 3: THE ANIMAL INVESTIGATION
  D.scene('3. The Animal Investigation');
  D.location('park');
  cast(['eric', 'pigeon1', 'pigeon2', 'pigeon3', 'pigeon4']);
  D.set('laptop.on', 0);
  D.place('eric', -12, -2.1, P / 2 - 0.1); D.act('eric', 'idle'); D.expr('eric', 'serious'); props('eric');
  for (const [i, x, z, ry] of [[1, -1.4, -4.1, 0.6], [2, -0.7, -4.5, -0.8], [3, -0.1, -3.9, 2.2], [4, -1.0, -3.6, -2.0]]) { D.place(`pigeon${i}`, x, z, ry); D.set(`pigeon${i}.act`, i % 2 ? 'peck' : 'hop'); D.set(`pigeon${i}.y`, 0); }
  D.anim('fade', 0, 0.6); D.music('comedy', 0.35, 0, 0.6); D.sfx('birds', 0.5, 0.4);
  D.path('eric', [[-8, -1.9], [-4.6, -1.5]], 1.5);
  D.cam(F(['eric'], 40, 3.8, 0.3, { lookY: -0.3 }));
  D.card('location', 3.0, { text: 'AETHERFALL CITY PARK  -  AFTERNOON' });
  D.sound('Eric walks through the park', 2.0, 0.6); D.wait(3.2);
  D.say('eric', 'If this guy is using something unusual, maybe I need to think differently.', { cam: F(['eric'], 70, 2.6, 0.2), dur: 3.4 });
  D.wait(0.6);
  D.faceTo('eric', -0.8, -4.0, 0.4); D.look('eric', 0, 0.25, 0.4); D.sfx('coo', 0.3, 0.6);
  D.cam(FIX([-6.4, 1.6, -0.8], [-0.8, 0.3, -4.0], { fov: 40 }));
  D.sound('He looks around and spots a small group of birds', 2.2); D.wait(2.4);
  D.look('eric', 0, 0, 0.3);
  D.say('eric', 'Perfect.', { cam: R('eric', 10, 1.6, 0.12), expr: 'grin', dur: 1.1 });
  // Eric becomes a bird
  {
    const [ex, ez] = pos('eric');
    D.set('flashWhite', 0.5); D.anim('flashWhite', 0, 0.4); D.sfx('transform', 0, 0.9);
    D.fx('sparks', { x: ex, y: 1.0, z: ez, n: 60, color: 0x6dff8a, speed: 2.2 });
    D.hide('eric', 0.05); D.place('bird', ex, ez, D.val('eric.ry', D.now), 0.05); D.set('bird.y', 0.0, 0.05); D.set('bird.act', 'perch', 0.05);
    D.cam(F(['bird'], 140, 1.6, 0.25, { lookY: -0.1, fov: 40 }));
    D.sound('Eric transforms into a bird', 1.6); D.wait(1.6);
    D.set('bird.act', 'takeoff'); D.sfx('flap', 0, 0.8); D.sfx('flap', 0.4, 0.6);
    D.anim('bird.y', 3.2, 1.4, 0, 'out'); D.anim('bird.x', ex + 5, 1.4, 0, 'in'); D.anim('bird.z', ez - 2.5, 1.4, 0, 'in');
    for (let i = 1; i <= 4; i++) { D.set(`pigeon${i}.act`, 'fly', 0.2 + i * 0.1); D.anim(`pigeon${i}.y`, 2.6 + i * 0.4, 1.3, 0.2 + i * 0.1, 'out'); D.anim(`pigeon${i}.x`, -1 + i * 1.5, 1.3, 0.2 + i * 0.1); D.anim(`pigeon${i}.z`, -9 - i, 1.3, 0.2 + i * 0.1); }
    D.sfx('flap', 0.3, 0.4);
    D.cam(FIX([ex - 1.5, 0.8, ez + 3.0], [ex + 3, 2.0, ez - 1.5], { fov: 50 }));
    D.sound('...and flies up over the city', 2.0, 0.3); D.wait(1.8);
  }
  // flying over the city
  D.location('downtown');
  cast(['bird']);
  D.set('beh.vis', 0); D.set('ufo.vis', 0);
  D.place('bird', -40, 0, P / 2); D.set('bird.y', 24); D.set('bird.act', 'fly');
  D.anim('bird.x', 30, 5.0, 0, 'linear'); D.anim('bird.y', 20, 5.0, 0, 'linear');
  D.sfx('wingGust', 0.2, 0.5);
  D.cam(F(['bird'], 160, 3.4, 0.5, { lookY: -0.6, fov: 52 }));
  D.wait(2.4);
  D.set('bird.act', 'glide');
  D.cam(FIX([-6, 30, 16], [4, 18, 0], { fov: 54 })); D.wait(2.4);
  D.anim('fade', 1, 0.5); D.wait(0.6);
  // night: Eric watches the bank from a rooftop
  D.location('bank');
  cast(['bird']);
  D.set('bank.inside', 0); D.set('bank.door', 0); D.set('vault.open', 0); D.set('loot.taken', 0); D.set('bank.flicker', 0); D.set('bank.clock', '1:47 AM');
  D.place('bird', -2.0, 17.95, P); D.set('bird.y', 7.5); D.set('bird.act', 'perch');
  D.music('mystery', 0.4, 0, 0.8); D.sfx('cricket', 0.4, 0.4);
  D.anim('fade', 0, 0.8);
  D.cam(FIX([-1.0, 8.2, 20.0], [0.5, 2.6, 4], { pos2: [-1.2, 8.1, 19.6], fov: 46 }));
  D.card('location', 3.0, { text: 'LATER THAT NIGHT' });
  D.sound('Eric perches on a rooftop overlooking a bank', 2.6, 0.4); D.wait(3.4);
  D.show('horse'); D.show('cowboy');
  D.place('horse', 18, 8.6, -P / 2); D.set('horse.alpha', 1); D.set('horse.glow', 0.3); D.set('horse.act', 'idle');
  D.place('cowboy', 18, 8.6, -P / 2); D.set('cowboy.alpha', 1); ride(); props('cowboy');
  {
    const t = rideTo([[1.2, 8.3]], 2.4);
    D.sfx('hooves', 0.2, 0.5, { repeat: 3, every: 2.5 });
    D.set('bird.act', 'look');
    D.cam(FIX([-2.6, 8.4, 19.5], [4, 1.2, 8], { fov: 40 }));
    D.sound('He notices a strange cowboy approaching on a horse', 2.8); D.wait(t * 0.55);
    D.say('eric', 'Wait a minute...', { label: 'ERIC (V.O.)', cam: F(['bird'], 165, 1.1, 0.1, { lookY: -0.05, fov: 38 }), dur: 1.6 });
    D.wait(Math.max(0.3, t * 0.45 - 1.95));
  }
  D.face('horse', P, 0.6); D.face('cowboy', P, 0.6);
  D.act('cowboy', 'rideSummon', 0.4); D.anim('horse.glow', 2.2, 1.0, 0.6); D.sfx('crystalHum', 0.5, 0.6);
  D.cam(FIX([6.0, 1.3, 12.6], [1.2, 1.8, 8.2], { fov: 42 }));
  D.sound('Fred raises his hand. His horse begins glowing', 2.4); D.wait(2.4);
  vanish(['cowboy', 'horse'], 0.8);
  D.wait(1.4);
  D.set('bird.act', 'shock');
  D.say('eric', 'WHAT?!', { label: 'ERIC (V.O.)', cam: F(['bird'], 165, 1.0, 0.1, { lookY: -0.05, fov: 38 }), dur: 1.0 });
  // he flies closer: the bank door opens by itself
  D.set('bird.act', 'fly'); D.sfx('flap', 0, 0.6);
  D.anim('bird.x', 2.2, 1.6, 0); D.anim('bird.z', 3.2, 1.6, 0); D.anim('bird.y', 3.4, 1.6, 0); D.face('bird', P, 0.3);
  D.anim('bank.door', 1, 1.2, 1.4); D.sfx('doorOpen', 1.4, 0.5);
  D.cam(FIX([4.6, 2.0, 7.2], [0.2, 2.0, 0], { fov: 44 }));
  D.sound("Eric flies closer and sees the bank's door opening by itself", 3.0, 0.3); D.wait(3.4);
  D.set('bird.act', 'glide');
  // from above, he follows to a side window
  D.anim('bird.x', 5.65, 1.4, 0); D.anim('bird.z', 0.32, 1.4, 0); D.anim('bird.y', 1.12, 1.4, 0, 'out'); D.set('bird.act', 'perch', 1.4);
  D.anim('bank.door', 0, 1.0, 1.0);
  D.cam(FIX([7.8, 4.0, 6.2], [5.0, 1.4, 0.3], { fov: 44 }));
  D.sound('He follows the invisible figures from above', 2.4); D.wait(2.4);
  // Fred reappears inside, Eric watches from the window
  D.set('bank.inside', 1);
  D.hide('horse'); D.place('cowboy', 2.4, -5.8, 0.9); D.set('cowboy.y', 0); D.act('cowboy', 'idle'); D.set('cowboy.alpha', 0);
  appear(['cowboy'], 0.9, 0.3);
  D.cam(FIX([-1.2, 1.9, -9.6], [3.6, 1.5, -1.6], { fov: 48 }));
  D.sound('Fred reappears inside the bank. Eric watches from a nearby window', 3.2); D.wait(3.4);
  D.set('bird.act', 'look');
  D.say('eric', "So THAT'S how he's doing it!", { label: 'ERIC (V.O.)', cam: FIX([4.95, 1.55, -1.6], [5.65, 1.35, 0.3], { fov: 32 }), dur: 2.0 });
  D.set('bank.inside', 0); D.hide('cowboy');
  D.set('bird.act', 'takeoff'); D.sfx('flap', 0, 0.7);
  D.anim('bird.y', 12, 2.0, 0.2, 'in'); D.anim('bird.z', 12, 2.0, 0.2, 'in'); D.anim('bird.x', -4, 2.0, 0.2); D.face('bird', 0, 0.4);
  D.cam(FIX([0.5, 1.4, 9.5], [4.5, 4.0, 2.0], { fov: 50 }));
  D.sound('Eric flies away toward headquarters', 2.0, 0.3); D.wait(2.4);
  D.anim('fade', 1, 0.4); D.wait(0.5);

  // ===================================================================== SCENE 4: MEET FRED YEEHAW
  D.scene('4. Meet Fred Yeehaw');
  D.location('living');
  cast(['aaron', 'flare', 'greg', 'leon', 'bird']);
  D.set('laptop.on', 1); D.set('laptop.mode', 0); D.set('evening', 0); D.set('night', 0);
  D.place('aaron', -0.5, 0.62, P); D.act('aaron', 'sitRelax'); D.expr('aaron', 'neutral');
  D.place('flare', 0.55, 0.62, P); D.act('flare', 'sitGame'); D.expr('flare', 'serious');
  D.place('greg', 2.4, -1.0, -1.2); D.act('greg', 'idle'); D.expr('greg', 'neutral');
  D.place('leon', -2.4, -2.0, 0.5); D.act('leon', 'crossArms'); D.expr('leon', 'neutral');
  D.place('bird', -5.6, 0.9, P / 2); D.set('bird.y', 1.8); D.set('bird.act', 'fly');
  D.anim('fade', 0, 0.4); D.music('comedy', 0.35, 0, 0.4);
  D.anim('bird.x', -2.4, 1.2, 0); D.anim('bird.z', -0.4, 1.2, 0); D.anim('bird.y', 1.0, 1.2, 0); D.sfx('doorBang', 0, 0.4); D.sfx('flap', 0.1, 0.7);
  D.cam(FIX([1.6, 2.1, -3.0], [-2.8, 1.1, 0.0], { fov: 52 }));
  D.sound('Eric rushes inside...', 1.4, 0.2); D.wait(1.3);
  {
    const ex = -2.4, ez = -0.4;
    D.set('flashWhite', 0.5); D.anim('flashWhite', 0, 0.4); D.sfx('transform', 0, 0.9);
    D.fx('sparks', { x: ex, y: 1.0, z: ez, n: 60, color: 0x6dff8a, speed: 2.2 });
    D.hide('bird', 0.05); D.show('eric', 0.05); D.place('eric', ex, ez, 1.2, 0.05); D.act('eric', 'armsOut', 0.05); D.expr('eric', 'shocked', 0.05); props('eric');
    D.sound('...and transforms back into his normal form', 2.0, 0.1); D.wait(1.6);
  }
  D.say('eric', 'GUYS! I FOUND HIM!', { cam: R('eric', 10, 2.2, 0.15), act: 'armsOut', expr: 'grin', dur: 1.5 });
  D.look('aaron', -0.6, 0, 0.3);
  D.say('aaron', 'Found who?', { cam: R('aaron', 30, 2.0, 0.15), expr: 'surprised', dur: 1.0 });
  D.say('eric', 'THE BANK ROBBER!', { cam: R('eric', 10, 2.2, 0.15), act: 'point', dur: 1.3 });
  D.faceChar('greg', 'eric', 0.3);
  D.say('greg', 'You found a bank?', { cam: R('greg', 0, 2.2, 0.15), expr: 'surprised', dur: 1.4 });
  D.faceChar('eric', 'greg', 0.3);
  D.say('eric', 'NO, GREG!', { cam: R('eric', 0, 2.0, 0.15), act: 'facepalm', expr: 'annoyed', dur: 1.2 });
  D.faceTo('eric', 0, 0.62, 0.3); D.act('eric', 'armsOut'); D.expr('eric', 'happy');
  D.cam(FIX([1.4, 2.0, -3.0], [-1.6, 1.0, 0.0], { fov: 54 })); D.sound('Eric explains what he saw', 1.8); D.wait(1.9);
  D.say('eric', "It's a cowboy! He's got this horse that makes him invisible!", { cam: R('eric', 10, 2.2, 0.15), act: 'armsOut', expr: 'grin', dur: 2.8 });
  D.look('flare', 0.5, 0, 0.3); D.act('flare', 'sitRelax');
  D.say('flare', 'A horse?', { cam: R('flare', -25, 2.0, 0.15), expr: 'smug', dur: 1.0 });
  D.say('eric', 'YES! A HORSE!', { cam: R('eric', 10, 2.0, 0.15), act: 'yell', expr: 'angry', dur: 1.2 });
  D.act('eric', 'idle'); D.expr('eric', 'neutral'); D.act('leon', 'idle');
  D.say('leon', "That doesn't sound like an ordinary criminal.", { cam: R('leon', 10, 2.3, 0.15), expr: 'serious', dur: 2.2 });
  D.say('aaron', 'We need to find him before he steals anything else.', { cam: R('aaron', 20, 2.0, 0.15), expr: 'determined', dur: 2.4 });
  D.act('flare', 'sitGame'); D.look('flare', 0, 0, 0.3);
  D.say('flare', "Wait. There's something else.", { cam: R('flare', -15, 2.0, 0.15), expr: 'serious', dur: 1.6 });
  D.set('laptop.mode', 1); D.sfx('computerBeep', 0, 0.5);
  D.cam(FIX([0.95, 1.3, 0.15], [0.42, 0.62, -0.9], { fov: 40 }));
  D.sound('Flare opens a security recording from another location', 2.4); D.wait(2.4);
  // the security footage
  D.location('oldStreet');
  cast(['cowboy', 'clay1']);
  D.set('cctv', 1); D.set('cctv.cam', 'CAM 05 - 5TH STREET'); D.set('cctv.base', 1 * 3600 + 41 * 60 + 22); D.set('cctv.t0', D.now); D.set('oldSt.flicker', 0);
  D.place('cowboy', 4.4, -20.4, 2.3); D.set('cowboy.y', 0); D.act('cowboy', 'idle'); D.set('cowboy.alpha', 1); props('cowboy');
  D.place('clay1', 5.4, -21.4, -0.8); D.set('clay1.rise', 0); D.set('clay1.mound', 1); D.act('clay1', 'golem');
  D.music('none', 0, 0, 0.5); D.sfx('electricSlam', 0, 0.2);
  D.cam(FIX([1.6, 3.8, -16.6], [5.0, 0.8, -21.2], { fov: 40 }));
  D.sound('The video shows Fred standing outside a building', 2.4, 0.3); D.wait(2.8);
  D.act('cowboy', 'handOnClay');
  D.sound('He places his hand on a pile of strange clay', 2.4); D.wait(2.6);
  D.anim('clay1.mound', 1.15, 0.3, 0); D.anim('clay1.mound', 0.9, 0.3, 0.3); D.anim('clay1.mound', 1.1, 0.3, 0.6); D.sfx('claySquish', 0.1, 0.6); D.sfx('clayRise', 0.6, 0.7);
  D.anim('clay1.rise', 0.55, 1.6, 0.9, 'out'); D.anim('clay1.mound', 0.4, 1.6, 0.9);
  D.sound('The clay begins moving and forms into a human-like figure', 3.0); D.wait(2.8);
  D.act('cowboy', 'idle', 0.2);
  D.anim('clay1.rise', 1, 1.2, 0, 'out'); D.anim('clay1.mound', 0, 0.8, 0.4); D.sfx('claySquish', 0.6, 0.6);
  D.sound('The figure stands up', 1.8); D.wait(2.4);
  // back in the living room
  D.location('living');
  cast(['aaron', 'flare', 'greg', 'leon', 'eric']);
  D.set('laptop.on', 1); D.set('laptop.mode', 1);
  D.place('aaron', -0.5, 0.62, P); D.act('aaron', 'sitRelax'); D.expr('aaron', 'surprised');
  D.place('flare', 0.55, 0.62, P); D.act('flare', 'sitRelax'); D.expr('flare', 'serious');
  D.place('greg', 1.6, -0.2, -2.6); D.act('greg', 'idle'); D.expr('greg', 'shocked');
  D.place('leon', -1.5, -0.4, 2.6); D.act('leon', 'crossArms'); D.expr('leon', 'serious');
  D.place('eric', -2.2, 0.4, 2.0); D.act('eric', 'idle'); D.expr('eric', 'surprised');
  D.music('tense', 0.3, 0, 0.6);
  D.say('greg', '...', { cam: R('greg', 0, 1.8, 0.15), dur: 1.4 });
  D.say('greg', 'THE DIRT JUST GOT UP?!', { act: 'gasp', dur: 1.6 });
  D.act('greg', 'idle');
  D.say('flare', "It's not ordinary clay. He's somehow bringing it to life.", { cam: R('flare', -15, 2.0, 0.15), dur: 2.8 });
  D.say('aaron', 'So he can turn clay into living creatures?', { cam: R('aaron', 20, 2.0, 0.15), dur: 2.2 });
  D.say('leon', 'That makes him much more dangerous.', { cam: R('leon', 0, 2.3, 0.15), dur: 2.0 });
  // Aaron stands up
  D.act('aaron', 'idle'); D.anim('aaron.z', 0.1, 0.6); D.expr('aaron', 'determined'); D.sfx('whoosh', 0, 0.3);
  D.cam(FIX([-0.6, 1.5, -1.6], [-0.5, 1.4, 0.2], { pos2: [-0.6, 1.4, -1.4], fov: 46 }));
  D.sound('Aaron stands up', 1.2); D.wait(1.2);
  D.music('showdown', 0.4, 0, 0.3);
  D.say('aaron', "Let's go find this cowboy.", { cam: FIX([-0.6, 1.5, -1.6], [-0.5, 1.45, 0.1], { fov: 40 }), dur: 1.8 });
  D.anim('fade', 1, 0.5); D.wait(0.6);

  // ===================================================================== SCENE 5: THE CLAY ARMY
  D.scene('5. The Clay Army');
  D.location('oldStreet');
  cast(['aaron', 'flare', 'eric', 'greg', 'leon', 'cowboy', 'horse', 'clay1', 'clay2', 'clay3']);
  D.set('laptop.on', 0); D.set('oldSt.flicker', 1);
  for (const [c, x, z] of [['aaron', 0, 11], ['flare', -1.3, 11.6], ['eric', 1.3, 11.6], ['greg', -2.4, 12.4], ['leon', 2.4, 12.4]]) { D.place(c, x, z, P); D.act(c, 'idle'); D.expr(c, 'serious'); props(c); }
  D.place('cowboy', 0.6, -12.0, P); D.set('cowboy.y', 0); D.act('cowboy', 'idle'); D.set('cowboy.alpha', 1);
  D.place('horse', 2.0, -12.4, P - 0.2); D.set('horse.alpha', 1); D.set('horse.glow', 0.3); D.set('horse.act', 'idle');
  for (const [c, x, z] of [['clay1', -1.6, -14.6], ['clay2', 0.9, -15.2], ['clay3', 3.4, -14.4]]) { D.place(c, x, z, 0); D.act(c, 'golem'); D.expr(c, 'neutral'); }
  D.anim('fade', 0, 0.6); D.music('tense', 0.4, 0, 0.4); D.sfx('wind', 0.2, 0.5);
  for (const [c, x, z] of [['aaron', 0, 5], ['flare', -1.3, 5.6], ['eric', 1.3, 5.6], ['greg', -2.4, 6.4], ['leon', 2.4, 6.4]]) D.path(c, [[x, z]], 1.5);
  D.cam(FIX([1.6, 2.1, 16.5], [0, 1.2, -6], { pos2: [1.4, 2.0, 15.5], fov: 46 }));
  D.card('location', 3.0, { text: 'ABANDONED CITY STREET  -  NIGHT' });
  D.sound('The team arrives at an abandoned street', 2.4, 0.4); D.wait(4.2);
  D.cam(FIX([0.4, 1.7, 4.2], [1.0, 1.3, -13.2], { fov: 24 }));
  D.sound('At the far end, Fred Yeehaw stands beside his horse. Several clay creatures stand behind him', 4.0); D.wait(4.2);
  D.say('aaron', 'Hey! Cowboy!', { cam: R('aaron', 20, 2.3, 0.15), act: 'point', expr: 'angry', dur: 1.2 });
  D.act('aaron', 'idle');
  D.look('cowboy', 1.0, 0, 1.4);
  D.cam(F(['cowboy'], 180, 2.4, 0.0, { lookY: -0.15, fov: 38 }));
  D.sound('Fred slowly turns his head', 1.8); D.wait(1.9);
  D.face('cowboy', 0, 0.8); D.look('cowboy', 0, 0, 0.8);
  D.cam(F(['cowboy'], 15, 2.6, 0.0, { lookY: -0.15, fov: 38 }));
  D.sound("He doesn't respond", 1.6, 0.4); D.wait(2.0);
  D.say('eric', "You're the one robbing all those banks!", { cam: R('eric', 15, 2.2, 0.15), act: 'point', expr: 'angry', dur: 2.0 });
  D.act('eric', 'idle');
  D.act('cowboy', 'tipHat');
  D.cam(F(['cowboy'], 10, 2.0, 0.1, { lookY: -0.05, fov: 36 }));
  D.sound('Fred adjusts his cowboy hat', 1.8); D.wait(2.0);
  D.act('cowboy', 'summon'); D.sfx('crystalHum', 0, 0.5);
  D.cam(F(['cowboy'], 25, 3.4, 0.1, { lookY: -0.2, fov: 42 }));
  D.sound('He raises his hand', 1.4); D.wait(1.4);
  // the creatures begin to move
  for (const [c, x, z] of [['clay1', -1.4, -6.5], ['clay2', 1.0, -7.4], ['clay3', 3.2, -6.0]]) { D.act(c, 'golemReach'); D.path(c, [[x, z]], 1.0); }
  D.sfx('clayRise', 0, 0.6); D.act('cowboy', 'idle', 0.6);
  D.cam(FIX([-2.6, 0.7, -3.4], [0.8, 1.4, -11], { pos2: [-2.4, 0.7, -2.8], fov: 46 }));
  D.sound('The clay creatures begin moving', 2.0); D.wait(2.6);
  D.say('greg', 'Oh, great. We have walking mud!', { cam: R('greg', 20, 2.2, 0.15), act: 'shrugBig', expr: 'annoyed', dur: 1.9 });
  D.act('greg', 'idle');
  // one creature comes for Greg
  D.path('clay1', [[-2.2, 4.6]], 1.4);
  D.cam(FIX([-6.2, 1.6, 8.2], [-2.3, 1.2, 4.4], { fov: 46 }));
  D.sound('One clay creature approaches Greg', 1.8); D.wait(1.4);
  D.faceChar('greg', 'clay1', 0.3);
  D.say('greg', 'Stay back!', { cam: R('greg', 40, 2.2, 0.15), act: 'raiseHand', expr: 'worried', dur: 1.1 });
  {
    const [cx, cz] = pos('clay1');
    D.set('greg.tLx', cx); D.set('greg.tLy', 1.25); D.set('greg.tLz', cz); D.set('greg.tRx', cx); D.set('greg.tRy', 1.15); D.set('greg.tRz', cz); D.set('greg.bendL', 0.1); D.set('greg.bendR', -0.1); D.set('greg.sag', 0.1);
    D.act('greg', 'stretchArms'); D.anim('greg.stretch', 1, 0.5); D.sfx('stretchBoing', 0, 0.8);
    D.cam(FIX([-5.4, 1.4, 7.2], [-2.3, 1.2, 5.2], { fov: 44 }));
    D.sound('Greg stretches his arm and gently pushes it away', 2.4, 0.1); D.wait(0.7);
    D.anim('clay1.crumble', 1, 0.6); D.sfx('clayCrumble', 0, 0.8); D.anim('greg.stretch', 0, 0.4, 0.2);
    D.wait(1.6);
    D.act('greg', 'idle');
    D.anim('clay1.crumble', 0, 1.2, 0.2); D.sfx('clayReform', 0.2, 0.8);
    D.cam(FIX([-4.6, 1.0, 6.4], [-2.2, 0.8, 4.4], { fov: 42 }));
    D.sound('The creature falls apart... then reforms', 2.4); D.wait(2.0);
  }
  D.say('greg', 'IT CAN REBUILD ITSELF?!', { cam: R('greg', 20, 2.0, 0.15), act: 'gasp', expr: 'shocked', dur: 1.6 });
  D.act('greg', 'ready');
  D.say('flare', 'Be careful! Those things are made of clay!', { cam: R('flare', -10, 2.3, 0.15), act: 'point', expr: 'worried', dur: 2.0 });
  D.act('flare', 'ready');
  // more creatures rise from the ground
  rise('clay4', -3.2, 1.2, P * 0.1); rise('clay5', 3.4, 2.0, -P * 0.2, 1.8, 0.4); rise('clay6', 0.6, -1.0, 0, 1.8, 0.8);
  D.sfx('rumble', 0, 0.6); D.sfx('clayRise', 0.1, 0.8); D.sfx('clayRise', 0.7, 0.6); D.shake(0.25, 1.6);
  D.cam(FIX([-5.6, 1.6, 8.8], [0.2, 0.8, 0.6], { fov: 54 }));
  D.sound('More creatures emerge from the ground', 2.4); D.wait(2.8);
  D.say('leon', 'Everyone, watch your surroundings!', { cam: R('leon', -20, 2.3, 0.15), act: 'brace', expr: 'serious', dur: 1.9 });
  D.act('leon', 'ready');
  // Aaron's blue blast
  D.faceChar('aaron', 'clay6', 0.3); D.act('aaron', 'oneHandBlast', 0.2);
  {
    const [cx, cz] = pos('clay6');
    blast([0.3, 1.4, 4.4], [cx, 1.2, cz], 0.35, 0.45);
    D.act('clay6', 'knockBack', 0.8); D.anim('clay6.z', cz - 2.2, 0.6, 0.8, 'out');
    D.cam(FIX([3.8, 1.5, 4.6], [-0.4, 1.3, 0.6], { fov: 48 }));
    D.sound('Aaron releases a blue energy blast, knocking one creature backward', 3.0, 0.3); D.wait(2.8);
    D.act('aaron', 'ready'); D.act('clay6', 'golem');
  }
  // Eric the tiger leaps over a creature
  toTiger(0); D.wait(0.4);
  {
    const [tx, tz] = pos('tiger'), [ox, oz] = pos('clay5');
    const ex2 = ox + (ox - tx) * 0.7, ez2 = oz + (oz - tz) * 0.7;
    D.set('tiger.act', 'run'); D.face('tiger', Math.atan2(ox - tx, oz - tz), 0.2);
    D.anim('tiger.x', ex2, 1.2, 0, 'linear'); D.anim('tiger.z', ez2, 1.2, 0, 'linear');
    D.anim('tiger.y', 1.3, 0.6, 0.15, 'out'); D.anim('tiger.y', 0, 0.5, 0.75, 'in'); D.sfx('tigerRoar', 0.1, 0.7);
    D.cam(FIX([ox + 4.6, 1.3, oz + 2.4], [ox, 1.1, oz], { fov: 58 }));
    D.sound('Eric transforms into a tiger and leaps over another creature', 2.6); D.wait(2.2);
    D.set('tiger.act', 'idle');
  }
  // Flare's flame
  D.act('flare', 'flameHand'); D.fx('flame', { who: 'flare', side: 'R', dur: 4.2, size: 0.35 }); D.sfx('flameIgnite', 0, 0.7);
  D.cam(R('flare', -20, 2.0, 0.2, { lookY: -0.1 }));
  D.sound('Flare creates a controlled flame in his hand', 2.0); D.wait(1.8);
  D.say('flare', 'These creatures might have a weakness.', { cam: R('flare', -30, 1.9, 0.15), expr: 'determined', dur: 2.0 });
  D.look('cowboy', 0.35, 0, 0.6);
  D.cam(F(['cowboy'], 20, 2.2, 0.0, { lookY: -0.12, fov: 38 }));
  D.sound('Fred looks toward Flare', 1.6); D.wait(1.8);
  D.act('flare', 'ready');
  D.look('cowboy', 0, 0, 0.4); D.act('cowboy', 'summon');
  rise('clay7', -1.4, -2.6, 0.2, 1.6, 0.4); rise('clay8', 2.2, -3.4, -0.3, 1.6, 0.8);
  D.sfx('clayRise', 0.3, 0.7); D.sfx('rumble', 0.3, 0.5);
  D.cam(FIX([0.4, 0.9, 3.0], [0.4, 1.0, -6], { fov: 54 }));
  D.sound('He raises his hand again. More clay creatures rise from the pavement', 3.2); D.wait(3.0);
  D.act('cowboy', 'idle');
  D.say('greg', 'HOW MANY OF THESE THINGS DOES HE HAVE?!', { cam: R('greg', 20, 2.2, 0.15), act: 'armsOut', expr: 'shocked', dur: 2.0 });
  D.act('greg', 'ready');
  // Fred gets away
  {
    const hx = D.val('horse.x', D.now), hz = D.val('horse.z', D.now), hry = D.val('horse.ry', D.now);
    const lx = hx + Math.cos(hry) * 0.7, lz = hz - Math.sin(hry) * 0.7;
    D.path('cowboy', [[lx, lz]], 1.6); D.face('cowboy', hry, 0.3, 0.8);
    D.cam(FIX([-2.0, 1.6, -7.0], [hx, 1.4, hz], { fov: 44 })); D.wait(1.0);
    D.act('cowboy', 'mount');
    D.anim('cowboy.x', hx, 1.2, 0.1); D.anim('cowboy.z', hz, 1.2, 0.1); D.anim('cowboy.y', 1.18, 1.2, 0.1);
    D.sound('Fred climbs onto his horse', 1.8); D.wait(1.5);
    ride(); D.anim('horse.glow', 2.2, 0.8); D.sfx('crystalHum', 0, 0.6);
    D.sound('The horse begins glowing', 1.6); D.wait(1.0);
  }
  D.say('aaron', "HE'S GETTING AWAY!", { cam: R('aaron', 20, 2.2, 0.15), act: 'point', expr: 'angry', dur: 1.4 });
  D.cam(FIX([-2.0, 1.6, -7.0], [2.0, 1.4, -12.4], { fov: 44 }));
  vanish(['cowboy', 'horse'], 0.8);
  D.sound('Fred and the horse disappear', 1.8, 0.2); D.wait(2.0);
  D.say('eric', 'Not this time!', { label: 'TIGER ERIC', cam: F(['tiger'], 200, 2.6, 0.3, { lookY: -0.4 }), dur: 1.3 });
  D.set('tiger.act', 'roar'); D.sfx('tigerRoar', 0, 0.7); D.wait(0.8);
  // the creatures lumber off down the street
  for (const c of CLAY) { D.act(c, 'golem'); D.path(c, [[D.val(`${c}.x`, D.now) * 0.4, -30]], 1.6); }
  D.set('tiger.act', 'run'); D.path('tiger', [[0, -8]], 6.0);
  for (const [c, x] of [['aaron', 0.4], ['flare', -1.2], ['greg', -2.4], ['leon', 2.2]]) D.path(c, [[x, -5]], 3.2);
  D.cam(FIX([0, 2.2, 9.0], [0, 1.0, -14], { fov: 50 }));
  D.sound('The clay creatures retreat down the street. The team chases after them', 2.8); D.wait(2.6);
  D.anim('fade', 1, 0.4); D.wait(0.5);

  // ===================================================================== SCENE 6: THE FINAL SHOWDOWN
  D.scene('6. The Final Showdown');
  D.location('whExt');
  cast(['aaron', 'flare', 'eric', 'greg', 'leon', 'clay2', 'clay4', 'clay5']);
  D.set('police.lights', 0); D.set('pcar0.vis', 0); D.set('pcar1.vis', 0);
  for (const [c, x, z] of [['clay2', -0.6, 4.0], ['clay4', 1.0, 5.2], ['clay5', -1.6, 6.0]]) { D.place(c, x, z, P); D.act(c, 'golem'); D.path(c, [[x * 0.3, -2.0]], 1.4); }
  for (const [c, x, z] of [['aaron', 0.3, 18], ['flare', -1.0, 18.8], ['eric', 1.4, 18.8], ['greg', -2.2, 19.6], ['leon', 2.4, 19.6]]) { D.place(c, x, z, P); D.act(c, 'idle'); D.expr(c, 'determined'); D.path(c, [[x, z - 6]], 2.6); }
  D.anim('fade', 0, 0.4); D.music('tense', 0.4, 0, 0.4);
  D.cam(FIX([9.5, 1.8, 15.5], [0, 2.4, 1.0], { pos2: [9.0, 1.8, 14.5], fov: 50 }));
  D.card('location', 3.0, { text: 'ABANDONED WAREHOUSE' });
  D.sound('The team follows the clay creatures toward an abandoned warehouse', 3.0, 0.4); D.wait(3.8);
  D.anim('fade', 1, 0.3); D.wait(0.35);
  // inside
  D.location('warehouse');
  cast(['aaron', 'flare', 'eric', 'greg', 'leon', 'cowboy', 'horse', ...CLAY]);
  D.place('cowboy', 0.9, -8.9, P); D.set('cowboy.y', 0); D.act('cowboy', 'idle'); D.set('cowboy.alpha', 1); props('cowboy');
  D.place('horse', 3.6, -11.6, -0.4); D.set('horse.alpha', 1); D.set('horse.glow', 0.3); D.set('horse.act', 'idle');
  const ring = [];
  CLAY.forEach((c, i) => { const a = -P * 0.75 + (i / 7) * P * 1.5; const x = Math.sin(a) * 6.5, z = -3.6 + Math.cos(a) * 3.0; ring.push([c, x, z]); D.place(c, x, z, Math.atan2(-x, 2.7 - z)); D.act(c, 'golem'); });
  for (const [c, x, z] of [['aaron', 0, 9.2], ['flare', -1.3, 9.8], ['eric', 1.3, 9.8], ['greg', -2.4, 10.4], ['leon', 2.4, 10.4]]) { D.place(c, x, z, P); D.act(c, 'idle'); D.expr(c, 'determined'); props(c); }
  for (const [c, x, z] of [['aaron', 0, 2.2], ['flare', -1.3, 2.8], ['eric', 1.3, 2.8], ['greg', -2.4, 3.4], ['leon', 2.4, 3.4]]) D.path(c, [[x, z]], 2.0);
  D.anim('fade', 0, 0.3);
  D.cam(FIX([0.4, 2.2, 10.6], [0.8, 1.3, -9], { fov: 40 }));
  D.sound('Inside, Fred is standing beside several stolen objects. His horse stands behind him', 3.8, 0.2); D.wait(4.0);
  D.say('aaron', "It's over, cowboy.", { cam: R('aaron', 20, 2.3, 0.15), dur: 1.4 });
  D.face('cowboy', 0, 1.2);
  D.cam(F(['cowboy'], 0, 2.8, 0.0, { lookY: -0.15, fov: 38 }));
  D.sound('Fred slowly turns around', 1.6); D.wait(1.8);
  D.act('cowboy', 'summon'); D.sfx('crystalHum', 0, 0.5);
  // the clay creatures surround the team
  ring.forEach(([c], i) => {
    const a = -P + ((i + 0.5) / 8) * P * 2;
    D.act(c, 'golemReach');
    D.path(c, [[Math.sin(a) * 4.8, 2.7 + Math.cos(a) * 4.4], [Math.sin(a) * 3.3, 2.7 + Math.cos(a) * 3.0]], 1.6);
  });
  D.sfx('clayRise', 0, 0.5); D.sfx('claySquish', 0.8, 0.4);
  D.cam(FIX([0.5, 6.6, 8.8], [0, 0, 1.6], { fov: 56 }));
  D.sound('He raises his hand. The clay creatures surround the team', 3.0); D.wait(3.2);
  D.act('cowboy', 'idle');
  for (const [c] of ring) D.faceTo(c, 0, 2.8, 0.4);
  D.say('leon', 'We need to separate Fred from those creatures!', { cam: R('leon', -20, 2.3, 0.15), act: 'brace', dur: 2.2 });
  D.act('leon', 'ready');
  D.say('eric', "I'll handle the horse!", { cam: R('eric', 15, 2.2, 0.15), act: 'fistPump', expr: 'grin', dur: 1.4 });
  // Eric (tiger) charges the horse: it vanishes
  toTiger(0); D.wait(0.4);
  {
    D.set('tiger.act', 'run'); D.sfx('tigerRoar', 0, 0.7);
    D.path('tiger', [[1.6, -2.0], [3.2, -10.2]], 7.0);
    D.anim('horse.glow', 2.2, 0.4, 0.6); vanish(['horse'], 0.5, 1.0);
    D.cam(FIX([7.5, 1.6, -3.5], [2.6, 0.8, -9.6], { fov: 46 }));
    D.sound('Eric transforms into a tiger and charges toward the horse', 2.6); D.wait(2.0);
    D.set('tiger.act', 'idle'); D.face('tiger', 2.2, 0.3); D.face('tiger', -1.0, 0.3, 0.4);
    D.sound('The horse disappears, leaving Eric confused', 2.2); D.wait(1.6);
  }
  D.say('eric', "WHERE'D IT GO?!", { label: 'TIGER ERIC', cam: F(['tiger'], 120, 2.4, 0.3, { lookY: -0.3 }), dur: 1.3 });
  D.place('horse', 3.4, -12.8, 0); D.set('horse.alpha', 0); D.set('horse.glow', 1.2);
  appear(['horse'], 0.6, 0.1); D.set('horse.act', 'snort', 0.5); D.sfx('horseSnort', 0.5, 0.7);
  D.cam(FIX([6.0, 1.4, -6.0], [3.0, 1.0, -11.6], { fov: 46 }));
  D.sound('The horse reappears behind him', 1.8); D.wait(1.9);
  D.face('tiger', P, 0.3);
  D.say('eric', 'OH, COME ON!', { label: 'TIGER ERIC', cam: F(['tiger'], 300, 2.2, 0.3, { lookY: -0.3 }), dur: 1.2 });
  D.set('horse.act', 'idle'); D.path('horse', [[0.0, -11.0], [-5.5, -6.0]], 6.5); D.sfx('gallop', 0, 0.8); D.anim('tiger.spin', 0, 0.1);
  D.face('tiger', -2.2, 0.5, 0.3);
  D.cam(FIX([-1.0, 1.2, -4.0], [1.2, 1.2, -10.4], { pos2: [-1.2, 1.2, -4.4], fov: 54 }));
  D.sound('The horse gallops past him', 1.8); D.wait(1.6);
  D.set('horse.act', 'idle');
  // Greg wraps up two creatures
  {
    const [ax, az] = pos('clay2'), [bx, bz] = pos('clay3');
    D.set('greg.tLx', ax); D.set('greg.tLy', 1.15); D.set('greg.tLz', az); D.set('greg.tRx', bx); D.set('greg.tRy', 1.15); D.set('greg.tRz', bz); D.set('greg.bendL', 0.5); D.set('greg.bendR', -0.5); D.set('greg.sag', 0.15);
    D.act('greg', 'stretchArms'); D.anim('greg.stretch', 1, 0.6); D.sfx('stretchBoing', 0, 0.8);
    D.act('clay2', 'pinned', 0.5); D.act('clay3', 'pinned', 0.5);
    D.cam(FIX([-6.4, 2.6, 7.2], [-2.6, 1.0, 1.6], { fov: 52 }));
    D.sound('Greg stretches his arms around two clay creatures', 2.4); D.wait(2.2);
  }
  D.say('greg', 'FLARE! DO SOMETHING!', { cam: R('greg', 20, 2.3, 0.15), expr: 'worried', dur: 1.5 });
  D.say('flare', "I'm working on it!", { cam: R('flare', -15, 2.2, 0.15), expr: 'determined', dur: 1.2 });
  // the heat wave
  {
    const [fx0, fz0] = pos('flare');
    D.act('flare', 'pushHeat'); D.set('flare.suitGlow', 0.6);
    D.fx('heatWave', { x: fx0, z: fz0, dir: -P * 0.62, spread: 2.4, speed: 4.5, maxR: 4.4, dur: 3.6, n: 30, size: 0.42 });
    D.anim('wh.heat', 1, 0.4); D.sfx('heatWave', 0, 0.9); D.sfx('fireRoar', 0.3, 0.5);
    D.cam(FIX([fx0 + 2.6, 2.2, fz0 + 4.6], [fx0 - 1.0, 0.6, fz0 - 3.0], { fov: 56 }));
    D.sound('Flare raises both hands and sends a controlled wave of heat across the floor', 3.2); D.wait(2.0);
    // the clay softens and melts
    for (const c of ['clay1', 'clay2', 'clay3']) { D.act(c, 'melt'); D.anim(`${c}.melt`, 1, 2.6, 0.2); const [x, z] = pos(c); D.fx('dustCloud', { x, y: 0.2, z, n: 10, dur: 2.2, radius: 0.6, h: 1.4, size: 0.16, color: 0xd8d4cc, color2: 0xb8b2a8 }, 0.3); }
    D.anim('greg.stretch', 0, 0.5, 0.4); D.act('greg', 'ready', 0.6);
    D.sfx('sizzle', 0, 0.8);
    D.cam(FIX([-4.2, 1.2, 0.0], [-1.6, 0.6, 1.2], { fov: 50 }));
    D.sound('The clay begins softening and melting into harmless puddles', 3.0); D.wait(2.6);
  }
  D.say('greg', "IT'S WORKING!", { cam: R('greg', 20, 2.2, 0.15), act: 'cheer', expr: 'grin', dur: 1.1 });
  D.say('aaron', 'KEEP GOING!', { cam: R('aaron', 20, 2.2, 0.15), act: 'fistPump', expr: 'determined', dur: 1.1 });
  {
    const [fx0, fz0] = pos('flare');
    D.act('flare', 'pushHeat', 0);
    D.fx('heatWave', { x: fx0, z: fz0, dir: P * 0.55, spread: 4.4, speed: 4.5, maxR: 5.0, dur: 3.2, n: 40, size: 0.42 });
    D.sfx('heatWave', 0, 0.9); D.sfx('sizzle', 0.6, 0.8);
    for (const c of ['clay4', 'clay5', 'clay6', 'clay7', 'clay8']) { D.act(c, 'melt', 0.4); D.anim(`${c}.melt`, 1, 2.2, 0.6); const [x, z] = pos(c); D.fx('dustCloud', { x, y: 0.2, z, n: 10, dur: 2.2, radius: 0.6, h: 1.4, size: 0.16, color: 0xd8d4cc, color2: 0xb8b2a8 }, 0.6); }
    D.cam(FIX([0.6, 6.4, 9.6], [0, 0, 1.6], { fov: 52 }));
    D.sound('Flare creates another wave of heat. The remaining clay creatures collapse', 3.2); D.wait(3.4);
    D.act('flare', 'ready'); D.set('flare.suitGlow', 0); D.anim('wh.heat', 0, 0.8);
  }
  D.look('cowboy', 0.6, 0, 0.5); D.look('cowboy', -0.6, 0, 0.6, 0.6); D.look('cowboy', 0, 0, 0.4, 1.3); D.act('cowboy', 'gasp', 1.5);
  D.cam(F(['cowboy'], 15, 2.4, 0.0, { lookY: -0.15, fov: 38 }));
  D.sound('Fred looks around. For the first time, he seems surprised', 2.6); D.wait(2.6);
  D.act('cowboy', 'idle');
  D.say('flare', 'Your little army is finished.', { cam: R('flare', -15, 2.2, 0.15), act: 'handsHips', expr: 'smug', dur: 1.8 });
  D.act('flare', 'ready');
  // Fred goes for his horse; the team stops him
  D.place('horse', -4.0, -7.4, 1.6); D.set('horse.alpha', 1); D.set('horse.glow', 0.6);
  D.place('tiger', 1.4, -6.2, -1.0); D.set('tiger.act', 'idle');
  D.faceTo('cowboy', -4.0, -7.4, 0.4); D.path('cowboy', [[-1.6, -8.2]], 1.6, 0.3);
  D.say('aaron', 'Not so fast!', { cam: R('aaron', 20, 2.2, 0.15), act: 'oneHandBlast', expr: 'angry', dur: 1.1 });
  blast([0.3, 1.4, 1.6], [-2.8, 0.15, -7.6], 0.35, 0);
  D.set('horse.act', 'rear', 0.45); D.sfx('horseNeigh', 0.45, 0.9);
  D.cam(FIX([1.2, 1.6, -2.0], [-3.0, 1.2, -7.6], { fov: 48 }));
  D.sound("Aaron fires a blue energy burst that blocks the horse's path", 2.6); D.wait(2.4);
  D.act('aaron', 'ready');
  { const tl = D.path('leon', [[-3.6, -5.8]], 5.0); D.act('leon', 'brace', tl); D.faceTo('leon', -4.0, -7.4, 0.2, tl); }
  D.set('horse.act', 'rear', 1.4); D.sfx('horseNeigh', 1.4, 0.7); D.sfx('punchHit', 1.8, 0.6);
  D.cam(FIX([-0.4, 1.5, -3.2], [-3.8, 1.3, -6.8], { fov: 46 }));
  D.sound('Leon rushes forward and uses his super strength to stop the horse', 3.0); D.wait(3.2);
  D.set('horse.act', 'idle');
  // Eric changes back and calls out to Fred
  toEric(0, 'point'); D.wait(0.5);
  D.faceChar('eric', 'cowboy', 0.3); D.faceChar('cowboy', 'eric', 0.5);
  D.say('eric', "Hey, cowboy! Your ride's over!", { cam: R('eric', 20, 2.2, 0.15), act: 'point', expr: 'grin', dur: 1.8 });
  D.act('eric', 'ready');
  // he tries to vanish again; Flare's heat breaks the glow
  D.act('cowboy', 'summon'); D.anim('horse.glow', 2.4, 0.6); D.anim('horse.alpha', 0.45, 0.8, 0.3); D.anim('cowboy.alpha', 0.45, 0.8, 0.3); D.sfx('vanish', 0.2, 0.6);
  D.cam(FIX([1.0, 1.7, -3.0], [-2.6, 1.3, -7.8], { fov: 48 }));
  D.sound('Fred tries to activate his invisibility again', 2.2); D.wait(1.6);
  {
    D.act('flare', 'oneHandBlast'); D.faceTo('flare', -4.0, -7.4, 0.2);
    D.fx('beam', { who: 'flare', side: 'R', to: [-4.0, 1.4, -7.4], dur: 1.4, color: 0xff7a20, width: 0.14 }, 0.2);
    D.sfx('fireBreath', 0.2, 0.7);
    D.anim('horse.glow', 0, 0.8, 1.0); D.anim('horse.alpha', 1, 0.6, 1.1); D.anim('cowboy.alpha', 1, 0.6, 1.1); D.sfx('energyFizzle', 1.1, 0.7);
    D.cam(FIX([-6.6, 1.9, -1.2], [-2.4, 1.2, -6.8], { fov: 52 }));
    D.sound("Flare directs another controlled burst of heat toward the horse's glowing energy", 3.2); D.wait(2.8);
    D.act('flare', 'ready'); D.act('cowboy', 'idle');
    D.cam(FIX([0.2, 1.6, -3.6], [-2.6, 1.2, -7.8], { fov: 44 }));
    D.sound('The glow fades. Fred and his horse become completely visible', 2.6); D.wait(2.8);
  }
  D.say('greg', 'THERE WE GO!', { cam: R('greg', 20, 2.2, 0.15), act: 'cheer', expr: 'grin', dur: 1.2 });
  D.act('greg', 'idle');
  // Leon secures Fred
  {
    const [cx, cz] = pos('cowboy');
    D.path('leon', [[cx + 0.6, cz + 0.5]], 2.0); D.faceChar('leon', 'cowboy', 0.3, 0.8);
    D.act('leon', 'grabArm', 1.0); D.act('cowboy', 'cuffed', 1.2); D.sfx('lockClick', 1.3, 0.8);
    D.cam(FIX([cx + 2.4, 1.6, cz + 2.6], [cx + 0.2, 1.3, cz], { fov: 44 }));
    D.sound('Leon steps forward and secures Fred', 2.2); D.wait(2.4);
    D.say('leon', "You're under arrest.", { cam: R('leon', -25, 2.0, 0.12), expr: 'serious', dur: 1.5 });
    D.cam(F(['cowboy'], -45, 2.3, 0.0, { lookY: -0.15, fov: 38 }));
    D.sound('Fred remains silent', 1.6); D.wait(1.8);
  }
  D.anim('fade', 1, 0.5); D.wait(0.6);

  // ===================================================================== SCENE 7: CASE CLOSED
  D.scene('7. Case Closed');
  D.location('whExt');
  cast(['aaron', 'flare', 'eric', 'greg', 'leon', 'cowboy', 'horse', 'officer', 'officer2']);
  D.set('police.lights', 1); D.set('pcar0.vis', 1); D.set('pcar1.vis', 1);
  D.set('pcar0.x', -26); D.set('pcar0.z', 9.5); D.set('pcar0.ry', 0);
  D.anim('pcar0.x', -4.5, 2.6, 0, 'out'); D.anim('pcar0.z', 7.5, 2.6, 0, 'out'); D.anim('pcar0.ry', 0.35, 2.6, 0, 'out');
  D.set('pcar1.x', 26); D.set('pcar1.z', 10.5); D.set('pcar1.ry', P);
  D.anim('pcar1.x', 5.0, 2.8, 0.3, 'out'); D.anim('pcar1.z', 8.5, 2.8, 0.3, 'out'); D.anim('pcar1.ry', P - 0.5, 2.8, 0.3, 'out');
  for (const [c, x, z, ry] of [['aaron', -1.3, 4.2, P], ['flare', -2.6, 4.3, P], ['eric', 0.0, 4.3, P], ['greg', 1.3, 4.4, P], ['leon', 2.4, 3.0, -2.2]]) { D.place(c, x, z, ry); D.act(c, 'idle'); D.expr(c, 'happy'); props(c); }
  D.place('cowboy', 0.6, 1.4, 0.3); D.set('cowboy.y', 0); D.act('cowboy', 'cuffed'); D.set('cowboy.alpha', 1);
  D.place('horse', 4.6, 2.4, 0.3); D.set('horse.alpha', 1); D.set('horse.glow', 0); D.set('horse.act', 'idle');
  D.hide('officer'); D.hide('officer2');
  D.anim('fade', 0, 0.4); D.music('victory', 0.35, 0, 0.6); D.sfx('siren', 0, 0.6); D.sfx('carArrive', 0.4, 0.5); D.sfx('skid', 2.2, 0.4);
  D.cam(FIX([12, 2.6, 18], [0, 1.2, 4], { pos2: [11, 2.4, 16.5], fov: 46 }));
  D.sound('Police vehicles arrive outside the warehouse', 2.4, 0.3); D.wait(2.9);
  D.show('officer'); D.place('officer', -3.2, 6.2, P - 0.4); D.act('officer', 'idle'); D.expr('officer', 'serious');
  D.show('officer2'); D.place('officer2', 3.6, 6.4, P + 0.3); D.act('officer2', 'idle'); D.expr('officer2', 'serious');
  D.sfx('carDoor', 0, 0.5); D.sfx('carDoor', 0.3, 0.4); D.sfx('policeRadio', 0.8, 0.4);
  D.path('officer', [[-0.4, 2.0]], 1.6); D.faceChar('officer', 'cowboy', 0.3, 2.9);
  D.path('officer2', [[4.1, 3.2]], 1.6);
  D.cam(FIX([-1.2, 1.8, 13.0], [-0.4, 1.2, 3.0], { fov: 46 }));
  D.sound('Officers take Fred Yeehaw into custody. His horse is also secured', 3.0); D.wait(3.1);
  D.faceTo('officer', -0.6, 4.2, 0.4); D.faceChar('officer2', 'horse', 0.3); D.act('officer2', 'reach');
  D.say('officer', "We appreciate your help. We've been trying to figure out who was behind these robberies for weeks.", { cam: FIX([1.4, 1.7, 3.2], [-0.4, 1.6, 2.0], { fov: 42 }), dur: 4.0 });
  D.act('officer', 'idle');
  D.say('aaron', 'No problem.', { cam: R('aaron', 15, 2.2, 0.15), act: 'thumbsUp', expr: 'grin', dur: 1.1 });
  D.act('aaron', 'idle');
  D.say('eric', 'Yeah, just another normal night.', { cam: R('eric', 10, 2.2, 0.15), act: 'shrug', expr: 'smug', dur: 1.7 });
  D.act('eric', 'idle');
  D.say('greg', "Can we go home now? I'm hungry.", { cam: R('greg', 0, 2.2, 0.15), expr: 'tired', dur: 1.8 });
  D.faceChar('flare', 'greg', 0.3);
  D.say('flare', 'You are always hungry.', { cam: R('flare', -20, 2.2, 0.15), expr: 'smug', dur: 1.4 });
  D.say('greg', "And I'll always be hungry.", { cam: R('greg', 0, 2.0, 0.15), expr: 'happy', dur: 1.6 });
  // Fred is led away
  D.act('officer', 'grabArm'); D.path('officer', [[-2.9, 1.7], [-3.2, 5.6]], 1.0); D.path('cowboy', [[-3.5, 1.5], [-3.8, 5.4]], 1.0); D.act('cowboy', 'cuffed');
  D.path('officer2', [[8.6, 4.2]], 1.0); D.path('horse', [[8.0, 4.6]], 1.0);
  D.faceChar('leon', 'cowboy', 0.5); D.expr('leon', 'serious');
  D.cam(FIX([2.8, 1.8, 0.9], [-1.6, 1.4, 4.6], { fov: 46 }));
  D.sound('Leon looks at Fred as the officers lead him away', 2.2); D.wait(2.3);
  D.say('leon', "There's something strange about him.", { cam: R('leon', -20, 2.2, 0.15), dur: 1.8 });
  D.faceChar('aaron', 'leon', 0.3);
  D.say('aaron', 'What do you mean?', { cam: R('aaron', 30, 2.2, 0.15), expr: 'surprised', dur: 1.2 });
  D.say('leon', 'His abilities. That horse. The way he creates living creatures from clay.', { cam: R('leon', -20, 2.2, 0.15), dur: 3.4 });
  D.faceChar('flare', 'leon', 0.3);
  D.say('flare', "You think he's not from Earth?", { cam: FIX([-0.9, 1.7, 5.6], [-2.6, 1.55, 4.3], { fov: 40 }), expr: 'worried', dur: 1.8 });
  D.say('leon', "I don't think so.", { cam: R('leon', -20, 2.0, 0.15), dur: 1.4 });
  D.music('mystery', 0.35, 0, 1.0);
  // Fred in the back of the police car
  {
    const cx = -4.5, cz = 7.5, cry = 0.35;
    const W = (lx, lz) => [cx + lx * Math.cos(cry) + lz * Math.sin(cry), cz - lx * Math.sin(cry) + lz * Math.cos(cry)];
    const [sx, sz] = W(-0.82, 0.38);
    for (const c of ['aaron', 'flare', 'eric', 'greg', 'leon', 'officer2', 'horse']) D.hide(c);
    D.place('officer', -1.8, 9.6, -0.5); D.act('officer', 'idle');
    D.place('cowboy', sx, sz, P / 2 + cry); D.set('cowboy.y', 0.14); D.act('cowboy', 'sitCar'); D.set('pcar0.dome', 1); D.set('police.lights', 0); D.set('cowboy.alpha', 1);
    const [px, pz] = W(-0.82, 2.3), [lx, lz] = W(-0.82, 0.3);
    D.cam(FIX([px, 1.5, pz], [lx, 1.38, lz], { pos2: [px * 0.96 + lx * 0.04, 1.48, pz * 0.96 + lz * 0.04], fov: 38 }));
    D.sound('Fred sits silently in the police vehicle', 2.2, 0.2); D.wait(2.4);
    D.look('cowboy', -0.9, 0, 1.2);
    D.sound('He looks out the window', 1.6); D.wait(1.9);
    D.act('cowboy', 'sitTipHat');
    D.sound('He slowly adjusts his cowboy hat', 2.2); D.wait(2.4);
    D.sound('He says nothing', 1.6); D.wait(1.7);
  }
  D.set('fade', 1); D.sfx('cutBlack', 0, 0.5); D.music('none', 0, 0, 0.2); D.wait(1.2);

  // ===================================================================== END CARD
  D.scene('End');
  D.location('title');
  cast([]);
  D.set('fade', 1); D.anim('fade', 0, 0.8);
  D.music('theme', 0.6, 0, 0.1);
  D.set('title.theme', 0); D.set('title.k', 1); D.set('title.sub', 0); D.set('title.y', 1.4); D.set('title.jolt', 0);
  D.cam(FIX([0, 0.6, 10.5], [0, 0.4, 0], { pos2: [0, 0.5, 10.0], fov: 42 }));
  const endDur = 8.5;
  D.card('credits', endDur, {
    lines: [
      { text: 'END OF EPISODE 7', big: true, y: 0.56, color: '#7fd4ff' },
      { text: 'BATTLE WARS WILL RETURN...', bold: true, y: 0.66, color: '#ffd23f' },
      { text: 'Starring  Aaron  ·  Greg  ·  Flare  ·  Eric  ·  Leon  ·  and Fred Yeehaw', y: 0.76 },
      { text: 'Created by Nick', y: 0.83 },
    ],
  });
  D.wait(endDur - 1.6);
  D.anim('fade', 1, 1.5); D.wait(1.6);
  return D.end();
}
