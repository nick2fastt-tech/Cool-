"""Builds the static layers for the Night Vibes visualizer.

World space = "level A": 2880 px wide. Rows [0, SKY) are a generated starry sky,
rows [SKY, SKY+CH) are the AI-upscaled cover. Level B is the same world at 2/3 scale
(1920 wide) for wide shots.
"""
import numpy as np, cv2, json, os
from PIL import Image
from scipy.ndimage import gaussian_filter1d

OUT = 'assets'
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(20261030)
W, SKY, CH = 2880, 2400, 1608
H = SKY + CH
SX, SY = W / 1376.0, CH / 768.0


def ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def blur(a, s):
    return cv2.GaussianBlur(a, (0, 0), s)


# ---------------- cover ----------------
cov = cv2.cvtColor(np.asarray(Image.open('design/cover_x4.png').convert('RGB')), cv2.COLOR_RGB2BGR)
cov = cv2.resize(cov, (W, CH), interpolation=cv2.INTER_AREA).astype(np.float32)

# ---------------- sky gradient ----------------
top = cov[4:30].mean(0)  # (W,3) BGR colours along the cover's top edge
top = gaussian_filter1d(top, 70, axis=0, mode='nearest')
zen = np.array([20, 7, 5], np.float32)      # BGR deep navy with a hint of violet
mid = np.array([34, 13, 8], np.float32)
t = (np.arange(SKY, dtype=np.float32) / SKY)[:, None, None]
f_mid = ss(0.0, 0.55, t)
f_bot = ss(0.45, 1.0, t) ** 1.3
sky = zen * (1 - f_mid) + mid * f_mid
sky = sky * (1 - f_bot) + top[None] * f_bot

