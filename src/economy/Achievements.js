/**
 * Achievements.js
 * ---------------
 * Data-driven achievement definitions + an unlock engine. Each achievement has
 * an id, title, description, icon, coin reward, and a `check(stats, ctx)`
 * predicate. Systems call Achievements.evaluate() after meaningful actions (a
 * jump, a win, a purchase) and any newly-satisfied achievements unlock, award
 * coins, and fire a notification.
 */

import { GameState } from '../core/GameState.js';
import { Currency } from './Currency.js';
import { bus } from '../core/EventBus.js';
import { createLogger } from '../core/Logger.js';

const log = createLogger('Achievements');

/** The catalogue. Extend freely — the engine is fully generic. */
export const ACHIEVEMENTS = [
  { id: 'first_jump', title: 'Hello, World', desc: 'Jump for the first time', icon: '🦘', reward: 25,
    check: (s) => s.jumps >= 1 },
  { id: 'jump_100', title: 'Springheel', desc: 'Jump 100 times', icon: '🐇', reward: 100,
    check: (s) => s.jumps >= 100 },
  { id: 'level_5', title: 'Getting Started', desc: 'Reach level 5', icon: '⭐', reward: 150,
    check: (s, c) => c.level >= 5 },
  { id: 'level_10', title: 'Seasoned', desc: 'Reach level 10', icon: '🌟', reward: 400,
    check: (s, c) => c.level >= 10 },
  { id: 'rich_1000', title: 'Pocket Change', desc: 'Hold 1,000 coins', icon: '💰', reward: 100,
    check: (s, c) => c.coins >= 1000 },
  { id: 'first_win', title: 'Victory', desc: 'Win any match', icon: '🏆', reward: 200,
    check: (s) => s.wins >= 1 },
  { id: 'obby_finish', title: 'Parkour Pro', desc: 'Finish the Obby', icon: '🧗', reward: 300,
    check: (s, c) => c.progress.obbyCheckpoint >= 999 },
  { id: 'social', title: 'Not Alone', desc: 'Add your first friend', icon: '🤝', reward: 75,
    check: (s, c) => c.friends.length >= 1 },
  { id: 'daily_7', title: 'Regular', desc: 'Claim 7 daily rewards in a row', icon: '📅', reward: 500,
    check: (s, c) => c.daily.streak >= 7 },
];

export const Achievements = {
  catalogue() {
    return ACHIEVEMENTS;
  },

  isUnlocked(id) {
    return !!GameState.get('achievements')[id];
  },

  /** Progress summary for the achievements screen. */
  summary() {
    const unlocked = GameState.get('achievements');
    return ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: !!unlocked[a.id],
      unlockedAt: unlocked[a.id] || null,
    }));
  },

  /**
   * Re-check every achievement against current state. Any newly-satisfied ones
   * unlock. Safe to call liberally — it only fires for the transition.
   *
   * Re-entrancy guard: unlocking awards coins, which emits `coins:changed`,
   * which is itself an evaluate() trigger. Without the guard that would recurse
   * infinitely; one pass already checks every achievement, so a nested call is a
   * no-op and the next real event will pick up anything new.
   */
  evaluate() {
    if (this._evaluating) return;
    this._evaluating = true;
    try {
      this._evaluate();
    } finally {
      this._evaluating = false;
    }
  },

  _evaluate() {
    const stats = GameState.get('stats');
    const ctx = GameState.data;
    const unlocked = { ...GameState.get('achievements') };
    let changed = false;

    for (const a of ACHIEVEMENTS) {
      if (unlocked[a.id]) continue;
      let ok = false;
      try {
        ok = a.check(stats, ctx);
      } catch { /* a malformed predicate must never crash gameplay */ }
      if (ok) {
        unlocked[a.id] = Date.now();
        changed = true;
        Currency.add(a.reward, `achievement:${a.id}`);
        log.info('unlocked', a.id);
        bus.emit('achievement:unlocked', a);
        bus.emit('notify', { icon: a.icon, title: 'Achievement Unlocked', text: a.title });
      }
    }
    if (changed) GameState.patch('achievements', unlocked);
  },
};

// Keep achievements reactive: re-evaluate on the events that can satisfy them.
['xp:gained', 'level:up', 'coins:changed', 'friends:changed', 'stat:changed', 'daily:claimed'].forEach((ev) =>
  bus.on(ev, () => Achievements.evaluate())
);
