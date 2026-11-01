// ============================================================================
// Horror characters (V1.06): two fan-made slasher icons with their own looks,
// movement, idles, AI and attacks. Built from the procedural generator (see
// applySpecialLook) - no external or copied assets.
//   doll    - "Chucky": short, quick, laughing; stalks then rushes in to stab
//   slasher - "Jason":  huge, slow, relentless; head tilt on sight, runs only
//             when the prey keeps getting away (or he is shot); machete swings
//   doctor  - "The Physician" (V1.10): an original containment-doctor design.
//             Never attacks. Wanders, inspects his injector, walks up to an
//             ordinary person and injects them - they enter the normal
//             infection progression - then stands and observes. Now and then
//             a closing-fist gesture hastens an infected subject's turning.
// Chucky and Jason hunt people, zombies and vampires (never another horror
// character). None of them is ever bitten or reanimated, and they fall as
// ordinary ragdolls when defeated. Zombies and vampires ignore all three.
// ============================================================================
const HORROR_DEFS = {
  doll: { label: 'Chucky', health: 150, armor: 0.8, walk: 0.95, run: 3.3, detect: 18, rushR: 5.5, reach: 0.82, damage: 20, cooldown: [0.9, 1.6],
    regions: [REGION.L_THIGH, REGION.R_THIGH, REGION.ABDOMEN, REGION.PELVIS, REGION.L_LOWER_LEG], knock: 0.22, clips: ['overhead', 'jab'] },
  slasher: { label: 'Jason', health: 700, armor: 0.45, walk: 1.1, run: 4.6, detect: 26, rushR: 0, reach: 1.25, damage: 58, cooldown: [1.4, 2.2],
    regions: [REGION.NECK, REGION.UPPER_CHEST, REGION.TORSO, REGION.L_UPPER_ARM, REGION.R_UPPER_ARM], knock: 0.65, clips: ['overhead', 'backhand'] },
  // the containment doctor: never attacks; wanders, inspects his injector, and injects people
  doctor: { label: 'The Physician', health: 420, armor: 0.55, walk: 0.78, run: 1.7, detect: 18, rushR: 0, reach: 0.75, damage: 0, cooldown: [16, 26],
    regions: [REGION.NECK, REGION.L_UPPER_ARM, REGION.R_UPPER_ARM], knock: 0.4, clips: [] }
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
    const npc = g.npcs.spawn({ gender: 'male', pos: p, yaw, overrides: { special: HORROR_DEFS[kind] ? kind : 'doll' } });
    if (!npc) return null;
    npc.spawnKind = kind;
    HT.log('horror', `${npc.idStr} ${npc.horror.label} appeared`);
    return npc;
  }
  // called for every NPC built with a special look (spawn, rebuild, reset)
  attach(npc, special) {
    const kind = HORROR_DEFS[special] ? special : 'doll', def = HORROR_DEFS[kind];
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
  // something broke a hold (the subject was knocked down, shot, removed...): Chucky and Jason only swing
  release(n) { if (n.horror && n.horror.kind === 'doctor' && n.brain && n.brain.victim) this.endInject(n, n.brain); }
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
    if (H.kind === 'doctor') return this.thinkDoctor(h, b, dt);
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
    if (h.horror.kind === 'doctor') { // barely flinches; a hold in progress is kept
      if (info.dir) b.stagger.copy(info.dir).setY(0).multiplyScalar(0.35);
      h.lastReaction = 'Unmoved'; h.anim.kick(B.chest, _hz1.set(0.5, (Math.random() - 0.5) * 0.6, 0));
      return;
    }
    if (info.dir) b.stagger.copy(info.dir).setY(0).multiplyScalar(h.horror.kind === 'doll' ? 1.2 : 0.25);
    if (h.horror.kind === 'slasher') { b.enraged = 5; h.lastReaction = 'Unfazed'; }
    else { h.lastReaction = 'Stagger'; if (Math.random() < 0.3 && b.state !== 'hAttack') this.laugh(h, b); }
  }

  // --- the containment doctor ------------------------------------------------------------
  // an ordinary, healthy person standing on the same level, not already infected, held, seated or riding
  eligibleSubject(h, o, maxD) {
    if (!o || o.removed || o === h || o.horror || o.lifeState !== 'alive' || o.physMode !== 'anim' || o.carried) return false;
    if (o.infection || (o.vamp && o.vamp.state !== 'none') || o.grabbedBy || o.seatLock || o.riding || (o.anim && o.anim.crawl)) return false;
    if (Math.abs(o.root.pos.y - h.root.pos.y) > 1.2) return false;
    return Math.hypot(o.root.pos.x - h.root.pos.x, o.root.pos.z - h.root.pos.z) < maxD;
  }
  pickSubject(h, def) {
    let best = null, bs = 1e9;
    for (const o of this.game.npcs.list) {
      if (!this.eligibleSubject(h, o, def.detect)) continue;
      let claimed = false; for (const w of this.game.npcs.list) if (w !== h && w.brain && w.brain.subject === o) claimed = true;
      if (claimed) continue;
      const moving = o.brain && o.brain.vel ? Math.hypot(o.brain.vel.x, o.brain.vel.z) : 0;
      const sc = Math.hypot(o.root.pos.x - h.root.pos.x, o.root.pos.z - h.root.pos.z) + moving * 2.5 + (o.brain && o.brain.state === 'flee' ? 12 : 0) + Math.random() * 2;
      if (sc < bs) { bs = sc; best = o; }
    }
    return best;
  }
  // someone infected (by him or by a bite) and well into the sickness, close by
  pickInfected(h, maxD) {
    let best = null, bd = maxD;
    for (const o of this.game.npcs.list) {
      if (o === h || o.removed || o.horror || o.lifeState !== 'alive' || o.physMode !== 'anim' || !o.infection || o.infection.collapsed || o.grabbedBy) continue;
      const k = o.infection.t / o.infection.dur;
      if (k < 0.3 || k > 0.72 || Math.abs(o.root.pos.y - h.root.pos.y) > 1.2) continue;
      const d = Math.hypot(o.root.pos.x - h.root.pos.x, o.root.pos.z - h.root.pos.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  // world position of the needle tip (the injector is rigid on the right hand bone)
  injectorTip(h, out) {
    const rig = h.rig, hb = SB('hand', 1), sk = rig.H / 1.75, wr = rig.bindPos[hb];
    out.set(0, 0, 0).addScaledVector(rig.armDir[1], rig.palmLen * 0.62).addScaledVector(rig.armE2[1], 0.006 + 0.008 * sk).addScaledVector(rig.armE1[1], -0.13 * sk);
    return out.applyQuaternion(h.boneWRot[hb]).add(h.boneWPos[hb]);
  }
  needleDir(h, out) { return out.copy(h.rig.armE1[1]).negate().applyQuaternion(h.boneWRot[SB('hand', 1)]); }
  thinkDoctor(h, b, dt) {
    const g = this.game, a = h.anim, def = h.horror.def, Z = Settings.data.zombies, act = a.action;
    b.cd = Math.max(0, (b.cd == null ? 5 + Math.random() * 5 : b.cd) - dt);
    b.trigCd = Math.max(0, (b.trigCd == null ? 12 + Math.random() * 8 : b.trigCd) - dt);
    b.inspCd = Math.max(0, (b.inspCd == null ? 2 + Math.random() * 4 : b.inspCd) - dt);
    b.hunting = b.state === 'dInject';
    switch (b.state) {
      case 'dInject': return this.doctorInject(h, b, dt);
      case 'dTrigger': return this.doctorTrigger(h, b, dt);
      case 'dInspect':
        b.speed = 0;
        if (act && act.type === 'dinspect' && act.squirt === 1) { act.squirt = 2; const p = this.injectorTip(h, _hz1); g.fx.serum(p, this.needleDir(h, _hz2), 5, 0.6); g.audio.play('inject', { pos: p.clone(), gain: 0.3, rate: 1.6 }); }
        if (!act || act.type !== 'dinspect' || act.ending) this.setState(h, b, 'dIdle');
        return;
      case 'dObserve': {
        const sj = b.subject;
        const watching = sj && !sj.removed && (sj.lifeState === 'alive' || sj.lifeState === 'dead' || sj.lifeState === 'reanimating' || sj.lifeState === 'zombie') && Math.abs(sj.root.pos.y - h.root.pos.y) < 2;
        if (!watching || b.t > b.obsT) { b.subject = null; a.clearLook(); this.setState(h, b, 'dIdle'); break; }
        a.lookAt(sj.boneWPos[B.head], 0.9);
        const d = Math.hypot(sj.root.pos.x - h.root.pos.x, sj.root.pos.z - h.root.pos.z);
        // keeps a clinical distance: follows slowly if the subject gets far, otherwise stands with hands behind his back
        if (d > 7) { b.dest.copy(sj.root.pos); b.speed = def.walk * 0.9; if (act && act.type === 'didle') a.setAction(null); }
        else { b.speed = 0; b.faceTarget = sj.root.pos; if ((!act || act.ending) && a.speed < 0.2) a.setAction('didle', { mode: Math.random() < 0.7 ? 'behind' : 'still', dur: 3 + Math.random() * 2, ph: Math.random() * 6, inT: 0.6, outT: 0.6 }); }
        // hasten it along once the sickness has taken hold
        if (b.trigCd <= 0) {
          const k = sj.infection ? sj.infection.t / sj.infection.dur : 0;
          const ripe = sj.lifeState === 'alive' && sj.infection && !sj.infection.collapsed && d < 6.5 && sj.physMode === 'anim' && k > 0.3 && k < 0.72;
          if (this.considerTrigger(h, b, ripe ? sj : null, dt)) return;
        }
        return;
      }
    }
    if (h.physMode !== 'anim') return;
    // a subject: walk up at a measured pace (he never runs after anyone)
    if (b.state === 'dStalk') {
      const v = b.subject;
      if (!Z.infection || !this.eligibleSubject(h, v, def.detect * 1.4) || b.t > 32) { b.subject = null; a.clearLook(); this.setState(h, b, 'dIdle'); b.cd = 4 + Math.random() * 4; }
      else {
        const d = Math.hypot(v.root.pos.x - h.root.pos.x, v.root.pos.z - h.root.pos.z);
        a.lookAt(v.boneWPos[B.head], d < 6 ? 1 : 0.6);
        if (act && act.type === 'didle' && !act.ending) a.setAction(null);
        b.dest.copy(v.root.pos);
        b.speed = d > 2.6 ? def.walk : d > 1.2 ? def.walk * 1.35 : def.walk * 0.8;
        if (d < def.reach + 0.3) this.startInject(h, b, v);
        return;
      }
    }
    // idle and wander - he also sits down and rides trains, like anyone else
    if (!h.riding && Z.infection && b.cd <= 0 && b.state !== 'dStalk') {
      const v = this.pickSubject(h, def);
      if (v) {
        if (h.transit) g.transit.interrupt(h);
        b.subject = v; this.setState(h, b, 'dStalk'); h.lastReaction = 'Selecting a subject';
        HT.log('horror', `${h.idStr} ${h.horror.label} is approaching ${v.idStr} ${v.name}`);
        return;
      }
      b.cd = 2 + Math.random() * 2; // look again in a moment
    }
    if (!h.riding && b.trigCd <= 0 && this.considerTrigger(h, b, this.pickInfected(h, 6), dt)) return;
    if (g.transit && g.transit.think(h, b, dt)) return;
    if (b.state !== 'dIdle' && b.state !== 'dWander') this.setState(h, b, 'dIdle');
    if (b.state === 'dIdle') {
      b.speed = 0;
      if ((!act || act.ending) && a.speed < 0.2) {
        if (b.inspCd <= 0 && Math.random() < 0.4) {
          b.inspCd = 12 + Math.random() * 12; this.setState(h, b, 'dInspect');
          a.setAction('dinspect', { dur: 4.4, dir: Math.random() < 0.5 ? 1 : -1, inT: 0.4, outT: 0.5 }); h.lastReaction = 'Inspecting the injector';
          return;
        }
        const modes = ['behind', 'behind', 'glove', 'vials', 'still'];
        a.setAction('didle', { mode: modes[Math.floor(Math.random() * modes.length)], dur: 3.5 + Math.random() * 3.5, ph: Math.random() * 6, inT: 0.6, outT: 0.6 });
      }
      if (b.t > (b.idleFor || (b.idleFor = 6 + Math.random() * 6)) && Settings.data.ai.wander) {
        b.idleFor = 0; g.ai.pickWander(h, b); this.setState(h, b, 'dWander');
        if (act && act.type === 'didle') a.setAction(null);
      }
    } else {
      b.speed = def.walk * 0.85; a.clearLook();
      if (Math.hypot(h.root.pos.x - b.dest.x, h.root.pos.z - b.dest.z) < 0.6 || b.t > 16) this.setState(h, b, 'dIdle');
    }
  }
  startInject(h, b, v) {
    const g = this.game;
    if (v.transit) g.transit.interrupt(v);
    this.setState(h, b, 'dInject'); b.speed = 0; b.victim = v; b.subject = v; b.faceTarget = null;
    b.injRegion = Math.random() < 0.6 ? 'neck' : 'arm';
    v.grabbedBy = h; h.rag.noCollideWith = v.rag; v.rag.noCollideWith = h.rag;
    if (v.brain) { v.brain.state = 'grabbed'; v.brain.t = 0; v.brain.screamT = 0.5; v.brain.pending.length = 0; }
    v.anim.setAction('struggle', { target: h, away: Math.random() < 0.5 ? 1 : -1, forceMode: Math.random() < 0.45 ? 'freeze' : null });
    v.anim.setUpper('hang'); v.fear = 1; v.lastReaction = 'Seized by ' + h.horror.label;
    h.anim.setAction('dinject', { target: v, region: b.injRegion, dur: 3.0, inT: 0.25, outT: 0.5 });
    h.lastReaction = 'Injecting';
    HT.log('horror', `${h.idStr} ${h.horror.label} seized ${v.idStr} ${v.name}`);
  }
  doctorInject(h, b, dt) {
    const v = b.victim, a = h.anim;
    b.speed = 0;
    if (!v || v.removed || v.lifeState !== 'alive' || v.physMode !== 'anim' || v.grabbedBy !== h || h.physMode !== 'anim') { this.endInject(h, b); return; }
    // hold the subject at arm's length, face to face
    const dir = _hz1.subVectors(v.root.pos, h.root.pos); dir.y = 0;
    let d = dir.length(); if (d < 1e-4) { dir.set(0, 0, 1); d = 1e-4; } else dir.multiplyScalar(1 / d);
    const want = 0.52 * (h.rig.H + v.rig.H) / 3.5, corr = (d - want) * Math.min(1, dt * 6) * 0.5;
    h.root.pos.addScaledVector(dir, corr); v.root.pos.addScaledVector(dir, -corr);
    b.vel.multiplyScalar(0.8); if (v.brain) v.brain.vel.multiplyScalar(0.8);
    h.root.yaw = angleDamp(h.root.yaw, Math.atan2(dir.x, dir.z), 8, dt);
    v.root.yaw = angleDamp(v.root.yaw, Math.atan2(-dir.x, -dir.z), 5, dt);
    const act = a.action;
    if (act && act.type === 'dinject' && act.hit === 1) { act.hit = 2; this.inject(h, v, b); }
    if (!act || act.type !== 'dinject' || act.ending) this.endInject(h, b);
  }
  // the needle goes in: a jolt and a gasp, no wound - the subject now carries the infection
  inject(h, v, b) {
    const g = this.game, Z = Settings.data.zombies, p = this.injectorTip(h, new V3()), nd = this.needleDir(h, new V3());
    if (!v.infection) v.infection = { t: 0, dur: Z.infectionTime * (0.92 + Math.random() * 0.16), src: 'doctor' };
    v.injectedBy = h;
    v.anim.kick(B.neck, _hz2.set(0.35, (Math.random() - 0.5) * 1.2, 0)); v.anim.kick(B.chest, _hz2.set(-0.5, 0, 0));
    g.fx.serum(p, nd.negate(), 4, 0.35);
    g.audio.play('inject', { pos: p, gain: 0.9 });
    g.audio.play('scream' + Math.floor(Math.random() * 3), { pos: v.boneWPos[B.head].clone(), gain: 0.7, rate: 1.15 });
    v.lastReaction = 'Injected'; Events.emit('reaction', { npc: v, reaction: v.lastReaction });
    g.ai.emit('scream', v.boneWPos[B.head].clone(), { threatPos: h.root.pos.clone(), source: v });
    HT.log('horror', `${h.idStr} ${h.horror.label} injected ${v.idStr} ${v.name}: infected (${v.infection.dur.toFixed(0)} s)`);
  }
  endInject(h, b) {
    const v = b.victim;
    b.victim = null;
    if (v) {
      if (v.grabbedBy === h) v.grabbedBy = null;
      if (v.anim.action && v.anim.action.type === 'struggle') v.anim.setAction(null);
      if (v.brain && v.brain.state === 'grabbed' && v.lifeState === 'alive') {
        v.brain.state = 'flee'; v.brain.t = 0; v.brain.fleeT = 6;
        v.brain.threat.copy(h.root.pos); v.brain.hasThreat = true; v.brain.threatNpc = h; v.fear = 1;
      }
    }
    if (h.anim.action && h.anim.action.type === 'dinject') h.anim.setAction(null);
    const def = h.horror.def;
    b.cd = def.cooldown[0] + Math.random() * (def.cooldown[1] - def.cooldown[0]);
    if (v && !v.removed && v.infection && v.lifeState === 'alive') { b.subject = v; b.obsT = 9 + Math.random() * 7; this.setState(h, b, 'dObserve'); }
    else { b.subject = null; this.setState(h, b, 'dIdle'); }
  }
  // an infected subject well into the sickness is noticed, considered for a moment, then hastened along
  considerTrigger(h, b, sj, dt) {
    if (!sj) { b.trigWait = null; return false; }
    if (b.trigWait == null) b.trigWait = 1.5 + Math.random() * 3;
    b.trigWait -= dt;
    if (b.trigWait > 0) return false;
    b.trigWait = null;
    if (h.transit) this.game.transit.interrupt(h);
    this.startTrigger(h, b, sj);
    return true;
  }
  startTrigger(h, b, sj) {
    this.setState(h, b, 'dTrigger'); b.speed = 0; b.subject = sj; b.faceTarget = sj.root.pos;
    b.trigCd = 30 + Math.random() * 25;
    h.anim.setAction('dtrigger', { target: sj, dur: 3.4, dir: Math.random() < 0.5 ? 1 : -1, inT: 0.4, outT: 0.6 });
    h.anim.lookAt(sj.boneWPos[B.head], 1);
    this.game.audio.play('dtrigger', { pos: h.boneWPos[B.head].clone(), gain: 0.8 });
    h.lastReaction = 'Triggering the change';
  }
  doctorTrigger(h, b, dt) {
    const sj = b.subject, a = h.anim, act = a.action;
    b.speed = 0;
    if (sj && !sj.removed) { b.faceTarget = sj.root.pos; a.lookAt(sj.boneWPos[B.head], 1); }
    if (act && act.type === 'dtrigger' && act.fire === 1) {
      act.fire = 2;
      const inf = sj && !sj.removed && sj.lifeState === 'alive' ? sj.infection : null;
      if (inf && !inf.collapsed) {
        // the sickness jumps ahead to the point of collapse; the turning itself runs as normal
        inf.t = Math.max(inf.t, inf.dur * INFECTION.collapse);
        sj.anim.kick(B.chest, _hz1.set(-1.2, 0, 0)); sj.anim.kick(B.neck, _hz1.set(0.8, (Math.random() - 0.5) * 1.5, 0));
        HT.log('horror', `${h.idStr} ${h.horror.label} triggered ${sj.idStr} ${sj.name}'s turning`);
      }
    }
    if (!act || act.type !== 'dtrigger' || act.ending) {
      b.faceTarget = null;
      if (sj && !sj.removed && sj.lifeState !== 'destroyed') { b.obsT = 10 + Math.random() * 6; this.setState(h, b, 'dObserve'); }
      else { b.subject = null; this.setState(h, b, 'dIdle'); }
    }
  }
}
HT.HorrorSystem = HorrorSystem;
