/* ==========================================================================
   Scene composition: sky, far, mid, ground, foreground and atmosphere.
   The subject placer lives here too, so everything that decides *where*
   things go is in one file.
   ========================================================================== */

/* ---------- which draw function handles a concept ------------------------ */
/* nominal drawn height in local units, used to scale to a target frame share */
var FAM_H = { quad: 48, bird: 46, fish: 42, human: 66, dragon: 60, craft: 80, vehicle: 42,
              boat: 70, air: 78, build: 62, plant: 70, sky: 80, ground: 55, float: 70, prop: 56 };
var FAM_ANCHOR = { quad: 50, bird: 50, fish: 0, human: 50, dragon: 50, craft: 0, vehicle: 50,
                   boat: 26, air: 0, build: 50, plant: 50, sky: 0, ground: 50, float: 0, prop: 0 };
/* forms that stand on something, as opposed to floating or being centred */
var GROUND_FAM = { quad: 1, bird: 1, human: 1, dragon: 1, vehicle: 1, build: 1, plant: 1, ground: 1, boat: 1 };

/* Per-word looks, so a tiger is not just "a cat" and a whale is not "a fish". */
var VARIANT = {
  tiger:  { base: "#e2892c", mark: "stripe" }, lion: { base: "#d6a45c", mark: "none" },
  panther:{ base: "#2c2f3e", mark: "none" },   lynx: { base: "#b89a78", mark: "spot" },
  fox:    { base: "#e07634", mark: "patch" },  wolf: { base: "#8b94a6", mark: "none" },
  husky:  { base: "#c9d3e2", mark: "patch" },  coyote: { base: "#b08a5e", mark: "none" },
  panda:  { base: "#f2f4f8", mark: "patch" },  grizzly: { base: "#8a5f3c", mark: "none" },
  unicorn:{ base: "#f5f1fa", mark: "none" },   pegasus: { base: "#eef2fb", mark: "none" },
  deer:   { base: "#b57f4c", mark: "spot" },   stag: { base: "#a97244", mark: "spot" },
  elk:    { base: "#8d6440", mark: "none" },   hare: { base: "#c2ae92", mark: "none" },
  mammoth:{ base: "#8a6a4e", mark: "none" },   rhino: { base: "#9aa3b0", mark: "none" },
  hippo:  { base: "#a07d95", mark: "none" },   cow: { base: "#f2f4f8", mark: "patch" },
  bull:   { base: "#4a3a34", mark: "none" },   pig: { base: "#f0a9b4", mark: "none" },
  goat:   { base: "#e6e0d2", mark: "none" },   gorilla: { base: "#33333f", mark: "none" },
  chimp:  { base: "#6b4f3a", mark: "none" },   snake: { base: "#4f9a4a", mark: "stripe" },
  cobra:  { base: "#5a8f44", mark: "stripe" }, viper: { base: "#7a7040", mark: "spot" },
  gecko:  { base: "#57b06a", mark: "spot" },   chameleon: { base: "#4fae7c", mark: "spot" },
  trex:   { base: "#6d8a52", mark: "stripe" }, raptor: { base: "#8a7a46", mark: "stripe" },
  kitten: { base: "" }, puppy: { base: "" },
  orca:   { base: "#1d2432", mark: "patch" },  goldfish: { base: "#f08a2c" },
  eagle:  { base: "#6b4f38" }, raven: { base: "#2a2c3a" }, crow: { base: "#2a2c3a" },
  owl:    { base: "#a58259" }, phoenix: { base: "#f0602a" }, parrot: { base: "#2fae63" },
  penguin:{ base: "#252b3a" }, puffin: { base: "#2a3040" },
  whale:  { base: "#4a6d8f" }, dolphin: { base: "#7d98b5" }, shark: { base: "#6f7f92" },
  koi:    { base: "#f2f5fa" }, octopus: { base: "#c05a8f" }, squid: { base: "#b5548a" },
  kraken: { base: "#5a4a7a" }, crab: { base: "#d9553f" }, lobster: { base: "#c0442f" },
  jellyfish: { base: "#b79ae8" }, turtle: { base: "#4f8f5f" }, tortoise: { base: "#7a7a4f" },
  frog:   { base: "#5aab4a" }, toad: { base: "#8a8a52" }, bat: { base: "#3a3244" },
  spider: { base: "#2f2a38" }, sheep: { base: "#eef0f5" }, lamb: { base: "#f2f4f8" },
  elephant: { base: "#8d97a5" }, monkey: { base: "#8a6040" }, seal: { base: "#7d8a9c" },
  walrus: { base: "#8a7060" }, otter: { base: "#7a5a42" }, rabbit: { base: "#d8cbb8" },
  bunny:  { base: "#ebe3d6" }, bear: { base: "#7d5a3c" }, horse: { base: "#8a5f3f" },
  dinosaur: { base: "#6d8a52", mark: "stripe" }, lizard: { base: "#59a05c", mark: "spot" }
};

