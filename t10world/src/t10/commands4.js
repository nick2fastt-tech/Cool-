// T10 World - command registry, part four. The map, finding your way around,
// saved places, snow, and the questions people actually ask out loud.
import { describeAppearance } from '../human/appearance.js';
import { settings } from '../core/settings.js';
import { clampv, plural, metersToFeetInches } from '../core/math.js';

/**
 * Places you can ask for by type. `types` matches landmark records, `kinds`
 * matches ordinary building lots, so "the nearest shop" finds a real corner
 * store and not just the one named landmark.
 */
const PLACE_KINDS = [
  { id: 'gas', label: 'gas station', names: ['gas station', 'petrol station', 'fuel stop', 'gas'], types: ['gas'] },
  { id: 'hospital', label: 'hospital', names: ['hospital', 'emergency room', 'er'], types: ['hospital'] },
  { id: 'police', label: 'police station', names: ['police station', 'police', 'cop shop'], types: ['police'] },
  { id: 'fire', label: 'fire station', names: ['fire station', 'fire house', 'firehouse'], types: ['fire'] },
  { id: 'school', label: 'school', names: ['school', 'high school', 'elementary school'], types: ['school'] },
  { id: 'park', label: 'park', names: ['park', 'green', 'grass'], types: ['park'] },
  { id: 'mall', label: 'mall', names: ['mall', 'shopping centre', 'shopping center'], types: ['mall'] },
  { id: 'bar', label: 'bar', names: ['bar', 'pub'], types: ['bar'] },
  { id: 'gym', label: 'gym', names: ['gym', 'fitness place'], types: ['gym'] },
  { id: 'cafe', label: 'cafe', names: ['cafe', 'coffee shop', 'coffee'], types: ['cafe'] },
  { id: 'diner', label: 'diner', names: ['diner', 'restaurant', 'somewhere to eat', 'place to eat'], types: ['diner'], kinds: ['restaurant'] },
  { id: 'store', label: 'store', names: ['store', 'shop', 'corner store', 'convenience store'], types: ['store'], kinds: ['shop'] },
  { id: 'church', label: 'church', names: ['church', 'chapel'], types: ['church'] },
  { id: 'library', label: 'library', names: ['library'], types: ['civic'] },
  { id: 'station', label: 'train station', names: ['train station', 'station', 'railway station'], types: ['station'] },
  { id: 'stadium', label: 'stadium', names: ['stadium', 'arena'], types: ['stadium'] },
  { id: 'arcade', label: 'arcade', names: ['arcade', 'games place'], types: ['arcade'] },
  { id: 'hotel', label: 'hotel', names: ['hotel', 'motel'], kinds: ['hotel'] },
  { id: 'warehouse', label: 'warehouse', names: ['warehouse', 'industrial unit'], kinds: ['warehouse'] },
  { id: 'house', label: 'house', names: ['house', 'home to break into'], kinds: ['house'] },
];

/** Compass bearing from the player to a point, in words. */
function bearingTo(px, pz, x, z) {
  const dx = x - px, dz = z - pz;
  // North is -Z in this world, matching the map's north indicator.
  const deg = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return names[Math.round(deg / 45) % 8];
}

function walkTime(metres) {
  const mins = metres / (2.45 * 60);
  if (mins < 1) return 'under a minute on foot';
  if (mins < 60) return Math.round(mins) + ' ' + plural('minute', Math.round(mins)) + ' on foot';
  return 'a long walk — take a car';
}

/** Nearest matching place, as { x, z, name, distance }. */
function nearestPlace(ctx, spec) {
  const p = ctx.player.position;
  let best = null, bestD = Infinity;
  if (spec.types) {
    for (const lm of ctx.world.city.landmarks) {
      if (!spec.types.includes(lm.type)) continue;
      const d = Math.hypot(lm.x - p.x, lm.z - p.z);
      if (d < bestD) { bestD = d; best = { x: lm.x, z: lm.z, name: lm.name }; }
    }
  }
  if (spec.kinds) {
    for (const lot of ctx.world.city.lots) {
      if (!spec.kinds.includes(lot.kind)) continue;
      const d = Math.hypot(lot.x - p.x, lot.z - p.z);
      if (d < bestD) { bestD = d; best = { x: lot.x, z: lot.z, name: null }; }
    }
  }
  if (!best) return null;
  best.distance = bestD;
  return best;
}

