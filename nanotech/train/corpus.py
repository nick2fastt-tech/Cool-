# -*- coding: utf-8 -*-
"""Training corpus: intents, conversational prose, and the visual lexicon.

INTENTS feed a trained linear classifier. CHAT_PROSE and the knowledge prose
feed the co-occurrence matrix the word vectors come out of. VISUAL maps words
onto things the art engine can actually draw.
"""

# ---------------------------------------------------------------------------
# Intents. Each example is a real thing a person types. Short, messy, lowercase.
# ---------------------------------------------------------------------------
INTENTS = {
"greet": [
  "hi", "hey", "hello", "yo", "sup", "wassup", "what's up", "whats up", "hey there",
  "hiya", "heyy", "good morning", "good afternoon", "good evening", "morning",
  "hey nanotech", "hello there", "anyone there", "you there", "hey you", "hi again",
  "yo yo", "greetings", "hey man", "hey bro", "hi friend", "back again"],
"bye": [
  "bye", "goodbye", "see you", "see ya", "later", "cya", "gtg", "got to go",
  "goodnight", "night", "talk later", "im out", "i'm out", "peace", "catch you later",
  "thanks bye", "ok bye", "heading off", "gonna sleep", "going to bed", "see you tomorrow"],
"howareyou": [
  "how are you", "how are you doing", "how r u", "hows it going", "how's it going",
  "you good", "you ok", "how you been", "how have you been", "what's new",
  "whats new with you", "how was your day", "you doing alright", "everything good",
  "how do you feel", "are you okay", "how's life"],
"thanks": [
  "thanks", "thank you", "thanks a lot", "thx", "ty", "appreciate it", "much appreciated",
  "that helped", "that was helpful", "perfect thanks", "nice thanks", "you're the best",
  "legend", "thanks man", "cheers", "big help", "exactly what i needed"],
"sorry": [
  "sorry", "my bad", "oops", "my fault", "i messed up", "apologies", "didnt mean that",
  "ignore that", "wrong message", "never mind", "nvm", "forget it"],
"affirm": [
  "yes", "yeah", "yep", "yup", "sure", "ok", "okay", "alright", "sounds good", "do it",
  "go ahead", "please do", "that works", "exactly", "correct", "right", "true", "for sure",
  "definitely", "absolutely", "let's do it", "im down", "i'm down", "bet"],
"deny": [
  "no", "nope", "nah", "not really", "don't", "dont", "stop", "wrong", "that's wrong",
  "not that", "no thanks", "never mind that", "incorrect", "nope not it", "wrong answer"],
"laugh": [
  "lol", "lmao", "haha", "hahaha", "lmfao", "that's funny", "thats funny", "dead",
  "im dead", "crying", "bruh", "nah that's crazy", "no way", "wild", "insane", "fr",
  "for real", "deadass", "hahah stop"],
"identity": [
  "who are you", "what are you", "what's your name", "whats your name", "your name",
  "are you an ai", "are you a bot", "are you real", "are you human", "are you chatgpt",
  "what model are you", "what are you built on", "what powers you", "tell me about yourself",
  "introduce yourself", "what is nanotech", "are you claude", "are you gemini",
  "do you use an api", "are you online", "do you need internet", "where do you run"],
"creator": [
  "who made you", "who created you", "who built you", "who's your creator",
  "who programmed you", "who developed you", "who owns you", "who is nick",
  "did nick make you", "who wrote you"],
"capability": [
  "what can you do", "what do you do", "what are you good at", "can you help me",
  "what can i ask you", "what are your features", "can you make images",
  "can you make videos", "can you code", "can you draw", "can you write",
  "do you remember things", "can you do math", "what else can you do", "help",
  "how do you work", "what should i ask you"],
"user_bored": [
  "i'm bored", "im bored", "so bored", "bored", "nothing to do", "entertain me",
  "give me something to do", "i have nothing to do", "this is boring", "im so bored rn"],
"user_sad": [
  "i'm sad", "im sad", "feeling down", "i feel bad", "having a rough day",
  "bad day", "im upset", "i'm upset", "feeling lonely", "im tired of everything",
  "nothing is going right", "i failed", "i messed everything up", "feeling low",
  "im stressed", "i'm stressed", "im anxious", "i'm overwhelmed", "everything sucks"],
"user_happy": [
  "i'm happy", "im great", "doing good", "im good", "i'm good", "feeling great",
  "best day ever", "i passed", "i did it", "i got the job", "so excited",
  "im hyped", "i'm excited", "things are going well", "im proud of myself"],
"user_tired": [
  "im tired", "i'm tired", "so tired", "exhausted", "cant sleep", "can't sleep",
  "didn't sleep", "im sleepy", "need sleep", "so sleepy", "im drained"],
"ask_define": [
  "what is a black hole", "what's gravity", "define entropy", "what does dna mean",
  "what is photosynthesis", "whats an atom", "what are neurons", "meaning of evolution",
  "what is machine learning", "what does cpu stand for", "what is inflation",
  "what is a galaxy", "what is the internet", "what is javascript", "what is python",
  "who are humans", "what are dinosaurs", "what is music", "what is art",
  "what is time", "what is light", "what is energy", "what is a cell"],
"ask_how": [
  "how does gravity work", "how do planes fly", "how does the internet work",
  "how do computers work", "how does a black hole form", "how do magnets work",
  "how does sound travel", "how do plants make oxygen", "how does sleep work",
  "how does evolution work", "how do i learn to code", "how do i start a game",
  "how does ai work", "how does electricity work", "how do vaccines work",
  "how do i get better at drawing", "how does memory work", "how do i fix this"],
"ask_why": [
  "why is the sky blue", "why do we sleep", "why does ice float", "why is the ocean salty",
  "why do cats purr", "why do we dream", "why is the sun hot", "why do i feel tired",
  "why does time slow down", "why do leaves change color", "why is water wet",
  "why do we yawn", "why does music make me emotional", "why is my code broken"],
"ask_more": [
  "tell me more", "more", "go on", "keep going", "continue", "and", "then what",
  "elaborate", "explain further", "more detail", "say more about that", "expand on that",
  "what else", "anything else about it", "deeper", "go deeper"],
"ask_simpler": [
  "simpler", "explain it simpler", "in simple terms", "explain like im five", "eli5",
  "dumb it down", "too complicated", "i dont get it", "i don't understand", "shorter",
  "make it shorter", "tldr", "in one sentence", "quick version"],
"ask_example": [
  "give me an example", "example", "for example", "show me an example", "like what",
  "such as", "name one", "give me a few examples", "any examples", "show me"],
"ask_opinion": [
  "what do you think", "your opinion", "do you like it", "what's your favorite",
  "whats your favourite", "do you prefer", "which is better", "would you recommend",
  "what would you do", "do you agree", "is it worth it", "should i do it",
  "do you like music", "whats your favorite color", "do you have feelings"],
"ask_list": [
  "give me ideas", "list some ideas", "suggest something", "any suggestions",
  "give me options", "name some", "brainstorm with me", "ideas for a game",
  "ideas for a story", "what should i build", "what should i make", "give me 5 ideas",
  "recommend something", "what should i watch", "what should i learn"],
"request_code": [
  "write me code", "write a function", "show me the code", "code for a snake game",
  "how do i write a loop", "javascript function", "python script", "fix my code",
  "debug this", "write html", "make a webpage", "write a css animation",
  "show me a for loop", "write a class", "help with my function", "code example"],
"request_story": [
  "write me a story", "tell me a story", "write a poem", "make up a story",
  "write something", "give me a plot", "write a short story", "story about a dragon",
  "write a rap", "write lyrics", "make me a character", "write a scene"],
"request_joke": [
  "tell me a joke", "say something funny", "make me laugh", "got any jokes",
  "another joke", "a funny one", "roast me", "say something dumb"],
"request_help": [
  "help me make a game", "can you help me build an app", "i need help with my project",
  "help me write an essay", "help me plan this", "help me decide", "i need advice",
  "what should i do about this", "how should i approach this", "help me study",
  "help me with homework", "walk me through it", "i'm stuck", "im stuck on this"],
"math": [
  "what is 2 + 2", "whats 15 times 3", "calculate 100 / 4", "12 plus 30",
  "what's 7 squared", "square root of 144", "20 percent of 80", "half of 90",
  "convert 10 km to miles", "how many minutes in a day", "5 factorial",
  "2 to the power of 10", "average of 3 7 and 11", "what is 1/3 as a decimal"],
"time_date": [
  "what time is it", "what's the date", "whats today", "what day is it",
  "what year is it", "how long until midnight", "what month is it", "time now"],
"meta_memory": [
  "do you remember me", "what's my name", "whats my name", "do you remember what i said",
  "remember that", "forget that", "what did i tell you", "do you know me",
  "remember my name is nick", "my name is nick", "i'm nick", "call me nick"],
"compliment": [
  "you're smart", "youre cool", "i like you", "you're good at this", "nice work",
  "you're funny", "best ai", "you're better than the others", "impressive",
  "that was clever", "you're actually good"],
"insult": [
  "you're dumb", "youre stupid", "you suck", "that's wrong idiot", "useless",
  "you're broken", "bad answer", "terrible", "you don't know anything", "trash"],
"confused": [
  "what", "huh", "what do you mean", "i don't follow", "that makes no sense",
  "come again", "pardon", "explain that", "wait what", "??", "?"],
"image_request": [
  "draw a dragon", "make me an image", "create a picture of a cat", "draw a sunset",
  "generate an image", "paint a mountain", "illustrate a robot", "picture of a forest",
  "draw me a spaceship", "make art of a city", "design a logo", "draw a flower"],
"video_request": [
  "make a video", "animate a rocket", "create an animation", "video of a waterfall",
  "make a clip of a fox running", "animate this", "short film of a storm",
  "make an animated scene", "video of waves"],
"chitchat": [
  "i like cats", "i love music", "my favorite game is minecraft", "i play guitar",
  "im learning python", "i'm building a game", "i went to the beach", "it's raining here",
  "i have a dog", "i'm in school", "i work at a shop", "i live in canada",
  "i watched a movie", "my friend is annoying", "i got a new phone", "im hungry",
  "the weather is nice", "i hate mondays", "i want to be a developer"],
}

