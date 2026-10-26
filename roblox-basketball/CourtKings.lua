--[[
================================================================================
  COURT KINGS  -  realistic 1v1 basketball for Roblox, in ONE LocalScript
================================================================================
  INSTALL (one step)
    StarterPlayer > StarterPlayerScripts > (+) LocalScript > paste this whole
    file > press Play.

  FOR THE BEST LOOK (optional, 1 click)
    Explorer > Lighting > Properties > Technology = Future.
    (Roblox doesn't let scripts change that setting. Everything else for
    max graphics is set by this script.)

  WHAT'S INSIDE
    * NBA-size arena with real dimensions (0.9 studs = 1 foot): hardwood court,
      glass backboards, breakaway rims, nets, shot clocks, jumbotron, stands,
      crowd, benches, banners, arena lighting with real shadows
    * Real-scale physics: real gravity, real ball and rim sizes, rim/backboard
      bounces, backspin
    * 1v1 vs CPU to 21 (shot clock, check ball, take-it-back, out of bounds)
      or SHOOTAROUND practice with an automatic rebounder
    * Shot meter, jump shots, layups, dunks, blocks, steals, guarding,
      crossover / between the legs / behind the back
    * Player builds (height 5'5"-7'3", weight 145-220 lb, skin tone) that
      change your real avatar AND your ratings
    * Animations for R15 AND R6 built in (procedural, no uploads needed).
      Put your own uploaded animation IDs in ANIMATIONS to replace them.

  CONTROLS
    PC       WASD move | Shift sprint | hold Left Mouse or F, release = shoot
             Left Mouse / F without the ball = steal | hold G = guard
             Q crossover | E between the legs | R behind the back
             Space jump | C camera
    Mobile   on-screen buttons
    Gamepad  R2 shoot/steal | L2 guard | L3 sprint | X / Y / B moves | D-pad up camera

  SAVING
    LocalScripts can't use DataStores (Roblox only allows that on the server),
    so builds last for the session. Want them saved forever? Copy the OPTIONAL
    SERVER SAVE SCRIPT from the very bottom of this file into a Script in
    ServerScriptService. This LocalScript finds it automatically.
================================================================================
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")
local StarterGui = game:GetService("StarterGui")

local player = Players.LocalPlayer
if not RunService:IsClient() or not player then
	warn("[Court Kings] Put this code in a LocalScript inside StarterPlayer > StarterPlayerScripts.")
	return
end

--==============================================================================
-- 1. SETTINGS
--==============================================================================
local CONFIG = {
	GameName = "COURT KINGS",
	ArenaName = "KINGS ARENA",
	Origin = Vector3.new(0, 300, 0), -- the arena is built up here, away from your map
	FT = 0.9, -- studs per real foot (a default avatar is about 5'9")

	WinScore = 21,
	ShotClock = 24,
	OffensiveReboundClock = 14,
	DefaultMode = "1v1", -- "1v1" or "Shootaround"
	DefaultDifficulty = "Pro", -- "Rookie", "Pro" or "All-Star"

	RealGravity = true, -- real-life gravity for this scale (28.95 studs/s^2)
	HideOtherPlayers = true, -- other people in the server run their own game
	CrowdDensity = 0.55, -- 0 = empty arena, 1 = sold out
	ShadowLights = 6, -- arena lights that cast real shadows (more = slower)

	MaxShotRange = 42, -- studs; full power reaches about 47 ft
	ChargeTime = 1.15, -- seconds from 0% to 100% power
	MoveCooldown = 0.55,
	StealCooldown = 1.1,
	StaminaMax = 100,
	StaminaDrain = 15, -- per second of sprinting (heavier builds drain faster)
	StaminaRegen = 11,
	ShootingSlowdown = 0.35,
	GuardSlowdown = 0.82,
	BallSlowdown = 0.94,
	SaveRemoteName = "CourtKingsSave",
}

-- Your own uploaded animations (Animation Editor > publish > paste the ID).
-- Leave "" to use the built-in procedural animation (works on R15 and R6).
local ANIMATIONS = {
	Shoot = { R15 = "", R6 = "" }, -- jump shot
	Layup = { R15 = "", R6 = "" },
	Dunk = { R15 = "", R6 = "" },
	Crossover = { R15 = "", R6 = "" },
	BetweenLegs = { R15 = "", R6 = "" },
	BehindBack = { R15 = "", R6 = "" },
	Dribble = { R15 = "", R6 = "" }, -- looped
	Sprint = { R15 = "", R6 = "" }, -- looped
	SprintWithBall = { R15 = "", R6 = "" }, -- looped
	Defense = { R15 = "", R6 = "" }, -- looped
	Steal = { R15 = "", R6 = "" },
	Celebrate = { R15 = "", R6 = "" },
}

-- Sounds ("" = silent). Swap in IDs from the Creator Store.
local SOUNDS = {
	Bounce = "rbxasset://sounds/action_jump_land.mp3", -- built into Roblox
	Swish = "",
	Rim = "",
	Backboard = "",
	Buzzer = "",
	Whistle = "",
	Crowd = "", -- looped crowd noise
	Cheer = "",
	Squeak = "",
}

local SKIN_TONES = {
	Color3.fromRGB(255, 226, 200),
	Color3.fromRGB(246, 205, 170),
	Color3.fromRGB(234, 184, 146),
	Color3.fromRGB(214, 160, 118),
	Color3.fromRGB(190, 134, 92),
	Color3.fromRGB(160, 108, 72),
	Color3.fromRGB(132, 86, 56),
	Color3.fromRGB(104, 66, 44),
	Color3.fromRGB(80, 50, 34),
	Color3.fromRGB(58, 38, 28),
}

local TEAM = {
	Royal = Color3.fromRGB(28, 58, 140),
	Navy = Color3.fromRGB(14, 24, 52),
	Gold = Color3.fromRGB(244, 180, 40),
	Crimson = Color3.fromRGB(176, 30, 44),
	White = Color3.fromRGB(244, 244, 238),
	Night = Color3.fromRGB(10, 12, 20),
	Wood = Color3.fromRGB(222, 178, 122),
	Rim = Color3.fromRGB(226, 82, 22),
	Ball = Color3.fromRGB(190, 92, 38),
}

local DIFFICULTY = {
	Rookie = { reaction = 0.42, aimSd = 0.14, shotIQ = 0.8, stealRate = 0.2, moveRate = 0.25, speed = 0.9, contest = 0.75 },
	Pro = { reaction = 0.28, aimSd = 0.095, shotIQ = 0.92, stealRate = 0.35, moveRate = 0.4, speed = 0.96, contest = 0.9 },
	["All-Star"] = { reaction = 0.17, aimSd = 0.065, shotIQ = 1.02, stealRate = 0.5, moveRate = 0.55, speed = 1.0, contest = 1.0 },
}
local DIFFICULTY_ORDER = { "Rookie", "Pro", "All-Star" }

local LIMITS = { HMin = 65, HMax = 87, WMin = 145, WMax = 220 }
local DEFAULT_BUILD = { Height = 76, Weight = 200, Skin = 5 }

--==============================================================================
-- 2. SMALL HELPERS
--==============================================================================
local function clamp(x: number, a: number, b: number): number
	if x < a then
		return a
	elseif x > b then
		return b
	end
	return x
end

local function lerp(a: number, b: number, t: number): number
	return a + (b - a) * t
end

-- Frame-rate independent smoothing toward a target
local function approach(cur: number, target: number, rate: number, dt: number): number
	return cur + (target - cur) * (1 - math.exp(-rate * dt))
end

local function flat(v: Vector3): Vector3
	return Vector3.new(v.X, 0, v.Z)
end

local function hasAsset(id: any): boolean
	if type(id) ~= "string" or id == "" then
		return false
	end
	if string.sub(id, 1, 11) == "rbxasset://" then
		return true
	end
	local n = tonumber(string.match(id, "%d+"))
	return n ~= nil and n > 0
end

-- Create an instance with properties (Parent is set last, which is faster)
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

local RNG = Random.new()

--==============================================================================
-- 3. REAL COURT DIMENSIONS (studs)
--==============================================================================
local FT = CONFIG.FT
local ORIGIN = CONFIG.Origin
local GEO = {
	FloorY = ORIGIN.Y,
	L = 94 * FT,
	W = 50 * FT,
	RimY = ORIGIN.Y + 10 * FT,
	RimR = 0.75 * FT, -- 18 in rim (inside)
	RimTube = 0.035,
	BallR = 0.392 * FT, -- 9.4 in ball
	BoardX = 47 * FT - 4 * FT, -- glass face, 4 ft inside the baseline
	HoopX = 47 * FT - 5.25 * FT, -- rim center
	ThreeR = 23.75 * FT,
	ThreeCorner = 22 * FT,
	LaneHalf = 8 * FT,
	FTFromBase = 19 * FT,
	SideApron = 7.5,
	BaseApron = 10,
}
GEO.ThreeTheta = math.asin(GEO.ThreeCorner / GEO.ThreeR)
GEO.ThreeBreak = GEO.ThreeR * math.cos(GEO.ThreeTheta)

-- Arena-space point -> world point (y is height above the court)
local function W(x: number, y: number, z: number): Vector3
	return Vector3.new(ORIGIN.X + x, GEO.FloorY + y, ORIGIN.Z + z)
end

--==============================================================================
-- 4. BUILDS, RATINGS AND THE SHOT MODEL
--==============================================================================
local Stats = {}

function Stats.sanitize(b: any)
	local out = table.clone(DEFAULT_BUILD)
	if type(b) == "table" then
		local function num(v, lo, hi)
			if type(v) == "number" and v == v then
				return math.floor(clamp(v, lo, hi) + 0.5)
			end
			return nil
		end
		out.Height = num(b.Height, LIMITS.HMin, LIMITS.HMax) or out.Height
		out.Weight = num(b.Weight, LIMITS.WMin, LIMITS.WMax) or out.Weight
		out.Skin = num(b.Skin, 1, #SKIN_TONES) or out.Skin
	end
	return out
end

function Stats.heightText(inches: number): string
	return string.format("%d'%d\"", math.floor(inches / 12), inches % 12)
end

-- Turns a build into real-world athletic numbers and 25-99 ratings
function Stats.derive(build: any)
	local b = Stats.sanitize(build)
	local t = (b.Height - LIMITS.HMin) / (LIMITS.HMax - LIMITS.HMin)
	local w = (b.Weight - LIMITS.WMin) / (LIMITS.WMax - LIMITS.WMin)
	local bmi = 703 * b.Weight / (b.Height * b.Height)
	local s: any = { t = t, w = w, Build = b }
	s.HeightStuds = b.Height / 12 * FT
	s.WidthScale = clamp(math.sqrt(bmi / 24), 0.85, 1.25)
	s.ReachStuds = s.HeightStuds * 1.33 -- standing reach
	s.VertInches = clamp(38 - 13 * w - 6 * t, 18, 40)
	s.JumpStuds = s.VertInches / 12 * FT
	s.SprintSpeed = (20.5 - 3.6 * w - 1.6 * t) * FT -- real sprint speed in studs/s
	s.JogSpeed = s.SprintSpeed * 0.62
	s.Strength = clamp(0.2 + 0.6 * w + 0.2 * t, 0, 1)
	s.Handle = clamp(0.95 - 0.45 * t - 0.2 * w, 0.2, 1)
	s.ShootTol = 0.07 + 0.045 * (1 - t) - 0.012 * w -- half-size of the green zone
	s.Finish = clamp(0.45 + 0.35 * t + 0.2 * w, 0, 1)
	s.PerimD = clamp(0.95 - 0.35 * w - 0.25 * t, 0.2, 1)
	s.InteriorD = clamp(0.3 + 0.5 * t + 0.2 * w, 0, 1)
	s.StealSkill = 0.06 + 0.1 * (1 - w) + 0.05 * (1 - t)
	s.StaminaDrain = 1 + 0.5 * w
	s.CanDunk = s.ReachStuds + s.JumpStuds >= 10 * FT + 0.45
	local function r(x: number): number
		return math.floor(clamp(x, 0, 1) * 74 + 25 + 0.5)
	end
	s.Ratings = {
		Speed = r((s.SprintSpeed - 12.9) / (18.5 - 12.9)),
		Strength = r(s.Strength),
		Reach = r(t),
		Shooting = r((s.ShootTol - 0.058) / 0.057),
		Handles = r(s.Handle),
		Defense = r((s.PerimD + s.InteriorD) / 2),
	}
	return s
end

-- Perfect charge for a shot from d studs
function Stats.idealPower(d: number): number
	return clamp(0.12 + 0.88 * d / CONFIG.MaxShotRange, 0.12, 1)
end

-- Make chance from distance alone (perfect charge, open look)
local SHOT_CURVE = {
	{ 0, 0.95 }, { 2.7, 0.9 }, { 5.4, 0.72 }, { 10.8, 0.58 }, { 16.2, 0.5 },
	{ 21.4, 0.43 }, { 25, 0.35 }, { 31.5, 0.2 }, { 42, 0.05 },
}
function Stats.distanceFactor(d: number): number
	for i = 1, #SHOT_CURVE - 1 do
		local a, b = SHOT_CURVE[i], SHOT_CURVE[i + 1]
		if d <= b[1] then
			return lerp(a[2], b[2], (d - a[1]) / (b[1] - a[1]))
		end
	end
	return 0.03
end

function Stats.powerFactor(err: number, tol: number): number
	if err <= tol then
		return 1 - 0.12 * err / tol
	end
	return math.max(0, 0.88 - (err - tol) * 5)
end

function Stats.shotChance(st: any, d: number, err: number, contest: number, perfect: boolean, kind: string): number
	local c
	if kind == "layup" then
		c = (0.6 + 0.3 * st.Finish) * (1 - 0.45 * math.min(err / (st.ShootTol * 3), 1))
	else
		c = Stats.powerFactor(err, st.ShootTol) * Stats.distanceFactor(d)
		if d < 5.4 then
			c += (st.Finish - 0.6) * 0.2
		end
		if d >= 16 then
			c += ((st.ShootTol - 0.058) / 0.057 - 0.5) * 0.12
		end
	end
	if perfect then
		c += 0.05
	end
	return clamp(c - contest, 0.02, 0.97)
end

-- Is a shot from pos a three-pointer at this hoop?
function Stats.isThree(hoop: any, pos: Vector3): boolean
	local rel = pos - hoop.Center
	local x = -rel.X * hoop.Sign -- distance from the rim toward center court
	local z = rel.Z
	if x < GEO.ThreeBreak then
		return math.abs(z) >= GEO.ThreeCorner
	end
	return x * x + z * z >= GEO.ThreeR * GEO.ThreeR
end

--==============================================================================
-- 5. GRAPHICS (all local: only this player's view changes)
--==============================================================================
local Graphics = {}

local function trySet(obj: Instance, prop: string, value: any)
	pcall(function()
		(obj :: any)[prop] = value
	end)
end

function Graphics.setup()
	trySet(Lighting, "LightingStyle", Enum.LightingStyle.Realistic) -- best lighting Roblox has
	trySet(Lighting, "PrioritizeLightingQuality", true) -- on weak devices, cut view distance before lighting
	Lighting.GlobalShadows = true
	Lighting.ClockTime = 0 -- indoor arena: every bit of light comes from the arena lights
	Lighting.Brightness = 0
	Lighting.Ambient = Color3.fromRGB(46, 46, 54)
	Lighting.OutdoorAmbient = Color3.fromRGB(24, 24, 30)
	Lighting.EnvironmentDiffuseScale = 0.35
	Lighting.EnvironmentSpecularScale = 0.55
	Lighting.ExposureCompensation = 0.2
	Lighting.ShadowSoftness = 0.2
	Lighting.FogStart = 0
	Lighting.FogEnd = 100000
	for _, child in ipairs(Lighting:GetChildren()) do
		if child:IsA("PostEffect") then
			child.Enabled = false
		elseif child:IsA("Atmosphere") then
			child:Destroy()
		end
	end
	local sky = Lighting:FindFirstChildOfClass("Sky") or new("Sky", { Parent = Lighting })
	sky.StarCount = 0
	sky.CelestialBodiesShown = false
	Graphics.color = new("ColorCorrectionEffect", {
		Name = "CK_Color", Brightness = 0.01, Contrast = 0.14, Saturation = 0.1,
		TintColor = Color3.fromRGB(255, 249, 241), Parent = Lighting,
	})
	Graphics.bloom = new("BloomEffect", { Name = "CK_Bloom", Intensity = 0.45, Size = 30, Threshold = 1.3, Parent = Lighting })
	Graphics.dof = new("DepthOfFieldEffect", {
		Name = "CK_DOF", Enabled = false, FarIntensity = 0.4, NearIntensity = 0,
		FocusDistance = 20, InFocusRadius = 12, Parent = Lighting,
	})
	Graphics.haze = new("Atmosphere", {
		Name = "CK_Haze", Density = 0.08, Offset = 0, Color = Color3.fromRGB(64, 64, 74),
		Decay = Color3.fromRGB(32, 32, 40), Glare = 0, Haze = 0.8, Parent = Lighting,
	})
	if CONFIG.RealGravity then
		Workspace.Gravity = 32.17 * FT -- 1 g at this scale
	end
end

--==============================================================================
-- 6. ARENA BUILDER
--==============================================================================
local Arena = { hoops = {}, boardLabels = {}, crowd = {}, ribbons = {} }

-- Anchored part. Decor parts skip collisions, touch, raycasts and shadows (fast).
local function part(parent: Instance, props: { [string]: any }, isDecor: boolean?): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.Material = Enum.Material.SmoothPlastic
	if isDecor then
		p.CanCollide = false
		p.CanTouch = false
		p.CanQuery = false
		p.CastShadow = false
	end
	for k, v in pairs(props) do
		(p :: any)[k] = v
	end
	p.Parent = parent
	return p
end

-- Glowing screen text (LightInfluence 0 = lit like a real LED screen)
local function screenText(p: BasePart, face: Enum.NormalId, text: string, color: Color3, font: Enum.Font?, ppu: number?): TextLabel
	local g = new("SurfaceGui", {
		Face = face, SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud, PixelsPerStud = ppu or 30,
		LightInfluence = 0, Brightness = 1.6, MaxDistance = 400, Parent = p,
	})
	return new("TextLabel", {
		Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Text = text, TextScaled = true,
		Font = font or Enum.Font.GothamBlack, TextColor3 = color, Parent = g,
	})
end

-- Printed text (lit by the scene, like paint or fabric)
local function paintText(p: BasePart, face: Enum.NormalId, text: string, color: Color3, font: Enum.Font?): TextLabel
	local g = new("SurfaceGui", {
		Face = face, SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud, PixelsPerStud = 24,
		LightInfluence = 1, MaxDistance = 400, Parent = p,
	})
	return new("TextLabel", {
		Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Text = text, TextScaled = true,
		Font = font or Enum.Font.GothamBlack, TextColor3 = color, Parent = g,
	})
end

local LINE_W = 2 / 12 * FT -- regulation 2-inch lines

local function floorSeg(parent: Instance, x1: number, z1: number, x2: number, z2: number, width: number?, color: Color3?)
	local a, b = W(x1, 0.016, z1), W(x2, 0.016, z2)
	local len = (b - a).Magnitude
	if len < 0.001 then
		return
	end
	local w = width or LINE_W
	part(parent, {
		Name = "Line", Size = Vector3.new(w, 0.012, len + w * 0.6),
		CFrame = CFrame.lookAt((a + b) / 2, b), Color = color or TEAM.White,
	}, true)
end

-- Arc around (cx, cz). Angle 0 points to +X, 90 degrees points to +Z.
local function floorArc(parent: Instance, cx: number, cz: number, r: number, a0: number, a1: number, segs: number, dashed: boolean?)
	for i = 0, segs - 1 do
		if not dashed or i % 2 == 0 then
			local t0 = a0 + (a1 - a0) * i / segs
			local t1 = a0 + (a1 - a0) * (i + 1) / segs
			floorSeg(parent, cx + r * math.cos(t0), cz + r * math.sin(t0), cx + r * math.cos(t1), cz + r * math.sin(t1))
		end
	end
end

local function paintRect(parent: Instance, cx: number, cz: number, sx: number, sz: number, color: Color3)
	part(parent, {
		Name = "Paint", Size = Vector3.new(sx, 0.01, sz), CFrame = CFrame.new(W(cx, 0.005, cz)),
		Color = color, Reflectance = 0.03,
	}, true)
end

local function floorText(parent: Instance, x: number, z: number, sx: number, sz: number, rotY: number, text: string, color: Color3)
	local p = part(parent, {
		Name = "FloorText", Size = Vector3.new(sx, 0.01, sz),
		CFrame = CFrame.new(W(x, 0.03, z)) * CFrame.Angles(0, rotY, 0), Transparency = 1,
	}, true)
	paintText(p, Enum.NormalId.Top, text, color)
end

function Arena.buildFloor(m: Model)
	local L, Wd = GEO.L, GEO.W
	local sa, ba = GEO.SideApron, GEO.BaseApron
	part(m, {
		Name = "Slab", Size = Vector3.new(172, 2, 152), CFrame = CFrame.new(W(0, -1.03, 0)),
		Color = Color3.fromRGB(44, 46, 52), Material = Enum.Material.Concrete,
	})
	part(m, {
		Name = "Hardwood", Size = Vector3.new(L + 2 * ba, 1, Wd + 2 * sa), CFrame = CFrame.new(W(0, -0.5, 0)),
		Color = TEAM.Wood, Material = Enum.Material.WoodPlanks, Reflectance = 0.04,
	})
	local mk = new("Folder", { Name = "Markings", Parent = m })
	-- Team-colored apron around the court
	paintRect(mk, 0, Wd / 2 + sa / 2, L + 2 * ba, sa, TEAM.Royal)
	paintRect(mk, 0, -(Wd / 2 + sa / 2), L + 2 * ba, sa, TEAM.Royal)
	paintRect(mk, L / 2 + ba / 2, 0, ba, Wd, TEAM.Royal)
	paintRect(mk, -(L / 2 + ba / 2), 0, ba, Wd, TEAM.Royal)
	-- floor lettering reads correctly from center court
	floorText(mk, 0, Wd / 2 + sa * 0.55, 34, 4.2, math.pi, CONFIG.ArenaName, TEAM.Gold)
	floorText(mk, 0, -(Wd / 2 + sa * 0.55), 34, 4.2, 0, CONFIG.GameName, TEAM.Gold)
	for _, s in ipairs({ 1, -1 }) do
		floorText(mk, s * (L / 2 + ba * 0.55), 0, 26, 5, -s * math.pi / 2, CONFIG.GameName, TEAM.White)
	end

	-- Boundary, half-court line, center circles and logo
	floorSeg(mk, -L / 2, -Wd / 2, L / 2, -Wd / 2)
	floorSeg(mk, -L / 2, Wd / 2, L / 2, Wd / 2)
	floorSeg(mk, -L / 2, -Wd / 2, -L / 2, Wd / 2)
	floorSeg(mk, L / 2, -Wd / 2, L / 2, Wd / 2)
	floorSeg(mk, 0, -Wd / 2, 0, Wd / 2)
	floorArc(mk, 0, 0, 6 * FT, 0, math.pi * 2, 48)
	floorArc(mk, 0, 0, 2 * FT, 0, math.pi * 2, 24)
	part(mk, {
		Name = "CenterCircle", Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(0.01, 12 * FT - LINE_W * 2, 12 * FT - LINE_W * 2),
		CFrame = CFrame.new(W(0, 0.006, 0)) * CFrame.Angles(0, 0, math.pi / 2), Color = TEAM.Royal, Reflectance = 0.03,
	}, true)
	floorText(mk, 0, 0, 8.6, 2.4, 0, "KINGS", TEAM.Gold)

	for _, s in ipairs({ 1, -1 }) do
		local base = s * L / 2
		local rimX = s * GEO.HoopX
		local ftX = s * (L / 2 - GEO.FTFromBase)
		local lane = GEO.LaneHalf
		local toCenter = s > 0 and math.pi or 0
		paintRect(mk, (base + ftX) / 2, 0, math.abs(base - ftX), lane * 2, TEAM.Royal)
		floorSeg(mk, base, lane, ftX, lane)
		floorSeg(mk, base, -lane, ftX, -lane)
		floorSeg(mk, ftX, -lane, ftX, lane)
		-- Free-throw circle: solid toward half court, dashed inside the lane
		floorArc(mk, ftX, 0, 6 * FT, toCenter - math.pi / 2, toCenter + math.pi / 2, 20)
		floorArc(mk, ftX, 0, 6 * FT, toCenter + math.pi / 2, toCenter + math.pi * 1.5, 14, true)
		-- Restricted area (4 ft) with short straight legs to the backboard line
		floorArc(mk, rimX, 0, 4 * FT, toCenter - math.pi / 2, toCenter + math.pi / 2, 16)
		local boardX = s * GEO.BoardX
		floorSeg(mk, rimX, 4 * FT, boardX, 4 * FT)
		floorSeg(mk, rimX, -4 * FT, boardX, -4 * FT)
		-- Three-point line: straight corners + 23'9" arc
		local breakX = rimX - s * GEO.ThreeBreak
		floorSeg(mk, base, GEO.ThreeCorner, breakX, GEO.ThreeCorner)
		floorSeg(mk, base, -GEO.ThreeCorner, breakX, -GEO.ThreeCorner)
		floorArc(mk, rimX, 0, GEO.ThreeR, toCenter - GEO.ThreeTheta, toCenter + GEO.ThreeTheta, 44)
		-- Lane blocks and hash marks
		for _, zs in ipairs({ 1, -1 }) do
			local bx = base - s * 7 * FT
			part(mk, {
				Name = "Block", Size = Vector3.new(1 * FT, 0.012, 0.66 * FT),
				CFrame = CFrame.new(W(bx - s * 0.5 * FT, 0.016, zs * (lane + 0.33 * FT))), Color = TEAM.White,
			}, true)
			for _, d in ipairs({ 11, 14, 17 }) do
				local hx = base - s * d * FT
				floorSeg(mk, hx, zs * lane, hx, zs * (lane + 0.5 * FT))
			end
			-- 28-ft hash on each sideline
			local cx = base - s * 28 * FT
			floorSeg(mk, cx, zs * Wd / 2, cx, zs * (Wd / 2 - 3 * FT))
		end
	end
end

-- One full basket: glass, rim, net, stanchion, shot clock. s = +1 east end, -1 west end
function Arena.buildHoop(parent: Instance, s: number)
	local m = new("Model", { Name = s > 0 and "HoopEast" or "HoopWest", Parent = parent })
	local L = GEO.L
	local faceX = s * GEO.BoardX
	local rimC = W(s * GEO.HoopX, GEO.RimY - GEO.FloorY, 0)
	local rimH = GEO.RimY - GEO.FloorY
	local bw, bh, bt = 6 * FT, 3.5 * FT, 0.1
	local bottom = rimH - 0.5 * FT
	local boardCX = faceX + s * bt / 2
	local inward = -s -- direction from the board toward the court
	local hoop: any = { Sign = s, Center = rimC, Model = m, Rim = {}, Leds = {}, ClockLabels = {} }

	hoop.Board = part(m, {
		Name = "Backboard", Size = Vector3.new(bt, bh, bw), CFrame = CFrame.new(W(boardCX, bottom + bh / 2, 0)),
		Material = Enum.Material.Glass, Color = Color3.fromRGB(214, 232, 242), Transparency = 0.6,
		Reflectance = 0.2, CastShadow = false,
	})
	-- White border and shooter's square, painted on the court side of the glass
	local fx = faceX + inward * 0.006
	local stripe = 2 / 12 * FT
	local function boardLine(y: number, z: number, h: number, w: number)
		part(m, { Name = "BoardPaint", Size = Vector3.new(0.01, h, w), CFrame = CFrame.new(W(fx, y, z)), Color = TEAM.White }, true)
	end
	boardLine(bottom + bh - stripe / 2, 0, stripe, bw)
	boardLine(bottom + stripe / 2, 0, stripe, bw)
	boardLine(bottom + bh / 2, bw / 2 - stripe / 2, bh, stripe)
	boardLine(bottom + bh / 2, -bw / 2 + stripe / 2, bh, stripe)
	local sqW, sqH = 2 * FT, 1.5 * FT
	local sqB = rimH + GEO.RimTube
	boardLine(sqB + stripe / 2, 0, stripe, sqW)
	boardLine(sqB + sqH - stripe / 2, 0, stripe, sqW)
	boardLine(sqB + sqH / 2, sqW / 2 - stripe / 2, sqH, stripe)
	boardLine(sqB + sqH / 2, -sqW / 2 + stripe / 2, sqH, stripe)
	-- Red LED strip around the glass (lights up on the buzzer)
	for _, e in ipairs({
		{ bottom + bh - 0.03, 0, 0.06, bw }, { bottom + 0.03, 0, 0.06, bw },
		{ bottom + bh / 2, bw / 2 - 0.03, bh, 0.06 }, { bottom + bh / 2, -bw / 2 + 0.03, bh, 0.06 },
	}) do
		local led = part(m, {
			Name = "Led", Size = Vector3.new(0.02, e[3], e[4]), CFrame = CFrame.new(W(faceX + inward * 0.012, e[1], e[2])),
			Material = Enum.Material.Neon, Color = Color3.fromRGB(255, 30, 30), Transparency = 1,
		}, true)
		table.insert(hoop.Leds, led)
	end
	-- Padding on the bottom edge
	part(m, {
		Name = "BoardPad", Size = Vector3.new(0.3, 0.22, bw + 0.1), CFrame = CFrame.new(W(boardCX, bottom - 0.11, 0)),
		Material = Enum.Material.Fabric, Color = TEAM.Navy,
	})

	-- Rim: 32 round tube pieces that the ball really bounces off
	local segs = 32
	local tubeR = GEO.RimTube
	local ringR = GEO.RimR + tubeR
	for i = 0, segs - 1 do
		local a0 = i / segs * math.pi * 2
		local a1 = (i + 1) / segs * math.pi * 2
		local p0 = rimC + Vector3.new(ringR * math.cos(a0), 0, ringR * math.sin(a0))
		local p1 = rimC + Vector3.new(ringR * math.cos(a1), 0, ringR * math.sin(a1))
		local seg = part(m, {
			Name = "Rim", Shape = Enum.PartType.Cylinder,
			Size = Vector3.new((p1 - p0).Magnitude + 0.02, tubeR * 2, tubeR * 2),
			CFrame = CFrame.lookAt((p0 + p1) / 2, p1) * CFrame.Angles(0, math.pi / 2, 0),
			Color = TEAM.Rim, Material = Enum.Material.Metal, Reflectance = 0.12,
			CanQuery = false,
		})
		table.insert(hoop.Rim, seg)
	end
	hoop.RimBase = {}
	for i, seg in ipairs(hoop.Rim) do
		hoop.RimBase[i] = seg.CFrame
	end
	-- Flange and breakaway spring housing
	local backX = s * (GEO.HoopX + ringR)
	local flangeLen = math.abs(faceX - backX)
	local flange = part(m, {
		Name = "RimFlange", Size = Vector3.new(flangeLen + 0.05, 0.06, 0.42),
		CFrame = CFrame.new(W((faceX + backX) / 2, rimH - 0.02, 0)), Color = TEAM.Rim, Material = Enum.Material.Metal,
	})
	local housing = part(m, {
		Name = "SpringHousing", Size = Vector3.new(0.22, 0.32, 0.5),
		CFrame = CFrame.new(W(faceX + inward * 0.11, rimH - 0.2, 0)), Color = Color3.fromRGB(36, 36, 40), Material = Enum.Material.Metal,
	})
	table.insert(hoop.Rim, flange)
	table.insert(hoop.RimBase, flange.CFrame)
	table.insert(hoop.Rim, housing)
	table.insert(hoop.RimBase, housing.CFrame)

	-- Net: three rings of 12 knots joined in a diamond mesh
	local net: any = { strands = {}, n = 12, offset = 0, sway = 0, center = rimC }
	net.rings = {
		{ r = GEO.RimR + 0.005, y = -0.03, shift = 0 },
		{ r = GEO.RimR * 0.8, y = -0.6, shift = 0.5 },
		{ r = GEO.RimR * 0.58, y = -1.2, shift = 0 },
	}
	for ring = 1, 2 do
		for i = 0, net.n - 1 do
			for _, step in ipairs({ 0, ring == 1 and -1 or 1 }) do
				local strand = part(m, {
					Name = "Net", Size = Vector3.new(0.022, 0.022, 0.5), Color = Color3.fromRGB(250, 250, 250),
					Material = Enum.Material.Fabric, Transparency = 0.05,
				}, true)
				local j = (i + step) % net.n
				if ring == 1 then
					table.insert(net.strands, { part = strand, a = { 1, i }, b = { 2, j } })
				else
					table.insert(net.strands, { part = strand, a = { 2, i }, b = { 3, j } })
				end
			end
		end
	end
	hoop.Net = net
	Arena.layoutNet(hoop, 0)

	-- Stanchion: padded base, upright, arm and brace
	local baseX = s * (L / 2 + 3.6)
	local baseTop = 3.2
	local basePad = part(m, {
		Name = "StanchionBase", Size = Vector3.new(5.4, baseTop, 4.2), CFrame = CFrame.new(W(baseX, baseTop / 2, 0)),
		Material = Enum.Material.Fabric, Color = TEAM.Royal,
	})
	paintText(basePad, s > 0 and Enum.NormalId.Left or Enum.NormalId.Right, "KINGS", TEAM.Gold)
	local upX = s * (L / 2 + 5.6)
	local upTop = 13 * FT + 0.8
	part(m, {
		Name = "Upright", Size = Vector3.new(0.75, upTop - baseTop, 0.75), CFrame = CFrame.new(W(upX, (upTop + baseTop) / 2, 0)),
		Material = Enum.Material.Metal, Color = Color3.fromRGB(70, 74, 82),
	})
	part(m, {
		Name = "UprightPad", Size = Vector3.new(1.05, 3.4, 1.05), CFrame = CFrame.new(W(upX, baseTop + 1.7, 0)),
		Material = Enum.Material.Fabric, Color = TEAM.Navy,
	})
	local armA = W(upX, upTop - 0.3, 0)
	local armB = W(faceX + s * (bt + 0.3), bottom + bh * 0.6, 0)
	part(m, {
		Name = "Arm", Size = Vector3.new(0.55, 0.55, (armB - armA).Magnitude),
		CFrame = CFrame.lookAt((armA + armB) / 2, armB), Material = Enum.Material.Metal, Color = Color3.fromRGB(70, 74, 82),
	})
	local braceA = W(s * (L / 2 + 1.2), baseTop, 0)
	local braceB = armA:Lerp(armB, 0.45)
	part(m, {
		Name = "Brace", Size = Vector3.new(0.35, 0.35, (braceB - braceA).Magnitude),
		CFrame = CFrame.lookAt((braceA + braceB) / 2, braceB), Material = Enum.Material.Metal, Color = Color3.fromRGB(70, 74, 82),
	})
	part(m, {
		Name = "BoardMount", Size = Vector3.new(0.3, 1.6, 2.2), CFrame = CFrame.new(W(faceX + s * (bt + 0.15), bottom + bh * 0.6, 0)),
		Material = Enum.Material.Metal, Color = Color3.fromRGB(40, 42, 48),
	})
	-- Shot clock on top of the glass, readable from both sides
	local clock = part(m, {
		Name = "ShotClock", Size = Vector3.new(0.5, 0.95, 2.4), CFrame = CFrame.new(W(boardCX, bottom + bh + 0.5, 0)),
		Color = Color3.fromRGB(16, 16, 18), Material = Enum.Material.Metal,
	})
	for _, face in ipairs({ Enum.NormalId.Left, Enum.NormalId.Right }) do
		table.insert(hoop.ClockLabels, screenText(clock, face, "24", Color3.fromRGB(255, 52, 40), Enum.Font.Code, 40))
	end
	return hoop
end

-- Places the net strands. squeeze/drop come from the swish animation.
function Arena.layoutNet(hoop: any, t: number)
	local net = hoop.Net
	local c = net.center
	local swish = net.offset -- 0..1
	local sway = net.sway
	local points = {}
	for ri, ring in ipairs(net.rings) do
		local pts = {}
		local k = (ri - 1) / 2 -- 0 at the rim, 1 at the bottom
		local r = ring.r * (1 - 0.22 * swish * k)
		local y = ring.y - 0.28 * swish * k
		local sx = sway * k * math.sin(t * 9)
		for i = 0, net.n - 1 do
			local a = (i + ring.shift) / net.n * math.pi * 2
			pts[i] = c + Vector3.new(r * math.cos(a) + sx, y, r * math.sin(a))
		end
		points[ri] = pts
	end
	for _, st in ipairs(net.strands) do
		local p0 = points[st.a[1]][st.a[2]]
		local p1 = points[st.b[1]][st.b[2]]
		local len = (p1 - p0).Magnitude
		st.part.Size = Vector3.new(0.022, 0.022, len + 0.02)
		st.part.CFrame = CFrame.lookAt((p0 + p1) / 2, p1)
	end
end

local SHIRTS = {
	TEAM.Gold, TEAM.Gold, TEAM.Gold, TEAM.Royal, TEAM.Royal, TEAM.Royal, TEAM.White, TEAM.White,
	TEAM.Crimson, Color3.fromRGB(28, 28, 32), Color3.fromRGB(120, 124, 132), Color3.fromRGB(70, 110, 170),
}

-- A seated (or standing) fan: torso + head, no collisions or shadows
local function addFan(parent: Instance, seat: Vector3, facing: Vector3, standing: boolean)
	local shirt = SHIRTS[RNG:NextInteger(1, #SHIRTS)]
	local skin = SKIN_TONES[RNG:NextInteger(1, #SKIN_TONES)]
	local th = standing and 1.6 or 1.15
	local center = seat + Vector3.new(0, (standing and 0.5 or 0.05) + th / 2, 0)
	local cf = CFrame.lookAt(center, center + facing)
	local torso = part(parent, {
		Name = "Fan", Size = Vector3.new(1.05, th, 0.6), CFrame = cf, Color = shirt, Material = Enum.Material.Fabric,
	}, true)
	local head = part(parent, {
		Name = "FanHead", Shape = Enum.PartType.Ball, Size = Vector3.new(0.62, 0.62, 0.62),
		CFrame = cf * CFrame.new(0, th / 2 + 0.34, 0), Color = skin,
	}, true)
	table.insert(Arena.crowd, torso)
	table.insert(Arena.crowd, head)
end

-- Lower bowl: rows of seats with fans in them
function Arena.buildStands(m: Model)
	local f = new("Folder", { Name = "Stands" })
	local crowdF = new("Folder", { Name = "Crowd", Parent = f })
	local rowD, rise = 2.4, 0.95
	local riserColor = Color3.fromRGB(50, 52, 60)
	local added = 0
	local function bank(alongX: boolean, sign: number, rows: number, sections: { any }, start: number)
		for _, sec in ipairs(sections) do
			local a0, a1, seatColor = sec[1], sec[2], sec[3]
			local len = a1 - a0
			local mid = (a0 + a1) / 2
			local seatsPerRow = math.floor(len / 1.75)
			for r = 0, rows - 1 do
				local top = 0.5 + r * rise
				local off = start + r * rowD + rowD / 2
				local backOff = off + rowD / 2 - 0.2
				if alongX then
					part(f, { Name = "Riser", Size = Vector3.new(len, top, rowD), CFrame = CFrame.new(W(mid, top / 2, sign * off)), Color = riserColor, Material = Enum.Material.Concrete })
					part(f, { Name = "SeatRow", Size = Vector3.new(len, 0.9, 0.24), CFrame = CFrame.new(W(mid, top + 0.45, sign * backOff)), Color = seatColor, Material = Enum.Material.Plastic }, true)
				else
					part(f, { Name = "Riser", Size = Vector3.new(rowD, top, len), CFrame = CFrame.new(W(sign * off, top / 2, mid)), Color = riserColor, Material = Enum.Material.Concrete })
					part(f, { Name = "SeatRow", Size = Vector3.new(0.24, 0.9, len), CFrame = CFrame.new(W(sign * backOff, top + 0.45, mid)), Color = seatColor, Material = Enum.Material.Plastic }, true)
				end
				for i = 0, seatsPerRow - 1 do
					if RNG:NextNumber() < CONFIG.CrowdDensity then
						local along = a0 + (i + 0.5) * len / seatsPerRow
						local seat = alongX and W(along, top, sign * (off + 0.2)) or W(sign * (off + 0.2), top, along)
						local facing = alongX and Vector3.new(0, 0, -sign) or Vector3.new(-sign, 0, 0)
						addFan(crowdF, seat, facing, RNG:NextNumber() < 0.06)
						added += 1
						if added % 150 == 0 then
							task.wait() -- keep the game responsive while the crowd fills in
						end
					end
				end
			end
			-- Aisle stairs at both ends of the section
			for _, edge in ipairs({ a0 - 0.75, a1 + 0.75 }) do
				for r = 0, rows - 1 do
					local h = 0.5 + r * rise - rise / 2
					local off = start + r * rowD + rowD / 2
					local cf = alongX and CFrame.new(W(edge, h / 2, sign * off)) or CFrame.new(W(sign * off, h / 2, edge))
					local size = alongX and Vector3.new(1.5, math.max(h, 0.2), rowD) or Vector3.new(rowD, math.max(h, 0.2), 1.5)
					part(f, { Name = "Aisle", Size = size, CFrame = cf, Color = Color3.fromRGB(64, 66, 74), Material = Enum.Material.Concrete })
				end
			end
		end
	end
	local sideStart = GEO.W / 2 + GEO.SideApron + 1.5
	local endStart = GEO.L / 2 + GEO.BaseApron + 1.5
	local sideSecs = { { -40, -14, TEAM.Royal }, { -12.5, 12.5, TEAM.Crimson }, { 14, 40, TEAM.Royal } }
	local endSecs = { { -27, -1.5, TEAM.Royal }, { 1.5, 27, TEAM.Royal } }
	bank(true, 1, 14, sideSecs, sideStart)
	bank(true, -1, 14, sideSecs, sideStart)
	bank(false, 1, 9, endSecs, endStart)
	bank(false, -1, 9, endSecs, endStart)
	f.Parent = m
end

-- Walls, corners, suites, ceiling and rafters
function Arena.buildShell(m: Model)
	local f = new("Folder", { Name = "Shell", Parent = m })
	local wallC = Color3.fromRGB(32, 34, 42)
	local H = 60
	for _, s in ipairs({ 1, -1 }) do
		part(f, { Name = "Wall", Size = Vector3.new(164, H, 2), CFrame = CFrame.new(W(0, H / 2, s * 71)), Color = wallC, Material = Enum.Material.Concrete })
		part(f, { Name = "Wall", Size = Vector3.new(2, H, 144), CFrame = CFrame.new(W(s * 81, H / 2, 0)), Color = wallC, Material = Enum.Material.Concrete })
		for _, s2 in ipairs({ 1, -1 }) do
			part(f, { Name = "Corner", Size = Vector3.new(13, 9, 34), CFrame = CFrame.new(W(s * 47.5, 4.5, s2 * 52)), Color = Color3.fromRGB(40, 42, 50), Material = Enum.Material.Concrete })
			part(f, { Name = "Tunnel", Size = Vector3.new(6, 5.5, 0.4), CFrame = CFrame.new(W(s * 47.5, 2.75, s2 * 34.8)), Color = Color3.fromRGB(8, 8, 10) }, true)
			local exit = part(f, { Name = "Exit", Size = Vector3.new(1.6, 0.6, 0.15), CFrame = CFrame.new(W(s * 47.5, 6.1, s2 * 34.7)), Material = Enum.Material.Neon, Color = Color3.fromRGB(40, 220, 90) }, true)
			screenText(exit, s2 > 0 and Enum.NormalId.Front or Enum.NormalId.Back, "EXIT", Color3.new(1, 1, 1), Enum.Font.GothamBold, 40)
		end
		-- Suite level: glass band with warm light behind it
		part(f, { Name = "Suites", Size = Vector3.new(150, 3.4, 0.3), CFrame = CFrame.new(W(0, 19.6, s * 69.8)), Material = Enum.Material.Glass, Color = Color3.fromRGB(150, 160, 170), Transparency = 0.35, Reflectance = 0.25 }, true)
		part(f, { Name = "SuiteGlow", Size = Vector3.new(150, 3.2, 0.1), CFrame = CFrame.new(W(0, 19.6, s * 69.95)), Material = Enum.Material.Neon, Color = Color3.fromRGB(120, 92, 60) }, true)
		part(f, { Name = "SuiteGlowEnd", Size = Vector3.new(0.1, 3.2, 120), CFrame = CFrame.new(W(s * 79.95, 16, 0)), Material = Enum.Material.Neon, Color = Color3.fromRGB(110, 86, 58) }, true)
	end
	part(f, { Name = "Ceiling", Size = Vector3.new(166, 1, 146), CFrame = CFrame.new(W(0, H + 0.5, 0)), Color = Color3.fromRGB(16, 17, 22), Material = Enum.Material.Metal })
	for i = -5, 5 do
		part(f, { Name = "Truss", Size = Vector3.new(160, 1.4, 0.7), CFrame = CFrame.new(W(0, H - 3, i * 12.5)), Color = Color3.fromRGB(56, 58, 66), Material = Enum.Material.Metal }, true)
	end
	for i = -4, 4 do
		part(f, { Name = "Truss", Size = Vector3.new(0.7, 1.4, 140), CFrame = CFrame.new(W(i * 18, H - 4.4, 0)), Color = Color3.fromRGB(56, 58, 66), Material = Enum.Material.Metal }, true)
	end
end

-- Arena lights: real spot lights over the court (the central ones cast shadows)
function Arena.buildLights(m: Model)
	local f = new("Folder", { Name = "Lights", Parent = m })
	local y = 40
	for _, s in ipairs({ 1, -1 }) do
		part(f, { Name = "Catwalk", Size = Vector3.new(80, 0.3, 2.4), CFrame = CFrame.new(W(0, y + 1, s * 12)), Material = Enum.Material.DiamondPlate, Color = Color3.fromRGB(60, 62, 70) }, true)
		for _, x in ipairs({ -36, 0, 36 }) do
			part(f, { Name = "Hanger", Size = Vector3.new(0.12, 60 - y - 1, 0.12), CFrame = CFrame.new(W(x, (60 + y + 1) / 2, s * 12)), Color = Color3.fromRGB(40, 40, 44), Material = Enum.Material.Metal }, true)
		end
	end
	local spots = {}
	for _, z in ipairs({ -12, 12 }) do
		for _, x in ipairs({ -30, -15, 0, 15, 30 }) do
			table.insert(spots, Vector3.new(x, 0, z))
		end
	end
	table.sort(spots, function(a, b)
		return a.Magnitude < b.Magnitude
	end)
	for i, p in ipairs(spots) do
		part(f, { Name = "Fixture", Size = Vector3.new(2.4, 0.7, 1.7), CFrame = CFrame.new(W(p.X, y, p.Z)), Color = Color3.fromRGB(38, 38, 42), Material = Enum.Material.Metal }, true)
		local lens = part(f, { Name = "Lens", Size = Vector3.new(2.1, 0.05, 1.4), CFrame = CFrame.new(W(p.X, y - 0.37, p.Z)), Material = Enum.Material.Neon, Color = Color3.fromRGB(255, 247, 232) }, true)
		new("SpotLight", { Face = Enum.NormalId.Bottom, Angle = 80, Range = 60, Brightness = 3.2, Color = Color3.fromRGB(255, 245, 228), Shadows = i <= CONFIG.ShadowLights, Parent = lens })
	end
	-- Softer fill light on the stands (no shadows, cheap)
	local function fill(pos: Vector3, target: Vector3)
		local lamp = part(f, { Name = "FillLight", Size = Vector3.new(1.6, 0.4, 1.2), CFrame = CFrame.lookAt(pos, target) * CFrame.Angles(math.pi / 2, 0, 0), Material = Enum.Material.Neon, Color = Color3.fromRGB(255, 236, 212) }, true)
		new("SpotLight", { Face = Enum.NormalId.Bottom, Angle = 100, Range = 55, Brightness = 0.85, Color = Color3.fromRGB(255, 236, 212), Shadows = false, Parent = lamp })
	end
	for _, s in ipairs({ 1, -1 }) do
		for _, x in ipairs({ -32, -10, 10, 32 }) do
			fill(W(x, 38, s * 24), W(x, 6, s * 48))
		end
		fill(W(s * 40, 38, 0), W(s * 64, 5, 0))
	end
end

-- Scrolling LED board. Returns the moving label.
function Arena.addRibbon(parent: Instance, cf: CFrame, size: Vector3, face: Enum.NormalId, text: string, seconds: number?): TextLabel
	local p = part(parent, { Name = "Ribbon", Size = size, CFrame = cf, Color = Color3.fromRGB(8, 8, 10), Material = Enum.Material.Metal }, true)
	local g = new("SurfaceGui", {
		Face = face, SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud, PixelsPerStud = 24,
		LightInfluence = 0, Brightness = 1.8, ClipsDescendants = true, MaxDistance = 400, Parent = p,
	})
	local bg = new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, ClipsDescendants = true, Parent = g })
	new("UIGradient", { Color = ColorSequence.new(TEAM.Navy, TEAM.Royal), Parent = bg })
	local label = new("TextLabel", {
		Size = UDim2.fromScale(2, 1), BackgroundTransparency = 1, Text = text .. "          " .. text,
		TextScaled = true, Font = Enum.Font.GothamBlack, TextColor3 = TEAM.Gold, Parent = bg,
	})
	TweenService:Create(label, TweenInfo.new(seconds or 18, Enum.EasingStyle.Linear, Enum.EasingDirection.In, -1), { Position = UDim2.fromScale(-1, 0) }):Play()
	table.insert(Arena.ribbons, label)
	return label
end

-- Center-hung video board with live score
function Arena.buildJumbotron(m: Model)
	local f = new("Folder", { Name = "Jumbotron", Parent = m })
	local y = 33
	local core = part(f, { Name = "Jumbotron", Size = Vector3.new(14, 8, 14), CFrame = CFrame.new(W(0, y, 0)), Color = Color3.fromRGB(12, 12, 14), Material = Enum.Material.Metal })
	local labels = { home = {}, away = {}, clock = {}, msg = {} }
	for _, face in ipairs({ Enum.NormalId.Front, Enum.NormalId.Back, Enum.NormalId.Left, Enum.NormalId.Right }) do
		local g = new("SurfaceGui", {
			Face = face, SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud, PixelsPerStud = 36,
			LightInfluence = 0, Brightness = 1.5, MaxDistance = 400, Parent = core,
		})
		local bg = new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, Parent = g })
		new("UIGradient", { Color = ColorSequence.new(Color3.fromRGB(8, 14, 34), Color3.fromRGB(20, 40, 96)), Rotation = 90, Parent = bg })
		local function txt(text: string, pos: UDim2, size: UDim2, color: Color3, font: Enum.Font?): TextLabel
			return new("TextLabel", {
				Size = size, Position = pos, BackgroundTransparency = 1, Text = text, TextScaled = true,
				Font = font or Enum.Font.GothamBlack, TextColor3 = color, Parent = bg,
			})
		end
		txt(CONFIG.GameName, UDim2.fromScale(0.05, 0.03), UDim2.fromScale(0.9, 0.17), TEAM.Gold)
		txt("YOU", UDim2.fromScale(0.04, 0.24), UDim2.fromScale(0.42, 0.14), TEAM.White, Enum.Font.GothamBold)
		txt("CPU", UDim2.fromScale(0.54, 0.24), UDim2.fromScale(0.42, 0.14), TEAM.White, Enum.Font.GothamBold)
		table.insert(labels.home, txt("0", UDim2.fromScale(0.04, 0.38), UDim2.fromScale(0.42, 0.34), Color3.new(1, 1, 1), Enum.Font.Code))
		table.insert(labels.away, txt("0", UDim2.fromScale(0.54, 0.38), UDim2.fromScale(0.42, 0.34), Color3.new(1, 1, 1), Enum.Font.Code))
		table.insert(labels.clock, txt("24", UDim2.fromScale(0.36, 0.74), UDim2.fromScale(0.28, 0.2), Color3.fromRGB(255, 70, 50), Enum.Font.Code))
		table.insert(labels.msg, txt("FIRST TO " .. CONFIG.WinScore, UDim2.fromScale(0.04, 0.76), UDim2.fromScale(0.3, 0.16), Color3.fromRGB(200, 210, 230), Enum.Font.GothamBold))
	end
	Arena.boardLabels = labels
	for _, ry in ipairs({ y - 4.65, y + 4.65 }) do
		local ring = part(f, { Name = "JumboRing", Size = Vector3.new(15, 1.3, 15), CFrame = CFrame.new(W(0, ry, 0)), Color = Color3.fromRGB(10, 10, 12), Material = Enum.Material.Metal })
		for _, face in ipairs({ Enum.NormalId.Front, Enum.NormalId.Back, Enum.NormalId.Left, Enum.NormalId.Right }) do
			local g = new("SurfaceGui", { Face = face, SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud, PixelsPerStud = 30, LightInfluence = 0, Brightness = 1.6, ClipsDescendants = true, MaxDistance = 400, Parent = ring })
			local bg = new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = TEAM.Crimson, BorderSizePixel = 0, Parent = g })
			new("TextLabel", { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Text = "LET'S GO KINGS", TextScaled = true, Font = Enum.Font.GothamBlack, TextColor3 = Color3.new(1, 1, 1), Parent = bg })
		end
	end
	for _, c in ipairs({ { 6, 6 }, { -6, 6 }, { 6, -6 }, { -6, -6 } }) do
		local a = W(c[1], y + 5.3, c[2])
		local b = W(c[1] * 1.6, 60, c[2] * 1.6)
		part(f, { Name = "Cable", Size = Vector3.new(0.1, 0.1, (b - a).Magnitude), CFrame = CFrame.lookAt((a + b) / 2, b), Color = Color3.fromRGB(30, 30, 32), Material = Enum.Material.Metal }, true)
	end
end

function Arena.buildCourtside(m: Model)
	local f = new("Folder", { Name = "Courtside", Parent = m })
	local fans = new("Folder", { Name = "CourtsideFans", Parent = f })
	local half = GEO.W / 2
	local tz = half + 3.4
	part(f, { Name = "ScorersTable", Size = Vector3.new(22, 2.7, 2.2), CFrame = CFrame.new(W(0, 1.35, tz)), Color = Color3.fromRGB(14, 14, 16), Material = Enum.Material.Metal })
	Arena.addRibbon(f, CFrame.new(W(0, 1.4, tz - 1.11)), Vector3.new(21.6, 2.3, 0.02), Enum.NormalId.Front, CONFIG.GameName .. "   *   " .. CONFIG.ArenaName .. "   *   PLAY HARD", 14)
	local function chair(pos: Vector3, facing: Vector3, color: Color3)
		local cf = CFrame.lookAt(pos, pos + facing)
		part(f, { Name = "Chair", Size = Vector3.new(1.4, 0.22, 1.3), CFrame = cf * CFrame.new(0, 1.3, 0), Color = color, Material = Enum.Material.Leather }, true)
		part(f, { Name = "Chair", Size = Vector3.new(1.4, 1.5, 0.18), CFrame = cf * CFrame.new(0, 2.05, 0.6), Color = color, Material = Enum.Material.Leather }, true)
		part(f, { Name = "ChairBase", Size = Vector3.new(1.1, 1.2, 1.0), CFrame = cf * CFrame.new(0, 0.6, 0), Color = Color3.fromRGB(28, 28, 32), Material = Enum.Material.Metal }, true)
	end
	for i = -4, 4 do
		chair(W(i * 2.3, 0, tz + 2.1), Vector3.new(0, 0, -1), Color3.fromRGB(22, 22, 26))
	end
	for _, s in ipairs({ 1, -1 }) do
		for i = 0, 11 do
			chair(W(s * (14 + i * 1.8), 0, half + 3.6), Vector3.new(0, 0, -1), s > 0 and TEAM.Crimson or TEAM.Royal)
		end
		part(f, {
			Name = "Cooler", Shape = Enum.PartType.Cylinder, Size = Vector3.new(1.5, 1.2, 1.2),
			CFrame = CFrame.new(W(s * 36.6, 0.75, half + 3.6)) * CFrame.Angles(0, 0, math.pi / 2),
			Color = Color3.fromRGB(238, 118, 28), Material = Enum.Material.Plastic,
		}, true)
	end
	-- Courtside seats on the far sideline, mostly full
	for i = -15, 15 do
		local pos = W(i * 2.1, 0, -(half + 3.4))
		chair(pos, Vector3.new(0, 0, 1), Color3.fromRGB(22, 22, 26))
		if RNG:NextNumber() < math.min(1, CONFIG.CrowdDensity + 0.3) then
			addFan(fans, pos + Vector3.new(0, 1.41, 0.05), Vector3.new(0, 0, 1), false)
		end
	end
end

function Arena.buildBanners(m: Model)
	local f = new("Folder", { Name = "Banners", Parent = m })
	for i, year in ipairs({ "2016", "2018", "2019", "2022", "2024" }) do
		local b = part(f, { Name = "Banner", Size = Vector3.new(0.15, 7.2, 4.2), CFrame = CFrame.new(W(79.5, 44, (i - 3) * 6.2)), Color = TEAM.Crimson, Material = Enum.Material.Fabric }, true)
		paintText(b, Enum.NormalId.Left, "CHAMPIONS\n" .. year, TEAM.Gold)
	end
	for i, num in ipairs({ "1", "8", "23", "33" }) do
		local b = part(f, { Name = "Banner", Size = Vector3.new(0.15, 7.2, 4.2), CFrame = CFrame.new(W(-79.5, 44, (i - 2.5) * 6.2)), Color = TEAM.Royal, Material = Enum.Material.Fabric }, true)
		paintText(b, Enum.NormalId.Right, num, TEAM.White)
	end
	-- LED ribbon boards around the bowl
	for _, s in ipairs({ 1, -1 }) do
		Arena.addRibbon(f, CFrame.new(W(0, 15.6, s * 69.9)), Vector3.new(140, 1.8, 0.2), s > 0 and Enum.NormalId.Front or Enum.NormalId.Back, "LET'S GO KINGS   *   " .. CONFIG.ArenaName .. "   *   DEFENSE   *   MAKE SOME NOISE", 26)
		Arena.addRibbon(f, CFrame.new(W(s * 79.9, 10.6, 0)), Vector3.new(0.2, 1.8, 120), s > 0 and Enum.NormalId.Left or Enum.NormalId.Right, CONFIG.GameName .. "   *   " .. CONFIG.ArenaName, 22)
	end
end

function Arena.build()
	local old = Workspace:FindFirstChild("CourtKingsArena")
	if old then
		old:Destroy()
	end
	local m = new("Model", { Name = "CourtKingsArena" })
	Arena.model = m
	Arena.buildFloor(m)
	local hoopsF = new("Folder", { Name = "Hoops", Parent = m })
	Arena.hoops = { Arena.buildHoop(hoopsF, 1), Arena.buildHoop(hoopsF, -1) }
	Arena.mainHoop = Arena.hoops[1]
	Arena.buildShell(m)
	Arena.buildLights(m)
	Arena.buildJumbotron(m)
	Arena.buildCourtside(m)
	Arena.buildBanners(m)
	m.Parent = Workspace
end

-- Scoreboard / shot clocks ------------------------------------------------------
function Arena.setBoard(home: number, away: number, clockText: string, msg: string)
	local L = Arena.boardLabels
	for i = 1, #L.home do
		L.home[i].Text = tostring(home)
		L.away[i].Text = tostring(away)
		L.clock[i].Text = clockText
		L.msg[i].Text = msg
	end
end

function Arena.setShotClocks(text: string)
	for _, hoop in ipairs(Arena.hoops) do
		for _, lbl in ipairs(hoop.ClockLabels) do
			lbl.Text = text
		end
	end
end

function Arena.flashLeds(on: boolean)
	for _, hoop in ipairs(Arena.hoops) do
		for _, led in ipairs(hoop.Leds) do
			led.Transparency = on and 0 or 1
		end
	end
end

-- Crowd jumps for big plays (moved in bulk, 30 times a second, for 2 seconds)
function Arena.cheer(power: number)
	if Arena.cheering or #Arena.crowd == 0 then
		return
	end
	Arena.cheering = true
	local parts, base, phase = {}, {}, {}
	for i = 1, #Arena.crowd - 1, 2 do
		if RNG:NextNumber() < 0.3 + 0.35 * power then
			local ph = RNG:NextNumber(0, math.pi * 2)
			for k = 0, 1 do
				local p = Arena.crowd[i + k]
				table.insert(parts, p)
				table.insert(base, p.CFrame)
				table.insert(phase, ph)
			end
		end
	end
	task.spawn(function()
		local t0 = os.clock()
		local cfs = table.create(#parts)
		while os.clock() - t0 < 2 do
			local t = os.clock() - t0
			local fade = 1 - t / 2
			for k = 1, #parts do
				local h = math.max(0, math.sin(t * 8 + phase[k])) * 0.4 * fade
				cfs[k] = base[k] + Vector3.new(0, h, 0)
			end
			Workspace:BulkMoveTo(parts, cfs, Enum.BulkMoveMode.FireCFrameChanged)
			task.wait(1 / 30)
		end
		Workspace:BulkMoveTo(parts, base, Enum.BulkMoveMode.FireCFrameChanged)
		Arena.cheering = false
	end)
end

-- Net swish + rim shake animations (only run for a moment after a basket)
Arena.animating = {}
function Arena.swish(hoop: any, strength: number)
	hoop.Net.anim = { t0 = os.clock(), strength = strength }
	Arena.animating[hoop] = true
end
function Arena.shakeRim(hoop: any, strength: number)
	hoop.rimAnim = { t0 = os.clock(), strength = strength }
	Arena.animating[hoop] = true
end
function Arena.update()
	local now = os.clock()
	for hoop in pairs(Arena.animating) do
		local busy = false
		local na = hoop.Net.anim
		if na then
			local t = now - na.t0
			if t < 1.1 then
				local k = t / 1.1
				hoop.Net.offset = math.sin(math.min(k * 3, 1) * math.pi / 2) * (1 - k) * na.strength
				hoop.Net.sway = 0.12 * (1 - k) * na.strength
				Arena.layoutNet(hoop, t)
				busy = true
			else
				hoop.Net.anim = nil
				hoop.Net.offset, hoop.Net.sway = 0, 0
				Arena.layoutNet(hoop, 0)
			end
		end
		local ra = hoop.rimAnim
		if ra then
			local t = now - ra.t0
			local drop = 0
			if t < 0.6 then
				drop = math.exp(-t * 7) * math.cos(t * 38) * 0.12 * ra.strength
				busy = true
			else
				hoop.rimAnim = nil
			end
			for i, p in ipairs(hoop.Rim) do
				p.CFrame = hoop.RimBase[i] - Vector3.new(0, drop, 0)
			end
		end
		if not busy then
			Arena.animating[hoop] = nil
		end
	end
end

--==============================================================================
-- 7. SOUND
--==============================================================================
local Sound = {}

function Sound.play(key: string, parent: Instance?, volume: number?, pitch: number?)
	local id = SOUNDS[key]
	if not hasAsset(id) then
		return
	end
	local s = new("Sound", {
		SoundId = id, Volume = volume or 0.6, PlaybackSpeed = pitch or 1,
		RollOffMinDistance = 8, RollOffMaxDistance = 160, Parent = parent or Workspace,
	})
	s:Play()
	task.delay(5, function()
		s:Destroy()
	end)
end

--==============================================================================
-- 8. THE BALL
--==============================================================================
local Ball = { holder = nil, free = true, drib = nil, queued = nil, spin = 0, lastTouch = nil, needsRestart = false }

function Ball.create(parent: Instance)
	local d = GEO.BallR * 2
	local p = Instance.new("Part")
	p.Name = "Basketball"
	p.Shape = Enum.PartType.Ball
	p.Size = Vector3.new(d, d, d)
	p.Material = Enum.Material.Leather
	p.Color = TEAM.Ball
	p.CustomPhysicalProperties = PhysicalProperties.new(0.55, 0.65, 0.82, 1, 100)
	p.CFrame = CFrame.new(W(0, 3, 0))
	-- Black seams: thin discs a hair wider than the ball, so only their edges show
	local R = GEO.BallR
	local seams = {
		{ CFrame.new(), R },
		{ CFrame.Angles(0, math.pi / 2, 0), R },
		{ CFrame.new(R * 0.58, 0, 0), math.sqrt(R * R - (R * 0.58) ^ 2) },
		{ CFrame.new(-R * 0.58, 0, 0), math.sqrt(R * R - (R * 0.58) ^ 2) },
	}
	for i, sd in ipairs(seams) do
		local seam = Instance.new("Part")
		seam.Name = "Seam" .. i
		seam.Shape = Enum.PartType.Cylinder
		seam.Size = Vector3.new(0.014, sd[2] * 2 + 0.008, sd[2] * 2 + 0.008)
		seam.Color = Color3.fromRGB(30, 20, 14)
		seam.Material = Enum.Material.SmoothPlastic
		seam.CanCollide = false
		seam.CanTouch = false
		seam.CanQuery = false
		seam.CastShadow = false
		seam.Massless = true
		seam.CFrame = p.CFrame * sd[1]
		new("WeldConstraint", { Part0 = p, Part1 = seam, Parent = seam })
		seam.Parent = p
	end
	p.Parent = parent
	Ball.part = p
	Ball.lastPos = p.Position
	Ball.prevVy = 0
end

-- Root frame (yaw only), predicted one frame ahead so the ball keeps up with a sprinting player
local function holdFrame(a: any, dt: number): CFrame
	local root = a.root
	local look = root.CFrame.LookVector
	local yaw = math.atan2(-look.X, -look.Z)
	local pos = root.Position + root.AssemblyLinearVelocity * dt
	return CFrame.new(pos) * CFrame.Angles(0, yaw, 0)
end

-- Start one dribble: push down, bounce off the floor, catch at the top.
-- Pound timing comes from real physics (gravity + the ball's 0.8 bounce).
function Ball.startDribble(a: any, style: string, fromWorld: Vector3?)
	local H = a.height
	local s = H / 5.2
	local g = Workspace.Gravity
	local R = GEO.BallR
	local side = (Ball.drib and Ball.drib.newSide) or 1
	local vel = a.root.AssemblyLinearVelocity
	local fwd = math.max(0, vel:Dot(a.root.CFrame.LookVector))
	local lead = clamp(fwd * 0.07, 0, 0.9)
	local yTop = clamp(0.42 * H, 1.35, 2.7) * (a.state.sprinting and 1.08 or 1)
	local c: any = { style = style, side = side, t0 = os.clock(), bounced = false, newSide = -side }
	if style == "Pound" then
		local D = yTop - R
		local vUp = math.sqrt(2 * g * D)
		local vImp = vUp / 0.8
		local v0 = math.sqrt(math.max(vImp * vImp - 2 * g * D, 0))
		c.tD, c.tU = (vImp - v0) / g, vUp / g
		c.s0 = Vector3.new(side * 0.62 * s, 0, -0.55 * s)
		c.sB = Vector3.new(side * 0.72 * s, 0, -0.85 * s - lead)
		c.sE = c.s0
		c.yTop, c.yEnd = yTop, yTop
		c.newSide = side
	elseif style == "Crossover" then
		c.tD, c.tU = 0.15, 0.24
		c.s0 = Vector3.new(side * 0.62 * s, 0, -0.55 * s)
		c.sB = Vector3.new(0, 0, -1.0 * s - lead * 0.5)
		c.sE = Vector3.new(-side * 0.62 * s, 0, -0.55 * s)
		c.yTop, c.yEnd = yTop * 0.9, yTop * 0.85
	elseif style == "BetweenLegs" then
		c.tD, c.tU = 0.16, 0.26
		c.s0 = Vector3.new(side * 0.62 * s, 0, -0.45 * s)
		c.sB = Vector3.new(0, 0, -0.12 * s)
		c.sE = Vector3.new(-side * 0.6 * s, 0, -0.4 * s)
		c.yTop, c.yEnd = yTop * 0.8, yTop * 0.85
	else -- BehindBack
		c.tD, c.tU = 0.18, 0.27
		c.s0 = Vector3.new(side * 0.66 * s, 0, -0.2 * s)
		c.sB = Vector3.new(-side * 0.12 * s, 0, 0.62 * s)
		c.sE = Vector3.new(-side * 0.62 * s, 0, -0.42 * s)
		c.yTop, c.yEnd = yTop * 0.85, yTop * 0.9
	end
	if fromWorld then -- begin exactly where the ball is now (smooth hand-off)
		local rel = holdFrame(a, 0):PointToObjectSpace(fromWorld)
		c.s0 = Vector3.new(rel.X, 0, rel.Z)
		c.yTop = clamp(fromWorld.Y - GEO.FloorY, R + 0.05, 7)
	end
	c.v0 = (R - c.yTop + 0.5 * g * c.tD * c.tD) / c.tD
	c.vU = (c.yEnd - R + 0.5 * g * c.tU * c.tU) / c.tU
	Ball.drib = c
end

-- Ball offset (root frame, xz) and height above the floor at time tau of a dribble
local function dribbleAt(c: any, tau: number): (Vector3, number)
	local g = Workspace.Gravity
	if tau <= c.tD then
		return c.s0:Lerp(c.sB, tau / c.tD), c.yTop + c.v0 * tau - 0.5 * g * tau * tau
	end
	local u = math.min(tau - c.tD, c.tU)
	return c.sB:Lerp(c.sE, u / c.tU), GEO.BallR + c.vU * u - 0.5 * g * u * u
end

function Ball.give(a: any)
	local p = Ball.part
	Ball.holder = a
	Ball.free = false
	Ball.lastTouch = a
	Ball.queued = nil
	Ball.needsRestart = false
	p.Anchored = true
	p.CanCollide = false
	Ball.drib = nil
	Ball.startDribble(a, "Pound", p.Position)
end

function Ball.release(pos: Vector3, vel: Vector3, spin: Vector3?)
	local p = Ball.part
	Ball.holder = nil
	Ball.free = true
	Ball.drib = nil
	Ball.queued = nil
	p.CFrame = CFrame.new(pos)
	p.Anchored = false
	p.CanCollide = true
	p.AssemblyLinearVelocity = vel
	p.AssemblyAngularVelocity = spin or Vector3.zero
	Ball.lastPos = pos
	Ball.prevVy = vel.Y
	Ball.freeSince = os.clock()
end

-- Where the ball sits when a shooter brings it up (in front of the forehead)
function Ball.setPoint(a: any, hf: CFrame): Vector3
	local s = a.height / 5.2
	local headY = a.head and a.head.Position.Y or a.root.Position.Y + 1.5 * s
	local p = hf * Vector3.new(a.hand * 0.2 * s, 0, -0.5 * s)
	return Vector3.new(p.X, headY + 0.12 * s, p.Z)
end

-- Called every frame before physics while someone holds the ball
function Ball.updateHeld(dt: number)
	local a = Ball.holder
	local p = Ball.part
	if not a or not a.root then
		return
	end
	local hf = holdFrame(a, dt)
	local st = a.state
	local s = a.height / 5.2
	local target
	local exact = false
	if st.shot and st.shot.carry then
		target = st.shot.carry
		exact = true
		Ball.needsRestart = true
	elseif st.charging then
		target = Ball.setPoint(a, hf)
		Ball.needsRestart = true
	elseif a.airborne then
		local c = hf * Vector3.new(a.hand * 0.3 * s, 0, -0.6 * s)
		target = Vector3.new(c.X, a.root.Position.Y + 0.25 * s, c.Z)
		Ball.needsRestart = true
	else
		if not Ball.drib or Ball.needsRestart then
			-- start the next dribble from wherever the ball is (no snapping)
			Ball.needsRestart = false
			Ball.startDribble(a, "Pound", p.Position)
		end
		local c = Ball.drib
		local tau = os.clock() - c.t0
		if tau >= c.tD and not c.bounced then
			c.bounced = true
			Sound.play("Bounce", p, 0.55, RNG:NextNumber(1.15, 1.3))
		end
		if tau >= c.tD + c.tU then
			local nextStyle = Ball.queued or "Pound"
			Ball.queued = nil
			Ball.startDribble(a, nextStyle)
			c = Ball.drib
			tau = 0
			if nextStyle ~= "Pound" and Ball.onMove then
				Ball.onMove(a, nextStyle)
			end
		end
		local off, y = dribbleAt(c, tau)
		local wp = hf * off
		target = Vector3.new(wp.X, GEO.FloorY + y, wp.Z)
		exact = true
	end
	local pos = exact and target or p.Position:Lerp(target, 1 - math.exp(-24 * dt))
	Ball.spin += dt * 11
	p.CFrame = CFrame.new(pos) * hf.Rotation * CFrame.Angles(Ball.spin, 0, 0)
end

-- How easy the ball is to poke away right now (0..1)
function Ball.exposure(holder: any, thief: any): number
	if Ball.holder ~= holder or not holder.root or not thief.root then
		return 0
	end
	local st = holder.state
	if st.charging or st.shot then
		return 0.1
	end
	local c = Ball.drib
	if not c then
		return 0.2
	end
	local _, y = dribbleAt(c, math.min(os.clock() - c.t0, c.tD + c.tU))
	local low = clamp(1 - (y - GEO.BallR) / math.max(c.yTop - GEO.BallR, 0.1), 0, 1)
	local move = c.style ~= "Pound" and 0.3 or 0
	local toThief = flat(thief.root.Position - holder.root.Position)
	local ballOff = flat(Ball.part.Position - holder.root.Position)
	local facing = 0
	if toThief.Magnitude > 0.05 and ballOff.Magnitude > 0.05 then
		facing = math.max(0, ballOff.Unit:Dot(toThief.Unit))
	end
	return clamp(0.05 + 0.35 * low + move + 0.35 * facing, 0, 1)
end

--==============================================================================
-- 9. RIGS: joints, arm IK, build scaling (works on R15 and R6)
--==============================================================================
local Rig = {}

local JOINT_NAMES = {
	R15 = {
		Root = "Root", Waist = "Waist", Neck = "Neck",
		RShoulder = "RightShoulder", RElbow = "RightElbow", RWrist = "RightWrist",
		LShoulder = "LeftShoulder", LElbow = "LeftElbow", LWrist = "LeftWrist",
		RHip = "RightHip", RKnee = "RightKnee", RAnkle = "RightAnkle",
		LHip = "LeftHip", LKnee = "LeftKnee", LAnkle = "LeftAnkle",
	},
	R6 = {
		Root = "RootJoint", Neck = "Neck",
		RShoulder = "Right Shoulder", LShoulder = "Left Shoulder",
		RHip = "Right Hip", LHip = "Left Hip",
	},
}

local BODY_PARTS = {
	"Head", "UpperTorso", "LowerTorso", "Torso",
	"LeftUpperArm", "LeftLowerArm", "LeftHand", "RightUpperArm", "RightLowerArm", "RightHand",
	"LeftUpperLeg", "LeftLowerLeg", "LeftFoot", "RightUpperLeg", "RightLowerLeg", "RightFoot",
	"Left Arm", "Right Arm", "Left Leg", "Right Leg",
}

-- Rotate vector v around unit axis k by angle a (Rodrigues)
local function rotateAround(v: Vector3, k: Vector3, a: number): Vector3
	local c, s = math.cos(a), math.sin(a)
	return v * c + k:Cross(v) * s + k * (k:Dot(v) * (1 - c))
end

local function perpendicular(v: Vector3, hint: Vector3): Vector3
	local p = hint - v * hint:Dot(v)
	if p.Magnitude < 1e-4 then
		p = Vector3.xAxis - v * v.X
		if p.Magnitude < 1e-4 then
			p = Vector3.zAxis - v * v.Z
		end
	end
	return p.Unit
end

-- Rest-pose data for one arm, measured from the rig's own joints
local function armData(j: any, side: number): any?
	local sh = side > 0 and j.RShoulder or j.LShoulder
	if not sh or not sh.Part0 or not sh.Part1 then
		return nil
	end
	local el = side > 0 and j.RElbow or j.LElbow
	local wr = side > 0 and j.RWrist or j.LWrist
	local d: any = { sh = sh, el = el, wr = wr, side = side, c0r = sh.C0.Rotation }
	d.c0rInv = d.c0r:Inverse()
	d.Ps = sh.C0.Position
	local A = sh.C0 * sh.C1:Inverse() -- upper arm (or whole R6 arm) in torso space
	if el and wr and el.Part1 and wr.Part1 then
		local B = el.C0 * el.C1:Inverse()
		local handLen = wr.Part1.Size.Y * 0.5
		local Pe = A * el.C0.Position
		local Ph = (A * B) * (wr.C0.Position - Vector3.new(0, handLen, 0))
		d.u0 = Pe - d.Ps
		d.f0 = Ph - Pe
		d.hinge = (A * el.C0).RightVector
		d.twoBone = true
		local function len(flex: number): number
			return (d.u0 + rotateAround(d.f0, d.hinge, flex)).Magnitude
		end
		d.len = len
		d.maxLen = len(0)
		d.minLen = len(2.5)
		d.reach = d.maxLen
	else
		local arm = sh.Part1
		d.f0 = A * Vector3.new(0, -arm.Size.Y / 2, 0) - d.Ps
		d.twoBone = false
		d.reach = d.f0.Magnitude
	end
	return d
end

-- Shoulder rotation (torso space) + elbow flex that put the hand on `target` (torso space).
-- `pole` says where the elbow should point.
function Rig.solveArm(d: any, target: Vector3, pole: Vector3): (CFrame?, number)
	local D = target - d.Ps
	local dist = D.Magnitude
	if dist < 1e-3 then
		return nil, 0
	end
	local h, flex = nil, 0
	if d.twoBone then
		dist = clamp(dist, d.minLen + 0.002, d.maxLen - 0.002)
		local lo, hi = 0, 2.5
		for _ = 1, 14 do
			local mid = (lo + hi) / 2
			if d.len(mid) > dist then
				lo = mid
			else
				hi = mid
			end
		end
		flex = (lo + hi) / 2
		h = d.u0 + rotateAround(d.f0, d.hinge, flex)
	else
		h = d.f0
	end
	local a1 = h.Unit
	local a2 = d.twoBone and perpendicular(a1, d.u0) or perpendicular(a1, Vector3.zAxis)
	local b1 = D.Unit
	local b2 = d.twoBone and perpendicular(b1, pole) or perpendicular(b1, pole)
	local MA = CFrame.fromMatrix(Vector3.zero, a1, a2, a1:Cross(a2))
	local MB = CFrame.fromMatrix(Vector3.zero, b1, b2, b1:Cross(b2))
	return MB * MA:Inverse(), flex
end

function Rig.refresh(a: any)
	a.j = Rig.joints(a.model, a.rig)
	a.arms = { [1] = armData(a.j, 1), [-1] = armData(a.j, -1) }
	a.c0r = {}
	for _, m in pairs(a.j) do
		a.c0r[m] = m.C0.Rotation
	end
	a.legLen = 2
	local j = a.j
	if a.rig == "R15" and j.RHip and j.RKnee and j.RAnkle then
		local thigh = (j.RKnee.C0.Position - j.RHip.C1.Position).Magnitude
		local shin = (j.RAnkle.C0.Position - j.RKnee.C1.Position).Magnitude
		a.legLen = math.max(thigh + shin, 0.5)
	end
end

function Rig.joints(model: Model, rig: string): any
	local found = {}
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("Motor6D") and not found[d.Name] then
			found[d.Name] = d
		end
	end
	local j = {}
	for key, name in pairs(JOINT_NAMES[rig]) do
		j[key] = found[name]
	end
	return j
end

-- Height from the floor to the top of the head
function Rig.measure(a: any): number
	local root, head, hum = a.root, a.head, a.hum
	if not root or not head or not hum then
		return 5
	end
	local ground
	if a.rig == "R15" then
		ground = hum.HipHeight + root.Size.Y / 2
	else
		local leg = a.model:FindFirstChild("Right Leg")
		ground = root.Size.Y / 2 + (leg and leg.Size.Y or 2)
	end
	a.groundOffset = ground
	local top = head.Position.Y + head.Size.Y / 2
	return math.max(top - (root.Position.Y - ground), 1)
end

-- Paint skin (and an optional uniform: jersey, shorts, shoes)
function Rig.colorize(a: any, skin: Color3, uniform: any?)
	local bc = a.model:FindFirstChildOfClass("BodyColors")
	if bc then
		if uniform then
			bc:Destroy()
		else
			bc.HeadColor3, bc.TorsoColor3 = skin, skin
			bc.LeftArmColor3, bc.RightArmColor3 = skin, skin
			bc.LeftLegColor3, bc.RightLegColor3 = skin, skin
		end
	end
	for _, name in ipairs(BODY_PARTS) do
		local p = a.model:FindFirstChild(name)
		if p and p:IsA("BasePart") then
			local c = skin
			if uniform then
				if name == "UpperTorso" or name == "LowerTorso" or name == "Torso" then
					c = uniform.jersey
				elseif name == "LeftUpperLeg" or name == "RightUpperLeg" or name == "Left Leg" or name == "Right Leg" then
					c = uniform.shorts
				elseif name == "LeftFoot" or name == "RightFoot" then
					c = uniform.shoes
				end
			end
			p.Color = c
		end
	end
end

-- Resize the real avatar to the build's height (and width on R15)
function Rig.applyBuild(a: any, build: any, uniform: any?)
	local st = Stats.derive(build)
	a.build, a.stats = st.Build, st
	a.buildToken = (a.buildToken or 0) + 1
	local token = a.buildToken
	local hum = a.hum
	hum.UseJumpPower = false
	hum.JumpHeight = st.JumpStuds
	Rig.colorize(a, SKIN_TONES[st.Build.Skin], uniform)
	task.spawn(function()
		if a.rig == "R15" then
			local function value(name: string): NumberValue
				local v = hum:FindFirstChild(name)
				if not v then
					v = new("NumberValue", { Name = name, Value = 1, Parent = hum })
				end
				return v :: NumberValue
			end
			value("BodyWidthScale").Value = st.WidthScale
			value("BodyDepthScale").Value = clamp(0.92 + (st.WidthScale - 1) * 0.8, 0.8, 1.2)
			local hv = value("BodyHeightScale")
			for _ = 1, 4 do
				task.wait(0.05)
				if token ~= a.buildToken or not a.model.Parent then
					return
				end
				local ratio = st.HeightStuds / Rig.measure(a)
				if math.abs(ratio - 1) < 0.006 then
					break
				end
				hv.Value = clamp(hv.Value * ratio, 0.5, 2.2)
			end
			task.wait(0.05)
		else
			local ok = pcall(function()
				a.model:ScaleTo(clamp(a.model:GetScale() * st.HeightStuds / Rig.measure(a), 0.5, 2.5))
			end)
			if not ok then
				warn("[Court Kings] Could not scale this R6 avatar.")
			end
		end
		if token == a.buildToken and a.model.Parent then
			Rig.colorize(a, SKIN_TONES[st.Build.Skin], uniform)
			a.height = Rig.measure(a)
			Rig.refresh(a)
		end
	end)
end

-- Keep the ball from bumping into this body (it passes through people; catches use reach)
function Rig.ignoreBall(a: any)
	local folder = new("Folder", { Name = "CK_NoCollide", Parent = a.model })
	local function add(p: Instance)
		if p:IsA("BasePart") and Ball.part then
			new("NoCollisionConstraint", { Part0 = Ball.part, Part1 = p, Parent = folder })
		end
	end
	for _, d in ipairs(a.model:GetDescendants()) do
		add(d)
	end
	table.insert(a.conns, a.model.DescendantAdded:Connect(add))
end

-- Lets the game turn a player to face something (defense, shooting)
function Rig.setupFacing(a: any)
	local att = new("Attachment", { Name = "CK_Face", Parent = a.root })
	a.align = new("AlignOrientation", {
		Name = "CK_Face", Mode = Enum.OrientationAlignmentMode.OneAttachment, Attachment0 = att,
		MaxTorque = 1e6, Responsiveness = 30, RigidityEnabled = false, Enabled = false, Parent = a.root,
	})
end

-- Uploaded animations from the ANIMATIONS table (optional)
function Rig.loadCustom(a: any)
	a.custom = {}
	local animator = a.hum:FindFirstChildOfClass("Animator") or new("Animator", { Parent = a.hum })
	a.animator = animator
	for name, ids in pairs(ANIMATIONS) do
		local id = ids[a.rig]
		if hasAsset(id) then
			local ok, track = pcall(function()
				return animator:LoadAnimation(new("Animation", { AnimationId = id }))
			end)
			if ok and track then
				local looped = name == "Dribble" or name == "Sprint" or name == "SprintWithBall" or name == "Defense"
				track.Looped = looped
				track.Priority = looped and Enum.AnimationPriority.Movement or Enum.AnimationPriority.Action
				a.custom[name] = track
			end
		end
	end
	if not a.custom.SprintWithBall then
		a.custom.SprintWithBall = a.custom.Sprint
	end
end

-- Default Roblox walk/run/idle animations for the CPU player (it has no Animate script)
local DEFAULT_LOCO = {
	R15 = { idle = "rbxassetid://507766666", walk = "rbxassetid://507777826", run = "rbxassetid://507767714", jump = "rbxassetid://507765000", fall = "rbxassetid://507767968" },
	R6 = { idle = "rbxassetid://180435571", walk = "rbxassetid://180426354", run = "rbxassetid://180426354", jump = "rbxassetid://125750702", fall = "rbxassetid://180436148" },
}

function Rig.readAnimateIds(model: Model, rig: string): any
	local ids = table.clone(DEFAULT_LOCO[rig])
	local animate = model:FindFirstChild("Animate")
	if animate then
		for key in pairs(ids) do
			local folder = animate:FindFirstChild(key)
			local anim = folder and folder:FindFirstChildOfClass("Animation")
			if anim and anim.AnimationId ~= "" then
				ids[key] = anim.AnimationId
			end
		end
	end
	return ids
end

function Rig.setupLoco(a: any, ids: any)
	a.loco = {}
	for key, id in pairs(ids) do
		local ok, track = pcall(function()
			return a.animator:LoadAnimation(new("Animation", { AnimationId = id }))
		end)
		if ok and track then
			track.Priority = Enum.AnimationPriority.Core
			track.Looped = key ~= "jump"
			a.loco[key] = track
		end
	end
	a.locoState = nil
end

function Rig.updateLoco(a: any)
	if not a.loco then
		return
	end
	local want, speed = "idle", 1
	local v = a.root.AssemblyLinearVelocity
	local horiz = flat(v).Magnitude
	if a.airborne then
		want = v.Y > 0 and "jump" or "fall"
	elseif horiz > 7 then
		want, speed = "run", horiz / 16
	elseif horiz > 0.6 then
		want, speed = "walk", horiz / 8
	end
	if want ~= a.locoState then
		local old = a.locoState and a.loco[a.locoState]
		if old then
			old:Stop(0.2)
		end
		local t = a.loco[want]
		if t then
			t:Play(0.2)
		end
		a.locoState = want
	end
	local t = a.loco[want]
	if t and (want == "run" or want == "walk") then
		t:AdjustSpeed(clamp(speed, 0.4, 1.6))
	end
end

--==============================================================================
-- 10. PROCEDURAL ANIMATION (layers on top of Roblox's own walk/run animations)
--     Works on R15 and R6. Uploaded ANIMATIONS replace the matching layer.
--==============================================================================
local Anim = {}

-- Writes one joint. `offset` is added in the joint's parent-part space.
-- `override` is a full pose (from IK) mixed in by `weight`.
-- Remembers what it wrote so nothing piles up when no animation touches the joint.
local function writeJoint(a: any, m: Motor6D?, offset: CFrame?, override: CFrame?, weight: number?)
	if not m then
		return
	end
	local last = a.lastWritten[m]
	local cur = m.Transform
	local base = (last ~= nil and cur == last) and a.lastBase[m] or cur
	local t = base
	if override and weight and weight > 0.001 then
		t = base:Lerp(override, math.min(weight, 1))
	end
	if offset then
		local r = a.c0r[m]
		if r then
			t = (r:Inverse() * offset * r) * t
		else
			t = offset * t
		end
	end
	m.Transform = t
	a.lastBase[m] = base
	a.lastWritten[m] = t
end

-- World CFrame of the part the shoulders hang from, this frame
function Anim.torsoFrame(a: any, dt: number): CFrame
	local j = a.j
	local rootCF = a.root.CFrame + a.root.AssemblyLinearVelocity * dt
	if a.rig == "R15" and j.Root and j.Waist then
		local lower = rootCF * j.Root.C0 * j.Root.Transform * j.Root.C1:Inverse()
		return lower * j.Waist.C0 * j.Waist.Transform * j.Waist.C1:Inverse()
	elseif j.Root then
		return rootCF * j.Root.C0 * j.Root.Transform * j.Root.C1:Inverse()
	end
	return rootCF
end

local function layer(a: any, name: string, on: boolean, dt: number, rate: number?): number
	local v = approach(a.w[name] or 0, on and 1 or 0, rate or 14, dt)
	a.w[name] = v
	return v
end

function Anim.update(a: any, dt: number)
	if not a.j or not a.root or not a.hum or a.hum.Health <= 0 then
		return
	end
	local st = a.state
	local now = os.clock()
	local holding = Ball.holder == a
	local shot = st.shot
	local custom = a.custom or {}
	local c = holding and Ball.drib or nil
	local moving = c ~= nil and c.style ~= "Pound"
	local hold = layer(a, "hold", holding and not st.charging and shot == nil and not a.airborne and custom.Dribble == nil, dt)
	local set = layer(a, "set", (st.charging or (shot ~= nil and not shot.released)) and custom.Shoot == nil, dt, 18)
	layer(a, "follow", shot ~= nil and shot.released == true and now - shot.releasedAt < 0.75 and custom.Shoot == nil, dt, 18)
	local defense = layer(a, "defense", st.guard and not holding and custom.Defense == nil, dt)
	layer(a, "contest", now < st.contestUntil, dt, 18)
	layer(a, "steal", now - st.stealAt < 0.3 and custom.Steal == nil, dt, 30)
	layer(a, "celebrate", now < st.celebrateUntil and custom.Celebrate == nil, dt)
	local sprint = layer(a, "sprint", st.sprinting and a.speed > 6, dt)
	local moveW = layer(a, "move", moving and (c == nil or custom[c.style] == nil), dt, 20)

	local s = a.height / 5.2
	local crouch = 0.14 * hold + 0.42 * defense + 0.16 * moveW
	if st.charging then
		crouch += 0.2 + 0.2 * (st.charge or 0)
	end
	if shot and not shot.jumped then
		crouch += 0.3
	end
	if a.airborne then
		crouch = 0
	end
	local lean = math.rad(9) * hold + math.rad(18) * defense + math.rad(12) * sprint + math.rad(4) * set + math.rad(10) * moveW
	a.crouch = approach(a.crouch or 0, crouch * s, 14, dt)
	a.lean = approach(a.lean or 0, lean, 10, dt)

	Anim.body(a, c)
	local tf = Anim.torsoFrame(a, dt)
	Anim.arms(a, tf, now)
	Anim.head(a, tf, dt)
end

function Anim.body(a: any, c: any?)
	local j = a.j
	local cr, lean = a.crouch, a.lean
	local split, twist, sway = 0, 0, 0
	if c and c.style ~= "Pound" then
		local k = clamp((os.clock() - c.t0) / (c.tD + c.tU), 0, 1)
		local bump = math.sin(k * math.pi) * a.w.move
		if c.style == "Crossover" then
			sway = -c.side * 0.2 * math.cos(k * math.pi) * a.w.move
		elseif c.style == "BetweenLegs" then
			split = 0.5 * bump
		else
			twist = c.side * 0.45 * bump
		end
	end
	if a.rig == "R15" then
		local th = math.acos(clamp(1 - cr / a.legLen, -1, 1))
		writeJoint(a, j.Root, CFrame.new(0, -cr, 0) * CFrame.Angles(-lean * 0.6, twist * 0.5, sway))
		writeJoint(a, j.Waist, CFrame.Angles(-lean * 0.4, twist * 0.5, 0))
		local hip = th + lean * 0.6
		writeJoint(a, j.RHip, CFrame.Angles(hip + split, 0, -sway))
		writeJoint(a, j.LHip, CFrame.Angles(hip - split * 0.6, 0, -sway))
		writeJoint(a, j.RKnee, CFrame.Angles(-2 * th - split * 0.5, 0, 0))
		writeJoint(a, j.LKnee, CFrame.Angles(-2 * th, 0, 0))
		writeJoint(a, j.RAnkle, CFrame.Angles(th, 0, 0))
		writeJoint(a, j.LAnkle, CFrame.Angles(th, 0, 0))
	else
		writeJoint(a, j.Root, CFrame.Angles(-lean, twist, sway))
		writeJoint(a, j.RHip, CFrame.Angles(lean + split, 0, -sway))
		writeJoint(a, j.LHip, CFrame.Angles(lean - split * 0.6, 0, -sway))
	end
end

-- Picks a hand target for one arm (world space) from the strongest active layer
local function armGoal(a: any, side: number, d: any, tf: CFrame, now: number): (Vector3?, Vector3?, number)
	local w = a.w
	local s = a.height / 5.2
	local R = GEO.BallR
	local bp = Ball.part.Position
	if w.steal > 0.01 and a.stealSide == side then
		return bp, Vector3.new(side * 0.5, -0.6, 0.6), w.steal
	end
	local shootW = math.max(w.set, w.follow)
	if shootW > 0.01 and (Ball.holder == a or w.follow > 0.01) then
		local fwd, right = tf.LookVector, tf.RightVector
		local up = Vector3.yAxis
		local shot = a.state.shot
		if side == a.hand then
			if w.follow > w.set and shot and shot.releasePos then
				return shot.releasePos + fwd * 0.35 * s + up * 0.1, Vector3.new(side * 0.25, -1, -0.5), shootW
			end
			return bp - fwd * R * 0.95 - up * R * 0.35, Vector3.new(side * 0.25, -1, -0.45), shootW
		end
		if w.follow > w.set then
			return tf * (d.Ps + Vector3.new(side * 0.2, d.reach * 0.75, -0.3)), Vector3.new(side * 0.7, -0.6, 0.2), shootW * 0.8
		end
		return bp + right * side * R * 1.05, Vector3.new(side * 0.6, -0.8, -0.2), shootW
	end
	if w.hold > 0.01 and Ball.holder == a then
		local c = Ball.drib
		local ballSide = a.hand
		if c then
			ballSide = (now - c.t0 < c.tD) and c.side or c.newSide
		end
		if side == ballSide then
			local top = bp + Vector3.new(0, R + 0.05, 0)
			local lowY = (tf * d.Ps).Y - d.reach * 0.92
			if top.Y < lowY then
				top = Vector3.new(top.X, lowY, top.Z)
			end
			return top, Vector3.new(side * 0.7, -0.2, 0.7), w.hold
		end
		return tf * (d.Ps + Vector3.new(side * 0.2, -d.reach * 0.55, -d.reach * 0.6)), Vector3.new(side * 0.8, -0.3, 0.4), w.hold * 0.85
	end
	if w.contest > 0.01 then
		return tf * (d.Ps + Vector3.new(side * 0.12, d.reach * 0.97, -0.3)), Vector3.new(side * 0.6, 0, 0.6), w.contest
	end
	if w.celebrate > 0.01 and side == a.hand then
		local pump = math.sin(now * 9) * 0.15
		return tf * (d.Ps + Vector3.new(side * 0.15, d.reach * (0.65 + pump), -0.15)), Vector3.new(side, 0.2, 0.3), w.celebrate
	end
	return nil, nil, 0
end

function Anim.arms(a: any, tf: CFrame, now: number)
	local w = a.w
	for _, side in ipairs({ 1, -1 }) do
		local d = a.arms[side]
		if d then
			local goal, pole, weight = armGoal(a, side, d, tf, now)
			local add = nil
			if w.defense > 0.01 then
				local wig = math.sin(now * 5 + side) * 0.08
				add = CFrame.Angles(math.rad(25) * w.defense, 0, side * (math.rad(55) + wig) * w.defense)
			end
			local solved = false
			if goal and pole and weight > 0.01 then
				local Q, flex = Rig.solveArm(d, tf:PointToObjectSpace(goal), pole)
				if Q then
					writeJoint(a, d.sh, nil, d.c0rInv * Q * d.c0r, weight)
					if d.twoBone then
						writeJoint(a, d.el, nil, CFrame.Angles(flex, 0, 0), weight)
					end
					solved = true
				end
			end
			if not solved then
				writeJoint(a, d.sh, add)
				if d.twoBone then
					writeJoint(a, d.el, add and CFrame.Angles(0.55 * w.defense, 0, 0) or nil)
				end
			end
			if d.wr then
				local flick = (side == a.hand and w.follow > 0.01) and CFrame.Angles(1.1 * w.follow, 0, 0) or nil
				writeJoint(a, d.wr, flick)
			end
		end
	end
end

-- Head turns toward whatever the player is watching (ball, rim, opponent)
function Anim.head(a: any, tf: CFrame, dt: number)
	local m = a.j.Neck
	if not m then
		return
	end
	local yaw, pitch = 0, 0
	if a.lookAt then
		local pivot = tf * m.C0.Position
		local dir = tf:VectorToObjectSpace(a.lookAt - pivot)
		if dir.Magnitude > 0.2 then
			yaw = clamp(math.atan2(-dir.X, -dir.Z), -1, 1)
			pitch = clamp(math.atan2(dir.Y, math.sqrt(dir.X * dir.X + dir.Z * dir.Z)), -0.6, 0.55)
		end
	end
	a.headYaw = approach(a.headYaw or 0, yaw, 8, dt)
	a.headPitch = approach(a.headPitch or 0, pitch, 8, dt)
	writeJoint(a, m, CFrame.Angles(0, a.headYaw, 0) * CFrame.Angles(a.headPitch, 0, 0))
end

-- Plays an uploaded animation if one exists for this action
function Anim.playCustom(a: any, name: string, speed: number?): boolean
	local t = a.custom and a.custom[name]
	if not t then
		return false
	end
	t:Play(0.1)
	if speed then
		t:AdjustSpeed(speed)
	end
	return true
end

function Anim.updateCustomLoops(a: any)
	local cu = a.custom
	if not cu then
		return
	end
	local holding = Ball.holder == a
	local function loop(name: string, on: boolean)
		local t = cu[name]
		if t then
			if on and not t.IsPlaying then
				t:Play(0.2)
			elseif not on and t.IsPlaying then
				t:Stop(0.2)
			end
		end
	end
	local sprinting = a.state.sprinting and a.speed > 6
	loop("Dribble", holding and not a.state.charging and a.state.shot == nil)
	loop("Defense", a.state.guard and not holding)
	if cu.SprintWithBall ~= cu.Sprint then
		loop("Sprint", sprinting and not holding)
		loop("SprintWithBall", sprinting and holding)
	else
		loop("Sprint", sprinting)
	end
end

--==============================================================================
-- 11. ATHLETES (you and the CPU)
--==============================================================================
local Ath = {}
local Athletes: any = { me = nil, cpu = nil }

local function freshState(): any
	return {
		sprinting = false, guard = false, charging = false, charge = 0, chargeT0 = 0, shot = nil,
		stunUntil = 0, stealAt = -10, lastSteal = -10, lastMove = -10, contestUntil = 0, celebrateUntil = 0,
		stamina = CONFIG.StaminaMax, exhausted = false,
	}
end

function Ath.new(name: string, isAI: boolean): any
	return {
		name = name, isAI = isAI, state = freshState(), w = {}, lastBase = {}, lastWritten = {}, c0r = {},
		conns = {}, hand = 1, height = 5.2, speed = 0, airborne = false, legLen = 2, arms = {}, j = {},
		stats = Stats.derive(DEFAULT_BUILD), groundOffset = 3,
	}
end

-- Hook an athlete up to a character model
function Ath.bind(a: any, model: Model): boolean
	for _, c in ipairs(a.conns) do
		c:Disconnect()
	end
	a.conns = {}
	a.model = model
	a.hum = model:WaitForChild("Humanoid", 10)
	a.root = model:WaitForChild("HumanoidRootPart", 10)
	a.head = model:WaitForChild("Head", 10)
	if not a.hum or not a.root or not a.head then
		return false
	end
	a.rig = a.hum.RigType == Enum.HumanoidRigType.R15 and "R15" or "R6"
	a.lastBase, a.lastWritten, a.w = {}, {}, {}
	a.state = freshState()
	a.crouch, a.lean = 0, 0
	Rig.refresh(a)
	a.height = Rig.measure(a)
	Rig.ignoreBall(a)
	Rig.setupFacing(a)
	Rig.loadCustom(a)
	return true
end

function Ath.alive(a: any): boolean
	return a ~= nil and a.model ~= nil and a.model.Parent ~= nil and a.hum ~= nil and a.hum.Health > 0 and a.root ~= nil
end

function Ath.pos(a: any): Vector3
	return a.root.Position
end

-- Highest point this player's hands reach right now (standing reach + jump)
function Ath.reachTop(a: any): number
	return a.head.Position.Y + a.head.Size.Y / 2 + a.height * 0.33
end

function Ath.face(a: any, point: Vector3?)
	if not a.align then
		return
	end
	if point then
		local d = flat(point - a.root.Position)
		if d.Magnitude > 0.05 then
			a.align.CFrame = CFrame.lookAt(Vector3.zero, d.Unit)
			a.align.Enabled = true
			a.hum.AutoRotate = false
		end
	elseif a.align.Enabled then
		a.align.Enabled = false
		a.hum.AutoRotate = true
	end
end

function Ath.teleport(a: any, at: Vector3, lookAt: Vector3)
	local pos = Vector3.new(at.X, GEO.FloorY + a.groundOffset + 0.05, at.Z)
	local look = Vector3.new(lookAt.X, pos.Y, lookAt.Z)
	if (look - pos).Magnitude < 0.01 then
		look = pos + Vector3.new(0, 0, -1)
	end
	a.model:PivotTo(CFrame.lookAt(pos, look))
	a.root.AssemblyLinearVelocity = Vector3.zero
	a.root.AssemblyAngularVelocity = Vector3.zero
end

function Ath.updateState(a: any, dt: number)
	local v = a.root.AssemblyLinearVelocity
	a.speed = flat(v).Magnitude
	a.airborne = a.hum.FloorMaterial == Enum.Material.Air
	local st = a.state
	if st.sprinting and a.speed > 3 and not st.exhausted then
		st.stamina -= CONFIG.StaminaDrain * a.stats.StaminaDrain * dt
		if st.stamina <= 0 then
			st.stamina = 0
			st.exhausted = true
		end
	else
		st.stamina = math.min(CONFIG.StaminaMax, st.stamina + CONFIG.StaminaRegen * dt)
		if st.exhausted and st.stamina > CONFIG.StaminaMax * 0.35 then
			st.exhausted = false
		end
	end
end

-- Real movement speed for the current situation
function Ath.speedFor(a: any): number
	local st, s = a.state, a.stats
	local sp = (st.sprinting and not st.exhausted) and s.SprintSpeed or s.JogSpeed
	if st.guard then
		sp = s.JogSpeed * (0.85 + 0.3 * s.PerimD) * CONFIG.GuardSlowdown / 0.82
	end
	if Ball.holder == a then
		sp *= CONFIG.BallSlowdown
	end
	if st.charging then
		sp *= CONFIG.ShootingSlowdown
	end
	if st.shot then
		sp *= 0.25
	end
	if os.clock() < st.stunUntil then
		sp *= 0.45
	end
	return sp
end

local CPU_UNIFORM = { jersey = TEAM.Crimson, shorts = TEAM.Crimson, shoes = Color3.fromRGB(236, 236, 236) }

-- Simple R6 rig, used only if your avatar can't be copied
function Ath.makeDummy(): Model
	local m = new("Model", { Name = "CourtKingsCPU" })
	local function body(name: string, size: Vector3): Part
		return new("Part", { Name = name, Size = size, CFrame = CFrame.new(0, 3, 0), Material = Enum.Material.SmoothPlastic, Color = SKIN_TONES[6], Parent = m })
	end
	local root = body("HumanoidRootPart", Vector3.new(2, 2, 1))
	root.Transparency = 1
	local torso = body("Torso", Vector3.new(2, 2, 1))
	local head = body("Head", Vector3.new(2, 1, 1))
	new("SpecialMesh", { MeshType = Enum.MeshType.Head, Scale = Vector3.new(1.25, 1.25, 1.25), Parent = head })
	local ra, la = body("Right Arm", Vector3.new(1, 2, 1)), body("Left Arm", Vector3.new(1, 2, 1))
	local rl, ll = body("Right Leg", Vector3.new(1, 2, 1)), body("Left Leg", Vector3.new(1, 2, 1))
	local function motor(name: string, p0: BasePart, p1: BasePart, c0: CFrame, c1: CFrame)
		new("Motor6D", { Name = name, Part0 = p0, Part1 = p1, C0 = c0, C1 = c1, Parent = p0 })
	end
	local R0 = CFrame.new(0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0)
	motor("RootJoint", root, torso, R0, R0)
	motor("Neck", torso, head, CFrame.new(0, 1, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0), CFrame.new(0, -0.5, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0))
	motor("Right Shoulder", torso, ra, CFrame.new(1, 0.5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0), CFrame.new(-0.5, 0.5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0))
	motor("Left Shoulder", torso, la, CFrame.new(-1, 0.5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0), CFrame.new(0.5, 0.5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0))
	motor("Right Hip", torso, rl, CFrame.new(1, -1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0), CFrame.new(0.5, 1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0))
	motor("Left Hip", torso, ll, CFrame.new(-1, -1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0), CFrame.new(-0.5, 1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0))
	local hum = new("Humanoid", { RigType = Enum.HumanoidRigType.R6, Parent = m })
	new("Animator", { Parent = hum })
	m.PrimaryPart = root
	return m
end

-- The CPU opponent: a copy of your avatar in a crimson uniform
function Ath.makeCpuModel(): (Model, any)
	local src = player.Character
	local clone = nil
	if src then
		local was = src.Archivable
		src.Archivable = true
		local ok, result = pcall(function()
			return src:Clone()
		end)
		src.Archivable = was
		if ok then
			clone = result
		end
	end
	if not clone then
		local dummy = Ath.makeDummy()
		return dummy, Rig.readAnimateIds(dummy, "R6")
	end
	local hum = clone:FindFirstChildOfClass("Humanoid")
	local rig = (hum and hum.RigType == Enum.HumanoidRigType.R15) and "R15" or "R6"
	local ids = Rig.readAnimateIds(clone, rig)
	for _, d in ipairs(clone:GetDescendants()) do
		if d:IsA("LuaSourceContainer") or d:IsA("ForceField") or d:IsA("Clothing") or d:IsA("ShirtGraphic")
			or string.sub(d.Name, 1, 3) == "CK_" then
			d:Destroy()
		elseif d:IsA("Accessory") and d.AccessoryType ~= Enum.AccessoryType.Hair then
			d:Destroy()
		end
	end
	clone.Name = "CourtKingsCPU"
	return clone, ids
end

function Ath.spawnCpu(build: any): any
	local old = Workspace:FindFirstChild("CourtKingsCPU")
	if old then
		old:Destroy()
	end
	local model, ids = Ath.makeCpuModel()
	local a = Ath.new("CPU", true)
	model.Parent = Workspace
	local hum = model:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
		hum.BreakJointsOnDeath = false
		hum.RequiresNeck = false
	end
	if not Ath.bind(a, model) then
		return nil
	end
	a.hand = RNG:NextNumber() < 0.2 and -1 or 1
	Rig.applyBuild(a, build, CPU_UNIFORM)
	Rig.setupLoco(a, ids)
	local torso = model:FindFirstChild("UpperTorso") or model:FindFirstChild("Torso")
	if torso then
		local g = new("SurfaceGui", { Name = "CK_Number", Face = Enum.NormalId.Back, SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud, PixelsPerStud = 60, Parent = torso })
		new("TextLabel", { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Text = tostring(RNG:NextInteger(0, 35)), TextScaled = true, Font = Enum.Font.GothamBlack, TextColor3 = Color3.new(1, 1, 1), Parent = g })
	end
	return a
end

--==============================================================================
-- 12. PLAYING: shots, layups, dunks, blocks, steals, moves, rebounds
--==============================================================================
local Play = {}
-- Filled in further down (declared here so earlier code can use them)
local Game: any, UI: any, AI: any, Controls: any, Cam: any

-- Ballistic launch that peaks `apexAbove` studs over the higher of start/target
local function launchVelocity(start: Vector3, target: Vector3, apexAbove: number): (Vector3, number)
	local g = Workspace.Gravity
	local apexY = math.max(start.Y, target.Y) + apexAbove
	local vy = math.sqrt(2 * g * math.max(apexY - start.Y, 0.01))
	local T = vy / g + math.sqrt(2 * math.max(apexY - target.Y, 0.01) / g)
	return flat(target - start) / T + Vector3.new(0, vy, 0), T
end
Play.launchVelocity = launchVelocity

function Play.startCharge(a: any)
	local st = a.state
	if Ball.holder ~= a or st.shot or st.charging then
		return
	end
	st.charging = true
	st.chargeT0 = os.clock()
	st.charge = 0
	Ath.face(a, Game.hoopFor(a).Center)
end

function Play.releaseCharge(a: any)
	local st = a.state
	if not st.charging then
		return
	end
	Play.beginShot(a, clamp((os.clock() - st.chargeT0) / CONFIG.ChargeTime, 0, 1))
end

-- Starts the shooting motion: gather, jump, release near the top of the jump
function Play.beginShot(a: any, power: number)
	local st = a.state
	if st.shot or Ball.holder ~= a then
		return
	end
	local hoop = Game.hoopFor(a)
	local pos = a.root.Position
	local d = flat(hoop.Center - pos).Magnitude
	local kind = "jumper"
	if d < 2.6 and a.stats.CanDunk and (a.speed > 4 or d < 1.8) then
		kind = "dunk"
	elseif d < 4.4 then
		kind = "layup"
	end
	st.charging = false
	st.shot = {
		kind = kind, t0 = os.clock(), power = power, d = d, hoop = hoop,
		value = (kind == "jumper" and Stats.isThree(hoop, pos)) and 3 or 2,
		jumped = false, released = false, gatherEnd = os.clock() + (kind == "jumper" and 0.1 or 0.05),
	}
	Ath.face(a, hoop.Center)
	Anim.playCustom(a, kind == "dunk" and "Dunk" or (kind == "layup" and "Layup" or "Shoot"))
end

-- Every frame while a shot is happening (before physics)
function Play.updateShot(a: any, dt: number)
	local sh = a.state.shot
	if not sh then
		return
	end
	local now = os.clock()
	if not sh.released and Ball.holder ~= a then
		a.state.shot = nil
		a.driveDir = nil
		Ath.face(a, nil)
		return
	end
	local g = Workspace.Gravity
	local s = a.height / 5.2
	if not sh.jumped and now >= sh.gatherEnd then
		sh.jumped = true
		sh.jumpT = now
		local tApex = math.sqrt(2 * g * a.stats.JumpStuds) / g
		if not a.airborne then
			if a.isAI then
				a.hum.Jump = true
			else
				a.hum:ChangeState(Enum.HumanoidStateType.Jumping)
			end
		end
		sh.releaseAt = now + tApex * (sh.kind == "jumper" and 0.92 or (sh.kind == "layup" and 0.72 or 0.98))
		sh.carryFrom = Ball.part.Position
		if sh.kind ~= "jumper" then
			-- take off toward the rim
			local toRim = flat(sh.hoop.Center - a.root.Position)
			local stopAt = sh.kind == "dunk" and 0.6 or 1.3
			if toRim.Magnitude > stopAt + 0.05 then
				a.driveDir = toRim.Unit
				a.driveSpeed = math.min((toRim.Magnitude - stopAt) / math.max(tApex, 0.2), 16)
			end
		end
	end
	if sh.jumped and not sh.released then
		local k = clamp((now - sh.jumpT) / math.max(sh.releaseAt - sh.jumpT, 0.05), 0, 1)
		local e = k * k * (3 - 2 * k)
		local hf = holdFrame(a, dt)
		local target
		if sh.kind == "jumper" then
			local p = hf * Vector3.new(a.hand * 0.12 * s, 0, -0.32 * s)
			target = Vector3.new(p.X, a.head.Position.Y + 0.55 * s, p.Z)
		elseif sh.kind == "layup" then
			-- reach toward the rim, but release in front of it (never under the iron)
			local fromRim = flat(a.root.Position - sh.hoop.Center)
			local dist = fromRim.Magnitude
			local dir = dist > 0.3 and fromRim / dist or Vector3.new(-sh.hoop.Sign, 0, 0)
			local keep = math.max(dist - 0.45 * s, GEO.RimR + GEO.BallR + 0.3)
			local p = sh.hoop.Center + dir * keep
			target = Vector3.new(p.X, math.max(Ath.reachTop(a) - 0.25, GEO.FloorY + 1), p.Z)
		else
			local back = flat(a.root.Position - sh.hoop.Center)
			back = back.Magnitude > 0.05 and back.Unit or Vector3.new(-sh.hoop.Sign, 0, 0)
			target = sh.hoop.Center + Vector3.new(0, 0.5, 0) + back * 0.3
		end
		sh.carry = sh.carryFrom:Lerp(target, e)
		if now >= sh.releaseAt then
			Play.releaseShot(a)
		end
	end
	if sh.released then
		if (not a.airborne and now - sh.releasedAt > 0.2) or now - sh.releasedAt > 2 then
			a.state.shot = nil
			a.driveDir = nil
			Ath.face(a, nil)
		end
	end
end

-- How much the other player bothers this shot (0 = wide open)
function Play.contestOn(a: any): number
	local other = Game.opponentOf(a)
	if not other or not Ath.alive(other) then
		return 0
	end
	local dpos = flat(other.root.Position - a.root.Position)
	local dist = dpos.Magnitude
	if dist > 6.5 then
		return 0
	end
	local c = (1 - dist / 6.5) * 0.26
	local hoop = a.state.shot and a.state.shot.hoop or Game.hoopFor(a)
	local toRim = flat(hoop.Center - a.root.Position)
	local between = 0
	if toRim.Magnitude > 0.1 and dist > 0.1 then
		between = clamp(dpos.Unit:Dot(toRim.Unit), 0, 1)
	end
	c *= 0.45 + 0.55 * between
	if os.clock() < other.state.contestUntil or other.airborne then
		c *= 1.45
	end
	if other.state.guard then
		c += 0.03
	end
	c += clamp((other.height - a.height) * 0.05, -0.04, 0.07)
	if other.isAI then
		c *= DIFFICULTY[Game.difficulty].contest
	end
	return clamp(c, 0, 0.45)
end

function Play.releaseShot(a: any)
	local sh = a.state.shot
	local st = a.stats
	sh.released = true
	sh.releasedAt = os.clock()
	sh.carry = nil
	local hoop = sh.hoop
	local start = Ball.part.Position
	sh.releasePos = start
	local ideal = Stats.idealPower(sh.d)
	local err = math.abs(sh.power - ideal)
	local contest = Play.contestOn(a)
	local perfect = err <= st.ShootTol * 0.35 and a.airborne
	local chance
	if sh.kind == "dunk" then
		chance = clamp(0.97 - contest * 0.9, 0.3, 0.98)
	else
		chance = Stats.shotChance(st, sh.d, err, contest, perfect, sh.kind)
	end
	local made = RNG:NextNumber() < chance
	local rim = hoop.Center
	local toRim = flat(rim - start)
	local fwd = toRim.Magnitude > 0.01 and toRim.Unit or Vector3.new(hoop.Sign, 0, 0)
	local right = fwd:Cross(Vector3.yAxis)
	local vel, spin
	local flight = 0.3
	if sh.kind == "dunk" then
		-- slam it through (or off the back iron)
		local at = rim + Vector3.new(0, 0.42, 0) - fwd * 0.05
		if made then
			Ball.release(at, Vector3.new(0, -16, 0) + fwd * 0.6, right * 6)
		else
			Ball.release(at - fwd * 0.2, Vector3.new(0, -9, 0) + fwd * 5, right * 6)
		end
		Arena.shakeRim(hoop, 1)
		Sound.play("Rim", hoop.Board, 1)
		if not a.isAI then
			Cam.addShake(0.3)
		end
	else
		local target
		if made then
			local spread = 0.11
			target = rim + right * RNG:NextNumber(-spread, spread) + fwd * RNG:NextNumber(-spread, spread * 0.5)
		else
			local short = sh.power < ideal
			if sh.kind == "jumper" and err > st.ShootTol * 1.8 then
				local off = clamp(err * sh.d * 0.7 + 0.5, 0.6, 5)
				target = rim + fwd * off * (short and -1 or 1) + right * RNG:NextNumber(-0.4, 0.4)
			else
				local ang = RNG:NextNumber(0, math.pi * 2)
				if err > st.ShootTol * 0.5 then
					ang = short and (math.pi + RNG:NextNumber(-1.1, 1.1)) or RNG:NextNumber(-1.1, 1.1)
				end
				local rr = GEO.RimR + GEO.RimTube + RNG:NextNumber(-0.06, 0.1)
				target = rim + (fwd * math.cos(ang) + right * math.sin(ang)) * rr + Vector3.new(0, GEO.BallR * 0.55, 0)
			end
		end
		-- apex height chosen for a ~45 degree entry angle, like a real jump shot
		local below = math.max(0, rim.Y - start.Y)
		local apex = sh.kind == "layup" and (0.75 + below * 0.8) or math.max(1.3, 0.22 * sh.d + 0.3)
		vel, flight = launchVelocity(start, target, apex)
		spin = right * (sh.kind == "layup" and 8 or 17)
		Ball.release(start, vel, spin)
	end
	Ball.noGrabUntil = os.clock() + 0.25
	a.noGrabUntil = os.clock() + flight + 0.1 -- can't catch your own shot before it gets there
	Game.onShotReleased(a, sh, made, chance, err, ideal, perfect, contest)
end

-- A defender's hands can deflect the ball early in its flight
function Play.checkBlock()
	local shot = Game.shot
	if not shot or shot.blocked or shot.blockChecked or not Ball.free then
		return
	end
	local age = os.clock() - shot.t0
	if age > 0.4 or Ball.part.AssemblyLinearVelocity.Y < 0 then
		shot.blockChecked = true
		return
	end
	local d = Game.opponentOf(shot.shooter)
	if not d or not Ath.alive(d) or not (d.airborne or os.clock() < d.state.contestUntil) then
		return
	end
	local bp = Ball.part.Position
	local horiz = flat(bp - d.root.Position).Magnitude
	local s = d.height / 5.2
	if horiz < 0.95 * s and bp.Y < Ath.reachTop(d) + 0.2 and bp.Y > d.head.Position.Y then
		shot.blockChecked = true
		local chance = 0.12 + 0.25 * d.stats.InteriorD + clamp((d.height - shot.shooter.height) * 0.1, -0.1, 0.15)
		if shot.kind == "dunk" then
			chance *= 0.4
		end
		if RNG:NextNumber() < chance then
			shot.blocked = true
			local away = flat(bp - shot.hoop.Center)
			away = away.Magnitude > 0.1 and away.Unit or Vector3.new(-1, 0, 0)
			local side = away:Cross(Vector3.yAxis) * RNG:NextNumber(-5, 5)
			Ball.part.AssemblyLinearVelocity = away * RNG:NextNumber(5, 9) + side + Vector3.new(0, RNG:NextNumber(1, 4), 0)
			Ball.lastTouch = d
			Game.onBlock(d, shot.shooter)
		end
	end
end

-- Can this player grab the loose ball right now? (taller and longer = more reach)
function Play.canReach(a: any): (boolean, number)
	if os.clock() < (a.noGrabUntil or 0) or a.state.shot then
		return false, math.huge
	end
	local bp = Ball.part.Position
	-- A shot in the air can only be blocked on the way up (see checkBlock). Nobody can catch it
	-- until it hits the rim or drops below rim height (this also covers goaltending).
	local shot = Game.shot
	if shot and not shot.rimTouched and not shot.blocked and bp.Y > shot.hoop.Center.Y - 0.6 then
		return false, math.huge
	end
	local horiz = flat(bp - a.root.Position).Magnitude
	local s = a.height / 5.2
	local radius = (0.95 + 0.4 * a.stats.t) * s + GEO.BallR
	if horiz <= radius and bp.Y <= Ath.reachTop(a) and bp.Y >= GEO.FloorY + 0.05 then
		return true, horiz
	end
	return false, math.huge
end

function Play.tryPickups()
	if not Ball.free or os.clock() < (Ball.noGrabUntil or 0) then
		return
	end
	local best, bestD = nil, math.huge
	for _, a in ipairs(Game.athletes()) do
		if Ath.alive(a) then
			local ok, dd = Play.canReach(a)
			if ok and dd < bestD then
				best, bestD = a, dd
			end
		end
	end
	if best then
		Game.onPickup(best)
	end
end

-- Reach in for the ball. Timing matters: low dribbles and moves are easiest to poke.
function Play.trySteal(thief: any)
	local st = thief.state
	local now = os.clock()
	local holder = Ball.holder
	if not holder or holder == thief or now - st.lastSteal < CONFIG.StealCooldown or st.shot then
		return
	end
	st.lastSteal = now
	st.stealAt = now
	local toBall = Ball.part.Position - thief.root.Position
	thief.stealSide = toBall:Dot(thief.root.CFrame.RightVector) >= 0 and 1 or -1
	Anim.playCustom(thief, "Steal")
	local reach = thief.height * 0.42 + 0.5
	if toBall.Magnitude > reach then
		if not thief.isAI then
			UI.feedback("TOO FAR", Color3.fromRGB(255, 200, 90))
		end
		return
	end
	local chance = 0.06 + thief.stats.StealSkill + 0.34 * Ball.exposure(holder, thief)
	if st.guard then
		chance += 0.06
	end
	chance -= holder.stats.Handle * 0.1 + holder.stats.Strength * 0.06
	if thief.isAI then
		chance *= 0.85 + 0.3 * DIFFICULTY[Game.difficulty].contest
	end
	if RNG:NextNumber() < clamp(chance, 0.03, 0.6) then
		Game.onSteal(thief, holder)
	else
		st.stunUntil = now + 0.55 -- reached in and missed: a step slow
		if not thief.isAI then
			UI.feedback("MISSED THE STEAL", Color3.fromRGB(255, 120, 90))
		end
	end
end

-- Queue a dribble move; it starts the next time the ball comes back to the hand
function Play.move(a: any, style: string)
	local st = a.state
	if Ball.holder ~= a or st.charging or st.shot or a.airborne then
		return
	end
	if os.clock() - st.lastMove < CONFIG.MoveCooldown then
		return
	end
	st.lastMove = os.clock()
	Ball.queued = style
end

-- When a move actually starts: maybe the defender bites on it
function Ball.onMove(a: any, style: string)
	Anim.playCustom(a, style)
	Sound.play("Squeak", a.root, 0.6)
	local d = Game.opponentOf(a)
	if not d or not Ath.alive(d) then
		return
	end
	local rel = flat(d.root.Position - a.root.Position)
	if rel.Magnitude > 4.5 or rel.Magnitude < 0.1 then
		return
	end
	if rel.Unit:Dot(a.root.CFrame.LookVector) < 0.35 then
		return
	end
	local chance = 0.14 + a.stats.Handle * 0.35 - d.stats.PerimD * 0.22
	if d.isAI then
		chance *= 1.25 - DIFFICULTY[Game.difficulty].contest * 0.35
	end
	if RNG:NextNumber() < chance then
		d.state.stunUntil = os.clock() + 0.85
		Game.onShook(a, d)
	end
end

--==============================================================================
-- 13. GAME RULES: 1v1 to 21 (half court) or SHOOTAROUND
--==============================================================================
Game = {
	mode = CONFIG.DefaultMode,
	difficulty = CONFIG.DefaultDifficulty,
	phase = "menu", -- menu | check | live | dead | over
	score = { me = 0, cpu = 0 },
	makes = 0,
	attempts = 0,
	offense = nil,
	mustClear = false,
	clock = CONFIG.ShotClock,
	clockRunning = false,
	shownClock = -1,
	shot = nil,
	frozen = true,
	token = 0,
}

function Game.after(t: number, fn: () -> ())
	Game.token += 1
	local token = Game.token
	task.delay(t, function()
		if Game.token == token then
			fn()
		end
	end)
end

function Game.athletes(): { any }
	local list = {}
	if Athletes.me and Ath.alive(Athletes.me) then
		table.insert(list, Athletes.me)
	end
	if Game.mode == "1v1" and Athletes.cpu and Ath.alive(Athletes.cpu) then
		table.insert(list, Athletes.cpu)
	end
	return list
end

function Game.opponentOf(a: any): any
	if Game.mode ~= "1v1" then
		return nil
	end
	if a == Athletes.me then
		return Athletes.cpu
	elseif a == Athletes.cpu then
		return Athletes.me
	end
	return nil
end

function Game.hoopFor(a: any): any
	if Game.mode == "1v1" or not a or not a.root then
		return Arena.mainHoop
	end
	local best, bestScore = Arena.hoops[1], -math.huge
	local look = flat(a.root.CFrame.LookVector)
	look = look.Magnitude > 0.01 and look.Unit or Vector3.new(1, 0, 0)
	for _, h in ipairs(Arena.hoops) do
		local to = flat(h.Center - a.root.Position)
		local dist = to.Magnitude
		local facing = dist > 0.1 and look:Dot(to.Unit) or 1
		local score = facing - dist / 120
		if score > bestScore then
			best, bestScore = h, score
		end
	end
	return best
end

-- Top of the key (check spot) and where the defender stands
function Game.spots(): (Vector3, Vector3)
	local h = Arena.mainHoop
	local top = h.Center + Vector3.new(-h.Sign * (GEO.ThreeR + 2.4), 0, 0)
	local def = h.Center + Vector3.new(-h.Sign * (GEO.ThreeR - 1.4), 0, 0)
	return Vector3.new(top.X, GEO.FloorY, top.Z), Vector3.new(def.X, GEO.FloorY, def.Z)
end

function Game.refreshBoard()
	local clockText = Game.mode == "1v1" and tostring(math.ceil(Game.clock)) or ""
	if Game.mode == "1v1" then
		Arena.setBoard(Game.score.me, Game.score.cpu, clockText, "FIRST TO " .. CONFIG.WinScore)
		Arena.setShotClocks(clockText)
	else
		Arena.setBoard(Game.makes, Game.attempts, "", "SHOOTAROUND")
		Arena.setShotClocks("--")
	end
	Game.shownClock = math.ceil(Game.clock)
	UI.updateScore()
end

local function resetForPlay(a: any)
	local st = a.state
	st.charging, st.shot, st.guard, st.sprinting = false, nil, false, false
	a.driveDir = nil
	Ath.face(a, nil)
end

function Game.start(mode: string, difficulty: string)
	Game.token += 1
	Game.mode, Game.difficulty = mode, difficulty
	Game.score = { me = 0, cpu = 0 }
	Game.makes, Game.attempts = 0, 0
	Game.shot, Game.mustClear = nil, false
	Game.clock = CONFIG.ShotClock
	local me = Athletes.me
	if not me or not Ath.alive(me) then
		return
	end
	UI.showHud()
	if mode == "1v1" then
		if Athletes.cpu and Athletes.cpu.model then
			Athletes.cpu.model:Destroy()
		end
		Athletes.cpu = Ath.spawnCpu(AI.randomBuild(difficulty))
		if not Athletes.cpu then
			Game.mode = "Shootaround"
			return Game.start("Shootaround", difficulty)
		end
		Game.phase = "dead"
		Game.after(0.35, function()
			Game.checkBall(RNG:NextNumber() < 0.5 and Athletes.me or Athletes.cpu)
		end)
	else
		if Athletes.cpu and Athletes.cpu.model then
			Athletes.cpu.model:Destroy()
		end
		Athletes.cpu = nil
		resetForPlay(me)
		local h = Arena.mainHoop
		local spot = h.Center + Vector3.new(-h.Sign * GEO.FTFromBase * 0.75, 0, 0)
		Ath.teleport(me, spot, h.Center)
		Ball.give(me)
		Game.phase = "live"
		Game.frozen = false
		UI.banner("SHOOTAROUND", TEAM.Gold)
	end
	Game.refreshBoard()
end

-- Both players walk back to the top; the ball is checked to `off`
function Game.checkBall(off: any)
	local def = Game.opponentOf(off)
	if not off or not Ath.alive(off) then
		return
	end
	Game.phase = "check"
	Game.offense = off
	Game.mustClear = false
	Game.shot = nil
	Game.clock = CONFIG.ShotClock
	Game.clockRunning = false
	Game.frozen = true
	local top, defSpot = Game.spots()
	local rim = Arena.mainHoop.Center
	for _, a in ipairs(Game.athletes()) do
		resetForPlay(a)
	end
	Ath.teleport(off, top, rim)
	if def and Ath.alive(def) then
		Ath.teleport(def, defSpot, top)
	end
	Ball.give(off)
	Game.refreshBoard()
	UI.banner(off.isAI and "CPU BALL" or "YOUR BALL", off.isAI and TEAM.Crimson or TEAM.Gold)
	Game.after(1.1, function()
		Game.phase = "live"
		Game.frozen = false
		Game.clockRunning = true
		UI.banner("CHECK!", Color3.new(1, 1, 1))
	end)
end

function Game.onShotReleased(a: any, sh: any, made: boolean, chance: number, err: number, ideal: number, perfect: boolean, contest: number)
	Game.shot = {
		shooter = a, value = sh.value, hoop = sh.hoop, t0 = os.clock(), made = made, kind = sh.kind,
		rimTouched = false, cleared = not (Game.mustClear and Game.offense == a),
	}
	Game.clockRunning = false
	if Game.mode == "Shootaround" then
		Game.attempts += 1
		Game.refreshBoard()
	end
	if not a.isAI then
		UI.shotFeedback(sh, err, ideal, perfect, chance, contest)
	end
end

function Game.onBallTouched(hit: BasePart)
	if not Ball.free then
		return
	end
	local name = hit.Name
	if string.sub(name, 1, 3) == "Rim" then
		if Game.shot then
			Game.shot.rimTouched = true
		end
		if os.clock() - (Game.lastRimSound or 0) > 0.15 then
			Game.lastRimSound = os.clock()
			Sound.play("Rim", Ball.part, 0.8)
		end
	elseif name == "Backboard" then
		if os.clock() - (Game.lastRimSound or 0) > 0.15 then
			Game.lastRimSound = os.clock()
			Sound.play("Backboard", Ball.part, 0.8)
		end
	end
end

-- The ball's center passes down through the rim = basket
function Game.checkScore()
	local pos = Ball.part.Position
	local prev = Ball.lastPos or pos
	Ball.lastPos = pos
	if not Ball.free then
		return
	end
	for _, h in ipairs(Arena.hoops) do
		local c = h.Center
		if prev.Y > c.Y and pos.Y <= c.Y then
			local k = (prev.Y - c.Y) / math.max(prev.Y - pos.Y, 1e-4)
			local x = prev:Lerp(pos, k)
			if flat(x - c).Magnitude < GEO.RimR - GEO.BallR * 0.15 then
				-- the net catches the ball: it drops under the rim instead of flying on
				local v = Ball.part.AssemblyLinearVelocity
				Ball.part.AssemblyLinearVelocity = Vector3.new(v.X * 0.18, math.min(v.Y, -2) * 0.5, v.Z * 0.18)
				Game.onScore(h)
			end
		end
	end
end

function Game.onScore(h: any)
	local shot = Game.shot
	Game.shot = nil
	local clean = shot ~= nil and not shot.rimTouched
	Arena.swish(h, clean and 1 or 0.6)
	if clean then
		Sound.play("Swish", h.Board, 0.9)
	end
	Ball.noGrabUntil = os.clock() + 0.8
	if Game.mode == "Shootaround" then
		Game.makes += 1
		Game.refreshBoard()
		local three = shot and shot.value == 3
		UI.banner(shot and shot.kind == "dunk" and "DUNK!" or (three and "THREE!" or (clean and "SWISH!" or "BUCKET!")), TEAM.Gold)
		Arena.cheer(0.25)
		return
	end
	if Game.phase ~= "live" or h ~= Arena.mainHoop then
		return
	end
	local scorer = shot and shot.shooter or Ball.lastTouch
	if not scorer then
		return
	end
	Game.phase = "dead"
	Game.clockRunning = false
	if shot and not shot.cleared then
		UI.banner("NO BASKET - TAKE IT BACK FIRST", TEAM.Crimson)
		Sound.play("Whistle", Workspace, 0.8)
		Game.after(1.4, function()
			Game.checkBall(Game.opponentOf(scorer))
		end)
		return
	end
	local pts = shot and shot.value or 2
	if scorer == Athletes.me then
		Game.score.me += pts
	else
		Game.score.cpu += pts
	end
	scorer.state.celebrateUntil = os.clock() + 1.3
	Anim.playCustom(scorer, "Celebrate")
	local who = scorer.isAI and "CPU" or "YOU"
	local what = (shot and shot.kind == "dunk") and "DUNK" or (pts == 3 and "THREE" or (clean and "SWISH" or "BUCKET"))
	UI.banner(string.format("%s  +%d  %s", what, pts, who), scorer.isAI and TEAM.Crimson or TEAM.Gold)
	Arena.cheer(scorer.isAI and 0.3 or 1)
	Sound.play("Cheer", Workspace, scorer.isAI and 0.4 or 0.9)
	Game.refreshBoard()
	if Game.score.me >= CONFIG.WinScore or Game.score.cpu >= CONFIG.WinScore then
		Game.after(1.6, Game.finish)
	else
		Game.after(1.5, function()
			Game.checkBall(Game.opponentOf(scorer))
		end)
	end
end

function Game.onPickup(a: any)
	local shot = Game.shot
	local prev = Game.offense
	Ball.give(a)
	if Game.mode ~= "1v1" or Game.phase ~= "live" then
		return
	end
	Game.shot = nil
	if a ~= prev then
		Game.offense = a
		Game.mustClear = true
		Game.clock = CONFIG.ShotClock
		UI.banner(a.isAI and "CPU REBOUND" or "REBOUND!  TAKE IT BACK", a.isAI and TEAM.Crimson or TEAM.Gold)
	elseif shot and shot.rimTouched then
		Game.clock = CONFIG.OffensiveReboundClock
		if not a.isAI then
			UI.feedback("OFFENSIVE BOARD", TEAM.Gold)
		end
	end
	Game.clockRunning = true
	Game.refreshBoard()
end

function Game.onSteal(thief: any, holder: any)
	Ball.give(thief)
	holder.state.stunUntil = os.clock() + 0.45
	if Game.mode ~= "1v1" then
		return
	end
	Game.offense = thief
	Game.mustClear = true
	Game.clock = CONFIG.ShotClock
	Game.clockRunning = true
	Game.shot = nil
	UI.banner(thief.isAI and "STOLEN BY CPU" or "STEAL!  TAKE IT BACK", thief.isAI and TEAM.Crimson or TEAM.Gold)
	if not thief.isAI then
		Arena.cheer(0.7)
	end
	Game.refreshBoard()
end

function Game.onBlock(blocker: any, shooter: any)
	Game.clockRunning = false
	UI.banner(blocker.isAI and "BLOCKED BY CPU" or "BLOCKED!", blocker.isAI and TEAM.Crimson or TEAM.Gold)
	if not blocker.isAI then
		Arena.cheer(0.9)
	end
	Sound.play("Backboard", Ball.part, 0.7)
end

function Game.onShook(handler: any, defender: any)
	if handler.isAI then
		UI.feedback("GOT SHOOK", TEAM.Crimson)
		Cam.addShake(0.2)
	else
		UI.banner("ANKLE BREAKER!", TEAM.Gold)
		Arena.cheer(0.6)
	end
end

function Game.turnover(to: any, reason: string)
	if Game.phase ~= "live" then
		return
	end
	Game.phase = "dead"
	Game.clockRunning = false
	Game.shot = nil
	local violation = reason == "SHOT CLOCK VIOLATION"
	Arena.flashLeds(violation)
	Sound.play(violation and "Buzzer" or "Whistle", Workspace, 0.9)
	UI.banner(reason, Color3.fromRGB(255, 110, 90))
	if Ball.holder then
		Ball.release(Ball.part.Position, Vector3.new(0, 2, 0))
	end
	Ball.noGrabUntil = os.clock() + 1.6
	Game.after(1.5, function()
		Arena.flashLeds(false)
		if to and Ath.alive(to) then
			Game.checkBall(to)
		end
	end)
end

-- Shootaround: the rebounder passes the ball back after each shot
function Game.rebounder()
	local me = Athletes.me
	if Ball.holder or not Ath.alive(me) then
		return
	end
	local bp = Ball.part.Position
	local since = os.clock() - (Ball.freeSince or 0)
	local far = flat(bp - me.root.Position).Magnitude > 5
	local settled = (since > 1.3 and Ball.part.AssemblyLinearVelocity.Magnitude < 7) or since > 4
	if far and settled then
		local from = bp + Vector3.new(0, 0.3, 0)
		local target = me.root.Position + Vector3.new(0, 0.6, 0) + flat(me.root.AssemblyLinearVelocity) * 0.5
		local vel = Play.launchVelocity(from, target, 1.2)
		Ball.release(from, vel, Vector3.zero)
		Ball.noGrabUntil = os.clock() + 0.1
	end
end

local function outOfHalfCourt(p: Vector3): boolean
	local rel = p - ORIGIN
	local h = Arena.mainHoop
	return math.abs(rel.X) > GEO.L / 2 or math.abs(rel.Z) > GEO.W / 2 or rel.X * h.Sign < 0
end

function Game.update(dt: number)
	Game.checkScore()
	if Game.phase == "menu" or Game.phase == "over" then
		return
	end
	if Game.shot then
		Play.checkBlock()
		if os.clock() - Game.shot.t0 > 4 then
			if not Game.shot.rimTouched then
				Game.clockRunning = Game.mode == "1v1" and Game.phase == "live"
			end
			Game.shot = nil
		end
	end
	if Game.mode == "Shootaround" then
		Play.tryPickups()
		Game.rebounder()
		if Ball.free and Ball.part.Position.Y < GEO.FloorY - 20 then
			Ball.release(W(0, 4, 0), Vector3.zero)
		end
		return
	end
	if Game.phase ~= "live" then
		return
	end
	Play.tryPickups()
	if Game.clockRunning then
		Game.clock -= dt
		if Game.clock <= 0 then
			Game.clock = 0
			Game.refreshBoard()
			Game.turnover(Game.opponentOf(Game.offense), "SHOT CLOCK VIOLATION")
			return
		end
		if math.ceil(Game.clock) ~= Game.shownClock then
			Game.refreshBoard()
		end
	end
	local holder = Ball.holder
	if holder then
		if outOfHalfCourt(holder.root.Position) and not holder.airborne then
			Game.turnover(Game.opponentOf(holder), "OUT OF BOUNDS")
			return
		end
		if Game.mustClear and holder == Game.offense and Stats.isThree(Arena.mainHoop, holder.root.Position) then
			Game.mustClear = false
			if not holder.isAI then
				UI.feedback("CLEARED", Color3.fromRGB(110, 255, 150))
			end
		end
	elseif Ball.free then
		local bp = Ball.part.Position
		local onFloor = bp.Y < GEO.FloorY + GEO.BallR + 0.15
		if (onFloor and outOfHalfCourt(bp)) or bp.Y < GEO.FloorY - 15 then
			local last = Ball.lastTouch or Game.offense
			Game.turnover(Game.opponentOf(last) or Athletes.me, "OUT OF BOUNDS")
		end
	end
end

function Game.finish()
	Game.token += 1
	Game.phase = "over"
	Game.frozen = true
	Game.clockRunning = false
	if Ball.holder then
		Ball.release(Ball.part.Position, Vector3.zero)
	end
	local won = Game.score.me > Game.score.cpu
	Arena.cheer(won and 1 or 0.2)
	Sound.play("Buzzer", Workspace, 0.9)
	UI.showResult(won, Game.score.me, Game.score.cpu)
end

-- Back to the menu: stop everything
function Game.stop()
	Game.token += 1
	Game.phase = "menu"
	Game.frozen = true
	Game.clockRunning = false
	Game.shot = nil
	for _, a in ipairs(Game.athletes()) do
		resetForPlay(a)
	end
	if Ball.holder then
		Ball.release(Ball.part.Position, Vector3.zero)
	end
end

--==============================================================================
-- 14. CPU OPPONENT
--==============================================================================
AI = { history = {}, nextThink = 0, lane = 0, shootAt = 0, contestFor = nil, archetype = "" }

local ARCHETYPES = {
	{ name = "SLASHER", Height = 77, Weight = 205 },
	{ name = "SHARPSHOOTER", Height = 75, Weight = 185 },
	{ name = "BIG MAN", Height = 83, Weight = 220 },
	{ name = "FLOOR GENERAL", Height = 73, Weight = 175 },
	{ name = "TWO-WAY WING", Height = 79, Weight = 210 },
}

function AI.randomBuild(difficulty: string): any
	local arch = ARCHETYPES[RNG:NextInteger(1, #ARCHETYPES)]
	AI.archetype = arch.name
	return {
		Height = arch.Height + RNG:NextInteger(-1, 1),
		Weight = arch.Weight + RNG:NextInteger(-5, 5),
		Skin = RNG:NextInteger(1, #SKIN_TONES),
	}
end

local function gaussian(): number
	local u1 = math.max(RNG:NextNumber(), 1e-6)
	return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * RNG:NextNumber())
end

-- Where the player was `delay` seconds ago: the CPU reacts to that, not to the present
local function seenPlayer(delay: number): Vector3
	local me = Athletes.me
	local target = os.clock() - delay
	for i = #AI.history, 1, -1 do
		if AI.history[i].t <= target then
			return AI.history[i].p
		end
	end
	return me.root.Position
end

function AI.offense(diff: any, now: number): (Vector3, number, boolean)
	local cpu, me = Athletes.cpu, Athletes.me
	local st = cpu.state
	local hoop = Arena.mainHoop
	local pos = cpu.root.Position
	local toRim = flat(hoop.Center - pos)
	local d = toRim.Magnitude
	cpu.lookAt = hoop.Center
	if st.shot then
		return Vector3.zero, 0, false
	end
	if st.charging then
		if now >= AI.shootAt then
			local ideal = Stats.idealPower(d)
			local sd = diff.aimSd * (1 + Play.contestOn(cpu) * 2.5)
			Play.beginShot(cpu, clamp(ideal + gaussian() * sd, 0, 1))
		end
		return Vector3.zero, 0, false
	end
	if Game.mustClear and Game.offense == cpu then
		local top = Game.spots()
		local back = flat(top - pos)
		if back.Magnitude > 0.6 then
			return back.Unit, 1, true
		end
		return Vector3.zero, 0, false
	end
	local rel = flat(me.root.Position - pos)
	local defDist = rel.Magnitude
	local dirRim = d > 0.05 and toRim.Unit or Vector3.new(hoop.Sign, 0, 0)
	local inFront = defDist > 0.1 and rel.Unit:Dot(dirRim) > 0.45 and flat(hoop.Center - me.root.Position).Magnitude < d
	local beaten = now < me.state.stunUntil
	if now >= AI.nextThink then
		AI.nextThink = now + 0.15
		local contest = Play.contestOn(cpu)
		local value = Stats.isThree(hoop, pos) and 3 or 2
		local kind = d < 4.4 and "layup" or "jumper"
		local expect = Stats.shotChance(cpu.stats, d, diff.aimSd * 0.8, contest, false, kind) * value
		if d < 2.6 or (d < 4.4 and (not inFront or defDist > 2.5 or beaten)) then
			Play.beginShot(cpu, Stats.idealPower(d))
			return Vector3.zero, 0, false
		elseif Game.clock < 3 or (expect >= diff.shotIQ and d <= CONFIG.MaxShotRange * 0.7) then
			st.charging = true
			st.chargeT0 = now
			AI.shootAt = now + RNG:NextNumber(0.25, 0.45)
			Ath.face(cpu, hoop.Center)
			return Vector3.zero, 0, false
		end
		if inFront and defDist < 3.6 and now - st.lastMove > 1.2 and RNG:NextNumber() < diff.moveRate then
			local moves = { "Crossover", "BetweenLegs", "BehindBack" }
			Play.move(cpu, moves[RNG:NextInteger(1, #moves)])
		end
		local right = dirRim:Cross(Vector3.yAxis)
		if inFront and defDist < 5 and not beaten then
			AI.lane = rel:Dot(right) > 0 and -1 or 1 -- go around the side the defender isn't on
		else
			AI.lane = 0
		end
	end
	local right = dirRim:Cross(Vector3.yAxis)
	local dir = dirRim + right * AI.lane * 0.9
	dir = dir.Magnitude > 0.01 and dir.Unit or dirRim
	return dir, 1, defDist > 4 or beaten or not inFront
end

function AI.defense(diff: any, now: number, dt: number): (Vector3, number, boolean)
	local cpu, me = Athletes.cpu, Athletes.me
	local rim = flat(Arena.mainHoop.Center)
	local seen = flat(seenPlayer(diff.reaction))
	local toRim = rim - seen
	local dRim = toRim.Magnitude
	local gap = dRim > 26 and 6 or (dRim > 19 and 4.2 or 3.3)
	if me.state.charging or me.state.shot then
		gap = 2.6 -- close out on the shooter (arm's length)
	end
	if now < cpu.state.stunUntil then
		gap += 2.5 -- got beat, recovering
	end
	local dirRim = dRim > 0.1 and toRim.Unit or Vector3.new(1, 0, 0)
	local target = seen + dirRim * math.min(gap, dRim * 0.6)
	local delta = target - flat(cpu.root.Position)
	local dist = delta.Magnitude
	-- jump to contest once the shooter rises (after the CPU's reaction time)
	local sh = me.state.shot
	if sh and sh.jumpT and AI.contestFor ~= sh and now - sh.jumpT >= diff.reaction * 0.8 then
		AI.contestFor = sh
		if flat(me.root.Position - cpu.root.Position).Magnitude < 4.8 and not cpu.airborne then
			cpu.hum.Jump = true
			cpu.state.contestUntil = now + 0.7
		end
	end
	-- poke at the ball when it's exposed
	if flat(Ball.part.Position - cpu.root.Position).Magnitude < 3 and now - cpu.state.lastSteal > 1.6 then
		if Ball.exposure(me, cpu) > 0.45 and RNG:NextNumber() < diff.stealRate * dt * 4 then
			Play.trySteal(cpu)
		end
	end
	Ath.face(cpu, me.root.Position)
	cpu.lookAt = Ball.part.Position
	if dist < 0.3 then
		return Vector3.zero, 0, false
	end
	return delta.Unit, math.min(1, dist / 1.2), dist > 4.5
end

function AI.loose(now: number): (Vector3, number, boolean)
	local cpu = Athletes.cpu
	local bp = Ball.part.Position
	local v = Ball.part.AssemblyLinearVelocity
	local target = bp
	local grabY = GEO.FloorY + cpu.height * 0.9
	if bp.Y > grabY then
		local g = Workspace.Gravity
		local t = (v.Y + math.sqrt(v.Y * v.Y + 2 * g * (bp.Y - grabY))) / g
		if t > 0 and t < 3 then
			target = bp + Vector3.new(v.X, 0, v.Z) * t
		end
	end
	local delta = flat(target - cpu.root.Position)
	local top = Ath.reachTop(cpu)
	if delta.Magnitude < 1.5 and not cpu.airborne and v.Y < 2 and bp.Y > top - 0.3 and bp.Y < top + cpu.stats.JumpStuds then
		cpu.hum.Jump = true
		cpu.state.contestUntil = now + 0.5
	end
	Ath.face(cpu, nil)
	cpu.lookAt = bp
	if delta.Magnitude < 0.3 then
		return Vector3.zero, 0, false
	end
	return delta.Unit, 1, delta.Magnitude > 3
end

function AI.update(dt: number)
	local cpu, me = Athletes.cpu, Athletes.me
	if Game.mode ~= "1v1" or not Ath.alive(cpu) or not Ath.alive(me) then
		return
	end
	local now = os.clock()
	local diff = DIFFICULTY[Game.difficulty] or DIFFICULTY.Pro
	table.insert(AI.history, { t = now, p = me.root.Position })
	while #AI.history > 2 and AI.history[2].t < now - 0.8 do
		table.remove(AI.history, 1)
	end
	local st = cpu.state
	local hum = cpu.hum
	if Game.frozen or Game.phase ~= "live" then
		hum:Move(Vector3.zero, false)
		st.sprinting, st.guard, st.charging = false, false, false
		if Game.phase == "check" then
			Ath.face(cpu, Ball.holder == cpu and Arena.mainHoop.Center or me.root.Position)
		end
		cpu.lookAt = Ball.part.Position
		return
	end
	local dir, speedMul, sprint
	local guard = false
	if Ball.holder == cpu then
		dir, speedMul, sprint = AI.offense(diff, now)
	elseif Ball.holder == me then
		dir, speedMul, sprint = AI.defense(diff, now, dt)
		guard = true
	else
		dir, speedMul, sprint = AI.loose(now)
	end
	st.sprinting = sprint and not st.exhausted
	st.guard = guard and not st.sprinting
	if cpu.driveDir then
		hum.WalkSpeed = cpu.driveSpeed or 10
		hum:Move(cpu.driveDir, false)
	else
		hum.WalkSpeed = Ath.speedFor(cpu) * diff.speed * math.max(speedMul, 0.15)
		hum:Move(dir, false)
	end
end

--==============================================================================
-- 15. SAVING (session, or forever with the optional server script)
--==============================================================================
local Save = { build = table.clone(DEFAULT_BUILD), remote = nil, persistent = false }

function Save.init(onLoaded: (any) -> ())
	task.spawn(function()
		local r = ReplicatedStorage:WaitForChild(CONFIG.SaveRemoteName, 4)
		if r and r:IsA("RemoteFunction") then
			Save.remote = r
			local ok, data = pcall(function()
				return r:InvokeServer("load")
			end)
			if ok and type(data) == "table" then
				Save.build = Stats.sanitize(data)
				Save.persistent = true
				onLoaded(Save.build)
			end
		end
	end)
end

function Save.store(build: any): (boolean, string)
	Save.build = Stats.sanitize(build)
	if Save.remote then
		local ok, res = pcall(function()
			return Save.remote:InvokeServer("save", Save.build)
		end)
		if ok and res then
			return true, "Saved to your profile"
		end
		return false, "Couldn't reach the save server - kept for this session"
	end
	return true, "Saved for this session"
end

--==============================================================================
-- 16. USER INTERFACE
--==============================================================================
UI = { mode = CONFIG.DefaultMode, difficulty = CONFIG.DefaultDifficulty, scalers = {} }
local PlayerGui = player:WaitForChild("PlayerGui")
local FONT_HEAVY, FONT_BOLD = Enum.Font.GothamBlack, Enum.Font.GothamBold
local PANEL = Color3.fromRGB(12, 14, 22)
local isTouch = UserInputService.TouchEnabled

local function corner(p: Instance, r: number?)
	new("UICorner", { CornerRadius = UDim.new(0, r or 12), Parent = p })
end

local function stroke(p: Instance, color: Color3?, thick: number?, transp: number?)
	new("UIStroke", {
		Color = color or Color3.new(1, 1, 1), Thickness = thick or 2, Transparency = transp or 0.2,
		ApplyStrokeMode = Enum.ApplyStrokeMode.Border, Parent = p,
	})
end

local function label(parent: Instance, text: string, props: { [string]: any }): TextLabel
	local l = new("TextLabel", {
		BackgroundTransparency = 1, Text = text, TextScaled = true, Font = FONT_BOLD,
		TextColor3 = Color3.new(1, 1, 1), Parent = parent,
	})
	for k, v in pairs(props) do
		(l :: any)[k] = v
	end
	return l
end

local function button(parent: Instance, text: string, props: { [string]: any }): TextButton
	local b = new("TextButton", {
		Text = text, TextScaled = true, Font = FONT_HEAVY, TextColor3 = Color3.new(1, 1, 1),
		BackgroundColor3 = Color3.fromRGB(26, 30, 46), AutoButtonColor = true, Parent = parent,
	})
	for k, v in pairs(props) do
		(b :: any)[k] = v
	end
	corner(b, 12)
	new("UIPadding", {
		PaddingTop = UDim.new(0.2, 0), PaddingBottom = UDim.new(0.2, 0),
		PaddingLeft = UDim.new(0, 10), PaddingRight = UDim.new(0, 10), Parent = b,
	})
	return b
end

-- Fits a fixed-size panel on any screen, phone to monitor
local function autoScale(frame: GuiObject, w: number, h: number, maxScale: number?)
	local s = new("UIScale", { Parent = frame })
	table.insert(UI.scalers, { s = s, w = w, h = h, max = maxScale or 1.15 })
end

function UI.rescale()
	local v = Workspace.CurrentCamera.ViewportSize
	for _, e in ipairs(UI.scalers) do
		e.s.Scale = clamp(math.min(v.X / e.w, v.Y / e.h), 0.45, e.max)
	end
end

-- Slider that works with mouse, touch and drag
local function slider(parent: Instance, y: number, lo: number, hi: number, onChange: (number) -> ())
	local bar = new("Frame", { Size = UDim2.new(1, -24, 0, 10), Position = UDim2.fromOffset(12, y), BackgroundColor3 = Color3.fromRGB(52, 56, 74), Parent = parent })
	corner(bar, 5)
	local fill = new("Frame", { Size = UDim2.fromScale(0.5, 1), BackgroundColor3 = TEAM.Gold, Parent = bar })
	corner(fill, 5)
	local knob = new("Frame", { Size = UDim2.fromOffset(28, 28), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), BackgroundColor3 = Color3.new(1, 1, 1), Parent = bar })
	corner(knob, 14)
	local hit = new("TextButton", { Text = "", BackgroundTransparency = 1, Size = UDim2.new(1, 30, 0, 46), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Parent = bar })
	local value, dragging = lo, nil
	local function show()
		local r = (value - lo) / (hi - lo)
		fill.Size = UDim2.fromScale(r, 1)
		knob.Position = UDim2.fromScale(r, 0.5)
	end
	local function fromX(x: number)
		local r = clamp((x - bar.AbsolutePosition.X) / math.max(bar.AbsoluteSize.X, 1), 0, 1)
		local v = math.floor(lo + r * (hi - lo) + 0.5)
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
		if dragging and (input == dragging or input.UserInputType == Enum.UserInputType.MouseButton1) then
			dragging = nil
		end
	end)
	return {
		set = function(v: number)
			value = v
			show()
		end,
	}
end

function UI.buildMenu()
	local g = new("ScreenGui", { Name = "CK_Menu", IgnoreGuiInset = true, ResetOnSpawn = false, DisplayOrder = 20, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, Parent = PlayerGui })
	UI.menuGui = g
	local fade = new("Frame", { Size = UDim2.fromScale(0.65, 1), BackgroundColor3 = Color3.new(0, 0, 0), BorderSizePixel = 0, Parent = g })
	new("UIGradient", { Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.1), NumberSequenceKeypoint.new(0.65, 0.55), NumberSequenceKeypoint.new(1, 1) }), Parent = fade })
	UI.menuFade = fade

	-- MAIN MENU ------------------------------------------------------------------
	local main = new("Frame", { Name = "Main", Size = UDim2.fromOffset(520, 560), AnchorPoint = Vector2.new(0, 0.5), Position = UDim2.new(0, 44, 0.5, 0), BackgroundTransparency = 1, Parent = g })
	autoScale(main, 600, 620)
	UI.main = main
	label(main, CONFIG.GameName, { Size = UDim2.fromOffset(520, 96), Font = FONT_HEAVY, TextColor3 = TEAM.Gold, TextXAlignment = Enum.TextXAlignment.Left })
	label(main, "REAL 1V1 BASKETBALL", { Position = UDim2.fromOffset(4, 96), Size = UDim2.fromOffset(500, 26), TextColor3 = Color3.fromRGB(222, 226, 238), TextXAlignment = Enum.TextXAlignment.Left })
	local play = button(main, "PLAY", { Position = UDim2.fromOffset(0, 150), Size = UDim2.fromOffset(380, 74), BackgroundColor3 = TEAM.Gold, TextColor3 = TEAM.Night })
	local build = button(main, "BUILD", { Position = UDim2.fromOffset(0, 238), Size = UDim2.fromOffset(380, 62) })
	stroke(build, TEAM.Gold, 2, 0.1)
	local modeBtn = button(main, "", { Position = UDim2.fromOffset(0, 318), Size = UDim2.fromOffset(186, 46), Font = FONT_BOLD })
	local diffBtn = button(main, "", { Position = UDim2.fromOffset(194, 318), Size = UDim2.fromOffset(186, 46), Font = FONT_BOLD })
	UI.buildSummary = label(main, "", { Position = UDim2.fromOffset(2, 380), Size = UDim2.fromOffset(470, 24), TextColor3 = Color3.fromRGB(205, 210, 225), TextXAlignment = Enum.TextXAlignment.Left })
	local hint = isTouch and "Use the on-screen buttons. Hold SHOOT and let go to shoot."
		or "Shift sprint  |  hold Left Mouse / F and release to shoot  |  Q / E / R dribble moves  |  G guard  |  C camera"
	label(main, hint, { Position = UDim2.fromOffset(2, 418), Size = UDim2.fromOffset(470, 48), TextWrapped = true, Font = Enum.Font.GothamMedium, TextColor3 = Color3.fromRGB(170, 176, 196), TextXAlignment = Enum.TextXAlignment.Left })
	local function refreshToggles()
		modeBtn.Text = UI.mode == "1v1" and "MODE: 1V1 VS CPU" or "MODE: SHOOTAROUND"
		diffBtn.Text = "LEVEL: " .. string.upper(UI.difficulty)
		diffBtn.Visible = UI.mode == "1v1"
	end
	refreshToggles()
	modeBtn.Activated:Connect(function()
		UI.mode = UI.mode == "1v1" and "Shootaround" or "1v1"
		refreshToggles()
	end)
	diffBtn.Activated:Connect(function()
		local i = table.find(DIFFICULTY_ORDER, UI.difficulty) or 2
		UI.difficulty = DIFFICULTY_ORDER[i % #DIFFICULTY_ORDER + 1]
		refreshToggles()
	end)
	play.Activated:Connect(function()
		if UI.onPlay then
			UI.onPlay(UI.mode, UI.difficulty)
		end
	end)
	build.Activated:Connect(function()
		UI.showBuild()
	end)

	UI.buildBuildPanel(g)
	UI.buildResult(g)
	UI.refreshSummary()
end

function UI.refreshSummary()
	local b = Save.build
	local st = Stats.derive(b)
	UI.buildSummary.Text = string.format("YOUR PLAYER:  %s  %d LB  |  %s", Stats.heightText(b.Height), b.Weight, st.CanDunk and "CAN DUNK" or "CAN'T DUNK")
end

-- BUILD SCREEN (your real avatar stands at center court and changes live) -----
function UI.buildBuildPanel(g: ScreenGui)
	local p = new("Frame", { Name = "Build", Size = UDim2.fromOffset(470, 612), AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -30, 0.5, 0), BackgroundColor3 = PANEL, BackgroundTransparency = 0.1, Visible = false, Parent = g })
	corner(p, 18)
	stroke(p, TEAM.Gold, 2, 0.45)
	autoScale(p, 520, 660)
	UI.buildPanel = p
	label(p, "CREATE YOUR PLAYER", { Position = UDim2.fromOffset(20, 14), Size = UDim2.fromOffset(430, 38), Font = FONT_HEAVY, TextColor3 = TEAM.Gold, TextXAlignment = Enum.TextXAlignment.Left })
	local edit = table.clone(Save.build)
	UI.edit = edit
	local hLabel = label(p, "", { Position = UDim2.fromOffset(20, 64), Size = UDim2.fromOffset(430, 26), TextXAlignment = Enum.TextXAlignment.Left })
	local wLabel = label(p, "", { Position = UDim2.fromOffset(20, 134), Size = UDim2.fromOffset(430, 26), TextXAlignment = Enum.TextXAlignment.Left })
	local stats = {}
	local swatches = {}
	local dunkLabel, status
	local function refresh()
		local e = Stats.sanitize(UI.edit)
		hLabel.Text = "HEIGHT   " .. Stats.heightText(e.Height)
		wLabel.Text = "WEIGHT   " .. e.Weight .. " LB"
		for i, s in ipairs(swatches) do
			s.Thickness = i == e.Skin and 4 or 0
		end
		local st = Stats.derive(e)
		for name, ui in pairs(stats) do
			local r = st.Ratings[name]
			ui.fill.Size = UDim2.fromScale((r - 20) / 79, 1)
			ui.fill.BackgroundColor3 = r >= 80 and Color3.fromRGB(90, 230, 120) or (r >= 55 and TEAM.Gold or Color3.fromRGB(235, 110, 80))
			ui.num.Text = tostring(r)
		end
		dunkLabel.Text = string.format("VERTICAL %d IN   |   %s", math.floor(st.VertInches + 0.5), st.CanDunk and "CAN DUNK" or "CAN'T DUNK")
		UI.previewDirty = true
	end
	local hs = slider(p, 102, LIMITS.HMin, LIMITS.HMax, function(v)
		UI.edit.Height = v
		refresh()
	end)
	local ws = slider(p, 172, LIMITS.WMin, LIMITS.WMax, function(v)
		UI.edit.Weight = v
		refresh()
	end)
	label(p, "SKIN TONE", { Position = UDim2.fromOffset(20, 202), Size = UDim2.fromOffset(200, 24), TextXAlignment = Enum.TextXAlignment.Left })
	for i, c in ipairs(SKIN_TONES) do
		local row, col = math.floor((i - 1) / 5), (i - 1) % 5
		local sw = new("TextButton", { Text = "", Size = UDim2.fromOffset(42, 42), Position = UDim2.fromOffset(20 + col * 52, 232 + row * 50), BackgroundColor3 = c, AutoButtonColor = true, Parent = p })
		corner(sw, 21)
		swatches[i] = new("UIStroke", { Color = TEAM.Gold, Thickness = 0, ApplyStrokeMode = Enum.ApplyStrokeMode.Border, Parent = sw })
		sw.Activated:Connect(function()
			UI.edit.Skin = i
			refresh()
		end)
	end
	local order = { "Speed", "Strength", "Reach", "Shooting", "Handles", "Defense" }
	for i, name in ipairs(order) do
		local y = 344 + (i - 1) * 26
		label(p, string.upper(name), { Position = UDim2.fromOffset(20, y), Size = UDim2.fromOffset(120, 20), Font = FONT_BOLD, TextColor3 = Color3.fromRGB(200, 205, 220), TextXAlignment = Enum.TextXAlignment.Left })
		local back = new("Frame", { Position = UDim2.fromOffset(146, y + 5), Size = UDim2.fromOffset(240, 11), BackgroundColor3 = Color3.fromRGB(44, 48, 64), Parent = p })
		corner(back, 6)
		local fill = new("Frame", { Size = UDim2.fromScale(0.5, 1), BackgroundColor3 = TEAM.Gold, Parent = back })
		corner(fill, 6)
		local num = label(p, "50", { Position = UDim2.fromOffset(396, y), Size = UDim2.fromOffset(54, 20), Font = FONT_HEAVY })
		stats[name] = { fill = fill, num = num }
	end
	dunkLabel = label(p, "", { Position = UDim2.fromOffset(20, 502), Size = UDim2.fromOffset(430, 22), TextColor3 = Color3.fromRGB(205, 210, 225), TextXAlignment = Enum.TextXAlignment.Left })
	status = label(p, "", { Position = UDim2.fromOffset(20, 528), Size = UDim2.fromOffset(430, 20), Font = Enum.Font.GothamMedium, TextColor3 = Color3.fromRGB(120, 255, 160), TextXAlignment = Enum.TextXAlignment.Left })
	local save = button(p, "SAVE", { Position = UDim2.fromOffset(20, 552), Size = UDim2.fromOffset(212, 46), BackgroundColor3 = TEAM.Gold, TextColor3 = TEAM.Night })
	local back = button(p, "BACK", { Position = UDim2.fromOffset(242, 552), Size = UDim2.fromOffset(208, 46) })
	local busy = false
	save.Activated:Connect(function()
		if busy then
			return
		end
		busy = true
		status.Text = "Saving..."
		local ok, msg = Save.store(UI.edit)
		status.Text = msg
		status.TextColor3 = ok and Color3.fromRGB(120, 255, 160) or Color3.fromRGB(255, 200, 90)
		UI.refreshSummary()
		busy = false
	end)
	back.Activated:Connect(function()
		UI.edit = table.clone(Save.build) -- unsaved changes are dropped
		UI.previewDirty = true
		UI.showMenu()
	end)
	UI.syncBuild = function()
		UI.edit = table.clone(Save.build)
		hs.set(UI.edit.Height)
		ws.set(UI.edit.Weight)
		status.Text = Save.persistent and "Loaded from your profile" or ""
		refresh()
	end
	UI.syncBuild()
end

function UI.buildResult(g: ScreenGui)
	local r = new("Frame", { Name = "Result", Size = UDim2.fromOffset(560, 300), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), BackgroundColor3 = PANEL, BackgroundTransparency = 0.08, Visible = false, Parent = g })
	corner(r, 18)
	stroke(r, TEAM.Gold, 2, 0.3)
	autoScale(r, 620, 360)
	UI.result = r
	UI.resultTitle = label(r, "", { Position = UDim2.fromOffset(20, 22), Size = UDim2.fromOffset(520, 70), Font = FONT_HEAVY })
	UI.resultScore = label(r, "", { Position = UDim2.fromOffset(20, 100), Size = UDim2.fromOffset(520, 60), Font = Enum.Font.Code })
	local again = button(r, "REMATCH", { Position = UDim2.fromOffset(40, 200), Size = UDim2.fromOffset(230, 60), BackgroundColor3 = TEAM.Gold, TextColor3 = TEAM.Night })
	local menu = button(r, "MENU", { Position = UDim2.fromOffset(290, 200), Size = UDim2.fromOffset(230, 60) })
	again.Activated:Connect(function()
		if UI.onPlay then
			UI.onPlay(UI.mode, UI.difficulty)
		end
	end)
	menu.Activated:Connect(function()
		UI.showMenu()
	end)
end

function UI.showMenu()
	UI.screen = "menu"
	UI.menuGui.Enabled = true
	UI.main.Visible = true
	UI.menuFade.Visible = true
	UI.buildPanel.Visible = false
	UI.result.Visible = false
	if UI.hud then
		UI.hud.Enabled = false
		UI.meter.Enabled = false
	end
	if UI.onMenu then
		UI.onMenu()
	end
end

function UI.showBuild()
	UI.screen = "build"
	UI.main.Visible = false
	UI.menuFade.Visible = false
	UI.result.Visible = false
	UI.buildPanel.Visible = true
	UI.syncBuild()
	if UI.onBuild then
		UI.onBuild()
	end
end

function UI.showResult(won: boolean, me: number, cpu: number)
	UI.screen = "result"
	UI.menuGui.Enabled = true
	UI.main.Visible = false
	UI.menuFade.Visible = false
	UI.buildPanel.Visible = false
	UI.result.Visible = true
	UI.resultTitle.Text = won and "YOU WIN!" or "CPU WINS"
	UI.resultTitle.TextColor3 = won and TEAM.Gold or Color3.fromRGB(240, 90, 90)
	UI.resultScore.Text = string.format("YOU %d  -  %d CPU", me, cpu)
	if UI.hud then
		UI.hud.Enabled = false
		UI.meter.Enabled = false
	end
end

function UI.buildHud()
	local g = new("ScreenGui", { Name = "CK_HUD", ResetOnSpawn = false, DisplayOrder = 10, Enabled = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, Parent = PlayerGui })
	UI.hud = g
	-- Scorebug
	local bug = new("Frame", { Size = UDim2.fromOffset(600, 56), AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 4), BackgroundColor3 = PANEL, BackgroundTransparency = 0.05, Parent = g })
	corner(bug, 10)
	stroke(bug, Color3.fromRGB(70, 76, 100), 1, 0.4)
	autoScale(bug, 1150, 760, 1)
	local function team(x: number, name: string, color: Color3): (TextLabel, TextLabel, Frame)
		local box = new("Frame", { Position = UDim2.fromOffset(x, 0), Size = UDim2.fromOffset(170, 56), BackgroundTransparency = 1, Parent = bug })
		new("Frame", { Size = UDim2.fromOffset(6, 38), Position = UDim2.fromOffset(10, 9), BackgroundColor3 = color, BorderSizePixel = 0, Parent = box })
		local nm = label(box, name, { Position = UDim2.fromOffset(24, 10), Size = UDim2.fromOffset(80, 36), Font = FONT_HEAVY, TextXAlignment = Enum.TextXAlignment.Left })
		local sc = label(box, "0", { Position = UDim2.fromOffset(104, 6), Size = UDim2.fromOffset(58, 44), Font = FONT_HEAVY, TextXAlignment = Enum.TextXAlignment.Right })
		local poss = new("Frame", { Size = UDim2.fromOffset(148, 4), Position = UDim2.fromOffset(14, 50), BackgroundColor3 = color, BorderSizePixel = 0, Visible = false, Parent = box })
		return nm, sc, poss
	end
	UI.nameA, UI.scoreA, UI.possA = team(0, "YOU", TEAM.Gold)
	UI.nameB, UI.scoreB, UI.possB = team(176, "CPU", TEAM.Crimson)
	local clockBox = new("Frame", { Position = UDim2.fromOffset(358, 6), Size = UDim2.fromOffset(84, 44), BackgroundColor3 = Color3.fromRGB(4, 4, 6), Parent = bug })
	corner(clockBox, 8)
	UI.clockBox = clockBox
	UI.clock = label(clockBox, "24", { Size = UDim2.fromScale(1, 1), Font = Enum.Font.Code, TextColor3 = Color3.fromRGB(255, 70, 50) })
	UI.info = label(bug, "", { Position = UDim2.fromOffset(450, 10), Size = UDim2.fromOffset(140, 36), TextColor3 = Color3.fromRGB(190, 196, 215) })
	UI.clear = label(g, "TAKE IT BACK  >  3-POINT LINE", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 66), Size = UDim2.fromOffset(380, 26), Font = FONT_HEAVY, TextColor3 = TEAM.Gold, TextStrokeTransparency = 0.4, Visible = false })

	UI.bannerLabel = label(g, "", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.27), Size = UDim2.new(0.8, 0, 0, 62), Font = FONT_HEAVY, TextStrokeTransparency = 1, TextTransparency = 1, TextStrokeColor3 = Color3.new(0, 0, 0) })
	UI.feedbackLabel = label(g, "", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.27, 50), Size = UDim2.new(0.62, 0, 0, 30), TextStrokeTransparency = 1, TextTransparency = 1 })

	local stam = new("Frame", { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -10), Size = UDim2.fromOffset(240, 8), BackgroundColor3 = Color3.fromRGB(24, 26, 36), BackgroundTransparency = 0.2, Parent = g })
	corner(stam, 4)
	UI.stamFill = new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(90, 200, 255), Parent = stam })
	corner(UI.stamFill, 4)

	local menuBtn = button(g, "MENU", { Position = UDim2.fromOffset(10, 6), Size = UDim2.fromOffset(92, 36), Font = FONT_BOLD })
	local camBtn = button(g, "CAM", { Position = UDim2.fromOffset(108, 6), Size = UDim2.fromOffset(76, 36), Font = FONT_BOLD })
	menuBtn.Activated:Connect(function()
		UI.showMenu()
	end)
	camBtn.Activated:Connect(function()
		Cam.toggle()
	end)
	if not isTouch then
		UI.hints = label(g, "SHIFT sprint   |   hold LMB / F, release to shoot   |   LMB / F steal   |   hold G guard   |   Q E R moves   |   C camera", {
			AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 12, 1, -24), Size = UDim2.fromOffset(760, 20),
			Font = FONT_BOLD, TextColor3 = Color3.fromRGB(225, 228, 240), TextStrokeTransparency = 0.5, TextXAlignment = Enum.TextXAlignment.Left,
		})
	end
	UI.buildTouch(g)
	UI.buildMeter()
