/**
 * CloudSave.js
 * ------------
 * Pluggable cloud persistence. The client only depends on the small
 * `CloudProvider` interface: push(profile) and pull(accountId). Two providers
 * ship here:
 *
 *   - LocalCloudProvider: a working stand-in that stores "cloud" snapshots in a
 *     separate namespace (so the whole save/restore flow is exercisable offline
 *     and in tests).
 *   - RestCloudProvider: talks to a real HTTP backend. Point it at your server
 *     via Config.net or a runtime setting; it uses ETags for conflict handling.
 *
 * Swap providers in main.js; nothing else changes.
 */

import { Storage } from '../core/Storage.js';
import { createLogger } from '../core/Logger.js';

const log = createLogger('Cloud');

/** Local-only provider — fully functional, no network required. */
export class LocalCloudProvider {
  async push(profile) {
    Storage.set('cloud.snapshot', { profile, updatedAt: Date.now() });
    return { ok: true };
  }
  async pull() {
    const snap = Storage.get('cloud.snapshot', null);
    return snap ? snap.profile : null;
  }
}

/** REST provider for a real backend. Endpoints:
 *    GET  {base}/save/{id}  -> { profile, version }
 *    PUT  {base}/save/{id}  body: profile, header If-Match: version
 */
export class RestCloudProvider {
  constructor(baseUrl, getToken = () => null) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.getToken = getToken;
    this._version = null;
  }

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) h.Authorization = `Bearer ${token}`;
    if (this._version) h['If-Match'] = this._version;
    return h;
  }

  async pull(accountId) {
    const res = await fetch(`${this.baseUrl}/save/${accountId}`, { headers: this._headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`pull failed: ${res.status}`);
    this._version = res.headers.get('ETag') || null;
    const body = await res.json();
    return body.profile ?? null;
  }

  async push(profile) {
    const id = profile?.account?.id;
    if (!id) return { ok: false, reason: 'no account id' };
    const res = await fetch(`${this.baseUrl}/save/${id}`, {
      method: 'PUT',
      headers: this._headers(),
      body: JSON.stringify(profile),
    });
    if (res.status === 412) {
      // Version conflict — caller should pull-merge-retry.
      log.warn('cloud version conflict');
      return { ok: false, conflict: true };
    }
    if (!res.ok) throw new Error(`push failed: ${res.status}`);
    this._version = res.headers.get('ETag') || this._version;
    return { ok: true };
  }
}

/**
 * CloudSync orchestrates initial pull-on-login and periodic background pushes.
 * It resolves conflicts with a simple "highest-progress wins" merge so a player
 * who plays on two devices never loses coins/XP.
 */
export class CloudSync {
  constructor(provider, gameState) {
    this.provider = provider;
    this.state = gameState;
    gameState.attachCloud(provider);
  }

  /** Pull remote save and merge it with local on login. */
  async syncOnLogin() {
    try {
      const remote = await this.provider.pull(this.state.get('account').id);
      if (remote) {
        const merged = this._merge(this.state.data, remote);
        this.state.replace(merged);
        log.info('cloud save merged');
      } else {
        await this.provider.push(this.state.data);
      }
    } catch (e) {
      log.warn('login sync failed (continuing offline)', e);
    }
  }

  /** Conservative merge: keep the record with more progress. */
  _merge(local, remote) {
    if (!remote) return local;
    const better = (a, b) => (a.xp + a.coins >= b.xp + b.coins ? a : b);
    const base = better(local, remote);
    // Always union achievements and inventory so nothing is lost.
    const other = base === local ? remote : local;
    return {
      ...base,
      achievements: { ...other.achievements, ...base.achievements },
      inventory: {
        owned: [...new Set([...(base.inventory.owned || []), ...(other.inventory.owned || [])])],
        equipped: base.inventory.equipped,
      },
    };
  }
}
