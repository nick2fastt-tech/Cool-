/* ==========================================================================
   The drawing kit: an SVG builder plus the parametric creature families.
   Every form draws into a local box roughly -50..50 on both axes, with the
   feet at y = 50, so the placer only has to translate and scale.
   ========================================================================== */

/* One counter for the whole document. Sub-drawings used to restart at 1 and
   collide with the main gradients, which silently repainted half the scene. */
var NANO_UID = 0, NANO_TAG = "";
function Draw(){ this.defs = []; this.body = []; }
/* The tag is derived from the scene seed, so ids are stable for a given prompt
   and still unique when two pictures end up in the same document. */
Draw.resetIds = function(seed){ NANO_UID = 0; NANO_TAG = (seed >>> 0).toString(36).slice(0, 5); };
Draw.prototype.id = function(p){ return (p || "g") + (++NANO_UID).toString(36) + NANO_TAG; };
Draw.prototype.def = function(s){ this.defs.push(s); };
Draw.prototype.add = function(s){ if (s) this.body.push(s); };
Draw.prototype.open = function(s){ this.body.push(s); };
Draw.prototype.close = function(tag){ this.body.push("</" + (tag || "g") + ">"); };

/* linear gradient. a1 is the angle in degrees, 90 = top to bottom */
Draw.prototype.grad = function(c1, c2, a1, stops){
  var id = this.id("lg"), a = ((a1 === undefined ? 90 : a1) - 90) * Math.PI / 180;
  var x1 = (0.5 - Math.cos(a) * 0.5).toFixed(3), y1 = (0.5 - Math.sin(a) * 0.5).toFixed(3);
  var x2 = (0.5 + Math.cos(a) * 0.5).toFixed(3), y2 = (0.5 + Math.sin(a) * 0.5).toFixed(3);
  var body = stops || ('<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/>');
  this.def('<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">' + body + "</linearGradient>");
  return "url(#" + id + ")";
};
Draw.prototype.radial = function(c1, c2, cx, cy, r, op1, op2){
  var id = this.id("rg");
  this.def('<radialGradient id="' + id + '" cx="' + (cx === undefined ? 50 : cx) + '%" cy="' + (cy === undefined ? 50 : cy) +
    '%" r="' + (r === undefined ? 55 : r) + '%"><stop offset="0" stop-color="' + c1 + '" stop-opacity="' + (op1 === undefined ? 1 : op1) +
    '"/><stop offset="1" stop-color="' + c2 + '" stop-opacity="' + (op2 === undefined ? 1 : op2) + '"/></radialGradient>');
  return "url(#" + id + ")";
};
Draw.prototype.blur = function(amount){
  var id = this.id("bl");
  this.def('<filter id="' + id + '" x="-40%" y="-40%" width="180%" height="180%">' +
    '<feGaussianBlur stdDeviation="' + amount + '"/></filter>');
  return "url(#" + id + ")";
};
Draw.prototype.glowF = function(amount, strength){
  var id = this.id("gw");
  this.def('<filter id="' + id + '" x="-60%" y="-60%" width="220%" height="220%">' +
    '<feGaussianBlur stdDeviation="' + amount + '" result="b"/>' +
    '<feComponentTransfer in="b" result="s"><feFuncA type="linear" slope="' + (strength || 1.5) + '"/></feComponentTransfer>' +
    '<feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter>');
  return "url(#" + id + ")";
};
Draw.prototype.noiseF = function(freq, scale){
  var id = this.id("nz");
  this.def('<filter id="' + id + '"><feTurbulence type="fractalNoise" baseFrequency="' + freq +
    '" numOctaves="3" seed="7" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="' + scale +
    '" xChannelSelector="R" yChannelSelector="G"/></filter>');
  return "url(#" + id + ")";
};
Draw.prototype.out = function(){
  return { defs: this.defs.join(""), body: this.body.join("") };
};

/* ---------- shape helpers ------------------------------------------------ */
function n2(v){ return Math.round(v * 10) / 10; }
function P(){ return { d: "", M: function(x, y){ this.d += "M" + n2(x) + " " + n2(y); return this; },
  L: function(x, y){ this.d += "L" + n2(x) + " " + n2(y); return this; },
  C: function(a, b, c, e, f, g){ this.d += "C" + n2(a) + " " + n2(b) + " " + n2(c) + " " + n2(e) + " " + n2(f) + " " + n2(g); return this; },
  Q: function(a, b, c, e){ this.d += "Q" + n2(a) + " " + n2(b) + " " + n2(c) + " " + n2(e); return this; },
  Z: function(){ this.d += "Z"; return this; } }; }

function ell(cx, cy, rx, ry, fill, extra){
  return '<ellipse cx="' + n2(cx) + '" cy="' + n2(cy) + '" rx="' + n2(rx) + '" ry="' + n2(ry) +
         '" fill="' + fill + '"' + (extra || "") + "/>";
}
function circ(cx, cy, r, fill, extra){
  return '<circle cx="' + n2(cx) + '" cy="' + n2(cy) + '" r="' + n2(r) + '" fill="' + fill + '"' + (extra || "") + "/>";
}
function rct(x, y, w, h, fill, rx, extra){
  return '<rect x="' + n2(x) + '" y="' + n2(y) + '" width="' + n2(w) + '" height="' + n2(h) +
         '" fill="' + fill + '"' + (rx ? ' rx="' + n2(rx) + '"' : "") + (extra || "") + "/>";
}
function pth(d, fill, extra){ return '<path d="' + d + '" fill="' + fill + '"' + (extra || "") + "/>"; }
function stroke(d, color, w, extra){
  return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + n2(w) +
         '" stroke-linecap="round" stroke-linejoin="round"' + (extra || "") + "/>";
}
function grp(t, inner, extra){ return '<g transform="' + t + '"' + (extra || "") + ">" + inner + "</g>"; }

/* a soft dark ellipse under a form, so it is standing on something */
function contact(D, cx, cy, rx, p, strength){
  var g = D.radial(p.shadow, p.shadow, 50, 50, 50, strength === undefined ? 0.42 : strength, 0);
  return ell(cx, cy, rx, Math.max(2, rx * 0.22), g);
}
/* eyes that look alive: dark iris, bright catchlight, lid line */
function eye(cx, cy, r, look){
  look = look || 0;
  return circ(cx, cy, r, "#f7fbff") +
         circ(cx + r * 0.22 * (look || 1), cy + r * 0.05, r * 0.55, "#13182a") +
         circ(cx + r * 0.22 * (look || 1) + r * 0.2, cy - r * 0.22, r * 0.2, "#ffffff", ' opacity="0.95"');
}
function dotEye(cx, cy, r){
  return circ(cx, cy, r, "#151b2c") + circ(cx + r * 0.3, cy - r * 0.32, r * 0.34, "#ffffff", ' opacity="0.9"');
}

/* ==========================================================================
   FAMILY: quadruped. cat, dog, horse, bear, rabbit, elephant, cattle, lizard,
   dinosaur and friends, all from one skeleton with different proportions.
   ========================================================================== */
