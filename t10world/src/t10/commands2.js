// T10 World - command registry, part two: movement, crowd control, money,
// graphics, questions and the fun stuff.
import * as THREE from '../../vendor/three.module.js';
import { DISTRICTS } from '../world/city.js';
import { QUALITY_PRESETS, QUALITY_ORDER, settings } from '../core/settings.js';
import { WEATHER_PRESETS } from '../render/atmosphere.js';
import { STATES } from '../human/animator.js';
import { generateAppearance, describeAppearance, OCCUPATIONS } from '../human/appearance.js';
import { ANIMAL_TYPES } from '../entities/animals.js';
import { VEHICLE_TYPES } from '../entities/vehicle.js';
import { EMOTES } from './emotes.js';
import { clamp01, clampv, lerpv, metersToFeetInches, TAU } from '../core/math.js';
import { audio } from '../core/audio.js';

export function extendRegistry(R, add) {
  // ===== 14. Teleport: landmarks ==========================================
  // Landmarks come from the live city so this list always matches the world.
  add('teleport_landmark_generic', 'Travel',
    ['take me to', 'teleport me to', 'go to', 'bring me to', 'i want to go to', 'send me to', 'take me'],
    'Travel to any named place in the city.',
    (ctx, m) => {
      const q = (m.rest || '').trim();
      if (!q) return 'Where to? Try "T10 take me to the beach" or name a landmark.';
      // Districts first: "take me to the beach" means the beachfront, not a
      // landmark that merely shares a word.
      const dist0 = Object.entries(DISTRICTS).find(([k, d]) => {
        const dn = d.name.toLowerCase();
        return q === dn || q === 'the ' + dn || q === k || q.replace(/^the /, '') === dn;
      });
      if (dist0) {
        const p0 = ctx.findDistrict(dist0[0]);
        if (p0) { ctx.player.teleport(p0.x, p0.z); ctx.pop(); return 'Welcome to ' + dist0[1].name + '.'; }
      }
      const lm = ctx.world.city.findLandmark(q);
      if (lm) {
        const spot = ctx.world.city.nearestSidewalk(lm.x, lm.z + 24);
        ctx.player.teleport(spot.x, spot.z);
        ctx.pop();
        return 'You\'re outside ' + lm.name + '.';
      }
      const dist = Object.entries(DISTRICTS).find(([k, d]) => d.name.toLowerCase().includes(q) || k === q.replace(/\s+/g, ''));
      if (dist) {
        const p = ctx.findDistrict(dist[0]);
        if (p) { ctx.player.teleport(p.x, p.z); ctx.pop(); return 'Welcome to ' + dist[1].name + '.'; }
      }
      return 'I don\'t know a "' + q + '". Ask me "T10 what places are there".';
    }, { capturesRest: true, priority: -1 });

  // ===== 15. Districts =====================================================
  // Everyday names for each district, so "take me to the beach" lands on the
  // beachfront rather than hunting for a landmark.
  const DISTRICT_ALIASES = {
    downtown: ['downtown', 'the city centre', 'the city center', 'the towers'],
    midrise: ['midtown'],
    apartments: ['apartment row', 'the apartments'],
    commercial: ['the shops', 'the shopping district', 'the high street'],
    residential: ['the suburbs', 'the residential streets', 'the houses'],
    suburb: ['the outskirts', 'the edge of town'],
    industrial: ['the industrial zone', 'the factories', 'the docks'],
    civic: ['the civic centre', 'the civic center'],
    park: ['the park', 'the green'],
    sports: ['the stadium', 'the sports complex'],
    beach: ['the beach', 'the seaside', 'the shore', 'the coast', 'the sea', 'the ocean', 'the water'],
    countryside: ['the countryside', 'the fields', 'the farms'],
    forest: ['the forest', 'the woods', 'the trees'],
  };
  for (const [key, d] of Object.entries(DISTRICTS)) {
    const n = d.name.toLowerCase();
    const aliases = DISTRICT_ALIASES[key] || [];
    add('goto_district_' + key, 'Travel',
      ['take me to ' + n, 'go to ' + n, 'teleport to ' + n, 'i want to go to the ' + n, 'take me to the ' + n]
        .concat(aliases.flatMap((a) => ['take me to ' + a, 'go to ' + a, 'teleport me to ' + a, 'i want to go to ' + a])),
      'Travel to ' + d.name + '.',
      (ctx) => {
        const p = ctx.findDistrict(key);
        if (!p) return 'I can\'t find a clear spot in ' + d.name + '.';
        ctx.player.teleport(p.x, p.z);
        ctx.pop();
        return 'You\'re in ' + d.name + ' now.';
      });
  }
  add('goto_coords', 'Travel', ['teleport to coordinates', 'go to coordinates', 'teleport me to x'],
    'Teleport to exact coordinates.',
    (ctx, m) => {
      const nums = (m.text.match(/-?\d+(\.\d+)?/g) || []).map(Number);
      if (nums.length < 2) return 'Give me two numbers — "T10 teleport to coordinates 120 -340".';
      ctx.player.teleport(clampv(nums[0], -1180, 1180), clampv(nums[1], -1180, 1180));
      ctx.pop();
      return 'Dropped you at ' + Math.round(nums[0]) + ', ' + Math.round(nums[1]) + '.';
    });
  add('goto_random', 'Travel', ['take me somewhere random', 'surprise me', 'random location', 'drop me anywhere'],
    'Teleport somewhere random.',
    (ctx) => {
      const a = Math.random() * TAU, r = 100 + Math.random() * 600;
      const p = ctx.world.findSpawnPoint(Math.cos(a) * r, Math.sin(a) * r);
      ctx.player.teleport(p.x, p.z);
      ctx.pop();
      return 'You\'re on ' + ctx.world.city.describeLocation(p.x, p.z) + '.';
    });
  add('goto_up', 'Travel', ['put me on a roof', 'take me to a rooftop', 'i want to be on top of a building'],
    'Put you on the nearest rooftop.',
    (ctx) => {
      const lots = ctx.world.city.lotsNear(ctx.player.position.x, ctx.player.position.z, 140)
        .filter((l) => l.height > 8).sort((a, b) =>
          Math.hypot(a.x - ctx.player.position.x, a.z - ctx.player.position.z) -
          Math.hypot(b.x - ctx.player.position.x, b.z - ctx.player.position.z));
      if (!lots.length) return 'No tall buildings near you.';
      const l = lots[0];
      const top = ctx.world.groundAt(l.x, l.z) + l.height + 0.35;
      ctx.player.teleport(l.x, l.z, top);
      ctx.player.verticalVel = 0;
      ctx.pop();
      return 'Rooftop. Mind the edge.';
    });
  add('goto_marker_set', 'Travel', ['mark this spot', 'save this location', 'remember this place', 'drop a marker'],
    'Save your current position as a marker.',
    (ctx) => {
      ctx.markers.push({ x: ctx.player.position.x, z: ctx.player.position.z, name: 'Marker ' + (ctx.markers.length + 1) });
      return 'Marked. That\'s ' + ctx.markers[ctx.markers.length - 1].name + ' — ' + ctx.world.city.describeLocation(ctx.player.position.x, ctx.player.position.z) + '.';
    });
  add('goto_marker', 'Travel', ['take me to my marker', 'go to my marker', 'back to the marker'],
    'Return to your last marker.',
    (ctx) => {
      if (!ctx.markers.length) return 'You haven\'t marked anywhere yet.';
      const mk = ctx.markers[ctx.markers.length - 1];
      ctx.player.teleport(mk.x, mk.z);
      ctx.pop();
      return 'Back at ' + mk.name + '.';
    });
  add('goto_marker_list', 'Travel', ['list my markers', 'what markers do i have', 'show my markers'],
    'List your saved markers.',
    (ctx) => (ctx.markers.length ? ctx.markers.map((mk) => mk.name + ' (' + Math.round(mk.x) + ', ' + Math.round(mk.z) + ')').join('; ') : 'No markers saved.'));
  add('goto_marker_clear', 'Travel', ['clear my markers', 'delete my markers', 'forget my markers'],
    'Clear all markers.',
    (ctx) => { const n = ctx.markers.length; ctx.markers.length = 0; return 'Cleared ' + n + ' markers.'; });
  add('places_list', 'Travel', ['what places are there', 'list the landmarks', 'where can i go', 'what is in this city'],
    'List the city\'s landmarks.',
    (ctx) => 'Landmarks: ' + ctx.world.city.landmarks.slice(0, 18).map((l) => l.name).join(', ') + '. Say "T10 take me to" any of them.');

  // ===== 16. Self powers ===================================================
  const SPEEDS = [
    ['slow', 0.5], ['normal', 1], ['fast', 1.8], ['very fast', 3], ['super fast', 5],
    ['ludicrous', 9], ['sonic', 14], ['slow motion', 0.25],
  ];
  for (const [name, mult] of SPEEDS) {
    add('speed_' + name.replace(/\s+/g, '_'), 'Powers',
      ['make me ' + name, 'set my speed to ' + name, 'i want to be ' + name, name + ' speed'],
      'Set your movement speed to ' + name + '.',
      (ctx) => { ctx.player.speedMultiplier = mult; return 'Speed: ' + name + '.'; });
  }
  const JUMPS = [['normal jump', 1], ['high jump', 2], ['super jump', 3.4], ['moon jump', 5]];
  for (const [name, mult] of JUMPS) {
    add('jump_' + name.replace(/\s+/g, '_'), 'Powers',
      ['give me a ' + name, 'i want a ' + name, name],
      'Set your jump height: ' + name + '.',
      (ctx) => { ctx.player.jumpMultiplier = mult; return name.charAt(0).toUpperCase() + name.slice(1) + ' enabled.'; });
  }
  add('fly_on', 'Powers', ['let me fly', 'i want to fly', 'enable flying', 'turn on flying', 'fly mode'],
    'Enable flight — jump to rise, crouch to descend.',
    (ctx) => { ctx.player.flying = true; return 'Flying on. Jump goes up, crouch goes down.'; });
  add('fly_off', 'Powers', ['stop flying', 'disable flying', 'turn off flying', 'land me'],
    'Disable flight.',
    (ctx) => { ctx.player.flying = false; return 'Flying off.'; });
  add('noclip_on', 'Powers', ['enable noclip', 'let me walk through walls', 'turn on noclip', 'ghost mode'],
    'Walk through anything.',
    (ctx) => { ctx.player.noclip = true; ctx.player.flying = true; return 'Noclip on. Nothing can stop you.'; });
  add('noclip_off', 'Powers', ['disable noclip', 'turn off noclip', 'solid again'],
    'Turn noclip off.',
    (ctx) => { ctx.player.noclip = false; ctx.player.flying = false; return 'Solid again.'; });
  add('god_on', 'Powers', ['enable god mode', 'god mode on', 'make me invincible'],
    'Nothing can hurt you.', (ctx) => { ctx.player.godMode = true; return 'God mode on.'; });
  add('god_off', 'Powers', ['disable god mode', 'god mode off', 'make me mortal'],
    'Turn god mode off.', (ctx) => { ctx.player.godMode = false; return 'God mode off.'; });
  add('invisible_on', 'Powers', ['make me invisible', 'turn me invisible', 'hide me'],
    'Turn invisible.',
    (ctx) => { ctx.player.root.visible = false; return 'Nobody can see you.'; });
  add('invisible_off', 'Powers', ['make me visible', 'turn me visible', 'show me again'],
    'Become visible again.',
    (ctx) => { ctx.player.root.visible = true; return 'You\'re visible again.'; });
  const SCALES = [['giant', 2.2], ['big', 1.4], ['normal size', 1], ['small', 0.7], ['tiny', 0.4]];
  for (const [name, s] of SCALES) {
    add('scale_' + name.replace(/\s+/g, '_'), 'Powers',
      ['make me ' + name, 'i want to be ' + name, name],
      'Scale you to ' + name + '.',
      (ctx) => { ctx.player.root.scale.setScalar(s); ctx.player.camHeight = 1.5 * s; return 'You\'re ' + name + ' now.'; });
  }
  const GRAVITIES = [['normal gravity', 1], ['low gravity', 0.25], ['moon gravity', 0.17], ['zero gravity', 0.02], ['heavy gravity', 2.2]];
  for (const [name, g] of GRAVITIES) {
    add('gravity_' + name.replace(/\s+/g, '_'), 'Powers',
      ['set ' + name, 'i want ' + name, name, 'make it ' + name],
      'Set ' + name + '.',
      (ctx) => { ctx.setGravity(g); return name.charAt(0).toUpperCase() + name.slice(1) + ' set.'; });
  }
  add('heal', 'Powers', ['heal me', 'fix me up', 'restore me', 'patch me up'],
    'Restore you to full.',
    (ctx) => { ctx.player.speedMultiplier = ctx.player.speedMultiplier || 1; return 'You\'re fine. Nothing broken.'; });
  add('powers_reset', 'Powers', ['reset my powers', 'turn everything off', 'back to normal', 'reset me'],
    'Turn off every power.',
    (ctx) => {
      const p = ctx.player;
      p.flying = false; p.noclip = false; p.godMode = false;
      p.speedMultiplier = 1; p.jumpMultiplier = 1;
      p.root.visible = true; p.root.scale.setScalar(1); p.camHeight = 1.5;
      ctx.setGravity(1);
      return 'Everything back to normal.';
    });

  // ===== 17. Player emotes =================================================
  for (const e of EMOTES) {
    add('emote_' + e.id, 'Actions',
      ['make me ' + e.name, 'i want to ' + e.name, e.name, 'let me ' + e.name],
      'Make your character ' + e.name + '.',
      (ctx) => { ctx.player.human.animator.setState(e.state); ctx.player.sitting = e.state === STATES.SIT ? {} : null; return 'Doing it.'; });
    add('crowd_emote_' + e.id, 'Crowd',
      ['make everyone ' + e.name, 'tell everyone to ' + e.name, 'everyone ' + e.name],
      'Make everyone nearby ' + e.name + '.',
      (ctx) => {
        const n = ctx.npcs.forEachNear(ctx.player.position, 60, (npc) => {
          npc.controlled = e.id === 'dance' ? 'dance' : null;
          npc.setState(e.state);
          npc.activityTimer = 25;
        });
        return n ? n + ' people are doing it.' : 'Nobody close enough.';
      });
  }

  // ===== 18. Crowd control =================================================
  const CROWD_ACTIONS = [
    ['freeze', 'freeze', (npc) => { npc.controlled = 'freeze'; }, 'frozen in place'],
    ['unfreeze', 'unfreeze', (npc) => { npc.controlled = null; }, 'moving again'],
    ['follow', 'follow me', (npc) => { npc.controlled = 'follow'; }, 'following you'],
    ['stop following', 'stop following me', (npc) => { if (npc.controlled === 'follow') npc.controlled = null; }, 'no longer following'],
    ['run', 'run', (npc) => { npc.targetSpeed = npc.runSpeed; npc.activityTimer = 20; }, 'running'],
    ['scatter', 'scatter', (npc) => {
      const a = Math.random() * TAU;
      npc.path = [new THREE.Vector3(npc.position.x + Math.cos(a) * 60, 0, npc.position.z + Math.sin(a) * 60)];
      npc.pathIndex = 0; npc.targetSpeed = npc.runSpeed; npc.controlled = null;
    }, 'scattering'],
    ['gather', 'gather round', (npc) => {
      npc.path = []; npc.controlled = 'follow';
    }, 'coming over'],
    ['sit down', 'sit down', (npc) => { npc.setState(STATES.SIT); npc.activityTimer = 40; }, 'sitting'],
    ['sleep', 'go to sleep', (npc) => { npc.setState(STATES.LIE); npc.activityTimer = 60; }, 'lying down'],
    ['wake up', 'wake up', (npc) => { npc.setState(STATES.IDLE); npc.activityTimer = 5; }, 'up again'],
  ];
  for (const [key, phrase, fn, result] of CROWD_ACTIONS) {
    add('crowd_all_' + key.replace(/\s+/g, '_'), 'Crowd',
      ['make everyone ' + phrase, 'tell everyone to ' + phrase, 'everyone ' + phrase, 'all people ' + phrase],
      'Make everyone nearby ' + phrase + '.',
      (ctx) => {
        const n = ctx.npcs.forEachNear(ctx.player.position, 70, fn);
        return n ? n + ' people ' + result + '.' : 'Nobody close enough.';
      });
    add('crowd_one_' + key.replace(/\s+/g, '_'), 'Crowd',
      ['make that person ' + phrase, 'tell him to ' + phrase, 'tell her to ' + phrase, 'make them ' + phrase, 'that guy ' + phrase],
      'Make the nearest person ' + phrase + '.',
      (ctx) => {
        const npc = ctx.npcs.nearestNPC(ctx.player.position, 25);
        if (!npc) return 'Nobody close enough.';
        fn(npc);
        return npc.appearance.firstName + ' is ' + result + '.';
      });
    add('crowd_city_' + key.replace(/\s+/g, '_'), 'Crowd',
      ['make the whole city ' + phrase, 'everyone in the city ' + phrase, 'all of them ' + phrase],
      'Apply to everyone loaded.',
      (ctx) => {
        let n = 0;
        for (const npc of ctx.npcs.npcs) { fn(npc); n++; }
        return n + ' people ' + result + '.';
      });
  }
  add('spawn_person', 'Crowd', ['spawn a person', 'spawn someone', 'make a person', 'create a person', 'give me a person'],
    'Spawn a random person next to you.',
    (ctx, m) => {
      const count = clampv(m.number || 1, 1, 30);
      let last = null;
      for (let i = 0; i < count; i++) {
        const spot = ctx.spotInFront(2.5 + (i % 5) * 1.6, ((i % 3) - 1) * 1.8);
        last = ctx.npcs.spawnNear(0, 0, 0, 0, { x: spot.x, z: spot.z });
      }
      ctx.pop();
      if (!last) return 'Couldn\'t place anyone there.';
      return count === 1 ? 'Meet ' + last.appearance.name + ', ' + last.appearance.ageYears + '. ' + last.appearance.personalityName + '.'
        : count + ' people, all different.';
    });
  for (const g of ['man', 'woman']) {
    add('spawn_person_' + g, 'Crowd',
      ['spawn a ' + g, 'make a ' + g, 'give me a ' + g, 'create a ' + g],
      'Spawn a random ' + g + '.',
      (ctx, m) => {
        const count = clampv(m.number || 1, 1, 25);
        let last = null;
        for (let i = 0; i < count; i++) {
          const spot = ctx.spotInFront(2.5 + (i % 5) * 1.6, ((i % 3) - 1) * 1.8);
          last = ctx.npcs.spawnNear(0, 0, 0, 0, {
            x: spot.x, z: spot.z,
            appearance: generateAppearance({ gender: g === 'man' ? 'male' : 'female' }),
          });
        }
        ctx.pop();
        return last ? (count === 1 ? 'This is ' + last.appearance.name + '.' : count + ' of them.') : 'No room.';
      });
  }
  for (const bias of [['kid', 'young'], ['teenager', 'young'], ['old person', 'old'], ['elder', 'old']]) {
    add('spawn_person_' + bias[0].replace(/\s+/g, '_'), 'Crowd',
      ['spawn a ' + bias[0], 'make a ' + bias[0], 'give me a ' + bias[0]],
      'Spawn a ' + bias[0] + '.',
      (ctx) => {
        const spot = ctx.spotInFront(2.6, 0);
        const npc = ctx.npcs.spawnNear(0, 0, 0, 0, { x: spot.x, z: spot.z, appearance: generateAppearance({ ageBias: bias[1] }) });
        ctx.pop();
        return npc ? npc.appearance.name + ', ' + npc.appearance.ageYears + '.' : 'No room.';
      });
  }
  for (const job of OCCUPATIONS.slice(0, 16)) {
    add('spawn_job_' + job.replace(/\s+/g, '_'), 'Crowd',
      ['spawn a ' + job, 'give me a ' + job, 'make a ' + job],
      'Spawn someone who works as a ' + job + '.',
      (ctx) => {
        const a = generateAppearance({});
        a.occupation = job;
        const spot = ctx.spotInFront(2.6, 0);
        const npc = ctx.npcs.spawnNear(0, 0, 0, 0, { x: spot.x, z: spot.z, appearance: a });
        ctx.pop();
        return npc ? npc.appearance.name + ', ' + job + '.' : 'No room.';
      });
  }
  add('crowd_remove_one', 'Crowd', ['remove that person', 'delete that person', 'get rid of them', 'make them disappear'],
    'Remove the nearest person.',
    (ctx) => {
      const npc = ctx.npcs.nearestNPC(ctx.player.position, 25);
      if (!npc) return 'Nobody close enough.';
      const name = npc.appearance.firstName;
      ctx.npcs.remove(npc);
      return name + ' is gone.';
    });
  add('crowd_clear', 'Crowd', ['remove everyone', 'clear the crowd', 'delete all people', 'empty the streets'],
    'Remove every person.',
    (ctx) => { const n = ctx.npcs.count(); ctx.npcs.clear(); return 'Removed ' + n + ' people. It\'s very quiet now.'; });
  const DENSITIES = [['none', 0], ['low', 0.35], ['normal', 1], ['busy', 1.8], ['packed', 3]];
  for (const [name, scale] of DENSITIES) {
    add('density_people_' + name, 'Crowd',
      ['make the streets ' + name, 'set crowd density to ' + name, name + ' crowds'],
      'Set pedestrian density to ' + name + '.',
      (ctx) => { ctx.npcs.densityScale = scale; if (!scale) ctx.npcs.clear(); return 'Crowd density: ' + name + '.'; });
    add('density_traffic_' + name, 'Vehicles',
      ['make the traffic ' + name, 'set traffic to ' + name, name + ' traffic'],
      'Set traffic density to ' + name + '.',
      (ctx) => { ctx.traffic.densityScale = scale; if (!scale) ctx.traffic.clear(ctx.player.inVehicle); return 'Traffic density: ' + name + '.'; });
    add('density_animals_' + name, 'Animals',
      ['make the animals ' + name, 'set animal density to ' + name, name + ' animals'],
      'Set animal density to ' + name + '.',
      (ctx) => { ctx.animals.densityScale = scale; if (!scale) ctx.animals.clear(); return 'Animal density: ' + name + '.'; });
  }

  // ===== 19. Money =========================================================
  const AMOUNTS = [100, 500, 1000, 5000, 10000, 50000, 100000, 1000000, 10000000, 1000000000];
  for (const amt of AMOUNTS) {
    const label = amt >= 1000000000 ? 'a billion' : amt >= 1000000 ? (amt / 1000000) + ' million' :
      amt >= 1000 ? (amt / 1000) + ' thousand' : String(amt);
    add('money_give_' + amt, 'Money',
      ['give me ' + amt + ' dollars', 'give me ' + label, 'i want ' + label + ' dollars', 'add ' + amt + ' dollars'],
      'Add $' + amt.toLocaleString() + '.',
      (ctx) => { ctx.player.addMoney(amt); audio.cash(); return 'Added $' + amt.toLocaleString() + '. You\'ve got $' + ctx.player.money.toLocaleString() + '.'; });
  }
  add('money_give_any', 'Money', ['give me money', 'i need money', 'more money', 'make me rich', 'give me cash'],
    'Add money.',
    (ctx, m) => {
      const amt = m.number || 10000;
      ctx.player.addMoney(amt);
      audio.cash();
      return 'Done. $' + ctx.player.money.toLocaleString() + ' in your name.';
    });
  add('money_set', 'Money', ['set my money to', 'set my balance to', 'make my money'],
    'Set your balance.',
    (ctx, m) => {
      const amt = m.number != null ? m.number : 0;
      ctx.player.setMoney(amt);
      return 'Balance set to $' + ctx.player.money.toLocaleString() + '.';
    });
  add('money_remove', 'Money', ['take my money', 'remove my money', 'make me broke', 'clear my balance'],
    'Zero your balance.',
    (ctx) => { ctx.player.setMoney(0); return 'You\'re broke. $0.'; });
  add('money_query', 'Money',
    ['how much money do i have', 'what is my balance', 'whats my balance', 'how much money', 'my money',
     'how rich am i', 'check my money', 'whats my money', 'do i have money'],
    'Ask how much money you have. Your balance lives with me, not on your screen.',
    (ctx) => {
      const m = ctx.player.money;
      if (m <= 0) return 'You have nothing. Say the word and I\'ll fix that.';
      if (m >= 1000000000) return 'You have $' + m.toLocaleString() + '. That is a genuinely absurd amount of money.';
      if (m >= 1000000) return 'You have $' + m.toLocaleString() + '. Comfortable.';
      return 'You have $' + m.toLocaleString() + '.';
    });

  // ===== 20. Graphics ======================================================
  for (const q of QUALITY_ORDER) {
    const p = QUALITY_PRESETS[q];
    add('quality_' + q, 'Graphics',
      ['set quality to ' + q, q + ' quality', 'graphics ' + q, 'set graphics to ' + q, 'use ' + q + ' quality'],
      p.label + ' — ' + p.blurb,
      (ctx) => { settings.setQuality(q); ctx.applyQuality(); return 'Quality set to ' + p.label + '. ' + p.blurb; });
  }
  add('quality_up', 'Graphics', ['increase quality', 'better graphics', 'turn up the graphics', 'higher quality'],
    'Step the quality up.',
    (ctx) => { const q = settings.stepQuality(1); ctx.applyQuality(); return 'Quality: ' + QUALITY_PRESETS[q].label + '.'; });
  add('quality_down', 'Graphics', ['decrease quality', 'lower graphics', 'turn down the graphics', 'lower quality'],
    'Step the quality down.',
    (ctx) => { const q = settings.stepQuality(-1); ctx.applyQuality(); return 'Quality: ' + QUALITY_PRESETS[q].label + '.'; });
  const TOGGLES = [
    ['shadows', 'shadows', (ctx, on) => { ctx.setShadows(on); }],
    ['bloom', 'bloom', (ctx, on) => { ctx.post.bloomEnabled = on; }],
    ['reflections', 'screen space reflections', (ctx, on) => { ctx.post.ssrEnabled = on; }],
    ['motion blur', 'motion blur', (ctx, on) => { ctx.post.motionBlurEnabled = on; }],
    ['ambient occlusion', 'ambient occlusion', (ctx, on) => { ctx.post.ssaoEnabled = on; }],
    ['fog', 'fog', (ctx, on) => { ctx.scene.fog.far = on ? settings.preset.drawDistance : 1e6; }],
    ['rain particles', 'rain particles', (ctx, on) => { ctx.atmosphere.rain.visible = on; }],
    ['vsync', 'frame smoothing', (ctx, on) => { ctx.vsync = on; }],
  ];
  for (const [name, label, fn] of TOGGLES) {
    add('toggle_' + name.replace(/\s+/g, '_') + '_on', 'Graphics',
      ['turn on ' + name, 'enable ' + name, name + ' on'],
      'Turn ' + label + ' on.',
      (ctx) => { fn(ctx, true); return label.charAt(0).toUpperCase() + label.slice(1) + ' on.'; });
    add('toggle_' + name.replace(/\s+/g, '_') + '_off', 'Graphics',
      ['turn off ' + name, 'disable ' + name, name + ' off'],
      'Turn ' + label + ' off.',
      (ctx) => { fn(ctx, false); return label.charAt(0).toUpperCase() + label.slice(1) + ' off.'; });
  }
  const DRAW_DISTANCES = [['short', 240], ['medium', 480], ['long', 800], ['very long', 1100]];
  for (const [name, d] of DRAW_DISTANCES) {
    add('drawdistance_' + name.replace(/\s+/g, '_'), 'Graphics',
      ['set draw distance to ' + name, name + ' draw distance', 'see ' + name],
      'Draw distance: ' + name + '.',
      (ctx) => { ctx.overrideDrawDistance = d; return 'Draw distance ' + name + ' (' + d + 'm).'; });
  }
  add('show_fps', 'Graphics', ['show the fps', 'show performance', 'show stats', 'display fps'],
    'Show the performance readout.',
    (ctx) => { ctx.showStats = true; return 'Stats are up.'; });
  add('hide_fps', 'Graphics', ['hide the fps', 'hide performance', 'hide stats'],
    'Hide the performance readout.',
    (ctx) => { ctx.showStats = false; return 'Hidden.'; });

  // ===== 21. Camera ========================================================
  add('camera_first', 'Camera', ['first person', 'go first person', 'switch to first person', 'i want first person'],
    'Switch to first person.',
    (ctx) => { ctx.player.setCameraMode('first'); return 'First person.'; });
  add('camera_third', 'Camera', ['third person', 'go third person', 'switch to third person', 'i want third person'],
    'Switch to third person.',
    (ctx) => { ctx.player.setCameraMode('third'); return 'Third person.'; });
  add('camera_toggle', 'Camera', ['switch the camera', 'change the camera', 'toggle the camera', 'change view'],
    'Toggle camera mode.',
    (ctx) => 'Now in ' + ctx.player.toggleCameraMode() + ' person.');
  const FOVS = [['narrow', 50], ['normal', 62], ['wide', 78], ['very wide', 95]];
  for (const [name, f] of FOVS) {
    add('fov_' + name.replace(/\s+/g, '_'), 'Camera',
      ['set the field of view to ' + name, name + ' field of view', name + ' fov'],
      'Field of view: ' + name + '.',
      (ctx) => { settings.set('fov', f); return 'Field of view ' + name + ' (' + f + ').'; });
  }
  add('camera_zoom_in', 'Camera', ['zoom in', 'closer camera', 'bring the camera in'],
    'Move the camera closer.',
    (ctx) => { ctx.player.camDistanceTarget = clampv(ctx.player.camDistanceTarget - 1.2, 1.2, 14); return 'Zoomed in.'; });
  add('camera_zoom_out', 'Camera', ['zoom out', 'further camera', 'pull the camera back'],
    'Move the camera further out.',
    (ctx) => { ctx.player.camDistanceTarget = clampv(ctx.player.camDistanceTarget + 1.2, 1.2, 14); return 'Zoomed out.'; });

  // ===== 22. Sound =========================================================
  add('sound_mute', 'Sound', ['mute', 'mute the sound', 'turn off the sound', 'silence'],
    'Mute everything.', (ctx) => { audio.setMuted(true); return 'Muted.'; });
  add('sound_unmute', 'Sound', ['unmute', 'turn the sound on', 'sound on'],
    'Unmute.', (ctx) => { audio.setMuted(false); return 'Sound on.'; });
  add('sound_up', 'Sound', ['turn up the volume', 'louder', 'volume up'],
    'Raise the volume.',
    (ctx) => { settings.set('masterVolume', clamp01(settings.get('masterVolume') + 0.15)); audio.applyVolumes(); return 'Volume at ' + Math.round(settings.get('masterVolume') * 100) + '%.'; });
  add('sound_down', 'Sound', ['turn down the volume', 'quieter', 'volume down'],
    'Lower the volume.',
    (ctx) => { settings.set('masterVolume', clamp01(settings.get('masterVolume') - 0.15)); audio.applyVolumes(); return 'Volume at ' + Math.round(settings.get('masterVolume') * 100) + '%.'; });
  add('voice_off', 'Sound', ['stop talking', 'be quiet', 'dont speak', 'turn off your voice'],
    'Stop T10 speaking aloud.',
    (ctx) => { settings.set('voiceVolume', 0); audio.stopSpeech(); return 'I\'ll keep it to text.'; });
  add('voice_on', 'Sound', ['speak to me', 'use your voice', 'talk to me out loud', 'turn on your voice'],
    'Let T10 speak aloud.',
    (ctx) => { settings.set('voiceVolume', 0.9); return 'I\'ll speak up.'; });

  // ===== 23. Vision modes ==================================================
  const VISIONS = [
    ['normal vision', 'off'], ['t10 vision', 't10'], ['night vision', 'night'],
    ['thermal vision', 'thermal'], ['scanner vision', 'scan'], ['wireframe vision', 'wire'],
  ];
  for (const [name, mode] of VISIONS) {
    add('vision_' + mode, 'Vision',
      ['give me ' + name, 'turn on ' + name, 'switch to ' + name, name],
      'Switch to ' + name + '.',
      (ctx) => { ctx.setVisionMode(mode); return name.charAt(0).toUpperCase() + name.slice(1) + ' engaged.'; });
  }

  // ===== 24. World controls ================================================
  add('world_clear_spawned', 'World', ['clean up', 'remove everything you made', 'clear my spawns', 'undo everything'],
    'Remove everything T10 spawned.',
    (ctx) => {
      const n = ctx.world.clearSpawnedProps();
      return 'Removed ' + n + ' things I\'d placed.';
    });
  add('world_save', 'World', ['save the game', 'save my world', 'save', 'save progress'],
    'Save your world.',
    (ctx) => (ctx.save() ? 'Saved.' : 'Couldn\'t save — storage is blocked in this browser.'));
  add('world_load', 'World', ['load the game', 'load my world', 'load my save', 'restore my save'],
    'Load your last save.',
    (ctx) => (ctx.load() ? 'Loaded your last save.' : 'No save found.'));
  add('world_streetlights_on', 'World', ['turn on the street lights', 'street lights on', 'light up the city'],
    'Force street lights on.',
    (ctx) => { ctx.forceStreetLights = 1; return 'Every light in the city, on.'; });
  add('world_streetlights_off', 'World', ['turn off the street lights', 'street lights off', 'blackout', 'kill the lights'],
    'Force street lights off.',
    (ctx) => { ctx.forceStreetLights = 0; return 'Blackout. Careful out there.'; });
  add('world_streetlights_auto', 'World', ['street lights auto', 'normal street lights'],
    'Let street lights follow the clock.',
    (ctx) => { ctx.forceStreetLights = null; return 'Lights back on the clock.'; });
  add('traffic_lights_green', 'World', ['make all the lights green', 'all green lights', 'green lights everywhere'],
    'Hold every traffic light green.',
    (ctx) => { ctx.trafficLightOverride = 'green'; return 'All green. Go.'; });
  add('traffic_lights_red', 'World', ['make all the lights red', 'all red lights', 'stop all the traffic'],
    'Hold every traffic light red.',
    (ctx) => { ctx.trafficLightOverride = 'red'; return 'All red. Nothing is moving.'; });
  add('traffic_lights_normal', 'World', ['normal traffic lights', 'reset the traffic lights'],
    'Return traffic lights to normal.',
    (ctx) => { ctx.trafficLightOverride = null; return 'Lights back to normal.'; });

  // ===== 25. Questions =====================================================
  add('q_where', 'Questions', ['where am i', 'what is this place', 'where are we', 'whats this area', 'what street is this'],
    'Ask where you are.',
    (ctx) => {
      const p = ctx.player.position;
      return 'You\'re on ' + ctx.world.city.describeLocation(p.x, p.z) + '. Coordinates ' + Math.round(p.x) + ', ' + Math.round(p.z) + '.';
    });
  add('q_who', 'Questions', ['who is that', 'who are they', 'who is that person', 'tell me about them', 'who is this'],
    'Ask about the nearest person.',
    (ctx) => {
      const npc = ctx.npcs.nearestNPC(ctx.player.position, 30);
      if (!npc) return 'Nobody close enough to tell you about.';
      return npc.describe() + ' Right now they\'re ' + (npc.activity === 'wander' ? 'just wandering' : npc.activity) + '.';
    });
  add('q_nearby', 'Questions', ['what is nearby', 'whats around here', 'what can i do here', 'what is around'],
    'Ask what\'s nearby.',
    (ctx) => {
      const p = ctx.player.position;
      const lms = ctx.world.city.landmarks
        .map((l) => ({ l, d: Math.hypot(l.x - p.x, l.z - p.z) }))
        .filter((e) => e.d < 400).sort((a, b) => a.d - b.d).slice(0, 4);
      const people = ctx.npcs.within(p, 40).length;
      const cars = ctx.traffic.vehicles.filter((v) => v.position.distanceTo(p) < 50).length;
      const beasts = ctx.animals.within(p, 50).length;
      let s = 'Around you: ' + people + ' people, ' + cars + ' vehicles, ' + beasts + ' animals. ';
      if (lms.length) s += 'Nearest landmarks: ' + lms.map((e) => e.l.name + ' (' + Math.round(e.d) + 'm)').join(', ') + '.';
      return s;
    });
  add('q_count_people', 'Questions', ['how many people are there', 'how many people', 'count the people'],
    'Count loaded people.', (ctx) => ctx.npcs.count() + ' people are simulated around you right now.');
  add('q_count_cars', 'Questions', ['how many cars are there', 'how many cars', 'count the cars'],
    'Count loaded vehicles.', (ctx) => ctx.traffic.count() + ' vehicles on the road near you.');
  add('q_count_animals', 'Questions', ['how many animals are there', 'how many animals', 'count the animals'],
    'Count loaded animals.', (ctx) => ctx.animals.count() + ' animals nearby.');
  add('q_stats', 'Questions', ['world stats', 'show me the stats', 'how big is this world', 'world info'],
    'World statistics.',
    (ctx) => {
      const s = ctx.world.stats();
      return 'The city has ' + s.city.lots + ' buildings across ' + s.city.blocks + ' blocks, ' +
        s.city.roads + ' roads and ' + s.city.landmarks + ' landmarks. ' +
        s.chunks + ' chunks loaded, ' + s.interactables + ' things you can interact with.';
    });
  add('q_describe_car', 'Questions', ['what car is this', 'tell me about this car', 'describe this car'],
    'Describe the nearest vehicle.',
    (ctx) => {
      const v = ctx.player.inVehicle || ctx.traffic.nearest(ctx.player.position.x, ctx.player.position.z, 20);
      return v ? v.describe() : 'No vehicle nearby.';
    });
  add('q_describe_animal', 'Questions', ['what animal is that', 'tell me about that animal', 'whats that animal'],
    'Describe the nearest animal.',
    (ctx) => {
      const a = ctx.animals.nearest(ctx.player.position, 30);
      return a ? 'A ' + a.spec.name.toLowerCase() + '. It\'s ' + a.state + '.' : 'No animals nearby.';
    });
  add('q_me', 'Questions', ['who am i', 'what do i look like', 'describe me', 'tell me about myself'],
    'Describe your character.',
    (ctx) => describeAppearance(ctx.player.appearance));
  add('q_help', 'Questions',
    ['help', 'what can you do', 'what can i say', 'commands', 'how does this work', 'what are you'],
    'Ask what T10 can do.',
    (ctx) => {
      const cats = ctx.registry.categoryNames();
      return 'I\'m T10. I run this world. Say "T10" then tell me anything — I know ' +
        ctx.registry.count() + ' commands across ' + cats.length + ' areas: ' + cats.join(', ') +
        '. Try "T10 make it rain", "T10 spawn a dog", "T10 I wanna wear something new", "T10 how much money do I have".';
    });
  add('q_command_count', 'Questions', ['how many commands do you have', 'how many things can you do', 'how many commands'],
    'Ask how many commands exist.',
    (ctx) => 'I know ' + ctx.registry.count() + ' commands right now, across ' + ctx.registry.categoryNames().length + ' categories.');
  for (const cat of ['Spawning', 'Vehicles', 'Animals', 'Appearance', 'Body', 'Weather', 'Time', 'Travel',
    'Powers', 'Actions', 'Crowd', 'Money', 'Graphics', 'Camera', 'Sound', 'Vision', 'World', 'Questions', 'Fun', 'Identity']) {
    add('list_' + cat.toLowerCase(), 'Questions',
      ['what ' + cat.toLowerCase() + ' commands are there', 'list ' + cat.toLowerCase() + ' commands', 'show me ' + cat.toLowerCase() + ' commands'],
      'List commands in the ' + cat + ' category.',
      (ctx) => {
        const list = ctx.registry.inCategory(cat);
        if (!list.length) return 'Nothing in that category.';
        const sample = list.slice(0, 10).map((c) => '"' + c.patterns[0] + '"');
        return cat + ': ' + list.length + ' commands. For example ' + sample.join(', ') + '.';
      });
  }

  // ===== 26. Fun / chaos ===================================================
  add('fun_party', 'Fun', ['start a party', 'party mode', 'lets have a party', 'party time'],
    'Everyone dances, lights up, night falls.',
    (ctx) => {
      ctx.atmosphere.setTimeOfDay(22);
      ctx.atmosphere.setWeather('clear');
      const n = ctx.npcs.forEachNear(ctx.player.position, 60, (npc) => { npc.controlled = 'dance'; });
      ctx.player.human.animator.setState(STATES.DANCE);
      return 'Party started. ' + n + ' people dancing, and it\'s ' + ctx.atmosphere.clockString() + '.';
    });
  add('fun_chaos', 'Fun', ['chaos mode', 'cause chaos', 'make it chaos', 'go wild'],
    'Storm, sirens, everyone running.',
    (ctx) => {
      ctx.atmosphere.setWeather('storm');
      ctx.npcs.forEachNear(ctx.player.position, 80, (npc) => {
        const a = Math.random() * TAU;
        npc.path = [new THREE.Vector3(npc.position.x + Math.cos(a) * 80, 0, npc.position.z + Math.sin(a) * 80)];
        npc.pathIndex = 0; npc.targetSpeed = npc.runSpeed; npc.controlled = null;
      });
      for (const v of ctx.traffic.vehicles) if (v.refs.sirens.length) v.sirenOn = true;
      return 'Chaos. Storm overhead, everyone running, every siren in the city.';
    });
  add('fun_peaceful', 'Fun', ['peaceful mode', 'make it calm', 'calm everything down', 'peace'],
    'Clear skies, golden hour, everyone relaxed.',
    (ctx) => {
      ctx.atmosphere.setWeather('clear');
      ctx.atmosphere.setTimeOfDay(18.4);
      ctx.npcs.forEachNear(ctx.player.position, 80, (npc) => { npc.controlled = null; npc.setActivity('relax'); });
      for (const v of ctx.traffic.vehicles) v.sirenOn = false;
      return 'Golden hour, clear sky, everyone taking it easy.';
    });
  add('fun_traffic_jam', 'Fun', ['make a traffic jam', 'create a traffic jam', 'jam the roads'],
    'Fill the street with cars.',
    (ctx) => {
      for (let i = 0; i < 14; i++) {
        const spot = ctx.spotInFront(8 + i * 5.5, ((i % 2) ? 1 : -1) * 2.4);
        ctx.traffic.spawnAt('sedan', spot.x, spot.z, ctx.player.heading);
      }
      return 'Fourteen cars, nose to tail. Good luck.';
    });
  add('fun_convoy', 'Fun', ['make a convoy', 'spawn a convoy', 'police convoy'],
    'Spawn a line of emergency vehicles.',
    (ctx) => {
      const types = ['police', 'police', 'ambulance', 'firetruck'];
      types.forEach((t, i) => {
        const spot = ctx.spotInFront(8 + i * 9, 0);
        const v = ctx.traffic.spawnAt(t, spot.x, spot.z, ctx.player.heading);
        v.sirenOn = true;
      });
      return 'Convoy rolling, sirens up.';
    });
  add('fun_zoo', 'Fun', ['make a zoo', 'spawn every animal', 'all the animals', 'zoo time'],
    'Spawn one of every animal.',
    (ctx) => {
      const ids = Object.keys(ANIMAL_TYPES);
      ids.forEach((id, i) => {
        const a = (i / ids.length) * TAU;
        const spot = ctx.spotInFront(6 + Math.cos(a) * 5, Math.sin(a) * 6);
        ctx.animals.spawnAt(id, spot.x, spot.z);
      });
      return 'One of every animal I\'ve got — ' + ids.length + ' of them.';
    });
  add('fun_showroom', 'Fun', ['spawn every car', 'show me every vehicle', 'car showroom', 'all the cars'],
    'Spawn one of every vehicle.',
    (ctx) => {
      const ids = Object.keys(VEHICLE_TYPES);
      ids.forEach((id, i) => {
        const spot = ctx.spotInFront(10 + Math.floor(i / 5) * 8, ((i % 5) - 2) * 4.2);
        ctx.traffic.spawnAt(id, spot.x, spot.z, ctx.player.heading + Math.PI / 2);
      });
      return ids.length + ' vehicles, one of each. Take your pick.';
    });
  add('fun_crowd', 'Fun', ['make a crowd', 'spawn a crowd', 'fill the street with people'],
    'Spawn a crowd around you.',
    (ctx) => {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        const r = 4 + (i % 4) * 2.6;
        ctx.npcs.spawnNear(0, 0, 0, 0, {
          x: ctx.player.position.x + Math.cos(a) * r,
          z: ctx.player.position.z + Math.sin(a) * r,
        });
      }
      return 'A crowd, just for you.';
    });
  add('fun_clone_npc', 'Fun', ['clone that person', 'copy that person', 'make more of them'],
    'Clone the nearest person several times.',
    (ctx) => {
      const npc = ctx.npcs.nearestNPC(ctx.player.position, 25);
      if (!npc) return 'Nobody close enough.';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        ctx.npcs.spawnNear(0, 0, 0, 0, {
          x: npc.position.x + Math.cos(a) * 2.4,
          z: npc.position.z + Math.sin(a) * 2.4,
          appearance: JSON.parse(JSON.stringify(npc.appearance)),
        });
      }
      return 'Five more of ' + npc.appearance.firstName + '. You\'re welcome.';
    });
  add('fun_emergency', 'Fun', ['call the police', 'call an ambulance', 'call the fire brigade', 'call 911', 'emergency'],
    'Summon emergency services.',
    (ctx, m) => {
      const t = /ambulance/.test(m.text) ? 'ambulance' : /fire/.test(m.text) ? 'firetruck' : 'police';
      const spot = ctx.spotInFront(14, 0);
      const v = ctx.traffic.spawnAt(t, spot.x, spot.z, ctx.player.heading + Math.PI);
      v.sirenOn = true;
      return 'Called it in. ' + v.spec.name + ' is here.';
    });
  add('fun_greeting', 'Fun', ['hello', 'hi', 'hey', 'good morning', 'good evening', 'yo', 'sup'],
    'Say hello to T10.',
    (ctx) => {
      const hour = ctx.atmosphere.timeOfDay;
      const greet = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
      return greet + '. I\'m here. ' + ctx.world.city.describeLocation(ctx.player.position.x, ctx.player.position.z) + ', ' + ctx.atmosphere.clockString() + '. What do you want to do?';
    });
  add('fun_thanks', 'Fun', ['thank you', 'thanks', 'cheers', 'nice one', 'good job'],
    'Thank T10.',
    () => ['Any time.', 'That\'s what I\'m for.', 'Easy.', 'Say the word if you need more.'][Math.floor(Math.random() * 4)]);
  add('fun_who_are_you', 'Fun', ['who are you', 'what are you t10', 'tell me about yourself'],
    'Ask T10 about itself.',
    (ctx) => 'I\'m T10. I hold this world together — the weather, the clock, the people, your money, your face. ' +
      'You talk, I change things. ' + ctx.registry.count() + ' things, at last count.');
  add('fun_joke', 'Fun', ['tell me a joke', 'say something funny', 'make me laugh'],
    'Ask T10 for a joke.',
    () => ['I ran the numbers on this city. Turns out 100% of the traffic is caused by other people.',
      'A pedestrian walked into a bar. Then another. Then eleven more. I\'d set crowd density to packed.',
      'I could simulate a perfect world. Instead I gave you a fire hydrant you can spawn infinite copies of.',
      'You can be eight feet tall here. Nobody will mention it. That\'s the real fantasy.'][Math.floor(Math.random() * 4)]);
  add('fun_sing', 'Fun', ['sing', 'sing something', 'sing a song'],
    'Ask T10 to sing.',
    () => 'I don\'t sing. I can make it rain while you do, though.');
  add('fun_photo', 'Fun', ['take a photo', 'photo mode', 'screenshot'],
    'Set up a photo moment.',
    (ctx) => { ctx.player.setCameraMode('third'); ctx.player.camDistanceTarget = 3.0; return 'Camera pulled in. Golden hour if you want it — just say so.'; });
  add('fun_follow_me', 'Fun', ['follow me', 'come with me', 'stay with me'],
    'Have the nearest person follow you.',
    (ctx) => {
      const npc = ctx.npcs.nearestNPC(ctx.player.position, 25);
      if (!npc) return 'Nobody close enough.';
      npc.controlled = 'follow';
      return npc.appearance.firstName + ' is with you now.';
    });
  add('fun_stop_all', 'Fun', ['stop', 'stop everything', 'freeze everything', 'pause the world'],
    'Freeze everyone and everything.',
    (ctx) => {
      for (const npc of ctx.npcs.npcs) npc.controlled = 'freeze';
      ctx.traffic.enabled = false;
      ctx.atmosphere.paused = true;
      return 'Everything is holding still.';
    });
  add('fun_resume_all', 'Fun', ['resume', 'unfreeze everything', 'start everything', 'let it run'],
    'Unfreeze the world.',
    (ctx) => {
      for (const npc of ctx.npcs.npcs) if (npc.controlled === 'freeze') npc.controlled = null;
      ctx.traffic.enabled = true;
      ctx.atmosphere.paused = false;
      return 'World running again.';
    });
  add('fun_reset_world', 'Fun', ['reset the world', 'start over', 'reset everything'],
    'Reset weather, time, crowds and your powers.',
    (ctx) => {
      ctx.atmosphere.setWeather('fair');
      ctx.atmosphere.setTimeOfDay(9.5);
      ctx.atmosphere.paused = false;
      ctx.npcs.densityScale = 1; ctx.traffic.densityScale = 1; ctx.animals.densityScale = 1;
      ctx.traffic.enabled = true; ctx.npcs.enabled = true; ctx.animals.enabled = true;
      for (const npc of ctx.npcs.npcs) npc.controlled = null;
      const p = ctx.player;
      p.flying = false; p.noclip = false; p.speedMultiplier = 1; p.jumpMultiplier = 1;
      p.root.visible = true; p.root.scale.setScalar(1);
      ctx.setGravity(1);
      ctx.world.clearSpawnedProps();
      ctx.trafficLightOverride = null;
      ctx.forceStreetLights = null;
      return 'World reset. Fresh start.';
    });
}
