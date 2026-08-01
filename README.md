# Cool-

A collection of single-file HTML5 mobile games. Each game is one self-contained
document — no build step, no bundler, no external assets. Open the file and play.

| Game | File | About |
|------|------|-------|
| **Zombie Attack** | [`zombie-attack.html`](zombie-attack.html) | 3D endless-wave survival shooter with co-op |
| **The Last Candle** | [`horror.html`](horror.html) | Top-down horror maze — find 3 keys before your candle dies |

---

## 🧟 Zombie Attack

An endless-wave zombie survival shooter for phones, inspired by the Roblox game
of the same name. Blocky characters, a third-person camera, 34 weapons, and a
horde that never stops getting worse.

**Play it:** open `zombie-attack.html` in a mobile browser. That's the whole
install. Solo works completely offline.

### The loop

Spawn into a lobby, gear up, then drop into a match. A countdown runs, zombies
pour in from marked spawn points around the map, and you clear the wave to earn
coins and XP. Every wave is bigger and meaner; every 5th wave is a boss. It ends
when the horde finally gets you — then you spend what you earned and go again.

### What's in it

**Combat**
- 34 weapons across pistols, SMGs, assault rifles, shotguns, snipers, LMGs,
  explosives, lasers and futuristic tech, on a Common → Legendary rarity ladder
- Full stat lines: damage, fire rate, reload, magazine, range, recoil, spread,
  crit multiplier, pellets — with derived sustained DPS shown in the shop
- Hitscan and projectile weapons, piercing rounds, chain lightning, cluster
  munitions, burn/slow/gravity-well riders, minigun spin-up
- Per-limb hit detection with **headshot bonus damage**, muzzle flashes, ejected
  shell casings, tracers, impact effects and floating damage numbers
- Two-weapon loadout with fast switching, auto-reload, optional aim assist and
  auto-fire tuned for touchscreens

**The horde**
- 16 zombie types — walkers, crawlers, runners, leapers, tanks, armored, bombers,
  spitters, volt, burners, frosters, screamers, phantoms, giants, toxic brutes
  and frostbites — each with its own colours, silhouette, sounds and abilities
  (ranged spit, leaps, blink, self-detonation, damaging auras, horde buffs)
- 6 bosses with unique attack sets: ground slam, summon, charge, frost nova,
  fire wave, chain lightning, poison pools and teleport, plus an enrage below 40% HP
- Flow-field pathfinding so the horde routes around buildings instead of
  bunching on walls, with local separation steering

**Progression**
- Coins and XP from kills and cleared waves; levels on a smooth `100·N^1.55` curve
- Daily login streak, 3 daily missions, 3 weekly challenges, 16 achievements
- Pets: 15 species with rarity, a duplicate-fed upgrade system to level 10, and
  bonuses to damage, speed, coins, XP, reload, health and luck — some shoot
- Reward crates, egg hatching, weapon skins, outfits, hats, accessories, emotes
- Rotating seasonal events with limited-time zombie variants and reward tiers
- Leaderboards for wave, kills, coins and level, plus a friends list
- Auto-save after every completed wave

**Feel**
- Custom WebGL2 renderer: instanced geometry, dynamic sun shadows, point lights
  from muzzle flashes and explosions, fog, and a procedural sky
- 5 maps (Suburbia, Military Outpost, Frozen Depot, Desert Ruins, Factory
  Grounds) with random selection, and day / sunset / night / storm weather
  with rain and lightning
- Destructible barricades you can repair and shoot over, explosive barrels,
  crates to climb
- All audio is synthesised at runtime with WebAudio — weapon reports per class,
  reload clicks, zombie groans, explosions and a layered score that tracks
  the intensity of the wave. No audio files.
- Quality presets plus an auto mode that adapts to your frame rate

**Accessibility & options**
Look sensitivity, invert Y, joystick deadzone, left-handed layout, aim assist,
auto-fire, auto-reload, haptics, shadow and particle levels, frame-rate cap,
FPS counter, reduced flashing, high-contrast crosshair, damage-number toggle,
HUD scale, and separate music/SFX volume.

### Controls

| Action | Touch | Keyboard |
|---|---|---|
| Move | Drag the left half of the screen | `WASD` / arrows |
| Look | Drag the right half | drag mouse |
| Fire | 🔫 button | `Space` |
| Reload | 🔄 button | `R` |
| Swap weapon | 🔁 button | `Q` |
| Jump | ⤴ button | `X` |
| Sprint | 🏃 button | `Shift` |
| Interact / revive | ✋ button | `E` |
| Pause | ❚❚ button | `Esc` |

---

## 🌐 Co-op multiplayer

Co-op is host-authoritative: one player's browser simulates the zombies, waves
and damage, and streams snapshots to everyone else. Clients predict their own
movement and report hits, which the host re-validates — the host enforces fire
rate, damage ceilings, weapon ownership, range and movement-speed limits, and
kicks peers that keep failing those checks.

There are two ways to play together.

### 1. Same device, no server

Works out of the box. Open `zombie-attack.html` in two browser tabs, host a
public server in one and join it from the other. Rooms are advertised through
`localStorage` and traffic runs over a `BroadcastChannel`. Good for testing and
for split-screen-style play on a tablet.

### 2. Real online play (optional relay)

For co-op across devices and the internet, run the included relay:

```sh
npm install ws
node server/relay.js            # listens on ws://localhost:8787
PORT=9000 node server/relay.js  # or pick your own port
```

Then in the game: **Settings → Online → Relay server URL**

```
ws://192.168.1.50:8787      # same Wi-Fi network
wss://relay.example.com     # public, behind a TLS reverse proxy
```

With a relay configured you also get the public server browser, cloud saves
(progress follows your profile across devices) and a shared leaderboard.

The relay only routes JSON between members of a room — it never simulates the
game, so it stays cheap to host. It does enforce the things a public endpoint
needs: message size caps, per-connection rate limits, room capacity, payload
validation and idle-room reaping. `GET /health` returns room and player counts.

Private servers are code-only (a 5-character join code); public servers appear
in the in-game browser. Up to 4 survivors per match, and teammates who go down
can be revived before they bleed out.

---

## Requirements

**WebGL2** — Android Chrome 58+, iOS Safari 15+, and any current desktop
browser. The game detects a missing context and says so rather than failing
silently. It targets 60 FPS on mid-range phones; the auto quality setting steps
resolution, shadow-map size and particle budget up or down to hold that.

The relay server needs Node 18+ and the `ws` package. Nothing else in this
repository has dependencies.

## License

See [LICENSE](LICENSE).
