"""Night Vibes visualizer renderer.

Per song: starry sky -> title -> glowing Chris Brown -> back up into the sky with lyrics.
Usage:
  python render.py song <n>                 render work/video/<n>.mp4
  python render.py preview <n> t1 t2 ...    write PNG stills at those times
"""
import sys, json, math, subprocess, os, time
import numpy as np, cv2, soundfile as sf
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A_DIR = os.path.join(ROOT, 'assets')
WORK = os.path.join(ROOT, 'work')
OW, OH, FPS = 1920, 1080, 30
ROYAL = np.array([225, 105, 65], np.float32)    # BGR royal blue  #4169E1
PURPLE = np.array([226, 43, 138], np.float32)   # BGR purple      #8A2BE2
cv2.setNumThreads(2)


def ss(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def ease(t):  # smootherstep
    t = min(max(t, 0.0), 1.0)
    return t * t * t * (t * (t * 6 - 15) + 10)


# ------------------------------------------------------------------ world
class World:
    def __init__(self):
        m = json.load(open(f'{A_DIR}/meta.json'))
        self.m = m
        self.W, self.H, self.SKY, self.SROWS = m['W'], m['H'], m['SKY'], m['SROWS']
        self.lv = {}
        for L, s in (('A', 1.0), ('B', 2 / 3)):
            d = dict(s=s, base=np.load(f'{A_DIR}/base_{L}.npy'), tw=np.load(f'{A_DIR}/tw_{L}.npy'),
                     neb=np.load(f'{A_DIR}/neb_{L}.npy'))
            gl, au = np.load(f'{A_DIR}/glow.npy'), np.load(f'{A_DIR}/aura.npy')
            tg, tm = np.load(f'{A_DIR}/title_glow.npy'), np.load(f'{A_DIR}/title_mask.npy')
            gb, tb = m['glow_box'], m['title_box']
            if L == 'B':
                def rs(a, box):
                    y0, y1, x0, x1 = [int(round(v * s)) for v in box]
                    return cv2.resize(a, (x1 - x0, y1 - y0), interpolation=cv2.INTER_AREA), [y0, y1, x0, x1]
                gl, gbB = rs(gl, gb); au, _ = rs(au, gb); tg, tbB = rs(tg, tb); tm, _ = rs(tm, tb)
                gb, tb = gbB, tbB
            d.update(glow=gl, aura=au, gbox=gb, tglow=tg, tmask=tm, tbox=tb)
            d['Wl'], d['Hl'] = d['base'].shape[1], d['base'].shape[0]
            d['SR'] = d['tw'].shape[1]
            d['NR'] = d['neb'].shape[0]
            self.lv[L] = d

    @staticmethod
    def _add(dst, src, w):
        if w <= 0.003: return
        cv2.addWeighted(dst, 1.0, src, float(w), 0, dst=dst)

    def render_level(self, L, cam, fx):
        d = self.lv[L]; s = d['s']
        cx, cy, z = cam
        vw, vh = self.W / z * s, self.W * 9 / 16 / z * s
        x0, y0 = cx * s - vw / 2, cy * s - vh / 2
        rx0, ry0 = max(int(math.floor(x0)) - 2, 0), max(int(math.floor(y0)) - 2, 0)
        rx1, ry1 = min(int(math.ceil(x0 + vw)) + 3, d['Wl']), min(int(math.ceil(y0 + vh)) + 3, d['Hl'])
        roi = d['base'][ry0:ry1, rx0:rx1].copy()
        # twinkling stars + breathing nebula (sky rows only)
        if ry0 < d['SR']:
            r1 = min(ry1, d['SR'])
            sub = roi[:r1 - ry0]
            for k in range(3):
                self._add(sub, d['tw'][k, ry0:r1, rx0:rx1], fx['tw'][k])
        if ry0 < d['NR']:
            r1 = min(ry1, d['NR'])
            self._add(roi[:r1 - ry0], d['neb'][ry0:r1, rx0:rx1], fx['neb'])
        # glow on Chris (screen blend so the neon never blows out to white)
        if fx['glow'] > 0.003 or fx['aura'] > 0.003:
            gy0, gy1, gx0, gx1 = d['gbox']
            iy0, iy1, ix0, ix1 = max(gy0, ry0), min(gy1, ry1), max(gx0, rx0), min(gx1, rx1)
            if iy1 > iy0 and ix1 > ix0:
                dst = roi[iy0 - ry0:iy1 - ry0, ix0 - rx0:ix1 - rx0]
                sl = (slice(iy0 - gy0, iy1 - gy0), slice(ix0 - gx0, ix1 - gx0))
                light = cv2.addWeighted(d['glow'][sl], float(fx['glow']), d['aura'][sl], float(fx['aura']), 0, dtype=cv2.CV_32F)
                b = dst.astype(np.float32)
                b += light * (1.0 - b * (1.0 / 255.0))
                np.clip(b, 0, 255, out=b)
                dst[:] = b.astype(np.uint8)
        # title glow + light sweep
        if fx['title'] > 0.003 or fx['sweep'] is not None:
            ty0, ty1, tx0, tx1 = d['tbox']
            iy0, iy1, ix0, ix1 = max(ty0, ry0), min(ty1, ry1), max(tx0, rx0), min(tx1, rx1)
            if iy1 > iy0 and ix1 > ix0:
                dst = roi[iy0 - ry0:iy1 - ry0, ix0 - rx0:ix1 - rx0]
                self._add(dst, d['tglow'][iy0 - ty0:iy1 - ty0, ix0 - tx0:ix1 - tx0], fx['title'])
                if fx['sweep'] is not None:
                    pos, amp = fx['sweep']
                    span = float(tx1 - tx0)
                    ymax = (iy1 - ty0) / span
                    ymin = (iy0 - ty0) / span
                    cx0 = int(max(ix0, tx0 + (pos - 0.16 - 0.45 * ymax) * span))
                    cx1 = int(min(ix1, tx0 + (pos + 0.16 - 0.45 * ymin) * span))
                    if cx1 > cx0:
                        xs = (np.arange(cx0, cx1, dtype=np.float32) - tx0) / span
                        ys = (np.arange(iy0, iy1, dtype=np.float32) - ty0) / span
                        u = xs[None, :] + 0.45 * ys[:, None] - pos
                        band = np.exp(u * u * np.float32(-1 / (2 * 0.045 ** 2)))
                        mk = d['tmask'][iy0 - ty0:iy1 - ty0, cx0 - tx0:cx1 - tx0].astype(np.float32) * np.float32(amp / 255)
                        light = (band * mk)[..., None] * np.array([255, 225, 235], np.float32)
                        sub = dst[:, cx0 - ix0:cx1 - ix0]
                        sub[:] = np.clip(sub.astype(np.float32) + light, 0, 255).astype(np.uint8)
        k = vw / OW
        M = np.array([[k, 0, x0 + 0.5 * k - 0.5 - rx0], [0, k, y0 + 0.5 * k - 0.5 - ry0]], np.float32)
        return cv2.warpAffine(roi, M, (OW, OH), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)

    def render(self, cam, fx):
        a = ss(1.12, 1.30, cam[2])
        if a <= 0.0: return self.render_level('B', cam, fx)
        if a >= 1.0: return self.render_level('A', cam, fx)
        fb, fa = self.render_level('B', cam, fx), self.render_level('A', cam, fx)
        return cv2.addWeighted(fb, 1 - a, fa, a, 0)

    def clamp(self, cx, cy, z):
        vw, vh = self.W / z, self.W * 9 / 16 / z
        cx = min(max(cx, vw / 2), self.W - vw / 2)
        cy = min(max(cy, vh / 2), self.H - vh / 2)
        return (cx, cy, z)


# ------------------------------------------------------------------ camera
class Path:
    """Piecewise camera: list of (t0, t1, fn(t)->(cx,cy,z), kind)."""

    def __init__(self, world, dur, lines):
        self.w = world; self.dur = dur
        S = world.SKY
        SX, SY = world.m['SX'], world.m['SY']
        P = lambda xo, yo, z: world.clamp(xo * SX, S + yo * SY, z)
        self.SKY_TOP = (1440, 880, 1.03)
        self.TITLE0, self.TITLE1 = P(700, 168, 1.34), P(700, 160, 1.42)
        self.CHRIS0, self.CHRIS1 = P(430, 520, 1.56), P(440, 470, 1.67)
        self.COVER = world.clamp(1440, S + world.m['CH'] / 2, world.W / (world.m['CH'] * 16 / 9))
        segs = []
        # intro must land back in the sky right before a lyric line that follows a pause
        target = None
        for i, l in enumerate(lines):
            if l['start'] < 15.5: continue
            prev_end = lines[i - 1].get('wend', lines[i - 1]['end']) if i > 0 else 0.0
            if l['start'] - prev_end >= 0.6:
                target = l['start'] - 0.35; break
        intro_len = 18.0 if target is None else min(target, 24.0)
        intro_len = min(intro_len, max(dur - 12.0, 11.0))
        base = [3.0, 2.8, 2.8, 2.6, 3.8, 3.0]  # sky, pan, title, pan, chris, pan-up
        tot = sum(base)
        if intro_len >= tot:
            extra = intro_len - tot
            durs = [b + a for b, a in zip(base, [extra * 0.25, 0, extra * 0.25, 0, extra * 0.5, 0])]
        else:
            durs = [b * intro_len / tot for b in base]
        t = 0.0
        sky_drift = self.sky_pose
        T = np.cumsum([0] + durs)
        self.intro_end = T[-1]
        self.title_t = (T[1], T[2], T[3])
        self.chris_t = [(T[3], T[5])]
        segs.append((T[0], T[1], lambda t, a=T[0], b=T[1]: self.lerp((1440, 760, 1.03), (1440, 1060, 1.03), (t - a) / (b - a)), 'sky'))
        segs.append(self.pan(T[1], T[2], segs[-1][2](T[1]), self.TITLE0))
        segs.append((T[2], T[3], lambda t, a=T[2], b=T[3]: self.lerp(self.TITLE0, self.TITLE1, (t - a) / (b - a)), 'title'))
        segs.append(self.pan(T[3], T[4], self.TITLE1, self.CHRIS0))
        segs.append((T[4], T[5], lambda t, a=T[4], b=T[5]: self.lerp(self.CHRIS0, self.CHRIS1, (t - a) / (b - a)), 'chris'))
        segs.append(self.pan(T[5], T[6], self.CHRIS1, sky_drift(T[6]), slow_end=True))
        t = T[6]
        # instrumental breaks: visit glowing Chris again
        gaps = []
        we = lambda l: l.get('wend', l['end'])
        cands = [(t, lines[0]['start'] - 0.7)] if lines else []
        cands += [(we(lines[i]) + 0.6, lines[i + 1]['start'] - 0.7) for i in range(len(lines) - 1)]
        for g0, g1 in cands:
            g0 = max(g0, t + 1.0)
            if g1 - g0 >= 13.0 and (not gaps or g0 > gaps[-1][1] + 2):
                gaps.append((g0, g1))
        last_end = (we(lines[-1]) + 1.4) if lines else t
        outro = (max(last_end, t + 1), dur) if dur - max(last_end, t + 1) >= 9.0 else None
        for g0, g1 in gaps:
            segs.append((t, g0, lambda tt: self.sky_pose(tt), 'sky'))
            p = 2.6; h = g1 - g0 - 2 * p
            segs.append(self.pan(g0, g0 + p, self.sky_pose(g0), self.CHRIS0))
            segs.append((g0 + p, g1 - p, lambda tt, a=g0 + p, b=g1 - p: self.lerp(self.CHRIS0, self.CHRIS1, (tt - a) / (b - a)), 'chris'))
            segs.append(self.pan(g1 - p, g1, self.CHRIS1, self.sky_pose(g1), slow_end=True))
            self.chris_t.append((g0, g1))
            t = g1
        if outro:
            o0 = outro[0]
            segs.append((t, o0, lambda tt: self.sky_pose(tt), 'sky'))
            rem = dur - o0
            p1 = 2.8; hold = min(max(rem * 0.35, 3.0), 8.0); p2 = 2.6
            segs.append(self.pan(o0, o0 + p1, self.sky_pose(o0), self.CHRIS0))
            segs.append((o0 + p1, o0 + p1 + hold, lambda tt, a=o0 + p1, b=o0 + p1 + hold: self.lerp(self.CHRIS0, self.CHRIS1, (tt - a) / (b - a)), 'chris'))
            c1 = o0 + p1 + hold
            cov1 = world.clamp(self.COVER[0], self.COVER[1], self.COVER[2] * 1.06)
            segs.append(self.pan(c1, c1 + p2, self.CHRIS1, cov1))
            segs.append((c1 + p2, dur + 1, lambda tt, a=c1 + p2, b=dur: self.lerp(cov1, self.COVER, (tt - a) / max(b - a, 0.1)), 'cover'))
            self.chris_t.append((o0, dur))
        else:
            segs.append((t, dur + 1, lambda tt: self.sky_pose(tt), 'sky'))
        self.segs = segs

    def sky_pose(self, t):
        cx = 1440 + 55 * math.sin(2 * math.pi * t / 61.0)
        cy = 1000 + 70 * math.sin(2 * math.pi * t / 47.0 + 1.0)
        z = 1.05 + 0.012 * math.sin(2 * math.pi * t / 37.0)
        return self.w.clamp(cx, cy, z)

    @staticmethod
    def lerp(p, q, u):
        u = min(max(u, 0.0), 1.0)
        return tuple(a + (b - a) * u for a, b in zip(p, q))

    def pan(self, t0, t1, p, q, slow_end=False):
        def f(t):
            u = (t - t0) / (t1 - t0)
            u = min(max(u, 0.0), 1.0)
            e = ease(u) if not slow_end else ease(u) * 0.6 + (1 - (1 - u) ** 3) * 0.4
            # zoom in log space for even perceived speed
            cx = p[0] + (q[0] - p[0]) * e
            cy = p[1] + (q[1] - p[1]) * e
            z = math.exp(math.log(p[2]) + (math.log(q[2]) - math.log(p[2])) * e)
            return self.w.clamp(cx, cy, z)
        return (t0, t1, f, 'pan')

    def at(self, t):
        for (a, b, f, kind) in self.segs:
            if a <= t < b:
                return f(t), kind
        return self.segs[-1][2](t), self.segs[-1][3]

    def chris_amount(self, t):
        """0..1, how much the 'glowing Chris' moment is active (used to ramp glow)."""
        best = 0.0
        for (a, b) in self.chris_t:
            best = max(best, ss(a - 0.5, a + 2.2, t) * (1 - ss(b - 1.2, b + 0.8, t)))
        return best


# ------------------------------------------------------------------ audio-reactive envelope
def envelope(wav_path, dur):
    x, sr = sf.read(wav_path, dtype='float32')
    m = x.mean(1)
    from scipy.signal import butter, sosfilt
    lo = sosfilt(butter(4, 140, 'low', fs=sr, output='sos'), m)
    n = int(math.ceil(dur * FPS)) + 2
    hop = sr / FPS
    def rms(sig):
        out = np.zeros(n, np.float32)
        for i in range(n):
            a, b = int(i * hop), int((i + 1) * hop)
            seg = sig[a:b]
            out[i] = np.sqrt(np.mean(seg * seg)) if len(seg) else 0
        return out
    el, ef = rms(lo), rms(m)
    el /= np.percentile(el, 97) + 1e-9; ef /= np.percentile(ef, 97) + 1e-9
    # transient (kick) detector
    slow = np.copy(el)
    for i in range(1, n): slow[i] = slow[i - 1] * 0.85 + el[i] * 0.15
    kick = np.clip((el - slow) * 2.2, 0, 1)
    k2 = np.zeros(n, np.float32)
    for i in range(n):
        k2[i] = max(kick[i], (k2[i - 1] * 0.82) if i else 0)
    full = np.copy(ef)
    for i in range(1, n): full[i] = max(ef[i], full[i - 1] * 0.93)
    return np.clip(k2, 0, 1), np.clip(full, 0, 1.2)


# ------------------------------------------------------------------ lyrics
FONT = os.path.join(ROOT, 'fonts', 'Montserrat.ttf')


def lyric_font(size, weight=b'ExtraBold'):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(weight)
    return f


class LyricLine:
    """Pre-rendered lyric line: royal blue -> purple gradient text with neon glow."""

    def __init__(self, text, words, size=82):
        self.text = text
        f = lyric_font(size)
        while f.getlength(text) > 1680 and size > 48:
            size -= 4; f = lyric_font(size)
        pad = 70
        l, t_, r, b = f.getbbox(text)
        tw, th = r - l, b - t_
        Wd, Hd = tw + pad * 2, int(size * 1.5) + pad * 2
        mask = Image.new('L', (Wd, Hd), 0)
        ImageDraw.Draw(mask).text((pad - l, pad + (Hd - 2 * pad - th) // 2 - t_), text, font=f, fill=255)
        a = np.asarray(mask).astype(np.float32) / 255
        xs = np.linspace(0, 1, Wd, dtype=np.float32)[None, :, None]
        c0 = np.array([255, 118, 72], np.float32)    # BGR bright royal blue
        c1 = np.array([255, 64, 168], np.float32)    # BGR bright purple
        grad = c0 * (1 - xs) + c1 * xs
        core = grad * 0.88 + 255 * 0.12
        self.fill = np.clip(core * a[..., None], 0, 255).astype(np.float32)
        self.alpha = a
        g1 = cv2.GaussianBlur(a, (0, 0), 5)
        g2 = cv2.GaussianBlur(a, (0, 0), 18)
        self.glow = np.clip(grad * (g1 * 0.9 + g2 * 0.75)[..., None], 0, 255).astype(np.float32)
        sh = cv2.GaussianBlur(a, (0, 0), 12)
        self.shadow = np.clip(sh * 0.85, 0, 0.8)
        self.w, self.h = Wd, Hd
        # word x-ranges for karaoke highlight
        self.word_x = []
        cur = 0
        for wd in words:
            i = text.find(wd['w'], cur)
            if i < 0: self.word_x = None; break
            x0 = pad + f.getlength(text[:i]); x1 = pad + f.getlength(text[:i + len(wd['w'])])
            self.word_x.append((x0, x1, wd['s'], wd['e']))
            cur = i + len(wd['w'])

    def sung_x(self, t):
        if not self.word_x: return None
        if t <= self.word_x[0][2]: return self.word_x[0][0]
        for (x0, x1, s, e) in self.word_x:
            if t < s: return x0
            if t < e: return x0 + (x1 - x0) * (t - s) / max(e - s, 0.05)
        return self.w


def draw_line(frame, L, cx, cy, op, t, scale=1.0):
    if op <= 0.004: return
    h, w = L.h, L.w
    x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    fx0, fy0 = max(x0, 0), max(y0, 0)
    fx1, fy1 = min(x0 + w, OW), min(y0 + h, OH)
    if fx1 <= fx0 or fy1 <= fy0: return
    sx, sy = fx0 - x0, fy0 - y0
    reg = frame[fy0:fy1, fx0:fx1].astype(np.float32)
    sl = (slice(sy, sy + fy1 - fy0), slice(sx, sx + fx1 - fx0))
    a = L.alpha[sl]
    # karaoke: sung part bright, upcoming part dimmer
    sx_ = L.sung_x(t)
    if sx_ is None:
        lit = np.ones(a.shape[1], np.float32)
    else:
        xs = np.arange(sx, sx + fx1 - fx0, dtype=np.float32)
        lit = 0.6 + 0.4 * np.clip((sx_ - xs) / 30.0 + 0.5, 0, 1)
    reg *= (1 - L.shadow[sl] * op)[..., None]
    reg += L.glow[sl] * (op * (lit - 0.5) / 0.5)[None, :, None]
    fa = (a * op)[..., None]
    reg = reg * (1 - fa) + L.fill[sl] * (op * lit)[None, :, None]
    reg = np.clip(reg, 0, 255)
    frame[fy0:fy1, fx0:fx1] = reg.astype(np.uint8)


class LyricTrack:
    FI, FO = 0.25, 0.22   # fade in / out seconds

    def __init__(self, lines, sub_until=0.0):
        self.lines = lines
        self.sub_until = sub_until     # lines starting before this are drawn as small bottom subtitles
        self.cache = {}
        # never let a line linger into the next one's fade-in
        for i, ln in enumerate(lines):
            if i + 1 < len(lines):
                ln['end'] = max(min(ln['end'], lines[i + 1]['start'] - self.FI), ln['start'] + 0.3)

    def is_sub(self, i):
        return self.lines[i]['start'] < self.sub_until

    def get(self, i):
        if i not in self.cache:
            ln = self.lines[i]
            self.cache[i] = LyricLine(ln['text'], [] if self.is_sub(i) else ln.get('words', []),
                                      size=58 if self.is_sub(i) else 82)
            if len(self.cache) > 6:
                for k in sorted(self.cache)[:-6]:
                    if k != i: del self.cache[k]
        return self.cache[i]

    def _op(self, ln, t):
        s, e = ln['start'], ln['end']
        if t < s - self.FI or t > e + self.FO: return 0.0, 0.0, 0.0
        fin = ss(s - self.FI, s + 0.05, t)
        fout = 1 - ss(e, e + self.FO, t)
        return fin * fout, fin, fout

    def sub_visible(self, t):
        return max([self._op(ln, t)[0] for i, ln in enumerate(self.lines) if self.is_sub(i)] or [0.0])

    def draw(self, frame, t, main_y, sub_y):
        for i, ln in enumerate(self.lines):
            op, fin, fout = self._op(ln, t)
            if op <= 0.004: continue
            if self.is_sub(i):
                draw_line(frame, self.get(i), OW / 2, sub_y + (1 - fin) * 14, op, t)
            else:
                dy = (1 - fin) * 40 - (1 - fout) * 60
                draw_line(frame, self.get(i), OW / 2, main_y + dy, op, t)


# ------------------------------------------------------------------ small text labels
def text_sprite(text, size, weight, color_bgr, spacing=0, glow=True):
    f = lyric_font(size, weight)
    if spacing:
        widths = [f.getlength(ch) for ch in text]
        tw = int(sum(widths) + spacing * (len(text) - 1))
    else:
        tw = int(f.getlength(text))
    pad = 30
    Wd, Hd = tw + 2 * pad, int(size * 1.6) + 2 * pad
    m = Image.new('L', (Wd, Hd), 0); d = ImageDraw.Draw(m)
    if spacing:
        x = pad
        for ch, wch in zip(text, widths):
            d.text((x, pad), ch, font=f, fill=255); x += wch + spacing
    else:
        d.text((pad, pad), text, font=f, fill=255)
    a = np.asarray(m).astype(np.float32) / 255
    col = np.array(color_bgr, np.float32)
    g = cv2.GaussianBlur(a, (0, 0), 6)[..., None] * col * 0.9 if glow else np.zeros(a.shape + (3,), np.float32)
    return dict(a=a, fill=a[..., None] * col, glow=g, w=Wd, h=Hd)


def draw_sprite(frame, sp, cx, cy, op, anchor='c'):
    if op <= 0.004: return
    x0 = int(round(cx - (sp['w'] / 2 if anchor == 'c' else 30)))
    y0 = int(round(cy - sp['h'] / 2))
    fx0, fy0, fx1, fy1 = max(x0, 0), max(y0, 0), min(x0 + sp['w'], OW), min(y0 + sp['h'], OH)
    if fx1 <= fx0 or fy1 <= fy0: return
    sl = (slice(fy0 - y0, fy1 - y0), slice(fx0 - x0, fx1 - x0))
    reg = frame[fy0:fy1, fx0:fx1].astype(np.float32)
    reg += sp['glow'][sl] * op
    fa = sp['a'][sl][..., None] * op
    reg = reg * (1 - fa) + sp['fill'][sl] * op
    frame[fy0:fy1, fx0:fx1] = np.clip(reg, 0, 255).astype(np.uint8)


# ------------------------------------------------------------------ shooting stars
class Meteors:
    def __init__(self, dur, seed):
        r = np.random.default_rng(seed)
        self.ev = []
        t = r.uniform(1.0, 2.0)
        while t < dur:
            x = r.uniform(200, 1500); y = r.uniform(60, 420)
            ang = math.radians(r.uniform(18, 38)) * (1 if r.uniform() < 0.7 else -1)
            ln = r.uniform(260, 520); d = r.uniform(0.6, 1.0)
            self.ev.append((t, d, x, y, ang, ln))
            t += r.uniform(7, 15)

    def draw(self, frame, t, sky_amt):
        if sky_amt < 0.05: return
        for (t0, d, x, y, ang, ln) in self.ev:
            if not (t0 <= t <= t0 + d): continue
            u = (t - t0) / d
            dirx, diry = math.cos(ang), math.sin(abs(ang))
            if ang < 0: dirx = -dirx
            hx, hy = x + dirx * ln * 1.6 * u, y + diry * ln * 1.6 * u
            fade = math.sin(math.pi * u) * sky_amt
            tx, ty = hx - dirx * ln * 0.55, hy - diry * ln * 0.55
            bx0, bx1 = int(max(min(hx, tx) - 24, 0)), int(min(max(hx, tx) + 24, OW))
            by0, by1 = int(max(min(hy, ty) - 24, 0)), int(min(max(hy, ty) + 24, OH))
            if bx1 <= bx0 or by1 <= by0: continue
            layer = np.zeros((by1 - by0, bx1 - bx0, 3), np.uint8)
            n = 14
            for i in range(n):
                a0, a1 = i / n, (i + 1) / n
                p0 = (int(hx - dirx * ln * a0 * 0.55) - bx0, int(hy - diry * ln * a0 * 0.55) - by0)
                p1 = (int(hx - dirx * ln * a1 * 0.55) - bx0, int(hy - diry * ln * a1 * 0.55) - by0)
                c = (1 - a0) ** 1.6 * 255 * fade
                cv2.line(layer, p0, p1, (c, c * 0.92, c * 0.85), 2 if i < 4 else 1, cv2.LINE_AA)
            cv2.circle(layer, (int(hx) - bx0, int(hy) - by0), 3, (255 * fade, 245 * fade, 240 * fade), -1, cv2.LINE_AA)
            glow = cv2.GaussianBlur(layer, (0, 0), 4)
            reg = frame[by0:by1, bx0:bx1]
            cv2.add(reg, layer, dst=reg); cv2.add(reg, glow, dst=reg)


# ------------------------------------------------------------------ song renderer
class Song:
    def __init__(self, n, world=None):
        self.n = n
        self.w = world or World()
        tr = {t['n']: t for t in json.load(open(f'{WORK}/tracks.json'))}[n]
        self.title = tr['title']
        self.audio = f'{WORK}/master/{n:02d}.wav'
        if not os.path.exists(self.audio): self.audio = f'{WORK}/orig/{n:02d}.wav'
        self.dur = sf.info(self.audio).duration
        lp = f'{WORK}/lyrics/{n:02d}.lines.json'
        self.lines = json.load(open(lp)) if os.path.exists(lp) else []
        self.path = Path(self.w, self.dur, self.lines)
        self.kick, self.full = envelope(self.audio, self.dur)
        self.lyr = LyricTrack(self.lines, sub_until=self.path.intro_end - 0.3)
        self.met = Meteors(self.dur, seed=100 + n)
        self.lab_title = text_sprite(f'{n:02d}  ·  {self.title.upper()}', 34, b'SemiBold', (255, 225, 235), spacing=5)
        self.lab_corner = text_sprite(self.title, 26, b'SemiBold', (255, 215, 225), glow=False)
        self.lab_album = text_sprite('NIGHT VIBES  ·  FAN-MADE', 18, b'Medium', (240, 170, 175), spacing=6, glow=False)
        r = np.linspace(0, 1, OH - 640, dtype=np.float32)
        self.band_ramp = (np.clip(r / 0.45, 0, 1) ** 1.5 * 0.62).astype(np.float32)

    def frame(self, i):
        t = i / FPS
        cam, kind = self.path.at(t)
        j = min(i, len(self.kick) - 1)
        kick, full = float(self.kick[j]), float(self.full[j])
        ca = self.path.chris_amount(t)
        tws = []
        for k, (f, ph) in enumerate(((0.31, 0.0), (0.47, 2.1), (0.71, 4.2))):
            tws.append(0.62 + 0.3 * math.sin(2 * math.pi * f * t + ph) + 0.12 * full - 0.05)
        tt0, ttm, tt1 = self.path.title_t
        title_amt = ss(tt0 - 0.4, tt0 + 1.4, t) * (1 - ss(tt1 + 0.3, tt1 + 2.2, t))
        sweep = None
        if ttm - 0.5 <= t <= ttm + 1.7:
            sweep = (-0.25 + 1.6 * (t - ttm + 0.5) / 2.2, 0.9)
        fx = dict(tw=tws, neb=0.25 + 0.55 * full,
                  glow=ca * (0.5 + 0.55 * kick + 0.12 * math.sin(2 * math.pi * 0.5 * t)),
                  aura=ca * (0.45 + 0.55 * kick),
                  title=title_amt * (0.55 + 0.25 * full + 0.2 * math.sin(2 * math.pi * 0.6 * t)), sweep=sweep)
        fr = self.w.render(cam, fx)
        # how much of the view is pure sky (for meteors / lyric placement)
        vh = self.w.W * 9 / 16 / cam[2]
        bottom = cam[1] + vh / 2
        sky_amt = 1 - ss(self.w.SKY - 400, self.w.SKY + 250, bottom)
        self.met.draw(fr, t, sky_amt)
        # track label under the title
        if title_amt > 0.01:
            SX, SY = self.w.m['SX'], self.w.m['SY']
            wx, wy = 700 * SX, self.w.SKY + 288 * SY
            k = OW / (self.w.W / cam[2])
            sx = (wx - (cam[0] - self.w.W / cam[2] / 2)) * k
            sy = (wy - (cam[1] - vh / 2)) * k
            draw_sprite(fr, self.lab_title, sx, sy, title_amt * ss(ttm - 0.6, ttm + 0.5, t))
        # lyrics: big + centred in the sky; lines sung during the intro are small subtitles at the bottom
        band = (1 - sky_amt) * self.lyr.sub_visible(t)
        if band > 0.01:
            y0 = 640
            sub = fr[y0:].astype(np.float32)
            sub *= (1 - band * self.band_ramp)[:, None, None]
            fr[y0:] = sub.astype(np.uint8)
        self.lyr.draw(fr, t, 540, 985)
        # corner label while in the sky after the intro
        ci = ss(self.path.intro_end, self.path.intro_end + 1.5, t) * sky_amt
        if ci > 0.01:
            draw_sprite(fr, self.lab_album, 64, OH - 92, ci * 0.65, anchor='l')
            draw_sprite(fr, self.lab_corner, 64, OH - 62, ci * 0.8, anchor='l')
        # fades
        fade = ss(0.0, 1.3, t) * (1 - ss(self.dur - 1.8, self.dur - 0.05, t))
        if fade < 0.999:
            fr = cv2.convertScaleAbs(fr, alpha=fade)
        return fr

    def render(self, out, crf=19, preset='medium', threads=2):
        nfr = int(math.floor(self.dur * FPS))
        cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{OW}x{OH}', '-r', str(FPS), '-i', '-',
               '-i', self.audio, '-map', '0:v', '-map', '1:a',
               '-c:v', 'libx264', '-preset', preset, '-crf', str(crf), '-pix_fmt', 'yuv420p', '-threads', str(threads),
               '-x264-params', 'aq-mode=3:aq-strength=0.9:deblock=-1,-1', '-profile:v', 'high', '-level', '4.2',
               '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out]
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        t0 = time.time()
        for i in range(nfr):
            p.stdin.write(self.frame(i).tobytes())
            if i % 900 == 0:
                print(f'[{self.n:02d}] frame {i}/{nfr}  {time.time() - t0:.0f}s', flush=True)
        p.stdin.close(); p.wait()
        print(f'[{self.n:02d}] done {out} in {time.time() - t0:.0f}s', flush=True)


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'preview':
        n = int(sys.argv[2]); s = Song(n)
        os.makedirs(f'{ROOT}/preview', exist_ok=True)
        for tt in sys.argv[3:]:
            t = float(tt); fr = s.frame(int(round(t * FPS)))
            cv2.imwrite(f'{ROOT}/preview/{n:02d}_{t:06.2f}.jpg', fr, [cv2.IMWRITE_JPEG_QUALITY, 92])
        print('intro_end', round(s.path.intro_end, 2), 'segments', [(round(a, 1), round(b, 1), k) for a, b, _, k in s.path.segs])
    elif mode == 'clip':
        n, a, b = int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
        s = Song(n); out = f'{ROOT}/preview/clip_{n:02d}.mp4'
        cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{OW}x{OH}', '-r', str(FPS), '-i', '-',
               '-ss', str(a), '-i', s.audio, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
               '-pix_fmt', 'yuv420p', '-threads', '2', '-x264-params', 'aq-mode=3:aq-strength=0.9:deblock=-1,-1',
               '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', out]
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE); t0 = time.time(); tc = 0.0
        for i in range(int(a * FPS), int(b * FPS)):
            t1 = time.time(); fr = s.frame(i); tc += time.time() - t1
            p.stdin.write(fr.tobytes())
        p.stdin.close(); p.wait()
        nf = int((b - a) * FPS)
        print(f'{nf} frames in {time.time() - t0:.1f}s  ({nf / (time.time() - t0):.1f} fps overall, compose {1000 * tc / nf:.1f} ms/frame)')
    elif mode == 'song':
        for n in sys.argv[2:]:
            n = int(n); s = Song(n)
            s.render(f'{WORK}/video/{n:02d}.mp4')