var QUAD = {
  cat:      { body: 30, tall: 17, leg: 16, legW: 5,  neck: 8,  head: 13, ear: "point", tail: "curl",  snout: 4,  mark: "stripe", back: 0 },
  dog:      { body: 31, tall: 18, leg: 18, legW: 5.5, neck: 9, head: 14, ear: "flop",  tail: "wag",   snout: 7,  mark: "patch",  back: 0 },
  wolf:     { body: 33, tall: 18, leg: 19, legW: 5.5, neck: 10, head: 14, ear: "point", tail: "bush", snout: 9,  mark: "none",   back: 0 },
  horse:    { body: 36, tall: 20, leg: 28, legW: 5,  neck: 18, head: 14, ear: "point", tail: "flow",  snout: 10, mark: "none",   back: -2, mane: true },
  bear:     { body: 34, tall: 24, leg: 14, legW: 9,  neck: 5,  head: 17, ear: "round", tail: "stub",  snout: 6,  mark: "none",   back: 3 },
  rabbit:   { body: 22, tall: 16, leg: 10, legW: 5,  neck: 4,  head: 12, ear: "long",  tail: "puff",  snout: 3,  mark: "none",   back: 2 },
  elephant: { body: 40, tall: 27, leg: 20, legW: 11, neck: 5,  head: 18, ear: "wide",  tail: "thin",  snout: 4,  mark: "none",   back: 4, trunk: true },
  sheep:    { body: 28, tall: 19, leg: 13, legW: 5,  neck: 6,  head: 11, ear: "flop",  tail: "stub",  snout: 5,  mark: "none",   back: 2, wool: true },
  monkey:   { body: 24, tall: 17, leg: 13, legW: 5,  neck: 5,  head: 14, ear: "round", tail: "flow",  snout: 5,  mark: "none",   back: 1 },
  lizard:   { body: 34, tall: 11, leg: 9,  legW: 4,  neck: 7,  head: 12, ear: "none",  tail: "long",  snout: 8,  mark: "spot",   back: 0, sprawl: true },
  turtle:   { body: 30, tall: 15, leg: 7,  legW: 5,  neck: 9,  head: 10, ear: "none",  tail: "stub",  snout: 5,  mark: "none",   back: 0, shell: true },
  dinosaur: { body: 38, tall: 22, leg: 24, legW: 8,  neck: 16, head: 17, ear: "none",  tail: "long",  snout: 12, mark: "stripe", back: 0, biped: true },
  frog:     { body: 22, tall: 14, leg: 11, legW: 5,  neck: 2,  head: 15, ear: "none",  tail: "none",  snout: 6,  mark: "spot",   back: 0, squat: true },
  seal:     { body: 34, tall: 15, leg: 5,  legW: 7,  neck: 7,  head: 12, ear: "none",  tail: "fin",   snout: 6,  mark: "none",   back: 0, sprawl: true },
  penguin:  { body: 22, tall: 26, leg: 6,  legW: 6,  neck: 3,  head: 13, ear: "none",  tail: "stub",  snout: 5,  mark: "bib",    back: 0, upright: true },
  bat:      { body: 16, tall: 12, leg: 6,  legW: 3,  neck: 3,  head: 12, ear: "long",  tail: "stub",  snout: 4,  mark: "none",   back: 0, wings: true },
  spider:   { body: 18, tall: 13, leg: 20, legW: 2.5, neck: 0, head: 11, ear: "none",  tail: "none",  snout: 0,  mark: "none",   back: 0, legs8: true },
  snail:    { body: 22, tall: 10, leg: 0,  legW: 0,  neck: 6,  head: 9,  ear: "long",  tail: "none",  snout: 3,  mark: "none",   back: 0, shell: true, foot: true }
};
var QUAD_ALIAS = { kitten: "cat", tiger: "cat", lion: "cat", panther: "cat", lynx: "cat",
  fox: "dog", husky: "dog", puppy: "dog", coyote: "dog", hound: "dog",
  panda: "bear", cub: "bear", grizzly: "bear",
  unicorn: "horse", pony: "horse", deer: "horse", stag: "horse", elk: "horse", pegasus: "horse",
  hare: "rabbit", bunny: "rabbit", mammoth: "elephant", rhino: "elephant", hippo: "elephant",
  goat: "sheep", cow: "sheep", bull: "sheep", pig: "sheep", lamb: "sheep",
  ape: "monkey", gorilla: "monkey", chimp: "monkey",
  gecko: "lizard", chameleon: "lizard", iguana: "lizard", snake: "lizard",
  tortoise: "turtle", raptor: "dinosaur", trex: "dinosaur", toad: "frog",
  walrus: "seal", otter: "seal", puffin: "penguin", scorpion: "spider", ant: "spider", beetle: "spider" };

