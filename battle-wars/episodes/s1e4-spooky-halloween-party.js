// BATTLE WARS - Season 1, Episode 4: "SPOOKY HALLOWEEN PARTY" (Halloween special)
import { createDirector } from '../src/director.js';

export const META = {
  id: 's1e4-spooky-halloween-party', title: 'Battle Wars - S1E4 - Spooky Halloween Party', file: 'Battle_Wars_S1E4_Spooky_Halloween_Party', costume: 'red',
  halloween: true, outfits: ['pj', 'party'], extras: { eric: ['monsterMask'], aaron: ['milkStain'] },
};

const P = Math.PI;
const ALL = ['aaron', 'flare', 'eric', 'barista', 'leon', 'greg', 'newark', 'water', 'soul', 'dog', 'birddog'];
const TEAM = ['aaron', 'flare', 'eric', 'greg'];

export function buildEpisode() {
  const D = createDirector();
  const F = (on, yaw, dist, h = 0.15, x = {}) => ({ type: 'frame', on: Array.isArray(on) ? on : [on], yaw, dist, h, ...x });
  const R = (on, yaw, dist, h = 0.15, x = {}) => F(on, yaw, dist, h, { rel: Array.isArray(on) ? on[0] : on, ...x });
  const FIX = (pos, look, x = {}) => ({ type: 'fixed', pos, look, ...x });
  const cast = (list) => { for (const c of ALL) { if (!list.includes(c)) D.hide(c); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); } };
  const props = (c, r = 'none', l = 'none') => { D.set(`${c}.propR`, r); D.set(`${c}.propL`, l); };
  const outfit = (list, o) => { for (const c of list) D.set(`${c}.outfit`, o); };
  const pos = (c) => [D.val(`${c}.x`, D.now), D.val(`${c}.z`, D.now)];
  const jump = (c, h, dur, dt = 0) => { D.anim(`${c}.y`, D.val(`${c}.y`, D.now + dt) + h, dur / 2, dt, 'out'); D.anim(`${c}.y`, D.val(`${c}.y`, D.now + dt), dur / 2, dt + dur / 2, 'in'); };
  const crowd = (text, dur = 1.6) => D.say('crowd', text, { dur });

  for (const c of ALL) { D.hide(c); D.act(c, 'idle'); D.expr(c, 'neutral'); D.set(`${c}.y`, 0); D.set(`${c}.hy`, 0); D.set(`${c}.hn`, 0); props(c); D.set(`${c}.outfit`, 'base'); D.set(`${c}.mask`, 0); }
  D.set('fade', 1); D.set('aaron.hairGlow', 0); D.set('aaron.suitGlow', 0); D.set('aaron.milk', 0);

  // ===================================================================== SCENE 1: MORNING ALREADY?!
  D.scene('1. Morning Already?!');
  D.location('bedroom');
  cast(['aaron', 'flare']);
  outfit(['aaron', 'flare'], 'pj');
  D.place('flare', -2.6, -2.35, 0); D.set('flare.y', 0.55); D.act('flare', 'lieSleep'); D.expr('flare', 'sleep');
  D.place('aaron', 2.45, -2.35, 0); D.set('aaron.y', 0.55); D.act('aaron', 'lieSleep'); D.expr('aaron', 'sleep');
  D.set('blanket.flare', 0); D.set('blanket.aaron', 0); D.set('alarm.ring', 0);
  D.music('none', 0, 0, 0);
  D.anim('fade', 0, 1.2);
  D.sfx('birds', 0.3, 0.4); D.sfx('snore', 0.8, 0.35);
  D.cam(FIX([0.2, 2.6, 3.4], [0, 0.6, -2.4], { pos2: [0.2, 2.3, 2.6], fov: 52 }));
  D.card('location', 3.2, { text: 'RED TEAM HQ  -  BEDROOM  -  OCTOBER 31' });
  D.wait(3.4);
  D.cam(FIX([1.38, 0.9, -2.35], [1.38, 0.73, -3.0], { fov: 32 }));
  D.sound('The clock reads 8:00 AM', 1.6); D.wait(1.8);
  // the alarm
  D.set('alarm.ring', 1); D.sfx('alarmRing', 0, 0.8, { repeat: 4, every: 2.0 });
  D.say('computer', 'BEEP! BEEP! BEEP! BEEP!', { label: 'ALARM CLOCK', dur: 2.0 });
  D.comic('BEEP!', -1.8, 0.9, { x: 0.3, y: 0.32, size: 96, rot: -10, c1: '#ffffff', c2: '#ff5050' });
  D.comic('BEEP!', -0.9, 0.9, { x: 0.72, y: 0.3, size: 84, rot: 8, c1: '#ffffff', c2: '#ff5050' });
  D.cam(FIX([-1.75, 1.95, -2.1], [-2.6, 0.75, -3.0], { fov: 44 }));
  D.expr('flare', 'tired'); D.wait(0.8);
  D.say('flare', '...No.', { dur: 1.5 });
  D.say('flare', 'Absolutely not.', { dur: 1.6 });
  D.anim('blanket.flare', 1, 0.6); D.sfx('blanket', 0, 0.6); D.set('flare.vis', 0, 0.5); D.set('blanket.flare.lump', 1, 0.5);
  D.cam(FIX([-1.0, 1.7, -0.4], [-2.6, 0.6, -2.4], { fov: 46 })); D.sound('Flare pulls his blanket over his head', 1.8); D.wait(2.0);
  // Aaron slaps the alarm
  D.cam(FIX([3.6, 1.5, -1.0], [1.7, 0.6, -2.9], { fov: 48 }));
  D.act('aaron', 'lieSlap'); D.wait(0.4);
  D.sfx('slap', 0, 0.9); D.sfx('alarmClick', 0.02, 0.8); D.set('alarm.ring', 0);
  D.comic('SLAP!', 0, 0.7, { x: 0.35, y: 0.4, size: 90, rot: -6 });
  D.wait(0.8);
  D.act('aaron', 'lieSleep');
  D.sound('Silence.', 1.4); D.wait(1.5);
  D.expr('aaron', 'tired');
  D.say('aaron', 'Morning already?', { cam: FIX([1.6, 1.95, -2.1], [2.45, 0.75, -3.0], { fov: 44 }), dur: 1.8 });
  D.say('flare', 'I guess so.', { label: 'FLARE (UNDER THE BLANKET)', cam: FIX([-1.2, 1.5, -0.6], [-2.6, 0.7, -2.2], { fov: 44 }), dur: 1.6 });
  // Aaron sits up and stretches
  D.act('aaron', 'sitStretch'); D.sfx('yawn', 0.3, 0.7);
  D.cam(R('aaron', 25, 2.6, 0.2, { lookY: -0.3 })); D.wait(2.4);
  D.act('aaron', 'sitBed');
  D.say('aaron', 'What time is it?', { dur: 1.7 });
  D.say('flare', 'Eight.', { label: 'FLARE (UNDER THE BLANKET)', cam: FIX([-1.2, 1.5, -0.6], [-2.6, 0.7, -2.2], { fov: 44 }), dur: 1.2 });
  D.say('aaron', 'Eight?!', { cam: R('aaron', 20, 2.2, 0.15, { lookY: -0.2 }), expr: 'shocked', dur: 1.2 });
  D.act('aaron', 'lieSleep'); D.sfx('thud', 0.2, 0.5); D.expr('aaron', 'tired', 0.3);
  D.cam(FIX([3.6, 1.6, -0.8], [2.45, 0.6, -2.5], { fov: 44 })); D.wait(1.0);
  D.say('aaron', 'Wake me up tomorrow.', { dur: 1.9 });
  // Flare throws off the blanket
  D.anim('blanket.flare', 0, 0.4); D.set('blanket.flare.lump', 0); D.set('flare.vis', 1); D.act('flare', 'sitBed'); D.expr('flare', 'annoyed'); D.sfx('blanket', 0, 0.6);
  D.say('flare', 'You literally just woke up!', { cam: R('flare', 30, 2.4, 0.15, { lookY: -0.25 }), act: 'sitBed', dur: 2.0, dt: 0.2 });
  D.say('aaron', "And I'm already tired.", { cam: FIX([3.6, 1.6, -0.8], [2.45, 0.6, -2.5], { fov: 44 }), dur: 1.9 });
  // Flare gets up and goes to the mirror
  D.cam(FIX([-1.0, 1.7, 2.6], [-3.2, 1.0, -0.6], { fov: 48 }));
  D.place('flare', -3.5, -1.2, P / 2); D.set('flare.y', 0); D.act('flare', 'stretch'); D.expr('flare', 'neutral'); D.set('blanket.flare.off', 1);
  D.wait(1.4);
  D.act('flare', 'idle');
  D.path('flare', [[-3.35, 0.9]], 1.2); D.face('flare', -P / 2, 0.4, 1.6);
  D.wait(2.0);
  D.act('flare', 'touchHair');
  D.say('flare', 'At least today should be peaceful.', { cam: F(['flare'], -128, 1.45, 0.05, { lookY: -0.05 }), expr: 'smug', dur: 2.4 });
  D.act('flare', 'idle');
  D.act('aaron', 'sitBed'); D.expr('aaron', 'surprised');
  D.say('aaron', 'Why would you say that?', { cam: R('aaron', -35, 2.4, 0.15, { lookY: -0.25 }), dur: 1.9 });
  D.face('flare', 0.9, 0.4);
  D.say('flare', 'What?', { cam: R('flare', -25, 2.2, 0.1), expr: 'surprised', dur: 1.1, dt: 0.3 });
  D.say('aaron', 'Every time someone says something is going to be peaceful, something goes wrong.', { cam: R('aaron', -35, 2.4, 0.15, { lookY: -0.25 }), expr: 'serious', dur: 4.0 });
  D.cam(R('flare', -10, 1.8, 0.05)); D.expr('flare', 'worried'); D.sound('Flare pauses', 1.2); D.wait(1.4);
  D.say('flare', "...You're right. I'm not saying anything else.", { act: 'facepalm', dur: 2.8 });
  D.act('flare', 'idle');
  D.sound('They get dressed and head downstairs', 2.0);
  D.anim('fade', 1, 0.8, 1.0); D.wait(2.1);

  // ===================================================================== SCENE 2: ERIC VS. THE BOSS
  D.scene('2. Eric vs. the Boss');
  D.location('living');
  cast(['eric', 'greg']);
  outfit(TEAM, 'base');
  D.set('halloween', 1); D.set('kitchen', 1); D.set('evening', 0); D.set('tv.off', 0); D.set('tv.boss', 1); D.set('tv.paused', 0); D.set('tv.hp', 0.42); D.set('tv.win', 0);
  D.set('pizza', 1); D.set('ctrl.held', 1); D.set('ctrl.couch', 0); D.set('milk.fall', 0); D.set('milk.puddle', 0); D.set('cereal.mess', 0); D.set('bowl.cereal', 0);
  D.place('eric', -0.85, 0.82, P); D.act('eric', 'sitGame'); D.expr('eric', 'determined');
  D.place('greg', 0.85, 0.82, P); D.act('greg', 'sitEat'); D.expr('greg', 'happy'); props('greg', 'pizza');
  D.anim('fade', 0, 0.8);
  D.music('spooky', 0.4, 0, 0.6);
  D.card('location', 3.0, { text: 'RED TEAM HQ  -  LIVING ROOM' });
  D.cam(FIX([-6.0, 2.9, 4.6], [0, 1.2, -1.6], { pos2: [-5.2, 2.6, 4.0], fov: 58 }));
  D.sfx('buttonMash', 0.3, 0.6, { repeat: 4, every: 1.2 }); D.sfx('gameHit', 0.8, 0.5, { repeat: 3, every: 1.3 });
  D.wait(3.6);
  D.anim('tv.hp', 0.2, 6.0);
  D.say('eric', 'COME ON! COME ON! JUST ONE MORE HIT!', { cam: R('eric', 15, 2.2, 0.2, { lookY: -0.25 }), dur: 2.6 });
  D.sfx('buttonMash', -2.4, 0.7, { repeat: 2, every: 1.2 });
  D.sfx('bossRoar', 0, 0.8);
  D.say('boss', 'YOU CANNOT DEFEAT ME!', { cam: FIX([0, 1.75, -2.6], [0, 1.75, -4.6], { fov: 40 }), dur: 2.0 });
  D.say('eric', 'WATCH ME!', { cam: R('eric', 15, 2.0, 0.2, { lookY: -0.25 }), act: 'sitGame', dur: 1.3 });
  D.sfx('buttonMash', -1.2, 0.8, { repeat: 3, every: 1.1 }); D.sfx('gameHit', -0.6, 0.5, { repeat: 3, every: 0.9 });
  D.say('greg', "Bro, you've been fighting this dude for like forty minutes.", { cam: R('greg', -20, 2.2, 0.2, { lookY: -0.25 }), expr: 'neutral', dur: 3.0 });
  D.look('eric', 0, 0, 0.2);
  D.say('eric', 'BECAUSE HE KEEPS CHEATING!', { cam: R('eric', 15, 2.0, 0.2, { lookY: -0.25 }), expr: 'angry', dur: 2.0 });
  D.say('greg', "Or maybe you're just bad.", { cam: R('greg', -20, 2.2, 0.2, { lookY: -0.25 }), expr: 'smug', dur: 1.8 });
  D.look('eric', 0.8, 0, 1.0); D.expr('eric', 'annoyed');
  D.cam(F(['eric', 'greg'], 180, 2.4, 0.6, { lookY: -0.35 })); D.sound('Eric slowly turns his head toward Greg', 2.0); D.wait(2.2);
  D.say('eric', 'Keep eating your pizza.', { dur: 1.8 });
  D.say('greg', 'Gladly.', { cam: R('greg', -20, 2.0, 0.2, { lookY: -0.25 }), expr: 'happy', dur: 1.2 });
  D.sfx('munch', 0, 0.6); D.sound('Greg takes another huge bite', 1.6); D.wait(1.6);
  D.look('eric', 0, 0, 0.4);
  // Flare and Aaron come downstairs
  D.place('flare', 4.9, -2.45, P); D.set('flare.y', 3.0); D.act('flare', 'idle'); D.expr('flare', 'neutral'); props('flare');
  D.place('aaron', 4.9, -3.2, P); D.set('aaron.y', 3.0); D.act('aaron', 'idle'); D.expr('aaron', 'tired'); props('aaron');
  D.path('flare', [[4.9, 1.75, 0.15], [4.9, 2.2, 0], [2.7, 1.5, 0]], 1.5); D.path('aaron', [[4.9, 1.75, 0.15], [4.9, 2.2, 0], [3.9, 2.7, 0]], 1.5, 0.5);
  D.sfx('stairs', 0.2, 0.5);
  D.cam(FIX([1.5, 2.1, 3.6], [4.9, 1.6, -0.6], { fov: 54 })); D.wait(4.6);
  D.faceChar('flare', 'eric', 0.4); D.faceChar('aaron', 'eric', 0.4);
  D.say('flare', 'Eric is already playing games?', { cam: R('flare', -30, 2.4, 0.12), expr: 'surprised', dur: 2.2 });
  D.say('eric', 'Yes, so?', { cam: R('eric', 15, 2.0, 0.2, { lookY: -0.25 }), dur: 1.3 });
  D.say('flare', 'Do you even win?', { cam: R('flare', -30, 2.4, 0.12), expr: 'smug', dur: 1.6 });
  D.set('tv.paused', 1); D.set('tv.hp', 0.05); D.sfx('pauseBlip', 0, 0.6);
  D.cam(FIX([0, 1.75, -2.4], [0, 1.75, -4.6], { fov: 38 })); D.sound("The game pauses. The boss's health bar is almost empty.", 2.4); D.wait(2.4);
  D.say('eric', 'Of course.', { cam: R('eric', 15, 2.0, 0.2, { lookY: -0.25 }), expr: 'smug', dur: 1.4 });
  D.set('ctrl.held', 0); D.set('ctrl.couch', 1); D.set('ctrl.x', -0.4); D.sfx('thud', 0, 0.3);
  D.act('eric', 'sitRelax');
  D.say('eric', 'I was just... giving him a chance.', { dur: 2.4 });
  D.say('aaron', 'A chance to do what? Win?', { cam: R('aaron', -30, 2.4, 0.12), expr: 'smug', act: 'shrug', dur: 2.0 });
  D.act('aaron', 'idle');
  D.act('greg', 'sitLaugh'); D.expr('greg', 'laugh'); D.sfx('munch', 0, 0.4);
  D.cam(R('greg', -10, 2.2, 0.2, { lookY: -0.25 })); D.sound('Greg laughs so hard he almost drops his pizza', 2.0); D.wait(2.0);
  D.act('greg', 'sitEat'); D.expr('greg', 'happy');
  D.say('eric', "Y'all are hilarious.", { cam: R('eric', 15, 2.0, 0.2, { lookY: -0.25 }), expr: 'annoyed', dur: 1.7 });
  // Eric stands and points at the kitchen
  D.place('eric', -1.2, -0.2, P); D.act('eric', 'idle'); D.face('eric', -0.8, 0.3);
  D.act('eric', 'point', 0.3); D.expr('eric', 'happy');
  D.say('eric', 'Anyway, I made popcorn!', { cam: F(['eric'], 200, 3.0, 0.2), dur: 1.9, dt: 0.3 });
  D.act('eric', 'idle');
  D.say('aaron', "Oh, perfect. I'm starving.", { cam: R('aaron', -30, 2.4, 0.12), expr: 'happy', dur: 1.9 });
  D.path('aaron', [[1.0, 2.9], [-3.6, 3.7], [-4.8, 4.25]], 1.6); D.face('aaron', 0.15, 0.3, 4.1);
  D.say('eric', "It's on the counter!", { cam: FIX([-1.6, 2.0, 0.6], [-4.6, 1.0, 4.2], { fov: 52 }), dur: 1.8, dt: 0.8 });
  D.wait(2.1);
  // the milk disaster
  D.cam(FIX([-3.6, 1.55, 2.9], [-5.1, 1.0, 4.8], { fov: 46 }));
  D.act('aaron', 'reach'); D.wait(0.6);
  D.anim('milk.fall', 1, 0.75, 0.0, 'in'); D.sfx('milkCrash', 0.25, 1.0); D.sfx('cerealScatter', 0.35, 0.8);
  D.fx('sparks', { x: -5.1, y: 1.3, z: 4.6, n: 70, color: 0xffffff, speed: 2.6, life: 0.9, size: 0.06 }, 0.45);
  D.fx('debris', { x: -5.2, y: 1.1, z: 4.7, n: 60, color: 0xd8a040, color2: 0xf0c060, spread: 0.6, up: 0.5, size: 0.5 }, 0.35);
  D.set('aaron.milk', 1, 0.55); D.set('bowl.cereal', 1, 0.5); D.anim('milk.puddle', 1, 0.6, 0.6); D.set('cereal.mess', 1, 0.9);
  D.comic('CRASH!', 0.3, 0.9, { x: 0.32, y: 0.3, size: 120, rot: -8 }); D.comic('SPLASH!', 0.55, 0.9, { x: 0.7, y: 0.42, size: 100, rot: 8, c1: '#ffffff', c2: '#9fd8ff' });
  D.act('aaron', 'jumpScare', 0.4);
  D.wait(1.6);
  for (const c of ['eric', 'flare', 'greg']) D.expr(c, 'shocked');
  D.act('aaron', 'freeze'); D.act('eric', 'freeze'); D.act('flare', 'freeze'); D.act('greg', 'sitRelax');
  D.cam(FIX([-1.8, 1.9, 1.6], [-3.2, 1.0, 3.6], { fov: 60 })); D.sound('Everyone freezes', 1.4); D.wait(1.5);
  D.face('aaron', -2.4, 0.5); D.act('aaron', 'lookDown'); D.expr('aaron', 'disgust');
  D.cam(R('aaron', 0, 1.9, -0.1, { lookY: -0.3 })); D.sound('Aaron slowly looks down at himself', 1.8); D.wait(2.0);
  D.say('aaron', '...', { dur: 1.2 });
  D.faceChar('aaron', 'eric', 0.5);
  D.say('aaron', 'ERIC!!', { cam: R('aaron', 0, 2.0, 0.05), act: 'yell', expr: 'angry', dur: 1.5, dt: 0.4 });
  D.act('eric', 'laugh'); D.expr('eric', 'laugh'); D.faceChar('eric', 'aaron', 0.3); D.act('flare', 'idle'); D.expr('flare', 'surprised');
  D.say('eric', 'BROOOOO! HOW DID YOU EVEN DO THAT?!', { cam: R('eric', 20, 2.2, 0.1), dur: 2.6 });
  D.say('aaron', 'YOU SAID YOU MADE POPCORN! WHY IS THERE MILK EVERYWHERE?!', { cam: R('aaron', 15, 2.2, 0.05), act: 'armsOut', expr: 'angry', dur: 3.4 });
  D.say('eric', "I DON'T KNOW! THE KITCHEN IS HAUNTED!", { cam: R('eric', 20, 2.2, 0.1), act: 'armsOut', expr: 'grin', dur: 2.4 });
  D.act('eric', 'laugh');
  D.faceChar('flare', 'aaron', 0.4);
  D.say('flare', "It's October 31st. Maybe the ghosts are already here.", { cam: R('flare', -25, 2.4, 0.1), act: 'pointUp', expr: 'smug', dur: 3.0 });
  D.act('flare', 'idle');
  D.say('aaron', 'FLARE, NOT HELPING!', { cam: R('aaron', 15, 2.2, 0.05), act: 'point', expr: 'angry', dur: 1.8 });
  D.act('greg', 'sitSlide'); D.expr('greg', 'laugh');
  D.cam(R('greg', -15, 2.3, 0.1, { lookY: -0.35 })); D.sound('Greg laughs so hard he slides halfway off the couch', 2.2); D.wait(2.0);
  D.say('greg', 'SOMEBODY GET A CAMERA!', { dur: 1.9 });
  D.say('aaron', "I'M GOING TO GET YOU ALL BACK!", { cam: R('aaron', 15, 2.2, 0.05), act: 'fistPump', expr: 'angry', dur: 2.2 });
  D.act('eric', 'idle'); D.expr('eric', 'grin');
  D.say('eric', "Okay, okay! I'll clean it up!", { cam: R('eric', 20, 2.3, 0.1), act: 'shrug', dur: 2.0 });
  props('eric', 'towels'); D.sfx('towelRip', 0.1, 0.6);
  D.act('eric', 'raiseItem');
  D.say('eric', 'Happy Halloween, everybody.', { cam: R('eric', 20, 2.3, 0.1), expr: 'happy', dur: 2.0, dt: 0.3 });
  D.act('eric', 'idle');
  D.say('aaron', 'I HATE THIS TEAM.', { cam: R('aaron', 0, 1.9, 0.05), act: 'facepalm', expr: 'tired', dur: 1.9 });
  D.anim('flashWhite', 1, 0.3); D.wait(0.35);

  // ===================================================================== TITLE CARD
  D.scene('Title');
  D.location('title');
  cast([]);
  D.anim('flashWhite', 0, 0.6);
  D.music('spooky', 0.8, 0, 0.05);
  D.set('title.theme', 2); D.set('title.subText', 'SPOOKY HALLOWEEN PARTY'); D.set('title.sub', 0); D.set('title.y', 0.3); D.set('title.subY', -1.1); D.set('title.k', 3.6);
  D.anim('title.k', 1, 0.22, 0.2, 'in'); D.sfx('titleHit', 0.4, 0.9);
  D.anim('title.sub', 1, 0.45, 1.3, 'back'); D.sfx('spookyStinger', 1.3, 0.8);
  D.cam(FIX([0, -0.2, 11.6], [0, -0.3, 0], { pos2: [0, -0.2, 10.8], fov: 40 }));
  D.wait(4.6);
  D.anim('fade', 1, 0.3); D.wait(0.35);

  // ===================================================================== SCENE 3: THE INVITATION
  D.scene('3. The Invitation');
  D.location('living');
  cast(['eric', 'greg', 'flare', 'aaron']);
  D.set('fade', 0); D.set('milk.fall', 0); D.set('milk.puddle', 0); D.set('cereal.mess', 0); D.set('bowl.cereal', 0); D.set('aaron.milk', 0);
  D.set('tv.boss', 1); D.set('tv.paused', 1); D.set('ctrl.held', 0); D.set('ctrl.couch', 1);
  D.music('hq', 0.42, 0, 0.6);
  D.place('eric', -0.85, 0.82, P); D.act('eric', 'sitRelax'); D.expr('eric', 'happy'); props('eric');
  D.place('greg', 0.85, 0.82, P); D.act('greg', 'sitEat'); D.expr('greg', 'happy'); props('greg', 'pizza');
  D.place('flare', -2.6, -0.3, 1.2); D.act('flare', 'phone'); props('flare', 'phone'); D.expr('flare', 'neutral');
  D.place('aaron', 2.5, -0.5, -1.2); D.act('aaron', 'idle'); D.expr('aaron', 'neutral'); props('aaron');
  D.card('location', 2.6, { text: 'LATER...' });
  D.cam(FIX([3.2, 2.2, 3.6], [-0.4, 1.0, -0.6], { fov: 56 }));
  D.sfx('phoneBuzz', 0.6, 0.5); D.wait(2.6);
  D.say('flare', "Hey, guys. There's a Halloween party happening tonight.", { cam: R('flare', 25, 2.3, 0.12), dur: 3.0 });
  D.say('greg', 'Is there food?', { cam: R('greg', -25, 2.2, 0.2, { lookY: -0.25 }), expr: 'surprised', dur: 1.4 });
  D.say('flare', 'Yes.', { cam: R('flare', 25, 2.3, 0.12), dur: 1.0 });
  D.say('greg', "I'm going.", { cam: R('greg', -25, 2.2, 0.2, { lookY: -0.25 }), act: 'thumbsUp', expr: 'grin', dur: 1.3 });
  D.act('greg', 'sitEat');
  D.say('aaron', "Who's hosting it?", { cam: R('aaron', -30, 2.4, 0.12), dur: 1.5 });
  D.card('phone', 6.2, { lines: [
    { text: "HALLOWEEN PARTY", big: true, y: 0.24, color: '#ffb050' },
    { text: 'TONIGHT  -  8:00 PM', bold: true, y: 0.36 },
    { text: "Hosted by NEWARK", y: 0.46, color: '#d6b4ff' },
    { text: 'Everyone in the city is invited!', y: 0.55 },
    { text: 'Games  -  Snacks  -  Costumes', y: 0.65 },
    { text: 'TALENT SHOW + DANCE PARTY', bold: true, y: 0.77, color: '#ffd23f' },
  ] });
  D.say('flare', 'A guy named Newark. Apparently, he\'s inviting people from all over the city.', { cam: R('flare', 20, 2.0, 0.1, { lookY: -0.1 }), dur: 3.6 });
  D.say('eric', 'Does he have games?', { cam: R('eric', 20, 2.2, 0.2, { lookY: -0.25 }), dur: 1.5 });
  D.say('flare', "I don't know.", { cam: R('flare', 25, 2.3, 0.12), act: 'phone', dur: 1.3 });
  D.say('eric', 'Then why are we going?', { cam: R('eric', 20, 2.2, 0.2, { lookY: -0.25 }), act: 'sitRelax', dur: 1.7 });
  D.say('aaron', "Because it's Halloween, Eric. You're allowed to leave the couch occasionally.", { cam: R('aaron', -30, 2.4, 0.12), act: 'handsHips', dur: 3.4 });
  D.act('aaron', 'idle');
  D.say('eric', 'The couch and I have an understanding.', { cam: R('eric', 20, 2.2, 0.2, { lookY: -0.25 }), expr: 'smug', dur: 2.3 });
  D.say('greg', 'Yeah. You sit on it, and it supports your weight.', { cam: R('greg', -25, 2.2, 0.2, { lookY: -0.25 }), expr: 'smug', dur: 2.6 });
  D.look('eric', 0.8, 0, 0.4);
  D.say('eric', 'You literally live on pizza.', { cam: F(['eric', 'greg'], 180, 2.4, 0.6, { lookY: -0.35 }), expr: 'annoyed', dur: 1.9 });
  D.say('greg', 'And pizza has never betrayed me.', { expr: 'happy', dur: 2.1 });
  D.look('eric', 0, 0, 0.4);
  D.say('flare', "Wait! There's going to be a talent show.", { cam: R('flare', 25, 2.3, 0.12), act: 'pointUp', expr: 'surprised', dur: 2.3 });
  D.act('flare', 'phone');
  D.say('aaron', 'A talent show?', { cam: R('aaron', -30, 2.4, 0.12), expr: 'surprised', dur: 1.4 });
  D.say('flare', 'Yes. People can show off their special abilities.', { cam: R('flare', 25, 2.3, 0.12), dur: 2.6 });
  D.act('eric', 'sitGame'); D.expr('eric', 'surprised');
  D.cam(R('eric', 10, 1.9, 0.2, { lookY: -0.2 })); D.sound('Eric slowly sits upright', 1.4); D.wait(1.4);
  D.say('eric', 'Special abilities?', { dur: 1.5 });
  D.say('greg', 'You mean our powers?', { cam: R('greg', -25, 2.2, 0.2, { lookY: -0.25 }), expr: 'surprised', dur: 1.5 });
  D.say('flare', 'Exactly.', { cam: R('flare', 25, 2.3, 0.12), expr: 'grin', dur: 1.2 });
  D.say('eric', "Now we're talking!", { cam: R('eric', 15, 2.1, 0.2, { lookY: -0.25 }), act: 'sitCheer', expr: 'grin', dur: 1.6 });
  D.act('eric', 'sitRelax');
  D.say('aaron', "All right. Let's get snacks, costumes, and whatever else we need.", { cam: R('aaron', -30, 2.4, 0.12), expr: 'happy', dur: 3.0 });
  D.say('greg', 'And pizza.', { cam: R('greg', -25, 2.2, 0.2, { lookY: -0.25 }), act: 'thumbsUp', dur: 1.3 });
  D.act('greg', 'sitEat');
  D.say('everyone', 'NO!', { cam: FIX([3.4, 2.0, 3.8], [-0.2, 1.0, -0.2], { fov: 58 }), dur: 1.2 });
  for (const c of ['eric', 'flare', 'aaron']) { D.act(c, c === 'eric' ? 'sitCheer' : 'yell', -1.2); D.expr(c, 'angry', -1.2); }
  D.act('eric', 'sitRelax'); D.act('flare', 'idle'); D.act('aaron', 'idle');
  D.say('greg', 'Fine. More pizza for me.', { cam: R('greg', -25, 2.2, 0.2, { lookY: -0.25 }), expr: 'smug', dur: 2.0 });
  D.sfx('munch', 0, 0.5);
  D.anim('fade', 1, 0.4); D.wait(0.5);

  // ===================================================================== SCENE 4: THE HALLOWEEN STORE
  D.scene('4. The Halloween Store');
  D.location('store');
  cast(TEAM);
  for (const c of TEAM) { props(c); D.set(`${c}.y`, 0); D.act(c, 'idle'); D.expr(c, 'happy'); }
  D.set('skel.pop', 0); D.set('skel.shake', 0); D.set('store.wobble', 0); D.set('store.pile', 0); D.set('store.pizza', 0);
  D.anim('fade', 0, 0.4);
  D.music('store', 0.4, 0, 0.5);
  D.place('aaron', -0.7, 7.2, P); D.place('flare', 0.0, 7.6, P); D.place('eric', -1.2, 7.9, P); D.place('greg', 0.9, 7.5, P);
  D.path('aaron', [[-1.2, 2.6]], 1.4); D.path('flare', [[0.2, 2.0]], 1.4, 0.2); D.path('eric', [[-2.2, 3.2]], 1.4, 0.4); D.path('greg', [[1.1, 4.4]], 1.4, 0.3);
  D.sfx('storeBell', 0.6, 0.6);
  D.card('location', 3.0, { text: 'HALLOWEEN SUPPLY STORE  -  AFTERNOON' });
  D.cam(FIX([2.2, 2.4, -1.6], [0.0, 1.2, 4.2], { fov: 56 }));
  D.wait(3.2);
  // the skeleton jump-scare
  D.anim('skel.pop', 1, 0.18, 0, 'out'); D.anim('skel.shake', 1, 0.1); D.anim('skel.shake', 0, 0.4, 1.6);
  D.sfx('skeletonPop', 0, 1.0); D.sfx('boneRattle', 0.1, 0.7);
  D.cam(FIX([0.4, 1.6, 2.6], [1.5, 1.3, 4.4], { fov: 50 }));
  D.say('skeleton', 'HAPPY HALLOWEEN!', { dur: 1.6 });
  D.act('greg', 'jumpScare'); D.expr('greg', 'shocked'); D.sfx('scream', 0, 0.6);
  D.move('greg', 2.6, 3.7, 0.45, 0, { face: false }); D.face('greg', -0.6, 0.2);
  D.anim('store.wobble', 1, 0.15, 0.4); D.anim('store.wobble', 0, 0.9, 0.9); D.sfx('plasticWobble', 0.45, 0.8);
  D.say('greg', 'AAAAAH!', { cam: FIX([0.6, 1.5, 1.6], [2.8, 1.0, 3.7], { fov: 48 }), dur: 1.6 });
  D.anim('skel.pop', 0, 1.0, 0.4);
  for (const c of ['aaron', 'flare', 'eric']) { D.act(c, 'laugh'); D.expr(c, 'laugh'); D.faceChar(c, 'greg', 0.3); }
  D.cam(FIX([-1.6, 1.9, 0.6], [0.6, 1.2, 3.6], { fov: 54 })); D.sound('Everyone starts laughing', 1.6); D.wait(1.6);
  D.say('eric', "BRO! YOU HAVE SUPERPOWERS AND YOU'RE SCARED OF A PLASTIC SKELETON?!", { cam: R('eric', -35, 2.3, 0.1), act: 'point', dur: 3.6 });
  D.act('eric', 'laugh'); D.act('greg', 'idle'); D.expr('greg', 'angry'); D.faceChar('greg', 'eric', 0.3);
  D.say('greg', 'IT CAME OUT OF NOWHERE!', { cam: R('greg', -30, 2.3, 0.1), act: 'armsOut', dur: 1.9 });
  D.act('aaron', 'idle'); D.expr('aaron', 'smug');
  D.say('aaron', 'It was standing right next to the entrance.', { cam: R('aaron', -35, 2.3, 0.1), act: 'point', dur: 2.4 });
  D.act('aaron', 'idle');
  D.say('greg', "I WASN'T LOOKING!", { cam: R('greg', -30, 2.3, 0.1), act: 'yell', dur: 1.6 });
  for (const c of TEAM) { D.act(c, 'idle'); D.expr(c, 'happy'); }
  // costume racks
  D.cam(FIX([-1.6, 2.2, 2.4], [1.4, 1.2, -1.2], { fov: 54 }));
  D.path('flare', [[0.4, -0.4]], 1.4); D.path('aaron', [[-0.6, -0.5]], 1.4, 0.2); D.path('eric', [[2.4, -0.3]], 1.4, 0.3); D.path('greg', [[3.9, -0.4]], 1.4, 0.4);
  D.face('flare', P, 0.4, 2.8); D.face('aaron', P, 0.4, 2.6); D.face('eric', P, 0.4, 2.0); D.face('greg', P, 0.4, 2.6);
  D.wait(3.4);
  D.act('flare', 'examine');
  D.face('flare', 0.4, 0.3);
  D.act('flare', 'idle'); D.act('flare', 'orate', 0.4); D.expr('flare', 'smug');
  D.say('flare', 'Hmm. Perhaps I should dress as a seventeenth-century nobleman.', { cam: R('flare', 0, 2.3, 0.15), dur: 3.4, dt: 0.4 });
  D.act('flare', 'idle');
  D.faceChar('eric', 'flare', 0.3); D.faceChar('flare', 'eric', 0.3);
  D.say('eric', 'You already act like one.', { cam: R('eric', 40, 2.3, 0.15), expr: 'smug', dur: 1.8 });
  D.say('flare', 'And perhaps you should dress as someone who can defeat a video game boss.', { cam: R('flare', -40, 2.3, 0.15), act: 'crossArms', expr: 'smug', dur: 3.6 });
  D.say('eric', "Okay, that's personal.", { cam: R('eric', 40, 2.3, 0.15), act: 'facepalm', expr: 'annoyed', dur: 1.8 });
  D.act('eric', 'idle'); D.act('flare', 'idle');
  // Aaron's cape, Greg's dinosaur
  props('aaron', 'capeFold'); D.act('aaron', 'showItem'); D.face('aaron', 0.6, 0.3); D.expr('aaron', 'happy');
  D.say('aaron', 'What about this?', { cam: R('aaron', 20, 2.2, 0.1, { lookY: -0.2 }), dur: 1.6, dt: 0.3 });
  D.faceChar('greg', 'aaron', 0.3);
  D.say('greg', 'Too basic.', { cam: R('greg', 40, 2.3, 0.15), act: 'shrug', expr: 'smug', dur: 1.4 });
  props('greg', 'dinoPack'); D.act('greg', 'holdUpBoth'); D.expr('greg', 'grin'); D.sfx('bagRustle', 0, 0.6);
  D.cam(R('greg', 30, 2.8, 0.3, { lookY: 0.1 })); D.sound('Greg holds up a giant inflatable dinosaur costume', 2.0); D.wait(2.0);
  D.say('greg', 'NOW THIS IS A COSTUME.', { dur: 1.9 });
  D.say('aaron', "You're not wearing that.", { cam: R('aaron', 25, 2.2, 0.1), act: 'idle', expr: 'annoyed', dur: 1.8 });
  D.say('greg', 'Watch me.', { cam: R('greg', 35, 2.3, 0.15), expr: 'smug', dur: 1.3 });
  D.act('greg', 'showItem');
  // Eric's mask
  props('eric', 'maskHeld'); D.act('eric', 'showItem'); D.expr('eric', 'grin'); D.face('eric', 0.9, 0.3);
  D.say('eric', 'This is perfect.', { cam: R('eric', 20, 2.2, 0.15), dur: 1.5 });
  props('eric'); D.set('eric.mask', 1); D.sfx('bagRustle', 0, 0.4);
  D.faceChar('eric', 'aaron', 0.3); D.faceChar('aaron', 'eric', 0.3);
  D.act('eric', 'boo', 0.3); D.sfx('whoosh', 0.3, 0.5);
  D.say('eric', 'BOO!', { cam: R('eric', 15, 2.0, 0.1), dur: 1.3, dt: 0.4 });
  D.comic('BOO!', -1.0, 0.9, { x: 0.5, y: 0.3, size: 120, rot: -6, c1: '#c8ff9a', c2: '#3a8a2a' });
  D.act('aaron', 'idle'); D.expr('aaron', 'tired');
  D.say('aaron', 'Eric, I can literally see your shoes.', { cam: R('aaron', -40, 2.3, 0.1), act: 'point', dur: 2.2 });
  D.act('aaron', 'idle');
  D.act('eric', 'lookDown');
  D.say('eric', '...Right.', { cam: F(['eric'], D.val('aaron.ry', D.now) * 180 / P + 180 + 20, 2.6, -0.4, { lookY: -0.6 }), dur: 1.6 });
  D.set('eric.mask', 0); D.act('eric', 'idle');
  // shopping montage + checkout
  D.music('store', 0.5, 0, 0.3);
  D.sound('They finish shopping: costumes, candy, snacks and drinks', 2.6);
  D.cam(FIX([-6.0, 2.0, -3.5], [-7.0, 1.2, -1.5], { fov: 50 }));
  D.place('flare', -6.4, -2.0, -P / 2); D.act('flare', 'reach'); props('flare', 'candy'); D.place('eric', -6.2, -0.6, -P / 2); D.act('eric', 'reach');
  D.sfx('bagRustle', 0.6, 0.5); D.wait(2.0);
  D.cam(FIX([-1.2, 1.8, 4.4], [-4.4, 1.2, 2.4], { fov: 50 }));
  cast(TEAM);
  D.place('aaron', -3.5, 2.2, -P / 2); D.place('flare', -3.4, 1.0, -P / 2); D.place('eric', -2.8, 0.2, -P / 2); D.place('greg', -3.4, 3.6, -P / 2);
  for (const c of TEAM) { D.act(c, 'idle'); props(c); D.expr(c, 'happy'); }
  props('aaron', 'capeFold'); props('greg', 'dinoPack'); props('eric', 'maskHeld');
  D.set('store.pile', 1); D.sfx('register', 0.4, 0.6); D.wait(1.6);
  D.act('greg', 'reach'); props('greg', 'none'); D.set('store.pizza', 1, 0.6); D.sfx('pizzaBox', 0.6, 0.5);
  D.cam(FIX([-1.7, 1.7, 4.4], [-4.0, 1.2, 3.7], { fov: 46 })); D.sound('Greg quietly adds a pizza to the pile', 1.8); D.wait(1.9);
  D.act('greg', 'idle'); D.expr('greg', 'smug');
  D.faceChar('aaron', 'greg', 0.3);
  D.say('aaron', 'Greg.', { cam: R('aaron', 35, 2.2, 0.1), expr: 'annoyed', dur: 1.2 });
  D.faceChar('greg', 'aaron', 0.3);
  D.say('greg', 'What?', { cam: R('greg', -30, 2.2, 0.1), dur: 1.0 });
  D.say('aaron', 'Put it back.', { cam: R('aaron', 35, 2.2, 0.1), act: 'point', dur: 1.4 });
  D.act('aaron', 'idle');
  D.say('greg', "You can't stop true love.", { cam: R('greg', -30, 2.1, 0.1), act: 'thumbsUp', expr: 'grin', dur: 2.0 });
  D.act('greg', 'idle');
  D.anim('fade', 1, 0.5); D.wait(0.6);

  // ===================================================================== SCENE 5: WELCOME TO NEWARK'S PARTY
  D.scene("5. Welcome to Newark's Party");
  D.location('newarkExt');
  cast([...TEAM, 'newark']);
  D.hide('newark');
  outfit(['aaron', 'flare', 'greg'], 'party');
  for (const c of TEAM) { props(c); D.set(`${c}.y`, 0); D.act(c, 'idle'); D.expr(c, 'happy'); }
  D.set('eric.mask', 2); D.set('nk.door', 0); D.set('nk.party', 1); D.set('nk.guests', 1); D.set('amb.muffled', 1);
  D.anim('fade', 0, 0.6);
  D.music('night', 0.35, 0, 0.6);
  D.place('aaron', -0.4, 6.8, P); D.place('flare', 0.4, 7.2, P); D.place('eric', -0.3, 7.8, P); D.place('greg', 0.45, 8.2, P);
  D.path('aaron', [[-0.6, 0.6]], 1.3); D.path('flare', [[0.6, 0.5]], 1.3, 0.2); D.path('eric', [[-1.8, 0.8]], 1.3, 0.3); D.path('greg', [[1.8, 0.8]], 1.3, 0.4);
  D.card('location', 3.2, { text: "NEWARK'S HOUSE  -  HALLOWEEN NIGHT" });
  D.sfx('owl', 1.0, 0.6);
  D.cam(FIX([0.0, 4.2, 12.0], [0, 2.6, -4.0], { pos2: [0.0, 3.0, 8.5], fov: 56 }));
  D.wait(5.4);
  D.cam(FIX([2.6, 1.6, -1.2], [-0.2, 1.4, 1.6], { fov: 52 }));
  D.say('eric', 'Okay, this is actually pretty cool.', { act: 'lookUp', expr: 'happy', dur: 2.2, dt: 0.6 });
  D.act('eric', 'idle');
  D.say('greg', 'I smell food.', { cam: R('greg', -20, 2.6, 0.2), expr: 'grin', dur: 1.5 });
  D.look('aaron', -0.5, 0, 0.4);
  D.say('aaron', 'You smell food everywhere.', { cam: R('aaron', 25, 2.4, 0.1), expr: 'smug', dur: 1.8 });
  D.say('greg', 'Because food is everywhere.', { cam: R('greg', -20, 2.6, 0.2), act: 'armsOut', dur: 1.9 });
  D.act('greg', 'idle');
  // the door opens: Newark
  D.look('aaron', 0, 0, 0.3);
  D.anim('nk.door', 1, 0.9); D.sfx('doorOpen', 0, 0.7); D.anim('amb.muffled', 2.0, 0.4);
  D.place('newark', 0, -5.3, 0); D.act('newark', 'idle'); D.expr('newark', 'happy'); props('newark');
  D.path('newark', [[0, -4.3]], 1.0, 0.5);
  for (const c of TEAM) D.faceTo(c, 0, -4.4, 0.4, 0.3);
  D.cam(FIX([0.0, 1.7, -0.6], [0, 1.6, -4.6], { fov: 46 })); D.wait(1.8);
  D.act('newark', 'welcome');
  D.say('newark', 'Welcome! You must be the guys who signed up for the talent show.', { dur: 3.4 });
  D.say('flare', 'That would be us.', { cam: R('flare', 20, 2.4, 0.1), act: 'bow', expr: 'smug', dur: 1.8 });
  D.act('flare', 'idle');
  D.say('newark', "Excellent! Come on in. We've got games, snacks, costumes, and a dance party later tonight.", { cam: R('newark', 15, 2.4, 0.1), act: 'welcome', dur: 4.2 });
  D.say('greg', 'Did you say snacks?', { cam: R('greg', -20, 2.4, 0.1), expr: 'surprised', dur: 1.5 });
  D.say('newark', "There's a whole table of them.", { cam: R('newark', 15, 2.4, 0.1), act: 'point', dur: 1.8 });
  D.act('newark', 'idle');
  // Greg rushes inside
  D.path('greg', [[1.0, -3.0], [0.3, -4.0], [0.0, -5.6]], 4.5); D.act('greg', 'idle'); D.sfx('whoosh', 0.2, 0.6);
  D.move('newark', 0.9, -4.4, 0.4, 0.1); D.face('newark', -0.3, 0.3, 0.6);
  D.cam(FIX([3.2, 1.6, -1.4], [0.2, 1.2, -4.0], { fov: 50 }));
  D.hide('greg', 1.3);
  D.wait(1.5);
  D.say('aaron', 'Greg! At least pretend you\'re here for the party!', { cam: R('aaron', 20, 2.4, 0.1), act: 'yell', expr: 'annoyed', dur: 2.6 });
  D.act('aaron', 'idle');
  D.say('greg', "I'M HERE FOR THE PARTY FOOD!", { label: 'GREG (FROM INSIDE)', cam: FIX([0.6, 1.6, -1.6], [0.2, 1.6, -5.6], { fov: 44 }), dur: 2.0 });
  D.act('newark', 'laugh'); D.expr('newark', 'laugh'); D.sfx('crowdLaugh', 0, 0.3);
  D.cam(R('newark', 20, 2.2, 0.1)); D.sound('Newark laughs', 1.2); D.wait(1.3);
  D.act('newark', 'welcome'); D.expr('newark', 'happy');
  D.say('newark', "Don't worry. He's not the first person to do that.", { dur: 2.6 });
  D.path('aaron', [[0, -3.6], [0, -5.6]], 1.4); D.path('flare', [[0.3, -3.4], [0, -5.6]], 1.4, 0.4); D.path('eric', [[-0.3, -3.2], [0, -5.6]], 1.4, 0.8);
  D.cam(FIX([-3.0, 1.8, 0.4], [0, 1.4, -4.6], { fov: 50 }));
  D.hide('aaron', 2.6); D.hide('flare', 3.0); D.hide('eric', 3.4);
  D.wait(3.2);
  D.anim('fade', 1, 0.4); D.wait(0.45);
  // inside
  D.location('party');
  cast([...TEAM, 'newark']);
  D.set('fade', 0); D.set('party.mode', 0); D.set('stage.spot', 0); D.set('party.cheer', 0); D.set('party.gasp', 0); D.set('party.blow', 0); D.set('stage.symbol', 0); D.set('amb.party', 1);
  D.music('party', 0.42, 0, 0.3);
  D.place('aaron', -1.6, 5.4, P); D.place('flare', -0.6, 5.6, P); D.place('eric', -2.4, 5.6, P); D.place('greg', -6.0, 1.6, -P / 2); D.place('newark', 0.6, 5.0, P);
  for (const c of [...TEAM, 'newark']) { D.act(c, 'idle'); D.expr(c, 'happy'); }
  D.act('greg', 'reach'); props('greg', 'plate');
  D.path('aaron', [[-1.8, 3.6]], 1.2); D.path('flare', [[-0.6, 3.8]], 1.2); D.path('eric', [[-2.8, 3.8]], 1.2); D.path('newark', [[0.8, 3.4]], 1.2);
  D.cam(FIX([-1.6, 2.6, 6.6], [0.0, 1.2, -2.0], { pos2: [-1.2, 2.3, 5.8], fov: 60 }));
  D.sound('Inside, the house is packed with guests in costumes. A DJ plays Halloween music.', 3.2);
  D.wait(3.4);
  D.faceChar('eric', 'aaron', 0.4);
  D.say('eric', "Okay, I'm officially glad we came.", { cam: R('eric', 25, 2.4, 0.12), dur: 2.2 });
  D.faceTo('flare', 0, -5.4, 0.4);
  D.say('flare', "Let's see what this talent show is about.", { cam: R('flare', -25, 2.4, 0.12), act: 'pointUp', dur: 2.4 });
  D.act('flare', 'idle');

  // ===================================================================== SCENE 6: THE SUPERPOWER TALENT SHOW
  D.scene('6. The Superpower Talent Show');
  D.music('showtime', 0.4, 0, 0.6);
  D.anim('stage.spot', 1, 0.6); D.sfx('spotlightOn', 0, 0.8);
  // everyone in place: Newark on stage, the team at the front left, Greg back from the snacks
  D.place('newark', -2.0, -5.0, 0.15); D.set('newark.y', 0.5); D.act('newark', 'mic'); props('newark', 'mic');
  D.place('aaron', -2.6, -2.6, P - 0.3); D.place('flare', -1.7, -3.0, P - 0.2); D.place('eric', -3.4, -2.9, P - 0.4); D.place('greg', -2.4, -1.8, P - 0.3);
  for (const c of TEAM) { D.act(c, 'idle'); D.set(`${c}.y`, 0); props(c); }
  D.sfx('micTap', 0.2, 0.6);
  D.cam(FIX([0, 2.6, 3.8], [0, 1.6, -5.0], { fov: 50 }));
  D.wait(1.4);
  D.say('newark', 'All right, everybody! Welcome to the Halloween talent show!', { cam: R('newark', 0, 2.6, 0.1), dur: 3.2 });
  D.set('party.cheer', 1); D.sfx('crowdCheer', 0, 0.7);
  D.cam(FIX([-2.0, 2.8, -4.2], [0.6, 1.2, -0.6], { fov: 60 })); D.sound('The crowd cheers', 1.8); D.wait(2.0);
  D.set('party.cheer', 0);
  D.say('newark', "Tonight, we're not just celebrating Halloween. We're celebrating what makes everyone unique.", { cam: R('newark', 15, 2.4, 0.1), act: 'micPresent', dur: 4.4 });
  D.say('newark', "We've got singers, dancers, magicians, and a few people with some pretty unusual abilities!", { act: 'mic', dur: 4.2 });
  D.anim('stage.spot', 0.35, 0.6); D.sfx('spotlightOn', 0, 0.5);
  D.cam(FIX([0, 2.4, 3.0], [0, 1.4, -5.0], { fov: 48 })); D.sound('The lights dim', 1.2); D.wait(1.3);
  D.say('newark', "Let's bring out our first contestants!", { cam: R('newark', 0, 2.6, 0.1), act: 'micPresent', dur: 2.4 });
  D.anim('stage.spot', 1, 0.4);
  // the team walks up the steps onto the stage
  const lineup = { eric: -0.9, flare: 0.1, aaron: 1.1, greg: 2.1 };
  for (const [i, c] of ['eric', 'flare', 'aaron', 'greg'].entries()) D.path(c, [[-3.75, -3.7, 0], [-3.75, -4.8, 0.5], [lineup[c], -5.5, 0.5]], 1.6, i * 0.7);
  D.cam(FIX([1.6, 2.2, 1.2], [-1.6, 1.2, -5.0], { fov: 54 }));
  D.wait(2.0);
  D.say('newark', 'Give it up for the Battle Wars crew!', { act: 'micPresent', dur: 2.2 });
  D.set('party.cheer', 1); D.sfx('crowdCheer', 0, 0.7);
  D.wait(3.4);
  for (const c of TEAM) { D.face(c, 0, 0.4); D.expr(c, 'grin'); }
  D.set('party.cheer', 0);
  D.cam(FIX([0.6, 2.0, 1.0], [0.6, 1.6, -5.4], { fov: 50 })); D.sound('The crowd applauds', 1.4); D.wait(1.6);
  // ---- Eric's turn
  D.say('newark', "Eric, you're up first. What can you do?", { cam: R('newark', 20, 2.4, 0.1), act: 'mic', dur: 2.4 });
  D.path('eric', [[0.1, -4.75, 0.5]], 1.4); D.face('eric', 0, 0.3, 0.7);
  D.say('eric', 'Glad you asked.', { cam: R('eric', 0, 2.8, 0.2), expr: 'smug', dur: 1.6, dt: 0.6 });
  D.expr('eric', 'sleep'); D.act('eric', 'conjure');
  D.fx('bodyAura', { who: 'eric', dur: 2.6, color: 0x4aa8ff }); D.sfx('powerUpBlue', 0, 0.8);
  D.cam(R('eric', 0, 3.0, 0.4, { lookY: -0.2 })); D.sound('A blue aura surrounds Eric', 1.8); D.wait(2.2);
  {
    const [ex, ez] = pos('eric');
    D.set('flashWhite', 0.6); D.anim('flashWhite', 0, 0.5); D.sfx('transform', 0, 1.0);
    D.fx('sphere', { x: ex, y: 1.4, z: ez, dur: 0.7, radius: 2.4, color: 0x4aa8ff }); D.fx('sparks', { x: ex, y: 1.4, z: ez, n: 100, color: 0x6fc4ff, speed: 3, life: 1.0 });
    D.hide('eric', 0.1); D.place('birddog', ex, ez, 0, 0.1); D.set('birddog.y', 0.9, 0.1); D.set('birddog.act', 'fly', 0.1);
    D.anim('birddog.y', 1.4, 0.6, 0.2);
    D.set('party.gasp', 1, 0.3); D.sfx('crowdWow', 0.4, 0.8);
    D.cam(FIX([0.2, 2.2, -0.6], [0.1, 1.6, -4.8], { fov: 54 }));
    D.say('crowd', 'WHOA!', { dur: 1.5, dt: 0.4 });
    D.sfx('flap', 0, 0.6, { repeat: 10, every: 0.3 });
    // loop over the stage
    D.path('birddog', [[1.8, -5.0, 2.2], [0.1, -6.0, 3.0], [-1.6, -5.0, 2.4], [0.1, -4.6, 1.6]], 3.2);
    D.cam(FIX([0, 2.6, -0.6], [0, 2.4, -5.0], { fov: 58 }));
    D.say('eric', 'HAPPY HALLOWEEN!', { label: 'ERIC (BIRD-DOG)', dur: 2.0, dt: 0.4 });
    D.wait(1.6);
    D.set('party.gasp', 0);
    D.set('flashWhite', 0.5); D.anim('flashWhite', 0, 0.5); D.sfx('transform', 0, 0.8);
    D.fx('sparks', { x: 0.1, y: 1.4, z: -4.6, n: 70, color: 0x6fc4ff, speed: 2.5 });
    D.hide('birddog', 0.1); D.place('eric', 0.1, -4.75, 0, 0.1); D.set('eric.y', 0.5, 0.1); D.act('eric', 'cheer', 0.1); D.expr('eric', 'grin', 0.1);
  }
  D.set('party.cheer', 1); D.sfx('crowdCheer', 0.1, 0.8);
  D.cam(FIX([-2.4, 2.6, -2.2], [0.1, 1.4, -4.8], { fov: 54 })); D.sound('The crowd cheers', 1.4); D.wait(1.6);
  D.set('party.cheer', 0);
  D.say('newark', 'THAT WAS INCREDIBLE!', { cam: R('newark', 20, 2.4, 0.1), act: 'micPresent', dur: 1.9 });
  D.act('eric', 'idle');
  D.say('eric', 'Thank you! I also play video games.', { cam: R('eric', 0, 2.8, 0.2), act: 'thumbsUp', dur: 2.2 });
  D.say('aaron', 'Nobody asked about that!', { label: 'AARON (FROM THE LINEUP)', cam: R('aaron', 0, 2.6, 0.2), act: 'yell', dur: 1.8 });
  D.act('aaron', 'idle'); D.act('eric', 'idle');
  D.path('eric', [[lineup.eric, -5.5, 0.5]], 1.4); D.face('eric', 0, 0.3, 1.0);
  // ---- Flare's turn
  D.say('newark', 'Next up, Flare!', { cam: R('newark', 20, 2.4, 0.1), act: 'micPresent', dur: 1.6 });
  D.path('flare', [[0.1, -4.75, 0.5]], 1.4); D.face('flare', 0, 0.3, 0.6); D.expr('flare', 'smug');
  D.act('flare', 'orate', 0.7);
  D.say('flare', 'Prepare yourselves for a performance unlike any other.', { cam: R('flare', 0, 3.0, 0.2), dur: 3.0, dt: 0.6 });
  D.act('flare', 'flameHand'); D.fx('flame', { who: 'flare', side: 'R', dur: 1.6, size: 0.3 }); D.sfx('flameIgnite', 0, 0.7);
  D.cam(R('flare', 20, 2.0, 0.1, { lookY: -0.2 })); D.sound('A controlled flame appears in his palm', 1.6); D.wait(1.6);
  D.act('flare', 'fireRings'); D.sfx('fireRoar', 0, 0.6);
  D.fx('fireRings', { x: 0.1, y: 1.6, z: -4.75, dur: 4.4, n: 5, orbit: 1.15 });
  D.cam(FIX([0.1, 1.8, -0.8], [0.1, 1.7, -4.8], { fov: 50 })); D.sound('Glowing rings of fire spin around him like a miniature galaxy', 2.6); D.wait(2.4);
  D.set('party.gasp', 1); D.sfx('crowdWow', 0, 0.6);
  D.act('flare', 'perform');
  D.say('flare', 'Behold! The power of fire!', { cam: R('flare', 0, 2.6, 0.3, { lookY: -0.1 }), expr: 'grin', dur: 2.0 });
  D.set('party.gasp', 0);
  D.fx('sparks', { x: 0.1, y: 1.8, z: -4.75, n: 160, color: 0xffb040, speed: 4, life: 1.2, size: 0.06 }); D.fx('sparks', { x: 0.1, y: 1.8, z: -4.75, n: 90, color: 0xffe080, speed: 2.5, life: 1.4 }, 0.1);
  D.sfx('sparkle', 0, 0.8); D.sfx('blastImpact', 0, 0.3);
  D.set('party.cheer', 1, 0.3); D.sfx('crowdCheer', 0.3, 0.9);
  D.cam(FIX([-2.6, 2.4, -1.4], [0.1, 1.6, -4.8], { fov: 54 })); D.sound('The rings burst into harmless glowing sparks. The crowd cheers loudly!', 2.6); D.wait(2.6);
  D.set('party.cheer', 0);
  D.act('flare', 'bow');
  D.say('flare', 'Thank you, thank you. Autographs are available after the show.', { cam: R('flare', 15, 2.6, 0.2), dur: 3.2 });
  D.act('flare', 'idle');
  D.say('eric', 'Bro thinks he\'s famous.', { cam: R('eric', 0, 2.4, 0.2), act: 'crossArms', expr: 'smug', dur: 1.7 });
  D.face('flare', -0.5, 0.3);
  D.say('flare', 'I AM FAMOUS!', { cam: R('flare', 15, 2.4, 0.2), act: 'yell', expr: 'angry', dur: 1.5 });
  D.act('flare', 'idle'); D.act('eric', 'idle');
  D.path('flare', [[lineup.flare, -5.5, 0.5]], 1.4); D.face('flare', 0, 0.3, 0.7);
  // ---- Aaron's turn
  D.say('newark', "Aaron, show us what you've got!", { cam: R('newark', 20, 2.4, 0.1), act: 'micPresent', dur: 2.0 });
  D.path('aaron', [[0.1, -4.75, 0.5]], 1.4); D.face('aaron', 0, 0.3, 0.9);
  D.say('aaron', "All right. Let's see if this works.", { cam: R('aaron', 0, 2.8, 0.2), expr: 'determined', dur: 2.2, dt: 0.8 });
  D.act('aaron', 'conjure');
  D.anim('aaron.hairGlow', 1, 1.0); D.fx('bodyAura', { who: 'aaron', dur: 7.5, color: 0x4aa8ff }); D.sfx('powerUpBlue', 0, 0.9);
  D.cam(R('aaron', 0, 2.0, 0.15, { lookY: 0.0 })); D.sound("Aaron's hair glows blue", 1.6); D.wait(1.8);
  D.fx('orbs', { who: 'aaron', dur: 4.6, n: 6, merge: 2.6, to: [0.1, 3.0, -5.2], color: 0x4aa8ff }); D.sfx('orbHum', 0, 0.8);
  D.cam(FIX([0.1, 1.9, -1.0], [0.1, 1.9, -4.8], { fov: 52 })); D.sound('Floating energy orbs orbit around him', 1.8); D.wait(2.4);
  D.act('aaron', 'sweepUp'); D.sfx('symbolGlow', 0.2, 0.8);
  D.anim('stage.symbol', 1, 0.8, 0.4);
  D.cam(FIX([0.1, 1.6, -0.6], [0.1, 2.6, -5.0], { fov: 56 })); D.sound('The orbs merge into a bright blue symbol above the stage', 2.4); D.wait(2.6);
  D.say('aaron', 'And... done.', { cam: R('aaron', 0, 2.6, 0.3), expr: 'grin', dur: 1.5 });
  D.anim('stage.symbol', 0, 0.3);
  D.fx('sparks', { x: 0.1, y: 3.0, z: -5.2, n: 140, color: 0x7fd4ff, speed: 3.0, life: 1.0 }); D.sfx('sparkle', 0, 0.9);
  D.fx('rain', { x: 0.4, z: -1.0, w: 8, d: 5, dur: 3.6, top: 3.8, color: 0x7fd4ff, n: 180 }, 0.3);
  D.set('party.cheer', 1, 0.6); D.sfx('crowdCheer', 0.6, 0.9);
  D.cam(FIX([3.6, 2.4, 2.2], [-0.4, 1.6, -2.4], { fov: 60 })); D.sound('Sparkling blue particles rain down over the audience', 2.4); D.wait(3.0);
  D.set('party.cheer', 0); D.anim('aaron.hairGlow', 0, 1.0);
  D.say('newark', 'Beautiful!', { cam: R('newark', 20, 2.4, 0.1), act: 'micPresent', dur: 1.4 });
  D.act('aaron', 'bow');
  D.say('aaron', 'Thank you!', { cam: R('aaron', 0, 2.6, 0.2), expr: 'happy', dur: 1.4 });
  D.act('aaron', 'idle');
  D.path('aaron', [[lineup.aaron, -5.5, 0.5]], 1.4); D.face('aaron', 0, 0.3, 0.7);
  // ---- Greg's turn
  D.say('newark', 'And last but certainly not least, Greg!', { cam: R('newark', 20, 2.4, 0.1), act: 'micPresent', dur: 2.2 });
  props('greg', 'candy');
  D.path('greg', [[0.1, -4.75, 0.5]], 1.2); D.face('greg', 0, 0.3, 1.6); D.act('greg', 'eatBar'); D.expr('greg', 'tired');
  D.cam(R('greg', 0, 3.0, 0.2)); D.sound('Greg walks onto the stage, eating a piece of candy', 1.8); D.wait(2.0);
  D.say('greg', 'Do I have to?', { dur: 1.5 });
  D.set('party.cheer', 1);
  D.say('everyone', 'YES!', { cam: FIX([0.6, 2.3, -4.0], [0.8, 1.2, -0.6], { fov: 64 }), dur: 1.3 });
  D.set('party.cheer', 0);
  D.act('greg', 'sigh'); D.sfx('sigh', 0, 0.6);
  D.say('greg', 'Fine.', { cam: R('greg', 0, 2.6, 0.2), dur: 1.3, dt: 0.6 });
  props('greg'); D.act('greg', 'powerFist'); D.expr('greg', 'determined');
  D.fx('aura', { who: 'greg', side: 'R', dur: 4.0, power: 1, color: 0xff3040 }); D.fx('aura', { who: 'greg', side: 'L', dur: 4.0, power: 1, color: 0x4aa8ff }); D.sfx('energyCharge', 0, 0.8);
  D.say('greg', 'Check this out.', { cam: R('greg', 20, 2.0, 0.1), dur: 1.6 });
  D.act('greg', 'punch'); D.sfx('punchHit', 0.1, 0.6); D.sfx('energyWave', 0.15, 0.9);
  D.fx('vring', { x: 0.1, y: 2.5, z: -4.4, dur: 2.6, radius: 1.7 }, 0.15);
  D.cam(FIX([0.1, 1.9, -0.4], [0.1, 2.2, -4.8], { fov: 56 })); D.sound('An energy wave forms a glowing ring. It grows and changes colors.', 2.6); D.wait(2.6);
  D.fx('sparks', { x: 0.1, y: 2.5, z: -4.4, n: 120, color: 0xff60a0, speed: 3.5, life: 1.1 }); D.fx('sparks', { x: 0.1, y: 2.5, z: -4.4, n: 120, color: 0x60c0ff, speed: 3.0, life: 1.2 }, 0.05); D.fx('sparks', { x: 0.1, y: 2.5, z: -4.4, n: 80, color: 0xffe060, speed: 2.4, life: 1.3 }, 0.1);
  D.sfx('sparkle', 0, 0.9); D.sfx('blastImpact', 0, 0.4);
  D.set('party.cheer', 1, 0.2); D.sfx('crowdCheer', 0.2, 1.0);
  D.cam(FIX([-3.0, 2.8, -0.4], [0.2, 1.4, -4.2], { fov: 58 })); D.sound('The crowd goes wild!', 1.6); D.wait(1.8);
  D.set('party.cheer', 0);
  D.act('greg', 'bow');
  D.say('greg', "Thank you! I'll be here all night. Tips are appreciated. Pizza is preferred.", { cam: R('greg', 0, 2.6, 0.2), expr: 'grin', dur: 4.0 });
  // Eric drags Greg off the stage
  D.path('eric', [[-0.6, -4.9, 0.5]], 2.6); D.face('eric', P / 2, 0.2, 0.5); D.act('eric', 'grabArm', 0.5);
  D.say('eric', 'GET OFF THE STAGE!', { cam: F(['eric', 'greg'], 0, 3.4, 0.3), act: 'yell', expr: 'annoyed', dur: 1.8, dt: 0.6 });
  D.act('eric', 'dragging'); D.act('greg', 'dragged'); D.face('greg', -P / 2, 0.3);
  D.path('eric', [[-3.75, -4.8, 0.5], [-3.75, -3.7, 0], [-3.2, -2.9, 0]], 2.4); D.path('greg', [[-3.3, -4.8, 0.5], [-3.6, -3.6, 0], [-2.5, -2.0, 0]], 2.4, 0.15);
  D.sfx('crowdLaugh', 0.3, 0.6);
  D.act('newark', 'laugh', 0.4); D.expr('newark', 'laugh', 0.4);
  D.cam(FIX([1.8, 2.2, -1.0], [-2.4, 1.0, -4.0], { fov: 54 })); D.wait(1.6);
  D.act('newark', 'micPresent'); D.expr('newark', 'happy');
  D.path('flare', [[-3.75, -4.8, 0.5], [-3.75, -3.7, 0], [-1.7, -3.0, 0]], 1.6, 0.4); D.path('aaron', [[-3.75, -4.8, 0.5], [-3.75, -3.7, 0], [-2.6, -2.6, 0]], 1.6, 1.2);
  D.say('newark', 'Give it up for all four of them!', { cam: R('newark', 20, 2.4, 0.1), dur: 2.2 });
  D.set('party.cheer', 1); D.sfx('crowdCheer', 0, 0.9);
  for (const c of TEAM) { D.act(c, 'idle'); D.expr(c, 'happy'); }
  D.cam(FIX([1.4, 2.4, 1.0], [-2.6, 1.2, -2.8], { fov: 56 })); D.sound('The crowd cheers as the team rejoins their friends', 2.2); D.wait(3.0);
  for (const c of TEAM) D.faceTo(c, 0, -5.4, 0.3);
  D.set('party.cheer', 0);

  // ===================================================================== SCENE 7: THE HALLOWEEN DANCE PARTY
  D.scene('7. The Halloween Dance Party');
  D.anim('party.mode', 1, 2.4); D.anim('stage.spot', 0, 1.0);
  D.music('party', 0.6, 0, 0.3); D.sfx('scratch', 0, 0.7); D.sfx('djHype', 0.5, 0.6);
  D.hide('newark');
  D.say('dj', 'ALL RIGHT! EVERYBODY ON THE DANCE FLOOR!', { cam: FIX([3.6, 1.8, -1.6], [5.4, 1.4, -3.9], { fov: 48 }), dur: 2.8 });
  D.place('eric', -0.9, 0.4, P - 0.3); D.place('aaron', 0.5, 0.2, P + 0.3); D.place('flare', 1.7, 1.1, P + 0.6); D.place('greg', -0.4, 1.7, P);
  for (const c of TEAM) { D.set(`${c}.y`, 0); D.act(c, 'dance'); D.expr(c, 'grin'); props(c); }
  D.cam(FIX([0.4, 3.6, 7.0], [0.2, 0.9, 0.4], { pos2: [1.2, 3.0, 6.0], fov: 56 }));
  D.sound('The lights change to orange, purple and blue. People begin dancing.', 3.0); D.wait(3.2);
  D.act('eric', 'beeDance'); D.expr('eric', 'grin');
  D.cam(R('eric', 0, 2.8, 0.2)); D.wait(1.5);
  D.act('aaron', 'idle'); D.faceChar('aaron', 'eric', 0.3); D.expr('aaron', 'surprised');
  D.say('aaron', 'Eric, what ARE you doing?!', { cam: R('aaron', -38, 2.2, 0.15), dur: 1.9 });
  D.say('eric', 'DANCING!', { cam: R('eric', 0, 2.6, 0.2), dur: 1.2 });
  D.say('aaron', "It looks like you're fighting invisible bees!", { cam: R('aaron', -38, 2.2, 0.15), act: 'point', expr: 'laugh', dur: 2.4 });
  D.say('eric', "THAT'S THE STYLE!", { cam: R('eric', 0, 2.6, 0.2), dur: 1.5 });
  D.act('aaron', 'dance');
  // Greg and his plate
  D.place('greg', -2.6, 2.8, P + 0.6); D.act('greg', 'idle'); props('greg', 'plate'); D.expr('greg', 'happy');
  D.path('greg', [[-1.4, 1.8]], 1.2);
  D.act('flare', 'idle'); D.faceTo('flare', -1.4, 1.8, 0.4, 1.0);
  D.cam(FIX([1.0, 1.9, 4.2], [-1.6, 1.2, 1.6], { fov: 52 })); D.wait(1.6);
  D.say('flare', "Greg! You're supposed to dance!", { cam: R('flare', -30, 2.4, 0.15), act: 'point', expr: 'annoyed', dur: 2.0 });
  D.faceChar('greg', 'flare', 0.3);
  D.say('greg', 'I can do both.', { cam: R('greg', 20, 2.4, 0.15), expr: 'smug', dur: 1.5 });
  D.act('greg', 'plateBalance'); D.anim('greg.ry', D.val('greg.ry', D.now) + 2 * P, 1.2, 0.2); D.sfx('plateWobble', 0.4, 0.7);
  D.cam(F(['greg'], 20, 3.0, 0.2)); D.sound('Greg spins around and nearly drops everything', 1.8); D.wait(1.4);
  D.say('greg', 'WHOA! SAVE THE FOOD!', { act: 'plateBalance', expr: 'shocked', dur: 1.7 });
  // Aaron catches the plate
  props('greg'); D.place('aaron', 0.0, 2.9, -2.2); D.act('aaron', 'catchItem'); props('aaron', 'plate'); D.sfx('catchPlate', 0, 0.8); D.expr('aaron', 'shocked');
  D.act('greg', 'stumble');
  D.cam(F(['aaron', 'greg'], 40, 3.0, 0.2)); D.comic('CATCH!', 0.1, 0.8, { x: 0.55, y: 0.3, size: 90, rot: 6 }); D.wait(1.2);
  D.act('aaron', 'showItem'); D.faceChar('aaron', 'greg', 0.2);
  D.say('aaron', 'HOW DID YOU ALMOST DROP IT?!', { cam: R('aaron', 35, 2.0, 0.1), expr: 'annoyed', dur: 2.0 });
  D.act('greg', 'idle'); D.faceChar('greg', 'aaron', 0.3);
  D.say('greg', 'THE BEAT WAS TOO POWERFUL!', { cam: R('greg', -30, 2.0, 0.1), act: 'armsOut', expr: 'grin', dur: 2.0 });
  // Flare's elegant dance
  D.act('flare', 'courtDance'); D.expr('flare', 'smug');
  D.cam(R('flare', 0, 3.0, 0.3)); D.sound('Flare dances with exaggerated theatrical movements', 2.0); D.wait(2.2);
  D.act('eric', 'idle'); D.faceChar('eric', 'flare', 0.3);
  D.say('eric', "WHY ARE YOU DANCING LIKE YOU'RE IN A MEDIEVAL PLAY?!", { cam: R('eric', -20, 2.6, 0.15), act: 'armsOut', expr: 'laugh', dur: 2.8 });
  D.say('flare', "IT'S CALLED ELEGANCE!", { cam: R('flare', 10, 2.6, 0.2), act: 'courtDance', dur: 1.8 });
  // Newark joins
  D.place('newark', 2.6, 2.6, P + 0.9); D.set('newark.y', 0); props('newark'); D.act('newark', 'laugh'); D.expr('newark', 'laugh');
  D.say('newark', 'You guys are hilarious!', { cam: R('newark', 15, 2.6, 0.15), dur: 1.9 });
  for (const c of [...TEAM, 'newark']) { D.act(c, 'dance'); D.expr(c, 'laugh'); }
  props('aaron'); D.act('aaron', 'dance');
  D.sfx('crowdLaugh', 0, 0.4);
  D.cam(FIX([0.6, 2.6, 6.2], [0.2, 1.1, 1.6], { fov: 54 })); D.sound('The group laughs and keeps dancing', 2.0); D.wait(2.2);
  // Eric the bird-dog blows the pumpkins off the table
  {
    const [ex, ez] = pos('eric');
    D.set('flashWhite', 0.5); D.anim('flashWhite', 0, 0.5); D.sfx('transform', 0, 0.9);
    D.fx('sparks', { x: ex, y: 1.2, z: ez, n: 80, color: 0x6fc4ff, speed: 2.8 });
    D.hide('eric', 0.1); D.place('birddog', ex, ez, -P / 2, 0.1); D.set('birddog.y', 0.9, 0.1); D.set('birddog.act', 'fly', 0.1); D.set('birddog.spin', 0);
    D.anim('birddog.y', 1.5, 0.6, 0.2);
    D.sfx('flap', 0, 0.7, { repeat: 12, every: 0.25 });
    D.cam(FIX([1.6, 2.0, 4.6], [-1.6, 1.6, 0.8], { fov: 56 }));
    D.say('eric', 'WOOHOO!', { label: 'ERIC (BIRD-DOG)', dur: 1.2, dt: 0.4 });
    D.act('aaron', 'idle'); D.faceTo('aaron', ex, ez, 0.3); D.expr('aaron', 'shocked');
    D.say('aaron', 'ERIC! NO FLYING INDOORS!', { cam: R('aaron', 20, 2.4, 0.15), act: 'yell', dur: 2.0 });
    D.say('eric', 'TOO LATE!', { label: 'ERIC (BIRD-DOG)', dur: 1.3 });
    D.path('birddog', [[-3.6, 1.0, 1.6], [-5.6, 0.7, 1.7]], 3.2);
    D.cam(FIX([-3.6, 2.4, 3.8], [-6.2, 1.1, 0.6], { fov: 54 })); D.wait(1.0);
    D.anim('party.blow', 1, 1.4); D.sfx('wingGust', 0, 0.9); D.sfx('pumpkinTumble', 0.3, 0.9);
    D.comic('WHOOSH!', 0.1, 0.9, { x: 0.4, y: 0.3, size: 100, rot: -8, c1: '#ffffff', c2: '#7fd4ff' });
    D.sound('He blows the Halloween decorations off the snack table', 2.0); D.wait(1.8);
    D.faceTo('newark', -6.0, 0.8, 0.3); D.act('newark', 'gasp'); D.expr('newark', 'shocked');
    D.say('newark', 'MY PUMPKINS!', { cam: R('newark', 10, 2.2, 0.1), dur: 1.6 });
    const bx = -5.6, bz = 0.7;
    D.set('flashWhite', 0.4); D.anim('flashWhite', 0, 0.5); D.sfx('transform', 0, 0.7);
    D.fx('sparks', { x: bx, y: 1.2, z: bz, n: 60, color: 0x6fc4ff, speed: 2.4 });
    D.hide('birddog', 0.1); D.place('eric', bx, bz, P / 2, 0.1); D.act('eric', 'shrug', 0.1); D.expr('eric', 'worried', 0.1);
  }
  D.say('eric', '...My bad.', { cam: F(['eric'], 70, 2.6, 0.15), dur: 1.6, dt: 0.3 });
  for (const c of ['aaron', 'flare', 'greg', 'newark']) { D.act(c, 'laugh'); D.expr(c, 'laugh'); }
  D.act('eric', 'laugh'); D.expr('eric', 'laugh'); D.sfx('crowdLaugh', 0, 0.6);
  D.cam(FIX([1.8, 2.6, 5.6], [-1.4, 1.1, 1.2], { fov: 60 })); D.sound('Everyone bursts out laughing', 2.0); D.wait(2.4);
  D.anim('fade', 1, 0.6); D.wait(0.7);

  // ===================================================================== SCENE 8: BEST HALLOWEEN EVER
  D.scene('8. Best Halloween Ever');
  D.location('newarkExt');
  cast([...TEAM, 'newark']);
  D.set('fade', 0); D.set('nk.door', 1); D.set('nk.party', 0.3); D.set('nk.guests', 0); D.set('amb.muffled', 0.4);
  D.music('night', 0.4, 0, 0.8);
  D.place('newark', 0, -4.3, 0); D.set('newark.y', 0.4); D.act('newark', 'idle'); D.expr('newark', 'happy'); props('newark');
  D.place('aaron', -0.55, -1.9, P - 0.22); D.place('flare', 0.55, -1.9, P + 0.22); D.place('eric', -1.6, -1.4, P - 0.5); D.place('greg', 2.4, -1.0, P + 0.5);
  for (const c of TEAM) { D.set(`${c}.y`, 0); D.act(c, 'idle'); D.expr(c, 'happy'); props(c); }
  props('greg', 'pizza');
  D.cam(FIX([3.4, 2.2, 1.6], [0, 1.4, -3.4], { fov: 50 }));
  D.sound('The party is winding down', 1.6); D.wait(1.8);
  D.act('newark', 'welcome');
  D.say('newark', 'Thanks for coming, guys. You made this party unforgettable.', { cam: R('newark', 0, 1.9, 0.1), dur: 3.2 });
  D.act('newark', 'idle');
  D.say('flare', 'It was an excellent evening.', { cam: R('flare', -45, 2.2, 0.12), act: 'bow', expr: 'smug', dur: 2.0 });
  D.act('flare', 'idle');
  D.say('aaron', 'And nobody tried to destroy the headquarters.', { cam: R('aaron', 45, 2.2, 0.12), dur: 2.4 });
  D.say('eric', 'Yet.', { cam: R('eric', 45, 2.2, 0.12), expr: 'smug', dur: 1.2 });
  for (const c of ['aaron', 'flare', 'greg', 'newark']) { D.faceChar(c, 'eric', 0.4); D.expr(c, 'annoyed'); }
  D.cam(F(['aaron', 'flare', 'greg'], 0, 4.6, 0.3)); D.sound('Everyone turns toward him', 1.6); D.wait(1.6);
  D.say('eric', 'Kidding!', { cam: R('eric', 45, 2.2, 0.12), act: 'armsOut', expr: 'grin', dur: 1.3 });
  D.act('eric', 'idle');
  for (const c of ['aaron', 'flare']) { D.faceTo(c, 0, -4.3, 0.4); D.expr(c, 'happy'); } D.faceTo('newark', 0, 0, 0.4); D.expr('newark', 'happy');
  D.act('greg', 'eatBar'); D.sfx('munch', 0, 0.6); D.expr('greg', 'happy');
  D.faceTo('greg', 0.5, -4.3, 0.3); D.cam(FIX([1.6, 1.55, -2.6], [2.4, 1.25, -1.0], { fov: 42 })); D.sound('Greg finishes the last piece of pizza', 1.8); D.wait(1.9);
  props('greg'); D.act('greg', 'idle');
  D.say('greg', 'So... same party next year?', { dur: 1.9 });
  D.say('newark', 'Absolutely!', { cam: R('newark', 0, 1.9, 0.1), act: 'thumbsUp', expr: 'grin', dur: 1.5 });
  D.act('newark', 'wave');
  // walking away
  D.path('aaron', [[-0.7, 3.4]], 1.2); D.path('flare', [[0.6, 3.5]], 1.2, 0.1); D.path('eric', [[-1.9, 4.0]], 1.2, 0.2); D.path('greg', [[1.9, 4.1]], 1.2, 0.3);
  for (const c of TEAM) { D.act(c, 'laugh'); D.expr(c, 'laugh'); }
  D.cam(FIX([0, 1.9, 8.2], [0, 1.2, 1.0], { fov: 50 })); D.sound('The four friends walk away, laughing', 2.0); D.wait(5.0);
  for (const c of TEAM) D.act(c, 'idle');
  D.expr('flare', 'happy');
  D.say('flare', 'You know, today was actually pretty peaceful.', { cam: R('flare', 0, 2.6, 0.12), dur: 2.6 });
  for (const c of ['aaron', 'eric', 'greg']) { D.faceChar(c, 'flare', 0.3); D.expr(c, 'shocked'); }
  D.cam(F(['aaron', 'eric', 'greg', 'flare'], 15, 4.6, 0.4)); D.sound('Everyone stops walking', 1.4); D.wait(1.5);
  D.say('aaron', 'Flare.', { cam: R('aaron', -50, 2.2, 0.1), expr: 'worried', dur: 1.2 });
  D.say('eric', "Don't.", { cam: R('eric', -50, 2.2, 0.1), act: 'gasp', expr: 'worried', dur: 1.1 });
  D.say('greg', 'BRO, WHY WOULD YOU SAY THAT?!', { cam: R('greg', 50, 2.2, 0.1), act: 'armsOut', expr: 'shocked', dur: 2.0 });
  // the crash
  D.sfx('skeletonCrash', 0, 1.0); D.shake(0.2, 0.4);
  D.comic('CRASH!', 0.05, 1.0, { x: 0.5, y: 0.3, size: 130, rot: -6 });
  for (const c of TEAM) { D.face(c, P, 0.3); D.expr(c, 'shocked'); D.act(c, 'jumpScare'); }
  D.cam(FIX([0.4, 1.4, 6.4], [0, 2.6, -5.0], { fov: 46 })); D.sound("A loud crash comes from inside Newark's house", 2.0); D.wait(2.0);
  D.say('newark', 'WHO BROKE THE SKELETON?!', { label: 'NEWARK (OFF-SCREEN)', dur: 2.4 });
  for (const c of TEAM) { D.face(c, 0, 0.5); D.act(c, 'laugh'); D.expr(c, 'laugh'); }
  D.sfx('crowdLaugh', 0, 0.5);
  D.cam(F(['aaron', 'flare', 'eric', 'greg'], 0, 4.4, 0.3, { dist2: 6.2, h2: 1.2 })); D.sound('The four friends burst out laughing', 2.0); D.wait(3.0);
  D.anim('fade', 1, 0.8); D.sfx('cutBlack', 0.7, 0.4); D.wait(1.0);

  // ===================================================================== END CARD
  D.scene('End');
  D.location('title');
  cast([]);
  D.set('fade', 1); D.anim('fade', 0, 0.8);
  D.music('spooky', 0.7, 0, 0.1);
  D.set('title.theme', 2); D.set('title.k', 1); D.set('title.sub', 0); D.set('title.y', 1.65); D.set('title.jolt', 0);
  D.cam(FIX([0, 0.6, 10.5], [0, 0.4, 0], { pos2: [0, 0.5, 10.0], fov: 42 }));
  const endDur = 13;
  D.card('credits', endDur, {
    lines: [
      { text: 'END OF EPISODE 4', big: true, y: 0.52, color: '#ffa040' },
      { text: 'BATTLE WARS WILL RETURN...', bold: true, y: 0.61, color: '#d6b4ff' },
      { text: '🎃  HAPPY HALLOWEEN!  🎃', big: true, y: 0.7, color: '#ffd23f' },
      { text: 'Starring  Aaron  ·  Flare  ·  Eric  ·  Greg  ·  and Newark', y: 0.8 },
      { text: 'Created by Nick', y: 0.86 },
      { text: 'New episodes every Saturday at 8:00 AM.', y: 0.92, color: '#7fd4ff' },
    ],
  });
  D.wait(endDur - 1.6);
  D.anim('fade', 1, 1.5); D.wait(1.6);
  return D.end();
}
