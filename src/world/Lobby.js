/**
 * Lobby.js
 * --------
 * The central hub players spawn into. It assembles the environment, a spawn
 * platform, four teleport portals (one per game), a shop kiosk, a leaderboard
 * board, and info signs. Portals are physics triggers that emit `portal:enter`
 * so the GameManager can transition into a mode.
 *
 * A "world" module owns its own scene contents and colliders and cleans up
 * after itself via dispose(), so switching between hub and games never leaks.
 */

import * as THREE from 'three';
import { Environment } from './Environment.js';
import { bus } from '../core/EventBus.js';

/** Definition of each portal: id -> label/color/position. */
const PORTALS = [
  { id: 'obby', label: 'OBBY', color: 0x00c2ff, pos: [-12, 0, -10] },
  { id: 'survival', label: 'SURVIVAL', color: 0x3fbf4f, pos: [-4, 0, -14] },
  { id: 'racing', label: 'RACING', color: 0xff9500, pos: [4, 0, -14] },
  { id: 'arena', label: 'ARENA', color: 0xff3b30, pos: [12, 0, -10] },
];

export class Lobby {
  /**
   * @param {THREE.Scene} scene
   * @param {PhysicsWorld} physics
   */
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    this.group = new THREE.Group();
    this.spawnPoint = new THREE.Vector3(0, 1, 8);
    this._animated = [];
    this._portalMeshes = [];
    this._build();
    scene.add(this.group);
  }

  _build() {
    // Scenery.
    const ground = Environment.ground(220, 0x5aa84f);
    this.group.add(ground);
    this.physics.groundHeight = () => 0;

    this.group.add(Environment.mountains());
    this.group.add(Environment.trees(70, 100, 22));
    this.group.add(Environment.rocks(24, 90));
    this._water = Environment.water(50, -0.5);
    this._water.position.set(70, -0.5, 40);
    this.group.add(this._water);

    // Central spawn platform (stone dais).
    const dais = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 11, 1, 32),
      new THREE.MeshStandardMaterial({ color: 0x9aa4b2, roughness: 0.9 })
    );
    dais.position.y = 0.5; // top surface at y = 1
    dais.receiveShadow = true;
    this.group.add(dais);
    // Register the dais as a solid so players stand ON it (top at y=1) instead
    // of sinking to the ground plane through it.
    this.physics.addSolidFromMesh(dais);

    // Portals to each game.
    for (const p of PORTALS) this._buildPortal(p);

    // Shop kiosk + leaderboard board + info sign.
    this._buildKiosk(new THREE.Vector3(-16, 0, 2), 'SHOP', 0xffd60a, 'shop');
    this._buildBoard(new THREE.Vector3(16, 0, 2), 'LEADERBOARD', 0x9b5de5, 'leaderboard');
    this._buildBoard(new THREE.Vector3(0, 0, 16), 'WELCOME TO NOVAVERSE', 0x00bbf9, 'info');
  }

  _buildPortal({ id, label, color, pos }) {
    const grp = new THREE.Group();
    grp.position.set(pos[0], 0, pos[2]);

    // Glowing ring.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.8, 0.28, 12, 32),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.4 })
    );
    ring.position.y = 2.2;
    ring.castShadow = true;

    // Swirling inner disc (animated).
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    disc.position.y = 2.2;

    // Base pad.
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 0.3, 24),
      new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.8 })
    );
    pad.position.y = 0.15;
    pad.receiveShadow = true;

    grp.add(ring, disc, pad);
    grp.add(this._makeLabel(label, color, 4.2));
    this.group.add(grp);

    this._animated.push({ ring, disc });
    this._portalMeshes.push({ id, grp });

    // Trigger volume: stepping into the ring enters the game.
    const box = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(pos[0], 2, pos[2]),
      new THREE.Vector3(3, 4, 3)
    );
    this.physics.addTrigger(box, {
      tag: `portal:${id}`,
      onEnter: () => bus.emit('portal:enter', id),
    });
  }

  _buildKiosk(pos, label, color, tag) {
    const grp = new THREE.Group();
    grp.position.copy(pos);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3, 3, 2),
      new THREE.MeshStandardMaterial({ color: 0x3a405a, roughness: 0.8 })
    );
    body.position.y = 1.5;
    body.castShadow = body.receiveShadow = true;
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.8, 0.2),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 })
    );
    sign.position.set(0, 3.3, 1);
    grp.add(body, sign, this._makeLabel(label, color, 4.2));
    this.group.add(grp);

    const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(pos.x, 1.5, pos.z + 2), new THREE.Vector3(4, 3, 3));
    this.physics.addTrigger(box, { tag, onEnter: () => bus.emit('kiosk:enter', tag) });
  }

  _buildBoard(pos, label, color, tag) {
    const grp = new THREE.Group();
    grp.position.copy(pos);
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(5, 3, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x1b1f2a, roughness: 0.7 })
    );
    panel.position.y = 3;
    const posts = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 3, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x555 })
    );
    posts.position.y = 1.5;
    grp.add(panel, posts, this._makeLabel(label, color, 5));
    this.group.add(grp);

    const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(pos.x, 1.5, pos.z), new THREE.Vector3(6, 3, 3));
    this.physics.addTrigger(box, { tag, onEnter: () => bus.emit('kiosk:enter', tag) });
  }

  /** A floating text label rendered from a canvas texture (billboarded). */
  _makeLabel(text, color, height) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0;
    ctx.fillRect(0, 0, 512, 128);
    ctx.globalAlpha = 1;
    ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
    ctx.strokeStyle = '#0008';
    ctx.lineWidth = 8;
    ctx.strokeText(text, 256, 64);
    ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    spr.scale.set(6, 1.5, 1);
    spr.position.y = height;
    return spr;
  }

  update(dt, elapsed) {
    for (const a of this._animated) {
      a.ring.rotation.z += dt * 0.6;
      a.disc.rotation.z -= dt * 1.2;
      a.disc.material.opacity = 0.25 + Math.sin(elapsed * 3) * 0.12;
    }
    this._water?.update(elapsed);
  }

  dispose() {
    this.scene.remove(this.group);
    this.physics.clearTriggers();
    this.group.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) {
        o.material.map?.dispose?.();
        o.material.dispose?.();
      }
    });
  }
}
