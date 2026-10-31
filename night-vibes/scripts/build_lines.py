"""Turn raw Whisper output (segments + word timings) into clean display lines."""
import sys, json, re

BAD = ['thank you for watching', 'thanks for watching', 'subtitles by', 'please subscribe', 'lyrics from the r&b song',
       'amara.org', 'transcribed by', 'www.', '.com']
MAXC = 46


def clean_word(w):
    return w.strip()


KEEP = {'I', "I'm", "I've", "I'll", "I'd", 'God', 'Lord', 'Jesus', 'Chris', 'Brown', 'LA', 'OK', 'Okay'}


COMMON = {'it', 'the', 'and', 'but', 'so', 'now', 'see', 'tonight', 'you', 'we', 'they', 'she', 'he', 'my', 'your', 'a',
          'oh', 'yeah', 'girl', 'baby', 'to', 'in', 'on', 'when', 'then', 'what', 'how', 'why', 'just', 'got', 'that', 'this',
          "it's", "don't", "can't", "ain't", 'let', 'all', 'no', 'yes', 'come', 'take', 'give', 'love'}
LOWER_SEEN = set()


I_FORMS = {'i': 'I', "i'm": "I'm", "i've": "I've", "i'll": "I'll", "i'd": "I'd", "i'ma": "I'ma"}


def fix_case(words):
    out = []
    for i, w in enumerate(words):
        t = w['w']
        core = t.rstrip('.,!?;:')
        if core.lower() in I_FORMS and core != I_FORMS[core.lower()]:
            t = I_FORMS[core.lower()] + t[len(core):]
        prev = out[-1] if out else ''
        base = t.rstrip('.,!?').lower()
        if i > 0 and t[:1].isupper() and t[1:] == t[1:].lower() and t.rstrip('.,!?') not in KEEP \
                and (base in LOWER_SEEN or base in COMMON) and not prev.endswith(('.', '!', '?')):
            t = t[:1].lower() + t[1:]
        out.append(t)
    return out


def norm_text(words):
    t = ' '.join(fix_case(words))
    t = re.sub(r'\s+', ' ', t).strip()
    t = re.sub(r'[.,;:]+$', '', t)
    t = t.replace(' ,', ',')
    if t: t = t[0].upper() + t[1:]
    return t


def compact(words):
    """Fix words that Whisper smeared across instrumental gaps: keep the densest
    cluster where it is and pull stray words in next to it."""
    if len(words) < 2: return words
    groups, cur = [], [words[0]]
    for a, b in zip(words, words[1:]):
        if b['s'] - a['e'] > 1.5 or (a['e'] - a['s']) > 3.0:
            groups.append(cur); cur = [b]
        else:
            cur.append(b)
    groups.append(cur)
    if len(groups) == 1:
        for w in words:
            if w['e'] - w['s'] > 3.0: w['e'] = w['s'] + 3.0
        return words
    best = max(range(len(groups)), key=lambda i: (len(groups[i]), i))
    g = groups[best]
    before = [w for gi in groups[:best] for w in gi]
    after = [w for gi in groups[best + 1:] for w in gi]
    t = g[0]['s']
    for w in reversed(before):
        w['e'] = t; w['s'] = t - 0.3; t = w['s']
    t = g[-1]['e']
    for w in after:
        w['s'] = t; w['e'] = t + 0.3; t = w['e']
    out = before + g + after
    for w in out:
        if w['e'] - w['s'] > 3.0: w['e'] = w['s'] + 3.0
    return out


DANGLE = {'a', 'an', 'the', 'my', 'your', 'his', 'her', 'our', 'their', 'to', 'of', 'in', 'on', 'at', 'for', 'with',
          'and', 'but', 'or', 'so', 'like', 'that', 'this', 'from', 'into', 'i', "i'm", 'you', 'we', 'they', 'is', 'was'}


def split_long(words):
    """Split an over-long phrase where the singer pauses / at punctuation, keeping halves balanced."""
    text = norm_text(words)
    if len(text) <= MAXC or len(words) < 3: return [words]
    best = None
    for i in range(1, len(words)):
        left, right = norm_text(words[:i]), norm_text(words[i:])
        if len(left) < 9 or len(right) < 9: continue
        gap = max(words[i]['s'] - words[i - 1]['e'], 0)
        punct = words[i - 1]['w'][-1:] in ',.;!?'
        cap = words[i]['w'][:1].isupper() and words[i]['w'] not in ('I', "I'm", "I've", "I'll", "I'd")
        balance = abs(len(left) - len(right)) / len(text)
        dangling = words[i - 1]['w'].lower().strip(',') in DANGLE
        score = min(gap, 1.0) * 3 + (0.8 if punct else 0) + (0.5 if cap else 0) - balance * 1.5 - (1.2 if dangling else 0)
        if best is None or score > best[0]: best = (score, i)
    if best is None: return [words]
    i = best[1]
    return split_long(words[:i]) + split_long(words[i:])


