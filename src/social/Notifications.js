/**
 * Notifications.js
 * ----------------
 * Two layers:
 *   - Persistent notifications (stored in the profile) shown in the
 *     Notifications screen with read/unread state.
 *   - Transient toasts surfaced by the UI for a few seconds.
 *
 * Any system can raise one by emitting `notify` on the bus:
 *   bus.emit('notify', { icon:'🎁', title:'Reward', text:'+50 coins' });
 */

import { GameState } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';

let _idCounter = 1;

export const Notifications = {
  list() {
    return GameState.get('notifications');
  },

  unreadCount() {
    return GameState.get('notifications').filter((n) => !n.read).length;
  },

  /** Add a persistent notification (also raises a toast). */
  push({ icon = '🔔', title = '', text = '', toast = true }) {
    const note = { id: _idCounter++, icon, title, text, ts: Date.now(), read: false };
    const list = [note, ...GameState.get('notifications')].slice(0, 50); // cap history
    GameState.patch('notifications', list);
    bus.emit('notifications:changed', this.unreadCount());
    if (toast) bus.emit('toast', note);
    return note;
  },

  markAllRead() {
    const list = GameState.get('notifications').map((n) => ({ ...n, read: true }));
    GameState.patch('notifications', list);
    bus.emit('notifications:changed', 0);
  },

  clear() {
    GameState.patch('notifications', []);
    bus.emit('notifications:changed', 0);
  },
};

// Bridge the generic `notify` event into the persistent store.
bus.on('notify', (payload) => Notifications.push(payload));
