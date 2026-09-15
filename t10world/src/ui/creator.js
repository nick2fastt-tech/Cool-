// T10 World - character creator. A live 3D preview with every slider the brief
// asks for, shown before you spawn into the world.
import * as THREE from '../../vendor/three.module.js';
import { Human } from '../human/human.js';
import { defaultPlayerAppearance, generateAppearance, VOICE_PRESETS, PERSONALITIES } from '../human/appearance.js';
import { SKIN_TONES, EYE_COLORS, HAIR_COLORS } from '../human/textures.js';
import { HAIR_STYLES } from '../human/hair.js';
import { OUTFITS } from '../human/clothing.js';
import { HEIGHT_RANGE } from '../human/skeleton.js';
import { STATES } from '../human/animator.js';
import { metersToFeetInches, clampv, clamp01, lerpv, TAU } from '../core/math.js';
import { audio } from '../core/audio.js';

function el(tag, cls, parent, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}

export class CharacterCreator {
  constructor(renderer, root, onDone) {
    this.renderer = renderer;
    this.root = root;
    this.onDone = onDone;
    this.active = false;

    this.appearance = defaultPlayerAppearance('male');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0d10);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    this.orbit = { yaw: 0.35, pitch: 0.02, dist: 3.4, targetY: 1.0, autoSpin: true };
    this.dragging = false;
    this.rebuildPending = false;
    this.buildScene();
    this.buildUI();
  }

  buildScene() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0x5d7fae, 0x1a1a1e, 0.55));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.6);
    key.position.set(2.2, 3.4, 3.0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 14;
    key.shadow.camera.left = -2; key.shadow.camera.right = 2;
    key.shadow.camera.top = 3; key.shadow.camera.bottom = -0.5;
    key.shadow.bias = -0.0008;
    s.add(key);
    const rim = new THREE.DirectionalLight(0x5aa0ff, 1.5);
    rim.position.set(-2.6, 2.0, -2.4);
    s.add(rim);
    const fill = new THREE.DirectionalLight(0xffb070, 0.5);
    fill.position.set(-2.0, 1.0, 2.4);
    s.add(fill);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 48),
      new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.55, metalness: 0.25 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.22, 64),
      new THREE.MeshBasicMaterial({ color: 0x2fd98a, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    s.add(ring);
    this.ring = ring;

    this.rebuildHuman();
  }

  rebuildHuman() {
    if (this.human) { this.scene.remove(this.human.root); this.human.dispose(); }
    this.human = new Human(this.appearance, { tier: 'player' });
    this.human.setGroundSampler(() => ({ y: 0, normal: new THREE.Vector3(0, 1, 0) }));
    this.human.animator.setState(STATES.IDLE);
    this.scene.add(this.human.root);
    this.orbit.targetY = this.appearance.body.height * 0.56;
  }

  // -------------------------------------------------------------------------
  buildUI() {
    this.panel = el('div', 't10-creator', this.root);
    this.panel.style.display = 'none';

    const canvasWrap = el('div', 't10-creator-view', this.panel);
    this.viewport = canvasWrap;
    canvasWrap.addEventListener('pointerdown', (e) => {
      this.dragging = true; this.orbit.autoSpin = false;
      this.lastX = e.clientX; this.lastY = e.clientY;
      canvasWrap.setPointerCapture(e.pointerId);
    });
    canvasWrap.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.orbit.yaw -= (e.clientX - this.lastX) * 0.008;
      this.orbit.pitch = clampv(this.orbit.pitch + (e.clientY - this.lastY) * 0.005, -0.5, 0.6);
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
    const stop = () => { this.dragging = false; };
    canvasWrap.addEventListener('pointerup', stop);
    canvasWrap.addEventListener('pointercancel', stop);
    canvasWrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.orbit.dist = clampv(this.orbit.dist + Math.sign(e.deltaY) * 0.28, 1.2, 6);
    }, { passive: false });

    const side = el('div', 't10-creator-side', this.panel);
    el('h1', 't10-creator-title', side, 'T10 WORLD');
    el('p', 't10-creator-sub', side, 'Build yourself. You can change any of it later — just ask T10.');

    // ---- Tabs ----
    const tabRow = el('div', 't10-creator-tabs', side);
    this.tabs = {};
    this.pages = {};
    const pageWrap = el('div', 't10-creator-pages', side);
    for (const name of ['Body', 'Face', 'Hair', 'Style', 'You']) {
      const t = el('button', 't10-creator-tab', tabRow, name);
      const p = el('div', 't10-creator-page', pageWrap);
      p.style.display = 'none';
      t.addEventListener('click', () => this.showTab(name));
      this.tabs[name] = t;
      this.pages[name] = p;
    }

    this.buildBodyPage(this.pages.Body);
    this.buildFacePage(this.pages.Face);
    this.buildHairPage(this.pages.Hair);
    this.buildStylePage(this.pages.Style);
    this.buildYouPage(this.pages.You);
    this.showTab('Body');

    const foot = el('div', 't10-creator-foot', side);
    const rand = el('button', 't10-creator-btn ghost', foot, 'Randomise');
    rand.addEventListener('click', () => {
      const g = this.appearance.gender;
      const a = generateAppearance({ gender: g });
      a.name = this.appearance.name;
      this.appearance = a;
      this.rebuildHuman();
      this.syncControls();
      audio.ui('tick');
    });
    const enter = el('button', 't10-creator-btn primary', foot, 'Enter the world');
    enter.addEventListener('click', () => {
      audio.ui('confirm');
      this.finish();
    });
  }

  showTab(name) {
    for (const k in this.tabs) {
      this.tabs[k].classList.toggle('active', k === name);
      this.pages[k].style.display = k === name ? 'block' : 'none';
    }
  }

  slider(parent, label, min, max, step, value, fmt, onChange) {
    const row = el('div', 't10-cr-slider', parent);
    const top = el('div', 't10-cr-slider-top', row);
    el('span', '', top, label);
    const val = el('span', 't10-cr-slider-val', top, fmt(value));
    const input = el('input', '', row);
    input.type = 'range';
    input.min = String(min); input.max = String(max); input.step = String(step);
    input.value = String(value);
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      val.textContent = fmt(v);
      onChange(v);
    });
    return { row, input, val, set: (v) => { input.value = String(v); val.textContent = fmt(v); } };
  }

  swatches(parent, label, items, getHex, current, onPick) {
    el('div', 't10-cr-label', parent, label);
    const grid = el('div', 't10-cr-swatches', parent);
    const btns = [];
    items.forEach((item, i) => {
      const b = el('button', 't10-cr-swatch', grid);
      b.style.background = '#' + getHex(item).toString(16).padStart(6, '0');
      b.title = item.name || String(i);
      b.addEventListener('click', () => {
        for (const o of btns) o.classList.remove('active');
        b.classList.add('active');
        onPick(item, i);
        audio.ui('tick');
      });
      if (i === current) b.classList.add('active');
      btns.push(b);
    });
    return btns;
  }

  choices(parent, label, items, current, onPick) {
    el('div', 't10-cr-label', parent, label);
    const row = el('div', 't10-cr-choices', parent);
    const btns = [];
    items.forEach((item, i) => {
      const b = el('button', 't10-cr-choice', row, item.label || item.name);
      b.addEventListener('click', () => {
        for (const o of btns) o.classList.remove('active');
        b.classList.add('active');
        onPick(item, i);
        audio.ui('tick');
      });
      if (i === current) b.classList.add('active');
      btns.push(b);
    });
    return btns;
  }

  // ---- Pages ---------------------------------------------------------------
  buildBodyPage(p) {
    this.genderBtns = this.choices(p, 'Gender', [{ label: 'Male' }, { label: 'Female' }],
      this.appearance.gender === 'female' ? 1 : 0,
      (item, i) => {
        const g = i === 1 ? 'female' : 'male';
        const keepName = this.appearance.name;
        this.appearance = defaultPlayerAppearance(g);
        this.appearance.name = keepName;
        this.rebuildHuman();
        this.syncControls();
      });

    const r = HEIGHT_RANGE[this.appearance.gender];
    this.heightSlider = this.slider(p, 'Height', r.min, r.max, 0.005, this.appearance.body.height,
      (v) => metersToFeetInches(v) + '  (' + Math.round(v * 100) + 'cm)',
      (v) => { this.appearance.body.height = v; this.queueRebuild(); });
    this.heightNote = el('div', 't10-cr-note', p, '');
    this.updateHeightNote();

    this.weightSlider = this.slider(p, 'Weight', 0, 1, 0.01, this.appearance.body.weight,
      (v) => v < 0.25 ? 'Slim' : v < 0.45 ? 'Lean' : v < 0.6 ? 'Average' : v < 0.78 ? 'Solid' : 'Heavy',
      (v) => { this.appearance.body.weight = v; this.queueRebuild(); });
    this.muscleSlider = this.slider(p, 'Build', 0, 1, 0.01, this.appearance.body.muscle,
      (v) => v < 0.25 ? 'Soft' : v < 0.5 ? 'Toned' : v < 0.75 ? 'Athletic' : 'Powerful',
      (v) => { this.appearance.body.muscle = v; this.queueRebuild(); });
    this.shoulderSlider = this.slider(p, 'Shoulders', 0.85, 1.18, 0.01, this.appearance.body.shoulderWidth,
      (v) => v < 0.95 ? 'Narrow' : v < 1.06 ? 'Average' : 'Broad',
      (v) => { this.appearance.body.shoulderWidth = v; this.queueRebuild(); });
    this.hipSlider = this.slider(p, 'Hips', 0.85, 1.20, 0.01, this.appearance.body.hipWidth,
      (v) => v < 0.95 ? 'Narrow' : v < 1.08 ? 'Average' : 'Wide',
      (v) => { this.appearance.body.hipWidth = v; this.queueRebuild(); });
    this.legSlider = this.slider(p, 'Leg length', 0.92, 1.10, 0.01, this.appearance.body.legLength,
      (v) => v < 0.97 ? 'Short' : v < 1.04 ? 'Average' : 'Long',
      (v) => { this.appearance.body.legLength = v; this.queueRebuild(); });
    this.postureSlider = this.slider(p, 'Posture', -1, 1, 0.05, this.appearance.body.posture,
      (v) => v < -0.3 ? 'Slouched' : v < 0.3 ? 'Relaxed' : 'Upright',
      (v) => { this.appearance.body.posture = v; this.queueRebuild(); });
  }

  updateHeightNote() {
    const r = HEIGHT_RANGE[this.appearance.gender];
    this.heightNote.textContent = this.appearance.gender === 'female'
      ? 'Female range: ' + metersToFeetInches(r.min) + ' to ' + metersToFeetInches(r.max)
      : 'Male range: ' + metersToFeetInches(r.min) + ' to ' + metersToFeetInches(r.max);
  }

  buildFacePage(p) {
    this.skinSwatches = this.swatches(p, 'Skin tone', SKIN_TONES, (t) => t.hex, this.appearance.toneIndex,
      (t, i) => { this.appearance.toneIndex = i; this.appearance.skinToneName = t.name; this.human.setSkinTone(i); });
    this.eyeSwatches = this.swatches(p, 'Eye colour', EYE_COLORS, (t) => t.hex,
      EYE_COLORS.findIndex((e) => e.hex === this.appearance.eyeColor),
      (t) => { this.appearance.eyeColor = t.hex; this.appearance.eyeColorName = t.name; this.human.setEyeColor(t.hex); });

    this.noseSlider = this.slider(p, 'Nose', 0.78, 1.30, 0.01, this.appearance.face.noseSize,
      (v) => v < 0.9 ? 'Small' : v < 1.1 ? 'Average' : 'Prominent',
      (v) => { this.appearance.face.noseSize = v; this.queueRebuild(); });
    this.jawSlider = this.slider(p, 'Jaw', 0.80, 1.20, 0.01, this.appearance.face.jawWidth,
      (v) => v < 0.92 ? 'Soft' : v < 1.06 ? 'Average' : 'Strong',
      (v) => { this.appearance.face.jawWidth = v; this.queueRebuild(); });
    this.cheekSlider = this.slider(p, 'Cheekbones', 0.80, 1.28, 0.01, this.appearance.face.cheekbone,
      (v) => v < 0.92 ? 'Flat' : v < 1.1 ? 'Average' : 'High',
      (v) => { this.appearance.face.cheekbone = v; this.queueRebuild(); });
    this.chinSlider = this.slider(p, 'Chin', 0.80, 1.22, 0.01, this.appearance.face.chinPoint,
      (v) => v < 0.92 ? 'Receding' : v < 1.08 ? 'Average' : 'Strong',
      (v) => { this.appearance.face.chinPoint = v; this.queueRebuild(); });
    this.eyeSizeSlider = this.slider(p, 'Eye size', 0.88, 1.16, 0.01, this.appearance.face.eyeSize,
      (v) => v < 0.95 ? 'Small' : v < 1.06 ? 'Average' : 'Large',
      (v) => { this.appearance.face.eyeSize = v; this.queueRebuild(); });
    this.lipSlider = this.slider(p, 'Lips', 0.1, 1.0, 0.01, this.appearance.face.lipFullness,
      (v) => v < 0.35 ? 'Thin' : v < 0.65 ? 'Average' : 'Full',
      (v) => { this.appearance.face.lipFullness = v; this.appearance.lipFullness = v; this.queueRebuild(); });
    this.ageSlider = this.slider(p, 'Age', 0, 1, 0.01, this.appearance.age,
      (v) => Math.round(lerpv(17, 78, v)) + ' years',
      (v) => { this.appearance.age = v; this.appearance.ageYears = Math.round(lerpv(17, 78, v)); this.queueRebuild(); });
    this.stubbleSlider = this.slider(p, 'Stubble', 0, 1, 0.05, this.appearance.stubble,
      (v) => v < 0.1 ? 'Clean' : v < 0.45 ? 'Light' : v < 0.8 ? 'Stubble' : 'Beard',
      (v) => { this.appearance.stubble = v; this.appearance.beard = v > 0.6 ? v : 0; this.queueRebuild(); });
  }

  buildHairPage(p) {
    this.hairStyleBtns = this.choices(p, 'Hairstyle',
      HAIR_STYLES.map((s) => ({ label: s.name })),
      HAIR_STYLES.findIndex((s) => s.id === this.appearance.hairStyle),
      (item, i) => { this.appearance.hairStyle = HAIR_STYLES[i].id; this.human.setHairStyle(HAIR_STYLES[i].id); });
    el('div', 't10-cr-note', p, HAIR_STYLES.map((s) => s.name + ' — ' + s.blurb).join('  ·  '));
    this.hairColorSwatches = this.swatches(p, 'Hair colour', HAIR_COLORS, (t) => t.hex,
      HAIR_COLORS.findIndex((c) => c.hex === this.appearance.hairColor),
      (t) => {
        this.appearance.hairColor = t.hex;
        this.appearance.hairColorName = t.name;
        this.appearance.browColor = t.hex;
        this.human.setHairColor(t.hex);
      });
    this.browSlider = this.slider(p, 'Eyebrows', 0, 1, 0.05, this.appearance.browThickness,
      (v) => v < 0.3 ? 'Fine' : v < 0.7 ? 'Average' : 'Thick',
      (v) => { this.appearance.browThickness = v; this.queueRebuild(); });
  }

  buildStylePage(p) {
    const list = OUTFITS[this.appearance.gender];
    this.outfitBtns = this.choices(p, 'Outfit', list.map((o) => ({ label: o.name })), this.appearance.outfitIndex,
      (item, i) => {
        this.appearance.outfitIndex = i;
        this.human.setOutfit(i);
        this.outfitBlurb.textContent = OUTFITS[this.appearance.gender][i].blurb;
      });
    this.outfitBlurb = el('div', 't10-cr-note', p, list[this.appearance.outfitIndex].blurb);
    el('div', 't10-cr-note', p, 'Three outfits for now. Ask T10 for something new any time — "T10 I wanna wear something new".');
    this.stylePage = p;
  }

  buildYouPage(p) {
    el('div', 't10-cr-label', p, 'Name');
    const nameInput = el('input', 't10-cr-text', p);
    nameInput.type = 'text';
    nameInput.value = this.appearance.name === 'You' ? '' : this.appearance.name;
    nameInput.placeholder = 'Your name';
    nameInput.maxLength = 24;
    nameInput.addEventListener('input', () => {
      const v = nameInput.value.trim();
      this.appearance.name = v || 'You';
      this.appearance.firstName = (v || 'You').split(/\s+/)[0];
    });
    this.nameInput = nameInput;

    this.voiceBtns = this.choices(p, 'Voice', VOICE_PRESETS.map((v) => ({ label: v.name })), this.appearance.voiceIndex,
      (item, i) => {
        const v = VOICE_PRESETS[i];
        this.appearance.voiceIndex = i;
        this.appearance.voicePitch = v.pitch;
        this.appearance.voiceRate = v.rate;
        this.appearance.voiceName = v.name;
        audio.speak('This is how I sound.', {
          gender: this.appearance.gender, pitch: v.pitch, rate: v.rate, voiceIndex: i,
        }, { interrupt: true });
      });

    this.personalityBtns = this.choices(p, 'Personality', PERSONALITIES.map((x) => ({ label: x.name })),
      PERSONALITIES.findIndex((x) => x.id === this.appearance.personality),
      (item, i) => {
        const x = PERSONALITIES[i];
        Object.assign(this.appearance, {
          personality: x.id, personalityName: x.name, social: x.social,
          energyTrait: x.energy, patience: x.patience, curiosity: x.curiosity,
        });
        this.personalityBlurb.textContent = x.blurb;
      });
    this.personalityBlurb = el('div', 't10-cr-note', p,
      (PERSONALITIES.find((x) => x.id === this.appearance.personality) || PERSONALITIES[0]).blurb);

    el('div', 't10-cr-note', p,
      'You wake up on the street. There is no story and nothing to complete. ' +
      'Tap the T10 orb at the top of the screen and tell it what you want.');
  }

  /** Rebuilding the skeleton is expensive — coalesce slider drags into one. */
  queueRebuild() {
    this.rebuildPending = true;
    clearTimeout(this._rebuildTimer);
    this._rebuildTimer = setTimeout(() => {
      this.rebuildHuman();
      this.rebuildPending = false;
    }, 90);
  }

  syncControls() {
    const a = this.appearance;
    const r = HEIGHT_RANGE[a.gender];
    this.heightSlider.input.min = String(r.min);
    this.heightSlider.input.max = String(r.max);
    this.heightSlider.set(a.body.height);
    this.updateHeightNote();
    this.weightSlider.set(a.body.weight);
    this.muscleSlider.set(a.body.muscle);
    this.shoulderSlider.set(a.body.shoulderWidth);
    this.hipSlider.set(a.body.hipWidth);
    this.legSlider.set(a.body.legLength);
    this.postureSlider.set(a.body.posture);
    this.noseSlider.set(a.face.noseSize);
    this.jawSlider.set(a.face.jawWidth);
    this.cheekSlider.set(a.face.cheekbone);
    this.chinSlider.set(a.face.chinPoint);
    this.eyeSizeSlider.set(a.face.eyeSize);
    this.lipSlider.set(a.face.lipFullness);
    this.ageSlider.set(a.age);
    this.stubbleSlider.set(a.stubble);
    this.browSlider.set(a.browThickness);
    const mark = (btns, idx) => btns.forEach((b, i) => b.classList.toggle('active', i === idx));
    mark(this.genderBtns, a.gender === 'female' ? 1 : 0);
    mark(this.skinSwatches, a.toneIndex);
    mark(this.eyeSwatches, EYE_COLORS.findIndex((e) => e.hex === a.eyeColor));
    mark(this.hairStyleBtns, HAIR_STYLES.findIndex((s) => s.id === a.hairStyle));
    mark(this.hairColorSwatches, HAIR_COLORS.findIndex((c) => c.hex === a.hairColor));
    // The outfit list changes with gender, so rebuild that page in place.
    this.stylePage.innerHTML = '';
    this.buildStylePage(this.stylePage);
    mark(this.voiceBtns, a.voiceIndex);
    mark(this.personalityBtns, PERSONALITIES.findIndex((x) => x.id === a.personality));
    if (this.nameInput) this.nameInput.value = a.name === 'You' ? '' : a.name;
  }

  open() {
    this.active = true;
    this.panel.style.display = 'flex';
  }
  close() {
    this.active = false;
    this.panel.style.display = 'none';
  }

  finish() {
    const a = JSON.parse(JSON.stringify(this.appearance));
    this.close();
    if (this.onDone) this.onDone(a);
  }

  update(dt) {
    if (!this.active) return;
    if (this.orbit.autoSpin) this.orbit.yaw += dt * 0.22;
    if (this.human) {
      this.human.update(dt, { speed: 0, turnRate: 0, grounded: true, verticalVel: 0 });
      if (this.ring) this.ring.rotation.z += dt * 0.35;
    }
    const o = this.orbit;
    const h = this.appearance.body.height;
    o.targetY = h * 0.56;
    this.camera.position.set(
      Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist,
      o.targetY + Math.sin(o.pitch) * o.dist + 0.1,
      Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist
    );
    this.camera.lookAt(0, o.targetY, 0);
  }

  render() {
    if (!this.active) return;
    const rect = this.viewport.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const hgt = Math.max(1, Math.floor(rect.height));
    if (this.camera.aspect !== w / hgt) {
      this.camera.aspect = w / hgt;
      this.camera.updateProjectionMatrix();
    }
    const r = this.renderer;
    r.setScissorTest(true);
    const dpr = r.getPixelRatio();
    const canvasRect = r.domElement.getBoundingClientRect();
    const x = Math.floor((rect.left - canvasRect.left));
    const y = Math.floor(canvasRect.height - (rect.bottom - canvasRect.top));
    r.setViewport(x, y, w, hgt);
    r.setScissor(x, y, w, hgt);
    r.setRenderTarget(null);
    r.render(this.scene, this.camera);
    r.setScissorTest(false);
    r.setViewport(0, 0, canvasRect.width, canvasRect.height);
  }

  dispose() {
    if (this.human) this.human.dispose();
    this.panel.remove();
  }
}
