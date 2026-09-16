// T10 World - the T10 assistant's command registry.
// Every entry here is a real, executable command with its own trigger phrases.
// Families are generated so that colours, heights, hours, landmarks and object
// types each become their own addressable command rather than one vague catch-all.
import * as THREE from '../../vendor/three.module.js';
import { HAIR_COLORS, SKIN_TONES, EYE_COLORS } from '../human/textures.js';
import { HAIR_STYLES } from '../human/hair.js';
import { OUTFITS } from '../human/clothing.js';
import { HEIGHT_RANGE } from '../human/skeleton.js';
import { PERSONALITIES, OCCUPATIONS, generateAppearance } from '../human/appearance.js';
import { VEHICLE_TYPES, CIVILIAN_TYPES, EMERGENCY_TYPES } from '../entities/vehicle.js';
import { ANIMAL_TYPES } from '../entities/animals.js';
import { WEATHER_PRESETS } from '../render/atmosphere.js';
import { DISTRICTS } from '../world/city.js';
import { QUALITY_PRESETS, QUALITY_ORDER, settings } from '../core/settings.js';
import { STATES } from '../human/animator.js';
import { clamp01, clampv, lerpv, plural, metersToFeetInches, feetInchesToMeters, TAU } from '../core/math.js';
import { EMOTES } from './emotes.js';
import { extendRegistry } from './commands2.js';
import { extendRegistry3 } from './commands3.js';
import { extendRegistry4 } from './commands4.js';
import { extendRegistry5 } from './commands5.js';
import { extendRegistry6 } from './commands6.js';

function singularWord(word) {
  if (word.length < 4) return word;
  if (/(ss|us|is)$/.test(word)) return word;
  if (/ies$/.test(word)) return word.slice(0, -3) + 'y';
  if (/(ch|sh|x|s|z)es$/.test(word)) return word.slice(0, -2);
  if (/s$/.test(word)) return word.slice(0, -1);
  return word;
}

export const SPAWNABLE_PROPS = [
  { id: 'bench', names: ['bench', 'park bench', 'seat'] },
  { id: 'tree', names: ['tree'] },
  { id: 'streetlight', names: ['street light', 'streetlight', 'lamp post', 'lamppost'] },
  { id: 'bin', names: ['bin', 'trash can', 'trashcan', 'garbage can'] },
  { id: 'hydrant', names: ['hydrant', 'fire hydrant'] },
  { id: 'atm', names: ['atm', 'cash machine'] },
  { id: 'fountain', names: ['fountain'] },
  { id: 'table', names: ['picnic table', 'table'] },
  { id: 'playground', names: ['playground', 'play park'] },
  { id: 'court', names: ['basketball court', 'court', 'hoop'] },
  { id: 'rock', names: ['rock', 'boulder', 'stone'] },
  { id: 'busstop', names: ['bus stop', 'busstop'] },
  { id: 'mailbox', names: ['mailbox', 'post box'] },
  { id: 'planter', names: ['planter', 'flower box'] },
  { id: 'fence', names: ['fence'] },
  { id: 'cone', names: ['cone', 'traffic cone'] },
  { id: 'barrier', names: ['barrier', 'road block', 'roadblock'] },
  { id: 'dumpster', names: ['dumpster', 'skip'] },
  { id: 'crate', names: ['crate', 'wooden box'] },
  { id: 'barrel', names: ['barrel', 'drum'] },
  { id: 'pallet', names: ['pallet'] },
  { id: 'bollard', names: ['bollard', 'post'] },
  { id: 'statue', names: ['statue', 'monument'] },
  { id: 'flagpole', names: ['flagpole', 'flag'] },
  { id: 'vending', names: ['vending machine', 'vending'] },
  { id: 'newsbox', names: ['newspaper box', 'news box'] },
  { id: 'bikerack', names: ['bike rack', 'bicycle rack'] },
  { id: 'phonebooth', names: ['phone booth', 'payphone', 'phone box'] },
  { id: 'tent', names: ['tent'] },
  { id: 'campfire', names: ['campfire', 'bonfire', 'fire pit'] },
  { id: 'umbrella', names: ['umbrella', 'parasol'] },
  { id: 'ladder', names: ['ladder'] },
  { id: 'generator', names: ['generator'] },
  { id: 'dish', names: ['satellite dish', 'dish'] },
  { id: 'sign', names: ['street sign', 'sign'] },
  { id: 'pottedtree', names: ['potted tree', 'potted plant', 'plant'] },
  { id: 'solarpanel', names: ['solar panel', 'solar'] },
  { id: 'boat', names: ['boat', 'dinghy'] },
];


