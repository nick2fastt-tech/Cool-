// ============================================================================
// Input + invisible spectator player (free-fly camera), touch controls, props
// ============================================================================
class Input {
  constructor(game) {
    this.game = game; this.keys = Object.create(null); this.pressed = Object.create(null);
    this.mouse = { dx: 0, dy: 0, buttons: 0, wheel: 0, down: [false, false, false], clicked: [false, false, false], x: 0, y: 0 };
    this.locked = false; this.dragLook = false; this.touch = { move: new THREE.Vector2(), lookDx: 0, lookDy: 0, fire: false, aim: false, up: false, down: false, active: false };
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.lockFailed = false;
    this.bind();
  }
  bind() {
    const c = this.game.renderer.domElement;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.code;
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'F3', 'Backquote'].includes(k)) e.preventDefault();
      this.game.audio && this.game.audio.unlock();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = Object.create(null); this.mouse.down = [false, false, false]; });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('mousedown', (e) => {
      this.game.audio && this.game.audio.unlock();
      if (this.isTouchEvent) return;
      if (!this.locked && !this.lockFailed && e.button === 0 && !this.game.ui.drawerOpen) {
        this.requestLock();
        this.suppressClick = true;
        return;
      }
      this.mouse.down[e.button] = true; this.mouse.clicked[e.button] = true;
      if (!this.locked) { this.dragStart = { x: e.clientX, y: e.clientY }; }
    });
    window.addEventListener('mouseup', (e) => { this.mouse.down[e.button] = false; this.suppressClick = false; });
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
      else if (this.lockFailed && (this.mouse.down[2] || this.mouse.down[1] || (this.mouse.down[0] && this.game.weapons && this.game.weapons.current && this.game.weapons.current.id === 'move'))) {
        this.mouse.dx += e.movementX; this.mouse.dy += e.movementY;
      }
    });
    c.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === c;
      Events.emit('lock', this.locked);
    });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; this.locked = false; Events.emit('lock', false); HT.toast('Pointer lock unavailable: right-drag to look, left-click to use tool', 'warn'); });
  }
  requestLock() {
    const c = this.game.renderer.domElement;
    try {
      const p = c.requestPointerLock && c.requestPointerLock();
      if (p && p.catch) p.catch(() => { this.lockFailed = true; Events.emit('lock', false); });
    } catch (e) { this.lockFailed = true; }
  }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }
  wasPressed(code) { const v = !!this.pressed[code]; return v; }
  endFrame() {
    this.pressed = Object.create(null);
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0; this.mouse.clicked = [false, false, false];
    this.touch.lookDx = 0; this.touch.lookDy = 0;
  }
  // touch controls --------------------------------------------------------------------
  setupTouch() {
    const T = this.touch;
    const el = (id) => document.getElementById(id);
    const joyZone = el('joyZone'), lookZone = el('lookZone'), joy = el('joy'), knob = joy.querySelector('i');
    let joyId = null, joyCx = 0, joyCy = 0, lookId = null, lx = 0, ly = 0, lookStart = 0, lookMoved = 0;
    joyZone.addEventListener('touchstart', (e) => {
      this.game.audio && this.game.audio.unlock();
      const t = e.changedTouches[0]; joyId = t.identifier; joyCx = t.clientX; joyCy = t.clientY;
      joy.style.display = 'block'; joy.style.left = (joyCx - 60) + 'px'; joy.style.top = (joyCy - 60) + 'px';
      knob.style.transform = 'translate(0px,0px)'; e.preventDefault();
    }, { passive: false });
    const moveJoy = (e) => {
      for (const t of e.changedTouches) if (t.identifier === joyId) {
        let dx = t.clientX - joyCx, dy = t.clientY - joyCy; const d = Math.hypot(dx, dy), m = 50;
        if (d > m) { dx *= m / d; dy *= m / d; }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        T.move.set(dx / m, -dy / m);
      }
      e.preventDefault();
    };
    const endJoy = (e) => { for (const t of e.changedTouches) if (t.identifier === joyId) { joyId = null; T.move.set(0, 0); joy.style.display = 'none'; } };
    joyZone.addEventListener('touchmove', moveJoy, { passive: false });
    joyZone.addEventListener('touchend', endJoy); joyZone.addEventListener('touchcancel', endJoy);
    lookZone.addEventListener('touchstart', (e) => {
      this.game.audio && this.game.audio.unlock();
      const t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY; lookStart = performance.now(); lookMoved = 0; e.preventDefault();
    }, { passive: false });
    lookZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookId) {
        T.lookDx += (t.clientX - lx); T.lookDy += (t.clientY - ly); lookMoved += Math.abs(t.clientX - lx) + Math.abs(t.clientY - ly);
        lx = t.clientX; ly = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });
    const endLook = (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookId) {
        lookId = null;
        if (performance.now() - lookStart < 250 && lookMoved < 12) T.tap = { x: t.clientX, y: t.clientY };
      }
    };
    lookZone.addEventListener('touchend', endLook); lookZone.addEventListener('touchcancel', endLook);
    const hold = (id, key) => {
      const b = el(id);
      b.addEventListener('touchstart', (e) => { T[key] = true; b.classList.add('active'); this.game.audio && this.game.audio.unlock(); e.preventDefault(); }, { passive: false });
      const up = () => { T[key] = false; b.classList.remove('active'); };
      b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
      b.addEventListener('mousedown', (e) => { T[key] = true; b.classList.add('active'); e.preventDefault(); });
      b.addEventListener('mouseup', up); b.addEventListener('mouseleave', up);
    };
    hold('tFire', 'fire'); hold('tAim', 'aimHold'); hold('tUp', 'up'); hold('tDown', 'down');
    const tap = (id, fn) => { const b = el(id); b.addEventListener('touchstart', (e) => { fn(); e.preventDefault(); }, { passive: false }); b.addEventListener('click', fn); };
    tap('tReload', () => { T.reload = true; });
    tap('tNext', () => { T.next = true; });
    tap('tSelect', () => { T.select = true; });
  }
}

