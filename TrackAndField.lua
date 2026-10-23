--[[
	=====================================================================
	  TRACK AND FIELD  (demo)                         one LocalScript
	=====================================================================
	  INSTALL
	    1. Roblox Studio -> an empty Baseplate place.
	    2. Explorer: StarterPlayer > StarterPlayerScripts -> insert a LocalScript.
	    3. Paste this whole file into it and press Play.
	    (The script builds its own world: terrain, track, trees, lake...)

	  EVENTS   60m, 100m, 200m, 400m, 4x100m, 4x200m, 4x400m
	    Every event: semifinal -> finalists screen -> final introductions
	    (username + semifinal time) -> final -> podium. An announcer calls
	    the race and says the winner's name (captions + voice).
	    No bots on the track: you race alone, rivals are leaderboard times.

	  RUNNING  tap left / right in rhythm, one tap every 0.3 s holds top speed.
	    PC:       A / D (rebindable), Left / Right arrows, mouse left / right click
	              Relays: Space (or W / Up) to pass the baton in the exchange zone
	              Menu keys: L leaderboard, P settings, C camera
	    Phone:    tap the left / right half of the screen, PASS button in relays
	    Gamepad:  L1 / R1 (or L2 / R2), A to pass
	    Speed limits (studs/s): 60m 36.8, 100m 37.9, 200m 37.7, 400m 34.3
	    (relay legs use the same limits). Reaction time 0.02 - 0.05 s.
	    Tap during "Set" = false start: restart, your reaction becomes 0.15 s.
	    A second false start is a disqualification.

	  RECORDS  Real race times: the clock runs in real seconds from the gun and
	    official times are rounded up to the hundredth, like real athletics.
	    Every event has a world record on the leaderboard. Beat it by
	    0.01 - 0.05 s and it counts. Beat it by more than 0.05 s and it is
	    not ratified (it doesn't count).

	  ANIMATIONS  Made in code for R6 and R15 (Motor6D or AnimationConstraint
	    joints), based on Usain Bolt / Noah Lyles sprint form: crouch start,
	    block clearance, 45 degree drive phase, upright top-speed cycle with
	    high knees, bend lean, finish dip, braking jog and celebrations
	    (Bolt's lightning pose / Lyles' power-up).

	  SETTINGS  Event, AFK, white & royal blue uniform, track colour, camera,
	    celebration, announcer voice, performance mode, key rebinding.

	  Scale: 1 stud = 0.28 m, so 100 m = 357 studs.
	=====================================================================
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local Workspace = game:GetService("Workspace")
local SoundService = game:GetService("SoundService")

local player = Players.LocalPlayer

---------------------------------------------------------------------
-- CONFIG
---------------------------------------------------------------------
local CONFIG = {
	StudsPerMeter = 1 / 0.28,
	Lanes = 8,

	-- tapping (one tap every 0.3 s holds top speed)
	TapInterval = 0.3,
	MinTapGap = 0.07, -- faster taps are ignored (no mashing)
	PerfectMin = 0.22, -- taps 0.22 - 0.38 s apart are "perfect"
	PerfectMax = 0.38,
	DriveWindow = 0.36, -- no tap for this long = you start slowing down
	PlayerTau = 1.2, -- acceleration time constant (s)
	CoastDecel = 12,
	BlockPushTime = 0.4,

	StaminaMax = 100,
	StaminaDrain = 2.1, -- per second at top speed

	ReactionMin = 0.02,
	ReactionMax = 0.05,
	ReactionAfterFalseStart = 0.15,
	RivalReactionMin = 0.10,
	RivalReactionMax = 0.17,

	-- relays: exchange zone around every leg line (metres)
	ZoneBefore = 20,
	ZoneAfter = 10,
	PerfectPassBefore = 8, -- best pass window: 8 m before .. 2 m after the line
	PerfectPassAfter = 2,

	-- world record rule
	WRMinMargin = 0.01,
	WRMaxMargin = 0.05,

	LaneDrawTime = 3.5,
	ResultsTime = 7,
	FinalistsTime = 7,
	IntroCardTime = 1.7,
}

-- DriveMeters = length of the drive phase (low body angle out of the blocks)
type Event = { Name: string, Meters: number, MaxSpeed: number, DriveMeters: number, Legs: number, LegMeters: number, Relay: boolean }

local function makeEvent(name: string, meters: number, maxSpeed: number, drive: number, legs: number?): Event
	local n = legs or 1
	return { Name = name, Meters = meters, MaxSpeed = maxSpeed, DriveMeters = drive, Legs = n, LegMeters = meters / n, Relay = n > 1 }
end

local EVENTS: { Event } = {
	makeEvent("60m", 60, 36.8, 25),
	makeEvent("100m", 100, 37.9, 30),
	makeEvent("200m", 200, 37.7, 25),
	makeEvent("400m", 400, 34.3, 20),
	makeEvent("4x100m", 400, 37.9, 30, 4),
	makeEvent("4x200m", 800, 37.7, 25, 4),
	makeEvent("4x400m", 1600, 34.3, 20, 4),
}

local Settings = {
	Event = "Rotation", -- "Rotation" or an event name
	AFK = false,
	Uniform = true,
	TrackColor = "Red",
	Camera = "Chase",
	Celebration = "Bolt",
	Voice = true,
	PerformanceMode = false,
	LeftKey = Enum.KeyCode.A,
	RightKey = Enum.KeyCode.D,
	PassKey = Enum.KeyCode.Space,
}

-- colours + shared constants (kept in one table: Luau allows 200 locals)
local K: { [string]: any } = {}
K.ROYAL = Color3.fromRGB(35, 78, 214)
K.ROYAL_LIGHT = Color3.fromRGB(110, 150, 255)
K.WHITE = Color3.fromRGB(248, 249, 253)
K.GOLD = Color3.fromRGB(255, 204, 64)
K.SILVER = Color3.fromRGB(205, 212, 226)
K.BRONZE = Color3.fromRGB(212, 140, 78)
K.C_BG = Color3.fromRGB(9, 13, 30)
K.C_PANEL = Color3.fromRGB(13, 19, 42)
K.C_PANEL2 = Color3.fromRGB(26, 36, 72)
K.C_TEXT = Color3.fromRGB(240, 244, 255)
K.C_MUTED = Color3.fromRGB(146, 160, 200)
K.C_GOOD = Color3.fromRGB(70, 222, 132)
K.C_WARN = Color3.fromRGB(255, 196, 60)
K.C_BAD = Color3.fromRGB(244, 72, 86)

---------------------------------------------------------------------
-- TRACK GEOMETRY (standard 8 lanes, 1.22 m wide, lane 1 = 400 m)
---------------------------------------------------------------------
local SPM = CONFIG.StudsPerMeter
local LANES = CONFIG.Lanes
local LANE_W = 1.22 * SPM
local STRAIGHT = 105 * SPM
local R1 = (400 - 2 * 105) / (2 * math.pi) * SPM -- lane 1 running radius
local RC = R1 - LANE_W / 2 -- inner kerb radius
local R_OUT = RC + LANES * LANE_W
local HALF = STRAIGHT / 2
local LINE_W = 0.22
local START_BACK = 0.8
local INNER_APRON = 3.5
local OUTER_APRON = 4
local BAND_IN = RC - INNER_APRON
local BAND_OUT = R_OUT + OUTER_APRON
local TRACK_TOP = 0.3
local LINE_TOP = 0.33
local MARK_TOP = 0.35
local FLOOR_TOP = 0.36
local BEND_SEGMENTS = 36
local FINISH_S = STRAIGHT

local function laneRadius(lane: number): number
	return RC + (lane - 0.5) * LANE_W
end

local function laneLoop(lane: number): number
	return 2 * STRAIGHT + 2 * math.pi * laneRadius(lane)
end

-- Position + direction on a lane. s = studs from the start of the home
-- straight, running counter-clockwise (infield on the left).
local function trackSample(lane: number, s: number): (Vector3, Vector3)
	local r = laneRadius(lane)
	local arc = math.pi * r
	s = s % (2 * STRAIGHT + 2 * arc)
	if s < STRAIGHT then
		return Vector3.new(-HALF + s, FLOOR_TOP, r), Vector3.new(1, 0, 0)
	end
	s -= STRAIGHT
	if s < arc then
		local a = s / r
		return Vector3.new(HALF + r * math.sin(a), FLOOR_TOP, r * math.cos(a)), Vector3.new(math.cos(a), 0, -math.sin(a))
	end
	s -= arc
	if s < STRAIGHT then
		return Vector3.new(HALF - s, FLOOR_TOP, -r), Vector3.new(-1, 0, 0)
	end
	s -= STRAIGHT
	local a = s / r
	return Vector3.new(-HALF - r * math.sin(a), FLOOR_TOP, -r * math.cos(a)), Vector3.new(-math.cos(a), 0, math.sin(a))
end

local function onBend(lane: number, s: number): boolean
	local arc = math.pi * laneRadius(lane)
	s = s % (2 * STRAIGHT + 2 * arc)
	return (s >= STRAIGHT and s < STRAIGHT + arc) or s >= 2 * STRAIGHT + arc
end

local function startS(event: Event, lane: number): number
	return (FINISH_S - event.Meters * SPM) % laneLoop(lane)
end

---------------------------------------------------------------------
-- HELPERS
---------------------------------------------------------------------
local rng = Random.new()

local function create(className: string, props: { [string]: any }?, children: { Instance }?): any
	local inst: any = Instance.new(className)
	local parent = nil
	if props then
		for k, v in pairs(props) do
			if k == "Parent" then
				parent = v
			else
				inst[k] = v
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

local function shuffle(list: { any })
	for i = #list, 2, -1 do
		local j = rng:NextInteger(1, i)
		list[i], list[j] = list[j], list[i]
	end
	return list
end

-- official time: rounded UP to the hundredth (real athletics rule)
local function officialTime(t: number): number
	return math.ceil(t * 100 - 1e-6) / 100
end

local function fmtTime(v: number): string
	if v >= 60 then
		local m = math.floor(v / 60)
		return string.format("%d:%05.2f", m, v - m * 60)
	end
	return string.format("%.2f", v)
end

local function fmtOfficial(t: number?): string
	if not t then
		return "--"
	end
	return fmtTime(officialTime(t))
end

local function fmtClock(t: number): string
	return fmtTime(math.floor(t * 100) / 100)
end

local function ordinal(n: number): string
	local suffix = "th"
	local m100 = n % 100
	if m100 < 11 or m100 > 13 then
		local m10 = n % 10
		if m10 == 1 then
			suffix = "st"
		elseif m10 == 2 then
			suffix = "nd"
		elseif m10 == 3 then
			suffix = "rd"
		end
	end
	return tostring(n) .. suffix
end

local function smoothstep(x: number): number
	x = math.clamp(x, 0, 1)
	return x * x * (3 - 2 * x)
end

---------------------------------------------------------------------
-- WORLD
---------------------------------------------------------------------
local oldWorld = Workspace:FindFirstChild("TrackAndField_World")
if oldWorld then
	oldWorld:Destroy()
end
local World = create("Folder", { Name = "TrackAndField_World", Parent = Workspace })
local TrackFolder = create("Folder", { Name = "Track", Parent = World })
local DecorFolder = create("Folder", { Name = "Decor", Parent = World })
local RaceFolder = create("Folder", { Name = "RaceProps", Parent = World })

local trackSurfaces: { BasePart } = {}
local texturedParts: { { part: BasePart, material: Enum.Material } } = {}

local function block(props: { [string]: any }): BasePart
	local p = create("Part", {
		Anchored = true,
		CanCollide = false,
		CanTouch = false,
		CanQuery = false,
		CastShadow = false,
		TopSurface = Enum.SurfaceType.Smooth,
		BottomSurface = Enum.SurfaceType.Smooth,
	})
	for k, v in pairs(props) do
		if k ~= "Parent" then
			p[k] = v
		end
	end
	p.Parent = props.Parent or TrackFolder
	if p.Material ~= Enum.Material.SmoothPlastic and p.Material ~= Enum.Material.Neon then
		table.insert(texturedParts, { part = p, material = p.Material })
	end
	return p
end

local function flat(name: string, cf: CFrame, sizeX: number, sizeZ: number, top: number, color: Color3, material: Enum.Material, thick: number?, parent: Instance?): BasePart
	local t = thick or 0.05
	local pos = cf.Position
	return block({
		Name = name,
		Size = Vector3.new(sizeX, t, sizeZ),
		CFrame = CFrame.new(pos.X, top - t / 2, pos.Z) * cf.Rotation,
		Color = color,
		Material = material,
		Parent = parent,
	})
end

local function hideBaseplate()
	local bp = Workspace:FindFirstChild("Baseplate")
	if bp and bp:IsA("BasePart") then
		bp.Transparency = 1
		for _, c in ipairs(bp:GetChildren()) do
			if c:IsA("Decal") then
				c.Transparency = 1
			end
		end
	end
end

-- terrain: grass field, carved under the track, hills, a lake, clouds
local terrain = Workspace.Terrain
K.LAKE_CENTER = Vector3.new(-150, 0, -300)
K.LAKE_SIZE = Vector3.new(300, 0, 120)
K.HILLS = {
	{ -760, -480, 170 },
	{ -320, -760, 150 },
	{ 260, -800, 190 },
	{ 740, -460, 160 },
	{ 820, 220, 150 },
	{ 520, 700, 180 },
	{ -220, 780, 165 },
	{ -780, 360, 150 },
}

local function buildTerrain()
	local ok, err = pcall(function()
		terrain:SetMaterialColor(Enum.Material.Grass, Color3.fromRGB(88, 150, 62))
		terrain:SetMaterialColor(Enum.Material.LeafyGrass, Color3.fromRGB(72, 128, 50))
		terrain:SetMaterialColor(Enum.Material.Sand, Color3.fromRGB(216, 198, 152))
		terrain.WaterColor = Color3.fromRGB(40, 116, 146)
		terrain.WaterWaveSize = 0.12
		terrain.WaterWaveSpeed = 8
		terrain.WaterTransparency = 0.55
		terrain.WaterReflectance = 0.6
		terrain:FillBlock(CFrame.new(0, -6, 0), Vector3.new(1800, 12, 1800), Enum.Material.Grass)
		-- carve under the track so the grass never pokes through it
		for _, sign in ipairs({ 1, -1 }) do
			terrain:FillCylinder(CFrame.new(sign * HALF, -3, 0), 6, R_OUT + 1.5, Enum.Material.Air)
			local zIn, zOut = RC - 1.2, R_OUT + 1.5
			terrain:FillBlock(CFrame.new(0, -3, sign * (zIn + zOut) / 2), Vector3.new(STRAIGHT, 6, zOut - zIn), Enum.Material.Air)
		end
		-- give the infield its grass back
		for _, sign in ipairs({ 1, -1 }) do
			terrain:FillCylinder(CFrame.new(sign * HALF, -3, 0), 6, RC - 1.2, Enum.Material.Grass)
		end
		terrain:FillBlock(CFrame.new(0, -3, 0), Vector3.new(STRAIGHT, 6, 2 * (RC - 1.2)), Enum.Material.Grass)
		-- lake with a sandy shore
		terrain:FillBlock(CFrame.new(K.LAKE_CENTER.X, -4, K.LAKE_CENTER.Z), Vector3.new(K.LAKE_SIZE.X + 28, 8, K.LAKE_SIZE.Z + 28), Enum.Material.Sand)
		terrain:FillBlock(CFrame.new(K.LAKE_CENTER.X, -4.5, K.LAKE_CENTER.Z), Vector3.new(K.LAKE_SIZE.X, 7, K.LAKE_SIZE.Z), Enum.Material.Water)
		-- rolling hills on the horizon
		for i, h in ipairs(K.HILLS) do
			terrain:FillBall(Vector3.new(h[1], -h[3] * 0.55, h[2]), h[3], if i % 2 == 0 then Enum.Material.LeafyGrass else Enum.Material.Grass)
		end
		if not terrain:FindFirstChildOfClass("Clouds") then
			create("Clouds", { Name = "TF_Clouds", Cover = 0.5, Density = 0.55, Color = Color3.fromRGB(255, 255, 255), Parent = terrain })
		end
	end)
	if not ok then
		warn("[Track And Field] terrain could not be built: " .. tostring(err))
	end
end

K.TRACK_COLORS = {
	Red = Color3.fromRGB(176, 58, 46),
	Blue = Color3.fromRGB(36, 88, 168),
}
K.LINE_COLOR = Color3.fromRGB(245, 245, 245)
K.APRON_COLOR = Color3.fromRGB(148, 150, 158)
K.KERB_COLOR = Color3.fromRGB(222, 224, 230)
K.TRACK_MATERIAL = Enum.Material.Fabric

local function label3D(parent: Instance, face: Enum.NormalId, ppu: number, texts: { { any } }): any
	local sg = create("SurfaceGui", {
		Face = face,
		SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud,
		PixelsPerStud = ppu,
		LightInfluence = 0.15,
		Parent = parent,
	})
	for _, t in ipairs(texts) do
		create("TextLabel", {
			Name = t[1],
			Position = t[2],
			Size = t[3],
			BackgroundTransparency = if t[6] then 0 else 1,
			BackgroundColor3 = t[6] or Color3.new(0, 0, 0),
			BorderSizePixel = 0,
			Text = t[4],
			TextScaled = true,
			Font = Enum.Font.GothamBlack,
			TextColor3 = t[5],
			Parent = sg,
		})
	end
	return sg
end

local gantryClocks: { TextLabel } = {}
local boardGui: any = nil

local function buildTrack()
	local trackColor = K.TRACK_COLORS[Settings.TrackColor]
	local segAngle = math.pi / BEND_SEGMENTS
	local zMid = (RC + R_OUT) / 2
	local function len(r: number): number
		return 2 * r * math.tan(segAngle / 2)
	end
	-- bends: flat segments (no overlapping layers = no flicker)
	for _, sign in ipairs({ 1, -1 }) do
		local center = Vector3.new(sign * HALF, 0, 0)
		for i = 0, BEND_SEGMENTS - 1 do
			local a = (i + 0.5) * segAngle
			local out = Vector3.new(sign * math.sin(a), 0, sign * math.cos(a))
			local function segCF(r: number): CFrame
				local pos = center + out * r
				return CFrame.lookAt(pos, pos + out)
			end
			table.insert(trackSurfaces, flat("Bend", segCF(zMid), len(R_OUT) + 0.05, R_OUT - RC, TRACK_TOP, trackColor, K.TRACK_MATERIAL))
			table.insert(trackSurfaces, flat("OuterApron", segCF((R_OUT + BAND_OUT) / 2), len(BAND_OUT) + 0.05, OUTER_APRON, TRACK_TOP, trackColor, K.TRACK_MATERIAL))
			flat("InnerApron", segCF((BAND_IN + RC) / 2), len(RC) + 0.05, INNER_APRON, TRACK_TOP, K.APRON_COLOR, Enum.Material.Concrete)
			flat("Kerb", segCF(RC - 0.25), len(RC) + 0.02, 0.5, TRACK_TOP + 0.12, K.KERB_COLOR, Enum.Material.Metal, 0.17)
			for k = 1, LANES do
				local r = RC + k * LANE_W
				flat("BendLine", segCF(r), len(r) + 0.02, LINE_W, LINE_TOP, K.LINE_COLOR, Enum.Material.SmoothPlastic, 0.02)
			end
			local fcf = segCF((BAND_IN + BAND_OUT) / 2)
			block({
				Name = "BendFloor",
				Size = Vector3.new(len(BAND_OUT) + 0.1, 0.2, BAND_OUT - BAND_IN),
				CFrame = CFrame.new(fcf.Position.X, FLOOR_TOP - 0.1, fcf.Position.Z) * fcf.Rotation,
				Transparency = 1,
				CanCollide = true,
				CanQuery = true,
				Material = Enum.Material.SmoothPlastic,
			})
		end
	end
	-- straights
	for _, sign in ipairs({ 1, -1 }) do
		table.insert(trackSurfaces, flat("Straight", CFrame.new(0, 0, sign * zMid), STRAIGHT, LANES * LANE_W, TRACK_TOP, trackColor, K.TRACK_MATERIAL))
		table.insert(trackSurfaces, flat("OuterApron", CFrame.new(0, 0, sign * (R_OUT + BAND_OUT) / 2), STRAIGHT, OUTER_APRON, TRACK_TOP, trackColor, K.TRACK_MATERIAL))
		flat("InnerApron", CFrame.new(0, 0, sign * (BAND_IN + RC) / 2), STRAIGHT, INNER_APRON, TRACK_TOP, K.APRON_COLOR, Enum.Material.Concrete)
		flat("Kerb", CFrame.new(0, 0, sign * (RC - 0.25)), STRAIGHT, 0.5, TRACK_TOP + 0.12, K.KERB_COLOR, Enum.Material.Metal, 0.17)
		for k = 1, LANES do
			flat("LaneLine", CFrame.new(0, 0, sign * (RC + k * LANE_W)), STRAIGHT, LINE_W, LINE_TOP, K.LINE_COLOR, Enum.Material.SmoothPlastic, 0.02)
		end
		block({
			Name = "StraightFloor",
			Size = Vector3.new(STRAIGHT, 0.2, BAND_OUT - BAND_IN),
			CFrame = CFrame.new(0, FLOOR_TOP - 0.1, sign * (BAND_IN + BAND_OUT) / 2),
			Transparency = 1,
			CanCollide = true,
			CanQuery = true,
			Material = Enum.Material.SmoothPlastic,
		})
	end

	-- finish line + start lines for every event (staggered on the bends)
	flat("FinishLine", CFrame.new(HALF, 0, zMid), 0.45, LANES * LANE_W, MARK_TOP, K.LINE_COLOR, Enum.Material.SmoothPlastic, 0.02)
	local seen = {}
	for _, e in ipairs(EVENTS) do
		for lane = 1, LANES do
			local s = startS(e, lane)
			local key = lane .. ":" .. math.floor(s * 2 + 0.5)
			if not seen[key] and math.abs(s - FINISH_S) > 0.5 then
				seen[key] = true
				local pos, dir = trackSample(lane, s)
				flat("StartLine", CFrame.lookAt(pos, pos + dir), LANE_W - LINE_W, 0.2, MARK_TOP, K.LINE_COLOR, Enum.Material.SmoothPlastic, 0.02)
			end
		end
	end

	-- lane numbers painted after the finish line
	for lane = 1, LANES do
		local pos = Vector3.new(HALF + 4, MARK_TOP, laneRadius(lane))
		local p = flat("LaneNumber" .. lane, CFrame.lookAt(pos, pos + Vector3.new(-1, 0, 0)), 3.2, 3.2, MARK_TOP + 0.005, K.LINE_COLOR, Enum.Material.SmoothPlastic, 0.02)
		p.Transparency = 1
		label3D(p, Enum.NormalId.Top, 40, { { "N", UDim2.fromScale(0, 0), UDim2.fromScale(1, 1), tostring(lane), K.LINE_COLOR } })
	end

	-- finish gantry with banner and clock
	local gz1, gz2 = BAND_IN - 1.5, BAND_OUT + 1.5
	for _, gz in ipairs({ gz1, gz2 }) do
		block({
			Name = "GantryPillar",
			Size = Vector3.new(1.4, 15, 1.4),
			CFrame = CFrame.new(HALF + 0.9, 7.5, gz),
			Color = K.WHITE,
			Material = Enum.Material.Metal,
			CanCollide = true,
			CastShadow = true,
		})
	end
	local beam = block({
		Name = "GantryBeam",
		Size = Vector3.new(1.6, 3.4, gz2 - gz1 + 1.4),
		CFrame = CFrame.new(HALF + 0.9, 16.2, (gz1 + gz2) / 2),
		Color = K.ROYAL,
		Material = Enum.Material.SmoothPlastic,
		CastShadow = true,
	})
	for _, face in ipairs({ Enum.NormalId.Left, Enum.NormalId.Right }) do
		local sg = label3D(beam, face, 22, {
			{ "Title", UDim2.fromScale(0.03, 0.12), UDim2.fromScale(0.34, 0.76), "TRACK AND FIELD", K.WHITE },
			{ "Clock", UDim2.fromScale(0.39, 0.08), UDim2.fromScale(0.22, 0.84), "0.00", K.GOLD, Color3.fromRGB(8, 10, 20) },
			{ "Finish", UDim2.fromScale(0.64, 0.12), UDim2.fromScale(0.33, 0.76), "T&F  FINISH", K.WHITE },
		})
		local clock = sg:FindFirstChild("Clock")
		if clock then
			table.insert(gantryClocks, clock)
		end
	end
	-- photo-finish camera post
	block({ Name = "FinishPost", Size = Vector3.new(0.4, 7, 0.4), CFrame = CFrame.new(HALF, 3.5, BAND_IN - 4), Color = K.WHITE, Material = Enum.Material.Metal, CanCollide = true })
	block({ Name = "FinishCamera", Size = Vector3.new(1.2, 0.9, 1.4), CFrame = CFrame.new(HALF, 7.4, BAND_IN - 4), Color = Color3.fromRGB(25, 25, 30) })

	-- big LED timing board beside the finish
	for _, dz in ipairs({ -8, 8 }) do
		block({ Name = "BoardLeg", Size = Vector3.new(0.6, 8, 0.6), CFrame = CFrame.new(HALF - 18 + dz, 4, BAND_OUT + 18), Color = Color3.fromRGB(60, 62, 70), Material = Enum.Material.Metal, CanCollide = true })
	end
	local board = block({
		Name = "TimingBoard",
		Size = Vector3.new(22, 9, 0.8),
		CFrame = CFrame.new(HALF - 18, 12, BAND_OUT + 18),
		Color = Color3.fromRGB(14, 16, 24),
		Material = Enum.Material.SmoothPlastic,
		CanCollide = true,
		CastShadow = true,
	})
	boardGui = label3D(board, Enum.NormalId.Front, 20, {
		{ "Event", UDim2.fromScale(0.04, 0.05), UDim2.fromScale(0.92, 0.18), "TRACK AND FIELD", K.WHITE },
		{ "Time", UDim2.fromScale(0.04, 0.24), UDim2.fromScale(0.92, 0.34), "0.00", K.GOLD },
		{ "Row1", UDim2.fromScale(0.06, 0.62), UDim2.fromScale(0.88, 0.11), "", K.C_TEXT },
		{ "Row2", UDim2.fromScale(0.06, 0.74), UDim2.fromScale(0.88, 0.11), "", K.C_TEXT },
		{ "Row3", UDim2.fromScale(0.06, 0.86), UDim2.fromScale(0.88, 0.11), "", K.C_TEXT },
	})
end

local flags: { { part: BasePart, base: CFrame, phase: number } } = {}

local function buildDecor()
	DecorFolder:ClearAllChildren()
	table.clear(flags)
	local r = Random.new(11)
	local woodWhite = Color3.fromRGB(240, 238, 232)
	local fenceX = HALF + R_OUT + 30
	local fenceZ = R_OUT + 30

	-- white picket fence around the track
	local sides: { { any } } = { { 0, fenceZ, 2 * fenceX, false }, { 0, -fenceZ, 2 * fenceX, false }, { fenceX, 0, 2 * fenceZ, true }, { -fenceX, 0, 2 * fenceZ, true } }
	for _, side in ipairs(sides) do
		local cx, cz, length, alongZ = side[1], side[2], side[3], side[4]
		for _, h in ipairs({ 1.2, 2.5 }) do
			block({
				Name = "FenceRail",
				Size = if alongZ then Vector3.new(0.25, 0.35, length) else Vector3.new(length, 0.35, 0.25),
				CFrame = CFrame.new(cx, h, cz),
				Color = woodWhite,
				Material = Enum.Material.Wood,
				Parent = DecorFolder,
			})
		end
		local n = math.floor(length / 12)
		for i = 0, n do
			local t = -length / 2 + i * (length / n)
			block({
				Name = "FencePost",
				Size = Vector3.new(0.5, 3.4, 0.5),
				CFrame = if alongZ then CFrame.new(cx, 1.7, t) else CFrame.new(t, 1.7, cz),
				Color = woodWhite,
				Material = Enum.Material.Wood,
				Parent = DecorFolder,
			})
		end
	end

	-- trees (oaks + pines) outside the fence, away from the lake
	local function oak(x: number, z: number)
		local h = r:NextNumber(9, 16)
		block({
			Name = "Trunk",
			Shape = Enum.PartType.Cylinder,
			Size = Vector3.new(h, 1.7, 1.7),
			CFrame = CFrame.new(x, h / 2, z) * CFrame.Angles(0, 0, math.pi / 2),
			Color = Color3.fromRGB(104, 74, 50),
			Material = Enum.Material.Wood,
			CastShadow = true,
			CanCollide = true,
			Parent = DecorFolder,
		})
		local leaf = Color3.fromRGB(46 + r:NextInteger(0, 30), 104 + r:NextInteger(0, 44), 40 + r:NextInteger(0, 14))
		for j = 1, 4 do
			local size = r:NextNumber(7, 11) * (1 - (j - 1) * 0.15)
			block({
				Name = "Leaves",
				Shape = Enum.PartType.Ball,
				Size = Vector3.new(size, size, size),
				CFrame = CFrame.new(x + r:NextNumber(-2.2, 2.2), h + r:NextNumber(-1, 2.5) + (j - 1) * 1.6, z + r:NextNumber(-2.2, 2.2)),
				Color = leaf:Lerp(Color3.new(0, 0, 0), r:NextNumber(0, 0.15)),
				Material = Enum.Material.LeafyGrass,
				CastShadow = true,
				Parent = DecorFolder,
			})
		end
	end
	local function pine(x: number, z: number)
		local h = r:NextNumber(14, 22)
		block({
			Name = "Trunk",
			Shape = Enum.PartType.Cylinder,
			Size = Vector3.new(h * 0.5, 1.3, 1.3),
			CFrame = CFrame.new(x, h * 0.25, z) * CFrame.Angles(0, 0, math.pi / 2),
			Color = Color3.fromRGB(92, 64, 44),
			Material = Enum.Material.Wood,
			CastShadow = true,
			CanCollide = true,
			Parent = DecorFolder,
		})
		local color = Color3.fromRGB(34 + r:NextInteger(0, 14), 82 + r:NextInteger(0, 24), 46)
		for j = 1, 4 do
			local d = (5 - j) * 2.6 + 1.5
			block({
				Name = "Needles",
				Shape = Enum.PartType.Cylinder,
				Size = Vector3.new(h * 0.22, d, d),
				CFrame = CFrame.new(x, h * 0.3 + (j - 1) * h * 0.17, z) * CFrame.Angles(0, 0, math.pi / 2),
				Color = color,
				Material = Enum.Material.LeafyGrass,
				CastShadow = true,
				Parent = DecorFolder,
			})
		end
	end
	local placed, tries = 0, 0
	while placed < 70 and tries < 800 do
		tries += 1
		local x = r:NextNumber(-760, 760)
		local z = r:NextNumber(-620, 620)
		local inField = math.abs(x) < fenceX + 14 and math.abs(z) < fenceZ + 14
		local inLake = math.abs(x - K.LAKE_CENTER.X) < K.LAKE_SIZE.X / 2 + 22 and math.abs(z - K.LAKE_CENTER.Z) < K.LAKE_SIZE.Z / 2 + 22
		if not inField and not inLake then
			placed += 1
			if r:NextNumber() < 0.35 then
				pine(x, z)
			else
				oak(x, z)
			end
		end
	end
	-- bushes along the fence
	for i = 1, 36 do
		local t = i / 36
		local x = -fenceX + t * 2 * fenceX
		local z = (if i % 2 == 0 then 1 else -1) * (fenceZ + 4)
		for j = 1, 3 do
			local s = r:NextNumber(2.5, 4)
			block({
				Name = "Bush",
				Shape = Enum.PartType.Ball,
				Size = Vector3.new(s, s * 0.8, s),
				CFrame = CFrame.new(x + r:NextNumber(-2, 2), s * 0.3, z + r:NextNumber(-1.5, 1.5)),
				Color = Color3.fromRGB(52 + r:NextInteger(0, 20), 112 + r:NextInteger(0, 30), 46),
				Material = Enum.Material.LeafyGrass,
				Parent = DecorFolder,
			})
		end
	end
	-- flower beds near the finish
	local flowerColors = { Color3.fromRGB(255, 92, 140), Color3.fromRGB(255, 214, 70), K.WHITE, Color3.fromRGB(150, 110, 255), Color3.fromRGB(255, 140, 60) }
	for b = 0, 3 do
		local bx = HALF - 70 + b * 26
		local bz = BAND_OUT + 9
		block({ Name = "FlowerBed", Size = Vector3.new(16, 0.5, 5), CFrame = CFrame.new(bx, 0.15, bz), Color = Color3.fromRGB(92, 64, 44), Material = Enum.Material.Ground, Parent = DecorFolder })
		for _ = 1, 16 do
			local s = r:NextNumber(0.6, 1)
			block({
				Name = "Flower",
				Shape = Enum.PartType.Ball,
				Size = Vector3.new(s, s, s),
				CFrame = CFrame.new(bx + r:NextNumber(-7, 7), 0.6, bz + r:NextNumber(-2, 2)),
				Color = flowerColors[r:NextInteger(1, #flowerColors)],
				Material = Enum.Material.SmoothPlastic,
				Parent = DecorFolder,
			})
		end
	end
	-- flags by the finish (they wave)
	local flagColors = { K.ROYAL, K.WHITE, K.GOLD, K.ROYAL, K.WHITE, Color3.fromRGB(220, 50, 60) }
	for i, c in ipairs(flagColors) do
		local x = HALF - 64 + (i - 1) * 20
		local z = BAND_OUT + 26
		block({ Name = "FlagPole", Shape = Enum.PartType.Cylinder, Size = Vector3.new(16, 0.4, 0.4), CFrame = CFrame.new(x, 8, z) * CFrame.Angles(0, 0, math.pi / 2), Color = K.WHITE, Material = Enum.Material.Metal, Parent = DecorFolder })
		local base = CFrame.new(x, 14.5, z)
		local flag = block({ Name = "Flag", Size = Vector3.new(5, 3, 0.1), CFrame = base * CFrame.new(2.5, 0, 0), Color = c, Material = Enum.Material.Fabric, Parent = DecorFolder })
		table.insert(flags, { part = flag, base = base, phase = i * 0.9 })
	end
	-- benches
	for i = 0, 3 do
		local x = -HALF + 60 + i * 70
		local z = -(fenceZ - 6)
		block({ Name = "BenchSeat", Size = Vector3.new(6, 0.3, 1.6), CFrame = CFrame.new(x, 1.3, z), Color = Color3.fromRGB(140, 96, 60), Material = Enum.Material.Wood, CanCollide = true, Parent = DecorFolder })
		block({ Name = "BenchBack", Size = Vector3.new(6, 1.4, 0.25), CFrame = CFrame.new(x, 2.1, z - 0.7), Color = Color3.fromRGB(140, 96, 60), Material = Enum.Material.Wood, Parent = DecorFolder })
		for _, dx in ipairs({ -2.6, 2.6 }) do
			block({ Name = "BenchLeg", Size = Vector3.new(0.3, 1.2, 1.4), CFrame = CFrame.new(x + dx, 0.6, z), Color = Color3.fromRGB(60, 60, 64), Material = Enum.Material.Metal, Parent = DecorFolder })
		end
	end
end

-- lighting (client side only)
local fx: { [string]: any } = {}
local function setupLighting()
	for _, c in ipairs(Lighting:GetChildren()) do
		if string.sub(c.Name, 1, 3) == "TF_" then
			c:Destroy()
		end
	end
	Lighting.ClockTime = 15.4
	Lighting.GeographicLatitude = 28
	Lighting.Brightness = 2.8
	Lighting.Ambient = Color3.fromRGB(70, 72, 82)
	Lighting.OutdoorAmbient = Color3.fromRGB(140, 142, 152)
	Lighting.ColorShift_Top = Color3.fromRGB(255, 244, 226)
	Lighting.EnvironmentDiffuseScale = 0.8
	Lighting.EnvironmentSpecularScale = 0.8
	if not Lighting:FindFirstChildOfClass("Sky") then
		create("Sky", { Name = "TF_Sky", Parent = Lighting })
	end
	if not Lighting:FindFirstChildOfClass("Atmosphere") then
		create("Atmosphere", {
			Name = "TF_Atmosphere",
			Density = 0.3,
			Offset = 0.15,
			Color = Color3.fromRGB(200, 215, 235),
			Decay = Color3.fromRGB(106, 130, 175),
			Glare = 0.35,
			Haze = 1.6,
			Parent = Lighting,
		})
	end
	fx.bloom = create("BloomEffect", { Name = "TF_Bloom", Intensity = 0.45, Size = 26, Threshold = 1.4, Parent = Lighting })
	fx.sunrays = create("SunRaysEffect", { Name = "TF_SunRays", Intensity = 0.07, Spread = 0.7, Parent = Lighting })
	fx.color = create("ColorCorrectionEffect", { Name = "TF_Color", Saturation = 0.16, Contrast = 0.1, TintColor = Color3.fromRGB(255, 251, 246), Parent = Lighting })
	fx.blur = create("BlurEffect", { Name = "TF_Blur", Size = 0, Parent = Lighting })
	fx.dof = create("DepthOfFieldEffect", { Name = "TF_DOF", Enabled = false, FarIntensity = 0.35, NearIntensity = 0, FocusDistance = 18, InFocusRadius = 26, Parent = Lighting })
end

local function applyTrackColor()
	local c = K.TRACK_COLORS[Settings.TrackColor]
	for _, p in ipairs(trackSurfaces) do
		p.Color = c
	end
end

---------------------------------------------------------------------
-- RIGS + ANIMATION (R6 and R15, Motor6D or AnimationConstraint)
---------------------------------------------------------------------
-- Poses are written in the parent part's space:
--   pitch > 0 swings a limb forward (or tilts the head up)
--   pitch < 0 on "root" leans the body forward
--   roll  > 0 moves a right limb outward / leans the body left
-- Joints are found by the body part they move.

K.CHILD_PART_R15 = {
	LowerTorso = "root",
	UpperTorso = "waist",
	Head = "neck",
	RightUpperArm = "shoulderR",
	LeftUpperArm = "shoulderL",
	RightLowerArm = "elbowR",
	LeftLowerArm = "elbowL",
	RightUpperLeg = "hipR",
	LeftUpperLeg = "hipL",
	RightLowerLeg = "kneeR",
	LeftLowerLeg = "kneeL",
	RightFoot = "ankleR",
	LeftFoot = "ankleL",
}
K.CHILD_PART_R6 = {
	Torso = "root",
	Head = "neck",
	["Right Arm"] = "shoulderR",
	["Left Arm"] = "shoulderL",
	["Right Leg"] = "hipR",
	["Left Leg"] = "hipL",
}

type JointLink = { joint: any, rot: CFrame, inv: CFrame }
type Rig = { model: Model, isR15: boolean, joints: { [string]: { JointLink } }, cur: { [string]: { number } } }
type Pose = { [string]: { number } }

local function newRig(model: Model): Rig?
	local hum = model:FindFirstChildOfClass("Humanoid")
	if not hum then
		return nil
	end
	local isR15 = hum.RigType == Enum.HumanoidRigType.R15
	local partToKey: { [string]: string } = if isR15 then K.CHILD_PART_R15 else K.CHILD_PART_R6
	local rig: Rig = { model = model, isR15 = isR15, joints = {}, cur = {} }
	local function add(key: string, joint: Instance, rot: CFrame)
		local list = rig.joints[key]
		if not list then
			list = {}
			rig.joints[key] = list
			rig.cur[key] = { 0, 0, 0, 0, 0 }
		end
		table.insert(list, { joint = joint, rot = rot, inv = rot:Inverse() })
	end
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("Motor6D") then
			local p0, p1 = d.Part0, d.Part1
			local key = p1 and partToKey[p1.Name]
			if key and p0 and p1 and p0:IsDescendantOf(model) and p1:IsDescendantOf(model) then
				add(key, d, d.C0.Rotation)
			end
		elseif d:IsA("AnimationConstraint") then
			local a0, a1 = d.Attachment0, d.Attachment1
			local p0 = a0 and a0.Parent
			local p1 = a1 and a1.Parent
			local key = p1 and partToKey[p1.Name]
			if a0 and key and p0 and p0:IsDescendantOf(model) and p1 and p1:IsDescendantOf(model) then
				add(key, d, a0.CFrame.Rotation)
			end
		end
	end
	if not rig.joints.root then
		return nil
	end
	return rig
end

-- joint value: { pitch, yaw, roll, offsetY, offsetZ }
local function J(p: number?, y: number?, r: number?, oy: number?, oz: number?): { number }
	return { p or 0, y or 0, r or 0, oy or 0, oz or 0 }
end
local ZERO_J = J()

local function applyPose(rig: Rig, pose: Pose, alpha: number)
	for key, links in pairs(rig.joints) do
		local target = pose[key] or ZERO_J
		local cur = rig.cur[key]
		for i = 1, 5 do
			cur[i] = cur[i] + (target[i] - cur[i]) * alpha
		end
		local cf = CFrame.new(0, cur[4], cur[5]) * CFrame.Angles(cur[1], cur[2], cur[3])
		for _, link in ipairs(links) do
			link.joint.Transform = link.inv * cf * link.rot
		end
	end
end

local function resetRig(rig: Rig)
	for key, links in pairs(rig.joints) do
		for _, link in ipairs(links) do
			link.joint.Transform = CFrame.identity
		end
		rig.cur[key] = { 0, 0, 0, 0, 0 }
	end
end

-- Sprint cycle keyframes (degrees), 10 keys per stride cycle, right side.
-- u = 0: right foot touchdown. Contact ~20% of the cycle at top speed
-- (Bolt: 0.086 s contact, 4.36 steps/s, 2.70 m steps). Front-side
-- mechanics (Lyles): knee driven high, foot lands under the hips.
-- Hip = thigh angle relative to the trunk, knee/elbow = flexion,
-- ankle = dorsiflexion (+ toes up), shoulder = arm swing (+ forward).
K.TOP = {
	hip = { 26, 8, -14, -6, 22, 50, 74, 76, 60, 40 },
	knee = { 24, 44, 32, 72, 112, 128, 108, 78, 48, 30 },
	ankle = { 4, 14, -24, -12, 2, 10, 16, 16, 12, 8 },
	shoulder = { 40, 64, 58, 26, -12, -42, -52, -44, -14, 18 },
	elbow = { 96, 106, 102, 90, 76, 62, 58, 64, 78, 88 },
}
-- Drive phase (acceleration): longer contact, full hip extension at
-- toe-off (body, hip, knee and ankle in one line), low heel recovery,
-- bigger arm range. The trunk starts at ~45 degrees and rises.
K.DRIVE = {
	hip = { 42, 18, -8, -22, 6, 46, 78, 84, 70, 54 },
	knee = { 46, 54, 38, 18, 58, 88, 96, 86, 66, 50 },
	ankle = { 10, 20, 6, -30, -10, 12, 20, 20, 16, 12 },
	shoulder = { 50, 82, 74, 34, -20, -56, -66, -56, -20, 22 },
	elbow = { 100, 110, 104, 90, 70, 54, 50, 56, 74, 92 },
}

-- periodic Catmull-Rom spline through the keys
local function curve(keys: { number }, u: number): number
	local n = #keys
	local x = (u % 1) * n
	local i = math.floor(x)
	local t = x - i
	local p0 = keys[((i - 1) % n) + 1]
	local p1 = keys[(i % n) + 1]
	local p2 = keys[((i + 1) % n) + 1]
	local p3 = keys[((i + 2) % n) + 1]
	local t2 = t * t
	local t3 = t2 * t
	return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
end

local function cycle(name: string, u: number, drive: number): number
	local a = curve((K.TOP :: any)[name], u)
	local b = curve((K.DRIVE :: any)[name], u)
	return math.rad(a + (b - a) * drive)
end

-- u: stride phase 0..1, amp: 0..1 effort, drive: 1 = first step, 0 = upright,
-- bend: body lean into the curve (radians, + = left)
local function poseRun(u: number, amp: number, drive: number, bend: number, isR15: boolean): Pose
	local uL = (u + 0.5) % 1
	local lean = -math.rad(8 + 37 * drive)
	local twist = math.sin((u - 0.4) * math.pi * 2)
	if isR15 then
		local bob = (-0.08 * math.cos((u - 0.08) * math.pi * 4) - 0.02) * amp - 0.45 * drive
		return {
			root = J(lean, math.rad(7) * twist * amp, bend, bob, -0.3 * drive),
			waist = J(-0.03, -math.rad(12) * twist * amp, -bend * 0.3),
			neck = J(-lean * 0.75 - 0.05 * drive, math.rad(5) * twist * amp, -bend * 0.4),
			hipR = J(cycle("hip", u, drive) * amp),
			hipL = J(cycle("hip", uL, drive) * amp),
			kneeR = J(-cycle("knee", u, drive) * amp),
			kneeL = J(-cycle("knee", uL, drive) * amp),
			ankleR = J(cycle("ankle", u, drive) * amp),
			ankleL = J(cycle("ankle", uL, drive) * amp),
			shoulderR = J(cycle("shoulder", u, drive) * amp, 0, 0.12),
			shoulderL = J(cycle("shoulder", uL, drive) * amp, 0, -0.12),
			elbowR = J(cycle("elbow", u, drive)),
			elbowL = J(cycle("elbow", uL, drive)),
		}
	end
	-- R6 has straight limbs: smaller leg range, bigger arm swing
	local leanR6 = -math.rad(6 + 26 * drive)
	return {
		root = J(leanR6, math.rad(5) * twist * amp, bend, 0.1 * amp * math.abs(math.cos(u * math.pi * 2)) - 0.2 * drive),
		neck = J(-leanR6 * 0.7, 0, -bend * 0.4),
		hipR = J((cycle("hip", u, drive) * 0.8 - math.rad(8)) * amp),
		hipL = J((cycle("hip", uL, drive) * 0.8 - math.rad(8)) * amp),
		shoulderR = J((cycle("shoulder", u, drive) * 1.15 + math.rad(6)) * amp, 0, 0.1),
		shoulderL = J((cycle("shoulder", uL, drive) * 1.15 + math.rad(6)) * amp, 0, -0.1),
	}
end

local function poseStand(t: number): Pose
	local breathe = math.sin(t * 2.2) * 0.02
	return {
		root = J(0, 0, 0, breathe),
		shoulderR = J(0.05, 0, 0.08),
		shoulderL = J(0.05, 0, -0.08),
		elbowR = J(0.15),
		elbowL = J(0.15),
	}
end

-- "On your marks": back knee down, hands just behind the line
local function poseMarks(isR15: boolean): Pose
	if isR15 then
		return {
			root = J(-0.8, 0, 0, -1.05, -0.2),
			waist = J(-0.1),
			neck = J(0.45),
			shoulderR = J(0.95, 0, 0.12),
			shoulderL = J(0.95, 0, -0.12),
			hipL = J(2.1),
			kneeL = J(-1.75),
			ankleL = J(0.3),
			hipR = J(0.7),
			kneeR = J(-1.45),
			ankleR = J(0.5),
		}
	end
	return {
		root = J(-0.7, 0, 0, -0.9),
		neck = J(0.4),
		shoulderR = J(0.75, 0, 0.1),
		shoulderL = J(0.75, 0, -0.1),
		hipL = J(1.5),
		hipR = J(0.25),
	}
end

-- "Set": hips up, front knee ~95 degrees, back knee ~125 degrees
local function poseSet(isR15: boolean): Pose
	if isR15 then
		return {
			root = J(-1.15, 0, 0, -0.55, -0.35),
			waist = J(-0.12),
			neck = J(0.6),
			shoulderR = J(1.3, 0, 0.12),
			shoulderL = J(1.3, 0, -0.12),
			hipL = J(2.05),
			kneeL = J(-1.5),
			ankleL = J(0.35),
			hipR = J(1.3),
			kneeR = J(-0.95),
			ankleR = J(0.4),
		}
	end
	return {
		root = J(-1.05, 0, 0, -0.45),
		neck = J(0.55),
		shoulderR = J(1.05, 0, 0.1),
		shoulderL = J(1.05, 0, -0.1),
		hipL = J(1.75),
		hipR = J(0.85),
	}
end

-- finish: lunge the chest over the line, arms swept back
local function poseDip(isR15: boolean): Pose
	if isR15 then
		return {
			root = J(-1.0, 0, 0, -0.35, -0.3),
			waist = J(-0.22),
			neck = J(0.7),
			shoulderR = J(-1.25, 0, 0.25),
			shoulderL = J(-1.25, 0, -0.25),
			elbowR = J(0.25),
			elbowL = J(0.25),
			hipL = J(1.35),
			kneeL = J(-0.25),
			hipR = J(0.3),
			kneeR = J(-0.9),
			ankleR = J(-0.5),
		}
	end
	return {
		root = J(-0.9, 0, 0, -0.15),
		neck = J(0.6),
		shoulderR = J(-1.2, 0, 0.2),
		shoulderL = J(-1.2, 0, -0.2),
		hipL = J(1.3),
		hipR = J(0.2),
	}
end

local function poseCelebrate(kind: string, t: number, isR15: boolean): Pose
	if kind == "bolt" then
		-- Usain Bolt's lightning pose: lean back, left arm pointing to the sky,
		-- right arm drawn back like a bow
		local sway = math.sin(t * 2) * 0.03
		return {
			root = J(0.16 + sway, 0.35, -0.05),
			waist = J(0.08, 0.15),
			neck = J(0.5, 0.35),
			shoulderL = J(2.45, 0, -0.7),
			elbowL = J(0.05),
			shoulderR = J(isR15 and 0.85 or 1.2, 0, 0.45),
			elbowR = J(2.1 + math.sin(t * 3) * 0.08),
			hipR = J(0, 0, 0.12),
			hipL = J(0.3, 0, -0.1),
			kneeL = J(-0.35),
		}
	elseif kind == "lyles" then
		-- Noah Lyles' anime power-up: wide stance, fists clenched, shaking
		local shake = math.sin(t * 38) * 0.035
		return {
			root = J(0.08, 0, shake, isR15 and -0.35 or -0.05),
			neck = J(0.45 + shake),
			shoulderR = J(0.35 + shake, 0, 0.5),
			shoulderL = J(0.35 - shake, 0, -0.5),
			elbowR = J(1.65),
			elbowL = J(1.65),
			hipR = J(0.25, 0, 0.32),
			hipL = J(0.25, 0, -0.32),
			kneeR = J(-0.55),
			kneeL = J(-0.55),
		}
	elseif kind == "podium" then
		local bounce = math.abs(math.sin(t * 4.5)) * 0.15
		return {
			root = J(0.1, 0, 0, bounce),
			neck = J(0.3),
			shoulderR = J(2.75, 0, 0.5),
			shoulderL = J(2.75, 0, -0.5),
			elbowR = J(0.2),
			elbowL = J(0.2),
		}
	elseif kind == "dq" then
		return {
			root = J(0, 0, 0, math.sin(t * 2) * 0.02),
			neck = J(-0.35),
			shoulderR = J(isR15 and 2.4 or 2.9, 0, isR15 and 1.05 or 0.55),
			shoulderL = J(isR15 and 2.4 or 2.9, 0, isR15 and -1.05 or -0.55),
			elbowR = J(2.3),
			elbowL = J(2.3),
		}
	end
	-- tired: hands on knees, breathing hard
	local breathe = math.sin(t * 5) * 0.04
	return {
		root = J(-0.8 + breathe, 0, 0, isR15 and -0.3 or -0.1),
		neck = J(0.5),
		shoulderR = J(isR15 and 1.05 or 0.95, 0, 0.12),
		shoulderL = J(isR15 and 1.05 or 0.95, 0, -0.12),
		elbowR = J(0.25),
		elbowL = J(0.25),
		hipR = J(isR15 and 1.15 or 0.8, 0, 0.1),
		hipL = J(isR15 and 1.15 or 0.8, 0, -0.1),
		kneeR = J(-0.4),
		kneeL = J(-0.4),
	}
end

local function rootHeightOf(model: Model): number
	local hum = model:FindFirstChildOfClass("Humanoid")
	local root = model:FindFirstChild("HumanoidRootPart") :: BasePart?
	if hum and root then
		if hum.RigType == Enum.HumanoidRigType.R15 then
			return hum.HipHeight + root.Size.Y / 2
		end
		local leg = model:FindFirstChild("Left Leg") :: BasePart?
		return (if leg then leg.Size.Y else 2) + root.Size.Y / 2
	end
	return 3
end

---------------------------------------------------------------------
-- ATHLETES (rivals are times only - nobody else runs on the track)
---------------------------------------------------------------------
type Athlete = { Name: string, IsPlayer: boolean, Skill: { [string]: number }, Tau: number, PassSkill: number }

K.USERNAMES = {
	"BoltStrike_99", "LylesFan2008", "TurboTyler", "Zoomie_Kai", "FlashMaria07", "KingOfTheBend",
	"Dash_Daniel", "RocketRiya", "SwiftSamu", "BlazeRunner_12", "Lightning_Leo", "AceSprinter44",
	"NoLimitNate", "QuickSilverQ", "Hyper_Hailey", "VelocityVic", "SonicSofia", "StrideKing_J",
	"TrackGod_23", "Mach5Marcus",
}
K.TEAMS = {
	"Velocity TC", "Lightning AC", "Thunder Track", "Rocket Relays", "Blaze Athletics", "Swift Striders",
	"Storm Sprint Co", "Nova Flyers", "Jet Stream TC", "Apex Runners", "Comet Club", "Turbo Tracks",
	"Falcon AC", "Vortex Velocity", "Phoenix Sprint", "Titan Track",
}

local function makeRoster(names: { string }): { Athlete }
	local list = {}
	local pool = shuffle(table.clone(names))
	for i = 1, 16 do
		local base = rng:NextNumber(0.958, 0.998)
		local skill = {}
		for _, e in ipairs(EVENTS) do
			skill[e.Name] = math.clamp(base + rng:NextNumber(-0.008, 0.008), 0.95, 1)
		end
		table.insert(list, {
			Name = pool[i],
			IsPlayer = false,
			Skill = skill,
			Tau = rng:NextNumber(1.16, 1.34),
			PassSkill = rng:NextNumber(0.93, 0.995),
		})
	end
	return list
end

local roster = makeRoster(K.USERNAMES)
local teamRoster = makeRoster(K.TEAMS)
local youAthlete: Athlete = { Name = player.Name, IsPlayer = true, Skill = {}, Tau = CONFIG.PlayerTau, PassSkill = 1 }
local youTeam: Athlete = { Name = "Team " .. player.Name, IsPlayer = true, Skill = {}, Tau = CONFIG.PlayerTau, PassSkill = 1 }

K.WR_HOLDERS = {
	["60m"] = "LegendLightning",
	["100m"] = "BoltLegacy_958",
	["200m"] = "BendMaster_LY",
	["400m"] = "IronLungs400",
	["4x100m"] = "Lightning AC",
	["4x200m"] = "Velocity TC",
	["4x400m"] = "Thunder Track",
}
local worldRecords: { [string]: { time: number, holder: string, isPlayer: boolean } } = {}
local seasonBests: { [string]: { { name: string, time: number, isPlayer: boolean } } } = {}
for _, e in ipairs(EVENTS) do
	seasonBests[e.Name] = {}
end

local function recordBest(eventName: string, athlete: Athlete, t: number)
	local list = seasonBests[eventName]
	local found = false
	for _, e in ipairs(list) do
		if e.name == athlete.Name then
			found = true
			if t < e.time then
				e.time = t
			end
		end
	end
	if not found then
		table.insert(list, { name = athlete.Name, time = t, isPlayer = athlete.IsPlayer })
	end
	table.sort(list, function(a, b)
		return a.time < b.time
	end)
end

local function bestOf(eventName: string, name: string): number?
	for _, e in ipairs(seasonBests[eventName]) do
		if e.name == name then
			return e.time
		end
	end
	return nil
end

---------------------------------------------------------------------
-- UI
---------------------------------------------------------------------
K.FONT_BLACK = Enum.Font.GothamBlack
K.FONT_BOLD = Enum.Font.GothamBold
K.FONT_REG = Enum.Font.GothamMedium

local UI: { [string]: any } = {} -- every UI element lives here
UI.playerGui = player:WaitForChild("PlayerGui")
for _, n in ipairs({ "TrackAndFieldUI", "TrackAndFieldLoading" }) do
	local o = UI.playerGui:FindFirstChild(n)
	if o then
		o:Destroy()
	end
end

UI.gui = create("ScreenGui", {
	Name = "TrackAndFieldUI",
	ResetOnSpawn = false,
	IgnoreGuiInset = true,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	DisplayOrder = 5,
	Parent = UI.playerGui,
})
UI.loadGui = create("ScreenGui", {
	Name = "TrackAndFieldLoading",
	ResetOnSpawn = false,
	IgnoreGuiInset = true,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	DisplayOrder = 50,
	Enabled = false,
	Parent = UI.playerGui,
})

UI.scales = {}
local function scaled(frame: any): any
	local s = create("UIScale", { Parent = frame })
	table.insert(UI.scales, s)
	return frame
end
local function corner(parent: Instance, r: number?)
	create("UICorner", { CornerRadius = UDim.new(0, r or 10), Parent = parent })
end
local function round(parent: Instance)
	create("UICorner", { CornerRadius = UDim.new(0.5, 0), Parent = parent })
end
local function stroke(parent: Instance, color: Color3?, thickness: number?, transparency: number?)
	create("UIStroke", {
		Color = color or K.WHITE,
		Thickness = thickness or 1,
		Transparency = transparency or 0.85,
		ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
		Parent = parent,
	})
end
local function gradient(parent: Instance, a: Color3, b: Color3, rotation: number?)
	create("UIGradient", { Color = ColorSequence.new(a, b), Rotation = rotation or 90, Parent = parent })
end
local function label(props: { [string]: any }): any
	local base: { [string]: any } = {
		BackgroundTransparency = 1,
		Font = K.FONT_BOLD,
		TextColor3 = K.C_TEXT,
		TextSize = 16,
		TextXAlignment = Enum.TextXAlignment.Left,
	}
	for k, v in pairs(props) do
		base[k] = v
	end
	return create("TextLabel", base)
end
local function button(props: { [string]: any }): any
	local base: { [string]: any } = {
		BackgroundColor3 = K.C_PANEL2,
		AutoButtonColor = true,
		Font = K.FONT_BOLD,
		TextColor3 = K.C_TEXT,
		TextSize = 15,
	}
	for k, v in pairs(props) do
		base[k] = v
	end
	local b = create("TextButton", base)
	corner(b, 8)
	return b
end
local function panel(props: { [string]: any }): any
	local base: { [string]: any } = { BackgroundColor3 = K.WHITE, BackgroundTransparency = 0.08 }
	for k, v in pairs(props) do
		base[k] = v
	end
	local f = create("Frame", base)
	corner(f, 14)
	stroke(f, K.ROYAL_LIGHT, 1.2, 0.55)
	gradient(f, K.C_PANEL2, K.C_BG, 90)
	return f
end

-- touch zones (invisible, no text): left / right half of the screen
UI.touchLeft = create("TextButton", { Name = "TapZoneLeft", Size = UDim2.fromScale(0.5, 1), BackgroundTransparency = 1, Text = "", AutoButtonColor = false, Selectable = false, Visible = false, ZIndex = 0, Parent = UI.gui })
UI.touchRight = create("TextButton", { Name = "TapZoneRight", Size = UDim2.fromScale(0.5, 1), Position = UDim2.fromScale(0.5, 0), BackgroundTransparency = 1, Text = "", AutoButtonColor = false, Selectable = false, Visible = false, ZIndex = 0, Parent = UI.gui })

-- speed lines + flash + vignette (behind the HUD)
UI.fxLayer = create("Frame", { Name = "Effects", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, ZIndex = 1, Parent = UI.gui })
type SpeedLine = { frame: Frame, angle: number, dist: number, rate: number }
UI.speedLines = {}
for i = 1, 18 do
	local f = create("Frame", {
		Name = "SpeedLine" .. i,
		AnchorPoint = Vector2.new(0.5, 0.5),
		Size = UDim2.fromOffset(120, 2),
		BackgroundColor3 = K.WHITE,
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		ZIndex = 1,
		Parent = UI.fxLayer,
	})
	table.insert(UI.speedLines, { frame = f, angle = rng:NextNumber(0, math.pi * 2), dist = rng:NextNumber(0.3, 1), rate = rng:NextNumber(0.9, 1.6) })
end
UI.vignette = {}
local vignetteSpecs: { { any } } = { { UDim2.fromScale(1, 0.2), UDim2.fromScale(0, 0), 90 }, { UDim2.fromScale(1, 0.2), UDim2.fromScale(0, 0.8), 270 }, { UDim2.fromScale(0.15, 1), UDim2.fromScale(0, 0), 0 }, { UDim2.fromScale(0.15, 1), UDim2.fromScale(0.85, 0), 180 } }
for i, spec in ipairs(vignetteSpecs) do
	local v = create("Frame", { Name = "Vignette" .. i, Size = spec[1], Position = spec[2], BackgroundColor3 = Color3.new(0, 0, 0), BorderSizePixel = 0, BackgroundTransparency = 1, ZIndex = 1, Parent = UI.fxLayer })
	create("UIGradient", { Transparency = NumberSequence.new(0, 1), Rotation = spec[3], Parent = v })
	table.insert(UI.vignette, v)
end
UI.flashFrame = create("Frame", { Name = "Flash", Size = UDim2.fromScale(1, 1), BackgroundColor3 = K.WHITE, BackgroundTransparency = 1, BorderSizePixel = 0, ZIndex = 30, Parent = UI.gui })

-- menu buttons (left)
UI.menu = scaled(create("Frame", { Name = "Menu", Position = UDim2.fromOffset(14, 64), Size = UDim2.fromOffset(176, 96), BackgroundTransparency = 1, Parent = UI.gui }))
create("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder, Parent = UI.menu })
UI.lbButton = button({ Name = "LeaderboardButton", Text = "LEADERBOARD  [L]", Size = UDim2.fromOffset(176, 42), LayoutOrder = 1, BackgroundColor3 = K.C_PANEL, Parent = UI.menu })
stroke(UI.lbButton, K.GOLD, 1.5, 0.35)
UI.setButton = button({ Name = "SettingsButton", Text = "SETTINGS  [P]", Size = UDim2.fromOffset(176, 42), LayoutOrder = 2, BackgroundColor3 = K.C_PANEL, Parent = UI.menu })
stroke(UI.setButton, K.ROYAL_LIGHT, 1.5, 0.35)

-- top race bar: event, real race clock, position + progress strip
UI.raceBar = scaled(panel({ Name = "RaceBar", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 8), Size = UDim2.fromOffset(560, 70), Parent = UI.gui }))
UI.evName = label({ Name = "Event", Text = "TRACK AND FIELD", Font = K.FONT_BLACK, TextSize = 22, Position = UDim2.fromOffset(18, 10), Size = UDim2.fromOffset(200, 28), Parent = UI.raceBar })
UI.evRound = label({ Name = "Round", Text = "Getting ready", Font = K.FONT_BOLD, TextSize = 13, TextColor3 = K.ROYAL_LIGHT, Position = UDim2.fromOffset(18, 40), Size = UDim2.fromOffset(200, 18), Parent = UI.raceBar })
UI.clockLabel = label({ Name = "Clock", Text = "0.00", Font = K.FONT_BLACK, TextSize = 40, TextXAlignment = Enum.TextXAlignment.Center, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 30, 0.5, 0), Size = UDim2.fromOffset(170, 50), Parent = UI.raceBar })
UI.posBadge = label({ Name = "Position", Text = "", Font = K.FONT_BLACK, TextSize = 30, TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = K.GOLD, AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -18, 0.5, 0), Size = UDim2.fromOffset(110, 44), Parent = UI.raceBar })
UI.progress = create("Frame", { Name = "Progress", Position = UDim2.new(0, 10, 1, 8), Size = UDim2.new(1, -20, 0, 18), BackgroundTransparency = 1, Visible = false, Parent = UI.raceBar })
UI.progressLine = create("Frame", { Name = "Line", AnchorPoint = Vector2.new(0, 0.5), Position = UDim2.fromScale(0, 0.5), Size = UDim2.new(1, 0, 0, 4), BackgroundColor3 = K.C_PANEL2, BorderSizePixel = 0, Parent = UI.progress })
corner(UI.progressLine, 2)
UI.progressFill = create("Frame", { Name = "Fill", Size = UDim2.fromScale(0, 1), BackgroundColor3 = K.ROYAL, BorderSizePixel = 0, Parent = UI.progressLine })
corner(UI.progressFill, 2)
create("Frame", { Name = "FinishTick", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(1, 0.5), Size = UDim2.fromOffset(4, 16), BackgroundColor3 = K.WHITE, BorderSizePixel = 0, Parent = UI.progress })
UI.zoneTicks = {}
for i = 1, 3 do
	local z = create("Frame", { Name = "Zone" .. i, AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(18, 10), BackgroundColor3 = K.C_WARN, BackgroundTransparency = 0.35, BorderSizePixel = 0, Visible = false, Parent = UI.progress })
	corner(z, 3)
	table.insert(UI.zoneTicks, z)
end
UI.progressDots = {}
for i = 1, 8 do
	local d = create("Frame", { Name = "Dot" .. i, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0, 0.5), Size = UDim2.fromOffset(10, 10), BackgroundColor3 = K.C_MUTED, BorderSizePixel = 0, ZIndex = 2, Parent = UI.progress })
	round(d)
	table.insert(UI.progressDots, d)
end

-- leaderboard (right)
UI.lbPanel = scaled(panel({ Name = "Leaderboard", AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -14, 0, 64), Size = UDim2.fromOffset(312, 446), Parent = UI.gui }))
label({ Text = "LEADERBOARD", Font = K.FONT_BLACK, TextSize = 16, TextColor3 = K.GOLD, Position = UDim2.fromOffset(16, 12), Size = UDim2.fromOffset(200, 20), Parent = UI.lbPanel })
UI.lbSub = label({ Name = "Sub", Text = "", Font = K.FONT_REG, TextSize = 12, TextColor3 = K.C_MUTED, Position = UDim2.fromOffset(16, 34), Size = UDim2.fromOffset(280, 16), TextTruncate = Enum.TextTruncate.AtEnd, Parent = UI.lbPanel })
UI.tabRace = button({ Name = "TabRace", Text = "RACE", TextSize = 13, Position = UDim2.fromOffset(16, 56), Size = UDim2.fromOffset(134, 28), Parent = UI.lbPanel })
UI.tabRecords = button({ Name = "TabRecords", Text = "RECORDS", TextSize = 13, Position = UDim2.fromOffset(162, 56), Size = UDim2.fromOffset(134, 28), Parent = UI.lbPanel })
UI.wrRow = create("Frame", { Name = "WR", Position = UDim2.fromOffset(12, 92), Size = UDim2.fromOffset(288, 34), BackgroundColor3 = Color3.fromRGB(70, 54, 10), Parent = UI.lbPanel })
corner(UI.wrRow, 8)
stroke(UI.wrRow, K.GOLD, 1.2, 0.3)
UI.wrTag = label({ Text = "WR", Font = K.FONT_BLACK, TextSize = 14, TextColor3 = K.GOLD, TextXAlignment = Enum.TextXAlignment.Center, Position = UDim2.fromOffset(4, 0), Size = UDim2.fromOffset(34, 34), Parent = UI.wrRow })
UI.wrTag.Name = "Tag"
UI.wrName = label({ Name = "Holder", Text = "", TextSize = 13, Position = UDim2.fromOffset(42, 0), Size = UDim2.fromOffset(160, 34), TextTruncate = Enum.TextTruncate.AtEnd, Parent = UI.wrRow })
UI.wrTime = label({ Name = "Time", Text = "", Font = K.FONT_BLACK, TextSize = 15, TextColor3 = K.GOLD, TextXAlignment = Enum.TextXAlignment.Right, Position = UDim2.fromOffset(200, 0), Size = UDim2.fromOffset(80, 34), Parent = UI.wrRow })
type Row = { frame: Frame, place: TextLabel, name: TextLabel, info: TextLabel, value: TextLabel }
UI.lbRows = {}
for i = 1, 8 do
	local f = create("Frame", { Name = "Row" .. i, Position = UDim2.fromOffset(12, 132 + (i - 1) * 38), Size = UDim2.fromOffset(288, 34), BackgroundColor3 = K.C_PANEL2, BackgroundTransparency = 0.2, Parent = UI.lbPanel })
	corner(f, 8)
	local place = label({ Text = tostring(i), Font = K.FONT_BLACK, TextSize = 15, TextXAlignment = Enum.TextXAlignment.Center, Position = UDim2.fromOffset(4, 0), Size = UDim2.fromOffset(28, 34), Parent = f })
	local name = label({ Text = "", TextSize = 13, Position = UDim2.fromOffset(36, 0), Size = UDim2.fromOffset(150, 34), TextTruncate = Enum.TextTruncate.AtEnd, Parent = f })
	local info = label({ Text = "", Font = K.FONT_REG, TextSize = 12, TextColor3 = K.C_MUTED, Position = UDim2.fromOffset(186, 0), Size = UDim2.fromOffset(30, 34), Parent = f })
	local value = label({ Text = "", Font = K.FONT_BLACK, TextSize = 14, TextXAlignment = Enum.TextXAlignment.Right, Position = UDim2.fromOffset(206, 0), Size = UDim2.fromOffset(74, 34), Parent = f })
	table.insert(UI.lbRows, { frame = f, place = place, name = name, info = info, value = value })
end

-- bottom HUD: speed, rhythm, reaction, lane / leg, stamina
UI.hud = scaled(panel({ Name = "HUD", AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -12), Size = UDim2.fromOffset(560, 106), Parent = UI.gui }))
UI.speedValue = label({ Name = "Speed", Text = "0.0", Font = K.FONT_BLACK, TextSize = 34, Position = UDim2.fromOffset(18, 6), Size = UDim2.fromOffset(110, 38), Parent = UI.hud })
label({ Name = "SpeedUnit", Text = "STUDS/S", Font = K.FONT_BOLD, TextSize = 11, TextColor3 = K.C_MUTED, Position = UDim2.fromOffset(110, 22), Size = UDim2.fromOffset(60, 14), Parent = UI.hud })
UI.speedBarBack = create("Frame", { Name = "SpeedBar", Position = UDim2.fromOffset(18, 48), Size = UDim2.fromOffset(150, 6), BackgroundColor3 = K.C_PANEL2, BorderSizePixel = 0, Parent = UI.hud })
corner(UI.speedBarBack, 3)
UI.speedBarFill = create("Frame", { Name = "Fill", Size = UDim2.fromScale(0, 1), BackgroundColor3 = K.ROYAL_LIGHT, BorderSizePixel = 0, Parent = UI.speedBarBack })
corner(UI.speedBarFill, 3)
K.RHYTHM_SPAN = 0.5
UI.rhythmBack = create("Frame", { Name = "Rhythm", Position = UDim2.fromOffset(196, 14), Size = UDim2.fromOffset(170, 12), BackgroundColor3 = K.C_PANEL2, BorderSizePixel = 0, Visible = false, Parent = UI.hud })
corner(UI.rhythmBack, 6)
create("Frame", { Name = "Zone", Position = UDim2.fromScale(CONFIG.PerfectMin / K.RHYTHM_SPAN, 0), Size = UDim2.fromScale((CONFIG.PerfectMax - CONFIG.PerfectMin) / K.RHYTHM_SPAN, 1), BackgroundColor3 = K.C_GOOD, BackgroundTransparency = 0.3, BorderSizePixel = 0, Parent = UI.rhythmBack })
UI.rhythmMarker = create("Frame", { Name = "Marker", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0, 0.5), Size = UDim2.new(0, 4, 1, 8), BackgroundColor3 = K.WHITE, BorderSizePixel = 0, Parent = UI.rhythmBack })
UI.rtChip = label({ Name = "Reaction", Text = "", Font = K.FONT_BOLD, TextSize = 13, TextColor3 = K.C_GOOD, TextXAlignment = Enum.TextXAlignment.Center, Position = UDim2.fromOffset(196, 32), Size = UDim2.fromOffset(170, 20), Parent = UI.hud })
UI.laneChip = label({ Name = "Lane", Text = "", Font = K.FONT_BLACK, TextSize = 18, TextColor3 = K.WHITE, TextXAlignment = Enum.TextXAlignment.Right, Position = UDim2.fromOffset(390, 8), Size = UDim2.fromOffset(152, 24), Parent = UI.hud })
UI.legChip = label({ Name = "Leg", Text = "", Font = K.FONT_BOLD, TextSize = 13, TextColor3 = K.C_WARN, TextXAlignment = Enum.TextXAlignment.Right, Position = UDim2.fromOffset(390, 32), Size = UDim2.fromOffset(152, 18), Parent = UI.hud })
label({ Name = "StaminaLabel", Text = "STAMINA", Font = K.FONT_BLACK, TextSize = 13, TextColor3 = K.C_MUTED, Position = UDim2.fromOffset(18, 68), Size = UDim2.fromOffset(80, 22), Parent = UI.hud })
UI.staminaBack = create("Frame", { Name = "StaminaBar", Position = UDim2.fromOffset(100, 72), Size = UDim2.fromOffset(380, 14), BackgroundColor3 = K.C_PANEL2, BorderSizePixel = 0, Parent = UI.hud })
corner(UI.staminaBack, 7)
UI.staminaFill = create("Frame", { Name = "Fill", Size = UDim2.fromScale(1, 1), BackgroundColor3 = K.C_GOOD, BorderSizePixel = 0, Parent = UI.staminaBack })
corner(UI.staminaFill, 7)
create("UIGradient", { Color = ColorSequence.new(Color3.fromRGB(255, 255, 255), Color3.fromRGB(196, 196, 196)), Rotation = 90, Parent = UI.staminaFill })
UI.staminaValue = label({ Name = "StaminaValue", Text = "100", Font = K.FONT_BLACK, TextSize = 20, TextXAlignment = Enum.TextXAlignment.Right, Position = UDim2.fromOffset(486, 66), Size = UDim2.fromOffset(56, 26), Parent = UI.hud })

