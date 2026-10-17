// 2D layer drawn on top of each 3D frame: captions, comic sound words, title cards, fades.
import { roundRect, clamp, smoothstep, easeOutBack } from './util.js';
import { FONT, UI_FONT, drawEmblem } from './textures.js';

export const SPEAKERS = {
  aaron: { name: 'AARON', color: '#ffd23f' },
  flare: { name: 'FLARE', color: '#ff7a45' },
  eric: { name: 'ERIC', color: '#6dff8a' },
  water: { name: 'WATER GUY', color: '#5ad8ff' },
  barista: { name: 'BARISTA', color: '#e8c9a8' },
  leon: { name: 'LEON', color: '#f2b632' },
  greg: { name: 'GREG', color: '#e6e6ee' },
  soul: { name: 'SOUL STEALER', color: '#ff4a5a' },
};

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawCaption(ctx, W, H, c, t) {
  const s = H / 720;
  const a = Math.min(smoothstep(c.t0, c.t0 + 0.12, t), 1 - smoothstep(c.t1 - 0.12, c.t1, t));
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const fs = Math.round(34 * s);
  ctx.font = c.sound ? `italic 600 ${fs}px ${UI_FONT}` : `700 ${fs}px ${UI_FONT}`;
  const sp = c.who ? SPEAKERS[c.who] : null;
  const label = sp ? (c.label ?? sp.name) + ':  ' : '';
  const text = c.sound ? `[${c.text}]` : c.text;
  const maxW = W * 0.78;
  ctx.font = `800 ${fs}px ${UI_FONT}`;
  const lw = label ? ctx.measureText(label).width : 0;
  ctx.font = c.sound ? `italic 600 ${fs}px ${UI_FONT}` : `700 ${fs}px ${UI_FONT}`;
  const lines = wrap(ctx, text, maxW - lw);
  const lh = fs * 1.3;
  const widths = lines.map((l, i) => ctx.measureText(l).width + (i === 0 ? lw : 0));
  const bw = Math.max(...widths) + 40 * s;
  const bh = lines.length * lh + 22 * s;
  const bx = (W - bw) / 2, by = c.sound ? 26 * s : H - bh - 34 * s;
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  roundRect(ctx, bx, by, bw, bh, 14 * s);
  ctx.fill();
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => {
    let x = (W - widths[i]) / 2;
    const y = by + 11 * s + lh * (i + 0.5);
    if (i === 0 && label) {
      ctx.font = `800 ${fs}px ${UI_FONT}`;
      ctx.fillStyle = sp.color;
      ctx.fillText(label, x, y);
      x += lw;
    }
    ctx.font = c.sound ? `italic 600 ${fs}px ${UI_FONT}` : `700 ${fs}px ${UI_FONT}`;
    ctx.fillStyle = c.sound ? '#cfe8ff' : '#ffffff';
    ctx.fillText(l, x, y);
  });
  ctx.restore();
}

function drawComic(ctx, W, H, c, t) {
  const a = t - c.t0;
  const life = c.t1 - c.t0;
  if (a < 0 || a > life) return;
  const s = H / 720;
  const pop = easeOutBack(clamp(a / 0.22));
  const fade = 1 - smoothstep(life - 0.25, life, a);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate((c.x ?? 0.5) * W, (c.y ?? 0.35) * H);
  ctx.rotate((c.rot ?? -8) * Math.PI / 180);
  ctx.scale(pop * (1 + 0.04 * Math.sin(a * 20)), pop * (1 + 0.04 * Math.sin(a * 20)));
  const fs = (c.size ?? 110) * s;
  ctx.font = `${fs}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = fs * 0.16;
  ctx.strokeStyle = c.stroke ?? '#0b1440';
  ctx.strokeText(c.text, 0, 0);
  const g = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2);
  g.addColorStop(0, c.c1 ?? '#fff6a0');
  g.addColorStop(1, c.c2 ?? '#ffb020');
  ctx.fillStyle = g;
  ctx.fillText(c.text, 0, 0);
  ctx.restore();
}

function drawCard(ctx, W, H, c, t) {
  const s = H / 720;
  const a = t - c.t0, life = c.t1 - c.t0;
  if (a < 0 || a > life) return;
  const alpha = Math.min(smoothstep(0, 0.4, a), 1 - smoothstep(life - 0.4, life, a));
  ctx.save();
  ctx.globalAlpha = alpha;
  if (c.kind === 'location') {
    ctx.font = `${Math.round(40 * s)}px ${FONT}`;
    const w = ctx.measureText(c.text).width + 50 * s;
    ctx.fillStyle = 'rgba(8,16,48,0.75)';
    roundRect(ctx, 36 * s, 36 * s, w, 60 * s, 10 * s); ctx.fill();
    ctx.fillStyle = '#2f8cff'; ctx.fillRect(36 * s, 36 * s, 8 * s, 60 * s);
    ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle';
    ctx.fillText(c.text, 58 * s, 68 * s);
  } else if (c.kind === 'titleSub') {
    ctx.textAlign = 'center';
    ctx.font = `${Math.round(30 * s)}px ${UI_FONT}`;
    ctx.fillStyle = '#bfe3ff';
    ctx.fillText(c.text, W / 2, H * 0.84);
  } else if (c.kind === 'electric') {
    // jagged lightning arcs crackling around the title
    const n = Math.floor(t * 18);
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < 5; b++) {
      const h = (k) => { const x = Math.sin((n * 7 + b * 13 + k) * 12.9898) * 43758.5453; return x - Math.floor(x); };
      if (h(1) < 0.35) continue;
      let x = W * (0.15 + 0.7 * h(2)), y = H * (0.25 + 0.15 * h(3));
      ctx.strokeStyle = h(4) < 0.5 ? '#ff5060' : '#ffe0e4';
      ctx.shadowColor = '#ff2030'; ctx.shadowBlur = 18 * s;
      ctx.lineWidth = (2 + 3 * h(5)) * s;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let i = 0; i < 9; i++) { x += (h(10 + i) - 0.5) * 70 * s; y += (18 + 30 * h(20 + i)) * s; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
  } else if (c.kind === 'credits') {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = c.lines;
    lines.forEach((ln, i) => {
      const la = smoothstep(c.t0 + 0.6 + i * 0.5, c.t0 + 1.2 + i * 0.5, t);
      ctx.globalAlpha = alpha * la;
      ctx.font = ln.big ? `${Math.round(46 * s)}px ${FONT}` : `${ln.bold ? 700 : 500} ${Math.round(28 * s)}px ${UI_FONT}`;
      ctx.fillStyle = ln.color ?? '#e6f3ff';
      ctx.fillText(ln.text, W / 2, H * (ln.y ?? 0.55 + i * 0.07));
    });
  }
  ctx.restore();
}

export function drawOverlay(ctx, W, H, t, T, val) {
  for (const c of T.cards) drawCard(ctx, W, H, c, t);
  for (const c of T.comics) drawComic(ctx, W, H, c, t);
  const fade = val('fade', 0);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(fade)})`; ctx.fillRect(0, 0, W, H); }
  const flash = val('flash', 0);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${clamp(flash)})`; ctx.fillRect(0, 0, W, H); }
  for (const c of T.captions) if (t >= c.t0 && t <= c.t1) drawCaption(ctx, W, H, c, t);
}