function formFor(concept, word){
  /* the exact word wins, so "whale" picks the whale and not the generic fish */
  if (word && word !== concept){
    if (QUAD[word]) return { fn: drawQuadruped, kind: word, fam: "quad", variant: VARIANT[word] };
    if (QUAD_ALIAS[word]) return { fn: drawQuadruped, kind: QUAD_ALIAS[word], fam: "quad", variant: VARIANT[word] };
    if (BIRDS[word]) return { fn: drawBird, kind: word, fam: "bird", variant: VARIANT[word] };
    if (BIRD_ALIAS[word]) return { fn: drawBird, kind: BIRD_ALIAS[word], fam: "bird", variant: VARIANT[word] };
    if (FISH[word]) return { fn: drawFish, kind: word, fam: "fish", variant: VARIANT[word] };
    if (FISH_ALIAS[word]) return { fn: drawFish, kind: FISH_ALIAS[word], fam: "fish", variant: VARIANT[word] };
    if (HUMANS[word]) return { fn: drawHuman, kind: word, fam: word === "skull" ? "prop" : "human" };
    if (HUMAN_ALIAS[word]) return { fn: drawHuman, kind: HUMAN_ALIAS[word], fam: HUMAN_ALIAS[word] === "skull" ? "prop" : "human" };
    if (word === "pine" || word === "palm") return { fn: drawTree, kind: word, fam: "plant" };
  }
  if (QUAD[concept]) return { fn: drawQuadruped, kind: concept, fam: "quad", variant: VARIANT[concept] };
  if (QUAD_ALIAS[concept]) return { fn: drawQuadruped, kind: QUAD_ALIAS[concept], fam: "quad", variant: VARIANT[concept] };
  if (BIRDS[concept]) return { fn: drawBird, kind: concept, fam: "bird", variant: VARIANT[concept] };
  if (BIRD_ALIAS[concept]) return { fn: drawBird, kind: BIRD_ALIAS[concept], fam: "bird" };
  if (FISH[concept]) return { fn: drawFish, kind: concept, fam: "fish", variant: VARIANT[concept] };
  if (FISH_ALIAS[concept]) return { fn: drawFish, kind: FISH_ALIAS[concept], fam: "fish" };
  if (HUMANS[concept]) return { fn: drawHuman, kind: concept, fam: concept === "skull" ? "prop" : "human" };
  if (HUMAN_ALIAS[concept]) return { fn: drawHuman, kind: HUMAN_ALIAS[concept], fam: HUMAN_ALIAS[concept] === "skull" ? "prop" : "human" };
  var table = {
    dragon: [drawDragon, "dragon", "dragon"],
    rocket: [drawRocket, "rocket", "craft"], rocketship: [drawRocket, "rocket", "craft"],
    spaceship: [drawSpaceship, "spaceship", "craft"], satellite: [drawSpaceship, "spaceship", "craft"],
    plane: [drawPlane, "plane", "craft"], car: [drawVehicle, "car", "vehicle"],
    train: [drawVehicle, "truck", "vehicle"], bike: [drawVehicle, "car", "vehicle"],
    boat: [drawBoat, "boat", "boat"], balloon: [drawBalloon, "balloon", "air"],
    house: [drawHouse, "house", "build"], castle: [drawCastle, "castle", "build"],
    lighthouse: [drawTower, "lighthouse", "build"], windmill: [drawTower, "tower", "build"],
    tree: [drawTree, "tree", "plant"], flower: [drawFlower, "flower", "plant"],
    mushroom: [drawMushroom, "mushroom", "plant"], cactus: [drawCactus, "cactus", "plant"],
    planet: [drawPlanetBody, "planet", "sky"], moon: [drawPlanetBody, "moon", "sky"],
    sun: [drawPlanetBody, "sun", "sky"], star: [drawPlanetBody, "star", "sky"],
    crystal: [drawCrystal, "crystal", "ground"], campfire: [drawFire, "campfire", "ground"],
    portal: [drawPortal, "portal", "float"], orb: [drawProp, "orb", "float"],
    slime: [drawProp, "orb", "ground"], ghost: [drawHuman, "ghost", "human"],
    skull: [drawHuman, "skull", "prop"], butterfly: [drawButterfly, "butterfly", "air"],
    octopus: [drawFish, "octopus", "fish"], crab: [drawFish, "crab", "fish"]
  };
  if (table[concept]) return { fn: table[concept][0], kind: table[concept][1], fam: table[concept][2] };
  var props = { sword: 1, shield: 1, crown: 1, key: 1, book: 1, lantern: 1, coffee: 1, guitar: 1,
                controller: 1, computer: 1, heart: 1, cake: 1, cube: 1, eye: 1, gear: 1, phone: 1,
                clock: 1, potion: 1, camera: 1, headphones: 1, piano: 1, trophy: 1, mask: 1,
                compass: 1, axe: 1, bow: 1, wand: 1, ring: 1, dice: 1, chess: 1, pizza: 1, fruit: 1 };
  if (props[concept]) return { fn: drawProp, kind: concept, fam: "prop" };
  /* A few more that map cleanly onto something the kit already draws well */
  var LOOSE = { bridge: ["bridge", "build"], tent: ["tent", "build"], lab: ["potion", "prop"],
                telescope: ["telescope", "build"], pyramid: ["pyramid", "build"],
                atom: ["orb", "prop"], brain: ["orb", "prop"], dna: ["crystal", "ground"],
                chip: ["cube", "prop"], slime: ["orb", "prop"], egg: ["orb", "prop"],
                rock: ["rock", "ground"], crystal: ["crystal", "ground"], gun: ["sword", "prop"],
                anchor: ["anchor", "prop"], scales: ["scales", "prop"], feather: ["feather", "prop"],
                umbrella: ["umbrella", "prop"], kite: ["kite", "prop"], card: ["book", "prop"],
                vine: ["tree", "plant"], bone: ["skull", "prop"], balloon2: ["balloon", "air"] };
  if (LOOSE[concept]){
    var L = LOOSE[concept], fam = L[1];
    var fn = fam === "build" ? drawStructure : fam === "ground" ? (L[0] === "crystal" ? drawCrystal : drawRock)
           : fam === "plant" ? drawTree : fam === "air" ? drawBalloon : drawProp;
    return { fn: fn, kind: L[0], fam: fam };
  }
  /* Nothing here draws it. Drawing a generic sphere instead is worse than
     leaving it out and letting the scene speak. */
  return null;
}