-- relay PASS prompt (button for phones, key hint on PC)
UI.passButton = create("TextButton", {
	Name = "Pass",
	AnchorPoint = Vector2.new(0.5, 1),
	Position = UDim2.new(0.5, 0, 1, -190),
	Size = UDim2.fromOffset(118, 118),
	BackgroundColor3 = K.C_WARN,
	Text = "PASS",
	Font = K.FONT_BLACK,
	TextSize = 30,
	TextColor3 = K.C_BG,
	AutoButtonColor = true,
	Visible = false,
	ZIndex = 12,
	Parent = UI.gui,
})
round(UI.passButton)
stroke(UI.passButton, K.WHITE, 3, 0.1)
scaled(UI.passButton)
UI.passHint = label({ Name = "Hint", Text = "[SPACE]", Font = K.FONT_BLACK, TextSize = 14, TextColor3 = K.C_BG, TextXAlignment = Enum.TextXAlignment.Center, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0.66, 0), Size = UDim2.fromOffset(100, 18), ZIndex = 13, Parent = UI.passButton })

-- splits (left)
UI.splitsPanel = scaled(panel({ Name = "Splits", Position = UDim2.fromOffset(14, 176), Size = UDim2.fromOffset(176, 160), Visible = false, Parent = UI.gui }))
label({ Text = "SPLITS", Font = K.FONT_BLACK, TextSize = 13, TextColor3 = K.ROYAL_LIGHT, Position = UDim2.fromOffset(14, 8), Size = UDim2.fromOffset(150, 18), Parent = UI.splitsPanel })
UI.splitLabels = {}
for i = 1, 5 do
	table.insert(UI.splitLabels, label({ Name = "Split" .. i, Text = "", Font = K.FONT_BOLD, TextSize = 14, Position = UDim2.fromOffset(14, 30 + (i - 1) * 25), Size = UDim2.fromOffset(150, 22), Parent = UI.splitsPanel }))
