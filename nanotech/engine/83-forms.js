/* ==========================================================================
   More drawable families: humanoids, craft, structures, plants, celestial
   bodies and props. Same contract as 82-draw.js.
   ========================================================================== */

/* ---------- humanoid ----------------------------------------------------- */
var HUMANS = {
  person:    { head: 13, torso: 26, leg: 26, arm: 22, build: 1.0, hair: "short",  gear: "" },
  girl:      { head: 13, torso: 24, leg: 26, arm: 21, build: 0.92, hair: "long",  gear: "" },
  child:     { head: 14, torso: 18, leg: 18, arm: 15, build: 0.85, hair: "short", gear: "" },
  knight:    { head: 13, torso: 28, leg: 25, arm: 22, build: 1.15, hair: "none",  gear: "helm" },
  wizard:    { head: 13, torso: 30, leg: 22, arm: 23, build: 1.0, hair: "beard",  gear: "hat" },
  astronaut: { head: 15, torso: 28, leg: 24, arm: 21, build: 1.2, hair: "none",   gear: "dome" },
  ninja:     { head: 12, torso: 25, leg: 26, arm: 22, build: 0.95, hair: "none",  gear: "mask" },
  pirate:    { head: 13, torso: 26, leg: 25, arm: 22, build: 1.05, hair: "short", gear: "tricorn" },
  robot:     { head: 15, torso: 26, leg: 22, arm: 20, build: 1.1, hair: "none",   gear: "antenna", metal: true },
  ghost:     { head: 15, torso: 26, leg: 0,  arm: 16, build: 1.0, hair: "none",   gear: "", float: true },
  skull:     { head: 20, torso: 0,  leg: 0,  arm: 0,  build: 1.0, hair: "none",   gear: "", skullOnly: true }
};
var HUMAN_ALIAS = { boy: "child", kid: "child", man: "person", woman: "girl", figure: "person",
  hero: "knight", warrior: "knight", samurai: "knight", traveler: "person", explorer: "person",
  android: "robot", droid: "robot", mech: "robot", cyborg: "robot", automaton: "robot", bot: "robot",
  spirit: "ghost", phantom: "ghost", wraith: "ghost", specter: "ghost", skeleton: "skull", bones: "skull" };

