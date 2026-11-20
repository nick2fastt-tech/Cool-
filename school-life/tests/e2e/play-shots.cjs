// In-game walkthrough screenshots. Fails if the page logs any error or warning.
// Usage: node tests/e2e/play-shots.cjs [baseUrl] [outDir] [time HH:MM:SS]
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
const time = process.argv[4] || '';
const only = new Set(process.argv.slice(5));
fs.mkdirSync(outDir, { recursive: true });
const want = (k) => only.size === 0 || only.has(k);

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const problems = [];
  // Headless Chromium's software compositor prints this for ANY WebGL page (even an empty one).
  const IGNORE = [/GPU stall due to ReadPixels/];
  page.on('console', (m) => { const t = m.type(); if ((t === 'error' || t === 'warning') && !IGNORE.some((r) => r.test(m.text()))) problems.push(`[console.${t}] ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}\n${e.stack}`));
  // Media elements abort their first request and re-request with a Range header (normal browser behavior).
  page.on('requestfailed', (r) => { const err = r.failure() && r.failure().errorText; if (/\.mp3$/.test(r.url()) && err === 'net::ERR_ABORTED') return; problems.push(`[requestfailed] ${r.url()} ${err}`); });
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`[http ${r.status()}] ${r.url()}`); });
  const shot = async (name, settle = 900) => {
    await page.waitForTimeout(settle);
    const f = path.join(outDir, name + '.png');
    await page.screenshot({ path: f });
    console.log('shot', name);
  };
  const ev = (fn, ...args) => page.evaluate(fn, ...args);
  try {
    let url = base + (base.includes('?') ? '&' : '?') + 'fixedres&debug';
    if (time) url += '&time=' + time;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tapStart:not(.hidden)', { timeout: 180000 });
    await page.tap('#screen-loading');
    await page.waitForSelector('#screen-auth:not(.hidden) .idcard');
    await page.fill('#authEmail', 'tester.student@gmail.com');
    await page.fill('#authPass', 'pass1234');
    await page.fill('#authConfirm', 'pass1234');
    await page.tap('[data-gender="female"]');
    await page.tap('#authSubmit');
    await page.waitForSelector('#lockContinue', { timeout: 20000 });
    await page.tap('#lockContinue');
    await page.waitForSelector('#letterOk, #screen-menu:not(.hidden)', { timeout: 5000 });
    if (await page.$('#letterOk')) await page.tap('#letterOk');
    await page.waitForSelector('#screen-menu:not(.hidden)');
    await page.waitForTimeout(300);
    await page.tap('#btnPlay', { force: true });
    await page.waitForSelector('#screen-grade:not(.hidden)');
    await page.waitForTimeout(700);
    await page.tap('[data-grade="7"]', { force: true });
    await page.waitForSelector('#hud:not(.hidden)', { timeout: 20000 });
    await page.waitForTimeout(1500);
    if (want('spawn')) await shot('20-lobby-spawn', 1200);
    const views = [
      ['21-corridor-east', [3, 0, -Math.PI / 2, -0.02]],
      ['22-corridor-west', [57, 0.2, Math.PI / 2, -0.02]],
      ['23-lobby-stairs', [28.5, 17.5, 0.55, 0.12]],
      ['24-math-101', [10.9, -3.4, Math.PI / 2 + 0.15, -0.12]],
      ['25-algebra-103', [22.9, -4.2, Math.PI / 2 + 0.25, -0.1]],
      ['26-english-105', [44.9, -4.0, Math.PI / 2 + 0.2, -0.1]],
      ['27-science-104', [35.0, 4.0, -Math.PI / 2 - 0.35, -0.1]],
      ['28-auditorium', [9.0, 2.7, Math.PI, -0.06]],
      ['29-auditorium-stage', [6.2, 14.6, Math.PI + 0.35, 0.02]],
      ['30-library', [50.2, 3.2, Math.PI + 0.35, -0.1]],
      ['31-library-lounge', [50.0, 13.6, Math.PI - 0.15, -0.16]],
      ['32-principal-office', [52.2, 17.0, -Math.PI / 2, -0.04]],
      ['33-floor2-balcony', [26.5, 4.6, -Math.PI / 2 + 0.4, -0.05, 4.0]],
      ['34-floor2-construction', [21, 0, Math.PI / 2, 0.0, 4.0]],
    ];
    for (const [name, v] of views) {
      if (!want(name.slice(3)) && !want('views')) continue;
      await ev((v) => window.__SL.play.teleport(...v), v);
      await shot(name, 1100);
    }
    if (want('sit')) {
      await ev(() => window.__SL.play.teleport(8.7, -6.0, Math.PI / 2, -0.1));
      await page.waitForTimeout(400);
      await ev(() => window.__SL.play.sitNearest());
      await shot('35-sitting-in-class', 1400);
    }
    if (want('schedule')) {
      await page.tap('#scheduleChip');
      await shot('36-schedule-panel', 700);
      await page.tap('#schResume');
    }
    if (want('door')) {
      await ev(() => window.__SL.play.teleport(10.6, -0.2, 0, -0.05));
      await page.waitForTimeout(500);
      await shot('37-door-closed', 400);
      await page.tap('#btnUse');
      await shot('38-door-open', 1200);
    }
    const stats = await ev(() => { const g = window.__SL.game; const r = g.gr.r; return { calls: r.info.render.calls, tris: r.info.render.triangles, geos: r.info.memory.geometries, tex: r.info.memory.textures, batches: g.world.stats.batches, worldTris: g.world.stats.tris }; });
    console.log('render stats', JSON.stringify(stats));
  } catch (e) {
    problems.push('[test] ' + e.message);
    await page.screenshot({ path: path.join(outDir, 'failure.png') }).catch(() => {});
  }
  fs.writeFileSync(path.join(outDir, 'problems-play.txt'), problems.join('\n'));
  console.log('PROBLEMS:', problems.length);
  for (const p of problems.slice(0, 30)) console.log('  ', p);
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})();
