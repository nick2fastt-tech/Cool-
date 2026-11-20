// Captures the README / showcase screenshots into screenshots/.
// Usage: node tests/e2e/final-shots.cjs [baseUrl] [time HH:MM:SS]
function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    return require(process.env.PW_PATH || '/opt/node-tools/node_modules/playwright');
  }
}
const { chromium } = loadPlaywright();
const fs = require('fs');
const path = require('path');
const base = process.argv[2] || 'http://localhost:5173/';
const time = process.argv[3] || '10:12:00';
const out = path.resolve(__dirname, '../../screenshots');
fs.mkdirSync(out, { recursive: true });
const IGNORE = [/GPU stall due to ReadPixels/];

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const problems = [];
  const watch = (page) => {
    page.on('console', (m) => { const t = m.type(); if ((t === 'error' || t === 'warning') && !IGNORE.some((r) => r.test(m.text()))) problems.push(`[console.${t}] ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
  };
  const url = (t) => base + (base.includes('?') ? '&' : '?') + 'fixedres&debug&time=' + t;
  const shot = async (page, name, wait = 900) => { await page.waitForTimeout(wait); await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name); };

  // ---------- menus (landscape phone)
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(url('13:20:00'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  await shot(page, 'loading', 50);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
  await page.waitForSelector('#tapStart:not(.hidden)', { timeout: 180000 });
  await page.tap('#screen-loading');
  await page.waitForSelector('#screen-auth:not(.hidden) .idcard');
  await page.fill('#authEmail', 'nick.' + Date.now() + '@gmail.com');
  await page.fill('#authPass', 'schoollife');
  await page.fill('#authConfirm', 'schoollife');
  await page.tap('[data-gender="male"]');
  await shot(page, 'signup', 600);
  await page.tap('#authSubmit');
  await page.waitForSelector('#lockContinue', { timeout: 20000 });
  await shot(page, 'locked-in', 1400);
  await page.tap('#lockContinue');
  await page.waitForSelector('#letterOk, #screen-menu:not(.hidden)');
  if (await page.$('#letterOk')) {
    await shot(page, 'welcome-letter', 600);
    await page.tap('#letterOk');
  }
  await page.waitForSelector('#screen-menu:not(.hidden)');
  // freeze the title mid-drop for one shot
  await page.evaluate(() => {
    const anims = document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.classList && a.effect.target.classList.contains('ch'));
    anims.forEach((a) => { a.pause(); a.currentTime = 760; });
  });
  await shot(page, 'title-animation', 300);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
  await page.waitForTimeout(3500);
  await shot(page, 'menu', 200);
  await page.tap('#btnSettings');
  await shot(page, 'settings', 600);
  await page.tap('#setClose');
  await page.tap('#btnPlay', { force: true });
  await page.waitForSelector('#screen-grade:not(.hidden)');
  await shot(page, 'grade-select', 900);
  await ctx.close();

  // ---------- gameplay (landscape phone, school-day time)
  const ctx2 = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p2 = await ctx2.newPage();
  watch(p2);
  await p2.goto(url(time), { waitUntil: 'domcontentloaded' });
  await p2.waitForSelector('#tapStart:not(.hidden)', { timeout: 180000 });
  await p2.evaluate(async () => {
    document.getElementById('screen-loading').classList.add('hidden');
    await window.__SL.game.startPlaying(7, { email: 'nick@gmail.com', gender: 'male' });
  });
  await p2.waitForTimeout(5200); // let the welcome toast fade
  const tp = (...a) => p2.evaluate((a) => window.__SL.play.teleport(...a), a);
  await tp(26, 16.5, 0, -0.02);
  await shot(p2, 'lobby', 1200);
  for (const [name, v] of [
    ['corridor', [3, 0, -Math.PI / 2, -0.02]],
    ['classroom', [10.9, -3.4, Math.PI / 2 + 0.15, -0.12]],
    ['science-lab', [35.0, 4.0, -Math.PI / 2 - 0.35, -0.1]],
    ['auditorium', [9.0, 2.7, Math.PI, -0.06]],
    ['library', [50.2, 3.2, Math.PI + 0.35, -0.1]],
    ['principals-office', [52.2, 17.0, -Math.PI / 2, -0.04]],
    ['second-floor', [21, 0, Math.PI / 2, 0.0, 4.0]],
  ]) {
    await tp(...v);
    await shot(p2, name, 1300);
  }
  await tp(8.7, -6.0, Math.PI / 2, -0.1);
  await p2.evaluate(() => window.__SL.play.sitNearest());
  await shot(p2, 'sitting-in-class', 1500);
  await p2.tap('#scheduleChip');
  await shot(p2, 'schedule', 700);
  await p2.tap('#schResume');
  // passing period: ring the bell and let students pour into the hall
  await p2.evaluate(() => { const g = window.__SL.game, p = window.__SL.play; p.teleport(33.5, 0.9, Math.PI / 2 + 0.05, -0.03); g.skipToBell(1); p.fastForward(9); });
  await shot(p2, 'passing-period', 1200);
  await ctx2.close();

  // ---------- portrait phone
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p3 = await ctx3.newPage();
  watch(p3);
  await p3.goto(url(time), { waitUntil: 'domcontentloaded' });
  await p3.waitForSelector('#tapStart:not(.hidden)', { timeout: 180000 });
  await p3.evaluate(async () => {
    document.getElementById('screen-loading').classList.add('hidden');
    await window.__SL.game.startPlaying(6, { email: 'nick@gmail.com', gender: 'female' });
  });
  await p3.waitForTimeout(5200);
  await p3.evaluate(() => window.__SL.play.teleport(30.5, 0.4, Math.PI / 2, -0.05));
  await shot(p3, 'portrait-hallway', 1300);
  await ctx3.close();

  fs.mkdirSync(path.join(out, 'tmp'), { recursive: true });
  fs.writeFileSync(path.join(out, 'tmp', 'final-problems.txt'), problems.join('\n'));
  console.log('PROBLEMS:', problems.length);
  for (const p of problems.slice(0, 10)) console.log('  ', p);
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})();
