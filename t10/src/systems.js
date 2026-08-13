/* T10 WORLD — systems
 * Clock, weather, sky/lighting, procedural audio, needs, money, jobs,
 * activities and public transport.
 */
(function (global) {
  'use strict';
  var T10 = global.T10;
  var M = T10.M;
  var P = T10.Places;

  var S = T10.Systems = {};

  /* ------------------------------------------------------------------ time */
  S.period = function (mins) {
    var h = ((mins === undefined ? T10.state.time.minutes : mins) / 60) % 24;
    if (h < 2) return 'late';
    if (h < 5) return 'late';
    if (h < 11) return 'morning';
    if (h < 17) return 'afternoon';
    if (h < 21) return 'evening';
    return 'night';
  };
  S.periodLabel = function () {
    return { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night', late: 'Late Night' }[S.period()];
  };

  S.advanceTime = function (minutes) {
    var t = T10.state.time;
    t.minutes += minutes;
    while (t.minutes >= 1440) { t.minutes -= 1440; t.day++; T10.state.progress.stats.daysLived++; T10.emit('newday', t.day); }
    T10.emit('timejump', minutes);
  };

  /* --------------------------------------------------------------- weather */
  S.WEATHERS = {
    clear: { label: 'Clear', cloud: 0.12, fog: 0.85, rain: 0, snow: 0, wind: 0.25, exposure: 1.0 },
    sunny: { label: 'Sunny', cloud: 0.05, fog: 0.7, rain: 0, snow: 0, wind: 0.2, exposure: 1.06 },
    cloudy: { label: 'Cloudy', cloud: 0.7, fog: 1.05, rain: 0, snow: 0, wind: 0.4, exposure: 0.9 },
    overcast: { label: 'Overcast', cloud: 0.95, fog: 1.25, rain: 0, snow: 0, wind: 0.5, exposure: 0.82 },
    rain: { label: 'Rain', cloud: 0.9, fog: 1.5, rain: 0.65, snow: 0, wind: 0.55, exposure: 0.78 },
    heavyrain: { label: 'Heavy Rain', cloud: 1.0, fog: 2.1, rain: 1.0, snow: 0, wind: 0.85, exposure: 0.68 },
    storm: { label: 'Thunderstorm', cloud: 1.0, fog: 2.3, rain: 1.0, snow: 0, wind: 1.0, exposure: 0.62, thunder: true },
    fog: { label: 'Fog', cloud: 0.6, fog: 3.4, rain: 0, snow: 0, wind: 0.15, exposure: 0.85 },
    snow: { label: 'Snow', cloud: 0.9, fog: 1.9, rain: 0, snow: 0.7, wind: 0.5, exposure: 0.95 },
    blizzard: { label: 'Blizzard', cloud: 1.0, fog: 3.0, rain: 0, snow: 1.0, wind: 1.0, exposure: 0.9 },
    wind: { label: 'Windy', cloud: 0.4, fog: 0.9, rain: 0, snow: 0, wind: 1.0, exposure: 0.98 }
  };

  var WEATHER_CHAIN = {
    clear: ['clear', 'sunny', 'cloudy', 'wind'],
    sunny: ['sunny', 'clear', 'cloudy'],
    cloudy: ['cloudy', 'clear', 'overcast', 'rain', 'wind'],
    overcast: ['overcast', 'cloudy', 'rain', 'fog', 'snow'],
    rain: ['rain', 'heavyrain', 'overcast', 'cloudy'],
    heavyrain: ['heavyrain', 'rain', 'storm', 'overcast'],
    storm: ['storm', 'heavyrain', 'rain'],
    fog: ['fog', 'overcast', 'cloudy'],
    snow: ['snow', 'blizzard', 'overcast'],
    blizzard: ['blizzard', 'snow', 'overcast'],
    wind: ['wind', 'cloudy', 'clear']
  };

  S.setWeather = function (type, instant) {
    if (!S.WEATHERS[type]) return false;
    var w = T10.state.world;
    if (instant) { w.weather = type; w.weatherTarget = type; w.weatherT = 1; }
    else { w.weatherTarget = type; w.weatherT = 0; }
    w.weatherTimer = 600 + Math.random() * 900;
    T10.emit('weather', type);
    return true;
  };

  function lerpWeather(a, b, t) {
    var A = S.WEATHERS[a] || S.WEATHERS.clear, Bw = S.WEATHERS[b] || S.WEATHERS.clear;
    return {
      cloud: M.lerp(A.cloud, Bw.cloud, t), fog: M.lerp(A.fog, Bw.fog, t),
      rain: M.lerp(A.rain, Bw.rain, t), snow: M.lerp(A.snow, Bw.snow, t),
      wind: M.lerp(A.wind, Bw.wind, t), exposure: M.lerp(A.exposure, Bw.exposure, t),
      thunder: (t > 0.5 ? Bw.thunder : A.thunder)
    };
  }

  S.weatherLabel = function () {
    var w = T10.state.world;
    return (S.WEATHERS[w.weatherT > 0.5 ? w.weatherTarget : w.weather] || S.WEATHERS.clear).label;
  };

  /* --------------------------------------------------------- sky & lighting */
  S.env = {
    sunDir: [0.4, 0.8, 0.4], sunColor: [1, 0.96, 0.88],
    ambSky: [0.35, 0.4, 0.5], ambGround: [0.2, 0.18, 0.16],
    fogColor: [0.6, 0.68, 0.78], zenith: [0.22, 0.42, 0.75], horizon: [0.72, 0.80, 0.90],
    night: 0, daylight: 1, wet: 0, snow: 0, cloud: 0.2, indoor: 0, exposure: 1,
    fogScale: 1, weatherMode: 0, weatherAmt: 0, wind: 0.3
  };

  function mix3(a, b, t) { return [M.lerp(a[0], b[0], t), M.lerp(a[1], b[1], t), M.lerp(a[2], b[2], t)]; }

  S.updateEnv = function (indoor) {
    var st = T10.state, w = st.world;
    var wx = lerpWeather(w.weather, w.weatherTarget, M.clamp(w.weatherT, 0, 1));
    var mins = st.time.minutes;
    var theta = (mins - 360) / 720 * Math.PI;      // 0 at 06:00, PI at 18:00
    var sy = Math.sin(theta), sx = Math.cos(theta);
    var len = Math.hypot(sx, sy, 0.42);
    var e = S.env;
    var isNight = sy <= 0;
    if (isNight) {
      // moon rides the opposite arc, softer and cooler
      e.sunDir = [-sx / len, Math.max(0.12, -sy / len) * 0.9, -0.42 / len];
    } else {
      e.sunDir = [sx / len, sy / len, 0.42 / len];
    }
    var day = M.smoothstep(-0.08, 0.22, sy);
    var golden = M.smoothstep(0.0, 0.20, sy) * (1 - M.smoothstep(0.20, 0.42, sy));
    var dusk = M.smoothstep(-0.22, 0.02, sy) * (1 - M.smoothstep(0.02, 0.20, sy));
    e.daylight = day;
    e.night = 1 - day;

    var noonSun = [1.02, 0.98, 0.92], goldSun = [1.25, 0.72, 0.38], nightSun = [0.10, 0.13, 0.24];
    e.sunColor = mix3(mix3(nightSun, goldSun, M.clamp(golden + dusk, 0, 1)), noonSun, day * (1 - golden * 0.75));
    var cloudDim = 1 - wx.cloud * 0.45;
    e.sunColor = [e.sunColor[0] * cloudDim, e.sunColor[1] * cloudDim, e.sunColor[2] * cloudDim];

    var zenDay = [0.20, 0.42, 0.78], zenNight = [0.020, 0.030, 0.075], zenDusk = [0.30, 0.24, 0.42];
    var horDay = [0.70, 0.80, 0.92], horNight = [0.075, 0.085, 0.14], horDusk = [0.86, 0.48, 0.30];
    e.zenith = mix3(mix3(zenNight, zenDay, day), zenDusk, dusk * 0.8);
    e.horizon = mix3(mix3(horNight, horDay, day), horDusk, dusk * 0.85);
    // the city's own light pollution keeps the night sky from going black
    e.horizon = mix3(e.horizon, [0.16, 0.13, 0.16], e.night * 0.55);
    e.zenith = mix3(e.zenith, [0.05, 0.05, 0.09], e.night * 0.4);
    e.cloud = wx.cloud;
    e.zenith = mix3(e.zenith, mix3([0.35, 0.36, 0.40], [0.10, 0.10, 0.13], e.night), wx.cloud * 0.45);
    e.horizon = mix3(e.horizon, mix3([0.55, 0.56, 0.60], [0.14, 0.14, 0.17], e.night), wx.cloud * 0.5);

    e.fogColor = mix3(e.horizon, [0.55, 0.57, 0.60], wx.cloud * 0.25);
    if (wx.fog > 2) e.fogColor = mix3(e.fogColor, mix3([0.72, 0.74, 0.76], [0.16, 0.17, 0.19], e.night), 0.5);

    e.ambSky = mix3([0.060, 0.070, 0.115], [0.33, 0.38, 0.48], day);
    e.ambGround = mix3([0.032, 0.032, 0.046], [0.21, 0.19, 0.17], day);
    e.ambSky = mix3(e.ambSky, [0.13, 0.11, 0.12], e.night * 0.5);   // streetlight bounce
    e.ambGround = mix3(e.ambGround, [0.10, 0.08, 0.07], e.night * 0.5);

    // daylight sits a little brighter than the raw weather exposure
    e.exposure = wx.exposure * (indoor ? 1.2 : (1.0 + 0.16 * day));
    e.fogScale = wx.fog;
    e.wind = wx.wind;
    e.weatherMode = wx.snow > wx.rain ? 1 : 0;
    e.weatherAmt = Math.max(wx.rain, wx.snow);
    e.indoor = indoor ? 1 : 0;

    // wet streets build up in rain and dry out slowly afterwards
    w.wetness = M.clamp(w.wetness + (wx.rain > 0.05 ? wx.rain * 0.05 : -0.012), 0, 1);
    w.snow = M.clamp(w.snow + (wx.snow > 0.05 ? wx.snow * 0.010 : -0.004), 0, 1);
    e.wet = w.wetness;
    e.snow = w.snow;
    if (indoor) {
      // indoors the ceiling fittings do the lighting, so keep the fill low
      e.ambSky = [0.20, 0.20, 0.23]; e.ambGround = [0.12, 0.115, 0.115];
      e.sunColor = [0.16, 0.155, 0.15];
      e.fogColor = [0.10, 0.10, 0.12];
      e.weatherAmt = 0;
    }
    return e;
  };

  /* Weather + time also change how many people are on the street. */
  S.crowdMultiplier = function () {
    var e = S.env;
    var m = 1;
    if (e.weatherMode === 0 && e.weatherAmt > 0.3) m *= 0.62;
    if (e.weatherMode === 1 && e.weatherAmt > 0.3) m *= 0.72;
    if (e.fogScale > 2.5) m *= 0.85;
    return m;
  };

  /* ----------------------------------------------------------------- audio */
  var AudioSys = S.audio = {
    ctx: null, ready: false, master: null, sfxGain: null, musicGain: null,
    layers: {}, started: false, musicTimer: 0, musicOn: false
  };

  function noiseBuffer(ctx, seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function makeLayer(name, filterType, freq, gain, q) {
    var ctx = AudioSys.ctx;
    var src = ctx.createBufferSource();
    src.buffer = AudioSys.noise;
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; if (q) f.Q.value = q;
    var g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(AudioSys.sfxGain);
    src.start();
    AudioSys.layers[name] = { src: src, filter: f, gain: g, target: gain || 0 };
    return AudioSys.layers[name];
  }

  AudioSys.init = function () {
    if (AudioSys.ready) return true;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    try { AudioSys.ctx = new AC(); } catch (e) { return false; }
    var ctx = AudioSys.ctx;
    AudioSys.master = ctx.createGain(); AudioSys.master.gain.value = 1; AudioSys.master.connect(ctx.destination);
    AudioSys.sfxGain = ctx.createGain(); AudioSys.sfxGain.gain.value = T10.state.settings.sfx; AudioSys.sfxGain.connect(AudioSys.master);
    AudioSys.musicGain = ctx.createGain(); AudioSys.musicGain.gain.value = T10.state.settings.music * 0.5; AudioSys.musicGain.connect(AudioSys.master);
    AudioSys.noise = noiseBuffer(ctx, 3);
    makeLayer('traffic', 'lowpass', 320, 0);
    makeLayer('wind', 'bandpass', 500, 0, 0.7);
    makeLayer('rain', 'highpass', 1200, 0);
    makeLayer('crowd', 'bandpass', 900, 0, 1.2);
    makeLayer('room', 'lowpass', 700, 0);
    AudioSys.ready = true;
    return true;
  };

  AudioSys.resume = function () {
    if (!AudioSys.ready) AudioSys.init();
    if (AudioSys.ctx && AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
  };

  AudioSys.setVolumes = function () {
    if (!AudioSys.ready) return;
    AudioSys.sfxGain.gain.value = T10.state.settings.sfx;
    AudioSys.musicGain.gain.value = T10.state.settings.music * 0.5;
  };

  AudioSys.updateAmbience = function (dt, ctx2) {
    if (!AudioSys.ready) return;
    var L = AudioSys.layers;
    var indoor = ctx2.indoor;
    var traffic = indoor ? 0.02 : 0.055 * ctx2.trafficNear;
    var crowd = indoor ? 0.03 * (ctx2.interiorBusy || 0.4) : 0.03 * ctx2.crowdNear;
    var rain = (S.env.weatherMode === 0 ? S.env.weatherAmt : 0) * (indoor ? 0.03 : 0.10);
    var wind = S.env.wind * (indoor ? 0.006 : 0.03) + (S.env.weatherMode === 1 ? S.env.weatherAmt * 0.02 : 0);
    var room = indoor ? 0.02 : 0;
    var set = function (l, v) { if (l) l.gain.gain.value = M.damp(l.gain.gain.value, v, 2.2, dt); };
    set(L.traffic, traffic); set(L.crowd, crowd); set(L.rain, rain); set(L.wind, wind); set(L.room, room);
    if (L.rain) L.rain.filter.frequency.value = 900 + 900 * S.env.weatherAmt;
  };

  AudioSys.tone = function (freq, dur, type, vol, slideTo) {
    if (!AudioSys.ready) return;
    var ctx = AudioSys.ctx, t = ctx.currentTime;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol === undefined ? 0.12 : vol), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(AudioSys.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  };

  AudioSys.burst = function (dur, freq, vol, type) {
    if (!AudioSys.ready) return;
    var ctx = AudioSys.ctx, t = ctx.currentTime;
    var s = ctx.createBufferSource(); s.buffer = AudioSys.noise;
    var f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = 1.1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol === undefined ? 0.2 : vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(AudioSys.sfxGain);
    s.start(t); s.stop(t + dur + 0.02);
  };

  var SFX = {
    step: function () { AudioSys.burst(0.09, 420 + Math.random() * 200, 0.10); },
    stepWet: function () { AudioSys.burst(0.13, 900 + Math.random() * 500, 0.13); },
    horn: function () { AudioSys.tone(360 + Math.random() * 120, 0.42, 'square', 0.07); },
    horn2: function () { AudioSys.tone(240, 0.7, 'sawtooth', 0.06); },
    siren: function () {
      AudioSys.tone(700, 0.55, 'sine', 0.05, 1250);
      global.setTimeout(function () { AudioSys.tone(1250, 0.55, 'sine', 0.05, 700); }, 520);
    },
    door: function () { AudioSys.burst(0.22, 260, 0.16, 'lowpass'); AudioSys.tone(140, 0.14, 'sine', 0.05); },
    register: function () { AudioSys.tone(1180, 0.09, 'triangle', 0.1); global.setTimeout(function () { AudioSys.tone(1560, 0.16, 'triangle', 0.09); }, 90); },
    confirm: function () { AudioSys.tone(660, 0.09, 'sine', 0.08); global.setTimeout(function () { AudioSys.tone(990, 0.14, 'sine', 0.07); }, 80); },
    deny: function () { AudioSys.tone(200, 0.2, 'square', 0.06, 120); },
    t10: function () {
      AudioSys.tone(880, 0.12, 'sine', 0.07, 1320);
      global.setTimeout(function () { AudioSys.tone(1320, 0.22, 'sine', 0.06, 1760); }, 90);
    },
    save: function () { AudioSys.tone(1320, 0.08, 'sine', 0.045); },
    train: function () { AudioSys.burst(2.2, 180, 0.22, 'lowpass'); AudioSys.tone(70, 2.0, 'sawtooth', 0.05, 110); },
    brakes: function () { AudioSys.burst(0.8, 2600, 0.06, 'bandpass'); },
    thunder: function () { AudioSys.burst(1.8, 120, 0.34, 'lowpass'); },
    whoosh: function () { AudioSys.burst(0.45, 700, 0.12, 'bandpass'); },
    coin: function () { AudioSys.tone(1560, 0.08, 'triangle', 0.08); global.setTimeout(function () { AudioSys.tone(2080, 0.12, 'triangle', 0.06); }, 70); },
    ding: function () { AudioSys.tone(1046, 0.5, 'sine', 0.06); },
    engine: function () { AudioSys.burst(0.3, 160, 0.12, 'lowpass'); }
  };
  S.sfx = function (name) { if (SFX[name]) SFX[name](); };

  /* Subway announcements use real speech when the device offers it. */
  S.announce = function (text) {
    if (global.speechSynthesis && T10.state.settings.sfx > 0.05) {
      try {
        var u = new global.SpeechSynthesisUtterance(text);
        u.rate = 0.95; u.pitch = 0.9; u.volume = Math.min(0.85, T10.state.settings.sfx);
        global.speechSynthesis.speak(u);
        return;
      } catch (e) { /* fall through to the chime */ }
    }
    S.sfx('ding');
  };

  /* Generative background music — a slow, unobtrusive loop. */
  var SCALE = [0, 3, 5, 7, 10, 12, 15];
  AudioSys.musicStep = function () {
    if (!AudioSys.ready || !AudioSys.musicOn) return;
    var ctx = AudioSys.ctx, t = ctx.currentTime;
    var root = 110 * Math.pow(2, (T10.state.world.music === 'jazz' ? 3 : 0) / 12);
    var deg = SCALE[Math.floor(Math.random() * SCALE.length)];
    var f = root * Math.pow(2, deg / 12) * (Math.random() < 0.3 ? 2 : 1);
    var o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = T10.state.world.music === 'lofi' ? 'triangle' : 'sine';
    fl.type = 'lowpass'; fl.frequency.value = 1400;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    o.connect(fl); fl.connect(g); g.connect(AudioSys.musicGain);
    o.start(t); o.stop(t + 2.5);
  };
  S.setMusic = function (style) {
    T10.state.world.music = style;
    AudioSys.musicOn = style && style !== 'off';
    return AudioSys.musicOn;
  };

  /* ----------------------------------------------------------------- needs */
  S.needsTick = function (gameMinutes) {
    var p = T10.state.player;
    var m = gameMinutes;
    p.hunger = M.clamp(p.hunger - m * 0.055, 0, 100);
    p.energy = M.clamp(p.energy - m * 0.035, 0, 100);
    p.hygiene = M.clamp(p.hygiene - m * 0.022, 0, 100);
    var low = (p.hunger < 20 ? 1 : 0) + (p.energy < 20 ? 1 : 0) + (p.hygiene < 20 ? 1 : 0);
    p.mood = M.clamp(p.mood + (low ? -m * 0.03 * low : m * 0.012), 0, 100);
    if (p.hunger < 6 || p.energy < 4) p.health = M.clamp(p.health - m * 0.02, 5, 100);
    else p.health = M.clamp(p.health + m * 0.01, 0, 100);
  };
  S.speedFactor = function () {
    var p = T10.state.player;
    var f = 1;
    if (p.energy < 25) f *= 0.82;
    if (p.energy < 10) f *= 0.75;
    if (p.hunger < 15) f *= 0.9;
    return f * (p.speedMul || 1);
  };

  /* --------------------------------------------------------------- economy */
  S.PRICES = {
    coffee: 4.25, breakfast: 9.5, lunch: 16, dinner: 28, slice: 3.75, snacks: 8.5,
    groceries: 42, shirt: 34, outfit: 95, gymday: 22, movie: 19.5, bowling: 14,
    arcade: 5, subway: 2.90, bus: 2.90, taxiBase: 4.5, taxiPerKm: 2.4, hotel: 180,
    museum: 25, rent: 1850, phoneplan: 45
  };

  S.buy = function (amount, label, quiet) {
    if (T10.pay(amount, label)) {
      if (!quiet) { S.sfx('register'); T10.emit('toast', { text: label + ' — ' + T10.money(amount), kind: 'money' }); }
      return true;
    }
    S.sfx('deny');
    T10.emit('toast', { text: 'Not enough money for ' + label, kind: 'bad' });
    return false;
  };

  /* ------------------------------------------------------------------ jobs */
  S.JOBS = [
    {
      id: 'delivery', title: 'Delivery Rider', pay: 22, cat: ['restaurant', 'pizza', 'coffee'],
      days: [1, 2, 3, 4, 5, 6, 0], hours: [10, 22], shift: 4,
      desc: 'Pick up orders and run them across the neighborhood. Pays per drop.'
    },
    {
      id: 'cashier', title: 'Cashier', pay: 18, cat: ['grocery', 'convenience', 'clothing', 'pharmacy'],
      days: [1, 2, 3, 4, 5, 6], hours: [8, 20], shift: 6,
      desc: 'Register shifts at a corner store. Steady, easy on the legs.'
    },
    {
      id: 'barista', title: 'Restaurant / Cafe Worker', pay: 20, cat: ['coffee', 'restaurant', 'bar', 'pizza'],
      days: [1, 2, 3, 4, 5, 6, 0], hours: [6, 23], shift: 5,
      desc: 'Pull shots, run the pass, keep the line moving.'
    },
    {
      id: 'office', title: 'Office Associate', pay: 32, cat: ['office'],
      days: [1, 2, 3, 4, 5], hours: [9, 18], shift: 8,
      desc: 'Desk work in a midtown tower. Best pay, worst windows.'
    },
    {
      id: 'taxi', title: 'Taxi Driver', pay: 26, cat: ['taxistand'],
      days: [1, 2, 3, 4, 5, 6, 0], hours: [0, 24], shift: 5,
      desc: 'Take the wheel of a yellow cab. Fares all over the city.'
    },
    {
      id: 'photographer', title: 'Photographer', pay: 30, cat: ['landmark', 'park'],
      days: [1, 2, 3, 4, 5, 6, 0], hours: [7, 21], shift: 3,
      desc: 'Shoot the city on assignment. Paid per set of landmarks.'
    },
    {
      id: 'security', title: 'Security Worker', pay: 24, cat: ['museum', 'office', 'stadium', 'hotel'],
      days: [1, 2, 3, 4, 5, 6, 0], hours: [16, 24], shift: 8,
      desc: 'Night watch. Quiet halls, long hours.'
    },
    {
      id: 'trainer', title: 'Fitness Trainer', pay: 34, cat: ['gym'],
      days: [1, 2, 3, 4, 5, 6], hours: [6, 21], shift: 4,
      desc: 'Run sessions on the floor. Keeps you in shape too.'
    },
    {
      id: 'stocker', title: 'Store Employee', pay: 19, cat: ['grocery', 'clothing', 'convenience'],
      days: [1, 2, 3, 4, 5, 6, 0], hours: [6, 22], shift: 6,
      desc: 'Stock shelves and work the floor.'
    },
    {
      id: 'freelance', title: 'Freelancer', pay: 28, cat: ['coffee', 'library', 'home'],
      days: [1, 2, 3, 4, 5, 6, 0], hours: [0, 24], shift: 3,
      desc: 'Laptop work from anywhere with a table. You set the hours.'
    }
  ];

  S.jobById = function (id) {
    for (var i = 0; i < S.JOBS.length; i++) if (S.JOBS[i].id === id) return S.JOBS[i];
    return null;
  };

  S.canWorkHere = function (poi) {
    var job = S.jobById(T10.state.job.id);
    if (!job || !poi) return null;
    if (job.cat.indexOf(poi.cat) < 0) return null;
    var h = T10.state.time.minutes / 60;
    var open = job.hours[0] === 0 && job.hours[1] === 24;
    if (!open && (h < job.hours[0] || h > job.hours[1])) return { job: job, ok: false, why: 'Your shift runs ' + job.hours[0] + ':00–' + job.hours[1] + ':00.' };
    if (job.days.indexOf(T10.dayOfWeek(T10.state.time.day)) < 0) return { job: job, ok: false, why: 'You are not scheduled today.' };
    return { job: job, ok: true };
  };

  S.takeJob = function (jobId) {
    var job = S.jobById(jobId);
    if (!job) return false;
    T10.state.job = { id: job.id, title: job.title, shiftsDone: 0, xp: 0, onShift: false, shiftEnds: 0, paydue: 0 };
    T10.emit('job', job);
    return job;
  };

  S.workShift = function (poi, hours) {
    var chk = S.canWorkHere(poi);
    if (!chk || !chk.ok) return { ok: false, why: chk ? chk.why : 'You do not work here.' };
    var job = chk.job;
    hours = hours || job.shift;
    var p = T10.state.player;
    var rate = job.pay * (1 + Math.min(0.6, T10.state.job.xp * 0.02));
    var gross = Math.round(rate * hours * 100) / 100;
    S.advanceTime(hours * 60);
    T10.earn(gross, job.title + ' shift');
    T10.state.job.shiftsDone++;
    T10.state.job.xp++;
    T10.state.progress.stats.shifts++;
    p.energy = M.clamp(p.energy - hours * 7.5, 0, 100);
    p.hunger = M.clamp(p.hunger - hours * 5, 0, 100);
    p.hygiene = M.clamp(p.hygiene - hours * 4, 0, 100);
    p.mood = M.clamp(p.mood + (job.id === 'photographer' ? 4 : -2), 0, 100);
    return { ok: true, gross: gross, hours: hours, job: job };
  };

  /* ------------------------------------------------------------ activities */
  S.ACTIVITIES = {
    eat: { name: 'Had a meal', mood: 6, hunger: 55, energy: 6, minutes: 45 },
    coffee: { name: 'Coffee break', mood: 4, hunger: 10, energy: 16, minutes: 20 },
    snacks: { name: 'Snacks', mood: 3, hunger: 18, energy: 4, minutes: 10 },
    cook: { name: 'Cooked at home', mood: 5, hunger: 48, energy: 2, minutes: 40 },
    workout: { name: 'Worked out', mood: 8, hunger: -14, energy: -14, hygiene: -18, minutes: 60 },
    movie: { name: 'Watched a movie', mood: 14, energy: -4, minutes: 120 },
    bowl: { name: 'Went bowling', mood: 11, energy: -8, minutes: 60 },
    arcade: { name: 'Played arcade games', mood: 9, energy: -4, minutes: 30 },
    read: { name: 'Read for a while', mood: 7, energy: -2, minutes: 45 },
    exhibit: { name: 'Saw an exhibit', mood: 9, energy: -3, minutes: 40 },
    tv: { name: 'Watched TV', mood: 5, energy: 3, minutes: 60 },
    shower: { name: 'Showered', mood: 5, hygiene: 60, energy: 4, minutes: 20 },
    wash: { name: 'Washed up', mood: 1, hygiene: 18, minutes: 5 },
    toilet: { name: 'Used the bathroom', mood: 2, minutes: 5 },
    sit: { name: 'Sat down for a bit', mood: 3, energy: 5, minutes: 15 },
    basketball: { name: 'Played basketball', mood: 12, energy: -16, hunger: -12, hygiene: -14, minutes: 45 },
    soccer: { name: 'Played soccer', mood: 12, energy: -18, hunger: -14, hygiene: -15, minutes: 45 },
    run: { name: 'Went for a run', mood: 9, energy: -12, hygiene: -12, minutes: 30 },
    photo: { name: 'Took photos', mood: 5, minutes: 5 },
    explore: { name: 'Explored somewhere new', mood: 6, minutes: 0 },
    ride: { name: 'Rode the subway', mood: 1, minutes: 0 },
    class: { name: 'Attended a class', mood: 6, energy: -8, minutes: 90 },
    work_desk: { name: 'Got some work done', mood: -1, energy: -10, minutes: 120 },
    browse_books: { name: 'Browsed the stacks', mood: 4, minutes: 20 }
  };

  S.doActivity = function (id, extra) {
    var a = S.ACTIVITIES[id];
    if (!a) return null;
    var p = T10.state.player;
    if (a.minutes) S.advanceTime(a.minutes);
    if (a.mood) p.mood = M.clamp(p.mood + a.mood, 0, 100);
    if (a.hunger) p.hunger = M.clamp(p.hunger + a.hunger, 0, 100);
    if (a.energy) p.energy = M.clamp(p.energy + a.energy, 0, 100);
    if (a.hygiene) p.hygiene = M.clamp(p.hygiene + a.hygiene, 0, 100);
    var prog = T10.state.progress;
    prog.activities[id] = (prog.activities[id] || 0) + 1;
    if (id === 'eat' || id === 'cook') prog.stats.meals++;
    if (id === 'workout' || id === 'run' || id === 'basketball' || id === 'soccer') prog.stats.workouts++;
    if (id === 'photo') prog.stats.photos++;
    T10.emit('activity', { id: id, def: a, extra: extra });
    return a;
  };

  S.discover = function (poi) {
    if (!poi) return false;
    var d = T10.state.progress.discovered;
    if (d[poi.id]) return false;
    d[poi.id] = { at: T10.state.time.day * 1440 + T10.state.time.minutes, name: poi.name };
    T10.state.player.mood = M.clamp(T10.state.player.mood + 2, 0, 100);
    T10.emit('discovered', poi);
    return true;
  };

  /* ---------------------------------------------------------------- transit */
  S.subwayLinesAt = function (poi) { return poi && poi.lines ? poi.lines : []; };

  S.stationsOnLine = function (lineId) {
    var out = [];
    for (var i = 0; i < P.subwayLines.length; i++) {
      var l = P.subwayLines[i];
      if (l.id !== lineId) continue;
      for (var j = 0; j < l.stations.length; j++) {
        var st = l.stations[j];
        var found = P.nearestAny(st[1], st[2], 60, function (p) { return p.cat === 'subway'; });
        if (found) out.push(found);
      }
    }
    return out;
  };

  /* Travel time between two stations, in game minutes. */
  S.rideTime = function (a, b) {
    var d = M.dist(a.x, a.z, b.x, b.z);
    return Math.max(3, Math.round(d / 240) + 2);
  };

  S.fare = function (kind, dist) {
    if (kind === 'subway') return S.PRICES.subway;
    if (kind === 'bus') return S.PRICES.bus;
    return Math.round((S.PRICES.taxiBase + (dist / 1000) * S.PRICES.taxiPerKm * 3) * 100) / 100;
  };

  /* ------------------------------------------------------------------ tick */
  var thunderTimer = 0;
  S.update = function (dt, realDt) {
    var st = T10.state;
    var mins = dt * (st.time.scale / 60);
    st.time.minutes += mins;
    while (st.time.minutes >= 1440) {
      st.time.minutes -= 1440; st.time.day++;
      st.progress.stats.daysLived++;
      T10.emit('newday', st.time.day);
    }
    st.playtime += realDt;
    S.needsTick(mins);

    var w = st.world;
    if (w.weatherT < 1) w.weatherT = Math.min(1, w.weatherT + realDt / 25);
    else if (w.weather !== w.weatherTarget) { w.weather = w.weatherTarget; w.weatherT = 1; }
    w.weatherTimer -= realDt;
    if (w.weatherTimer <= 0) {
      var chain = WEATHER_CHAIN[w.weather] || ['clear'];
      var next = chain[Math.floor(Math.random() * chain.length)];
      // seasons: it only snows in the winter months of the in-game calendar
      var month = (Math.floor(st.time.day / 30) + 8) % 12;
      var winter = month === 11 || month === 0 || month === 1;
      if ((next === 'snow' || next === 'blizzard') && !winter) next = 'rain';
      S.setWeather(next);
    }

    if (S.env.weatherAmt > 0.8 && (S.WEATHERS[w.weatherTarget] || {}).thunder) {
      thunderTimer -= realDt;
      if (thunderTimer <= 0) {
        thunderTimer = 6 + Math.random() * 16;
        T10.emit('lightning');
        S.sfx('thunder');
      }
    }

    if (AudioSys.musicOn) {
      AudioSys.musicTimer -= realDt;
      if (AudioSys.musicTimer <= 0) { AudioSys.musicTimer = 1.4 + Math.random() * 1.6; AudioSys.musicStep(); }
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
