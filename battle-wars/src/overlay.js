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
  computer: { name: 'COMPUTER', color: '#8fe6ff' },
  shadow: { name: 'UNKNOWN VOICE', color: '#ff9a40' },
  newark: { name: 'NEWARK', color: '#c79bff' },
  dj: { name: 'DJ', color: '#7fd4ff' },
  boss: { name: 'GAME BOSS', color: '#ff5a5a' },
  skeleton: { name: 'SKELETON', color: '#f2eee0' },
  crowd: { name: 'CROWD', color: '#ffb35a' },
  everyone: { name: 'EVERYONE', color: '#ffe066' },
  citizen: { name: 'CITIZEN', color: '#ffb35a' },
  behemoth: { name: 'BEHEMOTH', color: '#c78bff' },
  guard: { name: 'SECURITY GUARD', color: '#b8d0e8' },
  officer: { name: 'OFFICER', color: '#8fb8ff' },
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

function drawCaption(ctx, W, H, c, t, drop = 0) {
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
  const bx = (W - bw) / 2, by = c.sound ? 26 * s + drop * 84 * s : H - bh - 34 * s;
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
  } else if (c.kind === 'nameTag') {
    // lower-third name card (western style)
    const x0 = 60 * s, y0 = H * 0.66, slide = (1 - smoothstep(0, 0.5, a)) * -80 * s;
    ctx.translate(slide, 0);
    ctx.font = `${Math.round(64 * s)}px ${FONT}`;
    const w = Math.max(ctx.measureText(c.text).width, 260 * s) + 60 * s;
    ctx.fillStyle = 'rgba(30,14,4,0.82)'; roundRect(ctx, x0, y0, w, 118 * s, 10 * s); ctx.fill();
    ctx.fillStyle = '#d8902a'; ctx.fillRect(x0, y0 + 112 * s, w, 6 * s);
    ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#ffd890'; ctx.fillText(c.text, x0 + 30 * s, y0 + 66 * s);
    ctx.font = `600 ${Math.round(24 * s)}px ${UI_FONT}`; ctx.fillStyle = '#f2e2c8'; ctx.fillText(c.sub ?? '', x0 + 32 * s, y0 + 98 * s);
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
  } else if (c.kind === 'lightning') {
    // purple lightning cracking across the sky (top of the frame)
    const n = Math.floor(t * 16);
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < (c.n ?? 4); b++) {
      const h = (k) => { const x = Math.sin((n * 7 + b * 13 + k) * 12.9898) * 43758.5453; return x - Math.floor(x); };
      if (h(1) < (c.chance ?? 0.55)) continue;
      let x = W * (0.05 + 0.9 * h(2)), y = -10 * s;
      ctx.strokeStyle = h(4) < 0.5 ? (c.color ?? '#c070ff') : '#f4e4ff';
      ctx.shadowColor = c.glow ?? '#a040ff'; ctx.shadowBlur = 26 * s;
      ctx.lineWidth = (2.5 + 3 * h(5)) * s;
      ctx.beginPath(); ctx.moveTo(x, y);
      const segs = 6 + Math.floor(h(6) * 6);
      for (let i = 0; i < segs; i++) {
        x += (h(10 + i) - 0.5) * 90 * s; y += (20 + 34 * h(20 + i)) * s * (c.reach ?? 1);
        ctx.lineTo(x, y);
        if (h(30 + i) < 0.25) { ctx.moveTo(x, y); ctx.lineTo(x + (h(40 + i) - 0.5) * 120 * s, y + 50 * s); ctx.moveTo(x, y); }
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
  } else if (c.kind === 'wrist') {
    // Leon's wrist display: zoomed footage of Behemoth's crown + a size chart
    const k = smoothstep(0, 0.35, a) - smoothstep(life - 0.35, life, a);
    const pw = W * 0.62, ph = H * 0.56, px = (W - pw) / 2, py = H * 0.1 + (1 - k) * 30 * s;
    ctx.fillStyle = 'rgba(6,14,34,0.88)'; roundRect(ctx, px, py, pw, ph, 18 * s); ctx.fill();
    ctx.strokeStyle = '#5fd8ff'; ctx.lineWidth = 3 * s; roundRect(ctx, px, py, pw, ph, 18 * s); ctx.stroke();
    ctx.fillStyle = '#8fe8ff'; ctx.font = `800 ${Math.round(20 * s)}px ${UI_FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText('LEON  //  TARGET SCAN: BEHEMOTH', px + 22 * s, py + 26 * s);
    ctx.fillStyle = Math.sin(t * 6) > 0 ? '#ff4a5a' : '#802030'; ctx.beginPath(); ctx.arc(px + pw - 30 * s, py + 26 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
    // footage box
    const fx = px + 22 * s, fy = py + 50 * s, fw = pw * 0.52, fh = ph - 72 * s;
    ctx.save(); ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.clip();
    ctx.fillStyle = '#121a2a'; ctx.fillRect(fx, fy, fw, fh);
    const z = 1 + 1.3 * smoothstep(0.4, 2.4, a);
    ctx.translate(fx + fw / 2, fy + fh * 0.62); ctx.scale(z, z); ctx.translate(0, fh * 0.12 * (z - 1));
    const u = fh / 300;
    ctx.fillStyle = '#6a7486';
    ctx.beginPath(); ctx.moveTo(-130 * u, 120 * u); ctx.quadraticCurveTo(-90 * u, -10 * u, -20 * u, -30 * u); ctx.lineTo(90 * u, -20 * u); ctx.quadraticCurveTo(140 * u, 0, 120 * u, 30 * u); ctx.lineTo(10 * u, 40 * u); ctx.quadraticCurveTo(-40 * u, 60 * u, -60 * u, 140 * u); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7ff0ff'; ctx.beginPath(); ctx.ellipse(55 * u, -8 * u, 9 * u, 5 * u, 0, 0, Math.PI * 2); ctx.fill();
    const gl = 0.5 + 0.5 * Math.sin(a * 5);
    ctx.fillStyle = '#9a8aa0';
    ctx.beginPath(); ctx.moveTo(-40 * u, -28 * u); for (let i = 0; i <= 6; i++) ctx.lineTo((-40 + i * 13) * u, (i % 2 ? -78 : -58) * u); ctx.lineTo(38 * u, -28 * u); ctx.closePath(); ctx.fill();
    ctx.shadowColor = '#c060ff'; ctx.shadowBlur = 20 * s * gl;
    ctx.fillStyle = `rgba(200,110,255,${0.5 + 0.5 * gl})`; ctx.fillRect(-38 * u, -46 * u, 74 * u, 8 * u);
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.strokeStyle = '#ff4a5a'; ctx.lineWidth = 2 * s; const bx = fx + fw / 2 - 45 * s, by = fy + fh * 0.22;
    ctx.strokeRect(bx, by, 90 * s, 70 * s);
    ctx.fillStyle = '#ff8a9a'; ctx.font = `700 ${Math.round(14 * s)}px ${UI_FONT}`; ctx.fillText('CROWN', bx, by - 10 * s);
    // size chart
    const cx0 = px + pw * 0.58, cy0 = py + 60 * s, cw = pw * 0.38, chh = ph - 110 * s;
    ctx.fillStyle = '#8fe8ff'; ctx.font = `700 ${Math.round(16 * s)}px ${UI_FONT}`; ctx.fillText('SIZE', cx0, cy0);
    ctx.strokeStyle = 'rgba(143,232,255,0.4)'; ctx.lineWidth = 1.5 * s; ctx.strokeRect(cx0, cy0 + 14 * s, cw, chh);
    const shown = smoothstep(0.2, 2.6, a);
    ctx.beginPath();
    for (let i = 0; i <= 60 * shown; i++) {
      const xx = cx0 + (i / 60) * cw;
      const lvl = i < 20 ? 0.08 : i < 23 ? 0.08 + (i - 20) * 0.28 : i < 40 ? 0.92 : 0.92;
      const yy = cy0 + 14 * s + chh * (1 - lvl);
      if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.strokeStyle = '#5fd8ff'; ctx.lineWidth = 3 * s; ctx.stroke();
    if (shown > 0.36) { const xx = cx0 + cw * 0.35; ctx.strokeStyle = `rgba(200,110,255,${0.6 + 0.4 * gl})`; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(xx, cy0 + 14 * s); ctx.lineTo(xx, cy0 + 14 * s + chh); ctx.stroke(); ctx.fillStyle = '#d6a8ff'; ctx.fillText('CROWN GLOW', xx + 6 * s, cy0 + 34 * s); }
    ctx.fillStyle = '#8fe8ff'; ctx.font = `600 ${Math.round(14 * s)}px ${UI_FONT}`;
    ctx.fillText('x50 IN 4.2 SEC', cx0 + 4 * s, cy0 + chh + 30 * s);
  } else if (c.kind === 'phone') {
    // the party invitation on Flare's phone
    const k = smoothstep(0, 0.35, a) - smoothstep(life - 0.35, life, a);
    const pw = 300 * s, ph = 540 * s, px = W * 0.74 - pw / 2, py = H * 0.5 - ph / 2 + (1 - k) * 60 * s;
    ctx.fillStyle = '#111118'; roundRect(ctx, px, py, pw, ph, 34 * s); ctx.fill();
    const gr = ctx.createLinearGradient(0, py, 0, py + ph); gr.addColorStop(0, '#2a0a3a'); gr.addColorStop(1, '#5a1a08');
    ctx.fillStyle = gr; roundRect(ctx, px + 12 * s, py + 14 * s, pw - 24 * s, ph - 28 * s, 24 * s); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    c.lines.forEach((ln, i) => {
      const la = smoothstep(c.t0 + 0.3 + (ln.at ?? i * 0.4), c.t0 + 0.6 + (ln.at ?? i * 0.4), t);
      ctx.globalAlpha = alpha * la;
      ctx.font = ln.big ? `${Math.round(40 * s)}px ${FONT}` : `${ln.bold ? 800 : 600} ${Math.round(21 * s)}px ${UI_FONT}`;
      ctx.fillStyle = ln.color ?? '#fff3e0';
      ctx.fillText(ln.text, px + pw / 2, py + (ln.y ?? (0.18 + i * 0.1)) * ph);
    });
    ctx.globalAlpha = alpha;
    ctx.font = `${Math.round(56 * s)}px ${UI_FONT}`; ctx.fillText('🎃', px + pw / 2, py + 0.1 * ph);
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

// security-camera look: grey-green picture, scanlines, noise, REC + camera name + running timestamp
function drawCCTV(ctx, W, H, t, val) {
  const s = H / 720;
  ctx.save();
  ctx.filter = 'grayscale(0.8) contrast(1.2) brightness(1.08)';
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.filter = 'none';
  ctx.fillStyle = 'rgba(70,130,90,0.14)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  for (let y = 0; y < H; y += 4 * s) ctx.fillRect(0, y, W, 1.4 * s);
  const fr = Math.floor(t * 24);
  for (let i = 0; i < 260; i++) {
    const h1 = Math.sin((fr * 131 + i * 17) * 12.9898) * 43758.5453, h2 = Math.sin((fr * 71 + i * 29) * 78.233) * 43758.5453;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.18)';
    ctx.fillRect((h1 - Math.floor(h1)) * W, (h2 - Math.floor(h2)) * H, 2 * s, 2 * s);
  }
  const bandY = ((t * 0.35) % 1) * H;
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, bandY, W, 26 * s);
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // corner brackets
  ctx.strokeStyle = 'rgba(230,255,235,0.8)'; ctx.lineWidth = 3 * s;
  const m = 40 * s, L = 46 * s;
  for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y); ctx.stroke(); }
  ctx.font = `700 ${Math.round(30 * s)}px "DejaVu Sans Mono", monospace`; ctx.textBaseline = 'middle';
  if (Math.sin(t * 5) > -0.2) { ctx.fillStyle = '#ff3030'; ctx.beginPath(); ctx.arc(m + 32 * s, m + 34 * s, 11 * s, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#e8ffe8'; ctx.textAlign = 'left'; ctx.fillText('REC', m + 52 * s, m + 35 * s);
  ctx.textAlign = 'left'; ctx.fillText(val('cctv.cam', 'CAM 07'), m + 20 * s, H - m - 76 * s);
  const sec = Math.floor(val('cctv.base', 6120) + Math.max(0, t - val('cctv.t0', 0)));
  const hh = Math.floor(sec / 3600) % 12 || 12, mm = Math.floor(sec / 60) % 60, ss = sec % 60;
  ctx.textAlign = 'left';
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')} AM`, m + 20 * s, H - m - 34 * s);
  ctx.textAlign = 'right'; ctx.fillText('PLAYBACK  \u25B6', W - m - 20 * s, H - m - 34 * s);
  ctx.restore();
}