# ---------------------------------------------------------------------------
# Conversational prose. This is what teaches the vectors how casual English
# actually hangs together, and gives the n-gram model natural phrasing to score
# candidate wordings against.
# ---------------------------------------------------------------------------
CHAT_PROSE = """
Hey, what's up. Not much going on here, just hanging out. What are you working on today.
That sounds pretty fun honestly. I like where that is going. Tell me more about it when you get a chance.
Yeah that makes sense to me. I would probably do the same thing in that situation.
Honestly that is a good question and I had to think about it for a second.
Okay so here is the short version, and then I can go deeper if you want.
The quick answer is yes, but there is a catch worth knowing about.
I am not totally sure about that one, so take it with a grain of salt.
That part I actually do know well, so let me lay it out properly.
Wait, that is a great point. I had not thought about it that way before.
Fair enough. If that is what you are going for then the approach changes a bit.
Let me back up a second, because the setup matters more than the answer here.
Right, so the main thing to understand is how the pieces fit together.
Think of it like this. Once you see it that way it is hard to unsee.
The reason it works is simpler than it looks from the outside.
Here is where most people get tripped up, and it is an easy thing to miss.
That is the part that confused me too when I first ran into it.
Honestly, you are closer than you think. One small change and it should click.
Nice, that is exactly the right instinct. Keep pulling on that thread.
Okay that is rough, I am sorry. Do you want to talk about it or would a distraction help more.
That sounds genuinely frustrating. Anyone would be annoyed by that.
Take your time, there is no rush on this. We can pick it up whenever.
You have got this. Seriously, the hard part is already behind you.
Congrats, that is a big deal. You should be proud of that one.
That is hilarious. I did not see that coming at all.
Nah that is wild. How did that even happen.
Okay wait, say that again, because I want to make sure I understood.
So what you are describing is basically two problems stacked on top of each other.
Let me give you a concrete example, because it will make more sense than the theory.
There are a few ways to do this. The simplest one first, then the nicer one.
If I had to pick, I would go with the second option, mostly because it is easier to change later.
It depends a lot on what you care about more, speed or flexibility.
Start smaller than you think you need to. You can always add to it.
The trick is to get something working badly, then make it good.
Do not try to plan the whole thing up front. It never survives contact with the actual work.
Test the boring part first, because that is usually where the bug lives.
Read the error message properly. It is usually telling you exactly what is wrong.
Name things clearly and half your problems disappear on their own.
If it feels hard, the design is probably fighting you rather than the problem.
Break it into the smallest piece you can finish today, then do that.
I would sleep on it honestly. Decisions like that look different in the morning.
What is the actual goal here. Sometimes the question changes once that is clear.
Do you want the fast answer or the proper one.
Want me to walk through it step by step, or just give you the fix.
Let me know if that lands or if I should try explaining it another way.
Makes sense. Anything else you want to dig into on that.
Cool, glad that helped. Ping me if it breaks again.
That is a good instinct. I would trust it here.
Honestly I think you are overthinking it. The simple version is fine.
Okay real talk, that plan has one weak spot and it is worth fixing now.
Sure, I can do that. Give me the details and I will put something together.
Alright, here is a first pass. Tell me what to change.
I went a bit further than you asked, so feel free to cut whatever does not fit.
One thing to watch out for is how it behaves when the input is empty.
The edge cases are where this kind of thing usually falls over.
That is the whole idea, yeah. You have got it.
Exactly. And once you have that, the rest follows pretty naturally.
Pretty much, though there is one detail I glossed over.
Close. The one difference is which side does the work.
Not quite, but you are on the right track. The part to fix is the order.
Good morning. How did you sleep.
Late night session. Respect. What are you building.
Long day. What is on your mind.
Honestly same. Some days are just like that.
I would do the easy one first, for the momentum if nothing else.
Small wins add up faster than people expect.
Whatever you pick, just pick. Deciding is most of the cost.
That is a really specific detail and it is what makes the idea good.
I like it. It is weird in a way that works.
That could genuinely be great with a bit of tightening.
The bones are solid. It is the middle that needs work.
Keep the first idea. It had more character.
Yeah I would cut that part. It is doing less than you think.
More of that, less of the setup. Get to the good bit sooner.
What made you think of that. I am curious where it came from.
How long have you been into that.
What kind of thing are you into.
That is cool, I did not know you were into that.
Nice, how is that going so far.
Did it work out in the end.
So what happened next.
Okay that changes things. Let me rethink it.
Fair, I was wrong about that part. Here is the corrected version.
Good catch, that was my mistake. Thanks for flagging it.
Let me double check that before you rely on it.
I would verify that one somewhere else, since I could be out of date.
That is outside what I actually know, so I do not want to guess.
I genuinely do not know. I could give you a guess but I would rather not pretend.
Here is what I am confident about, and here is where it gets fuzzy.
The honest answer is that nobody really knows yet.
"""

