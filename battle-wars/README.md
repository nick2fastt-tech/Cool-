# Battle Wars

A kid-friendly (ages 9–14) 3D animated action-comedy series. Season 1 is planned at 12–14 episodes.

Every episode is delivered as one **2K MP4** (2560×1440) with stereo sound and captions. Add `--all-sizes` to the build to also get 1080p and 720p copies. There are no voices or text-to-speech: every line is a caption with the speaker's name in their color, and sounds get captions too.

## Episodes

| ID | Title | Length |
|----|-------|--------|
| `s1e1-be-ready` | Season 1, Episode 1: "BE READY!" | 7:30 |
| `s1e2-the-red-diamonds` | Season 1, Episode 2: "THE RED DIAMONDS" | 1:30 |
| `s1-red-diamonds` | The Red Diamonds scene on its own (used inside Episode 2) | 1:02 |

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
| **Soul Stealer** (villain) | tall hooded cloak, glowing red eyes, red symbol in his palm | red |

## Locations

Aetherfall City streets · Aetherfall Coffee · Battle Wars HQ (outside, living room on floor 1, Controller Room on floor 3, hidden reactor room below) · the Soul Stealer's red-crystal cavern · title card (blue, or red "electric" style).

## How it's made

Everything is code — no 3D software or downloaded assets.

- `episodes/<id>.js` — **an episode script**: every line, action, camera shot and sound cue on a timeline
- `src/` — the shared engine: characters and poses (`characters.js`), sets (`sets.js`), water effects (`fx.js`), the timeline system (`director.js`), captions and comic pop-ups (`overlay.js`), renderer (`main.js`)
- `tools/audio.mjs` — synthesizes the music, sound effects, footsteps and the captions file
- `tools/render.mjs` — renders frames in headless Chromium (parallel workers) and encodes with ffmpeg
- `tools/preview.mjs` — quick contact sheet of frames for checking shots
- `tools/build.mjs` — runs it all and writes the 2K MP4 (`--all-sizes` adds 1080p and 720p)

### Build an episode

Needs Node 18+, ffmpeg and Playwright's Chromium.

```bash
npm install
node tools/build.mjs --ep s1-red-diamonds          # audio + 2K render + the 2K MP4
node tools/build.mjs --ep s1e1-be-ready --skip-render   # only redo audio/captions and re-mux
node tools/preview.mjs s1-red-diamonds 0 60 4 tmp/sheet.jpg   # contact sheet, every 4 s
```

Rendering takes roughly 4–5× the episode length per resolution step on 4 CPU cores (2K is the slow part).

To preview interactively, serve this folder (`npx http-server .`) and open `player.html?ep=<episode-id>` — scrub to any moment.

### Making a new episode

Copy an existing file in `episodes/`, give it a new `META` (id, title, file name), and write the scene with the director calls (`say`, `move`, `act`, `cam`, `sfx`, `music`, …). New characters go in `CAST` in `src/characters.js`; new locations in `src/sets.js`.
