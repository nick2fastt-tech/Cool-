/* ==========================================================================
   NanoTech core: model loading, tokenizing, vector maths, seeded randomness.
   Everything above this layer assumes NM is decoded and ready.
   ========================================================================== */
var NM = (function(){
  var m = NANO_MODEL;

  function decode(b64, scale, n){
    var bin = atob(b64), out = new Float32Array(n || bin.length);
    for (var i = 0; i < out.length; i++){
      var v = bin.charCodeAt(i);
      out[i] = (v > 127 ? v - 256 : v) * scale;
    }
    return out;
  }

  var V = m.vocab.length, D = m.dim;
  var vec = decode(m.vec, m.vecScale, V * D);
  var cvec = decode(m.cvec, m.cvecScale, m.concepts.length * D);
  var idf = decode(m.idf, m.idfScale, V);
  var val = decode(m.val, m.valScale, V);
  var aro = decode(m.aro, m.aroScale, V);
  var iw = decode(m.iw, m.iwScale, m.intentNames.length * (m.featDim + 1));

  var index = Object.create(null);
  for (var i = 0; i < V; i++) index[m.vocab[i]] = i;

  // words bucketed by length for cheap fuzzy matching
  var byLen = Object.create(null);
  for (i = 0; i < V; i++){
    var w = m.vocab[i], L = w.length;
    if (L < 4) continue;
    (byLen[L] || (byLen[L] = [])).push(w);
  }

  var kbIndex = Object.create(null);
  m.kb.forEach(function(e, n){
    e.n = n;
    e.names.forEach(function(nm){ kbIndex[nm] = e; });
    kbIndex[e.id] = e;
  });

  // reverse lexicon lookups: word -> bucket name
  function flip(groups){
    var out = Object.create(null);
    Object.keys(groups).forEach(function(k){
      groups[k].forEach(function(w){ out[w] = k; });
    });
    return out;
  }

  return {
    raw: m, V: V, D: D, dim: D,
    vocab: m.vocab, index: index, byLen: byLen,
    vec: vec, idf: idf, valence: val, arousal: aro,
    intentNames: m.intentNames, iw: iw, itok: m.itok, featDim: m.featDim,
    concepts: m.concepts, cvec: cvec, w2c: m.w2c,
    colors: m.colors, styles: m.styles, times: m.times,
    weather: m.weather, moods: m.moods,
    kb: m.kb, kbIndex: kbIndex,
    styleOf: flip(m.styles), timeOf: flip(m.times),
    weatherOf: flip(m.weather), moodOf: flip(m.moods),
    uni: m.uni, bi: m.bi
  };
})();