# nebula / milky-way band in royal blue + purple
def fbm(h, w, base, octaves=5):
    acc = np.zeros((h, w), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        n = rng.standard_normal((h, w)).astype(np.float32)
        n = blur(n, max(base / 2 ** o, 0.6)); n /= n.std() + 1e-6
        acc += amp * n; tot += amp; amp *= 0.55
    return acc / tot

lh, lw = SKY // 4, W // 4
yy, xx = np.mgrid[0:SKY, 0:W].astype(np.float32)
# band from upper-left to mid-right
p0, p1 = np.array([-300., 250.]), np.array([W + 300., 1500.])
d = p1 - p0; nrm = np.array([-d[1], d[0]]) / np.linalg.norm(d)
dist = (xx - p0[0]) * nrm[0] + (yy - p0[1]) * nrm[1]
band = np.exp(-(dist ** 2) / (2 * 420.0 ** 2)).astype(np.float32)
band *= (1 - ss(0.72, 1.0, yy / SKY))
n1 = cv2.resize(fbm(lh, lw, 55), (W, SKY), interpolation=cv2.INTER_CUBIC)
n2 = cv2.resize(fbm(lh, lw, 40), (W, SKY), interpolation=cv2.INTER_CUBIC)
n3 = cv2.resize(fbm(lh, lw, 25), (W, SKY), interpolation=cv2.INTER_CUBIC)
neb_b = np.clip(n1 * 0.6 + n3 * 0.4 + 0.3, 0, None) ** 1.6 * band
neb_p = np.clip(n2 * 0.6 - n3 * 0.3 + 0.2, 0, None) ** 1.6 * band
ROYAL = np.array([225, 105, 65], np.float32)   # BGR royal blue
PURP = np.array([226, 43, 138], np.float32)    # BGR blue-violet purple
nebula = neb_b[..., None] * ROYAL * 0.085 + neb_p[..., None] * PURP * 0.095
dust = np.clip(1 - 0.35 * band * np.clip(n3 - 0.6, 0, None), 0.6, 1)  # dark lanes
sky = sky + nebula * dust[..., None]
sky += rng.normal(0, 0.9, sky.shape).astype(np.float32)  # dither vs banding

# ---------------- stars ----------------
SROWS = SKY + 81
layers = np.zeros((4, SROWS, W, 3), np.float32)  # 0 = static, 1..3 twinkle groups
COLS = np.array([[255, 228, 215], [255, 255, 255], [210, 236, 255], [255, 205, 225], [255, 240, 200]], np.float32)
CP = [0.58, 0.15, 0.10, 0.12, 0.05]


def splat(L, x, y, sigma, amp, col, r=None):
    r = r or int(np.ceil(sigma * 3.2)) + 1
    xi, yi = int(np.floor(x)), int(np.floor(y))
    gy, gx = np.mgrid[-r:r + 2, -r:r + 2].astype(np.float32)
    k = np.exp(-((gx - (x - xi)) ** 2 + (gy - (y - yi)) ** 2) / (2 * sigma * sigma)) * amp
    y0, y1, x0, x1 = yi - r, yi + r + 2, xi - r, xi + r + 2
    ky0, kx0 = max(0, -y0), max(0, -x0)
    y0c, x0c, y1c, x1c = max(y0, 0), max(x0, 0), min(y1, L.shape[0]), min(x1, L.shape[1])
    if y1c <= y0c or x1c <= x0c: return
    L[y0c:y1c, x0c:x1c] += k[ky0:ky0 + y1c - y0c, kx0:kx0 + x1c - x0c, None] * col


def spikes(L, x, y, length, amp, col):
    r = int(length)
    xi, yi = int(round(x)), int(round(y))
    t_ = np.arange(-r, r + 1, dtype=np.float32)
    prof = amp * np.exp(-np.abs(t_) / (length * 0.28))
    for dy, dx in ((0, 1), (1, 0)):
        for w_off, w in ((0, 1.0), (-1, 0.35), (1, 0.35)):
            ys = yi + (t_ * dy).astype(int) + (w_off if dx else 0)
            xs = xi + (t_ * dx).astype(int) + (w_off if dy else 0)
            ok = (ys >= 0) & (ys < L.shape[0]) & (xs >= 0) & (xs < L.shape[1])
            L[ys[ok], xs[ok]] += (prof[ok] * w)[:, None] * col


def place(n):
    out = []
    while len(out) < n:
        x = rng.uniform(0, W); y = rng.uniform(0, SROWS)
        bx = np.exp(-((((x - p0[0]) * nrm[0] + (y - p0[1]) * nrm[1]) ** 2) / (2 * 420.0 ** 2)))
        p = (1 - 0.97 * ss(0.68, 1.02, y / SKY)) * (0.55 + 0.9 * bx)
        if rng.uniform() < p / 1.45: out.append((x, y))
    return out


def colour():
    return COLS[rng.choice(len(COLS), p=CP)] / 255.0

for (x, y) in place(2100):  # tiny
    g = 0 if rng.uniform() < 0.55 else rng.integers(1, 4)
    splat(layers[g], x, y, rng.uniform(0.55, 0.85), rng.uniform(70, 190), colour())
for (x, y) in place(320):   # medium
    g = 0 if rng.uniform() < 0.3 else rng.integers(1, 4)
    splat(layers[g], x, y, rng.uniform(0.95, 1.4), rng.uniform(170, 255), colour())
for (x, y) in place(34):    # bright with halo + spikes
    g = rng.integers(1, 4); c = colour()
    splat(layers[g], x, y, rng.uniform(1.5, 2.1), 255, c)
    splat(layers[g], x, y, rng.uniform(5, 9), rng.uniform(28, 45), c, r=30)
    spikes(layers[g], x, y, rng.uniform(16, 42), rng.uniform(90, 150), c)

# ---------------- compose base ----------------
base = np.zeros((H, W, 3), np.float32)
base[:SKY] = sky
base[SKY:] = cov
# feather the seam: blend cover top rows with a continuation of the sky colour
fe = 60
a = ss(0, 1, np.arange(fe, dtype=np.float32) / fe)[:, None, None]
base[SKY:SKY + fe] = cov[:fe] * a + top[None] * (1 - a)
base[:SROWS] += layers[0]
base = np.clip(base, 0, 255).astype(np.uint8)
tw = np.clip(layers[1:], 0, 255).astype(np.uint8)
neb_layer = np.clip(nebula * 0.9, 0, 255).astype(np.uint8)

# ---------------- glow layers on Chris ----------------
mask = np.asarray(Image.open('design/person_mask_isnet.png').convert('L').resize((W, CH), Image.BILINEAR)).astype(np.float32) / 255
covn = cov / 255.0
V = covn.max(2)
hsv = cv2.cvtColor(cov.astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
Hh, Ss = hsv[..., 0], hsv[..., 1] / 255
cool = ss(70, 95, Hh) * (1 - ss(172, 179, Hh))          # cyan..blue..purple..pink
lo = 0.66 - 0.26 * np.maximum(cool, 1 - ss(0.15, 0.35, Ss))  # warm/skin hues need to be much brighter
neon = ss(lo, lo + 0.3, V) * ss(0.25, 0.6, mask)
neon_rgb = cov * neon[..., None]
lum = neon_rgb.max(2)
# diagonal royal-blue -> purple tint for the wide halo
gy, gx = np.mgrid[0:CH, 0:W].astype(np.float32)
u = np.clip((gx / W * 0.6 + gy / CH * 0.4 - 0.15) / 0.7, 0, 1)[..., None]
tint = ROYAL * (1 - u) + PURP * u
crisp = blur(neon_rgb, 2.5) * 0.7
mid = blur(lum, 12)[..., None] * (tint / 255.0) * 1.15 + blur(neon_rgb, 12) * 0.25
wide = blur(lum, 36)[..., None] * (tint / 255.0) * 1.0
bloom = crisp + mid + wide
mb = (mask > 0.45).astype(np.float32)
md = cv2.dilate(mb, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
aura_a = np.clip(blur(md, 30) - blur(mb, 4) * 0.7, 0, 1)
aura = aura_a[..., None] * tint * 0.75 + cov * blur(mb, 3)[..., None] * 0.06

def bbox(a, thr=1.0, pad=8):
    m = a.max(2) > thr if a.ndim == 3 else a > thr
    ys, xs = np.where(m)
    return [max(int(ys.min()) - pad, 0), min(int(ys.max()) + pad, a.shape[0]), max(int(xs.min()) - pad, 0), min(int(xs.max()) + pad, a.shape[1])]

gl = np.clip(bloom, 0, 255)
au = np.clip(aura, 0, 255)
bb = bbox(np.maximum(gl, au))
y0, y1, x0, x1 = bb
np.save(f'{OUT}/glow.npy', gl[y0:y1, x0:x1].astype(np.uint8))
np.save(f'{OUT}/aura.npy', au[y0:y1, x0:x1].astype(np.uint8))
glow_box = [y0 + SKY, y1 + SKY, x0, x1]
print('glow max', gl.max(), 'aura max', au.max())

# ---------------- title glow (padded + feathered so no box edges) ----------------
ty0, ty1, tx0, tx1 = int(30 * SY), int(262 * SY), int(285 * SX), int(1125 * SX)
PAD = 170
wy0, wy1, wx0, wx1 = SKY + ty0 - PAD, SKY + ty1 + PAD, max(tx0 - PAD, 0), min(tx1 + PAD, W)
src = np.zeros((wy1 - wy0, wx1 - wx0, 3), np.float32)
reg = cov[ty0:ty1, tx0:tx1]
Vt = reg.max(2) / 255
fall = (1 - ss(222 * SY - ty0, 252 * SY - ty0, np.arange(ty1 - ty0, dtype=np.float32)))[:, None]
tm = ss(0.33, 0.75, Vt) * fall
oy, ox = SKY + ty0 - wy0, tx0 - wx0
src[oy:oy + ty1 - ty0, ox:ox + tx1 - tx0] = reg * tm[..., None]
tglow = blur(src, 5) * 0.9 + blur(src, 18) * 0.8 + blur(src, 45) * 0.55
hh, ww = tglow.shape[:2]
fy = np.minimum(np.arange(hh), hh - 1 - np.arange(hh)).astype(np.float32)
fxx = np.minimum(np.arange(ww), ww - 1 - np.arange(ww)).astype(np.float32)
win = (np.clip(fy / 140, 0, 1) ** 2)[:, None] * (np.clip(fxx / 140, 0, 1) ** 2)[None, :]
tglow *= win[..., None]
tmask_full = np.zeros((hh, ww), np.float32)
tmask_full[oy:oy + ty1 - ty0, ox:ox + tx1 - tx0] = tm
np.save(f'{OUT}/title_glow.npy', np.clip(tglow, 0, 255).astype(np.uint8))
np.save(f'{OUT}/title_mask.npy', (tmask_full * 255).astype(np.uint8))
title_box = [wy0, wy1, wx0, wx1]

# ---------------- save levels ----------------
np.save(f'{OUT}/base_A.npy', base)
np.save(f'{OUT}/tw_A.npy', tw)
np.save(f'{OUT}/neb_A.npy', neb_layer)
WB, HB = 1920, H * 2 // 3
np.save(f'{OUT}/base_B.npy', cv2.resize(base, (WB, HB), interpolation=cv2.INTER_AREA))
np.save(f'{OUT}/tw_B.npy', np.stack([cv2.resize(l, (WB, SROWS * 2 // 3), interpolation=cv2.INTER_AREA) for l in tw]))
np.save(f'{OUT}/neb_B.npy', cv2.resize(neb_layer, (WB, SKY * 2 // 3), interpolation=cv2.INTER_AREA))
meta = dict(W=W, H=H, SKY=SKY, CH=CH, SROWS=SROWS, SX=SX, SY=SY, glow_box=glow_box, title_box=title_box)
json.dump(meta, open(f'{OUT}/meta.json', 'w'), indent=1)
print(json.dumps(meta))