function drawQuadruped(D, rr, p, kind, o){
  o = o || {};
  var Q = QUAD[kind] || QUAD.cat;
  if (o.mark){ var Q2 = {}; for (var qk in Q) Q2[qk] = Q[qk]; Q2.mark = o.mark; Q = Q2; }
  var coat = o.color || p.subject, lo = darken(coat, 0.36), hi = lighten(coat, 0.28);
  var belly = lighten(coat, 0.45);
  var g = D.grad(hi, lo, 115);
  var out = [];
  var flip = o.flip ? -1 : 1;

  var groundY = 50, bodyCY = groundY - Q.leg - Q.tall * 0.55, bodyRX = Q.body * 0.5, bodyRY = Q.tall * 0.62;
  out.push(contact(D, 0, groundY + 1, bodyRX * 1.15, p));

  /* --- tail goes behind the body --- */
  var tx = -bodyRX * 0.92, ty = bodyCY + Q.back;
  if (Q.tail === "curl") out.push(stroke(P().M(tx, ty).C(tx - 12, ty - 2, tx - 16, ty - 16, tx - 6, ty - 20).d, lo, Q.legW * 0.85));
  else if (Q.tail === "wag") out.push(stroke(P().M(tx, ty).C(tx - 10, ty - 6, tx - 13, ty - 15, tx - 9, ty - 19).d, lo, Q.legW * 0.9));
  else if (Q.tail === "bush") out.push(pth(P().M(tx, ty - 3).C(tx - 16, ty - 8, tx - 22, ty + 6, tx - 12, ty + 10).C(tx - 8, ty + 8, tx - 3, ty + 4, tx, ty + 3).Z().d, g));
  else if (Q.tail === "flow") out.push(stroke(P().M(tx, ty - 4).C(tx - 8, ty + 4, tx - 10, ty + 16, tx - 4, ty + 24).d, lo, Q.legW * 0.7));
  else if (Q.tail === "long") out.push(pth(P().M(tx + 2, ty - 4).C(tx - 18, ty - 8, tx - 34, ty + 2, tx - 44, ty + 10).C(tx - 32, ty + 12, tx - 14, ty + 8, tx + 2, ty + 5).Z().d, g));
  else if (Q.tail === "puff") out.push(circ(tx - 4, ty + 4, 6, belly));
  else if (Q.tail === "thin") out.push(stroke(P().M(tx, ty).C(tx - 6, ty + 6, tx - 7, ty + 14, tx - 4, ty + 18).d, lo, 2));
  else if (Q.tail === "fin") out.push(pth(P().M(tx + 4, ty + 6).C(tx - 10, ty + 2, tx - 16, ty + 12, tx - 10, ty + 18).C(tx - 4, ty + 14, tx + 2, ty + 10, tx + 4, ty + 8).Z().d, lo));
  else if (Q.tail === "stub") out.push(circ(tx - 2, ty + 2, 3.4, lo));

  /* --- legs --- */
  var legTop = bodyCY + bodyRY * 0.5, legs = [];
  function leg(x, lean, len){
    var d = P().M(x, legTop).C(x + lean, legTop + len * 0.45, x + lean * 1.4, legTop + len * 0.8, x + lean * 1.2, groundY).d;
    return stroke(d, lo, Q.legW) +
           ell(x + lean * 1.2, groundY - 0.5, Q.legW * 0.72, Q.legW * 0.42, darken(lo, 0.2));
  }
  if (Q.legs8){
    for (var i = 0; i < 4; i++){
      var sp = 1 + i * 0.5, ln = Q.leg * (1 - i * 0.07);
      legs.push(stroke(P().M(-4, bodyCY).C(-10 * sp, bodyCY - 6, -14 * sp, bodyCY + 6, -11 * sp, groundY).d, lo, Q.legW));
      legs.push(stroke(P().M(4, bodyCY).C(10 * sp, bodyCY - 6, 14 * sp, bodyCY + 6, 11 * sp, groundY).d, lo, Q.legW));
    }
  } else if (Q.biped){
    legs.push(leg(-4 * flip, -3 * flip, Q.leg));
    legs.push(leg(6 * flip, 2 * flip, Q.leg));
  } else if (Q.upright){
    legs.push(ell(-5, groundY - 2, 6, 3, lo));
    legs.push(ell(6, groundY - 2, 6, 3, lo));
  } else if (Q.foot){
    legs.push(pth(P().M(-bodyRX, groundY - 3).C(-bodyRX, groundY + 2, bodyRX, groundY + 2, bodyRX + 6, groundY - 3).C(bodyRX, groundY - 6, -bodyRX, groundY - 6, -bodyRX, groundY - 3).Z().d, belly));
  } else if (Q.leg > 2){
    var lean = Q.sprawl ? 5 : 1;
    legs.push(leg(-bodyRX * 0.62, -lean, Q.leg));
    legs.push(leg(-bodyRX * 0.3, -lean * 0.4, Q.leg * 0.97));
    legs.push(leg(bodyRX * 0.36, lean * 0.4, Q.leg * 0.97));
    legs.push(leg(bodyRX * 0.66, lean, Q.leg));
  }
  out.push(legs.join(""));

  /* --- wings, for bats --- */
  if (Q.wings){
    var wg = D.grad(lo, darken(lo, 0.3), 100);
    out.push(pth(P().M(-3, bodyCY - 3).C(-26, bodyCY - 16, -40, bodyCY - 4, -34, bodyCY + 12).C(-24, bodyCY + 4, -12, bodyCY + 4, -3, bodyCY + 6).Z().d, wg));
    out.push(pth(P().M(3, bodyCY - 3).C(26, bodyCY - 16, 40, bodyCY - 4, 34, bodyCY + 12).C(24, bodyCY + 4, 12, bodyCY + 4, 3, bodyCY + 6).Z().d, wg));
  }

  /* --- body --- */
  if (Q.upright){
    out.push(pth(P().M(0, bodyCY - Q.tall * 0.8).C(bodyRX * 1.5, bodyCY - Q.tall * 0.5, bodyRX * 1.4, groundY - 4, 0, groundY - 2)
      .C(-bodyRX * 1.4, groundY - 4, -bodyRX * 1.5, bodyCY - Q.tall * 0.5, 0, bodyCY - Q.tall * 0.8).Z().d, g));
  } else if (Q.squat){
    out.push(ell(0, bodyCY + 4, bodyRX * 1.25, bodyRY * 1.1, g));
  } else {
    var bd = P().M(-bodyRX, bodyCY + Q.back * 0.4)
      .C(-bodyRX * 0.9, bodyCY - bodyRY * 1.35 - Q.back, bodyRX * 0.75, bodyCY - bodyRY * 1.4, bodyRX, bodyCY - bodyRY * 0.25)
      .C(bodyRX * 1.08, bodyCY + bodyRY * 0.85, bodyRX * 0.5, bodyCY + bodyRY * 1.12, 0, bodyCY + bodyRY * 1.1)
      .C(-bodyRX * 0.6, bodyCY + bodyRY * 1.1, -bodyRX * 1.05, bodyCY + bodyRY * 0.7, -bodyRX, bodyCY + Q.back * 0.4).Z().d;
    out.push(pth(bd, g));
    out.push(pth(P().M(-bodyRX * 0.7, bodyCY + bodyRY * 0.45).C(-bodyRX * 0.3, bodyCY + bodyRY * 1.08, bodyRX * 0.4, bodyCY + bodyRY * 1.05, bodyRX * 0.72, bodyCY + bodyRY * 0.35)
      .C(bodyRX * 0.3, bodyCY + bodyRY * 0.8, -bodyRX * 0.3, bodyCY + bodyRY * 0.8, -bodyRX * 0.7, bodyCY + bodyRY * 0.45).Z().d, belly, ' opacity="0.75"'));
  }
  if (Q.wool){
    for (i = 0; i < 9; i++){
      var a = -Math.PI * 0.9 + i * (Math.PI * 1.8 / 8);
      out.push(circ(Math.cos(a) * bodyRX * 0.85, bodyCY + Math.sin(a) * bodyRY * 0.85, bodyRY * 0.4, lighten(coat, 0.5), ' opacity="0.9"'));
    }
  }
  if (Q.shell){
    var sg = D.grad(lighten(p.trim, 0.2), darken(p.trim, 0.35), 120);
    out.push(pth(P().M(-bodyRX * 1.05, bodyCY + bodyRY * 0.3).C(-bodyRX, bodyCY - bodyRY * 1.6, bodyRX, bodyCY - bodyRY * 1.6, bodyRX * 1.05, bodyCY + bodyRY * 0.3).Z().d, sg));
    for (i = -2; i <= 2; i++)
      out.push(stroke(P().M(i * bodyRX * 0.35, bodyCY + bodyRY * 0.25).C(i * bodyRX * 0.4, bodyCY - bodyRY * 0.6, i * bodyRX * 0.42, bodyCY - bodyRY * 1.0, i * bodyRX * 0.2, bodyCY - bodyRY * 1.25).d, darken(p.trim, 0.5), 1.1, ' opacity="0.55"'));
  }
  if (Q.mark === "stripe"){
    for (i = 0; i < 4; i++){
      var sx = -bodyRX * 0.4 + i * bodyRX * 0.32;
      out.push(stroke(P().M(sx, bodyCY - bodyRY * 0.95).C(sx + 3, bodyCY - bodyRY * 0.2, sx + 2, bodyCY + bodyRY * 0.2, sx + 4, bodyCY + bodyRY * 0.5).d, lo, 2.6, ' opacity="0.5"'));
    }
  } else if (Q.mark === "spot"){
    for (i = 0; i < 6; i++)
      out.push(ell(rr.f(-bodyRX * 0.7, bodyRX * 0.7), bodyCY + rr.f(-bodyRY * 0.6, bodyRY * 0.4), rr.f(2, 4), rr.f(1.6, 3), lo, ' opacity="0.45"'));
  } else if (Q.mark === "patch"){
    out.push(ell(-bodyRX * 0.3, bodyCY - bodyRY * 0.2, bodyRX * 0.4, bodyRY * 0.6, lighten(coat, 0.5), ' opacity="0.7"'));
  } else if (Q.mark === "bib"){
    out.push(pth(P().M(-bodyRX * 0.75, bodyCY - Q.tall * 0.3).C(-bodyRX * 0.4, groundY - 4, bodyRX * 0.4, groundY - 4, bodyRX * 0.75, bodyCY - Q.tall * 0.3)
      .C(bodyRX * 0.3, bodyCY - Q.tall * 0.75, -bodyRX * 0.3, bodyCY - Q.tall * 0.75, -bodyRX * 0.75, bodyCY - Q.tall * 0.3).Z().d, "#f6f9ff"));
  }

  /* --- neck and head --- */
  var hx = (bodyRX * 0.82 + Q.neck * 0.34) * flip;
  var hy = bodyCY - bodyRY * 0.5 - Q.neck * 0.82;
  if (Q.upright){ hx = 0; hy = bodyCY - Q.tall * 0.9 - Q.head * 0.45; }
  if (Q.neck > 4 && !Q.upright){
    out.push(stroke(P().M(bodyRX * 0.6 * flip, bodyCY - bodyRY * 0.55).C(hx * 0.9, bodyCY - bodyRY * 0.9, hx, hy + Q.head * 0.5, hx, hy + Q.head * 0.35).d,
      g, Q.head * (Q.mane ? 0.52 : 0.62)));
    if (Q.mane)
      out.push(pth(P().M(bodyRX * 0.55 * flip, bodyCY - bodyRY * 0.95).C(hx * 0.8, hy + Q.head * 0.9, hx * 0.95, hy + Q.head * 0.3, hx * 0.8, hy - Q.head * 0.2)
        .C(hx * 0.5, hy + Q.head * 0.6, bodyRX * 0.4 * flip, bodyCY - bodyRY * 1.15, bodyRX * 0.55 * flip, bodyCY - bodyRY * 0.95).Z().d, darken(coat, 0.5)));
  }
  var hr = Q.head * 0.5;
  out.push(circ(hx, hy, hr, g));
  /* snout */
  if (Q.snout > 2){
    var sxx = hx + hr * 0.7 * flip;
    out.push(ell(sxx, hy + hr * 0.3, Q.snout * 0.55, Q.snout * 0.42, Q.trunk ? g : lighten(coat, 0.2)));
    out.push(ell(sxx + Q.snout * 0.3 * flip, hy + hr * 0.18, 1.7, 1.3, "#2a2030"));
  }
  if (Q.trunk)
    out.push(stroke(P().M(hx + hr * 0.8 * flip, hy + hr * 0.35).C(hx + hr * 1.5 * flip, hy + hr * 1.4, hx + hr * 1.2 * flip, hy + hr * 2.4, hx + hr * 1.6 * flip, hy + hr * 2.9).d, g, Q.head * 0.22));
  /* ears */
  if (Q.ear === "point"){
    out.push(pth(P().M(hx - hr * 0.55, hy - hr * 0.62).L(hx - hr * 0.72, hy - hr * 1.5).L(hx - hr * 0.05, hy - hr * 0.92).Z().d, lo));
    out.push(pth(P().M(hx + hr * 0.5, hy - hr * 0.66).L(hx + hr * 0.7, hy - hr * 1.5).L(hx + hr * 0.02, hy - hr * 0.95).Z().d, g));
  } else if (Q.ear === "flop"){
    out.push(pth(P().M(hx - hr * 0.8, hy - hr * 0.4).C(hx - hr * 1.5, hy + hr * 0.1, hx - hr * 1.35, hy + hr * 0.95, hx - hr * 0.6, hy + hr * 0.7).Z().d, lo));
    out.push(pth(P().M(hx + hr * 0.8, hy - hr * 0.4).C(hx + hr * 1.5, hy + hr * 0.1, hx + hr * 1.35, hy + hr * 0.95, hx + hr * 0.6, hy + hr * 0.7).Z().d, lo));
  } else if (Q.ear === "round"){
    out.push(circ(hx - hr * 0.78, hy - hr * 0.72, hr * 0.38, lo));
    out.push(circ(hx + hr * 0.78, hy - hr * 0.72, hr * 0.38, lo));
  } else if (Q.ear === "long"){
    out.push(ell(hx - hr * 0.42, hy - hr * 1.5, hr * 0.26, hr * 1.05, g));
    out.push(ell(hx + hr * 0.42, hy - hr * 1.5, hr * 0.26, hr * 1.05, g));
    out.push(ell(hx - hr * 0.42, hy - hr * 1.5, hr * 0.13, hr * 0.78, lighten(coat, 0.55)));
    out.push(ell(hx + hr * 0.42, hy - hr * 1.5, hr * 0.13, hr * 0.78, lighten(coat, 0.55)));
  } else if (Q.ear === "wide"){
    out.push(pth(P().M(hx - hr * 0.6, hy - hr * 0.7).C(hx - hr * 2.2, hy - hr * 1.1, hx - hr * 2.3, hy + hr * 1.1, hx - hr * 0.5, hy + hr * 0.75).Z().d, darken(coat, 0.2)));
    out.push(pth(P().M(hx + hr * 0.6, hy - hr * 0.7).C(hx + hr * 2.2, hy - hr * 1.1, hx + hr * 2.3, hy + hr * 1.1, hx + hr * 0.5, hy + hr * 0.75).Z().d, darken(coat, 0.2)));
  }
  /* eyes */
  var er = Math.max(1.6, hr * 0.2);
  if (Q.snout > 6 && !Q.upright){
    out.push(eye(hx + hr * 0.15 * flip, hy - hr * 0.12, er, flip));
  } else {
    out.push(eye(hx - hr * 0.34, hy - hr * 0.08, er, flip));
    out.push(eye(hx + hr * 0.34, hy - hr * 0.08, er, flip));
  }
  if (Q.upright){
    out.push(pth(P().M(hx - hr * 0.2, hy + hr * 0.2).L(hx + hr * 0.2, hy + hr * 0.2).L(hx, hy + hr * 0.75).Z().d, p.trim));
  }
  if (kind === "cat" || kind === "rabbit"){
    for (i = -1; i <= 1; i += 2)
      for (var k = 0; k < 2; k++)
        out.push(stroke(P().M(hx + hr * 0.45 * i, hy + hr * 0.3 + k * 2).L(hx + hr * (1.5 + k * 0.1) * i, hy + hr * (0.1 + k * 0.5)).d, "#ffffff", 0.7, ' opacity="0.55"'));
  }
  /* rim light down the lit edge */
  out.push(stroke(P().M(bodyRX * 0.2, bodyCY - bodyRY * 1.28).C(bodyRX * 0.8, bodyCY - bodyRY * 1.1, bodyRX * 1.02, bodyCY - bodyRY * 0.4, bodyRX * 0.96, bodyCY + bodyRY * 0.3).d,
    p.light, 1.5, ' opacity="0.42"'));
  return out.join("");
}

