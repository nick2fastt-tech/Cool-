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
Everything (art, sound, save data) lives in that one file — no build step, no network.

### Controls

Touch buttons, or keyboard on desktop.

| Action | Touch | Keys |
|---|---|---|
| Move | ◀ ▶ | A / D |
| Jump | JUMP | W or Space |
| Melee combo | HIT | J |
| Shoot (hold) | FIRE | K |
| Dodge roll (i-frames) | ROLL | L / Shift |
| Grenade | ✚ | I |
| Active skill (needs full MP) | SP | U |
| Swap firearm | ⟳ | Q |

Three melee hits chain into a launcher kick. The MP bar fills as you deal damage.

### What's in it

- **Combat** — 3-hit melee chains, launchers, juggling, dodge rolls, knockback, crits, hit-stop,
  screen shake, blood, sparks, fire, explosions, additive light flashes and floating damage numbers.
- **13 weapons** — fists, bat, fire axe, katana, war hammer, pistol, SMG, shotgun, assault rifle,
  flamethrower, minigun, RPG, rail cannon. Each upgrades to Lv10 (damage + ammo).
- **Squad** — recruit and rank up Rex, Nina, Bolt and Iron; deploy two at a time. They fight,
  go down, and get back up on their own.
- **Progression** — levels and EXP, skill points, 4 attributes, an 8-branch passive tree,
  7 unlockable active skills (Shockwave, Berserk, Field Medic, Air Strike, Adrenaline,
  Auto Turret, Mech Suit), 6 armour tiers, 20 achievements, hidden caches, daily login rewards.
- **10 enemy types** — zombies, fast zombies, heavies, crawlers, infected soldiers, militia gunners,
  riot soldiers (front shields), mutants, giant brutes, combat robots.
- **10 bosses** with phases, summons, slams, volleys, charges and an airborne gunship.
- **10 maps** — Downtown, Subway, Hospital, Mall, Factory, Military Base, Laboratory, Rooftops,
  Sewers, Final Research Facility — each with parallax layers, props and lighting.
- **Modes** — Story Campaign (10 chapters × 3 stages, told through mission briefings),
  Zombie Survival, Boss Rush, Endless, and a seeded Daily Challenge.
- **3 difficulties** — Normal, Hard (Chapter 3), Nightmare (Chapter 6) with reward multipliers.
- Rescue caged civilians, smash crates and barrels for ammo and grenades, and find the
  hidden `?` cache in every story stage.

Progress saves to `localStorage`. Settings → *Erase save data* wipes it.