# ---------------------------------------------------------------------------
# Visual lexicon. concept -> words that should route to it.
# The art engine has a draw routine for every concept listed here.
# ---------------------------------------------------------------------------
VISUAL = {
# subjects
"dragon":    ["dragon", "wyvern", "drake", "serpent", "hydra", "leviathan", "wyrm"],
"cat":       ["cat", "kitten", "kitty", "feline", "tabby", "lion", "tiger", "panther", "lynx"],
"dog":       ["dog", "puppy", "wolf", "fox", "husky", "hound", "coyote", "shiba"],
"bird":      ["bird", "eagle", "owl", "raven", "crow", "sparrow", "hawk", "falcon", "phoenix", "parrot", "crane", "heron"],
"fish":      ["fish", "shark", "whale", "dolphin", "koi", "goldfish", "orca", "trout", "salmon"],
"butterfly": ["butterfly", "moth", "dragonfly", "firefly", "bee", "insect"],
"horse":     ["horse", "unicorn", "pony", "stallion", "pegasus", "deer", "stag", "elk"],
"bear":      ["bear", "panda", "cub", "grizzly"],
"rabbit":    ["rabbit", "bunny", "hare"],
"robot":     ["robot", "android", "droid", "mech", "cyborg", "automaton", "bot"],
"person":    ["person", "girl", "boy", "man", "woman", "figure", "child", "kid", "hero", "knight", "wizard", "warrior", "traveler", "explorer", "astronaut", "ninja", "samurai", "pirate"],
"rocket":    ["rocket", "launch", "missile", "shuttle", "booster"],
"spaceship": ["spaceship", "starship", "ufo", "saucer", "cruiser", "fighter", "spacecraft"],
"car":       ["car", "truck", "van", "vehicle", "racer", "jeep", "bus"],
"bike":      ["bike", "bicycle", "motorcycle", "scooter"],
"boat":      ["boat", "ship", "sailboat", "yacht", "canoe", "galleon", "raft", "ferry"],
"plane":     ["plane", "airplane", "jet", "aircraft", "biplane", "glider"],
"train":     ["train", "locomotive", "railway", "tram"],
"house":     ["house", "cabin", "cottage", "hut", "home", "barn", "shack", "lodge"],
"castle":    ["castle", "fortress", "palace", "citadel", "keep", "tower", "temple", "shrine"],
"city":      ["city", "skyline", "downtown", "metropolis", "buildings", "skyscraper", "town", "village"],
"lighthouse":["lighthouse", "beacon"],
"bridge":    ["bridge", "viaduct", "overpass"],
"windmill":  ["windmill", "mill", "turbine"],
"tree":      ["tree", "oak", "pine", "palm", "willow", "forest", "woods", "jungle", "bamboo", "birch", "grove"],
"flower":    ["flower", "rose", "tulip", "sunflower", "lotus", "daisy", "blossom", "cherry", "sakura", "lily", "orchid"],
"mushroom":  ["mushroom", "toadstool", "fungus"],
"cactus":    ["cactus", "succulent"],
"mountain":  ["mountain", "mountains", "peak", "cliff", "volcano", "canyon", "ridge", "hill", "hills", "mesa"],
"island":    ["island", "atoll", "isle"],
"waterfall": ["waterfall", "cascade", "falls"],
"lake":      ["lake", "pond", "river", "stream", "creek", "lagoon"],
"desert":    ["desert", "dune", "dunes", "sahara", "wasteland"],
"campfire":  ["campfire", "fire", "bonfire", "flame", "hearth", "torch"],
"tent":      ["tent", "camp", "campsite"],
"balloon":   ["balloon", "airship", "zeppelin", "blimp", "hot air balloon"],
"crystal":   ["crystal", "gem", "diamond", "geode", "amethyst", "jewel"],
"sword":     ["sword", "blade", "katana", "dagger", "excalibur"],
"book":      ["book", "tome", "scroll", "grimoire"],
"clock":     ["clock", "watch", "hourglass", "sundial"],
"lantern":   ["lantern", "lamp", "candle", "streetlight"],
"portal":    ["portal", "gate", "rift", "vortex", "wormhole"],
"planet":    ["planet", "world", "mars", "jupiter", "saturn", "earth", "globe"],
"moon":      ["moon", "crescent", "luna"],
"sun":       ["sun", "sunrise", "sunset", "dawn", "dusk", "solar"],
"star":      ["star", "stars", "starfield", "constellation", "galaxy", "nebula", "cosmos", "universe", "space"],
"cloud":     ["cloud", "clouds", "cumulus", "fog", "mist", "haze"],
"rain":      ["rain", "rainy", "storm", "downpour", "drizzle", "thunderstorm"],
"snow":      ["snow", "snowy", "blizzard", "snowfall", "winter", "frost", "ice", "glacier"],
"lightning": ["lightning", "thunder", "bolt", "electric"],
"rainbow":   ["rainbow", "prism"],
"aurora":    ["aurora", "northern lights", "borealis"],
"heart":     ["heart", "love", "valentine"],
"eye":       ["eye", "iris", "pupil"],
"skull":     ["skull", "bones", "skeleton"],
"ghost":     ["ghost", "spirit", "phantom", "wraith", "specter"],
"slime":     ["slime", "blob", "goo", "ooze"],
"cake":      ["cake", "cupcake", "dessert", "pastry", "donut"],
"coffee":    ["coffee", "cup", "mug", "tea", "latte"],
"pizza":     ["pizza", "slice"],
"fruit":     ["apple", "orange", "fruit", "banana", "berry", "cherry fruit", "lemon", "peach"],
"guitar":    ["guitar", "instrument", "violin", "cello", "banjo", "ukulele"],
"piano":     ["piano", "keyboard", "keys"],
"headphones":["headphones", "headset", "earphones"],
"controller":["controller", "gamepad", "joystick", "console"],
"computer":  ["computer", "laptop", "monitor", "screen", "pc", "desktop"],
"phone":     ["phone", "smartphone", "mobile"],
"camera":    ["camera", "lens", "photography"],
"key":       ["key", "lock", "keyhole"],
"crown":     ["crown", "tiara", "diadem"],
"mask":      ["mask", "visor", "helmet"],
"umbrella":  ["umbrella", "parasol"],
"balloon2":  ["party balloon", "balloons"],
"kite":      ["kite"],
"anchor":    ["anchor"],
"compass":   ["compass", "navigation"],
"potion":    ["potion", "flask", "vial", "elixir", "bottle"],
"gear":      ["gear", "cog", "machinery", "gears"],
"atom":      ["atom", "molecule", "particle", "nucleus"],
"dna":       ["dna", "helix", "genome"],
"brain":     ["brain", "mind", "neuron"],
"chip":      ["chip", "circuit", "processor", "microchip", "motherboard"],
"cube":      ["cube", "box", "crate", "block"],
"orb":       ["orb", "sphere", "ball", "marble", "bubble"],
"pyramid":   ["pyramid", "obelisk", "monolith"],
"wave":      ["wave", "waves", "ocean", "sea", "surf", "tide", "water"],
"beach":     ["beach", "shore", "coast", "sand", "seaside"],
"road":      ["road", "street", "highway", "path", "trail"],
"field":     ["field", "meadow", "grass", "plains", "prairie", "farm", "wheat"],
"garden":    ["garden", "park", "greenhouse"],
"room":      ["room", "bedroom", "interior", "desk", "studio", "library", "kitchen"],
"window":    ["window", "portal window", "porthole"],
"door":      ["door", "doorway", "archway"],
"stairs":    ["stairs", "staircase", "steps"],
"maze":      ["maze", "labyrinth"],
"chess":     ["chess", "pawn", "knight piece"],
"dice":      ["dice", "die"],
"card":      ["card", "cards", "playing card"],
"trophy":    ["trophy", "medal", "award", "cup trophy"],
"rocketship":["rocketship"],
"satellite": ["satellite", "probe", "orbiter"],
"telescope": ["telescope", "observatory"],
"lab":       ["lab", "laboratory", "beaker", "test tube"],
"gun":       ["blaster", "raygun", "laser"],
"shield":    ["shield", "buckler", "armor"],
"axe":       ["axe", "hammer", "mace", "pickaxe"],
"bow":       ["bow", "arrow", "archery"],
"wand":      ["wand", "staff", "scepter"],
"ring":      ["ring", "band"],
"scales":    ["scales", "balance", "justice"],
"feather":   ["feather", "quill", "plume"],
"leaf":      ["leaf", "leaves", "foliage", "fern", "ivy"],
"vine":      ["vine", "vines", "creeper"],
"rock":      ["rock", "stone", "boulder", "pebble"],
"bone":      ["bone", "fossil"],
"egg":       ["egg", "nest"],
"snail":     ["snail", "shell"],
"crab":      ["crab", "lobster", "shrimp"],
"octopus":   ["octopus", "squid", "kraken", "tentacle", "jellyfish"],
"frog":      ["frog", "toad", "tadpole"],
"snake":     ["snake", "cobra", "python snake", "viper"],
"lizard":    ["lizard", "gecko", "chameleon", "iguana"],
"turtle":    ["turtle", "tortoise"],
"dinosaur":  ["dinosaur", "trex", "raptor", "stegosaurus", "triceratops"],
"elephant":  ["elephant", "mammoth", "rhino", "hippo"],
"monkey":    ["monkey", "ape", "gorilla", "chimp"],
"sheep":     ["sheep", "lamb", "goat", "cow", "bull", "pig", "chicken", "duck"],
"penguin":   ["penguin", "puffin"],
"seal":      ["seal", "walrus", "otter"],
"bat":       ["bat", "vampire bat"],
"spider":    ["spider", "web", "scorpion"],
"ant":       ["ant", "beetle", "ladybug"],
}

