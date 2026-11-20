// Accounts: sign up with your Gmail + a new School Life password.
// - When the game is served by server/index.js, accounts live on the server and the
//   server sends the welcome email.
// - Otherwise (static hosting / offline) the account is locked in on this device and
//   the welcome email is sent with EmailJS if it's configured.
import { storage } from './storage.js';
import { pbkdf2Hex, randomHex, safeEqual } from './crypto.js';
import { EMAIL_CONFIG } from '../config.js';
import { welcomeSubject, welcomeText, welcomeHtml } from './welcome.js';

export const GMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@(?:gmail|googlemail)\.com$/;

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function validateEmail(email) {
  const e = normalizeEmail(email);
  if (!e) return 'Enter your Gmail address.';
  if (!e.includes('@')) return 'That doesn\'t look like an email address.';
  if (!GMAIL_RE.test(e)) return 'Use a Gmail address (ends with @gmail.com).';
  return null;
}

export function validatePassword(pw) {
  if (!pw) return 'Create a password.';
  if (pw.length < 6) return 'Password needs at least 6 characters.';
  if (pw.length > 128) return 'Password is too long.';
  return null;
}

export class AccountError extends Error {
  constructor(code, message, field = null) {
    super(message);
    this.code = code;
    this.field = field;
  }
}

const KEY_ACCOUNTS = 'sl.accounts';
const KEY_SESSION = 'sl.session';

function apiUrl(path) {
  return new URL('./api/' + path, globalThis.location.href).toString();
}

