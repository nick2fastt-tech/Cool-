// ============================================================================
// Vampires (V1.06): pale, fast, deliberate predators with their own look,
// movement styles, AI, bite and transformation. Independent of the zombie
// system: zombies ignore vampires, vampires ignore zombies, and the
// reincarnation system skips anyone a vampire has bitten.
//   npc.vamp.state: none -> bitten (countdown) -> turning -> vampire -> ash
//   player:         none -> bitten (countdown) -> turning -> vampire
// A vampire bite drains but does not kill a healthy person: the victim faints,
// recovers, and (with turning on) changes when the countdown runs out.
// ============================================================================
const VAMP_OUTFIT = 'Vampire';
const _vp1 = new V3(), _vp2 = new V3(), _vp3 = new V3(), _vp4 = new V3();
const VAMP_PREY_FLOOR = 12;   // a bite never drains a victim below this health

class VampireSystem {
  constructor(game) {
    this.game = game;
    this.player = { state: 'none', t: 0, dur: 0, beatT: 0, flash: 0, k: 0 };
    this.playerTarget = { isPlayer: true };
    this.ashes = [];   // destroyed vampires: restored by Reset Physics
    this.overlay = null;
    Events.on('settings', (e) => {
      if (!e) return;
      const S = Settings.data.vampires;
      if ((e.path === 'vampires.enabled' || e.path === '*') && !S.enabled) this.disableAll();
      if ((e.path === 'vampires.turning' || e.path === '*') && !S.turning) this.cancelTurning();
    });
  }
  get S() { return Settings.data.vampires; }
  log(t) { HT.log('vampire', t); }
  setState(v, b, s) { if (b.state !== s) { b.state = s; b.t = 0; } }
  eyeBase() { return this.S.glowEyes ? 0.5 : 0; }

  // --- creation -----------------------------------------------------------------------
  spawn(pos, opts = {}) {
    const g = this.game;
    if (!this.S.enabled) { HT.toast('Vampires are turned off (Settings > Gameplay)', 'bad'); return null; }
    const p = pos ? pos.clone() : g.player.groundTarget(8);
    g.env.clampToBounds(p, 0.6);
    const yaw = Math.atan2(g.camera.position.x - p.x, g.camera.position.z - p.z) + (Math.random() - 0.5) * 0.5;
    const npc = g.npcs.spawn({ seed: opts.seed, gender: opts.gender || 'random', pos: p, yaw, overrides: { outfit: VAMP_OUTFIT } });
    if (!npc) return null;
    npc.spawnKind = 'vampire';
    this.makeVampire(npc, { instant: true, why: 'spawned', style: opts.style });
    this.log(`${npc.idStr} ${npc.name} appeared (vampire, ${npc.anim.vstyle.name})`);
    return npc;
  }
  pickStyle(npc) {
    const h = hash32(npc.seed, 7177) % 100, t = npc.app.top.type;
    if (npc.app.cape) return VAMP_STYLES.aristocrat;
    if ((t === 'blazer' || t === 'longcoat' || t === 'shirt') && h < 50) return VAMP_STYLES.aristocrat;
    return VAMP_STYLES[VAMP_STYLE_NAMES[h % VAMP_STYLE_NAMES.length]];
  }
  // turn an NPC into an active vampire (instant: no transformation sequence)
  makeVampire(npc, o = {}) {
    if (npc.lifeState !== 'vampire' && !npc.setLife('vampire', o.why || 'vampire')) return false;
    const g = this.game;
    if (npc.brain) { g.ai.endGrab(npc); g.ai.endFeed(npc); }
    if (npc.grabbedBy && npc.grabbedBy.brain) g.ai.endGrab(npc.grabbedBy);
    npc.vamp = { state: 'vampire', t: 0, regenT: 9 };
    const st = (o.style && VAMP_STYLES[o.style]) || (npc.anim.vstyle && o.keepStyle ? npc.anim.vstyle : this.pickStyle(npc));
    const a = npc.anim;
    a.vstyle = st; a.gait = GAITS[st.name] || null; a.vampTarget = 1; if (o.instant) a.vamp = 1;
    a.zombie = 0; a.crawl = a.crawl || 0; a.limp[0] = a.limp[1] = 0;
    a.setPosture('stand'); a.setUpper('hang');
    if (a.action && a.action.type !== 'vturn') a.action = null;
    npc.isZombie = false; npc.infection = null; npc.zombieTarget = null; npc.fear = 0;
    npc.health = npc.maxHealth = 100; npc.criticalHead = false;
    if (npc.reinc.state === 'pending' || npc.reinc.state === 'transforming') npc.reinc.state = 'cancelled';
    const u = npc.material.userData.u;
    u.uZombie.value = 0;
    if (o.instant) { u.uVampire.value = this.S.pallor; u.uEyeGlow.value = this.eyeBase(); u.uFang.value = this.S.fangs ? 0.3 : 0; }
    if (npc.brain) { npc.brain.state = 'vIdle'; npc.brain.t = 0; npc.brain.pending.length = 0; npc.brain.cool = o.instant ? 1.5 : 3; npc.brain.vTarget = null; }
    npc.lastReaction = 'Vampire';
    Events.emit('vampire', { npc, kind: 'made' });
    return true;
  }
  // back to an ordinary human (used by resets, revives and turning the system off)
  cure(npc) {
    const u = npc.material.userData.u;
    u.uVampire.value = 0; u.uEyeGlow.value = 0; u.uFang.value = 0; u.uAsh.value = 0; u.uHeat.value = 0;
    const a = npc.anim;
    a.vamp = 0; a.vampTarget = 0; a.vstyle = null; a.gait = null; a.vStalk = 0; a.vStalkTarget = 0;
    if (a.action && (a.action.type[0] === 'v' || a.action.type === 'drained')) a.action = null;
    if (npc.brain && (npc.brain.vVictim)) this.endBite(npc, 'cured');
    if (a.clip && a.clip.name === 'vampireRise') { a.clip = null; if (npc.physMode === 'getup') npc.goRagdoll('Cured', false); }
    if (npc.lifeState === 'vampire') {
      npc.setLife('alive', 'cured');
      npc.health = Math.max(npc.health, 60);
      if (npc.brain) { npc.brain.state = 'idle'; npc.brain.t = 0; npc.brain.vTarget = null; }
      a.setPosture('stand'); a.setUpper('hang');
    }
    npc.vamp = { state: 'none' };
  }
  // bite registered: the countdown starts (turning must be on)
  markBitten(npc, src) {
    if (!this.S.turning || npc.horror) return false;
    if (npc.vamp && npc.vamp.state !== 'none') return false;
    npc.vamp = { state: 'bitten', t: 0, dur: this.S.turnTime * (0.9 + Math.random() * 0.2), src: src ? src.idStr : 'player', clutchT: 1.5 };
    // the vampire change wins over a zombie infection
    if (npc.reinc.state === 'pending') npc.reinc.state = 'cancelled';
    this.log(`${npc.idStr} ${npc.name} was bitten: turns in ${npc.vamp.dur.toFixed(1)}s`);
    return true;
  }
  cancelTurning() {
    for (const n of this.game.npcs.list) if (n.vamp && n.vamp.state === 'bitten') { this.cure(n); this.log(`${n.idStr} bite cured (turning off)`); }
    if (this.player.state === 'bitten') this.curePlayer();
  }
  // system switched off: spawned vampires leave, everyone else is restored, the player too
  disableAll() {
    const g = this.game;
    let removed = 0, cured = 0;
    for (const n of g.npcs.list.slice()) {
      if (n.brain && n.brain.vVictim) this.endBite(n, 'off');
      const V = n.vamp; if (!V || V.state === 'none') continue;
      if (n.spawnKind === 'vampire' || V.state === 'ash') { g.npcs.remove(n, true); removed++; continue; }
      this.cure(n); cured++;
    }
    this.ashes.length = 0;
    this.curePlayer();
    if (removed || cured) this.log(`vampires off: ${removed} removed, ${cured} restored`);
  }

