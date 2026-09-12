# Architecture

## Principle

**The simulation is headless and the presentation is disposable.**

`NightSession` is the entire game: clock, power, doors, tablet, cast. It has no
reference to three.js, the DOM, or Web Audio. It advances by `tick(dt)` at a
fixed 30 Hz and emits events. Rendering, audio, input and UI sit above it and
only ever *read* it.

That is not architectural neatness for its own sake - it is what makes the
next three things cheap:

- **Testing.** 480 full nights run in ~4 seconds in Node with no browser.
- **Determinism.** Every roll comes from a seeded RNG, so a bug report can ship
  a seed and reproduce exactly.
- **Multiplayer.** The server runs the same `NightSession` code with no
  renderer attached; clients get snapshots. There is no second implementation
  of the rules to keep in sync.

## Module map

```
src/
  core/           engine primitives, no game rules
    rng.ts        seeded PRNG + the d20 roll every character shares
    ticker.ts     fixed 30 Hz simulation / free-running render split
    clock.ts      12 AM -> 6 AM night clock
    events.ts     typed event bus
    device.ts     one-shot device probe -> recommended graphics preset

  game/           the rules. no rendering, no DOM, no audio
    config.ts     ALL tuning: rooms, cameras, cast, nights, power, presets
    nightManager.ts   NightSession - owns and wires everything below
    powerSystem.ts    usage bars, blackout, hand-crank recovery
    doorSystem.ts     shutters (with travel) and hall lights
    monitorSystem.ts  tablet state, feed static, what the player can see
    animatronic.ts    shared movement model + the AiContext a character sees
    characters.ts     the five behaviours - one class each
    aiDirector.ts     owns the cast, builds contexts, routes cues
    saveSystem.ts     progress + settings, write-through, never throws

  render/         three.js presentation
    materials.ts      procedural canvas textures and shared materials
    world.ts          the building; ROOM_ANCHORS is the sim -> world bridge
    characterModels.ts original low-poly models, unlit eye meshes
    scene.ts          OfficeScene: renderer, cameras, sync(), jumpscare, menu

  audio/
    audioEngine.ts  fully synthesised SFX, loops and the music box

  ui/
    styles.css   the whole stylesheet, mobile-first, safe-area aware
    dom.ts       element helpers
    touch.ts     pointer input: look-drag, tap, hold
    effects.ts   scanlines, vignette, camera static, blackout dim, flash
    hud.ts       in-shift interface
    screens.ts   menu, night select, settings, extras, results

  net/
    protocol.ts   the wire format, imported by client AND server
    sessionHost.ts  rooms + message routing, with no transport in it
    room.ts       one session: lobby, host role, match loop, migration
  mp/
    map.ts        co-op map: rooms, walls, collision, nav graph, fixtures
    matchSim.ts   THE authoritative co-op simulation (host-side only)
    crewAI.ts     AI teammates, driven through the same input path as a human
    localHost.ts  the session host, running inside the page for solo play
    netClient.ts  socket, reconnect, prediction, interpolation
    mpScene.ts    first-person renderer for the co-op map
    mapProps.ts   set dressing, batched into InstancedMeshes
  ui/
    mpScreens.ts  multiplayer menu, host setup, join, lobby
    mpHud.ts      stick, buttons and every piece of shared state

  main.ts        app shell: state machine, event wiring, the loop

server/
  main.ts        HTTP + WebSocket + rate limiting around SessionHost
  cli.ts         `npm run server`
```

The dedicated server and the in-page host are the same `SessionHost` with a
different transport, so an offline co-op game and an online one cannot diverge.

The multiplayer layer reuses the single-player primitives (`EventBus`, the
renderer, the audio engine, the materials) and shares nothing with its game
rules - `matchSim.ts` and `nightManager.ts` are two separate games that happen
to live in the same building. See [MULTIPLAYER.md](MULTIPLAYER.md).

## Data flow for one frame

```
Ticker (30 Hz fixed)          Ticker (render, every frame)
      |                                |
NightSession.tick(dt)            OfficeScene.sync(session, dt)
  doors.tick                       shutter Y from doors.travel(side)
  monitor.tick  -> 'observed'      hall light intensity from doors.isLightOn
  power.tick    -> 'blackout'      curtain scale from fox.curtainOpen
  director.tick -> 'attack'        character transforms from ROOM_ANCHORS
  clock.advance -> 'hour'          |
      |                          OfficeScene.render()
   events                          office camera, or the active feed camera
      |                                |
  main.ts wiring                   Hud.update(session)
   audio cue, HUD toast,           Effects.update()
   save write, screen change
```

The simulation never calls the renderer. The renderer never mutates the
simulation. `main.ts` is the only file that knows about both.

## Extension points

- **A new character** is one class in `characters.ts` plus an entry in
  `CHARACTERS` and the night tables. The base class already provides the
  movement clock, the d20 roll, path stepping, occupancy checks and the
  doorway/blackout guards.
- **A new room** is an entry in `Room`, `CAMERAS`, `ROOM_ANCHORS` and some
  geometry in `world.ts`.
- **A new mechanic** that consumes power implements a `PowerDraw` flag and a
  usage bar; nothing else needs to change.
- **Multiplayer** is built: `server/room.ts` owns a `MatchSim` and feeds
  clients snapshots. The client runs exactly one piece of that simulation -
  `stepMovement` - to predict its own motion, and nothing else.

## Performance

Targets a mid-range Android phone at a locked 30 fps minimum, 60 where the
device allows.

- **Fixed-step simulation** so frame rate never changes game speed.
- **Static geometry is `matrixAutoUpdate = false`** and pre-baked; only the
  shutters, curtain, fan, crank and characters update matrices.
- **One render pass per frame.** Camera feeds are the same scene from a second
  camera, not a render target, so raising the tablet costs nothing extra.
- **Post effects are DOM/CSS**, not WebGL passes. Camera static is a 32-64px
  noise canvas scaled up with `image-rendering: pixelated`, repainted at 20 Hz.
- **Presets** (`low`/`medium`/`high`/`ultra`) control pixel-ratio cap,
  antialiasing, shadows, extra light count, fog, and static resolution. The
  device probe picks a starting preset; `ultra` is always opt-in.
- **No asset loading at all.** Textures are drawn to canvas and sounds are
  synthesised, so first paint is limited only by parsing ~157 KB of gzipped JS.

Measured build output: `three` 129 KB gz, game code 25 KB gz, CSS 3 KB gz.

## Testing

| Suite | Command | What it proves |
| --- | --- | --- |
| Simulation | `npm test` | Clock, power, blackout, crank, each character's defining rule, and that a full night resolves |
| Balance | `npm run balance` | The six nights form a real difficulty curve, with bounds asserted so tuning cannot silently break it |
| Browser | `npm run smoke` | The built bundle boots in Chromium at a phone viewport, WebGL initialises, touch controls reach the simulation, cameras switch, a blackout can be cranked back, 6 AM saves progress, and no console errors are thrown |
| Networking | `npm test` (`mp-protocol`, `mp-match`) | Real WebSocket clients against a real server: lobby, codes, capacity, ready gate, host migration, reconnection, validation, rate limiting, downs, revives, and the whole power-restoration chain |
| Four clients | `npm run smoke:mp` | Four separate Chromium clients host, join, ready up, play, walk the map, complete an objective step, disconnect, migrate the host and reconnect - with every assertion made from a client other than the one that acted |

The smoke run writes annotated screenshots to `artifacts/`, which is how the
visual state of the game is reviewed without a device in hand.
