// T10 World - the Human entity. Assembles skeleton, body, eyes, hair and
// clothing into one rig and drives it with the procedural animator.
// Used unchanged for the player and for every NPC.
import * as THREE from '../../vendor/three.module.js';
import { computeProportions, buildSkeleton, resetPose, HEIGHT_RANGE } from './skeleton.js';
import { buildBodyGeometry, buildEyeGeometry, buildEyelidGeometry, defaultFaceParams, MAT_SKIN, MAT_HEAD } from './body.js';
import { buildHair, buildBeard, buildBrows } from './hair.js';
import { buildGarment, buildShoe, OUTFITS, BASE_LAYER, getOutfit } from './clothing.js';
import { skinTexture, skinRoughnessTexture, faceTexture, irisTexture, SKIN_TONES, EYE_COLORS, HAIR_COLORS } from './textures.js';
import { HumanAnimator, makeMotionProfile, STATES } from './animator.js';
import { makeRng, clamp01, clampv, lerpv } from '../core/math.js';
import { settings } from '../core/settings.js';

/** Quantize the face descriptor so many NPCs can share one painted texture. */
function faceDescriptor(a, tier) {
  const q = (v, step) => Math.round(v / step) * step;
  if (tier === 'player') {
    return {
      tier: 'player',
      seed: a.seed, gender: a.gender, toneIndex: a.toneIndex,
      browShape: a.browShape, browThickness: a.browThickness, browColor: a.browColor,
      lipColor: a.lipColor, lipFullness: a.lipFullness,
      stubble: a.stubble, freckles: a.freckles, makeup: a.makeup, age: a.age,
    };
  }
  return {
    tier: 'npc',
    seed: 1, gender: a.gender, toneIndex: a.toneIndex,
    browShape: a.browShape, browThickness: q(a.browThickness, 0.34), browColor: a.browColor,
    lipColor: a.lipColor, lipFullness: q(a.lipFullness, 0.34),
    stubble: q(a.stubble, 0.34), freckles: q(a.freckles, 0.5),
    makeup: q(a.makeup, 0.5), age: q(a.age, 0.34),
  };
}

export class Human {
  /**
   * @param appearance descriptor from appearance.js
   * @param opts { tier:'player'|'npc', segments, facial, shadows }
   */
  constructor(appearance, opts) {
    this.appearance = appearance;
    this.opts = Object.assign({ tier: 'npc', facial: true, shadows: true }, opts || {});
    this.root = new THREE.Group();
    this.root.name = 'human:' + appearance.name;
    this.disposed = false;
    this.parts = {};
    this.visibleDetail = 1;
    this.build();
  }

  // -------------------------------------------------------------------------
  build() {
    const a = this.appearance;
    const preset = settings.preset;
    const isPlayer = this.opts.tier === 'player';
    const segments = this.opts.segments || (isPlayer ? Math.max(12, preset.humanSegments) : preset.humanSegments);
    const wantFingers = preset.fingerBones || isPlayer;

    this.prop = computeProportions(a.body);
    const skel = buildSkeleton(this.prop, { fingers: wantFingers });
    this.skeletonData = skel;
    this.boneMap = skel.boneMap;
    this.skeleton = skel.skeleton;

    // ---- Body ----
    const built = buildBodyGeometry(this.prop, skel.boneIndex, a.face, {
      segments,
      toes: isPlayer || segments >= 12,
    });
    this.bodyInfo = built;

    const skinTex = skinTexture({ toneIndex: a.toneIndex, freckles: a.freckles, age: a.age });
    skinTex.repeat.set(3, 3);
    const roughTex = skinRoughnessTexture({ oiliness: a.oiliness });
    const tone = SKIN_TONES[a.toneIndex % SKIN_TONES.length];

    const skinMat = new THREE.MeshStandardMaterial({
      map: skinTex,
      roughnessMap: roughTex,
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.0,
    });
    const headMat = new THREE.MeshStandardMaterial({
      map: faceTexture(faceDescriptor(a, this.opts.tier)),
      color: 0xffffff,
      roughness: 0.70,
      metalness: 0.0,
    });
    this.materials = { skin: skinMat, head: headMat };

    const body = new THREE.SkinnedMesh(built.geometry, [skinMat, headMat]);
    body.name = 'body';
    body.castShadow = this.opts.shadows;
    body.receiveShadow = this.opts.shadows;
    body.add(skel.root);
    body.bind(skel.skeleton);
    // Animated poses can leave the bind-pose bounds; pad so nothing pops out.
    if (body.geometry.boundingSphere) body.geometry.boundingSphere.radius *= 1.6;
    this.root.add(body);
    this.parts.body = body;

    // ---- Eyes ----
    this.buildEyes();

    // ---- Hair / brows / beard ----
    this.buildHairParts();

    // ---- Clothing ----
    this.buildClothing();

    // ---- Animator ----
    const rng = makeRng(a.seed ^ 0x5bf03635);
    this.profile = makeMotionProfile(rng, a.body);
    this.profile.energy *= 0.7 + (a.energyTrait || 0.5) * 0.6;
    this.profile.cadenceScale *= 0.9 + (a.energyTrait || 0.5) * 0.25;
    this.animator = new HumanAnimator(
      {
        boneMap: this.boneMap,
        face: this.face,
        root: skel.root,
        rootObject: this.root,
        facial: this.opts.facial && (settings.preset.facialAnimation || isPlayer),
      },
      this.prop,
      this.profile
    );

    this.height = a.body.height;
    this.eyeHeight = this.prop.measure.eyeLine;
    this.root.userData.human = this;
  }

