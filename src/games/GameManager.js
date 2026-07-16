/**
 * GameManager.js
 * --------------
 * Orchestrates world transitions: the central Lobby hub and the four game modes.
 * It keeps exactly one "world" active at a time, wiring its spawn point, HUD,
 * and per-frame updates, and guarantees clean teardown (colliders + GPU memory)
 * on every switch so nothing leaks between sessions.
 *
 * Registered as an engine system; it forwards fixed/variable updates to the
 * active world and drives the HUD refresh.
 */

import { bus } from '../core/EventBus.js';
import { createLogger } from '../core/Logger.js';
import { Lobby } from '../world/Lobby.js';
import { ObbyGame } from './obby/ObbyGame.js';
import { SurvivalGame } from './survival/SurvivalGame.js';
import { RacingGame } from './racing/RacingGame.js';
import { ArenaGame } from './arena/ArenaGame.js';

const GAMES = {
  obby: ObbyGame,
  survival: SurvivalGame,
  racing: RacingGame,
  arena: ArenaGame,
};

export class GameManager {
  /**
   * @param {object} ctx { engine, scene, physics, player, particles, network }
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.current = null; // active game (null while in lobby)
    this.lobby = null;
    this.mode = 'lobby';
    this._elapsed = 0;
    this._hudTimer = 0;

    ctx.engine.addSystem(this);

    // Portals in the lobby request a mode change.
    bus.on('portal:enter', (id) => this.enterGame(id));
    // Kiosks open UI (handled by the UI layer); we just relay.
    bus.on('game:leave', () => this.enterLobby());
  }

  /** Load the central hub and spawn the player there. */
  enterLobby() {
    this._teardown();
    this.mode = 'lobby';
    this.lobby = new Lobby(this.ctx.scene, this.ctx.physics);
    this.ctx.player.setPosition(this.lobby.spawnPoint.x, this.lobby.spawnPoint.y, this.lobby.spawnPoint.z);
    bus.emit('world:changed', 'lobby');
    createLogger('Game').info('entered lobby');
  }

  /** Switch to a game mode. `opts` is forwarded to the game constructor. */
  enterGame(modeId, opts = {}) {
    const GameClass = GAMES[modeId];
    if (!GameClass) return;
    this._teardown();
    this.mode = modeId;
    this.current = new GameClass(this.ctx, opts);
    const spawn = this.current.getSpawn();
    this.ctx.player.setPosition(spawn.x, spawn.y, spawn.z);

    // In multiplayer, join the matching room so remote racers/fighters appear.
    this.ctx.network?.connect?.(`${modeId}`);

    bus.emit('world:changed', modeId);
    bus.emit('game:hud');
    createLogger('Game').info('entered game', modeId);
  }

  _teardown() {
    if (this.lobby) {
      this.lobby.dispose();
      this.lobby = null;
    }
    if (this.current) {
      this.current.dispose();
      this.current = null;
    }
    // Clear any leftover triggers/solids defensively.
    this.ctx.physics.clearTriggers();
  }

  /** Forward the current world's action buttons (if any). */
  actions() {
    return this.current?.actions?.() || [];
  }
  doAction(id) {
    this.current?.action?.(id);
  }

  fixedUpdate(dt) {
    this.current?.fixedUpdate?.(dt);
  }

  update(dt) {
    this._elapsed += dt;
    this.lobby?.update(dt, this._elapsed);
    this.current?.update?.(dt, this._elapsed);

    // Push HUD values a few times a second (cheap, avoids per-frame DOM churn).
    this._hudTimer += dt;
    if (this._hudTimer >= 0.2) {
      this._hudTimer = 0;
      const hud = this.current?.hud?.();
      if (hud) bus.emit('hud:update', hud);
    }
  }
}
