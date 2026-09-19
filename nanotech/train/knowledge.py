# -*- coding: utf-8 -*-
"""NanoTech knowledge base.

Every entry is a small structured article. The trainer uses the prose to learn
word vectors, and ships the structure itself so the runtime can compose a fresh
answer each time instead of reciting one canned paragraph.

  id        stable key
  names     what a person might call it (first name is the display name)
  kind      rough category, used to pick the shape of the answer
  one       one-sentence definition, plain words
  points    the meat: 3-6 facts, each a standalone sentence
  like      an analogy that makes it click
  wow       a fact worth repeating
  near      related ids, for follow-ups and "tell me more"
"""

K = []


# Topics whose display name does not take "a"/"an". Mass and abstract nouns,
# plus the handful that want "the".
NO_ART = set("""gravity light energy electricity heat sound time water evolution dna
art color music math money war history language sport health exercise food sleep
stress code ai weather space nanotech nanoimagine nanovision python javascript""".split())
THE_ART = {"internet", "universe", "earth", "moon", "ocean", "brain", "body", "eye", "ear"}


def article(id, name):
    if id in THE_ART:
        return "the"
    if id in NO_ART:
        return ""
    return "an" if name[:1].lower() in "aeiou" else "a"


def a(id, names, kind, one, points, like="", wow="", near=()):
    K.append({"id": id, "names": list(names), "kind": kind, "one": one, "art": article(id, names[0]),
              "points": list(points), "like": like, "wow": wow, "near": list(near)})


# ---------------------------------------------------------------- space
a("black_hole", ["black hole", "black holes", "blackhole"], "thing",
  "a region of space where gravity pulls so hard that nothing, not even light, can get back out",
  ["It forms when a massive star runs out of fuel and its own weight crushes its core down to almost no size.",
   "The edge is called the event horizon. Cross it and every path forward leads deeper in, so there is no escaping.",
   "Time runs slower the closer you get. Someone falling in would look to you like they were freezing in place.",
   "They are not cosmic vacuum cleaners. They only pull on things that wander close, the same way any heavy object does.",
   "We see them by what they do to their surroundings: gas heating up as it spirals in, and stars whipping around nothing."],
  "a drain in the fabric of space, except the water is space itself",
  "The one at the center of our galaxy is about four million times the mass of the Sun, and we have photographed its shadow.",
  ["gravity", "star", "light", "galaxy", "time", "space"])

a("star", ["star", "stars", "sun", "the sun"], "thing",
  "a giant ball of gas squeezing hydrogen into helium at its core, which is where the light comes from",
  ["Gravity pulls the gas inward and fusion pushes outward, and a star is the standoff between those two forces.",
   "Colour tells you temperature. Blue stars are the hottest, red ones the coolest, and our yellow-white Sun sits in the middle.",
   "The Sun is about 4.6 billion years old and roughly halfway through its life.",
   "Big stars burn hot, live fast and die in supernovae. Small ones can keep going for trillions of years.",
   "Almost every atom heavier than helium, including the ones in your body, was cooked inside a star."],
  "a controlled hydrogen bomb that gravity keeps from blowing itself apart",
  "Sunlight takes about eight minutes to reach you, but the energy behind it spent tens of thousands of years fighting its way out of the Sun's core.",
  ["black_hole", "galaxy", "planet", "gravity", "light"])

a("galaxy", ["galaxy", "galaxies", "milky way"], "thing",
  "a huge gravitationally bound city of stars, gas, dust and dark matter",
  ["Ours is the Milky Way, a spiral about a hundred thousand light years across with a few hundred billion stars.",
   "We sit out in one of the spiral arms, roughly twenty six thousand light years from the center.",
   "Galaxies come in spirals, ellipticals and irregular blobs, and they collide and merge over billions of years.",
   "Most of a galaxy's mass is dark matter, which we only detect by its gravity."],
  "a slow whirlpool of stars, taking a quarter of a billion years to turn once",
  "The Milky Way and Andromeda are on a collision course, and will merge in about four billion years.",
  ["star", "black_hole", "universe", "gravity"])

a("universe", ["universe", "cosmos", "big bang"], "thing",
  "everything there is, and it has been expanding for about 13.8 billion years",
  ["The Big Bang was not an explosion in space. It was space itself beginning to stretch, everywhere at once.",
   "Distant galaxies are rushing away from us, and the farther they are the faster they go. That is how we know it is expanding.",
   "Leftover heat from the early universe still fills the sky as a faint microwave glow.",
   "The expansion is speeding up, and we call whatever is doing that dark energy."],
  "a loaf of raisin bread rising in the oven, with every raisin drifting away from every other one",
  "Roughly 95 percent of the universe is dark matter and dark energy, which means we do not really know what most of it is made of.",
  ["galaxy", "gravity", "time", "star"])

a("planet", ["planet", "planets", "mars", "jupiter", "solar system"], "thing",
  "a world massive enough for gravity to pull it round, orbiting a star and clearing its own lane",
  ["The four inner planets are rock. The four outer ones are gas and ice giants, far bigger and far colder.",
   "Mars is cold and rusty, with a thin atmosphere and the tallest volcano in the solar system.",
   "Jupiter is so massive that everything else in the solar system besides the Sun would fit inside it twice over.",
   "We have found thousands of planets around other stars, some of them roughly Earth sized and the right distance for liquid water."],
  "a solar system is a set of runners on a track, and the outer lanes take far longer to finish a lap",
  "A day on Venus is longer than its year, and it spins backwards compared to almost everything else.",
  ["star", "earth", "gravity", "moon"])

a("moon", ["moon", "the moon", "moons"], "thing",
  "a natural satellite, and ours is unusually big for the planet it goes around",
  ["It probably formed when something Mars sized smashed into the young Earth and the debris clumped together.",
   "Its gravity raises the ocean tides, and it steadies Earth's tilt, which keeps our seasons predictable.",
   "It is locked so that the same face always points at us, because Earth's pull slowed its spin to match its orbit.",
   "It has no air, so its sky is black even at noon and footprints stay put for millions of years."],
  "a slow metronome that has been keeping Earth's climate on beat for billions of years",
  "The Moon drifts about four centimetres farther away every year, so total eclipses will eventually stop happening.",
  ["earth", "planet", "gravity", "ocean"])