# Colour words the scene parser understands, as hex anchors.
COLORS = {
"red": "#e03b3b", "crimson": "#c0202e", "scarlet": "#e8332a", "maroon": "#7a1f2b",
"orange": "#f2892f", "amber": "#f0a92b", "tangerine": "#ff7d2e", "rust": "#b25a28",
"yellow": "#f2d14b", "gold": "#e8b647", "golden": "#e8b647", "lemon": "#f5e463",
"green": "#3fae63", "emerald": "#1f9d6a", "lime": "#8fd44a", "olive": "#7d8c3c",
"mint": "#7fdcb4", "forest": "#245c3c", "sage": "#9bb493", "jade": "#2fa584",
"teal": "#2aa198", "cyan": "#38c6d9", "turquoise": "#35c4b5", "aqua": "#5fd8e0",
"blue": "#3f7fe0", "azure": "#3d9be9", "navy": "#1d2f63", "cobalt": "#2c52c4",
"sapphire": "#2a56b8", "sky": "#7cc1f0", "indigo": "#4a44b5", "periwinkle": "#94a7ef",
"purple": "#8b52d6", "violet": "#7a4fd1", "lavender": "#b9a4ea", "magenta": "#d04ac0",
"plum": "#6e3a70", "orchid": "#c072d8",
"pink": "#f07fa8", "rose": "#e86a8e", "blush": "#f5adbd", "coral": "#f5786a",
"salmon": "#f08d7d", "peach": "#f7bc9a",
"brown": "#8a5a3a", "tan": "#c79a6c", "beige": "#ddc9a8", "chocolate": "#5c3a26",
"copper": "#b5713c", "bronze": "#a3712f", "sepia": "#6b4a32",
"black": "#121722", "charcoal": "#26303f", "grey": "#8a94a6", "gray": "#8a94a6",
"silver": "#c3ccda", "white": "#f4f7fc", "cream": "#f6efdc", "ivory": "#f5f0e2",
"neon": "#39f5c8", "pastel": "#e8c9e8", "rainbow": "#ff6bd6", "chrome": "#cfd8e6",
}

