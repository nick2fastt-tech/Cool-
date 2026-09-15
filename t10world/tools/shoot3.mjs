import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = path.resolve('.');
const TYPES = { '.html':'text/html','.js':'text/javascript' };
const server = http.createServer((req,res)=>{const u=decodeURIComponent(req.url.split('?')[0]);fs.readFile(path.join(ROOT,u),(e,d)=>{if(e){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':TYPES[path.extname(u)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>server.listen(0,r)); const port=server.address().port;
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport:{width:1280,height:760} });
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
await page.goto(`http://127.0.0.1:${port}${process.argv[2]}`,{waitUntil:'load'});
await page.waitForFunction(()=>window.__results&&window.__results.done,{timeout:300000});
const r=await page.evaluate(()=>window.__results);
for(const l of r.logs) console.log(l);
for(const e of r.errors) console.log('ERR',e);
for(const spec of process.argv.slice(3)){
  const [args,out]=spec.split('=');
  const parts=args.split(',');
  if(parts[0]!=='none') await page.evaluate((p)=>{ window.__view.apply(null, p.map((v,i)=> i===0? v : (v==='true'?true:v==='false'?false:parseFloat(v)))); }, parts);
  await page.locator('#c').screenshot({path:out});
  console.log('shot',out);
}
await browser.close(); server.close();