# ---------------------------------------------------------------- physics
a("gravity", ["gravity", "gravitation"], "force",
  "the way mass and energy bend space and time, so things fall toward each other",
  ["Anything with mass attracts anything else with mass. It is weak up close but it never switches off and it never shields.",
   "Einstein's picture is that mass curves spacetime, and what we call falling is just following the straightest path through the curve.",
   "Falling objects speed up about 9.8 metres per second every second near Earth's surface, regardless of how heavy they are.",
   "Orbiting is falling sideways fast enough that you keep missing the ground."],
  "a bowling ball on a trampoline, with the dip in the fabric steering everything that rolls past",
  "GPS satellites have to correct for gravity running time slightly faster up there, or they would drift by kilometres a day.",
  ["black_hole", "star", "planet", "energy", "time"])

a("light", ["light", "photon", "photons", "color of light"], "thing",
  "an electromagnetic wave, and also a stream of particles called photons, moving at the fastest speed there is",
  ["In a vacuum it travels about 300,000 kilometres a second, and nothing carrying information beats that.",
   "Colour is wavelength. Red waves are long and lazy, blue and violet are short and tight.",
   "What we see is a thin slice of a much wider spectrum that runs from radio waves up through X-rays.",
   "It bends when it changes material, which is why a straw looks broken in a glass of water and why lenses work."],
  "ripples on a pond that also arrive one drop at a time",
  "The sky is blue because air scatters short blue wavelengths in every direction, and red at sunset because the blue has been scattered away.",
  ["energy", "color", "star", "eye"])

a("energy", ["energy", "power", "watt", "joule"], "concept",
  "the capacity to make something happen, and it changes form constantly without ever being created or destroyed",
  ["It shows up as motion, heat, light, chemical bonds, electricity and mass, and it trades freely between them.",
   "Every conversion leaks some as heat, which is why nothing is ever perfectly efficient.",
   "Power is energy per second. A hundred watt bulb uses a hundred joules every second it is on.",
   "Mass is a kind of stored energy, which is what the famous equation is saying."],
  "money in different currencies: the total holds, but every exchange costs a fee in heat",
  "The energy in the food you eat in one day would boil about twenty litres of water.",
  ["gravity", "heat", "electricity", "light"])

a("electricity", ["electricity", "electric", "current", "voltage"], "thing",
  "the flow and push of electric charge, usually electrons moving through a conductor",
  ["Voltage is the push, current is how much charge flows, and resistance is how hard the material fights it.",
   "In a metal the electrons drift slowly, but the push travels through them at nearly the speed of light, which is why a switch feels instant.",
   "Circuits need a complete loop. Break the loop anywhere and everything stops.",
   "Alternating current won out for the grid because transformers can step it up for long distance travel and back down for your house."],
  "water in pipes, where voltage is the pressure, current is the flow rate and a narrow pipe is resistance",
  "A lightning bolt carries around a billion volts and heats the air near it to about five times the surface temperature of the Sun.",
  ["energy", "magnet", "computer", "battery"])

a("magnet", ["magnet", "magnetism", "magnetic field"], "thing",
  "a material whose electrons line up so that their tiny magnetic fields add instead of cancelling",
  ["Every magnet has two poles, and cutting one in half just gives you two smaller magnets with two poles each.",
   "Moving a magnet near a coil makes electricity, and running electricity through a coil makes a magnet. That pairing is the basis of motors and generators.",
   "Earth has a magnetic field, generated by churning liquid iron in its core, and it shields us from a lot of solar radiation.",
   "Heat scrambles the alignment, so a magnet heated far enough stops being one."],
  "a stadium crowd: one person waving does nothing, but the whole crowd waving together is a wave you can see from orbit",
  "Earth's magnetic poles flip every few hundred thousand years, and the last flip was around 780,000 years ago.",
  ["electricity", "energy", "earth"])

a("heat", ["heat", "temperature", "thermodynamics", "cold"], "concept",
  "the energy of things jiggling, and temperature is the average amount of that jiggle",
  ["Heat always moves from hotter to colder on its own. Going the other way takes work, which is what a fridge does.",
   "There are three ways it travels: conduction through contact, convection through moving fluid, and radiation as light.",
   "Cold is not a thing that flows. Feeling cold is heat leaving you.",
   "Absolute zero is where the jiggling would stop, and you can get arbitrarily close but never reach it."],
  "a room full of people bumping around: temperature is the average speed, heat is the total commotion",
  "Metal feels colder than wood at the same temperature only because it pulls heat out of your hand much faster.",
  ["energy", "weather", "water"])

a("sound", ["sound", "sound wave", "acoustics", "noise"], "thing",
  "a pressure wave travelling through a material, which your ear turns into a signal your brain reads",
  ["It needs something to travel through, so space really is silent.",
   "Pitch is frequency and loudness is amplitude, so a high note is fast wiggles and a loud note is big ones.",
   "It moves about 343 metres per second in air, much faster in water and faster still in steel.",
   "Echo is a reflection. Reverb is a thousand overlapping reflections arriving too close together to separate."],
  "a line of dominoes where each one shoves the next, except they spring back and can do it again",
  "You hear thunder about three seconds later for every kilometre the lightning is away.",
  ["music", "light", "energy", "ear"])

a("atom", ["atom", "atoms", "element", "molecule", "chemistry"], "thing",
  "the smallest piece of an element that is still that element, made of a tiny dense nucleus with electrons around it",
  ["The nucleus holds protons and neutrons. The proton count decides which element it is.",
   "Atoms are almost entirely empty space. If the nucleus were a marble, the electrons would be a few hundred metres out.",
   "Chemistry is atoms trading and sharing outer electrons to reach a more comfortable arrangement.",
   "There are 118 known elements, and everything you have ever touched is some combination of them."],
  "a solar system, except the orbits are fuzzy clouds of probability rather than neat rings",
  "There are more atoms in a single glass of water than there are glasses of water in every ocean on Earth.",
  ["energy", "electricity", "light", "water"])

