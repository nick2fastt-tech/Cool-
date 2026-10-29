// ============================================================================
// Reincarnation Mode: eligible deceased NPCs return as zombies after a
// configurable delay. Explicit per-NPC state machine guards against duplicate
// zombie creation and repeated transitions.
//   reinc.state: none -> pending -> rising -> done   (or ineligible / cancelled)
// ============================================================================
const REINC_PRESETS = { immediate: 0.6, short: 5, medium: 15, long: 45 };
class ReincarnationSystem {
  constructor(game) {
    this.game = game;
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
    if (npc.lifeState !== 'dead') return { ok: false, reason: 'Not deceased' };
    if (npc.isZombie) return { ok: false, reason: 'Already reanimated' };
    if (Z.headTraumaPrevents && npc.criticalHead) return { ok: false, reason: 'Critical head trauma (prevents reincarnation)' };
    return { ok: true, reason: 'Eligible' };
  }
  update(dt) {
    const Z = Settings.data.zombies;
    for (const npc of this.game.npcs.list) {
      const r = npc.reinc;
      if (npc.lifeState !== 'dead') continue;
      if (!Z.reincarnation) {
        if (r.state === 'pending') { r.state = 'cancelled'; HT.log('zombie', `${npc.idStr} reincarnation cancelled (mode disabled)`); }
        continue;
      }
      if (r.state === 'none' || r.state === 'cancelled' || r.state === 'ineligible') {
        const e = this.checkEligible(npc);
        r.eligible = e.ok; r.reason = e.reason;
        if (e.ok) {
          r.state = 'pending'; r.delay = this.delay() * (0.85 + Math.random() * 0.3); r.timer = r.delay;
          HT.log('zombie', `${npc.idStr} ${npc.name}: reincarnation scheduled in ${r.timer.toFixed(1)}s`);
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
          if (settled && !npc.carried) this.rise(npc);
        }
      }
    }
  }
  rise(npc) {
    const r = npc.reinc;
    if (r.state !== 'pending' || npc.lifeState !== 'dead' || npc.isZombie) return false; // duplicate guard
    if (!npc.setLife('reanimating', 'reincarnation')) return false;
    r.state = 'rising';
    npc.isZombie = true; npc.health = 100; npc.maxHealth = 100;
    npc.zombieTarget = null;
    if (npc.physMode !== 'ragdoll') npc.goRagdoll('Reanimating', true);
    npc.startGetUp(true);
    npc.anim.zombie = 1;
    if (npc.brain) { npc.brain.state = 'zIdle'; npc.brain.t = 0; }
    this.game.audio.play('groan' + Math.floor(Math.random() * 5), { pos: npc.root.pos.clone(), gain: 0.9, important: true });
    HT.log('zombie', `${npc.idStr} ${npc.name} is reanimating`);
    HT.toast(`${npc.name} ${npc.idStr} is rising...`, 'z');
    return true;
  }
  onRisen(npc) {
    if (npc.lifeState === 'reanimating') {
      npc.setLife('zombie', 'risen');
      npc.reinc.state = 'done';
      npc.lastReaction = 'Zombie AI Active';
      HT.log('zombie', `${npc.idStr} ${npc.name} returned as a zombie`);
      this.game.audio.play('zombieAlert', { bus: 'ui', gain: 0.4 });
    }
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
    // convenience: kill (if alive) then immediate rise
    if (npc.lifeState === 'alive') { npc.applyHit({ region: REGION.TORSO, damage: 9999, weapon: 'sandbox' }); }
    if (npc.lifeState !== 'dead') return;
    npc.criticalHead = false;
    npc.reinc.state = 'pending'; npc.reinc.timer = 0.3; npc.reinc.delay = 0.3;
    if (!Settings.data.zombies.reincarnation) { npc.reinc.timer = 0; this.rise(npc); }
  }
}
HT.ReincarnationSystem = ReincarnationSystem;
