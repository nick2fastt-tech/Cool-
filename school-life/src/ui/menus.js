// Menus: loading, tap-to-start, account (Student ID card), main menu, grade select,
// settings, welcome letter, fades and toasts.
import { icon } from './icons.js';
import { GAME, GRADES, GRADE_SCHEDULES, BODY, WELCOME } from '../config.js';
import { ordinal } from '../core/schedule.js';
import { storage } from '../core/storage.js';
import { validateEmail, validatePassword } from '../core/account.js';

const $ = (sel, root = document) => root.querySelector(sel);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const GRADE_COLORS = { 6: '#e4572e', 7: '#2d7dd2', 8: '#25a55f', 9: '#8e44ad' };

export class UI {
  constructor({ audio, account }) {
    this.audio = audio;
    this.account = account;
    this.root = document.getElementById('ui');
    this.handlers = {};
    this.settings = Object.assign({ graphics: 'max' }, storage.get('sl.settings', {}));
    this._titleTimers = [];
  }

  on(name, fn) {
    this.handlers[name] = fn;
  }

  emit(name, ...args) {
    if (this.handlers[name]) return this.handlers[name](...args);
    return undefined;
  }

  build() {
    this.root.innerHTML = `
      <div id="menuShade" class="shade hidden"></div>

      <section id="screen-loading" class="screen" aria-live="polite">
        <div class="holes"><i></i><i></i><i></i></div>
        <div class="doodle d1">A+ &#9733;</div>
        <div class="doodle d2">2x + 3 = 11</div>
        <div class="doodle d3">CO&#8322; &#8594; O&#8322;</div>
        <div class="doodle d4">${icon('plane')}</div>
        <div class="loading-box">
          <div class="logo-small">SCHOOL <span class="life">LIFE</span></div>
          <div class="logo-sub">${esc(GAME.versionLabel.toUpperCase())}</div>
          <div class="pencil-bar"><div class="guide"></div><div class="ink"></div><div class="pencil">${icon('pencil')}</div></div>
          <div class="loading-text">Sharpening pencils&hellip;</div>
          <div class="loading-pct">0%</div>
          <button class="tap-start hidden" id="tapStart">TAP TO START</button>
          <div class="loading-error hidden"></div>
        </div>
      </section>

      <section id="screen-auth" class="screen hidden"></section>

      <section id="screen-menu" class="screen hidden">
        <div class="paper-plane">${icon('plane')}</div>
        <div class="title-wrap">
          <h1 class="title" aria-label="School Life">
            <span class="word school">${this.letters('SCHOOL', 0)}</span>
            <span class="word life">${this.letters('LIFE', 6)}</span>
          </h1>
          <svg class="title-swoosh" viewBox="0 0 440 40" aria-hidden="true"><path d="M12 26 C 110 8, 240 6, 428 20"/></svg>
          <div class="title-badge">${esc(GAME.versionLabel.toUpperCase())}</div>
        </div>
        <div class="menu-buttons">
          <button class="btn btn-grey btn-locked" id="btnCharacter" aria-label="Character (locked)">${icon('user')}<span>Character</span><span class="lock-badge">${icon('lock')}</span></button>
          <button class="btn btn-green btn-play" id="btnPlay">${icon('play')}<span>Play</span></button>
          <button class="btn btn-blue" id="btnSettings">${icon('gear')}<span>Settings</span></button>
        </div>
        <div class="menu-footer"><span class="who">${icon('user')}<span id="menuWho"></span></span><span>${esc(GAME.school)} &middot; ${esc(GAME.versionLabel)}</span></div>
      </section>

      <section id="screen-grade" class="screen hidden">
        <button class="round-btn back" id="gradeBack" aria-label="Back">${icon('back')}</button>
        <div class="screen-title">Pick Your Grade</div>
        <div class="grade-cards">
          ${GRADES.map((g, i) => `
            <button class="grade-card" data-grade="${g}" style="--c:${GRADE_COLORS[g]};--i:${i}">
              <span class="num">${g}<sup>${ordinal(g).slice(-2)}</sup></span>
              <span class="lbl">GRADE</span>
              <span class="sticker">Homeroom ${GRADE_SCHEDULES[g][0][1]}</span>
            </button>`).join('')}
        </div>
        <div class="grade-note">Demo: 6th &ndash; 9th grade. More grades coming soon!</div>
      </section>

      <div id="modal-settings" class="modal hidden"></div>
      <div id="modal-letter" class="modal hidden"></div>
      <div id="toasts" class="toasts-global"></div>
      <div id="fader"><div class="msg"></div></div>
    `;
    $('#btnPlay').addEventListener('click', () => this.onPlay());
    $('#btnCharacter').addEventListener('click', () => this.onCharacter());
    $('#btnSettings').addEventListener('click', () => this.openSettings());
  }

