# Cool-
Wow

## Track And Field (Roblox demo) — `TrackAndField.lua`

A Speed Stars style sprint game in **one script** (v5).

### Install
0. **Installed an older version before? Delete it first.** Look for an old LocalScript in
   StarterPlayer → StarterPlayerScripts (and any older Script in ServerScriptService). Two copies running
   together fight over your character. That fight is what made you jump forward while running. v5 also
   finds old copies and switches them off by itself, and shows "OLD VERSION FOUND" when it does.
1. Open Roblox Studio with an empty **Baseplate** place (the script builds its own world).
2. To **save progress**: publish the place and turn on
   Game Settings → Security → **Enable Studio Access to API Services**.
3. Explorer → **ServerScriptService** → insert a **Script**, paste all of `TrackAndField.lua`, press **Play**.
   The server half saves PBs and world records, runs the 40-yard dash line and puts the uniform on
   everyone. It copies itself to every player as the client half automatically.
4. The menu (top left) shows **TRACK AND FIELD v5**, so you can check that the new version is running.

No server access? Paste the same file into a **LocalScript** in StarterPlayer → StarterPlayerScripts instead.
Everything works, but nothing is saved and only you see the uniform.

### Events
60m, 100m, 200m, 400m, **4x100m, 4x200m, 4x400m** relays. Pick one in Settings → Event, or leave it on
"ALL (rotate)". Every event runs: semifinal → finalists screen → **final introductions** (each finalist's
username and semifinal time, lane by lane) → final → podium. An announcer calls the race in captions and,
where Roblox text-to-speech is available, out loud — including the winner's name.

**40-yard dash (optional):** a field on the grass with yard lines and cones. Walk to the blue pad and press
the prompt to join the line. If other players are waiting, you queue and the board shows the order. If it's
your turn mid-race, you keep your spot and go right after the race. It has its own world record.

### Controls
- Tap left / right in rhythm — **one tap every 0.3 s** holds top speed (no tap text on screen).
- **PC:** A / D (rebindable in Settings → Controls), Left / Right arrows, or left / right mouse click.
  Relays: **Space** (or W / Up) to pass. L = leaderboard, P = settings, C = camera.
- **Phone:** tap the left / right half of the screen.
- **Gamepad:** L1 / R1 (or L2 / R2, D-pad), A to pass.

### Rules
- Speed limits (studs/s): 60m 36.8, 100m 37.9, 200m 37.7, 400m 34.3 (relay legs use the same limits).
- Reaction time 0.02–0.05 s. Tapping during "Set" is a false start: the race restarts and your reaction
  becomes 0.15 s. A second false start is a disqualification.
- **Real race times:** the clock counts real seconds from the gun; official times are rounded up to the
  hundredth like real athletics (reaction time shown separately).
- **World records** live on the leaderboard. Beat one by **0.01–0.05 s** and it counts. Beat it by more than
  0.05 s and it is **not ratified** (doesn't count).
- **Relays:** nothing is painted on the track — only a **PASS** button appears near the exchange. It turns
  **green** in the perfect window. Your teammate takes off, you close in and hand over the baton, then you
  ease off in your lane while your teammate runs the next leg (you keep tapping for them). Early or late
  passes cost speed; no pass by the end of the zone is a fumble.

### Saving
- PBs and settings save per player.
- World records are shared by everyone in the game and **stay until another player beats them**.

### Features
- **No teleporting while you run:** your body is pushed down the lane by physics every frame (a
  LinearVelocity + AlignOrientation on your HumanoidRootPart), and the race distance comes from where your
  body actually is. Roblox's default controls or another script can't stop or snap you. (You're placed in
  your lane before the gun, behind the loading screen.)
- **Camera:** it swings around you (front → your side → behind at the gun, and back to the front at the
  finish), never through your body, and glides back to the normal camera after a race.
- **Bots on Track** toggle: see your rivals running beside you, or race alone.
- **Animations on your own avatar** (R6 and R15, classic Motor6D or new AnimationConstraint joints, no
  uploads): custom **idle** and **walk/jog**, crouch start, block clearance, a **20-frame drive-phase
  cycle** (45° lean, full extension at toe-off, low heel recovery), a **20-frame top-speed cycle** based on
  Usain Bolt / Noah Lyles form (touchdown under the hips, high front knee, heel folded under the hips,
  foot clawed back, big arm swing, a real flight phase), bend lean, finish dip, and **finish celebrations**
  (airplane jog into Bolt's lightning pose or Lyles' power-up, fist pump and point to the sky, hands on
  hips, hands on knees when tired). Baton exchange: the giver reaches forward, the taker reaches back.
  R6 legs follow the hip-to-foot line of the bent leg. Other players see Roblox's normal animations on you.
- **INDOOR ARENA button** (top right) — indoor map coming soon.
- **White & royal blue uniform** (toggle): singlet with royal side panels, collar, sash and crest, a race
  bib with safety pins and your lane number, your name on the back, royal half tights with white stripes and
  **hip numbers**, socks, spikes with white soles, and wristbands. With the server half, **everyone sees it**.
  Baton in hand for relays.
- **"T&F" loading screen** before every race, which opens like doors.
- World: terrain grass, hills, a lake, clouds, fence, trees, flowers, flags, finish gantry with clock,
  LED timing board, red or blue track. No stadium.
- HUD: race clock, position, progress strip, speed meter, rhythm bar, stamina, reaction time, splits,
  relay leg counter, announcer captions.
- Settings: Event, **AFK**, **Bots on Track**, Uniform, Track Colour, Camera (chase / side), Win Celebration,
  Announcer Voice, Performance Mode, key rebinding.

### Notes
- The sprint animations are drawn on your screen. Other players see Roblox's normal run animation on you.
  The uniform is seen by everyone when the server half runs.
- Voice needs Roblox text-to-speech; captions always show.
