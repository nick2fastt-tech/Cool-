// The school clock: starts at 8:00, +1 minute per 60 s, late at +15 min, bell at 8:31,
// school out at 12:22, then a new day. Fails on any console error/warning or wrong value.
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
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const problems = [];
  const fails = [];
  page.on('console', (m) => { const t = m.type(); if ((t === 'error' || t === 'warning') && !IGNORE.some((r) => r.test(m.text()))) problems.push(`[console.${t}] ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
  const check = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : '')); if (!ok) fails.push(name); };
  const chip = () => page.evaluate(() => ({
    time: document.getElementById('chipTime').textContent,
    left: document.getElementById('chipLeft').textContent,
    cls: document.getElementById('chipClass').textContent,
    status: document.getElementById('chipStatus').textContent,
    toasts: [...document.querySelectorAll('.toast span')].map((e) => e.textContent).join(' | '),
  }));
  const ff = (s) => page.evaluate((s) => window.__SL.play.fastForward(s), s);
  const setTime = (h, m, s = 0) => page.evaluate((v) => { window.__SL.game.clock.minutes = v; }, h * 60 + m + s / 60);
  const shot = (name) => page.screenshot({ path: path.join(outDir, name + '.png') });
  try {
    await page.goto(base + (base.includes('?') ? '&' : '?') + 'debug&fixedres', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tapStart:not(.hidden)', { timeout: 180000 });
    await page.evaluate(async () => {
      document.getElementById('screen-loading').classList.add('hidden');
      await window.__SL.game.startPlaying(7, { email: 'clock@gmail.com', gender: 'female' });
    });
    await ff(0.3);
    let c = await chip();
    check('school starts at 8:00 AM', c.time === '8:00 AM', c.time);
    check('1st period is Homeroom (7th grade, Room 103)', c.cls === 'P1 · Homeroom · Rm 103', c.cls);
    check('status says when you are late', /Go to Room 103 by 8:15 AM/.test(c.status), c.status);
    check('welcome message mentions 8:15', /Be there by 8:15 AM/.test(c.toasts), c.toasts.slice(0, 120));
    await shot('clock-1-start');
    await ff(60);
    c = await chip();
    check('60 seconds later it is 8:01 AM', c.time === '8:01 AM', c.time);

    await setTime(8, 14, 55);
    await ff(6);
    c = await chip();
    check('late at 8:15', /^LATE! Go to Room 103/.test(c.status) && /late for/.test(c.toasts), c.status);
    await shot('clock-2-late');
    await page.evaluate(() => window.__SL.play.teleport(22.9, -3.4, Math.PI / 2 + 0.15, -0.12));
    await ff(0.5);
    c = await chip();
    check('arriving after 8:15 counts as late', /made it to/.test(c.toasts) && /Late/.test(c.status), c.status);

    await setTime(8, 29, 57);
    await ff(4);
    c = await chip();
    check('class ends at 8:30, break until the bell', c.cls === 'Next: P2 · English · Rm 105' && /^Bell in (0:5\d|1:00)$/.test(c.left), `${c.cls} / ${c.left}`);
    check('"class is over" message', /Class is over!/.test(c.toasts), c.toasts.slice(0, 100));
    await shot('clock-3-class-over');
    await ff(60); // 8:30:01 + 60 s = 8:31:01
    c = await chip();
    check('the bell at 8:31 starts 2nd period', c.time === '8:31 AM' && c.cls === 'P2 · English · Rm 105' && /Period 2/.test(c.toasts), `${c.time} ${c.cls}`);
    await shot('clock-4-bell-831');

    await setTime(11, 37, 0);
    await ff(0.3);
    c = await chip();
    check('8th period starts at 11:37 and lasts 45 minutes', c.cls === 'P8 · Study Hall · Rm 106' && /^4[45]:\d\d left$/.test(c.left), `${c.cls} / ${c.left}`);
    await setTime(12, 21, 57);
    await ff(4);
    c = await chip();
    check("school's out at 12:22 PM", c.time === '12:22 PM' && c.status === "School's out!" && /School's out!/.test(c.toasts), `${c.time} ${c.status}`);
    await shot('clock-5-school-out');
    await ff(62);
    await page.waitForTimeout(1500);
    await ff(0.5);
    c = await chip();
    const day = await page.evaluate(() => window.__SL.game.clock.day);
    check('a new school day starts at 8:00 AM', c.time === '8:00 AM' && day === 2 && c.cls === 'P1 · Homeroom · Rm 103', `day ${day} ${c.time}`);
    await page.tap('#scheduleChip');
    await page.waitForTimeout(600);
    const rows = await page.$$eval('.prow .ptime', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    check('schedule panel shows the new times', rows[1] && rows[1].startsWith('8:31 AM – 9:01 AM') && rows[7].startsWith('11:37 AM – 12:22 PM'), rows[1] + ' | ' + rows[7]);
    await shot('clock-6-schedule');
  } catch (e) {
    problems.push('[test] ' + e.message);
  }
  console.log(`\n${fails.length} failed checks, ${problems.length} console problems`);
  for (const p of problems.slice(0, 10)) console.log('  ', p);
  await browser.close();
  process.exit(fails.length || problems.length ? 1 : 0);
})();