async function fetchJson(url, opts = {}, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal, cache: 'no-store' });
    let body = null;
    try {
      body = await res.json();
    } catch (e) {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

export class AccountService {
  constructor() {
    this.mode = 'local';
    this.user = null;
    this.token = null;
    this.offline = false;
    this.failures = 0;
    this.lockUntil = 0;
  }

  async init() {
    this.mode = (await this.detectServer()) ? 'server' : 'local';
    const sess = storage.get(KEY_SESSION);
    if (sess && sess.user && sess.user.email) await this.restore(sess);
    return this.user;
  }

  async detectServer() {
    if (!globalThis.location || globalThis.location.protocol === 'file:') return false;
    // Only the School Life server (server/index.js) marks the page; static hosting skips the probe.
    const meta = globalThis.document && document.querySelector('meta[name="school-life-server"]');
    if (!meta) return false;
    try {
      const r = await fetchJson(apiUrl('health'), {}, 2500);
      return !!(r.ok && r.body && r.body.app === 'school-life');
    } catch (e) {
      return false;
    }
  }

  hasAccounts() {
    if (this.mode === 'server') return false;
    return Object.keys(storage.get(KEY_ACCOUNTS, {})).length > 0;
  }

  async restore(sess) {
    if (sess.mode === 'server') {
      if (this.mode !== 'server') {
        // Server not reachable right now: keep playing offline with the saved profile.
        this.user = sess.user;
        this.token = sess.token;
        this.offline = true;
        return;
      }
      try {
        const r = await fetchJson(apiUrl('me'), { headers: { Authorization: 'Bearer ' + sess.token } }, 6000);
        if (r.ok && r.body && r.body.ok && r.body.user) {
          this.user = r.body.user;
          this.token = sess.token;
          this.saveSession();
        } else if (r.ok && r.body && r.body.code === 'auth') {
          storage.remove(KEY_SESSION);
        } else {
          this.user = sess.user;
          this.token = sess.token;
          this.offline = true;
        }
      } catch (e) {
        this.user = sess.user;
        this.token = sess.token;
        this.offline = true;
      }
      return;
    }
    const accounts = storage.get(KEY_ACCOUNTS, {});
    if (accounts[sess.user.email]) {
      const a = accounts[sess.user.email];
      this.user = { email: sess.user.email, gender: a.gender, createdAt: a.createdAt };
    } else {
      storage.remove(KEY_SESSION);
    }
  }

  saveSession() {
    storage.set(KEY_SESSION, { mode: this.token ? 'server' : 'local', token: this.token, user: this.user });
  }

  checkLock() {
    const now = Date.now();
    if (now < this.lockUntil) {
      const s = Math.ceil((this.lockUntil - now) / 1000);
      throw new AccountError('locked', 'Too many tries. Wait ' + s + 's and try again.');
    }
  }

  noteFailure() {
    this.failures++;
    if (this.failures >= 5) {
      this.failures = 0;
      this.lockUntil = Date.now() + 30000;
    }
  }

  async register({ email, password, confirm, gender }) {
    email = normalizeEmail(email);
    const eErr = validateEmail(email);
    if (eErr) throw new AccountError('email', eErr, 'email');
    const pErr = validatePassword(password);
    if (pErr) throw new AccountError('password', pErr, 'password');
    if (confirm !== undefined && confirm !== password) throw new AccountError('confirm', 'Passwords don\'t match.', 'confirm');
    if (gender !== 'male' && gender !== 'female') throw new AccountError('gender', 'Pick Male or Female.', 'gender');

    if (this.mode === 'server') {
      let r;
      try {
        r = await fetchJson(apiUrl('register'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, gender }),
        });
      } catch (e) {
        throw new AccountError('network', 'Can\'t reach the School Life server. Check your connection.');
      }
      if (!r.ok || !r.body || !r.body.ok) {
        const b = r.body || {};
        throw new AccountError(b.code || 'error', b.error || 'Something went wrong. Try again.', b.field || null);
      }
      this.token = r.body.token;
      this.user = r.body.user;
      this.offline = false;
      this.saveSession();
      return { user: this.user, emailStatus: r.body.emailStatus || 'not_configured' };
    }

    const accounts = storage.get(KEY_ACCOUNTS, {});
    if (accounts[email]) throw new AccountError('exists', 'This Gmail already has an account. Log in instead.', 'email');
    const hasSubtle = !!(globalThis.crypto && globalThis.crypto.subtle);
    const iter = hasSubtle ? 100000 : 30000;
    const salt = randomHex(16);
    const hash = await pbkdf2Hex(password, salt, iter);
    const createdAt = Date.now();
    accounts[email] = { salt, hash, iter, gender, createdAt };
    storage.set(KEY_ACCOUNTS, accounts);
    this.user = { email, gender, createdAt };
    this.token = null;
    this.saveSession();
    const emailStatus = await this.sendWelcomeClientSide(email);
    return { user: this.user, emailStatus };
  }

  async login({ email, password }) {
    this.checkLock();
    email = normalizeEmail(email);
    const eErr = validateEmail(email);
    if (eErr) throw new AccountError('email', eErr, 'email');
    if (!password) throw new AccountError('password', 'Enter your password.', 'password');

    if (this.mode === 'server') {
      let r;
      try {
        r = await fetchJson(apiUrl('login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
      } catch (e) {
        throw new AccountError('network', 'Can\'t reach the School Life server. Check your connection.');
      }
      if (!r.ok || !r.body || !r.body.ok) {
        const b = r.body || {};
        if (b.code === 'wrong') this.noteFailure();
        throw new AccountError(b.code || 'error', b.error || 'Something went wrong. Try again.', b.field || null);
      }
      this.failures = 0;
      this.token = r.body.token;
      this.user = r.body.user;
      this.offline = false;
      this.saveSession();
      return this.user;
    }

    const accounts = storage.get(KEY_ACCOUNTS, {});
    const a = accounts[email];
    if (!a) throw new AccountError('missing', 'No account for this Gmail yet. Create one!', 'email');
    const hash = await pbkdf2Hex(password, a.salt, a.iter);
    if (!safeEqual(hash, a.hash)) {
      this.noteFailure();
      throw new AccountError('wrong', 'Wrong password. Try again.', 'password');
    }
    this.failures = 0;
    this.user = { email, gender: a.gender, createdAt: a.createdAt };
    this.token = null;
    this.saveSession();
    return this.user;
  }

  async logout() {
    if (this.mode === 'server' && this.token) {
      try {
        await fetchJson(apiUrl('logout'), { method: 'POST', headers: { Authorization: 'Bearer ' + this.token } }, 4000);
      } catch (e) {
        /* ignore */
      }
    }
    this.user = null;
    this.token = null;
    storage.remove(KEY_SESSION);
  }

  async sendWelcomeClientSide(email) {
    const cfg = EMAIL_CONFIG && EMAIL_CONFIG.emailjs;
    if (!cfg || !cfg.serviceId || !cfg.templateId || !cfg.publicKey) return 'not_configured';
    try {
      const r = await fetchJson('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: cfg.serviceId,
          template_id: cfg.templateId,
          user_id: cfg.publicKey,
          template_params: {
            to_email: email,
            subject: welcomeSubject(),
            message: welcomeText(email),
            message_html: welcomeHtml(email),
          },
        }),
      });
      return r.ok ? 'sent' : 'failed';
    } catch (e) {
      return 'failed';
    }
  }
}
