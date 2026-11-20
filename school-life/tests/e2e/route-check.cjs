// Verifies NPC routing: after the bell every student should reach a seat (or a hallway spot).
function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    return require(process.env.PW_PATH || '/opt/node-tools/node_modules/playwright');
  }
}
const { chromium } = loadPlaywright();
const path = require('path');
const fs = require('fs');
const base = process.argv[2] || 'http://localhost:5173/';
const outDir = process.argv[3] || path.resolve(__dirname, '../../screenshots/tmp');
fs.mkdirSync(outDir, { recursive: true });
const IGNORE = [/GPU stall due to ReadPixels/];
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', (m) => { const t = m.type(); if ((t === 'error' || t === 'warning') && !IGNORE.some((r) => r.test(m.text()))) problems.push(`[console.${t}] ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}\n${e.stack}`));
  try {
    await page.goto(base + '?fixedres&debug', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tapStart:not(.hidden)', { timeout: 180000 });
    await page.tap('#screen-loading');
    await page.waitForSelector('#screen-auth:not(.hidden) .idcard');
    await page.fill('#authEmail', 'route.test@gmail.com'); await page.fill('#authPass', 'pass1234'); await page.fill('#authConfirm', 'pass1234');
    await page.tap('[data-gender="female"]'); await page.tap('#authSubmit');
    await page.waitForSelector('#lockContinue', { timeout: 20000 }); await page.tap('#lockContinue');
    await page.waitForSelector('#letterOk'); await page.tap('#letterOk');
    await page.waitForSelector('#screen-menu:not(.hidden)');
    await page.tap('#btnPlay', { force: true });
    await page.waitForSelector('#screen-grade:not(.hidden)'); await page.waitForTimeout(600);
    await page.tap('[data-grade="9"]', { force: true });
    await page.waitForSelector('#hud:not(.hidden)', { timeout: 20000 });
    for (let round = 0; round < 3; round++) {
      const res = await page.evaluate((round) => {
        const g = window.__SL.game, p = window.__SL.play;
        p.teleport(26, 16, 0);
        g.skipToBell(1);
        p.fastForward(2);
        const st0 = {}; for (const n of g.npcs.list) st0[n.state] = (st0[n.state] || 0) + 1;
        p.fastForward(80);
        const st = {}; for (const n of g.npcs.list) st[n.state] = (st[n.state] || 0) + 1;
        const stuck = g.npcs.list.filter((n) => n.state === 'walk').map((n) => ({ i: n.i, x: +n.x.toFixed(2), z: +n.z.toFixed(2), pi: n.pi, len: n.path.length, next: n.path[n.pi], seat: n.seat && n.seat.room, block: +n.blockT.toFixed(2) }));
        // seated NPCs must be exactly on their seat
        let bad = 0;
        for (const n of g.npcs.list) if (n.state === 'seated' && (Math.abs(n.x - n.seat.x) > 0.01 || Math.abs(n.z - n.seat.z) > 0.01 || n.seat.occupant !== n)) bad++;
        const per = {}; for (const n of g.npcs.list) if (n.state === 'seated') per[n.seat.room] = (per[n.seat.room] || 0) + 1;
        return { round, afterBell: st0, after80s: st, perRoom: per, badSeats: bad, stuck: stuck.slice(0, 6), period: p.state.period };
      }, round);
      console.log(JSON.stringify(res));
      if (res.badSeats) problems.push('[route] NPCs not on their seats: ' + res.badSeats);
      if ((res.after80s.walk || 0) > 2) problems.push('[route] NPCs still walking after 80s: ' + res.after80s.walk);
    }
    await page.evaluate(() => window.__SL.play.teleport(14.6, 3.2, Math.PI, -0.05));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '46-auditorium-after-bell.png') });
  } catch (e) {
    problems.push('[test] ' + e.message);
  }
  console.log('PROBLEMS:', problems.length);
  for (const p of problems.slice(0, 20)) console.log('  ', p);
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})();
