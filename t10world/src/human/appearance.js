// T10 World - character identity: appearance descriptors, names, personalities,
// voices. One seed produces a complete, distinct person.
import { makeRng, clamp01, clampv, lerpv, hashString } from '../core/math.js';
import { SKIN_TONES, EYE_COLORS, HAIR_COLORS } from './textures.js';
import { HAIR_STYLES } from './hair.js';
import { OUTFITS, outfitCount } from './clothing.js';
import { HEIGHT_RANGE, defaultBodyParams, describeBuild } from './skeleton.js';
import { defaultFaceParams } from './body.js';

const FIRST_M = ['James', 'Marcus', 'Elias', 'Diego', 'Kenji', 'Omar', 'Luca', 'Andre', 'Theo', 'Isaac',
  'Malik', 'Dmitri', 'Rafael', 'Noah', 'Ethan', 'Hugo', 'Amir', 'Jonas', 'Felix', 'Cole',
  'Darius', 'Mateo', 'Ravi', 'Soren', 'Tobias', 'Caleb', 'Emeka', 'Yusuf', 'Leon', 'Bastian',
  'Kwame', 'Nico', 'Hassan', 'Jae', 'Rowan', 'Silas', 'Tariq', 'Viktor', 'Wesley', 'Zane',
  'Arlo', 'Bruno', 'Cyrus', 'Dante', 'Emil', 'Finn', 'Gideon', 'Hector', 'Ivan', 'Jasper'];
const FIRST_F = ['Ava', 'Nia', 'Sofia', 'Yuki', 'Amara', 'Elena', 'Priya', 'Zoe', 'Camille', 'Ines',
  'Hana', 'Leila', 'Maya', 'Noor', 'Talia', 'Rosa', 'Sienna', 'Freya', 'Imani', 'Juno',
  'Keira', 'Lucia', 'Mira', 'Nadia', 'Odette', 'Paloma', 'Quinn', 'Rania', 'Selin', 'Thea',
  'Uma', 'Vera', 'Willa', 'Xiomara', 'Yara', 'Zara', 'Anaya', 'Brielle', 'Celine', 'Dahlia',
  'Esme', 'Farah', 'Greta', 'Harper', 'Iris', 'Jade', 'Kaia', 'Lena', 'Marisol', 'Nova'];
const FIRST_N = ['Alex', 'Jordan', 'Riley', 'Sam', 'Casey', 'Avery', 'Reese', 'Sky', 'Emery', 'Rowen'];
const LAST = ['Vance', 'Okonkwo', 'Reyes', 'Tanaka', 'Haddad', 'Moretti', 'Laurent', 'Novak', 'Silva', 'Bennett',
  'Kowalski', 'Nakamura', 'Osei', 'Ferreira', 'Lindqvist', 'Castellanos', 'Ibrahim', 'Voss', 'Mercer', 'Dupont',
  'Alvarez', 'Petrov', 'Sandoval', 'Whitaker', 'Fontaine', 'Adeyemi', 'Brennan', 'Choi', 'Delgado', 'Eriksen',
  'Falk', 'Gallagher', 'Hollis', 'Iqbal', 'Jansen', 'Kaur', 'Langley', 'Marchetti', 'Nakashima', 'Oyelaran',
  'Pruitt', 'Quintero', 'Rasmussen', 'Solano', 'Thorne', 'Ueda', 'Valdez', 'Wexler', 'Yilmaz', 'Zamora'];

