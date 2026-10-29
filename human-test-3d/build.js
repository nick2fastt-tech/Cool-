#!/usr/bin/env node
// Builds Human Test 3D into ONE self-contained HTML file (three.js r159 inlined).
// Usage: node build.js [--dev]
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const three = fs.readFileSync(path.join(ROOT, 'vendor', 'three.min.js'), 'utf8');
const files = fs.readdirSync(SRC).filter(f => /^\d\d_.*\.js$/.test(f)).sort();
let game = '';
for (const f of files) {
  const src = fs.readFileSync(path.join(SRC, f), 'utf8');
  game += `\n// ===== ${f} =====\n` + src;
}
if (/<\/script/i.test(game)) throw new Error('Game source contains a closing script tag');
try { new Function(game); } catch (e) { console.error('SYNTAX ERROR in game sources:', e.message); process.exit(1); }

function inline(templateFile, outFile, extra = '') {
  const tpl = fs.readFileSync(templateFile, 'utf8');
  const out = tpl
    .replace('<!--THREE-->', () => '<script>/* three.js r159 (MIT License, Copyright 2010-2023 Three.js Authors) */\n' + three + '\n</script>')
    .replace('<!--GAME-->', () => '<script>\n(function () {\n' + game + '\n' + extra + '\n})();\n</script>');
  fs.writeFileSync(outFile, out);
  const kb = (fs.statSync(outFile).size / 1024).toFixed(0);
  console.log(`built ${path.relative(process.cwd(), outFile)} (${kb} KB, ${files.length} modules)`);
}

const dev = process.argv.includes('--dev');
if (dev) {
  const devScript = fs.readFileSync(path.join(ROOT, 'dev', 'preview.js'), 'utf8');
  inline(path.join(ROOT, 'dev', 'preview.html'), path.join(ROOT, 'dev', 'preview.build.html'), devScript);
} else {
  inline(path.join(ROOT, 'src', 'template.html'), path.join(ROOT, '..', 'HumanTest3D.html'));
}
