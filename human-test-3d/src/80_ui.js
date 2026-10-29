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
  'Tap a weapon on the bar (or press <b>1-6</b>) to equip it: Pistol, Sniper, Knife, Grenade, Grab, Move.',
  'Hold <b>right mouse</b> (or AIM) to aim. A sniper headshot destroys the head.',
  'Open the <b>Sandbox</b> menu to spawn a man or a woman. Every body and height is random.',
  'Zombies grab and bite. Survivors who break free are infected and will turn.',
  'Zombies kneel and feed on bodies. A destroyed head stops a body from rising.',
  'Shoot limbs to sever them. A subject who loses a leg can only crawl.',
  'Grenades tear bodies apart at close range. Hold the throw button longer to throw farther.',
  'Gore level, graphics, audio and controls are in <b>Settings</b>. Choices are saved.',
  'Switch between the <b>White Testing Room</b> and the <b>Sunny Grassy Field</b> in the Sandbox menu.',
  'On phones: left thumb moves, right thumb looks, tap the weapon bar to switch weapons.'
];

const d2op = (d) => d <= 22 ? '1' : (Math.round(clamp(1 - (d - 22) / 26, 0.35, 1) * 10) / 10).toFixed(1);
class UI {
  constructor(game) {
    this.game = game; this.drawerOpen = false; this.mode = 'sandbox'; this.setTab = 'gore'; this.labels = new Map(); this.labelPool = [];
    this.$ = (id) => document.getElementById(id);
    this.hitMarkerT = 0; this.fpsT = 0; this.frames = 0; this.fps = 60;
  }
  build() {
    const $ = this.$;
    // weapon bar: tap / click to equip
    const tb = $('toolbar'); tb.innerHTML = '';
    this.slots = [];
    this.game.weapons.tools.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'slot';
      b.innerHTML = `<span class="key">${i + 1}</span>${TOOL_ICONS[t.id]}<span class="nm">${t.short}</span>`;
      const equip = (e) => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); this.game.audio.unlock(); this.game.weapons.select(i); };
      b.addEventListener('touchstart', equip, { passive: false });
      b.addEventListener('click', equip);
      tb.appendChild(b); this.slots.push(b);
    });
    $('btnSandbox').addEventListener('click', () => this.toggleDrawer(this.drawerOpen && this.mode === 'sandbox' ? false : true, 'sandbox'));
    $('btnSettings').addEventListener('click', () => this.toggleDrawer(this.drawerOpen && this.mode === 'settings' ? false : true, 'settings'));
    $('drClose').addEventListener('click', () => this.toggleDrawer(false));
    $('drModeSandbox').addEventListener('click', () => { this.mode = 'sandbox'; this.renderDrawer(); this.sound('click'); });
    $('drModeSettings').addEventListener('click', () => { this.mode = 'settings'; this.renderDrawer(); this.sound('click'); });
    $('elClear').addEventListener('click', () => { this.game.diag.clearLog(); });
    $('elHide').addEventListener('click', () => { Settings.set('diagnostics.eventLog', false); });
    this.mode = 'sandbox'; this.setTab = 'gore';
    // stop pointer events from panels reaching the canvas / touch zones
    for (const id of ['drawer', 'inspector', 'debugPanel', 'eventLog', 'topbar', 'toolbar']) {
      const el = $(id);
      el.addEventListener('mousedown', (e) => e.stopPropagation());
      el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
      el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    }
    Events.on('settings', (e) => this.onSetting(e));
    Events.on('select', () => this.renderInspector());
    Events.on('tool', (t) => { this.updateTool(t); if (this.drawerOpen && this.mode === 'sandbox') this.renderDrawer(); });
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
      ? '<kbd>Right-drag</kbd> look &nbsp; <kbd>WASD</kbd> move &nbsp; <kbd>Left click</kbd> use weapon &nbsp; <kbd>Tab</kbd> sandbox &nbsp; <kbd>O</kbd> settings'
      : '<b>Click to look around</b><br><kbd>WASD</kbd> move &nbsp; <kbd>Space</kbd>/<kbd>C</kbd> up/down &nbsp; <kbd>Shift</kbd> fast &nbsp; <kbd>1-6</kbd> weapons<br><kbd>LMB</kbd> fire &nbsp; <kbd>RMB</kbd> aim &nbsp; <kbd>R</kbd> reload &nbsp; <kbd>Tab</kbd> sandbox &nbsp; <kbd>O</kbd> settings &nbsp; <kbd>Esc</kbd> release mouse';
  }
  toggleDrawer(v, mode) {
    if (mode) this.mode = mode;
    this.drawerOpen = v != null ? v : !this.drawerOpen;
    this.$('drawer').classList.toggle('open', this.drawerOpen);
    this.$('btnSandbox').classList.toggle('on', this.drawerOpen && this.mode === 'sandbox');
    this.$('btnSettings').classList.toggle('on', this.drawerOpen && this.mode === 'settings');
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
        <button class="btn z" data-a="zombie">Zombify</button><button class="btn bad" data-a="remove">Remove</button>
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
    else if (a === 'heal') { npc.health = npc.maxHealth; }
    this.sound('click');
    this.renderInspector();
  }
  // --- drawer: Sandbox menu / Settings -------------------------------------------------
  renderDrawer() {
    const body = this.$('drBody'), tabs = this.$('drTabs');
    this.$('drModeSandbox').classList.toggle('sel', this.mode !== 'settings');
    this.$('drModeSettings').classList.toggle('sel', this.mode === 'settings');
    this.$('btnSandbox').classList.toggle('on', this.drawerOpen && this.mode === 'sandbox');
    this.$('btnSettings').classList.toggle('on', this.drawerOpen && this.mode === 'settings');
    const key = this.mode + ':' + this.setTab;
    if (this._drKey !== key) { body.scrollTop = 0; this._drKey = key; }
    body.innerHTML = ''; tabs.innerHTML = '';
    if (this.mode !== 'settings') { tabs.classList.add('hidden'); this.renderSandbox(body); return; }
    tabs.classList.remove('hidden');
    for (const [id, name] of [['gore', 'Gore'], ['graphics', 'Graphics'], ['audio', 'Audio'], ['controls', 'Controls'], ['gameplay', 'Gameplay'], ['interface', 'Interface']]) {
      const b = document.createElement('button'); b.className = 'dr-tab' + (this.setTab === id ? ' sel' : ''); b.textContent = name;
      b.onclick = () => { this.setTab = id; this.renderDrawer(); this.sound('click'); };
      tabs.appendChild(b);
    }
    const fn = this['set_' + this.setTab];
    if (fn) fn.call(this, body);
  }
  sec(parent, title) { const s = document.createElement('div'); s.className = 'sec'; if (title) { const h = document.createElement('h3'); h.textContent = title; s.appendChild(h); } parent.appendChild(s); return s; }
  note(p, txt) { const n = document.createElement('div'); n.className = 'note'; n.innerHTML = txt; p.appendChild(n); return n; }
  buttons(p, items, cls) {
    const w = document.createElement('div'); w.className = cls || 'btns';
    for (const it of items) { const b = document.createElement('button'); b.className = 'btn ' + (it.cls || ''); b.innerHTML = it.label; b.onclick = () => { it.fn(); this.sound('click'); }; w.appendChild(b); }
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
  // ---- Sandbox menu ----
  renderSandbox(b) {
    const g = this.game, W = g.weapons, Z = Settings.data.zombies;
    let s = this.sec(b, 'Spawn');
    const sp = (gender) => { g.npcs.spawnMany(1, { gender, pose: 'idle', mode: 'crosshair' }); this.sound('spawn'); };
    this.buttons(s, [{ label: '&#9794; Spawn Male', cls: 'pri', fn: () => sp('male') }, { label: '&#9792; Spawn Female', cls: 'pri', fn: () => sp('female') }], 'spawnbtns');
    this.note(s, 'Each person gets a random body, height, face and outfit. They appear where you are aiming.');
    s = this.sec(b, 'Weapons');
    const cards = document.createElement('div'); cards.className = 'wcards';
    const desc = { pistol: 'Semi-auto, 15 rounds', sniper: 'Scoped, blows limbs off', knife: 'Slash and cut', grenade: 'Hold to throw farther', hand: 'Grab and throw bodies', move: 'Pick up and place' };
    W.tools.forEach((t, i) => {
      if (!W.enabled(t)) return;
      const c = document.createElement('button'); c.className = 'wcard' + (W.current === t ? ' sel' : '');
      c.innerHTML = `${TOOL_ICONS[t.id]}<b>${t.name}</b><small>${desc[t.id] || ''}</small>`;
      c.onclick = () => { W.select(i); this.toggleDrawer(false); };
      cards.appendChild(c);
    });
    s.appendChild(cards);
    s = this.sec(b, 'Zombies');
    this.toggle(s, 'Zombie mode (the dead rise)', 'zombies.reincarnation', (v) => HT.toast('Zombie mode ' + (v ? 'on' : 'off'), 'z'));
    this.toggle(s, 'Bites infect and turn people', 'zombies.infection');
    this.toggle(s, 'Zombies eat bodies', 'zombies.feeding');
    this.buttons(s, [{ label: 'Start Outbreak', cls: 'z', fn: () => { this.startOutbreak(); this.toggleDrawer(false); } }, { label: 'Kill All Zombies', cls: 'bad', fn: () => { for (const n of g.npcs.list) if (n.lifeState === 'zombie' || n.lifeState === 'reanimating') { n.criticalHead = true; n.applyHit({ region: REGION.HEAD, damage: 9999, weapon: 'sandbox' }); } } }]);
    s = this.sec(b, 'World');
    const cur = g.env.current.kind;
    this.buttons(s, [{ label: 'White Room', cls: cur === 'room' ? 'pri' : '', fn: () => { g.switchEnvironment('room'); this.renderDrawer(); } }, { label: 'Grassy Field', cls: cur === 'field' ? 'pri' : '', fn: () => { g.switchEnvironment('field'); this.renderDrawer(); } }]);
    if (cur === 'field') {
      const F = Settings.data.environment.field;
      this.slider(s, 'Time of day', 'environment.field.timeOfDay', 0, 24, 0.25, x => { const h = Math.floor(x), m = Math.round((x - h) * 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }, () => g.env.current.applyTimeWeather());
      this.select(s, 'Weather', [['clear', 'Clear'], ['cloudy', 'Cloudy'], ['overcast', 'Overcast'], ['rain', 'Rain'], ['fog', 'Fog']], F.weather, v => { Settings.set('environment.field.weather', v); g.env.current.applyTimeWeather(); g.audio.startAmbience(); });
    }
    s = this.sec(b, 'Scene');
    this.buttons(s, [
      { label: Settings.data.physics.paused ? 'Resume' : 'Pause', fn: () => { g.togglePause(); this.renderDrawer(); } },
      { label: g.timeScale < 1 ? 'Normal Speed' : 'Slow Motion', fn: () => { g.timeScale = g.timeScale < 1 ? 1 : 0.25; this.renderDrawer(); } },
      { label: 'Clear Bodies', fn: () => { g.npcs.removeDead(); g.gore.clear(); } },
      { label: 'Remove Everyone', cls: 'bad', fn: () => { g.npcs.removeAll(); g.gore.clear(); } },
      { label: 'Reset Scene', cls: 'bad', fn: () => { g.resetScene(); this.renderDrawer(); } }
    ]);
  }
  // turn the subject under the crosshair (or a random survivor) into the first zombie
  startOutbreak() {
    const g = this.game;
    let n = null;
    const h = g.weapons.pickNPC(60);
    if (h && h.npc.lifeState === 'alive') n = h.npc;
    if (!n) { const alive = g.npcs.list.filter(x => x.lifeState === 'alive'); if (alive.length) n = alive[Math.floor(Math.random() * alive.length)]; }
    if (!n) { HT.toast('Spawn someone first'); return; }
    n.infection = { t: 0, dur: 2.5, src: 'outbreak' };
    if (!Settings.data.zombies.infection) Settings.set('zombies.infection', true);
    HT.toast(`${n.name} is turning...`, 'z');
    HT.log('zombie', `Outbreak started with ${n.idStr} ${n.name}`);
  }
  // ---- Settings tabs ----
  set_gore(b) {
    let s = this.sec(b, 'Gore');
    this.select(s, 'Gore level', [['extreme', 'Extreme'], ['normal', 'Normal (no dismemberment)'], ['off', 'Off (no blood)']], Settings.data.gore.level, v => { Settings.set('gore.level', v); this.renderDrawer(); });
    this.toggle(s, 'Dismemberment', 'gore.dismember');
    this.toggle(s, 'Gibs (flesh and bone chunks)', 'gore.gibs');
    this.toggle(s, 'Blood pools', 'gore.pools');
    this.toggle(s, 'Blood on screen', 'gore.screenBlood');
    this.slider(s, 'Blood amount', 'gore.blood', 0.3, 2, 0.05, x => Math.round(x * 100) + '%');
    this.buttons(s, [{ label: 'Clean Up Blood', fn: () => this.game.gore.clear() }]);
  }
  set_graphics(b) {
    const g = this.game, G = Settings.data.graphics;
    let s = this.sec(b, 'Preset');
    this.buttons(s, ['low', 'high', 'ultra'].map(p => ({ label: p.toUpperCase(), cls: G.preset === p ? 'pri' : '', fn: () => { g.applyPreset(p); this.renderDrawer(); } })));
    s = this.sec(b, 'Quality');
    this.slider(s, 'Resolution', 'graphics.resolutionScale', 0.4, 1.0, 0.05, x => Math.round(x * 100) + '%', () => { Settings.set('graphics.preset', 'custom', true); g.resize(); });
    this.select(s, 'Shadows', [['off', 'Off'], ['low', 'Low'], ['high', 'High'], ['ultra', 'Ultra']], G.shadowQuality, v => { Settings.set('graphics.shadowQuality', v); Settings.set('graphics.preset', 'custom', true); g.applyShadows(); });
    this.select(s, 'Textures', [['low', 'Low'], ['high', 'High'], ['ultra', 'Ultra']], G.textureQuality, v => { Settings.set('graphics.textureQuality', v); Settings.set('graphics.preset', 'custom', true); Tex.cache.clear(); g.switchEnvironment(g.env.current.kind, true); });
    this.select(s, 'Character detail', [['low', 'Low'], ['high', 'High'], ['ultra', 'Ultra']], G.characterDetail, v => { Settings.set('graphics.characterDetail', v); Settings.set('graphics.preset', 'custom', true); HT.toast('Applies to newly spawned people'); });
    this.select(s, 'Frame rate cap', [[30, '30 FPS'], [60, '60 FPS'], [0, 'Unlimited']], G.fpsCap, v => Settings.set('graphics.fpsCap', +v));
    this.toggle(s, 'Ambient occlusion (SSAO)', 'graphics.ssao', () => g.post && g.post.setEnabled(Settings.data.graphics.ssao));
    this.toggle(s, 'Show FPS', 'graphics.showFps');
    this.slider(s, 'Field of view', 'controls.fov', 50, 100, 1, x => x + '°');
  }
  set_audio(b) {
    const g = this.game, s = this.sec(b, 'Volume');
    const ap = () => g.audio.applyVolumes();
    this.slider(s, 'Master', 'audio.master', 0, 1, 0.01, x => Math.round(x * 100) + '%', ap);
    this.slider(s, 'Effects', 'audio.effects', 0, 1, 0.01, x => Math.round(x * 100) + '%', ap);
    this.slider(s, 'Ambience', 'audio.ambience', 0, 1, 0.01, x => Math.round(x * 100) + '%', ap);
    this.slider(s, 'Interface', 'audio.ui', 0, 1, 0.01, x => Math.round(x * 100) + '%', ap);
    this.toggle(s, 'Mute', 'audio.muted', ap);
    this.note(s, g.audio.unlocked ? 'Audio is on.' : 'Audio starts after your first tap or click.');
  }
  set_controls(b) {
    const s = this.sec(b, 'Controls');
    this.slider(s, 'Look sensitivity', 'controls.sensitivity', 0.2, 3, 0.05, x => x.toFixed(2));
    this.toggle(s, 'Invert Y', 'controls.invertY');
    this.select(s, 'Touch controls', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], Settings.data.controls.touch, v => Settings.set('controls.touch', v));
    this.toggle(s, 'Control hints', 'ui.hints', () => this.updatePlayHint());
    this.note(s, 'PC: WASD move, mouse look, left click fire, right click aim, R reload, 1-6 weapons, Tab sandbox, O settings.<br>Phone: left thumb moves, right thumb looks, buttons fire/aim/reload, tap the weapon bar to switch.');
  }
  set_gameplay(b) {
    const g = this.game;
    let s = this.sec(b, 'Weapons');
    this.toggle(s, 'Infinite ammo', 'weapons.infiniteAmmo');
    this.toggle(s, 'Auto reload', 'weapons.autoReload');
    this.toggle(s, 'Pistol full-auto', 'weapons.pistolAuto');
    this.slider(s, 'Damage', 'weapons.damageScale', 0.25, 4, 0.05, x => x.toFixed(2) + 'x');
    this.slider(s, 'Grenade blast radius', 'weapons.grenadeRadius', 2, 16, 0.5, x => x.toFixed(1) + ' m');
    this.slider(s, 'Grenade fuse', 'weapons.grenadeFuse', 0.5, 8, 0.1, x => x.toFixed(1) + ' s');
    this.buttons(s, [{ label: 'Refill Ammo', fn: () => { g.weapons.resetAmmo(); HT.toast('Ammo refilled'); } }]);
    s = this.sec(b, 'Zombies');
    this.slider(s, 'Zombie speed', 'zombies.speed', 0.3, 2.5, 0.05, x => x.toFixed(2) + 'x');
    this.slider(s, 'Bite damage', 'zombies.biteDamage', 5, 60, 1);
    this.slider(s, 'Infection time', 'zombies.infectionTime', 2, 60, 1, x => x + ' s');
    this.select(s, 'Rise delay (zombie mode)', [['immediate', 'Immediate'], ['short', 'Short (5s)'], ['medium', 'Medium (15s)'], ['long', 'Long (45s)']], Settings.data.zombies.delayPreset, v => Settings.set('zombies.delayPreset', v));
    this.toggle(s, 'Destroyed head stops rising', 'zombies.headTraumaPrevents');
    this.slider(s, 'Zombie detection range', 'zombies.detection', 2, 40, 0.5, x => x.toFixed(1) + ' m');
    s = this.sec(b, 'People & Physics');
    this.toggle(s, 'People react and flee', 'ai.reactions');
    this.toggle(s, 'People wander', 'ai.wander');
    this.slider(s, 'Gravity', 'physics.gravity', 0, 25, 0.1, x => x.toFixed(1) + ' m/s²', () => g.applyPhysicsSettings());
    this.slider(s, 'Impact force', 'physics.forceScale', 0.1, 5, 0.05, x => x.toFixed(2) + 'x');
  }
  set_interface(b) {
    const g = this.game;
    let s = this.sec(b, 'On-screen info');
    this.toggle(s, 'Name tags', 'diagnostics.npcNames');
    this.toggle(s, 'Hit info cards', 'diagnostics.labels');
    this.toggle(s, 'Event log', 'diagnostics.eventLog');
    this.toggle(s, 'Debug panel', 'diagnostics.debugPanel');
    s = this.sec(b, 'Reset');
    this.buttons(s, [{ label: 'Reset All Settings', cls: 'bad', fn: () => { if (confirm('Reset all settings to defaults?')) { Settings.resetAll(); g.applyPreset(Settings.data.graphics.preset); this.renderDrawer(); } } }]);
    this.note(s, `Settings ${Settings.storageOk ? 'are saved on this device' : 'cannot be saved (private mode?)'} · WebGL${g.renderer.capabilities.isWebGL2 ? '2' : '1'}`);
  }
}
HT.UI = UI;