class Player {
  constructor(game) {
    this.game = game; this.cam = game.camera;
    this.yaw = Math.PI; this.pitch = -0.12; this.vel = new V3();
    this.cam.position.set(0, 1.7, 7);
    this.fov = Settings.data.controls.fov; this.zoom = 1; this.aiming = false;
    this.shake = 0; this.recoil = 0; this.recoilYaw = 0;
    this.eyeHeight = 1.7;
  }
  forward(out = new V3()) { return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }
  right(out = new V3()) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  aimRay(origin, dir) { origin.copy(this.cam.position); this.cam.getWorldDirection(dir); return dir; }
  groundTarget(maxD = 8) {
    const o = this.cam.position, d = this.cam.getWorldDirection(new V3());
    const env = this.game.env;
    let t = maxD;
    if (d.y < -0.02) {
      // march to the ground
      for (let s = 0.25; s <= maxD; s += 0.25) { const y = o.y + d.y * s; const gx = o.x + d.x * s, gz = o.z + d.z * s; if (y <= env.groundHeight(gx, gz)) { t = s; break; } }
    }
    const p = o.clone().addScaledVector(d, t);
    p.y = env.groundHeight(p.x, p.z);
    env.clampToBounds(p, 0.6);
    return p;
  }
  update(dt) {
    const game = this.game, inp = game.input, S = Settings.data.controls;
    const sens = 0.0022 * S.sensitivity * (this.aiming ? 0.45 / Math.max(1, this.zoom * 0.5) : 1);
    let dx = inp.mouse.dx, dy = inp.mouse.dy;
    dx += inp.touch.lookDx * 2.2; dy += inp.touch.lookDy * 2.2;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens * (S.invertY ? -1 : 1);
    if (!inp.locked && !inp.lockFailed) {
      // arrow keys look when not locked
      if (inp.keys.ArrowLeft) this.yaw += 1.8 * dt; if (inp.keys.ArrowRight) this.yaw -= 1.8 * dt;
      if (inp.keys.ArrowUp) this.pitch += 1.2 * dt; if (inp.keys.ArrowDown) this.pitch -= 1.2 * dt;
    }
    this.pitch = clamp(this.pitch, -1.5, 1.5);
    // movement
    const k = inp.keys;
    const fwd = _v1.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const rgt = _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const mv = _v3.set(0, 0, 0);
    if (k.KeyW) mv.add(fwd); if (k.KeyS) mv.sub(fwd); if (k.KeyD) mv.add(rgt); if (k.KeyA) mv.sub(rgt);
    if (inp.touch.move.lengthSq() > 0.01) { mv.addScaledVector(fwd, inp.touch.move.y); mv.addScaledVector(rgt, inp.touch.move.x); }
    let up = 0;
    if (k.Space || k.KeyE || inp.touch.up) up += 1; if (k.ControlLeft || k.KeyQ || k.KeyC || inp.touch.down) up -= 1;
    const speed = (k.ShiftLeft || k.ShiftRight ? 9 : 4.2) * (this.aiming ? 0.5 : 1);
    if (mv.lengthSq() > 1) mv.normalize();
    const target = _v4.copy(mv).multiplyScalar(speed); target.y = up * speed * 0.7;
    this.vel.x = damp(this.vel.x, target.x, 10, dt); this.vel.y = damp(this.vel.y, target.y, 10, dt); this.vel.z = damp(this.vel.z, target.z, 10, dt);
    const p = this.cam.position;
    p.addScaledVector(this.vel, dt);
    // stay inside environment
    const env = game.env.current;
    if (env) {
      const b = env.bounds;
      p.x = clamp(p.x, b.minX - 0.3, b.maxX + 0.3); p.z = clamp(p.z, b.minZ - 0.3, b.maxZ + 0.3);
      const gy = game.env.groundHeight(p.x, p.z) + 0.25;
      if (p.y < gy) p.y = gy;
      const maxY = env.kind === 'room' ? env.Ht - 0.3 : 60;
      if (p.y > maxY) p.y = maxY;
    }
    // recoil + shake
    this.recoil = damp(this.recoil, 0, 9, dt); this.recoilYaw = damp(this.recoilYaw, 0, 9, dt);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake * this.shake * 0.04;
    const t = game.time;
    const ePitch = this.pitch + this.recoil + Math.sin(t * 37) * sh, eYaw = this.yaw + this.recoilYaw + Math.cos(t * 41) * sh;
    this.cam.rotation.set(0, 0, 0); this.cam.rotation.order = 'YXZ';
    this.cam.rotation.y = eYaw; this.cam.rotation.x = ePitch;
    // fov / zoom
    const fovT = Settings.data.controls.fov / (this.aiming ? this.zoom : 1);
    const nf = damp(this.cam.fov, fovT, 14, dt);
    if (Math.abs(nf - this.cam.fov) > 0.01) { this.cam.fov = nf; this.cam.updateProjectionMatrix(); }
  }
  addShake(a) { this.shake = Math.min(1.5, this.shake + a); }
}

