# Films that render themselves

Two films in this repo, one of them in three cuts. Each cut is a single
self-contained HTML file — open it in a browser and press play. No video
file, no server, no network request: every set, character, texture,
animation, camera move and sound is generated in code and drawn live with
three.js, which is inlined into the page.

## Watch — `watch.html`

`watch.html` is the library in one file: a streaming-style front end (hero
banner, rails of hover-scale cards, match %, detail sheet, continue watching)
carrying the complete Battle Wars and Run From Zombies, with three.js shared
between them. It opens with an animated brand intro and a synthesised sting,
then drops straight into the picture.

Progress is remembered per film in `localStorage`, so closing the tab and
coming back resumes where you stopped.

## RUN FROM ZOMBIES

`run-from-zombies.html` — **5:20**, 46 shots, seven characters.

## BATTLE WARS

`battle-wars-complete.html` — **1:06:34**, 205 scenes, sixteen locations,
eighteen named characters. Both halves joined into one picture, with a PART
TWO card on the hinge and a single set of credits at the end.

The first half is a war between two teams who were never really enemies. The
second opens on the ruins of both their headquarters and goes back eighty
years to work out why — a murder in 1946, a stranger nobody can remember, and
a reserve of gold under the planet somebody has been guarding ever since.

The halves are also on their own:

- `battle-wars.html` — Part One, **33:19**, 110 scenes, seven locations: a
  city street, a warehouse, a rooftop, a fortress, a reactor hall, the
  wreckage, and the plaza where it ends.
- `battle-wars-2.html` — Part Two, **33:52**, 95 scenes, nine locations
  spanning 1946 and the present day. `SCRIPT-PART2.md` has the beat sheet.

## The player

Black interface, thin white outlines, nothing else on screen.

- Tap or double-tap the left/right of the picture to jump 10s (it accumulates),
  tap the middle to play/pause, drag the scrubber, 0.25×–2× speed
- Keys: `space`/`k`, `j`/`l`, arrows, `0`–`9`, `m`, `f`, `Home`/`End`

Every frame is a pure function of the film clock, so scrubbing to a time lands
on exactly the frame you would have reached by playing to it.

`SCRIPT.md` is the script RUN FROM ZOMBIES was built from.
