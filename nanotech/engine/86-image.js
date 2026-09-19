/* ==========================================================================
   NanoImagine: prompt -> finished SVG illustration.
   Renders in layers, handing each partial frame back so the app can show the
   picture building up. Deterministic: same prompt, same image.
   ========================================================================== */

function frame(){
  return new Promise(function(res){
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(function(){ res(); });
    else setTimeout(res, 8);
  });
}
function svgOpen(w, h, extra){
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '"' + (extra || "") + ">";
}

/* stitch a partial document so it renders on its own mid-build */
function assemble(w, h, defs, layers, extra){
  return svgOpen(w, h, extra) + "<defs>" + defs.join("") + "</defs>" + layers.join("") + "</svg>";
}

var DETAIL_LEVEL = { low: 0, normal: 1, high: 2, max: 3 };

async function renderImage(prompt, opts){
  opts = opts || {};
  var W = 1024, H = 1024;
  var detail = DETAIL_LEVEL[opts.detail] === undefined ? 2 : DETAIL_LEVEL[opts.detail];
  var S = parseScene(prompt, { salt: opts.salt || "", detail: opts.detail, seed: opts.seedOverride });
  var p = S.palette, rr = S.rr;
  S.horizon = H * (S.setting === "space" ? 0.72 : S.under ? 0.3 : rr.f(0.52, 0.62));

  Draw.resetIds(S.seed);
  var D = new Draw(), defs = [], layers = [];
  function flush(){ var o = D.out(); if (o.defs) defs.push(o.defs); D.defs = []; return o.body; }
  function push(body){ var d = flush(); if (body) layers.push(body); return d; }
  function abort(){ if (opts.signal && opts.signal.aborted) throw { code: "cancelled" }; }

  var steps = [
    ["Laying in the sky",       function(){ return paintSky(D, S, W, H); }],
    ["Blocking the background", function(){ return paintFar(D, S, W, H); }],
    ["Painting the ground",     function(){ return paintGround(D, S, W, H); }],
    ["Building the midground",  function(){ return paintMid(D, S, W, H); }],
    ["Drawing the subject",     function(){ return paintSubjects(D, S, W, H, detail); }],
    ["Adding foreground detail",function(){ return paintFore(D, S, W, H); }],
    ["Setting the light",       function(){ return paintLight(D, S, W, H); }]
  ];
  if (detail >= 2) steps.splice(6, 0, ["Adding fine detail", function(){ return paintFineDetail(D, S, W, H, detail); }]);

  for (var i = 0; i < steps.length; i++){
    abort();
    if (opts.onStatus) opts.onStatus(steps[i][0]);
    var body = steps[i][1]();
    var d = flush();
    if (d) defs.push(d);
    if (body) layers.push(body);
    var partial = assemble(W, H, defs, layers);
    if (opts.onLayer) opts.onLayer(partial, (i + 1) / steps.length);
    await frame();
  }
  abort();
  var svg = assemble(W, H, defs, layers);
  return { svg: svg, caption: sceneCaption(S), scene: S, palette: p.list.slice(0, 6) };
}

