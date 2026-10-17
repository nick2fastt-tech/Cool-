// BATTLE WARS - "The Red Diamonds" scene: Leon's warning and the Soul Stealer awakens.
import { createDirector } from '../src/director.js';

export const META = { id: 's1-red-diamonds', title: 'Battle Wars - The Red Diamonds', file: 'Battle_Wars_The_Red_Diamonds' };

const P = Math.PI;
const ALL = ['aaron', 'flare', 'eric', 'barista', 'leon', 'greg', 'water', 'soul'];

export function buildEpisode() {
  const D = createDirector();
  const F = (on, yaw, dist, h = 0.15, x = {}) => ({ type: 'frame', on: Array.isArray(on) ? on : [on], yaw, dist, h, ...x });
  const R = (on, yaw, dist, h = 0.15, x = {}) => F(on, yaw, dist, h, { rel: Array.isArray(on) ? on[0] : on, ...x });
  const FIX = (pos, look, x = {}) => ({ type: 'fixed', pos, look, ...x });
  const TABLE = [0, 0.2];
  const REACTOR = [0, -4.2];

  for (const c of ALL) { D.hide(c); D.act(c, 'idle'); D.expr(c, 'neutral'); D.set(`${c}.y`, 0); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); }
  D.set('fade', 1);

  // ============================================================ THE HIDDEN REACTOR ROOM
  D.scene('The Hidden Reactor Room');
  D.location('reactor');
  D.set('reactor.power', 0.55); D.set('reactor.flicker', 0.35); D.set('room.lights', 0.85); D.set('holo.on', 1); D.set('holo.diamond', 0);
  D.place('leon', 0, -1.1, 0); D.act('leon', 'leanTable'); D.expr('leon', 'serious');
  D.place('aaron', 1.35, 0.95, 0); D.faceTo('aaron', ...TABLE, 0.01); D.act('aaron', 'idle'); D.expr('aaron', 'determined');
  D.place('flare', -1.35, 0.9, 0); D.faceTo('flare', ...TABLE, 0.01); D.act('flare', 'crossArms'); D.expr('flare', 'serious');
  D.place('eric', 1.75, -0.4, 0); D.faceTo('eric', ...TABLE, 0.01); D.act('eric', 'idle'); D.expr('eric', 'worried');
  D.place('greg', -4.6, -1.75, P / 2); D.act('greg', 'sitSleep'); D.expr('greg', 'sleep');
  D.music('ominous', 0.6, 0, 1.5);
  D.anim('fade', 0, 1.6);
  D.card('location', 3.4, { text: 'BATTLE WARS HQ  -  HIDDEN REACTOR ROOM' });
  D.cam(FIX([5.0, 1.0, 5.8], [0, 1.7, -2.5], { pos2: [3.2, 1.7, 4.3], fov: 46 }));
  D.comic('z z z', 2.2, 2.2, { x: 0.13, y: 0.42, size: 46, rot: -10, c1: '#ffffff', c2: '#bcd0ff' });
  D.sfx('snore', 2.2, 0.5);
  D.wait(4.6);

  D.say('leon', 'According to the old records, there are red diamonds...', { cam: R('leon', -75, 2.2, 0.05, { lookY: -0.05 }), dur: 3.4 });
  D.act('leon', 'pointMap');
  D.say('leon', '...buried beneath the abandoned subway district.', { cam: FIX([0.35, 2.05, 2.5], [0, 2.0, 0.2], { pos2: [0.15, 2.05, 2.0], fov: 46 }), dur: 3.2 });
  D.act('leon', 'leanTable');
  D.anim('holo.diamond', 1, 0.8, 0.1, 'back'); D.sfx('holoChime', 0.1, 0.7);
  D.say('leon', 'These diamonds are the original source of our powers.', { cam: FIX([0.75, 1.5, 1.6], [0, 1.3, 0.2], { pos2: [0.55, 1.45, 1.25], fov: 36 }), dur: 3.4 });
  D.expr('eric', 'worried'); D.expr('aaron', 'worried'); D.act('flare', 'idle');
  D.say('leon', "If we don't recover them, we'll lose our abilities completely.", { cam: F(['aaron', 'flare', 'eric'], 140, 4.4, 0.4, { lookY: -0.25 }), dur: 3.8 });
  D.look('eric', -0.3, 0, 0.5);
  D.faceChar('aaron', 'leon', 0.4);
  D.say('aaron', 'And if somebody else gets there first?', { cam: R('aaron', 75, 2.5, 0.1), expr: 'serious', dur: 2.8 });
  // Leon stares at the map
  D.act('leon', 'leanTable'); D.expr('leon', 'serious'); D.look('leon', 0, 0.12, 0.8);
  D.sound('Leon stares at the map', 2.2);
  D.sfx('drone', 0, 0.7);
  D.cam(R('leon', -58, 2.8, 0.0, { dist2: 1.6, lookY: -0.02, fov: 40 }));
  D.wait(3.0);
  D.say('leon', "Then we're finished.", { dur: 2.4 });
  // the reactor flashes weakly, then shuts down
  D.cam(FIX([3.6, 1.9, 5.2], [0, 1.9, -4.0], { pos2: [3.0, 1.8, 4.6], fov: 50 }));
  D.set('reactor.flash', 0.6); D.anim('reactor.flash', 0, 0.5);
  D.sfx('reactorFlash', 0, 0.8);
  for (const c of ['aaron', 'flare', 'eric', 'leon']) { D.faceTo(c, ...REACTOR, 0.5, 0.2); D.look(c, 0, 0, 0.3); D.expr(c, 'surprised', 0.3); }
  D.set('reactor.flicker', 1, 0.6);
  D.anim('reactor.power', 0, 1.3, 0.8, 'in'); D.set('reactor.flicker', 0, 2.1);
  D.sfx('powerDown', 0.7, 0.9); D.shake(0.06, 1.0, 1.9);
  D.anim('room.lights', 0.3, 0.9, 1.0); D.set('holo.glitch', 1, 0.8); D.anim('holo.on', 0.45, 1.0, 1.2); D.set('holo.glitch', 0, 2.3);
  D.sound('The reactor flashes weakly... then shuts down', 2.6, 0.2);
  D.wait(3.4);
  for (const c of ['aaron', 'flare', 'eric', 'leon']) D.expr(c, 'worried');
  D.wait(0.6);
  // Greg
  D.act('greg', 'sitWake'); D.expr('greg', 'tired');
  D.say('greg', '...Can I go back to sleep now?', { cam: R('greg', 25, 2.3, 0.2, { lookY: -0.15 }), dur: 2.8, dt: 0.4 });
  for (const c of ['aaron', 'flare', 'eric', 'leon']) D.faceChar(c, 'greg', 0.4);
  D.act('flare', 'facepalm'); D.expr('flare', 'annoyed'); D.expr('eric', 'grin'); D.expr('aaron', 'annoyed'); D.expr('leon', 'serious');
  D.cam(F(['flare', 'eric', 'aaron'], 250, 5.6, 0.4, { lookY: -0.25 }));
  D.wait(1.6);
  D.set('fade', 1);
  D.wait(0.25);

  // ============================================================ TITLE CARD: electric red letters slam on
  D.scene('Title');
  D.location('title');
  for (const c of ALL) D.hide(c);
  D.set('fade', 0);
  D.music('darkTheme', 0.85, 0, 0.05);
  D.set('title.theme', 1); D.set('title.sub', 0); D.set('title.y', 0); D.set('title.k', 3.6);
  D.anim('title.k', 1, 0.22, 0, 'in');
  D.set('title.jolt', 1, 0.22); D.anim('title.jolt', 0, 0.8, 0.22);
  D.set('flash', 0.85, 0.22); D.anim('flash', 0, 0.45, 0.22);
  D.sfx('electricSlam', 0.2, 1.0); D.shake(0.5, 0.6, 0.22);
  D.card('electric', 3.3, {});
  D.cam(FIX([0, 0, 11.2], [0, 0, 0], { pos2: [0, 0, 10.4], fov: 40 }));
  D.wait(3.6);
  D.anim('fade', 1, 0.3);
  D.wait(0.35);

  // ============================================================ DEEP BENEATH THE CHAMBER
  D.scene('The Soul Stealer');
  D.location('cavern');
  D.set('fade', 0);
  D.music('none', 0, 0, 0.5);
  D.set('cave.glow', 0.45); D.set('cave.ring', 0);
  D.place('soul', 0, -2, 0); D.set('soul.y', 0.35); D.set('soul.eyes', 0); D.set('soul.palm', 0); D.set('soul.raise', 0); D.set('soul.look', 0);
  D.card('location', 3.0, { text: 'DEEP BENEATH THE CHAMBER' });
  D.sfx('rumbleDeep', 0, 0.8); D.sfx('drip', 1.2, 0.5); D.sfx('drip', 3.1, 0.4);
  D.cam(FIX([0, 7.2, 6.5], [0, 1.0, -2], { pos2: [0.4, 2.0, 3.0], look2: [0, 2.1, -2], fov: 44 }));
  D.wait(5.2);
  // the eyes open
  D.cam(FIX([0.25, 2.4, -0.55], [0, 2.38, -2], { pos2: [0.18, 2.4, -0.8], fov: 34 }));
  D.wait(0.8);
  D.anim('soul.eyes', 1, 0.7, 0, 'out'); D.sfx('eyesOpen', 0, 0.9);
  D.anim('cave.glow', 0.75, 1.0);
  D.music('soul', 0.6, 0.3, 0.5);
  D.wait(2.0);
  // red symbol in his palm
  D.cam(FIX([0.3, 2.2, 0.9], [-0.35, 1.95, -1.3], { pos2: [0.2, 2.15, 0.5], fov: 44 }));
  D.anim('soul.raise', 1, 1.0);
  D.anim('soul.palm', 1, 0.7, 1.0, 'back'); D.sfx('symbolGlow', 1.0, 0.9);
  D.anim('cave.ring', 1, 0.8, 1.1);
  D.wait(2.4);
  D.say('soul', 'The boy has made his choice.', { cam: R('soul', 0, 3.4, -0.7, { lookY: -0.25, dist2: 2.8 }), dur: 3.2 });
  // he looks toward the surface
  D.anim('soul.look', 1, 1.4);
  D.cam(FIX([1.4, 0.6, 0.6], [0, 2.7, -2], { pos2: [1.1, 0.55, 0.2], fov: 44 }));
  D.sfx('rumbleDeep', 0.2, 0.6);
  D.wait(1.8);
  D.say('soul', 'Let the war begin.', { dur: 2.8 });
  D.anim('soul.eyes', 1.4, 0.3, -1.0); D.anim('cave.glow', 1, 0.4, -1.0); D.sfx('warHit', -1.0, 1.0); D.shake(0.15, 0.8, -1.0);
  // cut to black
  D.set('fade', 1);
  D.music('none', 0, 0, 0.1);
  D.sfx('cutBlack', 0, 0.7);
  D.wait(2.2);
  return D.end();
}
