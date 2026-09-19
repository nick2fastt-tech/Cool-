/* ==========================================================================
   Understanding. Turns a raw message into a structured read of what the person
   said, how they said it and what they probably want back.
   ========================================================================== */

var CONTRACT = {
  "im": "i am", "ive": "i have", "ill": "i will", "id": "i would", "dont": "do not",
  "doesnt": "does not", "didnt": "did not", "cant": "can not", "couldnt": "could not",
  "wont": "will not", "wouldnt": "would not", "shouldnt": "should not", "isnt": "is not",
  "arent": "are not", "wasnt": "was not", "werent": "were not", "hasnt": "has not",
  "havent": "have not", "youre": "you are", "youve": "you have", "theyre": "they are",
  "thats": "that is", "whats": "what is", "hows": "how is", "wheres": "where is",
  "whos": "who is", "lets": "let us", "its": "it is", "theres": "there is",
  "gonna": "going to", "wanna": "want to", "gotta": "got to", "kinda": "kind of",
  "u": "you", "ur": "your", "r": "are", "y": "why", "k": "ok", "pls": "please",
  "plz": "please", "thx": "thanks", "ty": "thanks", "rn": "right now", "tbh": "to be honest",
  "idk": "i do not know", "imo": "in my opinion", "btw": "by the way", "abt": "about",
  "bc": "because", "cuz": "because", "bcuz": "because", "tho": "though", "thru": "through",
  "nvm": "never mind", "smth": "something", "sm": "so much", "prob": "probably",
  "def": "definitely", "fav": "favorite", "vid": "video", "pic": "picture", "pics": "pictures"
};

var SLANG = ("lol lmao lmfao bruh fr deadass ngl lowkey highkey bet nah yeah yea yup yep nope sus " +
  "vibe vibes goated mid cap bussin sheesh wild crazy insane tho rn fam bro dude " +
  "af tbh idk imo omg wtf smh damn dang yo sup wassup gimme dunno gotcha").split(" ");
var SLANG_SET = (function(){ var o = Object.create(null); SLANG.forEach(function(w){ o[w] = 1; }); return o; })();

/* "im tired" is a mood, "im nick" is an introduction. Only this short list of
   states stops a bare "im X" from being read as a name. */
var NOT_A_NAME = (function(){
  var o = Object.create(null);
  ("tired bored sad happy good fine ok okay great hungry thirsty busy back here sorry " +
   "confused lost stuck done ready new curious scared afraid angry mad excited sick ill " +
   "cold hot old young home out in on off up down late early free alone lonely broke rich " +
   "sure right wrong dumb stupid smart bad better worse well awake asleep drunk high low " +
   "working learning trying going coming thinking feeling doing making building writing " +
   "a an the not so very really just still always never dead dying crying laughing").split(" ")
    .forEach(function(w){ o[w] = 1; });
  return o;
})();

var QWORDS = { what: "what", whats: "what", how: "how", hows: "how", why: "why", when: "when",
               where: "where", wheres: "where", who: "who", whos: "who", which: "which",
               whom: "who", whose: "who" };

var IMPERATIVE = ("give tell show make write draw explain list name find help teach build create " +
  "generate describe compare suggest recommend fix debug summarize translate convert calculate").split(" ");
var IMP_SET = (function(){ var o = Object.create(null); IMPERATIVE.forEach(function(w){ o[w] = 1; }); return o; })();

function expand(toks){
  var out = [];
  for (var i = 0; i < toks.length; i++){
    var e = CONTRACT[toks[i]];
    if (e) out.push.apply(out, e.split(" "));
    else out.push(toks[i]);
  }
  return out;
}