# Named art styles the renderer has a look for.
STYLES = {
"illustration": ["illustration", "illustrated", "digital art", "artwork", "painting", "painted", "default"],
"flat":         ["flat", "minimal", "minimalist", "vector", "clean", "simple", "geometric", "bauhaus"],
"pixel":        ["pixel", "pixel art", "8 bit", "8bit", "16 bit", "retro game", "sprite"],
"lowpoly":      ["low poly", "lowpoly", "polygon", "faceted", "triangles"],
"neon":         ["neon", "cyberpunk", "synthwave", "vaporwave", "retrowave", "outrun", "glow"],
"watercolor":   ["watercolor", "watercolour", "soft", "dreamy", "pastel wash", "ink wash"],
"cartoon":      ["cartoon", "comic", "anime", "manga", "chibi", "cute", "kawaii", "toon"],
"sketch":       ["sketch", "pencil", "line art", "lineart", "drawing", "doodle", "outline"],
"noir":         ["noir", "monochrome", "black and white", "grayscale", "greyscale", "silhouette"],
"gothic":       ["gothic", "dark", "horror", "spooky", "eerie", "creepy", "grim", "haunted"],
"storybook":    ["storybook", "fairytale", "whimsical", "childrens book", "folk"],
"cinematic":    ["cinematic", "epic", "dramatic", "movie", "poster", "widescreen"],
"isometric":    ["isometric", "iso", "diorama", "tiny world"],
"blueprint":    ["blueprint", "schematic", "technical", "diagram", "wireframe"],
}

