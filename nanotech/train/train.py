# -*- coding: utf-8 -*-
"""Trains the NanoTech model.

Produces, from the corpus in this folder:
  vocab      the words the model knows
  vectors    d-dimensional semantic vectors (PPMI + randomized SVD, retrofitted
             to the hand-built lexicons so synonyms land on each other)
  intents    a softmax classifier plus per-token log-odds, ensembled at runtime
  ngrams     bigram fluency counts, used to rank candidate phrasings
  emotion    valence/arousal per word, grown from seeds by label propagation
  visual     word -> drawable concept, with vectors for unknown-word routing
"""
import json
import math
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import corpus as C
import knowledge as KB
import linalg

DIM = 48
WINDOW = 5
MIN_COUNT = 2
MAX_VOCAB = 4200
NEG_SHIFT = 1.0          # shifted PPMI: log(p(w,c)/p(w)p(c)) - log(k)
RETRO_ROUNDS = 8
RETRO_WEIGHT = 2.2

TOKEN_RE = re.compile(r"[^a-z0-9]+")


def tokens(text):
    """Must stay byte-for-byte equivalent to nanoTokens() in the JS engine."""
    t = text.lower().replace("’", "'").replace("'", "")
    return [w for w in TOKEN_RE.split(t) if w]


def norm_tok(w):
    return "#num" if w.isdigit() else w


# ---------------------------------------------------------------------------
# 1. gather every scrap of training text
# ---------------------------------------------------------------------------
def build_sentences():
    sents = []

    for e in KB.K:
        sents.append(e["one"])
        sents.extend(e["points"])
        if e["like"]:
            sents.append("it is like " + e["like"])
        if e["wow"]:
            sents.append(e["wow"])
        # tie every alias to the topic's own words
        head = e["names"][0]
        for nm in e["names"]:
            sents.append(nm + " is " + e["one"])
        for rel in e["near"]:
            sents.append(head + " is related to " + rel.replace("_", " "))

    for line in C.CHAT_PROSE.strip().split("\n"):
        line = line.strip()
        if line:
            sents.append(line)

    for name, examples in C.INTENTS.items():
        for ex in examples:
            sents.append(ex)

    # visual words need context, so describe each concept in a few scenes
    frames = [
        "a {w} in the middle of the scene with soft light behind it",
        "the {w} sits in the foreground while the sky glows above",
        "a detailed drawing of a {w} with shadows and highlights",
        "the {w} and the {w} together against distant mountains",
        "close up of a {w}, rich colors, careful shading",
    ]
    for concept, words in C.VISUAL.items():
        base = concept.replace("2", "")
        for w in words:
            for f in frames[:3]:
                sents.append(f.format(w=w))
            sents.append("a " + w + " is a kind of " + base)
    for concept, words in C.STYLES.items():
        for w in words:
            sents.append("drawn in a " + w + " style, " + concept + " look")
    for concept, words in C.MOODS.items():
        for w in words:
            sents.append("the mood is " + w + " and " + concept)
    for concept, words in C.TIMES.items():
        for w in words:
            sents.append("set at " + w + " so the light is " + concept)
    for concept, words in C.WEATHER.items():
        for w in words:
            sents.append("the weather is " + w + ", a " + concept + " scene")
    for w, hexv in C.COLORS.items():
        sents.append("the color " + w + " fills the palette")

    return sents


# ---------------------------------------------------------------------------
# 2. vocabulary
# ---------------------------------------------------------------------------
def build_vocab(sents):
    counts = {}
    for s in sents:
        for w in tokens(s):
            w = norm_tok(w)
            counts[w] = counts.get(w, 0) + 1

    # words the runtime must know even if the corpus barely mentions them
    forced = set()
    for words in C.VISUAL.values():
        for w in words:
            forced.update(tokens(w))
    for group in (C.STYLES, C.MOODS, C.TIMES, C.WEATHER):
        for words in group.values():
            for w in words:
                forced.update(tokens(w))
    forced.update(C.COLORS.keys())
    forced.update(C.EMOTION_SEEDS.keys())
    for e in KB.K:
        for nm in e["names"]:
            forced.update(tokens(nm))

    keep = [w for w, n in counts.items() if n >= MIN_COUNT or w in forced]
    keep.sort(key=lambda w: (-counts.get(w, 0), w))
    keep = keep[:MAX_VOCAB]
    if "#num" not in keep:
        keep.append("#num")
    index = {w: i for i, w in enumerate(keep)}
    return keep, index, counts