/* butterflies get their own little routine, they are too distinctive to fake */
function drawButterfly(D, rr, p, kind, o){
  o = o || {};
  var c = o.color || p.accent, c2 = p.accent2, out = [];
  var wg = D.grad(lighten(c, 0.3), darken(c, 0.3), 118), wg2 = D.grad(lighten(c2, 0.3), darken(c2, 0.35), 118);
  for (var s = -1; s <= 1; s += 2){
    out.push(pth(P().M(0, -2).C(s * 10, -26, s * 32, -30, s * 30, -10).C(s * 28, 0, s * 12, 2, 0, 2).Z().d, wg));
    out.push(pth(P().M(0, 2).C(s * 10, 10, s * 26, 16, s * 22, 22).C(s * 16, 27, s * 6, 14, 0, 6).Z().d, wg2));
    out.push(circ(s * 18, -14, 3.6, "#ffffff", ' opacity="0.45"'));
    out.push(circ(s * 22, -9, 2.2, darken(c, 0.45), ' opacity="0.65"'));
    out.push(stroke(P().M(0, -6).C(s * 5, -18, s * 9, -24, s * 13, -26).d, "#2b2434", 1.1));
  }
  out.push(ell(0, 0, 2.6, 13, D.grad("#4a3f52", "#241e2e", 110)));
  out.push(circ(0, -12, 3, "#241e2e"));
  return out.join("");
}

/* ---------- sky ---------------------------------------------------------- */
function paintSky(D, S, W, H){
  var p = S.palette, rr = S.rr, out = [];
  var g = D.grad(p.skyTop, p.skyLow, 90,
    '<stop offset="0" stop-color="' + p.skyTop + '"/><stop offset="0.55" stop-color="' + p.skyMid +
    '"/><stop offset="1" stop-color="' + p.skyLow + '"/>');
  out.push(rct(0, 0, W, H, g));

  if (S.time === "space"){
    /* nebula wash */
    for (var i = 0; i < 3; i++){
      var nx = rr.f(0.15, 0.85) * W, ny = rr.f(0.1, 0.6) * H, nr = rr.f(0.22, 0.44) * W;
      var ng = D.radial(i % 2 ? p.accent : p.accent2, p.skyTop, 50, 50, 60, 0.3, 0);
      out.push(ell(nx, ny, nr, nr * rr.f(0.5, 0.85), ng));
    }
  }
  if (p.dark || S.time === "space"){
    var n = S.time === "space" ? 150 : 90;
    for (i = 0; i < n; i++){
      var x = rr.f(0, W), y = rr.f(0, H * (S.time === "space" ? 1 : 0.72)), r = rr.f(0.5, 1.9);
      out.push(circ(x, y, r, "#ffffff", ' opacity="' + n2(rr.f(0.25, 0.95)) + '"'));
    }
    for (i = 0; i < 4; i++){
      var bx = rr.f(0.1, 0.9) * W, by = rr.f(0.05, 0.5) * H;
      var bg = D.radial("#ffffff", "#ffffff", 50, 50, 50, 0.85, 0);
      out.push(circ(bx, by, rr.f(4, 8), bg));
    }
  }

  /* the light source itself */
  var sunX = W * (S.rr.chance(0.5) ? 0.26 : 0.74), sunY;
  if (S.time === "day"){ sunY = H * 0.16; }
  else if (S.time === "golden"){ sunY = H * 0.42; }
  else if (S.time === "dawn"){ sunY = H * 0.44; }
  else sunY = H * 0.2;
  S.sunX = sunX; S.sunY = sunY;

  if (S.time !== "space" && S.time !== "under"){
    var halo = D.radial(p.sun, p.sun, 50, 50, 50, p.dark ? 0.32 : 0.55, 0);
    out.push(circ(sunX, sunY, W * (p.dark ? 0.16 : 0.26), halo));
    if (p.dark){
      out.push(circ(sunX, sunY, W * 0.033, "#f2f5ff"));
      out.push(circ(sunX + W * 0.012, sunY - W * 0.008, W * 0.026, p.skyTop, ' opacity="0.85"'));
    } else {
      out.push(circ(sunX, sunY, W * (S.time === "golden" ? 0.05 : 0.036), p.sun));
    }
  }

  /* clouds */
  var clouds = S.weather === "clear" ? 3 : S.weather === "storm" ? 7 : S.weather === "fog" ? 2 : 5;
  if (S.time === "space" || S.under) clouds = 0;
  var cloudC = S.weather === "storm" ? darken(p.skyMid, 0.45) : (p.dark ? mix(p.skyMid, "#ffffff", 0.22) : mix("#ffffff", p.skyLow, 0.18));
  for (i = 0; i < clouds; i++){
    var cx = rr.f(-0.05, 1.05) * W, cy2 = rr.f(0.06, 0.46) * H, cs = rr.f(0.55, 1.5);
    var cg = D.grad(lighten(cloudC, 0.18), darken(cloudC, 0.12), 100);
    var puff = "";
    for (var k = 0; k < 5; k++)
      puff += ell(cx + (k - 2) * 24 * cs, cy2 + Math.abs(k - 2) * 5 * cs, (26 - Math.abs(k - 2) * 5) * cs, (15 - Math.abs(k - 2) * 2.4) * cs, cg);
    out.push('<g opacity="' + n2(rr.f(0.55, 0.92)) + '">' + puff + "</g>");
  }
  if (S.setting === "space" || S.time === "space"){
    /* a distant planet for scale */
    var pg = D.radial(lighten(p.accent, 0.3), darken(p.accent, 0.6), 34, 30, 74);
    var px = W * rr.f(0.1, 0.3), py = H * rr.f(0.12, 0.3), pr = W * rr.f(0.06, 0.11);
    out.push(circ(px, py, pr, pg));
    out.push(circ(px, py, pr, "none", ' stroke="' + lighten(p.accent, 0.4) + '" stroke-width="1" opacity="0.3"'));
  }
  return out.join("");
}

