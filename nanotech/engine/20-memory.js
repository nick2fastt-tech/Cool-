/* ==========================================================================
   Dialogue memory. What NanoTech carries between turns so it does not ask you
   the same thing twice or open three replies in a row the same way.
   ========================================================================== */
function newMemory(){
  return {
    name: "",              // what to call them
    likes: [],             // things they said they like
    dislikes: [],
    projects: [],          // what they are building
    facts: [],             // other volunteered statements
    topic: null,           // knowledge entry currently under discussion
    topicDepth: 0,         // how much of it we have already said
    topicUsed: [],         // which points we already used
    lastIntent: "",
    lastReply: "",
    turns: 0,
    mood: 0,               // slow-moving average of their valence
    energy: 0.4,
    register: "neutral",
    openers: [],           // recent sentence openers, to avoid repeats
    phrases: [],           // recent whole phrases, same reason
    asked: [],             // questions we already asked them
    greeted: false,
    told: []               // joke/story ids already used
  };
}

function memRemember(mem, u){
  mem.turns++;
  mem.lastIntent = u.intent;
  mem.mood = mem.turns < 2 ? u.valence : mem.mood * 0.65 + u.valence * 0.35;
  mem.energy = mem.energy * 0.6 + u.energy * 0.4;
  if (u.register !== "neutral") mem.register = u.register;

  if (u.givenName) mem.name = u.givenName;
  if (u.likes){
    var bucket = /hate|dislike/.test(u.likes.verb) ? mem.dislikes : mem.likes;
    if (bucket.indexOf(u.likes.what) < 0 && u.likes.what.length < 46) bucket.push(u.likes.what);
    if (bucket.length > 8) bucket.shift();
  }
  if (u.project && mem.projects.indexOf(u.project) < 0){
    mem.projects.push(u.project);
    if (mem.projects.length > 5) mem.projects.shift();
  }
  if (u.topic){
    if (!mem.topic || mem.topic.id !== u.topic.id){ mem.topic = u.topic; mem.topicDepth = 0; mem.topicUsed = []; }
  }
}

/* Anti-repetition. Every response picks from a pool; this keeps the pool from
   handing back what it just handed back. */
function fresh(mem, key, pool, r){
  var recent = mem.phrases;
  var open = [];
  for (var i = 0; i < pool.length; i++){
    var p = pool[i], tag = key + "|" + p;
    if (recent.indexOf(tag) < 0) open.push(p);
  }
  var use = open.length ? open : pool;
  var choice = use[Math.floor((r ? r() : Math.random()) * use.length)];
  mem.phrases.push(key + "|" + choice);
  if (mem.phrases.length > 26) mem.phrases.shift();
  return choice;
}

function usedOpener(mem, word){
  if (!word) return false;
  return mem.openers.indexOf(word.toLowerCase()) >= 0;
}
function noteOpener(mem, word){
  if (!word) return;
  mem.openers.push(String(word).toLowerCase());
  if (mem.openers.length > 6) mem.openers.shift();
}
function nextUnusedPoint(mem, topic){
  if (!topic) return -1;
  for (var i = 0; i < topic.points.length; i++) if (mem.topicUsed.indexOf(i) < 0) return i;
  return -1;
}
function markPoints(mem, idxs){
  idxs.forEach(function(i){ if (mem.topicUsed.indexOf(i) < 0) mem.topicUsed.push(i); });
}
