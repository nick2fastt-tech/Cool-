// ============================================================================
// AI: stimuli (sound/visual events), per-NPC brains with individual timing,
// steering (separation, bounds), living behaviors and zombie behaviors.
// ============================================================================
const STIM = {
  gunshot: { radius: 32, intensity: 0.55 }, sniper: { radius: 48, intensity: 0.75 }, impact: { radius: 7, intensity: 0.35 },
  explosion: { radius: 45, intensity: 1.0 }, death: { radius: 14, intensity: 0.45 }, scream: { radius: 16, intensity: 0.35 },
  knife: { radius: 5, intensity: 0.5 }, zombie: { radius: 9, intensity: 0.4 }, thud: { radius: 6, intensity: 0.2 }
};

class Brain {
  constructor(npc) {
    this.npc = npc; this.state = 'idle'; this.t = 0; this.dest = new V3(); this.speed = 0; this.vel = new V3();
    this.threat = new V3(); this.hasThreat = false; this.threatNpc = null;
    this.pending = []; this.thinkTimer = Math.random() * 0.3;
    this.idleTime = 2 + Math.random() * 6; this.lookTimer = 0; this.lookPos = new V3(); this.lookKind = '';
    this.aimTime = 0; this.handsUpT = 0; this.hurtT = 0; this.stagger = new V3(); this.attackT = 0; this.groanT = 2 + Math.random() * 4;
    this.frozen = false; this.holdPose = null; this.stuckT = 0; this.lastPos = new V3();
    this.home = new V3();
  }
}

