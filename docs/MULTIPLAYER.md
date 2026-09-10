# Multiplayer

Co-op for 1-4 players on a dedicated authoritative server. Real WebSockets, one
shared simulation, no local fakery anywhere.

Two modes are built: **Co-op Survival** and **Free Roam**.

> **Status honesty.** Every line in the status tables below is either backed by
> an automated test that runs against a real server with real clients, or
> marked as untested/not implemented. Nothing is described as working because
> the code compiles.

## Running it

The server serves the game *and* the socket from one port, so a client always
connects back to wherever the page came from - no address to configure.

```bash
npm run build          # build the client into dist/
npm run server         # bundles + starts the server on :8787

# open http://<your-lan-ip>:8787 on every device
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | 8787 | HTTP + WebSocket port |
| `STATIC_DIR` | `dist` | Directory to serve the client from |
| `HOLLOW_TEST_START_POWER` | - | **Test only.** Start a match on this much power so a blackout is reachable in seconds |
| `HOLLOW_TEST_AI_LEVEL` | - | **Test only.** Override animatronic aggression |

The two test knobs are environment variables on the server. No client can set,
see or influence them.

The standalone `hollow-shift.html` has no origin to connect back to, so
multiplayer there needs an explicit server: `hollow-shift.html?server=ws://192.168.1.20:8787/ws`.
Opened without one, the multiplayer menu says so instead of failing silently.

## Architecture

```
   CLIENT (browser)                         SERVER (node + ws)
   ─────────────────                        ──────────────────
   MpScreens   menus, lobby                 main.ts    sockets, routing,
   MpHud       stick, buttons, shared state             rate limits, codes
   CoopScene   renders what the server says  room.ts   lobby, host role,
   NetClient   prediction + interpolation               match loop, migration
        │                                    matchSim.ts  THE GAME
        │  intents (20 Hz)                        │
        └──────────────────────────────────▶ applyInput / setInteract
                                                  │  fixed 30 Hz
        ◀────────────────────────────────────  snapshots (15 Hz) + events
```

**The client never owns anything.** It sends a movement vector and "I am
holding this thing"; the server decides where the player is and whether the
thing happened. `src/mp/matchSim.ts` is the entire game and it runs only on the
server. The one piece of shared code is `stepMovement`, which the client also
runs to predict its own motion - so prediction can never disagree with the
server about the rules, only about the timing.

**Prediction and interpolation.** Your own player moves the instant your thumb
does. Every input is kept until the server acknowledges it; each snapshot
rewinds you to the server's position and replays the unacknowledged inputs on
top, easing out small disagreements and snapping large ones. Everyone else is
drawn 120 ms in the past, interpolated between the two snapshots that bracket
that moment, which is what turns 15 Hz updates into continuous motion.

**Host migration is free** because the host is only a UI role - who may change
settings and press Start. The simulation belongs to the server, so a host
leaving mid-match does not interrupt it at all. The longest-connected remaining
player is promoted.

**Bandwidth.** A four-player snapshot is roughly 700 bytes of JSON at 15 Hz,
about 10 KB/s down and 2 KB/s up per client. Positions are rounded to
centimetres; only entities and objective state are sent, never geometry.

## Status against the spec

### Built and tested

