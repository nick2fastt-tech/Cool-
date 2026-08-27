# RUN FROM ZOMBIES

A short film that renders itself.

`run-from-zombies.html` is one self-contained file — open it in a browser and
press play. There is no video file, no server, no network request: every set,
character, texture, animation, camera move and sound is generated in code and
drawn live with three.js, which is inlined into the page.

- **5:20**, 46 shots, seven characters
- Black player interface, thin white outlines, nothing else on screen
- Tap or double-tap the left/right of the picture to jump 10s (it accumulates),
  tap the middle to play/pause, drag the scrubber, 0.25×–2× speed
- Keys: `space`/`k`, `j`/`l`, arrows, `0`–`9`, `m`, `f`, `Home`/`End`

Every frame is a pure function of the film clock, so scrubbing to a time lands
on exactly the frame you would have reached by playing to it.

`SCRIPT.md` is the script the film was built from.