function drawHuman(D, rr, p, kind, o){
  o = o || {};
  var H = HUMANS[kind] || HUMANS.person, flip = o.flip ? -1 : 1, out = [];
  var cloth = o.color || p.subject, lo = darken(cloth, 0.36), hi = lighten(cloth, 0.26);
  var g = D.grad(hi, lo, 115);
  var skin = H.metal ? D.grad(lighten(p.stone, 0.35), darken(p.stone, 0.2), 115) : D.grad("#f2c9a4", "#c48f68", 115);
  var groundY = 50;
  var hipY = groundY - H.leg, shY = hipY - H.torso, hr = H.head * 0.5, hy = shY - hr * 0.9;

  if (H.skullOnly){
    var sr = H.head * 0.5;
    out.push(pth(P().M(-sr, 0).C(-sr * 1.1, -sr * 1.5, sr * 1.1, -sr * 1.5, sr, 0)
      .C(sr * 0.9, sr * 0.6, sr * 0.5, sr * 0.7, sr * 0.45, sr * 1.15)
      .C(sr * 0.2, sr * 1.5, -sr * 0.2, sr * 1.5, -sr * 0.45, sr * 1.15)
      .C(-sr * 0.5, sr * 0.7, -sr * 0.9, sr * 0.6, -sr, 0).Z().d, D.grad("#f4f1e6", "#b9b2a0", 120)));
    out.push(ell(-sr * 0.36, -sr * 0.1, sr * 0.24, sr * 0.3, "#1a1a24"));
    out.push(ell(sr * 0.36, -sr * 0.1, sr * 0.24, sr * 0.3, "#1a1a24"));
    out.push(pth(P().M(0, sr * 0.2).L(-sr * 0.12, sr * 0.55).L(sr * 0.12, sr * 0.55).Z().d, "#1a1a24"));
    for (var t = -2; t <= 2; t++) out.push(rct(t * sr * 0.16 - sr * 0.06, sr * 1.05, sr * 0.12, sr * 0.3, "#efece1"));
    return out.join("");
  }

  if (!H.float && H.leg) out.push(contact(D, 0, groundY + 1, H.torso * 0.5, p));

  /* legs */
  if (H.float){
    var fg = D.grad(lighten(cloth, 0.55), cloth, 90);
    out.push(pth(P().M(-hr * 1.25, hy + hr * 0.6).C(-hr * 1.5, hy + H.torso * 1.2, -hr * 1.1, hy + H.torso * 1.7, -hr * 0.6, hy + H.torso * 1.45)
      .C(-hr * 0.1, hy + H.torso * 1.85, hr * 0.3, hy + H.torso * 1.35, hr * 0.8, hy + H.torso * 1.7)
      .C(hr * 1.3, hy + H.torso * 1.9, hr * 1.5, hy + H.torso * 1.1, hr * 1.25, hy + hr * 0.6).Z().d, fg, ' opacity="0.92"'));
  } else if (H.leg){
    for (var i = -1; i <= 1; i += 2){
      out.push(stroke(P().M(i * H.torso * 0.16, hipY).C(i * H.torso * 0.2, hipY + H.leg * 0.5, i * H.torso * 0.18, hipY + H.leg * 0.8, i * H.torso * 0.2, groundY - 2).d,
        H.metal ? skin : darken(cloth, 0.5), H.torso * 0.2 * H.build));
      out.push(pth(P().M(i * H.torso * 0.2 - 4, groundY - 2).L(i * H.torso * 0.2 + 5 * flip, groundY - 2).L(i * H.torso * 0.2 + 5 * flip, groundY).L(i * H.torso * 0.2 - 4, groundY).Z().d, "#2b2f3d", ' rx="1"'));
    }
  }
  /* far arm */
  out.push(stroke(P().M(-H.torso * 0.24 * flip, shY + 3).C(-H.torso * 0.42 * flip, shY + H.arm * 0.45, -H.torso * 0.36 * flip, shY + H.arm * 0.8, -H.torso * 0.3 * flip, shY + H.arm).d,
    darken(cloth, 0.45), H.torso * 0.17 * H.build));
  /* torso */
  if (H.torso){
    out.push(pth(P().M(-H.torso * 0.3 * H.build, shY + 2)
      .C(-H.torso * 0.34 * H.build, shY + H.torso * 0.5, -H.torso * 0.26, hipY, -H.torso * 0.2, hipY + 1)
      .L(H.torso * 0.2, hipY + 1)
      .C(H.torso * 0.26, hipY, H.torso * 0.34 * H.build, shY + H.torso * 0.5, H.torso * 0.3 * H.build, shY + 2)
      .C(H.torso * 0.12, shY - 3, -H.torso * 0.12, shY - 3, -H.torso * 0.3 * H.build, shY + 2).Z().d, g));
    if (H.metal){
      out.push(rct(-H.torso * 0.14, shY + H.torso * 0.22, H.torso * 0.28, H.torso * 0.2, darken(cloth, 0.5), 2));
      out.push(circ(0, shY + H.torso * 0.32, H.torso * 0.07, p.glow, ' opacity="0.95"'));
    } else {
      out.push(stroke(P().M(0, shY + 4).L(0, hipY - 2).d, darken(cloth, 0.5), 1.2, ' opacity="0.5"'));
    }
  }
  /* near arm */
  out.push(stroke(P().M(H.torso * 0.24 * flip, shY + 3).C(H.torso * 0.46 * flip, shY + H.arm * 0.45, H.torso * 0.4 * flip, shY + H.arm * 0.8, H.torso * 0.34 * flip, shY + H.arm).d,
    g, H.torso * 0.18 * H.build));
  out.push(circ(H.torso * 0.34 * flip, shY + H.arm + 1, H.torso * 0.09, H.metal ? lighten(p.stone, 0.2) : "#e9b892"));

  /* head */
  out.push(stroke(P().M(0, shY + 2).L(0, hy + hr * 0.7).d, skin, hr * 0.5));
  if (H.metal) out.push(rct(-hr, hy - hr, hr * 2, hr * 2, skin, hr * 0.42));
  else out.push(ell(0, hy, hr * 0.88, hr, skin));

  if (H.gear === "dome"){
    out.push(circ(0, hy, hr * 1.22, D.radial("#ffffff", "#8fb6e8", 35, 30, 70, 0.5, 0.22)));
    out.push(stroke(P().M(-hr * 1.22, hy).C(-hr * 1.1, hy - hr * 1.1, hr * 1.1, hy - hr * 1.1, hr * 1.22, hy).d, "#dfeaff", 1.6, ' opacity="0.7"'));
  } else if (H.gear === "helm"){
    out.push(pth(P().M(-hr, hy + hr * 0.2).C(-hr * 1.1, hy - hr * 1.2, hr * 1.1, hy - hr * 1.2, hr, hy + hr * 0.2)
      .L(hr * 0.75, hy + hr * 0.2).L(hr * 0.75, hy + hr * 0.75).L(-hr * 0.75, hy + hr * 0.75).L(-hr * 0.75, hy + hr * 0.2).Z().d,
      D.grad(lighten(p.stone, 0.4), darken(p.stone, 0.25), 115)));
    out.push(rct(-hr * 0.7, hy - hr * 0.1, hr * 1.4, hr * 0.32, "#1a2030"));
    out.push(pth(P().M(-hr * 0.2, hy - hr * 1.1).C(0, hy - hr * 2.1, hr * 0.7, hy - hr * 1.9, hr * 0.5, hy - hr * 1.0).Z().d, p.accent));
  } else if (H.gear === "hat"){
    out.push(pth(P().M(-hr * 1.5, hy - hr * 0.5).L(hr * 1.5, hy - hr * 0.5).L(hr * 0.2, hy - hr * 3.4).Z().d, D.grad(p.accent, darken(p.accent, 0.5), 110)));
    out.push(circ(hr * 0.24, hy - hr * 3.3, hr * 0.22, p.glow));
  } else if (H.gear === "mask"){
    out.push(rct(-hr * 0.95, hy - hr * 0.25, hr * 1.9, hr * 0.85, darken(cloth, 0.55), 1.5));
  } else if (H.gear === "tricorn"){
    out.push(pth(P().M(-hr * 1.55, hy - hr * 0.55).C(-hr * 0.8, hy - hr * 1.9, hr * 0.8, hy - hr * 1.9, hr * 1.55, hy - hr * 0.55)
      .C(hr * 0.6, hy - hr * 0.15, -hr * 0.6, hy - hr * 0.15, -hr * 1.55, hy - hr * 0.55).Z().d, darken(cloth, 0.6)));
  } else if (H.gear === "antenna"){
    out.push(stroke(P().M(0, hy - hr).L(0, hy - hr * 1.7).d, darken(p.stone, 0.3), 1.6));
    out.push(circ(0, hy - hr * 1.85, hr * 0.17, p.glow));
  }
  /* hair */
  if (H.hair === "short")
    out.push(pth(P().M(-hr * 0.9, hy - hr * 0.15).C(-hr * 0.95, hy - hr * 1.25, hr * 0.95, hy - hr * 1.25, hr * 0.9, hy - hr * 0.15)
      .C(hr * 0.5, hy - hr * 0.7, -hr * 0.5, hy - hr * 0.7, -hr * 0.9, hy - hr * 0.15).Z().d, darken(p.trim, 0.55)));
  else if (H.hair === "long"){
    out.push(pth(P().M(-hr * 0.95, hy - hr * 0.1).C(-hr * 1.35, hy + hr * 1.6, -hr * 0.9, hy + hr * 2.3, -hr * 0.4, hy + hr * 1.9)
      .C(-hr * 0.8, hy + hr * 0.9, -hr * 0.85, hy - hr * 0.2, -hr * 0.6, hy - hr * 0.6).Z().d, darken(p.trim, 0.5)));
    out.push(pth(P().M(hr * 0.95, hy - hr * 0.1).C(hr * 1.35, hy + hr * 1.6, hr * 0.9, hy + hr * 2.3, hr * 0.4, hy + hr * 1.9)
      .C(hr * 0.8, hy + hr * 0.9, hr * 0.85, hy - hr * 0.2, hr * 0.6, hy - hr * 0.6).Z().d, darken(p.trim, 0.5)));
    out.push(pth(P().M(-hr * 0.95, hy - hr * 0.2).C(-hr * 1.0, hy - hr * 1.3, hr * 1.0, hy - hr * 1.3, hr * 0.95, hy - hr * 0.2)
      .C(hr * 0.5, hy - hr * 0.8, -hr * 0.5, hy - hr * 0.8, -hr * 0.95, hy - hr * 0.2).Z().d, darken(p.trim, 0.55)));
  } else if (H.hair === "beard"){
    out.push(pth(P().M(-hr * 0.7, hy + hr * 0.25).C(-hr * 0.85, hy + hr * 2.0, hr * 0.85, hy + hr * 2.0, hr * 0.7, hy + hr * 0.25)
      .C(hr * 0.3, hy + hr * 0.7, -hr * 0.3, hy + hr * 0.7, -hr * 0.7, hy + hr * 0.25).Z().d, "#e6e9f2"));
  }
  /* face */
  if (H.gear !== "mask"){
    if (H.metal){
      out.push(rct(-hr * 0.62, hy - hr * 0.22, hr * 1.24, hr * 0.44, "#0d1322", 2));
      out.push(circ(-hr * 0.28, hy, hr * 0.13, p.glow));
      out.push(circ(hr * 0.28, hy, hr * 0.13, p.glow));
    } else if (H.gear === "dome" || H.float){
      out.push(dotEye(-hr * 0.3, hy - hr * 0.05, hr * 0.13));
      out.push(dotEye(hr * 0.3, hy - hr * 0.05, hr * 0.13));
      if (H.float) out.push(ell(0, hy + hr * 0.45, hr * 0.2, hr * 0.26, "#1b2134"));
    } else {
      out.push(dotEye(-hr * 0.3, hy - hr * 0.02, hr * 0.12));
      out.push(dotEye(hr * 0.3, hy - hr * 0.02, hr * 0.12));
      out.push(stroke(P().M(-hr * 0.2, hy + hr * 0.42).Q(0, hy + hr * 0.6, hr * 0.2, hy + hr * 0.42).d, "#9b6a52", 1.1));
    }
  }
  return out.join("");
}

