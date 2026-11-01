// ============================================================================
// Horror characters (V1.06): two fan-made slasher icons with their own looks,
// movement, idles, AI and attacks. Built from the procedural generator (see
// applySpecialLook) - no external or copied assets.
//   doll    - "Chucky": short, quick, laughing; stalks then rushes in to stab
//   slasher - "Jason":  huge, slow, relentless; head tilt on sight, runs only
//             when the prey keeps getting away (or he is shot); machete swings
// They hunt people only (never zombies, vampires or each other), are never
// bitten or reanimated, and fall as ordinary ragdolls when defeated.
// ============================================================================
const HORROR_DEFS = {
  doll: { label: 'Chucky', health: 150, armor: 0.8, walk: 0.95, run: 3.3, detect: 18, rushR: 5.5, reach: 0.82, damage: 20, cooldown: [0.9, 1.6],
    regions: [REGION.L_THIGH, REGION.R_THIGH, REGION.ABDOMEN, REGION.PELVIS, REGION.L_LOWER_LEG], knock: 0.22, clips: ['overhead', 'jab'] },
  slasher: { label: 'Jason', health: 700, armor: 0.45, walk: 1.1, run: 4.6, detect: 26, rushR: 0, reach: 1.25, damage: 58, cooldown: [1.4, 2.2],
    regions: [REGION.NECK, REGION.UPPER_CHEST, REGION.TORSO, REGION.L_UPPER_ARM, REGION.R_UPPER_ARM], knock: 0.65, clips: ['overhead', 'backhand'] }
};
const _hz1 = new V3(), _hz2 = new V3();

class HorrorSystem {
  constructor(game) {
    this.game = game;
    Events.on('settings', (e) => {
      if (!e) return;
      if ((e.path === 'horror.enabled' || e.path === '*') && !Settings.data.horror.enabled) this.removeAll();
    });
    Events.on('npcDied', (e) => { const n = e.npc; if (n && n.horror) this.onDefeated(n); });
  }
  get S() { return Settings.data.horror; }
  setState(n, b, s) { if (b.state !== s) { b.state = s; b.t = 0; } }

  spawn(kind, pos) {
    const g = this.game;
    if (!this.S.enabled) { HT.toast('Horror characters are turned off (Settings > Gameplay)', 'bad'); return null; }
    const p = pos ? pos.clone() : g.player.groundTarget(8);
    g.env.clampToBounds(p, 0.6);
    const yaw = Math.atan2(g.camera.position.x - p.x, g.camera.position.z - p.z);
    const npc = g.npcs.spawn({ gender: 'male', pos: p, yaw, overrides: { special: kind === 'slasher' ? 'slasher' : 'doll' } });
    if (!npc) return null;
    npc.spawnKind = kind;
    HT.log('horror', `${npc.idStr} ${npc.horror.label} appeared`);
    return npc;
  }
  // called for every NPC built with a special look (spawn, rebuild, reset)
  attach(npc, special) {
    const kind = special === 'slasher' ? 'slasher' : 'doll', def = HORROR_DEFS[kind];
    npc.horror = { kind, label: def.label, def };
    npc.name = def.label;
    npc.health = npc.maxHealth = def.health;
    npc.anim.hstyle = kind; npc.anim.gait = GAITS[kind]; npc.anim.gripR = 1;
    if (npc.brain) { npc.brain.state = 'hIdle'; npc.brain.t = 0; npc.brain.cd = 1; }
  }
  removeAll() {
    let c = 0;
    for (const n of this.game.npcs.list.slice()) if (n.horror) { this.game.npcs.remove(n, true); c++; }
    if (c) HT.log('horror', `horror characters off: ${c} removed`);
  }
  release(n) { /* attacks are instantaneous swings: nothing to let go of */ }
  onDefeated(n) {
    const g = this.game;
    if (n.horror.kind === 'doll') { const p = n.boneWPos[B.chest]; g.fx.fabricPuff(p, _hz1.set(0, 1, 0), new THREE.Color(0.92, 0.9, 0.85)); g.fx.fabricPuff(p, _hz1.set(0.5, 0.6, 0), new THREE.Color(0.92, 0.9, 0.85)); }
    HT.log('horror', `${n.idStr} ${n.horror.label} defeated`);
  }

