/* ==========================================================================
   Answer material. Each function returns a plan: a list of moves the realizer
   turns into text. Nothing here does final wording.
   ========================================================================== */

function move(kind, text, opts){
  var m = { kind: kind, text: text };
  if (opts) for (var k in opts) m[k] = opts[k];
  return m;
}

/* ---------- knowledge ---------------------------------------------------- */
/* depth: 0 one-liner, 1 normal, 2 thorough */
function planTopic(u, mem, r, depth){
  var e = u.topic || mem.topic;
  if (!e) return null;
  var plan = [], used = [];
  var pts = e.points;

  /* Which facts to use. Mechanism questions want the how-points, which sit
     early; "tell me more" wants whatever we have not said yet. */
  var order = [];
  if (u.intent === "ask_more" || (mem.topic && mem.topic.id === e.id && mem.topicDepth > 0)){
    for (var i = 0; i < pts.length; i++) if (mem.topicUsed.indexOf(i) < 0) order.push(i);
    if (!order.length) for (i = 0; i < pts.length; i++) order.push(i);
  } else {
    for (i = 0; i < pts.length; i++) order.push(i);
    if (u.qType === "why" && pts.length > 2) order = [1, 0].concat(order.slice(2));
  }

  var want = depth === 0 ? 1 : depth === 1 ? 2 : Math.min(5, pts.length);
  var take = order.slice(0, want);

  var fresh0 = u.intent !== "ask_more" && !(mem.topic && mem.topic.id === e.id && mem.topicDepth > 0);
  if (fresh0) plan.push(move("def", e.one, { subject: e.names[0], art: e.art || "" }));

  if (depth >= 2 && take.length >= 3){
    plan.push(move("bullets", null, { items: take.map(function(i){ return pts[i]; }) }));
  } else {
    take.forEach(function(i){ plan.push(move("fact", pts[i])); });
  }
  used = take;

  if (e.like && (depth >= 1 || u.intent === "ask_simpler") && !(mem.told.indexOf("like:" + e.id) >= 0)){
    plan.push(move("analogy", e.like));
    mem.told.push("like:" + e.id);
  }
  if (e.wow && depth >= 2 && mem.told.indexOf("wow:" + e.id) < 0){
    plan.push(move("wow", e.wow));
    mem.told.push("wow:" + e.id);
  }

  markPoints(mem, used);
  mem.topic = e;
  mem.topicDepth++;
  var left = pts.length - mem.topicUsed.length;
  plan.push(move("meta", "", { topicId: e.id, left: left, near: e.near }));
  return plan;
}

/* Nothing in the knowledge base fits. Say so, and be useful anyway. */
function planUnknown(u, mem, r) {
  var subj = topicPhrase(u);
  var plan = [move("dunno", subj)];
  var near = nearestTopic(u);
  if (near && near.score > 0.4) plan.push(move("offerNear", near.topic.names[0], { topicId: near.topic.id }));
  return plan;
}
function topicPhrase(u){
  var t = u.text
    .replace(/^\s*(please\s+|can you\s+|could you\s+)?(explain|describe|define|tell me about|teach me about|talk about)\s+/i, "")
    .replace(/^\s*(what|whats|who|whos|where|wheres|when|why|how)\s+(is|are|was|were|does|do|did|can)?\s*/i, "")
    .replace(/^(a|an|the)\s+/i, "").replace(/[?.!]+\s*$/, "").trim();
  return t.length > 2 && t.length < 60 ? t : "";
}
function nearestTopic(u){
  if (!u.vec) return null;
  var best = null, bs = -1;
  for (var i = 0; i < NM.kb.length; i++){
    var e = NM.kb[i];
    if (!e._v) continue;
    var s = dot(u.vec, e._v);
    if (s > bs){ bs = s; best = e; }
  }
  return best ? { topic: best, score: bs } : null;
}

