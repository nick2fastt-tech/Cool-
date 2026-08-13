# T10 WORLD — V1.00

A full 3D New York City life simulation that runs in a browser. No engine, no
build step, no downloads: open the file and you are standing in your
apartment in Greenwich Village at 7:03 AM.

The goal is not to win anything. It is to feel like you live here.

## Two editions, same game

- **[`t10.html`](../t10.html)** at the repo root — the whole game in one file.
  Download it, double-click it, play. Nothing else needed.
- **`t10/`** — the same game as readable modules. This is the source of truth;
  edit here and run `node t10/build.js` to regenerate the single file.

```
t10.html          single-file build (generated — do not edit by hand)
t10/
  build.js        inlines the modules into t10.html
  index.html      the whole shell: markup, styling, mobile controls
  src/core.js     math, deterministic RNG, save system, state
  src/gl.js       instanced WebGL renderer (shadows, sky, weather, no textures)
  src/places.js   districts, landmarks, 660+ points of interest, subway & bus networks
  src/world.js    streamed procedural city: grid, blocks, parks, bridges, collision
  src/interiors.js enterable places — apartment, stores, offices, subway platforms
  src/agents.js   pedestrians, traffic, the shared character renderer
  src/player.js   movement, both cameras, driving, the interaction probe
  src/systems.js  clock, weather, lighting, audio, needs, money, jobs, transit
  src/ui.js       joystick, drag-look, HUD, map, menus, dialogs, T10 console
  src/t10cmd.js   the T10 natural-language command interpreter
  src/main.js     boot, frame loop, every interaction, save triggers
```

## Playing

Open `t10.html` (or `t10/index.html`) in any browser — from disk or hosted. It
works offline: the page makes no network requests at all, at load or at runtime.

Saves live in `localStorage`. That works from `file://` in Chrome, Edge and
Firefox; a few browsers (notably Safari) restrict storage for local files, and
there the game still runs but will not remember you between sessions. Serve it
over http — GitHub Pages, or `python3 -m http.server` — if you want saving
guaranteed everywhere.

**Touch (phones and tablets)**
- Touch anywhere on the lower-left to raise the joystick, and drag to walk.
  Push past half-way to run.
- Drag anywhere else on the screen to look around.
- Buttons: interact ✋, sprint ⇈, jump ⤒, map 🗺️, inventory 🎒, camera 🎥,
  menu ☰, and **T10**.
- The joystick side, size and look sensitivity are all in Menu → Controls.

**Keyboard**
WASD move · Shift sprint · Space jump · E interact · C camera · M map ·
I inventory · T for T10 · Esc menu · mouse drag to look · wheel to zoom.

## What is in the city

An 8 km × 10 km recreation inspired by New York: Manhattan's avenue/street grid
from Washington Heights down to Battery Park, plus Brooklyn, Queens, the Bronx,
Staten Island, Roosevelt and Liberty Islands, Coney Island and the New Jersey
waterfront. Six bridges you can walk and drive across, two airports, and 660+
marked places — Times Square, Central Park, the Empire State Building, the
Statue of Liberty, Grand Central, Wall Street, Prospect Park, the Wonder Wheel —
alongside the ordinary things: bodegas, laundromats, precincts, firehouses,
libraries, basketball courts, gas stations, bus stops.

Everything is generated on the fly around you and thrown away behind you, so the
map is enormous but only a few hundred metres of it exists at any moment.

## Living here

- **Enter things.** Any place marked enterable opens into a real interior:
  your apartment, stores, restaurants, cafés, gyms, cinemas, bowling alleys,
  arcades, libraries, museums, banks, hospitals, precincts, firehouses, schools,
  hotels, apartment lobbies, offices and subway platforms. Offices, hotels and
  apartment buildings stack multiple floors with a working elevator and stairs.
- **Transport.** Six subway lines with real stations, platforms, arriving trains
  and announcements; five bus routes; taxis you can hail; and cars you can
  actually drive.
- **Work.** Ten jobs with real schedules — you have to be at a matching
  workplace during its hours to take a shift.
- **Time and weather.** A continuous day/night cycle with sunrise, golden hour,
  dusk and late night, and weather that drifts on its own: clear, cloudy, rain,
  heavy rain, thunderstorms, fog, snow, blizzards and wind. Rain wets the
  streets and adds reflections; snow accumulates on up-facing surfaces; both
  change how many people are outside.
- **People.** Pedestrians with their own appearance, gait, age, job, personality
  and destination; they wait at crosswalks, react to rain, and remember you if
  you keep running into them.

## The T10 command system

Tap **T10** (or press `T`) and type — or speak, on browsers with speech
recognition — in plain language:

```
T10, make it rain.
T10, take me home.
T10, spawn a taxi.
T10, find the nearest coffee shop.
T10, teleport me to Brooklyn Bridge.
T10, give me directions to Central Park.
T10, make it night.
T10, change my outfit.
T10, more traffic.
T10, what's my schedule?
T10, play some music.
```

Successful commands answer with **T10 COMMAND ACTIVATED ✦** and a light-blue
sparkle burst. Anything it cannot do gets a straight answer and a useful
alternative rather than an error.

## Saving

The game saves continuously: on a timer, when you enter or leave a building,
when you travel, sleep, work or change days, and when you close the tab. A
second rolling recovery slot is kept in case a save is interrupted. Come back
and you resume standing exactly where you left off — including inside a subway
station. You'll see a light-blue **PROGRESS SAVED** badge when it happens.

## Performance

Quality auto-selects from the device (low / medium / high / ultra, overridable
in Settings). The city streams in chunks around the player with frustum culling
and distance limits; everything is drawn with instanced boxes from a single
procedural shader, so a whole city block costs one draw call. Shadows are a
single cascade and can be turned off. Simulation load (pedestrian and traffic
counts) scales itself down automatically if the frame time slips.

Requires WebGL. Runs on WebGL 1 with instancing, and uses WebGL 2 when present.