end

-- Touch buttons, placed left of Roblox's own jump button
function UI.buildTouch(g: ScreenGui)
	local m = new("Frame", { Name = "Touch", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Visible = isTouch, Parent = g })
	UI.touch = m
	local vp = Workspace.CurrentCamera.ViewportSize
	local small = math.min(vp.X, vp.Y) <= 500
	local jx = small and 104 or 186
	local function hold(text: string, size: number, x: number, y: number, color: Color3, onDown: () -> (), onUp: (() -> ())?): TextButton
		local b = new("TextButton", {
			Text = text, Size = UDim2.fromOffset(size, size), AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -x, 1, -y),
			BackgroundColor3 = color, BackgroundTransparency = 0.2, Font = FONT_HEAVY, TextScaled = true,
			TextColor3 = Color3.new(1, 1, 1), AutoButtonColor = false, Parent = m,
		})
		corner(b, size / 2)
		stroke(b, Color3.new(1, 1, 1), 2, 0.35)
		new("UIPadding", { PaddingTop = UDim.new(0.3, 0), PaddingBottom = UDim.new(0.3, 0), PaddingLeft = UDim.new(0.14, 0), PaddingRight = UDim.new(0.14, 0), Parent = b })
		local active = nil
		b.InputBegan:Connect(function(input)
			if active == nil and (input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1) then
				active = input
				b.BackgroundTransparency = 0.5
				onDown()
			end
		end)
		UserInputService.InputEnded:Connect(function(input)
			if input == active then
				active = nil
				b.BackgroundTransparency = 0.2
				if onUp then
					onUp()
				end
			end
		end)
		return b
	end
	UI.bShoot = hold("SHOOT", 102, jx, 18, Color3.fromRGB(230, 150, 30), function()
		Controls.primary(true)
	end, function()
		Controls.primary(false)
	end)
	UI.bSprint = hold("SPRINT", 74, jx + 114, 18, Color3.fromRGB(40, 120, 220), function()
		Controls.sprintToggle = not Controls.sprintToggle
	end)
	UI.bGuard = hold("GUARD", 70, jx + 16, 134, Color3.fromRGB(50, 160, 90), function()
		Controls.guardHeld = true
	end, function()
		Controls.guardHeld = false
	end)
	UI.bCross = hold("CROSS", 62, jx + 20, 134, Color3.fromRGB(140, 60, 200), function()
		Controls.move("Crossover")
	end)
	UI.bLegs = hold("LEGS", 62, jx + 92, 134, Color3.fromRGB(140, 60, 200), function()
		Controls.move("BetweenLegs")
	end)
	UI.bBack = hold("BACK", 62, jx + 164, 134, Color3.fromRGB(140, 60, 200), function()
		Controls.move("BehindBack")
	end)