/* ==========================================================================
   FAMILY: bird. bird, owl, eagle, raven, phoenix, parrot, crane.
   ========================================================================== */
var BIRDS = {
  bird:    { body: 20, head: 11, beak: 4,  wing: 22, tail: 12, leg: 7,  crest: 0, plump: 1.0 },
  owl:     { body: 24, head: 16, beak: 3,  wing: 20, tail: 8,  leg: 6,  crest: 2, plump: 1.15, facemask: true },
  eagle:   { body: 24, head: 12, beak: 6,  wing: 34, tail: 14, leg: 8,  crest: 0, plump: 0.95, hook: true },
  raven:   { body: 21, head: 11, beak: 7,  wing: 26, tail: 16, leg: 7,  crest: 0, plump: 0.95 },
  phoenix: { body: 22, head: 12, beak: 5,  wing: 32, tail: 26, leg: 8,  crest: 5, plump: 1.0, fire: true },
  parrot:  { body: 21, head: 12, beak: 6,  wing: 20, tail: 22, leg: 7,  crest: 4, plump: 1.05, hook: true },
  crane:   { body: 19, head: 9,  beak: 9,  wing: 26, tail: 10, leg: 22, crest: 0, plump: 0.85, neck: 16 }
};
var BIRD_ALIAS = { sparrow: "bird", hawk: "eagle", falcon: "eagle", crow: "raven", heron: "crane", duck: "bird", chicken: "bird" };

