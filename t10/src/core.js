/* T10 WORLD — core utilities, math, RNG, save system
 * No dependencies. Attaches everything to the global T10 namespace.
 */
(function (global) {
  'use strict';

  var T10 = global.T10 = global.T10 || {};
  T10.VERSION = '1.00';

  /* ------------------------------------------------------------------ math */
  var M = T10.M = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    // frame-rate independent exponential smoothing
    damp: function (a, b, lambda, dt) { return M.lerp(a, b, 1 - Math.exp(-lambda * dt)); },
    smoothstep: function (e0, e1, x) { var t = M.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); },
    wrapAngle: function (a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; },
    lerpAngle: function (a, b, t) { return a + M.wrapAngle(b - a) * t; },
    dist2: function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; },
    dist: function (ax, az, bx, bz) { return Math.sqrt(M.dist2(ax, az, bx, bz)); },
    rand: function (a, b) { return a + Math.random() * (b - a); },
    randi: function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  };

  /* Deterministic RNG (mulberry32) so the city is identical every session. */
  T10.rng = function (seed) {
    var a = seed >>> 0;
    var f = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = function (lo, hi) { return lo + f() * (hi - lo); };
    f.int = function (lo, hi) { return Math.floor(lo + f() * (hi - lo + 1)); };
    f.pick = function (arr) { return arr[Math.floor(f() * arr.length) % arr.length]; };
    f.chance = function (p) { return f() < p; };
    return f;
  };

  /* Cheap value noise for weather drift / crowd variation. */
  T10.noise1 = function (x) {
    var i = Math.floor(x), f = x - i;
    function h(n) { n = (n << 13) ^ n; return 1 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824; }
    var a = h(i), b = h(i + 1), u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };

  /* ------------------------------------------------------------------ mat4 */
  var Mat4 = T10.Mat4 = {
    create: function () { var m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
    identity: function (m) {
      m[0] = 1; m[1] = 0; m[2] = 0; m[3] = 0; m[4] = 0; m[5] = 1; m[6] = 0; m[7] = 0;
      m[8] = 0; m[9] = 0; m[10] = 1; m[11] = 0; m[12] = 0; m[13] = 0; m[14] = 0; m[15] = 1; return m;
    },
    perspective: function (out, fovy, aspect, near, far) {
      var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
      out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
      out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
      out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0; return out;
    },
    ortho: function (out, l, r, b, t, n, f) {
      var lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
      out[0] = -2 * lr; out[1] = 0; out[2] = 0; out[3] = 0;
      out[4] = 0; out[5] = -2 * bt; out[6] = 0; out[7] = 0;
      out[8] = 0; out[9] = 0; out[10] = 2 * nf; out[11] = 0;
      out[12] = (l + r) * lr; out[13] = (t + b) * bt; out[14] = (f + n) * nf; out[15] = 1; return out;
    },
    lookAt: function (out, eye, center, up) {
      var z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
      var len = Math.hypot(z0, z1, z2) || 1; z0 /= len; z1 /= len; z2 /= len;
      var x0 = up[1] * z2 - up[2] * z1, x1 = up[2] * z0 - up[0] * z2, x2 = up[0] * z1 - up[1] * z0;
      len = Math.hypot(x0, x1, x2); if (!len) { x0 = 1; x1 = 0; x2 = 0; } else { x0 /= len; x1 /= len; x2 /= len; }
      var y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
      out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
      out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
      out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
      out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
      out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
      out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
      out[15] = 1; return out;
    },
    mul: function (out, a, b) {
      for (var i = 0; i < 4; i++) {
        var ai0 = a[i], ai1 = a[i + 4], ai2 = a[i + 8], ai3 = a[i + 12];
        out[i] = ai0 * b[0] + ai1 * b[1] + ai2 * b[2] + ai3 * b[3];
        out[i + 4] = ai0 * b[4] + ai1 * b[5] + ai2 * b[6] + ai3 * b[7];
        out[i + 8] = ai0 * b[8] + ai1 * b[9] + ai2 * b[10] + ai3 * b[11];
        out[i + 12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15];
      }
      return out;
    }
  };

  /* --------------------------------------------------------------- events */
  var listeners = {};
  T10.on = function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return fn; };
  T10.off = function (ev, fn) { var l = listeners[ev]; if (l) { var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } };
  T10.emit = function (ev, data) {
    var l = listeners[ev]; if (!l) return;
    for (var i = 0; i < l.length; i++) { try { l[i](data); } catch (e) { console.warn('[T10] listener error on ' + ev, e); } }
  };

  /* ----------------------------------------------------------------- time */
  T10.clockString = function (minutes, use24) {
    var m = ((minutes % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mm = Math.floor(m % 60);
    if (use24) return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
    var ap = h < 12 ? 'AM' : 'PM', h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap;
  };
  T10.MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  T10.DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  T10.dateString = function (dayIndex) {
    // day 0 == Monday, September 8
    var start = new Date(Date.UTC(2025, 8, 8));
    start.setUTCDate(start.getUTCDate() + dayIndex);
    return T10.DAYS[start.getUTCDay()] + ', ' + T10.MONTHS[start.getUTCMonth()] + ' ' + start.getUTCDate();
  };
  T10.dayOfWeek = function (dayIndex) {
    var start = new Date(Date.UTC(2025, 8, 8));
    start.setUTCDate(start.getUTCDate() + dayIndex);
    return start.getUTCDay();
  };
  T10.isWeekend = function (dayIndex) { var d = T10.dayOfWeek(dayIndex); return d === 0 || d === 6; };
  T10.money = function (n) {
    var neg = n < 0; n = Math.abs(n);
    var s = n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-$' : '$') + s;
  };

  /* --------------------------------------------------------------- state */
  T10.SAVE_KEY = 't10.world.save.v1';
  T10.RECOVERY_KEY = 't10.world.recovery.v1';

  T10.defaultState = function () {
    return {
      version: T10.VERSION,
      createdAt: Date.now(),
      savedAt: 0,
      playtime: 0,
      firstRun: true,
      time: { minutes: 7 * 60 + 3, day: 0, scale: 45 },   // 45 in-game seconds per real second
      player: {
        pos: [0, 0, 0], yaw: 0, pitch: -0.05,
        place: 'apt_home',        // 'street' or an interior id
        camera: 'third',
        money: 420,
        health: 100, energy: 78, hunger: 72, hygiene: 84, mood: 70,
        outfit: 'casual',
        skin: 0, hair: 0,
        name: 'You',
        homeId: 'apt_home',
        speedMul: 1
      },
      inventory: [
        { id: 'phone', name: 'Phone', qty: 1 },
        { id: 'keys', name: 'Apartment Keys', qty: 1 },
        { id: 'metrocard', name: 'MetroCard', qty: 1 },
        { id: 'wallet', name: 'Wallet', qty: 1 }
      ],
      wardrobe: ['casual', 'hoodie', 'suit', 'gym', 'rain'],
      world: {
        weather: 'clear', weatherTarget: 'clear', weatherT: 0, weatherTimer: 900,
        wetness: 0, snow: 0, wind: 0.3,
        trafficDensity: 1, npcDensity: 1,
        music: 'off'
      },
      progress: {
        discovered: {},
        activities: {},
        visits: {},
        relationships: {},
        objects: {},          // persistent world changes (lights, doors, dropped items)
        quests: [],
        stats: { steps: 0, distance: 0, rides: 0, photos: 0, meals: 0, workouts: 0, shifts: 0, earned: 0, spent: 0, daysLived: 0 }
      },
      job: { id: null, title: null, shiftsDone: 0, xp: 0, onShift: false, shiftEnds: 0, paydue: 0 },
      vehicles: [],
      settings: {
        quality: 'auto', shadows: true, joystickSide: 'left', joystickSize: 1,
        lookSens: 1, invertY: false, music: 0.5, sfx: 0.8, fov: 62, use24h: false,
        showFps: false, autoSave: true, hapticButtons: true
      }
    };
  };

  function deepMerge(base, over) {
    if (over === null || over === undefined) return base;
    if (typeof base !== 'object' || base === null || Array.isArray(base)) return over;
    if (typeof over !== 'object' || Array.isArray(over)) return over;
    var out = {};
    for (var k in base) out[k] = base[k];
    for (var k2 in over) out[k2] = deepMerge(base[k2], over[k2]);
    return out;
  }
  T10.deepMerge = deepMerge;

  var storageOK = (function () {
    try { global.localStorage.setItem('__t10probe', '1'); global.localStorage.removeItem('__t10probe'); return true; }
    catch (e) { return false; }
  })();
  var memStore = {};
  function storeSet(k, v) { if (storageOK) { try { global.localStorage.setItem(k, v); return true; } catch (e) { memStore[k] = v; return false; } } memStore[k] = v; return false; }
  function storeGet(k) { if (storageOK) { try { return global.localStorage.getItem(k); } catch (e) { return memStore[k] || null; } } return memStore[k] || null; }
  function storeDel(k) { if (storageOK) { try { global.localStorage.removeItem(k); } catch (e) { } } delete memStore[k]; }
  T10.storageAvailable = storageOK;

  T10.state = T10.defaultState();

  T10.hasSave = function () { return !!storeGet(T10.SAVE_KEY) || !!storeGet(T10.RECOVERY_KEY); };

  T10.loadState = function () {
    var raw = storeGet(T10.SAVE_KEY);
    var rec = storeGet(T10.RECOVERY_KEY);
    var chosen = null, fromRecovery = false;
    try {
      var a = raw ? JSON.parse(raw) : null;
      var b = rec ? JSON.parse(rec) : null;
      if (a && b) { chosen = (b.savedAt || 0) > (a.savedAt || 0) ? b : a; fromRecovery = chosen === b; }
      else chosen = a || b, fromRecovery = !a && !!b;
    } catch (e) {
      console.warn('[T10] corrupt save, trying recovery', e);
      try { chosen = rec ? JSON.parse(rec) : null; fromRecovery = true; } catch (e2) { chosen = null; }
    }
    if (!chosen) return false;
    T10.state = deepMerge(T10.defaultState(), chosen);
    T10.state.firstRun = false;
    T10.state.recovered = fromRecovery;
    return true;
  };

  var lastSaveAt = 0;
  T10.saveState = function (reason, quiet) {
    var s = T10.state;
    s.savedAt = Date.now();
    s.version = T10.VERSION;
    var json;
    try { json = JSON.stringify(s); }
    catch (e) { console.warn('[T10] save serialize failed', e); return false; }
    var ok = storeSet(T10.SAVE_KEY, json);
    // Rolling recovery copy — written slightly less often to stay a step behind corruption.
    if (Date.now() - lastSaveAt > 25000) { storeSet(T10.RECOVERY_KEY, json); lastSaveAt = Date.now(); }
    T10.emit('saved', { reason: reason || 'auto', quiet: !!quiet, ok: ok });
    return ok;
  };

  T10.wipeSave = function () { storeDel(T10.SAVE_KEY); storeDel(T10.RECOVERY_KEY); };

  /* Inventory helpers */
  T10.addItem = function (id, name, qty) {
    qty = qty || 1;
    var inv = T10.state.inventory;
    for (var i = 0; i < inv.length; i++) if (inv[i].id === id) { inv[i].qty += qty; return inv[i]; }
    var it = { id: id, name: name || id, qty: qty };
    inv.push(it); return it;
  };
  T10.removeItem = function (id, qty) {
    qty = qty || 1;
    var inv = T10.state.inventory;
    for (var i = 0; i < inv.length; i++) if (inv[i].id === id) {
      inv[i].qty -= qty;
      if (inv[i].qty <= 0) inv.splice(i, 1);
      return true;
    }
    return false;
  };
  T10.hasItem = function (id) {
    var inv = T10.state.inventory;
    for (var i = 0; i < inv.length; i++) if (inv[i].id === id) return inv[i].qty;
    return 0;
  };

  /* Money helpers — every transaction routes through here so stats stay honest. */
  T10.pay = function (amount, label) {
    var p = T10.state.player;
    if (p.money < amount) return false;
    p.money -= amount;
    T10.state.progress.stats.spent += amount;
    T10.emit('money', { delta: -amount, label: label });
    return true;
  };
  T10.earn = function (amount, label) {
    var p = T10.state.player;
    p.money += amount;
    T10.state.progress.stats.earned += amount;
    T10.emit('money', { delta: amount, label: label });
    return true;
  };

  /* Device sniffing used by control + quality defaults */
  T10.device = (function () {
    var ua = (global.navigator && global.navigator.userAgent) || '';
    var touch = ('ontouchstart' in global) || (global.navigator && global.navigator.maxTouchPoints > 0);
    var mobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua) || (touch && Math.min(screen.width, screen.height) < 900);
    var cores = (global.navigator && global.navigator.hardwareConcurrency) || 4;
    var mem = (global.navigator && global.navigator.deviceMemory) || (mobile ? 3 : 8);
    var lowEnd = mobile ? (cores <= 4 || mem <= 3) : (cores <= 2 || mem <= 4);
    return { touch: touch, mobile: mobile, cores: cores, mem: mem, lowEnd: lowEnd };
  })();

})(typeof window !== 'undefined' ? window : globalThis);
