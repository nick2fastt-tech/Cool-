# Cool-

Two single-file browser games. No build step, no dependencies to install —
open the `.html` file and it runs.

## 🩸 FightLight — `fightlight.html`

A mobile-first 3D arena brawler in two levels. Four fighters, one white tiled
room, whatever weapons are lying on the floor — and then whatever comes in
afterwards to clean up.

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
| Pick up / sit | Tap the prompt | `E` |
| 1st/3rd person | `VIEW` | `V` |
| Stow / draw | Hotbar slots 1 and 2 | — |

### Two levels

**Level 1 — the room.** Four people in identical uniforms, whatever is lying
on the floor, last one standing.

**Level 2 — the risen.** Clear the room and you do not get to leave. Three
things walk in, ignore you completely, and squat down to eat the people you
just killed. You get **ninety seconds** while they are busy. At sixty seconds
the bodies on the floor start going pale. At zero, every one of them gets up —
eyes shut, head turning to find you first — and then you have to put down
everything in the room again.

There is also a beach chair. You can sit in it and watch. Do not get attached
to the beach chair.

### What's in it

- **Inventory.** Pick your loadout from the main menu — bat, pan, knife or
  pistol — with a rotating 3D preview and stat bars. It is what you walk in
  with, and it persists.
- **Seven weapons** — fists, knife, bat, pan, bottle, pistol and the claws the
  risen come with, each with its own reach, swing arc, wind-up, knockback and
  stamina cost. The bottle shatters on its first hit into a faster, nastier
  shard.
- **Wounds that stay open.** A blade opens the body part it actually landed
  on. That part sprays, then weeps, then keeps dripping down the leg and onto
  the floor until they bleed out. Heavy hits take limbs off.
- **Real hit zones.** Eleven spheres per fighter: head 2.5×, torso 1×, limbs
  0.7×. The pistol loses damage over distance and walls stop bullets.
- **Free-for-all AI.** Three opponents who fight *each other*, not just you —
  they seek, circle, telegraph their swings, dodge yours, break line of sight
  behind the blocks, run for a better weapon, and flee when they're nearly dead.
- **A real walk cycle.** The gait is driven by distance travelled, not time,
  so feet never skate: heel strike, loading response, mid-stance, toe-off,
  swing. The pelvis bobs twice per cycle and sways once, the chest
  counter-rotates against the hips, and the head is stabilised against both.
- **Movement with weight** — acceleration and friction, stamina, crouch,
  head bob, landing shock, fall damage, weapon sway and recoil.
- **Procedural everything** — the tiles, the blood, the bullet holes and every
  sound are generated at runtime. The audio runs through a convolution reverb
  built for a hard-tiled room.
- **White blocks.** The room's only furniture. Tall ones break line of sight
  outright, mid ones are crouch cover, low ones you can vault onto. Bullets
  and swings both stop at them.
- Scattered weapon pickups that keep circulating as fighters drop them.
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
- Both knees bent **backwards**. The rig faces +Z, so a positive X rotation
  swings a limb back; the old code flexed knees with a negative angle.

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
