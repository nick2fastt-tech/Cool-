# NanoTech

Nick's own chat model, image model and video model, in one HTML file.

Open `NanoTech.html` in any browser. There is no install, no sign-up, no server
and no other model involved. Turn the wifi off and it still works, because the
whole model is in the page.

## What's in it

**NanoTech** — the chat model. Understands what you said, remembers the
conversation, and answers in a voice that matches how you're typing.

**NanoImagine Flash 1.5 / Variant** — text to image. Draws illustrations as
SVG, shape by shape, so they stay sharp at any size.

**NanoVision / NanoVision Pro** — text to video. Builds an animated SVG scene
with CSS keyframes: 10 to 15 seconds, seamless loop, exports to WebM.

All three run on your device. Nothing you type or make leaves it.

## The API key

NanoTech has its own key format and accepts nothing else:

```
nano-f10k7bqmhmjdzvmfb48-0e2b
     │└──────┬────────┘ └─┬─┘
     │       │            └── checksum
     │       └── version, issue day, randomness
     └── tier: f free, p pro
```

The app mints a free key the first time you open it. Menu → Brain to copy it,
make a new one, switch to a Pro key (unlimited images) or paste one in. Keys are
made and verified on the device, so they work offline. A key from any other
service is rejected.

## How the model works

### Understanding

The model ships 2,000 word vectors, 48 dimensions each, trained in Python from
a curated corpus: PPMI over a distance-weighted co-occurrence matrix, reduced by
a randomized truncated eigendecomposition, then retrofitted to hand-built
lexicons so synonyms land on each other. `dragon` and `wyvern` sit at 0.87
cosine; `neon` and `cyberpunk` at 0.98.

On top of that:

- **Intent** — a softmax classifier over mean- and max-pooled vectors,
  ensembled with per-token log-odds and a layer of hard rules. 94% on the
  training set, and the rules cover the short messages that matter most.
- **Topic** — hybrid retrieval over 62 knowledge articles: cosine similarity
  plus idf-weighted lexical overlap. It refuses to match when the question is
  mostly words it has never seen, so "explain quantum chromodynamics" gets an
  honest "I don't know" instead of a confident wrong answer.
- **Sentiment** — valence and arousal per word, grown from ~60 seeds by label
  propagation across the vector graph.
- **Typos** — Damerau edit distance against the vocabulary, so `javascrpit`,
  `wieght` and `pyhton` all land.

### Talking

Answers are composed, not recited. A plan of moves (definition, facts, analogy,
follow-up) goes through a realizer that picks phrasing from pools with
anti-repetition, matches your register and energy, and budgets emoji. Memory
tracks your name, what you said you like, what you're building and where the
conversation is, so "tell me more" continues the actual topic.

Some things it computes exactly rather than talks around: a real recursive
descent expression parser (precedence, functions, factorials), unit conversion
across six families, dates, counting, primes and factors.

### Drawing

A prompt is parsed into a scene: subject, setting, time of day, weather, mood,
style and palette. Unknown subjects route to the nearest drawable concept by
vector, so `wyvern` draws a dragon. The scene is then built in layers — sky,
far, ground, midground, subject, foreground, light — from parametric form
families (quadruped, bird, fish, humanoid, craft, structure, plant, celestial)
with real gradients, contact shadows and rim light. Every form is measured and
fitted to the frame, so a wide dragon and a tall lighthouse both compose.

Seeded from your words, so the same prompt always gives the same picture.

The video engine reuses the scene and compiles CSS keyframes over it: parallax
per layer, idle motion per subject, particle systems and a slow camera push.
Every animation is infinite and divides the clip exactly, so the loop is clean.

## Repo layout

```
NanoTech.html         the whole app — this is the thing you open
nanotech/
  shell.html          the app shell, before the engine is swapped in
  build.py            swaps the brain, inlines the model and engine
  train/
    knowledge.py      62 structured knowledge articles
    corpus.py         intents, conversational prose, visual lexicon
    linalg.py         randomized eigendecomposition, pure Python
    train.py          trains everything, writes model.json
    pack.py           quantizes to int8, writes nanomodel.js
  engine/             the model at runtime, 14 files
```

## Rebuilding

```sh
cd nanotech/train && python3 train.py && python3 pack.py
cd ../.. && python3 nanotech/build.py
```

Training takes about three minutes and needs nothing but the standard library.
`build.py` writes `NanoTech.html`.