end

-- Shot meter floating next to your player
function UI.buildMeter()
	local bb = new("BillboardGui", {
		Name = "CK_Meter", Size = UDim2.fromOffset(34, 190), StudsOffset = Vector3.new(2.6, 1.2, 0),
		AlwaysOnTop = true, LightInfluence = 0, Enabled = false, ResetOnSpawn = false, MaxDistance = 250, Parent = PlayerGui,
	})
	UI.meter = bb
	local back = new("Frame", { Size = UDim2.new(1, 0, 0, 150), BackgroundColor3 = Color3.fromRGB(10, 12, 18), BackgroundTransparency = 0.15, Parent = bb })
	corner(back, 8)
	stroke(back, Color3.new(1, 1, 1), 2, 0.25)
	UI.zone = new("Frame", { AnchorPoint = Vector2.new(0, 1), Position = UDim2.fromScale(0, 1), Size = UDim2.fromScale(1, 0.2), BackgroundColor3 = Color3.fromRGB(70, 230, 120), BackgroundTransparency = 0.3, BorderSizePixel = 0, Parent = back })
	UI.perfect = new("Frame", { AnchorPoint = Vector2.new(0, 0.5), Size = UDim2.new(1, 0, 0, 2), BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, Parent = back })
	UI.fill = new("Frame", { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.fromScale(0.5, 1), Size = UDim2.new(0.42, 0, 0, 0), BackgroundColor3 = TEAM.Gold, BorderSizePixel = 0, Parent = back })
	corner(UI.fill, 4)
	UI.meterDist = label(bb, "", { Position = UDim2.fromOffset(-30, 156), Size = UDim2.fromOffset(94, 26), Font = FONT_HEAVY, TextStrokeTransparency = 0.4 })
