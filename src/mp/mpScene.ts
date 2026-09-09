import * as THREE from 'three';
import {
  INTERACTABLES,
  INTERACT_RANGE,
  ROOMS,
  WALLS,
  WALL_HEIGHT,
  WALL_THICKNESS,
  roomAt,
  roomName,
  type Interactable,
} from './map';
import { QUALITY, type QualityPreset } from '../game/config';
import { buildCharacter, type CharacterModel } from '../render/characterModels';
import { carpetTexture, litMaterial, tileTexture, wallTexture, whiteTileTexture } from '../render/materials';
import type { NetClient } from './netClient';

/**
 * First-person renderer for the co-op map.
 *
 * Everything drawn here is a read of network state: the local player from the
 * predicted position, everyone else from the interpolation buffer, the
 * animatronics from the server's snapshot. The scene never decides anything -
 * if a body moves on screen it is because the server said so.
 *
 * It borrows the renderer from the single-player scene rather than creating a
 * second WebGL context, which is both faster to switch modes and safer on
 * mobile, where contexts are a scarce resource.
 */

const EYE_HEIGHT = 1.62;
const CROUCH_HEIGHT = 1.05;

interface RemoteAvatar {
  group: THREE.Group;
  label: THREE.Sprite;
  torch: THREE.Object3D;
  downedMarker: THREE.Object3D;
}

export interface SceneFocus {
  /** Nearest interactable in reach, if any. */
  interactable: Interactable | null;
  /** Nearest downed teammate in reach, if any. */
  downedId: string | null;
  /** Room the local player is standing in. */
  roomLabel: string;
}