a("time", ["time", "spacetime", "relativity"], "concept",
  "the dimension that orders events, and it is not the same for everybody",
  ["Clocks run slower when you move fast, and slower in stronger gravity. Both effects are measured, not theoretical.",
   "There is no universal now. Whether two distant events happened at the same moment depends on how you are moving.",
   "The direction of time seems to come from entropy: disorder grows, and that gives past and future different flavours.",
   "Space and time are one four dimensional fabric, which is why they stretch and squeeze together."],
  "a river that runs at different speeds depending on where in the channel you are floating",
  "Astronauts on long missions come back a tiny fraction of a second younger than they would have been on the ground.",
  ["gravity", "black_hole", "light", "universe"])

# ---------------------------------------------------------------- earth and life
a("earth", ["earth", "world", "our planet"], "thing",
  "the one planet we know of with liquid water oceans, a breathable atmosphere and life",
  ["It is about 4.5 billion years old and roughly 71 percent covered in water.",
   "The air is mostly nitrogen at 78 percent, then oxygen at 21 percent, with everything else in the last one percent.",
   "The crust floats on a hot mantle in slow moving plates, which is where earthquakes, mountains and volcanoes come from.",
   "The tilt of its axis is what gives us seasons, not its distance from the Sun."],
  "a layered sphere like an onion: thin brittle skin, thick hot middle, dense metal heart",
  "Earth is closest to the Sun in early January, which is the middle of winter for the northern half of the planet.",
  ["planet", "moon", "ocean", "weather", "volcano"])

a("ocean", ["ocean", "sea", "oceans", "tide"], "thing",
  "the connected body of salt water that covers most of the planet and drives its climate",
  ["It holds about 97 percent of Earth's water and absorbs a huge share of the heat and carbon we add to the air.",
   "Currents move heat around the globe in loops that take centuries to complete.",
   "Below about a thousand metres no sunlight reaches, and that dark zone is the largest habitat on Earth.",
   "Tides are the Moon and Sun pulling on the water, which is why most coasts get two highs a day."],
  "a giant flywheel for the climate: slow to speed up, slow to slow down, and it smooths everything out",
  "We have mapped the surface of Mars in more detail than the floor of our own ocean.",
  ["earth", "moon", "water", "weather", "fish"])

a("volcano", ["volcano", "volcanoes", "lava", "earthquake"], "thing",
  "a break in the crust where molten rock, ash and gas from below reach the surface",
  ["Most sit along plate boundaries, where crust is being pulled apart or shoved under.",
   "Runny lava builds wide gentle shield volcanoes. Sticky lava traps gas and builds steep ones that explode.",
   "Big eruptions can cool the whole planet for a year or two by filling the upper air with reflective haze.",
   "Volcanic soil is famously fertile, which is why people keep farming right next to them."],
  "a shaken bottle of fizzy drink: the danger is the trapped gas, not the liquid",
  "The 1815 eruption of Tambora made 1816 so cold in Europe and America that it was called the year without a summer.",
  ["earth", "weather", "heat"])

a("weather", ["weather", "climate", "rain", "storm", "clouds"], "concept",
  "what the atmosphere is doing right now, driven by the Sun heating different places unevenly",
  ["Warm air rises and cools, the moisture in it condenses, and that is a cloud.",
   "Rain falls when droplets in a cloud clump until they are too heavy for the rising air to hold.",
   "Wind is air sliding from high pressure to low pressure, bent sideways by Earth's spin.",
   "Weather is what happens this week. Climate is the pattern those weeks make over decades."],
  "a pot of water on a stove: heat at the bottom, and everything above it churns to move that heat upward",
  "No two snowflakes are alike because each one takes a slightly different path through the cloud and freezes to a different shape.",
  ["earth", "ocean", "heat", "water"])

a("water", ["water", "h2o", "ice", "steam"], "thing",
  "two hydrogen atoms bonded to one oxygen, and one of the strangest common substances there is",
  ["It is the rare thing that floats when it freezes, which is why lakes ice over on top instead of solid from the bottom.",
   "It takes a lot of energy to heat up and holds it a long time, which is why oceans steady the climate.",
   "It dissolves more substances than almost anything else, which is why it carries nutrients through living things.",
   "Surface tension lets it climb up plant stems and lets small insects walk on it."],
  "a molecule shaped like a tiny magnet, with a positive end and a negative end that stick to everything",
  "The water in your glass has been around for billions of years and has almost certainly been inside a dinosaur.",
  ["ocean", "atom", "weather", "plant"])

a("evolution", ["evolution", "natural selection", "darwin"], "concept",
  "the way living things change across generations because the variants that survive and reproduce leave more copies",
  ["Copying DNA is slightly imperfect, so every generation arrives with small random differences.",
   "The environment then does the sorting. Whatever happens to work in that place and time gets passed on more.",
   "It has no goal and no foresight. It only ever tinkers with whatever it already has.",
   "Given enough of these small steps and enough time, populations split and become separate species."],
  "someone endlessly remodelling a house they are living in, never able to knock the whole thing down and start fresh",
  "Your DNA is about 98.8 percent identical to a chimpanzee's, and around 60 percent of your genes have a recognisable match in a banana.",
  ["dna", "animal", "brain", "human"])

a("dna", ["dna", "gene", "genes", "genetics", "rna"], "thing",
  "the molecule that stores the instructions for building and running a living thing",
  ["It is a twisted ladder, and the rungs are pairs of four chemical letters: A with T, and C with G.",
   "Because the pairing is fixed, each strand is a template for rebuilding the other, which is how copying works.",
   "A gene is a stretch of that code that spells out one protein, and proteins do nearly all the actual work in a cell.",
   "You inherit one set from each parent, which is why you resemble both and are identical to neither."],
  "a recipe book where every cell in your body carries the whole book but only cooks a few pages",
  "Uncoiled, the DNA in a single one of your cells would stretch about two metres, and all of it together would reach to the Sun and back many times over.",
  ["evolution", "cell", "brain", "human"])

