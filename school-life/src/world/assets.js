// Named textures for the school (boards, signs, banners...). Attached to the TextureLib.
import { ROOMS } from '../config.js';

const TAU = Math.PI * 2;
const HAND = '"Patrick Hand", "Comic Sans MS", cursive';
const TITLE = '"Luckiest Guy", Impact, sans-serif';
const UI = 'Fredoka, "Trebuchet MS", sans-serif';

/** Draw text where "_2" style tokens become subscripts. Returns end x. */
export function chemText(ctx, text, x, y, size, font = HAND) {
  const parts = text.split(/(_\d+)/);
  let cx = x;
  for (const p of parts) {
    if (!p) continue;
    if (p[0] === '_') {
      ctx.font = `${Math.round(size * 0.62)}px ${font}`;
      ctx.fillText(p.slice(1), cx, y + size * 0.18);
      cx += ctx.measureText(p.slice(1)).width;
    } else {
      ctx.font = `${size}px ${font}`;
      ctx.fillText(p, cx, y);
      cx += ctx.measureText(p).width;
    }
  }
  return cx;
}

export function arrow(ctx, x1, y1, x2, y2, w = 6, head = 16) {
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(a - 0.5) * head, y2 - Math.sin(a - 0.5) * head);
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(a + 0.5) * head, y2 - Math.sin(a + 0.5) * head);
  ctx.stroke();
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * TAU - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export function installSchoolTextures(T) {
  const cache = new Map();
  const once = (key, fn) => {
    if (!cache.has(key)) cache.set(key, fn());
    return cache.get(key);
  };

  T.posterTex = (kind) => once('poster:' + kind, () => T.poster(kind));
  T.bulletinTex = (seed) => once('bulletin:' + (seed % 4), () => T.bulletin(seed % 4));
  T.roomPlateTex = (id) => once('plate:' + id, () => T.roomPlate(id, ROOMS[id].name, ROOMS[id].color));
  T.flagSignTex = (id) => once('flag:' + id, () => T.flagSign(id, ROOMS[id].name, ROOMS[id].color));

  T.clockFaceTex = T.clockFace();
  T.windowPlasticTex = T.windowDecal('plastic');
  T.windowBlindsTex = T.windowDecal('blinds');
  T.exitTex = T.exitSign();
  T.constructionSignTex = T.constructionSign();
  T.emblemTex = T.emblem();
  T.directoryTex = directory(T);
  T.welcomeBannerTex = T.banner('WELCOME TO SCHOOL LIFE ACADEMY', 'Learn • Grow • Shine', { w: 2048, h: 228 });
  T.muralTex = T.banner('SCHOOL LIFE ACADEMY', 'Home of the Owls • Est. 2026', { w: 2048, h: 360, bg: '#2d6cdf', fg: '#ffc72c' });
  T.canopySignTex = T.letters('SCHOOL LIFE ACADEMY', { w: 2048, h: 128 });
  T.facadeSignTex = T.letters('SCHOOL LIFE', { w: 2048, h: 256 });
  T.auditoriumWordTex = T.letters('AUDITORIUM', { w: 1024, h: 128, fg: '#ffffff' });
  T.libraryWordTex = T.letters('LIBRARY', { w: 1024, h: 170, fg: '#c0392b', stroke: '#fffdf5' });
  T.stageBannerTex = T.banner('SCHOOL LIFE SHOWCASE', 'Welcome, students!', { w: 1536, h: 192, bg: '#7a1528', fg: '#ffd56a' });
  T.principalPlateTex = T.sign("PRINCIPAL'S OFFICE", 'Please knock', { w: 512, h: 330, bg: '#1b1f3b', fg: '#ffffff', size: 70 });
  T.diplomaTex = T.sign('DIPLOMA', 'Excellence in Education', { w: 512, h: 384, bg: '#fbf6e6', fg: '#1b1f3b', accent: '#b88a1a', size: 80 });
  T.boardTex = (id) => once('board:' + id, () => board(T, id));
  T.busTextTex = T.letters('SCHOOL LIFE ACADEMY', { w: 2048, h: 110, fg: '#1b1f3b', stroke: '#ffc72c' });
}

