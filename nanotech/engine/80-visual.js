/* ==========================================================================
   Scene understanding and colour. Reads a prompt into a SceneSpec that the
   renderers draw from. Same prompt always gives the same scene.
   ========================================================================== */

/* ---------- colour maths ------------------------------------------------- */
function hex2rgb(h){
  h = String(h).replace("#", "");
  if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
  var n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb2hex(r, g, b){
  function c(x){ x = Math.max(0, Math.min(255, Math.round(x))); return (x < 16 ? "0" : "") + x.toString(16); }
  return "#" + c(r) + c(g) + c(b);
}
function rgb2hsl(r, g, b){
  r /= 255; g /= 255; b /= 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  var h = 0, s = 0, l = (mx + mn) / 2;
  if (d){
    s = d / (1 - Math.abs(2 * l - 1));
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hsl2hex(h, s, l){
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  var r, g, b;
  if (h < 60){ r = c; g = x; b = 0; }
  else if (h < 120){ r = x; g = c; b = 0; }
  else if (h < 180){ r = 0; g = c; b = x; }
  else if (h < 240){ r = 0; g = x; b = c; }
  else if (h < 300){ r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return rgb2hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
function hexHSL(h){ var c = hex2rgb(h); return rgb2hsl(c[0], c[1], c[2]); }
function shift(hex, dh, ds, dl){
  var a = hexHSL(hex);
  return hsl2hex(a[0] + (dh || 0), a[1] * (1 + (ds || 0)), Math.max(0.03, Math.min(0.97, a[2] + (dl || 0))));
}
function mix(a, b, t){
  var ca = hex2rgb(a), cb = hex2rgb(b);
  return rgb2hex(ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t);
}
function lighten(hex, t){ return mix(hex, "#ffffff", t); }
function darken(hex, t){ return mix(hex, "#0a0d14", t); }

/* ---------- time-of-day anchors ------------------------------------------ */
var SKIES = {
  dawn:   { top: "#2a3b6e", mid: "#8a6ba8", low: "#f2a07a", sun: "#ffd9a0", light: "#ffcfa3", amb: 0.62, dark: false },
  day:    { top: "#2f7fd4", mid: "#7cc0ee", low: "#cfe9fb", sun: "#fff6d8", light: "#fff8e2", amb: 1.0,  dark: false },
  golden: { top: "#25406f", mid: "#e08a52", low: "#f6c98a", sun: "#ffd27a", light: "#ffbe73", amb: 0.74, dark: false },
  night:  { top: "#070d22", mid: "#132349", low: "#27406f", sun: "#e8eeff", light: "#9fb6ef", amb: 0.3,  dark: true },
  space:  { top: "#04060f", mid: "#0a1030", low: "#160f2e", sun: "#fff4d0", light: "#b9c8ff", amb: 0.26, dark: true },
  under:  { top: "#04324f", mid: "#0a5878", low: "#1a86a0", sun: "#cdf4ff", light: "#8fe0f2", amb: 0.5,  dark: true }
};

var SETTING_WORDS = {
  mountain: ["mountain", "mountains", "peak", "peaks", "alps", "ridge", "cliff", "canyon", "valley", "highland", "cave", "cavern", "grotto", "summit"],
  forest:   ["forest", "woods", "jungle", "trees", "woodland", "grove", "rainforest"],
  city:     ["city", "street", "downtown", "skyline", "urban", "alley", "metropolis", "town", "neon city", "rooftop"],
  ocean:    ["ocean", "sea", "waves", "beach", "shore", "coast", "island", "harbor", "harbour", "reef", "seaside"],
  desert:   ["desert", "dunes", "sahara", "wasteland", "canyon", "mesa", "badlands"],
  space:    ["space", "orbit", "galaxy", "nebula", "cosmos", "stars", "planet", "asteroid", "moon", "mars", "jupiter", "saturn", "venus", "neptune", "starfield", "interstellar"],
  interior: ["room", "bedroom", "kitchen", "library", "cafe", "studio", "workshop", "desk", "indoor", "inside", "office", "window", "windowsill", "couch", "bed"],
  field:    ["field", "meadow", "plains", "prairie", "farm", "hill", "hills", "grass", "countryside", "garden"],
  snowland: ["snow", "tundra", "arctic", "glacier", "icy", "winter", "frozen"],
  swamp:    ["swamp", "marsh", "bog", "wetland"],
  lake:     ["lake", "pond", "river", "stream", "waterfall", "lagoon"],
  volcano:  ["volcano", "lava", "magma", "eruption"]
};

/* ---------- prompt -> scene --------------------------------------------- */
function lookupGroup(toks, table, dflt){
  for (var i = 0; i < toks.length; i++){
    var hit = table[toks[i]];
    if (hit) return hit;
  }
  // two-word cues like "golden hour" or "low poly"
  var joined = " " + toks.join(" ") + " ";
  for (var w in table) if (w.indexOf(" ") > 0 && joined.indexOf(" " + w + " ") >= 0) return table[w];
  return dflt;
}
function phraseHit(joined, table){
  var best = "", bestLen = 0;
  for (var w in table){
    if (joined.indexOf(" " + w + " ") >= 0 && w.length > bestLen){ best = table[w]; bestLen = w.length; }
  }
  return best;
}

/* Concepts the prompt asks us to draw, longest phrase first so "hot air
   balloon" beats "balloon". */
/* Words that set the light, weather, mood or style have already been read as
   attributes. Drawing them again as objects is what put a campfire in the
   middle of "a dragon breathing fire at sunset". */
function attributeWords(S){
  var skip = Object.create(null);
  [NM.timeOf, NM.weatherOf, NM.moodOf, NM.styleOf].forEach(function(tab){
    for (var w in tab) skip[w] = 1;
  });
  ["fire", "flame", "breathing", "breath", "glowing", "burning", "flaming"].forEach(function(w){ skip[w] = 1; });
  return skip;
}
function findSubjects(toks, joined, skip){
  var found = [], seen = Object.create(null);
  var keys = Object.keys(NM.w2c).sort(function(a, b){ return b.length - a.length; });
  var consumed = joined;
  for (var i = 0; i < keys.length; i++){
    var k = keys[i];
    if (consumed.indexOf(" " + k + " ") < 0) continue;
    if (skip && skip[k]) continue;
    var c = NM.w2c[k];
    if (seen[c]) continue;
    seen[c] = 1;
    found.push({ concept: c, word: k, at: joined.indexOf(" " + k + " ") });
    consumed = consumed.split(" " + k + " ").join("  ");
    if (found.length >= 4) break;
  }
  found.sort(function(a, b){ return a.at - b.at; });
  return found;
}

/* Nothing matched a drawable, so route by meaning to the closest concept. */
function routeByVector(toks){
  var v = sentVec(contentWords(toks));
  if (!v) return null;
  var best = "", bs = -1;
  for (var i = 0; i < NM.concepts.length; i++){
    var off = i * NM.D, s = 0;
    for (var t = 0; t < NM.D; t++) s += v[t] * NM.cvec[off + t];
    if (s > bs){ bs = s; best = NM.concepts[i]; }
  }
  return bs > 0.3 ? { concept: best, word: "", at: 0, guessed: true } : null;
}

function parseScene(prompt, opts){
  opts = opts || {};
  var raw = String(prompt || "").trim();
  /* Prompts are full of nouns the model has never seen ("cave", "canyon"),
     and repairing them turns a crystal cave into a crystal cake. So read the
     words as written, and only fall back to typo repair if nothing matched. */
  var toks = nanoTokens(raw);
  var fixedToks = toks.map(repairWord);
  var joined = " " + toks.join(" ") + " ";
  /* An explicit seed lets an edit keep the original layout while the words
     change what gets drawn. */
  var seed = opts.seed !== undefined ? (opts.seed >>> 0) : hashStr(raw.toLowerCase() + "|" + (opts.salt || ""));
  var rr = mk(rng(seed));

  var S = {
    prompt: raw, toks: toks, joined: joined, seed: seed, rr: rr,
    style: phraseHit(joined, NM.styleOf) || "illustration",
    time: phraseHit(joined, NM.timeOf) || "",
    weather: phraseHit(joined, NM.weatherOf) || "clear",
    mood: phraseHit(joined, NM.moodOf) || ""
  };

  /* setting */
  S.setting = "";
  var bestLen = 0;
  for (var set in SETTING_WORDS){
    var ws = SETTING_WORDS[set];
    for (var i = 0; i < ws.length; i++){
      if (joined.indexOf(" " + ws[i] + " ") >= 0 && ws[i].length > bestLen){ S.setting = set; bestLen = ws[i].length; }
    }
  }

  /* subjects (attributes are resolved above, so they get skipped here) */
  var skipWords = attributeWords(S);
  var subs = findSubjects(toks, joined, skipWords);
  if (!subs.length && fixedToks.join(" ") !== toks.join(" "))
    subs = findSubjects(fixedToks, " " + fixedToks.join(" ") + " ", skipWords);
  if (!subs.length){
    var guess = routeByVector(fixedToks);
    if (guess) subs = [guess];
  }
  /* Landscape words describe where we are, not what to plant in the middle.
     PURE ones never become the subject; the rest can if nothing else fits. */
  var PURE = { city: 1, mountain: 1, beach: 1, field: 1, desert: 1, wave: 1, road: 1, lake: 1,
               island: 1, room: 1, garden: 1, cloud: 1, rain: 1, snow: 1, leaf: 1, maze: 1,
               door: 1, window: 1, stairs: 1, waterfall: 1, aurora: 1, rainbow: 1, lightning: 1 };
  var SCENERY = { mountain: 1, tree: 1, city: 1, wave: 1, beach: 1, cloud: 1, star: 1, field: 1,
                  desert: 1, road: 1, rain: 1, snow: 1, lake: 1, island: 1, garden: 1, room: 1, leaf: 1 };
  S.subjects = [];
  S.scenery = [];
  for (i = 0; i < subs.length; i++){
    var cc = subs[i].concept;
    if (PURE[cc] || (SCENERY[cc] && (subs.length > 1 || S.setting))) S.scenery.push(cc);
    else S.subjects.push(subs[i]);
  }
  if (!S.subjects.length && subs.length && !PURE[subs[0].concept]){
    S.subjects = [subs[0]];
    S.scenery = S.scenery.filter(function(c){ return c !== subs[0].concept; });
  }

  /* infer a setting from the subject when the prompt did not name one */
  if (!S.setting){
    var c0 = S.subjects.length ? S.subjects[0].concept : "";
    var byConcept = { fish: "under", octopus: "under", crab: "under", whale: "under",
                      spaceship: "space", rocket: "space", satellite: "space", planet: "space",
                      star: "space", moon: "space", astronaut: "space", telescope: "night",
                      boat: "ocean", lighthouse: "ocean", penguin: "snowland", cactus: "desert",
                      mushroom: "forest", tree: "forest", campfire: "forest", tent: "forest",
                      car: "city", train: "city", robot: "city", computer: "interior",
                      coffee: "interior", book: "interior", piano: "interior", cake: "interior",
                      dragon: "mountain", castle: "mountain", bird: "field", butterfly: "garden",
                      flower: "garden", house: "field", windmill: "field", horse: "field" };
    var SCENE_SET = { city: "city", mountain: "mountain", beach: "ocean", wave: "ocean", island: "ocean",
                      field: "field", garden: "field", desert: "desert", road: "field", lake: "lake",
                      room: "interior", window: "interior", door: "interior", stairs: "interior",
                      snow: "snowland", waterfall: "lake", leaf: "forest", tree: "forest" };
    S.setting = byConcept[c0] || (S.scenery.length && SCENE_SET[S.scenery[0]]) ||
                (S.scenery.length ? (SETTING_WORDS[S.scenery[0]] ? S.scenery[0] : "field") : "field");
    if (!SETTING_WORDS[S.setting]) S.setting = "field";
  }

  /* time of day: prompt wins, then the setting's natural light */
  if (!S.time){
    if (S.setting === "space") S.time = "space";
    else if (S.setting === "under") S.time = "under";
    else if (S.style === "neon") S.time = "night";
    else if (S.mood === "tense" || S.style === "gothic") S.time = "night";
    else S.time = rr.pick(["day", "day", "golden", "dawn"]);
  }
  if (S.setting === "space") S.time = "space";
  if (S.time === "under") S.setting = "ocean";
  S.under = S.time === "under" || /\bunderwater|undersea|submerged|deep sea\b/.test(joined);
  if (S.under) S.time = "under";

  /* mood fallback from style */
  if (!S.mood){
    S.mood = S.style === "neon" ? "epic" : S.style === "gothic" ? "tense" :
             S.style === "watercolor" ? "calm" : S.style === "cartoon" ? "happy" :
             rr.pick(["calm", "epic", "calm"]);
  }

  /* explicit colours in the prompt steer the palette */
  S.colorWords = [];
  for (i = 0; i < toks.length; i++) if (NM.colors[toks[i]]) S.colorWords.push(NM.colors[toks[i]]);

  S.palette = buildPalette(S);
  S.detail = opts.detail || "high";
  S.wide = !!opts.wide;
  return S;
}

/* ---------- palette ------------------------------------------------------ */
function buildPalette(S){
  var sky = SKIES[S.time] || SKIES.day, rr = S.rr;
  var p = {
    dark: sky.dark, amb: sky.amb,
    skyTop: sky.top, skyMid: sky.mid, skyLow: sky.low,
    sun: sky.sun, light: sky.light
  };

  /* a named colour becomes the accent, and nudges the whole scene toward it */
  var accent = S.colorWords.length ? S.colorWords[0] : "";
  var baseH = accent ? hexHSL(accent)[0] : rr.f(0, 360);

  if (accent){
    p.skyTop = mix(p.skyTop, accent, 0.26);
    p.skyMid = mix(p.skyMid, accent, 0.2);
    p.skyLow = mix(p.skyLow, accent, 0.14);
  }
  p.accent = accent || hsl2hex(baseH, 0.68, sky.dark ? 0.6 : 0.52);
  p.accent2 = S.colorWords[1] || hsl2hex(baseH + rr.pick([150, 180, 210]), 0.6, sky.dark ? 0.58 : 0.5);

  /* ground and foliage by setting */
  var G = {
    mountain: ["#4a5f7a", "#33465e"], forest: ["#2f6b44", "#1d472e"], city: ["#2b3348", "#1b2132"],
    ocean:   ["#1d6f9a", "#11486a"], desert: ["#d8a765", "#b9834a"], space: ["#181d33", "#0d1124"],
    interior:["#4a3b32", "#332821"], field: ["#5aa64f", "#3d7f39"], snowland: ["#dfe9f5", "#b9cbe0"],
    swamp:   ["#4a6b45", "#2f4a30"], lake: ["#3f7f6a", "#2a5a4c"], volcano: ["#4a3038", "#2c1c22"]
  }[S.setting] || ["#5aa64f", "#3d7f39"];
  p.groundHi = G[0]; p.groundLo = G[1];
  /* snow covers whatever the ground was */
  if (S.weather === "snow" && S.setting !== "ocean" && S.setting !== "space" && !S.under){
    p.groundHi = mix("#eef4fc", p.skyLow, 0.12);
    p.groundLo = mix("#c4d4e8", p.skyMid, 0.18);
  }
  p.far = mix(p.skyMid, p.groundLo, 0.4);
  p.mid = mix(p.groundHi, p.skyMid, 0.34);
  p.near = darken(p.groundLo, 0.28);
  p.foliage = mix("#3f8f52", p.accent, 0.12);
  p.foliageDark = darken(p.foliage, 0.32);
  p.stone = mix("#7d879a", p.skyMid, 0.2);
  p.water = mix("#2f7fb5", p.skyMid, 0.35);
  p.shadow = sky.dark ? "#04060e" : "#1d2436";

  /* subject colours: readable against the ground, not the same hue as it */
  var gH = hexHSL(p.groundHi)[0];
  var sH = accent ? hexHSL(accent)[0] : gH + rr.pick([140, 170, 200, -150]);
  p.subject = accent ? accent : hsl2hex(sH, 0.62, sky.dark ? 0.55 : 0.48);
  p.subjectLo = darken(p.subject, 0.34);
  p.subjectHi = lighten(p.subject, 0.3);
  p.trim = hsl2hex(hexHSL(p.subject)[0] + 40, 0.72, 0.62);
  p.glow = sky.dark ? lighten(p.accent, 0.3) : p.sun;

  /* style pushes contrast and saturation */
  if (S.style === "neon"){
    p.accent = hsl2hex(hexHSL(p.accent)[0], 0.95, 0.6);
    p.accent2 = hsl2hex(hexHSL(p.accent)[0] + 170, 0.95, 0.6);
    p.subject = hsl2hex(hexHSL(p.subject)[0], 0.9, 0.58);
    p.glow = lighten(p.accent, 0.22);
    ["skyTop", "skyMid", "skyLow", "groundHi", "groundLo", "far", "mid", "near"].forEach(function(k){
      p[k] = shift(p[k], 0, 0.3, -0.06);
    });
  } else if (S.style === "watercolor"){
    ["skyTop", "skyMid", "skyLow", "groundHi", "groundLo", "far", "mid", "subject", "foliage"].forEach(function(k){
      p[k] = shift(p[k], 0, -0.34, 0.12);
    });
  } else if (S.style === "noir"){
    var flat = function(c){ var h = hexHSL(c); return hsl2hex(220, 0.05, h[2]); };
    Object.keys(p).forEach(function(k){ if (typeof p[k] === "string" && p[k].charAt(0) === "#") p[k] = flat(p[k]); });
    p.accent = "#e8edf7";
  } else if (S.style === "gothic"){
    ["skyTop", "skyMid", "skyLow", "groundHi", "groundLo", "far", "mid", "near"].forEach(function(k){
      p[k] = shift(p[k], 6, -0.12, -0.16);
    });
  } else if (S.style === "pixel"){
    var quant = function(c){ var h = hexHSL(c); return hsl2hex(Math.round(h[0] / 24) * 24, Math.round(h[1] * 5) / 5, Math.round(h[2] * 6) / 6); };
    Object.keys(p).forEach(function(k){ if (typeof p[k] === "string" && p[k].charAt(0) === "#") p[k] = quant(p[k]); });
  } else if (S.style === "storybook"){
    ["skyTop", "skyMid", "skyLow", "groundHi", "foliage", "subject"].forEach(function(k){
      p[k] = shift(p[k], 0, 0.1, 0.06);
    });
  }

  p.list = [p.skyTop, p.skyMid, p.accent, p.groundHi, p.subject, p.trim];
  return p;
}

/* ---------- a caption in NanoTech's voice -------------------------------- */
function sceneCaption(S){
  var rr = mk(rng(S.seed ^ 0x5f3a));
  var subj = S.subjects.length ? (S.subjects[0].word || S.subjects[0].concept) : S.setting;
  var timeWord = { dawn: "at sunrise", day: "in daylight", golden: "at golden hour",
                   night: "under the stars", space: "out in space", under: "underwater" }[S.time] || "";
  var pools = [
    cap(subj) + " " + timeWord + ". Came out nice ✨",
    "Here you go — " + subj + " " + timeWord + ".",
    cap(subj) + ", " + (S.mood === "epic" ? "went big on this one" : S.mood === "calm" ? "kept it calm" : "had fun with this") + " ✨",
    "One " + subj + ", " + (S.style === "illustration" ? "fully illustrated" : "in a " + S.style + " look") + "."
  ];
  return rr.pick(pools).replace(/\s+/g, " ").trim();
}