/* ---------- craft and vehicles ------------------------------------------- */
function drawRocket(D, rr, p, kind, o){
  o = o || {};
  var out = [], body = o.color || "#eef2fb", lo = darken(body, 0.26);
  var g = D.grad(lighten(body, 0.2), lo, 0);
  var H = 66, W = 17, cy = 6;
  out.push(pth(P().M(-W, cy + H * 0.1).L(-W, cy - H * 0.26).C(-W, cy - H * 0.58, -W * 0.35, cy - H * 0.62, 0, cy - H * 0.72)
    .C(W * 0.35, cy - H * 0.62, W, cy - H * 0.58, W, cy - H * 0.26).L(W, cy + H * 0.1).Z().d, g));
  out.push(pth(P().M(0, cy - H * 0.72).C(W * 0.4, cy - H * 0.6, W, cy - H * 0.5, W, cy - H * 0.26)
    .C(W * 0.4, cy - H * 0.36, W * 0.2, cy - H * 0.55, 0, cy - H * 0.72).Z().d, p.accent, ' opacity="0.9"'));
  out.push(pth(P().M(-W, cy - H * 0.08).L(-W - 13, cy + H * 0.2).L(-W, cy + H * 0.1).Z().d, D.grad(p.accent, darken(p.accent, 0.4), 110)));
  out.push(pth(P().M(W, cy - H * 0.08).L(W + 13, cy + H * 0.2).L(W, cy + H * 0.1).Z().d, D.grad(p.accent, darken(p.accent, 0.4), 110)));
  out.push(circ(0, cy - H * 0.3, W * 0.42, D.radial("#dff0ff", "#4f7fc0", 35, 30, 70)));
  out.push(circ(0, cy - H * 0.3, W * 0.42, "none", ' stroke="' + lo + '" stroke-width="2"'));
  out.push(rct(-W, cy - H * 0.06, W * 2, 3.5, p.trim));
  out.push(rct(-W * 0.55, cy + H * 0.1, W * 1.1, 7, lo, 1.5));
  if (o.flame !== false){
    var fg = D.grad("#fff3c4", "#ff6a2a", 0), gl = D.glowF(5, 1.7);
    out.push('<g filter="' + gl + '">' + pth(P().M(-W * 0.5, cy + H * 0.2).C(-W * 0.3, cy + H * 0.55, -W * 0.15, cy + H * 0.8, 0, cy + H * 1.02)
      .C(W * 0.15, cy + H * 0.8, W * 0.3, cy + H * 0.55, W * 0.5, cy + H * 0.2).Z().d, fg) + "</g>");
  }
  return out.join("");
}
function drawSpaceship(D, rr, p, kind, o){
  o = o || {};
  var hull = o.color || p.stone, g = D.grad(lighten(hull, 0.35), darken(hull, 0.3), 110), out = [];
  out.push(pth(P().M(-46, 2).C(-30, -12, 30, -16, 48, 0).C(30, 14, -28, 16, -46, 2).Z().d, g));
  out.push(pth(P().M(-16, -10).C(-8, -24, 14, -26, 22, -11).C(10, -6, -6, -5, -16, -10).Z().d,
    D.radial("#e8f6ff", "#3f6fb0", 35, 25, 75, 0.95, 0.5)));
  out.push(stroke(P().M(-40, 4).C(-20, 10, 20, 10, 42, 3).d, darken(hull, 0.45), 2, ' opacity="0.7"'));
  for (var i = 0; i < 4; i++) out.push(circ(-26 + i * 15, 5, 2.6, p.glow, ' opacity="0.95"'));
  var gl = D.glowF(4, 1.5);
  out.push('<g filter="' + gl + '">' + ell(-50, 2, 9, 4.5, p.accent, ' opacity="0.85"') + "</g>");
  out.push(pth(P().M(-8, 12).L(-2, 22).L(6, 12).Z().d, darken(hull, 0.4)));
  return out.join("");
}
function drawVehicle(D, rr, p, kind, o){
  o = o || {};
  var paint = o.color || p.subject, g = D.grad(lighten(paint, 0.3), darken(paint, 0.34), 110), out = [];
  var groundY = 50, W = 62, tall = kind === "truck" || kind === "bus" ? 30 : 20;
  var bodyY = groundY - 12 - tall * 0.5;
  out.push(contact(D, 0, groundY + 1, W * 0.55, p));
  out.push(pth(P().M(-W * 0.5, groundY - 10).L(-W * 0.44, bodyY - tall * 0.2)
    .C(-W * 0.3, bodyY - tall * 0.85, -W * 0.02, bodyY - tall * 0.95, W * 0.14, bodyY - tall * 0.3)
    .L(W * 0.46, bodyY - tall * 0.05).C(W * 0.52, groundY - 16, W * 0.52, groundY - 12, W * 0.5, groundY - 10).Z().d, g));
  out.push(pth(P().M(-W * 0.3, bodyY - tall * 0.28).C(-W * 0.2, bodyY - tall * 0.78, W * 0, bodyY - tall * 0.85, W * 0.1, bodyY - tall * 0.34).Z().d,
    D.grad("#d9ecff", "#6f9fd0", 120), ' opacity="0.9"'));
  out.push(rct(-W * 0.5, groundY - 12, W, 3, darken(paint, 0.5), 1));
  out.push(circ(W * 0.44, bodyY - tall * 0.05, 3.2, "#fff3c0"));
  out.push(circ(-W * 0.47, groundY - 13, 2.6, "#ff8080"));
  for (var i = -1; i <= 1; i += 2){
    var wx = i * W * 0.3;
    out.push(circ(wx, groundY - 8, 9, "#1c2130"));
    out.push(circ(wx, groundY - 8, 4.6, D.grad("#e6ecf8", "#9aa6bb", 120)));
    out.push(circ(wx, groundY - 8, 1.8, "#5d6779"));
  }
  return out.join("");
}
function drawPlane(D, rr, p, kind, o){
  o = o || {};
  var hull = o.color || "#eaf0fb", g = D.grad(lighten(hull, 0.2), darken(hull, 0.26), 110), out = [];
  out.push(pth(P().M(-44, 0).C(-30, -8, 26, -10, 46, -2).C(30, 8, -28, 9, -44, 0).Z().d, g));
  out.push(pth(P().M(-6, -4).C(6, -26, 16, -28, 22, -4).Z().d, D.grad(p.accent, darken(p.accent, 0.4), 110)));
  out.push(pth(P().M(-4, 2).C(4, 22, 14, 24, 20, 2).Z().d, D.grad(darken(p.accent, 0.2), darken(p.accent, 0.5), 110)));
  out.push(pth(P().M(-42, -1).C(-48, -14, -38, -15, -32, -3).Z().d, p.trim));
  out.push(pth(P().M(34, -5).C(40, -6, 44, -4, 46, -2).C(42, 0, 38, -1, 34, -2).Z().d, D.radial("#dff0ff", "#4f7fc0", 40, 30, 70)));
  for (var i = 0; i < 4; i++) out.push(circ(2 + i * 8, -1, 1.7, "#bfd6f2"));
  return out.join("");
}
function drawBoat(D, rr, p, kind, o){
  o = o || {};
  var wood = o.color || "#8a5a38", g = D.grad(lighten(wood, 0.25), darken(wood, 0.35), 110), out = [];
  var wl = 26;
  out.push(pth(P().M(-34, wl - 10).L(34, wl - 10).C(28, wl + 4, -26, wl + 4, -34, wl - 10).Z().d, g));
  out.push(rct(-34, wl - 12, 68, 3, darken(wood, 0.5), 1));
  out.push(stroke(P().M(1, wl - 11).L(1, wl - 56).d, darken(wood, 0.4), 3));
  var sail = D.grad("#fbfcff", "#c9d6e8", 100);
  out.push(pth(P().M(3, wl - 54).C(26, wl - 42, 30, wl - 22, 26, wl - 14).L(3, wl - 14).Z().d, sail));
  out.push(pth(P().M(-2, wl - 48).C(-20, wl - 36, -22, wl - 20, -18, wl - 14).L(-2, wl - 14).Z().d, D.grad("#eef3fb", "#b6c4d8", 100)));
  out.push(pth(P().M(2, wl - 56).L(14, wl - 52).L(2, wl - 48).Z().d, p.accent));
  return out.join("");
}
function drawBalloon(D, rr, p, kind, o){
  o = o || {};
  var c1 = o.color || p.accent, c2 = p.trim, out = [];
  var r = 26, cy = -14;
  var seg = function(dx, col){
    return pth(P().M(0, cy - r).C(dx * r * 0.9, cy - r * 0.75, dx * r * 1.05, cy + r * 0.45, 0, cy + r * 0.95)
      .C(dx * r * 0.35, cy + r * 0.4, dx * r * 0.4, cy - r * 0.6, 0, cy - r).Z().d, col);
  };
  out.push(circ(0, cy, r, D.grad(lighten(c1, 0.3), darken(c1, 0.3), 115)));
  out.push(seg(0.55, mix(c2, "#ffffff", 0.1)));
  out.push(seg(-0.55, darken(c2, 0.15)));
  out.push(ell(0, cy + r * 0.95, r * 0.34, r * 0.1, darken(c1, 0.45)));
  out.push(stroke(P().M(-r * 0.28, cy + r * 1.0).L(-8, cy + r * 1.7).d, "#6b5a48", 1.2));
  out.push(stroke(P().M(r * 0.28, cy + r * 1.0).L(8, cy + r * 1.7).d, "#6b5a48", 1.2));
  out.push(pth(P().M(-10, cy + r * 1.7).L(10, cy + r * 1.7).L(8, cy + r * 2.25).L(-8, cy + r * 2.25).Z().d, D.grad("#b98b57", "#7d5734", 110)));
  return out.join("");
}

