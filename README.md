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

### The three engines

| Engine | Passes | Dream length | What it is |
|---|---|---|---|
| **Dreamer 2.3 Fast** | 2 | 4:00 | The quick one. Reads what your prompt implies and compiles in one shot, no thinking pauses. |
| **Dreament Agent 2** | 6 | 5:00 | Plans, expands, designs, raises a landmark at the centre of the world, then reviews its own build and fixes what is missing. |
| **Dreamer V2.5** | 8 | 6:00 | **Strongest.** Builds every word you write and tells you what it did with each one. Lights the world from a real sun angle with contact shadows under everything, paints rock into the steep ground, and gives each object weight when the wind moves through it. |

Each engine also runs at three effort levels — Instant, Deep and Max — which
change how much it thinks and how dense the world gets.

**Engine stats** in the menu benchmarks all three live on your device: every
engine compiles the same six scenes and is scored on world size, variety,
reasoning depth and how long it keeps you waiting. Typical result:

| | Strength | World | Build |
|---|---|---|---|
| Dreamer V2.5 | 308 | 202 | 2.4s |
| Dreament Agent 2 | 223 | 155 | 3.7s |
| Dreamer 2.3 Fast | 122 | 139 | 0.2s |

#### What V2.5 does that the others do not

- **Literal to the word.** It keeps a ledger of your sentence: every word you
  wrote and what it became. `"sunset" → sun angle and colour`,
  `"gloomberry" → invented shape ×3`. The ledger is shown while it builds.
- **Real sun.** Time of day sets an actual sun elevation, so dusk rakes across
  the ground with long shadows and noon sits overhead.
- **Contact shadows.** A soft darkening under everything that stands still, so
  objects sit on the ground instead of hovering over it.
- **Slope-aware terrain.** Steep faces wear rock; flat ground keeps its colour.
- **Wind with weight.** One wind blows through the whole world, slowly turning.
  Vegetation bends around its base, so a trunk barely shifts while the canopy
  swings. Stone and buildings stay put, which is both truer and cheaper.

### What the compiler understands

Colours, sizes (`giant`, `tiny`), counts (`three`, `a thousand`, `countless`),
materials (`a road made of pizza`, `everything is made of chocolate`), twenty
biomes, times of day, weather (two layers can stack), movement (`flying`,
`swimming`), and seven moods that regrade the whole palette. Anything left over
becomes an object.

Dreamer 2.3 Fast and Agent 2 additionally infer what a prompt implies — a city
at night gets streetlights and traffic — and report every inference in their
trace panel.

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
