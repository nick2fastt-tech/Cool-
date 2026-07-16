/**
 * UIManager.js
 * ------------
 * Owns all DOM UI: full-screen menus, the in-game HUD, toasts, and modals.
 * Screens are plain builder functions (see screens/Screens.js) that return a
 * DOM node; the manager handles mounting, transitions, back-navigation, and
 * enabling/disabling gameplay input as menus open and close.
 *
 * It's wired to the EventBus so gameplay/economy changes update the HUD without
 * any screen holding references to game systems.
 */

import { h, clear } from './dom.js';
import { bus } from '../core/EventBus.js';
import { GameState } from '../core/GameState.js';
import { xpForLevel } from '../economy/Leveling.js';
import { Notifications } from '../social/Notifications.js';
import { Screens } from './screens/Screens.js';
import { HUD } from './components/HUD.js';

export class UIManager {
  /** @param {object} app  shared context injected by main.js */
  constructor(app) {
    this.app = app; // { engine, player, input, network, gameManager, ... }
    this.root = document.getElementById('ui-root');
    this._screenNode = null;
    this._history = [];
    this.hud = new HUD(this, app);

    this._toastWrap = h('div.toast-wrap');
    this.root.appendChild(this._toastWrap);

    this._bindEvents();
  }

  _bindEvents() {
    bus.on('toast', (note) => this.toast(note));
    bus.on('level:up', (lvl) => this.toast({ icon: '⬆️', title: 'Level Up!', text: `You reached level ${lvl}` }));
    bus.on('coins:changed', () => this.hud.refreshWallet());
    bus.on('xp:gained', () => this.hud.refreshWallet());
    bus.on('hud:update', (data) => this.hud.setInfo(data));
    bus.on('notifications:changed', () => this.hud.refreshBadges());
    bus.on('world:changed', (mode) => this.hud.onWorldChanged(mode));
    bus.on('roster:changed', (list) => this.hud.setRoster(list));
    bus.on('kiosk:enter', (tag) => this._onKiosk(tag));
  }

  _onKiosk(tag) {
    if (tag === 'shop') this.showScreen('shop');
    else if (tag === 'leaderboard') this.showScreen('leaderboard');
    else if (tag === 'info') this.toast({ icon: 'ℹ️', title: 'NovaVerse', text: 'Walk into a portal to play a game!' });
  }

  // ---- Screen navigation ---------------------------------------------------

  /** Show a full-screen menu. Disables gameplay input + hides the HUD. */
  showScreen(name, params = {}) {
    const builder = Screens[name];
    if (!builder) return console.warn('[UI] unknown screen', name);
    if (this._screenNode && this._currentName !== name) this._history.push(this._currentName);
    this._currentName = name;

    const node = builder(this, this.app, params);
    if (this._screenNode) this._screenNode.remove();
    this._screenNode = node;
    this.root.appendChild(node);

    this.app.input?.setEnabled(false);
    this.hud.setVisible(false);
  }

  /** Go back to the previous screen, or into the game world if none. */
  back() {
    const prev = this._history.pop();
    if (prev) this.showScreen(prev);
    else this.closeScreens();
  }

  /** Dismiss all menus and return control to the game world. */
  closeScreens() {
    if (this._screenNode) {
      this._screenNode.remove();
      this._screenNode = null;
    }
    this._currentName = null;
    this._history.length = 0;
    this.app.input?.setEnabled(true);
    this.hud.setVisible(true);
    this.hud.refreshAll();
  }

  // ---- Toasts --------------------------------------------------------------

  toast({ icon = '🔔', title = '', text = '' }, ttl = 3200) {
    const el = h('div.toast', {}, [
      h('div.t-icon', { text: icon }),
      h('div', {}, [h('div.t-title', { text: title }), text && h('div.t-text', { text })]),
    ]);
    this._toastWrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      setTimeout(() => el.remove(), 300);
    }, ttl);
  }

  // ---- Modals --------------------------------------------------------------

  /**
   * Open a modal. `content(close)` returns the modal body; call `close()` to
   * dismiss. Tapping the backdrop also closes.
   */
  modal(content) {
    const close = () => backdrop.remove();
    const body = content(close);
    const backdrop = h('div.modal-backdrop', {
      onclick: (e) => {
        if (e.target === backdrop) close();
      },
    }, [h('div.modal', {}, body)]);
    this.root.appendChild(backdrop);
    return close;
  }

  /** Convenience header row with a back button. */
  header(title, onBack = () => this.back()) {
    return h('div.screen-header', {}, [
      h('button.btn.icon.ghost', { text: '‹', onclick: onBack }),
      h('div.screen-title', { text: title }),
    ]);
  }
}
