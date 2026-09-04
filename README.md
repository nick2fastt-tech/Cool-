# Films that render themselves

Two short films in this repo. Each is one self-contained HTML file — open it
in a browser and press play. No video file, no server, no network request:
every set, character, texture, animation, camera move and sound is generated
in code and drawn live with three.js, which is inlined into the page.

## Watch both — `watch.html`

`watch.html` is the whole library in one file: a streaming-style front end
(hero banner, rails of hover-scale cards, match %, detail sheet, continue
watching) with both films inside it and three.js shared between them. It
opens with an animated brand intro and a synthesised sting, then drops
straight into the picture.

Progress is remembered per film in `localStorage`, so closing the tab and
coming back resumes where you stopped.

## RUN FROM ZOMBIES

`run-from-zombies.html` — **5:20**, 46 shots, seven characters.

## BATTLE WARS — PART 1 OF 2

`battle-wars.html` — **33:19**, 110 scenes, ten named characters plus
Blackout. Seven locations: a city street, a warehouse, a rooftop, a fortress,
a reactor hall, the wreckage, and the plaza where it ends. This is Part 1;
Part 2 is not made yet.

## The player

Black interface, thin white outlines, nothing else on screen.

- Tap or double-tap the left/right of the picture to jump 10s (it accumulates),
  tap the middle to play/pause, drag the scrubber, 0.25×–2× speed
- Keys: `space`/`k`, `j`/`l`, arrows, `0`–`9`, `m`, `f`, `Home`/`End`

Every frame is a pure function of the film clock, so scrubbing to a time lands
on exactly the frame you would have reached by playing to it.

`SCRIPT.md` is the script RUN FROM ZOMBIES was built from.