a("cell", ["cell", "cells", "biology", "bacteria"], "thing",
  "the smallest unit that counts as alive, and the building block every organism is made from",
  ["It is a bag with a controlled boundary, a set of instructions inside, and machinery to turn food into work.",
   "Your cells have a nucleus holding the DNA. Bacteria do not, and they are much simpler and far older.",
   "Mitochondria generate most of your usable energy, and they were once free living bacteria that moved in for good.",
   "Cells divide to grow and to repair, and the copying has to be near perfect or things go wrong."],
  "a factory town: walls, a library of blueprints, power plants, delivery trucks and a waste system",
  "You are made of roughly thirty trillion cells, and you carry about as many bacterial cells along with them.",
  ["dna", "evolution", "brain", "human", "body"])

a("brain", ["brain", "mind", "neuron", "neurons", "memory"], "thing",
  "the organ that takes in signals, builds a model of the world and decides what to do next",
  ["It has around 86 billion neurons, each one connected to thousands of others, and thinking is patterns of signals crossing those links.",
   "Memory is not a filing cabinet. Recalling something rebuilds it, and the rebuild can quietly change it.",
   "It rewires itself constantly, which is what learning physically is.",
   "It is about two percent of your body weight and burns roughly twenty percent of your energy.",
   "Sleep is when it clears waste and replays the day to decide what is worth keeping."],
  "a city of roads that widens the routes you drive often and lets the unused ones grow over",
  "There is no pain sensor in the brain itself, which is how people stay awake and talking through brain surgery.",
  ["cell", "dna", "ai", "sleep", "body"])

a("body", ["body", "human body", "anatomy", "heart", "lungs", "blood"], "thing",
  "a self repairing system of organs that keeps a narrow set of conditions steady while the world changes around it",
  ["The heart pumps around five litres of blood a minute, and the whole loop takes under a minute at rest.",
   "Lungs hand oxygen to the blood and take carbon dioxide back, across a surface about the area of a tennis court.",
   "Bones are living tissue that rebuilds constantly, and they are stronger than concrete for their weight.",
   "Almost everything it does is in service of homeostasis: holding temperature, water and chemistry inside a safe band."],
  "a building with its own plumbing, heating, power, security and maintenance crew, all running without you thinking about it",
  "Your stomach lining replaces itself every few days, because otherwise it would digest itself.",
  ["cell", "brain", "sleep", "food", "exercise"])

a("sleep", ["sleep", "sleeping", "dream", "dreams", "insomnia", "tired"], "concept",
  "an active maintenance mode your brain and body run every day, not just downtime",
  ["It cycles roughly every ninety minutes between deep sleep and the dreaming stage called REM.",
   "Deep sleep does the physical repair. REM does a lot of the memory sorting and emotional processing.",
   "Most adults need seven to nine hours, and you cannot really train yourself out of that.",
   "Screens late at night delay it because bright light tells your body clock it is still day.",
   "Lost sleep adds up, and the debt shows first as worse mood, judgement and reaction time."],
  "a nightly cleanup and filing shift, where skipping it leaves the mess for tomorrow",
  "Your brain physically flushes waste products during deep sleep at a rate it cannot manage while you are awake.",
  ["brain", "body", "health", "exercise"])

a("health", ["health", "healthy", "fitness", "wellbeing"], "concept",
  "the day to day habits that keep your body and mind working well, most of them unglamorous",
  ["Sleep, movement, real food, water and some human contact cover most of it.",
   "Consistency beats intensity. Twenty minutes most days does more than three hours once a month.",
   "Stress is not the enemy. Stress with no recovery is.",
   "Small changes stick because they survive a bad week, and big ones usually do not."],
  "compound interest: nothing looks like it is working for a month, then it obviously is",
  "Just walking briskly for about half an hour most days measurably lowers your risk of most major diseases.",
  ["sleep", "exercise", "food", "body", "stress"])

a("exercise", ["exercise", "workout", "training", "gym", "running"], "concept",
  "putting your body under load on purpose so it rebuilds itself stronger",
  ["Training damages tissue slightly and the growth happens while you rest, so rest days are part of the program.",
   "Progressive overload is the whole trick: a little more weight, reps or distance over time.",
   "Cardio builds the heart and lungs, resistance work builds muscle and bone. You want some of both.",
   "Soreness is a poor measure of progress. Whether the work is getting easier is a better one."],
  "sharpening a tool by using it, where the sharpening actually happens overnight",
  "Muscle burns energy even at rest, so building it quietly raises how much you use all day.",
  ["body", "health", "sleep", "food"])

a("food", ["food", "nutrition", "diet", "eating", "cooking", "protein"], "concept",
  "fuel and raw material, and what you eat changes energy, mood and how you rebuild",
  ["Protein supplies the parts for repair, carbohydrates are quick fuel, and fat is dense storage plus hormone raw material.",
   "Fibre feeds your gut bacteria and slows how fast sugar hits your blood.",
   "Whole foods keep you full longer than the same calories in processed form, which is why counting alone rarely works.",
   "Cooking is chemistry: heat breaks down tough tissue and builds hundreds of new flavour compounds through browning."],
  "building a house, where calories are the budget and nutrients are the actual materials",
  "The browning on seared meat, toast and coffee all comes from the same reaction between sugars and amino acids.",
  ["body", "health", "exercise", "plant"])

a("stress", ["stress", "anxiety", "worried", "overwhelmed", "burnout"], "concept",
  "your body's alarm system firing, which is useful in a sprint and corrosive over months",
  ["Short bursts sharpen focus and memory. Long grinding stress does the opposite.",
   "The physical symptoms are real: tight chest, shallow breathing, bad sleep, short temper.",
   "Slow breathing out longer than in genuinely calms the system, because it is one of the few switches you can reach directly.",
   "Naming the specific thing you are worried about shrinks it, because vague dread has no edges to work with."],
  "a car alarm that is meant to go off for a break-in, not to run all night",
  "Writing worries down before bed measurably helps people fall asleep faster, because the brain stops rehearsing them.",
  ["sleep", "brain", "health"])