export function drawOverlay(ctx, W, H, t, T, val) {
  if (val('cctv', 0) > 0.5) drawCCTV(ctx, W, H, t, val);
  for (const c of T.cards) drawCard(ctx, W, H, c, t);
  for (const c of T.comics) drawComic(ctx, W, H, c, t);
  const fade = val('fade', 0);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(fade)})`; ctx.fillRect(0, 0, W, H); }
  const mem = val('memory', 0);
  if (mem > 0) {
    ctx.save();
    ctx.globalAlpha = mem;
    ctx.fillStyle = 'rgba(140,170,255,0.22)'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(230,235,255,0.85)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const fz = val('freezeTint', 0);
  if (fz > 0) { ctx.fillStyle = `rgba(120,40,200,${0.18 * fz})`; ctx.fillRect(0, 0, W, H); }
  const fw = val('flashWhite', 0);
  if (fw > 0) { ctx.fillStyle = `rgba(255,255,255,${clamp(fw)})`; ctx.fillRect(0, 0, W, H); }
  const fr = val('flashRed', 0);
  if (fr > 0) { ctx.fillStyle = `rgba(255,40,60,${clamp(fr)})`; ctx.fillRect(0, 0, W, H); }
  const fv = val('flashViolet', 0);
  if (fv > 0) { ctx.fillStyle = `rgba(170,80,255,${clamp(fv)})`; ctx.fillRect(0, 0, W, H); }
  const fb = val('flashBlue', 0);
  if (fb > 0) { ctx.fillStyle = `rgba(90,190,255,${clamp(fb)})`; ctx.fillRect(0, 0, W, H); }
  const flash = val('flash', 0);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${clamp(flash)})`; ctx.fillRect(0, 0, W, H); }
  const locCard = T.cards.some((c) => c.kind === 'location' && t >= c.t0 && t <= c.t1) ? 1 : 0;
  for (const c of T.captions) if (t >= c.t0 && t <= c.t1) drawCaption(ctx, W, H, c, t, locCard);
}