# Time of day / atmosphere cues.
TIMES = {
"dawn":   ["dawn", "sunrise", "morning", "daybreak", "early"],
"day":    ["day", "daytime", "noon", "midday", "afternoon", "bright", "sunny"],
"golden": ["golden hour", "sunset", "dusk", "evening", "twilight", "sundown"],
"night":  ["night", "midnight", "nighttime", "dark", "starry", "moonlit", "nocturnal"],
"space":  ["space", "orbit", "deep space", "cosmic", "interstellar", "void"],
"under":  ["underwater", "undersea", "submerged", "deep sea", "aquatic"],
}

WEATHER = {
"clear": ["clear", "calm"],
"rain":  ["rain", "rainy", "raining", "drizzle", "downpour", "wet"],
"storm": ["storm", "stormy", "thunderstorm", "lightning", "tempest"],
"snow":  ["snow", "snowy", "snowing", "blizzard", "winter"],
"fog":   ["fog", "foggy", "mist", "misty", "haze", "hazy"],
"wind":  ["wind", "windy", "breeze", "gust"],
"cloud": ["cloudy", "overcast", "clouds"],
}

MOODS = {
"calm":    ["calm", "peaceful", "serene", "quiet", "still", "gentle", "cozy", "warm", "soft"],
"epic":    ["epic", "majestic", "grand", "heroic", "powerful", "vast", "legendary", "mighty"],
"sad":     ["sad", "lonely", "melancholy", "somber", "wistful", "bleak"],
"happy":   ["happy", "joyful", "cheerful", "playful", "bright", "fun", "lively"],
"tense":   ["tense", "ominous", "menacing", "dangerous", "eerie", "uneasy"],
"mystic":  ["mystical", "magical", "enchanted", "ethereal", "otherworldly", "surreal", "dreamlike"],
}