/* ---------- structures --------------------------------------------------- */
function drawHouse(D, rr, p, kind, o){
  o = o || {};
  var wall = o.color || "#e8dcc4", roofC = p.accent, out = [];
  var groundY = 50, W = 46, wallH = 30, wy = groundY - wallH;
  var wg = D.grad(lighten(wall, 0.15), darken(wall, 0.22), 25);
  out.push(contact(D, 0, groundY + 1, W * 0.6, p));
  out.push(rct(-W * 0.5, wy, W, wallH, wg));
  out.push(pth(P().M(-W * 0.62, wy + 2).L(0, wy - 24).L(W * 0.62, wy + 2).Z().d, D.grad(lighten(roofC, 0.18), darken(roofC, 0.4), 115)));
  for (var i = 0; i < 5; i++)
    out.push(stroke(P().M(-W * 0.52 + i * W * 0.12, wy - 2 - i * 4.2).L(W * 0.52 - i * W * 0.12, wy - 2 - i * 4.2).d, darken(roofC, 0.55), 0.8, ' opacity="0.35"'));
  var lit = p.dark ? "#ffdf9a" : "#9fd0f2";
  out.push(rct(-W * 0.34, wy + 7, 12, 11, lit, 1.5));
  out.push(rct(W * 0.1, wy + 7, 12, 11, lit, 1.5));
  out.push(stroke(P().M(-W * 0.28, wy + 7).L(-W * 0.28, wy + 18).d, darken(wall, 0.5), 1));
  out.push(stroke(P().M(W * 0.16, wy + 7).L(W * 0.16, wy + 18).d, darken(wall, 0.5), 1));
  out.push(rct(-5, groundY - 16, 11, 16, D.grad(darken(roofC, 0.4), darken(roofC, 0.6), 20), 1.5));
  out.push(circ(3.2, groundY - 8, 0.9, p.trim));
  out.push(rct(W * 0.22, wy - 22, 7, 14, darken(wall, 0.35), 1));
  if (p.dark){
    var gl = D.glowF(4, 1.2);
    out.push('<g filter="' + gl + '" opacity="0.5">' + rct(-W * 0.34, wy + 7, 12, 11, "#ffdf9a", 1.5) + rct(W * 0.1, wy + 7, 12, 11, "#ffdf9a", 1.5) + "</g>");
  }
  return out.join("");
}
function drawCastle(D, rr, p, kind, o){
  o = o || {};
  var stone = o.color || p.stone, out = [];
  var groundY = 50, g = D.grad(lighten(stone, 0.22), darken(stone, 0.3), 25);
  out.push(contact(D, 0, groundY + 1, 44, p));
  function tower(x, w, h){
    var y = groundY - h, s = "";
    s += rct(x - w * 0.5, y, w, h, g);
    for (var i = 0; i < 3; i++) s += rct(x - w * 0.5 + i * w * 0.36, y - 5, w * 0.24, 5, darken(stone, 0.2));
    s += pth(P().M(x - w * 0.62, y - 5).L(x, y - 5 - w * 0.95).L(x + w * 0.62, y - 5).Z().d, D.grad(lighten(p.accent, 0.1), darken(p.accent, 0.45), 115));
    s += rct(x - 2.5, y + h * 0.22, 5, 8, p.dark ? "#ffd98f" : "#3b4a68", 2);
    return s;
  }
  out.push(rct(-30, groundY - 34, 60, 34, g));
  for (var i = 0; i < 6; i++) out.push(rct(-30 + i * 10.4, groundY - 39, 6, 5, darken(stone, 0.18)));
  out.push(pth(P().M(-8, groundY).L(-8, groundY - 16).C(-8, groundY - 24, 8, groundY - 24, 8, groundY - 16).L(8, groundY).Z().d, darken(stone, 0.55)));
  out.push(tower(-34, 19, 48));
  out.push(tower(34, 19, 44));
  out.push(tower(0, 15, 56));
  out.push(stroke(P().M(0, groundY - 56 - 14).L(0, groundY - 56 - 26).d, darken(stone, 0.4), 1.4));
  out.push(pth(P().M(1, groundY - 82).L(13, groundY - 78).L(1, groundY - 74).Z().d, p.trim));
  return out.join("");
}
function drawTower(D, rr, p, kind, o){
  o = o || {};
  var isLight = kind === "lighthouse";
  var body = o.color || (isLight ? "#f2f4f9" : p.stone), out = [];
  var groundY = 50, H = 72, W = 20;
  out.push(contact(D, 0, groundY + 1, W * 0.9, p));
  var g = D.grad(lighten(body, 0.2), darken(body, 0.28), 25);
  out.push(pth(P().M(-W * 0.62, groundY).L(-W * 0.36, groundY - H).L(W * 0.36, groundY - H).L(W * 0.62, groundY).Z().d, g));
  if (isLight)
    for (var i = 0; i < 4; i++)
      out.push(pth(P().M(-W * (0.55 - i * 0.05), groundY - i * H * 0.24 - H * 0.08)
        .L(W * (0.55 - i * 0.05), groundY - i * H * 0.24 - H * 0.08)
        .L(W * (0.52 - i * 0.05), groundY - i * H * 0.24 - H * 0.2)
        .L(-W * (0.52 - i * 0.05), groundY - i * H * 0.24 - H * 0.2).Z().d, "#e0514a", ' opacity="0.9"'));
  out.push(rct(-W * 0.48, groundY - H - 4, W * 0.96, 5, darken(body, 0.4), 1));
  out.push(rct(-W * 0.36, groundY - H - 15, W * 0.72, 11, p.dark ? "#ffe6a8" : "#cfe6ff", 1.5));
  out.push(pth(P().M(-W * 0.5, groundY - H - 15).L(0, groundY - H - 27).L(W * 0.5, groundY - H - 15).Z().d, D.grad(p.accent, darken(p.accent, 0.5), 115)));
  if (isLight){
    var gl = D.glowF(6, 1.6);
    out.push('<g filter="' + gl + '" opacity="0.62">' +
      pth(P().M(W * 0.3, groundY - H - 14).L(96, groundY - H - 40).L(96, groundY - H + 12).Z().d, "#ffe9a8", ' opacity="0.5"') +
      pth(P().M(-W * 0.3, groundY - H - 14).L(-96, groundY - H - 40).L(-96, groundY - H + 12).Z().d, "#ffe9a8", ' opacity="0.28"') + "</g>");
  }
  return out.join("");
}