  buildEyes() {
    const a = this.appearance;
    const info = this.bodyInfo;
    const headBone = this.boneMap.head;
    if (!headBone) return;
    const headWorldY = headBone.userData.restWorld.y;
    const eyeR = info.eyeRadius;
    const m = this.prop.measure;
    const segs = settings.preset.humanSegments >= 12 ? 20 : 12;

    const eyeGeo = buildEyeGeometry(eyeR, segs);
    const irisMat = new THREE.MeshStandardMaterial({
      map: irisTexture(a.eyeColor),
      roughness: 0.14,
      metalness: 0.0,
      envMapIntensity: 1.4,
    });

    // Eye position: at the eye line, inset into the socket.
    const eyeY = m.eyeLine - headWorldY;
    const Rx = info.headRadii.x, Rz = info.headRadii.z;
    const eyeX = m.eyeSep * a.face.eyeSpacing;
    const sinT = clamp01(eyeX / Rx);
    const eyeZ = Math.sqrt(Math.max(0.02, 1 - sinT * sinT)) * Rz * 0.90 + info.headZ - eyeR * 0.52;

    this.face = {};
    for (const S of ['L', 'R']) {
      const sgn = S === 'L' ? 1 : -1;
      const pivot = new THREE.Object3D();
      pivot.position.set(sgn * eyeX, eyeY, eyeZ);
      headBone.add(pivot);

      const eye = new THREE.Mesh(eyeGeo, irisMat);
      eye.name = 'eye' + S;
      eye.castShadow = false;
      eye.receiveShadow = false;
      eye.userData.wantsShadow = false;
      pivot.add(eye);
      this.face['eye' + S] = pivot;

      // Lids sit just outside the eyeball, tinted with the skin colour.
      const lidMat = new THREE.MeshStandardMaterial({
        map: this.materials.head.map,
        color: SKIN_TONES[a.toneIndex % SKIN_TONES.length].hex,
        roughness: 0.68,
        metalness: 0,
        side: THREE.DoubleSide,
      });
      // Use the skin tone flat rather than the face atlas to avoid stray features.
      lidMat.map = null;
      const upper = new THREE.Mesh(buildEyelidGeometry(eyeR, true, segs), lidMat);
      upper.name = 'lidU' + S;
      // Rest position: open, lid tucked up under the brow.
      upper.rotation.x = -0.12;
      pivot.add(upper);
      const lower = new THREE.Mesh(buildEyelidGeometry(eyeR, false, segs), lidMat);
      lower.name = 'lidL' + S;
      lower.rotation.x = 0.06;
      pivot.add(lower);
      this.face['lidUpper' + S] = upper;
      this.face['lidLower' + S] = lower;
    }
  }

