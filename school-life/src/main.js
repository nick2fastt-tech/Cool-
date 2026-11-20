// School Life — entry point.
import '@fontsource/luckiest-guy/latin-400.css';
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/patrick-hand/latin-400.css';
import './ui/style.css';

import { UI } from './ui/menus.js';
import { AudioManager } from './core/audio.js';
import { AccountService } from './core/account.js';
import { Game } from './game/game.js';

const params = new URLSearchParams(location.search);
const debug = {
  enabled: params.has('debug'),
  fixedRes: params.has('fixedres'),
  time: params.get('time'),
};

async function loadFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const faces = ['400 64px "Luckiest Guy"', '400 64px "Patrick Hand"', '400 32px Fredoka', '600 32px Fredoka', '700 32px Fredoka'];
  try {
    await Promise.race([Promise.all(faces.map((f) => document.fonts.load(f, 'SCHOOL LIFE 0123'))), new Promise((r) => setTimeout(r, 4000))]);
  } catch (e) {
    /* fonts are optional */
  }
}

function wantsFullscreen() {
  return matchMedia('(pointer: coarse)').matches && !matchMedia('(display-mode: standalone)').matches;
}

function goFullscreen() {
  const el = document.documentElement;
  if (!wantsFullscreen() || document.fullscreenElement || !el.requestFullscreen) return;
  try {
    const p = el.requestFullscreen({ navigationUI: 'hide' });
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    /* not supported */
  }
}

async function boot() {
  const audio = new AudioManager();
  const account = new AccountService();
  const ui = new UI({ audio, account });
  ui.build();
  audio.loadMusic(new URL('audio/theme.mp3', document.baseURI).toString());
  const accountReady = account.init().catch(() => null);

  const canvas = document.getElementById('scene');
  const game = new Game({ canvas, ui, audio, account, debug });
  window.__SL = { game, ui, audio, account };

  ui.setProgress(0.01, 'Sharpening pencils…');
  await loadFonts();
  try {
    await game.load((p, label) => ui.setProgress(p, label));
  } catch (err) {
    console.error(err);
    ui.loadingError('Sorry! The school couldn\'t load on this device (' + (err && err.message ? err.message : 'graphics error') + ').');
    return;
  }
  await accountReady;
  game.setMode('menu');
  game.start();

  await ui.waitForTap();
  audio.unlock();
  goFullscreen();
  await ui.hideLoading();

  let user = account.user;
  if (!user) user = await ui.showAuth();
  showMenu(user);

  function showMenu(u) {
    game.setMode('menu');
    ui.showMenu(u);
    audio.playMusic(1.6);
  }

  ui.on('play', async () => {
    const grade = await ui.showGrade();
    if (!grade) return;
    audio.stopMusic(0.9);
    await ui.fadeOut('Heading to class…', grade + 'th Grade');
    ui.hideGrade();
    ui.hideMenu();
    if (game.startPlaying) await game.startPlaying(grade, account.user);
    await ui.fadeIn();
  });

  ui.on('signout', async () => {
    await account.logout();
    ui.hideMenu();
    audio.stopMusic(0.5);
    const u = await ui.showAuth();
    showMenu(u);
  });

  ui.on('mainmenu', async () => {
    await ui.fadeOut('');
    if (game.stopPlaying) game.stopPlaying();
    showMenu(account.user);
    await ui.fadeIn();
  });
}

function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!secure) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        const urls = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => u.startsWith(location.origin) && !u.includes('/api/') && !u.endsWith('.mp3'));
        const sendList = (w) => w && w.postMessage({ type: 'cache', urls });
        if (reg.active) sendList(reg.active);
        else navigator.serviceWorker.ready.then((r) => sendList(r.active)).catch(() => {});
      })
      .catch(() => {});
  });
}

registerServiceWorker();
boot();
