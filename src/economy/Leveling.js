/**
 * Leveling.js
 * -----------
 * XP + level curve. XP needed to go from level N to N+1 grows as
 *   base * N^exponent
 * so early levels are quick and later ones are a grind — standard progression
 * feel. Awarding XP can trigger multiple level-ups in one call and emits events
 * the HUD/notifications listen to.
 */

import { Config } from '../core/Config.js';
import { GameState } from '../core/GameState.js';
import { bus } from '../core/EventBus.js';

/** XP required to advance FROM level `n` to `n+1`. */
export function xpForLevel(n) {
  return Math.floor(Config.economy.xpBase * Math.pow(n, Config.economy.xpExponent));
}

export const Leveling = {
  /** Current level / xp / xp-to-next as a display-ready object. */
  status() {
    const level = GameState.get('level');
    return {
      level,
      xp: GameState.get('xp'),
      xpToNext: xpForLevel(level),
    };
  },

  /** Award XP, resolving any level-ups. Returns the number of levels gained. */
  award(amount) {
    if (amount <= 0) return 0;
    let xp = GameState.get('xp') + amount;
    let level = GameState.get('level');
    let gained = 0;

    while (xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level++;
      gained++;
    }

    GameState.patch('xp', xp);
    if (gained > 0) GameState.patch('level', level);

    bus.emit('xp:gained', amount);
    if (gained > 0) bus.emit('level:up', level, gained);
    return gained;
  },
};
