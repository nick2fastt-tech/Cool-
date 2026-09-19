/* ==========================================================================
   NanoVision: prompt -> animated SVG.
   Same scene graph as the image engine, plus a CSS keyframe compiler. Every
   animation is infinite, runs for exactly the clip duration (or an even
   division of it) and ends where it started, so the loop is seamless.
   ========================================================================== */

function Anim(dur){
  this.dur = dur;
  this.rules = [];
  this.frames = Object.create(null);
  this.n = 0;
}
Anim.prototype.cls = function(p){ return (p || "a") + (++this.n).toString(36); };
/* register a named keyframe block once and reuse it */
Anim.prototype.keys = function(name, body){
  if (!this.frames[name]) this.frames[name] = "@keyframes " + name + "{" + body + "}";
  return name;
};
/* attach an animation to a class. cycles divides the clip so short repeating
   motion (a wingbeat, a flicker) still lands exactly on the loop point. */
Anim.prototype.use = function(keyName, cycles, easing, origin){
  var c = this.cls();
  var d = this.dur / Math.max(1, Math.round(cycles || 1));
  this.rules.push("." + c + "{animation:" + keyName + " " + n2(d) + "s " + (easing || "ease-in-out") +
    " infinite;transform-box:fill-box;transform-origin:" + (origin || "center") + "}");
  return c;
};
Anim.prototype.css = function(){
  var f = [];
  for (var k in this.frames) f.push(this.frames[k]);
  return "<style>" + f.join("") + this.rules.join("") + "</style>";
};

/* ---------- the motion vocabulary --------------------------------------- */
function motionLib(A){
  return {
    drift: function(dx, cycles){
      var k = A.keys("dr" + Math.round(dx * 10),
        "0%,100%{transform:translateX(0)}50%{transform:translateX(" + n2(dx) + "px)}");
      return A.use(k, cycles || 1);
    },
    bob: function(dy, cycles){
      var k = A.keys("bb" + Math.round(dy * 10),
        "0%,100%{transform:translateY(0)}50%{transform:translateY(" + n2(-dy) + "px)}");
      return A.use(k, cycles || 2);
    },
    sway: function(deg, cycles){
      var k = A.keys("sw" + Math.round(deg * 10),
        "0%,100%{transform:rotate(" + n2(-deg) + "deg)}50%{transform:rotate(" + n2(deg) + "deg)}");
      return A.use(k, cycles || 2, "ease-in-out", "bottom center");
    },
    breathe: function(amt, cycles){
      var k = A.keys("br" + Math.round(amt * 100),
        "0%,100%{transform:scale(1)}50%{transform:scale(" + n2(1 + amt) + "," + n2(1 - amt * 0.4) + ")}");
      return A.use(k, cycles || 3, "ease-in-out", "bottom center");
    },
    flap: function(deg, cycles){
      var k = A.keys("fl" + Math.round(deg),
        "0%,100%{transform:rotate(" + n2(-deg) + "deg)}50%{transform:rotate(" + n2(deg) + "deg)}");
      return A.use(k, cycles || 6, "ease-in-out", "left center");
    },
    spin: function(cycles, rev){
      var k = A.keys(rev ? "spr" : "spf",
        "0%{transform:rotate(0)}100%{transform:rotate(" + (rev ? "-" : "") + "360deg)}");
      return A.use(k, cycles || 1, "linear");
    },
    twinkle: function(cycles, lo){
      var k = A.keys("tw" + Math.round((lo || 0.3) * 100),
        "0%,100%{opacity:" + (lo || 0.3) + "}50%{opacity:1}");
      return A.use(k, cycles || 4, "ease-in-out");
    },
    pulse: function(amt, cycles){
      var k = A.keys("pl" + Math.round(amt * 100),
        "0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(" + n2(1 + amt) + ");opacity:1}");
      return A.use(k, cycles || 3);
    },
    fall: function(dist, drift2, cycles){
      var k = A.keys("fa" + Math.round(dist) + "_" + Math.round(drift2),
        "0%{transform:translate(0,0)}100%{transform:translate(" + n2(drift2) + "px," + n2(dist) + "px)}");
      return A.use(k, cycles || 1, "linear");
    },
    rise: function(dist, cycles){
      var k = A.keys("ri" + Math.round(dist),
        "0%{transform:translateY(0);opacity:0}15%{opacity:.9}100%{transform:translateY(" + n2(-dist) + "px);opacity:0}");
      return A.use(k, cycles || 2, "linear");
    },
    cross: function(dist, cycles){
      var k = A.keys("cr" + Math.round(dist),
        "0%{transform:translateX(0)}100%{transform:translateX(" + n2(dist) + "px)}");
      return A.use(k, cycles || 1, "linear");
    },
    walk: function(deg, cycles){
      var k = A.keys("wk" + Math.round(deg),
        "0%,100%{transform:rotate(" + n2(deg) + "deg)}50%{transform:rotate(" + n2(-deg) + "deg)}");
      return A.use(k, cycles || 5, "ease-in-out", "top center");
    },
    shimmer: function(cycles){
      var k = A.keys("sh", "0%,100%{opacity:.25}50%{opacity:.7}");
      return A.use(k, cycles || 3, "ease-in-out");
    },
    camera: function(zoom, panX){
      var k = A.keys("cam" + Math.round(zoom * 100) + "_" + Math.round(panX),
        "0%,100%{transform:scale(1) translateX(0)}50%{transform:scale(" + n2(zoom) + ") translateX(" + n2(panX) + "px)}");
      return A.use(k, 1, "ease-in-out", "center");
    }
  };
}