/* ---------- plants ------------------------------------------------------- */
function drawTree(D, rr, p, kind, o){
  o = o || {};
  var form = o.form || (kind === "palm" ? "palm" : kind === "pine" ? "conifer" : "broad");
  var leaf = o.color || p.foliage, bark = "#6b4a33", out = [];
  var groundY = 50, H = o.h || 70;
  out.push(contact(D, 0, groundY + 1, H * 0.3, p, 0.35));
  var bg = D.grad(lighten(bark, 0.2), darken(bark, 0.3), 20);
  if (form === "conifer"){
    out.push(rct(-H * 0.035, groundY - H * 0.3, H * 0.07, H * 0.3, bg));
    for (var i = 0; i < 4; i++){
      var w = H * (0.34 - i * 0.065), y = groundY - H * (0.26 + i * 0.21);
      out.push(pth(P().M(-w, y).L(0, y - H * 0.3).L(w, y).Z().d,
        D.grad(lighten(leaf, 0.18 - i * 0.03), darken(leaf, 0.3 + i * 0.05), 118)));
    }
  } else if (form === "palm"){
    out.push(stroke(P().M(0, groundY).C(H * 0.06, groundY - H * 0.35, -H * 0.06, groundY - H * 0.6, H * 0.04, groundY - H * 0.74).d, bg, H * 0.065));
    for (i = 0; i < 7; i++){
      var a = -Math.PI * 0.95 + i * (Math.PI * 0.9 / 6), L = H * rr.f(0.32, 0.45);
      var ex = H * 0.04 + Math.cos(a) * L, ey = groundY - H * 0.74 + Math.sin(a) * L * 0.72;
      out.push(pth(P().M(H * 0.04, groundY - H * 0.74)
        .C(H * 0.04 + Math.cos(a) * L * 0.5, groundY - H * 0.74 + Math.sin(a) * L * 0.3 - 4, ex * 0.9, ey - 5, ex, ey)
        .C(ex * 0.8, ey + 4, H * 0.04 + Math.cos(a) * L * 0.4, groundY - H * 0.74 + Math.sin(a) * L * 0.4 + 5, H * 0.04, groundY - H * 0.72).Z().d,
        D.grad(lighten(leaf, 0.2), darken(leaf, 0.35), 110)));
    }
    out.push(circ(H * 0.04, groundY - H * 0.72, H * 0.035, "#8a6a3a"));
  } else {
    out.push(pth(P().M(-H * 0.055, groundY).C(-H * 0.045, groundY - H * 0.28, -H * 0.07, groundY - H * 0.4, -H * 0.11, groundY - H * 0.5)
      .L(-H * 0.04, groundY - H * 0.46).L(0, groundY - H * 0.56).L(H * 0.05, groundY - H * 0.46).L(H * 0.11, groundY - H * 0.52)
      .C(H * 0.07, groundY - H * 0.4, H * 0.045, groundY - H * 0.28, H * 0.055, groundY).Z().d, bg));
    var lg = D.grad(lighten(leaf, 0.24), darken(leaf, 0.34), 118);
    var blobs = [[0, -H * 0.72, H * 0.3], [-H * 0.22, -H * 0.6, H * 0.22], [H * 0.23, -H * 0.62, H * 0.23],
                 [-H * 0.12, -H * 0.82, H * 0.19], [H * 0.14, -H * 0.8, H * 0.18]];
    blobs.forEach(function(b){ out.push(circ(b[0], groundY + b[1], b[2], lg)); });
    out.push(circ(-H * 0.1, groundY - H * 0.8, H * 0.14, lighten(leaf, 0.3), ' opacity="0.45"'));
  }
  return out.join("");
}
function drawFlower(D, rr, p, kind, o){
  o = o || {};
  var petal = o.color || p.accent, out = [];
  var groundY = 50, H = o.h || 46, cy = groundY - H;
  out.push(stroke(P().M(0, groundY).C(-3, groundY - H * 0.4, 3, groundY - H * 0.7, 0, cy + 5).d, darken(p.foliage, 0.1), 2.6));
  out.push(pth(P().M(-1, groundY - H * 0.42).C(-12, groundY - H * 0.6, -16, groundY - H * 0.38, -8, groundY - H * 0.3).Z().d, p.foliage));
  out.push(pth(P().M(1, groundY - H * 0.56).C(12, groundY - H * 0.74, 16, groundY - H * 0.52, 8, groundY - H * 0.44).Z().d, darken(p.foliage, 0.15)));
  var n = kind === "sunflower" ? 12 : kind === "tulip" ? 5 : 7, r = H * 0.25;
  var pg = D.grad(lighten(petal, 0.28), darken(petal, 0.22), 120);
  if (kind === "tulip"){
    for (var i = 0; i < 3; i++){
      var dx = (i - 1) * r * 0.55;
      out.push(pth(P().M(dx, cy + r * 0.8).C(dx - r * 0.55, cy + r * 0.2, dx - r * 0.4, cy - r * 0.9, dx, cy - r)
        .C(dx + r * 0.4, cy - r * 0.9, dx + r * 0.55, cy + r * 0.2, dx, cy + r * 0.8).Z().d, i === 1 ? pg : darken(petal, 0.18)));
    }
  } else {
    for (i = 0; i < n; i++){
      var a = i * Math.PI * 2 / n;
      out.push(grp("rotate(" + n2(a * 180 / Math.PI) + " 0 " + n2(cy) + ")",
        pth(P().M(0, cy).C(-r * 0.42, cy - r * 0.55, -r * 0.3, cy - r * 1.3, 0, cy - r * 1.35)
          .C(r * 0.3, cy - r * 1.3, r * 0.42, cy - r * 0.55, 0, cy).Z().d, pg)));
    }
    out.push(circ(0, cy, r * 0.42, D.radial(lighten(p.trim, 0.3), darken(p.trim, 0.2), 40, 35, 70)));
    for (i = 0; i < 7; i++) out.push(circ(rr.f(-r * 0.25, r * 0.25), cy + rr.f(-r * 0.25, r * 0.25), 0.9, darken(p.trim, 0.45), ' opacity="0.7"'));
  }
  return out.join("");
}
function drawMushroom(D, rr, p, kind, o){
  o = o || {};
  var capC = o.color || "#e0524c", out = [], groundY = 50, H = o.h || 34;
  out.push(contact(D, 0, groundY + 1, H * 0.36, p, 0.3));
  out.push(pth(P().M(-H * 0.14, groundY).C(-H * 0.17, groundY - H * 0.4, -H * 0.13, groundY - H * 0.55, -H * 0.12, groundY - H * 0.6)
    .L(H * 0.12, groundY - H * 0.6).C(H * 0.13, groundY - H * 0.55, H * 0.17, groundY - H * 0.4, H * 0.14, groundY).Z().d,
    D.grad("#f6efdc", "#c9bda2", 20)));
  out.push(pth(P().M(-H * 0.46, groundY - H * 0.56).C(-H * 0.44, groundY - H * 1.08, H * 0.44, groundY - H * 1.08, H * 0.46, groundY - H * 0.56)
    .C(H * 0.2, groundY - H * 0.47, -H * 0.2, groundY - H * 0.47, -H * 0.46, groundY - H * 0.56).Z().d,
    D.grad(lighten(capC, 0.25), darken(capC, 0.3), 118)));
  for (var i = 0; i < 5; i++)
    out.push(ell(rr.f(-H * 0.32, H * 0.32), groundY - H * rr.f(0.7, 0.95), H * rr.f(0.04, 0.07), H * rr.f(0.03, 0.05), "#f8f4ea", ' opacity="0.92"'));
  return out.join("");
}
function drawCactus(D, rr, p, kind, o){
  o = o || {};
  var c = o.color || "#3f8a52", out = [], groundY = 50, H = o.h || 60;
  var g = D.grad(lighten(c, 0.22), darken(c, 0.34), 25);
  out.push(contact(D, 0, groundY + 1, H * 0.2, p, 0.3));
  out.push(rct(-H * 0.11, groundY - H, H * 0.22, H, g, H * 0.11));
  out.push(pth(P().M(-H * 0.09, groundY - H * 0.62).C(-H * 0.3, groundY - H * 0.64, -H * 0.32, groundY - H * 0.5, -H * 0.31, groundY - H * 0.38)
    .L(-H * 0.2, groundY - H * 0.38).C(-H * 0.21, groundY - H * 0.5, -H * 0.19, groundY - H * 0.54, -H * 0.09, groundY - H * 0.54).Z().d, g));
  out.push(pth(P().M(H * 0.09, groundY - H * 0.74).C(H * 0.28, groundY - H * 0.76, H * 0.3, groundY - H * 0.62, H * 0.29, groundY - H * 0.48)
    .L(H * 0.19, groundY - H * 0.48).C(H * 0.2, groundY - H * 0.6, H * 0.18, groundY - H * 0.66, H * 0.09, groundY - H * 0.66).Z().d, g));
  for (var i = 0; i < 9; i++)
    out.push(stroke(P().M(-H * 0.11, groundY - H * (0.1 + i * 0.1)).L(-H * 0.16, groundY - H * (0.1 + i * 0.1)).d, "#e8f0d8", 0.7, ' opacity="0.6"'));
  if (rr.chance(0.5)) out.push(circ(0, groundY - H - H * 0.05, H * 0.07, p.accent));
  return out.join("");
}

