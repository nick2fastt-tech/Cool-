// Gameplay mechanics with real touch input: joystick, look, walls, stairs, slopes, doors, sitting.
function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    return require(process.env.PW_PATH || '/opt/node-tools/node_modules/playwright');
  }
}
const { chromium } = loadPlaywright();
const base = process.argv[2] || 'http://localhost:5173/';
const IGNORE = [/GPU stall due to ReadPixels/];

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const problems = [];
  const fails = [];
  page.on('console', (m) => { const t = m.type(); if ((t === 'error' || t === 'warning') && !IGNORE.some((r) => r.test(m.text()))) problems.push(`[console.${t}] ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
  const check = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!ok) fails.push(name); };
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const state = () => page.evaluate(() => { const p = window.__SL.play.player; return { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, seat: !!p.seat, zone: window.__SL.play.zone }; });
  const ff = (s) => page.evaluate((s) => window.__SL.play.fastForward(s), s);
  const tp = (...a) => page.evaluate((a) => window.__SL.play.teleport(...a), a);

  try {
    await page.goto(base + (base.includes('?') ? '&' : '?') + 'debug&fixedres&time=10:05:00', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tapStart:not(.hidden)', { timeout: 180000 });
    await page.tap('#screen-loading');
    await page.waitForSelector('#screen-auth:not(.hidden) .idcard');
    await page.fill('#authEmail', 'mech.test@gmail.com');
    await page.fill('#authPass', 'pass1234');
    await page.fill('#authConfirm', 'pass1234');
    await page.tap('[data-gender="male"]');
    await page.tap('#authSubmit');
    await page.waitForSelector('#lockContinue', { timeout: 20000 });
    await page.tap('#lockContinue');
    await page.waitForSelector('#letterOk, #screen-menu:not(.hidden)');
    if (await page.$('#letterOk')) await page.tap('#letterOk');
    await page.waitForSelector('#screen-menu:not(.hidden)');
    await page.tap('#btnPlay', { force: true });
    await page.waitForSelector('#screen-grade:not(.hidden)');
    await page.waitForTimeout(500);
    await page.tap('[data-grade="7"]', { force: true });
    await page.waitForSelector('#hud:not(.hidden)', { timeout: 20000 });
    await page.waitForTimeout(800);

    const joy = await page.$eval('#joystick', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; });
    const pushJoy = async (dx, dy) => { await touch('touchStart', [{ x: joy.x, y: joy.y, id: 1 }]); await touch('touchMove', [{ x: joy.x + dx * joy.r, y: joy.y + dy * joy.r, id: 1 }]); };
    const releaseJoy = () => touch('touchEnd', []);

    // 1. eye height for a 5'9" student
    await tp(26, 16.5, 0);
    const eye = await page.evaluate(() => window.__SL.game.camera.position.y);
    check('eye height (male 5\'9")', Math.abs(eye - 1.753 * 0.936) < 0.05, eye.toFixed(2) + ' m');

    // 2. joystick walks forward (yaw 0 = north / -Z)
    let a = await state();
    await pushJoy(0, -1);
    await ff(1.5);
    let b = await state();
    await releaseJoy();
    await ff(0.3);
    check('joystick moves forward', a.z - b.z > 3, `dz=${(a.z - b.z).toFixed(2)}`);
    const knobBack = await page.$eval('.joy-knob', (e) => e.style.transform);
    check('joystick knob springs back', /translate\(0px, 0px\)/.test(knobBack), knobBack);

    // 3. drag on the screen to look around
    a = await state();
    await touch('touchStart', [{ x: 600, y: 200, id: 2 }]);
    for (let i = 1; i <= 5; i++) await touch('touchMove', [{ x: 600 - i * 30, y: 200, id: 2 }]);
    await touch('touchEnd', []);
    await ff(0.1);
    b = await state();
    check('drag to look turns the camera', Math.abs(b.yaw - a.yaw) > 0.3, `dyaw=${(b.yaw - a.yaw).toFixed(2)}`);

    // 4. joystick + look at the same time (multi-touch)
    a = await state();
    await touch('touchStart', [{ x: joy.x, y: joy.y, id: 1 }]);
    await touch('touchMove', [{ x: joy.x, y: joy.y - joy.r, id: 1 }]);
    await touch('touchStart', [{ x: joy.x, y: joy.y - joy.r, id: 1 }, { x: 600, y: 200, id: 2 }]);
    await touch('touchMove', [{ x: joy.x, y: joy.y - joy.r, id: 1 }, { x: 520, y: 200, id: 2 }]);
    await ff(1);
    await touch('touchEnd', []);
    b = await state();
    check('walk and look at the same time', Math.hypot(b.x - a.x, b.z - a.z) > 1.5 && Math.abs(b.yaw - a.yaw) > 0.1);

    // 5. walls stop you (corridor north wall / lockers)
    await tp(5, 0, 0);
    await pushJoy(0, -1);
    await ff(3);
    await releaseJoy();
    b = await state();
    check('lockers/walls block walking', b.z > -1.5, `z=${b.z.toFixed(2)}`);

    // 6. closed classroom door blocks, open door lets you in
    await tp(10.6, -0.6, 0);
    await pushJoy(0, -1);
    await ff(2);
    await releaseJoy();
    b = await state();
    check('closed door blocks', b.z > -2.0, `z=${b.z.toFixed(2)}`);
    await page.tap('#btnUse');
    await ff(1);
    await pushJoy(0, -1);
    await ff(2);
    await releaseJoy();
    b = await state();
    check('open door lets you in (Room 101)', b.zone === 'r101', b.zone);

    // 7. sit down with the Use button, stand back up
    await tp(8.7, -6.0, Math.PI / 2, -0.1);
    await ff(0.2);
    await page.evaluate(() => { const p = window.__SL.play; const s = p.freeSeatNear(4); p.lookAt(s.x, s.y, s.z); });
    await ff(0.2);
    const label = await page.$eval('#useLabel', (e) => e.textContent);
    await page.tap('#btnUse');
    await ff(1);
    b = await state();
    check('Use = sit down', b.seat, `label="${label}"`);
    const status = await page.$eval('#chipStatus', (e) => e.textContent);
    await page.tap('#btnUse');
    await ff(1);
    b = await state();
    check('Use again = stand up', !b.seat);
    console.log('       status while seated:', status);

    // 8. grand staircase to the 2nd floor
    await tp(21.2, 13.8, 0);
    await pushJoy(0, -1);
    await ff(4);
    await releaseJoy();
    b = await state();
    check('stairs lead to the 2nd floor', b.y > 3.9 && b.zone === 'floor2', `y=${b.y.toFixed(2)} zone=${b.zone}`);
    // construction barrier stops you
    await page.evaluate(() => { window.__SL.play.player.yaw = Math.PI / 2; });
    await tp(24, 0, Math.PI / 2, 0, 4.0);
    await pushJoy(0, -1);
    await ff(4);
    await releaseJoy();
    b = await state();
    check('2nd floor barrier blocks', b.x > 18.4 && b.y > 3.9, `x=${b.x.toFixed(2)}`);

    // 9. auditorium aisle slopes down toward the stage
    await tp(9.0, 3.2, Math.PI);
    await pushJoy(0, -1);
    await ff(3.2);
    await releaseJoy();
    b = await state();
    check('auditorium floor slopes down', b.y < -0.5 && b.zone === 'r102', `y=${b.y.toFixed(2)} z=${b.z.toFixed(2)}`);

    // 10. exits are locked
    await tp(1.2, 0, Math.PI / 2);
    await ff(0.2);
    const exitLabel = await page.$eval('#useLabel', (e) => e.textContent);
    await page.tap('#btnUse');
    await ff(0.3);
    const toast = await page.$$eval('.toast span', (els) => els.map((e) => e.textContent).join(' | '));
    check('exit doors are locked', /Locked/.test(exitLabel) && /can't leave school/.test(toast), exitLabel);
  } catch (e) {
    problems.push('[test] ' + e.message);
  }
  console.log(`\n${fails.length} failed checks, ${problems.length} console problems`);
  for (const p of problems.slice(0, 10)) console.log('  ', p);
  await browser.close();
  process.exit(fails.length || problems.length ? 1 : 0);
})();
