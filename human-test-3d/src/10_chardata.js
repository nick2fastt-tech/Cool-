// ============================================================================
// Character data (data-driven NPC attributes) + seeded appearance generator
// ============================================================================
const CHAR_DATA = {
  firstNames: {
    male: ['James', 'Liam', 'Noah', 'Mateo', 'Ethan', 'Lucas', 'Omar', 'Hiro', 'Kwame', 'Ivan', 'Diego', 'Arjun', 'Wei',
      'Samuel', 'Elijah', 'Mohammed', 'Andre', 'Felix', 'Jonas', 'Rafael', 'Tariq', 'Kenji', 'Marcus', 'Dmitri', 'Luca',
      'Theo', 'Caleb', 'Adrian', 'Nikolai', 'Jamal', 'Owen', 'Gabriel', 'Yusuf', 'Pedro', 'Sean', 'Victor', 'Malik',
      'Hassan', 'Erik', 'Daniel', 'Tomas', 'Kofi', 'Ravi', 'Jin', 'Leon', 'Oscar', 'Emeka', 'Mason'],
    female: ['Olivia', 'Emma', 'Sofia', 'Amara', 'Mia', 'Isabella', 'Yuki', 'Priya', 'Zara', 'Elena', 'Chloe', 'Aaliyah',
      'Mei', 'Hannah', 'Fatima', 'Lucia', 'Grace', 'Nadia', 'Ingrid', 'Camila', 'Leila', 'Ava', 'Maya', 'Sana', 'Rosa',
      'Freya', 'Imani', 'Ana', 'Keiko', 'Leah', 'Nora', 'Valentina', 'Esther', 'Lina', 'Clara', 'Jade', 'Ruth', 'Amelia',
      'Bianca', 'Mariam', 'Adaeze', 'Hana', 'Elif', 'Sienna', 'Tara', 'Ines', 'Naomi', 'Zoe']
  },
  lastNames: ['Smith', 'Garcia', 'Kim', 'Okafor', 'Nguyen', 'Muller', 'Rossi', 'Silva', 'Tanaka', 'Patel', 'Kowalski',
    'Johnson', 'Hernandez', 'Ivanova', 'Chen', 'Mensah', 'Dubois', 'Larsen', 'Haddad', 'Novak', 'Brown', 'Lopez',
    'Sato', 'Khan', 'Andersson', 'Costa', 'Wright', 'Mbeki', 'Romero', 'Walsh', 'Moreau', 'Singh', 'Park', 'Adeyemi',
    'Fischer', 'Ortiz', 'Reyes', 'Nakamura', 'Bianchi', 'Hughes', 'Petrov', 'Diaz', 'Cohen', 'Yilmaz', 'Baker', 'Osei'],

  skinTones: [
    { name: 'Porcelain', hex: 0xf1d3c2, w: 0.6 },
    { name: 'Fair', hex: 0xe8c3a8, w: 1 },
    { name: 'Light', hex: 0xdcac8a, w: 1 },
    { name: 'Light Olive', hex: 0xcf9f78, w: 1 },
    { name: 'Medium', hex: 0xc08a62, w: 1 },
    { name: 'Olive', hex: 0xae7b55, w: 1 },
    { name: 'Tan', hex: 0x9c6844, w: 1 },
    { name: 'Brown', hex: 0x80522f, w: 1 },
    { name: 'Dark Brown', hex: 0x623c22, w: 1 },
    { name: 'Deep', hex: 0x48291a, w: 0.8 }
  ],
  eyeColors: [
    { name: 'Dark Brown', hex: 0x2e1a0e, w: 3 }, { name: 'Brown', hex: 0x553218, w: 3 }, { name: 'Hazel', hex: 0x7a5a2c, w: 1.5 },
    { name: 'Amber', hex: 0x99681f, w: 0.6 }, { name: 'Green', hex: 0x4f7a3a, w: 1 }, { name: 'Blue-Green', hex: 0x3f7472, w: 0.8 },
    { name: 'Blue', hex: 0x3f6aa0, w: 1.4 }, { name: 'Light Blue', hex: 0x7aa2cc, w: 0.8 }, { name: 'Gray', hex: 0x7f8c96, w: 0.7 }
  ],
  hairColors: [
    { name: 'Black', hex: 0x110d0b, w: 3, natural: true }, { name: 'Dark Brown', hex: 0x2a1b12, w: 3, natural: true },
    { name: 'Brown', hex: 0x4a2f1d, w: 2.5, natural: true }, { name: 'Chestnut', hex: 0x6a3a20, w: 1.2, natural: true },
    { name: 'Light Brown', hex: 0x8a6240, w: 1.2, natural: true }, { name: 'Dark Blonde', hex: 0xa5824e, w: 1, natural: true },
    { name: 'Blonde', hex: 0xd0b27a, w: 1, natural: true }, { name: 'Platinum', hex: 0xe7dcc2, w: 0.4, natural: true },
    { name: 'Auburn', hex: 0x7a2e1a, w: 0.7, natural: true }, { name: 'Red', hex: 0xa8441f, w: 0.6, natural: true },
    { name: 'Gray', hex: 0x8e8b86, w: 0.7, natural: true }, { name: 'White', hex: 0xd9d6cf, w: 0.3, natural: true },
    { name: 'Dyed Blue', hex: 0x2c5cba, w: 0.2 }, { name: 'Dyed Pink', hex: 0xd9568e, w: 0.2 },
    { name: 'Dyed Purple', hex: 0x6a3da0, w: 0.2 }, { name: 'Dyed Green', hex: 0x2f8a48, w: 0.12 },
    { name: 'Dyed Teal', hex: 0x24998f, w: 0.12 }
  ],
  hairStyles: {
    male: [['buzz', 2], ['short', 4], ['sidepart', 3], ['quiff', 2], ['curly_short', 2], ['afro', 1], ['medium', 1],
      ['long_straight', 0.6], ['bun', 0.4], ['ponytail', 0.4], ['bald', 1.2]],
    female: [['bob', 2], ['medium', 2], ['long_straight', 3], ['long_wavy', 2.5], ['curly_long', 1.5], ['afro', 1],
      ['ponytail', 2.5], ['bun', 1.5], ['short', 0.8], ['pixie', 0.8], ['curly_short', 0.6]]
  },
  hairStyleNames: {
    buzz: 'Buzz Cut', short: 'Short', sidepart: 'Side Part', quiff: 'Quiff', curly_short: 'Short Curly', afro: 'Afro / Textured',
    medium: 'Medium', long_straight: 'Long Straight', long_wavy: 'Long Wavy', curly_long: 'Long Curly', ponytail: 'Ponytail',
    bun: 'Bun', bob: 'Bob', pixie: 'Pixie', bald: 'Bald'
  },
  facialHair: [['none', 4], ['stubble', 3], ['mustache', 0.8], ['goatee', 1], ['short_beard', 1.6], ['full_beard', 1.2]],
  facialHairNames: { none: 'None', stubble: 'Stubble', mustache: 'Mustache', goatee: 'Goatee', short_beard: 'Short Beard', full_beard: 'Full Beard' },
  builds: {
    slim: { shoulder: 0.95, chest: 0.9, waist: 0.88, hip: 0.95, limb: 0.87, fat: 0.0, belly: 0.0, muscle: 0.9, mass: 0.86 },
    average: { shoulder: 1.0, chest: 1.0, waist: 1.0, hip: 1.0, limb: 1.0, fat: 0.3, belly: 0.25, muscle: 1.0, mass: 1.0 },
    broad: { shoulder: 1.09, chest: 1.1, waist: 1.08, hip: 1.04, limb: 1.1, fat: 0.45, belly: 0.4, muscle: 1.08, mass: 1.15 },
    athletic: { shoulder: 1.07, chest: 1.08, waist: 0.93, hip: 0.98, limb: 1.07, fat: 0.08, belly: 0.0, muscle: 1.18, mass: 1.06 },
    stocky: { shoulder: 1.05, chest: 1.13, waist: 1.24, hip: 1.12, limb: 1.15, fat: 0.85, belly: 1.0, muscle: 1.0, mass: 1.28 }
  },
  buildWeights: {
    male: [[0.18, 'slim'], [0.36, 'average'], [0.14, 'broad'], [0.18, 'athletic'], [0.14, 'stocky']],
    female: [[0.25, 'slim'], [0.40, 'average'], [0.07, 'broad'], [0.16, 'athletic'], [0.12, 'stocky']]
  },
  // clothing pieces --------------------------------------------------------------
  tops: {
    tshirt: { label: 'T-Shirt', sleeve: 'short', neck: 'crew', thick: 0.006, mat: 'cotton', hem: 'hip', patterns: ['plain', 'plain', 'plain', 'stripes', 'heather'] },
    vneck: { label: 'V-Neck Tee', sleeve: 'short', neck: 'v', thick: 0.006, mat: 'cotton', hem: 'hip', patterns: ['plain', 'heather'] },
    longsleeve: { label: 'Long-Sleeve Tee', sleeve: 'long', neck: 'crew', thick: 0.007, mat: 'cotton', hem: 'hip', patterns: ['plain', 'stripes', 'heather'] },
    polo: { label: 'Polo Shirt', sleeve: 'short', neck: 'collar', thick: 0.007, mat: 'pique', hem: 'hip', patterns: ['plain', 'plain', 'stripes'] },
    shirt: { label: 'Button Shirt', sleeve: 'long', neck: 'collar', thick: 0.007, mat: 'cotton', hem: 'tucked', buttons: true, patterns: ['plain', 'plaid', 'pinstripe', 'plain'] },
    hoodie: { label: 'Hoodie', sleeve: 'long', neck: 'hood', thick: 0.016, mat: 'fleece', hem: 'hipband', cuffs: true, patterns: ['plain', 'heather'] },
    sweater: { label: 'Sweater', sleeve: 'long', neck: 'crew', thick: 0.013, mat: 'knit', hem: 'hipband', cuffs: true, patterns: ['plain', 'stripes', 'knit'] },
    jacket: { label: 'Zip Jacket', sleeve: 'long', neck: 'collar', thick: 0.02, mat: 'nylon', hem: 'hipband', zipper: true, cuffs: true, patterns: ['plain'] },
    leather: { label: 'Leather Jacket', sleeve: 'long', neck: 'collar', thick: 0.02, mat: 'leather', hem: 'hipband', zipper: true, patterns: ['plain'] },
    blazer: { label: 'Blazer', sleeve: 'long', neck: 'lapel', thick: 0.015, mat: 'wool', hem: 'low', buttons: true, patterns: ['plain', 'plain', 'pinstripe'] },
    blouse: { label: 'Blouse', sleeve: 'long', neck: 'v', thick: 0.006, mat: 'silk', hem: 'tucked', patterns: ['plain', 'dots', 'plain'] },
    labcoat: { label: 'Lab Coat', sleeve: 'long', neck: 'lapel', thick: 0.012, mat: 'cotton', hem: 'coat', buttons: true, patterns: ['plain'] },
    longcoat: { label: 'Long Coat', sleeve: 'long', neck: 'lapel', thick: 0.016, mat: 'wool', hem: 'coat', buttons: true, patterns: ['plain'] },
    dress: { label: 'Dress', sleeve: 'short', neck: 'crew', thick: 0.006, mat: 'cotton', hem: 'dress', patterns: ['plain', 'dots', 'floral', 'plain'] }
  },
  bottoms: {
    jeans: { label: 'Jeans', len: 'full', fit: 0.012, mat: 'denim', patterns: ['plain'] },
    chinos: { label: 'Chinos', len: 'full', fit: 0.018, mat: 'twill', patterns: ['plain'] },
    trousers: { label: 'Trousers', len: 'full', fit: 0.022, mat: 'wool', crease: true, patterns: ['plain', 'pinstripe'] },
    sweatpants: { label: 'Sweatpants', len: 'full', fit: 0.03, mat: 'fleece', cuffed: true, patterns: ['plain', 'heather'] },
    cargo: { label: 'Cargo Pants', len: 'full', fit: 0.028, mat: 'twill', pockets: true, patterns: ['plain'] },
    shorts: { label: 'Shorts', len: 'short', fit: 0.02, mat: 'twill', patterns: ['plain'] },
    skirt: { label: 'Skirt', len: 'skirt', skirtLen: 0.25, fit: 0.01, mat: 'cotton', patterns: ['plain', 'plaid', 'plain'] },
    longskirt: { label: 'Long Skirt', len: 'skirt', skirtLen: 0.40, fit: 0.01, mat: 'cotton', patterns: ['plain', 'floral'] },
    leggings: { label: 'Leggings', len: 'full', fit: 0.003, mat: 'lycra', patterns: ['plain'] }
  },
  shoes: {
    sneakers: { label: 'Sneakers', sole: 0.022, height: 0.075, toe: 0.042, mat: 'canvas', soleHex: 0xeeeeea },
    runners: { label: 'Running Shoes', sole: 0.028, height: 0.07, toe: 0.04, mat: 'mesh', soleHex: 0xf2f2f2 },
    hightops: { label: 'High-Tops', sole: 0.024, height: 0.12, toe: 0.042, mat: 'canvas', soleHex: 0xefefe8 },
    boots: { label: 'Boots', sole: 0.026, height: 0.15, toe: 0.046, mat: 'leather', soleHex: 0x1d1a17 },
    dress: { label: 'Dress Shoes', sole: 0.014, height: 0.06, toe: 0.036, mat: 'leather', soleHex: 0x221a14, pointy: true },
    loafers: { label: 'Loafers', sole: 0.014, height: 0.055, toe: 0.036, mat: 'leather', soleHex: 0x2a1f16 },
    flats: { label: 'Flats', sole: 0.008, height: 0.045, toe: 0.03, mat: 'leather', soleHex: 0x1a1a1a, pointy: true }
  },
  palettes: {
    neutral: [0x1b1b1d, 0x2e2f33, 0x55575c, 0x8a8c90, 0xc9c9c6, 0xe9e8e4, 0x1f2a44, 0x2b3a55, 0x6a4a32, 0xb9a682, 0xd9cdb2],
    bright: [0xa3262a, 0x6a1f2b, 0x2f5a3a, 0x3d6b2f, 0xc79a2e, 0x2a7a7a, 0x5d93c8, 0xd38aa0, 0x9a86c4, 0xcf6f2a, 0x3555a0, 0x8b2f6b, 0x1f6f5f],
    denim: [0x2b4466, 0x34527a, 0x1d2c44, 0x5878a0, 0x22252b, 0x46607f],
    khaki: [0xb8a47a, 0x8f845e, 0x5b5f3a, 0x6b5a45, 0x2e2f33, 0x1f2a44, 0x7d7d76],
    shoe: [0x1a1a1a, 0xf0f0ec, 0x5a3a24, 0x7a4f2e, 0x2b2f3a, 0x8a1f24, 0x2a4a7a, 0x3d3d40]
  }
};

