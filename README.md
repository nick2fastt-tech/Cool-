# Cool-
Wow

## ⚔️🎃 Forest Hunt 2.01 — Halloween 2X Event (Roblox)

The whole game is one file: [`ForestHunt_V2.lua`](ForestHunt_V2.lua).

### Install (Roblox Studio)
1. **The game:** Explorer → StarterPlayer → StarterPlayerScripts → ➕ → **LocalScript** → delete the `print` line → paste the whole file → Play.
   You can play solo after this step.
2. **Multiplayer + saving (optional):** Explorer → ServerScriptService → ➕ → **Script** → paste the **same file** again.
   Now everyone in a server shares the same zombies and bosses, sees each other's swords and swings, gets paid for helping on bosses, and progress saves.
   For saving in Studio: Home → Game Settings → Security → turn on **Enable Studio Access to API Services**.

Delete any old Forest Hunt 1.0 scripts first.

### Controls
| PC | Phone |
|---|---|
| Left-click / F — swing | ⚔ button (or tap the screen) |
| Shift — sprint | 🏃 toggle |
| Q — dash (can't be hit mid-dash) | 💨 button |
| E — talk to Gus | tap "Talk" |
| 1–5 — switch sword · M — worlds · G — sword bag · H — go home | menu buttons, top left |

### What's new in 2.01
- **Custom animations work now.** Your character's poses run after Roblox's own animator, so the default walk can't overwrite them. Monsters and Gus are "baked" skeletons that move in one batch every frame, so their animations always show.
- **Better animations:** each monster type walks its own way (shamble, giant stomp, stiff ice walk, monkey gallop, toxic wobble, gas zombies flailing when on fire), has 3 different attacks, flinches toward the side you hit, and dies in different ways. You get a landing squash, falling pose, dash lunge, hurt flinch, sword-trailing sprint, an idle sword twirl, and your head turns toward nearby monsters.
- **Bug fixes:** the HUD no longer hides under Roblox's chat or player list · Shift-sprint no longer toggles shift-lock · monster feet no longer point backwards · hit flashes are reused (Roblox only shows 31 at once) · gas zombies lit by a fire sword now get their full flames when they ignite.
- **Faster on PC + phones:** phones start on FAST graphics and build fewer tiny decorations · small parts skip shadows and touch checks · FAST turns off decoration lights and slows decoration particles · if HIGH graphics stays under ~38 FPS, the game switches to FAST by itself (change it back in Settings).

### What's in it
- You spawn in a glowing **cave** (Gus's shop, campfire, crystals). Walk through a tunnel to go **outside** and fight.
- **⚰ Graveyard** — the Pumpkin Patch outside the gates is free; the graveyard gates open at **120 kills** (giants + the Gravekeeper boss inside).
- **❄ Ice World** — unlocks at **500 kills**, **3X coins**: Frostbitten Zombies, Ice Throwers, Yeti Zombies, Frost Titan boss.
- **🌴 Jungle** — unlocks at **800 kills**, **4X coins**, hardest: Monkey Zombies, Gas Zombies (catch fire up close, explode when they die), Toxic Zombies (make you SICK), and **King Kongo** — beat him for **5,000 coins**.
- **🎃 2X Halloween event** — all coins doubled, zombies drop candy. **100 candies → Pumpkin Overnight Sword**, the most OP sword in the game.
- **A boss rises in every world every 10 minutes.** Everyone who helps gets the reward.
- **5 swords**, each with its own combo (slash / backslash / chop / wide swing / thrust / uppercut / spin). Custom running, sprinting and swing animations.
- Monsters are Roblox "boy" R15 rigs with hand-made animations.
- **If you die, your avatar turns into a zombie** — and your zombie twin stays in that world for anyone to fight.
- A brand-new **Gus** (cave trader with a miner helmet and a backpack full of swords): buy swords, upgrades, event info, chat (he answers in the chat box too).
- Grow-a-Garden-style UI (bubbly outlined text), light grey + black.
- Only the world you're in is drawn, so it stays smooth on phones. Phones start on FAST graphics; Settings → Graphics switches between HIGH and FAST (your choice is saved).
- With the server copy installed, the Roblox player list shows everyone's Kills, Candy and Coins.