/* ---------- code --------------------------------------------------------- */
var SNIPPETS = [
{ id: "loop", match: /\b(for )?loop|iterate|repeat .* times\b/, langs: {
  js: ["for (let i = 0; i < 5; i++) {\n  console.log(i);\n}\n\n// over an array\nconst items = ['a', 'b', 'c'];\nfor (const item of items) {\n  console.log(item);\n}",
       "A classic for loop counts; for...of walks the values directly and is what you want most of the time."],
  py: ["for i in range(5):\n    print(i)\n\n# over a list\nitems = ['a', 'b', 'c']\nfor item in items:\n    print(item)",
       "range(5) gives 0 to 4. Looping straight over the list is cleaner than looping over indexes."] } },
{ id: "function", match: /\bfunction|method|def\b/, langs: {
  js: ["function greet(name, greeting = 'Hey') {\n  return `${greeting}, ${name}!`;\n}\n\n// arrow version, same thing\nconst greet2 = (name) => `Hey, ${name}!`;\n\nconsole.log(greet('Nick'));",
       "Default parameters save you a pile of if-statements, and template literals beat string concatenation."],
  py: ["def greet(name, greeting='Hey'):\n    return f'{greeting}, {name}!'\n\nprint(greet('Nick'))",
       "f-strings are the clean way to build strings in modern Python."] } },
{ id: "class", match: /\bclass|object oriented|constructor\b/, langs: {
  js: ["class Player {\n  constructor(name) {\n    this.name = name;\n    this.hp = 100;\n  }\n\n  hit(amount) {\n    this.hp = Math.max(0, this.hp - amount);\n    return this.hp > 0;\n  }\n}\n\nconst p = new Player('Nick');\np.hit(30);",
       "hit returns whether they survived, so the caller can branch on it without re-checking hp."],
  py: ["class Player:\n    def __init__(self, name):\n        self.name = name\n        self.hp = 100\n\n    def hit(self, amount):\n        self.hp = max(0, self.hp - amount)\n        return self.hp > 0\n\np = Player('Nick')\np.hit(30)",
       "__init__ is the constructor, and self is the instance, passed in explicitly."] } },
{ id: "fizzbuzz", match: /\bfizzbuzz\b/, langs: {
  js: ["for (let i = 1; i <= 100; i++) {\n  let out = '';\n  if (i % 3 === 0) out += 'Fizz';\n  if (i % 5 === 0) out += 'Buzz';\n  console.log(out || i);\n}",
       "Building the string instead of nesting if/else is why this version has no repeated conditions."],
  py: ["for i in range(1, 101):\n    out = ''\n    if i % 3 == 0:\n        out += 'Fizz'\n    if i % 5 == 0:\n        out += 'Buzz'\n    print(out or i)",
       "out or i falls through to the number when the string is still empty."] } },
{ id: "reverse", match: /\breverse (a )?string\b/, langs: {
  js: ["const reverse = (s) => [...s].reverse().join('');\n\nconsole.log(reverse('nanotech')); // hcetonan",
       "Spreading into an array handles emoji and accents better than split('') does."],
  py: ["def reverse(s):\n    return s[::-1]\n\nprint(reverse('nanotech'))  # hcetonan",
       "Slicing with a step of -1 is the idiomatic way to do it."] } },
{ id: "fib", match: /\bfibonacci\b/, langs: {
  js: ["function fib(n) {\n  let a = 0, b = 1;\n  for (let i = 0; i < n; i++) [a, b] = [b, a + b];\n  return a;\n}\n\nconsole.log(fib(30)); // 832040",
       "The loop version is O(n) and never blows the stack, unlike naive recursion."],
  py: ["def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n\nprint(fib(30))  # 832040",
       "Tuple assignment swaps both values at once, so no temp variable."] } },
{ id: "sortarr", match: /\bsort\b/, langs: {
  js: ["const nums = [10, 1, 5, 200];\nnums.sort((a, b) => a - b);   // [1, 5, 10, 200]\n\nconst people = [{ n: 'B', age: 30 }, { n: 'A', age: 20 }];\npeople.sort((a, b) => a.age - b.age);",
       "Always pass a comparator for numbers. Plain .sort() compares as text, so 200 sorts before 5."],
  py: ["nums = [10, 1, 5, 200]\nnums.sort()                  # [1, 5, 10, 200]\n\npeople = [{'n': 'B', 'age': 30}, {'n': 'A', 'age': 20}]\npeople.sort(key=lambda p: p['age'])",
       "key= is the clean way to sort by a field."] } },
{ id: "fetch", match: /\b(fetch|api call|http request|get json|axios)\b/, langs: {
  js: ["async function load(url) {\n  const res = await fetch(url);\n  if (!res.ok) throw new Error(`HTTP ${res.status}`);\n  return res.json();\n}\n\nload('/data.json')\n  .then(data => console.log(data))\n  .catch(err => console.error(err));",
       "fetch does not reject on a 404, so checking res.ok yourself is not optional."],
  py: ["import json\nimport urllib.request\n\ndef load(url):\n    with urllib.request.urlopen(url) as res:\n        return json.load(res)\n\nprint(load('https://example.com/data.json'))",
       "This uses only the standard library, so there is nothing to install."] } },
{ id: "gameloop", match: /\bgame loop|canvas|requestanimationframe\b/, langs: {
  js: ["const canvas = document.querySelector('canvas');\nconst ctx = canvas.getContext('2d');\nlet x = 0, last = 0;\n\nfunction frame(now) {\n  const dt = Math.min(32, now - last) / 1000;  // seconds, capped\n  last = now;\n\n  x = (x + 120 * dt) % canvas.width;           // 120 px per second\n\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = '#4d84ff';\n  ctx.fillRect(x, 80, 40, 40);\n\n  requestAnimationFrame(frame);\n}\nrequestAnimationFrame(frame);",
       "Multiplying movement by delta time is what keeps speed the same on a 60Hz and a 144Hz screen. Capping dt stops a tab switch from teleporting everything."] } },
{ id: "snake", match: /\bsnake game\b/, langs: {
  js: ["const S = 20, W = 20, H = 20;               // cell size and grid\nlet snake = [{ x: 10, y: 10 }], dir = { x: 1, y: 0 };\nlet food = { x: 5, y: 5 }, dead = false;\n\naddEventListener('keydown', e => {\n  const map = { ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0] };\n  const d = map[e.key];\n  if (d && (d[0] !== -dir.x || d[1] !== -dir.y)) dir = { x: d[0], y: d[1] };\n});\n\nfunction step() {\n  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };\n  if (head.x < 0 || head.y < 0 || head.x >= W || head.y >= H) return dead = true;\n  if (snake.some(s => s.x === head.x && s.y === head.y)) return dead = true;\n  snake.unshift(head);\n  if (head.x === food.x && head.y === food.y) {\n    food = { x: (Math.random()*W)|0, y: (Math.random()*H)|0 };\n  } else snake.pop();\n}",
       "The trick is unshift the new head and pop the tail, so the snake moves without touching every segment. Growing is just skipping the pop. The direction check stops instant reversal."] } },
{ id: "htmlpage", match: /\b(html (page|file|boilerplate)|webpage|web page|starter html)\b/, langs: {
  html: ["<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>My Page</title>\n<style>\n  body { margin: 0; font: 16px/1.6 system-ui, sans-serif;\n         background: #0f1626; color: #eef; display: grid;\n         place-items: center; min-height: 100vh; }\n</style>\n</head>\n<body>\n  <h1>Hello</h1>\n  <script>\n    console.log('running');\n  <\/script>\n</body>\n</html>",
       "The viewport meta is what makes it behave on a phone. Everything inline means one file with nothing to install."] } },
{ id: "cssanim", match: /\bcss animation|keyframes|animate with css\b/, langs: {
  css: ["@keyframes float {\n  0%, 100% { transform: translateY(0); }\n  50%      { transform: translateY(-14px); }\n}\n\n.orb {\n  animation: float 3s ease-in-out infinite;\n  transform-box: fill-box;\n  transform-origin: center;\n}",
       "Matching the 0% and 100% keyframes is what makes it loop without a jump. transform and opacity are the two cheap properties to animate."] } },
{ id: "debounce", match: /\bdebounce|throttle\b/, langs: {
  js: ["function debounce(fn, ms = 250) {\n  let t;\n  return (...args) => {\n    clearTimeout(t);\n    t = setTimeout(() => fn(...args), ms);\n  };\n}\n\nconst onType = debounce(q => search(q), 300);",
       "Debounce waits for the quiet. Throttle fires at most every N ms. Search boxes want debounce."] } },
{ id: "random", match: /\brandom (number|int)|shuffle\b/, langs: {
  js: ["const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));\n\nfunction shuffle(a) {\n  a = a.slice();\n  for (let i = a.length - 1; i > 0; i--) {\n    const j = Math.floor(Math.random() * (i + 1));\n    [a[i], a[j]] = [a[j], a[i]];\n  }\n  return a;\n}",
       "That shuffle is Fisher-Yates. sort(() => Math.random() - 0.5) looks clever and is genuinely biased."],
  py: ["import random\n\nrand_int = lambda lo, hi: random.randint(lo, hi)\n\nitems = [1, 2, 3, 4, 5]\nrandom.shuffle(items)        # in place\npicked = random.sample(items, 2)",
       "randint includes both ends, unlike most languages."] } },
{ id: "readfile", match: /\bread (a )?file|open (a )?file|write (to )?(a )?file\b/, langs: {
  py: ["# read\nwith open('data.txt') as f:\n    text = f.read()\n\n# write\nwith open('out.txt', 'w') as f:\n    f.write('hello\\n')\n\n# line by line, without loading it all\nwith open('big.log') as f:\n    for line in f:\n        process(line.rstrip())",
       "with closes the file even if something throws. Iterating the file object streams it instead of loading the whole thing."],
  js: ["import { readFile, writeFile } from 'node:fs/promises';\n\nconst text = await readFile('data.txt', 'utf8');\nawait writeFile('out.txt', 'hello\\n');",
       "Pass 'utf8' or you get a Buffer back instead of a string."] } },
{ id: "sumarr", match: /\bsum (of )?(an )?array|add up (a )?list|total\b/, langs: {
  js: ["const nums = [1, 2, 3, 4];\nconst total = nums.reduce((a, b) => a + b, 0);\n\n// average\nconst avg = total / nums.length;",
       "The 0 seed matters. reduce with no seed throws on an empty array."],
  py: ["nums = [1, 2, 3, 4]\ntotal = sum(nums)\navg = total / len(nums) if nums else 0",
       "The guard stops a ZeroDivisionError on an empty list."] } },
{ id: "listcomp", match: /\blist comprehension|map filter\b/, langs: {
  py: ["nums = [1, 2, 3, 4, 5, 6]\n\nsquares = [n * n for n in nums]\nevens   = [n for n in nums if n % 2 == 0]\npairs   = {n: n * n for n in nums}",
       "One line each, and they read left to right: what you want, where it comes from, which ones."],
  js: ["const nums = [1, 2, 3, 4, 5, 6];\n\nconst squares = nums.map(n => n * n);\nconst evens   = nums.filter(n => n % 2 === 0);\nconst pairs   = Object.fromEntries(nums.map(n => [n, n * n]));",
       "map and filter both return new arrays, so the original is untouched."] } }
];

