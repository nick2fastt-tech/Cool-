# Battle Wars

A kid-friendly (ages 9–14) 3D animated action-comedy series. Season 1 is planned at 12–14 episodes.

Every episode is delivered as one **1080p MP4** (1920×1080) with stereo sound and captions (Episodes 1–2 were made in 2K; `--2k` still renders at 2560×1440). There are no voices or text-to-speech: every line is a caption with the speaker's name in their color, and sounds get captions too.

## Episodes

| ID | Title | Length |
|----|-------|--------|
| `s1e1-be-ready` | Season 1, Episode 1: "BE READY!" | 7:30 |
| `s1e2-red-diamond-hunt` | Season 1, Episode 2: "THE RED DIAMOND HUNT" (Red Team suits) | 12:49 |
| `s1e3-soul-stealers-secret` | Season 1, Episode 3: "THE SOUL STEALER'S SECRET" | 10:45 |
| `s1e4-spooky-halloween-party` | Season 1, Episode 4: "SPOOKY HALLOWEEN PARTY" (Halloween special) | 9:24 |
| `s1e5-behemoth-awakens` | Season 1, Episode 5: "BEHEMOTH AWAKENS" | 12:31 |
| `s1e6-the-power-returns` | Season 1, Episode 6: "THE POWER RETURNS" | 10:19 |
| `s1-red-diamonds` | Early Red Diamonds teaser scene (blue suits) | 1:02 |

Finished videos go to `output/<episode-id>/` (not stored in git — GitHub's 100 MB file limit).

## Characters

| Character | Look | Caption color |
|-----------|------|---------------|
| **Aaron** (main) | brown spiky hair, blue Battle Wars suit | gold |
| **Flare** | black spiky hair, the tired coffee lover | orange |
| **Eric** | brown wavy hair, always hyped | green |
| **Greg** | white round head, two line eyes, black trench coat, usually sleepy | white |
| **Leon** | the team's mentor: dark hair with a gray streak, navy suit with gold piping | amber |
| **Water Guy** (villain) | body of flowing water, cartoon face | blue |
| **Soul Stealer** (villain) | tall hooded cloak, glowing eyes (red, or violet in his sanctuary), symbol in his palm | red |
| **The Dog** | a very normal-looking park dog... that can float | — |
| **Bird-dog Eric** | Eric's transformation: a blue dog with wings that chirp-barks | — |
| **Newark** | the team's friend and party host: wavy hair, black coat with orange trim, top hat and bow tie | purple |
| **Behemoth** (villain) | a worm-like metal dragon with glowing eyes, armor plates, tiny claws and a crown that controls its size (from tiny to taller than the buildings) | purple |
| **Tiger Eric** | Eric's tiger transformation | — |
| **Cat Eric** | Eric's newest transformation: a small orange tabby cat that loves pizza and video games | — |
| **The Cowboy** (mystery) | long coat, wide-brimmed hat, face always hidden in shadow; rides a dark horse | — |

## Locations

Aetherfall City streets · Aetherfall City Park · Aetherfall Coffee · Battle Wars HQ (outside, living room on floor 1, Controller Room on floor 3, hidden reactor room below) · Red Team HQ (with a lounge couch and TV) · abandoned subway tunnels, lower machine chamber and platform · the ancient diamond chamber · the Soul Stealer's crystal cavern (red or violet) · title card (blue, red "electric", or orange-and-purple Halloween style) · Flare and Aaron's bedroom · the Halloween store · Newark's house (outside at night, and the party room with stage and dance floor). Halloween episodes also decorate the living room and add pajama and costume outfits. Episode 5 adds Greg's HQ bedroom, a downtown intersection with a city-center plaza, a damaged city park, the UFO, and upgraded blue uniforms with armor. Episode 6 adds the Soul Stealer's lair with the Behemoth's cage, a dark city alley at night, a city view from the living-room window, and a little clay Behemoth figure.

## How it's made

Everything is code — no 3D software or downloaded assets.

- `episodes/<id>.js` — **an episode script**: every line, action, camera shot and sound cue on a timeline
- `src/` — the shared engine: characters and poses (`characters.js`), sets (`sets.js`), water effects (`fx.js`), the timeline system (`director.js`), captions and comic pop-ups (`overlay.js`), renderer (`main.js`)
- `tools/audio.mjs` — synthesizes the music, sound effects, footsteps and the captions file
- `tools/render.mjs` — renders frames in headless Chromium (parallel workers) and encodes with ffmpeg
- `tools/preview.mjs` — quick contact sheet of frames for checking shots
- `tools/build.mjs` — runs it all and writes the 1080p MP4 (`--2k` for 2K; `--2k --all-sizes` adds 1080p and 720p)

### Build an episode

Needs Node 18+, ffmpeg and Playwright's Chromium.

```bash
npm install
node tools/build.mjs --ep s1e3-soul-stealers-secret   # audio + 1080p render + the MP4
node tools/build.mjs --ep s1e1-be-ready --skip-render   # only redo audio/captions and re-mux
node tools/preview.mjs s1-red-diamonds 0 60 4 tmp/sheet.jpg   # contact sheets, every 4 s
node tools/preview.mjs s1-red-diamonds 12.5,30,41 0 0 tmp/spot.jpg   # or exact times
```

Rendering runs on 4 CPU cores: 1080p takes several hours for a 10-minute episode, 2K about twice that. The render works in small chunks, so if it stops, run the same command again and it picks up where it left off.

To preview interactively, serve this folder (`npx http-server .`) and open `player.html?ep=<episode-id>` — scrub to any moment.

### Making a new episode

Copy an existing file in `episodes/`, give it a new `META` (id, title, file name), and write the scene with the director calls (`say`, `move`, `act`, `cam`, `sfx`, `music`, …). New characters go in `CAST` in `src/characters.js`; new locations in `src/sets.js`.
