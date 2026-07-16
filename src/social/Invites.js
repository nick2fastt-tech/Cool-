/**
 * Invites.js
 * ----------
 * Share codes and deep links so players can join each other. Supports:
 *   - a personal friend code (add-me)
 *   - a room/server join code (join-my-game)
 *   - native share sheet on Android (navigator.share) with clipboard fallback
 *   - parsing inbound links (?invite=CODE, ?join=ROOM) at startup
 */

import { AccountSystem } from '../account/AccountSystem.js';
import { bus } from '../core/EventBus.js';

/** Build a shareable URL for the given params against the current origin. */
function buildLink(params) {
  const url = new URL(window.location.href);
  url.hash = '';
  url.search = '';
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

export const Invites = {
  /** The player's personal friend code. */
  friendCode() {
    return AccountSystem.inviteCode();
  },

  /** A link that adds this player as a friend. */
  friendLink() {
    return buildLink({ invite: this.friendCode() });
  },

  /** A link that joins a specific room/server. */
  roomLink(roomCode) {
    return buildLink({ join: roomCode });
  },

  /**
   * Share via the native sheet if available, otherwise copy to clipboard.
   * Returns 'shared' | 'copied' | 'failed'.
   */
  async share(text, url) {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'NovaVerse', text, url });
        return 'shared';
      }
      await navigator.clipboard.writeText(url);
      bus.emit('toast', { icon: '📋', title: 'Copied', text: 'Invite link copied' });
      return 'copied';
    } catch {
      return 'failed';
    }
  },

  /**
   * Parse invite/join params from the launch URL. Returns
   * { invite?: code, join?: room } and clears them from the address bar.
   */
  parseLaunchParams() {
    const p = new URLSearchParams(window.location.search);
    const result = {};
    if (p.get('invite')) result.invite = p.get('invite');
    if (p.get('join')) result.join = p.get('join');
    if (Object.keys(result).length) {
      // Clean the URL so a refresh doesn't re-trigger.
      const clean = new URL(window.location.href);
      clean.search = '';
      window.history.replaceState({}, '', clean.toString());
    }
    return result;
  },
};
