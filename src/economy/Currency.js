/**
 * Currency.js
 * -----------
 * Coins wallet. All coin changes route through here so we can validate,
 * animate, and (server-side) audit them. Spending is guarded so the UI can
 * disable purchase buttons cleanly.
 */

import { GameState } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';

export const Currency = {
  balance() {
    return GameState.get('coins');
  },

  /** Add coins (rewards, sales). Emits `coins:changed` with a +delta. */
  add(amount, reason = '') {
    if (amount <= 0) return this.balance();
    const next = GameState.get('coins') + Math.floor(amount);
    GameState.patch('coins', next);
    bus.emit('coins:changed', next, amount, reason);
    return next;
  },

  canAfford(cost) {
    return GameState.get('coins') >= cost;
  },

  /** Attempt to spend. Returns true on success, false if insufficient funds. */
  spend(amount, reason = '') {
    if (!this.canAfford(amount)) {
      bus.emit('coins:insufficient', amount);
      return false;
    }
    const next = GameState.get('coins') - Math.floor(amount);
    GameState.patch('coins', next);
    bus.emit('coins:changed', next, -amount, reason);
    return true;
  },
};
