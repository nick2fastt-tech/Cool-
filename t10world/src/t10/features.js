// T10 World - the feature library.
//
// This is the roadmap as data, not as a pile of buttons. Every line below is a
// single capability: which part of the game it belongs to, what it does, and
// whether it is live in the build you are playing, partly there, or still
// planned. T10 can search it, count it and read it back by area, and
// `addFeature` is how the list keeps growing — a new idea is one row.
//
// status:  'live'    — you can do it right now, and `say` is how you ask
//          'partial' — some of it works; the row says which part
//          'planned' — designed and queued, not yet in the build

export const CATEGORIES = [
  { key: 'world',     name: 'World creation' },
  { key: 'npc',       name: 'NPC behaviour' },
  { key: 'animals',   name: 'Animals' },
  { key: 'vehicles',  name: 'Vehicles' },
  { key: 'buildings', name: 'Buildings' },
  { key: 'weather',   name: 'Weather' },
  { key: 'nature',    name: 'Nature' },
  { key: 'physics',   name: 'Physics' },
  { key: 'character', name: 'Character customisation' },
  { key: 'activities',name: 'Activities' },
  { key: 'powers',    name: 'Powers' },
  { key: 'creatures', name: 'Creatures' },
  { key: 'sandbox',   name: 'Sandbox interactions' },
  { key: 'events',    name: 'World events' },
  { key: 'environment', name: 'Environmental systems' },
  { key: 'animation', name: 'Animation' },
  { key: 'audio',     name: 'Audio' },
  { key: 'ui',        name: 'UI' },
  { key: 'access',    name: 'Accessibility' },
  { key: 'mobile',    name: 'Mobile optimisation' },
];

export const CATEGORY_NAME = {};
for (const c of CATEGORIES) CATEGORY_NAME[c.key] = c.name;

export const FEATURES = [];
const seen = new Set();

/**
 * Add one feature. This is the expansion point: a new idea is a single call,
 * from this file or from anywhere else that imports it.
 * @param def { cat, id, title, detail, status, say }
 */
export function addFeature(def) {
  if (!def || !def.cat || !def.title) return null;
  const id = def.id || (def.cat + '_' + slug(def.title));
  if (seen.has(id)) return null;
  seen.add(id);
  const rec = {
    id,
    cat: def.cat,
    category: CATEGORY_NAME[def.cat] || def.cat,
    title: def.title,
    detail: def.detail || '',
    status: def.status || 'planned',
    say: def.say || '',
  };
  FEATURES.push(rec);
  return rec;
}

/** Bulk loader: rows are [title, detail, status, say]. */
function cat(key, rows) {
  for (const r of rows) addFeature({ cat: key, title: r[0], detail: r[1], status: r[2] || 'planned', say: r[3] || '' });
}

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }

// =============================================================================
// World creation
// =============================================================================
cat('world', [
  ['Separate saved worlds', 'Every world is its own slot with its own seed, city, people and rules.', 'live', 'T10 save my world'],
  ['World library', 'The splash screen lists every world you have, newest first.', 'live', ''],
  ['Create a world', 'Name it, pick where you start, the hour, the weather and how busy it is.', 'live', ''],
  ['Load a world', 'Open any saved world straight from the library.', 'live', ''],
  ['Rename a world', 'Change the name without touching anything inside it.', 'live', ''],
  ['Duplicate a world', 'A branch: the same city and seed, a separate history.', 'live', ''],
  ['Delete a world', 'Remove a slot, with a confirmation first.', 'live', ''],
  ['Autosave on leaving', 'Leaving a world writes it out before the splash screen returns.', 'live', 'T10 leave the world'],
  ['World seed control', 'Type a seed and get the same city back every time.', 'live', ''],
  ['Starting district', 'Wake up downtown, in the suburbs, on the waterfront, in a park or at random.', 'live', ''],
  ['Starting hour', 'Dawn, noon, golden hour, night — whatever you want to open your eyes to.', 'live', ''],
  ['Starting weather', 'Clear, overcast, rain, storm, fog or snow from the first frame.', 'live', ''],
  ['Population dial', 'A quiet city, a normal one, or one that is far too full.', 'live', ''],
  ['World rules saved per world', 'Gravity, time scale, gore level, immortality and flight ride along with the save.', 'live', ''],
  ['Spawned props persist', 'Anything you put down is still there when you come back.', 'live', ''],
  ['World size selection', 'Choose a small dense city or a sprawl before generation.', 'partial', 'T10 how big is this world'],
  ['World templates', 'Start from a preset: empty city, overgrown city, endless night, outbreak already running.', 'planned', ''],
  ['Import and export a world', 'Copy a world out as text and paste it back on another device.', 'planned', ''],
  ['World thumbnails', 'Each library row shows a snapshot of where you were standing.', 'planned', ''],
  ['World notes', 'A free-text page per world for whatever you want to remember about it.', 'planned', ''],
  ['Favourite worlds', 'Pin the ones you keep going back to at the top of the library.', 'planned', ''],
  ['Per-world difficulty of the crowd', 'How quickly people panic, how fast an outbreak moves, set per world.', 'planned', ''],
  ['Terrain style', 'Flat, hilly, coastal or island before the streets are laid out.', 'planned', ''],
  ['Season at creation', 'Start the world in spring, summer, autumn or deep winter.', 'planned', ''],
  ['Named districts you choose', 'Rename the parts of town and have T10 use your names.', 'planned', ''],
]);

// =============================================================================
// NPC behaviour
// =============================================================================
cat('npc', [
  ['Daily schedules', 'Everyone has somewhere to be, and the hour decides where.', 'live', 'T10 what is that person doing'],
  ['Personalities', 'Curiosity, energy and mood change how a person reacts to you.', 'live', ''],
  ['Conversation', 'Walk up and talk; they answer differently by time of day and weather.', 'live', 'T10 talk to that person'],
  ['Follow you', 'Ask someone to come along and they keep pace.', 'live', 'T10 make them follow me'],
  ['Freeze in place', 'Everyone nearby stops mid-step.', 'live', 'T10 freeze everyone'],
  ['Mind control', 'Take someone over and they do what you do.', 'live', 'T10 control their mind'],
  ['Make them fall for you', 'They trail you and will not be talked out of it.', 'live', 'T10 make them love me'],
  ['Dancing', 'A street full of people dancing on request.', 'live', 'T10 make everyone dance'],
  ['Panic', 'Fear spreads, people sprint, and they run out of breath.', 'live', ''],
  ['Stamina while fleeing', 'Nobody sprints forever — eighteen seconds and they are walking.', 'live', ''],
  ['Turning on each other', 'In a riot, everybody is a target, including other rioters.', 'live', 'T10 start a riot'],
  ['Infection and reanimation', 'The bitten turn, and the downed can get back up wrong.', 'live', ''],
  ['Feeding', 'The infected stop at a body rather than walking past it.', 'live', ''],
  ['Background population', 'People you cannot see are still walking somewhere, cheaply.', 'live', ''],
  ['Crowd LOD tiers', 'Full AI up close, simplified in the middle, a heartbeat at the edge.', 'live', ''],
  ['Indoor errands', 'People go into buildings and come back out later.', 'live', ''],
  ['Name and remember you', 'Someone you have spoken to greets you differently next time.', 'partial', ''],
  ['Group behaviour', 'Friends walk together, wait for each other and leave together.', 'planned', ''],
  ['Jobs with places', 'A barista is behind that counter, not just nearby.', 'planned', ''],
  ['Queues', 'People line up for a door, a till or a train and take turns.', 'planned', ''],
  ['Reactions to your outfit', 'What you are wearing changes what strangers say.', 'planned', ''],
  ['Phone calls', 'People stop, take a call, and carry on.', 'partial', ''],
  ['Crowd mood', 'A whole street can be cheerful, tense or grim, and it shows.', 'planned', ''],
  ['Relationships between NPCs', 'Two people who know each other behave differently when they meet.', 'planned', ''],
  ['Witness memory', 'What people saw you do changes how they treat you for a while.', 'planned', ''],
]);