# ---------------------------------------------------------------------------
# 3. co-occurrence -> shifted PPMI
# ---------------------------------------------------------------------------
def cooccur(sents, index):
    co = {}
    for s in sents:
        ids = [index[norm_tok(w)] for w in tokens(s) if norm_tok(w) in index]
        n = len(ids)
        for i in range(n):
            a = ids[i]
            for off in range(1, WINDOW + 1):
                j = i + off
                if j >= n:
                    break
                b = ids[j]
                if a == b:
                    continue
                w = 1.0 / off
                co[(a, b)] = co.get((a, b), 0.0) + w
                co[(b, a)] = co.get((b, a), 0.0) + w
    return co


def lexicon_links(index):
    """Groups whose members should sit near each other in vector space."""
    groups = []
    for words in C.VISUAL.values():
        groups.append([w for w in words])
    for group in (C.STYLES, C.MOODS, C.TIMES, C.WEATHER):
        for words in group.values():
            groups.append(list(words))
    for e in KB.K:
        groups.append(list(e["names"]))
    for examples in C.INTENTS.values():
        groups.append(list(examples))

    links = {}
    for g in groups:
        ids = []
        for phrase in g:
            toks = [index[norm_tok(w)] for w in tokens(phrase) if norm_tok(w) in index]
            ids.extend(toks)
        ids = sorted(set(ids))
        if len(ids) < 2 or len(ids) > 40:
            continue
        for a in ids:
            for b in ids:
                if a != b:
                    links.setdefault(a, set()).add(b)
    return links


def ppmi(co, vocab_n, counts, vocab):
    tot = 0.0
    row_sum = [0.0] * vocab_n
    for (a, b), w in co.items():
        tot += w
        row_sum[a] += w
    if tot <= 0:
        return {}
    # context distribution smoothing, which tames the bias toward rare contexts
    ctx = [row_sum[i] ** 0.75 for i in range(vocab_n)]
    ctx_tot = sum(ctx) or 1.0
    rows = {}
    logk = math.log(NEG_SHIFT) if NEG_SHIFT > 1 else 0.0
    for (a, b), w in co.items():
        pa = row_sum[a] / tot
        pb = ctx[b] / ctx_tot
        if pa <= 0 or pb <= 0:
            continue
        v = math.log((w / tot) / (pa * pb)) - logk
        if v > 0:
            rows.setdefault(a, []).append((b, v))
    return rows


def retrofit(vecs, links, vocab_n):
    """Pull lexicon-linked words toward each other without losing the corpus
    signal (Faruqui-style retrofitting)."""
    dim = len(vecs[0])
    orig = [v[:] for v in vecs]
    for _ in range(RETRO_ROUNDS):
        for i in range(vocab_n):
            nb = links.get(i)
            if not nb:
                continue
            k = len(nb)
            acc = [orig[i][t] * 1.0 for t in range(dim)]
            for j in nb:
                vj = vecs[j]
                for t in range(dim):
                    acc[t] += RETRO_WEIGHT * vj[t] / k
            denom = 1.0 + RETRO_WEIGHT
            vi = vecs[i]
            for t in range(dim):
                vi[t] = acc[t] / denom
    return vecs


def unit(v):
    n = math.sqrt(sum(x * x for x in v))
    if n < 1e-9:
        return [0.0] * len(v)
    return [x / n for x in v]


# ---------------------------------------------------------------------------
# 4. intent classifier: softmax over mean vectors + per-token log-odds
# ---------------------------------------------------------------------------
def feats(text, index, vecs, dim):
    """Mean pooling catches the overall topic; max pooling lets a single strong
    word ("bored", "draw") carry the decision on its own."""
    acc = [0.0] * dim
    mx = [0.0] * dim
    n = 0
    for w in tokens(text):
        w = norm_tok(w)
        i = index.get(w)
        if i is None:
            continue
        v = vecs[i]
        for t in range(dim):
            acc[t] += v[t]
            if abs(v[t]) > abs(mx[t]):
                mx[t] = v[t]
        n += 1
    if not n:
        return acc + mx, 0
    return unit(acc) + mx, n