/* ---------- far and mid layers ------------------------------------------ */
function ridge(D, S, W, y, height, color, seed, jag){
  var rr = mk(rng(seed)), pts = [], steps = 9;
  var d = P().M(0, y + height);
  for (var i = 0; i <= steps; i++){
    var x = W * i / steps;
    var peak = y - height * rr.f(0.25, 1.0) * (jag || 1);
    pts.push([x, peak]);
  }
  d.L(pts[0][0], pts[0][1]);
  for (i = 1; i < pts.length; i++){
    var px = pts[i - 1], cx = pts[i];
    var mx = (px[0] + cx[0]) / 2;
    d.C(mx, px[1], mx, cx[1], cx[0], cx[1]);
  }
  d.L(W, y + height).Z();
  return pth(d.d, color);
}
function paintInterior(D, S, W, H){
  var p = S.palette, rr = S.rr, out = [], hz = S.horizon;
  var wallC = mix(p.groundHi, p.skyLow, 0.55);
  out.push(rct(0, 0, W, hz + H * 0.02, D.grad(lighten(wallC, 0.18), darken(wallC, 0.12), 100)));
  /* window with the outside showing through */
  var wx = W * rr.f(0.12, 0.48), wy = H * 0.12, ww = W * 0.34, wh = H * 0.32;
  out.push(rct(wx - 8, wy - 8, ww + 16, wh + 16, darken(wallC, 0.42), 6));
  out.push(rct(wx, wy, ww, wh, D.grad(p.skyTop, p.skyLow, 90,
    '<stop offset="0" stop-color="' + p.skyTop + '"/><stop offset="0.6" stop-color="' + p.skyMid +
    '"/><stop offset="1" stop-color="' + p.skyLow + '"/>'), 3));
  out.push(circ(wx + ww * 0.68, wy + wh * 0.28, ww * 0.09, p.sun, ' opacity="0.9"'));
  for (var i = 0; i < 3; i++)
    out.push(ell(wx + ww * rr.f(0.1, 0.8), wy + wh * rr.f(0.45, 0.85), ww * rr.f(0.1, 0.22), wh * rr.f(0.05, 0.1),
      darken(p.foliage, 0.2), ' opacity="0.8"'));
  out.push(rct(wx + ww * 0.5 - 2, wy, 4, wh, darken(wallC, 0.42)));
  out.push(rct(wx, wy + wh * 0.5 - 2, ww, 4, darken(wallC, 0.42)));
  /* light pooling on the floor from the window */
  out.push(pth(P().M(wx, hz).L(wx + ww, hz).L(wx + ww * 1.5, H).L(wx - ww * 0.3, H).Z().d,
    D.grad(p.sun, p.sun, 90, '<stop offset="0" stop-color="' + p.sun + '" stop-opacity="0.3"/><stop offset="1" stop-color="' + p.sun + '" stop-opacity="0"/>')));
  /* skirting and floor */
  out.push(rct(0, hz, W, H - hz, D.grad(mix("#8a6446", p.groundHi, 0.3), darken("#5c4230", 0.25), 90)));
  for (i = 0; i < 9; i++)
    out.push(stroke(P().M(0, hz + (H - hz) * Math.pow(i / 8, 1.5)).L(W, hz + (H - hz) * Math.pow(i / 8, 1.5)).d,
      darken("#5c4230", 0.4), 1.2, ' opacity="0.35"'));
  out.push(rct(0, hz - H * 0.02, W, H * 0.022, darken(wallC, 0.35)));
  return out.join("");
}

function paintFar(D, S, W, H){
  var p = S.palette, rr = S.rr, out = [], hz = S.horizon;
  if (S.setting === "interior") return paintInterior(D, S, W, H);
  if (S.time === "space") return "";
  if (S.setting === "mountain" || S.setting === "snowland" || S.setting === "volcano"){
    out.push(ridge(D, S, W, hz - H * 0.1, H * 0.3, D.grad(p.far, mix(p.far, p.skyLow, 0.5), 90), S.seed ^ 11, 1.15));
    out.push(ridge(D, S, W, hz - H * 0.03, H * 0.23, D.grad(mix(p.far, p.groundLo, 0.55), p.far, 90), S.seed ^ 22, 1.0));
    /* snow caps */
    if (S.setting === "snowland" || S.time !== "night")
      out.push('<g opacity="0.55" clip-path="none">' + ridge(D, S, W, hz - H * 0.14, H * 0.1, "#eef4fc", S.seed ^ 11, 1.15) + "</g>");
  } else if (S.setting === "city"){
    var n = 16, bg = D.grad(mix(p.far, p.skyLow, 0.35), p.far, 90);
    var s = "";
    for (var i = 0; i < n; i++){
      var bw = W / n * rr.f(0.7, 1.25), bx = W * i / n, bh = H * rr.f(0.1, 0.32);
      s += rct(bx, hz - bh, bw, bh + 4, bg);
      if (p.dark)
        for (var k = 0; k < 8; k++)
          if (rr.chance(0.42))
            s += rct(bx + 3 + (k % 3) * (bw / 3.4), hz - bh + 6 + Math.floor(k / 3) * (bh / 4.2), 2.6, 3.4, "#ffe9a8", 0, ' opacity="' + n2(rr.f(0.4, 0.95)) + '"');
    }
    out.push(s);
  } else if (S.setting === "forest"){
    out.push(ridge(D, S, W, hz - H * 0.02, H * 0.14, D.grad(mix(p.far, p.foliageDark, 0.5), p.far, 90), S.seed ^ 33, 0.7));
  } else if (S.setting === "desert"){
    out.push(ridge(D, S, W, hz + H * 0.01, H * 0.1, D.grad(lighten(p.groundHi, 0.24), p.groundHi, 90), S.seed ^ 44, 0.55));
  } else {
    out.push(ridge(D, S, W, hz + H * 0.005, H * 0.09, D.grad(p.far, mix(p.far, p.groundHi, 0.6), 90), S.seed ^ 55, 0.6));
  }
  /* atmospheric haze right at the horizon line */
  out.push(rct(0, hz - H * 0.09, W, H * 0.12, D.grad(p.skyLow, p.skyLow, 90,
    '<stop offset="0" stop-color="' + p.skyLow + '" stop-opacity="0"/><stop offset="1" stop-color="' + p.skyLow + '" stop-opacity="0.5"/>')));
  return out.join("");
}