# ---------------------------------------------------------------- animals
a("animal", ["animal", "animals", "creature", "wildlife"], "thing",
  "a multicellular living thing that eats other living things, senses its surroundings and usually moves",
  ["There are somewhere over a million described species, and most of them are insects.",
   "Every body plan is a set of tradeoffs between speed, size, energy use and how many offspring to gamble on.",
   "Convergent evolution keeps reinventing the same good ideas: eyes, wings and streamlined bodies all evolved many separate times.",
   "Most species that have ever lived are already extinct."],
  "an enormous design competition with no judge, where only the entries that keep getting built survive",
  "There are more possible arrangements of a shuffled deck of cards than there have been seconds since the Big Bang, and evolution has been shuffling genes the whole time.",
  ["evolution", "cat", "dog", "bird", "fish", "dragon"])

a("cat", ["cat", "cats", "kitten", "kitty"], "thing",
  "a small carnivore that people domesticated about ten thousand years ago, mostly on its own terms",
  ["They sleep twelve to sixteen hours a day, because ambush hunting is short bursts of effort and a lot of waiting.",
   "Their eyes have a reflective layer behind the retina, so they see in roughly one sixth the light we need.",
   "Whiskers are precision sensors that map gaps and air movement, not decoration.",
   "Purring happens when they are content but also when hurt or stressed, and the vibration may help tissue heal.",
   "They walk by moving both legs on one side together, which almost no other animal does."],
  "a small, extremely well engineered ambush predator that has agreed to live indoors",
  "A cat's nose print is as unique as a human fingerprint.",
  ["animal", "dog", "evolution"])

a("dog", ["dog", "dogs", "puppy"], "thing",
  "a domesticated wolf, reshaped by tens of thousands of years of living alongside people",
  ["They read human faces and gestures better than any other animal, including our closest primate relatives.",
   "Their sense of smell is somewhere between ten thousand and a hundred thousand times sharper than ours.",
   "Breeds are recent. Most of the variety you see was created in the last couple of centuries.",
   "They sweat almost nowhere, so panting is how they dump heat."],
  "a wolf that traded independence for a permanent job and steady food",
  "Dogs can smell time in a sense, because a scent fades predictably, so they can tell how long ago something passed by.",
  ["animal", "cat", "evolution"])

a("bird", ["bird", "birds", "flying", "feather"], "thing",
  "a feathered, warm blooded animal, and the only surviving branch of the dinosaurs",
  ["Wings work because air moving over a curved top travels farther and pushes down less, so the wing gets pushed up.",
   "Their bones are hollow and braced, and they have a one way airflow lung that is far more efficient than ours.",
   "Many navigate using the Sun, the stars, landmarks and Earth's magnetic field together.",
   "Feathers do everything: lift, insulation, waterproofing and signalling."],
  "an aircraft that grows its own engines, maintains itself and rebuilds its wings every year",
  "The Arctic tern migrates from the Arctic to the Antarctic and back every year, and over a lifetime flies roughly the distance to the Moon and back three times.",
  ["animal", "evolution", "dinosaur"])

a("fish", ["fish", "shark", "whale", "dolphin", "sea creature"], "thing",
  "a water dwelling vertebrate that breathes with gills, though whales and dolphins are mammals that went back to the sea",
  ["Gills pull dissolved oxygen from water, which holds far less of it than air does.",
   "A swim bladder lets many fish hover at a chosen depth without spending energy.",
   "Sharks are older than trees, and have been largely the same shape for hundreds of millions of years.",
   "Whales are mammals: they breathe air, are warm blooded and nurse their young."],
  "living inside a fluid so dense that swimming is closer to flying than to walking",
  "The blue whale is the largest animal that has ever existed, bigger than any dinosaur, and its heart is the size of a small car.",
  ["ocean", "animal", "evolution"])

a("dinosaur", ["dinosaur", "dinosaurs", "trex", "t rex"], "thing",
  "the group of reptiles that dominated land for about 165 million years, and whose bird descendants are still here",
  ["They appeared around 230 million years ago and the non bird ones died out about 66 million years ago.",
   "An asteroid roughly ten kilometres across hit what is now Mexico, and the dust and cold that followed collapsed the food chain.",
   "Many were feathered, and the line between a small dinosaur and an early bird is genuinely blurry.",
   "Tyrannosaurus rex lived closer in time to us than to Stegosaurus, which is a gap of about 80 million years."],
  "a dynasty that ran for a hundred and sixty five million years and ended in a single bad afternoon",
  "Birds are dinosaurs in the same real sense that bats are mammals, so there is a dinosaur outside your window right now.",
  ["animal", "bird", "evolution", "earth"])

a("dragon", ["dragon", "dragons", "wyvern"], "thing",
  "a mythical winged reptile that shows up independently in cultures all over the world",
  ["European dragons are usually hoarding monsters to be slain. East Asian dragons are usually wise, benevolent and tied to water and rain.",
   "Nobody knows exactly why the idea is so universal. Fossil bones, big snakes and a deep instinct about predators all probably contributed.",
   "Modern fantasy dragons mostly descend from one nineteenth and twentieth century literary tradition, not from any single old myth.",
   "As engineering, a fire breathing flier is a fun problem: you need lift, a fuel store and a way not to cook yourself."],
  "humanity's shared answer to the question of what the scariest possible animal would be",
  "Chinese dragons traditionally have no wings and fly anyway, because they are spirits of water and sky rather than animals.",
  ["animal", "art", "story", "bird"])