/* ---------- intent ------------------------------------------------------- */
function intentScores(text, toks){
  var D = NM.D, FD = NM.featDim;
  var mean = zeroVec(), mx = zeroVec(), n = 0, t;
  for (var i = 0; i < toks.length; i++){
    var v = vecOf(toks[i]);
    if (!v) continue;
    for (t = 0; t < D; t++){
      mean[t] += v[t];
      if (Math.abs(v[t]) > Math.abs(mx[t])) mx[t] = v[t];
    }
    n++;
  }
  if (n) normalizeVec(mean);
  var uniq = Object.create(null);
  for (i = 0; i < toks.length; i++) uniq[normTok(toks[i])] = 1;
  var out = [];
  for (var c = 0; c < NM.intentNames.length; c++){
    var off = c * (FD + 1), s = NM.iw[off + FD];
    for (t = 0; t < D; t++) s += NM.iw[off + t] * mean[t];
    for (t = 0; t < D; t++) s += NM.iw[off + D + t] * mx[t];
    var lo = NM.itok[NM.intentNames[c]] || {};
    for (var w in uniq) if (lo[w]) s += 1.35 * lo[w];
    out.push({ name: NM.intentNames[c], score: s });
  }
  out.sort(function(a, b){ return b.score - a.score; });
  return out;
}

/* Hard rules beat the classifier when the wording is unambiguous. Short
   messages are mostly these, and getting them wrong is very visible. */
