// ============================================================================
// NPC: appearance + rig + skinned mesh + animator + ragdoll + life state.
// Life states: alive -> dead -> (reanimating -> zombie) -> destroyed
// Physics modes: 'anim' (kinematic ragdoll follows animation), 'ragdoll', 'getup'
// ============================================================================
let NPC_SEQ = 0;
const LIFE_TRANSITIONS = {
  alive: ['dead'], dead: ['reanimating', 'alive'], reanimating: ['zombie', 'dead', 'alive'], zombie: ['destroyed', 'alive'], destroyed: ['alive']
};
function makePersonality(seed) {
  const r = new RNG(hash32(seed, 909));
  return {
    reaction: r.range(0.08, 0.5), bravery: r.next(), curiosity: r.next(), fidget: r.range(0.3, 1.2),
    cadence: r.range(0.93, 1.07), stepLift: r.range(0.85, 1.15), bounce: r.range(0.8, 1.25), armSwing: r.range(0.75, 1.3),
    leanMul: r.range(0.8, 1.2), slouch: r.range(-0.03, 0.08), headTilt: r.range(-0.05, 0.05),
    walkSpeed: r.range(1.15, 1.55), runSpeed: r.range(3.6, 5.0), animSpeed: r.range(0.85, 1.15),
    flinch: r.int(0, 2), cover: r.int(0, 2), toughness: r.range(0.8, 1.25), sociable: r.next(), zombieSpeed: r.range(0.8, 1.2)
  };
}