/* ---------- subjects ----------------------------------------------------- */
function paintSubjects(D, S, W, H, detail){
  var p = S.palette, rr = S.rr, out = [];
  var subs = S.subjects;
  if (!subs.length) return "";                 // pure landscape, the scene is the subject
  var slots = subjectSlots(S, W, H, subs.length);

  for (var i = 0; i < subs.length; i++){
    var concept = subs[i].concept, word = subs[i].word || concept;
    var f = formFor(concept, word);
    if (!f) continue;                       // nothing sensible to draw for this one
    var slot = slots[i];
    var sub = new Draw();

    /* Target a share of the frame; fitPlace works out the scale from what was
       actually drawn, so a wide dragon and a tall lighthouse both fit. */
    var share = subs.length === 1 ? rr.f(0.40, 0.50) : rr.f(0.26, 0.33);
    if (f.fam === "build") share *= 1.12;
    if (f.fam === "plant") share *= 1.08;
    var targetH = H * share, targetW = W * (subs.length === 1 ? 0.72 : 0.42);
    var ground = GROUND_FAM[f.fam] ? "ground" : "center";

    var o = { flip: rr.chance(0.4) };
    var NATURAL = { quad: 1, bird: 1, fish: 1, dragon: 1 };
    if (f.variant && f.variant.base) o.color = f.variant.base;
    else if (f.fam === "build" || f.fam === "plant") o.color = null;   // keep their own natural palette
    else if (NATURAL[f.fam] && !S.colorWords.length){
      /* living things read wrong in the scene's accent colour, so give them a
         warm natural coat unless the prompt asked for a colour */
      var coats = ["#c98a52", "#a8713f", "#8a6a4e", "#d9a96c", "#6f7d8f", "#4f6a52", "#b8523c"];
      o.color = coats[Math.floor(rr.f(0, coats.length))];
    }
    else o.color = i === 0 ? p.subject : p.accent2;
    if (f.variant && f.variant.mark && QUAD[f.kind]) o.mark = f.variant.mark;

    var y = slot.y, x = slot.x;

    if (f.fam === "sky"){
      x = W * rr.f(0.26, 0.74); y = H * rr.f(0.2, 0.36); o.r = 40;
      targetH = H * share * 0.8; ground = "center";
    } else if (f.fam === "air" || f.fam === "float"){
      y = S.horizon - (H - S.horizon) * rr.f(0.1, 0.5); ground = "center";
    } else if (f.fam === "bird" && (S.time === "day" || S.time === "golden" || S.weather === "clear") && rr.chance(0.5)){
      o.flying = true; y = H * rr.f(0.3, 0.46); targetH *= 0.85; ground = "center";
    } else if (f.fam === "fish" || S.under){
      y = S.under ? H * rr.f(0.36, 0.6) : y; ground = "center";
    } else if (f.fam === "dragon"){
      o.fire = /\bfire|flame|breathing|breath\b/.test(S.joined);
      if (rr.chance(0.5)){ o.flying = true; y = H * rr.f(0.3, 0.44); ground = "center"; }
    } else if (f.fam === "craft" && (S.setting === "space" || /\blaunch|flying|sky|orbit\b/.test(S.joined))){
      y = H * rr.f(0.36, 0.56); ground = "center";
    }

    var body = f.fn(sub, rr, p, f.kind, o);
    var so = sub.out();
    if (so.defs) D.def(so.defs);
    var fitted = fitPlace(x, y, targetW, targetH, so.body + body, ground, false);
    var scale = fitted.scale, halfW = fitted.box.w * scale * 0.5, halfH = fitted.box.h * scale;

    /* keep it inside the frame */
    if (x - halfW < W * 0.03) x += (W * 0.03 - (x - halfW));
    if (x + halfW > W * 0.97) x -= ((x + halfW) - W * 0.97);
    if (ground === "ground" && y - halfH < H * 0.04) y = H * 0.04 + halfH;
    fitted = fitPlace(x, y, targetW, targetH, so.body + body, ground, false);

    /* drop shadow so it is not pasted on */
    if (ground === "ground" && !S.under){
      var sg = D.radial(p.shadow, p.shadow, 50, 50, 50, 0.4, 0);
      out.push(ell(x + (S.sunX > W * 0.5 ? -1 : 1) * halfW * 0.16, y + 2, halfW * 1.05, halfW * 0.22, sg));
    }
    out.push(fitted.svg);

    /* Separate the subject from whatever is behind it. Light scenes get a soft
       darker pool, dark scenes a lift. Without this the subject sinks in. */
    if (f.fam !== "sky"){
      var sepC = p.dark ? p.light : p.shadow;
      var sep = D.radial(sepC, sepC, 50, 50, 50, p.dark ? 0.16 : 0.2, 0);
      out.unshift(ell(x, ground === "ground" ? y - halfH * 0.5 : y, halfW * 1.5, halfH * 0.85, sep));
    }

    /* a soft halo behind a glowing subject at night */
    if (p.dark && (f.fam === "float" || f.kind === "campfire" || f.kind === "lighthouse")){
      var hg = D.radial(p.glow, p.glow, 50, 50, 50, 0.28, 0);
      out.unshift(circ(x, ground === "ground" ? y - halfH * 0.5 : y, halfW * 2.4, hg));
    }
  }
  return out.join("");
}