// =============================================================================
// Animals
// =============================================================================
cat('animals', [
  ['Eighteen species', 'Dogs, cats, pigeons, gulls, deer, rabbits, cows, horses, foxes and more.', 'live', 'T10 spawn a dog'],
  ['Procedural bodies', 'Every animal is built from its own numbers, no two identical.', 'live', ''],
  ['Gaits', 'Four-legged walk, two-legged strut, hopping and flight all move differently.', 'live', ''],
  ['Flocking', 'Birds and herd animals stay together and turn together.', 'live', ''],
  ['Grazing', 'Cattle, sheep and horses put their heads down and stay a while.', 'live', ''],
  ['Fleeing', 'Get too close and they go, at their own top speed.', 'live', ''],
  ['Sleeping at night', 'Most animals settle down after dark.', 'live', ''],
  ['Habitat spawning', 'Gulls at the water, deer in the trees, pigeons downtown.', 'live', ''],
  ['Animal calls', 'Each species has its own synthesised voice.', 'live', ''],
  ['Follow you', 'Ask an animal to come with you and it will.', 'live', 'T10 make that dog follow me'],
  ['Clear the animals', 'Empty the world of them in one line.', 'live', 'T10 remove all animals'],
  ['Density control', 'More of them, fewer of them, or none.', 'live', 'T10 more animals'],
  ['Pets that stay', 'An animal that belongs to you and is there when you come back.', 'planned', ''],
  ['Predators and prey', 'A fox that actually hunts a rabbit, and a rabbit that knows it.', 'planned', ''],
  ['Nesting and young', 'Animals that raise something smaller than themselves.', 'planned', ''],
  ['Riding a horse', 'Get on, and steer.', 'planned', ''],
  ['Animals react to weather', 'Birds go quiet before a storm and shelter during one.', 'partial', ''],
  ['Fish and water life', 'Something under the surface worth looking at.', 'planned', ''],
  ['Insects', 'Bees in the parks, moths under the street lights.', 'planned', ''],
  ['Animal naming', 'Name one and T10 uses the name.', 'planned', ''],
  ['Strays with territory', 'A cat that owns one block and defends it.', 'planned', ''],
  ['Animals and the apocalypse', 'Dogs that bark at the infected and refuse to go near them.', 'planned', ''],
  ['Wildlife density by district', 'Parks thick with life, downtown almost empty.', 'partial', ''],
  ['Animal size variation', 'Grow one, shrink one, keep it.', 'planned', ''],
  ['Herds that migrate', 'A group that crosses the map over an in-game day.', 'planned', ''],
]);

// =============================================================================
// Vehicles
// =============================================================================
cat('vehicles', [
  ['Drivable cars', 'Get in, drive, get out.', 'live', 'T10 spawn a car'],
  ['Traffic that obeys lights', 'Cars stop, wait, and go when the light changes.', 'live', ''],
  ['Vehicle classes', 'Sedans, sports cars, trucks, vans, buses and taxis.', 'live', 'T10 spawn a truck'],
  ['Engine audio', 'A synthesised engine that follows the revs.', 'live', ''],
  ['Horn', 'Because you will want to.', 'live', ''],
  ['Headlights at night', 'On after dark, off at dawn.', 'live', ''],
  ['Passenger seats', 'Ride along instead of driving.', 'live', ''],
  ['Free the cars', 'Cut traffic control loose during an apocalypse and watch.', 'live', ''],
  ['Traffic density', 'Gridlock or empty streets on request.', 'live', 'T10 more traffic'],
  ['Teleport your car to you', 'Wherever you left it, it comes back.', 'live', 'T10 bring my car'],
  ['Car colours on request', 'Ask for a red one and get a red one.', 'live', 'T10 spawn a red car'],
  ['Damage that shows', 'Panels that dent where you hit something.', 'planned', ''],
  ['Motorbikes', 'Two wheels, a lean, and no roof.', 'planned', ''],
  ['Bicycles', 'For you and for the crowd.', 'planned', ''],
  ['Emergency vehicles that respond', 'Sirens that actually arrive somewhere.', 'partial', ''],
  ['Fuel', 'Optional, off by default, and a reason to stop somewhere.', 'planned', ''],
  ['Car radio', 'Procedural stations that change by district.', 'planned', ''],
  ['Parking that looks lived-in', 'Cars parked badly, doors left open, one on the kerb.', 'partial', ''],
  ['Boats', 'The water is right there.', 'planned', ''],
  ['Helicopters', 'Take off from a roof.', 'planned', ''],
  ['Trains you can drive', 'Take the subway train instead of riding it.', 'planned', ''],
  ['Convoys', 'A line of vehicles that travels together.', 'planned', ''],
  ['Vehicle customisation', 'Paint, wheels, ride height, all saved per world.', 'planned', ''],
  ['Crashes that matter', 'A pile-up that blocks a street until something clears it.', 'planned', ''],
  ['Vehicle physics detail by distance', 'Full simulation near you, a cheap approximation far away.', 'live', ''],
]);

