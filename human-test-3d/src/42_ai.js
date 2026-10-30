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
  detach(npc) {
    if (npc.brain) { this.endGrab(npc); this.endFeed(npc); npc.brain.npc = null; }
    for (const n of this.game.npcs.list) {
      if (n.zombieTarget === npc) n.zombieTarget = null;
      if (n.brain && n.brain.victim === npc) this.endGrab(n);
      if (n.brain && n.brain.corpse === npc) this.endFeed(n);
    }
    if (npc.grabbedBy && npc.grabbedBy.brain) this.endGrab(npc.grabbedBy);
  }
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
    if (npc.infection && Settings.data.zombies.infection) this.updateInfection(npc, b, dt);
    if (npc.lifeState !== 'alive') return;
    // held by a zombie: struggle (the zombie drives the grapple)
    if (npc.grabbedBy) {
      b.state = 'grabbed'; b.speed = 0; b.pending.length = 0; npc.fear = 1;
      b.screamT = (b.screamT || 0) - dt;
      if (b.screamT <= 0) { b.screamT = 1.1 + Math.random() * 0.9; this.game.audio.play('scream' + Math.floor(Math.random() * 3), { pos: npc.boneWPos[B.head].clone(), gain: 0.9 }); }
      return;
    }
    if (b.state === 'grabbed') { this.setState(npc, b, 'flee'); b.fleeT = 5; }
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
      // noticing a zombie takes a moment (turn, register, react)
      if (z && b.zSeen !== z) { b.zSeen = z; b.zSeenAt = game.time + 0.3 + npc.personality.reaction * 1.4; }
      if (!z) b.zSeen = null;
      if (z && game.time < b.zSeenAt) anim.lookAt(z.boneWPos[B.head], 1);
      else if (z && b.state !== 'flee' && b.state !== 'fight') {
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
  // zombies are noticed when close, or when in front of the subject (they can be ambushed from behind)
  nearestZombie(npc, r) {
    let best = null, bd = r;
    const fx = Math.sin(npc.root.yaw), fz = Math.cos(npc.root.yaw);
    for (const o of this.game.npcs.list) {
      if (o.lifeState !== 'zombie' || (o.physMode !== 'anim' && !o.anim.crawl)) continue;
      const dx = o.root.pos.x - npc.root.pos.x, dz = o.root.pos.z - npc.root.pos.z;
      const d = Math.hypot(dx, dz);
      if (d >= bd) continue;
      const inView = (dx * fx + dz * fz) / Math.max(d, 1e-3) > -0.25;
      if (d < 1.2 || inView || npc.fear > 0.6) { bd = d; best = o; }
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
    if (npc.physMode !== 'anim') { if (b.victim) this.endGrab(npc); if (b.corpse) this.endFeed(npc); return; }
    if (!Settings.data.ai.enabled) { b.speed = 0; return; }
    b.grabCooldown = Math.max(0, (b.grabCooldown || 0) - dt);
    // vocalize
    b.groanT -= dt;
    if (b.groanT <= 0) { b.groanT = 3 + Math.random() * 6; if (Z.vocalize) Events.emit('zombieGroan', npc); anim.jawTarget = 0.3; setTimeout(() => { if (anim) anim.jawTarget = 0.08; }, 700); }
    anim.setPosture('zombie');
    const zst = anim.zstyle || {};
    const zspeed = 0.85 * Z.speed * npc.personality.zombieSpeed * (zst.speed || 1) * (anim.crawl ? 0.38 : 1);
    b.zspeed = zspeed;
    // style quirks: weaving, tripping, spasms
    b.destOff = b.destOff || new V3();
    if (zst.wobble) { const a = b.t * 1.05 + npc.id; b.destOff.set(Math.cos(npc.root.yaw), 0, -Math.sin(npc.root.yaw)).multiplyScalar(Math.sin(a) * zst.wobble + Math.sin(a * 2.3) * 0.4); } else b.destOff.set(0, 0, 0);
    if (zst.stumble && anim.speed > 0.45 && !anim.crawl && b.state !== 'zGrab' && b.state !== 'zFeed' && Math.random() < zst.stumble * dt) {
      npc.goRagdoll('Stumbled', false);
      const fw = _v1.set(Math.sin(npc.root.yaw), 0.2, Math.cos(npc.root.yaw)).multiplyScalar(2.2);
      for (const bd of npc.rag.bodies) if (!npc.rag.detached[bd.index]) bd.vel.add(fw);
      npc.downTimer = 0.8 + Math.random() * 0.8;
      return;
    }
    if (zst.twitch) {
      b.twitchT = (b.twitchT || 0) - dt;
      if (b.twitchT <= 0) {
        b.twitchT = 0.12 + Math.random() * 0.75;
        const bones = [B.head, B.neck, B.chest, B.upperarm_L, B.upperarm_R, B.spine];
        anim.kick(bones[Math.floor(Math.random() * bones.length)], _v1.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10));
        if (Math.random() < 0.25) b.burstT = 0.35 + Math.random() * 0.4;
      }
    }
    b.burstT = Math.max(0, (b.burstT || 0) - dt);
    b.attackCD = Math.max(0, (b.attackCD || 0) - dt);
    if (!anim.zvar) anim.zvar = makeZombieVariation();
    const zv = anim.zvar;
    anim.reachTarget = 0;
    // occasional balance corrections while walking (not for sprinting / weaving / crawling styles)
    if (!anim.crawl && !zst.wobble && !zst.chase && anim.speed > 0.4 && anim.speed < 2 && !anim.action && b.state !== 'zGrab' && b.state !== 'zFeed') {
      b.balT = (b.balT == null ? zv.balanceT : b.balT) - dt;
      if (b.balT <= 0) {
        b.balT = zv.balanceT * (0.7 + Math.random() * 0.8) / (1 + (zst.lurch || 0) * 6);
        const dir = Math.random() < 0.5 ? 1 : -1;
        anim.setAction('balance', { dur: 0.75 + Math.random() * 0.2, dir, inT: 0.12, outT: 0.3 });
        b.stagger.add(_v1.set(Math.cos(npc.root.yaw), 0, -Math.sin(npc.root.yaw)).multiplyScalar(dir * 0.9 * zv.intensity));
      }
    }
    if (b.state === 'zGrab') { this.zombieGrab(npc, b, dt, Z); return; }
    if (b.state === 'zScratch') { this.zombieScratch(npc, b, dt, Z); return; }
    if (b.state === 'zRecover') {
      b.speed = 0; b.recT -= dt;
      if (b.recT <= 0) { b.state = npc.zombieTarget && npc.zombieTarget.lifeState === 'alive' ? 'zChase' : 'zIdle'; b.t = 0; }
      return;
    }
    if (b.state === 'zFeed' && this.zombieFeed(npc, b, dt, Z)) return;
    // target selection
    let tgt = npc.zombieTarget;
    if (tgt && (tgt.lifeState !== 'alive' || tgt.removed || tgt.root.pos.distanceTo(npc.root.pos) > Z.detection * 1.3)) tgt = null;
    b.retarget = (b.retarget || 0) - dt;
    if ((!tgt || b.retarget <= 0) && Z.aggression && Z.targetNPCs) { tgt = this.selectTarget(npc, Z); b.retarget = 2.5; }
    if (!Z.aggression || !Z.targetNPCs) tgt = null;
    if (tgt !== npc.zombieTarget) {
      const was = npc.zombieTarget; npc.zombieTarget = tgt; b.plan = null;
      if (tgt) {
        Events.emit('zombieTarget', { npc, target: tgt });
        // noticing new prey: stop, head snaps round, a growl, then go
        if (!was && (b.state === 'zIdle' || b.state === 'zInvestigate' || b.state === 'zChase') && !anim.crawl) {
          b.state = 'zNotice'; b.noticeT = (0.35 + Math.random() * 0.55) / zv.headRate; b.t = 0;
          anim.setAction('notice', { dur: b.noticeT + 0.15, inT: 0.1, outT: 0.3 });
          anim.kick(B.head, _v1.set(-2, (Math.random() - 0.5) * 6, 0));
          if (Z.vocalize) this.game.audio.play('growl', { pos: npc.boneWPos[B.head].clone(), gain: 0.7 });
        }
      }
    }
    if (b.state === 'zNotice') {
      b.speed = 0; b.noticeT -= dt;
      if (tgt) { b.faceTarget = tgt.root.pos; anim.lookAt(tgt.boneWPos[B.head], 1); }
      if (b.noticeT <= 0 || !tgt) { b.state = tgt ? 'zChase' : 'zIdle'; b.t = 0; }
      return;
    }
    if (tgt) {
      const d = tgt.root.pos.distanceTo(npc.root.pos);
      anim.lookAt(tgt.boneWPos[B.head], 1);
      anim.setUpper('hang'); // style arms from the zombie gait (reach / claw / limp)
      // arms come up as the zombie closes in
      if (!anim.crawl) anim.reachTarget = smoothstep(2.8, 1.1, d) * (zst.arms === 'flail' ? 0.4 : 1);
      // a living victim on the ground gets eaten where it lies
      if (tgt.physMode === 'ragdoll' && Z.feeding && !anim.crawl && (tgt.feeders || 0) < 2) { this.startFeed(npc, b, tgt); return; }
      if (anim.crawl) {
        if (d > 0.7) { b.state = 'zChase'; b.dest.copy(tgt.root.pos); b.speed = zspeed; }
        else {
          b.state = 'zAttack'; b.speed = 0; b.faceTarget = tgt.root.pos;
          b.attackT -= dt;
          if (b.attackT <= 0) { b.attackT = 1.2 + Math.random() * 0.8; anim.crawlAttack = 0.55; this.zombieAttack(npc, tgt); }
        }
        return;
      }
      // pick how to attack once in range: grab-and-bite or a swipe (re-planned after every attack)
      const grabbable = tgt.physMode === 'anim' && !tgt.grabbedBy && b.grabCooldown <= 0;
      if (!b.plan && d < 1.8) {
        const weak = tgt.brain && (tgt.brain.state === 'hurt' || tgt.health < 50);
        b.plan = grabbable && Math.random() < (weak ? 0.75 : 0.42) ? 'grab' : 'scratch';
      }
      if (b.plan === 'grab' && !grabbable) b.plan = 'scratch';
      const range = b.plan === 'grab' ? 0.78 : 0.98;
      if (d > range || b.attackCD > 0) {
        b.state = 'zChase'; b.dest.copy(tgt.root.pos);
        // lunge at close range; runners sprint, twitchers lurch in bursts
        // lunge into a grab; a swipe needs room, so the last steps slow down instead
        b.speed = d < 1.7 ? (b.plan === 'scratch' ? Math.max(zspeed, 0.9) * (d < 1.25 ? 0.75 : 1) : Math.max(zspeed * 1.5, 2.3))
          : zspeed * (d < 3 ? 1.25 : 1) * (zst.chase || 1) * (b.burstT > 0 ? 2.2 : 1) * zv.cadence;
        if (b.attackCD > 0 && d < 0.85) b.speed = 0;
      } else if (b.plan === 'grab') this.startGrab(npc, b, tgt);
      else this.startScratch(npc, b, tgt);
    } else {
      // nothing alive nearby: find a body to eat, else shamble around looking about
      if (Z.feeding && !anim.crawl) { const c = this.findCorpse(npc, 14); if (c) { this.startFeed(npc, b, c); return; } }
      if (b.state !== 'zIdle' && b.state !== 'zInvestigate') { b.state = 'zIdle'; b.t = 0; this.pickWander(npc, b); }
      anim.setUpper('hang');
      b.speed = b.state === 'zInvestigate' ? zspeed : (b.t % 8 < 4 ? zspeed * 0.6 * zv.cadence : 0);
      if (npc.root.pos.distanceTo(b.dest) < 0.7) { this.pickWander(npc, b); b.state = 'zIdle'; }
      b.lookT = (b.lookT || 0) - dt;
      if (b.lookT <= 0) {
        b.lookT = (1.2 + Math.random() * 2.6) / zv.headRate;
        const a = npc.root.yaw + (Math.random() - 0.5) * 2.6;
        b.lookPos = b.lookPos || new V3();
        b.lookPos.set(npc.root.pos.x + Math.sin(a) * 4, npc.rig.eyeY + (Math.random() - 0.6) * 1.2, npc.root.pos.z + Math.cos(a) * 4);
        anim.kick(B.head, _v1.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 3));
      }
      if (b.lookPos && b.speed < 0.3) anim.lookAt(b.lookPos, 0.7); else anim.clearLook();
    }
  }
  // --- scratches: keyframed swipes with contact detection at the hit frame ----------------
  startScratch(z, b, v) {
    const anim = z.anim, zst = anim.zstyle || {};
    let clip = SCRATCH_NAMES[Math.floor(Math.random() * SCRATCH_NAMES.length)];
    if (zst.arms === 'claw' && Math.random() < 0.4) clip = 'double';
    const side = Math.random() < 0.5 ? 0 : 1;
    const C = SCRATCH_CLIPS[clip];
    const dur = C.dur * (0.85 + Math.random() * 0.3) / ((anim.zvar && anim.zvar.cadence) || 1);
    anim.setAction('scratch', { clip, side, dur, target: v, hitDone: false, inT: 0.1, outT: 0.25 });
    b.state = 'zScratch'; b.victim2 = v; b.t = 0; b.speed = 0; b.plan = null;
    z.lastReaction = 'Attacking (Scratch)';
    if (Math.random() < 0.6 && Settings.data.zombies.vocalize) this.game.audio.play('growl', { pos: z.boneWPos[B.head].clone(), gain: 0.6 });
  }
  zombieScratch(z, b, dt, Z) {
    const v = b.victim2, a = z.anim.action;
    if (!a || a.type !== 'scratch' || a.ending) { this.endScratch(z, b, false); return; }
    if (!v || v.removed || v.lifeState !== 'alive') { this.endScratch(z, b, false); return; }
    const d = v.root.pos.distanceTo(z.root.pos);
    const C = SCRATCH_CLIPS[a.clip];
    const u = a.t / a.dur;
    // keep a striking distance while facing the target: step in during the wind-up only, never crowd after contact
    b.faceTarget = v.root.pos;
    if (d > 0.95 && u < C.hit * 0.8) { b.dest.copy(v.root.pos); b.speed = 0.7; }
    else if (d < 0.66) { b.dest.copy(z.root.pos).addScaledVector(_v1.subVectors(z.root.pos, v.root.pos).setY(0).normalize(), 0.5); b.speed = 0.6; }
    else b.speed = 0;
    z.root.yaw = angleDamp(z.root.yaw, Math.atan2(v.root.pos.x - z.root.pos.x, v.root.pos.z - z.root.pos.z), u < C.hit ? 6 : 2, dt);
    // contact is swept over a short window around the strike: it lands where the claw actually touches
    if (!a.hitDone && u >= C.hit - 0.1) {
      const last = u >= C.hit + 0.16;
      if (this.scratchContact(z, v, a, last) || last) a.hitDone = true;
    }
    if (u >= 1) this.endScratch(z, b, true);
  }
  endScratch(z, b, finished) {
    if (z.anim.action && z.anim.action.type === 'scratch') z.anim.setAction(null);
    const v = b.victim2; b.victim2 = null;
    // chain another swipe now and then, otherwise a short recovery
    if (finished && v && !v.removed && v.lifeState === 'alive' && v.physMode === 'anim' && v.root.pos.distanceTo(z.root.pos) < 1.0 && Math.random() < 0.35) { this.startScratch(z, b, v); return; }
    b.state = 'zRecover'; b.recT = 0.3 + Math.random() * 0.45; b.attackCD = 0.25 + Math.random() * 0.5;
    z.anim.setAction('recover', { dur: b.recT + 0.2, inT: 0.15, outT: 0.3 });
  }
  // the swing connects only if the claw actually reaches the body; effects start at the contact point
  scratchContact(z, v, a, last) {
    const g = this.game, Z = Settings.data.zombies;
    const C = SCRATCH_CLIPS[a.clip] || SCRATCH_CLIPS.jab;
    let vi = -1, bd = 0.16, hs = a.side;
    for (let k = 0; k < (C.both ? 2 : 1); k++) {
      const s = k === 0 ? a.side : 1 - a.side, hand = z.boneWPos[SB('fingers1', s)];
      // cheap reject before the per-vertex search
      if (hand.distanceTo(v.boneWPos[B.chest]) > 0.8 && hand.distanceTo(v.boneWPos[B.head]) > 0.5 && hand.distanceTo(v.boneWPos[B.hips]) > 0.6) continue;
      const i = g.gore.nearestVertex(v, hand, null);
      if (i < 0) continue;
      const S = v.skinnedPositions();
      const dd = Math.hypot(S[i * 3] - hand.x, S[i * 3 + 1] - hand.y, S[i * 3 + 2] - hand.z);
      if (dd < bd) { bd = dd; vi = i; hs = s; }
    }
    if (vi < 0) { if (last) g.audio.play('swing', { pos: z.boneWPos[SB('hand', a.side)].clone(), gain: 0.5 }); return false; }
    const S = v.skinnedPositions();
    const p = new V3(S[vi * 3], S[vi * 3 + 1], S[vi * 3 + 2]);
    const region = v.mesh.geometry.attributes.aRegion.array[vi] | 0;
    const toV = _v2.subVectors(v.root.pos, z.root.pos).setY(0).normalize();
    const side = _v3.set(Math.cos(z.root.yaw), 0, -Math.sin(z.root.yaw)).multiplyScalar(SIDE_SIGN[hs] * (a.clip === 'backhand' ? -0.5 : (a.clip === 'overhead' ? -0.3 : 0)));
    const dir = toV.clone().add(side).normalize();
    // a raised guard takes the swipe on the forearms
    const up = v.anim.upper && v.anim.upper.cur;
    const blocked = (up === 'guard' || up === 'push' || up === 'cover') && (region === REGION.L_FOREARM || region === REGION.R_FOREARM || region === REGION.L_HAND || region === REGION.R_HAND);
    const res = v.applyHit({ region, damage: Z.attackDamage * (0.8 + Math.random() * 0.4) * (blocked ? 0.45 : 1) / REGION_DAMAGE_MUL[region], weapon: 'zombie', dir: dir.clone(), point: p.clone(), force: 5, threatPos: z.root.pos.clone() });
    g.gore.onClaw(v, z, vi, p, dir);
    g.hits.report(v, region, res, 'Zombie Scratch', p);
    if (Z.infection && !v.infection && Math.random() < 0.5) v.infection = { t: 0, dur: Z.infectionTime * (0.8 + Math.random() * 0.4), src: z.idStr };
    if (v.lifeState === 'alive') {
      // the reaction depends on where the claw lands and what the victim was doing
      const running = v.anim.speed > 2.2;
      this.onHit(v, { region, dir: dir.clone(), force: blocked ? 2.5 : (running ? 5.5 : 4.2), threatPos: z.root.pos.clone() });
      if (blocked) v.lastReaction = 'Blocked Swipe';
      if ((v.health < 22 && Math.random() < 0.5) || (running && Math.random() < 0.3)) {
        v.goRagdoll(running ? 'Tripped (Zombie Swipe)' : 'Knockdown (Zombie)');
        v.rag.bodies[RAG.CHEST].vel.addScaledVector(dir, running ? 1.6 : 2.4);
      }
    } else if (res.killed) z.kills++;
    return true;
  }
  selectTarget(npc, Z) {
    const cands = [];
    for (const o of this.game.npcs.list) {
      if (o.lifeState !== 'alive' || o === npc) continue;
      const d = o.root.pos.distanceTo(npc.root.pos);
      if (d <= Z.detection) cands.push({ o, d: d + (o.grabbedBy && o.grabbedBy !== npc ? 2.5 : 0) });
    }
    if (!cands.length) return null;
    if (Z.targetMode === 'random') return cands[Math.floor(Math.random() * cands.length)].o;
    if (Z.targetMode === 'weakest') { cands.sort((a, b) => a.o.health - b.o.health || a.d - b.d); return cands[0].o; }
    cands.sort((a, b) => a.d - b.d); return cands[0].o;
  }
  findCorpse(npc, r) {
    let best = null, bd = r;
    for (const o of this.game.npcs.list) {
      if (o === npc || o.removed || o.lifeState !== 'dead' || o.physMode !== 'ragdoll' || (o.feeders || 0) >= 2) continue;
      const d = o.root.pos.distanceTo(npc.root.pos);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  // --- grapple & bite ---------------------------------------------------------------------
  startGrab(z, b, v) {
    b.state = 'zGrab'; b.t = 0; b.victim = v; b.bites = 0; b.grabDur = 2.2 + Math.random() * 2.2; b.plan = null;
    v.grabbedBy = z;
    z.rag.noCollideWith = v.rag; v.rag.noCollideWith = z.rag;
    if (v.brain) { v.brain.state = 'grabbed'; v.brain.t = 0; v.brain.screamT = 0; }
    // a raised forearm gets bitten; otherwise neck or shoulder
    const guarding = v.anim.upper && (v.anim.upper.cur === 'guard' || v.anim.upper.cur === 'cover' || v.anim.upper.cur === 'push');
    const variant = guarding && Math.random() < 0.7 ? 'arm' : (Math.random() < 0.55 ? 'neck' : 'shoulder');
    b.biteVariant = variant;
    z.anim.setUpper('hang'); z.anim.setAction('bite', { target: v, variant, inT: 0.25, outT: 0.35 });
    v.anim.setAction('struggle', { target: z, away: Math.random() < 0.5 ? 1 : -1, forceMode: variant === 'arm' ? 'block' : null });
    v.anim.setUpper('hang'); v.fear = 1; v.lastReaction = 'Grabbed by Zombie';
    z.lastReaction = 'Biting';
    Events.emit('zombieAttack', { npc: z, target: v });
    HT.log('zombie', `${z.idStr} grabbed ${v.idStr} ${v.name}`);
  }
  zombieGrab(z, b, dt, Z) {
    const v = b.victim;
    if (!v || v.removed || v.lifeState !== 'alive' || v.physMode !== 'anim') {
      const meal = v && !v.removed && (v.lifeState === 'dead' || (v.lifeState === 'alive' && v.physMode === 'ragdoll')) ? v : null;
      this.endGrab(z);
      if (meal && Z.feeding) this.startFeed(z, b, meal);
      return;
    }
    b.speed = 0; b.faceTarget = null;
    // hold both at biting distance, facing each other
    const dir = _v1.subVectors(v.root.pos, z.root.pos); dir.y = 0;
    let d = dir.length(); if (d < 1e-4) { dir.set(0, 0, 1); d = 1e-4; } else dir.multiplyScalar(1 / d);
    const want = 0.41 * (z.rig.H + v.rig.H) / 3.5;
    const corr = (d - want) * Math.min(1, dt * 7) * 0.5;
    z.root.pos.addScaledVector(dir, corr); v.root.pos.addScaledVector(dir, -corr);
    z.brain.vel.multiplyScalar(0.8); if (v.brain) v.brain.vel.multiplyScalar(0.8);
    z.root.yaw = angleDamp(z.root.yaw, Math.atan2(dir.x, dir.z), 9, dt);
    v.root.yaw = angleDamp(v.root.yaw, Math.atan2(-dir.x, -dir.z), 6, dt);
    z.anim.clearLook();
    // the victim tries to pull away: the pair drifts while it twists free
    const sa = v.anim.action;
    if (sa && sa.type === 'struggle' && sa.mode === 'pull') { z.root.pos.addScaledVector(dir, 0.12 * dt); v.root.pos.addScaledVector(dir, 0.12 * dt); }
    // bites land on the animation's snap frame
    const act = z.anim.action;
    if (act && act.type === 'bite' && act.snapEvent) { act.snapEvent = false; b.bites++; this.bite(z, v, b.bites); }
    if (b.t > b.grabDur && v.lifeState === 'alive') {
      const chance = 0.25 + v.personality.bravery * 0.4 + clamp(v.health / 100, 0, 1) * 0.25;
      if (Math.random() < chance) this.breakFree(z, v); else b.grabDur += 1.3;
    }
  }
  bite(z, v, n) {
    const Z = Settings.data.zombies, variant = z.brain && z.brain.biteVariant;
    const region = variant === 'arm' ? REGION.R_FOREARM : variant === 'shoulder' ? (Math.random() < 0.6 ? REGION.UPPER_CHEST : REGION.R_UPPER_ARM) : (n === 1 || Math.random() < 0.7 ? REGION.NECK : REGION.UPPER_CHEST);
    const dir = _v2.subVectors(v.root.pos, z.root.pos).setY(0).normalize().clone();
    const res = v.applyHit({ region, damage: Z.biteDamage / REGION_DAMAGE_MUL[region], weapon: 'bite', dir, force: 2, threatPos: z.root.pos.clone() });
    this.game.gore.onBite(v, z, [region]);
    this.game.hits.report(v, region, res, 'Zombie Bite', null);
    if (Z.infection && !v.infection) v.infection = { t: 0, dur: Z.infectionTime * (0.8 + Math.random() * 0.4), src: z.idStr };
    v.anim.kick(B.neck, _v3.set(0.6, (Math.random() - 0.5) * 2, 0));
    v.anim.kick(B.chest, _v3.set(-0.8, 0, 0));
    if (res.killed) { z.kills++; HT.log('death', `${v.idStr} ${v.name} was killed by ${z.idStr}`); }
    else if (v.lifeState === 'alive' && v.health < 32 && n > 1 && Math.random() < 0.45) {
      // weakened victim is dragged to the ground (the zombie keeps eating where it falls)
      v.goRagdoll('Pulled Down (Zombie)');
      const side = _v3.set(Math.cos(z.root.yaw), 0, -Math.sin(z.root.yaw)).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
      v.rag.bodies[RAG.CHEST].vel.addScaledVector(dir, 0.6).addScaledVector(side, 0.9).y -= 1.2;
      v.rag.bodies[RAG.PELVIS].vel.addScaledVector(dir, -0.5);
      v.downTimer = Math.max(v.downTimer, 3);
      v.lastReaction = 'Pulled Down (Zombie)';
    }
  }
  breakFree(z, v) {
    this.endGrab(z);
    const dir = _v1.subVectors(z.root.pos, v.root.pos).setY(0).normalize();
    z.brain.stagger.copy(dir).multiplyScalar(1.7);
    z.anim.kick(B.chest, _v2.set(-3, 0, 0));
    z.brain.grabCooldown = 2.5;
    const vb = v.brain;
    if (vb) { vb.state = 'flee'; vb.t = 0; vb.fleeT = 6; vb.threat.copy(z.root.pos); vb.threatNpc = z; vb.hasThreat = true; }
    v.anim.setUpper('clutch', REGION.NECK);
    v.lastReaction = v.infection ? 'Broke Free (Bitten - Infected)' : 'Broke Free';
    HT.log('zombie', `${v.idStr} ${v.name} broke free from ${z.idStr}${v.infection ? ' - infected' : ''}`);
  }
  endGrab(z) {
    const b = z.brain; if (!b) return;
    const v = b.victim;
    if (v && z.physMode === 'anim' && z.lifeState === 'zombie') { // let go: stumble back, shake the head, chew
      b.recT = 0.6 + Math.random() * 0.5;
      z.anim.setAction('recover', { dur: b.recT + 0.2, inT: 0.2, outT: 0.35 });
      b.stagger.add(_v1.subVectors(z.root.pos, v.root.pos).setY(0).normalize().multiplyScalar(0.8));
    }
    if (v) {
      if (v.grabbedBy === z) v.grabbedBy = null;
      if (v.anim.action && v.anim.action.type === 'struggle') v.anim.setAction(null);
      if (v.brain && v.brain.state === 'grabbed' && v.lifeState === 'alive') { v.brain.state = 'flee'; v.brain.t = 0; v.brain.fleeT = 5; }
    }
    b.victim = null;
    if (z.anim.action && z.anim.action.type === 'bite') z.anim.setAction(null);
    if (b.state === 'zGrab') { b.state = b.recT > 0 ? 'zRecover' : 'zIdle'; }
    b.grabCooldown = Math.max(b.grabCooldown || 0, 1.2);
  }
  // --- feeding --------------------------------------------------------------------------------
  startFeed(z, b, c) {
    if (b.corpse === c && b.state === 'zFeed') return;
    this.endFeed(z);
    b.state = 'zFeed'; b.t = 0; b.corpse = c; b.feedT = 0; b.biteT = 1.3; b.eating = false;
    c.feeders = (c.feeders || 0) + 1;
    z.rag.noCollideWith = c.rag;
    z.lastReaction = 'Feeding';
  }
  zombieFeed(z, b, dt, Z) {
    const c = b.corpse;
    const edible = c && !c.removed && c.physMode === 'ragdoll' && (c.lifeState === 'dead' || c.lifeState === 'alive');
    if (!edible || !Z.feeding) { this.endFeed(z); return false; }
    // fresh living prey nearby interrupts a meal on a dead body
    if (c.lifeState === 'dead' && b.t > 1.5 && Z.aggression && Z.targetNPCs) {
      const live = this.selectTarget(z, { detection: 4.5, targetMode: 'nearest' });
      if (live && live.physMode === 'anim' && !live.grabbedBy) { this.endFeed(z); z.zombieTarget = live; return false; }
    }
    const tb = c.rag.bodies[c.gore && c.gore.headGone ? RAG.CHEST : RAG.SPINE].pos;
    const side = _v1.subVectors(z.root.pos, tb); side.y = 0;
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    const spot = _v2.copy(tb).addScaledVector(side, 0.62); spot.y = 0;
    const d = Math.hypot(z.root.pos.x - spot.x, z.root.pos.z - spot.z);
    if (!b.eating && d > 0.3) {
      b.dest.copy(spot); b.speed = (b.zspeed || 0.8) * 0.9; b.faceTarget = null;
      z.anim.lookAt(tb, 0.8); z.anim.setUpper('hang');
      if (b.t > 12) this.endFeed(z);
      return true;
    }
    b.eating = true; b.speed = 0; b.faceTarget = tb.clone();
    if (!z.anim.action || z.anim.action.type !== 'feed' || z.anim.action.ending) z.anim.setAction('feed', { target: c, point: new V3(), hand: Math.random() < 0.5 ? 0 : 1, outT: 0.9 });
    const fa = z.anim.action;
    fa.point.copy(tb); fa.point.y += 0.04;
    if (fa.mode === 'chew') { b.lookT = (b.lookT || 0) - dt; if (b.lookT <= 0) { b.lookT = 0.8 + Math.random() * 1.2; b.lookPos = (b.lookPos || new V3()).set(z.root.pos.x + (Math.random() - 0.5) * 6, z.rig.eyeY * 0.6, z.root.pos.z + (Math.random() - 0.5) * 6); } z.anim.lookAt(b.lookPos, 0.7); }
    else z.anim.lookAt(tb, 0.6);
    b.feedT += dt;
    this.game.gore.onFeed(c, z, dt, false);
    if (fa.biteEvent) {
      fa.biteEvent = false;
      this.game.gore.onFeed(c, z, dt, true);
      if (c.lifeState === 'alive') {
        const res = c.applyHit({ region: REGION.ABDOMEN, damage: Z.biteDamage * 0.8 / REGION_DAMAGE_MUL[REGION.ABDOMEN], weapon: 'bite', force: 1 });
        if (Z.infection && !c.infection) c.infection = { t: 0, dur: Z.infectionTime, src: z.idStr };
        this.game.audio.play('scream' + Math.floor(Math.random() * 3), { pos: c.boneWPos[B.head].clone(), gain: 1 });
        c.downTimer = Math.max(c.downTimer, 2.5);
        if (res.killed) z.kills++;
      }
    }
    if (b.feedT > 32) { this.endFeed(z); b.grabCooldown = 3; }
    return true;
  }
  endFeed(z) {
    const b = z.brain; if (!b) return;
    if (b.corpse) b.corpse.feeders = Math.max(0, (b.corpse.feeders || 1) - 1);
    b.corpse = null; b.eating = false; b.faceTarget = null;
    if (z.anim.action && z.anim.action.type === 'feed') z.anim.setAction(null);
    if (b.state === 'zFeed') { b.state = 'zIdle'; b.t = 0; }
  }
  // --- infection: bitten humans sicken, collapse and turn --------------------------------------
  updateInfection(npc, b, dt) {
    const inf = npc.infection;
    inf.t += dt;
    const k = inf.t / inf.dur;
    const u = npc.material.userData.u;
    u.uZombie.value = Math.max(u.uZombie.value, smoothstep(0.1, 1.0, k) * 0.5);
    if (k > 0.45) {
      for (let s = 0; s < 2; s++) npc.anim.limp[s] = Math.max(npc.anim.limp[s], (k - 0.45) * 0.9);
      npc.anim.setPosture('wounded', 0.6);
      inf.coughT = (inf.coughT || 0) - dt;
      if (inf.coughT <= 0) { inf.coughT = 2 + Math.random() * 3; this.game.audio.play(Math.random() < 0.5 ? 'gurgle' : 'pain0', { pos: npc.boneWPos[B.head].clone(), gain: 0.7 }); npc.anim.kick(B.chest, _v1.set(1.2, 0, 0)); }
    }
    if (k >= 1 && npc.lifeState === 'alive') {
      npc.lastReaction = 'Turning (Infection)';
      HT.log('zombie', `${npc.idStr} ${npc.name} succumbed to the infection`);
      if (npc.grabbedBy && npc.grabbedBy.brain) this.endGrab(npc.grabbedBy);
      npc.die({ weapon: 'infection' });
    }
  }
  zombieAttack(z, tgt) {
    const Z = Settings.data.zombies;
    Events.emit('zombieAttack', { npc: z, target: tgt });
    const dir = _v1.subVectors(tgt.root.pos, z.root.pos).setY(0).normalize();
    const crawl = z.anim.crawl;
    const region = crawl ? (Math.random() < 0.5 ? REGION.L_LOWER_LEG : REGION.R_LOWER_LEG) : (Math.random() < 0.4 ? (Math.random() < 0.5 ? REGION.L_FOREARM : REGION.R_FOREARM) : (Math.random() < 0.5 ? REGION.UPPER_CHEST : REGION.NECK));
    const res = tgt.applyHit({ region, damage: Z.attackDamage / REGION_DAMAGE_MUL[region], weapon: 'zombie', dir: dir.clone(), force: 5, threatPos: z.root.pos.clone() });
    this.game.hits.report(tgt, region, res, crawl ? 'Zombie Bite (Leg)' : 'Zombie Attack', null);
    if (crawl || Math.random() < 0.5) { this.game.gore.onBite(tgt, z, [region]); if (Z.infection && !tgt.infection) tgt.infection = { t: 0, dur: Z.infectionTime * (0.8 + Math.random() * 0.4), src: z.idStr }; }
    if (tgt.lifeState === 'alive') {
      this.onHit(tgt, { region, dir: dir.clone(), force: 5, threatPos: z.root.pos.clone() });
      if ((tgt.health < 30 || crawl) && Math.random() < 0.45) { tgt.goRagdoll('Knockdown (Zombie)'); tgt.rag.bodies[RAG.CHEST].vel.addScaledVector(dir, crawl ? -1.5 : 2.5); }
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
    let wantYaw = null;
    if (b.speed > 0.01) {
      let spd = npc.anim.crawl ? Math.min(b.speed, 0.38) : b.speed;
      desired.subVectors(b.dest, root.pos); desired.y = 0;
      if (b.destOff && desired.lengthSq() > 1) desired.add(b.destOff);
      const d = desired.length();
      if (d > 0.05) {
        // people slow down to change direction sharply instead of side-stepping
        wantYaw = Math.atan2(desired.x, desired.z);
        const off = Math.abs(wrapAngle(wantYaw - root.yaw));
        spd = Math.min(spd, spd * d / 0.9) * clamp(1.2 - off / 1.7, 0.12, 1);
        desired.multiplyScalar(spd / d);
      } else desired.set(0, 0, 0);
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
        if (isZ && (o === npc.zombieTarget || o === b.victim || o === b.corpse)) continue;
        if (o === npc.grabbedBy) continue;
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
    else if (wantYaw !== null && b.stagger.lengthSq() < 0.04) targetYaw = wantYaw;
    else if (sp > 0.25 && b.speed > 0.01) targetYaw = Math.atan2(b.vel.x, b.vel.z);
    else if (b.state === 'handsUp') targetYaw = Math.atan2(game.camera.position.x - root.pos.x, game.camera.position.z - root.pos.z);
    if (targetYaw !== null) {
      const maxTurn = (b.speed > 2.5 ? 4.0 : 1.9) * dt * (isZ ? 0.6 : 1);
      root.yaw += clamp(wrapAngle(targetYaw - root.yaw), -maxTurn, maxTurn);
    }
    if (b.speed < 0.05) b.faceTarget = b.state === 'zAttack' || b.state === 'fight' ? b.faceTarget : null;
  }
}
HT.AISystem = AISystem;
