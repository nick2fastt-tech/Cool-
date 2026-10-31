"""Stem mix + master for Night Vibes.

vocals + instrumental -> corrective EQ, de-ess, compression, high-end restore, stereo width
-> vocals balanced to sit level with the beat -> bus glue -> -14 LUFS integrated, <= -1 dBTP.
"""
import sys, json, os, subprocess, tempfile
import numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.signal import welch, firwin2, oaconvolve, butter, sosfiltfilt, resample_poly

SR = 48000
TARGET_LUFS = -14.0
VOCAL_OFFSET = -1.0      # vocal loudness vs beat loudness (LU) where vocals are present
CEIL_DBTP = -1.0


def ff(x, chain):
    """Run a float32 stereo buffer through an ffmpeg audio filter chain (sample-aligned)."""
    with tempfile.TemporaryDirectory() as d:
        a, b = f'{d}/in.wav', f'{d}/out.wav'
        sf.write(a, x, SR, subtype='FLOAT')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a, '-af', chain, '-c:a', 'pcm_f32le', b], check=True)
        y, _ = sf.read(b, dtype='float32')
    n = len(x)
    if len(y) < n: y = np.pad(y, ((0, n - len(y)), (0, 0)))
    return y[:n]


def band_db(f, P, lo, hi):
    return 10 * np.log10(P[(f >= lo) & (f < hi)].mean() + 1e-20)


def fir_eq(x, points, ntaps=8191):
    """Linear-phase EQ from (freq, dB) points, zero-latency (delay compensated)."""
    fr = np.array([0] + [p[0] for p in points] + [SR / 2], np.float64)
    gdb = np.array([points[0][1]] + [p[1] for p in points] + [points[-1][1]], np.float64)
    # interpolate on a dense log grid for smooth transitions
    grid = np.concatenate([[0], np.geomspace(10, SR / 2 - 1, 600), [SR / 2]])
    lg = np.interp(np.log10(np.maximum(grid, 1)), np.log10(np.maximum(fr, 1)), gdb)
    h = firwin2(ntaps, grid / (SR / 2), 10 ** (lg / 20), window=('kaiser', 8))
    y = oaconvolve(x, h[:, None], axes=0)
    d = (ntaps - 1) // 2
    return y[d:d + len(x)].astype(np.float32)


def kw_blocks(x, win=0.4, hop=0.1):
    m = pyln.Meter(SR)
    y = x.astype(np.float64)
    for _, f in m._filters.items():
        y = f.apply_filter(y)
    n, h = int(win * SR), int(hop * SR)
    idx = range(0, max(len(y) - n, 1), h)
    ms = np.array([np.mean(y[i:i + n] ** 2, axis=0).sum() for i in idx])
    return -0.691 + 10 * np.log10(ms + 1e-12)


def widen(x, side_db=1.5, fc=250):
    m, s = (x[:, 0] + x[:, 1]) / 2, (x[:, 0] - x[:, 1]) / 2
    sos = butter(2, fc, 'high', fs=SR, output='sos')
    s2 = s + (10 ** (side_db / 20) - 1) * sosfiltfilt(sos, s)
    return np.stack([m + s2, m - s2], 1).astype(np.float32)


def pseudo_stereo(x, side_db=-10.0, fc=300):
    """Mono-safe width for mono beats: add a decorrelated (velvet-noise) side signal.
    L+R sums back to exactly the original, so nothing is lost on phones / mono speakers."""
    rng = np.random.default_rng(7)
    m, s0 = (x[:, 0] + x[:, 1]) / 2, (x[:, 0] - x[:, 1]) / 2
    L = int(0.025 * SR)
    pos = np.sort(rng.choice(np.arange(int(0.0015 * SR), L), int(0.025 * 1500), replace=False))
    h = np.zeros(L, np.float32)
    h[pos] = rng.choice([-1.0, 1.0], len(pos)) * np.exp(-pos / (0.011 * SR))
    h /= np.sqrt(np.sum(h ** 2))
    side = oaconvolve(m, h)[:len(m)]
    side = sosfiltfilt(butter(2, fc, 'high', fs=SR, output='sos'), side) * 10 ** (side_db / 20)
    return np.stack([m + s0 + side, m - s0 - side], 1).astype(np.float32)


def true_peak_db(x):
    up = resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.abs(up).max() + 1e-12)


