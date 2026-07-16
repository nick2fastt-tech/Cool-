/**
 * DailyRewards.js
 * ---------------
 * A 7-day escalating login reward with streak tracking. "Day" is computed in
 * local time (midnight boundaries). Missing a day resets the streak; claiming
 * on consecutive days advances it and cycles the 7-day reward table.
 */

import { Config } from '../core/Config.js';
import { GameState } from '../core/GameState.js';
import { Currency } from './Currency.js';
import { bus } from '../core/EventBus.js';

/** Integer day index since the Unix epoch in the user's local timezone. */
function localDayIndex(ts = Date.now()) {
  const d = new Date(ts);
  return Math.floor((ts - d.getTimezoneOffset() * 60000) / 86400000);
}

export const DailyRewards = {
  /** Reward table (coins) for streak positions 1..7. */
  table() {
    return Config.economy.dailyRewardCoins;
  },

  /** Can the player claim right now? */
  canClaim() {
    const last = GameState.get('daily').lastClaimDay;
    return last == null || localDayIndex() > last;
  },

  /** The reward that WOULD be granted if claimed now (for the UI preview). */
  preview() {
    const daily = GameState.get('daily');
    const today = localDayIndex();
    const consecutive = daily.lastClaimDay === today - 1;
    const streak = this.canClaim() ? (consecutive ? daily.streak + 1 : 1) : daily.streak;
    const idx = (streak - 1) % 7;
    return { streak, coins: this.table()[idx], canClaim: this.canClaim() };
  },

  /** Claim today's reward. Returns {ok, coins?, streak?}. */
  claim() {
    if (!this.canClaim()) return { ok: false, reason: 'Already claimed today' };
    const daily = GameState.get('daily');
    const today = localDayIndex();
    const consecutive = daily.lastClaimDay === today - 1;
    const streak = consecutive ? daily.streak + 1 : 1;
    const coins = this.table()[(streak - 1) % 7];

    GameState.patch('daily', { lastClaimDay: today, streak });
    Currency.add(coins, 'daily');
    bus.emit('daily:claimed', { streak, coins });
    bus.emit('notify', { icon: '🎁', title: 'Daily Reward', text: `+${coins} coins (day ${streak})` });
    return { ok: true, coins, streak };
  },
};