function intentRules(text, toks, u){
  var s = " " + toks.join(" ") + " ";
  var one = toks.length === 1 ? toks[0] : "";
  if (/^\s*(hi|hey+|hello+|yo+|sup|hiya|heya)\s*$/.test(s)) return "greet";
  if (/\b(good|gd) (morning|afternoon|evening)\b/.test(s)) return "greet";
  if (/^\s*(bye+|goodbye|cya|later|gtg|peace|goodnight|night)\s*$/.test(s)) return "bye";
  if (/\b(see (you|ya)|talk later|catch you later|going to bed|heading (out|off))\b/.test(s)) return "bye";
  if (/\bhow (are|r) (you|u|ya)\b|\bhows it going\b|\byou (good|ok|okay|alright)\b|\bhow you (doing|been)\b/.test(s)) return "howareyou";
  if (/^\s*(thanks|thank you|thx|ty|cheers|appreciate it)\b/.test(s)) return "thanks";
  if (/\b(who|what) (made|created|built|wrote|programmed|developed) (you|this|nanotech)\b/.test(s)) return "creator";
  if (/\byour creator\b|\bwho is nick\b/.test(s)) return "creator";
  if (/\b(who|what) are you\b|\bwhats your name\b|\byour name\b|\bare you (an? )?(ai|bot|robot|human|real|person|chatgpt|claude|gemini|gpt)\b/.test(s)) return "identity";
  if (/\bwhat (model|llm) are you\b|\bwhat (powers|runs) you\b|\bdo you (use|need) (an? )?(api|internet|server)\b/.test(s)) return "identity";
  if (/\bwhat can you do\b|\bwhat do you do\b|\bwhat are you good at\b|\bcan you (make|draw|create) (images?|pictures?|videos?)\b/.test(s)) return "capability";
  if (/\bhow do you work\b|\bwhat are your (features|abilities)\b/.test(s)) return "capability";
  if (/\bi ?a?m so+ bored\b|\bi ?a?m bored\b|^\s*bored\s*$|\bnothing to do\b|\bentertain me\b/.test(s)) return "user_bored";
  if (/\bi ?a?m (sad|upset|depressed|lonely|miserable|down|stressed|anxious|overwhelmed|worried)\b/.test(s)) return "user_sad";
  if (/\b(feeling|feel) (sad|down|bad|low|awful|terrible|lonely|lost|stuck)\b|\bbad day\b|\brough day\b|\beverything sucks\b/.test(s)) return "user_sad";
  if (/\bi ?a?m (tired|exhausted|sleepy|drained|knackered)\b|\bcan ?not sleep\b|\bcant sleep\b|\bdidnt sleep\b/.test(s)) return "user_tired";
  if (/\bi ?a?m (happy|great|good|fine|excited|hyped|stoked|proud|pumped)\b|\bbest day\b|\bi (passed|won|did it|got the job)\b/.test(s)) return "user_happy";
  if (/^\s*(lol+|lmao+|lmfao|haha+h?|hehe|rofl)\b/.test(s)) return "laugh";
  if (/\bthats (funny|hilarious|crazy|wild|insane)\b|\bim (dead|dying|crying)\b/.test(s)) return "laugh";
  if (/^\s*(tell me more|more|go on|keep going|continue|elaborate|and\?|then what|expand|go deeper|deeper|what else)\s*$/.test(s)) return "ask_more";
  if (/\b(tell me|say) more\b|\bmore (detail|about that)\b|\bexpand on (that|it)\b/.test(s)) return "ask_more";
  if (/\b(eli5|simpler|simply|simple terms|dumb it down|tldr|shorter|in one sentence|quick version)\b/.test(s)) return "ask_simpler";
  if (/\bexplain (it|that|this) (like|in) /.test(s) && /\b(five|5|simple|kid|child)\b/.test(s)) return "ask_simpler";
  if (/\b(give|show) me an example\b|^\s*(example|examples|like what|such as|name one)\s*$/.test(s)) return "ask_example";
  if (/^\s*who (is|was|are|were)\b/.test(s) && !/\b(you|your|nanotech|nick|nano)\b/.test(s)) return "ask_define";
  if (/\bwhat should i (build|make|learn|watch|read|play|do|try|study)\b/.test(s)) return "ask_list";
  if (/\bgive me (some )?(ideas?|options|suggestions)\b|\b(any|some) (ideas?|suggestions)\b|\bbrainstorm\b/.test(s)) return "ask_list";
  if (/\bwhat do you think\b|\byour (opinion|take)\b|\bdo you (like|prefer|agree)\b|\bwhats your favou?rite\b/.test(s)) return "ask_opinion";
  if (/\bwhich is better\b|\bwould you recommend\b|\bshould i\b/.test(s)) return "ask_opinion";
  if (/\bmy name is\b|\bcall me\b|\bi ?a?m called\b/.test(s)) return "meta_memory";
  if (/\bwhats my name\b|\bdo you remember\b|\bwhat did i (say|tell you)\b|\bdo you know me\b/.test(s)) return "meta_memory";
  if (/\bwhat (time|day|date|month|year) is it\b|\bwhats the (time|date)\b|\bwhats today\b|\btime now\b/.test(s)) return "time_date";
  if (/\btell me a joke\b|\bsay something funny\b|\bmake me laugh\b|\bgot any jokes\b|\banother joke\b|\broast me\b/.test(s)) return "request_joke";
  /* "tell me about X" is a question, not a request for fiction */
  if (/\b(tell me|teach me|talk to me) about\b/.test(s) && !/\bstory\b/.test(s)) return "ask_define";
  if (/^\s*(explain|describe|define)\b/.test(s) && toks.length > 2 && !/\b(simpler|again|that|it|this)\s*$/.test(s)) return "ask_define";
  if (/\bwhat(s| is| are)\b.*\b(made of|used for|good for)\b/.test(s)) return "ask_define";
  if (/\b(write|tell|make up) (me )?(a |an )?(story|poem|rap|song|haiku|limerick|lyrics|scene|tale)\b/.test(s)) return "request_story";
  if (/\b(write|show|give|need) (me )?(some |the )?(code|a function|a script|a class|a loop)\b/.test(s)) return "request_code";
  if (/\b(fix|debug) (my|this|the) (code|bug|function|script|error)\b/.test(s)) return "request_code";
  if (/\bhow do i (write|code|make|build) (a |an )?(function|loop|class|game|app|website|script)\b/.test(s)) return "request_code";
  if (/\bgive me (some )?(ideas?|options|suggestions)\b|\b(any|some) (ideas?|suggestions)\b|\bbrainstorm\b/.test(s)) return "ask_list";
  if (/\bwhat should i (build|make|learn|watch|read|play|do)\b|\brecommend (me )?something\b/.test(s)) return "ask_list";
  if (/\bhelp me\b|\bi need (help|advice)\b|\bi ?a?m stuck\b|\bcan you help\b|\bwalk me through\b/.test(s)) return "request_help";
  if (one && /^(yes|yeah|yep|yup|sure|ok|okay|alright|bet|exactly|correct|right|true|definitely|absolutely)$/.test(one)) return "affirm";
  if (one && /^(no|nope|nah|wrong|stop|incorrect)$/.test(one)) return "deny";
  if (/^\s*(what|huh|wat|come again|pardon)\s*$/.test(s) || /^\s*\?+\s*$/.test(text.trim())) return "confused";
  if (/\bwhat do you mean\b|\bmakes no sense\b|\bi dont (get|follow|understand)\b|\bwait what\b/.test(s)) return "confused";
  if (/\byou(re| are)? (dumb|stupid|useless|trash|broken|terrible|bad|awful)\b|\byou suck\b/.test(s)) return "insult";
  if (/\byou(re| are)? (smart|cool|funny|awesome|great|amazing|the best|good)\b|\bi like you\b|\bbest ai\b/.test(s)) return "compliment";
  if (/^\s*sorry\b|\bmy (bad|fault)\b|\bnever ?mind\b|^\s*(oops|nvm)\s*$/.test(s)) return "sorry";
  if (/\bi (really )?(like|love|enjoy|hate|dislike)\b/.test(s) && !/\b(story|poem|joke|code|image|video)\b/.test(s)) return "chitchat";
  if (/\bi ?a?m (building|making|working on|writing|coding|creating|developing)\b/.test(s)) return "chitchat";
  return "";
}

