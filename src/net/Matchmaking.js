/**
 * Matchmaking.js
 * --------------
 * Thin client for server discovery and matchmaking. It asks the backend for a
 * suitable room (by game mode + region), supports joining by explicit code
 * (friends/private servers), and can create a private room. When no backend is
 * configured it falls back to deterministic local room ids so single-device
 * testing still exercises the whole flow.
 *
 * Endpoints (REST alongside the WS server):
 *   GET  {http}/rooms?mode=obby         -> [{ code, mode, players, max, region }]
 *   POST {http}/rooms  { mode, private } -> { code }
 */

import { Config } from '../core/Config.js';
import { createLogger } from '../core/Logger.js';

const log = createLogger('Matchmaking');

/** Derive the HTTP base from the ws:// URL. */
function httpBase() {
  const ws = new URL(location.href).searchParams.get('server') || Config.net.serverUrl;
  return ws.replace(/^ws/, 'http').replace(/\/$/, '');
}

/** Short random room code (private servers / invites). */
function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export const Matchmaking = {
  /** List public rooms for a mode. Returns [] on failure. */
  async listRooms(mode) {
    try {
      const res = await fetch(`${httpBase()}/rooms?mode=${encodeURIComponent(mode)}`);
      if (!res.ok) throw new Error(res.status);
      return await res.json();
    } catch (e) {
      log.warn('listRooms failed — offering a local room', e);
      return [{ code: `${mode}-local`, mode, players: 0, max: 16, region: 'local' }];
    }
  },

  /**
   * Quick-play: find the fullest non-full room for a mode, else create one.
   * Returns a room code to hand to NetworkClient.connect().
   */
  async quickPlay(mode) {
    const rooms = await this.listRooms(mode);
    const joinable = rooms.filter((r) => r.players < r.max).sort((a, b) => b.players - a.players);
    if (joinable.length) return joinable[0].code;
    return this.createRoom(mode, false);
  },

  /** Create a room (private = invite-only). Returns its code. */
  async createRoom(mode, isPrivate = false) {
    try {
      const res = await fetch(`${httpBase()}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, private: isPrivate }),
      });
      if (!res.ok) throw new Error(res.status);
      const { code } = await res.json();
      return code;
    } catch (e) {
      log.warn('createRoom failed — using local code', e);
      return `${mode}-${genCode()}`;
    }
  },

  /** Normalise a user-entered join code. */
  normalizeCode(code) {
    return String(code || '').trim().toUpperCase();
  },
};