function wrapClass(cls, inner){ return '<g class="' + cls + '">' + inner + "</g>"; }

/* A layer that slides for parallax has to be bigger than the frame, or the
   far edge of the canvas shows through at the extremes of the move. 8% of
   overscan covers every drift the compiler emits. */
function overscan(W, H, inner){
  return '<g transform="translate(' + n2(-W * 0.04) + " " + n2(-H * 0.04) + ') scale(1.08)">' + inner + "</g>";
}

/* ---------- storyboard --------------------------------------------------- */
function storyboard(S, dur){
  var rr = mk(rng(S.seed ^ 0x9e37)), beats = [];
  var subj = S.subjects.length ? (S.subjects[0].word || S.subjects[0].concept) : S.setting;
  var open = { dawn: "The light comes up", day: "Bright and open", golden: "Low golden light",
               night: "Quiet under the stars", space: "Drifting in the dark", under: "Down in the blue" }[S.time]
             || "The scene settles";
  beats.push({ from: 0, to: Math.round(dur * 0.3), what: open + " on " + subj + "." });
  beats.push({ from: Math.round(dur * 0.3), to: Math.round(dur * 0.72),
    what: cap(subj) + " moves, and the layers behind it drift at their own speed." });
  beats.push({ from: Math.round(dur * 0.72), to: dur, what: "Everything eases back to where it started, so it loops clean." });
  return {
    title: titleish(subj).slice(0, 40), duration: dur,
    style: S.style, palette: S.palette.list.slice(0, 6),
    beats: beats, camera: "slow push", loop: "seamless",
    details: beats.map(function(b){ return b.what; })
  };
}

