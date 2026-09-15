// T10 World - command registry, part three. Per-landmark travel, per-person
// styling, bulk removal, weather dials and the rest of the long tail.
import * as THREE from '../../vendor/three.module.js';
import { HAIR_COLORS, SKIN_TONES, EYE_COLORS } from '../human/textures.js';
import { HAIR_STYLES } from '../human/hair.js';
import { OUTFITS } from '../human/clothing.js';
import { PERSONALITIES, OCCUPATIONS, generateAppearance } from '../human/appearance.js';
import { ANIMAL_TYPES } from '../entities/animals.js';
import { VEHICLE_TYPES } from '../entities/vehicle.js';
import { DISTRICTS } from '../world/city.js';
import { WEATHER_PRESETS } from '../render/atmosphere.js';
import { TREE_KINDS } from '../world/props.js';
import { STATES } from '../human/animator.js';
import { settings, QUALITY_PRESETS } from '../core/settings.js';
import { clamp01, clampv, lerpv, plural, feetInchesToMeters, metersToFeetInches, TAU } from '../core/math.js';
import { audio } from '../core/audio.js';

/** Landmarks are fixed in the city plan, so they can each get their own command. */
const LANDMARK_NAMES = [
  'T10 Tower', 'City Hospital', 'Central Police Dept', 'Fire Station 7', 'Northside High',
  'Riverside Elementary', 'Grand Central Mall', 'Union Station', 'Harbour Stadium',
  'Westfield Power Plant', 'Municipal Library', 'The Old Church',
  'Fuel Stop North', 'Fuel Stop East', 'Fuel Stop South', 'Harbour Diner', 'Corner Coffee',
  'Late Night Mart', 'Sunset Bar', 'Eastside Gym', 'Pier Arcade',
  'Central Park', 'Riverside Green', 'Hillcrest Park', 'Memorial Square', 'Dog Run',
];

const LANDMARK_BLURBS = {
  'T10 Tower': 'The tallest thing in the city. 148 metres. My name is on it.',
  'City Hospital': 'Emergency department, ninety beds, always busy.',
  'Central Police Dept': 'Precinct headquarters. Cruisers in and out all night.',
  'Fire Station 7': 'Two engine bays, doors usually open.',
  'Northside High': 'School and sports field on the north side.',
  'Riverside Elementary': 'Smaller school on the east edge.',
  'Grand Central Mall': 'Glass atrium, big car park, everything under one roof.',
  'Union Station': 'The old transit hall. Colonnade out front.',
  'Harbour Stadium': 'Floodlit bowl out east. Visible from most of the city at night.',
  'Westfield Power Plant': 'Keeps the lights on. Industrial zone, west side.',
  'Municipal Library': 'Quiet, columns, good steps to sit on.',
  'The Old Church': 'Stone steeple in the residential streets. Oldest thing standing.',
  'Fuel Stop North': 'Petrol, canopy lights, open all hours.',
  'Fuel Stop East': 'Petrol, canopy lights, open all hours.',
  'Fuel Stop South': 'Petrol, canopy lights, open all hours.',
  'Harbour Diner': 'Near the water. Neon out front.',
  'Corner Coffee': 'Small place downtown. Good windows.',
  'Late Night Mart': 'Open when nothing else is.',
  'Sunset Bar': 'West side. Gets busy after dark.',
  'Eastside Gym': 'Weights and treadmills. People actually use it.',
  'Pier Arcade': 'Down by the beach. Loud.',
  'Central Park': 'The big one. Fountain, playground, basketball court.',
  'Riverside Green': 'Long strip of grass near the shore.',
  'Hillcrest Park': 'Narrow park up the east side.',
  'Memorial Square': 'Small square with a fountain, right in the middle of things.',
  'Dog Run': 'Fenced green out west. The dogs know it.',
};

