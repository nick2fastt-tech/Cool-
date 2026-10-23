# Cool-
Wow

## Track And Field (Roblox demo) — `TrackAndField.lua`

A Speed Stars style sprint game in **one LocalScript**.

### Install
1. Open Roblox Studio with an empty **Baseplate** place (the script builds its own world).
2. Explorer → **StarterPlayer → StarterPlayerScripts** → insert a **LocalScript**.
3. Paste all of `TrackAndField.lua` into it and press **Play**.

### Events
60m, 100m, 200m, 400m, **4x100m, 4x200m, 4x400m** relays. Pick one in Settings → Event, or leave it on
"ALL (rotate)". Every event runs: semifinal → finalists screen → **final introductions** (each finalist's
username and semifinal time, lane by lane) → final → podium. An announcer calls the race in captions and,
where Roblox text-to-speech is available, out loud — including the winner's name.

No bots on the track: you race alone, rivals appear as live times on the leaderboard and results.

### Controls
- Tap left / right in rhythm — **one tap every 0.3 s** holds top speed (no tap text on screen).
- **PC:** A / D (rebindable in Settings → Controls), Left / Right arrows, or left / right mouse click.
  Relays: **Space** (or W / Up) to pass the baton. L = leaderboard, P = settings, C = camera.
- **Phone:** tap the left / right half of the screen; a PASS button appears in relay exchange zones.
- **Gamepad:** L1 / R1 (or L2 / R2, D-pad), A to pass.

### Rules
- Speed limits (studs/s): 60m 36.8, 100m 37.9, 200m 37.7, 400m 34.3 (relay legs use the same limits).
- Reaction time 0.02–0.05 s. Tapping during "Set" is a false start: the race restarts and your reaction
  becomes 0.15 s. A second false start is a disqualification.
- **Real race times:** the clock counts real seconds from the gun; official times are rounded up to the
  hundredth like real athletics (reaction time shown separately).
- **World records** live on the leaderboard. Beat one by **0.01–0.05 s** and it counts. Beat it by more than
  0.05 s and it is **not ratified** (doesn't count).
- Relays: pass inside the exchange zone (highlighted in your lane). Green part = perfect pass; early or late
  passes cost speed; no pass by the end of the zone = fumble. Every leg starts with fresh stamina.

### Features
- **Animations on your own avatar** (R6 and R15, classic Motor6D or new AnimationConstraint joints, no
  uploads): crouch start ("on your marks" + "set"), block clearance, 45° drive phase that rises over the
  first 20–30 m, a keyframed top-speed cycle based on Usain Bolt / Noah Lyles sprint form (front-side
  mechanics, high knees, ~4.4 steps/s), lean into the bends, finish dip, braking jog, and celebrations —
  Bolt's lightning pose or Lyles' power-up (pick in Settings).
- **White & royal blue uniform** (toggle): singlet with T&F band, lane bib, name on the back, royal blue shorts.
  Relays add a baton in your hand.
- **"T&F" loading screen** before every race, which opens like doors.
- World: terrain grass, rolling hills, a lake, clouds, picket fence, oak and pine trees, flowers, flags,
  finish gantry with clock, LED timing board, red or blue track. No stadium.
- HUD: real race clock, live position, race progress strip with rivals, speed meter, rhythm bar, stamina,
  reaction time, splits, relay leg counter, speed lines, announcer captions.
- Settings: Event, **AFK** (skip races), Uniform, Track Colour, Camera (chase / side), Win Celebration,
  Announcer Voice, Performance Mode, key rebinding.
