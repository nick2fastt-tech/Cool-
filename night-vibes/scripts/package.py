"""Collect deliverables with readable names: videos, mastered WAVs, stems (FLAC), synced lyrics (LRC)."""
import json, os, shutil, subprocess, zipfile, sys

SP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = f'{SP}/work'
D = f'{SP}/deliver'
tracks = json.load(open(f'{W}/tracks.json'))
for sub in ('videos', 'masters', 'stems', 'lyrics'):
    os.makedirs(f'{D}/{sub}', exist_ok=True)


def name(t):
    return f"{t['n']:02d} {t['title']}"


what = sys.argv[1:] or ['videos', 'masters', 'stems', 'lyrics']
for t in tracks:
    n, nm = t['n'], name(t)
    meta = ['-metadata', f"title={t['title']}", '-metadata', 'album=Night Vibes', '-metadata', f"track={n}/13",
            '-metadata', 'comment=Fan-made visualizer']
    lg = f'{W}/render_{n:02d}.log'
    finished = os.path.exists(lg) and '] done ' in open(lg).read()
    if 'videos' in what and finished and os.path.exists(f'{W}/video/{n:02d}.mp4'):
        out = f'{D}/videos/Night Vibes - {nm}.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{W}/video/{n:02d}.mp4', '-c', 'copy', *meta,
                        '-movflags', '+faststart', out], check=True)
    if 'masters' in what and os.path.exists(f'{W}/master/{n:02d}.wav'):
        # 16-bit / 44.1 kHz WAV (standard upload format), soxr resample + triangular dither
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{W}/master/{n:02d}.wav', '-af',
                        'aresample=44100:resampler=soxr:precision=28:dither_method=triangular', '-c:a', 'pcm_s16le',
                        *meta, f'{D}/masters/Night Vibes - {nm}.wav'], check=True)
    if 'stems' in what and os.path.exists(f'{W}/stems_final/{n:02d}_vocals.wav'):
        for k, lab in (('vocals', 'Vocals'), ('instrumental', 'Instrumental')):
            sd = 'Instrumentals' if lab == 'Instrumental' else 'Vocals'; os.makedirs(f'{D}/stems/{sd}', exist_ok=True)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{W}/stems_final/{n:02d}_{k}.wav', '-af',
                            'aresample=44100:resampler=soxr:precision=28:dither_method=triangular', '-c:a', 'flac',
                            '-compression_level', '8', '-sample_fmt', 's16', *meta, f'{D}/stems/{sd}/{nm} - {lab}.flac'], check=True)
    if 'lyrics' in what and os.path.exists(f'{W}/lyrics/{n:02d}.lrc'):
        shutil.copy(f'{W}/lyrics/{n:02d}.lrc', f'{D}/lyrics/{nm}.lrc')


def zipdir(src, out):
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_STORED) as z:
        for f in sorted(os.listdir(src)):
            z.write(f'{src}/{f}', f)


for sub, zname in (('masters', 'Night Vibes - Masters (WAV, -14 LUFS).zip'),
                   ('stems/Instrumentals', 'Night Vibes - Instrumental Stems (FLAC).zip'),
                   ('stems/Vocals', 'Night Vibes - Vocal Stems (FLAC).zip'),
                   ('lyrics', 'Night Vibes - Synced Lyrics (LRC).zip')):
    if sub.startswith('stems') and 'stems' in what and os.path.isdir(f'{D}/{sub}'):
        zipdir(f'{D}/{sub}', f'{D}/{zname}'); continue
    if sub in what and os.listdir(f'{D}/{sub}'):
        zipdir(f'{D}/{sub}', f'{D}/{zname}')
for root, _, files in os.walk(D):
    for f in sorted(files):
        p = os.path.join(root, f)
        print(f'{os.path.getsize(p) / 1e6:8.1f} MB  {os.path.relpath(p, D)}')