def build(raw):
    lines = []
    for s in raw:
        txt = s['text'].strip().lower()
        if not txt or any(b in txt for b in BAD): continue
        if s.get('avg_logprob', 0) < -0.95: continue
        if s.get('no_speech', 0) > 0.6 and s.get('avg_logprob', 0) < -0.7: continue
        ws = [dict(w=clean_word(w['w']), s=float(w['s']), e=float(w['e']), p=float(w.get('p', 1))) for w in s['words'] if clean_word(w['w'])]
        if not ws or sum(w['p'] for w in ws) / len(ws) < 0.45: continue
        # re-join tokens Whisper splits off ("light -skinned", "d &D")
        joined = []
        for w in ws:
            if joined and w['w'][:1] in '-&' and len(w['w']) > 1:
                joined[-1] = dict(w=joined[-1]['w'] + w['w'], s=joined[-1]['s'], e=w['e'], p=min(joined[-1]['p'], w['p']))
            else:
                joined.append(w)
        for w in joined:
            if w['w'].lower().rstrip('.,!?') in ('d&d', 'dnd'): w['w'] = 'DND' + w['w'][3:]
        ws = joined
        ws = compact(ws)
        # split at internal pauses
        chunks, cur = [], [ws[0]]
        for a, b in zip(ws, ws[1:]):
            if b['s'] - a['e'] > 1.2: chunks.append(cur); cur = [b]
            else: cur.append(b)
        chunks.append(cur)
        # glue a stray one-word chunk onto its neighbour when they're close
        merged = []
        for c in chunks:
            if merged and (len(merged[-1]) == 1 or len(c) == 1) and c[0]['s'] - merged[-1][-1]['e'] < 2.5 \
                    and len(norm_text(merged[-1] + c)) <= MAXC:
                merged[-1] = merged[-1] + c
            else:
                merged.append(c)
        chunks = merged
        for c in chunks:
            for part in split_long(c):
                t = norm_text(part)
                if not t or not re.search(r'[A-Za-z]', t): continue
                lines.append(dict(start=part[0]['s'], wend=part[-1]['e'], text=t, words=part))
    lines.sort(key=lambda l: l['start'])
    # drop exact duplicates that overlap in time (hallucinated repeats)
    out = []
    for l in lines:
        if out and l['text'] == out[-1]['text'] and l['start'] < out[-1]['wend'] - 0.2: continue
        out.append(l)
    for i, l in enumerate(out):
        nxt = out[i + 1]['start'] if i + 1 < len(out) else 1e9
        hold = l['wend'] + 1.3
        l['end'] = max(min(hold, nxt - 0.12), l['start'] + 0.5)
        for w in l['words']:
            w['w'] = w['w']
    return out


if __name__ == '__main__':
    W = sys.argv[1]
    for n in [int(a) for a in sys.argv[2:]]:
        raw = json.load(open(f'{W}/lyrics/{n:02d}.raw.json'))
        LOWER_SEEN.clear()
        LOWER_SEEN.update(w['w'].strip().rstrip('.,!?') for sg in raw for w in sg['words'] if w['w'].strip()[:1].islower())
        lines = build(raw)
        # display text uses the cleaned line, karaoke words must match it
        for l in lines:
            cased = fix_case(l['words'])
            l['words'] = [dict(w=c.rstrip('.,;:') if i == len(l['words']) - 1 else c, s=w['s'], e=w['e'])
                          for i, (c, w) in enumerate(zip(cased, l['words']))]
            if l['words']: l['words'][0]['w'] = l['words'][0]['w'][:1].upper() + l['words'][0]['w'][1:]
        json.dump(lines, open(f'{W}/lyrics/{n:02d}.lines.json', 'w'), indent=1)
        with open(f'{W}/lyrics/{n:02d}.lrc', 'w') as f:
            for l in lines:
                m, s = divmod(l['start'], 60)
                f.write(f"[{int(m):02d}:{s:05.2f}]{l['text']}\n")
        print(f'{n:02d}: {len(lines)} lines, first at {lines[0]["start"]:.1f}s' if lines else f'{n:02d}: no lines')
