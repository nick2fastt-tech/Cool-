# Cool-

Two single-file browser games. No build step, no dependencies to install —
open the `.html` file and it runs.

## 🩸 FightLight — `fightlight.html`

A mobile-first 3D last-man-standing arena brawler. Four fighters, one white
tiled room, whatever weapons are lying on the floor.

**18+ — extreme violence and gore.** There's a gore toggle in Settings.

### Playing

| | Touch | Keyboard / mouse |
|---|---|---|
| Move | Left thumb — drag anywhere in the lower-left | `W` `A` `S` `D` |
| Sprint | Push the stick past the ring | `Shift` |
| Look | Drag anywhere else | Mouse (click once to lock) |
| Attack | `ATTACK` | Left click / `F` |
| Jump | `JUMP` | `Space` |
| Crouch | `CROUCH` | `C` |
| Reload | `RELOAD` | `R` |
| Pick up | Tap the prompt | `E` |
| 1st/3rd person | `VIEW` | `V` |
| Stow / draw | Hotbar slots 1 and 2 | — |

### What's in it

- **Six weapons** — fists, knife, bat, pan, bottle and pistol, each with its
  own reach, swing arc, wind-up, knockback and stamina cost. The bottle
  shatters on its first hit and becomes a faster, nastier shard.
- **Real hit zones.** Eleven spheres per fighter: head 2.5×, torso 1×, limbs
  0.7×. The pistol loses damage over distance and walls stop bullets.
- **Free-for-all AI.** Three opponents who fight *each other*, not just you —
  they seek, circle, telegraph their swings, dodge yours, take cover behind
  the columns, run for a better weapon, and flee when they're nearly dead.
- **Movement with weight** — acceleration and friction, stamina, crouch,
  head bob, landing shock, fall damage, weapon sway and recoil.
- **Procedural everything** — the tiles, the blood, the bullet holes and every
  sound are generated at runtime. The audio runs through a convolution reverb
  built for a hard-tiled room.
- Cover, columns, crates and scattered weapon pickups that keep circulating
  as fighters drop them.
- Settings for sensitivity, invert-Y, aim assist, gore, quality and FOV, all
  persisted locally. Coins persist between matches.

### Fixed from the original build

The previous build threw on load, before it had registered a single input
handler — the menu markup rendered, but nothing on it responded and the canvas
stayed empty. These were the blockers:

- `createHumanModel()` returned `leftForearm` / `rightForearm`, but the locals
  were named `lForearm` / `rForearm`. That `ReferenceError` fired on the very
  first model, killing the rest of the script.
- The first-person camera used `camYaw + Math.PI` while movement used
  `camYaw`, so you walked backwards from wherever you were looking.
- **PLAY AGAIN** was dead: `startMatchmaking()` returned early unless the state
  was `MENU`, and the end-of-match state was never reset.
- AI damage rolled `Math.random() < 0.02` *per frame*, so a 120 Hz phone hit
  twice as hard as a 60 Hz one. All AI decisions are on real timers now.
- Blood droplets, gore chunks and decals were added to the scene and never
  removed or disposed. Everything is pooled and capped now.
- Vertical look was inverted, you were paid 15 coins for dying, and ammo,
  reload and hit-reaction offsets were never reset between matches.

### Test hooks

`window.FightLight.debug()` returns a snapshot of match state (fighters, HP,
weapons, effect counts, FPS) and `window.FightLight.give('bat')` puts a weapon
in your hand. They exist so the game can be driven from a headless browser.
Nothing is server-authoritative here, so they grant nothing that editing the
file would not.

### Rendering

Three.js r128, pulled from three CDN mirrors in turn so one outage can't
blank the screen. sRGB output, ACES filmic tone mapping, soft shadows, and an
adaptive pixel ratio that backs off if the framerate drops. The first-person
viewmodel renders in a second pass over a cleared depth buffer so the arms
never poke through a wall.

## 🕯️ The Last Candle — `horror.html`

A single-file horror game for mobile.

## Licence

See [LICENSE](LICENSE).