function paintGround(D, S, W, H){
  var p = S.palette, rr = S.rr, out = [], hz = S.horizon;
  if (S.setting === "interior") return "";
  if (S.time === "space"){
    /* an asteroid shelf so subjects have something to stand on */
    out.push(pth(P().M(0, H).L(0, hz + H * 0.16).C(W * 0.3, hz + H * 0.05, W * 0.7, hz + H * 0.2, W, hz + H * 0.1).L(W, H).Z().d,
      D.grad(p.groundHi, p.groundLo, 90)));
    return out.join("");
  }
  if (S.under){
    out.push(pth(P().M(0, H).L(0, hz + H * 0.1).C(W * 0.35, hz - H * 0.02, W * 0.65, hz + H * 0.14, W, hz + H * 0.04).L(W, H).Z().d,
      D.grad(lighten(p.groundHi, 0.2), p.groundLo, 90)));
    for (var i = 0; i < 16; i++){
      var bx = rr.f(0, W), bs = rr.f(0.5, 1.4);
      out.push(stroke(P().M(bx, H).C(bx + 8 * bs, H - 30 * bs, bx - 8 * bs, H - 55 * bs, bx + 5 * bs, H - 80 * bs).d,
        mix(p.foliage, p.water, 0.4), 4 * bs, ' opacity="0.7"'));
    }
    return out.join("");
  }
  var water = S.setting === "ocean" || S.setting === "lake";
  if (water){
    var wg = D.grad(mix(p.water, p.skyLow, 0.45), darken(p.water, 0.3), 90);
    out.push(rct(0, hz, W, H - hz, wg));
    /* sun glitter path and horizontal ripples */
    var sx = S.sunX === undefined ? W * 0.5 : S.sunX;
    for (i = 0; i < 26; i++){
      var ry = hz + Math.pow(i / 26, 1.7) * (H - hz) * 1.02;
      var spread = 8 + i * 5;
      out.push(rct(sx - spread * 0.5 + rr.f(-6, 6), ry, spread * rr.f(0.4, 1.0), Math.max(1, i * 0.14), p.sun, 1,
        ' opacity="' + n2(0.5 - i * 0.015) + '"'));
    }
    for (i = 0; i < 14; i++){
      var ly = hz + Math.pow(i / 14, 1.6) * (H - hz);
      out.push(rct(rr.f(0, W * 0.8), ly, rr.f(W * 0.08, W * 0.3), Math.max(1, i * 0.2), "#ffffff", 1, ' opacity="' + n2(rr.f(0.05, 0.2)) + '"'));
    }
    if (S.setting === "ocean"){
      /* a few breaking waves near the bottom */
      for (i = 0; i < 3; i++){
        var wy = H - (i + 1) * (H - hz) * 0.18;
        out.push(stroke(P().M(-10, wy).C(W * 0.3, wy - 8, W * 0.7, wy + 8, W + 10, wy - 4).d, "#ffffff", 2.4 + i, ' opacity="' + n2(0.16 + i * 0.07) + '"'));
      }
    }
    return out.join("");
  }
  var gg = D.grad(p.groundHi, p.near, 90);
  out.push(pth(P().M(0, H).L(0, hz + H * 0.01).C(W * 0.3, hz - H * 0.015, W * 0.72, hz + H * 0.025, W, hz).L(W, H).Z().d, gg));
  /* a lighter band where the light hits the ground */
  out.push(rct(0, hz, W, (H - hz) * 0.3, D.grad(p.light, p.light, 90,
    '<stop offset="0" stop-color="' + p.light + '" stop-opacity="0.22"/><stop offset="1" stop-color="' + p.light + '" stop-opacity="0"/>')));
  if (S.setting === "desert"){
    for (i = 0; i < 5; i++){
      var dy = hz + (H - hz) * (0.1 + i * 0.2);
      out.push(stroke(P().M(-10, dy).C(W * 0.3, dy - 10, W * 0.7, dy + 8, W + 10, dy - 6).d, darken(p.groundHi, 0.14), 2, ' opacity="0.4"'));
    }
  } else if (S.setting === "snowland"){
    for (i = 0; i < 40; i++)
      out.push(circ(rr.f(0, W), rr.f(hz, H), rr.f(0.8, 2.2), "#ffffff", ' opacity="' + n2(rr.f(0.2, 0.6)) + '"'));
  }
  return out.join("");
}

/* ---------- midground props --------------------------------------------- */
/* anchor is the local y that should sit on (x, y). Ground-standing forms draw
   their feet at local y = 50; centred forms use 0. */