  // --- AI ------------------------------------------------------------------------------
  // people, zombies and vampires are all fair game (never another horror character)
  validPrey(h, o, maxD) {
    if (!o || o.removed || o === h || o.horror) return false;
    if (o.lifeState !== 'alive' && o.lifeState !== 'zombie' && o.lifeState !== 'vampire') return false;
    if (o.lifeState === 'alive' && o.grabbedBy && o.grabbedBy !== h) return false;
    if (o.riding && o.riding.moving) return false;
    return Math.hypot(o.root.pos.x - h.root.pos.x, o.root.pos.z - h.root.pos.z) < maxD;
  }
  pickPrey(h, def) {
    let best = null, bs = 1e9;
    for (const o of this.game.npcs.list) {
      if (!this.validPrey(h, o, def.detect)) continue;
      let claimed = 0; for (const w of this.game.npcs.list) if (w !== h && w.horror && w.brain && w.brain.hTarget === o) claimed++;
      const kind = o.lifeState === 'zombie' ? 2 : o.lifeState === 'vampire' ? 2.5 : 0; // a slight taste for the living
      const s = Math.hypot(o.root.pos.x - h.root.pos.x, o.root.pos.z - h.root.pos.z) + claimed * 5 + (o.physMode === 'ragdoll' ? 3 : 0) + kind;
      if (s < bs) { bs = s; best = o; }
    }
    return best;
  }
  think(h, b, dt) {
    const g = this.game, a = h.anim, H = h.horror, def = H.def;
    b.t += dt;
    a.zombie = 0; a.hstyle = H.kind; a.gripR = 1;
    if (h.physMode !== 'anim') { b.speed = 0; b.hunting = false; return; }
    if (!Settings.data.ai.enabled || !this.S.enabled) { b.speed = 0; return; }
    b.cd = Math.max(0, (b.cd || 0) - dt);
    b.enraged = Math.max(0, (b.enraged || 0) - dt);
    const doll = H.kind === 'doll';
    // footsteps / voice
    if (doll) { b.laughT = (b.laughT == null ? 4 + Math.random() * 5 : b.laughT) - dt; }
    switch (b.state) {
      case 'hAttack': return this.updateAttack(h, b, dt);
      case 'hLaugh': case 'hTilt': { b.speed = 0; if (b.t > (b.holdT || 1.4)) this.setState(h, b, b.hTarget ? 'hHunt' : 'hIdle'); if (b.hTarget) a.lookAt(b.hTarget.boneWPos[B.head], 0.8); return; }
    }
    // prey
    b.retarget = (b.retarget || 0) - dt;
    let tgt = b.hTarget;
    if (!this.validPrey(h, tgt, def.detect * 1.5)) tgt = null;
    if (!tgt || b.retarget <= 0) { const n = this.pickPrey(h, def); if (n && (!tgt || b.state !== 'hHunt' || n === tgt)) tgt = n; b.retarget = 2; }
    if (tgt && h.transit) g.transit.interrupt(h);
    if (tgt !== b.hTarget) {
      const was = b.hTarget; b.hTarget = tgt; b.chaseT = 0;
      if (tgt && !was) {
        // first sight: the slasher's slow head tilt, the doll's laugh
        if (doll) { this.laugh(h, b); return; }
        this.setState(h, b, 'hTilt'); b.holdT = 1.5; a.setAction('htilt', { dur: 1.5, dir: Math.random() < 0.5 ? 1 : -1, inT: 0.3, outT: 0.4 });
        a.lookAt(tgt.boneWPos[B.head], 1);
        return;
      }
    }
    if (tgt) {
      const d = Math.hypot(tgt.root.pos.x - h.root.pos.x, tgt.root.pos.z - h.root.pos.z);
      this.setState(h, b, 'hHunt');
      b.hunting = true;
      a.lookAt(tgt.boneWPos[B.head], 1);
      if (a.action && a.action.type === 'hidle' && !a.action.ending) a.setAction(null);
      const fleeing = tgt.brain && (tgt.brain.state === 'flee');
      b.chaseT = fleeing && d > 7 ? (b.chaseT || 0) + dt : Math.max(0, (b.chaseT || 0) - dt * 2);
      let run;
      if (doll) run = d < def.rushR;
      else run = b.enraged > 0 || b.chaseT > 2.5; // the slasher only runs once the prey keeps getting away
      b.dest.copy(tgt.root.pos);
      if (tgt.brain && run) b.dest.addScaledVector(tgt.brain.vel, Math.min(0.4, d / 12));
      b.speed = (run ? def.run : def.walk) * (d < def.reach + 0.5 ? 0.6 : 1);
      if (d < def.reach && b.cd <= 0 && tgt.physMode === 'anim') this.startAttack(h, b, tgt);
      else if (d < def.reach * 1.1 && tgt.physMode !== 'anim' && b.cd <= 0) this.startAttack(h, b, tgt);
      if (doll && b.laughT <= 0 && d > 3) this.laugh(h, b);
      return;
    }
    // idle: look around, fidget, wander - or sit down / take the train like anyone else
    b.hunting = false;
    if (g.transit && g.transit.think(h, b, dt)) return;
    if (b.state !== 'hIdle' && b.state !== 'hWander') this.setState(h, b, 'hIdle');
    if (b.state === 'hIdle') {
      b.speed = 0;
      const ia = a.action;
      if ((!ia || ia.ending) && a.speed < 0.2) a.setAction('hidle', { mode: doll ? (Math.random() < 0.5 ? 'tap' : 'look') : (Math.random() < 0.6 ? 'breathe' : 'look'), dur: 3 + Math.random() * 3, ph: Math.random() * 6, inT: 0.5, outT: 0.6 });
      if (doll && b.laughT <= 0) this.laugh(h, b);
      if (b.t > 5 + Math.random() * 4 && Settings.data.ai.wander) { g.ai.pickWander(h, b); this.setState(h, b, 'hWander'); if (a.action && a.action.type === 'hidle') a.setAction(null); }
    } else {
      b.speed = def.walk * 0.8; a.clearLook();
      if (Math.hypot(h.root.pos.x - b.dest.x, h.root.pos.z - b.dest.z) < 0.6 || b.t > 14) this.setState(h, b, 'hIdle');
    }
  }
  laugh(h, b) {
    b.laughT = 6 + Math.random() * 8;
    this.setState(h, b, 'hLaugh'); b.holdT = 1.6; b.speed = 0;
    h.anim.setAction('hlaugh', { dur: 1.6, inT: 0.2, outT: 0.4 });
    this.game.audio.play('dollLaugh', { pos: h.boneWPos[B.head].clone(), gain: 0.9 });
  }
  startAttack(h, b, tgt) {
    const def = h.horror.def, clip = def.clips[Math.floor(Math.random() * def.clips.length)], C = SCRATCH_CLIPS[clip];
    const dur = C.dur * (h.horror.kind === 'doll' ? 0.75 : 1.05);
    this.setState(h, b, 'hAttack'); b.speed = 0; b.faceTarget = tgt.root.pos; b.hVictim = tgt; b.struck = false; b.attackDur = dur; b.attackHit = C.hit;
    h.anim.setAction('scratch', { clip, side: 1, dur, target: tgt, grip: true, inT: 0.1, outT: 0.25 });
    this.game.audio.play('swing', { pos: h.boneWPos[SB('hand', 1)].clone(), gain: 0.7, rate: h.horror.kind === 'doll' ? 1.3 : 0.8 });
    h.lastReaction = 'Attacking';
  }
  updateAttack(h, b, dt) {
    const v = b.hVictim, def = h.horror.def;
    b.speed = 0;
    if (v && !v.removed) b.faceTarget = v.root.pos;
    if (!b.struck && b.t >= b.attackDur * b.attackHit) {
      b.struck = true;
      if (v && !v.removed && (v.lifeState === 'alive' || v.lifeState === 'dead')) {
        const dx = v.root.pos.x - h.root.pos.x, dz = v.root.pos.z - h.root.pos.z, d = Math.hypot(dx, dz);
        const facing = (Math.sin(h.root.yaw) * dx + Math.cos(h.root.yaw) * dz) / Math.max(d, 1e-3);
        if (d < def.reach + 0.35 && facing > 0.3) this.strike(h, v, dx / Math.max(d, 1e-3), dz / Math.max(d, 1e-3));
        else this.game.audio.play('swing', { pos: h.boneWPos[SB('hand', 1)].clone(), gain: 0.4 });
      }
    }
    if (b.t >= b.attackDur) {
      b.hVictim = null; b.cd = def.cooldown[0] + Math.random() * (def.cooldown[1] - def.cooldown[0]);
      this.setState(h, b, b.hTarget ? 'hHunt' : 'hIdle');
    }
  }
  strike(h, v, dx, dz) {
    const g = this.game, def = h.horror.def, S = this.S;
    let region = def.regions[Math.floor(Math.random() * def.regions.length)];
    if (v.physMode === 'ragdoll') region = Math.random() < 0.5 ? REGION.TORSO : REGION.ABDOMEN;
    // monsters: the slasher goes for a zombie's head; both go for a vampire's heart
    else if (v.lifeState === 'zombie') region = h.horror.kind === 'slasher' && Math.random() < 0.45 ? REGION.HEAD : region;
    else if (v.lifeState === 'vampire') region = Math.random() < 0.7 ? REGION.UPPER_CHEST : REGION.TORSO;
    const dir = new V3(dx, 0, dz);
    const p = v.boneWPos[REGION_BONE[region]].clone();
    const res = v.applyHit({ region, damage: def.damage * S.damage / REGION_DAMAGE_MUL[region], weapon: 'knife', dir: dir.clone(), point: p, force: h.horror.kind === 'doll' ? 3 : 9, threatPos: h.root.pos.clone() });
    const vi = g.gore.nearestVertex(v, p, [region]);
    if (vi >= 0) g.gore.onClaw(v, h, vi, v.skinVertexWorld(vi, new V3()), dir);
    g.audio.play('stab', { pos: p, gain: 0.9 });
    g.hits.report(v, region, res, h.horror.label + (h.horror.kind === 'doll' ? ' (Knife)' : ' (Machete)'), p);
    if (region === REGION.HEAD && v.lifeState === 'zombie' && h.horror.kind === 'slasher') v.criticalHead = true;
    if (v.active && v.physMode === 'anim') {
      if (Math.random() < def.knock || v.health < 25) {
        v.goRagdoll('Knocked Down (' + h.horror.label + ')');
        v.rag.applyImpulseAt(RAG.CHEST, dir.clone().multiplyScalar(h.horror.kind === 'doll' ? 25 : 120).setY(10), null);
        v.downTimer = Math.max(v.downTimer, 2.5);
      } else g.ai.onHit(v, { region, dir: dir.clone(), force: 5, threatPos: h.root.pos.clone() });
    } else if (res.killed) {
      for (const bd of v.rag.bodies) bd.vel.addScaledVector(dir, 1.5);
      h.kills++;
    }
    g.ai.emit('scream', p, { threatPos: h.root.pos.clone(), source: v });
  }
  onHit(h, info) {
    const b = h.brain; if (!b) return;
    if (info.dir) b.stagger.copy(info.dir).setY(0).multiplyScalar(h.horror.kind === 'doll' ? 1.2 : 0.25);
    if (h.horror.kind === 'slasher') { b.enraged = 5; h.lastReaction = 'Unfazed'; }
    else { h.lastReaction = 'Stagger'; if (Math.random() < 0.3 && b.state !== 'hAttack') this.laugh(h, b); }
  }
}
HT.HorrorSystem = HorrorSystem;
