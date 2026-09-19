/* ==========================================================================
   Voice. Turns a plan into words, in a register that matches how the person
   is writing. Every pool goes through fresh() so nothing repeats back to back.
   ========================================================================== */

var EMO = {
  laugh: ["😭", "💀", "😂"],
  warm:  ["🙏", "✨", "🙌"],
  up:    ["🔥", "⚡", "🚀"],
  soft:  ["🫡", "☁️"],
  think: ["🤔"],
  art:   ["✨", "🎨"],
  film:  ["🎬"]
};

/* How much decoration a reply gets, from how they wrote to us. */
function voiceOf(u, mem){
  var casual = u.register === "casual" || (u.register === "neutral" && mem.register === "casual");
  var focused = u.register === "focused" || u.hasCode;
  return {
    casual: casual && !focused,
    focused: focused,
    emojiBudget: focused ? 0 : (casual ? (u.emoji > 0 || u.slang > 0 ? 1 : (mem.turns % 3 === 0 ? 1 : 0)) : 0),
    short: u.words <= 7 && !u.wantsDepth,
    energy: u.energy,
    mood: u.valence
  };
}
var HAS_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
function spice(text, v, kind, r){
  if (v.emojiBudget <= 0) return text;
  if (HAS_EMOJI.test(text)) return text;      // the line already carries one
  var pool = EMO[kind] || EMO.warm;
  v.emojiBudget--;
  return text.replace(/\s+$/, "") + " " + pool[Math.floor(r() * pool.length)];
}

/* ---------- pools -------------------------------------------------------- */
var SAY = {
greet: ["Hey! What's up?", "Yo, what's good?", "Hey, what's on your mind?", "Hey there. What are we doing today?",
        "Sup. What do you need?", "Hey! What are you working on?", "Yo. What's happening?"],
greetBack: ["Hey again. What's up?", "Back already, nice. What's next?", "Yo, welcome back. Where were we?",
            "Hey. Picking up where we left off?"],
greetNamed: ["Hey {name}! What's up?", "Yo {name}, what's good?", "Hey {name}. What are we building today?"],
bye: ["Later! 👋", "See you. Come back whenever.", "Peace. Good luck with it.",
      "Catch you later.", "Alright, later. Go do something good."],
byeNight: ["Night! Actually sleep though.", "Goodnight. Put the phone down 😂", "Sleep well. See you tomorrow."],
how: ["I'm doing good 😭 What about you?", "Pretty good honestly. How about you?",
      "Can't complain. How's your day going?", "I'm good. What's going on with you?",
      "Doing alright. You good?"],
thanks: ["Anytime 🙏", "No problem at all.", "Anytime. Ping me if it breaks.",
         "Course. Come back if you get stuck.", "Happy to. Good luck with it."],
sorryBack: ["You're good, no stress.", "All good. What did you mean?", "No worries. Say it again?",
            "Nah you're fine. Go ahead."],
laugh: ["😭 right?", "Nahh that's actually funny.", "💀 okay that got me.",
        "Glad someone thinks so.", "I know 😭"],
affirm: ["Bet. What first?", "Alright, let's go. Where do you want to start?",
         "Cool. Give me the details.", "Say the word and I'll start."],
deny: ["Fair. What did you actually want?", "Got it, my read was off. What are you after?",
       "Okay, scrap that. Tell me the real target.", "Alright. Point me at the right thing."],
confused: ["Yeah that was on me. Which part do you want me to redo?",
           "Let me try that again. What bit lost you?",
           "Fair, that was mushy. Say which part and I'll be specific.",
           "My bad. Ask it again however feels natural and I'll match it."],
insult: ["Fair, that one was bad. Tell me what you actually needed and I'll do it properly.",
         "Okay, that's on me. What was the answer supposed to be?",
         "Noted. Give me the real question and I'll take another run at it."],
compliment: ["Appreciate that 🙏 What's next?", "I'll take it. What are we doing?",
             "Thanks. Keep going, this is the fun part.", "Ha, thanks. Alright, what else?"],
bored: ["Nahhh 😭 what are you trying to do?", "Okay, bored is fixable. Do you want to make something or just be entertained?",
        "Bored is a choice and I'm here to fix it. Building, drawing, or reading?",
        "Say the word and I'll throw ideas at you. Game, story, or picture?"],
sad: ["That sounds rough, I'm sorry. Do you want to talk about it or would a distraction land better?",
      "Ah that's genuinely hard. What happened?",
      "Sorry, that sucks. Want to get into it, or want me to just take your mind off it?",
      "That's a lot. I'm here either way. What's going on?"],
tired: ["Yeah you sound wrecked. Anything actually keeping you up?",
        "That's rough. Is it one thing on your mind or just everything?",
        "Sounds like you need a night off. What's still open in your head?"],
happy: ["Let's go 🔥 what happened?", "Okay that's great, tell me.",
        "Love that. What was it?", "Big. What's the story?"],
noMath: ["That one I can't work out from what's there. Write it as a sum and I'll do it exactly.",
         "Give me the actual numbers and I'll run it."],
offerMore: ["Want me to go deeper on any part of that?", "Want the longer version?",
            "I can go further into any of that if you want.", "Say the word if you want more detail."],
offerNext: ["What do you want to do with it?", "Where do you want to take it?",
            "Want me to keep going?", "Anything you want changed?"],
askBack: ["What made you curious about it?", "Is this for something you're building?",
          "What got you onto that?", "Any particular angle you care about?"]
};

var LINKS = ["Also,", "And", "On top of that,", "The other thing is,", "Plus,", "Beyond that,"];
var LEADINS = { def: ["So,", "Basically,", "Short version:", "Okay so,"],
                fact: ["", "", ""],
                analogy: ["Think of it like", "Closest thing is", "Picture", "It's basically"],
                wow: ["Fun one:", "Also wild:", "The part I like:", "Random but:"] };