end

function UI.showHud()
	UI.screen = "game"
	UI.menuGui.Enabled = false
	UI.hud.Enabled = true
	UI.hintsUntil = os.clock() + 15
	if UI.hints then
		UI.hints.Visible = true
	end
	UI.updateScore()
end

local function fadeLabel(l: TextLabel, text: string, color: Color3?, hold: number, field: string)
	l.Text = text
	l.TextColor3 = color or Color3.new(1, 1, 1)
	l.TextTransparency = 0
	l.TextStrokeTransparency = 0.35
	UI[field] = (UI[field] or 0) + 1
	local token = UI[field]
	task.delay(hold, function()
		if UI[field] == token then
			TweenService:Create(l, TweenInfo.new(0.4), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
		end
	end)
end

function UI.banner(text: string, color: Color3?)
	if UI.bannerLabel then
		fadeLabel(UI.bannerLabel, text, color, 1.5, "bannerToken")
	end
end

function UI.feedback(text: string, color: Color3?)
	if UI.feedbackLabel then
		fadeLabel(UI.feedbackLabel, text, color, 1.3, "feedbackToken")
	end
end

function UI.shotFeedback(sh: any, err: number, ideal: number, perfect: boolean, chance: number, contest: number)
	local tol = Athletes.me.stats.ShootTol
	local word
	if sh.kind == "dunk" then
		word = "DUNK"
	elseif sh.kind == "layup" then
		word = "LAYUP"
	elseif perfect then
		word = "PERFECT RELEASE"
	elseif err <= tol then
		word = "GOOD RELEASE"
	elseif sh.power < ideal then
		word = "TOO SHORT"
	else
		word = "TOO LONG"
	end
	local cover = contest > 0.18 and "HEAVILY CONTESTED" or (contest > 0.06 and "CONTESTED" or "OPEN")
	local good = sh.kind ~= "jumper" or err <= tol
	local color = good and Color3.fromRGB(110, 255, 150) or (err <= tol * 1.8 and TEAM.Gold or Color3.fromRGB(255, 110, 90))
	UI.feedback(string.format("%s   |   %s   |   %d%%", word, cover, math.floor(chance * 100 + 0.5)), color)
end

function UI.updateScore()
	if not UI.hud then
		return
	end
	if Game.mode == "1v1" then
		UI.nameA.Text, UI.nameB.Text = "YOU", "CPU"
		UI.scoreA.Text = tostring(Game.score.me)
		UI.scoreB.Text = tostring(Game.score.cpu)
		UI.clock.Text = tostring(math.ceil(Game.clock))
		UI.clock.TextColor3 = Game.clock <= 5 and Color3.fromRGB(255, 40, 40) or Color3.fromRGB(255, 120, 60)
		UI.clockBox.Visible = true
		UI.info.Text = "FIRST TO " .. CONFIG.WinScore
	else
		UI.nameA.Text, UI.nameB.Text = "MAKES", "SHOTS"
		UI.scoreA.Text = tostring(Game.makes)
		UI.scoreB.Text = tostring(Game.attempts)
		UI.clockBox.Visible = false
		local pct = Game.attempts > 0 and math.floor(Game.makes / Game.attempts * 100 + 0.5) or 0
		UI.info.Text = "FG " .. pct .. "%"
	end
end

function UI.update(dt: number)
	local me = Athletes.me
	if not me or not Ath.alive(me) then
		return
	end
	-- Build screen: apply slider changes to your real avatar (a few times a second)
	if UI.screen == "build" and UI.previewDirty and os.clock() - (UI.lastPreview or 0) > 0.15 then
		UI.previewDirty = false
		UI.lastPreview = os.clock()
		Rig.applyBuild(me, UI.edit)
	elseif UI.screen ~= "build" and UI.previewDirty then
		UI.previewDirty = false
		Rig.applyBuild(me, Save.build)
	end
	if not UI.hud.Enabled then
		return
	end
	local st = me.state
	local holding = Ball.holder == me
	UI.meter.Enabled = st.charging
	if st.charging then
		UI.meter.Adornee = me.root
		local d = flat(Game.hoopFor(me).Center - me.root.Position).Magnitude
		local ideal = Stats.idealPower(d)
		local tol = me.stats.ShootTol
		local lo, hi = clamp(ideal - tol, 0, 1), clamp(ideal + tol, 0, 1)
		UI.zone.Position = UDim2.fromScale(0, 1 - lo)
		UI.zone.Size = UDim2.fromScale(1, hi - lo)
		UI.perfect.Position = UDim2.fromScale(0, 1 - ideal)
		UI.fill.Size = UDim2.new(0.42, 0, st.charge, 0)
		UI.fill.BackgroundColor3 = (st.charge >= lo and st.charge <= hi) and Color3.fromRGB(80, 255, 140) or TEAM.Gold
		UI.meterDist.Text = math.floor(d / FT + 0.5) .. " FT"
	end
	local stamina = math.floor(st.stamina / CONFIG.StaminaMax * 200 + 0.5) / 200
	if stamina ~= UI.lastStamina or st.exhausted ~= UI.lastExhausted then
		UI.lastStamina, UI.lastExhausted = stamina, st.exhausted
		UI.stamFill.Size = UDim2.fromScale(stamina, 1)
		UI.stamFill.BackgroundColor3 = st.exhausted and Color3.fromRGB(255, 90, 90) or Color3.fromRGB(90, 200, 255)
	end
	local versus = Game.mode == "1v1"
	UI.possA.Visible = versus and Ball.holder == me
	UI.possB.Visible = versus and Athletes.cpu ~= nil and Ball.holder == Athletes.cpu
	UI.clear.Visible = versus and Game.mustClear and Game.offense == me and Game.phase == "live"
	if UI.touch.Visible then
		UI.bShoot.Text = (holding or not versus) and "SHOOT" or "STEAL"
		UI.bGuard.Visible = versus and not holding
		UI.bCross.Visible, UI.bLegs.Visible, UI.bBack.Visible = holding, holding, holding
		UI.bSprint.BackgroundColor3 = Controls.sprintToggle and Color3.fromRGB(230, 170, 40) or Color3.fromRGB(40, 120, 220)
	end
	if UI.hints and UI.hints.Visible and os.clock() > (UI.hintsUntil or 0) then
		UI.hints.Visible = false
	end
end

--==============================================================================
-- 17. CONTROLS (PC, gamepad, touch)
--==============================================================================
Controls = { sprintHeld = false, sprintToggle = false, guardHeld = false, enabled = true, module = nil }
local Main = { showcase = W(0, 0, 0) }

function Controls.setEnabled(on: boolean)
	Controls.enabled = on
	local m = Controls.module
	if m then
		pcall(function()
			if on then
				m:Enable()
			else
				m:Disable()
			end
		end)
	end
end

-- Roblox's own movement controls (turned off on menus and during layup/dunk take-offs)
task.spawn(function()
	local ok, controls = pcall(function()
		local playerModule = player:WaitForChild("PlayerScripts"):WaitForChild("PlayerModule", 10)
		return playerModule and require(playerModule):GetControls()
	end)
	if ok and controls then
		Controls.module = controls
		Controls.setEnabled(Controls.enabled)
	end
end)

local function playing(): boolean
	return UI.screen == "game" and (Game.phase == "live" or Game.phase == "check" or Game.phase == "dead")
end

function Controls.primary(down: boolean)
	local me = Athletes.me
	if not Ath.alive(me) or not playing() then
		return
	end
	if down then
		if Game.frozen then
			return
		end
		if Ball.holder == me then
			Play.startCharge(me)
		elseif Game.mode == "1v1" then
			Play.trySteal(me)
		end
	elseif me.state.charging then
		Play.releaseCharge(me)
	end
end

function Controls.move(style: string)
	local me = Athletes.me
	if Ath.alive(me) and playing() and not Game.frozen then
		Play.move(me, style)
	end
end

local KEYS = {
	[Enum.KeyCode.Q] = "Crossover", [Enum.KeyCode.ButtonX] = "Crossover",
	[Enum.KeyCode.E] = "BetweenLegs", [Enum.KeyCode.ButtonY] = "BetweenLegs",
	[Enum.KeyCode.R] = "BehindBack", [Enum.KeyCode.ButtonB] = "BehindBack",
}

UserInputService.InputBegan:Connect(function(input, processed)
	if UserInputService:GetFocusedTextBox() then
		return
	end
	local k, t = input.KeyCode, input.UserInputType
	if t == Enum.UserInputType.MouseButton1 then
		if not processed then
			Controls.primary(true)
		end
	elseif k == Enum.KeyCode.F or k == Enum.KeyCode.ButtonR2 then
		Controls.primary(true)
	elseif k == Enum.KeyCode.LeftShift or k == Enum.KeyCode.RightShift then
		Controls.sprintHeld = true
	elseif k == Enum.KeyCode.ButtonL3 then
		Controls.sprintToggle = not Controls.sprintToggle
	elseif k == Enum.KeyCode.G or k == Enum.KeyCode.ButtonL2 then
		Controls.guardHeld = true
	elseif KEYS[k] then
		Controls.move(KEYS[k])
	elseif (k == Enum.KeyCode.C or k == Enum.KeyCode.DPadUp) and UI.screen == "game" then
		Cam.toggle()
	end
end)

UserInputService.InputEnded:Connect(function(input)
	local k, t = input.KeyCode, input.UserInputType
	if t == Enum.UserInputType.MouseButton1 or k == Enum.KeyCode.F or k == Enum.KeyCode.ButtonR2 then
		Controls.primary(false)
	elseif k == Enum.KeyCode.LeftShift or k == Enum.KeyCode.RightShift then
		Controls.sprintHeld = false
	elseif k == Enum.KeyCode.G or k == Enum.KeyCode.ButtonL2 then
		Controls.guardHeld = false
	end
end)

-- Every frame: speed, sprint, guard stance, facing, layup/dunk take-off
function Controls.updatePlayer(me: any)
	local st, hum = me.state, me.hum
	if Game.frozen or UI.screen ~= "game" then
		hum.WalkSpeed = 0
		st.sprinting, st.guard = false, false
		if st.charging and Game.phase ~= "live" then
			st.charging = false
		end
		return
	end
	local holding = Ball.holder == me
	local versus = Game.mode == "1v1" and Athletes.cpu ~= nil and Ath.alive(Athletes.cpu)
	st.guard = Controls.guardHeld and not holding and versus
	st.sprinting = (Controls.sprintHeld or Controls.sprintToggle) and not st.guard and not st.charging and hum.MoveDirection.Magnitude > 0.1
	if st.charging then
		st.charge = clamp((os.clock() - st.chargeT0) / CONFIG.ChargeTime, 0, 1)
	end
	if st.guard then
		Ath.face(me, Athletes.cpu.root.Position)
	elseif not st.charging and not st.shot then
		Ath.face(me, nil)
	end
	if me.driveDir then
		if Controls.enabled then
			Controls.setEnabled(false)
		end
		hum.WalkSpeed = me.driveSpeed or 10
		hum:Move(me.driveDir, false)
	else
		if not Controls.enabled then
			Controls.setEnabled(true)
		end
		hum.WalkSpeed = Ath.speedFor(me)
	end
	me.lookAt = holding and Game.hoopFor(me).Center or Ball.part.Position
end

--==============================================================================
-- 18. CAMERA
--==============================================================================
Cam = { mode = "menu", broadcast = false, t = 0, shake = 0 }

function Cam.toggle()
	Cam.broadcast = not Cam.broadcast
	if UI.screen == "game" then
		Cam.setGame()
	end
	UI.feedback(Cam.broadcast and "BROADCAST CAMERA" or "PLAYER CAMERA", Color3.new(1, 1, 1))
end

function Cam.setGame()
	local camera = Workspace.CurrentCamera
	Cam.mode = Cam.broadcast and "broadcast" or "player"
	Graphics.dof.Enabled = false
	if Cam.mode == "player" then
		camera.CameraType = Enum.CameraType.Custom
		if Athletes.me and Athletes.me.hum then
			camera.CameraSubject = Athletes.me.hum
		end
		camera.FieldOfView = 70
	else
		camera.CameraType = Enum.CameraType.Scriptable
	end
end

function Cam.setMenu()
	Cam.mode = "menu"
	Graphics.dof.Enabled = true
	Graphics.dof.InFocusRadius = 30
end

function Cam.setBuild()
	Cam.mode = "build"
	Cam.buildT = 0
	Graphics.dof.Enabled = true
	Graphics.dof.InFocusRadius = 4
end

function Cam.addShake(amount: number)
	Cam.shake = math.max(Cam.shake, amount)
end

function Cam.update(dt: number)
	local camera = Workspace.CurrentCamera
	local me = Athletes.me
	if Cam.mode == "menu" or Cam.mode == "build" then
		if camera.CameraType ~= Enum.CameraType.Scriptable then
			camera.CameraType = Enum.CameraType.Scriptable
		end
	end
	if Cam.mode == "menu" then
		Cam.t += dt
		local a = Cam.t * 0.045
		local center = W(GEO.HoopX * 0.3, 4, 0)
		local pos = center + Vector3.new(math.cos(a) * 50, 17 + math.sin(Cam.t * 0.13) * 2.5, math.sin(a) * 34)
		camera.CFrame = CFrame.lookAt(pos, center)
		camera.FieldOfView = 60
		Graphics.dof.FocusDistance = (pos - center).Magnitude
	elseif Cam.mode == "build" then
		if me and Ath.alive(me) then
			local h = me.height
			local spot = Main.showcase
			local dist = h * 1.25 + 4.5
			local pos = spot + Vector3.new(0, GEO.FloorY - spot.Y + h * 0.6, dist)
			local look = Vector3.new(spot.X + h * 0.42, GEO.FloorY + h * 0.52, spot.Z)
			camera.CFrame = CFrame.lookAt(pos, look)
			camera.FieldOfView = 50
			Graphics.dof.FocusDistance = dist
			Cam.buildT = (Cam.buildT or 0) + dt
			local turn = math.sin(Cam.buildT * 0.55) * 0.75 -- gentle turn left and right, facing you
			Ath.face(me, me.root.Position + Vector3.new(math.sin(turn), 0, math.cos(turn)))
		end
	elseif Cam.mode == "broadcast" then
		if me and Ath.alive(me) then
			local hoop = Game.hoopFor(me)
			local mid = me.root.Position:Lerp(Ball.part.Position, 0.3)
			local away = flat(mid - hoop.Center)
			local d = away.Magnitude
			away = d > 0.1 and away.Unit or Vector3.new(-hoop.Sign, 0, 0)
			local pos = mid + away * (11 + d * 0.15) + Vector3.new(0, 6.5, 0)
			local look = mid:Lerp(hoop.Center, 0.35) + Vector3.new(0, 1, 0)
			camera.CFrame = camera.CFrame:Lerp(CFrame.lookAt(pos, look), 1 - math.exp(-6 * dt))
			camera.FieldOfView = 62
		end
	elseif Cam.mode == "player" and me and Ath.alive(me) then
		local want = 70 + ((me.state.sprinting and me.speed > 8) and 6 or 0)
		camera.FieldOfView = approach(camera.FieldOfView, want, 5, dt)
	end
	-- small camera shake for dunks and ankle breakers
	if me and Ath.alive(me) then
		if Cam.shake > 0.001 then
			Cam.shake = approach(Cam.shake, 0, 6, dt)
			me.hum.CameraOffset = Vector3.new(RNG:NextNumber(-1, 1), RNG:NextNumber(-1, 1), 0) * Cam.shake
		elseif me.hum.CameraOffset ~= Vector3.zero then
			me.hum.CameraOffset = Vector3.zero
		end
	end
end

--==============================================================================
-- 19. STARTUP AND MAIN LOOPS
--==============================================================================
function Main.toShowcase()
	local me = Athletes.me
	if Ath.alive(me) then
		Ath.teleport(me, Main.showcase, Main.showcase + Vector3.new(0, 0, 10))
	end
	Controls.setEnabled(false)
end

-- Other people in the server play their own copy of the game; hide them here
local function hideOne(d: Instance)
	if d:IsA("BasePart") then
		d.LocalTransparencyModifier = 1
		d.CanCollide = false
		d.CanTouch = false
		d.CanQuery = false
	elseif d:IsA("Decal") then
		d.LocalTransparencyModifier = 1
	elseif d:IsA("BillboardGui") or d:IsA("SurfaceGui") then
		d.Enabled = false
	elseif d:IsA("Humanoid") then
		d.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	end
end

local function hideCharacter(char: Model)
	for _, d in ipairs(char:GetDescendants()) do
		hideOne(d)
	end
	char.DescendantAdded:Connect(hideOne)
end

local function watchPlayer(p: Player)
	if p == player then
		return
	end
	if p.Character then
		hideCharacter(p.Character)
	end
	p.CharacterAdded:Connect(hideCharacter)
end

local function onCharacter(char: Model)
	local me = Athletes.me or Ath.new("YOU", false)
	Athletes.me = me
	if Ball.holder == me then
		Ball.release(Ball.part.Position, Vector3.zero)
	end
	if not Ath.bind(me, char) then
		return
	end
	Rig.applyBuild(me, Save.build)
	UI.meter.Adornee = me.root
	table.insert(me.conns, me.hum.Died:Connect(function()
		if Ball.holder == me then
			Ball.release(Ball.part.Position, Vector3.new(0, 2, 0))
		end
	end))
	task.wait(0.35)
	if me.model ~= char or not char.Parent then
		return
	end
	if UI.screen == "game" then
		Cam.setGame()
		local inGame = Game.phase ~= "menu" and Game.phase ~= "over"
		if inGame and Game.mode == "1v1" and Ath.alive(Athletes.cpu) then
			Game.checkBall(Athletes.cpu) -- you reset: CPU ball
		elseif Game.phase ~= "over" then
			Game.start(UI.mode, UI.difficulty) -- (re)start once your character exists
		end
	else
		Main.toShowcase()
	end
end

-- 1) clean up anything left from an earlier run of this script
for _, name in ipairs({ "CK_Menu", "CK_HUD", "CK_Meter" }) do
	local old = PlayerGui:FindFirstChild(name)
	if old then
		old:Destroy()
	end
