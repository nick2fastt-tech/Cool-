// scratch scene for checking Season 2 models and sets (not an episode)
import { createDirector } from '../src/director.js';
export const META = { id: 's2-test', title: 'test', file: 'test', s2: true, s2e1: true, s2Cast: ['gus', 'rose', 'kid1', 'kid2', 'shop1', 'shop2', 'shop3', 'shop4', 'shop5', 'shop6'] };
export function buildEpisode() {
  const D = createDirector();
  const ALL = ['aaron', 'flare', 'eric', 'leon', 'greg', 'barista', 'newark', 'cowboy', ...META.s2Cast];
  const FIX = (pos, look, fov = 50) => ({ type: 'fixed', pos, look, fov });
  for (const c of ALL) { D.hide(c); D.act(c, 'idle'); D.expr(c, 'neutral'); D.set(`${c}.propR`, 'none'); D.set(`${c}.propL`, 'none'); }
  D.set('fade', 0);
  D.location('s2title'); D.set('s2title.t0', 0); D.cam(FIX([0, 0.2, 9], [0, 0.1, 0], 45)); D.wait(4);
  D.location('market'); D.set('mkt.stock', 1); D.set('mkt.clock', 52); D.set('mkt.spill', 1); D.set('cart1.vis', 1); D.set('cart1.x', 0); D.set('cart1.z', 0); D.set('cart1.ry', 0.4);
  D.place('gus', -6.6, 4.6, 0); D.place('aaron', 0, 4, P2()); D.place('rose', -0.8, 2, 0); D.place('shop1', 1.0, 1, 0);
  D.cam(FIX([0, 3.2, 7.5], [0, 0.8, -4], 60)); D.wait(1);
  D.cam(FIX([-3.6, 1.6, 2.5], [0, 1.0, -10.5], 55)); D.wait(1);
  D.set('turkey.vis', 1); D.set('turkey.kind', 'frozen'); D.set('turkey.hold', 'aaron.both'); D.act('aaron', 'carryS2'); D.cam({ type: 'frame', on: ['aaron'], yaw: 25, dist: 2.0, h: 0.0, rel: 'aaron', fov: 40 }); D.wait(1);
  for (const c of ALL) D.hide(c); D.set('turkey.vis', 0);
  D.location('marketExt'); D.cam(FIX([0, 2.2, 16], [0, 2.5, -10], 55)); D.wait(1);
  D.location('avenue'); D.set('float1.z', -8); D.set('balloon.z', -16); D.cam(FIX([-4, 2.2, 14], [0, 3.5, -20], 60)); D.wait(1);
  D.location('dining'); D.place('greg', 0, -1.2, 0); D.cam(FIX([0, 2.4, 4.3], [0, 0.8, -1], 60)); D.wait(1);
  D.cam(FIX([-3, 1.7, 0], [0.5, 1.0, -4.5], 55)); D.wait(1);
  D.location('living'); D.set('thx.decor', 1); D.hide('greg');
  ['aaron', 'flare', 'eric', 'leon', 'greg'].forEach((c, i) => D.place(c, -2 + i * 1.0, 1.9, 0));
  D.cam(FIX([0, 1.6, 4.9], [0, 1.4, -3], 55)); D.wait(1);
  for (const c of ['aaron', 'flare', 'eric', 'leon']) { D.cam({ type: 'frame', on: [c], yaw: 25, dist: 0.95, h: 0.1, rel: c, fov: 35 }); D.wait(0.5); }
  D.cam({ type: 'frame', on: ['eric'], yaw: 130, dist: 1.1, h: 0.15, rel: 'eric', fov: 35 }); D.wait(0.5);
  return D.end();
  function P2() { return Math.PI; }
}