class NPC {
  constructor(game, app, shell) {
    this.game = game;
    this.id = ++NPC_SEQ; this.idStr = '#' + pad3(this.id);
    this.app = app; this.seed = app.seed; this.name = app.name;
    this.rig = buildRigSpec(app);
    this.personality = makePersonality(app.seed);
    this.quality = Settings.data.graphics.characterDetail;
    this.setupMesh(shell);
    this.root = { pos: new V3(), yaw: 0 };
    this.anim = new Animator(this);
    this.rag = new Ragdoll(this);
    this.rag.addToWorld(game.physics);
    this.boneWPos = []; this.boneWRot = [];
    for (let i = 0; i < NUM_BONES; i++) { this.boneWPos.push(new V3()); this.boneWRot.push(new QT()); }
    this.lifeState = 'alive'; this.maxHealth = 100; this.health = 100;
    this.regionDamage = new Float32Array(REGION_COUNT); this.hitCounts = new Uint16Array(REGION_COUNT);
    this.criticalHead = false; this.physMode = 'anim';
    this.reinc = { state: 'none', timer: 0, delay: 0, eligible: false, reason: '' };
    this.fear = 0; this.downTimer = 0; this.settleTimer = 0; this.knockouts = 0;
    this.lastHit = null; this.lastReaction = 'None'; this.flash = 0; this.highlight = 0;
    this.brain = null; this.zombieTarget = null; this.isZombie = false;
    this.deathTime = 0; this.removed = false; this.carried = false;
    this.spawn = { pos: new V3(), yaw: 0 };
    this.kills = 0; this.label = null; this.gore = null; this.infection = null;
  }
  setupMesh(shell) {
    const geo = buildCharacterGeometry(this.app, this.rig, this.quality);
    this.vertexCount = geo.userData.vertexCount;
    if (shell) {
      this.mesh = shell.mesh; this.bones = shell.bones; this.material = shell.material;
      this.mesh.geometry = geo;
      for (let b = 0; b < NUM_BONES; b++) { this.bones[b].position.copy(this.rig.localOffset[b]); this.bones[b].quaternion.identity(); this.bones[b].scale.set(1, 1, 1); }
      this.mesh.updateMatrixWorld(true);
      this.mesh.skeleton.calculateInverses();
      this.mesh.bind(this.mesh.skeleton);
      const u = this.material.userData.u; u.uZombie.value = 0; u.uFlash.value = 0; u.uHighlight.value = 0; u.uWet.value = 0; if (u.uWN) { u.uWN.value = 0; u.uBlood.value = 0; }
    } else {
      const bones = [];
      for (let b = 0; b < NUM_BONES; b++) {
        const bone = new THREE.Bone(); bone.name = BONE_NAMES[b]; bone.position.copy(this.rig.localOffset[b]); bones.push(bone);
        if (BONE_PARENT[b] >= 0) bones[BONE_PARENT[b]].add(bone);
      }
      this.material = createCharacterMaterial();
      this.mesh = new THREE.SkinnedMesh(geo, this.material);
      this.mesh.add(bones[0]);
      this.mesh.bind(new THREE.Skeleton(bones));
      this.bones = bones;
    }
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.boundingSphere = new THREE.Sphere(new V3(), 2);
    this.mesh.userData.npc = this;
    this.mesh.name = 'npc' + this.id;
    // skinned-position cache for precise hit tests
    this.skinCacheFrame = -1; this.skinned = null;
  }
  place(pos, yaw) {
    this.root.pos.copy(pos); this.root.yaw = yaw || 0;
    this.root.pos.y = this.game.env.groundHeight(pos.x, pos.z);
    this.spawn.pos.copy(this.root.pos); this.spawn.yaw = this.root.yaw;
    this.anim.resetFeet(this.root.pos, this.root.yaw, this.game.env);
    this.anim.update(0.016, this.root, this.game.env);
    this.computeWorldBones();
    this.rag.setFromBones(this.boneWPos, this.boneWRot, true);
    this.updateBounds();
  }
  teleport(pos, yaw) {
    if (this.physMode !== 'anim') return;
    this.root.pos.copy(pos); this.root.pos.y = this.game.env.groundHeight(pos.x, pos.z);
    if (yaw != null) this.root.yaw = yaw;
    this.anim.resetFeet(this.root.pos, this.root.yaw, this.game.env);
    this.anim.prevRootPos.copy(this.root.pos); this.anim.vel.set(0, 0, 0);
  }
  setLife(next, why) {
    const cur = this.lifeState;
    if (cur === next) return false;
    if (!LIFE_TRANSITIONS[cur] || LIFE_TRANSITIONS[cur].indexOf(next) < 0) {
      HT.log('warn', `${this.idStr} invalid life transition ${cur} -> ${next} (ignored)`);
      return false;
    }
    this.lifeState = next;
    Events.emit('life', { npc: this, from: cur, to: next, why });
    return true;
  }
  get alive() { return this.lifeState === 'alive'; }
  get hostile() { return this.lifeState === 'zombie'; }
  // --- per-frame ------------------------------------------------------------------
  update(dt) {
    const env = this.game.env;
    if (this.physMode === 'anim' || this.physMode === 'getup') {
      this.anim.update(dt, this.root, env);
      this.computeWorldBones();
      if (this.gore && this.gore.anyCut) this.syncDetached();
      this.rag.setFromBones(this.boneWPos, this.boneWRot, false);
    }
    // overlapping pairs (grapples / feeding) collide again once apart
    const nc = this.rag.noCollideWith;
    if (nc && !(this.brain && (this.brain.victim || this.brain.corpse)) && !this.grabbedBy) {
      const o = nc.npc;
      if (!o || o.removed || o.root.pos.distanceTo(this.root.pos) > 1.3) this.rag.noCollideWith = null;
    }
    // fx decay
    this.flash = Math.max(0, this.flash - dt * 4);
    const u = this.material.userData.u;
    u.uFlash.value = this.flash;
    u.uHighlight.value = damp(u.uHighlight.value, this.highlight, 10, dt);
    u.uWet.value = env.current && env.current.wet ? damp(u.uWet.value, 1, 0.3, dt) : damp(u.uWet.value, 0, 0.5, dt);
    if (this.isZombie) u.uZombie.value = Math.min(1, u.uZombie.value + dt * 0.6);
  }
  postPhysics(dt) {
    if (this.physMode === 'ragdoll') {
      this.syncFromRagdoll();
      // root follows pelvis (for AI/labels)
      const p = this.rag.bodies[RAG.PELVIS].pos;
      this.root.pos.set(p.x, this.game.env.groundHeight(p.x, p.z), p.z);
      this.handleDowned(dt);
    }
    this.updateBounds();
  }
  computeWorldBones() {
    const a = this.anim, c = Math.cos(this.root.yaw), s = Math.sin(this.root.yaw);
    _q1.setFromAxisAngle(UP, this.root.yaw);
    // recompute CS from final locals (snapshot blend / springs modify locals)
    a.csPos[B.hips].copy(a.hipsLocalPos); a.csRot[B.hips].copy(a.local[B.hips]);
    for (let i = 2; i < NUM_BONES; i++) a.updateCS(i);
    const rp = this.root.pos;
    for (let i = 0; i < NUM_BONES; i++) {
      const cp = a.csPos[i];
      this.boneWPos[i].set(rp.x + cp.x * c + cp.z * s, rp.y + cp.y, rp.z - cp.x * s + cp.z * c);
      this.boneWRot[i].multiplyQuaternions(_q1, a.csRot[i]);
    }
  }
  boneWorldPos(i, out) { return out.copy(this.boneWPos[i]); }
  syncFromRagdoll() {
    const W = this.boneWPos, Q = this.boneWRot, rag = this.rag, bones = this.bones, off = this.rig.localOffset;
    W[0].set(0, 0, 0); Q[0].identity();
    bones[0].position.set(0, 0, 0); bones[0].quaternion.identity();
    for (let i = 1; i < NUM_BONES; i++) {
      const p = BONE_PARENT[i];
      const ri = BONE_TO_RAG[i];
      if (ri >= 0) {
        rag.boneWorldFromBody(ri, _v1, Q[i]);
        if (i === B.hips || rag.detached[ri]) W[i].copy(_v1);
        else W[i].copy(off[i]).applyQuaternion(Q[p]).add(W[p]);
      } else {
        if (i === B.neck) Q[i].slerpQuaternions(Q[B.chest], _q2.copy(Q[B.chest]), 0); // provisional
        else if (i === B.jaw) Q[i].multiplyQuaternions(Q[p], _q2.setFromAxisAngle(LEFT, this.lifeState === 'alive' ? 0.02 : 0.12));
        else if (i === B.fingers1_L || i === B.fingers1_R) { const sd = i === B.fingers1_L ? 0 : 1; Q[i].multiplyQuaternions(Q[p], _q2.setFromAxisAngle(this.anim.flexAxis[sd], 0.55)); }
        else if (i === B.fingers2_L || i === B.fingers2_R) { const sd = i === B.fingers2_L ? 0 : 1; Q[i].multiplyQuaternions(Q[p], _q2.setFromAxisAngle(this.anim.flexAxis[sd], 0.7)); }
        else if (i === B.lid_L || i === B.lid_R) Q[i].multiplyQuaternions(Q[p], _q2.setFromAxisAngle(LEFT, this.lifeState === 'dead' || this.lifeState === 'destroyed' ? 0.5 : 0.3));
        else Q[i].copy(Q[p]);
        W[i].copy(off[i]).applyQuaternion(Q[p]).add(W[p]);
      }
      // neck: halfway between chest and head (head is driven after neck in order, fix below)
    }
    // fix neck to halfway and recompute head position chain
    const headFree = rag.detached[RAG.HEAD];
    Q[B.neck].slerpQuaternions(Q[B.chest], headFree ? Q[B.chest] : Q[B.head], 0.5);
    W[B.neck].copy(off[B.neck]).applyQuaternion(Q[B.chest]).add(W[B.chest]);
    // head's position from neck (unless the head is severed and simulates on its own)
    if (!headFree) W[B.head].copy(off[B.head]).applyQuaternion(Q[B.neck]).add(W[B.neck]);
    for (const c of [B.jaw, B.eye_L, B.eye_R, B.lid_L, B.lid_R, B.hair]) W[c].copy(off[c]).applyQuaternion(Q[B.head]).add(W[B.head]);
    // locals
    for (let i = 1; i < NUM_BONES; i++) {
      const p = BONE_PARENT[i];
      _q3.copy(Q[p]).invert();
      bones[i].quaternion.multiplyQuaternions(_q3, Q[i]);
      const ri = BONE_TO_RAG[i];
      if (ri >= 0 && rag.detached[ri] && i !== B.hips) bones[i].position.copy(W[i]).sub(W[p]).applyQuaternion(_q3);
    }
    bones[B.hips].position.copy(W[B.hips]);
  }
  // severed parts follow their own (dynamic) ragdoll bodies while the rest is animated
  syncDetached() {
    const G = this.gore, rag = this.rag, W = this.boneWPos, Q = this.boneWRot, bones = this.bones, off = this.rig.localOffset;
    for (let i = 1; i < NUM_BONES; i++) {
      if (!G.boneDetached[i]) continue;
      const p = BONE_PARENT[i], ri = BONE_TO_RAG[i];
      if (ri >= 0 && rag.detached[ri]) rag.boneWorldFromBody(ri, W[i], Q[i]);
      else { Q[i].multiplyQuaternions(Q[p], bones[i].quaternion); W[i].copy(off[i]).applyQuaternion(Q[p]).add(W[p]); }
    }
    for (let i = 1; i < NUM_BONES; i++) {
      if (!G.boneDetached[i]) continue;
      const ri = BONE_TO_RAG[i];
      if (ri < 0 || !rag.detached[ri]) continue;
      const p = BONE_PARENT[i];
      _q3.copy(Q[p]).invert();
      bones[i].quaternion.multiplyQuaternions(_q3, Q[i]);
      bones[i].position.copy(W[i]).sub(W[p]).applyQuaternion(_q3);
    }
  }
  // world position of one vertex with the current skinning matrices
  skinVertexWorld(vi, out) {
    const g = this.mesh.geometry, pos = g.attributes.position.array, si = g.attributes.skinIndex.array, sw = g.attributes.skinWeight.array;
    const bm = this.mesh.skeleton.boneMatrices;
    const x = pos[vi * 3], y = pos[vi * 3 + 1], z = pos[vi * 3 + 2];
    let ox = 0, oy = 0, oz = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw[vi * 4 + k]; if (w === 0) continue;
      const o = si[vi * 4 + k] * 16;
      ox += w * (bm[o] * x + bm[o + 4] * y + bm[o + 8] * z + bm[o + 12]);
      oy += w * (bm[o + 1] * x + bm[o + 5] * y + bm[o + 9] * z + bm[o + 13]);
      oz += w * (bm[o + 2] * x + bm[o + 6] * y + bm[o + 10] * z + bm[o + 14]);
    }
    return out.set(ox, oy, oz);
  }
  updateBounds() {
    const bs = this.mesh.boundingSphere;
    bs.center.copy(this.physMode === 'ragdoll' ? this.boneWPos[B.hips] : this.boneWPos[B.hips]);
    bs.radius = this.rig.H * 0.75 + 0.25;
  }
  // --- ragdoll control ---------------------------------------------------------------
  goRagdoll(reason, deadDamping) {
    if (this.physMode === 'ragdoll') { this.rag.setDynamic(true, deadDamping); return; }
    if (this.physMode === 'getup') this.anim.clip = null;
    this.physMode = 'ragdoll';
    // make sure kinematic bodies match the latest pose
    this.rag.setDynamic(true, deadDamping);
    this.settleTimer = 0;
    this.downTimer = 1.4 + Math.random() * 1.2;
    this.lastReaction = reason || 'Ragdoll';
    if (this.brain) this.brain.state = 'down';
  }
  handleDowned(dt) {
    if ((this.lifeState !== 'alive' && this.lifeState !== 'zombie') || this.carried) return;
    this.downTimer -= dt;
    const v = this.rag.asleep ? 0 : this.rag.maxSpeed();
    if (v < 0.35) this.settleTimer += dt; else this.settleTimer = 0;
    if (this.downTimer <= 0 && this.settleTimer > 0.5 && Settings.data.ai.enabled !== false) this.startGetUp(this.lifeState === 'zombie');
  }
  startGetUp(asZombie) {
    if ((this.gore && this.gore.lostLegs > 0) || (this.isZombie && this.anim.zstyle && this.anim.zstyle.crawl)) return this.startCrawl(asZombie);
    const rag = this.rag;
    const pel = rag.bodies[RAG.PELVIS], head = rag.bodies[RAG.HEAD];
    // chest facing
    rag.boneWorldFromBody(RAG.CHEST, _v1, _q1);
    const fwd = _v2.set(0, 0, 1).applyQuaternion(_q1);
    const faceDown = fwd.y < 0;
    const axis = _v3.subVectors(head.pos, pel.pos); axis.y = 0;
    if (axis.lengthSq() < 1e-6) axis.set(0, 0, 1);
    axis.normalize();
    const yaw = faceDown ? Math.atan2(axis.x, axis.z) : Math.atan2(-axis.x, -axis.z);
    const env = this.game.env;
    const rp = _v4.set(pel.pos.x, 0, pel.pos.z);
    env.clampToBounds(rp, 0.5);
    rp.y = env.groundHeight(rp.x, rp.z);
    // set the new root, then express current pose relative to it
    this.root.pos.copy(rp); this.root.yaw = yaw;
    this.bones[0].position.copy(rp); this.bones[0].quaternion.setFromAxisAngle(UP, yaw);
    _q2.setFromAxisAngle(UP, -yaw);
    const hw = this.boneWPos[B.hips].clone().sub(rp).applyQuaternion(_q2);
    this.bones[B.hips].position.copy(hw);
    this.bones[B.hips].quaternion.premultiply(_q2);
    this.anim.takeSnapshot(asZombie ? 0.8 : 0.5);
    this.anim.resetFeet(rp, yaw, env);
    this.anim.prevRootPos.copy(rp);
    const keys = getUpKeys(faceDown);
    this.anim.playClip(asZombie ? 'zombieRise' : 'getUp', keys, () => {
      if (this.physMode === 'getup') this.physMode = 'anim';
      if (asZombie) Events.emit('zombieRisen', this);
      if (this.brain) this.brain.state = 'idle';
    });
    this.anim.clip.speed = asZombie ? 0.55 : this.personality.animSpeed;
    this.anim.clip.zombie = asZombie;
    this.rag.setDynamic(false);
    this.physMode = 'getup';
    this.lastReaction = asZombie ? 'Reanimating' : 'Recovering (Get Up)';
    Events.emit('npcGetUp', this);
  }
  // legs severed: blend from the ragdoll pose into a prone crawl
  startCrawl(asZombie) {
    const rag = this.rag, pel = rag.bodies[RAG.PELVIS], ch = rag.bodies[RAG.CHEST];
    const axis = _v3.subVectors(ch.pos, pel.pos); axis.y = 0;
    if (axis.lengthSq() < 1e-6) axis.set(0, 0, 1);
    axis.normalize();
    const yaw = Math.atan2(axis.x, axis.z);
    const env = this.game.env;
    const rp = _v4.set(pel.pos.x, 0, pel.pos.z);
    env.clampToBounds(rp, 0.5); rp.y = env.groundHeight(rp.x, rp.z);
    this.root.pos.copy(rp); this.root.yaw = yaw;
    this.bones[0].position.copy(rp); this.bones[0].quaternion.setFromAxisAngle(UP, yaw);
    _q2.setFromAxisAngle(UP, -yaw);
    const hw = this.boneWPos[B.hips].clone().sub(rp).applyQuaternion(_q2);
    this.bones[B.hips].position.copy(hw);
    this.bones[B.hips].quaternion.premultiply(_q2);
    this.anim.takeSnapshot(0.7);
    this.anim.resetFeet(rp, yaw, env); this.anim.prevRootPos.copy(rp);
    this.anim.crawl = 1; this.anim.crawlState = null; this.anim.clip = null;
    this.rag.setDynamic(false);
    this.physMode = 'anim';
    this.lastReaction = this.lifeState === 'zombie' ? 'Crawling (Legs Lost)' : 'Crawling (Leg Severed)';
    if (this.brain) this.brain.state = this.lifeState === 'zombie' || asZombie ? 'zIdle' : 'flee';
    Events.emit('npcGetUp', this);
    if (asZombie || this.lifeState === 'reanimating') Events.emit('zombieRisen', this);
  }
  // --- damage -----------------------------------------------------------------------
  applyHit(info) {
    // info: {region, damage, weapon, impulse(V3), point(V3), dir(V3), source}
    const W = Settings.data.weapons;
    const region = info.region;
    const mul = REGION_DAMAGE_MUL[region];
    let dmg = W.simulatedDamage ? info.damage * mul * W.damageScale : 0;
    if (this.lifeState === 'zombie') dmg *= region === REGION.HEAD ? 1.0 : 0.6;
    this.regionDamage[region] += dmg; this.hitCounts[region]++;
    const before = this.health;
    if (this.lifeState === 'alive' || this.lifeState === 'zombie') this.health = Math.max(0, this.health - dmg);
    if ((region === REGION.HEAD) && (info.weapon === 'sniper' || this.regionDamage[REGION.HEAD] >= 70 || (info.weapon === 'pistol' && dmg >= 60))) this.criticalHead = true;
    this.flash = Settings.data.gore.level === 'off' ? 1 : 0.25;
    this.lastHit = { region, regionName: REGION_NAMES[region], damage: dmg, weapon: info.weapon, time: this.game.time, point: info.point ? info.point.clone() : null };
    let killed = false;
    if (before > 0 && this.health <= 0) {
      if (this.lifeState === 'alive') { killed = this.die(info); }
      else if (this.lifeState === 'zombie') { killed = this.destroyZombie(info); }
    }
    return { dmg, killed };
  }
  die(info) {
    if (!this.setLife('dead', info && info.weapon)) return false;
    this.deathTime = this.game.time;
    this.fear = 0;
    this.anim.jawTarget = 0.1;
    this.goRagdoll('Ragdoll (Deceased)', true);
    this.lastReaction = 'Ragdoll (Deceased)';
    Events.emit('npcDied', { npc: this, info });
    return true;
  }
  destroyZombie(info) {
    if (!this.setLife('destroyed', 'zombie killed')) return false;
    this.deathTime = this.game.time;
    this.goRagdoll('Ragdoll (Destroyed)', true);
    Events.emit('npcDied', { npc: this, info, zombie: true });
    return true;
  }
  damageState() {
    if (this.lifeState === 'destroyed') return 'Destroyed (Zombie Neutralized)';
    if (this.lifeState === 'dead') return this.criticalHead ? 'Critical Head Trauma (Simulated)' : 'Deceased (Simulated)';
    if (this.lifeState === 'reanimating') return 'Reanimating';
    if (this.lifeState === 'zombie') return 'Reanimated (Zombie)';
    const h = this.health / this.maxHealth;
    if (h >= 0.999) return 'No Damage';
    if (h > 0.7) return 'Simulated Injury (Minor)';
    if (h > 0.4) return 'Simulated Injury (Moderate)';
    if (h > 0.15) return 'Simulated Injury (Severe)';
    return 'Critical (Simulated)';
  }
  physicsState() {
    if (this.physMode === 'ragdoll') return this.rag.asleep ? 'Ragdoll (Sleeping)' : 'Ragdoll (Active)';
    if (this.physMode === 'getup') return 'Blending (Anim <- Physics)';
    return 'Animated (Kinematic)';
  }
  // precise skinned vertex positions (CPU) for hit detection
  skinnedPositions() {
    const frame = this.game.frame;
    if (this.skinCacheFrame === frame && this.skinned) return this.skinned;
    const g = this.mesh.geometry, pos = g.attributes.position.array, si = g.attributes.skinIndex.array, sw = g.attributes.skinWeight.array;
    const n = pos.length / 3;
    if (!this.skinned || this.skinned.length !== pos.length) this.skinned = new Float32Array(pos.length);
    const out = this.skinned;
    this.mesh.skeleton.update();
    const bm = this.mesh.skeleton.boneMatrices;
    // boneMatrices = boneWorld * boneInverse (mesh at identity)
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      let ox = 0, oy = 0, oz = 0;
      for (let k = 0; k < 4; k++) {
        const w = sw[i * 4 + k]; if (w === 0) continue;
        const o = si[i * 4 + k] * 16;
        ox += w * (bm[o] * x + bm[o + 4] * y + bm[o + 8] * z + bm[o + 12]);
        oy += w * (bm[o + 1] * x + bm[o + 5] * y + bm[o + 9] * z + bm[o + 13]);
        oz += w * (bm[o + 2] * x + bm[o + 6] * y + bm[o + 10] * z + bm[o + 14]);
      }
      out[i * 3] = ox; out[i * 3 + 1] = oy; out[i * 3 + 2] = oz;
    }
    this.skinCacheFrame = frame;
    return out;
  }
  dispose() {
    this.rag.removeFromWorld();
    this.mesh.geometry.dispose();
    this.removed = true;
  }
}

