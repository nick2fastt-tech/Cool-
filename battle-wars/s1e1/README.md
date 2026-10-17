# Battle Wars — Season 1, Episode 1: "BE READY!"

A kid-friendly (ages 9–14) 3D animated episode, about 7½ minutes long, rendered to MP4.

**Watch:** `Battle_Wars_S1E1_Be_Ready.mp4` (1280×720, 24 fps, stereo sound, captions burned in, plus a separate caption track you can turn on or off).

## What's in it

| Time | Scene |
|------|-------|
| 0:00 | Cold open — Aetherfall City, morning |
| 0:03 | 1. The Coffee Emergency |
| 0:33 | Title card — BATTLE WARS: BE READY! |
| 0:38 | 2. The Headquarters |
| 1:09 | 3. Something Under the Street |
| 1:59 | 4. The Water Guy |
| 2:27 | 5. The Flood Fight |
| 4:03 | 6. Shut It Down! |
| 5:21 | 7. Mission Complete |
| 6:03 | 8. Pizza Time (+ the blue signal nobody notices) |
| 6:46 | End credits — "New episodes every Saturday at 8:00 AM." |

- **No voices / no text-to-speech.** Every line is shown as a caption with the speaker's name in their color (Aaron gold, Flare orange, Eric green, Water Guy blue). Sound moments get captions too, like *[Rumbling underground]*.
- **Sound:** an original synthesized soundtrack (theme song, villain music, action, comedy, victory, chill pizza music) and sound effects (door bang, coffee splat, rumble, BOOM, water gushes, splashes, clanking barricades, the valve CLUNK, the shrinking bloop, footsteps…).
- **Comic pop-ups** like BAM!, BOOM!, SPLOOSH!, CLUNK! and BONK!

## Characters

Built from the team reference sheet (blue Battle Wars suits with glowing piping, knee pads, emblem):

- **Aaron** (main character) — brown spiky hair
- **Flare** — black spiky hair, the tired coffee lover
- **Eric** — brown wavy hair, always hyped
- **Water Guy** — the villain, made of flowing water with a cartoon face
- **Greg** (white head, black coat) is not in this episode's script, so he doesn't appear yet.

## How it's made

Everything is code — no 3D software or downloaded assets:

- `src/characters.js` — character models, poses, facial expressions, the Water Guy
- `src/sets.js` — coffee shop, HQ outside, living room, Controller Room, city street, title
- `src/fx.js` — water effects (geyser, flood, waves, splashes)
- `src/episode.js` — **the episode script**: every line, camera shot, action and sound cue
- `src/director.js` — the timeline system the script is written with
- `tools/audio.mjs` — synthesizes music + sound effects + captions file
- `tools/render.mjs` — renders frames in headless Chromium and encodes them with ffmpeg
- `tools/build.mjs` — runs everything and outputs the final MP4

### Rebuild it

Needs Node 18+, ffmpeg and Playwright's Chromium.

```bash
npm install
node tools/build.mjs            # audio + render (~80 min on 4 CPU cores) + final MP4
node tools/build.mjs --skip-render   # only redo audio/captions and re-mux
```

To preview without rendering, serve this folder (`npx http-server .`) and open `player.html` — you can scrub to any moment.

To change a line or a scene, edit `src/episode.js` and rebuild.
