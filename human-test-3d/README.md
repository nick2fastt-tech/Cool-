# HUMAN TEST 3D

A 3D human physics sandbox that runs in any modern browser on PC and mobile.
The whole game ships as one file: [`../HumanTest3D.html`](../HumanTest3D.html). Open it directly; no server or install needed.

All humans, textures, sounds and environments are generated procedurally at load time. Nothing is downloaded.

## Features

- **Loading screen**: progress for each system (models, textures, shaders, animations, physics, sound, weapons, environment), rotating tips, then starts on its own.
- **Two environments**
  - *White Testing Room*: adjustable size, lighting and color temperature, a measurement grid, and spawn markers.
  - *Sunny Grassy Field*: wind-blown grass, trees, hills, a real sun path (time-of-day slider), and clear, cloudy, overcast, rain or fog weather.
- **Procedural adults**: gender, height, build, skin tone, eyes, natural or dyed hair, many hairstyles, facial hair, faces, clothing and shoes. Each one gets a name, an ID (`#014`) and an appearance seed.
- **Animation and AI**: breathing idle, walk, jog and run with foot planting, turning, look-at, blinking, reactions to sounds and threats, protective gestures, fleeing, ragdoll blending and get-up animations.
- **Physics**: custom XPBD rigid-body solver with 16-body ragdolls, joint limits, anatomical mass distribution, props, and adjustable gravity, mass, friction and collisions.
- **Tools**: pistol, sniper rifle, knife, grenade, grab hand and move tool. Ammo, fire rate, damage, auto-reload and fuse time are all configurable.
- **Hit diagnostics**: exact hit location on the skinned mesh, shown on screen as `TARGET / HIT LOCATION / DAMAGE STATE / REACTION / PHYSICS`. There is a body-diagram inspector, an event log and a debug panel. All effects are non-graphic.
- **Reincarnation mode** (optional): dead subjects can return as zombies after a delay you set. Zombies keep their identity, hunt living subjects and never target the player. Critical head trauma prevents reincarnation.
- **Graphics**: PBR materials, soft shadows, optional SSAO, and LOW/HIGH/ULTRA presets. Phones default to LOW.
- **Audio**: synthesized weapons, impacts, footsteps, voices and ambience, with separate volume sliders.

## Controls

| PC | Action |
| --- | --- |
| Click | Capture the mouse |
| WASD / Space / C / Shift | Fly (move, up, down, fast) |
| LMB / RMB | Use tool / aim |
| 1-6 | Choose a tool |
| R | Reload |
| F | Inspect a subject |
| Tab | Sandbox menu |
| Esc | Release the mouse |

On touch screens, use the left half of the screen to move and the right half to look. There are on-screen buttons for FIRE, AIM, RLD (reload), UP/DN, NEXT and SELECT.

## Building

```
node build.js        # writes ../HumanTest3D.html
node build.js --dev  # character preview harness (dev/preview.html)
```

`src/` holds the modules, which are joined in filename order inside one closure. `vendor/three.min.js` is three.js r159 (MIT, see `vendor/three-LICENSE.txt`) and is inlined into the output.