end

-- center messages
UI.bigText = label({ Name = "BigText", Text = "", Font = K.FONT_BLACK, TextSize = 66, TextXAlignment = Enum.TextXAlignment.Center, TextStrokeTransparency = 0.45, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.34), Size = UDim2.new(1, 0, 0, 84), ZIndex = 10, Parent = UI.gui })
UI.bigScale = create("UIScale", { Parent = UI.bigText })
UI.subText = label({ Name = "SubText", Text = "", Font = K.FONT_BOLD, TextSize = 22, TextXAlignment = Enum.TextXAlignment.Center, TextStrokeTransparency = 0.55, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.43), Size = UDim2.new(1, 0, 0, 30), ZIndex = 10, Parent = UI.gui })
UI.subScale = create("UIScale", { Parent = UI.subText })

-- announcer caption
UI.announcer = scaled(panel({ Name = "Announcer", AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -128), Size = UDim2.fromOffset(640, 44), Visible = false, ZIndex = 8, Parent = UI.gui }))
UI.annTag = label({ Name = "Tag", Text = "ANNOUNCER", Font = K.FONT_BLACK, TextSize = 11, TextColor3 = K.WHITE, TextXAlignment = Enum.TextXAlignment.Center, BackgroundTransparency = 0, BackgroundColor3 = K.ROYAL, Position = UDim2.fromOffset(8, 9), Size = UDim2.fromOffset(92, 26), ZIndex = 9, Parent = UI.announcer })
corner(UI.annTag, 6)
UI.annText = label({ Name = "Text", Text = "", Font = K.FONT_BOLD, TextSize = 15, Position = UDim2.fromOffset(110, 0), Size = UDim2.new(1, -120, 1, 0), TextTruncate = Enum.TextTruncate.AtEnd, ZIndex = 9, Parent = UI.announcer })