// =============================================================================
// Buildings
// =============================================================================
cat('buildings', [
  ['Procedural city blocks', 'Streets, lots and buildings generated from the world seed.', 'live', ''],
  ['Building kinds', 'Houses, apartments, shops, offices, towers, warehouses and malls.', 'live', ''],
  ['Interiors you can enter', 'Every door opens into a real floor plan with rooms, furniture and walls that stop you.', 'live', 'T10 take me inside'],
  ['Window lights at night', 'Lit windows that come on with the dark.', 'live', ''],
  ['Rooftop detail', 'Vents, tanks, aerials and stairwell housings.', 'live', ''],
  ['Facade styles', 'Brick, glass, concrete, painted render, each with its own texture.', 'live', ''],
  ['Shopfronts', 'Signage, awnings and window displays at street level.', 'live', ''],
  ['Landmarks', 'Buildings big enough to navigate by, and T10 knows their names.', 'live', 'T10 take me to the tower'],
  ['Chunked streaming', 'Buildings load and unload around you in 120-metre tiles.', 'live', ''],
  ['Occlusion by chunk', 'A whole block hidden in one test when it is behind you.', 'live', ''],
  ['Fire escapes', 'Iron stairs down the side of the older blocks.', 'live', ''],
  ['Construction sites', 'A half-built tower with scaffold and a crane.', 'planned', ''],
  ['Enterable shops with staff', 'Shelves, stock and a counter are there; the person behind it is not, yet.', 'partial', 'T10 take me into a shop'],
  ['Climbable buildings', 'Hand-holds and ledges instead of flying.', 'planned', ''],
  ['Building damage', 'Broken windows and scorch marks that persist.', 'planned', ''],
  ['Your own building', 'Place a structure and have it stay in the world.', 'planned', ''],
  ['Interior lighting that reacts', 'Ceiling panels in every room, and lamps for the rooms nearest you.', 'live', ''],
  ['Basements and car parks', 'A layer under the street that is not the subway.', 'planned', ''],
  ['Rooftop gardens', 'Green roofs on the newer towers.', 'planned', ''],
  ['Building age', 'Older districts that look older, down to the brickwork.', 'partial', ''],
  ['Neon by district', 'A strip that glows at night and a suburb that does not.', 'partial', ''],
  ['Scaffolding and repairs', 'Buildings that are being worked on this week.', 'planned', ''],
  ['Interior variety', 'The floor plan comes from the lot, so no two buildings are laid out the same.', 'live', 'T10 what rooms are in here'],
  ['Address system', 'Every door has a number and T10 can send you to it.', 'planned', ''],
  ['Floor plans from the footprint', 'Rooms are split out of the building\'s own shape, so the inside fits the outside.', 'live', ''],
  ['Rooms with a purpose', 'Halls, kitchens, bedrooms, wards, classrooms, shop floors, offices, bars — furnished to match.', 'live', 'T10 what rooms are in here'],
  ['Walk out the way you came', 'The front doorway is a real gap: walk through it and you are back on the street.', 'live', 'T10 take me outside'],
  ['Building density control', 'A denser skyline or a flatter one, set at creation.', 'partial', ''],
]);

// =============================================================================
// Weather
// =============================================================================
cat('weather', [
  ['Clear, overcast, rain, storm, fog, snow', 'Six states, each with its own sky, light and sound.', 'live', 'T10 make it rain'],
  ['Smooth transitions', 'Weather arrives over a minute or two, not in one frame.', 'live', ''],
  ['Wet roads', 'Surfaces darken and reflect while it rains.', 'live', ''],
  ['Puddles', 'Standing water that catches the sky.', 'live', ''],
  ['Snow cover', 'Ground that whitens as it settles.', 'live', 'T10 make it snow'],
  ['Lightning and thunder', 'A flash that lights the street and a delayed crack.', 'live', 'T10 lightning'],
  ['Fog banks', 'Depth-based fog that swallows the far blocks.', 'live', 'T10 make it foggy'],
  ['Wind', 'Trees, cloth and rain all lean the same way.', 'live', ''],
  ['Rain sound by surface', 'It sounds different under a canopy than in the open.', 'partial', ''],
  ['People react to rain', 'They hurry, they complain, they take shelter.', 'live', ''],
  ['Weather forecast', 'Ask what is coming and get an answer.', 'live', 'T10 what is the weather'],
  ['Freeze the weather', 'Lock the current sky in place.', 'live', 'T10 keep it like this'],
  ['Hail', 'Short, loud and bouncing.', 'planned', ''],
  ['Heatwave', 'Shimmer over the asphalt and people moving slower.', 'planned', ''],
  ['Wind storms', 'Gusts strong enough to move loose objects.', 'planned', ''],
  ['Seasons', 'A year that turns, with weather odds that change with it.', 'planned', ''],
  ['Rainbows', 'After the rain, in the right light.', 'planned', ''],
  ['Sandstorms and ash', 'Not from here, but you can ask for it.', 'planned', ''],
  ['Flooding', 'Water that rises in the low streets during a storm.', 'planned', ''],
  ['Weather by district', 'Rain on the coast and clear downtown.', 'planned', ''],
  ['Cloud shapes', 'Volumetric cloud banks rather than a gradient.', 'partial', ''],
  ['Northern lights', 'On a clear night, if you ask.', 'planned', ''],
  ['Weather schedules', 'A week of weather planned in advance per world.', 'planned', ''],
  ['Storm cells you can watch move', 'See the rain coming across town before it reaches you.', 'planned', ''],
  ['Weather effect on driving', 'Longer stopping distances in the wet.', 'planned', ''],
]);

// =============================================================================
// Nature
// =============================================================================
cat('nature', [
  ['Parks', 'Open green space with paths, benches and trees.', 'live', 'T10 take me to a park'],
  ['Instanced trees', 'Thousands of them at the cost of a handful.', 'live', ''],
  ['Tree variety', 'Several species and sizes, mixed per chunk.', 'live', ''],
  ['Grass', 'Ground cover that thins with distance and quality.', 'live', ''],
  ['Water', 'A shoreline with a moving surface and reflections.', 'live', 'T10 take me to the water'],
  ['Beaches', 'Sand, gulls and a different footstep sound.', 'live', ''],
  ['Terrain height', 'The city is not flat; streets rise and fall.', 'live', ''],
  ['Seasonal colour', 'Foliage that changes with the time of year.', 'planned', ''],
  ['Flowers and undergrowth', 'Detail at ankle height in the parks.', 'planned', ''],
  ['Wind through leaves', 'Canopies that move with the weather.', 'partial', ''],
  ['Fallen leaves', 'They collect at kerbs and in corners.', 'planned', ''],
  ['Forests outside the city', 'Somewhere to drive to where there are no buildings.', 'partial', ''],
  ['Rivers', 'Running water with a current that carries things.', 'planned', ''],
  ['Cliffs and rock', 'Terrain features you have to go around.', 'planned', ''],
  ['Overgrowth mode', 'A city the plants have taken back.', 'planned', ''],
  ['Plant something', 'Put a tree where you want one and have it stay.', 'planned', ''],
  ['Day length by season', 'Short winter afternoons and long summer evenings.', 'planned', ''],
  ['Tides', 'A waterline that moves over the day.', 'planned', ''],
  ['Fireflies', 'On summer nights, near the water.', 'planned', ''],
  ['Bird song by time of day', 'A dawn chorus that is not there at midnight.', 'partial', ''],
  ['Mushrooms and moss', 'Small detail in the damp and the shade.', 'planned', ''],
  ['Vegetation LOD', 'Detail that drops off with distance and quality preset.', 'live', ''],
  ['Weather-driven growth', 'Grass that greens up after a week of rain.', 'planned', ''],
  ['Tree felling', 'Take one down and have the world remember.', 'planned', ''],
  ['Nature density control', 'More trees, fewer trees, or a city of concrete.', 'live', 'T10 more trees'],
]);

