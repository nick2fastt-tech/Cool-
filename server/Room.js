/**
 * Room.js
 * -------
 * A single game room/server instance. Holds connected players, validates their
 * updates via AntiCheat, and broadcasts authoritative snapshots at a fixed tick
 * (Config send rate). Also routes chat (public + DMs) within the room.
 *
 * The server never trusts client positions blindly — every INPUT is passed
 * through the player's AntiCheat instance and corrected if necessary before it
 * becomes part of the broadcast snapshot.
 */

import { MSG, encode } from '../src/net/Protocol.js';
import { AntiCheat } from './AntiCheat.js';

const TICK_HZ = 20;
const MAX_PLAYERS = 16;

export class Room {
  /** @param {string} code  @param {string} mode  @param {boolean} isPrivate */
  constructor(code, mode, isPrivate = false) {
    this.code = code;
    this.mode = mode;
    this.private = isPrivate;
    /** id -> player record */
    this.players = new Map();
    this.tick = 0;
    this._interval = setInterval(() => this._tick(), 1000 / TICK_HZ);
  }

  get count() {
    return this.players.size;
  }
  get full() {
    return this.count >= MAX_PLAYERS;
  }

  /** Add a connection after a validated HELLO. */
  addPlayer({ id, username, avatar, ws }) {
    const player = {
      id,
      username,
      avatar,
      ws,
      x: 0,
      y: 2,
      z: 0,
      yaw: 0,
      anim: 'idle',
      air: false,
      last: null,
      anticheat: new AntiCheat(),
    };
    this.players.set(id, player);

    // Tell the newcomer about everyone already here.
    this._send(player, MSG.WELCOME, {
      id,
      room: this.code,
      tick: this.tick,
      token: id, // simple resume token; real deployments would sign this
      players: [...this.players.values()]
        .filter((p) => p.id !== id)
        .map((p) => this._spawnPayload(p)),
    });

    // Announce the newcomer to everyone else.
    this._broadcastExcept(id, MSG.SPAWN, this._spawnPayload(player));
    return player;
  }

  removePlayer(id) {
    if (!this.players.has(id)) return;
    this.players.delete(id);
    this._broadcast(MSG.DESPAWN, { id });
  }

  /** Handle a validated INPUT message. */
  onInput(id, data) {
    const p = this.players.get(id);
    if (!p) return;
    const now = Date.now();
    const res = p.anticheat.validateMove(p.last, data, now);
    p.x = res.x;
    p.y = res.y;
    p.z = res.z;
    p.yaw = Number.isFinite(data.yaw) ? data.yaw : p.yaw;
    p.anim = data.anim || 'idle';
    p.air = !!data.air;
    p.last = { x: p.x, y: p.y, z: p.z, t: now };

    if (p.anticheat.shouldKick()) {
      this._send(p, MSG.KICK, { reason: 'Anomalous movement detected' });
      try { p.ws.close(); } catch {}
      this.removePlayer(id);
    }
  }

  /** Route a chat message (public broadcast or private DM). */
  onChat(id, { channel = 'public', to, text }) {
    const p = this.players.get(id);
    if (!p || !text) return;
    if (!p.anticheat.allowChat(Date.now())) return; // rate limited
    const payload = { channel, from: id, name: p.username, text: String(text).slice(0, 200) };
    if (channel.startsWith('dm:') || to) {
      const target = this.players.get(to);
      if (target) this._send(target, MSG.CHATMSG, payload);
      this._send(p, MSG.CHATMSG, payload); // echo to sender
    } else {
      this._broadcast(MSG.CHATMSG, payload);
    }
  }

  _tick() {
    this.tick++;
    if (this.count === 0) return;
    const players = [...this.players.values()].map((p) => ({
      id: p.id,
      x: round(p.x),
      y: round(p.y),
      z: round(p.z),
      yaw: round(p.yaw),
      anim: p.anim,
      air: p.air,
    }));
    this._broadcast(MSG.SNAPSHOT, { tick: this.tick, players });
  }

  _spawnPayload(p) {
    return { id: p.id, username: p.username, avatar: p.avatar, x: p.x, y: p.y, z: p.z };
  }

  _send(player, type, payload) {
    try {
      if (player.ws.readyState === 1) player.ws.send(encode(type, payload));
    } catch {
      /* dropped socket; the close handler will clean up */
    }
  }
  _broadcast(type, payload) {
    const msg = encode(type, payload);
    for (const p of this.players.values()) {
      try { if (p.ws.readyState === 1) p.ws.send(msg); } catch {}
    }
  }
  _broadcastExcept(id, type, payload) {
    const msg = encode(type, payload);
    for (const p of this.players.values()) {
      if (p.id === id) continue;
      try { if (p.ws.readyState === 1) p.ws.send(msg); } catch {}
    }
  }

  dispose() {
    clearInterval(this._interval);
    this.players.clear();
  }
}

const round = (n) => Math.round(n * 100) / 100;