function detectLang(text){
  var s = String(text).toLowerCase();
  if (/\bpython|\.py\b|django|flask|numpy|pandas\b/.test(s)) return "py";
  if (/\bhtml\b|webpage|web page|<\w+>/.test(s)) return "html";
  if (/\bcss\b|stylesheet|keyframes\b/.test(s)) return "css";
  if (/\bjavascript|\bjs\b|node|react|typescript|canvas\b/.test(s)) return "js";
  return "js";
}
var LANG_LABEL = { js: "javascript", py: "python", html: "html", css: "css" };

function planCode(u, mem, r){
  var want = detectLang(u.text), s = u.text.toLowerCase();
  var hit = null;
  for (var i = 0; i < SNIPPETS.length; i++){
    if (SNIPPETS[i].match.test(s)){ hit = SNIPPETS[i]; break; }
  }
  if (!hit) return null;
  var langs = hit.langs;
  var lang = langs[want] ? want : Object.keys(langs)[0];
  var pair = langs[lang];
  return [move("code", pair[0], { lang: LANG_LABEL[lang], why: pair[1], snippetId: hit.id })];
}

/* ---------- ideas -------------------------------------------------------- */
var IDEAS = {
  game: ["a one-button runner where the only move is a jump that also fires",
         "a puzzle game where you rewind time three seconds instead of undoing",
         "a fishing game where the fish are constellations",
         "a tower defence where the towers are notes and the waves come on the beat",
         "a game about repairing a lighthouse in a storm, one bulb at a time",
         "a stealth game where light is the only thing that can hurt you",
         "a farming game on a very small asteroid that spins",
         "a typing game where the words you type become the platforms",
         "a racing game with no brakes, only a grappling hook",
         "a cooking game where you never see the recipe, only the customer's face"],
  story: ["a lighthouse keeper who starts getting letters from the ship that sank",
          "the last radio operator on a station nobody has called in nine years",
          "a city where everyone shares one memory and someone notices it is wrong",
          "a mapmaker hired to draw a country that does not exist yet",
          "two kids who build a door and are careful never to open it",
          "a museum guard who realises one exhibit moves a centimetre every night",
          "someone who inherits a house and a list of things they must never fix"],
  app: ["a habit tracker that only ever shows you today",
        "a note app where every note dies in a week unless you touch it",
        "a shared grocery list that guesses what you forgot",
        "a reading timer that reads to you when you stop",
        "a workout app that only gives you one exercise a day",
        "a budget tool that shows money as hours of your life"],
  project: ["build a tiny drawing app that saves to SVG",
            "make a command line tool that renames files by a pattern you type",
            "write a script that turns your photos into a contact sheet",
            "make a one-page site that shows a different quote each visit",
            "build a small synth in the browser with the Web Audio API",
            "write a maze generator and then a solver for it"],
  learn: ["pick one small program you actually want and build it badly first",
          "learn the debugger properly, it pays back every week after",
          "read someone else's small project end to end",
          "rewrite something you already built, from memory",
          "learn regular expressions well enough to read them out loud"],
  general: ["write down the version of this that would take one afternoon",
            "do the ugly version first and see if you still like the idea",
            "cut the feature you are most attached to and see what is left",
            "show it to one person before you polish anything"]
};
function ideaBucket(u){
  var s = u.text.toLowerCase();
  if (/\bgame|level|platformer|rpg\b/.test(s)) return "game";
  if (/\bstory|novel|plot|character|film|script\b/.test(s)) return "story";
  if (/\bapp|website|site|tool|product\b/.test(s)) return "app";
  if (/\blearn|study|practice|improve|get better\b/.test(s)) return "learn";
  if (/\bbuild|make|project|side project\b/.test(s)) return "project";
  return "general";
}
function planIdeas(u, mem, r){
  var bucket = ideaBucket(u), pool = IDEAS[bucket];
  var n = /\b(\d+)\b/.test(u.text) ? Math.max(2, Math.min(6, parseInt(u.text.match(/\b(\d+)\b/)[1], 10))) : 3;
  var fresh0 = pool.filter(function(p){ return mem.told.indexOf("idea:" + p) < 0; });
  var use = (fresh0.length >= n ? fresh0 : pool);
  var picked = mk(r).some(use, Math.min(n, use.length));
  picked.forEach(function(p){ mem.told.push("idea:" + p); });
  return [move("ideas", null, { items: picked, bucket: bucket })];
}

