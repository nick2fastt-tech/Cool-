// T10 World - the entire on-screen interface.
// By design there is almost nothing here: a settings button top-right, the T10
// orb top-centre, a contextual prompt, and the touch controls on mobile.
import { settings, QUALITY_PRESETS, QUALITY_ORDER } from '../core/settings.js';
import { audio } from '../core/audio.js';

/** Longest reply the subtitle overlay shows before pointing at the chat. */
const SUB_MAX = 240;

function el(tag, cls, parent, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}

export class HUD {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.chatOpen = false;
    this.settingsOpen = false;
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    this.build();
  }

  build() {
    const r = this.root;

    // ---- T10 orb (top centre) --------------------------------------------
    this.orb = el('button', 't10-orb', r);
    this.orb.setAttribute('aria-label', 'Open T10');
    this.orbRing = el('span', 't10-orb-ring', this.orb);
    this.orbCore = el('span', 't10-orb-core', this.orb);
    el('span', 't10-orb-label', this.orb, 'T10');
    this.orb.addEventListener('click', (e) => { e.preventDefault(); this.toggleChat(); });
    this.orb.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });

    // ---- Settings button (top right) -------------------------------------
    this.settingsBtn = el('button', 't10-settings-btn', r);
    this.settingsBtn.setAttribute('aria-label', 'Settings');
    this.settingsBtn.innerHTML = gearSVG();
    this.settingsBtn.addEventListener('click', (e) => { e.preventDefault(); this.toggleSettings(); });
    this.settingsBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });

    // ---- Interaction prompt ----------------------------------------------
    this.prompt = el('div', 't10-prompt', r);
    this.prompt.style.opacity = '0';

    // ---- Subtitle line (what NPCs and T10 say out loud) -------------------
    this.subtitle = el('div', 't10-subtitle', r);
    this.subtitle.style.opacity = '0';

    // ---- Stats readout (hidden unless asked for) -------------------------
    this.stats = el('div', 't10-stats', r);
    this.stats.style.display = 'none';

    // Crosshair — the only thing that ever joins the HUD, and only while armed.
    this.crosshair = el('div', 't10-cross', r);
    this.crosshair.style.display = 'none';

    this.buildChat();
    this.buildSettings();
    if (this.isTouch) this.buildTouchControls();
  }

  // -------------------------------------------------------------------------
  buildChat() {
    this.chat = el('div', 't10-chat', this.root);
    this.chat.style.display = 'none';

    const head = el('div', 't10-chat-head', this.chat);
    const dot = el('span', 't10-chat-dot', head);
    el('span', 't10-chat-title', head, 'T10');
    el('span', 't10-chat-sub', head, 'say T10 first');
    const close = el('button', 't10-chat-close', head, '×');
    close.addEventListener('click', () => this.setChatOpen(false));

    this.chatLog = el('div', 't10-chat-log', this.chat);

    // Suggestions sit between what was said and where you type, which is where
    // you look for them.
    this.suggestions = el('div', 't10-chat-suggest', this.chat);

    const form = el('form', 't10-chat-form', this.chat);
    this.chatInput = el('input', 't10-chat-input', form);
    this.chatInput.type = 'text';
    this.chatInput.placeholder = 'T10, ...';
    this.chatInput.autocomplete = 'off';
    this.chatInput.spellcheck = false;
    const send = el('button', 't10-chat-send', form, 'Send');
    send.type = 'submit';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.chatInput.value.trim();
      if (!text) return;
      this.chatInput.value = '';
      this.game.sendToT10(text);
    });

    // They follow what is actually happening — indoors you are offered the way
    // out, armed you are offered the armoury — because a fixed list stops being
    // useful about a minute in.
    this.refreshSuggestions();
  }

  /** Six things worth saying, chosen for where you are and what you're doing. */
  refreshSuggestions() {
    if (!this.suggestions) return;
    const g = this.game;
    const out = [];
    const add = (t) => { if (out.length < 6 && out.indexOf(t) < 0) out.push(t); };

    if (g.interiors && g.interiors.inside) {
      add('T10 what rooms are in here');
      add('T10 take me outside');
    } else {
      add('T10 take me inside');
    }
    if (g.apocalypse && g.apocalypse.active) {
      add('T10 how bad is it');
      add('T10 stop the apocalypse');
    }
    if (g.arsenal && g.arsenal.armed) add('T10 put the gun away');
    if (g.player && g.player.isZombie) add('T10 turn me back');
    if (g.creatures && g.creatures.count()) add('T10 what is out there');

    // Then the evergreen ones, in a rotation so it isn't the same six forever.
    const evergreen = [
      'T10 super speed', 'T10 let me fly', 'T10 make it rain', 'T10 spawn a dog',
      'T10 take me to the beach', 'T10 what can you do', 'T10 design a creature',
      'T10 I wanna wear something new', 'T10 summon a creature', 'T10 make it midnight',
      'T10 what should I try', 'T10 how is performance',
    ];
    const offset = this._chipRotation = ((this._chipRotation || 0) + 1) % evergreen.length;
    for (let i = 0; i < evergreen.length && out.length < 6; i++) {
      add(evergreen[(offset + i) % evergreen.length]);
    }

    this.suggestions.textContent = '';
    for (const c of out) {
      const b = el('button', 't10-chip', this.suggestions, c.replace(/^T10 /, ''));
      b.type = 'button';
      b.title = c;
      b.addEventListener('click', () => { this.game.sendToT10(c); });
    }
  }

  addChatMessage(who, text) {
    const row = el('div', 't10-msg t10-msg-' + who, this.chatLog);
    el('span', 't10-msg-who', row, who === 'you' ? 'YOU' : 'T10');
    el('span', 't10-msg-text', row, text);
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
    while (this.chatLog.children.length > 80) this.chatLog.removeChild(this.chatLog.firstChild);
    // What is worth asking next depends on what just happened.
    if (who === 't10') this.refreshSuggestions();
  }

  toggleChat() { this.setChatOpen(!this.chatOpen); }

  setChatOpen(open) {
    this.chatOpen = open;
    this.chat.style.display = open ? 'flex' : 'none';
    this.orb.classList.toggle('active', open);
    audio.t10Blip(open ? 'open' : 'close');
    this.game.onChatToggled(open);
    if (open) {
      this.refreshSuggestions();
      setTimeout(() => this.chatInput.focus(), 30);
      if (this.settingsOpen) this.setSettingsOpen(false);
    } else {
      this.chatInput.blur();
    }
  }

  // -------------------------------------------------------------------------
  buildSettings() {
    this.settings = el('div', 't10-settings', this.root);
    this.settings.style.display = 'none';

    const head = el('div', 't10-set-head', this.settings);
    el('span', 't10-set-title', head, 'Settings');
    this.settingsDevice = el('span', 't10-set-device', head, settings.deviceLabel);
    const close = el('button', 't10-chat-close', head, '×');
    close.addEventListener('click', () => this.setSettingsOpen(false));

    // Each block is a card, so the panel reads as four settings rather than one
    // long strip of controls.
    const section = (label) => {
      const wrap = el('div', 't10-set-card', this.settings);
      el('div', 't10-set-label', wrap, label);
      return wrap;
    };

    // Quality
    const qCard = section('Quality');
    const qRow = el('div', 't10-set-row', qCard);
    this.qualityButtons = {};
    for (const q of QUALITY_ORDER) {
      const b = el('button', 't10-set-btn', qRow, QUALITY_PRESETS[q].label);
      b.addEventListener('click', () => {
        settings.setQuality(q);
        this.game.applyQuality();
        this.refreshSettings();
      });
      this.qualityButtons[q] = b;
    }
    this.qualityBlurb = el('div', 't10-set-blurb', qCard, QUALITY_PRESETS[settings.get('quality')].blurb);

    // Sound
    const sCard = section('Sound');
    this.volumeSliders = {};
    for (const [key, label] of [['masterVolume', 'Master'], ['sfxVolume', 'Effects'], ['musicVolume', 'Ambience']]) {
      const row = el('div', 't10-set-slider', sCard);
      el('span', 't10-set-slider-label', row, label);
      const input = el('input', '', row);
      input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '0.05';
      input.value = String(settings.get(key));
      const val = el('span', 't10-set-slider-val', row, Math.round(settings.get(key) * 100) + '%');
      input.addEventListener('input', () => {
        settings.set(key, parseFloat(input.value));
        val.textContent = Math.round(parseFloat(input.value) * 100) + '%';
        audio.applyVolumes();
      });
      this.volumeSliders[key] = input;
    }

    // View and controls, together: they are the same decision from the player's
    // side — how it feels to move and look.
    const vCard = section('View and controls');
    const vRow = el('div', 't10-set-row', vCard);
    this.viewButtons = {};
    for (const [mode, label] of [['first', 'First person'], ['third', 'Third person']]) {
      const b = el('button', 't10-set-btn', vRow, label);
      b.addEventListener('click', () => {
        this.game.player.setCameraMode(mode);
        this.refreshSettings();
      });
      this.viewButtons[mode] = b;
    }

    // Content rating. 18 is the default; 16 keeps the same world with much
    // less blood.
    const mCard = section('Content');
    const mRow = el('div', 't10-set-row', mCard);
    this.maturityButtons = {};
    for (const [age, label] of [[18, '18+'], [16, '16+']]) {
      const b = el('button', 't10-set-btn', mRow, label);
      b.addEventListener('click', () => { settings.setMaturity(age); this.refreshSettings(); });
      this.maturityButtons[age] = b;
    }
    this.maturityBlurb = el('div', 't10-set-blurb', mCard, '');

    const cRow = el('div', 't10-set-row', vCard);
    const invBtn = el('button', 't10-set-btn', cRow, 'Invert Y: off');
    invBtn.addEventListener('click', () => {
      settings.set('invertY', !settings.get('invertY'));
      invBtn.textContent = 'Invert Y: ' + (settings.get('invertY') ? 'on' : 'off');
      invBtn.classList.toggle('active', !!settings.get('invertY'));
    });
    invBtn.textContent = 'Invert Y: ' + (settings.get('invertY') ? 'on' : 'off');
    invBtn.classList.toggle('active', !!settings.get('invertY'));
    const promptBtn = el('button', 't10-set-btn', cRow, 'Prompts: on');
    const syncPrompt = () => {
      const on = !!settings.get('showInteractPrompts');
      promptBtn.textContent = 'Prompts: ' + (on ? 'on' : 'off');
      promptBtn.classList.toggle('active', on);
    };
    promptBtn.addEventListener('click', () => {
      settings.set('showInteractPrompts', !settings.get('showInteractPrompts'));
      syncPrompt();
    });
    syncPrompt();
    const sensRow = el('div', 't10-set-slider', vCard);
    el('span', 't10-set-slider-label', sensRow, 'Look speed');
    const sens = el('input', '', sensRow);
    sens.type = 'range'; sens.min = '0.2'; sens.max = '2.5'; sens.step = '0.1';
    sens.value = String(settings.get(this.isTouch ? 'touchLookSensitivity' : 'lookSensitivity'));
    const sensVal = el('span', 't10-set-slider-val', sensRow, sens.value + '×');
    sens.addEventListener('input', () => {
      settings.set(this.isTouch ? 'touchLookSensitivity' : 'lookSensitivity', parseFloat(sens.value));
      sensVal.textContent = parseFloat(sens.value).toFixed(1) + '×';
    });

    // Leave world
    const leave = el('button', 't10-set-leave', this.settings, 'Leave World');
    leave.addEventListener('click', () => {
      if (this.game.confirmLeave()) this.setSettingsOpen(false);
    });
    el('div', 't10-set-foot', this.settings, 'T10 World · ask T10 for anything else');
    this.refreshSettings();
  }

  refreshSettings() {
    const q = settings.get('quality');
    for (const k of QUALITY_ORDER) {
      this.qualityButtons[k].classList.toggle('active', k === q);
    }
    // T10 can change quality too, so the blurb tracks the setting rather than
    // whichever button was last clicked.
    if (this.qualityBlurb) {
      // Say what the preset actually comes out as here, so ULTRA on a phone
      // reads as a real setting rather than a promise the device can't keep.
      const p = settings.preset;
      this.qualityBlurb.textContent = QUALITY_PRESETS[q].blurb + '\n' +
        'On this ' + settings.device.tier + ': ' + Math.round(p.drawDistance) + 'm view · ' +
        p.npcBudget + ' people · ' + p.textureSize + 'px textures · ' +
        (p.shadows ? p.shadowMapSize + ' shadows' : 'no shadows');
    }
    if (this.maturityButtons) {
      const age = settings.get('maturity');
      for (const k of [18, 16]) this.maturityButtons[k].classList.toggle('active', k === age);
      this.maturityBlurb.textContent = age >= 18
        ? 'Full violence and gore. This is how it ships.'
        : 'The same world, with the blood turned right down.';
    }
    if (this.viewButtons && this.game.player) {
      const m = this.game.player.cameraMode;
      this.viewButtons.first.classList.toggle('active', m === 'first');
      this.viewButtons.third.classList.toggle('active', m === 'third');
    }
  }

  setArmed(on) {
    if (this._armed === on) return;
    this._armed = on;
    if (this.crosshair) this.crosshair.style.display = on ? 'block' : 'none';
    if (this.weaponPad) this.weaponPad.style.display = on && this.isTouch ? 'flex' : 'none';
  }

  toggleSettings() { this.setSettingsOpen(!this.settingsOpen); }

  setSettingsOpen(open) {
    this.settingsOpen = open;
    this.settings.style.display = open ? 'block' : 'none';
    this.settingsBtn.classList.toggle('active', open);
    audio.ui(open ? 'open' : 'close');
    this.refreshSettings();
    this.game.onMenuToggled(open);
    if (open && this.chatOpen) this.setChatOpen(false);
  }

  // -------------------------------------------------------------------------
  buildTouchControls() {
    const wrap = el('div', 't10-touch', this.root);
    this.touchWrap = wrap;

    // Joystick (appears where the thumb lands).
    this.stick = el('div', 't10-stick', wrap);
    this.stickKnob = el('div', 't10-stick-knob', this.stick);
    this.stick.style.display = 'none';

    // Action buttons, bottom right.
    const pad = el('div', 't10-pad', wrap);
    this.touchButtons = {};
    // No Run (there is one pace) and no View (first/third lives in Settings).
    const defs = [
      { id: 'interact', label: 'E', hint: 'Use', cls: 'big' },
      { id: 'jump', label: '↑', hint: 'Jump' },
      { id: 'crouch', label: '↓', hint: 'Crouch' },
    ];
    for (const d of defs) {
      const b = el('button', 't10-touch-btn ' + (d.cls || ''), pad);
      el('span', 't10-touch-glyph', b, d.label);
      el('span', 't10-touch-hint', b, d.hint);
      const down = (e) => {
        e.preventDefault();
        if (e.changedTouches) for (const t of e.changedTouches) this.game.input.claimTouch(t.identifier);
        b.classList.add('down');
        this.game.input.setVirtual(d.id, true);
        audio.ui('tick');
      };
      const up = (e) => {
        if (e) e.preventDefault();
        b.classList.remove('down');
        this.game.input.setVirtual(d.id, false);
      };
      b.addEventListener('touchstart', down, { passive: false });
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('touchcancel', up, { passive: false });
      b.addEventListener('mousedown', down);
      b.addEventListener('mouseup', up);
      b.addEventListener('mouseleave', up);
      this.touchButtons[d.id] = b;
    }

    // Weapon buttons, shown only while you're armed.
    this.weaponPad = el('div', 't10-pad t10-pad-weapon', wrap);
    this.weaponPad.style.display = 'none';
    for (const d of [
      { id: 'reload', label: '⟳', hint: 'Reload' },
      { id: 'aim', label: '◉', hint: 'Aim' },
      { id: 'fire', label: '●', hint: 'Fire', cls: 'fire' },
    ]) {
      const b = el('button', 't10-touch-btn ' + (d.cls || ''), this.weaponPad);
      el('span', 't10-touch-glyph', b, d.label);
      el('span', 't10-touch-hint', b, d.hint);
      const down = (e) => {
        e.preventDefault();
        if (e.changedTouches) for (const t of e.changedTouches) this.game.input.claimTouch(t.identifier);
        b.classList.add('down');
        this.game.input.setVirtual(d.id, true);
      };
      const up = (e) => { if (e) e.preventDefault(); b.classList.remove('down'); this.game.input.setVirtual(d.id, false); };
      b.addEventListener('touchstart', down, { passive: false });
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('touchcancel', up, { passive: false });
      b.addEventListener('mousedown', down);
      b.addEventListener('mouseup', up);
      b.addEventListener('mouseleave', up);
    }

    // Vehicle-specific buttons, shown only while driving.
    this.vehiclePad = el('div', 't10-pad t10-pad-vehicle', wrap);
    this.vehiclePad.style.display = 'none';
    for (const d of [
      { id: 'handbrake', label: '–', hint: 'Brake' },
      { id: 'horn', label: '♫', hint: 'Horn' },
      { id: 'enterVehicle', label: '⤴', hint: 'Exit' },
    ]) {
      const b = el('button', 't10-touch-btn', this.vehiclePad);
      el('span', 't10-touch-glyph', b, d.label);
      el('span', 't10-touch-hint', b, d.hint);
      const down = (e) => {
        e.preventDefault();
        if (e.changedTouches) for (const t of e.changedTouches) this.game.input.claimTouch(t.identifier);
        b.classList.add('down'); this.game.input.setVirtual(d.id, true);
      };
      const up = (e) => { if (e) e.preventDefault(); b.classList.remove('down'); this.game.input.setVirtual(d.id, false); };
      b.addEventListener('touchstart', down, { passive: false });
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('mousedown', down);
      b.addEventListener('mouseup', up);
    }

    // Wire the joystick visuals to the input manager.
    const input = this.game.input;
    input.onStickShow = (x, y) => {
      this.stick.style.display = 'block';
      this.stick.style.left = x + 'px';
      this.stick.style.top = y + 'px';
      this.stickKnob.style.transform = 'translate(-50%, -50%)';
    };
    input.onStickMove = (dx, dy) => {
      this.stickKnob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    };
    input.onStickHide = () => { this.stick.style.display = 'none'; };
  }

  // -------------------------------------------------------------------------
  setPrompt(text, keyHint) {
    if (!text) {
      this.prompt.style.opacity = '0';
      return;
    }
    const hint = keyHint || (this.isTouch ? '' : 'E');
    this.prompt.innerHTML = '';
    if (hint) {
      const k = el('span', 't10-prompt-key', this.prompt, hint);
    }
    el('span', 't10-prompt-text', this.prompt, text);
    this.prompt.style.opacity = '1';
  }

  say(text, who) {
    const full = String(text == null ? '' : text);
    // A few replies — the full command list, the feature tour — run to a
    // thousand characters. As a subtitle that is a wall across the screen, and
    // the whole thing is in the chat log anyway, so the overlay gets the first
    // couple of sentences and says where the rest is.
    let line = full;
    if (full.length > SUB_MAX) {
      const cut = full.lastIndexOf(' ', SUB_MAX);
      line = full.slice(0, cut > SUB_MAX * 0.6 ? cut : SUB_MAX).replace(/[,;:\s]+$/, '')
        + '… tap T10 for the rest.';
    }
    this.subtitle.textContent = line;
    // Centred text is right for a sentence and wrong for a paragraph: past a
    // couple of lines it becomes a ragged column nobody wants to read on a
    // phone. Long replies left-align and get a little longer on screen.
    const long = line.length > 96;
    this.subtitle.className = 't10-subtitle' + (who === 't10' ? ' t10' : '') + (long ? ' long' : '');
    this.subtitle.style.opacity = '1';
    clearTimeout(this._subTimer);
    this._subTimer = setTimeout(() => { this.subtitle.style.opacity = '0'; },
      long ? Math.min(9000, 3400 + line.length * 22) : 3400);
  }

  setVehicleMode(on) {
    if (this.vehiclePad) this.vehiclePad.style.display = on ? 'flex' : 'none';
    if (this.touchButtons && this.touchButtons.jump) {
      this.touchButtons.jump.style.display = on ? 'none' : 'flex';
      this.touchButtons.crouch.style.display = on ? 'none' : 'flex';
    }
  }

  setStatsVisible(v) { this.stats.style.display = v ? 'block' : 'none'; }
  updateStats(lines) { this.stats.textContent = lines; }

  setOrbActive(active) { this.orb.classList.toggle('listening', active); }

  /** A soft pulse on the orb whenever T10 speaks. */
  pulseOrb() {
    this.orb.classList.remove('pulse');
    void this.orb.offsetWidth;
    this.orb.classList.add('pulse');
  }
}

function gearSVG() {
  return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="3"></circle>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' +
    '</svg>';
}