| Feature | Where it is tested |
| --- | --- |
| Unlock after Night 1, saved locally | single-player suite + browser test uses the unlocked save |
| Host game with player count, difficulty, map, mode, public/private, ready requirement, aggression | `mp-protocol` (settings validation, host-only), `mp-browser` (real UI) |
| Join by code, sloppy input accepted (`7k2p` → `DEPOT-7K2P`) | `mp-protocol` |
| Quick join into an open public lobby | `mp-protocol` |
| Public match browser, private rooms hidden | `mp-protocol` |
| Every error case: invalid code, no such match, full lobby, already started, not host, not ready, wrong version, stale token | `mp-protocol` |
| Lobby: players, host, ready state, ping, status, live settings | `mp-browser` (4 clients agree) |
| Ready gate - start refused until everyone is ready | `mp-browser`, `mp-protocol` |
| Player cap enforced; a fifth player is refused | `mp-browser`, `mp-protocol` |
| Networked characters: position, rotation, sprint, crouch, torch, carried item, status | `mp-browser` (one client walks, others see it) |
| Client prediction + remote interpolation | `mp-browser` (walker and observers agree within 1.2 m) |
| Authoritative state: AI, power, objectives, timer, alive/dead, win/lose | `mp-protocol`, `mp-match` |
| Shared animatronics - one set, server-driven, same for everyone | `mp-browser`, `mp-match` |
| Multiplayer AI: patrol, investigate noise, chase, attack, back off, target selection by distance + noise + visibility + isolation + objective | `mp-match` |
| Free roaming with real collision, doorways, no wall clipping, no escaping the map | `mp-browser` (walks office → corridor → electrical room), `mp-protocol` (teleport/speed refused) |
| Shared power - one number for everyone | `mp-browser` (4 clients within 1.5%) |
| Blackout hits everyone simultaneously | `mp-browser` |
| Power restoration chain: reach the room → generator → 3 fuses → 3 breakers → two main switches held together → 10 s spin-up | `mp-match` (full chain, two clients) |
| A step completed by one player is seen by all | `mp-browser` |
| A dropped player's fuse returns to the map instead of soft-locking | `mp-match` |
| Torch battery drains, dies, needs a real charge to restart | `mp-match` |
| **Free Roam**: no clock end, no grid drain, exploration objective, escalating aggression, win by walking every room | `mp-match` (5 tests), `mp-browser` (hosted and played through the real UI) |
| Player down → bleed-out → revive by a teammate → elimination → spectate | `mp-match` |
| Whole crew down ends the match for everyone | `mp-match` |
| Match timer owned by the server | `mp-browser` (clients within 400 ms) |
| Disconnect: clean removal, match continues, no ghost collision | `mp-browser`, `mp-protocol` |
| Host disconnect → migration, match uninterrupted | `mp-browser`, `mp-protocol` |
| Reconnection: same slot, same body, no duplicate | `mp-browser` (page reload), `mp-protocol` |
| Session takeover when a reload beats its own close event | `mp-protocol` |
| Held slots are not handed to new players during the grace window | `mp-browser` |
| Validation: interaction distance, movement speed, inflated `dt`, stale/out-of-order input, settings, host-only actions | `mp-protocol` |
| Rate limiting: bursts throttled, sustained floods dropped | `mp-protocol` |
| Network errors surfaced with a way back to the menu; auto-reconnect with backoff | implemented; the reconnect path is exercised by the browser test |
| Debug overlay: ping, snapshot rate, tick, ids, positions, drift, AI states, objective, power | hidden unless `?debug=1` or three taps on the clock |

Test counts as of this commit: **58 automated tests** (`npm test`) plus a
**26-check four-client browser run** (`npm run smoke:mp`).

### Implemented but NOT tested here

- **Real-world mobile networks.** Reconnect, interpolation and input clamping
  are built for latency and drops, and the suite covers a two-second stall,
  out-of-order input and a socket takeover - but nothing has been run over an
  actual cellular link with real packet loss. Untested on real hardware.
- **More than four players.** The cap is 4 deliberately: that is what has been
  tested. The architecture has no four-player assumption in it, but the number
  stays until a bigger session has actually been run.
- **Server at scale.** One process, in-memory rooms, no persistence. Fine for a
  handful of lobbies; nothing here has been load-tested.

### NOT IMPLEMENTED YET

- **Objective Mode and Night Survival.** Both appear in the host settings as
  locked, selecting one says `NOT IMPLEMENTED YET`, and the server refuses the
  mode even if a client asks for it directly.
- **A second map.** The map selector exists with one entry (`depot`) so adding
  another is a data change, but there is only one.
- **Voice or text chat.** Neither is built, and the protocol no longer carries
  a placeholder for them.
- **Friends list / invites beyond the join code.** There is no account system,
  so "join friends" is the code, quick join, or the public list.
- **Anti-cheat beyond server authority.** Every gameplay-relevant action is
  validated server-side and clients cannot move themselves, but there is no
  behavioural detection or reporting.

## The two modes

### Co-op Survival

Survive 12 AM to 6 AM. The shared grid drains the whole time, and when it hits
zero the whole crew has to bring it back: reach the electrical room, start the
generator, find and fit three fuses, reset three breakers, then hold **both**
main switches at once - one in the electrical room, one in the office. Each
blackout pays back less than the last.

### Free Roam

No clock to survive to, and the grid does not drain - the building is not the
threat here, the cast is. The objective is the map itself: walk all fourteen
rooms. Every new room you open, and every minute you stay, raises how much
attention the crew attracts (shown in the HUD as `FREE ROAM x1.4`), capped at
2.4x. Walking the whole building wins; losing the whole crew loses.

That escalation is the whole design: in survival the pressure is a number
draining on a wall, in free roam the pressure is your own curiosity.

## Test-only knobs, and why they are honest

Two conditions in this game are slow to reach by playing: a blackout takes
minutes of power drain, and being caught depends on an animatronic finding you.
The browser test sets the server's starting power and aggression through
environment variables, and the match-behaviour tests move a bot next to a
player inside the *server's own* simulation before letting it decide what to
do.

That is staging, not faking: the chase, the attack decision, the revive timer,
the objective chain and the network path all execute for real, and every
assertion is made on what a *different* client receives.
