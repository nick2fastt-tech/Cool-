# HUMAN TEST 3D

A 3D human physics sandbox that runs in any modern browser on PC and mobile.
The whole game ships as one file: [`../HumanTest3D.html`](../HumanTest3D.html). Open it directly; no server or install needed.

All humans, textures, sounds and environments are generated procedurally at load time. Nothing is downloaded.

## Features

- **Loading screen**: progress for each system (models, textures, shaders, animations, physics, sound, weapons, environment), rotating tips, then starts on its own.
- **Simple UI**: a **Sandbox** menu, a **Settings** menu, and a weapon bar you tap or click to equip.
  - *Sandbox*: Spawn Male / Spawn Female (each person gets a random body, height, face and outfit), Spawn Vampire / Zombie / Chucky / Jason, weapon cards, zombie, vampire and horror switches, world (room, field or subway; time of day and weather on the field), and scene controls (pause, slow motion, clear bodies, reset).
  - *Settings*: gore level, graphics, audio, controls, gameplay and on-screen info.
- **Three environments**
  - *White Testing Room*: a clean white room with large wall panels, skirting boards, framed ceiling lights, soft corner shading, a measurement grid and spawn markers.
  - *Sunny Grassy Field*: a flat open test area surrounded by rolling hills; meadow grass with lush and dry patches, flowers and wind gusts; grass that flattens under bodies; clusters of broadleaf trees, conifers and bushes with a distant tree line; sky-lit ambient light, a real sun path, a hazy horizon, and clear, cloudy, overcast, rain or fog weather.
  - *Atlantic Av–Barclays Center (Brooklyn)*: a connected subway complex on several levels. Street level has Atlantic Av and Flatbush Av, the arena with its weathered-steel bands and oculus canopy, and the green-roofed entrance pavilion with its globes and line bullets. Stairs and an escalator lead down to the fare mezzanine (turnstiles, vending machines, booth). From there, stairs go down to the 2 3 4 5 platform (green columns, glass-block wall, tactile edge), and a white-tiled passageway with art panels and signs leads to the B Q platform. NYC-style trains arrive, line up with the platform, open and close their doors with the chime, and leave; express trains rush through on the far tracks. Station hum, train sounds and spoken announcements (where the browser supports speech). People walk between the levels through the turnstiles and stairs; walls, platforms and fixtures are solid, and bodies can fall onto the tracks.
  - *All*: soft contact shadows under feet, bodies and objects; ragdolls settle and come to rest.
- **Animation**: walking and running driven by real gait data: heel strike, foot roll, knee bend in swing, pelvis rotation, arm swing, and a flight phase when running. Zombies have nine gait styles (shambler, reacher, limper, lurcher, runner, drunk, dragger, crawler, twitcher), each with its own timing, head turns, shoulder roll, independent arms and occasional balance corrections. Subjects who lose a leg crawl.
- **Extreme gore** (Off / Normal / Extreme in Settings)
  - Wounds drawn on the body that move with it: bullet holes, exit craters, slashes, bites, torn stumps, exposed guts, blast burns, soaking blood stains and drips.
  - Dismemberment: severed arms, legs, hands, feet and heads fly off as physics bodies, with flesh-and-bone stumps. Sniper headshots destroy the head.
  - Blood sprays, red mist, splatter on walls and floors, growing blood pools, flesh and bone chunks, arterial spurts, bleeding out, and blood on the screen when you're close.
  - Effects start where the hit actually lands. Floor and wall stains dry and fade out over time, and loose chunks shrink away, so long sessions stay fast. With gore off, hits show a small cloth puff instead.