  buildHairParts() {
    const a = this.appearance;
    const info = this.bodyInfo;
    const headBone = this.boneMap.head;
    if (!headBone) return;
    const headWorldY = headBone.userData.restWorld.y;
    const headSpec = {
      radii: info.headRadii,
      span: info.headSpan,
      z: info.headZ,
      boneLocalY: headWorldY - info.headCenterY,
    };
    // buildHair works in head-centre space and then shifts by boneLocalY.
    headSpec.boneLocalY = headWorldY - info.headCenterY;

    this.removePart('hair');
    const hair = buildHair(headSpec, a.hairStyle, a.hairColor, a.seed, a.hairRecede);
    if (hair) { headBone.add(hair); this.parts.hair = hair; }

    this.removePart('brows');
    const brows = buildBrows(headSpec, a.browColor, 0.6 + a.browThickness);
    if (brows) { headBone.add(brows); this.parts.brows = brows; if (this.face) { this.face.brows = brows; this.face.browRestY = brows.position.y; } }

    this.removePart('beard');
    if (a.beard > 0.25) {
      const beard = buildBeard(headSpec, a.browColor, a.beard, a.seed);
      if (beard) { headBone.add(beard); this.parts.beard = beard; }
    }
    this._headSpec = headSpec;
  }

  buildClothing() {
    const a = this.appearance;
    this.removePart('clothes');
    this.removePart('base');
    this.removePart('shoeL');
    this.removePart('shoeR');

    const segments = this.opts.segments || settings.preset.humanSegments;
    const outfit = getOutfit(a.gender, a.outfitIndex);
    a.outfitId = outfit.id;
    a.outfitName = outfit.name;
    a.shoes = outfit.shoes;

    // Base layer first so removing an outfit never leaves a bare character —
    // but only the parts the outfit doesn't already cover, or it pokes through.
    const covers = { top: false, bottom: false };
    if (!a.nude) for (const piece of outfit.pieces) {
      if (piece.type === 'bottom') covers.bottom = true;
      if (piece.type === 'top') { covers.top = true; if (piece.kind === 'dress') covers.bottom = true; }
    }
    // Where the outfit covers, the base layer is pulled in tight so it sits
    // strictly inside and can't poke through; where it doesn't, it stays as is.
    // Removing it outright left a hole at the crotch of every trouser.
    const basePieces = (BASE_LAYER[a.gender] || BASE_LAYER.male)
      .map((piece) => (covers[piece.type]
        ? Object.assign({}, piece, { inflate: piece.inflate * 0.25 })
        : piece));
    if (basePieces.length) {
      const base = buildGarment(this.prop, this.skeletonData.boneIndex, basePieces, { segments: Math.max(6, segments - 2) });
      const baseMesh = new THREE.SkinnedMesh(base.geometry, base.materials);
      baseMesh.name = 'baselayer';
      baseMesh.castShadow = this.opts.shadows;
      baseMesh.receiveShadow = this.opts.shadows;
      baseMesh.bind(this.skeleton, this.parts.body.bindMatrix);
      if (baseMesh.geometry.boundingSphere) baseMesh.geometry.boundingSphere.radius *= 1.6;
      this.root.add(baseMesh);
      this.parts.base = baseMesh;
    }

    if (!a.nude) {
      const g = buildGarment(this.prop, this.skeletonData.boneIndex, outfit.pieces, { segments });
      const mesh = new THREE.SkinnedMesh(g.geometry, g.materials);
      mesh.name = 'clothes';
      mesh.castShadow = this.opts.shadows;
      mesh.receiveShadow = this.opts.shadows;
      mesh.bind(this.skeleton, this.parts.body.bindMatrix);
      if (mesh.geometry.boundingSphere) mesh.geometry.boundingSphere.radius *= 1.6;
      this.root.add(mesh);
      this.parts.clothes = mesh;
    }

    if (!a.barefoot) {
      for (const S of ['L', 'R']) {
        const shoe = buildShoe(this.prop, outfit.shoes, S);
        const bone = this.boneMap['foot' + S];
        if (bone) {
          bone.add(shoe);
          this.parts['shoe' + S] = shoe;
        }
      }
    }
  }

  removePart(name) {
    const p = this.parts[name];
    if (!p) return;
    if (p.parent) p.parent.remove(p);
    disposeObject(p);
    delete this.parts[name];
  }

  // -------------------------------------------------------------------------
  // Runtime appearance changes (driven by T10 commands and the creator)
  // -------------------------------------------------------------------------

  setOutfit(ref) {
    const list = OUTFITS[this.appearance.gender];
    let idx = 0;
    if (typeof ref === 'number') idx = ((ref % list.length) + list.length) % list.length;
    else { const f = list.findIndex((o) => o.id === ref || o.name.toLowerCase() === String(ref).toLowerCase()); idx = f >= 0 ? f : 0; }
    this.appearance.outfitIndex = idx;
    this.appearance.nude = false;
    this.buildClothing();
    return list[idx];
  }