// ----------------------------------------------------------------------------
// Props: crates, balls, barrels (rigid bodies)
class Props {
  constructor(game) { this.game = game; this.list = []; this.geo = {}; this.mats = {}; }
  build() {
    const cr = Tex.make('crate', 128, 128, (g, w, h) => {
      g.fillStyle = '#9a7244'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? 'rgba(80,55,30,0.35)' : 'rgba(170,130,80,0.25)'; g.fillRect(0, i * h / 6, w, h / 12); }
      g.strokeStyle = '#5a3e22'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
      g.beginPath(); g.moveTo(8, 8); g.lineTo(w - 8, h - 8); g.stroke();
    });
    this.mats.crate = new THREE.MeshStandardMaterial({ map: cr, roughness: 0.85 });
    this.mats.ball = new THREE.MeshStandardMaterial({ color: 0xd94a3a, roughness: 0.45 });
    this.mats.barrel = new THREE.MeshStandardMaterial({ color: 0x2f6aa8, roughness: 0.5, metalness: 0.35 });
    this.mats.dummy = new THREE.MeshStandardMaterial({ color: 0xc9b38a, roughness: 0.7 });
  }
  spawn(type, pos) {
    let shape, mass, mesh, radius;
    if (type === 'ball') {
      shape = { type: SHAPE.SPHERE, r: 0.24 }; mass = 2.5; radius = 0.24;
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), this.mats.ball);
    } else if (type === 'barrel') {
      shape = { type: SHAPE.CAPSULE, r: 0.28, hh: 0.2 }; mass = 35; radius = 0.3;
      const g = new THREE.CapsuleGeometry(0.28, 0.4, 6, 16);
      mesh = new THREE.Mesh(g, this.mats.barrel);
    } else {
      const s = type === 'bigcrate' ? 0.55 : 0.35;
      shape = { type: SHAPE.BOX, he: new V3(s, s, s) }; mass = type === 'bigcrate' ? 60 : 18; radius = s * 1.2;
      mesh = new THREE.Mesh(new THREE.BoxGeometry(s * 2, s * 2, s * 2), this.mats.crate);
      type = type === 'bigcrate' ? 'bigcrate' : 'crate';
    }
    const body = new RBody(shape, mass);
    const prop = { type, body, mesh, radius, physKind: 'prop', bodies: [body], canSleep: true, asleep: false, sleepTimer: 0, id: ++NPC_SEQ };
    body.owner = prop; body.tag = 'prop';
    body.friction = type === 'ball' ? 0.5 : 0.7; body.restitution = type === 'ball' ? 0.65 : 0.12;
    body.linDamp = 0.05; body.angDamp = type === 'ball' ? 0.3 : 0.1;
    body.pos.copy(pos); body.pos.y = Math.max(pos.y, this.game.env.groundHeight(pos.x, pos.z) + radius + 0.02);
    body.prevPos.copy(body.pos);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.game.scene.add(mesh);
    this.game.physics.addBody(body); this.game.physics.owners.add(prop);
    this.list.push(prop);
    this.sync(prop);
    return prop;
  }
  sync(p) { p.mesh.position.copy(p.body.pos); p.mesh.quaternion.copy(p.body.rot); }
  update() { for (const p of this.list) this.sync(p); }
  remove(p) {
    const i = this.list.indexOf(p); if (i < 0) return;
    this.list.splice(i, 1);
    this.game.scene.remove(p.mesh); p.mesh.geometry.dispose();
    this.game.physics.removeBody(p.body); this.game.physics.removeOwner(p);
  }
  clear() { for (const p of this.list.slice()) this.remove(p); }
}
HT.Props = Props;