def train_softmax(X, y, n_class, dim, epochs=900, lr=0.7, l2=2.5e-4, seed=11):
    rnd = random.Random(seed)
    W = [[0.0] * (dim + 1) for _ in range(n_class)]
    order = list(range(len(X)))
    for ep in range(epochs):
        rnd.shuffle(order)
        step = lr * (1.0 - ep / float(epochs)) + 0.02
        for idx in order:
            x = X[idx]
            gold = y[idx]
            logits = []
            for c in range(n_class):
                wc = W[c]
                s = wc[dim]
                for t in range(dim):
                    s += wc[t] * x[t]
                logits.append(s)
            m = max(logits)
            exps = [math.exp(l - m) for l in logits]
            z = sum(exps) or 1.0
            for c in range(n_class):
                p = exps[c] / z
                g = p - (1.0 if c == gold else 0.0)
                if abs(g) < 1e-6:
                    continue
                wc = W[c]
                gs = step * g
                for t in range(dim):
                    wc[t] -= gs * x[t] + step * l2 * wc[t]
                wc[dim] -= gs
    return W


def token_logodds(index):
    """Naive-Bayes style discriminative weight for each (token, intent)."""
    names = sorted(C.INTENTS.keys())
    per = {n: {} for n in names}
    total = {n: 0 for n in names}
    glob = {}
    for n in names:
        for ex in C.INTENTS[n]:
            for w in set(tokens(ex)):
                w = norm_tok(w)
                if w not in index:
                    continue
                per[n][w] = per[n].get(w, 0) + 1
                total[n] += 1
                glob[w] = glob.get(w, 0) + 1
    gtot = sum(glob.values()) or 1
    out = {}
    for n in names:
        d = {}
        for w, c in per[n].items():
            p_in = (c + 0.4) / (total[n] + 0.4 * len(glob))
            p_out = (glob[w] + 0.4) / (gtot + 0.4 * len(glob))
            wt = math.log(p_in / p_out)
            if wt > 0.25:
                d[w] = round(wt, 3)
        out[n] = d
    return names, out


# ---------------------------------------------------------------------------
# 5. n-gram fluency model
# ---------------------------------------------------------------------------
def build_ngrams(sents, index):
    uni, bi = {}, {}
    for s in sents:
        ids = ["^"] + [norm_tok(w) for w in tokens(s)] + ["$"]
        for w in ids:
            uni[w] = uni.get(w, 0) + 1
        for i in range(len(ids) - 1):
            k = ids[i] + " " + ids[i + 1]
            bi[k] = bi.get(k, 0) + 1
    bi = {k: v for k, v in bi.items() if v >= 2}
    uni = {k: v for k, v in uni.items() if v >= 2}
    return uni, bi