/* ---------- topic resolution against the knowledge base ------------------ */
var NON_TOPICAL = (function(){
  var o = Object.create(null);
  ("greet bye howareyou thanks sorry laugh affirm deny confused insult compliment " +
   "user_bored user_sad user_happy user_tired meta_memory time_date math request_joke " +
   "chitchat").split(" ").forEach(function(k){ o[k] = 1; });
  return o;
})();
var FOLLOW_UP_INTENT = { ask_more: 1, ask_simpler: 1, ask_example: 1, affirm: 1, confused: 1 };

/* Words that say what to do rather than what about. "explain" is rare enough
   in the corpus to look distinctive, and matching on it sent
   "explain quantum chromodynamics" to whichever topic happened to say
   "explain" somewhere. */
var TOPIC_STOP = (function(){
  var o = Object.create(null);
  ("explain explains explained describe describes define defines definition tell tells told " +
   "know knows mean means meaning work works working happen happens thing things stuff " +
   "want wants need needs think thinks say says said give gives get gets got make makes made " +
   "use uses used using call called actually really basically simple simply quick short long " +
   "good bad best better worse help helps please question answer about more less lot").split(" ")
    .forEach(function(w){ o[w] = 1; });
  return o;
})();

function findTopic(text, toks, content, allowVec){
  var joined = " " + toks.join(" ") + " ", best = null, bestScore = 0, bestCos = 0, bestOv = 0;
  for (var i = 0; i < NM.kb.length; i++){
    var e = NM.kb[i], sc = 0;
    for (var j = 0; j < e.names.length; j++){
      var nm = e.names[j], nt = nanoTokens(nm).join(" ");
      if (!nt) continue;
      if (joined.indexOf(" " + nt + " ") >= 0) sc = Math.max(sc, 3 + nt.length / 12);
    }
    if (sc > bestScore){ bestScore = sc; best = e; }
  }
  if (best) return { topic: best, score: bestScore, exact: true };
  if (allowVec === false) return { topic: null, score: 0, exact: false };

  // nothing named outright, so fall back to the vectors
  var v = sentVec(content.length ? content : toks);
  if (!v) return { topic: null, score: 0, exact: false };

  /* idf-weighted content words, so "sky" and "blue" carry the question */
  var want = Object.create(null), wantMass = 0, distinct = 0, oov = 0;
  for (i = 0; i < content.length; i++){
    var cw = normTok(content[i]);
    if (TOPIC_STOP[cw]) continue;
    var ci = NM.index[cw];
    if (ci === undefined){ oov++; continue; }
    var wgt = Math.max(0.3, NM.idf[ci]);
    want[cw] = wgt;
    wantMass += wgt;
    if (NM.idf[ci] > 3.2) distinct++;          // a word specific enough to identify a topic
  }
  /* "quantum chromodynamics" is two words we have never seen. Matching the
     leftovers to the nearest topic would be confident nonsense. */
  if (!distinct) return { topic: null, score: 0, exact: false };

  for (i = 0; i < NM.kb.length; i++){
    var e2 = NM.kb[i];
    if (!e2._v){
      var acc = zeroVec();
      addInto(acc, sentVec(nanoTokens(e2.names.join(" "))), 2.4);
      addInto(acc, sentVec(nanoTokens(e2.one)), 1.0);
      addInto(acc, sentVec(nanoTokens(e2.points.join(" "))), 0.55);
      e2._v = normalizeVec(acc);
      var bag = Object.create(null);
      nanoTokens(e2.names.join(" ") + " " + e2.one + " " + e2.points.join(" ") + " " + (e2.wow || "") + " " + (e2.like || ""))
        .forEach(function(t){ bag[normTok(t)] = 1; });
      e2._bag = bag;
    }
    var cos = dot(v, e2._v), overlap = 0;
    if (wantMass > 0){
      for (var w in want) if (e2._bag[w]) overlap += want[w];
      overlap /= wantMass;
    }
    var sc = cos * 0.62 + overlap * 0.58;
    if (sc > bestScore){ bestScore = sc; best = e2; bestCos = cos; bestOv = overlap; }
  }
  /* a weak lexical hit needs a strong vector hit to back it up */
  var good = bestScore >= 0.62 && (bestOv >= 0.24 || bestCos >= 0.66);
  return good ? { topic: best, score: bestScore, exact: false }
              : { topic: null, score: bestScore, exact: false };
}

