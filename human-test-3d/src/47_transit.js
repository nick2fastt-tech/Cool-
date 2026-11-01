// ============================================================================
// Transit: sitting and riding. The benches on the platforms and the plaza, and the seats in the
// train cars, are used by people, vampires, Chucky and Jason - never by zombies. People board an
// open train, take a free seat (or hold a pole), ride round the loop and get off when it comes back;
// anyone frightened stands up and gets out of there. Riders stay on their car: the car carries
// their root and planted feet every frame, and walking inside keeps to the aisle and doorways.
// ============================================================================
const SIT_MODES = {
  human: ['phone', 'phone', 'look', 'arms', 'doze', 'lean'],
  vampire: ['look', 'arms', 'look'],
  slasher: ['lean', 'arms'],
  doll: ['look', 'look', 'arms']
};

class TransitSystem {
  constructor(game) { this.game = game; this._v = new V3(); this._w = new V3(); this._g = new V3(); this._s = new V3(); }
  get env() { const e = this.game.env && this.game.env.current; return e && e.kind === 'subway' && e.trains ? e : null; }
  get anyOpen() { const e = this.env; return !!(e && e.anyOpen); }
  reset() { if (this.game.npcs) for (const n of this.game.npcs.list) { n.riding = null; n.seatLock = null; n.transit = null; } }
  insideCar(p) { const e = this.env; return e ? e.carAt(p.x, p.z, p.y) : null; }
  // who may sit: anyone alive or undead-but-thinking with working legs; zombies never sit down
  canSit(npc) {
    if (npc.removed || npc.physMode !== 'anim' || npc.grabbedBy || npc.carried) return false;
    if (npc.lifeState === 'zombie' || npc.isZombie || npc.anim.crawl || (npc.gore && npc.gore.lostLegs > 0)) return false;
    if (npc.lifeState === 'vampire') return true;
    return npc.lifeState === 'alive' && !(npc.infection && npc.infection.t > npc.infection.dur * 0.6) && !(npc.vamp && npc.vamp.state === 'turning');
  }
  kindOf(npc) { return npc.lifeState === 'vampire' ? 'vampire' : (npc.horror ? npc.horror.kind : 'human'); }
  // ---- every frame, after the trains moved (map pre-step) -------------------------------------
  update(dt) {
    const e = this.env, list = this.game.npcs && this.game.npcs.list; if (!e || !list) return;
    // now and then: free seats held by someone who left (removed, reset, plans dropped)
    this.sweepT = (this.sweepT || 0) - dt;
    if (this.sweepT <= 0) {
      this.sweepT = 1;
      const free = (q) => { const o = q.occupant; if (o && (o.removed || !o.transit || o.transit.seat !== q)) q.occupant = null; };
      for (const q of e.benchSeats) free(q);
      for (const tr of e.trains) for (const c of tr.cars) for (const q of c.seats) free(q);
    }
    for (const n of list) {
      if (n.removed) continue;
      if (n.physMode === 'ragdoll') { if (n.riding || n.transit || n.seatLock) this.release(n, true); continue; }
      if (n.riding) {
        const R = n.riding;
        e.carToWorld(R.car, R.lx, R.lz, this._v);
        const dx = this._v.x - n.root.pos.x, dy = this._v.y - n.root.pos.y, dz = this._v.z - n.root.pos.z;
        if (dx * dx + dy * dy + dz * dz > 1e-10) { n.root.pos.copy(this._v); n.anim.carry(dx, dy, dz); }
      } else if (n.physMode === 'anim') {
        const car = e.carAt(n.root.pos.x, n.root.pos.z, n.root.pos.y + 0.1);
        if (car) this.adopt(n, car);
      }
      // zombies never sit; a sitter whose seat was taken away (map switch, teleport) stands up
      if ((n.transit || n.seatLock) && (!this.canSit(n) || (n.seatLock && n.transit && n.transit.seat && n.transit.seat.occupant !== n))) this.interrupt(n);
    }
  }
  adopt(n, car) { this.env.worldToCar(car, n.root.pos.x, n.root.pos.z, this._w); n.riding = { car, lx: this._w.x, lz: this._w.z }; }
  // drop all plans (keeps riding unless the body went limp)
  release(n, limp) {
    const T = n.transit;
    if (T && T.seat && T.seat.occupant === n) T.seat.occupant = null;
    n.transit = null; n.seatLock = null;
    if (limp) n.riding = null;
  }
  // a calm state was left (fright, a hit, a grab, prey spotted): stand up and let the AI take over
  interrupt(n) {
    if (!n.transit && !n.seatLock) return;
    const a = n.anim.action;
    if (a && (a.type === 'sit' || a.type === 'ridehold')) n.anim.setAction(null);
    this.release(n, false);
  }
  // ---- doorways ---------------------------------------------------------------------------
  doorIndex(car, lx) { const D = car.train.type.doors, h = car.train.type.doorW / 2; for (let i = 0; i < D.length; i++) if (Math.abs(lx - D[i]) < h) return i; return -1; }
  bestDoor(car, lx, dest) {
    const e = this.env, D = car.train.type.doors; let best = 0, bd = 1e9;
    if (dest) e.worldToCar(car, dest.x, dest.z, this._s);
    for (let i = 0; i < D.length; i++) { const d = Math.abs(D[i] - lx) + (dest ? Math.abs(D[i] - this._s.x) * 0.5 : 0); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  open(tr) { return tr.state === 'dwell' && tr.door > 0.6; }
  // where to steer: riders keep to their car and leave by an open door; walkers heading into a car go
  // to the platform in front of a door first, then step in
  navGoal(npc, dest) {
    const e = this.env, P = npc.root.pos, g = this._g, w = this._w;
    if (!e) { const c = this.game.env.current; return c && c.navGoal ? c.navGoal(P, dest) : dest; }
    if (npc.riding) {
      const car = npc.riding.car, tr = car.train;
      if (e.carAt(dest.x, dest.z, dest.y + 0.1) === car) return dest;
      e.worldToCar(car, P.x, P.z, w);
      if (this.open(tr)) {
        const dc = tr.type.doors[this.bestDoor(car, w.x, dest)], side = tr.doorSide;
        if (Math.abs(w.x - dc) > 0.28) return e.carToWorld(car, dc, side * (car.iw - 0.75), g);
        return e.carToWorld(car, dc, side * (car.hw + 0.9), g);
      }
      e.worldToCar(car, dest.x, dest.z, this._s);
      return e.carToWorld(car, clamp(this._s.x, car.x0 + 0.3, car.x1 - 0.3), clamp(this._s.z, -(car.iw - 0.62), car.iw - 0.62), g);
    }
    const car = this.anyOpen ? e.carAt(dest.x, dest.z, dest.y + 0.1) : null;
    if (car && this.open(car.train)) {
      const tr = car.train, side = tr.doorSide;
      e.worldToCar(car, P.x, P.z, w);
      const dc = tr.type.doors[this.bestDoor(car, w.x, dest)], q = w.z * side;
      if (Math.abs(w.x - dc) > 0.35 || q > car.hw + 1.5 || q < car.hw - 0.4 && Math.abs(w.x - dc) > 0.2) {
        const front = e.carToWorld(car, dc, side * (car.hw + 0.75), this._v);
        return e.navGoal(P, front);
      }
      return e.carToWorld(car, dc, side * (car.iw - 0.8), g);
    }
    return e.navGoal(P, dest);
  }
  wantsOut(npc, b, car) { return b.speed > 0.01 && this.env.carAt(b.dest.x, b.dest.z, b.dest.y + 0.1) !== car; }
  wantsIn(npc, b) { const c = this.env.carAt(b.dest.x, b.dest.z, b.dest.y + 0.1); return c && this.open(c.train) ? c : null; }
  // after a root moved: riders stay in the aisle (doorways reach the door); an open door lets people
  // through in either direction. Returns true when it placed the root itself.
  afterMove(npc, b) {
    const e = this.env; if (!e) return false;
    const P = npc.root.pos, w = this._w;
    if (npc.riding) {
      const R = npc.riding, car = R.car, tr = car.train, side = tr.doorSide, aisle = car.iw - 0.6;
      e.worldToCar(car, P.x, P.z, w);
      let lx = clamp(w.x, car.x0, car.x1), lz = w.z;
      if (Math.abs(lz) > aisle && !npc.seatLock) {
        const di = this.doorIndex(car, lx), dc = di >= 0 ? tr.type.doors[di] : 0, half = tr.type.doorW / 2 - 0.2;
        if (di >= 0 && Math.abs(lx - dc) <= half) {
          // in a doorway: up to the doors, or out onto the platform when they are open and we're leaving
          const out = this.open(tr) && Math.sign(lz) === side && this.wantsOut(npc, b, car);
          if (out && lz * side > car.hw + 0.18) {
            npc.riding = null;
            e.carToWorld(car, lx, side * (car.hw + 0.55), P);
            return false;
          }
          lz = out ? side * Math.min(lz * side, car.hw + 0.4) : clamp(lz, -(car.iw - 0.24), car.iw - 0.24);
        } else lz = Math.sign(lz) * aisle; // beside the seats: keep to the aisle
      }
      R.lx = lx; R.lz = lz; e.carToWorld(car, lx, lz, P);
      return true;
    }
    if (!e.anyOpen) return false;
    const car = this.wantsIn(npc, b); if (!car) return false;
    const tr = car.train, side = tr.doorSide;
    e.worldToCar(car, P.x, P.z, w);
    const q = w.z * side; if (q > car.hw + 0.95 || q < -car.iw) return false;
    const di = this.doorIndex(car, w.x); if (di < 0) return false;
    const dc = tr.type.doors[di], half = tr.type.doorW / 2 - 0.2, lx = clamp(w.x, dc - half, dc + half);
    if (q < car.iw - 0.15) { npc.riding = { car, lx, lz: w.z }; e.carToWorld(car, lx, w.z, P); return true; }
    e.carToWorld(car, lx, w.z, P); P.y = car.floorY;
    return true;
  }
  // ---- seats ---------------------------------------------------------------------------------
  sitDepth(npc) { return clamp(npc.rig.thighLen * 0.95, 0.15, 0.46); }
  // world position of the spot in front of a seat (where the sitter's root goes) and the facing
  seatSpot(npc, s, out) {
    const d = this.sitDepth(npc);
    if (s.kind === 'train') { const car = s.car; this.env.carToWorld(car, s.lx, s.lz - s.side * d, out); out.yaw = car.train.theta + (s.side > 0 ? Math.PI : 0); return out; }
    out.set(s.x + Math.sin(s.yaw) * d, s.y, s.z + Math.cos(s.yaw) * d); out.yaw = s.yaw; return out;
  }
  findSeat(npc, car) {
    const P = npc.root.pos;
    let best = null, bd = car ? 1e9 : 15 * 15;
    const list = car ? car.seats : this.env.benchSeats;
    for (const s of list) {
      if (s.occupant) continue;
      if (car) { this.env.worldToCar(car, P.x, P.z, this._w); const d = (s.lx - this._w.x) ** 2 + (s.lz - this._w.z) ** 2 + Math.random() * 0.5; if (d < bd) { bd = d; best = s; } continue; }
      if (Math.abs(s.y - P.y) > 0.6) continue;
      const d = (s.x - P.x) ** 2 + (s.z - P.z) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    // neighbours: people prefer not to sit right next to someone if there is room
    return best;
  }
  // nearest open train door on this level within reach
  findDoor(npc) {
    const e = this.env, P = npc.root.pos;
    let best = null, bd = 22;
    for (const tr of e.trains) {
      if (!this.open(tr) || tr.t > 16 || Math.abs(tr.floorY - P.y) > 0.6) continue;
      for (const car of tr.cars) {
        e.worldToCar(car, P.x, P.z, this._w);
        const q = this._w.z * tr.doorSide; if (q < car.hw || q > car.hw + 9) continue;
        for (const dc of tr.type.doors) { const d = Math.hypot(this._w.x - dc, q - car.hw); if (d < bd) { bd = d; best = { car, dc }; } }
      }
    }
    return best;
  }
  // ---- decisions for calm characters: called by the AIs from idle / wander; true while transit drives
  think(npc, b, dt) {
    const T = npc.transit;
    if (T) return this.drive(npc, b, dt, T);
    const e = this.env; if (!e || !this.canSit(npc)) return false;
    if (npc.riding) { this.startRide(npc, b, npc.riding.car, true); return true; }
    b.transitT = (b.transitT == null ? 1 + Math.random() * 3 : b.transitT) - dt;
    if (b.transitT > 0) return false;
    b.transitT = 2 + Math.random() * 3;
    if (npc.fear > 0.3) return false;
    const k = this.kindOf(npc);
    // a train standing with its doors open: get on
    if (this.anyOpen && Math.random() < (k === 'human' ? 0.6 : 0.4)) { const d = this.findDoor(npc); if (d) { this.startBoard(npc, b, d); return true; } }
    // a free seat nearby: sit a while
    if (Math.random() < (k === 'human' ? 0.3 : 0.18) && !(b.satAt && this.game.time - b.satAt < 30)) { const s = this.findSeat(npc); if (s) { this.startSeat(npc, b, s); return true; } }
    return false;
  }
  startSeat(npc, b, s) {
    s.occupant = npc;
    npc.transit = { mode: 'toSeat', seat: s, t: 0 };
    npc.lastReaction = s.kind === 'train' ? 'Taking a Seat (Train)' : 'Going to Sit';
  }
  startBoard(npc, b, d) {
    npc.transit = { mode: 'board', car: d.car, dc: d.dc, t: 0 };
    npc.lastReaction = 'Boarding (' + d.car.train.line + ' train)';
  }
  // on a car: a seat if one is free, else a spot by a pole
  startRide(npc, b, car, settle) {
    const s = this.findSeat(npc, car);
    if (s && Math.random() < 0.9) { this.startSeat(npc, b, s); npc.transit.ride = true; npc.transit.boardCycle = car.train.cycle; return; }
    const D = car.train.type.doors, dc = D[Math.floor(Math.random() * D.length)];
    npc.transit = { mode: 'toStand', ride: true, t: 0, lx: dc + (Math.random() - 0.5) * 0.8, lz: (Math.random() - 0.5) * 0.9, boardCycle: car.train.cycle, car };
    npc.lastReaction = 'Riding (Standing)';
  }
  stand(npc, T) {
    const a = npc.anim.action;
    if (a && (a.type === 'sit' || a.type === 'ridehold')) npc.anim.setAction(null);
    if (T.seat && T.seat.occupant === npc) T.seat.occupant = null;
    npc.seatLock = null; T.seat = null;
  }
  drive(npc, b, dt, T) {
    const e = this.env, P = npc.root.pos, anim = npc.anim, k = this.kindOf(npc);
    if (!e || !this.canSit(npc)) { this.interrupt(npc); return false; }
    T.t += dt;
    const walk = (npc.brain === b && npc.personality ? npc.personality.walkSpeed * Math.sqrt(npc.rig.legLen / 0.84) : 1.0) * (npc.horror ? (npc.horror.def.walk || 1) / 1.1 : 1);
    const look = () => { if (npc.lifeState === 'alive' && !npc.horror && this.game.ai.idleLook) this.game.ai.idleLook(npc, b, dt); };
    switch (T.mode) {
      case 'toSeat': {
        const s = T.seat;
        if (!s || s.occupant !== npc || (s.kind === 'train' && (!npc.riding || npc.riding.car !== s.car))) { this.release(npc, false); return false; }
        const sp = this.seatSpot(npc, s, this._v), d = Math.hypot(sp.x - P.x, sp.z - P.z);
        if (T.t > 25) { this.release(npc, false); return false; }
        if (d > 0.9 && !T.close) { b.dest.copy(sp); b.speed = walk; b.faceTarget = null; return true; }
        // the last steps are walked straight to the spot (past the bench's footprint), then square up and sit back
        T.close = true; b.speed = 0; b.vel.set(0, 0, 0);
        if (!npc.seatLock) npc.seatLock = { yaw: sp.yaw, approach: true };
        if (d > 0.02) {
          const st = Math.min(d, walk * 0.55 * dt);
          P.x += (sp.x - P.x) / d * st; P.z += (sp.z - P.z) / d * st;
          if (d > 0.25) npc.root.yaw = angleDamp(npc.root.yaw, Math.atan2(sp.x - P.x, sp.z - P.z), 8, dt);
        }
        if (npc.riding) { e.worldToCar(npc.riding.car, P.x, P.z, this._w); npc.riding.lx = this._w.x; npc.riding.lz = this._w.z; }
        if (d > 0.25) return true;
        const dy = wrapAngle(sp.yaw - npc.root.yaw);
        npc.root.yaw += clamp(dy, -3.2 * dt, 3.2 * dt);
        if (Math.abs(dy) < 0.12 && d < 0.05) {
          const modes = SIT_MODES[k] || SIT_MODES.human;
          anim.setAction('sit', { seatH: s.h, depth: this.sitDepth(npc), mode: modes[Math.floor(Math.random() * modes.length)], slouch: Math.random() * 0.08, wide: k === 'slasher' || (npc.app && npc.app.male && Math.random() < 0.5), ph: Math.random() * 6, inT: 0.85, outT: 0.75 });
          npc.seatLock = { yaw: sp.yaw };
          P.x = sp.x; P.z = sp.z;
          T.mode = 'seated'; T.t = 0; T.dur = s.kind === 'train' ? 1e9 : 12 + Math.random() * 30;
          npc.lastReaction = s.kind === 'train' ? 'Riding (Seated)' : 'Sitting';
          b.satAt = this.game.time;
        }
        return true;
      }
      case 'seated': {
        b.speed = 0; b.vel.set(0, 0, 0);
        if (npc.seatLock) npc.root.yaw = npc.seatLock.yaw;
        look();
        if (T.ride) return this.rideTick(npc, b, T);
        if (T.t > T.dur) { this.stand(npc, T); T.mode = 'getUp'; T.t = 0; }
        return true;
      }
      case 'getUp': { b.speed = 0; if (T.t > 0.75) { npc.transit = null; if (b.state === 'idle' || b.state === 'hIdle' || b.state === 'vIdle') b.idleTime = 1 + Math.random() * 2; return false; } return true; }
      case 'board': {
        const car = T.car, tr = car.train;
        if (npc.riding && npc.riding.car === car) { this.startRide(npc, b, car); return true; }
        if (!this.open(tr) || tr.t > 21.5 || T.t > 20) { npc.transit = null; npc.lastReaction = 'Missed the Train'; return false; }
        e.carToWorld(car, T.dc, tr.doorSide * (car.iw - 1.0), b.dest); b.dest.y = car.floorY;
        b.speed = walk * (tr.t > 15 ? 1.6 : 1.15); b.faceTarget = null;
        return true;
      }
      case 'toStand': {
        const car = npc.riding && npc.riding.car;
        if (!car) { npc.transit = null; return false; }
        e.carToWorld(car, T.lx, T.lz, this._v);
        const d = Math.hypot(this._v.x - P.x, this._v.z - P.z);
        if (d > 0.25 && T.t < 8) { b.dest.copy(this._v); b.dest.y = car.floorY; b.speed = walk * 0.7; return true; }
        b.speed = 0; b.vel.set(0, 0, 0);
        anim.setAction('ridehold', { side: Math.random() < 0.5 ? 0 : 1, moving: false, inT: 0.5, outT: 0.5 });
        T.mode = 'standRide'; T.t = 0;
        return true;
      }
      case 'standRide': {
        b.speed = 0; b.vel.set(0, 0, 0);
        const car = npc.riding && npc.riding.car; if (!car) { this.stand(npc, T); npc.transit = null; return false; }
        const a = anim.action; if (a && a.type === 'ridehold') a.moving = car.train.state !== 'dwell';
        look();
        // a seat came free: take it
        if (car.train.state !== 'dwell' && T.t > 6 && Math.random() < dt * 0.15) { const s = this.findSeat(npc, car); if (s) { this.stand(npc, T); this.startSeat(npc, b, s); npc.transit.ride = true; npc.transit.boardCycle = T.boardCycle; return true; } }
        return this.rideTick(npc, b, T);
      }
      case 'alight': {
        const car = T.car, tr = car.train;
        if (!npc.riding) { // off the train: walk away from the edge
          npc.transit = null; npc.lastReaction = 'Got Off the Train';
          if (npc.lifeState === 'alive' && !npc.horror) { this.game.ai.pickWander(npc, b); b.state = 'wander'; b.t = 0; }
          return false;
        }
        if (!this.open(tr)) { this.startRide(npc, b, car); npc.lastReaction = 'Missed the Stop'; return true; }
        if (T.t < 0.7) { b.speed = 0; return true; } // getting up
        const dc = tr.type.doors[T.door], side = tr.doorSide;
        e.carToWorld(car, dc, side * (car.hw + 2.2), b.dest); b.dest.y = car.floorY;
        b.speed = walk * 1.1; b.faceTarget = null;
        return true;
      }
    }
    npc.transit = null; return false;
  }
  // riding: when the train is back at the platform with its doors open, maybe get off
  rideTick(npc, b, T) {
    const car = npc.riding && npc.riding.car;
    if (!car) { this.stand(npc, T); npc.transit = null; return false; }
    const tr = car.train;
    if (this.open(tr) && tr.cycle > (T.boardCycle || 0) && tr.t < 14 && !T.decided) {
      T.decided = true;
      if (Math.random() < (npc.horror || npc.lifeState === 'vampire' ? 0.5 : 0.6)) {
        this.stand(npc, T);
        this.env.worldToCar(car, npc.root.pos.x, npc.root.pos.z, this._w);
        npc.transit = { mode: 'alight', car, door: this.bestDoor(car, this._w.x, null), t: 0 };
        npc.lastReaction = 'Getting Off';
        return true;
      }
    }
    if (tr.state !== 'dwell') T.decided = false;
    return true;
  }
}
HT.TransitSystem = TransitSystem;
