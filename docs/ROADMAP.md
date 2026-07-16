# Roadmap & honest scope

This document is deliberately candid about what is complete versus where the
codebase provides a working foundation with clearly-marked extension points. A
true Roblox-scale platform is a multi-year effort for a full studio; NovaVerse is
a genuine, runnable base with real (not stubbed) core systems.

## Complete & functional

- **Engine**: renderer, fixed-timestep loop, adaptive quality tuner, resize/DPR
  handling.
- **Physics**: capsule-vs-AABB collisions, triggers, moving-platform colliders,
  ground heightfield.
- **Controls**: floating joystick, jump/sprint, camera drag, pinch-zoom, haptics,
  customization, desktop fallback.
- **Avatar**: procedural humanoid, live customization, procedural animation
  (idle/walk/run/jump/emotes).
- **Graphics**: day/night cycle, dynamic shadows, gradient sky, drifting clouds,
  animated water, instanced trees/rocks/mountains, pooled particles.
- **Persistence**: single state store, debounced local save, pluggable cloud
  provider (Local + REST) with merge-on-login.
- **Accounts/social**: username creation, profiles, friends + presence, chat +
  DMs, notifications, invites/deep links.
- **Economy**: coins, XP/levels, achievements engine, daily rewards, inventory +
  shop.
- **UI**: loading, login, home, friends, profile, inventory, shop, settings,
  notifications, leaderboard, in-game HUD.
- **Multiplayer**: authoritative WS server, rooms, REST matchmaking, anti-cheat
  (speed/bounds/chat), 20 Hz snapshots + client interpolation, reconnect/rejoin.
- **Obby**: fully playable end-to-end.

## Playable core, with marked extension points

Each game below has a real, playable loop. `NOTE:` comments in the source mark
where to deepen it.

- **Survival** — has health/hunger, gathering, building, and night enemies.
  *Extend:* a real crafting tree, more mob types, persistent shared bases over
  the network.
- **Racing** — has tracks, ordered-gate lap detection, nitro, best-lap saving,
  and selectable vehicles. *Extend:* true wheeled-vehicle physics (steering
  geometry, drift, suspension) in place of the shared character controller.
- **Battle Arena** — has weapons, health, respawns, FFA/team, a match timer, a
  scoreboard, and kill effects, driven by AI combatants. *Extend:* server-side
  authoritative hit validation so the same loop runs as networked PvP (the
  raycast path is already isolated for this).

## Backend maturity

The server is a real authoritative simulation suitable for small rooms. For
production scale, add: signed resume tokens/auth, a persistent DB behind the
cloud-save REST provider, horizontal room sharding, and region-based
matchmaking (the `region` field is already plumbed through the protocol).

## Art

All visuals are procedural primitives so the project is asset-free and
copyright-clean. Swap in real GLTF models/textures by replacing the builders in
`src/player/Avatar.js` and `src/world/Environment.js` — no other code changes.
