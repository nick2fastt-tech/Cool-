/* ==========================================================================
   The NanoTech API. This is the only model this app talks to, and it is the
   only key it accepts. Keys are made and checked on the device; there is no
   server to call and nothing leaves the page.

   Key shape:  nano-<tier><payload>-<check>
     tier      f = free, p = pro
     payload   18 crockford-base32 characters: version, issue day, randomness
     check     4 hex characters over everything before it
   ========================================================================== */
var NanoKey = (function(){
  var A32 = "0123456789abcdefghjkmnpqrstvwxyz";   // no i l o u, so nothing is misread
  var PREFIX = "nano-";

  function sum(s){
    var h = 0x811c9dc5 >>> 0;
    for (var i = 0; i < s.length; i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ("000" + (h & 0xffff).toString(16)).slice(-4);
  }
  function rand32(n){
    var out = "", buf;
    if (typeof crypto !== "undefined" && crypto.getRandomValues){
      buf = new Uint8Array(n);
      crypto.getRandomValues(buf);
    } else {
      buf = [];
      for (var j = 0; j < n; j++) buf.push(Math.floor(Math.random() * 256));
    }
    for (var i = 0; i < n; i++) out += A32.charAt(buf[i] % 32);
    return out;
  }

  function create(tier){
    tier = tier === "pro" ? "p" : "f";
    var day = Math.floor(Date.now() / 86400000).toString(32);
    while (day.length < 4) day = "0" + day;
    var payload = "1" + day.slice(-4) + rand32(13);     // 18 chars
    var core = PREFIX + tier + payload;
    return core + "-" + sum(core);
  }

  function parse(key){
    var k = String(key || "").trim().toLowerCase().replace(/\s+/g, "");
    if (k.indexOf(PREFIX) !== 0) return { ok: false, why: "A NanoTech key starts with nano-." };
    var body = k.slice(PREFIX.length);
    var dash = body.lastIndexOf("-");
    if (dash < 0) return { ok: false, why: "That key is missing its check code." };
    var core = k.slice(0, PREFIX.length + dash), check = body.slice(dash + 1);
    var tier = body.charAt(0), payload = body.slice(1, dash);
    if (tier !== "f" && tier !== "p") return { ok: false, why: "That key's tier code isn't one NanoTech issues." };
    if (payload.length !== 18) return { ok: false, why: "That key is the wrong length." };
    for (var i = 0; i < payload.length; i++)
      if (A32.indexOf(payload.charAt(i)) < 0) return { ok: false, why: "That key has characters NanoTech never uses." };
    if (sum(core) !== check) return { ok: false, why: "That key's check code doesn't match, so it's been mistyped." };
    var day = parseInt(payload.slice(1, 5), 32);
    return {
      ok: true, key: k, tier: tier === "p" ? "pro" : "free",
      issued: isFinite(day) ? new Date(day * 86400000) : null,
      dailyImages: tier === "p" ? Infinity : 15
    };
  }

  var STORE = "nt-key";
  function saved(){
    var v;
    try { v = localStorage.getItem(STORE); } catch (e) { v = null; }
    return v || "";
  }
  function save(k){ try { localStorage.setItem(STORE, k); } catch (e) {} }

  /* Always have a working key. First run mints one so nothing is ever gated
     behind a signup that does not exist. */
  function ensure(){
    var cur = parse(saved());
    if (cur.ok) return cur;
    var fresh = create("free");
    save(fresh);
    return parse(fresh);
  }
  function set(k){
    var r = parse(k);
    if (r.ok) save(r.key);
    return r;
  }
  function mask(k){
    k = String(k || "");
    return k.length > 14 ? k.slice(0, 10) + "…" + k.slice(-5) : k;
  }
  return { create: create, parse: parse, ensure: ensure, set: set, saved: saved, mask: mask };
})();

/* ==========================================================================
   NanoTech: the single entry point the app uses.
   ========================================================================== */
var NanoTech = (function(){
  var account = null;

  function auth(){
    if (!account) account = NanoKey.ensure();
    if (!account.ok) throw { code: "bad_key", message: account.why };
    return account;
  }
  function refresh(){ account = NanoKey.ensure(); return account; }

  /* Stream a finished reply out word by word, so it reads like it is being
     written rather than appearing all at once. */
  async function emit(text, opts){
    var onText = opts.onText;
    if (!onText) return { text: text, truncated: false };
    var parts = text.match(/\s*\S+/g) || [text];
    var acc = "", i = 0;
    var perWord = opts.speed || 13;
    while (i < parts.length){
      if (opts.signal && opts.signal.aborted) throw { code: "cancelled", text: acc };
      /* bigger bites inside code blocks, they are not read word by word */
      var inCode = (acc.split("```").length - 1) % 2 === 1;
      var take = inCode ? 9 : (parts[i].length > 14 ? 1 : 2);
      var chunk = parts.slice(i, i + take).join("");
      acc += chunk;
      i += take;
      onText({ text: acc, delta: chunk });
      var pause = perWord * take;
      if (/[.!?]\s*$/.test(chunk)) pause += 55;
      await new Promise(function(r){ setTimeout(r, pause); });
    }
    return { text: text, truncated: false };
  }

  async function chat(turns, opts){
    opts = opts || {};
    auth();
    if (opts.onStatus) opts.onStatus("");
    var t0 = Date.now();
    var out = NanoChat.reply(turns, opts);
    /* a beat of thinking, longer when the answer took more work */
    var think = Math.max(0, (opts.modelTier === "complex" ? 420 : 200) +
                            Math.min(500, out.text.length * 0.5) - (Date.now() - t0));
    if (think > 0) await new Promise(function(r){ setTimeout(r, think); });
    if (opts.signal && opts.signal.aborted) throw { code: "cancelled" };
    return emit(out.text, opts);
  }

  async function image(prompt, opts){
    opts = opts || {};
    var a = auth();
    return renderImage(prompt, opts);
  }
  async function edit(base, change, opts){ auth(); return renderEdit(base, change, opts); }
  async function enhance(base, opts){ auth(); return renderEnhance(base, opts); }
  async function video(prompt, opts){ auth(); return renderVideo(prompt, opts); }

  return {
    chat: chat, image: image, edit: edit, enhance: enhance, video: video,
    account: function(){ return account || refresh(); },
    refresh: refresh, reset: function(){ NanoChat.reset(); },
    key: NanoKey
  };
})();