-- overlay panel (lane draw, results, finalists)
UI.overlay = scaled(panel({ Name = "Overlay", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(620, 440), Visible = false, ZIndex = 15, Parent = UI.gui }))
UI.ovTitle = label({ Name = "Title", Text = "", Font = K.FONT_BLACK, TextSize = 24, TextXAlignment = Enum.TextXAlignment.Center, Position = UDim2.fromOffset(0, 14), Size = UDim2.new(1, 0, 0, 30), ZIndex = 16, Parent = UI.overlay })
UI.ovSub = label({ Name = "Sub", Text = "", Font = K.FONT_BOLD, TextSize = 14, TextColor3 = K.GOLD, TextXAlignment = Enum.TextXAlignment.Center, Position = UDim2.fromOffset(0, 46), Size = UDim2.new(1, 0, 0, 20), ZIndex = 16, Parent = UI.overlay })
type OvRow = { frame: Frame, cols: { TextLabel } }
UI.ovRows = {}
K.OV_COLS = ({ { 4, 44, Enum.TextXAlignment.Center }, { 50, 50, Enum.TextXAlignment.Left }, { 104, 210, Enum.TextXAlignment.Left }, { 318, 96, Enum.TextXAlignment.Left }, { 414, 100, Enum.TextXAlignment.Right }, { 524, 56, Enum.TextXAlignment.Center } }) :: { { any } }
UI.ovHeaders = {}
for c, spec in ipairs(K.OV_COLS) do
	UI.ovHeaders[c] = label({ Name = "Header" .. c, Text = "", Font = K.FONT_BOLD, TextSize = 12, TextColor3 = K.C_MUTED, TextXAlignment = spec[3], Position = UDim2.fromOffset(18 + spec[1], 74), Size = UDim2.fromOffset(spec[2], 16), ZIndex = 16, Parent = UI.overlay })
end
for i = 1, 8 do
	local f = create("Frame", { Name = "Row" .. i, Position = UDim2.fromOffset(18, 94 + (i - 1) * 38), Size = UDim2.new(1, -36, 0, 34), BackgroundColor3 = K.C_PANEL2, BackgroundTransparency = 0.15, ZIndex = 16, Parent = UI.overlay })
	corner(f, 8)
	local cols = {}
	for c, spec in ipairs(K.OV_COLS) do
		cols[c] = label({
			Text = "",
			Font = if c == 1 or c == 5 then K.FONT_BLACK else K.FONT_BOLD,
			TextSize = if c == 4 then 13 else 15,
			TextColor3 = if c == 4 then K.C_MUTED else K.C_TEXT,
			TextXAlignment = spec[3],
			Position = UDim2.fromOffset(spec[1], 0),
			Size = UDim2.fromOffset(spec[2], 34),
			TextTruncate = Enum.TextTruncate.AtEnd,
			ZIndex = 17,
			Parent = f,
		})
	end
	table.insert(UI.ovRows, { frame = f, cols = cols })
end
UI.ovFooter = label({ Name = "Footer", Text = "", Font = K.FONT_BLACK, TextSize = 18, TextXAlignment = Enum.TextXAlignment.Center, AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 0, 1, -10), Size = UDim2.new(1, 0, 0, 24), ZIndex = 16, Parent = UI.overlay })

-- final introductions card (lower third)
UI.introCard = scaled(panel({ Name = "IntroCard", AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, -600, 1, -190), Size = UDim2.fromOffset(540, 112), Visible = false, ZIndex = 18, Parent = UI.gui }))
UI.introLane = label({ Name = "Lane", Text = "4", Font = K.FONT_BLACK, TextSize = 58, TextColor3 = K.WHITE, TextXAlignment = Enum.TextXAlignment.Center, BackgroundTransparency = 0, BackgroundColor3 = K.ROYAL, Position = UDim2.fromOffset(10, 10), Size = UDim2.fromOffset(92, 92), ZIndex = 19, Parent = UI.introCard })
corner(UI.introLane, 12)
UI.introAvatar = create("ImageLabel", { Name = "Avatar", Position = UDim2.fromOffset(112, 14), Size = UDim2.fromOffset(84, 84), BackgroundColor3 = K.C_PANEL2, Image = "", ZIndex = 19, Parent = UI.introCard })
round(UI.introAvatar)
UI.introInitials = label({ Name = "Initials", Text = "", Font = K.FONT_BLACK, TextSize = 30, TextXAlignment = Enum.TextXAlignment.Center, Size = UDim2.fromScale(1, 1), ZIndex = 20, Parent = UI.introAvatar })
UI.introName = label({ Name = "Name", Text = "", Font = K.FONT_BLACK, TextSize = 26, Position = UDim2.fromOffset(210, 16), Size = UDim2.fromOffset(320, 34), TextTruncate = Enum.TextTruncate.AtEnd, ZIndex = 19, Parent = UI.introCard })
UI.introSub = label({ Name = "Sub", Text = "", Font = K.FONT_BOLD, TextSize = 16, TextColor3 = K.GOLD, Position = UDim2.fromOffset(210, 56), Size = UDim2.fromOffset(320, 22), ZIndex = 19, Parent = UI.introCard })
UI.introSub2 = label({ Name = "Sub2", Text = "", Font = K.FONT_REG, TextSize = 13, TextColor3 = K.C_MUTED, Position = UDim2.fromOffset(210, 80), Size = UDim2.fromOffset(320, 18), ZIndex = 19, Parent = UI.introCard })

-- podium
UI.podium = scaled(panel({ Name = "Podium", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.47), Size = UDim2.fromOffset(620, 360), Visible = false, ZIndex = 20, Parent = UI.gui }))
UI.podTitle = label({ Name = "Title", Text = "", Font = K.FONT_BLACK, TextSize = 24, TextXAlignment = Enum.TextXAlignment.Center, Position = UDim2.fromOffset(0, 14), Size = UDim2.new(1, 0, 0, 30), ZIndex = 21, Parent = UI.podium })
type PodCol = { block: Frame, medal: TextLabel, name: TextLabel, time: TextLabel }
UI.podCols = {}
K.POD_SPEC = ({ { 2, 0.18, 120, K.SILVER, "2" }, { 1, 0.5, 160, K.GOLD, "1" }, { 3, 0.82, 96, K.BRONZE, "3" } }) :: { { any } }
for _, spec in ipairs(K.POD_SPEC) do
	local x, h, color = spec[2], spec[3], spec[4]
	local blockFrame = create("Frame", { Name = "Block" .. spec[1], AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(x, 0, 1, -20), Size = UDim2.fromOffset(170, h), BackgroundColor3 = color, BackgroundTransparency = 0.1, ZIndex = 21, Parent = UI.podium })
	corner(blockFrame, 10)
	local medal = label({ Text = spec[5], Font = K.FONT_BLACK, TextSize = 44, TextColor3 = K.C_BG, TextXAlignment = Enum.TextXAlignment.Center, Size = UDim2.new(1, 0, 0, 56), ZIndex = 22, Parent = blockFrame })
	local name = label({ Text = "", Font = K.FONT_BLACK, TextSize = 16, TextXAlignment = Enum.TextXAlignment.Center, AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 0, -34), Size = UDim2.fromOffset(190, 22), TextTruncate = Enum.TextTruncate.AtEnd, ZIndex = 22, Parent = blockFrame })
	local time = label({ Text = "", Font = K.FONT_BOLD, TextSize = 15, TextColor3 = color, TextXAlignment = Enum.TextXAlignment.Center, AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 0, -12), Size = UDim2.fromOffset(190, 20), ZIndex = 22, Parent = blockFrame })
	UI.podCols[spec[1]] = { block = blockFrame, medal = medal, name = name, time = time }
end

-- settings panel with GAME / CONTROLS tabs
UI.setPanel = scaled(panel({ Name = "Settings", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(470, 520), Visible = false, ZIndex = 25, Parent = UI.gui }))
label({ Text = "SETTINGS", Font = K.FONT_BLACK, TextSize = 20, Position = UDim2.fromOffset(20, 16), Size = UDim2.fromOffset(200, 26), ZIndex = 26, Parent = UI.setPanel })
UI.closeSettings = button({ Name = "Close", Text = "X", Font = K.FONT_BLACK, TextSize = 16, AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -14, 0, 14), Size = UDim2.fromOffset(34, 34), ZIndex = 26, Parent = UI.setPanel })
UI.tabGame = button({ Name = "TabGame", Text = "GAME", TextSize = 13, Position = UDim2.fromOffset(20, 54), Size = UDim2.fromOffset(206, 30), ZIndex = 26, Parent = UI.setPanel })
UI.tabControls = button({ Name = "TabControls", Text = "CONTROLS", TextSize = 13, Position = UDim2.fromOffset(244, 54), Size = UDim2.fromOffset(206, 30), ZIndex = 26, Parent = UI.setPanel })
UI.gamePage = create("Frame", { Name = "GamePage", Position = UDim2.fromOffset(0, 92), Size = UDim2.new(1, 0, 1, -92), BackgroundTransparency = 1, ZIndex = 26, Parent = UI.setPanel })
UI.controlsPage = create("Frame", { Name = "ControlsPage", Position = UDim2.fromOffset(0, 92), Size = UDim2.new(1, 0, 1, -92), BackgroundTransparency = 1, Visible = false, ZIndex = 26, Parent = UI.setPanel })

type Option = { key: string, choices: { string }, buttons: { TextButton } }
UI.options = {}
local function addOption(row: number, title: string, key: string, choices: { string }, labels: { string })
	local y = 4 + (row - 1) * 48
	label({ Text = title, Font = K.FONT_BOLD, TextSize = 14, TextColor3 = K.C_MUTED, Position = UDim2.fromOffset(20, y), Size = UDim2.fromOffset(170, 38), ZIndex = 27, Parent = UI.gamePage })
	local opt: Option = { key = key, choices = choices, buttons = {} }
	for i, choice in ipairs(choices) do
		table.insert(opt.buttons, button({ Name = key .. "_" .. choice, Text = labels[i], TextSize = 13, Position = UDim2.fromOffset(200 + (i - 1) * 128, y + 3), Size = UDim2.fromOffset(120, 32), ZIndex = 27, Parent = UI.gamePage }))
	end
	table.insert(UI.options, opt)
end
-- row 1: event picker (< name >)
label({ Text = "Event", Font = K.FONT_BOLD, TextSize = 14, TextColor3 = K.C_MUTED, Position = UDim2.fromOffset(20, 4), Size = UDim2.fromOffset(170, 38), ZIndex = 27, Parent = UI.gamePage })
UI.eventPrev = button({ Name = "EventPrev", Text = "<", Font = K.FONT_BLACK, Position = UDim2.fromOffset(200, 7), Size = UDim2.fromOffset(36, 32), ZIndex = 27, Parent = UI.gamePage })
UI.eventValue = label({ Name = "EventValue", Text = "ALL (rotate)", Font = K.FONT_BLACK, TextSize = 14, TextXAlignment = Enum.TextXAlignment.Center, Position = UDim2.fromOffset(240, 7), Size = UDim2.fromOffset(164, 32), ZIndex = 27, Parent = UI.gamePage })
UI.eventNext = button({ Name = "EventNext", Text = ">", Font = K.FONT_BLACK, Position = UDim2.fromOffset(412, 7), Size = UDim2.fromOffset(36, 32), ZIndex = 27, Parent = UI.gamePage })
addOption(2, "AFK", "AFK", { "on", "off" }, { "ON", "OFF" })
addOption(3, "Uniform (white & blue)", "Uniform", { "on", "off" }, { "ON", "OFF" })
addOption(4, "Track Colour", "TrackColor", { "Red", "Blue" }, { "RED", "BLUE" })
addOption(5, "Camera  [C]", "Camera", { "Chase", "Side" }, { "CHASE", "SIDE" })
addOption(6, "Win Celebration", "Celebration", { "Bolt", "Lyles" }, { "BOLT", "LYLES" })
addOption(7, "Announcer Voice", "Voice", { "on", "off" }, { "ON", "OFF" })
addOption(8, "Performance Mode", "PerformanceMode", { "on", "off" }, { "ON", "OFF" })

