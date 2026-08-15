#!/usr/bin/env python3
"""Convert the three.js ES modules into one classic script exposing window.THREE.

Three.js only ships ESM, and ES modules can't be loaded from a file:// page, which
is how this game is meant to be opened (download the HTML, tap it on your phone).
This rewraps core + module in IIFEs, turning `import`/`export` statements into a
destructure and a return, so the result is a plain script with no fetches.
"""
import re, sys, pathlib

VENDOR = pathlib.Path(__file__).resolve().parent.parent / 'vendor'

def specifiers(block):
    """'a as B, C' -> [(local,exported)] ; handles both import and export lists."""
    out = []
    for part in block.split(','):
        part = part.strip()
        if not part:
            continue
        if ' as ' in part:
            a, b = part.split(' as ')
            out.append((a.strip(), b.strip()))
        else:
            out.append((part, part))
    return out

def cut(src, start, opener='{', closer='}'):
    """Return (stmt_text, end_index) for a statement beginning at `start`."""
    i = src.index(opener, start)
    depth = 0
    while True:
        if src[i] == opener: depth += 1
        elif src[i] == closer:
            depth -= 1
            if depth == 0: break
        i += 1
    end = i + 1
    # an import statement continues through its `from "..."` clause
    m = re.match(r'\s*from\s*("[^"]*"|\'[^\']*\')', src[end:])
    if m: end += m.end()
    return src[start:end], end

def parse_core(src):
    m = re.search(r'\bexport\{', src)
    stmt, end = cut(src, m.start())
    names = specifiers(stmt[stmt.index('{')+1:stmt.rindex('}')])
    body = src[:m.start()] + src[end:]
    ret = ','.join('%s:%s' % (exp, loc) for loc, exp in names)
    return body, ret

def parse_module(src):
    # the single import of ./three.core.min.js
    m = re.search(r'\bimport\{', src)
    imp, imp_end = cut(src, m.start())
    imp_names = specifiers(imp[imp.index('{')+1:imp.rindex('}')])
    destructure = 'var {%s}=__core;' % ','.join(
        ('%s:%s' % (name, loc)) if name != loc else name for name, loc in imp_names)

    body = src[:m.start()] + destructure + src[imp_end:]

    # every export statement becomes part of the returned object. Note three
    # re-exports a chunk of core as `export{...}from"./three.core.min.js"` --
    # those names live on __core, not in this module's scope.
    rets = []
    while True:
        m = re.search(r'\bexport\{', body)
        if not m: break
        stmt, end = cut(body, m.start())
        names = specifiers(stmt[stmt.index('{')+1:stmt.rindex('}')])
        reexport = 'from' in stmt[stmt.rindex('}'):]
        src_prefix = '__core.' if reexport else ''
        rets.append(','.join('%s:%s%s' % (exp, src_prefix, loc) for loc, exp in names))
        body = body[:m.start()] + body[end:]
    return body, rets

def main():
    core_src = (VENDOR / 'three.core.min.js').read_text()
    mod_src  = (VENDOR / 'three.module.min.js').read_text()

    core_body, core_ret = parse_core(core_src)
    mod_body, mod_rets  = parse_module(mod_src)

    out = (
        '/* three.js r180 (MIT) rewrapped as a classic script - see tools/build-three-global.py */\n'
        'var THREE=(function(){"use strict";\n'
        'var __core=(function(){"use strict";\n' + core_body + '\nreturn{' + core_ret + '};})();\n'
        'var __mod=(function(__core){"use strict";\n' + mod_body + '\nreturn Object.assign({},' +
        ','.join('{%s}' % r for r in mod_rets) + ');})(__core);\n'
        'return Object.assign({},__core,__mod);})();\n'
    )
    if '</script' in out:
        sys.exit('refusing to emit: source contains </script')
    dest = VENDOR / 'three.global.js'
    dest.write_text(out)
    print('wrote %s (%d bytes)' % (dest, len(out)))

main()