/* ---------- celestial and abstract -------------------------------------- */
function drawPlanetBody(D, rr, p, kind, o){
  o = o || {};
  var r = o.r || 34, out = [];
  var base = o.color || p.accent;
  var g = D.radial(lighten(base, 0.35), darken(base, 0.5), 33, 30, 72);
  out.push(circ(0, 0, r, g));
  if (kind === "sun" || kind === "star"){
    var sg = D.radial("#fff8d8", darken(p.sun, 0.1), 45, 45, 60);
    var gl = D.glowF(r * 0.3, 1.4);
    out.push('<g filter="' + gl + '">' + circ(0, 0, r * 0.82, sg) + "</g>");
    return out.join("");
  }
  if (kind === "moon"){
    out.push(circ(0, 0, r, D.radial("#f4f6fb", "#9aa3b8", 35, 30, 75)));
    for (var i = 0; i < 9; i++){
      var cr = r * rr.f(0.07, 0.19), a = rr.f(0, 6.28), d = rr.f(0, r * 0.78);
      out.push(circ(Math.cos(a) * d, Math.sin(a) * d, cr, "#8d96ab", ' opacity="0.5"'));
      out.push(circ(Math.cos(a) * d - cr * 0.2, Math.sin(a) * d - cr * 0.2, cr * 0.75, "#c5ccdb", ' opacity="0.4"'));
    }
  } else {
    for (i = 0; i < 4; i++){
      var by = -r * 0.6 + i * r * 0.4;
      out.push(ell(0, by, r * Math.sqrt(Math.max(0.05, 1 - (by / r) * (by / r))) * 0.96, r * rr.f(0.06, 0.12),
        i % 2 ? lighten(base, 0.22) : darken(base, 0.24), ' opacity="0.5"'));
    }
    if (o.ring !== false && rr.chance(0.55)){
      var rg = D.grad(lighten(p.trim, 0.3), darken(p.trim, 0.3), 0);
      out.push(grp("rotate(-18)", ell(0, 0, r * 1.7, r * 0.34, "none", ' stroke="' + rg + '" stroke-width="' + n2(r * 0.16) + '" opacity="0.85"')));
    }
  }
  out.push(circ(0, 0, r, "none", ' stroke="' + lighten(base, 0.5) + '" stroke-width="1.2" opacity="0.28"'));
  out.push(ell(-r * 0.32, -r * 0.34, r * 0.34, r * 0.22, "#ffffff", ' opacity="0.18" transform="rotate(-28 ' + n2(-r * 0.32) + " " + n2(-r * 0.34) + ')"'));
  return out.join("");
}
function drawCrystal(D, rr, p, kind, o){
  o = o || {};
  var c = o.color || p.accent, out = [], groundY = 50, H = o.h || 54;
  out.push(contact(D, 0, groundY + 1, H * 0.3, p, 0.3));
  function shard(x, w, h, tilt, shade){
    var top = groundY - h;
    return pth(P().M(x - w, groundY).L(x - w * 0.6, top + h * 0.2).L(x + tilt, top)
      .L(x + w * 0.7, top + h * 0.22).L(x + w, groundY).Z().d, shade) +
      pth(P().M(x + tilt, top).L(x + w * 0.7, top + h * 0.22).L(x + w, groundY).L(x + tilt * 0.4, groundY).Z().d,
        lighten(shade === "none" ? c : c, 0.3), ' opacity="0.45"');
  }
  out.push(shard(-H * 0.24, H * 0.14, H * 0.62, -H * 0.04, D.grad(lighten(c, 0.2), darken(c, 0.4), 120)));
  out.push(shard(H * 0.24, H * 0.13, H * 0.5, H * 0.05, D.grad(lighten(c, 0.1), darken(c, 0.5), 120)));
  out.push(shard(0, H * 0.18, H, 0, D.grad(lighten(c, 0.35), darken(c, 0.3), 120)));
  var gl = D.glowF(5, 1.3);
  out.push('<g filter="' + gl + '" opacity="0.55">' + pth(P().M(-H * 0.06, groundY - H * 0.9).L(H * 0.06, groundY - H * 0.9).L(H * 0.04, groundY - H * 0.2).L(-H * 0.04, groundY - H * 0.2).Z().d, lighten(c, 0.6)) + "</g>");
  return out.join("");
}
function drawFire(D, rr, p, kind, o){
  o = o || {};
  var out = [], groundY = 50, H = o.h || 40;
  if (kind === "campfire"){
    for (var i = 0; i < 4; i++){
      var a = -0.5 + i * 0.4;
      out.push(stroke(P().M(-16 + i * 4, groundY).L(10 - i * 5, groundY - 8 - i).d, i % 2 ? "#6f4c34" : "#8a5f3f", 4.5));
    }
  }
  var gl = D.glowF(6, 1.7);
  var fg1 = D.grad("#ffe9a0", "#ff5f24", 0), fg2 = D.grad("#fffbe0", "#ffb03a", 0);
  out.push('<g filter="' + gl + '">');
  out.push(pth(P().M(-H * 0.3, groundY - 6).C(-H * 0.4, groundY - H * 0.5, -H * 0.1, groundY - H * 0.6, 0, groundY - H)
    .C(H * 0.14, groundY - H * 0.62, H * 0.4, groundY - H * 0.5, H * 0.3, groundY - 6)
    .C(H * 0.14, groundY - 1, -H * 0.14, groundY - 1, -H * 0.3, groundY - 6).Z().d, fg1));
  out.push(pth(P().M(-H * 0.16, groundY - 5).C(-H * 0.2, groundY - H * 0.34, -H * 0.04, groundY - H * 0.36, 0, groundY - H * 0.62)
    .C(H * 0.07, groundY - H * 0.36, H * 0.2, groundY - H * 0.34, H * 0.16, groundY - 5)
    .C(H * 0.07, groundY - 2, -H * 0.07, groundY - 2, -H * 0.16, groundY - 5).Z().d, fg2));
  out.push("</g>");
  for (i = 0; i < 5; i++)
    out.push(circ(rr.f(-H * 0.3, H * 0.3), groundY - H * rr.f(0.9, 1.5), rr.f(0.8, 1.6), "#ffd08a", ' opacity="' + n2(rr.f(0.4, 0.9)) + '"'));
  return out.join("");
}
function drawPortal(D, rr, p, kind, o){
  o = o || {};
  var r = o.r || 34, c = o.color || p.accent, out = [];
  var gl = D.glowF(7, 1.6);
  out.push('<g filter="' + gl + '">');
  out.push(ell(0, 0, r * 0.66, r, D.radial(lighten(c, 0.55), darken(c, 0.55), 50, 45, 62)));
  out.push(ell(0, 0, r * 0.66, r, "none", ' stroke="' + lighten(c, 0.5) + '" stroke-width="3.5"'));
  out.push("</g>");
  for (var i = 0; i < 4; i++)
    out.push(ell(0, 0, r * (0.5 - i * 0.1), r * (0.82 - i * 0.16), "none",
      ' stroke="' + lighten(c, 0.3 + i * 0.1) + '" stroke-width="1.1" opacity="' + n2(0.5 - i * 0.08) + '"'));
  for (i = 0; i < 8; i++)
    out.push(circ(rr.f(-r * 0.55, r * 0.55), rr.f(-r * 0.85, r * 0.85), rr.f(0.7, 1.7), "#ffffff", ' opacity="' + n2(rr.f(0.3, 0.85)) + '"'));
  return out.join("");
}

