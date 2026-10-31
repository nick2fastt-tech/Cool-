# Night Vibes — visualizer + mix pipeline

Fan-made album, 13 tracks, 40:48 total.

| # | Track | Length |
|---|-------|--------|
| 1 | We Can Chill | 2:39 |
| 2 | I Want Love | 2:43 |
| 3 | Outta This World | 3:25 |
| 4 | Home | 3:08 |
| 5 | Excited (Freestyle) | 2:23 |
| 6 | New Start | 2:35 |
| 7 | Night Time (Interlude) | 2:14 |
| 8 | Lights Off | 4:28 |
| 9 | Too Much (Remix) | 3:13 |
| 10 | Free | 3:40 |
| 11 | Don't Wait For Me | 3:06 |
| 12 | She Got Me Like | 2:54 |
| 13 | Night Vibes | 4:18 |

## What the pipeline does

1. **Stems** (`separate.py`): Demucs `htdemucs_ft` vocal model (2 shifts). The instrumental is
   `mix - vocals`, so the two stems always add back up to the original.
2. **Lyrics** (`transcribe.py`, `build_lines.py`): Whisper large-v3-turbo with word timestamps on the
   vocal stem, then cleaned into display lines (`lyrics/*.lrc`). Track 12 uses `transcribe_novad.py` (voice
   detection off), because the default pass skipped its first verse. Auto-transcribed, so some words can be off.
3. **Mix + master** (`mix.py`):
   - Instrumental: adaptive linear-phase EQ (less boom/mud, more top end), harmonic exciter to rebuild the
     top octave the AAC source cut off at ~15.5 kHz, glue compression. Width: mono beats (tracks 3, 4, 6, 7 came
     out with left = right) get a mono-safe decorrelated side signal; stereo beats get a gentle side lift;
     already-wide beats are left alone.
   - Vocals: low cut, mud cut, presence/air, de-esser, compression.
   - Balance: vocals set 1 LU under the beat (K-weighted, measured where vocals are present), so voice and
     beat sit at about the same level on every song.
   - Master: bus glue, then -14 LUFS integrated with a 4x-oversampled limiter, true peak <= -1 dBTP
     (Spotify's loudness target).
4. **Visualizer** (`build_assets.py`, `render.py`): cover upscaled 4x (Real-ESRGAN), figure cut out with
   ISNet, procedural starry sky + nebula extended above the cover. Per song:
   starry sky -> pan down to the title -> glowing Chris (beat-reactive neon bloom + aura) -> back up into the
   sky with royal blue -> purple karaoke lyrics. Long instrumental breaks cut back to the glow; the outro ends on
   the full cover. 1920x1080, 30 fps, H.264 + AAC 320k.

Run order: `separate.py` -> `transcribe.py` -> `build_lines.py` -> `mix.py` -> `build_assets.py` -> `render.py song N`
(`orchestrate.py` chains them). Audio, video, models, and image assets are not in git.