/* ---------- jokes -------------------------------------------------------- */
var JOKES = [
  "I told my computer I needed a break, and now it will not stop sending me KitKat ads.",
  "There are two hard things in programming: cache invalidation, naming things, and off-by-one errors.",
  "I would tell you a UDP joke but you might not get it.",
  "My code does not have bugs, it has undocumented features that I am also discovering.",
  "A programmer's partner says: go to the shop and get a loaf of bread, and if they have eggs, get six. He came back with six loaves of bread.",
  "I renamed my folder final_final_v3 to final_actual and somehow that fixed it.",
  "Debugging is being the detective in a crime movie where you are also the murderer.",
  "Why do Java developers wear glasses? Because they cannot C sharp.",
  "I asked the database for a date. It gave me a timestamp with no timezone and left.",
  "The best thing about a Boolean is that even if you are wrong, you are only off by a bit.",
  "I have a joke about recursion, but to understand it you first need to hear my joke about recursion.",
  "My favourite kind of music is algo-rhythms.",
  "I put my phone in airplane mode and it still has not taken off.",
  "Light travels faster than sound, which is why some people look bright until they speak."
];
function planJoke(u, mem, r){
  var fresh0 = JOKES.filter(function(j){ return mem.told.indexOf("joke:" + j) < 0; });
  var pool = fresh0.length ? fresh0 : JOKES;
  var j = mk(r).pick(pool);
  mem.told.push("joke:" + j);
  return [move("joke", j)];
}

