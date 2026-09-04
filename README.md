# Films that render themselves

Two short films in this repo. Each is one self-contained HTML file — open it
in a browser and press play. No video file, no server, no network request:
every set, character, texture, animation, camera move and sound is generated
in code and drawn live with three.js, which is inlined into the page.

## RUN FROM ZOMBIES

- **5:20**, 46 shots, seven characters
- Black player interface, thin white outlines, nothing else on screen
- Tap or double-tap the left/right of the picture to jump 10s (it accumulates),
  tap the middle to play/pause, drag the scrubber, 0.25×–2× speed
- Keys: `space`/`k`, `j`/`l`, arrows, `0`–`9`, `m`, `f`, `Home`/`End`

Every frame is a pure function of the film clock, so scrubbing to a time lands
on exactly the frame you would have reached by playing to it.

`SCRIPT.md` is the script the film was built from.

## BATTLE WARS — PART ONE

`battle-wars.html`. Two rival teams, a war neither of them started, and the
enemy that wanted them fighting.

- **33:19**, 110 scenes across five acts, ten named characters plus Blackout
- Seven locations: a city street, a warehouse, a rooftop, a fortress, a
  reactor hall, the wreckage, and the plaza where it ends
- Same player, same rule: every frame is a pure function of the film clock

`SCRIPT.md` is the script RUN FROM ZOMBIES was built from.