# Emotion seed words (valence, arousal) in -1..1, spread over the vector space
# by label propagation during training.
EMOTION_SEEDS = {
"happy": (0.9, 0.6), "joy": (0.95, 0.7), "love": (0.95, 0.5), "great": (0.8, 0.5),
"amazing": (0.9, 0.8), "good": (0.7, 0.3), "nice": (0.6, 0.2), "fun": (0.8, 0.7),
"excited": (0.8, 0.95), "proud": (0.8, 0.5), "calm": (0.5, -0.6), "peaceful": (0.6, -0.7),
"thanks": (0.7, 0.2), "perfect": (0.85, 0.4), "cool": (0.6, 0.3), "win": (0.8, 0.6),
"sad": (-0.85, -0.3), "angry": (-0.8, 0.8), "mad": (-0.75, 0.75), "hate": (-0.9, 0.7),
"bad": (-0.7, 0.2), "terrible": (-0.9, 0.5), "awful": (-0.9, 0.5), "sucks": (-0.75, 0.4),
"tired": (-0.4, -0.8), "exhausted": (-0.5, -0.85), "bored": (-0.4, -0.6),
"scared": (-0.7, 0.8), "afraid": (-0.7, 0.7), "worried": (-0.6, 0.5),
"anxious": (-0.7, 0.7), "stressed": (-0.7, 0.7), "lonely": (-0.8, -0.2),
"frustrated": (-0.65, 0.6), "annoyed": (-0.6, 0.5), "confused": (-0.3, 0.3),
"broken": (-0.6, 0.1), "failed": (-0.7, 0.2), "lost": (-0.5, 0.1), "hurt": (-0.8, 0.3),
"sorry": (-0.3, 0.1), "stuck": (-0.5, 0.3), "difficult": (-0.4, 0.3), "hard": (-0.3, 0.3),
"easy": (0.5, -0.2), "simple": (0.4, -0.2), "help": (0.1, 0.4), "please": (0.3, 0.2),
}