/* ---------- the read ----------------------------------------------------- */
function understand(text, mem){
  var raw = String(text || "");
  var trimmed = raw.trim();
  var toks0 = nanoTokens(trimmed);
  var fixed = toks0.map(repairWord);
  var toks = expand(fixed);
  var content = contentWords(toks);
  var words = trimmed.split(/\s+/).filter(Boolean);

  var u = {
    raw: raw, text: trimmed, toks: toks, rawToks: toks0, content: content,
    words: words.length, chars: trimmed.length
  };

  /* --- surface signals --- */
  var letters = trimmed.replace(/[^A-Za-z]/g, "");
  var upper = trimmed.replace(/[^A-Z]/g, "").length;
  u.shouting = letters.length > 3 && upper / letters.length > 0.72;
  u.bangs = (trimmed.match(/!/g) || []).length;
  u.marks = (trimmed.match(/\?/g) || []).length;
  u.emoji = (raw.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
  u.slang = 0;
  for (var i = 0; i < toks0.length; i++) if (SLANG_SET[toks0[i]]) u.slang++;
  u.stretched = /([a-z])\1{2,}/i.test(trimmed);
  u.punctuated = /[.,;:]/.test(trimmed);
  u.hasCode = /```|function |=>|;\s*$|\bdef \b|<\w+>|\{\s*\n/.test(raw);

  /* --- question shape --- */
  u.isQuestion = u.marks > 0 || !!QWORDS[toks[0]] ||
    /^(is|are|was|were|do|does|did|can|could|will|would|should|have|has|am|may|might)\b/.test(toks.join(" "));
  u.qType = QWORDS[toks[0]] || "";
  if (!u.qType){
    for (i = 0; i < Math.min(4, toks.length); i++) if (QWORDS[toks[i]]){ u.qType = QWORDS[toks[i]]; break; }
  }
  if (!u.qType && u.isQuestion) u.qType = "yesno";
  u.imperative = IMP_SET[toks[0]] || (toks[0] === "can" && toks[1] === "you" && IMP_SET[toks[2]]) ||
                 (toks[0] === "please" && IMP_SET[toks[1]]);

  /* --- sentiment from the trained lexicon --- */
  var val = 0, aro = 0, hits = 0;
  for (i = 0; i < toks.length; i++){
    var id = NM.index[normTok(toks[i])];
    if (id === undefined) continue;
    var v = NM.valence[id], a = NM.arousal[id];
    if (Math.abs(v) > 0.12 || Math.abs(a) > 0.12){ val += v; aro += a; hits++; }
  }
  u.negated = /\b(not|no|never|dont|cant|wont|isnt|arent|hardly|barely)\b/.test(" " + toks.join(" ") + " ");
  if (hits){
    val /= hits; aro /= hits;
    if (u.negated) val *= -0.55;
  }
  u.valence = Math.max(-1, Math.min(1, val));
  u.arousal = Math.max(-1, Math.min(1, aro));

  /* --- energy: how loud and fast are they typing --- */
  u.energy = Math.max(0, Math.min(1,
    0.34 + u.bangs * 0.13 + (u.shouting ? 0.22 : 0) + u.slang * 0.1 +
    (u.stretched ? 0.13 : 0) + u.emoji * 0.06 + Math.max(0, u.arousal) * 0.2 -
    (u.words > 28 ? 0.1 : 0)));

  /* --- register: how they write is how we should write back --- */
  var casual = u.slang * 2 + (u.stretched ? 2 : 0) + u.emoji + (u.shouting ? 1 : 0) +
               (u.words <= 6 ? 1 : 0) + (u.punctuated ? 0 : 1);
  var formal = (u.punctuated ? 1 : 0) + (u.words > 16 ? 2 : 0) + (u.hasCode ? 2 : 0) +
               (/\b(please|could you|would you|kindly|regarding|therefore|however)\b/.test(" " + toks.join(" ")) ? 2 : 0);
  u.register = casual >= formal + 2 ? "casual" : formal >= casual + 2 ? "focused" : "neutral";

  /* --- how much of this do we actually recognise --- */
  var known = 0;
  for (i = 0; i < toks.length; i++) if (NM.index[normTok(toks[i])] !== undefined) known++;
  u.known = known;
  u.noSignal = toks.length === 0 || known === 0 ||
               (toks.length <= 4 && known / toks.length < 0.34) ||
               /^(.)\1{4,}$/.test(trimmed.replace(/\s/g, ""));

  /* --- intent --- */
  var ranked = intentScores(trimmed, fixed);
  u.intents = ranked;
  var ruled = intentRules(trimmed, toks, u);
  u.intent = ruled || ranked[0].name;
  u.ruled = !!ruled;
  u.intentScore = ruled ? 9 : ranked[0].score;
  u.confident = u.ruled || (ranked[0].score - ranked[1].score) > 0.9;

  /* --- topic ---
     Social turns and pure follow-ups must not move the topic, or "tell me more"
     after a black hole answer drifts onto whatever the greeting looked like. */
  if (NON_TOPICAL[u.intent]){
    u.topic = null; u.topicScore = 0; u.topicExact = false;
  } else {
    var allowVec = !FOLLOW_UP_INTENT[u.intent] && content.length >= 1;
    var t = findTopic(trimmed, toks, content, allowVec);
    u.topic = t.topic; u.topicScore = t.score; u.topicExact = t.exact;
  }
  u.vec = sentVec(content.length ? content : toks);

  /* --- entities --- */
  u.numbers = (trimmed.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  u.quoted = (raw.match(/"([^"]{1,120})"/) || [])[1] || "";
  var nameM = raw.match(/\b(?:my name is|call me|i ?a?m called|this is)\s+([A-Za-z][A-Za-z'-]{1,20})/i);
  /* "im nick" is how people actually introduce themselves. Only take it when
     the word is not something we already know as an ordinary word. */
  if (!nameM){
    var im = raw.match(/^\s*(?:im|i'?m|i am|its|it'?s)\s+([A-Za-z][A-Za-z'-]{1,18})\s*[.!]?\s*$/i);
    if (im && !NOT_A_NAME[im[1].toLowerCase()]) nameM = im;
  }
  u.givenName = nameM ? cap(nameM[1].toLowerCase()) : "";
  var likeM = raw.match(/\bi (?:really )?(like|love|enjoy|hate|dislike)\s+([a-z0-9 ,'-]{2,44})/i);
  u.likes = likeM ? { verb: likeM[1].toLowerCase(), what: likeM[2].trim().replace(/[.!?,]+$/, "") } : null;
  var projM = raw.match(/\bi ?a?m (?:building|making|working on|writing|coding|creating|developing)\s+([a-z0-9 ,'-]{2,50})/i);
  u.project = projM ? projM[1].trim().replace(/[.!?,]+$/, "") : "";

  /* --- depth cues --- */
  u.wantsDepth = u.intent === "ask_more" || /\b(in depth|detailed|thoroughly|everything|full|deep dive|properly)\b/.test(" " + toks.join(" "));
  u.wantsBrief = u.intent === "ask_simpler" || /\b(quick|short|brief|tldr|one sentence|simply|just)\b/.test(" " + toks.join(" "));
  u.followUp = toks.length <= 4 && !u.topic && !!(mem && mem.topic) &&
               /^(ask_more|affirm|ask_example|ask_simpler|confused|ask_why|ask_how)$/.test(u.intent);
  return u;
}