const COLOR_WORDS = {
  red: 0xc0392b, blue: 0x2f5aa0, green: 0x3f7a52, yellow: 0xf0c040, orange: 0xe8621f,
  purple: 0x6c3d7a, pink: 0xd9548a, black: 0x1a1b1d, white: 0xe8e6e0, grey: 0x7a8085,
  gray: 0x7a8085, silver: 0xc2c6cb, gold: 0xd8a020, brown: 0x6d4326, teal: 0x1f6a6a,
  navy: 0x1b2a4a, cyan: 0x3ba9a0, lime: 0x7ac043, maroon: 0x6a2020, beige: 0xd8cdbc,
};

export class CommandRegistry {
  constructor() {
    this.commands = [];
    this.byId = new Map();
    this.categories = new Map();
  }
  add(def) {
    if (!def.id || this.byId.has(def.id)) def.id = (def.id || 'cmd') + '_' + this.commands.length;
    def.patterns = def.patterns.map((p) => p.toLowerCase());
    def.tokens = def.patterns.map((p) => p.split(/\s+/).filter(Boolean));
    // Pattern tokens are singularised the same way input is, so plural phrasing
    // ("spawn 3 benches") scores against "spawn a bench".
    def.matchTokens = def.tokens.map((list) => list.map(singularWord));
    this.commands.push(def);
    this.byId.set(def.id, def);
    let list = this.categories.get(def.category);
    if (!list) { list = []; this.categories.set(def.category, list); }
    list.push(def);
    return def;
  }
  count() { return this.commands.length; }
  categoryNames() { return [...this.categories.keys()]; }
  inCategory(c) { return this.categories.get(c) || []; }
}

// ---------------------------------------------------------------------------
// Registry construction
// ---------------------------------------------------------------------------