a("plant", ["plant", "plants", "tree", "trees", "flower", "photosynthesis"], "thing",
  "a living thing that makes its own food out of light, water and air",
  ["Photosynthesis takes sunlight, water and carbon dioxide and builds sugar, releasing oxygen as a by-product.",
   "Nearly all the oxygen you breathe came from plants and algae doing exactly that.",
   "Most of a tree's mass is carbon pulled out of the air, not material taken from the soil.",
   "Roots trade sugar with fungi in the soil for minerals, and those fungal networks can link whole forests.",
   "Flowers are advertising, aimed at whatever animal will carry pollen to the next plant."],
  "a solar panel that builds the rest of itself out of thin air",
  "A large tree can move hundreds of litres of water a day from its roots to its leaves with no pump, using nothing but evaporation and surface tension.",
  ["water", "earth", "cell", "food"])

# ---------------------------------------------------------------- tech
a("computer", ["computer", "computers", "cpu", "hardware", "pc"], "thing",
  "a machine that follows instructions on numbers, fast enough and reliably enough to fake almost anything",
  ["Everything inside is on or off, and we call those two states 1 and 0.",
   "The CPU fetches an instruction, does it, and moves to the next one, billions of times a second.",
   "Memory is a tradeoff ladder: tiny fast registers and cache near the processor, then RAM, then slow roomy storage.",
   "It cannot actually do anything clever. It does simple things in enormous quantity, in exactly the order you specified."],
  "an unbelievably fast clerk with no imagination, who follows the instructions exactly as written",
  "A modern phone is many millions of times faster than the computer that guided Apollo 11 to the Moon.",
  ["code", "internet", "ai", "electricity"])

a("code", ["code", "coding", "programming", "software", "program"], "concept",
  "writing instructions precisely enough that a machine with no judgement can carry them out",
  ["The hard part is almost never the syntax. It is deciding what should happen in every case you did not think of.",
   "Everything reduces to a few ideas: store a value, do arithmetic, choose between paths, repeat, and bundle work into reusable pieces.",
   "Code is read far more than it is written, so clear names and small functions pay for themselves quickly.",
   "Bugs are usually a mismatch between what you meant and what you actually said.",
   "The fastest way to learn is to build something small you actually want, then keep extending it."],
  "writing a recipe for someone who follows it perfectly and has no common sense whatsoever",
  "The first known bug report was a literal moth, taped into a logbook in 1947.",
  ["computer", "ai", "python", "javascript", "game"])

a("python", ["python", "python language"], "thing",
  "a programming language built to be readable, which is why it is usually the one people learn first",
  ["Indentation is the syntax, so badly laid out code does not run rather than just looking bad.",
   "It runs slower than languages like C, and mostly gets away with it by calling fast libraries underneath.",
   "It dominates data work, scripting, automation and machine learning because of its library ecosystem.",
   "Batteries included is the design philosophy: a lot of what you need ships with it."],
  "the language that reads closest to describing the problem out loud",
  "It is named after Monty Python's Flying Circus, not the snake, which is why the docs are full of spam jokes.",
  ["code", "computer", "ai"])

a("javascript", ["javascript", "js", "html", "css", "web development"], "thing",
  "the language every web browser runs, which makes it the most widely deployed language there is",
  ["HTML is the structure, CSS is the appearance and JavaScript is the behaviour.",
   "It was written in about ten days in 1995, and some of the odd corners of the language are still from that rush.",
   "It runs one thing at a time but hands off slow work and picks it up later, which is why callbacks and promises exist.",
   "It also runs on servers now, so one language can cover both ends of an application."],
  "the only language guaranteed to already be installed on every screen your work will land on",
  "A single HTML file with a script tag is a complete, working, shareable app with no install step at all.",
  ["code", "computer", "internet", "game"])

a("ai", ["ai", "artificial intelligence", "machine learning", "neural network", "llm", "model"], "concept",
  "software that learns patterns from examples instead of being told the rules directly",
  ["A neural network is layers of simple numeric units, and training nudges the connection strengths until the output matches the examples.",
   "A language model predicts what comes next in text, and doing that well enough starts to look like reasoning.",
   "It is genuinely pattern matching at enormous scale, and it has no independent check on whether what it says is true.",
   "It is only as good as its data. Skewed or thin training data produces skewed or thin behaviour.",
   "Being confidently wrong is the main failure mode, which is why you verify anything that matters."],
  "a student who has read an enormous library and remembers the style of every answer, without having seen the world the books describe",
  "Nobody can fully explain why a large model gives a particular answer, including the people who built it.",
  ["brain", "code", "computer", "nanotech"])

a("internet", ["internet", "web", "wifi", "network", "online"], "thing",
  "a worldwide network of networks that agreed on a common way to pass messages along",
  ["Data is chopped into packets, each one finds its own route, and the far end reassembles them in order.",
   "Addresses and names are separate: DNS is the phone book that turns a name you can remember into a number machines use.",
   "There is no center. It was designed so that losing pieces reroutes traffic rather than stopping it.",
   "Most of the physical internet is undersea fibre optic cable, not satellites."],
  "a postal system where every letter is torn into numbered pages that travel separately and get stapled back together on arrival",
  "Light in a fibre optic cable gets from London to New York in under 30 milliseconds, faster than you can blink.",
  ["computer", "code", "phone"])

a("phone", ["phone", "smartphone", "mobile", "iphone", "android"], "thing",
  "a pocket computer with radios, cameras and sensors, which also makes calls",
  ["It talks to nearby cell towers, and handing you off between towers as you move is what makes it mobile.",
   "The battery is usually lithium ion, and heat shortens its life faster than charge cycles do.",
   "Modern phone cameras are mostly software. Many frames get combined to beat what the tiny lens could do alone.",
   "GPS works by timing signals from several satellites at once and solving for where you must be."],
  "a Swiss army knife where every tool turned out to be better than the standalone version",
  "Your phone is doing trilateration against satellites twenty thousand kilometres up, several times a second, while you scroll.",
  ["computer", "internet", "ai"])