function joinBody(parts){
  return parts.filter(function(p){ return p && p.trim(); }).join("\n\n");
}

/* ---------- capability and identity copy --------------------------------- */
function capabilityText(v, r, mem){
  var lines = [
    "Chat about pretty much anything, and I actually remember what you told me earlier in the conversation.",
    "Explain things properly, from black holes to how a game loop works, and go as deep or as short as you want.",
    "Do exact maths, unit conversions, dates, counting, that kind of thing.",
    "Write code you can paste and run, in JavaScript, Python, HTML or CSS.",
    "Make images and videos. Just ask, like \"draw a dragon\" or \"make a video of a rocket launch\"."
  ];
  return "Here's the real list:\n\n" + lines.map(function(l){ return "- " + l; }).join("\n") +
         "\n\nAll of it runs right here on your device, so none of it needs internet. What do you want to try?";
}
function identityText(m, v, r, mem){
  if (m.asksOther)
    return "Nope, none of those. I'm NanoTech, Nick's own model. Different brain, different everything — there's no outside service involved at any point.";
  if (m.asksModel)
    return "I'm NanoTech, running entirely inside this file. My understanding layer uses word vectors that were trained in Python and packed into the page, and the pictures are drawn by a procedural SVG engine. No server, no API call out, works with your wifi off.";
  var pool = [
    "I'm NanoTech. Nick built me, and I run completely on your device — no server, no internet needed.",
    "NanoTech. Nick's model. I live entirely in this one file, which is a weird thing to be but here we are.",
    "I'm NanoTech, made by Nick. Everything I do happens locally, right here."
  ];
  return fresh(mem, "identity", pool, r);
}

/* ---------- the realizer ------------------------------------------------- */
function realize(plan, u, mem, r, v){
  var out = [], rr = mk(r), linkCount = 0;

  for (var i = 0; i < plan.length; i++){
    var m = plan[i];
    switch (m.kind){

    case "raw":
      out.push(m.text); break;

    case "def": {
      var lead = v.short ? "" : fresh(mem, "deflead", LEADINS.def, r);
      if (usedOpener(mem, lead)) lead = "";
      noteOpener(mem, lead);
      var art = m.art === undefined ? "" : m.art;
      var name = m.subject || "it";
      var subj = (art ? art + " " + name : name);
      var body = m.text;
      out.push(lead ? lead + " " + subj + " is " + body + "."
                    : cap(subj) + " is " + body + ".");
      // "So, a black hole is ..." keeps the leadin's comma doing the work
      break;
    }

    case "fact": {
      var pre = "";
      if (linkCount > 0 && rr.chance(0.5)) pre = fresh(mem, "link", LINKS, r) + " ";
      linkCount++;
      out.push(pre ? pre + m.text.charAt(0).toLowerCase() + m.text.slice(1) : m.text);
      break;
    }

    case "bullets":
      out.push(m.items.map(function(t){ return "- " + t; }).join("\n"));
      break;

    case "analogy":
      out.push(fresh(mem, "analead", LEADINS.analogy, r) + " " + m.text + ".");
      break;

    case "wow":
      out.push(fresh(mem, "wowlead", LEADINS.wow, r) + " " + m.text);
      break;

    case "code":
      out.push("```" + m.lang + "\n" + m.text + "\n```");
      if (m.why) out.push(m.why);
      break;

    case "ideas": {
      var head = fresh(mem, "ideahead", [
        "Alright, off the top of my head:", "A few to pick from:", "Here's three that could go somewhere:",
        "Some starting points:"], r);
      out.push(head + "\n" + m.items.map(function(t){ return "- " + cap(t); }).join("\n"));
      out.push(fresh(mem, "ideatail", [
        "Want me to build one of those out properly?", "Say which one and I'll go deeper on it.",
        "Pick one and I'll help you scope it."], r));
      break;
    }

    case "joke":
      out.push(m.text); break;

    case "story":
      out.push((m.title ? "**" + titleish(m.title) + "**\n\n" : "") + m.text);
      out.push(fresh(mem, "storytail", ["Want it longer, or a different tone?",
        "I can keep going from there if you want.", "Want me to take it somewhere darker or lighter?"], r));
      break;

    case "poem":
      out.push(m.text); break;

    case "opinion":
      out.push(m.text); break;

    case "opinionTopic": {
      var e = m.topic;
      out.push(fresh(mem, "opt", [
        "Honestly? The part of it I find most interesting is this:",
        "If I have to pick an angle:", "The bit worth caring about:"], r) + " " + e.points[0]);
      if (e.like) out.push("Think of it like " + e.like + ".");
      break;
    }

    case "dunno": {
      var what = m.text ? "“" + m.text + "”" : "that";
      out.push(fresh(mem, "dunno", [
        "I genuinely don't know " + what + ", and I'd rather say that than make something up.",
        "That one's outside what I actually know. I could guess but it wouldn't be worth much.",
        "Honestly, no idea on " + what + ". I don't want to invent an answer."], r));
      break;
    }

    case "offerNear":
      out.push("I do know a decent amount about " + m.text + " though, if that's close enough — want that instead?");
      break;

    case "capability":
      out.push(capabilityText(v, r, mem)); break;

    case "identity":
      out.push(identityText(m, v, r, mem)); break;

    case "math": {
      var line = "**" + m.shown + "**" + (m.note ? " — " + m.note : "");
      out.push(v.short && !m.note ? "**" + m.value + "**" : line + "\n\n= **" + m.value + "**");
      break;
    }

    case "line":
      out.push(m.text); break;

    case "ask":
      out.push(m.text); break;

    case "meta":
      break;
    }
  }
  return joinBody(out);
}