/* ---------- render ------------------------------------------------------- */
async function renderVideo(prompt, opts){
  opts = opts || {};
  var q = opts.quality || "720p";
  var W = 1280, H = 720;
  var pro = opts.model === "visionPro";
  var detail = pro ? 3 : (q === "480p" ? 1 : 2);
  var S = parseScene(prompt, { salt: opts.salt || "", wide: true });
  var p = S.palette, rr = S.rr;
  S.horizon = H * (S.setting === "space" ? 0.7 : S.under ? 0.26 : rr.f(0.54, 0.64));
  var dur = rr.i(10, 15);

  Draw.resetIds(S.seed ^ 0x7777);
  var D = new Draw(), A = new Anim(dur), M = motionLib(A);
  var defs = [], layers = [];
  function abort(){ if (opts.signal && opts.signal.aborted) throw { code: "cancelled" }; }
  function flush(){ var o = D.out(); if (o.defs) defs.push(o.defs); D.defs = []; return o.body; }
  function assembleV(){
    return svgOpen(W, H, ' data-duration="' + dur + '"') + A.css() +
           "<defs>" + defs.join("") + "</defs>" + layers.join("") + "</svg>";
  }

  var board = storyboard(S, dur);
  if (opts.onBoard) opts.onBoard(board);

  var steps = [
    ["Laying in the sky", function(){
      var body = paintSky(D, S, W, H);
      flush();
      return overscan(W, H, wrapClass(M.drift(-W * 0.012, 1), body));
    }],
    ["Animating the sky", function(){
      var body = skyMotion(D, S, A, M, W, H, detail);
      flush();
      return body;
    }],
    ["Blocking the background", function(){
      var body = paintFar(D, S, W, H);
      flush();
      return overscan(W, H, wrapClass(M.drift(W * 0.008, 1), body));
    }],
    ["Painting the ground", function(){ var b = paintGround(D, S, W, H); flush(); return overscan(W, H, b); }],
    ["Building the midground", function(){
      var body = paintMid(D, S, W, H);
      flush();
      return overscan(W, H, wrapClass(M.drift(W * 0.02, 1), body));
    }],
    ["Animating the subject", function(){ var b = videoSubjects(D, S, A, M, W, H, detail); flush(); return b; }],
    ["Adding foreground detail", function(){
      var body = paintFore(D, S, W, H);
      flush();
      return overscan(W, H, wrapClass(M.drift(-W * 0.035, 1), body));
    }],
    ["Adding weather and particles", function(){ var b = particles(D, S, A, M, W, H, detail); flush(); return b; }],
    ["Setting the light", function(){ var b = paintLight(D, S, W, H); flush(); return b; }]
  ];

  for (var i = 0; i < steps.length; i++){
    abort();
    if (opts.onStatus) opts.onStatus(steps[i][0]);
    var body = steps[i][1]();
    if (body) layers.push(body);
    if (opts.onLayer) opts.onLayer(assembleV(), (i + 1) / steps.length);
    await frame();
  }
  abort();

  /* one slow camera move over the whole thing makes it feel shot, not drawn */
  var camCls = M.camera(pro ? 1.07 : 1.045, rr.f(-14, 14));
  var svg = svgOpen(W, H, ' data-duration="' + dur + '"') + A.css() +
            "<defs>" + defs.join("") + "</defs>" +
            '<g class="' + camCls + '">' + layers.join("") + "</g></svg>";
  return { svg: svg, duration: dur, board: board, caption: videoCaption(S, dur), title: board.title };
}

function videoCaption(S, dur){
  var rr = mk(rng(S.seed ^ 0x4242));
  var subj = S.subjects.length ? (S.subjects[0].word || S.subjects[0].concept) : S.setting;
  /* the figure already prints the title, so the caption must not repeat it */
  return rr.pick([
    dur + " seconds, and it loops clean 🎬",
    "Here's the clip 🎬 " + dur + "s, seamless loop.",
    "In motion, " + dur + "s, loops forever 🎬",
    "Animated it for you — " + dur + " seconds 🎬"
  ]);
}