/* ---------- the pass that makes it look finished ------------------------ */
function paintFineDetail(D, S, W, H, detail){
  var p = S.palette, rr = S.rr, out = [];
  var hz = S.horizon;

  /* birds in the distance: three strokes each, huge payoff */
  if (!S.under && S.time !== "space" && S.setting !== "interior" && rr.chance(0.75)){
    var bx = rr.f(0.12, 0.7) * W, by = rr.f(0.12, 0.3) * H, n = rr.i(3, 5);
    var flock = "";
    for (var i = 0; i < n; i++){
      var fx = bx + i * rr.f(26, 46), fy = by + rr.f(-22, 22), fs = rr.f(0.5, 0.85);
      flock += stroke(P().M(fx - 9 * fs, fy).Q(fx - 4 * fs, fy - 5 * fs, fx, fy - 1 * fs)
        .Q(fx + 4 * fs, fy - 5 * fs, fx + 9 * fs, fy).d, p.dark ? "#cfd8ef" : darken(p.far, 0.4), 1.8 * fs);
    }
    out.push('<g opacity="0.45">' + flock + "</g>");
  }

  /* dust motes / pollen / plankton catching the light */
  var motes = detail >= 3 ? 70 : 42;
  for (i = 0; i < motes; i++){
    var mx = rr.f(0, W), my = rr.f(H * 0.1, H);
    out.push(circ(mx, my, rr.f(0.8, 2.4), S.under ? "#dff6ff" : p.light,
      ' opacity="' + n2(rr.f(0.1, 0.45)) + '"'));
  }

  /* a scatter of small ground detail so the bottom third is not empty */
  if (!S.under && S.setting !== "ocean" && S.setting !== "space"){
    for (i = 0; i < (detail >= 3 ? 16 : 10); i++){
      var gx = rr.f(0, W), t = rr.f(0.2, 1), gy = hz + (H - hz) * t, gs = (0.25 + t * 0.5) * (W / 1024);
      var d2 = new Draw(), which = rr.f(0, 1);
      var body = which < 0.4 ? drawFlower(d2, rr, p, "flower", { h: 30, color: rr.chance(0.5) ? p.accent : p.accent2 })
               : which < 0.7 ? drawMushroom(d2, rr, p, "mushroom", { h: 22, color: p.trim })
               : ell(0, 48, rr.f(6, 14), rr.f(3, 6), darken(p.near, 0.15));
      var o2 = d2.out(); if (o2.defs) D.def(o2.defs);
      out.push('<g opacity="' + n2(0.6 + t * 0.4) + '">' + place(D, S, gx, gy, gs, o2.body + body, rr.chance(0.5)) + "</g>");
    }
  }

  /* style finishes */
  if (S.style === "sketch" || S.style === "blueprint"){
    var lines = "";
    for (i = 0; i < 40; i++){
      var lx = rr.f(0, W), ly = rr.f(0, H), L = rr.f(30, 120), a = rr.f(-0.6, -0.3);
      lines += stroke(P().M(lx, ly).L(lx + Math.cos(a) * L, ly + Math.sin(a) * L).d,
        S.style === "blueprint" ? "#bcd8ff" : "#2c3448", 0.7, ' opacity="0.16"');
    }
    out.push(lines);
  }
  if (S.style === "pixel"){
    var id = D.id("px");
    D.def('<pattern id="' + id + '" width="10" height="10" patternUnits="userSpaceOnUse">' +
      '<rect width="10" height="10" fill="none"/><rect width="10" height="1" fill="#000" opacity="0.06"/>' +
      '<rect width="1" height="10" fill="#000" opacity="0.06"/></pattern>');
    out.push(rct(0, 0, W, H, "url(#" + id + ")"));
  }
  if (S.style === "neon"){
    var gl = D.glowF(10, 1.1);
    out.push('<g filter="' + gl + '" opacity="0.28">' + rct(0, S.horizon - 3, W, 3, p.accent) + "</g>");
    for (i = 0; i < 12; i++)
      out.push(rct(0, rr.f(0, H), W, rr.f(0.6, 1.6), p.accent2, 0, ' opacity="' + n2(rr.f(0.04, 0.12)) + '"'));
  }
  return out.join("");
}

/* ---------- edits -------------------------------------------------------- */
/* Re-derive the scene from the original request plus the change, keeping the
   original seed so the layout stays recognisable. That way "make it sunset"
   moves the light without moving the subject. */
async function renderEdit(base, change, opts){
  opts = opts || {};
  var merged = (base.request || base.prompt || "") + " " + change;
  var keepSeed = hashStr(String(base.request || base.prompt || "").toLowerCase() + "|" + (base.salt || ""));
  var S0 = parseScene(merged, { salt: base.salt || "", seed: keepSeed });
  var r = await renderImage(merged, {
    salt: base.salt || "", detail: opts.detail || "high",
    onLayer: opts.onLayer, onStatus: opts.onStatus, signal: opts.signal,
    seedOverride: keepSeed
  });
  r.caption = editCaption(change, S0);
  return r;
}
function editCaption(change, S){
  var rr = mk(rng(hashStr(change)));
  return rr.pick(["Done — " + change.replace(/^(make|turn) it /i, "") + " it is 👌",
                  "Updated. " + cap(change.replace(/[.!]+$/, "")) + ".",
                  "New version, with " + change.replace(/^(add|make|turn it) /i, "") + " ✨"]);
}
async function renderEnhance(base, opts){
  opts = opts || {};
  var r = await renderImage(base.request === "Enhance" ? base.prompt : (base.request || base.prompt), {
    salt: (base.salt || "") + "+", detail: "max",
    onLayer: opts.onLayer, onStatus: opts.onStatus, signal: opts.signal
  });
  r.caption = mk(rng(hashStr(base.id || "e")))
    .pick(["Leveled it up ✨", "Pushed the detail further ✨", "Richer pass on that one ✨"]);
  return r;
}