function place(D, S, x, y, scale, inner, flip, anchor){
  anchor = anchor === undefined ? 50 : anchor;
  var t = "translate(" + n2(x) + " " + n2(y) + ") scale(" + n2(scale * (flip ? -1 : 1)) + " " + n2(scale) +
          ") translate(0 " + n2(-anchor) + ")";
  return grp(t, inner);
}
function paintMid(D, S, W, H){
  var p = S.palette, rr = S.rr, out = [], hz = S.horizon;
  var depth = H - hz;
  var kind = S.setting;
  if (kind === "interior") return "";

  function scatter(count, fn, yLo, yHi, sLo, sHi, avoidMid){
    for (var i = 0; i < count; i++){
      var x = rr.f(0.02, 0.98) * W;
      if (avoidMid && Math.abs(x - W * 0.5) < W * 0.16){ x += (x < W * 0.5 ? -1 : 1) * W * 0.2; }
      var t = rr.f(0, 1);
      var y = hz + depth * (yLo + (yHi - yLo) * t);
      var s = (sLo + (sHi - sLo) * t) * (W / 1024);
      var d2 = new Draw();
      var body = fn(d2, rr, p, y, s);
      var o = d2.out();
      if (o.defs) D.def(o.defs);
      out.push('<g opacity="' + n2(0.75 + 0.25 * t) + '">' + place(D, S, x, y, s, o.body + body, rr.chance(0.5)) + "</g>");
    }
  }

  if (kind === "forest"){
    for (var i = 0; i < 9; i++){
      var t = i / 8, x = rr.f(0.02, 0.98) * W;
      if (Math.abs(x - W * 0.5) < W * 0.13) x += (x < W * 0.5 ? -1 : 1) * W * 0.18;
      var y = hz + depth * rr.f(0.02, 0.5), s = rr.f(0.5, 1.05) * (W / 1024);
      var d2 = new Draw();
      var body = drawTree(d2, rr, p, rr.chance(0.5) ? "pine" : "tree", { h: 80, color: shift(mix(p.foliage, p.skyLow, 0.12 + t * 0.2), rr.f(-16, 16), 0, rr.f(-0.04, 0.12)) });
      var o = d2.out(); if (o.defs) D.def(o.defs);
      out.push(place(D, S, x, y, s, body, rr.chance(0.5)));
    }
  } else if (kind === "field" || kind === "swamp"){
    for (i = 0; i < 4; i++){
      var x2 = rr.f(0.04, 0.96) * W;
      if (Math.abs(x2 - W * 0.5) < W * 0.16) x2 += (x2 < W * 0.5 ? -1 : 1) * W * 0.2;
      var y2 = hz + depth * rr.f(0.02, 0.3), s2 = rr.f(0.4, 0.72) * (W / 1024);
      var d3 = new Draw(), b3 = drawTree(d3, rr, p, "tree", { h: 78, color: shift(p.foliage, rr.f(-12, 12), 0, 0) });
      var o3 = d3.out(); if (o3.defs) D.def(o3.defs);
      out.push(place(D, S, x2, y2, s2, b3, rr.chance(0.5)));
    }
  } else if (kind === "desert"){
    for (i = 0; i < 4; i++){
      var x3 = rr.f(0.05, 0.95) * W;
      if (Math.abs(x3 - W * 0.5) < W * 0.15) x3 += (x3 < W * 0.5 ? -1 : 1) * W * 0.22;
      var y3 = hz + depth * rr.f(0.05, 0.45), s3 = rr.f(0.4, 0.85) * (W / 1024);
      var d4 = new Draw(), b4 = drawCactus(d4, rr, p, "cactus", { h: 64 });
      var o4 = d4.out(); if (o4.defs) D.def(o4.defs);
      out.push(place(D, S, x3, y3, s3, b4, rr.chance(0.5)));
    }
  } else if (kind === "city"){
    var n = 9, bg = D.grad(mix(p.mid, p.skyLow, 0.12), darken(p.mid, 0.3), 90);
    for (i = 0; i < n; i++){
      var bw = W / n * rr.f(0.8, 1.3), bx = W * i / n - bw * 0.1, bh = depth * rr.f(0.25, 0.85) + H * 0.06;
      out.push(rct(bx, hz - bh + depth * 0.06, bw, bh, bg, 2));
      if (p.dark)
        for (var k = 0; k < 14; k++)
          if (rr.chance(0.4))
            out.push(rct(bx + 5 + (k % 4) * (bw / 4.6), hz - bh + depth * 0.06 + 8 + Math.floor(k / 4) * (bh / 5.4), 4, 5.5,
              rr.chance(0.75) ? "#ffe4a0" : "#9fd8ff", 0.6, ' opacity="' + n2(rr.f(0.45, 1)) + '"'));
    }
  } else if (kind === "mountain" || kind === "snowland"){
    for (i = 0; i < 5; i++){
      var x4 = rr.f(0.03, 0.97) * W;
      if (Math.abs(x4 - W * 0.5) < W * 0.14) x4 += (x4 < W * 0.5 ? -1 : 1) * W * 0.2;
      var y4 = hz + depth * rr.f(0.03, 0.35), s4 = rr.f(0.32, 0.6) * (W / 1024);
      var d5 = new Draw(), b5 = drawTree(d5, rr, p, "pine", { h: 76, color: darken(p.foliage, 0.15) });
      var o5 = d5.out(); if (o5.defs) D.def(o5.defs);
      out.push(place(D, S, x4, y4, s4, b5, false));
    }
  } else if (kind === "volcano"){
    var gl = D.glowF(8, 1.5);
    out.push('<g filter="' + gl + '" opacity="0.7">' +
      pth(P().M(W * 0.42, hz).C(W * 0.46, hz + depth * 0.4, W * 0.54, hz + depth * 0.5, W * 0.58, hz).Z().d, "#ff6a2a") + "</g>");
  }
  return out.join("");
}

