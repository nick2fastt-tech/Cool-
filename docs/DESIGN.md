# HOLLOW SHIFT - design spec

Everything here is implemented and testable. Numbers in this document are the
live values from `src/game/config.ts`; if the two ever disagree, the config
wins and this file is wrong.

## The loop

You sit in one room from 12 AM to 6 AM. You cannot move. You have:

| System | Control | Cost |
| --- | --- | --- |
| Left / right shutter | tap to toggle | 1 usage bar while closed, 0.12% to toggle |
| Left / right hall light | hold | 1 usage bar while held |
| Camera tablet | tap to raise, tap a room to switch | 1 usage bar while raised |
| Hand crank | hold, blackout only | it *costs* you tune time |

Power drains at `0.095 %/s x usage x night multiplier`, where
`usage = 1 + (number of active systems)`, capped at 5. A six-minute shift at
one bar costs about 34% of the grid; at a steady two bars, about 68%; three
bars all night is more than the grid has.

The whole game is that arithmetic against four characters who each punish a
different way of spending it.

## The cast

Five characters, five different rule sets. None of them is a reskin.

### Wex (rabbit) - west side, restless

- Movement opportunity every **4.97s**; rolls d20 against aggression.
- Path: Stage -> Dining -> Backstage -> West Hall -> Supply -> West Corner.
- **Quirk:** a failed roll has a 20% chance to move him *backwards*, so his
  approach is jittery instead of a clean march.
- At the west doorway he waits ~3 opportunities, knocking (35% each, small
  power cost), then retreats one room.
- **Counterplay:** the left shutter. Flashing the left light at him while he
  waits *resets his patience* - staring at him makes him stay longer.

### June (hen) - east side, punishes the tablet

- Opportunity every **4.99s**.
- Path: Stage -> Dining -> Restrooms -> Kitchen -> East Hall -> East Corner.
- **Quirk:** +2 effective aggression while the tablet is raised. She moves
  best when you are hiding behind the camera feed.
- She dwells in the **Kitchen**, whose camera has been dead for years. Two
  successful rolls to leave, and every roll makes noise. Sound is the only
  warning you get.
- **Counterplay:** the right shutter, and not camping the tablet.

### Bramble (bear) - the headliner, owns the dark

- Opportunity every **3.02s** - the fastest clock in the game.
- Same path as June; will not push past another character.
- **Quirk 1:** he cannot move while you are looking at the room he is standing
  in. Watching him is a hard freeze.
- **Quirk 2:** if he is in the east corner with the door open while you camp
  the tablet on *some other room* for 11 seconds, he walks in. Watching him is
  the only safe way to stall.
- He never retreats voluntarily; blocked at the shutter he waits 7
  opportunities before drifting one room back.
- When the grid dies, he is the one in the doorway with the music box.

### Captain Sprocket (fox) - a timer with teeth

- Opportunity every **5.01s**, and *only while nobody is watching the Crow's
  Nest feed*.
- Four curtain stages, then he sprints the west hall - about 2.4 seconds of
  warning, announced by running footsteps.
- **Neglect bonus:** +1 aggression for every 10 seconds past 20 without a
  Crow's Nest check, capped at +5. Ignoring him is how you lose to him.
- Blocked by the left shutter: he bangs on it and takes 5 / 8 / 9% of the grid
  on successive attempts, then retreats to stage 0 (stage 1 after 4 AM).
- **Counterplay:** short, regular camera checks - which cost power. That is the
  entire trade.

### HUSK - the rare one

- Not a walker. Scheduled at most once an hour, with a per-hour chance of
  1% / 2% / 3% / 6% on nights 3-6, plus a rare easter-egg trigger.
- Materialises in the office only while the tablet is **down**, and gives you
  **4.2 seconds**.
- **Counterplay:** raise the tablet. That is the only answer; doors do nothing.

## Blackout and recovery

See the README for the player-facing rules. The design intent:

- A blackout must be **survivable but never routine**. The crank cost grows
  geometrically (x1.5 per blackout) while the payout shrinks, so the fourth
  restore is a coin flip and the sixth is a fantasy.
- It must be **one readable threat**, not five. Attacks by everyone else are
  suppressed while the grid is down - otherwise a 4 AM blackout with two
  characters already in the corners is an unavoidable instant loss, which reads
  as a bug rather than a scare.
- It must **cost something afterwards**. The cast keeps walking while you
  crank, so the lights come back on with somebody in your doorway - which is
  why a successful restore shoves the bear two rooms back down the hall.
- **No flashlight, ever.** Light costs power, always. Any "free light" is a
  hole straight through the middle of the game.

## Nights

| Night | Name | Difficulty | Wex | June | Bramble | Fox | Drain | HUSK/hr |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | First Shift | Very Easy | 1 | 0 | 0 | 0 | 1.00 | - |
| 2 | Settling In | Easy | 3 | 1 | 0 | 1 | 1.05 | - |
| 3 | Bad Wiring | Medium | 5 | 6 | 2 | 3 | 1.10 | 1% |
| 4 | The Long Hour | Hard | 7 | 8 | 4 | 5 | 1.14 | 2% |
| 5 | Understaffed | Very Hard | 7 | 8 | 4 | 6 | 1.08 | 3% |
| 6 | Overtime | Extremely Hard | 11 | 12 | 7 | 8 | 1.05 | 6% |

Aggression is on a 0-20 scale and steps up at scripted hours (see
`NIGHTS[].escalation`), which is why 3 AM and 4 AM feel different. **Aggression
0 means switched off:** no situational bonus can wake a character up, which is
the guarantee that makes Night 1 a genuine tutorial.

Nights 5 and 6 lower the drain multiplier relative to Night 4 on purpose - by
then the difficulty comes from four active characters demanding door time, and
stacking a harsher grid on top just produced an unwinnable blackout loop.

## Measured balance

`npm run balance` plays 40 seeded nights per difficulty with two scripted
players. Latest run:

| Night | Sharp player | Sloppy player | Blackouts/night (sharp) |
| --- | --- | --- | --- |
| 1 | 100% | 90% | 0.00 |
| 2 | 100% | 55% | 0.00 |
| 3 | 100% | 0% | 0.93 |
| 4 | 88% | 0% | 2.92 |
| 5 | 75% | 0% | 3.27 |
| 6 | 20% | 0% | 4.35 |

"Sharp" is an omniscient bot with instant reactions - it is an upper bound on
human play, not a model of it. The regression test asserts loose bounds on this
table so a tuning change cannot silently flatten the curve.

## Feel rules

- **The player must always understand why they died.** Every death has a
  visible cause: a shape in a doorway, a sprint down the hall, a tune that ran
  out, a suit in the chair that you did not blink away.
- **Sound before sight.** Footsteps, kitchen noise and curtain rings are placed
  and attenuated per room. The kitchen camera is dead so that sound is
  sometimes the *only* information.
- **Jumpscares are the punctuation, not the sentence.** One per death, loud,
  and never a random ambush.
