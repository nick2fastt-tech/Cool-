// ============================================================================
// Diagnostics: profiler, debug panel, event log, collider visualization
// ============================================================================
class Profiler {
  constructor() { this.t = {}; this.acc = {}; this.avg = {}; this.frameMs = 0; this.hist = new Float32Array(120); this.hi = 0; }
  begin(k) { this.t[k] = performance.now(); }
  end(k) { const d = performance.now() - this.t[k]; this.acc[k] = (this.acc[k] || 0) + d; }
  frame(ms) {
    this.frameMs = this.frameMs * 0.9 + ms * 0.1;
    this.hist[this.hi] = ms; this.hi = (this.hi + 1) % this.hist.length;
    for (const k in this.acc) { this.avg[k] = (this.avg[k] || 0) * 0.9 + this.acc[k] * 0.1; this.acc[k] = 0; }
  }
}

class Diagnostics {
  constructor(game) {
    this.game = game; this.entries = []; this.max = 250;
    this.body = document.getElementById('elBody'); this.panel = document.getElementById('debugPanel');
    this.panelT = 0;
    HT.log = (type, text) => this.log(type, text);
    window.addEventListener('error', (e) => reportError(e.error || e.message, 'window'));
    window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'promise'));
    this.colliderLines = null;
    Events.on('life', (e) => this.log(e.to === 'zombie' || e.to === 'reanimating' ? 'zombie' : (e.to === 'dead' || e.to === 'destroyed' ? 'death' : 'sys'), `${e.npc.idStr} ${e.npc.name}: ${e.from} -> ${e.to}`));
    Events.on('reaction', (e) => { if (this.game.npcs.selected === e.npc) this.log('ai', `${e.npc.idStr} reaction: ${e.reaction}`); });
    Events.on('zombieTarget', (e) => this.log('zombie', `Zombie ${e.npc.idStr} targets ${e.target.idStr} ${e.target.name}`));
    Events.on('environment', (env) => this.log('sys', `Environment: ${env.name}`));
  }
  log(type, text) {
    const t = this.game.time || 0;
    const e = { t, type, text };
    this.entries.push(e);
    if (this.entries.length > this.max) this.entries.shift();
    if (this.body) {
      const div = document.createElement('div'); div.className = 'ev ' + type;
      const mm = Math.floor(t / 60), ss = (t % 60).toFixed(1).padStart(4, '0');
      div.innerHTML = `<span class="t">[${String(mm).padStart(2, '0')}:${ss}]</span> ${escapeHtml(text)}`;
      this.body.appendChild(div);
      while (this.body.children.length > 120) this.body.firstChild.remove();
      this.body.scrollTop = this.body.scrollHeight;
    }
  }
  clearLog() { this.entries.length = 0; if (this.body) this.body.innerHTML = ''; }
  copyLog() {
    const txt = this.entries.map(e => `[${e.t.toFixed(2)}] ${e.type.toUpperCase()}: ${e.text}`).join('\n');
    try { navigator.clipboard.writeText(txt).then(() => HT.toast('Event log copied')); } catch (e) { HT.toast('Clipboard unavailable', 'warn'); }
  }
  update(dt) {
    const g = this.game, D = Settings.data.diagnostics;
    this.updateColliders(D.colliders);
    if (!D.debugPanel) return;
    this.panelT -= dt;
    if (this.panelT > 0) return;
    this.panelT = 0.25;
    const pr = g.prof, info = g.renderer.info, ph = g.physics.stats;
    const L = g.npcs.list;
    const counts = { alive: 0, dead: 0, zombie: 0, reanimating: 0, destroyed: 0 };
    let rag = 0, sleeping = 0, pend = 0;
    for (const n of L) { counts[n.lifeState]++; if (n.physMode === 'ragdoll') { rag++; if (n.rag.asleep) sleeping++; } if (n.reinc.state === 'pending') pend++; }
    const mem = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB' : 'n/a';
    const f = (k) => (pr.avg[k] || 0).toFixed(2);
    const sel = g.npcs.selected;
    let selHtml = '<div class="warn">No subject selected (aim + F)</div>';
    if (sel) {
      const a = sel.app, r = sel.reinc, b = sel.brain;
      const lh = sel.lastHit;
      selHtml = `<div>ID <b>${sel.idStr}</b> ${sel.name} · seed ${sel.seed}</div>
        <div>State: ${sel.lifeState} / ${b ? b.state : '-'} · fear ${sel.fear.toFixed(2)}</div>
        <div>Anim: ${sel.anim.stateName} · upper ${sel.anim.upper.cur} (${(sel.anim.upper.w * 100).toFixed(0)}%) · posture ${sel.anim.posture.cur}${sel.anim.clip ? ' · clip ' + sel.anim.clip.name + ' ' + sel.anim.clip.t.toFixed(2) + 's' : ''}</div>
        <div>Speed ${sel.anim.speed.toFixed(2)} m/s · phase ${sel.anim.phase.toFixed(2)}</div>
        <div>Attrs: ${a.gender} ${a.age}y ${a.height.toFixed(2)}m ${a.build} · ${a.skin.name} · ${a.hairColor.name} ${a.hairStyle}</div>
        <div>Health ${sel.health.toFixed(0)} · critical head: ${sel.criticalHead ? '<span class="bad">YES</span>' : 'no'}</div>
        <div>Physics: ${sel.physicsState()} · mass ${sel.rag.totalMass.toFixed(1)} kg · vmax ${sel.physMode === 'ragdoll' ? sel.rag.maxSpeed().toFixed(2) : '-'}</div>
        <div>Last hit: ${lh ? lh.regionName + ' / ' + lh.weapon + ' / ' + lh.damage.toFixed(0) + ' @' + lh.time.toFixed(1) + 's' : '-'}</div>
        <div>Reincarnation: ${r.state}${r.state === 'pending' ? ' <span class="ok">' + Math.max(0, r.timer).toFixed(1) + 's</span>' : ''}${r.reason ? ' · ' + r.reason : ''}</div>
        <div>Zombie target: ${sel.zombieTarget ? sel.zombieTarget.idStr + ' ' + sel.zombieTarget.name : '-'}</div>
        <div>Hits by region: ${Array.from(sel.hitCounts).map((c, i) => c ? REGION_NAMES[i] + ' x' + c : '').filter(Boolean).join(', ') || 'none'}</div>`;
    }
    const hits = g.hits.history.slice(-4).reverse().map(h => `<div>${h.time.toFixed(1)}s ${h.id} ${h.regionName} [${h.weapon}] ${h.damage.toFixed(0)}${h.killed ? ' <span class="bad">KILL</span>' : ''}</div>`).join('') || '<div>-</div>';
    this.panel.innerHTML = `
      <h5>PERFORMANCE</h5>
      <div>FPS <b>${g.ui.fps.toFixed(0)}</b> · frame ${pr.frameMs.toFixed(1)} ms · px ratio ${g.renderer.getPixelRatio().toFixed(2)}</div>
      <canvas class="graph" id="dbgGraph" width="280" height="34"></canvas>
      <div>AI ${f('ai')} · Anim ${f('anim')} · Phys ${f('physics')} · FX ${f('fx')} · Render ${f('render')} ms</div>
      <div>Draw calls ${info.render.calls} · Tris ${(info.render.triangles / 1000).toFixed(0)}k · Geo ${info.memory.geometries} · Tex ${info.memory.textures} · Programs ${info.programs ? info.programs.length : '-'}</div>
      <div>JS heap ${mem} · Pools: shells ${g.npcs.shellPool.length}, labels ${g.ui.labelPool.length}</div>
      <h5>PHYSICS</h5>
      <div>${Settings.data.physics.paused ? '<span class="warn">PAUSED</span> · ' : ''}Bodies ${ph.bodies} (awake ${ph.awake}) · Pairs ${ph.pairs} · Contacts ${ph.contacts}</div>
      <div>Step ${ph.ms.toFixed(2)} ms · substeps ${g.physics.substeps} · g ${g.physics.gravity.y.toFixed(2)} · time x${g.timeScale.toFixed(2)}</div>
      <div>Ragdolls ${rag} (sleeping ${sleeping}) · Props ${g.props.list.length} · Projectiles ${g.weapons.projectiles.length} · Grenades ${g.weapons.grenades.length}</div>
      <h5>POPULATION</h5>
      <div>Alive ${counts.alive} · Dead ${counts.dead} · Reanimating ${counts.reanimating} · Zombies ${counts.zombie} · Destroyed ${counts.destroyed}</div>
      <div>Reincarnation ${Settings.data.zombies.reincarnation ? '<span class="ok">ON</span>' : 'off'} · pending ${pend} · delay ${g.zombies.delay().toFixed(1)}s</div>
      <h5>SELECTED SUBJECT</h5>${selHtml}
      <h5>RECENT HIT EVENTS</h5>${hits}
      ${ErrorLog.length ? '<h5>ERRORS</h5>' + ErrorLog.slice(-3).map(e => `<div class="bad">${escapeHtml(e.where)}: ${escapeHtml(e.msg)}</div>`).join('') : ''}`;
    const cv = document.getElementById('dbgGraph');
    if (cv) {
      const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
      const n = pr.hist.length;
      c.strokeStyle = 'rgba(79,209,255,0.25)'; c.beginPath(); c.moveTo(0, cv.height - 16.7 / 50 * cv.height); c.lineTo(cv.width, cv.height - 16.7 / 50 * cv.height); c.stroke();
      c.strokeStyle = '#4fd1ff'; c.beginPath();
      for (let i = 0; i < n; i++) { const v = pr.hist[(pr.hi + i) % n]; const x = i / (n - 1) * cv.width, y = cv.height - Math.min(1, v / 50) * cv.height; if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
    }
  }
  updateColliders(on) {
    const g = this.game;
    if (!on) { if (this.colliderLines) this.colliderLines.visible = false; return; }
    if (!this.colliderLines) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 2 * 40 * 1200), 3).setUsage(THREE.DynamicDrawUsage));
      this.colliderLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x00ff9c, transparent: true, opacity: 0.8, depthTest: false }));
      this.colliderLines.frustumCulled = false; this.colliderLines.renderOrder = 10;
      g.scene.add(this.colliderLines);
    }
    this.colliderLines.visible = true;
    const arr = this.colliderLines.geometry.attributes.position.array;
    let k = 0;
    const maxK = arr.length - 6;
    const seg = (a, b) => { if (k > maxK) return; arr[k++] = a.x; arr[k++] = a.y; arr[k++] = a.z; arr[k++] = b.x; arr[k++] = b.y; arr[k++] = b.z; };
    const ring = (c, ax, r, q) => {
      const u = _v3.set(1, 0, 0).applyQuaternion(q), w = _v4.set(0, 0, 1).applyQuaternion(q);
      const N = 10;
      for (let i = 0; i < N; i++) {
        const a0 = i / N * TAU, a1 = (i + 1) / N * TAU;
        const p0 = _v5.copy(c).addScaledVector(u, Math.cos(a0) * r).addScaledVector(w, Math.sin(a0) * r);
        const p1 = _v6.copy(c).addScaledVector(u, Math.cos(a1) * r).addScaledVector(w, Math.sin(a1) * r);
        seg(p0, p1);
      }
    };
    for (const b of g.physics.bodies) {
      const s = b.shape;
      if (s.type === SHAPE.CAPSULE) {
        b.segment(_p1, _p2);
        ring(_p1, null, s.r, b.rot); ring(_p2, null, s.r, b.rot);
        const u = _p3.set(s.r, 0, 0).applyQuaternion(b.rot);
        seg(_p4.copy(_p1).add(u), _p5.copy(_p2).add(u)); seg(_p4.copy(_p1).sub(u), _p5.copy(_p2).sub(u));
        const w = _p3.set(0, 0, s.r).applyQuaternion(b.rot);
        seg(_p4.copy(_p1).add(w), _p5.copy(_p2).add(w)); seg(_p4.copy(_p1).sub(w), _p5.copy(_p2).sub(w));
      } else if (s.type === SHAPE.SPHERE) { ring(b.pos, null, s.r, b.rot); ring(b.pos, null, s.r, _q1.setFromAxisAngle(LEFT, Math.PI / 2).premultiply(b.rot)); }
      else {
        const c = boxCorners(b);
        const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
        for (const e of E) seg(c[e[0]], c[e[1]]);
      }
    }
    this.colliderLines.geometry.setDrawRange(0, k / 3);
    this.colliderLines.geometry.attributes.position.needsUpdate = true;
  }
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
HT.Diagnostics = Diagnostics;
