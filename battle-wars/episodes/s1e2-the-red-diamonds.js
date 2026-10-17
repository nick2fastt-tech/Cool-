// BATTLE WARS - Season 1, Episode 2: "THE RED DIAMONDS"
// Opening outside HQ in the evening -> the Red Diamonds scene -> end credits.
import { createDirector } from '../src/director.js';
import { redDiamondsScene } from './s1-red-diamonds.js';

export const META = { id: 's1e2-the-red-diamonds', title: 'Battle Wars - S1E2 - The Red Diamonds', file: 'Battle_Wars_S1E2_The_Red_Diamonds' };

// The opening is exactly 4 s (96 frames) so the already-rendered scene can be spliced in after it.
export const INTRO = 4.0;

export function buildEpisode() {
  const D = createDirector();
  const FIX = (pos, look, x = {}) => ({ type: 'fixed', pos, look, ...x });

  // ============================================================ OPENING: HQ in the evening
  D.scene('Opening');
  D.location('hqExt');
  D.set('fade', 1); D.anim('fade', 0, 0.8);
  D.set('evening', 1); D.set('hcar.vis', 1); D.set('hcar.x', -2.5); D.set('hcar.z', 5.4);
  D.cam(FIX([10, 1.6, 20], [0, 7, -8], { pos2: [6, 0.8, 14], look2: [0, 3, -6], fov: 46 }));
  D.card('location', 3.2, { text: 'BATTLE WARS HQ  -  THAT EVENING' });
  D.sfx('rumbleDeep', 0.6, 0.5);
  D.anim('fade', 1, 0.6, INTRO - 0.65);
  D.at(INTRO);

  // ============================================================ THE SCENE
  redDiamondsScene(D);

  // ============================================================ END CREDITS
  D.scene('End Credits');
  D.location('title');
  for (const c of ['aaron', 'flare', 'eric', 'barista', 'leon', 'greg', 'water', 'soul']) D.hide(c);
  D.set('fade', 1); D.anim('fade', 0, 1.0);
  D.music('theme', 0.8, 0, 0.1);
  D.set('title.theme', 0); D.set('title.k', 1); D.set('title.sub', 0); D.set('title.y', 1.65); D.set('title.jolt', 0);
  D.cam(FIX([0, 0.6, 10.5], [0, 0.4, 0], { pos2: [0, 0.5, 10.0], fov: 42 }));
  const credDur = 24;
  D.card('credits', credDur, {
    lines: [
      { text: 'Season 1, Episode 2:  "THE RED DIAMONDS"', bold: true, y: 0.5, color: '#ff6a7a' },
      { text: 'Starring  Aaron  ·  Flare  ·  Eric  ·  Greg  ·  Leon  ·  and the Soul Stealer', y: 0.58 },
      { text: 'Created by Nick', y: 0.65 },
      { text: 'New episodes every Saturday at 8:00 AM.', big: true, y: 0.77, color: '#7fd4ff' },
      { text: 'END OF EPISODE 2', bold: true, y: 0.88 },
    ],
  });
  D.wait(credDur - 1.6);
  D.anim('fade', 1, 1.5);
  D.wait(1.6);
  return D.end();
}
