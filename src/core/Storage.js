/**
 * Storage.js
 * ----------
 * Persistence abstraction. All local data goes through here so we can swap the
 * backing store (localStorage today, Capacitor Preferences / SQLite later)
 * without touching call sites. Keys are namespaced via Config.storage.prefix.
 *
 * Everything is JSON-serialised and wrapped in try/catch so a corrupt entry or
 * a private-mode browser never crashes the game.
 */

import { Config } from './Config.js';
import { createLogger } from './Logger.js';

const log = createLogger('Storage');
const prefix = Config.storage.prefix;

/** In-memory fallback used when localStorage is unavailable (private mode). */
const memory = new Map();

function hasLocalStorage() {
  try {
    const k = '__nv_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const useLS = hasLocalStorage();
if (!useLS) log.warn('localStorage unavailable — using in-memory storage (data will not persist).');

export const Storage = {
  /** Read and JSON-parse a value; returns `fallback` if missing/corrupt. */
  get(key, fallback = null) {
    const full = prefix + key;
    try {
      const raw = useLS ? window.localStorage.getItem(full) : memory.get(full);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      log.warn(`failed to read "${key}"`, err);
      return fallback;
    }
  },

  /** JSON-serialise and persist a value. Returns true on success. */
  set(key, value) {
    const full = prefix + key;
    try {
      const raw = JSON.stringify(value);
      if (useLS) window.localStorage.setItem(full, raw);
      else memory.set(full, raw);
      return true;
    } catch (err) {
      log.error(`failed to write "${key}"`, err);
      return false;
    }
  },

  /** Remove a single key. */
  remove(key) {
    const full = prefix + key;
    if (useLS) window.localStorage.removeItem(full);
    else memory.delete(full);
  },

  /** Wipe every NovaVerse key (used by "reset progress" in settings). */
  clearAll() {
    if (useLS) {
      const toRemove = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(prefix)) toRemove.push(k);
      }
      toRemove.forEach((k) => window.localStorage.removeItem(k));
    } else {
      memory.clear();
    }
  },
};
