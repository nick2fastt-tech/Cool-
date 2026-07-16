/**
 * GameState.js
 * ------------
 * The single source of truth for all persisted player data. Every subsystem
 * (account, economy, inventory, settings, social) reads and mutates the profile
 * through here, and every change is debounced-saved to Storage and mirrored to
 * the cloud provider. Mutations emit `state:changed` (+ specific events) so the
 * UI updates reactively without polling.
 *
 * This is what the "Saving" requirement maps to: avatar, coins, XP,
 * achievements, statistics, settings, inventory, and progress all live here.
 */

import { Storage } from './Storage.js';
import { Config } from './Config.js';
import { bus } from './EventBus.js';
import { createLogger } from './Logger.js';

const log = createLogger('GameState');
const SAVE_KEY = 'profile';

/** Factory for a brand-new player profile. */
function freshProfile() {
  return {
    schema: 1,
    account: { id: null, username: null, createdAt: null },
    avatar: {
      skin: 0xe0ac69,
      shirt: 0x3a86ff,
      pants: 0x22223b,
      hair: 0x2b1d0e,
      face: 'smile',
      hat: null,
      back: null,
    },
    coins: Config.economy.startingCoins,
    xp: 0,
    level: 1,
    achievements: {}, // id -> unlockedAt (ms)
    stats: { playtimeSec: 0, jumps: 0, deaths: 0, wins: 0, kills: 0, races: 0 },
    inventory: {
      owned: ['face_smile', 'face_cool'], // starter items
      equipped: {},
    },
    friends: [], // [{id, username, code}]
    daily: { lastClaimDay: null, streak: 0 },
    progress: { obbyCheckpoint: 0, unlockedGames: ['obby', 'survival', 'racing', 'arena'] },
    settings: {
      musicVolume: 0.6,
      sfxVolume: 0.8,
      vibration: true,
      quality: 'auto',
      leftHanded: false,
    },
    notifications: [], // [{id, text, ts, read}]
  };
}

class GameStateStore {
  constructor() {
    this.data = Storage.get(SAVE_KEY, null) || freshProfile();
    this._saveTimer = null;
    this._cloud = null; // set via attachCloud()
    // Migrate older schemas here if `schema` differs (forward-compatible).
    if (this.data.schema !== 1) this._migrate();
  }

  _migrate() {
    // Merge missing top-level keys from a fresh profile (non-destructive).
    const fresh = freshProfile();
    this.data = { ...fresh, ...this.data, schema: 1 };
    this.save(true);
  }

  /** Attach a CloudSave provider used for background sync. */
  attachCloud(cloud) {
    this._cloud = cloud;
  }

  /** Read a top-level slice. */
  get(key) {
    return this.data[key];
  }

  /**
   * Shallow-merge a patch into a top-level object slice (e.g. patch('stats', {...}))
   * or set a scalar. Emits change events and schedules a save.
   */
  patch(key, value) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof this.data[key] === 'object') {
      this.data[key] = { ...this.data[key], ...value };
    } else {
      this.data[key] = value;
    }
    bus.emit('state:changed', key, this.data[key]);
    bus.emit(`state:${key}`, this.data[key]);
    this.save();
  }

  /** Replace the whole profile (e.g. after a cloud pull). */
  replace(profile) {
    this.data = profile;
    bus.emit('state:changed', '*', this.data);
    this.save(true);
  }

  /** Debounced persist to local storage + cloud. Pass immediate=true to flush now. */
  save(immediate = false) {
    clearTimeout(this._saveTimer);
    const doSave = () => {
      Storage.set(SAVE_KEY, this.data);
      this._cloud?.push(this.data).catch((e) => log.warn('cloud push failed', e));
    };
    if (immediate) doSave();
    else this._saveTimer = setTimeout(doSave, 800);
  }

  /** Wipe everything and start fresh (settings screen "reset progress"). */
  reset() {
    this.data = freshProfile();
    this.save(true);
    bus.emit('state:changed', '*', this.data);
  }
}

/** Shared singleton. */
export const GameState = new GameStateStore();