  nextOutfit() { return this.setOutfit(this.appearance.outfitIndex + 1); }

  setHairStyle(style) {
    this.appearance.hairStyle = style;
    this.buildHairParts();
    return style;
  }
  nextHairStyle() {
    const order = ['short', 'medium', 'long', 'shaved'];
    const i = order.indexOf(this.appearance.hairStyle);
    return this.setHairStyle(order[(i + 1) % order.length]);
  }
  setHairColor(hex) {
    this.appearance.hairColor = hex;
    this.appearance.browColor = hex;
    this.buildHairParts();
  }

  setEyeColor(hex) {
    this.appearance.eyeColor = hex;
    for (const S of ['L', 'R']) {
      const pivot = this.face && this.face['eye' + S];
      if (!pivot) continue;
      pivot.traverse((o) => {
        if (o.isMesh && o.name.startsWith('eye')) {
          o.material = new THREE.MeshStandardMaterial({
            map: irisTexture(hex), roughness: 0.14, metalness: 0, envMapIntensity: 1.4,
          });
        }
      });
    }
  }

  /**
   * Multiply this person's materials by a colour, so infection (or mind
   * control, or anything else) reads across a whole street at a glance.
   * Skin takes it at full strength, clothes at half so they still read as
   * clothes. Originals are kept, so passing null puts everything back.
   */
  setSkinTint(hex, eyeHex) {
    if (!this._tintBase) {
      this._tintBase = new Map();
      const remember = (m) => { if (m && m.color && !this._tintBase.has(m)) this._tintBase.set(m, m.color.getHex()); };
      remember(this.materials.skin);
      remember(this.materials.head);
      for (const k in this.parts) {
        const part = this.parts[k];
        if (!part) continue;
        part.traverse((o) => {
          if (!o.isMesh) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) remember(m);
        });
      }
    }

    const skinSet = new Set([this.materials.skin, this.materials.head]);
    const tint = hex == null ? null : new THREE.Color(hex);
    for (const [m, base] of this._tintBase) {
      if (!m.color) continue;
      if (tint == null) { m.color.setHex(base); continue; }
      m.color.setHex(base);
      // Skin takes the colour outright; everything else is pulled halfway.
      m.color.lerp(tint, skinSet.has(m) ? 1 : 0.5);
    }
    this.skinTint = hex == null ? null : hex;