  // --- per-frame ------------------------------------------------------------------------
  update(dt) {
    const g = this.game;
    if (this.S.enabled) {
      for (const npc of g.npcs.list.slice()) {
        const V = npc.vamp; if (!V || V.state === 'none' || npc.removed) continue;
        try { this.updateNPC(npc, V, dt); } catch (e) { reportError(e, 'vampire ' + npc.idStr); }
      }
    }
    this.updatePlayer(dt);
  }
  updateNPC(npc, V, dt) {
    const S = this.S, u = npc.material.userData.u, a = npc.anim;
    if (V.state === 'bitten') {
      V.t += dt;
      const k = clamp(V.t / V.dur, 0, 1);
      // subtle signs creep in: pallor, a faint glint in the eyes near the end
      u.uVampire.value = Math.max(u.uVampire.value, smoothstep(0.05, 1.0, k) * 0.45 * S.pallor);
      u.uEyeGlow.value = S.glowEyes ? smoothstep(0.82, 1.0, k) * 0.3 : 0;
      if (npc.lifeState === 'alive' && npc.physMode === 'anim' && npc.brain && !npc.grabbedBy) {
        for (let s = 0; s < 2; s++) a.limp[s] = Math.max(a.limp[s], 0.15 + 0.25 * k);
        V.clutchT -= dt;
        if (V.clutchT <= 0) {
          V.clutchT = 3.5 + Math.random() * 4;
          if (npc.brain.state === 'idle') { a.setUpper('clutch', REGION.NECK); a.idleTimer = 2.5; }
          if (k > 0.5) { a.kick(B.chest, _vp1.set(1.4, 0, 0)); this.game.audio.play('gasp' + (Math.random() < 0.5 ? 0 : 1), { pos: npc.boneWPos[B.head].clone(), gain: 0.5 }); }
        }
      }
      if (S.turning && k >= 1 && npc.physMode !== 'getup' && !npc.carried) this.beginTurn(npc);
      return;
    }
    if (V.state === 'turning') { this.updateTurn(npc, V, dt); return; }
    if (V.state === 'vampire') {
      const b = npc.brain, act = a.action;
      const hunting = b && (b.state === 'vRush' || b.state === 'vBite' || b.state === 'vBiteDown' || b.state === 'vPlayerBite');
      const bare = hunting || (act && (act.type === 'vhiss' || act.type === 'vbite' || act.type === 'vbiteDown') && !act.ending);
      u.uVampire.value = damp(u.uVampire.value, S.pallor, 1.5, dt);
      u.uEyeGlow.value = damp(u.uEyeGlow.value, S.glowEyes ? (hunting ? 1.0 : 0.5) : 0, 4, dt);
      u.uFang.value = damp(u.uFang.value, S.fangs ? (bare ? 1 : 0.3) : 0, 7, dt);
      u.uZombie.value = 0;
      // wounds close: a vampire regenerates when left alone for a few seconds
      V.regenT += dt;
      if (V.regenT > 3 && npc.health < npc.maxHealth) npc.health = Math.min(npc.maxHealth, npc.health + dt * 6);
      return;
    }
    if (V.state === 'ash') this.updateAsh(npc, V, dt);
  }