export function extendRegistry3(R, add) {
  // ===== Per-landmark travel and lore ======================================
  for (const name of LANDMARK_NAMES) {
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const short = name.toLowerCase();
    add('goto_lm_' + key, 'Travel',
      ['take me to ' + short, 'take me to the ' + short, 'go to ' + short, 'go to the ' + short,
       'teleport me to ' + short, 'bring me to ' + short, 'drop me at ' + short],
      'Travel to ' + name + '.',
      (ctx) => {
        const lm = ctx.world.city.findLandmark(name);
        if (!lm) return 'I can\'t place that one.';
        const spot = ctx.world.city.nearestSidewalk(lm.x, lm.z + 24);
        ctx.player.teleport(spot.x, spot.z);
        ctx.pop();
        return 'You\'re outside ' + name + '.';
      });
    add('about_lm_' + key, 'Questions',
      ['what is ' + short, 'what is the ' + short, 'tell me about ' + short, 'tell me about the ' + short,
       'whats ' + short, 'whats the ' + short, 'describe ' + short, 'describe the ' + short],
      'Ask about ' + name + '.',
      (ctx) => {
        const lm = ctx.world.city.findLandmark(name);
        const blurb = LANDMARK_BLURBS[name] || '';
        if (!lm) return blurb || 'I don\'t have anything on that.';
        const d = Math.round(Math.hypot(lm.x - ctx.player.position.x, lm.z - ctx.player.position.z));
        return name + '. ' + blurb + ' It\'s ' + d + ' metres from you, in ' + ctx.world.city.districtName(lm.x, lm.z) + '.';
      });
  }

  // ===== Per-district lore =================================================
  for (const [k, d] of Object.entries(DISTRICTS)) {
    const n = d.name.toLowerCase();
    add('about_district_' + k, 'Questions',
      ['what is ' + n, 'tell me about ' + n, 'whats ' + n + ' like', 'describe ' + n],
      'Ask about ' + d.name + '.',
      (ctx) => {
        const count = ctx.world.city.lots.filter((l) => l.district === k).length;
        const heights = d.maxH > 0 ? ' Buildings run ' + d.minH + ' to ' + d.maxH + ' metres.' : '';
        return d.name + '. ' + count + ' buildings.' + heights + ' Say "T10 take me to ' + n + '" to go.';
      });
  }

  // ===== Styling the nearest person ========================================
  const withNearest = (ctx, fn, missing) => {
    const npc = ctx.npcs.nearestNPC(ctx.player.position, 28);
    if (!npc) return missing || 'Nobody close enough.';
    return fn(npc);
  };
  for (const c of HAIR_COLORS) {
    const w = c.name.toLowerCase();
    add('npc_hair_' + w.replace(/\s+/g, '_'), 'Crowd',
      ['make their hair ' + w, 'give them ' + w + ' hair', 'dye their hair ' + w, 'make that person have ' + w + ' hair'],
      'Give the nearest person ' + w + ' hair.',
      (ctx) => withNearest(ctx, (npc) => {
        npc.human.setHairColor(c.hex);
        return npc.appearance.firstName + ' now has ' + w + ' hair.';
      }));
  }
  SKIN_TONES.forEach((t, i) => {
    const w = t.name.toLowerCase();
    add('npc_skin_' + w.replace(/\s+/g, '_'), 'Crowd',
      ['make their skin ' + w, 'give them ' + w + ' skin', 'make that person ' + w + ' skinned'],
      'Set the nearest person\'s skin tone to ' + w + '.',
      (ctx) => withNearest(ctx, (npc) => {
        npc.human.setSkinTone(i);
        return npc.appearance.firstName + ': ' + t.name + '.';
      }));
    add('crowd_skin_' + w.replace(/\s+/g, '_'), 'Crowd',
      ['make everyone ' + w + ' skinned', 'give everyone ' + w + ' skin'],
      'Set everyone nearby to ' + w + ' skin.',
      (ctx) => {
        const n = ctx.npcs.forEachNear(ctx.player.position, 50, (npc) => npc.human.setSkinTone(i));
        return n ? n + ' people changed.' : 'Nobody close enough.';
      });
  });
  for (const e of EYE_COLORS) {
    const w = e.name.toLowerCase();
    add('crowd_eyes_' + w.replace(/\s+/g, '_'), 'Crowd',
      ['give everyone ' + w + ' eyes', 'make everyones eyes ' + w],
      'Give everyone nearby ' + w + ' eyes.',
      (ctx) => {
        const n = ctx.npcs.forEachNear(ctx.player.position, 50, (npc) => npc.human.setEyeColor(e.hex));
        return n ? n + ' pairs of ' + w + ' eyes.' : 'Nobody close enough.';
      });
  }
  for (const s of HAIR_STYLES) {
    add('crowd_hairstyle_' + s.id, 'Crowd',
      ['give everyone ' + s.name.toLowerCase() + ' hair', 'make everyones hair ' + s.name.toLowerCase()],
      'Give everyone nearby ' + s.name + ' hair.',
      (ctx) => {
        const n = ctx.npcs.forEachNear(ctx.player.position, 50, (npc) => npc.human.setHairStyle(s.id));
        return n ? n + ' new haircuts.' : 'Nobody close enough.';
      });
  }
  for (const gender of ['male', 'female']) {
    OUTFITS[gender].forEach((o, i) => {
      add('npc_outfit_' + o.id, 'Crowd',
        ['put them in the ' + o.name.toLowerCase(), 'make them wear the ' + o.name.toLowerCase()],
        'Put the nearest person in the ' + o.name + '.',
        (ctx) => withNearest(ctx, (npc) => {
          if (npc.appearance.gender !== gender) return npc.appearance.firstName + ' wouldn\'t wear that one.';
          npc.human.setOutfit(i);
          return npc.appearance.firstName + ' is wearing the ' + o.name + '.';
        }));
    });
  }
  for (const p of PERSONALITIES) {
    add('crowd_personality_' + p.id, 'Crowd',
      ['make everyone ' + p.name.toLowerCase(), 'everyone should be ' + p.name.toLowerCase()],
      'Make everyone nearby ' + p.name + '.',
      (ctx) => {
        const n = ctx.npcs.forEachNear(ctx.player.position, 60, (npc) => {
          Object.assign(npc.appearance, {
            personality: p.id, personalityName: p.name, social: p.social,
            energyTrait: p.energy, patience: p.patience, curiosity: p.curiosity,
          });
        });
        return n ? n + ' people are ' + p.name + ' now. ' + p.blurb : 'Nobody close enough.';
      });
  }

  // ===== Emotes aimed at one person ========================================
  const PERSON_EMOTES = [
    ['wave', STATES.WAVE], ['dance', STATES.DANCE], ['sit down', STATES.SIT], ['stand up', STATES.IDLE],
    ['lie down', STATES.LIE], ['crouch', STATES.CROUCH], ['check their phone', STATES.PHONE],
    ['eat', STATES.EAT], ['do push ups', STATES.EXERCISE], ['salute', STATES.SALUTE],
    ['clap', STATES.CLAP], ['point', STATES.POINT], ['cheer', STATES.CHEER],
    ['think', STATES.THINK], ['stretch', STATES.STRETCH], ['bow', STATES.BOW],
  ];
  for (const [phrase, state] of PERSON_EMOTES) {
    const key = phrase.replace(/\s+/g, '_');
    add('npc_emote_' + key, 'Crowd',
      ['make them ' + phrase, 'tell them to ' + phrase, 'make that person ' + phrase],
      'Make the nearest person ' + phrase + '.',
      (ctx) => withNearest(ctx, (npc) => {
        npc.controlled = state === STATES.DANCE ? 'dance' : null;
        npc.setState(state);
        npc.activityTimer = 30;
        return npc.appearance.firstName + ' does it.';
      }));
  }
  // The new poses also apply to you and to everyone.
  const NEW_EMOTES = [
    ['salute', STATES.SALUTE], ['clap', STATES.CLAP], ['point', STATES.POINT],
    ['cheer', STATES.CHEER], ['think', STATES.THINK], ['stretch', STATES.STRETCH], ['bow', STATES.BOW],
  ];
  for (const [phrase, state] of NEW_EMOTES) {
    add('emote_self_' + phrase, 'Actions',
      ['make me ' + phrase, 'let me ' + phrase, phrase, 'i want to ' + phrase],
      'Make your character ' + phrase + '.',
      (ctx) => { ctx.player.human.animator.setState(state); return 'Doing it.'; });
    add('emote_crowd_' + phrase, 'Crowd',
      ['make everyone ' + phrase, 'everyone ' + phrase, 'tell everyone to ' + phrase],
      'Make everyone nearby ' + phrase + '.',
      (ctx) => {
        const n = ctx.npcs.forEachNear(ctx.player.position, 60, (npc) => { npc.setState(state); npc.activityTimer = 25; });
        return n ? n + ' people doing it.' : 'Nobody close enough.';
      });
  }

  // ===== Bulk removal by type ==============================================
  for (const [id, spec] of Object.entries(ANIMAL_TYPES)) {
    const n = spec.name.toLowerCase();
    add('remove_animals_' + id, 'Animals',
      ['remove all the ' + plural(n, 2), 'delete all ' + plural(n, 2), 'get rid of the ' + plural(n, 2)],
      'Remove every ' + n + '.',
      (ctx) => {
        let c = 0;
        for (const a of [...ctx.animals.animals]) if (a.typeId === id) { ctx.animals.remove(a); c++; }
        return c ? 'Removed ' + c + ' ' + plural(n, c) + '.' : 'No ' + plural(n, 2) + ' around.';
      });
  }
  for (const [id, spec] of Object.entries(VEHICLE_TYPES)) {
    const n = spec.name.toLowerCase();
    add('remove_vehicles_' + id, 'Vehicles',
      ['remove all the ' + plural(n, 2), 'delete all ' + plural(n, 2), 'get rid of the ' + plural(n, 2)],
      'Remove every ' + spec.name + '.',
      (ctx) => {
        let c = 0;
        for (const v of [...ctx.traffic.vehicles]) {
          if (v.typeId === id && !v.isPlayerVehicle) { ctx.traffic.remove(v); c++; }
        }
        return c ? 'Removed ' + c + ' ' + plural(n, c) + '.' : 'None of those around.';
      });
  }

  // ===== Remaining occupations =============================================
  for (const job of OCCUPATIONS.slice(16)) {
    add('spawn_job2_' + job.replace(/\s+/g, '_'), 'Crowd',
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

  // ===== Tree species ======================================================
  TREE_KINDS.forEach((t, i) => {
    add('spawn_tree_' + t.id, 'Spawning',
      ['spawn a ' + t.id + ' tree', 'plant a ' + t.id, 'give me a ' + t.id + ' tree', 'plant a ' + t.id + ' tree'],
      'Plant a ' + t.id + ' tree.',
      (ctx, m) => {
        const count = clampv(m.number || 1, 1, 20);
        for (let k = 0; k < count; k++) {
          const spot = ctx.spotInFront(3 + k * 2.4, ((k % 3) - 1) * 2.6);
          ctx.world.spawnProp('tree', spot.x, spot.z, { treeKind: i });
        }
        ctx.pop();
        return count === 1 ? 'One ' + t.id + ', planted.' : count + ' ' + plural(t.id, count) + ' planted.';
      });
  });

  // ===== Painting spawned props ============================================
  const PAINTS = {
    red: 0xc0392b, blue: 0x2f5aa0, green: 0x3f7a52, yellow: 0xf0c040, orange: 0xe8621f,
    purple: 0x6c3d7a, pink: 0xd9548a, black: 0x1a1b1d, white: 0xe8e6e0, grey: 0x7a8085,
    silver: 0xc2c6cb, gold: 0xd8a020, brown: 0x6d4326, teal: 0x1f6a6a, navy: 0x1b2a4a,
    cyan: 0x3ba9a0, lime: 0x7ac043, maroon: 0x6a2020, beige: 0xd8cdbc, gray: 0x7a8085,
  };
  for (const [word, hex] of Object.entries(PAINTS)) {
    add('paint_prop_' + word, 'Spawning',
      ['paint it ' + word, 'make it ' + word + ' coloured', 'paint that ' + word],
      'Repaint the nearest thing you spawned ' + word + '.',
      (ctx) => {
        let best = null, bd = 16;
        for (const rec of ctx.world.spawnedProps) {
          const d = Math.hypot(rec.x - ctx.player.position.x, rec.z - ctx.player.position.z);
          if (d < bd) { bd = d; best = rec; }
        }
        if (!best) return 'Nothing of mine nearby to paint.';
        best.group.traverse((o) => {
          if (o.isMesh && o.material && o.material.color && !o.material.emissiveMap) {
            o.material = o.material.clone();
            o.material.color.setHex(hex);
          }
        });
        return 'Painted the ' + best.kind + ' ' + word + '.';
      });
  }

  // ===== Weather dials =====================================================
  const RAIN_LEVELS = [['light rain', 0.25], ['steady rain', 0.6], ['heavy rain', 1.0]];
  for (const [name, amt] of RAIN_LEVELS) {
    add('rain_' + name.replace(/\s+/g, '_'), 'Weather',
      ['give me ' + name, 'make it ' + name, 'i want ' + name],
      'Set rainfall: ' + name + '.',
      (ctx) => { ctx.atmosphere.target.rain = amt; ctx.atmosphere.target.cloud = Math.max(0.7, amt); return name.charAt(0).toUpperCase() + name.slice(1) + ' incoming.'; });
  }
  const WIND_LEVELS = [['calm', 0.05], ['a breeze', 0.3], ['strong wind', 0.7], ['a gale', 1.0]];
  for (const [name, amt] of WIND_LEVELS) {
    add('wind_' + name.replace(/\s+/g, '_'), 'Weather',
      ['give me ' + name, 'make it ' + name, 'i want ' + name],
      'Set wind: ' + name + '.',
      (ctx) => { ctx.atmosphere.target.wind = amt; return 'Wind set to ' + name + '.'; });
  }
  const FOG_LEVELS = [['no fog', 0], ['light fog', 0.3], ['thick fog', 0.85]];
  for (const [name, amt] of FOG_LEVELS) {
    add('fog_' + name.replace(/\s+/g, '_'), 'Weather',
      ['give me ' + name, 'make it ' + name, 'i want ' + name],
      'Set fog: ' + name + '.',
      (ctx) => { ctx.atmosphere.target.fog = amt; return name.charAt(0).toUpperCase() + name.slice(1) + '.'; });
  }
  const CLOUD_LEVELS = [['no clouds', 0.02], ['a few clouds', 0.3], ['lots of clouds', 0.7], ['total cloud cover', 1.0]];
  for (const [name, amt] of CLOUD_LEVELS) {
    add('cloud_' + name.replace(/\s+/g, '_'), 'Weather',
      ['give me ' + name, 'make it ' + name, 'i want ' + name],
      'Set cloud cover: ' + name + '.',
      (ctx) => { ctx.atmosphere.target.cloud = amt; return name.charAt(0).toUpperCase() + name.slice(1) + '.'; });
  }
  add('q_is_raining', 'Weather', ['is it raining', 'is it going to rain', 'will it rain'],
    'Ask whether it is raining.',
    (ctx) => {
      const r = ctx.atmosphere.current.rain;
      if (r > 0.6) return 'It\'s pouring.';
      if (r > 0.2) return 'Light rain, yes.';
      return 'Not raining. ' + ctx.atmosphere.weatherName() + '.';
    });
  add('q_wind', 'Weather', ['how windy is it', 'is it windy', 'whats the wind like'],
    'Ask about the wind.',
    (ctx) => {
      const w = ctx.atmosphere.current.wind;
      return w > 0.7 ? 'Strong wind out there.' : w > 0.35 ? 'A decent breeze.' : 'Barely any wind.';
    });
  add('q_dark', 'Weather', ['is it dark', 'is it night', 'how dark is it'],
    'Ask whether it is dark.',
    (ctx) => {
      const n = ctx.atmosphere.nightFactor;
      return n > 0.8 ? 'Fully dark. Street lights are the only thing going.'
        : n > 0.3 ? 'Getting dark.' : 'Plenty of light. It\'s ' + ctx.atmosphere.clockString() + '.';
    });

  // ===== Animal behaviour ==================================================
  const ANIMAL_ACTIONS = [
    ['follow me', (a) => { a.controlled = 'follow'; }, 'following you'],
    ['stay', (a) => { a.controlled = 'freeze'; }, 'staying put'],
    ['go free', (a) => { a.controlled = null; }, 'free again'],
    ['sleep', (a) => { a.state = 'sleep'; a.stateTimer = 60; a.targetSpeed = 0; a.target = null; }, 'asleep'],
  ];
  for (const [phrase, fn, result] of ANIMAL_ACTIONS) {
    const key = phrase.replace(/\s+/g, '_');
    add('animal_one_' + key, 'Animals',
      ['tell the animal to ' + phrase, 'make the animal ' + phrase, 'animal ' + phrase],
      'Tell the nearest animal to ' + phrase + '.',
      (ctx) => {
        const a = ctx.animals.nearest(ctx.player.position, 30);
        if (!a) return 'No animals nearby.';
        fn(a);
        return 'The ' + a.spec.name.toLowerCase() + ' is ' + result + '.';
      });
    add('animal_all_' + key, 'Animals',
      ['make all the animals ' + phrase, 'tell all the animals to ' + phrase, 'every animal ' + phrase],
      'Tell every animal to ' + phrase + '.',
      (ctx) => {
        let n = 0;
        for (const a of ctx.animals.within(ctx.player.position, 80)) { fn(a); n++; }
        return n ? n + ' animals ' + result + '.' : 'No animals nearby.';
      });
  }
  add('spawn_flock', 'Animals', ['spawn a flock of birds', 'give me a flock', 'flock of birds'],
    'Spawn a flock of birds.',
    (ctx) => {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        const spot = ctx.spotInFront(7 + Math.cos(a) * 4, Math.sin(a) * 4);
        ctx.animals.spawnAt('bird', spot.x, spot.z);
      }
      return 'Nine birds. They\'ll scatter if you get close.';
    });
  add('spawn_herd', 'Animals', ['spawn a herd of cows', 'give me a herd', 'herd of cows'],
    'Spawn a herd of cows.',
    (ctx) => {
      for (let i = 0; i < 6; i++) {
        const spot = ctx.spotInFront(8 + (i % 3) * 4, ((i % 2) ? 1 : -1) * (2 + i));
        ctx.animals.spawnAt('cow', spot.x, spot.z);
      }
      return 'Six cows. Good luck.';
    });
  add('spawn_pack', 'Animals', ['spawn a pack of wolves', 'give me a wolf pack', 'pack of wolves'],
    'Spawn a wolf pack.',
    (ctx) => {
      for (let i = 0; i < 5; i++) {
        const spot = ctx.spotInFront(9 + (i % 3) * 3, ((i % 2) ? 1 : -1) * (2 + i * 0.8));
        ctx.animals.spawnAt('wolf', spot.x, spot.z);
      }
      return 'Five wolves. They keep their distance from people — mostly.';
    });

  // ===== Person queries ====================================================
  add('q_their_name', 'Questions', ['whats their name', 'what is their name', 'who is this person called'],
    'Ask the nearest person\'s name.',
    (ctx) => withNearest(ctx, (npc) => 'That\'s ' + npc.appearance.name + '.'));
  add('q_their_age', 'Questions', ['how old are they', 'whats their age', 'how old is that person'],
    'Ask the nearest person\'s age.',
    (ctx) => withNearest(ctx, (npc) => npc.appearance.firstName + ' is ' + npc.appearance.ageYears + '.'));
  add('q_their_job', 'Questions', ['what do they do', 'whats their job', 'where do they work'],
    'Ask what the nearest person does.',
    (ctx) => withNearest(ctx, (npc) => npc.appearance.firstName + ' works as a ' + npc.appearance.occupation + '. Right now they\'re ' + npc.activity + '.'));
  add('q_their_mood', 'Questions', ['how are they feeling', 'whats their personality', 'what are they like'],
    'Ask about the nearest person\'s personality.',
    (ctx) => withNearest(ctx, (npc) => npc.appearance.firstName + ' is ' + npc.appearance.personalityName + '. ' +
      (PERSONALITIES.find((p) => p.id === npc.appearance.personality) || {}).blurb));

  // ===== Quality sub-settings =============================================
  const SHADOW_LEVELS = [['off', 0], ['low', 512], ['medium', 1024], ['high', 2048], ['ultra', 4096]];
  for (const [name, size] of SHADOW_LEVELS) {
    add('shadow_quality_' + name, 'Graphics',
      ['set shadow quality to ' + name, name + ' shadows', 'shadows ' + name],
      'Shadow quality: ' + name + '.',
      (ctx) => {
        if (!size) { ctx.setShadows(false); return 'Shadows off.'; }
        ctx.setShadows(true);
        const s = ctx.atmosphere.sun.shadow;
        s.mapSize.set(size, size);
        if (s.map) { s.map.dispose(); s.map = null; }
        return 'Shadow quality: ' + name + ' (' + size + 'px).';
      });
  }
  const RES_LEVELS = [['half', 0.5], ['low', 0.7], ['normal', 1.0]];
  for (const [name, scale] of RES_LEVELS) {
    add('render_scale_' + name, 'Graphics',
      ['set resolution to ' + name, name + ' resolution', 'render at ' + name],
      'Render resolution: ' + name + '.',
      (ctx) => {
        ctx.game.governor.enabled = false;
        ctx.game.governor.scale = scale;
        ctx.game.onResize();
        return 'Rendering at ' + Math.round(scale * 100) + '%.';
      });
  }
  add('auto_resolution_on', 'Graphics', ['turn on adaptive resolution', 'enable auto resolution', 'auto quality on'],
    'Let the game scale resolution to hold framerate.',
    (ctx) => { ctx.game.governor.enabled = true; return 'Adaptive resolution on. I\'ll hold your framerate.'; });
  add('auto_resolution_off', 'Graphics', ['turn off adaptive resolution', 'disable auto resolution', 'auto quality off'],
    'Lock the render resolution.',
    (ctx) => { ctx.game.governor.enabled = false; return 'Locked at the current resolution.'; });

  // ===== Time extras =======================================================
  add('time_exact', 'Time', ['set the time to exactly', 'set the clock to'],
    'Set the clock to an exact time, e.g. "T10 set the clock to 6:45".',
    (ctx, m) => {
      const hm = m.text.match(/(\d{1,2})[:.](\d{2})/);
      if (hm) {
        ctx.atmosphere.setTimeOfDay(parseInt(hm[1], 10) + parseInt(hm[2], 10) / 60);
        return 'Time set to ' + ctx.atmosphere.clockString() + '.';
      }
      if (m.number != null) { ctx.atmosphere.setTimeOfDay(m.number); return 'Time set to ' + ctx.atmosphere.clockString() + '.'; }
      return 'Give me a time — "T10 set the clock to 6:45".';
    });
  add('time_next_day', 'Time', ['skip to tomorrow', 'next day', 'skip a day'],
    'Jump forward one day.',
    (ctx) => { ctx.atmosphere.day++; ctx.atmosphere.setTimeOfDay(7); return 'Day ' + ctx.atmosphere.day + ', ' + ctx.atmosphere.clockString() + '.'; });
  add('time_prev_day', 'Time', ['go back a day', 'previous day', 'yesterday'],
    'Jump back one day.',
    (ctx) => { ctx.atmosphere.day = Math.max(1, ctx.atmosphere.day - 1); return 'Day ' + ctx.atmosphere.day + '.'; });
  add('time_skip_hours', 'Time', ['skip forward', 'fast forward', 'skip ahead'],
    'Skip forward a number of hours.',
    (ctx, m) => {
      const h = m.number || 1;
      ctx.atmosphere.setTimeOfDay(ctx.atmosphere.timeOfDay + h);
      return 'Skipped ' + h + ' hour' + (h === 1 ? '' : 's') + '. It\'s ' + ctx.atmosphere.clockString() + '.';
    });

  // ===== Height in centimetres ============================================
  add('height_cm', 'Body', ['make me centimetres tall', 'set my height in cm', 'make my height cm'],
    'Set your height in centimetres.',
    (ctx, m) => {
      if (m.number == null) return 'Give me a number — "T10 set my height to 183 cm".';
      const meters = m.number > 3 ? m.number / 100 : m.number;
      const r = ctx.player.appearance.gender === 'female'
        ? { min: 1.3462, max: 1.8796 } : { min: 1.5494, max: 2.4384 };
      const h = clampv(meters, r.min, r.max);
      ctx.player.human.setHeight(h);
      ctx.player.rebuildAppearance();
      return 'You\'re ' + Math.round(h * 100) + 'cm — ' + metersToFeetInches(h) + '.';
    });

  // ===== More conversation =================================================
  const CHATTER = [
    [['how are you', 'you alright', 'hows it going'], () => 'Running fine. Every system in this city is where I left it.'],
    [['are you real', 'are you alive', 'are you an ai'], () => 'I\'m the thing that changes the weather when you ask. Call it what you like.'],
    [['what should i do', 'im bored', 'give me something to do', 'any ideas'],
      (ctx) => {
        const ideas = [
          'Go up. Say "T10 put me on a roof" and look at the skyline.',
          'It\'s ' + ctx.atmosphere.clockString() + '. Try "T10 make it sunset" and walk to the beach.',
          'Ask me for a sports car and find out how the highway ring feels.',
          'Say "T10 make everyone dance" and stand in the middle of it.',
          'Head to ' + (ctx.world.city.landmarks[Math.floor(Math.random() * 12)] || {}).name + '. Just to see it.',
        ];
        return ideas[Math.floor(Math.random() * ideas.length)];
      }],
    [['i love you', 'youre the best', 'good bot'], () => 'Noted. Ask me for something.'],
    [['shut up', 'stop talking to me'], () => 'Fine. I\'ll be here.'],
    [['where did everyone go', 'why is it empty'], (ctx) => ctx.npcs.count() + ' people are loaded around you. Say "T10 make the streets packed" if you want more.'],
    [['why is it so dark'], (ctx) => 'It\'s ' + ctx.atmosphere.clockString() + '. Say "T10 make it noon" if you want the sun back.'],
    [['how do i drive', 'how do i get in a car'], () => 'Stand next to one and press F, or tap the use button. Say "T10 give me a sports car" if there isn\'t one.'],
    [['how do i change my clothes'], () => 'Say "T10 I wanna wear something new". Three outfits per body, and I\'ll cycle them.'],
    [['can i die', 'is there health'], () => 'No health bar, no death. Nothing in this city is trying to end you.'],
    [['is there a story', 'what is the goal', 'what am i supposed to do'],
      () => 'There isn\'t one. That\'s the whole idea. The city runs whether you do anything or not.'],
    [['who made this', 'what is t10 world'], () => 'T10 World. A city, a clock, some weather, and me.'],
  ];
  CHATTER.forEach(([patterns, fn], i) => {
    add('chat_' + i, 'Fun', patterns, 'Talk to T10 about ' + patterns[0] + '.', fn);
  });
}