    if (eyeHex !== undefined) {
      for (const S of ['L', 'R']) {
        const pivot = this.face && this.face['eye' + S];
        if (!pivot) continue;
        pivot.traverse((o) => {
          if (!o.isMesh || !o.name.startsWith('eye') || !o.material || !o.material.emissive) return;
          o.material.emissive.setHex(eyeHex == null ? 0x000000 : eyeHex);
          o.material.emissiveIntensity = eyeHex == null ? 0 : 1.8;
          o.material.needsUpdate = true;
        });
      }
    }
  }

  setSkinTone(index) {
    const a = this.appearance;
    a.toneIndex = ((index % SKIN_TONES.length) + SKIN_TONES.length) % SKIN_TONES.length;
    a.skinToneName = SKIN_TONES[a.toneIndex].name;
    const tex = skinTexture({ toneIndex: a.toneIndex, freckles: a.freckles, age: a.age });
    tex.repeat.set(3, 3);
    this.materials.skin.map = tex;
    this.materials.skin.needsUpdate = true;
    this.materials.head.map = faceTexture(faceDescriptor(a, this.opts.tier));
    this.materials.head.needsUpdate = true;
    // Eyelids follow the new tone.
    for (const S of ['L', 'R']) {
      const up = this.face && this.face['lidUpper' + S];
      if (up) up.material.color.setHex(SKIN_TONES[a.toneIndex].hex);
    }
  }

  /** Changing the skeleton means a full rebuild — used for height/weight edits. */
  rebuildBody() {
    const keep = { state: this.animator ? this.animator.state : STATES.IDLE };
    const parent = this.root.parent;
    const pos = this.root.position.clone();
    const rot = this.root.rotation.clone();
    this.disposeMeshes();
    this.root.clear();
    this.build();
    this.root.position.copy(pos);
    this.root.rotation.copy(rot);
    if (this.animator) this.animator.setState(keep.state);
    if (parent && !this.root.parent) parent.add(this.root);
  }

  setHeight(meters) {
    const r = HEIGHT_RANGE[this.appearance.gender];
    this.appearance.body.height = clampv(meters, r.min, r.max);
    this.rebuildBody();
    return this.appearance.body.height;
  }
  setWeight(v) { this.appearance.body.weight = clamp01(v); this.rebuildBody(); }
  setMuscle(v) { this.appearance.body.muscle = clamp01(v); this.rebuildBody(); }
  setGender(g) {
    if (g !== 'male' && g !== 'female') return;
    this.appearance.gender = g;
    const r = HEIGHT_RANGE[g];
    this.appearance.body.gender = g;
    this.appearance.body.height = clampv(this.appearance.body.height, r.min, r.max);
    this.appearance.body.bustSize = g === 'female' ? 0.5 : 0;
    this.appearance.outfitIndex = 0;
    this.rebuildBody();
  }

  // -------------------------------------------------------------------------

  setGroundSampler(fn) { if (this.animator) this.animator.groundSampler = fn; }

  update(dt, move) {
    if (this.disposed || !this.animator) return;
    this.animator.update(dt, move, this.root);
  }

  /** Cheap distance LOD: drop facial detail and slow the rig when far away. */
  applyLod(distance) {
    const preset = settings.preset;
    const near = preset.npcDetailDistance;
    this.visibleDetail = distance < near ? 1 : distance < near * 2.2 ? 0.5 : 0.2;
    const facial = this.visibleDetail > 0.6 && preset.facialAnimation;
    if (this.animator) {
      this.animator.rig.facial = facial;
      // Three animation tiers, matching what you can actually resolve:
      // full up close, no face or fingers in the middle, body pose only far off.
      this.animator.setLod(this.visibleDetail > 0.6 ? 0 : this.visibleDetail > 0.25 ? 1 : 2);
    }
    if (this.face) {
      const show = this.visibleDetail > 0.3;
      for (const S of ['L', 'R']) {
        const e = this.face['eye' + S];
        if (e) e.visible = show;
      }
    }
    if (this.parts.brows) this.parts.brows.visible = this.visibleDetail > 0.45;
    if (this.parts.beard) this.parts.beard.visible = this.visibleDetail > 0.35;

    // Shoes are a few centimetres of geometry: past the detail radius they are
    // never more than a pixel or two, and the trouser hems already cover them.
    const shoes = this.visibleDetail > 0.3;
    if (this.parts.shoeL) this.parts.shoeL.visible = shoes;
    if (this.parts.shoeR) this.parts.shoeR.visible = shoes;

    // A person's shadow past the detail radius costs a full set of shadow-map
    // draw calls to produce a smudge nobody can read. Drop it.
    const wantShadow = !!this.opts.shadows && this.visibleDetail > 0.5;
    if (this._shadowLod !== wantShadow) {
      this._shadowLod = wantShadow;
      for (const k in this.parts) {
        const part = this.parts[k];
        if (part) part.traverse((o) => { if (o.isMesh && o.userData.wantsShadow !== false) o.castShadow = wantShadow; });
      }
    }
  }

  setShadowCasting(on) {
    for (const k in this.parts) {
      const p = this.parts[k];
      if (!p) continue;
      p.traverse((o) => { if (o.isMesh) { o.castShadow = on; } });
    }
  }

  worldHeadPosition(out) {
    const head = this.boneMap.head;
    out = out || new THREE.Vector3();
    if (head) { head.updateWorldMatrix(true, false); out.setFromMatrixPosition(head.matrixWorld); }
    else out.copy(this.root.position);
    return out;
  }

  worldEyePosition(out) {
    out = out || new THREE.Vector3();
    const pivot = this.face && this.face.eyeL;
    if (pivot) { pivot.updateWorldMatrix(true, false); out.setFromMatrixPosition(pivot.matrixWorld); }
    else this.worldHeadPosition(out);
    return out;
  }

  disposeMeshes() {
    for (const k in this.parts) disposeObject(this.parts[k]);
    this.parts = {};
  }

  dispose() {
    this.disposed = true;
    this.disposeMeshes();
    if (this.root.parent) this.root.parent.remove(this.root);
    this.root.clear();
  }
}

/** Dispose geometries and materials but leave shared textures to the cache. */
export function disposeObject(obj) {
  if (!obj) return;
  obj.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mm of mats) { if (mm && mm.dispose) mm.dispose(); }
    }
  });
}
