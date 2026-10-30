// ============================================================================
// Reincarnation / infection: eligible deceased NPCs turn into zombies.
// Explicit per-NPC state machine guards against duplicate zombies and repeated
// transformations:
//   reinc.state: none -> pending -> transforming -> done
//                (or ineligible / cancelled / failed)
// The transformation itself takes ~10 s:
//   0-2 s  inert on the ground, tiny posture changes
//   2-4 s  restrained, irregular movement (head, limbs)
//   4-6 s  stronger movement, the body begins to rise
//   6-8 s  zombie posture, head motion and limb positions blend in
//   8-10 s upright, zombie idle; AI starts only when the sequence completes
// A critical head injury (when configured) always wins: the body never rises.
// ============================================================================
const REINC_PRESETS = { immediate: 0.6, short: 5, medium: 15, long: 45 };
const TRANSFORM_TIME = 10;
class ReincarnationSystem {
  constructor(game) {
    this.game = game;
    Events.on('transformRisen', (npc) => this.completeTransform(npc));
    Events.on('zombieRisen', (npc) => this.onRisen(npc));
    Events.on('npcDied', (e) => { const n = e.npc; if (n.reinc.state === 'none' || n.reinc.state === 'cancelled') n.reinc.checkNow = true; });
  }
  delay() {
    const Z = Settings.data.zombies;
    if (Z.delayPreset && Z.delayPreset !== 'custom' && REINC_PRESETS[Z.delayPreset] != null) return REINC_PRESETS[Z.delayPreset];
    return clamp(Z.delay, 0, 600);
  }
  checkEligible(npc) {
    const Z = Settings.data.zombies;
    if (npc.lifeState !== 'dead' && npc.lifeState !== 'reanimating') return { ok: false, reason: 'Not deceased' };
    if (npc.isZombie) return { ok: false, reason: 'Already reanimated' };
    if (Z.headTraumaPrevents && npc.criticalHead) return { ok: false, reason: 'Critical head trauma (prevents reincarnation)' };
    return { ok: true, reason: 'Eligible' };
  }
  update(dt) {
    const Z = Settings.data.zombies;
    for (const npc of this.game.npcs.list) {
      const r = npc.reinc;
      if (r.state === 'transforming') { this.updateTransform(npc, r, dt, Z); continue; }
      if (npc.lifeState !== 'dead') continue;
      const infected = !!(npc.infection && Z.infection);   // bitten bodies always turn
      if (!Z.reincarnation && !infected) {
        if (r.state === 'pending') { r.state = 'cancelled'; HT.log('zombie', `${npc.idStr} reincarnation cancelled (mode disabled)`); }
        continue;
      }
      if (r.state === 'none' || r.state === 'cancelled' || r.state === 'ineligible') {
        const e = this.checkEligible(npc);
        r.eligible = e.ok; r.reason = e.reason;
        if (e.ok) {
          const inf = npc.infection;
          r.state = 'pending';
          r.delay = infected ? (inf.t >= inf.dur ? 1.5 + Math.random() * 1.5 : clamp(inf.dur - inf.t, 2, 8)) : this.delay() * (0.85 + Math.random() * 0.3);
          r.timer = r.delay; r.infected = infected;
          HT.log('zombie', `${npc.idStr} ${npc.name}: ${infected ? 'infection will turn them' : 'reincarnation scheduled'} in ${r.timer.toFixed(1)}s`);
        } else if (r.state !== 'ineligible') {
          r.state = 'ineligible';
          HT.log('zombie', `${npc.idStr} not eligible: ${e.reason}`);
        }
      } else if (r.state === 'pending') {
        // re-validate (settings may change at any time)
        const e = this.checkEligible(npc);
        if (!e.ok) { r.state = 'ineligible'; r.reason = e.reason; r.eligible = false; HT.log('zombie', `${npc.idStr} reincarnation revoked: ${e.reason}`); continue; }
        r.timer -= dt;
        if (r.timer <= 0) {
          const settled = npc.physMode !== 'ragdoll' || npc.rag.asleep || npc.rag.maxSpeed() < 0.7;
          if (settled && !npc.carried) this.beginTransform(npc);
        }
      }
    }
  }
  // --- the 10 second transformation --------------------------------------------------
  beginTransform(npc) {
    const r = npc.reinc;
    if (r.state !== 'pending' || npc.lifeState !== 'dead' || npc.isZombie) return false; // duplicate guard
    if (!npc.setLife('reanimating', 'transformation')) return false;
    r.state = 'transforming'; r.t = 0; r.dur = TRANSFORM_TIME * (0.94 + Math.random() * 0.12);
    r.clip = false; r.twitchT = 0.7 + Math.random() * 0.6; r.cue = 0; r.rollDir = Math.random() < 0.5 ? 1 : -1;
    r.tint0 = npc.material.userData.u.uZombie.value;
    npc.anim.zstyle = pickZombieGait(); npc.anim.zMirror = Math.random() < 0.5 ? 1 : 0;
    npc.anim.zvar = makeZombieVariation();
    npc.zombieTarget = null;
    if (npc.physMode !== 'ragdoll') npc.goRagdoll('Transforming', true);
    if (npc.brain) { npc.brain.state = 'dead'; npc.brain.pending.length = 0; }
    npc.lastReaction = 'Transforming';
    HT.log('zombie', `${npc.idStr} ${npc.name} is turning`);
    HT.toast(`${npc.name} ${npc.idStr} is turning...`, 'z');
    return true;
  }
  updateTransform(npc, r, dt, Z) {
    if (npc.removed) return;
    // eligibility takes precedence over the animation
    if (Z.headTraumaPrevents && npc.criticalHead) { this.failTransform(npc, 'Critical head trauma (prevents reincarnation)'); return; }
    if (npc.lifeState !== 'reanimating') { this.failTransform(npc, 'Interrupted'); return; }
    if (!Z.reincarnation && !(npc.infection && Z.infection) && !r.clip) { this.failTransform(npc, 'Zombie mode disabled'); return; }
    if (npc.carried) return; // paused while held
    const u = npc.material.userData.u;
    if (npc.physMode === 'ragdoll') {
      if (r.clip) { // knocked back down during the rise: lie still again, then resume the rise
        r.clip = false; r.t = Math.min(r.t, r.dur * 0.38); npc.anim.clip = null;
        HT.log('zombie', `${npc.idStr} knocked down while turning`);
      }
      r.t += dt;
      const tl = r.t / r.dur * TRANSFORM_TIME;
      this.twitch(npc, r, tl, dt);
      // begin the rise once the stillness/convulsion phase is over and the body has settled
      const settled = npc.rag.asleep || npc.rag.maxSpeed() < 1.1;
      if ((tl >= 4.5 && settled) || tl >= 5.6) {
        npc.anim.zombie = 1;
        npc.startTransformRise(Math.max(2.8, r.dur - r.t));
        r.clip = true;
      }
    } else if (npc.physMode === 'getup' || npc.physMode === 'anim') {
      r.t += dt;
      // crawlers and legless bodies finish lying prone
      if (npc.physMode === 'anim' && npc.anim.crawl && r.t >= r.dur) this.completeTransform(npc);
    }
    const tl = r.t / r.dur * TRANSFORM_TIME;
    u.uZombie.value = lerp(r.tint0 || 0, 1, smoothstep(0.8, 9.2, tl));
    // voice cues
    if (r.cue === 0 && tl > 2.2) { r.cue = 1; this.game.audio.play('gurgle', { pos: npc.boneWPos[B.head].clone(), gain: 0.55 }); }
    if (r.cue === 1 && tl > 6.4) { r.cue = 2; this.game.audio.play('groan' + Math.floor(Math.random() * 5), { pos: npc.boneWPos[B.head].clone(), gain: 0.9, important: true }); }
    // safety: never stay stuck between states
    if (r.t > r.dur + 6 && npc.physMode !== 'ragdoll') this.completeTransform(npc);
  }
  // procedural movement while the body lies on the ground (impulses on ragdoll bodies)
  twitch(npc, r, tl, dt) {
    const rag = npc.rag;
    if (!rag.world) return;
    r.twitchT -= dt;
    if (r.twitchT > 0) return;
    let parts, dv, next;
    if (tl < 2) { parts = [RAG.HAND_L, RAG.HAND_R, RAG.HEAD]; dv = 0.12 + Math.random() * 0.12; next = 0.6 + Math.random() * 0.8; }
    else if (tl < 4) { parts = [RAG.HEAD, RAG.HAND_L, RAG.HAND_R, RAG.FARM_L, RAG.FARM_R, RAG.FOOT_L, RAG.FOOT_R]; dv = 0.3 + Math.random() * 0.35; next = 0.22 + Math.random() * 0.4; }
    else { parts = [RAG.HEAD, RAG.CHEST, RAG.FARM_L, RAG.FARM_R, RAG.UARM_L, RAG.UARM_R, RAG.SHIN_L, RAG.SHIN_R]; dv = 0.55 + Math.random() * 0.5; next = 0.15 + Math.random() * 0.3; }
    r.twitchT = next;
    const bi = parts[Math.floor(Math.random() * parts.length)];
    if (rag.detached[bi]) return;
    const b = rag.bodies[bi];
    if (rag.asleep) rag.world.wakeOwner(rag);
    if (bi === RAG.HEAD && tl >= 2) { // head rolls side to side
      r.rollDir = -r.rollDir;
      const side = _v2.set(Math.cos(npc.root.yaw), 0, -Math.sin(npc.root.yaw)).multiplyScalar(r.rollDir);
      rag.world.applyImpulse(b, side.multiplyScalar(b.mass * dv * 0.9), null);
    } else if (bi === RAG.CHEST) { // back arches
      rag.world.applyImpulse(b, _v2.set(0, b.mass * dv * 0.8, 0), null);
    } else {
      rag.world.applyImpulse(b, _v2.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(b.mass * dv), null);
    }
  }
  completeTransform(npc) {
    const r = npc.reinc;
    if (r.state !== 'transforming' || npc.lifeState !== 'reanimating' || npc.isZombie) return false;
    npc.isZombie = true; npc.health = 100; npc.maxHealth = 100;
    if (!npc.setLife('zombie', 'transformed')) return false;
    r.state = 'done'; r.clip = false;
    npc.anim.zombie = 1;
    npc.material.userData.u.uZombie.value = 1;
    if (npc.brain) { npc.brain.state = 'zIdle'; npc.brain.t = 0; npc.brain.pending.length = 0; npc.brain.noticeT = 0; }
    npc.lastReaction = 'Zombie AI Active';
    HT.log('zombie', `${npc.idStr} ${npc.name} returned as a zombie`);
    this.game.audio.play('zombieAlert', { bus: 'ui', gain: 0.4 });
    Events.emit('zombieActive', npc);
    return true;
  }
  failTransform(npc, reason) {
    const r = npc.reinc;
    r.state = 'ineligible'; r.eligible = false; r.reason = reason; r.clip = false;
    if (npc.lifeState === 'reanimating') npc.setLife('dead', reason);
    npc.anim.clip = null;
    if (npc.physMode !== 'ragdoll' && !npc.removed) npc.goRagdoll('Transformation failed', true);
    // the partial pallor stays as a (non-graphic) sign of the failed transformation
    HT.log('zombie', `${npc.idStr} transformation stopped: ${reason}`);
  }
  // legacy: zombies that are knocked down get up with the zombie clip
  onRisen(npc) {
    if (npc.lifeState === 'reanimating' && npc.reinc.state === 'transforming') this.completeTransform(npc);
  }
  reanimateAllNow() {
    let n = 0;
    for (const npc of this.game.npcs.list) {
      if (npc.lifeState !== 'dead') continue;
      const e = this.checkEligible(npc);
      if (!e.ok) continue;
      npc.reinc.state = 'pending'; npc.reinc.timer = 0.01 + n * 0.25; npc.reinc.delay = 0.01; n++;
    }
    HT.log('zombie', `Forced reanimation for ${n} subject(s)`);
    return n;
  }
  cancelAll() { for (const npc of this.game.npcs.list) if (npc.reinc.state === 'pending') npc.reinc.state = 'cancelled'; }
  makeZombieNow(npc) {
    if (npc.lifeState === 'alive') { npc.applyHit({ region: REGION.TORSO, damage: 9999, weapon: 'sandbox' }); }
    if (npc.lifeState !== 'dead') return;
    npc.criticalHead = false;
    npc.reinc.state = 'pending'; npc.reinc.timer = 0.3; npc.reinc.delay = 0.3;
  }
}
// per-zombie randomisation of timing and intensity (no two move alike)
function makeZombieVariation() {
  return {
    cadence: 0.85 + Math.random() * 0.3, intensity: 0.75 + Math.random() * 0.55, armPhase: Math.random() * TAU,
    headRate: 0.6 + Math.random() * 0.9, shoulder: 0.6 + Math.random() * 0.8, balanceT: 4 + Math.random() * 8
  };
}
HT.ReincarnationSystem = ReincarnationSystem;
