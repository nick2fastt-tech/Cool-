// T10 World - registry check. Counts the commands, finds duplicate ids and
// duplicate phrases (a duplicate phrase means one of the two is unreachable),
// and verifies that every example command in the feature library is real.
//
//   node tools/check-commands.mjs
//
// Runs in plain node: the browser globals the modules touch at import time are
// stubbed below, so this needs no browser and takes under a second.
const ctx2d = new Proxy({}, { get: (t, k) => (k === 'canvas' ? {} : () => ({ addColorStop() {} })) });
global.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, devicePixelRatio: 1 };
Object.defineProperty(global, 'navigator', { value: { maxTouchPoints: 0, userAgent: 'node' }, configurable: true });
global.screen = { width: 1280, height: 720 };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.document = {
  createElement: () => ({ getContext: () => ctx2d, width: 0, height: 0, style: {}, appendChild() {}, addEventListener() {}, classList: { toggle() {}, add() {} } }),
  addEventListener() {},
};

const here = new URL('.', import.meta.url).pathname;
const src = here + '../src/';
const { buildRegistry } = await import(src + 't10/commands.js');
const { T10Brain } = await import(src + 't10/brain.js');
const { FEATURES, featureStats, CATEGORIES } = await import(src + 't10/features.js');
const { POWERS } = await import(src + 'player/powers.js');
const { settings, QUALITY_PRESETS, QUALITY_ORDER } = await import(src + 'core/settings.js');
const { detectDevice, effectivePresets, FIELD_GROUP } = await import(src + 'core/device.js');

const R = buildRegistry();
let problems = 0;

console.log('commands   :', R.count(), 'across', R.categoryNames().length, 'categories');
for (const c of R.categoryNames()) console.log('   ' + c.padEnd(13) + R.inCategory(c).length);

// Duplicate ids: the registry renames the second one, which is a quiet way to
// end up with a command nothing can refer to by name.
const renamed = R.renamed || [];
if (renamed.length) {
  problems += renamed.length;
  console.log('\nduplicate ids (the second was renamed):');
  for (const c of renamed) console.log('   ' + c.id + '  (' + c.from + ' vs ' + c.to + ')');
}

// Duplicate first phrases: whichever loses the scoring is unreachable.
const seen = new Map();
const dupPhrases = [];
for (const c of R.commands) {
  const k = c.patterns[0];
  if (seen.has(k)) dupPhrases.push([k, seen.get(k), c.id]);
  else seen.set(k, c.id);
}
if (dupPhrases.length) {
  problems += dupPhrases.length;
  console.log('\nduplicate phrases (one of each pair is unreachable):');
  for (const [k, a, b] of dupPhrases) console.log('   ' + JSON.stringify(k) + '  ' + a + ' vs ' + b);
}

// Power keys must not collide with each other or with a key binding: the
// binding is checked first at runtime, so a clash means a power that can never
// be pressed.
const bound = settings.get('keyBindings');
const boundBy = {};
for (const action in bound) boundBy[bound[action]] = action;
const powerKeys = new Set();
const keyClashes = [];
for (const p of POWERS) {
  if (powerKeys.has(p.key)) keyClashes.push(p.name + ' shares ' + p.key + ' with another power');
  powerKeys.add(p.key);
  if (boundBy[p.key]) keyClashes.push(p.name + ' is on ' + p.key + ', which is already "' + boundBy[p.key] + '"');
}
console.log('\npowers    :', POWERS.length, 'with', powerKeys.size, 'distinct keys');
if (keyClashes.length) {
  problems += keyClashes.length;
  for (const k of keyClashes) console.log('   KEY CLASH: ' + k);
}

// The three presets must stay in order on every device class, and none of them
// may ask for more than the preset as written. A preset that quietly inverts on
// a phone is the kind of bug nobody reports and everybody feels.
const DEVICES = [
  ['phone', { tier: 'phone', power: 0.3, dpr: 3, maxTexture: 4096 }],
  ['good phone', { tier: 'phone', power: 1, dpr: 3, maxTexture: 4096 }],
  ['tablet', { tier: 'tablet', power: 0.6, dpr: 2, maxTexture: 4096 }],
  ['laptop', { tier: 'laptop', power: 0.5, dpr: 2, maxTexture: 8192 }],
  ['desktop', { tier: 'desktop', power: 1, dpr: 1, maxTexture: 16384 }],
];
const presetProblems = [];
for (const [label, dev] of DEVICES) {
  const all = effectivePresets(QUALITY_PRESETS, dev, QUALITY_ORDER);
  for (let i = 0; i < QUALITY_ORDER.length; i++) {
    const q = QUALITY_ORDER[i];
    for (const key in FIELD_GROUP) {
      const written = QUALITY_PRESETS[q][key];
      if (typeof written !== 'number') continue;
      if (all[q][key] > written + 1e-6) presetProblems.push(label + ': ' + q + '.' + key + ' is above the written preset');
      if (i > 0) {
        const prev = all[QUALITY_ORDER[i - 1]][key];
        if (all[q][key] < prev - 1e-6) presetProblems.push(label + ': ' + q + '.' + key + ' (' + all[q][key] + ') is below ' + QUALITY_ORDER[i - 1] + ' (' + prev + ')');
      }
    }
  }
  const u = all.ultra;
  // ULTRA keeps every effect on, whatever the device. That is what makes it ULTRA.
  for (const effect of ['ssr', 'ssao', 'bloom', 'shadows', 'contactShadows', 'puddles', 'reflectionProbe', 'volumetricLight']) {
    if (QUALITY_PRESETS.ultra[effect] && !u[effect]) presetProblems.push(label + ': ULTRA lost ' + effect);
  }
}
console.log('\npresets   :', DEVICES.length, 'device classes checked,', presetProblems.length, 'problems');
if (presetProblems.length) {
  problems += presetProblems.length;
  for (const p of presetProblems.slice(0, 12)) console.log('   ' + p);
}

// Every example in the feature library must resolve to a command.
const brain = Object.create(T10Brain.prototype);
brain.registry = R;
brain.pending = null;
const unmatched = [];
let checked = 0;
for (const f of FEATURES) {
  if (!f.say) continue;
  checked++;
  const m = brain.match(f.say.replace(/^T10\s+/i, ''));
  if (!m || !m.command) unmatched.push(f.say + '  (' + f.title + ')');
}
const stats = featureStats();
console.log('\nfeatures   :', stats.total, 'across', CATEGORIES.length, 'areas —',
  stats.live, 'live,', stats.partial, 'partial,', stats.planned, 'planned');
console.log('examples   :', checked, 'checked,', unmatched.length, 'unmatched');
if (unmatched.length) {
  problems += unmatched.length;
  for (const u of unmatched) console.log('   NO MATCH: ' + u);
}

console.log('\n' + (problems ? 'FAIL (' + problems + ' problems)' : 'PASS'));
process.exit(problems ? 1 : 0);
