# Cool-

## Infector — V1.02

An online 3D multiplayer infection-survival game that runs from a **single HTML file** —
no build step, no engine, no downloads. Open `infector.html` in any browser (desktop or
mobile) and play.

Everything is generated at runtime: the WebGL renderer, both maps, every character,
all animation, the particles and every sound.

### Play

- **PC** — `W A S D` move, `Shift` sprint, `Space` jump, `E` / left click infect,
  `Q` emotes, `Tab` scoreboard, `Esc` pause. Click once to lock the mouse for camera control.
- **Mobile** — drag the left half for the joystick, the right half to look, and use the
  on-screen `RUN` / `JUMP` / `INFECT` buttons.

### The round

Everyone spawns human. Seconds later one player becomes **Patient Zero** and receives a
glowing green syringe. Zombies stab survivors in the back to spread the infection;
survivors have to stay clean until the timer (a random 2–3 minutes) runs out.

- **Survivors win** if at least one is alive when time expires.
- **Zombies win** if everyone is infected first.

Coins are paid out either way and buy hairstyles, tops, hats, glasses, backpacks, faces,
character colours, emotes and victory animations — all of which show up on your stickman
in-game.

### What's inside

| Piece | Notes |
|---|---|
| Renderer | Custom WebGL: batched static world, one draw call for all characters, packed-depth soft shadows, procedural sky, dynamic resolution |
| Characters | Procedural stickman rig, 32 pose channels, weighted animation blending, expressive 3D faces with blinking |
| Maps | Playground and Neighborhood, procedurally assembled from a fixed seed so every client builds the same world |
| Netcode | Transport abstraction — an authoritative local round with bots by default, or a real server via `?server=wss://host` with snapshot interpolation |
| Audio | Fully synthesized Web Audio: wind, birds, growls, footsteps, UI, and an adaptive score that tightens as the infection spreads |
