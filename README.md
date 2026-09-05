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

## How it is shot

Every cut is composed and rendered for **2.39:1**. The camera really is a
scope camera — the canvas is that shape and the black around it is the
matte — so the picture holds its framing in any window, a portrait phone
included, instead of being a widescreen frame with its top and bottom
covered up.

The performance layer runs under every scene:

- **The dialogue drives the mouths.** Each line is broken into vowel
  groups and the speaker's jaw opens and closes on them — wide for *a*,
  round for *o*, nearly shut through consonant runs. Everyone else in the
  shot listens rather than freezing.
- **Weight transfers instead of drifting.** A standing figure holds a leg,
  gets tired of it and eases across to the other one, the way people do.
- **Arms trail the legs** by about a fifth of a stride, and the body
  compresses a little as each heel takes the load.
- **Reaching is a whole-body action.** How high the hands work decides how
  far the knees bend and the back folds, so picking a note off the cobbles
  does not look like reading a file.
- **Feet meet the floor the set actually has** — the tunnel's walkway sits
  above its origin — and nobody stands inside anybody else.

## The player

Black interface, thin white outlines, nothing else on screen.

- Tap or double-tap the left/right of the picture to jump 10s (it accumulates),
  tap the middle to play/pause, drag the scrubber, 0.25×–2× speed
- Keys: `space`/`k`, `j`/`l`, arrows, `0`–`9`, `m`, `f`, `Home`/`End`

Every frame is a pure function of the film clock, so scrubbing to a time lands
on exactly the frame you would have reached by playing to it.

`SCRIPT.md` is the script RUN FROM ZOMBIES was built from.