class AISystem {
  constructor(game) { this.game = game; this.stimuli = []; this._tmp = new V3(); this.aimed = null; }
  attach(npc) { npc.brain = new Brain(npc); npc.brain.home.copy(npc.root.pos); }
  detach(npc) { if (npc.brain) npc.brain.npc = null; for (const n of this.game.npcs.list) if (n.zombieTarget === npc) n.zombieTarget = null; }
  // broadcast a stimulus
  emit(type, pos, opts = {}) {
    const def = STIM[type] || STIM.impact;
    const S = Settings.data.ai;
    const radius = (opts.radius || def.radius);
    for (const npc of this.game.npcs.list) {
      if (npc === opts.source || !npc.brain) continue;
      const d = npc.root.pos.distanceTo(pos);
      if (d > radius) continue;
      if (npc.lifeState === 'zombie') { if (type !== 'death') this.zombieHear(npc, pos, d); continue; }
      if (npc.lifeState !== 'alive') continue;
      const delay = npc.personality.reaction * S.reactionVariance + d / 343 + Math.random() * 0.08;
      npc.brain.pending.push({ type, pos: pos.clone(), d, radius, intensity: (opts.intensity || def.intensity) * (1 - d / radius) * 1.3, at: this.game.time + delay, threatPos: (opts.threatPos || pos).clone() });
    }
  }
  zombieHear(npc, pos, d) {
    const b = npc.brain;
    if (b.state === 'zIdle' && d < 20) { b.dest.copy(pos); b.state = 'zInvestigate'; b.t = 0; }
  }
  onHit(npc, info) {
    const b = npc.brain; if (!b) return;
    const anim = npc.anim;
    // additive physical reaction on the hit bone (springs)
    const bone = REGION_BONE[info.region];
    if (info.dir) {
      const ax = _v1.crossVectors(UP, info.dir).normalize();
      const strength = clamp(info.force || 4, 1, 14);
      _q1.setFromAxisAngle(UP, -npc.root.yaw); ax.applyQuaternion(_q1);
      anim.kick(bone, ax.clone().multiplyScalar(strength * 1.2));
      anim.kick(B.chest, ax.clone().multiplyScalar(strength * 0.5));
      anim.kick(B.spine, ax.clone().multiplyScalar(strength * 0.3));
    }
    if (npc.lifeState === 'zombie') {
      b.stagger.copy(info.dir || _v2.set(0, 0, 0)).setY(0).multiplyScalar(0.8);
      npc.lastReaction = 'Stagger (Zombie)';
      return;
    }
    if (npc.lifeState !== 'alive') return;
    npc.fear = clamp(npc.fear + 0.5, 0, 1);
    if (info.dir) b.stagger.copy(info.dir).setY(0).multiplyScalar(clamp((info.force || 4) * 0.12, 0.3, 1.6));
    // limp / clutch
    const reg = info.region;
    if (reg === REGION.L_THIGH || reg === REGION.L_LOWER_LEG || reg === REGION.L_FOOT) anim.limp[0] = Math.min(1, anim.limp[0] + 0.6);
    if (reg === REGION.R_THIGH || reg === REGION.R_LOWER_LEG || reg === REGION.R_FOOT) anim.limp[1] = Math.min(1, anim.limp[1] + 0.6);
    b.state = 'hurt'; b.t = 0; b.hurtT = 1.4 + Math.random() * 1.6; b.hurtRegion = reg;
    b.hasThreat = !!info.threatPos; if (info.threatPos) b.threat.copy(info.threatPos);
    anim.setPosture('wounded', 0.15);
    if (reg === REGION.HEAD || reg === REGION.NECK) { anim.setUpper('cover'); npc.lastReaction = 'Protective Animation (Head)'; }
    else { anim.setUpper('clutch', reg); npc.lastReaction = 'Protective Animation (Clutch ' + REGION_NAMES[reg] + ')'; }
    Events.emit('reaction', { npc, reaction: npc.lastReaction });
  }
  update(dt) {
    const game = this.game, S = Settings.data.ai;
    const list = game.npcs.list;
    // player aiming detection
    this.updateAim(dt);
    for (const npc of list) {
      const b = npc.brain; if (!b || b.frozenMove) continue;
      try {
        if (npc.lifeState === 'zombie') this.updateZombie(npc, b, dt);
        else if (npc.lifeState === 'alive') this.updateAlive(npc, b, dt);
        else { b.state = 'dead'; }
        if (npc.physMode === 'anim' && (npc.lifeState === 'alive' || npc.lifeState === 'zombie')) this.steer(npc, b, dt);
      } catch (e) { reportError(e, 'ai ' + npc.idStr); }
    }
  }
  updateAim(dt) {
    const game = this.game;
    const tool = game.weapons ? game.weapons.current : null;
    let target = null;
    if (tool && tool.isGun && game.player.aiming !== undefined) {
      const hit = game.weapons.pickNPC(18);
      if (hit && hit.npc.lifeState === 'alive') target = hit.npc;
    }
    for (const npc of game.npcs.list) {
      const b = npc.brain; if (!b) continue;
      if (npc === target) b.aimTime += dt; else b.aimTime = Math.max(0, b.aimTime - dt * 2);
    }
  }
  setState(npc, b, s) { if (b.state !== s) { b.state = s; b.t = 0; } }
  updateAlive(npc, b, dt) {
    const S = Settings.data.ai, game = this.game, anim = npc.anim;
    b.t += dt;
    npc.fear = Math.max(0, npc.fear - dt * 0.04);
    for (let s = 0; s < 2; s++) anim.limp[s] = Math.max(0, anim.limp[s] - dt * 0.03);
    if (npc.physMode !== 'anim') { b.pending.length = 0; return; }
    if (!S.enabled || b.frozen) {
      b.speed = 0; b.dest.copy(npc.root.pos);
      if (b.holdPose) anim.setUpper(b.holdPose);
      return;
    }
    // process pending stimuli
    for (let i = b.pending.length - 1; i >= 0; i--) {
      const st = b.pending[i];
      if (game.time >= st.at) { b.pending.splice(i, 1); this.react(npc, b, st); }
    }
    // hands-up when aimed at
    if (S.reactions && b.aimTime > 0.55 && b.state !== 'flee' && b.state !== 'hurt') {
      if (b.state !== 'handsUp') { this.setState(npc, b, 'handsUp'); npc.lastReaction = 'Hands Up (Aimed At)'; Events.emit('reaction', { npc, reaction: npc.lastReaction }); }
      b.handsUpT = 1.5;
    }
    // zombie threat
    if (S.reactions) {
      const z = this.nearestZombie(npc, 7.5);
      if (z && b.state !== 'flee' && b.state !== 'fight') {
        b.threat.copy(z.root.pos); b.hasThreat = true; b.threatNpc = z;
        npc.fear = Math.min(1, npc.fear + 0.4);
        if (npc.personality.bravery > 0.82 && npc.health > 50) { this.setState(npc, b, 'fight'); npc.lastReaction = 'Defensive (Fight Back)'; }
        else if (S.flee) { this.setState(npc, b, 'flee'); b.fleeT = 4 + Math.random() * 3; npc.lastReaction = 'Fleeing (Zombie)'; }
        Events.emit('reaction', { npc, reaction: npc.lastReaction });
      }
    }
    switch (b.state) {
      case 'idle': {
        b.speed = 0;
        anim.setPosture(npc.fear > 0.3 ? 'alert' : 'stand');
        b.idleTime -= dt;
        if (!b.holdPose) {
          anim.idleTimer -= dt;
          if (anim.idleTimer <= 0) {
            const pose = npc.fear > 0.3 ? 'hang' : IDLE_POSES[Math.floor(Math.random() * IDLE_POSES.length)];
            anim.setUpper(pose); anim.idleTimer = (5 + Math.random() * 9) * (pose === 'stretch' || pose === 'scratch' ? 0.35 : 1);
          }
        } else anim.setUpper(b.holdPose);
        this.idleLook(npc, b, dt);
        if (b.idleTime <= 0 && S.wander && Math.random() < S.wanderRate) {
          this.pickWander(npc, b); this.setState(npc, b, 'wander');
        } else if (b.idleTime <= 0) b.idleTime = 3 + Math.random() * 6;
        break;
      }
      case 'wander': {
        b.speed = npc.personality.walkSpeed * Math.sqrt(npc.rig.legLen / 0.84) * (1 - 0.45 * Math.max(anim.limp[0], anim.limp[1]));
        if (!b.holdPose) anim.setUpper('hang');
        anim.setPosture('stand');
        this.idleLook(npc, b, dt);
        if (npc.root.pos.distanceTo(b.dest) < 0.6 || b.t > 25) { this.setState(npc, b, 'idle'); b.idleTime = 3 + Math.random() * 8; }
        break;
      }
      case 'react': {
        b.speed = 0;
        if (b.t > (b.reactDur || 0.6)) { anim.setPosture('alert'); this.decide(npc, b); }
        break;
      }
      case 'flee': {
        const run = npc.personality.runSpeed * Math.sqrt(npc.rig.legLen / 0.84) * (1 - 0.5 * Math.max(anim.limp[0], anim.limp[1]));
        b.speed = run;
        anim.setPosture('stand'); anim.setUpper(npc.fear > 0.85 && b.t < 1.2 ? 'flail' : 'hang');
        // direction away from threat
        if (b.threatNpc && b.threatNpc.lifeState === 'zombie') b.threat.copy(b.threatNpc.root.pos);
        const away = _v1.subVectors(npc.root.pos, b.threat); away.y = 0;
        if (away.lengthSq() < 1e-4) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        away.normalize();
        // wall-aware: rotate away vector if heading into bounds
        const look = _v2.copy(npc.root.pos).addScaledVector(away, 4);
        const bb = game.env.current.bounds;
        if (look.x < bb.minX + 1 || look.x > bb.maxX - 1 || look.z < bb.minZ + 1 || look.z > bb.maxZ - 1) {
          const side = (npc.id % 2 ? 1 : -1);
          away.set(away.z * side, 0, -away.x * side);
        }
        b.dest.copy(npc.root.pos).addScaledVector(away, 5);
        game.env.clampToBounds(b.dest, 1);
        anim.lookAt(_v3.copy(b.threat).setY(npc.rig.eyeY), 0.35);
        if (b.t > (b.fleeT || 5) && npc.root.pos.distanceTo(b.threat) > 10) { this.setState(npc, b, 'idle'); b.idleTime = 4 + Math.random() * 4; npc.lastReaction = 'Alert'; }
        break;
      }
      case 'cower': {
        b.speed = 0;
        anim.setPosture('cower'); anim.setUpper('cover');
        anim.lookAt(_v3.copy(b.threat).setY(npc.rig.eyeY * 0.6), 0.5);
        if (b.t > (b.cowerT || 3)) { anim.setPosture('alert'); this.setState(npc, b, npc.fear > 0.5 && Settings.data.ai.flee ? 'flee' : 'idle'); b.fleeT = 3; }
        break;
      }
      case 'handsUp': {
        b.speed = 0;
        anim.setUpper('handsUp'); anim.setPosture('alert');
        anim.lookAt(game.camera.position, 1);
        b.handsUpT -= dt;
        if (b.handsUpT <= 0 && b.aimTime < 0.1) { this.setState(npc, b, 'idle'); b.idleTime = 2 + Math.random() * 3; anim.setUpper('hang'); }
        break;
      }
      case 'hurt': {
        b.speed = b.t > 0.6 ? npc.personality.walkSpeed * 0.5 : 0;
        if (b.t > 0.6 && b.t < 0.65) { b.dest.copy(npc.root.pos).addScaledVector(_v1.subVectors(npc.root.pos, b.threat).setY(0).normalize(), 2.5); game.env.clampToBounds(b.dest, 1); }
        if (b.t > b.hurtT) {
          anim.setUpper('hang'); anim.setPosture(npc.health < 35 ? 'wounded' : 'alert');
          this.decide(npc, b, true);
        }
        break;
      }
      case 'fight': {
        const z = b.threatNpc;
        if (!z || z.lifeState !== 'zombie' || z.root.pos.distanceTo(npc.root.pos) > 9) { this.setState(npc, b, 'idle'); anim.setUpper('hang'); break; }
        const d = z.root.pos.distanceTo(npc.root.pos);
        b.speed = d > 1.4 ? 0 : 0; b.dest.copy(npc.root.pos);
        anim.lookAt(z.boneWPos[B.head], 1);
        b.faceTarget = z.root.pos;
        anim.setPosture('alert');
        if (d < 1.15 && b.t > 0.6) {
          anim.setUpper('push'); b.t = 0;
          // shove the zombie
          this.shove(z, npc, 4);
          npc.lastReaction = 'Defensive Push';
        } else if (b.t > 0.35) anim.setUpper('guard');
        if (npc.health < 40) { this.setState(npc, b, 'flee'); b.fleeT = 5; }
        break;
      }
      default: this.setState(npc, b, 'idle');
    }
  }
  idleLook(npc, b, dt) {
    const anim = npc.anim, game = this.game;
    b.lookTimer -= dt;
    if (!Settings.data.ai.lookAt) { anim.clearLook(); return; }
    if (b.lookTimer <= 0) {
      b.lookTimer = 2 + Math.random() * 4;
      const r = Math.random();
      const cam = game.camera.position;
      const dCam = npc.root.pos.distanceTo(cam);
      if (dCam < 5 && r < 0.35 * (0.5 + npc.personality.curiosity)) { b.lookKind = 'camera'; }
      else if (r < 0.7) {
        // nearest other NPC in front
        let best = null, bd = 7;
        for (const o of game.npcs.list) {
          if (o === npc || o.lifeState === 'destroyed') continue;
          const d = o.root.pos.distanceTo(npc.root.pos);
          if (d < bd) { bd = d; best = o; }
        }
        if (best) { b.lookKind = 'npc'; b.lookNpc = best; } else b.lookKind = 'none';
      } else if (r < 0.85) {
        b.lookKind = 'around';
        const a = npc.root.yaw + (Math.random() - 0.5) * 2.2;
        b.lookPos.set(npc.root.pos.x + Math.sin(a) * 5, npc.rig.eyeY + (Math.random() - 0.5) * 1.2, npc.root.pos.z + Math.cos(a) * 5);
      } else b.lookKind = 'none';
    }
    if (b.lookKind === 'camera') anim.lookAt(game.camera.position, 0.85);
    else if (b.lookKind === 'npc' && b.lookNpc && !b.lookNpc.removed) anim.lookAt(b.lookNpc.boneWPos[B.head], 0.8);
    else if (b.lookKind === 'around') anim.lookAt(b.lookPos, 0.6);
    else anim.clearLook();
  }
  react(npc, b, st) {
    const S = Settings.data.ai, anim = npc.anim;
    npc.fear = clamp(npc.fear + st.intensity * (1.2 - npc.personality.bravery * 0.5), 0, 1);
    b.threat.copy(st.threatPos); b.hasThreat = true; b.threatNpc = null;
    anim.lookAt(_v1.copy(st.pos).setY(Math.max(st.pos.y, 0.8)), 1);
    b.lookKind = 'threat'; b.lookTimer = 3;
    if (!S.reactions) return;
    if (b.state === 'flee' || b.state === 'cower') { b.fleeT = (b.fleeT || 4) + 1; b.cowerT = (b.cowerT || 3) + 0.5; return; }
    if (b.state === 'hurt' || b.state === 'fight') return;
    const close = st.d < st.radius * 0.45;
    if (close || st.intensity > 0.35) {
      // flinch with individual style
      anim.setPosture('flinch', 0.08);
      const styles = ['cover', 'guard', 'brace'];
      anim.setUpper(styles[npc.personality.flinch]);
      npc.lastReaction = st.type === 'explosion' ? 'Startle (Explosion)' : 'Flinch (' + st.type + ')';
      this.setState(npc, b, 'react'); b.reactDur = 0.45 + Math.random() * 0.4;
      Events.emit('reaction', { npc, reaction: npc.lastReaction });
    } else {
      npc.lastReaction = 'Look Toward Sound';
      if (b.state === 'idle') anim.setPosture('alert');
    }
  }
  decide(npc, b, afterHurt) {
    const S = Settings.data.ai, anim = npc.anim, p = npc.personality;
    const d = b.hasThreat ? npc.root.pos.distanceTo(b.threat) : 99;
    if (npc.fear > 0.55 && S.flee) {
      if (p.cover === 0 && d < 5 && !afterHurt) { this.setState(npc, b, 'cower'); b.cowerT = 2 + Math.random() * 3; npc.lastReaction = 'Cowering (Protective)'; }
      else { this.setState(npc, b, 'flee'); b.fleeT = 3 + Math.random() * 4; npc.lastReaction = 'Fleeing'; }
    } else if (npc.fear > 0.25) {
      this.setState(npc, b, 'idle'); b.idleTime = 2 + Math.random() * 2; anim.setUpper('hang'); npc.lastReaction = 'Alert';
    } else {
      this.setState(npc, b, 'idle'); b.idleTime = 1 + Math.random() * 3; anim.setUpper('hang');
      if (p.curiosity > 0.75 && b.hasThreat && d > 3) { b.dest.copy(b.threat).lerp(npc.root.pos, 0.5); this.game.env.clampToBounds(b.dest, 1); this.setState(npc, b, 'wander'); npc.lastReaction = 'Investigating'; }
    }
    Events.emit('reaction', { npc, reaction: npc.lastReaction });
  }
  pickWander(npc, b) {
    const env = this.game.env.current, bb = env.bounds;
    const r = Math.min(10, (bb.maxX - bb.minX) * 0.35);
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * TAU, d = 2 + Math.random() * r;
      b.dest.set(npc.root.pos.x + Math.sin(a) * d, 0, npc.root.pos.z + Math.cos(a) * d);
      if (b.dest.x > bb.minX + 1 && b.dest.x < bb.maxX - 1 && b.dest.z > bb.minZ + 1 && b.dest.z < bb.maxZ - 1) break;
    }
    this.game.env.clampToBounds(b.dest, 1.2);
  }
  nearestZombie(npc, r) {
    let best = null, bd = r;
    for (const o of this.game.npcs.list) {
      if (o.lifeState !== 'zombie' || o.physMode !== 'anim') continue;
      const d = o.root.pos.distanceTo(npc.root.pos);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  shove(target, from, strength) {
    const dir = _v1.subVectors(target.root.pos, from.root.pos).setY(0).normalize();
    target.brain.stagger.copy(dir).multiplyScalar(strength * 0.4);
    target.anim.kick(B.chest, _v2.set(-strength * 0.4, 0, 0));
  }
  // --- zombies ------------------------------------------------------------------------
  updateZombie(npc, b, dt) {
    const Z = Settings.data.zombies, game = this.game, anim = npc.anim;
    b.t += dt;
    anim.zombie = 1;
    if (npc.physMode !== 'anim') return;
    if (!Settings.data.ai.enabled) { b.speed = 0; return; }
    // vocalize
    b.groanT -= dt;
    if (b.groanT <= 0) { b.groanT = 3 + Math.random() * 6; if (Z.vocalize) Events.emit('zombieGroan', npc); anim.jawTarget = 0.3; setTimeout(() => { if (anim) anim.jawTarget = 0.08; }, 700); }
    anim.setPosture('zombie');
    // target selection
    let tgt = npc.zombieTarget;
    if (tgt && (tgt.lifeState !== 'alive' || tgt.removed || tgt.root.pos.distanceTo(npc.root.pos) > Z.detection * 1.3)) tgt = null;
    b.retarget = (b.retarget || 0) - dt;
    if ((!tgt || b.retarget <= 0) && Z.aggression && Z.targetNPCs) { tgt = this.selectTarget(npc, Z); b.retarget = 2.5; }
    if (!Z.aggression || !Z.targetNPCs) tgt = null;
    if (tgt !== npc.zombieTarget) { npc.zombieTarget = tgt; if (tgt) Events.emit('zombieTarget', { npc, target: tgt }); }
    const zspeed = 0.85 * Z.speed * npc.personality.zombieSpeed * (npc.anim.zstyle ? npc.anim.zstyle.speed : 1) * (npc.anim.crawl ? 0.38 : 1);
    if (tgt) {
      const d = tgt.root.pos.distanceTo(npc.root.pos);
      anim.lookAt(tgt.boneWPos[B.head], 1);
      if (d > 0.95) {
        b.state = 'zChase'; b.dest.copy(tgt.root.pos); b.speed = zspeed * (d < 3 ? 1.25 : 1);
        anim.setUpper('hang'); // style arms from the zombie gait (reach / claw / limp)
      } else {
        b.state = 'zAttack'; b.speed = 0; b.faceTarget = tgt.root.pos;
        b.attackT -= dt;
        if (b.attackT <= 0) {
          b.attackT = 1.1 + Math.random() * 0.6;
          anim.setUpper('claw'); anim.jawTarget = 0.35;
          setTimeout(() => { if (!npc.removed && npc.lifeState === 'zombie') { anim.setUpper('reach'); anim.jawTarget = 0.1; } }, 450);
          this.zombieAttack(npc, tgt);
        }
      }
    } else {
      // shamble around
      if (b.state !== 'zIdle' && b.state !== 'zInvestigate') { b.state = 'zIdle'; b.t = 0; this.pickWander(npc, b); }
      anim.setUpper('hang');
      b.speed = b.state === 'zInvestigate' ? zspeed : (b.t % 8 < 4 ? zspeed * 0.6 : 0);
      if (npc.root.pos.distanceTo(b.dest) < 0.7) { this.pickWander(npc, b); b.state = 'zIdle'; }
      anim.clearLook();
    }
  }
  selectTarget(npc, Z) {
    const cands = [];
    for (const o of this.game.npcs.list) {
      if (o.lifeState !== 'alive' || o === npc) continue;
      const d = o.root.pos.distanceTo(npc.root.pos);
      if (d <= Z.detection) cands.push({ o, d });
    }
    if (!cands.length) return null;
    if (Z.targetMode === 'random') return cands[Math.floor(Math.random() * cands.length)].o;
    if (Z.targetMode === 'weakest') { cands.sort((a, b) => a.o.health - b.o.health || a.d - b.d); return cands[0].o; }
    cands.sort((a, b) => a.d - b.d); return cands[0].o;
  }
  zombieAttack(z, tgt) {
    const Z = Settings.data.zombies;
    Events.emit('zombieAttack', { npc: z, target: tgt });
    const dir = _v1.subVectors(tgt.root.pos, z.root.pos).setY(0).normalize();
    const region = Math.random() < 0.4 ? (Math.random() < 0.5 ? REGION.L_FOREARM : REGION.R_FOREARM) : (Math.random() < 0.5 ? REGION.UPPER_CHEST : REGION.NECK);
    const res = tgt.applyHit({ region, damage: Z.attackDamage / REGION_DAMAGE_MUL[region], weapon: 'zombie', dir: dir.clone(), force: 5, threatPos: z.root.pos.clone() });
    this.game.hits.report(tgt, region, res, 'Zombie Attack', null);
    if (tgt.lifeState === 'alive') {
      this.onHit(tgt, { region, dir: dir.clone(), force: 5, threatPos: z.root.pos.clone() });
      if (tgt.health < 30 && Math.random() < 0.5) { tgt.goRagdoll('Knockdown (Zombie)'); tgt.rag.bodies[RAG.CHEST].vel.addScaledVector(dir, 2.5); }
    } else if (res.killed) {
      const imp = dir.clone().multiplyScalar(2.2);
      for (const bd of tgt.rag.bodies) bd.vel.add(imp);
      z.kills++;
    }
  }
  // --- steering -----------------------------------------------------------------------
  steer(npc, b, dt) {
    const game = this.game, root = npc.root;
    const desired = _v4.set(0, 0, 0);
    const isZ = npc.lifeState === 'zombie';
    if (b.speed > 0.01) {
      desired.subVectors(b.dest, root.pos); desired.y = 0;
      const d = desired.length();
      if (d > 0.05) desired.multiplyScalar(Math.min(b.speed, b.speed * d / 0.9) / d); else desired.set(0, 0, 0);
    }
    // separation
    const list = game.npcs.list;
    for (const o of list) {
      if (o === npc || o.removed) continue;
      const dx = root.pos.x - o.root.pos.x, dz = root.pos.z - o.root.pos.z;
      const d2 = dx * dx + dz * dz;
      const minD = (o.physMode === 'ragdoll' ? 0.55 : 0.62);
      if (d2 < minD * minD && d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (minD - d) / minD * 2.2;
        if (isZ && o === npc.zombieTarget) continue;
        desired.x += dx / d * push; desired.z += dz / d * push;
      }
    }
    // props
    for (const p of game.props.list) {
      const dx = root.pos.x - p.body.pos.x, dz = root.pos.z - p.body.pos.z;
      const r = p.radius + 0.35, d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-6) { const d = Math.sqrt(d2); desired.x += dx / d * (r - d) * 4; desired.z += dz / d * (r - d) * 4; }
    }
    // stagger impulse
    if (b.stagger.lengthSq() > 1e-4) {
      desired.addScaledVector(b.stagger, 3);
      b.stagger.multiplyScalar(Math.max(0, 1 - dt * 5));
    }
    const accel = b.speed > 2.5 ? 9 : 5;
    b.vel.x = damp(b.vel.x, desired.x, accel, dt); b.vel.z = damp(b.vel.z, desired.z, accel, dt);
    root.pos.x += b.vel.x * dt; root.pos.z += b.vel.z * dt;
    game.env.clampToBounds(root.pos, 0.35);
    root.pos.y = game.env.groundHeight(root.pos.x, root.pos.z);
    // facing
    const sp = Math.hypot(b.vel.x, b.vel.z);
    let targetYaw = null;
    if (b.faceTarget && b.speed < 0.05) { targetYaw = Math.atan2(b.faceTarget.x - root.pos.x, b.faceTarget.z - root.pos.z); }
    else if (sp > 0.25 && b.speed > 0.01) targetYaw = Math.atan2(b.vel.x, b.vel.z);
    else if (b.state === 'handsUp') targetYaw = Math.atan2(game.camera.position.x - root.pos.x, game.camera.position.z - root.pos.z);
    if (targetYaw !== null) {
      const maxTurn = (b.speed > 2.5 ? 6 : 3.2) * dt * (isZ ? 0.6 : 1);
      root.yaw += clamp(wrapAngle(targetYaw - root.yaw), -maxTurn, maxTurn);
    }
    if (b.speed < 0.05) b.faceTarget = b.state === 'zAttack' || b.state === 'fight' ? b.faceTarget : null;
  }
}
HT.AISystem = AISystem;
