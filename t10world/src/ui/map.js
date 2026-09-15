// T10 World - the map overlay. The street network is drawn once into an
// offscreen canvas at world scale; each frame just blits the visible window of
// it, so panning and zooming cost almost nothing.
import { WORLD_RADIUS, SHORE_Z } from '../world/city.js';
import { clampv, TAU } from '../core/math.js';

const BASE_PX_PER_M = 0.42;        // resolution of the pre-rendered sheet

export class MapOverlay {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.visible = false;
    this.zoom = 1;
    this.sheet = null;
    this.build();
  }

  build() {
    const wrap = document.createElement('div');
    wrap.className = 't10-map';
    wrap.style.display = 'none';
    this.wrap = wrap;

    const head = document.createElement('div');
    head.className = 't10-map-head';
    const title = document.createElement('span');
    title.className = 't10-map-title';
    title.textContent = 'MAP';
    head.appendChild(title);
    this.place = document.createElement('span');
    this.place.className = 't10-map-place';
    head.appendChild(this.place);
    const close = document.createElement('button');
    close.className = 't10-chat-close';
    close.textContent = '×';
    close.addEventListener('click', () => this.hide());
    head.appendChild(close);
    wrap.appendChild(head);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 't10-map-canvas';
    wrap.appendChild(this.canvas);

    const foot = document.createElement('div');
    foot.className = 't10-map-foot';
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.className = 't10-map-btn';
      b.textContent = label;
      b.addEventListener('click', fn);
      foot.appendChild(b);
      return b;
    };
    mk('−', () => this.setZoom(this.zoom / 1.5));
    mk('+', () => this.setZoom(this.zoom * 1.5));
    this.legend = document.createElement('span');
    this.legend.className = 't10-map-legend';
    foot.appendChild(this.legend);
    wrap.appendChild(foot);

    this.root.appendChild(wrap);
  }

  /** Render the whole street network once. */
  buildSheet() {
    const world = this.game.world;
    if (!world) return;
    const span = WORLD_RADIUS * 2;
    const size = Math.round(span * BASE_PX_PER_M);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const toPx = (v) => (v + WORLD_RADIUS) * BASE_PX_PER_M;

    ctx.fillStyle = '#0a0e11';
    ctx.fillRect(0, 0, size, size);

    // Ground tint by district, sampled on a coarse grid.
    const STEP = 26;
    for (let x = -WORLD_RADIUS; x < WORLD_RADIUS; x += STEP) {
      for (let z = -WORLD_RADIUS; z < WORLD_RADIUS; z += STEP) {
        const d = world.city.districtAt(x + STEP / 2, z + STEP / 2);
        let col = null;
        if (d === 'park' || d === 'forest') col = '#12241a';
        else if (d === 'beach') col = '#211e17';
        else if (d === 'countryside' || d === 'suburb') col = '#0f1712';
        else if (d === 'industrial') col = '#151310';
        else if (d === 'downtown' || d === 'midrise') col = '#101419';
        else col = '#0d1013';
        ctx.fillStyle = col;
        ctx.fillRect(toPx(x), toPx(z), STEP * BASE_PX_PER_M + 1, STEP * BASE_PX_PER_M + 1);
      }
    }

    // Water.
    ctx.fillStyle = '#0d2330';
    ctx.fillRect(0, toPx(SHORE_Z + 40), size, size - toPx(SHORE_Z + 40));

    // Building footprints, rotated the way they actually stand.
    ctx.fillStyle = 'rgba(122,140,156,0.26)';
    ctx.strokeStyle = 'rgba(150,170,186,0.16)';
    ctx.lineWidth = 0.6;
    for (const lot of world.city.lots) {
      const w = Math.max(1, lot.w * BASE_PX_PER_M);
      const d = Math.max(1, lot.d * BASE_PX_PER_M);
      if (lot.rot) {
        ctx.save();
        ctx.translate(toPx(lot.x), toPx(lot.z));
        ctx.rotate(lot.rot);
        ctx.fillRect(-w / 2, -d / 2, w, d);
        if (w > 3 && d > 3) ctx.strokeRect(-w / 2, -d / 2, w, d);
        ctx.restore();
      } else {
        ctx.fillRect(toPx(lot.x) - w / 2, toPx(lot.z) - d / 2, w, d);
        if (w > 3 && d > 3) ctx.strokeRect(toPx(lot.x) - w / 2, toPx(lot.z) - d / 2, w, d);
      }
    }

    // Roads sit above the footprints and are the brightest thing on the sheet,
    // because a map you read at a glance is a map of its streets.
    const order = ['highway', 'avenue', 'street', 'alley'];
    const colors = { highway: '#78899a', avenue: '#66788a', street: '#52626f', alley: '#3f4b56' };
    for (const kind of order) {
      for (const r of world.city.roads) {
        if (r.type !== kind) continue;
        ctx.strokeStyle = colors[kind];
        ctx.lineWidth = Math.max(1.2, r.width * BASE_PX_PER_M);
        ctx.beginPath();
        ctx.moveTo(toPx(r.ax), toPx(r.az));
        ctx.lineTo(toPx(r.bx), toPx(r.bz));
        ctx.stroke();
      }
    }
    // Centre lines on the big roads.
    for (const r of world.city.roads) {
      if (r.type !== 'highway' && r.type !== 'avenue') continue;
      ctx.strokeStyle = 'rgba(226,202,104,0.45)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(toPx(r.ax), toPx(r.az));
      ctx.lineTo(toPx(r.bx), toPx(r.bz));
      ctx.stroke();
    }

    this.sheet = c;
    this.sheetSize = size;
  }

  setZoom(z) {
    this.zoom = clampv(z, 0.35, 6);
    this.draw();
    return this.zoom;
  }

  show() {
    if (this.game.phase !== 'playing') return false;
    if (!this.sheet) this.buildSheet();
    this.visible = true;
    this.wrap.style.display = 'flex';
    this.draw();
    if (this.game.onMapToggled) this.game.onMapToggled(true);
    return true;
  }

  hide() {
    this.visible = false;
    this.wrap.style.display = 'none';
    if (this.game.onMapToggled) this.game.onMapToggled(false);
    return false;
  }

  toggle() { return this.visible ? this.hide() : this.show(); }

  draw() {
    if (!this.visible || !this.sheet) return;
    const game = this.game;
    const canvas = this.canvas;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(120, Math.round(rect.width));
    const h = Math.max(120, Math.round(rect.height));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d');

    const p = game.player ? game.player.position : { x: 0, z: 0 };
    const scale = BASE_PX_PER_M * this.zoom * 2.4;
    const halfW = w / 2 / scale;
    const halfH = h / 2 / scale;

    ctx.fillStyle = '#080b0e';
    ctx.fillRect(0, 0, w, h);

    // Blit the visible window of the pre-rendered sheet.
    const sx = (p.x - halfW + WORLD_RADIUS) * BASE_PX_PER_M;
    const sy = (p.z - halfH + WORLD_RADIUS) * BASE_PX_PER_M;
    const sw = halfW * 2 * BASE_PX_PER_M;
    const sh = halfH * 2 * BASE_PX_PER_M;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.sheet, sx, sy, sw, sh, 0, 0, w, h);

    const toScreen = (wx, wz) => ({ x: (wx - p.x) * scale + w / 2, y: (wz - p.z) * scale + h / 2 });

    // Labels are drawn through this so two pins in the same doorway don't
    // print over each other, and nothing runs off the edge.
    const taken = [];
    const label = (text, x, y, color) => {
      const tw = ctx.measureText(text).width;
      let lx = x + 6, ly = y + 3.5;
      if (lx + tw > w - 6) lx = x - 6 - tw;
      if (lx < 4) lx = 4;
      ly = clampv(ly, 12, h - 6);
      const box = { x: lx - 2, y: ly - 9, w: tw + 4, h: 12 };
      for (const t of taken) {
        if (box.x < t.x + t.w && box.x + box.w > t.x && box.y < t.y + t.h && box.y + box.h > t.y) {
          // Try one row below before giving up on this label.
          box.y += 13; ly += 13;
          if (ly > h - 6) return false;
        }
      }
      for (const t of taken) {
        if (box.x < t.x + t.w && box.x + box.w > t.x && box.y < t.y + t.h && box.y + box.h > t.y) return false;
      }
      taken.push(box);
      ctx.fillStyle = 'rgba(6,10,9,0.72)';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = color;
      ctx.fillText(text, lx, ly);
      return true;
    };

    // Saved spots first — your own places outrank the city's.
    ctx.font = '600 10px ui-monospace, monospace';
    if (game.t10) {
      for (const mk of game.t10.markers) {
        const s = toScreen(mk.x, mk.z);
        if (s.x < -40 || s.x > w + 40 || s.y < -20 || s.y > h + 20) continue;
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - 5); ctx.lineTo(s.x + 4, s.y + 3);
        ctx.lineTo(s.x - 4, s.y + 3); ctx.closePath(); ctx.fill();
        label(mk.name, s.x, s.y, 'rgba(255,225,150,0.95)');
      }
    }

    // Landmarks.
    for (const lm of game.world.city.landmarks) {
      const s = toScreen(lm.x, lm.z);
      if (s.x < -40 || s.x > w + 40 || s.y < -20 || s.y > h + 20) continue;
      ctx.fillStyle = lm.type === 'park' ? '#4fbf7a' : '#2fd98a';
      ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, TAU); ctx.fill();
      if (this.zoom > 0.8) label(lm.name, s.x, s.y, 'rgba(198,232,216,0.92)');
    }

    // Vehicles and people, so the map shows the city is alive.
    if (game.traffic) {
      ctx.fillStyle = 'rgba(120,180,255,0.75)';
      for (const v of game.traffic.vehicles) {
        const s = toScreen(v.position.x, v.position.z);
        if (s.x < 0 || s.x > w || s.y < 0 || s.y > h) continue;
        ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
      }
    }
    if (game.npcs) {
      ctx.fillStyle = 'rgba(230,230,230,0.5)';
      for (const n of game.npcs.npcs) {
        if (n.indoors) continue;
        const s = toScreen(n.position.x, n.position.z);
        if (s.x < 0 || s.x > w || s.y < 0 || s.y > h) continue;
        ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
      }
    }

    // You: an arrow pointing where you're facing.
    const heading = game.player ? game.player.heading : 0;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-heading + Math.PI);
    ctx.fillStyle = '#2fd98a';
    ctx.strokeStyle = '#08120d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();

    // North indicator.
    ctx.fillStyle = 'rgba(160,180,172,0.7)';
    ctx.font = '600 11px ui-monospace, monospace';
    ctx.fillText('N', w - 18, 18);
    ctx.strokeStyle = 'rgba(160,180,172,0.5)';
    ctx.beginPath(); ctx.moveTo(w - 14, 22); ctx.lineTo(w - 14, 34); ctx.stroke();

    if (game.world) {
      this.place.textContent = game.world.city.describeLocation(p.x, p.z);
    }
    const metres = Math.round(w / scale);
    this.legend.textContent = metres + 'm across  ·  ' + Math.round(p.x) + ', ' + Math.round(p.z);
  }

  update() { if (this.visible) this.draw(); }
}
