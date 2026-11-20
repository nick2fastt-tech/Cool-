// Analog wall clocks that show the real time (all hands are instanced: 3 draw calls total).
import * as THREE from 'three';

export class Clocks {
  constructor(scene, list, M) {
    this.list = list;
    const mk = (w, len, tail, d, mat) => {
      const g = new THREE.BoxGeometry(w, len + tail, d);
      g.translate(0, (len - tail) / 2, 0);
      const im = new THREE.InstancedMesh(g, mat, list.length);
      im.frustumCulled = false;
      im.castShadow = false;
      im.receiveShadow = false;
      scene.add(im);
      return im;
    };
    this.hour = mk(0.016, 0.09, 0.02, 0.006, M.black);
    this.minute = mk(0.011, 0.135, 0.025, 0.006, M.black);
    this.second = mk(0.005, 0.15, 0.035, 0.006, M.red);
    this.bases = list.map((c) => {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(c.nx, c.nz), 0));
      m.compose(new THREE.Vector3(c.x, c.y, c.z), q, new THREE.Vector3(1, 1, 1));
      return m;
    });
    this._rz = new THREE.Matrix4();
    this._m = new THREE.Matrix4();
    this._off = [new THREE.Matrix4().makeTranslation(0, 0, 0.0), new THREE.Matrix4().makeTranslation(0, 0, 0.007), new THREE.Matrix4().makeTranslation(0, 0, 0.014)];
    this.lastSec = -1;
  }

  update(now) {
    const ms = now.getMilliseconds();
    const s = now.getSeconds() + ms / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;
    // quartz tick for the second hand
    const sTick = now.getSeconds() - 1 + Math.min(1, ms / 120);
    const angles = [(h / 12) * Math.PI * 2, (m / 60) * Math.PI * 2, (sTick / 60) * Math.PI * 2];
    const meshes = [this.hour, this.minute, this.second];
    for (let k = 0; k < 3; k++) {
      this._rz.makeRotationZ(-angles[k]);
      for (let i = 0; i < this.bases.length; i++) {
        this._m.multiplyMatrices(this.bases[i], this._off[k]).multiply(this._rz);
        meshes[k].setMatrixAt(i, this._m);
      }
      meshes[k].instanceMatrix.needsUpdate = true;
    }
  }
}