const OUTFIT_TEMPLATES = [
  { name: 'Casual', w: 4, top: ['tshirt', 'vneck', 'longsleeve'], bottom: ['jeans', 'jeans', 'chinos'], shoes: ['sneakers', 'sneakers', 'runners', 'hightops'] },
  { name: 'Sporty', w: 1.6, top: ['hoodie', 'tshirt'], bottom: ['sweatpants', 'shorts'], shoes: ['runners'] },
  { name: 'Smart Casual', w: 2, top: ['shirt', 'polo', 'sweater'], bottom: ['chinos', 'trousers', 'jeans'], shoes: ['loafers', 'boots', 'sneakers'] },
  { name: 'Formal', w: 1, top: ['blazer'], bottom: ['trousers'], shoes: ['dress', 'loafers'] },
  { name: 'Outdoor', w: 1.4, top: ['jacket', 'leather', 'hoodie'], bottom: ['jeans', 'cargo'], shoes: ['boots', 'hightops', 'sneakers'] },
  { name: 'Summer', w: 1.4, top: ['tshirt', 'polo'], bottom: ['shorts'], shoes: ['sneakers', 'runners'] },
  { name: 'Lab Staff', w: 0.6, top: ['labcoat'], bottom: ['trousers', 'chinos'], shoes: ['loafers', 'sneakers'] },
  { name: 'Dress', w: 1.6, female: true, top: ['dress'], bottom: [null], shoes: ['flats', 'flats', 'sneakers', 'boots'] },
  { name: 'Skirt Outfit', w: 1.4, female: true, top: ['blouse', 'tshirt', 'sweater'], bottom: ['skirt', 'longskirt'], shoes: ['flats', 'boots', 'sneakers'] },
  { name: 'Athleisure', w: 1.2, female: true, top: ['hoodie', 'longsleeve', 'sweater'], bottom: ['leggings'], shoes: ['runners', 'sneakers'] },
  // never picked at random: dark, sharp clothes for spawned vampires
  { name: 'Vampire', w: 0, dark: true, top: ['longcoat', 'longcoat', 'blazer', 'leather', 'shirt'], bottom: ['trousers', 'trousers', 'jeans'], shoes: ['dress', 'boots', 'boots'],
    femaleTop: ['longcoat', 'blouse', 'dress', 'leather'], femaleBottom: ['trousers', 'longskirt', 'leggings'], femaleShoes: ['boots', 'boots', 'flats'] }
];