-- controls page
type Bind = { key: string, button: TextButton }
UI.binds = {}
local function addBind(row: number, title: string, key: string)
	local y = 4 + (row - 1) * 48
	label({ Text = title, Font = K.FONT_BOLD, TextSize = 14, TextColor3 = K.C_MUTED, Position = UDim2.fromOffset(20, y), Size = UDim2.fromOffset(170, 38), ZIndex = 27, Parent = UI.controlsPage })
	local b = button({ Name = "Bind_" .. key, Text = "", TextSize = 14, Position = UDim2.fromOffset(200, y + 3), Size = UDim2.fromOffset(248, 32), ZIndex = 27, Parent = UI.controlsPage })
	table.insert(UI.binds, { key = key, button = b })
end
addBind(1, "Tap left", "LeftKey")
addBind(2, "Tap right", "RightKey")
addBind(3, "Pass baton (relays)", "PassKey")
UI.controlsHelp = label({
	Name = "Help",
	Text = "PC: Left / Right arrows and mouse left / right click also tap.\nW or Up arrow also passes. L = leaderboard, P = settings, C = camera.\n\nPhone: tap the left / right half of the screen. PASS button in relays.\n\nGamepad: L1 / R1 (or L2 / R2, D-pad) to tap, A to pass.\n\nClick a key above, then press the new key (Esc cancels).",
	Font = K.FONT_REG,
	TextSize = 13,
	TextColor3 = K.C_MUTED,
	TextWrapped = true,
	TextYAlignment = Enum.TextYAlignment.Top,
	Position = UDim2.fromOffset(20, 152),
	Size = UDim2.fromOffset(430, 250),
	ZIndex = 27,
	Parent = UI.controlsPage,
})
UI.controlsHelp.Name = "Help"

-- loading screen: "T&F" logo, then the doors open
UI.loadLeft = create("Frame", { Name = "DoorLeft", Size = UDim2.fromScale(0.5, 1), BackgroundColor3 = K.C_BG, BorderSizePixel = 0, ZIndex = 1, Parent = UI.loadGui })
gradient(UI.loadLeft, Color3.fromRGB(16, 30, 84), K.C_BG, 0)
UI.loadRight = create("Frame", { Name = "DoorRight", Size = UDim2.fromScale(0.5, 1), Position = UDim2.fromScale(0.5, 0), BackgroundColor3 = K.C_BG, BorderSizePixel = 0, ZIndex = 1, Parent = UI.loadGui })
gradient(UI.loadRight, K.C_BG, Color3.fromRGB(16, 30, 84), 0)
for _, door in ipairs({ UI.loadLeft, UI.loadRight }) do
	create("Frame", { Name = "Stripe", AnchorPoint = Vector2.new(0, 0.5), Position = UDim2.fromScale(0, 0.5), Size = UDim2.new(1, 0, 0, 6), BackgroundColor3 = K.ROYAL, BorderSizePixel = 0, ZIndex = 2, Parent = door })
end
UI.loadLogo = create("Frame", { Name = "Logo", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.46), Size = UDim2.fromOffset(420, 260), BackgroundTransparency = 1, ZIndex = 5, Parent = UI.loadGui })
UI.logoScale = create("UIScale", { Parent = UI.loadLogo })
UI.logoRing = create("Frame", { Name = "Ring", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.42), Size = UDim2.fromOffset(230, 230), BackgroundColor3 = K.C_BG, ZIndex = 5, Parent = UI.loadLogo })
round(UI.logoRing)
create("UIStroke", { Color = K.ROYAL_LIGHT, Thickness = 6, Transparency = 0.1, Parent = UI.logoRing })
UI.logoText = label({ Name = "TF", Text = "T<font color=\"#4e7bff\">&amp;</font>F", RichText = true, Font = K.FONT_BLACK, TextSize = 112, TextColor3 = K.WHITE, TextXAlignment = Enum.TextXAlignment.Center, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.42), Size = UDim2.fromOffset(420, 130), ZIndex = 6, Parent = UI.loadLogo })
UI.loadTitle = label({ Name = "Title", Text = "", Font = K.FONT_BLACK, TextSize = 26, TextXAlignment = Enum.TextXAlignment.Center, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0.86, 0), Size = UDim2.fromOffset(600, 30), ZIndex = 6, Parent = UI.loadLogo })
UI.loadSub = label({ Name = "Sub", Text = "", Font = K.FONT_BOLD, TextSize = 15, TextColor3 = K.ROYAL_LIGHT, TextXAlignment = Enum.TextXAlignment.Center, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0.86, 34), Size = UDim2.fromOffset(600, 20), ZIndex = 6, Parent = UI.loadLogo })
UI.loadBarBack = create("Frame", { Name = "Bar", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0.86, 64), Size = UDim2.fromOffset(300, 6), BackgroundColor3 = K.C_PANEL2, BorderSizePixel = 0, ZIndex = 6, Parent = UI.loadLogo })
corner(UI.loadBarBack, 3)
UI.loadBarFill = create("Frame", { Name = "Fill", Size = UDim2.fromScale(0, 1), BackgroundColor3 = K.WHITE, BorderSizePixel = 0, ZIndex = 7, Parent = UI.loadBarBack })
corner(UI.loadBarFill, 3)

-- UI scaling for phones / big screens
local uiScale = 1
local function updateScale()
	local camera = Workspace.CurrentCamera
	if not camera then
		return
	end
	local vp = camera.ViewportSize
	uiScale = math.clamp(math.min(vp.X / 1280, vp.Y / 720), 0.5, 1.3)
	for _, sc in ipairs(UI.scales) do
		sc.Scale = uiScale
	end
	UI.logoScale.Scale = uiScale
	UI.subScale.Scale = uiScale
	if vp.X < 900 then
		UI.lbPanel.Position = UDim2.new(1, -8, 0, 60)
	else
		UI.lbPanel.Position = UDim2.new(1, -14, 0, 64)
	end
end

local flashToken = 0
local function flash(text: string, color: Color3?, sub: string?, duration: number?)
	flashToken += 1
	local token = flashToken
	UI.bigText.Text = text
	UI.bigText.TextColor3 = color or K.C_TEXT
	UI.subText.Text = sub or ""
	UI.bigScale.Scale = 0.6 * uiScale
	TweenService:Create(UI.bigScale, TweenInfo.new(0.25, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = uiScale }):Play()
	if duration then
		task.delay(duration, function()
			if flashToken == token then
				UI.bigText.Text = ""
				UI.subText.Text = ""
			end
		end)
	end
end

local function clearFlash()
	flashToken += 1
	UI.bigText.Text = ""
	UI.subText.Text = ""
end

local function screenFlash(strength: number)
	if Settings.PerformanceMode then
		return
	end
	UI.flashFrame.BackgroundTransparency = 1 - strength
	TweenService:Create(UI.flashFrame, TweenInfo.new(0.5), { BackgroundTransparency = 1 }):Play()
end

local function setVignette(alpha: number, color: Color3?)
	for _, v in ipairs(UI.vignette) do
		v.BackgroundColor3 = color or Color3.new(0, 0, 0)
		TweenService:Create(v, TweenInfo.new(0.4), { BackgroundTransparency = 1 - alpha }):Play()
	end
end

---------------------------------------------------------------------
-- ANNOUNCER (captions + text-to-speech voice when available)
---------------------------------------------------------------------
local voice: any = nil
local function setupVoice()
	local ok = pcall(function()
		local speaker = Instance.new("AudioTextToSpeech")
		speaker.Name = "TF_Announcer"
		speaker.VoiceId = "1"
		speaker.Volume = 1.6
		speaker.Speed = 1.05
		speaker.Parent = SoundService
		local out = Instance.new("AudioDeviceOutput")
		out.Name = "TF_AnnouncerOutput"
		out.Parent = SoundService
		local wire = Instance.new("Wire")
		wire.SourceInstance = speaker
		wire.TargetInstance = out
		wire.Parent = speaker
		voice = speaker
	end)
	if not ok then
		voice = nil
	end
end

local speakToken = 0
local function speak(text: string)
	if not Settings.Voice or not voice then
		return
	end
	speakToken += 1
	local token = speakToken
	task.spawn(function()
		pcall(function()
			voice:Pause()
			voice.Text = text
			voice.TimePosition = 0
			voice:LoadAsync()
			if token == speakToken and Settings.Voice then
				voice:Play()
			end
		end)
	end)
end

local captionToken = 0
local function announce(text: string, spoken: string?)
	captionToken += 1
	local token = captionToken
	UI.announcer.Visible = true
	UI.annText.Text = text
	UI.annText.MaxVisibleGraphemes = 0
	task.spawn(function()
		local n = utf8.len(text) or #text
		for i = 1, n, 2 do
			if captionToken ~= token then
				return
			end
			UI.annText.MaxVisibleGraphemes = i
			task.wait(0.012)
		end
		UI.annText.MaxVisibleGraphemes = -1
		task.wait(4.5)
		if captionToken == token then
			UI.announcer.Visible = false
		end
	end)
	speak(spoken or text)
end

---------------------------------------------------------------------
-- UNIFORM: white & royal blue kit on your own avatar
---------------------------------------------------------------------
type UniformState = {
	colors: { [BasePart]: Color3 },
	textures: { [MeshPart]: string },
	hidden: { { inst: Instance, parent: Instance? } },
	transparency: { [BasePart]: number },
	guis: { Instance },
	bib: TextLabel?,
}
local uniformStates: { [Model]: UniformState } = {}
K.R15_KIT = { UpperTorso = "top", LowerTorso = "shorts", LeftUpperLeg = "shorts", RightUpperLeg = "shorts", LeftFoot = "shoe", RightFoot = "shoe" }

local function kitGui(st: UniformState, part: BasePart, face: Enum.NormalId, build: (Instance) -> ())
	local sg = create("SurfaceGui", { Name = "TF_Kit", Face = face, SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud, PixelsPerStud = 60, LightInfluence = 1, Parent = part })
	build(sg)
	table.insert(st.guis, sg)
end

local function bar(parent: Instance, pos: UDim2, size: UDim2, color: Color3): any
	return create("Frame", { Position = pos, Size = size, BackgroundColor3 = color, BorderSizePixel = 0, Parent = parent })
end

local function applyUniform(char: Model)
	if uniformStates[char] then
		return
	end
	local hum = char:FindFirstChildOfClass("Humanoid")
	if not hum then
		return
	end
	local isR15 = hum.RigType == Enum.HumanoidRigType.R15
	local st: UniformState = { colors = {}, textures = {}, hidden = {}, transparency = {}, guis = {}, bib = nil }
	uniformStates[char] = st
	for _, d in ipairs(char:GetChildren()) do
		if d:IsA("Clothing") or d:IsA("ShirtGraphic") or d:IsA("BodyColors") then
			local inst: Instance = d
			table.insert(st.hidden, { inst = inst, parent = inst.Parent })
			inst.Parent = nil
		elseif d:IsA("Accessory") then
			local handle = d:FindFirstChild("Handle")
			if handle and handle:IsA("BasePart") and handle:FindFirstChildOfClass("WrapLayer") then
				st.transparency[handle] = handle.Transparency
				handle.Transparency = 1 -- layered clothing (jackets etc.) would cover the kit
			end
		end
	end
	local function paint(part: BasePart, color: Color3)
		if not st.colors[part] then
			st.colors[part] = part.Color
		end
		part.Color = color
		if part:IsA("MeshPart") and not st.textures[part :: MeshPart] then
			local mp = part :: MeshPart
			pcall(function()
				st.textures[mp] = mp.TextureID
				mp.TextureID = ""
			end)
		end
	end
	local torsoInst = char:FindFirstChild("UpperTorso") or char:FindFirstChild("Torso")
	local torso: BasePart? = if torsoInst and torsoInst:IsA("BasePart") then torsoInst else nil
	if isR15 then
		for name, role in pairs(K.R15_KIT) do
			local p = char:FindFirstChild(name)
			if p and p:IsA("BasePart") then
				paint(p, if role == "top" or role == "shoe" then K.WHITE else K.ROYAL)
			end
		end
		for _, n in ipairs({ "LeftUpperLeg", "RightUpperLeg" }) do
			local p = char:FindFirstChild(n)
			if p and p:IsA("BasePart") then
				for _, face in ipairs({ Enum.NormalId.Left, Enum.NormalId.Right }) do
					kitGui(st, p, face, function(sg)
						bar(sg, UDim2.fromScale(0.42, 0), UDim2.fromScale(0.16, 1), K.WHITE)
					end)
				end
			end
		end
	else
		if torso then
			paint(torso, K.WHITE)
		end
		for _, n in ipairs({ "Left Leg", "Right Leg" }) do
			local p = char:FindFirstChild(n)
			if p and p:IsA("BasePart") then
				for _, face in ipairs({ Enum.NormalId.Front, Enum.NormalId.Back, Enum.NormalId.Left, Enum.NormalId.Right }) do
					kitGui(st, p, face, function(sg)
						bar(sg, UDim2.fromScale(0, 0), UDim2.fromScale(1, 0.46), K.ROYAL)
						bar(sg, UDim2.fromScale(0, 0.86), UDim2.fromScale(1, 0.14), K.WHITE)
						if face == Enum.NormalId.Left or face == Enum.NormalId.Right then
							bar(sg, UDim2.fromScale(0.42, 0), UDim2.fromScale(0.16, 0.46), K.WHITE)
						end
					end)
				end
			end
		end
	end
	if torso then
		kitGui(st, torso, Enum.NormalId.Front, function(sg)
			bar(sg, UDim2.fromScale(0, 0), UDim2.fromScale(0.1, 1), K.ROYAL)
			bar(sg, UDim2.fromScale(0.9, 0), UDim2.fromScale(0.1, 1), K.ROYAL)
			local band = bar(sg, UDim2.fromScale(0, 0.14), UDim2.fromScale(1, 0.24), K.ROYAL)
			create("TextLabel", { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Text = "T&F", TextScaled = true, Font = Enum.Font.GothamBlack, TextColor3 = K.WHITE, Parent = band })
			local bibFrame = create("Frame", { Position = UDim2.fromScale(0.27, 0.48), Size = UDim2.fromScale(0.46, 0.38), BackgroundColor3 = Color3.fromRGB(252, 252, 252), BorderSizePixel = 0, Parent = sg })
			create("UIStroke", { Color = K.ROYAL, Thickness = 2, Parent = bibFrame })
			st.bib = create("TextLabel", { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Text = "1", TextScaled = true, Font = Enum.Font.GothamBlack, TextColor3 = Color3.fromRGB(16, 16, 20), Parent = bibFrame })
		end)
		kitGui(st, torso, Enum.NormalId.Back, function(sg)
			local band = bar(sg, UDim2.fromScale(0, 0.12), UDim2.fromScale(1, 0.3), K.ROYAL)
			create("TextLabel", { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Text = string.upper(player.Name), TextScaled = true, Font = Enum.Font.GothamBlack, TextColor3 = K.WHITE, Parent = band })
		end)
	end
end

local function removeUniform(char: Model)
	local st = uniformStates[char]
	if not st then
		return
	end
	uniformStates[char] = nil
	for _, g in ipairs(st.guis) do
		g:Destroy()
	end
	for part, color in pairs(st.colors) do
		part.Color = color
	end
	for part, tex in pairs(st.textures) do
		pcall(function()
			part.TextureID = tex
		end)
	end
	for part, tr in pairs(st.transparency) do
		part.Transparency = tr
	end
	for _, h in ipairs(st.hidden) do
		if char.Parent then
			h.inst.Parent = h.parent or char
		end
	end
end

local function setBib(lane: number)
	local char = player.Character
	local st = char and uniformStates[char]
	if st and st.bib then
		st.bib.Text = tostring(lane)
	end
end

local function refreshUniform()
	local char = player.Character
	if not char then
		return
	end
	if Settings.Uniform then
		applyUniform(char)
	else
		removeUniform(char)
	end
end

---------------------------------------------------------------------
-- RACE STATE
---------------------------------------------------------------------
type Runner = {
	athlete: Athlete,
	isPlayer: boolean,
	lane: number,
	sStart: number,
	model: Model?,
	root: BasePart?,
	rig: Rig?,
	rootHeight: number,
	reaction: number,
	tau: number,
	cap: number,
	tapQuality: number,
	dist: number,
	speed: number,
	stamina: number,
	started: boolean,
	startTime: number,
	lastTap: number,
	lastSide: string?,
	bufferedTap: boolean,
	finished: boolean,
	finishTime: number?,
	finishClock: number,
	falseStarts: number,
	dq: boolean,
	dnf: boolean,
	place: number,
	phase: number,
	poseState: string,
	poseClock: number,
	celebrate: string,
	wobbleRate: number,
	wobblePhase: number,
	leg: number,
	legStart: number,
	legClock: number,
	passAt: number,
	passRequest: boolean,
	passQuality: number,
	splits: { number },
	bend: number,
	note: string,
}

type Race = {
	event: Event,
	round: string,
	runners: { Runner },
	phase: string, -- "intro" | "marks" | "set" | "falsestart" | "running" | "done"
	clock: number,
	goal: number,
	falseStartBy: Runner?,
	you: Runner?,
	splitMarks: { number },
	said: { [string]: boolean },
}

local race: Race? = nil
local uiTab = "race"
local lastResults: { title: string, rows: { { string } } }? = nil

---------------------------------------------------------------------
-- RUNNER PHYSICS (+ relay baton exchanges)
---------------------------------------------------------------------
local function tapQualityFor(gap: number): number
	if gap < CONFIG.PerfectMin then
		return 0.93 + 0.07 * math.clamp((gap - CONFIG.MinTapGap) / (CONFIG.PerfectMin - CONFIG.MinTapGap), 0, 1)
	elseif gap <= CONFIG.PerfectMax then
		return 1
	end
	return math.max(0.9, 1 - (gap - CONFIG.PerfectMax) * 0.5)
end

local function legLine(event: Event, k: number): number
	return k * event.LegMeters * SPM + START_BACK
end

local function doPass(r: Runner, t: number, quality: number)
	r.speed *= quality
	table.insert(r.splits, t - r.legClock)
	r.legClock = t
	r.leg += 1
	r.legStart = r.dist
	r.stamina = CONFIG.StaminaMax -- fresh legs
	r.lastTap = t
	r.tapQuality = 1
	r.passQuality = quality
	r.passAt = rng:NextNumber(-9, 3)
end

local function stepRunner(r: Runner, dt: number, t: number, event: Event, goal: number)
	if r.dq or r.dnf then
		r.speed = math.max(0, r.speed - 12 * dt)
		return
	end
	if not r.started then
		if t >= r.reaction then
			r.started = true
			r.startTime = r.reaction
			r.lastTap = r.reaction
			r.bufferedTap = false
			dt = math.min(dt, t - r.reaction) -- only move for the part of the frame after the reaction
		else
			return
		end
	end

	local legMeters = (r.dist - r.legStart) / SPM
	local fatigue = 1
	if event.LegMeters >= 400 then
		fatigue = 1 - 0.065 * math.clamp((legMeters - 300) / 100, 0, 1)
	elseif event.LegMeters >= 200 then
		fatigue = 1 - 0.015 * math.clamp((legMeters - 150) / 50, 0, 1)
	end
	local staminaFactor = if r.stamina >= 25 then 1 else 0.9 + 0.1 * (r.stamina / 25)
	local vmax = event.MaxSpeed * r.cap * fatigue * staminaFactor

	if r.finished then
		r.speed = math.max(0, r.speed - 11 * dt)
	elseif r.isPlayer then
		local sinceTap = t - r.lastTap
		local driving = sinceTap <= CONFIG.DriveWindow or (t - r.startTime) < CONFIG.BlockPushTime
		r.cap += (r.tapQuality - r.cap) * math.min(1, dt * 3)
		if driving then
			r.speed += (vmax - r.speed) * math.min(1, dt / r.tau)
		else
			r.speed = math.max(0, r.speed - CONFIG.CoastDecel * dt)
		end
	else
		local wobble = 1 + 0.004 * math.sin(t * r.wobbleRate + r.wobblePhase)
		r.speed += (vmax * wobble - r.speed) * math.min(1, dt / r.tau)
	end
	r.speed = math.clamp(r.speed, 0, event.MaxSpeed) -- hard speed limit

	if not r.finished then
		r.stamina = math.max(0, r.stamina - CONFIG.StaminaDrain * (r.speed / event.MaxSpeed) * dt)
	end
	r.dist += r.speed * dt

	-- relay exchange zones
	if event.Relay and r.leg < event.Legs and not r.finished then
		local line = legLine(event, r.leg)
		if r.dist >= line - CONFIG.ZoneBefore * SPM then
			if r.isPlayer then
				if r.passRequest then
					local off = (r.dist - line) / SPM
					local q = if off >= -CONFIG.PerfectPassBefore and off <= CONFIG.PerfectPassAfter then 1 elseif off < 0 then 0.9 else 0.94
					doPass(r, t, q)
				elseif r.dist >= line + CONFIG.ZoneAfter * SPM then
					doPass(r, t, 0.78) -- fumbled: pass forced at the end of the zone
				end
			elseif r.dist >= line + r.passAt * SPM then
				doPass(r, t, r.athlete.PassSkill)
			end
		end
	end
	r.passRequest = false

	if not r.finished and r.dist >= goal then
		local over = r.dist - goal
		r.finishTime = t - (if r.speed > 0 then over / r.speed else 0)
		r.finished = true
		r.finishClock = t
		if event.Relay then
			table.insert(r.splits, (r.finishTime or t) - r.legClock)
		end
	end
end