// =============================================================================
// Physics
// =============================================================================
cat('physics', [
  ['Gravity control', 'Set it from a fifth to five times normal.', 'live', 'T10 low gravity'],
  ['Thrown objects', 'Props that arc, land and stay where they land.', 'live', ''],
  ['Telekinesis throws', 'Lift everything loose in front of you and fire it.', 'live', 'T10 telekinesis'],
  ['Shockwaves', 'A blast that pushes people and objects away from a point.', 'live', ''],
  ['Ragdoll-ish knockdowns', 'People go down, lie there, and get themselves up.', 'live', ''],
  ['Vehicle collision', 'Cars that stop at walls instead of passing through them.', 'live', ''],
  ['Player collision', 'Buildings, cars, fences and street furniture all solid.', 'live', ''],
  ['Ground following', 'Feet, wheels and paws all sit on the actual surface.', 'live', ''],
  ['Jump and fall', 'Real arc, real landing, and a hard landing if it was far enough.', 'live', ''],
  ['Swimming', 'Enter water and stay on the surface.', 'live', ''],
  ['Distant physics reduction', 'Objects far away simulate more cheaply.', 'live', ''],
  ['Time scale', 'Slow the whole world down or speed it up.', 'live', 'T10 slow down time'],
  ['Explosion force', 'Blasts that move what is near them.', 'live', ''],
  ['Stacking objects', 'Put one thing on another and have it stay.', 'planned', ''],
  ['Breakable props', 'Things that come apart when they are hit hard enough.', 'planned', ''],
  ['Rope and cloth', 'Hanging cables and banners that swing.', 'planned', ''],
  ['Water buoyancy', 'Objects that float rather than sink.', 'planned', ''],
  ['Wind force on objects', 'Loose items that move in a storm.', 'planned', ''],
  ['Vehicle suspension', 'Weight transfer you can see in a corner.', 'partial', ''],
  ['Momentum on impact', 'Getting hit by a bus should send you somewhere.', 'partial', ''],
  ['Slippery surfaces', 'Ice and wet metal that change how you move.', 'planned', ''],
  ['Object mass', 'A bin throws differently from a bench.', 'planned', ''],
  ['Chain reactions', 'One falling thing knocking over the next.', 'planned', ''],
  ['Zero-gravity mode', 'Everything loose, including you.', 'partial', 'T10 turn off gravity'],
  ['Physics budget by preset', 'How much is simulated at once scales with the quality preset.', 'live', ''],
]);

// =============================================================================
// Character customisation
// =============================================================================
cat('character', [
  ['Full character creator', 'Build who you are before you walk out of the door.', 'live', ''],
  ['Body proportions', 'Height, build and muscle, all reflected in the mesh.', 'live', ''],
  ['Face sculpting', 'A head built from parameters rather than picked from a list.', 'live', ''],
  ['Skin tones', 'A range, applied to the whole body consistently.', 'live', ''],
  ['Hair styles', 'Several, each a real mesh that moves with you.', 'live', ''],
  ['Facial hair', 'Beards and brows as separate pieces.', 'live', ''],
  ['Six outfits per gender', 'Complete looks, not recolours.', 'live', 'T10 I wanna wear something new'],
  ['Change clothes any time', 'Ask and you are wearing something else.', 'live', 'T10 change my outfit'],
  ['Change your body any time', 'Taller, shorter, heavier, stronger, mid-game.', 'live', 'T10 make me taller'],
  ['Change your size', 'Small enough to be underfoot, or tall enough to see over the block.', 'live', 'T10 make me huge'],
  ['Your name', 'Tell T10 what to call you and it sticks.', 'live', 'T10 my name is'],
  ['Become a zombie', 'Turn yourself, with everything that comes with it.', 'live', 'T10 turn me into a zombie'],
  ['Skin tint effects', 'Powers and conditions colour you, reversibly.', 'live', ''],
  ['Accessories', 'Glasses, hats, bags, watches.', 'planned', ''],
  ['Outfit mixing', 'Top from one set, trousers from another.', 'planned', ''],
  ['Clothing colour picker', 'Any colour, not a preset list.', 'planned', ''],
  ['Wardrobe saved per world', 'The outfits you built stay with that world.', 'planned', ''],
  ['Scars, tattoos and marks', 'Non-gory body detail you place yourself.', 'planned', ''],
  ['Voice pitch', 'How you sound when you speak to people.', 'planned', ''],
  ['Walk style', 'Pick how you carry yourself.', 'planned', ''],
  ['Age appearance', 'Younger and older versions of the same face.', 'planned', ''],
  ['Save and load looks', 'Keep a look and apply it to a new world.', 'planned', ''],
  ['Randomise me', 'One button, a whole new person.', 'live', 'T10 randomize me'],
  ['Copy someone you meet', 'Look like a person you walked past.', 'planned', ''],
  ['Reflection in windows', 'See what you actually look like.', 'partial', ''],
]);

// =============================================================================
// Activities
// =============================================================================
cat('activities', [
  ['Talk to anybody', 'Every person in the city has something to say.', 'live', ''],
  ['Sit down', 'Benches, seats, subway carriages.', 'live', ''],
  ['Ride the subway', 'Three lines, sixteen stops, doors that open and close.', 'live', 'T10 take me to the subway'],
  ['Drive anywhere', 'Take a car and go.', 'live', ''],
  ['Basketball courts', 'Marked in the parks and usable.', 'partial', ''],
  ['Swim', 'Get in the water and stay in it.', 'live', ''],
  ['Explore by landmark', 'Ask to be taken somewhere and get directions or a lift.', 'live', 'T10 take me downtown'],
  ['Shooting range behaviour', 'Four hundred weapons, each with its own handling.', 'live', 'T10 give me a rifle'],
  ['Photography mode', 'Hide the interface and frame a shot.', 'planned', ''],
  ['Fishing', 'At the water, with a wait and a payoff.', 'planned', ''],
  ['Parkour routes', 'Marked runs across the rooftops.', 'planned', ''],
  ['Races', 'A checkpoint route against the clock.', 'planned', ''],
  ['Missions from NPCs', 'Someone asks you for something and you do it.', 'planned', ''],
  ['Buy things', 'Money exists; spending it should too.', 'partial', 'T10 how much money do I have'],
  ['Eat and drink', 'A café you can actually use.', 'partial', ''],
  ['Sleep and skip to morning', 'Somewhere to lie down and a clean time skip.', 'planned', ''],
  ['Busking', 'Play on a corner and draw a crowd.', 'planned', ''],
  ['Street sports', 'Skating, football in a park, a game you can join.', 'planned', ''],
  ['Photography of wildlife', 'A reason to go looking for the rarer animals.', 'planned', ''],
  ['Collectibles', 'Things hidden across the map worth finding.', 'planned', ''],
  ['Build a route and follow it', 'Set waypoints and have the map guide you.', 'partial', 'T10 mark this spot'],
  ['Crowd events', 'Get everyone in a park doing the same thing at once.', 'live', 'T10 make everyone dance'],
  ['Survive the night', 'A self-imposed challenge with an outbreak running.', 'partial', ''],
  ['Tour mode', 'T10 drives you around and tells you about the city.', 'planned', ''],
  ['Free camera', 'Detach and fly the camera on its own.', 'planned', ''],
]);