function pickWeighted(rng, arr) { return rng.weighted(arr.map(e => [e.w != null ? e.w : 1, e])); }
function pickColorFor(rng, mat, kind) {
  const P = CHAR_DATA.palettes;
  if (mat === 'denim') return rng.pick(P.denim);
  if (mat === 'twill' || mat === 'wool') return rng.chance(0.75) ? rng.pick(P.khaki) : rng.pick(P.neutral);
  if (mat === 'leather') return rng.pick([0x1a1716, 0x2a1d15, 0x4a2c1a, 0x5b3a22, 0x23201f]);
  if (mat === 'lycra') return rng.chance(0.7) ? rng.pick([0x161618, 0x24242a, 0x2a3346]) : rng.pick(P.bright);
  if (kind === 'labcoat') return 0xf1f1ee;
  return rng.chance(0.55) ? rng.pick(P.neutral) : rng.pick(P.bright);
}

// Generate a complete appearance description from a seed (+ optional overrides).
function generateAppearance(seed, ov = {}) {
  const rng = new RNG(seed);
  const S = Settings.data.spawn;
  const gender = ov.gender && ov.gender !== 'random' ? ov.gender : (rng.chance(0.5) ? 'male' : 'female');
  const male = gender === 'male';
  const firstName = rng.pick(CHAR_DATA.firstNames[gender]);
  const lastName = rng.pick(CHAR_DATA.lastNames);

  // height (adult only), within configured range
  const hMin = ov.heightMin != null ? ov.heightMin : (male ? S.heightMinM : S.heightMinF);
  const hMax = ov.heightMax != null ? ov.heightMax : (male ? S.heightMaxM : S.heightMaxF);
  let height = ov.height != null ? ov.height : rng.normal(male ? 1.765 : 1.635, 0.07);
  height = clamp(height, Math.min(hMin, hMax), Math.max(hMin, hMax));

  const build = ov.build && ov.build !== 'random' ? ov.build : rng.weighted(CHAR_DATA.buildWeights[gender]);
  const B = CHAR_DATA.builds[build];
  const j = () => rng.range(0.97, 1.03);
  const body = {
    shoulder: B.shoulder * j() * (male ? 1 : 0.97), chest: B.chest * j(), waist: B.waist * j(), hip: B.hip * j(),
    limb: B.limb * j(), fat: clamp(B.fat + rng.range(-0.1, 0.1), 0, 1), belly: clamp(B.belly + rng.range(-0.1, 0.15), 0, 1.2),
    muscle: B.muscle * j(), bust: male ? 0 : rng.range(0.6, 1.08) * (build === 'stocky' ? 1.12 : build === 'slim' || build === 'athletic' ? 0.88 : 1),
    legRatio: rng.range(0.98, 1.025), armRatio: rng.range(0.98, 1.02), neck: rng.range(0.95, 1.06) * (male ? 1.06 : 0.92),
    headScale: rng.range(0.97, 1.03), massMul: B.mass
  };

  const skin = ov.skin != null ? CHAR_DATA.skinTones[ov.skin] : pickWeighted(rng, CHAR_DATA.skinTones);
  const eyes = ov.eyes != null ? CHAR_DATA.eyeColors[ov.eyes] : pickWeighted(rng, CHAR_DATA.eyeColors);
  // older people more likely gray; darker skin more likely dark hair (soft correlation)
  const skinIdx = CHAR_DATA.skinTones.indexOf(skin);
  const age = Math.round(clamp(rng.normal(36, 12), 19, 72));
  let hairColor;
  if (ov.hairColor != null) hairColor = CHAR_DATA.hairColors[ov.hairColor];
  else if (age > 55 && rng.chance(0.6)) hairColor = rng.chance(0.7) ? CHAR_DATA.hairColors[10] : CHAR_DATA.hairColors[11];
  else {
    const list = CHAR_DATA.hairColors.map((h, i) => {
      let w = h.w;
      if (skinIdx >= 5 && h.natural && i >= 5 && i <= 9) w *= 0.15;
      if (i === 10 || i === 11) w *= 0.15;
      return [w, h];
    });
    hairColor = rng.weighted(list);
  }
  let hairStyle = ov.hairStyle && ov.hairStyle !== 'random' ? ov.hairStyle : rng.weighted(CHAR_DATA.hairStyles[gender].map(e => [e[1], e[0]]));
  if (hairStyle === 'bald' && age < 26 && rng.chance(0.6)) hairStyle = 'buzz';
  let facial = 'none';
  if (male) facial = ov.facialHair && ov.facialHair !== 'random' ? ov.facialHair : rng.weighted(CHAR_DATA.facialHair.map(e => [e[1], e[0]]));
  else if (ov.facialHair && ov.facialHair !== 'random') facial = ov.facialHair;

  const n = (s) => clamp(rng.normal(0, s), -1, 1);
  const face = {
    jaw: n(0.4) + (male ? 0.35 : -0.38), chin: n(0.45) + (male ? 0.1 : -0.15), chinProj: n(0.4), noseLen: n(0.45) + (male ? 0 : -0.12), noseWidth: n(0.45) + (male ? 0.15 : -0.3),
    noseProj: n(0.4), noseBridge: n(0.4) + (male ? 0 : -0.15), lips: n(0.4) + (male ? -0.15 : 0.34), mouthW: n(0.4), brow: n(0.4) + (male ? 0.45 : -0.35),
    cheek: n(0.45) + (male ? 0 : 0.15), cheekFull: n(0.4) + body.fat * 0.5 + (male ? 0 : 0.12), eyeSize: n(0.4) + (male ? 0 : 0.3), eyeTilt: n(0.45), eyeSpacing: n(0.35),
    forehead: n(0.45), faceLen: n(0.4) + (male ? 0.05 : -0.1), ear: n(0.45), browThick: n(0.45) + (male ? 0.4 : -0.1), browArch: n(0.45) + (male ? -0.2 : 0.35),
    eyeOpen: n(0.35) + (male ? 0 : 0.2), lipTint: male ? rng.range(0, 0.25) : rng.range(0.3, 0.75)
  };

  // outfit -----------------------------------------------------------------------
  let templates = OUTFIT_TEMPLATES.filter(t => (!t.female || !male) && t.w > 0);
  let tpl = ov.outfit && ov.outfit !== 'random' ? (OUTFIT_TEMPLATES.find(t => t.name === ov.outfit) || null) : null;
  if (tpl && tpl.female && male) tpl = null;
  if (!tpl) tpl = rng.weighted(templates.map(t => [t.w, t]));
  const fem = !male && tpl.femaleTop;
  const topType = ov.top || rng.pick(fem ? tpl.femaleTop : tpl.top);
  let bottomType = ov.bottom !== undefined ? ov.bottom : rng.pick(fem ? tpl.femaleBottom : tpl.bottom);
  if (topType === 'dress') bottomType = null;
  const shoeType = ov.shoes || rng.pick(fem ? tpl.femaleShoes : tpl.shoes);
  const topDef = CHAR_DATA.tops[topType];
  const top = {
    type: topType, def: topDef,
    color: ov.topColor != null ? ov.topColor : pickColorFor(rng, topDef.mat, topType),
    color2: rng.pick(CHAR_DATA.palettes.neutral.concat(CHAR_DATA.palettes.bright)),
    pattern: rng.pick(topDef.patterns),
    under: null
  };
  if (topType === 'blazer' || topType === 'labcoat' || topType === 'longcoat' || topType === 'jacket' || topType === 'leather') {
    top.under = { color: rng.pick([0xf2f2ee, 0xe6e9ef, 0xdfe7f2, 0x2b2b2e, 0xa9b5c4, 0x8a8f96]) };
  }
  if (top.pattern === 'plaid' && rng.chance(0.5)) top.color2 = 0x1d1d22;
  let bottom = null;
  if (bottomType) {
    const bDef = CHAR_DATA.bottoms[bottomType];
    bottom = {
      type: bottomType, def: bDef, color: ov.bottomColor != null ? ov.bottomColor : pickColorFor(rng, bDef.mat, bottomType),
      color2: rng.pick(CHAR_DATA.palettes.neutral), pattern: rng.pick(bDef.patterns)
    };
  }
  const sDef = CHAR_DATA.shoes[shoeType];
  const shoes = {
    type: shoeType, def: sDef,
    color: sDef.mat === 'leather' ? rng.pick([0x1a1716, 0x2a1d15, 0x4a2c1a, 0x5b3a22]) : rng.pick(CHAR_DATA.palettes.shoe),
    sole: sDef.soleHex, sock: rng.pick([0xf0f0ee, 0x1c1c1e, 0x9a9a9a, 0xe6e2d8])
  };
  if (tpl.dark) { // vampire: slicked dark hair, often a cape with a high collar and a red lining, pointed ears
    if (ov.hairColor == null) hairColor = rng.pick([CHAR_DATA.hairColors[0], CHAR_DATA.hairColors[0], CHAR_DATA.hairColors[1], CHAR_DATA.hairColors[11]]);
    if (!ov.hairStyle || ov.hairStyle === 'random') hairStyle = rng.pick(male ? ['sidepart', 'sidepart', 'short', 'medium', 'long_straight'] : ['long_straight', 'long_straight', 'long_wavy', 'bun', 'bob']);
    if (male && (!ov.facialHair || ov.facialHair === 'random')) facial = rng.chance(0.75) ? 'none' : 'goatee';
  }
  if (tpl.dark) { // deep, near-black colors with an oxblood or ivory accent
    if (ov.topColor == null) top.color = rng.pick([0x121114, 0x1b1418, 0x2a0c12, 0x17181d, 0x360c15, 0x0f131c]);
    top.pattern = 'plain'; top.color2 = 0x111114;
    if (top.under) top.under.color = rng.pick([0x5a0c15, 0xe8e2d6, 0x141416, 0x5a0c15]);
    if (bottom) { if (ov.bottomColor == null) bottom.color = rng.pick([0x111114, 0x19171a, 0x1c1c21, 0x1a1012]); bottom.pattern = 'plain'; }
    shoes.color = rng.pick([0x0d0d0e, 0x19130f]);
  }
  const app = {
    seed: seed >>> 0, gender, male, firstName, lastName, name: firstName + ' ' + lastName, age, height, build, body,
    skin, eyes, hairColor, hairStyle, facialHair: facial, face, outfitName: tpl.name, top, bottom, shoes
  };
  if (tpl.dark) {
    app.vampire = true; app.vampEars = rng.chance(0.7);
    if (rng.chance(0.6)) app.cape = { color: rng.pick([0x0d0c0f, 0x111014, 0x170c10]), lining: rng.pick([0x7a0b16, 0x5c0710, 0x8e1020, 0x2a0d3a]) };
  }
  if (ov.special) applySpecialLook(app, ov.special, rng);
  return app;
}

