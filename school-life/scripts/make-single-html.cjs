// Packs the game into ONE standalone HTML file (code, styles, fonts, icon and music inlined).
// Usage: npm run build:html   ->   release/School-Life-V1.00.html
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist-single');
const outDir = path.join(root, 'release');
const outFile = path.join(outDir, 'School-Life-V1.00.html');

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const b64 = (file) => fs.readFileSync(file).toString('base64');

// CSS with the fonts inlined (woff2 only)
const cssHref = /<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/.exec(html);
let css = fs.readFileSync(path.join(dist, cssHref[1]), 'utf8');
css = css.replace(/src:\s*url\(([^)]+\.woff2)\)\s*format\("woff2"\)\s*,\s*url\([^)]+\.woff\)\s*format\("woff"\)/g, (m, u) => {
  const f = path.join(dist, 'assets', path.basename(u.replace(/["']/g, '')));
  return `src:url(data:font/woff2;base64,${b64(f)}) format("woff2")`;
});
if (/url\((?!data:)[^)]*\.(woff2?|png|jpg|svg)\)/.test(css)) throw new Error('CSS still points at a file');

// JS bundle (one file in single mode)
const jsSrc = /<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/.exec(html);
let js = fs.readFileSync(path.join(dist, jsSrc[1]), 'utf8');
js = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

const icon = 'data:image/png;base64,' + b64(path.join(root, 'public/icons/icon-192.png'));
const music = b64(path.join(root, 'public/audio/theme.mp3'));

let page = html
  .replace(cssHref[0], () => `<style>\n${css}\n</style>`)
  .replace(jsSrc[0], () => '')
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="image/png" href="${icon}" />`)
  .replace(/<link rel="apple-touch-icon"[^>]*>/, `<link rel="apple-touch-icon" href="${icon}" />`)
  .replace(/<link rel="modulepreload"[^>]*>\s*/g, '');
page = page.replace('</body>', () => `  <script>window.SL_THEME_DATA = "${music}";</script>\n    <script type="module">\n${js}\n</script>\n  </body>`);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, page);
console.log(`${path.relative(root, outFile)}  ${(page.length / 1024 / 1024).toFixed(2)} MB`);
