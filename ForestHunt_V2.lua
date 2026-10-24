--[[
	⚔️🎃  FOREST HUNT 2.0  —  HALLOWEEN 2X EVENT  —  ONE SCRIPT
	=====================================================================
	The WHOLE game is this one file. It works in two places:

	STEP 1  (required)  — the game itself
	  Explorer → StarterPlayer → StarterPlayerScripts → click ➕ → LocalScript
	  Delete the "print" line inside it, paste this whole file in, press Play.
	  You can already play solo after this step.

	STEP 2  (for multiplayer + saving)  — paste the SAME file a second time
	  Explorer → ServerScriptService → click ➕ → Script → paste this exact same file.
	  Now everybody in a server fights the SAME zombies and bosses, sees each other's
	  swords and animations, can team up on bosses, and progress SAVES.
	  (Saving in Studio: Home → Game Settings → Security → "Enable Studio Access to API Services")

	  ⚠ Delete any old Forest Hunt 1.0 scripts first.

	CONTROLS
	  PC     : Left-Click / F = swing   ·  Shift = sprint   ·  Q = dash (can't be hit while dashing)
	           E = talk to Gus  ·  1-5 = switch sword  ·  M = worlds  ·  G = sword bag  ·  H = go home to the cave
	  Mobile : ⚔ swing button · 💨 dash button · 🏃 sprint toggle · walk up to Gus and tap "Talk"
	  Chat   : stand near Gus and type ("hi gus", "upgrade", "sword", "boss", "candy", "joke"...)

	WHAT'S IN 2.0
	  • You start in a glowing CAVE. Walk through a tunnel to go OUTSIDE and fight.
	  • 3 worlds:  ⚰ GRAVEYARD (gates open at 120 kills — the Pumpkin Patch outside is free)
	               ❄ ICE WORLD (500 kills, 3X coins)   🌴 JUNGLE (800 kills, 4X coins, hardest)
	  • 🎃 2X HALLOWEEN EVENT: all coins are doubled and zombies drop candy.
	    Collect 100 candies → the PUMPKIN OVERNIGHT SWORD (the most OP sword in the game).
	  • A BOSS rises in every world every 10 minutes. King Kongo (Jungle) pays 5,000 coins.
	    Other players in your server can help you fight it — everyone who helps gets paid.
	  • Monsters are detailed Roblox "boy" rigs with hand-made animations:
	    Zombies, Zombie Dogs, Giants · Frostbitten Zombies, Ice Throwers, Yeti Zombies ·
	    Monkey Zombies, Gas Zombies (they catch fire!), Toxic Zombies (they make you SICK).
	  • If you die, YOUR avatar turns into a zombie... and your zombie twin stays out there.
	  • 5 swords, each with its own swing combo. Custom running, sprinting and swing animations.
	  • Gus is back — a brand-new Gus with a brand-new shop.
	  • Only the world you're in is drawn, so it stays smooth on phones.
]]

local Players           = game:GetService("Players")
local RunService        = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local IS_SERVER = RunService:IsServer()
local VERSION = "2.0"
local NET_NAME = "ForestHunt2_Net"

------------------------------------------------------------------------------------------------
-- SHARED HELPERS (server + client)
------------------------------------------------------------------------------------------------
local rng = Random.new()

local function flat(v) return Vector3.new(v.X, 0, v.Z) end
local function lerp(a, b, t) return a + (b - a) * t end
local function smooth(t) t = math.clamp(t, 0, 1); return t * t * (3 - 2 * t) end
local function easeOut(t) t = math.clamp(t, 0, 1); return 1 - (1 - t) ^ 3 end
local function yawOf(dx, dz) return math.atan2(-dx, -dz) end
local function angDiff(a, b) return (b - a + math.pi) % (math.pi * 2) - math.pi end
local function pick(list) return list[rng:NextInteger(1, #list)] end
local function inRect(x, z, r) return x >= r[1] and x <= r[2] and z >= r[3] and z <= r[4] end
local function commas(n)
	local s = tostring(math.floor(n))
	local k
	repeat
		s, k = string.gsub(s, "^(-?%d+)(%d%d%d)", "%1,%2")
	until k == 0
	return s
end
local function fmtTime(sec)
	sec = math.max(0, math.floor(sec))
	return string.format("%d:%02d", math.floor(sec / 60), sec % 60)
end

------------------------------------------------------------------------------------------------
-- GAME CONFIG
------------------------------------------------------------------------------------------------
local EVENT_MULT = 2            -- 🎃 2X Halloween event: every coin counts double
local CANDY_GOAL = 100          -- candies needed for the Pumpkin Overnight Sword
local BOSS_EVERY = 600          -- a boss rises in every world every 10 minutes
local GRAVE_GATE_KILLS = 120    -- the graveyard gates open at 120 kills

local WORLDS = {
	cave   = { id = "cave", name = "The Cave", icon = "🕯", origin = Vector3.new(0, 0, 0), mult = 0, need = 0 },
	grave  = { id = "grave", name = "Graveyard", icon = "⚰", origin = Vector3.new(1600, 0, 0), mult = 1, need = 0,
		color = Color3.fromRGB(255, 150, 60), boss = "gravekeeper", minion = "zombie" },
	ice    = { id = "ice", name = "Ice World", icon = "❄", origin = Vector3.new(3200, 0, 0), mult = 3, need = 500,
		color = Color3.fromRGB(120, 210, 255), boss = "titan", minion = "frozen" },
	jungle = { id = "jungle", name = "Jungle", icon = "🌴", origin = Vector3.new(4800, 0, 0), mult = 4, need = 800,
		color = Color3.fromRGB(120, 230, 90), boss = "kongo", minion = "monkey" },
}
local WORLD_ORDER = { "grave", "ice", "jungle" }

-- state names ↔ numbers (sent over the network)
local STATES = { "idle", "wander", "chase", "attack", "pounce", "notice", "rise", "dead",
	"throw", "spit", "ignite", "slam", "sweep", "summon", "leap", "barrel", "boulder", "spikes", "roar" }
local STATE_ID = {}
for i, s in ipairs(STATES) do STATE_ID[s] = i end

--  rig  : how it looks (biped = Roblox boy rig, dog, monkey, avatar = YOUR avatar)
--  ai   : how it fights
local MOBS = {
	-- ⚰ GRAVEYARD
	zombie  = { name = "Zombie", rig = "biped", look = "zombie", ai = "melee", hp = 110, dmg = 10, speed = 7.5, runSpeed = 12.5, runner = 0.25,
		reach = 4.2, atk = 0.85, cd = 1.1, reward = 10, radius = 1.2, aggro = 55, scale = 0.95, turn = 3.4 },
	dog     = { name = "Zombie Dog", rig = "dog", look = "dog", ai = "pounce", hp = 60, dmg = 8, speed = 19, reach = 3.6, pounce = 9, leapH = 2.4,
		atk = 1.05, cd = 1.5, reward = 7, radius = 1.3, aggro = 68, scale = 0.85, turn = 6.5 },
	giant   = { name = "Giant Zombie", rig = "biped", look = "giant", ai = "slam", hp = 450, dmg = 24, speed = 6, reach = 7.5, slamR = 9.5,
		atk = 1.5, cd = 2.2, reward = 40, radius = 2.1, aggro = 60, scale = 1.75, turn = 2.2 },
	-- ❄ ICE WORLD
	frozen  = { name = "Frostbitten Zombie", rig = "biped", look = "frozen", ai = "melee", hp = 380, dmg = 18, speed = 8, runSpeed = 13.5, runner = 0.3,
		reach = 4.4, atk = 0.8, cd = 1.0, reward = 12, radius = 1.25, aggro = 60, scale = 1.0, turn = 3.6, effect = "chill" },
	thrower = { name = "Ice Thrower", rig = "biped", look = "thrower", ai = "ranged", hp = 300, dmg = 16, speed = 9, reach = 4.2, range = 32, keep = 14,
		atk = 1.1, cd = 2.3, reward = 14, radius = 1.2, aggro = 72, scale = 1.0, turn = 4, effect = "chill", proj = "ice" },
	yeti    = { name = "Yeti Zombie", rig = "biped", look = "yeti", ai = "slam", hp = 1400, dmg = 38, speed = 7, reach = 8, slamR = 11,
		atk = 1.4, cd = 2.0, reward = 50, radius = 2.4, aggro = 65, scale = 1.95, turn = 2.4, effect = "chill" },
	-- 🌴 JUNGLE
	monkey  = { name = "Monkey Zombie", rig = "monkey", look = "monkey", ai = "pounce", hp = 520, dmg = 22, speed = 21, reach = 3.8, pounce = 15, leapH = 5,
		atk = 1.0, cd = 1.3, reward = 14, radius = 1.2, aggro = 78, scale = 0.9, turn = 7 },
	gas     = { name = "Gas Zombie", rig = "biped", look = "gas", ai = "gas", hp = 700, dmg = 26, speed = 8, runSpeed = 15.5,
		reach = 4.4, atk = 0.85, cd = 1.0, reward = 16, radius = 1.3, aggro = 65, scale = 1.05, turn = 3.8, effect = "burn" },
	toxic   = { name = "Toxic Zombie", rig = "biped", look = "toxic", ai = "toxic", hp = 650, dmg = 20, speed = 8.5, reach = 4.4, range = 25,
		atk = 0.9, cd = 1.0, reward = 16, radius = 1.3, aggro = 70, scale = 1.05, turn = 3.8, effect = "sick", proj = "toxic" },
	-- 🧟 YOU, after you die
	avatar  = { name = "Zombie", rig = "avatar", look = "avatar", ai = "melee", hp = 160, dmg = 12, speed = 8, runSpeed = 13, runner = 0.5,
		reach = 4.3, atk = 0.85, cd = 1.1, reward = 25, radius = 1.2, aggro = 60, scale = 1, turn = 3.6 },
	-- 👹 BOSSES
	gravekeeper = { boss = true, name = "The Gravekeeper", rig = "biped", look = "gravekeeper", ai = "boss", hp = 6000, dmg = 30, speed = 7.5,
		reach = 9, atk = 1.2, cd = 1.1, reward = 1000, candy = 10, radius = 3.2, aggro = 130, scale = 2.5, turn = 2.4,
		moves = { "slam", "sweep", "summon", "slam", "sweep" } },
	titan   = { boss = true, name = "Frost Titan", rig = "biped", look = "titan", ai = "boss", hp = 16000, dmg = 45, speed = 8,
		reach = 10, atk = 1.2, cd = 1.0, reward = 2500, candy = 15, radius = 3.6, aggro = 140, scale = 2.9, turn = 2.4, effect = "chill",
		moves = { "slam", "boulder", "spikes", "sweep", "boulder" } },
	kongo   = { boss = true, name = "King Kongo", rig = "monkey", look = "kongo", ai = "boss", hp = 32000, dmg = 55, speed = 11,
		reach = 9.5, atk = 1.1, cd = 0.9, reward = 5000, candy = 20, radius = 3.6, aggro = 150, scale = 2.9, turn = 3.2, effect = "sick",
		moves = { "leap", "barrel", "slam", "summon", "barrel", "leap" } },
}
for id, d in pairs(MOBS) do d.id = id end

-- how long each action takes (the client uses the same numbers so animations line up)
local MOVE_DUR = { slam = 1.5, sweep = 1.3, summon = 1.6, leap = 1.7, barrel = 1.3, boulder = 1.4, spikes = 1.5, roar = 1.6,
	throw = 1.1, spit = 0.9, ignite = 1.0, notice = 0.6, rise = 2.4 }
local function stateDur(def, st)
	if st == "attack" then return def.atk end
	if st == "pounce" then return def.atk end
	if st == "notice" then return def.boss and 1.6 or (def.rig == "dog" and 0.45 or (def.ai == "slam" and 0.9 or 0.6)) end
	return MOVE_DUR[st] or 1
end

-- where monsters live in each world (rectangles in WORLD-LOCAL x/z; north = -Z)
local SPAWNS = {
	grave  = { zones = {
		fields = { rect = { -188, 188, 12, 162 }, max = 9, kinds = { { "zombie", 0.62 }, { "dog", 0.38 } } },
		yard   = { rect = { -150, 150, -206, -14 }, max = 10, kinds = { { "zombie", 0.5, true }, { "dog", 0.3 }, { "giant", 0.2, false, 2 } } },
	}, bossZone = "yard" },
	ice    = { zones = {
		snow = { rect = { -186, 186, -204, 160 }, max = 13, kinds = { { "frozen", 0.5 }, { "thrower", 0.3 }, { "yeti", 0.2, false, 2 } } },
	}, bossZone = "snow" },
	jungle = { zones = {
		wild = { rect = { -186, 186, -204, 160 }, max = 13, kinds = { { "monkey", 0.4 }, { "gas", 0.3 }, { "toxic", 0.3 } } },
	}, bossZone = "wild" },
}

------------------------------------------------------------------------------------------------
-- SWORDS (only 5!) + UPGRADES
------------------------------------------------------------------------------------------------
local SWORDS = {
	{ id = "rusty", name = "Rusty Blade", price = 0, dmg = 20, speed = 1.0, reach = 7.0, combo = { "slash", "back", "chop" },
	  len = 3.2, width = 0.48, thick = 0.12, grip = 1.0, guard = "bar",
	  bladeC = Color3.fromRGB(150, 112, 84), bladeM = Enum.Material.CorrodedMetal, edgeC = Color3.fromRGB(176, 150, 124),
	  guardC = Color3.fromRGB(74, 66, 60), gripC = Color3.fromRGB(100, 84, 62), wrapC = Color3.fromRGB(70, 56, 40),
	  trail = Color3.fromRGB(230, 214, 190), desc = "Old and chipped. Still pointy." },
	{ id = "long", name = "Knight's Longsword", price = 750, dmg = 46, speed = 0.95, reach = 9.5, combo = { "wide", "back", "spin" },
	  len = 4.6, width = 0.56, thick = 0.13, grip = 1.5, guard = "quillons",
	  bladeC = Color3.fromRGB(222, 228, 238), bladeM = Enum.Material.Metal, edgeC = Color3.fromRGB(255, 255, 255),
	  guardC = Color3.fromRGB(200, 205, 215), gripC = Color3.fromRGB(30, 40, 90), wrapC = Color3.fromRGB(190, 160, 70), gem = Color3.fromRGB(60, 120, 255),
	  trail = Color3.fromRGB(210, 225, 255), desc = "Huge reach. Its 3rd swing is a SPIN." },
	{ id = "frost", name = "Frostbite", price = 4000, dmg = 90, speed = 1.1, reach = 8.5, effect = "frost", combo = { "thrust", "slash", "chop" },
	  len = 3.9, width = 0.54, thick = 0.13, grip = 1.1, guard = "crystal",
	  bladeC = Color3.fromRGB(150, 220, 255), bladeM = Enum.Material.Ice, bladeT = 0.15, edgeC = Color3.fromRGB(220, 250, 255), edgeNeon = true,
	  guardC = Color3.fromRGB(170, 210, 235), gripC = Color3.fromRGB(230, 240, 250), wrapC = Color3.fromRGB(90, 150, 210), gem = Color3.fromRGB(110, 230, 255),
	  trail = Color3.fromRGB(140, 230, 255), glow = Color3.fromRGB(120, 220, 255), desc = "Stabs and freezes. Slows monsters down." },
	{ id = "inferno", name = "Inferno Edge", price = 15000, dmg = 160, speed = 1.12, reach = 9, effect = "burn", combo = { "slash", "upper", "spin" },
	  len = 4.0, width = 0.58, thick = 0.14, grip = 1.15, guard = "dragon",
	  bladeC = Color3.fromRGB(42, 32, 32), bladeM = Enum.Material.Basalt, edgeC = Color3.fromRGB(255, 120, 30), edgeNeon = true,
	  guardC = Color3.fromRGB(40, 28, 28), gripC = Color3.fromRGB(60, 20, 20), wrapC = Color3.fromRGB(255, 120, 40), gem = Color3.fromRGB(255, 50, 30),
	  trail = Color3.fromRGB(255, 120, 40), glow = Color3.fromRGB(255, 110, 40), desc = "Uppercuts and spins. Sets monsters on fire." },
	{ id = "pumpkin", name = "Pumpkin Overnight Sword", price = -1, candy = CANDY_GOAL, dmg = 420, speed = 1.3, reach = 11, effect = "pumpkin",
	  combo = { "slash", "spin", "thrust", "chop" },
	  len = 4.8, width = 0.66, thick = 0.15, grip = 1.3, guard = "pumpkin",
	  bladeC = Color3.fromRGB(38, 20, 70), bladeM = Enum.Material.Glass, edgeC = Color3.fromRGB(255, 140, 20), edgeNeon = true,
	  guardC = Color3.fromRGB(255, 120, 20), gripC = Color3.fromRGB(40, 90, 40), wrapC = Color3.fromRGB(90, 170, 60), gem = Color3.fromRGB(190, 90, 255),
	  trail = Color3.fromRGB(255, 140, 30), glow = Color3.fromRGB(255, 130, 40),
	  desc = "🎃 EVENT ONLY · 100 candies. Every hit blows up in pumpkin fire. The most OP sword ever." },
}
local SWORD_BY_ID = {}
for i, s in ipairs(SWORDS) do
	s.order = i
	SWORD_BY_ID[s.id] = s
end

local UPGRADES = {
	{ id = "damage", name = "Sharpness",     icon = "⚔️", max = 10, base = 30, growth = 1.62, step = 0.12, desc = "+12% damage" },
	{ id = "speed",  name = "Swift Strikes", icon = "⚡", max = 10, base = 40, growth = 1.62, step = 0.07, desc = "+7% swing speed" },
	{ id = "range",  name = "Long Reach",    icon = "🗡️", max = 8,  base = 50, growth = 1.7,  step = 0.6,  desc = "+0.6 reach & longer blade" },
	{ id = "health", name = "Iron Heart",    icon = "❤️", max = 10, base = 35, growth = 1.6,  step = 25,   desc = "+25 max health" },
}
local UPG_BY_ID = {}
for _, u in ipairs(UPGRADES) do UPG_BY_ID[u.id] = u end
local function upgradeCost(u, lvl) return math.floor(u.base * u.growth ^ lvl) end

-- sword swing moves: arc = how wide (dot), reach bonus, damage multiplier
local SWINGS = {
	slash  = { dur = 0.42, impact = 0.46, arc = -0.25, reach = 0, mult = 1, sound = "swing" },
	back   = { dur = 0.42, impact = 0.46, arc = -0.25, reach = 0, mult = 1, sound = "swing" },
	chop   = { dur = 0.56, impact = 0.5, arc = 0.15, reach = 1.5, mult = 1.6, sound = "swingBig", finisher = true },
	wide   = { dur = 0.5, impact = 0.48, arc = -0.5, reach = 1, mult = 1.15, sound = "swingBig" },
	thrust = { dur = 0.4, impact = 0.42, arc = 0.55, reach = 2.5, mult = 1.3, sound = "swing" },
	upper  = { dur = 0.5, impact = 0.45, arc = 0, reach = 0.5, mult = 1.35, sound = "swingBig", lift = true },
	spin   = { dur = 0.62, impact = 0.5, arc = -1.1, reach = 1, mult = 1.4, sound = "swingBig", finisher = true },
}
local SWING_IDS = { "slash", "back", "chop", "wide", "thrust", "upper", "spin" }
local SWING_NUM = {}
for i, k in ipairs(SWING_IDS) do SWING_NUM[k] = i end

------------------------------------------------------------------------------------------------
-- WORLD LAYOUTS  (pure numbers, same seed everywhere → the server and every player agree on
-- where every tree, grave and rock is, so monsters walk AROUND things for everybody)
------------------------------------------------------------------------------------------------
local OB = { cell = 16, grid = {} }
local function obKey(cx, cz) return cx * 65536 + cz end
local function addOb(x, z, r)
	local o = { x = x, z = z, r = r }
	local c, m = OB.cell, r + 8
	for cx = math.floor((x - m) / c), math.floor((x + m) / c) do
		for cz = math.floor((z - m) / c), math.floor((z + m) / c) do
			local k = obKey(cx, cz)
			local l = OB.grid[k]
			if not l then
				l = {}
				OB.grid[k] = l
			end
			l[#l + 1] = o
		end
	end
	return o
end
local function obsAt(x, z)
	return OB.grid[obKey(math.floor(x / OB.cell), math.floor(z / OB.cell))]
end
local function circleFree(x, z, r)
	local list = obsAt(x, z)
	if list then
		for _, o in ipairs(list) do
			local dx, dz = x - o.x, z - o.z
			if dx * dx + dz * dz < (o.r + r) ^ 2 then return false end
		end
	end
	return true
end

local LAYOUT = {}
do
	local function mk(wid)
		local o = WORLDS[wid].origin
		return {
			id = wid, o = o,
			spawn = CFrame.lookAt(o + Vector3.new(0, 3.5, 186), o + Vector3.new(0, 3.5, 150)),
			mouth = { o.X - 11, o.X + 11, o.Z + 197, o.Z + 216 },
		}
	end
	local function near(lx, lz, cx, cz, r) return (lx - cx) ^ 2 + (lz - cz) ^ 2 < r * r end
	local function outside(lx, lz, pad) return math.abs(lx) > 186 - pad or lz < -210 + pad or lz > 196 - pad end

	------------------------------------------------------------------ ⚰ GRAVEYARD
	do
		local L = mk("grave")
		local wr = Random.new(1031)
		local O = L.o
		L.boss = O + Vector3.new(0, 0, -150)
		L.arena = { x = O.X, z = O.Z - 150, r = 34 }
		local function blocked(lx, lz, pad)
			pad = pad or 0
			if outside(lx, lz, pad) then return true end
			if math.abs(lx) < 10 + pad and lz > -8 then return true end                        -- road
			if lz > 160 - pad and math.abs(lx) < 48 + pad then return true end                  -- cave mouth
			if math.abs(lz + 5) < 7 + pad and math.abs(lx) < 166 then return true end           -- fence (south side)
			if lz < -5 and math.abs(math.abs(lx) - 160) < 6 + pad then return true end           -- fence (sides)
			if lz < -5 and math.abs(lx) > 160 then return true end
			if near(lx, lz, 0, -150, 38 + pad) then return true end                              -- boss arena
			if lx > -20 - pad and lx < 20 + pad and lz < -176 + pad then return true end          -- crypt
			if math.abs(lx) < 7 + pad and lz < -5 then return true end                            -- yard path
			return false
		end
		L.blocked = blocked
		local function place(n, rad, pad, fn, zMin, zMax, xMax)
			local made = 0
			for _ = 1, n * 6 do
				if made >= n then break end
				local lx = wr:NextNumber(-(xMax or 184), xMax or 184)
				local lz = wr:NextNumber(zMin or -208, zMax or 194)
				if not blocked(lx, lz, pad) and circleFree(O.X + lx, O.Z + lz, rad + pad) then
					made += 1
					fn(lx, lz)
				end
			end
		end
		-- the crypt (boss lair) + mausoleum walls
		for _, x in ipairs({ -12, -4, 4, 12 }) do addOb(O.X + x, O.Z - 192, 5) end
		-- graves in rows (zombies climb out of these)
		L.graves, L.rise = {}, {}
		for lz = -197, -26, 9 do
			for lx = -144, 144, 9 do
				local jx, jz = lx + wr:NextNumber(-1.2, 1.2), lz + wr:NextNumber(-1, 1)
				local keep = wr:NextNumber() < 0.64
				local g = { x = O.X + jx, z = O.Z + jz, round = wr:NextNumber() < 0.6, shade = wr:NextInteger(96, 140),
					rx = wr:NextNumber(-8, 8), ry = wr:NextNumber(-10, 10), rz = wr:NextNumber(-8, 8), candle = wr:NextNumber() < 0.12,
					kind = wr:NextInteger(1, 4) }
				if keep and not blocked(jx, jz, 2) then
					addOb(g.x, g.z, 1.1)
					table.insert(L.graves, g)
					table.insert(L.rise, Vector3.new(g.x, 0, g.z + 2.6))
				end
			end
		end
		-- pumpkin patch outside the gates
		L.pumpkins, L.scarecrows, L.hay, L.trees, L.lamps, L.corn, L.coffins, L.yardTrees = {}, {}, {}, {}, {}, {}, {}, {}
		place(10, 7, 2, function(lx, lz)
			local cx, cz = O.X + lx, O.Z + lz
			addOb(cx, cz, 0.1)
			for _ = 1, wr:NextInteger(6, 11) do
				local px, pz = cx + wr:NextNumber(-7, 7), cz + wr:NextNumber(-7, 7)
				local s = wr:NextNumber(1.6, 3.4)
				if circleFree(px, pz, s * 0.5) then
					addOb(px, pz, s * 0.5)
					table.insert(L.pumpkins, { x = px, z = pz, s = s, a = wr:NextNumber(0, 6.28), lit = wr:NextNumber() < 0.35,
						tint = wr:NextInteger(1, 3) })
				end
			end
		end, 14, 158)
		place(6, 1.2, 4, function(lx, lz)
			addOb(O.X + lx, O.Z + lz, 0.9)
			table.insert(L.scarecrows, { x = O.X + lx, z = O.Z + lz, a = wr:NextNumber(-0.6, 0.6) })
		end, 20, 150)
		place(14, 2, 2, function(lx, lz)
			addOb(O.X + lx, O.Z + lz, 1.7)
			table.insert(L.hay, { x = O.X + lx, z = O.Z + lz, a = wr:NextNumber(0, 3.14), stack = wr:NextNumber() < 0.3 })
		end, 14, 160)
		place(36, 1.5, 3, function(lx, lz)
			addOb(O.X + lx, O.Z + lz, 1)
			table.insert(L.trees, { x = O.X + lx, z = O.Z + lz, s = wr:NextNumber(1, 1.6), a = wr:NextNumber(0, 6.28) })
		end, 14, 194)
		for i = 1, 2 do
			local side = i == 1 and -1 or 1
			table.insert(L.corn, { x = O.X + side * wr:NextNumber(60, 120), z = O.Z + wr:NextNumber(60, 130), w = 26, d = 18 })
		end
		for lz = 150, 10, -28 do
			for _, lx in ipairs({ -11, 11 }) do
				addOb(O.X + lx, O.Z + lz, 0.6)
				table.insert(L.lamps, { x = O.X + lx, z = O.Z + lz, light = (lz % 56 == 10) })
			end
		end
		place(14, 1.5, 2, function(lx, lz)
			addOb(O.X + lx, O.Z + lz, 1)
			table.insert(L.yardTrees, { x = O.X + lx, z = O.Z + lz, s = wr:NextNumber(1.1, 1.7), a = wr:NextNumber(0, 6.28) })
		end, -206, -16, 150)
		place(6, 2, 2, function(lx, lz)
			addOb(O.X + lx, O.Z + lz, 1.6)
			table.insert(L.coffins, { x = O.X + lx, z = O.Z + lz, a = wr:NextNumber(0, 6.28), open = wr:NextNumber() < 0.5 })
		end, -200, -20, 150)
		LAYOUT.grave = L
	end

	------------------------------------------------------------------ ❄ ICE WORLD
	do
		local L = mk("ice")
		local wr = Random.new(2047)
		local O = L.o
		L.boss = O + Vector3.new(0, 0, -150)
		L.arena = { x = O.X, z = O.Z - 150, r = 34 }
		L.lake = { x = O.X - 95, z = O.Z - 35, r = 42 }
		local function blocked(lx, lz, pad)
			pad = pad or 0
			if outside(lx, lz, pad) then return true end
			if lz > 160 - pad and math.abs(lx) < 48 + pad then return true end
			if near(lx, lz, 0, -150, 40 + pad) then return true end
			if near(lx, lz, -95, -35, 45 + pad) then return true end
			if math.abs(lx - 10 * math.sin(lz / 30)) < 7 + pad and lz > -110 and lz < 170 then return true end -- trail
			return false
		end
		L.blocked = blocked
		local function place(n, rad, pad, fn)
			local made = 0
			for _ = 1, n * 6 do
				if made >= n then break end
				local lx, lz = wr:NextNumber(-184, 184), wr:NextNumber(-208, 194)
				if not blocked(lx, lz, pad) and circleFree(O.X + lx, O.Z + lz, rad + pad) then
					made += 1
					fn(lx, lz)
				end
			end
		end
		L.pillars = {}
		for i = 0, 9 do
			local a = i / 10 * math.pi * 2
			local x, z = O.X + math.cos(a) * 37, O.Z - 150 + math.sin(a) * 37
			if math.sin(a) < 0.85 then -- leave the south side open as the entrance
				addOb(x, z, 2.4)
				table.insert(L.pillars, { x = x, z = z, h = wr:NextNumber(10, 22), broken = wr:NextNumber() < 0.35 })
			end
		end
		addOb(O.X, O.Z - 194, 7) -- the ice throne
		L.pines, L.crystals, L.rocks, L.igloos, L.spikes, L.snowmen = {}, {}, {}, {}, {}, {}
		place(4, 7, 4, function(lx, lz)
			addOb(O.X + lx, O.Z + lz, 6.5)
			table.insert(L.igloos, { x = O.X + lx, z = O.Z + lz, a = wr:NextNumber(0, 6.28) })
		end)
		place(105, 1.2, 2, function(lx, lz)
			local s = wr:NextNumber(0.9, 1.6)
			addOb(O.X + lx, O.Z + lz, 0.8 * s)
			table.insert(L.pines, { x = O.X + lx, z = O.Z + lz, s = s, a = wr:NextNumber(0, 6.28), snow = wr:NextNumber() < 0.8 })
		end)
		place(30, 2, 2, function(lx, lz)
			addOb(O.X + lx, O.Z + lz, 1.8)
			table.insert(L.crystals, { x = O.X + lx, z = O.Z + lz, s = wr:NextNumber(0.8, 1.6), a = wr:NextNumber(0, 6.28),
				hue = wr:NextInteger(1, 3), light = wr:NextNumber() < 0.3 })
		end)
		place(28, 3, 2, function(lx, lz)
			local s = wr:NextNumber(3, 8)
			addOb(O.X + lx, O.Z + lz, s * 0.5)
			table.insert(L.rocks, { x = O.X + lx, z = O.Z + lz, s = s, a = wr:NextNumber(0, 6.28), t = wr:NextNumber(0, 0.4) })
		end)
		place(24, 1, 2, function(lx, lz)
			addOb(O.X + lx, O.Z + lz, 0.9)
			table.insert(L.spikes, { x = O.X + lx, z = O.Z + lz, h = wr:NextNumber(4, 9), a = wr:NextNumber(0, 6.28), t = wr:NextNumber(-0.25, 0.25) })
		end)
		place(7, 1.4, 3, function(lx, lz)
			addOb(O.X + lx, O.Z + lz, 1.3)
			table.insert(L.snowmen, { x = O.X + lx, z = O.Z + lz, a = wr:NextNumber(0, 6.28) })
		end)
		LAYOUT.ice = L
	end

	------------------------------------------------------------------ 🌴 JUNGLE
	do
		local L = mk("jungle")
		local wr = Random.new(3079)
		local O = L.o
		L.boss = O + Vector3.new(0, 0, -138)
		L.arena = { x = O.X, z = O.Z - 138, r = 34 }
		local function pathX(lz) return 18 * math.sin(lz / 40) end
		L.pathX = pathX
		local function blocked(lx, lz, pad)
			pad = pad or 0
			if outside(lx, lz, pad) then return true end
			if lz > 160 - pad and math.abs(lx) < 48 + pad then return true end
			if near(lx, lz, 0, -138, 40 + pad) then return true end
			if lx > -40 - pad and lx < 40 + pad and lz < -168 + pad then return true end -- temple
			if math.abs(lx - pathX(lz)) < 8 + pad and lz > -110 and lz < 170 then return true end
			return false
		end
		L.blocked = blocked
		local function place(n, rad, pad, fn)
			local made = 0
			for _ = 1, n * 6 do
				if made >= n then break end
				local lx, lz = wr:NextNumber(-184, 184), wr:NextNumber(-208, 194)
				if not blocked(lx, lz, pad) and circleFree(O.X + lx, O.Z + lz, rad + pad) then
					made += 1
					fn(lx, lz)
				end
			end
		end
		for _, p in ipairs({ { -30, -195, 9 }, { -12, -195, 9 }, { 12, -195, 9 }, { 30, -195, 9 }, { -20, -180, 6 }, { 20, -180, 6 }, { 0, -182, 8 } }) do
			addOb(O.X + p[1], O.Z + p[2], p[3])
		end
		L.ruins = {}
		for i = 0, 7 do
			local a = (i / 8) * math.pi * 2 + 0.2
			if math.sin(a) < 0.8 then
				local x, z = O.X + math.cos(a) * 37, O.Z - 138 + math.sin(a) * 37
				addOb(x, z, 1.8)
				table.insert(L.ruins, { x = x, z = z, h = wr:NextNumber(6, 16), broken = wr:NextNumber() < 0.5, a = a })
			end
		end
		L.bigTrees, L.palms, L.heads, L.pools, L.barrels, L.pillars2 = {}, {}, {}, {}, {}, {}
		place(4, 4, 3, function(lx, lz)
			addOb(O.X + lx, O.Z + lz, 3.2)
			table.insert(L.heads, { x = O.X + lx, z = O.Z + lz, a = wr:NextNumber(0, 6.28) })
		end)
		place(6, 6, 2, function(lx, lz)
			table.insert(L.pools, { x = O.X + lx, z = O.Z + lz, r = wr:NextNumber(4, 7) })
			addOb(O.X + lx, O.Z + lz, 0.1)
		end)
		place(62, 3, 3, function(lx, lz)
			local s = wr:NextNumber(1, 1.7)
			addOb(O.X + lx, O.Z + lz, 2 * s)
			table.insert(L.bigTrees, { x = O.X + lx, z = O.Z + lz, s = s, a = wr:NextNumber(0, 6.28), vines = wr:NextInteger(2, 5) })
		end)
		place(34, 1, 2, function(lx, lz)
			local s = wr:NextNumber(0.9, 1.4)
			addOb(O.X + lx, O.Z + lz, 0.8)
			table.insert(L.palms, { x = O.X + lx, z = O.Z + lz, s = s, a = wr:NextNumber(0, 6.28), lean = wr:NextNumber(-0.25, 0.25) })
		end)
		place(16, 1.6, 2, function(lx, lz)
			addOb(O.X + lx, O.Z + lz, 1.5)
			table.insert(L.pillars2, { x = O.X + lx, z = O.Z + lz, h = wr:NextNumber(4, 12), a = wr:NextNumber(-0.3, 0.3), broken = wr:NextNumber() < 0.6 })
		end)
		place(14, 1.4, 2, function(lx, lz)
			addOb(O.X + lx, O.Z + lz, 1.2)
			table.insert(L.barrels, { x = O.X + lx, z = O.Z + lz, toxic = wr:NextNumber() < 0.45, tipped = wr:NextNumber() < 0.3, a = wr:NextNumber(0, 6.28) })
		end)
		LAYOUT.jungle = L
	end
end

local function zoneOf(wid, x, z)
	local sp = SPAWNS[wid]
	if not sp then return nil end
	local o = WORLDS[wid].origin
	for name, zd in pairs(sp.zones) do
		if inRect(x - o.X, z - o.Z, zd.rect) then return name end
	end
	return nil
end

------------------------------------------------------------------------------------------------
-- MONSTER BRAIN  (runs on the SERVER in multiplayer, or on YOUR DEVICE when playing solo)
-- Pure logic: positions, health, attacks. What things look like lives in the client part.
------------------------------------------------------------------------------------------------
local Sim = { worlds = {}, byId = {}, nextId = 1, bossClock = BOSS_EVERY, now = 0 }
Sim.out = function(_scope, _msg, ...) end -- set by the server / client: (scope, message, ...)

for _, wid in ipairs(WORLD_ORDER) do
	Sim.worlds[wid] = { id = wid, mobs = {}, spawnT = {}, projs = {}, hazards = {}, timers = {}, boss = nil, idleT = 0, hunters = {} }
end

local AVATAR_MULT = { grave = 1, ice = 3, jungle = 5 }
local MOB_KINDS = { "zombie", "dog", "giant", "frozen", "thrower", "yeti", "monkey", "gas", "toxic", "avatar", "gravekeeper", "titan", "kongo" }
local KIND_NUM = {}
for i, k in ipairs(MOB_KINDS) do KIND_NUM[k] = i end

do
	local function mobForward(m) return Vector3.new(-math.sin(m.yaw), 0, -math.cos(m.yaw)) end
	Sim.forward = mobForward

	local function zoneRect(m)
		local sp = SPAWNS[m.world]
		local zd = sp and sp.zones[m.zone]
		return zd and zd.rect
	end

	local function inZone(m, p, pad)
		local rc = zoneRect(m)
		if not rc then return true end
		local o = WORLDS[m.world].origin
		local x, z = p.X - o.X, p.Z - o.Z
		return x >= rc[1] - pad and x <= rc[2] + pad and z >= rc[3] - pad and z <= rc[4] + pad
	end

	local function constrain(m, p)
		local r = m.def.radius
		local list = obsAt(p.X, p.Z)
		if list then
			for _, o in ipairs(list) do
				local dx, dz = p.X - o.x, p.Z - o.z
				local minD = o.r + r
				local dd = dx * dx + dz * dz
				if dd < minD * minD then
					local d = math.sqrt(dd)
					if d < 0.01 then dx, dz, d = 1, 0, 1 end
					p = Vector3.new(o.x + dx / d * minD, 0, o.z + dz / d * minD)
				end
			end
		end
		local rc = zoneRect(m)
		if rc then
			local o = WORLDS[m.world].origin
			p = Vector3.new(math.clamp(p.X, o.X + rc[1] + r, o.X + rc[2] - r), 0, math.clamp(p.Z, o.Z + rc[3] + r, o.Z + rc[4] - r))
		end
		return p
	end
	Sim.constrain = constrain

	local function turnToward(m, dir, step)
		local d = angDiff(m.yaw, yawOf(dir.X, dir.Z))
		local s = m.def.turn * step
		m.yaw += math.clamp(d, -s, s)
	end

	local function refreshFlags(m, now)
		local f = 0
		if m.aggro then f += 1 end
		if now < m.slowUntil then f += 2 end
		if now < m.burnUntil then f += 4 end
		if now < m.poisonUntil then f += 8 end
		if m.ignited then f += 16 end
		if m.runner then f += 32 end
		if m.enraged then f += 64 end
		m.flags = f
		m.hpFrac = math.clamp(m.hp / m.maxHp, 0, 1)
	end

	------------------------------------------------------------------------------------------ spawning
	function Sim.spawn(wid, kind, pos, opts)
		opts = opts or {}
		local def = MOBS[kind]
		local W = Sim.worlds[wid]
		if not def or not W then return nil end
		local id = Sim.nextId
		repeat
			id = (id % 60000) + 1
		until not Sim.byId[id]
		Sim.nextId = id
		local hp = math.floor(def.hp * (opts.hpMult or 1))
		local zone = opts.zone or zoneOf(wid, pos.X, pos.Z)
		if not zone then -- outside every zone (on a road...) → use the closest one
			local o, best = WORLDS[wid].origin, math.huge
			for name, zd in pairs(SPAWNS[wid].zones) do
				local rc = zd.rect
				local cx = math.clamp(pos.X - o.X, rc[1], rc[2])
				local cz = math.clamp(pos.Z - o.Z, rc[3], rc[4])
				local d = (cx - (pos.X - o.X)) ^ 2 + (cz - (pos.Z - o.Z)) ^ 2
				if d < best then zone, best = name, d end
			end
		end
		local p = Vector3.new(pos.X, 0, pos.Z)
		local m = {
			id = id, kind = kind, def = def, world = wid, zone = zone,
			pos = p, home = p, yaw = opts.yaw or rng:NextNumber(-math.pi, math.pi),
			hp = hp, maxHp = hp, hpFrac = 1, flags = 0, dmgMult = opts.dmgMult or 1,
			state = opts.rise and "rise" or "idle", stateT = rng:NextNumber(0.5, 2), atkT = 0, atkHit = false,
			cool = 0, aggro = false, provoked = -10, target = nil, retarget = 0,
			vel = Vector3.zero, speed = 0, extraY = 0,
			slowUntil = 0, burnUntil = 0, poisonUntil = 0, dotTick = 0, dotDmg = 0, dotKey = nil,
			contrib = {}, frame = rng:NextInteger(0, 5), skipDt = 0,
			sideUntil = 0, sideDir = Vector3.zero, checkPos = p, checkT = 0,
			runner = def.runner ~= nil and rng:NextNumber() < def.runner,
			ignited = false, spitCool = 0, auraT = 0, moveIdx = rng:NextInteger(0, 3), parent = opts.parent,
			userId = opts.userId, name = opts.name, born = Sim.now,
		}
		Sim.byId[id] = m
		table.insert(W.mobs, m)
		return m
	end

	local function removeMob(m)
		m.removed = true
		Sim.byId[m.id] = nil
		local W = Sim.worlds[m.world]
		local i = table.find(W.mobs, m)
		if i then table.remove(W.mobs, i) end
		if W.boss == m then W.boss = nil end
	end

	function Sim.spawnAvatar(wid, pos, key, name)
		local W = Sim.worlds[wid]
		if not W then return end
		for _, m in ipairs(W.mobs) do
			if m.kind == "avatar" and m.userId == key and not m.dead then removeMob(m) break end
		end
		local mult = AVATAR_MULT[wid] or 1
		return Sim.spawn(wid, "avatar", pos, { rise = true, userId = key, name = name, hpMult = mult, dmgMult = 1 + (mult - 1) * 0.45 })
	end

	function Sim.spawnBoss(wid)
		local W = Sim.worlds[wid]
		if not W or (W.boss and not W.boss.dead) then return end
		local L = LAYOUT[wid]
		local n = math.max(1, #W.hunters)
		local kind = WORLDS[wid].boss
		local b = Sim.spawn(wid, kind, L.boss, { rise = true, zone = SPAWNS[wid].bossZone, hpMult = 1 + 0.6 * (n - 1), yaw = 0 })
		if b then
			W.boss = b
			Sim.out("all", "boss", "spawn", wid, kind)
		end
	end

	------------------------------------------------------------------------------------------ hurting players
	local function hurt(h, dmg, from, effect)
		if not h or not h.vulnerable then return end
		Sim.out({ key = h.key }, "hurt", math.floor(dmg + 0.5), from.X, from.Z, effect or "")
	end

	local function impact(W, center, r, dmg, effect, style)
		Sim.out({ world = W.id }, "boom", center.X, center.Z, r, style or "dust")
		for _, h in ipairs(W.hunters) do
			if h.vulnerable and flat(h.pos - center).Magnitude <= r + 0.8 then hurt(h, dmg, center, effect) end
		end
	end

	local function tele(W, center, r, t, style)
		Sim.out({ world = W.id }, "tele", center.X, center.Z, r, t, style or "red")
	end

	local function launch(W, m, style, target, flight, r, dmg, effect, puddle)
		local to = Vector3.new(target.X + rng:NextNumber(-1.2, 1.2), 0, target.Z + rng:NextNumber(-1.2, 1.2))
		table.insert(W.projs, { to = to, t = 0, dur = flight, r = r, dmg = dmg, effect = effect, puddle = puddle, from = m.pos, style = style })
		Sim.out({ world = W.id }, "proj", style, m.id, m.pos.X, m.pos.Z, to.X, to.Z, flight, r)
	end

	------------------------------------------------------------------------------------------ damage + death
	local function kill(m, key, fromPos)
		if m.dead then return end
		m.dead = true
		m.state = "dead"
		local W = Sim.worlds[m.world]
		local credits, seen = {}, {}
		local need = m.def.boss and 1 or m.maxHp * 0.15
		for k, d in pairs(m.contrib) do
			if d >= need or k == key then
				table.insert(credits, k)
				seen[k] = true
			end
		end
		if key and not seen[key] then table.insert(credits, key) end
		local fall = 1
		if fromPos then
			local toA = flat(fromPos - m.pos)
			if toA.Magnitude > 0.1 and mobForward(m):Dot(toA.Unit) < 0 then fall = -1 end
		end
		local explode = m.kind == "gas" and m.ignited
		Sim.out({ world = m.world }, "died", m.id, fall, credits, m.pos.X, m.pos.Z, explode and 1 or 0, m.kind)
		local wasBoss = W.boss == m
		removeMob(m)
		if explode then
			local c = m.pos
			local dmg = m.def.dmg * m.dmgMult * 1.2
			tele(W, c, 9, 0.7, "fire")
			table.insert(W.timers, { at = Sim.now + 0.7, fn = function() impact(W, c, 9, dmg, "burn", "fire") end })
		end
		if wasBoss or m.def.boss then
			Sim.out("all", "boss", "dead", m.world, m.kind, credits)
			-- the boss's minions crumble with it
			for i = #W.mobs, 1, -1 do
				local o = W.mobs[i]
				if o.parent == m.id then
					Sim.out({ world = m.world }, "died", o.id, 1, {}, o.pos.X, o.pos.Z, 0, o.kind)
					removeMob(o)
				end
			end
		end
	end

	-- o = { crit, finisher, effect, from (Vector3), dot }
	function Sim.damage(id, amount, key, o)
		local m = Sim.byId[id]
		if not m or m.dead or m.state == "rise" then return false end
		o = o or {}
		local now = Sim.now
		amount = math.max(1, math.floor(amount + 0.5))
		m.hp -= amount
		if key then m.contrib[key] = (m.contrib[key] or 0) + amount end
		if not o.dot then
			m.provoked = now
			m.aggro = true
			if key then m.wantKey = key end
			if o.from and not m.def.boss and m.def.ai ~= "slam" then
				local dir = flat(m.pos - o.from)
				if dir.Magnitude > 0.1 then m.vel += dir.Unit * (o.finisher and 26 or 14) end
			end
			if not m.def.boss and m.def.ai ~= "slam" and m.state == "attack" and m.atkT < 0.4 then
				m.state, m.cool = "chase", now + 0.5
			end
			if o.effect == "frost" then
				m.slowUntil = now + 2.5
			elseif o.effect == "burn" or o.effect == "pumpkin" then
				m.burnUntil = now + 2.4
				m.dotDmg = math.max(2, math.floor(amount * 0.12))
				m.dotKey = key
			elseif o.effect == "venom" then
				m.poisonUntil = now + 3
				m.dotDmg = math.max(2, math.floor(amount * 0.15))
				m.dotKey = key
			end
		end
		refreshFlags(m, now)
		if m.hp <= 0 then
			kill(m, key, o.from)
			return true
		end
		return false
	end

	------------------------------------------------------------------------------------------ targets
	local function findHunter(hs, key)
		for _, h in ipairs(hs) do
			if h.key == key then return h end
		end
		return nil
	end

	local function targetFor(m, hs, now)
		local def = m.def
		local cur = m.target and findHunter(hs, m.target)
		if cur and cur.vulnerable then
			local d = flat(cur.pos - m.pos).Magnitude
			local keep = d < def.aggro * 2.4 and inZone(m, cur.pos, 14)
			if not keep and now - m.provoked < 5 and inZone(m, cur.pos, 30) then keep = true end
			if keep and now < m.retarget then return cur end
		end
		m.retarget = now + 0.6
		if m.wantKey then
			local h = findHunter(hs, m.wantKey)
			m.wantKey = nil
			if h and h.vulnerable and inZone(m, h.pos, 30) then
				m.target = h.key
				return h
			end
		end
		local best, bd = nil, def.aggro
		if cur and cur.vulnerable and inZone(m, cur.pos, 14) then
			best, bd = cur, flat(cur.pos - m.pos).Magnitude * 0.8 -- stick to who we're chasing
			if bd > def.aggro * 2.4 then best, bd = nil, def.aggro end
		end
		for _, h in ipairs(hs) do
			if h.vulnerable and inZone(m, h.pos, 10) then
				local d = flat(h.pos - m.pos).Magnitude
				if d < bd then best, bd = h, d end
			end
		end
		m.target = best and best.key or nil
		return best
	end

	------------------------------------------------------------------------------------------ movement
	local function steer(W, m, targetPos, wantSpeed, dt, now)
		local desired = Vector3.zero
		if targetPos then
			local d = flat(targetPos - m.pos)
			if d.Magnitude > 0.05 then desired = d.Unit end
		end
		if desired.Magnitude > 0 then
			if now < m.sideUntil then desired += m.sideDir * 1.6 end
			local list = obsAt(m.pos.X, m.pos.Z)
			if list then
				for _, o in ipairs(list) do
					local dx, dz = m.pos.X - o.x, m.pos.Z - o.z
					local d = math.sqrt(dx * dx + dz * dz)
					local clear = o.r + m.def.radius + 2
					if d < clear and d > 0.01 then
						desired += Vector3.new(dx / d, 0, dz / d) * ((1 - d / clear) * 2.4)
					end
				end
			end
			for _, o in ipairs(W.mobs) do
				if o ~= m and not o.dead then
					local dx, dz = m.pos.X - o.pos.X, m.pos.Z - o.pos.Z
					local rr = m.def.radius + o.def.radius + 0.8
					local dd = dx * dx + dz * dz
					if dd < rr * rr and dd > 0.0001 then
						local d = math.sqrt(dd)
						desired += Vector3.new(dx / d, 0, dz / d) * ((1 - d / rr) * 1.6)
					end
				end
			end
		end
		if desired.Magnitude > 0.05 and wantSpeed > 0 then
			local diff = angDiff(m.yaw, yawOf(desired.X, desired.Z))
			local step = m.def.turn * dt
			m.yaw += math.clamp(diff, -step, step)
			wantSpeed *= 0.3 + 0.7 * math.max(0, math.cos(diff))
		else
			wantSpeed = 0
		end
		local accel = (m.def.rig == "dog" or m.def.rig == "monkey") and 6 or 3
		m.speed += (wantSpeed - m.speed) * math.min(1, dt * accel)
		local newPos = constrain(m, m.pos + mobForward(m) * (m.speed * dt) + m.vel * dt)
		m.vel *= math.exp(-dt * 6)
		m.checkT += dt
		if m.checkT > 1 then
			if wantSpeed > 1 and flat(newPos - m.checkPos).Magnitude < 1 then
				local f = mobForward(m)
				m.sideDir = Vector3.new(-f.Z, 0, f.X) * ((rng:NextNumber() < 0.5) and -1 or 1)
				m.sideUntil = now + 0.9
			end
			m.checkT, m.checkPos = 0, newPos
		end
		m.pos = newPos
	end

	local function standStill(m, dt)
		m.speed = math.max(0, m.speed - dt * 30)
		if m.vel.Magnitude > 0.05 then
			m.pos = constrain(m, m.pos + m.vel * dt)
			m.vel *= math.exp(-dt * 6)
		end
	end

	------------------------------------------------------------------------------------------ attacks
	local function mobDmg(m) return m.def.dmg * m.dmgMult end

	local function startState(m, st, now)
		m.state, m.atkT, m.atkHit = st, 0, false
		if st == "attack" or st == "pounce" then m.cool = now + m.def.atk + m.def.cd end
	end

	local function updateAttack(W, m, dt, h)
		local def = m.def
		m.atkT += dt / def.atk
		if h and m.atkT < 0.45 then
			local d = flat(h.pos - m.pos)
			if d.Magnitude > 0.1 then turnToward(m, d, dt * 1.5) end
		end
		local slam = def.ai == "slam"
		if not m.atkHit and m.atkT >= (slam and 0.52 or 0.47) then
			m.atkHit = true
			local f = mobForward(m)
			if slam then
				local center = m.pos + f * (3.4 * def.scale / 1.75)
				impact(W, center, def.slamR, mobDmg(m), def.effect, def.effect == "chill" and "ice" or "slam")
			elseif h then
				local d = flat(h.pos - m.pos)
				if d.Magnitude <= def.reach + 1.6 and (d.Magnitude < 2 or f:Dot(d.Unit) > 0.2) then
					local eff = def.effect
					if m.kind == "gas" and not m.ignited then eff = nil end
					hurt(h, mobDmg(m), m.pos, eff)
				end
			end
		end
		if m.atkT >= 1 then
			m.state, m.stateT, m.atkT = m.aggro and "chase" or "idle", 1, 0
		end
	end

	local function startPounce(m, now, h)
		startState(m, "pounce", now)
		local d = flat(h.pos - m.pos)
		m.yaw = yawOf(d.X, d.Z)
		m.pStart = m.pos
		local reach = d.Magnitude > 0.1 and d.Unit * math.min(d.Magnitude + 1.5, m.def.pounce + 2) or Vector3.zero
		m.pEnd = constrain(m, m.pos + reach)
	end

	local function updatePounce(m, dt, h)
		m.atkT += dt / m.def.atk
		local t = m.atkT
		local H = m.def.leapH or 2.4
		if t < 0.28 then
			m.extraY = 0
		elseif t < 0.7 then
			local u = (t - 0.28) / 0.42
			m.pos = m.pStart:Lerp(m.pEnd, u)
			m.extraY = math.sin(u * math.pi) * H * m.def.scale
			if not m.atkHit and h and flat(h.pos - m.pos).Magnitude < m.def.reach then
				m.atkHit = true
				hurt(h, mobDmg(m), m.pos, m.def.effect)
			end
		else
			m.extraY = 0
			if not m.atkHit then
				m.atkHit = true
				if h and flat(h.pos - m.pos).Magnitude < m.def.reach + 0.8 then hurt(h, mobDmg(m), m.pos, m.def.effect) end
			end
		end
		if t >= 1 then
			m.extraY, m.atkT = 0, 0
			m.state, m.stateT = m.aggro and "chase" or "idle", 1
		end
	end

	local function aimAt(h, flight)
		local v = h.vel or Vector3.zero
		return h.pos + flat(v) * flight * 0.55
	end

	local function updateShoot(W, m, dt, h, now)
		local def = m.def
		m.atkT += dt / MOVE_DUR[m.state]
		if h and m.atkT < 0.5 then
			local d = flat(h.pos - m.pos)
			if d.Magnitude > 0.1 then turnToward(m, d, dt * 2) end
		end
		if not m.atkHit and m.atkT >= 0.5 then
			m.atkHit = true
			if h then
				if m.state == "throw" then
					launch(W, m, "ice", aimAt(h, 0.9), 0.9, 3.6, mobDmg(m), "chill", nil)
				else
					launch(W, m, "toxic", aimAt(h, 0.8), 0.8, 3.4, mobDmg(m) * 0.8, "sick",
						{ r = 4.5, dur = 5, dmg = mobDmg(m) * 0.3, effect = "sick" })
				end
			end
		end
		if m.atkT >= 1 then
			m.state, m.atkT = m.aggro and "chase" or "idle", 0
			m.cool = math.max(m.cool, now + 0.4)
		end
	end

	------------------------------------------------------------------------------------------ bosses
	local function chooseMove(m, dist)
		local moves = m.def.moves
		for _ = 1, #moves do
			m.moveIdx = (m.moveIdx % #moves) + 1
			local mv = moves[m.moveIdx]
			local melee = (mv == "slam" or mv == "sweep")
			if not melee or dist < m.def.reach * 1.7 then return mv end
		end
		return nil
	end

	local function bossBegin(W, m, mv, h, now)
		startState(m, mv, now)
		local def = m.def
		local data = {}
		m.mv = data
		if mv == "slam" then
			local f = mobForward(m)
			local d = h and flat(h.pos - m.pos)
			if d and d.Magnitude < def.reach + 4 then
				data.center = h.pos
			else
				data.center = m.pos + f * def.reach * 0.8
			end
			data.center = flat(data.center)
			data.r = 11
			tele(W, data.center, data.r, MOVE_DUR.slam * 0.55, "red")
		elseif mv == "sweep" then
			data.center, data.r = m.pos, def.reach + 4
			tele(W, data.center, data.r, MOVE_DUR.sweep * 0.55, "red")
		elseif mv == "leap" then
			local target = h and flat(h.pos) or m.pos
			data.from, data.to = m.pos, constrain(m, target)
			tele(W, data.to, 12, MOVE_DUR.leap * 0.75, "red")
		elseif mv == "summon" then
			Sim.out({ world = W.id }, "boom", m.pos.X, m.pos.Z, 14, "roar")
		end
	end

	local function bossUpdate(W, m, dt, now, h, dist)
		local st = m.state
		local def = m.def
		local inMove = st == "slam" or st == "sweep" or st == "summon" or st == "leap" or st == "barrel" or st == "boulder" or st == "spikes"
		if not inMove then return false end
		m.atkT += dt / MOVE_DUR[st]
		local a = m.atkT
		local data = m.mv or {}
		local dmg = mobDmg(m)
		if st == "slam" or st == "sweep" then
			if not m.atkHit and a >= 0.55 then
				m.atkHit = true
				impact(W, data.center, data.r, dmg, def.effect, def.effect == "chill" and "ice" or "slam")
			end
		elseif st == "summon" then
			if not m.atkHit and a >= 0.5 then
				m.atkHit = true
				local alive = 0
				for _, o in ipairs(W.mobs) do
					if o.parent == m.id then alive += 1 end
				end
				local kind = WORLDS[W.id].minion
				for i = 1, math.min(3, 6 - alive) do
					local ang = (i / 3) * math.pi * 2 + rng:NextNumber(0, 1)
					local p = constrain({ def = MOBS[kind], world = W.id, zone = m.zone }, m.pos + Vector3.new(math.cos(ang) * 9, 0, math.sin(ang) * 9))
					Sim.spawn(W.id, kind, p, { rise = true, zone = m.zone, parent = m.id, hpMult = 0.7 })
				end
			end
		elseif st == "leap" then
			local u = math.clamp((a - 0.25) / 0.5, 0, 1)
			if a >= 0.25 and a < 0.75 then
				m.pos = data.from:Lerp(data.to, smooth(u))
				m.extraY = math.sin(u * math.pi) * 16
			else
				m.extraY = 0
			end
			if not m.atkHit and a >= 0.75 then
				m.atkHit = true
				m.pos = data.to
				impact(W, data.to, 12, dmg * 1.1, def.effect, "slam")
			end
		elseif st == "barrel" or st == "boulder" then
			if h and a < 0.5 then
				local d = flat(h.pos - m.pos)
				if d.Magnitude > 0.1 then turnToward(m, d, dt * 2) end
			end
			if not m.atkHit and a >= 0.5 then
				m.atkHit = true
				if h then
					if st == "barrel" then
						launch(W, m, "barrel", aimAt(h, 1.1), 1.1, 6.5, dmg * 0.9, "sick",
							{ r = 7.5, dur = 6, dmg = dmg * 0.25, effect = "sick" })
					else
						launch(W, m, "boulder", aimAt(h, 1.1), 1.1, 6.5, dmg, "chill", nil)
					end
				end
			end
		elseif st == "spikes" then
			if not m.atkHit and a >= 0.3 then
				m.atkHit = true
				local pts = {}
				for _, hh in ipairs(W.hunters) do
					if hh.vulnerable and flat(hh.pos - m.pos).Magnitude < 70 then table.insert(pts, flat(hh.pos)) end
				end
				while #pts < 6 do
					local ang = rng:NextNumber(0, math.pi * 2)
					table.insert(pts, m.pos + Vector3.new(math.cos(ang), 0, math.sin(ang)) * rng:NextNumber(8, 26))
				end
				for _, p in ipairs(pts) do
					tele(W, p, 5.5, 0.75, "ice")
					table.insert(W.timers, { at = now + 0.75, fn = function() impact(W, p, 5.5, dmg * 0.7, "chill", "spike") end })
				end
			end
		end
		if a >= 1 then
			m.state, m.atkT, m.extraY = "chase", 0, 0
			m.cool = now + def.cd * (m.enraged and 0.55 or 1)
		end
		return true
	end

	------------------------------------------------------------------------------------------ one monster, one frame
	local function updateMob(W, m, dt, now, hs)
		local def = m.def
		if m.state == "rise" then
			m.atkT += dt / MOVE_DUR.rise
			if m.atkT >= 1 then
				m.state, m.stateT, m.atkT = "idle", 0.3, 0
				if def.boss then
					m.aggro = true
					m.state, m.atkT = "notice", 0
				end
			end
			return
		end
		local h = targetFor(m, hs, now)
		-- far away and calm: think less often
		if not h and not m.aggro then
			m.skipDt += dt
			m.frame += 1
			if m.frame % 4 ~= 0 then return end
			dt = m.skipDt
		end
		m.skipDt = 0

		-- burning / poison
		if now < m.burnUntil or now < m.poisonUntil then
			m.dotTick -= dt
			if m.dotTick <= 0 then
				m.dotTick = 0.5
				local dmg = m.dotDmg
				Sim.out({ world = W.id }, "hitfx", m.id, dmg, 2, 0)
				if Sim.damage(m.id, dmg, m.dotKey, { dot = true }) then return end
			end
		end

		local dist, toP = math.huge, nil
		if h then
			toP = flat(h.pos - m.pos)
			dist = toP.Magnitude
		end
		if h and not m.aggro then
			m.aggro = true
			if m.state ~= "attack" and m.state ~= "pounce" then startState(m, "notice", now) end
		elseif not h and m.aggro and now - m.provoked > 5 then
			m.aggro = false
			if m.state == "chase" or m.state == "notice" then m.state, m.stateT = "idle", rng:NextNumber(1.5, 3) end
		end
		if def.boss and not m.enraged and m.hp < m.maxHp * 0.4 then
			m.enraged = true
			Sim.out({ world = W.id }, "boom", m.pos.X, m.pos.Z, 16, "roar")
		end

		local targetPos, wantSpeed = nil, 0
		local st = m.state
		local busy = true
		if def.ai == "boss" and bossUpdate(W, m, dt, now, h, dist) then
			-- busy doing a big move
		elseif st == "attack" then
			updateAttack(W, m, dt, h)
		elseif st == "pounce" then
			updatePounce(m, dt, h)
		elseif st == "throw" or st == "spit" then
			updateShoot(W, m, dt, h, now)
		elseif st == "ignite" then
			m.atkT += dt / MOVE_DUR.ignite
			if m.atkT >= 1 then
				m.ignited = true
				m.state, m.atkT = "chase", 0
			end
		elseif st == "notice" then
			m.atkT += dt / stateDur(def, "notice")
			if toP and dist > 0.1 then turnToward(m, toP, dt * 2) end
			if m.atkT >= 1 then m.state, m.atkT = m.aggro and "chase" or "idle", 0 end
		else
			busy = false
		end

		if not busy then
			if h then
				m.state = "chase"
				targetPos = h.pos
				wantSpeed = (m.runner or m.ignited) and (def.runSpeed or def.speed) or def.speed
				if m.enraged then wantSpeed *= 1.35 end
				local ai = def.ai
				local ready = now >= m.cool
				if ai == "boss" then
					if ready then
						local mv = chooseMove(m, dist)
						if mv then bossBegin(W, m, mv, h, now) end
					end
					if dist <= def.reach * 0.7 then wantSpeed = 0 end
				elseif ai == "pounce" then
					if dist <= def.reach and ready then
						startState(m, "attack", now)
					elseif dist <= def.pounce and dist > 3.2 and ready then
						startPounce(m, now, h)
					end
				elseif ai == "ranged" then
					if dist <= def.reach and ready then
						startState(m, "attack", now)
					elseif dist <= def.range and dist >= 6 and ready then
						startState(m, "throw", now)
						m.cool = now + MOVE_DUR.throw + def.cd
					elseif dist < def.keep then
						targetPos = m.pos - toP.Unit * 10
						wantSpeed = def.speed * 0.85
					elseif dist <= def.range then
						wantSpeed = 0
						turnToward(m, toP, dt)
					end
				elseif ai == "gas" then
					if not m.ignited and dist < 20 then
						startState(m, "ignite", now)
					elseif dist <= def.reach and ready then
						startState(m, "attack", now)
					end
				elseif ai == "toxic" then
					if dist <= def.reach and ready then
						startState(m, "attack", now)
					elseif dist >= 7 and dist <= def.range and now >= m.spitCool then
						startState(m, "spit", now)
						m.spitCool = now + 4.6
					end
				else -- melee / slam
					if dist <= def.reach and ready then startState(m, "attack", now) end
				end
				if m.state == "chase" and ai ~= "ranged" and ai ~= "boss" and dist <= def.reach * 0.85 then
					wantSpeed = 0
					if toP and dist > 0.1 then turnToward(m, toP, dt) end
				end
			else
				if st ~= "wander" and st ~= "idle" then m.state, m.stateT = "idle", rng:NextNumber(1, 3) end
				m.stateT -= dt
				if m.state == "idle" then
					if m.stateT <= 0 then
						local goBack = flat(m.home - m.pos).Magnitude > 30 or def.boss
						m.target = nil
						m.goal = goBack and m.home or (m.home + Vector3.new(rng:NextNumber(-24, 24), 0, rng:NextNumber(-24, 24)))
						m.state, m.stateT = "wander", 10
					end
				elseif not m.goal or flat(m.goal - m.pos).Magnitude < 2.5 or m.stateT <= 0 then
					m.state, m.stateT, m.goal = "idle", rng:NextNumber(1.5, 4.5), nil
				else
					targetPos = m.goal
					wantSpeed = def.speed * ((def.rig == "dog" or def.rig == "monkey") and 0.28 or 0.45)
				end
			end
		end

		-- gas zombies burn whoever stands next to them
		if m.ignited and h then
			m.auraT -= dt
			if m.auraT <= 0 and dist < 3.8 then
				m.auraT = 0.8
				hurt(h, mobDmg(m) * 0.3, m.pos, "burn")
			end
		end

		if now < m.slowUntil then wantSpeed *= 0.45 end
		local s2 = m.state
		if s2 == "chase" or s2 == "wander" or s2 == "idle" then
			steer(W, m, targetPos, wantSpeed, dt, now)
		elseif s2 ~= "pounce" and s2 ~= "leap" then
			standStill(m, dt)
		end
		if h and dist < def.radius + 1.3 and dist > 0.05 and s2 ~= "pounce" and s2 ~= "leap" then
			m.pos = constrain(m, m.pos - toP.Unit * (def.radius + 1.3 - dist))
		end
	end

	------------------------------------------------------------------------------------------ spawner
	local function zoneActive(W, zd, hs)
		local o = WORLDS[W.id].origin
		for _, h in ipairs(hs) do
			local x, z = h.pos.X - o.X, h.pos.Z - o.Z
			if x >= zd.rect[1] - 45 and x <= zd.rect[2] + 45 and z >= zd.rect[3] - 45 and z <= zd.rect[4] + 45 then return true end
		end
		return false
	end

	local function spawnSpot(W, zd, hs, fromGrave)
		local o = WORLDS[W.id].origin
		local L = LAYOUT[W.id]
		for _ = 1, 25 do
			local p
			if fromGrave and L.rise and #L.rise > 0 then
				p = L.rise[rng:NextInteger(1, #L.rise)]
			else
				p = Vector3.new(o.X + rng:NextNumber(zd.rect[1] + 8, zd.rect[2] - 8), 0, o.Z + rng:NextNumber(zd.rect[3] + 8, zd.rect[4] - 8))
			end
			local tooClose, closeEnough = false, false
			for _, h in ipairs(hs) do
				local d = flat(h.pos - p).Magnitude
				if d < (fromGrave and 18 or 42) then tooClose = true end
				if d < 170 then closeEnough = true end
			end
			if not tooClose and closeEnough and circleFree(p.X, p.Z, 2) then return p end
			if not tooClose and closeEnough and fromGrave then return p end
		end
		return nil
	end

	local function spawner(W, dt, hs)
		local sp = SPAWNS[W.id]
		local n = math.max(1, #hs)
		for zname, zd in pairs(sp.zones) do
			W.spawnT[zname] = (W.spawnT[zname] or 0) - dt
			if W.spawnT[zname] <= 0 and zoneActive(W, zd, hs) then
				local alive, byKind = 0, {}
				for _, m in ipairs(W.mobs) do
					if m.zone == zname and not m.def.boss and not m.parent and m.kind ~= "avatar" then
						alive += 1
						byKind[m.kind] = (byKind[m.kind] or 0) + 1
					end
				end
				local cap = math.min(zd.max + 3 * (n - 1), 22)
				if alive >= cap then
					W.spawnT[zname] = 2
				else
					W.spawnT[zname] = (alive < cap * 0.5) and 0.6 or 2.4
					local r, acc, choice = rng:NextNumber(), 0, nil
					for _, k in ipairs(zd.kinds) do
						acc += k[2]
						if r <= acc then
							choice = k
							break
						end
					end
					choice = choice or zd.kinds[1]
					if choice[4] and (byKind[choice[1]] or 0) >= choice[4] then choice = zd.kinds[1] end
					local fromGrave = choice[3] == true and rng:NextNumber() < 0.65
					local p = spawnSpot(W, zd, hs, fromGrave)
					if p then Sim.spawn(W.id, choice[1], p, { zone = zname, rise = fromGrave }) end
				end
			end
		end
	end

	------------------------------------------------------------------------------------------ the whole world, one frame
	-- hunters: { { key, pos, vel, world, vulnerable } ... }
	function Sim.update(dt, now, hunters)
		Sim.now = now
		Sim.bossClock -= dt
		if Sim.bossClock <= 0 then
			Sim.bossClock = BOSS_EVERY
			for _, wid in ipairs(WORLD_ORDER) do Sim.spawnBoss(wid) end
		end
		for _, wid in ipairs(WORLD_ORDER) do
			local W = Sim.worlds[wid]
			local hs = {}
			for _, h in ipairs(hunters) do
				if h.world == wid then table.insert(hs, h) end
			end
			W.hunters = hs
			if #hs == 0 then
				W.idleT += dt
				if W.idleT > 60 and #W.mobs > 0 then
					for i = #W.mobs, 1, -1 do
						local m = W.mobs[i]
						if not m.def.boss and m.kind ~= "avatar" then removeMob(m) end
					end
				end
			else
				W.idleT = 0
				for i = #W.timers, 1, -1 do
					local t = W.timers[i]
					if now >= t.at then
						table.remove(W.timers, i)
						t.fn()
					end
				end
				for i = #W.projs, 1, -1 do
					local p = W.projs[i]
					p.t += dt
					if p.t >= p.dur then
						table.remove(W.projs, i)
						for _, h in ipairs(hs) do
							if h.vulnerable and flat(h.pos - p.to).Magnitude <= p.r + 0.6 then hurt(h, p.dmg, p.to, p.effect) end
						end
						if p.puddle and #W.hazards < 8 then
							local pd = p.puddle
							table.insert(W.hazards, { pos = p.to, r = pd.r, untilT = now + pd.dur, dmg = pd.dmg, effect = pd.effect, tick = 0.3 })
							Sim.out({ world = wid }, "puddle", p.to.X, p.to.Z, pd.r, pd.dur)
						end
					end
				end
				for i = #W.hazards, 1, -1 do
					local hz = W.hazards[i]
					if now > hz.untilT then
						table.remove(W.hazards, i)
					else
						hz.tick -= dt
						if hz.tick <= 0 then
							hz.tick = 0.6
							for _, h in ipairs(hs) do
								if h.vulnerable and flat(h.pos - hz.pos).Magnitude <= hz.r then hurt(h, hz.dmg, hz.pos, hz.effect) end
							end
						end
					end
				end
				for i = #W.mobs, 1, -1 do
					local m = W.mobs[i]
					if m and not m.dead and not m.removed then
						local ok, err = pcall(updateMob, W, m, dt, now, hs)
						if not ok then
							warn("[Forest Hunt 2.0] monster hiccup: " .. tostring(err))
							removeMob(m)
						elseif not m.removed then
							refreshFlags(m, now)
							-- wandered off far from everyone for a long time → quietly despawn
							if not m.aggro and not m.def.boss and m.kind ~= "avatar" then
								local far = true
								for _, h in ipairs(hs) do
									if flat(h.pos - m.pos).Magnitude < 230 then far = false break end
								end
								if far then
									m.farT = (m.farT or 0) + dt
									if m.farT > 20 then removeMob(m) end
								else
									m.farT = 0
								end
							end
						end
					end
				end
				spawner(W, dt, hs)
			end
		end
	end

	function Sim.clearWorld(wid)
		local W = Sim.worlds[wid]
		for i = #W.mobs, 1, -1 do removeMob(W.mobs[i]) end
		W.projs, W.hazards, W.timers = {}, {}, {}
	end
end

------------------------------------------------------------------------------------------------
-- 🌐 SERVER HALF  (only runs when this file is ALSO pasted into a Script in ServerScriptService)
-- Shares zombies + bosses between everybody, pays everyone who helps, saves progress.
------------------------------------------------------------------------------------------------
local function encodeMobs(list)
	local n = #list
	local size = 2
	for _, m in ipairs(list) do size += (m.kind == "avatar") and 28 or 20 end
	local b = buffer.create(size)
	buffer.writeu16(b, 0, n)
	local off = 2
	for _, m in ipairs(list) do
		local yaw = (m.yaw + math.pi) % (math.pi * 2) - math.pi
		buffer.writeu16(b, off, m.id)
		buffer.writeu8(b, off + 2, KIND_NUM[m.kind] or 1)
		buffer.writeu8(b, off + 3, STATE_ID[m.state] or 1)
		buffer.writef32(b, off + 4, m.pos.X)
		buffer.writef32(b, off + 8, m.pos.Z)
		buffer.writei16(b, off + 12, math.floor(yaw * 10000))
		buffer.writeu8(b, off + 14, math.floor(math.clamp(m.atkT, 0, 1) * 255))
		buffer.writeu16(b, off + 15, math.floor(math.clamp(m.hpFrac or 1, 0, 1) * 65535))
		buffer.writei16(b, off + 17, math.floor(math.clamp(m.extraY, -300, 300) * 100))
		buffer.writeu8(b, off + 19, m.flags or 0)
		off += 20
		if m.kind == "avatar" then
			buffer.writef64(b, off, m.userId or 0)
			off += 8
		end
	end
	return b
end

local function decodeMobs(b)
	local out = {}
	local n = buffer.readu16(b, 0)
	local off = 2
	for _ = 1, n do
		local r = {
			id = buffer.readu16(b, off),
			kind = MOB_KINDS[buffer.readu8(b, off + 2)] or "zombie",
			state = STATES[buffer.readu8(b, off + 3)] or "idle",
			x = buffer.readf32(b, off + 4),
			z = buffer.readf32(b, off + 8),
			yaw = buffer.readi16(b, off + 12) / 10000,
			atkT = buffer.readu8(b, off + 14) / 255,
			hpFrac = buffer.readu16(b, off + 15) / 65535,
			extraY = buffer.readi16(b, off + 17) / 100,
			flags = buffer.readu8(b, off + 19),
		}
		off += 20
		if r.kind == "avatar" then
			r.userId = buffer.readf64(b, off)
			off += 8
		end
		table.insert(out, r)
	end
	return out
end

local DEFAULT_PROFILE = {
	coins = 0, candies = 0, kills = 0, owned = { rusty = true }, equipped = "rusty",
	levels = { damage = 0, speed = 0, range = 0, health = 0 }, pumpkin = false,
	music = true, sfx = true, gfx = "high", talked = false,
}
local function cleanProfile(t)
	local p = table.clone(DEFAULT_PROFILE)
	p.owned = { rusty = true }
	p.levels = { damage = 0, speed = 0, range = 0, health = 0 }
	if type(t) ~= "table" then return p end
	local function num(v, hi) v = tonumber(v) or 0; if v ~= v then v = 0 end return math.clamp(math.floor(v), 0, hi) end
	p.coins = num(t.coins, 1e13)
	p.candies = num(t.candies, 1e6)
	p.kills = num(t.kills, 1e8)
	if type(t.owned) == "table" then
		for id, v in pairs(t.owned) do
			if SWORD_BY_ID[id] and v == true then p.owned[id] = true end
		end
	end
	if type(t.equipped) == "string" and p.owned[t.equipped] then p.equipped = t.equipped end
	if type(t.levels) == "table" then
		for _, u in ipairs(UPGRADES) do p.levels[u.id] = num(t.levels[u.id], u.max) end
	end
	p.pumpkin = t.pumpkin == true
	p.music = t.music ~= false
	p.sfx = t.sfx ~= false
	p.gfx = (t.gfx == "low") and "low" or "high"
	p.talked = t.talked == true
	return p
end

if IS_SERVER then
	if shared.__FH2_SERVER then return end
	shared.__FH2_SERVER = true
	local DataStoreService = game:GetService("DataStoreService")

	local old = ReplicatedStorage:FindFirstChild(NET_NAME)
	if old then old:Destroy() end
	local net = Instance.new("Folder")
	net.Name = NET_NAME
	local ev = Instance.new("RemoteEvent")
	ev.Name = "Ev"
	ev.Parent = net
	local snapEv = Instance.new("RemoteEvent")
	snapEv.Name = "Snap"
	snapEv.Parent = net
	net:SetAttribute("Version", VERSION)
	net.Parent = ReplicatedStorage

	local store
	pcall(function() store = DataStoreService:GetDataStore("ForestHunt2_Save_v1") end)

	local PW = {} -- per player: { world, dead, safe, profile, loaded, canSave, dirty, hits, hitWindow, swings, hello }

	local function playersIn(wid)
		local list = {}
		for p, st in pairs(PW) do
			if st.world == wid and p.Parent then table.insert(list, p) end
		end
		return list
	end

	Sim.out = function(scope, msg, ...)
		if scope == "all" then
			ev:FireAllClients(msg, ...)
		elseif type(scope) == "table" and scope.key then
			local p = Players:GetPlayerByUserId(scope.key)
			if p and PW[p] then ev:FireClient(p, msg, ...) end
		elseif type(scope) == "table" and scope.world then
			for _, p in ipairs(playersIn(scope.world)) do ev:FireClient(p, msg, ...) end
		end
	end

	local function syncBossClock()
		net:SetAttribute("BossAt", workspace:GetServerTimeNow() + Sim.bossClock)
	end
	syncBossClock()

	------------------------------------------------------------------------------------------ leaderboard (the Roblox player list)
	local function setStats(p, prof)
		if not prof then return end
		local ls = p:FindFirstChild("leaderstats")
		if not ls then
			ls = Instance.new("Folder")
			ls.Name = "leaderstats"
			for _, n in ipairs({ "Kills", "Candy", "Coins" }) do
				local v = Instance.new("IntValue")
				v.Name = n
				v.Parent = ls
			end
			ls.Parent = p
		end
		ls.Kills.Value = prof.kills or 0
		ls.Candy.Value = prof.candies or 0
		ls.Coins.Value = math.min(prof.coins or 0, 2 ^ 52)
	end

	------------------------------------------------------------------------------------------ saving
	local function load(p)
		local st = PW[p]
		if not st then return end
		local data, ok = nil, false
		if store then
			for i = 1, 3 do
				ok = pcall(function() data = store:GetAsync("u_" .. p.UserId) end)
				if ok then break end
				task.wait(i)
			end
		end
		st.profile = cleanProfile(data)
		st.canSave = store ~= nil and ok
		st.loaded = true
		setStats(p, st.profile)
	end

	local function save(p)
		local st = PW[p]
		if not st or not st.loaded or not st.canSave or not st.dirty or not store then return end
		st.dirty = false
		local prof = st.profile
		local ok, err = pcall(function() store:SetAsync("u_" .. p.UserId, prof) end)
		if not ok then
			st.dirty = true
			warn("[Forest Hunt 2.0] save failed: " .. tostring(err))
		end
	end

	Players.PlayerAdded:Connect(function(p)
		PW[p] = { world = "cave", dead = false, safe = false, hits = 0, hitWindow = 0, swings = 0, loaded = false }
		p:SetAttribute("FH_World", "cave")
		p:SetAttribute("FH_Sword", "rusty")
		task.spawn(load, p)
		task.delay(40, function()
			local st = PW[p]
			if st and not st.hello and p.Parent then
				warn("[Forest Hunt 2.0] " .. p.Name .. " has no game on their screen. Did you also paste this file into a LocalScript in StarterPlayerScripts?")
			end
		end)
	end)
	for _, p in ipairs(Players:GetPlayers()) do
		PW[p] = { world = "cave", dead = false, safe = false, hits = 0, hitWindow = 0, swings = 0, loaded = false }
		p:SetAttribute("FH_World", "cave")
		task.spawn(load, p)
	end
	Players.PlayerRemoving:Connect(function(p)
		save(p)
		PW[p] = nil
	end)
	game:BindToClose(function()
		for p in pairs(PW) do task.spawn(save, p) end
		task.wait(2.5)
	end)
	task.spawn(function()
		while true do
			task.wait(90)
			for p in pairs(PW) do task.spawn(save, p) end
		end
	end)

	------------------------------------------------------------------------------------------ messages from players
	local function rootOf(p)
		local c = p.Character
		return c and c:FindFirstChild("HumanoidRootPart")
	end

	ev.OnServerEvent:Connect(function(p, msg, a, b, c, d)
		local st = PW[p]
		if not st or type(msg) ~= "string" then return end
		if msg == "hello" then
			st.hello = true
			task.spawn(function()
				local t0 = os.clock()
				while not st.loaded and os.clock() - t0 < 15 do task.wait(0.2) end
				if PW[p] then ev:FireClient(p, "profile", st.profile or cleanProfile(nil), st.canSave == true) end
			end)
		elseif msg == "world" then
			if type(a) == "string" and WORLDS[a] then
				st.world = a
				p:SetAttribute("FH_World", a)
			end
		elseif msg == "safe" then
			st.safe = a == true
		elseif msg == "sword" then
			if type(a) == "string" and SWORD_BY_ID[a] then p:SetAttribute("FH_Sword", a) end
		elseif msg == "swing" then
			local now = os.clock()
			if now - (st.swingAt or 0) < 0.12 then return end
			st.swingAt = now
			if type(a) ~= "number" or not SWING_IDS[a] then return end
			local spd = math.clamp(tonumber(b) or 1, 0.3, 4)
			for _, o in ipairs(playersIn(st.world)) do
				if o ~= p then ev:FireClient(o, "swing", p.UserId, a, spd) end
			end
		elseif msg == "hit" then
			-- a = mob id, b = damage, c = flags (1 crit, 2 finisher, 4 lift), d = effect
			if type(a) ~= "number" or type(b) ~= "number" or b ~= b then return end
			local m = Sim.byId[a]
			local root = rootOf(p)
			if not m or not root or m.world ~= st.world or st.dead then return end
			local now = os.clock()
			if now - st.hitWindow > 1 then st.hitWindow, st.hits = now, 0 end
			st.hits += 1
			if st.hits > 30 then return end
			local dist = flat(root.Position - m.pos).Magnitude
			if dist > 26 + m.def.radius then return end
			local flags = tonumber(c) or 0
			local eff = (type(d) == "string" and (d == "frost" or d == "burn" or d == "venom" or d == "pumpkin")) and d or nil
			local dmg = math.clamp(b, 1, 6000)
			Sim.now = os.clock()
			Sim.damage(a, dmg, p.UserId, { crit = flags % 2 == 1, finisher = math.floor(flags / 2) % 2 == 1, effect = eff, from = root.Position })
			local style = (flags % 2 == 1) and 1 or 0
			for _, o in ipairs(playersIn(st.world)) do
				if o ~= p then ev:FireClient(o, "hitfx", a, math.floor(dmg), style, p.UserId) end
			end
		elseif msg == "dead" then
			if a == true then
				st.dead = true
				p:SetAttribute("FH_ZombieAt", workspace:GetServerTimeNow())
				local wid = st.world
				local root = rootOf(p)
				if MOBS and SPAWNS[wid] and root and type(b) == "number" and type(c) == "number" then
					local pos = Vector3.new(b, 0, c)
					if flat(root.Position - pos).Magnitude < 40 then
						task.delay(4.5, function()
							if p.Parent then Sim.spawnAvatar(wid, pos, p.UserId, p.DisplayName) end
						end)
					end
				end
			else
				st.dead = false
				p:SetAttribute("FH_ZombieAt", nil)
			end
		elseif msg == "save" then
			if type(a) == "table" and st.loaded then
				st.profile = cleanProfile(a)
				st.dirty = true
				setStats(p, st.profile)
			end
		end
	end)

	------------------------------------------------------------------------------------------ the shared world ticks here
	local snapT = 0
	local lastBossClock = Sim.bossClock
	RunService.Heartbeat:Connect(function(dt)
		dt = math.min(dt, 0.1)
		local hunters = {}
		for p, st in pairs(PW) do
			local root = rootOf(p)
			if root and st.world ~= "cave" then
				table.insert(hunters, {
					key = p.UserId, pos = root.Position, vel = root.AssemblyLinearVelocity, world = st.world,
					vulnerable = not st.dead and not st.safe,
				})
			end
		end
		local ok, err = pcall(Sim.update, dt, os.clock(), hunters)
		if not ok then warn("[Forest Hunt 2.0] server tick: " .. tostring(err)) end
		if Sim.bossClock > lastBossClock + 1 then syncBossClock() end
		lastBossClock = Sim.bossClock
		for _, wid in ipairs(WORLD_ORDER) do
			local W = Sim.worlds[wid]
			local b = W.boss
			local want = (b and not b.dead) and b.maxHp or nil
			if net:GetAttribute("BossHp_" .. wid) ~= want then net:SetAttribute("BossHp_" .. wid, want) end
		end
		snapT -= dt
		if snapT <= 0 then
			snapT = 0.1
			for _, wid in ipairs(WORLD_ORDER) do
				local ps = playersIn(wid)
				if #ps > 0 then
					local buf = encodeMobs(Sim.worlds[wid].mobs)
					for _, p in ipairs(ps) do snapEv:FireClient(p, wid, buf) end
				end
			end
		end
	end)
	task.spawn(function()
		while true do
			task.wait(15)
			syncBossClock()
		end
	end)

	print("[Forest Hunt 2.0] server running — multiplayer + saving ON")
	return
end

------------------------------------------------------------------------------------------------
-- 🎮 CLIENT HALF  (the game on your screen)
------------------------------------------------------------------------------------------------
local player = Players.LocalPlayer
if not player then return end
local playerScripts = player:WaitForChild("PlayerScripts")

-- Put in the wrong place (StarterGui / StarterCharacterScripts)? Run exactly one copy from PlayerScripts,
-- so the game never restarts when you die.
if script:IsA("LocalScript") and not script:IsDescendantOf(playerScripts) then
	if not shared.__FH2_BOOTED then
		shared.__FH2_BOOTED = true
		local copy = script:Clone()
		copy.Parent = playerScripts
	end
	return
end
if shared.__FH2_RUNNING then return end
shared.__FH2_RUNNING = true
shared.__FH2_BOOTED = true

local UserInputService = game:GetService("UserInputService")
local TweenService     = game:GetService("TweenService")
local Lighting         = game:GetService("Lighting")
local Debris           = game:GetService("Debris")
local StarterGui       = game:GetService("StarterGui")
local SoundService     = game:GetService("SoundService")
local ContentProvider  = game:GetService("ContentProvider")
local TextChatService  = game:GetService("TextChatService")
local GuiService       = game:GetService("GuiService")

local vr = Random.new(4242) -- decoration randomness (looks only — never affects gameplay)

local WHITE = Color3.new(1, 1, 1)
local BLACK = Color3.new(0, 0, 0)
local GOLD  = Color3.fromRGB(255, 205, 64)
local CANDY = Color3.fromRGB(255, 140, 40)

local building, builtCount = false, 0

local function make(class, props)
	local o = Instance.new(class)
	local parent
	if props then
		if props.Shape ~= nil then o.Shape = props.Shape end
		for k, v in pairs(props) do
			if k == "Parent" then
				parent = v
			elseif k ~= "Shape" then
				o[k] = v
			end
		end
	end
	if parent then o.Parent = parent end
	return o
end

local function part(props, class)
	if props.Anchored == nil then props.Anchored = true end
	props.TopSurface = Enum.SurfaceType.Smooth
	props.BottomSurface = Enum.SurfaceType.Smooth
	if props.Material == nil then props.Material = Enum.Material.SmoothPlastic end
	-- Roblox balls are always perfect spheres, so squashed ones become a block + sphere mesh
	local squash = false
	local sz = props.Size
	if props.Shape == Enum.PartType.Ball and sz and (sz.X ~= sz.Y or sz.Y ~= sz.Z) then
		props.Shape = nil
		squash = true
	end
	local p = make(class or "Part", props)
	if squash then make("SpecialMesh", { MeshType = Enum.MeshType.Sphere, Parent = p }) end
	builtCount += 1
	if building and builtCount % 220 == 0 then task.wait() end
	return p
end
local function wedge(props) return part(props, "WedgePart") end
local function weld(p0, p1) return make("WeldConstraint", { Part0 = p0, Part1 = p1, Parent = p1 }) end
local function tween(obj, t, goal, style, dir)
	local tw = TweenService:Create(obj, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), goal)
	tw:Play()
	return tw
end
local function vpick(list) return list[vr:NextInteger(1, #list)] end

local function getRoot()
	local c = player.Character
	return c and c:FindFirstChild("HumanoidRootPart")
end
local function getHum()
	local c = player.Character
	return c and c:FindFirstChildOfClass("Humanoid")
end
local function touchControls(on) pcall(function() GuiService.TouchControlsEnabled = on end) end

-- folders (client-only)
for _, name in ipairs({ "FH2_World", "FH2_FX", "FH2_Mobs", "FH2_Pickups", "ForestHunt_World", "ForestHunt_FX", "ForestHunt_Mobs", "ForestHunt_Coins" }) do
	local old = workspace:FindFirstChild(name)
	if old then old:Destroy() end
end
local worldRoot  = make("Folder", { Name = "FH2_World", Parent = workspace })
local fxFolder   = make("Folder", { Name = "FH2_FX", Parent = workspace })
local mobFolder  = make("Folder", { Name = "FH2_Mobs", Parent = workspace })
local pickFolder = make("Folder", { Name = "FH2_Pickups", Parent = workspace })
local Folders = {} -- one folder per world, only the one you're in is in the workspace
for _, wid in ipairs({ "cave", "grave", "ice", "jungle" }) do
	Folders[wid] = make("Folder", { Name = "World_" .. wid })
end

------------------------------------------------------------------------------------------------
-- SOUND  (Roblox library sounds + built-in backups that always exist)
------------------------------------------------------------------------------------------------
local Groups = {
	sfx   = make("SoundGroup", { Name = "FH2_SFX", Volume = 1, Parent = SoundService }),
	music = make("SoundGroup", { Name = "FH2_Music", Volume = 0.6, Parent = SoundService }),
	amb   = make("SoundGroup", { Name = "FH2_Ambience", Volume = 1, Parent = SoundService }),
}
local BUILTIN = {
	whoosh = "rbxasset://sounds/action_jump.mp3",
	thud   = "rbxasset://sounds/action_jump_land.mp3",
	rustle = "rbxasset://sounds/action_get_up.mp3",
	tick   = "rbxasset://sounds/volume_slider.ogg",
	oof    = "rbxasset://sounds/oof.ogg",
	ouch   = "rbxasset://sounds/ouch.ogg",
	boom   = "rbxasset://sounds/impact_explosion_03.mp3",
	wind   = "rbxasset://sounds/action_falling.ogg",
	water  = "rbxasset://sounds/action_swim.mp3",
	splash = "rbxasset://sounds/impact_water.mp3",
	slash  = "rbxasset://sounds/swordslash.wav",
	lunge  = "rbxasset://sounds/swordlunge.wav",
	unsheath = "rbxasset://sounds/unsheath.wav",
}
local SND = {
	swing    = { ids = { 91154708, 91155889, 91154633, 12222216 }, fb = BUILTIN.slash, vol = 0.55 },
	swingBig = { ids = { 82229501, 12222225 }, fb = BUILTIN.lunge, vol = 0.75 },
	draw     = { ids = { 92597425, 12222208 }, fb = BUILTIN.unsheath, vol = 0.6 },
	hit      = { ids = { 96667969, 93005921 }, fb = BUILTIN.thud, fbPitch = 1.4, vol = 0.65 },
	splat    = { ids = { 31080215, 24473960 }, fb = BUILTIN.splash, fbPitch = 1.5, vol = 0.3 },
	clang    = { ids = { 161251303, 161251243, 161251168, 161251088 }, fb = BUILTIN.thud, fbPitch = 1.9, vol = 0.55 },
	coin     = { ids = { 241560707 }, fb = BUILTIN.tick, fbPitch = 1.6, vol = 0.45 },
	coinDrop = { ids = { 19073176 }, fb = BUILTIN.tick, vol = 0.45 },
	buy      = { ids = { 99817538 }, fb = BUILTIN.tick, fbPitch = 1.2, vol = 0.8 },
	magic    = { ids = { 49460524 }, fb = BUILTIN.tick, fbPitch = 0.8, vol = 0.6 },
	click    = { ids = { 41440521, 14863866 }, fb = BUILTIN.tick, vol = 0.4 },
	blip     = { ids = { 41440521 }, fb = BUILTIN.tick, fbPitch = 1.3, vol = 0.12 },
	zGroan   = { ids = { 93591742, 63252965, 63252980, 63252992, 35971877 }, fb = BUILTIN.oof, fbPitch = 0.5, vol = 0.85 },
	zAttack  = { ids = { 93591696, 93647326 }, fb = BUILTIN.ouch, fbPitch = 0.6, vol = 0.9 },
	zDeath   = { ids = { 63252897 }, fb = BUILTIN.oof, fbPitch = 0.45, vol = 0.9 },
	dogGrowl = { ids = { 82714961, 64633891 }, fb = BUILTIN.ouch, fbPitch = 0.35, vol = 0.9 },
	dogBark  = { ids = { 257333302 }, fb = BUILTIN.ouch, fbPitch = 0.8, vol = 0.8 },
	dogBite  = { ids = { 212200200, 9113723699 }, fb = BUILTIN.thud, fbPitch = 1.6, vol = 0.85 },
	roar     = { ids = { 69935389, 51756494 }, fb = BUILTIN.oof, fbPitch = 0.3, vol = 1 },
	slam     = { ids = { 9125402735, 72069461 }, fb = BUILTIN.boom, fbPitch = 0.8, vol = 1 },
	boom     = { ids = {}, fb = BUILTIN.boom, vol = 0.9 },
	dirt     = { ids = { 102545023 }, fb = BUILTIN.rustle, fbPitch = 0.6, vol = 0.7 },
	hurt     = { ids = { 181284466, 28166570 }, fb = BUILTIN.ouch, vol = 0.6 },
	frost    = { ids = { 186936370, 41763367 }, fb = BUILTIN.splash, fbPitch = 2, vol = 0.55 },
	burn     = { ids = { 31758956, 31758934 }, fb = BUILTIN.whoosh, fbPitch = 0.5, vol = 0.55 },
	holy     = { ids = { 49460524 }, fb = BUILTIN.tick, vol = 0.4 },
	caw      = { ids = { 90731208 }, vol = 0.55 },
	whoosh   = { ids = {}, fb = BUILTIN.whoosh, vol = 0.7 },
	splash   = { ids = {}, fb = BUILTIN.splash, vol = 0.6 },
	-- loops (first working id wins)
	mCave    = { ids = { 1848183670 }, loop = true },
	mWorld   = { ids = { 1843463175 }, loop = true },
	mBoss    = { ids = { 1843463175 }, loop = true },
	ambDay   = { ids = { 152768035 }, loop = true },
	ambNight = { ids = { 126905058 }, loop = true },
	ambGhost = { ids = { 76575065 }, loop = true },
	wind     = { ids = { 32786031 }, fb = BUILTIN.wind, fbPitch = 0.6, loop = true },
	river    = { ids = { 96482944, 6564308795 }, fb = BUILTIN.water, fbPitch = 0.5, loop = true },
	fire     = { ids = { 102503996, 31759626 }, loop = true },
}

local soundOK = {}
local function sid(id) return type(id) == "number" and ("rbxassetid://" .. id) or id end
local function resolveSound(key)
	local def = SND[key]
	if not def then return nil, false end
	local good, unknown = {}, {}
	for _, id in ipairs(def.ids) do
		local s = sid(id)
		local st = soundOK[s]
		if st == true then
			table.insert(good, s)
		elseif st == nil then
			table.insert(unknown, s)
		end
	end
	if def.loop then
		if good[1] then return good[1], false end
		if unknown[1] then return unknown[1], false end
		return def.fb, true
	end
	if #good > 0 then return good[rng:NextInteger(1, #good)], false end
	if #unknown > 0 then return unknown[rng:NextInteger(1, #unknown)], false end
	return def.fb, true
end

local function soundAnchor(pos, life)
	local a = make("Part", { Name = "SoundAnchor", Anchored = true, CanCollide = false, CanQuery = false, CanTouch = false,
		Transparency = 1, Size = Vector3.new(0.2, 0.2, 0.2), CFrame = CFrame.new(pos), Parent = fxFolder })
	Debris:AddItem(a, life)
	return a
end

-- where: nil = 2D · a Part/Attachment = 3D on it · a Vector3 = 3D at that spot
local function playSfx(key, where, opts)
	local id, isFallback = resolveSound(key)
	if not id then return nil end
	local def = SND[key]
	opts = opts or {}
	local pitch = (opts.pitch or 1) * (isFallback and (def.fbPitch or 1) or 1)
	if opts.vary then pitch *= 1 + rng:NextNumber(-opts.vary, opts.vary) end
	local parent = where
	if typeof(where) == "Vector3" then
		parent = soundAnchor(where, opts.life or 6)
	elseif where == nil then
		parent = SoundService
	end
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = (def.vol or 0.6) * (opts.vol or 1)
	s.PlaybackSpeed = pitch
	s.RollOffMode = Enum.RollOffMode.InverseTapered
	s.RollOffMinDistance = opts.minDist or 10
	s.RollOffMaxDistance = opts.range or 120
	s.SoundGroup = Groups.sfx
	s.Parent = parent
	s:Play()
	Debris:AddItem(s, opts.life or 6)
	return s
end

local loopSounds = {}
local function startLoop(key, parent, volume, opts)
	local id, isFallback = resolveSound(key)
	if not id then return nil end
	opts = opts or {}
	local def = SND[key]
	local s = make("Sound", {
		Name = "Loop_" .. key, SoundId = id, Looped = true, Volume = volume or 0,
		PlaybackSpeed = (opts.speed or 1) * (isFallback and (def.fbPitch or 1) or 1),
		RollOffMode = Enum.RollOffMode.InverseTapered,
		RollOffMinDistance = opts.minDist or 12, RollOffMaxDistance = opts.range or 120,
		SoundGroup = opts.group or Groups.amb, Parent = parent or SoundService,
	})
	s:SetAttribute("FHKey", key)
	s:SetAttribute("FHSpeed", opts.speed or 1)
	s:Play()
	table.insert(loopSounds, s)
	return s
end

local function refreshLoops()
	for _, s in ipairs(loopSounds) do
		if s.Parent and soundOK[s.SoundId] == false then
			local key = s:GetAttribute("FHKey")
			local id, isFallback = resolveSound(key)
			if id and id ~= s.SoundId then
				s.SoundId = id
				s.PlaybackSpeed = (s:GetAttribute("FHSpeed") or 1) * (isFallback and (SND[key].fbPitch or 1) or 1)
				s:Play()
			end
		end
	end
end

task.spawn(function()
	local list, seen = {}, {}
	for _, def in pairs(SND) do
		for _, id in ipairs(def.ids) do
			local s = sid(id)
			if not seen[s] then
				seen[s] = true
				table.insert(list, make("Sound", { SoundId = s }))
			end
		end
	end
	pcall(function()
		ContentProvider:PreloadAsync(list, function(contentId, status)
			local num = string.match(tostring(contentId), "%d+")
			if num then soundOK["rbxassetid://" .. num] = (status == Enum.AssetFetchStatus.Success) end
		end)
	end)
	for _, s in ipairs(list) do
		if soundOK[s.SoundId] == nil then soundOK[s.SoundId] = s.IsLoaded and true or nil end
		s:Destroy()
	end
	refreshLoops()
end)

------------------------------------------------------------------------------------------------
-- LIGHTING PRESETS  (each place gets its own sky, fog and colour)
------------------------------------------------------------------------------------------------
local Look = {}
local GFX = { high = true }
do
	for _, e in ipairs(Lighting:GetChildren()) do
		if string.sub(e.Name, 1, 3) == "FH_" or string.sub(e.Name, 1, 4) == "FH2_" then e:Destroy() end
	end
	local atmo = Lighting:FindFirstChildOfClass("Atmosphere") or make("Atmosphere", { Name = "FH2_Atmosphere", Parent = Lighting })
	local bloom = make("BloomEffect", { Name = "FH2_Bloom", Intensity = 0.5, Size = 24, Threshold = 1.3, Parent = Lighting })
	local rays = make("SunRaysEffect", { Name = "FH2_Rays", Intensity = 0.05, Spread = 0.8, Parent = Lighting })
	local cc = make("ColorCorrectionEffect", { Name = "FH2_Zone", Parent = Lighting })
	make("ColorCorrectionEffect", { Name = "FH2_Hurt", Parent = Lighting })
	make("ColorCorrectionEffect", { Name = "FH2_Sick", Parent = Lighting })
	Look.atmo, Look.bloom, Look.rays, Look.cc = atmo, bloom, rays, cc
	pcall(function()
		Lighting.EnvironmentDiffuseScale = 0.6
		Lighting.EnvironmentSpecularScale = 0.7
	end)
	Lighting.GlobalShadows = true

	Look.presets = {
		cave = { clock = 0, bright = 1.2, amb = Color3.fromRGB(58, 46, 60), out = Color3.fromRGB(64, 52, 70), exp = 0.25,
			density = 0.42, offset = 0, haze = 1.4, glare = 0, color = Color3.fromRGB(70, 50, 60), decay = Color3.fromRGB(30, 20, 30),
			tint = Color3.fromRGB(255, 236, 220), sat = 0.12, con = 0.08, bloom = 0.7, rays = 0 },
		grave = { clock = 0.3, bright = 1.6, amb = Color3.fromRGB(78, 62, 104), out = Color3.fromRGB(118, 96, 150), exp = 0.15,
			density = 0.4, offset = 0.2, haze = 2.2, glare = 0.4, color = Color3.fromRGB(196, 130, 180), decay = Color3.fromRGB(96, 52, 112),
			tint = Color3.fromRGB(255, 230, 220), sat = 0.1, con = 0.1, bloom = 0.6, rays = 0.02 },
		ice = { clock = 14, bright = 2.6, amb = Color3.fromRGB(140, 160, 190), out = Color3.fromRGB(170, 190, 220), exp = 0,
			density = 0.4, offset = 0.1, haze = 2.4, glare = 0.3, color = Color3.fromRGB(216, 232, 255), decay = Color3.fromRGB(150, 182, 225),
			tint = Color3.fromRGB(232, 244, 255), sat = 0.05, con = 0.06, bloom = 0.5, rays = 0.06 },
		jungle = { clock = 16.4, bright = 2.3, amb = Color3.fromRGB(82, 104, 74), out = Color3.fromRGB(124, 146, 104), exp = 0.05,
			density = 0.46, offset = 0.15, haze = 2.2, glare = 0.5, color = Color3.fromRGB(196, 222, 170), decay = Color3.fromRGB(78, 110, 66),
			tint = Color3.fromRGB(246, 255, 232), sat = 0.18, con = 0.08, bloom = 0.55, rays = 0.12 },
	}
	function Look.apply(wid, t)
		local p = Look.presets[wid]
		if not p then return end
		t = t or 0
		Lighting.ClockTime = p.clock
		if t > 0 then
			tween(Lighting, t, { Brightness = p.bright, Ambient = p.amb, OutdoorAmbient = p.out, ExposureCompensation = p.exp })
		else
			Lighting.Brightness, Lighting.Ambient, Lighting.OutdoorAmbient, Lighting.ExposureCompensation = p.bright, p.amb, p.out, p.exp
		end
		local a = Look.atmo
		if a and a.Parent then
			a.Density = GFX.high and p.density or p.density * 0.75
			a.Offset, a.Haze, a.Glare, a.Color, a.Decay = p.offset, p.haze, p.glare, p.color, p.decay
		end
		Look.cc.TintColor, Look.cc.Saturation, Look.cc.Contrast = p.tint, p.sat, p.con
		Look.bloom.Intensity = GFX.high and p.bloom or 0.25
		Look.rays.Intensity = GFX.high and p.rays or 0
		Lighting.GlobalShadows = GFX.high
	end
end

------------------------------------------------------------------------------------------------
-- RIGS: every monster is a Roblox "boy" R15 rig (15 body parts + Motor6D joints) that this
-- script animates by hand every frame. Your own avatar can also become one (when you die).
------------------------------------------------------------------------------------------------
local Rigs = {}
do
	local function motor(name, p0, p1, c0, c1)
		p1.CFrame = p0.CFrame * c0 * c1:Inverse()
		return make("Motor6D", { Name = name, Part0 = p0, Part1 = p1, C0 = c0, C1 = c1, Parent = p0 })
	end

	-- decoration welded onto a body part
	local function extra(model, to, size, offset, color, mat, shape, cls)
		local props = { Size = size, CFrame = to.CFrame * offset, Color = color, Material = mat or Enum.Material.SmoothPlastic,
			Anchored = false, CanCollide = false, CanQuery = false, CanTouch = false, Massless = true, CastShadow = false, Parent = model }
		if shape then props.Shape = shape end
		local p = part(props, cls)
		weld(to, p)
		return p
	end
	Rigs.extra = extra

	function Rigs.setJ(J, name, cf)
		local j = J[name]
		if not j then return end
		if j.a then
			j.m.Transform = j.a * cf * j.b
		else
			j.m.Transform = cf
		end
	end

	-- o: name, scale, skin, shirt, pants, shoes, sleeveL, sleeveR, arm, leg, bulk, limb, headSize, mats
	function Rigs.boy(o)
		local s = o.scale or 1
		local A, Lg, W, Lb = o.arm or 1, o.leg or 1, o.bulk or 1, o.limb or 1
		local model = make("Model", { Name = o.name or "Zombie" })
		local footH, lowLegH, upLegH = 0.3, 1.2 * Lg, 1.2 * Lg
		local lowTorsoH, upTorsoH = 0.4, 1.6
		local upArmH, lowArmH, handH = 1.2 * A, 1.05 * A, 0.3
		local tw = 2 * W
		local yRoot = footH + lowLegH + upLegH + lowTorsoH / 2
		local root = part({ Name = "HumanoidRootPart", Size = Vector3.new(2 * W, 2, 1) * s, Transparency = 1, CanCollide = false, CanQuery = false,
			CanTouch = false, CastShadow = false, CFrame = CFrame.new(0, yRoot * s, 0), Parent = model })
		local P, J = { root = root }, {}
		local fabric = o.cloth or Enum.Material.Fabric
		local function bp(name, size, color, mat)
			return part({ Name = name, Size = size * s, Color = color, Material = mat or Enum.Material.SmoothPlastic, Anchored = false,
				CanCollide = false, CanQuery = false, CanTouch = false, Massless = true, Parent = model })
		end
		local function jt(name, p0, p1, a, b)
			J[name] = { m = motor(name, p0, p1, CFrame.new(a * s), CFrame.new(b * s)) }
		end
		P.lowerTorso = bp("LowerTorso", Vector3.new(tw, lowTorsoH, 1 * W), o.pants, fabric)
		jt("Root", root, P.lowerTorso, Vector3.zero, Vector3.zero)
		P.upperTorso = bp("UpperTorso", Vector3.new(tw, upTorsoH, 1 * W), o.shirt, fabric)
		jt("Waist", P.lowerTorso, P.upperTorso, Vector3.new(0, lowTorsoH / 2, 0), Vector3.new(0, -upTorsoH / 2, 0))
		local hs = o.headSize or 1
		P.head = bp("Head", Vector3.new(2, 1, 1) * hs, o.skin, o.skinMat)
		make("SpecialMesh", { MeshType = Enum.MeshType.Head, Scale = Vector3.new(1.25, 1.25, 1.25), Parent = P.head })
		jt("Neck", P.upperTorso, P.head, Vector3.new(0, upTorsoH / 2, 0), Vector3.new(0, -0.5 * hs, 0))
		for _, side in ipairs({ "L", "R" }) do
			local sx = side == "R" and 1 or -1
			local nm = side == "R" and "Right" or "Left"
			local sleeve = (side == "R" and o.sleeveR or o.sleeveL) or o.shirt
			local ua = bp(nm .. "UpperArm", Vector3.new(1 * Lb, upArmH, 1 * Lb), sleeve, (sleeve == o.skin) and o.skinMat or fabric)
			jt("Shoulder" .. side, P.upperTorso, ua, Vector3.new((tw / 2 + 0.5 * Lb) * sx, upTorsoH / 2 - 0.3, 0), Vector3.new(0, upArmH / 2 - 0.1, 0))
			local la = bp(nm .. "LowerArm", Vector3.new(0.95 * Lb, lowArmH, 0.95 * Lb), o.forearm or o.skin, o.skinMat)
			jt("Elbow" .. side, ua, la, Vector3.new(0, -upArmH / 2, 0), Vector3.new(0, lowArmH / 2, 0))
			local hand = bp(nm .. "Hand", Vector3.new(0.95 * Lb, handH, 0.95 * Lb), o.hands or o.skin, o.skinMat)
			jt("Wrist" .. side, la, hand, Vector3.new(0, -lowArmH / 2, 0), Vector3.new(0, handH / 2, 0))
			local ul = bp(nm .. "UpperLeg", Vector3.new(1 * Lb, upLegH, 1 * Lb), o.pants, fabric)
			jt("Hip" .. side, P.lowerTorso, ul, Vector3.new(0.5 * W * sx, -lowTorsoH / 2, 0), Vector3.new(0, upLegH / 2, 0))
			local ll = bp(nm .. "LowerLeg", Vector3.new(0.95 * Lb, lowLegH, 0.95 * Lb), o.shins or o.pants, fabric)
			jt("Knee" .. side, ul, ll, Vector3.new(0, -upLegH / 2, 0), Vector3.new(0, lowLegH / 2, 0))
			local ft = bp(nm .. "Foot", Vector3.new(1 * Lb, footH, 1.2 * Lb), o.shoes or Color3.fromRGB(50, 40, 34))
			jt("Ankle" .. side, ll, ft, Vector3.new(0, -lowLegH / 2, 0), Vector3.new(0, footH / 2, -0.1))
			P["uArm" .. side], P["lArm" .. side], P["hand" .. side] = ua, la, hand
			P["uLeg" .. side], P["lLeg" .. side], P["foot" .. side] = ul, ll, ft
		end
		P.chest, P.pelvis = P.upperTorso, P.lowerTorso
		model.PrimaryPart = root
		return model, P, J, yRoot * s
	end

	------------------------------------------------------------------------------------------ faces
	local function zFace(model, h, s, eyes, o)
		o = o or {}
		local hs = o.hs or 1
		local fz = -0.6 * hs
		for _, x in ipairs({ -0.24, 0.24 }) do
			extra(model, h, Vector3.new(0.32, 0.26, 0.06) * s * hs, CFrame.new(x * s * hs, 0.12 * s * hs, fz * s), o.socket or Color3.fromRGB(26, 24, 20))
			extra(model, h, Vector3.new(0.18, 0.16, 0.06) * s * hs, CFrame.new(x * s * hs, 0.12 * s * hs, (fz - 0.03) * s), eyes, Enum.Material.Neon)
		end
		if not o.noMouth then
			extra(model, h, Vector3.new(0.62, 0.2, 0.06) * s * hs, CFrame.new(0.05 * s, -0.25 * s * hs, fz * s), Color3.fromRGB(40, 10, 10))
			for i = -1, 1 do
				extra(model, h, Vector3.new(0.1, 0.1, 0.05) * s * hs, CFrame.new((0.05 + i * 0.17) * s * hs, -0.18 * s * hs, (fz - 0.03) * s), Color3.fromRGB(230, 220, 180))
			end
		end
		if o.stitch then
			for i = 0, 2 do
				extra(model, h, Vector3.new(0.04, 0.16, 0.05) * s, CFrame.new((-0.42 + i * 0.08) * s, 0.36 * s, (fz + 0.02) * s), Color3.fromRGB(30, 26, 22))
			end
			extra(model, h, Vector3.new(0.24, 0.04, 0.05) * s, CFrame.new(-0.34 * s, 0.36 * s, (fz + 0.02) * s), Color3.fromRGB(30, 26, 22))
		end
	end

	local Z_SKINS  = { Color3.fromRGB(118, 150, 96), Color3.fromRGB(132, 158, 112), Color3.fromRGB(100, 132, 94), Color3.fromRGB(142, 152, 122), Color3.fromRGB(112, 140, 120) }
	local Z_SHIRTS = { Color3.fromRGB(70, 80, 120), Color3.fromRGB(120, 60, 55), Color3.fromRGB(80, 100, 70), Color3.fromRGB(150, 140, 120),
		Color3.fromRGB(60, 60, 64), Color3.fromRGB(150, 110, 60), Color3.fromRGB(40, 130, 150), Color3.fromRGB(196, 40, 28) }
	local Z_PANTS  = { Color3.fromRGB(55, 50, 65), Color3.fromRGB(70, 60, 45), Color3.fromRGB(45, 55, 80), Color3.fromRGB(85, 75, 60), Color3.fromRGB(13, 105, 172) }
	local Z_HAIR   = { Color3.fromRGB(45, 40, 35), Color3.fromRGB(90, 70, 40), Color3.fromRGB(120, 115, 105), Color3.fromRGB(30, 30, 30), Color3.fromRGB(150, 100, 50) }

	local function tornClothes(model, P, s, shirt, skin, r)
		local dark = shirt:Lerp(BLACK, 0.3)
		-- ragged shirt hem, exposed ribs, wound, belt
		extra(model, P.chest, Vector3.new(2.06, 0.28, 1.09) * s, CFrame.new(0, -0.68 * s, 0) * CFrame.Angles(0, 0, math.rad(4)), dark, Enum.Material.Fabric)
		for i = 0, 2 do
			extra(model, P.chest, Vector3.new(0.28, 0.32, 0.08) * s, CFrame.new((-0.6 + i * 0.55) * s, -0.82 * s, -0.5 * s) * CFrame.Angles(0, 0, math.rad(45)),
				dark, Enum.Material.Fabric)
		end
		if r:NextNumber() < 0.7 then
			extra(model, P.chest, Vector3.new(0.7, 0.55, 0.06) * s, CFrame.new(0.42 * s, -0.12 * s, -0.53 * s), skin)
			for i = 0, 2 do
				extra(model, P.chest, Vector3.new(0.6, 0.06, 0.05) * s, CFrame.new(0.42 * s, (0.05 - i * 0.15) * s, -0.565 * s), Color3.fromRGB(225, 215, 190))
			end
		end
		extra(model, P.chest, Vector3.new(0.45, 0.4, 0.06) * s, CFrame.new(-0.5 * s, 0.35 * s, -0.53 * s), Color3.fromRGB(100, 20, 22))
		extra(model, P.pelvis, Vector3.new(2.04, 0.16, 1.06) * s, CFrame.new(0, 0.12 * s, 0), Color3.fromRGB(40, 30, 24))
		extra(model, P.pelvis, Vector3.new(0.3, 0.2, 0.08) * s, CFrame.new(0, 0.12 * s, -0.55 * s), Color3.fromRGB(150, 140, 120), Enum.Material.Metal)
		-- ripped pant leg
		if r:NextNumber() < 0.5 then
			local side = r:NextNumber() < 0.5 and "L" or "R"
			extra(model, P["lLeg" .. side], Vector3.new(0.97, 0.5, 0.97) * s, CFrame.new(0, -0.3 * s, 0), skin)
		end
		for _, side in ipairs({ "L", "R" }) do -- claws
			local hand = P["hand" .. side]
			for i = -1, 1 do
				extra(model, hand, Vector3.new(0.14, 0.4, 0.14) * s, CFrame.new(i * 0.27 * s, -0.3 * s, -0.25 * s) * CFrame.Angles(math.rad(-20), 0, 0), Color3.fromRGB(70, 60, 45))
			end
		end
	end

	local function hairOrHat(model, h, s, r)
		local style = r:NextInteger(1, 4)
		if style == 1 then
			local c = Z_HAIR[r:NextInteger(1, #Z_HAIR)]
			extra(model, h, Vector3.new(1.05, 0.26, 1.02) * s, CFrame.new(0.05 * s, 0.58 * s, 0.04 * s) * CFrame.Angles(0, 0, math.rad(7)), c, Enum.Material.Fabric)
			extra(model, h, Vector3.new(0.3, 0.35, 0.3) * s, CFrame.new(0.38 * s, 0.68 * s, 0.1 * s) * CFrame.Angles(0, 0, math.rad(-25)), c, Enum.Material.Fabric)
		elseif style == 2 then
			local capC = ({ Color3.fromRGB(180, 40, 40), Color3.fromRGB(40, 70, 150), Color3.fromRGB(60, 110, 60) })[r:NextInteger(1, 3)]
			extra(model, h, Vector3.new(1.06, 0.3, 1.06) * s, CFrame.new(0, 0.55 * s, 0) * CFrame.Angles(0, 0, math.rad(-6)), capC, Enum.Material.Fabric)
			extra(model, h, Vector3.new(0.9, 0.08, 0.5) * s, CFrame.new(0, 0.42 * s, -0.62 * s) * CFrame.Angles(math.rad(-8), 0, math.rad(-6)), capC, Enum.Material.Fabric)
		elseif style == 3 then
			-- Roblox "boy" hair: brown swoop
			local c = Color3.fromRGB(86, 58, 36)
			extra(model, h, Vector3.new(1.08, 0.34, 1.06) * s, CFrame.new(0, 0.52 * s, 0.02 * s), c, Enum.Material.Fabric)
			extra(model, h, Vector3.new(0.9, 0.2, 0.3) * s, CFrame.new(-0.1 * s, 0.4 * s, -0.5 * s) * CFrame.Angles(0, 0, math.rad(-12)), c, Enum.Material.Fabric)
		else
			extra(model, h, Vector3.new(0.5, 0.06, 0.4) * s, CFrame.new(-0.2 * s, 0.62 * s, -0.05 * s), Color3.fromRGB(150, 40, 40))
		end
	end

	------------------------------------------------------------------------------------------ the monster looks
	local LOOKS = {}

	function LOOKS.zombie(s, r, giant)
		local skin, shirt = Z_SKINS[r:NextInteger(1, #Z_SKINS)], Z_SHIRTS[r:NextInteger(1, #Z_SHIRTS)]
		local torn = r:NextInteger(0, 2)
		local model, P, J, rootH = Rigs.boy({ name = giant and "GiantZombie" or "Zombie", scale = s, skin = skin, shirt = shirt,
			pants = Z_PANTS[r:NextInteger(1, #Z_PANTS)], sleeveL = torn == 1 and skin or nil, sleeveR = torn == 2 and skin or nil,
			shoes = Color3.fromRGB(46, 38, 32), bulk = giant and 1.25 or 1, arm = giant and 1.15 or 1 })
		zFace(model, P.head, s, giant and Color3.fromRGB(255, 150, 30) or Color3.fromRGB(255, 50, 40), { stitch = r:NextNumber() < 0.4 })
		hairOrHat(model, P.head, s, r)
		tornClothes(model, P, s, shirt, skin, r)
		if giant then
			extra(model, P.chest, Vector3.new(2.6, 0.55, 1.35) * s, CFrame.new(0, 0.3 * s, 0), Color3.fromRGB(60, 45, 35), Enum.Material.Fabric)
			for _, x in ipairs({ -1, 1 }) do
				extra(model, P.chest, Vector3.new(0.3, 0.9, 0.3) * s, CFrame.new(x * 1.15 * s, 1.1 * s, 0) * CFrame.Angles(0, 0, math.rad(-25 * x)), Color3.fromRGB(230, 222, 200))
				extra(model, P["uArm" .. (x > 0 and "R" or "L")], Vector3.new(1.1, 0.5, 1.1) * s, CFrame.new(0, 0.35 * s, 0), Color3.fromRGB(80, 80, 88), Enum.Material.Metal)
			end
			extra(model, P.chest, Vector3.new(0.5, 0.5, 0.2) * s, CFrame.new(0, 0.1 * s, -0.62 * s) * CFrame.Angles(0, 0, math.rad(45)), Color3.fromRGB(80, 80, 88), Enum.Material.Metal)
		end
		return model, P, J, rootH
	end
	function LOOKS.giant(s, r) return LOOKS.zombie(s, r, true) end

	function LOOKS.frozen(s, r)
		local skin = Color3.fromRGB(150 + r:NextInteger(-10, 10), 190 + r:NextInteger(-10, 10), 220)
		local jacket = ({ Color3.fromRGB(36, 52, 92), Color3.fromRGB(70, 40, 40), Color3.fromRGB(50, 70, 60) })[r:NextInteger(1, 3)]
		local model, P, J, rootH = Rigs.boy({ name = "FrostbittenZombie", scale = s, skin = skin, shirt = jacket, pants = Color3.fromRGB(60, 64, 80),
			sleeveL = r:NextNumber() < 0.4 and skin or nil, shoes = Color3.fromRGB(80, 70, 60) })
		zFace(model, P.head, s, Color3.fromRGB(120, 230, 255), {})
		tornClothes(model, P, s, jacket, skin, r)
		local ice, frost = Color3.fromRGB(190, 235, 255), Color3.fromRGB(240, 250, 255)
		-- scarf + frost + icicles
		local scarf = ({ Color3.fromRGB(200, 40, 40), Color3.fromRGB(240, 240, 240), Color3.fromRGB(40, 120, 200) })[r:NextInteger(1, 3)]
		extra(model, P.chest, Vector3.new(1.4, 0.3, 1.15) * s, CFrame.new(0, 0.72 * s, 0), scarf, Enum.Material.Fabric)
		extra(model, P.chest, Vector3.new(0.3, 0.9, 0.12) * s, CFrame.new(0.3 * s, 0.25 * s, -0.6 * s) * CFrame.Angles(0, 0, math.rad(8)), scarf, Enum.Material.Fabric)
		for _, side in ipairs({ "L", "R" }) do
			extra(model, P["uArm" .. side], Vector3.new(1.06, 0.3, 1.06) * s, CFrame.new(0, 0.48 * s, 0), frost, Enum.Material.Snow)
			for i = -1, 1 do
				extra(model, P["lArm" .. side], Vector3.new(0.14, 0.5, 0.14) * s, CFrame.new(i * 0.3 * s, -0.4 * s, 0.35 * s) * CFrame.Angles(0, 0, math.rad(i * 8)), ice, Enum.Material.Ice)
			end
		end
		extra(model, P.head, Vector3.new(1.1, 0.22, 1.05) * s, CFrame.new(0, 0.6 * s, 0), frost, Enum.Material.Snow)
		for i = -1, 1 do
			extra(model, P.head, Vector3.new(0.1, 0.32, 0.1) * s, CFrame.new(i * 0.18 * s, -0.55 * s, -0.48 * s), ice, Enum.Material.Ice)
		end
		return model, P, J, rootH
	end

	function LOOKS.thrower(s, r)
		local skin = Color3.fromRGB(130, 170, 200)
		local coat = Color3.fromRGB(90, 110, 140)
		local model, P, J, rootH = Rigs.boy({ name = "IceThrower", scale = s, skin = skin, shirt = coat, pants = Color3.fromRGB(50, 56, 70),
			shoes = Color3.fromRGB(60, 50, 44), arm = 1.08 })
		zFace(model, P.head, s, Color3.fromRGB(150, 240, 255), { stitch = true })
		tornClothes(model, P, s, coat, skin, r)
		-- striped beanie with pompom
		local c1, c2 = Color3.fromRGB(220, 60, 60), Color3.fromRGB(245, 245, 245)
		extra(model, P.head, Vector3.new(1.1, 0.3, 1.1) * s, CFrame.new(0, 0.5 * s, 0), c1, Enum.Material.Fabric)
		extra(model, P.head, Vector3.new(1.0, 0.2, 1.0) * s, CFrame.new(0, 0.72 * s, 0), c2, Enum.Material.Fabric)
		extra(model, P.head, Vector3.new(0.4, 0.4, 0.4) * s, CFrame.new(0, 0.95 * s, 0), c2, Enum.Material.Fabric, Enum.PartType.Ball)
		-- ice chunk in hand + ice backpack
		local chunk = extra(model, P.handR, Vector3.new(1.1, 1.1, 1.1) * s, CFrame.new(0, -0.55 * s, 0) * CFrame.Angles(0.4, 0.6, 0.2),
			Color3.fromRGB(160, 225, 255), Enum.Material.Ice)
		chunk.Transparency = 0.15
		chunk.Name = "IceChunk"
		extra(model, P.chest, Vector3.new(1.4, 1.3, 0.6) * s, CFrame.new(0, 0, 0.8 * s), Color3.fromRGB(110, 80, 60), Enum.Material.Fabric)
		for i = -1, 1 do
			extra(model, P.chest, Vector3.new(0.5, 0.5, 0.5) * s, CFrame.new(i * 0.45 * s, 0.75 * s, 0.8 * s) * CFrame.Angles(i, 0.5, 0.3),
				Color3.fromRGB(170, 230, 255), Enum.Material.Ice)
		end
		return model, P, J, rootH
	end

	function LOOKS.yeti(s, r)
		local fur, face = Color3.fromRGB(226, 236, 246), Color3.fromRGB(90, 120, 170)
		local model, P, J, rootH = Rigs.boy({ name = "YetiZombie", scale = s, skin = face, shirt = fur, pants = fur, forearm = fur,
			hands = Color3.fromRGB(110, 140, 180), shoes = Color3.fromRGB(110, 140, 180), shins = fur, bulk = 1.3, arm = 1.3, limb = 1.15,
			cloth = Enum.Material.Snow })
		zFace(model, P.head, s, Color3.fromRGB(80, 200, 255), { socket = Color3.fromRGB(20, 30, 60) })
		local ice = Color3.fromRGB(200, 240, 255)
		-- fur mane, tufts, horns, fangs
		extra(model, P.head, Vector3.new(1.3, 0.5, 1.2) * s, CFrame.new(0, 0.45 * s, 0.1 * s), fur, Enum.Material.Snow)
		extra(model, P.chest, Vector3.new(2.9, 0.7, 1.6) * s, CFrame.new(0, 0.62 * s, 0), fur, Enum.Material.Snow)
		for _, x in ipairs({ -1, 1 }) do
			extra(model, P.head, Vector3.new(0.25, 0.8, 0.25) * s, CFrame.new(x * 0.62 * s, 0.75 * s, 0) * CFrame.Angles(0, 0, math.rad(-x * 28)), ice, Enum.Material.Ice)
			extra(model, P.head, Vector3.new(0.12, 0.3, 0.12) * s, CFrame.new(x * 0.2 * s, -0.45 * s, -0.55 * s), WHITE)
			extra(model, P["uArm" .. (x > 0 and "R" or "L")], Vector3.new(1.4, 0.7, 1.4) * s, CFrame.new(0, 0.3 * s, 0), fur, Enum.Material.Snow)
			for i = -1, 1 do
				extra(model, P["hand" .. (x > 0 and "R" or "L")], Vector3.new(0.18, 0.5, 0.18) * s, CFrame.new(i * 0.32 * s, -0.35 * s, -0.25 * s) * CFrame.Angles(math.rad(-20), 0, 0), ice, Enum.Material.Ice)
			end
		end
		extra(model, P.chest, Vector3.new(1.1, 0.9, 0.08) * s, CFrame.new(0, -0.2 * s, -0.86 * s), face)
		return model, P, J, rootH
	end

	function LOOKS.gas(s, r)
		local skin = Color3.fromRGB(150, 140, 96)
		local suit = Color3.fromRGB(70, 74, 80)
		local model, P, J, rootH = Rigs.boy({ name = "GasZombie", scale = s, skin = skin, shirt = suit, pants = suit, sleeveR = skin,
			shoes = Color3.fromRGB(40, 34, 30) })
		zFace(model, P.head, s, Color3.fromRGB(255, 170, 40), { stitch = r:NextNumber() < 0.5 })
		tornClothes(model, P, s, suit, skin, r)
		-- glossy gasoline stains
		for _ = 1, 4 do
			local p = extra(model, P.chest, Vector3.new(r:NextNumber(0.3, 0.6), r:NextNumber(0.3, 0.7), 0.06) * s,
				CFrame.new(r:NextNumber(-0.7, 0.7) * s, r:NextNumber(-0.5, 0.6) * s, -0.53 * s), Color3.fromRGB(30, 26, 20), Enum.Material.Glass)
			p.Reflectance = 0.25
		end
		extra(model, P.chest, Vector3.new(0.6, 0.25, 0.06) * s, CFrame.new(-0.5 * s, 0.45 * s, -0.53 * s), Color3.fromRGB(255, 150, 30), Enum.Material.Neon)
		-- red gas can in the left hand
		local can = extra(model, P.handL, Vector3.new(0.7, 1.1, 1.0) * s, CFrame.new(0, -0.75 * s, 0), Color3.fromRGB(200, 30, 30), Enum.Material.Metal)
		can.Name = "GasCan"
		extra(model, can, Vector3.new(0.12, 0.12, 0.6) * s, CFrame.new(0, 0.6 * s, 0), Color3.fromRGB(40, 40, 40), Enum.Material.Metal)
		extra(model, can, Vector3.new(0.12, 0.5, 0.12) * s, CFrame.new(0, 0.6 * s, -0.45 * s) * CFrame.Angles(math.rad(-30), 0, 0), Color3.fromRGB(240, 200, 40), Enum.Material.Metal)
		local drip = make("ParticleEmitter", { Rate = 3, Lifetime = NumberRange.new(0.5, 0.8), Speed = NumberRange.new(0, 0.5), Size = NumberSequence.new(0.12, 0.05),
			Acceleration = Vector3.new(0, -30, 0), Color = ColorSequence.new(Color3.fromRGB(40, 32, 18)), Parent = P.chest })
		drip.Name = "Drip"
		return model, P, J, rootH
	end

	function LOOKS.toxic(s, r)
		local skin = Color3.fromRGB(96, 170, 70)
		local suit = Color3.fromRGB(220, 190, 40)
		local model, P, J, rootH = Rigs.boy({ name = "ToxicZombie", scale = s, skin = skin, shirt = suit, pants = suit, sleeveL = skin,
			shoes = Color3.fromRGB(30, 30, 30), hands = Color3.fromRGB(30, 30, 30) })
		local glow = Color3.fromRGB(140, 255, 60)
		zFace(model, P.head, s, glow, {})
		tornClothes(model, P, s, suit, skin, r)
		for _ = 1, 4 do -- glowing toxic boils
			local bp = ({ P.head, P.chest, P.uArmL, P.lArmL })[r:NextInteger(1, 4)]
			extra(model, bp, Vector3.new(0.28, 0.28, 0.28) * s, CFrame.new(r:NextNumber(-0.4, 0.4) * s, r:NextNumber(-0.3, 0.3) * s, -0.5 * s), glow, Enum.Material.Neon, Enum.PartType.Ball)
		end
		-- gas mask on the neck + toxic barrel on the back
		extra(model, P.chest, Vector3.new(0.8, 0.5, 0.4) * s, CFrame.new(0, 0.55 * s, -0.6 * s), Color3.fromRGB(40, 40, 40))
		extra(model, P.chest, Vector3.new(0.3, 0.3, 0.3) * s, CFrame.new(0, 0.5 * s, -0.85 * s), Color3.fromRGB(90, 90, 90), Enum.Material.Metal, Enum.PartType.Ball)
		local barrel = extra(model, P.chest, Vector3.new(1.5, 1.1, 1.1) * s, CFrame.new(0, 0.1 * s, 0.95 * s) * CFrame.Angles(0, 0, math.pi / 2),
			Color3.fromRGB(60, 70, 50), Enum.Material.Metal, Enum.PartType.Cylinder)
		extra(model, barrel, Vector3.new(0.3, 1.14, 1.14) * s, CFrame.new(0, 0, 0), glow, Enum.Material.Neon, Enum.PartType.Cylinder)
		make("PointLight", { Range = 10, Brightness = 1.2, Color = glow, Shadows = false, Parent = barrel })
		make("ParticleEmitter", { Name = "Bubbles", Rate = 6, Lifetime = NumberRange.new(0.6, 1.2), Speed = NumberRange.new(1, 2.5), SpreadAngle = Vector2.new(25, 25),
			Size = NumberSequence.new(0.22, 0), Color = ColorSequence.new(glow), LightEmission = 0.7, Parent = barrel })
		return model, P, J, rootH
	end

	function LOOKS.gravekeeper(s, r)
		local skin = Color3.fromRGB(196, 190, 176)
		local coat = Color3.fromRGB(34, 26, 44)
		local model, P, J, rootH = Rigs.boy({ name = "TheGravekeeper", scale = s, skin = skin, shirt = coat, pants = Color3.fromRGB(26, 22, 30),
			forearm = coat, hands = skin, shoes = Color3.fromRGB(20, 18, 22), bulk = 1.1, arm = 1.15 })
		local eye = Color3.fromRGB(190, 90, 255)
		zFace(model, P.head, s, eye, { socket = Color3.fromRGB(10, 8, 12) })
		extra(model, P.head, Vector3.new(0.18, 0.22, 0.05) * s, CFrame.new(0, -0.02 * s, -0.63 * s), Color3.fromRGB(20, 16, 20))
		-- tall top hat with a purple band
		extra(model, P.head, Vector3.new(1.5, 0.12, 1.5) * s, CFrame.new(0, 0.62 * s, 0), Color3.fromRGB(18, 16, 22))
		extra(model, P.head, Vector3.new(1.0, 1.3, 1.0) * s, CFrame.new(0, 1.3 * s, 0), Color3.fromRGB(18, 16, 22))
		extra(model, P.head, Vector3.new(1.04, 0.22, 1.04) * s, CFrame.new(0, 0.82 * s, 0), Color3.fromRGB(120, 50, 170), Enum.Material.Neon)
		-- coat tails + collar
		for _, x in ipairs({ -0.5, 0.5 }) do
			extra(model, P.pelvis, Vector3.new(0.95, 2.2, 0.12) * s, CFrame.new(x * s, -1.0 * s, 0.52 * s) * CFrame.Angles(math.rad(8), 0, 0), coat, Enum.Material.Fabric)
		end
		extra(model, P.chest, Vector3.new(2.3, 0.6, 1.3) * s, CFrame.new(0, 0.75 * s, 0.05 * s), coat, Enum.Material.Fabric)
		-- lantern (left) with ghost fire
		local lan = extra(model, P.handL, Vector3.new(0.8, 1.0, 0.8) * s, CFrame.new(0, -0.9 * s, 0), Color3.fromRGB(150, 255, 170), Enum.Material.Neon)
		lan.Transparency = 0.2
		extra(model, lan, Vector3.new(0.95, 0.15, 0.95) * s, CFrame.new(0, 0.55 * s, 0), Color3.fromRGB(30, 30, 30), Enum.Material.Metal)
		extra(model, lan, Vector3.new(0.95, 0.15, 0.95) * s, CFrame.new(0, -0.55 * s, 0), Color3.fromRGB(30, 30, 30), Enum.Material.Metal)
		make("PointLight", { Range = 22, Brightness = 2.5, Color = Color3.fromRGB(140, 255, 160), Parent = lan })
		make("Fire", { Size = 3, Heat = 4, Color = Color3.fromRGB(120, 255, 150), SecondaryColor = Color3.fromRGB(40, 140, 80), Parent = lan })
		-- giant shovel (right)
		local shaft = extra(model, P.handR, Vector3.new(0.25, 5.5, 0.25) * s, CFrame.new(0, -0.2 * s, -1.0 * s) * CFrame.Angles(math.rad(-90), 0, 0),
			Color3.fromRGB(90, 64, 40), Enum.Material.Wood)
		extra(model, shaft, Vector3.new(1.6, 1.8, 0.12) * s, CFrame.new(0, 3.4 * s, 0), Color3.fromRGB(90, 90, 96), Enum.Material.CorrodedMetal)
		return model, P, J, rootH
	end

	function LOOKS.titan(s, r)
		local skin = Color3.fromRGB(150, 205, 240)
		local armor = Color3.fromRGB(190, 235, 255)
		local model, P, J, rootH = Rigs.boy({ name = "FrostTitan", scale = s, skin = skin, shirt = Color3.fromRGB(70, 110, 160),
			pants = Color3.fromRGB(60, 90, 140), shoes = armor, bulk = 1.3, arm = 1.2, limb = 1.1, skinMat = Enum.Material.Glacier })
		zFace(model, P.head, s, Color3.fromRGB(80, 230, 255), { socket = Color3.fromRGB(20, 40, 70) })
		for i = -2, 2 do -- crown
			extra(model, P.head, Vector3.new(0.22, 0.7 - math.abs(i) * 0.12, 0.22) * s, CFrame.new(i * 0.3 * s, 0.85 * s, 0) * CFrame.Angles(0, 0, math.rad(-i * 10)),
				Color3.fromRGB(200, 245, 255), Enum.Material.Neon)
		end
		extra(model, P.chest, Vector3.new(2.7, 1.4, 1.4) * s, CFrame.new(0, 0.1 * s, 0), armor, Enum.Material.Ice)
		for _, x in ipairs({ -1, 1 }) do
			local sh = extra(model, P["uArm" .. (x > 0 and "R" or "L")], Vector3.new(1.5, 0.8, 1.5) * s, CFrame.new(0, 0.4 * s, 0), armor, Enum.Material.Ice)
			for k = 0, 1 do
				extra(model, sh, Vector3.new(0.25, 0.9, 0.25) * s, CFrame.new((k - 0.5) * 0.6 * s, 0.6 * s, 0) * CFrame.Angles(0, 0, math.rad(-x * 18)), Color3.fromRGB(220, 250, 255), Enum.Material.Ice)
			end
		end
		local club = extra(model, P.handR, Vector3.new(0.5, 4.8, 0.5) * s, CFrame.new(0, -0.2 * s, -1.6 * s) * CFrame.Angles(math.rad(-90), 0, 0),
			Color3.fromRGB(120, 180, 220), Enum.Material.Ice)
		extra(model, club, Vector3.new(1.6, 1.8, 1.6) * s, CFrame.new(0, 2.6 * s, 0) * CFrame.Angles(0.5, 0.5, 0), Color3.fromRGB(200, 245, 255), Enum.Material.Ice)
		make("PointLight", { Range = 20, Brightness = 2, Color = Color3.fromRGB(120, 220, 255), Parent = P.chest })
		make("ParticleEmitter", { Rate = 12, Lifetime = NumberRange.new(1, 2), Speed = NumberRange.new(0.5, 2), SpreadAngle = Vector2.new(180, 180),
			Size = NumberSequence.new(0.3, 0), Color = ColorSequence.new(Color3.fromRGB(220, 250, 255)), LightEmission = 0.6, Parent = P.chest })
		return model, P, J, rootH
	end

	function LOOKS.monkey(s, r, king)
		local fur = king and Color3.fromRGB(70, 54, 40) or ({ Color3.fromRGB(110, 78, 52), Color3.fromRGB(96, 70, 48), Color3.fromRGB(120, 92, 62) })[r:NextInteger(1, 3)]
		local face = Color3.fromRGB(150, 160, 120)
		local model, P, J, rootH = Rigs.boy({ name = king and "KingKongo" or "MonkeyZombie", scale = s, skin = face, shirt = fur, pants = fur,
			forearm = fur, hands = Color3.fromRGB(70, 60, 50), shoes = Color3.fromRGB(70, 60, 50), shins = fur, arm = 1.45, leg = 0.8,
			bulk = king and 1.25 or 0.95, cloth = Enum.Material.Fabric })
		local eye = king and Color3.fromRGB(150, 255, 60) or Color3.fromRGB(255, 50, 40)
		zFace(model, P.head, s, eye, { noMouth = true })
		-- muzzle, ears, brow, teeth
		local muzzle = extra(model, P.head, Vector3.new(1.0, 0.55, 0.5) * s, CFrame.new(0, -0.25 * s, -0.7 * s), face)
		extra(model, muzzle, Vector3.new(0.7, 0.12, 0.06) * s, CFrame.new(0, -0.1 * s, -0.27 * s), Color3.fromRGB(40, 10, 10))
		for i = -1, 1, 2 do
			extra(model, muzzle, Vector3.new(0.1, 0.18, 0.06) * s, CFrame.new(i * 0.22 * s, -0.04 * s, -0.28 * s), WHITE)
			extra(model, P.head, Vector3.new(0.2, 0.55, 0.55) * s, CFrame.new(i * 0.75 * s, 0.05 * s, 0), face, nil, Enum.PartType.Cylinder)
		end
		extra(model, P.head, Vector3.new(1.3, 0.18, 0.3) * s, CFrame.new(0, 0.3 * s, -0.55 * s), fur:Lerp(BLACK, 0.3))
		extra(model, P.head, Vector3.new(1.1, 0.35, 1.05) * s, CFrame.new(0, 0.55 * s, 0.05 * s), fur, Enum.Material.Fabric)
		-- zombie bits: exposed ribs + rotten patches
		for i = 0, 2 do
			extra(model, P.chest, Vector3.new(0.7, 0.07, 0.06) * s, CFrame.new(0.4 * s, (0.1 - i * 0.18) * s, -0.53 * s), Color3.fromRGB(225, 215, 190))
		end
		extra(model, P.chest, Vector3.new(0.6, 0.5, 0.05) * s, CFrame.new(-0.45 * s, -0.3 * s, -0.52 * s), Color3.fromRGB(110, 140, 90))
		-- tail
		local t1 = make("Part", { Name = "Tail1", Size = Vector3.new(0.25, 0.25, 1.3) * s, Color = fur, Material = Enum.Material.Fabric, Anchored = false,
			CanCollide = false, CanQuery = false, CanTouch = false, Massless = true, CastShadow = false, Parent = model })
		local t2 = make("Part", { Name = "Tail2", Size = Vector3.new(0.22, 0.22, 1.2) * s, Color = fur, Material = Enum.Material.Fabric, Anchored = false,
			CanCollide = false, CanQuery = false, CanTouch = false, Massless = true, CastShadow = false, Parent = model })
		t1.CFrame = P.pelvis.CFrame * CFrame.new(0, 0, 0.5 * s) * CFrame.new(0, 0, 0.65 * s)
		J.Tail1 = { m = make("Motor6D", { Name = "Tail1", Part0 = P.pelvis, Part1 = t1, C0 = CFrame.new(0, 0, 0.5 * s), C1 = CFrame.new(0, 0, -0.65 * s), Parent = P.pelvis }) }
		t2.CFrame = t1.CFrame * CFrame.new(0, 0, 0.65 * s) * CFrame.new(0, 0, 0.6 * s)
		J.Tail2 = { m = make("Motor6D", { Name = "Tail2", Part0 = t1, Part1 = t2, C0 = CFrame.new(0, 0, 0.65 * s), C1 = CFrame.new(0, 0, -0.6 * s), Parent = t1 }) }
		if king then
			for i = -2, 2 do -- golden crown
				extra(model, P.head, Vector3.new(0.25, 0.45, 0.25) * s, CFrame.new(i * 0.25 * s, 0.85 * s, 0), GOLD, Enum.Material.Metal)
			end
			extra(model, P.head, Vector3.new(1.3, 0.2, 1.1) * s, CFrame.new(0, 0.68 * s, 0), GOLD, Enum.Material.Metal)
			extra(model, P.head, Vector3.new(0.22, 0.22, 0.1) * s, CFrame.new(0, 0.82 * s, -0.56 * s), Color3.fromRGB(255, 40, 40), Enum.Material.Neon)
			local glow = Color3.fromRGB(140, 255, 60)
			local wound = extra(model, P.chest, Vector3.new(0.9, 0.8, 0.08) * s, CFrame.new(0, 0.1 * s, -0.56 * s), glow, Enum.Material.Neon)
			make("PointLight", { Range = 22, Brightness = 2, Color = glow, Parent = wound })
			make("ParticleEmitter", { Rate = 10, Lifetime = NumberRange.new(0.8, 1.4), Speed = NumberRange.new(1, 3), SpreadAngle = Vector2.new(30, 30),
				Size = NumberSequence.new(0.35, 0), Color = ColorSequence.new(glow), LightEmission = 0.7, Parent = wound })
			for i = -1, 1 do -- gas cans on the belt
				extra(model, P.pelvis, Vector3.new(0.5, 0.7, 0.35) * s, CFrame.new(i * 0.75 * s, -0.2 * s, -0.65 * s), Color3.fromRGB(200, 30, 30), Enum.Material.Metal)
			end
		end
		return model, P, J, rootH
	end
	function LOOKS.kongo(s, r) return LOOKS.monkey(s, r, true) end

	------------------------------------------------------------------------------------------ zombie dog (4 legs)
	function LOOKS.dog(s, r)
		local fur = ({ Color3.fromRGB(96, 100, 86), Color3.fromRGB(110, 98, 84), Color3.fromRGB(84, 88, 80), Color3.fromRGB(120, 112, 100) })[r:NextInteger(1, 4)]
		local dark = fur:Lerp(BLACK, 0.35)
		local model = make("Model", { Name = "ZombieDog" })
		local root = part({ Name = "HumanoidRootPart", Size = Vector3.new(1.6, 1.6, 3.2) * s, Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false,
			CastShadow = false, Parent = model })
		local P, J = { root = root }, {}
		local function bp(name, size, color, mat)
			return part({ Name = name, Size = size * s, Color = color, Material = mat or Enum.Material.Fabric, Anchored = false,
				CanCollide = false, CanQuery = false, CanTouch = false, Massless = true, Parent = model })
		end
		local function jt(name, p0, p1, a, b) J[name] = { m = motor(name, p0, p1, a, b) } end
		local function v(x, y, z) return CFrame.new(x * s, y * s, z * s) end
		P.chest = bp("Chest", Vector3.new(1.5, 1.4, 1.6), fur)
		jt("Spine1", root, P.chest, v(0, 0.1, -0.75), CFrame.new())
		P.hips = bp("Hips", Vector3.new(1.35, 1.25, 1.5), fur)
		jt("Spine2", root, P.hips, v(0, -0.1, 0.75), CFrame.new())
		P.head = bp("Head", Vector3.new(1.05, 0.95, 1.05), fur)
		jt("Neck", P.chest, P.head, v(0, 0.55, -0.75), v(0, -0.1, 0.45))
		P.jaw = bp("Jaw", Vector3.new(0.6, 0.2, 0.75), Color3.fromRGB(90, 30, 30), Enum.Material.SmoothPlastic)
		jt("Jaw", P.head, P.jaw, v(0, -0.42, -0.35), v(0, 0, 0.35))
		for _, L in ipairs({ { "FL", -1, true }, { "FR", 1, true }, { "HL", -1, false }, { "HR", 1, false } }) do
			local id, sx, front = L[1], L[2], L[3]
			local upper = bp("Upper" .. id, front and Vector3.new(0.42, 0.95, 0.5) or Vector3.new(0.5, 1, 0.65), fur)
			if front then
				jt("Leg" .. id, P.chest, upper, v(0.5 * sx, -0.45, -0.25), v(0, 0.45, 0))
			else
				jt("Leg" .. id, P.hips, upper, v(0.45 * sx, -0.3, 0.2), v(0, 0.45, 0))
			end
			local lower = bp("Lower" .. id, Vector3.new(0.36, 0.95, 0.42), fur)
			jt("Knee" .. id, upper, lower, v(0, -0.45, 0), v(0, 0.45, 0))
			extra(model, lower, Vector3.new(0.45, 0.22, 0.6) * s, v(0, -0.5, -0.1), dark)
		end
		P.tail1 = bp("Tail1", Vector3.new(0.25, 0.25, 0.8), fur)
		jt("Tail1", P.hips, P.tail1, v(0, 0.4, 0.75), v(0, 0, -0.4))
		P.tail2 = bp("Tail2", Vector3.new(0.2, 0.2, 0.7), dark)
		jt("Tail2", P.tail1, P.tail2, v(0, 0, 0.4), v(0, 0, -0.35))
		local hd = P.head
		extra(model, hd, Vector3.new(0.7, 0.55, 0.8) * s, v(0, -0.15, -0.8), fur)
		extra(model, hd, Vector3.new(0.3, 0.22, 0.15) * s, v(0, 0.08, -1.22), Color3.fromRGB(20, 20, 20))
		for _, x in ipairs({ -1, 1 }) do
			extra(model, hd, Vector3.new(0.18, 0.14, 0.06) * s, v(0.28 * x, 0.16, -0.53), Color3.fromRGB(255, 40, 40), Enum.Material.Neon)
			extra(model, hd, Vector3.new(0.16, 0.55, 0.36) * s, v(0.32 * x, 0.62, 0.15) * CFrame.Angles(math.rad(-15), 0, math.rad(-18 * x)), dark, nil, nil, "WedgePart")
			extra(model, hd, Vector3.new(0.09, 0.24, 0.09) * s, v(0.2 * x, -0.48, -1.08), Color3.fromRGB(240, 235, 215))
			extra(model, P.jaw, Vector3.new(0.08, 0.16, 0.08) * s, v(0.18 * x, 0.15, -0.28), Color3.fromRGB(240, 235, 215))
		end
		for i = -1, 1 do
			for _, x in ipairs({ -0.76, 0.76 }) do
				extra(model, P.chest, Vector3.new(0.08, 0.9, 0.16) * s, v(x, -0.05, i * 0.45), Color3.fromRGB(230, 222, 200))
			end
		end
		extra(model, P.chest, Vector3.new(1.52, 0.55, 1.0) * s, v(0, -0.2, 0), Color3.fromRGB(110, 25, 25))
		for i = 0, 3 do
			extra(model, P.chest, Vector3.new(0.24, 0.24, 0.24) * s, v(0, 0.72, -0.6 + i * 0.4) * CFrame.Angles(math.rad(45), 0, 0), Color3.fromRGB(220, 210, 190))
		end
		extra(model, P.chest, Vector3.new(1.25, 0.25, 0.4) * s, v(0, 0.45, -0.78) * CFrame.Angles(math.rad(-30), 0, 0), Color3.fromRGB(255, 120, 20))
		extra(model, P.chest, Vector3.new(0.2, 0.25, 0.06) * s, v(0, 0.25, -0.98), GOLD, Enum.Material.Metal)
		model.PrimaryPart = root
		return model, P, J, 2.3 * s
	end

	------------------------------------------------------------------------------------------ YOUR avatar, as a zombie
	local BODY = { Head = true, UpperTorso = true, LowerTorso = true, Torso = true, LeftUpperArm = true, LeftLowerArm = true, LeftHand = true,
		RightUpperArm = true, RightLowerArm = true, RightHand = true, LeftUpperLeg = true, LeftLowerLeg = true, LeftFoot = true,
		RightUpperLeg = true, RightLowerLeg = true, RightFoot = true, ["Left Arm"] = true, ["Right Arm"] = true, ["Left Leg"] = true, ["Right Leg"] = true }
	Rigs.BODY = BODY
	local ZGREEN = Color3.fromRGB(110, 150, 86)

	-- turns any character model into a zombie (returns a function that undoes it)
	function Rigs.zombify(char)
		local saved = {}
		local made = {}
		for _, d in ipairs(char:GetDescendants()) do
			if d:IsA("BasePart") and BODY[d.Name] then
				saved[d] = d.Color
				d.Color = d.Color:Lerp(ZGREEN, 0.78)
			elseif d:IsA("Decal") and d.Name == "face" then
				saved[d] = d.Transparency
				d.Transparency = 1
			end
		end
		local head = char:FindFirstChild("Head")
		if head then
			local s = head.Size.Y
			for _, x in ipairs({ -0.22, 0.22 }) do
				local e = make("Part", { Name = "FH_ZEye", Size = Vector3.new(0.2, 0.16, 0.05) * s, Material = Enum.Material.Neon, Color = Color3.fromRGB(255, 40, 30),
					CanCollide = false, CanQuery = false, CanTouch = false, Massless = true, CastShadow = false,
					CFrame = head.CFrame * CFrame.new(x * s, 0.12 * s, -0.6 * s), Parent = char })
				weld(head, e)
				table.insert(made, e)
			end
			local mouth = make("Part", { Name = "FH_ZMouth", Size = Vector3.new(0.55, 0.16, 0.05) * s, Color = Color3.fromRGB(40, 10, 10),
				CanCollide = false, CanQuery = false, CanTouch = false, Massless = true, CastShadow = false,
				CFrame = head.CFrame * CFrame.new(0, -0.24 * s, -0.6 * s), Parent = char })
			weld(head, mouth)
			table.insert(made, mouth)
		end
		return function()
			for inst, v in pairs(saved) do
				if inst.Parent then
					if inst:IsA("BasePart") then inst.Color = v else inst.Transparency = v end
				end
			end
			for _, p in ipairs(made) do p:Destroy() end
		end
	end

	-- joint wrapper that converts "rotate relative to the parent part" into Motor6D.Transform for ANY rig
	local function wrapJoint(j)
		if not j then return nil end
		local c0, c1
		if j:IsA("Motor6D") then
			c0, c1 = j.C0, j.C1
		elseif j:IsA("AnimationConstraint") then
			c0 = j.Attachment0 and j.Attachment0.CFrame or CFrame.new()
			c1 = j.Attachment1 and j.Attachment1.CFrame or CFrame.new()
		else
			return nil
		end
		return { m = j, a = c0.Rotation:Inverse(), b = c1.Rotation }
	end
	Rigs.wrapJoint = wrapJoint

	local function findJoint(char, name, part1)
		if not part1 then return nil end
		local j = part1:FindFirstChild(name)
		if j and (j:IsA("Motor6D") or j:IsA("AnimationConstraint")) then return j end
		for _, d in ipairs(char:GetDescendants()) do
			if d:IsA("Motor6D") and d.Part1 == part1 then return d end
		end
		for _, d in ipairs(char:GetDescendants()) do
			if d:IsA("AnimationConstraint") then
				local a1 = d.Attachment1
				if a1 and a1.Parent == part1 then return d end
			end
		end
		return nil
	end
	Rigs.findJoint = findJoint

	-- every joint of a real Roblox character (R15 or R6), wrapped
	function Rigs.charJoints(char)
		local J = {}
		local hum = char:FindFirstChildOfClass("Humanoid")
		local r15 = hum and hum.RigType == Enum.HumanoidRigType.R15
		if r15 then
			local map = {
				Root = { "Root", "LowerTorso" }, Waist = { "Waist", "UpperTorso" }, Neck = { "Neck", "Head" },
				ShoulderR = { "RightShoulder", "RightUpperArm" }, ElbowR = { "RightElbow", "RightLowerArm" }, WristR = { "RightWrist", "RightHand" },
				ShoulderL = { "LeftShoulder", "LeftUpperArm" }, ElbowL = { "LeftElbow", "LeftLowerArm" }, WristL = { "LeftWrist", "LeftHand" },
				HipR = { "RightHip", "RightUpperLeg" }, KneeR = { "RightKnee", "RightLowerLeg" }, AnkleR = { "RightAnkle", "RightFoot" },
				HipL = { "LeftHip", "LeftUpperLeg" }, KneeL = { "LeftKnee", "LeftLowerLeg" }, AnkleL = { "LeftAnkle", "LeftFoot" },
			}
			for k, v in pairs(map) do J[k] = wrapJoint(findJoint(char, v[1], char:FindFirstChild(v[2]))) end
		else
			local torso = char:FindFirstChild("Torso")
			local hrp = char:FindFirstChild("HumanoidRootPart")
			local function t6(nm, p1)
				local j = (torso and torso:FindFirstChild(nm)) or findJoint(char, nm, char:FindFirstChild(p1))
				return wrapJoint(j)
			end
			J.ShoulderR = t6("Right Shoulder", "Right Arm")
			J.ShoulderL = t6("Left Shoulder", "Left Arm")
			J.HipR = t6("Right Hip", "Right Leg")
			J.HipL = t6("Left Hip", "Left Leg")
			J.Neck = t6("Neck", "Head")
			J.Root = wrapJoint((hrp and hrp:FindFirstChild("RootJoint")) or findJoint(char, "RootJoint", torso))
		end
		return J, r15
	end

	-- a frozen copy of a player's avatar, zombified, used as a monster
	function Rigs.avatar(userId, s)
		local plr = Players:GetPlayerByUserId(userId)
		local char = plr and plr.Character
		if not char or not char:FindFirstChild("HumanoidRootPart") then return nil end
		local okArch = pcall(function() char.Archivable = true end)
		if not okArch then return nil end
		local ok, clone = pcall(function() return char:Clone() end)
		if not ok or not clone then return nil end
		for _, d in ipairs(clone:GetDescendants()) do
			if d:IsA("BaseScript") or d:IsA("Sound") or d:IsA("ForceField") or d:IsA("BillboardGui") or d:IsA("Tool")
				or d:IsA("ProximityPrompt") or d:IsA("Animator") or d:IsA("ParticleEmitter") or d:IsA("Fire")
				or (d:IsA("Model") and d.Name == "FH_Sword") then
				d:Destroy()
			elseif d:IsA("BasePart") then
				d.Anchored = false
				d.CanCollide, d.CanQuery, d.CanTouch, d.Massless = false, false, false, true
			end
		end
		for _, d in ipairs(clone:GetChildren()) do
			if d.Name == "FH_ZEye" or d.Name == "FH_ZMouth" then d:Destroy() end
		end
		local hum = clone:FindFirstChildOfClass("Humanoid")
		if hum then
			pcall(function()
				hum.EvaluateStateMachine = false
				hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
				hum.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
				hum.BreakJointsOnDeath = false
				hum.RequiresNeck = false
			end)
		end
		local root = clone:FindFirstChild("HumanoidRootPart")
		root.Anchored = true
		clone.PrimaryPart = root
		clone.Name = (plr and plr.DisplayName or "Player") .. "'s Zombie"
		Rigs.zombify(clone)
		local J, r15 = Rigs.charJoints(clone)
		for k, j in pairs(J) do
			if j then j.m.Transform = CFrame.new() else J[k] = nil end
		end
		local rootH = 3
		if hum and r15 then rootH = hum.HipHeight + root.Size.Y / 2 end
		local P = { root = root, head = clone:FindFirstChild("Head"), chest = clone:FindFirstChild("UpperTorso") or clone:FindFirstChild("Torso") }
		P.handR = clone:FindFirstChild("RightHand") or clone:FindFirstChild("Right Arm")
		return clone, P, J, rootH, r15
	end

	function Rigs.build(kind, id)
		local def = MOBS[kind]
		local r = Random.new(id * 7919 + 17)
		local s = def.scale * (def.boss and 1 or r:NextNumber(0.93, 1.07))
		local fn = LOOKS[def.look] or LOOKS.zombie
		local model, P, J, rootH = fn(s, r)
		return model, P, J, rootH, s, r
	end
	Rigs.LOOKS = LOOKS
end

------------------------------------------------------------------------------------------------
-- SWORD MODELS  (Handle = grip centre, blade points along +Y)
------------------------------------------------------------------------------------------------
local function buildSword(def, extraLen, sharp)
	local model = make("Model", { Name = "FH_Sword" })
	local handle = make("Part", { Name = "Handle", Size = Vector3.new(0.2, 0.2, 0.2), Transparency = 1, Anchored = false, CanCollide = false,
		CanQuery = false, CanTouch = false, Massless = true, CFrame = CFrame.new(), Parent = model })
	local function sp(size, cf, color, mat, shape, cls)
		local props = { Size = size, CFrame = cf, Color = color, Material = mat or Enum.Material.Metal, Anchored = false, CanCollide = false,
			CanQuery = false, CanTouch = false, Massless = true, CastShadow = false, Parent = model }
		if shape then props.Shape = shape end
		local p = part(props, cls)
		weld(handle, p)
		return p
	end
	local sr = Random.new(#def.id * 977 + 5)
	local CYL, BALL = Enum.PartType.Cylinder, Enum.PartType.Ball
	local upright = CFrame.Angles(0, 0, math.pi / 2)
	local Lg, r = def.grip, 0.15
	local W, T = def.width, def.thick
	local BL = def.len + (extraLen or 0)
	local TL = math.min(W * 1.25, BL * 0.3)
	local BB = BL - TL
	local gh = 0.24
	local yG = Lg / 2 + gh / 2
	local y0 = Lg / 2 + gh
	local edgeMat = (def.edgeNeon or sharp) and Enum.Material.Neon or Enum.Material.Metal

	sp(Vector3.new(Lg, r * 2, r * 2), upright, def.gripC, Enum.Material.Fabric, CYL)
	local n = math.max(3, math.floor(Lg / 0.22))
	for i = 1, n do
		sp(Vector3.new(0.06, r * 2 + 0.05, r * 2 + 0.05), CFrame.new(0, -Lg / 2 + (i - 0.5) * Lg / n, 0) * upright, def.wrapC, Enum.Material.Fabric, CYL)
	end
	sp(Vector3.new(0.12, r * 2 + 0.12, r * 2 + 0.12), CFrame.new(0, -Lg / 2 - 0.02, 0) * upright, def.guardC, Enum.Material.Metal, CYL)
	sp(Vector3.new(0.42, 0.42, 0.42), CFrame.new(0, -Lg / 2 - 0.24, 0), def.guardC, Enum.Material.Metal, BALL)
	if def.gem then
		sp(Vector3.new(0.16, 0.16, 0.08), CFrame.new(0, -Lg / 2 - 0.24, -0.18) * CFrame.Angles(0, 0, math.rad(45)), def.gem, Enum.Material.Neon)
	end

	local style = def.guard
	if style == "bar" or style == "quillons" or style == "crystal" then
		local gw = style == "quillons" and 1.7 or 1.45
		sp(Vector3.new(gw, gh, 0.34), CFrame.new(0, yG, 0), def.guardC)
		for _, sx in ipairs({ -1, 1 }) do
			if style == "quillons" then
				sp(Vector3.new(0.75, 0.16, 0.24), CFrame.new(sx * (gw / 2 + 0.25), yG - 0.12, 0) * CFrame.Angles(0, 0, math.rad(-22 * sx)), def.guardC)
				sp(Vector3.new(0.26, 0.26, 0.26), CFrame.new(sx * (gw / 2 + 0.6), yG - 0.27, 0), def.guardC, nil, BALL)
			else
				sp(Vector3.new(0.3, 0.3, 0.3), CFrame.new(sx * gw / 2, yG, 0), def.guardC, nil, BALL)
			end
			if style == "crystal" then
				for k = 0, 1 do
					sp(Vector3.new(0.14, 0.55 - k * 0.15, 0.14), CFrame.new(sx * (0.35 + k * 0.32), yG + 0.3, 0) * CFrame.Angles(0, 0, math.rad(-sx * (20 + k * 18))),
						Color3.fromRGB(190, 240, 255), Enum.Material.Ice)
				end
			end
		end
	elseif style == "dragon" then
		sp(Vector3.new(0.7, gh + 0.06, 0.38), CFrame.new(0, yG, 0), def.guardC)
		for _, sx in ipairs({ -1, 1 }) do
			sp(Vector3.new(0.7, 0.14, 0.2), CFrame.new(sx * 0.55, yG + 0.1, 0) * CFrame.Angles(0, 0, math.rad(sx * 18)), def.guardC)
			sp(Vector3.new(0.55, 0.12, 0.16), CFrame.new(sx * 0.92, yG + 0.36, 0) * CFrame.Angles(0, 0, math.rad(sx * 55)), def.guardC)
			sp(Vector3.new(0.5, 0.06, 0.22), CFrame.new(sx * 0.62, yG + 0.24, 0) * CFrame.Angles(0, 0, math.rad(sx * 35)), Color3.fromRGB(255, 110, 30), Enum.Material.Neon)
			sp(Vector3.new(0.1, 0.32, 0.1), CFrame.new(sx * 1.08, yG + 0.62, 0) * CFrame.Angles(0, 0, math.rad(-sx * 15)), Color3.fromRGB(30, 22, 22))
		end
	elseif style == "pumpkin" then
		-- a carved, glowing jack-o'-lantern as the guard, with leaves and curly vines
		local pk = sp(Vector3.new(0.95, 0.95, 0.95), CFrame.new(0, yG + 0.1, 0), def.guardC, Enum.Material.SmoothPlastic, BALL)
		for k = 0, 3 do
			sp(Vector3.new(0.16, 0.9, 0.98), CFrame.new(0, yG + 0.1, 0) * CFrame.Angles(0, math.rad(k * 45), 0), Color3.fromRGB(230, 100, 10), Enum.Material.SmoothPlastic)
		end
		for _, sz in ipairs({ -1, 1 }) do
			for _, sx in ipairs({ -1, 1 }) do
				sp(Vector3.new(0.16, 0.14, 0.05), CFrame.new(sx * 0.18, yG + 0.22, sz * 0.47) * CFrame.Angles(0, 0, math.rad(sx * 20)), Color3.fromRGB(255, 230, 80), Enum.Material.Neon)
			end
			sp(Vector3.new(0.42, 0.1, 0.05), CFrame.new(0, yG - 0.06, sz * 0.47), Color3.fromRGB(255, 230, 80), Enum.Material.Neon)
		end
		for _, sx in ipairs({ -1, 1 }) do
			sp(Vector3.new(0.7, 0.08, 0.3), CFrame.new(sx * 0.62, yG + 0.3, 0) * CFrame.Angles(0, 0, math.rad(sx * 28)), Color3.fromRGB(60, 140, 50), Enum.Material.Grass)
			sp(Vector3.new(0.08, 0.5, 0.08), CFrame.new(sx * 0.95, yG + 0.5, 0) * CFrame.Angles(0, 0, math.rad(-sx * 40)), def.wrapC)
		end
		make("PointLight", { Range = 7, Brightness = 1.5, Color = Color3.fromRGB(255, 160, 50), Shadows = false, Parent = pk })
	end
	sp(Vector3.new(W * 0.8, 0.3, T + 0.08), CFrame.new(0, y0 + 0.12, 0), def.guardC)

	local yB = y0 + BB / 2
	local e = 0.07
	local body = sp(Vector3.new(W - e * 2, BB, T), CFrame.new(0, yB, 0), def.bladeC, def.bladeM)
	body.Name = "Blade"
	for _, sx in ipairs({ -1, 1 }) do
		sp(Vector3.new(e, BB, T * 0.55), CFrame.new(sx * (W / 2 - e / 2), yB, 0), def.edgeC, edgeMat)
	end
	sp(Vector3.new(W * 0.2, BB * 0.7, T + 0.02), CFrame.new(0, y0 + BB * 0.35 + 0.05, 0), def.bladeC:Lerp(BLACK, 0.3), def.bladeM)
	local yT = y0 + BB + TL / 2
	local tipR = sp(Vector3.new(T, TL, W / 2), CFrame.fromMatrix(Vector3.new(W / 4, yT, 0), Vector3.new(0, 0, 1), Vector3.new(0, 1, 0), Vector3.new(-1, 0, 0)),
		def.bladeC, def.bladeM, nil, "WedgePart")
	local tipL = sp(Vector3.new(T, TL, W / 2), CFrame.fromMatrix(Vector3.new(-W / 4, yT, 0), Vector3.new(0, 0, -1), Vector3.new(0, 1, 0), Vector3.new(1, 0, 0)),
		def.bladeC, def.bladeM, nil, "WedgePart")
	if def.bladeT then
		body.Transparency, tipR.Transparency, tipL.Transparency = def.bladeT, def.bladeT, def.bladeT
	end

	if def.id == "rusty" then
		for _ = 1, 4 do
			local sx = sr:NextNumber() < 0.5 and -1 or 1
			sp(Vector3.new(0.14, 0.12, T + 0.04), CFrame.new(sx * (W / 2 - 0.02), y0 + sr:NextNumber(0.3, BB - 0.2), 0) * CFrame.Angles(0, 0, math.rad(45)),
				Color3.fromRGB(40, 32, 28), Enum.Material.SmoothPlastic)
		end
		for _ = 1, 5 do
			local sz = sr:NextNumber() < 0.5 and -1 or 1
			sp(Vector3.new(sr:NextNumber(0.12, 0.26), sr:NextNumber(0.15, 0.35), 0.03), CFrame.new(sr:NextNumber(-W / 3, W / 3), y0 + sr:NextNumber(0.2, BB), sz * (T / 2 + 0.01)),
				Color3.fromRGB(130, 70, 40), Enum.Material.CorrodedMetal)
		end
	elseif def.id == "long" then
		sp(Vector3.new(W * 0.86, 0.38, T + 0.05), CFrame.new(0, y0 + 0.45, 0), Color3.fromRGB(90, 60, 36), Enum.Material.Fabric)
	elseif def.id == "frost" then
		sp(Vector3.new(0.06, BB * 0.85, T + 0.03), CFrame.new(0, y0 + BB * 0.45, 0), Color3.fromRGB(200, 250, 255), Enum.Material.Neon)
		for i = 1, 3 do
			sp(Vector3.new(0.12, 0.45, 0.12), CFrame.new(-W / 2 - 0.06, y0 + BB * (0.25 * i), 0) * CFrame.Angles(0, 0, math.rad(35)), Color3.fromRGB(200, 245, 255), Enum.Material.Ice)
		end
		make("ParticleEmitter", { Rate = 8, Lifetime = NumberRange.new(0.6, 1.2), Speed = NumberRange.new(0.3, 1.2), SpreadAngle = Vector2.new(180, 180),
			Size = NumberSequence.new(0.12), Acceleration = Vector3.new(0, -2, 0), Color = ColorSequence.new(Color3.fromRGB(220, 250, 255)), LightEmission = 0.5, Parent = body })
	elseif def.id == "inferno" then
		for _, sz in ipairs({ -1, 1 }) do
			for i = 0, 4 do
				sp(Vector3.new(0.05, BB / 5.2, 0.02), CFrame.new((i % 2 == 0) and 0.06 or -0.06, y0 + (i + 0.5) * BB / 5, sz * (T / 2 + 0.012)) * CFrame.Angles(0, 0, math.rad((i % 2 == 0) and 18 or -18)),
					Color3.fromRGB(255, 120, 30), Enum.Material.Neon)
			end
		end
		for i = 0, 4 do
			sp(Vector3.new(0.2, 0.2, T * 0.7), CFrame.new(W / 2, y0 + BB * (0.15 + i * 0.17), 0) * CFrame.Angles(0, 0, math.rad(45)), def.bladeC, def.bladeM)
		end
		make("Fire", { Size = 2, Heat = 4, Color = Color3.fromRGB(255, 140, 40), SecondaryColor = Color3.fromRGB(255, 60, 20), Parent = body })
	elseif def.id == "pumpkin" then
		-- midnight-purple glass blade full of stars, orange glowing runes, a crescent moon tip and pumpkin fire
		body.Transparency = 0.12
		for i = 0, 5 do
			for _, sz in ipairs({ -1, 1 }) do
				sp(Vector3.new(0.09, 0.09, 0.02), CFrame.new(sr:NextNumber(-W / 4, W / 4), y0 + BB * (0.1 + i * 0.15), sz * (T / 2 + 0.012)) * CFrame.Angles(0, 0, math.rad(45)),
					Color3.fromRGB(255, 240, 200), Enum.Material.Neon)
			end
		end
		for i = 0, 3 do
			sp(Vector3.new(0.12, 0.2, T + 0.04), CFrame.new(0, y0 + BB * (0.2 + i * 0.2), 0), Color3.fromRGB(255, 140, 20), Enum.Material.Neon)
		end
		for k = 0, 2 do
			sp(Vector3.new(0.1, 0.42 - k * 0.1, 0.1), CFrame.new(W / 2 + 0.08, y0 + BB * (0.3 + k * 0.25), 0) * CFrame.Angles(0, 0, math.rad(-30)), Color3.fromRGB(150, 70, 230), Enum.Material.Neon)
		end
		make("Fire", { Size = 2.5, Heat = 5, Color = Color3.fromRGB(255, 130, 20), SecondaryColor = Color3.fromRGB(140, 40, 220), Parent = body })
		make("ParticleEmitter", { Rate = 10, Lifetime = NumberRange.new(0.6, 1.2), Speed = NumberRange.new(0.4, 1.5), SpreadAngle = Vector2.new(180, 180),
			Size = NumberSequence.new(0.14, 0), Color = ColorSequence.new(Color3.fromRGB(255, 160, 40), Color3.fromRGB(170, 80, 255)), LightEmission = 1, Parent = body })
	end
	if def.glow then make("PointLight", { Range = 8, Brightness = 1.2, Color = def.glow, Shadows = false, Parent = body }) end

	local a0 = make("Attachment", { Name = "TrailBase", Position = Vector3.new(0, y0 + 0.4, 0), Parent = handle })
	local a1 = make("Attachment", { Name = "TrailTip", Position = Vector3.new(0, y0 + BL - 0.1, 0), Parent = handle })
	local trail = make("Trail", { Attachment0 = a0, Attachment1 = a1, Lifetime = 0.18, LightEmission = 0.7, FaceCamera = false, Enabled = false,
		Color = ColorSequence.new(def.trail), Transparency = NumberSequence.new(0.2, 1), MinLength = 0.05, Parent = handle })
	model.PrimaryPart = handle
	return model, handle, { trail = trail, tip = a1, base = a0, len = BL, y0 = y0, blade = body }
end

------------------------------------------------------------------------------------------------
-- WORLD BUILDERS  (each world is built into its own folder; only the one you're in is shown)
------------------------------------------------------------------------------------------------
local Build = { locks = {}, tunnels = {}, gate = nil }
local CAVE_SPAWN = CFrame.lookAt(Vector3.new(0, 3.5, 36), Vector3.new(0, 3.5, 0))
local TUNNEL_DIR = { grave = Vector3.new(0, 0, -1), ice = Vector3.new(-1, 0, 0), jungle = Vector3.new(1, 0, 0) }
do
	local CYL, BALL = Enum.PartType.Cylinder, Enum.PartType.Ball
	local UP = CFrame.Angles(0, 0, math.pi / 2) -- turns a cylinder upright

	local function sign(parent, cf, size, title, sub, bg, fg, face)
		local board = part({ Size = size, CFrame = cf, Material = Enum.Material.WoodPlanks, Color = bg or Color3.fromRGB(70, 50, 34), Parent = parent })
		for _, f in ipairs(face and { face } or { Enum.NormalId.Front, Enum.NormalId.Back }) do
			local sg = make("SurfaceGui", { Face = f, SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud, PixelsPerStud = 36, LightInfluence = 0.15, Parent = board })
			local t = make("TextLabel", { Size = UDim2.fromScale(1, sub and 0.62 or 1), BackgroundTransparency = 1, Text = title, Font = Enum.Font.FredokaOne,
				TextScaled = true, TextColor3 = fg or WHITE, Parent = sg })
			make("UIStroke", { Thickness = 3, Color = BLACK, Parent = t })
			if sub then
				local l = make("TextLabel", { Name = "Sub", Size = UDim2.fromScale(0.96, 0.34), Position = UDim2.fromScale(0.02, 0.62), BackgroundTransparency = 1, Text = sub,
					Font = Enum.Font.FredokaOne, TextScaled = true, TextColor3 = Color3.fromRGB(230, 230, 230), Parent = sg })
				make("UIStroke", { Thickness = 2, Color = BLACK, Parent = l })
			end
		end
		return board
	end
	Build.sign = sign

	local function rock(parent, cf, size, color, mat)
		return part({ Size = size, CFrame = cf, Material = mat or Enum.Material.Slate, Color = color, Parent = parent })
	end

	local function torch(parent, pos, light)
		part({ Size = Vector3.new(0.4, 2.4, 0.4), CFrame = CFrame.new(pos) * CFrame.Angles(math.rad(-15), 0, 0), Material = Enum.Material.Wood,
			Color = Color3.fromRGB(80, 56, 36), CanCollide = false, Parent = parent })
		local head = part({ Size = Vector3.new(0.7, 0.6, 0.7), Position = pos + Vector3.new(0, 1.3, -0.3), Material = Enum.Material.Neon,
			Color = Color3.fromRGB(255, 150, 50), CanCollide = false, CastShadow = false, Parent = parent })
		make("Fire", { Size = 2.4, Heat = 6, Color = Color3.fromRGB(255, 150, 40), SecondaryColor = Color3.fromRGB(255, 60, 20), Parent = head })
		if light ~= false then make("PointLight", { Range = 20, Brightness = 1.6, Color = Color3.fromRGB(255, 160, 80), Shadows = false, Parent = head }) end
		return head
	end

	local function pumpkin(parent, pos, s, ang, lit, light, tint)
		local col = ({ Color3.fromRGB(240, 120, 20), Color3.fromRGB(226, 100, 16), Color3.fromRGB(250, 140, 34) })[tint or 1]
		local cf = CFrame.new(pos + Vector3.new(0, s * 0.36, 0)) * CFrame.Angles(0, ang or 0, 0)
		local body = part({ Shape = BALL, Size = Vector3.new(s, s * 0.78, s), CFrame = cf, Color = col, Parent = parent })
		for k = 0, 1 do
			part({ Size = Vector3.new(s * 0.14, s * 0.74, s * 1.01), CFrame = cf * CFrame.Angles(0, math.rad(45 + k * 90), 0), Color = col:Lerp(BLACK, 0.12),
				CanCollide = false, CastShadow = false, Parent = parent })
		end
		part({ Size = Vector3.new(s * 0.12, s * 0.3, s * 0.12), CFrame = cf * CFrame.new(0, s * 0.45, 0) * CFrame.Angles(0, 0, 0.25), Material = Enum.Material.Wood,
			Color = Color3.fromRGB(80, 110, 40), CanCollide = false, Parent = parent })
		if lit then
			local glow = Color3.fromRGB(255, 220, 90)
			for _, x in ipairs({ -0.18, 0.18 }) do
				wedge({ Size = Vector3.new(0.05, s * 0.16, s * 0.16), CFrame = cf * CFrame.new(x * s, s * 0.08, -s * 0.47) * CFrame.Angles(0, math.pi / 2, 0),
					Material = Enum.Material.Neon, Color = glow, CanCollide = false, CastShadow = false, Parent = parent })
			end
			part({ Size = Vector3.new(s * 0.42, s * 0.1, 0.05), CFrame = cf * CFrame.new(0, -s * 0.12, -s * 0.48), Material = Enum.Material.Neon, Color = glow,
				CanCollide = false, CastShadow = false, Parent = parent })
			if light then make("PointLight", { Range = 12, Brightness = 1.3, Color = Color3.fromRGB(255, 170, 60), Shadows = false, Parent = body }) end
		end
		return body
	end
	Build.pumpkin = pumpkin

	local function deadTree(parent, pos, s, ang, col)
		col = col or Color3.fromRGB(58, 48, 44)
		local h = 11 * s
		part({ Shape = CYL, Size = Vector3.new(h, 1.5 * s, 1.5 * s), CFrame = CFrame.new(pos + Vector3.new(0, h / 2, 0)) * CFrame.Angles(0, ang, math.rad(93)),
			Material = Enum.Material.Wood, Color = col, Parent = parent })
		for i = 1, 4 do
			local len = (3 + i * 0.7) * s
			part({ Size = Vector3.new(0.45 * s, len, 0.45 * s),
				CFrame = CFrame.new(pos + Vector3.new(0, h * (0.45 + i * 0.12), 0)) * CFrame.Angles(0, ang + i * 1.9, 0) * CFrame.Angles(math.rad(40 + i * 6), 0, 0) * CFrame.new(0, len / 2, 0),
				Material = Enum.Material.Wood, Color = col, CanCollide = false, Parent = parent })
		end
		for _, a in ipairs({ 0, 2.1, 4.2 }) do -- roots
			wedge({ Size = Vector3.new(0.6 * s, 1.4 * s, 2 * s), CFrame = CFrame.new(pos) * CFrame.Angles(0, ang + a, 0) * CFrame.new(0, 0.7 * s, 1.2 * s),
				Material = Enum.Material.Wood, Color = col, CanCollide = false, Parent = parent })
		end
	end

	-- big rock walls around the edge of a world + the cave mouth you walk out of
	local function edges(parent, O, o)
		local col, mat = o.rock, o.mat or Enum.Material.Slate
		-- south cliff with the cave mouth in the middle
		rock(parent, CFrame.new(O + Vector3.new(-112, 30, 208)), Vector3.new(202, 60, 22), col, mat)
		rock(parent, CFrame.new(O + Vector3.new(112, 30, 208)), Vector3.new(202, 60, 22), col, mat)
		rock(parent, CFrame.new(O + Vector3.new(0, 39, 208)), Vector3.new(24, 42, 22), col, mat)
		-- the arch
		for i = 0, 6 do
			local a = math.rad(180 * i / 6)
			rock(parent, CFrame.new(O + Vector3.new(math.cos(a) * 11, 6 + math.sin(a) * 12, 197)) * CFrame.Angles(0, 0, a), Vector3.new(5, 4, 4), col:Lerp(BLACK, 0.15), mat)
		end
		part({ Size = Vector3.new(22, 18, 1), CFrame = CFrame.new(O + Vector3.new(0, 9, 217)), Material = Enum.Material.SmoothPlastic, Color = BLACK, Parent = parent })
		local glow = part({ Size = Vector3.new(16, 14, 0.5), CFrame = CFrame.new(O + Vector3.new(0, 7, 216)), Material = Enum.Material.Neon,
			Color = Color3.fromRGB(255, 170, 80), Transparency = 0.6, CanCollide = false, Parent = parent })
		make("PointLight", { Range = 16, Brightness = 1.2, Color = Color3.fromRGB(255, 170, 90), Parent = glow })
		for _, x in ipairs({ -12, 12 }) do torch(parent, O + Vector3.new(x, 4, 195), x < 0) end
		sign(parent, CFrame.new(O + Vector3.new(0, 20.5, 196.6)), Vector3.new(16, 3.2, 0.4), "🕯 BACK TO THE CAVE", nil, Color3.fromRGB(60, 44, 30), WHITE)
		-- side + back walls (jagged rocks)
		local er = Random.new(O.X)
		for i = 0, 18 do
			local z = 200 - i * 23.5
			for _, side in ipairs({ -1, 1 }) do
				local s = er:NextNumber(26, 40)
				rock(parent, CFrame.new(O + Vector3.new(side * (204 + s * 0.2), s * 0.45, z)) * CFrame.Angles(er:NextNumber(-0.2, 0.2), er:NextNumber(0, 3), er:NextNumber(-0.2, 0.2)),
					Vector3.new(s, s * er:NextNumber(1.1, 1.8), s), col:Lerp(BLACK, er:NextNumber(0, 0.2)), mat)
			end
		end
		for i = 0, 17 do
			local s = er:NextNumber(28, 44)
			rock(parent, CFrame.new(O + Vector3.new(-204 + i * 24, s * 0.45, -230 - s * 0.15)) * CFrame.Angles(er:NextNumber(-0.2, 0.2), er:NextNumber(0, 3), er:NextNumber(-0.2, 0.2)),
				Vector3.new(s, s * er:NextNumber(1.1, 1.9), s), col:Lerp(BLACK, er:NextNumber(0, 0.2)), mat)
		end
		if o.cap then -- snow / moss on top of the cliffs
			for i = 0, 8 do
				part({ Size = Vector3.new(46, 3, 24), CFrame = CFrame.new(O + Vector3.new(-200 + i * 50, 61, 208)), Material = o.capMat or Enum.Material.Snow, Color = o.cap,
					CanCollide = false, Parent = parent })
			end
		end
		local function wall(size, pos) part({ Name = "Boundary", Size = size, Position = O + pos, Transparency = 1, CastShadow = false, Parent = parent }) end
		wall(Vector3.new(4, 200, 470), Vector3.new(198, 100, -10))
		wall(Vector3.new(4, 200, 470), Vector3.new(-198, 100, -10))
		wall(Vector3.new(400, 200, 4), Vector3.new(0, 100, -222))
		wall(Vector3.new(400, 200, 4), Vector3.new(0, 100, 220))
		-- the ground
		part({ Name = "Ground", Size = Vector3.new(480, 8, 520), Position = O + Vector3.new(0, -4, -10), Material = o.groundMat, Color = o.ground, Parent = parent })
	end

	local function fireflies(parent, pos, size, color, rate)
		local holder = part({ Size = size, Position = pos, Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false, CastShadow = false, Parent = parent })
		make("ParticleEmitter", { Rate = rate or 4, Lifetime = NumberRange.new(4, 7), Speed = NumberRange.new(0.3, 1), SpreadAngle = Vector2.new(180, 180),
			Size = NumberSequence.new(0.25), Color = ColorSequence.new(color), LightEmission = 1,
			Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.3, 0.1), NumberSequenceKeypoint.new(1, 1) }),
			Parent = holder })
		return holder
	end
	local function fog(parent, pos, size, color, rate)
		local f = part({ Size = size, Position = pos, Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false, CastShadow = false, Parent = parent })
		make("ParticleEmitter", { Texture = "rbxasset://textures/particles/smoke_main.dds", Rate = rate or 4, Lifetime = NumberRange.new(5, 8), Speed = NumberRange.new(0.2, 0.6),
			SpreadAngle = Vector2.new(180, 10), Size = NumberSequence.new(7, 10), Color = ColorSequence.new(color),
			Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.4, 0.8), NumberSequenceKeypoint.new(1, 1) }),
			Parent = f })
		return f
	end

	------------------------------------------------------------------------------------------ 🕯 THE CAVE (hub)
	function Build.cave()
		local F = Folders.cave
		local stone = Color3.fromRGB(66, 58, 60)
		part({ Name = "CaveFloor", Size = Vector3.new(260, 4, 260), Position = Vector3.new(0, -2, 0), Material = Enum.Material.Slate, Color = Color3.fromRGB(70, 62, 62), Parent = F })
		for _ = 1, 40 do
			local s = vr:NextNumber(5, 14)
			part({ Size = Vector3.new(s, 0.3, s * vr:NextNumber(0.6, 1.2)), CFrame = CFrame.new(vr:NextNumber(-70, 70), 0.05, vr:NextNumber(-70, 70)) * CFrame.Angles(0, vr:NextNumber(0, 3), 0),
				Material = Enum.Material.Pebble, Color = Color3.fromRGB(84, 74, 72), CanCollide = false, CastShadow = false, Parent = F })
		end
		-- walls (a ring of huge rocks) with three tunnel openings
		for i = 0, 35 do
			local a = i / 36 * math.pi * 2
			local d = Vector3.new(math.cos(a), 0, math.sin(a))
			local open = false
			for _, td in pairs(TUNNEL_DIR) do
				if d:Dot(td) > math.cos(math.rad(14)) then open = true end
			end
			if not open then
				local cf = CFrame.lookAt(d * 88 + Vector3.new(0, 24, 0), Vector3.new(0, 24, 0))
				rock(F, cf, Vector3.new(18, 52, 16), stone:Lerp(BLACK, vr:NextNumber(0, 0.25)))
				local s = vr:NextNumber(6, 12)
				rock(F, CFrame.new(d * 79 + Vector3.new(0, s * 0.3, 0)) * CFrame.Angles(vr:NextNumber(0, 1), vr:NextNumber(0, 3), vr:NextNumber(0, 1)), Vector3.new(s, s, s),
					stone:Lerp(BLACK, 0.1))
			end
		end
		part({ Name = "CaveCeiling", Size = Vector3.new(260, 10, 260), Position = Vector3.new(0, 52, 0), Material = Enum.Material.Slate, Color = Color3.fromRGB(46, 40, 42), Parent = F })
		for _ = 1, 26 do
			local s = vr:NextNumber(10, 22)
			rock(F, CFrame.new(vr:NextNumber(-70, 70), 46, vr:NextNumber(-70, 70)) * CFrame.Angles(vr:NextNumber(0, 1), vr:NextNumber(0, 3), 0), Vector3.new(s, s * 0.5, s), Color3.fromRGB(52, 46, 48))
		end
		-- stalactites + stalagmites (stacked, tapering)
		local function spike(base, h, w, down, color)
			for k = 0, 2 do
				local f = 1 - k * 0.3
				local y = down and (base.Y - h * (k + 0.5) / 3) or (base.Y + h * (k + 0.5) / 3)
				part({ Size = Vector3.new(w * f, h / 3 + 0.2, w * f), CFrame = CFrame.new(base.X, y, base.Z) * CFrame.Angles(0, k * 0.6, 0),
					Material = Enum.Material.Slate, Color = color, CanCollide = not down, Parent = F })
			end
		end
		for _ = 1, 34 do
			local p = Vector3.new(vr:NextNumber(-74, 74), 47, vr:NextNumber(-74, 74))
			spike(p, vr:NextNumber(5, 12), vr:NextNumber(1.6, 3.4), true, Color3.fromRGB(70, 62, 64))
		end
		for _ = 1, 22 do
			local a = vr:NextNumber(0, math.pi * 2)
			local d = Vector3.new(math.cos(a), 0, math.sin(a))
			local open = false
			for _, td in pairs(TUNNEL_DIR) do
				if d:Dot(td) > math.cos(math.rad(16)) then open = true end
			end
			if not open then spike(d * vr:NextNumber(62, 74), vr:NextNumber(4, 10), vr:NextNumber(2, 4), false, Color3.fromRGB(78, 70, 70)) end
		end
		-- glowing crystals
		local crystalC = { Color3.fromRGB(170, 90, 255), Color3.fromRGB(80, 220, 255), Color3.fromRGB(255, 120, 220) }
		for i = 0, 7 do
			local a = (i + 0.5) / 8 * math.pi * 2
			local p = Vector3.new(math.cos(a) * 70, 0, math.sin(a) * 70)
			local c = crystalC[i % 3 + 1]
			local main
			for k = 1, 4 do
				local h = vr:NextNumber(3, 7.5)
				local cp = part({ Size = Vector3.new(1.2, h, 1.2), CFrame = CFrame.new(p + Vector3.new(vr:NextNumber(-2, 2), h / 2 - 0.4, vr:NextNumber(-2, 2)))
					* CFrame.Angles(vr:NextNumber(-0.4, 0.4), vr:NextNumber(0, 3), vr:NextNumber(-0.4, 0.4)), Material = Enum.Material.Neon, Color = c, Transparency = 0.15,
					CanCollide = false, Parent = F })
				main = main or cp
			end
			if i % 2 == 0 then make("PointLight", { Range = 22, Brightness = 1.6, Color = crystalC[i % 3 + 1], Shadows = false, Parent = main }) end
		end
		-- campfire ring
		do
			local c = Vector3.new(0, 0, 6)
			for i = 0, 9 do
				local a = i / 10 * math.pi * 2
				part({ Shape = BALL, Size = Vector3.new(1.4, 1.1, 1.4), Position = c + Vector3.new(math.cos(a) * 2.6, 0.4, math.sin(a) * 2.6), Material = Enum.Material.Slate,
					Color = Color3.fromRGB(96, 90, 92), Parent = F })
			end
			for _, ang in ipairs({ 30, -30, 90 }) do
				part({ Size = Vector3.new(4, 0.7, 0.7), CFrame = CFrame.new(c + Vector3.new(0, 0.45, 0)) * CFrame.Angles(0, math.rad(ang), 0), Material = Enum.Material.Wood,
					Color = Color3.fromRGB(80, 50, 30), Parent = F })
			end
			local flame = part({ Name = "Campfire", Size = Vector3.new(1, 1, 1), Position = c + Vector3.new(0, 1, 0), Transparency = 1, CanCollide = false, Parent = F })
			make("Fire", { Size = 7, Heat = 10, Color = Color3.fromRGB(255, 140, 40), SecondaryColor = Color3.fromRGB(255, 60, 20), Parent = flame })
			make("PointLight", { Range = 34, Brightness = 2.4, Color = Color3.fromRGB(255, 150, 70), Shadows = true, Parent = flame })
			make("ParticleEmitter", { Rate = 7, Lifetime = NumberRange.new(1, 2.2), Speed = NumberRange.new(2, 6), SpreadAngle = Vector2.new(25, 25),
				Size = NumberSequence.new(0.18), Color = ColorSequence.new(Color3.fromRGB(255, 170, 60)), LightEmission = 1, Parent = flame })
			for _, a in ipairs({ 30, 150, 270 }) do
				local r = math.rad(a)
				part({ Shape = CYL, Size = Vector3.new(5.5, 1.4, 1.4), CFrame = CFrame.new(c + Vector3.new(math.cos(r) * 6.5, 0.45, math.sin(r) * 6.5)) * CFrame.Angles(0, -r + math.pi / 2, 0),
					Material = Enum.Material.Wood, Color = Color3.fromRGB(100, 72, 45), Parent = F })
			end
			Build.campfire = flame
		end
		-- spawn pad
		part({ Shape = CYL, Size = Vector3.new(0.3, 11, 11), CFrame = CFrame.new(0, 0.1, 36) * UP, Material = Enum.Material.Slate, Color = Color3.fromRGB(40, 38, 42), Parent = F })
		part({ Shape = CYL, Size = Vector3.new(0.34, 8, 8), CFrame = CFrame.new(0, 0.12, 36) * UP, Material = Enum.Material.Neon, Color = Color3.fromRGB(255, 140, 40),
			Transparency = 0.55, CanCollide = false, Parent = F })
		-- tunnels to the three worlds
		local info = {
			grave = { "⚰ GRAVEYARD", "Pumpkin Patch · gates open at 120 kills", Color3.fromRGB(255, 150, 60) },
			ice = { "❄ ICE WORLD", "500 kills · 3X COINS", Color3.fromRGB(130, 210, 255) },
			jungle = { "🌴 JUNGLE", "800 kills · 4X COINS · HARDEST", Color3.fromRGB(130, 235, 90) },
		}
		for wid, d in pairs(TUNNEL_DIR) do
			local side = Vector3.new(-d.Z, 0, d.X)
			local look = CFrame.lookAt(Vector3.zero, d)
			local function at(r, s, y) return d * r + side * s + Vector3.new(0, y, 0) end
			for _, sx in ipairs({ -1, 1 }) do
				rock(F, look + at(100, sx * 13, 13), Vector3.new(6, 30, 44), stone)
			end
			rock(F, look + at(100, 0, 24), Vector3.new(32, 6, 44), Color3.fromRGB(52, 46, 48))
			for _, sx in ipairs({ -1, 1 }) do -- door jambs close the gap between the tunnel and the cave wall
				rock(F, look + at(87, sx * 22, 24), Vector3.new(14, 52, 18), stone:Lerp(BLACK, 0.12))
			end
			rock(F, look + at(87, 0, 37.5), Vector3.new(34, 21, 18), stone:Lerp(BLACK, 0.18)) -- lintel above the opening
			local inf = info[wid]
			local glow = part({ Size = Vector3.new(22, 22, 1), CFrame = look + at(121, 0, 10), Material = Enum.Material.Neon, Color = inf[3]:Lerp(WHITE, 0.55), Parent = F })
			make("PointLight", { Range = 30, Brightness = 2, Color = inf[3], Parent = glow })
			local beam = part({ Size = Vector3.new(20, 18, 30), CFrame = look + at(104, 0, 9), Material = Enum.Material.Neon, Color = inf[3]:Lerp(WHITE, 0.6),
				Transparency = 0.93, CanCollide = false, CastShadow = false, Parent = F })
			beam.Name = "LightBeam"
			sign(F, look * CFrame.Angles(0, math.pi, 0) + at(77, 0, 23.6), Vector3.new(24, 6, 0.6), inf[1], inf[2], Color3.fromRGB(40, 32, 26), inf[3])
			for _, sx in ipairs({ -1, 1 }) do torch(F, at(76.5, sx * 11.5, 5), true) end
			-- lock bars (removed when the world unlocks)
			local lock = make("Model", { Name = "Lock_" .. wid, Parent = (WORLDS[wid].need > 0) and F or nil })
			for k = -4, 4 do
				part({ Shape = CYL, Size = Vector3.new(20, 0.6, 0.6), CFrame = CFrame.new(at(84, k * 2.4, 10)) * UP, Material = Enum.Material.Metal,
					Color = Color3.fromRGB(40, 40, 46), Parent = lock })
			end
			for _, y in ipairs({ 4, 15 }) do
				part({ Size = Vector3.new(22, 0.6, 0.6), CFrame = look + at(84, 0, y), Material = Enum.Material.Metal, Color = Color3.fromRGB(40, 40, 46), Parent = lock })
			end
			local padlock = part({ Size = Vector3.new(3, 3, 1), CFrame = look + at(83.4, 0, 9), Material = Enum.Material.Metal, Color = Color3.fromRGB(230, 180, 60), Parent = lock })
			part({ Shape = CYL, Size = Vector3.new(1, 2.4, 2.4), CFrame = look * CFrame.Angles(0, math.pi / 2, 0) + at(83.4, 0, 10.8), Material = Enum.Material.Metal,
				Color = Color3.fromRGB(190, 190, 200), CanCollide = false, Parent = lock })
			local lsg = make("SurfaceGui", { Face = Enum.NormalId.Back, SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud, PixelsPerStud = 40, Parent = padlock })
			local lt = make("TextLabel", { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Text = "🔒\n" .. WORLDS[wid].need, Font = Enum.Font.FredokaOne,
				TextScaled = true, TextColor3 = WHITE, Parent = lsg })
			make("UIStroke", { Thickness = 2, Color = BLACK, Parent = lt })
			Build.locks[wid] = lock
			Build.tunnels[wid] = { dir = d, side = side,
				arrive = CFrame.lookAt(d * 66 + Vector3.new(0, 3.5, 0), Vector3.new(0, 3.5, 0)) }
		end
		-- Halloween: jack-o'-lanterns, string lights, cobwebs
		for i = 0, 11 do
			local a = (i + 0.25) / 12 * math.pi * 2
			local d = Vector3.new(math.cos(a), 0, math.sin(a))
			local open = false
			for _, td in pairs(TUNNEL_DIR) do
				if d:Dot(td) > math.cos(math.rad(18)) then open = true end
			end
			if not open then pumpkin(F, d * vr:NextNumber(58, 66), vr:NextNumber(1.8, 3), vr:NextNumber(0, 6), true, i % 3 == 0, vr:NextInteger(1, 3)) end
		end
		local bulbC = { Color3.fromRGB(255, 140, 30), Color3.fromRGB(170, 80, 255), Color3.fromRGB(120, 255, 90) }
		for k = 0, 3 do
			local a0, a1 = k / 4 * math.pi * 2 + 0.4, k / 4 * math.pi * 2 + 1.6
			local p0, p1 = Vector3.new(math.cos(a0) * 76, 30, math.sin(a0) * 76), Vector3.new(math.cos(a1) * 76, 30, math.sin(a1) * 76)
			for j = 0, 14 do
				local u = j / 14
				local p = p0:Lerp(p1, u) - Vector3.new(0, math.sin(u * math.pi) * 9, 0)
				part({ Shape = BALL, Size = Vector3.new(0.7, 0.7, 0.7), Position = p, Material = Enum.Material.Neon, Color = bulbC[j % 3 + 1], CanCollide = false,
					CastShadow = false, Parent = F })
			end
		end
		for i = 0, 5 do
			local a = i / 6 * math.pi * 2 + 0.7
			local p = Vector3.new(math.cos(a) * 78, 36, math.sin(a) * 78)
			for k = 0, 3 do
				part({ Size = Vector3.new(0.08, 0.08, 9), CFrame = CFrame.lookAt(p, Vector3.zero) * CFrame.Angles(0, 0, k * math.pi / 4) * CFrame.new(0, 0, -2),
					Material = Enum.Material.Neon, Color = Color3.fromRGB(220, 220, 230), Transparency = 0.5, CanCollide = false, CastShadow = false, Parent = F })
			end
		end
		-- glowing pool with mushrooms
		local pool = part({ Shape = CYL, Size = Vector3.new(0.3, 22, 22), CFrame = CFrame.new(-42, 0.12, 40) * UP, Material = Enum.Material.Glass,
			Color = Color3.fromRGB(60, 200, 220), Transparency = 0.3, Reflectance = 0.2, CanCollide = false, Parent = F })
		make("PointLight", { Range = 18, Brightness = 1.2, Color = Color3.fromRGB(80, 220, 255), Parent = pool })
		for i = 1, 9 do
			local a = i / 9 * math.pi * 2
			local p = Vector3.new(-42 + math.cos(a) * 13, 0, 40 + math.sin(a) * 13)
			local s = vr:NextNumber(0.8, 1.6)
			part({ Shape = CYL, Size = Vector3.new(1.4 * s, 0.4 * s, 0.4 * s), CFrame = CFrame.new(p + Vector3.new(0, 0.7 * s, 0)) * UP, Color = Color3.fromRGB(230, 225, 210),
				CanCollide = false, Parent = F })
			part({ Shape = BALL, Size = Vector3.new(1.8, 1.1, 1.8) * s, Position = p + Vector3.new(0, 1.5 * s, 0), Material = Enum.Material.Neon,
				Color = (i % 2 == 0) and Color3.fromRGB(80, 220, 255) or Color3.fromRGB(255, 90, 200), CanCollide = false, Parent = F })
		end
		-- dust motes + bats near the ceiling
		fireflies(F, Vector3.new(0, 12, 0), Vector3.new(130, 16, 130), Color3.fromRGB(255, 220, 160), 6)
		local bats = part({ Size = Vector3.new(120, 2, 120), Position = Vector3.new(0, 40, 0), Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false, Parent = F })
		make("ParticleEmitter", { Rate = 2, Lifetime = NumberRange.new(4, 6), Speed = NumberRange.new(6, 10), SpreadAngle = Vector2.new(180, 20), Rotation = NumberRange.new(0, 360),
			Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(0.5, 0.2), NumberSequenceKeypoint.new(1, 0.6) }),
			Color = ColorSequence.new(Color3.fromRGB(20, 16, 22)), Parent = bats })
		-- minecart + rails by the shop
		for i = 0, 9 do
			part({ Size = Vector3.new(5, 0.3, 0.8), CFrame = CFrame.new(58, 0.15, -8 + i * 3), Material = Enum.Material.Wood, Color = Color3.fromRGB(90, 64, 40), CanCollide = false, Parent = F })
		end
		for _, x in ipairs({ -1.8, 1.8 }) do
			part({ Size = Vector3.new(0.3, 0.3, 30), Position = Vector3.new(58 + x, 0.4, 5.5), Material = Enum.Material.Metal, Color = Color3.fromRGB(110, 110, 116), CanCollide = false, Parent = F })
		end
		part({ Size = Vector3.new(4.4, 3, 6), Position = Vector3.new(58, 2.2, 8), Material = Enum.Material.CorrodedMetal, Color = Color3.fromRGB(90, 80, 74), Parent = F })
		for i = 1, 5 do
			part({ Size = Vector3.new(1.4, 1, 1.4), CFrame = CFrame.new(58 + vr:NextNumber(-1.2, 1.2), 3.9, 8 + vr:NextNumber(-2, 2)) * CFrame.Angles(i, i * 2, 0),
				Material = Enum.Material.Neon, Color = crystalC[i % 3 + 1], CanCollide = false, Parent = F })
		end
	end

	------------------------------------------------------------------------------------------ ⚰ GRAVEYARD + 🎃 PUMPKIN PATCH
	function Build.grave()
		local F, L = Folders.grave, LAYOUT.grave
		local O = L.o
		edges(F, O, { rock = Color3.fromRGB(56, 50, 58), ground = Color3.fromRGB(58, 70, 46), groundMat = Enum.Material.Grass })
		-- the yard is darker earth
		part({ Size = Vector3.new(320, 0.2, 212), Position = O + Vector3.new(0, 0.05, -110), Material = Enum.Material.Ground, Color = Color3.fromRGB(56, 50, 42),
			CanCollide = false, Parent = F })
		-- road + path
		part({ Size = Vector3.new(15, 0.2, 206), Position = O + Vector3.new(0, 0.08, 95), Material = Enum.Material.Ground, Color = Color3.fromRGB(96, 76, 56), CanCollide = false, Parent = F })
		part({ Size = Vector3.new(10, 0.25, 170), Position = O + Vector3.new(0, 0.1, -92), Material = Enum.Material.Cobblestone, Color = Color3.fromRGB(96, 92, 92), CanCollide = false, Parent = F })
		-- boss arena: ritual circle
		local A = L.arena
		part({ Shape = CYL, Size = Vector3.new(0.3, A.r * 2, A.r * 2), CFrame = CFrame.new(A.x, 0.12, A.z) * UP, Material = Enum.Material.Cobblestone,
			Color = Color3.fromRGB(78, 74, 80), CanCollide = false, Parent = F })
		for k = 0, 23 do
			local a = k / 24 * math.pi * 2
			part({ Size = Vector3.new(0.6, 0.1, 5.6), CFrame = CFrame.new(A.x + math.cos(a) * (A.r - 3), 0.3, A.z + math.sin(a) * (A.r - 3)) * CFrame.Angles(0, -a, 0),
				Material = Enum.Material.Neon, Color = Color3.fromRGB(150, 70, 230), CanCollide = false, CastShadow = false, Parent = F })
		end
		-- crypt (the Gravekeeper's lair)
		do
			local cc = CFrame.new(O + Vector3.new(0, 0, -194))
			local st = Color3.fromRGB(92, 90, 98)
			part({ Size = Vector3.new(30, 14, 18), CFrame = cc * CFrame.new(0, 7, 0), Material = Enum.Material.Cobblestone, Color = st, Parent = F })
			part({ Size = Vector3.new(32, 1.2, 11), CFrame = cc * CFrame.new(0, 16, -4.4) * CFrame.Angles(math.rad(-25), 0, 0), Material = Enum.Material.Slate, Color = Color3.fromRGB(54, 52, 60), Parent = F })
			part({ Size = Vector3.new(32, 1.2, 11), CFrame = cc * CFrame.new(0, 16, 4.4) * CFrame.Angles(math.rad(25), 0, 0), Material = Enum.Material.Slate, Color = Color3.fromRGB(54, 52, 60), Parent = F })
			part({ Size = Vector3.new(7, 10, 0.4), CFrame = cc * CFrame.new(0, 5, 9.1), Color = Color3.fromRGB(10, 8, 12), Parent = F })
			for _, x in ipairs({ -6, 6, -12, 12 }) do
				part({ Shape = CYL, Size = Vector3.new(14, 1.8, 1.8), CFrame = cc * CFrame.new(x, 7, 10) * UP, Material = Enum.Material.Marble, Color = Color3.fromRGB(170, 168, 172), Parent = F })
			end
			for i = 0, 2 do
				part({ Size = Vector3.new(14 - i * 2, 0.6, 2), CFrame = cc * CFrame.new(0, 0.3 + i * 0.6, 12 - i * 1.4), Material = Enum.Material.Slate, Color = st, Parent = F })
			end
			local glow = part({ Size = Vector3.new(2, 2, 2), CFrame = cc * CFrame.new(0, 12, 9.4), Material = Enum.Material.Neon, Color = Color3.fromRGB(150, 80, 255), CanCollide = false, Parent = F })
			make("PointLight", { Range = 34, Brightness = 2.4, Color = glow.Color, Parent = glow })
			sign(F, cc * CFrame.new(0, 21.5, 0.5), Vector3.new(14, 3, 0.5), "THE CRYPT", nil, Color3.fromRGB(40, 36, 44), Color3.fromRGB(200, 140, 255))
		end
		-- iron fence around the yard + the big gate
		local iron = Color3.fromRGB(26, 26, 30)
		local function fenceLine(a, b)
			local dir, len = b - a, (b - a).Magnitude
			for i = 0, math.floor(len / 4) do
				local p = a + dir.Unit * i * 4
				part({ Size = Vector3.new(0.3, 5, 0.3), Position = p + Vector3.new(0, 2.5, 0), Material = Enum.Material.Metal, Color = iron, CastShadow = false, Parent = F })
				part({ Size = Vector3.new(0.4, 0.4, 0.4), CFrame = CFrame.new(p + Vector3.new(0, 5.2, 0)) * CFrame.Angles(math.rad(45), 0, math.rad(45)), Material = Enum.Material.Metal,
					Color = iron, CanCollide = false, CastShadow = false, Parent = F })
			end
			for _, y in ipairs({ 1, 4.3 }) do
				part({ Size = Vector3.new(0.22, 0.22, len), CFrame = CFrame.lookAt((a + b) / 2 + Vector3.new(0, y, 0), b + Vector3.new(0, y, 0)), Material = Enum.Material.Metal,
					Color = iron, CastShadow = false, Parent = F })
			end
			part({ Name = "FenceWall", Size = Vector3.new(0.5, 7, len), CFrame = CFrame.lookAt((a + b) / 2 + Vector3.new(0, 3.5, 0), b + Vector3.new(0, 3.5, 0)),
				Transparency = 1, CastShadow = false, Parent = F })
		end
		local fz = O.Z - 5
		fenceLine(Vector3.new(O.X - 160, 0, fz), Vector3.new(O.X - 9, 0, fz))
		fenceLine(Vector3.new(O.X + 9, 0, fz), Vector3.new(O.X + 160, 0, fz))
		fenceLine(Vector3.new(O.X - 160, 0, fz), Vector3.new(O.X - 160, 0, O.Z - 223))
		fenceLine(Vector3.new(O.X + 160, 0, fz), Vector3.new(O.X + 160, 0, O.Z - 223))
		for _, x in ipairs({ -9.5, 9.5 }) do
			part({ Size = Vector3.new(2.6, 12, 2.6), Position = Vector3.new(O.X + x, 6, fz), Material = Enum.Material.Cobblestone, Color = Color3.fromRGB(96, 94, 100), Parent = F })
			local l = part({ Size = Vector3.new(1.4, 1.6, 1.4), Position = Vector3.new(O.X + x, 13, fz), Material = Enum.Material.Neon, Color = Color3.fromRGB(130, 255, 140), CanCollide = false, Parent = F })
			make("PointLight", { Range = 18, Brightness = 1.6, Color = l.Color, Parent = l })
		end
		local gate = { doors = {} }
		for _, sx in ipairs({ -1, 1 }) do
			local hinge = CFrame.new(O.X + sx * 8.2, 0, fz)
			local door = make("Model", { Name = "GateDoor", Parent = F })
			local panel = part({ Name = "Panel", Size = Vector3.new(8, 9, 0.4), CFrame = hinge * CFrame.new(-sx * 4, 4.6, 0), Transparency = 1, Parent = door })
			for k = 0, 6 do
				part({ Size = Vector3.new(0.3, 9, 0.3), CFrame = hinge * CFrame.new(-sx * (0.4 + k * 1.2), 4.6, 0), Material = Enum.Material.Metal, Color = iron, CanCollide = false, Parent = door })
			end
			for _, y in ipairs({ 1.2, 4.6, 8.4 }) do
				part({ Size = Vector3.new(8, 0.3, 0.3), CFrame = hinge * CFrame.new(-sx * 4, y, 0), Material = Enum.Material.Metal, Color = iron, CanCollide = false, Parent = door })
			end
			door.PrimaryPart = panel
			for _, p in ipairs(door:GetChildren()) do
				if p ~= panel and p:IsA("BasePart") then
					p.Anchored = false
					weld(panel, p)
				end
			end
			table.insert(gate.doors, { model = door, panel = panel, hinge = hinge, sx = sx, closed = panel.CFrame })
		end
		gate.sign = sign(F, CFrame.new(O.X, 15.5, fz), Vector3.new(19, 4.2, 0.5), "⚰ GRAVEYARD", "🔒 " .. GRAVE_GATE_KILLS .. " KILLS TO OPEN",
			Color3.fromRGB(36, 32, 40), Color3.fromRGB(255, 160, 70))
		Build.gate = gate
		-- tombstones
		for _, g in ipairs(L.graves) do
			local base = CFrame.new(g.x, 0, g.z) * CFrame.Angles(math.rad(g.rx), math.rad(g.ry), math.rad(g.rz))
			local col = Color3.fromRGB(g.shade, g.shade, g.shade + 6)
			if g.kind == 1 or g.kind == 2 then
				part({ Size = Vector3.new(2.4, 2.6, 0.5), CFrame = base * CFrame.new(0, 1.3, 0), Material = Enum.Material.Slate, Color = col, Parent = F })
				part({ Shape = CYL, Size = Vector3.new(0.5, 2.4, 2.4), CFrame = base * CFrame.new(0, 2.6, 0) * CFrame.Angles(0, math.rad(90), 0), Material = Enum.Material.Slate,
					Color = col, Parent = F })
			elseif g.kind == 3 then
				part({ Size = Vector3.new(0.55, 3.8, 0.45), CFrame = base * CFrame.new(0, 1.9, 0), Material = Enum.Material.Slate, Color = col, Parent = F })
				part({ Size = Vector3.new(2.2, 0.55, 0.45), CFrame = base * CFrame.new(0, 2.8, 0), Material = Enum.Material.Slate, Color = col, Parent = F })
			else
				part({ Size = Vector3.new(2, 3.2, 0.6), CFrame = base * CFrame.new(0, 1.6, 0), Material = Enum.Material.Marble, Color = col:Lerp(WHITE, 0.2), Parent = F })
				wedge({ Size = Vector3.new(2, 0.8, 0.6), CFrame = base * CFrame.new(0, 3.6, 0) * CFrame.Angles(0, math.pi / 2, 0), Material = Enum.Material.Marble,
					Color = col:Lerp(WHITE, 0.2), Parent = F })
			end
			part({ Size = Vector3.new(2.2, 0.45, 4), CFrame = CFrame.new(g.x, 0.22, g.z + 2.6), Material = Enum.Material.Ground, Color = Color3.fromRGB(70, 56, 42), CanCollide = false, Parent = F })
			if g.candle then
				part({ Size = Vector3.new(0.3, 0.6, 0.3), Position = Vector3.new(g.x + 1.3, 0.3, g.z + 0.6), Material = Enum.Material.Neon, Color = Color3.fromRGB(255, 200, 120),
					CanCollide = false, CastShadow = false, Parent = F })
			end
		end
		for _, c in ipairs(L.coffins) do
			local cf = CFrame.new(c.x, 0.5, c.z) * CFrame.Angles(0, c.a, 0)
			part({ Size = Vector3.new(2.4, 1, 6), CFrame = cf, Material = Enum.Material.WoodPlanks, Color = Color3.fromRGB(70, 48, 34), Parent = F })
			if c.open then
				part({ Size = Vector3.new(2.4, 0.3, 6), CFrame = cf * CFrame.new(1.6, 0.2, 0) * CFrame.Angles(0, 0, -0.5), Material = Enum.Material.WoodPlanks, Color = Color3.fromRGB(80, 56, 40), Parent = F })
				part({ Size = Vector3.new(2, 0.2, 5.6), CFrame = cf * CFrame.new(0, 0.42, 0), Material = Enum.Material.Fabric, Color = Color3.fromRGB(120, 20, 30), CanCollide = false, Parent = F })
			end
		end
		for _, t in ipairs(L.yardTrees) do deadTree(F, Vector3.new(t.x, 0, t.z), t.s, t.a, Color3.fromRGB(48, 40, 38)) end
		for _, t in ipairs(L.trees) do deadTree(F, Vector3.new(t.x, 0, t.z), t.s, t.a) end
		-- 🎃 pumpkin patch
		local lights = 0
		for _, p in ipairs(L.pumpkins) do
			local light = p.lit and lights < 8
			if light then lights += 1 end
			pumpkin(F, Vector3.new(p.x, 0, p.z), p.s, p.a, p.lit, light, p.tint)
			part({ Size = Vector3.new(p.s * 1.2, 0.1, p.s * 1.2), CFrame = CFrame.new(p.x, 0.05, p.z) * CFrame.Angles(0, p.a, 0), Material = Enum.Material.Ground,
				Color = Color3.fromRGB(80, 62, 44), CanCollide = false, CastShadow = false, Parent = F })
		end
		for _, sc in ipairs(L.scarecrows) do
			local cf = CFrame.new(sc.x, 0, sc.z) * CFrame.Angles(0, sc.a + math.pi, 0)
			part({ Size = Vector3.new(0.5, 8, 0.5), CFrame = cf * CFrame.new(0, 4, 0), Material = Enum.Material.Wood, Color = Color3.fromRGB(100, 72, 44), Parent = F })
			part({ Size = Vector3.new(6, 0.4, 0.4), CFrame = cf * CFrame.new(0, 5.6, 0), Material = Enum.Material.Wood, Color = Color3.fromRGB(100, 72, 44), CanCollide = false, Parent = F })
			part({ Size = Vector3.new(2.6, 2.6, 1.2), CFrame = cf * CFrame.new(0, 5, 0), Material = Enum.Material.Fabric, Color = Color3.fromRGB(150, 40, 36), CanCollide = false, Parent = F })
			part({ Size = Vector3.new(5.6, 1, 1), CFrame = cf * CFrame.new(0, 5.6, 0), Material = Enum.Material.Fabric, Color = Color3.fromRGB(150, 40, 36), CanCollide = false, Parent = F })
			for _, x in ipairs({ -2.9, 2.9 }) do
				part({ Size = Vector3.new(0.6, 0.6, 0.8), CFrame = cf * CFrame.new(x, 5.4, 0) * CFrame.Angles(0, 0, 0.6), Material = Enum.Material.Grass, Color = Color3.fromRGB(220, 190, 90), CanCollide = false, Parent = F })
			end
			pumpkin(F, (cf * CFrame.new(0, 6.1, 0)).Position, 2.2, sc.a + math.pi, true, false, 2)
			part({ Shape = CYL, Size = Vector3.new(0.2, 3, 3), CFrame = cf * CFrame.new(0, 8.1, 0) * UP, Color = Color3.fromRGB(30, 28, 30), CanCollide = false, Parent = F })
			part({ Size = Vector3.new(0.9, 1.6, 0.9), CFrame = cf * CFrame.new(0, 8.8, 0) * CFrame.Angles(0, 0, 0.3), Color = Color3.fromRGB(30, 28, 30), CanCollide = false, Parent = F })
		end
		for _, h in ipairs(L.hay) do
			local cf = CFrame.new(h.x, 1.1, h.z) * CFrame.Angles(0, h.a, 0)
			part({ Size = Vector3.new(4, 2.2, 2.6), CFrame = cf, Material = Enum.Material.Grass, Color = Color3.fromRGB(214, 184, 92), Parent = F })
			for _, x in ipairs({ -1.1, 1.1 }) do
				part({ Size = Vector3.new(0.2, 2.26, 2.66), CFrame = cf * CFrame.new(x, 0, 0), Material = Enum.Material.Fabric, Color = Color3.fromRGB(150, 110, 60), CanCollide = false, Parent = F })
			end
			if h.stack then
				part({ Size = Vector3.new(4, 2.2, 2.6), CFrame = cf * CFrame.new(0.4, 2.2, 0) * CFrame.Angles(0, 0.4, 0), Material = Enum.Material.Grass, Color = Color3.fromRGB(205, 176, 88), Parent = F })
			end
		end
		for _, c in ipairs(L.corn) do
			for x = -c.w / 2, c.w / 2, 2.6 do
				for z = -c.d / 2, c.d / 2, 2.6 do
					local h = vr:NextNumber(5, 7.5)
					part({ Size = Vector3.new(0.25, h, 0.25), CFrame = CFrame.new(c.x + x + vr:NextNumber(-0.4, 0.4), h / 2, c.z + z) * CFrame.Angles(vr:NextNumber(-0.1, 0.1), 0, vr:NextNumber(-0.1, 0.1)),
						Material = Enum.Material.Grass, Color = Color3.fromRGB(176, 150, 82), CanCollide = false, CastShadow = false, Parent = F })
					part({ Size = Vector3.new(1.6, 0.1, 0.5), CFrame = CFrame.new(c.x + x, h * 0.6, c.z + z) * CFrame.Angles(0, vr:NextNumber(0, 3), 0.5), Material = Enum.Material.Grass,
						Color = Color3.fromRGB(150, 140, 70), CanCollide = false, CastShadow = false, Parent = F })
				end
			end
		end
		for _, l in ipairs(L.lamps) do
			local p = Vector3.new(l.x, 0, l.z)
			part({ Size = Vector3.new(0.4, 7, 0.4), Position = p + Vector3.new(0, 3.5, 0), Material = Enum.Material.Wood, Color = Color3.fromRGB(60, 44, 30), Parent = F })
			local lan = pumpkin(F, p + Vector3.new(0, 7, 0), 1.4, (l.x > O.X) and math.pi / 2 or -math.pi / 2, true, l.light, 3)
			lan.CanCollide = false
		end
		sign(F, CFrame.new(O + Vector3.new(16, 4, 172)) * CFrame.Angles(0, math.rad(-20), 0), Vector3.new(11, 3.6, 0.4), "🎃 PUMPKIN PATCH", "zombies ahead!",
			Color3.fromRGB(80, 54, 30), Color3.fromRGB(255, 160, 50))
		part({ Size = Vector3.new(0.4, 4, 0.4), CFrame = CFrame.new(O + Vector3.new(16, 2, 172.4)), Material = Enum.Material.Wood, Color = Color3.fromRGB(80, 56, 36), Parent = F })
		-- spooky air: yard fog, field fireflies, bats
		fog(F, O + Vector3.new(0, 0.8, -110), Vector3.new(300, 1, 200), Color3.fromRGB(170, 150, 200), 9)
		fireflies(F, O + Vector3.new(0, 4, 90), Vector3.new(360, 6, 150), Color3.fromRGB(255, 200, 90), 8)
		local bats = part({ Size = Vector3.new(300, 4, 300), Position = O + Vector3.new(0, 45, -60), Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false, Parent = F })
		make("ParticleEmitter", { Rate = 4, Lifetime = NumberRange.new(5, 8), Speed = NumberRange.new(8, 14), SpreadAngle = Vector2.new(180, 25), Rotation = NumberRange.new(0, 360),
			Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.5, 0.3), NumberSequenceKeypoint.new(1, 1) }),
			Color = ColorSequence.new(Color3.fromRGB(14, 10, 16)), Parent = bats })
		-- a huge Halloween moon
		local moon = part({ Shape = BALL, Size = Vector3.new(90, 90, 90), Position = O + Vector3.new(160, 260, -520), Material = Enum.Material.Neon,
			Color = Color3.fromRGB(255, 196, 120), CanCollide = false, CastShadow = false, Parent = F })
		moon.Name = "Moon"
	end

	------------------------------------------------------------------------------------------ ❄ ICE WORLD
	function Build.ice()
		local F, L = Folders.ice, LAYOUT.ice
		local O = L.o
		edges(F, O, { rock = Color3.fromRGB(130, 160, 196), mat = Enum.Material.Glacier, ground = Color3.fromRGB(236, 242, 250), groundMat = Enum.Material.Snow,
			cap = Color3.fromRGB(245, 250, 255) })
		-- trail of packed snow with lanterns
		for lz = 168, -110, -8 do
			local x = O.X + 10 * math.sin(lz / 30)
			part({ Size = Vector3.new(12, 0.2, 9), CFrame = CFrame.new(x, 0.06, O.Z + lz) * CFrame.Angles(0, math.cos(lz / 30) * 0.3, 0), Material = Enum.Material.Snow,
				Color = Color3.fromRGB(210, 222, 238), CanCollide = false, CastShadow = false, Parent = F })
			if lz % 32 == 8 then
				local p = Vector3.new(x + 8, 0, O.Z + lz)
				part({ Size = Vector3.new(0.4, 6, 0.4), Position = p + Vector3.new(0, 3, 0), Material = Enum.Material.Wood, Color = Color3.fromRGB(70, 52, 40), Parent = F })
				local lamp = part({ Size = Vector3.new(1.2, 1.4, 1.2), Position = p + Vector3.new(0, 6.4, 0), Material = Enum.Material.Neon, Color = Color3.fromRGB(150, 220, 255),
					CanCollide = false, Parent = F })
				if lz % 64 == 8 then make("PointLight", { Range = 16, Brightness = 1.2, Color = lamp.Color, Shadows = false, Parent = lamp }) end
			end
		end
		-- frozen lake
		local K = L.lake
		part({ Shape = CYL, Size = Vector3.new(0.4, K.r * 2, K.r * 2), CFrame = CFrame.new(K.x, 0.1, K.z) * UP, Material = Enum.Material.Ice,
			Color = Color3.fromRGB(150, 205, 235), Transparency = 0.1, Reflectance = 0.25, Parent = F })
		for _ = 1, 12 do
			part({ Size = Vector3.new(0.15, 0.05, vr:NextNumber(6, 18)), CFrame = CFrame.new(K.x + vr:NextNumber(-25, 25), 0.32, K.z + vr:NextNumber(-25, 25)) * CFrame.Angles(0, vr:NextNumber(0, 3), 0),
				Material = Enum.Material.Neon, Color = Color3.fromRGB(220, 245, 255), Transparency = 0.4, CanCollide = false, CastShadow = false, Parent = F })
		end
		-- frozen castle ruins (boss arena)
		local A = L.arena
		part({ Shape = CYL, Size = Vector3.new(0.4, A.r * 2, A.r * 2), CFrame = CFrame.new(A.x, 0.12, A.z) * UP, Material = Enum.Material.Glacier,
			Color = Color3.fromRGB(170, 210, 240), CanCollide = false, Parent = F })
		for _, p in ipairs(L.pillars) do
			local h = p.broken and p.h * 0.5 or p.h
			part({ Size = Vector3.new(4, h, 4), CFrame = CFrame.new(p.x, h / 2, p.z) * CFrame.Angles(0, vr:NextNumber(0, 1), p.broken and 0.12 or 0), Material = Enum.Material.Glacier,
				Color = Color3.fromRGB(150, 190, 225), Parent = F })
			part({ Size = Vector3.new(4.8, 1, 4.8), Position = Vector3.new(p.x, h + 0.4, p.z), Material = Enum.Material.Snow, Color = Color3.fromRGB(245, 250, 255), CanCollide = false, Parent = F })
		end
		do -- ice throne
			local tc = CFrame.new(A.x, 0, A.z - 44)
			part({ Size = Vector3.new(14, 6, 8), CFrame = tc * CFrame.new(0, 3, 0), Material = Enum.Material.Glacier, Color = Color3.fromRGB(160, 205, 240), Parent = F })
			part({ Size = Vector3.new(14, 16, 3), CFrame = tc * CFrame.new(0, 12, -3), Material = Enum.Material.Glacier, Color = Color3.fromRGB(160, 205, 240), Parent = F })
			for i = -2, 2 do
				part({ Size = Vector3.new(1.6, 6 - math.abs(i), 1.6), CFrame = tc * CFrame.new(i * 2.8, 21, -3) * CFrame.Angles(0, 0, math.rad(-i * 8)), Material = Enum.Material.Neon,
					Color = Color3.fromRGB(150, 230, 255), CanCollide = false, Parent = F })
			end
		end
		-- snowy pines
		for _, t in ipairs(L.pines) do
			local s = t.s
			local p = Vector3.new(t.x, 0, t.z)
			local h = 4 * s
			part({ Shape = CYL, Size = Vector3.new(h, 1.2 * s, 1.2 * s), CFrame = CFrame.new(p + Vector3.new(0, h / 2, 0)) * UP, Material = Enum.Material.Wood,
				Color = Color3.fromRGB(80, 60, 44), Parent = F })
			local green = Color3.fromRGB(34 + vr:NextInteger(0, 16), 74 + vr:NextInteger(0, 20), 62 + vr:NextInteger(0, 14))
			for i = 0, 3 do
				local size = (10 - i * 2.4) * s
				local cf = CFrame.new(p + Vector3.new(0, h + i * 2.6 * s, 0)) * CFrame.Angles(0, t.a + i * 0.8, 0)
				part({ Size = Vector3.new(size, 2.6 * s, size), CFrame = cf, Material = Enum.Material.LeafyGrass, Color = green, CanCollide = false, Parent = F })
				if t.snow then
					part({ Size = Vector3.new(size * 0.86, 0.6 * s, size * 0.86), CFrame = cf * CFrame.new(0, 1.5 * s, 0), Material = Enum.Material.Snow,
						Color = Color3.fromRGB(245, 250, 255), CanCollide = false, CastShadow = false, Parent = F })
				end
			end
		end
		for _, c in ipairs(L.crystals) do
			local col = ({ Color3.fromRGB(110, 220, 255), Color3.fromRGB(170, 140, 255), Color3.fromRGB(140, 255, 230) })[c.hue]
			local main
			for k = 1, 4 do
				local h = vr:NextNumber(3, 7) * c.s
				local cp = part({ Size = Vector3.new(1.1 * c.s, h, 1.1 * c.s), CFrame = CFrame.new(c.x + vr:NextNumber(-1.5, 1.5), h / 2 - 0.3, c.z + vr:NextNumber(-1.5, 1.5))
					* CFrame.Angles(vr:NextNumber(-0.4, 0.4), c.a + k, vr:NextNumber(-0.4, 0.4)), Material = Enum.Material.Glass, Color = col, Transparency = 0.2,
					Reflectance = 0.2, CanCollide = k == 1, Parent = F })
				main = main or cp
			end
			part({ Size = Vector3.new(0.5, 4 * c.s, 0.5), CFrame = CFrame.new(c.x, 2 * c.s, c.z), Material = Enum.Material.Neon, Color = col, CanCollide = false, Parent = F })
			if c.light then make("PointLight", { Range = 14, Brightness = 1.2, Color = col, Shadows = false, Parent = main }) end
		end
		for _, r in ipairs(L.rocks) do
			local cf = CFrame.new(r.x, r.s * 0.25, r.z) * CFrame.Angles(r.t, r.a, r.t * 0.5)
			part({ Size = Vector3.new(r.s, r.s * 0.7, r.s * 1.1), CFrame = cf, Material = Enum.Material.Slate, Color = Color3.fromRGB(110, 120, 136), Parent = F })
			part({ Size = Vector3.new(r.s * 0.9, r.s * 0.2, r.s * 1.0), CFrame = CFrame.new(r.x, r.s * 0.55, r.z) * CFrame.Angles(0, r.a, 0), Material = Enum.Material.Snow,
				Color = Color3.fromRGB(245, 250, 255), CanCollide = false, Parent = F })
		end
		for _, s in ipairs(L.spikes) do
			part({ Size = Vector3.new(1.4, s.h, 1.4), CFrame = CFrame.new(s.x, s.h / 2 - 0.4, s.z) * CFrame.Angles(s.t, s.a, -s.t), Material = Enum.Material.Ice,
				Color = Color3.fromRGB(170, 225, 255), Transparency = 0.2, Parent = F })
			part({ Size = Vector3.new(0.8, s.h * 0.7, 0.8), CFrame = CFrame.new(s.x + 1, s.h * 0.35 - 0.4, s.z) * CFrame.Angles(-s.t, s.a + 1, s.t), Material = Enum.Material.Ice,
				Color = Color3.fromRGB(190, 235, 255), Transparency = 0.2, CanCollide = false, Parent = F })
		end
		for _, g in ipairs(L.igloos) do
			local cf = CFrame.new(g.x, 0, g.z) * CFrame.Angles(0, g.a, 0)
			part({ Shape = BALL, Size = Vector3.new(13, 13, 13), CFrame = cf, Material = Enum.Material.Snow, Color = Color3.fromRGB(235, 244, 252), Parent = F })
			part({ Shape = CYL, Size = Vector3.new(5, 5.4, 5.4), CFrame = cf * CFrame.new(0, 1.6, -6.5) * CFrame.Angles(0, math.pi / 2, 0), Material = Enum.Material.Snow,
				Color = Color3.fromRGB(225, 236, 248), Parent = F })
			part({ Shape = CYL, Size = Vector3.new(0.3, 4, 4), CFrame = cf * CFrame.new(0, 1.6, -9.05) * CFrame.Angles(0, math.pi / 2, 0), Color = Color3.fromRGB(16, 20, 30),
				CanCollide = false, Parent = F })
			for k = 0, 3 do
				part({ Size = Vector3.new(13.2, 0.12, 0.12), CFrame = cf * CFrame.new(0, 1.2 + k * 1.4, 0) * CFrame.Angles(0, k, 0), Material = Enum.Material.Snow,
					Color = Color3.fromRGB(200, 214, 232), CanCollide = false, CastShadow = false, Parent = F })
			end
		end
		for _, m in ipairs(L.snowmen) do -- spooky snowmen with jack-o'-lantern heads
			local p = Vector3.new(m.x, 0, m.z)
			part({ Shape = BALL, Size = Vector3.new(4.2, 4.2, 4.2), Position = p + Vector3.new(0, 1.9, 0), Material = Enum.Material.Snow, Color = Color3.fromRGB(245, 250, 255), Parent = F })
			part({ Shape = BALL, Size = Vector3.new(3.1, 3.1, 3.1), Position = p + Vector3.new(0, 4.8, 0), Material = Enum.Material.Snow, Color = Color3.fromRGB(245, 250, 255), Parent = F })
			pumpkin(F, p + Vector3.new(0, 6.1, 0), 2.4, m.a, true, false, 1)
			for _, sx in ipairs({ -1, 1 }) do
				part({ Size = Vector3.new(0.25, 3, 0.25), CFrame = CFrame.new(p + Vector3.new(0, 5, 0)) * CFrame.Angles(0, m.a, 0) * CFrame.new(sx * 2.2, 0.4, 0) * CFrame.Angles(0, 0, -sx * 1),
					Material = Enum.Material.Wood, Color = Color3.fromRGB(80, 56, 36), CanCollide = false, Parent = F })
			end
		end
		-- aurora in the sky
		local auroraC = { Color3.fromRGB(90, 255, 170), Color3.fromRGB(150, 110, 255), Color3.fromRGB(80, 220, 255) }
		Build.aurora = {}
		for i = 1, 3 do
			local a = part({ Size = Vector3.new(420, 50, 1), CFrame = CFrame.new(O + Vector3.new(-40 + i * 30, 150 + i * 18, -330 + i * 40)) * CFrame.Angles(math.rad(-25), math.rad(-10 + i * 8), 0),
				Material = Enum.Material.Neon, Color = auroraC[i], Transparency = 0.72, CanCollide = false, CastShadow = false, Parent = F })
			table.insert(Build.aurora, a)
		end
		fog(F, O + Vector3.new(0, 0.8, -20), Vector3.new(340, 1, 360), Color3.fromRGB(230, 240, 255), 6)
	end

	------------------------------------------------------------------------------------------ 🌴 JUNGLE
	function Build.jungle()
		local F, L = Folders.jungle, LAYOUT.jungle
		local O = L.o
		edges(F, O, { rock = Color3.fromRGB(78, 88, 66), ground = Color3.fromRGB(64, 104, 46), groundMat = Enum.Material.Grass,
			cap = Color3.fromRGB(60, 120, 50), capMat = Enum.Material.LeafyGrass })
		-- winding mud path
		for lz = 168, -106, -7 do
			local x = O.X + L.pathX(lz)
			part({ Size = Vector3.new(13, 0.2, 8), CFrame = CFrame.new(x, 0.06, O.Z + lz) * CFrame.Angles(0, math.cos(lz / 40) * 0.45, 0), Material = Enum.Material.Mud,
				Color = Color3.fromRGB(100, 80, 56), CanCollide = false, CastShadow = false, Parent = F })
		end
		-- river + waterfall beyond the west wall
		local water = part({ Size = Vector3.new(30, 1, 470), Position = O + Vector3.new(-222, -0.3, -10), Material = Enum.Material.Glass, Color = Color3.fromRGB(50, 150, 140),
			Transparency = 0.3, Reflectance = 0.2, CanCollide = false, Parent = F })
		water.Name = "River"
		local fall = part({ Size = Vector3.new(26, 70, 2), Position = O + Vector3.new(-222, 35, -236), Material = Enum.Material.Glass, Color = Color3.fromRGB(180, 230, 240),
			Transparency = 0.35, CanCollide = false, Parent = F })
		make("ParticleEmitter", { Texture = "rbxasset://textures/particles/smoke_main.dds", Rate = 14, Lifetime = NumberRange.new(1.5, 2.5), Speed = NumberRange.new(3, 6),
			SpreadAngle = Vector2.new(60, 20), Size = NumberSequence.new(5, 10), Color = ColorSequence.new(Color3.fromRGB(240, 250, 255)),
			Transparency = NumberSequence.new(0.6, 1), EmissionDirection = Enum.NormalId.Bottom, Parent = fall })
		Build.waterfall = fall
		-- temple pyramid (boss lair) + arena
		local tc = CFrame.new(O + Vector3.new(0, 0, -196))
		local stoneC = Color3.fromRGB(116, 118, 96)
		for i = 0, 3 do
			part({ Size = Vector3.new(72 - i * 15, 8, 44 - i * 9), CFrame = tc * CFrame.new(0, 4 + i * 8, 0), Material = Enum.Material.Cobblestone, Color = stoneC:Lerp(BLACK, i * 0.04), Parent = F })
			part({ Size = Vector3.new(72 - i * 15 + 0.4, 1, 44 - i * 9 + 0.4), CFrame = tc * CFrame.new(0, 8 + i * 8, 0), Material = Enum.Material.LeafyGrass,
				Color = Color3.fromRGB(70, 120, 50), CanCollide = false, Parent = F })
		end
		for i = 0, 15 do
			part({ Size = Vector3.new(14, 2, 2), CFrame = tc * CFrame.new(0, 1 + i * 2, 22 - i * 1.15), Material = Enum.Material.Slate, Color = stoneC:Lerp(WHITE, 0.08), Parent = F })
		end
		local altar = part({ Size = Vector3.new(8, 4, 8), CFrame = tc * CFrame.new(0, 34, 0), Material = Enum.Material.Neon, Color = Color3.fromRGB(140, 255, 60), Transparency = 0.2, Parent = F })
		make("PointLight", { Range = 40, Brightness = 2.5, Color = altar.Color, Parent = altar })
		make("ParticleEmitter", { Rate = 12, Lifetime = NumberRange.new(1.5, 3), Speed = NumberRange.new(3, 7), SpreadAngle = Vector2.new(20, 20),
			Size = NumberSequence.new(0.5, 0), Color = ColorSequence.new(Color3.fromRGB(140, 255, 60)), LightEmission = 1, Parent = altar })
		for _, x in ipairs({ -1, 1 }) do torch(F, (tc * CFrame.new(x * 9, 1, 26)).Position + Vector3.new(0, 1, 0), true) end
		local A = L.arena
		part({ Shape = CYL, Size = Vector3.new(0.3, A.r * 2, A.r * 2), CFrame = CFrame.new(A.x, 0.12, A.z) * UP, Material = Enum.Material.Cobblestone,
			Color = Color3.fromRGB(110, 110, 92), CanCollide = false, Parent = F })
		for _, r in ipairs(L.ruins) do
			local h = r.broken and r.h * 0.55 or r.h
			part({ Size = Vector3.new(3.2, h, 3.2), CFrame = CFrame.new(r.x, h / 2, r.z) * CFrame.Angles(0, r.a, r.broken and 0.1 or 0), Material = Enum.Material.Cobblestone,
				Color = stoneC, Parent = F })
			part({ Size = Vector3.new(3.8, 0.8, 3.8), Position = Vector3.new(r.x, h + 0.3, r.z), Material = Enum.Material.LeafyGrass, Color = Color3.fromRGB(70, 130, 50), CanCollide = false, Parent = F })
		end
		for _, p in ipairs(L.pillars2) do
			local h = p.h
			part({ Size = Vector3.new(2.8, h, 2.8), CFrame = CFrame.new(p.x, h / 2 - 0.5, p.z) * CFrame.Angles(p.a * 0.3, p.a, p.a * 0.4), Material = Enum.Material.Cobblestone,
				Color = stoneC:Lerp(BLACK, 0.1), Parent = F })
			if p.broken then
				part({ Size = Vector3.new(2.8, 4, 2.8), CFrame = CFrame.new(p.x + 3, 1.2, p.z + 1) * CFrame.Angles(0, p.a, math.pi / 2), Material = Enum.Material.Cobblestone,
					Color = stoneC:Lerp(BLACK, 0.1), Parent = F })
			end
		end
		for _, hd in ipairs(L.heads) do -- giant stone heads
			local cf = CFrame.new(hd.x, 4, hd.z) * CFrame.Angles(0, hd.a, 0)
			part({ Size = Vector3.new(6, 8, 5.5), CFrame = cf, Material = Enum.Material.Slate, Color = Color3.fromRGB(110, 112, 96), Parent = F })
			part({ Size = Vector3.new(6.4, 1.2, 5.9), CFrame = cf * CFrame.new(0, 3.2, 0), Material = Enum.Material.LeafyGrass, Color = Color3.fromRGB(70, 120, 50), CanCollide = false, Parent = F })
			for _, x in ipairs({ -1.4, 1.4 }) do
				part({ Size = Vector3.new(1.4, 0.8, 0.3), CFrame = cf * CFrame.new(x, 1.2, -2.8), Material = Enum.Material.Neon, Color = Color3.fromRGB(140, 255, 60), CanCollide = false, Parent = F })
			end
			part({ Size = Vector3.new(1.4, 2.2, 1), CFrame = cf * CFrame.new(0, -0.2, -3), Material = Enum.Material.Slate, Color = Color3.fromRGB(100, 102, 88), CanCollide = false, Parent = F })
			part({ Size = Vector3.new(3.6, 0.6, 0.3), CFrame = cf * CFrame.new(0, -2, -2.8), Color = Color3.fromRGB(30, 30, 26), CanCollide = false, Parent = F })
		end
		-- big jungle trees
		local leafC = { Color3.fromRGB(46, 110, 40), Color3.fromRGB(56, 126, 44), Color3.fromRGB(40, 96, 46) }
		for _, t in ipairs(L.bigTrees) do
			local s, p = t.s, Vector3.new(t.x, 0, t.z)
			local h = 24 * s
			part({ Shape = CYL, Size = Vector3.new(h, 3 * s, 3 * s), CFrame = CFrame.new(p + Vector3.new(0, h / 2, 0)) * UP, Material = Enum.Material.Wood,
				Color = Color3.fromRGB(96, 74, 52), Parent = F })
			for k = 0, 3 do
				wedge({ Size = Vector3.new(0.8 * s, 4 * s, 3 * s), CFrame = CFrame.new(p) * CFrame.Angles(0, t.a + k * math.pi / 2, 0) * CFrame.new(0, 2 * s, 2.2 * s),
					Material = Enum.Material.Wood, Color = Color3.fromRGB(90, 68, 48), CanCollide = false, Parent = F })
			end
			for k = 1, 4 do
				local size = vr:NextNumber(12, 18) * s
				part({ Shape = BALL, Size = Vector3.new(size, size * 0.45, size),
					Position = p + Vector3.new(vr:NextNumber(-5, 5) * s, h + vr:NextNumber(-2, 3) * s, vr:NextNumber(-5, 5) * s),
					Material = Enum.Material.LeafyGrass, Color = leafC[(k % 3) + 1], CanCollide = false, Parent = F })
			end
			for _ = 1, t.vines do
				local vl = vr:NextNumber(8, 16) * s
				part({ Size = Vector3.new(0.2, vl, 0.2), Position = p + Vector3.new(vr:NextNumber(-6, 6) * s, h - vl / 2, vr:NextNumber(-6, 6) * s), Material = Enum.Material.Grass,
					Color = Color3.fromRGB(60, 110, 40), CanCollide = false, CastShadow = false, Parent = F })
			end
		end
		for _, t in ipairs(L.palms) do
			local s, p = t.s, Vector3.new(t.x, 0, t.z)
			local top = p
			for k = 0, 2 do
				local segH = 5 * s
				local cf = CFrame.new(top) * CFrame.Angles(0, t.a, t.lean * (k + 1)) * CFrame.new(0, segH / 2, 0)
				part({ Size = Vector3.new(0.9 * s, segH, 0.9 * s), CFrame = cf, Material = Enum.Material.Wood, Color = Color3.fromRGB(130, 104, 70), Parent = F })
				top = (cf * CFrame.new(0, segH / 2, 0)).Position
			end
			for k = 0, 6 do
				part({ Size = Vector3.new(1.8 * s, 0.15, 7 * s), CFrame = CFrame.new(top) * CFrame.Angles(0, k / 7 * math.pi * 2, 0) * CFrame.Angles(math.rad(-25), 0, 0) * CFrame.new(0, 0, -3.2 * s),
					Material = Enum.Material.LeafyGrass, Color = Color3.fromRGB(60, 140, 50), CanCollide = false, CastShadow = false, Parent = F })
			end
			for k = 0, 2 do
				part({ Shape = BALL, Size = Vector3.new(0.8, 0.8, 0.8) * s, Position = top + Vector3.new(math.cos(k * 2) * 0.6, -0.5, math.sin(k * 2) * 0.6), Color = Color3.fromRGB(110, 76, 40),
					CanCollide = false, Parent = F })
			end
		end
		-- ferns + flowers (looks only)
		for _ = 1, 90 do
			local lx, lz = vr:NextNumber(-184, 184), vr:NextNumber(-160, 160)
			if not L.blocked(lx, lz, 1) then
				local p = O + Vector3.new(lx, 0, lz)
				for k = 0, 2 do
					wedge({ Size = Vector3.new(0.1, 1.6, 3.2), CFrame = CFrame.new(p) * CFrame.Angles(0, k * 2.1 + lx, 0) * CFrame.new(0, 0.8, -1.4) * CFrame.Angles(math.rad(20), 0, 0),
						Material = Enum.Material.LeafyGrass, Color = leafC[k + 1], CanCollide = false, CastShadow = false, Parent = F })
				end
			end
		end
		local flowerC = { Color3.fromRGB(255, 80, 120), Color3.fromRGB(255, 200, 40), Color3.fromRGB(200, 90, 255), Color3.fromRGB(255, 120, 40) }
		for _ = 1, 60 do
			local lx, lz = vr:NextNumber(-184, 184), vr:NextNumber(-160, 160)
			if not L.blocked(lx, lz, 0) then
				part({ Shape = BALL, Size = Vector3.new(0.9, 0.5, 0.9), Position = O + Vector3.new(lx, 0.6, lz), Material = Enum.Material.SmoothPlastic, Color = vpick(flowerC),
					CanCollide = false, CastShadow = false, Parent = F })
			end
		end
		-- toxic pools + gas / toxic barrels
		for i, pl in ipairs(L.pools) do
			local pool = part({ Shape = CYL, Size = Vector3.new(0.3, pl.r * 2, pl.r * 2), CFrame = CFrame.new(pl.x, 0.1, pl.z) * UP, Material = Enum.Material.Neon,
				Color = Color3.fromRGB(110, 230, 50), Transparency = 0.25, CanCollide = false, Parent = F })
			make("ParticleEmitter", { Rate = 3, Lifetime = NumberRange.new(0.6, 1.2), Speed = NumberRange.new(1, 2), SpreadAngle = Vector2.new(15, 15),
				Size = NumberSequence.new(0.4, 0), Color = ColorSequence.new(Color3.fromRGB(160, 255, 80)), LightEmission = 0.6, Parent = pool })
			if i % 2 == 1 then make("PointLight", { Range = 14, Brightness = 1.2, Color = pool.Color, Shadows = false, Parent = pool }) end
		end
		for _, b in ipairs(L.barrels) do
			local cf = CFrame.new(b.x, b.tipped and 0.9 or 1.4, b.z) * CFrame.Angles(0, b.a, b.tipped and 0 or math.pi / 2)
			local bar = part({ Shape = CYL, Size = Vector3.new(2.8, 1.9, 1.9), CFrame = cf, Material = Enum.Material.Metal,
				Color = b.toxic and Color3.fromRGB(220, 190, 40) or Color3.fromRGB(190, 40, 34), Parent = F })
			part({ Shape = CYL, Size = Vector3.new(0.4, 1.95, 1.95), CFrame = cf, Material = b.toxic and Enum.Material.Neon or Enum.Material.Metal,
				Color = b.toxic and Color3.fromRGB(140, 255, 60) or Color3.fromRGB(30, 30, 30), CanCollide = false, Parent = F })
			if b.tipped and b.toxic then
				part({ Shape = CYL, Size = Vector3.new(0.15, 4, 4), CFrame = CFrame.new(b.x + 2, 0.08, b.z) * UP, Material = Enum.Material.Neon, Color = Color3.fromRGB(120, 240, 50),
					Transparency = 0.3, CanCollide = false, Parent = F })
			end
			bar.Name = b.toxic and "ToxicBarrel" or "GasBarrel"
		end
		fireflies(F, O + Vector3.new(0, 5, 0), Vector3.new(360, 8, 360), Color3.fromRGB(220, 255, 120), 10)
		fog(F, O + Vector3.new(0, 0.8, -40), Vector3.new(340, 1, 320), Color3.fromRGB(190, 230, 170), 6)
	end
end

------------------------------------------------------------------------------------------------
-- UI  (chunky Grow-a-Garden style: bubbly FredokaOne text with thick black outlines,
--      light grey + black panels, big squishy buttons)
------------------------------------------------------------------------------------------------
local playerGui = player:WaitForChild("PlayerGui")
for _, n in ipairs({ "FH2_HUD", "FH2_Intro", "FH2_Gus", "FH2_FX", "FH2_Touch", "FH2_Menus", "ForestHunt_HUD", "ForestHunt_Intro", "ForestHunt_Gus", "ForestHunt_FX", "ForestHunt_Touch" }) do
	local old = playerGui:FindFirstChild(n)
	if old then old:Destroy() end
end

local UI = {
	FONT = Enum.Font.FredokaOne,
	PANEL = Color3.fromRGB(214, 214, 220),   -- light grey
	PANEL2 = Color3.fromRGB(184, 184, 192),  -- mid grey
	PANEL3 = Color3.fromRGB(156, 156, 166),
	DARK = Color3.fromRGB(30, 30, 34),       -- black-ish
	INK = Color3.fromRGB(10, 10, 12),
	GREEN = Color3.fromRGB(92, 200, 92),
	RED = Color3.fromRGB(226, 72, 72),
}
do
	function UI.corner(p, r) return make("UICorner", { CornerRadius = UDim.new(0, r or 12), Parent = p }) end
	function UI.stroke(p, t, c, tr)
		return make("UIStroke", { Thickness = t or 3, Color = c or UI.INK, Transparency = tr or 0, ApplyStrokeMode = Enum.ApplyStrokeMode.Border, Parent = p })
	end
	-- bubbly text with a thick black outline
	function UI.text(props)
		local class = props.Class or "TextLabel"
		props.Class = nil
		local maxT, strokeT, strokeC = props.MaxText, props.Stroke, props.StrokeColor
		props.MaxText, props.Stroke, props.StrokeColor = nil, nil, nil
		if props.BackgroundTransparency == nil then props.BackgroundTransparency = 1 end
		if props.Font == nil then props.Font = UI.FONT end
		if props.TextColor3 == nil then props.TextColor3 = WHITE end
		if props.TextScaled == nil then props.TextScaled = true end
		local l = make(class, props)
		if maxT then make("UITextSizeConstraint", { MaxTextSize = maxT, Parent = l }) end
		if strokeT ~= 0 then
			make("UIStroke", { Thickness = strokeT or 2, Color = strokeC or UI.INK, ApplyStrokeMode = Enum.ApplyStrokeMode.Contextual, Parent = l })
		end
		return l
	end
	function UI.panel(props)
		if props.BackgroundColor3 == nil then props.BackgroundColor3 = UI.PANEL end
		local f = make("Frame", props)
		UI.corner(f, 16)
		UI.stroke(f, 3.5)
		make("UIGradient", { Rotation = 90, Color = ColorSequence.new(WHITE, Color3.fromRGB(205, 205, 212)), Parent = f })
		return f
	end
	-- chunky button: black "shadow" base + grey face + outlined label. Returns face (TextButton), label, holder
	function UI.button(props)
		local text, color, size, pos, anchor, parent, order = props.Text, props.Color or UI.PANEL2, props.Size, props.Position, props.AnchorPoint, props.Parent, props.LayoutOrder
		local holder = make("Frame", { Size = size, Position = pos or UDim2.new(), AnchorPoint = anchor or Vector2.zero, BackgroundTransparency = 1,
			LayoutOrder = order or 0, Parent = parent })
		local shadow = make("Frame", { Size = UDim2.new(1, 0, 1, -2), Position = UDim2.fromOffset(0, 4), BackgroundColor3 = UI.INK, Parent = holder })
		UI.corner(shadow, props.Radius or 12)
		local face = make("TextButton", { Name = "Face", Size = UDim2.new(1, 0, 1, -4), BackgroundColor3 = color, Text = "", AutoButtonColor = false, Parent = holder })
		UI.corner(face, props.Radius or 12)
		UI.stroke(face, 3)
		make("UIGradient", { Rotation = 90, Color = ColorSequence.new(WHITE, Color3.fromRGB(200, 200, 200)), Parent = face })
		local label = UI.text({ Text = text or "", Size = UDim2.new(1, -12, 1, -6), Position = UDim2.fromOffset(6, 3), MaxText = props.MaxText or 26,
			TextColor3 = props.TextColor3 or WHITE, Stroke = 2.4, Parent = face })
		local sc = make("UIScale", { Parent = holder })
		face.MouseButton1Down:Connect(function()
			tween(sc, 0.06, { Scale = 0.92 })
			face.Position = UDim2.fromOffset(0, 2)
		end)
		local function up()
			tween(sc, 0.18, { Scale = 1 }, Enum.EasingStyle.Back)
			face.Position = UDim2.new()
		end
		face.MouseButton1Up:Connect(up)
		face.MouseLeave:Connect(up)
		face.MouseEnter:Connect(function() tween(sc, 0.12, { Scale = 1.04 }) end)
		return face, label, holder
	end
	function UI.pill(parent, size, pos, anchor)
		local f = make("Frame", { Size = size, Position = pos, AnchorPoint = anchor or Vector2.zero, BackgroundColor3 = UI.DARK, BackgroundTransparency = 0.05, Parent = parent })
		UI.corner(f, 14)
		UI.stroke(f, 3, UI.INK)
		make("UIGradient", { Rotation = 90, Color = ColorSequence.new(Color3.fromRGB(70, 70, 78), Color3.fromRGB(26, 26, 30)), Parent = f })
		return f
	end
	function UI.icon(parent, emoji, color, size)
		local b = make("Frame", { Size = UDim2.fromOffset(size or 34, size or 34), Position = UDim2.fromOffset(4, 4), BackgroundColor3 = color, Parent = parent })
		UI.corner(b, 10)
		UI.stroke(b, 2.5)
		UI.text({ Text = emoji, Size = UDim2.fromScale(0.8, 0.8), Position = UDim2.fromScale(0.1, 0.1), Stroke = 0, Parent = b })
		return b
	end
end

------------------------------------------------------------------------------------------------ HUD
local hudGui = make("ScreenGui", { Name = "FH2_HUD", ResetOnSpawn = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, DisplayOrder = 5, Enabled = false, Parent = playerGui })
local HUD = {}
do
	local root = make("Frame", { Name = "Root", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Parent = hudGui })
	HUD.root = root
	-- top right: coins / candies / kills
	local tr = make("Frame", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -12, 0, 10), Size = UDim2.fromOffset(200, 150), BackgroundTransparency = 1, Parent = root })
	make("UIListLayout", { Padding = UDim.new(0, 8), HorizontalAlignment = Enum.HorizontalAlignment.Right, SortOrder = Enum.SortOrder.LayoutOrder, Parent = tr })
	local function stat(order, emoji, col, width)
		local p = UI.pill(tr, UDim2.fromOffset(width or 190, 42), UDim2.new())
		p.LayoutOrder = order
		UI.icon(p, emoji, col, 34)
		local l = UI.text({ Text = "0", Position = UDim2.fromOffset(46, 5), Size = UDim2.new(1, -54, 1, -10), TextXAlignment = Enum.TextXAlignment.Left, Stroke = 2.4, Parent = p })
		return p, l, make("UIScale", { Parent = p })
	end
	HUD.coinPill, HUD.coinLabel, HUD.coinScale = stat(1, "💰", GOLD)
	HUD.candyPill, HUD.candyLabel, HUD.candyScale = stat(2, "🍬", CANDY)
	local cbar = make("Frame", { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 46, 1, -5), Size = UDim2.new(1, -56, 0, 5), BackgroundColor3 = UI.INK, Parent = HUD.candyPill })
	UI.corner(cbar, 3)
	HUD.candyFill = make("Frame", { Size = UDim2.fromScale(0, 1), BackgroundColor3 = CANDY, Parent = cbar })
	UI.corner(HUD.candyFill, 3)
	HUD.killPill, HUD.killLabel, HUD.killScale = stat(3, "💀", Color3.fromRGB(200, 200, 210), 150)

	-- top centre: 🎃 2X event banner + boss timer + boss health
	local tc = make("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 6), Size = UDim2.fromOffset(330, 140), BackgroundTransparency = 1, Parent = root })
	local banner = UI.pill(tc, UDim2.fromOffset(300, 38), UDim2.new(0.5, 0, 0, 0), Vector2.new(0.5, 0))
	banner.BackgroundColor3 = Color3.fromRGB(30, 18, 8)
	HUD.bannerText = UI.text({ Text = "🎃 2X HALLOWEEN EVENT 🎃", Size = UDim2.new(1, -16, 1, -8), Position = UDim2.fromOffset(8, 4), TextColor3 = Color3.fromRGB(255, 160, 40),
		Stroke = 2.4, Parent = banner })
	HUD.bannerScale = make("UIScale", { Parent = banner })
	local bt = UI.pill(tc, UDim2.fromOffset(220, 30), UDim2.new(0.5, 0, 0, 44), Vector2.new(0.5, 0))
	HUD.bossTimer = UI.text({ Text = "👹 Boss in 10:00", Size = UDim2.new(1, -12, 1, -6), Position = UDim2.fromOffset(6, 3), Stroke = 2, Parent = bt })
	HUD.bossTimerPill = bt
	local bb = UI.panel({ AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 82), Size = UDim2.fromOffset(330, 50), Visible = false, Parent = tc })
	HUD.bossName = UI.text({ Text = "BOSS", Size = UDim2.new(1, -16, 0, 20), Position = UDim2.fromOffset(8, 3), Stroke = 2.4, Parent = bb })
	local bback = make("Frame", { Position = UDim2.fromOffset(10, 26), Size = UDim2.new(1, -20, 0, 16), BackgroundColor3 = UI.INK, Parent = bb })
	UI.corner(bback, 8)
	HUD.bossFill = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(220, 50, 60), Parent = bback })
	UI.corner(HUD.bossFill, 8)
	make("UIGradient", { Rotation = 90, Color = ColorSequence.new(Color3.fromRGB(255, 120, 110), Color3.fromRGB(180, 20, 40)), Parent = HUD.bossFill })
	HUD.bossHpText = UI.text({ Text = "", Size = UDim2.fromScale(1, 1), Stroke = 1.6, ZIndex = 3, Parent = bback })
	HUD.bossBar = bb

	-- top left: where you are + menu buttons
	local tl = make("Frame", { Position = UDim2.fromOffset(12, 10), Size = UDim2.fromOffset(240, 300), BackgroundTransparency = 1, Parent = root })
	local wp = UI.pill(tl, UDim2.fromOffset(230, 36), UDim2.new())
	HUD.worldLabel = UI.text({ Text = "🕯 THE CAVE", Size = UDim2.new(1, -14, 1, -8), Position = UDim2.fromOffset(7, 4), TextXAlignment = Enum.TextXAlignment.Left, Stroke = 2.2, Parent = wp })
	HUD.menuButtons = {}
	local menus = { { "worlds", "🗺", "Worlds" }, { "swords", "⚔", "Swords" }, { "settings", "⚙", "Settings" } }
	for i, m in ipairs(menus) do
		local face, label = UI.button({ Text = "", Size = UDim2.fromOffset(64, 64), Position = UDim2.fromOffset((i - 1) * 72, 46), Color = UI.PANEL, Parent = tl })
		label.Text = m[2]
		label.Size = UDim2.new(1, -12, 0.62, 0)
		UI.text({ Text = m[3], Size = UDim2.new(1, -4, 0.3, 0), Position = UDim2.new(0, 2, 0.66, 0), Stroke = 2, MaxText = 14, Parent = face })
		HUD.menuButtons[m[1]] = face
	end

	-- bottom centre: health bar + status icons
	local bc = make("Frame", { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -14), Size = UDim2.fromOffset(360, 64), BackgroundTransparency = 1, Parent = root })
	local hpBack = make("Frame", { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, 0), Size = UDim2.new(1, 0, 0, 32), BackgroundColor3 = UI.DARK, Parent = bc })
	UI.corner(hpBack, 12)
	UI.stroke(hpBack, 3.5)
	HUD.hpLag = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(255, 240, 240), BackgroundTransparency = 0.3, Parent = hpBack })
	UI.corner(HUD.hpLag, 12)
	HUD.hpFill = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = WHITE, Parent = hpBack })
	UI.corner(HUD.hpFill, 12)
	HUD.hpGrad = make("UIGradient", { Rotation = 90, Color = ColorSequence.new(Color3.fromRGB(120, 230, 110), Color3.fromRGB(40, 160, 60)), Parent = HUD.hpFill })
	HUD.hpText = UI.text({ Text = "❤ 100 / 100", Size = UDim2.new(1, -10, 1, -6), Position = UDim2.fromOffset(5, 3), Stroke = 2.4, ZIndex = 3, Parent = hpBack })
	HUD.hpBack = hpBack
	HUD.status = UI.text({ Text = "", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 0), Size = UDim2.new(1, 0, 0, 26), Stroke = 2.2, Parent = bc })

	-- bottom left: PC keys
	HUD.keys = UI.text({ Text = "🖱 Click / F  Swing   ·   Shift  Sprint   ·   Q  Dash   ·   E  Talk\n1-5  Swords   ·   M  Worlds   ·   G  Sword bag   ·   H  Home",
		AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 12, 1, -10), Size = UDim2.fromOffset(420, 38), TextXAlignment = Enum.TextXAlignment.Left,
		TextColor3 = Color3.fromRGB(230, 230, 235), Stroke = 1.6, MaxText = 14, Parent = root })

	-- toasts
	HUD.toasts = make("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0.2, 0), Size = UDim2.fromOffset(460, 220), BackgroundTransparency = 1, Parent = root })
	make("UIListLayout", { Padding = UDim.new(0, 6), HorizontalAlignment = Enum.HorizontalAlignment.Center, SortOrder = Enum.SortOrder.LayoutOrder, Parent = HUD.toasts })
end

local toastN = 0
local function toast(msg, color, hold)
	toastN += 1
	local p = UI.pill(HUD.toasts, UDim2.fromOffset(440, 40), UDim2.new())
	p.LayoutOrder = toastN
	local l = UI.text({ Text = msg, Size = UDim2.new(1, -16, 1, -8), Position = UDim2.fromOffset(8, 4), TextColor3 = color or WHITE, Stroke = 2.2, Parent = p })
	local sc = make("UIScale", { Scale = 0.6, Parent = p })
	tween(sc, 0.25, { Scale = 1 }, Enum.EasingStyle.Back)
	local kids = {}
	for _, c in ipairs(HUD.toasts:GetChildren()) do
		if c:IsA("Frame") then table.insert(kids, c) end
	end
	if #kids > 4 then kids[1]:Destroy() end
	task.delay(hold or 3, function()
		if not p.Parent then return end
		tween(sc, 0.2, { Scale = 0 })
		tween(l, 0.2, { TextTransparency = 1 })
		task.wait(0.22)
		p:Destroy()
	end)
end

------------------------------------------------------------------------------------------------ big celebration popup
local fxGui = make("ScreenGui", { Name = "FH2_FX", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 40, Parent = playerGui })
local Celebrate = {}
do
	local holder = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.4), Size = UDim2.fromScale(0.8, 0.22), BackgroundTransparency = 1,
		Visible = false, Parent = fxGui })
	Celebrate.title = UI.text({ Text = "", Size = UDim2.fromScale(1, 0.62), Stroke = 4, Parent = holder })
	Celebrate.sub = UI.text({ Text = "", Position = UDim2.fromScale(0, 0.64), Size = UDim2.fromScale(1, 0.3), Stroke = 2.6, Parent = holder })
	Celebrate.scale = make("UIScale", { Parent = holder })
	Celebrate.holder = holder
	local token = 0
	function Celebrate.show(title, sub, color, hold)
		token += 1
		local my = token
		holder.Visible = true
		Celebrate.title.Text, Celebrate.sub.Text = title, sub or ""
		Celebrate.title.TextColor3 = color or GOLD
		Celebrate.title.TextTransparency, Celebrate.sub.TextTransparency = 0, 0
		Celebrate.scale.Scale = 0.3
		tween(Celebrate.scale, 0.45, { Scale = 1 }, Enum.EasingStyle.Back)
		for _ = 1, 26 do -- confetti
			local c = make("Frame", { Size = UDim2.fromOffset(10, 16), Position = UDim2.fromScale(0.5, 0.42), Rotation = rng:NextNumber(0, 360),
				BackgroundColor3 = pick({ CANDY, GOLD, Color3.fromRGB(170, 90, 255), Color3.fromRGB(120, 230, 90), WHITE }), Parent = fxGui })
			UI.corner(c, 3)
			tween(c, rng:NextNumber(0.9, 1.6), { Position = UDim2.fromScale(rng:NextNumber(0.1, 0.9), rng:NextNumber(0.75, 1.1)), Rotation = rng:NextNumber(-720, 720) },
				Enum.EasingStyle.Quad, Enum.EasingDirection.In)
			Debris:AddItem(c, 1.7)
		end
		task.delay(hold or 3, function()
			if my ~= token then return end
			tween(Celebrate.title, 0.4, { TextTransparency = 1 })
			tween(Celebrate.sub, 0.4, { TextTransparency = 1 })
			task.wait(0.42)
			if my == token then holder.Visible = false end
		end)
	end
end

------------------------------------------------------------------------------------------------ death screen + fade
local Death = {}
do
	Death.frame = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(10, 40, 12), BackgroundTransparency = 1, Parent = fxGui })
	Death.title = UI.text({ Text = "YOU BECAME A ZOMBIE! 🧟", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.42), Size = UDim2.fromScale(0.86, 0.12),
		TextColor3 = Color3.fromRGB(140, 255, 110), TextTransparency = 1, Stroke = 4, Parent = Death.frame })
	Death.sub = UI.text({ Text = "", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.52), Size = UDim2.fromScale(0.8, 0.05),
		TextTransparency = 1, Stroke = 2.4, Parent = Death.frame })
	for _, l in ipairs({ Death.title, Death.sub }) do
		local st = l:FindFirstChildOfClass("UIStroke")
		if st then st.Transparency = 1 end
	end
end
local fadeFrame = make("Frame", { Name = "Fade", Size = UDim2.fromScale(1, 1), BackgroundColor3 = BLACK, BackgroundTransparency = 1, ZIndex = 50, Parent = fxGui })
local function textFade(l, to, t)
	tween(l, t, { TextTransparency = to })
	local st = l:FindFirstChildOfClass("UIStroke")
	if st then tween(st, t, { Transparency = to }) end
end

------------------------------------------------------------------------------------------------ intro screen
local introGui = make("ScreenGui", { Name = "FH2_Intro", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 50, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, Parent = playerGui })
local Intro = {}
do
	local bg = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(14, 14, 16), Parent = introGui })
	make("UIGradient", { Rotation = 90, Color = ColorSequence.new(Color3.fromRGB(60, 60, 66), Color3.fromRGB(8, 8, 10)), Parent = bg })
	Intro.bg = bg
	local box = make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromScale(0.94, 0.94), BackgroundTransparency = 1, Parent = bg })
	make("UISizeConstraint", { MaxSize = Vector2.new(680, 470), Parent = box })
	Intro.box = box
	Intro.title = UI.text({ Text = "FOREST HUNT", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0), Size = UDim2.fromScale(0.86, 0.18), Stroke = 5, Parent = box })
	make("UIGradient", { Rotation = 90, Color = ColorSequence.new(Color3.fromRGB(255, 255, 255), Color3.fromRGB(190, 190, 200)), Parent = Intro.title })
	local ver = UI.pill(box, UDim2.fromOffset(84, 34), UDim2.new(0.5, 0, 0.17, 0), Vector2.new(0.5, 0))
	ver.Rotation = -4
	UI.text({ Text = "2.0", Size = UDim2.new(1, -10, 1, -6), Position = UDim2.fromOffset(5, 3), TextColor3 = GOLD, Stroke = 2.4, Parent = ver })
	local ev = UI.text({ Text = "🎃 HALLOWEEN 2X EVENT 🎃", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0.26), Size = UDim2.fromScale(0.8, 0.07),
		TextColor3 = Color3.fromRGB(255, 150, 40), Stroke = 3, Parent = box })
	Intro.event = ev
	local card = UI.panel({ AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0.35), Size = UDim2.fromScale(0.98, 0.36), Parent = box })
	local news = {
		"🕯 Start in a glowing cave, then head OUTSIDE to fight",
		"⚰ Graveyard  ·  ❄ Ice World (3X)  ·  🌴 Jungle (4X)",
		"🍬 Collect 100 candies → PUMPKIN OVERNIGHT SWORD",
		"👹 A boss rises every 10 minutes — team up with friends!",
		"🧟 If you die... YOU become a zombie",
	}
	local list = make("Frame", { Position = UDim2.fromScale(0.04, 0.08), Size = UDim2.fromScale(0.92, 0.84), BackgroundTransparency = 1, Parent = card })
	make("UIListLayout", { Padding = UDim.new(0.02, 0), Parent = list })
	for _, n in ipairs(news) do
		UI.text({ Text = n, Size = UDim2.fromScale(1, 0.18), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = UI.DARK, Stroke = 0, MaxText = 22, Parent = list })
	end
	local barBack = make("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0.75), Size = UDim2.new(0.66, 0, 0, 16), BackgroundColor3 = UI.DARK, Parent = box })
	UI.corner(barBack, 8)
	UI.stroke(barBack, 2.5)
	Intro.barBack = barBack
	Intro.barFill = make("Frame", { Size = UDim2.fromScale(0, 1), BackgroundColor3 = UI.PANEL, Parent = barBack })
	UI.corner(Intro.barFill, 8)
	Intro.status = UI.text({ Text = "Digging the cave...", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0.75, 20), Size = UDim2.new(0.7, 0, 0, 20),
		TextColor3 = Color3.fromRGB(220, 220, 226), Stroke = 2, Parent = box })
	local play, playLabel, playHolder = UI.button({ Text = "▶  PLAY", Size = UDim2.fromScale(0.42, 0.15), Position = UDim2.fromScale(0.5, 0.83), AnchorPoint = Vector2.new(0.5, 0),
		Color = UI.PANEL, MaxText = 40, Parent = box })
	playHolder.Visible = false
	playLabel.TextColor3 = WHITE
	Intro.play, Intro.playHolder = play, playHolder
	Intro.playScale = make("UIScale", { Parent = play })
	Intro.fade = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = BLACK, BackgroundTransparency = 1, ZIndex = 20, Parent = introGui })
end

------------------------------------------------------------------------------------------------ menus: worlds · swords · settings
local menuGui = make("ScreenGui", { Name = "FH2_Menus", ResetOnSpawn = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, DisplayOrder = 15, Parent = playerGui })
local Menu = { open = nil }
do
	local function shell(title)
		local p = UI.panel({ AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.52), Size = UDim2.fromScale(0.92, 0.78), Visible = false, Parent = menuGui })
		make("UISizeConstraint", { MaxSize = Vector2.new(640, 440), Parent = p })
		local head = make("Frame", { Size = UDim2.new(1, 0, 0, 50), BackgroundColor3 = UI.DARK, Parent = p })
		UI.corner(head, 16)
		make("Frame", { Position = UDim2.new(0, 0, 1, -16), Size = UDim2.new(1, 0, 0, 16), BackgroundColor3 = UI.DARK, BorderSizePixel = 0, Parent = head })
		UI.text({ Text = title, Position = UDim2.fromOffset(16, 6), Size = UDim2.new(1, -80, 1, -12), TextXAlignment = Enum.TextXAlignment.Left, Stroke = 2.6, Parent = head })
		local close = UI.button({ Text = "✕", Size = UDim2.fromOffset(42, 42), Position = UDim2.new(1, -8, 0, 4), AnchorPoint = Vector2.new(1, 0), Color = UI.RED, Parent = p })
		local list = make("ScrollingFrame", { Position = UDim2.fromOffset(12, 60), Size = UDim2.new(1, -24, 1, -72), BackgroundTransparency = 1, BorderSizePixel = 0,
			ScrollBarThickness = 6, ScrollBarImageColor3 = UI.DARK, CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y,
			ScrollingDirection = Enum.ScrollingDirection.Y, Parent = p })
		make("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder, Parent = list })
		make("UIPadding", { PaddingRight = UDim.new(0, 8), PaddingBottom = UDim.new(0, 8), PaddingTop = UDim.new(0, 2), Parent = list })
		local sc = make("UIScale", { Parent = p })
		return { panel = p, list = list, close = close, scale = sc }
	end
	Menu.worlds = shell("🗺  WORLDS")
	Menu.swords = shell("⚔  SWORD BAG")
	Menu.settings = shell("⚙  SETTINGS")
	function Menu.row(list, height, order)
		local r = make("Frame", { Size = UDim2.new(1, 0, 0, height), BackgroundColor3 = WHITE, LayoutOrder = order, Parent = list })
		UI.corner(r, 12)
		UI.stroke(r, 2.5)
		make("UIGradient", { Rotation = 90, Color = ColorSequence.new(Color3.fromRGB(236, 236, 240), Color3.fromRGB(196, 196, 204)), Parent = r })
		return r
	end
	function Menu.clear(m)
		for _, c in ipairs(m.list:GetChildren()) do
			if c:IsA("GuiObject") then c:Destroy() end
		end
	end
end

------------------------------------------------------------------------------------------------ Gus's talk panel
local Dlg = {}
do
	local gui = make("ScreenGui", { Name = "FH2_Gus", ResetOnSpawn = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, DisplayOrder = 20, Parent = playerGui })
	local panel = UI.panel({ AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -12), Size = UDim2.new(0.96, 0, 0.62, 0), Visible = false, Parent = gui })
	make("UISizeConstraint", { MaxSize = Vector2.new(800, 320), MinSize = Vector2.new(300, 200), Parent = panel })
	Dlg.panel = panel
	Dlg.scale = make("UIScale", { Parent = panel })
	local left = make("Frame", { Position = UDim2.fromOffset(14, 12), Size = UDim2.new(0.42, -18, 1, -24), BackgroundTransparency = 1, Parent = panel })
	local port = make("ViewportFrame", { Size = UDim2.fromOffset(78, 78), BackgroundColor3 = UI.DARK, Ambient = Color3.fromRGB(170, 160, 150),
		LightColor = Color3.fromRGB(255, 236, 210), LightDirection = Vector3.new(-1, -1, -1), Parent = left })
	UI.corner(port, 16)
	UI.stroke(port, 3)
	Dlg.port = port
	UI.text({ Text = "GUS", Position = UDim2.fromOffset(90, 0), Size = UDim2.new(1, -90, 0, 32), TextXAlignment = Enum.TextXAlignment.Left, Stroke = 2.6, MaxText = 30, Parent = left })
	UI.text({ Text = "Cave Trader · Sword Shop", Position = UDim2.fromOffset(90, 32), Size = UDim2.new(1, -90, 0, 18), TextXAlignment = Enum.TextXAlignment.Left,
		TextColor3 = UI.DARK, Stroke = 0, MaxText = 16, Parent = left })
	local cp = UI.pill(left, UDim2.fromOffset(120, 26), UDim2.fromOffset(90, 54))
	Dlg.coins = UI.text({ Text = "💰 0", Size = UDim2.new(1, -8, 1, -4), Position = UDim2.fromOffset(4, 2), TextColor3 = GOLD, Stroke = 2, Parent = cp })
	local bubble = make("Frame", { Position = UDim2.fromOffset(0, 90), Size = UDim2.new(1, 0, 1, -90), BackgroundColor3 = WHITE, Parent = left })
	UI.corner(bubble, 12)
	UI.stroke(bubble, 2.5)
	Dlg.say = UI.text({ Text = "", Position = UDim2.fromOffset(10, 8), Size = UDim2.new(1, -20, 1, -16), TextColor3 = UI.DARK, Stroke = 0, TextXAlignment = Enum.TextXAlignment.Left,
		TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true, MaxText = 18, Parent = bubble })
	Dlg.header = UI.text({ Text = "", AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -60, 0, 12), Size = UDim2.new(0.58, -54, 0, 28), TextXAlignment = Enum.TextXAlignment.Left,
		Stroke = 2.4, MaxText = 22, Parent = panel })
	local list = make("ScrollingFrame", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -12, 0, 52), Size = UDim2.new(0.58, -12, 1, -62),
		BackgroundTransparency = 1, BorderSizePixel = 0, ScrollBarThickness = 6, ScrollBarImageColor3 = UI.DARK, CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollingDirection = Enum.ScrollingDirection.Y, Parent = panel })
	make("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder, Parent = list })
	make("UIPadding", { PaddingRight = UDim.new(0, 8), PaddingBottom = UDim.new(0, 8), PaddingTop = UDim.new(0, 2), Parent = list })
	Dlg.list = list
	Dlg.close = UI.button({ Text = "✕", Size = UDim2.fromOffset(42, 42), Position = UDim2.new(1, -10, 0, 6), AnchorPoint = Vector2.new(1, 0), Color = UI.RED, Parent = panel })
end

-- hide Roblox's own health bar, backpack bar and emote wheel
task.spawn(function()
	for _ = 1, 30 do
		local ok = pcall(function()
			StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Health, false)
			StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
			StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.EmotesMenu, false)
		end)
		if ok then break end
		task.wait(0.5)
	end
end)

------------------------------------------------------------------------------------------------
-- PLAYER STATE
------------------------------------------------------------------------------------------------
local S = {
	coins = 0, candies = 0, kills = 0, owned = { rusty = true }, equipped = "rusty",
	levels = { damage = 0, speed = 0, range = 0, health = 0 }, pumpkin = false,
	music = true, sfx = true, gfx = "high", talked = false,
	hp = 100, lagHP = 1, dead = false, playing = false, talking = false, lastHurt = -10, iframes = 0,
	world = "cave", traveling = false, sprint = false, dashUntil = 0, dashCool = 0,
	chillUntil = 0, burnUntil = 0, burnTick = 0, burnDmg = 0, sickUntil = 0, sickTick = 0, sickDmg = 0,
	dirty = false, canSave = false, shownCoins = 0, fov = 70,
}
local function swordDef() return SWORD_BY_ID[S.equipped] or SWORDS[1] end
local function maxHP() return 100 + UPG_BY_ID.health.step * S.levels.health end
local function getStats()
	local d = swordDef()
	return {
		def = d,
		dmg = d.dmg * (1 + UPG_BY_ID.damage.step * S.levels.damage),
		speed = d.speed * (1 + UPG_BY_ID.speed.step * S.levels.speed),
		reach = d.reach + UPG_BY_ID.range.step * S.levels.range,
		crit = (d.id == "pumpkin") and 0.3 or 0.15,
	}
end
local function worldUnlocked(wid)
	local w = WORLDS[wid]
	return w ~= nil and S.kills >= (w.need or 0)
end
local function markDirty() S.dirty = true end

local function profileOut()
	return { coins = S.coins, candies = S.candies, kills = S.kills, owned = S.owned, equipped = S.equipped, levels = S.levels,
		pumpkin = S.pumpkin, music = S.music, sfx = S.sfx, gfx = S.gfx, talked = S.talked }
end

------------------------------------------------------------------------------------------------
-- NETWORK LINK  (multiplayer when the server copy exists, otherwise everything runs right here)
------------------------------------------------------------------------------------------------
local Link = { coop = false }
local On = {} -- message handlers (server → you)
do
	if not game:IsLoaded() then game.Loaded:Wait() end
	local net = ReplicatedStorage:FindFirstChild(NET_NAME) or ReplicatedStorage:WaitForChild(NET_NAME, 2.5)
	if net and net:FindFirstChild("Ev") then
		Link.coop = true
		Link.net = net
		Link.ev = net:FindFirstChild("Ev")
		Link.snap = net:WaitForChild("Snap", 5)
	end
	function Link.send(msg, ...)
		if Link.coop then Link.ev:FireServer(msg, ...) end
	end
	function Link.dispatch(msg, ...)
		local h = On[msg]
		if h then
			local ok, err = pcall(h, ...)
			if not ok then warn("[Forest Hunt 2.0] " .. tostring(msg) .. ": " .. tostring(err)) end
		end
	end
	if Link.coop then
		Link.ev.OnClientEvent:Connect(function(msg, ...) Link.dispatch(msg, ...) end)
	else
		-- solo: the monster brain runs on this device and talks to us directly
		Sim.out = function(scope, msg, ...)
			if type(scope) == "table" then
				if scope.key and scope.key ~= player.UserId then return end
				if scope.world and scope.world ~= S.world then return end
			end
			Link.dispatch(msg, ...)
		end
	end
end

------------------------------------------------------------------------------------------------
-- EFFECTS
------------------------------------------------------------------------------------------------
local FX = {}
local Shake = { t = 0, dur = 0.25, mag = 0 }
local function shake(mag, dur)
	if mag >= Shake.mag * (Shake.t / math.max(Shake.dur, 0.01)) then
		Shake.mag, Shake.dur, Shake.t = mag, dur or 0.25, dur or 0.25
	end
end
do
	local holder = make("Part", { Name = "FXHolder", Anchored = true, CanCollide = false, CanQuery = false, CanTouch = false, Transparency = 1,
		Size = Vector3.new(0.2, 0.2, 0.2), CFrame = CFrame.new(0, -40, 0), Parent = fxFolder })
	local function emitter(props)
		props.Enabled = false
		props.Parent = make("Attachment", { Parent = holder })
		return make("ParticleEmitter", props)
	end
	FX.spark = emitter({ Lifetime = NumberRange.new(0.15, 0.35), Speed = NumberRange.new(14, 26), SpreadAngle = Vector2.new(180, 180),
		Size = NumberSequence.new(0.22, 0), LightEmission = 1, Drag = 4 })
	FX.goo = emitter({ Lifetime = NumberRange.new(0.4, 0.7), Speed = NumberRange.new(6, 12), SpreadAngle = Vector2.new(70, 70),
		Size = NumberSequence.new(0.3, 0.1), Acceleration = Vector3.new(0, -40, 0), Color = ColorSequence.new(Color3.fromRGB(120, 180, 60)) })
	FX.dust = emitter({ Texture = "rbxasset://textures/particles/smoke_main.dds", Lifetime = NumberRange.new(0.6, 1.1), Speed = NumberRange.new(2, 6),
		SpreadAngle = Vector2.new(180, 30), Size = NumberSequence.new(1.2, 3.4), Transparency = NumberSequence.new(0.35, 1),
		Color = ColorSequence.new(Color3.fromRGB(120, 105, 85)) })
	FX.magic = emitter({ Lifetime = NumberRange.new(0.5, 1), Speed = NumberRange.new(3, 9), SpreadAngle = Vector2.new(180, 180),
		Size = NumberSequence.new(0.34, 0), LightEmission = 1 })
	FX.coin = emitter({ Lifetime = NumberRange.new(0.3, 0.6), Speed = NumberRange.new(4, 9), SpreadAngle = Vector2.new(180, 180),
		Size = NumberSequence.new(0.25, 0), LightEmission = 1, Color = ColorSequence.new(Color3.fromRGB(255, 220, 90)) })
	FX.fire = emitter({ Texture = "rbxasset://textures/particles/fire_main.dds", Lifetime = NumberRange.new(0.4, 0.8), Speed = NumberRange.new(6, 16),
		SpreadAngle = Vector2.new(180, 180), Size = NumberSequence.new(3, 0.5), LightEmission = 1, Transparency = NumberSequence.new(0.1, 1),
		Color = ColorSequence.new(Color3.fromRGB(255, 170, 40), Color3.fromRGB(255, 60, 20)) })
	FX.ice = emitter({ Lifetime = NumberRange.new(0.5, 0.9), Speed = NumberRange.new(8, 16), SpreadAngle = Vector2.new(180, 60),
		Size = NumberSequence.new(0.5, 0), Acceleration = Vector3.new(0, -30, 0), Color = ColorSequence.new(Color3.fromRGB(200, 240, 255)), LightEmission = 0.4 })
	FX.toxic = emitter({ Lifetime = NumberRange.new(0.6, 1.1), Speed = NumberRange.new(4, 10), SpreadAngle = Vector2.new(180, 60),
		Size = NumberSequence.new(0.6, 0), Acceleration = Vector3.new(0, -14, 0), Color = ColorSequence.new(Color3.fromRGB(140, 255, 60)), LightEmission = 0.6 })
end
function FX.burst(em, pos, n, color)
	em.Parent.WorldPosition = pos
	if color then em.Color = ColorSequence.new(color) end
	em:Emit(GFX.high and n or math.ceil(n * 0.5))
end
function FX.shockwave(pos, radius, color, dur)
	dur = dur or 0.4
	local ring = make("Part", { Shape = Enum.PartType.Cylinder, Anchored = true, CanCollide = false, CanQuery = false, CanTouch = false, CastShadow = false,
		Material = Enum.Material.Neon, Color = color or WHITE, Transparency = 0.15, Size = Vector3.new(0.2, 1, 1),
		CFrame = CFrame.new(pos) * CFrame.Angles(0, 0, math.pi / 2), Parent = fxFolder })
	tween(ring, dur, { Size = Vector3.new(0.2, radius * 2, radius * 2), Transparency = 1 }, Enum.EasingStyle.Quart)
	Debris:AddItem(ring, dur + 0.1)
end
function FX.flash(model, color, strength)
	local h = model:FindFirstChild("FH_Flash")
	if not h then
		h = make("Highlight", { Name = "FH_Flash", FillColor = WHITE, FillTransparency = 1, OutlineTransparency = 1,
			DepthMode = Enum.HighlightDepthMode.Occluded, Adornee = model, Parent = model })
	end
	h.FillColor = color or WHITE
	h.FillTransparency = strength or 0.1
	tween(h, 0.2, { FillTransparency = 1 })
end
-- floating numbers in the world
function FX.pop(pos, msg, color, big)
	local anchor = make("Part", { Anchored = true, CanCollide = false, CanQuery = false, CanTouch = false, Transparency = 1, Size = Vector3.new(0.2, 0.2, 0.2),
		CFrame = CFrame.new(pos), Parent = fxFolder })
	local bb = make("BillboardGui", { Size = UDim2.fromOffset(big and 180 or 110, big and 50 or 36), AlwaysOnTop = true, LightInfluence = 0, MaxDistance = 140, Parent = anchor })
	local l = UI.text({ Text = msg, Size = UDim2.fromScale(1, 1), TextColor3 = color or WHITE, Stroke = big and 3 or 2.2, Parent = bb })
	local sc = make("UIScale", { Scale = big and 1.8 or 1.4, Parent = l })
	tween(sc, 0.18, { Scale = 1 }, Enum.EasingStyle.Back)
	tween(bb, 0.85, { StudsOffset = Vector3.new(rng:NextNumber(-1, 1), 3.2, 0) })
	task.delay(0.45, function()
		if l.Parent then textFade(l, 1, 0.4) end
	end)
	Debris:AddItem(anchor, 0.95)
end
-- red / blue / green warning circle on the ground before a big attack lands
function FX.tele(x, z, r, t, style)
	local col = (style == "ice") and Color3.fromRGB(120, 210, 255) or ((style == "fire") and Color3.fromRGB(255, 140, 30)
		or ((style == "toxic") and Color3.fromRGB(140, 255, 60) or Color3.fromRGB(255, 50, 50)))
	local cf = CFrame.new(x, 0.25, z) * CFrame.Angles(0, 0, math.pi / 2)
	local edge = make("Part", { Shape = Enum.PartType.Cylinder, Anchored = true, CanCollide = false, CanQuery = false, CanTouch = false, CastShadow = false,
		Material = Enum.Material.Neon, Color = col, Transparency = 0.45, Size = Vector3.new(0.12, r * 2, r * 2), CFrame = cf, Parent = fxFolder })
	local fill = make("Part", { Shape = Enum.PartType.Cylinder, Anchored = true, CanCollide = false, CanQuery = false, CanTouch = false, CastShadow = false,
		Material = Enum.Material.Neon, Color = col, Transparency = 0.35, Size = Vector3.new(0.16, 0.2, 0.2), CFrame = cf, Parent = fxFolder })
	tween(fill, t, { Size = Vector3.new(0.16, r * 2, r * 2) }, Enum.EasingStyle.Linear)
	tween(edge, t, { Transparency = 0.2 }, Enum.EasingStyle.Linear)
	Debris:AddItem(edge, t + 0.05)
	Debris:AddItem(fill, t + 0.05)
end

------------------------------------------------------------------------------------------------
-- YOUR HEALTH, STATUS EFFECTS AND THE ZOMBIE DEATH
------------------------------------------------------------------------------------------------
local Player = {}
local CA -- character animator (defined below)
do
	local function pulseCoins()
		HUD.coinScale.Scale = 1.22
		tween(HUD.coinScale, 0.28, { Scale = 1 }, Enum.EasingStyle.Back)
	end
	Player.pulseCoins = pulseCoins

	function Player.addCoins(n, at)
		S.coins += n
		markDirty()
		pulseCoins()
		if at then FX.pop(at, "+" .. commas(n) .. " 💰", GOLD) end
	end

	function Player.hurt(amount, fromPos, effect)
		if not S.playing or S.dead or S.talking or S.world == "cave" or S.traveling then return end
		local now = os.clock()
		local root = getRoot()
		if now < S.dashUntil then
			if root then FX.pop(root.Position + Vector3.new(0, 3, 0), "DODGE!", Color3.fromRGB(180, 230, 255)) end
			return
		end
		if now < S.iframes then return end
		S.iframes = now + 0.3
		S.hp -= amount
		S.lastHurt = now
		local cc = Lighting:FindFirstChild("FH2_Hurt")
		if cc then
			cc.TintColor = Color3.fromRGB(255, 135, 135)
			cc.Saturation = -0.3
			tween(cc, 0.5, { TintColor = WHITE, Saturation = 0 })
		end
		shake(0.5, 0.25)
		playSfx("hurt", nil, { vary = 0.1 })
		if root then
			FX.pop(root.Position + Vector3.new(0, 3.2, 0), "-" .. math.floor(amount), Color3.fromRGB(255, 80, 70))
			if fromPos then
				local dir = flat(root.Position - fromPos)
				if dir.Magnitude > 0.1 then root.AssemblyLinearVelocity = dir.Unit * 24 + Vector3.new(0, 10, 0) end
			end
		end
		if effect == "chill" then
			if now > S.chillUntil and root then FX.pop(root.Position + Vector3.new(0, 4.4, 0), "❄ FROZEN!", Color3.fromRGB(150, 220, 255)) end
			S.chillUntil = now + 2.2
		elseif effect == "burn" then
			S.burnUntil = now + 3
			S.burnDmg = math.max(2, math.floor(amount * 0.15))
		elseif effect == "sick" then
			if now > S.sickUntil and root then FX.pop(root.Position + Vector3.new(0, 4.4, 0), "🤢 SICK!", Color3.fromRGB(150, 255, 80), true) end
			S.sickUntil = now + 8
			S.sickDmg = math.max(2, math.floor(amount * 0.12))
		end
		if S.hp <= 0 then Player.die() end
	end

	-- burning / sickness ticking down (called every frame)
	local fireFx
	function Player.tickEffects(dt, now)
		local root = getRoot()
		local burning = now < S.burnUntil and not S.dead
		if burning and root and not fireFx then
			fireFx = make("Fire", { Size = 5, Heat = 8, Color = Color3.fromRGB(255, 140, 40), SecondaryColor = Color3.fromRGB(255, 60, 20), Parent = root })
		elseif (not burning or not root) and fireFx then
			fireFx:Destroy()
			fireFx = nil
		end
		if burning then
			S.burnTick -= dt
			if S.burnTick <= 0 then
				S.burnTick = 0.5
				S.hp -= S.burnDmg
				if root then FX.pop(root.Position + Vector3.new(0, 3, 0), "🔥" .. S.burnDmg, Color3.fromRGB(255, 150, 50)) end
				if S.hp <= 0 then Player.die() end
			end
		end
		local sick = now < S.sickUntil and not S.dead
		local sc = Lighting:FindFirstChild("FH2_Sick")
		if sc then
			local want = sick and 1 or 0
			S.sickVis = (S.sickVis or 0) + (want - (S.sickVis or 0)) * math.min(1, dt * 3)
			local k = S.sickVis
			sc.TintColor = WHITE:Lerp(Color3.fromRGB(180, 255, 140), k)
			sc.Saturation = -0.3 * k
			sc.Contrast = 0.1 * k
		end
		if sick then
			S.sickTick -= dt
			if S.sickTick <= 0 then
				S.sickTick = 0.8
				S.hp -= S.sickDmg
				if root then FX.pop(root.Position + Vector3.new(0, 3, 0), "🤢" .. S.sickDmg, Color3.fromRGB(150, 255, 80)) end
				if S.hp <= 0 then Player.die() end
			end
		end
		local bits = {}
		if burning then table.insert(bits, "🔥 BURNING") end
		if sick then table.insert(bits, "🤢 SICK " .. math.ceil(S.sickUntil - now)) end
		if now < S.chillUntil then table.insert(bits, "❄ FROZEN") end
		HUD.status.Text = table.concat(bits, "   ")
	end

	function Player.cure()
		S.burnUntil, S.sickUntil, S.chillUntil = 0, 0, 0
	end

	-- 🧟 you never just "respawn": you fall, turn into a zombie, rise up... then wake up in the cave
	function Player.die()
		if S.dead then return end
		S.dead = true
		S.hp = 0
		Player.cure()
		local root = getRoot()
		local wid = S.world
		playSfx("hurt", nil, { pitch = 0.55, vol = 1.3 })
		if root then
			root.Anchored = true
			local p = root.Position
			if Link.coop then
				Link.send("dead", true, p.X, p.Z)
			elseif SPAWNS[wid] then
				task.delay(4.5, function()
					Sim.spawnAvatar(wid, Vector3.new(p.X, 0, p.Z), player.UserId, player.DisplayName)
				end)
			end
		end
		if CA then CA.startZombie(player, os.clock()) end
		Death.sub.Text = "Your zombie twin is now roaming the " .. (WORLDS[wid] and WORLDS[wid].name or "world") .. "... go get revenge!"
		tween(Death.frame, 0.8, { BackgroundTransparency = 0.55 })
		task.delay(1.2, function()
			textFade(Death.title, 0, 0.5)
			textFade(Death.sub, 0, 0.7)
			playSfx("zGroan", root or nil, { pitch = 0.9, vol = 1.2 })
		end)
		task.delay(3.4, function() playSfx("zGroan", root or nil, { pitch = 0.75, vol = 1.2 }) end)
		task.delay(5.2, function()
			tween(fadeFrame, 0.4, { BackgroundTransparency = 0 })
			task.wait(0.45)
			if CA then CA.stopZombie(player) end
			local r = getRoot()
			if r then r.Anchored = false end
			S.hp = maxHP()
			S.dead = false
			S.iframes = os.clock() + 2
			Link.send("dead", false)
			if Player.travel then Player.travel("cave", nil, true) end
			Death.frame.BackgroundTransparency = 1
			textFade(Death.title, 1, 0.01)
			textFade(Death.sub, 1, 0.01)
			tween(fadeFrame, 0.8, { BackgroundTransparency = 1 })
		end)
	end
end

------------------------------------------------------------------------------------------------
-- CHARACTER ANIMATION: custom run / sprint / idle / jump / sword swings / zombie mode
-- Runs for YOU and for every other player near you (so you see their swings too).
------------------------------------------------------------------------------------------------
CA = { list = {} }
do
	local function V(x, y, z) return Vector3.new(x, y, z) end
	local function frameFrom(yDir, zHint)
		local y = yDir.Unit
		local z = zHint - y * zHint:Dot(y)
		if z.Magnitude < 1e-3 then
			z = y:Cross(Vector3.new(1, 0, 0))
			if z.Magnitude < 1e-3 then z = y:Cross(Vector3.new(0, 0, 1)) end
		end
		z = z.Unit
		return CFrame.fromMatrix(Vector3.zero, y:Cross(z), y, z)
	end
	local GRIP_INV = CFrame.Angles(math.rad(90), 0, 0)
	-- arm pose from directions in torso space: upper arm, forearm, blade, blade flat side
	local function pose(k)
		local up, fo = k.up.Unit, k.fo.Unit
		local perp = fo - up * fo:Dot(up)
		if perp.Magnitude < 1e-3 then perp = V(0, 0, -1) - up * (-up.Z) end
		local Ru = frameFrom(-up, -perp)
		local X = Ru.RightVector
		local Yf = -fo
		local Rf = CFrame.fromMatrix(Vector3.zero, X, Yf, X:Cross(Yf))
		local Rh = frameFrom(k.bl, k.face) * GRIP_INV
		return { Ru = Ru, Rf = Rf, Rh = Rh, twist = k.twist or 0, lean = k.lean or 0 }
	end
	local CARRY = pose({ up = V(0.3, -1, -0.15), fo = V(0.12, -0.1, -1), bl = V(0.2, 0.78, -0.6), face = V(1, 0, 0) })
	local KEYS = {
		slash = {
			{ 0.00, CARRY },
			{ 0.20, pose({ up = V(0.95, 0.25, 0.35), fo = V(0.55, 0.55, 0.65), bl = V(0.55, 0.45, 0.75), face = V(0, 1, 0), twist = -0.55, lean = 0.05 }) },
			{ 0.34, pose({ up = V(0.85, -0.05, -0.5), fo = V(0.5, 0, -0.85), bl = V(0.9, 0.15, -0.35), face = V(0, 1, 0), twist = -0.3 }) },
			{ 0.46, pose({ up = V(0.45, -0.25, -0.85), fo = V(0.05, -0.12, -1), bl = V(-0.55, -0.05, -0.85), face = V(0, 1, 0), twist = 0.05, lean = -0.1 }) },
			{ 0.66, pose({ up = V(-0.35, -0.45, -0.8), fo = V(-0.85, -0.25, -0.45), bl = V(-0.85, -0.15, 0.45), face = V(0, 1, 0), twist = 0.6, lean = -0.1 }) },
			{ 1.00, CARRY },
		},
		back = {
			{ 0.00, CARRY },
			{ 0.20, pose({ up = V(-0.25, -0.15, -0.95), fo = V(-0.85, 0.2, -0.5), bl = V(-0.75, 0.45, 0.45), face = V(0, -1, 0), twist = 0.55 }) },
			{ 0.34, pose({ up = V(0.05, -0.2, -0.98), fo = V(-0.5, 0, -0.85), bl = V(-0.35, 0.15, -0.9), face = V(0, -1, 0), twist = 0.3 }) },
			{ 0.46, pose({ up = V(0.4, -0.2, -0.9), fo = V(0.25, -0.05, -1), bl = V(0.6, -0.1, -0.8), face = V(0, -1, 0), twist = 0, lean = -0.1 }) },
			{ 0.66, pose({ up = V(0.95, -0.25, -0.2), fo = V(0.9, -0.1, 0.4), bl = V(0.75, -0.2, 0.65), face = V(0, -1, 0), twist = -0.55, lean = -0.05 }) },
			{ 1.00, CARRY },
		},
		chop = {
			{ 0.00, CARRY },
			{ 0.22, pose({ up = V(0.3, 0.95, 0.15), fo = V(0.1, 0.6, 0.8), bl = V(0.05, -0.1, 1), face = V(1, 0, 0), lean = 0.22 }) },
			{ 0.36, pose({ up = V(0.25, 0.95, -0.2), fo = V(0.1, 0.95, -0.25), bl = V(0.02, 0.98, -0.2), face = V(1, 0, 0), lean = 0.1 }) },
			{ 0.50, pose({ up = V(0.2, 0.05, -1), fo = V(0.05, -0.3, -0.95), bl = V(0, -0.55, -0.83), face = V(1, 0, 0), lean = -0.3 }) },
			{ 0.70, pose({ up = V(0.2, -0.3, -0.95), fo = V(0.05, -0.45, -0.9), bl = V(0, -0.5, -0.86), face = V(1, 0, 0), lean = -0.25 }) },
			{ 1.00, CARRY },
		},
		wide = {
			{ 0.00, CARRY },
			{ 0.22, pose({ up = V(1, 0.15, 0.3), fo = V(0.7, 0.35, 0.6), bl = V(0.7, 0.3, 0.65), face = V(0, 1, 0), twist = -0.9, lean = 0.05 }) },
			{ 0.36, pose({ up = V(0.9, -0.05, -0.45), fo = V(0.6, 0, -0.8), bl = V(0.95, 0.1, -0.3), face = V(0, 1, 0), twist = -0.5 }) },
			{ 0.48, pose({ up = V(0.3, -0.15, -0.95), fo = V(-0.1, -0.05, -1), bl = V(-0.6, 0, -0.8), face = V(0, 1, 0), twist = 0.2, lean = -0.1 }) },
			{ 0.68, pose({ up = V(-0.5, -0.35, -0.8), fo = V(-0.95, -0.2, -0.3), bl = V(-0.9, -0.1, 0.5), face = V(0, 1, 0), twist = 0.9, lean = -0.1 }) },
			{ 1.00, CARRY },
		},
		thrust = {
			{ 0.00, CARRY },
			{ 0.24, pose({ up = V(0.45, -0.55, 0.7), fo = V(0.15, 0.05, -1), bl = V(0.05, 0.05, -1), face = V(0, 1, 0), twist = -0.35, lean = 0.08 }) },
			{ 0.42, pose({ up = V(0.12, -0.08, -1), fo = V(0.02, 0, -1), bl = V(0, -0.02, -1), face = V(0, 1, 0), twist = 0.25, lean = -0.18 }) },
			{ 0.62, pose({ up = V(0.12, -0.1, -1), fo = V(0.02, -0.02, -1), bl = V(0, -0.05, -1), face = V(0, 1, 0), twist = 0.2, lean = -0.15 }) },
			{ 1.00, CARRY },
		},
		upper = {
			{ 0.00, CARRY },
			{ 0.22, pose({ up = V(0.4, -0.9, 0.1), fo = V(0.3, -0.6, -0.7), bl = V(0.2, -0.6, -0.75), face = V(1, 0, 0), twist = -0.2, lean = -0.25 }) },
			{ 0.45, pose({ up = V(0.3, 0.4, -0.85), fo = V(0.1, 0.85, -0.5), bl = V(0, 0.9, -0.4), face = V(1, 0, 0), twist = 0.1, lean = 0.15 }) },
			{ 0.65, pose({ up = V(0.25, 0.95, -0.1), fo = V(0.05, 1, 0.1), bl = V(0, 1, 0.25), face = V(1, 0, 0), lean = 0.22 }) },
			{ 1.00, CARRY },
		},
		spin = {
			{ 0.00, CARRY },
			{ 0.15, pose({ up = V(1, -0.1, 0.15), fo = V(1, 0, -0.1), bl = V(0.85, 0.1, -0.5), face = V(0, 1, 0), twist = -0.5 }) },
			{ 0.80, pose({ up = V(1, -0.1, -0.2), fo = V(1, 0, -0.3), bl = V(0.8, 0.05, -0.6), face = V(0, 1, 0), twist = 0.2 }) },
			{ 1.00, CARRY },
		},
	}
	-- R6 has no elbow/wrist: classic whole-arm chop with a sideways sweep
	local function r6key(t, deg)
		local a = math.rad(deg)
		return { t, { up = V(0.1, -math.cos(a), -math.sin(a)), bl = V(0, math.sin(a), -math.cos(a)) } }
	end
	local R6KEYS = { r6key(0, 40), r6key(0.25, 190), r6key(0.38, 100), r6key(0.5, 10), r6key(0.66, -15), r6key(1, 40) }
	for _, k in ipairs(R6KEYS) do k[3] = frameFrom(-k[2].up, -k[2].bl) end
	local R6SWEEP = { slash = 0.65, back = -0.65, wide = 0.9, thrust = 0, upper = -0.3, chop = 0, spin = 0 }

	local function sample(keys, t)
		for i = 1, #keys - 1 do
			local a, b = keys[i], keys[i + 1]
			if t <= b[1] then return a, b, smooth((t - a[1]) / (b[1] - a[1])) end
		end
		local last = keys[#keys]
		return last, last, 1
	end
	local setJ = Rigs.setJ

	------------------------------------------------------------------------------------------ setup per character
	function CA.attachSword(ca, id)
		if ca.sword then ca.sword:Destroy() end
		ca.sword, ca.swordInfo = nil, nil
		ca.swordId = id
		local hand = ca.hand
		if not hand or not hand.Parent or not id then return end
		local def = SWORD_BY_ID[id] or SWORDS[1]
		local isMe = ca.plr == player
		local model, handle, info = buildSword(def, isMe and S.levels.range * 0.12 or 0, isMe and S.levels.damage >= 5)
		local offsetY = ca.r15 and -(hand.Size.Y * 0.15) or -1
		make("Weld", { Name = "FH_SwordGrip", Part0 = hand, Part1 = handle, C0 = CFrame.new(0, offsetY, 0) * CFrame.Angles(math.rad(-90), 0, 0),
			C1 = CFrame.new(), Parent = handle })
		model.Parent = ca.char
		ca.sword, ca.swordInfo = model, info
	end

	function CA.setup(plr, char)
		local hum = char:FindFirstChildOfClass("Humanoid")
		local root = char:FindFirstChild("HumanoidRootPart")
		if not hum or not root then return nil end
		local J, r15 = Rigs.charJoints(char)
		local ca = { plr = plr, char = char, hum = hum, root = root, r15 = r15, J = J, phase = 0, walk = 0, air = 0, t = 0,
			hand = char:FindFirstChild(r15 and "RightHand" or "Right Arm"), swing = { active = false, t = 0, dur = 0.4, kind = "slash" } }
		ca.ok = ca.hand ~= nil and J.ShoulderR ~= nil
		CA.list[plr] = ca
		return ca
	end

	function CA.broken(ca)
		if not ca or not ca.char.Parent or ca.plr.Character ~= ca.char then return true end
		if not ca.hand or ca.hand.Parent ~= ca.char then return true end
		if ca.J.ShoulderR and not ca.J.ShoulderR.m.Parent then return true end
		return false
	end

	function CA.startSwing(ca, kind, speed)
		local sw = SWINGS[kind] or SWINGS.slash
		ca.swing.active, ca.swing.kind, ca.swing.t = true, kind, 0
		ca.swing.dur = sw.dur / math.clamp(speed or 1, 0.4, 4)
		ca.swing.sound, ca.swing.hit = false, false
	end

	function CA.startZombie(plr, at)
		local ca = CA.list[plr]
		if not ca then return end
		ca.zombieAt = at
		ca.zombified = false
		if ca.sword then ca.sword.Parent = nil end
	end
	function CA.stopZombie(plr)
		local ca = CA.list[plr]
		if not ca then return end
		ca.zombieAt = nil
		if ca.unzombify then
			ca.unzombify()
			ca.unzombify = nil
		end
		ca.zombified = false
		if ca.sword then ca.sword.Parent = ca.char end
		for _, j in pairs(ca.J) do
			if j and j.m.Parent then j.m.Transform = CFrame.new() end
		end
	end

	------------------------------------------------------------------------------------------ the pose, every frame
	local function zombiePose(ca, now)
		local J = ca.J
		local t = now - ca.zombieAt
		if t > 0.9 and not ca.zombified then
			ca.zombified = true
			ca.unzombify = Rigs.zombify(ca.char)
			FX.burst(FX.toxic, ca.root.Position, 16, Color3.fromRGB(120, 255, 80))
		end
		local down
		if t < 0.6 then down = smooth(t / 0.6)
		elseif t < 1.8 then down = 1
		elseif t < 2.8 then down = 1 - smooth((t - 1.8) / 1.0)
		else down = 0 end
		local tw = (t > 0.9 and t < 1.8) and math.sin(t * 40) * 0.15 or 0
		local fallY = ca.r15 and (ca.hum.HipHeight + 0.6) or 2.4
		local sway = math.sin(t * 2.2) * 0.07
		setJ(J, "Root", CFrame.new(0, -fallY * down, 0) * CFrame.Angles(1.45 * down, 0, sway * (1 - down)))
		local armsUp = (t > 1.8) and 1 or 0
		local shA = lerp(0.2 + tw, 1.5 + math.sin(t * 3) * 0.08, armsUp)
		setJ(J, "ShoulderL", CFrame.Angles(shA, 0, -0.12))
		setJ(J, "ShoulderR", CFrame.Angles(shA + 0.05, 0, 0.12))
		setJ(J, "ElbowL", CFrame.Angles(0.2, 0, 0))
		setJ(J, "ElbowR", CFrame.Angles(0.25, 0, 0))
		setJ(J, "WristR", CFrame.new())
		setJ(J, "Neck", CFrame.Angles(0.25 * armsUp, 0, (0.35 + math.sin(t * 1.3) * 0.15) * armsUp + tw))
		setJ(J, "Waist", CFrame.Angles(-0.25 * armsUp, 0, sway))
		local shuffle = (t > 2.8) and math.sin(t * 3) * 0.25 or 0
		setJ(J, "HipL", CFrame.Angles(shuffle, 0, 0))
		setJ(J, "HipR", CFrame.Angles(-shuffle, 0, 0))
		setJ(J, "KneeL", CFrame.Angles(-0.2 - math.max(0, shuffle), 0, 0))
		setJ(J, "KneeR", CFrame.Angles(-0.2 - math.max(0, -shuffle), 0, 0))
	end

	function CA.update(ca, dt, now)
		if not ca.ok or not ca.char.Parent then return end
		local hum, root, J = ca.hum, ca.root, ca.J
		if ca.zombieAt then
			zombiePose(ca, now)
			return
		end
		if hum.Health <= 0 then return end
		ca.t += dt
		local vel = root.AssemblyLinearVelocity
		local spd = Vector2.new(vel.X, vel.Z).Magnitude
		local grounded
		if ca.plr == player then
			grounded = hum.FloorMaterial ~= Enum.Material.Air
		else
			grounded = math.abs(vel.Y) < 3
		end
		ca.air += ((grounded and 0 or 1) - ca.air) * math.min(1, dt * 10)
		local wantWalk = math.clamp(spd / 4, 0, 1)
		ca.walk += (wantWalk - ca.walk) * math.min(1, dt * 8)
		local w = ca.walk * (1 - ca.air)
		local sprintK = math.clamp((spd - 18) / 8, 0, 1)
		local stride = 5.2 + spd * 0.13
		ca.phase = (ca.phase + dt * spd / stride * math.pi) % (math.pi * 2)
		local sn, cs = math.sin(ca.phase), math.cos(ca.phase)
		local A = 0.62 + 0.3 * sprintK
		local breathe = math.sin(ca.t * 1.8) * 0.025

		-- legs
		local hipL = A * sn * w + ca.air * 0.65
		local hipR = -A * sn * w - ca.air * 0.25
		local kneeL = -(0.12 + 1.25 * math.max(0, cs)) * w - ca.air * 1.0 - 0.04
		local kneeR = -(0.12 + 1.25 * math.max(0, -cs)) * w - ca.air * 0.45 - 0.04
		setJ(J, "HipL", CFrame.Angles(hipL, 0, 0))
		setJ(J, "HipR", CFrame.Angles(hipR, 0, 0))
		setJ(J, "KneeL", CFrame.Angles(kneeL, 0, 0))
		setJ(J, "KneeR", CFrame.Angles(kneeR, 0, 0))
		setJ(J, "AnkleL", CFrame.Angles(-(hipL + kneeL) * 0.35, 0, 0))
		setJ(J, "AnkleR", CFrame.Angles(-(hipR + kneeR) * 0.35, 0, 0))

		-- body bob + lean + swing twist / spin / lunge
		local sw = ca.swing
		local twist, lean, spinA, step = 0, 0, 0, 0
		local Ru, Rf, Rh
		if sw.active then
			local keys = KEYS[sw.kind] or KEYS.slash
			local a, b, u = sample(keys, sw.t)
			local pa, pb = a[2], b[2]
			Ru, Rf, Rh = pa.Ru:Lerp(pb.Ru, u), pa.Rf:Lerp(pb.Rf, u), pa.Rh:Lerp(pb.Rh, u)
			twist, lean = lerp(pa.twist, pb.twist, u), lerp(pa.lean, pb.lean, u)
			if sw.kind == "spin" then spinA = -math.pi * 2 * smooth((sw.t - 0.15) / 0.65) end
			if sw.kind == "thrust" then step = math.sin(math.clamp((sw.t - 0.2) / 0.55, 0, 1) * math.pi) * 0.9 end
		else
			local bob = math.sin(ca.phase * 2) * 0.05 * w
			Ru, Rf, Rh = CFrame.Angles(bob, 0, 0) * CARRY.Ru, CFrame.Angles(bob, 0, 0) * CARRY.Rf, CFrame.Angles(bob, 0, 0) * CARRY.Rh
		end
		local bobY = (math.abs(cs) - 0.6) * 0.2 * w
		setJ(J, "Root", CFrame.new(0, bobY, -step) * CFrame.Angles(0, sn * 0.07 * w + spinA, 0))
		setJ(J, "Waist", CFrame.Angles(-(0.06 + 0.16 * sprintK) * w + breathe + lean, -sn * 0.12 * w + twist, 0))
		setJ(J, "Neck", CFrame.Angles(0.04 * w, sn * 0.06 * w - twist * 0.4, 0))

		-- free (left) arm pumps while running
		setJ(J, "ShoulderL", CFrame.Angles(-A * 1.05 * sn * w + 0.08 + ca.air * 0.9, 0, -0.08 - ca.air * 0.3))
		setJ(J, "ElbowL", CFrame.Angles(0.2 + 0.9 * w, 0, 0))

		-- sword arm
		if ca.r15 then
			setJ(J, "ShoulderR", Ru)
			setJ(J, "ElbowR", Ru:Inverse() * Rf)
			setJ(J, "WristR", Rf:Inverse() * Rh)
		else
			local R
			if sw.active then
				local a, b, u = sample(R6KEYS, sw.t)
				R = a[3]:Lerp(b[3], u)
				local sweep = R6SWEEP[sw.kind] or 0
				R = CFrame.Angles(0, sweep * (1 - 2 * smooth(sw.t / 0.7)), 0) * R
			else
				R = CFrame.Angles(math.sin(ca.phase) * 0.15 * w, 0, 0) * R6KEYS[1][3]
			end
			setJ(J, "ShoulderR", R)
		end
		-- trail on during the swing
		if ca.swordInfo and ca.swordInfo.trail and ca.swordInfo.trail.Parent then
			ca.swordInfo.trail.Enabled = sw.active and sw.t > 0.12 and sw.t < 0.82
		end
		if sw.active then
			sw.t += dt / sw.dur
			if not sw.sound and sw.t >= 0.18 then
				sw.sound = true
				local s = SWINGS[sw.kind] or SWINGS.slash
				playSfx(s.sound, root, { vary = 0.08, pitch = (sw.kind == "chop" or sw.kind == "spin") and 0.85 or 1, vol = ca.plr == player and 1 or 0.6 })
			end
			if ca.onImpact and not sw.hit and sw.t >= (SWINGS[sw.kind] or SWINGS.slash).impact then
				sw.hit = true
				ca.onImpact(sw.kind)
			end
			if sw.t >= 1 then
				sw.active = false
				if ca.onEnd then ca.onEnd() end
			end
		end
	end

	-- remote player swings arrive here
	On.swing = function(userId, kindNum, speed)
		local plr = Players:GetPlayerByUserId(userId)
		local ca = plr and CA.list[plr]
		local kind = SWING_IDS[kindNum]
		if ca and kind and not ca.zombieAt then CA.startSwing(ca, kind, speed) end
	end
end

------------------------------------------------------------------------------------------------
-- SWINGING YOUR SWORD (combos are different for every sword)
------------------------------------------------------------------------------------------------
local Swing = { combo = 0, lastEnd = -10, queued = false }
local Views -- filled in by the monster views section
do
	local function myCA() return CA.list[player] end

	local function faceNearest()
		local root = getRoot()
		if not root or not Views then return end
		local best, bd = nil, 14
		for _, v in pairs(Views.list) do
			if v.alive and not v.rising then
				local d = flat(v.pos - root.Position).Magnitude
				if d < bd then best, bd = v, d end
			end
		end
		if best and bd > 0.5 then
			local p = root.Position
			root.CFrame = CFrame.lookAt(p, Vector3.new(best.pos.X, p.Y, best.pos.Z))
		end
	end

	local pumpkinBoomAt = 0
	local function impact(kind)
		local root = getRoot()
		if not root or not Views then return end
		local st = getStats()
		local sw = SWINGS[kind] or SWINGS.slash
		local reach = st.reach + sw.reach
		local look = flat(root.CFrame.LookVector)
		look = look.Magnitude > 0.01 and look.Unit or Vector3.new(0, 0, -1)
		local pos = root.Position
		local hits = {}
		for _, v in pairs(Views.list) do
			if v.alive and not v.rising then
				local off = flat(v.pos - pos)
				local d = off.Magnitude
				if d <= reach + v.def.radius then
					local dot = d > 0.1 and look:Dot(off / d) or 1
					if d < 3 or dot > sw.arc then table.insert(hits, v) end
				end
			end
		end
		for _, v in ipairs(hits) do
			local crit = rng:NextNumber() < st.crit
			local dmg = st.dmg * sw.mult * (crit and 2 or 1) * rng:NextNumber(0.92, 1.08)
			Views.hit(v, dmg, { crit = crit, finisher = sw.finisher, lift = sw.lift, effect = st.def.effect, color = st.def.trail, from = pos })
		end
		if st.def.effect == "pumpkin" and #hits > 0 then
			-- 🎃 every hit blows up in pumpkin fire, hurting everything nearby
			local c = hits[1].pos
			FX.burst(FX.fire, c + Vector3.new(0, 2, 0), 18)
			FX.shockwave(c + Vector3.new(0, 0.4, 0), 9, Color3.fromRGB(255, 130, 30), 0.35)
			if os.clock() - pumpkinBoomAt > 0.25 then
				pumpkinBoomAt = os.clock()
				playSfx("boom", c, { vol = 0.5, pitch = 1.3 })
			end
			for _, v in pairs(Views.list) do
				if v.alive and not v.rising and not table.find(hits, v) and flat(v.pos - c).Magnitude < 9 + v.def.radius then
					Views.hit(v, st.dmg * 0.5, { effect = "pumpkin", color = Color3.fromRGB(255, 140, 30), from = c, splash = true })
				end
			end
		end
		if sw.finisher then
			local ground = Vector3.new(pos.X, 0.3, pos.Z) + (kind == "spin" and Vector3.zero or look * 4.5)
			FX.shockwave(ground, kind == "spin" and 10 or 7, st.def.trail, 0.35)
			FX.burst(FX.dust, ground, 10)
			playSfx("slam", ground, { vol = 0.3, pitch = 1.5 })
			shake(0.3, 0.2)
		end
		if #hits > 0 then shake(sw.finisher and 0.5 or 0.22, 0.2) end
	end

	local function start()
		local ca = myCA()
		if not ca or not ca.ok then return end
		local st = getStats()
		local combo = st.def.combo
		local now = os.clock()
		Swing.combo = (now - Swing.lastEnd < 0.6) and (Swing.combo % #combo) + 1 or 1
		local kind = combo[Swing.combo]
		local spd = math.clamp(st.speed, 0.5, 3)
		CA.startSwing(ca, kind, spd)
		ca.onImpact = impact
		ca.onEnd = function()
			Swing.lastEnd = os.clock()
			if Swing.queued and S.playing and not S.dead and not S.talking then
				Swing.queued = false
				Swing.request()
			end
		end
		Swing.queued = false
		faceNearest()
		Link.send("swing", SWING_NUM[kind], spd)
	end

	function Swing.request()
		if not S.playing or S.dead or S.talking or S.traveling then return end
		local ca = myCA()
		if not ca then return end
		if ca.swing.active then
			if ca.swing.t > 0.35 then Swing.queued = true end
			return
		end
		start()
	end
end

------------------------------------------------------------------------------------------------
-- SPRINT + DASH + INPUT (PC keyboard/mouse, gamepad and phone)
------------------------------------------------------------------------------------------------
local Input = {}
do
	pcall(function() player.DevEnableMouseLock = false end) -- Shift is for sprinting, not shift-lock

	function Input.dash()
		if not S.playing or S.dead or S.talking or S.traveling then return end
		local now = os.clock()
		if now < S.dashCool then return end
		local root, hum = getRoot(), getHum()
		if not root or not hum then return end
		S.dashCool = now + 1.1
		S.dashUntil = now + 0.35
		local dir = hum.MoveDirection
		if dir.Magnitude < 0.1 then dir = root.CFrame.LookVector end
		dir = flat(dir)
		dir = dir.Magnitude > 0.01 and dir.Unit or Vector3.new(0, 0, -1)
		S.dashDir = dir
		root.AssemblyLinearVelocity = dir * 78 + Vector3.new(0, 6, 0)
		S.fov = 86
		playSfx("whoosh", root, { pitch = 1.35, vol = 0.8 })
		FX.burst(FX.dust, root.Position - Vector3.new(0, 2.5, 0), 8)
		local h = player.Character and make("Highlight", { FillColor = Color3.fromRGB(180, 230, 255), FillTransparency = 0.5, OutlineTransparency = 1,
			DepthMode = Enum.HighlightDepthMode.Occluded, Parent = player.Character })
		if h then
			tween(h, 0.35, { FillTransparency = 1 })
			Debris:AddItem(h, 0.4)
		end
	end

	function Input.equipSlot(i)
		local def = SWORDS[i]
		if def and S.owned[def.id] and S.equipped ~= def.id and Player.equip then Player.equip(def.id) end
	end

	UserInputService.InputBegan:Connect(function(input, processed)
		local kc = input.KeyCode
		if kc == Enum.KeyCode.LeftShift or kc == Enum.KeyCode.RightShift or kc == Enum.KeyCode.ButtonL3 then S.sprint = true end
		if processed then return end
		if input.UserInputType == Enum.UserInputType.MouseButton1 or kc == Enum.KeyCode.F or kc == Enum.KeyCode.ButtonR2 or kc == Enum.KeyCode.ButtonX then
			Swing.request()
		elseif kc == Enum.KeyCode.Q or kc == Enum.KeyCode.ButtonB then
			Input.dash()
		elseif kc == Enum.KeyCode.One then Input.equipSlot(1)
		elseif kc == Enum.KeyCode.Two then Input.equipSlot(2)
		elseif kc == Enum.KeyCode.Three then Input.equipSlot(3)
		elseif kc == Enum.KeyCode.Four then Input.equipSlot(4)
		elseif kc == Enum.KeyCode.Five then Input.equipSlot(5)
		elseif kc == Enum.KeyCode.M and Menu.toggle then Menu.toggle("worlds")
		elseif kc == Enum.KeyCode.G and Menu.toggle then Menu.toggle("swords")
		elseif kc == Enum.KeyCode.H and Player.goHome then Player.goHome()
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		local kc = input.KeyCode
		if kc == Enum.KeyCode.LeftShift or kc == Enum.KeyCode.RightShift then S.sprint = false end
	end)
	UserInputService.TouchTap:Connect(function(_, processed)
		if processed then return end
		Swing.request()
	end)

	-- phone buttons
	local gui = make("ScreenGui", { Name = "FH2_Touch", ResetOnSpawn = false, DisplayOrder = 6, Enabled = false, Parent = playerGui })
	local function round(text, size, pos, color)
		local face, label, holder = UI.button({ Text = text, Size = UDim2.fromOffset(size, size), Position = pos, AnchorPoint = Vector2.new(1, 1), Color = color,
			Radius = size / 2, MaxText = 60, Parent = gui })
		return face, label, holder
	end
	-- placed just left of Roblox's own jump button (which grows on tablets)
	local swingB, _, swingH = round("⚔", 96, UDim2.new(1, -186, 1, -34), UI.PANEL)
	local dashB, _, dashH = round("💨", 64, UDim2.new(1, -292, 1, -46), UI.PANEL2)
	local sprintB, sprintL, sprintH = round("🏃", 64, UDim2.new(1, -202, 1, -146), UI.PANEL2)
	swingB.Activated:Connect(function() Swing.request() end)
	dashB.Activated:Connect(function() Input.dash() end)
	sprintB.Activated:Connect(function()
		S.sprint = not S.sprint
		sprintB.BackgroundColor3 = S.sprint and UI.GREEN or UI.PANEL2
		sprintL.Text = S.sprint and "🏃‍♂️" or "🏃"
	end)
	Input.touchGui = gui
	Input.touchHolders = { swingH, dashH, sprintH }

	local hudScale = make("UIScale", { Parent = HUD.root })
	local menuScale = make("UIScale", { Parent = menuGui })
	local function rescale()
		local cam = workspace.CurrentCamera
		if not cam then return end
		local v = cam.ViewportSize
		local k = math.clamp(math.min(v.X / 980, v.Y / 560), 0.55, 1.15)
		hudScale.Scale = k
		menuScale.Scale = math.max(k, 0.75)
		Input.uiScale = k
	end
	rescale()
	task.spawn(function()
		local cam = workspace.CurrentCamera
		while not cam do task.wait(0.2); cam = workspace.CurrentCamera end
		cam:GetPropertyChangedSignal("ViewportSize"):Connect(rescale)
	end)
	RunService.Heartbeat:Connect(function()
		local touch = UserInputService.TouchEnabled and (not UserInputService.KeyboardEnabled or UserInputService.LastInputType == Enum.UserInputType.Touch)
		Input.touch = touch
		gui.Enabled = touch and S.playing and not S.dead and not S.talking
		HUD.keys.Visible = not touch and S.playing
	end)
end

------------------------------------------------------------------------------------------------
-- MONSTERS ON YOUR SCREEN: models, smooth movement, hand-made animations, hits, deaths
------------------------------------------------------------------------------------------------
local Pickups = {} -- coins + candy (filled in later)
local Unlocks = {} -- world unlock checks (filled in later)
Views = { list = {} }
do
	local setJ = Rigs.setJ
	local DOG_LEGS = { "FL", "FR", "HL", "HR" }
	local DOG_GALLOP = { FL = 0, FR = -0.7, HL = math.pi, HR = math.pi - 0.7 }
	local DOG_TROT = { FL = 0, HR = 0, FR = math.pi, HL = math.pi }
	local function has(flags, bit) return bit32.band(flags or 0, bit) ~= 0 end

	------------------------------------------------------------------------------------------ create / destroy
	local function makeBar(v)
		local big = v.def.ai == "slam"
		local bar = make("BillboardGui", { Name = "HPBar", Size = UDim2.fromOffset(big and 120 or 86, v.kind == "avatar" and 34 or 14),
			StudsOffsetWorldSpace = Vector3.new(0, (v.def.rig == "dog" and 1.5 or 1.7) * v.s, 0), AlwaysOnTop = true, MaxDistance = 90,
			LightInfluence = 0, Enabled = v.kind == "avatar", Adornee = v.P.head, Parent = v.model })
		local back = make("Frame", { AnchorPoint = Vector2.new(0, 1), Position = UDim2.fromScale(0, 1), Size = UDim2.new(1, 0, 0, 12), BackgroundColor3 = UI.INK, Parent = bar })
		UI.corner(back, 6)
		make("UIStroke", { Thickness = 2, Color = UI.INK, Parent = back })
		local fill = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = big and Color3.fromRGB(255, 150, 40) or Color3.fromRGB(235, 60, 50), Parent = back })
		UI.corner(fill, 6)
		if v.kind == "avatar" then
			UI.text({ Text = v.name or "Zombie", Size = UDim2.new(1, 40, 0, 20), Position = UDim2.fromOffset(-20, 0), TextColor3 = Color3.fromRGB(150, 255, 110), Stroke = 2, Parent = bar })
		end
		v.bar, v.barFill = bar, fill
	end

	local failed = {}
	local function create(id, kind, userId)
		local def = MOBS[kind]
		if not def or failed[id] then return nil end
		local model, P, J, rootH, s, r
		local avatar = false
		if kind == "avatar" and userId then
			local ok, m, p, j, rh = pcall(Rigs.avatar, userId, 1)
			if ok and m then
				model, P, J, rootH, s, r = m, p, j, rh, 1, Random.new(id)
				avatar = true
			end
		end
		if not model then
			local ok, m, p, j, rh, sc, rr = pcall(Rigs.build, kind == "avatar" and "zombie" or kind, id)
			if not ok then
				warn("[Forest Hunt 2.0] couldn't build " .. kind .. ": " .. tostring(m))
				failed[id] = true
				return nil
			end
			model, P, J, rootH, s, r = m, p, j, rh, sc, rr
		end
		local plr = userId and Players:GetPlayerByUserId(userId)
		local v = {
			id = id, kind = kind, def = def, model = model, P = P, J = J, rootH = rootH, s = s, avatar = avatar,
			name = plr and (plr.DisplayName .. "'s Zombie") or nil,
			pos = Vector3.zero, yaw = 0, extraY = 0, vis = 0, phase = r:NextNumber(0, 6.28), seed = r:NextNumber(0, 100),
			hurtT = 0, freeze = 0, twitch = 0, twitchDir = 0, alive = true, state = "idle", atkT = 0, flags = 0, hpFrac = 1, t0 = 0,
			limp = (def.ai == "melee" and r:NextNumber() < 0.45) and ((r:NextNumber() < 0.5) and "L" or "R") or nil,
			arms = (def.ai == "melee") and ({ "reach", "reach", "drag", "limp" })[r:NextInteger(1, 4)] or "reach",
			hunch = def.rig == "monkey" and 0.75 or r:NextNumber(0.2, 0.45),
			nextSound = os.clock() + r:NextNumber(2, 7), fresh = true, frame = r:NextInteger(0, 3), liftT = 0,
		}
		makeBar(v)
		model.Parent = mobFolder
		Views.list[id] = v
		return v
	end

	local function destroy(v)
		v.removed = true
		if v.model then v.model:Destroy() end
		Views.list[v.id] = nil
	end
	function Views.clear()
		for _, v in pairs(Views.list) do destroy(v) end
	end

	------------------------------------------------------------------------------------------ incoming data
	local function setTarget(v, x, z, yaw, state, atkT, extraY, flags, hpFrac, exact)
		if v.fresh then
			v.pos, v.yaw = Vector3.new(x, 0, z), yaw
			v.fresh = false
		end
		v.tpos, v.tyaw, v.textraY = Vector3.new(x, 0, z), yaw, extraY
		v.flags, v.hpFrac = flags, hpFrac
		local now = os.clock()
		if state ~= v.state then
			local old = v.state
			v.state = state
			v.t0 = now - atkT * stateDur(v.def, state)
			if Views.onState then Views.onState(v, old, state) end
		end
		if exact then v.atkT = atkT end
		v.exact = exact
	end

	-- solo: read straight from the monster brain on this device
	function Views.syncSolo()
		local W = Sim.worlds[S.world]
		local seen = {}
		if W then
			for _, m in ipairs(W.mobs) do
				if not m.dead then
					seen[m.id] = true
					local v = Views.list[m.id]
					if not v then v = create(m.id, m.kind, m.userId) end
					if v and v.alive then setTarget(v, m.pos.X, m.pos.Z, m.yaw, m.state, m.atkT, m.extraY, m.flags, m.hpFrac, true) end
				end
			end
		end
		for id, v in pairs(Views.list) do
			if v.alive and not seen[id] then destroy(v) end
		end
	end

	-- multiplayer: snapshots from the server, 10 times a second
	function Views.onSnap(wid, buf)
		if wid ~= S.world or S.traveling then return end
		local ok, list = pcall(decodeMobs, buf)
		if not ok then return end
		local seen = {}
		for _, r in ipairs(list) do
			seen[r.id] = true
			local v = Views.list[r.id]
			if v and v.kind ~= r.kind then
				destroy(v)
				v = nil
			end
			if not v then v = create(r.id, r.kind, r.userId) end
			if v and v.alive then setTarget(v, r.x, r.z, r.yaw, r.state, r.atkT, r.extraY, r.flags, r.hpFrac, false) end
		end
		for id, v in pairs(Views.list) do
			if v.alive and not seen[id] then destroy(v) end
		end
	end

	------------------------------------------------------------------------------------------ sounds when monsters change what they're doing
	function Views.onState(v, _old, st)
		local head = v.P.head
		if not head or not head.Parent then return end
		local def, kind = v.def, v.kind
		if st == "notice" then
			if def.boss then
				playSfx("roar", head, { pitch = 0.6, vol = 1.2, range = 220 })
				shake(0.35, 0.8)
			elseif def.rig == "dog" then playSfx("dogGrowl", head, { vary = 0.1 })
			elseif def.rig == "monkey" then playSfx("dogBark", head, { pitch = 2.1, vol = 0.9, vary = 0.1 })
			elseif def.ai == "slam" then playSfx("roar", head, { vary = 0.05, pitch = kind == "yeti" and 0.8 or 1, range = 170 }); shake(0.15, 0.6)
			else playSfx("zGroan", head, { vary = 0.15 }) end
		elseif st == "attack" then
			if def.rig == "dog" then playSfx("dogGrowl", head, { vary = 0.1, pitch = 1.2 })
			elseif def.rig == "monkey" then playSfx("zAttack", head, { pitch = 1.7, vary = 0.1 })
			elseif def.ai == "slam" then playSfx("roar", head, { pitch = 1.1, vol = 0.8, vary = 0.05 })
			else playSfx("zAttack", head, { vary = 0.12 }) end
		elseif st == "pounce" then
			playSfx(def.rig == "monkey" and "dogBark" or "dogGrowl", head, { vary = 0.1, pitch = def.rig == "monkey" and 2.2 or 1.15 })
		elseif st == "ignite" then
			playSfx("burn", head, { vol = 1.2, pitch = 0.8 })
			playSfx("whoosh", head, { pitch = 0.6, vol = 1 })
		elseif st == "spit" then
			playSfx("splat", head, { pitch = 0.6, vol = 1.6 })
		elseif st == "rise" then
			playSfx("dirt", v.pos, { vol = 0.9 })
			task.delay(0.7, function() if v.alive and v.P.head.Parent then playSfx("zGroan", v.P.head, { vary = 0.1, pitch = def.boss and 0.6 or 1 }) end end)
		elseif st == "summon" or st == "roar" then
			playSfx("roar", head, { pitch = 0.7, vol = 1.2, range = 220 })
		elseif st == "slam" or st == "sweep" or st == "leap" or st == "barrel" or st == "boulder" or st == "spikes" then
			playSfx("roar", head, { pitch = 0.8 + rng:NextNumber(0, 0.2), vol = 0.9, range = 200 })
		end
	end

	------------------------------------------------------------------------------------------ animations
	local function animBiped(v, dt, now)
		local J, s, def = v.J, v.s, v.def
		if v.freeze > 0 then
			v.freeze -= dt
			return
		end
		local monkey = def.rig == "monkey"
		local st, a = v.state, v.atkT
		local spd = v.vis
		local ignited = has(v.flags, 16)
		local run = (has(v.flags, 32) or ignited or def.boss or monkey) and spd > 8.5
		local stride = (run and (monkey and 5.5 or 4.6) or 3) * s
		v.phase = (v.phase + dt * spd / stride * math.pi) % (math.pi * 2)
		local walk = math.clamp(spd / (2.2 * s), 0, 1)
		local idle = 1 - walk
		local ph = v.phase
		local sn, cs = math.sin(ph), math.cos(ph)
		local t = now + v.seed
		v.hurtT = math.max(0, v.hurtT - dt * 3.5)
		local hurt = def.boss and v.hurtT * 0.3 or v.hurtT
		v.twitch = math.max(0, v.twitch - dt * 5)
		if rng:NextNumber() < dt * 0.4 then v.twitch, v.twitchDir = 1, rng:NextNumber(-1, 1) end
		local tw = v.twitch * v.twitch * v.twitchDir * (def.boss and 0.3 or 1)
		local heavy = def.ai == "slam" or def.boss

		-- what the arms / body are doing for actions
		local armL, armR, elL, elR, lean, crouch, spin, armZ, headX = nil, nil, 0.3, 0.3, 0, 0, 0, 0, 0
		if st == "attack" then
			local wind, strike, rec = smooth(a / 0.42), smooth((a - 0.42) / 0.12), smooth((a - 0.62) / 0.38)
			if heavy or monkey then
				armL = lerp(lerp(1.3, 3.0, wind), 0.15, strike)
				lean = lerp(lerp(0, 0.35, wind), -0.8, strike)
				crouch = 0.5 * strike * (1 - rec)
				armR = armL
			else
				-- claw swipe: right arm first, left arm follows
				armR = lerp(lerp(1.4, 2.8, wind), 0.45, strike)
				armL = lerp(lerp(1.3, 2.4, smooth(a / 0.5)), 0.5, smooth((a - 0.5) / 0.12))
				lean = lerp(lerp(0, 0.3, wind), -0.6, strike)
			end
			armL, armR = lerp(armL, 1.4, rec), lerp(armR, 1.4, rec)
			lean *= (1 - rec)
			elL, elR = lerp(0.6, 0.1, strike), lerp(0.6, 0.1, strike)
		elseif st == "throw" then
			local wind, rel = smooth(a / 0.45), smooth((a - 0.45) / 0.15)
			armR = lerp(lerp(0.3, 3.1, wind), 1.2, rel)
			elR = lerp(lerp(0.2, 1.4, wind), 0.1, rel)
			armL, elL = 0.9, 0.5
			lean = lerp(lerp(0, 0.25, wind), -0.35, rel) * (1 - smooth((a - 0.75) / 0.25))
		elseif st == "spit" then
			local wind, rel = smooth(a / 0.45), smooth((a - 0.45) / 0.12)
			lean = lerp(lerp(0, 0.45, wind), -0.5, rel) * (1 - smooth((a - 0.7) / 0.3))
			armL, armR, elL, elR = 0.4 + wind * 0.4, 0.4 + wind * 0.4, 1.2, 1.2
			headX = lerp(lerp(0, 0.5, wind), -0.6, rel)
		elseif st == "ignite" then
			local sh = math.sin(now * 40) * 0.25
			armL, armR, elL, elR = 2.6 + sh, 2.6 - sh, 0.6, 0.6
			lean = 0.25 + sh * 0.3
		elseif st == "notice" and (def.boss or monkey) then
			-- big roar / chest pound
			if monkey then
				local beat = math.sin(now * 18)
				armL, armR, elL, elR = 1.2 + beat * 0.3, 1.2 - beat * 0.3, 2.1, 2.1
				lean = 0.35
			else
				armL, armR, elL, elR, lean, armZ = 2.8, 2.8, 0.4, 0.4, 0.3, 0.5
			end
		elseif st == "slam" or st == "spikes" then
			local wind, strike, rec = smooth(a / 0.5), smooth((a - 0.5) / 0.08), smooth((a - 0.7) / 0.3)
			armL = lerp(lerp(1.2, 3.1, wind), 0.1, strike)
			lean = lerp(lerp(0, 0.4, wind), -0.9, strike)
			crouch = 0.6 * strike * (1 - rec)
			armL = lerp(armL, 1.2, rec)
			lean *= (1 - rec)
			armR, elL, elR = armL, 0.3, 0.3
		elseif st == "sweep" then
			local wind = smooth(a / 0.4)
			spin = -math.pi * 2 * smooth((a - 0.4) / 0.3)
			armL, armR, elL, elR = 1.6, 1.6, 0.1, 0.1
			armZ = 1.2 * wind * (1 - smooth((a - 0.8) / 0.2))
			crouch = 0.3 * wind
		elseif st == "summon" or st == "roar" then
			local up = smooth(a / 0.3) * (1 - smooth((a - 0.85) / 0.15))
			armL, armR = lerp(0.4, 3.0, up), lerp(0.4, 3.0, up)
			armZ, elL, elR = 0.6 * up, 0.3, 0.3
			lean = 0.35 * up + math.sin(now * 30) * 0.04 * up
		elseif st == "barrel" or st == "boulder" then
			local wind, rel = smooth(a / 0.48), smooth((a - 0.48) / 0.12)
			armL = lerp(lerp(0.5, 3.0, wind), 1.0, rel)
			armR = armL
			elL, elR = lerp(0.3, 1.0, wind), lerp(0.3, 1.0, wind)
			lean = lerp(lerp(0, 0.4, wind), -0.5, rel) * (1 - smooth((a - 0.75) / 0.25))
		elseif st == "leap" then
			if a < 0.25 then
				crouch = smooth(a / 0.25) * 0.8
				armL, armR = 0.2, 0.2
			elseif a < 0.75 then
				armL, armR, elL, elR, lean = 2.9, 2.9, 0.3, 0.3, 0.2
			else
				local u = smooth((a - 0.75) / 0.25)
				crouch = (1 - u) * 0.9
				armL, armR = lerp(0.2, 1, u), lerp(0.2, 1, u)
				lean = -0.4 * (1 - u)
			end
		end

		-- legs: shuffle with a limp (zombies), stomp (giants), gallop (monkeys)
		local legA = (run and 0.85 or 0.45) * walk
		local la, ra = (v.limp == "L") and 0.5 or 1, (v.limp == "R") and 0.5 or 1
		local hipL, hipR = legA * sn * la, -legA * sn * ra
		local kA = (run and 1.25 or 0.8) * walk
		local kneeL = -kA * math.max(0, cs) * la - 0.06 - 0.12 * idle - crouch
		local kneeR = -kA * math.max(0, -cs) * ra - 0.06 - 0.12 * idle - crouch
		local shift = math.sin(t * 0.8) * 0.05 * idle
		local mk = monkey and 0.5 or 0 -- monkeys squat
		setJ(J, "HipL", CFrame.Angles(hipL + 0.05 + crouch * 0.5 + mk, 0, -0.04 + shift))
		setJ(J, "HipR", CFrame.Angles(hipR + 0.05 + crouch * 0.5 + mk, 0, 0.04 + shift))
		setJ(J, "KneeL", CFrame.Angles(kneeL - mk * 1.2, 0, 0))
		setJ(J, "KneeR", CFrame.Angles(kneeR - mk * 1.2, 0, 0))
		setJ(J, "AnkleL", CFrame.Angles(-(hipL + kneeL) * 0.7 + ((v.limp == "L") and -0.3 * walk or 0) + mk * 0.7, 0, 0))
		setJ(J, "AnkleR", CFrame.Angles(-(hipR + kneeR) * 0.7 + ((v.limp == "R") and -0.3 * walk or 0) + mk * 0.7, 0, 0))

		-- body: bob, sway, limp dip, hunch
		local bob = -0.12 * s * walk * sn * sn
		if heavy then bob *= 1.6 end
		local dip = 0
		if v.limp == "L" then dip = -0.1 * s * walk * math.max(0, -sn) elseif v.limp == "R" then dip = -0.1 * s * walk * math.max(0, sn) end
		local limpRoll = ((v.limp == "L") and 0.06 or ((v.limp == "R") and -0.06 or 0)) * walk
		local mkDown = monkey and -0.35 * s or 0
		setJ(J, "Root", CFrame.new(0, bob + dip - crouch * 0.4 * s + mkDown, 0) * CFrame.Angles(0, sn * 0.12 * walk + spin, sn * 0.07 * walk + limpRoll))
		local hunch = run and (monkey and 0.95 or 0.5) or v.hunch
		setJ(J, "Waist", CFrame.Angles(-hunch - 0.08 * walk + hurt * 0.55 + lean, -sn * 0.16 * walk + tw * 0.25, -sn * 0.1 * walk + math.sin(t * 0.7) * 0.05))
		local roll = math.sin(t * 0.9) * (def.boss and 0.06 or 0.22) + tw * 0.75
		local nod = hunch * 0.7 + 0.1 + math.sin(t * 1.3) * 0.08 + hurt * 0.6 - (has(v.flags, 1) and 0.1 or 0) + headX
		setJ(J, "Neck", CFrame.Angles(nod, math.sin(t * 0.6) * 0.3 * idle, roll))

		-- arms
		local sway = math.sin(t * 2.1) * 0.08
		local abob = math.sin(ph * 2) * 0.07 * walk
		for _, side in ipairs({ "L", "R" }) do
			local sx = side == "R" and 1 or -1
			local style = v.arms
			if style == "drag" then style = (side == "L") and "limp" or "reach" end
			local sh, el
			local act = (side == "L") and armL or armR
			if act then
				sh = CFrame.Angles(act + hunch * 0.6 + sway * 0.3, 0, sx * (0.18 + armZ))
				el = CFrame.Angles((side == "L") and elL or elR, 0, 0)
			elseif monkey then
				-- knuckle-walk: long arms swing like front legs
				local g = run and 1 or walk
				sh = CFrame.Angles(0.55 + hunch * 0.8 + (run and 0.9 or 0.5) * g * math.sin(ph + (sx > 0 and math.pi or 0)), 0, sx * 0.15)
				el = CFrame.Angles(0.3 + 0.4 * math.max(0, math.cos(ph + (sx > 0 and math.pi or 0))) * g, 0, 0)
			elseif run then
				sh = CFrame.Angles(0.75 + hunch * 0.5 + sn * sx * 0.9, 0, sx * 0.28)
				el = CFrame.Angles(1.25, 0, 0)
			elseif style == "reach" then
				sh = CFrame.Angles(1.3 + hunch * 0.8 + sway * sx + abob, 0, sx * 0.12)
				el = CFrame.Angles(0.2 + math.sin(t * 3 + sx) * 0.08, 0, 0)
			else
				sh = CFrame.Angles(-sn * sx * 0.38 * walk + 0.12 + hunch * 0.3 + sway * 0.5, 0, sx * 0.1)
				el = CFrame.Angles(0.15 + 0.1 * walk, 0, 0)
			end
			if hurt > 0 then sh = CFrame.Angles(-0.7 * hurt, 0, sx * 0.4 * hurt) * sh end
			setJ(J, "Shoulder" .. side, sh)
			setJ(J, "Elbow" .. side, el)
		end
		if J.Tail1 then
			setJ(J, "Tail1", CFrame.Angles(0.5 + math.sin(t * 2) * 0.2, math.sin(t * 1.4) * 0.5, 0))
			setJ(J, "Tail2", CFrame.Angles(0.4 + math.sin(t * 2 - 0.6) * 0.3, math.sin(t * 1.4 - 0.8) * 0.5, 0))
		end
	end

	local function animRise(v, now)
		local J = v.J
		local t = now + v.seed
		local claw = math.sin(t * 9)
		setJ(J, "ShoulderL", CFrame.Angles(2.9 + claw * 0.25, 0, -0.25))
		setJ(J, "ShoulderR", CFrame.Angles(2.9 - claw * 0.25, 0, 0.25))
		setJ(J, "ElbowL", CFrame.Angles(0.3 + claw * 0.2, 0, 0))
		setJ(J, "ElbowR", CFrame.Angles(0.3 - claw * 0.2, 0, 0))
		setJ(J, "Waist", CFrame.Angles(-0.25 + math.sin(t * 4) * 0.08, 0, math.sin(t * 5) * 0.1))
		setJ(J, "Neck", CFrame.Angles(0.4, 0, math.sin(t * 3) * 0.3))
	end

	local function animDog(v, dt, now)
		local J, s = v.J, v.s
		if v.freeze > 0 then
			v.freeze -= dt
			return
		end
		local spd = v.vis
		local gallop = spd > 8
		local stride = (gallop and 5.2 or 2.4) * s
		v.phase = (v.phase + dt * spd / stride * math.pi) % (math.pi * 2)
		local walk = math.clamp(spd / (1.5 * s), 0, 1)
		local idle = 1 - walk
		local ph = v.phase
		local t = now + v.seed
		v.hurtT = math.max(0, v.hurtT - dt * 3.5)
		local hurt = v.hurtT
		local A = gallop and 0.8 or 0.5 * walk
		local offs = gallop and DOG_GALLOP or DOG_TROT
		local crouch, leap, leapPitch = 0, 0, 0
		local st, a = v.state, v.atkT
		if st == "pounce" then
			if a < 0.28 then
				crouch = smooth(a / 0.28)
			elseif a < 0.7 then
				local u = (a - 0.28) / 0.42
				leap = math.sin(u * math.pi)
				leapPitch = math.cos(u * math.pi) * 0.35
				crouch = 1 - smooth(u * 3)
			end
		elseif st == "attack" then
			crouch = math.sin(math.clamp(a / 0.6, 0, 1) * math.pi) * 0.6
		end
		for _, id in ipairs(DOG_LEGS) do
			local p = ph + offs[id]
			local lift = math.max(0, math.cos(p)) * (gallop and 1 or walk)
			local hip, knee
			if id == "FL" or id == "FR" then
				hip = A * math.sin(p) + leap * 1.1 - crouch * 0.3
				knee = -0.75 * lift - crouch * 0.4
			else
				hip = A * math.sin(p) + 0.3 - leap * 1.0 + crouch * 0.6
				knee = -0.55 - 0.6 * lift - crouch * 0.6
			end
			setJ(J, "Leg" .. id, CFrame.Angles(hip, 0, 0))
			setJ(J, "Knee" .. id, CFrame.Angles(knee, 0, 0))
		end
		local bob = (gallop and math.abs(math.sin(ph)) * 0.25 or math.abs(math.sin(ph)) * 0.07 * walk) * s
		local flex = gallop and math.sin(ph) * 0.14 or 0
		local cr = -crouch * 0.35 * s
		setJ(J, "Spine1", CFrame.new(0, bob + cr, 0) * CFrame.Angles(flex + leapPitch + hurt * 0.2, 0, hurt * 0.25))
		setJ(J, "Spine2", CFrame.new(0, bob + cr * 1.2, 0) * CFrame.Angles(-flex + leapPitch * 0.6, 0, -hurt * 0.15))
		local aggro = has(v.flags, 1)
		local growl = (aggro and walk < 0.3 and st ~= "pounce") and 1 or 0
		local sniff = (not aggro) and idle or 0
		local headPitch = -0.15 - sniff * (0.55 + math.sin(t * 6) * 0.08) - growl * 0.25 - flex * 0.6 + leap * 0.3 + hurt * 0.5
		if st == "attack" then headPitch -= math.sin(math.clamp(a / 0.6, 0, 1) * math.pi) * 0.5 end
		setJ(J, "Neck", CFrame.Angles(headPitch, math.sin(t * 0.7) * 0.25 * idle, math.sin(t * 1.3) * 0.1 * idle + hurt * 0.3))
		local open = 0.1 + math.max(0, math.sin(t * 7)) * 0.06
		if st == "pounce" then open = 0.15 + 0.75 * math.max(crouch * 0.5, leap) end
		if st == "attack" then open = 0.2 + 0.7 * math.sin(math.clamp(a / 0.6, 0, 1) * math.pi) end
		if growl > 0 then open = 0.25 + math.abs(math.sin(t * 14)) * 0.15 end
		if hurt > 0.5 then open = 0.6 end
		setJ(J, "Jaw", CFrame.Angles(-open, 0, 0))
		local wag = aggro and 3 or 6
		setJ(J, "Tail1", CFrame.Angles(-0.55 + (gallop and 0.45 or 0) + hurt * 0.6, math.sin(t * wag) * (aggro and 0.15 or 0.45), 0))
		setJ(J, "Tail2", CFrame.Angles(0.2, math.sin(t * wag - 0.8) * 0.4, 0))
	end

	local function animDeadPose(v, u)
		local J = v.J
		if v.def.rig == "dog" then
			setJ(J, "LegFL", CFrame.Angles(0.5 * u, 0, 0))
			setJ(J, "LegFR", CFrame.Angles(0.35 * u, 0, 0))
			setJ(J, "LegHL", CFrame.Angles(-0.4 * u, 0, 0))
			setJ(J, "LegHR", CFrame.Angles(-0.25 * u, 0, 0))
			setJ(J, "Neck", CFrame.Angles(-0.3 * u, 0, 0))
			setJ(J, "Jaw", CFrame.Angles(-0.45 * u, 0, 0))
		else
			setJ(J, "ShoulderL", CFrame.Angles(lerp(1.2, 0.4, u), 0, -0.6 * u))
			setJ(J, "ShoulderR", CFrame.Angles(lerp(1.2, 0.2, u), 0, 0.7 * u))
			setJ(J, "ElbowL", CFrame.Angles(0.3, 0, 0))
			setJ(J, "ElbowR", CFrame.Angles(0.5, 0, 0))
			setJ(J, "Neck", CFrame.Angles(0.3 * u, 0, 0.5 * u))
			setJ(J, "Waist", CFrame.Angles(0, 0, 0.1 * u))
			setJ(J, "KneeL", CFrame.Angles(-0.3 * u, 0, 0))
			setJ(J, "KneeR", CFrame.new())
			setJ(J, "Root", CFrame.new())
		end
	end

	------------------------------------------------------------------------------------------ status visuals (on fire, poisoned, frozen, ignited gas zombie)
	local function statusFx(v)
		local f = v.flags
		local chest = v.P.chest or v.P.root
		local burning = has(f, 4) or has(f, 16)
		if burning and not v.fire then
			v.fire = make("Fire", { Size = (has(f, 16) and 5 or 3) * v.s, Heat = 7, Color = Color3.fromRGB(255, 140, 40), SecondaryColor = Color3.fromRGB(255, 60, 20), Parent = chest })
			if has(f, 16) then
				v.fireLight = make("PointLight", { Range = 16, Brightness = 2, Color = Color3.fromRGB(255, 140, 50), Parent = chest })
				if v.P.head then v.headFire = make("Fire", { Size = 3 * v.s, Heat = 9, Color = Color3.fromRGB(255, 150, 40), SecondaryColor = Color3.fromRGB(255, 70, 20), Parent = v.P.head }) end
				if v.P.uArmL then make("Fire", { Size = 2 * v.s, Heat = 6, Parent = v.P.uArmL }) end
				if v.P.uArmR then make("Fire", { Size = 2 * v.s, Heat = 6, Parent = v.P.uArmR }) end
			end
		elseif not burning and v.fire then
			v.fire:Destroy()
			v.fire = nil
		end
		local poisoned = has(f, 8)
		if poisoned and not v.poisonFx then
			v.poisonFx = make("ParticleEmitter", { Rate = 12, Lifetime = NumberRange.new(0.5, 1), Speed = NumberRange.new(1, 2.5),
				Size = NumberSequence.new(0.25, 0), Color = ColorSequence.new(Color3.fromRGB(130, 255, 80)), LightEmission = 0.5, Parent = chest })
		elseif v.poisonFx then
			v.poisonFx.Enabled = poisoned
		end
		local slow = has(f, 2)
		if slow and not v.frostFx then
			v.frostFx = make("ParticleEmitter", { Rate = 14, Lifetime = NumberRange.new(0.6, 1.1), Speed = NumberRange.new(0.5, 1.5), SpreadAngle = Vector2.new(180, 180),
				Size = NumberSequence.new(0.2, 0), Color = ColorSequence.new(Color3.fromRGB(200, 240, 255)), LightEmission = 0.6, Parent = chest })
		elseif v.frostFx then
			v.frostFx.Enabled = slow
		end
	end

	------------------------------------------------------------------------------------------ per-frame update
	local function rootCF(v, extra)
		local cf = CFrame.new(v.pos.X, v.rootH + v.extraY + extra, v.pos.Z) * CFrame.Angles(0, v.yaw, 0)
		local st, a = v.state, v.atkT
		if st == "attack" and v.def.rig ~= "dog" then
			local lunge = ((v.def.ai == "slam" or v.def.boss) and 0.6 or 1) * v.s * math.max(0, math.sin(math.clamp((a - 0.35) / 0.45, 0, 1) * math.pi))
			cf = cf * CFrame.new(0, 0, -lunge)
		end
		return cf
	end

	function Views.update(dt, now, camPos)
		for _, v in pairs(Views.list) do
			if v.removed then continue end
			if not v.model.Parent then
				destroy(v)
				continue
			end
			if not v.alive then
				v.deadT += dt
				local t = v.deadT
				local u = math.min(1, t / 0.55)
				local fall = u * u
				local cf
				if v.def.rig == "dog" then
					cf = v.deathCF * CFrame.new(0, lerp(v.rootH, 0.75 * v.s, fall), 0) * CFrame.Angles(0, 0, math.rad(88) * fall)
				else
					local ang = math.rad(86) * fall * v.fallSign
					cf = v.deathCF * CFrame.Angles(ang, 0, 0) * CFrame.new(0, v.rootH, 0) + Vector3.new(0, 0.5 * v.s * math.abs(math.sin(ang)), 0)
				end
				if t > 2.4 then cf -= Vector3.new(0, math.min(1, (t - 2.4) / 1.3) * 2.6 * v.s, 0) end
				v.P.root.CFrame = cf
				animDeadPose(v, u)
				if t > 3.8 then destroy(v) end
				continue
			end
			-- follow the brain's position
			local before = v.pos
			if v.tpos then
				if v.exact then
					v.pos, v.yaw, v.extraY = v.tpos, v.tyaw, v.textraY
				else
					local k = 1 - math.exp(-dt * 14)
					v.pos = v.pos:Lerp(v.tpos, k)
					v.yaw += angDiff(v.yaw, v.tyaw) * k
					v.extraY = lerp(v.extraY, v.textraY, 1 - math.exp(-dt * 20))
				end
			end
			if not v.exact then v.atkT = math.clamp((now - v.t0) / stateDur(v.def, v.state), 0, 1) end
			local moved = flat(v.pos - before).Magnitude / math.max(dt, 1e-3)
			if v.state == "pounce" or v.state == "leap" then moved = 0 end
			v.vis += (math.min(moved, 30) - v.vis) * math.min(1, dt * 8)
			v.rising = v.state == "rise"
			local d = camPos and (v.pos - camPos).Magnitude or 0
			v.frame += 1
			-- level of detail: far monsters animate less often
			local every = d > 200 and 4 or (d > 110 and 2 or 1)
			local extra = 0
			if v.rising then extra = -(v.rootH + 3.3 * v.s) * (1 - easeOut(v.atkT)) end
			v.liftT = math.max(0, v.liftT - dt * 2.5)
			extra += math.sin(v.liftT * math.pi) * 2.2
			v.P.root.CFrame = rootCF(v, extra)
			if v.frame % every == 0 then
				local adt = dt * every
				if v.rising then
					animRise(v, now)
					if rng:NextNumber() < dt * 10 then FX.burst(FX.dust, Vector3.new(v.pos.X, 0.3, v.pos.Z), 2) end
				elseif v.def.rig == "dog" then
					animDog(v, adt, now)
				else
					animBiped(v, adt, now)
				end
				statusFx(v)
				if v.bar then
					v.bar.Enabled = v.hpFrac < 0.999 or v.kind == "avatar"
					v.barFill.Size = UDim2.fromScale(v.hpFrac, 1)
				end
			end
			-- groans and growls now and then
			if now > v.nextSound and d < 90 then
				local aggro = has(v.flags, 1)
				v.nextSound = now + rng:NextNumber(aggro and 3 or 6, aggro and 6 or 12)
				local head = v.P.head
				if head and head.Parent then
					if v.def.rig == "dog" then playSfx(aggro and "dogBark" or "dogGrowl", head, { vary = 0.15, vol = 0.7 })
					elseif v.def.rig == "monkey" then playSfx("dogBark", head, { pitch = 2, vary = 0.15, vol = 0.6 })
					else playSfx("zGroan", head, { vary = 0.15, vol = 0.7, pitch = (v.def.ai == "slam" or v.def.boss) and 0.65 or 1 }) end
				end
			end
		end
	end

	------------------------------------------------------------------------------------------ you hit a monster
	function Views.hit(v, dmg, o)
		if not v.alive or v.rising then return end
		dmg = math.max(1, math.floor(dmg + 0.5))
		local flags = (o.crit and 1 or 0) + (o.finisher and 2 or 0) + (o.lift and 4 or 0)
		local head = (v.P.head and v.P.head.Position) or v.pos + Vector3.new(0, 4, 0)
		v.hurtT, v.freeze = 1, 0.07
		if o.lift and not v.def.boss then v.liftT = 1 end
		FX.flash(v.model, WHITE)
		FX.burst(FX.spark, head, 9, o.color or WHITE)
		if v.kind ~= "avatar" then FX.burst(FX.goo, head - Vector3.new(0, 0.6 * v.s, 0), 7, (v.kind == "toxic" or v.kind == "monkey") and Color3.fromRGB(140, 255, 60) or nil) end
		if not o.splash then
			playSfx("hit", head, { vary = 0.12 })
			playSfx("splat", head, { vary = 0.2 })
		end
		FX.pop(head + Vector3.new(0, 1.4 * v.s, 0), o.crit and ("CRIT " .. commas(dmg) .. "!") or commas(dmg),
			o.crit and Color3.fromRGB(255, 140, 40) or (o.finisher and GOLD or (o.splash and Color3.fromRGB(255, 160, 60) or WHITE)), o.crit or o.finisher)
		if o.effect == "frost" then
			FX.burst(FX.magic, head, 12, Color3.fromRGB(150, 230, 255))
			playSfx("frost", head)
			FX.flash(v.model, Color3.fromRGB(140, 220, 255), 0.35)
		elseif o.effect == "burn" then
			playSfx("burn", head)
		elseif o.effect == "pumpkin" then
			FX.burst(FX.magic, head, 10, Color3.fromRGB(190, 90, 255))
		end
		if Link.coop then
			Link.send("hit", v.id, dmg, flags, o.effect)
		else
			Sim.now = os.clock()
			Sim.damage(v.id, dmg, player.UserId, { crit = o.crit, finisher = o.finisher, effect = o.effect, from = o.from })
		end
	end

	------------------------------------------------------------------------------------------ messages about monsters
	On.hitfx = function(id, amount, style, attacker)
		if attacker == player.UserId then return end
		local v = Views.list[id]
		if not v or not v.alive then return end
		local head = (v.P.head and v.P.head.Position) or v.pos
		if style == 2 then
			FX.pop(head + Vector3.new(0, 1, 0), tostring(amount), has(v.flags, 4) and Color3.fromRGB(255, 150, 50) or Color3.fromRGB(140, 255, 90))
			return
		end
		v.hurtT, v.freeze = 1, 0.05
		FX.flash(v.model, WHITE)
		FX.burst(FX.spark, head, 6, WHITE)
		playSfx("hit", head, { vary = 0.12, vol = 0.6 })
		FX.pop(head + Vector3.new(0, 1.4 * v.s, 0), style == 1 and ("CRIT " .. commas(amount) .. "!") or commas(amount), style == 1 and Color3.fromRGB(255, 140, 40) or Color3.fromRGB(220, 220, 230))
	end

	On.died = function(id, fall, credits, x, z, explode, kind)
		local v = Views.list[id]
		local pos = Vector3.new(x, 0, z)
		kind = kind or (v and v.kind) or "zombie"
		local def = MOBS[kind] or MOBS.zombie
		if v and v.alive then
			v.alive = false
			v.deadT = 0
			v.fallSign = fall
			v.state = "dead"
			v.deathCF = CFrame.new(v.pos.X, 0, v.pos.Z) * CFrame.Angles(0, v.yaw, 0)
			if v.bar then v.bar.Enabled = false end
			if v.fire then v.fire.Enabled = false end
			if v.poisonFx then v.poisonFx.Enabled = false end
			local head = (v.P.head and v.P.head.Position) or pos
			FX.burst(FX.goo, head, 12)
			FX.burst(FX.dust, Vector3.new(x, 0.6, z), def.ai == "slam" and 16 or 6)
			if def.rig == "dog" then
				playSfx("dogBark", head, { pitch = 1.7, vol = 0.7 })
			elseif def.rig == "monkey" then
				playSfx("dogBark", head, { pitch = 2.4, vol = 0.8 })
			else
				playSfx("zDeath", head, { vary = 0.1, pitch = (def.ai == "slam" or def.boss) and 0.6 or 1 })
			end
			if def.ai == "slam" or def.boss then
				shake(0.4, 0.5)
				FX.shockwave(Vector3.new(x, 0.4, z), def.boss and 16 or 9, Color3.fromRGB(200, 170, 120), 0.6)
			end
		end
		if explode == 1 then
			FX.tele(x, z, 9, 0.7, "fire")
			playSfx("burn", pos, { vol = 1.4 })
		end
		-- rewards for everyone who helped
		if type(credits) == "table" and table.find(credits, player.UserId) then
			if Pickups.reward then Pickups.reward(def, pos) end
		end
	end

	-- projectiles: ice chunks, toxic spit, toxic barrels, ice boulders
	On.proj = function(style, mobId, fx, fz, tx, tz, flight, r)
		local v = Views.list[mobId]
		local from = Vector3.new(fx, 4, fz)
		if v and v.P.handR and v.P.handR.Parent then from = v.P.handR.Position
		elseif v and v.P.head and v.P.head.Parent then from = v.P.head.Position end
		local to = Vector3.new(tx, 0.6, tz)
		FX.tele(tx, tz, r or 3.5, flight, (style == "ice" or style == "boulder") and "ice" or "toxic")
		local size, col, mat = 1.4, Color3.fromRGB(160, 225, 255), Enum.Material.Ice
		if style == "toxic" then size, col, mat = 1.1, Color3.fromRGB(140, 255, 60), Enum.Material.Neon
		elseif style == "barrel" then size, col, mat = 3, Color3.fromRGB(220, 190, 40), Enum.Material.Metal
		elseif style == "boulder" then size, col, mat = 4.5, Color3.fromRGB(170, 225, 255), Enum.Material.Ice end
		local p = make("Part", { Shape = (style == "barrel") and Enum.PartType.Cylinder or Enum.PartType.Ball, Size = (style == "barrel") and Vector3.new(size, size * 0.8, size * 0.8) or Vector3.new(size, size, size),
			Material = mat, Color = col, Anchored = true, CanCollide = false, CanQuery = false, CanTouch = false, CastShadow = false, CFrame = CFrame.new(from), Parent = fxFolder })
		if style == "barrel" then
			make("Part", { Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.5, size * 0.82, size * 0.82), Material = Enum.Material.Neon, Color = Color3.fromRGB(140, 255, 60),
				Anchored = true, CanCollide = false, CanQuery = false, CanTouch = false, CFrame = CFrame.new(from), Parent = p })
		end
		local a0 = make("Attachment", { Position = Vector3.new(0, size * 0.3, 0), Parent = p })
		local a1 = make("Attachment", { Position = Vector3.new(0, -size * 0.3, 0), Parent = p })
		make("Trail", { Attachment0 = a0, Attachment1 = a1, Lifetime = 0.3, Color = ColorSequence.new(col), Transparency = NumberSequence.new(0.3, 1),
			LightEmission = 0.6, Parent = p })
		playSfx("whoosh", from, { pitch = 0.8, vol = 0.7 })
		local h = math.max(6, (to - from).Magnitude * 0.3)
		local t0 = os.clock()
		local conn
		conn = RunService.RenderStepped:Connect(function()
			local u = math.clamp((os.clock() - t0) / flight, 0, 1)
			local pos = from:Lerp(to, u) + Vector3.new(0, math.sin(u * math.pi) * h, 0)
			p.CFrame = CFrame.new(pos) * CFrame.Angles(u * 9, u * 6, 0)
			for _, c in ipairs(p:GetChildren()) do
				if c:IsA("BasePart") then c.CFrame = p.CFrame end
			end
			if u >= 1 then
				conn:Disconnect()
				p:Destroy()
				if style == "toxic" or style == "barrel" then
					FX.burst(FX.toxic, to, style == "barrel" and 30 or 14)
					playSfx("splat", to, { pitch = 0.5, vol = 1.6 })
					if style == "barrel" then playSfx("boom", to, { vol = 0.6, pitch = 1.2 }) end
				else
					FX.burst(FX.ice, to, style == "boulder" and 30 or 14)
					playSfx("frost", to, { vol = 1.2 })
					playSfx("hit", to, { pitch = 0.6 })
				end
				FX.shockwave(to, r or 3.5, col, 0.3)
				local root = getRoot()
				if root and (root.Position - to).Magnitude < 40 then shake(style == "boulder" and 0.6 or 0.2, 0.3) end
			end
		end)
	end

	On.puddle = function(x, z, r, dur)
		local pos = Vector3.new(x, 0.15, z)
		local pd = make("Part", { Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.12, 1, 1), Material = Enum.Material.Neon, Color = Color3.fromRGB(110, 230, 50),
			Transparency = 0.3, Anchored = true, CanCollide = false, CanQuery = false, CanTouch = false, CastShadow = false,
			CFrame = CFrame.new(pos) * CFrame.Angles(0, 0, math.pi / 2), Parent = fxFolder })
		tween(pd, 0.3, { Size = Vector3.new(0.12, r * 2, r * 2) })
		make("ParticleEmitter", { Rate = 8, Lifetime = NumberRange.new(0.6, 1.2), Speed = NumberRange.new(1, 3), SpreadAngle = Vector2.new(20, 20),
			Size = NumberSequence.new(0.5, 0), Color = ColorSequence.new(Color3.fromRGB(160, 255, 80)), LightEmission = 0.6, Parent = pd })
		task.delay(math.max(0.5, dur - 0.6), function()
			if pd.Parent then tween(pd, 0.6, { Transparency = 1, Size = Vector3.new(0.12, 0.2, 0.2) }) end
		end)
		Debris:AddItem(pd, dur + 0.2)
	end

	On.tele = function(x, z, r, t, style) FX.tele(x, z, r, t, style) end

	On.boom = function(x, z, r, style)
		local pos = Vector3.new(x, 0.4, z)
		local root = getRoot()
		local dist = root and flat(root.Position - pos).Magnitude or 100
		local near = math.clamp(1 - dist / 70, 0, 1)
		if style == "ice" or style == "spike" then
			FX.shockwave(pos, r, Color3.fromRGB(150, 225, 255), 0.45)
			FX.burst(FX.ice, pos, 24)
			playSfx("frost", pos, { vol = 1.3 })
			playSfx("slam", pos, { vol = 0.7, pitch = 1.2 })
			if style == "spike" then
				for k = 1, 5 do
					local ang = k / 5 * math.pi * 2
					local sp = make("Part", { Size = Vector3.new(1.4, 0.2, 1.4), Material = Enum.Material.Ice, Color = Color3.fromRGB(180, 235, 255), Transparency = 0.15,
						Anchored = true, CanCollide = false, CanQuery = false, CanTouch = false,
						CFrame = CFrame.new(pos + Vector3.new(math.cos(ang) * r * 0.5, 0, math.sin(ang) * r * 0.5)) * CFrame.Angles(rng:NextNumber(-0.3, 0.3), ang, rng:NextNumber(-0.3, 0.3)),
						Parent = fxFolder })
					local hgt = rng:NextNumber(4, 7)
					tween(sp, 0.12, { Size = Vector3.new(1.4, hgt, 1.4), CFrame = sp.CFrame * CFrame.new(0, hgt / 2, 0) })
					task.delay(0.9, function() if sp.Parent then tween(sp, 0.4, { Transparency = 1 }) end end)
					Debris:AddItem(sp, 1.4)
				end
			end
		elseif style == "fire" then
			FX.shockwave(pos, r, Color3.fromRGB(255, 140, 40), 0.45)
			FX.burst(FX.fire, pos + Vector3.new(0, 2, 0), 40)
			playSfx("boom", pos, { vol = 1.2, range = 200 })
			local l = make("PointLight", { Range = 30, Brightness = 6, Color = Color3.fromRGB(255, 150, 60), Parent = soundAnchor(pos + Vector3.new(0, 3, 0), 1) })
			tween(l, 0.6, { Brightness = 0 })
		elseif style == "roar" then
			FX.shockwave(pos, r, Color3.fromRGB(200, 120, 255), 0.6)
			playSfx("roar", pos, { pitch = 0.55, vol = 1.3, range = 260 })
		else
			FX.shockwave(pos, r, Color3.fromRGB(210, 180, 120), 0.5)
			FX.burst(FX.dust, pos, 18)
			playSfx("slam", pos, { vol = 1.1, range = 200 })
		end
		if near > 0 then shake(0.15 + near * 0.65, 0.45) end
	end

	On.hurt = function(dmg, fx, fz, effect)
		Player.hurt(dmg, Vector3.new(fx, 0, fz), (effect ~= "" and effect) or nil)
	end
end

------------------------------------------------------------------------------------------------
-- COINS + 🍬 CANDY PICKUPS
------------------------------------------------------------------------------------------------
do
	local list = {}
	local CANDY_COLORS = { Color3.fromRGB(255, 70, 90), Color3.fromRGB(170, 90, 255), Color3.fromRGB(255, 150, 30), Color3.fromRGB(90, 220, 110), Color3.fromRGB(80, 180, 255) }

	local function makeCoin(pos, value, dropped)
		local size = dropped and 1.6 or 2.4
		local outer = make("Part", { Name = "Coin", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.32, size, size), Material = Enum.Material.Neon,
			Color = Color3.fromRGB(255, 196, 40), Anchored = true, CanCollide = false, CanQuery = false, CanTouch = false, CastShadow = false,
			CFrame = CFrame.new(pos), Parent = pickFolder })
		local inner = make("Part", { Name = "Face", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.4, size * 0.62, size * 0.62), Material = Enum.Material.Metal,
			Color = Color3.fromRGB(226, 156, 22), Anchored = false, Massless = true, CanCollide = false, CanQuery = false, CanTouch = false, CastShadow = false,
			CFrame = CFrame.new(pos), Parent = outer })
		weld(outer, inner)
		if not dropped then make("Sparkles", { SparkleColor = Color3.fromRGB(255, 240, 150), Parent = outer }) end
		local c = { part = outer, value = value, dropped = dropped, base = pos, phase = rng:NextNumber(0, 6), born = os.clock(), magnet = false, kind = "coin", world = S.world }
		table.insert(list, c)
		return c
	end

	local function makeCandy(pos, dropped)
		local col = pick(CANDY_COLORS)
		local ball = make("Part", { Name = "Candy", Shape = Enum.PartType.Ball, Size = Vector3.new(1.5, 1.5, 1.5), Material = Enum.Material.SmoothPlastic, Color = col,
			Anchored = true, CanCollide = false, CanQuery = false, CanTouch = false, CastShadow = false, CFrame = CFrame.new(pos), Parent = pickFolder })
		local stripe = make("Part", { Size = Vector3.new(1.55, 0.4, 1.55), Material = Enum.Material.Neon, Color = WHITE, Anchored = false,
			Massless = true, CanCollide = false, CanQuery = false, CanTouch = false, CastShadow = false, CFrame = CFrame.new(pos) * CFrame.Angles(0, 0, 0.6), Parent = ball })
		make("SpecialMesh", { MeshType = Enum.MeshType.Sphere, Parent = stripe })
		weld(ball, stripe)
		for _, sx in ipairs({ -1, 1 }) do
			local w = make("WedgePart", { Size = Vector3.new(0.2, 1.1, 1.1), Material = Enum.Material.SmoothPlastic, Color = col:Lerp(WHITE, 0.3), Anchored = false, Massless = true,
				CanCollide = false, CanQuery = false, CanTouch = false, CastShadow = false,
				CFrame = CFrame.new(pos) * CFrame.new(sx * 1.1, 0, 0) * CFrame.Angles(0, sx > 0 and math.pi / 2 or -math.pi / 2, 0), Parent = ball })
			weld(ball, w)
		end
		make("PointLight", { Range = 8, Brightness = 1.2, Color = col, Shadows = false, Parent = ball })
		local c = { part = ball, value = 1, dropped = dropped, base = pos, phase = rng:NextNumber(0, 6), born = os.clock(), magnet = false, kind = "candy", world = S.world }
		table.insert(list, c)
		return c
	end

	local function toss(c, pos)
		local a, r = rng:NextNumber(0, math.pi * 2), rng:NextNumber(1.2, 3.8)
		c.fromPos = pos + Vector3.new(0, 2.5, 0)
		c.toPos = Vector3.new(pos.X + math.cos(a) * r, 1.6, pos.Z + math.sin(a) * r)
		c.tossT = 0
	end

	function Pickups.dropCoins(pos, total)
		local n = math.clamp(math.floor(total / 8), 1, 8)
		local each = math.ceil(total / n)
		for _ = 1, n do toss(makeCoin(pos + Vector3.new(0, 2.5, 0), each, true), pos) end
		playSfx("coinDrop", pos + Vector3.new(0, 1, 0))
	end
	function Pickups.dropCandy(pos, n)
		for _ = 1, n do toss(makeCandy(pos + Vector3.new(0, 2.5, 0), true), pos) end
	end

	function Pickups.clearWorld()
		for i = #list, 1, -1 do
			list[i].part:Destroy()
			table.remove(list, i)
		end
	end

	-- the Pumpkin Overnight Sword unlocks at 100 candies
	function Pickups.candyCheck(silent)
		if S.candies >= CANDY_GOAL and not S.pumpkin then
			S.pumpkin = true
			S.owned.pumpkin = true
			markDirty()
			if not silent then
				Celebrate.show("🎃 PUMPKIN OVERNIGHT SWORD!", "100 candies collected — the most OP sword in the game is YOURS!", Color3.fromRGB(255, 150, 30), 5)
				playSfx("buy")
				playSfx("magic", nil, { pitch = 0.8 })
				task.delay(0.4, function() playSfx("magic", nil, { pitch = 1.2 }) end)
				if Player.equip then Player.equip("pumpkin") end
			end
		end
	end

	function Pickups.reward(def, pos)
		if def.boss then
			S.kills += 1
			S.coins += def.reward
			S.candies += def.candy or 0
			markDirty()
			Player.pulseCoins()
			Celebrate.show("🏆 " .. string.upper(def.name) .. " DEFEATED!", "+" .. commas(def.reward) .. " coins  ·  +" .. (def.candy or 0) .. " 🍬 candy", GOLD, 5)
			playSfx("buy")
			task.delay(0.3, function() playSfx("magic", nil, { pitch = 1.1 }) end)
			FX.burst(FX.coin, pos + Vector3.new(0, 4, 0), 40)
			Pickups.candyCheck()
		else
			S.kills += 1
			markDirty()
			local mult = (WORLDS[S.world] and WORLDS[S.world].mult or 1) * EVENT_MULT
			Pickups.dropCoins(pos, math.max(1, def.reward * mult))
			local chance = (def.id == "avatar") and 1 or ((def.ai == "slam") and 0.6 or 0.3)
			if rng:NextNumber() < chance then Pickups.dropCandy(pos, 1) end
			HUD.killScale.Scale = 1.2
			tween(HUD.killScale, 0.25, { Scale = 1 }, Enum.EasingStyle.Back)
		end
		if Unlocks.check then Unlocks.check(false) end
	end

	local function collect(c, rp)
		if c.kind == "candy" then
			S.candies += 1
			local bonus = 5 * math.max(1, WORLDS[S.world] and WORLDS[S.world].mult or 1) * EVENT_MULT
			S.coins += bonus
			playSfx("coin", nil, { pitch = 1.5, vary = 0.05 })
			playSfx("magic", nil, { pitch = 1.6, vol = 0.4 })
			FX.pop(rp + Vector3.new(0, 3.4, 0), "+1 🍬  +" .. bonus, CANDY)
			FX.burst(FX.magic, c.part.Position, 10, CANDY)
			HUD.candyScale.Scale = 1.25
			tween(HUD.candyScale, 0.3, { Scale = 1 }, Enum.EasingStyle.Back)
			Pickups.candyCheck()
		else
			S.coins += c.value
			playSfx("coin", nil, { vary = 0.08 })
			FX.pop(rp + Vector3.new(0, 3.2, 0), "+" .. commas(c.value), GOLD)
			FX.burst(FX.coin, c.part.Position, 8)
		end
		markDirty()
		Player.pulseCoins()
	end

	local mapT = 0
	function Pickups.update(dt, now)
		local root = getRoot()
		local rp = root and root.Position
		local canTake = rp ~= nil and S.playing and not S.dead and not S.traveling
		for i = #list, 1, -1 do
			local c = list[i]
			local p = c.part
			if not p.Parent or c.world ~= S.world or (c.dropped and now - c.born > 50) then
				p:Destroy()
				table.remove(list, i)
			else
				local pos
				if c.tossT and c.tossT < 1 then
					c.tossT = math.min(1, c.tossT + dt / 0.5)
					local u = c.tossT
					pos = c.fromPos:Lerp(c.toPos, u) + Vector3.new(0, math.sin(u * math.pi) * 3, 0)
					if u >= 1 then c.base = c.toPos end
				else
					pos = c.base + Vector3.new(0, math.sin(now * 3 + c.phase) * 0.3, 0)
					if canTake then
						local diff = rp - pos
						local d = diff.Magnitude
						if d < 12 then c.magnet = true end
						if c.magnet and d > 0.05 then
							c.base += diff.Unit * math.min(d, (28 + math.max(0, 12 - d) * 6) * dt)
							pos = c.base
						end
						if d < 2.8 then
							collect(c, rp)
							p:Destroy()
							table.remove(list, i)
							pos = nil
						end
					end
				end
				if pos then p.CFrame = CFrame.new(pos) * CFrame.Angles(0, now * 3 + c.phase, c.kind == "candy" and 0.4 or 0) end
			end
		end
		-- shiny coins and candy lying around the fighting worlds
		mapT -= dt
		if mapT <= 0 and S.world ~= "cave" and S.playing then
			mapT = 3
			local coins, candies = 0, 0
			for _, c in ipairs(list) do
				if not c.dropped then
					if c.kind == "candy" then candies += 1 else coins += 1 end
				end
			end
			local L = LAYOUT[S.world]
			local O = L.o
			for _ = 1, 12 do
				local lx, lz = rng:NextNumber(-180, 180), rng:NextNumber(-200, 160)
				if not L.blocked(lx, lz, 2) and circleFree(O.X + lx, O.Z + lz, 2) then
					local wantGate = S.world ~= "grave" or lz > 0 or S.kills >= GRAVE_GATE_KILLS
					if wantGate then
						if candies < 2 and rng:NextNumber() < 0.25 then
							makeCandy(O + Vector3.new(lx, 3, lz), false)
						elseif coins < 10 then
							makeCoin(O + Vector3.new(lx, 3, lz), 5 * WORLDS[S.world].mult * EVENT_MULT, false)
						end
						break
					end
				end
			end
		end
	end
end

------------------------------------------------------------------------------------------------
-- 🔓 UNLOCKING WORLDS (120 kills: graveyard gates · 500: Ice World · 800: Jungle)
------------------------------------------------------------------------------------------------
do
	local seen = {}
	local function openGate(instant)
		local g = Build.gate
		if not g or g.open then return end
		g.open = true
		for _, d in ipairs(g.doors) do
			local goal = d.hinge * CFrame.Angles(0, -d.sx * 1.75, 0) * CFrame.new(-d.sx * 4, 4.6, 0)
			d.panel.CanCollide = false
			if instant then d.panel.CFrame = goal else tween(d.panel, 1.6, { CFrame = goal }, Enum.EasingStyle.Back) end
		end
		local sub = g.sign:FindFirstChild("Sub", true)
		for _, sg in ipairs(g.sign:GetChildren()) do
			if sg:IsA("SurfaceGui") then
				local l = sg:FindFirstChild("Sub")
				if l then l.Text = "✅ GATES OPEN" end
			end
		end
		if sub then sub.Text = "✅ GATES OPEN" end
	end
	function Unlocks.check(silent)
		if S.kills >= GRAVE_GATE_KILLS and not seen.gate then
			seen.gate = true
			openGate(silent)
			if not silent then
				Celebrate.show("⚰ GRAVEYARD UNLOCKED!", GRAVE_GATE_KILLS .. " kills! The graveyard gates are open — giants and the Gravekeeper await.", Color3.fromRGB(255, 160, 60), 5)
				playSfx("clang", nil, { pitch = 0.4, vol = 1.2 })
				playSfx("magic", nil, { pitch = 0.9 })
			end
		end
		for _, wid in ipairs(WORLD_ORDER) do
			local w = WORLDS[wid]
			if w.need > 0 and S.kills >= w.need and not seen[wid] then
				seen[wid] = true
				local lock = Build.locks[wid]
				if lock then
					if silent then
						lock:Destroy()
					else
						for _, p in ipairs(lock:GetDescendants()) do
							if p:IsA("BasePart") then
								p.CanCollide = false
								tween(p, 1, { Transparency = 1 })
							end
						end
						Debris:AddItem(lock, 1.2)
					end
				end
				if not silent then
					Celebrate.show(w.icon .. " " .. string.upper(w.name) .. " UNLOCKED!", w.need .. " kills! Coins are worth " .. w.mult .. "X there.", w.color, 5)
					playSfx("buy")
					task.delay(0.3, function() playSfx("magic", nil, { pitch = 1.2 }) end)
				end
			end
		end
		-- locks for worlds you haven't unlocked yet stay in place
	end
end

------------------------------------------------------------------------------------------------
-- TRAVEL between the cave and the worlds
------------------------------------------------------------------------------------------------
local Amb = {}
do
	local function rootHeightFor(char)
		local hum = char:FindFirstChildOfClass("Humanoid")
		local root = char:FindFirstChild("HumanoidRootPart")
		if hum and root and hum.RigType == Enum.HumanoidRigType.R15 then return hum.HipHeight + root.Size.Y / 2 end
		return 3
	end
	function Player.placeAt(cf)
		local char = player.Character
		local root = char and char:FindFirstChild("HumanoidRootPart")
		if not root then return end
		local h = rootHeightFor(char)
		local p = cf.Position
		char:PivotTo(CFrame.lookAt(Vector3.new(p.X, h + 0.3, p.Z), Vector3.new(p.X, h + 0.3, p.Z) + flat(cf.LookVector)))
		root.AssemblyLinearVelocity = Vector3.zero
		root.AssemblyAngularVelocity = Vector3.zero
	end

	function Player.travel(wid, fromWid, quick)
		if S.traveling and not quick then return end
		S.traveling = true
		if Menu.closeAll then Menu.closeAll() end
		if not quick then
			tween(fadeFrame, 0.35, { BackgroundTransparency = 0 })
			task.wait(0.38)
		end
		for id, f in pairs(Folders) do f.Parent = (id == wid) and worldRoot or nil end
		Views.clear()
		Pickups.clearWorld()
		local old = S.world
		S.world = wid
		Link.send("world", wid)
		if not Link.coop and old ~= wid and SPAWNS[old] then
			-- solo: the world you left goes to sleep (bosses stay)
			local W = Sim.worlds[old]
			for i = #W.mobs, 1, -1 do
				local m = W.mobs[i]
				if not m.def.boss and m.kind ~= "avatar" then
					m.removed = true
					Sim.byId[m.id] = nil
					table.remove(W.mobs, i)
				end
			end
		end
		Look.apply(wid)
		if Amb.set then Amb.set(wid) end
		local cf
		if wid == "cave" then
			cf = (fromWid and Build.tunnels[fromWid] and Build.tunnels[fromWid].arrive) or CAVE_SPAWN
			Player.cure()
		else
			cf = LAYOUT[wid].spawn
		end
		Player.placeAt(cf)
		local w = WORLDS[wid]
		HUD.worldLabel.Text = w.icon .. " " .. string.upper(w.name) .. (((w.mult or 0) > 1) and ("  ·  " .. w.mult .. "X COINS") or "") .. ((w.mult or 0) > 0 and "  🎃x2" or "")
		S.iframes = os.clock() + 1.5
		task.delay(0.1, function()
			tween(fadeFrame, 0.6, { BackgroundTransparency = 1 })
			S.traveling = false
		end)
		if wid == "cave" then
			toast("🕯 Back in the cave — safe! Health refills fast here.", Color3.fromRGB(255, 210, 140))
		else
			toast("📍 " .. w.icon .. " " .. string.upper(w.name) .. "  ·  coins x" .. w.mult .. "  ·  🎃 2X event!", w.color)
		end
	end

	function Player.goHome()
		if not S.playing or S.dead or S.world == "cave" or S.traveling then return end
		if os.clock() - S.lastHurt < 4 then
			toast("⚠ You can't go home in the middle of a fight!", Color3.fromRGB(255, 120, 110))
			return
		end
		Player.travel("cave", S.world)
	end

	function Player.equip(id)
		if not S.owned[id] then return end
		S.equipped = id
		local ca = CA.list[player]
		if ca then CA.attachSword(ca, id) end
		Link.send("sword", id)
		markDirty()
		playSfx("draw")
		toast("⚔ Equipped " .. SWORD_BY_ID[id].name, SWORD_BY_ID[id].trail)
	end

	------------------------------------------------------------------------------------------ ambience + music
	Amb.mCave  = startLoop("mCave", SoundService, 0, { group = Groups.music })
	Amb.mWorld = startLoop("mWorld", SoundService, 0, { group = Groups.music })
	Amb.mBoss  = startLoop("mBoss", SoundService, 0, { group = Groups.music, speed = 1.12 })
	Amb.day    = startLoop("ambDay", SoundService, 0)
	Amb.night  = startLoop("ambNight", SoundService, 0)
	Amb.ghost  = startLoop("ambGhost", SoundService, 0)
	Amb.wind   = startLoop("wind", SoundService, 0)
	local MIX = {
		cave   = { mCave = 0.45, mWorld = 0, day = 0, night = 0.06, ghost = 0.08, wind = 0.06 },
		grave  = { mCave = 0, mWorld = 0.4, day = 0, night = 0.45, ghost = 0.3, wind = 0.2 },
		ice    = { mCave = 0, mWorld = 0.32, day = 0, night = 0, ghost = 0.05, wind = 0.6 },
		jungle = { mCave = 0, mWorld = 0.34, day = 0.55, night = 0.15, ghost = 0, wind = 0.08 },
	}
	Amb.boss = false
	function Amb.set(wid)
		Amb.wid = wid
		for key, vol in pairs(MIX[wid] or MIX.cave) do
			local snd = Amb[key]
			if snd and snd.Parent then
				if key == "mWorld" and Amb.boss then vol = 0 end
				tween(snd, 2, { Volume = vol }, Enum.EasingStyle.Linear)
			end
		end
		if Amb.mBoss then tween(Amb.mBoss, 2, { Volume = Amb.boss and 0.55 or 0 }, Enum.EasingStyle.Linear) end
	end
	function Amb.setBoss(on)
		if Amb.boss == on then return end
		Amb.boss = on
		Amb.set(Amb.wid or "cave")
	end
end

------------------------------------------------------------------------------------------------
-- MENUS: worlds · sword bag · settings
------------------------------------------------------------------------------------------------
do
	local function swordPic(parent, def, size)
		local pic = make("Frame", { AnchorPoint = Vector2.new(0, 0.5), Position = UDim2.new(0, 8, 0.5, 0), Size = size or UDim2.fromOffset(48, 60), BackgroundColor3 = UI.DARK, Parent = parent })
		UI.corner(pic, 10)
		UI.stroke(pic, 2.5)
		local blade = make("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 5), Size = UDim2.new(0, 9, 0.56, 0), BackgroundColor3 = def.bladeC, Parent = pic })
		UI.corner(blade, 3)
		make("UIStroke", { Thickness = 1.5, Color = def.edgeC, Parent = blade })
		make("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0.62, 0), Size = UDim2.new(0.55, 0, 0, 5), BackgroundColor3 = def.guardC, Parent = pic })
		make("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0.7, 0), Size = UDim2.new(0, 6, 0.22, 0), BackgroundColor3 = def.gripC, Parent = pic })
		return pic
	end
	Menu.swordPic = swordPic

	local function fill(name)
		local m = Menu[name]
		Menu.clear(m)
		if name == "worlds" then
			local rows = { { "cave", "The Cave", "Safe zone · Gus's shop · heal up", 0 } }
			for _, wid in ipairs(WORLD_ORDER) do
				local w = WORLDS[wid]
				local info = (wid == "grave") and ("Free! · Graveyard gates at " .. GRAVE_GATE_KILLS .. " kills · coins x" .. w.mult)
					or (w.need .. " kills · coins x" .. w.mult .. (wid == "jungle" and " · HARDEST" or ""))
				table.insert(rows, { wid, w.name, info, w.need })
			end
			for i, r in ipairs(rows) do
				local wid = r[1]
				local w = WORLDS[wid]
				local row = Menu.row(m.list, 74, i)
				UI.icon(row, w.icon, w.color or Color3.fromRGB(255, 200, 120), 56).Position = UDim2.fromOffset(9, 8)
				UI.text({ Text = string.upper(r[2]), Position = UDim2.fromOffset(76, 8), Size = UDim2.new(1, -210, 0, 28), TextXAlignment = Enum.TextXAlignment.Left, Stroke = 2.4, Parent = row })
				UI.text({ Text = r[3], Position = UDim2.fromOffset(76, 40), Size = UDim2.new(1, -210, 0, 20), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = UI.DARK, Stroke = 0, MaxText = 16, Parent = row })
				local here = S.world == wid
				local open = worldUnlocked(wid)
				local label = here and "YOU'RE HERE" or (open and "TRAVEL" or ("🔒 " .. r[4]))
				local b = UI.button({ Text = label, Size = UDim2.fromOffset(120, 50), Position = UDim2.new(1, -10, 0.5, 2), AnchorPoint = Vector2.new(1, 0.5),
					Color = here and UI.PANEL3 or (open and UI.GREEN or UI.RED), MaxText = 20, Parent = row })
				b.Activated:Connect(function()
					playSfx("click")
					if here then return end
					if not open then
						toast("🔒 " .. w.name .. " needs " .. r[4] .. " kills — you have " .. commas(S.kills), Color3.fromRGB(255, 130, 120))
						return
					end
					if S.world ~= "cave" and os.clock() - S.lastHurt < 4 then
						toast("⚠ You can't travel in the middle of a fight!", Color3.fromRGB(255, 120, 110))
						return
					end
					Player.travel(wid, S.world ~= "cave" and S.world or nil)
				end)
			end
		elseif name == "swords" then
			for i, def in ipairs(SWORDS) do
				local owned, equipped = S.owned[def.id], S.equipped == def.id
				local row = Menu.row(m.list, 78, i)
				if equipped then row:FindFirstChildOfClass("UIStroke").Color = GOLD end
				swordPic(row, def)
				UI.text({ Text = i .. "  " .. def.name, Position = UDim2.fromOffset(66, 6), Size = UDim2.new(1, -200, 0, 24), TextXAlignment = Enum.TextXAlignment.Left,
					TextColor3 = def.trail:Lerp(WHITE, 0.35), Stroke = 2.4, Parent = row })
				UI.text({ Text = string.format("⚔ %d   ⚡ %.2f   🗡 %.1f", def.dmg, def.speed, def.reach), Position = UDim2.fromOffset(66, 32), Size = UDim2.new(1, -200, 0, 18),
					TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = UI.DARK, Stroke = 0, MaxText = 15, Parent = row })
				UI.text({ Text = def.desc, Position = UDim2.fromOffset(66, 52), Size = UDim2.new(1, -200, 0, 18), TextXAlignment = Enum.TextXAlignment.Left,
					TextColor3 = Color3.fromRGB(70, 70, 76), Stroke = 0, MaxText = 13, Parent = row })
				local label, color
				if equipped then label, color = "EQUIPPED", UI.PANEL3
				elseif owned then label, color = "EQUIP", UI.GREEN
				elseif def.id == "pumpkin" then label, color = "🍬 " .. math.min(S.candies, CANDY_GOAL) .. "/" .. CANDY_GOAL, Color3.fromRGB(255, 140, 40)
				else label, color = "💰 " .. commas(def.price), UI.PANEL2 end
				local b = UI.button({ Text = label, Size = UDim2.fromOffset(118, 50), Position = UDim2.new(1, -10, 0.5, 2), AnchorPoint = Vector2.new(1, 0.5), Color = color, MaxText = 18, Parent = row })
				b.Activated:Connect(function()
					playSfx("click")
					if owned and not equipped then
						Player.equip(def.id)
						fill("swords")
					elseif not owned then
						toast(def.id == "pumpkin" and "🎃 Collect " .. CANDY_GOAL .. " candies from zombies to get this sword!" or "Buy it from Gus in the cave! 💰", CANDY)
					end
				end)
			end
		elseif name == "settings" then
			local function toggleRow(order, title, getter, setter, onText, offText)
				local row = Menu.row(m.list, 64, order)
				UI.text({ Text = title, Position = UDim2.fromOffset(16, 12), Size = UDim2.new(1, -170, 0, 36), TextXAlignment = Enum.TextXAlignment.Left, Stroke = 2.4, Parent = row })
				local on = getter()
				local b, l = UI.button({ Text = on and onText or offText, Size = UDim2.fromOffset(130, 48), Position = UDim2.new(1, -10, 0.5, 2), AnchorPoint = Vector2.new(1, 0.5),
					Color = on and UI.GREEN or UI.PANEL3, Parent = row })
				b.Activated:Connect(function()
					playSfx("click")
					setter(not getter())
					local now = getter()
					l.Text = now and onText or offText
					b.BackgroundColor3 = now and UI.GREEN or UI.PANEL3
					markDirty()
				end)
			end
			toggleRow(1, "🎵 Music", function() return S.music end, function(v) S.music = v; Groups.music.Volume = v and 0.6 or 0 end, "ON", "OFF")
			toggleRow(2, "🔊 Sounds", function() return S.sfx end, function(v) S.sfx = v; Groups.sfx.Volume = v and 1 or 0; Groups.amb.Volume = v and 1 or 0 end, "ON", "OFF")
			toggleRow(3, "✨ Graphics", function() return S.gfx == "high" end, function(v)
				S.gfx = v and "high" or "low"
				GFX.high = v
				Look.apply(S.world)
			end, "HIGH", "FAST")
			local row = Menu.row(m.list, 64, 4)
			UI.text({ Text = S.canSave and "💾 Your progress is being SAVED" or (Link.coop and "💾 Saving is off (turn on API Services)" or "💾 Solo mode: progress resets when you leave"),
				Position = UDim2.fromOffset(16, 10), Size = UDim2.new(1, -32, 1, -20), TextXAlignment = Enum.TextXAlignment.Left, Stroke = 2, MaxText = 20, Parent = row })
			local row2 = Menu.row(m.list, 64, 5)
			UI.text({ Text = "Forest Hunt " .. VERSION .. " · " .. (Link.coop and "🌐 Multiplayer ON" or "👤 Solo"), Position = UDim2.fromOffset(16, 10), Size = UDim2.new(1, -32, 1, -20),
				TextXAlignment = Enum.TextXAlignment.Left, Stroke = 2, MaxText = 20, Parent = row2 })
		end
	end
	Menu.fill = fill

	function Menu.closeAll()
		for _, n in ipairs({ "worlds", "swords", "settings" }) do
			local m = Menu[n]
			if m.panel.Visible then
				tween(m.scale, 0.12, { Scale = 0.7 })
				task.delay(0.12, function() if Menu.open ~= n then m.panel.Visible = false end end)
			end
		end
		Menu.open = nil
	end
	function Menu.toggle(name)
		if not S.playing or S.talking then return end
		if Menu.open == name then
			Menu.closeAll()
			playSfx("click", nil, { pitch = 0.8 })
			return
		end
		Menu.closeAll()
		local m = Menu[name]
		fill(name)
		Menu.open = name
		m.panel.Visible = true
		m.scale.Scale = 0.7
		tween(m.scale, 0.25, { Scale = 1 }, Enum.EasingStyle.Back)
		playSfx("click")
	end
	for _, n in ipairs({ "worlds", "swords", "settings" }) do
		Menu[n].close.Activated:Connect(function() Menu.closeAll() end)
		HUD.menuButtons[n].Activated:Connect(function() Menu.toggle(n) end)
	end
end

------------------------------------------------------------------------------------------------
-- 🧑‍🔧 GUS — the Cave Trader (a brand-new Gus with a brand-new shop)
------------------------------------------------------------------------------------------------
local Gus = { talking = false, waveAt = -10, nodAt = -10, hopAt = -10, lastGreet = -100, yaw = 0, everTalked = false }
local GUS_SHOP = CFrame.lookAt(Vector3.new(38, 0, 22), Vector3.new(0, 0, 34))
local LINES = {
	first = "YO! Finally, a customer! I'm Gus — I run the coolest shop in this whole cave. Swords, upgrades, Halloween stuff... and ZERO zombies allowed. What's up?",
	greet = { "Ayy, %s is back! What're we doing today?", "%s! You smell like zombie. That means coins, right? Hehe.",
		"Welcome back to Gus's Cave Shop, %s! Everything's extra shiny today." },
	hello = { "Yo %s! 👋", "Heyyy %s!", "Sup %s! Don't track zombie goo in here, okay?" },
	call = { "Psst! Over here! Best swords in the cave!", "Hey hey! Come check out my shop!", "Need a sharper sword? Gus has you covered!" },
	upgIntro = "Upgrades work on EVERY sword you own. Pick one and I'll tune it up!",
	swordIntro = "Fresh outta my backpack! Buy one and it's yours forever.",
	eventIntro = "It's the 2X HALLOWEEN EVENT! Every coin counts DOUBLE and zombies drop candy. Collect 100 and the Pumpkin Overnight Sword is yours!",
	chatIntro = "Chat? Yesss! It gets kinda lonely down here. Ask me anything!",
	upgraded = { "BOOM! Upgraded. Feel that power!", "Done and done! Go show those zombies.", "Tuned to perfection. You're welcome! 😎" },
	bought = { "The %s is yours! It looks SO good on you.", "Nice pick! The %s is a beast.", "Sold! Take good care of the %s, okay?" },
	equip = { "Switched! Looking dangerous.", "Equipped! Go get 'em." },
	broke = { "You need %s more coins, buddy. Zombies drop plenty!", "Ooh, %s coins short. Go bonk a few more zombies!" },
	maxed = "Maxed out! Even I can't make it better.",
	bye = { "Stay safe out there! And bring me candy!", "Later! Don't get zombified!", "Byeee! Come back rich!" },
	huh = { "Huh? Say that again, my headlamp was buzzing.", "Hehe, okay!", "Interesting... anyway, wanna buy a sword?",
		"I have no idea what that means but I like your energy." },
	who = "I'm Gus! I used to hunt zombies, but one chewed on my backpack and I got SCARED. So now I sell swords to brave people like YOU. Way safer!",
	worlds = "Three tunnels, three worlds! The Graveyard is north — the Pumpkin Patch is free, its gates open at 120 kills. Ice World needs 500 kills and pays 3X. The Jungle needs 800 kills and pays 4X... but it's NASTY out there.",
	boss = "Every 10 minutes a BOSS rises in every world! The Gravekeeper, the Frost Titan, and King Kongo in the Jungle. Kongo pays 5,000 coins! Bring friends — everybody who helps gets paid.",
	tips = { "Click fast for a full combo! Every sword swings differently.", "Press Q to dash — nothing can hit you mid-dash!",
		"Hold Shift to sprint. Zombies are slow... mostly.", "Toxic zombies make you SICK. Come back to the cave to feel better!",
		"Gas zombies catch FIRE when they get close. Kill 'em fast — they explode when they die!", "Ice Throwers hit from far away. Run right at them!",
		"Monkey zombies jump super far. Dash sideways!", "If you die, YOU become a zombie. Your zombie twin stays out there... go get revenge!",
		"Red circles on the ground = MOVE. Trust me." },
	jokes = { "Why didn't the skeleton go to the party? He had no BODY to go with!", "What do you call a zombie who makes clothes? A sew-zombie!",
		"Why do zombies love candy? It's sweet... and they're already rotten!", "What's a ghost's favorite dessert? I-scream!",
		"Why are monkey zombies bad at hide and seek? They always go bananas!" },
}

do
	------------------------------------------------------------------------------------------ the shop + Gus himself
	function Build.shop()
		local F = Folders.cave
		local cf = GUS_SHOP
		Gus.stallCF = cf
		local wood, dark = Color3.fromRGB(116, 80, 50), Color3.fromRGB(76, 52, 34)
		local function fp(size, offset, color, mat, extra, cls)
			local props = { Size = size, CFrame = cf * offset, Color = color, Material = mat or Enum.Material.Wood, Parent = F }
			if extra then for k, v in pairs(extra) do props[k] = v end end
			return part(props, cls)
		end
		fp(Vector3.new(18, 0.6, 14), CFrame.new(0, 0.3, 1), Color3.fromRGB(120, 90, 60), Enum.Material.WoodPlanks)
		-- counter made of crates
		for i = -2, 2 do
			fp(Vector3.new(3.2, 3.2, 3), CFrame.new(i * 3.3, 2.2, -3.4) * CFrame.Angles(0, i * 0.03, 0), (i % 2 == 0) and wood or Color3.fromRGB(130, 92, 58), Enum.Material.WoodPlanks)
		end
		fp(Vector3.new(17, 0.4, 3.6), CFrame.new(0, 3.95, -3.4), dark)
		-- frame + striped awning (grey and black, like the UI)
		for _, o in ipairs({ Vector3.new(-8.3, 0, -5), Vector3.new(8.3, 0, -5), Vector3.new(-8.3, 0, 7.4), Vector3.new(8.3, 0, 7.4) }) do
			fp(Vector3.new(0.8, 11, 0.8), CFrame.new(o.X, 5.5, o.Z), dark)
		end
		for i = 0, 6 do
			fp(Vector3.new(2.6, 0.25, 14.4), CFrame.new(-7.8 + i * 2.6, 11.2, 1.2) * CFrame.Angles(math.rad(-12), 0, 0),
				(i % 2 == 0) and Color3.fromRGB(40, 40, 46) or Color3.fromRGB(210, 210, 216), Enum.Material.Fabric)
		end
		fp(Vector3.new(17, 9, 0.4), CFrame.new(0, 5, 7.6), Color3.fromRGB(96, 66, 42), Enum.Material.WoodPlanks)
		-- big sign
		local sign = Build.sign(F, cf * CFrame.new(0, 9.2, -5.4), Vector3.new(12, 2.6, 0.4), "⚔ GUS'S CAVE SHOP", nil, Color3.fromRGB(34, 34, 38), WHITE)
		sign.Name = "ShopSign"
		-- sword rack on the back wall: every sword in the game
		for i, def in ipairs(SWORDS) do
			local x = -6 + (i - 1) * 3
			local model, handle = buildSword(def, 0, false)
			handle.Anchored = true
			model:PivotTo(cf * CFrame.new(x, 3, 7.0))
			model.Parent = F
			fp(Vector3.new(1.2, 0.2, 0.3), CFrame.new(x, 3.8, 7.25), Color3.fromRGB(60, 42, 28))
			if def.id == "pumpkin" then
				local case = fp(Vector3.new(2.4, 8, 1.4), CFrame.new(x, 4.6, 6.9), Color3.fromRGB(200, 230, 255), Enum.Material.Glass, { Transparency = 0.7, CanCollide = false })
				make("PointLight", { Range = 10, Brightness = 1.6, Color = Color3.fromRGB(255, 150, 50), Parent = case })
				Build.sign(F, cf * CFrame.new(x, 9, 6.7), Vector3.new(2.6, 1, 0.2), "🍬 100", nil, Color3.fromRGB(30, 20, 10), CANDY)
			end
		end
		-- Halloween decor + lanterns + a crystal on the counter
		Build.pumpkin(F, (cf * CFrame.new(-6, 4.1, -3.6)).Position, 1.8, 0.4, true, true, 1)
		Build.pumpkin(F, (cf * CFrame.new(7.4, 0.6, -6.2)).Position, 2.6, -0.3, true, false, 2)
		Build.pumpkin(F, (cf * CFrame.new(-8.6, 0.6, -6.4)).Position, 2.2, 0.2, false, false, 3)
		local lantern = fp(Vector3.new(0.9, 1.2, 0.9), CFrame.new(5.5, 4.75, -3.4), Color3.fromRGB(255, 200, 120), Enum.Material.Neon, { CanCollide = false })
		make("PointLight", { Range = 20, Brightness = 1.8, Color = Color3.fromRGB(255, 190, 110), Parent = lantern })
		local gem = fp(Vector3.new(0.8, 1.6, 0.8), CFrame.new(2.2, 4.95, -3.3) * CFrame.Angles(0.3, 0.6, 0.2), Color3.fromRGB(170, 90, 255), Enum.Material.Neon, { CanCollide = false })
		gem.Name = "CounterGem"
		Gus.anvilPos = (cf * CFrame.new(0, 4.4, -3.4)).Position
		for _, x in ipairs({ -1, 1 }) do
			local o = cf * CFrame.new(x * 10.5, 0, -2)
			part({ Size = Vector3.new(2.4, 2.4, 2.4), CFrame = o * CFrame.new(0, 1.2, 0) * CFrame.Angles(0, 0.4, 0), Material = Enum.Material.WoodPlanks, Color = wood, Parent = F })
			part({ Size = Vector3.new(1.8, 1.8, 1.8), CFrame = o * CFrame.new(0.3, 3.3, 0) * CFrame.Angles(0, -0.3, 0), Material = Enum.Material.WoodPlanks, Color = dark, Parent = F })
		end

		-- GUS: young cave trader with a miner helmet + headlamp, goggles, hoodie, orange scarf and a huge backpack of swords
		local s = 1.05
		local skin = Color3.fromRGB(255, 205, 160)
		local hoodie = Color3.fromRGB(58, 58, 64)
		local model, P, J, rootH = Rigs.boy({ name = "Gus", scale = s, skin = skin, shirt = hoodie, pants = Color3.fromRGB(44, 60, 96), forearm = hoodie,
			shoes = Color3.fromRGB(240, 240, 240), hands = Color3.fromRGB(70, 70, 76) })
		local ex = Rigs.extra
		local h = P.head
		-- face: big friendly eyes, eyebrows, freckles, grin
		for _, x in ipairs({ -0.24, 0.24 }) do
			ex(model, h, Vector3.new(0.3, 0.32, 0.05) * s, CFrame.new(x * s, 0.1 * s, -0.6 * s), WHITE)
			ex(model, h, Vector3.new(0.16, 0.2, 0.05) * s, CFrame.new((x + 0.02) * s, 0.08 * s, -0.63 * s), Color3.fromRGB(30, 20, 14))
			ex(model, h, Vector3.new(0.34, 0.07, 0.05) * s, CFrame.new(x * s, 0.33 * s, -0.6 * s) * CFrame.Angles(0, 0, math.rad(-x * 40)), Color3.fromRGB(110, 60, 30))
			for k = 0, 2 do
				ex(model, h, Vector3.new(0.05, 0.05, 0.03) * s, CFrame.new((x * 1.5 + (k - 1) * 0.08) * s, -0.08 * s, -0.62 * s), Color3.fromRGB(200, 120, 80))
			end
		end
		ex(model, h, Vector3.new(0.5, 0.12, 0.05) * s, CFrame.new(0, -0.24 * s, -0.6 * s), Color3.fromRGB(120, 40, 40))
		ex(model, h, Vector3.new(0.36, 0.06, 0.05) * s, CFrame.new(0, -0.19 * s, -0.62 * s), WHITE)
		-- messy orange hair under a yellow miner helmet with a glowing headlamp + goggles
		ex(model, h, Vector3.new(1.12, 0.3, 1.1) * s, CFrame.new(0, 0.38 * s, 0.05 * s), Color3.fromRGB(214, 110, 40), Enum.Material.Fabric)
		local helmet = ex(model, h, Vector3.new(1.3, 0.6, 1.3) * s, CFrame.new(0, 0.66 * s, 0), Color3.fromRGB(250, 196, 30), Enum.Material.SmoothPlastic, Enum.PartType.Ball)
		ex(model, h, Vector3.new(1.5, 0.1, 1.5) * s, CFrame.new(0, 0.5 * s, 0), Color3.fromRGB(230, 176, 20))
		local lamp = ex(model, helmet, Vector3.new(0.34, 0.34, 0.2) * s, CFrame.new(0, 0.1 * s, -0.66 * s), Color3.fromRGB(255, 250, 210), Enum.Material.Neon)
		make("SpotLight", { Range = 26, Brightness = 2.5, Angle = 50, Face = Enum.NormalId.Front, Color = Color3.fromRGB(255, 245, 210), Parent = lamp })
		for _, x in ipairs({ -0.22, 0.22 }) do
			ex(model, helmet, Vector3.new(0.3, 0.3, 0.12) * s, CFrame.new(x * s, -0.12 * s, -0.62 * s), Color3.fromRGB(120, 220, 255), Enum.Material.Glass)
		end
		ex(model, helmet, Vector3.new(1.34, 0.1, 1.34) * s, CFrame.new(0, -0.12 * s, 0), Color3.fromRGB(40, 40, 40))
		-- orange scarf with a pumpkin badge (Halloween!)
		ex(model, P.chest, Vector3.new(1.5, 0.32, 1.15) * s, CFrame.new(0, 0.7 * s, 0), Color3.fromRGB(255, 130, 30), Enum.Material.Fabric)
		ex(model, P.chest, Vector3.new(0.34, 1, 0.12) * s, CFrame.new(-0.35 * s, 0.25 * s, -0.6 * s) * CFrame.Angles(0, 0, math.rad(-6)), Color3.fromRGB(255, 130, 30), Enum.Material.Fabric)
		ex(model, P.chest, Vector3.new(0.4, 0.4, 0.06) * s, CFrame.new(0.45 * s, 0, -0.53 * s), Color3.fromRGB(255, 140, 20), Enum.Material.Neon, Enum.PartType.Ball)
		ex(model, P.chest, Vector3.new(1.5, 0.28, 0.06) * s, CFrame.new(0, -0.6 * s, -0.53 * s), Color3.fromRGB(80, 80, 88))
		-- hoodie pocket + strings
		ex(model, P.chest, Vector3.new(1.1, 0.45, 0.06) * s, CFrame.new(0, -0.35 * s, -0.53 * s), Color3.fromRGB(70, 70, 78))
		-- giant backpack stuffed with swords
		local pack = ex(model, P.chest, Vector3.new(1.7, 1.9, 1.1) * s, CFrame.new(0, 0.1 * s, 1.05 * s), Color3.fromRGB(150, 96, 52), Enum.Material.Fabric)
		ex(model, pack, Vector3.new(1.75, 0.2, 1.15) * s, CFrame.new(0, 0.3 * s, 0), Color3.fromRGB(110, 70, 40), Enum.Material.Fabric)
		for k = -1, 1 do
			ex(model, pack, Vector3.new(0.12, 1.4, 0.12) * s, CFrame.new(k * 0.45 * s, 1.5 * s, 0) * CFrame.Angles(0, 0, k * 0.2), Color3.fromRGB(200, 205, 215), Enum.Material.Metal)
			ex(model, pack, Vector3.new(0.5, 0.12, 0.2) * s, CFrame.new(k * 0.45 * s, 0.95 * s, 0), Color3.fromRGB(190, 150, 70), Enum.Material.Metal)
		end
		-- lantern in the left hand
		local lan = ex(model, P.handL, Vector3.new(0.6, 0.8, 0.6) * s, CFrame.new(0, -0.7 * s, 0), Color3.fromRGB(255, 190, 90), Enum.Material.Neon)
		make("PointLight", { Range = 14, Brightness = 1.4, Color = Color3.fromRGB(255, 180, 90), Parent = lan })
		ex(model, lan, Vector3.new(0.7, 0.12, 0.7) * s, CFrame.new(0, 0.46 * s, 0), Color3.fromRGB(40, 40, 40), Enum.Material.Metal)

		Gus.home = cf * CFrame.new(0, 0.6 + rootH, 1.6)
		Gus.yaw = yawOf(Gus.home.LookVector.X, Gus.home.LookVector.Z)
		model:PivotTo(Gus.home)
		model.Parent = F
		Gus.model, Gus.P, Gus.J, Gus.root = model, P, J, P.root

		local tag = make("BillboardGui", { Name = "NameTag", Size = UDim2.fromOffset(200, 46), StudsOffsetWorldSpace = Vector3.new(0, 3, 0), Adornee = P.head,
			MaxDistance = 70, LightInfluence = 0, Parent = model })
		UI.text({ Text = "GUS", Size = UDim2.fromScale(1, 0.58), Stroke = 2.6, Parent = tag })
		UI.text({ Text = "⚔ Swords · Upgrades · 🎃 Event", Position = UDim2.fromScale(0, 0.58), Size = UDim2.fromScale(1, 0.42), TextColor3 = Color3.fromRGB(230, 230, 236), Stroke = 2, Parent = tag })
		Gus.mark = make("BillboardGui", { Name = "TalkMark", Size = UDim2.fromOffset(44, 56), StudsOffsetWorldSpace = Vector3.new(0, 5, 0), Adornee = P.head,
			AlwaysOnTop = true, MaxDistance = 200, LightInfluence = 0, Parent = model })
		UI.text({ Text = "!", Size = UDim2.fromScale(1, 1), TextColor3 = GOLD, Stroke = 3, Parent = Gus.mark })

		local bb = make("BillboardGui", { Name = "GusBubble", Size = UDim2.fromOffset(270, 96), StudsOffsetWorldSpace = Vector3.new(0, 4.6, 0), Adornee = P.head,
			MaxDistance = 90, LightInfluence = 0, Enabled = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, Parent = model })
		local frame = make("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0), Size = UDim2.new(1, 0, 1, -14), BackgroundColor3 = WHITE, ZIndex = 2, Parent = bb })
		UI.corner(frame, 14)
		UI.stroke(frame, 3)
		make("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 1, -16), Size = UDim2.fromOffset(16, 16), Rotation = 45,
			BackgroundColor3 = WHITE, ZIndex = 1, Parent = bb })
		Gus.bubbleGui = bb
		Gus.bubbleLabel = UI.text({ Text = "", Position = UDim2.fromOffset(10, 6), Size = UDim2.new(1, -20, 1, -12), TextColor3 = UI.DARK, Stroke = 0,
			TextWrapped = true, MaxText = 19, ZIndex = 3, Parent = frame })

		Gus.prompt = make("ProximityPrompt", { ActionText = "Talk", ObjectText = "Gus · Cave Shop", HoldDuration = 0, MaxActivationDistance = 14,
			RequiresLineOfSight = false, KeyboardKeyCode = Enum.KeyCode.E, GamepadKeyCode = Enum.KeyCode.ButtonY, Enabled = false, Parent = P.root })
		Gus.prompt.Triggered:Connect(function() Gus.open() end)

		local clone = model:Clone()
		for _, d in ipairs(clone:GetDescendants()) do
			if d:IsA("BillboardGui") or d:IsA("ProximityPrompt") or d:IsA("Light") then d:Destroy() end
		end
		clone.Parent = Dlg.port
		local cHead = clone:FindFirstChild("Head")
		local vcam = make("Camera", { FieldOfView = 30, Parent = Dlg.port })
		Dlg.port.CurrentCamera = vcam
		if cHead then
			vcam.CFrame = CFrame.lookAt((cHead.CFrame * CFrame.new(0.4, 0.3, -4.4)).Position, cHead.Position + Vector3.new(0, 0.15, 0))
		end
	end

	------------------------------------------------------------------------------------------ talking
	local bubbleToken = 0
	function Gus.say(text, hold)
		if not Gus.bubbleGui then return end
		bubbleToken += 1
		local my = bubbleToken
		local lbl = Gus.bubbleLabel
		Gus.bubbleGui.Enabled = true
		lbl.Text = text
		lbl.MaxVisibleGraphemes = 0
		local n = utf8.len(text) or #text
		task.spawn(function()
			for i = 1, n, 2 do
				if my ~= bubbleToken then return end
				lbl.MaxVisibleGraphemes = i
				if i % 6 == 1 then playSfx("blip", Gus.P.head, { pitch = rng:NextNumber(1.1, 1.35), range = 60 }) end
				task.wait(0.028)
			end
			if my ~= bubbleToken then return end
			lbl.MaxVisibleGraphemes = -1
			task.wait(hold or math.clamp(n * 0.06, 2.5, 6))
			if my == bubbleToken then Gus.bubbleGui.Enabled = false end
		end)
	end

	local sayToken = 0
	local function dlgSay(text)
		sayToken += 1
		local my = sayToken
		Dlg.say.Text = text
		Dlg.say.MaxVisibleGraphemes = 0
		local n = utf8.len(text) or #text
		task.spawn(function()
			for i = 1, n, 2 do
				if my ~= sayToken then return end
				Dlg.say.MaxVisibleGraphemes = i
				if i % 6 == 1 then playSfx("blip", nil, { pitch = rng:NextNumber(1.1, 1.35) }) end
				task.wait(0.02)
			end
			if my == sayToken then Dlg.say.MaxVisibleGraphemes = -1 end
		end)
	end

	local Cam = { active = false }
	local function frameCamera()
		local cam = workspace.CurrentCamera
		local root = getRoot()
		if not cam or not root or not Gus.P then return end
		Cam.active = true
		cam.CameraType = Enum.CameraType.Scriptable
		local head = Gus.P.head.Position
		local toPlayer = flat(root.Position - head)
		toPlayer = toPlayer.Magnitude > 0.1 and toPlayer.Unit or Vector3.new(0, 0, -1)
		local side = Vector3.new(-toPlayer.Z, 0, toPlayer.X)
		local camPos = head + toPlayer * 10 + side * 3 + Vector3.new(0, 1.2, 0)
		Cam.tween = tween(cam, 0.7, { CFrame = CFrame.lookAt(camPos, head + Vector3.new(0, -2.2, 0) + side * 0.8) }, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut)
	end
	local function restoreCamera()
		if not Cam.active then return end
		Cam.active = false
		local cam = workspace.CurrentCamera
		if Cam.tween then Cam.tween:Cancel() end
		local root = getRoot()
		if cam and root then
			local goal = CFrame.lookAt(root.Position - root.CFrame.LookVector * 12 + Vector3.new(0, 5, 0), root.Position + Vector3.new(0, 1.5, 0))
			tween(cam, 0.4, { CFrame = goal }, Enum.EasingStyle.Sine)
			task.delay(0.42, function()
				if not Cam.active then
					cam.CameraType = Enum.CameraType.Custom
					local h = getHum()
					if h then cam.CameraSubject = h end
				end
			end)
		elseif cam then
			cam.CameraType = Enum.CameraType.Custom
		end
	end

	local view = "main"
	local showView
	local function clearList()
		for _, c in ipairs(Dlg.list:GetChildren()) do
			if c:IsA("GuiObject") then c:Destroy() end
		end
	end
	local function dlgButton(text, color, order, height)
		return UI.button({ Text = text, Size = UDim2.new(1, 0, 0, height or 48), Color = color, LayoutOrder = order, MaxText = 22, Parent = Dlg.list })
	end
	local function backButton()
		local b, _, holder = dlgButton("←  Back", UI.PANEL3, 0, 40)
		holder.Size = UDim2.new(0, 120, 0, 40)
		b.Activated:Connect(function()
			playSfx("click")
			showView("main", false, "Anything else?")
		end)
	end
	local function upgStat(u, lvl)
		if u.id == "damage" then return string.format("+%d%% damage", math.floor(u.step * 100 * lvl + 0.5)) end
		if u.id == "speed" then return string.format("+%d%% speed", math.floor(u.step * 100 * lvl + 0.5)) end
		if u.id == "range" then return string.format("+%.1f reach", u.step * lvl) end
		return string.format("%d max HP", 100 + u.step * lvl)
	end

	local function doUpgrade(u)
		local lvl = S.levels[u.id]
		if lvl >= u.max then
			dlgSay(LINES.maxed)
			playSfx("click", nil, { pitch = 0.7 })
			return
		end
		local cost = upgradeCost(u, lvl)
		if S.coins < cost then
			dlgSay(string.format(pick(LINES.broke), commas(cost - S.coins)))
			playSfx("click", nil, { pitch = 0.6 })
			return
		end
		S.coins -= cost
		S.levels[u.id] = lvl + 1
		markDirty()
		if u.id == "health" then S.hp = math.min(maxHP(), S.hp + u.step) end
		if u.id == "range" or (u.id == "damage" and S.levels.damage == 5) then
			local ca = CA.list[player]
			if ca then CA.attachSword(ca, S.equipped) end
		end
		playSfx("clang", Gus.anvilPos, { vary = 0.05 })
		playSfx("magic", nil, { pitch = 1.1 })
		FX.burst(FX.spark, Gus.anvilPos, 22, Color3.fromRGB(255, 180, 80))
		Gus.nodAt, Gus.hopAt = os.clock(), os.clock()
		Player.pulseCoins()
		dlgSay(pick(LINES.upgraded))
		showView("upgrades", true)
	end

	local function doSword(def)
		if S.equipped == def.id then return end
		if S.owned[def.id] then
			Player.equip(def.id)
			dlgSay(pick(LINES.equip))
		elseif def.id == "pumpkin" then
			dlgSay("That one's NOT for sale! Only " .. CANDY_GOAL .. " Halloween candies can unlock it. You have " .. S.candies .. ". Go get 'em!")
			playSfx("click", nil, { pitch = 0.6 })
			return
		else
			if S.coins < def.price then
				dlgSay(string.format(pick(LINES.broke), commas(def.price - S.coins)))
				playSfx("click", nil, { pitch = 0.6 })
				return
			end
			S.coins -= def.price
			S.owned[def.id] = true
			markDirty()
			Player.equip(def.id)
			playSfx("buy")
			playSfx("magic", nil, { pitch = 0.9 })
			FX.burst(FX.magic, Gus.anvilPos, 24, def.trail)
			Gus.nodAt, Gus.hopAt = os.clock(), os.clock()
			Player.pulseCoins()
			dlgSay(string.format(pick(LINES.bought), def.name))
		end
		showView("swords", true)
	end

	showView = function(v, keepText, line)
		view = v
		local keep = Dlg.list.CanvasPosition
		clearList()
		if v == "main" then
			Dlg.header.Text = "What do you wanna do?"
			if line then dlgSay(line) end
			dlgButton("⚔  Buy a sword", UI.PANEL2, 1).Activated:Connect(function()
				playSfx("click")
				showView("swords", false, LINES.swordIntro)
			end)
			dlgButton("⬆  Upgrade my sword", UI.PANEL2, 2).Activated:Connect(function()
				playSfx("click")
				showView("upgrades", false, LINES.upgIntro)
			end)
			dlgButton("🎃  Halloween event", Color3.fromRGB(255, 140, 40), 3).Activated:Connect(function()
				playSfx("click")
				showView("event", false, LINES.eventIntro)
			end)
			dlgButton("💬  Just chat", UI.PANEL2, 4).Activated:Connect(function()
				playSfx("click")
				showView("chat", false, LINES.chatIntro)
			end)
			dlgButton("👋  Bye, Gus", UI.PANEL3, 5).Activated:Connect(function() Gus.close(true) end)
		elseif v == "chat" then
			Dlg.header.Text = "Chat with Gus"
			if line then dlgSay(line) end
			backButton()
			local topics = {
				{ "Who are you?", function() return LINES.who end },
				{ "Where should I go?", function() return LINES.worlds end },
				{ "Tell me about bosses", function() return LINES.boss end },
				{ "Got any tips?", function() return pick(LINES.tips) end },
				{ "Tell me a joke!", function() return pick(LINES.jokes) end },
			}
			for i, tpc in ipairs(topics) do
				dlgButton(tpc[1], UI.PANEL2, i).Activated:Connect(function()
					playSfx("click")
					Gus.nodAt = os.clock()
					dlgSay(tpc[2]())
				end)
			end
		elseif v == "event" then
			Dlg.header.Text = "🎃 2X Halloween Event"
			if line then dlgSay(line) end
			backButton()
			local row = make("Frame", { Size = UDim2.new(1, 0, 0, 96), BackgroundColor3 = Color3.fromRGB(40, 26, 12), LayoutOrder = 1, Parent = Dlg.list })
			UI.corner(row, 12)
			UI.stroke(row, 3)
			Menu.swordPic(row, SWORD_BY_ID.pumpkin, UDim2.fromOffset(56, 76))
			UI.text({ Text = "PUMPKIN OVERNIGHT SWORD", Position = UDim2.fromOffset(74, 8), Size = UDim2.new(1, -84, 0, 24), TextXAlignment = Enum.TextXAlignment.Left,
				TextColor3 = CANDY, Stroke = 2.4, Parent = row })
			UI.text({ Text = S.pumpkin and "✅ YOU OWN IT!" or ("🍬 " .. math.min(S.candies, CANDY_GOAL) .. " / " .. CANDY_GOAL .. " candies"), Position = UDim2.fromOffset(74, 36),
				Size = UDim2.new(1, -84, 0, 22), TextXAlignment = Enum.TextXAlignment.Left, Stroke = 2, Parent = row })
			local bar = make("Frame", { Position = UDim2.fromOffset(74, 66), Size = UDim2.new(1, -86, 0, 14), BackgroundColor3 = UI.INK, Parent = row })
			UI.corner(bar, 7)
			local f = make("Frame", { Size = UDim2.fromScale(math.clamp(S.candies / CANDY_GOAL, 0, 1), 1), BackgroundColor3 = CANDY, Parent = bar })
			UI.corner(f, 7)
			for i, txtLine in ipairs({ "💰 All coins are worth 2X", "🍬 Zombies drop candy (each candy = bonus coins too!)", "👹 Bosses drop a big pile of candy" }) do
				local r = make("Frame", { Size = UDim2.new(1, 0, 0, 36), BackgroundColor3 = WHITE, LayoutOrder = 1 + i, Parent = Dlg.list })
				UI.corner(r, 10)
				UI.stroke(r, 2.5)
				UI.text({ Text = txtLine, Position = UDim2.fromOffset(10, 6), Size = UDim2.new(1, -20, 1, -12), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = UI.DARK, Stroke = 0, Parent = r })
			end
		elseif v == "upgrades" then
			Dlg.header.Text = "Upgrade my sword"
			if line then dlgSay(line) end
			backButton()
			for i, u in ipairs(UPGRADES) do
				local lvl = S.levels[u.id]
				local row = make("Frame", { Size = UDim2.new(1, 0, 0, 70), BackgroundColor3 = WHITE, LayoutOrder = i, Parent = Dlg.list })
				UI.corner(row, 12)
				UI.stroke(row, 2.5)
				make("UIGradient", { Rotation = 90, Color = ColorSequence.new(Color3.fromRGB(236, 236, 240), Color3.fromRGB(196, 196, 204)), Parent = row })
				local icon = UI.icon(row, u.icon, UI.DARK, 48)
				icon.Position = UDim2.fromOffset(8, 11)
				UI.text({ Text = u.name .. "  ·  Lv " .. lvl .. "/" .. u.max, Position = UDim2.fromOffset(64, 6), Size = UDim2.new(1, -184, 0, 22),
					TextXAlignment = Enum.TextXAlignment.Left, Stroke = 2.2, MaxText = 18, Parent = row })
				local nextTxt = (lvl < u.max) and ("  →  " .. upgStat(u, lvl + 1)) or ""
				UI.text({ Text = upgStat(u, lvl) .. nextTxt, Position = UDim2.fromOffset(64, 30), Size = UDim2.new(1, -184, 0, 16),
					TextColor3 = Color3.fromRGB(30, 120, 40), Stroke = 0, TextXAlignment = Enum.TextXAlignment.Left, MaxText = 14, Parent = row })
				local pips = make("Frame", { Position = UDim2.fromOffset(64, 52), Size = UDim2.new(1, -184, 0, 8), BackgroundTransparency = 1, Parent = row })
				make("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 3), Parent = pips })
				for p = 1, u.max do
					local pip = make("Frame", { Size = UDim2.new(1 / u.max, -3, 1, 0), BackgroundColor3 = (p <= lvl) and UI.DARK or UI.PANEL2, Parent = pips })
					UI.corner(pip, 3)
				end
				local maxed = lvl >= u.max
				local cost = upgradeCost(u, lvl)
				local b = UI.button({ Text = maxed and "MAX" or ("💰 " .. commas(cost)), Size = UDim2.fromOffset(108, 50), Position = UDim2.new(1, -8, 0.5, 2), AnchorPoint = Vector2.new(1, 0.5),
					Color = maxed and UI.PANEL3 or ((S.coins >= cost) and UI.GREEN or UI.RED), MaxText = 18, Parent = row })
				b.Activated:Connect(function() doUpgrade(u) end)
			end
		elseif v == "swords" then
			Dlg.header.Text = "Buy a sword"
			if line then dlgSay(line) end
			backButton()
			for i, def in ipairs(SWORDS) do
				local owned, equipped = S.owned[def.id], S.equipped == def.id
				local row = make("Frame", { Size = UDim2.new(1, 0, 0, 76), LayoutOrder = i, BackgroundColor3 = WHITE, Parent = Dlg.list })
				UI.corner(row, 12)
				UI.stroke(row, equipped and 3.5 or 2.5, equipped and GOLD or UI.INK)
				make("UIGradient", { Rotation = 90, Color = ColorSequence.new(Color3.fromRGB(236, 236, 240), Color3.fromRGB(196, 196, 204)), Parent = row })
				Menu.swordPic(row, def)
				UI.text({ Text = def.name, Position = UDim2.fromOffset(64, 6), Size = UDim2.new(1, -184, 0, 22), TextColor3 = def.trail:Lerp(WHITE, 0.35),
					TextXAlignment = Enum.TextXAlignment.Left, Stroke = 2.2, MaxText = 18, Parent = row })
				UI.text({ Text = string.format("⚔ %d   ⚡ %.2f   🗡 %.1f", def.dmg, def.speed, def.reach), Position = UDim2.fromOffset(64, 31), Size = UDim2.new(1, -184, 0, 16),
					TextColor3 = UI.DARK, Stroke = 0, TextXAlignment = Enum.TextXAlignment.Left, MaxText = 14, Parent = row })
				UI.text({ Text = def.desc, Position = UDim2.fromOffset(64, 50), Size = UDim2.new(1, -184, 0, 16), TextColor3 = Color3.fromRGB(70, 70, 76), Stroke = 0,
					TextXAlignment = Enum.TextXAlignment.Left, MaxText = 12, Parent = row })
				local label, color
				if equipped then label, color = "EQUIPPED", UI.PANEL3
				elseif owned then label, color = "EQUIP", UI.PANEL2
				elseif def.id == "pumpkin" then label, color = "🍬 " .. CANDY_GOAL, Color3.fromRGB(255, 140, 40)
				else
					label = "💰 " .. commas(def.price)
					color = (S.coins >= def.price) and UI.GREEN or UI.RED
				end
				local b = UI.button({ Text = label, Size = UDim2.fromOffset(108, 50), Position = UDim2.new(1, -8, 0.5, 2), AnchorPoint = Vector2.new(1, 0.5), Color = color, MaxText = 17, Parent = row })
				b.Activated:Connect(function() doSword(def) end)
			end
		end
		if keepText then Dlg.list.CanvasPosition = keep end
	end

	function Gus.open(startView)
		if Gus.talking or not S.playing or S.dead or not Gus.P then return end
		Gus.talking, S.talking = true, true
		if Menu.closeAll then Menu.closeAll() end
		Link.send("safe", true)
		Dlg.panel.Visible = true
		touchControls(false)
		Dlg.scale.Scale = 0.75
		tween(Dlg.scale, 0.25, { Scale = 1 }, Enum.EasingStyle.Back)
		playSfx("click")
		if Gus.prompt then Gus.prompt.Enabled = false end
		bubbleToken += 1
		Gus.bubbleGui.Enabled = false
		Gus.mark.Enabled = false
		Gus.waveAt, Gus.hopAt = os.clock(), os.clock()
		local root = getRoot()
		if root then
			local p, g = root.Position, Gus.home.Position
			root.CFrame = CFrame.lookAt(p, Vector3.new(g.X, p.Y, g.Z))
		end
		frameCamera()
		local line
		if not S.talked then
			S.talked = true
			markDirty()
			line = LINES.first
		else
			line = string.format(pick(LINES.greet), player.DisplayName)
		end
		Gus.everTalked = true
		if startView == "upgrades" then
			showView("upgrades", false, LINES.upgIntro)
		elseif startView == "swords" then
			showView("swords", false, LINES.swordIntro)
		elseif startView == "event" then
			showView("event", false, LINES.eventIntro)
		else
			showView("main", false, line)
		end
	end

	function Gus.close(sayBye)
		if not Gus.talking then return end
		Gus.talking, S.talking = false, false
		Link.send("safe", false)
		sayToken += 1
		tween(Dlg.scale, 0.15, { Scale = 0.75 })
		task.delay(0.15, function()
			if not Gus.talking then Dlg.panel.Visible = false end
		end)
		if Gus.prompt then Gus.prompt.Enabled = S.playing end
		touchControls(S.playing)
		restoreCamera()
		if sayBye then Gus.say(pick(LINES.bye)) end
	end
	Dlg.close.Activated:Connect(function() Gus.close(true) end)

	------------------------------------------------------------------------------------------ talk to Gus in the chat box
	local function gusReply(t)
		local words = {}
		for w in string.gmatch(t, "%a+") do words[w] = true end
		local function has(list)
			for _, w in ipairs(list) do
				if #w <= 3 then
					if words[w] then return true end
				elseif string.find(t, w, 1, true) then
					return true
				end
			end
			return false
		end
		if has({ "upgrade", "sharpen", "stronger", "improve", "level" }) then return "Upgrades? LET'S GO! Step up to the counter.", "upgrades" end
		if has({ "sword", "swords", "blade", "buy", "shop", "weapon", "new" }) then return "Lookin' for a new sword? Check out my collection!", "swords" end
		if has({ "candy", "candies", "halloween", "event", "pumpkin", "spooky" }) then return LINES.eventIntro, "event" end
		if has({ "boss", "kongo", "titan", "gravekeeper" }) then return LINES.boss end
		if has({ "joke", "funny", "laugh", "lol" }) then return pick(LINES.jokes) end
		if has({ "toxic", "sick", "poison" }) then return "Toxic zombies make you SICK! Come back to the cave and you'll feel better instantly." end
		if has({ "gas", "fire", "burn" }) then return "Gas zombies light themselves on fire when they get close. And they EXPLODE when they die. Run!" end
		if has({ "monkey", "jungle" }) then return "The Jungle's the hardest place — monkey zombies, gas zombies AND toxic zombies. But 4X coins!" end
		if has({ "ice", "snow", "frozen", "yeti" }) then return "Ice World! Frostbitten zombies, Ice Throwers and big Yeti Zombies. 3X coins though!" end
		if has({ "grave", "graveyard", "cemetery", "crypt" }) then return "The graveyard gates open at " .. GRAVE_GATE_KILLS .. " kills. Zombies climb out of the graves in there!" end
		if has({ "zombie", "undead", "die", "dead" }) then return "If you die you turn into a zombie! It's... honestly kinda cool. But also bad." end
		if has({ "coin", "coins", "money", "gold", "cash", "rich" }) then return "Monsters drop coins, and it's a 2X event — everything counts double! Bring 'em here!" end
		if has({ "where", "world", "worlds", "go", "map" }) then return LINES.worlds end
		if has({ "tip", "tips", "help", "how" }) then return pick(LINES.tips) end
		if has({ "who", "name" }) then return LINES.who end
		if has({ "thank", "thanks", "thx", "ty" }) then return "Anytime, friend! 😄" end
		if has({ "bye", "cya", "later", "goodbye", "gtg" }) then return pick(LINES.bye) end
		if has({ "hi", "hello", "hey", "sup", "yo", "howdy", "gus", "hiya" }) then return string.format(pick(LINES.hello), player.DisplayName) end
		return pick(LINES.huh)
	end

	local heard, heardAt = "", 0
	local function onPlayerChat(text)
		if type(text) ~= "string" or text == "" then return end
		local now = os.clock()
		if text == heard and now - heardAt < 1.5 then return end
		heard, heardAt = text, now
		if not Gus.P or not S.playing or S.world ~= "cave" then return end
		local root = getRoot()
		if not root then return end
		local d = (root.Position - Gus.home.Position).Magnitude
		if d > 32 then return end
		local reply, openView = gusReply(string.lower(text))
		task.delay(0.5, function()
			Gus.nodAt = os.clock()
			if Gus.talking then
				dlgSay(reply)
				if openView and view ~= openView then showView(openView, false) end
			else
				Gus.say(reply)
				if openView and d < 16 then task.delay(1.2, function() Gus.open(openView) end) end
			end
		end)
	end
	pcall(function()
		TextChatService.MessageReceived:Connect(function(msg)
			local src = msg.TextSource
			if src and src.UserId == player.UserId then onPlayerChat(msg.Text) end
		end)
	end)
	pcall(function() player.Chatted:Connect(onPlayerChat) end)

	------------------------------------------------------------------------------------------ Gus comes alive: bouncy idle, waves, looks around nervously, hops when you buy
	local setJ = Rigs.setJ
	function Gus.update(dt, now, rp)
		if not Gus.root or not Gus.root.Parent or S.world ~= "cave" then return end
		local J = Gus.J
		local pos = Gus.home.Position
		local dist = rp and (rp - pos).Magnitude or math.huge
		local near = dist < 26 and S.playing
		local face = (Gus.talking or near) and rp or (Gus.anvilPos + Vector3.new(math.sin(now * 0.4) * 10, 0, 0))
		local d = flat(face - pos)
		if d.Magnitude > 0.1 then Gus.yaw += angDiff(Gus.yaw, yawOf(d.X, d.Z)) * math.min(1, dt * 5) end
		local hop = 0
		local ht = now - Gus.hopAt
		if ht < 0.5 then hop = math.sin(ht / 0.5 * math.pi) * 1.4 end
		Gus.root.CFrame = CFrame.new(pos + Vector3.new(0, hop, 0)) * CFrame.Angles(0, Gus.yaw, 0)
		if near and not Gus.talking and now - Gus.lastGreet > 25 then
			Gus.lastGreet = now
			Gus.waveAt = now
			Gus.say(Gus.everTalked and pick(LINES.hello):format(player.DisplayName) or pick(LINES.call))
		end
		if Gus.mark then
			Gus.mark.Enabled = not S.talked and not Gus.talking
			Gus.mark.StudsOffsetWorldSpace = Vector3.new(0, 5 + math.sin(now * 3) * 0.3, 0)
		end
		local bounce = math.abs(math.sin(now * 3.2)) * 0.06
		local shR, elR, shL, elL, lean, look, turn = 0.15, 0.2, 0.35, 0.6, 0, 0, 0
		if Gus.talking then
			shR = 0.5 + math.sin(now * 3.4) * 0.45
			elR = 1 + math.sin(now * 3.4 + 1) * 0.35
			look = math.sin(now * 4.5) * 0.06
			lean = math.sin(now * 2) * 0.04
		elseif not near then
			-- nervous: peeks left and right at the tunnels
			turn = math.sin(now * 0.9) * 0.6
			look = 0.1
		end
		local wv = now - Gus.waveAt
		if wv < 1.6 then shR, elR = 2.8, 0.4 + math.sin(wv * 12) * 0.35 end
		local nd = now - Gus.nodAt
		if nd < 0.9 then look -= math.abs(math.sin(nd * 7)) * 0.35 end
		setJ(J, "Root", CFrame.new(0, bounce, 0))
		setJ(J, "ShoulderR", CFrame.Angles(shR, 0, 0.12))
		setJ(J, "ElbowR", CFrame.Angles(elR, 0, 0))
		setJ(J, "ShoulderL", CFrame.Angles(shL, 0, -0.12))
		setJ(J, "ElbowL", CFrame.Angles(elL, 0, 0))
		setJ(J, "Waist", CFrame.Angles(lean + math.sin(now * 1.8) * 0.03, turn * 0.3, 0))
		setJ(J, "Neck", CFrame.Angles(look, turn * 0.7, math.sin(now * 0.7) * 0.06))
		setJ(J, "KneeL", CFrame.Angles(-bounce * 2, 0, 0))
		setJ(J, "KneeR", CFrame.Angles(-bounce * 2, 0, 0))
		if Gus.talking and dist > 18 then Gus.close(false) end
	end
end

------------------------------------------------------------------------------------------------
-- PROFILE (saved progress from the server)
------------------------------------------------------------------------------------------------
local profileReady = not Link.coop
On.profile = function(data, canSave)
	if type(data) == "table" then
		S.coins, S.candies, S.kills = data.coins or 0, data.candies or 0, data.kills or 0
		S.owned = data.owned or { rusty = true }
		S.owned.rusty = true
		S.equipped = (data.equipped and S.owned[data.equipped]) and data.equipped or "rusty"
		S.levels = data.levels or S.levels
		S.pumpkin = data.pumpkin == true
		if S.pumpkin then S.owned.pumpkin = true end
		S.music, S.sfx, S.gfx, S.talked = data.music ~= false, data.sfx ~= false, data.gfx or "high", data.talked == true
		S.shownCoins = S.coins
	end
	S.canSave = canSave == true
	Groups.music.Volume = S.music and 0.6 or 0
	Groups.sfx.Volume = S.sfx and 1 or 0
	Groups.amb.Volume = S.sfx and 1 or 0
	GFX.high = S.gfx ~= "low"
	S.hp = maxHP()
	local ca = CA.list[player]
	if ca then CA.attachSword(ca, S.equipped) end
	Link.send("sword", S.equipped)
	Unlocks.check(true)
	Pickups.candyCheck(true)
	S.dirty = false
	profileReady = true
end

On.boss = function(phase, wid, kind)
	local def = MOBS[kind]
	local w = WORLDS[wid]
	if not def or not w then return end
	if phase == "spawn" then
		if wid == S.world then
			Celebrate.show("👹 " .. string.upper(def.name) .. " HAS RISEN!", "Beat it (with friends!) for " .. commas(def.reward) .. " coins + candy", Color3.fromRGB(255, 80, 70), 4)
			playSfx("roar", nil, { pitch = 0.55, vol = 1.2 })
			shake(0.4, 1)
		else
			toast("👹 " .. def.name .. " rose in the " .. w.icon .. " " .. w.name .. "!" .. (worldUnlocked(wid) and "" or " (locked)"), Color3.fromRGB(255, 130, 110), 4)
		end
	elseif phase == "dead" and wid ~= S.world then
		toast("🏆 Someone defeated " .. def.name .. " in the " .. w.name .. "!", GOLD, 3)
	end
end

------------------------------------------------------------------------------------------------
-- CHARACTERS (yours + everyone else's swords and animations)
------------------------------------------------------------------------------------------------
local worldReady = false
local function isJunk(inst)
	if inst:IsDescendantOf(worldRoot) or inst:IsDescendantOf(mobFolder) then return false end
	if inst:IsA("SpawnLocation") then return true end
	return inst:IsA("BasePart") and inst.Name == "Baseplate" and inst.Parent == workspace
end

local function onCharacter(char)
	local hum = char:WaitForChild("Humanoid", 15)
	local root = char:WaitForChild("HumanoidRootPart", 15)
	if not hum or not root or player.Character ~= char then return end
	if not S.playing then root.Anchored = true end
	while not worldReady and char.Parent do task.wait(0.1) end
	if player.Character ~= char then return end
	local wasDead = S.dead
	S.dead = false
	S.hp = maxHP()
	S.iframes = os.clock() + 2
	Death.frame.BackgroundTransparency = 1
	textFade(Death.title, 1, 0.01)
	textFade(Death.sub, 1, 0.01)
	if S.playing then
		Player.travel((wasDead or S.world == "cave") and "cave" or S.world, nil, true)
	else
		Player.placeAt(CAVE_SPAWN)
	end
	local ca
	for _ = 1, 50 do
		ca = CA.setup(player, char)
		if ca and ca.ok then break end
		task.wait(0.1)
	end
	if ca then CA.attachSword(ca, S.equipped) end
	hum.Died:Connect(function()
		-- a real Roblox death (Reset button...): the next character gets set up again automatically
		if not S.dead then
			S.dead = true
			tween(Death.frame, 0.6, { BackgroundTransparency = 0.5 })
			textFade(Death.title, 0, 0.5)
		end
	end)
end
player.CharacterAdded:Connect(onCharacter)
if player.Character then task.spawn(onCharacter, player.Character) end

-- other players (multiplayer): their swords, swings, runs and zombie forms
local function watchOther(plr)
	if plr == player then return end
	local function setupChar(char)
		task.wait(0.5)
		if plr.Character ~= char then return end
		local ca = CA.setup(plr, char)
		if not ca then return end
		CA.attachSword(ca, plr:GetAttribute("FH_Sword") or "rusty")
		local at = plr:GetAttribute("FH_ZombieAt")
		if at then CA.startZombie(plr, os.clock() - (workspace:GetServerTimeNow() - at)) end
	end
	plr.CharacterAdded:Connect(setupChar)
	if plr.Character then task.spawn(setupChar, plr.Character) end
	plr:GetAttributeChangedSignal("FH_Sword"):Connect(function()
		local ca = CA.list[plr]
		if ca and not ca.zombieAt then CA.attachSword(ca, plr:GetAttribute("FH_Sword") or "rusty") end
	end)
	plr:GetAttributeChangedSignal("FH_ZombieAt"):Connect(function()
		local at = plr:GetAttribute("FH_ZombieAt")
		if at then
			CA.startZombie(plr, os.clock() - (workspace:GetServerTimeNow() - at))
		else
			CA.stopZombie(plr)
		end
	end)
end
if Link.coop then
	for _, p in ipairs(Players:GetPlayers()) do watchOther(p) end
	Players.PlayerAdded:Connect(watchOther)
	Players.PlayerRemoving:Connect(function(p) CA.list[p] = nil end)
	if Link.snap then Link.snap.OnClientEvent:Connect(function(wid, buf) Views.onSnap(wid, buf) end) end
end

------------------------------------------------------------------------------------------------
-- MAIN LOOPS
------------------------------------------------------------------------------------------------
local loopErrors = {}
local function safe(name, fn, ...)
	local ok, err = pcall(fn, ...)
	if not ok and not loopErrors[name] then
		loopErrors[name] = true
		warn("[Forest Hunt 2.0] " .. name .. " error: " .. tostring(err))
	end
end

RunService.Stepped:Connect(function(_, dt)
	if not worldReady then return end
	local now = os.clock()
	local root = getRoot()
	if S.playing and not Link.coop then
		local hunters = {}
		if root and S.world ~= "cave" and not S.traveling then
			hunters[1] = { key = player.UserId, pos = root.Position, vel = root.AssemblyLinearVelocity, world = S.world,
				vulnerable = not S.dead and not S.talking }
		end
		safe("monsters", Sim.update, math.min(dt, 0.1), now, hunters)
		if not S.traveling then safe("views", Views.syncSolo) end
	end
	safe("gus", Gus.update, dt, now, root and root.Position)
end)

local function updateHUD(dt)
	local m = maxHP()
	local frac = math.clamp(S.hp / m, 0, 1)
	HUD.hpFill.Size = UDim2.fromScale(frac, 1)
	if S.lagHP < frac then S.lagHP = frac else S.lagHP = math.max(frac, S.lagHP - dt * 0.5) end
	HUD.hpLag.Size = UDim2.fromScale(S.lagHP, 1)
	HUD.hpText.Text = string.format("❤ %d / %d", math.ceil(math.max(0, S.hp)), m)
	if frac < 0.3 then
		HUD.hpGrad.Color = ColorSequence.new(Color3.fromRGB(255, 120, 100), Color3.fromRGB(200, 30, 40))
	elseif frac < 0.6 then
		HUD.hpGrad.Color = ColorSequence.new(Color3.fromRGB(255, 220, 90), Color3.fromRGB(220, 150, 30))
	else
		HUD.hpGrad.Color = ColorSequence.new(Color3.fromRGB(120, 230, 110), Color3.fromRGB(40, 160, 60))
	end
	if S.shownCoins ~= S.coins then
		local diff = S.coins - S.shownCoins
		local step = math.max(1, math.floor(math.abs(diff) * math.min(1, dt * 10)))
		S.shownCoins += (diff > 0 and 1 or -1) * math.min(step, math.abs(diff))
	end
	HUD.coinLabel.Text = commas(S.shownCoins)
	Dlg.coins.Text = "💰 " .. commas(S.coins)
	HUD.candyLabel.Text = S.pumpkin and (commas(S.candies) .. " 🎃") or (math.min(S.candies, CANDY_GOAL) .. " / " .. CANDY_GOAL)
	HUD.candyFill.Size = UDim2.fromScale(math.clamp(S.candies / CANDY_GOAL, 0, 1), 1)
	HUD.killLabel.Text = commas(S.kills)
	HUD.bannerScale.Scale = 1 + math.sin(os.clock() * 3) * 0.03
end

RunService.RenderStepped:Connect(function(dt)
	local now = os.clock()
	local cam = workspace.CurrentCamera
	if worldReady then
		safe("views", Views.update, dt, now, cam and cam.CFrame.Position)
		safe("pickups", Pickups.update, dt, now)
	end
	safe("hud", updateHUD, dt)
	local hum = getHum()
	if hum then
		if Shake.t > 0 then
			Shake.t -= dt
			local k = Shake.mag * math.max(0, Shake.t / Shake.dur)
			hum.CameraOffset = Vector3.new(rng:NextNumber(-k, k), rng:NextNumber(-k, k), 0)
		elseif hum.CameraOffset ~= Vector3.zero then
			hum.CameraOffset = Vector3.zero
		end
		if S.playing and cam and cam.CameraType == Enum.CameraType.Custom then
			local moving = hum.MoveDirection.Magnitude > 0.1
			local want = (S.sprint and moving) and 78 or 70
			S.fov += (want - S.fov) * math.min(1, dt * 6)
			cam.FieldOfView = S.fov
		end
	end
end)

-- animations run AFTER Roblox's own, so swings and runs are never overwritten
RunService:BindToRenderStep("FH2_Anim", Enum.RenderPriority.Last.Value, function(dt)
	if not worldReady then return end
	local now = os.clock()
	local myRoot = getRoot()
	for plr, ca in pairs(CA.list) do
		if plr == player then
			if not S.dead or ca.zombieAt then safe("anim", CA.update, ca, dt, now) end
		elseif plr.Parent and (plr:GetAttribute("FH_World") or "cave") == S.world and ca.root and ca.root.Parent
			and (not myRoot or (ca.root.Position - myRoot.Position).Magnitude < 160) then
			safe("anim2", CA.update, ca, dt, now)
		end
	end
end)

local rigCheck, saveT, lockMsgAt, auroraT = 0, 0, 0, 0
local snow
RunService.Heartbeat:Connect(function(dt)
	if not worldReady or not S.playing then return end
	local now = os.clock()
	local root, hum = getRoot(), getHum()
	safe("effects", Player.tickEffects, dt, now)
	-- boss bar + timer + boss music
	do
		local bossV
		for _, v in pairs(Views.list) do
			if v.def.boss and v.alive then bossV = v break end
		end
		HUD.bossBar.Visible = bossV ~= nil
		if bossV then
			local maxHp
			if Link.coop and Link.net then maxHp = Link.net:GetAttribute("BossHp_" .. S.world) end
			if not maxHp then
				local b = Sim.worlds[S.world] and Sim.worlds[S.world].boss
				maxHp = b and b.maxHp or bossV.def.hp
			end
			HUD.bossName.Text = "👹 " .. string.upper(bossV.def.name) .. (bit32.band(bossV.flags or 0, 64) ~= 0 and "  · ENRAGED!" or "")
			HUD.bossFill.Size = UDim2.fromScale(bossV.hpFrac, 1)
			HUD.bossHpText.Text = commas(bossV.hpFrac * maxHp) .. " / " .. commas(maxHp)
		end
		if Amb.setBoss then Amb.setBoss(bossV ~= nil) end
		local left = Sim.bossClock
		if Link.coop and Link.net then
			local at = Link.net:GetAttribute("BossAt")
			if at then left = at - workspace:GetServerTimeNow() end
		end
		HUD.bossTimer.Text = bossV and "👹 BOSS FIGHT!" or ("👹 Bosses rise in " .. fmtTime(left))
	end
	if not root or not hum then return end
	local p = root.Position
	-- walking into tunnels / cave mouths
	if not S.traveling and not S.dead then
		if S.world == "cave" then
			for wid, tn in pairs(Build.tunnels) do
				local d, sd = p:Dot(tn.dir), math.abs(p:Dot(tn.side))
				if sd < 12 then
					if d > 104 and worldUnlocked(wid) then
						task.spawn(Player.travel, wid)
						break
					elseif d > 79 and not worldUnlocked(wid) and now > lockMsgAt then
						lockMsgAt = now + 3
						toast("🔒 " .. WORLDS[wid].name .. " needs " .. WORLDS[wid].need .. " kills — you have " .. commas(S.kills), Color3.fromRGB(255, 130, 120))
					end
				end
			end
		else
			local mr = LAYOUT[S.world].mouth
			if p.X > mr[1] and p.X < mr[2] and p.Z > mr[3] and p.Z < mr[4] then
				task.spawn(Player.travel, "cave", S.world)
			elseif S.world == "grave" and S.kills < GRAVE_GATE_KILLS and now > lockMsgAt and math.abs(p.X - WORLDS.grave.origin.X) < 12
				and math.abs(p.Z - (WORLDS.grave.origin.Z - 5)) < 5 then
				lockMsgAt = now + 3
				toast("🔒 The graveyard gates open at " .. GRAVE_GATE_KILLS .. " kills — you have " .. commas(S.kills), Color3.fromRGB(255, 160, 70))
			end
		end
	end
	if p.Y < -40 and not S.dead then Player.placeAt(S.world == "cave" and CAVE_SPAWN or LAYOUT[S.world].spawn) end
	-- healing
	if not S.dead and S.hp < maxHP() then
		local rate = (S.world == "cave") and 30 or (((now - S.lastHurt) > 5) and 2 or 0)
		S.hp = math.min(maxHP(), S.hp + rate * dt)
	end
	-- dash keeps its push for a moment (Humanoids brake hard)
	if S.dashDir and now < S.dashUntil - 0.12 and not S.dead then
		local v = root.AssemblyLinearVelocity
		root.AssemblyLinearVelocity = Vector3.new(S.dashDir.X * 70, v.Y, S.dashDir.Z * 70)
	end
	-- speed: walk / sprint / slowed
	if not S.dead then
		local speed = S.sprint and 26 or 18
		if now < S.chillUntil or now < S.sickUntil then speed *= 0.65 end
		hum.WalkSpeed = speed
	end
	-- sword fixes itself if your avatar changes
	rigCheck -= dt
	if rigCheck <= 0 then
		rigCheck = 0.5
		local ca = CA.list[player]
		local char = player.Character
		if char and not S.dead and (not ca or CA.broken(ca)) then
			local n = CA.setup(player, char)
			if n then CA.attachSword(n, S.equipped) end
		elseif ca and not S.dead and (not ca.sword or ca.sword.Parent ~= char) then
			CA.attachSword(ca, S.equipped)
		end
	end
	-- snow falls around you in Ice World
	if S.world == "ice" and GFX.high then
		if not snow then
			snow = make("Part", { Name = "Snowfall", Size = Vector3.new(110, 1, 110), Transparency = 1, Anchored = true, CanCollide = false, CanQuery = false,
				CanTouch = false, CastShadow = false, Parent = fxFolder })
			make("ParticleEmitter", { Rate = 70, Lifetime = NumberRange.new(5, 7), Speed = NumberRange.new(5, 8), SpreadAngle = Vector2.new(15, 15),
				EmissionDirection = Enum.NormalId.Bottom, Size = NumberSequence.new(0.25), Color = ColorSequence.new(WHITE), LightEmission = 0.3,
				Acceleration = Vector3.new(2, 0, 1), Parent = snow })
		end
		snow.CFrame = CFrame.new(p + Vector3.new(0, 34, 0))
		auroraT += dt
		if Build.aurora then
			for i, a in ipairs(Build.aurora) do a.Transparency = 0.7 + math.sin(auroraT * 0.6 + i) * 0.08 end
		end
	elseif snow then
		snow:Destroy()
		snow = nil
	end
	-- autosave (multiplayer)
	saveT -= dt
	if saveT <= 0 then
		saveT = 8
		if Link.coop and profileReady and S.dirty then
			S.dirty = false
			Link.send("save", profileOut())
		end
	end
end)

------------------------------------------------------------------------------------------------
-- START: build everything → intro → PLAY
------------------------------------------------------------------------------------------------
local function buildEverything()
	building, builtCount = true, 0
	local EST = 8500
	task.spawn(function()
		while building do
			Intro.barFill.Size = UDim2.fromScale(math.clamp(builtCount / EST, 0.03, 0.97), 1)
			task.wait(0.05)
		end
	end)
	local steps = {
		{ "Digging the cave...", Build.cave },
		{ "Opening Gus's shop...", Build.shop },
		{ "Carving pumpkins...", Build.grave },
		{ "Freezing Ice World...", Build.ice },
		{ "Growing the jungle...", Build.jungle },
	}
	for i, st in ipairs(steps) do
		Intro.status.Text = st[1]
		local ok, err = pcall(st[2])
		if not ok then warn("[Forest Hunt 2.0] build step failed (" .. st[1] .. "): " .. tostring(err)) end
		if i == 2 then
			Folders.cave.Parent = worldRoot
			for _, d in ipairs(workspace:GetDescendants()) do
				if isJunk(d) then d:Destroy() end
			end
			workspace.DescendantAdded:Connect(function(d)
				if isJunk(d) then task.defer(function() if d.Parent then d:Destroy() end end) end
			end)
		end
		task.wait()
	end
	building = false
	Intro.barFill.Size = UDim2.fromScale(1, 1)
end

local function flyoverCamera()
	local cam = workspace.CurrentCamera
	if not cam then return end
	cam.CameraType = Enum.CameraType.Scriptable
	local t0 = os.clock()
	while not S.playing do
		cam = workspace.CurrentCamera
		if cam then
			if cam.CameraType ~= Enum.CameraType.Scriptable then cam.CameraType = Enum.CameraType.Scriptable end
			local t = os.clock() - t0
			local a = t * 0.09
			cam.CFrame = CFrame.lookAt(Vector3.new(math.sin(a) * 48, 20 + math.sin(t * 0.3) * 4, math.cos(a) * 48), Vector3.new(0, 7, 0))
		end
		RunService.RenderStepped:Wait()
	end
end

local starting = false
local function startGame()
	if starting or S.playing or not worldReady then return end
	starting = true
	playSfx("magic", nil, { pitch = 1.2 })
	tween(Intro.fade, 0.35, { BackgroundTransparency = 0 })
	task.wait(0.4)
	S.playing = true
	introGui.Enabled = false
	fadeFrame.BackgroundTransparency = 0
	local char, root = player.Character, getRoot()
	if char and root then
		Player.placeAt(CAVE_SPAWN)
		root.Anchored = false
	end
	local cam = workspace.CurrentCamera
	if cam then
		cam.CameraType = Enum.CameraType.Custom
		local hum = getHum()
		if hum then cam.CameraSubject = hum end
	end
	hudGui.Enabled = true
	touchControls(true)
	if Gus.prompt then Gus.prompt.Enabled = true end
	S.world = "cave"
	Link.send("world", "cave")
	Look.apply("cave")
	Amb.set("cave")
	HUD.worldLabel.Text = "🕯 THE CAVE"
	tween(fadeFrame, 0.9, { BackgroundTransparency = 1 })
	playSfx("draw")
	task.delay(1, function()
		Celebrate.show("🎃 2X HALLOWEEN EVENT!", "All coins x2 · collect 100 candies for the Pumpkin Overnight Sword", CANDY, 4)
	end)
	task.delay(1.6, function()
		Gus.waveAt = os.clock()
		Gus.say(LINES.call[1], 4)
		toast("🗺 Walk through a glowing tunnel to go outside and fight!", WHITE, 5)
	end)
end
Intro.play.Activated:Connect(startGame)

task.spawn(function()
	touchControls(false)
	Look.apply("cave")
	task.spawn(flyoverCamera)
	buildEverything()
	worldReady = true
	local char = player.Character
	if char and char:FindFirstChild("HumanoidRootPart") then Player.placeAt(CAVE_SPAWN) end
	if Link.coop then
		Intro.status.Text = "Loading your save..."
		Link.send("hello")
		local t0 = os.clock()
		while not profileReady and os.clock() - t0 < 12 do task.wait(0.1) end
		profileReady = true
	end
	Unlocks.check(true)
	Pickups.candyCheck(true)
	Intro.status.Text = Link.coop and "Ready! 🌐 Multiplayer ON" or "Ready!"
	tween(Intro.bg, 1.2, { BackgroundTransparency = 0.35 })
	tween(Intro.barBack, 0.4, { BackgroundTransparency = 1 })
	tween(Intro.barFill, 0.4, { BackgroundTransparency = 1 })
	Intro.playHolder.Visible = true
	while not S.playing do
		tween(Intro.playScale, 0.6, { Scale = 1.07 }, Enum.EasingStyle.Sine)
		task.wait(0.6)
		tween(Intro.playScale, 0.6, { Scale = 1 }, Enum.EasingStyle.Sine)
		task.wait(0.6)
	end
end)

print("[Forest Hunt " .. VERSION .. "] loaded — " .. (Link.coop and "multiplayer" or "solo") .. " mode. Happy Halloween! 🎃")
