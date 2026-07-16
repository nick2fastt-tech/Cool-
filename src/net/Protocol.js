/**
 * Protocol.js  (SHARED by client and server)
 * ------------------------------------------
 * The wire protocol for real-time multiplayer. Messages are compact JSON
 * objects with a single-letter `t` (type) field to keep them small; swapping to
 * a binary codec later only requires changing encode/decode here.
 *
 * Design notes:
 *   - The server is authoritative: clients send *intent* (their input/desired
 *     state), the server validates and broadcasts corrected snapshots.
 *   - Snapshots are sent at a fixed tick; clients interpolate between them.
 */

export const PROTOCOL_VERSION = 1;

/** Message type codes. */
export const MSG = Object.freeze({
  // client -> server
  HELLO: 'hello', // { username, token?, room? }
  INPUT: 'input', // { x, y, z, yaw, anim, air }  (player's authoritative-ish state)
  CHAT: 'chat', // { channel, to?, text }
  PING: 'ping', // { ts }
  LEAVE: 'leave',

  // server -> client
  WELCOME: 'welcome', // { id, room, tick, players:[...] }
  SPAWN: 'spawn', // { id, username, avatar, x, y, z }
  DESPAWN: 'despawn', // { id }
  SNAPSHOT: 'snap', // { tick, players:[{id,x,y,z,yaw,anim,air}] }
  CHATMSG: 'chatmsg', // { channel, from, name, text }
  PRESENCE: 'presence', // { entries:[{id, online, room}] }
  PONG: 'pong', // { ts }
  KICK: 'kick', // { reason }
});

/** Encode a message object to a string for the socket. */
export function encode(type, payload = {}) {
  return JSON.stringify({ t: type, ...payload });
}

/** Decode an incoming string; returns null on malformed input. */
export function decode(raw) {
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.t !== 'string') return null;
    return obj;
  } catch {
    return null;
  }
}
