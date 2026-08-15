#!/usr/bin/env python3
"""Inline vendor/three.global.js into the game source to produce horror-game.html.

The game is meant to be downloaded and opened directly (file://), so it must be
a single self-contained file with no subresources.
"""
import pathlib, sys, subprocess
ROOT = pathlib.Path(__file__).resolve().parent.parent
glob = ROOT / 'vendor' / 'three.global.js'
if not glob.exists():                      # intermediate isn't checked in; regenerate it
    subprocess.check_call([sys.executable, str(ROOT / 'tools' / 'build-three-global.py')])
src  = (ROOT / 'src' / 'horror-game.src.html').read_text()
three= glob.read_text()
TOKEN = '<!--INLINE_THREE-->'
if TOKEN not in src:
    sys.exit('placeholder %s not found in source' % TOKEN)
if '</script' in three:
    sys.exit('refusing to inline: three contains </script')
out = src.replace(TOKEN, '<script>\n' + three + '\n</script>')
dest = ROOT / 'horror-game.html'
dest.write_text(out)
print('wrote %s (%.1f KB)' % (dest, len(out)/1024))
