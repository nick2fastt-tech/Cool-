// ============================================================================
// Weapons & tools: Pistol, Sniper Rifle, Knife, Grenade, Physics Hand, Move Tool.
// First-person viewmodels (separate scene), projectiles, melee, explosions.
// ============================================================================
const TOOL_DEFS = [
  { id: 'pistol', name: 'Pistol', short: 'PISTOL', isGun: true, magKey: 'pistolMag', reload: 1.45, rate: 0.17, damage: 34, spread: 0.010, adsSpread: 0.0025, speed: 360, impulse: 11, zoom: 1.4, recoil: 0.045, knock: 0.18, tracer: false, pen: 0 },
  { id: 'sniper', name: 'Sniper Rifle', short: 'SNIPER', isGun: true, magKey: 'sniperMag', reload: 2.7, rate: 1.3, damage: 150, spread: 0.03, adsSpread: 0.0002, speed: 880, impulse: 46, zoom: 6.5, recoil: 0.11, knock: 1.0, tracer: true, pen: 1, scope: true },
  { id: 'knife', name: 'Combat Knife', short: 'KNIFE', melee: true, rate: 0.55, damage: 46, range: 1.95, impulse: 5 },
  { id: 'grenade', name: 'Frag Grenade', short: 'GRENADE', throwable: true, rate: 0.9, damage: 165, impulse: 14 },
  { id: 'hand', name: 'Physics Hand', short: 'GRAB', grab: true },
  { id: 'move', name: 'Move Tool', short: 'MOVE', move: true }
];
const TOOL_ICONS = {
  pistol: '<svg viewBox="0 0 40 24" fill="currentColor"><path d="M4 5h27l2 2v3h-3v3h-9l-2 2h-3l-1 6H8l1-7-5-1z"/></svg>',
  sniper: '<svg viewBox="0 0 40 24" fill="currentColor"><path d="M1 13h4l3-2h20l3-1h8v2h-8l-3 1-2 2h-4l-2 4h-3l1-4H11l-3 3H3l-2-3z"/><rect x="14" y="6" width="12" height="3" rx="1.5"/></svg>',
  knife: '<svg viewBox="0 0 40 24" fill="currentColor"><path d="M2 14h13v-3h2v8h-2v-3H2z"/><path d="M17 11l18-2 3 3-21 5z"/></svg>',
  grenade: '<svg viewBox="0 0 40 24" fill="currentColor"><ellipse cx="20" cy="15" rx="7" ry="8"/><rect x="17" y="3" width="6" height="5" rx="1"/><path d="M23 4l7 4-1 2-6-3z"/><circle cx="14" cy="5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  hand: '<svg viewBox="0 0 40 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 21v-9M18 20V6M22 20V5M26 20V7M30 20v-9M14 13l-3-3M14 21h16"/></svg>',
  move: '<svg viewBox="0 0 40 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 2v20M10 12h20M20 2l-3 3M20 2l3 3M20 22l-3-3M20 22l3-3M10 12l3-3M10 12l3 3M30 12l-3-3M30 12l-3 3"/></svg>'
};