- **Zombies**
  - Zombie mode: the dead rise as zombies.
  - Zombies notice prey (stop, head snap, growl), close in with arms rising, then attack.
  - Four claw swipes (overhead, backhand, two-handed, jab) bend toward the target's body and only hit where the claw actually touches; raised arms block, running targets can trip.
  - Bites go for the neck, shoulder or a raised forearm, with lunges, jaw-locked shaking and pauses. Victims push, twist away or block, and can break free, get dragged down, or bleed out.
  - Zombies kneel and feed with varied motions (diving in, tearing, sitting back to chew, leaning on one arm) and stop when interrupted or when the body is gone.
  - Turning takes about 10 seconds: the body lies still, starts twitching, convulses, then rises into a zombie stance. Zombie AI starts only when the rise is complete.
  - Bodies already look like zombies (green, sickly skin) before they get up.
  - A critically damaged head always wins: the body still turns green, but it never rises and its zombie AI never starts, even if the damage happens mid-transformation. A body can only turn once. Zombies never target the player.
- **Vampires**
  - Pale skin (adjustable), red irises that glow (optional), dark red lips and fangs (optional) that come out when they hunt; dark coats, blazers and boots.
  - Three movement styles with their own idles: the upright *aristocrat* (hands clasped behind), the hunched *feral* (claws out, twitching head) and the crouching *stalker* (dead still, then a sprint).
  - They stalk people, rush in, seize them from the front or from behind (or kneel over someone on the ground) and bite the neck. The victim struggles, goes limp and faints, then recovers later. A bite never kills a healthy person on its own.
  - Bitten people sicken over a countdown (adjustable) and then turn: standing, they clutch their throat, arch back with arms flung wide and settle into a vampire; on the ground, they rise stiffly like a board, pivoting on their heels. They keep their face and clothes.
  - The player can be bitten too: a heartbeat and a red pulse, then you turn and keep control, with heat sense (people glow), faster movement, and a bite on the knife button.
  - Bullets barely slow vampires and they heal; explosions hurt, and a knife to the chest is their weakness. Destroyed vampires crumble to ash. Vampires and zombies ignore each other.
- **Horror characters** (fan-made, built from the same procedural generator; no external or copied assets)
  - *Chucky*: an ~80 cm doll with a big head, freckles, red hair, a striped shirt, denim overalls, red sneakers and a kitchen knife. He waddles, laughs, stalks and rushes in to stab.
  - *Jason*: a ~2 m slasher in a hockey-style mask, worn work clothes and heavy boots, with a machete. Slow, heavy steps and a head tilt when he spots someone; he only runs when his prey keeps getting away or when he is shot.
  - Both hunt people (never zombies or vampires), are never bitten or reanimated, and fall as ordinary ragdolls when defeated.
- **Accessories**: some people wear caps, beanies, fedoras, glasses or sunglasses. Head hits, blasts and hard falls knock them off as small physics objects; resets put them back (switch in Settings).
- **Physics**: custom XPBD rigid-body solver with 16-body ragdolls, joint limits and anatomical mass distribution.
- **Weapons**: pistol, sniper rifle, knife, grenade, bazooka, grab hand and move tool. Ammo is infinite by default (toggle in Settings).
- **Graphics**: always HIGH MAX: PBR materials, soft shadows, SSAO on desktop. The game keeps itself smooth with an internal dynamic resolution and lighter internal costs on phones; there is no quality switch.
- **Audio**: synthesized weapons, impacts, gore, screams, zombie voices, vampire hisses, a doll's laugh, heavy boots, trains, footsteps and ambience.

## Controls

| PC | Action |
| --- | --- |
| Click | Capture the mouse |
| WASD / Space / C / Shift | Fly (move, up, down, fast) |
| Left / right mouse | Fire / aim |
| 1-7 or the weapon bar | Choose a weapon |
| R | Reload |
| Tab | Sandbox menu |
| O | Settings |
| Esc | Release the mouse |

On touch screens, use the left side of the screen to move and the right side to look. The on-screen buttons fire, aim, reload and fly up/down; tap the weapon bar to switch weapons.

## Building

```
node build.js        # writes ../HumanTest3D.html
node build.js --dev  # character preview harness (dev/preview.html)
```

`src/` holds the modules, which are joined in filename order inside one closure. `vendor/three.min.js` is three.js r159 (MIT, see `vendor/three-LICENSE.txt`) and is inlined into the output.