/* ---------- tokenizing: must match tokens() in nanotech/train/train.py ---- */
function nanoTokens(text){
  var t = String(text || "").toLowerCase().replace(/’/g, "'").replace(/'/g, "");
  var parts = t.split(/[^a-z0-9]+/), out = [];
  for (var i = 0; i < parts.length; i++) if (parts[i]) out.push(parts[i]);
  return out;
}
function normTok(w){ return /^[0-9]+$/.test(w) ? "#num" : w; }

var STOP = (function(){
  var s = ("a an the and or but if of to in on at for with from by as is are was were be been being am do does did " +
           "doing have has had having i you he she it we they me him her them my your his its our their this that " +
           "these those there here what which who whom whose when where why how all any both each few more most " +
           "other some such no nor not only own same so than too very can will just dont should now im ive id ill " +
           "about into over under again then once up down out off very s t d ll m o re ve y").split(" ");
  var o = Object.create(null); s.forEach(function(w){ o[w] = 1; }); return o;
})();

function contentWords(toks){
  var out = [];
  for (var i = 0; i < toks.length; i++) if (!STOP[toks[i]] && toks[i].length > 1) out.push(toks[i]);
  return out;
}

/* ---------- vectors ------------------------------------------------------- */
function vecOf(word){
  var i = NM.index[normTok(word)];
  if (i === undefined) return null;
  return NM.vec.subarray(i * NM.D, i * NM.D + NM.D);
}
function zeroVec(){ return new Float32Array(NM.D); }
function addInto(acc, v, w){
  if (!v) return;
  w = w === undefined ? 1 : w;
  for (var t = 0; t < acc.length; t++) acc[t] += v[t] * w;
}
function normalizeVec(v){
  var n = 0, t;
  for (t = 0; t < v.length; t++) n += v[t] * v[t];
  n = Math.sqrt(n);
  if (n < 1e-9) return v;
  for (t = 0; t < v.length; t++) v[t] /= n;
  return v;
}
function dot(a, b){
  var s = 0;
  for (var t = 0; t < a.length; t++) s += a[t] * b[t];
  return s;
}
/* tf-idf weighted sentence vector, so the rare words steer it */
function sentVec(toks){
  var acc = zeroVec(), any = false;
  for (var i = 0; i < toks.length; i++){
    var w = normTok(toks[i]), id = NM.index[w];
    if (id === undefined) continue;
    addInto(acc, NM.vec.subarray(id * NM.D, id * NM.D + NM.D), Math.max(0.2, NM.idf[id]));
    any = true;
  }
  return any ? normalizeVec(acc) : null;
}
function nearestWords(v, n, filter){
  var best = [];
  for (var i = 0; i < NM.V; i++){
    if (filter && !filter(NM.vocab[i])) continue;
    var s = 0, off = i * NM.D;
    for (var t = 0; t < NM.D; t++) s += v[t] * NM.vec[off + t];
    if (best.length < n){ best.push([s, NM.vocab[i]]); best.sort(function(a, b){ return a[0] - b[0]; }); }
    else if (s > best[0][0]){ best[0] = [s, NM.vocab[i]]; best.sort(function(a, b){ return a[0] - b[0]; }); }
  }
  return best.reverse();
}

/* ---------- fuzzy word repair -------------------------------------------- */
/* one edit away, counting a swapped pair of letters as one edit, because
   transpositions are the typo people actually make most */
function editWithin1(a, b){
  var la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  var i = 0, j = 0;
  while (i < la && j < lb && a.charAt(i) === b.charAt(j)){ i++; j++; }
  if (i === la && j === lb) return true;
  var ea = la - 1, eb = lb - 1;
  while (ea >= i && eb >= j && a.charAt(ea) === b.charAt(eb)){ ea--; eb--; }
  var ra = ea - i + 1, rb = eb - j + 1;
  if (ra <= 1 && rb <= 1) return true;                       // sub / insert / delete
  if (ra === 2 && rb === 2 && a.charAt(i) === b.charAt(j + 1) && a.charAt(i + 1) === b.charAt(j)) return true;
  return false;
}
var fixCache = Object.create(null);
function repairWord(w){
  if (w.length < 4 || NM.index[w] !== undefined) return w;
  if (fixCache[w] !== undefined) return fixCache[w];
  var cands = (NM.byLen[w.length] || []).concat(NM.byLen[w.length - 1] || [], NM.byLen[w.length + 1] || []);
  var best = "", bestScore = -1e9;
  for (var i = 0; i < cands.length; i++){
    var c = cands[i];
    /* The first letter has to survive, or a leading transposition explains it.
       Without this, "range" repairs to "orange" and a mountain range picks up
       a piece of fruit. */
    var sameHead = c.charAt(0) === w.charAt(0) ||
                   (c.charAt(0) === w.charAt(1) && c.charAt(1) === w.charAt(0));
    if (!sameHead) continue;
    if (!editWithin1(w, c)) continue;
    var s = -NM.idf[NM.index[c]] + (c.charAt(1) === w.charAt(1) ? 1 : 0);
    if (s > bestScore){ bestScore = s; best = c; }
  }
  return (fixCache[w] = best || w);
}

/* ---------- deterministic randomness ------------------------------------- */
function hashStr(s){
  var h = 2166136261 >>> 0;
  s = String(s);
  for (var i = 0; i < s.length; i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function rng(seed){
  var a = (typeof seed === "number" ? seed : hashStr(seed)) >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mk(r){
  return {
    f: function(lo, hi){ return lo + (hi - lo) * r(); },
    i: function(lo, hi){ return Math.floor(lo + (hi - lo + 1) * r()); },
    pick: function(a){ return a[Math.floor(r() * a.length)]; },
    chance: function(p){ return r() < p; },
    sign: function(){ return r() < 0.5 ? -1 : 1; },
    shuffle: function(a){
      a = a.slice();
      for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
      return a;
    },
    some: function(a, n){ return this.shuffle(a).slice(0, n); },
    raw: r
  };
}

/* ---------- small text helpers ------------------------------------------- */
function cap(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function titleish(s){
  return String(s || "").replace(/\b([a-z])/g, function(_, c){ return c.toUpperCase(); });
}
function oxford(list, join){
  join = join || "and";
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return list[0] + " " + join + " " + list[1];
  return list.slice(0, -1).join(", ") + " " + join + " " + list[list.length - 1];
}
function plural(n, one, many){ return n === 1 ? one : (many || one + "s"); }
/* bigram fluency, used to choose between otherwise equal phrasings */
function fluency(text){
  var t = ["^"].concat(nanoTokens(text).map(normTok), ["$"]), s = 0;
  for (var i = 0; i < t.length - 1; i++){
    var c = NM.bi[t[i] + " " + t[i + 1]];
    s += c ? Math.log(1 + c) : -0.35;
  }
  return s / Math.max(1, t.length - 1);
}
