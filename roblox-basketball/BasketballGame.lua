--!nonstrict
--[[
======================================================================================
  COURT KINGS — Roblox basketball game, everything in ONE file (Luau)
======================================================================================

  HOW TO INSTALL (Roblox Studio) — 3 steps, about 1 minute:

  1) ReplicatedStorage -> Insert Object -> ModuleScript.
     Rename it to:  BasketballGame
     Delete its default text and paste THIS WHOLE FILE into it.

  2) ServerScriptService -> Insert Object -> Script.  Paste this one line:
         require(game:GetService("ReplicatedStorage"):WaitForChild("BasketballGame")).StartServer()

  3) StarterPlayer > StarterPlayerScripts -> Insert Object -> LocalScript.  Paste this one line:
         require(game:GetService("ReplicatedStorage"):WaitForChild("BasketballGame")).StartClient()

  Why 2 tiny loader lines? Roblox will not run one script on both the server and every
  player's device. All of the game logic lives in this one ModuleScript; the two
  one-liners just tell Roblox "start the server half here" and "start the player half here".

  STUDIO SETTINGS:
    * Game Settings > Security > "Enable Studio Access to API Services" = ON (saves builds).
    * Lighting > Technology = Future (looks best; scripts can't set this).
    * You can leave the default Baseplate/SpawnLocation; the gym floor sits above them.

  CONTROLS
    PC:       WASD move | Shift sprint | Hold Left Mouse or F = charge shot, release = shoot
              Left Mouse / F without the ball = steal | Hold G = guard
              Q crossover | E between the legs | R behind the back | Space jump
    Mobile:   on-screen buttons (SHOOT/STEAL, SPRINT, GUARD, CROSS, LEGS, BACK)
    Gamepad:  R2 shoot/steal | L2 guard | L3 sprint | X/Y/B dribble moves

  ASSETS YOU MAKE YOURSELF: see the ANIMATIONS and SOUNDS tables below.
  Every "rbxassetid://0" is a placeholder. The game runs without them (it skips
  missing animations and prints one warning for each).
======================================================================================
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local BasketballGame = {}

--==================================================================================
-- 1. CONFIG — tweak the game here
--==================================================================================
local CONFIG = {
	GameName = "COURT KINGS",
	BuildGym = true, -- false = use your own model named "BasketballGym" (see README)

	-- World scale: 1 real foot = 0.9 studs
	FT = 0.9,
	FloorY = 1.1, -- court surface height (above the default baseplate)

	-- Ball and hoop. These are a little bigger than real life so shots are fun to play.
	BallDiameter = 1.5,
	RimRadius = 1.35,
	RimHeightFeet = 10,
	BallGravityScale = 0.5, -- the ball falls at 50% of world gravity (smoother arcs)
	BallElasticity = 0.72,
	BallFriction = 0.45,

	-- Movement
	WalkSpeed = 16,
	SprintMultiplier = 1.55,
	GuardMultiplier = 0.78,
	BallCarryMultiplier = 0.93,
	ChargingMultiplier = 0.45,
	StaminaMax = 100,
	StaminaDrain = 20, -- per second while sprinting (heavier builds drain faster)
	StaminaRegen = 14,

	-- Shooting
	ChargeTime = 1.0, -- seconds to go from 0% to 100% power
	MaxShotRange = 48, -- studs; 100% power reaches this far
	ArcAngle = 52, -- launch angle in degrees
	BackspinRate = 18,
	NoGrabAfterShot = 0.25, -- nobody can grab the ball for this long after release
	ShooterRegrabDelay = 0.5,

	-- Dribbling
	DribbleCycle = 0.5, -- seconds per bounce when standing
	DribbleCycleMoving = 0.36,
	MoveTime = 0.55, -- length of a crossover / between legs / behind back
	MoveCooldown = 0.7,

	-- Steal
	StealCooldown = 1.4,
	StealRange = 4.5,
	StealBaseChance = 0.18,
	StealFailStun = 0.8,

	-- Saving
	DataStoreName = "CourtKings_Builds_v1",
	SaveCooldown = 6,
}

-- Skin colors for the Build menu
local SKIN_TONES = {
	Color3.fromRGB(255, 224, 196),
	Color3.fromRGB(241, 194, 158),
	Color3.fromRGB(224, 172, 122),
	Color3.fromRGB(198, 134, 86),
	Color3.fromRGB(160, 102, 62),
	Color3.fromRGB(124, 76, 46),
	Color3.fromRGB(92, 56, 36),
	Color3.fromRGB(60, 38, 26),
}

local BUILD_LIMITS = {
	HeightMin = 65, -- 5'5"
	HeightMax = 87, -- 7'3"
	WeightMin = 145,
	WeightMax = 220,
}

local DEFAULT_BUILD = { Height = 76, Weight = 190, Skin = 4 }

--==================================================================================
-- 2. ANIMATIONS — put your uploaded animation IDs here (one set per rig type)
--    Make them with the Animation Editor on an R15 dummy AND an R6 dummy
--    (Avatar tab > Rig Builder), publish each, then paste the IDs.
--    The animations must be owned by you (or your group if it's a group game).
--==================================================================================
local ANIMATIONS = {
	Shoot = { R15 = "rbxassetid://0", R6 = "rbxassetid://0" }, -- jump shot (~0.8s, not looped)
	Crossover = { R15 = "rbxassetid://0", R6 = "rbxassetid://0" }, -- ~0.55s
	BetweenLegs = { R15 = "rbxassetid://0", R6 = "rbxassetid://0" }, -- ~0.55s
	BehindBack = { R15 = "rbxassetid://0", R6 = "rbxassetid://0" }, -- ~0.55s
	Sprint = { R15 = "rbxassetid://0", R6 = "rbxassetid://0" }, -- looped
	SprintWithBall = { R15 = "rbxassetid://0", R6 = "rbxassetid://0" }, -- looped; falls back to Sprint
	-- Optional extras (fine to leave as 0):
	Dribble = { R15 = "rbxassetid://0", R6 = "rbxassetid://0" }, -- looped basic hand pump
	Defense = { R15 = "rbxassetid://0", R6 = "rbxassetid://0" }, -- looped defensive stance
	Steal = { R15 = "rbxassetid://0", R6 = "rbxassetid://0" }, -- quick reach/swipe
}

-- If an animation is missing, try this one instead
local ANIM_FALLBACKS = { SprintWithBall = "Sprint" }

local ANIM_SETTINGS = {
	Shoot = { Priority = Enum.AnimationPriority.Action2, Looped = false },
	Crossover = { Priority = Enum.AnimationPriority.Action, Looped = false },
	BetweenLegs = { Priority = Enum.AnimationPriority.Action, Looped = false },
	BehindBack = { Priority = Enum.AnimationPriority.Action, Looped = false },
	Sprint = { Priority = Enum.AnimationPriority.Movement, Looped = true },
	SprintWithBall = { Priority = Enum.AnimationPriority.Movement, Looped = true },
	Dribble = { Priority = Enum.AnimationPriority.Idle, Looped = true },
	Defense = { Priority = Enum.AnimationPriority.Movement, Looped = true },
	Steal = { Priority = Enum.AnimationPriority.Action, Looped = false },
}

--==================================================================================
-- 3. SOUNDS — swap in your own IDs (0 = no sound)
--==================================================================================
local SOUNDS = {
	Bounce = "rbxasset://sounds/action_jump_land.mp3", -- built-in placeholder
	Swish = "rbxasset://sounds/swoosh.wav", -- built-in placeholder
	Rim = "rbxassetid://0",
	Backboard = "rbxassetid://0",
	Steal = "rbxassetid://0",
	Crowd = "rbxassetid://0", -- looped crowd ambience
}

--==================================================================================
-- 4. SHARED MATH (used by both server and client)
--==================================================================================
local function clamp(x: number, a: number, b: number): number
	return math.max(a, math.min(b, x))
end

local function lerp(a: number, b: number, t: number): number
	return a + (b - a) * t
end

local function validAssetId(id: string?): boolean
	if type(id) ~= "string" then
		return false
	end
	if string.sub(id, 1, 11) == "rbxasset://" then
		return true
	end
	local n = tonumber(string.match(id, "%d+$"))
	return n ~= nil and n > 0
end

local function sanitizeBuild(b: any)
	local out = table.clone(DEFAULT_BUILD)
	if type(b) == "table" then
		if type(b.Height) == "number" and b.Height == b.Height then
			out.Height = math.floor(clamp(b.Height, BUILD_LIMITS.HeightMin, BUILD_LIMITS.HeightMax) + 0.5)
		end
		if type(b.Weight) == "number" and b.Weight == b.Weight then
			out.Weight = math.floor(clamp(b.Weight, BUILD_LIMITS.WeightMin, BUILD_LIMITS.WeightMax) + 0.5)
		end
		if type(b.Skin) == "number" and b.Skin == b.Skin then
			out.Skin = math.floor(clamp(b.Skin, 1, #SKIN_TONES) + 0.5)
		end
	end
	return out
end

local function formatHeight(inches: number): string
	return string.format("%d'%d\"", math.floor(inches / 12), inches % 12)
end

-- Turns a build into gameplay numbers. t = how tall (0..1), w = how heavy (0..1)
local function deriveStats(build)
	local b = sanitizeBuild(build)
	local t = (b.Height - BUILD_LIMITS.HeightMin) / (BUILD_LIMITS.HeightMax - BUILD_LIMITS.HeightMin)
	local w = (b.Weight - BUILD_LIMITS.WeightMin) / (BUILD_LIMITS.WeightMax - BUILD_LIMITS.WeightMin)
	local s = {
		t = t,
		w = w,
		Scale = 0.85 + 0.35 * t, -- body height scale
		Width = 0.88 + 0.30 * w, -- body width scale
		SpeedMult = 1.10 - 0.14 * w - 0.06 * t, -- heavy + tall = slower
		JumpPower = 46 + 8 * (1 - w) + 2 * t,
		GrabRadius = 2.3 + 1.2 * t, -- loose balls / rebounds
		ReachUp = 1.2 + 2.2 * t, -- how high above your head you can grab
		Strength = 0.25 + 0.75 * w, -- protects the ball from steals
		ShootTolerance = 0.085 + 0.05 * (1 - t) - 0.02 * w, -- size of the green zone
		CloseBonus = 0.12 * t, -- tall players finish better near the rim
		RangeBonus = 0.10 * (1 - t) - 0.05 * w, -- small players shoot better from deep
		StealSkill = 0.10 * (1 - w) + 0.05 * (1 - t),
		StaminaDrain = 1 + 0.45 * w,
	}
	-- 0..99 ratings for the Build menu
	s.Ratings = {
		Speed = math.floor(clamp((s.SpeedMult - 0.88) / 0.22, 0, 1) * 60 + 35),
		Strength = math.floor(s.Strength * 60 + 35),
		Reach = math.floor(t * 60 + 35),
		Shooting = math.floor(clamp((s.ShootTolerance - 0.065) / 0.07, 0, 1) * 45 + 45),
		Defense = math.floor(clamp(0.5 * t + 0.5 * (1 - w) * 0.6 + s.StealSkill * 2, 0, 1) * 55 + 40),
	}
	return s
end

-- How much power is "perfect" for a shot from distance d (studs)
local function idealPower(d: number): number
	return clamp(0.1 + 0.9 * (d / CONFIG.MaxShotRange), 0.1, 1)
end

-- Base make chance from distance only (before charge/build/defense)
local DISTANCE_CURVE = { { 0, 0.93 }, { 6, 0.9 }, { 14, 0.76 }, { 21, 0.64 }, { 25, 0.55 }, { 35, 0.3 }, { 48, 0.08 } }
local function distanceFactor(d: number): number
	for i = 1, #DISTANCE_CURVE - 1 do
		local a, b = DISTANCE_CURVE[i], DISTANCE_CURVE[i + 1]
		if d <= b[1] then
			return lerp(a[2], b[2], (d - a[1]) / (b[1] - a[1]))
		end
	end
	return 0.04
end

-- Charge accuracy: 1.0 right on the target, falls off outside the green zone
local function powerFactor(err: number, tol: number): number
	if err <= tol then
		return 1 - 0.15 * (err / tol)
	end
	return math.max(0, 0.85 - (err - tol) * 4.5)
end

-- Court geometry (studs). Court length runs along X, width along Z.
local GEO = (function()
	local FT = CONFIG.FT
	local g = {}
	g.L = 94 * FT
	g.W = 50 * FT
	g.Y = CONFIG.FloorY
	g.RimY = g.Y + CONFIG.RimHeightFeet * FT
	g.BoardFrontX = g.L / 2 - 4 * FT
	g.RimX = g.BoardFrontX - (CONFIG.RimRadius + 0.75)
	g.ThreeR = 23.75 * FT
	g.ThreeCorner = 22 * FT
	g.ThreeTheta = math.asin(g.ThreeCorner / g.ThreeR)
	g.ThreeBreak = g.ThreeR * math.cos(g.ThreeTheta) -- distance from rim (toward center) where arc starts
	g.LaneHalf = 8 * FT
	g.FTLineFromBase = 19 * FT
	g.GymX = g.L + 46
	g.GymZ = g.W + 60
	g.GymH = 46
	return g
end)()

-- Is a shot from position p (world) a three, for the hoop with sign sgn (+1 east / -1 west)?
local function isThree(sgn: number, p: Vector3): boolean
	local rimX = sgn * GEO.RimX
	local xRel = (rimX - p.X) * sgn -- distance from rim toward center court
	local z = p.Z
	if xRel < GEO.ThreeBreak then
		return math.abs(z) >= GEO.ThreeCorner
	end
	local d = math.sqrt((p.X - rimX) ^ 2 + z * z)
	return d >= GEO.ThreeR
end

-- Which hoop are you shooting at? The one you're facing (falls back to the nearest)
local function pickHoopIndex(centers: { Vector3 }, pos: Vector3, look: Vector3): (number, number)
	local flatLook = Vector3.new(look.X, 0, look.Z)
	flatLook = flatLook.Magnitude > 0.01 and flatLook.Unit or Vector3.new(1, 0, 0)
	local bestI, bestScore, bestD = 1, -math.huge, math.huge
	for i, c in ipairs(centers) do
		local to = Vector3.new(c.X - pos.X, 0, c.Z - pos.Z)
		local d = to.Magnitude
		local facing = d > 0.01 and flatLook:Dot(to.Unit) or 1
		local score = facing - d / 200 -- facing matters most, distance breaks ties
		if score > bestScore then
			bestI, bestScore, bestD = i, score, d
		end
	end
	return bestI, bestD
end

BasketballGame.CONFIG = CONFIG
BasketballGame.ANIMATIONS = ANIMATIONS
BasketballGame.SOUNDS = SOUNDS
BasketballGame.GEO = GEO
BasketballGame.Shared = {
	deriveStats = deriveStats,
	sanitizeBuild = sanitizeBuild,
	idealPower = idealPower,
	distanceFactor = distanceFactor,
	powerFactor = powerFactor,
	isThree = isThree,
	pickHoopIndex = pickHoopIndex,
	formatHeight = formatHeight,
}

-- Small helper to create instances
local function new(className: string, props: { [string]: any }?, children: { Instance }?): any
	local inst = Instance.new(className)
	local parent = nil
	if props then
		for k, v in pairs(props) do
			if k == "Parent" then
				parent = v
			else
				(inst :: any)[k] = v
			end
		end
	end
	if children then
		for _, c in ipairs(children) do
			c.Parent = inst
		end
	end
	if parent then
		inst.Parent = parent
	end
	return inst
end

--==================================================================================
-- 5. GYM BUILDER (server) — court, lines, hoops, bleachers, lights, scoreboard
--==================================================================================
local COLORS = {
	Wood = Color3.fromRGB(214, 163, 106),
	Paint = Color3.fromRGB(28, 54, 112),
	Apron = Color3.fromRGB(22, 40, 84),
	Line = Color3.fromRGB(245, 245, 245),
	Rim = Color3.fromRGB(232, 74, 20),
	Wall = Color3.fromRGB(58, 62, 74),
	Seat = Color3.fromRGB(170, 30, 36),
	Steel = Color3.fromRGB(120, 124, 132),
	Pad = Color3.fromRGB(28, 54, 112),
	Ball = Color3.fromRGB(204, 85, 20),
}

local LINE_W = 0.22
local LINE_T = 0.03

local function makePart(parent: Instance, props: { [string]: any })
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	for k, v in pairs(props) do
		(p :: any)[k] = v
	end
	p.Parent = parent
	return p
end

local function decorPart(parent: Instance, props: { [string]: any })
	local p = makePart(parent, props)
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.CastShadow = false
	return p
end

-- Flat painted segment on the floor from (x1,z1) to (x2,z2)
local function floorSeg(parent: Instance, x1: number, z1: number, x2: number, z2: number, width: number?, color: Color3?)
	local a = Vector3.new(x1, GEO.Y + LINE_T / 2, z1)
	local b = Vector3.new(x2, GEO.Y + LINE_T / 2, z2)
	local len = (b - a).Magnitude
	if len < 0.01 then
		return
	end
	decorPart(parent, {
		Name = "Line",
		Size = Vector3.new(width or LINE_W, LINE_T, len + (width or LINE_W) * 0.5),
		CFrame = CFrame.lookAt((a + b) / 2, b),
		Color = color or COLORS.Line,
	})
end

-- Arc of floor line around (cx,cz). Angle 0 = +X, angle 90deg = +Z
local function floorArc(parent: Instance, cx: number, cz: number, r: number, a0: number, a1: number, segs: number, dashed: boolean?)
	for i = 0, segs - 1 do
		if not dashed or i % 2 == 0 then
			local t0 = a0 + (a1 - a0) * i / segs
			local t1 = a0 + (a1 - a0) * (i + 1) / segs
			floorSeg(parent, cx + r * math.cos(t0), cz + r * math.sin(t0), cx + r * math.cos(t1), cz + r * math.sin(t1))
		end
	end
end

local function surfaceText(part: BasePart, face: Enum.NormalId, text: string, color: Color3?, font: Enum.Font?)
	local gui = new("SurfaceGui", { Face = face, SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud, PixelsPerStud = 40, LightInfluence = 0.3, Parent = part })
	return new("TextLabel", {
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		Text = text,
		TextScaled = true,
		Font = font or Enum.Font.GothamBlack,
		TextColor3 = color or Color3.new(1, 1, 1),
		Parent = gui,
	})
end

local function buildHoop(parent: Instance, sgn: number)
	local hoop = new("Model", { Name = sgn > 0 and "HoopEast" or "HoopWest", Parent = parent })
	hoop:SetAttribute("Sign", sgn)
	local Y, rimY = GEO.Y, GEO.RimY
	local rimX = sgn * GEO.RimX
	local boardFront = sgn * GEO.BoardFrontX
	local boardW, boardH, boardT = 8, 4.6, 0.3
	local boardBottom = rimY - 0.6
	local boardCX = boardFront + sgn * boardT / 2

	-- Glass backboard (collides)
	makePart(hoop, {
		Name = "Backboard",
		Size = Vector3.new(boardT, boardH, boardW),
		CFrame = CFrame.new(boardCX, boardBottom + boardH / 2, 0),
		Material = Enum.Material.Glass,
		Color = Color3.fromRGB(200, 230, 255),
		Transparency = 0.55,
	})
	-- Board frame + shooter's square (decor, on the court-facing side)
	local fx = boardFront - sgn * 0.02
	local function boardStrip(y: number, z: number, h: number, w: number, color: Color3)
		decorPart(hoop, { Name = "BoardMark", Size = Vector3.new(0.04, h, w), CFrame = CFrame.new(fx, y, z), Color = color })
	end
	local white = COLORS.Line
	boardStrip(boardBottom + boardH - 0.1, 0, 0.2, boardW, white)
	boardStrip(boardBottom + 0.1, 0, 0.2, boardW, white)
	boardStrip(boardBottom + boardH / 2, boardW / 2 - 0.1, boardH, 0.2, white)
	boardStrip(boardBottom + boardH / 2, -boardW / 2 + 0.1, boardH, 0.2, white)
	local sqW, sqH = 3.2, 2.3
	local sqBottom = rimY + 0.15
	boardStrip(sqBottom, 0, 0.14, sqW, white)
	boardStrip(sqBottom + sqH, 0, 0.14, sqW, white)
	boardStrip(sqBottom + sqH / 2, sqW / 2, sqH, 0.14, white)
	boardStrip(sqBottom + sqH / 2, -sqW / 2, sqH, 0.14, white)

	-- Rim: ring of small parts (collides so misses bounce realistically)
	local rimParts = {}
	local segs = 20
	for i = 0, segs - 1 do
		local a0 = (i / segs) * math.pi * 2
		local a1 = ((i + 1) / segs) * math.pi * 2
		local p0 = Vector3.new(rimX + CONFIG.RimRadius * math.cos(a0), rimY, CONFIG.RimRadius * math.sin(a0))
		local p1 = Vector3.new(rimX + CONFIG.RimRadius * math.cos(a1), rimY, CONFIG.RimRadius * math.sin(a1))
		local seg = makePart(hoop, {
			Name = "Rim",
			Size = Vector3.new(0.16, 0.16, (p1 - p0).Magnitude + 0.08),
			CFrame = CFrame.lookAt((p0 + p1) / 2, p1),
			Color = COLORS.Rim,
			Material = Enum.Material.Metal,
		})
		table.insert(rimParts, seg)
	end
	-- Bracket from board to rim
	local bracketLen = math.abs(boardFront - (rimX + sgn * CONFIG.RimRadius))
	makePart(hoop, {
		Name = "RimBracket",
		Size = Vector3.new(bracketLen, 0.2, 0.6),
		CFrame = CFrame.new(boardFront - sgn * bracketLen / 2, rimY - 0.05, 0),
		Color = COLORS.Rim,
		Material = Enum.Material.Metal,
	})
	-- Net (visual only)
	local strands = 12
	for i = 0, strands - 1 do
		local a = (i / strands) * math.pi * 2
		local aOff = a + math.pi / strands
		local top = Vector3.new(rimX + CONFIG.RimRadius * math.cos(a), rimY - 0.08, CONFIG.RimRadius * math.sin(a))
		local bottom = Vector3.new(rimX + CONFIG.RimRadius * 0.6 * math.cos(aOff), rimY - 1.7, CONFIG.RimRadius * 0.6 * math.sin(aOff))
		decorPart(hoop, {
			Name = "Net",
			Size = Vector3.new(0.05, 0.05, (bottom - top).Magnitude),
			CFrame = CFrame.lookAt((top + bottom) / 2, bottom),
			Color = Color3.new(1, 1, 1),
			Transparency = 0.15,
			Material = Enum.Material.Fabric,
		})
	end
	-- Stanchion (padded base, pole, arm)
	local baseX = sgn * (GEO.L / 2 + 6)
	makePart(hoop, { Name = "StanchionBase", Size = Vector3.new(4, 2.4, 5), CFrame = CFrame.new(baseX, Y + 1.2, 0), Color = COLORS.Pad, Material = Enum.Material.Fabric })
	makePart(hoop, { Name = "Pole", Size = Vector3.new(0.8, rimY + 2.5 - Y, 0.8), CFrame = CFrame.new(baseX, (Y + rimY + 2.5) / 2, 0), Color = COLORS.Steel, Material = Enum.Material.Metal })
	local armStart = baseX - sgn * 0.4
	local armEnd = boardCX + sgn * boardT / 2
	makePart(hoop, {
		Name = "Arm",
		Size = Vector3.new(math.abs(armStart - armEnd), 0.6, 0.6),
		CFrame = CFrame.new((armStart + armEnd) / 2, rimY + 2.2, 0),
		Color = COLORS.Steel,
		Material = Enum.Material.Metal,
	})
	makePart(hoop, {
		Name = "PolePad",
		Size = Vector3.new(1.4, 4, 1.4),
		CFrame = CFrame.new(baseX, Y + 4.4, 0),
		Color = COLORS.Pad,
		Material = Enum.Material.Fabric,
	})
	-- Invisible marker the scripts use to find the rim center
	decorPart(hoop, { Name = "RimCenter", Size = Vector3.new(0.2, 0.2, 0.2), CFrame = CFrame.new(rimX, rimY, 0), Transparency = 1 })
	hoop.PrimaryPart = hoop:FindFirstChild("RimCenter") :: BasePart

	return hoop, rimParts
end

local function buildGym()
	local old = Workspace:FindFirstChild("BasketballGym")
	if old then
		old:Destroy()
	end
	local gym = new("Model", { Name = "BasketballGym" })
	local Y, L, W = GEO.Y, GEO.L, GEO.W
	local GX, GZ, GH = GEO.GymX, GEO.GymZ, GEO.GymH

	-- Floor slab + hardwood (court + 6 stud apron)
	makePart(gym, { Name = "GymFloor", Size = Vector3.new(GX, 1, GZ), CFrame = CFrame.new(0, Y - 0.6, 0), Color = Color3.fromRGB(70, 72, 80), Material = Enum.Material.Concrete })
	local apron = 6
	local court = makePart(gym, {
		Name = "Court",
		Size = Vector3.new(L + apron * 2, 0.2, W + apron * 2),
		CFrame = CFrame.new(0, Y - 0.1, 0),
		Color = COLORS.Wood,
		Material = Enum.Material.WoodPlanks,
	})
	court:SetAttribute("CourtSurface", true)

	local lines = new("Folder", { Name = "CourtLines", Parent = gym })
	local paintY = Y + 0.005
	local function paint(name: string, cx: number, cz: number, sx: number, sz: number, color: Color3)
		decorPart(lines, { Name = name, Size = Vector3.new(sx, 0.01, sz), CFrame = CFrame.new(cx, paintY, cz), Color = color, Material = Enum.Material.SmoothPlastic })
	end
	-- Apron border paint
	paint("Apron", 0, W / 2 + apron / 2, L + apron * 2, apron, COLORS.Apron)
	paint("Apron", 0, -W / 2 - apron / 2, L + apron * 2, apron, COLORS.Apron)
	paint("Apron", L / 2 + apron / 2, 0, apron, W, COLORS.Apron)
	paint("Apron", -L / 2 - apron / 2, 0, apron, W, COLORS.Apron)

	-- Boundary + half court
	floorSeg(lines, -L / 2, -W / 2, L / 2, -W / 2)
	floorSeg(lines, -L / 2, W / 2, L / 2, W / 2)
	floorSeg(lines, -L / 2, -W / 2, -L / 2, W / 2)
	floorSeg(lines, L / 2, -W / 2, L / 2, W / 2)
	floorSeg(lines, 0, -W / 2, 0, W / 2)
	-- Center circle + logo
	local FT = CONFIG.FT
	floorArc(lines, 0, 0, 6 * FT, 0, math.pi * 2, 40)
	floorArc(lines, 0, 0, 2 * FT, 0, math.pi * 2, 20)
	local logo = decorPart(lines, {
		Name = "CenterLogo",
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(0.012, 12 * FT - LINE_W, 12 * FT - LINE_W),
		CFrame = CFrame.new(0, Y + 0.006, 0) * CFrame.Angles(0, 0, math.pi / 2),
		Color = COLORS.Paint,
	})
	logo.Transparency = 0
	local logoText = decorPart(lines, { Name = "LogoText", Size = Vector3.new(9, 0.01, 2.2), CFrame = CFrame.new(0, Y + 0.035, 0), Transparency = 1 })
	surfaceText(logoText, Enum.NormalId.Top, CONFIG.GameName, Color3.fromRGB(255, 190, 60))

	for _, sgn in ipairs({ 1, -1 }) do
		local baseX = sgn * L / 2
		local rimX = sgn * GEO.RimX
		local ftX = sgn * (L / 2 - GEO.FTLineFromBase)
		local lane = GEO.LaneHalf
		-- Painted key
		paint("Key", (baseX + ftX) / 2, 0, math.abs(baseX - ftX), lane * 2, COLORS.Paint)
		floorSeg(lines, baseX, lane, ftX, lane)
		floorSeg(lines, baseX, -lane, ftX, -lane)
		floorSeg(lines, ftX, -lane, ftX, lane)
		-- Free-throw circle: solid half toward center court, dashed half inside the key
		local towardCenter = sgn > 0 and math.pi or 0
		floorArc(lines, ftX, 0, 6 * FT, towardCenter - math.pi / 2, towardCenter + math.pi / 2, 18)
		floorArc(lines, ftX, 0, 6 * FT, towardCenter + math.pi / 2, towardCenter + math.pi * 1.5, 18, true)
		-- Restricted area arc
		floorArc(lines, rimX, 0, 4 * FT, towardCenter - math.pi / 2, towardCenter + math.pi / 2, 14)
		-- Three-point line: straight corners + arc
		local breakX = rimX - sgn * GEO.ThreeBreak
		floorSeg(lines, baseX, GEO.ThreeCorner, breakX, GEO.ThreeCorner)
		floorSeg(lines, baseX, -GEO.ThreeCorner, breakX, -GEO.ThreeCorner)
		local th = GEO.ThreeTheta
		floorArc(lines, rimX, 0, GEO.ThreeR, towardCenter - th, towardCenter + th, 40)
		-- Lane hash marks
		for _, d in ipairs({ 7, 8 + 3, 11 + 3, 14 + 3 }) do
			local hx = baseX - sgn * d * FT
			floorSeg(lines, hx, lane, hx, lane + 0.6)
			floorSeg(lines, hx, -lane, hx, -lane - 0.6)
		end
	end

	-- Hoops
	local hoopsFolder = new("Folder", { Name = "Hoops", Parent = gym })
	local hoops = {}
	for _, sgn in ipairs({ 1, -1 }) do
		local model, rimParts = buildHoop(hoopsFolder, sgn)
		table.insert(hoops, { Sign = sgn, Model = model, RimParts = rimParts, Center = Vector3.new(sgn * GEO.RimX, GEO.RimY, 0) })
	end

	-- Walls + ceiling
	local wallT = 2
	local function wall(name: string, cf: CFrame, size: Vector3)
		makePart(gym, { Name = name, Size = size, CFrame = cf, Color = COLORS.Wall, Material = Enum.Material.Brick })
	end
	wall("WallN", CFrame.new(0, Y + GH / 2, GZ / 2 + wallT / 2), Vector3.new(GX + wallT * 2, GH, wallT))
	wall("WallS", CFrame.new(0, Y + GH / 2, -GZ / 2 - wallT / 2), Vector3.new(GX + wallT * 2, GH, wallT))
	wall("WallE", CFrame.new(GX / 2 + wallT / 2, Y + GH / 2, 0), Vector3.new(wallT, GH, GZ))
	wall("WallW", CFrame.new(-GX / 2 - wallT / 2, Y + GH / 2, 0), Vector3.new(wallT, GH, GZ))
	makePart(gym, { Name = "Ceiling", Size = Vector3.new(GX + wallT * 2, 1, GZ + wallT * 2), CFrame = CFrame.new(0, Y + GH + 0.5, 0), Color = Color3.fromRGB(40, 42, 50), Material = Enum.Material.DiamondPlate })
	-- Lower wall padding stripe + banners
	for _, side in ipairs({ 1, -1 }) do
		decorPart(gym, { Name = "WallStripe", Size = Vector3.new(GX, 3, 0.2), CFrame = CFrame.new(0, Y + 1.5, side * (GZ / 2 - 0.1)), Color = COLORS.Apron })
		decorPart(gym, { Name = "EndStripe", Size = Vector3.new(0.2, 3, GZ), CFrame = CFrame.new(side * (GX / 2 - 0.1), Y + 1.5, 0), Color = COLORS.Apron })
		local banner = decorPart(gym, {
			Name = "Banner",
			Size = Vector3.new(0.2, 8, 20),
			CFrame = CFrame.new(side * (GX / 2 - 0.15), Y + GH - 12, 0),
			Color = Color3.fromRGB(170, 30, 36),
		})
		surfaceText(banner, side > 0 and Enum.NormalId.Left or Enum.NormalId.Right, "CHAMPIONS", Color3.fromRGB(255, 220, 120))
	end

	-- Bleachers along both sidelines
	for _, side in ipairs({ 1, -1 }) do
		local startZ = W / 2 + apron + 4
		for tier = 0, 6 do
			local depth = 3
			local z = side * (startZ + tier * depth + depth / 2)
			local h = 1.5 * (tier + 1)
			makePart(gym, {
				Name = "Bleacher",
				Size = Vector3.new(L * 0.85, h, depth),
				CFrame = CFrame.new(0, Y + h / 2, z),
				Color = tier % 2 == 0 and COLORS.Seat or Color3.fromRGB(140, 24, 30),
				Material = Enum.Material.Plastic,
			})
		end
		-- Scorer's table on one side
		if side > 0 then
			local tbl = makePart(gym, { Name = "ScorersTable", Size = Vector3.new(16, 3, 2.5), CFrame = CFrame.new(0, Y + 1.5, W / 2 + 3.2), Color = Color3.fromRGB(30, 30, 36) })
			surfaceText(tbl, Enum.NormalId.Front, CONFIG.GameName, Color3.fromRGB(255, 190, 60))
		end
	end

	-- Arena lighting: rows of fixtures with spot lights + overall Lighting setup
	local lightsFolder = new("Folder", { Name = "Lights", Parent = gym })
	for ix = -2, 2 do
		for iz = -1, 1 do
			local fixture = decorPart(lightsFolder, {
				Name = "LightFixture",
				Size = Vector3.new(4, 0.4, 4),
				CFrame = CFrame.new(ix * (L / 5), Y + GH - 2, iz * (W / 2.6)),
				Material = Enum.Material.Neon,
				Color = Color3.fromRGB(255, 248, 230),
			})
			new("SpotLight", { Face = Enum.NormalId.Bottom, Angle = 115, Range = 60, Brightness = 2.2, Shadows = (ix == 0 and iz == 0), Color = Color3.fromRGB(255, 244, 225), Parent = fixture })
		end
	end
	local Lighting = game:GetService("Lighting")
	Lighting.Ambient = Color3.fromRGB(80, 80, 92)
	Lighting.OutdoorAmbient = Color3.fromRGB(100, 100, 110)
	Lighting.Brightness = 1
	Lighting.ClockTime = 14
	Lighting.GlobalShadows = true
	Lighting.EnvironmentDiffuseScale = 0.4
	Lighting.EnvironmentSpecularScale = 0.6
	if not Lighting:FindFirstChild("BB_Color") then
		new("ColorCorrectionEffect", { Name = "BB_Color", Brightness = 0.02, Contrast = 0.12, Saturation = 0.12, Parent = Lighting })
		new("BloomEffect", { Name = "BB_Bloom", Intensity = 0.35, Size = 24, Threshold = 1.6, Parent = Lighting })
	end

	-- Center-hung scoreboard
	local board = makePart(gym, {
		Name = "Scoreboard",
		Size = Vector3.new(12, 7, 12),
		CFrame = CFrame.new(0, Y + GH - 12, 0),
		Color = Color3.fromRGB(20, 20, 24),
		Material = Enum.Material.Metal,
	})
	local scoreLabels = {}
	for _, face in ipairs({ Enum.NormalId.Front, Enum.NormalId.Back, Enum.NormalId.Left, Enum.NormalId.Right }) do
		local lbl = surfaceText(board, face, "COURT KINGS\nFREE PLAY", Color3.fromRGB(255, 200, 60), Enum.Font.Code)
		table.insert(scoreLabels, lbl)
	end

	-- Spawn point at the scorer's table
	local spawnCF = CFrame.new(-8, Y + 3.5, W / 2 - 3)

	pcall(function()
		gym.ModelStreamingMode = Enum.ModelStreamingMode.Persistent
	end)
	gym.Parent = Workspace
	return gym, hoops, scoreLabels, spawnCF
end

-- Use a gym the user built (must follow the naming in the README)
local function useExistingGym()
	local gym = Workspace:WaitForChild("BasketballGym")
	local hoops = {}
	for _, model in ipairs(gym:WaitForChild("Hoops"):GetChildren()) do
		local center = model:FindFirstChild("RimCenter")
		if center and center:IsA("BasePart") then
			local rims = {}
			for _, d in ipairs(model:GetDescendants()) do
				if d:IsA("BasePart") and d.Name == "Rim" then
					table.insert(rims, d)
				end
			end
			table.insert(hoops, { Sign = model:GetAttribute("Sign") or (center.Position.X >= 0 and 1 or -1), Model = model, RimParts = rims, Center = center.Position })
		end
	end
	local labels = {}
	local sb = gym:FindFirstChild("Scoreboard")
	if sb then
		for _, d in ipairs(sb:GetDescendants()) do
			if d:IsA("TextLabel") then
				table.insert(labels, d)
			end
		end
	end
	local spawnPart = gym:FindFirstChild("PlayerSpawn")
	local spawnCF = spawnPart and (spawnPart :: BasePart).CFrame + Vector3.new(0, 3, 0) or CFrame.new(0, GEO.Y + 3, GEO.W / 2 + 1.5)
	return gym, hoops, labels, spawnCF
end

--==================================================================================
-- 6. SERVER
--==================================================================================
function BasketballGame.StartServer()
	assert(RunService:IsServer(), "StartServer must be called from a server Script")
	local DataStoreService = game:GetService("DataStoreService")
	local PhysicsService = game:GetService("PhysicsService")

	Players.CharacterAutoLoads = false -- players spawn when they press PLAY

	-- Remotes
	local remotes = new("Folder", { Name = "BasketballRemotes" })
	local ActionRemote = new("RemoteEvent", { Name = "Action", Parent = remotes })
	local NotifyRemote = new("RemoteEvent", { Name = "Notify", Parent = remotes })
	local GetBuildRemote = new("RemoteFunction", { Name = "GetBuild", Parent = remotes })
	local SaveBuildRemote = new("RemoteFunction", { Name = "SaveBuild", Parent = remotes })
	remotes.Parent = ReplicatedStorage

	-- Collision groups: the ball passes through players (pickups use reach checks instead)
	pcall(function()
		PhysicsService:RegisterCollisionGroup("BB_Ball")
		PhysicsService:RegisterCollisionGroup("BB_Players")
		PhysicsService:CollisionGroupSetCollidable("BB_Ball", "BB_Players", false)
	end)

	-- Gym
	local gym, hoops, scoreLabels, spawnCF
	if CONFIG.BuildGym then
		gym, hoops, scoreLabels, spawnCF = buildGym()
	else
		gym, hoops, scoreLabels, spawnCF = useExistingGym()
	end
	local RIM_R = CONFIG.RimRadius
	local BALL_R = CONFIG.BallDiameter / 2
	local rng = Random.new()

	local function playSound(parent: Instance, key: string, volume: number?, pitch: number?)
		local id = SOUNDS[key]
		if not validAssetId(id) then
			return
		end
		local s = new("Sound", { SoundId = id, Volume = volume or 0.6, PlaybackSpeed = pitch or 1, RollOffMaxDistance = 120, Parent = parent })
		s:Play()
		s.Ended:Once(function()
			s:Destroy()
		end)
		task.delay(6, function()
			if s.Parent then
				s:Destroy()
			end
		end)
	end

	if validAssetId(SOUNDS.Crowd) then
		local crowd = new("Sound", { Name = "Crowd", SoundId = SOUNDS.Crowd, Looped = true, Volume = 0.25, Parent = gym })
		crowd:Play()
	end

	-- The basketball
	local ball: Part = Instance.new("Part")
	ball.Name = "Basketball"
	ball.Shape = Enum.PartType.Ball
	ball.Size = Vector3.one * CONFIG.BallDiameter
	ball.Color = COLORS.Ball
	ball.Material = Enum.Material.Fabric
	ball.TopSurface = Enum.SurfaceType.Smooth
	ball.BottomSurface = Enum.SurfaceType.Smooth
	ball.CustomPhysicalProperties = PhysicalProperties.new(0.35, CONFIG.BallFriction, CONFIG.BallElasticity, 1, 100)
	ball.CollisionGroup = "BB_Ball"
	ball.CFrame = CFrame.new(0, GEO.Y + 3, 0)
	-- Black seams: thin discs slightly wider than the ball, so only their edges show
	for i, rot in ipairs({ CFrame.new(), CFrame.Angles(0, math.pi / 2, 0), CFrame.Angles(0, 0, math.pi / 2) }) do
		local seam = Instance.new("Part")
		seam.Name = "Seam" .. i
		seam.Shape = Enum.PartType.Cylinder
		seam.Size = Vector3.new(0.05, CONFIG.BallDiameter + 0.02, CONFIG.BallDiameter + 0.02)
		seam.Color = Color3.fromRGB(25, 15, 10)
		seam.Material = Enum.Material.SmoothPlastic
		seam.CanCollide = false
		seam.CanTouch = false
		seam.CanQuery = false
		seam.Massless = true
		seam.CFrame = ball.CFrame * rot
		local w = Instance.new("WeldConstraint")
		w.Part0 = ball
		w.Part1 = seam
		w.Parent = seam
		seam.Parent = ball
	end
	-- Custom ball gravity (counter-force) so shots have a nice arc
	local att = new("Attachment", { Name = "BB_Center", Parent = ball })
	local antiGrav = new("VectorForce", {
		Name = "BB_AntiGravity",
		Attachment0 = att,
		RelativeTo = Enum.ActuatorRelativeTo.World,
		ApplyAtCenterOfMass = true,
		Parent = ball,
	})
	ball.Parent = gym -- inside the (always streamed) gym model
	local function updateAntiGrav()
		antiGrav.Force = Vector3.new(0, ball:GetMass() * Workspace.Gravity * (1 - CONFIG.BallGravityScale), 0)
	end
	updateAntiGrav()
	ball:SetAttribute("HolderId", 0)
	pcall(function()
		ball:SetNetworkOwner(nil)
	end)

	-- Server state
	type PlayerData = {
		build: any,
		stats: any,
		inGame: boolean,
		loaded: boolean,
		guarding: boolean,
		lastSteal: number,
		lastMove: number,
		lastSave: number,
		regrabAt: number,
		dirty: boolean,
	}
	local pdata: { [Player]: PlayerData } = {}
	local state = {
		holder = nil :: Player?,
		weld = nil :: Weld?,
		side = 1,
		phase = 0,
		move = nil :: { style: string, t0: number }?,
		charging = false,
		shot = nil :: any,
		noGrabUntil = 0,
		lastActive = os.clock(),
		lastPos = ball.Position,
		lastVy = 0,
	}
	local buildStore = nil
	local okStore = pcall(function()
		buildStore = DataStoreService:GetDataStore(CONFIG.DataStoreName)
	end)
	if not okStore then
		warn("[CourtKings] DataStore unavailable (turn on Studio Access to API Services). Builds won't save.")
	end

	local function notify(player: Player, kind: string, text: string?, extra: any?)
		NotifyRemote:FireClient(player, kind, text, extra)
	end
	local function notifyAll(kind: string, text: string?, extra: any?)
		NotifyRemote:FireAllClients(kind, text, extra)
	end

	local function setScoreboard(text: string)
		for _, lbl in ipairs(scoreLabels) do
			lbl.Text = text
		end
	end

	local function getRig(player: Player)
		local char = player.Character
		if not char then
			return nil
		end
		local hum = char:FindFirstChildOfClass("Humanoid")
		local root = char:FindFirstChild("HumanoidRootPart") :: BasePart?
		if not hum or not root or hum.Health <= 0 then
			return nil
		end
		return char, hum, root
	end

	local function groundOffset(char: Model, hum: Humanoid, root: BasePart): number
		if hum.RigType == Enum.HumanoidRigType.R15 then
			return hum.HipHeight + root.Size.Y / 2
		end
		local leg = char:FindFirstChild("Right Leg") :: BasePart?
		return root.Size.Y / 2 + (leg and leg.Size.Y or 2)
	end

	local hoopCenters = {}
	for i, h in ipairs(hoops) do
		hoopCenters[i] = h.Center
	end
	local function targetHoop(root: BasePart)
		local i, d = pickHoopIndex(hoopCenters, root.Position, root.CFrame.LookVector)
		return hoops[i], d
	end

	local function setRimCollision(hoop, on: boolean)
		for _, p in ipairs(hoop.RimParts) do
			p.CanCollide = on
		end
	end

	-- Ball possession ----------------------------------------------------------
	local function releaseBall()
		if state.weld then
			state.weld:Destroy()
			state.weld = nil
		end
		state.holder = nil
		state.charging = false
		state.move = nil
		ball.Massless = false
		ball.CanCollide = true
		antiGrav.Enabled = true
		ball:SetAttribute("HolderId", 0)
		pcall(function()
			ball:SetNetworkOwner(nil)
		end)
	end

	local function dropBall(atPos: Vector3?)
		local holder = state.holder
		releaseBall()
		if atPos then
			ball.CFrame = CFrame.new(atPos)
		end
		ball.AssemblyLinearVelocity = Vector3.new(0, -5, 0)
		state.lastActive = os.clock()
		if holder then
			local pd = pdata[holder]
			if pd then
				pd.regrabAt = os.clock() + 0.6
			end
		end
	end

	local function giveBall(player: Player)
		local char, _hum, root = getRig(player)
		if not char then
			return false
		end
		if state.holder then
			releaseBall()
		end
		ball.AssemblyLinearVelocity = Vector3.zero
		ball.AssemblyAngularVelocity = Vector3.zero
		ball.Massless = true
		ball.CanCollide = false
		antiGrav.Enabled = false
		local weld = Instance.new("Weld")
		weld.Name = "BB_HoldWeld"
		weld.Part0 = root
		weld.Part1 = ball
		weld.C0 = CFrame.new(1.2, -0.6, -1.0)
		weld.Parent = ball
		state.weld = weld
		state.holder = player
		state.side = 1
		state.phase = 0
		state.move = nil
		state.charging = false
		if state.shot and not state.shot.scored then
			setRimCollision(state.shot.hoop, true)
		end
		state.shot = nil
		state.lastActive = os.clock()
		ball:SetAttribute("HolderId", player.UserId)
		return true
	end

	local function resetBall()
		if state.holder then
			releaseBall()
		end
		ball.CFrame = CFrame.new(0, GEO.Y + 4, 0)
		ball.AssemblyLinearVelocity = Vector3.zero
		ball.AssemblyAngularVelocity = Vector3.zero
		state.shot = nil
		state.lastActive = os.clock()
	end

	-- Can this player grab the free ball right now? (taller = more reach)
	local function canReach(player: Player): (boolean, number)
		local pd = pdata[player]
		if not pd or not pd.inGame or os.clock() < pd.regrabAt then
			return false, math.huge
		end
		local char, _hum, root = getRig(player)
		if not char then
			return false, math.huge
		end
		local head = char:FindFirstChild("Head") :: BasePart?
		local topY = (head and head.Position.Y + head.Size.Y / 2 or root.Position.Y + 2) + pd.stats.ReachUp
		local bottomY = root.Position.Y - 4
		local bp = ball.Position
		local flat = Vector3.new(bp.X - root.Position.X, 0, bp.Z - root.Position.Z).Magnitude
		if flat <= pd.stats.GrabRadius + BALL_R and bp.Y <= topY and bp.Y >= bottomY then
			return true, flat
		end
		return false, math.huge
	end

	ball.Touched:Connect(function(hit)
		if state.holder or os.clock() < state.noGrabUntil then
			return
		end
		local model = hit:FindFirstAncestorOfClass("Model")
		local player = model and Players:GetPlayerFromCharacter(model)
		if player then
			local pd = pdata[player]
			if pd and pd.inGame and os.clock() >= pd.regrabAt then
				giveBall(player)
			end
		end
	end)

	-- Builds -------------------------------------------------------------------
	local function applyBuild(player: Player, char: Model)
		local pd = pdata[player]
		if not pd then
			return
		end
		local hum = char:FindFirstChildOfClass("Humanoid")
		if not hum then
			return
		end
		local st = pd.stats
		if hum.RigType == Enum.HumanoidRigType.R15 then
			local values = {
				BodyHeightScale = st.Scale,
				BodyWidthScale = st.Width,
				BodyDepthScale = 0.9 + (st.Width - 0.88) * 0.8,
				HeadScale = 1 + (st.Scale - 1) * 0.35,
			}
			for name, value in pairs(values) do
				local nv = hum:FindFirstChild(name) :: NumberValue?
				if not nv then
					nv = Instance.new("NumberValue")
					;(nv :: NumberValue).Name = name
					;(nv :: NumberValue).Parent = hum
				end
				(nv :: NumberValue).Value = value
			end
		else
			-- R6 has no body scale values, so scale the whole model
			pcall(function()
				char:ScaleTo(st.Scale)
			end)
		end
		local color = SKIN_TONES[pd.build.Skin]
		local bc = char:FindFirstChildOfClass("BodyColors")
		if not bc then
			bc = Instance.new("BodyColors")
			bc.Parent = char
		end
		for _, prop in ipairs({ "HeadColor3", "TorsoColor3", "LeftArmColor3", "RightArmColor3", "LeftLegColor3", "RightLegColor3" }) do
			(bc :: any)[prop] = color
		end
		hum.UseJumpPower = true
		hum.JumpPower = st.JumpPower
		hum.WalkSpeed = CONFIG.WalkSpeed * st.SpeedMult
		char:SetAttribute("BB_Scale", st.Scale)
	end

	local function setBuild(player: Player, build)
		local pd = pdata[player]
		pd.build = sanitizeBuild(build)
		pd.stats = deriveStats(pd.build)
		player:SetAttribute("BB_Height", pd.build.Height)
		player:SetAttribute("BB_Weight", pd.build.Weight)
		player:SetAttribute("BB_Skin", pd.build.Skin)
	end

	local function saveBuild(player: Player): (boolean, string)
		local pd = pdata[player]
		if not pd or not buildStore then
			return false, "Saved for this session only (DataStore off)"
		end
		local ok, err = pcall(function()
			(buildStore :: any):SetAsync("u_" .. player.UserId, pd.build)
		end)
		if ok then
			pd.dirty = false
			return true, "Build saved!"
		end
		warn("[CourtKings] Save failed:", err)
		return false, "Save failed, try again soon"
	end

	local function onCharacter(player: Player, char: Model)
		local hum = char:WaitForChild("Humanoid", 10) :: Humanoid?
		local root = char:WaitForChild("HumanoidRootPart", 10) :: BasePart?
		if not hum or not root then
			return
		end
		local function tag(d: Instance)
			if d:IsA("BasePart") then
				d.CollisionGroup = "BB_Players"
			end
		end
		for _, d in ipairs(char:GetDescendants()) do
			tag(d)
		end
		char.DescendantAdded:Connect(tag)
		char:PivotTo(spawnCF * CFrame.new(rng:NextNumber(-6, 6), 0, 0))
		hum.Died:Connect(function()
			if state.holder == player then
				dropBall(root.Position)
			end
			task.delay(Players.RespawnTime, function()
				local pd = pdata[player]
				if pd and pd.inGame and player.Parent then
					player:LoadCharacter()
				end
			end)
		end)
		-- Wait for the avatar to load before applying the build
		if not player:HasAppearanceLoaded() then
			local done = false
			local conn = player.CharacterAppearanceLoaded:Connect(function()
				done = true
			end)
			local t0 = os.clock()
			while not done and os.clock() - t0 < 5 do
				task.wait(0.1)
			end
			conn:Disconnect()
		end
		if char.Parent then
			applyBuild(player, char)
		end
	end

	local function onPlayerAdded(player: Player)
		local pd: PlayerData = {
			build = table.clone(DEFAULT_BUILD),
			stats = deriveStats(DEFAULT_BUILD),
			inGame = false,
			loaded = false,
			guarding = false,
			lastSteal = 0,
			lastMove = 0,
			lastSave = -math.huge,
			regrabAt = 0,
			dirty = false,
		}
		pdata[player] = pd
		local ls = new("Folder", { Name = "leaderstats" })
		new("IntValue", { Name = "Points", Value = 0, Parent = ls })
		ls.Parent = player
		setBuild(player, DEFAULT_BUILD)
		player.CharacterAdded:Connect(function(char)
			onCharacter(player, char)
		end)
		player.CharacterRemoving:Connect(function(char)
			if state.holder == player then
				local root = char:FindFirstChild("HumanoidRootPart") :: BasePart?
				dropBall(root and root.Position or nil)
			end
		end)
		-- Load saved build
		if buildStore then
			for attempt = 1, 3 do
				local ok, data = pcall(function()
					return (buildStore :: any):GetAsync("u_" .. player.UserId)
				end)
				if ok then
					if data then
						setBuild(player, data)
					end
					break
				end
				task.wait(attempt)
			end
		end
		pd.loaded = true
	end

	Players.PlayerAdded:Connect(onPlayerAdded)
	for _, p in ipairs(Players:GetPlayers()) do
		task.spawn(onPlayerAdded, p)
	end
	Players.PlayerRemoving:Connect(function(player)
		if state.holder == player then
			dropBall(nil)
		end
		local pd = pdata[player]
		if pd and pd.dirty then
			saveBuild(player)
		end
		pdata[player] = nil
	end)
	game:BindToClose(function()
		for player, pd in pairs(pdata) do
			if pd.dirty then
				saveBuild(player)
			end
		end
	end)

	GetBuildRemote.OnServerInvoke = function(player)
		local pd = pdata[player]
		local t0 = os.clock()
		while pd and not pd.loaded and os.clock() - t0 < 10 do
			task.wait(0.1)
		end
		return pd and pd.build or DEFAULT_BUILD
	end

	SaveBuildRemote.OnServerInvoke = function(player, build)
		local pd = pdata[player]
		if not pd then
			return false, "Not ready"
		end
		setBuild(player, build)
		pd.dirty = true
		if player.Character then
			applyBuild(player, player.Character)
		end
		if os.clock() - pd.lastSave < CONFIG.SaveCooldown then
			return true, "Build applied (it will save when you leave)"
		end
		pd.lastSave = os.clock()
		return saveBuild(player)
	end

	-- Shooting -----------------------------------------------------------------
	local function shoot(player: Player, power: number)
		if state.holder ~= player then
			return
		end
		local char, hum, root = getRig(player)
		if not char then
			return
		end
		local pd = pdata[player]
		local st = pd.stats
		power = clamp(power, 0, 1)
		local hoop, d = targetHoop(root)
		local ideal = idealPower(d)
		local tol = st.ShootTolerance
		local err = math.abs(power - ideal)

		local chance = powerFactor(err, tol) * distanceFactor(d)
		if d < 12 then
			chance += st.CloseBonus
		end
		if d >= 18 then
			chance += st.RangeBonus
		end
		-- Release timing: near the top of the jump = bonus
		local vy = root.AssemblyLinearVelocity.Y
		local airborne = hum.FloorMaterial == Enum.Material.Air
		local perfectRelease = airborne and math.abs(vy) < 9
		if perfectRelease then
			chance += 0.06
		end
		-- Defenders guarding close to the shooter contest the shot
		local contest = 0
		for other, opd in pairs(pdata) do
			if other ~= player and opd.inGame then
				local _oc, _oh, oroot = getRig(other)
				if oroot then
					local dist = (oroot.Position - root.Position).Magnitude
					if dist < 6 then
						local c = (opd.guarding and 0.16 or 0.07) * (1 - dist / 6)
						c += math.max(0, opd.stats.t - st.t) * 0.08
						contest += c
					end
				end
			end
		end
		chance -= math.min(contest, 0.35)
		chance = clamp(chance, 0.02, 0.97)

		local made = rng:NextNumber() < chance
		local value = isThree(hoop.Sign, root.Position) and 3 or 2
		local startPos = ball.Position

		-- Pick where the ball is aimed
		local rimC = hoop.Center
		local flatDir = Vector3.new(rimC.X - startPos.X, 0, rimC.Z - startPos.Z)
		flatDir = flatDir.Magnitude > 0.01 and flatDir.Unit or Vector3.new(hoop.Sign, 0, 0)
		local target
		if made then
			target = rimC + Vector3.new(rng:NextNumber(-0.25, 0.25), 0.05, rng:NextNumber(-0.25, 0.25))
		elseif err > tol * 1.6 then
			-- Way off: short or long (airball / off the backboard)
			local dir = power > ideal and 1 or -1
			local off = math.min(6, err * d * 0.8 + 1.2)
			target = rimC + flatDir * off * dir + Vector3.new(0, 0.1, 0)
		else
			-- Close: aim at the rim itself so it bounces off
			local a = rng:NextNumber(0, math.pi * 2)
			local r = RIM_R * rng:NextNumber(0.85, 1.15)
			target = rimC + Vector3.new(math.cos(a) * r, 0.15, math.sin(a) * r)
		end

		-- Ballistic launch (with the ball's reduced gravity)
		local g = Workspace.Gravity * CONFIG.BallGravityScale
		local flatDist = Vector3.new(target.X - startPos.X, 0, target.Z - startPos.Z).Magnitude
		local T = math.max(0.45, math.sqrt(2 * flatDist * math.tan(math.rad(CONFIG.ArcAngle)) / g))
		local delta = target - startPos
		local vel = Vector3.new(delta.X / T, (delta.Y + 0.5 * g * T * T) / T, delta.Z / T)

		releaseBall()
		ball.CFrame = CFrame.new(startPos)
		ball.AssemblyLinearVelocity = vel
		ball.AssemblyAngularVelocity = flatDir:Cross(Vector3.yAxis) * CONFIG.BackspinRate
		pd.regrabAt = os.clock() + CONFIG.ShooterRegrabDelay
		state.noGrabUntil = os.clock() + CONFIG.NoGrabAfterShot
		state.shot = { shooter = player, value = value, hoop = hoop, made = made, scored = false, rimTouched = false, t0 = os.clock() }
		if made then
			setRimCollision(hoop, false)
			task.delay(T + 0.8, function()
				setRimCollision(hoop, true)
			end)
		end

		local feedback
		if err <= tol * 0.35 then
			feedback = "PERFECT CHARGE"
		elseif err <= tol then
			feedback = "GOOD CHARGE"
		elseif power < ideal then
			feedback = "TOO WEAK"
		else
			feedback = "TOO STRONG"
		end
		if perfectRelease then
			feedback ..= " + GREAT RELEASE"
		end
		notify(player, "ShotFeedback", feedback, { chance = chance, made = made })
	end

	-- Steals -------------------------------------------------------------------
	local function isExposed(): boolean
		if state.move then
			return true
		end
		local h = math.abs(math.cos(math.pi * state.phase))
		return h < 0.35
	end

	local function attemptSteal(player: Player)
		local pd = pdata[player]
		local now = os.clock()
		if not pd or now - pd.lastSteal < CONFIG.StealCooldown then
			return
		end
		pd.lastSteal = now
		local holder = state.holder
		if not holder or holder == player then
			return
		end
		local char, _hum, root = getRig(player)
		if not char then
			return
		end
		local hpd = pdata[holder]
		local range = CONFIG.StealRange + 1.5 * pd.stats.t
		if (ball.Position - root.Position).Magnitude > range then
			notify(player, "Toast", "Too far to steal!", Color3.fromRGB(255, 200, 80))
			return
		end
		local chance = CONFIG.StealBaseChance + pd.stats.StealSkill
		if isExposed() then
			chance += 0.22
		end
		if pd.guarding then
			chance += 0.08
		end
		if state.charging then
			chance -= 0.1 -- ball is up high in shooting pocket
		end
		chance -= hpd.stats.Strength * 0.18
		chance = clamp(chance, 0.05, 0.75)
		if rng:NextNumber() < chance then
			giveBall(player)
			playSound(ball, "Steal", 0.8)
			notify(player, "Toast", "STOLEN!", Color3.fromRGB(80, 255, 120))
			notify(holder, "Toast", player.DisplayName .. " stole the ball!", Color3.fromRGB(255, 90, 90))
		else
			notify(player, "Stun", "Reach-in! Missed the steal", CONFIG.StealFailStun)
		end
	end

	-- Remote handler -------------------------------------------------------------
	ActionRemote.OnServerEvent:Connect(function(player, action, arg)
		local pd = pdata[player]
		if not pd or type(action) ~= "string" then
			return
		end
		if action == "Play" then
			pd.inGame = true
			if not player.Character then
				player:LoadCharacter()
			end
		elseif not pd.inGame then
			return
		elseif action == "ChargeStart" then
			if state.holder == player then
				state.charging = true
				state.move = nil
			end
		elseif action == "ChargeCancel" then
			if state.holder == player then
				state.charging = false
			end
		elseif action == "Shoot" then
			shoot(player, tonumber(arg) or 0)
		elseif action == "Dribble" then
			if state.holder == player and not state.charging and (arg == "Crossover" or arg == "BetweenLegs" or arg == "BehindBack") then
				local now = os.clock()
				if now - pd.lastMove >= CONFIG.MoveCooldown then
					pd.lastMove = now
					state.move = { style = arg, t0 = now }
				end
			end
		elseif action == "Steal" then
			attemptSteal(player)
		elseif action == "Guard" then
			pd.guarding = arg == true
		end
	end)

	-- Dribble path: where the ball sits relative to the HumanoidRootPart -------------
	local function dribbleOffset(char: Model, hum: Humanoid, root: BasePart, dt: number): CFrame
		local s = char:GetAttribute("BB_Scale") or 1
		local speed = Vector3.new(root.AssemblyLinearVelocity.X, 0, root.AssemblyLinearVelocity.Z).Magnitude
		if state.charging then
			return CFrame.new(0.25 * s, 1.7 * s, -0.7 * s) -- shooting pocket above the forehead
		end
		if hum.FloorMaterial == Enum.Material.Air then
			return CFrame.new(0.6 * s, 0.3 * s, -1.0 * s) -- hold it while in the air
		end
		local floorY = -groundOffset(char, hum, root) + BALL_R
		local apexY = -0.55 * s
		local side = state.side
		local sideX = 1.35 * s
		local now = os.clock()

		local mv = state.move
		if mv then
			local u = (now - mv.t0) / CONFIG.MoveTime
			if u >= 1 then
				state.side = -side
				state.move = nil
				state.phase = 0
				return CFrame.new(-side * sideX, apexY, -1.1 * s)
			end
			local h = math.abs(math.cos(math.pi * u))
			local x, z
			if mv.style == "Crossover" then
				x = side * sideX * (1 - 2 * u)
				z = -1.35 * s
			elseif mv.style == "BetweenLegs" then
				x = side * sideX * math.cos(math.pi * u)
				z = -1.1 * s * math.abs(math.cos(math.pi * u))
			else -- BehindBack
				x = side * sideX * math.cos(math.pi * u)
				z = -1.1 * s + 2.0 * s * math.sin(math.pi * u)
			end
			local prevU = (now - dt - mv.t0) / CONFIG.MoveTime
			if prevU < 0.5 and u >= 0.5 then
				playSound(ball, "Bounce", 0.5, rng:NextNumber(0.95, 1.05))
			end
			return CFrame.new(x, lerp(floorY, apexY, h), z)
		end

		-- Regular pound dribble (phase 0 = in hand, 0.5 = on the floor)
		local cycle = speed > 4 and CONFIG.DribbleCycleMoving or CONFIG.DribbleCycle
		local prevPhase = state.phase
		state.phase = (state.phase + dt / cycle) % 1
		if prevPhase < 0.5 and state.phase >= 0.5 then
			playSound(ball, "Bounce", 0.45, rng:NextNumber(0.95, 1.05))
		end
		local h = math.abs(math.cos(math.pi * state.phase))
		local forward = speed > 4 and -1.4 * s or -1.0 * s
		return CFrame.new(side * sideX, lerp(floorY, apexY, h), forward)
	end

	-- Rim / backboard sounds
	for _, hoop in ipairs(hoops) do
		local lastRim = 0
		for _, rp in ipairs(hoop.RimParts) do
			rp.Touched:Connect(function(hit)
				if hit == ball and os.clock() - lastRim > 0.2 then
					lastRim = os.clock()
					if state.shot then
						state.shot.rimTouched = true
					end
					playSound(ball, "Rim", 0.7)
				end
			end)
		end
		local bb = hoop.Model:FindFirstChild("Backboard")
		if bb then
			(bb :: BasePart).Touched:Connect(function(hit)
				if hit == ball and os.clock() - lastRim > 0.2 then
					lastRim = os.clock()
					playSound(ball, "Backboard", 0.7)
				end
			end)
		end
	end

	local function scoreBasket(hoop)
		local shot = state.shot
		state.shot = nil
		setRimCollision(hoop, true)
		if not shot or shot.scored then
			return
		end
		shot.scored = true
		local shooter: Player = shot.shooter
		if shooter.Parent then
			local ls = shooter:FindFirstChild("leaderstats")
			local pts = ls and ls:FindFirstChild("Points") :: IntValue?
			if pts then
				pts.Value += shot.value
			end
		end
		playSound(ball, "Swish", shot.rimTouched and 0.4 or 0.9)
		local kind = shot.value == 3 and "THREE!" or "BUCKET!"
		local text = string.format("%s  %s  +%d", shooter.DisplayName, kind, shot.value)
		notifyAll("Score", text, shot.value)
		-- Scoreboard: last bucket + top 3
		local list = {}
		for p in pairs(pdata) do
			local ls = p:FindFirstChild("leaderstats")
			local pts = ls and ls:FindFirstChild("Points") :: IntValue?
			table.insert(list, { name = p.DisplayName, pts = pts and pts.Value or 0 })
		end
		table.sort(list, function(a, b)
			return a.pts > b.pts
		end)
		local lines = { "LAST: " .. shooter.DisplayName .. " +" .. shot.value, "" }
		for i = 1, math.min(3, #list) do
			table.insert(lines, string.format("%d. %s  %d", i, list[i].name, list[i].pts))
		end
		setScoreboard(table.concat(lines, "\n"))
	end

	-- Main loop ------------------------------------------------------------------
	RunService.Heartbeat:Connect(function(dt)
		local now = os.clock()
		local holder = state.holder
		if holder then
			local char, hum, root = getRig(holder)
			if not char or not state.weld or state.weld.Part0 ~= root then
				dropBall(root and root.Position or ball.Position)
			else
				state.weld.C0 = dribbleOffset(char, hum, root, dt)
			end
			state.lastPos = ball.Position
			return
		end

		local pos = ball.Position
		local vel = ball.AssemblyLinearVelocity
		-- Scoring: ball center passes down through the rim circle
		local prev = state.lastPos
		for _, hoop in ipairs(hoops) do
			local c = hoop.Center
			if prev.Y > c.Y and pos.Y <= c.Y then
				local a = (prev.Y - c.Y) / math.max(prev.Y - pos.Y, 1e-4)
				local cross = prev:Lerp(pos, a)
				local flat = Vector3.new(cross.X - c.X, 0, cross.Z - c.Z).Magnitude
				if flat < RIM_R - BALL_R * 0.3 then
					scoreBasket(hoop)
				end
			end
		end
		state.lastPos = pos

		-- Free-ball bounce sound
		if state.lastVy < -10 and vel.Y > 1 and pos.Y < GEO.Y + 3 then
			playSound(ball, "Bounce", clamp(-state.lastVy / 60, 0.15, 0.7))
		end
		state.lastVy = vel.Y

		-- Pick up / rebound with reach (taller builds grab higher and wider)
		if now >= state.noGrabUntil then
			local best, bestD = nil, math.huge
			for player in pairs(pdata) do
				local ok, d = canReach(player)
				if ok and d < bestD then
					best, bestD = player, d
				end
			end
			if best then
				giveBall(best)
				return
			end
		end

		-- Shot expiry / stuck or lost ball
		if state.shot and now - state.shot.t0 > 4 then
			setRimCollision(state.shot.hoop, true)
			state.shot = nil
		end
		if vel.Magnitude > 1 then
			state.lastActive = now
		end
		local outside = math.abs(pos.X) > GEO.GymX / 2 + 5 or math.abs(pos.Z) > GEO.GymZ / 2 + 5 or pos.Y < GEO.Y - 20
		if outside or now - state.lastActive > 40 then
			resetBall()
		end
	end)

	setScoreboard(CONFIG.GameName .. "\nFREE PLAY")
	print("[CourtKings] Server ready")
end

--==================================================================================
-- 7. CLIENT
--==================================================================================
function BasketballGame.StartClient()
	assert(RunService:IsClient(), "StartClient must be called from a LocalScript")
	local UserInputService = game:GetService("UserInputService")
	local TweenService = game:GetService("TweenService")

	local player = Players.LocalPlayer
	local playerGui = player:WaitForChild("PlayerGui")
	local camera = Workspace.CurrentCamera
	local remotes = ReplicatedStorage:WaitForChild("BasketballRemotes")
	local ActionRemote = remotes:WaitForChild("Action") :: RemoteEvent
	local NotifyRemote = remotes:WaitForChild("Notify") :: RemoteEvent
	local GetBuildRemote = remotes:WaitForChild("GetBuild") :: RemoteFunction
	local SaveBuildRemote = remotes:WaitForChild("SaveBuild") :: RemoteFunction
	local gym = Workspace:WaitForChild("BasketballGym")
	local ball = gym:WaitForChild("Basketball") :: BasePart
	local hoopCenters: { Vector3 } = {}
	for _, h in ipairs(gym:WaitForChild("Hoops"):GetChildren()) do
		local c = h:WaitForChild("RimCenter", 10) :: BasePart?
		if c then
			table.insert(hoopCenters, c.Position)
		end
	end

	local ORANGE = Color3.fromRGB(255, 132, 32)
	local DARK = Color3.fromRGB(16, 18, 26)
	local isTouch = UserInputService.TouchEnabled

	local function corner(parent: Instance, r: number?)
		new("UICorner", { CornerRadius = UDim.new(0, r or 12), Parent = parent })
	end
	local function stroke(parent: Instance, color: Color3?, thick: number?)
		new("UIStroke", { Color = color or Color3.new(1, 1, 1), Thickness = thick or 2, Transparency = 0.2, ApplyStrokeMode = Enum.ApplyStrokeMode.Border, Parent = parent })
	end
	-- Scales a fixed-size panel to fit phones and big monitors
	local function autoScale(frame: GuiObject, baseW: number, baseH: number)
		local s = new("UIScale", { Parent = frame })
		local function update()
			local v = camera.ViewportSize
			s.Scale = clamp(math.min(v.X / (baseW + 40), v.Y / (baseH + 40)), 0.45, 1.3)
		end
		update()
		camera:GetPropertyChangedSignal("ViewportSize"):Connect(update)
	end
	local function button(parent: Instance, text: string, props: { [string]: any })
		local b = new("TextButton", {
			Text = text,
			Font = Enum.Font.GothamBlack,
			TextScaled = true,
			TextColor3 = Color3.new(1, 1, 1),
			BackgroundColor3 = ORANGE,
			AutoButtonColor = true,
			Parent = parent,
		})
		for k, v in pairs(props) do
			(b :: any)[k] = v
		end
		corner(b)
		new("UIPadding", { PaddingTop = UDim.new(0.18, 0), PaddingBottom = UDim.new(0.18, 0), PaddingLeft = UDim.new(0, 8), PaddingRight = UDim.new(0, 8), Parent = b })
		return b
	end

	--------------------------------------------------------------------------
	-- Build state
	--------------------------------------------------------------------------
	local myBuild = sanitizeBuild(DEFAULT_BUILD)
	local myStats = deriveStats(myBuild)
	local function refreshStatsFromAttributes()
		local b = {
			Height = player:GetAttribute("BB_Height"),
			Weight = player:GetAttribute("BB_Weight"),
			Skin = player:GetAttribute("BB_Skin"),
		}
		myStats = deriveStats(b)
	end
	refreshStatsFromAttributes()
	player.AttributeChanged:Connect(refreshStatsFromAttributes)

	--------------------------------------------------------------------------
	-- MAIN MENU
	--------------------------------------------------------------------------
	local menuGui = new("ScreenGui", { Name = "BB_Menu", IgnoreGuiInset = true, ResetOnSpawn = false, DisplayOrder = 10, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, Parent = playerGui })
	local shade = new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.35, Parent = menuGui })
	new("UIGradient", { Rotation = 90, Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(1, 0) }), Parent = shade })

	local mainPanel = new("Frame", { Size = UDim2.fromOffset(520, 360), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), BackgroundTransparency = 1, Parent = menuGui })
	autoScale(mainPanel, 520, 360)
	new("TextLabel", { Size = UDim2.new(1, 0, 0, 90), BackgroundTransparency = 1, Text = CONFIG.GameName, Font = Enum.Font.GothamBlack, TextScaled = true, TextColor3 = ORANGE, Parent = mainPanel })
	new("TextLabel", { Size = UDim2.new(1, 0, 0, 28), Position = UDim2.fromOffset(0, 92), BackgroundTransparency = 1, Text = "Make your build. Run the court.", Font = Enum.Font.GothamBold, TextScaled = true, TextColor3 = Color3.fromRGB(230, 230, 240), Parent = mainPanel })
	local playBtn = button(mainPanel, "PLAY", { Size = UDim2.fromOffset(300, 72), AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 160) })
	local buildBtn = button(mainPanel, "BUILD", { Size = UDim2.fromOffset(300, 64), AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 248), BackgroundColor3 = Color3.fromRGB(36, 40, 56) })
	stroke(buildBtn, ORANGE, 3)

	--------------------------------------------------------------------------
	-- BUILD MENU
	--------------------------------------------------------------------------
	local buildPanel = new("Frame", { Size = UDim2.fromOffset(780, 460), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), BackgroundColor3 = DARK, BackgroundTransparency = 0.05, Visible = false, Parent = menuGui })
	corner(buildPanel, 18)
	stroke(buildPanel, ORANGE, 2)
	autoScale(buildPanel, 780, 460)
	new("TextLabel", { Size = UDim2.new(1, -40, 0, 44), Position = UDim2.fromOffset(20, 10), BackgroundTransparency = 1, Text = "CREATE YOUR BUILD", Font = Enum.Font.GothamBlack, TextScaled = true, TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = ORANGE, Parent = buildPanel })

	-- 3D preview (simple mannequin that changes with the build)
	local viewport = new("ViewportFrame", { Size = UDim2.fromOffset(250, 380), Position = UDim2.fromOffset(20, 64), BackgroundColor3 = Color3.fromRGB(30, 34, 48), Ambient = Color3.fromRGB(160, 160, 170), LightColor = Color3.new(1, 1, 1), LightDirection = Vector3.new(-1, -1, -1), Parent = buildPanel })
	corner(viewport, 12)
	local vpCam = new("Camera", { FieldOfView = 30, Parent = viewport })
	viewport.CurrentCamera = vpCam
	vpCam.CFrame = CFrame.lookAt(Vector3.new(0, 3.2, 17), Vector3.new(0, 3.2, 0))
	local mannequin: Model? = nil
	local spin = 0
	local function rebuildMannequin(b)
		if mannequin then
			mannequin:Destroy()
		end
		local st = deriveStats(b)
		local s, w = st.Scale, st.Width
		local skin = SKIN_TONES[b.Skin]
		local m = new("Model", { Name = "Mannequin" })
		local function limb(name: string, size: Vector3, pos: Vector3, color: Color3, shape: Enum.PartType?)
			local p = new("Part", { Name = name, Anchored = true, Size = size, CFrame = CFrame.new(pos), Color = color, Material = Enum.Material.SmoothPlastic, Parent = m })
			if shape then
				p.Shape = shape
			end
			return p
		end
		local legH, torsoH = 2 * s, 2 * s
		local jersey = ORANGE
		limb("LeftLeg", Vector3.new(0.95 * w, legH, 1 * w), Vector3.new(-0.5 * w, legH / 2, 0), skin)
		limb("RightLeg", Vector3.new(0.95 * w, legH, 1 * w), Vector3.new(0.5 * w, legH / 2, 0), skin)
		limb("Shorts", Vector3.new(2.05 * w, legH * 0.45, 1.08 * w), Vector3.new(0, legH * 0.78, 0), Color3.fromRGB(28, 54, 112))
		limb("Torso", Vector3.new(2 * w, torsoH, 1 * w), Vector3.new(0, legH + torsoH / 2, 0), jersey)
		limb("LeftArm", Vector3.new(0.9 * w, torsoH, 0.95 * w), Vector3.new(-1.5 * w, legH + torsoH / 2, 0), skin)
		limb("RightArm", Vector3.new(0.9 * w, torsoH, 0.95 * w), Vector3.new(1.5 * w, legH + torsoH / 2, 0), skin)
		limb("Head", Vector3.new(1.15, 1.15, 1.15) * (1 + (s - 1) * 0.35), Vector3.new(0, legH + torsoH + 0.6, 0), skin, Enum.PartType.Ball)
		m.WorldPivot = CFrame.new() -- pivot at the feet so it spins in place
		m:PivotTo(CFrame.Angles(0, spin, 0))
		m.Parent = viewport
		mannequin = m
	end
	RunService.RenderStepped:Connect(function(dt)
		if mannequin and buildPanel.Visible then
			spin += dt * 0.8
			mannequin:PivotTo(CFrame.Angles(0, spin, 0))
		end
	end)

	-- Right side controls
	local right = new("Frame", { Size = UDim2.fromOffset(470, 380), Position = UDim2.fromOffset(290, 64), BackgroundTransparency = 1, Parent = buildPanel })
	local function label(parent: Instance, text: string, y: number, h: number?, color: Color3?)
		return new("TextLabel", { Size = UDim2.new(1, 0, 0, h or 24), Position = UDim2.fromOffset(0, y), BackgroundTransparency = 1, Text = text, Font = Enum.Font.GothamBold, TextScaled = true, TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = color or Color3.new(1, 1, 1), Parent = parent })
	end

	-- Slider that works with mouse and touch
	local function slider(parent: Instance, y: number, min: number, max: number, onChange: (number) -> ())
		local bar = new("Frame", { Size = UDim2.new(1, -20, 0, 10), Position = UDim2.fromOffset(10, y), BackgroundColor3 = Color3.fromRGB(60, 64, 80), Parent = parent })
		corner(bar, 5)
		local fill = new("Frame", { Size = UDim2.fromScale(0.5, 1), BackgroundColor3 = ORANGE, Parent = bar })
		corner(fill, 5)
		local knob = new("Frame", { Size = UDim2.fromOffset(26, 26), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), BackgroundColor3 = Color3.new(1, 1, 1), Parent = bar })
		corner(knob, 13)
		local hit = new("TextButton", { Text = "", BackgroundTransparency = 1, Size = UDim2.new(1, 30, 0, 44), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Parent = bar })
		local value = min
		local dragging: InputObject? = nil
		local function show()
			local rel = (value - min) / (max - min)
			fill.Size = UDim2.fromScale(rel, 1)
			knob.Position = UDim2.fromScale(rel, 0.5)
		end
		local function fromX(x: number)
			local rel = clamp((x - bar.AbsolutePosition.X) / math.max(bar.AbsoluteSize.X, 1), 0, 1)
			local v = math.floor(min + rel * (max - min) + 0.5)
			if v ~= value then
				value = v
				show()
				onChange(v)
			end
		end
		hit.InputBegan:Connect(function(input)
			if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
				dragging = input
				fromX(input.Position.X)
			end
		end)
		UserInputService.InputChanged:Connect(function(input)
			if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement or input == dragging) then
				fromX(input.Position.X)
			end
		end)
		UserInputService.InputEnded:Connect(function(input)
			if input == dragging or (dragging and input.UserInputType == Enum.UserInputType.MouseButton1) then
				dragging = nil
			end
		end)
		return {
			Set = function(v: number)
				value = v
				show()
			end,
		}
	end

	local editBuild = table.clone(myBuild)
	local heightLabel = label(right, "", 0)
	local weightLabel = label(right, "", 64)
	local statBars = {}
	local refreshBuildUI

	local heightSlider = slider(right, 36, BUILD_LIMITS.HeightMin, BUILD_LIMITS.HeightMax, function(v)
		editBuild.Height = v
		refreshBuildUI()
	end)
	local weightSlider = slider(right, 100, BUILD_LIMITS.WeightMin, BUILD_LIMITS.WeightMax, function(v)
		editBuild.Weight = v
		refreshBuildUI()
	end)
	label(right, "SKIN TONE", 126)
	local swatches = {}
	for i, c in ipairs(SKIN_TONES) do
		local sw = new("TextButton", { Text = "", Size = UDim2.fromOffset(46, 46), Position = UDim2.fromOffset((i - 1) * 56, 154), BackgroundColor3 = c, Parent = right })
		corner(sw, 23)
		local st = new("UIStroke", { Thickness = 0, Color = ORANGE, Parent = sw })
		swatches[i] = st
		sw.Activated:Connect(function()
			editBuild.Skin = i
			refreshBuildUI()
		end)
	end
	local statNames = { "Speed", "Strength", "Reach", "Shooting", "Defense" }
	for i, name in ipairs(statNames) do
		local y = 212 + (i - 1) * 21
		new("TextLabel", { Size = UDim2.fromOffset(110, 20), Position = UDim2.fromOffset(0, y), BackgroundTransparency = 1, Text = string.upper(name), Font = Enum.Font.GothamBold, TextScaled = true, TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = Color3.fromRGB(200, 200, 210), Parent = right })
		local back = new("Frame", { Size = UDim2.fromOffset(280, 12), Position = UDim2.fromOffset(115, y + 4), BackgroundColor3 = Color3.fromRGB(50, 54, 70), Parent = right })
		corner(back, 6)
		local fill = new("Frame", { Size = UDim2.fromScale(0.5, 1), BackgroundColor3 = Color3.fromRGB(90, 220, 120), Parent = back })
		corner(fill, 6)
		local num = new("TextLabel", { Size = UDim2.fromOffset(50, 20), Position = UDim2.fromOffset(405, y), BackgroundTransparency = 1, Text = "50", Font = Enum.Font.GothamBlack, TextScaled = true, TextColor3 = Color3.new(1, 1, 1), Parent = right })
		statBars[name] = { fill = fill, num = num }
	end
	local saveBtn = button(right, "SAVE BUILD", { Size = UDim2.fromOffset(220, 40), Position = UDim2.fromOffset(0, 342) })
	local backBtn = button(right, "BACK", { Size = UDim2.fromOffset(140, 40), Position = UDim2.fromOffset(234, 342), BackgroundColor3 = Color3.fromRGB(60, 64, 80) })
	local statusLabel = label(right, "", 318, 20)
	statusLabel.TextColor3 = Color3.fromRGB(120, 255, 150)

	refreshBuildUI = function()
		editBuild = sanitizeBuild(editBuild)
		heightLabel.Text = "HEIGHT   " .. formatHeight(editBuild.Height)
		weightLabel.Text = "WEIGHT   " .. editBuild.Weight .. " lbs"
		for i, st in ipairs(swatches) do
			st.Thickness = (i == editBuild.Skin) and 4 or 0
		end
		local stats = deriveStats(editBuild)
		for name, ui in pairs(statBars) do
			local r = stats.Ratings[name]
			ui.fill.Size = UDim2.fromScale(r / 99, 1)
			ui.num.Text = tostring(r)
		end
		rebuildMannequin(editBuild)
	end

	local function openBuild()
		mainPanel.Visible = false
		buildPanel.Visible = true
		statusLabel.Text = "Loading..."
		local ok, b = pcall(function()
			return GetBuildRemote:InvokeServer()
		end)
		editBuild = sanitizeBuild(ok and b or myBuild)
		heightSlider.Set(editBuild.Height)
		weightSlider.Set(editBuild.Weight)
		statusLabel.Text = ""
		refreshBuildUI()
	end
	buildBtn.Activated:Connect(openBuild)
	backBtn.Activated:Connect(function()
		buildPanel.Visible = false
		mainPanel.Visible = true
	end)
	local saving = false
	saveBtn.Activated:Connect(function()
		if saving then
			return
		end
		saving = true
		statusLabel.Text = "Saving..."
		local ok, success, msg = pcall(function()
			return SaveBuildRemote:InvokeServer(editBuild)
		end)
		if ok then
			myBuild = table.clone(editBuild)
			statusLabel.Text = msg or (success and "Saved!" or "Not saved")
			statusLabel.TextColor3 = success and Color3.fromRGB(120, 255, 150) or Color3.fromRGB(255, 200, 90)
		else
			statusLabel.Text = "Couldn't reach server"
			statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
		end
		saving = false
	end)

	--------------------------------------------------------------------------
	-- HUD
	--------------------------------------------------------------------------
	local hud = new("ScreenGui", { Name = "BB_HUD", ResetOnSpawn = false, Enabled = false, DisplayOrder = 5, Parent = playerGui })
	local possession = new("TextLabel", { Size = UDim2.fromOffset(300, 34), AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 8), BackgroundColor3 = DARK, BackgroundTransparency = 0.25, Text = "", Font = Enum.Font.GothamBlack, TextScaled = true, TextColor3 = ORANGE, Visible = false, Parent = hud })
	corner(possession)
	local toast = new("TextLabel", { Size = UDim2.fromOffset(520, 50), AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0.16, 0), BackgroundTransparency = 1, Text = "", Font = Enum.Font.GothamBlack, TextScaled = true, TextColor3 = Color3.new(1, 1, 1), TextStrokeTransparency = 0.3, TextTransparency = 1, TextStrokeColor3 = Color3.new(0, 0, 0), Parent = hud })
	local feedbackLbl = new("TextLabel", { Size = UDim2.fromOffset(380, 30), AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0.16, 52), BackgroundTransparency = 1, Text = "", Font = Enum.Font.GothamBold, TextScaled = true, TextColor3 = Color3.fromRGB(255, 230, 140), TextStrokeTransparency = 0.4, TextTransparency = 1, Parent = hud })

	-- Shot meter: vertical bar with a green "sweet spot" for your distance
	local meter = new("Frame", { Size = UDim2.fromOffset(30, 230), AnchorPoint = Vector2.new(0, 0.5), Position = UDim2.new(0.5, 110, 0.5, 0), BackgroundColor3 = Color3.fromRGB(20, 22, 30), BackgroundTransparency = 0.15, Visible = false, Parent = hud })
	corner(meter, 8)
	stroke(meter, Color3.new(1, 1, 1), 2)
	local sweet = new("Frame", { Size = UDim2.fromScale(1, 0.2), AnchorPoint = Vector2.new(0, 1), BackgroundColor3 = Color3.fromRGB(60, 230, 110), BackgroundTransparency = 0.25, BorderSizePixel = 0, Parent = meter })
	local meterFill = new("Frame", { Size = UDim2.new(0.42, 0, 0, 0), AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.fromScale(0.5, 1), BackgroundColor3 = ORANGE, BorderSizePixel = 0, Parent = meter })
	corner(meterFill, 4)
	new("TextLabel", { Size = UDim2.fromOffset(90, 18), AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 0, -6), BackgroundTransparency = 1, Text = "POWER", Font = Enum.Font.GothamBlack, TextScaled = true, TextColor3 = Color3.new(1, 1, 1), Parent = meter })
	local distLbl = new("TextLabel", { Size = UDim2.fromOffset(110, 18), AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 1, 6), BackgroundTransparency = 1, Text = "", Font = Enum.Font.GothamBold, TextScaled = true, TextColor3 = Color3.fromRGB(220, 220, 230), Parent = meter })

	-- Stamina bar
	local stamBack = new("Frame", { Size = UDim2.fromOffset(220, 10), AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -14), BackgroundColor3 = Color3.fromRGB(30, 30, 40), BackgroundTransparency = 0.2, Parent = hud })
	corner(stamBack, 5)
	local stamFill = new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(80, 200, 255), Parent = stamBack })
	corner(stamFill, 5)

	local menuBtn = button(hud, "MENU", { Size = UDim2.fromOffset(90, 36), Position = UDim2.fromOffset(12, 12), BackgroundColor3 = Color3.fromRGB(36, 40, 56) })
	if not isTouch then
		new("TextLabel", {
			Size = UDim2.fromOffset(560, 20),
			AnchorPoint = Vector2.new(0, 1),
			Position = UDim2.new(0, 12, 1, -10),
			BackgroundTransparency = 1,
			Text = "Shift Sprint | Hold LMB/F Shoot | LMB/F Steal | Hold G Guard | Q Cross  E Legs  R Back",
			Font = Enum.Font.GothamBold,
			TextScaled = true,
			TextXAlignment = Enum.TextXAlignment.Left,
			TextColor3 = Color3.fromRGB(230, 230, 240),
			TextStrokeTransparency = 0.5,
			Parent = hud,
		})
	end

	local function showToast(text: string, color: Color3?, holdTime: number?)
		toast.Text = text
		toast.TextColor3 = color or Color3.new(1, 1, 1)
		toast.TextTransparency = 0
		toast.TextStrokeTransparency = 0.3
		local myText = text
		task.delay(holdTime or 1.6, function()
			if toast.Text == myText then
				TweenService:Create(toast, TweenInfo.new(0.4), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
			end
		end)
	end
	local function showFeedback(text: string)
		feedbackLbl.Text = text
		feedbackLbl.TextTransparency = 0
		task.delay(1.4, function()
			if feedbackLbl.Text == text then
				TweenService:Create(feedbackLbl, TweenInfo.new(0.4), { TextTransparency = 1 }):Play()
			end
		end)
	end

	--------------------------------------------------------------------------
	-- Animations (R15 + R6)
	--------------------------------------------------------------------------
	local tracks: { [string]: AnimationTrack } = {}
	local warned: { [string]: boolean } = {}
	local function loadAnimations(char: Model)
		tracks = {}
		local hum = char:WaitForChild("Humanoid") :: Humanoid
		local animator = hum:FindFirstChildOfClass("Animator") or new("Animator", { Parent = hum })
		local rig = hum.RigType == Enum.HumanoidRigType.R15 and "R15" or "R6"
		for name, ids in pairs(ANIMATIONS) do
			local id = ids[rig]
			if validAssetId(id) then
				local anim = new("Animation", { AnimationId = id })
				local ok, track = pcall(function()
					return animator:LoadAnimation(anim)
				end)
				if ok and track then
					local cfg = ANIM_SETTINGS[name]
					track.Priority = cfg.Priority
					track.Looped = cfg.Looped
					tracks[name] = track
				end
			elseif not warned[name .. rig] then
				warned[name .. rig] = true
				warn(string.format("[CourtKings] No %s animation for %s yet (set ANIMATIONS.%s.%s)", name, rig, name, rig))
			end
		end
		for name, fallback in pairs(ANIM_FALLBACKS) do
			if not tracks[name] and tracks[fallback] then
				tracks[name] = tracks[fallback]
			end
		end
	end
	local function play(name: string, fade: number?, speed: number?)
		local t = tracks[name]
		if t and not t.IsPlaying then
			t:Play(fade or 0.12)
		end
		if t and speed then
			t:AdjustSpeed(speed)
		end
	end
	local function stop(name: string, fade: number?)
		local t = tracks[name]
		if t and t.IsPlaying then
			t:Stop(fade or 0.15)
		end
	end

	--------------------------------------------------------------------------
	-- Gameplay state
	--------------------------------------------------------------------------
	local inGame = false
	local sprintHeld = false
	local sprintToggle = false -- mobile
	local guarding = false
	local charging = false
	local chargeStart = 0
	local charge = 0
	local stamina = CONFIG.StaminaMax
	local exhausted = false
	local stunnedUntil = 0
	local lastSteal = 0
	local lastMove = 0

	local function hasBall(): boolean
		return ball:GetAttribute("HolderId") == player.UserId
	end
	local function getHum(): (Humanoid?, BasePart?)
		local char = player.Character
		if not char then
			return nil, nil
		end
		return char:FindFirstChildOfClass("Humanoid"), char:FindFirstChild("HumanoidRootPart") :: BasePart?
	end
	local function targetHoopDist(root: BasePart): number
		local _, d = pickHoopIndex(hoopCenters, root.Position, root.CFrame.LookVector)
		return d
	end

	local function setGuard(on: boolean)
		if on and hasBall() then
			on = false
		end
		if guarding == on then
			return
		end
		guarding = on
		ActionRemote:FireServer("Guard", on)
		if on then
			play("Defense")
		else
			stop("Defense")
		end
	end

	local function startCharge()
		if charging or not hasBall() then
			return
		end
		local hum = getHum()
		if not hum then
			return
		end
		charging = true
		chargeStart = os.clock()
		charge = 0
		meter.Visible = true
		ActionRemote:FireServer("ChargeStart")
		if hum.FloorMaterial ~= Enum.Material.Air then
			hum:ChangeState(Enum.HumanoidStateType.Jumping)
		end
		play("Shoot", 0.05)
	end

	local function releaseShot()
		if not charging then
			return
		end
		charging = false
		meter.Visible = false
		ActionRemote:FireServer("Shoot", charge)
	end

	local function cancelCharge()
		if charging then
			charging = false
			meter.Visible = false
			ActionRemote:FireServer("ChargeCancel")
		end
	end

	local function trySteal()
		if hasBall() or os.clock() - lastSteal < CONFIG.StealCooldown then
			return
		end
		lastSteal = os.clock()
		play("Steal", 0.05)
		ActionRemote:FireServer("Steal")
	end

	local function dribbleMove(style: string)
		if not hasBall() or charging or os.clock() - lastMove < CONFIG.MoveCooldown then
			return
		end
		lastMove = os.clock()
		play(style, 0.05)
		ActionRemote:FireServer("Dribble", style)
	end

	local function primaryDown()
		if not inGame then
			return
		end
		if hasBall() then
			startCharge()
		else
			trySteal()
		end
	end
	local function primaryUp()
		releaseShot()
	end

	--------------------------------------------------------------------------
	-- Mobile buttons
	--------------------------------------------------------------------------
	local mobile = new("Frame", { Name = "MobileControls", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Visible = isTouch, Parent = hud })
	local function holdButton(text: string, size: number, pos: UDim2, color: Color3, onDown: () -> (), onUp: (() -> ())?)
		local b = new("TextButton", {
			Text = text,
			Size = UDim2.fromOffset(size, size),
			AnchorPoint = Vector2.new(1, 1),
			Position = pos,
			BackgroundColor3 = color,
			BackgroundTransparency = 0.15,
			Font = Enum.Font.GothamBlack,
			TextScaled = true,
			TextColor3 = Color3.new(1, 1, 1),
			AutoButtonColor = false,
			Parent = mobile,
		})
		corner(b, size / 2)
		stroke(b, Color3.new(1, 1, 1), 2)
		new("UIPadding", { PaddingTop = UDim.new(0.3, 0), PaddingBottom = UDim.new(0.3, 0), PaddingLeft = UDim.new(0.12, 0), PaddingRight = UDim.new(0.12, 0), Parent = b })
		local active: InputObject? = nil
		b.InputBegan:Connect(function(input)
			if active == nil and (input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1) then
				active = input
				b.BackgroundTransparency = 0.45
				onDown()
			end
		end)
		UserInputService.InputEnded:Connect(function(input)
			if input == active then
				active = nil
				b.BackgroundTransparency = 0.15
				if onUp then
					onUp()
				end
			end
		end)
		return b
	end
	local primaryBtn = holdButton("SHOOT", 104, UDim2.new(1, -180, 1, -24), ORANGE, primaryDown, primaryUp)
	local sprintBtn = holdButton("SPRINT", 78, UDim2.new(1, -296, 1, -24), Color3.fromRGB(40, 120, 220), function()
		sprintToggle = not sprintToggle
	end)
	local guardBtn = holdButton("GUARD", 70, UDim2.new(1, -180, 1, -140), Color3.fromRGB(60, 160, 90), function()
		setGuard(true)
	end, function()
		setGuard(false)
	end)
	local crossBtn = holdButton("CROSS", 64, UDim2.new(1, -180, 1, -140), Color3.fromRGB(150, 60, 200), function()
		dribbleMove("Crossover")
	end)
	local legsBtn = holdButton("LEGS", 64, UDim2.new(1, -252, 1, -140), Color3.fromRGB(150, 60, 200), function()
		dribbleMove("BetweenLegs")
	end)
	local backBtnM = holdButton("BACK", 64, UDim2.new(1, -324, 1, -140), Color3.fromRGB(150, 60, 200), function()
		dribbleMove("BehindBack")
	end)

	--------------------------------------------------------------------------
	-- Keyboard / mouse / gamepad
	--------------------------------------------------------------------------
	UserInputService.InputBegan:Connect(function(input, gameProcessed)
		if gameProcessed or not inGame then
			return
		end
		local k = input.KeyCode
		local t = input.UserInputType
		if k == Enum.KeyCode.LeftShift or k == Enum.KeyCode.RightShift or k == Enum.KeyCode.ButtonL3 then
			sprintHeld = true
		elseif t == Enum.UserInputType.MouseButton1 or k == Enum.KeyCode.F or k == Enum.KeyCode.ButtonR2 then
			primaryDown()
		elseif k == Enum.KeyCode.G or k == Enum.KeyCode.ButtonL2 then
			setGuard(true)
		elseif k == Enum.KeyCode.Q or k == Enum.KeyCode.ButtonX then
			dribbleMove("Crossover")
		elseif k == Enum.KeyCode.E or k == Enum.KeyCode.ButtonY then
			dribbleMove("BetweenLegs")
		elseif k == Enum.KeyCode.R or k == Enum.KeyCode.ButtonB then
			dribbleMove("BehindBack")
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		local k = input.KeyCode
		local t = input.UserInputType
		if k == Enum.KeyCode.LeftShift or k == Enum.KeyCode.RightShift or k == Enum.KeyCode.ButtonL3 then
			sprintHeld = false
		elseif t == Enum.UserInputType.MouseButton1 or k == Enum.KeyCode.F or k == Enum.KeyCode.ButtonR2 then
			primaryUp()
		elseif k == Enum.KeyCode.G or k == Enum.KeyCode.ButtonL2 then
			setGuard(false)
		end
	end)

	--------------------------------------------------------------------------
	-- Server messages
	--------------------------------------------------------------------------
	NotifyRemote.OnClientEvent:Connect(function(kind, text, extra)
		if kind == "Toast" then
			showToast(text, extra)
		elseif kind == "Score" then
			showToast(text, extra == 3 and Color3.fromRGB(255, 200, 60) or Color3.fromRGB(120, 255, 150), 2.2)
		elseif kind == "ShotFeedback" then
			local pct = extra and extra.chance and math.floor(extra.chance * 100 + 0.5) or 0
			showFeedback(string.format("%s  (%d%%)", text, pct))
		elseif kind == "Stun" then
			stunnedUntil = os.clock() + (tonumber(extra) or 0.8)
			showToast(text, Color3.fromRGB(255, 120, 90), 1)
		end
	end)

	--------------------------------------------------------------------------
	-- Menu flow + camera
	--------------------------------------------------------------------------
	local menuOpen = true
	local function setMenuCamera()
		camera.CameraType = Enum.CameraType.Scriptable
		camera.CFrame = CFrame.lookAt(Vector3.new(-GEO.L * 0.66, GEO.Y + 24, GEO.W * 0.62), Vector3.new(GEO.L * 0.08, GEO.Y + 2, 0))
	end
	local function setGameCamera()
		local hum = getHum()
		camera.CameraType = Enum.CameraType.Custom
		if hum then
			camera.CameraSubject = hum
		end
	end
	local function openMenu()
		menuOpen = true
		menuGui.Enabled = true
		mainPanel.Visible = true
		buildPanel.Visible = false
		hud.Enabled = false
		cancelCharge()
		setGuard(false)
		if not player.Character then
			setMenuCamera()
		end
	end
	local function closeMenu()
		menuOpen = false
		menuGui.Enabled = false
		hud.Enabled = true
	end
	playBtn.Activated:Connect(function()
		inGame = true
		closeMenu()
		ActionRemote:FireServer("Play")
		if player.Character then
			setGameCamera()
		end
	end)
	menuBtn.Activated:Connect(openMenu)

	local function onCharacter(char: Model)
		stamina = CONFIG.StaminaMax
		charging = false
		guarding = false
		meter.Visible = false
		task.spawn(loadAnimations, char)
		task.defer(function()
			if not menuOpen then
				setGameCamera()
			end
		end)
	end
	if player.Character then
		onCharacter(player.Character)
	end
	player.CharacterAdded:Connect(onCharacter)
	setMenuCamera()
	-- Keep the menu camera in place until we have a character (Roblox can reset it)
	task.spawn(function()
		while not player.Character do
			if menuOpen then
				setMenuCamera()
			end
			task.wait(0.5)
		end
	end)

	--------------------------------------------------------------------------
	-- Per-frame: speed, stamina, meter, animations, button labels
	--------------------------------------------------------------------------
	RunService.RenderStepped:Connect(function(dt)
		local hum, root = getHum()
		local holding = hasBall()
		possession.Visible = holding and inGame
		possession.Text = holding and "YOU HAVE THE BALL" or ""

		-- Mobile buttons change with possession
		if isTouch then
			primaryBtn.Text = holding and "SHOOT" or "STEAL"
			guardBtn.Visible = not holding
			crossBtn.Visible = holding
			legsBtn.Visible = holding
			backBtnM.Visible = holding
			sprintBtn.BackgroundColor3 = sprintToggle and Color3.fromRGB(255, 190, 40) or Color3.fromRGB(40, 120, 220)
		end
		if not holding and charging then
			cancelCharge()
		end
		if holding and guarding then
			setGuard(false)
		end
		if not hum or not root or hum.Health <= 0 then
			return
		end

		local moving = hum.MoveDirection.Magnitude > 0.1
		local wantSprint = (sprintHeld or sprintToggle) and moving and not guarding and not charging and not exhausted
		if wantSprint then
			stamina -= CONFIG.StaminaDrain * myStats.StaminaDrain * dt
			if stamina <= 0 then
				stamina = 0
				exhausted = true
			end
		else
			stamina = math.min(CONFIG.StaminaMax, stamina + CONFIG.StaminaRegen * dt)
			if exhausted and stamina >= CONFIG.StaminaMax * 0.3 then
				exhausted = false
			end
		end
		stamFill.Size = UDim2.fromScale(stamina / CONFIG.StaminaMax, 1)
		stamFill.BackgroundColor3 = exhausted and Color3.fromRGB(255, 90, 90) or Color3.fromRGB(80, 200, 255)

		local speed = CONFIG.WalkSpeed * myStats.SpeedMult
		if wantSprint then
			speed *= CONFIG.SprintMultiplier
		end
		if guarding then
			speed *= CONFIG.GuardMultiplier
		end
		if holding then
			speed *= CONFIG.BallCarryMultiplier
		end
		if charging then
			speed *= CONFIG.ChargingMultiplier
		end
		if os.clock() < stunnedUntil then
			speed *= 0.45
		end
		hum.WalkSpeed = speed

		-- Sprint animations (with / without ball)
		local wantTrack = wantSprint and (holding and "SprintWithBall" or "Sprint") or nil
		for _, n in ipairs({ "Sprint", "SprintWithBall" }) do
			if n ~= wantTrack and tracks[n] and (wantTrack == nil or tracks[n] ~= tracks[wantTrack]) then
				stop(n, 0.25)
			end
		end
		if wantTrack then
			play(wantTrack, 0.2)
		end
		if holding and not charging then
			play("Dribble", 0.2)
		else
			stop("Dribble", 0.2)
		end

		-- Shot meter
		if charging then
			charge = clamp((os.clock() - chargeStart) / CONFIG.ChargeTime, 0, 1)
			local d = targetHoopDist(root)
			local ideal = idealPower(d)
			local tol = myStats.ShootTolerance
			local lo, hi = clamp(ideal - tol, 0, 1), clamp(ideal + tol, 0, 1)
			sweet.Position = UDim2.fromScale(0, 1 - lo)
			sweet.Size = UDim2.fromScale(1, hi - lo)
			meterFill.Size = UDim2.new(0.42, 0, charge, 0)
			local inZone = charge >= lo and charge <= hi
			meterFill.BackgroundColor3 = inZone and Color3.fromRGB(80, 255, 130) or ORANGE
			distLbl.Text = string.format("%d ft", math.floor(d / CONFIG.FT + 0.5))
		end
	end)

	print("[CourtKings] Client ready")
end

return BasketballGame
