# Cool-
Wow

## ⚔️🎃 Forest Hunt 2.06 — Halloween 2X Event (Roblox)

The whole game is one file: [`ForestHunt_V2.lua`](ForestHunt_V2.lua).

### Install (Roblox Studio)
It's one file. The server copy runs the game for everyone (monsters, bosses, saving); the player copy draws your screen. Roblox only lets LocalScripts show UI and read keys/touches, so the same file goes in two places:
1. **Server:** Explorer → ServerScriptService → ➕ → **Script** → paste the whole file. Everyone shares the same zombies and bosses, and progress **saves on PC and phones**.
   For saving in Studio: Home → Game Settings → Security → turn on **Enable Studio Access to API Services**.
2. **Screen:** Explorer → StarterPlayer → StarterPlayerScripts → ➕ → **LocalScript** → delete the `print` line → paste the **same file**.

Delete any old Forest Hunt 1.0 scripts first.

### Controls
| PC | Phone |
|---|---|
| Left-click / F — swing | ⚔ button (or tap the screen) |
| Shift — sprint | 🏃 toggle |
| Q — dash (can't be hit mid-dash) | 💨 button |
| E — talk to Gus | tap "Talk" |
| 1–5 — switch sword · M — worlds · G — sword bag · H — go home | menu buttons, top left |

### What's new in 2.06
- **Your sword stays in your hand.** Every piece is held with exact welds, the sword is placed in your palm before it's attached, leftover copies are cleared, and a loose sword re-attaches itself.
- **A brand-new detailed church** for every boss fight: bell tower with clock and spire, stained glass, rose window, pillars, chandeliers, organ pipes, pews, altar, banners (frosty in Ice World, mossy in the Jungle, red in Battle World).
- **More detailed zombies and bosses**, and the **Jungle Miniboss** has its own silverback look (bone crown, war paint, bone club).
- **A bigger, brighter cave:** lantern posts, hanging lanterns, light shafts, mine supports, crates and barrels, a stream with a bridge, glowing mushrooms, a cooking pot and a tunnel signpost.
- **Coins** (and candy during the event), **Travel** and the **Boss Timer** are back on screen.
- **New main menu:** event countdown, your avatar and progress, Updates / Worlds / Controls tabs.
- Fixes: the church bell tower no longer blocks the door; trees and statues no longer grow in front of church doors.

### What's new in 2.05
- **⚔ Battle World** (500 kills, **5X coins**): packed with Battle Zombies, Metal Battle Zombies and Jungle Minibosses, plus **the Warrior Boss (10,000 health)**.
- **⛪ Boss church:** when a boss rises, everyone in that world is pulled into the church to watch it dig out of the floor and roar. Bosses have **5,500 health**.
- **Pumpkin Overnight Sword hits for 800.** Ice World unlocks at **150** kills, Jungle at **300**.
- Swords sit in your hand (Roblox's grip point) and have more detail. Monster moves blend back into walking more smoothly.
- The 2X Halloween event **ends November 1st**.

### What's new in 2.01
- **Custom animations work now.** Your character's poses run after Roblox's own animator, so the default walk can't overwrite them. Monsters and Gus are "baked" skeletons that move in one batch every frame, so their animations always show.
- **Better animations:** each monster type walks its own way (shamble, giant stomp, stiff ice walk, monkey gallop, toxic wobble, gas zombies flailing when on fire), has 3 different attacks, flinches toward the side you hit, and dies in different ways. You get a landing squash, falling pose, dash lunge, hurt flinch, sword-trailing sprint, an idle sword twirl, and your head turns toward nearby monsters.
- **Bug fixes:** the HUD no longer hides under Roblox's chat or player list · Shift-sprint no longer toggles shift-lock · monster feet no longer point backwards · hit flashes are reused (Roblox only shows 31 at once) · gas zombies lit by a fire sword now get their full flames when they ignite.
- **Faster on PC + phones:** phones start on FAST graphics and build fewer tiny decorations · small parts skip shadows and touch checks · FAST turns off decoration lights and slows decoration particles · if HIGH graphics stays under ~38 FPS, the game switches to FAST by itself (change it back in Settings).

### What's in it
- You spawn in a glowing **cave** (Gus's shop, campfire, crystals). Walk through a tunnel to go **outside** and fight.
- **⚰ Graveyard** — the Pumpkin Patch outside the gates is free; the graveyard gates open at **120 kills** (giants + the Gravekeeper boss inside).
- **❄ Ice World** — unlocks at **150 kills**, **3X coins**: Frostbitten Zombies, Ice Throwers, Yeti Zombies, Frost Titan boss.
- **🌴 Jungle** — unlocks at **300 kills**, **4X coins**: Monkey Zombies, Gas Zombies (catch fire up close, explode when they die), Toxic Zombies (make you SICK), and **King Kongo** — beat him for **5,000 coins**.
- **🎃 2X Halloween event** — all coins doubled, zombies drop candy. **100 candies → Pumpkin Overnight Sword**, the most OP sword in the game.
- **A boss rises in every world every 10 minutes.** Everyone who helps gets the reward.
- **5 swords**, each with its own combo (slash / backslash / chop / wide swing / thrust / uppercut / spin). Custom running, sprinting and swing animations.
- Monsters are Roblox "boy" R15 rigs with hand-made animations.
- **If you die, your avatar turns into a zombie** — and your zombie twin stays in that world for anyone to fight.
- A brand-new **Gus** (cave trader with a miner helmet and a backpack full of swords): buy swords, upgrades, event info, chat (he answers in the chat box too).
- Grow-a-Garden-style UI (bubbly outlined text), light grey + black.
- Only the world you're in is drawn, so it stays smooth on phones. Phones start on FAST graphics; Settings → Graphics switches between HIGH and FAST (your choice is saved).
- With the server copy installed, the Roblox player list shows everyone's Kills, Candy and Coins.