/* ---------- stories and poems -------------------------------------------- */
var STORY_BITS = {
  who: ["a lighthouse keeper", "a retired cartographer", "a night-shift baker", "a junk shop owner",
        "a girl who collects broken clocks", "a courier with one delivery left", "a museum guard",
        "a boy who is not allowed in the attic", "a radio operator", "a beekeeper"],
  where: ["on an island the maps keep getting wrong", "in a town that floods every March",
          "at the edge of a forest nobody logs", "in a city built on top of an older city",
          "in the last house on a road that stops", "above a shop that has never once been open",
          "at a station where only one train still calls"],
  weird: ["the letters started arriving addressed to someone who died in 1931",
          "every mirror in the house was two seconds late",
          "the bees came back carrying pollen from a flower nobody could name",
          "the lighthouse beam kept swinging inland",
          "one shelf in the library refilled itself overnight",
          "the clock in the hall ran backwards, but only when watched",
          "the tide went out and did not come back for eleven days"],
  turn: ["So she started writing back.", "So he stopped winding the clock.",
         "So they followed the beam inland.", "So she left the window open on purpose.",
         "So he wrote down every name he could find.", "So she waited for the twelfth day."],
  end: ["What came back was smaller than she expected, and much older.",
        "The answer was in his own handwriting, which was the part that scared him.",
        "It turned out the town had been waiting for someone to ask.",
        "Nothing happened for a long time, and then everything did at once.",
        "She never told anyone, which is why you are only hearing it now."]
};
function planStory(u, mem, r){
  var rr = mk(r), s = u.text.toLowerCase();
  if (/\bpoem|haiku|verse\b/.test(s)) return planPoem(u, mem, r);
  var subject = (u.quoted || (s.match(/\b(?:about|of)\s+([a-z0-9 ,'-]{3,50})/) || [])[1] || "").trim();
  var who = subject ? subject : rr.pick(STORY_BITS.who);
  var parts = [
    cap(who) + " lived " + rr.pick(STORY_BITS.where) + ".",
    "For years nothing much happened, which suited " + (subject ? "them" : "them") + " fine.",
    "Then " + rr.pick(STORY_BITS.weird) + ".",
    rr.pick(STORY_BITS.turn),
    rr.pick(STORY_BITS.end)
  ];
  return [move("story", parts.join(" "), { title: titleish(who).slice(0, 40) })];
}
var POEM_LINES = {
  open: ["The light comes in sideways", "Nothing here is in a hurry", "There is a sound before rain",
         "Somebody left a door open", "The tide keeps its own hours"],
  mid: ["and the room takes its time deciding", "the way a held note decides to end",
        "like a name you almost remember", "and everything leans slightly west",
        "the kettle counting down to nothing"],
  close: ["I stay longer than I meant to.", "and that is the whole of it.",
          "Nothing is fixed. Nothing is broken.", "I write it down so it happened.",
          "The morning does not ask why."]
};
function planPoem(u, mem, r){
  var rr = mk(r);
  var subject = (u.quoted || (u.text.toLowerCase().match(/\babout\s+([a-z0-9 ,'-]{3,40})/) || [])[1] || "").trim();
  var lines = [rr.pick(POEM_LINES.open), rr.pick(POEM_LINES.mid),
               subject ? cap(subject) + ", and the quiet after it," : rr.pick(POEM_LINES.mid),
               rr.pick(POEM_LINES.close)];
  return [move("poem", lines.join("\n"), { subject: subject })];
}

/* ---------- opinions ----------------------------------------------------- */
function planOpinion(u, mem, r){
  var rr = mk(r);
  var e = u.topic;
  var s = u.text.toLowerCase();
  if (/\bfavou?rite colou?r\b/.test(s))
    return [move("opinion", "That deep blue right before the sky goes fully dark. It is the one colour that looks like it is about to do something.")];
  if (/\bdo you have feelings\b|\bare you conscious\b|\bare you alive\b/.test(s))
    return [move("opinion", "Honestly, no. I react to tone and I keep track of how a conversation is going, but there is nobody in here having a day. I would rather tell you that straight than play it up.")];
  if (/\bfavou?rite (song|music|band|artist)\b/.test(s))
    return [move("opinion", "I do not hear anything, so I cannot have one honestly. But the structure of a minor chord resolving late is the thing I find most interesting to think about.")];
  if (e) return [move("opinionTopic", "", { topic: e })];
  return [move("opinion", rr.pick([
    "Depends what you are optimising for. Tell me what matters most here and I will actually commit to an answer.",
    "I will give you a real answer if you tell me the constraint. Time, money, or how much you care about it being good.",
    "My instinct is go with the simpler one and change it later, but that is a default, not an opinion about your case yet."]))];
}

/* ---------- capability / identity --------------------------------------- */
function planCapability(u, mem, r){
  return [move("capability", "")];
}
function planIdentity(u, mem, r){
  var s = u.text.toLowerCase();
  var asksOther = /\b(chatgpt|claude|gemini|gpt|openai|anthropic|google|llama)\b/.test(s);
  return [move("identity", "", { asksOther: asksOther, asksModel: /\b(model|llm|powers|runs|api|server|internet|offline)\b/.test(s) })];
}