export function extendRegistry4(R, add) {
  // ===== 30. The map =======================================================
  add('map_show', 'Map', ['show me the map', 'open the map', 'show the map', 'where am i on the map', 'map'],
    'Open the city map.',
    (ctx) => {
      if (!ctx.game.map) return 'No map available.';
      ctx.game.map.show();
      return 'Map\'s up. ' + ctx.world.city.describeLocation(ctx.player.position.x, ctx.player.position.z) + '.';
    });
  add('map_hide', 'Map', ['close the map', 'hide the map', 'put the map away'],
    'Close the map.',
    (ctx) => { if (ctx.game.map) ctx.game.map.hide(); return 'Map closed.'; });
  add('map_zoom_in', 'Map', ['zoom in on the map', 'zoom the map in', 'closer on the map'],
    'Zoom the map in.',
    (ctx) => {
      if (!ctx.game.map) return 'No map available.';
      if (!ctx.game.map.visible) ctx.game.map.show();
      const z = ctx.game.map.setZoom(ctx.game.map.zoom * 1.6);
      return 'Zoomed to ' + z.toFixed(1) + 'x.';
    });
  add('map_zoom_out', 'Map', ['zoom out on the map', 'zoom the map out', 'wider on the map'],
    'Zoom the map out.',
    (ctx) => {
      if (!ctx.game.map) return 'No map available.';
      if (!ctx.game.map.visible) ctx.game.map.show();
      const z = ctx.game.map.setZoom(ctx.game.map.zoom / 1.6);
      return 'Zoomed to ' + z.toFixed(1) + 'x.';
    });
  add('map_whole_city', 'Map', ['show me the whole city', 'zoom all the way out', 'show me everything on the map'],
    'Fit the whole city on the map.',
    (ctx) => {
      if (!ctx.game.map) return 'No map available.';
      ctx.game.map.show();
      ctx.game.map.setZoom(0.35);
      return 'The whole city, top down.';
    });

  // ===== 31. Finding places ================================================
  for (const spec of PLACE_KINDS) {
    const primary = spec.names[0];
    add('where_' + spec.id, 'Map',
      spec.names.flatMap((n) => [
        'where is the nearest ' + n, 'wheres the nearest ' + n, 'where is the closest ' + n,
        'find me a ' + n, 'find the nearest ' + n, 'is there a ' + n + ' near me',
      ]),
      'Find the nearest ' + spec.label + '.',
      (ctx) => {
        const hit = nearestPlace(ctx, spec);
        if (!hit) return 'There isn\'t a ' + spec.label + ' anywhere in this city.';
        const p = ctx.player.position;
        return (hit.name ? hit.name + ' is ' : 'The nearest ' + spec.label + ' is ') +
          Math.round(hit.distance) + 'm ' + bearingTo(p.x, p.z, hit.x, hit.z) +
          ' of you — ' + walkTime(hit.distance) + '.';
      });
    add('goto_near_' + spec.id, 'Map',
      spec.names.flatMap((n) => [
        'take me to the nearest ' + n, 'take me to the closest ' + n, 'go to the nearest ' + n,
        'put me at the nearest ' + n, 'i need a ' + n,
      ]),
      'Travel to the nearest ' + spec.label + '.',
      (ctx) => {
        const hit = nearestPlace(ctx, spec);
        if (!hit) return 'There isn\'t a ' + spec.label + ' anywhere in this city.';
        const spot = ctx.world.city.nearestSidewalk(hit.x, hit.z + 20);
        ctx.player.teleport(spot.x, spot.z);
        ctx.pop();
        return hit.name ? 'You\'re outside ' + hit.name + '.' : 'Nearest ' + spec.label + '. Right here.';
      });
  }

  add('where_tallest', 'Map', ['what is the tallest building', 'whats the tallest building', 'which building is tallest'],
    'Find the city\'s tallest building.',
    (ctx) => {
      let best = null;
      for (const lot of ctx.world.city.lots) if (!best || lot.height > best.height) best = lot;
      if (!best) return 'Nothing built yet.';
      const p = ctx.player.position;
      const named = ctx.world.city.landmarks.find((l) => l.lot === best);
      return (named ? named.name : 'An unnamed tower') + ' — ' + Math.round(best.height) + 'm, ' +
        Math.round(Math.hypot(best.x - p.x, best.z - p.z)) + 'm ' + bearingTo(p.x, p.z, best.x, best.z) + ' of you.';
    });
  add('goto_tallest', 'Map', ['take me to the tallest building', 'go to the tallest building', 'put me on the tallest building'],
    'Travel to the top of the tallest building.',
    (ctx) => {
      let best = null;
      for (const lot of ctx.world.city.lots) if (!best || lot.height > best.height) best = lot;
      if (!best) return 'Nothing built yet.';
      ctx.player.teleport(best.x, best.z, ctx.world.groundAt(best.x, best.z) + best.height + 0.35);
      ctx.player.verticalVel = 0;
      ctx.pop();
      return Math.round(best.height) + 'm up. Don\'t lean.';
    });
  add('where_am_i_exactly', 'Map', ['where exactly am i', 'what are my coordinates', 'give me my position'],
    'Read out your exact position.',
    (ctx) => {
      const p = ctx.player.position;
      return ctx.world.city.describeLocation(p.x, p.z) + ' — ' +
        Math.round(p.x) + ', ' + Math.round(p.z) + ', ' + Math.round(p.y) + 'm up.';
    });
  add('how_far_landmark', 'Map',
    ['how far is', 'how far away is', 'how far to', 'distance to'],
    'Ask how far away a place is.',
    (ctx, m) => {
      const q = (m.rest || '').replace(/^the\s+/, '').trim();
      if (!q) return 'How far is what? Name a place.';
      const lm = ctx.world.city.findLandmark(q);
      if (!lm) return 'I don\'t know a place called "' + q + '".';
      const p = ctx.player.position;
      const d = Math.hypot(lm.x - p.x, lm.z - p.z);
      return lm.name + ' is ' + Math.round(d) + 'm ' + bearingTo(p.x, p.z, lm.x, lm.z) +
        ' of you — ' + walkTime(d) + '.';
    }, { capturesRest: true });

  // ===== 32. Saved places ==================================================
  add('place_remember', 'Map',
    ['remember this place as', 'remember this as', 'call this place', 'name this place', 'save this place as'],
    'Save where you are under a name you choose.',
    (ctx, m) => {
      const name = (m.rest || '').trim().slice(0, 24);
      if (!name) return 'Give it a name — "T10 remember this place as the good bench".';
      const p = ctx.player.position;
      const existing = ctx.markers.find((mk) => mk.name.toLowerCase() === name.toLowerCase());
      if (existing) { existing.x = p.x; existing.z = p.z; return 'Moved "' + existing.name + '" to here.'; }
      ctx.markers.push({ x: p.x, z: p.z, name });
      return 'Saved. "' + name + '" is ' + ctx.world.city.describeLocation(p.x, p.z) + '.';
    }, { capturesRest: true });
  add('place_goto_named', 'Map',
    ['take me to my place called', 'go to my place called', 'take me back to'],
    'Travel to one of your saved places by name.',
    (ctx, m) => {
      const q = (m.rest || '').trim().toLowerCase();
      if (!q) return 'Which one? Say "T10 list my places".';
      const mk = ctx.markers.find((k) => k.name.toLowerCase() === q) ||
        ctx.markers.find((k) => k.name.toLowerCase().includes(q));
      if (!mk) return 'I don\'t have a place called "' + q + '".';
      ctx.player.teleport(mk.x, mk.z);
      ctx.pop();
      return 'Back at ' + mk.name + '.';
    }, { capturesRest: true });
  add('place_list', 'Map', ['list my places', 'what places have i saved', 'what have i named'],
    'List every place you\'ve saved.',
    (ctx) => {
      if (!ctx.markers.length) return 'You haven\'t saved any places. Say "T10 remember this place as ..." somewhere you like.';
      const p = ctx.player.position;
      return ctx.markers.map((mk) =>
        mk.name + ' (' + Math.round(Math.hypot(mk.x - p.x, mk.z - p.z)) + 'm ' + bearingTo(p.x, p.z, mk.x, mk.z) + ')'
      ).join('; ') + '.';
    });
  add('place_forget', 'Map', ['forget the place called', 'delete my place called', 'forget about'],
    'Delete one saved place by name.',
    (ctx, m) => {
      const q = (m.rest || '').trim().toLowerCase();
      if (!q) return 'Which one?';
      const i = ctx.markers.findIndex((k) => k.name.toLowerCase().includes(q));
      if (i < 0) return 'Nothing saved under "' + q + '".';
      const gone = ctx.markers.splice(i, 1)[0];
      return 'Forgot "' + gone.name + '".';
    }, { capturesRest: true });
  add('place_set_home', 'Map', ['this is my home', 'set this as my home', 'make this my home', 'remember where i live'],
    'Mark where you\'re standing as home.',
    (ctx) => {
      const p = ctx.player.position;
      const existing = ctx.markers.find((mk) => mk.name === 'Home');
      if (existing) { existing.x = p.x; existing.z = p.z; }
      else ctx.markers.push({ x: p.x, z: p.z, name: 'Home' });
      return 'Home is ' + ctx.world.city.describeLocation(p.x, p.z) + '. Say "T10 take me home" any time.';
    });
  add('place_go_home', 'Map', ['take me home', 'go home', 'bring me home', 'i want to go home'],
    'Go back to the place you called home.',
    (ctx) => {
      const mk = ctx.markers.find((k) => k.name === 'Home');
      if (!mk) return 'You haven\'t set a home yet. Stand somewhere you like and say "T10 this is my home".';
      ctx.player.teleport(mk.x, mk.z);
      ctx.pop();
      return 'Home.';
    });

  // ===== 33. Snow ==========================================================
  // "make it snow" and "make it a blizzard" come free from the weather preset
  // generator; these are the ones it doesn't cover.
  add('weather_snow_stop', 'Weather', ['stop the snow', 'melt the snow', 'no more snow', 'clear the snow'],
    'Stop the snow and clear the ground.',
    (ctx) => { ctx.atmosphere.setWeather('fair'); return 'Snow\'s off. Give it a moment to melt.'; });
  add('weather_snow_now', 'Weather', ['make it snow right now', 'snow immediately', 'snow instantly'],
    'Snow, with no transition.',
    (ctx) => { ctx.atmosphere.setWeather('snow', true); return 'Snow. Instantly.'; });
  add('weather_snow_deep', 'Weather', ['bury the city in snow', 'i want deep snow', 'cover everything in snow'],
    'Lay snow thick over the whole city.',
    (ctx) => {
      ctx.atmosphere.setWeather('blizzard', true);
      ctx.world.setSnow(1);
      return 'Everything\'s white.';
    });

  // ===== 34. This world ====================================================
  add('world_name', 'Questions', ['what is this world called', 'whats this world called', 'what is this place called', 'what did i name this world'],
    'Ask what your world is called.',
    (ctx) => {
      const name = ctx.game.worldName || 'this place';
      return 'You called it ' + name + '. Seed ' + (ctx.game.worldSeed >>> 0) +
        ' — anyone who types that name gets this exact city.';
    });
  add('world_rename', 'Questions', ['rename this world to', 'call this world', 'rename the world to'],
    'Rename your world.',
    (ctx, m) => {
      const name = (m.rest || '').trim().slice(0, 28);
      if (!name) return 'Name it something.';
      const old = ctx.game.worldName;
      ctx.game.worldName = name;
      return 'It was ' + old + '. Now it\'s ' + name + '. The streets stay as they are — the seed is locked once a world exists.';
    }, { capturesRest: true });
  add('my_name', 'Questions', ['what is my name', 'whats my name', 'who am i', 'what do you call me'],
    'Ask T10 who you are.',
    (ctx) => {
      const a = ctx.player.appearance;
      return a.name && a.name !== 'You'
        ? 'You\'re ' + a.name + '. ' + describeAppearance(a)
        : 'You never told me. ' + describeAppearance(a);
    });
  add('my_height_check', 'Questions', ['how tall am i', 'what is my height', 'whats my height'],
    'Ask how tall you are.',
    (ctx) => {
      const h = ctx.player.appearance.body.height;
      return metersToFeetInches(h) + ' — ' + h.toFixed(2) + 'm.';
    });

  // ===== 35. Copying looks =================================================
  const COPY_FIELDS = ['gender', 'toneIndex', 'skinToneName', 'eyeColor', 'eyeColorName',
    'hairStyle', 'hairColor', 'hairColorName', 'hairRecede', 'browColor', 'browShape',
    'browThickness', 'lipColor', 'lipFullness', 'stubble', 'beard', 'freckles', 'makeup',
    'outfitIndex', 'outfitId', 'outfitName', 'shoes', 'age', 'ageYears'];

  function copyLook(from, to) {
    for (const f of COPY_FIELDS) if (from[f] !== undefined) to[f] = from[f];
    to.body = Object.assign({}, from.body);
    to.face = Object.assign({}, from.face);
    to.buildName = from.buildName;
  }

  add('copy_look', 'Identity',
    ['make me look like them', 'copy their look', 'i want to look like that person', 'give me their look', 'copy that persons look'],
    'Copy the nearest person\'s entire look onto you.',
    (ctx) => {
      const npc = ctx.npcs.nearestNPC(ctx.player.position, 30);
      if (!npc) return 'Nobody close enough to copy.';
      const name = ctx.player.appearance.name;
      copyLook(npc.appearance, ctx.player.appearance);
      ctx.player.appearance.name = name;
      ctx.player.rebuildAppearance();
      return 'You look like ' + npc.appearance.firstName + ' now. Same build, same face, same clothes.';
    });
  add('copy_look_to_them', 'Crowd',
    ['make them look like me', 'give them my look', 'make that person look like me'],
    'Make the nearest person look like you.',
    (ctx) => {
      const npc = ctx.npcs.nearestNPC(ctx.player.position, 30);
      if (!npc) return 'Nobody close enough.';
      const name = npc.appearance.name, first = npc.appearance.firstName;
      copyLook(ctx.player.appearance, npc.appearance);
      npc.appearance.name = name;
      npc.appearance.firstName = first;
      npc.human.rebuildBody();
      return first + ' is your double now.';
    });
  add('copy_look_everyone', 'Crowd',
    ['make everyone look like me', 'clone me', 'fill the city with me', 'everyone looks like me'],
    'Make everyone loaded around you look like you.',
    (ctx) => {
      let n = 0;
      for (const npc of ctx.npcs.npcs) {
        const name = npc.appearance.name, first = npc.appearance.firstName;
        copyLook(ctx.player.appearance, npc.appearance);
        npc.appearance.name = name;
        npc.appearance.firstName = first;
        npc.human.rebuildBody();
        n++;
      }
      return n + ' ' + plural('copy', n) + ' of you walking around. Say "T10 give everyone a new look" to undo it.';
    });

  // ===== 36. Traffic ========================================================
  add('traffic_park_all', 'Vehicles', ['park all the cars', 'stop all the cars', 'make the traffic stop', 'park everything'],
    'Bring every car on the road to a stop.',
    (ctx) => {
      let n = 0;
      for (const v of ctx.traffic.vehicles) {
        if (!v.ai || v.isPlayerVehicle) continue;
        if (v.ai.restoreSpeed == null) v.ai.restoreSpeed = v.ai.targetSpeed;
        v.ai.targetSpeed = 0;
        n++;
      }
      return n ? n + ' ' + plural('car', n) + ' rolling to a stop.' : 'No traffic near you.';
    });
  add('traffic_resume_all', 'Vehicles', ['get the traffic moving', 'unpark the cars', 'let the cars drive', 'start the traffic'],
    'Send the stopped traffic on its way.',
    (ctx) => {
      let n = 0;
      for (const v of ctx.traffic.vehicles) {
        if (!v.ai || v.ai.restoreSpeed == null) continue;
        v.ai.targetSpeed = v.ai.restoreSpeed;
        v.ai.restoreSpeed = null;
        n++;
      }
      return n ? 'Traffic\'s moving again.' : 'Nothing was parked.';
    });
  add('traffic_headlights_all', 'Vehicles', ['turn on all the headlights', 'lights on for every car', 'everyone put your lights on'],
    'Switch every car\'s headlights on.',
    (ctx) => {
      let n = 0;
      for (const v of ctx.traffic.vehicles) { v.autoHeadlights = false; v.headlightsOn = true; n++; }
      return n + ' ' + plural('car', n) + ' lit up.';
    });

  // ===== 37. Controls and view =============================================
  add('help_controls', 'Help', ['show me the controls', 'what are the controls', 'how do i move', 'how do i play'],
    'Explain the controls.',
    (ctx) => (ctx.game.input && ctx.game.input.isTouch
      ? 'Left stick to walk. Drag anywhere else to look. Buttons on the right: use, jump, crouch. The T10 circle up top is me. The gear is settings.'
      : 'WASD to walk, mouse to look (click to lock it, or just drag). E to use, F for cars, Space to jump, Ctrl to crouch, V for first/third person, M for the map, T to talk to me, Escape for settings.'));
  add('help_view_first', 'Help', ['go first person', 'first person view', 'put me in first person', 'i want to see through my own eyes'],
    'Switch to first person.',
    (ctx) => { ctx.player.setCameraMode('first'); ctx.game.hud.refreshSettings(); return 'First person.'; });
  add('help_view_third', 'Help', ['go third person', 'third person view', 'let me see myself', 'show me my body'],
    'Switch to third person.',
    (ctx) => { ctx.player.setCameraMode('third'); ctx.game.hud.refreshSettings(); return 'Third person. That\'s you.'; });
  add('help_all_commands', 'Help',
    ['show all commands', 'show me everything you can do', 'list all your commands', 'open the command list', 'show me all the commands'],
    'Open the full list of everything T10 knows.',
    (ctx) => {
      if (ctx.game.book) ctx.game.book.show('');
      return 'All ' + ctx.registry.count() + ' of them. Filter the box, or tap a line to run it. Saying just "T10" opens this too.';
    });
  add('help_search_commands', 'Help',
    ['what can you do with', 'what commands do you have for', 'search your commands for'],
    'Search everything T10 knows for a word.',
    (ctx, m) => {
      const q = (m.rest || '').trim();
      if (!q) return 'Search for what?';
      if (ctx.game.book) ctx.game.book.show(q);
      const hits = ctx.registry.commands.filter((c) => c.patterns.some((p) => p.includes(q.toLowerCase())));
      return hits.length
        ? hits.length + ' ' + plural('command', hits.length) + ' match "' + q + '". They\'re on screen.'
        : 'Nothing matches "' + q + '".';
    }, { capturesRest: true });

  // ===== 38. Quality of life ===============================================
  add('settings_open', 'Settings', ['open the settings', 'show me the settings', 'settings'],
    'Open the settings panel.',
    (ctx) => { ctx.game.hud.toggleSettings(); return 'Settings.'; });
  add('perf_report', 'Settings', ['how is it running', 'what is my framerate', 'whats my fps', 'is it running well'],
    'Ask how the game is performing.',
    (ctx) => {
      const g = ctx.game;
      const fps = Math.round(g.governor ? g.governor.fps : 0);
      const info = g.lastRenderInfo || (g.renderer ? g.renderer.info.render : null);
      const q = settings.get('quality');
      const tail = fps >= 30 ? '. Comfortable.'
        : q === 'low' ? '. That\'s already the lightest setting — say "T10 draw less" to cut the view distance.'
          : '. Say "T10 make it run better" and I\'ll drop a level.';
      return fps + ' fps on ' + q.toUpperCase() +
        (info ? ', ' + info.calls + ' draw calls, ' + (info.triangles / 1000).toFixed(0) + 'k triangles' : '') + tail;
    });
  add('perf_auto', 'Settings', ['make it run better', 'improve performance', 'stop the lag', 'fix the lag'],
    'Drop the settings until it runs smoothly.',
    (ctx) => {
      const fps = ctx.game.governor ? ctx.game.governor.fps : 60;
      const order = ['ultra', 'high', 'low'];
      const now = order.indexOf(settings.get('quality'));
      if (fps > 50) return 'It\'s already running at ' + Math.round(fps) + ' fps. Nothing to fix.';
      if (now >= order.length - 1) {
        ctx.overrideDrawDistance = 340;
        return 'Already on LOW, so I\'ve pulled the view distance in to 340m instead.';
      }
      const next = order[clampv(now + 1, 0, order.length - 1)];
      settings.set('quality', next);
      ctx.applyQuality();
      return 'Dropped to ' + next.toUpperCase() + '. Say "T10 set quality to ultra" to put it back.';
    });
}