// =============================================================================
// Powers
// =============================================================================
cat('powers', [
  ['Telekinesis', 'Lift everything loose in front of you and throw it.', 'live', 'T10 telekinesis'],
  ['Super Jump', 'Straight up, and a landing that does not hurt.', 'live', 'T10 super jump'],
  ['Super Speed', 'Four times the pace for ten seconds.', 'live', 'T10 super speed'],
  ['Flight', 'Look where you want to go.', 'live', 'T10 let me fly'],
  ['Force Field', 'A shell nothing gets through, pushing people out of the way.', 'live', 'T10 force field'],
  ['Time Slow', 'The world at a quarter speed while you keep yours.', 'live', 'T10 slow time'],
  ['Teleportation', 'Jump to whatever you are looking at, up to forty metres.', 'live', 'T10 teleport'],
  ['Gravity Control', 'Cut gravity to a fifth for a while.', 'live', 'T10 gravity control'],
  ['Energy Blast', 'A shockwave that flattens what is in front of you.', 'live', 'T10 energy blast'],
  ['Invisibility', 'Nobody can see you, including the infected.', 'live', 'T10 make me invisible'],
  ['Object Duplication', 'Copy whatever you are looking at, several times.', 'live', 'T10 duplicate that'],
  ['Freeze', 'Everyone in sight stops where they stand.', 'live', 'T10 freeze them'],
  ['Healing', 'Everyone nearby gets up, cured of whatever had them.', 'live', 'T10 heal everyone'],
  ['Size Change', 'Normal, small, or very large.', 'live', 'T10 change my size'],
  ['Lightning', 'Call a strike down on what you are looking at.', 'live', 'T10 lightning strike'],
  ['Creature Summon', 'Something comes up out of the pavement.', 'live', 'T10 summon a creature'],
  ['Energy and regeneration', 'One pool, spent by every power, refilled over time.', 'live', 'T10 how much energy do I have'],
  ['Cooldowns per power', 'Each has its own, shown on the tile.', 'live', ''],
  ['Key bindings', 'Keys 1 to 0 and Z, X, C, J, B, N — none of them clash with anything else.', 'live', ''],
  ['Mobile power grid', 'The same sixteen as touch buttons.', 'live', ''],
  ['Power combinations', 'Time slow plus super speed doing something neither does alone.', 'planned', ''],
  ['Charge-up variants', 'Hold the button for a bigger version.', 'planned', ''],
  ['Power upgrades', 'Spend time using one and it gets better.', 'planned', ''],
  ['Custom power binding', 'Put the ones you use on the keys you want.', 'planned', ''],
  ['Powers for NPCs', 'Give someone else a power and watch what they do with it.', 'planned', ''],
]);

// =============================================================================
// Creatures
// =============================================================================
cat('creatures', [
  ['Twenty species', 'Abnormal zombies, mutation zombies and monsters, each built from its own numbers.', 'live', 'T10 list the creatures'],
  ['Procedural bodies', 'Heads, limbs, wings, tails and spines assembled from a body plan.', 'live', ''],
  ['Movement styles', 'Walk, lope, crawl, hop, hover, slither and stalk.', 'live', ''],
  ['Per-species AI', 'What it hunts, how close it gets, and what it does when it arrives.', 'live', ''],
  ['Abilities', 'Pounce, charge, shockwave, screech, spit, cloak, split, brood, burrow, drain and more.', 'live', ''],
  ['Voices', 'Growls, roars, screeches, hisses, chitters, chimes and rumbles.', 'live', ''],
  ['Design your own', 'Describe a creature in words and get a species you can spawn.', 'live', 'T10 design a creature'],
  ['Custom creatures saved per world', 'Your designs belong to the world you made them in.', 'live', ''],
  ['Loyal summons', 'Something you called will not turn on you.', 'live', 'T10 summon a creature'],
  ['Splitting', 'Put a splitter down and get two smaller ones.', 'live', ''],
  ['Brooding', 'Some species keep putting smaller ones on the ground.', 'live', ''],
  ['Burrowing', 'Goes under the street and comes up somewhere else.', 'live', ''],
  ['Cloaking', 'You see it, then you do not.', 'live', ''],
  ['Creature LOD', 'Full animation close up, coarse further out, culled at the edge.', 'live', ''],
  ['Creature budget', 'How many can exist at once scales with the performance load.', 'live', ''],
  ['Nests', 'A place creatures come from and return to.', 'planned', ''],
  ['Creature vs creature', 'Two species that will fight each other on sight.', 'partial', ''],
  ['Taming', 'Turn a hostile one into something that follows you.', 'planned', ''],
  ['Creature size variation', 'Same species, any size — ask for a giant one or a tiny one.', 'live', 'T10 spawn a giant brute'],
  ['Day and night behaviour', 'Species that only come out after dark.', 'planned', ''],
  ['Territory', 'A creature that owns a block and patrols it.', 'planned', ''],
  ['Flying swarms', 'Many small ones moving as one.', 'planned', ''],
  ['Boss creatures', 'One much larger, much harder thing per world.', 'planned', ''],
  ['Creature bestiary page', 'A readable list with what each one does.', 'live', 'T10 tell me about the brute'],
  ['Share a creature design', 'Copy a design out as text and paste it into another world.', 'planned', ''],
]);

