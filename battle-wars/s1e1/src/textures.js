// Procedural canvas textures (no external image files needed).
import * as THREE from 'three';
import { canvasTex, roundRect, rng } from './util.js';

export const FONT = '"Bangers", "Inter Display", "Inter", sans-serif';
export const UI_FONT = '"Inter Display", "Inter", "DejaVu Sans", sans-serif';

// Team emblem: a winged "B" bolt mark, glowing blue.
export function drawEmblem(ctx, cx, cy, s, glow = '#7fd4ff', core = '#e8f7ff') {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s / 100, s / 100);
  ctx.shadowColor = glow;
  ctx.shadowBlur = 18;
  ctx.fillStyle = glow;
  // left wing
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.moveTo(6, -30);
    ctx.lineTo(48, -42);
    ctx.lineTo(38, -26);
    ctx.lineTo(56, -26);
    ctx.lineTo(40, -10);
    ctx.lineTo(52, -8);
    ctx.lineTo(30, 8);
    ctx.lineTo(10, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // centre bolt
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(4, -44);
  ctx.lineTo(-14, 0);
  ctx.lineTo(0, 0);
  ctx.lineTo(-6, 44);
  ctx.lineTo(16, -8);
  ctx.lineTo(2, -8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function emblemTex() {
  return canvasTex(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawEmblem(ctx, 64, 64, 100);
  });
}

export function logoTex(w = 1024, h = 256, bg = null) {
  return canvasTex(w, h, (ctx) => {
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); } else ctx.clearRect(0, 0, w, h);
    drawEmblem(ctx, h * 0.55, h / 2, h * 0.8);
    ctx.font = `${Math.round(h * 0.62)}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = h * 0.05;
    ctx.strokeStyle = '#0b1440';
    ctx.strokeText('BATTLE WARS', h * 1.1, h * 0.54);
    const g = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.85);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#8fd8ff');
    g.addColorStop(1, '#2f6dff');
    ctx.fillStyle = g;
    ctx.fillText('BATTLE WARS', h * 1.1, h * 0.54);
  });
}

export function stripesTex() {
  return canvasTex(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffcc1a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a1a';
    for (let x = -64; x < w + 64; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 64, h); ctx.lineTo(x + 32, h);
      ctx.fill();
    }
  });
}

export function windowsTex(seed, base, lit = false) {
  const r = rng(seed);
  return canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const cols = 4, rows = 8;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const on = lit && r() < 0.55;
      ctx.fillStyle = on ? (r() < 0.5 ? '#ffd98a' : '#ffe9b8') : (r() < 0.5 ? '#9cc7e6' : '#7fb0d6');
      ctx.fillRect(18 + x * 60, 20 + y * 62, 42, 44);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      if (!on) ctx.fillRect(18 + x * 60, 20 + y * 62, 12, 44);
    }
  });
}

export function signTex(text, bg, fg, w = 512, h = 128, font = FONT) {
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, w, h, h * 0.15);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = `${Math.round(h * 0.62)}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h * 0.55);
  });
}

export function menuTex() {
  return canvasTex(512, 320, (ctx, w, h) => {
    ctx.fillStyle = '#2b2622';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#a07a52';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#ffe6c2';
    ctx.font = `46px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('AETHERFALL COFFEE', w / 2, 62);
    ctx.font = `30px ${UI_FONT}`;
    ctx.textAlign = 'left';
    const items = [['Coffee', '$2'], ['Hot Cocoa', '$2'], ['Muffin', '$3'], ['Bagel', '$2']];
    items.forEach(([a, b], i) => {
      ctx.fillStyle = '#f3d9b1';
      ctx.fillText(a, 50, 120 + i * 46);
      ctx.textAlign = 'right';
      ctx.fillText(b, w - 50, 120 + i * 46);
      ctx.textAlign = 'left';
    });
  });
}

export function floorTex(c1, c2, n = 8) {
  return canvasTex(256, 256, (ctx, w, h) => {
    const s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? c1 : c2;
      ctx.fillRect(x * s, y * s, s, s);
    }
  }, { repeat: [4, 4] });
}

export function planksTex(c1, c2) {
  const r = rng(7);
  return canvasTex(256, 256, (ctx, w, h) => {
    for (let y = 0; y < 8; y++) {
      const off = r() * w;
      for (let x = -1; x < 3; x++) {
        ctx.fillStyle = r() < 0.5 ? c1 : c2;
        ctx.fillRect(off + x * 128, y * 32, 126, 30);
      }
    }
  }, { repeat: [3, 3] });
}

export function roadTex() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#3d4048';
    ctx.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + r() * 0.04})`;
      ctx.fillRect(r() * w, r() * h, 3, 3);
    }
    ctx.fillStyle = '#f2f2f2';
    for (let x = 0; x < w; x += 128) ctx.fillRect(x + 20, h / 2 - 6, 70, 12);
  }, { repeat: [10, 1] });
}

export function sidewalkTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b9b4ab';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#9d988f';
    ctx.lineWidth = 4;
    for (let x = 0; x <= w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }, { repeat: [20, 2] });
}

export function runeTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.strokeStyle = '#bff3ff';
    ctx.shadowColor = '#3fd2ff';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(0, 0, 110, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, 82, 0, Math.PI * 2); ctx.stroke();
    // water drop
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.bezierCurveTo(40, -10, 44, 30, 0, 50);
    ctx.bezierCurveTo(-44, 30, -40, -10, 0, -60);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i / 8) * Math.PI * 2);
      ctx.beginPath(); ctx.moveTo(0, -84); ctx.lineTo(10, -100); ctx.lineTo(-10, -100); ctx.closePath(); ctx.stroke();
      ctx.restore();
    }
  });
}

export function posterTex(title, c1, c2) {
  return canvasTex(256, 360, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    drawEmblem(ctx, w / 2, h * 0.42, 150);
    ctx.fillStyle = '#fff';
    ctx.font = `44px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(title, w / 2, h * 0.85);
  });
}

export function skyTex(top, mid, bottom) {
  const t = canvasTex(16, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  return t;
}

export function pizzaTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d99a45'; ctx.beginPath(); ctx.arc(128, 128, 126, 0, 7); ctx.fill();
    ctx.fillStyle = '#e04a2a'; ctx.beginPath(); ctx.arc(128, 128, 110, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd56a';
    const r = rng(11);
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(128 + (r() - 0.5) * 190, 128 + (r() - 0.5) * 190, 14 + r() * 10, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#b8261b';
    for (let i = 0; i < 12; i++) { const a = r() * 7, d = r() * 80; ctx.beginPath(); ctx.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 13, 0, 7); ctx.fill(); }
  });
}

export function boxTopTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f4ead8'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d63a2a';
    ctx.font = `64px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('PIZZA!', w / 2, h / 2 + 22);
    ctx.strokeStyle = '#d63a2a'; ctx.lineWidth = 6; ctx.strokeRect(16, 16, w - 32, h - 32);
  });
}

export function gradientMap() {
  const data = new Uint8Array([90, 170, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  t.needsUpdate = true;
  return t;
}