end
local oldCpu = Workspace:FindFirstChild("CourtKingsCPU")
if oldCpu then
	oldCpu:Destroy()
end
pcall(function()
	StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
end)

-- 2) world
Graphics.setup()
Arena.build()
Ball.create(Arena.model)
Ball.part.Touched:Connect(Game.onBallTouched)
if hasAsset(SOUNDS.Crowd) then
	local crowd = new("Sound", { Name = "Crowd", SoundId = SOUNDS.Crowd, Looped = true, Volume = 0.35, Parent = Arena.model })
	crowd:Play()
end

-- 3) interface
UI.buildMenu()
UI.buildHud()
UI.rescale()
Workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(UI.rescale)
UI.onMenu = function()
	Game.stop()
	Cam.setMenu()
	Main.toShowcase()
end
UI.onBuild = function()
	Cam.setBuild()
	Main.toShowcase()
end
UI.onPlay = function(mode: string, difficulty: string)
	UI.mode, UI.difficulty = mode, difficulty
	UI.showHud()
	Cam.setGame()
	Controls.setEnabled(true)
	Game.start(mode, difficulty)
end

-- 4) characters
if CONFIG.HideOtherPlayers then
	for _, p in ipairs(Players:GetPlayers()) do
		watchPlayer(p)
	end
	Players.PlayerAdded:Connect(watchPlayer)
