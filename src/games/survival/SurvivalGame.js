/**
 * SurvivalGame.js
 * ---------------
 * A survival sandbox on a large map with a health + hunger loop, resource
 * gathering, crafting/building, and enemies that emerge at night (driven by the
 * global day/night cycle via the `world:phase` event).
 *
 * Core loop that is actually implemented here:
 *   - Health and Hunger meters; hunger drains over time and, at zero, damages
 *     health. Eating restores hunger.
 *   - Resource nodes (trees, rocks) yield wood/stone when you walk into them
 *     (with a respawn cooldown).
 *   - Crafting/Building: spend wood to place solid wall blocks (base building);
 *     spend wood to craft food.
 *   - Enemies: at night, shambling foes spawn and path toward the player,
 *     dealing contact damage; defeating them (attack action) drops nothing but
 *     keeps you alive. Survive until day.
 *
 * Extension points for a fuller game (bigger tech tree, mobs, multiplayer base
 * sharing) are marked with NOTE comments.
 */

import * as THREE from 'three';
import { BaseGame } from '../BaseGame.js';
import { bus } from '../../core/EventBus.js';
import { Environment } from '../../world/Environment.js';
import { Currency } from '../../economy/Currency.js';
import { Leveling } from '../../economy/Leveling.js';
import { Vibration } from '../../input/Vibration.js';

export class SurvivalGame extends BaseGame {
  constructor(ctx) {
    super(ctx);
    this.name = 'Survival';
    this.health = 100;
    this.hunger = 100;
    this.resources = { wood: 0, stone: 0 };
    this.enemies = [];
    this.isNight = false;
    this._nodes = [];
    this._hungerTimer = 0;
    this._spawnTimer = 0;
    this._dead = false;

    this._buildWorld();
    this._offPhase = bus.on('world:phase', (p) => this._onPhase(p));
  }

  getSpawn() {
    return new THREE.Vector3(0, 2, 0);
  }

  _buildWorld() {
    // Large ground.
    const ground = Environment.ground(300, 0x5a7d3f);
    this.group.add(ground);
    this.physics.groundHeight = () => 0;
    this.group.add(Environment.mountains(18, 200));

    // Resource nodes: trees (wood) and rocks (stone) as harvestable triggers.
    for (let i = 0; i < 40; i++) {
      const isTree = Math.random() < 0.65;
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 110;
      const pos = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      this._makeNode(pos, isTree ? 'wood' : 'stone');
    }
  }

