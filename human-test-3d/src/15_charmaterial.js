// ============================================================================
// Shared character material: MeshStandardMaterial patched with per-vertex
// material ids (skin / fabrics / hair / eyes), procedural micro-detail, and
// per-character uniforms (zombie tint, hit flash, selection highlight, wetness).
// ============================================================================
const CharShared = { uTime: { value: 0 }, uDetail: { value: 1 } };

const GLSL_HT_COMMON = /* glsl */`
uniform float uZombie; uniform float uFlash; uniform float uHighlight; uniform float uWet; uniform float uTime; uniform float uDetail;
uniform vec4 uWA[16]; uniform vec4 uWB[16]; uniform int uWN; uniform float uBlood;
varying vec4 vMat; varying vec3 vColor2; varying vec2 vUvP; varying vec3 vRest;
float htHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float htNoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(htHash(i), htHash(i + vec2(1.0, 0.0)), u.x), mix(htHash(i + vec2(0.0, 1.0)), htHash(i + vec2(1.0, 1.0)), u.x), u.y); }
float htFbm(vec2 p) { return 0.55 * htNoise(p) + 0.3 * htNoise(p * 2.07 + 3.1) + 0.15 * htNoise(p * 4.13 + 7.7); }
vec3 htPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz));
  vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
  vec3 vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN);
  vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
// fade high frequency detail with distance (anti-aliasing)
float htAA(float freq, vec2 uv) { vec2 w = fwidth(uv) * freq; return clamp(1.0 - max(w.x, w.y) * 1.6, 0.0, 1.0); }
`;