def process(W, n, out_dir):
    v, _ = sf.read(f'{W}/stems/{n:02d}_vocals.wav', dtype='float32')
    i, _ = sf.read(f'{W}/stems/{n:02d}_instrumental.wav', dtype='float32')
    f, Pi = welch(i.mean(1), SR, nperseg=8192)
    _, Pv = welch(v.mean(1), SR, nperseg=8192)
    ref_i = band_db(f, Pi, 500, 2000)
    sub, mud, high = band_db(f, Pi, 30, 80) - ref_i, band_db(f, Pi, 200, 500) - ref_i, band_db(f, Pi, 6000, 12000) - ref_i
    c_sub = float(np.clip(31 - sub, -1.0, 1.0))
    c_mud = float(np.clip(6.5 - mud, -3.5, 0.5))
    c_high = float(np.clip(-12.5 - high, -1.0, 4.5))
    # ---- instrumental: corrective EQ (rumble cut, tame boom/mud, open the top)
    ieq = [(18, -24), (28, -3), (45, c_sub), (90, c_sub * 0.6), (160, c_mud * 0.3), (300, c_mud), (500, c_mud * 0.6),
           (900, 0), (2500, 0), (5000, c_high * 0.45), (9000, c_high), (14000, c_high + 0.5), (19000, c_high + 1)]
    I = fir_eq(i, ieq)
    corr = float(np.corrcoef(i[:, 0], i[:, 1])[0, 1])
    wdb = 0.0 if corr < 0.6 else (0.75 if corr < 0.8 else 1.5)
    if corr >= 0.97:
        I = pseudo_stereo(I, -7.0, 300); wdb = 'pseudo-stereo'
    elif wdb > 0:
        I = widen(I, wdb, 250)
    I = ff(I, 'aexciter=amount=3:drive=6:blend=0:freq=6500:ceil=19500,'
              'acompressor=threshold=0.1:ratio=1.8:attack=15:release=180:knee=4:makeup=1')
    # ---- vocals: clean lows, less mud, presence + air, de-ess, level out
    ref_v = band_db(f, Pv, 1000, 4000)
    vm = band_db(f, Pv, 200, 500) - ref_v
    cv_mud = float(np.clip(7.5 - vm, -3.0, 0.0))
    veq = [(40, -30), (70, -12), (95, -1.5), (130, 0), (250, cv_mud * 0.6), (400, cv_mud), (700, cv_mud * 0.3),
           (1200, 0), (2500, 0.8), (4000, 1.8), (6000, 1.2), (9000, 1.8), (13000, 3.0), (19000, 3.0)]
    V = fir_eq(v, veq)
    V = ff(V, 'deesser=i=0.35:m=0.5:f=0.5,'
              'acompressor=threshold=0.08:ratio=3:attack=6:release=90:knee=4:makeup=1,'
              'aexciter=amount=1.2:drive=5:blend=0:freq=7000:ceil=19500')
    # ---- balance: vocals level with the beat where vocals are present
    lv, li = kw_blocks(V), kw_blocks(I)
    act = lv > (np.percentile(lv, 95) - 12)
    dv = 10 * np.log10(np.mean(10 ** (lv[act] / 10)))
    di = 10 * np.log10(np.mean(10 ** (li[act] / 10)))
    gv = 10 ** (float(np.clip(VOCAL_OFFSET - (dv - di), -6.0, 10.0)) / 20)
    V *= gv
    mix = V + I
    mix = ff(mix, 'acompressor=threshold=0.18:ratio=1.5:attack=25:release=250:knee=6:makeup=1')
    # ---- loudness + true-peak limiting (iterate so the limiter can't pull us under target)
    meter = pyln.Meter(SR)
    g = TARGET_LUFS - meter.integrated_loudness(mix)
    for it in range(4):
        y = mix * 10 ** (g / 20)
        y = ff(y, f'aresample={SR*4}:resampler=soxr,alimiter=limit={10 ** ((CEIL_DBTP - 0.3) / 20):.4f}:attack=4:release=80:level=0:latency=1,'
                  f'aresample={SR}:resampler=soxr')
        L = meter.integrated_loudness(y)
        if abs(L - TARGET_LUFS) < 0.05: break
        g += TARGET_LUFS - L
    tp = true_peak_db(y)
    if tp > CEIL_DBTP:
        y *= 10 ** ((CEIL_DBTP - 0.02 - tp) / 20)
    L, tp = meter.integrated_loudness(y), true_peak_db(y)
    os.makedirs(out_dir, exist_ok=True)
    sf.write(f'{out_dir}/{n:02d}.wav', y, SR, subtype='PCM_24')
    # stems at the same gain as the final mix (pre-limiter), so vocals + instrumental ~= master
    sg = 10 ** (g / 20)
    peak = max(np.abs(V * sg).max(), np.abs(I * sg).max())
    ss_ = sg * min(1.0, 0.98 / peak)
    sf.write(f'{W}/stems_final/{n:02d}_vocals.wav', V * ss_, SR, subtype='PCM_24')
    sf.write(f'{W}/stems_final/{n:02d}_instrumental.wav', I * ss_, SR, subtype='PCM_24')
    info = dict(n=n, lufs=round(float(L), 2), true_peak=round(float(tp), 2), vocal_gain_db=round(float(20 * np.log10(gv)), 2),
                orig_v_minus_i=round(float(dv - di), 2), width_db=wdb, inst_corr=round(corr, 2), eq=dict(sub=round(c_sub, 1), mud=round(c_mud, 1), high=round(c_high, 1), vmud=round(cv_mud, 1)))
    print(json.dumps(info), flush=True)
    return info


if __name__ == '__main__':
    W = sys.argv[1]
    os.makedirs(f'{W}/stems_final', exist_ok=True)
    res = []
    for n in [int(a) for a in sys.argv[2:]]:
        res.append(process(W, n, f'{W}/master'))
    if os.path.exists(f'{W}/mixlog.json'):
        old = {r['n']: r for r in json.load(open(f'{W}/mixlog.json'))}
    else:
        old = {}
    for r in res: old[r['n']] = r
    json.dump(sorted(old.values(), key=lambda r: r['n']), open(f'{W}/mixlog.json', 'w'), indent=1)
