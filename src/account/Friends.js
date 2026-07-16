/**
 * Friends.js
 * ----------
 * Friends list + public-profile lookups. The friend graph is stored in the
 * player's save (so it persists and cloud-syncs) and augmented with live
 * online/room presence from the network layer when connected.
 */

import { GameState } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';
import { createLogger } from '../core/Logger.js';

const log = createLogger('Friends');

export const Friends = {
  /** Presence map from the server: friendId -> {online, room}. */
  _presence: new Map(),

  list() {
    return GameState.get('friends').map((f) => ({
      ...f,
      ...(this._presence.get(f.id) || { online: false, room: null }),
    }));
  },

  has(id) {
    return GameState.get('friends').some((f) => f.id === id);
  },

  /** Add a friend by their {id, username, code}. Idempotent. */
  add(friend) {
    if (!friend?.id || this.has(friend.id)) return { ok: false, reason: 'Already friends' };
    const friends = [...GameState.get('friends'), friend];
    GameState.patch('friends', friends);
    log.info('added friend', friend.username);
    bus.emit('friends:changed', this.list());
    return { ok: true };
  },

  remove(id) {
    const friends = GameState.get('friends').filter((f) => f.id !== id);
    GameState.patch('friends', friends);
    bus.emit('friends:changed', this.list());
  },

  /** Update live presence from a server roster message. */
  setPresence(entries) {
    this._presence.clear();
    for (const e of entries) this._presence.set(e.id, { online: e.online, room: e.room });
    bus.emit('friends:changed', this.list());
  },

  /**
   * Build a public profile object for display (own or, when networked, a
   * friend's). Only exposes non-sensitive, shareable fields.
   */
  publicProfile(profile = GameState.data) {
    return {
      username: profile.account.username,
      code: (profile.account.id || '').slice(0, 6),
      level: profile.level,
      coins: profile.coins,
      achievements: Object.keys(profile.achievements).length,
      wins: profile.stats.wins,
      memberSince: profile.account.createdAt,
      avatar: profile.avatar,
    };
  },
};