function drawBird(D, rr, p, kind, o){
  o = o || {};
  var B = BIRDS[kind] || BIRDS.bird, flip = o.flip ? -1 : 1;
  var coat = o.color || p.subject, lo = darken(coat, 0.38), hi = lighten(coat, 0.3);
  var g = D.grad(hi, lo, 120), out = [];
  var flying = o.flying;
  var groundY = 50, cy = flying ? 10 : groundY - B.leg - B.body * 0.6;
  var brx = B.body * 0.5 * B.plump, bry = B.body * 0.62;

  if (!flying) out.push(contact(D, 0, groundY + 1, brx * 1.2, p));

  /* far wing behind, near wing in front */
  var wingUp = flying ? -1 : 0.25;
  function wing(dir, up, front){
    var wl = B.wing * (front ? 1 : 0.9);
    var d = P().M(0, cy - bry * 0.3)
      .C(dir * wl * 0.45, cy - bry * 1.1 + up * wl * 0.5, dir * wl * 0.95, cy - bry * 0.4 + up * wl * 0.75, dir * wl, cy + bry * 0.25 + up * wl * 0.5)
      .C(dir * wl * 0.6, cy + bry * 0.55, dir * wl * 0.25, cy + bry * 0.4, 0, cy + bry * 0.15).Z().d;
    return pth(d, front ? g : D.grad(lo, darken(lo, 0.25), 120)) +
      stroke(P().M(dir * wl * 0.3, cy - bry * 0.1).C(dir * wl * 0.6, cy + bry * 0.1, dir * wl * 0.85, cy + bry * 0.2, dir * wl * 0.95, cy + bry * 0.28 + up * wl * 0.45).d, darken(lo, 0.3), 1, ' opacity="0.5"');
  }
  out.push(wing(-flip, wingUp, false));

  /* tail */
  out.push(pth(P().M(-brx * 0.8 * flip, cy + bry * 0.1)
    .C(-(brx + B.tail * 0.6) * flip, cy + bry * 0.1, -(brx + B.tail) * flip, cy + bry * 0.75, -(brx + B.tail * 0.95) * flip, cy + bry * 1.2)
    .C(-(brx + B.tail * 0.35) * flip, cy + bry * 0.8, -brx * 0.6 * flip, cy + bry * 0.6, -brx * 0.7 * flip, cy + bry * 0.25).Z().d,
    B.fire ? D.grad(p.trim, p.accent, 120) : g));

  /* legs */
  if (!flying && B.leg > 3){
    for (var i = -1; i <= 1; i += 2){
      out.push(stroke(P().M(i * brx * 0.3, cy + bry * 0.85).L(i * brx * 0.35, groundY - 1).d, p.trim, 2));
      out.push(stroke(P().M(i * brx * 0.35, groundY - 1).L(i * brx * 0.35 + 3 * flip, groundY).d, p.trim, 1.6));
      out.push(stroke(P().M(i * brx * 0.35, groundY - 1).L(i * brx * 0.35 - 2 * flip, groundY).d, p.trim, 1.6));
    }
  }

  /* body and head */
  var neck = B.neck || 0;
  out.push(ell(0, cy, brx, bry, g));
  out.push(ell(0, cy + bry * 0.32, brx * 0.7, bry * 0.55, lighten(coat, 0.42), ' opacity="0.7"'));
  var hx = brx * 0.62 * flip, hy = cy - bry * 0.72 - neck * 0.85;
  if (neck) out.push(stroke(P().M(brx * 0.3 * flip, cy - bry * 0.6).C(hx * 1.1, cy - bry - neck * 0.3, hx, hy + B.head * 0.6, hx, hy + B.head * 0.4).d, g, B.head * 0.42));
  var hr = B.head * 0.5;
  out.push(circ(hx, hy, hr, g));
  if (B.facemask){
    out.push(ell(hx - hr * 0.38, hy - hr * 0.05, hr * 0.5, hr * 0.62, lighten(coat, 0.5)));
    out.push(ell(hx + hr * 0.38, hy - hr * 0.05, hr * 0.5, hr * 0.62, lighten(coat, 0.5)));
  }
  if (B.crest){
    for (i = 0; i < 3; i++)
      out.push(pth(P().M(hx - hr * 0.2 + i * hr * 0.22, hy - hr * 0.8)
        .C(hx - hr * 0.1 + i * hr * 0.3, hy - hr * 1.2 - B.crest, hx + hr * 0.3 + i * hr * 0.3, hy - hr * 1.3 - B.crest, hx + hr * 0.15 + i * hr * 0.3, hy - hr * 0.7).Z().d,
        i % 2 ? p.trim : p.accent));
  }
  /* beak */
  var bx = hx + hr * 0.82 * flip;
  if (B.hook)
    out.push(pth(P().M(bx - 1 * flip, hy - hr * 0.2).C(bx + B.beak * flip, hy - hr * 0.2, bx + B.beak * flip, hy + hr * 0.3, bx + B.beak * 0.5 * flip, hy + hr * 0.6)
      .C(bx + B.beak * 0.3 * flip, hy + hr * 0.2, bx, hy + hr * 0.15, bx - 1 * flip, hy + hr * 0.1).Z().d, p.trim));
  else
    out.push(pth(P().M(bx - 1 * flip, hy - hr * 0.22).L(bx + B.beak * flip, hy + hr * 0.08).L(bx - 1 * flip, hy + hr * 0.34).Z().d, p.trim));
  out.push(eye(hx + hr * 0.18 * flip, hy - hr * 0.16, Math.max(1.5, hr * 0.26), flip));
  out.push(wing(flip, wingUp, true));
  if (B.fire){
    var gl = D.glowF(3, 1.6);
    out.push('<g filter="' + gl + '" opacity="0.8">' + ell(0, cy, brx * 1.2, bry * 1.2, p.accent, ' opacity="0.35"') + "</g>");
  }
  return out.join("");
}

