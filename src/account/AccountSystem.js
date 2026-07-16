/**
 * AccountSystem.js
 * ----------------
 * Handles account creation / login. This build ships with a local-first account
 * model (a stable device id + chosen username), plus a pluggable auth provider
 * interface so a real backend (email, OAuth, device attestation) can be dropped
 * in without touching the UI.
 *
 * A friend/invite code is derived deterministically from the account id so
 * players can share it immediately.
 */

import { GameState } from '../core/GameState.js';
import { Storage } from '../core/Storage.js';
import { bus } from '../core/EventBus.js';
import { createLogger } from '../core/Logger.js';

const log = createLogger('Account');

/** Generate a short, URL-safe id. */
function genId(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const rnd = crypto?.getRandomValues?.(new Uint8Array(len));
  for (let i = 0; i < len; i++) {
    s += chars[(rnd ? rnd[i] : Math.floor(Math.random() * 256)) % chars.length];
  }
  return s;
}

export const AccountSystem = {
  /** True once a username has been chosen. */
  isRegistered() {
    return !!GameState.get('account').username;
  },

  currentUser() {
    return GameState.get('account');
  },

  /** Human-friendly invite code derived from the account id. */
  inviteCode() {
    const id = GameState.get('account').id || '';
    return id.slice(0, 6);
  },

  /**
   * Validate a desired username. Rules: 3–16 chars, letters/digits/underscore,
   * must start with a letter. Returns {ok, reason?}.
   */
  validateUsername(name) {
    if (typeof name !== 'string') return { ok: false, reason: 'Enter a name' };
    const n = name.trim();
    if (n.length < 3) return { ok: false, reason: 'Too short (min 3)' };
    if (n.length > 16) return { ok: false, reason: 'Too long (max 16)' };
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(n)) return { ok: false, reason: 'Letters, digits, _ only' };
    return { ok: true, value: n };
  },

  /**
   * Register (or rename) the local player. Creates a device-stable id the first
   * time. Emits `account:ready`.
   */
  register(username) {
    const v = this.validateUsername(username);
    if (!v.ok) return v;

    let deviceId = Storage.get('deviceId', null);
    if (!deviceId) {
      deviceId = genId(12);
      Storage.set('deviceId', deviceId);
    }
    GameState.patch('account', {
      id: deviceId,
      username: v.value,
      createdAt: GameState.get('account').createdAt || Date.now(),
    });
    log.info('registered', v.value, deviceId);
    bus.emit('account:ready', GameState.get('account'));
    return { ok: true };
  },

  /** Continue as an existing local account (already has a username). */
  login() {
    if (!this.isRegistered()) return { ok: false, reason: 'No account on this device' };
    bus.emit('account:ready', GameState.get('account'));
    return { ok: true };
  },

  /** Sign out locally (keeps data for re-login; does not delete progress). */
  logout() {
    bus.emit('account:logout');
  },
};
