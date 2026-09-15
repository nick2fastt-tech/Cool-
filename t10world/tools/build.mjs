// T10 World - single-file builder.
// Bundles three.js and every source module into one self-contained HTML file
// that runs by double-clicking it (no server, no network).
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.argv[2] || '.');
const OUT = path.resolve(process.argv[3] || path.join(ROOT, '..', 't10world.html'));

const read = (p) => fs.readFileSync(p, 'utf8');

// ---------------------------------------------------------------------------
// 1. three.js -> an isolated IIFE returning its export table
// ---------------------------------------------------------------------------
function wrapThree(src) {
  // The module ends with one big `export { A, B as C, ... };`
  const re = /export\s*\{([\s\S]*?)\}\s*;?\s*$/;
  const m = src.match(re);
  if (!m) throw new Error('three.module.js: could not find the trailing export block');
  const names = m[1].split(',').map((s) => s.trim()).filter(Boolean).map((entry) => {
    const asMatch = entry.match(/^(\S+)\s+as\s+(\S+)$/);
    if (asMatch) return `${asMatch[2]}: ${asMatch[1]}`;
    return `${entry}: ${entry}`;
  });
  const body = src.slice(0, m.index);
  return 'const __THREE = (function(){\n' + body + '\nreturn {' + names.join(',') + '};\n})();\n';
}

// ---------------------------------------------------------------------------
// 2. Collect source modules
// ---------------------------------------------------------------------------
function walk(dir, out) {
  out = out || [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

const srcDir = path.join(ROOT, 'src');
const files = walk(srcDir);
const modules = new Map();   // id -> { id, file, src, deps:[], exports:[] }

const idOf = (file) => path.relative(srcDir, file).replace(/\\/g, '/').replace(/\.js$/, '');

const IMPORT_RE = /^[ \t]*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?[ \t]*$/gm;

for (const file of files) {
  const raw = read(file);
  const id = idOf(file);
  const deps = [];
  let body = raw.replace(IMPORT_RE, (full, clause, spec) => {
    clause = clause.trim();
    if (spec.includes('three.module.js')) {
      const ns = clause.match(/^\*\s+as\s+(\w+)$/);
      return ns ? `const ${ns[1]} = __THREE;` : `const ${clause.replace(/[{}]/g, '').trim()} = __THREE;`;
    }
    const resolved = idOf(path.resolve(path.dirname(file), spec));
    deps.push(resolved);
    const ns = clause.match(/^\*\s+as\s+(\w+)$/);
    if (ns) return `const ${ns[1]} = __M[${JSON.stringify(resolved)}];`;
    // Named imports; rewrite `a as b` to `a: b` for destructuring.
    const inner = clause.replace(/^\{|\}$/g, '').trim();
    const parts = inner.split(',').map((s) => s.trim()).filter(Boolean).map((e) => {
      const as = e.match(/^(\S+)\s+as\s+(\S+)$/);
      return as ? `${as[1]}: ${as[2]}` : e;
    });
    return `const { ${parts.join(', ')} } = __M[${JSON.stringify(resolved)}];`;
  });

  // Exports -> plain declarations, names collected for the return table.
  const exportNames = new Set();
  body = body.replace(/^[ \t]*export\s+(async\s+)?function\s+(\w+)/gm, (f, a, n) => { exportNames.add(n); return (a ? 'async ' : '') + 'function ' + n; });
  body = body.replace(/^[ \t]*export\s+class\s+(\w+)/gm, (f, n) => { exportNames.add(n); return 'class ' + n; });
  body = body.replace(/^[ \t]*export\s+(const|let|var)\s+(\w+)/gm, (f, k, n) => { exportNames.add(n); return k + ' ' + n; });
  body = body.replace(/^[ \t]*export\s*\{([^}]*)\}\s*;?[ \t]*$/gm, (f, inner) => {
    for (const e of inner.split(',').map((s) => s.trim()).filter(Boolean)) {
      const as = e.match(/^(\S+)\s+as\s+(\S+)$/);
      exportNames.add(as ? as[2] : e);
    }
    return '';
  });
  if (/^\s*export\s+default/m.test(body)) throw new Error('default export not supported: ' + id);
  if (/\bexport\b/.test(body.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))) {
    const leftover = body.split('\n').filter((l) => /^\s*export\b/.test(l));
    if (leftover.length) throw new Error('unhandled export in ' + id + ': ' + leftover[0]);
  }

  modules.set(id, { id, file, body, deps, exports: [...exportNames] });
}

// ---------------------------------------------------------------------------
// 3. Topological sort (cycles are tolerated: registries reference each other)
// ---------------------------------------------------------------------------
const order = [];
const state = new Map();
function visit(id, stack) {
  const st = state.get(id);
  if (st === 'done') return;
  if (st === 'visiting') return;    // cycle — the later module patches itself in
  state.set(id, 'visiting');
  const mod = modules.get(id);
  if (!mod) throw new Error('missing module: ' + id + ' (from ' + stack.join(' -> ') + ')');
  for (const d of mod.deps) visit(d, stack.concat(id));
  state.set(id, 'done');
  order.push(id);
}
for (const id of modules.keys()) visit(id, []);

// ---------------------------------------------------------------------------
// 4. Emit
// ---------------------------------------------------------------------------
const three = wrapThree(read(path.join(ROOT, 'vendor', 'three.module.js')));
const chunks = [
  '(function(){\n"use strict";\n',
  three,
  'const __M = {};\n',
];
for (const id of order) {
  const m = modules.get(id);
  chunks.push(
    '__M[' + JSON.stringify(id) + '] = (function(){\n' +
    m.body +
    '\nreturn { ' + m.exports.join(', ') + ' };\n})();\n'
  );
}
chunks.push('__M["main"].boot();\n})();\n');
// Any literal </script> inside a string would close the tag early.
const bundle = chunks.join('\n').split('</script>').join('<\\/script>');

// Inline into the HTML shell.
const html = read(path.join(ROOT, 'index.html'));
// A replacement *function* is essential here: the bundle contains "$'" and
// other $-patterns that String.replace would otherwise interpret.
const out = html.replace(
  /<script type="module">[\s\S]*?<\/script>/,
  () => '<script>\n' + bundle + '\n</script>'
);
if (out === html) throw new Error('could not find the module script tag in index.html');

fs.writeFileSync(OUT, out);
const kb = (Buffer.byteLength(out) / 1024).toFixed(0);
console.log('modules bundled : ' + modules.size);
console.log('load order      : ' + order.length);
console.log('output          : ' + OUT);
console.log('size            : ' + kb + ' KB');
