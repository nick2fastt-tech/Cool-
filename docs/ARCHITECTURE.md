# Architecture

NovaVerse is a modular, event-driven client with an authoritative multiplayer
server. There is **no build step** for the client — it ships as ES modules that
run directly in the browser and inside the Capacitor Android WebView.

## Guiding principles

1. **Modular subsystems.** Each concern (engine, input, economy, net…) lives in
   its own folder and exposes a small surface. Nothing reaches across layers.
2. **Communicate through events + a single state store.** Systems emit and
   listen on a shared `EventBus` and read/write persistent data through
   `GameState`. This keeps UI, gameplay, and networking decoupled — e.g. the HUD
   never imports a game mode; it just listens for `hud:update`.
3. **Server authority.** Clients send intent; the server validates and
   broadcasts corrected snapshots. Anti-cheat lives server-side.
4. **Mobile-first performance.** Fixed-timestep simulation, adaptive quality,
   instancing, pooling, and interpolation are baked into the core.

## Core singletons (`src/core`)

| Module | Role |
| --- | --- |
| `Config.js` | All tunables (physics, camera, graphics, economy, net). |
| `Engine.js` | Three.js renderer, fixed-timestep loop, adaptive quality tuner. |
| `Physics.js` | Capsule-vs-AABB collision world with triggers + ground heightfield. |
| `EventBus.js` | Pub/sub hub (`bus`). |
| `GameState.js` | Single source of truth for all saved data; debounced local + cloud save. |
| `Storage.js` | Persistence abstraction (localStorage, in-memory fallback). |
| `Logger.js` | Tagged, level-based logging. |

## The game loop

```
requestAnimationFrame → Engine._loop(dt)
  ├─ fixedUpdate(FIXED_DT)   ×N   → physics, gameplay, moving platforms, AI
  ├─ update(dt)                    → camera, animation, interpolation
  ├─ lateUpdate(dt)                → follow cameras, post effects
  └─ renderer.render(scene, cam)
  └─ FPS sampler → auto quality up/down
```

Systems register with `engine.addSystem(obj)` and implement any of
`fixedUpdate`, `update`, `lateUpdate`.

## Data flow example — earning a checkpoint

```
ObbyGame trigger fires
  → Currency.add()  → GameState.patch('coins')  → bus 'coins:changed'
  → HUD.refreshWallet() updates the coin chip
  → Achievements.evaluate() (listening on 'coins:changed') may unlock + notify
  → GameState debounced-saves locally and pushes to the cloud provider
```

No system called another directly; the bus + state store wired it all.

## Worlds & games (`src/games`)

`GameManager` keeps exactly one active *world* (the `Lobby` hub or a game mode
extending `BaseGame`). Every world owns its meshes and colliders and disposes
them on switch, so memory and physics never leak between sessions. Portals in
the lobby are physics triggers that emit `portal:enter`.

## Networking (`src/net` + `server/`)

- `Protocol.js` is **shared** by client and server so the wire format can't
  drift.
- The client sends its state at 20 Hz; the server re-broadcasts authoritative
  snapshots which the client renders ~100 ms in the past, interpolating between
  the two straddling snapshots (`Snapshot.js`).
- The server (`Room.js`) validates every move through `AntiCheat.js` (speed
  clamp, bounds, chat rate-limit) before it becomes part of a snapshot.
- Reconnect uses exponential backoff and a resume token; the game degrades
  gracefully to single-player if no server is reachable.

## UI (`src/ui`)

A tiny hyperscript helper (`dom.js`) builds screens declaratively — no framework.
`UIManager` handles navigation, toasts, and modals and toggles gameplay input as
menus open/close. The in-world `HUD` is created once and shown/hidden.
