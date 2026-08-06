# Cool-

Small, self-contained browser games. Every game is a single HTML file — open it, or host it anywhere.

| Game | File | Play |
|---|---|---|
| **Anger of Stick — Outbreak** — side-scrolling stickman action RPG | [`anger-of-stick.html`](anger-of-stick.html) | open the file on a phone (landscape) |
| **The Last Candle** — first-person horror crawl | [`horror.html`](horror.html) | open the file |

---

## Anger of Stick — Outbreak

A mobile-first 2D side-scrolling action RPG. A secret organisation ran experiments on civilians,
the city fell, and one stickman is walking back in.

**Play:** open `anger-of-stick.html` in a mobile browser, hold it in landscape, tap ENTER.
Everything — art, sound, music, save data — lives in that one file. No build step, no network,
works fully offline.

### Controls

Touch buttons, keyboard, or a connected gamepad.

| Action | Touch | Keys |
|---|---|---|
| Move | ◀ ▶ | A / D |
| Jump (double jump / wall jump once trained) | JUMP | W or Space |
| Melee — tap combos, **hold** for a heavy launcher | HIT | J |
| Shoot (hold) | FIRE | K |
| Roll · air dash · **parry** (roll into an attack) | ROLL | L / Shift |
| Throwable (frag / sticky / molotov) | ✚ | I |
| Active skill (needs full MP) | SP | U |
| Swap firearm | ⟳ | Q |
| **Antidote** — cure yourself or a squadmate | ⚕ | E |
| Squad stance: engage / fall back (emote when solo) | ⚑ | R |

Three light hits chain into a launcher kick; hits in the air juggle. Attack out of a roll for a
slide, at a sprint for a dash attack, and at a staggered enemy under 18% HP for an instant finisher.

### The infection

Every zombie bite can transmit the virus. An infection meter appears above your health and fills on
its own — different strains fill it at different speeds, and toxic zombies are the worst of them.
Screen edges creep green, your stickman turns pale, and you take more damage the sicker you get.
At 100% you turn, a short cinematic plays, and the mission is lost.

- **Antidotes** are the only cure. They drop from elites, appear in missions, are bought in the
  Armory, crafted in the Workshop, and carried between runs — but each difficulty caps how many
  you can take in with you (Nightmare: 2).
- **Squadmates get infected too.** Their portrait turns green and fills; leave them and they turn
  hostile. If the whole squad turns, the mission ends.
- **Doc, the medic**, slows infection for everyone near her, heals the squad and revives faster.
- **Difficulty** sets the pace: Easy spreads at half speed with plentiful antidotes; Nightmare
  spreads at triple speed with almost none.

### What's in it

- **Combat** — light combos, charged heavies, air juggling, slide and dash attacks, parry-counters,
  finishers, Rage Mode, hit-stop, screen shake, and slow motion on crits and boss kills.
- **21 weapons** — fists, bat, axe, spear, katana, hammer, chainsaw, energy sword, pistol, dual
  pistols, revolver, SMG, shotgun, rifle, sniper, flamethrower, minigun, laser, RPG, plasma, rail
  cannon — each with 10 upgrade levels — plus three throwables and 7 armour tiers.
- **20 enemy types** — walkers, runners, crawlers, zombie dogs, heavies, armored, spitters, toxic,
  electric, exploders, mutants, brutes, infected soldiers, gunners, flame troopers, riot shields,
  drones, robots, mechs and elite commanders.
- **15 bosses** — The Butcher, Tunnel Widow, Zombie King, Doctor Vex, Mall King, Giant Mutant,
  Military Tank, Colonel Kane, Bio-Experiment α, Sky Reaper, Spider Robot, Sewer Leviathan,
  Furnace Titan, The Mad Scientist and the Final Mutation.
- **15 maps** — Streets, Apartments, School, Hospital, Mall, Subway, Sewers, Bridge, Harbor,
  Airport, Desert Base, Snow Station, Underground Lab, Nuclear Facility, Final Fortress.
- **Weather and time of day** — rain, thunderstorms with lightning, fog, snow, night missions,
  dynamic lighting, plus spike traps, electric floors, sawblades and explosive barrels.
- **10 allies with roles** — assault, medic, sniper, heavy gunner, engineer (deploys turrets),
  shield, drone operator, robot (immune to infection) and an attack dog. Deploy three.
- **6 vehicles** — motorcycle, jeep, APC, tank and helicopter found in the field, plus the Mech Suit
  skill. Ram, gun down, and bail out when the hull gives.
- **11 active skills** — Shockwave Slam, Rage Mode, Healing Aura, Fire Punch, Lightning Strike,
  Air Strike, Missile Barrage, Bullet Time, Auto Turret, Drone Support, Mech Suit — plus passives
  including Double Jump, Air Dash, Wall Jump and Counter.
- **10 modes** — Story (15 chapters × 3 stages), Zombie Survival, Boss Rush, Endless, Defense,
  Horde, Time Attack, Daily Challenge, Weekly Challenge, and a hidden level found through caches.
  Hardcore (one life, no revives, double loot) and New Game+ layer on top.
- **Progression** — level 100, prestige for permanent power, skill tree, weapon and armour levels,
  crafting with materials and blueprints, supply crates, weekly missions, a seasonal event track,
  30 achievements, daily login rewards, checkpoints, and a full statistics page.
- **Customisation** — hair, headgear, outfits, gloves, boots, body colour, weapon skins, emotes and
  victory poses, all drawn on the stickman.
- **Audio** — procedural rock soundtrack that shifts for boss fights, plus combat and ambient SFX.
- **Options** — frame rate cap (30/60/120/uncapped), three graphics levels, screen shake and blood
  toggles, music toggle, gamepad support, autosave, and save export/import codes.

Progress saves to `localStorage` automatically. Settings → *Erase save data* wipes it.

### Not included

Online multiplayer — co-op, PvP arena, clans, friend lists, chat, live tournaments — is not here.
It needs game servers and accounts, which a single offline HTML file cannot provide. Leaderboards
are local personal bests instead.
