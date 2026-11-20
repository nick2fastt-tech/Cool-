// Renders the app icon from HTML (uses the game's fonts) into public/icons.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
const root = path.resolve(__dirname, '..');
const font = (p) => 'file://' + path.join(root, 'node_modules/@fontsource', p);
const html = `<!doctype html><html><head><style>
@font-face { font-family: 'Luckiest Guy'; src: url('${font('luckiest-guy/files/luckiest-guy-latin-400-normal.woff2')}'); }
html,body{margin:0;width:512px;height:512px;background:transparent}
.i{position:absolute;inset:0;border-radius:112px;background:radial-gradient(circle at 30% 25%,#ffe27a,#ffc72c 45%,#f2a900);
  box-shadow: inset 0 0 0 18px #1b1f3b; overflow:hidden}
.board{position:absolute;left:58px;right:58px;top:70px;height:250px;border-radius:26px;background:#2f5d46;box-shadow: inset 0 0 0 14px #9a6a3a, 0 10px 0 #1b1f3b}
.t{position:absolute;left:0;right:0;top:118px;text-align:center;font-family:'Luckiest Guy';font-size:150px;line-height:1;color:#fff;
  -webkit-text-stroke:10px #1b1f3b;paint-order:stroke fill;text-shadow:0 10px 0 #1b1f3b}
.s{position:absolute;left:0;right:0;bottom:58px;text-align:center;font-family:'Luckiest Guy';font-size:66px;color:#1b1f3b;letter-spacing:3px}
.pencil{position:absolute;right:70px;top:270px;width:190px;height:34px;transform:rotate(-30deg);border-radius:6px;
  background:linear-gradient(90deg,#f28b9b 0 18%,#cbd5e1 18% 28%,#ffc72c 28% 82%,#f2cf9a 82% 94%,#374151 94%);box-shadow:0 0 0 6px #1b1f3b}
</style></head><body><div class="i"><div class="board"></div><div class="t">SL</div><div class="pencil"></div><div class="s">SCHOOL LIFE</div></div></body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 512, height: 512 } });
  const tmp = path.join(require('os').tmpdir(), 'sl-icon.html');
  require('fs').writeFileSync(tmp, html);
  await p.goto('file://' + tmp);
  await p.evaluate(() => document.fonts.load("150px 'Luckiest Guy'", 'SL'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(200);
  for (const size of [512, 192, 180]) {
    await p.setViewportSize({ width: 512, height: 512 });
    const buf = await p.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } });
    const out = path.join(root, 'public/icons', `icon-${size}.png`);
    if (size === 512) require('fs').writeFileSync(out, buf);
    else {
      const p2 = await b.newPage({ viewport: { width: size, height: size } });
      await p2.setContent(`<html><body style="margin:0"><img src="data:image/png;base64,${buf.toString('base64')}" style="width:${size}px;height:${size}px"></body></html>`);
      await p2.waitForTimeout(100);
      require('fs').writeFileSync(out, await p2.screenshot({ omitBackground: true }));
      await p2.close();
    }
  }
  await b.close();
  console.log('icons done');
})();
