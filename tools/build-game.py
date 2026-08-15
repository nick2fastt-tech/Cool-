#!/usr/bin/env python3
"""Inline three.js and the audio assets into src/ to produce horror-game.html.

The game is meant to be downloaded and opened directly (file://), so it must be
a single self-contained file with no subresources. Audio is embedded as base64
data URIs; that is the bulk of the output size.
"""
import pathlib, sys, subprocess, base64

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC  = ROOT / 'src' / 'horror-game.src.html'
GLOB = ROOT / 'vendor' / 'three.global.js'

ASSETS = {
    '<!--AUDIO_MUSIC-->':  ('assets/music-cold-static.mp3', 'audio/mpeg'),
    '<!--AUDIO_SCARE_A-->':('assets/scare-a.m4a',           'audio/mp4'),
    '<!--AUDIO_SCARE_B-->':('assets/scare-b.m4a',           'audio/mp4'),
}

def main():
    if not GLOB.exists():                  # intermediate isn't checked in
        subprocess.check_call([sys.executable, str(ROOT / 'tools' / 'build-three-global.py')])
    src = SRC.read_text()

    token = '<!--INLINE_THREE-->'
    if token not in src:
        sys.exit('placeholder %s not found' % token)
    three = GLOB.read_text()
    if '</script' in three:
        sys.exit('refusing to inline: three contains </script')
    src = src.replace(token, '<script>\n' + three + '\n</script>')

    for tok, (rel, mime) in ASSETS.items():
        if tok not in src:
            sys.exit('placeholder %s not found' % tok)
        path = ROOT / rel
        if not path.exists():
            sys.exit('missing asset %s' % rel)
        b64 = base64.b64encode(path.read_bytes()).decode('ascii')
        src = src.replace(tok, 'data:%s;base64,%s' % (mime, b64))

    dest = ROOT / 'horror-game.html'
    dest.write_text(src)
    print('wrote %s (%.1f MB)' % (dest, len(src) / 1048576))

main()