  // --- transformation ---------------------------------------------------------------------
  beginTurn(npc) {
    const V = npc.vamp, g = this.game;
    if (V.state !== 'bitten') return;
    const from = npc.lifeState;
    if (from !== 'alive' && from !== 'dead') return;
    if (npc.grabbedBy && npc.grabbedBy.brain) g.ai.endGrab(npc.grabbedBy);
    if (npc.brain) { g.ai.endGrab(npc); g.ai.endFeed(npc); }
    if (npc.reinc.state === 'pending' || npc.reinc.state === 'transforming') npc.reinc.state = 'cancelled';
    if (!npc.setLife('vampire', 'turned')) return;
    npc.infection = null; npc.isZombie = false; npc.anim.zombie = 0; npc.zombieTarget = null;
    npc.material.userData.u.uZombie.value = 0;
    npc.anim.vstyle = this.pickStyle(npc); npc.anim.gait = GAITS[npc.anim.vstyle.name] || null;
    V.state = 'turning'; V.t = 0; V.rising = false; V.pallor0 = npc.material.userData.u.uVampire.value;
    if (npc.brain) { npc.brain.state = 'vTurn'; npc.brain.t = 0; npc.brain.speed = 0; npc.brain.vTarget = null; }
    if (npc.physMode === 'anim' && from === 'alive') {
      V.mode = 'stand'; V.dur = 4.6;
      npc.anim.setAction('vturn', { dur: 4.4, inT: 0.25, outT: 0.7 });
      npc.anim.setUpper('hang'); npc.anim.clearLook();
    } else {
      V.mode = 'rise'; V.dur = 5.4; V.riseAt = 1.3;
      if (npc.physMode !== 'ragdoll') npc.goRagdoll('Turning (Vampire)', true);
    }
    npc.lastReaction = 'Turning (Vampire)';
    g.audio.play('vampTurn', { pos: npc.boneWPos[B.chest].clone(), gain: 0.9 });
    HT.toast(`${npc.name} ${npc.idStr} is turning into a vampire...`, 'v');
    this.log(`${npc.idStr} ${npc.name} is turning (${V.mode})`);
  }
  updateTurn(npc, V, dt) {
    const S = this.S, u = npc.material.userData.u, a = npc.anim;
    V.t += dt;
    // knocked down mid-turn: the change continues on the ground and the body rises when it ends
    if (V.mode === 'stand' && npc.physMode === 'ragdoll') { V.mode = 'rise'; V.riseAt = V.t + 1; V.rising = false; V.dur = Math.max(V.dur, V.t + 4); a.action = null; }
    if (V.mode === 'rise') {
      if (V.rising && npc.physMode === 'ragdoll') { V.rising = false; V.riseAt = V.t + 1; V.dur = Math.max(V.dur, V.t + 4); }
      if (!V.rising && npc.physMode === 'ragdoll' && V.t >= V.riseAt) {
        const settled = npc.rag.asleep || npc.rag.maxSpeed() < 0.8;
        if (settled && !npc.carried) { V.rising = true; this.startRise(npc); V.riseStart = V.t; V.dur = V.t + (npc.anim.clip ? npc.anim.clip.dur / (npc.anim.clip.speed || 1) : 1); }
        else V.riseAt = V.t + 0.3;
      }
    }
    const k = clamp(V.t / V.dur, 0, 1);
    // gradual, cinematic change: pallor spreads, the eyes ignite, the fangs drop at the climax
    const peak = V.mode === 'stand' ? 0.42 : 0.25;
    u.uVampire.value = lerp(V.pallor0 || 0, S.pallor, smoothstep(0.02, 0.8, k));
    u.uEyeGlow.value = S.glowEyes ? smoothstep(peak - 0.14, peak, k) * (1.4 - 0.9 * smoothstep(0.7, 1, k)) : 0;
    u.uFang.value = S.fangs ? smoothstep(peak - 0.05, peak + 0.08, k) * (1 - 0.7 * smoothstep(0.75, 1, k)) : 0;
    a.vampTarget = smoothstep(0.45, 0.95, k);
    if (V.mode === 'stand' && !V.cried && k > 0.38) { V.cried = true; this.game.audio.play('hiss', { pos: npc.boneWPos[B.head].clone(), gain: 1, rate: 0.85 }); }
    const done = V.mode === 'stand' ? (k >= 1 && npc.physMode === 'anim') : (V.rising && npc.physMode === 'anim' && !a.clip);
    if (done) this.completeTurn(npc);
  }
  // face-up: the straight body pivots up about the heels; face-down: a fast spring to the feet
  startRise(npc) {
    if (npc.gore && npc.gore.lostLegs > 0) { npc.startCrawl(false); return; }
    const faceDown = npc.rootFromRagdoll();
    npc.anim.takeSnapshot(faceDown ? 0.6 : 1.0);
    const keys = faceDown ? getUpKeys(true) : vampRiseKeys();
    npc.anim.playClip('vampireRise', keys, () => { if (npc.physMode === 'getup') npc.physMode = 'anim'; });
    const c = npc.anim.clip; c.linear = !faceDown; c.vrise = !faceDown; c.speed = faceDown ? 1.4 : 1;
    npc.rag.setDynamic(false);
    npc.physMode = 'getup';
    npc.lastReaction = 'Rising (Vampire)';
    Events.emit('npcGetUp', npc);
  }
  completeTurn(npc) {
    const V = npc.vamp;
    V.state = 'vampire'; V.t = 0; V.regenT = 9;
    npc.health = npc.maxHealth = 100; npc.regionDamage.fill(0); npc.criticalHead = false;
    npc.anim.vampTarget = 1; npc.anim.limp[0] = npc.anim.limp[1] = 0;
    npc.anim.setPosture('stand');
    if (npc.brain) { npc.brain.state = 'vIdle'; npc.brain.t = 0; npc.brain.cool = 2.5; }
    npc.lastReaction = 'Vampire';
    this.log(`${npc.idStr} ${npc.name} has become a vampire (${npc.anim.vstyle.name})`);
    Events.emit('vampire', { npc, kind: 'turned' });
  }

