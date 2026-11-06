# HUMAN TEST 3D

A 3D human physics sandbox that runs in any modern browser on PC and mobile.
The whole game ships as one file: [`../HumanTest3D.html`](../HumanTest3D.html). Open it directly; no server or install needed.

All humans, textures, sounds and environments are generated procedurally at load time. Nothing is downloaded.

## Features

- **Loading screen**: progress for each system (models, textures, shaders, animations, physics, sound, weapons, environment), rotating tips, then starts on its own.
- **Simple UI**: a **Sandbox** menu, a **Settings** menu, and a weapon bar you tap or click to equip.
  - *Sandbox*: Spawn Male / Spawn Female (each person gets a random body, height, face and outfit), Spawn Vampire / Zombie / Chucky / Jason / Doctor, weapon cards, zombie, vampire and horror switches, world (room, field or subway; time of day and weather on the field), and scene controls (pause, slow motion, clear bodies, reset).
  - *Settings*: gore level, graphics, audio, controls, gameplay and on-screen info.
- **Three environments**
  - *White Testing Room*: a clean white room with large wall panels, skirting boards, framed ceiling lights, soft corner shading, a measurement grid and spawn markers.
  - *Sunny Grassy Field*: a flat open test area surrounded by rolling hills; meadow grass with lush and dry patches, flowers and wind gusts; grass that flattens under bodies; clusters of broadleaf trees, conifers and bushes with a distant tree line; sky-lit ambient light, a real sun path, a hazy horizon, and sunny, cloudy, overcast, rain or fog weather.
  - *Weather (V1.11)*: rain eases in and out; the ground and grass darken and turn glossy as they soak up the rain and dry off slowly afterwards; puddles gather in the grass with rain rings rippling across them; drops splash where they land; people's skin and clothes get wet; in a downpour lightning flickers and thunder follows after a delay that tells how far away it struck.
  - *Atlantic Av–Barclays Center (Brooklyn)*: modeled on the real station. Street level has Atlantic Av and Flatbush Av, the arena with its weathered-steel bands and oculus canopy, and the green-roofed entrance pavilion with wooden benches. Stairs and an escalator lead down about 6 m to fare control (turnstiles with OMNY readers, vending machines, booth), which opens onto the IRT platforms laid out like the real ones: side platform, two tracks, island, two tracks, side platform (2 3 on the local tracks, 4 5 express). The walls have mosaic "ATLANTIC AVENUE" name tablets, terra-cotta "A" plaques and trim, a mosaic frieze and the glass-block panels; black steel columns stand between the tracks. Stairs at the platform ends drop to an underpass below the tracks, and a passage with wave-patterned wainscoting leads to the deep BMT Brighton line (about 18 m down): one island platform, two tracks (B Q), a bridge across the double-height end and a long stair down, with the dual-contracts mosaic trim line. Benches, trash cans, countdown clocks, column signs and hanging direction signs throughout.
  - *Trains*: every track runs a 10-car train: R142 cars on the 2 3 4 5 (15.6 m, three doors a side) and R160 cars on the B Q (18.4 m, four doors a side). The cars are hollow, with bucket seats, poles and grab bars, lit ceilings, car-card ads, glass windows and sliding doors. Trains brake into the station, open the platform-side doors, chime, close and pull out, then come round the loop again with a new route sign. Spoken announcements where the browser supports speech.
  - *Sitting and riding*: people, vampires, Chucky and Jason sit on benches, board open trains, take a seat or hold a pole, ride round the loop and get off when the train comes back. Zombies never sit down, but they will follow prey through open doors. Ragdolls and loose objects inside a moving car travel with it. People walk between all levels through the turnstiles, stairs and underpass; walls, platforms and fixtures are solid, and bodies can fall onto the tracks.
  - *All*: soft contact shadows under feet, bodies and objects; ragdolls settle and come to rest.
- **People (V1.11)**
  - *Personalities*: every person has their own bravery, curiosity, sociability, reaction speed, pace and fidgets.
  - *Memory*: people remember where shots, blasts, screams, monsters and bodies were during the session; they glance back at those places, stay alert near them, and avoid wandering back there for a couple of minutes.
  - *Crowds*: panic spreads. People who see others running look round and, a moment later, may run too. Fleeing people pick an escape route away from every threat they know of and around walls and corners. Runners swerve round others instead of pushing through.
  - *Curiosity*: the curious walk over to look at a body (never with a monster about), hand to mouth or hands on hips, then back away. If the body starts to move, they run.
  - *Conversation*: calm people near each other stop to chat face to face, taking turns to talk, gesturing while they speak and nodding while they listen.
  - *Navigation*: people step round bodies on the ground instead of kicking them along. Long sprints tire them and they slow down, breathing hard.