export const PERSONALITIES = [
  { id: 'friendly', name: 'Friendly', blurb: 'Says hello first. Waves at strangers.', social: 0.85, energy: 0.6, patience: 0.7, curiosity: 0.6 },
  { id: 'reserved', name: 'Reserved', blurb: 'Keeps to themselves. Polite, brief.', social: 0.22, energy: 0.35, patience: 0.8, curiosity: 0.45 },
  { id: 'energetic', name: 'Energetic', blurb: 'Always moving. Hard to keep up with.', social: 0.7, energy: 0.95, patience: 0.3, curiosity: 0.8 },
  { id: 'laidback', name: 'Laid Back', blurb: 'Nothing is urgent. Ever.', social: 0.55, energy: 0.22, patience: 0.95, curiosity: 0.4 },
  { id: 'curious', name: 'Curious', blurb: 'Stares at anything new. Follows interesting things.', social: 0.6, energy: 0.6, patience: 0.5, curiosity: 0.98 },
  { id: 'grumpy', name: 'Grumpy', blurb: 'Would rather you moved along.', social: 0.18, energy: 0.4, patience: 0.15, curiosity: 0.25 },
  { id: 'confident', name: 'Confident', blurb: 'Walks like they own the block.', social: 0.75, energy: 0.7, patience: 0.5, curiosity: 0.55 },
  { id: 'nervous', name: 'Nervous', blurb: 'Checks over their shoulder a lot.', social: 0.3, energy: 0.65, patience: 0.35, curiosity: 0.7 },
  { id: 'cheerful', name: 'Cheerful', blurb: 'Genuinely glad you showed up.', social: 0.9, energy: 0.75, patience: 0.8, curiosity: 0.6 },
  { id: 'focused', name: 'Focused', blurb: 'Somewhere to be. Won\'t be distracted.', social: 0.35, energy: 0.7, patience: 0.6, curiosity: 0.3 },
];

export const VOICE_PRESETS = [
  { id: 'warm', name: 'Low & Warm', pitch: 0.72, rate: 0.94 },
  { id: 'deep', name: 'Deep', pitch: 0.58, rate: 0.90 },
  { id: 'even', name: 'Even', pitch: 0.95, rate: 1.0 },
  { id: 'bright', name: 'Bright', pitch: 1.18, rate: 1.05 },
  { id: 'quick', name: 'Light & Quick', pitch: 1.34, rate: 1.16 },
  { id: 'soft', name: 'Soft', pitch: 1.05, rate: 0.88 },
  { id: 'gravel', name: 'Gravelly', pitch: 0.66, rate: 0.84 },
  { id: 'clipped', name: 'Clipped', pitch: 1.0, rate: 1.22 },
];

export const OCCUPATIONS = [
  'office worker', 'barista', 'nurse', 'teacher', 'mechanic', 'delivery driver', 'chef',
  'shop assistant', 'engineer', 'student', 'paramedic', 'firefighter', 'police officer',
  'gardener', 'construction worker', 'musician', 'artist', 'librarian', 'accountant',
  'bartender', 'lifeguard', 'coach', 'electrician', 'plumber', 'photographer', 'retired',
  'bus driver', 'doctor', 'dog walker', 'security guard', 'cleaner', 'programmer',
];

/**
 * Generate a complete appearance descriptor from a seed.
 * @param opts { gender, seed, ageBias, forcedOutfit, forcedHair }
 */
