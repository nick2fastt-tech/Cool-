# Cool-
Wow

## Track And Field (Roblox demo) — `TrackAndField.lua`

A Speed Stars style sprint game in **one LocalScript**.

### Install
1. Open Roblox Studio (a Baseplate place is fine).
2. Explorer → **StarterPlayer → StarterPlayerScripts** → insert a **LocalScript**.
3. Paste all of `TrackAndField.lua` into it and press **Play**.

### How it plays
- Races run automatically: 60m → 100m → 200m → 400m, each with a semifinal and a final, then it loops.
- You are teleported to a random lane. After your semifinal a screen shows the 8 finalists
  (top 3 per semi = Q, next 2 fastest = q).
- Tap left / right in rhythm. One tap every 0.49 s holds top speed; too slow and you fade,
  mashing or tapping the same side twice slows you down.
  - PC: A / D, Left / Right arrows, or Q / E
  - Phone / tablet: tap the left or right half of the screen (invisible zones, no text)
  - Gamepad: L1 / R1, L2 / R2 or D-pad left / right
- Speed limits: 36.5 studs/s (60m, 100m), 37.3 (200m), 35.2 (400m). 1 stud = 0.28 m.
- Reaction time 0.02–0.05 s. Tapping during "Set" is a false start: the race restarts and your
  reaction becomes 0.15 s. A second false start is a disqualification.
- Stamina starts at 100 and drains while you sprint; low stamina lowers your top speed (felt in the 400m).

### Features
- 8-lane track (red or blue) on grass, staggered starts on the bends, starting blocks, finish post and timing board. No stadium.
- Procedural running, set position, finish dip and celebration animations for **R6 and R15** (no uploaded animations needed).
- UI: live leaderboard + season bests, settings (track colour, performance mode, auto race, chase/side camera), stamina bar at the bottom.
- Performance mode turns off trees, shadows, post effects and textures.