function directory(T) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 768;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1b1f3b';
  ctx.fillRect(0, 0, 512, 768);
  ctx.fillStyle = '#ffc72c';
  ctx.font = `60px ${TITLE}`;
  ctx.textAlign = 'center';
  ctx.fillText('DIRECTORY', 256, 92);
  const rows = [['101', 'Math', -1], ['102', 'Auditorium', -1], ['103', 'Algebra I', -1], ['104', 'Photosynthesis', 1], ['105', 'English', 1], ['106', 'Library', 1], ['2F', 'Coming soon', 0]];
  rows.forEach(([n, name, dir], i) => {
    const y = 170 + i * 82;
    ctx.fillStyle = n === '2F' ? '#e4572e' : '#2d6cdf';
    ctx.beginPath();
    ctx.moveTo(40, y - 48); ctx.arcTo(128, y - 48, 128, y + 16, 12); ctx.arcTo(128, y + 16, 28, y + 16, 12);
    ctx.arcTo(28, y + 16, 28, y - 48, 12); ctx.arcTo(28, y - 48, 128, y - 48, 12); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = `40px ${TITLE}`;
    ctx.fillText(n, 78, y);
    ctx.textAlign = 'left';
    ctx.font = `600 38px ${UI}`;
    let fs = 38;
    while (ctx.measureText(name).width > 280 && fs > 20) { fs -= 2; ctx.font = `600 ${fs}px ${UI}`; }
    ctx.fillText(name, 146, y - 4);
    ctx.strokeStyle = '#ffc72c';
    const ax = 470, ay = y - 16;
    if (dir === 0) arrow(ctx, ax, ay + 16, ax, ay - 18, 6, 14);
    else arrow(ctx, ax - dir * 18, ay, ax + dir * 18, ay, 6, 14);
  });
  return T.tex(c, { wrap: false });
}