/* ==========================================================================
   FAMILY: fish and sea life.
   ========================================================================== */
var FISH = {
  fish:    { len: 40, tall: 20, tail: "fan",   fin: 1.0, snout: 0.5, stripes: true },
  shark:   { len: 52, tall: 17, tail: "sickle", fin: 1.4, snout: 1.0, dorsal: 1.6 },
  whale:   { len: 60, tall: 26, tail: "fluke", fin: 0.9, snout: 1.2, blow: true },
  dolphin: { len: 48, tall: 17, tail: "fluke", fin: 1.0, snout: 1.6, beak: true },
  koi:     { len: 38, tall: 18, tail: "flow",  fin: 1.3, snout: 0.4, patches: true },
  octopus: { tent: true, head: 26 },
  jellyfish: { jelly: true, head: 22 },
  crab:    { crab: true, head: 24 }
};
var FISH_ALIAS = { goldfish: "koi", orca: "whale", trout: "fish", salmon: "fish", squid: "octopus",
                   kraken: "octopus", tentacle: "octopus", lobster: "crab", shrimp: "crab" };

function drawFish(D, rr, p, kind, o){
  o = o || {};
  var F = FISH[kind] || FISH.fish, flip = o.flip ? -1 : 1;
  var coat = o.color || p.subject, lo = darken(coat, 0.4), hi = lighten(coat, 0.32);
  var g = D.grad(hi, lo, 110), out = [], cy = 0;

  if (F.tent){
    var hr = F.head * 0.5;
    for (var i = 0; i < 7; i++){
      var a = -0.15 + i * 0.22, x = (i - 3) * hr * 0.42, sw = rr.f(0.8, 1.3);
      out.push(stroke(P().M(x, cy + hr * 0.55)
        .C(x + rr.f(-8, 8), cy + hr * 1.6, x + rr.f(-14, 14) * sw, cy + hr * 2.3, x + rr.f(-10, 10) * sw, cy + hr * 3.1).d,
        i % 2 ? lo : coat, hr * 0.2));
    }
    out.push(pth(P().M(-hr, cy + hr * 0.5).C(-hr * 1.15, cy - hr * 1.5, hr * 1.15, cy - hr * 1.5, hr, cy + hr * 0.5)
      .C(hr * 0.5, cy + hr * 0.85, -hr * 0.5, cy + hr * 0.85, -hr, cy + hr * 0.5).Z().d, g));
    out.push(eye(-hr * 0.34, cy - hr * 0.1, hr * 0.2, flip));
    out.push(eye(hr * 0.34, cy - hr * 0.1, hr * 0.2, flip));
    return out.join("");
  }
  if (F.jelly){
    var jr = F.head * 0.5, jg = D.radial(lighten(coat, 0.5), coat, 50, 30, 70, 0.9, 0.5);
    for (i = 0; i < 6; i++){
      var x2 = -jr * 0.7 + i * jr * 0.28;
      out.push(stroke(P().M(x2, cy + jr * 0.5).C(x2 + rr.f(-5, 5), cy + jr * 1.6, x2 + rr.f(-7, 7), cy + jr * 2.4, x2 + rr.f(-5, 5), cy + jr * 3.2).d, coat, 1.6, ' opacity="0.7"'));
    }
    out.push(pth(P().M(-jr, cy + jr * 0.45).C(-jr * 1.1, cy - jr * 1.3, jr * 1.1, cy - jr * 1.3, jr, cy + jr * 0.45)
      .C(jr * 0.55, cy + jr * 0.2, -jr * 0.55, cy + jr * 0.2, -jr, cy + jr * 0.45).Z().d, jg));
    return out.join("");
  }
  if (F.crab){
    var cr = F.head * 0.5;
    for (i = -1; i <= 1; i += 2){
      for (var k = 0; k < 3; k++)
        out.push(stroke(P().M(i * cr * 0.7, cy + cr * 0.2 + k * 2).C(i * cr * 1.4, cy + cr * (0.5 + k * 0.3), i * cr * 1.6, cy + cr * (1.1 + k * 0.3), i * cr * 1.3, cy + cr * (1.5 + k * 0.25)).d, lo, 2.2));
      out.push(stroke(P().M(i * cr * 0.85, cy - cr * 0.25).C(i * cr * 1.5, cy - cr * 0.6, i * cr * 1.9, cy - cr * 0.4, i * cr * 2.0, cy - cr * 0.7).d, coat, 3));
      out.push(pth(P().M(i * cr * 2.0, cy - cr * 0.7).C(i * cr * 2.5, cy - cr * 1.1, i * cr * 2.7, cy - cr * 0.3, i * cr * 2.1, cy - cr * 0.35).Z().d, g));
    }
    out.push(pth(P().M(-cr, cy + cr * 0.35).C(-cr * 1.05, cy - cr * 0.85, cr * 1.05, cy - cr * 0.85, cr, cy + cr * 0.35)
      .C(cr * 0.5, cy + cr * 0.7, -cr * 0.5, cy + cr * 0.7, -cr, cy + cr * 0.35).Z().d, g));
    out.push(dotEye(-cr * 0.35, cy - cr * 0.45, cr * 0.16));
    out.push(dotEye(cr * 0.35, cy - cr * 0.45, cr * 0.16));
    return out.join("");
  }

  var L = F.len * 0.5, H = F.tall * 0.5;
  /* tail */
  var tx = -L * flip;
  if (F.tail === "fluke")
    out.push(pth(P().M(tx * 0.85, cy).C(tx * 1.1, cy - 2, tx * 1.35, cy - H * 0.9, tx * 1.5, cy - H * 0.5)
      .C(tx * 1.3, cy, tx * 1.3, cy, tx * 1.5, cy + H * 0.5).C(tx * 1.35, cy + H * 0.9, tx * 1.1, cy + 2, tx * 0.85, cy).Z().d, g));
  else if (F.tail === "sickle")
    out.push(pth(P().M(tx * 0.9, cy).C(tx * 1.2, cy - H * 1.4, tx * 1.45, cy - H * 1.1, tx * 1.4, cy - H * 0.2)
      .C(tx * 1.45, cy + H * 0.8, tx * 1.2, cy + H * 0.7, tx * 0.9, cy + H * 0.15).Z().d, g));
  else if (F.tail === "flow")
    out.push(pth(P().M(tx * 0.85, cy).C(tx * 1.3, cy - H * 1.3, tx * 1.7, cy - H * 0.6, tx * 1.5, cy + H * 0.2)
      .C(tx * 1.7, cy + H * 1.0, tx * 1.2, cy + H * 1.3, tx * 0.85, cy + H * 0.2).Z().d, D.grad(coat, lighten(coat, 0.5), 90), ' opacity="0.9"'));
  else
    out.push(pth(P().M(tx * 0.9, cy).C(tx * 1.25, cy - H * 1.05, tx * 1.45, cy - H * 0.8, tx * 1.45, cy)
      .C(tx * 1.45, cy + H * 0.8, tx * 1.25, cy + H * 1.05, tx * 0.9, cy).Z().d, g));
  /* dorsal */
  var dor = F.dorsal || 1;
  out.push(pth(P().M(-L * 0.1 * flip, cy - H * 0.9).C(L * 0.08 * flip, cy - H * (1.1 + dor * 0.45), L * 0.35 * flip, cy - H * (0.9 + dor * 0.3), L * 0.4 * flip, cy - H * 0.75).Z().d, lo));
  /* body */
  out.push(pth(P().M(L * flip, cy).C(L * 0.85 * flip, cy - H * 0.95, -L * 0.45 * flip, cy - H * 1.02, -L * 0.88 * flip, cy - H * 0.2)
    .C(-L * 0.45 * flip, cy + H * 1.02, L * 0.85 * flip, cy + H * 0.95, L * flip, cy).Z().d, g));
  out.push(pth(P().M(L * 0.9 * flip, cy + H * 0.2).C(L * 0.3 * flip, cy + H * 0.95, -L * 0.4 * flip, cy + H * 0.9, -L * 0.85 * flip, cy + H * 0.05)
    .C(-L * 0.3 * flip, cy + H * 0.5, L * 0.4 * flip, cy + H * 0.55, L * 0.9 * flip, cy + H * 0.2).Z().d, lighten(coat, 0.5), ' opacity="0.65"'));
  /* side fin */
  out.push(pth(P().M(L * 0.25 * flip, cy + H * 0.2).C(L * 0.1 * flip, cy + H * (0.6 + F.fin * 0.4), -L * 0.15 * flip, cy + H * (0.8 + F.fin * 0.3), -L * 0.05 * flip, cy + H * 0.3).Z().d, lo, ' opacity="0.9"'));
  if (F.stripes)
    for (i = 0; i < 3; i++)
      out.push(stroke(P().M((-L * 0.25 + i * L * 0.3) * flip, cy - H * 0.82).C((-L * 0.2 + i * L * 0.3) * flip, cy, (-L * 0.3 + i * L * 0.3) * flip, cy, (-L * 0.28 + i * L * 0.3) * flip, cy + H * 0.8).d, lo, 2.4, ' opacity="0.45"'));
  if (F.patches)
    for (i = 0; i < 4; i++)
      out.push(ell(rr.f(-L * 0.6, L * 0.6) * flip, rr.f(-H * 0.5, H * 0.3), rr.f(3, 6), rr.f(2, 4), i % 2 ? p.trim : "#f5f7fb", ' opacity="0.8"'));
  if (F.beak)
    out.push(pth(P().M(L * 0.78 * flip, cy - H * 0.15).C(L * 1.15 * flip, cy - H * 0.05, L * 1.2 * flip, cy + H * 0.15, L * 0.8 * flip, cy + H * 0.25).Z().d, g));
  out.push(eye(L * 0.62 * flip, cy - H * 0.22, Math.max(1.5, H * 0.16), flip));
  if (F.blow)
    out.push(stroke(P().M(L * 0.15 * flip, cy - H * 0.95).C(L * 0.2 * flip, cy - H * 2.2, L * 0.05 * flip, cy - H * 2.6, L * 0.25 * flip, cy - H * 3.2).d, "#dff2ff", 2.4, ' opacity="0.5"'));
  return out.join("");
}

