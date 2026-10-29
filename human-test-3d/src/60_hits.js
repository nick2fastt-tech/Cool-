// ============================================================================
// Precise, event-based hit detection: ray -> capsule broad phase -> exact ray vs
// CPU-skinned triangles. Region = per-vertex region id of the struck triangle.
// Also produces the on-screen diagnostic cards and hit events.
// ============================================================================
class HitSystem {
  constructor(game) {
    this.game = game; this.cards = []; this.cardPool = [];
    this.history = []; // recent hit events for debugging
    this.container = document.getElementById('labels');
  }
  raycastNPCs(origin, dir, maxDist, ignore) {
    const cands = [];
    for (const npc of this.game.npcs.list) {
      if (npc === ignore || npc.removed) continue;
      const bs = npc.mesh.boundingSphere;
      if (raySphere(origin, dir, bs.center, bs.radius, maxDist) === null) continue;
      let tmin = Infinity;
      for (const b of npc.rag.bodies) {
        b.segment(_p1, _p2);
        const t = rayCapsule(origin, dir, _p1, _p2, b.shape.r + 0.07, maxDist);
        if (t !== null && t < tmin) tmin = t;
      }
      if (tmin < maxDist) cands.push({ npc, t: tmin });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => a.t - b.t);
    let best = null;
    for (const c of cands) {
      if (best && c.t > best.dist) break;
      const h = this.rayMesh(c.npc, origin, dir, best ? best.dist : maxDist);
      if (h && (!best || h.dist < best.dist)) best = h;
    }
    return best;
  }
  rayMesh(npc, o, d, maxDist) {
    const P = npc.skinnedPositions();
    const g = npc.mesh.geometry;
    const idx = g.index.array, reg = g.attributes.aRegion.array;
    let bestT = maxDist, bt = -1, bu = 0, bv = 0;
    const ox = o.x, oy = o.y, oz = o.z, dx = d.x, dy = d.y, dz = d.z;
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const ax = P[a], ay = P[a + 1], az = P[a + 2];
      const e1x = P[b] - ax, e1y = P[b + 1] - ay, e1z = P[b + 2] - az;
      const e2x = P[c] - ax, e2y = P[c + 1] - ay, e2z = P[c + 2] - az;
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (det > -1e-10 && det < 1e-10) continue;
      const inv = 1 / det;
      const tx = ox - ax, ty = oy - ay, tz = oz - az;
      const u = (tx * px + ty * py + tz * pz) * inv;
      if (u < 0 || u > 1) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
      const v = (dx * qx + dy * qy + dz * qz) * inv;
      if (v < 0 || u + v > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (t > 0.0001 && t < bestT) { bestT = t; bt = i; bu = u; bv = v; }
    }
    if (bt < 0) return null;
    const ia = idx[bt], ib = idx[bt + 1], ic = idx[bt + 2];
    const w = 1 - bu - bv;
    const vi = w >= bu && w >= bv ? ia : (bu >= bv ? ib : ic);
    const region = reg[vi] | 0;
    const point = new V3(ox + dx * bestT, oy + dy * bestT, oz + dz * bestT);
    const A = new V3(P[ia * 3], P[ia * 3 + 1], P[ia * 3 + 2]), Bv = new V3(P[ib * 3], P[ib * 3 + 1], P[ib * 3 + 2]), Cv = new V3(P[ic * 3], P[ic * 3 + 1], P[ic * 3 + 2]);
    const normal = new V3().subVectors(Bv, A).cross(_v1.subVectors(Cv, A)).normalize();
    if (normal.dot(d) > 0) normal.negate();
    return { npc, dist: bestT, point, normal, region, tri: bt / 3, u: bu, v: bv };
  }
  // closest body part of an npc to a world point (blast diagnostics)
  closestRegion(npc, p) {
    let best = 0, bd = 1e9;
    for (let r = 0; r < REGION_COUNT; r++) {
      const d = npc.boneWPos[REGION_BONE[r]].distanceToSquared(p);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }
  // ---------------------------------------------------------------------------------
  report(npc, region, result, weaponLabel, point) {
    const game = this.game;
    const ev = {
      time: game.time, npc, id: npc.idStr, name: npc.name, region, regionName: REGION_NAMES[region], weapon: weaponLabel,
      damage: result ? result.dmg : 0, killed: result ? result.killed : false,
      damageState: npc.damageState(), reaction: npc.lastReaction, physics: npc.physicsState()
    };
    this.history.push(ev); if (this.history.length > 60) this.history.shift();
    Events.emit('hit', ev);
    HT.log(ev.killed ? 'death' : 'hit', `${npc.idStr} ${npc.name}: ${ev.regionName} [${weaponLabel}] dmg ${ev.damage.toFixed(0)}${ev.killed ? ' - DECEASED' : ''}`);
    if (Settings.data.diagnostics.labels) this.showCard(npc, ev);
    return ev;
  }
  showCard(npc, ev) {
    // one card per NPC (update in place)
    let card = this.cards.find(c => c.npc === npc);
    if (!card) {
      const el = this.cardPool.pop() || document.createElement('div');
      el.className = 'hit-card'; el.style.opacity = '1';
      this.container.appendChild(el);
      card = { npc, el, t: 0 };
      this.cards.push(card);
    }
    card.t = 0; card.ev = ev; card.w = 0;
    card.el.classList.toggle('crit', ev.killed || ev.region === REGION.HEAD);
    card.el.style.opacity = '1';
    this.fillCard(card);
  }
  fillCard(card) {
    const npc = card.npc, ev = card.ev;
    card.el.innerHTML =
      `<div><b>TARGET:</b>Human ${npc.idStr} &middot; ${npc.name}</div>` +
      `<div><b>HIT LOCATION:</b>${ev.regionName}</div>` +
      `<div><b>DAMAGE STATE:</b>${npc.damageState()}</div>` +
      `<div><b>REACTION:</b>${npc.lastReaction}</div>` +
      `<div><b>PHYSICS:</b>${npc.physicsState()}</div>`;
  }
  update(dt) {
    const cam = this.game.camera, W = innerWidth, Hh = innerHeight;
    const vis = this._vis || (this._vis = []);
    vis.length = 0;
    for (let i = this.cards.length - 1; i >= 0; i--) {
      const c = this.cards[i];
      c.t += dt;
      if (c.t > 0.2 && Math.floor(c.t * 4) !== Math.floor((c.t - dt) * 4)) this.fillCard(c);
      if (c.t > 4.2 || c.npc.removed || !Settings.data.diagnostics.labels) {
        c.el.remove(); this.cardPool.push(c.el); this.cards.splice(i, 1); continue;
      }
      if (c.t > 3.6) c.el.style.opacity = String(Math.max(0, (4.2 - c.t) / 0.6));
      const p = _v1.copy(c.npc.boneWPos[B.head]); p.y += 0.32;
      p.project(cam);
      if (p.z > 1 || p.z < -1) { c.el.style.display = 'none'; continue; }
      c.el.style.display = '';
      if (!c.w) { c.w = c.el.offsetWidth || 260; c.h = c.el.offsetHeight || 92; }
      const x = (p.x * 0.5 + 0.5) * W, y = (-p.y * 0.5 + 0.5) * Hh;
      c.sx = Math.min(W - c.w - 6, x + 46); c.sy = Math.max(56, y - 30);
      vis.push(c);
    }
    // keep cards readable when subjects stand close together: push overlapping cards down
    vis.sort((a, b) => a.sy - b.sy);
    for (let i = 0; i < vis.length; i++) {
      const c = vis[i];
      for (let k = 0; k < 6; k++) {
        let moved = false;
        for (let j = 0; j < i; j++) {
          const o = vis[j];
          if (c.sx < o.sx + o.w && c.sx + c.w > o.sx && c.sy < o.sy + o.h + 4 && c.sy + c.h > o.sy) { c.sy = o.sy + o.h + 4; moved = true; }
        }
        if (!moved) break;
      }
      c.el.style.transform = `translate(${Math.round(c.sx)}px, ${Math.round(c.sy)}px)`;
    }
  }
  clear() { for (const c of this.cards) { c.el.remove(); this.cardPool.push(c.el); } this.cards.length = 0; }
}
HT.HitSystem = HitSystem;