  letters(word, offset) {
    return [...word]
      .map((ch, i) => {
        const r = ((((offset + i) * 37) % 9) - 4) * 6;
        return `<span class="ch" data-ch="${ch}" style="--i:${offset + i};--r:${r}deg">${ch}</span>`;
      })
      .join('');
  }

  // ------------------------------------------------------------ loading
  setProgress(p, text) {
    const pct = Math.max(0, Math.min(1, p));
    const ink = $('#screen-loading .ink');
    const pencil = $('#screen-loading .pencil');
    if (ink) ink.style.width = (pct * 100).toFixed(1) + '%';
    if (pencil) pencil.style.left = (pct * 100).toFixed(1) + '%';
    const pctEl = $('#screen-loading .loading-pct');
    if (pctEl) pctEl.textContent = Math.round(pct * 100) + '%';
    if (text) $('#screen-loading .loading-text').textContent = text;
  }

  loadingError(msg) {
    const el = $('#screen-loading .loading-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  waitForTap() {
    const btn = $('#tapStart');
    $('#screen-loading .loading-pct').classList.add('hidden');
    $('#screen-loading .loading-text').textContent = 'Ready for class!';
    btn.classList.remove('hidden');
    return new Promise((resolve) => {
      const screen = $('#screen-loading');
      const go = (e) => {
        if (e) e.preventDefault();
        screen.removeEventListener('pointerup', go);
        window.removeEventListener('keydown', onKey);
        resolve();
      };
      const onKey = (e) => {
        if (e.key === 'Enter' || e.key === ' ') go(e);
      };
      screen.addEventListener('pointerup', go);
      window.addEventListener('keydown', onKey);
    });
  }

  async hideLoading() {
    const s = $('#screen-loading');
    s.classList.add('fade');
    await wait(620);
    s.classList.add('hidden');
  }

  // ------------------------------------------------------------ auth
  showAuth() {
    const el = $('#screen-auth');
    $('#menuShade').classList.add('hidden');
    el.classList.remove('hidden');
    this.authMode = this.account.hasAccounts() ? 'login' : 'create';
    this.authGender = null;
    this.renderAuth();
    return new Promise((resolve) => {
      this._authResolve = resolve;
    });
  }

  renderAuth() {
    const el = $('#screen-auth');
    const create = this.authMode === 'create';
    el.innerHTML = `
      <form class="idcard" id="authForm" novalidate autocomplete="on">
        <div class="idcard-head">
          <div class="crest">${icon('crest')}</div>
          <div class="school"><b>${esc(GAME.school)}</b><span>${create ? 'NEW STUDENT' : 'WELCOME BACK'}</span></div>
          <div class="tag">STUDENT ID</div>
        </div>
        <div class="idcard-body">
          <div class="auth-col">
            <div class="tabs" role="tablist">
              <button type="button" class="tab ${create ? 'active' : ''}" data-mode="create" role="tab" aria-selected="${create}">Create Account</button>
              <button type="button" class="tab ${!create ? 'active' : ''}" data-mode="login" role="tab" aria-selected="${!create}">Log In</button>
            </div>
            <label class="field" data-field="email">${icon('mail')}
              <input id="authEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="yourname@gmail.com" aria-label="Gmail address" maxlength="80">
            </label>
            <label class="field" data-field="password">${icon('key')}
              <input id="authPass" type="password" autocomplete="${create ? 'new-password' : 'current-password'}" placeholder="${create ? 'Create a password' : 'Password'}" aria-label="Password" maxlength="128">
              <button type="button" class="eye" data-eye="authPass" aria-label="Show password">${icon('eye')}</button>
            </label>
            ${create ? `
            <label class="field" data-field="confirm">${icon('key')}
              <input id="authConfirm" type="password" autocomplete="new-password" placeholder="Confirm password" aria-label="Confirm password" maxlength="128">
              <button type="button" class="eye" data-eye="authConfirm" aria-label="Show password">${icon('eye')}</button>
            </label>` : ''}
          </div>
          <div class="auth-col">
            ${create ? `
            <div class="gender-label">I am:</div>
            <div class="gender" data-field="gender">
              ${['male', 'female'].map((g) => `
                <button type="button" class="gender-opt ${this.authGender === g ? 'selected' : ''}" data-gender="${g}">
                  <span class="fig">${icon(g)}</span><span><b>${BODY[g].label}</b><small>${BODY[g].heightLabel} tall</small></span>
                </button>`).join('')}
            </div>
            <div class="note">${icon('info')}<span>Make a <b>new password just for School Life</b> &mdash; never use your real Gmail password. Your account locks in to this Gmail.</span></div>
            ` : `
            <div class="note">${icon('info')}<span>Log in with the Gmail and School Life password you made when you created your account.</span></div>
            `}
            <div class="form-error" id="authError" role="alert"></div>
            <button type="submit" class="btn btn-green btn-block" id="authSubmit">${create ? 'Create Account' : 'Log In'}</button>
            <div class="auth-switch">${create ? 'Already have an account?' : 'New here?'} <button type="button" data-mode="${create ? 'login' : 'create'}">${create ? 'Log in' : 'Create one'}</button></div>
          </div>
        </div>
      </form>`;

    el.querySelectorAll('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        const m = b.getAttribute('data-mode');
        if (m === this.authMode) return;
        const email = $('#authEmail').value;
        this.audio.click();
        this.authMode = m;
        this.renderAuth();
        $('#authEmail').value = email;
      }),
    );
    el.querySelectorAll('[data-eye]').forEach((b) =>
      b.addEventListener('click', () => {
        const inp = document.getElementById(b.getAttribute('data-eye'));
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        b.innerHTML = icon(show ? 'eyeOff' : 'eye');
        b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      }),
    );
    el.querySelectorAll('[data-gender]').forEach((b) =>
      b.addEventListener('click', () => {
        this.authGender = b.getAttribute('data-gender');
        el.querySelectorAll('[data-gender]').forEach((o) => o.classList.toggle('selected', o === b));
        el.querySelector('.gender').classList.remove('invalid');
        this.audio.pop(this.authGender === 'male' ? 1 : 1.2);
      }),
    );
    el.querySelectorAll('input').forEach((inp) =>
      inp.addEventListener('input', () => {
        inp.closest('.field').classList.remove('invalid');
        $('#authError').textContent = '';
      }),
    );
    $('#authForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitAuth();
    });
  }

  authFail(msg, field) {
    $('#authError').textContent = msg;
    const card = $('#authForm');
    if (field) {
      const f = card.querySelector(`[data-field="${field}"]`);
      if (f) {
        f.classList.add('invalid');
        f.classList.remove('shake');
        void f.offsetWidth;
        f.classList.add('shake');
      }
    } else {
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    }
    this.audio.error();
  }

  async submitAuth() {
    if (this._authBusy) return;
    const create = this.authMode === 'create';
    const email = $('#authEmail').value;
    const password = $('#authPass').value;
    const confirm = create ? $('#authConfirm').value : undefined;
    const eErr = validateEmail(email);
    if (eErr) return this.authFail(eErr, 'email');
    if (create) {
      const pErr = validatePassword(password);
      if (pErr) return this.authFail(pErr, 'password');
      if (confirm !== password) return this.authFail('Passwords don\'t match.', 'confirm');
      if (!this.authGender) return this.authFail('Pick Male or Female.', 'gender');
    } else if (!password) {
      return this.authFail('Enter your password.', 'password');
    }
    this.audio.click();
    const btn = $('#authSubmit');
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span><span>${create ? 'Locking in&hellip;' : 'Checking&hellip;'}</span>`;
    this._authBusy = true;
    try {
      if (create) {
        const res = await this.account.register({ email, password, confirm, gender: this.authGender });
        this._authBusy = false;
        this.showLockIn(res.user, res.emailStatus);
      } else {
        const user = await this.account.login({ email, password });
        this._authBusy = false;
        this.audio.success();
        this.closeAuth(user);
        this.toast('Welcome back! ' + user.email, 'star');
      }
    } catch (err) {
      this._authBusy = false;
      btn.disabled = false;
      btn.innerHTML = label;
      this.authFail(err && err.message ? err.message : 'Something went wrong. Try again.', err && err.field);
    }
  }

  showLockIn(user, emailStatus) {
    const sent = emailStatus === 'sent';
    const card = $('#authForm');
    card.innerHTML = `
      <div class="idcard-head">
        <div class="crest">${icon('crest')}</div>
        <div class="school"><b>${esc(GAME.school)}</b><span>STUDENT</span></div>
        <div class="tag">STUDENT ID</div>
      </div>
      <div class="lockin">
        <div class="padlock">${icon('padlockBig')}</div>
        <h2>Account locked in!</h2>
        <p><b>${esc(user.email)}</b> is now your School Life account.</p>
        ${sent
          ? `<div class="mailline">${icon('mail')}<span>Welcome email sent! Check your inbox.</span></div>`
          : `<div class="mailline pending">${icon('mail')}<span>Your welcome letter is ready!</span></div>`}
        <button type="button" class="btn btn-green" id="lockContinue">${sent ? 'Continue' : 'Read my letter'}</button>
      </div>`;
    setTimeout(() => this.audio.lockClick(), 650);
    setTimeout(() => this.audio.success(), 900);
    $('#lockContinue').addEventListener('click', async () => {
      this.audio.click();
      if (!sent) await this.showLetter(user.email, emailStatus);
      this.closeAuth(user);
    });
  }

  closeAuth(user) {
    $('#screen-auth').classList.add('hidden');
    $('#screen-auth').innerHTML = '';
    if (this._authResolve) {
      const r = this._authResolve;
      this._authResolve = null;
      r(user);
    }
  }

  showLetter(email, status) {
    const m = $('#modal-letter');
    const failed = status === 'failed';
    m.innerHTML = `
      <div class="letter pop-in" role="dialog" aria-label="Welcome letter">
        <div class="meta">${icon('mail')}<span>To: ${esc(email)} &middot; From: The School Life Team</span></div>
        <h3>${esc(WELCOME.subject.replace(/\s*\p{Extended_Pictographic}/gu, ''))}</h3>
        <div>Hi ${esc(email.split('@')[0])}! ${esc(WELCOME.intro)}</div>
        <div>Here's what's in ${esc(GAME.title)} ${esc(GAME.versionLabel)}:</div>
        <ul>${WELCOME.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <div>${esc(WELCOME.comingSoon)}</div>
        <div>${esc(WELCOME.signoff).replace(/\n/g, '<br>')}</div>
        ${failed ? '<div class="meta">The email couldn\'t be delivered right now, so here\'s your copy.</div>' : ''}
        <div class="foot"><button class="btn btn-green btn-small" id="letterOk">Continue</button></div>
      </div>`;
    m.classList.remove('hidden');
    this.audio.chime();
    return new Promise((resolve) => {
      $('#letterOk').addEventListener('click', () => {
        this.audio.click();
        m.classList.add('hidden');
        m.innerHTML = '';
        resolve();
      });
    });
  }

  // ------------------------------------------------------------ main menu
  showMenu(user, { animate = true } = {}) {
    $('#menuShade').classList.remove('hidden');
    const s = $('#screen-menu');
    s.classList.remove('hidden');
    $('#menuWho').textContent = user ? user.email : '';
    if (animate) this.playTitle();
  }

  hideMenu() {
    $('#screen-menu').classList.add('hidden');
    $('#screen-menu').classList.remove('behind');
    $('#menuShade').classList.add('hidden');
    this._titleTimers.forEach(clearTimeout);
    this._titleTimers = [];
  }

  playTitle() {
    const title = $('#screen-menu .title');
    const swoosh = $('#screen-menu .title-swoosh');
    const badge = $('#screen-menu .title-badge');
    const wrap = $('#screen-menu .title-wrap');
    this._titleTimers.forEach(clearTimeout);
    this._titleTimers = [];
    title.classList.remove('animate', 'idle');
    swoosh.classList.remove('draw');
    badge.classList.remove('stamp');
    wrap.classList.remove('thump');
    void title.offsetWidth;
    title.classList.add('animate');
    const n = title.querySelectorAll('.ch').length;
    const T = (fn, ms) => this._titleTimers.push(setTimeout(fn, ms));
    for (let i = 0; i < n; i++) T(() => this.audio.pop(0.8 + i * 0.06), 120 + i * 75 + 470);
    const settle = 120 + (n - 1) * 75 + 950;
    T(() => {
      title.classList.remove('animate');
      title.classList.add('idle');
      swoosh.classList.add('draw');
      this.audio.whoosh();
    }, settle);
    T(() => {
      badge.classList.add('stamp');
      this.audio.stamp();
      wrap.classList.add('thump');
    }, settle + 420);
  }

  onPlay() {
    this.audio.click();
    this.emit('play');
  }

  onCharacter() {
    const b = $('#btnCharacter');
    b.classList.remove('shake');
    void b.offsetWidth;
    b.classList.add('shake');
    this.audio.locked();
    this.toast('Character is locked for now &mdash; customization is coming in a future update!', 'lock');
  }

  // ------------------------------------------------------------ grade select
  showGrade() {
    const s = $('#screen-grade');
    s.classList.remove('hidden');
    $('#screen-menu').classList.add('behind');
    s.querySelectorAll('.grade-card').forEach((c) => {
      c.classList.remove('chosen');
      c.style.animation = 'none';
      void c.offsetWidth;
      c.style.animation = '';
    });
    return new Promise((resolve) => {
      const done = (val) => {
        s.querySelectorAll('.grade-card').forEach((c) => c.removeEventListener('click', onCard));
        $('#gradeBack').removeEventListener('click', onBack);
        if (val === null) $('#screen-menu').classList.remove('behind');
        resolve(val);
      };
      const onCard = (e) => {
        const card = e.currentTarget;
        const g = Number(card.getAttribute('data-grade'));
        card.classList.add('chosen');
        this.audio.success();
        storage.set('sl.lastGrade', g);
        setTimeout(() => done(g), 380);
      };
      const onBack = () => {
        this.audio.click();
        s.classList.add('hidden');
        done(null);
      };
      s.querySelectorAll('.grade-card').forEach((c) => c.addEventListener('click', onCard));
      $('#gradeBack').addEventListener('click', onBack);
    });
  }

  hideGrade() {
    $('#screen-grade').classList.add('hidden');
  }

  // ------------------------------------------------------------ settings
  openSettings() {
    this.audio.click();
    const m = $('#modal-settings');
    const user = this.account.user;
    const levels = ['low', 'medium', 'high', 'max'];
    const where = this.account.mode === 'server' ? (this.account.offline ? 'Server account (offline)' : 'Server account') : 'Saved on this device';
    m.innerHTML = `
      <div class="chalkboard pop-in" role="dialog" aria-label="Settings">
        <button class="modal-close" id="setClose" aria-label="Close">${icon('close')}</button>
        <div class="chalk-title">Settings</div>
        <div class="set-section">
          <div class="set-label"><span>Graphics</span><small>more options soon</small></div>
          <div class="seg">
            ${levels.map((l) => `<button class="seg-opt ${l === 'max' ? 'active' : 'locked'}" data-level="${l}">${l === 'max' ? icon('check') : icon('lock')}<span>${l.toUpperCase()}</span></button>`).join('')}
          </div>
          <div class="set-desc">MAX graphics: full resolution, real-time sun shadows, sharp textures and reflections. Dynamic resolution keeps the game smooth so there's no lag.</div>
        </div>
        ${user ? `
        <div class="set-section">
          <div class="set-label"><span>Account</span></div>
          <div class="set-account"><div><div class="em">${esc(user.email)}</div><div class="mode">${where}</div></div>
          <button class="btn btn-red btn-small" id="setSignOut">Sign Out</button></div>
        </div>` : ''}
        <div class="set-foot">${esc(GAME.title)} ${esc(GAME.versionLabel)}</div>
      </div>`;
    m.classList.remove('hidden');
    const close = () => {
      this.audio.click();
      m.classList.add('hidden');
      m.innerHTML = '';
    };
    $('#setClose').addEventListener('click', close);
    m.addEventListener('click', (e) => {
      if (e.target === m) close();
    });
    m.querySelectorAll('.seg-opt.locked').forEach((b) =>
      b.addEventListener('click', () => {
        this.audio.locked();
        this.toast('Only MAX graphics in the demo &mdash; and it runs with no lag!', 'lock');
      }),
    );
    const so = $('#setSignOut');
    if (so)
      so.addEventListener('click', async () => {
        m.classList.add('hidden');
        m.innerHTML = '';
        this.audio.click();
        this.emit('signout');
      });
  }

  // ------------------------------------------------------------ fader + toasts
  fadeOut(msg = '', sub = '') {
    const f = $('#fader');
    f.querySelector('.msg').innerHTML = msg ? esc(msg) + (sub ? `<small>${esc(sub)}</small>` : '') : '';
    f.classList.add('on');
    return wait(480);
  }

  fadeIn() {
    $('#fader').classList.remove('on');
    return wait(480);
  }

  toast(html, ic = 'info', { big = false, ms = 2600 } = {}) {
    const box = $('#toasts');
    if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast' + (big ? ' big' : '');
    t.innerHTML = (ic ? icon(ic) : '') + `<span>${html}</span>`;
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 320);
    }, ms);
  }
}
