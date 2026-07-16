/**
 * NetworkClient.js
 * ----------------
 * WebSocket client for real-time multiplayer. Responsibilities:
 *   - connect / auto-reconnect with exponential backoff
 *   - send the local player's state at Config.net.sendRateHz
 *   - spawn/despawn remote-player avatars and interpolate their movement
 *   - route chat + presence into the social systems via the bus
 *   - "rejoin after disconnect": remembers room + a resume token
 *
 * Registered as an engine system so remote entities interpolate every frame.
 * Works fully offline: if no server is reachable, the game is single-player and
 * the rest of the app is unaffected.
 */

import * as THREE from 'three';
import { Config } from '../core/Config.js';
import { bus } from '../core/EventBus.js';
import { Storage } from '../core/Storage.js';
import { createLogger } from '../core/Logger.js';
import { MSG, encode, decode } from './Protocol.js';
import { InterpolatedEntity } from './Snapshot.js';
import { Avatar } from '../player/Avatar.js';
import { Animator } from '../player/Animations.js';
import { Chat } from '../social/Chat.js';
import { Friends } from '../account/Friends.js';

const log = createLogger('Net');

export class NetworkClient {
  /**
   * @param {Engine} engine
   * @param {object} account  {id, username}
   * @param {object} avatarCustom  local avatar descriptor to advertise
   */
  constructor(engine, account, avatarCustom) {
    this.engine = engine;
    this.account = account;
    this.avatarCustom = avatarCustom;
    this.connected = false;
    this.selfId = account.id;
    this.room = null;

    /** id -> { avatar, animator, entity } */
    this.remotes = new Map();

    this._ws = null;
    this._reconnects = 0;
    this._sendTimer = null;
    this._lastState = null;
    this._url = new URL(location.href).searchParams.get('server') || Config.net.serverUrl;

    // Cache the local player's latest state to forward to the server.
    this._offState = bus.on('player:state', (s) => (this._lastState = s));
    this._offChat = bus.on('chat:send', (m) => this._sendChat(m));
    engine.addSystem(this);
  }

  /** Connect and join a room (defaults to a remembered/last room). */
  connect(room = 'lobby') {
    this.room = room;
    this._open();
  }

  _open() {
    try {
      this._ws = new WebSocket(this._url);
    } catch (e) {
      log.warn('WebSocket construct failed — running single-player', e);
      bus.emit('net:offline');
      return;
    }
    this._ws.onopen = () => {
      this.connected = true;
      this._reconnects = 0;
      log.info('connected', this._url);
      const token = Storage.get('net.resumeToken', null);
      this._send(MSG.HELLO, {
        username: this.account.username,
        id: this.account.id,
        avatar: this.avatarCustom,
        room: this.room,
        token,
      });
      this._startSending();
      bus.emit('net:online');
    };
    this._ws.onmessage = (ev) => this._onMessage(ev.data);
    this._ws.onclose = () => this._onClose();
    this._ws.onerror = () => this._ws?.close();
  }

  _onClose() {
    this.connected = false;
    clearInterval(this._sendTimer);
    this._clearRemotes();
    if (this._reconnects >= Config.net.reconnectAttempts) {
      log.warn('giving up reconnect — single-player mode');
      bus.emit('net:offline');
      return;
    }
    const delay = Math.min(1000 * 2 ** this._reconnects, 16000);
    this._reconnects++;
    log.info(`reconnecting in ${delay}ms (attempt ${this._reconnects})`);
    bus.emit('net:reconnecting', this._reconnects);
    setTimeout(() => this._open(), delay);
  }

  _startSending() {
    clearInterval(this._sendTimer);
    const interval = 1000 / Config.net.sendRateHz;
    this._sendTimer = setInterval(() => {
      if (this._lastState) this._send(MSG.INPUT, this._lastState);
    }, interval);
  }

  _send(type, payload) {
    if (this._ws?.readyState === WebSocket.OPEN) this._ws.send(encode(type, payload));
  }

  _sendChat(m) {
    this._send(MSG.CHAT, m);
  }

  _onMessage(raw) {
    const msg = decode(raw);
    if (!msg) return;
    switch (msg.t) {
      case MSG.WELCOME:
        this.selfId = msg.id;
        this.room = msg.room;
        Storage.set('net.resumeToken', msg.token || null);
        Storage.set('net.lastRoom', msg.room);
        (msg.players || []).forEach((p) => this._spawn(p));
        bus.emit('net:joined', { room: msg.room, count: (msg.players || []).length + 1 });
        break;
      case MSG.SPAWN:
        if (msg.id !== this.selfId) this._spawn(msg);
        break;
      case MSG.DESPAWN:
        this._despawn(msg.id);
        break;
      case MSG.SNAPSHOT:
        for (const p of msg.players) {
          if (p.id === this.selfId) continue;
          this.remotes.get(p.id)?.entity.push(p);
        }
        break;
      case MSG.CHATMSG:
        bus.emit('chat:recv', { channel: msg.channel, from: msg.from, name: msg.name, text: msg.text });
        break;
      case MSG.PRESENCE:
        Friends.setPresence(msg.entries || []);
        break;
      case MSG.KICK:
        log.warn('kicked:', msg.reason);
        bus.emit('notify', { icon: '🚫', title: 'Disconnected', text: msg.reason || 'Removed from server' });
        break;
    }
  }

  _spawn(p) {
    if (this.remotes.has(p.id)) return;
    const avatar = new Avatar(p.avatar || {});
    const animator = new Animator(avatar);
    avatar.root.position.set(p.x || 0, p.y || 0, p.z || 0);
    this.engine.scene.add(avatar.root);
    const entity = new InterpolatedEntity();
    entity.push({ x: p.x, y: p.y, z: p.z, yaw: 0, anim: 'idle' });
    this.remotes.set(p.id, { avatar, animator, entity, name: p.username });
    bus.emit('roster:changed', this.roster());
    log.debug('spawned remote', p.username);
  }

  _despawn(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    this.engine.scene.remove(r.avatar.root);
    r.avatar.dispose();
    this.remotes.delete(id);
    bus.emit('roster:changed', this.roster());
  }

  _clearRemotes() {
    for (const id of [...this.remotes.keys()]) this._despawn(id);
  }

  /** Player list for the UI (self + remotes). */
  roster() {
    const list = [{ id: this.selfId, name: this.account.username, self: true }];
    for (const [id, r] of this.remotes) list.push({ id, name: r.name, self: false });
    return list;
  }

  /** Engine hook: interpolate + animate every remote avatar. */
  update() {
    const tmp = new THREE.Vector3();
    for (const r of this.remotes.values()) {
      const yaw = r.entity.sample(tmp);
      r.avatar.root.position.lerp(tmp, 0.5);
      r.avatar.root.rotation.y = yaw;
      r.animator.setAirborne(r.entity.air);
      r.animator.setState(r.entity.anim || 'idle');
      r.animator.update(1 / 60);
    }
  }

  disconnect() {
    this._offState?.();
    this._offChat?.();
    this._send(MSG.LEAVE, {});
    this._ws?.close();
    this._clearRemotes();
    this.engine.removeSystem(this);
  }
}