local function newRunner(athlete: Athlete, lane: number, event: Event): Runner
	return {
		athlete = athlete,
		isPlayer = athlete.IsPlayer,
		lane = lane,
		sStart = startS(event, lane),
		model = nil,
		root = nil,
		rig = nil,
		rootHeight = 3,
		reaction = if athlete.IsPlayer
			then rng:NextNumber(CONFIG.ReactionMin, CONFIG.ReactionMax)
			else rng:NextNumber(CONFIG.RivalReactionMin, CONFIG.RivalReactionMax),
		tau = athlete.Tau,
		cap = if athlete.IsPlayer then 1 else (athlete.Skill[event.Name] or 0.97),
		tapQuality = 1,
		dist = 0,
		speed = 0,
		stamina = CONFIG.StaminaMax,
		started = false,
		startTime = 0,
		lastTap = 0,
		lastSide = nil,
		bufferedTap = false,
		finished = false,
		finishTime = nil,
		finishClock = 0,
		falseStarts = 0,
		dq = false,
		dnf = false,
		place = 0,
		phase = 0,
		poseState = "stand",
		poseClock = 0,
		celebrate = "tired",
		wobbleRate = rng:NextNumber(0.6, 1.4),
		wobblePhase = rng:NextNumber(0, 6.28),
		leg = 1,
		legStart = 0,
		legClock = 0,
		passAt = rng:NextNumber(-9, 3),
		passRequest = false,
		passQuality = 0,
		splits = {},
		bend = 0,
		note = "",
	}
end

-- simulate a whole heat without anyone on the track (the other semifinal)
local function simulateHeat(event: Event, athletes: { Athlete }): { Runner }
	local goal = event.Meters * SPM + START_BACK
	local runners = {}
	for i, a in ipairs(athletes) do
		table.insert(runners, newRunner(a, i, event))
	end
	local dt = 1 / 60
	local t = 0
	local left = #runners
	while left > 0 and t < 400 do
		t += dt
		left = 0
		for _, r in ipairs(runners) do
			if not r.finished then
				stepRunner(r, dt, t, event, goal)
				if not r.finished then
					left += 1
				end
			end
		end
	end
	return runners
end

-- world records start just above a perfect run, so they can be beaten
for _, e in ipairs(EVENTS) do
	local ideal: Athlete = { Name = "ideal", IsPlayer = false, Skill = { [e.Name] = 1 }, Tau = CONFIG.PlayerTau, PassSkill = 1 }
	local r = newRunner(ideal, 1, e)
	r.reaction = 0.035
	r.wobbleRate = 0
	r.wobblePhase = 0
	r.passAt = -3
	local goal = e.Meters * SPM + START_BACK
	local t = 0
	while not r.finished and t < 400 do
		t += 1 / 60
		stepRunner(r, 1 / 60, t, e, goal)
		r.passAt = -3
	end
	local wr = math.floor((officialTime(r.finishTime or t) + 0.03) * 100 + 0.5) / 100
	worldRecords[e.Name] = { time = wr, holder = K.WR_HOLDERS[e.Name] or "Legend", isPlayer = false }
end

---------------------------------------------------------------------
-- PLAYER CONTROL
---------------------------------------------------------------------
local function runnerSample(r: Runner): (Vector3, Vector3)
	return trackSample(r.lane, r.sStart - START_BACK + r.dist)
end

local function getPlayerParts(): (Model?, Humanoid?, BasePart?)
	local char = player.Character
	if not char then
		return nil, nil, nil
	end
	local hum = char:FindFirstChildOfClass("Humanoid")
	local root = char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not hum or not root or hum.Health <= 0 then
		return char, nil, nil
	end
	return char, hum, root
end

local savedHumanoid = { WalkSpeed = 16, JumpPower = 50, JumpHeight = 7.2, AutoRotate = true }
local controlsLocked = false

local function getControls(): any
	local ok, controls = pcall(function()
		local ps = player:FindFirstChild("PlayerScripts")
		local pm = ps and ps:FindFirstChild("PlayerModule")
		if pm and pm:IsA("ModuleScript") then
			local module: any = (require :: any)(pm)
			return module:GetControls()
		end
		return nil
	end)
	if ok then
		return controls
	end
	return nil
end

local function setAnimateEnabled(char: Model, enabled: boolean)
	local animate = char:FindFirstChild("Animate")
	if animate and animate:IsA("BaseScript") then
		animate.Enabled = enabled
	end
	if not enabled then
		local hum = char:FindFirstChildOfClass("Humanoid")
		local animator = hum and hum:FindFirstChildOfClass("Animator")
		if animator then
			for _, track in ipairs(animator:GetPlayingAnimationTracks()) do
				track:Stop(0.1)
			end
		end
	end
end

local function lockPlayer(lock: boolean)
	local char, hum = getPlayerParts()
	if lock and not controlsLocked then
		controlsLocked = true
		local controls = getControls()
		if controls then
			pcall(function()
				controls:Disable()
			end)
		end
		if hum then
			savedHumanoid.WalkSpeed = hum.WalkSpeed
			savedHumanoid.JumpPower = hum.JumpPower
			savedHumanoid.JumpHeight = hum.JumpHeight
			savedHumanoid.AutoRotate = hum.AutoRotate
			hum.WalkSpeed = 0
			hum.JumpPower = 0
			hum.JumpHeight = 0
		end
		if char then
			setAnimateEnabled(char, false)
		end
	elseif not lock and controlsLocked then
		controlsLocked = false
		local controls = getControls()
		if controls then
			pcall(function()
				controls:Enable()
			end)
		end
		if hum then
			hum:Move(Vector3.zero)
			hum.WalkSpeed = savedHumanoid.WalkSpeed
			hum.JumpPower = savedHumanoid.JumpPower
			hum.JumpHeight = savedHumanoid.JumpHeight
			hum.AutoRotate = savedHumanoid.AutoRotate
		end
		if char then
			setAnimateEnabled(char, true)
		end
	end
end

local function placePlayerAt(r: Runner)
	local char, hum, root = getPlayerParts()
	if not char or not hum or not root then
		return
	end
	local pos, dir = runnerSample(r)
	local h = rootHeightOf(char)
	root.AssemblyLinearVelocity = Vector3.zero
	char:PivotTo(CFrame.lookAt(pos + Vector3.new(0, h + 0.05, 0), pos + dir + Vector3.new(0, h + 0.05, 0)))
	r.rootHeight = h
	r.model = char
	r.root = root
	if not r.rig or r.rig.model ~= char then
		r.rig = newRig(char)
	end
end

local function drivePlayerCharacter(r: Runner)
	local char, hum, root = getPlayerParts()
	if not char or not hum or not root then
		return
	end
	if r.model ~= char then
		placePlayerAt(r) -- respawned mid race
		return
	end
	local pos, dir = runnerSample(r)
	local rp = root.Position
	local err = Vector3.new(pos.X - rp.X, 0, pos.Z - rp.Z)
	if err.Magnitude > 12 or rp.Y < FLOOR_TOP - 5 then
		placePlayerAt(r)
		return
	end
	if r.speed < 0.05 and not r.started then
		hum.WalkSpeed = 0
		hum:Move(Vector3.zero)
		return
	end
	local along = err:Dot(dir)
	local lateral = err - dir * along
	hum.AutoRotate = true
	hum.WalkSpeed = math.clamp(r.speed + along * 3, 0, r.speed * 1.25 + 4)
	local move = dir * math.max(r.speed, 1) + lateral * 5
	if move.Magnitude > 0.01 and hum.WalkSpeed > 0.05 then
		hum:Move(move.Unit)
	else
		hum:Move(Vector3.zero)
	end
end

-- relay baton in your right hand
local baton: BasePart? = nil
local function giveBaton(give: boolean)
	if baton then
		baton:Destroy()
		baton = nil
	end
	if not give then
		return
	end
	local char = player.Character
	local hand = char and (char:FindFirstChild("RightHand") or char:FindFirstChild("Right Arm"))
	if not hand or not hand:IsA("BasePart") then
		return
	end
	local isR6 = hand.Name == "Right Arm"
	local b = create("Part", {
		Name = "TF_Baton",
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(1.3, 0.32, 0.32),
		Color = K.ROYAL,
		Material = Enum.Material.Metal,
		CanCollide = false,
		CanTouch = false,
		CanQuery = false,
		Massless = true,
		TopSurface = Enum.SurfaceType.Smooth,
		BottomSurface = Enum.SurfaceType.Smooth,
	})
	b.CFrame = hand.CFrame
	create("Weld", {
		Part0 = hand,
		Part1 = b,
		C0 = CFrame.new(0, if isR6 then -1 else -0.15, -0.2) * CFrame.Angles(0, math.pi / 2, 0),
		Parent = b,
	})
	b.Parent = char
	baton = b
end

---------------------------------------------------------------------
-- POSES PER FRAME
---------------------------------------------------------------------
local function driveAmount(r: Runner, event: Event): number
	if r.finished then
		return 0
	end
	return 1 - smoothstep(r.dist / (event.DriveMeters * SPM))
end

local function runnerPose(r: Runner, event: Event): Pose
	local rig = r.rig :: Rig
	local isR15 = rig.isR15
	local state = r.poseState
	if state == "marks" then
		return poseMarks(isR15)
	elseif state == "set" then
		return poseSet(isR15)
	elseif state == "run" then
		local frac = math.clamp(r.speed / event.MaxSpeed, 0, 1)
		if r.finished then
			-- braking jog after the line: sit back, strides shrink
			local pose = poseRun(r.phase, math.clamp(frac * 1.3, 0.15, 1), 0, r.bend, isR15)
			pose.root[1] += 0.22 * (1 - frac)
			return pose
		end
		local drive = driveAmount(r, event)
		local amp = math.clamp(0.62 + frac * 0.42 + drive * 0.3, 0, 1)
		return poseRun(r.phase, amp, drive, r.bend, isR15)
	elseif state == "dip" then
		return poseDip(isR15)
	elseif state == "celebrate" then
		return poseCelebrate(r.celebrate, r.poseClock, isR15)
	end
	return poseStand(r.poseClock)
end

RunService.PreSimulation:Connect(function(dt: number)
	local current = race
	if not current then
		return
	end
	for _, r in ipairs(current.runners) do
		local rig = r.rig
		if rig and rig.model.Parent then
			r.poseClock += dt
			local frac = math.clamp(r.speed / current.event.MaxSpeed, 0, 1)
			if r.speed > 0.2 then
				-- 1.8 strides/s out of the blocks -> ~2.2 at top speed (4.4 steps/s, like Bolt)
				r.phase = (r.phase + dt * (1.8 + 0.42 * frac)) % 1
			end
			-- lean into the bend (Lyles-style bend running)
			local s = r.sStart - START_BACK + r.dist
			local bendTarget = if onBend(r.lane, s) and r.poseState == "run" then 0.17 * frac * frac * (R1 / laneRadius(r.lane)) else 0
			r.bend += (bendTarget - r.bend) * math.min(1, dt * 4)
			local alpha = math.min(1, dt * (if r.poseState == "run" then 18 else 9))
			applyPose(rig, runnerPose(r, current.event), alpha)
		end
	end
end)

---------------------------------------------------------------------
-- CAMERA
---------------------------------------------------------------------
local cam = {
	active = false,
	target = nil :: Runner?,
	mode = "chase", -- "start" | "chase" | "finish" | "intro"
	offset = Vector3.new(0, 6, 14),
	look = Vector3.new(0, 2, 0),
	snap = true,
	fov = 70,
	introBase = Vector3.zero,
	introDir = Vector3.new(1, 0, 0),
	shake = 0,
}

local function startCamera(target: Runner?, mode: string)
	cam.active = true
	cam.target = target
	cam.mode = mode
	cam.snap = true
	local camera = Workspace.CurrentCamera
	if camera then
		camera.CameraType = Enum.CameraType.Scriptable
	end
end

local function stopCamera()
	cam.active = false
	local camera = Workspace.CurrentCamera
	if camera then
		camera.CameraType = Enum.CameraType.Custom
		camera.FieldOfView = 70
		local _, hum = getPlayerParts()
		if hum then
			camera.CameraSubject = hum
		end
	end
end

local function updateCamera(dt: number)
	if not cam.active then
		return
	end
	local camera = Workspace.CurrentCamera
	if not camera then
		return
	end
	camera.CameraType = Enum.CameraType.Scriptable
	local base: Vector3
	local dir: Vector3
	local speed = 0
	if cam.mode == "intro" then
		base = cam.introBase
		dir = cam.introDir
	else
		local r = cam.target
		if not r then
			return
		end
		local _, d = runnerSample(r)
		dir = d
		speed = r.speed
		if r.root and r.root.Parent then
			local rp = r.root.Position
			base = Vector3.new(rp.X, FLOOR_TOP, rp.Z)
		else
			local p = runnerSample(r)
			base = p
		end
	end
	local up = Vector3.yAxis
	local right = dir:Cross(up)
	local offset: Vector3
	local look: Vector3
	local mode = cam.mode
	if mode == "intro" then
		offset = dir * 12 + right * 2 + up * 4.8
		look = up * 1.2
	elseif mode == "start" then
		offset = dir * 16 + right * 1.5 + up * 5
		look = up * 1.2
	elseif mode == "finish" then
		offset = dir * 10 + right * 3 + up * 3.4
		look = up * 2.2
	elseif Settings.Camera == "Side" then
		offset = right * 21 + up * 12.5 + dir * 2
		look = up * 1.5 + dir * 3
	else
		offset = -dir * 11 + right * 0.5 + up * 6.2
		look = dir * 12 + up * 2
	end
	local k = if cam.snap then 1 else 1 - math.exp(-dt * (if mode == "intro" then 3 else 5))
	cam.offset = cam.offset:Lerp(offset, k)
	cam.look = cam.look:Lerp(look, k)
	cam.snap = false
	local speedFrac = math.clamp(speed / 37, 0, 1)
	local fovTarget = if mode == "chase" then 68 + 12 * speedFrac else 62
	cam.fov += (fovTarget - cam.fov) * math.min(1, dt * 4)
	camera.FieldOfView = cam.fov
	local shake = Vector3.zero
	if cam.shake > 0 then
		cam.shake = math.max(0, cam.shake - dt * 2)
		shake = Vector3.new(rng:NextNumber(-1, 1), rng:NextNumber(-1, 1), rng:NextNumber(-1, 1)) * cam.shake * 0.25
	end
	camera.CFrame = CFrame.lookAt(base + cam.offset + shake, base + cam.look)
end

RunService:BindToRenderStep("TrackAndFieldCamera", Enum.RenderPriority.Camera.Value + 1, updateCamera)

---------------------------------------------------------------------
-- INPUT: taps, baton pass, menu keys, rebinding
---------------------------------------------------------------------
local function onTap(side: string)
	local current = race
	if not current then
		return
	end
	local r = current.you
	if not r or r.dq then
		return
	end
	if current.phase == "set" then
		if not current.falseStartBy then
			current.falseStartBy = r
		end
		return
	end
	if current.phase ~= "running" or r.finished then
		return
	end
	local t = current.clock
	if not r.started then
		r.bufferedTap = true
		r.lastSide = side
		return
	end
	local gap = t - r.lastTap
	if gap < CONFIG.MinTapGap then
		r.lastSide = side -- too fast to count, but keep the left/right alternation
		return
	end
	if r.lastSide == side then
		-- same foot twice: stumble
		r.speed *= 0.88
		r.tapQuality = math.max(0.9, r.tapQuality - 0.03)
		r.stamina = math.max(0, r.stamina - 2)
		r.lastTap = t
		UI.staminaFill.BackgroundColor3 = K.C_BAD
		return
	end
	r.tapQuality = if r.lastSide == nil then 1 else tapQualityFor(gap)
	r.lastSide = side
	r.lastTap = t
end

local function onPass()
	local current = race
	local r = current and current.you
	if current and r and current.phase == "running" and current.event.Relay and not r.finished then
		r.passRequest = true
	end
end

local leftKeys = { [Enum.KeyCode.Left] = true, [Enum.KeyCode.ButtonL1] = true, [Enum.KeyCode.ButtonL2] = true, [Enum.KeyCode.DPadLeft] = true }
local rightKeys = { [Enum.KeyCode.Right] = true, [Enum.KeyCode.ButtonR1] = true, [Enum.KeyCode.ButtonR2] = true, [Enum.KeyCode.DPadRight] = true }
local passKeys = { [Enum.KeyCode.W] = true, [Enum.KeyCode.Up] = true, [Enum.KeyCode.ButtonA] = true }

local rebinding: Bind? = nil
local refreshControlsUI: () -> () = function() end
local toggleSettings: () -> () = function() end
local toggleLeaderboard: () -> () = function() end
local toggleCamera: () -> () = function() end

UserInputService.InputBegan:Connect(function(input: InputObject, processed: boolean)
	if UserInputService:GetFocusedTextBox() then
		return
	end
	local kc = input.KeyCode
	if rebinding and input.UserInputType == Enum.UserInputType.Keyboard then
		if kc ~= Enum.KeyCode.Escape then
			-- binding a key that's already used swaps the two (left and right can never be the same key)
			local s: any = Settings
			local old = s[rebinding.key]
			for _, other in ipairs({ "LeftKey", "RightKey", "PassKey" }) do
				if other ~= rebinding.key and s[other] == kc then
					s[other] = old
				end
			end
			s[rebinding.key] = kc
		end
		rebinding = nil
		refreshControlsUI()
		return
	end
	if input.UserInputType == Enum.UserInputType.MouseButton1 and not processed then
		onTap("L")
		return
	elseif input.UserInputType == Enum.UserInputType.MouseButton2 and not processed then
		onTap("R")
		return
	end
	if kc == Settings.LeftKey or leftKeys[kc] then
		onTap("L")
	elseif kc == Settings.RightKey or rightKeys[kc] then
		onTap("R")
	elseif kc == Settings.PassKey or passKeys[kc] then
		onPass()
	elseif kc == Enum.KeyCode.L then
		toggleLeaderboard()
	elseif kc == Enum.KeyCode.P then
		toggleSettings()
	elseif kc == Enum.KeyCode.C then
		toggleCamera()
	end
end)

local function hookZone(zone: TextButton, side: string)
	zone.InputBegan:Connect(function(input: InputObject)
		if input.UserInputType == Enum.UserInputType.Touch then
			onTap(side)
		end
	end)
end
hookZone(UI.touchLeft, "L")
hookZone(UI.touchRight, "R")
UI.passButton.InputBegan:Connect(function(input: InputObject)
	if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
		onPass()
	end
end)

---------------------------------------------------------------------
-- SETTINGS LOGIC
---------------------------------------------------------------------
local function settingValue(key: string): string
	local v = (Settings :: any)[key]
	if typeof(v) == "boolean" then
		return if v then "on" else "off"
	end
	return tostring(v)
end

local function keyName(kc: Enum.KeyCode): string
	return kc.Name
end

local function refreshSettingsUI()
	for _, opt in ipairs(UI.options) do
		local current = settingValue(opt.key)
		for i, b in ipairs(opt.buttons) do
			local on = opt.choices[i] == current
			b.BackgroundColor3 = if on then K.ROYAL else K.C_PANEL2
			b.TextColor3 = if on then K.WHITE else K.C_MUTED
		end
	end
	UI.eventValue.Text = if Settings.Event == "Rotation" then "ALL (rotate)" else Settings.Event
end

refreshControlsUI = function()
	for _, b in ipairs(UI.binds) do
		if rebinding == b then
			b.button.Text = "Press a key..."
			b.button.BackgroundColor3 = K.C_WARN
			b.button.TextColor3 = K.C_BG
		else
			b.button.Text = keyName((Settings :: any)[b.key])
			b.button.BackgroundColor3 = K.C_PANEL2
			b.button.TextColor3 = K.C_TEXT
		end
	end
	UI.passHint.Text = "[" .. string.upper(keyName(Settings.PassKey)) .. "]"
end

local function applyPerformance()
	local perf = Settings.PerformanceMode
	DecorFolder.Parent = if perf then nil else World
	Lighting.GlobalShadows = not perf
	for _, e in ipairs({ fx.bloom, fx.sunrays, fx.color }) do
		if e then
			e.Enabled = not perf
		end
	end
	local clouds = terrain:FindFirstChildOfClass("Clouds")
	if clouds then
		clouds.Enabled = not perf
	end
	for _, info in ipairs(texturedParts) do
		if info.part.Parent then
			info.part.Material = if perf then Enum.Material.SmoothPlastic else info.material
		end
	end
end

local function setTab(page: string)
	UI.gamePage.Visible = page == "game"
	UI.controlsPage.Visible = page == "controls"
	UI.tabGame.BackgroundColor3 = if page == "game" then K.ROYAL else K.C_PANEL2
	UI.tabControls.BackgroundColor3 = if page == "controls" then K.ROYAL else K.C_PANEL2
	refreshControlsUI()
end

for _, opt in ipairs(UI.options) do
	for i, b in ipairs(opt.buttons) do
		b.Activated:Connect(function()
			local choice = opt.choices[i]
			if opt.key == "TrackColor" then
				Settings.TrackColor = choice
				applyTrackColor()
			elseif opt.key == "PerformanceMode" then
				Settings.PerformanceMode = choice == "on"
				applyPerformance()
			elseif opt.key == "AFK" then
				Settings.AFK = choice == "on"
			elseif opt.key == "Uniform" then
				Settings.Uniform = choice == "on"
				refreshUniform()
			elseif opt.key == "Camera" then
				Settings.Camera = choice
			elseif opt.key == "Celebration" then
				Settings.Celebration = choice
			elseif opt.key == "Voice" then
				Settings.Voice = choice == "on"
			end
			refreshSettingsUI()
		end)
	end
end

local eventChoices = { "Rotation" }
for _, e in ipairs(EVENTS) do
	table.insert(eventChoices, e.Name)
