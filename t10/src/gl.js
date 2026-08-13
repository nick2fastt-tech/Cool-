/* T10 WORLD — renderer
 * A small instanced WebGL engine. Everything in the city is drawn from two
 * meshes (a box and a 10-gon prism) with a procedural fragment shader, so the
 * game ships with zero texture downloads and still gets windows, asphalt,
 * foliage, water and neon.
 */
(function (global) {
  'use strict';
  var T10 = global.T10;
  var Mat4 = T10.Mat4;

  var FLOATS_PER_INST = 13; // pos3 size3 param4(rot,emissive,kind,seed) color3

  var R = T10.Renderer = {
    gl: null, canvas: null, ok: false,
    width: 1, height: 1, dpr: 1,
    quality: 'high',
    shadowsOn: true,
    stats: { draws: 0, instances: 0, tris: 0 }
  };

  /* --------------------------------------------------------------- shaders */
  var COMMON_NOISE = [
    'float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }',
    'float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }',
    'float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);',
    '  float a=hash21(i), b=hash21(i+vec2(1.0,0.0)), c=hash21(i+vec2(0.0,1.0)), d=hash21(i+vec2(1.0,1.0));',
    '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }'
  ].join('\n');

  var VS_MAIN = [
    'precision highp float;',
    'attribute vec3 a_pos; attribute vec3 a_normal;',
    'attribute vec3 a_ipos; attribute vec3 a_isize; attribute vec4 a_iparam; attribute vec3 a_icolor;',
    'uniform mat4 u_viewProj; uniform mat4 u_lightVP; uniform vec3 u_camPos;',
    'varying vec3 v_world; varying vec3 v_normal; varying vec3 v_local; varying vec3 v_color;',
    'varying vec4 v_param; varying vec4 v_shadow; varying float v_fog; varying vec3 v_unit;',
    'uniform float u_fogDensity;',
    // kind 8 (skin/cloth) reuses the seed slot as a pitch angle so limbs can
    // swing about their top edge; every other kind keeps it as a random seed.
    'void main(){',
    '  float c = cos(a_iparam.x), s = sin(a_iparam.x);',
    '  vec3 l = a_pos * a_isize;',
    '  float pitch = (a_iparam.z > 7.5 && a_iparam.z < 8.5) ? a_iparam.w : 0.0;',
    '  if(pitch != 0.0){ float cp = cos(pitch), sp = sin(pitch); l.y -= a_isize.y;',
    '    l = vec3(l.x, l.y*cp - l.z*sp, l.y*sp + l.z*cp); l.y += a_isize.y; }',
    '  vec3 rp = vec3(l.x*c + l.z*s, l.y, -l.x*s + l.z*c);',
    '  vec3 w = rp + a_ipos;',
    '  vec3 n = a_normal;',
    '  vec3 rn = normalize(vec3(n.x*c + n.z*s, n.y, -n.x*s + n.z*c));',
    '  v_world = w; v_normal = rn; v_local = l; v_unit = a_pos;',
    '  v_color = a_icolor; v_param = a_iparam;',
    '  v_shadow = u_lightVP * vec4(w, 1.0);',
    '  float d = distance(w, u_camPos);',
    '  v_fog = 1.0 - exp(-pow(d*u_fogDensity, 2.0));',
    '  gl_Position = u_viewProj * vec4(w, 1.0);',
    '}'
  ].join('\n');

  var FS_MAIN = [
    'precision highp float;',
    COMMON_NOISE,
    'varying vec3 v_world; varying vec3 v_normal; varying vec3 v_local; varying vec3 v_color;',
    'varying vec4 v_param; varying vec4 v_shadow; varying float v_fog; varying vec3 v_unit;',
    'uniform vec3 u_sunDir; uniform vec3 u_sunColor; uniform vec3 u_ambSky; uniform vec3 u_ambGround;',
    'uniform vec3 u_fogColor; uniform vec3 u_camPos; uniform float u_night; uniform float u_wet;',
    'uniform float u_snow; uniform float u_time; uniform sampler2D u_shadowMap; uniform float u_shadowOn;',
    'uniform float u_texel; uniform float u_indoor; uniform float u_exposure;',
    'float unpackD(vec4 c){ return dot(c, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0)); }',
    'float shadowAt(vec3 sc, float ndl){',
    '  if(u_shadowOn < 0.5) return 1.0;',
    '  if(sc.x<0.005||sc.x>0.995||sc.y<0.005||sc.y>0.995||sc.z>1.0) return 1.0;',
    '  float bias = mix(0.0016, 0.0006, ndl);',
    '  float sum = 0.0;',
    '  for(int i=-1;i<=1;i++){ for(int j=-1;j<=1;j++){',
    '    float d = unpackD(texture2D(u_shadowMap, sc.xy + vec2(float(i),float(j))*u_texel));',
    '    sum += (sc.z - bias > d) ? 0.0 : 1.0; } }',
    '  return sum/9.0;',
    '}',
    'void main(){',
    '  float kind = v_param.z; float emis = v_param.y; float seed = v_param.w;',
    '  vec3 base = v_color; vec3 N = normalize(v_normal);',
    '  float rough = 1.0; float glow = 0.0; vec3 glowCol = vec3(0.0);',
    '  float upFace = max(N.y, 0.0);',
    // --- building facade: window grid, lit at night
    '  if(kind > 0.5 && kind < 1.5){',
    '    float horiz = abs(N.y) > 0.5 ? 1.0 : 0.0;',
    '    vec2 uv = abs(N.x) > 0.5 ? vec2(v_local.z, v_local.y) : vec2(v_local.x, v_local.y);',
    '    vec2 g = vec2(3.1, 3.6);',
    '    vec2 cell = floor(uv/g);',
    '    vec2 f = fract(uv/g);',
    '    float win = step(0.16, f.x)*step(f.x,0.84)*step(0.20,f.y)*step(f.y,0.80);',
    '    win *= (1.0 - horiz);',
    '    float floorBand = step(0.93, fract(uv.y/g.y*1.0));',
    '    base = mix(base, base*0.82, floorBand);',
    '    float lit = step(0.45, hash21(cell + vec2(seed*13.0, seed*7.0)));',
    '    float flick = 0.85 + 0.15*sin(u_time*0.7 + hash21(cell)*40.0);',
    '    vec3 winCol = mix(vec3(0.30,0.36,0.45), vec3(1.0,0.86,0.60), lit);',
    '    float onNight = u_night * lit * flick;',
    '    base = mix(base, winCol*0.55, win*0.85);',
    '    glow = win * onNight * 1.25; glowCol = vec3(1.0,0.84,0.58);',
    '    if(v_local.y < 4.0 && horiz < 0.5){',  // street-level storefronts
    '      float sf = step(0.35, hash11(seed*31.0 + floor(uv.x/6.0)));',
    '      base = mix(base, vec3(0.12,0.13,0.16), 0.5);',
    '      glow = max(glow, sf * (0.35 + 0.65*u_night)); glowCol = mix(glowCol, vec3(0.55,0.85,1.0), 0.5);',
    '    }',
    '    rough = 0.75;',
    '  }',
    // --- asphalt with lane markings baked from world position
    '  else if(kind > 1.5 && kind < 2.5){',
    '    float n = vnoise(v_world.xz*0.9)*0.10 + vnoise(v_world.xz*7.0)*0.04;',
    '    base = base * (0.92 + n);',
    '    rough = mix(0.9, 0.18, u_wet);',
    '  }',
    // --- water
    '  else if(kind > 2.5 && kind < 3.5){',
    '    float w1 = vnoise(v_world.xz*0.06 + vec2(u_time*0.05, 0.0));',
    '    float w2 = vnoise(v_world.xz*0.21 - vec2(0.0, u_time*0.08));',
    '    N = normalize(N + vec3((w1-0.5)*0.35, 0.0, (w2-0.5)*0.35));',
    '    base = mix(base, u_fogColor*0.8, 0.35);',
    '    rough = 0.06;',
    '  }',
    // --- glass
    '  else if(kind > 3.5 && kind < 4.5){',
    '    rough = 0.05; base = mix(base, u_fogColor, 0.25);',
    '    glow = u_night*0.15; glowCol = vec3(0.6,0.8,1.0);',
    '  }',
    // --- foliage
    '  else if(kind > 4.5 && kind < 5.5){',
    '    float n = vnoise(v_world.xz*3.0 + v_world.y) ;',
    '    base *= (0.78 + 0.42*n);',
    '    rough = 1.0;',
    '  }',
    // --- concrete / sidewalk with slab seams
    '  else if(kind > 5.5 && kind < 6.5){',
    '    vec2 s = abs(fract(v_world.xz/2.4) - 0.5);',
    '    float seam = smoothstep(0.46, 0.5, max(s.x, s.y));',
    '    base = mix(base, base*0.78, seam);',
    '    base *= 0.94 + 0.12*vnoise(v_world.xz*5.0);',
    '    rough = mix(0.95, 0.3, u_wet*0.8);',
    '  }',
    // --- neon / billboard / signage
    '  else if(kind > 6.5 && kind < 7.5){',
    '    float band = fract(v_local.y*0.35 - u_time*0.35 + seed);',
    '    vec3 c2 = vec3(0.5+0.5*sin(seed*9.0+u_time*0.6), 0.5+0.5*sin(seed*5.0+2.0+u_time*0.4), 0.9);',
    '    base = mix(base, c2, 0.55 + 0.45*sin(band*6.28318));',
    '    glow = 1.4; glowCol = base;',
    '  }',
    // --- skin / cloth
    '  else if(kind > 7.5 && kind < 8.5){ rough = 0.85; }',
    // --- car paint / metal
    '  else if(kind > 8.5 && kind < 9.5){ rough = 0.18; }',
    // --- emissive lamp
    '  else if(kind > 9.5){ glow = 1.0; glowCol = base; rough = 0.4; }',
    // snow settles on up-facing surfaces
    '  if(u_snow > 0.01 && kind < 7.5){',
    '    float cover = u_snow * smoothstep(0.55, 0.95, upFace) * (0.7 + 0.3*vnoise(v_world.xz*1.4));',
    '    base = mix(base, vec3(0.93,0.95,1.0), clamp(cover,0.0,0.92));',
    '    rough = mix(rough, 0.9, cover);',
    '  }',
    '  vec3 V = normalize(u_camPos - v_world);',
    '  float ndl = max(dot(N, u_sunDir), 0.0);',
    '  vec3 sc = v_shadow.xyz / max(v_shadow.w, 0.0001) * 0.5 + 0.5;',
    '  float sh = shadowAt(sc, ndl);',
    '  float hemi = 0.5 + 0.5*N.y;',
    '  vec3 amb = mix(u_ambGround, u_ambSky, hemi);',
    '  vec3 diffuse = u_sunColor * ndl * sh;',
    '  vec3 H = normalize(u_sunDir + V);',
    '  float spec = pow(max(dot(N,H),0.0), mix(8.0, 180.0, 1.0-rough)) * (1.0-rough) * sh;',
    '  vec3 col = base * (amb + diffuse) + u_sunColor*spec*0.6;',
    // wet ground gets a cheap vertical smear reflection of the sky
    '  if(u_wet > 0.02 && upFace > 0.6 && kind < 7.0){',
    '    float fres = pow(1.0 - max(dot(N,V),0.0), 3.0);',
    '    col = mix(col, u_fogColor*1.15, clamp(u_wet*0.55*fres + u_wet*0.12, 0.0, 0.75));',
    '  }',
    // sodium street lighting: a warm wash on up-facing surfaces after dark
    '  col += base * u_night * 0.30 * smoothstep(0.2, 0.9, upFace) * (1.0 - u_indoor) * vec3(1.15, 0.92, 0.68);',
    '  col += glowCol * glow * emis;',
    '  col *= u_exposure;',
    '  col = mix(col, u_fogColor, clamp(v_fog*(1.0-u_indoor*0.85), 0.0, 1.0));',
    '  col = col / (col + vec3(0.85)) * 1.35;',   // filmic-ish tone curve
    '  gl_FragColor = vec4(pow(clamp(col,0.0,1.0), vec3(0.4545)), 1.0);',
    '}'
  ].join('\n');

  var VS_DEPTH = [
    'precision highp float;',
    'attribute vec3 a_pos; attribute vec3 a_ipos; attribute vec3 a_isize; attribute vec4 a_iparam;',
    'uniform mat4 u_lightVP; varying float v_d;',
    'void main(){',
    '  float c = cos(a_iparam.x), s = sin(a_iparam.x);',
    '  vec3 l = a_pos * a_isize;',
    '  float pitch = (a_iparam.z > 7.5 && a_iparam.z < 8.5) ? a_iparam.w : 0.0;',
    '  if(pitch != 0.0){ float cp = cos(pitch), sp = sin(pitch); l.y -= a_isize.y;',
    '    l = vec3(l.x, l.y*cp - l.z*sp, l.y*sp + l.z*cp); l.y += a_isize.y; }',
    '  vec3 rp = vec3(l.x*c + l.z*s, l.y, -l.x*s + l.z*c);',
    '  vec4 p = u_lightVP * vec4(rp + a_ipos, 1.0);',
    '  v_d = p.z*0.5 + 0.5; gl_Position = p;',
    '}'
  ].join('\n');

  var FS_DEPTH = [
    'precision highp float; varying float v_d;',
    'void main(){',
    '  float d = clamp(v_d, 0.0, 1.0);',
    '  vec4 c = fract(d * vec4(1.0, 255.0, 65025.0, 16581375.0));',
    '  c -= c.yzww * vec4(1.0/255.0, 1.0/255.0, 1.0/255.0, 0.0);',
    '  gl_FragColor = c;',
    '}'
  ].join('\n');

  var VS_SKY = [
    'precision highp float; attribute vec2 a_pos;',
    'uniform vec3 u_camRight, u_camUp, u_camFwd; uniform vec2 u_tan;',
    'varying vec3 v_ray;',
    'void main(){ v_ray = normalize(u_camFwd + u_camRight*a_pos.x*u_tan.x + u_camUp*a_pos.y*u_tan.y);',
    '  gl_Position = vec4(a_pos, 0.999, 1.0); }'
  ].join('\n');

  var FS_SKY = [
    'precision highp float;',
    COMMON_NOISE,
    'varying vec3 v_ray;',
    'uniform vec3 u_zenith, u_horizon, u_sunDir, u_sunColor; uniform float u_night, u_time, u_cloud, u_exposure;',
    'void main(){',
    '  vec3 d = normalize(v_ray);',
    '  float h = clamp(d.y*1.15 + 0.06, -1.0, 1.0);',
    '  vec3 col = mix(u_horizon, u_zenith, pow(clamp(h,0.0,1.0), 0.55));',
    '  if(h < 0.0) col = mix(u_horizon, u_horizon*0.55, clamp(-h*3.0,0.0,1.0));',
    '  float sd = max(dot(d, u_sunDir), 0.0);',
    '  col += u_sunColor * pow(sd, 8.0) * 0.35;',
    '  col += u_sunColor * pow(sd, 900.0) * 6.0 * step(0.0, u_sunDir.y+0.06);',
    '  if(u_night > 0.05 && d.y > -0.02){',
    '    vec2 sp = d.xz/(abs(d.y)+0.35);',
    '    float st = hash21(floor(sp*90.0));',
    '    float twinkle = 0.6 + 0.4*sin(u_time*2.0 + st*60.0);',
    '    col += vec3(0.85,0.9,1.0) * step(0.9955, st) * u_night * twinkle * 1.4;',
    '  }',
    '  if(d.y > 0.0){',
    '    vec2 cp = d.xz/(d.y+0.22);',
    '    float c = vnoise(cp*0.7 + vec2(u_time*0.006, 0.0))*0.55 + vnoise(cp*1.9 - vec2(u_time*0.01,0.0))*0.3;',
    '    float cover = smoothstep(0.52 - u_cloud*0.45, 0.86 - u_cloud*0.3, c) * u_cloud;',
    '    vec3 cc = mix(vec3(0.86,0.88,0.92), vec3(0.30,0.32,0.38), u_cloud*0.65);',
    '    cc = mix(cc*0.25, cc, 1.0-u_night);',
    '    cc += u_sunColor*pow(sd,3.0)*0.25;',
    '    col = mix(col, cc, clamp(cover*smoothstep(0.0,0.25,d.y),0.0,0.95));',
    '  }',
    '  col *= u_exposure;',
    '  col = col/(col+vec3(0.85))*1.35;',
    '  gl_FragColor = vec4(pow(clamp(col,0.0,1.0), vec3(0.4545)), 1.0);',
    '}'
  ].join('\n');

  var VS_PART = [
    'precision highp float; attribute vec2 a_corner; attribute float a_idx;',
    'uniform mat4 u_viewProj; uniform vec3 u_camPos, u_camRight, u_camUp;',
    'uniform float u_time, u_count, u_mode, u_size, u_wind, u_radius;',
    'varying float v_a; varying vec2 v_uv;',
    'float h(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }',
    'void main(){',
    '  float i = a_idx;',
    '  float hx = h(i*1.7), hz = h(i*3.3+7.0), hy = h(i*5.1+13.0), hs = h(i*9.7+3.0);',
    '  float speed = u_mode > 0.5 ? (1.2 + hs*0.8) : (22.0 + hs*14.0);',
    '  float span = 42.0;',
    '  float y = span - mod(u_time*speed + hy*span, span);',
    '  float sway = u_mode > 0.5 ? sin(u_time*0.8 + i)*1.6 : 0.0;',
    '  vec3 p = vec3((hx-0.5)*2.0*u_radius + sway + u_wind*y*0.35, y, (hz-0.5)*2.0*u_radius + u_wind*y*0.15);',
    '  p.x += floor(u_camPos.x/ (u_radius*2.0) + 0.5) * (u_radius*2.0);',
    '  p.z += floor(u_camPos.z/ (u_radius*2.0) + 0.5) * (u_radius*2.0);',
    '  vec3 wp = p;',
    '  float sw = u_size, sh = u_mode > 0.5 ? u_size : u_size*7.0;',
    '  wp += u_camRight * a_corner.x * sw + u_camUp * a_corner.y * sh;',
    '  if(u_mode < 0.5) wp.y += a_corner.y * sh * 0.6;',
    '  float d = distance(p, u_camPos);',
    '  v_a = clamp(1.0 - d/(u_radius*1.15), 0.0, 1.0);',
    '  v_uv = a_corner;',
    '  gl_Position = u_viewProj * vec4(wp, 1.0);',
    '}'
  ].join('\n');

  var FS_PART = [
    'precision highp float; varying float v_a; varying vec2 v_uv;',
    'uniform vec3 u_color; uniform float u_mode; uniform float u_opacity;',
    'void main(){',
    '  float m = u_mode > 0.5 ? smoothstep(0.5, 0.0, length(v_uv)) : 1.0;',
    '  gl_FragColor = vec4(u_color, v_a*m*u_opacity);',
    '}'
  ].join('\n');

  /* ------------------------------------------------------------ gl helpers */
  var gl, ext = {}, isGL2 = false;

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[T10] shader error:', gl.getShaderInfoLog(s), '\n' + src.split('\n').map(function (l, i) { return (i + 1) + ': ' + l; }).join('\n'));
      return null;
    }
    return s;
  }
  function program(vsSrc, fsSrc, attribs) {
    var p = gl.createProgram();
    var vs = compile(gl.VERTEX_SHADER, vsSrc), fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    for (var i = 0; i < attribs.length; i++) gl.bindAttribLocation(p, i, attribs[i]);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error('[T10] link error', gl.getProgramInfoLog(p)); return null; }
    var obj = { p: p, u: {}, a: {} };
    var nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var j = 0; j < nu; j++) { var info = gl.getActiveUniform(p, j); obj.u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
    for (var k = 0; k < attribs.length; k++) obj.a[attribs[k]] = k;
    return obj;
  }
  function divisor(loc, d) { if (isGL2) gl.vertexAttribDivisor(loc, d); else ext.inst.vertexAttribDivisorANGLE(loc, d); }
  function drawInstanced(mode, count, type, offset, prim) {
    if (isGL2) gl.drawElementsInstanced(mode, count, type, offset, prim);
    else ext.inst.drawElementsInstancedANGLE(mode, count, type, offset, prim);
  }

  /* ----------------------------------------------------------------- meshes */
  function boxMesh() {
    // unit box: x,z in [-0.5,0.5]; y in [0,1] (base sits on the ground)
    var v = [], n = [], idx = [];
    var faces = [
      [[0.5, 0, -0.5], [0.5, 0, 0.5], [0.5, 1, 0.5], [0.5, 1, -0.5], [1, 0, 0]],
      [[-0.5, 0, 0.5], [-0.5, 0, -0.5], [-0.5, 1, -0.5], [-0.5, 1, 0.5], [-1, 0, 0]],
      [[-0.5, 1, -0.5], [0.5, 1, -0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5], [0, 1, 0]],
      [[-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 0, -0.5], [-0.5, 0, -0.5], [0, -1, 0]],
      [[-0.5, 0, 0.5], [-0.5, 1, 0.5], [0.5, 1, 0.5], [0.5, 0, 0.5], [0, 0, 1]],
      [[0.5, 0, -0.5], [0.5, 1, -0.5], [-0.5, 1, -0.5], [-0.5, 0, -0.5], [0, 0, -1]]
    ];
    for (var f = 0; f < faces.length; f++) {
      var base = v.length / 3, nv = faces[f][4];
      for (var i = 0; i < 4; i++) { var p = faces[f][i]; v.push(p[0], p[1], p[2]); n.push(nv[0], nv[1], nv[2]); }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return { pos: new Float32Array(v), norm: new Float32Array(n), idx: new Uint16Array(idx) };
  }

  /* --------------------------------------------------------------- buffers */
  var progMain, progDepth, progSky, progPart;
  var meshes = {};
  var skyVBO, partVBO, partIdxVBO;
  var shadowFBO = null, shadowTex = null, shadowSize = 1024;
  var dynBuf = null, dynArr = null, dynCount = 0, dynCap = 0;
  var statics = {};      // key -> { vbo, count, cx, cz, r, visible }
  var MAX_PART = 2400;

  function makeMesh(name, m) {
    var o = { vbo: gl.createBuffer(), nbo: gl.createBuffer(), ibo: gl.createBuffer(), count: m.idx.length };
    gl.bindBuffer(gl.ARRAY_BUFFER, o.vbo); gl.bufferData(gl.ARRAY_BUFFER, m.pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, o.nbo); gl.bufferData(gl.ARRAY_BUFFER, m.norm, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
    meshes[name] = o;
  }

  R.init = function (canvas) {
    R.canvas = canvas;
    var opts = { alpha: false, antialias: !T10.device.lowEnd, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false };
    gl = canvas.getContext('webgl2', opts);
    if (gl) isGL2 = true;
    else { gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts); }
    if (!gl) { R.ok = false; return false; }
    R.gl = gl;
    if (!isGL2) {
      ext.inst = gl.getExtension('ANGLE_instanced_arrays');
      if (!ext.inst) { R.ok = false; console.error('[T10] instancing unsupported'); return false; }
    }
    progMain = program(VS_MAIN, FS_MAIN, ['a_pos', 'a_normal', 'a_ipos', 'a_isize', 'a_iparam', 'a_icolor']);
    progDepth = program(VS_DEPTH, FS_DEPTH, ['a_pos', 'a_normal', 'a_ipos', 'a_isize', 'a_iparam', 'a_icolor']);
    progSky = program(VS_SKY, FS_SKY, ['a_pos']);
    progPart = program(VS_PART, FS_PART, ['a_corner', 'a_idx']);
    if (!progMain || !progDepth || !progSky || !progPart) { R.ok = false; return false; }

    makeMesh('box', boxMesh());

    skyVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    // particle quads: 4 corners * N, indexed
    var pv = new Float32Array(MAX_PART * 4 * 3), pi = new Uint16Array(MAX_PART * 6);
    for (var i = 0; i < MAX_PART; i++) {
      var c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (var k = 0; k < 4; k++) { var o = (i * 4 + k) * 3; pv[o] = c[k][0]; pv[o + 1] = c[k][1]; pv[o + 2] = i; }
      var b = i * 4, q = i * 6;
      pi[q] = b; pi[q + 1] = b + 1; pi[q + 2] = b + 2; pi[q + 3] = b; pi[q + 4] = b + 2; pi[q + 5] = b + 3;
    }
    partVBO = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, partVBO); gl.bufferData(gl.ARRAY_BUFFER, pv, gl.STATIC_DRAW);
    partIdxVBO = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, partIdxVBO); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, pi, gl.STATIC_DRAW);

    dynCap = 20000;
    dynArr = new Float32Array(dynCap * FLOATS_PER_INST);
    dynBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
    gl.bufferData(gl.ARRAY_BUFFER, dynArr.byteLength, gl.DYNAMIC_DRAW);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    R.ok = true;
    R.setQuality(R.quality);
    return true;
  };

  function buildShadow(size) {
    if (shadowFBO) { gl.deleteFramebuffer(shadowFBO); gl.deleteTexture(shadowTex); if (R._sdepth) gl.deleteRenderbuffer(R._sdepth); }
    shadowSize = size;
    shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);
    shadowFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    R._sdepth = rb;
  }

  R.QUALITY = {
    low: { dpr: 0.7, shadow: 0, far: 420, fog: 0.0032, particles: 500, drawDist: 380 },
    medium: { dpr: 0.85, shadow: 1024, far: 700, fog: 0.0021, particles: 1100, drawDist: 620 },
    high: { dpr: 1.0, shadow: 1536, far: 1100, fog: 0.0014, particles: 1800, drawDist: 950 },
    ultra: { dpr: 1.35, shadow: 2048, far: 1600, fog: 0.0010, particles: 2400, drawDist: 1300 }
  };

  R.setQuality = function (q) {
    if (q === 'auto') q = T10.device.lowEnd ? 'low' : (T10.device.mobile ? 'medium' : 'high');
    if (!R.QUALITY[q]) q = 'medium';
    R.quality = q;
    var Q = R.QUALITY[q];
    R.dprCap = Q.dpr;
    R.far = Q.far;
    R.fogDensity = Q.fog;
    R.particleCount = Math.min(Q.particles, MAX_PART);
    R.drawDist = Q.drawDist;
    if (Q.shadow && R.shadowsOn) buildShadow(Q.shadow);
    else { shadowFBO = null; }
    R.resize();
    T10.emit('quality', q);
  };
  R.setShadows = function (on) {
    R.shadowsOn = !!on;
    var Q = R.QUALITY[R.quality];
    if (on && Q.shadow) buildShadow(Q.shadow); else shadowFBO = null;
  };

  R.resize = function () {
    if (!R.canvas) return;
    var dpr = Math.min(global.devicePixelRatio || 1, R.dprCap || 1);
    var w = Math.max(2, Math.floor(R.canvas.clientWidth * dpr));
    var h = Math.max(2, Math.floor(R.canvas.clientHeight * dpr));
    if (w === R.width && h === R.height) return;
    R.canvas.width = w; R.canvas.height = h;
    R.width = w; R.height = h; R.dpr = dpr;
  };

  /* ------------------------------------------------------------ static sets */
  R.setStatic = function (key, arr, cx, cz, radius) {
    var s = statics[key];
    if (!s) { s = statics[key] = { vbo: gl.createBuffer(), count: 0, cx: 0, cz: 0, r: 0 }; }
    gl.bindBuffer(gl.ARRAY_BUFFER, s.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    s.count = arr.length / FLOATS_PER_INST;
    s.cx = cx; s.cz = cz; s.r = radius;
  };
  R.dropStatic = function (key) {
    var s = statics[key];
    if (s) { gl.deleteBuffer(s.vbo); delete statics[key]; }
  };
  R.clearStatics = function () { for (var k in statics) R.dropStatic(k); };
  R.hasStatic = function (key) { return !!statics[key]; };
  R.staticKeys = function () { return Object.keys(statics); };

  /* ---------------------------------------------------------- dynamic queue */
  R.beginDynamic = function () { dynCount = 0; };
  R.push = function (x, y, z, sx, sy, sz, rot, color, emissive, kind, seed) {
    if (dynCount >= dynCap) return;
    var o = dynCount * FLOATS_PER_INST;
    var a = dynArr;
    a[o] = x; a[o + 1] = y; a[o + 2] = z;
    a[o + 3] = sx; a[o + 4] = sy; a[o + 5] = sz;
    a[o + 6] = rot || 0; a[o + 7] = emissive === undefined ? 1 : emissive; a[o + 8] = kind || 0; a[o + 9] = seed || 0;
    a[o + 10] = color[0]; a[o + 11] = color[1]; a[o + 12] = color[2];
    dynCount++;
  };
  R.dynamicCount = function () { return dynCount; };

  /* Instance array builder used by the world generator. */
  R.Builder = function () {
    this.data = [];
  };
  R.Builder.prototype.push = function (x, y, z, sx, sy, sz, rot, color, emissive, kind, seed) {
    this.data.push(x, y, z, sx, sy, sz, rot || 0, emissive === undefined ? 1 : emissive, kind || 0, seed || 0, color[0], color[1], color[2]);
    return this;
  };
  R.Builder.prototype.count = function () { return this.data.length / FLOATS_PER_INST; };
  R.Builder.prototype.array = function () { return new Float32Array(this.data); };

  /* ------------------------------------------------------------- frustum */
  var fplanes = new Float32Array(24);
  function extractPlanes(m) {
    var idx = 0;
    for (var i = 0; i < 6; i++) {
      var s = (i % 2) ? -1 : 1, r = Math.floor(i / 2);
      var a = m[3] + s * m[r], b = m[7] + s * m[4 + r], c = m[11] + s * m[8 + r], d = m[15] + s * m[12 + r];
      var len = Math.hypot(a, b, c) || 1;
      fplanes[idx++] = a / len; fplanes[idx++] = b / len; fplanes[idx++] = c / len; fplanes[idx++] = d / len;
    }
  }
  function sphereVisible(x, y, z, r) {
    for (var i = 0; i < 24; i += 4) {
      if (fplanes[i] * x + fplanes[i + 1] * y + fplanes[i + 2] * z + fplanes[i + 3] < -r) return false;
    }
    return true;
  }
  R.sphereVisible = sphereVisible;

  /* ------------------------------------------------------------- rendering */
  var viewM = Mat4.create(), projM = Mat4.create(), viewProj = Mat4.create();
  var lightV = Mat4.create(), lightP = Mat4.create(), lightVP = Mat4.create();

  function bindInstanced(prog, vbo, withColor) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    var stride = FLOATS_PER_INST * 4;
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 0); divisor(2, 1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 12); divisor(3, 1);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.FLOAT, false, stride, 24); divisor(4, 1);
    if (withColor) { gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 3, gl.FLOAT, false, stride, 40); divisor(5, 1); }
  }
  function bindMesh(mesh, withNormal) {
    var m = meshes[mesh];
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0); divisor(0, 0);
    if (withNormal) {
      gl.bindBuffer(gl.ARRAY_BUFFER, m.nbo);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0); divisor(1, 0);
    } else { gl.disableVertexAttribArray(1); }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ibo);
    return m;
  }

  /* env: {sunDir[3], sunColor[3], ambSky[3], ambGround[3], fogColor[3], zenith[3], horizon[3],
           night, wet, snow, cloud, indoor, exposure, fogScale, weatherMode, weatherAmt} */
  R.render = function (cam, env, time) {
    if (!R.ok) return;
    R.resize();
    var aspect = R.width / R.height;
    var fov = (cam.fov || 62) * Math.PI / 180;
    Mat4.perspective(projM, fov, aspect, 0.12, R.far);
    var fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), -Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    var eye = cam.pos;
    Mat4.lookAt(viewM, eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);
    Mat4.mul(viewProj, projM, viewM);
    extractPlanes(viewProj);

    var right = [Math.cos(cam.yaw), 0, Math.sin(cam.yaw)];
    var up = [fwd[1] * right[2] - fwd[2] * right[1], fwd[2] * right[0] - fwd[0] * right[2], fwd[0] * right[1] - fwd[1] * right[0]];
    var ul = Math.hypot(up[0], up[1], up[2]) || 1; up = [up[0] / ul, up[1] / ul, up[2] / ul];

    var drawDist = R.drawDist;
    var visible = [];
    for (var k in statics) {
      var s = statics[k];
      if (!s.count) continue;
      var dx = s.cx - eye[0], dz = s.cz - eye[2];
      if (dx * dx + dz * dz > (drawDist + s.r) * (drawDist + s.r)) continue;
      if (!sphereVisible(s.cx, 30, s.cz, s.r + 60)) continue;
      visible.push(s);
    }

    // upload dynamic instances
    if (dynCount) {
      gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, dynArr.subarray(0, dynCount * FLOATS_PER_INST));
    }

    R.stats.draws = 0; R.stats.instances = 0;

    /* ---- shadow pass */
    var useShadow = shadowFBO && env.indoor < 0.5 && env.sunDir[1] > 0.08;
    if (useShadow) {
      var R0 = 95;
      var cx = eye[0] + fwd[0] * 35, cz = eye[2] + fwd[2] * 35;
      var lp = [cx + env.sunDir[0] * 180, env.sunDir[1] * 180 + 20, cz + env.sunDir[2] * 180];
      Mat4.lookAt(lightV, lp, [cx, 0, cz], [0, 1, 0]);
      Mat4.ortho(lightP, -R0, R0, -R0, R0, 1, 420);
      Mat4.mul(lightVP, lightP, lightV);
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO);
      gl.viewport(0, 0, shadowSize, shadowSize);
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(progDepth.p);
      gl.uniformMatrix4fv(progDepth.u.u_lightVP, false, lightVP);
      var mb = bindMesh('box', false);
      for (var i = 0; i < visible.length; i++) {
        var sv = visible[i];
        if (Math.hypot(sv.cx - cx, sv.cz - cz) > R0 + sv.r + 40) continue;
        bindInstanced(progDepth, sv.vbo, false);
        drawInstanced(gl.TRIANGLES, mb.count, gl.UNSIGNED_SHORT, 0, sv.count);
        R.stats.draws++;
      }
      if (dynCount) {
        bindInstanced(progDepth, dynBuf, false);
        drawInstanced(gl.TRIANGLES, mb.count, gl.UNSIGNED_SHORT, 0, dynCount);
        R.stats.draws++;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
      Mat4.identity(lightVP);
    }

    /* ---- main pass */
    gl.viewport(0, 0, R.width, R.height);
    gl.clearColor(env.fogColor[0], env.fogColor[1], env.fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // sky
    if (env.indoor < 0.5) {
      gl.depthMask(false);
      gl.useProgram(progSky.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, skyVBO);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); divisor(0, 0);
      gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
      gl.disableVertexAttribArray(3); gl.disableVertexAttribArray(4); gl.disableVertexAttribArray(5);
      gl.uniform3fv(progSky.u.u_camRight, right);
      gl.uniform3fv(progSky.u.u_camUp, up);
      gl.uniform3fv(progSky.u.u_camFwd, fwd);
      gl.uniform2f(progSky.u.u_tan, Math.tan(fov / 2) * aspect, Math.tan(fov / 2));
      gl.uniform3fv(progSky.u.u_zenith, env.zenith);
      gl.uniform3fv(progSky.u.u_horizon, env.horizon);
      gl.uniform3fv(progSky.u.u_sunDir, env.sunDir);
      gl.uniform3fv(progSky.u.u_sunColor, env.sunColor);
      gl.uniform1f(progSky.u.u_night, env.night);
      gl.uniform1f(progSky.u.u_time, time);
      gl.uniform1f(progSky.u.u_cloud, env.cloud);
      gl.uniform1f(progSky.u.u_exposure, env.exposure);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.depthMask(true);
    }

    // geometry
    gl.useProgram(progMain.p);
    var U = progMain.u;
    gl.uniformMatrix4fv(U.u_viewProj, false, viewProj);
    gl.uniformMatrix4fv(U.u_lightVP, false, lightVP);
    gl.uniform3fv(U.u_camPos, eye);
    gl.uniform3fv(U.u_sunDir, env.sunDir);
    gl.uniform3fv(U.u_sunColor, env.sunColor);
    gl.uniform3fv(U.u_ambSky, env.ambSky);
    gl.uniform3fv(U.u_ambGround, env.ambGround);
    gl.uniform3fv(U.u_fogColor, env.fogColor);
    gl.uniform1f(U.u_night, env.night);
    gl.uniform1f(U.u_wet, env.wet);
    gl.uniform1f(U.u_snow, env.snow);
    gl.uniform1f(U.u_time, time);
    gl.uniform1f(U.u_indoor, env.indoor);
    gl.uniform1f(U.u_exposure, env.exposure);
    gl.uniform1f(U.u_fogDensity, R.fogDensity * (env.fogScale || 1) * (env.indoor > 0.5 ? 2.2 : 1));
    gl.uniform1f(U.u_shadowOn, useShadow ? 1 : 0);
    gl.uniform1f(U.u_texel, 1 / shadowSize);
    if (useShadow) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, shadowTex);
      gl.uniform1i(U.u_shadowMap, 0);
    }
    var mb2 = bindMesh('box', true);
    for (var v = 0; v < visible.length; v++) {
      bindInstanced(progMain, visible[v].vbo, true);
      drawInstanced(gl.TRIANGLES, mb2.count, gl.UNSIGNED_SHORT, 0, visible[v].count);
      R.stats.draws++; R.stats.instances += visible[v].count;
    }
    if (dynCount) {
      bindInstanced(progMain, dynBuf, true);
      drawInstanced(gl.TRIANGLES, mb2.count, gl.UNSIGNED_SHORT, 0, dynCount);
      R.stats.draws++; R.stats.instances += dynCount;
    }

    // weather particles
    if (env.weatherAmt > 0.01 && env.indoor < 0.5) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(progPart.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, partVBO);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 12, 0); divisor(0, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 12, 8); divisor(1, 0);
      gl.disableVertexAttribArray(2); gl.disableVertexAttribArray(3);
      gl.disableVertexAttribArray(4); gl.disableVertexAttribArray(5);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, partIdxVBO);
      gl.uniformMatrix4fv(progPart.u.u_viewProj, false, viewProj);
      gl.uniform3fv(progPart.u.u_camPos, eye);
      gl.uniform3fv(progPart.u.u_camRight, right);
      gl.uniform3fv(progPart.u.u_camUp, up);
      gl.uniform1f(progPart.u.u_time, time);
      gl.uniform1f(progPart.u.u_mode, env.weatherMode);        // 0 rain, 1 snow
      gl.uniform1f(progPart.u.u_size, env.weatherMode > 0.5 ? 0.10 : 0.035);
      gl.uniform1f(progPart.u.u_wind, env.wind);
      gl.uniform1f(progPart.u.u_radius, 34);
      gl.uniform1f(progPart.u.u_opacity, env.weatherMode > 0.5 ? 0.85 : 0.42);
      gl.uniform3fv(progPart.u.u_color, env.weatherMode > 0.5 ? [1, 1, 1] : [0.72, 0.80, 0.92]);
      var n = Math.floor(R.particleCount * Math.min(1, env.weatherAmt));
      gl.drawElements(gl.TRIANGLES, n * 6, gl.UNSIGNED_SHORT, 0);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      R.stats.draws++;
    }
  };

  R.worldToScreen = function (x, y, z) {
    var m = viewProj;
    var cx = m[0] * x + m[4] * y + m[8] * z + m[12];
    var cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    var cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0.01) return null;
    return { x: (cx / cw * 0.5 + 0.5) * R.canvas.clientWidth, y: (0.5 - cy / cw * 0.5) * R.canvas.clientHeight, w: cw };
  };

  R.FLOATS_PER_INST = FLOATS_PER_INST;

})(typeof window !== 'undefined' ? window : globalThis);
