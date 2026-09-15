# T10 World

An open-world life simulator you talk to.

You wake up on the street. There is no story, no objectives, no health bar and
almost no interface — just a settings button in one corner and a green circle at
the top of the screen marked **T10**. Tap it, say its name, and tell it what you
want. The city keeps running whether you do anything or not.

```
T10 make it rain
T10 I wanna wear something new
T10 how much money do I have
T10 take me to the beach
T10 make everyone dance
T10 give me a sports car
```

**1,014 commands** across 20 categories. Ask `T10 what can you do` in game.

---

## Running it

**Single file** — open `t10world.html` (repo root) in a browser. No server, no install, no
network. Everything (engine, city, people) is generated at runtime.

**From source** — the modular version needs any static server, because ES modules
can't load from `file://`:

```bash
cd t10world
python3 -m http.server 8080      # or: npx serve .
# open http://localhost:8080
```

**Rebuild the single file** after changing source:

```bash
node tools/build.mjs . ../t10world.html
```

---

## Controls

| | PC | Mobile |
|---|---|---|
| Move | `W` `A` `S` `D` | left thumb (joystick appears where you touch) |
| Look | mouse | right thumb drag |
| Sprint | `Shift` | **»** button |
| Jump | `Space` | **↑** button |
| Interact | `E` | **E** button |
| Enter/exit vehicle | `F` | **↰** button |
| Camera 1st/3rd | `V` | **◎** button |
| Open T10 | `T` | tap the orb |
| Settings | `Esc` | gear, top right |

Gamepads work when connected. Key bindings live in `src/core/settings.js`.

---

## What's in it

**The world** — a 2.4 km² city generated from one seed: downtown towers,
midtown, apartment rows, shopping streets, residential blocks and suburbs, an
industrial zone, five parks, a beachfront, forest, countryside and farms. 765
buildings across 239 blocks, a road grid with lane markings and working traffic
signals, a highway ring, and 26 named landmarks (T10 Tower, City Hospital,
Harbour Stadium, Central Police, Fire Station 7, two schools, Grand Central Mall,
Union Station, the power plant, gas stations, bars, diners, the old church).
Chunks stream in and out around you.

**People** — every human in the game, player and NPC alike, is built by the same
parametric system: a skeleton derived from height, build and limb ratios; a
lofted body mesh; a sculpted skull with brow ridge, cheekbones, nose profile,
jaw and chin driven by twenty face parameters; hands with individually
articulated fingers; painted skin, brows, lashes and lips. Nobody repeats.

Movement is procedural, not clip-based — walk, run and sprint blend continuously
out of one cycle, with per-person stride length, arm swing, hip sway, posture
and gait quirks. On top of that run breathing, blinking, eye saccades, head
look-at, jaw movement while speaking, and two-bone foot IK that plants feet on
uneven ground.

NPCs have schedules tied to the clock and their occupation: commuting, working,
shopping, eating, exercising, relaxing in parks, going home, stepping inside
buildings and coming back out. They talk to each other, react to you, and hurry
when it rains.

**Vehicles** — 21 types from hatchbacks to fire engines, buses and motorbikes.
Suspension per wheel, slip and handbrake slides, working headlights, brake
lights, indicators, reverse lamps, sirens, opening doors, modelled interiors
with a steering wheel that turns, fuel, and damage that shows on the paint.
Traffic follows lanes, queues, indicates, obeys signals and stops for
pedestrians.

**Animals** — 19 species with their own behaviours: grazing, sleeping, flocking,
fleeing people and traffic, birds that take off when you get close.

**Sky and weather** — a full day/night cycle with a scattering sky shader,
sunrise and sunset, moon and stars, drifting cloud layers, nine weather states
from clear to thunderstorm, rain that wets the roads and changes how they
reflect, fog, wind and lightning. Night looks nothing like day: windows light up
building by building, street lights come on, headlights sweep the road.

**T10** — the assistant. Requires its name before every instruction. Opening the
chat switches your view to its machine sight: green, scanlined, edge-traced.
It holds your money (there is no on-screen balance — ask it), and it can add or
remove almost anything, restyle you or the crowd, move you anywhere, control
people and animals, change the time, the weather, gravity, the graphics, and
answer questions about where you are and who you're looking at.

---

## Quality

`LOW` / `MEDIUM` / `HIGH` / `ULTRA` in settings, or `T10 set quality to ultra`.

The preset drives everything, not just resolution: shadow maps, draw distance,
crowd and traffic budgets, prop and tree density, human mesh resolution, whether
fingers get their own bones, facial animation, rain particle count and the
post-processing chain. ULTRA adds screen-space ray-traced reflections. An
adaptive resolution governor holds the framerate on weaker hardware; disable it
with `T10 turn off adaptive resolution`.

---

## Architecture

Everything is generated in code. There are no model, texture, or audio files —
the only dependency is Three.js, vendored in `vendor/`.

```
src/
  core/        engine plumbing: math & noise, settings/quality, input
               (keyboard, touch, gamepad), procedural WebAudio, save
  human/       skeleton, parametric body mesh, sculpted head, hair, clothing,
               procedural textures, animator, identity generation
  world/       city layout (roads, blocks, lots, districts), building
               generation, props, materials, chunk streaming and collision
  entities/    NPC life simulation, vehicles and physics, traffic AI, animals
  player/      character controller and camera
  render/      sky/day-night/weather, post-processing and vision modes
  t10/         language matcher, command registry (3 files), shared emotes
  ui/          HUD, T10 chat, settings, character creator
```

Systems are deliberately separable. Adding a building type means one function in
`world/buildings.js`; a new vehicle is one entry in `VEHICLE_TYPES`; a new animal
one entry in `ANIMAL_TYPES`; a new command one `add(...)` call. The command
registry generates families (every hair colour, every height in inches, every
landmark) rather than listing them by hand, so the world and T10's vocabulary
stay in sync.

### Tests

`tools/` holds the headless harnesses used while building this — they drive a
real browser through Playwright and render actual frames:

```bash
node tools/run-test.mjs /tools/test-human.html .   # human generation + rig
node tools/play.mjs                                # full game, end to end
node tools/play-single.mjs ../t10world.html        # the bundled build
```