export function generateAppearance(opts) {
  opts = opts || {};
  const seed = opts.seed != null ? opts.seed : (Math.random() * 0xffffffff) >>> 0;
  const rng = makeRng(seed);
  const gender = opts.gender || (rng() < 0.5 ? 'male' : 'female');
  const female = gender === 'female';

  // Age drives height, build, hair colour, skin and posture together.
  let age = opts.age != null ? opts.age : clamp01(rng.bell() * 1.1 - 0.05);
  if (opts.ageBias === 'young') age = clamp01(age * 0.45);
  if (opts.ageBias === 'old') age = clamp01(0.62 + age * 0.38);
  const ageYears = Math.round(lerpv(17, 78, age));

  const range = HEIGHT_RANGE[gender];
  // Real heights cluster; the full 5'1"-8'0" range stays available to the creator.
  const heightNorm = clamp01(rng.bell() * 0.86 + 0.07);
  const typicalMin = female ? 1.50 : 1.62;
  const typicalMax = female ? 1.80 : 1.95;
  let height = lerpv(typicalMin, typicalMax, heightNorm);
  if (rng.chance(0.02)) height = lerpv(range.min, range.max, rng());   // rare outliers
  height = clampv(height, range.min, range.max);
  if (age < 0.08) height *= 0.93;
  if (age > 0.85) height *= 0.98;

  const body = defaultBodyParams(gender);
  body.height = height;
  body.weight = clamp01(rng.bell() * 0.95 + 0.06 + age * 0.14);
  body.muscle = clamp01(rng.bell() * 0.9 + (female ? 0.05 : 0.15) - age * 0.18);
  body.shoulderWidth = rng.range(0.90, 1.12);
  body.hipWidth = rng.range(0.90, 1.14);
  body.legLength = rng.range(0.94, 1.07);
  body.armLength = rng.range(0.95, 1.05);
  body.neckLength = rng.range(0.88, 1.14);
  body.headSize = rng.range(0.94, 1.06);
  body.bustSize = female ? clamp01(rng.bell() * 1.1 - 0.05) : 0;
  body.posture = clampv(rng.bell() * 2 - 1 - age * 0.55, -1, 1);
  body.footSize = rng.range(0.92, 1.10);
  body.handSize = rng.range(0.93, 1.08);

  const face = defaultFaceParams(gender);
  face.headWidth = rng.range(0.92, 1.09);
  face.headDepth = rng.range(0.94, 1.07);
  face.jawWidth = rng.range(female ? 0.80 : 0.92, female ? 1.02 : 1.20);
  face.jawAngle = rng.range(0.85, 1.20);
  face.chinLength = rng.range(0.86, 1.18);
  face.chinPoint = rng.range(0.80, 1.22);
  face.chinCleft = rng.chance(0.14) ? rng.range(0.3, 1.0) : 0;
  face.cheekbone = rng.range(0.80, 1.28);
  face.cheekFullness = rng.range(0.78, 1.25);
  face.browRidge = rng.range(female ? 0.28 : 0.70, female ? 0.72 : 1.35);
  face.foreheadSlope = rng.range(0.28, 0.85);
  face.noseSize = rng.range(0.78, 1.30);
  face.noseWidth = rng.range(0.78, 1.28);
  face.noseBridge = rng.range(0.72, 1.30);
  face.noseTip = rng.range(-0.5, 0.9);
  face.noseHook = rng.range(-0.4, 0.8);
  face.eyeSize = rng.range(0.88, 1.14);
  face.eyeSpacing = rng.range(0.90, 1.12);
  face.eyeDepth = rng.range(0.78, 1.26);
  face.mouthWidth = rng.range(0.85, 1.20);
  face.lipFullness = clamp01((female ? 0.55 : 0.40) + rng.bell() * 0.6 - 0.3);
  face.earSize = rng.range(0.85, 1.18);
  face.earStick = rng.range(0.1, 0.75);
  face.occiput = rng.range(0.85, 1.15);
  face.neckThickness = rng.range(0.88, 1.16) * (female ? 0.94 : 1.04);

  const toneIndex = rng.int(0, SKIN_TONES.length - 1);
  const eyeColor = rng.pick(EYE_COLORS);
  // Hair colour correlates loosely with skin tone, then greys with age.
  let hairPool = HAIR_COLORS.slice(0, 16);
  if (toneIndex > 10) hairPool = HAIR_COLORS.slice(0, 6);
  else if (toneIndex < 5) hairPool = HAIR_COLORS.slice(2, 16);
  let hairColor = rng.pick(hairPool);
  if (rng.chance(0.03)) hairColor = rng.pick(HAIR_COLORS.slice(16));      // dyed
  if (age > 0.6 && rng.chance((age - 0.6) * 2.2)) hairColor = rng.pick(HAIR_COLORS.slice(13, 16));

  const styleOptions = HAIR_STYLES.filter((s) => s.id !== 'shaved' || !female || rng.chance(0.08));
  let hairStyle = rng.pick(styleOptions).id;
  if (!female && age > 0.55 && rng.chance(0.30)) hairStyle = rng.chance(0.5) ? 'shaved' : 'short';
  const recede = (!female && age > 0.4) ? clamp01((age - 0.4) * rng.range(0.2, 1.4)) : 0;

  const stubble = female ? 0 : clamp01(rng.bell() * 1.6 - 0.35) * clamp01(age * 2.2);
  const beard = female ? 0 : (rng.chance(0.30) ? rng.range(0.3, 1.0) : stubble * 0.4);

  const outfitIndex = opts.forcedOutfit != null ? opts.forcedOutfit : rng.int(0, outfitCount(gender) - 1);
  const outfit = OUTFITS[gender][outfitIndex];

  const firstPool = female ? FIRST_F : FIRST_M;
  const first = rng.chance(0.05) ? rng.pick(FIRST_N) : rng.pick(firstPool);
  const name = first + ' ' + rng.pick(LAST);

  const personality = rng.pick(PERSONALITIES);
  const voiceIndex = female ? rng.int(3, VOICE_PRESETS.length - 1) : rng.int(0, 4);
  const voice = VOICE_PRESETS[voiceIndex];

  return {
    seed, gender, name, firstName: first,
    age, ageYears,
    body, face,
    toneIndex,
    skinToneName: SKIN_TONES[toneIndex].name,
    eyeColor: eyeColor.hex, eyeColorName: eyeColor.name,
    hairStyle, hairColor: hairColor.hex, hairColorName: hairColor.name, hairRecede: recede,
    browColor: hairColor.hex,
    browShape: rng.pick(['natural', 'arched', 'straight', 'angled']),
    browThickness: clamp01(rng.bell() * 1.2 - 0.1 + (female ? 0 : 0.2)),
    lipColor: female
      ? rng.pick([0xa85a5a, 0xb86a6a, 0xc47878, 0x9c4f52, 0xd08a8a, 0xb45f70])
      : rng.pick([0x9a6258, 0xa4706a, 0x8d5a52]),
    lipFullness: face.lipFullness,
    stubble, beard,
    freckles: rng.chance(0.24) ? rng.range(0.2, 1.0) : 0,
    makeup: female ? clamp01(rng.bell() * 1.3 - 0.2) : 0,
    oiliness: rng(),
    outfitIndex, outfitId: outfit.id, outfitName: outfit.name,
    shoes: outfit.shoes,
    personality: personality.id, personalityName: personality.name,
    social: personality.social, energyTrait: personality.energy,
    patience: personality.patience, curiosity: personality.curiosity,
    voiceIndex, voiceId: voice.id, voiceName: voice.name,
    voicePitch: voice.pitch * rng.range(0.94, 1.06),
    voiceRate: voice.rate * rng.range(0.95, 1.05),
    occupation: rng.pick(OCCUPATIONS),
    buildName: describeBuild(body),
  };
}

