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
  - *White Testing Room*: a white room with a measurement grid and spawn markers.
  - *Sunny Grassy Field*: wind-blown grass, trees, hills, a real sun path, and clear, cloudy, overcast, rain or fog weather.
- **Animation**: walking and running driven by real gait data: heel strike, foot roll, knee bend in swing, pelvis rotation, arm swing, and a flight phase when running. Zombies have four gait styles (shambler, reacher, limper, lurcher) with dragging legs, limps, hunched backs, lolling heads and reaching or limp arms. Subjects who lose a leg crawl.
- **Extreme gore** (Off / Normal / Extreme in Settings)
  - Wounds drawn on the body that move with it: bullet holes, exit craters, slashes, bites, torn stumps, exposed guts, blast burns, soaking blood stains and drips.
  - Dismemberment: severed arms, legs, hands, feet and heads fly off as physics bodies, with flesh-and-bone stumps. Sniper headshots destroy the head.
  - Blood sprays, red mist, splatter on walls and floors, growing blood pools, flesh and bone chunks, arterial spurts, bleeding out, and blood on the screen when you're close.
- **Zombies**
  - Zombie mode: the dead rise as zombies.
  - Zombies lunge, grab and bite while the victim struggles and screams, then kneel and feed on the body.
  - Bitten survivors who break free are infected: they turn pale, limp, cough, collapse, convulse, and rise as zombies.
  - A destroyed head stops a body from rising. Zombies never target the player.
- **Physics**: custom XPBD rigid-body solver with 16-body ragdolls, joint limits and anatomical mass distribution.
- **Weapons**: pistol, sniper rifle, knife, grenade, grab hand and move tool.
- **Graphics**: PBR materials, soft shadows, optional SSAO, and LOW/HIGH/ULTRA presets. Phones default to LOW.
- **Audio**: synthesized weapons, impacts, gore, screams, zombie voices, footsteps and ambience.

## Controls

| PC | Action |
| --- | --- |
| Click | Capture the mouse |
| WASD / Space / C / Shift | Fly (move, up, down, fast) |
| Left / right mouse | Fire / aim |
| 1-6 or the weapon bar | Choose a weapon |
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
