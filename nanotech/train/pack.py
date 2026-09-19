# -*- coding: utf-8 -*-
"""Packs model.json into the compact blob that ships inside the HTML file.

Float matrices go to int8 with a recorded scale, then base64. Everything else
is trimmed to what the runtime actually reads.
"""
import base64
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def q8(flat, scale=None):
    """int8-quantize a flat float list. Returns (base64, scale)."""
    if scale is None:
        peak = max((abs(x) for x in flat), default=1.0) or 1.0
        scale = peak / 127.0
    buf = bytearray(len(flat))
    for i, x in enumerate(flat):
        v = int(round(x / scale))
        if v > 127:
            v = 127
        elif v < -127:
            v = -127
        buf[i] = v & 0xFF
    return base64.b64encode(bytes(buf)).decode("ascii"), scale


def main():
    m = json.load(open(os.path.join(HERE, "model.json")))
    dim = m["dim"]
    vocab = m["vocab"]
    V = len(vocab)

    flat = []
    for v in m["vectors"]:
        flat.extend(v)
    vec_b64, vec_scale = q8(flat)

    iw = []
    for row in m["intentW"]:
        iw.extend(row)
    iw_b64, iw_scale = q8(iw)

    cvecs = []
    concepts = sorted(m["conceptVec"].keys())
    for c in concepts:
        cvecs.extend(m["conceptVec"][c])
    cv_b64, cv_scale = q8(cvecs)

    val_b64, val_scale = q8(m["valence"])
    aro_b64, aro_scale = q8(m["arousal"])
    idf_b64, idf_scale = q8(m["idf"])

    # bigrams earn their bytes only where the count is meaningful
    bi = {k: v for k, v in m["bi"].items() if v >= 3}
    uni = {k: v for k, v in m["uni"].items() if v >= 4}

    # token log-odds: round hard and drop the weak ones
    itok = {}
    for name, d in m["intentTok"].items():
        itok[name] = {w: round(v, 2) for w, v in d.items() if v >= 0.4}

    out = {
        "v": 1,
        "dim": dim,
        "featDim": m.get("featDim", dim * 2),
        "vocab": vocab,
        "vec": vec_b64, "vecScale": round(vec_scale, 8),
        "idf": idf_b64, "idfScale": round(idf_scale, 8),
        "val": val_b64, "valScale": round(val_scale, 8),
        "aro": aro_b64, "aroScale": round(aro_scale, 8),
        "intentNames": m["intentNames"],
        "iw": iw_b64, "iwScale": round(iw_scale, 8),
        "itok": itok,
        "uni": uni, "bi": bi,
        "concepts": concepts,
        "cvec": cv_b64, "cvecScale": round(cv_scale, 8),
        "w2c": m["word2concept"],
        "colors": m["colors"],
        "styles": m["styles"],
        "times": m["times"],
        "weather": m["weather"],
        "moods": m["moods"],
        "kb": m["knowledge"],
    }

    blob = json.dumps(out, separators=(",", ":"), ensure_ascii=False)
    js = "/* NanoTech model. Trained by nanotech/train/train.py, packed by pack.py.\n" \
         "   %d words, %d dimensions, %d intents, %d drawable concepts, %d knowledge topics. */\n" \
         "var NANO_MODEL = %s;\n" % (V, dim, len(out["intentNames"]), len(concepts), len(out["kb"]), blob)
    path = os.path.join(HERE, "nanomodel.js")
    with open(path, "w") as f:
        f.write(js)

    def kb_(n):
        return "%.1f KB" % (n / 1024.0)

    print("packed", path, kb_(len(js.encode("utf-8"))))
    for label, payload in [("vectors", vec_b64), ("vocab", json.dumps(vocab)),
                           ("bigrams", json.dumps(bi)), ("knowledge", json.dumps(out["kb"])),
                           ("intent tok", json.dumps(itok)), ("w2c", json.dumps(out["w2c"])),
                           ("concept vecs", cv_b64), ("lexicons", json.dumps([out["colors"], out["styles"], out["moods"]]))]:
        print("   %-13s %s" % (label, kb_(len(payload))))


if __name__ == "__main__":
    main()