class Weapons {
  constructor(game) {
    this.game = game;
    this.tools = TOOL_DEFS.map(d => Object.assign({}, d));
    this.byId = {}; for (const t of this.tools) this.byId[t.id] = t;
    this.current = this.byId.pistol; this.index = 0;
    this.projectiles = []; this.grenades = [];
    this.cooldown = 0; this.reloading = 0; this.equipT = 0; this.swingT = 0; this.throwT = 0; this.charge = 0; this.charging = false;
    this.grab = null; this.moving = null; this.moveRing = null;
    this.ammo = {};
    this.resetAmmo();
    this.vmKick = 0; this.vmTime = 0; this.boltT = 0;
  }
  resetAmmo() {
    const W = Settings.data.weapons;
    this.ammo = {
      pistol: { mag: W.pistolMag, reserve: W.pistolMag * W.reserveMags },
      sniper: { mag: W.sniperMag, reserve: W.sniperMag * W.reserveMags },
      grenade: { mag: 1, reserve: 8 }
    };
  }
  magSize(t) { return t.magKey ? Settings.data.weapons[t.magKey] : 1; }
  enabled(t) { return Settings.data.weapons.enabled[t.id] !== false; }
  // ---------------------------------------------------------------------------------
  build() {
    const g = this.game;
    this.vmScene = new THREE.Scene();
    this.vmCam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 10);
    this.vmScene.add(new THREE.HemisphereLight(0xffffff, 0x666660, 1.3));
    const dl = new THREE.DirectionalLight(0xffffff, 1.8); dl.position.set(0.5, 1, 0.6); this.vmScene.add(dl);
    const rim = new THREE.DirectionalLight(0xbfe6ff, 1.2); rim.position.set(-0.8, 0.4, -1); this.vmScene.add(rim);
    this.vmLight = new THREE.PointLight(0xffbb66, 0, 2, 2); this.vmLight.position.set(0.1, -0.05, -0.6); this.vmScene.add(this.vmLight);
    this.vmRoot = new THREE.Group(); this.vmScene.add(this.vmRoot);
    const M = {
      metal: new THREE.MeshStandardMaterial({ color: 0x4b4f55, metalness: 0.65, roughness: 0.34 }),
      metal2: new THREE.MeshStandardMaterial({ color: 0x5d6168, metalness: 0.7, roughness: 0.4 }),
      poly: new THREE.MeshStandardMaterial({ color: 0x2f3134, metalness: 0.15, roughness: 0.62 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x4a3322, metalness: 0.0, roughness: 0.6 }),
      steel: new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1.0, roughness: 0.22 }),
      olive: new THREE.MeshStandardMaterial({ color: 0x4b5a32, metalness: 0.2, roughness: 0.6 }),
      glove: new THREE.MeshStandardMaterial({ color: 0x5a4f3d, metalness: 0.0, roughness: 0.85 }),
      sleeve: new THREE.MeshStandardMaterial({ color: 0x3e4a3a, metalness: 0.0, roughness: 0.92 }),
      lens: new THREE.MeshStandardMaterial({ color: 0x223355, metalness: 0.9, roughness: 0.05, emissive: 0x050a18 }),
      flash: new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
      glow: new THREE.MeshBasicMaterial({ color: 0x4fd1ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false })
    };
    this.M = M;
    const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    const cyl = (r1, r2, h, m, seg = 12) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m);
    const arm = (side) => { // glove + sleeve
      const grp = new THREE.Group();
      const hand = box(0.05, 0.03, 0.085, M.glove); grp.add(hand);
      const fing = box(0.048, 0.022, 0.05, M.glove); fing.position.set(0, -0.012, -0.055); fing.rotation.x = 0.9; grp.add(fing);
      const thumb = box(0.016, 0.016, 0.05, M.glove); thumb.position.set(-side * 0.025, 0.008, -0.03); thumb.rotation.y = side * 0.5; grp.add(thumb);
      const sl = cyl(0.033, 0.036, 0.42, M.sleeve, 14); sl.rotation.x = Math.PI / 2; sl.position.set(0, -0.005, 0.24); grp.add(sl);
      const cuff = cyl(0.031, 0.031, 0.03, M.glove, 14); cuff.rotation.x = Math.PI / 2; cuff.position.set(0, -0.004, 0.05); grp.add(cuff);
      return grp;
    };
    const models = {};
    // PISTOL ------------------------------------------------------------
    {
      const m = new THREE.Group();
      const slide = box(0.03, 0.032, 0.19, M.metal); slide.position.set(0, 0.03, -0.08); m.add(slide); m.userData.slide = slide;
      const frame = box(0.028, 0.022, 0.165, M.poly); frame.position.set(0, 0.005, -0.07); m.add(frame);
      const grip = box(0.029, 0.11, 0.048, M.poly); grip.position.set(0, -0.05, 0.0); grip.rotation.x = 0.28; m.add(grip);
      const tg = box(0.006, 0.006, 0.05, M.poly); tg.position.set(0, -0.018, -0.04); m.add(tg);
      const trig = box(0.005, 0.02, 0.006, M.metal2); trig.position.set(0, -0.008, -0.035); m.add(trig);
      const sight1 = box(0.006, 0.008, 0.006, M.metal); sight1.position.set(0, 0.05, -0.165); m.add(sight1);
      const sight2 = box(0.018, 0.008, 0.006, M.metal); sight2.position.set(0, 0.05, 0.005); m.add(sight2);
      const muzzle = cyl(0.007, 0.007, 0.01, M.metal2); muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0.03, -0.177); m.add(muzzle);
      const mag = box(0.024, 0.11, 0.038, M.metal2); mag.position.set(0, -0.052, 0.0); mag.rotation.x = 0.28; m.add(mag); m.userData.mag = mag; m.userData.magHome = mag.position.clone();
      const ra = arm(1); ra.position.set(0.0, -0.065, 0.045); ra.rotation.set(-0.2, 0, 0); m.add(ra);
      const la = arm(-1); la.position.set(-0.03, -0.075, 0.03); la.rotation.set(-0.15, -0.35, 0.4); m.add(la); m.userData.leftArm = la; m.userData.leftHome = la.position.clone();
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), M.flash); fl.position.set(0, 0.03, -0.215); m.add(fl); m.userData.flash = fl;
      const fl2 = fl.clone(); fl2.rotation.y = Math.PI / 2; fl.add(fl2);
      m.userData.hip = new V3(0.15, -0.15, -0.42); m.userData.ads = new V3(0.0, -0.052, -0.33);
      models.pistol = m;
    }
    // SNIPER ------------------------------------------------------------
    {
      const m = new THREE.Group();
      const rec = box(0.04, 0.05, 0.26, M.poly); rec.position.set(0, 0.0, -0.05); m.add(rec);
      const stock = box(0.038, 0.07, 0.3, M.poly); stock.position.set(0, -0.02, 0.24); m.add(stock);
      const cheek = box(0.036, 0.03, 0.16, M.poly); cheek.position.set(0, 0.025, 0.24); m.add(cheek);
      const grip = box(0.03, 0.09, 0.04, M.poly); grip.position.set(0, -0.06, 0.07); grip.rotation.x = 0.35; m.add(grip);
      const fore = box(0.042, 0.045, 0.3, M.poly); fore.position.set(0, -0.005, -0.33); m.add(fore);
      const barrel = cyl(0.011, 0.013, 0.62, M.metal, 14); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.008, -0.62); m.add(barrel);
      const brake = cyl(0.017, 0.017, 0.06, M.metal2, 14); brake.rotation.x = Math.PI / 2; brake.position.set(0, 0.008, -0.94); m.add(brake);
      const scope = cyl(0.021, 0.021, 0.26, M.metal, 18); scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.075, -0.07); m.add(scope);
      const sf = cyl(0.03, 0.023, 0.07, M.metal, 18); sf.rotation.x = Math.PI / 2; sf.position.set(0, 0.075, -0.225); m.add(sf);
      const sr = cyl(0.026, 0.021, 0.05, M.metal, 18); sr.rotation.x = Math.PI / 2; sr.position.set(0, 0.075, 0.08); m.add(sr);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.027, 18), M.lens); lens.position.set(0, 0.075, -0.261); lens.rotation.y = Math.PI; m.add(lens);
      for (const z of [-0.12, 0.0]) { const mt = box(0.03, 0.035, 0.02, M.metal2); mt.position.set(0, 0.04, z); m.add(mt); }
      const turret = cyl(0.012, 0.012, 0.025, M.metal2); turret.position.set(0, 0.105, -0.07); m.add(turret);
      const bolt = new THREE.Group(); const bh = cyl(0.005, 0.005, 0.05, M.metal2); bh.rotation.z = Math.PI / 2; bh.position.x = 0.025; bolt.add(bh);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), M.metal2); knob.position.x = 0.05; bolt.add(knob);
      bolt.position.set(0.0, 0.015, 0.03); m.add(bolt); m.userData.bolt = bolt;
      const mag = box(0.03, 0.05, 0.07, M.metal2); mag.position.set(0, -0.045, -0.06); m.add(mag); m.userData.mag = mag; m.userData.magHome = mag.position.clone();
      const ra = arm(1); ra.position.set(0.0, -0.075, 0.1); ra.rotation.set(-0.35, 0, 0); m.add(ra);
      const la = arm(-1); la.position.set(-0.005, -0.05, -0.3); la.rotation.set(-0.1, 0, 0.6); m.add(la); m.userData.leftArm = la; m.userData.leftHome = la.position.clone();
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), M.flash); fl.position.set(0, 0.008, -0.99); m.add(fl); m.userData.flash = fl;
      const fl2 = fl.clone(); fl2.rotation.y = Math.PI / 2; fl.add(fl2);
      m.userData.hip = new V3(0.17, -0.165, -0.36); m.userData.ads = new V3(0.0, -0.075, -0.16);
      models.sniper = m;
    }
    // KNIFE -------------------------------------------------------------
    {
      const m = new THREE.Group();
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.lineTo(0.15, 0.004); sh.quadraticCurveTo(0.175, 0.005, 0.185, 0.018); sh.lineTo(0.14, 0.03); sh.lineTo(0, 0.03); sh.lineTo(0, 0);
      const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0012, bevelSegments: 1 });
      bg.translate(0, -0.015, -0.002); bg.rotateY(Math.PI / 2);
      const blade = new THREE.Mesh(bg, M.steel); blade.position.set(0, 0.0, -0.035); m.add(blade);
      const guard = box(0.012, 0.05, 0.012, M.metal); guard.position.set(0, 0, -0.03); m.add(guard);
      const handle = box(0.022, 0.03, 0.11, M.poly); handle.position.set(0, 0, 0.03); m.add(handle);
      const pommel = box(0.024, 0.034, 0.012, M.metal); pommel.position.set(0, 0, 0.09); m.add(pommel);
      const ra = arm(1); ra.position.set(0.0, -0.01, 0.06); ra.rotation.set(-0.1, 0, 0); m.add(ra);
      m.rotation.set(0.15, 0.25, -0.45);
      m.userData.hip = new V3(0.21, -0.18, -0.42); m.userData.ads = m.userData.hip;
      models.knife = m;
    }
    // GRENADE -----------------------------------------------------------
    {
      const m = new THREE.Group();
      const gm = this.makeGrenadeMesh(); gm.position.set(0, 0.03, -0.02); m.add(gm); m.userData.nade = gm;
      const ra = arm(1); ra.position.set(0.0, -0.01, 0.05); ra.rotation.set(-0.4, 0, 0); m.add(ra);
      m.userData.hip = new V3(0.21, -0.19, -0.44); m.userData.ads = m.userData.hip;
      models.grenade = m;
    }
    // HAND + MOVE -------------------------------------------------------
    for (const id of ['hand', 'move']) {
      const m = new THREE.Group();
      const ra = arm(1); ra.position.set(0, 0, 0.0); ra.rotation.set(-0.2, 0, -0.3); m.add(ra);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.004, 8, 24), M.glow); ring.position.set(0, 0.02, -0.09); m.add(ring); m.userData.glow = ring;
      m.userData.hip = new V3(0.22, -0.2, -0.44); m.userData.ads = m.userData.hip;
      models[id] = m;
    }
    for (const k in models) { models[k].visible = false; this.vmRoot.add(models[k]); }
    this.models = models;
    // grab beam
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.beam = new THREE.Line(bg, new THREE.LineBasicMaterial({ color: 0x4fd1ff, transparent: true, opacity: 0.6 }));
    this.beam.frustumCulled = false; this.beam.visible = false; g.scene.add(this.beam);
    const rg = new THREE.RingGeometry(0.42, 0.5, 40); rg.rotateX(-Math.PI / 2);
    this.moveRing = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x4fd1ff, transparent: true, opacity: 0.6, depthWrite: false }));
    this.moveRing.visible = false; g.scene.add(this.moveRing);
    this.select(0, true);
  }
  makeGrenadeMesh() {
    const M = this.M;
    const grp = new THREE.Group();
    const bodyGeo = new THREE.SphereGeometry(0.033, 18, 14); bodyGeo.scale(1, 1.18, 1);
    const p = bodyGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i), z = p.getZ(i); const a = Math.atan2(z, x); const k = 1 + 0.035 * Math.max(Math.sin(a * 6), 0) * Math.max(Math.sin(y * 160), 0); p.setXYZ(i, x * k, y, z * k); }
    bodyGeo.computeVertexNormals();
    grp.add(new THREE.Mesh(bodyGeo, M.olive));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.022, 12), M.metal2); cap.position.y = 0.045; grp.add(cap);
    const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.004), M.metal2); spoon.position.set(0.016, 0.03, 0.0); spoon.rotation.z = -0.25; grp.add(spoon);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0018, 6, 16), M.steel); ring.position.set(-0.016, 0.052, 0); ring.rotation.y = Math.PI / 2; grp.add(ring);
    return grp;
  }
  select(i, silent) {
    const n = this.tools.length;
    i = ((i % n) + n) % n;
    if (!this.enabled(this.tools[i])) return false;
    if (this.grab) this.releaseGrab(false);
    if (this.moving) this.endMove();
    this.index = i; this.current = this.tools[i];
    this.reloading = 0; this.charging = false; this.charge = 0; this.swingT = 0;
    for (const k in this.models) this.models[k].visible = k === this.current.id;
    this.equipT = 0.35;
    this.game.player.aiming = false; this.game.player.zoom = 1;
    if (!silent) { this.game.audio.play('equip', { bus: 'ui', gain: 0.5 }); }
    Events.emit('tool', this.current);
    return true;
  }
  cycle(dir) {
    for (let k = 1; k <= this.tools.length; k++) if (this.select(this.index + dir * k)) return;
  }
  // ---------------------------------------------------------------------------------
  update(dt) {
    const g = this.game, inp = g.input, t = this.current, W = Settings.data.weapons;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.equipT = Math.max(0, this.equipT - dt);
    this.vmTime += dt;
    // input
    const locked = inp.locked || inp.lockFailed || inp.isTouch;
    const uiBlock = g.ui.drawerOpen;
    let fireHeld = !uiBlock && ((locked && inp.mouse.down[0]) || inp.touch.fire);
    let firePressed = !uiBlock && ((locked && inp.mouse.clicked[0] && !inp.suppressClick) || (inp.touch.fire && !this._touchFirePrev));
    this._touchFirePrev = inp.touch.fire;
    const aimHeld = !uiBlock && ((inp.locked && inp.mouse.down[2]) || inp.touch.aimHold);
    // tool selection keys
    for (let k = 0; k < 6; k++) if (inp.wasPressed('Digit' + (k + 1))) this.select(k);
    if (inp.wasPressed('KeyG') && t.id !== 'grenade') { this.select(3); }
    if (inp.touch.next) { this.cycle(1); inp.touch.next = false; }
    if (inp.mouse.wheel !== 0 && !this.grab && !this.moving && !(t.isGun && this.game.player.aiming)) this.cycle(inp.mouse.wheel > 0 ? 1 : -1);
    if (inp.wasPressed('KeyR') || inp.touch.reload) { inp.touch.reload = false; if (t.isGun) this.startReload(); else if (t.move && this.moving) this.rotateMoved(Math.PI / 4); }
    if (inp.wasPressed('KeyF') || inp.touch.select) { inp.touch.select = false; this.selectAtCrosshair(); }
    // aiming
    if (t.isGun && this.reloading <= 0) { g.player.aiming = aimHeld; g.player.zoom = t.zoom; }
    else { g.player.aiming = false; }
    g.ui.setScope(!!(t.scope && g.player.aiming && g.player.cam.fov < Settings.data.controls.fov / 2.2));
    // reload progress
    if (this.reloading > 0) {
      const before = this.reloading;
      this.reloading -= dt;
      const total = t.reload;
      const prog = 1 - this.reloading / total;
      const pb = 1 - before / total;
      if (pb < 0.25 && prog >= 0.25) g.audio.play('magOut', { gain: 0.6 });
      if (pb < 0.62 && prog >= 0.62) g.audio.play('magIn', { gain: 0.7 });
      if (pb < 0.85 && prog >= 0.85) g.audio.play(t.id === 'sniper' ? 'bolt' : 'slide', { gain: 0.6 });
      if (this.reloading <= 0) this.finishReload();
    }
    // actions
    if (this.equipT <= 0 && !uiBlock) {
      if (t.isGun) {
        const auto = t.id === 'pistol' && W.pistolAuto;
        if ((auto ? fireHeld : firePressed) && this.cooldown <= 0 && this.reloading <= 0) this.fireGun(t);
      } else if (t.melee) {
        if (firePressed && this.cooldown <= 0) this.knifeAttack(t);
      } else if (t.throwable) {
        const a = this.ammo.grenade;
        if (fireHeld && this.cooldown <= 0 && (a.mag > 0 || W.infiniteAmmo)) { this.charging = true; this.charge = Math.min(1, this.charge + dt / 1.1); }
        else if (this.charging && !fireHeld) { this.throwGrenade(t, this.charge); this.charging = false; this.charge = 0; }
      } else if (t.grab) {
        if (fireHeld && !this.grab && firePressed) this.startGrab();
        if (this.grab && !fireHeld) this.releaseGrab(false);
        if (this.grab && ((inp.locked && inp.mouse.clicked[2]) || inp.touch.aimHold)) this.releaseGrab(true);
        if (this.grab && inp.mouse.wheel) this.grab.dist = clamp(this.grab.dist - inp.mouse.wheel * 0.3, 1.0, 12);
      } else if (t.move) {
        if (firePressed && !this.moving) this.startMove();
        else if (this.moving && !fireHeld) this.endMove();
        if (this.moving && inp.mouse.wheel) this.rotateMoved(inp.mouse.wheel * 0.2);
      }
    }
    if (this.grab) this.updateGrab(dt);
    if (this.moving) this.updateMove(dt);
    this.updateProjectiles(dt);
    this.updateGrenades(dt);
    this.updateViewmodel(dt);
  }
  // --- guns -------------------------------------------------------------------------
  fireGun(t) {
    const g = this.game, W = Settings.data.weapons, a = this.ammo[t.id];
    if (a.mag <= 0) {
      g.audio.play('dry', { gain: 0.6 }); this.cooldown = 0.25;
      if (W.autoReload) this.startReload();
      return;
    }
    if (!W.infiniteAmmo) a.mag--;
    this.cooldown = t.rate;
    const cam = g.camera;
    const origin = cam.position.clone();
    const dir = cam.getWorldDirection(new V3());
    const sp = g.player.aiming ? t.adsSpread : t.spread * (1 + g.player.vel.length() * 0.15);
    if (sp > 0) {
      const r = _v1.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(sp * Math.sqrt(Math.random()) * 2);
      dir.add(r).normalize();
    }
    const muzzleW = origin.clone().addScaledVector(dir, 0.6).addScaledVector(g.player.right(_v2), 0.12).add(_v3.set(0, -0.08, 0));
    const tracer = (t.tracer || Math.random() < 0.25) ? g.fx.tracer(muzzleW, dir, t.speed * 0.9, t.id === 'sniper' ? 6 : 3, t.id === 'sniper' ? 0xfff2c8 : 0xffd890) : null;
    this.projectiles.push({ pos: origin, vel: dir.clone().multiplyScalar(t.speed), tool: t, travelled: 0, pen: t.pen, ignore: null, tracer, dmgMul: 1 });
    // fx + audio + recoil
    g.fx.muzzle(muzzleW, dir);
    const m = this.models[t.id];
    m.userData.flash.material.opacity = 1; m.userData.flash.rotation.z = Math.random() * TAU; this.flashT = 0.05;
    this.vmLight.intensity = 2.5;
    g.player.recoil += t.recoil * (g.player.aiming ? 0.6 : 1); g.player.recoilYaw += (Math.random() - 0.5) * t.recoil * 0.4;
    this.vmKick = 1;
    g.audio.play(t.id, { gain: 1, pos: origin });
    if (t.id === 'sniper') { this.boltT = 0.9; setTimeout(() => this.game.audio.play('bolt', { gain: 0.5 }), 380); }
    // shell
    const right = g.player.right(new V3());
    g.fx.shell(origin.clone().addScaledVector(dir, 0.35).addScaledVector(right, 0.12).add(_v1.set(0, -0.08, 0)), right.clone().multiplyScalar(1.6 + Math.random()).add(_v1.set(0, 1.8, 0)).addScaledVector(dir, -0.3));
    g.ai.emit(t.id === 'sniper' ? 'sniper' : 'gunshot', origin, { threatPos: origin });
    if (a.mag <= 0 && W.autoReload && a.reserve > 0) setTimeout(() => { if (this.current === t) this.startReload(); }, 300);
  }
  startReload() {
    const t = this.current; if (!t.isGun || this.reloading > 0) return;
    const a = this.ammo[t.id], W = Settings.data.weapons;
    if (a.mag >= this.magSize(t) || (a.reserve <= 0 && !W.infiniteAmmo)) return;
    this.reloading = t.reload; this.game.player.aiming = false;
    Events.emit('reload', t);
  }
  finishReload() {
    const t = this.current, a = this.ammo[t.id], W = Settings.data.weapons;
    const need = this.magSize(t) - a.mag;
    const take = W.infiniteAmmo ? need : Math.min(need, a.reserve);
    a.mag += take; if (!W.infiniteAmmo) a.reserve -= take;
    this.reloading = 0;
  }
  updateProjectiles(dt) {
    const g = this.game;
    const grav = Settings.data.physics.gravity;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      let remaining = pr.vel.length() * dt;
      let guard = 0;
      while (remaining > 0 && guard++ < 4) {
        const speed = pr.vel.length();
        const dir = _v4.copy(pr.vel).multiplyScalar(1 / speed);
        const seg = remaining;
        const npcHit = g.hits.raycastNPCs(pr.pos, dir, seg, pr.ignore);
        const propHit = g.physics.raycast(pr.pos, dir, seg, b => b.tag === 'prop' || b.tag === 'grenade');
        const envHit = this.rayEnv(pr.pos, dir, seg);
        let best = null, bd = seg;
        if (npcHit && npcHit.dist < bd) { best = 'npc'; bd = npcHit.dist; }
        if (propHit && propHit.dist < bd) { best = 'prop'; bd = propHit.dist; }
        if (envHit && envHit.dist < bd) { best = 'env'; bd = envHit.dist; }
        if (!best) { pr.pos.addScaledVector(dir, seg); pr.travelled += seg; remaining = 0; break; }
        const hitPos = pr.pos.clone().addScaledVector(dir, bd);
        pr.travelled += bd;
        if (best === 'npc') {
          this.bulletHitNPC(pr, npcHit, dir);
          if (pr.pen > 0) { pr.pen--; pr.ignore = npcHit.npc; pr.dmgMul *= 0.55; pr.vel.multiplyScalar(0.7); pr.pos.copy(hitPos).addScaledVector(dir, 0.05); remaining = Math.max(0, seg - bd); continue; }
        } else if (best === 'prop') {
          const b = propHit.body;
          g.physics.applyImpulse(b, dir.clone().multiplyScalar(pr.tool.impulse * 0.35 * Settings.data.physics.forceScale), propHit.point);
          g.fx.impactDust(propHit.point, dir.clone().negate(), 'hard', 0.7);
          g.audio.play('hitWood', { pos: propHit.point, gain: 0.8 });
          g.ai.emit('impact', propHit.point, { threatPos: g.camera.position });
        } else {
          g.fx.decal(envHit.point, envHit.normal, pr.tool.id === 'sniper' ? 0.09 : 0.06, 'hole');
          g.fx.impactDust(envHit.point, envHit.normal, g.env.current.surface, pr.tool.id === 'sniper' ? 1.4 : 1);
          g.audio.play(g.env.current.surface === 'grass' ? 'hitDirt' : 'hitHard', { pos: envHit.point, gain: 0.9 });
          if (Math.random() < 0.18 && g.env.current.surface !== 'grass') g.audio.play('ricochet', { pos: envHit.point, gain: 0.5 });
          g.ai.emit('impact', envHit.point, { threatPos: g.camera.position });
        }
        if (pr.tracer) g.fx.stopTracer(pr.tracer, pr.travelled);
        this.projectiles.splice(i, 1);
        remaining = 0;
        break;
      }
      if (i < this.projectiles.length && this.projectiles[i] === pr) {
        pr.vel.y -= grav * dt;
        if (pr.travelled > 600) this.projectiles.splice(i, 1);
      }
    }
  }
  rayEnv(o, d, maxD) {
    const ph = this.game.physics;
    let best = null, bt = maxD;
    for (const pl of ph.planes) {
      const den = pl.n.dot(d);
      if (den >= -1e-6) continue;
      const t = (pl.d - pl.n.dot(o)) / den;
      if (t >= 0 && t < bt) { bt = t; best = { dist: t, normal: pl.n.clone() }; }
    }
    if (ph.heightfield) {
      const step = 0.2; let prevT = 0;
      for (let t = step; t <= bt + step; t += step) {
        const tt = Math.min(t, bt);
        const x = o.x + d.x * tt, y = o.y + d.y * tt, z = o.z + d.z * tt;
        if (y <= ph.heightfield(x, z)) {
          let lo = prevT, hi = tt;
          for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (o.y + d.y * m <= ph.heightfield(o.x + d.x * m, o.z + d.z * m)) hi = m; else lo = m; }
          bt = hi; best = { dist: hi, normal: ph.heightNormal(o.x + d.x * hi, o.z + d.z * hi, new V3()).clone() };
          break;
        }
        prevT = tt;
        if (tt >= bt) break;
      }
    }
    if (best) best.point = o.clone().addScaledVector(d, best.dist);
    return best;
  }
  bulletHitNPC(pr, hit, dir) {
    const g = this.game, npc = hit.npc, t = pr.tool;
    const force = t.impulse * Settings.data.physics.forceScale * pr.dmgMul;
    const wasAlive = npc.lifeState === 'alive', wasZombie = npc.lifeState === 'zombie';
    const res = npc.applyHit({ region: hit.region, damage: t.damage * pr.dmgMul, weapon: t.id, dir: dir.clone(), point: hit.point, force, threatPos: g.camera.position.clone() });
    this.physicalReaction(npc, hit.region, dir, hit.point, force, t.knock, res);
    g.fx.fabricPuff(hit.point, hit.normal);
    g.audio.play(hit.region === REGION.HEAD ? 'hitHead' : 'hitBody', { pos: hit.point, gain: 0.9 });
    g.hits.report(npc, hit.region, res, t.name, hit.point);
    g.ui.hitMarker(res.killed);
    if (res.killed) g.ai.emit('death', npc.root.pos, { source: npc, threatPos: g.camera.position });
  }
  // decide knockdown / impulse / animated reaction
  physicalReaction(npc, region, dir, point, force, knockChance, res) {
    const g = this.game;
    const ri = REGION_TO_RAG[region];
    if (npc.physMode === 'ragdoll') {
      npc.rag.applyImpulseAt(ri, _v1.copy(dir).multiplyScalar(force), point);
      if (npc.lifeState === 'alive') { npc.downTimer = Math.max(npc.downTimer, 1.2); npc.lastReaction = 'Knockdown (Ragdoll)'; }
      return;
    }
    const alive = npc.lifeState === 'alive', zombie = npc.lifeState === 'zombie';
    const legHit = region >= REGION.L_THIGH;
    const tough = npc.personality.toughness * (zombie ? 1.6 : 1);
    const knock = !alive && !zombie ? 1 : clamp(knockChance * (legHit ? 1.5 : 1) * (npc.health < 40 ? 1.6 : 1) / tough, 0, 1);
    if (res.killed || Math.random() < knock || force > 40 * tough) {
      if (npc.physMode !== 'ragdoll') npc.goRagdoll(res.killed ? 'Ragdoll (Deceased)' : 'Knockdown (Ragdoll)', !alive && !zombie);
      npc.rag.applyImpulseAt(ri, _v1.copy(dir).multiplyScalar(force), point);
      if (legHit && alive) { // legs swept
        const opp = region < REGION.R_THIGH ? RAG.THIGH_L : RAG.THIGH_R;
        npc.rag.applyImpulseAt(opp, _v1.copy(dir).multiplyScalar(force * 0.3), null);
      }
    } else {
      g.ai.onHit(npc, { region, dir: dir.clone(), force, threatPos: g.camera.position.clone() });
    }
  }
  // --- knife ------------------------------------------------------------------------
  knifeAttack(t) {
    const g = this.game;
    this.cooldown = t.rate; this.swingT = 0.32; this.swingDir = (this.swingDir || 1) * -1;
    g.audio.play('swing', { gain: 0.8 });
    setTimeout(() => {
      const cam = g.camera, o = cam.position.clone(), f = cam.getWorldDirection(new V3()), r = g.player.right(new V3());
      let best = null;
      for (const off of [0, -0.12, 0.12, -0.24, 0.24]) {
        const d = f.clone().addScaledVector(r, off).normalize();
        const h = g.hits.raycastNPCs(o, d, t.range, null);
        if (h && (!best || h.dist < best.dist)) { best = h; best.dir = d; }
      }
      if (best) {
        const npc = best.npc;
        const force = t.impulse * Settings.data.physics.forceScale;
        const res = npc.applyHit({ region: best.region, damage: t.damage, weapon: 'knife', dir: best.dir, point: best.point, force, threatPos: o });
        this.physicalReaction(npc, best.region, best.dir, best.point, force, 0.08, res);
        g.fx.fabricPuff(best.point, best.normal);
        g.audio.play('stab', { pos: best.point, gain: 0.9 });
        g.hits.report(npc, best.region, res, t.name, best.point);
        g.ui.hitMarker(res.killed);
        g.ai.emit('knife', best.point, { threatPos: o });
        if (res.killed) g.ai.emit('death', npc.root.pos, { source: npc, threatPos: o });
      } else {
        // hit props / wall
        const ph = g.physics.raycast(o, f, t.range, b => b.tag === 'prop');
        if (ph) { g.physics.applyImpulse(ph.body, f.clone().multiplyScalar(6), ph.point); g.audio.play('hitWood', { pos: ph.point, gain: 0.6 }); }
        else { const e = this.rayEnv(o, f, t.range); if (e) { g.audio.play('knifeWall', { pos: e.point, gain: 0.7 }); g.fx.impactDust(e.point, e.normal, g.env.current.surface, 0.4); } }
      }
    }, 110);
  }
  // --- grenades ---------------------------------------------------------------------
  throwGrenade(t, power) {
    const g = this.game, W = Settings.data.weapons, a = this.ammo.grenade;
    if (!W.infiniteAmmo) { if (a.mag <= 0) return; a.mag--; if (a.reserve > 0) { a.reserve--; a.mag = 1; } }
    this.cooldown = t.rate; this.throwT = 0.45;
    const cam = g.camera, f = cam.getWorldDirection(new V3()), r = g.player.right(new V3());
    const body = new RBody({ type: SHAPE.SPHERE, r: 0.045 }, 0.45);
    const owner = { physKind: 'prop', bodies: [body], canSleep: false, asleep: false, sleepTimer: 0 };
    body.owner = owner; body.tag = 'grenade'; body.restitution = 0.38; body.friction = 0.6; body.angDamp = 0.6; body.linDamp = 0.08;
    body.pos.copy(cam.position).addScaledVector(f, 0.45).addScaledVector(r, 0.14).add(_v1.set(0, -0.1, 0));
    body.prevPos.copy(body.pos);
    body.vel.copy(f).multiplyScalar(6 + 13 * power).add(_v1.set(0, 2.2 + power * 1.5, 0)).add(g.player.vel);
    body.omega.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
    const mesh = this.makeGrenadeMesh(); mesh.scale.setScalar(1.25);
    mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.scene.add(mesh);
    g.physics.addBody(body); g.physics.owners.add(owner);
    this.grenades.push({ body, owner, mesh, fuse: W.grenadeFuse, lastImpact: 0 });
    g.audio.play('pin', { gain: 0.6 });
    g.audio.play('throw', { gain: 0.6 });
    Events.emit('grenadeThrown', body.pos);
  }
  updateGrenades(dt) {
    const g = this.game;
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const gr = this.grenades[i];
      gr.fuse -= dt;
      gr.mesh.position.copy(gr.body.pos); gr.mesh.quaternion.copy(gr.body.rot);
      if (gr.body.impact > 1.2 && g.time - gr.lastImpact > 0.12) { g.audio.play('clink', { pos: gr.body.pos, gain: clamp(gr.body.impact / 6, 0.2, 0.9) }); gr.lastImpact = g.time; }
      gr.body.impact = 0;
      // nearby NPCs notice a grenade on the ground
      if (!gr.noticed && gr.body.vel.length() < 2.5 && gr.fuse < Settings.data.weapons.grenadeFuse - 0.4) { gr.noticed = true; g.ai.emit('scream', gr.body.pos, { radius: 9, intensity: 0.9, threatPos: gr.body.pos.clone() }); }
      if (gr.fuse <= 0) { this.explode(gr.body.pos.clone()); this.removeGrenade(gr); this.grenades.splice(i, 1); }
    }
  }
  removeGrenade(gr) {
    const g = this.game;
    g.scene.remove(gr.mesh); gr.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    g.physics.removeBody(gr.body); g.physics.removeOwner(gr.owner);
  }
  explode(pos) {
    const g = this.game, W = Settings.data.weapons, t = this.byId.grenade;
    const R = W.grenadeRadius;
    const strength = t.impulse * Settings.data.physics.forceScale;
    g.fx.explosion(pos, R);
    g.audio.play('explosion', { pos, gain: 1.0 });
    const dCam = g.camera.position.distanceTo(pos);
    g.player.addShake(clamp(1.4 - dCam / (R * 3), 0.1, 1.4));
    g.ai.emit('explosion', pos, { threatPos: pos });
    HT.log('sys', `Explosion at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}) radius ${R.toFixed(1)}m`);
    const affected = [];
    for (const npc of g.npcs.list) {
      // nearest body part distance
      let dmin = 1e9;
      for (const b of npc.rag.bodies) dmin = Math.min(dmin, b.pos.distanceTo(pos) - b.shape.r);
      if (dmin > R) continue;
      const f = Math.pow(clamp(1 - Math.max(0, dmin) / R, 0, 1), 1.4);
      const region = g.hits.closestRegion(npc, pos);
      const dir = _v1.subVectors(npc.boneWPos[B.chest], pos).normalize();
      const res = npc.applyHit({ region, damage: t.damage * f / REGION_DAMAGE_MUL[region], weapon: 'grenade', dir: dir.clone(), point: pos.clone(), force: strength * f, threatPos: pos.clone() });
      if (f > 0.12 || res.killed || npc.physMode === 'ragdoll') {
        if (npc.physMode !== 'ragdoll') npc.goRagdoll(res.killed ? 'Ragdoll (Deceased)' : 'Knockdown (Blast)', npc.lifeState !== 'alive' && npc.lifeState !== 'zombie');
        npc.downTimer = Math.max(npc.downTimer, 2 + f * 2);
      } else {
        g.ai.onHit(npc, { region, dir: dir.clone(), force: 6, threatPos: pos.clone() });
      }
      affected.push({ npc, res, region, f });
    }
    g.physics.explosion(pos, R, strength * 0.85);
    for (const a of affected) {
      const ev = g.hits.report(a.npc, a.region, a.res, 'Grenade Blast (' + (a.f * 100).toFixed(0) + '%)', pos);
      if (a.res.killed) g.ai.emit('death', a.npc.root.pos, { source: a.npc, threatPos: pos });
    }
    for (const gr of this.grenades) { if (gr.body.pos.distanceTo(pos) < 1.5 && gr.fuse > 0.2) gr.fuse = 0.15; }
  }
  // --- selection --------------------------------------------------------------------
  pickNPC(maxDist) {
    const g = this.game, o = g.camera.position, d = g.camera.getWorldDirection(_v5);
    let best = null, bt = maxDist;
    for (const npc of g.npcs.list) {
      for (const b of npc.rag.bodies) {
        b.segment(_p1, _p2);
        const t = rayCapsule(o, d, _p1, _p2, b.shape.r + 0.03, bt);
        if (t !== null && t < bt) { bt = t; best = { npc, dist: t, body: b }; }
      }
    }
    return best;
  }
  selectAtCrosshair() {
    const g = this.game;
    const h = g.hits.raycastNPCs(g.camera.position, g.camera.getWorldDirection(new V3()), 60, null);
    if (h) { g.npcs.select(h.npc); g.audio.play('select', { bus: 'ui', gain: 0.5 }); }
    else { g.npcs.select(null); }
  }
  // --- physics hand -----------------------------------------------------------------
  startGrab() {
    const g = this.game, o = g.camera.position, d = g.camera.getWorldDirection(new V3());
    const hit = g.physics.raycast(o, d, 14, b => b.tag === 'npc' || b.tag === 'prop' || b.tag === 'grenade');
    if (!hit) { g.audio.play('dry', { gain: 0.3 }); return; }
    const b = hit.body;
    let npc = null;
    if (b.tag === 'npc') {
      npc = b.owner.npc;
      if (npc.physMode !== 'ragdoll') npc.goRagdoll('Grabbed (Physics Hand)', npc.lifeState !== 'alive' && npc.lifeState !== 'zombie');
      npc.carried = true;
      npc.lastReaction = npc.lifeState === 'alive' ? 'Grabbed (Struggling)' : 'Grabbed';
    }
    const owner = b.owner;
    g.physics.wakeOwner(owner); owner.noSleep = true;
    _q1.copy(b.rot).invert();
    const lp = hit.point.clone().sub(b.pos).applyQuaternion(_q1);
    const j = new Joint('spherical', b, null, lp, new QT(), hit.point.clone(), new QT());
    j.compliance = b.tag === 'npc' ? 0.0004 : 0.0008; j.posDamping = 8; j.enabled = true;
    g.physics.addJoint(j);
    this.grab = { body: b, owner, joint: j, dist: hit.dist, npc };
    g.audio.play('grab', { gain: 0.5 });
    if (npc) HT.log('sys', `Grabbed ${npc.idStr} ${npc.name}`);
  }
  updateGrab(dt) {
    const g = this.game, gr = this.grab;
    const target = g.camera.position.clone().addScaledVector(g.camera.getWorldDirection(_v1), gr.dist);
    g.env.clampToBounds(target, 0.2);
    target.y = Math.max(target.y, g.env.groundHeight(target.x, target.z) + 0.15);
    gr.joint.lp1.copy(target);
    gr.owner.asleep = false; for (const b of gr.owner.bodies) b.sleeping = false;
    // beam
    const arr = this.beam.geometry.attributes.position.array;
    const hand = g.camera.position.clone().addScaledVector(g.camera.getWorldDirection(_v2), 0.5).addScaledVector(g.player.right(_v3), 0.15).add(_v4.set(0, -0.12, 0));
    gr.joint.updateGlobal();
    arr[0] = hand.x; arr[1] = hand.y; arr[2] = hand.z; arr[3] = gr.joint.gp0.x; arr[4] = gr.joint.gp0.y; arr[5] = gr.joint.gp0.z;
    this.beam.geometry.attributes.position.needsUpdate = true; this.beam.visible = true;
    if (gr.npc && gr.npc.removed) this.releaseGrab(false);
  }
  releaseGrab(throwIt) {
    const g = this.game, gr = this.grab; if (!gr) return;
    g.physics.removeJoint(gr.joint);
    gr.owner.noSleep = false;
    if (throwIt) {
      const f = g.camera.getWorldDirection(new V3());
      for (const b of gr.owner.bodies) b.vel.addScaledVector(f, gr.npc ? 11 : 14).add(_v1.set(0, 2, 0));
      g.audio.play('throw', { gain: 0.8 });
      if (gr.npc) HT.log('sys', `Threw ${gr.npc.idStr} ${gr.npc.name}`);
    }
    if (gr.npc) { gr.npc.carried = false; gr.npc.downTimer = 1.6; gr.npc.lastReaction = throwIt ? 'Thrown (Ragdoll)' : 'Released (Ragdoll)'; }
    this.grab = null; this.beam.visible = false;
  }
  // --- move tool --------------------------------------------------------------------
  startMove() {
    const g = this.game;
    const pick = this.pickNPC(40);
    let prop = null;
    if (!pick) {
      const o = g.camera.position, d = g.camera.getWorldDirection(new V3());
      const ph = g.physics.raycast(o, d, 40, b => b.tag === 'prop');
      if (ph) prop = ph.body.owner;
      if (!prop) return;
    }
    if (prop) { this.moving = { prop, yaw: 0 }; g.physics.wakeOwner(prop); }
    else {
      const npc = pick.npc;
      this.moving = { npc, yaw: npc.root.yaw, ragdoll: npc.physMode === 'ragdoll' };
      if (npc.physMode === 'getup') { npc.anim.clip = null; npc.physMode = 'anim'; }
      if (npc.brain) { npc.brain.frozenMove = true; }
      npc.carried = true;
      HT.log('sys', `Moving ${npc.idStr} ${npc.name}`);
    }
    g.audio.play('grab', { gain: 0.4 });
  }
  rotateMoved(a) { if (this.moving) this.moving.yaw += a; }
  updateMove(dt) {
    const g = this.game, mv = this.moving;
    const p = g.player.groundTarget(40);
    this.moveRing.position.set(p.x, p.y + 0.02, p.z); this.moveRing.visible = true;
    if (mv.prop) {
      const b = mv.prop.bodies[0];
      b.pos.set(p.x, p.y + mv.prop.radius + 0.6, p.z); b.prevPos.copy(b.pos); b.vel.set(0, 0, 0); b.omega.set(0, 0, 0);
      return;
    }
    const npc = mv.npc;
    if (npc.removed) { this.endMove(); return; }
    if (npc.physMode === 'ragdoll') {
      const pel = npc.rag.bodies[RAG.PELVIS];
      const off = _v1.set(p.x - pel.pos.x, 0, p.z - pel.pos.z);
      const lift = Math.max(0, p.y + 0.5 - pel.pos.y);
      off.y = lift * 0.2;
      for (const b of npc.rag.bodies) { b.pos.add(off); b.prevPos.add(off); b.vel.set(0, 0, 0); b.omega.set(0, 0, 0); b.sleeping = false; }
      npc.rag.asleep = false;
    } else {
      npc.teleport(p, mv.yaw);
      if (npc.brain) { npc.brain.dest.copy(p); npc.brain.vel.set(0, 0, 0); }
    }
  }
  endMove() {
    const mv = this.moving; if (!mv) return;
    if (mv.npc) {
      mv.npc.carried = false;
      if (mv.npc.brain) { mv.npc.brain.frozenMove = false; mv.npc.brain.home.copy(mv.npc.root.pos); mv.npc.brain.state = 'idle'; mv.npc.brain.idleTime = 2; }
      mv.npc.downTimer = 0.8;
      HT.log('sys', `Placed ${mv.npc.idStr} ${mv.npc.name}`);
    }
    this.moving = null; this.moveRing.visible = false;
    this.game.audio.play('drop', { gain: 0.4 });
  }
  // --- viewmodel animation ----------------------------------------------------------
  updateViewmodel(dt) {
    const g = this.game, t = this.current, m = this.models[t.id];
    if (!m) return;
    const pl = g.player;
    const ads = pl.aiming ? 1 : 0;
    m.userData.adsW = damp(m.userData.adsW || 0, ads, 12, dt);
    const aw = m.userData.adsW;
    const pos = _v1.copy(m.userData.hip).lerp(m.userData.ads, aw);
    const sp = Math.min(1, pl.vel.length() / 4);
    const bobT = this.vmTime * 9;
    pos.x += Math.sin(bobT * 0.5) * 0.008 * sp * (1 - aw * 0.8);
    pos.y += Math.abs(Math.cos(bobT * 0.5)) * 0.006 * sp * (1 - aw * 0.8) + Math.sin(this.vmTime * 1.6) * 0.0015;
    this.vmKick = damp(this.vmKick, 0, 14, dt);
    pos.z += this.vmKick * (t.id === 'sniper' ? 0.08 : 0.045);
    let rx = this.vmKick * (t.id === 'sniper' ? 0.12 : 0.18), ry = 0, rz = 0;
    // equip
    if (this.equipT > 0) { const e = this.equipT / 0.35; pos.y -= e * e * 0.25; rx -= e * 0.6; }
    // reload
    if (this.reloading > 0 && t.isGun) {
      const prog = 1 - this.reloading / t.reload;
      const w = Math.sin(Math.PI * clamp(prog * 1.1, 0, 1));
      pos.y -= w * 0.05; rz += w * 0.5; rx += w * 0.25;
      const mag = m.userData.mag;
      if (mag) {
        const out = prog < 0.25 ? smooth01(prog / 0.25) : prog < 0.5 ? 1 : prog < 0.65 ? 1 - smooth01((prog - 0.5) / 0.15) : 0;
        mag.position.copy(m.userData.magHome); mag.position.y -= out * 0.25;
        mag.visible = !(prog > 0.25 && prog < 0.42);
      }
      const la = m.userData.leftArm;
      if (la) { la.position.copy(m.userData.leftHome); const k = prog < 0.62 ? Math.sin(Math.PI * prog / 0.62) : 0; la.position.y -= k * 0.12; la.position.x -= k * 0.02; }
    } else if (m.userData.mag) { m.userData.mag.position.copy(m.userData.magHome); m.userData.mag.visible = true; if (m.userData.leftArm) m.userData.leftArm.position.copy(m.userData.leftHome); }
    // sniper bolt
    if (m.userData.bolt) {
      this.boltT = Math.max(0, this.boltT - dt);
      const bt = this.boltT > 0 ? Math.sin(Math.PI * (1 - this.boltT / 0.9)) : 0;
      m.userData.bolt.rotation.z = -bt * 1.2; m.userData.bolt.position.z = 0.03 + bt * 0.05;
    }
    // slide kick
    if (m.userData.slide) m.userData.slide.position.z = -0.08 + this.vmKick * 0.03;
    // knife swing
    if (t.melee && this.swingT > 0) {
      this.swingT -= dt;
      const s = 1 - this.swingT / 0.32, d = this.swingDir || 1;
      const arc = Math.sin(Math.PI * s);
      pos.x -= arc * 0.18 * d; pos.z -= arc * 0.12; pos.y += arc * 0.04;
      ry += arc * 0.9 * d; rz += arc * 0.6 * d; rx -= arc * 0.3;
    }
    // grenade charge/throw
    if (t.throwable) {
      const nade = m.userData.nade;
      if (this.charging) { pos.z += this.charge * 0.1; pos.y += this.charge * 0.06; rx -= this.charge * 0.6; }
      if (this.throwT > 0) {
        this.throwT -= dt;
        const s = 1 - this.throwT / 0.45;
        pos.z -= Math.sin(Math.PI * s) * 0.2; rx += Math.sin(Math.PI * s) * 0.9;
        nade.visible = s > 0.95;
      } else nade.visible = this.ammo.grenade.mag > 0 || Settings.data.weapons.infiniteAmmo;
    }
    if (m.userData.glow) {
      const active = this.grab || this.moving;
      m.userData.glow.material.opacity = active ? 0.85 + Math.sin(this.vmTime * 12) * 0.15 : 0.25;
    }
    // flash
    if (m.userData.flash) {
      this.flashT = Math.max(0, (this.flashT || 0) - dt);
      m.userData.flash.material.opacity = this.flashT > 0 ? 1 : 0;
      m.userData.flash.scale.setScalar(this.flashT > 0 ? 0.8 + Math.random() * 0.6 : 1);
    }
    this.vmLight.intensity = damp(this.vmLight.intensity, 0, 30, dt);
    // look sway (lag behind mouse)
    const lagX = clamp(g.input.mouse.dx * 0.0004, -0.03, 0.03), lagY = clamp(g.input.mouse.dy * 0.0004, -0.03, 0.03);
    this.sway = this.sway || new V3();
    this.sway.x = damp(this.sway.x, -lagX, 10, dt); this.sway.y = damp(this.sway.y, lagY, 10, dt);
    pos.x += this.sway.x * (1 - aw); pos.y += this.sway.y * (1 - aw);
    m.position.copy(pos);
    const base = t.id === 'knife' ? new THREE.Euler(0.15, 0.25, -0.45) : new THREE.Euler(0, 0, 0);
    m.rotation.set(base.x + rx, base.y + ry + this.sway.x * 2, base.z + rz);
    // hide viewmodel when scoped
    this.vmRoot.visible = !(t.scope && pl.aiming && pl.cam.fov < Settings.data.controls.fov / 2.2);
  }
  render(renderer) {
    this.vmCam.aspect = this.game.camera.aspect; this.vmCam.updateProjectionMatrix();
    this.vmScene.environment = this.game.scene.environment;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.vmScene, this.vmCam);
    renderer.autoClear = true;
  }
  clearAll() {
    for (const gr of this.grenades) this.removeGrenade(gr);
    this.grenades.length = 0; this.projectiles.length = 0;
    if (this.grab) this.releaseGrab(false);
    if (this.moving) this.endMove();
  }
}
HT.Weapons = Weapons;
