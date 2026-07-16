/**
 * Vibration.js
 * ------------
 * Thin wrapper over the Web Vibration API (navigator.vibrate), which maps to
 * native haptics inside a Capacitor Android build. All calls are no-ops when
 * unsupported or when the user disables vibration in settings.
 */

import { Storage } from '../core/Storage.js';

let enabled = Storage.get('settings.vibration', true);

/** Named haptic patterns (milliseconds; arrays alternate vibrate/pause). */
const PATTERNS = {
  tap: 10,
  jump: 15,
  land: [0, 8, 20, 8],
  checkpoint: [0, 20, 40, 40],
  hit: 30,
  death: [0, 60, 40, 120],
  reward: [0, 15, 30, 15, 30, 40],
};

export const Vibration = {
  setEnabled(v) {
    enabled = v;
    Storage.set('settings.vibration', v);
  },
  isEnabled() {
    return enabled;
  },
  /** Fire a named pattern or a raw duration/pattern. */
  play(pattern) {
    if (!enabled || !('vibrate' in navigator)) return;
    const p = typeof pattern === 'string' ? PATTERNS[pattern] : pattern;
    if (p == null) return;
    try {
      navigator.vibrate(p);
    } catch {
      /* some browsers throw if called without a user gesture — ignore */
    }
  },
};
