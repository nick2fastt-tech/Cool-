# NovaVerse 🌌

**An original mobile sandbox game platform inspired by Roblox** — a 3D social lobby
with teleport portals into four playable game modes, avatar customization, an
economy, and real-time multiplayer. Built from scratch with **Three.js** for
rendering and **Node.js + WebSocket** for authoritative multiplayer, packaged for
**Android** with **Capacitor**.

> NovaVerse contains **no Roblox assets, branding, code, or trademarks**. All art
> is generated procedurally from primitives; all systems are original.

---

## ✨ What's here

| Area | Status |
| --- | --- |
| 3D engine (renderer, fixed-timestep loop, adaptive quality) | ✅ Functional |
| Touch controls (floating joystick, jump/sprint, camera drag, pinch-zoom, haptics) | ✅ Functional |
| Procedural avatar + customization + procedural animation (idle/walk/run/jump/emote) | ✅ Functional |
| Day/night cycle, dynamic shadows, sky, clouds, water, particles | ✅ Functional |
| Account, username creation, local + cloud save (pluggable), profiles, friends | ✅ Functional |
| Economy: coins, XP/levels, achievements, daily rewards, inventory/shop | ✅ Functional |
| Social: public chat, private messages, notifications, invites/deep links | ✅ Functional |
| Full UI suite: loading, login, home, friends, profile, inventory, shop, settings, notifications, leaderboard | ✅ Functional |
| Multiplayer: authoritative server, rooms, matchmaking, anti-cheat, interpolation, rejoin | ✅ Functional core |
| **Obby** game (checkpoints, lava, moving platforms, trampolines, boosts, difficulty ramp) | ✅ Fully playable |
| **Survival** (health/hunger, gathering, building, night enemies) | ✅ Playable core |
| **Racing** (tracks, laps, nitro, best-lap leaderboard, vehicles) | ✅ Playable core |
| **Battle Arena** (weapons, health, respawn, FFA/team, timer, scoreboard, kill FX) | ✅ Playable core |

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for an honest breakdown of what is
complete versus where the marked extension points are.

---

## 🚀 Quick start (play in a browser)

```bash
npm install          # installs three (dev convenience; see note below)
npm start            # serves the client at http://localhost:5173
```

Open the URL on desktop (WASD + mouse drag) or a phone on the same network.

> **Note on Three.js:** for fast iteration the client loads Three from a CDN via
> the import map in `index.html`. For an **offline Android build you vendor it
> locally** — see [`docs/BUILD_ANDROID.md`](docs/BUILD_ANDROID.md).

### Run multiplayer

```bash
cd server
npm install
npm start            # ws + http on :8080
```

Then open the client with `?server=ws://localhost:8080`, e.g.
`http://localhost:5173/?server=ws://localhost:8080`. Open it in two tabs to see
players synchronise. With no server reachable the game runs single-player.

---

## 📱 Android

NovaVerse targets **60 FPS on mid-range Android** via an adaptive quality tuner
(auto-scales resolution + shadows), instanced scenery, pooled particles, a cheap
collision model, and 20 Hz networking with client interpolation.

Build an APK with Capacitor — full steps in
[`docs/BUILD_ANDROID.md`](docs/BUILD_ANDROID.md).

---

## 🗂️ Project layout

```
index.html              # entry point + import map + boot loader
capacitor.config.json   # Android packaging config
src/
  core/       Engine, Physics, EventBus, Storage, GameState, Config, Logger
  graphics/   Lighting, Sky, DayNightCycle, Particles
  input/      TouchControls, Joystick, Vibration
  player/     Avatar, Animations, PlayerController
  account/    AccountSystem, CloudSave, Friends
  economy/    Currency, Leveling, Achievements, DailyRewards, Inventory
  social/     Chat, Notifications, Invites
  net/        Protocol (shared), NetworkClient, Snapshot (interpolation), Matchmaking
  world/      Environment, Lobby
  games/      GameManager, BaseGame, obby/, survival/, racing/, arena/
  ui/         UIManager, styles.css, screens/, components/ (HUD)
server/       Authoritative multiplayer server (server.js, Room, Matchmaker, AntiCheat)
tools/        dev-server.js (static dev server)
docs/         ARCHITECTURE, BUILD_ANDROID, GAMEPLAY, ROADMAP
```

Architecture details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
How to play each game: [`docs/GAMEPLAY.md`](docs/GAMEPLAY.md).

## 📄 License

MIT — see [`LICENSE`](LICENSE).