/* ---------- animated sky ------------------------------------------------- */
function skyMotion(D, S, A, M, W, H, detail){
  var p = S.palette, rr = S.rr, out = [];
  /* clouds crossing at different speeds is most of the parallax read */
  var n = S.time === "space" || S.under ? 0 : (S.weather === "storm" ? 5 : 4);
  for (var i = 0; i < n; i++){
    var cy = rr.f(0.06, 0.4) * H, cs = rr.f(0.5, 1.3), startX = rr.f(-0.2, 1.0) * W;
    var cloudC = S.weather === "storm" ? darken(p.skyMid, 0.42) : (p.dark ? mix(p.skyMid, "#ffffff", 0.22) : mix("#ffffff", p.skyLow, 0.16));
    var cg = D.grad(lighten(cloudC, 0.16), darken(cloudC, 0.1), 100);
    var puff = "";
    for (var k = 0; k < 5; k++)
      puff += ell((k - 2) * 26 * cs, Math.abs(k - 2) * 5 * cs, (28 - Math.abs(k - 2) * 5) * cs, (16 - Math.abs(k - 2) * 2.5) * cs, cg);
    var travel = (W * 1.5) * (0.3 + cs * 0.4);
    var cls = M.cross(travel, 1);
    out.push('<g transform="translate(' + n2(startX - W * 0.3) + " " + n2(cy) + ')" opacity="' + n2(rr.f(0.5, 0.9)) + '">' +
      '<g class="' + cls + '">' + puff + "</g></g>");
  }
  /* stars breathe */
  if (p.dark || S.time === "space"){
    var tw = [M.twinkle(3, 0.25), M.twinkle(4, 0.4), M.twinkle(5, 0.15)];
    for (i = 0; i < (detail >= 2 ? 60 : 34); i++){
      var sx = rr.f(0, W), sy = rr.f(0, H * (S.time === "space" ? 1 : 0.7));
      out.push('<g class="' + tw[i % 3] + '">' + circ(sx, sy, rr.f(0.6, 2.1), "#ffffff") + "</g>");
    }
  }
  /* aurora ribbons on a clear night */
  if (p.dark && S.weather === "clear" && S.time !== "space" && rr.chance(0.5)){
    for (i = 0; i < 3; i++){
      var ay = H * (0.08 + i * 0.06);
      var ag = D.grad(p.accent, p.accent2, 0,
        '<stop offset="0" stop-color="' + p.accent + '" stop-opacity="0"/><stop offset="0.5" stop-color="' +
        p.accent2 + '" stop-opacity="0.5"/><stop offset="1" stop-color="' + p.accent + '" stop-opacity="0"/>');
      var band = pth(P().M(0, ay).C(W * 0.3, ay - 40, W * 0.7, ay + 40, W, ay - 10)
        .L(W, ay + 70).C(W * 0.7, ay + 110, W * 0.3, ay + 30, 0, ay + 80).Z().d, ag);
      out.push('<g class="' + M.shimmer(2 + i) + '">' + band + "</g>");
    }
  }
  return out.join("");
}