const GLSL_HT_ALBEDO = /* glsl */`
  int mT = int(vMat.x + 0.5);
  int pT = int(vMat.z + 0.5);
  float htRough = vMat.y;
  float htMetal = 0.0;
  float htH = 0.0;       // bump height
  float htBump = 0.0;    // bump strength
  vec2 puv = vUvP;
  vec3 base = diffuseColor.rgb;
  bool isCloth = (mT >= 1 && mT <= 4) || mT == 9 || mT == 14;
  int feat = pT / 10;
  pT = pT - feat * 10;
  if (isCloth) {
    float sc = (feat == 1 || feat == 4) ? 1.0 : vMat.w;
    if (pT == 1) { float s = step(0.55, fract(puv.y * 11.0 * sc)); base = mix(base, vColor2, s * 0.9); }
    else if (pT == 2) {
      float a = step(0.7, fract(puv.x * 8.0 * sc)); float b = step(0.7, fract(puv.y * 8.0 * sc));
      float ln = max(step(0.94, fract(puv.x * 16.0 * sc + 0.3)), step(0.94, fract(puv.y * 16.0 * sc + 0.3)));
      base = mix(base, vColor2, clamp(a * 0.5 + b * 0.5, 0.0, 0.75));
      base = mix(base, vec3(0.85), ln * 0.25);
    }
    else if (pT == 3) { base *= 0.84 + 0.32 * htNoise(puv * 900.0) * htAA(900.0, puv) + 0.16 * (1.0 - htAA(900.0, puv)); }
    else if (pT == 4) { float s = step(0.9, fract(puv.x * 55.0 * sc)); base = mix(base, base * 1.6 + 0.05, s * 0.7 * htAA(55.0, puv)); }
    else if (pT == 5) { vec2 g = fract(puv * 22.0 * sc) - 0.5; float d = length(g); base = mix(base, mix(base, vec3(0.95), 0.75), (1.0 - smoothstep(0.17, 0.22, d)) * 0.9); }
    else if (pT == 6) {
      vec2 q = puv * 14.0 * sc; vec2 g = fract(q) - 0.5; float id = htHash(floor(q));
      float ang = atan(g.y, g.x); float r = length(g);
      float petal = 0.18 + 0.08 * cos(ang * 5.0 + id * 6.28);
      float fl = (1.0 - smoothstep(petal, petal + 0.04, r)) * step(0.35, id);
      base = mix(base, mix(vColor2, vec3(0.95, 0.85, 0.4), step(r, 0.06)), fl * 0.95);
    }
    else if (pT == 7) { htH += abs(sin(puv.x * 520.0)) * 0.6; htBump += 0.5 * htAA(520.0, puv); }
    // weave / material micro structure
    if (mT == 1 || mT == 14) {
      float f = mT == 14 ? 260.0 : 380.0;
      float w = sin(puv.x * f) * sin(puv.y * f);
      htH += w * 0.5; htBump += 0.35 * htAA(f, puv);
      base *= 0.95 + 0.1 * htNoise(puv * 60.0);
    } else if (mT == 2) {
      float tw = sin((puv.x + puv.y) * 1100.0);
      htH += tw * 0.5; htBump += 0.45 * htAA(1100.0, puv);
      float fade = htFbm(puv * vec2(6.0, 3.0));
      base *= 0.9 + 0.12 * tw * htAA(1100.0, puv) + 0.25 * smoothstep(0.55, 0.85, fade);
    } else if (mT == 3) {
      float k = abs(sin(puv.x * 430.0)) * (0.7 + 0.3 * sin(puv.y * 900.0));
      htH += k * 0.6; htBump += 0.45 * htAA(430.0, puv);
      base *= 0.92 + 0.12 * htNoise(puv * 300.0);
    } else if (mT == 4) {
      float g = htNoise(puv * 520.0);
      htH += g * 0.4; htBump += 0.35 * htAA(520.0, puv);
      htRough = clamp(vMat.y + (htFbm(puv * 30.0) - 0.5) * 0.25, 0.25, 0.8);
      base *= 0.92 + 0.1 * htFbm(puv * 25.0);
    } else if (mT == 9) {
      base *= 0.97 + 0.05 * htNoise(puv * 80.0);
    }
  } else if (mT == 0 || mT == 8) {
    float n = htFbm(puv * 55.0);
    base *= 0.94 + 0.1 * n;
    float pores = htNoise(puv * 1400.0);
    htH += pores * 0.5; htBump += 0.18 * htAA(1400.0, puv) * uDetail;
    htRough = clamp(vMat.y + (n - 0.5) * 0.12 - uWet * 0.25, 0.2, 0.9);
    if (uZombie > 0.0) {
      float lum = dot(base, vec3(0.3, 0.55, 0.15));
      vec3 zc = vec3(lum) * vec3(0.78, 0.9, 0.7) + vec3(0.02, 0.03, 0.0);
      float mott = htFbm(puv * 18.0);
      zc *= 0.82 + 0.3 * mott;
      base = mix(base, zc, uZombie * 0.85);
    }
  } else if (mT == 6 || mT == 12) {
    float strands = htNoise(vec2(puv.x * 900.0, puv.y * 40.0));
    float clump = htNoise(vec2(puv.x * 120.0, puv.y * 8.0));
    base *= 0.72 + 0.42 * strands * htAA(900.0, puv) + 0.21 * (1.0 - htAA(900.0, puv)) + 0.18 * (clump - 0.5);
    htH += strands * 0.7 + clump * 0.5; htBump += (mT == 6 ? 0.6 : 0.8) * htAA(400.0, puv);
    htRough = mT == 6 ? clamp(0.42 + 0.2 * (1.0 - strands), 0.3, 0.75) : 0.85;
    if (uZombie > 0.0) base = mix(base, base * vec3(0.8, 0.82, 0.78), uZombie * 0.5);
  } else if (mT == 7) {
    float pol = puv.y;
    float irisR = 0.50, pupilR = 0.18;
    float fib = htNoise(vec2(puv.x * 12.0, pol * 40.0));
    vec3 iris = vColor2 * (0.65 + 0.6 * fib);
    iris = mix(iris, iris * 0.45, smoothstep(irisR - 0.1, irisR, pol));
    iris = mix(iris, vColor2 * 1.25 + 0.03, (1.0 - smoothstep(pupilR, pupilR + 0.12, pol)) * 0.35);
    vec3 sclera = base * (0.94 + 0.06 * htNoise(puv * 30.0));
    sclera = mix(sclera, sclera * vec3(1.0, 0.86, 0.84), smoothstep(1.2, 1.7, pol) * 0.5);
    vec3 col = mix(iris, sclera, smoothstep(irisR - 0.015, irisR + 0.015, pol));
    float pupil = 1.0 - smoothstep(pupilR - 0.015, pupilR + 0.015, pol);
    col = mix(col, vec3(0.01), pupil);
    if (uZombie > 0.0) col = mix(col, vec3(0.78, 0.8, 0.74) * (0.9 + 0.1 * fib), uZombie * 0.85 * (1.0 - smoothstep(irisR, irisR + 0.05, pol)));
    base = col; htRough = 0.07;
  } else if (mT == 10) { base = base; htRough = 0.6; }
  else if (mT == 11) { htMetal = 1.0; htRough = 0.35; }
  else if (mT == 13) { htRough = 0.3; }
  else if (mT == 5) { htRough = 0.85; base *= 0.95 + 0.08 * htNoise(puv * 200.0); }
  if (isCloth && feat > 0) {
    float ax = abs(puv.x);
    float aa = fwidth(puv.x) * 1.5 + 0.0005;
    if (feat == 1 || feat == 4) {
      float v0 = vMat.w;
      float slope = feat == 4 ? 0.62 : 0.48;
      float w = (puv.y - v0) * slope;
      float inV = (1.0 - smoothstep(w - aa, w + aa, ax)) * step(v0, puv.y);
      if (feat == 4) {
        float lapel = (1.0 - smoothstep(w + 0.022 - aa, w + 0.022 + aa, ax)) * step(v0 - 0.02, puv.y) * (1.0 - inV);
        base = mix(base, base * 0.8, lapel * 0.55);
        float below = step(puv.y, v0);
        float btn = below * (1.0 - smoothstep(0.0045, 0.006, length(vec2(ax, mod(puv.y - v0 + 0.05, 0.1) - 0.05))));
        base = mix(base, base * 0.3, btn);
        float edge = below * (1.0 - smoothstep(0.0012, 0.0012 + aa, ax));
        base = mix(base, base * 0.45, edge);
      }
      if (inV > 0.0) {
        base = mix(base, vColor2, inV);
        if (feat == 1) { htRough = mix(htRough, 0.5, inV); }
        htBump *= 1.0 - inV * 0.8;
      }
      float hem = (1.0 - smoothstep(0.0, aa * 2.0 + 0.0025, abs(ax - w))) * step(v0, puv.y);
      base = mix(base, base * 0.68, hem * 0.55 * (1.0 - inV * 0.5));
    } else if (feat == 2) {
      float pl = 1.0 - smoothstep(0.011, 0.011 + aa, ax);
      float edge = 1.0 - smoothstep(0.0, aa * 1.5, abs(ax - 0.011));
      base = mix(base, base * 0.72, edge * 0.7);
      float btn = pl * (1.0 - smoothstep(0.0035, 0.0047, length(vec2(ax, mod(puv.y, 0.09) - 0.045))));
      base = mix(base, vColor2, btn);
    } else if (feat == 3) {
      float z = 1.0 - smoothstep(0.0035, 0.0035 + aa, ax);
      float teeth = step(0.5, fract(puv.y * 260.0));
      base = mix(base, vColor2 * (0.75 + 0.35 * teeth), z);
      htRough = mix(htRough, 0.35, z); htMetal = z * 0.8;
    }
  }
  if (isCloth && uZombie > 0.0) base = mix(base, base * vec3(0.72, 0.7, 0.62), uZombie * 0.45);
  if (uWet > 0.0 && mT != 7) { base *= 1.0 - uWet * 0.25; htRough *= 1.0 - uWet * 0.45; }
  // ---- wounds & blood (bind space: they move with the skinned surface) ----
  if (uWN > 0 || uBlood > 0.0) {
    float gBl = 0.0, gFl = 0.0, gHo = 0.0, gGu = 0.0, gSo = 0.0, gTu = 1.0;
    for (int i = 0; i < 16; i++) {
      if (i >= uWN) break;
      vec4 wA = uWA[i]; vec4 wB = uWB[i];
      vec3 wd = vRest - wA.xyz;
      float wr = wA.w;
      float wdist = length(wd);
      float wt = floor(wB.w + 0.001);
      float wk = fract(wB.w);
      if (wdist > wr * (wt == 6.0 ? 2.6 : 9.0) + 0.14 * wk + 0.03) continue;
      vec3 wn = wB.xyz;
      float wz1 = mix(0.5, htNoise(vRest.xy * 110.0 + vRest.z * 83.0 + float(i) * 13.1), htAA(110.0, vRest.xy));
      float wz2 = mix(0.5, htFbm(vRest.xz * 45.0 + vRest.y * 31.0 + float(i) * 3.7), htAA(45.0, vRest.xz));
      float wfront = (wt == 5.0 || wt == 3.0 || wt == 7.0) ? 1.0 : smoothstep(-wr * 2.5, 0.0, dot(wd, wn) + wr);
      // blood soaking outward with a ragged edge
      float sR = wt == 5.0 ? wr * 1.15 + 0.015 + 0.05 * wk : (wt == 7.0 ? wr * 0.8 + 0.008 + 0.02 * wk : wr * 2.0 + (0.015 + 0.085 * wk) * (isCloth ? 1.4 : 1.0) * (wt == 6.0 ? 1.6 : 1.0));
      gBl = max(gBl, (1.0 - smoothstep(0.55, 1.0, wdist / sR * (0.75 + 0.5 * wz2))) * wfront);
      // drips running down the body
      float wdy = wA.y - vRest.y;
      if (wdy > 0.0 && wt != 7.0 && wt != 5.0 && wdy < 0.32) {
        vec3 tg = wt == 3.0 ? wn : normalize(cross(vec3(0.0, 1.0, 0.0), wn) + vec3(1e-4, 0.0, 0.0));
        float sx = dot(wd, tg);
        float nearS = wt == 3.0 ? 1.0 : smoothstep(-wr * 1.5, 0.0, dot(wd, wn) + wr * 0.5);
        for (int j = 0; j < 3; j++) {
          float hj = htHash(vec2(float(i) * 7.0 + float(j), 3.1));
          float off = (hj - 0.5) * wr * 3.0;
          float len = min((wr * (5.0 + 14.0 * hj) + 0.04) * (0.25 + wk), 0.3);
          float wdt = wr * (0.22 + 0.25 * hj) * (1.0 - 0.6 * clamp(wdy / len, 0.0, 1.0)) * (1.0 + 0.3 * sin(wdy * 90.0 + hj * 6.0));
          float dr = (1.0 - smoothstep(wdt * 0.6, wdt, abs(sx - off))) * (1.0 - smoothstep(len * 0.85, len, wdy));
          gBl = max(gBl, dr * nearS);
        }
      }
      float q = wdist / wr * (0.82 + 0.36 * wz1);
      if (wt == 1.0) {
        gHo = max(gHo, 1.0 - smoothstep(0.42, 0.6, q));
        gFl = max(gFl, (1.0 - smoothstep(0.75, 1.05, q)) * 0.85);
      } else if (wt == 2.0 || wt == 4.0) {
        float ang = atan(wd.y, wd.x + wd.z);
        float rq = q * (wt == 4.0 ? (0.85 + 0.3 * sin(ang * 9.0)) : 1.0);
        gHo = max(gHo, (1.0 - smoothstep(0.28, 0.5, rq)) * 0.9);
        gFl = max(gFl, 1.0 - smoothstep(0.85, 1.12, rq));
        if (wt == 4.0) gHo = max(gHo, (1.0 - smoothstep(0.05, 0.12, abs(rq - 1.25))) * step(0.5, fract(ang * 2.5)) * 0.8);
      } else if (wt == 3.0) {
        float along = dot(wd, wn);
        float sl = wr * 6.0;
        vec3 perp = wd - wn * clamp(along, -sl, sl);
        float pq = length(perp) / wr * (0.8 + 0.4 * wz1);
        float taper = 1.0 - smoothstep(sl * 0.6, sl, abs(along));
        gHo = max(gHo, (1.0 - smoothstep(0.2, 0.42, pq)) * taper);
        gFl = max(gFl, (1.0 - smoothstep(0.55, 1.0, pq)) * taper);
        gBl = max(gBl, (1.0 - smoothstep(1.0, 2.6, pq)) * (1.0 - smoothstep(sl, sl * 1.4, abs(along))));
      } else if (wt == 5.0) {
        float pd = abs(dot(wd, wn));
        float band = wr * (0.22 + 0.42 * wz2);
        float rim = 1.0 - smoothstep(wr * 1.05, wr * 1.35, wdist);
        gFl = max(gFl, (1.0 - smoothstep(band * 0.7, band, pd)) * rim);
        gBl = max(gBl, (1.0 - smoothstep(band * 2.5, band * 5.5, pd)) * rim);
        float axd = length(wd - wn * dot(wd, wn));
        gTu = min(gTu, 1.0 - (1.0 - smoothstep(wr * 0.22, wr * 0.3, axd)) * (1.0 - smoothstep(band * 0.6, band, pd)));
      } else if (wt == 6.0) {
        float inner = 1.0 - smoothstep(0.68, 0.9, q);
        gGu = max(gGu, inner);
        gFl = max(gFl, 1.0 - smoothstep(0.88, 1.1, q));
        float coil = htFbm(vRest.xz * 16.0 + vRest.y * 12.0 + float(i)) * 14.0;
        gTu = min(gTu, mix(0.55, abs(sin(coil)), clamp(1.0 - fwidth(coil) * 0.9, 0.0, 1.0)));
      } else if (wt == 8.0) {
        float sootR = wr * 1.8;
        gSo = max(gSo, (1.0 - smoothstep(0.4, 1.0, wdist / sootR * (0.7 + 0.6 * wz2))) * wfront);
        float spn = htNoise(vRest.xy * 38.0 + vRest.zy * 29.0 + float(i)); float spw = fwidth(spn) + 0.04;
        float spk = smoothstep(0.72 - 0.25 * wk - spw, 0.72 - 0.25 * wk + spw, spn) * (1.0 - smoothstep(0.5, 1.2, wdist / sootR));
        gFl = max(gFl, spk * wfront);
      }
    }
    if (uBlood > 0.0) {
      float sp = htFbm(vRest.xy * 16.0 + vRest.zx * 11.0);
      float spw = fwidth(sp) * 1.2 + 0.025;
      float th = 1.0 - uBlood * 0.42;
      gBl = max(gBl, smoothstep(th - spw, th + spw, sp) * 0.88);
      float sp2 = htNoise(vRest.yz * 34.0 + 9.0);
      float sw2 = fwidth(sp2) * 1.2 + 0.03;
      gBl = max(gBl, smoothstep(1.0 - uBlood * 0.25 - sw2, 1.0 - uBlood * 0.25 + sw2, sp2) * 0.7 * htAA(34.0, vRest.yz));
    }
    vec3 bloodC = (isCloth ? vec3(0.16, 0.008, 0.008) : vec3(0.3, 0.012, 0.01)) * (0.85 + 0.25 * mix(0.5, htNoise(vRest.xy * 120.0), htAA(120.0, vRest.xy)));
    base = mix(base, bloodC, clamp(gBl, 0.0, 1.0) * 0.94);
    vec3 fleshC = mix(vec3(0.42, 0.04, 0.035), vec3(0.62, 0.15, 0.12), mix(0.5, htFbm(vRest.xy * 70.0 + vRest.z * 41.0), htAA(70.0, vRest.xy)));
    base = mix(base, fleshC, gFl);
    vec3 gutC = mix(vec3(0.55, 0.22, 0.24), vec3(0.76, 0.42, 0.4), mix(0.5, htNoise(vRest.xz * 48.0 + vRest.y * 30.0), htAA(48.0, vRest.xz)));
    gutC = mix(gutC * 0.3, gutC, smoothstep(0.15, 0.6, gTu));
    base = mix(base, gutC, gGu);
    base = mix(base, vec3(0.86, 0.8, 0.68), (1.0 - gTu) * (1.0 - gGu));
    base = mix(base, vec3(0.03, 0.025, 0.02), gSo * 0.85);
    base = mix(base, vec3(0.045, 0.0, 0.0), gHo);
    float wetW = max(max(gBl, gFl), gGu);
    htRough = mix(htRough, isCloth ? 0.42 : 0.16, wetW);
    htMetal = 0.0;
    htH -= gHo * 1.5 + gGu * (1.0 - gTu) * 0.9; htBump = max(htBump, (gHo + gGu * 0.8 + gFl * 0.4) * 0.9);
  }
  diffuseColor.rgb = base;
`;

function createCharacterMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.0, envMapIntensity: 0.8 });
  const U = {
    uZombie: { value: 0 }, uFlash: { value: 0 }, uHighlight: { value: 0 }, uWet: { value: 0 },
    uTime: CharShared.uTime, uDetail: CharShared.uDetail,
    uWA: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) }, uWB: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
    uWN: { value: 0 }, uBlood: { value: 0 }
  };
  m.userData.u = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aMat;\nattribute vec3 aColor2;\nvarying vec4 vMat;\nvarying vec3 vColor2;\nvarying vec2 vUvP;\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat; vColor2 = aColor2; vUvP = uv; vRest = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_HT_COMMON)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + GLSL_HT_ALBEDO)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = htRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = htMetal;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 dHdxy = vec2(dFdx(htH), dFdy(htH)) * htBump * 0.9;
          normal = htPerturb(-vViewPosition, normal, dHdxy, faceDirection);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 vdir = normalize(vViewPosition);
          float rim = pow(1.0 - clamp(abs(dot(normal, vdir)), 0.0, 1.0), 2.5);
          totalEmissiveRadiance += vec3(1.0, 0.93, 0.86) * uFlash * 0.22;
          totalEmissiveRadiance += vec3(0.25, 0.75, 1.0) * rim * uHighlight * 0.7;
          if (mT == 0 || mT == 8) totalEmissiveRadiance += diffuseColor.rgb * vec3(0.9, 0.35, 0.25) * rim * 0.06 * (1.0 - uZombie);
          if (uZombie > 0.0) totalEmissiveRadiance += vec3(0.02, 0.04, 0.0) * rim * uZombie;
        }`);
  };
  m.customProgramCacheKey = () => 'ht3d-char-v2';
  return m;
}

// Generate full character geometry from appearance + rig
function buildCharacterGeometry(app, rig, qualityName) {
  const Q = QUALITY[qualityName] || QUALITY.high;
  const mb = new MeshBuilder();
  buildBody(mb, app, rig, Q);
  buildHead(mb, app, rig, Q);
  const g = mb.build();
  g.userData.vertexCount = mb.n;
  return g;
}
HT.buildCharacterGeometry = buildCharacterGeometry;
HT.dev = { MeshBuilder, buildBody, buildHead, QUALITY, makeHeadShape, projectRay };