- **Faces (V1.11)**: natural blinks (a quick close and a slower open, sometimes twice, more often when talking or frightened), eyes that track what people look at with small saccades, moving eyebrows and mouth corners, and talking (syllables on the jaw with pauses between words). Expressions follow what people are doing: neutral with small brow flashes and half-smiles, friendly while chatting, worried, startled surprise, fear, terror when grabbed, pain, anger, shock and disgust at a body, puzzled at a distant noise, sick when infected; zombies snarl when they attack. Changes blend smoothly. Vampires, Chucky, Jason and the doctor keep their own faces.
- **Clothing and hair (V1.11)**: skirt, dress and coat hems and long hair swing behind when people walk or run, swing forward when they stop, lean out on turns and stir in the wind on the field.
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
  - Bites go for the neck, shoulder or a raised forearm, with lunges, jaw-locked shaking and pauses. Victims push, twist away, block or freeze, and can break free, get dragged down, or bleed out.
  - Gut punch: a zombie drives its fist into the stomach, the victim doubles over, and the zombie tears the guts out and eats them.
  - Pile-on: while one zombie holds someone, others walk round to the back and sides and bite at the same time, drag the victim down and eat together (up to four at once).
  - Zombies kneel and feed with varied motions (diving in, tearing, sitting back to chew, leaning on one arm) and stop when interrupted or when the body is gone.
  - Feeding zombies kneel right at the body and stay there: each takes its own place along it (torso, either side, legs), the mouth reaches the body without gaps, and nobody clips into the floor.
  - Turning takes about 10 seconds: the body lies still, starts twitching, convulses, then rises into a zombie stance. Zombie AI starts only when the rise is complete.
  - **Infection** (about 60 seconds, adjustable): people who are bitten or injected keep their own face, hair and clothes while the sickness takes hold. First a slight change of expression and a hand to the temple or stomach; then coughing, sweat and a faint green tinge; then a tired, stooped posture, slower walking, irregular swaying and head movements; around 45 seconds they collapse, and the body slowly finishes turning green before it rises as a zombie. All changes are gradual and procedural.
  - **Zombie looks**: six appearance types (recently turned, classic green, pale, discolored, older, ragged), each randomized so no two zombies look alike: skin tone, blotchy discoloration, dark eye areas, matted greying hair, slack or clenched jaws, uneven stance, worn, grimy and torn clothing.
  - **Zombie animation**: several idles (swaying, lolling, sniffing, reaching, shuddering, twitching, teeth chattering, staggering, scratching, looking round), heads that turn toward nearby people and lead the body into turns, slow uneven walks, limps, runs, reaches, bites, scratches, ground feeding and recoveries, all with randomized timing.
  - A critically damaged head always wins: the body still turns green, but it never rises and its zombie AI never starts, even if the damage happens mid-transformation. A body can only turn once. Zombies never target the player.
- **Vampires**
  - Pale skin (adjustable), red irises that glow (optional), dark red lips and fangs (optional) that come out when they hunt; dark coats, blazers and boots.
  - Three movement styles with their own idles: the upright *aristocrat* (hands clasped behind), the hunched *feral* (claws out, twitching head) and the crouching *stalker* (dead still, then a sprint).
  - They stalk people, rush in, seize them from the front or from behind (or kneel over someone on the ground) and bite the neck. The victim struggles, goes limp and faints, then recovers later. A bite never kills a healthy person on its own.
  - Bitten people sicken over a countdown (adjustable) and then turn: standing, they clutch their throat, arch back with arms flung wide and settle into a vampire; on the ground, they rise stiffly like a board, pivoting on their heels. They keep their face and clothes.
  - Each style has its own walk (the aristocrat's long, upright glide, the feral lope, the stalker's flat creep); aristocrats often wear a cape with a stand-up collar. Pointed ears, slicked-back hair, sunken eyes and faint veins.
  - Vampires never go after the player.
  - Bullets barely slow vampires and they heal; explosions hurt, and a knife to the chest is their weakness. Destroyed vampires crumble to ash. Vampires and zombies ignore each other.
