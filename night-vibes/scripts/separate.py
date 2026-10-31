import sys, json, time, torch, numpy as np, soundfile as sf, scipy.signal as ss
from demucs.pretrained import get_model
from demucs.apply import apply_model
torch.set_num_threads(4)
W = sys.argv[1]  # work dir
nums = [int(a) for a in sys.argv[2:]]
bag = get_model('htdemucs_ft')
vi = bag.sources.index('vocals')
sub = [m for m, w in zip(bag.models, bag.weights) if w[vi] == 1 and sum(w) == 1][0]
sub.eval()
print('model sources', sub.sources, 'sr', sub.samplerate, flush=True)
for n in nums:
    t0 = time.time()
    x, sr = sf.read(f'{W}/orig/{n:02d}.wav', dtype='float32')  # 48k stereo
    x44 = ss.resample_poly(x, 147, 160, axis=0).astype(np.float32)
    mix = torch.from_numpy(x44.T.copy())
    ref = mix.mean(0)
    mu, sd = ref.mean(), ref.std()
    with torch.no_grad():
        out = apply_model(sub, ((mix - mu) / sd)[None], shifts=2, split=True, overlap=0.25, progress=False)[0]
    out = out * sd + mu
    voc44 = out[sub.sources.index('vocals')].numpy().T
    voc = ss.resample_poly(voc44, 160, 147, axis=0).astype(np.float32)
    L = len(x)
    if len(voc) < L: voc = np.pad(voc, ((0, L - len(voc)), (0, 0)))
    voc = voc[:L]
    inst = x - voc
    sf.write(f'{W}/stems/{n:02d}_vocals.wav', voc, sr, subtype='FLOAT')
    sf.write(f'{W}/stems/{n:02d}_instrumental.wav', inst, sr, subtype='FLOAT')
    print(f'{n:02d} done in {time.time()-t0:.1f}s (audio {L/sr:.1f}s)', flush=True)