/* ==========================================================================
   FAMILY: dragons and winged reptiles.
   ========================================================================== */
function drawDragon(D, rr, p, kind, o){
  o = o || {};
  var flip = o.flip ? -1 : 1, out = [];
  var coat = o.color || p.subject, lo = darken(coat, 0.42), hi = lighten(coat, 0.28);
  var g = D.grad(hi, lo, 120);
  var membrane = D.grad(mix(coat, p.trim, 0.5), darken(coat, 0.5), 105);
  var flying = o.flying, groundY = 50;
  var cy = flying ? 4 : groundY - 30, bx = 0;

  if (!flying) out.push(contact(D, 0, groundY + 1, 28, p));

  /* tail, long and curling */
  out.push(pth(P().M(-16 * flip, cy + 4)
    .C(-34 * flip, cy - 2, -46 * flip, cy + 12, -40 * flip, cy + 26)
    .C(-36 * flip, cy + 18, -30 * flip, cy + 10, -14 * flip, cy + 10).Z().d, g));
  for (var i = 0; i < 4; i++)
    out.push(pth(P().M((-20 - i * 6) * flip, cy + 3 + i * 3).L((-22 - i * 6) * flip, cy - 3 + i * 3).L((-26 - i * 6) * flip, cy + 3 + i * 4).Z().d, p.trim, ' opacity="0.85"'));

  /* far wing */
  function wing(dir, up, front){
    var s = front ? 1 : 0.86, span = 44 * s;
    var d = P().M(0, cy - 6)
      .C(dir * span * 0.3, cy - 26 * s - up * 10, dir * span * 0.8, cy - 30 * s - up * 14, dir * span, cy - 12 * s - up * 10)
      .C(dir * span * 0.82, cy - 6, dir * span * 0.84, cy - 2, dir * span * 0.72, cy + 4 - up * 4)
      .C(dir * span * 0.62, cy - 2, dir * span * 0.6, cy - 3, dir * span * 0.48, cy + 8 - up * 2)
      .C(dir * span * 0.4, cy + 1, dir * span * 0.36, cy - 1, dir * span * 0.24, cy + 10)
      .C(dir * span * 0.16, cy + 2, dir * span * 0.1, cy + 1, 0, cy + 4).Z().d;
    var out2 = pth(d, front ? membrane : D.grad(darken(coat, 0.5), darken(coat, 0.65), 105));
    out2 += stroke(P().M(0, cy - 6).C(dir * span * 0.35, cy - 26 * s - up * 10, dir * span * 0.8, cy - 30 * s - up * 14, dir * span, cy - 12 * s - up * 10).d, lo, 2.4);
    for (var k = 1; k <= 3; k++)
      out2 += stroke(P().M(0, cy - 4).L(dir * span * (0.24 + k * 0.24), cy + 10 - k * 2 - up * 3).d, lo, 1.5, ' opacity="0.7"');
    return out2;
  }
  out.push(wing(-flip, flying ? 1 : 0.2, false));

  /* hind and fore legs */
  if (!flying){
    out.push(stroke(P().M(-8 * flip, cy + 10).C(-12 * flip, cy + 20, -10 * flip, cy + 26, -12 * flip, groundY).d, lo, 7));
    out.push(stroke(P().M(10 * flip, cy + 10).C(14 * flip, cy + 20, 12 * flip, cy + 26, 14 * flip, groundY).d, lo, 6));
    out.push(ell(-12 * flip, groundY - 1, 5.5, 2.6, darken(lo, 0.25)));
    out.push(ell(14 * flip, groundY - 1, 5, 2.4, darken(lo, 0.25)));
  }

  /* body */
  out.push(pth(P().M(-18 * flip, cy + 4).C(-16 * flip, cy - 14, 14 * flip, cy - 16, 22 * flip, cy - 4)
    .C(26 * flip, cy + 8, 8 * flip, cy + 16, -10 * flip, cy + 13).C(-16 * flip, cy + 12, -19 * flip, cy + 9, -18 * flip, cy + 4).Z().d, g));
  out.push(pth(P().M(-12 * flip, cy + 7).C(0, cy + 15, 12 * flip, cy + 13, 20 * flip, cy + 1)
    .C(10 * flip, cy + 8, -2 * flip, cy + 10, -12 * flip, cy + 7).Z().d, lighten(coat, 0.42), ' opacity="0.5"'));

  /* neck and head */
  var hx = 34 * flip, hy = cy - 24;
  out.push(stroke(P().M(16 * flip, cy - 8).C(26 * flip, cy - 14, 30 * flip, cy - 20, hx - 2 * flip, hy + 6).d, g, 12));
  out.push(pth(P().M(hx - 9 * flip, hy - 1).C(hx - 4 * flip, hy - 8, hx + 8 * flip, hy - 8, hx + 12 * flip, hy - 1)
    .C(hx + 20 * flip, hy + 2, hx + 20 * flip, hy + 6, hx + 11 * flip, hy + 7)
    .C(hx + 2 * flip, hy + 9, hx - 7 * flip, hy + 6, hx - 9 * flip, hy - 1).Z().d, g));
  /* horns */
  out.push(pth(P().M(hx - 2 * flip, hy - 6).C(hx - 4 * flip, hy - 14, hx - 10 * flip, hy - 16, hx - 14 * flip, hy - 18).L(hx - 6 * flip, hy - 5).Z().d, p.trim));
  out.push(pth(P().M(hx + 3 * flip, hy - 6).C(hx + 2 * flip, hy - 13, hx - 4 * flip, hy - 17, hx - 8 * flip, hy - 20).L(hx - 1 * flip, hy - 5).Z().d, lighten(p.trim, 0.2)));
  /* jaw */
  out.push(pth(P().M(hx + 8 * flip, hy + 4).C(hx + 16 * flip, hy + 5, hx + 19 * flip, hy + 8, hx + 10 * flip, hy + 8).Z().d, lo));
  for (i = 0; i < 3; i++)
    out.push(pth(P().M((hx + 8 + i * 3.4) * flip, hy + 4.5).L((hx + 9.4 + i * 3.4) * flip, hy + 8).L((hx + 10.6 + i * 3.4) * flip, hy + 4.5).Z().d, "#f7fbff"));
  out.push(eye(hx + 2 * flip, hy - 1, 2.6, flip));
  /* back spines */
  for (i = 0; i < 5; i++){
    var sx = (18 - i * 8) * flip, sy = cy - 14 + i * 1.4;
    out.push(pth(P().M(sx, sy).L(sx - 2 * flip, sy - 8 + i * 0.8).L(sx - 6 * flip, sy).Z().d, p.trim, ' opacity="0.9"'));
  }
  out.push(wing(flip, flying ? 1 : 0.2, true));
  if (o.fire){
    var fg = D.grad("#ffe9a8", "#ff6a2a", 0), gl = D.glowF(4, 1.8);
    out.push('<g filter="' + gl + '">' + pth(P().M((hx + 12) * flip, hy + 2).C((hx + 34) * flip, hy - 4, (hx + 52) * flip, hy + 8, (hx + 70) * flip, hy + 4)
      .C((hx + 50) * flip, hy + 16, (hx + 28) * flip, hy + 14, (hx + 12) * flip, hy + 8).Z().d, fg, ' opacity="0.92"') + "</g>");
  }
  return out.join("");
}

