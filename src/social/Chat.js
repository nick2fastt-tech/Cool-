/**
 * Chat.js
 * -------
 * Public room chat + private (direct) messages. Chat is transport-agnostic: it
 * emits `chat:send` for the network layer to deliver and consumes `chat:recv`
 * for incoming messages. When offline it still works locally (useful for the
 * tutorial and for testing). A light profanity mask keeps public chat tidy.
 */

import { bus } from '../core/EventBus.js';
import { GameState } from '../core/GameState.js';

const MAX_HISTORY = 100;
const BLOCKLIST = ['badword1', 'badword2']; // replace with a real list server-side

function sanitize(text) {
  let t = String(text).slice(0, 200);
  for (const w of BLOCKLIST) {
    t = t.replace(new RegExp(w, 'gi'), '*'.repeat(w.length));
  }
  return t.trim();
}

export const Chat = {
  /** channelId -> array of {from, name, text, ts, self} */
  _channels: new Map(),

  history(channel = 'public') {
    return this._channels.get(channel) || [];
  },

  _append(channel, msg) {
    const arr = this._channels.get(channel) || [];
    arr.push(msg);
    if (arr.length > MAX_HISTORY) arr.shift();
    this._channels.set(channel, arr);
    bus.emit('chat:changed', channel, arr);
  },

  /** Send to the public room. */
  send(text) {
    const clean = sanitize(text);
    if (!clean) return;
    const me = GameState.get('account');
    const msg = { from: me.id, name: me.username, text: clean, ts: Date.now(), self: true };
    this._append('public', msg);
    bus.emit('chat:send', { channel: 'public', text: clean });
  },

  /** Send a private message to a friend. */
  sendPrivate(toId, toName, text) {
    const clean = sanitize(text);
    if (!clean) return;
    const channel = `dm:${toId}`;
    const me = GameState.get('account');
    this._append(channel, { from: me.id, name: me.username, text: clean, ts: Date.now(), self: true });
    bus.emit('chat:send', { channel, to: toId, text: clean });
    bus.emit('notify', { icon: '✉️', title: `To ${toName}`, text: clean, toast: false });
  },

  /** Called by the network layer when a message arrives. */
  receive({ channel = 'public', from, name, text }) {
    const me = GameState.get('account');
    this._append(channel, {
      from,
      name,
      text: sanitize(text),
      ts: Date.now(),
      self: from === me.id,
    });
    if (channel.startsWith('dm:') && from !== me.id) {
      bus.emit('notify', { icon: '✉️', title: `${name} messaged you`, text });
    }
  },
};

// Wire incoming network chat.
bus.on('chat:recv', (msg) => Chat.receive(msg));
