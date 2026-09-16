// T10 World - the assistant's language layer.
// Every instruction must start with the wake word. What follows is normalised,
// scored against the command registry and executed against the live world.
import * as THREE from '../../vendor/three.module.js';
import { buildRegistry } from './commands.js';
import { clamp01, clampv, lerpv, TAU, makeRng } from '../core/math.js';
import { DISTRICTS, CITY_RADIUS } from '../world/city.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/settings.js';

const WAKE_WORDS = ['t10', 't-10', 't 10', 'tten', 'tee ten', 'ten', 't10,'];

const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
  fifty: 50, hundred: 100, thousand: 1000, million: 1000000, billion: 1000000000,
};

const COLOR_WORDS = {
  red: 0xc0392b, blue: 0x2f5aa0, green: 0x3f7a52, yellow: 0xf0c040, orange: 0xe8621f,
  purple: 0x6c3d7a, pink: 0xd9548a, black: 0x1a1b1d, white: 0xe8e6e0, grey: 0x7a8085,
  gray: 0x7a8085, silver: 0xc2c6cb, gold: 0xd8a020, brown: 0x6d4326, teal: 0x1f6a6a,
  navy: 0x1b2a4a, cyan: 0x3ba9a0, lime: 0x7ac043, maroon: 0x6a2020, beige: 0xd8cdbc,
};

// Words that carry no meaning for matching — dropped before scoring.
const STOP_WORDS = new Set(['the', 'a', 'an', 'please', 'can', 'you', 'could', 'would',
  'to', 'for', 'me', 'my', 'i', 'of', 'is', 'it', 'and', 'now', 'just', 'some', 'do',
  'will', 'this', 'that', 'be', 'am', 'are', 'right', 'about', 'like', 'want', 'wanna']);

export { singular };

export function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\w\s:.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Crude singulariser so "spawn 3 benches" matches "spawn a bench". */
function singular(word) {
  if (word.length < 4) return word;
  if (/(ss|us|is)$/.test(word)) return word;
  if (/ies$/.test(word)) return word.slice(0, -3) + 'y';
  if (/(ch|sh|x|s|z)es$/.test(word)) return word.slice(0, -2);
  if (/s$/.test(word)) return word.slice(0, -1);
  return word;
}

/**
 * Tokens used for scoring: numbers dropped, plurals folded to singular.
 * Keeps "give me 5 dogs" and "give me a dog" on the same footing.
 */
function matchTokens(text) {
  return text.split(/\s+/)
    .filter((t) => t && !/^\d+$/.test(t))
    .map(singular);
}

/** Strip the wake word. Returns null when the user didn't address T10. */
export function stripWakeWord(text) {
  const n = normalise(text);
  for (const w of WAKE_WORDS) {
    if (n === w) return '';
    if (n.startsWith(w + ' ')) return n.slice(w.length + 1).trim();
  }
  // Also accept it mid-sentence: "hey t10, make it rain".
  const m = n.match(/\bt\s?-?\s?10\b[, ]*/);
  if (m) return n.slice(m.index + m[0].length).trim();
  return null;
}

function extractNumber(text) {
  const digits = text.match(/\b(\d[\d,]*)\b/);
  if (digits) {
    const v = parseInt(digits[1].replace(/,/g, ''), 10);
    if (!isNaN(v)) {
      // "5 million" style multipliers.
      const after = text.slice(digits.index + digits[0].length).trim().split(/\s+/)[0];
      if (after === 'million') return v * 1000000;
      if (after === 'billion') return v * 1000000000;
      if (after === 'thousand' || after === 'k') return v * 1000;
      return v;
    }
  }
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const base = NUMBER_WORDS[words[i]];
    if (base == null) continue;
    const next = NUMBER_WORDS[words[i + 1]];
    if (next && next >= 100) return base * next;
    if (base > 1) return base;
  }
  return null;
}

function extractColor(text) {
  for (const w of text.split(/\s+/)) if (COLOR_WORDS[w] != null) return COLOR_WORDS[w];
  return null;
}

/** Score how well a phrase matches a command pattern. */
function scorePattern(inputTokens, inputText, patternTokens, patternText) {
  if (inputText === patternText) return 1000;
  if (inputText.includes(patternText)) return 600 + patternText.length * 2;
  if (patternText.includes(inputText) && inputText.length > 4) return 380 + inputText.length;

  // Token overlap, weighted so rarer/longer words matter more.
  let hits = 0, weight = 0, patWeight = 0;
  const inputSet = new Set(inputTokens);
  for (const t of patternTokens) {
    const w = STOP_WORDS.has(t) ? 0.25 : Math.min(3, 1 + t.length * 0.12);
    patWeight += w;
    if (inputSet.has(t)) { hits++; weight += w; }
  }
  if (!hits) return 0;
  const coverage = weight / Math.max(0.001, patWeight);
  const precision = hits / Math.max(1, inputTokens.length);
  // Require most of the pattern to be present, otherwise "spawn a dog" would
  // match "spawn a dog house" style near-misses equally well.
  if (coverage < 0.55) return 0;
  return coverage * 260 + precision * 120 + hits * 6;
}

