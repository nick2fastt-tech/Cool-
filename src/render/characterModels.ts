import * as THREE from 'three';
import { CHARACTERS, type CharacterId } from '../game/config';
import { glowMaterial, litMaterial } from './materials';

/**
 * Original low-poly animatronic models, built from primitives.
 *
 * Design brief: four silhouettes that read instantly at low resolution, on a
 * dark camera feed, from across a room - a heavy square bear, a tall thin
 * rabbit, a round wide hen, and a lean forward-leaning fox. Nothing here is
 * copied from anything; the shapes are chosen for readability, and the eye
 * meshes are unlit so they stay visible when the room lights die, which is the
 * only warning a player gets in a dark hallway.
 *
 * Budget: roughly 250-400 triangles each, one shared material per colour.
 */

const SEG = 8; // sphere segments - deliberately low, this is a mobile target

function eye(radius: number, color = 0xfff2c8): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, SEG, SEG / 2), glowMaterial(`eye:${color}`, color, 1.6));
}

function limb(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

export interface CharacterModel {
  group: THREE.Group;
  /** Toggled when the character is lit only by their own eyes. */
  eyes: THREE.Mesh[];
  /** Head node, so a jumpscare can lunge it at the camera. */
  head: THREE.Object3D;
}

export function buildCharacter(id: CharacterId): CharacterModel {
  const def = CHARACTERS[id];
  const body = litMaterial(`suit:${id}`, { color: def.color });
  const dark = litMaterial('suit:dark', { color: 0x14100e });
  const light = litMaterial(`belly:${id}`, { color: new THREE.Color(def.color).offsetHSL(0, -0.1, 0.16).getHex() });

  const group = new THREE.Group();
  const head = new THREE.Group();
  const eyes: THREE.Mesh[] = [];

  switch (id) {
    case 'bear':
    case 'husk': {
      const suit = id === 'husk' ? litMaterial('suit:husk', { color: 0xb8a24a }) : body;
      const torso = limb(0.92, 1.05, 0.62, suit);
      torso.position.y = 1.12;
      const belly = limb(0.62, 0.66, 0.1, light);
      belly.position.set(0, 1.08, 0.3);
      const hips = limb(0.78, 0.5, 0.55, suit);
      hips.position.y = 0.44;
      const legL = limb(0.3, 0.5, 0.34, dark);
      legL.position.set(-0.24, 0.22, 0);
      const legR = legL.clone();
      legR.position.x = 0.24;
      const armL = limb(0.24, 0.9, 0.26, suit);
      armL.position.set(-0.6, 1.1, 0);
      const armR = armL.clone();
      armR.position.x = 0.6;

      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, SEG + 2, SEG), suit);
      const muzzle = limb(0.42, 0.26, 0.26, light);
      muzzle.position.set(0, -0.08, 0.34);
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, SEG, SEG / 2), dark);
      nose.position.set(0, 0.02, 0.5);
      const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.09, SEG), suit);
      earL.rotation.x = Math.PI / 2;
      earL.position.set(-0.3, 0.36, 0);
      const earR = earL.clone();
      earR.position.x = 0.3;
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, SEG), dark);
      hat.position.y = 0.55;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, SEG), dark);
      brim.position.y = 0.4;
      const eyeL = eye(0.075, id === 'husk' ? 0xffffff : 0xfff2c8);
      eyeL.position.set(-0.15, 0.06, 0.36);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.15;
      eyes.push(eyeL, eyeR as THREE.Mesh);
      head.add(skull, muzzle, nose, earL, earR, hat, brim, eyeL, eyeR);
      head.position.y = 1.92;
      group.add(torso, belly, hips, legL, legR, armL, armR, head);
      break;
    }

    case 'rabbit': {
      const torso = limb(0.7, 1.1, 0.5, body);
      torso.position.y = 1.16;
      const belly = limb(0.44, 0.7, 0.08, light);
      belly.position.set(0, 1.12, 0.25);
      const hips = limb(0.62, 0.44, 0.46, body);
      hips.position.y = 0.46;
      const legL = limb(0.24, 0.52, 0.3, dark);
      legL.position.set(-0.19, 0.22, 0);
      const legR = legL.clone();
      legR.position.x = 0.19;
      const armL = limb(0.19, 1.0, 0.2, body);
      armL.position.set(-0.46, 1.14, 0);
      const armR = armL.clone();
      armR.position.x = 0.46;

      const skull = limb(0.44, 0.46, 0.44, body);
      const snout = limb(0.26, 0.2, 0.24, light);
      snout.position.set(0, -0.12, 0.3);
      const earL = limb(0.14, 0.78, 0.08, body);
      earL.position.set(-0.14, 0.6, -0.02);
      earL.rotation.z = 0.09;
      const earR = earL.clone();
      earR.position.x = 0.14;
      earR.rotation.z = -0.09;
      const eyeL = eye(0.07, 0xff4d4d);
      eyeL.position.set(-0.13, 0.06, 0.22);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.13;
      eyes.push(eyeL, eyeR as THREE.Mesh);
      head.add(skull, snout, earL, earR, eyeL, eyeR);
      head.position.y = 1.98;
      group.add(torso, belly, hips, legL, legR, armL, armR, head);
      break;
    }

    case 'hen': {
      const torso = new THREE.Mesh(new THREE.SphereGeometry(0.56, SEG + 2, SEG), body);
      torso.scale.set(1, 1.15, 0.9);
      torso.position.y = 1.1;
      const bib = limb(0.5, 0.44, 0.1, litMaterial('hen:bib', { color: 0xd8d2c0 }));
      bib.position.set(0, 1.02, 0.44);
      const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.62, SEG), litMaterial('hen:leg', { color: 0xd8862a }));
      legL.position.set(-0.18, 0.31, 0);
      const legR = legL.clone();
      legR.position.x = 0.18;
      const wingL = limb(0.14, 0.62, 0.34, body);
      wingL.position.set(-0.52, 1.1, 0);
      const wingR = wingL.clone();
      wingR.position.x = 0.52;

      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.34, SEG + 2, SEG), body);
      const beakTop = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), litMaterial('hen:beak', { color: 0xe0902e }));
      beakTop.rotation.x = Math.PI / 2;
      beakTop.position.set(0, -0.02, 0.34);
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 4), litMaterial('hen:tuft', { color: 0xb03a2a }));
      tuft.position.y = 0.4;
      const eyeL = eye(0.075, 0xfff2c8);
      eyeL.position.set(-0.14, 0.1, 0.27);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.14;
      eyes.push(eyeL, eyeR as THREE.Mesh);
      head.add(skull, beakTop, tuft, eyeL, eyeR);
      head.position.y = 1.78;
      group.add(torso, bib, legL, legR, wingL, wingR, head);
      break;
    }

    case 'fox': {
      const torso = limb(0.62, 1.0, 0.46, body);
      torso.position.y = 1.1;
      torso.rotation.x = -0.12; // he stands like he is about to move
      const chest = limb(0.4, 0.4, 0.1, litMaterial('fox:chest', { color: 0xd8cdb4 }));
      chest.position.set(0, 1.18, 0.24);
      const hips = limb(0.56, 0.42, 0.44, body);
      hips.position.y = 0.46;
      const legL = limb(0.22, 0.5, 0.3, dark);
      legL.position.set(-0.17, 0.22, 0);
      const legR = legL.clone();
      legR.position.x = 0.17;
      const armL = limb(0.18, 0.86, 0.2, body);
      armL.position.set(-0.42, 1.1, 0.06);
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 10, Math.PI * 1.4), litMaterial('fox:metal', { color: 0x9aa0a6 }));
      hook.position.set(0.44, 0.62, 0.08);
      hook.rotation.y = Math.PI / 2;
      const armR = limb(0.18, 0.72, 0.2, body);
      armR.position.set(0.44, 1.16, 0.06);

      const skull = limb(0.36, 0.36, 0.4, body);
      const snout = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.42, 4), body);
      snout.rotation.x = Math.PI / 2;
      snout.position.set(0, -0.06, 0.36);
      const earL = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 4), body);
      earL.position.set(-0.15, 0.28, 0);
      const earR = earL.clone();
      earR.position.x = 0.15;
      const patch = limb(0.2, 0.16, 0.03, dark);
      patch.position.set(0.11, 0.06, 0.2);
      const eyeL = eye(0.07, 0xffd24a);
      eyeL.position.set(-0.11, 0.06, 0.2);
      eyes.push(eyeL);
      head.add(skull, snout, earL, earR, patch, eyeL);
      head.position.y = 1.86;
      group.add(torso, chest, hips, legL, legR, armL, armR, hook, head);
      break;
    }
  }

  group.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
    o.frustumCulled = true;
  });
  group.userData.characterId = id;
  return { group, eyes, head };
}