/* ---------- foreground and atmosphere ----------------------------------- */
function paintFore(D, S, W, H){
  var p = S.palette, rr = S.rr, out = [], hz = S.horizon;
  if (S.time === "space" || S.setting === "interior") return "";

  if (S.setting === "ocean" || S.setting === "lake" || S.under){
    if (S.under)
      for (var i = 0; i < 22; i++)
        out.push(circ(rr.f(0, W), rr.f(0, H), rr.f(1.5, 5), "#ffffff", ' opacity="' + n2(rr.f(0.08, 0.3)) + '"'));
  } else {
    /* grass and pebbles along the bottom edge */
    var blades = S.setting === "desert" || S.setting === "snowland" ? 0 : 70;
    var gc = S.setting === "field" || S.setting === "forest" ? darken(p.foliage, 0.28) : darken(p.groundLo, 0.25);
    for (i = 0; i < blades; i++){
      var x = rr.f(-10, W + 10), h = rr.f(H * 0.02, H * 0.06);
      out.push(stroke(P().M(x, H + 4).C(x + rr.f(-5, 5), H - h * 0.6, x + rr.f(-8, 8), H - h * 0.9, x + rr.f(-11, 11), H - h).d,
        gc, rr.f(1.4, 2.8), ' opacity="' + n2(rr.f(0.45, 0.9)) + '"'));
    }
    for (i = 0; i < 7; i++)
      out.push(ell(rr.f(0, W), H - rr.f(0, H * 0.04), rr.f(4, 12), rr.f(2, 5), darken(p.near, 0.2), ' opacity="0.6"'));
  }

  /* A branch hanging into each top corner. Reads as depth instantly, as long
     as it actually looks like a branch and not a smear. */
  if (S.setting === "forest" || S.setting === "swamp" || S.setting === "lake"){
    var fg = D.grad(darken(p.foliage, 0.42), darken(p.foliage, 0.68), 110);
    var barkC = darken("#5c4230", 0.2);
    for (var side = 0; side < 2; side++){
      if (side === 1 && rr.chance(0.45)) continue;
      var ox = side ? W + W * 0.04 : -W * 0.04, dir = side ? -1 : 1;
      var branch = "", by0 = -H * 0.02;
      var ex = ox + dir * W * rr.f(0.3, 0.44), ey = by0 + H * rr.f(0.1, 0.2);
      branch += stroke(P().M(ox, by0).C(ox + dir * W * 0.15, by0 + H * 0.04, ex - dir * W * 0.1, ey - H * 0.03, ex, ey).d, barkC, W * 0.012);
      for (i = 0; i < 12; i++){
        var t2 = 0.1 + (i / 11) * 0.9;
        var bx2 = ox + (ex - ox) * t2, by2 = by0 + (ey - by0) * t2 * t2;
        var lr = W * rr.f(0.028, 0.05), a2 = rr.f(0.35, 1.35) * (rr.chance(0.5) ? 1 : 0.6);
        branch += pth(P().M(bx2, by2)
          .C(bx2 + dir * lr * 0.4, by2 + lr * (a2 - 0.5), bx2 + dir * lr * 1.5, by2 + lr * a2 * 0.6, bx2 + dir * lr * 1.7, by2 + lr * a2)
          .C(bx2 + dir * lr * 1.0, by2 + lr * (a2 + 0.45), bx2 + dir * lr * 0.3, by2 + lr * (a2 * 0.5 + 0.35), bx2, by2).Z().d, fg);
      }
      out.push('<g opacity="0.9">' + branch + "</g>");
    }
  }

  /* weather */
  if (S.weather === "rain" || S.weather === "storm"){
    var drops = S.weather === "storm" ? 150 : 90;
    for (i = 0; i < drops; i++){
      var rx = rr.f(-W * 0.1, W * 1.1), ry = rr.f(0, H), len = rr.f(H * 0.02, H * 0.055);
      out.push(stroke(P().M(rx, ry).L(rx - len * 0.28, ry + len).d, "#dbe9ff", rr.f(0.7, 1.5), ' opacity="' + n2(rr.f(0.18, 0.5)) + '"'));
    }
    if (S.weather === "storm"){
      var lg = D.glowF(5, 1.8);
      out.push('<g filter="' + lg + '" opacity="0.85">' +
        stroke(P().M(W * 0.64, H * 0.05).L(W * 0.6, H * 0.2).L(W * 0.66, H * 0.19).L(W * 0.58, H * 0.4).d, "#fff6c8", 3) + "</g>");
    }
  } else if (S.weather === "snow"){
    for (i = 0; i < 120; i++)
      out.push(circ(rr.f(0, W), rr.f(0, H), rr.f(1.2, 3.6), "#ffffff", ' opacity="' + n2(rr.f(0.3, 0.95)) + '"'));
  } else if (S.weather === "fog"){
    for (i = 0; i < 5; i++){
      var fy = hz - H * 0.05 + i * H * 0.1;
      out.push(rct(0, fy, W, H * 0.09, D.grad("#ffffff", "#ffffff", 90,
        '<stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>')));
    }
  }

  /* fireflies and ambient sparkle at night */
  if (p.dark && S.setting !== "city"){
    for (i = 0; i < 18; i++){
      var sx = rr.f(0, W), sy = rr.f(hz - H * 0.1, H);
      out.push(circ(sx, sy, rr.f(1.2, 2.6), p.glow, ' opacity="' + n2(rr.f(0.4, 0.95)) + '"'));
    }
  }
  return out.join("");
}

function paintLight(D, S, W, H){
  var p = S.palette, out = [];
  /* god rays from the light source */
  if (!p.dark && S.time !== "space" && S.weather !== "storm"){
    var sx = S.sunX === undefined ? W * 0.5 : S.sunX, sy = S.sunY === undefined ? H * 0.2 : S.sunY;
    var rays = "", L = Math.max(W, H) * 1.6;
    for (var i = 0; i < 6; i++){
      var a = 0.55 + i * 0.36 + (i % 2) * 0.05;      // fanning downward from the sun
      var w = 0.022 + (i % 3) * 0.012;               // half-angle in radians
      rays += pth(P().M(sx, sy)
        .L(sx + Math.cos(a - w) * L, sy + Math.sin(a - w) * L)
        .L(sx + Math.cos(a + w) * L, sy + Math.sin(a + w) * L).Z().d,
        p.sun, ' opacity="' + n2(0.022 + (i % 2) * 0.012) + '"');
    }
    var soft = D.blur(W * 0.02);
    out.push('<g style="mix-blend-mode:screen" filter="' + soft + '">' + rays + "</g>");
  }
  /* warm-to-cool overall grade, cheap and does a lot */
  var grade = D.grad(p.light, p.shadow, 100,
    '<stop offset="0" stop-color="' + p.light + '" stop-opacity="0.14"/>' +
    '<stop offset="0.6" stop-color="' + p.light + '" stop-opacity="0"/>' +
    '<stop offset="1" stop-color="' + p.shadow + '" stop-opacity="0.24"/>');
  out.push(rct(0, 0, W, H, grade));
  return out.join("");
}

