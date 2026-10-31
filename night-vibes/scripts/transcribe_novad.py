import sys, json, time
import numpy as np, soundfile as sf, scipy.signal as sg
from faster_whisper import WhisperModel
W = sys.argv[1]; nums = [int(a) for a in sys.argv[2:]]
tracks = {t['n']: t for t in json.load(open(f'{W}/tracks.json'))}
m = WhisperModel('large-v3-turbo', device='cpu', compute_type='int8', cpu_threads=4)
for n in nums:
    x, sr = sf.read(f'{W}/stems/{n:02d}_vocals.wav', dtype='float32')
    x16 = sg.resample_poly(x.mean(1), 1, 3).astype(np.float32)
    t0 = time.time()
    segs, info = m.transcribe(x16, language='en', beam_size=5, word_timestamps=True, condition_on_previous_text=False,
                              vad_filter=False, initial_prompt=f'Song lyrics, with punctuation. "{tracks[n]["title"]}."',
                              no_speech_threshold=0.6, compression_ratio_threshold=2.4)
    out = [dict(start=s.start, end=s.end, text=s.text.strip(), avg_logprob=s.avg_logprob, no_speech=s.no_speech_prob,
                words=[dict(w=w.word, s=w.start, e=w.end, p=w.probability) for w in (s.words or [])]) for s in segs]
    json.dump(out, open(f'{W}/lyrics/{n:02d}.raw_novad.json', 'w'), indent=1)
    print(f'{n:02d} novad {len(out)} segs in {time.time()-t0:.0f}s', flush=True)
