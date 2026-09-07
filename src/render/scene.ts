import * as THREE from 'three';
import { CAMERAS, QUALITY, Room, type CharacterId, type QualityPreset } from '../game/config';
import { ROOM_ANCHORS, buildWorld, type World } from './world';
import { buildCharacter, type CharacterModel } from './characterModels';
import type { NightSession } from '../game/nightManager';

/**
 * The 3D presentation layer for a night.
 *
 * It owns the renderer, the building, the character models and the two
 * cameras (the guard's own view, and whichever security camera is on the
 * tablet). It reads the simulation and never writes to it - every method here
 * is either "draw what the session says" or "play a canned bit of theatre".
 */

const PLAYER_EYE = new THREE.Vector3(0, 1.5, 10.9);
/** How far the guard can swivel before the chair stops them. */
const YAW_LIMIT = 1.18;
const PITCH_LIMIT = 0.42;

export class OfficeScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly officeCamera: THREE.PerspectiveCamera;
  readonly feedCamera: THREE.PerspectiveCamera;

  private world: World;
  private models = new Map<CharacterId, CharacterModel>();
  private quality: QualityPreset;
  private ambient: THREE.AmbientLight;

  /** Player look, driven by touch drag. */
  yaw = 0;
  pitch = 0;
  private targetYaw = 0;
  private targetPitch = 0;

  private fanSpin = 0;
  private crankSpin = 0;
  private flicker = 0;
  private shakeUntil = 0;
  private jumpscare: { id: CharacterId; t: number } | null = null;

  constructor(canvas: HTMLCanvasElement, quality: QualityPreset) {
    this.quality = quality;
    const q = QUALITY[quality];

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: q.antialias,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x000000, 1);

    this.scene.background = new THREE.Color(0x05060a);
    if (q.fog) this.scene.fog = new THREE.Fog(0x05060a, 16, 42);

    this.officeCamera = new THREE.PerspectiveCamera(72, 1, 0.05, 60);
    this.officeCamera.position.copy(PLAYER_EYE);
    this.feedCamera = new THREE.PerspectiveCamera(64, 1, 0.05, 60);

    this.world = buildWorld(q);
    this.scene.add(this.world.root);
    this.ambient = this.world.root.children.find((c) => (c as THREE.AmbientLight).isAmbientLight) as THREE.AmbientLight;

    for (const id of ['bear', 'rabbit', 'hen', 'fox', 'husk'] as const) {
      const model = buildCharacter(id);
      model.group.visible = false;
      this.scene.add(model.group);
      this.models.set(id, model);
    }

    this.resize();
  }

  /* ------------------------------------------------------------- plumbing */

  setQuality(preset: QualityPreset): void {
    if (preset === this.quality) return;
    this.quality = preset;
    const q = QUALITY[preset];
    this.renderer.shadowMap.enabled = q.shadows;
    this.scene.fog = q.fog ? new THREE.Fog(0x05060a, 16, 42) : null;
    // Rebuilding the world would drop a frame mid-shift; the light count and
    // shadow map are the parts worth switching live.
    for (const light of this.world.gridLights) light.castShadow = q.shadows && light === this.world.gridLights[0];
    this.resize();
  }

  resize(): void {
    const q = QUALITY[this.quality];
    const dpr = Math.min(window.devicePixelRatio || 1, q.pixelRatioCap);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    this.officeCamera.aspect = aspect;
    this.officeCamera.fov = aspect < 1 ? 86 : 72; // portrait needs a wider lens
    this.officeCamera.updateProjectionMatrix();
    this.feedCamera.aspect = aspect;
    this.feedCamera.updateProjectionMatrix();
  }

  dispose(): void {
    this.world.dispose();
    this.renderer.dispose();
  }

  /* ---------------------------------------------------------------- input */

  /** Drag delta in normalised screen units. */
  look(dx: number, dy: number, sensitivity: number): void {
    this.targetYaw = clamp(this.targetYaw - dx * 2.4 * sensitivity, -YAW_LIMIT, YAW_LIMIT);
    this.targetPitch = clamp(this.targetPitch - dy * 1.6 * sensitivity, -PITCH_LIMIT, PITCH_LIMIT);
  }

  /** Snap the view toward a doorway - used by the hall-light buttons. */
  glance(side: 'left' | 'right' | 'center'): void {
    this.targetYaw = side === 'center' ? 0 : side === 'left' ? YAW_LIMIT * 0.92 : -YAW_LIMIT * 0.92;
  }

  /* ------------------------------------------------------------ animation */

  startJumpscare(id: CharacterId): void {
    this.jumpscare = { id, t: 0 };
  }

  get jumpscareTime(): number {
    return this.jumpscare?.t ?? -1;
  }

  /**
   * Pull the world in line with the simulation. Called once per rendered
   * frame with the real frame delta.
   */
  sync(session: NightSession, dt: number, now: number): void {
    const blackout = session.phase === 'blackout';

    // Smooth the look so a flick of the thumb does not snap the head around.
    this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 12);
    this.pitch += (this.targetPitch - this.pitch) * Math.min(1, dt * 12);

    // Shutters ride the door travel value.
    for (const side of ['left', 'right'] as const) {
      const mesh = this.world.shutters[side];
      const t = session.doors.travel(side);
      mesh.position.y = THREE.MathUtils.lerp(
        mesh.userData.openY as number,
        mesh.userData.closedY as number,
        t,
      );
    }

    // Hall floods, grid lights, emergency LED.
    for (const side of ['left', 'right'] as const) {
      this.world.hallLights[side].intensity = session.doors.isLightOn(side) ? 5.5 : 0;
    }
    this.flicker += dt;
    const flickerAmount = blackout ? 0 : 1 + Math.sin(this.flicker * 11.3) * 0.03 + Math.sin(this.flicker * 3.1) * 0.02;
    for (const light of this.world.gridLights) {
      const base = light.userData.baseIntensity ?? (light.userData.baseIntensity = light.intensity);
      light.intensity = blackout ? 0 : (base as number) * flickerAmount;
    }
    this.ambient.intensity = blackout ? 0.09 : 1.05;
    this.world.emergencyLight.intensity = blackout ? 1.5 + Math.sin(now * 6) * 0.25 : 0;

    // Desk fan and, during a blackout, the crank handle.
    this.fanSpin += dt * (blackout ? 0 : 9);
    this.world.fan.rotation.z = this.fanSpin;
    if (session.isCranking) this.crankSpin += dt * 14;
    this.world.crank.rotation.z = this.crankSpin;

    // Crow's Nest curtain opens as the fox works his way out.
    const open = this.world.coveCurtain;
    const target = 1 - session.director.fox.curtainOpen * 0.82;
    open.scale.x += (target - open.scale.x) * Math.min(1, dt * 3);
    open.position.x = -11.5 - (1 - open.scale.x) * 2.5;

    this.syncCharacters(session);
    if (this.jumpscare) this.jumpscare.t += dt;
  }

  private syncCharacters(session: NightSession): void {
    const perRoom = new Map<Room, number>();
    const officeView = !session.monitor.up;

    for (const [id, model] of this.models) {
      if (id === 'husk') {
        const present = session.director.husk.state === 'present';
        model.group.visible = present;
        if (present) {
          model.group.position.set(0, 0.05, 8.9);
          model.group.rotation.y = Math.PI;
        }
        continue;
      }

      const character = session.director.roster.find((c) => c.id === id);
      if (!character) continue;
      const room = character.room;
      const anchor = ROOM_ANCHORS[room];
      const slot = perRoom.get(room) ?? 0;
      perRoom.set(room, slot + 1);

      const pos = anchor.pos.clone().addScaledVector(anchor.spread, slot * 0.9 - 0.45);
      model.group.position.copy(pos);
      model.group.rotation.y = anchor.face;
      model.group.visible = room !== Room.Office;

      // In the office view a character in a doorway is a silhouette with two
      // glowing eyes until you flick the light on them. That reveal is the
      // whole point of the light button, so it must not leak.
      const inDoorway = room === Room.WestCorner || room === Room.EastCorner;
      const lit =
        !officeView ||
        !inDoorway ||
        session.doors.isLightOn(room === Room.WestCorner ? 'left' : 'right');
      setBodyVisible(model, lit);
    }
  }

  /* --------------------------------------------------------------- render */

  render(session: NightSession, now: number): void {
    if (this.jumpscare) {
      this.renderJumpscare(now);
      return;
    }
    if (session.monitor.up && session.monitor.flip > 0.5 && session.monitor.powered) {
      const cam = CAMERAS[session.monitor.index];
      this.feedCamera.position.set(...cam.view.pos);
      this.feedCamera.lookAt(...cam.view.target);
      // Slow drift so a feed never looks like a still image.
      this.feedCamera.position.x += Math.sin(now * 0.6) * 0.03;
      this.renderer.render(this.scene, this.feedCamera);
      return;
    }

    const shake = now < this.shakeUntil ? (this.shakeUntil - now) * 0.06 : 0;
    this.officeCamera.position.copy(PLAYER_EYE);
    if (shake > 0) {
      this.officeCamera.position.x += (Math.random() - 0.5) * shake;
      this.officeCamera.position.y += (Math.random() - 0.5) * shake;
    }
    this.officeCamera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.renderer.render(this.scene, this.officeCamera);
  }

  /** Rattle the view - a door slam, or something hitting one. */
  shake(seconds = 0.35, now = performance.now() / 1000): void {
    this.shakeUntil = now + seconds;
  }

  private renderJumpscare(now: number): void {
    const js = this.jumpscare;
    if (!js) return;
    const model = this.models.get(js.id);
    if (model) {
      for (const [, m] of this.models) m.group.visible = m === model;
      setBodyVisible(model, true);
      const lunge = Math.min(1, js.t / 0.18);
      model.group.position.set(0, 0.5 - lunge * 0.3, 10.9 - 1.75 + lunge * 0.6);
      model.group.rotation.y = Math.PI + Math.sin(js.t * 40) * 0.09;
      model.head.rotation.x = Math.sin(js.t * 52) * 0.16;
      model.head.rotation.z = Math.cos(js.t * 37) * 0.12;
    }
    this.ambient.intensity = 2.0;
    for (const light of this.world.gridLights) light.intensity = 0;
    this.world.emergencyLight.intensity = 0;

    this.officeCamera.position.copy(PLAYER_EYE);
    this.officeCamera.position.x += (Math.random() - 0.5) * 0.22;
    this.officeCamera.position.y += (Math.random() - 0.5) * 0.22;
    this.officeCamera.rotation.set(Math.sin(now * 31) * 0.05, Math.sin(now * 27) * 0.06, Math.sin(now * 19) * 0.04, 'YXZ');
    this.renderer.render(this.scene, this.officeCamera);
  }

  /* ----------------------------------------------------------- menu mode */

  private menuCameo: { id: CharacterId; until: number } | null = null;
  private menuCamera = new THREE.PerspectiveCamera(58, 1, 0.05, 60);

  /**
   * The main menu is the same building, seen from a slow dolly across the
   * dining hall. Reusing the world costs nothing extra to load and means the
   * menu is genuinely the place you are about to be locked inside. Once in a
   * while somebody wanders through the shot and leaves again.
   */
  renderMenu(now: number, rich: boolean): void {
    const cam = this.menuCamera;
    cam.aspect = this.officeCamera.aspect;
    cam.updateProjectionMatrix();
    const drift = Math.sin(now * 0.11);
    // Framed so the stage sits in the left third, clear of the menu column.
    cam.position.set(3.4 + drift * 1.4, 2.1 + Math.sin(now * 0.23) * 0.1, -7.6 + Math.cos(now * 0.09) * 1.2);
    cam.lookAt(-1.6 + drift * 0.5, 1.45, -16.8);

    // Light flicker, heavier than in-shift because nothing is at stake here.
    for (const light of this.world.gridLights) {
      const base = (light.userData.baseIntensity ?? (light.userData.baseIntensity = light.intensity)) as number;
      const f = 1 + Math.sin(now * 7.7) * 0.06 + (Math.random() < 0.004 ? -0.85 : 0);
      light.intensity = base * 1.35 * f;
    }
    this.ambient.intensity = 1.5;

    if (rich) {
      if (!this.menuCameo && Math.random() < 0.004) {
        const cast: CharacterId[] = ['bear', 'rabbit', 'hen', 'fox'];
        this.menuCameo = { id: cast[(Math.random() * cast.length) | 0], until: now + 1.6 + Math.random() * 2 };
      }
      if (this.menuCameo && now > this.menuCameo.until) this.menuCameo = null;
    }

    for (const [id, model] of this.models) {
      const onStage = id === 'bear' || id === 'rabbit' || id === 'hen';
      const cameo = this.menuCameo?.id === id;
      model.group.visible = onStage || cameo;
      setBodyVisible(model, true);
      if (cameo && !onStage) {
        model.group.position.set(-8.5 + Math.sin(now * 0.8) * 0.6, 0, -6.5);
        model.group.rotation.y = Math.PI * 0.4;
      } else if (onStage) {
        const slot = id === 'rabbit' ? -1.9 : id === 'hen' ? 1.9 : 0;
        model.group.position.set(slot, 0.6, -16);
        model.group.rotation.y = Math.sin(now * 0.4 + slot) * 0.12;
      }
    }
    this.world.fan.rotation.z = now * 6;
    this.renderer.render(this.scene, cam);
  }

  /** Reset everything a finished night leaves behind. */
  resetForNewNight(): void {
    this.jumpscare = null;
    this.yaw = this.targetYaw = 0;
    this.pitch = this.targetPitch = 0;
    for (const [, m] of this.models) {
      m.group.visible = false;
      setBodyVisible(m, true);
      m.head.rotation.set(0, 0, 0);
    }
    this.ambient.intensity = 1.05;
  }
}

function setBodyVisible(model: CharacterModel, visible: boolean): void {
  model.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (model.eyes.includes(mesh)) return;
    mesh.visible = visible;
  });
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
