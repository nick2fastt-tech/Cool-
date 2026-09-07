import * as THREE from 'three';

/**
 * Every texture in the game is generated here at runtime.
 *
 * Nothing is loaded from disk: no image files, no third-party art, no download
 * cost, and the whole build stays a couple of hundred kilobytes. It also means
 * every surface is original work, which is a hard requirement for shipping
 * this thing to a store.
 */

const cache = new Map<string, THREE.CanvasTexture>();

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [canvas, ctx];
}

function finish(key: string, canvas: HTMLCanvasElement, repeat = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 2;
  cache.set(key, tex);
  return tex;
}

/** Grubby diamond-tile floor for the dining hall. */
export function tileTexture(repeat = 8): THREE.CanvasTexture {
  const key = `tile:${repeat}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [canvas, ctx] = makeCanvas(128);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const dark = (x + y) % 2 === 0;
      ctx.fillStyle = dark ? '#171a20' : '#2b2f38';
      ctx.fillRect(x * 32, y * 32, 32, 32);
      // Scuffs, so the checker does not read as a clean chessboard.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 0; i < 12; i++) {
        ctx.fillRect(x * 32 + Math.random() * 30, y * 32 + Math.random() * 30, 2, 1);
      }
    }
  }
  return finish(key, canvas, repeat);
}

/** Worn party carpet - the loudest thing in the building. */
export function carpetTexture(repeat = 6): THREE.CanvasTexture {
  const key = `carpet:${repeat}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [canvas, ctx] = makeCanvas(128);
  ctx.fillStyle = '#2a1a22';
  ctx.fillRect(0, 0, 128, 128);
  const confetti = ['#7a2f3a', '#3a4f6a', '#6a5a2a', '#2f5a48'];
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = confetti[(Math.random() * confetti.length) | 0];
    ctx.globalAlpha = 0.25 + Math.random() * 0.35;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 3, 2);
  }
  ctx.globalAlpha = 1;
  return finish(key, canvas, repeat);
}

/** Panelled wall with a dado rail. */
export function wallTexture(repeat = 4): THREE.CanvasTexture {
  const key = `wall:${repeat}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [canvas, ctx] = makeCanvas(128);
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#3a3730');
  grad.addColorStop(0.55, '#2c2a26');
  grad.addColorStop(0.56, '#4a4136');
  grad.addColorStop(1, '#221f1c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  for (let x = 0; x < 128; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 72);
    ctx.lineTo(x, 128);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 200; i++) ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  return finish(key, canvas, repeat);
}

/** Kitchen / restroom tiling. */
export function whiteTileTexture(repeat = 6): THREE.CanvasTexture {
  const key = `wtile:${repeat}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [canvas, ctx] = makeCanvas(128);
  ctx.fillStyle = '#4a4a44';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#5c5c54';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) ctx.fillRect(x * 16 + 1, y * 16 + 1, 14, 14);
  }
  ctx.fillStyle = 'rgba(20,25,15,0.25)';
  for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * 128, Math.random() * 128, 4, 3);
  return finish(key, canvas, repeat);
}

/** The kid-drawing wall in the office. Pure atmosphere, and an easter egg. */
export function posterTexture(kind: 'crew' | 'rules' | 'missing'): THREE.CanvasTexture {
  const key = `poster:${kind}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [canvas, ctx] = makeCanvas(256);
  ctx.fillStyle = kind === 'missing' ? '#c9c2ac' : '#d8cfae';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(90,70,40,0.25)';
  for (let i = 0; i < 300; i++) ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 2);

  if (kind === 'crew') {
    const colors = ['#8a5a2b', '#6f5bd8', '#d9b23a', '#b4402c'];
    colors.forEach((c, i) => {
      const x = 34 + i * 56;
      ctx.fillStyle = c;
      ctx.fillRect(x, 120, 32, 60);
      ctx.beginPath();
      ctx.arc(x + 16, 108, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#101010';
      ctx.fillRect(x + 8, 104, 4, 4);
      ctx.fillRect(x + 20, 104, 4, 4);
    });
    ctx.fillStyle = '#3a2a18';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THE BRAMBLE CREW', 128, 56);
    ctx.font = '16px sans-serif';
    ctx.fillText('Live every night!', 128, 82);
  } else if (kind === 'rules') {
    ctx.fillStyle = '#3a2a18';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOUSE RULES', 128, 48);
    ctx.font = '17px sans-serif';
    ctx.textAlign = 'left';
    ['1. Do not run.', '2. Do not shout.', '3. Do not touch', '    the crew.', '4. Stay in your', '    seat after 12.'].forEach(
      (line, i) => ctx.fillText(line, 30, 92 + i * 26),
    );
  } else {
    ctx.fillStyle = '#2a2318';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OUT OF ORDER', 128, 60);
    ctx.strokeStyle = '#7a1c14';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(40, 90);
    ctx.lineTo(216, 210);
    ctx.moveTo(216, 90);
    ctx.lineTo(40, 210);
    ctx.stroke();
  }
  return finish(key, canvas, 1);
}

/** Shared material factory so meshes reuse programs instead of compiling new ones. */
const materials = new Map<string, THREE.Material>();

export function litMaterial(key: string, options: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial {
  const hit = materials.get(key);
  if (hit) return hit as THREE.MeshLambertMaterial;
  const mat = new THREE.MeshLambertMaterial(options);
  materials.set(key, mat);
  return mat;
}

export function glowMaterial(key: string, color: number, intensity = 1): THREE.MeshBasicMaterial {
  const hit = materials.get(key);
  if (hit) return hit as THREE.MeshBasicMaterial;
  const mat = new THREE.MeshBasicMaterial({ color });
  mat.toneMapped = false;
  mat.color.multiplyScalar(intensity);
  materials.set(key, mat);
  return mat;
}

export function disposeMaterials(): void {
  for (const m of materials.values()) m.dispose();
  materials.clear();
  for (const t of cache.values()) t.dispose();
  cache.clear();
}
