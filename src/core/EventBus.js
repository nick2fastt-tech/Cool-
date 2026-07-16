/**
 * EventBus.js
 * -----------
 * A tiny, dependency-free publish/subscribe hub. Systems communicate through
 * named events instead of holding direct references to each other, which keeps
 * the architecture modular (e.g. the economy can emit `coins:changed` without
 * knowing the HUD exists).
 *
 * A single shared instance is exported as `bus`, but the class is also exported
 * so isolated subsystems (like a game mode) can spin up their own scoped bus.
 */

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @returns {() => void} an unsubscribe function.
   */
  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /** Subscribe once; auto-unsubscribes after the first emit. */
  once(event, handler) {
    const off = this.on(event, (...args) => {
      off();
      handler(...args);
    });
    return off;
  }

  /** Remove a specific handler. */
  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  /** Emit an event to all current subscribers. Errors are isolated per-handler. */
  emit(event, ...args) {
    const set = this._listeners.get(event);
    if (!set) return;
    // Copy so handlers can unsubscribe mid-dispatch safely.
    for (const handler of [...set]) {
      try {
        handler(...args);
      } catch (err) {
        console.error(`[EventBus] handler for "${event}" threw:`, err);
      }
    }
  }

  /** Remove every listener (used on teardown). */
  clear() {
    this._listeners.clear();
  }
}

/** Shared application-wide bus. */
export const bus = new EventBus();
