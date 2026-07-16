/**
 * ArenaGame.js
 * ------------
 * A combat arena with health, respawning, a match timer, and a live scoreboard.
 * Supports Free-For-All and Team modes. Multiple weapons with different
 * damage/range/cooldown are selectable. Kills spawn particle effects.
 *
 * For a complete, immediately-playable loop this ships with AI combatants; the
 * exact same hit-resolution path is what networked PvP uses — see NOTE. In a
 * networked match, remote players (from NetworkClient) become the targets and
 * hits are validated server-side.
 */

import * as THREE from 'three';
import { BaseGame } from '../BaseGame.js';
import { bus } from '../../core/EventBus.js';
import { GameState } from '../../core/GameState.js';
import { Currency } from '../../economy/Currency.js';
import { Leveling } from '../../economy/Leveling.js';
import { Vibration } from '../../input/Vibration.js';
import { Avatar } from '../../player/Avatar.js';

export const WEAPONS = [
  { id: 'blaster', name: 'Blaster', damage: 25, range: 22, cooldown: 0.35, color: 0x00e5ff },
  { id: 'shotgun', name: 'Scatter', damage: 55, range: 9, cooldown: 0.8, color: 0xff9500 },
  { id: 'sniper', name: 'Railer', damage: 90, range: 60, cooldown: 1.4, color: 0xff2d55 },
];

const MATCH_SECONDS = 180;

export class ArenaGame extends BaseGame {
  constructor(ctx, { mode = 'ffa', weaponId = 'blaster', bots = 5 } = {}) {
    super(ctx);
    this.name = 'Arena';
    this.mode = mode; // 'ffa' | 'team'
    this.weapon = WEAPONS.find((w) => w.id === weaponId) || WEAPONS[0];
    this.health = 100;
    this.team = 'red';
    this._cooldown = 0;
    this._timeLeft = MATCH_SECONDS;
    this._over = false;
    this.combatants = []; // AI/remote targets
    this.scores = {}; // id -> {name, kills, deaths, team}

    this._buildArena();
    this._registerSelf();
    for (let i = 0; i < bots; i++) this._spawnBot(i);
  }

  getSpawn() {
    return new THREE.Vector3((Math.random() - 0.5) * 30, 2, (Math.random() - 0.5) * 30);
  }

