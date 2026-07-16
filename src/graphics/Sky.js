/**
 * Sky.js
 * ------
 * A large inverted sphere with a vertical gradient shader for the sky, plus a
 * drifting cloud layer built from soft sprite planes. Colours are driven by the
 * DayNightCycle. This is intentionally shader-light so it runs fast on mobile.
 */

import * as THREE from 'three';

const SKY_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform float uOffset;
  varying vec3 vWorldPos;
  void main() {
    float h = normalize(vWorldPos).y;          // -1 (down) .. 1 (up)
    float t = clamp((h + uOffset) * 0.5 + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(mix(uBottom, uTop, t), 1.0);
  }
`;

export class Sky {
  constructor(scene) {
    this.scene = scene;

    const geo = new THREE.SphereGeometry(500, 32, 16);
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x2a6bd6) },
        uBottom: { value: new THREE.Color(0xbfe0ff) },
        uOffset: { value: 0.1 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    scene.add(this.mesh);

    this._buildClouds();
  }

  _buildClouds() {
    this.clouds = new THREE.Group();
    const tex = this._cloudTexture();
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    for (let i = 0; i < 24; i++) {
      const s = new THREE.Sprite(mat.clone());
      const scale = 30 + Math.random() * 60;
      s.scale.set(scale, scale * 0.5, 1);
      s.position.set(
        (Math.random() - 0.5) * 500,
        80 + Math.random() * 60,
        (Math.random() - 0.5) * 500
      );
      s.userData.drift = 0.5 + Math.random();
      this.clouds.add(s);
    }
    this.scene.add(this.clouds);
  }

  /** Procedurally paint a soft radial cloud puff onto a canvas texture. */
  _cloudTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Set gradient colours (called by DayNightCycle). */
  setColors(top, bottom) {
    this.material.uniforms.uTop.value.copy(top);
    this.material.uniforms.uBottom.value.copy(bottom);
  }

  update(dt) {
    // Slowly drift clouds; wrap them across the map for an endless sky.
    for (const s of this.clouds.children) {
      s.position.x += s.userData.drift * dt;
      if (s.position.x > 260) s.position.x = -260;
    }
  }
}
