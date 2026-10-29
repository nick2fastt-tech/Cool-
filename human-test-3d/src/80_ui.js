// ============================================================================
// UI: HUD, toolbar, labels, inspector (body diagram), sandbox drawer, touch.
// ============================================================================
const CROSSHAIRS = {
  gun: '<svg viewBox="0 0 30 30" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" style="filter:drop-shadow(0 0 1px #000)"><path d="M15 4v6M15 20v6M4 15h6M20 15h6"/><circle cx="15" cy="15" r="1" fill="#fff"/></svg>',
  knife: '<svg viewBox="0 0 30 30" fill="none" stroke="#fff" stroke-width="1.6" style="filter:drop-shadow(0 0 1px #000)"><circle cx="15" cy="15" r="5"/></svg>',
  grenade: '<svg viewBox="0 0 30 30" fill="none" stroke="#fff" stroke-width="1.6" style="filter:drop-shadow(0 0 1px #000)"><path d="M15 9v12M9 15h12"/><path d="M8 24l14-0" stroke-dasharray="2 2"/></svg>',
  hand: '<svg viewBox="0 0 30 30" fill="none" stroke="#4fd1ff" stroke-width="1.8" style="filter:drop-shadow(0 0 1px #000)"><circle cx="15" cy="15" r="7"/><circle cx="15" cy="15" r="1.4" fill="#4fd1ff"/></svg>',
  move: '<svg viewBox="0 0 30 30" fill="none" stroke="#4fd1ff" stroke-width="1.8" style="filter:drop-shadow(0 0 1px #000)"><path d="M15 6v18M6 15h18M15 6l-3 3M15 6l3 3M15 24l-3-3M15 24l3-3M6 15l3-3M6 15l3 3M24 15l-3-3M24 15l-3 3"/></svg>'
};
const DIAGRAM = [ // region rects (front view; character's left on viewer's right)
  ['c', 50, 17, 11], ['r', 45, 28, 10, 8, 2], ['r', 33, 36, 34, 18, 6], ['r', 34, 54, 32, 15, 3], ['r', 35, 69, 30, 15, 3], ['r', 34, 84, 32, 14, 6],
  ['r', 68, 38, 10, 30, 5], ['r', 70, 68, 9, 27, 4], ['r', 71, 95, 9, 13, 4],
  ['r', 22, 38, 10, 30, 5], ['r', 21, 68, 9, 27, 4], ['r', 20, 95, 9, 13, 4],
  ['r', 51, 98, 13, 40, 6], ['r', 52, 138, 11, 38, 5], ['r', 52, 176, 14, 8, 3],
  ['r', 36, 98, 13, 40, 6], ['r', 37, 138, 11, 38, 5], ['r', 34, 176, 14, 8, 3]
];
const TIPS = [
  'Press <b>1-6</b> to switch tools: Pistol, Sniper, Knife, Grenade, Physics Hand, Move Tool.',
  'Hold <b>right mouse</b> to aim. The sniper scope zooms 6.5x - hold steady and squeeze.',
  'Aim at a subject and press <b>F</b> to open the inspector with a live body diagram.',
  'Enable <b>Reincarnation Mode</b> in AI & Zombies to let eligible subjects return.',
  'A <b>critical head-trauma state</b> can prevent reincarnation - toggle the rule in settings.',
  'Hold the throw button longer to throw grenades farther. Fuse time is configurable.',
  'The <b>Physics Hand</b> grabs ragdolls and props. Right-click while holding to throw.',
  'Every subject is generated from a unique appearance seed - spawn the same seed to reproduce it.',
  'Use <b>Slow Motion</b> in the Physics tab to study ragdoll motion frame by frame.',
  'Switch between the <b>White Testing Room</b> and the <b>Sunny Grassy Field</b> in the World tab.',
  'Press <b>P</b> to pause physics, <b>L</b> to toggle labels, <b>F3</b> for the debug panel.',
  'On mobile: left thumb moves, right thumb looks, tap SELECT to inspect a subject.'
];