/* ---------- animated subjects ------------------------------------------- */
function videoSubjects(D, S, A, M, W, H, detail){
  var p = S.palette, rr = S.rr, out = [];
  var subs = S.subjects;
  if (!subs.length) return "";
  var slots = subjectSlots(S, W, H, subs.length);

  for (var i = 0; i < subs.length; i++){
    var concept = subs[i].concept, word = subs[i].word || concept;
    var f = formFor(concept, word), slot = slots[i];
    if (!f) continue;                       // nothing sensible to draw for this one

    var share = subs.length === 1 ? rr.f(0.36, 0.46) : rr.f(0.26, 0.32);
    if (f.fam === "build") share *= 1.12;
    var targetH = H * share, targetW = W * (subs.length === 1 ? 0.5 : 0.3);
    var ground = GROUND_FAM[f.fam] ? "ground" : "center";

    var o = { flip: rr.chance(0.35) };
    var NATURAL = { quad: 1, bird: 1, fish: 1, dragon: 1 };
    if (f.variant && f.variant.base) o.color = f.variant.base;
    else if (f.fam === "build" || f.fam === "plant") o.color = null;
    else if (NATURAL[f.fam] && !S.colorWords.length)
      o.color = ["#c98a52", "#a8713f", "#8a6a4e", "#d9a96c", "#6f7d8f", "#4f6a52", "#b8523c"][Math.floor(rr.f(0, 7))];
    else o.color = i === 0 ? p.subject : p.accent2;
    if (f.variant && f.variant.mark && QUAD[f.kind]) o.mark = f.variant.mark;

    var x = slot.x, y = slot.y, moving = false, travel = 0;

    if (f.fam === "sky"){ x = W * rr.f(0.22, 0.78); y = H * rr.f(0.18, 0.34); o.r = 40; targetH = H * share * 0.7; ground = "center"; }
    else if (f.fam === "bird"){ o.flying = true; y = H * rr.f(0.26, 0.44); ground = "center"; moving = true; travel = W * 1.4; }
    else if (f.fam === "dragon"){
      o.fire = /\bfire|flame|breathing|breath\b/.test(S.joined);
      if (rr.chance(0.6)){ o.flying = true; y = H * rr.f(0.26, 0.42); ground = "center"; }
    }
    else if (f.fam === "fish" || S.under){ y = S.under ? H * rr.f(0.34, 0.62) : y; ground = "center"; moving = rr.chance(0.6); travel = W * 1.3; }
    else if (f.fam === "craft"){ y = H * rr.f(0.32, 0.55); ground = "center"; }
    else if (f.fam === "air"){ y = S.horizon - (H - S.horizon) * rr.f(0.2, 0.7); ground = "center"; }

    var sub = new Draw();
    var body = f.fn(sub, rr, p, f.kind, o);
    var so = sub.out();
    if (so.defs) D.def(so.defs);
    var probe = fitPlace(0, 0, targetW, targetH, so.body + body, ground, false);
    var scale = probe.scale, halfW = probe.box.w * scale * 0.5, halfH = probe.box.h * scale;
    if (!moving){
      if (x - halfW < W * 0.03) x += (W * 0.03 - (x - halfW));
      if (x + halfW > W * 0.97) x -= ((x + halfW) - W * 0.97);
      if (ground === "ground" && y - halfH < H * 0.05) y = H * 0.05 + halfH;
    }

    /* the form's own idle motion */
    var idle;
    if (f.fam === "quad") idle = M.breathe(0.022, 3);
    else if (f.fam === "human") idle = M.bob(H * 0.008, 3);
    else if (f.fam === "bird") idle = M.flap(16, detail >= 2 ? 10 : 7);
    else if (f.fam === "fish") idle = M.sway(4, 4);
    else if (f.fam === "dragon") idle = o.flying ? M.bob(H * 0.03, 2) : M.breathe(0.02, 3);
    else if (f.fam === "plant") idle = M.sway(2.4, 2);
    else if (f.fam === "air") idle = M.bob(H * 0.02, 2);
    else if (f.fam === "float") idle = M.pulse(0.06, 3);
    else if (f.fam === "craft") idle = S.setting === "space" ? M.bob(H * 0.014, 2) : M.bob(H * 0.05, 1);
    else if (f.fam === "build") idle = null;
    else idle = M.bob(H * 0.01, 3);

    var placed = fitPlace(0, 0, targetW, targetH, so.body + body, ground, false).svg;
    var withIdle = idle ? wrapClass(idle, placed) : placed;

    if (moving){
      var startX = -W * 0.2, cls = M.cross(travel, 1);
      out.push('<g transform="translate(' + n2(startX) + " " + n2(y) + ')"><g class="' + cls + '">' + withIdle + "</g></g>");
    } else {
      if (f.fam !== "sky"){
        var sepC = p.dark ? p.light : p.shadow;
        var sep = D.radial(sepC, sepC, 50, 50, 50, p.dark ? 0.16 : 0.2, 0);
        out.push(ell(x, ground === "ground" ? y - halfH * 0.5 : y, halfW * 1.5, halfH * 0.85, sep));
        if (ground === "ground" && !S.under){
          var sg = D.radial(p.shadow, p.shadow, 50, 50, 50, 0.4, 0);
          out.push(ell(x, y + 2, halfW * 1.05, halfW * 0.22, sg));
        }
      }
      out.push('<g transform="translate(' + n2(x) + " " + n2(y) + ')">' + withIdle + "</g>");
    }
  }
  return out.join("");
}

