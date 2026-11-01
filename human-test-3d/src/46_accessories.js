// ============================================================================
// Detachable accessories (V1.06): hats, caps, beanies and glasses ride on the
// head bone and come off as small physics objects when the head is hit, in
// blasts, or when the wearer falls and the head meets the ground. Reset puts
// them back. Non-graphic by design; can be switched off in Settings.
// ============================================================================
const ACC_HAIR_PAD = { bald: 0.003, buzz: 0.006, short: 0.012, sidepart: 0.014, quiff: 0.02, curly_short: 0.02, pixie: 0.012, medium: 0.018,
  long_straight: 0.016, long_wavy: 0.02, bob: 0.016, ponytail: 0.012, bun: 0.012, curly_long: 0.026, afro: 0.06 };
const _ac1 = new V3(), _ac2 = new V3(), _acq = new QT(), _acm = new M4();

// pick accessories for an appearance (deterministic per seed; never on the horror characters)
function pickAccessories(app) {
  if (app.special) return [];
  const h = hash32(app.seed, 3131), out = [];
  const hatOK = app.hairStyle !== 'afro' && app.hairStyle !== 'bun' && app.hairStyle !== 'curly_long';
  const r1 = h % 100, r2 = (h >>> 8) % 100, r3 = (h >>> 16) % 100;
  if (hatOK && r1 < 22) out.push(r2 < 45 ? 'cap' : (r2 < 80 ? 'beanie' : 'fedora'));
  if (r3 < (app.age > 45 ? 34 : 16)) out.push(((h >>> 24) % 100) < 30 ? 'sunglasses' : 'glasses');
  return out;
}
function mergeGeometries(list) {
  const P = [], N = [], I = [];
  let base = 0;
  for (const g0 of list) {
    const g = g0.index ? g0 : g0;
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { P.push(p[i]); N.push(n[i]); }
    if (g.index) for (const k of g.index.array) I.push(k + base);
    else for (let k = 0; k < p.length / 3; k++) I.push(k + base);
    base += p.length / 3;
    g0.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setIndex(I);
  out.computeBoundingSphere();
  return out;
}

class AccessorySystem {
  constructor(game) {
    this.game = game;
    this.mats = {
      frame: new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.35, metalness: 0.2 }),
      lens: new THREE.MeshStandardMaterial({ color: 0xbfd6e6, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.22, depthWrite: false }),
      shade: new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.88 })
    };
    this.hatMats = new Map();
    Events.on('npcRemoved', (n) => this.detachAll(n, true));
  }
  get on() { return Settings.data.physics.looseAccessories !== false; }
  hatMat(hex) { let m = this.hatMats.get(hex); if (!m) { m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, side: THREE.DoubleSide }); this.hatMats.set(hex, m); } return m; }
  // build accessory meshes for an NPC, in the head bone's frame
  attach(npc) {
    this.detachAll(npc, true);
    const kinds = pickAccessories(npc.app);
    npc.acc = [];
    if (!kinds.length) return;
    const rig = npc.rig, S = rig.sHead, HC = rig.headCenter, hb = rig.bindPos[B.head];
    const pad = ACC_HAIR_PAD[npc.app.hairStyle] != null ? ACC_HAIR_PAD[npc.app.hairStyle] : 0.015;
    const h = hash32(npc.seed, 77);
    for (const kind of kinds) {
      const geos = [], lensGeos = [];
      // cranium approximation (head-local metres at sHead = 1): centre a little above and behind the eyes
      const cc = new V3(0, 0.032, -0.012), rx = 0.079 + pad, ry = 0.094 + pad, rz = 0.104 + pad;
      let mat, he, mass;
      const sdf = rig.headSdf;
      const O = [0, 0.035, -0.012];
      // radius of the skull (plus hair) along a head-local direction
      const skull = (x, y, z) => (sdf ? projectRay(sdf, O[0], O[1], O[2], x, y, z, 0.2) : 0.095) + pad + 0.004;
      if (kind === 'cap' || kind === 'beanie') {
        // a shell fitted over the skull, its axis tilted back so the band sits just above the brows
        const beanie = kind === 'beanie', tilt = -0.2, nT = 9, nP = 22;
        const P = [], N = [], I = [];
        const dirAt = (t, ph) => { const x = Math.sin(t) * Math.sin(ph), y = Math.cos(t), z = Math.sin(t) * Math.cos(ph); return [x, y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)]; };
        const tMax = (ph) => (beanie ? 1.68 : 1.6) + 0.13 * (1 - Math.cos(ph));
        const rows = [];
        for (let i = 0; i <= nT; i++) {
          const row = [];
          for (let j = 0; j <= nP; j++) {
            const ph = j / nP * TAU, t = tMax(ph) * (i / nT);
            const [x, y, z] = dirAt(Math.max(t, 1e-3), ph);
            const r = skull(x, y, z) + (beanie ? 0.006 : 0.002) + (i === nT && beanie ? 0.005 : 0);
            row.push([O[0] + x * r, O[1] + y * r, O[2] + z * r]);
          }
          rows.push(row);
        }
        if (beanie) { // folded cuff: a slightly larger band
          const last = rows[nT], cuff = last.map((p, j) => { const ph = j / nP * TAU, [x, y, z] = dirAt(tMax(ph) - 0.2, ph); const r = skull(x, y, z) + 0.013; return [O[0] + x * r, O[1] + y * r, O[2] + z * r]; });
          rows.splice(nT - 1, 0, cuff);
        }
        for (const row of rows) for (const p of row) P.push(p[0], p[1], p[2]);
        const W = nP + 1;
        for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < nP; j++) { const q = i * W + j; I.push(q, q + W, q + 1, q + 1, q + W, q + W + 1); }
        if (!beanie) { // visor: a curved peak from the front of the band
          const b0 = P.length / 3, nV = 10;
          for (let k = 0; k <= nV; k++) {
            const ph = lerp(-1.15, 1.15, k / nV), [x, y, z] = dirAt(tMax(ph), ph), r = skull(x, y, z) + 0.002;
            const ex = O[0] + x * r, ey = O[1] + y * r, ez = O[2] + z * r, ext = 0.068 * Math.pow(Math.cos(ph * 0.75), 0.6);
            P.push(ex, ey, ez, ex + Math.sin(ph) * ext * 0.5, ey - 0.012, ez + Math.cos(ph) * ext);
          }
          for (let k = 0; k < nV; k++) { const q = b0 + k * 2; I.push(q, q + 1, q + 2, q + 2, q + 1, q + 3); }
        }
        const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); gg.setIndex(I); gg.computeVertexNormals();
        geos.push(gg);
        mat = this.hatMat([0x1c2a44, 0x8a1f24, 0x1d1d20, 0x2f5a3a, 0xc9c3b5, 0x6a4a32, 0x3f6db0][h % 7]);
        he = new V3(0.085, 0.05, 0.1).multiplyScalar(S); mass = 0.25;
      } else if (kind === 'fedora') {
        const yb = 0.05, wx = skull(1, (yb - O[1]) * 4, 0) * 1.0, wzf = skull(0, (yb - O[1]) * 4, 1), wzb = skull(0, (yb - O[1]) * 4, -1);
        const rxc = Math.max(0.07, wx * 0.98), rzc = Math.max(0.085, (wzf + wzb) * 0.5), cz = O[2] + (wzf - wzb) * 0.5;
        const crown = new THREE.CylinderGeometry(rxc * 0.9, rxc, 0.1, 22, 1, false); crown.scale(1, 1, rzc / rxc); crown.translate(0, yb + 0.05, cz);
        const top = new THREE.SphereGeometry(1, 18, 6, 0, TAU, 0, 0.7); top.scale(rxc * 0.9, 0.022, rzc * 0.9); top.translate(0, yb + 0.1, cz);
        const brim = new THREE.CylinderGeometry(rxc + 0.05, rxc + 0.05, 0.004, 26); brim.scale(1, 1, (rzc + 0.05) / (rxc + 0.05)); brim.translate(0, yb + 0.003, cz);
        geos.push(crown, top, brim);
        mat = this.hatMat([0x2a2420, 0x3b3a36, 0x1a1816, 0x5a4a38][h % 4]);
        he = new V3(rxc + 0.05, 0.055, rzc + 0.05).multiplyScalar(S); mass = 0.3;
      } else { // glasses / sunglasses: two rims, bridge, temples back to the ears
        const ex = rig.eyeLocal.x, ez = rig.eyeLocal.z + 0.014, lw = 0.024, lh = kind === 'sunglasses' ? 0.019 : 0.016;
        for (const sg of [1, -1]) {
          const rim = new THREE.TorusGeometry(1, 0.075, 6, 20); rim.scale(lw, lh, 0.045); rim.translate(sg * ex, -0.002, ez);
          const lens = new THREE.CircleGeometry(1, 20); lens.scale(lw, lh, 1); lens.translate(sg * ex, -0.002, ez + 0.0005);
          const temple = new THREE.BoxGeometry(0.0024, 0.0035, ez + 0.012); temple.translate(sg * (ex + lw * 0.98), 0.002, (ez - 0.012) / 2 - 0.004);
          geos.push(rim, temple); lensGeos.push(lens);
        }
        const bridge = new THREE.BoxGeometry(ex * 2 - lw * 2 + 0.004, 0.0025, 0.003); bridge.translate(0, 0.004, ez + 0.002);
        geos.push(bridge);
        mat = this.mats.frame;
        he = new V3(0.07, 0.02, 0.05).multiplyScalar(S); mass = 0.08;
      }
      const g = mergeGeometries(geos); g.scale(S, S, S);
      const grp = new THREE.Group();
      const m = new THREE.Mesh(g, mat); m.castShadow = true; grp.add(m);
      if (lensGeos.length) { const lg = mergeGeometries(lensGeos); lg.scale(S, S, S); grp.add(new THREE.Mesh(lg, kind === 'sunglasses' ? this.mats.shade : this.mats.lens)); }
      grp.matrixAutoUpdate = false;
      // the accessory is modelled around the head centre; its offset from the head bone in bind space
      const local = new V3(HC.x - hb.x, HC.y - hb.y, HC.z - hb.z);
      this.game.scene.add(grp);
      npc.acc.push({ kind, grp, local, he, mass, body: null, owner: null });
    }
    this.update(npc);
  }
  // follow the head bone; loose ones follow their rigid bodies
  update(npc) {
    if (!npc.acc) return;
    const hp = npc.boneWPos[B.head], hq = npc.boneWRot[B.head];
    for (const a of npc.acc) {
      if (a.body) { a.grp.matrix.compose(a.body.pos, a.body.rot, _ac2.set(1, 1, 1)); a.grp.matrix.multiply(_acm.makeTranslation(-a.cOff.x, -a.cOff.y, -a.cOff.z)); a.grp.matrixWorldNeedsUpdate = true; continue; }
      _ac1.copy(a.local).applyQuaternion(hq).add(hp);
      a.grp.matrix.compose(_ac1, hq, _ac2.set(1, 1, 1));
      a.grp.matrixWorldNeedsUpdate = true;
      a.grp.visible = !(npc.gore && npc.gore.headGone);
    }
  }
  updateAll(dt) {
    const g = this.game, env = g.env;
    for (const npc of g.npcs.list) {
      if (!npc.acc || !npc.acc.length) continue;
      // falls: a hat comes off when the head hits the ground hard (or the head is gone)
      if (this.on && npc.physMode === 'ragdoll') {
        const hb = npc.rag.bodies[RAG.HEAD];
        const low = hb.pos.y - env.groundHeight(hb.pos.x, hb.pos.z, hb.pos.y) < 0.16 * npc.rig.H / 1.75;
        const fast = hb.vel.lengthSq() > 9;
        for (const a of npc.acc) if (!a.body && ((low && (a.kind !== 'glasses' && a.kind !== 'sunglasses' || fast)) || (fast && Math.random() < dt * 2))) this.knockOff(npc, a, hb.vel.clone().multiplyScalar(0.6));
      }
      if (this.on && npc.gore && npc.gore.headGone) for (const a of npc.acc) if (!a.body) this.knockOff(npc, a, _ac1.set((Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3));
      this.update(npc);
    }
  }
  // the head was struck (bullet, knife, blast): hats go, glasses usually do
  onHeadHit(npc, dir, force) {
    if (!this.on || !npc.acc) return;
    for (const a of npc.acc) {
      if (a.body) continue;
      const glasses = a.kind === 'glasses' || a.kind === 'sunglasses';
      if (glasses && Math.random() > 0.65) continue;
      const v = (dir ? dir.clone() : new V3(0, 0, 1)).multiplyScalar(clamp((force || 4) * 0.5, 1.5, 6)); v.y += 2.2;
      this.knockOff(npc, a, v);
    }
  }
  onBlast(npc, center, f) {
    if (!this.on || !npc.acc) return;
    for (const a of npc.acc) if (!a.body) { const d = npc.boneWPos[B.head].clone().sub(center).normalize(); this.knockOff(npc, a, d.multiplyScalar(4 + 8 * f).setY(4 + 4 * f)); }
  }
  knockOff(npc, a, vel) {
    if (a.body) return;
    const g = this.game, hp = npc.boneWPos[B.head], hq = npc.boneWRot[B.head];
    // rigid body centred on the accessory (its geometry centre in the group frame)
    const bs = a.grp.children[0].geometry.boundingSphere;
    a.cOff = bs.center.clone();
    const body = new RBody({ type: SHAPE.BOX, he: a.he.clone() }, a.mass);
    body.pos.copy(a.local).add(a.cOff).applyQuaternion(hq).add(hp);
    body.rot.copy(hq); body.prevPos.copy(body.pos); body.prevRot.copy(body.rot);
    body.vel.copy(vel || _ac1.set(0, 1, 0));
    body.omega.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    body.friction = 0.8; body.restitution = 0.15; body.linDamp = 0.08; body.angDamp = 0.4;
    const owner = { type: 'accessory', body, mesh: a.grp, radius: Math.max(a.he.x, a.he.z), physKind: 'prop', bodies: [body], canSleep: true, asleep: false, sleepTimer: 0, acc: a, npc };
    body.owner = owner; body.tag = 'prop';
    g.physics.addBody(body); g.physics.owners.add(owner);
    a.body = body; a.owner = owner;
    HT.log('hit', `${npc.idStr} lost ${a.kind === 'cap' || a.kind === 'beanie' || a.kind === 'fedora' ? 'their ' + a.kind : 'their ' + a.kind}`);
  }
  // back on the head (reset / revive)
  restore(npc) {
    if (!npc.acc) return;
    for (const a of npc.acc) if (a.body) { this.game.physics.removeBody(a.body); this.game.physics.removeOwner(a.owner); a.body = null; a.owner = null; }
    this.update(npc);
  }
  restoreAll() { for (const n of this.game.npcs.list) this.restore(n); }
  detachAll(npc, dispose) {
    if (!npc.acc) return;
    for (const a of npc.acc) {
      if (a.body) { this.game.physics.removeBody(a.body); this.game.physics.removeOwner(a.owner); }
      this.game.scene.remove(a.grp);
      if (dispose) for (const c of a.grp.children) c.geometry.dispose();
    }
    npc.acc = [];
  }
}
HT.AccessorySystem = AccessorySystem;