/* ---------- props -------------------------------------------------------- */
function drawProp(D, rr, p, kind, o){
  o = o || {};
  var out = [], c = o.color || p.accent, gm = D.grad(lighten(p.stone, 0.45), darken(p.stone, 0.3), 115);
  var groundY = 50;
  switch (kind){
  case "sword":
    out.push(pth(P().M(0, -46).L(5, -34).L(5, 16).L(-5, 16).L(-5, -34).Z().d, gm));
    out.push(stroke(P().M(0, -42).L(0, 14).d, "#ffffff", 1, ' opacity="0.45"'));
    out.push(rct(-15, 16, 30, 5.5, D.grad(lighten(c, 0.2), darken(c, 0.4), 110), 2));
    out.push(rct(-3.4, 21, 6.8, 18, "#6b4a33", 2));
    out.push(circ(0, 41, 4.2, D.grad(lighten(c, 0.3), darken(c, 0.3), 115)));
    break;
  case "shield":
    out.push(pth(P().M(-24, -30).L(24, -30).C(26, 4, 14, 26, 0, 36).C(-14, 26, -26, 4, -24, -30).Z().d, D.grad(lighten(c, 0.2), darken(c, 0.4), 115)));
    out.push(pth(P().M(-17, -23).L(17, -23).C(18, 2, 10, 19, 0, 27).C(-10, 19, -18, 2, -17, -23).Z().d, gm, ' opacity="0.65"'));
    out.push(circ(0, -2, 6, p.trim));
    break;
  case "crown":
    out.push(pth(P().M(-26, 14).L(-26, -6).L(-14, 8).L(0, -16).L(14, 8).L(26, -6).L(26, 14).Z().d, D.grad("#ffe08a", "#c99226", 118)));
    out.push(rct(-26, 14, 52, 7, D.grad("#ffd870", "#b88220", 110), 2));
    out.push(circ(0, -14, 3.2, p.accent));
    out.push(circ(-18, 4, 2.4, p.accent2));
    out.push(circ(18, 4, 2.4, p.accent2));
    break;
  case "key":
    out.push(circ(0, -26, 12, "none", ' stroke="' + gm + '" stroke-width="6"'));
    out.push(stroke(P().M(0, -14).L(0, 34).d, gm, 5));
    out.push(stroke(P().M(0, 20).L(12, 20).d, gm, 5));
    out.push(stroke(P().M(0, 30).L(9, 30).d, gm, 5));
    break;
  case "book":
    out.push(pth(P().M(-28, -20).L(-2, -24).L(-2, 22).L(-28, 26).Z().d, D.grad(lighten(c, 0.15), darken(c, 0.42), 20)));
    out.push(pth(P().M(28, -20).L(2, -24).L(2, 22).L(28, 26).Z().d, D.grad(darken(c, 0.2), darken(c, 0.5), 20)));
    out.push(pth(P().M(-26, -17).L(-3, -21).L(-3, 19).L(-26, 23).Z().d, "#f6f2e4"));
    out.push(pth(P().M(26, -17).L(3, -21).L(3, 19).L(26, 23).Z().d, "#efe9d8"));
    for (var i = 0; i < 4; i++){
      out.push(stroke(P().M(-22, -12 + i * 8).L(-7, -14 + i * 8).d, "#b9b0a0", 1));
      out.push(stroke(P().M(7, -14 + i * 8).L(22, -12 + i * 8).d, "#b9b0a0", 1));
    }
    break;
  case "lantern": {
    var lit = p.dark ? "#ffdf9a" : "#ffe9bc";
    out.push(stroke(P().M(0, -34).C(-9, -34, -9, -24, 0, -24).d, darken(p.stone, 0.3), 2));
    out.push(pth(P().M(-13, -22).L(13, -22).L(10, 20).L(-10, 20).Z().d, D.grad(lighten(lit, 0.2), darken(lit, 0.25), 110), ' opacity="0.95"'));
    out.push(rct(-15, -25, 30, 4, darken(p.stone, 0.35), 1.5));
    out.push(rct(-13, 19, 26, 5, darken(p.stone, 0.35), 1.5));
    out.push(stroke(P().M(0, -21).L(0, 19).d, darken(p.stone, 0.45), 1.4, ' opacity="0.6"'));
    var gl2 = D.glowF(7, 1.4);
    out.push('<g filter="' + gl2 + '" opacity="0.6">' + ell(0, -1, 9, 16, lit) + "</g>");
    break;
  }
  case "coffee":
    out.push(pth(P().M(-18, -12).L(18, -12).L(14, 20).C(8, 26, -8, 26, -14, 20).Z().d, D.grad("#fbfdff", "#c6d2e2", 110)));
    out.push(ell(0, -12, 18, 5, "#6b4326"));
    out.push(ell(0, -13, 15, 3.6, "#8a5c38"));
    out.push(pth(P().M(18, -6).C(30, -6, 30, 8, 18, 8).d, "none", ' stroke="#d5dfeb" stroke-width="4"'));
    for (i = 0; i < 3; i++)
      out.push(stroke(P().M(-6 + i * 6, -18).C(-9 + i * 6, -26, -3 + i * 6, -30, -6 + i * 6, -38).d, "#dce6f2", 1.6, ' opacity="0.5"'));
    break;
  case "guitar":
    out.push(pth(P().M(0, 8).C(-22, 8, -24, 34, -6, 36).C(8, 38, 22, 30, 20, 14)
      .C(19, 2, 10, -2, 4, 2).Z().d, D.grad(lighten("#c07a3a", 0.2), darken("#c07a3a", 0.4), 115)));
    out.push(circ(6, 20, 6.5, "#2c1d12"));
    out.push(rct(-2, -38, 8, 46, D.grad("#6b4a33", "#3f2c1e", 110), 1.5));
    out.push(rct(-3.5, -46, 11, 9, "#2f2118", 1.5));
    for (i = 0; i < 4; i++) out.push(stroke(P().M(0 + i * 1.6, -36).L(2 + i * 1.4, 26).d, "#e6ecf6", 0.5, ' opacity="0.7"'));
    break;
  case "controller":
    out.push(pth(P().M(-30, -8).C(-38, 0, -36, 18, -26, 20).C(-16, 22, -10, 12, 0, 12)
      .C(10, 12, 16, 22, 26, 20).C(36, 18, 38, 0, 30, -8).C(18, -16, -18, -16, -30, -8).Z().d,
      D.grad(lighten(p.stone, 0.4), darken(p.stone, 0.35), 115)));
    out.push(circ(-16, 0, 3.2, "#2c3446"));
    out.push(rct(-18.6, -2.6, 5.2, 5.2, "#2c3446", 1));
    out.push(circ(15, -4, 3, p.accent));
    out.push(circ(22, 2, 3, p.accent2));
    out.push(circ(-8, 8, 4.4, "#2c3446"));
    out.push(circ(8, 8, 4.4, "#2c3446"));
    break;
  case "computer":
    out.push(rct(-32, -26, 64, 40, D.grad(lighten(p.stone, 0.3), darken(p.stone, 0.3), 110), 3));
    out.push(rct(-28, -22, 56, 32, p.dark ? "#0d1830" : "#14203c", 2));
    out.push(rct(-25, -19, 26, 3, p.glow, 1));
    out.push(rct(-25, -13, 40, 2.5, p.accent, 1, ' opacity="0.8"'));
    out.push(rct(-25, -8, 32, 2.5, p.accent2, 1, ' opacity="0.7"'));
    out.push(rct(-25, -3, 44, 2.5, p.accent, 1, ' opacity="0.5"'));
    out.push(pth(P().M(-34, 14).L(34, 14).L(42, 26).L(-42, 26).Z().d, D.grad(lighten(p.stone, 0.2), darken(p.stone, 0.4), 110)));
    break;
  case "heart": {
    var hg = D.grad(lighten(c, 0.3), darken(c, 0.32), 118);
    out.push(pth(P().M(0, 30).C(-30, 8, -34, -14, -18, -24).C(-8, -30, -1, -24, 0, -16)
      .C(1, -24, 8, -30, 18, -24).C(34, -14, 30, 8, 0, 30).Z().d, hg));
    out.push(ell(-11, -12, 6, 4.5, "#ffffff", ' opacity="0.4" transform="rotate(-32 -11 -12)"'));
    break;
  }
  case "cake":
    out.push(pth(P().M(-26, 6).L(26, 6).L(24, 28).C(12, 32, -12, 32, -24, 28).Z().d, D.grad("#f4d9b8", "#c9a179", 110)));
    out.push(pth(P().M(-26, 6).C(-20, 0, -14, 10, -8, 4).C(-2, -2, 4, 8, 10, 2).C(16, -3, 22, 8, 26, 6).L(26, 12).L(-26, 12).Z().d,
      D.grad(lighten(c, 0.3), darken(c, 0.2), 110)));
    out.push(rct(-1.6, -18, 3.2, 20, "#f2f4fa", 1));
    out.push(pth(P().M(0, -26).C(-3, -22, -2, -18, 0, -17).C(2, -18, 3, -22, 0, -26).Z().d, "#ffce5a"));
    for (i = 0; i < 6; i++) out.push(circ(-20 + i * 8, 16 + (i % 2) * 5, 1.6, i % 2 ? p.accent2 : "#ffffff"));
    break;
  case "orb": {
    var og = D.radial(lighten(c, 0.6), darken(c, 0.45), 33, 28, 72);
    out.push(circ(0, 0, 26, og));
    out.push(ell(-9, -10, 8, 5.5, "#ffffff", ' opacity="0.45" transform="rotate(-30 -9 -10)"'));
    var gl3 = D.glowF(6, 1.2);
    out.push('<g filter="' + gl3 + '" opacity="0.5">' + circ(0, 0, 22, c) + "</g>");
    break;
  }
  case "cube": {
    var top = lighten(c, 0.3), side = darken(c, 0.2), face = c;
    out.push(pth(P().M(0, -28).L(26, -14).L(0, 0).L(-26, -14).Z().d, top));
    out.push(pth(P().M(-26, -14).L(0, 0).L(0, 28).L(-26, 14).Z().d, side));
    out.push(pth(P().M(26, -14).L(0, 0).L(0, 28).L(26, 14).Z().d, face));
    break;
  }
  case "eye": {
    out.push(pth(P().M(-34, 0).C(-20, -22, 20, -22, 34, 0).C(20, 22, -20, 22, -34, 0).Z().d, "#f6f9ff"));
    out.push(circ(0, 0, 13, D.radial(lighten(c, 0.4), darken(c, 0.45), 40, 35, 70)));
    out.push(circ(0, 0, 6, "#12161f"));
    out.push(circ(-4.5, -4.5, 3, "#ffffff", ' opacity="0.9"'));
    out.push(pth(P().M(-34, 0).C(-20, -22, 20, -22, 34, 0).d, "none", ' stroke="' + darken(p.trim, 0.4) + '" stroke-width="2.6"'));
    break;
  }
  case "gear": {
    var gg = D.grad(lighten(p.stone, 0.4), darken(p.stone, 0.35), 115), inner = "";
    for (i = 0; i < 10; i++){
      var a2 = i * Math.PI / 5;
      inner += grp("rotate(" + n2(a2 * 180 / Math.PI) + ")", rct(-4, -30, 8, 11, gg, 1.5));
    }
    out.push(inner);
    out.push(circ(0, 0, 21, gg));
    out.push(circ(0, 0, 8, p.dark ? "#101828" : "#2a3448"));
    break;
  }
  default: {
    var dg = D.grad(lighten(c, 0.3), darken(c, 0.35), 115);
    out.push(circ(0, 0, 24, dg));
    out.push(ell(-8, -9, 7, 5, "#ffffff", ' opacity="0.35" transform="rotate(-30 -8 -9)"'));
    break;
  }
  }
  return out.join("");
}