export class T10Brain {
  constructor(game) {
    this.game = game;
    this.registry = buildRegistry();
    this.history = [];
    this.markers = [];
    this.lastVehicle = null;
    this.visionMode = 'off';
    this.forceStreetLights = null;
    this.trafficLightOverride = null;
    this.overrideDrawDistance = null;
    this.showStats = false;
    this.gravityScale = 1;
    this.unknownStreak = 0;
    // When T10 asks you something, the next thing you say answers it — no
    // wake word needed, because you're already in the conversation.
    this.pending = null;
  }

  /**
   * Ask a follow-up question.
   * @param prompt what T10 says
   * @param choices [{ words:[...], run(ctx) }] — first match wins
   */
  ask(prompt, choices) {
    this.pending = { prompt, choices, asked: Date.now() };
    return prompt;
  }

  /** Try to read `text` as the answer to the outstanding question. */
  answerPending(text) {
    const p = this.pending;
    if (!p) return null;
    const n = normalise(text);
    if (!n) return null;
    if (/^(never ?mind|forget it|cancel|nothing|no|stop)$/.test(n)) {
      this.pending = null;
      return 'Forget it then.';
    }
    const tokens = new Set(matchTokens(n));
    let best = null, bestScore = 0;
    for (const c of p.choices) {
      let score = 0;
      for (const w of c.words) {
        if (n === w) score = Math.max(score, 100);
        else if (n.includes(w)) score = Math.max(score, 60 + w.length);
        else if (tokens.has(singular(w))) score = Math.max(score, 40);
      }
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (!best || bestScore < 30) return null;
    this.pending = null;
    try {
      return best.run(this.ctx) || 'Done.';
    } catch (err) {
      console.error('[T10] answer failed', err);
      return 'Something went wrong with that one.';
    }
  }

  get ctx() {
    const g = this.game;
    const self = this;
    return {
      game: g,
      player: g.player,
      world: g.world,
      npcs: g.npcs,
      traffic: g.traffic,
      animals: g.animals,
      apocalypse: g.apocalypse,
      atmosphere: g.atmosphere,
      scene: g.scene,
      post: g.post,
      registry: this.registry,
      markers: this.markers,
      ask: (prompt, choices) => self.ask(prompt, choices),
      get lastVehicle() { return self.lastVehicle; },
      set lastVehicle(v) { self.lastVehicle = v; },
      get trafficLightOverride() { return self.trafficLightOverride; },
      set trafficLightOverride(v) { self.trafficLightOverride = v; },
      get forceStreetLights() { return self.forceStreetLights; },
      set forceStreetLights(v) { self.forceStreetLights = v; },
      get overrideDrawDistance() { return self.overrideDrawDistance; },
      set overrideDrawDistance(v) { self.overrideDrawDistance = v; },
      get showStats() { return self.showStats; },
      set showStats(v) { self.showStats = v; g.setStatsVisible(v); },
      /** A clear spot in front of the player to place things. */
      spotInFront: (dist, lateral) => {
        const p = g.player.position;
        const h = g.player.cameraMode === 'first' ? g.player.yaw : g.player.heading;
        const fx = Math.sin(h), fz = Math.cos(h);
        const rx = -Math.cos(h), rz = Math.sin(h);
        return {
          x: p.x + fx * (dist || 3) + rx * (lateral || 0),
          z: p.z + fz * (dist || 3) + rz * (lateral || 0),
        };
      },
      findDistrict: (key) => {
        // Sample the map for a point in the requested district. Snapping to a
        // sidewalk can walk you out of a small district, so only take the
        // snapped point when it's still in the district you asked for.
        for (let i = 0; i < 900; i++) {
          const a = (i * 2.399963) % TAU;
          const r = (i / 900) * 1100;
          const x = Math.cos(a) * r, z = Math.sin(a) * r;
          if (g.world.city.districtAt(x, z) !== key) continue;
          const sw = g.world.city.nearestSidewalk(x, z);
          if (sw && g.world.city.districtAt(sw.x, sw.z) === key && !g.world.isWater(sw.x, sw.z)) return sw;
          if (!g.world.isWater(x, z)) return { x, z };
        }
        return null;
      },
      setVisionMode: (m) => { self.visionMode = m; g.setVisionMode(m); },
      setGravity: (s) => { self.gravityScale = s; g.setGravity(s); },
      setShadows: (on) => g.setShadows(on),
      applyQuality: () => g.applyQuality(),
      save: () => g.save(),
      load: () => g.load(),
      pop: () => audio.spawnPop(),
    };
  }

  /**
   * Handle a line of input.
   * @returns { ok, reply, command } — ok:false when the wake word is missing.
   */
  handle(raw) {
    // An outstanding question gets first refusal on whatever you say next,
    // with or without the wake word.
    if (this.pending) {
      const stripped = stripWakeWord(raw);
      const answered = this.answerPending(stripped === null ? raw : stripped);
      if (answered != null) {
        this.history.push({ input: raw, command: 'answer', reply: answered });
        return { ok: true, reply: answered, answered: true };
      }
    }

    const after = stripWakeWord(raw);
    if (after === null) {
      return {
        ok: false,
        reply: 'Say my name first. Start with "T10" — like "T10 make it rain".',
      };
    }
    // Just the wake word on its own: show the whole book.
    if (!after) {
      if (this.game.book) this.game.book.show('');
      return {
        ok: true,
        reply: 'Everything I know — ' + this.registry.count() + ' commands, ' +
          this.registry.categoryNames().length + ' areas. Filter it, or tap a line to run it.',
      };
    }

    const result = this.match(after);
    if (!result) {
      this.unknownStreak++;
      const hint = this.suggest(after);
      const base = 'I don\'t have anything for "' + after + '".';
      return {
        ok: true,
        unknown: true,
        reply: hint ? base + ' Did you mean "' + hint + '"?'
          : base + ' Ask me "T10 what can you do" for a tour.',
      };
    }
    this.unknownStreak = 0;

    let reply;
    try {
      reply = result.command.run(this.ctx, result.match);
    } catch (err) {
      console.error('[T10] command failed', result.command.id, err);
      reply = 'Something went wrong running that. Try again?';
    }
    this.history.push({ input: raw, command: result.command.id, reply });
    if (this.history.length > 200) this.history.shift();
    return { ok: true, reply: reply || 'Done.', command: result.command };
  }

  match(text) {
    const inputText = normalise(text);
    const inputTokens = matchTokens(inputText);
    const number = extractNumber(inputText);
    const color = extractColor(inputText);

    let best = null, bestScore = 120;   // threshold: below this we admit we don't know
    for (const cmd of this.registry.commands) {
      let score = 0;
      for (let i = 0; i < cmd.patterns.length; i++) {
        const s = scorePattern(inputTokens, inputText, cmd.matchTokens[i], cmd.patterns[i]);
        if (s > score) score = s;
      }
      if (cmd.priority) score += cmd.priority * 40;
      if (score > bestScore) { bestScore = score; best = cmd; }
    }
    if (!best) return null;

    // Everything after the matched phrase, for commands that take free text.
    let rest = '';
    if (best.capturesRest) {
      for (const p of best.patterns) {
        const i = inputText.indexOf(p);
        if (i >= 0) { rest = inputText.slice(i + p.length).trim(); break; }
      }
      if (!rest) {
        const firstTokens = new Set(best.tokens[0]);
        rest = inputTokens.filter((t) => !firstTokens.has(t)).join(' ');
      }
    }
    return { command: best, score: bestScore, match: { text: inputText, tokens: inputTokens, number, color, rest } };
  }

  /** Closest command phrase, for "did you mean". */
  suggest(text) {
    const inputText = normalise(text);
    const inputTokens = matchTokens(inputText);
    let best = null, bestScore = 20;
    for (const cmd of this.registry.commands) {
      for (let i = 0; i < cmd.patterns.length; i++) {
        const s = scorePattern(inputTokens, inputText, cmd.matchTokens[i], cmd.patterns[i]);
        if (s > bestScore) { bestScore = s; best = cmd.patterns[i]; }
      }
    }
    return best;
  }

  /** Per-frame hooks for the overrides T10 commands can set. */
  update(dt) {
    const g = this.game;
    if (this.trafficLightOverride) {
      for (const node of g.world.city.nodes) {
        if (!node.signal) continue;
        node.amber = false;
        node.nsGreen = this.trafficLightOverride === 'green' ? true : false;
        if (this.trafficLightOverride === 'red') { node.nsGreen = false; node.amber = false; }
      }
    }
    if (this.forceStreetLights != null) {
      g.world.nightFactor = this.forceStreetLights;
    }
  }

  commandCount() { return this.registry.count(); }
}
