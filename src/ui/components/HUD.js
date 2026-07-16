/**
 * HUD.js
 * ------
 * The in-world heads-up display: coins + XP/level, quick buttons (menu,
 * notifications, players), game-specific stat readouts, action buttons supplied
 * by the active game, chat, the player list, and a "leave to lobby" button.
 *
 * It is created once and shown/hidden as the player moves between menus and the
 * world. All values update reactively from the EventBus.
 */

import { h, clear } from '../dom.js';
import { bus } from '../../core/EventBus.js';
import { GameState } from '../../core/GameState.js';
import { xpForLevel } from '../../economy/Leveling.js';
import { Chat } from '../../social/Chat.js';
import { Notifications } from '../../social/Notifications.js';

export class HUD {
  constructor(ui, app) {
    this.ui = ui;
    this.app = app;
    this.root = document.getElementById('ui-root');
    this._build();
    this._bind();
    this.refreshAll();
  }

  _build() {
    // Top bar: wallet on the left, quick actions on the right.
    this._coins = h('span', { text: '0' });
    this._level = h('span', { text: 'Lv 1' });
    this._xpFill = h('div.xp-fill');
    const wallet = h('div.row', { style: { gap: '8px' } }, [
      h('div.chip', {}, ['🪙 ', this._coins]),
      h('div.chip.xp-wrap', {}, [this._level, h('div.xp-bar', {}, [this._xpFill])]),
    ]);

    this._notifBadge = h('span.badge.hidden', { text: '0' });
    const notifBtn = h('button.btn.icon.ghost', { onclick: () => this.ui.showScreen('notifications') }, [
      '🔔',
      this._notifBadge,
    ]);
    this._menuBtn = h('button.btn.icon.ghost', { text: '☰', onclick: () => this.ui.showScreen('home') });
    this._playersBtn = h('button.btn.icon.ghost', { text: '👥', onclick: () => this._togglePlayers() });

    this._topbar = h('div.topbar', {}, [wallet, h('div.row', { style: { gap: '8px' } }, [this._playersBtn, notifBtn, this._menuBtn])]);

    // Game stat readouts (populated by setInfo).
    this._info = h('div.hud-info');

    // Action buttons (fire/build/nitro…) supplied by the active game.
    this._actions = h('div.action-buttons');

    // Leave-to-lobby button (only shown inside a game).
    this._leaveBtn = h('button.btn.small.ghost.hidden', {
      text: '⬅ Lobby',
      // z-index keeps it above the full-screen touch-layer (z-index 5).
      style: { position: 'absolute', top: 'calc(var(--safe-top) + 108px)', left: 'calc(var(--safe-left) + 10px)', zIndex: '8' },
      onclick: () => bus.emit('game:leave'),
    });

    // Chat.
    this._chatLog = h('div.chat-log');
    this._chatInput = h('input.input', { placeholder: 'Say something…', maxlength: '120' });
    this._chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._sendChat();
    });
    this._chatRow = h('div.chat-input-row', {}, [
      this._chatInput,
      h('button.btn.small.primary', { text: 'Send', onclick: () => this._sendChat() }),
    ]);
    this._chat = h('div.chat', {}, [
      this._chatLog,
      this._chatRow,
      h('button.btn.small.ghost', { text: '💬 Chat', onclick: () => this._toggleChat() }),
    ]);

    // Player list.
    this._playerList = h('div.card.playerlist.hidden');

    this._nodes = [this._topbar, this._info, this._actions, this._leaveBtn, this._chat, this._playerList];
    this._nodes.forEach((n) => this.root.appendChild(n));
  }

  _bind() {
    bus.on('chat:changed', (channel) => {
      if (channel === 'public') this._renderChat();
    });
  }

  // ---- Chat ----------------------------------------------------------------

  _toggleChat() {
    this._chatRow.classList.toggle('open');
    if (this._chatRow.classList.contains('open')) this._chatInput.focus();
  }
  _sendChat() {
    const text = this._chatInput.value.trim();
    if (text) Chat.send(text);
    this._chatInput.value = '';
    this._renderChat();
  }
  _renderChat() {
    clear(this._chatLog);
    for (const m of Chat.history('public').slice(-8)) {
      this._chatLog.appendChild(
        h(`div.chat-msg${m.self ? '.self' : ''}`, {}, [h('b', { text: m.name + ': ' }), m.text])
      );
    }
    this._chatLog.scrollTop = this._chatLog.scrollHeight;
  }

  // ---- Player list ---------------------------------------------------------

  _togglePlayers() {
    this._playerList.classList.toggle('hidden');
    this.setRoster(this.app.network?.roster?.() || [{ id: 'me', name: GameState.get('account').username, self: true }]);
  }
  setRoster(list) {
    clear(this._playerList);
    this._playerList.appendChild(h('div.row.spread', {}, [h('b', { text: `Players (${list.length})` })]));
    for (const p of list) {
      this._playerList.appendChild(
        h('div.row.spread', { style: { padding: '4px 0' } }, [
          h('span', { text: (p.self ? '⭐ ' : '') + p.name }),
        ])
      );
    }
  }

  // ---- Game info + actions -------------------------------------------------

  setInfo(data) {
    clear(this._info);
    for (const [k, v] of Object.entries(data)) {
      if (k === 'title') continue;
      this._info.appendChild(h('div.hud-stat', { text: `${labelFor(k)} ${v}` }));
    }
  }

  refreshActions() {
    clear(this._actions);
    const actions = this.app.gameManager?.actions?.() || [];
    for (const a of actions) {
      this._actions.appendChild(
        h('button.action-btn', { text: a.label, onclick: () => this.app.gameManager.doAction(a.id) })
      );
    }
  }

  onWorldChanged(mode) {
    const inGame = mode !== 'lobby';
    this._leaveBtn.classList.toggle('hidden', !inGame);
    if (!inGame) clear(this._info);
    this.refreshActions();
  }

  // ---- Wallet / badges -----------------------------------------------------

  refreshWallet() {
    const level = GameState.get('level');
    this._coins.textContent = GameState.get('coins').toLocaleString();
    this._level.textContent = 'Lv ' + level;
    const pct = Math.min(100, (GameState.get('xp') / xpForLevel(level)) * 100);
    this._xpFill.style.width = pct + '%';
  }
  refreshBadges() {
    const n = Notifications.unreadCount();
    this._notifBadge.textContent = n;
    this._notifBadge.classList.toggle('hidden', n === 0);
  }
  refreshAll() {
    this.refreshWallet();
    this.refreshBadges();
    this.refreshActions();
    this._renderChat();
  }

  setVisible(v) {
    this._nodes.forEach((n) => {
      if (n === this._leaveBtn || n === this._playerList) return; // managed separately
      n.style.display = v ? '' : 'none';
    });
    if (!v) {
      this._playerList.classList.add('hidden');
    }
  }
}

/** Friendly labels for HUD stat keys. */
function labelFor(k) {
  const map = {
    checkpoint: '🚩',
    time: '⏱️',
    health: '❤️',
    hunger: '🍖',
    wood: '🪵',
    stone: '🪨',
    phase: '',
    lap: '🏁',
    nitro: '🔥',
    best: '⭐',
    timer: '⏱️',
    kills: '💀',
  };
  return map[k] ?? k;
}