// Fan-made horror characters, built procedurally from the same generator (no external assets):
// 'doll'    - a ~80 cm killer doll: big head, freckles, red hair, striped shirt, denim overalls, red sneakers, kitchen knife
// 'slasher' - a ~2 m masked slasher: hockey-style mask, dark worn work clothes, heavy boots, machete
function applySpecialLook(app, kind, rng) {
  const jit = () => rng.range(-0.08, 0.08);
  if (kind === 'doll') {
    Object.assign(app, { special: 'doll', gender: 'male', male: true, firstName: 'Chucky', lastName: '', name: 'Chucky', age: 30, height: 0.8 + jit() * 0.1, build: 'stocky' });
    Object.assign(app.body, { shoulder: 1.06, chest: 1.12, waist: 1.2, hip: 1.1, limb: 1.24, fat: 0.7, belly: 0.85, muscle: 0.9, bust: 0, legRatio: 0.86, armRatio: 0.9, neck: 0.82, headScale: 1.24, massMul: 1 });
    app.skin = { name: 'Doll Vinyl', hex: 0xf1c6a6 };
    app.eyes = { name: 'Doll Blue', hex: 0x3f73b8 };
    app.hairColor = { name: 'Doll Red', hex: 0xc4451a };
    app.hairStyle = 'medium'; app.facialHair = 'none';
    Object.assign(app.face, { jaw: -0.7, chin: -0.55, chinProj: -0.25, noseLen: -0.9, noseWidth: -0.35, noseProj: -0.55, noseBridge: -0.7, lips: -0.25, mouthW: -0.05,
      brow: 0.25, cheek: 0.65, cheekFull: 1.0, eyeSize: 1.0, eyeTilt: -0.55, eyeSpacing: 0.35, forehead: 0.7, faceLen: -0.65, ear: 0.15, browThick: 0.5, browArch: -1.0, eyeOpen: 0.5, lipTint: 0.55 });
    app.outfitName = 'Doll Overalls';
    app.top = { type: 'longsleeve', def: CHAR_DATA.tops.longsleeve, color: 0xb3262b, color2: 0x2b4f9f, pattern: 'multistripe', under: null };
    app.bottom = { type: 'jeans', def: CHAR_DATA.bottoms.jeans, color: 0x3f6db0, color2: 0x2b4466, pattern: 'plain' };
    app.shoes = { type: 'sneakers', def: CHAR_DATA.shoes.sneakers, color: 0xb6232a, sole: 0xf0f0ec, sock: 0xf0f0ee };
    app.overalls = true; app.weapon = 'knife'; app.doll = true;
  } else if (kind === 'slasher') {
    Object.assign(app, { special: 'slasher', gender: 'male', male: true, firstName: 'Jason', lastName: '', name: 'Jason', age: 40, height: 1.98 + jit() * 0.15, build: 'broad' });
    Object.assign(app.body, { shoulder: 1.14, chest: 1.12, waist: 1.08, hip: 1.04, limb: 1.12, fat: 0.4, belly: 0.3, muscle: 1.15, massMul: 1.2, neck: 1.14, headScale: 1.03 });
    app.skin = CHAR_DATA.skinTones[1];
    app.hairStyle = 'buzz'; app.hairColor = CHAR_DATA.hairColors[3]; app.facialHair = 'none';
    app.outfitName = 'Work Clothes (Worn)';
    app.top = { type: 'jacket', def: CHAR_DATA.tops.jacket, color: 0x393a2d, color2: 0x26261f, pattern: 'plain', under: { color: 0x2a2924 } };
    app.bottom = { type: 'cargo', def: CHAR_DATA.bottoms.cargo, color: 0x2d2a24, color2: 0x1f1e1b, pattern: 'plain' };
    app.shoes = { type: 'boots', def: CHAR_DATA.shoes.boots, color: 0x2a2018, sole: 0x1d1a17, sock: 0x1c1c1e };
    app.mask = 'hockey'; app.weapon = 'machete';
  } else if (kind === 'doctor') {
    // an original containment-doctor design: tall and gaunt, a long buckled leather-brown coat, latex
    // gloves, heavy boots, a leather hood with a beaked mask and round goggles under a wide hat,
    // a stethoscope, vials on the belt and a brass-and-glass injector
    Object.assign(app, { special: 'doctor', gender: 'male', male: true, firstName: 'The', lastName: 'Physician', name: 'The Physician', age: 52, height: 2.0 + jit() * 0.08, build: 'slim' });
    Object.assign(app.body, { shoulder: 1.06, chest: 0.97, waist: 0.92, hip: 0.96, limb: 0.92, fat: 0.2, belly: 0.05, muscle: 0.85, massMul: 0.95, neck: 0.94, headScale: 1.0, legRatio: 1.04, armRatio: 1.05 });
    app.skin = CHAR_DATA.skinTones[0];
    app.hairStyle = 'bald'; app.facialHair = 'none';
    app.outfitName = 'Containment Coat';
    app.top = { type: 'longcoat', def: CHAR_DATA.tops.longcoat, color: 0x3a2c21, color2: 0x24190f, pattern: 'plain', under: { color: 0x1a1714 } };
    app.coatLen = 0.44; app.coatOpen = true;
    app.bottom = { type: 'trousers', def: CHAR_DATA.bottoms.trousers, color: 0x1d1a17, color2: 0x15120f, pattern: 'plain' };
    app.shoes = { type: 'boots', def: CHAR_DATA.shoes.boots, color: 0x17120e, sole: 0x0e0c0a, sock: 0x111111 };
    app.gloves = { color: 0xe4dfd0 };
    app.mask = 'plague'; app.weapon = 'injector'; app.doctor = true;
  }
}

function describeOutfit(app) {
  const parts = [app.top.def.label];
  if (app.bottom) parts.push(app.bottom.def.label);
  parts.push(app.shoes.def.label);
  return parts.join(', ');
}
HT.generateAppearance = generateAppearance;
