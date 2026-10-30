# HUMAN TEST 3D

A 3D human physics sandbox that runs in any modern browser on PC and mobile.
The whole game ships as one file: [`../HumanTest3D.html`](../HumanTest3D.html). Open it directly; no server or install needed.

All humans, textures, sounds and environments are generated procedurally at load time. Nothing is downloaded.

## Features

- **Loading screen**: progress for each system (models, textures, shaders, animations, physics, sound, weapons, environment), rotating tips, then starts on its own.
- **Simple UI**: a **Sandbox** menu, a **Settings** menu, and a weapon bar you tap or click to equip.
  - *Sandbox*: Spawn Male / Spawn Female (each person gets a random body, height, face and outfit), weapon cards, zombie switches, world (room or field, time of day, weather), and scene controls (pause, slow motion, clear bodies, reset).
  - *Settings*: gore level, graphics, audio, controls, gameplay and on-screen info.
- **Two environments**
  - *White Testing Room*: a clean white room with large wall panels, skirting boards, framed ceiling lights, soft corner shading, a measurement grid and spawn markers.
  - *Sunny Grassy Field*: a flat open test area surrounded by rolling hills; meadow grass with lush and dry patches, flowers and wind gusts; grass that flattens under bodies; clusters of broadleaf trees, conifers and bushes with a distant tree line; sky-lit ambient light, a real sun path, a hazy horizon, and clear, cloudy, overcast, rain or fog weather.
  - *Both*: soft contact shadows under feet, bodies and objects; ragdolls settle and come to rest.
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
  - A critically damaged head always wins: that body never rises, even if the damage happens mid-transformation. A body can only turn once. Zombies never target the player.
- **Physics**: custom XPBD rigid-body solver with 16-body ragdolls, joint limits and anatomical mass distribution.
- **Weapons**: pistol, sniper rifle, knife, grenade, bazooka, grab hand and move tool. Ammo is infinite by default (toggle in Settings).
- **Graphics**: PBR materials, soft shadows, optional SSAO, and LOW/HIGH/ULTRA presets. Phones default to LOW.
- **Audio**: synthesized weapons, impacts, gore, screams, zombie voices, footsteps and ambience.

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
