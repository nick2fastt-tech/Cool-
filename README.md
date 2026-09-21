# Cool-

Two single-file browser games. No build step, no dependencies to install —
open the `.html` file and it runs.

## 🩸 FightLight — `fightlight.html`

A mobile-first 3D arena brawler in two levels. Four fighters, one white tiled
room, whatever weapons are lying on the floor — and then whatever comes in
afterwards to clean up.

**18+ — extreme violence and gore.** There's a gore toggle in Settings.

### Playing

Two controls on screen: the stick and the attack button. Everything else is
automatic or lives in Settings.

| | Touch | Keyboard / mouse |
|---|---|---|
| Move | Left thumb — drag anywhere in the lower-left | `W` `A` `S` `D` |
| Sprint | Push the stick past the ring | `Shift` |
| Look | Drag anywhere else | Mouse (click once to lock) |
| Attack | `ATTACK` | Left click / `F` |
| Pick up / sit | Tap the prompt | `E` |
| Reload | automatic when empty | `R` |
| Camera | Settings → Camera | `V` |
| Jump | — | `Space` |
| Crouch | — | `C` |

Jump and crouch are keyboard-only by design: the brief was a stick and an
attack button and nothing else, so on touch you go around the blocks rather
than over them.

### Two levels

**Level 1 — the room.** Four people in identical uniforms, whatever is lying
on the floor, last one standing.

**Level 2 — the risen.** Clear the room and you do not get to leave. Three
things walk in, ignore you completely, and squat down to eat the people you
just killed. You get **ninety seconds** while they are busy. At sixty seconds
the bodies on the floor start going pale. At zero, every one of them gets up —
eyes shut, head turning to find you first — and then you have to put down
everything in the room again.

While they eat you can watch them pull the bodies apart — pieces come away,
and the corpse is visibly missing them afterwards.

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
- **Wounds that stay open.** Blades cut, bullets punch an entry hole, blunt
  weapons bruise. A hit to an arm, a knee or the neck opens an artery close to
  the surface, so those *spray* — in bursts, fast, for seconds. Everything else
  weeps and then drips. Bleeding drains you and slows you down before it kills
  you, and heavy hits take limbs off.
- **Blood gets on you.** Stand near something bleeding out, or take a hit
  yourself, and it goes across the screen and runs down.
- **Gore with anatomy** — flesh, gut, intestine, brain, bone and skin each
  have their own shape and material, so a pile of it reads as a body rather
  than red gravel. Weapons stain as you use them.
- **Faces, sculpted and painted.** Stacking lumps onto a ball gives you warts,
  not a person, so the two halves of a face are built separately. Everything
  that is really a change of *shape* — brow ridge, nose, cheekbones, jawline,
  chin, eye sockets — is sculpted into the head mesh itself. Everything that is
  really a change of *colour* — eyes, brows, lips, stubble, the shadow under a
  cheekbone — is painted into one skin map. Both are addressed by the same pair
  of angles, so a painted iris always lands inside its sculpted socket. The
  eyelids, the jaw and the hair are patches of that same sculpted surface, so
  none of them can float or crease. The hairline is the *alpha* of the hair
  map, which is why it can have a peak, receding temples and loose strands past
  the edge instead of being a bowl.
- **A jaw that opens.** The lower face is a separate patch of the same surface
  on a hinge, so an open mouth is a real hole in the head rather than a black
  sticker on the front of it.
- **The risen** have torn uniforms — a hole over the ribs, fabric hanging in
  strips, one sleeve gone entirely, frayed hems — sunken cheeks, a cheek torn
  open to the teeth, bare skull at the temple, and light green eyes that glow.
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
- **Weapons with a surface.** Scratched gun steel, moulded polymer stipple,
  wood grain with knots, sand-cast iron and polished blade stock, all generated
  at runtime, so the detail already in the shapes has something to catch the
  light. Both hands have fingers that wrap the grip.
- **Procedural everything** — the tiles, the blood, the bullet holes and every
  sound are generated at runtime. The audio runs through a convolution reverb
  built for a hard-tiled room.
- **White blocks.** The room's only furniture. Tall ones break line of sight
  outright, mid ones are crouch cover, low ones you can vault onto. Bullets
  and swings both stop at them.
- Scattered weapon pickups that keep circulating as fighters drop them.
- Settings for sensitivity, invert-Y, aim assist, gore, quality and FOV, all
  persisted locally. Coins persist between matches.

### Later fixes

- **Faces were a pile of warts.** The head was an ellipsoid with cheekbones,
  masseters, a brow bar, nostrils and eyeballs bolted onto it, and the eyes
  bulged straight through the skin. Rebuilt as a sculpt plus a painted map;
  see *Faces* above.
- **Hairline cracks down the face.** The head is cut into a cranium, a jaw and
  the back of the jaw. Their grids have to line up tooth for tooth — give two
  neighbours a different number of segments along an edge they share and every
  mismatched vertex is a T-junction. One azimuth step is now fixed for the
  whole head and every piece is cut from it. Normals are sampled straight off
  the surface function rather than averaged from the triangles, so neighbouring
  patches agree exactly and the joins vanish.
- **A rigid eyelid cannot slide across a face.** The socket is a hollow and the
  brow is a ridge, so a cap swept over them either floated as a slab or sank
  out of sight. Each lid is now built twice — open and shut, each on the
  surface it has to sit on — and morphed between the two.
- **Blood on the lens drowned the frame.** It peaked at 0.92 opacity in
  multiply, which is a red filter, not a splatter.
- **Everyone faced and walked backwards.** The rig is modelled facing `+Z` —
  eyes, nose, shirt placket and chest pocket all at positive Z — but gameplay
  forward is `-Z`, and the root was rotated by plain `yaw`. Every fighter in
  the game was moonwalking. The root now takes `yaw + π`.
- Both knees bent backwards (positive X swings a limb *back* on this rig).
- Everyone is 100 HP now, the player included.
- Matchmaking no longer makes you watch a fake lobby fill up.

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
in your hand. `dev()` fast-forwards the parts that otherwise take ninety
seconds to reach — `dev('killEnemies')`, `dev('feed', 3)`, `dev('sit')` — and
`dev('freeze', 1)` plus `dev('portrait', { i: 2, ang: 40, dist: 0.42 })` park
the camera on one fighter's face so a change to the head can be eyeballed from
a screenshot. They exist so the game can be driven from a headless browser.
Nothing is server-authoritative here, so they grant nothing that editing the
file would not.

### The menu

Black and electric blue, with a drifting grid behind it. Every button
crackles when you press it — a ring, a bloom under your finger and arcs
firing out from the contact point, with a matching sound.

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
