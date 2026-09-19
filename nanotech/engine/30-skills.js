/* ==========================================================================
   Skills: the things NanoTech computes exactly rather than talks around.
   A real expression parser, unit conversion, dates, counting, number facts.
   ========================================================================== */

/* ---------- arithmetic --------------------------------------------------- */
var WORD_OPS = [
  [/\bplus\b|\band\b(?=\s*[\d.])/g, "+"], [/\bminus\b|\bless\b/g, "-"],
  [/\btimes\b|\bmultiplied by\b|\bmultiply by\b|\bx\b(?=\s*[\d.(])/g, "*"],
  [/\bdivided by\b|\bdivide by\b|\bover\b(?=\s*[\d.])/g, "/"],
  [/\bto the power of\b|\braised to\b/g, "^"], [/\bmod(ulo)?\b/g, "%"],
  [/\bsquared\b/g, "^2"], [/\bcubed\b/g, "^3"],
  [/\bsquare root of\b|\bsqrt of\b|\broot of\b/g, "sqrt"],
  [/\bhalf of\b/g, "0.5*"], [/\bdouble\b|\btwice\b/g, "2*"], [/\btriple\b/g, "3*"],
  [/\bpi\b/g, "3.141592653589793"], [/\beuler\b/g, "2.718281828459045"],
  [/[×✕]/g, "*"], [/[÷]/g, "/"], [/−/g, "-"]
];

function Parser(src){ this.s = src; this.i = 0; }
Parser.prototype.ws = function(){ while (this.i < this.s.length && this.s.charAt(this.i) === " ") this.i++; };
Parser.prototype.eat = function(str){
  this.ws();
  if (this.s.substr(this.i, str.length).toLowerCase() === str) { this.i += str.length; return true; }
  return false;
};
Parser.prototype.peek = function(){ this.ws(); return this.s.charAt(this.i); };
Parser.prototype.expr = function(){
  var v = this.term();
  for (;;){
    this.ws();
    var c = this.peek();
    if (c === "+"){ this.i++; v += this.term(); }
    else if (c === "-"){ this.i++; v -= this.term(); }
    else return v;
  }
};
Parser.prototype.term = function(){
  var v = this.unary();
  for (;;){
    this.ws();
    var c = this.peek();
    if (c === "*"){ this.i++; v *= this.unary(); }
    else if (c === "/"){ this.i++; var d = this.unary(); if (d === 0) throw { div0: true }; v /= d; }
    else if (c === "%"){ this.i++; var m = this.unary(); if (m === 0) throw { div0: true }; v %= m; }
    else return v;
  }
};
Parser.prototype.unary = function(){
  this.ws();
  if (this.peek() === "-"){ this.i++; return -this.unary(); }
  if (this.peek() === "+"){ this.i++; return this.unary(); }
  return this.power();
};
Parser.prototype.power = function(){
  var base = this.atom();
  this.ws();
  if (this.peek() === "^" || (this.s.substr(this.i, 2) === "**")){
    this.i += this.peek() === "^" ? 1 : 2;
    return Math.pow(base, this.unary());
  }
  return base;
};
var FUNCS = {
  sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan, exp: Math.exp,
  ln: Math.log, log: function(x){ return Math.log(x) / Math.LN10; },
  log2: function(x){ return Math.log(x) / Math.LN2; },
  round: Math.round, floor: Math.floor, ceil: Math.ceil, sign: Math.sign,
  cbrt: function(x){ return Math.cbrt ? Math.cbrt(x) : Math.pow(x, 1 / 3); }
};
Parser.prototype.atom = function(){
  this.ws();
  if (this.peek() === "("){
    this.i++;
    var v = this.expr();
    this.ws();
    if (this.peek() === ")") this.i++;
    return this.postfix(v);
  }
  for (var f in FUNCS){
    if (this.s.substr(this.i, f.length).toLowerCase() === f && !/[a-z]/i.test(this.s.charAt(this.i + f.length) || "")){
      this.i += f.length;
      var arg;
      this.ws();
      if (this.peek() === "("){ this.i++; arg = this.expr(); this.ws(); if (this.peek() === ")") this.i++; }
      else arg = this.unary();
      var out = FUNCS[f](arg);
      if (!isFinite(out)) throw { domain: true, fn: f };
      return this.postfix(out);
    }
  }
  var m = /^-?\d*\.?\d+(?:[eE][-+]?\d+)?/.exec(this.s.slice(this.i));
  if (!m) throw { parse: true };
  this.i += m[0].length;
  return this.postfix(parseFloat(m[0]));
};
Parser.prototype.postfix = function(v){
  this.ws();
  while (this.peek() === "!"){
    this.i++;
    if (v < 0 || v > 170 || v !== Math.floor(v)) throw { domain: true, fn: "factorial" };
    var f = 1;
    for (var k = 2; k <= v; k++) f *= k;
    v = f;
  }
  return v;
};

function fmtNum(n){
  if (!isFinite(n)) return String(n);
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toLocaleString("en-US");
  var r = Math.round(n * 1e10) / 1e10;
  if (Math.abs(r) >= 1e15 || (Math.abs(r) < 1e-6 && r !== 0)) return r.toExponential(6).replace(/e([+-])(\d)$/, "e$10$2");
  var s = String(r);
  if (s.indexOf(".") >= 0) s = s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  var parts = s.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

/* Returns {ok, value, shown, note} or null when the text is not a sum. */
function doMath(text){
  var raw = String(text).toLowerCase().trim();
  if (/\b(story|poem|joke|draw|image|video|code|explain|why|who|feel)\b/.test(raw)) return null;

  var pc = raw.match(/(-?\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:of|off)\s*(-?\d+(?:\.\d+)?)/);
  if (pc){
    var p = parseFloat(pc[1]), of = parseFloat(pc[2]);
    var isOff = /off/.test(pc[0]);
    var part = of * p / 100;
    return { ok: true, value: isOff ? of - part : part,
             shown: pc[1] + "% " + (isOff ? "off " : "of ") + fmtNum(of),
             note: isOff ? fmtNum(of) + " minus " + fmtNum(part) : "" };
  }
  var frac = raw.match(/^\s*(?:what(?:'?s| is)\s+)?(-?\d+)\s*\/\s*(\d+)\s*(?:as a )?(?:decimal|number)?\s*\??\s*$/);
  if (frac && parseFloat(frac[2]) !== 0){
    return { ok: true, value: parseFloat(frac[1]) / parseFloat(frac[2]), shown: frac[1] + "/" + frac[2] };
  }
  var avg = raw.match(/\b(?:average|mean|avg)\s+of\s+([\d.,\s and]+)$/);
  if (avg){
    var nums = (avg[1].match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    if (nums.length > 1){
      var sum = nums.reduce(function(a, b){ return a + b; }, 0);
      return { ok: true, value: sum / nums.length, shown: "the average of " + nums.join(", "),
               note: fmtNum(sum) + " divided by " + nums.length };
    }
  }

  var s = raw.replace(/^(what(?:'?s| is| are)|whats|calculate|compute|work out|solve|how much is|evaluate|do the math on)\s*/i, "")
             .replace(/\?+\s*$/, "").replace(/\bequals?\b/g, "").replace(/,(?=\d{3}\b)/g, "").trim();
  for (var i = 0; i < WORD_OPS.length; i++) s = s.replace(WORD_OPS[i][0], WORD_OPS[i][1]);
  s = s.replace(/\s+/g, " ").trim();
  if (!/\d/.test(s)) return null;
  if (!/[-+*\/%^!]|sqrt|abs|sin|cos|tan|log|ln|round|floor|ceil|cbrt/.test(s)) return null;
  if (/[a-z]/.test(s.replace(/sqrt|abs|asin|acos|atan|sin|cos|tan|exp|log2|log|ln|round|floor|ceil|sign|cbrt|e/g, ""))) return null;

  try {
    var p2 = new Parser(s), v = p2.expr();
    p2.ws();
    if (p2.i < p2.s.length) return null;
    if (!isFinite(v)) return { ok: false, why: "That one does not come out to a real number." };
    return { ok: true, value: v, shown: s };
  } catch (e) {
    if (e && e.div0) return { ok: false, why: "You cannot divide by zero." };
    if (e && e.domain) return { ok: false, why: "That is outside what " + (e.fn || "the function") + " can take." };
    return null;
  }
}

/* ---------- unit conversion ---------------------------------------------- */
var UNITS = {
  length: { m: 1, meter: 1, meters: 1, metre: 1, metres: 1, km: 1000, kilometer: 1000, kilometers: 1000,
            kilometre: 1000, kilometres: 1000, cm: 0.01, centimeter: 0.01, centimeters: 0.01,
            mm: 0.001, millimeter: 0.001, millimeters: 0.001, mi: 1609.344, mile: 1609.344, miles: 1609.344,
            ft: 0.3048, foot: 0.3048, feet: 0.3048, in: 0.0254, inch: 0.0254, inches: 0.0254,
            yd: 0.9144, yard: 0.9144, yards: 0.9144, nm: 1852, nmi: 1852, ly: 9.4607e15, lightyear: 9.4607e15 },
  mass:   { g: 1, gram: 1, grams: 1, kg: 1000, kilo: 1000, kilos: 1000, kilogram: 1000, kilograms: 1000,
            mg: 0.001, lb: 453.59237, lbs: 453.59237, pound: 453.59237, pounds: 453.59237,
            oz: 28.349523, ounce: 28.349523, ounces: 28.349523, ton: 1e6, tonne: 1e6, tonnes: 1e6, stone: 6350.29 },
  volume: { l: 1, liter: 1, liters: 1, litre: 1, litres: 1, ml: 0.001, cl: 0.01,
            gal: 3.785411784, gallon: 3.785411784, gallons: 3.785411784,
            qt: 0.946352946, quart: 0.946352946, quarts: 0.946352946,
            pt: 0.473176473, pint: 0.473176473, pints: 0.473176473, cup: 0.2365882, cups: 0.2365882,
            tbsp: 0.0147868, tsp: 0.00492892, floz: 0.0295735 },
  time:   { s: 1, sec: 1, second: 1, seconds: 1, ms: 0.001, min: 60, minute: 60, minutes: 60,
            h: 3600, hr: 3600, hour: 3600, hours: 3600, day: 86400, days: 86400,
            week: 604800, weeks: 604800, month: 2629800, months: 2629800, year: 31557600, years: 31557600 },
  data:   { b: 1, byte: 1, bytes: 1, kb: 1024, mb: 1048576, gb: 1073741824, tb: 1099511627776,
            bit: 0.125, bits: 0.125, kib: 1024, mib: 1048576, gib: 1073741824 },
  speed:  { mps: 1, kmh: 0.2777778, kph: 0.2777778, mph: 0.44704, knot: 0.514444, knots: 0.514444, fps: 0.3048 }
};
var TEMPS = { c: 1, celsius: 1, centigrade: 1, f: 1, fahrenheit: 1, k: 1, kelvin: 1 };

function unitFamily(u){
  for (var fam in UNITS) if (UNITS[fam][u] !== undefined) return fam;
  return TEMPS[u] !== undefined ? "temp" : "";
}
function toC(v, u){ return u === "f" || u === "fahrenheit" ? (v - 32) * 5 / 9 : (u === "k" || u === "kelvin" ? v - 273.15 : v); }
function fromC(v, u){ return u === "f" || u === "fahrenheit" ? v * 9 / 5 + 32 : (u === "k" || u === "kelvin" ? v + 273.15 : v); }

function doConvert(text){
  var m = String(text).toLowerCase()
    .replace(/degrees?\s*/g, "").replace(/°\s*/g, "")
    .match(/(-?\d+(?:\.\d+)?)\s*([a-z]+)\s*(?:in|to|into|as|=|equals?)\s*([a-z]+)/);
  if (!m) return null;
  var v = parseFloat(m[1]), a = m[2], b = m[3];
  var fa = unitFamily(a), fb = unitFamily(b);
  if (!fa || fa !== fb) return null;
  var out;
  if (fa === "temp") out = fromC(toC(v, a), b);
  else out = v * UNITS[fa][a] / UNITS[fa][b];
  return { from: m[1] + " " + a, to: b, value: out, family: fa };
}

/* ---------- dates and times ---------------------------------------------- */
var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
              "August", "September", "October", "November", "December"];
var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function doTime(text){
  var d = new Date(), s = String(text).toLowerCase();
  var clock = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  var date = DAYS[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  if (/\b(year)\b/.test(s) && !/\btime\b/.test(s)) return { kind: "year", text: String(d.getFullYear()) };
  if (/\b(month)\b/.test(s)) return { kind: "month", text: MONTHS[d.getMonth()] };
  if (/\b(day|today|date)\b/.test(s) && !/\btime\b/.test(s)) return { kind: "date", text: date };
  if (/how long until (midnight|tomorrow)/.test(s)){
    var mid = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    var mins = Math.round((mid - d) / 60000);
    return { kind: "until", text: Math.floor(mins / 60) + "h " + (mins % 60) + "m" };
  }
  return { kind: "time", text: clock, date: date };
}

/* ---------- counting and small string work ------------------------------- */
function doCount(text){
  var m = String(text).match(/how many (letters|characters|chars|words|vowels)\s+(?:are\s+)?(?:in|does)\s*(?:the word\s*)?["']?([^"'?]+)["']?/i);
  if (!m) return null;
  var kind = m[1].toLowerCase(), subject = m[2].trim().replace(/\bhave\b\s*$/, "").trim();
  if (!subject) return null;
  var n;
  if (/word/.test(kind)) n = subject.split(/\s+/).filter(Boolean).length;
  else if (/vowel/.test(kind)) n = (subject.match(/[aeiou]/gi) || []).length;
  else if (/letter/.test(kind)) n = (subject.match(/[a-z]/gi) || []).length;
  else n = subject.length;
  return { kind: kind, n: n, subject: subject };
}

function doNumberFact(text){
  var m = String(text).toLowerCase().match(/\bis (-?\d+) (prime|even|odd|a square)\b/);
  if (m){
    var n = parseInt(m[1], 10), what = m[2];
    if (what === "even") return { q: n + " is even", no: n + " is odd", yes: n % 2 === 0 };
    if (what === "odd") return { q: n + " is odd", no: n + " is even", yes: Math.abs(n % 2) === 1 };
    if (what === "a square") return { q: n + " is a perfect square", no: n + " is not a perfect square",
                                      yes: n >= 0 && Number.isInteger(Math.sqrt(n)) };
    if (n < 2) return { q: n + " is prime", no: n + " is not prime", yes: false, why: "primes start at 2" };
    for (var i = 2; i * i <= n; i++)
      if (n % i === 0) return { q: n + " is prime", no: n + " is not prime", yes: false, why: "it divides by " + i };
    return { q: n + " is prime", no: n + " is not prime", yes: true };
  }
  var f = String(text).toLowerCase().match(/\bfactors of (\d+)/);
  if (f){
    var v = parseInt(f[1], 10);
    if (v > 0 && v < 1e7){
      var out = [];
      for (var k = 1; k * k <= v; k++) if (v % k === 0){ out.push(k); if (k !== v / k) out.push(v / k); }
      out.sort(function(a, b){ return a - b; });
      return { factors: out, of: v };
    }
  }
  return null;
}

function doRandom(text){
  var s = String(text).toLowerCase();
  var d = s.match(/\broll (?:a |an )?(?:(\d+)\s*)?d\s*(\d+)/) || s.match(/\broll (?:a |the )?(dice|die)\b/);
  if (d){
    var count = d[1] ? Math.min(20, parseInt(d[1], 10)) : 1;
    var sides = d[2] ? Math.min(1000, parseInt(d[2], 10)) : 6;
    var rolls = [];
    for (var i = 0; i < count; i++) rolls.push(1 + Math.floor(Math.random() * sides));
    return { kind: "dice", rolls: rolls, sides: sides,
             total: rolls.reduce(function(a, b){ return a + b; }, 0) };
  }
  if (/\b(flip a coin|coin flip|heads or tails)\b/.test(s))
    return { kind: "coin", side: Math.random() < 0.5 ? "heads" : "tails" };
  var pick = s.match(/\b(?:pick|choose)\s+(?:a\s+)?(?:random\s+)?number\s+(?:between|from)\s+(-?\d+)\s*(?:and|to|-)\s*(-?\d+)/);
  if (pick){
    var lo = parseInt(pick[1], 10), hi = parseInt(pick[2], 10);
    if (lo > hi){ var t = lo; lo = hi; hi = t; }
    return { kind: "number", value: lo + Math.floor(Math.random() * (hi - lo + 1)), lo: lo, hi: hi };
  }
  return null;
}