end
player.CharacterAdded:Connect(onCharacter)
if player.Character then
	task.spawn(onCharacter, player.Character)
end
UI.showMenu()

-- 5) loops: before physics (players, ball, animation), after physics (rules, CPU), and render (camera, UI)
RunService.Stepped:Connect(function(_, dt: number)
	dt = math.min(dt, 0.1)
	local me, cpu = Athletes.me, Athletes.cpu
	local meOk = Ath.alive(me)
	local cpuOk = Game.mode == "1v1" and Ath.alive(cpu)
	if meOk then
		Ath.updateState(me, dt)
		Controls.updatePlayer(me)
		Play.updateShot(me, dt)
	end
	if cpuOk then
		Ath.updateState(cpu, dt)
		if cpu.state.charging then
			cpu.state.charge = clamp((os.clock() - cpu.state.chargeT0) / CONFIG.ChargeTime, 0, 1)
		end
		Play.updateShot(cpu, dt)
		Rig.updateLoco(cpu)
	end
	if Ball.holder and Ath.alive(Ball.holder) then
		Ball.updateHeld(dt)
	end
	if meOk then
		Anim.update(me, dt)
		Anim.updateCustomLoops(me)
	end
	if cpuOk then
		Anim.update(cpu, dt)
		Anim.updateCustomLoops(cpu)
	end
end)