end
local function stepEvent(delta: number)
	local idx = table.find(eventChoices, Settings.Event) or 1
	idx = ((idx - 1 + delta) % #eventChoices) + 1
	Settings.Event = eventChoices[idx]
	refreshSettingsUI()
end
UI.eventPrev.Activated:Connect(function()
	stepEvent(-1)
end)
UI.eventNext.Activated:Connect(function()
	stepEvent(1)
end)
for _, b in ipairs(UI.binds) do
	b.button.Activated:Connect(function()
		rebinding = b
		refreshControlsUI()
	end)
end
UI.tabGame.Activated:Connect(function()
	setTab("game")
end)
UI.tabControls.Activated:Connect(function()
	setTab("controls")
end)

toggleSettings = function()
	UI.setPanel.Visible = not UI.setPanel.Visible
	rebinding = nil
	refreshControlsUI()
end
toggleLeaderboard = function()
	UI.lbPanel.Visible = not UI.lbPanel.Visible
end
toggleCamera = function()
	Settings.Camera = if Settings.Camera == "Chase" then "Side" else "Chase"
	refreshSettingsUI()
end
UI.setButton.Activated:Connect(toggleSettings)
UI.closeSettings.Activated:Connect(function()
	UI.setPanel.Visible = false
	rebinding = nil
end)
UI.lbButton.Activated:Connect(toggleLeaderboard)
setTab("game")
refreshSettingsUI()

---------------------------------------------------------------------
-- HUD + LEADERBOARD UPDATES
---------------------------------------------------------------------
local function setRow(row: Row, place: string, name: string, info: string, value: string, highlight: boolean, visible: boolean)
	row.frame.Visible = visible
	row.place.Text = place
	row.name.Text = name
	row.info.Text = info
	row.value.Text = value
	row.frame.BackgroundColor3 = if highlight then Color3.fromRGB(28, 56, 150) else K.C_PANEL2
	row.name.TextColor3 = if highlight then K.WHITE else K.C_TEXT
end

local function sortedOrder(runners: { Runner }): { Runner }
	local list = table.clone(runners)
	table.sort(list, function(a, b)
		local aOut, bOut = a.dq or a.dnf, b.dq or b.dnf
		if aOut ~= bOut then
			return bOut
		end
		if a.finished and b.finished then
			return (a.finishTime or 0) < (b.finishTime or 0)
		elseif a.finished ~= b.finished then
			return a.finished
		end
		return a.dist > b.dist
	end)
	return list
end

local function refreshWR(eventName: string)
	local wr = worldRecords[eventName]
	if wr then
		UI.wrName.Text = wr.holder
		UI.wrTime.Text = fmtTime(wr.time)
		UI.wrName.TextColor3 = if wr.isPlayer then K.GOLD else K.C_TEXT
	end
end

local function refreshLeaderboard()
	UI.tabRace.BackgroundColor3 = if uiTab == "race" then K.ROYAL else K.C_PANEL2
	UI.tabRecords.BackgroundColor3 = if uiTab == "records" then K.ROYAL else K.C_PANEL2
	local current = race
	local evNameNow = if current then current.event.Name else EVENTS[1].Name
	refreshWR(evNameNow)
	if uiTab == "records" then
		UI.lbSub.Text = evNameNow .. "  world record + season bests"
		local list = seasonBests[evNameNow]
		for i, row in ipairs(UI.lbRows) do
			local e = list[i]
			if e then
				setRow(row, tostring(i), e.name, if e.isPlayer then "PB" else "", fmtTime(e.time), e.isPlayer, true)
			else
				setRow(row, tostring(i), "-", "", "", false, true)
			end
		end
		return
	end
	if current and current.phase ~= "intro" then
		UI.lbSub.Text = current.event.Name .. " " .. current.round .. (if current.phase == "running" then "  -  LIVE" else "")
		local order = sortedOrder(current.runners)
		local leader = order[1]
		for i, row in ipairs(UI.lbRows) do
			local r = order[i]
			if r then
				local value
				if r.dq then
					value = "DQ"
				elseif r.dnf then
					value = "DNF"
				elseif r.finished then
					value = fmtOfficial(r.finishTime)
				elseif current.phase == "running" and leader and r ~= leader and not leader.finished then
					value = string.format("-%.1fm", (leader.dist - r.dist) / SPM)
				elseif current.phase == "running" and leader and leader.finished then
					value = string.format("%.0fm", math.max(0, current.goal - r.dist) / SPM)
				else
					value = ""
				end
				setRow(row, tostring(i), r.athlete.Name, "L" .. r.lane, value, r.isPlayer, true)
			else
				setRow(row, "", "", "", "", false, false)
			end
		end
	elseif lastResults then
		UI.lbSub.Text = lastResults.title
		for i, row in ipairs(UI.lbRows) do
			local data = lastResults.rows[i]
			if data then
				setRow(row, data[1], data[2], data[3], data[4], data[5] == "you", true)
			else
				setRow(row, "", "", "", "", false, false)
			end
		end
	else
		UI.lbSub.Text = "Waiting for the first race"
		for _, row in ipairs(UI.lbRows) do
			setRow(row, "", "", "", "", false, false)
		end
	end
end

UI.tabRace.Activated:Connect(function()
	uiTab = "race"
	refreshLeaderboard()
end)
UI.tabRecords.Activated:Connect(function()
	uiTab = "records"
	refreshLeaderboard()
end)

local function showOverlay(title: string, sub: string, headers: { string }, rows: { { string } }, footer: string, footerColor: Color3?)
	UI.overlay.Visible = true
	UI.ovTitle.Text = title
	UI.ovSub.Text = sub
	for c, h in ipairs(UI.ovHeaders) do
		h.Text = headers[c] or ""
	end
	UI.ovFooter.Text = footer
	UI.ovFooter.TextColor3 = footerColor or K.C_TEXT
	for i, row in ipairs(UI.ovRows) do
		local data = rows[i]
		row.frame.Visible = data ~= nil
		if data then
			for c = 1, #K.OV_COLS do
				row.cols[c].Text = data[c] or ""
			end
			local isYou = data[7] == "you"
			row.frame.BackgroundColor3 = if isYou then Color3.fromRGB(28, 56, 150) else K.C_PANEL2
			row.cols[3].TextColor3 = if isYou then K.WHITE else K.C_TEXT
			local m = data[6] or ""
			row.cols[6].TextColor3 = if m == "Q" or m == "q" then K.C_GOOD
				elseif m == "DQ" or m == "NR" then K.C_BAD
				elseif m == "WR" or m == "G" then K.GOLD
				elseif m == "S" then K.SILVER
				elseif m == "B" then K.BRONZE
				else K.C_WARN
		end
	end
	UI.overlay.Size = UDim2.fromOffset(620, 136 + 38 * #rows)
end

local function hideOverlay()
	UI.overlay.Visible = false
end

local function setSplits(lines: { string })
	UI.splitsPanel.Visible = #lines > 0
	for i, l in ipairs(UI.splitLabels) do
		l.Text = lines[i] or ""
	end
end

local speedLineAlpha = 0
local function updateHud(r: Runner?, event: Event?)
	local current = race
	local stamina = if r then r.stamina else CONFIG.StaminaMax
	local frac = math.clamp(stamina / CONFIG.StaminaMax, 0, 1)
	UI.staminaFill.Size = UDim2.fromScale(frac, 1)
	UI.staminaValue.Text = tostring(math.floor(stamina + 0.5))
	local target = if frac > 0.5 then K.C_GOOD elseif frac > 0.25 then K.C_WARN else K.C_BAD
	UI.staminaFill.BackgroundColor3 = if r then UI.staminaFill.BackgroundColor3:Lerp(target, 0.15) else target
	if r and event then
		UI.speedValue.Text = string.format("%.1f", r.speed)
		UI.speedBarFill.Size = UDim2.fromScale(math.clamp(r.speed / event.MaxSpeed, 0, 1), 1)
		UI.laneChip.Text = "LANE " .. r.lane
		UI.legChip.Text = if event.Relay then ("LEG " .. math.min(r.leg, event.Legs) .. "/" .. event.Legs) else ""
		local running = current ~= nil and current.phase == "running" and not r.finished
		local since = if current and r.started and not r.finished then current.clock - r.lastTap else 0
		UI.rhythmMarker.Position = UDim2.fromScale(math.clamp(since / K.RHYTHM_SPAN, 0, 1), 0.5)
		UI.rhythmBack.Visible = running
		-- relay pass prompt
		local showPass = false
		if running and current and event.Relay and r.leg < event.Legs then
			local line = legLine(event, r.leg)
			local off = (r.dist - line) / SPM
			if off >= -CONFIG.ZoneBefore and off <= CONFIG.ZoneAfter then
				showPass = true
				UI.passButton.BackgroundColor3 = if off >= -CONFIG.PerfectPassBefore and off <= CONFIG.PerfectPassAfter then K.C_GOOD else K.C_WARN
			end
		end
		UI.passButton.Visible = showPass
		speedLineAlpha = if running and not Settings.PerformanceMode then math.clamp((r.speed / event.MaxSpeed - 0.8) / 0.2, 0, 1) else 0
	else
		UI.speedValue.Text = "0.0"
		UI.speedBarFill.Size = UDim2.fromScale(0, 1)
		UI.laneChip.Text = if Settings.AFK then "AFK" else ""
		UI.legChip.Text = ""
		UI.rhythmBack.Visible = false
		UI.passButton.Visible = false
		speedLineAlpha = 0
	end
end

local function updateProgress(current: Race)
	UI.progress.Visible = true
	local order = sortedOrder(current.runners)
	for i, d in ipairs(UI.progressDots) do
		local r = current.runners[i]
		d.Visible = r ~= nil
		if r then
			local f = math.clamp(r.dist / current.goal, 0, 1)
			d.Position = UDim2.fromScale(f, 0.5)
			if r.isPlayer then
				d.Size = UDim2.fromOffset(16, 16)
				d.BackgroundColor3 = K.WHITE
				d.ZIndex = 4
			else
				d.Size = UDim2.fromOffset(10, 10)
				d.BackgroundColor3 = if order[1] == r then K.GOLD else K.C_MUTED
				d.ZIndex = 3
			end
		end
	end
	local you = current.you
	UI.progressFill.Size = UDim2.fromScale(if you then math.clamp(you.dist / current.goal, 0, 1) else 0, 1)
	for i, z in ipairs(UI.zoneTicks) do
		z.Visible = current.event.Relay and i < current.event.Legs
		if z.Visible then
			z.Position = UDim2.fromScale(legLine(current.event, i) / current.goal, 0.5)
		end
	end
	if you and not you.dq then
		local place = table.find(order, you) or 0
		UI.posBadge.Text = if place > 0 then ordinal(place) else ""
	else
		UI.posBadge.Text = ""
	end
end

-- per frame: speed lines, flags
RunService.RenderStepped:Connect(function(dt: number)
	local t = os.clock()
	for i, line in ipairs(UI.speedLines) do
		if speedLineAlpha > 0.01 then
			line.dist += dt * line.rate * 1.6
			if line.dist > 1.1 then
				line.dist = rng:NextNumber(0.25, 0.4)
				line.angle = rng:NextNumber(0, math.pi * 2)
			end
			local x = 0.5 + math.cos(line.angle) * line.dist * 0.62
			local y = 0.5 + math.sin(line.angle) * line.dist * 0.62
			line.frame.Position = UDim2.fromScale(x, y)
			line.frame.Rotation = math.deg(line.angle)
			line.frame.Size = UDim2.fromOffset(60 + 160 * line.dist, 2)
			line.frame.BackgroundTransparency = 1 - speedLineAlpha * 0.5 * math.clamp(line.dist, 0, 1)
		elseif line.frame.BackgroundTransparency < 1 then
			line.frame.BackgroundTransparency = 1
		end
		if i <= #flags and not Settings.PerformanceMode then
			local f = flags[i]
			f.part.CFrame = f.base * CFrame.Angles(0, math.sin(t * 2.6 + f.phase) * 0.22, 0) * CFrame.new(2.5, 0, 0)
		end
	end
end)

---------------------------------------------------------------------
-- LOADING SCREEN ("T&F", then the doors open)
---------------------------------------------------------------------
local function showLoading(title: string, sub: string, duration: number, work: (() -> ())?)
	UI.loadGui.Enabled = true
	UI.loadLeft.Position = UDim2.fromScale(0, 0)
	UI.loadRight.Position = UDim2.fromScale(0.5, 0)
	UI.loadLogo.Visible = true
	UI.logoText.TextTransparency = 0
	UI.loadTitle.Text = title
	UI.loadSub.Text = sub
	UI.loadBarFill.Size = UDim2.fromScale(0, 1)
	UI.logoScale.Scale = 0.7 * uiScale
	TweenService:Create(UI.logoScale, TweenInfo.new(0.5, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = uiScale }):Play()
	TweenService:Create(UI.loadBarFill, TweenInfo.new(duration, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Size = UDim2.fromScale(1, 1) }):Play()
	if fx.blur and not Settings.PerformanceMode then
		fx.blur.Size = 24
	end
	if work then
		task.spawn(work)
	end
	task.wait(duration)
	-- logo pops, then the doors open
	TweenService:Create(UI.logoScale, TweenInfo.new(0.25, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { Scale = 1.35 * uiScale }):Play()
	TweenService:Create(UI.logoText, TweenInfo.new(0.25), { TextTransparency = 1 }):Play()
	task.wait(0.22)
	UI.loadLogo.Visible = false
	local doorInfo = TweenInfo.new(0.55, Enum.EasingStyle.Quart, Enum.EasingDirection.InOut)
	TweenService:Create(UI.loadLeft, doorInfo, { Position = UDim2.fromScale(-0.5, 0) }):Play()
	TweenService:Create(UI.loadRight, doorInfo, { Position = UDim2.fromScale(1, 0) }):Play()
	if fx.blur then
		TweenService:Create(fx.blur, TweenInfo.new(0.6), { Size = 0 }):Play()
	end
	task.wait(0.6)
	UI.loadGui.Enabled = false
end

---------------------------------------------------------------------
-- RACE FLOW
---------------------------------------------------------------------
type Result = { athlete: Athlete, lane: number, time: number?, rt: number, status: string, heat: string, mark: string, note: string }

local function waitFor(seconds: number, onTick: ((number) -> ())?)
	local t0 = os.clock()
	while true do
		local left = seconds - (os.clock() - t0)
		if left <= 0 then
			break
		end
		if onTick then
			onTick(left)
		end
		task.wait()
	end
end

local function cleanupRace(current: Race)
	for _, r in ipairs(current.runners) do
		if r.isPlayer and r.rig then
			resetRig(r.rig)
		end
	end
	RaceFolder:ClearAllChildren()
	giveBaton(false)
end

local function setPoses(current: Race, state: string)
	for _, r in ipairs(current.runners) do
		if not r.dq then
			r.poseState = state
			r.poseClock = 0
		end
	end
end

local function resetForRestart(current: Race)
	current.clock = 0
	for _, r in ipairs(current.runners) do
		r.dist = 0
		r.speed = 0
		r.started = false
		r.lastSide = nil
		r.lastTap = 0
		r.bufferedTap = false
		r.tapQuality = 1
		r.stamina = CONFIG.StaminaMax
		r.leg = 1
		r.legStart = 0
		r.legClock = 0
		r.splits = {}
		if r.isPlayer then
			r.cap = 1
			r.reaction = if r.falseStarts > 0
				then CONFIG.ReactionAfterFalseStart
				else rng:NextNumber(CONFIG.ReactionMin, CONFIG.ReactionMax)
		end
		if r.isPlayer and not r.dq then
			placePlayerAt(r)
		end
	end
end

-- starting blocks + (relays) your exchange zones highlighted on the track
local function placeRaceProps(current: Race, you: Runner)
	local pos, dir = trackSample(you.lane, you.sStart - START_BACK - 0.8)
	local cf = CFrame.lookAt(pos, pos + dir)
	block({ Name = "BlockRail", Size = Vector3.new(0.35, 0.18, 2.6), CFrame = cf * CFrame.new(0, 0.09 - FLOOR_TOP + TRACK_TOP, 0), Color = Color3.fromRGB(70, 70, 76), Material = Enum.Material.Metal, Parent = RaceFolder })
	for _, info in ipairs({ { -0.45, -0.55 }, { 0.45, 0.6 } }) do
		block({ Name = "Pedal", Size = Vector3.new(0.55, 0.6, 0.15), CFrame = cf * CFrame.new(info[1], 0.32 - FLOOR_TOP + TRACK_TOP, info[2]) * CFrame.Angles(math.rad(-50), 0, 0), Color = Color3.fromRGB(230, 230, 230), Material = Enum.Material.SmoothPlastic, Parent = RaceFolder })
	end
	local event = current.event
	if not event.Relay then
		return
	end
	for k = 1, event.Legs - 1 do
		local line = legLine(event, k)
		local from = line - CONFIG.ZoneBefore * SPM
		local to = line + CONFIG.ZoneAfter * SPM
		local step = 3
		local d = from
		while d < to do
			local seg = math.min(step, to - d)
			local p, dd = trackSample(you.lane, you.sStart - START_BACK + d + seg / 2)
			local c = CFrame.lookAt(p, p + dd)
			local perfect = d + seg / 2 >= line - CONFIG.PerfectPassBefore * SPM and d + seg / 2 <= line + CONFIG.PerfectPassAfter * SPM
			local part = flat("ExchangeZone", c, LANE_W - 0.6, seg + 0.05, MARK_TOP + 0.004, if perfect then K.C_GOOD else K.C_WARN, Enum.Material.Neon, 0.02, RaceFolder)
			part.Transparency = 0.45
			d += step
		end
		local p, dd = trackSample(you.lane, you.sStart - START_BACK + line)
		flat("LegLine", CFrame.lookAt(p, p + dd), LANE_W - LINE_W, 0.3, MARK_TOP + 0.006, K.WHITE, Enum.Material.SmoothPlastic, 0.02, RaceFolder)
	end
end

local function laneBoards(current: Race)
	for _, r in ipairs(current.runners) do
		if not r.isPlayer then
			local pos, dir = trackSample(r.lane, r.sStart + 2.5)
			local p = flat("LaneBoard", CFrame.lookAt(pos, pos + dir), LANE_W - 0.8, 3, MARK_TOP + 0.01, K.C_BG, Enum.Material.SmoothPlastic, 0.02, RaceFolder)
			p.Transparency = 1
			label3D(p, Enum.NormalId.Top, 40, {
				{ "Name", UDim2.fromScale(0, 0.1), UDim2.fromScale(1, 0.45), r.athlete.Name, K.WHITE },
				{ "Lane", UDim2.fromScale(0, 0.55), UDim2.fromScale(1, 0.4), "LANE " .. r.lane, K.GOLD },
			})
		end
	end
end

local function initials(name: string): string
	local letters = string.gsub(name, "[^%a]", "")
	return string.upper(string.sub(letters, 1, 2))
end

-- finals: introduce every finalist lane by lane (username + semifinal time)
local function introduceFinal(current: Race, semiTimes: { [string]: { time: number?, heat: string, mark: string } })
	local event = current.event
	local watching = current.you ~= nil
	laneBoards(current)
	announce("Ladies and gentlemen, the " .. event.Name .. " final! Let's meet the finalists.")
	if watching then
		cam.mode = "intro"
	end
	waitFor(2.2)
	UI.introCard.Visible = true
	for _, r in ipairs(current.runners) do
		local info = semiTimes[r.athlete.Name]
		local timeText = if info and info.time then fmtOfficial(info.time) else "--"
		UI.introLane.Text = tostring(r.lane)
		UI.introName.Text = r.athlete.Name
		UI.introSub.Text = (if info then info.heat else "Semifinal") .. "   " .. timeText .. (if info and info.mark ~= "" then "  (" .. info.mark .. ")" else "")
		local sb = bestOf(event.Name, r.athlete.Name)
		UI.introSub2.Text = if r.isPlayer then "That's you!" elseif sb then ("Season best " .. fmtTime(sb)) else ""
		if r.isPlayer then
			UI.introAvatar.Image = "rbxthumb://type=AvatarHeadShot&id=" .. tostring(player.UserId) .. "&w=150&h=150"
			UI.introInitials.Text = ""
		else
			UI.introAvatar.Image = ""
			UI.introInitials.Text = initials(r.athlete.Name)
		end
		UI.introCard.Position = UDim2.new(0, -600, 1, -190)
		TweenService:Create(UI.introCard, TweenInfo.new(0.35, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), { Position = UDim2.new(0, 30, 1, -190) }):Play()
		announce("Lane " .. r.lane .. ": " .. r.athlete.Name .. ", " .. timeText .. " in the semifinal.", "Lane " .. r.lane .. ", " .. r.athlete.Name)
		if watching then
			local pos, dir = trackSample(r.lane, r.sStart)
			cam.introBase = pos
			cam.introDir = dir
		end
		waitFor(CONFIG.IntroCardTime)
	end
	UI.introCard.Visible = false
	if watching and current.you then
		cam.target = current.you
		cam.mode = "start"
	end
end

local function updateBoards(current: Race, t: number)
	local order = sortedOrder(current.runners)
	local winner = order[1]
	local shown = if winner and winner.finished and winner.finishTime then fmtOfficial(winner.finishTime) else fmtClock(t)
	for _, c in ipairs(gantryClocks) do
		c.Text = shown
	end
	if boardGui then
		local timeLabel = boardGui:FindFirstChild("Time")
		if timeLabel then
			timeLabel.Text = shown
		end
		for i = 1, 3 do
			local row = boardGui:FindFirstChild("Row" .. i)
			local r = order[i]
			if row then
				row.Text = if r and r.finished then string.format("%d  %s  %s", i, r.athlete.Name, fmtOfficial(r.finishTime)) else ""
			end
		end
	end
end

local function runHeat(event: Event, round: string, athletes: { Athlete }, semiTimes: { [string]: { time: number?, heat: string, mark: string } }?): { Result }
	local lanes = shuffle({ 1, 2, 3, 4, 5, 6, 7, 8 })
	local runners: { Runner } = {}
	local you: Runner? = nil
	for i, a in ipairs(athletes) do
		local r = newRunner(a, lanes[i], event)
		table.insert(runners, r)
		if a.IsPlayer then
			you = r
		end
	end
	table.sort(runners, function(a, b)
		return a.lane < b.lane
	end)
	local splitMarks = {}
	if not event.Relay then
		local marks = { ["60m"] = { 30, 60 }, ["100m"] = { 30, 60, 100 }, ["200m"] = { 100, 200 }, ["400m"] = { 100, 200, 300, 400 } }
		splitMarks = marks[event.Name] or { event.Meters }
	end
	local current: Race = {
		event = event,
		round = round,
		runners = runners,
		phase = "intro",
		clock = 0,
		goal = event.Meters * SPM + START_BACK,
		falseStartBy = nil,
		you = you,
		splitMarks = splitMarks,
		said = {},
	}
	race = current
	UI.evName.Text = event.Name
	UI.evRound.Text = string.upper(round)
	UI.clockLabel.Text = "0.00"
	UI.posBadge.Text = ""
	setSplits({})
	if boardGui then
		local evLabel = boardGui:FindFirstChild("Event")
		if evLabel then
			evLabel.Text = string.upper(event.Name .. " " .. round)
		end
	end
	updateBoards(current, 0)
	refreshLeaderboard()

	-- lane draw (semifinals)
	if round ~= "Final" then
		local drawRows = {}
		for _, r in ipairs(runners) do
			local sb = bestOf(event.Name, r.athlete.Name)
			table.insert(drawRows, { tostring(r.lane), "", r.athlete.Name, if sb then (if r.isPlayer then "PB" else "SB") else "", if sb then fmtTime(sb) else "--", "", if r.isPlayer then "you" else "" })
		end
		showOverlay(event.Name .. "  " .. string.upper(round), "LANE DRAW (random)", { "LANE", "", if event.Relay then "TEAM" else "ATHLETE", "", "BEST", "" }, drawRows, if you then ("You are in lane " .. you.lane) else "Not racing - live results on the leaderboard", K.GOLD)
		announce("Welcome to the " .. event.Name .. " " .. round .. "!" .. (if you then (" " .. player.Name .. " is in lane " .. you.lane .. ".") else ""))
		waitFor(CONFIG.LaneDrawTime, function(left)
			UI.ovFooter.Text = (if you then ("You are in lane " .. you.lane .. "  -  ") else "Not racing  -  ") .. "starting in " .. math.ceil(left)
		end)
		hideOverlay()
	end

	-- loading screen while you are taken to your lane
	if you then
		local yr = you
		showLoading(string.upper(event.Name .. "  " .. round), "LANE " .. yr.lane .. (if event.Relay then "  -  you run every leg" else ""), 2.2, function()
			placeRaceProps(current, yr)
			lockPlayer(true)
			placePlayerAt(yr)
			setBib(yr.lane)
			giveBaton(event.Relay)
			startCamera(yr, if round == "Final" then "intro" else "start")
			if round == "Final" then
				local pos, dir = trackSample(1, yr.sStart)
				cam.introBase = pos
				cam.introDir = dir
			end
		end)
	end
	UI.touchLeft.Visible = you ~= nil
	UI.touchRight.Visible = you ~= nil

	if round == "Final" then
		introduceFinal(current, semiTimes or {})
	end

	-- starting sequence (repeats after a false start)
	while true do
		current.phase = "marks"
		current.falseStartBy = nil
		setPoses(current, "marks")
		refreshLeaderboard()
		setVignette(0.35)
		flash("ON YOUR MARKS", K.C_TEXT, nil, nil)
		waitFor(2.2)
		current.phase = "set"
		setPoses(current, "set")
		setVignette(0.6)
		flash("SET", K.GOLD, nil, nil)
		local hold = rng:NextNumber(1.3, 2.1)
		local t0 = os.clock()
		while os.clock() - t0 < hold do
			if current.falseStartBy then
				break
			end
			task.wait()
		end
		local fs = current.falseStartBy
		if not fs then
			break
		end
		-- false start!
		current.phase = "falsestart"
		fs.falseStarts += 1
		local isDQ = fs.falseStarts >= 2
		setVignette(0.5, K.C_BAD)
		setPoses(current, "stand")
		if isDQ then
			fs.dq = true
			fs.poseState = "celebrate"
			fs.celebrate = "dq"
			local _, hum = getPlayerParts()
			if hum then
				hum:Move(Vector3.zero)
			end
			UI.touchLeft.Visible = false
			UI.touchRight.Visible = false
		end
		flash("FALSE START", K.C_BAD, if isDQ then "Disqualified! (second false start)" else "Warning - your reaction time is now 0.15", nil)
		announce(if isDQ then (fs.athlete.Name .. " has been disqualified for a second false start!") else ("False start! " .. fs.athlete.Name .. " is warned."))
		waitFor(2.6)
		resetForRestart(current)
	end

	-- GO
	current.phase = "running"
	current.clock = 0
	setVignette(0)
	flash("GO!", K.C_GOOD, nil, 0.7)
	cam.mode = "chase"
	cam.shake = 0.6
	screenFlash(0.25)
	for _, r in ipairs(runners) do
		if not r.dq then
			r.poseState = "set"
		end
	end
	local lastBoard = 0
	local lastUi = 0
	local allDoneAt: number? = nil
	local rivalsDoneAt: number? = nil
	local youFinishShown = false
	local rtShown = false
	local nextSplit = 1
	local splitLines: { string } = {}
	local lastPassCount = 0

	while true do
		local dt = RunService.Heartbeat:Wait()
		dt = math.min(dt, 0.1)
		current.clock += dt
		local t = current.clock
		local unfinished = 0
		local rivalsUnfinished = 0
		for _, r in ipairs(runners) do
			local wasFinished = r.finished
			local prevDist = r.dist
			stepRunner(r, dt, t, event, current.goal)
			if not r.dq then
				if r.started and r.poseState == "set" then
					r.poseState = "run"
					r.phase = 0.25 -- block clearance: the back (right) leg drives through first
				end
				if not r.finished and current.goal - r.dist < 2.2 * SPM and r.speed > 0 then
					r.poseState = "dip"
				elseif r.finished and r.poseState == "dip" and t - r.finishClock > 0.35 then
					r.poseState = "run"
				end
				if r.finished and r.poseState ~= "celebrate" and r.speed < 6 and t - r.finishClock > 1 then
					r.poseState = "celebrate"
					r.poseClock = 0
				end
				if not r.finished and not r.dnf then
					unfinished += 1
					if not r.isPlayer then
						rivalsUnfinished += 1
					end
				end
			end
			if r.isPlayer and not r.dq then
				drivePlayerCharacter(r)
				-- splits
				local mark = current.splitMarks[nextSplit]
				if mark and r.dist >= mark * SPM + START_BACK and r.speed > 0 then
					local over = r.dist - (mark * SPM + START_BACK)
					local st = t - over / math.max(r.speed, 1)
					table.insert(splitLines, string.format("%dm   %s", mark, fmtOfficial(st)))
					nextSplit += 1
					setSplits(splitLines)
				end
				-- relay exchanges
				if event.Relay and #r.splits > lastPassCount then
					lastPassCount = #r.splits
					local legTime = r.splits[#r.splits]
					table.insert(splitLines, string.format("Leg %d   %s", lastPassCount, fmtOfficial(legTime)))
					setSplits(splitLines)
					if not r.finished then
						local q = r.passQuality
						if q >= 1 then
							flash("PERFECT PASS", K.C_GOOD, nil, 1)
							announce("Perfect baton change by " .. r.athlete.Name .. "!")
						elseif q >= 0.9 then
							flash("GOOD PASS", K.C_WARN, nil, 1)
							announce("A slightly early change for " .. r.athlete.Name .. ".", "")
						else
							flash("FUMBLED!", K.C_BAD, nil, 1)
							announce("Oh no, a fumbled exchange for " .. r.athlete.Name .. "!")
						end
						screenFlash(0.15)
					end
				end
				if not rtShown and r.started then
					rtShown = true
					UI.rtChip.Text = string.format("REACTION %.3f", r.reaction)
					task.delay(3, function()
						UI.rtChip.Text = ""
					end)
				end
			end
			if r.finished and not wasFinished then
				local place = 1
				for _, o in ipairs(runners) do
					if o ~= r and o.finished and (o.finishTime or 0) < (r.finishTime or 0) then
						place += 1
					end
				end
				r.place = place
				r.celebrate = if place == 1 then string.lower(Settings.Celebration) elseif place <= 3 then "podium" else "tired"
				if r.isPlayer and not youFinishShown then
					youFinishShown = true
					cam.mode = "finish"
					UI.touchLeft.Visible = false
					UI.touchRight.Visible = false
					screenFlash(0.45)
					flash(ordinal(place), if place == 1 then K.GOLD elseif place <= 3 then K.C_TEXT else K.C_MUTED, fmtOfficial(r.finishTime) .. " s", nil)
				end
				if place == 1 and not current.said.winner then
					current.said.winner = true
					announce(r.athlete.Name .. " wins it in " .. fmtOfficial(r.finishTime) .. "!", r.athlete.Name .. " wins it!")
				end
			end
			if r.isPlayer and prevDist == 0 and r.dist > 0 then
				cam.shake = math.max(cam.shake, 0.3)
			end
		end
		-- race commentary
		local order = sortedOrder(runners)
		local leader = order[1]
		if leader and not leader.finished then
			local f = leader.dist / current.goal
			if t > 0.6 and not current.said.start then
				current.said.start = true
				announce(if event.Relay then "And they're away! Clean start." else "And they're away! A clean start.", "And they're away!")
			elseif f > 0.5 and not current.said.half then
				current.said.half = true
				announce(leader.athlete.Name .. " leads at halfway!", leader.athlete.Name .. " leads!")
			elseif f > 0.82 and not current.said.home then
				current.said.home = true
				local second = order[2]
				announce(if second then (leader.athlete.Name .. " and " .. second.athlete.Name .. " battling to the line!") else "Here comes the finish!", "Here they come!")
			end
		end
		if rivalsUnfinished == 0 and not rivalsDoneAt then
			rivalsDoneAt = t
		end
		if you and not you.finished and not you.dq and rivalsDoneAt and t - rivalsDoneAt > 10 then
			you.dnf = true -- stopped tapping
			flash("DNF", K.C_BAD, "Did not finish", 2)
		end
		if unfinished == 0 and not allDoneAt then
			allDoneAt = t
		end
		if t - lastBoard > 0.05 then
			lastBoard = t
			if you and you.finished and you.finishTime then
				UI.clockLabel.Text = fmtOfficial(you.finishTime)
			else
				UI.clockLabel.Text = fmtClock(t)
			end
			updateBoards(current, t)
			updateProgress(current)
		end
		if t - lastUi > 0.1 then
			lastUi = t
			refreshLeaderboard()
		end
		updateHud(you, event)
		if allDoneAt and t - allDoneAt > 3 then
			break
		end
		if t > 400 then
			break
		end
	end
	current.phase = "done"
	UI.touchLeft.Visible = false
	UI.touchRight.Visible = false
	UI.passButton.Visible = false

	-- results + records
	local order = sortedOrder(runners)
	local results: { Result } = {}
	for i, r in ipairs(order) do
		local status = if r.dq then "DQ" elseif r.dnf or not r.finished then "DNF" else "OK"
		r.place = i
		local note = ""
		if status == "OK" and r.finishTime then
			local off = officialTime(r.finishTime)
			local wr = worldRecords[event.Name]
			if wr and off < wr.time then
				local margin = math.floor((wr.time - off) * 100 + 0.5) / 100
				if margin >= CONFIG.WRMinMargin and margin <= CONFIG.WRMaxMargin then
					note = "WR"
					worldRecords[event.Name] = { time = off, holder = r.athlete.Name, isPlayer = r.isPlayer }
				elseif margin > CONFIG.WRMaxMargin then
					note = "NR" -- beat by more than 0.05: not ratified
				end
			end
			recordBest(event.Name, r.athlete, r.finishTime)
		end
		r.note = note
		table.insert(results, { athlete = r.athlete, lane = r.lane, time = if status == "OK" then r.finishTime else nil, rt = r.reaction, status = status, heat = round, mark = "", note = note })
	end
	for _, res in ipairs(results) do
		if res.note == "WR" then
			setVignette(0.5, K.GOLD)
			flash("NEW WORLD RECORD!", K.GOLD, res.athlete.Name .. "  " .. fmtOfficial(res.time), 4)
			announce("A NEW WORLD RECORD! " .. res.athlete.Name .. " runs " .. fmtOfficial(res.time) .. "!", "A new world record for " .. res.athlete.Name .. "!")
		elseif res.note == "NR" then
			flash("WR NOT RATIFIED", K.C_BAD, "Beaten by more than 0.05 s - it doesn't count", 4)
			announce("That was under the world record by more than five hundredths, so it doesn't count!", "That world record does not count!")
		end
	end
	refreshWR(event.Name)
	return results
end

local function resultRows(results: { Result }): { { string } }
	local rows = {}
	for i, res in ipairs(results) do
		table.insert(rows, {
			if res.status == "OK" then tostring(i) else "-",
			"L" .. res.lane,
			res.athlete.Name,
			string.format("RT %.3f", res.rt),
			if res.status == "OK" then fmtOfficial(res.time) else res.status,
			if res.note ~= "" then res.note else res.mark,
			if res.athlete.IsPlayer then "you" else "",
		})
	end
	return rows
end

local function storeLastResults(title: string, results: { Result })
	local rows = {}
	for i, res in ipairs(results) do
		table.insert(rows, {
			if res.status == "OK" then tostring(i) else "-",
			res.athlete.Name,
			"L" .. res.lane,
			if res.status == "OK" then fmtOfficial(res.time) else res.status,
			if res.athlete.IsPlayer then "you" else "",
		})
	end
	lastResults = { title = title, rows = rows }
end

local function finishRaceScreen(current: Race, title: string, sub: string, results: { Result }, footer: string, footerColor: Color3?)
	waitFor(0.5)
	clearFlash()
	showOverlay(title, sub, { "PL", "LANE", if current.event.Relay then "TEAM" else "ATHLETE", "REACTION", "TIME", "" }, resultRows(results), footer, footerColor)
	storeLastResults(title, results)
	waitFor(CONFIG.ResultsTime)
	hideOverlay()
	cleanupRace(current)
	race = nil
	stopCamera()
	lockPlayer(false)
	setVignette(0)
	updateHud(nil, nil)
	UI.progress.Visible = false
	UI.posBadge.Text = ""
	setSplits({})
	UI.clockLabel.Text = "0.00"
	refreshLeaderboard()
end

---------------------------------------------------------------------
-- TOURNAMENT: semifinals -> finalists -> introductions -> final -> podium
---------------------------------------------------------------------
local function playerCanRace(): boolean
	local _, hum, root = getPlayerParts()
	return not Settings.AFK and hum ~= nil and root ~= nil
end

local function runEvent(event: Event)
	local pool = shuffle(table.clone(if event.Relay then teamRoster else roster))
	local you = if event.Relay then youTeam else youAthlete
	local youIn = playerCanRace()
	local heatA: { Athlete } = {}
	local heatB: { Athlete } = {}
	if youIn then
		table.insert(heatA, you)
	end
	local idx = 1
	while #heatA < 8 do
		table.insert(heatA, pool[idx])
		idx += 1
	end
	while #heatB < 8 and pool[idx] do
		table.insert(heatB, pool[idx])
		idx += 1
	end
	local yourSemi = rng:NextInteger(1, 2)
	local otherSemi = 3 - yourSemi
	local roundName = "Semifinal " .. yourSemi

	local resultsA = runHeat(event, roundName, heatA)
	local currentA = race :: Race

	local resultsB: { Result } = {}
	for _, r in ipairs(sortedOrder(simulateHeat(event, heatB))) do
		local ok = r.finished and r.finishTime ~= nil
		table.insert(resultsB, { athlete = r.athlete, lane = r.lane, time = if ok then r.finishTime else nil, rt = r.reaction, status = if ok then "OK" else "DNF", heat = "Semifinal " .. otherSemi, mark = "", note = "" })
		if ok and r.finishTime then
			recordBest(event.Name, r.athlete, r.finishTime)
		end
	end

	-- qualifying: first 3 in each semi (Q) + 2 fastest losers (q)
	local finalists: { Result } = {}
	local rest: { Result } = {}
	for _, list in ipairs({ resultsA, resultsB }) do
		for i, res in ipairs(list) do
			if i <= 3 and res.status == "OK" then
				res.mark = "Q"
				table.insert(finalists, res)
			elseif res.status == "OK" then
				table.insert(rest, res)
			elseif res.status == "DQ" then
				res.mark = "DQ"
			end
		end
	end
	table.sort(rest, function(a, b)
		return (a.time or 999) < (b.time or 999)
	end)
	for i = 1, math.min(8 - #finalists, #rest) do
		rest[i].mark = "q"
		table.insert(finalists, rest[i])
	end

	local youResult: Result? = nil
	for _, res in ipairs(resultsA) do
		if res.athlete.IsPlayer then
			youResult = res
		end
	end
	local semiFooter = "Qualifying: top 3 (Q) + 2 fastest times (q)"
	local semiColor = K.C_TEXT
	if youResult then
		if youResult.mark == "Q" or youResult.mark == "q" then
			semiFooter = "You placed " .. ordinal(table.find(resultsA, youResult) or 0) .. " - through to the final!"
			semiColor = K.C_GOOD
		elseif youResult.status == "DQ" then
			semiFooter = "Disqualified for a false start"
			semiColor = K.C_BAD
		end
	end
	finishRaceScreen(currentA, event.Name .. "  " .. string.upper(roundName), "RESULTS", resultsA, semiFooter, semiColor)

	-- finalists screen
	table.sort(finalists, function(a, b)
		return (a.time or 999) < (b.time or 999)
	end)
	local finalRows = {}
	local youThrough = false
	local semiTimes: { [string]: { time: number?, heat: string, mark: string } } = {}
	for i, res in ipairs(finalists) do
		if res.athlete.IsPlayer then
			youThrough = true
		end
		semiTimes[res.athlete.Name] = { time = res.time, heat = res.heat, mark = res.mark }
		table.insert(finalRows, { tostring(i), if res.heat == roundName then "SF" .. yourSemi else "SF" .. otherSemi, res.athlete.Name, res.heat, fmtOfficial(res.time), res.mark, if res.athlete.IsPlayer then "you" else "" })
	end
	local finFooter = if youThrough then "YOU MADE THE FINAL!" elseif youIn then "You did not qualify - follow the final on the leaderboard" else "Here are the finalists"
	showOverlay(event.Name .. "  FINALISTS", "These 8 are making it to the final", { "#", "HEAT", if event.Relay then "TEAM" else "ATHLETE", "SEMIFINAL", "TIME", "" }, finalRows, finFooter, if youThrough then K.C_GOOD else K.GOLD)
	announce(if youThrough then ("Congratulations " .. player.Name .. ", you're in the final!") else ("Here are the eight finalists for the " .. event.Name .. "."))
	waitFor(CONFIG.FinalistsTime)
	hideOverlay()

	-- final
	local finalAthletes = {}
	for _, res in ipairs(finalists) do
		if res.athlete.IsPlayer and not playerCanRace() then
			continue
		end
		table.insert(finalAthletes, res.athlete)
	end
	local resultsF = runHeat(event, "Final", finalAthletes, semiTimes)
	local currentF = race :: Race
	local medals = { "GOLD", "SILVER", "BRONZE" }
	for i, res in ipairs(resultsF) do
		if i <= 3 and res.status == "OK" then
			res.mark = string.sub(medals[i], 1, 1)
		end
	end

	-- podium
	clearFlash()
	UI.podTitle.Text = event.Name .. "  PODIUM"
	for i = 1, 3 do
		local res = resultsF[i]
		local col = UI.podCols[i]
		col.name.Text = if res then res.athlete.Name else ""
		col.time.Text = if res and res.time then fmtOfficial(res.time) else ""
	end
	UI.podium.Visible = true
	local champion = resultsF[1]
	if champion then
		announce("Your " .. event.Name .. " champion: " .. champion.athlete.Name .. " in " .. fmtOfficial(champion.time) .. "!", "Your champion, " .. champion.athlete.Name .. "!")
	end
	waitFor(4.5)
	UI.podium.Visible = false

	local footer = if champion then ("Champion: " .. champion.athlete.Name .. "  " .. fmtOfficial(champion.time)) else ""
	local footerColor = K.GOLD
	for i, res in ipairs(resultsF) do
		if res.athlete.IsPlayer then
			if i <= 3 and res.status == "OK" then
				footer = "You won " .. medals[i] .. "!  " .. fmtOfficial(res.time)
			elseif res.status == "OK" then
				footer = "You finished " .. ordinal(i) .. "  -  " .. fmtOfficial(res.time)
				footerColor = K.C_TEXT
			end
		end
	end
	finishRaceScreen(currentF, event.Name .. "  FINAL", "OFFICIAL RESULTS", resultsF, footer, footerColor)
end

---------------------------------------------------------------------
-- START
---------------------------------------------------------------------
local camera0 = Workspace.CurrentCamera
if camera0 then
	camera0:GetPropertyChangedSignal("ViewportSize"):Connect(updateScale)
end
updateScale()
updateHud(nil, nil)
refreshLeaderboard()
refreshControlsUI()

local function onCharacter(char: Model)
	-- the old character is gone: forget its locked state
	controlsLocked = false
	task.spawn(function()
		if not player:HasAppearanceLoaded() then
			local done = false
			local conn = player.CharacterAppearanceLoaded:Connect(function()
				done = true
			end)
			local t0 = os.clock()
			while not done and os.clock() - t0 < 6 do
				task.wait(0.1)
			end
			conn:Disconnect()
		end
		if Settings.Uniform and player.Character == char then
			applyUniform(char)
		end
	end)
	local current = race
	local you = current and current.you
	if current and you and not you.dq and current.phase ~= "done" then
		-- respawned mid race: put the new character back in its lane
		task.wait(0.5)
		lockPlayer(true)
		you.rig = nil
		placePlayerAt(you)
		setBib(you.lane)
		giveBaton(current.event.Relay)
	else
		local controls = getControls()
		if controls then
			pcall(function()
				controls:Enable()
			end)
		end
	end
end
player.CharacterAdded:Connect(onCharacter)

task.spawn(function()
	-- build the world behind the loading screen
	showLoading("TRACK AND FIELD", "Building the track...", 2.5, function()
		hideBaseplate()
		buildTerrain()
		buildTrack()
		buildDecor()
		setupLighting()
		setupVoice()
		applyPerformance()
	end)
	if player.Character then
		onCharacter(player.Character)
	end
	flash("TRACK AND FIELD", K.GOLD, "60m  100m  200m  400m  4x100m  4x200m  4x400m", 3.5)
	announce("Welcome to Track and Field, " .. player.Name .. "!", "Welcome to Track and Field, " .. player.Name)
	task.wait(4)
	if not player.Character then
		player.CharacterAdded:Wait()
	end
	task.wait(1)
	local rotation = 0
	while true do
		local event: Event = EVENTS[1]
		if Settings.Event == "Rotation" then
			rotation = rotation % #EVENTS + 1
			event = EVENTS[rotation]
		else
			for _, e in ipairs(EVENTS) do
				if e.Name == Settings.Event then
					event = e
				end
			end
		end
		local ok, err = pcall(function()
			runEvent(event)
		end)
		if not ok then
			-- never leave the player stuck if something unexpected happens
			warn("[Track And Field] event error: " .. tostring(err))
			local current = race
			if current then
				cleanupRace(current)
			end
			race = nil
			hideOverlay()
			UI.podium.Visible = false
			UI.introCard.Visible = false
			UI.loadGui.Enabled = false
			stopCamera()
			lockPlayer(false)
			task.wait(2)
		end
	end
end)