// =============================================================================
// Sandbox interactions
// =============================================================================
cat('sandbox', [
  ['Spawn props', 'Benches, bins, barriers, boxes and more, wherever you are looking.', 'live', 'T10 spawn a bench'],
  ['Spawn people', 'One, or a crowd.', 'live', 'T10 spawn a person'],
  ['Spawn animals', 'Any species, any number.', 'live', 'T10 spawn three dogs'],
  ['Spawn vehicles', 'Any class, any colour.', 'live', 'T10 spawn a bus'],
  ['Spawn creatures', 'Any species from the bestiary, or one of yours.', 'live', 'T10 spawn a gargoyle'],
  ['Clear what you made', 'Take it all back out in one line.', 'live', 'T10 clear everything I spawned'],
  ['Mutation on an NPC', 'Four stages from normal to fully transformed.', 'live', 'T10 mutate that person'],
  ['Reverse a mutation', 'Put them back the way they were, at any stage.', 'live', 'T10 cure them'],
  ['Immortality', 'Nothing in the city can put you down.', 'live', 'T10 I never want to die'],
  ['Noclip', 'Walk through anything.', 'live', 'T10 let me walk through walls'],
  ['Teleport anywhere', 'By landmark, by district, or to whatever you can see.', 'live', 'T10 take me to the beach'],
  ['Markers', 'Drop a pin and find your way back.', 'live', 'T10 mark this spot'],
  ['Set the time', 'Any hour, instantly or over a few seconds.', 'live', 'T10 make it midnight'],
  ['Set the weather', 'Any of the six, instantly or gradually.', 'live', 'T10 make it storm'],
  ['Object duplication', 'Copy what you are looking at several times.', 'live', ''],
  ['Throw people', 'Telekinesis works on the crowd too.', 'live', ''],
  ['Undo the last thing', 'One step back from whatever you just did.', 'planned', ''],
  ['Save a scene', 'Snapshot the arrangement of a street and restore it.', 'planned', ''],
  ['Copy and paste objects', 'Select a group and stamp it elsewhere.', 'planned', ''],
  ['Object placement grid', 'Snap what you place to a grid or to a surface.', 'planned', ''],
  ['Rotate and scale what you place', 'Full control over how a prop sits.', 'partial', ''],
  ['Spawn menus by category', 'A browsable list rather than only voice commands.', 'planned', ''],
  ['Scripted sequences', 'Chain a few commands and run them on a trigger.', 'planned', ''],
  ['Rules per world', 'Set gravity, time, gore and immortality and have them stick.', 'live', ''],
  ['Sandbox reset', 'Put the world back to how it generated.', 'partial', ''],
]);

// =============================================================================
// World events
// =============================================================================
cat('events', [
  ['Zombie apocalypse', 'It starts with one person turning while you watch.', 'live', 'T10 start a zombie apocalypse'],
  ['Riot', 'Everyone turns on everyone, including each other.', 'live', 'T10 start a riot'],
  ['Alien invasion', 'Saucers, abductions, and people running.', 'live', 'T10 alien apocalypse'],
  ['Meteor strike', 'Rocks coming down on the city.', 'live', 'T10 drop a meteor'],
  ['Blackout', 'Every light in the city goes out at once.', 'live', 'T10 blackout'],
  ['Machine uprising', 'The traffic stops taking instructions.', 'live', 'T10 machine apocalypse'],
  ['T10 asks which one', 'Say you want the end of the world and it asks what kind.', 'live', 'T10 end the world'],
  ['Stop an apocalypse', 'Call it off and let the city recover.', 'live', 'T10 stop the apocalypse'],
  ['Always reanimate', 'Everyone who goes down gets back up.', 'live', 'T10 make everyone reanimate'],
  ['Outbreak spread', 'Infection that actually moves through a crowd.', 'live', ''],
  ['Festival', 'A street closed off, music, and a crowd that stays.', 'planned', ''],
  ['Parade', 'A route through town that people line up for.', 'planned', ''],
  ['Power cut by district', 'One neighbourhood dark instead of all of them.', 'planned', ''],
  ['Storm warning', 'Advance notice, and people reacting to it.', 'planned', ''],
  ['Building fire', 'Smoke, evacuation and a response.', 'planned', ''],
  ['Protest march', 'A crowd with a direction and a mood.', 'planned', ''],
  ['Rush hour', 'A time of day where the whole city is in the way.', 'partial', ''],
  ['Quarantine zones', 'Parts of the map cordoned off during an outbreak.', 'planned', ''],
  ['Survivor camps', 'Somewhere the uninfected gather and hold.', 'planned', ''],
  ['Event scheduling', 'Set something to happen at a particular hour.', 'planned', ''],
  ['Random world events', 'Let the world surprise you occasionally.', 'planned', ''],
  ['Event history', 'A log of what has happened in this world.', 'planned', ''],
  ['Eclipse', 'Daylight going away for a few minutes.', 'planned', ''],
  ['Creature outbreak', 'An apocalypse made of monsters rather than the infected.', 'partial', ''],
  ['Mutation outbreak', 'A strain that moves from person to person.', 'planned', ''],
]);

// =============================================================================
// Environmental systems
// =============================================================================
cat('environment', [
  ['Day and night cycle', 'A full sun and moon arc with the light to match.', 'live', 'T10 what time is it'],
  ['Time control', 'Set the hour, speed it up, or stop it.', 'live', 'T10 stop time'],
  ['Sky model', 'Physically-shaped sky colour through the whole day.', 'live', ''],
  ['Street lights', 'On at dusk, off at dawn, overridable.', 'live', 'T10 turn on the street lights'],
  ['Traffic lights', 'A real cycle that traffic obeys.', 'live', ''],
  ['World streaming', 'Everything loads and unloads around you as you move.', 'live', ''],
  ['Fog and draw distance', 'Tied to the quality preset and the weather.', 'live', ''],
  ['Screen-space reflections', 'Ray-marched reflections on wet roads and glass.', 'live', ''],
  ['Ambient occlusion', 'Contact shading where surfaces meet.', 'live', ''],
  ['Bloom and tone mapping', 'A film response rather than raw output.', 'live', ''],
  ['Volumetric light', 'Shafts through fog and between buildings.', 'live', ''],
  ['Contact shadows', 'Small shadows under feet and wheels.', 'live', ''],
  ['Wetness and frost', 'Surface response shared by every material in the world.', 'live', ''],
  ['Reflection probes', 'Cheap environment reflections on the metal and glass.', 'live', ''],
  ['Dynamic resolution', 'Render scale that moves with the frame time.', 'live', ''],
  ['Interior ambience', 'The sun stops at the door, the rain stays outside, and the room lights take over.', 'live', ''],
  ['Underground ambience', 'The subway sounds and looks like the subway.', 'live', ''],
  ['Air quality and haze', 'Distant buildings fading into the atmosphere.', 'live', ''],
  ['Light pollution', 'A city glow on the underside of the clouds.', 'planned', ''],
  ['Sun position by date', 'A sun that is in the right place for the season.', 'planned', ''],
  ['Moon phases', 'A moon that is not always full.', 'planned', ''],
  ['Star field', 'Real constellations overhead on a clear night.', 'partial', ''],
  ['Wind zones', 'Gusts that funnel between tall buildings.', 'planned', ''],
  ['Temperature', 'A number that affects snow, frost and how people dress.', 'planned', ''],
  ['Echo and reverb by space', 'Sound that knows whether you are in a tunnel.', 'partial', ''],
]);