/* ---------- where the subject goes -------------------------------------- */
function subjectSlots(S, W, H, count){
  var rr = S.rr, hz = S.horizon, slots = [];
  var thirds = [W * 0.36, W * 0.64, W * 0.5];
  for (var i = 0; i < count; i++){
    var x = count === 1 ? (rr.chance(0.55) ? thirds[rr.i(0, 1)] : W * 0.5)
                        : W * (0.28 + i * (0.44 / Math.max(1, count - 1)));
    var t = count === 1 ? 0.62 : 0.5 + i * 0.16;
    var y = hz + (H - hz) * Math.min(0.82, t);
    slots.push({ x: x, y: y, depth: t });
  }
  return slots;
}


/* ---------- a few plain shapes the loose mappings lean on ---------------- */
function drawRock(D, rr, p, kind, o){
  o = o || {};
  var c = o.color || p.stone, out = [], groundY = 50, w = o.w || 34;
  out.push(contact(D, 0, groundY + 1, w * 0.62, p, 0.32));
  var g = D.grad(lighten(c, 0.26), darken(c, 0.38), 118);
  out.push(pth(P().M(-w * 0.6, groundY).C(-w * 0.72, groundY - w * 0.5, -w * 0.34, groundY - w * 0.92, 0, groundY - w * 0.86)
    .C(w * 0.38, groundY - w * 0.96, w * 0.7, groundY - w * 0.44, w * 0.58, groundY).Z().d, g));
  out.push(pth(P().M(-w * 0.2, groundY - w * 0.82).C(w * 0.1, groundY - w * 0.6, w * 0.3, groundY - w * 0.3, w * 0.34, groundY)
    .L(w * 0.58, groundY).C(w * 0.7, groundY - w * 0.44, w * 0.38, groundY - w * 0.96, 0, groundY - w * 0.86).Z().d,
    darken(c, 0.16), ' opacity="0.6"'));
  return out.join("");
}
function drawStructure(D, rr, p, kind, o){
  o = o || {};
  var groundY = 50, out = [], stone = o.color || p.stone;
  var g = D.grad(lighten(stone, 0.24), darken(stone, 0.32), 22);
  if (kind === "bridge"){
    out.push(pth(P().M(-56, groundY).L(-56, groundY - 10).C(-24, groundY - 30, 24, groundY - 30, 56, groundY - 10)
      .L(56, groundY).L(42, groundY).L(42, groundY - 12).C(18, groundY - 24, -18, groundY - 24, -42, groundY - 12)
      .L(-42, groundY).Z().d, g));
    out.push(rct(-58, groundY - 16, 116, 6, darken(stone, 0.2), 2));
    for (var i = -1; i <= 1; i++){
      var ax = i * 34;
      out.push(pth(P().M(ax - 13, groundY).C(ax - 13, groundY - 16, ax + 13, groundY - 16, ax + 13, groundY).Z().d, p.dark ? "#0d1426" : darken(stone, 0.5), ' opacity="0.55"'));
    }
    for (i = -4; i <= 4; i++) out.push(rct(i * 12 - 1, groundY - 30, 2.4, 14, darken(stone, 0.3)));
    out.push(contact(D, 0, groundY + 1, 56, p, 0.3));
    return out.join("");
  }
  if (kind === "tent"){
    out.push(contact(D, 0, groundY + 1, 34, p, 0.3));
    var tg = D.grad(lighten(p.accent, 0.2), darken(p.accent, 0.4), 118);
    out.push(pth(P().M(-34, groundY).L(0, groundY - 46).L(34, groundY).Z().d, tg));
    out.push(pth(P().M(-8, groundY).L(0, groundY - 30).L(8, groundY).Z().d, p.dark ? "#141c30" : darken(p.accent, 0.62)));
    out.push(stroke(P().M(0, groundY - 46).L(0, groundY - 54).d, darken(p.accent, 0.5), 2));
    return out.join("");
  }
  if (kind === "pyramid"){
    out.push(contact(D, 0, groundY + 1, 44, p, 0.3));
    out.push(pth(P().M(-44, groundY).L(0, groundY - 56).L(44, groundY).Z().d, g));
    out.push(pth(P().M(0, groundY - 56).L(44, groundY).L(6, groundY).Z().d, darken(stone, 0.24)));
    return out.join("");
  }
  /* telescope */
  out.push(contact(D, 0, groundY + 1, 24, p, 0.3));
  out.push(stroke(P().M(-16, groundY).L(0, groundY - 20).d, darken(stone, 0.4), 3.4));
  out.push(stroke(P().M(16, groundY).L(0, groundY - 20).d, darken(stone, 0.4), 3.4));
  out.push(stroke(P().M(0, groundY - 4).L(0, groundY - 22).d, darken(stone, 0.4), 3));
  out.push(grp("rotate(-28 0 " + (groundY - 24) + ")",
    rct(-20, groundY - 30, 44, 13, g, 5) + rct(20, groundY - 33, 10, 19, darken(stone, 0.25), 3)));
  return out.join("");
}
