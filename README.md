# Cool-

## DREAMVISION II — `index.html`

A single-file 3D dream engine. You describe a place in plain words, it compiles
that sentence into a world, and you walk around inside it.

There is no fixed list of scenes and no fixed list of objects. Any noun you type
becomes something: if the engine has no definition for the word, it classifies
it by the shape of the word itself and grows a form out of primitives, seeded by
the letters — so `gloomberries` always builds the same gloomberry, every time,
on every device.

Open the file in a browser. Nothing to install.

### The four engines

| Engine | Passes | Dream length | What it adds |
|---|---|---|---|
| **Dreamer V2** | 1 | 2:30 | The fast core. Reads the prompt literally and puts it on the ground. |
| **Dreamer V2.1** | 2 | 3:30 | A second pass: richer palette, ground detail, layered weather, a horizon, ambient life. |
| **Dreamer 2.3 Fast** | 2 | 4:00 | Everything V2.1 does plus semantic expansion, compiled in one shot with no thinking pauses. Stronger than V2.1 and the quickest of the four. |
| **Dreament Agent 2** | 6 | 5:00 | Plans, expands the idea with what it implies, designs each object, raises a landmark at the centre of the world, then reviews its own build and fixes what is missing. Time of day moves while you are inside. |

Each engine also runs at three effort levels — Instant, Deep and Max — which
change how much it thinks and how dense the world gets.

**Engine stats** in the menu benchmarks all four live on your device: every
engine compiles the same six scenes and is scored on world size, variety,
reasoning depth and how long it keeps you waiting. Typical result:

| | Strength | World | Build |
|---|---|---|---|
| Dreament Agent 2 | 223 | 155 | 3.7s |
| Dreamer 2.3 Fast | 122 | 139 | 0.2s |
| Dreamer V2.1 | 95 | 121 | 1.7s |
| Dreamer V2 | 43 | 48 | 0.9s |

### What the compiler understands

Colours, sizes (`giant`, `tiny`), counts (`three`, `a thousand`, `countless`),
materials (`a road made of pizza`, `everything is made of chocolate`), twenty
biomes, times of day, weather (two layers can stack), movement (`flying`,
`swimming`), and seven moods that regrade the whole palette. Anything left over
becomes an object.

Agent 2 additionally infers what a prompt implies — a city at night gets
streetlights and traffic — and reports every inference in its trace panel.

### The interface

There is no menu of suggested prompts — you type your own, any length, as many
as you like.

Everything else is built around bubbles. Each keystroke releases one from the caret
as you write, finishing a word lets a bigger one go, the send button breaks into
a burst, and slow bubbles drift behind the whole page. Messages and dream cards
pop in on a spring rather than a fade. All of it is suppressed under
`prefers-reduced-motion`.

### Inside a dream

- **Touch:** left half of the screen to move, right half to look.
- **Keyboard:** `WASD` / arrows to move, mouse to look (click to lock), `Shift`
  to sprint, `Space` to rise when flying, `P` to pause, `F` for a photo.
- Timer ring, compass, pause menu, in-world photo capture, and `+60 seconds`
  if you are not ready to wake up.

### Notes

- Geometry is instanced — one draw call per part per object type — so a world of
  several hundred objects stays at a few dozen draw calls.
- The compiler, chat and previews are pure JavaScript with no dependency on the
  3D library, so the interface still works if three.js fails to load.
- three.js r128 is loaded from a CDN; everything else, including the ground
  textures, is generated at runtime.

## The Last Candle — `horror.html`

An earlier single-file horror game.