// =============================================================================
// Animation
// =============================================================================
cat('animation', [
  ['Thirty-plus states', 'Idle, walk, run, jump, fall, land, crouch, sit, drive, talk, use, lie, recover and more.', 'live', ''],
  ['Procedural locomotion', 'No clips: every pose is generated from speed, turn rate and terrain.', 'live', ''],
  ['Start and stop animation', 'Weight shifts into a walk and settles out of one.', 'live', ''],
  ['Turn in place', 'A shuffle when you turn without moving.', 'live', ''],
  ['Foot inverse kinematics', 'Feet that sit on the actual ground, on slopes and steps.', 'live', ''],
  ['Facial animation', 'Blinks, brows and mouth movement while talking.', 'live', ''],
  ['Finger bones', 'Hands that close around what they are holding.', 'live', ''],
  ['Weapon poses', 'Both hands on the weapon, aimed where you are aiming.', 'live', ''],
  ['Animation LOD tiers', 'Full, no face or fingers, body only, then frozen.', 'live', ''],
  ['Animation rate by distance', 'Distant people animate fewer times per second.', 'live', ''],
  ['Creature animation', 'Seven movement styles across the bestiary.', 'live', ''],
  ['Animal gaits', 'Four-legged, two-legged, hopping and flight.', 'live', ''],
  ['Vehicle entry and exit', 'Getting in and out rather than teleporting.', 'partial', ''],
  ['Sitting and standing', 'Real transitions on benches and train seats.', 'live', ''],
  ['Mutation stage poses', 'A tremor and a change in stance as someone transforms.', 'live', ''],
  ['Carrying', 'Holding something large changes how you walk.', 'planned', ''],
  ['Climbing', 'Pulling yourself up rather than jumping.', 'planned', ''],
  ['Swimming strokes', 'Something better than floating upright.', 'planned', ''],
  ['Gesture set', 'Wave, point, shrug, on request.', 'partial', 'T10 wave'],
  ['Injury limp', 'Movement that reflects having been knocked down.', 'planned', ''],
  ['Look-at targets', 'Heads that follow what is interesting nearby.', 'partial', ''],
  ['Breathing', 'Chest movement at rest and after running.', 'planned', ''],
  ['Interaction animations', 'Doors, buttons, handles, each with their own motion.', 'live', ''],
  ['Animation blending weights', 'Smooth crossfades rather than snapping between states.', 'live', ''],
  ['Per-person timing offsets', 'No two people in a crowd in step with each other.', 'live', ''],
]);

// =============================================================================
// Audio
// =============================================================================
cat('audio', [
  ['Fully synthesised', 'Not one audio file: every sound is generated at runtime.', 'live', ''],
  ['Footsteps by surface', 'Concrete, asphalt, grass, sand, wood, metal, water and dirt.', 'live', ''],
  ['Weather audio', 'Rain, wind and thunder that follow the sky.', 'live', ''],
  ['Engine audio', 'Revs that track the throttle and the gear.', 'live', ''],
  ['Weapon audio', 'Four hundred weapons with reports that match their class.', 'live', ''],
  ['Creature voices', 'Eight voice types, pitched per species and per size.', 'live', ''],
  ['Animal calls', 'A different sound for each species.', 'live', ''],
  ['City ambience', 'A bed that changes with district, weather and hour.', 'live', ''],
  ['Subway ambience', 'Tunnel noise, trains arriving, doors.', 'live', ''],
  ['T10 interface sounds', 'Blips for open, reply, error and confirm.', 'live', ''],
  ['Stereo panning', 'Sound placed left and right relative to your view.', 'live', ''],
  ['Reverb indoors and in tunnels', 'A convolution send that opens up under the street.', 'live', ''],
  ['Volume controls', 'Master, effects and music, separately.', 'live', 'T10 turn the volume down'],
  ['Mute', 'Everything off in one line.', 'live', 'T10 mute'],
  ['Distance attenuation', 'Things that are far away are quieter.', 'live', ''],
  ['Music', 'Procedural score that responds to what is happening.', 'planned', ''],
  ['Crowd murmur', 'A wash of voices that thickens with the crowd.', 'planned', ''],
  ['Occlusion', 'Sound muffled by the building it is behind.', 'planned', ''],
  ['Doppler', 'A pitch shift on things going past you fast.', 'planned', ''],
  ['Radio stations', 'Something to listen to while driving.', 'planned', ''],
  ['Speech', 'Voices for the people you talk to.', 'planned', ''],
  ['Audio quality by preset', 'Fewer simultaneous voices at the low preset.', 'partial', ''],
  ['Weather-driven ambience blend', 'Rain that changes the whole mix, not just adds to it.', 'live', ''],
  ['Impact sounds by material', 'Bullets and objects that sound like what they hit.', 'live', ''],
  ['Heartbeat and breath', 'Audio that reflects how close things are getting.', 'planned', ''],
]);

// =============================================================================
// UI
// =============================================================================
cat('ui', [
  ['Almost no interface', 'An orb, a settings button, a prompt. That is the game.', 'live', ''],
  ['T10 chat', 'Type to it, or tap the orb, and it answers.', 'live', ''],
  ['Command book', 'Every command, searchable, in one panel. Saying just "T10" opens it.', 'live', 'T10 show all commands'],
  ['Map', 'The street network, landmarks, your markers and where you are.', 'live', 'T10 open the map'],
  ['Settings panel', 'Quality, sound, content rating, view, controls, leave world.', 'live', ''],
  ['Three quality presets', 'LOW, HIGH and ULTRA, named exactly that.', 'live', ''],
  ['Powers grid', 'All sixteen with their key, cost and cooldown.', 'live', ''],
  ['Energy bar', 'Always visible, colour-coded when it is low.', 'live', ''],
  ['Interaction prompts', 'What USE will do, and which key does it.', 'live', ''],
  ['Subtitles', 'What T10 and the people around you said.', 'live', ''],
  ['Stats readout', 'FPS, frame time, draw calls, triangles, counts and memory.', 'live', 'T10 show stats'],
  ['World library screen', 'Create, load, rename, duplicate and delete.', 'live', ''],
  ['Scrollable creation form', 'Options that fit on a phone screen without fighting it.', 'live', ''],
  ['Crosshair when armed', 'Only when you are holding something.', 'live', ''],
  ['Weapon pad on touch', 'Reload, aim and fire, only while armed.', 'live', ''],
  ['Feature library browser', 'This list, searchable from inside the game.', 'live', 'T10 what can you do'],
  ['Notifications', 'Something small that tells you what just changed.', 'partial', ''],
  ['Quick command chips', 'Suggested things to say, one tap each.', 'live', ''],
  ['Customisable interface scale', 'Bigger or smaller for the screen you are on.', 'planned', ''],
  ['Colour themes', 'More than the one green.', 'planned', ''],
  ['Minimap', 'A corner map instead of a full-screen one.', 'planned', ''],
  ['Objective tracker', 'For when there is something to track.', 'planned', ''],
  ['Photo frame overlays', 'Guides for framing a shot.', 'planned', ''],
  ['Control remapping UI', 'Change the keys from inside the game.', 'partial', ''],
  ['Gamepad interface hints', 'Prompts that show the right button for the pad.', 'planned', ''],
]);