/** A blank slate for the character creator — sensible, not random. */
export function defaultPlayerAppearance(gender) {
  const a = generateAppearance({ gender: gender || 'male', seed: 20260914, age: 0.30 });
  a.name = 'You';
  a.firstName = 'You';
  a.body.weight = 0.45;
  a.body.muscle = gender === 'female' ? 0.40 : 0.50;
  a.body.height = gender === 'female' ? 1.68 : 1.80;
  a.body.posture = 0.3;
  a.face = defaultFaceParams(gender || 'male');
  a.toneIndex = 6;
  a.skinToneName = SKIN_TONES[6].name;
  a.hairStyle = 'short';
  a.hairColor = HAIR_COLORS[4].hex;
  a.hairColorName = HAIR_COLORS[4].name;
  a.browColor = HAIR_COLORS[4].hex;
  a.eyeColor = EYE_COLORS[1].hex;
  a.eyeColorName = EYE_COLORS[1].name;
  a.outfitIndex = 0;
  a.outfitId = OUTFITS[gender || 'male'][0].id;
  a.outfitName = OUTFITS[gender || 'male'][0].name;
  a.shoes = OUTFITS[gender || 'male'][0].shoes;
  a.stubble = 0.15;
  a.beard = 0;
  a.freckles = 0;
  a.makeup = gender === 'female' ? 0.3 : 0;
  a.personality = 'friendly';
  a.personalityName = 'Friendly';
  a.voiceIndex = gender === 'female' ? 4 : 2;
  a.voiceName = VOICE_PRESETS[a.voiceIndex].name;
  a.voicePitch = VOICE_PRESETS[a.voiceIndex].pitch;
  a.voiceRate = VOICE_PRESETS[a.voiceIndex].rate;
  return a;
}

/** Short human-readable description — used by T10 when you ask about someone. */
export function describeAppearance(a) {
  const ft = Math.floor(a.body.height / 0.3048);
  const inch = Math.round((a.body.height / 0.0254) - ft * 12);
  const hairDesc = a.hairStyle === 'shaved' ? 'shaved head' : a.hairColorName.toLowerCase() + ' ' + a.hairStyle + ' hair';
  return a.name + ', ' + a.ageYears + ', ' + ft + "'" + inch + '", ' + a.buildName + ' build, ' +
    a.skinToneName.toLowerCase() + ' skin, ' + hairDesc + ', ' + a.eyeColorName.toLowerCase() + ' eyes. ' +
    a.personalityName + '. Works as a ' + a.occupation + '. Wearing: ' + a.outfitName + '.';
}

/** Deterministic appearance for a named world NPC. */
export function appearanceForName(name, gender) {
  return generateAppearance({ seed: hashString(name), gender });
}