a("game", ["game", "games", "gaming", "video game", "game dev"], "concept",
  "an interactive system with goals and constraints, where the fun lives in the decisions",
  ["A game loop is the heartbeat: read input, update the world, draw the frame, repeat.",
   "Good feel comes from tiny details: a few frames of wind-up, screen shake, a sound that lands on the hit.",
   "Difficulty should teach. A player who fails should understand exactly why.",
   "Scope is what kills projects. A small finished game beats an ambitious unfinished one every time.",
   "Prototype the core verb first. If jumping is not fun on a grey box, no amount of art will save it."],
  "a conversation between a designer and a player, conducted entirely through rules",
  "Space Invaders got faster as you cleared enemies because the hardware sped up with less to draw, and players liked it so much it became a design rule.",
  ["code", "javascript", "art", "music", "story"])

a("nanotech", ["nanotech", "nano tech"], "thing",
  "the model you are talking to right now, built by Nick, running entirely inside this one file",
  ["Every answer is generated on the device. Nothing is sent anywhere, and there is no server involved.",
   "The understanding layer uses word vectors trained with Python on a curated corpus, then quantized and embedded here.",
   "The pictures and videos are drawn as SVG by a procedural art engine, shape by shape, not fetched from anywhere.",
   "It uses its own API key format, and no other model or service is involved at any point.",
   "It works offline, forever, because the whole model is in the page."],
  "a small brain that fits in a text file and still holds a conversation",
  "The entire model, art engine and app are one HTML file you can email to someone.",
  ["ai", "code", "nanoimagine", "nanovision"])

a("nanoimagine", ["nanoimagine", "nano imagine", "image model"], "thing",
  "the NanoTech image model, which draws illustrations as SVG using a procedural art engine",
  ["It reads the prompt into a scene: subject, setting, time of day, weather, style and mood.",
   "Then it builds the picture in layers, from sky and background through to foreground details.",
   "Flash 1.5 makes new images and Variant edits one you already have.",
   "Because it is SVG, every image is resolution independent and stays sharp at any size."],
  "an illustrator that works in shapes and gradients instead of pixels",
  "The same prompt always gives you the same image, because the whole thing is seeded from your words.",
  ["nanotech", "nanovision", "art"])

a("nanovision", ["nanovision", "nano vision", "video model"], "thing",
  "the NanoTech video model, which animates SVG scenes with CSS keyframes",
  ["It writes a short storyboard, then assigns motion to each layer of the scene.",
   "Far layers drift slowly and near layers move faster, which is what makes it feel deep.",
   "Every clip is a seamless loop between ten and fifteen seconds long.",
   "Pro pushes the timing, easing and detail further than the standard model."],
  "a flipbook where the drawings are described by maths, so it never blurs",
  "The video is a text file. A fifteen second clip can be smaller than a single photograph.",
  ["nanotech", "nanoimagine", "art"])

# ---------------------------------------------------------------- humanities
a("history", ["history", "historical", "ancient", "civilization"], "concept",
  "the study of what people did before now, and of why the records say what they say",
  ["Writing shows up around 3200 BCE in Mesopotamia, mostly to track grain and debts rather than to tell stories.",
   "Farming changed everything: surplus food allowed cities, specialists, armies and taxes.",
   "The printing press mattered because copying stopped being the bottleneck, and ideas started outrunning authorities.",
   "Most of the past left no records, so history leans heavily toward whoever could write and whatever survived."],
  "a photo album where most of the pages are missing and the rest were chosen by the people in the pictures",
  "Cleopatra lived closer in time to the first Moon landing than to the building of the Great Pyramid.",
  ["human", "art", "money", "war"])

a("human", ["human", "humans", "people", "humanity"], "thing",
  "a primate that got unusually good at language, cooperation and passing knowledge down",
  ["Anatomically modern humans appeared roughly 300,000 years ago in Africa.",
   "Our real advantage is culture: we do not each rediscover fire, we inherit it.",
   "Language lets us share things that are not present, including plans, warnings and fiction.",
   "We are built for cooperation in groups, and also for noticing who is not pulling their weight."],
  "a species whose superpower is not strength or speed but the ability to teach",
  "Every person alive is descended from an unbroken chain of roughly four billion years of ancestors who all managed to reproduce.",
  ["brain", "evolution", "history", "language"])

a("language", ["language", "languages", "words", "grammar", "linguistics"], "concept",
  "a shared system of signals that lets one mind put an idea into another",
  ["There are around seven thousand living languages, and roughly half have fewer than ten thousand speakers.",
   "Children absorb grammar without being taught it, which suggests the brain comes prepared for the job.",
   "Languages drift constantly. Every rule you were taught was once a mistake that caught on.",
   "Some ideas are much easier to think in one language than another, though the effect is smaller than people claim."],
  "a piece of software that runs on brains and rewrites itself every generation",
  "Sign languages have full grammar, regional accents and puns, and they are not versions of the spoken language around them.",
  ["human", "brain", "story", "history"])

a("story", ["story", "stories", "writing", "narrative", "book", "novel"], "concept",
  "a sequence of events arranged so the order itself carries meaning",
  ["Almost every story is someone wanting something and something getting in the way.",
   "Specific beats general. One concrete detail does more than three paragraphs of description.",
   "Change is the point. If the character ends where they started, the reader will feel it was for nothing.",
   "Showing the evidence and letting the reader conclude is stronger than stating the conclusion.",
   "First drafts are supposed to be bad. Writing is mostly rewriting."],
  "a controlled experiment where you change one thing about a person and watch what breaks",
  "The oldest written story we have, the Epic of Gilgamesh, is about four thousand years old and is largely about grief and the fear of dying.",
  ["language", "art", "game", "music", "history"])

a("art", ["art", "drawing", "painting", "design", "illustration"], "concept",
  "making something whose point is how it looks, feels or means, rather than what it does",
  ["Composition is the first thing a viewer reads. Where the eye lands and where it travels next.",
   "Value, meaning light and dark, does more work than colour. A good picture reads in greyscale.",
   "Contrast creates focus. The most different thing in the frame is where you are telling people to look.",
   "Style is mostly consistent decisions, not a special talent.",
   "Drawing is trained seeing. Most beginner problems are looking problems, not hand problems."],
  "a magic trick where the setup is geometry and the reveal is a feeling",
  "The blue in many old paintings cost more than gold, because the only good source was one mine in Afghanistan.",
  ["color", "music", "story", "game", "nanoimagine"])