// =============================================================================
// Accessibility
// =============================================================================
cat('access', [
  ['Content rating', 'Eighteen or sixteen, changing how much violence is shown.', 'live', 'T10 set the rating to sixteen'],
  ['Subtitles for everything spoken', 'Nothing is audio-only.', 'live', ''],
  ['Adjustable field of view', 'For comfort as much as for the look.', 'live', 'T10 change the field of view'],
  ['No flashing-light requirement', 'Lightning and blackouts can be turned down.', 'partial', ''],
  ['First and third person', 'Whichever is easier to play in.', 'live', ''],
  ['Touch controls sized for thumbs', 'Large targets, safe-area aware.', 'live', ''],
  ['Joystick appears where you touch', 'No fixed stick position to find.', 'live', ''],
  ['No sprint button', 'One pace, so nothing has to be held down.', 'live', ''],
  ['USE does everything', 'One button for shooting, sitting, talking and boarding.', 'live', ''],
  ['High-contrast prompts', 'Readable over a bright street or a dark one.', 'live', ''],
  ['Text size control', 'Larger interface text on request.', 'planned', ''],
  ['Colour-blind palettes', 'Alternatives for the interface colours.', 'planned', ''],
  ['Reduced motion mode', 'Less camera shake, less bob, fewer effects.', 'planned', ''],
  ['Hold-to-toggle options', 'Turn any held button into a toggle.', 'planned', ''],
  ['Aim assist', 'Optional, adjustable, off by default.', 'planned', ''],
  ['Screen reader labels', 'Every control named for assistive technology.', 'partial', ''],
  ['Auto-run toggle', 'Move without holding anything.', 'planned', ''],
  ['Camera sensitivity per axis', 'Separate horizontal and vertical.', 'partial', ''],
  ['Invert look', 'Either axis, either way.', 'live', ''],
  ['Photosensitivity safe mode', 'Caps flash rate and intensity across the whole game.', 'planned', ''],
  ['One-handed layout', 'Touch controls rearranged for one thumb.', 'planned', ''],
  ['Pause anywhere', 'Opening a panel suspends the controls, not the world.', 'live', ''],
  ['Simple language mode', 'T10 answering in shorter, plainer sentences.', 'planned', ''],
  ['Colour-coded subtitles', 'Who is speaking, at a glance.', 'live', ''],
  ['Difficulty of threats', 'How dangerous the world is, adjustable.', 'partial', ''],
]);

// =============================================================================
// Mobile optimisation
// =============================================================================
cat('mobile', [
  ['Three presets tuned for phones', 'Every preset is sized to the device it is running on, so ULTRA on a phone is ULTRA a phone can hold.', 'live', 'T10 what quality am I on'],
  ['Aggressive LOD', 'Detail dropped by distance, harder at the lower presets.', 'live', ''],
  ['Occlusion culling by chunk', 'Half the city hidden in one test per block.', 'live', ''],
  ['Asset streaming', 'Chunks built and thrown away around you.', 'live', ''],
  ['Texture resolution by preset', 'Smaller textures where they will not be seen.', 'live', ''],
  ['Animation compression', 'Fewer bones driven per person at distance.', 'live', ''],
  ['Lightweight distant NPC AI', 'Background people with a position and a destination, nothing else.', 'live', ''],
  ['Lightweight distant physics', 'Simulation that thins out with distance.', 'live', ''],
  ['Efficient particles', 'Instanced and budgeted, never unbounded.', 'live', ''],
  ['Efficient shadows', 'Map size, distance and cascades all preset-driven.', 'live', ''],
  ['Dynamic resolution', 'Render scale that moves with the frame time.', 'live', ''],
  ['Memory budgeting', 'Heap watched, and effects cut before it runs out.', 'live', ''],
  ['Thermal-aware scaling', 'Sustained load backs the game off before the phone throttles.', 'live', 'T10 how is performance'],
  ['Performance monitor', 'FPS, frame time, p95, draw calls, memory and counts.', 'live', 'T10 show stats'],
  ['Adaptive simulation load', 'Crowd, traffic, animals and gore budgets all scale together.', 'live', ''],
  ['Batched geometry', 'Static world merged into as few draw calls as possible.', 'live', ''],
  ['Instanced trees and props', 'Thousands drawn as one.', 'live', ''],
  ['Matrix updates disabled on static meshes', 'Nothing recomposed that never moves.', 'live', ''],
  ['Allocation-free hot paths', 'No garbage generated per frame or per shot.', 'live', ''],
  ['Touch-first controls', 'Designed for a phone, not adapted to one.', 'live', ''],
  ['Viewport self-healing', 'A broken drawing buffer is detected and repaired.', 'live', ''],
  ['Battery saver mode', 'Cap the frame rate deliberately to save power.', 'planned', ''],
  ['Background pause', 'Stop simulating when the tab is not visible.', 'partial', ''],
  ['Download size', 'No asset files at all — the whole game is code.', 'live', ''],
  ['Device-sized presets', 'Cores, memory, screen and driver decide the budgets; the preset decides the look.', 'live', 'T10 what quality am I on'],
  ['ULTRA on a phone', 'Every effect stays on — reflections, ambient occlusion, bloom, volumetrics — at phone-sized numbers.', 'live', ''],
  ['Streaming yields to the frame', 'A late frame means no chunk is built this frame; a stutter you can feel is never worth it.', 'live', ''],
  ['Instant reaction to a stall', 'Two frames far over budget take a rung off the ladder without waiting for an average.', 'live', ''],
  ['Progressive world build', 'Chunks built a few per frame so nothing ever spikes.', 'live', ''],
]);

// =============================================================================
// Query API
// =============================================================================
export function featuresIn(key) { return FEATURES.filter((f) => f.cat === key); }

export function featureCount() { return FEATURES.length; }

export function featureStats() {
  const s = { total: FEATURES.length, live: 0, partial: 0, planned: 0, categories: CATEGORIES.length };
  for (const f of FEATURES) s[f.status] = (s[f.status] || 0) + 1;
  return s;
}

/** Word-overlap search across title, detail and category. */
export function searchFeatures(query, limit) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  const out = [];
  for (const f of FEATURES) {
    const hay = (f.title + ' ' + f.detail + ' ' + f.category).toLowerCase();
    let score = 0;
    if (hay.indexOf(q) >= 0) score += 40;
    for (const w of words) if (hay.indexOf(w) >= 0) score += 8;
    if (f.title.toLowerCase().indexOf(q) >= 0) score += 30;
    if (score) out.push({ f, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit || 8).map((o) => o.f);
}

/** A few things you could ask for that are live right now. */
export function liveIdeas(n, rng) {
  const live = FEATURES.filter((f) => f.status === 'live' && f.say);
  const pick = [];
  const r = rng || Math.random;
  const used = new Set();
  while (pick.length < Math.min(n || 3, live.length)) {
    const i = Math.floor(r() * live.length);
    if (used.has(i)) continue;
    used.add(i);
    pick.push(live[i]);
  }
  return pick;
}

export function findFeature(query) {
  const hits = searchFeatures(query, 1);
  return hits.length ? hits[0] : null;
}
