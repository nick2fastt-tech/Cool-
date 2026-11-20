// Shared materials built from the procedural textures.
import * as THREE from 'three';

export function createMaterials(T) {
  const M = {};
  const v2 = (s) => new THREE.Vector2(s, s);
  const std = (name, p) => {
    const m = new THREE.MeshStandardMaterial(p);
    m.name = name;
    return m;
  };
  const t = (name) => T.get(name);

  const ft = t('floorTile');
  M.floorTile = std('floorTile', { map: ft.map, normalMap: ft.normalMap, normalScale: v2(0.45), roughnessMap: ft.roughnessMap, roughness: 1, metalness: 0 });
  const tz = t('terrazzo');
  M.terrazzo = std('terrazzo', { map: tz.map, roughnessMap: tz.roughnessMap, roughness: 0.9, metalness: 0 });
  const wb = t('wallBlock');
  M.wall = std('wall', { map: wb.map, normalMap: wb.normalMap, normalScale: v2(0.8), color: 0xfbf7ee, roughness: 0.82 });
  M.wallAccent = std('wallAccent', { map: wb.map, normalMap: wb.normalMap, normalScale: v2(0.8), color: 0x4f78a8, roughness: 0.75 });
  M.wallWarm = std('wallWarm', { map: wb.map, normalMap: wb.normalMap, normalScale: v2(0.8), color: 0xf3e3c3, roughness: 0.82 });
  const pl = t('plaster');
  M.plaster = std('plaster', { map: pl.map, normalMap: pl.normalMap, color: 0xf7f4ee, roughness: 0.9 });
  M.plasterDark = std('plasterDark', { map: pl.map, color: 0x3a3442, roughness: 0.85 });
  M.plasterGreen = std('plasterGreen', { map: pl.map, normalMap: pl.normalMap, color: 0xdbe9d6, roughness: 0.9 });
  const br = t('brick');
  M.brick = std('brick', { map: br.map, normalMap: br.normalMap, normalScale: v2(1.0), roughness: 0.92 });
  const ce = t('ceiling');
  M.ceiling = std('ceiling', { map: ce.map, normalMap: ce.normalMap, normalScale: v2(0.7), roughness: 0.95 });
  M.lightPanel = std('lightPanel', { color: 0xffffff, emissive: 0xfffaf0, emissiveIntensity: 2.0, roughness: 0.5 });
  M.lightWarm = std('lightWarm', { color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 2.2, roughness: 0.5 });

  const wd = t('wood');
  M.woodLight = std('woodLight', { map: wd.map, normalMap: wd.normalMap, normalScale: v2(0.4), color: 0xffffff, roughness: 0.55 });
  M.woodMid = std('woodMid', { map: wd.map, normalMap: wd.normalMap, normalScale: v2(0.4), color: 0xc08a58, roughness: 0.55 });
  M.woodDark = std('woodDark', { map: wd.map, normalMap: wd.normalMap, normalScale: v2(0.4), color: 0x7a4a2a, roughness: 0.5 });
  M.woodDoor = std('woodDoor', { map: wd.map, normalMap: wd.normalMap, normalScale: v2(0.3), color: 0xc9935f, roughness: 0.45 });
  const pk = t('planks');
  M.planks = std('planks', { map: pk.map, normalMap: pk.normalMap, normalScale: v2(0.6), color: 0xd8b48a, roughness: 0.45 });
  M.planksDark = std('planksDark', { map: pk.map, normalMap: pk.normalMap, normalScale: v2(0.6), color: 0x5a4030, roughness: 0.5 });

  const me = t('metal');
  M.chrome = std('chrome', { map: me.map, color: 0xd5d8dc, metalness: 0.95, roughness: 0.28 });
  M.steel = std('steel', { map: t('brushed').map, color: 0xc4c8cc, metalness: 0.9, roughness: 0.35 });
  M.metalDark = std('metalDark', { color: 0x2f3237, metalness: 0.6, roughness: 0.45 });
  M.metalGrey = std('metalGrey', { color: 0x8b9097, metalness: 0.6, roughness: 0.4 });
  M.frame = std('frame', { color: 0x9aa1aa, metalness: 0.7, roughness: 0.35 });
  M.frameDark = std('frameDark', { color: 0x3b4048, metalness: 0.5, roughness: 0.4 });
  const lf = T.get('lockerFront');
  M.lockerBody = std('lockerBody', { color: 0x2d5ea8, metalness: 0.35, roughness: 0.45 });
  M.lockerFront = std('lockerFront', { map: lf.map, normalMap: lf.normalMap, color: 0x3166b5, metalness: 0.35, roughness: 0.42 });
  M.lockerFront.polygonOffset = true;
  M.lockerFront.polygonOffsetFactor = -1;
  M.lockerFront.polygonOffsetUnits = -2;

  M.plasticBlue = std('plasticBlue', { color: 0x2f6fd6, roughness: 0.38 });
  M.plasticRed = std('plasticRed', { color: 0xd8443a, roughness: 0.38 });
  M.plasticGreen = std('plasticGreen', { color: 0x2fa25a, roughness: 0.38 });
  M.plasticOrange = std('plasticOrange', { color: 0xf08a24, roughness: 0.38 });
  M.plasticBlack = std('plasticBlack', { color: 0x1d1f24, roughness: 0.45 });
  M.plasticWhite = std('plasticWhite', { color: 0xeef0f2, roughness: 0.4 });
  M.labTop = std('labTop', { color: 0x1c1f24, roughness: 0.25, metalness: 0.1 });

  const ca = t('carpet');
  M.carpetBlue = std('carpetBlue', { map: ca.map, normalMap: ca.normalMap, normalScale: v2(0.6), color: 0x4566a3, roughness: 0.97 });
  M.carpetRed = std('carpetRed', { map: ca.map, normalMap: ca.normalMap, normalScale: v2(0.6), color: 0x8e2b38, roughness: 0.97 });
  M.carpetGreen = std('carpetGreen', { map: ca.map, normalMap: ca.normalMap, normalScale: v2(0.6), color: 0x3f7d5a, roughness: 0.97 });
  M.rug = std('rug', { map: ca.map, normalMap: ca.normalMap, color: 0xe2a14a, roughness: 0.97 });
  const ve = t('velvet');
  M.velvet = std('velvet', { map: ve.map, normalMap: ve.normalMap, color: 0xa31d2e, roughness: 0.82 });
  M.velvetDark = std('velvetDark', { map: ve.map, normalMap: ve.normalMap, color: 0x2a1418, roughness: 0.9 });
  const fa = t('fabric');
  M.fabricTeal = std('fabricTeal', { map: fa.map, normalMap: fa.normalMap, color: 0x2f8f8a, roughness: 0.9 });
  M.fabricMustard = std('fabricMustard', { map: fa.map, normalMap: fa.normalMap, color: 0xd9a032, roughness: 0.9 });
  M.fabricPurple = std('fabricPurple', { map: fa.map, normalMap: fa.normalMap, color: 0x7457a8, roughness: 0.9 });
  M.fabricGrey = std('fabricGrey', { map: fa.map, normalMap: fa.normalMap, color: 0x6b7280, roughness: 0.9 });

  M.glass = std('glass', { color: 0xcfe6ef, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.6 });
  M.glassFrosted = std('glassFrosted', { color: 0xdfe9ee, roughness: 0.35, metalness: 0.1, envMapIntensity: 0.9 });
  M.glassDark = std('glassDark', { color: 0x23313b, roughness: 0.08, metalness: 0.6, envMapIntensity: 1.4 });

  const co = t('concrete');
  M.concrete = std('concrete', { map: co.map, normalMap: co.normalMap, roughness: 0.92 });
  const sw = t('sidewalk');
  M.sidewalk = std('sidewalk', { map: sw.map, normalMap: sw.normalMap, roughness: 0.9 });
  const as = t('asphalt');
  M.asphalt = std('asphalt', { map: as.map, normalMap: as.normalMap, roughness: 0.95 });
  M.grass = std('grass', { map: t('grass').map, roughness: 1 });
  M.leaves = std('leaves', { map: t('leaves').map, vertexColors: true, roughness: 0.9 });
  M.trunk = std('trunk', { map: wd.map, color: 0x6b4a32, roughness: 0.95 });
  M.soil = std('soil', { map: co.map, color: 0x5a4030, roughness: 1 });

  M.books = std('books', { map: T.bookSpineTex, vertexColors: true, roughness: 0.7 });
  M.paper = std('paper', { color: 0xf7f5ee, roughness: 0.85 });
  M.white = std('white', { color: 0xf0f0ee, roughness: 0.5 });
  M.black = std('black', { color: 0x16171b, roughness: 0.5 });
  M.yellow = std('yellow', { color: 0xffc72c, roughness: 0.5 });
  M.navy = std('navy', { color: 0x1b1f3b, roughness: 0.55 });
  M.red = std('red', { color: 0xc8323a, roughness: 0.5 });
  M.gold = std('gold', { color: 0xe0b03a, metalness: 1, roughness: 0.25 });
  M.silver = std('silver', { color: 0xd8dde3, metalness: 1, roughness: 0.2 });
  M.pianoBlack = std('pianoBlack', { color: 0x0c0c0e, roughness: 0.12, metalness: 0.2 });
  M.ceramic = std('ceramic', { color: 0xc96b45, roughness: 0.7 });
  M.plantGreen = std('plantGreen', { color: 0x3f8f3a, roughness: 0.8 });
  M.plantDark = std('plantDark', { color: 0x2c6b2c, roughness: 0.8 });
  M.screen = std('screen', { color: 0x0b1220, emissive: 0x2a6fd6, emissiveIntensity: 0.55, roughness: 0.2 });
  M.studs = std('studs', { map: wd.map, color: 0xd9b07a, roughness: 0.8 });
  M.osb = std('osb', { map: t('osb').map, roughness: 0.9 });
  M.drywall = std('drywall', { color: 0xe6e4df, roughness: 0.95 });
  M.plastic = std('plastic', { map: t('plastic').map, color: 0xffffff, transparent: true, opacity: 0.78, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false });
  M.hazard = std('hazard', { map: T.hazardTex, roughness: 0.6 });
  M.cork = std('cork', { map: t('cork').map, roughness: 0.95 });
  M.blinds = std('blinds', { map: t('blinds').map, roughness: 0.6 });
  M.hairBrown = std('hairBrown', { color: 0x5a3a22, roughness: 0.7 });
  M.felt = std('felt', { color: 0x1d2b55, roughness: 1 });
  M.waterGlow = std('waterGlow', { color: 0x8fd3ff, emissive: 0x2a8fd6, emissiveIntensity: 0.4, roughness: 0.1, transparent: true, opacity: 0.6 });
  M.lampGlow = std('lampGlow', { color: 0xfff3d6, emissive: 0xffe2a8, emissiveIntensity: 2.5, roughness: 0.5 });
  M.stageGlow = new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  M.stageGlow.name = 'stageGlow';
  M.shadowBlob = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false, map: T.blobTex });
  M.shadowBlob.name = 'shadowBlob';

  // Pictures (posters, signs, boards) share settings; cached per texture.
  const picCache = new Map();
  M.picture = (tex, { emissive = 0, rough = 0.7, transparent = false } = {}) => {
    const key = tex.uuid + ':' + emissive + ':' + rough + ':' + transparent;
    if (picCache.has(key)) return picCache.get(key);
    const m = std('pic', { map: tex, roughness: rough, metalness: 0, transparent, alphaTest: transparent ? 0.02 : 0, depthWrite: !transparent });
    if (emissive) {
      m.emissive = new THREE.Color(0xffffff);
      m.emissiveMap = tex;
      m.emissiveIntensity = emissive;
    }
    picCache.set(key, m);
    return m;
  };
  return M;
}
