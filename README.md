# Cool-

## Infector — V1.21 "The Elevator"

An online 3D multiplayer infection-survival game that runs from a **single HTML file** —
no build step, no engine, no downloads. Open `infector.html` in any browser (desktop or
mobile) and play.

Everything is generated at runtime: the WebGL renderer, all three maps, every character,
all animation, the particles and every sound.

### Play

- **PC** — `W A S D` move, `Shift` sprint, `Space` jump, `E` interact (infect, press a
  lift button, duck under a bed), `F` hide, `Q` emotes, `Tab` scoreboard, `Esc` pause.
  Click once to lock the mouse for camera control.
- **Mobile** — drag the left half for the joystick, the right half to look, and use the
  on-screen `RUN` / `JUMP` / `INFECT` / `HIDE` / `CALL` buttons.

### The round

Everyone lines up in the lobby while the camera picks **Patient Zero**, who carries a
glowing green syringe lodged in their back for the rest of the match. Zombies bite and
scratch to spread the infection; survivors have to stay clean until the timer runs out.

- **Survivors win** if at least one is alive when time expires.
- **Zombies win** if everyone is infected first.

Nothing is bought. Cosmetics open up as you **level up**, and the rare pieces are
**milestones** — win 15 rounds, climb 50 ledges, be Patient Zero five times. Level,
unlocks and avatar live on your **profile**.

### Difficulty modes

| Mode | Round | Lobby | Carriers | Infected |
|---|---|---|---|---|
| 🌤 Easy | 90 s | 7–10 | 1 | slower, less aggressive |
| ⚔ Normal | 2½ min | 7–10 | 1 | standard |
| 🔥 Hard | 3½ min | 7–10 | 1 | faster, hungrier |
| ☠ Insane | 5 min | 15–20 | 3 | fastest, relentless |

Every server runs a fixed mode; the servers screen filters by map and by mode.

### Maps

- **Playground** — swings, climbing frames, a roundabout and a see-saw, all animated.
- **Neighborhood** — houses, fences, parked cars and porches you can vault and mantle.
- **Hotel** — three storeys played from the inside. A lobby with a front desk, dining
  room, laundry and storage; two guest floors of rooms off a central corridor; a roof.
  Stairwells at both ends and a **working elevator** with a call button at each
  landing and a three-floor panel inside the car — press `E` to use them. The ride
  runs 11–15 seconds door to door and carries whoever is standing in the car.

### Infected classes

- **Walker** — slow but relentless, tracks you across the whole map.
- **Sprinter** — explosive bursts; misjudge a corner and it slams shoulder-first into
  the scenery and loses a second recovering.
- **Crawler** — drags itself along the floor at half everyone else's speed, so it has to
  ambush. It goes for your **ankles**: connect and you go down on your back, it climbs on
  and feeds for thirty seconds while the infection takes hold.

### The one-minute infection

Bites and scratches run the same clock — exactly sixty seconds, in three stages.

| Window | What happens |
|---|---|
| 0–20 s | you react and breathe hard, but still run at nearly full speed |
| 20–40 s | you slow, stumble and drip green; zombies lose interest and chase clean survivors |
| 40–60 s | your legs give out, you sit down, and then you turn |

### Hiding

Hotel beds are high enough to crawl under. Press `F` (or tap **HIDE**) near one: the
camera drops to mattress height, you move at about a third of your speed, and most
zombies walk past and search elsewhere. A **Crawler** is already at floor level and will
come straight in after you.

Guest room doors are dealt open or shut at the start of every round, so the routes
through a floor change each time. A shut door blocks sight and movement until somebody
shoves it open — loudly.

### What's inside

| Piece | Notes |
|---|---|
| Renderer | Custom WebGL: batched static world, one draw call for all characters, packed-depth soft shadows, procedural sky, dynamic resolution, separate indoor lighting model |
| Characters | Procedural stickman rig, 35 pose channels, weighted animation blending, expressive 3D faces with blinking |
| Maps | Playground, Neighborhood and the three-storey Hotel, procedurally assembled from a fixed seed so every client builds the same world |
| Collision | Circle-vs-box/circle with standable tops, per-storey colliders, step-up, moving platforms and toggleable door colliders |
| Netcode | Transport abstraction — an authoritative local round with bots by default, or a real server via `?server=wss://host` with snapshot interpolation |
| Audio | Fully synthesized Web Audio: wind, birds, growls, footsteps, indoor air handling and mains hum, and an adaptive score that tightens as the infection spreads |

### Version history

- **V1.21 — The Elevator.** Locomotion rebuilt on the real leg geometry: the pelvis
  follows the exact two-link chain solve so planted feet stay on the floor, cycle rate
  is derived from swing amplitude so nothing skates, and a floor clamp in the pose
  pipeline stops any pose pushing a sole through the ground. Stride is up 33% walking
  and 55% sprinting. The elevator gained call buttons, an in-car floor panel, lit
  indicators, eased travel and an 11–15 second ride. The hotel gained ceiling lights,
  sconces, numbered doors, a corridor runner and trolley, a furnished reception and
  lounge, and dressers, desks, wardrobes, curtains and rugs in every guest room.
- **V1.20 — Nightmare Hotel.** Four difficulty modes with per-mode round length, lobby
  size, carrier count and infected aggression. The Hotel map: three storeys, working
  elevator, stairwells, hide-under-beds, per-round door shuffle, indoor lighting and
  ambience. Servers screen gains mode tabs; the HUD gains mode and storey indicators.
- **V1.12 — The Crawler.** A third class that never gets up, ankle bites that take you
  off your feet, mounted feeding with spreading blood pools, and a thirty-second downed
  state before you turn.
- **V1.11 — Realism & Character Overhaul.** One infection system for every attack, on a
  single sixty-second three-stage clock; realistic proportions and faces; zombie feeding.
- **V1.10 — The Infection Evolution.** Two zombie classes, sprinter collision recovery,
  the line-up cutscene, Patient Zero's lodged syringe, bigger maps.
- **V1.02 — Movement & Mobility.** Joystick rebuild, jump phases, automatic climb and
  vault, level-and-milestone progression replacing coins.
- **V1.01 — Human Detail & Zombie Transformation.** Detailed human models and the
  transformation sequence.
- **V1.00** — first release.

### Known limits

- There is no public match server. The transport abstraction and the WebSocket client
  are real, but online play needs a backend; by default a round runs authoritatively
  in-process against bots.
- Profiles are per-device. Transfer codes move a profile between devices, and a `?sync=`
  endpoint hook exists, but there is no automatic cross-device sync.