// --------------------------------------------------------------------- boards
const BOARDS = {
  101: {
    kind: 'chalk',
    title: 'Math · Fractions',
    lines: [{ t: '1/2 + 1/4 = 3/4', s: 70 }, { t: '3/5 + 1/5 = 4/5', s: 70 }, { t: '2/3 of 9 = 6', s: 70, c: 1 }, { t: 'Homework: p. 42  #1 - 10', s: 54, c: 2 }],
    draw(ctx, W, H, ink) {
      const pies = [[1060, 300, 2, 1], [1280, 300, 4, 3]];
      ctx.lineWidth = 5;
      for (const [x, y, n, f] of pies) {
        ctx.strokeStyle = ink[0];
        ctx.fillStyle = 'rgba(255,236,150,.35)';
        for (let i = 0; i < f; i++) {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 90, -Math.PI / 2 + (i / n) * TAU, -Math.PI / 2 + ((i + 1) / n) * TAU); ctx.closePath(); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(x, y, 90, 0, TAU); ctx.stroke();
        for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / n) * TAU; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 90, y + Math.sin(a) * 90); ctx.stroke(); }
      }
      ctx.fillStyle = ink[0];
      ctx.font = `56px ${HAND}`;
      ctx.textAlign = 'center';
      ctx.fillText('1/2', 1060, 450);
      ctx.fillText('3/4', 1280, 450);
    },
  },
  103: {
    kind: 'white',
    title: 'Algebra I · Solve for x',
    lines: [{ t: '2x + 3 = 11', s: 74 }, { t: '2x = 8', s: 74 }, { t: 'x = 4', s: 74, c: 1 }, { t: 'Slope: y = mx + b', s: 58, c: 3 }],
    draw(ctx, W, H, ink) {
      const ox = 1200, oy = 330, s = 26;
      ctx.strokeStyle = 'rgba(29,78,216,.25)'; ctx.lineWidth = 2;
      for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(ox + i * s, oy - 6 * s); ctx.lineTo(ox + i * s, oy + 6 * s); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ox - 6 * s, oy + i * s); ctx.lineTo(ox + 6 * s, oy + i * s); ctx.stroke(); }
      ctx.strokeStyle = ink[2]; ctx.lineWidth = 4;
      arrow(ctx, ox - 6.5 * s, oy, ox + 6.5 * s, oy, 4, 12);
      arrow(ctx, ox, oy + 6.5 * s, ox, oy - 6.5 * s, 4, 12);
      ctx.strokeStyle = ink[1]; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(ox - 4 * s, oy + 6 * s); ctx.lineTo(ox + 2.5 * s, oy - 6 * s); ctx.stroke();
      ctx.fillStyle = ink[0]; ctx.font = `44px ${HAND}`; ctx.fillText('y = 2x + 3', ox + 30, oy - 120);
      // check mark next to answer
      ctx.strokeStyle = ink[3]; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(380, 420); ctx.lineTo(405, 445); ctx.lineTo(450, 385); ctx.stroke();
    },
  },
  104: {
    kind: 'chalk',
    title: 'Photosynthesis',
    lines: [],
    draw(ctx, W, H, ink) {
      ctx.fillStyle = ink[0];
      ctx.textAlign = 'left';
      let x = chemText(ctx, '6CO_2 + 6H_2O + light', 90, 230, 74);
      ctx.strokeStyle = ink[1];
      arrow(ctx, x + 24, 208, x + 120, 208, 6, 18);
      ctx.fillStyle = ink[1];
      chemText(ctx, 'C_6H_12O_6 + 6O_2', 90, 330, 74);
      ctx.fillStyle = ink[0];
      ctx.font = `56px ${HAND}`;
      ctx.fillText('Plants make food from sunlight!', 90, 420);
      ctx.fillStyle = ink[3];
      ctx.font = `48px ${HAND}`;
      ctx.fillText('Chlorophyll makes leaves green', 90, 486);
      // sun + leaf sketch
      ctx.strokeStyle = ink[1]; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(1240, 230, 56, 0, TAU); ctx.stroke();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; ctx.beginPath(); ctx.moveTo(1240 + Math.cos(a) * 70, 230 + Math.sin(a) * 70); ctx.lineTo(1240 + Math.cos(a) * 96, 230 + Math.sin(a) * 96); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(170,240,170,.95)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(1300, 410, 120, 50, -0.4, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1200, 455); ctx.lineTo(1400, 365); ctx.stroke();
      ctx.strokeStyle = ink[0];
      arrow(ctx, 1190, 290, 1240, 360, 5, 14);
    },
  },
  105: {
    kind: 'chalk',
    title: 'English · Parts of Speech',
    lines: [{ t: 'The quick brown fox jumps high.', s: 62 }, { t: 'noun · verb · adjective · adverb', s: 56, c: 1 }, { t: 'Today: write a short story!', s: 60, c: 3 }, { t: 'Use 3 adjectives and 2 verbs.', s: 54, c: 2 }],
    draw(ctx, W, H, ink) {
      ctx.strokeStyle = ink[1]; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(250, 222); ctx.lineTo(395, 222); ctx.stroke();
      ctx.strokeStyle = ink[2];
      ctx.beginPath(); ctx.moveTo(530, 222); ctx.lineTo(680, 222); ctx.stroke();
      // open book doodle
      ctx.strokeStyle = ink[0]; ctx.lineWidth = 5;
      const bx = 1260, by = 360;
      ctx.beginPath(); ctx.moveTo(bx, by - 70); ctx.quadraticCurveTo(bx - 80, by - 100, bx - 170, by - 70); ctx.lineTo(bx - 170, by + 80); ctx.quadraticCurveTo(bx - 80, by + 50, bx, by + 80); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by - 70); ctx.quadraticCurveTo(bx + 80, by - 100, bx + 170, by - 70); ctx.lineTo(bx + 170, by + 80); ctx.quadraticCurveTo(bx + 80, by + 50, bx, by + 80); ctx.closePath(); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(bx - 140, by - 30 + i * 32); ctx.lineTo(bx - 30, by - 30 + i * 32); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx + 30, by - 30 + i * 32); ctx.lineTo(bx + 140, by - 30 + i * 32); ctx.stroke();
      }
      ctx.fillStyle = ink[1];
      star(ctx, 1440, 210, 24);
      star(ctx, 1080, 210, 18);
    },
  },
};

function board(T, id) {
  const B = BOARDS[id];
  return T.board(B.kind, B.title, B.lines, { drawing: B.draw });
}
