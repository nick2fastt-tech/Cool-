# -*- coding: utf-8 -*-
"""Builds NanoTech.html: one self-contained file, model and all.

Takes shell.html (the app shell), swaps every third-party brain out for the
NanoTech engine, and inlines the trained model plus the engine sources.

    python3 nanotech/build.py
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SHELL = os.path.join(HERE, "shell.html")
OUT = os.path.join(ROOT, "NanoTech.html")

ENGINE = ["00-core", "10-nlu", "20-memory", "30-skills", "40-answer", "50-voice",
          "60-chat", "80-visual", "82-draw", "83-forms", "84-scene", "86-image",
          "88-video", "95-api"]

applied = []


def cut(lines, start_marker, end_marker, new_text, label):
    """Replace the block from the line containing start_marker up to (not
    including) the line containing end_marker."""
    a = b = None
    for i, l in enumerate(lines):
        if a is None and start_marker in l:
            a = i
        elif a is not None and end_marker in l:
            b = i
            break
    if a is None or b is None:
        raise SystemExit("build: could not locate block %s (%r .. %r)" % (label, start_marker, end_marker))
    applied.append("%s: replaced lines %d-%d (%d lines -> %d)" % (label, a + 1, b, b - a, new_text.count("\n") + 1))
    return lines[:a] + [new_text] + lines[b:]


def sub(text, old, new, label, count=1):
    if old not in text:
        raise SystemExit("build: replacement %s did not match" % label)
    applied.append(label)
    return text.replace(old, new, count)


# ---------------------------------------------------------------------------
src = open(SHELL).read()
lines = src.splitlines(True)

# === 1. the brain layer: every remote model goes, NanoTech takes its place ===
BRAIN = '''// ============ BRAIN: NanoTech, and only NanoTech ============
// There is no remote model here. NanoTech runs in this file: its own weights,
// its own art engine, its own API key. Nothing is ever sent anywhere.
var brain = { type: "nanotech" };
var account = NanoTech.account();
function brainLabel(){
  return "NanoTech, Nick's own model, running right here on this device";
}
function refreshAccount(){ account = NanoTech.refresh(); return account; }
function keyOk(){ return !!(account && account.ok); }
function dailyLimit(){ return keyOk() ? account.dailyImages : 0; }

async function callBrain(input, opts){
  opts = opts || {};
  var turns = typeof input === "string" ? [{ role: "user", content: input }] : input;
  return NanoTech.chat(turns, opts);
}
function blobToBase64(blob){
  return new Promise(function(res, rej){
    var r = new FileReader();
    r.onload = function(){ res(String(r.result).split(",")[1] || ""); };
    r.onerror = function(){ rej(new Error("read failed")); };
    r.readAsDataURL(blob);
  });
}
'''
lines = cut(lines, "// ============ BRAIN: what powers NanoTech",
            "// Saving files: a normal browser download", BRAIN, "brain layer")

# === 2. error copy, rewritten for a model that cannot be offline ===========
ERRS = '''function errorText(code, message){
  return ({
    offline: OFFLINE_MSG,
    bad_key: "That NanoTech key didn't check out. Open the menu, tap Brain and make a new one.",
    no_key: OFFLINE_MSG,
    limit: "That's all the images for today.",
    bad_svg: "That one didn't come out right. Try describing it a little differently.",
    cancelled: "Stopped.",
    engine_error: "NanoTech hit a snag" + (message ? ": " + clip(message, 140) : ".") + " Try again.",
    empty_completion: "It went blank on that one. Try rephrasing it."
  })[code] || ("Something went wrong (" + code + "). Try again.");
}
'''
lines = cut(lines, "function errorText(code, message){", "function goOffline(msg){", ERRS, "error copy")

# === 3. the chat brief: no remote prompt to assemble, just trim history =====
CHATBRAIN = '''// ============ NANOTECH CHAT BRAIN ============
// The character brief below is Nick's, word for word, and it is what the
// engine's voice layer implements. It is shown in the app under Brain, so the
// personality NanoTech is built to have is always readable.
function buildTurns(){
  var turns = chat.turns.slice(-30).map(function(t){ return { role: t.role, content: t.content }; });
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}
'''
lines = cut(lines, "// ============ NANOTECH CHAT BRAIN ============",
            "// ============ NANOIMAGINE PROMPTS ============", CHATBRAIN, "chat brain")

# === 4. no more SVG prompts: the art engine draws directly =================
PROMPTS = '''// ============ NANOIMAGINE ============
// Images and video are drawn by NanoTech's own procedural SVG engine, so there
// are no prompts to write here. What is left is deciding what the person asked
// for in chat.
'''
lines = cut(lines, "// ============ NANOIMAGINE PROMPTS ============",
            "function wantsImage(t){", PROMPTS, "svg prompts")

# === 5. the jobs now call the engine ======================================
JOBS = '''// ============ JOBS ============
function jobError(e){
  if (e && e.code) return e;
  return { code: "engine_error", message: String((e && e.message) || e) };
}
async function runImageJob(text, container, o){
  var mk = o.model, S = STUDIO[mk], base = o.enhance || o.edit;
  if (!keyOk()) throw { code: "no_key" };
  if (imagesLeft() <= 0) throw { code: "limit" };
  var card = genCard(container, { eta: S.eta, first: o.enhance ? "Enhancing your image" : o.edit ? "Editing your image" : "Reading your prompt" });
  var r, secs;
  try {
    var opts = {
      detail: mk === "variant" ? "max" : "high",
      signal: ctl.signal,
      onStatus: function(t){ card.phase(t); },
      onLayer: function(svg, frac){ card.preview(svg, frac); }
    };
    if (o.enhance) r = await NanoTech.enhance(base, opts);
    else if (o.edit) r = await NanoTech.edit(base, text, opts);
    else r = await NanoTech.image(text, opts);
  } catch (e) { throw jobError(e); }
  finally { secs = card.stop(); }
  var got = finishSvg(r.svg);
  if (!got) throw { code: "bad_svg" };
  useImage();
  var item = {
    id: newId("i"), type: "image", model: mk, source: o.source || "studio", created: Date.now(), secs: secs,
    unfinished: false, svg: addFinish(got.svg), kind: o.enhance ? "enhance" : o.edit ? "edit" : "new",
    baseId: base ? base.id : null, salt: (base && base.salt) || "",
    request: o.enhance ? "Enhance" : text,
    prompt: base ? (base.prompt + " (then: " + (o.enhance ? "enhanced" : text) + ")").slice(-300) : text,
    caption: r.caption, palette: r.palette || []
  };
  imageCache[item.id] = item; DB.put("images", item);
  return item;
}
async function runVideoJob(text, container, o){
  var mk = o.model, S = STUDIO[mk], q = o.quality;
  if (!keyOk()) throw { code: "no_key" };
  var card = genCard(container, { eta: S.eta, first: "Writing the storyboard", video: true });
  var r, secs;
  try {
    r = await NanoTech.video(text, {
      quality: q, model: mk, signal: ctl.signal,
      onBoard: function(b){ card.plan(b); },
      onStatus: function(t){ card.phase(t); },
      onLayer: function(svg, frac){ card.preview(svg, frac); }
    });
  } catch (e) { throw jobError(e); }
  finally { secs = card.stop(); }
  var got = finishSvg(r.svg);
  if (!got) throw { code: "bad_svg" };
  var item = {
    id: newId("v"), type: "video", model: mk, quality: q, source: o.source || "studio", created: Date.now(),
    secs: secs, unfinished: false, svg: got.svg, duration: r.duration, request: text, prompt: text,
    title: r.title || "", caption: r.caption
  };
  imageCache[item.id] = item; DB.put("images", item);
  return item;
}
'''
lines = cut(lines, "async function tryPlan(prompt, cleaner, onStatus){",
            "function normalize(it){", JOBS, "jobs")

# === 6. the settings sheet becomes the key panel ==========================
SETTINGS = '''// ============ NANOTECH KEY ============
var draft = null;
I.chip = ic('<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/><path d="M9.5 2.5v4M14.5 2.5v4M9.5 17.5v4M14.5 17.5v4M2.5 9.5h4M2.5 14.5h4M17.5 9.5h4M17.5 14.5h4"/>');
function updateBrainUI(){
  $("dBrainName").textContent = keyOk() ? (account.tier === "pro" ? "Pro key" : "Free key") : "No key";
  each(".brain-banner", function(b){ b.hidden = keyOk(); });
}
function openBrain(){
  closeDrawer(); closePops();
  draft = { key: NanoTech.key.saved(), showPrompt: false };
  renderBrainSheet();
  $("brainSheet").hidden = false;
}
function closeBrain(){ $("brainSheet").hidden = true; }
function bMsg(text, bad){ var m = $("bMsg"); m.textContent = text || ""; m.classList.toggle("bad", !!bad); }

function renderBrainSheet(){
  var parsed = NanoTech.key.parse(draft.key);
  var tier = parsed.ok ? parsed.tier : "";
  var issued = parsed.ok && parsed.issued ? parsed.issued.toLocaleDateString() : "";
  var html = '<div class="keycard"><div class="keyrow"><span class="keylabel">Your NanoTech API key</span>' +
    (tier ? '<span class="tag">' + esc(tier === "pro" ? "Pro" : "Free") + "</span>" : "") + "</div>" +
    '<code class="keyval" id="keyVal">' + esc(draft.key || "no key yet") + "</code>" +
    '<div class="keyacts">' +
      '<button type="button" class="act" id="kCopy">' + I.copy + "<span>Copy</span></button>" +
      '<button type="button" class="act" id="kNew">' + I.retry + "<span>New key</span></button>" +
      '<button type="button" class="act" id="kPro">' + I.spark + "<span>" + (tier === "pro" ? "Make free key" : "Make Pro key") + "</span></button>" +
    "</div></div>" +
    '<label class="bf"><span>Paste a different NanoTech key</span><input id="kIn" type="text" spellcheck="false" ' +
      'autocapitalize="off" autocomplete="off" placeholder="nano-f\\u2026"></label>' +
    '<p class="bnote">' + (parsed.ok
      ? "This key works. " + (parsed.dailyImages === Infinity ? "Unlimited images" : parsed.dailyImages + " images a day") +
        ", unlimited video." + (issued ? " Issued " + esc(issued) + "." : "")
      : "<b>" + esc(parsed.why || "No key yet.") + "</b> Tap New key to make one.") + "</p>" +
    '<p class="bnote small">NanoTech only accepts NanoTech keys. No other model or service is involved at any point, ' +
      "and nothing you type ever leaves this device. Keys are made and checked right here, so they work with your wifi off.</p>" +
    '<button type="button" class="act" id="kPrompt">' + I.bulb + "<span>" +
      (draft.showPrompt ? "Hide personality" : "See NanoTech's personality") + "</span></button>" +
    (draft.showPrompt ? '<pre class="brief">' + esc(PROMPT) + "</pre>" : "");

  $("bFields").innerHTML = html;
  $("bTest").hidden = false;
  bMsg("");

  var inp = $("kIn");
  inp.addEventListener("input", function(){ draft.typed = inp.value.trim(); });
  $("kCopy").addEventListener("click", function(){
    copyText(draft.key, null, $("keyVal"));
    bMsg("Key copied. Keep it to yourself.");
  });
  $("kNew").addEventListener("click", function(){
    draft.key = NanoTech.key.create(NanoTech.key.parse(draft.key).tier === "pro" ? "pro" : "free");
    draft.typed = ""; renderBrainSheet(); bMsg("New key made. Tap Save to switch to it.");
  });
  $("kPro").addEventListener("click", function(){
    draft.key = NanoTech.key.create(NanoTech.key.parse(draft.key).tier === "pro" ? "free" : "pro");
    draft.typed = ""; renderBrainSheet();
    bMsg(NanoTech.key.parse(draft.key).tier === "pro"
      ? "Pro key made: unlimited images. Tap Save."
      : "Free key made: " + DEFAULT_DAILY + " images a day. Tap Save.");
  });
  $("kPrompt").addEventListener("click", function(){ draft.showPrompt = !draft.showPrompt; renderBrainSheet(); });
}
async function testBrain(){
  var k = draft.typed || draft.key;
  var parsed = NanoTech.key.parse(k);
  if (!parsed.ok){ bMsg(parsed.why, true); return; }
  var btn = $("bTest"); btn.disabled = true; bMsg("Testing\\u2026");
  try {
    var r = await NanoTech.chat([{ role: "user", content: "say hi" }], { modelTier: "quick" });
    bMsg("It works. NanoTech said: " + clip(clean(r.text).trim() || "(nothing)", 90));
  } catch (e) {
    bMsg(errorText((e && e.code) || "engine_error", e && e.message), true);
  } finally { btn.disabled = false; }
}
function saveBrainDraft(){
  var k = draft.typed || draft.key;
  var r = NanoTech.key.set(k);
  if (!r.ok){ bMsg(r.why, true); return; }
  refreshAccount();
  DAILY_IMAGES = dailyLimit();
  closeBrain(); updateBrainUI(); updateCounts(); updateComposer(); renderChips();
  if (state.view === "studio") updateStudioHello();
  toast("Key saved. " + (r.tier === "pro" ? "Pro: unlimited images." : DAILY_IMAGES + " images a day."));
}
$("dBrain").addEventListener("click", openBrain);
document.addEventListener("click", function(e){ if (e.target.closest("[data-open-brain]")) openBrain(); });
$("bClose").addEventListener("click", closeBrain);
$("brainSheet").addEventListener("click", function(e){ if (e.target.id === "brainSheet") closeBrain(); });
$("bTest").addEventListener("click", testBrain);
$("bSave").addEventListener("click", saveBrainDraft);
document.addEventListener("keydown", function(e){ if (e.key === "Escape" && !$("brainSheet").hidden) closeBrain(); });

'''
lines = cut(lines, "// ============ BRAIN SETTINGS ============",
            "// ============ START ============", SETTINGS, "key panel")

src = "".join(lines)

# ---------------------------------------------------------------------------
# small targeted edits
# ---------------------------------------------------------------------------

# realistic timings: the engine draws in well under a second
src = sub(src,
  '''  flash:     { name: "NanoImagine Flash 1.5", kind: "image", group: "Images", tag: "Fast", tier: "quick",
               desc: "Makes images fast, and sharper than the original NanoImagine.", eta: { secs: 25, text: "Usually 20 to 30s" } },
  variant:   { name: "NanoImagine Variant", kind: "edit", group: "Images", tag: "Edit", tier: "default",
               desc: "Edits an image you already made.", eta: { secs: 48, text: "Usually 45 to 50s" } },
  vision:    { name: "NanoVision", kind: "video", group: "Video", tag: "Video", tier: "default", qualities: ["480p", "720p"],
               desc: "Text to video. Animated clips 10 to 15 seconds long.", eta: { secs: 150, text: "Usually 2 to 3 min" } },
  visionPro: { name: "NanoVision Pro", kind: "video", group: "Video", tag: "Pro", tier: "complex", qualities: ["480p", "1080p"],
               desc: "The best video model, with the smoothest animation.", eta: { secs: 165, text: "Usually 2 to 3 min" } }''',
  '''  flash:     { name: "NanoImagine Flash 1.5", kind: "image", group: "Images", tag: "Fast", tier: "quick",
               desc: "Draws illustrations as SVG, layer by layer, right on your device.", eta: { secs: 1.4, text: "Usually about a second" } },
  variant:   { name: "NanoImagine Variant", kind: "edit", group: "Images", tag: "Edit", tier: "default",
               desc: "Edits an image you already made, keeping the layout.", eta: { secs: 1.6, text: "Usually a second or two" } },
  vision:    { name: "NanoVision", kind: "video", group: "Video", tag: "Video", tier: "default", qualities: ["480p", "720p"],
               desc: "Text to animated video. Clips 10 to 15 seconds long, and they loop.", eta: { secs: 2.2, text: "Usually a couple of seconds" } },
  visionPro: { name: "NanoVision Pro", kind: "video", group: "Video", tag: "Pro", tier: "complex", qualities: ["480p", "1080p"],
               desc: "The best video model, with richer detail and smoother timing.", eta: { secs: 3, text: "Usually a few seconds" } }''',
  "studio timings")

# the daily limit now comes from the key
src = sub(src, "var DAILY_IMAGES = 15;",
  "var DEFAULT_DAILY = 15;\nvar DAILY_IMAGES = DEFAULT_DAILY;   // replaced by the key's own allowance at start",
  "daily limit")
src = sub(src, "function imagesLeft(){ return Math.max(0, DAILY_IMAGES - usedToday()); }",
  "function imagesLeft(){ return DAILY_IMAGES === Infinity ? Infinity : Math.max(0, DAILY_IMAGES - usedToday()); }",
  "images left")

# copy that no longer makes sense for a local model
src = sub(src,
  'var OFFLINE_MSG = "NanoTech is offline right now, so replies are basic and images and videos are off. Open the menu and tap Brain to set up a free brain or add an API key.";',
  'var OFFLINE_MSG = "NanoTech needs its API key to run. Open the menu, tap Brain and make one \\u2014 it takes one tap and it is free.";',
  "offline msg")
src = sub(src,
  'var NEED_SMART = "NanoImagine needs a brain to make images and videos. Open the menu and tap Brain to set one up.";',
  'var NEED_SMART = "NanoImagine needs your NanoTech key. Open the menu and tap Brain to make one.";',
  "need smart msg")
src = sub(src, 'var OFF_CODES = { not_granted: 1, sampling_disabled: 1, not_declared: 1, capability_disabled: 1, capability_removed: 1 };',
  'var OFF_CODES = { no_key: 1 };', "off codes")

open(OUT, "w").write(src)
print("\n".join("  " + a for a in applied))
print("\nwrote %s (%.0f KB) before engine inline" % (OUT, os.path.getsize(OUT) / 1024.0))


# ===========================================================================
# PART 2: styles, markup, progressive preview, startup, and the inlined engine
# ===========================================================================
src = open(OUT).read()

# --- styles for the key panel and the character brief ----------------------
src = sub(src, "@media (prefers-reduced-motion:reduce)", '''/* NanoTech key panel */
.keycard{background:var(--bg);border:1px solid var(--line2);border-radius:16px;padding:12px 14px;margin-bottom:12px}
.keyrow{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.keylabel{font:600 13px var(--ui);color:var(--dim)}
.keyval{display:block;font:14px/1.5 var(--mono);color:var(--nano);background:var(--surface2);border-radius:10px;
        padding:10px 12px;word-break:break-all;user-select:all;-webkit-user-select:all}
.keyacts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.keyacts .act{flex:none}
.brief{margin:12px 0 0;max-height:36vh;overflow:auto;background:var(--code);border:1px solid var(--line);
       border-radius:12px;padding:12px 14px;font:12px/1.55 var(--mono);color:#c8d6f2;white-space:pre-wrap}
.enginefoot{margin:10px 0 0;font-size:11.5px;color:var(--faint);text-align:center}
@media (prefers-reduced-motion:reduce)''', "key panel css")

# --- the sheet no longer picks between providers --------------------------
src = sub(src, '''    <p class="sheet-sub">Pick what powers NanoTech. None of these use your Claude app usage.</p>
    <div class="bopts" role="radiogroup" aria-label="Brain">
      <button class="bopt" type="button" role="radio" data-b="offline"><b>Offline</b><small>Free. Basic replies only, with no images or videos.</small></button>
      <button class="bopt" type="button" role="radio" data-b="device"><b>On this device <span class="tag">Beta</span></b><small>Free and private. A small AI runs right on your phone after a one-time download.</small></button>
      <button class="bopt" type="button" role="radio" data-b="gemini"><b>Gemini API key <span class="tag">Free tier</span></b><small>A free key from Google AI Studio. Good for chat, images and videos.</small></button>
      <button class="bopt" type="button" role="radio" data-b="anthropic"><b>Claude API key</b><small>Best quality. Pay per use with API credits, separate from your Claude app plan.</small></button>
      <button class="bopt" type="button" role="radio" data-b="openai"><b>Other API key</b><small>OpenRouter, Groq, OpenAI or any OpenAI-compatible service.</small></button>
    </div>
    <div id="bFields"></div>
    <p id="bMsg" class="bmsg" role="status"></p>
    <div class="sheet-foot"><button id="bTest" class="act" type="button">Test</button><button id="bSave" class="primary-btn" type="button">Save</button></div>
    <p class="fine">Keys are saved only in this browser on this device, never inside the file. Don't share screenshots of them.</p>''',
'''    <p class="sheet-sub">NanoTech is powered by NanoTech. One model, one key, running entirely on this device.</p>
    <div id="bFields"></div>
    <p id="bMsg" class="bmsg" role="status"></p>
    <div class="sheet-foot"><button id="bTest" class="act" type="button">Test</button><button id="bSave" class="primary-btn" type="button">Save</button></div>
    <p class="fine">Your key lives only in this browser on this device, never inside the file. Don't share screenshots of it.</p>''',
  "sheet markup")

src = sub(src, '<h2 id="brainTitle">Brain</h2>', '<h2 id="brainTitle">NanoTech key</h2>', "sheet title")
src = sub(src,
  '<button id="dBrain" class="d-item" type="button"><span class="i-brain"></span>Brain<small id="dBrainName">Offline</small></button>',
  '<button id="dBrain" class="d-item" type="button"><span class="i-brain"></span>Brain<small id="dBrainName">Free key</small></button>',
  "drawer label")
src = sub(src,
  "<b>NanoTech is offline</b>Tap to set up a free brain or add an API key.",
  "<b>NanoTech needs its key</b>Tap to make one. Free, instant, stays on this device.",
  "chat banner", count=1)
src = sub(src,
  "<b>NanoImagine needs a brain</b>Tap to set one up so it can make images and videos.",
  "<b>NanoImagine needs your key</b>Tap to make one so it can draw.",
  "studio banner")

# --- genCard: take finished SVG frames straight from the engine -----------
src = sub(src, '''    progress: function(u){
      len = u.text.length;
      var now = Date.now();
      if (now - lastAt < 700 || len - lastLen < 1000) return;
      lastAt = now; lastLen = len; tick();
      var p = closePartial(u.text); if (!p) return;
      var f = fixSvg(p); if (!validSvg(f)) return;
      var my = ++seq, n = new Image();''',
'''    /* The engine hands over a complete, valid frame after every layer, so the
       preview is the real picture building up rather than a guess at one. */
    preview: function(svg, frac){
      len = Math.max(len, Math.round((frac || 0) * 24000));
      best = Math.max(best, Math.floor((frac || 0) * 96));
      tick();
      var my = ++seq, n = new Image();
      n.className = "live"; n.alt = "";
      n.onload = function(){
        if (my < shown || !box.isConnected) return;
        shown = my; box.insertBefore(n, veil); box.classList.add("has-live");
        if (live && live !== n) live.remove(); live = n;
      };
      n.src = dataUri(svg);
    },
    progress: function(u){
      len = u.text.length;
      var now = Date.now();
      if (now - lastAt < 700 || len - lastLen < 1000) return;
      lastAt = now; lastLen = len; tick();
      var p = closePartial(u.text); if (!p) return;
      var f = fixSvg(p); if (!validSvg(f)) return;
      var my = ++seq, n = new Image();''', "gen card preview")

# the progress bar should follow the real layer count, not a made-up clock
src = sub(src, '''  function pct(){
    var t = (Date.now() - t0) / 1000, E = o.eta.secs;
    var tp = t < E ? t / E * 90 : 90 + 7 * (1 - Math.exp(-(t - E) / E));
    var lp = len ? Math.min(97, 5 + len / 230) : 0;
    best = Math.max(best, Math.floor(Math.max(tp, lp))); return best;
  }''',
'''  function pct(){
    var t = (Date.now() - t0) / 1000, E = o.eta.secs;
    var tp = t < E ? t / E * 88 : 88 + 9 * (1 - Math.exp(-(t - E) / E));
    best = Math.max(best, Math.floor(tp)); return Math.min(99, best);
  }''', "progress curve")

# --- unlimited images read as unlimited -----------------------------------
src = sub(src, '''function updateCounts(){
  var left = imagesLeft(), blocked = left <= 0 || offline;
  $("imgLeft").textContent = left;''',
'''function leftText(){ var n = imagesLeft(); return n === Infinity ? "\\u221e" : String(n); }
function updateCounts(){
  var left = imagesLeft(), blocked = left <= 0 || offline;
  $("imgLeft").textContent = leftText();''', "counts")
src = sub(src,
  '  $("dFoot").innerHTML = "<b>" + left + "</b> of " + DAILY_IMAGES + " images left today. Videos are unlimited.";',
  '  $("dFoot").innerHTML = left === Infinity ? "<b>Unlimited</b> images and videos on your Pro key."\n'
  '    : "<b>" + left + "</b> of " + DAILY_IMAGES + " images left today. Videos are unlimited.";',
  "drawer footer")
src = sub(src,
  '      $("ctxText").textContent = imagesLeft() + " of " + DAILY_IMAGES + " left today";',
  '      $("ctxText").textContent = imagesLeft() === Infinity ? "Unlimited images" : imagesLeft() + " of " + DAILY_IMAGES + " left today";',
  "composer ctx")
src = sub(src,
  '    (S.kind === "video" ? " Make as many as you want." : " " + imagesLeft() + " of " + DAILY_IMAGES + " images left today.");',
  '    (S.kind === "video" ? " Make as many as you want." :\n'
  '      imagesLeft() === Infinity ? " Unlimited images on your Pro key." : " " + imagesLeft() + " of " + DAILY_IMAGES + " images left today.");',
  "studio hello")
src = sub(src,
  '    : S.kind === "video" ? "Videos are unlimited. Each one is 10 to 15 seconds and loops." : DAILY_IMAGES + " images a day. Failed or stopped images don\'t count.";',
  '    : S.kind === "video" ? "Videos are unlimited. Each one is 10 to 15 seconds and loops."\n'
  '    : (DAILY_IMAGES === Infinity ? "Unlimited images." : DAILY_IMAGES + " images a day.") + " Failed or stopped images don\'t count.";',
  "fine print")
src = sub(src, '  $("fine").textContent = chatV ? "NanoTech can make mistakes, so double-check important info."',
  '  $("fine").textContent = chatV ? "NanoTech runs on your device and can make mistakes. Double-check anything important."',
  "chat fine print")

# --- startup ---------------------------------------------------------------
src = sub(src, '''offline = brain.type === "offline"; canSave = true;
setBusyUI(false); setGreeting(); setMode(state.mode); setView(state.view);
DB.all("images").then(function(list){ list.forEach(cacheItem); updateComposer(); });
updateBrainUI(); updateCounts();''',
'''refreshAccount();
DAILY_IMAGES = dailyLimit();
offline = !keyOk(); canSave = true;
setBusyUI(false); setGreeting(); setMode(state.mode); setView(state.view);
DB.all("images").then(function(list){ list.forEach(cacheItem); updateComposer(); });
updateBrainUI(); updateCounts();''', "startup")

# a new chat should start NanoTech's memory fresh too
src = sub(src, '''function newChat(){''', '''function newChat(){
  NanoTech.reset();''', "new chat resets memory")
src = sub(src, '''async function openChat(id){''', '''async function openChat(id){
  NanoTech.reset();''', "open chat resets memory")

# --- no external fonts: the file must work with the wifi off ---------------
src = sub(src, '''<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
''', "", "drop web fonts")
src = sub(src,
  '''  --ui:"Figtree",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --brand:"Sora","Figtree",system-ui,sans-serif;''',
  '''  /* system faces only, so the file has nothing to fetch and works offline */
  --ui:system-ui,-apple-system,"Segoe UI Variable Text","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --brand:ui-rounded,"SF Pro Rounded",system-ui,-apple-system,"Segoe UI Variable Display","Segoe UI",Roboto,sans-serif;''',
  "system font stack")
src = sub(src, '<p class="fine" id="fine"></p>',
  '<p class="fine" id="fine"></p>\n      <p class="enginefoot">NanoTech runs entirely on this device. No server, no other model, no network.</p>',
  "engine footer")

open(OUT, "w").write(src)

# --- inline the model and the engine --------------------------------------
model_js = open(os.path.join(HERE, "train", "nanomodel.js")).read()
engine_js = "\n".join(open(os.path.join(HERE, "engine", f + ".js")).read() for f in ENGINE)

bundle = (
    "<script>\n"
    "/* =====================================================================\n"
    "   NanoTech. Nick's model, and the only one this file uses.\n"
    "   Trained with Python (nanotech/train), drawn by an SVG engine written\n"
    "   for it (nanotech/engine), and packed into this page. No network calls,\n"
    "   no other model, no service. It works with the wifi off.\n"
    "   ===================================================================== */\n"
    "(function(global){\n\"use strict\";\n"
    + model_js + "\n" + engine_js +
    "\nglobal.NanoTech = NanoTech;\nglobal.NanoKey = NanoKey;\n})(window);\n"
    "</script>\n"
)
src = sub(src, "<script>\n(function(){\n\"use strict\";", bundle + '<script>\n(function(){\n"use strict";',
          "inline engine")

open(OUT, "w").write(src)
print("\n".join("  " + a for a in applied[12:]))
print("\nNanoTech.html: %.0f KB" % (os.path.getsize(OUT) / 1024.0))