  _buildArena() {
    // Floor + surrounding walls + a few cover blocks.
    const floor = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 60), new THREE.MeshStandardMaterial({ color: 0x2b2d42 }));
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    this.addSolid(floor);
    this.physics.groundHeight = () => 0;

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a405a });
    const walls = [[0, -30, 60, 4], [0, 30, 60, 4], [-30, 0, 4, 60], [30, 0, 4, 60]];
    for (const [x, z, w, d] of walls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), wallMat);
      wall.position.set(x, 3, z);
      this.addSolid(wall);
    }
    // Cover.
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshStandardMaterial({ color: 0x565a75 }));
      c.position.set((Math.random() - 0.5) * 44, 1.5, (Math.random() - 0.5) * 44);
      c.castShadow = c.receiveShadow = true;
      this.addSolid(c);
    }
  }

  _registerSelf() {
    const acc = GameState.get('account');
    this.selfId = acc.id;
    this.scores[acc.id] = { name: acc.username, kills: 0, deaths: 0, team: 'red', self: true };
  }

  _spawnBot(i) {
    const team = this.mode === 'team' ? (i % 2 === 0 ? 'blue' : 'red') : 'ffa';
    const color = team === 'blue' ? 0x0a84ff : team === 'red' ? 0xff3b30 : 0x8e8e93;
    const avatar = new Avatar({ shirt: color, pants: 0x111111 });
    const p = this.getSpawn();
    avatar.root.position.copy(p);
    this.group.add(avatar.root);
    const bot = {
      id: `bot_${i}`,
      name: `Bot-${i + 1}`,
      avatar,
      hp: 100,
      team,
      state: 'roam',
      target: new THREE.Vector3(),
      fireTimer: Math.random() * 2,
    };
    this.combatants.push(bot);
    this.scores[bot.id] = { name: bot.name, kills: 0, deaths: 0, team };
  }

  // ---- Combat --------------------------------------------------------------

  actions() {
    return [{ id: 'fire', label: `🔫 ${this.weapon.name}` }];
  }
  action(id) {
    if (id === 'fire') this._fire();
  }

  _fire() {
    if (this._cooldown > 0 || this._over) return;
    this._cooldown = this.weapon.cooldown;
    Vibration.play('hit');

    // Ray from the player along facing direction.
    const origin = this.player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const yaw = this.player._visualYaw || 0;
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    this._tracer(origin, dir);

    // Hit-scan against combatants within range + angular tolerance.
    let best = null;
    let bestDist = Infinity;
    for (const c of this.combatants) {
      if (c.hp <= 0) continue;
      if (this.mode === 'team' && c.team === 'red') continue; // don't shoot teammates
      const to = c.avatar.root.position.clone().add(new THREE.Vector3(0, 1, 0)).sub(origin);
      const dist = to.length();
      if (dist > this.weapon.range) continue;
      const align = to.normalize().dot(dir);
      if (align > 0.9 && dist < bestDist) {
        best = c;
        bestDist = dist;
      }
    }
    if (best) this._damage(best, this.weapon.damage);
    // NOTE: in networked PvP this raycast + damage would be sent to the server,
    // which re-simulates it authoritatively before applying (anti-cheat).
  }

  _tracer(origin, dir) {
    const geo = new THREE.BufferGeometry().setFromPoints([origin, origin.clone().addScaledVector(dir, this.weapon.range)]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: this.weapon.color }));
    this.group.add(line);
    setTimeout(() => {
      this.group.remove(line);
      geo.dispose();
    }, 60);
  }

  _damage(c, amount) {
    c.hp -= amount;
    this.ctx.particles?.burst(c.avatar.root.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff3b30, 12, 4);
    if (c.hp <= 0) this._kill(c);
  }

  _kill(c) {
    // Big kill effect.
    this.ctx.particles?.burst(c.avatar.root.position.clone().add(new THREE.Vector3(0, 1, 0)), this.weapon.color, 40, 8, 1.1);
    this.scores[this.selfId].kills++;
    this.scores[c.id].deaths++;
    Currency.add(15, 'arena_kill');
    GameState.patch('stats', { kills: GameState.get('stats').kills + 1 });
    bus.emit('stat:changed');
    bus.emit('game:hud');
    // Respawn the bot after a delay.
    c.avatar.root.visible = false;
    c.hp = 0;
    setTimeout(() => {
      if (this._over) return;
      c.hp = 100;
      c.avatar.root.position.copy(this.getSpawn());
      c.avatar.root.visible = true;
    }, 2500);
  }

  fixedUpdate(dt) {
    if (this._over) return;
    this._cooldown = Math.max(0, this._cooldown - dt);
    this._timeLeft -= dt;
    if (this._timeLeft <= 0) return this._endMatch();

    // Simple bot AI: roam, then approach + fire at the player periodically.
    for (const c of this.combatants) {
      if (c.hp <= 0) continue;
      const toPlayer = this.player.position.clone().sub(c.avatar.root.position);
      toPlayer.y = 0;
      const d = toPlayer.length();
      if (d < 25) {
        c.avatar.root.position.addScaledVector(toPlayer.normalize(), 2.2 * dt);
        c.avatar.root.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
        c.fireTimer -= dt;
        if (c.fireTimer <= 0 && d < 18) {
          c.fireTimer = 1.5 + Math.random();
          if (Math.random() < 0.5) this._playerHit(10);
        }
      } else {
        // Wander.
        if (c.avatar.root.position.distanceTo(c.target) < 2) {
          c.target.set((Math.random() - 0.5) * 50, 0, (Math.random() - 0.5) * 50);
        }
        const toT = c.target.clone().sub(c.avatar.root.position);
        toT.y = 0;
        c.avatar.root.position.addScaledVector(toT.normalize(), 1.6 * dt);
      }
    }
  }

  _playerHit(amount) {
    this.health = Math.max(0, this.health - amount);
    Vibration.play('hit');
    bus.emit('game:hud');
    if (this.health <= 0) {
      this.scores[this.selfId].deaths++;
      this.health = 100;
      this.player.setPosition(...this.getSpawn().toArray());
      bus.emit('toast', { icon: '💀', title: 'You were eliminated', text: 'Respawned' });
    }
  }

  _endMatch() {
    this._over = true;
    const board = this.scoreboard();
    const win = board[0]?.self;
    if (win) {
      GameState.patch('stats', { wins: GameState.get('stats').wins + 1 });
      Currency.add(150, 'arena_win');
      Leveling.award(100);
      bus.emit('stat:changed');
    }
    bus.emit('notify', { icon: '🏁', title: 'Match Over', text: win ? 'You won! 🏆' : `Winner: ${board[0]?.name}` });
    bus.emit('game:finish', { mode: 'arena', scoreboard: board });
  }

  /** Sorted scoreboard for the HUD/overlay. */
  scoreboard() {
    return Object.entries(this.scores)
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  }

  hud() {
    const m = Math.floor(this._timeLeft / 60);
    const s = Math.floor(this._timeLeft % 60);
    return {
      title: `ARENA · ${this.mode.toUpperCase()}`,
      health: Math.round(this.health),
      timer: `${m}:${s.toString().padStart(2, '0')}`,
      kills: this.scores[this.selfId]?.kills ?? 0,
    };
  }

  dispose() {
    this.combatants.forEach((c) => c.avatar.dispose());
    super.dispose();
  }
}