export class CoopScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  private quality: QualityPreset;
  private ambient: THREE.AmbientLight;
  private roomLights: THREE.PointLight[] = [];
  private torch: THREE.SpotLight;
  private torchTarget = new THREE.Object3D();
  private avatars = new Map<string, RemoteAvatar>();
  private bots = new Map<string, CharacterModel>();
  private props = new Map<string, THREE.Object3D>();
  private propGlow = new Map<string, THREE.Mesh>();
  private bob = 0;
  private shakeUntil = 0;

  constructor(private readonly renderer: THREE.WebGLRenderer, quality: QualityPreset) {
    this.quality = quality;
    const q = QUALITY[quality];

    this.scene.background = new THREE.Color(0x04050a);
    if (q.fog) this.scene.fog = new THREE.Fog(0x04050a, 6, 34);

    this.camera = new THREE.PerspectiveCamera(76, 1, 0.05, 70);

    this.ambient = new THREE.AmbientLight(0x3d5170, 1.5);
    this.scene.add(this.ambient);

    this.buildMap(q.extraLights);
    this.buildProps();

    // The player's own torch: one real spot light, because it is the only
    // light a player ever studies closely.
    this.torch = new THREE.SpotLight(0xfff0d0, 0, 20, Math.PI / 6.5, 0.45, 1.1);
    this.torch.target = this.torchTarget;
    this.scene.add(this.torch, this.torchTarget);

    this.resize();
  }

  /* ------------------------------------------------------------ geometry */

  private buildMap(extraLights: number): void {
    const carpet = litMaterial('mp:carpet', { map: carpetTexture(10) });
    const tile = litMaterial('mp:tile', { map: tileTexture(12) });
    const wtile = litMaterial('mp:wtile', { map: whiteTileTexture(6) });
    const wallMat = litMaterial('mp:wall', { map: wallTexture(3) });
    const ceilMat = litMaterial('mp:ceil', { color: 0x14151a });

    for (const room of ROOMS) {
      const { x1, z1, x2, z2 } = room.rect;
      const w = x2 - x1;
      const d = z2 - z1;
      const floorMat = room.id === 'dining' || room.id === 'stage' ? carpet
        : room.id === 'kitchen' || room.id === 'freezer' || room.id === 'restrooms' ? wtile
        : tile;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
      floor.matrixAutoUpdate = false;
      floor.updateMatrix();
      this.scene.add(floor);

      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.set((x1 + x2) / 2, WALL_HEIGHT, (z1 + z2) / 2);
      ceiling.matrixAutoUpdate = false;
      ceiling.updateMatrix();
      this.scene.add(ceiling);

      if (room.light) {
        // Every room gets a light on the two highest presets; on the lower
        // ones only the rooms that matter for navigation keep theirs.
        const important = ['dining', 'corrS', 'corrW', 'corrE', 'electrical', 'office'].includes(room.id);
        if (important || extraLights > 2) {
          const light = new THREE.PointLight(room.light.color, room.light.intensity, 26, 1.4);
          light.position.set(room.light.x, WALL_HEIGHT - 0.35, room.light.z);
          light.userData.base = room.light.intensity;
          this.scene.add(light);
          this.roomLights.push(light);

          const fixture = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.08, 0.35),
            litMaterial('mp:fixture', { color: 0x2a2c32 }),
          );
          fixture.position.set(room.light.x, WALL_HEIGHT - 0.12, room.light.z);
          fixture.matrixAutoUpdate = false;
          fixture.updateMatrix();
          this.scene.add(fixture);
        }
      }
    }

    // Walls, merged into one instanced-ish batch of boxes.
    for (const wall of WALLS) {
      const w = Math.max(Math.abs(wall.x2 - wall.x1), WALL_THICKNESS);
      const d = Math.max(Math.abs(wall.z2 - wall.z1), WALL_THICKNESS);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_HEIGHT, d), wallMat);
      mesh.position.set((wall.x1 + wall.x2) / 2, WALL_HEIGHT / 2, (wall.z1 + wall.z2) / 2);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
    }
  }

  private buildProps(): void {
    const metal = litMaterial('mp:metal', { color: 0x5d636b });
    const panel = litMaterial('mp:panel', { color: 0x3a4149 });

    for (const item of INTERACTABLES) {
      const group = new THREE.Group();
      switch (item.kind) {
        case 'generator': {
          const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.9), metal);
          body.position.y = 0.55;
          const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8), metal);
          stack.position.set(0.5, 1.5, 0);
          group.add(body, stack);
          break;
        }
        case 'fusePanel': {
          const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 0.25), panel);
          box.position.y = 1.4;
          group.add(box);
          break;
        }
        case 'breaker': {
          const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.2), panel);
          box.position.y = 1.3;
          group.add(box);
          break;
        }
        case 'mainSwitch': {
          const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.28), panel);
          box.position.y = 1.35;
          const lever = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), litMaterial('mp:lever', { color: 0xc0392b }));
          lever.position.set(0, 1.15, 0.2);
          group.add(box, lever);
          break;
        }
        case 'fuse': {
          const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8), litMaterial('mp:fuse', { color: 0xd8b24a }));
          fuse.position.y = 0.9;
          const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.7), litMaterial('mp:crate', { color: 0x4a3524 }));
          crate.position.y = 0.38;
          group.add(crate, fuse);
          break;
        }
        case 'battery': {
          const stand = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.4), panel);
          stand.position.y = 0.5;
          const cell = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.2), litMaterial('mp:cell', { color: 0x4fd0a0 }));
          cell.position.y = 1.05;
          group.add(stand, cell);
          break;
        }
      }

      // A soft ring under anything the objective currently wants you to touch.
      const glow = new THREE.Mesh(
        new THREE.RingGeometry(0.6, 0.95, 18),
        new THREE.MeshBasicMaterial({ color: 0x4fd0a0, transparent: true, opacity: 0.0, side: THREE.DoubleSide }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.03;
      group.add(glow);
      this.propGlow.set(item.id, glow);

      group.position.set(item.x, 0, item.z);
      this.scene.add(group);
      this.props.set(item.id, group);
    }
  }

  /* ------------------------------------------------------------- avatars */

  private makeAvatar(name: string, colour: number): RemoteAvatar {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.95, 4, 8),
      litMaterial(`mp:guard:${colour}`, { color: colour }),
    );
    body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), litMaterial('mp:skin', { color: 0xb08968 }));
    head.position.y = 1.72;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 10), litMaterial('mp:cap', { color: 0x22262c }));
    cap.position.y = 1.9;
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.4, 0.42), litMaterial('mp:vest', { color: 0xe0a545 }));
    vest.position.y = 1.15;

    // Remote torches are an unlit cone, not a light: four extra spot lights
    // would cost more than the rest of the scene put together on a phone.
    const torch = new THREE.Mesh(
      new THREE.ConeGeometry(0.75, 3.4, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false }),
    );
    torch.rotation.x = -Math.PI / 2;
    torch.position.set(0, 1.5, 1.7);
    torch.visible = false;

    const downedMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.8, 16),
      new THREE.MeshBasicMaterial({ color: 0xc8402c, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    downedMarker.rotation.x = -Math.PI / 2;
    downedMarker.position.y = 0.05;
    downedMarker.visible = false;

    const label = makeLabel(name);
    label.position.y = 2.3;

    group.add(body, head, cap, vest, torch, downedMarker, label);
    this.scene.add(group);
    return { group, label, torch, downedMarker };
  }

  private avatarFor(id: string, name: string, index: number): RemoteAvatar {
    let avatar = this.avatars.get(id);
    if (!avatar) {
      const palette = [0x2f6f9f, 0x8f4f9f, 0x3f8f5f, 0x9f6f2f];
      avatar = this.makeAvatar(name, palette[index % palette.length]);
      this.avatars.set(id, avatar);
    }
    return avatar;
  }

  private botFor(id: string): CharacterModel {
    let model = this.bots.get(id);
    if (!model) {
      model = buildCharacter(id as 'bear' | 'rabbit' | 'hen' | 'fox');
      this.scene.add(model.group);
      this.bots.set(id, model);
    }
    return model;
  }

  /* -------------------------------------------------------------- update */

  update(net: NetClient, dt: number, now: number, control: { crouch: boolean; flashlight: boolean; moving: boolean }): SceneFocus {
    const snap = net.latestSnapshot;
    const me = net.me;

    // Camera follows the *predicted* local position so controls feel instant.
    const height = control.crouch ? CROUCH_HEIGHT : EYE_HEIGHT;
    if (control.moving && !control.crouch) this.bob += dt * 9;
    const bobY = Math.sin(this.bob) * 0.035 * (control.moving ? 1 : 0);
    const downed = me?.s === 1;
    const eliminated = me?.s === 2;

    let camX = net.predicted.x;
    let camZ = net.predicted.z;
    let camY = height + bobY;

    if (downed) {
      camY = 0.45;
    } else if (eliminated) {
      // Spectate: ride above the nearest living teammate.
      const target = snap?.players.find((p) => p.s === 0);
      if (target) {
        const sampled = net.sample(target.id, 'player');
        camX = (sampled?.x ?? target.x) - Math.sin(target.r) * 3.2;
        camZ = (sampled?.z ?? target.z) - Math.cos(target.r) * 3.2;
        camY = 2.6;
      }
    }

    if (now < this.shakeUntil) {
      camX += (Math.random() - 0.5) * 0.06;
      camY += (Math.random() - 0.5) * 0.06;
    }
    this.camera.position.set(camX, camY, camZ);
    this.camera.rotation.set(downed ? -0.35 : this.pitch, net.predicted.yaw, 0, 'YXZ');

    // Torch.
    const torchOn = control.flashlight && (me?.b ?? 0) > 0 && !eliminated;
    this.torch.intensity = torchOn ? 70 : 0;
    if (torchOn) {
      this.torch.position.set(camX, camY - 0.1, camZ);
      const dir = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
      this.torchTarget.position.set(camX + dir.x * 6, camY + dir.y * 6, camZ + dir.z * 6);
    }

    // Blackout: the building's own lights are the shared state, not a local
    // toggle, so they follow the snapshot exactly.
    const blackout = snap?.blackout ?? false;
    for (const light of this.roomLights) {
      const base = light.userData.base as number;
      light.intensity = blackout ? 0 : base * (0.94 + Math.sin(now * 6 + light.position.x) * 0.06);
    }
    this.ambient.intensity = blackout ? 0.1 : 1.5;
    if (this.scene.fog) (this.scene.fog as THREE.Fog).far = blackout ? 18 : 34;

    // Remote players.
    const seen = new Set<string>();
    snap?.players.forEach((p, index) => {
      seen.add(p.id);
      if (p.id === net.playerId) return;
      const name = net.lobby?.players.find((lp) => lp.id === p.id)?.name ?? 'GUARD';
      const avatar = this.avatarFor(p.id, name, index);
      const sampled = net.sample(p.id, 'player');
      const x = sampled?.x ?? p.x;
      const z = sampled?.z ?? p.z;
      avatar.group.position.set(x, 0, z);
      avatar.group.rotation.y = sampled?.yaw ?? p.r;
      avatar.group.visible = p.s !== 3; // hide the disconnected
      avatar.torch.visible = p.f;
      avatar.downedMarker.visible = p.s === 1;
      avatar.group.scale.y = p.s === 1 ? 0.4 : 1;
      avatar.label.visible = p.s !== 2;
    });
    for (const [id, avatar] of this.avatars) {
      if (!seen.has(id)) {
        this.scene.remove(avatar.group);
        this.avatars.delete(id);
      }
    }

    // Animatronics.
    for (const bot of snap?.bots ?? []) {
      const model = this.botFor(bot.id);
      const sampled = net.sample(bot.id, 'bot');
      model.group.position.set(sampled?.x ?? bot.x, 0, sampled?.z ?? bot.z);
      model.group.rotation.y = sampled?.yaw ?? bot.r;
      model.group.visible = true;
    }

    // Objective highlights.
    const targets = new Set(snap?.obj.targets ?? []);
    for (const [id, glow] of this.propGlow) {
      const material = glow.material as THREE.MeshBasicMaterial;
      const wanted = targets.has(id);
      const pulse = 0.35 + Math.sin(now * 4) * 0.2;
      material.opacity += ((wanted ? pulse : 0) - material.opacity) * Math.min(1, dt * 6);
    }
    // Fuse crates disappear once somebody has taken the fuse.
    for (const item of INTERACTABLES) {
      if (item.kind !== 'fuse') continue;
      const prop = this.props.get(item.id);
      if (prop) prop.visible = (snap?.ints[item.id] ?? 1) === 1;
    }

    return {
      interactable: this.findInteractable(camX, camZ, snap?.obj.targets ?? []),
      downedId: this.findDowned(net, camX, camZ),
      roomLabel: roomName(roomAt(camX, camZ)),
    };
  }

  private findInteractable(x: number, z: number, targets: string[]): Interactable | null {
    let best: Interactable | null = null;
    let bestDist = INTERACT_RANGE * INTERACT_RANGE;
    for (const item of INTERACTABLES) {
      const d = (item.x - x) ** 2 + (item.z - z) ** 2;
      // Prefer whatever the objective is actually asking for when two things
      // are within arm's reach of each other.
      const bias = targets.includes(item.id) ? 0.8 : 1;
      if (d * bias < bestDist) {
        bestDist = d * bias;
        best = item;
      }
    }
    return best;
  }

  private findDowned(net: NetClient, x: number, z: number): string | null {
    let best: string | null = null;
    let bestDist = 2.2 * 2.2;
    for (const p of net.latestSnapshot?.players ?? []) {
      if (p.s !== 1 || p.id === net.playerId) continue;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = p.id;
      }
    }
    return best;
  }

  /* -------------------------------------------------------------- camera */

  pitch = 0;

  look(dx: number, dy: number, sensitivity: number, net: NetClient): void {
    net.predicted.yaw -= dx * 3.2 * sensitivity;
    this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch - dy * 2.4 * sensitivity));
  }

  shake(seconds: number, now: number): void {
    this.shakeUntil = now + seconds;
  }

  setQuality(preset: QualityPreset): void {
    this.quality = preset;
    const q = QUALITY[preset];
    this.scene.fog = q.fog ? new THREE.Fog(0x04050a, 6, 34) : null;
    this.resize();
  }

  resize(): void {
    const q = QUALITY[this.quality];
    const dpr = Math.min(window.devicePixelRatio || 1, q.pixelRatioCap);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 1 ? 88 : 76;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry?.dispose();
    });
    this.avatars.clear();
    this.bots.clear();
    this.props.clear();
    this.propGlow.clear();
  }
}

function makeLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 34px ui-monospace, monospace';
    ctx.fillStyle = '#e0a545';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.slice(0, 12).toUpperCase(), 128, 34);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true, transparent: true }));
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}