  _makeNode(pos, type) {
    const grp = new THREE.Group();
    grp.position.copy(pos);
    if (type === 'wood') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0x6b4423 }));
      trunk.position.y = 1.2;
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3.4, 7), new THREE.MeshStandardMaterial({ color: 0x2f7d32 }));
      leaves.position.y = 3.4;
      trunk.castShadow = leaves.castShadow = true;
      grp.add(trunk, leaves);
    } else {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, flatShading: true }));
      rock.position.y = 0.8;
      rock.castShadow = true;
      grp.add(rock);
    }
    this.group.add(grp);

    const node = { type, grp, alive: true, cooldown: 0 };
    const box = new THREE.Box3().setFromCenterAndSize(pos.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(2.5, 3, 2.5));
    node.triggerId = this.physics.addTrigger(box, {
      tag: `node:${type}`,
      onEnter: () => this._harvest(node),
    });
    this._nodes.push(node);
  }

  _harvest(node) {
    if (!node.alive) return;
    node.alive = false;
    node.cooldown = 12; // seconds to regrow
    node.grp.visible = false;
    const amount = node.type === 'wood' ? 3 : 2;
    this.resources[node.type] += amount;
    Vibration.play('tap');
    this.ctx.particles?.burst(node.grp.position.clone().add(new THREE.Vector3(0, 1.5, 0)), node.type === 'wood' ? 0x6b4423 : 0x8a8a8a, 14, 4);
    bus.emit('game:hud');
  }

  _onPhase(phase) {
    this.isNight = phase === 'night';
    if (this.isNight) bus.emit('notify', { icon: '🌙', title: 'Night falls', text: 'Enemies are coming — build defenses!' });
    else {
      // Survived the night: reward.
      this.enemies.forEach((e) => this.group.remove(e.mesh));
      this.enemies.length = 0;
      Currency.add(50, 'survive_night');
      Leveling.award(60);
      bus.emit('notify', { icon: '☀️', title: 'You survived!', text: '+50 coins' });
    }
  }

  // ---- HUD actions (rendered as buttons by the HUD) -----------------------

  actions() {
    return [
      { id: 'build', label: '🧱 Wall (5🪵)' },
      { id: 'eat', label: '🍖 Eat (3🪵)' },
      { id: 'attack', label: '⚔️ Attack' },
    ];
  }

  action(id) {
    if (id === 'build') this._build();
    else if (id === 'eat') this._eat();
    else if (id === 'attack') this._attack();
  }

  _build() {
    if (this.resources.wood < 5) return bus.emit('toast', { icon: '🪵', title: 'Need wood', text: 'Gather 5 wood first' });
    this.resources.wood -= 5;
    // Place a wall block just in front of the player.
    const fwd = new THREE.Vector3(Math.sin(this.player._visualYaw || 0), 0, Math.cos(this.player._visualYaw || 0));
    const p = this.player.position.clone().add(fwd.multiplyScalar(2.5));
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.5), new THREE.MeshStandardMaterial({ color: 0x8d6e4c }));
    wall.position.set(p.x, 1, p.z);
    wall.castShadow = wall.receiveShadow = true;
    this.addSolid(wall);
    Vibration.play('tap');
    bus.emit('game:hud');
    // NOTE: multiplayer base building would broadcast placements to the server.
  }

  _eat() {
    if (this.resources.wood < 3) return;
    this.resources.wood -= 3; // "cook" wood->food for this demo economy
    this.hunger = Math.min(100, this.hunger + 35);
    Vibration.play('tap');
    bus.emit('game:hud');
  }

  _attack() {
    // Hit any enemy within range in front of the player.
    Vibration.play('hit');
    const range = 3;
    for (const e of [...this.enemies]) {
      if (e.mesh.position.distanceTo(this.player.position) < range) {
        e.hp -= 40;
        this.ctx.particles?.burst(e.mesh.position.clone(), 0xff3b30, 16, 5);
        if (e.hp <= 0) {
          this.group.remove(e.mesh);
          this.enemies.splice(this.enemies.indexOf(e), 1);
          Currency.add(10, 'enemy_kill');
        }
      }
    }
  }

  _spawnEnemy() {
    const a = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * 10;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), new THREE.MeshStandardMaterial({ color: 0x3a0ca3, emissive: 0x22004a }));
    mesh.position.set(this.player.position.x + Math.cos(a) * r, 0.8, this.player.position.z + Math.sin(a) * r);
    mesh.castShadow = true;
    this.group.add(mesh);
    this.enemies.push({ mesh, hp: 80, speed: 2 + Math.random() });
  }

  fixedUpdate(dt) {
    if (this._dead) return;

    // Hunger drain (~ -1 every 3s), then health if starving.
    this._hungerTimer += dt;
    if (this._hungerTimer >= 3) {
      this._hungerTimer = 0;
      this.hunger = Math.max(0, this.hunger - 1);
      if (this.hunger === 0) this._damage(4);
      else if (this.health < 100) this.health = Math.min(100, this.health + 1);
      bus.emit('game:hud');
    }

    // Regrow harvested nodes.
    for (const n of this._nodes) {
      if (!n.alive) {
        n.cooldown -= dt;
        if (n.cooldown <= 0) {
          n.alive = true;
          n.grp.visible = true;
        }
      }
    }

    // Enemy spawning + AI at night.
    if (this.isNight) {
      this._spawnTimer -= dt;
      if (this._spawnTimer <= 0 && this.enemies.length < 8) {
        this._spawnTimer = 4;
        this._spawnEnemy();
      }
      for (const e of this.enemies) {
        const dir = this.player.position.clone().sub(e.mesh.position);
        dir.y = 0;
        const d = dir.length();
        if (d > 0.01) e.mesh.position.addScaledVector(dir.normalize(), e.speed * dt);
        e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        if (d < 1.4) this._damage(8 * dt); // contact damage
      }
    }
  }

  _damage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0 && !this._dead) {
      this._dead = true;
      Vibration.play('death');
      bus.emit('notify', { icon: '💀', title: 'You died', text: 'Respawning…' });
      setTimeout(() => {
        this.health = 100;
        this.hunger = 100;
        this._dead = false;
        this.player.setPosition(0, 2, 0);
      }, 1500);
    }
  }

  hud() {
    return {
      title: 'SURVIVAL',
      health: Math.round(this.health),
      hunger: Math.round(this.hunger),
      wood: this.resources.wood,
      stone: this.resources.stone,
      phase: this.isNight ? '🌙 Night' : '☀️ Day',
    };
  }

  dispose() {
    this._offPhase?.();
    super.dispose();
  }
}
