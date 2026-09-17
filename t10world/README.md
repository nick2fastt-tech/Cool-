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

**1,456 commands** across 31 categories. Ask `T10 what can you do` in game.

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
| Jump | `Space` | **↑** button |
| Crouch | `Ctrl` | **↓** button |
| Use — everything | `E` | **E** button |
| Enter/exit vehicle | `F` | **↰** button |
| Powers | `1`–`0`, `Z` `X` `C` `J` `B` `N` | **✷** button, top left |
| Open T10 | `T` | tap the orb |
| Map | `M` | `T10 open the map` |
| Camera 1st/3rd | `V` | Settings |
| Settings | `Esc` | gear, top right |

There is one walking pace — no sprint button. First or third person is a
setting, not a button. **Use** is contextual and does everything: fires the
weapon you're holding, sits you down, boards the train, talks to whoever is in
front of you.

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

**Worlds** — you can keep as many as you like, and each one is its own
universe: its own seed and city, its own people, animals and traffic, its own
weather and hour, its own spawned objects, creature designs and world rules
(gravity, time scale, content rating, whether you can die, whether the dead get
back up). Create, load, rename, duplicate and delete them from the opening
screen. Duplicating keeps the seed, so you get the same city and a separate
history.

**Powers** — sixteen of them, on keys `1`–`0` and `Z` `X` `C` `J` `B` `N`, or a
grid of tiles on a phone: telekinesis, super jump, super speed, flight, force
field, time slow, teleportation, gravity control, energy blast, invisibility,
object duplication, freeze, healing, size change, lightning and creature summon.
One energy pool feeds all of them and refills on its own; each has its own cost,
cooldown, casting animation, sound and visual effect, and each one acts on the
world — telekinesis throws whatever is loose, teleport puts you where you are
looking, invisibility means nobody's AI is told where you are, and lightning
actually strikes.

**Creatures** — twenty fictional species across three families: abnormal zombies
(runners, brutes, crawlers, screamers, spitters, bloaters, stalkers), mutation
zombies (tendrils, carriers, splitters, hives) and monsters (gargoyles, golems,
wisps, hoppers, lurkers, chimeras, shades, leviathans, seraphs). Every one is a
body plan in code — height, bulk, limbs, heads, eyes, spines, wings, tails — with
its own movement style (walk, lope, crawl, hop, hover, slither, stalk), its own
AI, its own voice and its own abilities: pouncing, charging, shockwaves,
screeching for help, spitting, cloaking, splitting in two when downed, brooding
smaller ones, burrowing and coming up somewhere else. You can also describe one
in plain words — `T10 design a creature` — and get a species you can spawn, saved
with the world.

**Mutations** — pick someone and apply a fictional strain. It runs through four
stages, Normal → Mutation beginning → Partially transformed → Fully transformed,
and ends with the person replaced by the creature they became. Deliberately not
gory: a colour shift under the skin, a light behind the eyes, a tremor and a
change in how they stand. You can stop it at any stage and put them back.

**Apocalypses** — six, on request: a zombie outbreak that starts with one person
turning while you watch and spreads by touch, a riot where everyone turns on
everyone, an alien invasion, a meteor strike, a blackout and a machine uprising.

**The subway** — three lines, sixteen stops, trains that arrive, open their
doors, wait, close them and run. Walk down, wait on the platform, press use to
board, sit down, and get off wherever you like.

**The feature library** — the roadmap lives in the game as data: 500 tracked
features across twenty areas, each marked live, partly there, or planned, all of
it searchable from inside the world (`T10 what is on the roadmap`,
`T10 tell me about animals`, `T10 what should I try`). Adding to it is one
`addFeature(...)` call, which is how the list keeps growing.

**T10** — the assistant. Requires its name before every instruction. Opening the
chat switches your view to its machine sight: green, scanlined, edge-traced.
It holds your money (there is no on-screen balance — ask it), and it can add or
remove almost anything, restyle you or the crowd, move you anywhere, control
people and animals, change the time, the weather, gravity, the graphics, and
answer questions about where you are and who you're looking at.

---

## Quality

Three presets — `LOW`, `HIGH`, `ULTRA` — in settings, or `T10 set quality to ultra`.
HIGH is the default on every device.

A preset is not a resolution slider. Each one moves the whole simulation
together: shadow map size and distance, cascade count, draw and streaming
distance, prop, tree and grass density, crowd, traffic and animal budgets,
background population, physics rate, human mesh resolution, whether fingers get
their own bones, facial animation, animation rate, rain particle count, gore
budget, texture size and the post-processing chain. ULTRA adds ray-marched
screen-space reflections.

### Holding the frame rate

The game targets a steady 60 fps and protects it itself. A monitor samples
frame time, the 95th percentile, draw calls, memory and every entity count; a
governor reads that and walks down a ladder, giving up the least visible thing
first:

```
everything → distant simulation → particles → shadow distance
           → reflections → vegetation → LOD and streaming → resolution
```

Resolution is last, because a soft picture is the most obvious cut of all. It
climbs back up the same ladder in reverse when there is room. On top of that it
watches for **thermal throttling** — the same workload getting slower the longer
a session runs — and holds the ceiling down when it sees it, rather than
oscillating into a hot phone. `T10 how is performance` reads the whole thing
back.

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
  entities/    NPC life simulation, vehicles and physics, traffic AI, animals,
               apocalypses, blood and gibs, the 400-weapon armoury, the
               creature bestiary, the mutation system
  player/      character controller and camera, the armoury, the 16 powers
  render/      sky/day-night/weather, post-processing and vision modes
  t10/         language matcher, command registry (8 files), shared emotes,
               the feature library
  ui/          HUD, T10 chat, settings, map, command book, character creator
```

Systems are deliberately separable, and almost everything is a data row rather
than code. Adding a building type means one function in `world/buildings.js`; a
new vehicle is one entry in `VEHICLE_TYPES`; a new animal one entry in
`ANIMAL_TYPES`; a new creature one entry in `CREATURES`; a new power one entry in
`POWERS`; a new mutation strain one entry in `STRAINS`; a new roadmap item one
`addFeature(...)` call; a new command one `add(...)` call. The command
registry generates families (every hair colour, every height in inches, every
landmark) rather than listing them by hand, so the world and T10's vocabulary
stay in sync.

### Tests

`tools/` holds the headless harnesses used while building this — they drive a
real browser through Playwright and render actual frames:

```bash
node tools/check-commands.mjs                    # registry + feature library, no browser
node tools/run-test.mjs /tools/test-human.html   # human generation + rig
node tools/run-test.mjs /tools/test-creatures.html   # every creature, built and rendered
node tools/play.mjs                              # full game, end to end
node tools/play-single.mjs ../t10world.html      # the bundled build
```

`check-commands.mjs` runs in plain node in under a second: it counts the
registry, fails on a duplicate command id or a duplicated phrase (either one
makes a command unreachable), and checks that every example command printed by
the feature library actually resolves to a real command.

`play.mjs` is the one that matters. It drives a real browser through the whole
game and asserts on behaviour, not just on "it didn't throw": that the joystick
walks you the way you pushed it, that a zero-height viewport heals itself, that
the touch pad has exactly the buttons it should, that bullets land and bleed,
that the subway takes you somewhere, that all sixteen powers fire and cost
energy, that every creature spawns and moves and can be shot, that a mutation
runs through its stages and produces no gore, that the performance ladder gives
things up in order and comes back, and that the world library round-trips a
save.