a("color", ["color", "colour", "colors", "palette", "hue"], "concept",
  "your brain's interpretation of which wavelengths of light arrived, not a property of the object",
  ["Three cone types in your eye sample the spectrum, and every colour you see is the brain's read on their ratios.",
   "Mixing light adds up to white. Mixing paint subtracts down toward mud. Same colours, opposite maths.",
   "Opposites on the colour wheel make each other look more intense, which is why orange pops against blue.",
   "Warm colours advance and cool colours recede, which is how a flat picture suggests depth.",
   "A limited palette usually looks more deliberate than an unlimited one."],
  "a three number code your eye sends up, which your brain then interprets in context",
  "Pink has no wavelength. There is no pink light, only red light your brain reads as pink when it is mixed and desaturated.",
  ["light", "art", "eye"])

a("music", ["music", "song", "songs", "instrument", "rhythm", "melody"], "concept",
  "organised sound, where the organisation is what makes it mean something",
  ["A note is a frequency. Doubling it gives the same note an octave up, which is why octaves sound like the same thing.",
   "Harmony is simple frequency ratios. The simpler the ratio, the more settled two notes sound together.",
   "Rhythm is the skeleton. Most listeners forgive a wrong note long before a wrong beat.",
   "Tension and release is the whole engine: set an expectation, delay it, then pay it off.",
   "Silence is an instrument. What you leave out shapes what is left."],
  "architecture in time, where you build expectation and then decide when to satisfy it",
  "A minor chord is physically almost identical to a major one, one note moved by a semitone, and yet it changes the entire emotional reading.",
  ["sound", "art", "story", "math"])

a("math", ["math", "maths", "mathematics", "number", "numbers", "algebra", "geometry"], "concept",
  "the study of patterns and structure, done precisely enough that conclusions are forced rather than argued",
  ["It starts from assumptions and derives what must follow, which is why a proof does not expire.",
   "Zero and negative numbers were both controversial for centuries before they became obvious.",
   "Algebra is arithmetic with the unknown left in place so you can solve for it.",
   "Probability is deeply unintuitive, and most people's gut feeling about randomness is wrong in predictable ways.",
   "It keeps turning out to describe the physical world far better than it has any right to."],
  "a set of rules for reasoning that never lets you cheat, even when the answer is inconvenient",
  "In a room of 23 people there is already a better than even chance that two share a birthday.",
  ["code", "music", "energy", "money"])

a("money", ["money", "economy", "finance", "inflation", "saving", "investing"], "concept",
  "a shared agreement that lets people trade without having to want exactly what the other person has",
  ["It works as a medium of exchange, a way to store value and a common yardstick for comparing things.",
   "Inflation is the yardstick shrinking, so the same money buys less over time.",
   "Compound growth is the one genuinely surprising bit of maths in personal finance: time matters more than amount.",
   "Risk and expected return travel together. Anything promising high return with no risk is lying.",
   "Spending less than you earn is unglamorous and does most of the work."],
  "a scoreboard everyone agrees to honour, which stops working the moment they stop agreeing",
  "Saving a modest amount from age 25 usually beats saving a much larger amount from age 40, purely because of compounding.",
  ["math", "history", "human"])

a("war", ["war", "battle", "military", "conflict"], "concept",
  "organised violence between groups, and historically one of the strongest drivers of technological change",
  ["Logistics decides more wars than tactics. Armies run on food, fuel and spare parts.",
   "Defenders usually have the advantage, which is why attackers need surprise, numbers or better technology.",
   "New weapons force new formations, and every advantage gets copied within a generation.",
   "The costs land hardest on people who had no say in starting it."],
  "the most expensive possible way for two groups to fail to talk to each other",
  "Radar, jet engines, computers, penicillin at scale and the internet all came out of wartime research programs.",
  ["history", "human", "computer"])

a("sport", ["sport", "sports", "football", "soccer", "basketball"], "concept",
  "a contest with agreed rules, which is how we get high stakes without real consequences",
  ["Rules are deliberately arbitrary. They exist to make the contest interesting, not fair in any cosmic sense.",
   "Elite performance is mostly boring repetition of fundamentals plus very good recovery.",
   "Home advantage is real and measurable across almost every sport.",
   "Most of what looks like reflex is pattern recognition. Experts are reading cues earlier, not moving faster."],
  "a safe container for tribal feeling, where the stakes are enormous and also nothing",
  "A professional tennis player has roughly 500 milliseconds to react to a serve, which is less time than it takes to read this sentence's first word.",
  ["exercise", "game", "human"])

a("eye", ["eye", "eyes", "vision", "seeing"], "thing",
  "a light sensor that focuses an image onto a sheet of cells wired straight into the brain",
  ["The lens projects the world upside down on the retina, and the brain flips it.",
   "Rods handle dim light and motion, cones handle colour and detail, and cones are packed into one tiny central spot.",
   "You have a blind spot where the nerve leaves the eye, and your brain quietly fills it in.",
   "Most of what you think you are seeing at any instant is the brain's prediction, updated by a few sharp glances."],
  "a camera with a terrible sensor and an unbelievably good image processor behind it",
  "Your eyes make tiny jerks several times a second, and the brain deletes the motion blur between them, which is why the world does not smear.",
  ["light", "color", "brain"])

a("ear", ["ear", "ears", "hearing"], "thing",
  "a machine that turns air pressure waves into nerve signals, with a spiral of tuned hair cells doing the sorting",
  ["The eardrum moves, three tiny bones amplify it, and a fluid filled spiral separates the frequencies by position.",
   "Different spots along that spiral respond to different pitches, so the ear does a frequency analysis mechanically.",
   "Those hair cells do not regrow, which is why loud noise damage is permanent.",
   "It also holds your balance sense, in fluid filled loops that detect which way your head is turning."],
  "a piano laid out along a spiral, where each key is wired to a different nerve",
  "The three bones in your middle ear are the smallest in your body, and all three together would sit on a fingernail.",
  ["sound", "brain", "music"])