  // --- destruction: the body crumbles to ash ----------------------------------------------------
  destroy(npc, info) {
    if (npc.lifeState !== 'vampire' || !npc.setLife('destroyed', 'vampire destroyed')) return false;
    if (npc.brain && npc.brain.vVictim) this.endBite(npc, 'killed');
    npc.vamp = Object.assign(npc.vamp || {}, { state: 'ash', t: 0 });
    npc.deathTime = this.game.time;
    npc.goRagdoll('Destroyed (Vampire)', true);
    this.game.audio.play('ashBurst', { pos: npc.boneWPos[B.chest].clone(), gain: 1 });
    Events.emit('npcDied', { npc, info, vampire: true });
    this.log(`${npc.idStr} ${npc.name} (vampire) destroyed`);
    return true;
  }
  updateAsh(npc, V, dt) {
    const g = this.game, u = npc.material.userData.u;
    V.t += dt;
    u.uEyeGlow.value = Math.max(0, u.uEyeGlow.value - dt * 1.5);
    u.uFang.value = Math.max(0, u.uFang.value - dt);
    u.uAsh.value = V.t < 1.1 ? smoothstep(0, 1.1, V.t) : 1 + smoothstep(1.1, 3.3, V.t);
    // embers and ash drift up from the crumbling body (non-graphic)
    V.emitT = (V.emitT || 0) - dt;
    if (V.t > 0.4 && V.t < 3.4 && V.emitT <= 0) {
      V.emitT = 0.05;
      const bones = [B.hips, B.spine, B.chest, B.head, B.thigh_L, B.thigh_R, B.upperarm_L, B.upperarm_R, B.shin_L, B.shin_R];
      for (let i = 0; i < 2; i++) {
        const p = npc.boneWPos[bones[Math.floor(Math.random() * bones.length)]];
        const sh = 0.16 + Math.random() * 0.1;
        g.fx.smoke.emit(p.x + (Math.random() - 0.5) * 0.15, p.y + 0.05, p.z + (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.3, 0.35 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3, 1.4 + Math.random() * 1.2, 0.08, 0.35 + Math.random() * 0.3, sh, sh * 0.97, sh * 0.95, 0.55, -0.12, 1.2);
        if (Math.random() < 0.6) g.fx.glow.emit(p.x, p.y + 0.05, p.z, (Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.8, 0.025, 0.004, 1.0, 0.45, 0.15, 0.9, -0.2, 0.6);
      }
    }
    if (V.t > 3.5) {
      const pel = npc.rag.bodies[RAG.PELVIS].pos;
      g.fx.decal(_vp1.set(pel.x, g.env.groundHeight(pel.x, pel.z, pel.y) + 0.004, pel.z), UP, 0.8, 'scorch');
      this.ashes.push({ seed: npc.seed, overrides: Object.assign({}, npc.overrides || {}), kind: npc.spawnKind || null, pos: npc.spawn.pos.clone(), yaw: npc.spawn.yaw, style: npc.anim.vstyle ? npc.anim.vstyle.name : null });
      g.npcs.remove(npc, true);
    }
  }
  // Reset Physics brings destroyed subjects back the way they were spawned
  restoreAshes() {
    const g = this.game, list = this.ashes.splice(0);
    for (const e of list) {
      const n = g.npcs.spawn({ seed: e.seed, overrides: e.overrides, pos: e.pos, yaw: e.yaw });
      if (!n) continue;
      n.spawnKind = e.kind;
      if (e.kind === 'vampire' && this.S.enabled) this.makeVampire(n, { instant: true, why: 'reset', style: e.style });
    }
  }
  onRevive(npc) { if (npc.vamp && npc.vamp.state !== 'none') this.cure(npc); }

  // --- hits ---------------------------------------------------------------------------------------
  // damage taken: a stake (knife) to the chest is deadly, explosions hurt, bullets barely slow them
  damageMul(region, weapon) {
    const chest = region === REGION.TORSO || region === REGION.UPPER_CHEST || region === REGION.ABDOMEN;
    if (weapon === 'knife') return chest ? 2.6 : 0.7;
    if (weapon === 'grenade' || weapon === 'bazooka' || weapon === 'explosion') return 1.0;
    if (region === REGION.HEAD) return weapon === 'sniper' ? 0.8 : 0.5;
    return 0.35;
  }
  onHit(v, info) {
    const b = v.brain; if (!b || !v.vamp) return;
    v.vamp.regenT = 0;
    if (info.dir) b.stagger.copy(info.dir).setY(0).multiplyScalar(0.5);
    v.lastReaction = 'Stagger (Vampire)';
    if (v.physMode !== 'anim' || b.state === 'vTurn' || b.state === 'vBite' || b.state === 'vBiteDown') return;
    // hiss at the attacker, then go for them (the player when allowed)
    if (b.state !== 'vHiss' && b.state !== 'vPlayerBite') {
      this.setState(v, b, 'vHiss'); b.hissT = 0.9 + Math.random() * 0.4; b.speed = 0;
      if (info.threatPos) b.faceTarget = info.threatPos.clone();
      v.anim.setAction('vhiss', { dur: b.hissT, inT: 0.12, outT: 0.3 });
      this.game.audio.play('hiss', { pos: v.boneWPos[B.head].clone(), gain: 0.9 });
    }
  }

  // --- AI -------------------------------------------------------------------------------------------
  targetPos(t) { return t.isPlayer ? _vp4.set(this.game.camera.position.x, 0, this.game.camera.position.z) : t.root.pos; }
  targetHead(t) { return t.isPlayer ? this.game.camera.position : t.boneWPos[B.head]; }
  dist2(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  validTarget(v, t, maxD) {
    if (t.isPlayer) return false; // the player is an unseen observer: nobody can see or attack them
    if (t.removed || t.lifeState !== 'alive' || t.horror || (t.grabbedBy && t.grabbedBy !== v)) return false;
    if (t.vamp && t.vamp.state !== 'none') return false;   // already marked
    if ((t.feeders || 0) > 0) return false;
    return this.dist2(t.root.pos, v.root.pos) < maxD;
  }
  pickTarget(v) {
    const S = this.S, g = this.game;
    let best = null, bs = 1e9;
    for (const o of g.npcs.list) {
      if (o === v || !this.validTarget(v, o, S.detection)) continue;
      const d = this.dist2(o.root.pos, v.root.pos);
      // stragglers first: people near others are less attractive prey
      let crowd = 0; for (const p of g.npcs.list) if (p !== o && p.lifeState === 'alive' && this.dist2(p.root.pos, o.root.pos) < 3) crowd++;
      let claimed = 0; for (const w of g.npcs.list) if (w !== v && w.brain && w.brain.vTarget === o) claimed++;
      const s = d + crowd * 2.5 + claimed * 6 + (o.physMode === 'ragdoll' ? 2 : 0);
      if (s < bs) { bs = s; best = o; }
    }
    return best;
  }
  think(v, b, dt) {
    const S = this.S, g = this.game, a = v.anim, st = a.vstyle || VAMP_STYLES.aristocrat;
    b.t += dt;
    a.zombie = 0;
    if (v.physMode !== 'anim') { if (b.vVictim) this.endBite(v, 'interrupted'); b.speed = 0; return; }
    if (!Settings.data.ai.enabled || !S.enabled) { b.speed = 0; return; }
    if (b.state === 'vTurn') { b.speed = 0; return; }
    if (!a.vstyle) a.vstyle = this.pickStyle(v);
    a.vampTarget = 1;
    b.cool = Math.max(0, (b.cool || 0) - dt);
    const spd = S.speed;
    switch (b.state) {
      case 'vBite': this.updateBite(v, b, dt); return;
      case 'vBiteDown': this.updateBiteDown(v, b, dt); return;
      case 'vPlayerBite': this.updatePlayerBite(v, b, dt); return;
      case 'vHiss': {
        b.speed = 0;
        if (b.t > (b.hissT || 1)) this.setState(v, b, b.vTarget ? 'vRush' : 'vIdle');
        return;
      }
      case 'vRetreat': {
        b.speed = st.walk * 0.9 * spd; a.vStalkTarget = 0;
        if (b.t > 1.8 || this.dist2(v.root.pos, b.dest) < 0.4) this.setState(v, b, 'vIdle');
        return;
      }
    }
    // --- prey -------------------------------------------------------------------------
    b.retarget = (b.retarget || 0) - dt;
    let tgt = b.vTarget;
    if (tgt && !this.validTarget(v, tgt, S.detection * 1.4)) tgt = null;
    if ((!tgt || b.retarget <= 0) && b.cool <= 0) { const n = this.pickTarget(v); if (n && (!tgt || b.state !== 'vRush')) tgt = n; b.retarget = 1.6; }
    if (b.cool > 0 && b.state !== 'vRush' && !(tgt && tgt.isPlayer && b.state === 'vStalk')) tgt = null;
    if (tgt !== b.vTarget) {
      b.vTarget = tgt;
      if (tgt) { this.setState(v, b, 'vStalk'); v.lastReaction = tgt.isPlayer ? 'Stalking (You)' : 'Stalking'; }
      else if (b.state === 'vStalk' || b.state === 'vRush') this.setState(v, b, 'vIdle');
    }
    if (tgt) {
      const tp = this.targetPos(tgt), d = this.dist2(tp, v.root.pos);
      a.lookAt(this.targetHead(tgt), 1);
      if (a.action && a.action.type === 'vidle' && !a.action.ending) a.setAction(null);
      const alerted = !tgt.isPlayer && tgt.brain && (tgt.brain.state === 'flee' || tgt.brain.state === 'cower' || tgt.physMode === 'ragdoll');
      if (b.state === 'vStalk') {
        a.vStalkTarget = st.name === 'aristocrat' ? 0.3 : 1;
        b.dest.copy(tp); b.speed = st.walk * spd * (d < st.stalkR * 1.8 ? 0.8 : 1);
        if (d < st.stalkR || alerted || b.t > 14) {
          this.setState(v, b, 'vRush'); a.vStalkTarget = 0;
          if (Math.random() < 0.5) g.audio.play('hiss', { pos: v.boneWPos[B.head].clone(), gain: 0.55, rate: 1.15 });
        }
      } else if (b.state === 'vRush') {
        a.vStalkTarget = 0;
        b.dest.copy(tp);
        if (!tgt.isPlayer && tgt.brain) b.dest.addScaledVector(tgt.brain.vel, Math.min(0.45, d / 12));
        b.speed = st.run * spd * (d < 1.8 ? 0.55 : 1);
        if (tgt.isPlayer) { if (d < 1.2) this.startPlayerBite(v, b); }
        else if (tgt.physMode === 'ragdoll') { if (d < 1.6 && !this.startBiteDown(v, b, tgt)) { b.vTarget = null; this.setState(v, b, 'vIdle'); } }
        else if (d < 0.95) this.startBite(v, b, tgt);
        if (b.state === 'vRush' && b.t > 10) { b.vTarget = null; this.setState(v, b, 'vIdle'); b.cool = 3; }
      } else this.setState(v, b, 'vStalk');
      return;
    }
    // --- nothing to hunt: style idles and slow, gliding walks ------------------------------------
    a.vStalkTarget = 0;
    if (b.state !== 'vIdle' && b.state !== 'vWander') this.setState(v, b, 'vIdle');
    if (b.state === 'vIdle') {
      b.speed = 0;
      const ia = a.action;
      if ((!ia || ia.ending) && a.speed < 0.2) {
        const modes = st.idles;
        a.setAction('vidle', { mode: modes[Math.floor(Math.random() * modes.length)], dur: 3 + Math.random() * 3.5, ph: Math.random() * 6, side: Math.random() < 0.5 ? 0 : 1, inT: 0.6, outT: 0.7 });
      }
      b.idleT = (b.idleT == null ? 4 + Math.random() * 6 : b.idleT) - dt;
      if (b.idleT <= 0 && Settings.data.ai.wander) { b.idleT = null; g.ai.pickWander(v, b); this.setState(v, b, 'vWander'); if (a.action && a.action.type === 'vidle') a.setAction(null); }
      b.lookT = (b.lookT || 0) - dt;
      if (b.lookT <= 0) {
        b.lookT = 2 + Math.random() * 3;
        const yaw = v.root.yaw + (Math.random() - 0.5) * 2.4;
        b.lookPos = (b.lookPos || new V3()).set(v.root.pos.x + Math.sin(yaw) * 5, v.rig.eyeY + (Math.random() - 0.5) * 0.6, v.root.pos.z + Math.cos(yaw) * 5);
      }
      if (b.lookPos) a.lookAt(b.lookPos, 0.6);
    } else {
      b.speed = st.walk * 0.75 * spd;
      a.clearLook();
      if (this.dist2(v.root.pos, b.dest) < 0.6 || b.t > 16) this.setState(v, b, 'vIdle');
    }
  }

  // --- the bite (standing) -------------------------------------------------------------------------
  startBite(v, b, tgt) {
    if (tgt.grabbedBy || tgt.physMode !== 'anim' || tgt.lifeState !== 'alive') { b.vTarget = null; this.setState(v, b, 'vIdle'); return; }
    // approach angle decides the hold: from behind when the victim faces away
    const dx = v.root.pos.x - tgt.root.pos.x, dz = v.root.pos.z - tgt.root.pos.z, dl = Math.hypot(dx, dz) || 1;
    const front = (Math.sin(tgt.root.yaw) * dx + Math.cos(tgt.root.yaw) * dz) / dl;
    const behind = front < -0.3;
    const side = Math.random() < 0.5 ? 0 : 1;
    this.setState(v, b, 'vBite');
    b.vVictim = tgt; b.vVariant = behind ? 'behind' : 'front'; b.vSide = side; b.drink = 0; b.biteDur = 3.2 + Math.random() * 1.6;
    tgt.grabbedBy = v;
    v.rag.noCollideWith = tgt.rag; tgt.rag.noCollideWith = v.rag;
    if (tgt.brain) { tgt.brain.state = 'grabbed'; tgt.brain.t = 0; tgt.brain.speed = 0; tgt.brain.pending.length = 0; tgt.brain.screamT = 0.2; }
    v.anim.setAction('vbite', { target: tgt, variant: b.vVariant, side, inT: 0.18, outT: 0.45 });
    tgt.anim.setAction('drained', { target: v, side, behind, drain: 0, inT: 0.2, outT: 0.6 });
    tgt.anim.setUpper('hang'); tgt.fear = 1; tgt.lastReaction = 'Seized by a Vampire';
    v.lastReaction = 'Biting (Vampire)';
    this.game.audio.play('scream' + Math.floor(Math.random() * 3), { pos: tgt.boneWPos[B.head].clone(), gain: 0.85 });
    Events.emit('vampire', { npc: v, kind: 'bite', target: tgt });
    this.log(`${v.idStr} seized ${tgt.idStr} ${tgt.name}${behind ? ' from behind' : ''}`);
  }
  updateBite(v, b, dt) {
    const tgt = b.vVictim;
    if (!tgt || tgt.removed || tgt.physMode !== 'anim' || tgt.lifeState !== 'alive' || tgt.grabbedBy !== v) { this.endBite(v, 'lost'); return; }
    b.speed = 0; b.faceTarget = null;
    const behind = b.vVariant === 'behind', sg = SIDE_SIGN[b.vSide];
    // hold the pair at biting distance: face to face (offset to the bitten side) or close behind
    const vy = tgt.root.yaw, fx = Math.sin(vy), fz = Math.cos(vy), rx = Math.cos(vy) * sg, rz = -Math.sin(vy) * sg;
    const want = (behind ? 0.3 : 0.34) * (v.rig.H + tgt.rig.H) / 3.5, dir = behind ? -1 : 1;
    const tx = tgt.root.pos.x + fx * want * dir + rx * 0.06, tz = tgt.root.pos.z + fz * want * dir + rz * 0.06;
    const kk = Math.min(1, dt * 7), ex = (tx - v.root.pos.x) * kk, ez = (tz - v.root.pos.z) * kk;
    v.root.pos.x += ex * 0.7; v.root.pos.z += ez * 0.7; tgt.root.pos.x -= ex * 0.3; tgt.root.pos.z -= ez * 0.3;
    // the vampire turns to the victim's neck; the victim keeps its heading (no feedback spin)
    const dx = tgt.root.pos.x - v.root.pos.x, dz = tgt.root.pos.z - v.root.pos.z;
    v.root.yaw = angleDamp(v.root.yaw, Math.atan2(dx, dz), 8, dt);
    b.vel.multiplyScalar(0.8); if (tgt.brain) tgt.brain.vel.multiplyScalar(0.8);
    v.anim.clearLook();
    const act = v.anim.action;
    if (act && act.type === 'vbite' && act.snapEvent) { act.snapEvent = false; this.onSnap(v, tgt); }
    if (act && act.snapped) this.drink(v, b, tgt, dt);
    const da = tgt.anim.action; if (da && da.type === 'drained') da.drain = clamp(b.drink / (b.biteDur * 0.75), 0, 1);
    if (b.vVictim && b.drink >= b.biteDur) this.endBite(v, 'fed');
  }
  // fangs in: the bite lands (small, non-graphic marks) and the countdown starts
  onSnap(v, tgt) {
    const S = this.S, g = this.game;
    if (tgt.lifeState !== 'alive') return;
    const dmg = Math.min(S.biteDamage, Math.max(0, tgt.health - VAMP_PREY_FLOOR));
    const res = tgt.applyHit({ region: REGION.NECK, damage: dmg / REGION_DAMAGE_MUL[REGION.NECK], weapon: 'vampire', force: 1, threatPos: v.root.pos.clone() });
    g.gore.onVampBite(tgt, v);
    g.hits.report(tgt, REGION.NECK, res, 'Vampire Bite', null);
    this.markBitten(tgt, v);
    tgt.anim.kick(B.neck, _vp1.set(0.5, (Math.random() - 0.5) * 1.5, 0));
    tgt.anim.kick(B.chest, _vp1.set(-0.7, 0, 0));
  }
  drink(v, b, tgt, dt) {
    b.drink += dt;
    if (tgt.lifeState === 'alive' && tgt.health > VAMP_PREY_FLOOR) tgt.health = Math.max(VAMP_PREY_FLOOR, tgt.health - dt * this.S.biteDamage * 0.45);
    b.gaspT = (b.gaspT || 0) - dt;
    if (b.gaspT <= 0) { b.gaspT = 1.1 + Math.random() * 0.8; const k = clamp(b.drink / b.biteDur, 0, 1); if (k < 0.8) this.game.audio.play('gasp' + (Math.random() < 0.5 ? 0 : 1), { pos: tgt.boneWPos[B.head].clone(), gain: 0.6 * (1 - k) + 0.15 }); }
  }
  endBite(v, why) {
    const b = v.brain; if (!b) return;
    const tgt = b.vVictim;
    b.vVictim = null;
    const act = v.anim.action;
    if (act && (act.type === 'vbite' || act.type === 'vbiteDown')) v.anim.setAction(null);
    if (tgt) {
      if (tgt.grabbedBy === v) tgt.grabbedBy = null;
      const da = tgt.anim.action; if (da && da.type === 'drained') tgt.anim.setAction(null);
      if (tgt.lifeState === 'alive' && !tgt.removed) {
        if (why === 'fed' && tgt.physMode === 'anim') {
          // strength gone: the knees give way and the victim faints, then comes round later
          tgt.goRagdoll('Fainted (Vampire Bite)');
          tgt.rag.bodies[RAG.CHEST].vel.add(_vp1.set(Math.sin(tgt.root.yaw) * -0.4, -0.6, Math.cos(tgt.root.yaw) * -0.4));
          tgt.downTimer = 4 + Math.random() * 3;
          tgt.lastReaction = 'Fainted (Vampire Bite)';
        } else if (tgt.physMode === 'ragdoll') { tgt.downTimer = Math.min(Math.max(tgt.downTimer, 3), 6); }
        else if (tgt.brain) {
          tgt.brain.state = 'flee'; tgt.brain.t = 0; tgt.brain.fleeT = 6; tgt.brain.threat.copy(v.root.pos); tgt.brain.hasThreat = true; tgt.brain.threatNpc = v;
          tgt.anim.setUpper('clutch', REGION.NECK); tgt.lastReaction = 'Broke Free (Vampire)';
        }
      }
    }
    if (b.state === 'vBite' || b.state === 'vBiteDown' || b.state === 'vPlayerBite') {
      if (why === 'fed' && v.lifeState === 'vampire' && v.physMode === 'anim') {
        v.anim.setAction('vwipe', { dur: 1.3, side: Math.random() < 0.5 ? 0 : 1, inT: 0.2, outT: 0.35 });
        this.setState(v, b, 'vRetreat'); b.cool = 8 + Math.random() * 8; b.vTarget = null;
        const away = tgt ? _vp2.subVectors(v.root.pos, tgt.root.pos).setY(0) : _vp2.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        if (away.lengthSq() < 1e-4) away.set(1, 0, 0);
        b.dest.copy(v.root.pos).addScaledVector(away.normalize(), 1.5); this.game.env.clampToBounds(b.dest, 1);
        v.lastReaction = 'Fed (Vampire)';
      } else { this.setState(v, b, 'vIdle'); b.cool = Math.max(b.cool || 0, 1.5); }
    }
  }
  // --- the bite (victim lying on the ground) ---------------------------------------------------------
  startBiteDown(v, b, tgt) {
    if (tgt.grabbedBy || (tgt.feeders || 0) > 0 || (!tgt.rag.asleep && tgt.rag.maxSpeed() > 0.7)) return false;
    this.setState(v, b, 'vBiteDown');
    b.vVictim = tgt; b.drink = 0; b.biteDur = 3 + Math.random() * 1.5; b.kneeling = false;
    tgt.grabbedBy = v; v.rag.noCollideWith = tgt.rag;
    tgt.downTimer = Math.max(tgt.downTimer, 60);
    v.lastReaction = 'Biting (Vampire)';
    return true;
  }
  updateBiteDown(v, b, dt) {
    const tgt = b.vVictim;
    if (!tgt || tgt.removed || tgt.physMode !== 'ragdoll' || tgt.lifeState !== 'alive' || tgt.grabbedBy !== v) { this.endBite(v, 'lost'); return; }
    const ch = tgt.rag.bodies[RAG.CHEST].pos, hd = tgt.rag.bodies[RAG.HEAD].pos;
    const np = _vp1.copy(ch).lerp(hd, 0.5);
    const side = _vp2.subVectors(v.root.pos, np); side.y = 0;
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    const spot = _vp3.copy(np).addScaledVector(side, 0.5); spot.y = 0;
    const d = this.dist2(v.root.pos, spot);
    if (!b.kneeling && d > 0.25) {
      b.dest.copy(spot); b.speed = 1.3; b.faceTarget = null; v.anim.lookAt(np, 1);
      if (b.t > 6) this.endBite(v, 'lost');
      return;
    }
    b.kneeling = true; b.speed = 0; b.faceTarget = np.clone();
    let a = v.anim.action;
    if (!a || a.type !== 'vbiteDown' || a.ending) { v.anim.setAction('vbiteDown', { point: new V3(), chest: new V3(), ground: new V3(), inT: 0.4, outT: 0.6 }); a = v.anim.action; }
    a.point.copy(np); a.point.y += 0.02;
    a.chest.copy(ch);
    a.ground.copy(hd).addScaledVector(side, -0.22); a.ground.y = this.game.env.groundHeight(a.ground.x, a.ground.z, hd.y);
    if (a.snapEvent) { a.snapEvent = false; this.onSnap(v, tgt); }
    if (a.snapped) this.drink(v, b, tgt, dt);
    if (b.vVictim && b.drink >= b.biteDur) this.endBite(v, 'fed');
  }

  // --- the player as prey ----------------------------------------------------------------------------
  startPlayerBite(v, b) {
    this.setState(v, b, 'vPlayerBite'); b.speed = 0; b.bitPlayer = false;
    v.anim.setAction('vbite', { target: null, point: this.game.camera.position.clone(), side: Math.random() < 0.5 ? 0 : 1, dur: 1.5, inT: 0.12, outT: 0.4 });
    v.lastReaction = 'Attacking (You)';
  }
  updatePlayerBite(v, b, dt) {
    const g = this.game, cam = g.camera.position, a = v.anim.action;
    b.speed = 0; b.faceTarget = _vp1.set(cam.x, 0, cam.z).clone();
    v.anim.lookAt(cam, 1);
    if (a && a.type === 'vbite' && a.point) a.point.copy(cam);
    // lunge closes the last gap
    const dx = cam.x - v.root.pos.x, dz = cam.z - v.root.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.75 && b.t < 0.5) { v.root.pos.x += dx / d * Math.min(d - 0.75, dt * 3); v.root.pos.z += dz / d * Math.min(d - 0.75, dt * 3); }
    if (a && a.snapEvent) {
      a.snapEvent = false;
      if (d < 1.6 && this.player.state === 'none') this.biteThePlayer(v); else b.missed = true;
    }
    if (b.t > 1.5) {
      this.setState(v, b, 'vRetreat'); b.vTarget = null; b.cool = b.missed ? 2 : 12;
      b.dest.copy(v.root.pos).addScaledVector(_vp2.set(-dx, 0, -dz).normalize(), 2); g.env.clampToBounds(b.dest, 1);
      b.missed = false;
    }
  }
  biteThePlayer(v) {
    const g = this.game, P = this.player;
    g.player.addShake(0.9);
    P.flash = 1;
    g.audio.play('bite', { gain: 0.8 });
    g.audio.play('hiss', { pos: v.boneWPos[B.head].clone(), gain: 0.8 });
    if (this.S.turning) {
      P.state = 'bitten'; P.t = 0; P.dur = this.S.turnTime; P.beatT = 0;
      HT.toast(`You were bitten! You will turn in ${Math.round(P.dur)} s`, 'v');
      this.log(`the player was bitten by ${v.idStr}`);
    } else HT.toast('A vampire bit you', 'v');
    Events.emit('vampire', { npc: v, kind: 'bitePlayer' });
  }
  curePlayer() {
    const P = this.player;
    if (P.state !== 'none') this.log('player cured');
    P.state = 'none'; P.t = 0; P.k = 0; P.flash = 0;
    for (const n of this.game.npcs.list) n.material.userData.u.uHeat.value = 0;
    this.setOverlay(0, 0, 0);
  }
  // the player's change: heartbeat and a red pulse, a turning surge, then vampire senses and speed
  updatePlayer(dt) {
    const P = this.player, g = this.game;
    P.flash = Math.max(0, P.flash - dt * 1.6);
    if (P.state === 'none') { if (P.flash > 0 || this.overlayOn) this.setOverlay(0, P.flash, 0); return; }
    P.t += dt;
    if (P.state === 'bitten') {
      const k = clamp(P.t / P.dur, 0, 1);
      const period = lerp(1.0, 0.42, k);
      P.beatT -= dt;
      let pulse = 0;
      if (P.beatT <= 0) { P.beatT = period; g.audio.play('heartbeat', { gain: 0.35 + 0.5 * k, bus: 'effects', reverb: false, vary: false }); P.lastBeat = P.t; }
      pulse = Math.exp(-(P.t - (P.lastBeat || 0)) / 0.18);
      this.setOverlay(0.15 + 0.45 * k, Math.max(P.flash, pulse * (0.12 + 0.3 * k)), 0);
      if (k >= 1) { P.state = 'turning'; P.t = 0; g.audio.play('vampTurn', { gain: 1 }); g.player.addShake(0.6); HT.toast('You are turning...', 'v'); }
    } else if (P.state === 'turning') {
      const k = clamp(P.t / 2.6, 0, 1);
      this.setOverlay(0.6 + 0.4 * Math.sin(Math.PI * k), 0.5 * Math.sin(Math.PI * k), 0);
      if (k >= 1) {
        P.state = 'vampire'; P.t = 0; P.flash = 0.8;
        HT.toast('You are a vampire: faster, you sense the living, and your knife is your bite', 'v');
        this.log('the player became a vampire');
        Events.emit('vampire', { kind: 'playerTurned' });
      }
    } else if (P.state === 'vampire') {
      // heat sense: the living glow through the dark, a cool tint over the world
      this.setOverlay(0.28, P.flash, 1);
      for (const n of g.npcs.list) {
        const u = n.material.userData.u;
        u.uHeat.value = damp(u.uHeat.value, n.lifeState === 'alive' ? 0.75 : 0, 4, dt);
      }
    }
  }
  get playerSpeedMul() { return this.player.state === 'vampire' ? 1.65 : (this.player.state === 'bitten' ? 1 - 0.15 * clamp(this.player.t / Math.max(1, this.player.dur), 0, 1) : 1); }
  // screen effect layer (no HUD): vignette strength, red flash/pulse, cool vampire tint
  setOverlay(vig, red, cool) {
    if (!this.overlay) {
      if (typeof document === 'undefined') return;
      const el = document.createElement('div');
      el.id = 'vampFx';
      el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;transition:none;mix-blend-mode:normal';
      document.body.appendChild(el);
      this.overlay = el;
    }
    const on = vig > 0.001 || red > 0.001 || cool > 0.001;
    this.overlayOn = on;
    if (!on) { this.overlay.style.opacity = '0'; return; }
    const r = Math.round(120 + 100 * red), a1 = clamp(0.25 + vig * 0.6 + red * 0.3, 0, 0.95), a0 = clamp(red * 0.35, 0, 0.5);
    const tint = cool > 0 ? `radial-gradient(ellipse at center, rgba(40,60,110,${0.08 * cool}) 0%, rgba(30,10,40,${0.35 * cool}) 100%),` : '';
    this.overlay.style.background = `${tint}radial-gradient(ellipse at center, rgba(${r},0,0,${a0}) ${Math.round(55 - vig * 25)}%, rgba(${r >> 1},0,0,${a1}) 100%)`;
    this.overlay.style.opacity = '1';
  }
  // player-vampire knife: a bite instead of a cut (drains, marks the victim)
  playerBite(npc) {
    if (this.player.state !== 'vampire' || npc.lifeState !== 'alive') return false;
    const g = this.game, S = this.S;
    const dmg = Math.min(S.biteDamage * 1.4, Math.max(0, npc.health - VAMP_PREY_FLOOR));
    const res = npc.applyHit({ region: REGION.NECK, damage: dmg / REGION_DAMAGE_MUL[REGION.NECK], weapon: 'vampire', force: 1, threatPos: g.camera.position.clone() });
    g.gore.onVampBite(npc, null);
    g.hits.report(npc, REGION.NECK, res, 'Vampire Bite (You)', null);
    this.markBitten(npc, null);
    if (npc.brain && npc.physMode === 'anim') {
      npc.brain.state = 'flee'; npc.brain.t = 0; npc.brain.fleeT = 6; npc.brain.threat.copy(g.camera.position); npc.brain.hasThreat = true; npc.brain.threatNpc = null;
      npc.anim.setUpper('clutch', REGION.NECK); npc.fear = 1;
    }
    g.audio.play('bite', { pos: npc.boneWPos[B.neck].clone(), gain: 0.8 });
    return true;
  }
}
HT.VampireSystem = VampireSystem;