export function buildRegistry() {
  const R = new CommandRegistry();
  const add = (id, category, patterns, help, run, opts) =>
    R.add(Object.assign({ id, category, patterns, help, run }, opts || {}));

  // ===== 1. Spawning props =================================================
  for (const p of SPAWNABLE_PROPS) {
    const primary = p.names[0];
    add('spawn_' + p.id, 'Spawning',
      p.names.flatMap((n) => [
        'spawn a ' + n, 'spawn ' + n, 'give me a ' + n, 'make a ' + n, 'create a ' + n,
        'put a ' + n + ' here', 'add a ' + n, 'i want a ' + n, 'place a ' + n,
      ]),
      'Spawn a ' + primary + ' in front of you.',
      (ctx, m) => {
        const n = clampv(m.number || 1, 1, 40);
        const made = [];
        for (let i = 0; i < n; i++) {
          const spot = ctx.spotInFront(2.5 + i * 1.8, i * 0.7);
          const rec = ctx.world.spawnProp(p.id, spot.x, spot.z, { rot: ctx.player.heading + Math.PI, color: m.color });
          if (rec) made.push(rec);
        }
        if (!made.length) return 'I couldn\'t place that here.';
        ctx.pop();
        return made.length === 1 ? 'Done. One ' + primary + ', right in front of you.'
          : 'Done. ' + made.length + ' ' + plural(primary, made.length) + ' placed.';
      });
    add('remove_' + p.id, 'Spawning',
      p.names.flatMap((n) => ['remove the ' + n, 'delete the ' + n, 'remove all ' + plural(n, 2), 'delete all ' + plural(n, 2), 'get rid of the ' + n]),
      'Remove ' + plural(primary, 2) + ' you spawned.',
      (ctx, m) => {
        const all = /all|every/.test(m.text);
        if (all) {
          let n = 0;
          for (const rec of [...ctx.world.spawnedProps]) if (rec.kind === p.id) { ctx.world.removeProp(rec); n++; }
          return n ? 'Removed ' + n + ' ' + plural(primary, n) + '.' : 'There aren\'t any ' + plural(primary, 2) + ' of mine around.';
        }
        let best = null, bd = 20;
        for (const rec of ctx.world.spawnedProps) {
          if (rec.kind !== p.id) continue;
          const d = Math.hypot(rec.x - ctx.player.position.x, rec.z - ctx.player.position.z);
          if (d < bd) { bd = d; best = rec; }
        }
        if (!best) return 'No ' + primary + ' of mine nearby.';
        ctx.world.removeProp(best);
        return 'Gone.';
      });
  }

  // ===== 2. Vehicles =======================================================
  for (const [id, spec] of Object.entries(VEHICLE_TYPES)) {
    const n = spec.name.toLowerCase();
    add('spawn_vehicle_' + id, 'Vehicles',
      [
        'spawn a ' + n, 'give me a ' + n, 'i want a ' + n, 'spawn ' + n,
        'bring me a ' + n, 'make a ' + n, 'i need a ' + n, 'get me a ' + n,
      ],
      'Spawn a ' + spec.name + ' beside you.',
      (ctx, m) => {
        const spot = ctx.spotInFront(spec.l * 0.9 + 2.5, 0);
        const v = ctx.traffic.spawnAt(id, spot.x, spot.z, ctx.player.heading, { color: m.color });
        ctx.pop();
        return 'One ' + spec.name + ', plate ' + v.plate + '. It\'s yours.';
      });
  }
  add('vehicle_enter', 'Vehicles', ['get in the car', 'get in', 'enter the car', 'drive', 'let me drive'],
    'Get into the nearest vehicle.',
    (ctx) => {
      const v = ctx.traffic.nearest(ctx.player.position.x, ctx.player.position.z, 22, (vv) => !vv.isPlayerVehicle);
      if (!v) return 'No car close enough.';
      ctx.player.teleport(v.position.x + 1.5, v.position.z);
      ctx.player.enterVehicle(v, 0);
      return 'You\'re behind the wheel of the ' + v.spec.name + '.';
    });
  add('vehicle_exit', 'Vehicles', ['get out of the car', 'get out', 'exit the car', 'stop driving'],
    'Get out of your vehicle.',
    (ctx) => (ctx.player.inVehicle ? (ctx.player.exitVehicle(), 'Out you get.') : 'You\'re not in a vehicle.'));
  add('vehicle_repair', 'Vehicles', ['repair my car', 'fix my car', 'repair the car', 'fix the car', 'repair this'],
    'Fully repair the vehicle you\'re in or nearest to.',
    (ctx) => {
      const v = ctx.player.inVehicle || ctx.traffic.nearest(ctx.player.position.x, ctx.player.position.z, 20);
      if (!v) return 'No vehicle nearby.';
      v.repair(); v.fuel = 100;
      return 'Good as new. Tank\'s full too.';
    });
  add('vehicle_flip', 'Vehicles', ['flip my car', 'flip the car', 'unflip my car', 'upright the car'],
    'Set the nearest vehicle back on its wheels.',
    (ctx) => {
      const v = ctx.player.inVehicle || ctx.traffic.nearest(ctx.player.position.x, ctx.player.position.z, 20);
      if (!v) return 'No vehicle nearby.';
      v.pitch = 0; v.roll = 0; v.position.y = ctx.world.groundAt(v.position.x, v.position.z) + 0.2;
      return 'Back on its wheels.';
    });
  add('vehicle_delete', 'Vehicles', ['delete my car', 'remove my car', 'get rid of this car', 'delete the car'],
    'Remove the nearest vehicle.',
    (ctx) => {
      const v = ctx.player.inVehicle || ctx.traffic.nearest(ctx.player.position.x, ctx.player.position.z, 20);
      if (!v) return 'No vehicle nearby.';
      if (ctx.player.inVehicle === v) ctx.player.exitVehicle();
      ctx.traffic.remove(v);
      return 'Car removed.';
    });
  add('vehicle_siren', 'Vehicles', ['turn on the siren', 'siren on', 'sirens on', 'turn the siren off', 'siren off'],
    'Toggle emergency sirens.',
    (ctx, m) => {
      const v = ctx.player.inVehicle || ctx.traffic.nearest(ctx.player.position.x, ctx.player.position.z, 20);
      if (!v) return 'No vehicle nearby.';
      if (!v.refs.sirens.length) return 'That vehicle doesn\'t have a siren.';
      v.sirenOn = !/off/.test(m.text);
      return v.sirenOn ? 'Sirens up.' : 'Sirens off.';
    });
  add('vehicle_lights', 'Vehicles', ['turn on the headlights', 'headlights on', 'headlights off', 'lights on', 'lights off'],
    'Toggle vehicle headlights.',
    (ctx, m) => {
      const v = ctx.player.inVehicle || ctx.traffic.nearest(ctx.player.position.x, ctx.player.position.z, 20);
      if (!v) return 'No vehicle nearby.';
      v.autoHeadlights = false;
      v.headlightsOn = !/off/.test(m.text);
      return v.headlightsOn ? 'Headlights on.' : 'Headlights off.';
    });
  add('vehicle_teleport_to_me', 'Vehicles', ['bring my car here', 'bring the car to me', 'summon my car'],
    'Teleport your last vehicle to you.',
    (ctx) => {
      const v = ctx.lastVehicle || ctx.traffic.nearest(ctx.player.position.x, ctx.player.position.z, 400);
      if (!v) return 'You don\'t have a car yet. Ask me for one.';
      const spot = ctx.spotInFront(5, 0);
      v.teleport(spot.x, spot.z, ctx.player.heading);
      return 'It\'s right here.';
    });
  for (const [word, hex] of Object.entries(COLOR_WORDS)) {
    add('vehicle_paint_' + word, 'Vehicles',
      ['paint my car ' + word, 'make my car ' + word, 'paint the car ' + word, 'my car should be ' + word],
      'Paint the nearest vehicle ' + word + '.',
      (ctx) => {
        const v = ctx.player.inVehicle || ctx.traffic.nearest(ctx.player.position.x, ctx.player.position.z, 20);
        if (!v) return 'No vehicle nearby.';
        v.setColor(hex);
        return 'Painted ' + word + '.';
      });
  }
  add('clear_traffic', 'Vehicles', ['clear the traffic', 'remove all cars', 'delete all cars', 'no more traffic'],
    'Remove every AI vehicle.',
    (ctx) => { const n = ctx.traffic.count(); ctx.traffic.clear(ctx.player.inVehicle); return 'Cleared ' + n + ' vehicles.'; });

  // ===== 3. Animals ========================================================
  for (const [id, spec] of Object.entries(ANIMAL_TYPES)) {
    const n = spec.name.toLowerCase();
    add('spawn_animal_' + id, 'Animals',
      ['spawn a ' + n, 'give me a ' + n, 'i want a ' + n, 'spawn ' + plural(n, 2), 'make a ' + n, 'bring me a ' + n],
      'Spawn a ' + spec.name + '.',
      (ctx, m) => {
        const count = clampv(m.number || 1, 1, 25);
        for (let i = 0; i < count; i++) {
          const spot = ctx.spotInFront(3 + i * 1.2, (i % 2 ? 1 : -1) * i * 0.8);
          ctx.animals.spawnAt(id, spot.x, spot.z);
        }
        ctx.pop();
        return count === 1 ? 'One ' + n + ', coming up.' : count + ' ' + plural(n, count) + ' for you.';
      });
  }
  add('animal_follow', 'Animals', ['make the animal follow me', 'tell the dog to follow me', 'animal follow me'],
    'Make the nearest animal follow you.',
    (ctx) => {
      const a = ctx.animals.nearest(ctx.player.position, 25);
      if (!a) return 'No animals nearby.';
      a.controlled = 'follow';
      return 'The ' + a.spec.name.toLowerCase() + ' is following you now.';
    });
  add('animal_free', 'Animals', ['leave me alone animals', 'stop the animals following', 'release the animals'],
    'Stop animals following you.',
    (ctx) => { let n = 0; for (const a of ctx.animals.animals) if (a.controlled) { a.controlled = null; n++; } return n ? 'They\'re on their own again.' : 'None were following you.'; });
  add('clear_animals', 'Animals', ['remove all animals', 'delete all animals', 'clear the animals'],
    'Remove every animal.',
    (ctx) => { const n = ctx.animals.count(); ctx.animals.clear(); return 'Removed ' + n + ' animals.'; });

  // ===== 4. Appearance: hair colour ========================================
  for (const c of HAIR_COLORS) {
    const w = c.name.toLowerCase();
    add('hair_color_' + w.replace(/\s+/g, '_'), 'Appearance',
      ['make my hair ' + w, 'i want ' + w + ' hair', 'dye my hair ' + w, 'my hair should be ' + w, w + ' hair'],
      'Dye your hair ' + w + '.',
      (ctx) => { ctx.player.human.setHairColor(c.hex); ctx.player.appearance.hairColorName = c.name; return w.charAt(0).toUpperCase() + w.slice(1) + ' hair. Suits you.'; });
    add('crowd_hair_' + w.replace(/\s+/g, '_'), 'Crowd',
      ['make everyone have ' + w + ' hair', 'give everyone ' + w + ' hair', 'everyone ' + w + ' hair'],
      'Give everyone nearby ' + w + ' hair.',
      (ctx) => {
        const n = ctx.npcs.forEachNear(ctx.player.position, 60, (npc) => npc.human.setHairColor(c.hex));
        return n ? n + ' people just went ' + w + '.' : 'Nobody close enough.';
      });
  }
  // ===== 5. Appearance: skin tone ==========================================
  SKIN_TONES.forEach((t, i) => {
    const w = t.name.toLowerCase();
    add('skin_' + w.replace(/\s+/g, '_'), 'Appearance',
      ['make my skin ' + w, 'i want ' + w + ' skin', 'set my skin tone to ' + w, w + ' skin'],
      'Set your skin tone to ' + w + '.',
      (ctx) => { ctx.player.human.setSkinTone(i); return 'Skin tone: ' + t.name + '.'; });
  });
  // ===== 6. Appearance: eye colour =========================================
  for (const e of EYE_COLORS) {
    const w = e.name.toLowerCase();
    add('eyes_' + w.replace(/\s+/g, '_'), 'Appearance',
      ['make my eyes ' + w, 'i want ' + w + ' eyes', 'give me ' + w + ' eyes', w + ' eyes'],
      'Give yourself ' + w + ' eyes.',
      (ctx) => { ctx.player.human.setEyeColor(e.hex); ctx.player.appearance.eyeColorName = e.name; return w.charAt(0).toUpperCase() + w.slice(1) + ' eyes. Done.'; });
  }
  // ===== 7. Appearance: hair style =========================================
  for (const s of HAIR_STYLES) {
    add('hairstyle_' + s.id, 'Appearance',
      ['give me ' + s.name.toLowerCase() + ' hair', 'i want ' + s.name.toLowerCase() + ' hair', 'make my hair ' + s.name.toLowerCase(), s.name.toLowerCase() + ' hairstyle'],
      s.name + ' hair — ' + s.blurb,
      (ctx) => { ctx.player.human.setHairStyle(s.id); return s.name + ' it is.'; });
  }
  add('hair_next', 'Appearance', ['change my hair', 'new hair', 'different hair', 'i want new hair', 'switch my hair'],
    'Cycle to the next hairstyle.',
    (ctx) => { const s = ctx.player.human.nextHairStyle(); return 'Switched you to ' + s + ' hair.'; });

  // ===== 8. Appearance: outfits ============================================
  for (const gender of ['male', 'female']) {
    OUTFITS[gender].forEach((o, i) => {
      add('outfit_' + o.id, 'Appearance',
        ['wear the ' + o.name.toLowerCase(), 'put on the ' + o.name.toLowerCase(), 'give me the ' + o.name.toLowerCase(), 'outfit ' + (i + 1)],
        o.name + ' — ' + o.blurb,
        (ctx) => {
          if (ctx.player.appearance.gender !== gender) return 'That one\'s in the ' + gender + ' wardrobe. Say "T10 make me ' + gender + '" first.';
          ctx.player.human.setOutfit(i);
          return 'You\'re wearing the ' + o.name + '.';
        });
      add('crowd_outfit_' + o.id, 'Crowd',
        ['make everyone wear the ' + o.name.toLowerCase(), 'everyone in the ' + o.name.toLowerCase()],
        'Put everyone nearby in the ' + o.name + '.',
        (ctx) => {
          const n = ctx.npcs.forEachNear(ctx.player.position, 50, (npc) => {
            if (npc.appearance.gender === gender) npc.human.setOutfit(i);
          });
          return n ? 'Wardrobe updated for ' + n + ' people.' : 'Nobody close enough.';
        });
    });
  }
  add('outfit_next', 'Appearance',
    ['i wanna wear something new', 'i want to wear something new', 'change my clothes', 'new clothes',
     'different outfit', 'change my outfit', 'give me new clothes', 'something new to wear', 'new fit'],
    'Change into your next outfit.',
    (ctx) => {
      const o = ctx.player.human.nextOutfit();
      return 'Now wearing: ' + o.name + '. ' + o.blurb;
    });
  add('outfit_list', 'Appearance', ['what can i wear', 'list my clothes', 'what outfits do i have', 'show me my wardrobe'],
    'List the outfits available to you.',
    (ctx) => {
      const list = OUTFITS[ctx.player.appearance.gender];
      return 'You\'ve got ' + list.length + ': ' + list.map((o, i) => (i + 1) + ') ' + o.name).join(', ') + '. Say "T10 outfit 2" or "T10 I wanna wear something new".';
    });

  // ===== 9. Height (every inch in range is its own command) ================
  for (let ft = 4; ft <= 8; ft++) {
    for (let inch = 0; inch < 12; inch++) {
      if (ft === 8 && inch > 0) continue;
      const meters = feetInchesToMeters(ft, inch);
      if (meters < HEIGHT_RANGE.female.min - 0.01 || meters > HEIGHT_RANGE.male.max + 0.01) continue;
      const label = ft + "'" + inch + '"';
      add('height_' + ft + '_' + inch, 'Body',
        [
          'make me ' + ft + ' foot ' + inch, 'make me ' + ft + ' feet ' + inch,
          'make me ' + label, 'i want to be ' + ft + ' foot ' + inch,
          'set my height to ' + ft + ' ' + inch, 'make me ' + ft + ' ' + inch + ' tall',
        ],
        'Set your height to ' + label + '.',
        (ctx) => {
          const r = HEIGHT_RANGE[ctx.player.appearance.gender];
          if (meters < r.min || meters > r.max) {
            return 'For a ' + ctx.player.appearance.gender + ' character I can do ' +
              metersToFeetInches(r.min) + ' to ' + metersToFeetInches(r.max) + '. ' + label + ' is outside that.';
          }
          ctx.player.human.setHeight(meters);
          ctx.player.rebuildAppearance();
          return 'You\'re ' + label + ' now.';
        });
    }
  }
  add('height_tall', 'Body', ['make me tall', 'make me taller', 'i want to be tall'],
    'Make yourself taller.',
    (ctx) => {
      const r = HEIGHT_RANGE[ctx.player.appearance.gender];
      const h = Math.min(r.max, ctx.player.appearance.body.height + 0.09);
      ctx.player.human.setHeight(h); ctx.player.rebuildAppearance();
      return 'Now ' + metersToFeetInches(h) + '.';
    });
  add('height_short', 'Body', ['make me short', 'make me shorter', 'i want to be shorter'],
    'Make yourself shorter.',
    (ctx) => {
      const r = HEIGHT_RANGE[ctx.player.appearance.gender];
      const h = Math.max(r.min, ctx.player.appearance.body.height - 0.09);
      ctx.player.human.setHeight(h); ctx.player.rebuildAppearance();
      return 'Now ' + metersToFeetInches(h) + '.';
    });

  // ===== 10. Body sliders ==================================================
  const BODY_SLIDERS = [
    ['weight', 'weight', 'body.weight', ['heavier', 'bigger'], ['lighter', 'slimmer', 'thinner']],
    ['muscle', 'muscle', 'body.muscle', ['more muscular', 'buffer', 'stronger'], ['less muscular', 'skinnier']],
    ['shoulders', 'shoulder width', 'body.shoulderWidth', ['broader shoulders', 'wider shoulders'], ['narrower shoulders']],
    ['hips', 'hip width', 'body.hipWidth', ['wider hips'], ['narrower hips']],
    ['legs', 'leg length', 'body.legLength', ['longer legs'], ['shorter legs']],
    ['arms', 'arm length', 'body.armLength', ['longer arms'], ['shorter arms']],
    ['neck', 'neck length', 'body.neckLength', ['longer neck'], ['shorter neck']],
    ['head', 'head size', 'body.headSize', ['bigger head'], ['smaller head']],
    ['nose', 'nose size', 'face.noseSize', ['bigger nose'], ['smaller nose']],
    ['nosewidth', 'nose width', 'face.noseWidth', ['wider nose'], ['narrower nose']],
    ['jaw', 'jaw width', 'face.jawWidth', ['stronger jaw', 'wider jaw'], ['softer jaw', 'narrower jaw']],
    ['chin', 'chin', 'face.chinPoint', ['stronger chin'], ['weaker chin']],
    ['cheeks', 'cheekbones', 'face.cheekbone', ['higher cheekbones', 'sharper cheekbones'], ['softer cheekbones']],
    ['brow', 'brow ridge', 'face.browRidge', ['heavier brow'], ['lighter brow']],
    ['eyesize', 'eye size', 'face.eyeSize', ['bigger eyes'], ['smaller eyes']],
    ['eyespacing', 'eye spacing', 'face.eyeSpacing', ['wider set eyes'], ['closer set eyes']],
    ['lips', 'lip fullness', 'face.lipFullness', ['fuller lips'], ['thinner lips']],
    ['ears', 'ear size', 'face.earSize', ['bigger ears'], ['smaller ears']],
    ['posture', 'posture', 'body.posture', ['better posture', 'stand up straighter'], ['worse posture', 'slouch']],
  ];
  for (const [key, label, path, upWords, downWords] of BODY_SLIDERS) {
    const apply = (ctx, delta) => {
      const [group, prop] = path.split('.');
      const target = ctx.player.appearance[group];
      const isNorm = path === 'body.weight' || path === 'body.muscle';
      const lo = isNorm ? 0 : path === 'body.posture' ? -1 : 0.55;
      const hi = isNorm ? 1 : path === 'body.posture' ? 1 : 1.6;
      target[prop] = clampv((target[prop] || 1) + delta, lo, hi);
      ctx.player.human.rebuildBody();
      ctx.player.rebuildAppearance();
      return 'Adjusted your ' + label + '.';
    };
    add('body_' + key + '_up', 'Body',
      upWords.flatMap((w) => ['make me ' + w, 'give me ' + w, 'i want ' + w]),
      'Increase your ' + label + '.',
      (ctx) => apply(ctx, path === 'body.posture' ? 0.35 : 0.14));
    add('body_' + key + '_down', 'Body',
      downWords.flatMap((w) => ['make me ' + w, 'give me ' + w, 'i want ' + w]),
      'Decrease your ' + label + '.',
      (ctx) => apply(ctx, path === 'body.posture' ? -0.35 : -0.14));
  }
  add('body_gender_male', 'Body', ['make me a man', 'make me male', 'switch to male', 'i want to be a guy'],
    'Switch your character to male.',
    (ctx) => { ctx.player.human.setGender('male'); ctx.player.rebuildAppearance(); return 'Done. Male body, default outfit.'; });
  add('body_gender_female', 'Body', ['make me a woman', 'make me female', 'switch to female', 'i want to be a girl'],
    'Switch your character to female.',
    (ctx) => { ctx.player.human.setGender('female'); ctx.player.rebuildAppearance(); return 'Done. Female body, default outfit.'; });
  add('body_randomize', 'Body', ['randomize me', 'random appearance', 'surprise me', 'make me someone else', 'reroll my look'],
    'Roll a brand new appearance.',
    (ctx) => {
      const a = generateAppearance({ gender: ctx.player.appearance.gender });
      a.name = ctx.player.appearance.name;
      Object.assign(ctx.player.appearance, a);
      ctx.player.human.appearance = ctx.player.appearance;
      ctx.player.human.rebuildBody();
      ctx.player.rebuildAppearance();
      return 'New look: ' + a.buildName + ' build, ' + a.skinToneName.toLowerCase() + ' skin, ' + a.hairColorName.toLowerCase() + ' ' + a.hairStyle + ' hair.';
    });
  add('body_reset', 'Body', ['reset my body', 'reset my appearance', 'undo my changes', 'default body'],
    'Reset your body to the default proportions.',
    (ctx) => {
      const g = ctx.player.appearance.gender;
      ctx.player.appearance.body.weight = 0.45;
      ctx.player.appearance.body.muscle = g === 'female' ? 0.40 : 0.50;
      ctx.player.appearance.body.height = g === 'female' ? 1.68 : 1.80;
      ctx.player.human.rebuildBody();
      ctx.player.rebuildAppearance();
      return 'Back to default.';
    });

  // ===== 11. Personality / name ============================================
  for (const p of PERSONALITIES) {
    add('personality_' + p.id, 'Identity',
      ['make me ' + p.name.toLowerCase(), 'my personality is ' + p.name.toLowerCase(), 'set my personality to ' + p.name.toLowerCase()],
      p.name + ' — ' + p.blurb,
      (ctx) => {
        Object.assign(ctx.player.appearance, {
          personality: p.id, personalityName: p.name, social: p.social,
          energyTrait: p.energy, patience: p.patience, curiosity: p.curiosity,
        });
        return 'You\'re ' + p.name + ' now. ' + p.blurb;
      });
  }
  add('set_name', 'Identity', ['call me', 'my name is', 'change my name to', 'set my name to'],
    'Change your character\'s name.',
    (ctx, m) => {
      const name = m.rest && m.rest.trim();
      if (!name) return 'Tell me the name — "T10 call me Ash".';
      ctx.player.appearance.name = name.replace(/\b\w/g, (c) => c.toUpperCase());
      ctx.player.appearance.firstName = ctx.player.appearance.name.split(/\s+/)[0];
      return 'Got it, ' + ctx.player.appearance.firstName + '.';
    }, { capturesRest: true });

  // ===== 12. Weather =======================================================
  for (const [id, w] of Object.entries(WEATHER_PRESETS)) {
    const n = w.name.toLowerCase();
    add('weather_' + id, 'Weather',
      ['make it ' + n, 'set the weather to ' + n, 'i want ' + n, 'give me ' + n, n + ' weather', 'weather ' + n],
      'Change the weather to ' + w.name + '.',
      (ctx) => { ctx.atmosphere.setWeather(id); return 'Weather turning ' + n + '.'; });
  }
  add('weather_rain_on', 'Weather', ['make it rain', 'i want rain', 'start the rain', 'let it rain'],
    'Start rain.', (ctx) => { ctx.atmosphere.setWeather('rain'); return 'Rain on the way.'; });
  add('weather_rain_off', 'Weather', ['stop the rain', 'make the rain stop', 'no more rain', 'dry it up'],
    'Stop rain.', (ctx) => { ctx.atmosphere.setWeather('fair'); return 'Clearing up.'; });
  add('weather_storm_on', 'Weather', ['make a storm', 'i want a thunderstorm', 'bring the thunder', 'make it storm'],
    'Bring in a thunderstorm.', (ctx) => { ctx.atmosphere.setWeather('storm'); return 'Storm rolling in. Watch the sky.'; });
  add('weather_clear', 'Weather', ['clear the sky', 'make it sunny', 'clear skies', 'blue sky', 'nice weather'],
    'Clear the sky.', (ctx) => { ctx.atmosphere.setWeather('clear'); return 'Clear skies.'; });
  add('weather_fog_on', 'Weather', ['make it foggy', 'bring the fog', 'i want fog'],
    'Roll in fog.', (ctx) => { ctx.atmosphere.setWeather('fog'); return 'Fog coming in.'; });
  add('weather_wind_on', 'Weather', ['make it windy', 'i want wind', 'pick up the wind'],
    'Make it windy.', (ctx) => { ctx.atmosphere.setWeather('windy'); return 'Wind picking up.'; });
  add('weather_random', 'Weather', ['random weather', 'surprise me with the weather', 'change the weather'],
    'Pick random weather.',
    (ctx) => {
      const keys = Object.keys(WEATHER_PRESETS);
      const k = keys[Math.floor(Math.random() * keys.length)];
      ctx.atmosphere.setWeather(k);
      return 'Going with ' + WEATHER_PRESETS[k].name.toLowerCase() + '.';
    });
  add('weather_query', 'Weather', ['what is the weather', 'whats the weather', 'how is the weather', 'weather report'],
    'Ask about the weather.',
    (ctx) => {
      const a = ctx.atmosphere;
      const bits = [a.weatherName()];
      if (a.current.rain > 0.3) bits.push('rain at ' + Math.round(a.current.rain * 100) + '%');
      if (a.current.wind > 0.5) bits.push('strong wind');
      if (a.current.fog > 0.4) bits.push('poor visibility');
      return bits.join(', ') + '. It\'s ' + a.clockString() + ', ' + a.partOfDay() + '.';
    });

  // ===== 13. Time ==========================================================
  for (let h = 0; h < 24; h++) {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = h < 12 ? 'am' : 'pm';
    add('time_' + h, 'Time',
      ['set the time to ' + h, 'make it ' + h12 + ' ' + ampm, 'set time ' + h + ':00', 'its ' + h12 + ' ' + ampm],
      'Set the clock to ' + h12 + ' ' + ampm.toUpperCase() + '.',
      (ctx) => { ctx.atmosphere.setTimeOfDay(h); return 'Time set to ' + ctx.atmosphere.clockString() + '.'; });
  }
  const NAMED_TIMES = [
    ['sunrise', 6.2], ['dawn', 5.6], ['morning', 8.5], ['noon', 12], ['midday', 12],
    ['afternoon', 15], ['golden hour', 18.4], ['sunset', 19.2], ['dusk', 20], ['evening', 20.5],
    ['night', 22.5], ['midnight', 0], ['late night', 2.5], ['early morning', 4.5],
  ];
  for (const [name, hour] of NAMED_TIMES) {
    add('time_' + name.replace(/\s+/g, '_'), 'Time',
      ['make it ' + name, 'set the time to ' + name, 'i want ' + name, 'go to ' + name, name + ' please'],
      'Jump to ' + name + '.',
      (ctx) => { ctx.atmosphere.setTimeOfDay(hour); return 'It\'s ' + ctx.atmosphere.clockString() + ' — ' + ctx.atmosphere.partOfDay() + '.'; });
  }
  add('time_freeze', 'Time', ['freeze time', 'stop time', 'pause time', 'hold the time'],
    'Freeze the clock.', (ctx) => { ctx.atmosphere.paused = true; return 'Time is frozen at ' + ctx.atmosphere.clockString() + '.'; });
  add('time_resume', 'Time', ['unfreeze time', 'resume time', 'start time', 'let time run'],
    'Resume the clock.', (ctx) => { ctx.atmosphere.paused = false; return 'Clock\'s running again.'; });
  const TIME_SPEEDS = [['real time', 1], ['slow', 15], ['normal', 60], ['fast', 240], ['very fast', 600], ['super fast', 1800]];
  for (const [name, scale] of TIME_SPEEDS) {
    add('timescale_' + name.replace(/\s+/g, '_'), 'Time',
      ['make time ' + name, 'set time speed to ' + name, 'time speed ' + name],
      'Run time at ' + name + '.',
      (ctx) => { ctx.atmosphere.timeScale = scale; ctx.atmosphere.paused = false; return 'Time running ' + name + '.'; });
  }
  add('time_query', 'Time', ['what time is it', 'whats the time', 'time please', 'what day is it'],
    'Ask the time.',
    (ctx) => 'It\'s ' + ctx.atmosphere.clockString() + ' on day ' + ctx.atmosphere.day + '. ' + ctx.atmosphere.partOfDay().replace(/^the /, 'It\'s the ') + '.');

  extendRegistry(R, add);
  extendRegistry3(R, add);
  extendRegistry4(R, add);
  extendRegistry5(R, add);
  extendRegistry6(R, add);
  return R;
}