/* ---------- particles and weather --------------------------------------- */
function particles(D, S, A, M, W, H, detail){
  var p = S.palette, rr = S.rr, out = [];
  var count, i;

  if (S.weather === "rain" || S.weather === "storm"){
    count = detail >= 2 ? (S.weather === "storm" ? 110 : 70) : 44;
    var speeds = [M.fall(H * 1.3, -W * 0.04, 12), M.fall(H * 1.3, -W * 0.05, 9), M.fall(H * 1.3, -W * 0.03, 15)];
    for (i = 0; i < count; i++){
      var rx = rr.f(-W * 0.1, W * 1.05), ry = rr.f(-H * 0.4, H * 0.1), len = rr.f(H * 0.025, H * 0.06);
      out.push('<g class="' + speeds[i % 3] + '">' +
        stroke(P().M(rx, ry).L(rx - len * 0.26, ry + len).d, "#dbe9ff", rr.f(0.7, 1.4), ' opacity="' + n2(rr.f(0.2, 0.55)) + '"') + "</g>");
    }
    if (S.weather === "storm"){
      var k = A.keys("flash", "0%,6%,10%,100%{opacity:0}7%{opacity:.85}8.5%{opacity:.3}9.5%{opacity:.7}");
      var fcls = A.use(k, 1, "linear");
      out.push('<g class="' + fcls + '">' + rct(0, 0, W, H, "#ffffff", 0, ' opacity="0.5"') +
        stroke(P().M(W * 0.66, 0).L(W * 0.61, H * 0.22).L(W * 0.67, H * 0.2).L(W * 0.58, H * 0.5).d, "#fff8d0", 3.4) + "</g>");
    }
  } else if (S.weather === "snow"){
    count = detail >= 2 ? 110 : 60;
    var drops = [M.fall(H * 1.25, W * 0.05, 4), M.fall(H * 1.25, -W * 0.04, 3), M.fall(H * 1.25, W * 0.02, 5)];
    for (i = 0; i < count; i++)
      out.push('<g class="' + drops[i % 3] + '">' +
        circ(rr.f(0, W), rr.f(-H * 0.35, H * 0.05), rr.f(1.2, 3.4), "#ffffff", ' opacity="' + n2(rr.f(0.35, 0.95)) + '"') + "</g>");
  } else if (S.under){
    count = detail >= 2 ? 44 : 24;
    var ups = [M.rise(H * 1.1, 2), M.rise(H * 1.1, 3), M.rise(H * 1.1, 4)];
    for (i = 0; i < count; i++)
      out.push('<g class="' + ups[i % 3] + '">' +
        circ(rr.f(0, W), rr.f(H * 0.5, H * 1.05), rr.f(1.5, 5), "#dff6ff", ' opacity="' + n2(rr.f(0.15, 0.5)) + '"') + "</g>");
  } else if (S.time === "space"){
    count = detail >= 2 ? 40 : 22;
    var flow = [M.cross(W * 1.3, 1), M.cross(W * 1.3, 2), M.cross(W * 1.3, 3)];
    for (i = 0; i < count; i++)
      out.push('<g class="' + flow[i % 3] + '">' +
        circ(rr.f(-W * 0.2, W), rr.f(0, H), rr.f(0.6, 1.8), "#ffffff", ' opacity="' + n2(rr.f(0.2, 0.7)) + '"') + "</g>");
  } else {
    /* pollen, embers, fireflies: whatever the scene calls for */
    count = detail >= 3 ? 46 : detail >= 2 ? 30 : 16;
    var floatC = p.dark ? p.glow : p.light;
    var bobs = [M.bob(H * 0.05, 2), M.bob(H * 0.07, 3), M.bob(H * 0.04, 4)];
    var sideways = [M.drift(W * 0.03, 1), M.drift(-W * 0.02, 1)];
    for (i = 0; i < count; i++){
      var mx = rr.f(0, W), my = rr.f(H * 0.25, H * 0.98);
      out.push('<g class="' + sideways[i % 2] + '"><g class="' + bobs[i % 3] + '">' +
        circ(mx, my, rr.f(1, 2.8), floatC, ' opacity="' + n2(rr.f(0.2, 0.7)) + '"') + "</g></g>");
    }
  }

  /* water always moves */
  if (S.setting === "ocean" || S.setting === "lake"){
    for (i = 0; i < 4; i++){
      var wy = S.horizon + (H - S.horizon) * (0.18 + i * 0.2);
      out.push('<g class="' + M.drift(W * (0.02 + i * 0.012), 1) + '">' +
        stroke(P().M(-W * 0.1, wy).C(W * 0.3, wy - 7, W * 0.7, wy + 7, W * 1.1, wy - 4).d, "#ffffff", 2 + i, ' opacity="' + n2(0.12 + i * 0.06) + '"') + "</g>");
    }
  }
  return out.join("");
}