/* ---------- measuring what was actually drawn ---------------------------
   Guessing each form's size never held up: a dragon's wings are twice as wide
   as its body, a lighthouse is all height. So read the numbers back out of the
   markup and fit the real box. Every coordinate the kit emits is absolute and
   in x,y order, which is what makes this reliable. */
function measureBody(body){
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function hit(x, y){
    if (!isFinite(x) || !isFinite(y)) return;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  var NUM = /-?\d*\.?\d+(?:e-?\d+)?/gi, m;

  var re = /<path\b[^>]*\sd="([^"]*)"[^>]*>/gi;
  while ((m = re.exec(body))){
    var d = m[1], nums = d.match(NUM);
    if (!nums) continue;
    /* pad by the stroke so a thick outline is not clipped */
    var sw = (/stroke-width="([\d.]+)"/.exec(m[0]) || [0, 0])[1] * 0.5;
    for (var i = 0; i + 1 < nums.length; i += 2){
      var x = parseFloat(nums[i]), y = parseFloat(nums[i + 1]);
      hit(x - sw, y - sw); hit(x + sw, y + sw);
    }
  }
  re = /<circle\b[^>]*>/gi;
  while ((m = re.exec(body))){
    var cx = parseFloat((/\scx="(-?[\d.]+)"/.exec(m[0]) || [0, 0])[1]);
    var cy = parseFloat((/\scy="(-?[\d.]+)"/.exec(m[0]) || [0, 0])[1]);
    var r = parseFloat((/\sr="([\d.]+)"/.exec(m[0]) || [0, 0])[1]);
    hit(cx - r, cy - r); hit(cx + r, cy + r);
  }
  re = /<ellipse\b[^>]*>/gi;
  while ((m = re.exec(body))){
    var ex = parseFloat((/\scx="(-?[\d.]+)"/.exec(m[0]) || [0, 0])[1]);
    var ey = parseFloat((/\scy="(-?[\d.]+)"/.exec(m[0]) || [0, 0])[1]);
    var rx = parseFloat((/\srx="([\d.]+)"/.exec(m[0]) || [0, 0])[1]);
    var ry = parseFloat((/\sry="([\d.]+)"/.exec(m[0]) || [0, 0])[1]);
    hit(ex - rx, ey - ry); hit(ex + rx, ey + ry);
  }
  re = /<rect\b[^>]*>/gi;
  while ((m = re.exec(body))){
    var rxx = parseFloat((/\sx="(-?[\d.]+)"/.exec(m[0]) || [0, 0])[1]);
    var ryy = parseFloat((/\sy="(-?[\d.]+)"/.exec(m[0]) || [0, 0])[1]);
    var w = parseFloat((/\swidth="([\d.]+)"/.exec(m[0]) || [0, 0])[1]);
    var h = parseFloat((/\sheight="([\d.]+)"/.exec(m[0]) || [0, 0])[1]);
    hit(rxx, ryy); hit(rxx + w, ryy + h);
  }
  if (!isFinite(minX)) return { x: -50, y: -50, w: 100, h: 100, cx: 0, cy: 0, maxY: 50 };
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY),
           cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, maxY: maxY, minY: minY };
}

/* Place a drawn form so its real box fits the target, sitting on (x, y) for
   ground forms or centred on it otherwise. */
function fitPlace(x, y, targetW, targetH, body, mode, flip){
  var b = measureBody(body);
  var s = Math.min(targetW / b.w, targetH / b.h);
  var oy = mode === "ground" ? b.maxY : b.cy;
  var t = "translate(" + n2(x) + " " + n2(y) + ") scale(" + n2(s * (flip ? -1 : 1)) + " " + n2(s) +
          ") translate(" + n2(-b.cx) + " " + n2(-oy) + ")";
  return { svg: grp(t, body), scale: s, box: b };
}