- **Horror characters** (fan-made, built from the same procedural generator; no external or copied assets)
  - *Chucky*: an ~80 cm doll with a big head, freckles, red hair, a striped shirt, denim overalls, red sneakers and a kitchen knife. He waddles, laughs, stalks and rushes in to stab.
  - *Jason*: a ~2 m slasher in a hockey-style mask, worn work clothes and heavy boots, with a machete. Slow, heavy steps and a head tilt when he spots someone; he only runs when his prey keeps getting away or when he is shot.
  - Each has his own walk: Chucky's stiff, rocking waddle with swinging arms; Jason's long, heavy, unhurried stride.
  - Both hunt people, zombies and vampires alike, are never bitten or reanimated, and fall as ordinary ragdolls when defeated.
  - *The Physician* (V1.10): an original containment-doctor design (not based on any existing character or model): about 2 m tall, a stitched leather hood that wraps under the chin, a long curved beak with stitched seams and brass-ringed breathing holes, a strap buckled round the back of the head, round brass goggles and a wide-brimmed hat, a long buckled coat open below the waist with shoulder straps, buckled cuffs and a round brass badge, white gloves, heavy boots, a stethoscope, an instrument pouch, serum vials on the belt and a brass-and-glass injector of green serum.
    - He walks slowly and very upright, one hand behind his back and the injector held at his waist, his head moving in slow scans with bird-like tilts. Idles: hands clasped behind his back, tugging a glove snug, counting the vials on his belt, standing stock-still. Now and then he raises the injector to his goggles, flicks the glass and squeezes out a bead of serum.
    - He never attacks. He picks out an ordinary person, walks up at a measured pace, grips their shoulder and drives the needle into the side of the neck or the upper arm. The subject enters the normal infection progression above. He then stands back and watches them, hands behind his back.
    - Once someone's infection has taken hold, he may raise an open hand toward them and slowly close it into a fist: the subject collapses and the turning begins.
    - He commands zombies. The zombies he made (from anyone he injected or triggered) follow him from up to 40 m away, and any other zombie that comes within 7 m falls in behind him too. They shamble along in a loose pack behind him, hanging back while he approaches someone, and attack no one on their own. He points at a person and they go after only that person; once the target is down (or gets away) he beckons and they come back to him. If he dies, they go back to being ordinary zombies.
    - People only become alarmed once he lays hands on someone; up close they freeze and stare at him. Zombies never attack him, and vampires, Chucky and Jason ignore him. He can be shot down like anyone else and never turns.
- **Accessories**: some people wear caps, beanies, fedoras, glasses or sunglasses. Head hits, blasts and hard falls knock them off as small physics objects; resets put them back (switch in Settings).
- **Physics**: custom XPBD rigid-body solver with 16-body ragdolls, joint limits and anatomical mass distribution. Ragdolls start with the motion the animation had (no sudden launch when an animation ends), and overlapping bodies are pushed apart gently instead of being flung, even with several zombies around one victim.
  - V1.11: a hit on a light part (a hand, a foot) can only take so much before the rest becomes a shove of the whole body, so nothing gets flung by one limb; characters never end up standing inside one another (not even inside their own target, except in grapples); people steer round bodies on the ground.
- **Spawning (V1.11)**: new people, zombies, vampires and horror characters always appear on walkable ground on the same level, clear of walls, fixtures, props and other people; if the spot is taken, the nearest free spot is used.
- **Save and load (V1.11)**: *Save Scene* / *Load Scene* in the Sandbox menu keep one scene in the browser: the map, the field's time and weather, the camera, and every living character with the same body, face and clothes, position, health and type (person, zombie with its look and walk, vampire with its style, Chucky, Jason, the doctor) and any infection in progress. Bodies on the ground are not saved.
- **People**: skin with subtle light scatter at the shadow edge, an oilier T-zone, pores and roughness variation; hair with strand highlights; randomized bodies, faces, hairstyles and outfits for both men and women.
- **Weapons**: pistol, sniper rifle, knife, grenade, bazooka, grab hand and move tool. Ammo is infinite by default (toggle in Settings).
- **Graphics**: always HIGH MAX: PBR materials, soft shadows, SSAO on desktop. The game keeps itself smooth with an internal dynamic resolution and lighter internal costs on phones; there is no quality switch.
  - Crowds: people near the camera and on screen are always full quality. Calm people far away and off screen also think every other frame (they still move every frame). With more than ten people, those far away pose every other frame and those off screen every third frame; only the nearest 16 render into the shadow map (the rest keep their soft contact shadows); and the physics only sub-steps animated bodies that something might touch. In a 65-person crowd this cuts animation time by about 30% and physics time by about 35%.
- **Audio**: synthesized weapons, impacts, gore, screams, coughs, zombie voices, vampire hisses, a doll's laugh, heavy boots, the injector's hiss, trains, footsteps and ambience.
  - V1.11: footsteps follow the surface (dry or wet grass, station tile, street concrete, a train's metal floor), runners' clothes rustle and dragging zombie feet scuff; each map has its own acoustics (a long tiled echo underground that fades at street level, a mid-size room, open air on the field); distant sounds lose their high end; voices and creature sounds use head-related panning so their direction is clearer; the subway has water drips and trains rumbling somewhere under the street; wind comes in gusts; rain follows the weather and thunder follows lightning.

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
