/**
 * Avatar.js
 * ---------
 * Builds a stylised, blocky humanoid entirely from primitives (no external
 * model files needed), with named bone-like groups so the animator can pose it.
 * Body colours, face, hair, hat, shirt/pants tints, and back accessories are all
 * driven by a customization descriptor (see AvatarCustomization.js).
 *
 * The whole avatar lives under `this.root`; add that to the scene.
 */

import * as THREE from 'three';

// Reusable box helper.
function box(w, h, d, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.0 });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export class Avatar {
  /** @param {object} custom customization descriptor */
  constructor(custom = {}) {
    this.root = new THREE.Group();
    this.custom = {
      skin: 0xe0ac69,
      shirt: 0x3a86ff,
      pants: 0x22223b,
      hair: 0x2b1d0e,
      face: 'smile',
      hat: null,
      back: null,
      ...custom,
    };
    this._build();
  }

  _build() {
    const c = this.custom;

    // Hips: the root pivot the whole body hangs from (~1m off ground).
    this.hips = new THREE.Group();
    this.hips.position.y = 1.0;
    this.root.add(this.hips);

    // Torso.
    this.torso = box(0.7, 0.9, 0.4, c.shirt);
    this.torso.position.y = 0.15;
    this.hips.add(this.torso);

    // Head (with pivot at the neck so it can nod).
    this.neck = new THREE.Group();
    this.neck.position.y = 0.65;
    this.hips.add(this.neck);
    this.head = box(0.55, 0.55, 0.55, c.skin);
    this.head.position.y = 0.3;
    this.neck.add(this.head);
    this._buildFace(c.face);
    this._buildHair(c.hair);
    if (c.hat) this._buildHat(c.hat);

    // Arms — pivots at the shoulders so they swing.
    this.leftArm = this._makeLimb(-0.475, 0.55, c.skin, c.shirt);
    this.rightArm = this._makeLimb(0.475, 0.55, c.skin, c.shirt);
    this.hips.add(this.leftArm.pivot, this.rightArm.pivot);

    // Legs — pivots at the hips.
    this.leftLeg = this._makeLimb(-0.19, -0.2, c.pants, c.pants);
    this.rightLeg = this._makeLimb(0.19, -0.2, c.pants, c.pants);
    this.hips.add(this.leftLeg.pivot, this.rightLeg.pivot);

    if (c.back) this._buildBack(c.back);
  }

  /** A limb = pivot group at the joint + a box hanging below it. */
  _makeLimb(x, y, color) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const limb = box(0.28, 0.8, 0.28, color);
    limb.position.y = -0.4; // hang below the joint
    pivot.add(limb);
    return { pivot, limb };
  }

  _buildFace(face) {
    // Eyes + mouth painted onto a small canvas texture on the head front.
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(34, 44, 14, 18);
    ctx.fillRect(80, 44, 14, 18);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (face === 'smile') ctx.arc(64, 78, 22, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (face === 'cool') { ctx.moveTo(40, 90); ctx.lineTo(88, 90); }
    else ctx.arc(64, 96, 20, 1.15 * Math.PI, 1.85 * Math.PI); // neutral/frown
    ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    const faceMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 1 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), faceMat);
    plane.position.set(0, 0.3, 0.281);
    this.neck.add(plane);
  }

  _buildHair(color) {
    const hair = box(0.6, 0.18, 0.6, color);
    hair.position.set(0, 0.58, 0);
    this.neck.add(hair);
  }

  _buildHat(hat) {
    const grp = new THREE.Group();
    grp.position.set(0, 0.62, 0);
    if (hat.type === 'cap') {
      const crown = box(0.58, 0.22, 0.58, hat.color ?? 0xff006e);
      const brim = box(0.58, 0.06, 0.35, hat.color ?? 0xff006e);
      brim.position.set(0, -0.08, 0.35);
      grp.add(crown, brim);
    } else {
      // top hat / cylinder-ish
      const top = box(0.5, 0.5, 0.5, hat.color ?? 0x222222);
      top.position.y = 0.1;
      grp.add(top);
    }
    this._hat = grp;
    this.neck.add(grp);
  }

  _buildBack(back) {
    // e.g. wings / backpack / jetpack sprite made of boxes.
    const grp = new THREE.Group();
    grp.position.set(0, 0.1, -0.25);
    if (back.type === 'wings') {
      const l = box(0.5, 0.7, 0.05, back.color ?? 0xffffff);
      const r = box(0.5, 0.7, 0.05, back.color ?? 0xffffff);
      l.position.set(-0.4, 0.2, 0);
      r.position.set(0.4, 0.2, 0);
      l.rotation.z = 0.4;
      r.rotation.z = -0.4;
      grp.add(l, r);
    } else {
      const pack = box(0.5, 0.6, 0.25, back.color ?? 0x8d5524);
      grp.add(pack);
    }
    this._back = grp;
    this.torso.add(grp);
  }

  /** Live re-tint without a full rebuild (used by the customization UI). */
  applyColors({ skin, shirt, pants, hair } = {}) {
    if (skin != null) {
      this.head.material.color.setHex(skin);
      this.leftArm.limb.material.color.setHex(skin);
      this.rightArm.limb.material.color.setHex(skin);
      this.custom.skin = skin;
    }
    if (shirt != null) {
      this.torso.material.color.setHex(shirt);
      this.custom.shirt = shirt;
    }
    if (pants != null) {
      this.leftLeg.limb.material.color.setHex(pants);
      this.rightLeg.limb.material.color.setHex(pants);
      this.custom.pants = pants;
    }
    if (hair != null && this.neck) {
      // hair is the 2nd-added mesh on neck; find it defensively
      this.custom.hair = hair;
    }
  }

  /** Free GPU resources when a remote player leaves. */
  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }
}