// ============================================================================
class NPCManager {
  constructor(game) {
    this.game = game; this.list = []; this.selected = null; this.shellPool = [];
    this.spawnCounter = 0;
  }
  count(state) { return state ? this.list.filter(n => n.lifeState === state).length : this.list.length; }
  spawn(opts = {}) {
    const game = this.game;
    const seed = opts.seed != null ? opts.seed >>> 0 : newSeed();
    const ov = Object.assign({}, opts.overrides || {});
    if (opts.gender && opts.gender !== 'random') ov.gender = opts.gender;
    let app;
    try { app = generateAppearance(seed, ov); }
    catch (e) { reportError(e, 'appearance'); return null; }
    const shell = this.shellPool.pop() || null;
    let npc;
    try { npc = new NPC(game, app, shell); }
    catch (e) { reportError(e, 'npc-create'); if (shell) this.shellPool.push(shell); return null; }
    npc.overrides = ov;
    game.scene.add(npc.mesh);
    npc.place(opts.pos || new V3(), opts.yaw != null ? opts.yaw : Math.random() * TAU);
    game.ai.attach(npc);
    this.list.push(npc);
    if (opts.pose === 'ragdoll') { npc.goRagdoll('Spawned as Ragdoll'); npc.downTimer = 2.5; }
    else if (opts.pose === 'walk') { npc.brain.state = 'wander'; npc.brain.t = 99; }
    else if (opts.pose === 'tpose') { npc.brain.frozen = true; }
    else if (opts.pose && ARM_POSES[opts.pose]) { npc.anim.setUpper(opts.pose); npc.brain.holdPose = opts.pose; }
    Events.emit('npcSpawned', npc);
    return npc;
  }
  spawnMany(count, opts = {}) {
    const game = this.game, env = game.env.current;
    const mode = opts.mode || Settings.data.spawn.mode;
    const out = [];
    const base = opts.pos ? opts.pos.clone() : null;
    for (let i = 0; i < count; i++) {
      let p;
      if (mode === 'markers') { const sp = env.spawnPoints[(this.spawnCounter++) % env.spawnPoints.length]; p = sp.clone().add(new V3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4)); }
      else if (mode === 'random') { const b = env.bounds; const r = Math.min(b.maxX, b.maxZ, 14); p = new V3((Math.random() * 2 - 1) * r, 0, (Math.random() * 2 - 1) * r); }
      else if (mode === 'circle') { const a = i / count * TAU; const r = 1.2 + count * 0.25; p = (base || new V3()).clone().add(new V3(Math.sin(a) * r, 0, Math.cos(a) * r)); }
      else if (mode === 'line') { const c = base || new V3(); const d = game.player.right(); p = c.clone().addScaledVector(d, (i - (count - 1) / 2) * 0.85); }
      else if (mode === 'grid') { const n = Math.ceil(Math.sqrt(count)); const c = base || new V3(); p = c.clone().add(new V3((i % n - (n - 1) / 2) * 1.1, 0, (Math.floor(i / n) - (n - 1) / 2) * 1.1)); }
      else { // crosshair
        const c = base || game.player.groundTarget(8);
        const a = i * 2.39996, r = i === 0 ? 0 : 0.7 * Math.sqrt(i);
        p = c.clone().add(new V3(Math.sin(a) * r, 0, Math.cos(a) * r));
      }
      game.env.clampToBounds(p, 0.6);
      const yaw = opts.faceCamera === false ? Math.random() * TAU : Math.atan2(game.camera.position.x - p.x, game.camera.position.z - p.z) + (Math.random() - 0.5) * 0.6;
      const npc = this.spawn(Object.assign({}, opts, { pos: p, yaw }));
      if (npc) out.push(npc);
    }
    if (out.length) HT.log('sys', `Spawned ${out.length} subject${out.length > 1 ? 's' : ''} (${mode})`);
    return out;
  }
  remove(npc, silent) {
    const i = this.list.indexOf(npc); if (i < 0) return;
    this.list.splice(i, 1);
    if (this.selected === npc) this.select(null);
    this.game.scene.remove(npc.mesh);
    this.game.ai.detach(npc);
    if (this.game.gore) this.game.gore.releaseNPC(npc);
    Events.emit('npcRemoved', npc);
    npc.dispose();
    this.shellPool.push({ mesh: npc.mesh, bones: npc.bones, material: npc.material });
    if (!silent) HT.log('sys', `Removed ${npc.idStr} ${npc.name}`);
  }
  removeAll() { for (const n of this.list.slice()) this.remove(n, true); HT.log('sys', 'All subjects removed'); }
  removeDead() { let c = 0; for (const n of this.list.slice()) if (n.lifeState === 'dead' || n.lifeState === 'destroyed') { this.remove(n, true); c++; } HT.log('sys', `Removed ${c} deceased subject(s)`); }
  select(npc) {
    if (this.selected) this.selected.highlight = 0;
    this.selected = npc;
    if (npc) npc.highlight = 1;
    Events.emit('select', npc);
  }
  update(dt) {
    for (const n of this.list) {
      try { n.update(dt); }
      catch (e) { reportError(e, 'npc-update ' + n.idStr); n.errorCount = (n.errorCount || 0) + 1; if (n.errorCount > 5) { HT.log('error', `Removing malfunctioning NPC ${n.idStr}`); this.remove(n); break; } }
    }
  }
  postPhysics(dt) {
    for (const n of this.list) {
      try { n.postPhysics(dt); } catch (e) { reportError(e, 'npc-post ' + n.idStr); }
    }
  }
  regenerate(npc, overrides) {
    // rebuild appearance in place (edit), keep id/state at the same spot
    const pos = npc.root.pos.clone(), yaw = npc.root.yaw;
    const ov = Object.assign({}, npc.overrides || {}, overrides || {});
    const seed = ov.newSeed ? newSeed() : npc.seed;
    delete ov.newSeed;
    const idx = this.list.indexOf(npc);
    const wasSel = this.selected === npc;
    this.remove(npc, true);
    const n2 = this.spawn({ seed, overrides: ov, pos, yaw });
    if (n2 && idx >= 0) { this.list.splice(this.list.indexOf(n2), 1); this.list.splice(idx, 0, n2); }
    if (n2 && wasSel) this.select(n2);
    return n2;
  }
}
HT.NPCManager = NPCManager;