RunService.Heartbeat:Connect(function(dt: number)
	dt = math.min(dt, 0.1)
	Game.update(dt)
	AI.update(dt)
	Arena.update()
	if Ball.free then
		local vy = Ball.part.AssemblyLinearVelocity.Y
		if Ball.prevVy < -3 and vy > 0.5 and Ball.part.Position.Y < GEO.FloorY + GEO.BallR + 0.5 then
			Sound.play("Bounce", Ball.part, clamp(-Ball.prevVy / 20, 0.15, 0.8), RNG:NextNumber(1.1, 1.25))
		end
		Ball.prevVy = vy
	end
end)

RunService.RenderStepped:Connect(function(dt: number)
	Cam.update(dt)
	UI.update(dt)
end)

-- 6) the crowd fills the seats while you're on the menu; then load a saved build
Arena.buildStands(Arena.model)
Save.init(function(build)
	UI.syncBuild()
	UI.refreshSummary()
	if Athletes.me and Ath.alive(Athletes.me) then
		Rig.applyBuild(Athletes.me, build)
	end
end)

--[=[
================================================================================
  OPTIONAL SERVER SAVE SCRIPT  (keeps builds forever with DataStoreService)
  1. ServerScriptService > (+) Script
  2. Paste everything between the two dashed lines below
  3. Game Settings > Security > "Enable Studio Access to API Services" = ON
--------------------------------------------------------------------------------
local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local store = DataStoreService:GetDataStore("CourtKingsBuilds_v1")
local remote = Instance.new("RemoteFunction")
remote.Name = "CourtKingsSave"
remote.Parent = ReplicatedStorage
local lastSave = {}
remote.OnServerInvoke = function(player, action, build)
	local key = "u_" .. player.UserId
	if action == "load" then
		local ok, data = pcall(store.GetAsync, store, key)
		return ok and data or nil
	elseif action == "save" and type(build) == "table" then
		if os.clock() - (lastSave[player] or -10) < 6 then
			return false
		end
		lastSave[player] = os.clock()
		local clean = {
			Height = math.clamp(math.floor(tonumber(build.Height) or 76), 65, 87),
			Weight = math.clamp(math.floor(tonumber(build.Weight) or 200), 145, 220),
			Skin = math.clamp(math.floor(tonumber(build.Skin) or 5), 1, 10),
		}
		local ok = pcall(store.SetAsync, store, key, clean)
		return ok
	end
	return nil
end
game:GetService("Players").PlayerRemoving:Connect(function(player)
	lastSave[player] = nil
end)
--------------------------------------------------------------------------------
]=]
