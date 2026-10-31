import sys, json, time, os
from faster_whisper import WhisperModel
import soundfile as sf, numpy as np, scipy.signal as sg
W = sys.argv[1]; model_name = sys.argv[2]; nums = [int(a) for a in sys.argv[3:]]
tracks = {t['n']: t for t in json.load(open(f'{W}/tracks.json'))}
m = WhisperModel(model_name, device='cpu', compute_type='int8', cpu_threads=4)
for n in nums:
    t0 = time.time()
    x, sr = sf.read(f'{W}/stems/{n:02d}_vocals.wav', dtype='float32')
    x16 = sg.resample_poly(x.mean(1), 1, 3).astype(np.float32)
    segs, info = m.transcribe(x16, language='en', beam_size=5, word_timestamps=True,
                              condition_on_previous_text=False, vad_filter=True,
                              vad_parameters=dict(threshold=0.3, min_silence_duration_ms=700, speech_pad_ms=250),
                              initial_prompt=f"Lyrics from the R&B song \"{tracks[n]['title']}\".",
                              no_speech_threshold=0.6, compression_ratio_threshold=2.4)
    out = []
    for s in segs:
        out.append(dict(start=s.start, end=s.end, text=s.text.strip(), avg_logprob=s.avg_logprob, no_speech=s.no_speech_prob,
                        words=[dict(w=w.word, s=w.start, e=w.end, p=w.probability) for w in (s.words or [])]))
    json.dump(out, open(f'{W}/lyrics/{n:02d}.raw.json', 'w'), indent=1)
    print(f'{n:02d} {len(out)} segs in {time.time()-t0:.0f}s', flush=True)