# ---------------------------------------------------------------------------
# 6. emotion by label propagation over the vector k-NN graph
# ---------------------------------------------------------------------------
def propagate_emotion(vocab, index, vecs, dim, k=12, rounds=6):
    val = [0.0] * len(vocab)
    aro = [0.0] * len(vocab)
    fixed = [False] * len(vocab)
    for w, (v, a) in C.EMOTION_SEEDS.items():
        i = index.get(w)
        if i is not None:
            val[i], aro[i], fixed[i] = v, a, True

    seeds = [i for i in range(len(vocab)) if fixed[i]]
    if not seeds:
        return val, aro
    # only words reasonably close to some seed get a reading at all
    neighbours = {}
    for i in range(len(vocab)):
        vi = vecs[i]
        if not any(vi):
            continue
        best = []
        for j in seeds:
            s = 0.0
            vj = vecs[j]
            for t in range(dim):
                s += vi[t] * vj[t]
            if s > 0.28:
                best.append((s, j))
        best.sort(reverse=True)
        if best:
            neighbours[i] = best[:k]
    for _ in range(rounds):
        nv, na = val[:], aro[:]
        for i, nb in neighbours.items():
            if fixed[i]:
                continue
            wsum = sum(s for s, _ in nb)
            if wsum <= 0:
                continue
            nv[i] = sum(s * val[j] for s, j in nb) / wsum * 0.9
            na[i] = sum(s * aro[j] for s, j in nb) / wsum * 0.9
        val, aro = nv, na
    return val, aro


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def main():
    log = lambda *a: (print(*a), sys.stdout.flush())

    sents = build_sentences()
    log("sentences:", len(sents), "tokens:", sum(len(tokens(s)) for s in sents))

    vocab, index, counts = build_vocab(sents)
    log("vocab:", len(vocab))

    co = cooccur(sents, index)
    log("co-occurrence pairs:", len(co))

    rows = ppmi(co, len(vocab), counts, vocab)
    nnz = sum(len(v) for v in rows.values())
    log("ppmi nnz:", nnz)

    vals, vecs_t = linalg.randomized_eig(rows, len(vocab), DIM, power=2, seed=13)
    log("top eigenvalues:", [round(v, 2) for v in vals[:6]])
    scale = [math.sqrt(abs(v)) for v in vals]
    vecs = [[vecs_t[t][i] * scale[t] for t in range(DIM)] for i in range(len(vocab))]
    vecs = [unit(v) for v in vecs]

    links = lexicon_links(index)
    log("retrofit links:", len(links))
    vecs = retrofit(vecs, links, len(vocab))
    vecs = [unit(v) for v in vecs]

    names, logodds = token_logodds(index)
    FD = DIM * 2
    X, y, texts = [], [], []
    for ci, n in enumerate(names):
        for ex in C.INTENTS[n]:
            fv, cnt = feats(ex, index, vecs, DIM)
            if cnt:
                X.append(fv)
                y.append(ci)
                texts.append(ex)
    W = train_softmax(X, y, len(names), FD)

    def score_all(x, text):
        out = []
        toks = set(norm_tok(t) for t in tokens(text))
        for c, n in enumerate(names):
            s = W[c][FD] + sum(W[c][t] * x[t] for t in range(FD))
            lo = logodds[n]
            s += 1.35 * sum(lo.get(t, 0.0) for t in toks)
            out.append(s)
        return out

    raw = ens = 0
    for i, x in enumerate(X):
        sc = [W[c][FD] + sum(W[c][t] * x[t] for t in range(FD)) for c in range(len(names))]
        if max(range(len(names)), key=lambda c: sc[c]) == y[i]:
            raw += 1
        sc2 = score_all(x, texts[i])
        if max(range(len(names)), key=lambda c: sc2[c]) == y[i]:
            ens += 1
    log("intent accuracy: softmax %.1f%%, ensemble %.1f%% (%d/%d)"
        % (100.0 * raw / len(X), 100.0 * ens / len(X), ens, len(X)))

    uni, bi = build_ngrams(sents, index)
    log("ngrams: %d unigrams, %d bigrams" % (len(uni), len(bi)))

    val, aro = propagate_emotion(vocab, index, vecs, DIM)
    scored = sum(1 for i in range(len(vocab)) if abs(val[i]) > 0.08 or abs(aro[i]) > 0.08)
    log("emotion-scored words:", scored)

    # word -> visual concept, plus a centroid per concept for unknown routing
    word2concept = {}
    concept_vec = {}
    for concept, words in C.VISUAL.items():
        acc = [0.0] * DIM
        n = 0
        for phrase in words:
            toks = [t for t in tokens(phrase) if norm_tok(t) in index]
            if not toks:
                continue
            word2concept[" ".join(norm_tok(t) for t in toks)] = concept
            for t in toks:
                v = vecs[index[norm_tok(t)]]
                for d in range(DIM):
                    acc[d] += v[d]
                n += 1
        concept_vec[concept] = unit(acc) if n else [0.0] * DIM

    model = {
        "dim": DIM,
        "vocab": vocab,
        "vectors": vecs,
        "idf": [round(math.log(1.0 + len(sents) / (1.0 + counts.get(w, 1))), 3) for w in vocab],
        "intentNames": names,
        "intentW": W,
        "featDim": DIM * 2,
        "intentTok": logodds,
        "uni": uni,
        "bi": bi,
        "valence": [round(v, 3) for v in val],
        "arousal": [round(a, 3) for a in aro],
        "word2concept": word2concept,
        "conceptVec": concept_vec,
        "colors": C.COLORS,
        "styles": C.STYLES,
        "times": C.TIMES,
        "weather": C.WEATHER,
        "moods": C.MOODS,
        "knowledge": KB.K,
    }
    out = os.path.join(HERE, "model.json")
    with open(out, "w") as f:
        json.dump(model, f)
    log("wrote", out, "%.1f KB" % (os.path.getsize(out) / 1024.0))

    # a few nearest-neighbour spot checks, so a bad train is obvious
    def nn(word, n=6):
        i = index.get(word)
        if i is None:
            return "(oov)"
        vi = vecs[i]
        sims = []
        for j in range(len(vocab)):
            if j == i:
                continue
            s = sum(vi[t] * vecs[j][t] for t in range(DIM))
            sims.append((s, vocab[j]))
        sims.sort(reverse=True)
        return ", ".join("%s %.2f" % (w, s) for s, w in sims[:n])

    for probe in ["dragon", "wyvern", "sunset", "sad", "code", "gravity", "neon", "cat"]:
        log("  %-9s -> %s" % (probe, nn(probe)))


if __name__ == "__main__":
    main()
