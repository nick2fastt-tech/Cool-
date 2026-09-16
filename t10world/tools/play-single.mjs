import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
const FILE = path.resolve(process.argv[2]);
const server = http.createServer((req,res)=>{ res.writeHead(200,{'Content-Type':'text/html'}); res.end(fs.readFileSync(FILE)); });
await new Promise(r=>server.listen(0,r)); const port=server.address().port;
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport:{width:1280,height:760} });
const errors=[];
page.on('pageerror', e=>{ errors.push(e.message); console.log('>>> '+ (e.stack||e.message).slice(0,600)); });
page.on('console', m=>{ if(m.type()==='error'&&!/favicon/.test(m.text())) { errors.push(m.text()); console.log('>>> CONSOLE '+m.text().slice(0,300)); }});
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'load' });
await page.waitForTimeout(1500);
console.log('splash ok:', await page.evaluate(()=>!!document.getElementById('t10-start')));
await page.click('#t10-start');
await page.waitForTimeout(2500);
console.log('phase:', await page.evaluate(()=>window.__t10 && window.__t10.phase));
await page.evaluate(()=>{ const b=[...document.querySelectorAll('.t10-creator-btn')].find(x=>x.classList.contains('primary')); b.click(); });
try { await page.waitForFunction(()=>window.__t10 && window.__t10.phase==='playing', { timeout: 180000 }); } catch(e){ console.log('TIMEOUT'); }
await page.waitForTimeout(6000);
const info = await page.evaluate(()=>{
  const g=window.__t10; if(!g||!g.t10) return {phase:g&&g.phase};
  const tests = ['T10 how many commands do you have','T10 take me to the beach','T10 what is the t10 tower',
    'T10 spawn 3 benches','T10 make it sunset','T10 where is the nearest hospital','T10 show me the map',
    'T10 close the map','T10 make it snow','T10 this is my home','T10 take me home','T10 show all commands','T10',
    'T10 start a zombie apocalypse','T10 how bad is it','T10 i never want to die','T10 stop the apocalypse'];
  const replies = tests.map(t=>{ const r=g.t10.handle(t); return t+' -> '+r.reply.slice(0,90); });
  const askQ = g.t10.handle('T10 start an apocalypse');
  const askA = g.t10.handle('meteor');
  replies.push('ask flow -> ' + (g.t10.pending===null ? 'answered ' : 'PENDING ') + g.apocalypse.kind);
  g.t10.handle('T10 stop the apocalypse');
  const ui = { book: !!(g.book && g.book.visible), map: !!(g.map && g.map.visible), view: g.player.cameraMode,
    immortal: g.player.immortal, apocalypse: g.apocalypse.kind };
  if (g.book) g.book.hide();
  return { phase:g.phase, commands:g.t10.commandCount(), npcs:g.npcs.count(), cars:g.traffic.count(), ui, replies };
});
console.log(JSON.stringify(info,null,1));
await page.waitForTimeout(2500);
await page.screenshot({ path: process.env.SHOT || '/tmp/single.png' });
console.log(errors.length ? 'RESULT: FAIL' : 'RESULT: PASS');
await browser.close(); server.close(); process.exit(errors.length?1:0);
