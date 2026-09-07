# Roadmap

Each milestone ships something playable. Nothing moves forward until the
previous milestone's tests pass.

## M1 - Single player - DONE

Project setup, the building, the office, cameras, doors and lights, power,
blackout and the hand-crank recovery, five animatronic behaviours, six nights
with escalation, jumpscare and game over, 3D main menu, save system, mobile
touch controls, four graphics presets, settings.

Verified by 22 unit tests, a 480-night balance sweep and a 20-check browser
smoke run.

## M2 - Feel and polish

The pass that turns a working game into one worth playing twice.

- Idle animation on characters (head tracking, breathing, subtle sway).
- Per-character jumpscare choreography instead of one shared lunge.
- Camera-feed grain, rolling sync bars and per-camera lens character.
- Reactive audio mix: sub-bass swell when someone reaches a doorway.
- 6 AM sequence: the bell, the crew walking back to the stage, a payslip.
- Accessibility: a low-scare mode that cuts the flash and the loud spike, a
  colour-blind-safe HUD palette, and remappable button positions.

## M3 - Content

- Night 7 with player-set aggression per character (the classic custom night).
- Two additional shifts with a different room layout.
- Unlockables in Extras tied to real feats, not grinding.
- More easter eggs on the rare-event system that HUSK already uses.

## M4 - Co-op free roam (the big one)

The mode the menu already unlocks after Night 1.

**Shape.** 2-4 guards, free movement through the same building, no office to
hide in. Shared power grid. The cast roams and hunts rather than pathing to a
single point.

**Server.** Node + `ws`, server-authoritative. The server runs the same
`NightSession` simulation with no renderer attached - the rules are not
reimplemented. Clients send intents (move, interact, crank) and receive
snapshots at 15 Hz with client-side interpolation; the client predicts only its
own movement.

**Work required, in order:**
1. Thicken the building into a navigable mesh with collision (the layout and
   the room anchors are already built for it).
2. First-person walk controller with a mobile stick, plus hiding spots.
3. Extract the AI into a roaming variant: search patterns, line of sight,
   sound attraction, chase with a real escape chance.
4. Objectives: restore the breakers, find the fuse, hold two switches at once -
   the kind that force the group to split up and regret it.
5. Netcode: lobby, host player-count choice, join codes, disconnect handling,
   reconnect into a running shift, server-side validation of every intent.
6. Blackout in co-op: the same crank mechanic at fixed breaker panels, cranked
   by one player while the others cover them. Torches exist here and have
   batteries; they are never infinite.

**Rule:** none of this touches single player. The office game is finished and
stays finished.

## M5 - Store packaging

- Capacitor shells for Android and iOS over the same bundle.
- Native haptics, audio focus and lifecycle handling.
- Store listings, age rating, privacy policy (the game collects nothing).
- A device performance pass on real mid-range hardware - the numbers in
  ARCHITECTURE.md are budgets, not measurements from a phone.

## M6 - Live

- Crash and performance telemetry, opt-in.
- Balance updates driven by real completion rates per night.
- Seasonal events on the rare-event system.
