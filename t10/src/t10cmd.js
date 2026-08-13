/* T10 WORLD — the T10 command system
 * A keyword/intent interpreter built to say yes to a very large space of
 * phrasings, and to fail gracefully (with a useful alternative) when it can't.
 */
(function (global) {
  'use strict';
  var T10 = global.T10;
  var P = T10.Places;
  var S = T10.Systems;
  var M = T10.M;

  var C = T10.Cmd = {};

  function norm(s) {
    return (' ' + (s || '').toLowerCase() + ' ')
      .replace(/[’']/g, "'")
      .replace(/[^a-z0-9'\- ]+/g, ' ')
      .replace(/\bt\s?10\b/g, ' ')          // strip the wake word
      .replace(/\bplease\b|\bcan you\b|\bcould you\b|\bwould you\b|\bi want to\b|\bi wanna\b|\bhey\b/g, ' ')
      .replace(/\s+/g, ' ');
  }
  function has(t) { var a = arguments; for (var i = 0; i < a.length; i++) if (t.indexOf(' ' + a[i] + ' ') >= 0 || t.indexOf(a[i]) >= 0) return true; return false; }
  function anyOf(t, words) { for (var i = 0; i < words.length; i++) if (t.indexOf(words[i]) >= 0) return words[i]; return null; }

  function ok(msg, close) { return { ok: true, message: msg, close: close }; }
  function no(msg) { return { ok: false, message: msg }; }

  function me() { return T10.Player.cityPos(); }

  function compass(dx, dz) {
    var ang = Math.atan2(dx, -dz) * 180 / Math.PI;
    var dirs = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    return dirs[(Math.round(((ang % 360) + 360) % 360 / 45)) % 8];
  }
  function distText(d) {
    if (d < 950) return Math.round(d) + ' m';
    return (d / 1000).toFixed(1) + ' km';
  }
  function poiLine(poi) {
    var m = me();
    var d = M.dist(m.x, m.z, poi.x, poi.z);
    return (poi.icon || '📍') + ' <b>' + poi.name + '</b> — ' + poi.label +
      (poi.district ? ', ' + poi.district : '') + ' · ' + distText(d) + ' ' + compass(poi.x - m.x, poi.z - m.z);
  }

  /* Strip leading verbs so "take me to central park" leaves "central park". */
  function targetPhrase(t) {
    return t
      .replace(/^(.*?)\b(take me to|take me|teleport me to|teleport to|teleport|bring me to|bring me|go to|show me|travel to|head to|drive to|walk to|move me to|put me at|send me to|find me|find|locate|where is|wheres|where s|nearest|closest|the nearest|the closest|directions to|route to|navigate to|how do i get to)\b/, '')
      .replace(/\b(please|now|right now|for me)\b/g, '')
      .trim()
      .replace(/^(a|an|the|some)\s+/, '')     // articles survive the verb strip
      .replace(/\s+/g, ' ')
      .trim();
  }

  function resolvePlace(phrase) {
    if (!phrase) return null;
    if (/\b(home|my apartment|my place|my house|apartment)\b/.test(phrase)) return P.byId['apt_home'];
    var hits = P.search(phrase);
    if (hits.length) return hits[0];
    var cat = P.categoryFromWords(phrase);
    if (cat) {
      var m0 = me();
      var near = P.nearest(cat, m0.x, m0.z);
      if (near) return near.poi;
    }
    return null;
  }

  /* ------------------------------------------------------------- intents */
  var INTENTS = [];
  function intent(name, score, fn) { INTENTS.push({ name: name, score: score, fn: fn }); }

  /* --- weather ---------------------------------------------------------- */
  intent('weather', 10, function (t) {
    var wants = /\b(weather|rain|raining|snow|snowing|storm|thunder|fog|foggy|sunny|sun|clear|cloud|cloudy|overcast|wind|windy|blizzard|drizzle)\b/.test(t);
    if (!wants) return null;
    var map = [
      [/\bheavy rain|pouring|downpour\b/, 'heavyrain'], [/\bstorm|thunder|lightning\b/, 'storm'],
      [/\bblizzard\b/, 'blizzard'], [/\bsnow/, 'snow'], [/\bfog/, 'fog'],
      [/\bdrizzle|rain/, 'rain'], [/\bovercast/, 'overcast'], [/\bcloud/, 'cloudy'],
      [/\bwind/, 'wind'], [/\bsunny|sunshine|sun\b/, 'sunny'], [/\bclear|nice weather|good weather/, 'clear']
    ];
    if (/\b(stop|end|no more|clear up|get rid of|cancel)\b/.test(t) && /\b(rain|snow|storm|fog|weather|clouds?)\b/.test(t)) {
      S.setWeather('clear');
      return ok('Clearing the skies over the city.');
    }
    if (/\b(what|how)('s| is)? the weather|forecast\b/.test(t)) {
      return ok('Right now: <b>' + S.weatherLabel() + '</b>, ' + S.periodLabel().toLowerCase() +
        '. Streets are ' + (T10.state.world.wetness > 0.35 ? 'wet' : 'dry') + '.', false);
    }
    for (var i = 0; i < map.length; i++) {
      if (map[i][0].test(t)) {
        S.setWeather(map[i][1]);
        return ok('Weather changing to <b>' + S.WEATHERS[map[i][1]].label + '</b> over the next few moments.');
      }
    }
    return ok('Current weather: <b>' + S.weatherLabel() + '</b>.', false);
  });

  /* --- time ------------------------------------------------------------- */
  intent('time', 10, function (t) {
    if (/\bwhat time|what's the time|whats the time|time is it|what day|what date\b/.test(t)) {
      return ok('It is <b>' + T10.clockString(T10.state.time.minutes, T10.state.settings.use24h) + '</b> — ' +
        T10.dateString(T10.state.time.day) + '.', false);
    }
    var m = t.match(/\b(?:set (?:the )?time to|make it|change (?:the )?time to|it's|its|jump to|skip to)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|o'clock|oclock)?\b/);
    var named = null;
    if (/\bmidnight\b/.test(t)) named = 0;
    else if (/\bnoon|midday\b/.test(t)) named = 12 * 60;
    else if (/\b(sunrise|dawn|daybreak)\b/.test(t)) named = 6 * 60 + 10;
    else if (/\bsunset|dusk\b/.test(t)) named = 19 * 60;
    else if (/\bmorning\b/.test(t)) named = 8 * 60;
    else if (/\bafternoon\b/.test(t)) named = 14 * 60;
    else if (/\bevening\b/.test(t)) named = 19 * 60 + 30;
    else if (/\blate night\b/.test(t)) named = 2 * 60;
    else if (/\bnight|night time|nighttime\b/.test(t)) named = 21 * 60;
    else if (/\bday time|daytime|make it day\b/.test(t)) named = 12 * 60;

    var skip = t.match(/\b(?:skip|advance|forward|wait|fast forward)\s*(\d{1,2})\s*(hour|hours|hr|hrs|minute|minutes|min|mins)\b/);
    if (skip) {
      var n = parseInt(skip[1], 10);
      var mins = /hour|hr/.test(skip[2]) ? n * 60 : n;
      S.advanceTime(mins);
      return ok('Skipped ahead ' + n + ' ' + skip[2] + '. It is now <b>' + T10.clockString(T10.state.time.minutes, T10.state.settings.use24h) + '</b>.');
    }
    if (named !== null) {
      T10.state.time.minutes = named;
      T10.emit('timejump', 0);
      return ok('Setting the clock to <b>' + T10.clockString(named, T10.state.settings.use24h) + '</b>.');
    }
    if (m && m[1] !== undefined && /time|make it|its|it's|jump|skip|set/.test(t)) {
      var h = parseInt(m[1], 10) % 24, mm = m[2] ? parseInt(m[2], 10) : 0;
      if (m[3] === 'pm' && h < 12) h += 12;
      if (m[3] === 'am' && h === 12) h = 0;
      T10.state.time.minutes = (h * 60 + mm) % 1440;
      T10.emit('timejump', 0);
      return ok('Setting the clock to <b>' + T10.clockString(T10.state.time.minutes, T10.state.settings.use24h) + '</b>.');
    }
    if (/\b(faster time|slower time|time speed|speed up time|slow down time)\b/.test(t)) {
      var st = T10.state.time;
      st.scale = /slow/.test(t) ? Math.max(10, st.scale / 2) : Math.min(240, st.scale * 2);
      return ok('Time now runs at <b>' + st.scale + '×</b>.');
    }
    return null;
  });

  /* --- travel ----------------------------------------------------------- */
  intent('travel', 9, function (t) {
    var isTravel = /\b(take me|teleport|bring me|go to|show me|travel|head to|drive to|walk to|send me|put me at|visit)\b/.test(t);
    if (!isTravel) return null;
    if (/\bhome|my apartment|my place\b/.test(t)) {
      var home = P.byId['apt_home'];
      T10.Game.travelTo(home, 'T10 TRAVEL');
      return ok('Taking you home to <b>' + home.name + '</b>, Greenwich Village.');
    }
    var phrase = targetPhrase(t);
    var poi = resolvePlace(phrase);
    if (!poi) return no('I could not find "<b>' + phrase + '</b>" on the map. Try a landmark, a neighborhood, or something like “the nearest coffee shop”.');
    T10.Game.travelTo(poi, 'T10 TRAVEL');
    return ok('Taking you to <b>' + poi.name + '</b>' + (poi.district ? ', ' + poi.district : '') + '.');
  });

  /* --- find / directions ------------------------------------------------ */
  intent('find', 8, function (t) {
    if (!/\b(find|where is|wheres|where's|nearest|closest|locate|look for|is there a)\b/.test(t)) return null;
    var phrase = targetPhrase(t);
    var cat = P.categoryFromWords(phrase) || P.categoryFromWords(t);
    var results = [];
    if (cat) {
      var mf = me();
      var list = P.within(mf.x, mf.z, 2600, function (p) { return p.cat === cat; });
      list.sort(function (a, b) {
        return M.dist2(mf.x, mf.z, a.x, a.z) - M.dist2(mf.x, mf.z, b.x, b.z);
      });
      results = list.slice(0, 3);
    }
    if (!results.length) {
      var hit = resolvePlace(phrase);
      if (hit) results = [hit];
    }
    if (!results.length) return no('Nothing like "<b>' + phrase + '</b>" nearby. I can look for restaurants, coffee, subway stations, parks, gyms, ATMs, hospitals and more.');
    var msg = results.map(poiLine).join('<br>');
    T10.Game.setWaypoint(results[0]);
    return ok(msg + '<br><span style="color:#93a6bb">Marked on your map.</span>', false);
  });

  intent('directions', 9, function (t) {
    if (!/\b(directions|how do i get to|route to|navigate|guide me|which way)\b/.test(t)) return null;
    var phrase = targetPhrase(t);
    var poi = resolvePlace(phrase);
    if (!poi) return no('I do not have a route to "<b>' + phrase + '</b>". Try naming a landmark or a type of place.');
    var md = me();
    var d = M.dist(md.x, md.z, poi.x, poi.z);
    T10.Game.setWaypoint(poi);
    var sub = P.nearest('subway', md.x, md.z);
    var subLine = sub && d > 700 ? '<br>Fastest: walk ' + distText(sub.dist) + ' to <b>' + sub.poi.name + '</b> and take the train.' : '';
    return ok('<b>' + poi.name + '</b> is ' + distText(d) + ' ' + compass(poi.x - md.x, poi.z - md.z) +
      ' of you.' + subLine + '<br><span style="color:#93a6bb">Waypoint set — it is on your map and compass.</span>', false);
  });

  /* --- spawn vehicles --------------------------------------------------- */
  intent('spawn', 9, function (t) {
    if (!/\b(spawn|summon|give me a|get me a|call|hail|bring me a|order a)\b/.test(t)) return null;
    var kinds = { taxi: 'taxi', cab: 'taxi', car: 'sedan', sedan: 'sedan', suv: 'suv', van: 'van', truck: 'truck',
      bus: 'bus', police: 'police', ambulance: 'ambulance', 'fire truck': 'firetruck', firetruck: 'firetruck',
      motorcycle: 'motorcycle', bike: 'bicycle', bicycle: 'bicycle' };
    var found = null;
    for (var k in kinds) if (t.indexOf(k) >= 0) { found = kinds[k]; break; }
    if (!found) return null;
    if (T10.Interiors.scene) return no('Not while you are indoors — step outside and I will put one at the curb.');
    var v = T10.Game.spawnRide(found);
    if (!v) return no('No room at the curb here. Try again on a wider street.');
    return ok('A <b>' + found + '</b> is waiting at the curb. Walk up to it and get in.');
  });

  /* --- transit ---------------------------------------------------------- */
  intent('transit', 9, function (t) {
    if (!/\b(subway|train|metro|bus|taxi|cab)\b/.test(t)) return null;
    if (/\b(take|ride|catch|get on|board|use)\b/.test(t)) {
      var phrase = targetPhrase(t.replace(/\b(the )?(subway|train|metro|bus|taxi|cab)( to)?\b/g, ' '));
      var dest = resolvePlace(phrase);
      var mode = /bus/.test(t) ? 'bus' : (/taxi|cab/.test(t) ? 'taxi' : 'subway');
      if (dest) {
        var r = T10.Game.transitTo(dest, mode);
        if (r.ok) return ok(r.message);
        return no(r.message);
      }
      var mt = me();
      var stn = P.nearest(mode === 'bus' ? 'busstop' : (mode === 'taxi' ? 'taxistand' : 'subway'), mt.x, mt.z);
      if (!stn) return no('Nothing nearby for that.');
      T10.Game.setWaypoint(stn.poi);
      return ok('Nearest ' + (mode === 'bus' ? 'bus stop' : mode === 'taxi' ? 'taxi stand' : 'station') + ': ' + poiLine(stn.poi) + '<br><span style="color:#93a6bb">Marked on your map.</span>', false);
    }
    var mn = me();
    var near = P.nearest('subway', mn.x, mn.z);
    if (near) { T10.Game.setWaypoint(near.poi); return ok(poiLine(near.poi) + '<br>Lines: ' + (near.poi.lines || []).join(', '), false); }
    return null;
  });

  /* --- outfit / appearance --------------------------------------------- */
  intent('outfit', 8, function (t) {
    if (!/\b(outfit|clothes|clothing|wear|change my|dress|get changed|suit|hoodie|gym clothes|rain jacket)\b/.test(t)) return null;
    var w = T10.state.wardrobe;
    var want = null;
    for (var i = 0; i < w.length; i++) if (t.indexOf(w[i]) >= 0) want = w[i];
    if (/\bsuit|formal|smart\b/.test(t)) want = 'suit';
    if (/\bgym|workout|athletic\b/.test(t)) want = 'gym';
    if (/\brain|waterproof|jacket\b/.test(t)) want = 'rain';
    if (/\bhoodie|casual hoodie\b/.test(t)) want = 'hoodie';
    if (!want) {
      var idx = w.indexOf(T10.state.player.outfit);
      want = w[(idx + 1) % w.length];
    }
    T10.Player.setOutfit(want);
    return ok('Changed into your <b>' + want + '</b> outfit.');
  });

  /* --- camera ----------------------------------------------------------- */
  intent('camera', 8, function (t) {
    if (!/\b(camera|first person|third person|1st person|3rd person|view|zoom)\b/.test(t)) return null;
    if (/first|1st/.test(t)) { T10.state.player.camera = 'first'; return ok('Switched to <b>first person</b>.'); }
    if (/third|3rd/.test(t)) { T10.state.player.camera = 'third'; return ok('Switched to <b>third person</b>.'); }
    if (/zoom in/.test(t)) { T10.Player.camDist = Math.max(1.8, T10.Player.camDist - 1.5); return ok('Camera pulled in.'); }
    if (/zoom out/.test(t)) { T10.Player.camDist = Math.min(11, T10.Player.camDist + 1.5); return ok('Camera pulled back.'); }
    return ok('Switched to <b>' + (T10.Player.toggleCamera() === 'first' ? 'first' : 'third') + ' person</b>.');
  });

  /* --- traffic & crowds ------------------------------------------------- */
  intent('density', 8, function (t) {
    if (!/\b(traffic|cars|crowd|people|pedestrians|npcs|busy|empty)\b/.test(t)) return null;
    var w = T10.state.world;
    var up = /\bmore|heavy|heavier|increase|rush hour|busier|busy|max\b/.test(t);
    var down = /\bless|fewer|light|lighter|decrease|reduce|quiet|empty|no more|none|clear\b/.test(t);
    var isTraffic = /\btraffic|cars|vehicles\b/.test(t);
    var isPeople = /\bpeople|crowd|pedestrians|npcs\b/.test(t);
    if (!up && !down) {
      return ok('Traffic density is <b>' + w.trafficDensity.toFixed(1) + '×</b>, pedestrians <b>' + w.npcDensity.toFixed(1) + '×</b>. Ask for more or less.', false);
    }
    var f = up ? 1.6 : 0.5;
    if (isTraffic || !isPeople) w.trafficDensity = M.clamp(w.trafficDensity * f, 0, 3);
    if (isPeople || !isTraffic) w.npcDensity = M.clamp(w.npcDensity * f, 0, 3);
    if (down && /\bno |none|empty|zero\b/.test(t)) { if (isTraffic || !isPeople) w.trafficDensity = 0; if (isPeople || !isTraffic) w.npcDensity = 0; }
    return ok('Set traffic to <b>' + w.trafficDensity.toFixed(1) + '×</b> and pedestrians to <b>' + w.npcDensity.toFixed(1) + '×</b>.');
  });

  /* --- music ------------------------------------------------------------ */
  intent('music', 8, function (t) {
    if (!/\b(music|song|radio|playlist|tunes)\b/.test(t)) return null;
    if (/\b(stop|off|no|kill|mute|quiet)\b/.test(t)) { S.setMusic('off'); return ok('Music off. Just the city now.'); }
    var style = /jazz/.test(t) ? 'jazz' : (/lofi|lo-fi|chill/.test(t) ? 'lofi' : (/ambient|calm/.test(t) ? 'ambient' : null));
    if (!style) {
      var order = ['lofi', 'jazz', 'ambient', 'off'];
      style = order[(order.indexOf(T10.state.world.music) + 1) % order.length];
    }
    S.setMusic(style);
    S.audio.resume();
    return ok(style === 'off' ? 'Music off.' : 'Playing <b>' + style + '</b> in your headphones.');
  });

  /* --- schedule & self --------------------------------------------------- */
  intent('schedule', 8, function (t) {
    if (!/\b(schedule|today|agenda|plans|what should i do|what can i do|bored|suggest)\b/.test(t)) return null;
    return ok(T10.Game.scheduleText(), false);
  });

  intent('status', 8, function (t) {
    if (!/\b(how am i|my stats|statistics|status|how much money|my money|how far|steps|where am i|who am i|my job)\b/.test(t)) return null;
    var p = T10.state.player, st = T10.state;
    if (/\bwhere am i\b/.test(t)) {
      var d = P.districtAt(T10.Player.x, T10.Player.z);
      var mw = me();
      var near = P.nearestAny(mw.x, mw.z, 220, function () { return true; });
      return ok('You are in <b>' + (T10.Interiors.scene ? T10.Interiors.scene.title : (d ? d.name : 'New York Harbor')) + '</b>' +
        (near ? ', near ' + near.name : '') + '.', false);
    }
    if (/\bmoney\b/.test(t)) return ok('You have <b>' + T10.money(p.money) + '</b>. Earned ' + T10.money(st.progress.stats.earned) + ' so far.', false);
    if (/\bjob\b/.test(t)) return ok(st.job.title ? 'You work as a <b>' + st.job.title + '</b> — ' + st.job.shiftsDone + ' shifts done.' : 'You do not have a job yet. Open <b>You → Jobs</b> to pick one.', false);
    return ok('Energy ' + Math.round(p.energy) + '% · Hunger ' + Math.round(p.hunger) + '% · Hygiene ' + Math.round(p.hygiene) +
      '% · Mood ' + Math.round(p.mood) + '%<br>' + T10.money(p.money) + ' · ' + (st.progress.stats.distance / 1000).toFixed(2) +
      ' km walked · ' + Object.keys(st.progress.discovered).length + ' places discovered.', false);
  });

  /* --- job -------------------------------------------------------------- */
  intent('job', 8, function (t) {
    if (!/\b(job|work|hired|employment|shift|career|quit)\b/.test(t)) return null;
    if (/\bquit|resign\b/.test(t)) {
      T10.state.job = { id: null, title: null, shiftsDone: 0, xp: 0, onShift: false, shiftEnds: 0, paydue: 0 };
      return ok('You quit. No shifts on the calendar.');
    }
    var named = null;
    for (var i = 0; i < S.JOBS.length; i++) {
      var j = S.JOBS[i];
      if (t.indexOf(j.title.toLowerCase()) >= 0 || t.indexOf(j.id) >= 0) named = j;
    }
    if (/\bdelivery\b/.test(t)) named = S.jobById('delivery');
    if (/\btaxi driver|drive a cab\b/.test(t)) named = S.jobById('taxi');
    if (named) {
      S.takeJob(named.id);
      var mj = me();
      var spot = P.nearest(named.cat[0], mj.x, mj.z);
      if (spot) T10.Game.setWaypoint(spot.poi);
      return ok('You are now a <b>' + named.title + '</b> — ' + T10.money(named.pay) + '/hr.' +
        (spot ? '<br>Nearest place to work a shift: <b>' + spot.poi.name + '</b>, ' + distText(spot.dist) + ' away (marked).' : ''));
    }
    var list = S.JOBS.slice(0, 6).map(function (j2) { return '· <b>' + j2.title + '</b> — ' + T10.money(j2.pay) + '/hr'; }).join('<br>');
    return ok('Jobs you can take right now:<br>' + list + '<br><span style="color:#93a6bb">Say “T10, I want the delivery job”.</span>', false);
  });

  /* --- sleep / rest ------------------------------------------------------ */
  intent('sleep', 9, function (t) {
    if (!/\b(sleep|nap|go to bed|rest|wake me)\b/.test(t)) return null;
    var r = T10.Game.trySleep(t);
    return r.ok ? ok(r.message) : no(r.message);
  });

  /* --- activities -------------------------------------------------------- */
  intent('activity', 7, function (t) {
    var map = [
      [/\btake a photo|photo|picture|photograph|selfie\b/, 'photo'],
      [/\bgo for a run|jog|running\b/, 'run'],
      [/\bplay basketball|shoot hoops|hoops\b/, 'basketball'],
      [/\bplay soccer|kick a ball\b/, 'soccer']
    ];
    for (var i = 0; i < map.length; i++) {
      if (map[i][0].test(t)) {
        var r = T10.Game.doQuickActivity(map[i][1]);
        return r.ok ? ok(r.message) : no(r.message);
      }
    }
    return null;
  });

  /* --- movement helpers -------------------------------------------------- */
  intent('speed', 7, function (t) {
    if (!/\b(faster|slower|speed|run faster|normal speed|walk normally)\b/.test(t)) return null;
    var p = T10.state.player;
    if (/\bnormal|reset|default\b/.test(t)) { p.speedMul = 1; return ok('Back to a normal pace.'); }
    if (/\bslow/.test(t)) { p.speedMul = M.clamp(p.speedMul * 0.7, 0.4, 3); return ok('Slowed you down to ' + p.speedMul.toFixed(1) + '×.'); }
    p.speedMul = M.clamp(p.speedMul * 1.4, 0.4, 3);
    return ok('You move at <b>' + p.speedMul.toFixed(1) + '×</b> now.');
  });

  /* --- interface --------------------------------------------------------- */
  intent('ui', 7, function (t) {
    if (/\b(open|show|bring up)\b.*\bmap\b/.test(t) || /^\s*map\s*$/.test(t)) { T10.UI.openScreen('mapScreen'); return ok('Map open.'); }
    if (/\b(open|show)\b.*\b(inventory|bag|pockets|items)\b/.test(t)) { T10.UI.openScreen('invScreen'); return ok('Here is what you are carrying.'); }
    if (/\b(open|show)\b.*\b(settings|options)\b/.test(t)) { T10.UI.openScreen('menuScreen'); T10.UI.menuTab('settings'); T10.UI.renderMenu(); return ok('Settings open.'); }
    if (/\bsave\b/.test(t) && /\bgame|progress|now\b/.test(t)) { T10.saveState('command'); return ok('Progress saved.'); }
    if (/\b(better graphics|max graphics|high quality|ultra)\b/.test(t)) { T10.state.settings.quality = 'high'; T10.Renderer.setQuality('high'); return ok('Graphics raised to <b>high</b>.'); }
    if (/\b(performance|faster fps|low quality|potato|lag)\b/.test(t)) { T10.state.settings.quality = 'low'; T10.Renderer.setQuality('low'); return ok('Dropped to <b>low</b> quality for performance.'); }
    return null;
  });

  /* --- money ------------------------------------------------------------- */
  intent('money', 7, function (t) {
    if (!/\b(money|cash|rich|broke|dollars|pay me|give me)\b/.test(t)) return null;
    if (/\bgive me|make me rich|need money|free money|cheat\b/.test(t)) {
      var ma = me();
      var atm = P.nearest('bank', ma.x, ma.z);
      if (atm) T10.Game.setWaypoint(atm.poi);
      return no('I cannot make money appear — that part is on you. ' +
        (atm ? 'Nearest ATM: <b>' + atm.poi.name + '</b>, ' + distText(atm.dist) + ' away (marked on your map). ' : '') +
        'Or open <b>You → Jobs</b> and take a shift.');
    }
    return ok('You have <b>' + T10.money(T10.state.player.money) + '</b>.', false);
  });

  /* --- nearby ------------------------------------------------------------ */
  intent('around', 6, function (t) {
    if (!/\b(what's around|whats around|what is around|nearby|around me|what's here|whats here|explore)\b/.test(t)) return null;
    var mr = me();
    var list = P.within(mr.x, mr.z, 260, function (p) { return p.cat !== 'busstop'; });
    list.sort(function (a, b) {
      return M.dist2(mr.x, mr.z, a.x, a.z) - M.dist2(mr.x, mr.z, b.x, b.z);
    });
    if (!list.length) return ok('Nothing marked within a couple of blocks. Keep walking — the city fills in fast.', false);
    return ok(list.slice(0, 6).map(poiLine).join('<br>'), false);
  });

  /* --- help -------------------------------------------------------------- */
  intent('help', 5, function (t) {
    if (!/\b(help|what can you do|commands|how do you work|who are you|what are you)\b/.test(t)) return null;
    return ok('I take plain language. Try:<br>' +
      '· “make it rain” / “clear the sky” / “make it night”<br>' +
      '· “take me to Central Park” / “take me home”<br>' +
      '· “find the nearest coffee shop” / “directions to Times Square”<br>' +
      '· “spawn a taxi” / “take the subway to Brooklyn Bridge”<br>' +
      '· “change my outfit” / “first person” / “more traffic”<br>' +
      '· “what’s my schedule” / “how am I doing” / “play some music”', false);
  });

  /* --------------------------------------------------------------- runner */
  C.run = function (raw) {
    var t = norm(raw);
    if (!t.trim()) return no('Say a command after T10 — for example, “T10, make it rain”.');
    var best = null;
    for (var i = 0; i < INTENTS.length; i++) {
      var it = INTENTS[i];
      var res;
      try { res = it.fn(t); } catch (e) { console.warn('[T10] intent error', it.name, e); res = null; }
      if (res && (!best || it.score > best.score)) best = { score: it.score, res: res, name: it.name };
    }
    if (best) {
      T10.emit('t10_command', { text: raw, intent: best.name, ok: best.res.ok });
      return best.res;
    }
    // last resort: treat the whole thing as a place
    var poi = resolvePlace(targetPhrase(t));
    if (poi) {
      var ml = me();
      T10.Game.setWaypoint(poi);
      return ok('I found <b>' + poi.name + '</b>' + (poi.district ? ', ' + poi.district : '') + ' — ' +
        distText(M.dist(ml.x, ml.z, poi.x, poi.z)) + ' ' + compass(poi.x - ml.x, poi.z - ml.z) +
        ' of you. Marked on your map.<br><span style="color:#93a6bb">Say “take me there” to go now.</span>', false);
    }
    return no('I can’t do that yet, but I can help you find another option — try “find the nearest restaurant”, ' +
      '“make it rain”, “take me to Brooklyn Bridge”, or “what’s my schedule”.');
  };

  /* Contextual chips shown under the input. */
  C.suggestions = function () {
    var out = [];
    var indoor = !!T10.Interiors.scene;
    var h = T10.state.time.minutes / 60;
    if (indoor) out.push('take me outside');
    else out.push('find the nearest coffee shop');
    if (h > 21 || h < 5) out.push('make it morning'); else out.push('make it night');
    out.push('make it rain');
    if (!indoor) out.push('spawn a taxi');
    out.push('take me to Times Square');
    out.push('what’s my schedule');
    if (T10.state.player.money < 60) out.push('find me a job');
    else out.push('take me home');
    out.push('more traffic');
    return out.slice(0, 7);
  };

})(typeof window !== 'undefined' ? window : globalThis);