const d2op = (d) => d <= 22 ? '1' : (Math.round(clamp(1 - (d - 22) / 26, 0.35, 1) * 10) / 10).toFixed(1);
class UI {
  constructor(game) {
    this.game = game; this.drawerOpen = false; this.tab = 'spawn'; this.labels = new Map(); this.labelPool = [];
    this.$ = (id) => document.getElementById(id);
    this.custom = { gender: 'random', height: 0, build: 'random', skin: -1, hairStyle: 'random', hairColor: -1, eyes: -1, facialHair: 'random', outfit: 'random', seed: '' };
    this.hitMarkerT = 0; this.fpsT = 0; this.frames = 0; this.fps = 60;
  }
  build() {
    const $ = this.$;
    // toolbar
    const tb = $('toolbar'); tb.innerHTML = '';
    this.slots = [];
    this.game.weapons.tools.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'slot';
      b.innerHTML = `<span class="key">${i + 1}</span>${TOOL_ICONS[t.id]}<span class="nm">${t.short}</span>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); this.game.weapons.select(i); });
      tb.appendChild(b); this.slots.push(b);
    });
    // topbar buttons
    $('btnMenu').addEventListener('click', () => this.toggleDrawer());
    $('drClose').addEventListener('click', () => this.toggleDrawer(false));
    $('btnPause').addEventListener('click', () => this.game.togglePause());
    $('btnLabels').addEventListener('click', () => { Settings.set('diagnostics.labels', !Settings.data.diagnostics.labels); this.sound('toggle'); });
    $('btnDebug').addEventListener('click', () => { Settings.set('diagnostics.debugPanel', !Settings.data.diagnostics.debugPanel); this.sound('toggle'); });
    $('btnReset').addEventListener('click', () => { if (confirm('Reset the entire scene? All subjects and props will be restored to the default test set.')) this.game.resetScene(); });
    $('elClear').addEventListener('click', () => { this.game.diag.clearLog(); });
    $('elHide').addEventListener('click', () => { Settings.set('diagnostics.eventLog', false); });
    // drawer tabs
    this.tabs = [['spawn', 'Spawn'], ['subject', 'Subject'], ['weapons', 'Weapons'], ['physics', 'Physics'], ['ai', 'AI & Zombies'], ['world', 'World'], ['graphics', 'Graphics'], ['audio', 'Audio'], ['debug', 'Debug']];
    const tabs = $('drTabs'); tabs.innerHTML = '';
    for (const [id, name] of this.tabs) {
      const b = document.createElement('button'); b.className = 'dr-tab'; b.textContent = name; b.dataset.tab = id;
      b.addEventListener('click', () => { this.tab = id; this.renderDrawer(); this.sound('click'); });
      tabs.appendChild(b);
    }
    // stop propagation of pointer events from panels to the canvas
    for (const id of ['drawer', 'inspector', 'debugPanel', 'eventLog', 'topbar', 'toolbar']) {
      const el = $(id);
      el.addEventListener('mousedown', (e) => e.stopPropagation());
      el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
      el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    }
    Events.on('settings', (e) => this.onSetting(e));
    Events.on('select', () => { this.renderInspector(); if (this.drawerOpen && this.tab === 'subject') this.renderDrawer(); });
    Events.on('tool', (t) => this.updateTool(t));
    Events.on('hit', (ev) => { if (this.game.npcs.selected === ev.npc) { this.insFlash = { region: ev.region, t: 1 }; this.renderInspector(); } });
    Events.on('lock', (locked) => this.updatePlayHint());
    this.applyTouchVisibility();
    this.updateTool(this.game.weapons.current);
    this.renderDrawer();
    this.updatePlayHint();
    this.refreshToggles();
    HT.toast = (msg, cls) => this.toast(msg, cls);
  }
  sound(n) { this.game.audio.play(n, { bus: 'ui', gain: 0.6, vary: false }); }
  toast(msg, cls) {
    const el = document.createElement('div'); el.className = 'toast' + (cls ? ' ' + cls : ''); el.textContent = msg;
    const box = this.$('toasts'); box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { el.style.transition = 'opacity 0.4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 450); }, 2600);
  }
  applyTouchVisibility() {
    const mode = Settings.data.controls.touch;
    const show = mode === 'on' || (mode === 'auto' && this.game.input.isTouch);
    this.$('touch').classList.toggle('hidden', !show);
    this.touchOn = show;
  }
  updatePlayHint() {
    const el = this.$('playHint'), inp = this.game.input;
    if (!this.game.loaded) return;
    if (this.touchOn) { el.classList.add('hidden'); return; }
    if (inp.locked || this.drawerOpen || !Settings.data.ui.hints) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = inp.lockFailed
      ? '<kbd>Right-drag</kbd> look &nbsp; <kbd>WASD</kbd> move &nbsp; <kbd>Left click</kbd> use tool &nbsp; <kbd>Tab</kbd> sandbox menu'
      : '<b>Click to look around</b><br><kbd>WASD</kbd> move &nbsp; <kbd>Space</kbd>/<kbd>C</kbd> up/down &nbsp; <kbd>Shift</kbd> fast &nbsp; <kbd>1-6</kbd> tools<br><kbd>LMB</kbd> use &nbsp; <kbd>RMB</kbd> aim &nbsp; <kbd>R</kbd> reload &nbsp; <kbd>F</kbd> inspect &nbsp; <kbd>Tab</kbd> sandbox menu &nbsp; <kbd>Esc</kbd> release mouse';
  }
  toggleDrawer(v) {
    this.drawerOpen = v != null ? v : !this.drawerOpen;
    this.$('drawer').classList.toggle('open', this.drawerOpen);
    this.$('btnMenu').classList.toggle('on', this.drawerOpen);
    if (this.drawerOpen) { this.game.input.exitLock(); this.renderDrawer(); }
    this.updatePlayHint();
    this.sound('click');
  }
  setScope(on) { on = !!on; const s = this.$('scope'); if (s.classList.contains('on') !== on) { s.classList.toggle('on', on); this.$('crosshair').style.visibility = on ? 'hidden' : 'visible'; } }
  hitMarker(kill) {
    const h = this.$('hitmarker'); h.classList.add('show');
    h.querySelector('svg').setAttribute('stroke', kill ? '#ff5a5f' : '#ffffff');
    this.hitMarkerT = 0.18;
  }
  updateTool(t) {
    this.slots.forEach((s, i) => { const tt = this.game.weapons.tools[i]; s.classList.toggle('sel', tt === t); s.classList.toggle('off', !this.game.weapons.enabled(tt)); });
    const ch = t.isGun ? 'gun' : t.melee ? 'knife' : t.throwable ? 'grenade' : t.grab ? 'hand' : 'move';
    this.$('crosshair').innerHTML = CROSSHAIRS[ch];
    this.$('ammoName').textContent = t.name.toUpperCase();
    this.$('tFire').textContent = t.isGun ? 'FIRE' : t.melee ? 'SLASH' : t.throwable ? 'THROW' : t.grab ? 'GRAB' : 'MOVE';
    this.$('tAim').textContent = t.grab ? 'THROW' : 'AIM';
    this.$('tReload').textContent = t.move ? 'ROT' : 'RLD';
  }
  refreshToggles() {
    const D = Settings.data.diagnostics;
    this.$('btnLabels').classList.toggle('on', D.labels);
    this.$('btnDebug').classList.toggle('on', D.debugPanel);
    this.$('btnPause').classList.toggle('on', Settings.data.physics.paused);
    this.$('pausedBadge').classList.toggle('hidden', !Settings.data.physics.paused);
    this.$('debugPanel').classList.toggle('hidden', !D.debugPanel);
    this.$('eventLog').classList.toggle('hidden', !D.eventLog);
    this.$('fps').classList.toggle('hidden', !Settings.data.graphics.showFps);
  }
  onSetting(e) {
    this.refreshToggles();
    if (e.path === 'controls.touch') this.applyTouchVisibility();
    if (e.path && e.path.startsWith('weapons.enabled')) this.updateTool(this.game.weapons.current);
  }
  // ---------------------------------------------------------------------------------
  update(dt) {
    const g = this.game;
    // fps
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; this.$('fps').textContent = `${this.fps.toFixed(0)} FPS · ${(g.prof.frameMs || 0).toFixed(1)} ms`; }
    // hit marker
    if (this.hitMarkerT > 0) { this.hitMarkerT -= dt; if (this.hitMarkerT <= 0) this.$('hitmarker').classList.remove('show'); }
    // stats
    this.statT = (this.statT || 0) - dt;
    if (this.statT <= 0) {
      this.statT = 0.25;
      const L = g.npcs.list;
      let a = 0, d = 0, z = 0, r = 0;
      for (const n of L) { if (n.lifeState === 'alive') a++; else if (n.lifeState === 'zombie' || n.lifeState === 'reanimating') z++; else d++; if (n.physMode === 'ragdoll') r++; }
      this.$('stats').innerHTML = `Subjects <b>${L.length}</b> · Alive <b>${a}</b> · <span class="d">Deceased <b>${d}</b></span> · <span class="z">Zombies <b>${z}</b></span> · Ragdolls <b>${r}</b> · Props <b>${g.props.list.length}</b>${Settings.data.zombies.reincarnation ? ' · <span class="z">REINCARNATION ON</span>' : ''}`;
      // ammo
      const t = g.weapons.current, W = Settings.data.weapons;
      let txt = '', st = '';
      if (t.isGun) { const am = g.weapons.ammo[t.id]; txt = `${am.mag}<small> / ${W.infiniteAmmo ? '∞' : am.reserve}</small>`; if (g.weapons.reloading > 0) st = 'RELOADING...'; else if (am.mag === 0) st = 'EMPTY - PRESS R'; }
      else if (t.throwable) { const am = g.weapons.ammo.grenade; txt = W.infiniteAmmo ? '∞' : `${am.mag + am.reserve}`; if (g.weapons.charging) st = 'POWER ' + Math.round(g.weapons.charge * 100) + '%'; }
      else if (t.grab) { txt = ''; st = g.weapons.grab ? 'HOLDING · RMB THROW · WHEEL DIST' : 'LMB GRAB'; }
      else if (t.move) { txt = ''; st = g.weapons.moving ? 'WHEEL/R ROTATE · RELEASE TO PLACE' : 'LMB PICK UP SUBJECT'; }
      else txt = '';
      this.$('ammoCount').innerHTML = txt; this.$('ammoStatus').textContent = st;
      if (g.npcs.selected) this.renderInspector(true);
      if (this.drawerOpen && this.tab === 'subject') this.updateSubjectList();
    }
    if (g.weapons.charging) this.$('ammoStatus').textContent = 'POWER ' + Math.round(g.weapons.charge * 100) + '%';
    this.updateLabels(dt);
    if (this.insFlash) { this.insFlash.t -= dt; if (this.insFlash.t <= 0) this.insFlash = null; }
  }
  // --- NPC labels -------------------------------------------------------------------
  updateLabels(dt) {
    const g = this.game, D = Settings.data.diagnostics;
    const show = D.labels || D.npcNames;
    const cont = this.$('labels'), cam = g.camera, W = innerWidth, H = innerHeight;
    const seen = new Set();
    const items = this._lblItems || (this._lblItems = []);
    items.length = 0;
    if (show) {
      for (const npc of g.npcs.list) {
        const d = cam.position.distanceTo(npc.root.pos);
        if (d > 45) continue;
        const p = _v1.copy(npc.boneWPos[B.head]); p.y += 0.28;
        p.project(cam);
        if (p.z > 1 || p.x < -1.2 || p.x > 1.2 || p.y < -1.2 || p.y > 1.2) continue;
        let el = this.labels.get(npc);
        if (!el) { el = this.labelPool.pop() || document.createElement('div'); el.className = 'npc-label'; cont.appendChild(el); this.labels.set(npc, el); el._key = ''; }
        seen.add(npc);
        const r = npc.reinc;
        let st = '';
        if (D.labels) {
          const life = npc.lifeState === 'alive' ? (npc.brain ? npc.brain.state : '') : npc.lifeState;
          st = `${life.toUpperCase()} · ${Math.round(npc.health)}HP`;
        }
        const cd = r.state === 'pending' ? `REINCARNATION ${Math.max(0, r.timer).toFixed(1)}s` : (r.state === 'rising' ? 'RISING...' : (npc.lifeState === 'dead' && Settings.data.zombies.reincarnation && r.state === 'ineligible' ? 'NO REINCARNATION' : ''));
        const key = npc.name + st + cd + npc.lifeState;
        if (el._key !== key) {
          el._key = key;
          el.innerHTML = `<div class="nm">${npc.idStr} ${npc.name}</div>` + (st ? `<div class="st">${st}</div>` : '') + (cd ? `<div class="cd">${cd}</div>` : '');
          el.className = 'npc-label' + (npc.lifeState === 'zombie' ? ' zombie' : (npc.lifeState === 'dead' || npc.lifeState === 'destroyed') ? ' dead' : '');
          el._w = el.offsetWidth; el._h = el.offsetHeight;
        }
        const it = items.length < (this._lblObjs || (this._lblObjs = [])).length ? this._lblObjs[items.length] : (this._lblObjs[items.length] = {});
        it.el = el; it.x = (p.x * 0.5 + 0.5) * W; it.y = (-p.y * 0.5 + 0.5) * H; it.d = d;
        it.sc = clamp(6 / Math.max(d, 1), 0.65, 1.1);
        items.push(it);
      }
      // closest subjects keep their spot; labels behind them stack upward instead of overlapping
      items.sort((a, b) => a.d - b.d);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const w = (it.el._w || 120) * it.sc, h = (it.el._h || 26) * it.sc;
        const x0 = it.x - w / 2;
        let y1 = it.y;
        for (let k = 0; k < 8; k++) {
          let hit = null;
          for (let j = 0; j < i; j++) { const o = items[j]; if (x0 < o.x1 && x0 + w > o.x0 && y1 - h < o.y1 && y1 > o.y0) { hit = o; break; } }
          if (!hit) break;
          y1 = hit.y0 - 1;
        }
        it.x0 = x0; it.x1 = x0 + w; it.y0 = y1 - h; it.y1 = y1;
        it.el.style.transform = `translate(${x0.toFixed(1)}px, ${(y1 - h).toFixed(1)}px) scale(${it.sc.toFixed(2)})`;
        const op = d2op(it.d);
        if (it.el._op !== op) { it.el._op = op; it.el.style.opacity = op; }
      }
    }
    for (const [npc, el] of this.labels) {
      if (!seen.has(npc)) { el.remove(); this.labelPool.push(el); this.labels.delete(npc); }
    }
  }
  // --- inspector --------------------------------------------------------------------
  renderInspector(lightUpdate) {
    const g = this.game, npc = g.npcs.selected, el = this.$('inspector');
    if (!npc) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const D = Settings.data.diagnostics;
    const maxD = Math.max(1, ...npc.regionDamage);
    const shapes = DIAGRAM.map((s, i) => {
      const dmg = npc.regionDamage[i], hits = npc.hitCounts[i];
      let fill = 'rgba(120,160,190,0.14)';
      if (hits > 0 && D.hitOverlay) { const k = clamp(dmg / 60, 0.15, 1); fill = `rgba(${255},${Math.round(200 - 150 * k)},${Math.round(70 - 50 * k)},${0.35 + 0.5 * k})`; }
      const flash = this.insFlash && this.insFlash.region === i && D.hitOverlay;
      const stroke = flash ? '#ffffff' : 'rgba(150,200,230,0.45)';
      const sw = flash ? 2 : 1;
      const title = `<title>${REGION_NAMES[i]}: ${hits} hit(s), ${dmg.toFixed(0)} dmg</title>`;
      return s[0] === 'c' ? `<circle cx="${s[1]}" cy="${s[2]}" r="${s[3]}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}">${title}</circle>`
        : `<rect x="${s[1]}" y="${s[2]}" width="${s[3]}" height="${s[4]}" rx="${s[5]}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}">${title}</rect>`;
    }).join('');
    const a = npc.app, r = npc.reinc;
    const hp = clamp(npc.health / npc.maxHealth, 0, 1);
    const lh = npc.lastHit;
    const reincTxt = npc.lifeState === 'dead' ? (r.state === 'pending' ? `Pending: ${Math.max(0, r.timer).toFixed(1)}s` : (r.state === 'ineligible' ? 'Ineligible: ' + r.reason : (Settings.data.zombies.reincarnation ? r.state : 'Mode off'))) : (npc.isZombie ? 'Reanimated' : '-');
    el.innerHTML = `
      <div class="ins-head"><h4>${npc.name}<small>Human ${npc.idStr} · seed ${npc.seed}</small></h4><button class="xbtn" id="insClose">&#x2715;</button></div>
      <div class="ins-body">
        <div class="ins-diagram"><svg viewBox="0 0 100 190">${shapes}<text x="50" y="189" fill="#6b7d8b" font-size="7" text-anchor="middle" font-family="monospace">FRONT</text><text x="86" y="10" fill="#6b7d8b" font-size="7" font-family="monospace">L</text><text x="10" y="10" fill="#6b7d8b" font-size="7" font-family="monospace">R</text></svg></div>
        <div class="ins-info">
          <div style="font-size:11px;color:#8597a6">HEALTH ${Math.round(npc.health)}/${npc.maxHealth}</div>
          <div class="bar"><i style="width:${(hp * 100).toFixed(0)}%"></i></div>
          <div class="kv">
            <span>Life</span><span>${npc.lifeState}</span>
            <span>Damage</span><span>${npc.damageState()}</span>
            <span>Behavior</span><span>${npc.brain ? npc.brain.state : '-'}</span>
            <span>Anim</span><span>${npc.anim.stateName}${npc.anim.upper.cur !== 'hang' ? ' + ' + npc.anim.upper.cur : ''}</span>
            <span>Physics</span><span>${npc.physicsState()}</span>
            <span>Reaction</span><span>${npc.lastReaction}</span>
            <span>Last hit</span><span>${lh ? lh.regionName + ' (' + lh.weapon + ')' : '-'}</span>
            <span>Reincarn.</span><span>${reincTxt}</span>
            ${npc.isZombie ? `<span>Target</span><span>${npc.zombieTarget ? npc.zombieTarget.idStr + ' ' + npc.zombieTarget.name : 'none'}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="kv" style="margin-top:6px">
        <span>Profile</span><span>${a.gender === 'male' ? 'Male' : 'Female'}, ${a.age}y, ${a.height.toFixed(2)}m, ${a.build}</span>
        <span>Skin/Eyes</span><span>${a.skin.name} · ${a.eyes.name}</span>
        <span>Hair</span><span>${CHAR_DATA.hairStyleNames[a.hairStyle]} · ${a.hairColor.name}${a.facialHair !== 'none' ? ' · ' + CHAR_DATA.facialHairNames[a.facialHair] : ''}</span>
        <span>Outfit</span><span>${describeOutfit(a)}</span>
      </div>
      <div class="ins-actions">
        <button class="btn" data-a="rag">Ragdoll</button><button class="btn" data-a="revive">Revive</button><button class="btn bad" data-a="kill">Kill</button>
        <button class="btn z" data-a="zombie">Zombify</button><button class="btn" data-a="edit">Edit</button><button class="btn bad" data-a="remove">Remove</button>
      </div>`;
    el.querySelector('#insClose').onclick = () => g.npcs.select(null);
    el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => this.subjectAction(b.dataset.a, npc));
  }
  subjectAction(a, npc) {
    const g = this.game;
    if (!npc || npc.removed) return;
    if (a === 'rag') { if (npc.physMode !== 'ragdoll') npc.goRagdoll('Knockdown (Sandbox)', npc.lifeState !== 'alive' && npc.lifeState !== 'zombie'); HT.log('sys', `${npc.idStr} ragdolled`); }
    else if (a === 'kill') { const r = npc.applyHit({ region: REGION.TORSO, damage: 9999, weapon: 'sandbox' }); g.hits.report(npc, REGION.TORSO, r, 'Sandbox Kill', null); }
    else if (a === 'revive') g.revive(npc);
    else if (a === 'zombie') g.zombies.makeZombieNow(npc);
    else if (a === 'remove') g.npcs.remove(npc);
    else if (a === 'edit') { this.tab = 'subject'; this.toggleDrawer(true); }
    else if (a === 'heal') { npc.health = npc.maxHealth; }
    this.sound('click');
    this.renderInspector();
  }
  // --- drawer -------------------------------------------------------------------------
  renderDrawer() {
    const body = this.$('drBody');
    this.$('drTabs').querySelectorAll('.dr-tab').forEach(b => b.classList.toggle('sel', b.dataset.tab === this.tab));
    body.innerHTML = '';
    const fn = this['tab_' + this.tab];
    if (fn) fn.call(this, body);
  }
  sec(parent, title) { const s = document.createElement('div'); s.className = 'sec'; if (title) { const h = document.createElement('h3'); h.textContent = title; s.appendChild(h); } parent.appendChild(s); return s; }
  note(p, txt) { const n = document.createElement('div'); n.className = 'note'; n.innerHTML = txt; p.appendChild(n); return n; }
  buttons(p, items) {
    const w = document.createElement('div'); w.className = 'btns';
    for (const it of items) { const b = document.createElement('button'); b.className = 'btn ' + (it.cls || ''); b.textContent = it.label; b.onclick = () => { it.fn(); this.sound('click'); }; w.appendChild(b); }
    p.appendChild(w); return w;
  }
  slider(p, label, path, min, max, step, fmtFn, onChange, getter, setter) {
    const r = document.createElement('div'); r.className = 'row';
    const val = getter ? getter() : Settings.get(path);
    r.innerHTML = `<label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${val}"><span class="val"></span>`;
    const inp = r.querySelector('input'), v = r.querySelector('.val');
    const show = (x) => { v.textContent = fmtFn ? fmtFn(x) : x; };
    show(val);
    inp.oninput = () => { const x = parseFloat(inp.value); show(x); if (setter) setter(x); else Settings.set(path, x); if (onChange) onChange(x); };
    p.appendChild(r); return inp;
  }
  toggle(p, label, path, onChange, getter, setter) {
    const r = document.createElement('div'); r.className = 'row';
    const val = getter ? getter() : Settings.get(path);
    r.innerHTML = `<label>${label}</label><label class="toggle"><input type="checkbox" ${val ? 'checked' : ''}><span></span></label>`;
    const inp = r.querySelector('input');
    inp.onchange = () => { if (setter) setter(inp.checked); else Settings.set(path, inp.checked); if (onChange) onChange(inp.checked); this.sound('toggle'); };
    p.appendChild(r); return inp;
  }
  select(p, label, options, value, onChange) {
    const r = document.createElement('div'); r.className = 'row';
    r.innerHTML = `<label>${label}</label><select>${options.map(o => `<option value="${o[0]}" ${String(o[0]) === String(value) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
    const s = r.querySelector('select'); s.onchange = () => { onChange(s.value); this.sound('click'); };
    p.appendChild(r); return s;
  }
  // ---- tabs ----
  tab_spawn(b) {
    const g = this.game, S = Settings.data.spawn;
    let s = this.sec(b, 'Quick Spawn');
    this.slider(s, 'Count', 'spawn.count', 1, 20, 1);
    this.select(s, 'Position', [['crosshair', 'At crosshair'], ['markers', 'Spawn markers'], ['random', 'Random in area'], ['circle', 'Circle'], ['line', 'Line'], ['grid', 'Grid']], S.mode, v => Settings.set('spawn.mode', v));
    this.select(s, 'Initial pose', [['idle', 'Standing idle'], ['walk', 'Walking'], ['handsUp', 'Hands up'], ['crossed', 'Arms crossed'], ['hips', 'Hands on hips'], ['ragdoll', 'Ragdoll (limp)'], ['tpose', 'Frozen (no AI)']], S.pose, v => Settings.set('spawn.pose', v));
    const sp = (gender) => { g.npcs.spawnMany(S.count, { gender, pose: S.pose }); this.sound('spawn'); };
    this.buttons(s, [{ label: 'Spawn Male', cls: 'pri', fn: () => sp('male') }, { label: 'Spawn Female', cls: 'pri', fn: () => sp('female') }, { label: 'Spawn Random', cls: 'pri', fn: () => sp('random') }]);
    s = this.sec(b, 'Custom Subject');
    const c = this.custom;
    this.select(s, 'Gender', [['random', 'Random'], ['male', 'Male'], ['female', 'Female']], c.gender, v => c.gender = v);
    this.slider(s, 'Height (0 = random)', null, 0, 2.05, 0.01, x => x < 1.4 ? 'random' : x.toFixed(2) + ' m', null, () => c.height, v => c.height = v);
    this.select(s, 'Build', [['random', 'Random']].concat(Object.keys(CHAR_DATA.builds).map(k => [k, k[0].toUpperCase() + k.slice(1)])), c.build, v => c.build = v);
    this.select(s, 'Skin tone', [[-1, 'Random']].concat(CHAR_DATA.skinTones.map((t, i) => [i, t.name])), c.skin, v => c.skin = +v);
    const styles = Object.keys(CHAR_DATA.hairStyleNames);
    this.select(s, 'Hairstyle', [['random', 'Random']].concat(styles.map(k => [k, CHAR_DATA.hairStyleNames[k]])), c.hairStyle, v => c.hairStyle = v);
    this.select(s, 'Hair color', [[-1, 'Random']].concat(CHAR_DATA.hairColors.map((t, i) => [i, t.name])), c.hairColor, v => c.hairColor = +v);
    this.select(s, 'Eye color', [[-1, 'Random']].concat(CHAR_DATA.eyeColors.map((t, i) => [i, t.name])), c.eyes, v => c.eyes = +v);
    this.select(s, 'Facial hair', [['random', 'Random']].concat(Object.keys(CHAR_DATA.facialHairNames).map(k => [k, CHAR_DATA.facialHairNames[k]])), c.facialHair, v => c.facialHair = v);
    this.select(s, 'Outfit', [['random', 'Random']].concat(OUTFIT_TEMPLATES.map(t => [t.name, t.name + (t.female ? ' (F)' : '')])), c.outfit, v => c.outfit = v);
    const seedRow = document.createElement('div'); seedRow.className = 'row'; seedRow.innerHTML = '<label>Seed (optional)</label><input type="number" placeholder="random">';
    const seedInp = seedRow.querySelector('input'); seedInp.value = c.seed; seedInp.oninput = () => c.seed = seedInp.value; s.appendChild(seedRow);
    this.buttons(s, [{ label: 'Spawn Custom', cls: 'pri', fn: () => { g.npcs.spawnMany(S.count, { gender: c.gender, pose: S.pose, seed: c.seed !== '' ? (+c.seed) : undefined, overrides: this.customOverrides() }); this.sound('spawn'); } }]);
    s = this.sec(b, 'Adult Height Ranges');
    this.slider(s, 'Male min', 'spawn.heightMinM', 1.5, 2.1, 0.01, x => x.toFixed(2) + ' m');
    this.slider(s, 'Male max', 'spawn.heightMaxM', 1.5, 2.1, 0.01, x => x.toFixed(2) + ' m');
    this.slider(s, 'Female min', 'spawn.heightMinF', 1.4, 2.0, 0.01, x => x.toFixed(2) + ' m');
    this.slider(s, 'Female max', 'spawn.heightMaxF', 1.4, 2.0, 0.01, x => x.toFixed(2) + ' m');
    s = this.sec(b, 'Props');
    const spawnProp = (t) => { const p = g.player.groundTarget(6); p.y += 1.2; g.props.spawn(t, p); this.sound('spawn'); };
    this.buttons(s, [{ label: 'Crate', fn: () => spawnProp('crate') }, { label: 'Big Crate', fn: () => spawnProp('bigcrate') }, { label: 'Ball', fn: () => spawnProp('ball') }, { label: 'Barrel', fn: () => spawnProp('barrel') }, { label: 'Clear Props', cls: 'bad', fn: () => g.props.clear() }]);
    s = this.sec(b, 'Remove');
    this.buttons(s, [{ label: 'Remove Selected', cls: 'bad', fn: () => g.npcs.selected && g.npcs.remove(g.npcs.selected) }, { label: 'Remove Deceased', cls: 'bad', fn: () => g.npcs.removeDead() }, { label: 'Remove All', cls: 'bad', fn: () => g.npcs.removeAll() }]);
  }
  customOverrides(c = this.custom) {
    const o = {};
    if (c.height >= 1.4) o.height = c.height;
    if (c.build !== 'random') o.build = c.build;
    if (c.skin >= 0) o.skin = c.skin;
    if (c.hairStyle !== 'random') o.hairStyle = c.hairStyle;
    if (c.hairColor >= 0) o.hairColor = c.hairColor;
    if (c.eyes >= 0) o.eyes = c.eyes;
    if (c.facialHair !== 'random') o.facialHair = c.facialHair;
    if (c.outfit !== 'random') o.outfit = c.outfit;
    return o;
  }
  tab_subject(b) {
    const g = this.game, npc = g.npcs.selected;
    let s = this.sec(b, 'Subjects');
    this.note(s, 'Aim at a subject and press <b>F</b> (or tap SELECT) to select. Click a row below to select.');
    this.listEl = document.createElement('div'); this.listEl.style.cssText = 'max-height:170px;overflow-y:auto;font-family:var(--mono);font-size:11px;border:1px solid var(--line);border-radius:8px;padding:4px';
    s.appendChild(this.listEl); this.updateSubjectList(true);
    if (!npc) return;
    s = this.sec(b, 'Edit ' + npc.idStr + ' ' + npc.name);
    const a = npc.app;
    const e = this.editState && this.editState.npc === npc ? this.editState : (this.editState = { npc, gender: a.gender, height: a.height, build: a.build, skin: CHAR_DATA.skinTones.indexOf(a.skin), hairStyle: a.hairStyle, hairColor: CHAR_DATA.hairColors.indexOf(a.hairColor), eyes: CHAR_DATA.eyeColors.indexOf(a.eyes), facialHair: a.facialHair, outfit: a.outfitName });
    this.select(s, 'Gender', [['male', 'Male'], ['female', 'Female']], e.gender, v => e.gender = v);
    this.slider(s, 'Height', null, 1.4, 2.1, 0.01, x => x.toFixed(2) + ' m', null, () => e.height, v => e.height = v);
    this.select(s, 'Build', Object.keys(CHAR_DATA.builds).map(k => [k, k]), e.build, v => e.build = v);
    this.select(s, 'Skin tone', CHAR_DATA.skinTones.map((t, i) => [i, t.name]), e.skin, v => e.skin = +v);
    this.select(s, 'Hairstyle', Object.keys(CHAR_DATA.hairStyleNames).map(k => [k, CHAR_DATA.hairStyleNames[k]]), e.hairStyle, v => e.hairStyle = v);
    this.select(s, 'Hair color', CHAR_DATA.hairColors.map((t, i) => [i, t.name]), e.hairColor, v => e.hairColor = +v);
    this.select(s, 'Eye color', CHAR_DATA.eyeColors.map((t, i) => [i, t.name]), e.eyes, v => e.eyes = +v);
    this.select(s, 'Facial hair', Object.keys(CHAR_DATA.facialHairNames).map(k => [k, CHAR_DATA.facialHairNames[k]]), e.facialHair, v => e.facialHair = v);
    this.select(s, 'Outfit', OUTFIT_TEMPLATES.map(t => [t.name, t.name]), e.outfit, v => e.outfit = v);
    const apply = (newSeed) => {
      const ov = { gender: e.gender, height: e.height, build: e.build, skin: e.skin, hairStyle: e.hairStyle, hairColor: e.hairColor, eyes: e.eyes, facialHair: e.facialHair, outfit: e.outfit };
      if (newSeed) { ov.newSeed = true; delete ov.outfit; }
      const n2 = g.npcs.regenerate(npc, ov); this.editState = null; if (n2) HT.log('sys', `Edited appearance of ${n2.idStr} ${n2.name}`); this.renderDrawer();
    };
    this.buttons(s, [{ label: 'Apply Changes', cls: 'pri', fn: () => apply(false) }, { label: 'Randomize Look', fn: () => apply(true) }]);
    s = this.sec(b, 'Transform & State');
    this.slider(s, 'Facing', null, -180, 180, 1, x => x + '°', null, () => Math.round(wrapAngle(npc.root.yaw) / DEG), v => { if (npc.physMode === 'anim') npc.root.yaw = v * DEG; });
    this.toggle(s, 'Freeze AI (this subject)', null, null, () => !!(npc.brain && npc.brain.frozen), v => { if (npc.brain) npc.brain.frozen = v; });
    this.select(s, 'Hold pose', [['', 'None']].concat(Object.keys(ARM_POSES).filter(k => k !== 'hang').map(k => [k, k])), npc.brain && npc.brain.holdPose || '', v => { if (npc.brain) { npc.brain.holdPose = v || null; npc.anim.setUpper(v || 'hang'); } });
    this.buttons(s, [
      { label: 'Ragdoll', fn: () => this.subjectAction('rag', npc) }, { label: 'Revive', fn: () => this.subjectAction('revive', npc) },
      { label: 'Heal', fn: () => this.subjectAction('heal', npc) }, { label: 'Kill', cls: 'bad', fn: () => this.subjectAction('kill', npc) },
      { label: 'Zombify', cls: 'z', fn: () => this.subjectAction('zombie', npc) }, { label: 'Look At', fn: () => g.focusOn(npc) },
      { label: 'Bring Here', fn: () => { const p = g.player.groundTarget(3); if (npc.physMode === 'anim') npc.teleport(p, Math.atan2(g.camera.position.x - p.x, g.camera.position.z - p.z)); } },
      { label: 'Remove', cls: 'bad', fn: () => this.subjectAction('remove', npc) }
    ]);
  }
  updateSubjectList(force) {
    if (!this.listEl || !this.listEl.isConnected) return;
    const g = this.game;
    const html = g.npcs.list.map(n => `<div data-id="${n.id}" style="padding:3px 6px;border-radius:5px;cursor:pointer;${n === g.npcs.selected ? 'background:rgba(79,209,255,0.18);color:#fff' : ''}">${n.idStr} ${n.name} <span style="color:${n.lifeState === 'zombie' ? '#9cd65a' : n.lifeState === 'alive' ? '#8597a6' : '#ff8a8d'}">${n.lifeState}</span></div>`).join('') || '<div class="note">No subjects.</div>';
    if (force || html !== this._listHtml) {
      this._listHtml = html; this.listEl.innerHTML = html;
      this.listEl.querySelectorAll('[data-id]').forEach(d => d.onclick = () => { const n = g.npcs.list.find(x => x.id === +d.dataset.id); if (n) g.npcs.select(n); });
    }
  }
  tab_weapons(b) {
    const g = this.game, W = g.weapons;
    let s = this.sec(b, 'Equip');
    this.buttons(s, W.tools.map((t, i) => ({ label: t.name, cls: W.current === t ? 'pri' : '', fn: () => { W.select(i); this.renderDrawer(); } })));
    s = this.sec(b, 'Availability');
    for (const t of W.tools) this.toggle(s, t.name, 'weapons.enabled.' + t.id, () => this.updateTool(W.current));
    s = this.sec(b, 'Ammunition & Firing');
    this.toggle(s, 'Infinite ammo', 'weapons.infiniteAmmo');
    this.toggle(s, 'Auto reload', 'weapons.autoReload');
    this.toggle(s, 'Pistol full-auto', 'weapons.pistolAuto');
    this.slider(s, 'Pistol magazine', 'weapons.pistolMag', 1, 50, 1);
    this.slider(s, 'Sniper magazine', 'weapons.sniperMag', 1, 20, 1);
    this.slider(s, 'Reserve magazines', 'weapons.reserveMags', 0, 20, 1);
    this.buttons(s, [{ label: 'Refill Ammo', cls: 'pri', fn: () => { W.resetAmmo(); HT.toast('Ammunition refilled'); } }]);
    s = this.sec(b, 'Simulated Damage');
    this.toggle(s, 'Simulated damage', 'weapons.simulatedDamage');
    this.slider(s, 'Damage multiplier', 'weapons.damageScale', 0, 4, 0.05, x => x.toFixed(2) + 'x');
    this.slider(s, 'Grenade fuse', 'weapons.grenadeFuse', 0.5, 8, 0.1, x => x.toFixed(1) + ' s');
    this.slider(s, 'Grenade blast radius', 'weapons.grenadeRadius', 2, 16, 0.5, x => x.toFixed(1) + ' m');
    this.note(s, 'Damage is non-graphic: hits produce dust/fabric puffs, diagnostic labels and physical reactions only.');
  }
  tab_physics(b) {
    const g = this.game;
    let s = this.sec(b, 'Simulation');
    this.buttons(s, [
      { label: Settings.data.physics.paused ? 'Resume Physics' : 'Pause Physics', cls: 'pri', fn: () => { g.togglePause(); this.renderDrawer(); } },
      { label: 'Step (1 frame)', fn: () => g.stepOnce() },
      { label: 'Reset Physics', cls: 'bad', fn: () => g.resetPhysics() },
      { label: 'Wake All', fn: () => g.physics.wakeAll() }
    ]);
    this.slider(s, 'Time scale', null, 0.05, 1, 0.05, x => x.toFixed(2) + 'x', null, () => g.timeScale, v => g.timeScale = v);
    s = this.sec(b, 'Parameters');
    this.slider(s, 'Gravity', 'physics.gravity', 0, 25, 0.1, x => x.toFixed(1) + ' m/s²', v => g.applyPhysicsSettings());
    this.slider(s, 'Force strength', 'physics.forceScale', 0.1, 5, 0.05, x => x.toFixed(2) + 'x');
    this.slider(s, 'Mass multiplier', 'physics.massScale', 0.25, 4, 0.05, x => x.toFixed(2) + 'x', v => g.applyPhysicsSettings(true));
    this.slider(s, 'Friction', 'physics.friction', 0, 1.5, 0.05, x => x.toFixed(2), v => g.applyPhysicsSettings());
    this.slider(s, 'Bounciness', 'physics.bounciness', 0, 0.9, 0.05, x => x.toFixed(2), v => g.applyPhysicsSettings());
    this.slider(s, 'Muscle tone (joint damping)', 'physics.muscleTone', 0, 1, 0.05, x => x.toFixed(2));
    this.slider(s, 'Solver substeps', 'physics.substeps', 2, 16, 1, null, v => g.applyPhysicsSettings());
    s = this.sec(b, 'Collisions');
    this.toggle(s, 'Character vs character', 'physics.npcCollisions', () => g.applyPhysicsSettings());
    this.toggle(s, 'Ragdoll self-collision', 'physics.selfCollisions', () => g.applyPhysicsSettings());
    this.toggle(s, 'Props vs characters', 'physics.propCollisions', () => g.applyPhysicsSettings());
    this.toggle(s, 'Show colliders', 'diagnostics.colliders');
    this.note(s, 'Deterministic fixed 60 Hz XPBD solver: identical inputs produce identical ragdoll motion.');
  }
  tab_ai(b) {
    const g = this.game, Z = Settings.data.zombies;
    let s = this.sec(b, 'NPC AI');
    this.toggle(s, 'NPC AI enabled', 'ai.enabled');
    this.toggle(s, 'Reactions (flinch, protect, hands up)', 'ai.reactions');
    this.toggle(s, 'Flee from danger', 'ai.flee');
    this.toggle(s, 'Wander', 'ai.wander');
    this.toggle(s, 'Look at things', 'ai.lookAt');
    this.slider(s, 'Wander rate', 'ai.wanderRate', 0, 1, 0.05, x => x.toFixed(2));
    this.slider(s, 'Reaction time variance', 'ai.reactionVariance', 0.2, 3, 0.1, x => x.toFixed(1) + 'x');
    s = this.sec(b, 'Reincarnation Mode');
    this.toggle(s, 'Reincarnation Mode', 'zombies.reincarnation', (v) => { HT.log('zombie', 'Reincarnation Mode ' + (v ? 'ENABLED' : 'DISABLED')); HT.toast('Reincarnation Mode ' + (v ? 'enabled' : 'disabled'), 'z'); });
    this.select(s, 'Delay', [['immediate', 'Immediate'], ['short', 'Short (5s)'], ['medium', 'Medium (15s)'], ['long', 'Long (45s)'], ['custom', 'Custom']], Z.delayPreset, v => { Settings.set('zombies.delayPreset', v); this.renderDrawer(); });
    if (Z.delayPreset === 'custom') {
      const inp = this.slider(s, 'Custom delay', 'zombies.delay', 0, 120, 1, x => x + ' s');
      const r = document.createElement('div'); r.className = 'row'; r.innerHTML = '<label>Exact seconds</label><input type="number" min="0" max="600" step="0.5">';
      const ni = r.querySelector('input'); ni.value = Z.delay; ni.onchange = () => { const v = clamp(parseFloat(ni.value) || 0, 0, 600); Settings.set('zombies.delay', v); inp.value = v; }; s.appendChild(r);
    }
    this.toggle(s, 'Critical head trauma prevents reincarnation', 'zombies.headTraumaPrevents');
    this.buttons(s, [{ label: 'Reanimate Dead Now', cls: 'z', fn: () => { if (!Z.reincarnation) Settings.set('zombies.reincarnation', true); g.zombies.reanimateAllNow(); this.renderDrawer(); } }, { label: 'Cancel Pending', fn: () => g.zombies.cancelAll() }]);
    s = this.sec(b, 'Zombie Behavior');
    this.toggle(s, 'Zombie aggression', 'zombies.aggression');
    this.toggle(s, 'Target living NPCs', 'zombies.targetNPCs');
    this.slider(s, 'Detection distance', 'zombies.detection', 2, 40, 0.5, x => x.toFixed(1) + ' m');
    this.slider(s, 'Movement speed', 'zombies.speed', 0.3, 2.5, 0.05, x => x.toFixed(2) + 'x');
    this.select(s, 'Target selection', [['nearest', 'Nearest'], ['random', 'Random'], ['weakest', 'Weakest (lowest health)']], Z.targetMode, v => Settings.set('zombies.targetMode', v));
    this.slider(s, 'Attack damage', 'zombies.attackDamage', 0, 60, 1);
    this.toggle(s, 'Vocalizations', 'zombies.vocalize');
    this.note(s, 'You are an invisible spectator: zombies never target the player.');
    this.buttons(s, [{ label: 'Neutralize All Zombies', cls: 'bad', fn: () => { for (const n of g.npcs.list) if (n.lifeState === 'zombie') n.applyHit({ region: REGION.HEAD, damage: 9999, weapon: 'sandbox' }); } }]);
  }
  tab_world(b) {
    const g = this.game, R = Settings.data.environment.room, F = Settings.data.environment.field;
    let s = this.sec(b, 'Environment');
    const cur = g.env.current.kind;
    this.buttons(s, [{ label: 'White Testing Room', cls: cur === 'room' ? 'pri' : '', fn: () => g.switchEnvironment('room') }, { label: 'Sunny Grassy Field', cls: cur === 'field' ? 'pri' : '', fn: () => g.switchEnvironment('field') }]);
    s = this.sec(b, 'White Testing Room');
    this.slider(s, 'Width', 'environment.room.width', 12, 80, 1, x => x + ' m');
    this.slider(s, 'Depth', 'environment.room.depth', 12, 80, 1, x => x + ' m');
    this.slider(s, 'Height', 'environment.room.height', 4, 20, 0.5, x => x + ' m');
    this.slider(s, 'Light intensity', 'environment.room.light', 0.1, 2, 0.05, x => x.toFixed(2), () => cur === 'room' && g.env.current.applyLighting());
    this.slider(s, 'Light color temp', 'environment.room.colorTemp', 2700, 9000, 100, x => x + ' K', () => cur === 'room' && g.env.current.applyLighting());
    this.toggle(s, 'Measurement grid', 'environment.room.grid', v => cur === 'room' && g.env.current.setGrid(v));
    this.toggle(s, 'Spawn markers', 'environment.room.markers', v => cur === 'room' && g.env.current.setMarkers(v));
    this.buttons(s, [{ label: 'Apply Dimensions', cls: 'pri', fn: () => g.switchEnvironment('room', true) }, {
      label: 'Reset Environment', fn: () => {
        Object.assign(Settings.data.environment.room, deepClone(DEFAULT_SETTINGS.environment.room)); Settings.save();
        if (g.env.current.kind === 'room') g.switchEnvironment('room', true); else { Object.assign(Settings.data.environment.field, deepClone(DEFAULT_SETTINGS.environment.field)); g.switchEnvironment('field', true); }
        this.renderDrawer();
      }
    }]);
    s = this.sec(b, 'Sunny Grassy Field');
    this.slider(s, 'Time of day', 'environment.field.timeOfDay', 0, 24, 0.25, x => { const h = Math.floor(x), m = Math.round((x - h) * 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }, () => cur === 'field' && g.env.current.applyTimeWeather());
    this.select(s, 'Weather', [['clear', 'Clear'], ['cloudy', 'Cloudy'], ['overcast', 'Overcast'], ['rain', 'Rain'], ['fog', 'Fog']], F.weather, v => { Settings.set('environment.field.weather', v); if (cur === 'field') { g.env.current.applyTimeWeather(); g.audio.startAmbience(); } });
    this.slider(s, 'Wind', 'environment.field.wind', 0, 1, 0.05, x => x.toFixed(2));
    s = this.sec(b, 'Scene');
    this.buttons(s, [{ label: 'Reset Entire Scene', cls: 'bad', fn: () => g.resetScene() }]);
  }
  tab_graphics(b) {
    const g = this.game, G = Settings.data.graphics;
    let s = this.sec(b, 'Preset');
    this.buttons(s, ['low', 'high', 'ultra'].map(p => ({ label: p.toUpperCase(), cls: G.preset === p ? 'pri' : '', fn: () => { g.applyPreset(p); this.renderDrawer(); } })));
    s = this.sec(b, 'Quality');
    this.slider(s, 'Resolution scale', 'graphics.resolutionScale', 0.4, 1.0, 0.05, x => Math.round(x * 100) + '%', () => { Settings.set('graphics.preset', 'custom', true); g.resize(); });
    this.select(s, 'Shadow quality', [['off', 'Off'], ['low', 'Low'], ['high', 'High'], ['ultra', 'Ultra']], G.shadowQuality, v => { Settings.set('graphics.shadowQuality', v); Settings.set('graphics.preset', 'custom', true); g.applyShadows(); });
    this.select(s, 'Texture quality', [['low', 'Low'], ['high', 'High'], ['ultra', 'Ultra']], G.textureQuality, v => { Settings.set('graphics.textureQuality', v); Settings.set('graphics.preset', 'custom', true); Tex.cache.clear(); g.switchEnvironment(g.env.current.kind, true); });
    this.select(s, 'Character detail', [['low', 'Low'], ['high', 'High'], ['ultra', 'Ultra']], G.characterDetail, v => { Settings.set('graphics.characterDetail', v); Settings.set('graphics.preset', 'custom', true); HT.toast('Applies to newly spawned subjects'); });
    this.select(s, 'Frame rate cap', [[30, '30 FPS'], [60, '60 FPS'], [0, 'Unlimited']], G.fpsCap, v => Settings.set('graphics.fpsCap', +v));
    this.toggle(s, 'Ambient occlusion (SSAO)', 'graphics.ssao', () => g.post && g.post.setEnabled(Settings.data.graphics.ssao));
    this.toggle(s, 'Show FPS', 'graphics.showFps');
    this.slider(s, 'Field of view', 'controls.fov', 50, 100, 1, x => x + '°');
    this.note(s, 'Anti-aliasing: ' + (g.renderer.getContextAttributes().antialias ? 'MSAA on' : 'off') + ' (changes after reload). Settings are saved automatically.');
    s = this.sec(b, 'Controls');
    this.slider(s, 'Look sensitivity', 'controls.sensitivity', 0.2, 3, 0.05, x => x.toFixed(2));
    this.toggle(s, 'Invert Y', 'controls.invertY');
    this.select(s, 'Touch controls', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], Settings.data.controls.touch, v => Settings.set('controls.touch', v));
    this.toggle(s, 'Show control hints', 'ui.hints', () => this.updatePlayHint());
  }
  tab_audio(b) {
    const g = this.game;
    const s = this.sec(b, 'Volume');
    const ap = () => g.audio.applyVolumes();
    this.slider(s, 'Master', 'audio.master', 0, 1, 0.01, x => Math.round(x * 100) + '%', ap);
    this.slider(s, 'Effects', 'audio.effects', 0, 1, 0.01, x => Math.round(x * 100) + '%', ap);
    this.slider(s, 'Ambience', 'audio.ambience', 0, 1, 0.01, x => Math.round(x * 100) + '%', ap);
    this.slider(s, 'Interface', 'audio.ui', 0, 1, 0.01, x => Math.round(x * 100) + '%', ap);
    this.toggle(s, 'Mute all', 'audio.muted', ap);
    this.note(s, g.audio.unlocked ? 'Audio is active.' : 'Audio starts after your first click or tap (browser policy).');
    this.buttons(s, [{ label: 'Test Sound', fn: () => g.audio.play('pistol', { gain: 0.8 }) }]);
  }
  tab_debug(b) {
    const g = this.game;
    let s = this.sec(b, 'Diagnostics');
    this.toggle(s, 'Diagnostic hit labels', 'diagnostics.labels');
    this.toggle(s, 'NPC name tags', 'diagnostics.npcNames');
    this.toggle(s, 'Hit-location overlay (inspector)', 'diagnostics.hitOverlay', () => this.renderInspector());
    this.toggle(s, 'Debug panel', 'diagnostics.debugPanel');
    this.toggle(s, 'Event log', 'diagnostics.eventLog');
    this.toggle(s, 'Show colliders', 'diagnostics.colliders');
    this.buttons(s, [{ label: 'Copy Event Log', fn: () => g.diag.copyLog() }, { label: 'Clear Event Log', fn: () => g.diag.clearLog() }]);
    s = this.sec(b, 'Maintenance');
    this.buttons(s, [{ label: 'Reset All Settings', cls: 'bad', fn: () => { if (confirm('Reset all saved settings to defaults?')) { Settings.resetAll(); g.applyPreset(Settings.data.graphics.preset); this.renderDrawer(); } } }]);
    this.note(s, `Settings storage: ${Settings.storageOk ? 'available (saved between sessions)' : 'unavailable (private mode?)'}<br>Renderer: WebGL${g.renderer.capabilities.isWebGL2 ? '2' : '1'} · max texture ${g.renderer.capabilities.maxTextureSize}`);
  }
}
HT.UI = UI;
