// Bell + passing period: students leave class and walk to their next room.
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
const outDir = process.argv[3] || path.resolve(__dirname, '../../screenshots/tmp');
fs.mkdirSync(outDir, { recursive: true });
const IGNORE = [/GPU stall due to ReadPixels/];
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', (m) => { const t = m.type(); if ((t === 'error' || t === 'warning') && !IGNORE.some((r) => r.test(m.text()))) problems.push(`[console.${t}] ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}\n${e.stack}`));
  const shot = async (name) => { await page.screenshot({ path: path.join(outDir, name + '.png') }); console.log('shot', name); };
  try {
    await page.goto(base + '?fixedres&debug', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tapStart:not(.hidden)', { timeout: 180000 });
    await page.tap('#screen-loading');
    await page.waitForSelector('#screen-auth:not(.hidden) .idcard');
    await page.fill('#authEmail', 'bell.test@gmail.com');
    await page.fill('#authPass', 'pass1234');
    await page.fill('#authConfirm', 'pass1234');
    await page.tap('[data-gender="male"]');
    await page.tap('#authSubmit');
    await page.waitForSelector('#lockContinue', { timeout: 20000 });
    await page.tap('#lockContinue');
    await page.waitForSelector('#letterOk');
    await page.tap('#letterOk');
    await page.waitForSelector('#screen-menu:not(.hidden)');
    await page.tap('#btnPlay', { force: true });
    await page.waitForSelector('#screen-grade:not(.hidden)');
    await page.waitForTimeout(600);
    await page.tap('[data-grade="6"]', { force: true });
    await page.waitForSelector('#hud:not(.hidden)', { timeout: 20000 });
    await page.waitForTimeout(1500);
    // stand in the corridor near the classroom doors, looking west
    await page.evaluate(() => { window.__SL.play.teleport(25.5, 0.3, Math.PI / 2 - 0.08, -0.02); window.__SL.game.skipToBell(3); });
    await page.waitForTimeout(4500);
    await shot('40-bell-rings');
    for (const [t, name] of [[7000, '41-passing-1'], [8000, '42-passing-2'], [10000, '43-passing-3']]) {
      await page.waitForTimeout(t);
      await shot(name);
    }
    // close-up of students walking
    await page.evaluate(() => window.__SL.play.teleport(9.5, 0.9, -Math.PI / 2 + 0.25, -0.05));
    await page.waitForTimeout(2500);
    await shot('44-students-walking');
    await page.waitForTimeout(20000);
    await page.evaluate(() => window.__SL.play.teleport(22.9, -3.4, Math.PI / 2 + 0.15, -0.12));
    await page.waitForTimeout(1500);
    await shot('45-next-class-seated');
    const st = await page.evaluate(() => { const n = window.__SL.game.npcs; const c = {}; for (const x of n.list) c[x.state] = (c[x.state] || 0) + 1; return c; });
    console.log('npc states', JSON.stringify(st));
  } catch (e) {
    problems.push('[test] ' + e.message);
    await page.screenshot({ path: path.join(outDir, 'failure.png') }).catch(() => {});
  }
  console.log('PROBLEMS:', problems.length);
  for (const p of problems.slice(0, 20)) console.log('  ', p);
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})();
