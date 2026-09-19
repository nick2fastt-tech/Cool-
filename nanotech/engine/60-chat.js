/* ==========================================================================
   The reply pipeline. understand -> route -> plan -> realize -> stream.
   ========================================================================== */

var NanoChat = (function(){
  var mem = newMemory();

  function reset(){ mem = newMemory(); }

  /* Rebuild state from the transcript, so reopening an old chat still knows
     your name and what we were talking about. */
  function sync(turns){
    var users = turns.filter(function(t){ return t.role === "user"; });
    if (mem.turns === Math.max(0, users.length - 1)) return;
    mem = newMemory();
    for (var i = 0; i < users.length - 1; i++){
      var c = users[i].content;
      if (typeof c !== "string" || !c) continue;
      try { memRemember(mem, understand(c, mem)); } catch (e) {}
    }
  }

  function depthFor(u, opts){
    var tier = opts.modelTier || "default";
    var base = tier === "complex" ? 2 : tier === "quick" ? 0 : 1;
    if (u.wantsDepth) base = 2;
    if (u.wantsBrief) base = 0;
    if (u.intent === "ask_simpler") base = 0;
    if (u.words > 22 && base < 1) base = 1;
    if ((u.intent === "ask_define" || u.intent === "ask_how" || u.intent === "ask_why") && base < 1) base = 1;
    return Math.max(0, Math.min(2, base));
  }

  /* ---------- skills that should answer before anything else ------------- */
  function skillPlan(u, mem, r, v){
    var m = doMath(u.text);
    if (m){
      if (!m.ok) return [move("line", m.why)];
      var val = fmtNum(m.value);
      var plan = [move("math", "", { shown: m.shown, note: m.note, value: val })];
      if (v.short && !m.note) plan = [move("line", spice("**" + val + "**", v, "laugh", r))];
      return plan;
    }
    var c = doConvert(u.text);
    if (c){
      var pretty = fmtNum(Math.round(c.value * 1e6) / 1e6);
      return [move("line", "**" + c.from + " = " + pretty + " " + c.to + "**")];
    }
    var t = doTime(u.text);
    if (t && u.intent === "time_date"){
      if (t.kind === "time") return [move("line", "It's **" + t.text + "** right now. " + t.date + ".")];
      if (t.kind === "until") return [move("line", "**" + t.text + "** until midnight.")];
      return [move("line", "**" + t.text + "**")];
    }
    var ct = doCount(u.text);
    if (ct) return [move("line", "**" + ct.n + "** " + plural(ct.n, ct.kind.replace(/s$/, "")) +
                    " in “" + ct.subject + "”.")];
    var nf = doNumberFact(u.text);
    if (nf){
      if (nf.factors) return [move("line", "The factors of **" + nf.of + "** are " + nf.factors.join(", ") + ".")];
      return [move("line", (nf.yes ? "Yes, " + nf.q : "No, " + (nf.no || nf.q)) +
                           (nf.why ? " — " + nf.why : "") + ".")];
    }
    var rd = doRandom(u.text);
    if (rd){
      if (rd.kind === "coin") return [move("line", "**" + cap(rd.side) + "**.")];
      if (rd.kind === "number") return [move("line", "**" + rd.value + "** (between " + rd.lo + " and " + rd.hi + ").")];
      return [move("line", rd.rolls.length > 1
        ? "Rolled " + rd.rolls.join(", ") + " — **" + rd.total + "** total."
        : "**" + rd.rolls[0] + "** on a d" + rd.sides + ".")];
    }
    return null;
  }

  /* ---------- conversational routes -------------------------------------- */
  function socialPlan(u, mem, r, v){
    var I = u.intent, rr = mk(r);
    function say(pool, kind){ return [move("line", spice(fresh(mem, I, pool, r), v, kind || "warm", r))]; }

    if (I === "greet"){
      if (mem.name && rr.chance(0.6))
        return [move("line", fresh(mem, "greetNamed", SAY.greetNamed, r).replace("{name}", mem.name))];
      if (mem.turns > 1) return say(SAY.greetBack);
      mem.greeted = true;
      return say(SAY.greet);
    }
    if (I === "bye"){
      var night = /\b(night|goodnight|bed|sleep)\b/.test(u.text.toLowerCase());
      return say(night ? SAY.byeNight : SAY.bye);
    }
    if (I === "howareyou"){
      var line = fresh(mem, "how", SAY.how, r);
      if (mem.projects.length && rr.chance(0.45))
        line = "Good. How's " + mem.projects[mem.projects.length - 1] + " coming along?";
      return [move("line", line)];
    }
    if (I === "thanks") return say(SAY.thanks, "warm");
    if (I === "sorry") return say(SAY.sorryBack);
    if (I === "laugh") return say(SAY.laugh, "laugh");
    if (I === "affirm") return say(SAY.affirm, "up");
    if (I === "deny") return say(SAY.deny);
    if (I === "confused") return say(SAY.confused);
    if (I === "insult") return say(SAY.insult);
    if (I === "compliment") return say(SAY.compliment, "warm");
    if (I === "user_bored") return say(SAY.bored, "laugh");
    if (I === "user_sad") return say(SAY.sad, "soft");
    if (I === "user_tired") return say(SAY.tired, "soft");
    if (I === "user_happy") return say(SAY.happy, "up");
    return null;
  }

  function memoryPlan(u, mem, r, v){
    var s = u.text.toLowerCase(), rr = mk(r);
    if (u.givenName)
      return [move("line", fresh(mem, "gotname", [
        "Got it, " + u.givenName + ". I'll remember that.",
        "Nice to meet you " + u.givenName + ". What are we doing?",
        u.givenName + " it is. What's up?"], r))];
    if (/\bwhats my name\b|\bdo you know my name\b/.test(s))
      return [move("line", mem.name
        ? "You're " + mem.name + "."
        : "You haven't told me yet. Say “my name is ...” and it'll stick for this chat.")];
    if (/\bdo you remember\b|\bwhat did i (say|tell you)\b|\bdo you know me\b/.test(s)){
      var bits = [];
      if (mem.name) bits.push("you're " + mem.name);
      if (mem.likes.length) bits.push("you like " + oxford(mem.likes.slice(-3)));
      if (mem.projects.length) bits.push("you're working on " + mem.projects[mem.projects.length - 1]);
      if (mem.topic) bits.push("we were on " + mem.topic.names[0]);
      return [move("line", bits.length
        ? "Within this chat, yeah: " + oxford(bits) + ". Fresh chat and it's gone though."
        : "Only inside this chat, and you haven't told me much yet. Start a new chat and I forget everything.")];
    }
    if (/\bforget (that|it|everything)\b/.test(s)){
      mem.likes = []; mem.dislikes = []; mem.facts = []; mem.topic = null;
      return [move("line", "Done, dropped it.")];
    }
    return null;
  }

  function chitchatPlan(u, mem, r, v){
    var rr = mk(r);
    if (u.likes){
      var what = u.likes.what;
      if (/hate|dislike/.test(u.likes.verb))
        return [move("line", fresh(mem, "dislike", [
          "Fair enough. What is it about " + what + " that gets you?",
          "Noted. Anything about " + what + " you'd keep?",
          "Honest. What would make it better?"], r))];
      return [move("line", fresh(mem, "like", [
        "Oh you like " + what + "? What's the best part about it?",
        cap(what) + " is a good one. How'd you get into it?",
        "Nice. What is it about " + what + " that does it for you?",
        "Respect. How long have you been into " + what + "?"], r))];
    }
    if (u.project)
      return [move("line", fresh(mem, "proj", [
        "Oh nice, " + u.project + ". How far in are you?",
        cap(u.project) + " is a solid one. What's the part giving you trouble?",
        "Let's go. What's the current blocker on " + u.project + "?"], r))];
    return null;
  }

  /* When there's genuinely no hook, keep the conversation moving instead of
     filling space. This is the last resort, not the default. */
  function fallbackPlan(u, mem, r, v){
    var rr = mk(r);
    /* "explain X" has no question mark and no question word, but it is still
       someone asking for something we either know or should admit we do not. */
    var asking = u.isQuestion || u.imperative ||
                 /^(ask_define|ask_how|ask_why|ask_example)$/.test(u.intent);
    if (asking){
      var subj = topicPhrase(u);
      var plan = [move("dunno", subj)];
      var near = nearestTopic(u);
      if (near && near.score > 0.42) plan.push(move("offerNear", near.topic.names[0]));
      else plan.push(move("line", fresh(mem, "cando", [
        "What I am good for: explaining science and tech, exact maths, code you can run, and drawing whatever you describe.",
        "Where I'm actually useful is science, tech, code, maths and making pictures and videos. Any of those?"], r)));
      return plan;
    }
    var content = u.content.slice(0, 3).join(" ");
    return [move("line", fresh(mem, "openq", [
      content ? "Tell me a bit more about " + content + " and I'll have something useful to say." 
              : "Say a bit more and I'll pick it up.",
      "I want to give you something real rather than filler — what's the actual question?",
      "Go on, what's the angle you care about?"], r))];
  }

  /* ---------- router ----------------------------------------------------- */
  function plan(u, opts){
    var r = rng(hashStr(u.text + "|" + mem.turns + "|" + (opts.seed || 0)));
    var v = voiceOf(u, mem);
    var depth = depthFor(u, opts);
    var I = u.intent;

    /* Nothing recognisable came through. Say so rather than picking whichever
       intent scored highest on noise. */
    if (u.noSignal && !u.ruled){
      return { plan: [move("line", fresh(mem, "nosignal", [
        "I didn't catch that one. Say it again?",
        "That didn't parse for me. What are you after?",
        "Hmm, nothing I can work with there. Try it in a few words?",
        "Lost me. What do you want to do?"], r))], v: v };
    }

    var p = memoryPlan(u, mem, r, v);            if (p) return { plan: p, v: v };
    p = skillPlan(u, mem, r, v);                 if (p) return { plan: p, v: v };
    p = socialPlan(u, mem, r, v);                if (p) return { plan: p, v: v };
    if (u.likes || u.project){ p = chitchatPlan(u, mem, r, v); if (p) return { plan: p, v: v }; }

    if (I === "identity")   return { plan: planIdentity(u, mem, r), v: v };
    if (I === "creator")    return { plan: [move("line", fresh(mem, "creator", [
      "Nick built me. Whole thing, model and app.",
      "Nick made me — this is his model, not a wrapper around someone else's.",
      "Nick. He wrote the model, the art engine and the app it lives in."], r))], v: v };
    if (I === "capability") return { plan: planCapability(u, mem, r), v: v };
    if (I === "request_joke")  return { plan: planJoke(u, mem, r), v: v };
    if (I === "request_story") return { plan: planStory(u, mem, r), v: v };
    if (I === "ask_list")      return { plan: planIdeas(u, mem, r), v: v };

    if (I === "request_code" || /\bcode\b/.test(u.text.toLowerCase())){
      var cp = planCode(u, mem, r);
      if (cp) return { plan: cp, v: v };
    }
    if (I === "ask_opinion"){
      var op = planOpinion(u, mem, r);
      if (op) return { plan: op, v: v };
    }
    if (I === "request_help"){
      var hp = planCode(u, mem, r);
      if (hp) return { plan: hp, v: v };
      if (u.topic) return { plan: planTopic(u, mem, r, depth), v: v };
      return { plan: [move("line", fresh(mem, "help", [
        "Yeah, absolutely. Tell me what you're trying to make and what you're building it with.",
        "I'm in. What's the goal, and what have you got so far?",
        "Sure. Give me the specifics: what it is, and where it's stuck."], r))], v: v };
    }

    /* knowledge questions, and follow-ups on the current topic */
    if (u.topic || (u.followUp && mem.topic)){
      var kp = planTopic(u, mem, r, depth);
      if (kp) return { plan: kp, v: v };
    }
    /* "more" and "simpler" only mean a follow-up when the message is short.
       "explain quantum chromodynamics" is a new question, not a follow-up. */
    if ((I === "ask_more" || I === "ask_example" || I === "ask_simpler") && u.content.length <= 2){
      if (mem.topic){
        var mp = planTopic(u, mem, r, I === "ask_simpler" ? 0 : Math.max(1, depth));
        if (mp) return { plan: mp, v: v };
      }
      return { plan: [move("line", "More about what? Name the thing and I'll go deeper.")], v: v };
    }

    p = chitchatPlan(u, mem, r, v);              if (p) return { plan: p, v: v };
    return { plan: fallbackPlan(u, mem, r, v), v: v };
  }

  /* ---------- public: generate a reply ----------------------------------- */
  function reply(turns, opts){
    opts = opts || {};
    sync(turns);
    var last = null;
    for (var i = turns.length - 1; i >= 0; i--) if (turns[i].role === "user"){ last = turns[i]; break; }
    var text = last ? String(last.content || "") : "";
    var u = understand(text, mem);
    var res = plan(u, opts);
    var r = rng(hashStr(text + "|out|" + mem.turns));
    var body = realize(res.plan, u, mem, r, res.v);
    if (!body || !body.trim()) body = "Say that again? I want to give you something useful.";

    /* tail moves: a follow-up offer, but not every single turn */
    var meta = res.plan.filter(function(m){ return m.kind === "meta"; })[0];
    if (meta && meta.left > 0 && res.v.emojiBudget >= 0 && !res.v.short && mk(r).chance(0.5) &&
        !/\?\s*$/.test(body))
      body += "\n\n" + fresh(mem, "offer", SAY.offerMore, r);

    memRemember(mem, u);
    mem.lastReply = body;
    return { text: body, u: u, plan: res.plan };
  }

  return { reply: reply, reset: reset, mem: function(){ return mem; } };
})();
