--[[
	=====================================================================
	  TRACK AND FIELD  (demo)
	=====================================================================
	  ONE script. How to install:
	    1. Open Roblox Studio (a Baseplate place works fine).
	    2. In the Explorer, find StarterPlayer > StarterPlayerScripts.
	    3. Insert a LocalScript there and paste this whole file into it.
	    4. Press Play.

	  What it does:
	    * Builds an 8-lane 400 m track (red or blue) on grass. No stadium.
	    * Runs 60m, 100m, 200m and 400m automatically, one after another.
	      Each event has a semifinal and a final. You are teleported to
	      your (random) lane automatically. No bots on the track: you race
	      alone, rivals only appear as times on the leaderboard/results.
	    * Speed Stars style running: tap left / right in rhythm
	      (every 0.49 s keeps you at top speed).
	        PC: A / D, Left / Right arrows, or Q / E
	        Phone / tablet: tap the left or right half of the screen
	        Gamepad: L1 / R1 (or L2 / R2, D-pad left / right)
	    * Speed limits: 36.8 studs/s (60m), 37.9 (100m), 37.7 (200m),
	      34.3 (400m).
	    * Reaction time 0.02 - 0.05 s. Tap during "Set" = false start:
	      the race restarts and your reaction becomes 0.15 s.
	      A second false start is a disqualification.
	    * Custom animations on YOUR avatar (R6 and R15, no uploads needed):
	      crouch start ("on your marks" + "set"), block clearance, drive
	      phase (low body angle rising over the first 20-30 m), upright
	      sprint, finish-line dip, braking jog and celebration.
	    * UI: leaderboard, settings (track colour, performance mode,
	      auto race, camera) and stamina bar at the bottom.

	  Scale: 1 stud = 0.28 m (Roblox standard), so 100 m = 357 studs.
	=====================================================================
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local Workspace = game:GetService("Workspace")

local player = Players.LocalPlayer

---------------------------------------------------------------------
-- CONFIG
---------------------------------------------------------------------
local CONFIG = {
	GameName = "Track And Field",
	StudsPerMeter = 1 / 0.28,
	Lanes = 8,

	-- tapping
	TapInterval = 0.49, -- the rhythm: one tap every 0.49 s holds top speed
	MinTapGap = 0.11, -- taps faster than this are ignored (no mashing)
	PerfectMin = 0.38, -- taps between PerfectMin..PerfectMax are "perfect"
	PerfectMax = 0.60,
	DriveWindow = 0.56, -- if no tap for this long you start slowing down
	PlayerTau = 1.2, -- acceleration time constant (seconds)
	CoastDecel = 10, -- studs/s^2 lost while not tapping
	BlockPushTime = 0.5, -- free drive out of the blocks

	-- stamina
	StaminaMax = 100,
	StaminaDrain = 2.1, -- per second at top speed

	-- starts
	ReactionMin = 0.02,
	ReactionMax = 0.05,
	ReactionAfterFalseStart = 0.15,
	BotReactionMin = 0.10,
	BotReactionMax = 0.17,

	-- flow
	IntroTime = 4,
	ResultsTime = 7,
	FinalistsTime = 8,
}

-- DriveMeters = length of the drive phase (low body angle out of the blocks)
type Event = { Name: string, Meters: number, MaxSpeed: number, DriveMeters: number }

local EVENTS: { Event } = {
	{ Name = "60m", Meters = 60, MaxSpeed = 36.8, DriveMeters = 25 },
	{ Name = "100m", Meters = 100, MaxSpeed = 37.9, DriveMeters = 30 },
	{ Name = "200m", Meters = 200, MaxSpeed = 37.7, DriveMeters = 25 },
	{ Name = "400m", Meters = 400, MaxSpeed = 34.3, DriveMeters = 20 },
}

local TRACK_COLORS = {
	Red = Color3.fromRGB(176, 58, 46),
	Blue = Color3.fromRGB(36, 88, 168),
}

local Settings = {
	TrackColor = "Red",
	PerformanceMode = false,
	AutoRace = true,
	Camera = "Chase",
}

---------------------------------------------------------------------
-- TRACK GEOMETRY  (standard 8 lanes, 1.22 m wide, 400 m lane 1)
---------------------------------------------------------------------
local SPM = CONFIG.StudsPerMeter
local LANES = CONFIG.Lanes
local LANE_W = 1.22 * SPM
local STRAIGHT = 105 * SPM -- long straights so the 100 m fits without a chute
local R1 = (400 - 2 * 105) / (2 * math.pi) * SPM -- lane 1 running radius
local RC = R1 - LANE_W / 2 -- inner kerb radius
local R_OUT = RC + LANES * LANE_W
local HALF = STRAIGHT / 2
local LINE_W = 0.22
local START_BACK = 0.8 -- runner's body starts this far behind the line

-- surface heights (top faces)
local GRASS_TOP = 0.2
local STRAIGHT_TOP = 0.48 -- running surface (straights and bends)
local INFIELD_DISC_TOP = 0.45
local LINE_TOP = 0.51
local MARK_TOP = 0.53
local FLOOR_TOP = 0.54 -- invisible walkable floor over the whole track
local BEND_SEGMENTS = 36

local function laneRadius(lane: number): number
	return RC + (lane - 0.5) * LANE_W
end

local function laneLoop(lane: number): number
	return 2 * STRAIGHT + 2 * math.pi * laneRadius(lane)
end

-- Position + direction on a lane. s = distance (studs) from the start of
-- the home straight, running counter-clockwise (infield on the left).
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

local FINISH_S = STRAIGHT -- finish line = end of the home straight

local function startS(event: Event, lane: number): number
	local d = event.Meters * SPM
	return (FINISH_S - d) % laneLoop(lane)
end

---------------------------------------------------------------------
-- SMALL HELPERS
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

local function formatTime(t: number?): string
	if not t then
		return "--"
	end
	if t >= 60 then
		local m = math.floor(t / 60)
		return string.format("%d:%06.3f", m, t - m * 60)
	end
	return string.format("%.3f", t)
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
local BlocksFolder = create("Folder", { Name = "StartingBlocks", Parent = World })

local trackSurfaces: { BasePart } = {} -- recoloured by the Track Colour setting
local texturedParts: { { part: BasePart, material: Enum.Material } } = {} -- go SmoothPlastic in performance mode

local function block(props: { [string]: any }): BasePart
	local p = create("Part", {
		Anchored = true,
		CanCollide = false,
		CanTouch = false,
		CanQuery = false,
		CastShadow = false,
		TopSurface = Enum.SurfaceType.Smooth,
		BottomSurface = Enum.SurfaceType.Smooth,
		Parent = TrackFolder,
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

local GRASS_COLOR = Color3.fromRGB(86, 146, 62)
local INFIELD_COLOR = Color3.fromRGB(92, 156, 66)
local LINE_COLOR = Color3.fromRGB(245, 245, 245)
local TRACK_MATERIAL = Enum.Material.Fabric

local function disc(name: string, cx: number, radius: number, top: number, color: Color3, material: Enum.Material, isTrack: boolean)
	local thick = 0.05
	local p = block({
		Name = name,
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(thick, radius * 2, radius * 2),
		CFrame = CFrame.new(cx, top - thick / 2, 0) * CFrame.Angles(0, 0, math.pi / 2),
		Color = color,
		Material = material,
	})
	if isTrack then
		table.insert(trackSurfaces, p)
	end
	return p
end

local function flat(name: string, cf: CFrame, sizeX: number, sizeZ: number, top: number, color: Color3, material: Enum.Material, thick: number?): BasePart
	local t = thick or 0.05
	local pos = cf.Position
	return block({
		Name = name,
		Size = Vector3.new(sizeX, t, sizeZ),
		CFrame = CFrame.new(pos.X, top - t / 2, pos.Z) * cf.Rotation,
		Color = color,
		Material = material,
	})
end

local function buildTrack()
	local trackColor = TRACK_COLORS[Settings.TrackColor]

	-- grass field (also the floor outside the track)
	block({
		Name = "Grass",
		Size = Vector3.new(2048, 2, 2048),
		CFrame = CFrame.new(0, GRASS_TOP - 1, 0),
		Color = GRASS_COLOR,
		Material = Enum.Material.Grass,
		CanCollide = true,
		CanQuery = true,
	})

	-- the two bends: flat segments (no overlapping layers = no flicker)
	local segAngle = math.pi / BEND_SEGMENTS
	for _, sign in ipairs({ 1, -1 }) do
		local cx = sign * HALF
		local center = Vector3.new(cx, 0, 0)
		for i = 0, BEND_SEGMENTS - 1 do
			local a = (i + 0.5) * segAngle
			local out = Vector3.new(sign * math.sin(a), 0, sign * math.cos(a))
			local function segCF(r: number): CFrame
				local pos = center + out * r
				return CFrame.lookAt(pos, pos + out)
			end
			local seg = flat("Bend", segCF((RC + R_OUT) / 2), 2 * R_OUT * math.tan(segAngle / 2) + 0.05, R_OUT - RC, STRAIGHT_TOP, trackColor, TRACK_MATERIAL)
			table.insert(trackSurfaces, seg)
			for k = 0, LANES do
				local r = RC + k * LANE_W
				flat("BendLine", segCF(r), 2 * r * math.tan(segAngle / 2) + 0.02, LINE_W, LINE_TOP, LINE_COLOR, Enum.Material.SmoothPlastic, 0.02)
			end
		end
		disc("BendInfield", cx, RC - LINE_W / 2, INFIELD_DISC_TOP, INFIELD_COLOR, Enum.Material.Grass, false)

		-- walkable floor for this bend
		block({
			Name = "BendFloor",
			Shape = Enum.PartType.Cylinder,
			Size = Vector3.new(0.2, R_OUT * 2 + 1, R_OUT * 2 + 1),
			CFrame = CFrame.new(cx, FLOOR_TOP - 0.1, 0) * CFrame.Angles(0, 0, math.pi / 2),
			Transparency = 1,
			CanCollide = true,
			CanQuery = true,
			Material = Enum.Material.SmoothPlastic,
		})
	end

	-- straights + infield rectangle
	local zMid = (RC + R_OUT) / 2
	for _, sign in ipairs({ 1, -1 }) do
		local strip = flat("Straight", CFrame.new(0, 0, sign * zMid), STRAIGHT, LANES * LANE_W, STRAIGHT_TOP, trackColor, TRACK_MATERIAL)
		table.insert(trackSurfaces, strip)
		for k = 0, LANES do
			local r = RC + k * LANE_W
			flat("LaneLine", CFrame.new(0, 0, sign * r), STRAIGHT, LINE_W, LINE_TOP, LINE_COLOR, Enum.Material.SmoothPlastic, 0.02)
		end
	end
	flat("Infield", CFrame.new(0, 0, 0), STRAIGHT, 2 * RC - LINE_W, STRAIGHT_TOP, INFIELD_COLOR, Enum.Material.Grass)
	block({
		Name = "StraightFloor",
		Size = Vector3.new(STRAIGHT, 0.2, 2 * R_OUT + 1),
		CFrame = CFrame.new(0, FLOOR_TOP - 0.1, 0),
		Transparency = 1,
		CanCollide = true,
		CanQuery = true,
		Material = Enum.Material.SmoothPlastic,
	})

	-- finish line
	flat("FinishLine", CFrame.new(HALF, 0, zMid), 0.45, LANES * LANE_W, MARK_TOP, LINE_COLOR, Enum.Material.SmoothPlastic, 0.02)

	-- start lines for every event (staggered on the bends)
	for _, ev in ipairs(EVENTS) do
		for lane = 1, LANES do
			local s = startS(ev, lane)
			if math.abs(s - FINISH_S) > 0.5 then
				local pos, dir = trackSample(lane, s)
				local cf = CFrame.lookAt(pos, pos + dir)
				flat("StartLine_" .. ev.Name, cf, LANE_W - LINE_W, 0.2, MARK_TOP, LINE_COLOR, Enum.Material.SmoothPlastic, 0.02)
			end
		end
	end

	-- lane numbers painted just after the finish line
	for lane = 1, LANES do
		local pos = Vector3.new(HALF + 4, MARK_TOP, laneRadius(lane))
		local p = flat("LaneNumber" .. lane, CFrame.lookAt(pos, pos + Vector3.new(-1, 0, 0)), 3.2, 3.2, MARK_TOP + 0.005, LINE_COLOR, Enum.Material.SmoothPlastic, 0.02)
		p.Transparency = 1
		local sg = create("SurfaceGui", {
			Face = Enum.NormalId.Top,
			SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud,
			PixelsPerStud = 40,
			LightInfluence = 1,
			Parent = p,
		})
		create("TextLabel", {
			Size = UDim2.fromScale(1, 1),
			BackgroundTransparency = 1,
			Text = tostring(lane),
			TextScaled = true,
			Font = Enum.Font.GothamBlack,
			TextColor3 = LINE_COLOR,
			Parent = sg,
		})
	end

	-- photo-finish post (infield side) + timing board (outside), not a stadium
	block({
		Name = "FinishPost",
		Size = Vector3.new(0.4, 7, 0.4),
		CFrame = CFrame.new(HALF, MARK_TOP + 3.5, RC - 2.5),
		Color = Color3.fromRGB(240, 240, 240),
		Material = Enum.Material.Metal,
		CanCollide = true,
	})
	block({
		Name = "FinishCamera",
		Size = Vector3.new(1.2, 0.9, 1.4),
		CFrame = CFrame.new(HALF, MARK_TOP + 7.4, RC - 2.5),
		Color = Color3.fromRGB(25, 25, 30),
		Material = Enum.Material.SmoothPlastic,
	})
	for _, dz in ipairs({ -4.5, 4.5 }) do
		block({
			Name = "BoardLeg",
			Size = Vector3.new(0.5, 6, 0.5),
			CFrame = CFrame.new(HALF + 8, MARK_TOP + 3, R_OUT + 9 + dz),
			Color = Color3.fromRGB(60, 60, 66),
			Material = Enum.Material.Metal,
			CanCollide = true,
		})
	end
	local board = block({
		Name = "TimingBoard",
		Size = Vector3.new(0.6, 4, 12),
		CFrame = CFrame.new(HALF + 8, MARK_TOP + 7.5, R_OUT + 9),
		Color = Color3.fromRGB(18, 18, 22),
		Material = Enum.Material.SmoothPlastic,
		CanCollide = true,
	})
	local boardGui = create("SurfaceGui", {
		Name = "Clock",
		Face = Enum.NormalId.Left,
		SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud,
		PixelsPerStud = 30,
		LightInfluence = 0,
		Parent = board,
	})
	create("TextLabel", {
		Name = "Time",
		Size = UDim2.fromScale(1, 0.62),
		Position = UDim2.fromScale(0, 0.3),
		BackgroundTransparency = 1,
		Text = "0.00",
		TextScaled = true,
		Font = Enum.Font.Code,
		TextColor3 = Color3.fromRGB(255, 196, 40),
		Parent = boardGui,
	})
	create("TextLabel", {
		Name = "Event",
		Size = UDim2.fromScale(1, 0.26),
		Position = UDim2.fromScale(0, 0.04),
		BackgroundTransparency = 1,
		Text = "TRACK AND FIELD",
		TextScaled = true,
		Font = Enum.Font.GothamBold,
		TextColor3 = Color3.fromRGB(230, 230, 230),
		Parent = boardGui,
	})
	return boardGui
end

local boardGui = buildTrack()

local function buildDecor()
	DecorFolder:ClearAllChildren()
	local treeRng = Random.new(7)
	for i = 1, 46 do
		local angle = (i / 46) * math.pi * 2 + treeRng:NextNumber(-0.05, 0.05)
		local dist = treeRng:NextNumber(70, 220)
		-- ellipse around the oval
		local x = math.cos(angle) * (HALF + R_OUT + dist)
		local z = math.sin(angle) * (R_OUT + dist * 0.8)
		local h = treeRng:NextNumber(10, 18)
		local trunk = block({
			Name = "Trunk",
			Shape = Enum.PartType.Cylinder,
			Size = Vector3.new(h, 1.6, 1.6),
			CFrame = CFrame.new(x, GRASS_TOP + h / 2, z) * CFrame.Angles(0, 0, math.pi / 2),
			Color = Color3.fromRGB(105, 74, 48),
			Material = Enum.Material.Wood,
			CastShadow = true,
			Parent = DecorFolder,
		})
		trunk.CanCollide = true
		local leafColor = Color3.fromRGB(48 + treeRng:NextInteger(0, 25), 110 + treeRng:NextInteger(0, 40), 44)
		for j = 1, 3 do
			local size = treeRng:NextNumber(7, 11) * (1 - (j - 1) * 0.22)
			block({
				Name = "Leaves",
				Shape = Enum.PartType.Ball,
				Size = Vector3.new(size, size, size),
				CFrame = CFrame.new(x + treeRng:NextNumber(-1.5, 1.5), GRASS_TOP + h + (j - 1) * 3.2, z + treeRng:NextNumber(-1.5, 1.5)),
				Color = leafColor,
				Material = Enum.Material.Grass,
				CastShadow = true,
				Parent = DecorFolder,
			})
		end
	end
end
buildDecor()

-- lighting (client side only)
local function setupLighting()
	Lighting.ClockTime = 14.5
	Lighting.Brightness = 2.4
	Lighting.OutdoorAmbient = Color3.fromRGB(135, 135, 140)
	Lighting.EnvironmentDiffuseScale = 0.6
	Lighting.EnvironmentSpecularScale = 0.6
	if not Lighting:FindFirstChildOfClass("Sky") then
		create("Sky", { Name = "TF_Sky", Parent = Lighting })
	end
	if not Lighting:FindFirstChildOfClass("Atmosphere") then
		create("Atmosphere", {
			Name = "TF_Atmosphere",
			Density = 0.25,
			Offset = 0.1,
			Color = Color3.fromRGB(199, 214, 230),
			Decay = Color3.fromRGB(110, 130, 160),
			Glare = 0.2,
			Haze = 1.1,
			Parent = Lighting,
		})
	end
	create("BloomEffect", { Name = "TF_Bloom", Intensity = 0.35, Size = 24, Threshold = 1.6, Parent = Lighting })
	create("SunRaysEffect", { Name = "TF_SunRays", Intensity = 0.04, Spread = 0.6, Parent = Lighting })
	create("ColorCorrectionEffect", { Name = "TF_Color", Saturation = 0.12, Contrast = 0.06, Parent = Lighting })
end
setupLighting()

local function applyTrackColor()
	local c = TRACK_COLORS[Settings.TrackColor]
	for _, p in ipairs(trackSurfaces) do
		p.Color = c
	end
end

---------------------------------------------------------------------
-- RIGS + PROCEDURAL ANIMATION (works on R6 and R15)
---------------------------------------------------------------------
-- Every pose is written in the parent part's space:
--   pitch  > 0 swings a limb forward (or tilts the head up)
--   pitch  < 0 on "root" leans the body forward
--   roll   > 0 moves a right limb outward (negative for left)
-- applyPose converts that into the joint's Transform for any rig.
-- Joints are found by the body part they move, so it works with classic
-- Motor6D avatars and with newer avatars that use AnimationConstraints.

local CHILD_PART_R15 = {
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
local CHILD_PART_R6 = {
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
	local partToKey: { [string]: string } = if isR15 then CHILD_PART_R15 else CHILD_PART_R6
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

local function poseStand(t: number, isR15: boolean): Pose
	local breathe = math.sin(t * 2.2) * 0.02
	return {
		root = J(0, 0, 0, breathe),
		shoulderR = J(0.05, 0, 0.08),
		shoulderL = J(0.05, 0, -0.08),
		elbowR = J(0.15),
		elbowL = J(0.15),
		neck = J(isR15 and 0.02 or 0),
	}
end

local function poseMarks(isR15: boolean): Pose
	if isR15 then
		return {
			root = J(-0.8, 0, 0, -1.05, -0.2),
			waist = J(-0.1),
			neck = J(0.45),
			shoulderR = J(0.95, 0, 0.12),
			shoulderL = J(0.95, 0, -0.12),
			elbowR = J(0),
			elbowL = J(0),
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

local function poseSet(isR15: boolean): Pose
	if isR15 then
		return {
			root = J(-1.15, 0, 0, -0.55, -0.35),
			waist = J(-0.12),
			neck = J(0.6),
			shoulderR = J(1.3, 0, 0.12),
			shoulderL = J(1.3, 0, -0.12),
			elbowR = J(0),
			elbowL = J(0),
			hipL = J(2.05),
			kneeL = J(-1.5),
			ankleL = J(0.35),
			hipR = J(1.35),
			kneeR = J(-1.15),
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

-- Sprint cycle.
--   phase: stride phase in radians (right leg swings forward while cos(phase) > 0)
--   amp:   0..1 how hard you sprint
--   drive: 1 = first step out of the blocks (low ~45 degree body angle),
--          0 = upright top-speed running. Goes 1 -> 0 over the drive phase.
local function poseRun(phase: number, amp: number, drive: number, isR15: boolean): Pose
	local s, c = math.sin(phase), math.cos(phase)
	local fwdR, fwdL = math.max(0, c), math.max(0, -c) -- leg swinging forward
	if isR15 then
		local lean = -(0.14 + 0.66 * drive)
		local bob = (-0.06 - 0.32 * drive + 0.09 * math.cos(phase * 2)) * amp
		local hipC = 0.28 * amp - lean * 0.55
		local hipA = (0.8 + 0.18 * drive) * amp
		local kneeA = (1.8 - 0.8 * drive) * amp -- low heel recovery in the drive, high at top speed
		local armA = (0.95 + 0.3 * drive) * amp
		return {
			root = J(lean + 0.03 * math.sin(phase * 2) * amp, 0.09 * amp * s, 0, bob, -0.25 * drive),
			waist = J(-0.04 - 0.1 * drive, -0.2 * amp * s, 0),
			neck = J(-lean * 0.6 - 0.12 * drive, 0.1 * amp * s, 0),
			hipR = J(hipC + hipA * s),
			hipL = J(hipC - hipA * s),
			kneeR = J(-(0.12 + kneeA * fwdR ^ 1.3)),
			kneeL = J(-(0.12 + kneeA * fwdL ^ 1.3)),
			ankleR = J(0.3 * amp * fwdR - 0.45 * amp * fwdL),
			ankleL = J(0.3 * amp * fwdL - 0.45 * amp * fwdR),
			shoulderR = J(0.12 - lean * 0.35 - armA * s, 0, 0.1 + 0.05 * amp),
			shoulderL = J(0.12 - lean * 0.35 + armA * s, 0, -0.1 - 0.05 * amp),
			elbowR = J(1.35 + 0.4 * amp * math.max(0, -s) - 0.25 * amp * math.max(0, s)),
			elbowL = J(1.35 + 0.4 * amp * math.max(0, s) - 0.25 * amp * math.max(0, -s)),
		}
	end
	local lean = -(0.1 + 0.5 * drive)
	return {
		root = J(lean, 0.07 * amp * s, 0, 0.1 * amp * math.abs(c) - 0.2 * drive),
		neck = J(-lean * 0.6),
		hipR = J(-lean * 0.75 + 0.18 * amp + 1.05 * amp * s),
		hipL = J(-lean * 0.75 + 0.18 * amp - 1.05 * amp * s),
		shoulderR = J(0.15 - lean * 0.4 - 1.3 * amp * s, 0, 0.1),
		shoulderL = J(0.15 - lean * 0.4 + 1.3 * amp * s, 0, -0.1),
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
	if kind == "win" then
		local bounce = math.abs(math.sin(t * 4.5)) * 0.18
		return {
			root = J(0.12, math.sin(t * 1.3) * 0.2, 0, bounce),
			neck = J(0.35),
			shoulderR = J(2.75, 0, 0.5 + math.sin(t * 9) * 0.05),
			shoulderL = J(2.75, 0, -0.5 - math.sin(t * 9) * 0.05),
			elbowR = J(0.2),
			elbowL = J(0.2),
			hipR = J(0, 0, 0.08),
			hipL = J(0, 0, -0.08),
		}
	elseif kind == "podium" then
		local pump = math.sin(t * 7) * 0.25
		return {
			root = J(0.05),
			neck = J(0.15),
			shoulderR = J(2.5 + pump, 0, 0.25),
			elbowR = J(isR15 and 0.7 or 0),
			shoulderL = J(0.1, 0, -0.15),
			elbowL = J(0.6),
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

-- starting blocks
local function placeBlocks(lane: number, s: number)
	local pos, dir = trackSample(lane, s - START_BACK - 0.8)
	local cf = CFrame.lookAt(pos, pos + dir)
	local m = create("Model", { Name = "Blocks" .. lane, Parent = BlocksFolder })
	local rail = block({
		Name = "Rail",
		Size = Vector3.new(0.35, 0.18, 2.6),
		CFrame = cf * CFrame.new(0, 0.09, 0),
		Color = Color3.fromRGB(70, 70, 76),
		Material = Enum.Material.Metal,
		Parent = m,
	})
	rail.Name = "Rail"
	for _, info in ipairs({ { -0.45, -0.55 }, { 0.45, 0.6 } }) do
		block({
			Name = "Pedal",
			Size = Vector3.new(0.55, 0.6, 0.15),
			CFrame = cf * CFrame.new(info[1], 0.32, info[2]) * CFrame.Angles(math.rad(-50), 0, 0),
			Color = Color3.fromRGB(230, 230, 230),
			Material = Enum.Material.SmoothPlastic,
			Parent = m,
		})
	end
end

---------------------------------------------------------------------
-- ATHLETES
---------------------------------------------------------------------
local FIRST = { "Marcus", "Andre", "Kenji", "Tobi", "Luca", "Jaylen", "Omar", "Felix", "Darius", "Mateo", "Kofi", "Ryan", "Elias", "Noah", "Tariq", "Hugo", "Isaac", "Malik", "Leo", "Zion" }
local LAST = { "Carter", "Okafor", "Silva", "Hayes", "Moreau", "Brooks", "Tanaka", "Mensah", "Novak", "Reyes", "Bailey", "Kowalski", "Grant", "Duarte", "Osei", "Lindqvist", "Ward", "Fischer", "Asante", "Cole" }

-- Rivals have no characters on the track: they only exist as times on the
-- leaderboard, the results and the finalists screen. You race alone.
type Athlete = {
	Name: string,
	IsPlayer: boolean,
	Skill: { [string]: number },
	Tau: number,
}

local roster: { Athlete } = {}
do
	local firsts = shuffle(table.clone(FIRST))
	local lasts = shuffle(table.clone(LAST))
	for i = 1, 16 do
		local base = rng:NextNumber(0.958, 0.998)
		local skill = {}
		for _, ev in ipairs(EVENTS) do
			skill[ev.Name] = math.clamp(base + rng:NextNumber(-0.008, 0.008), 0.95, 1)
		end
		table.insert(roster, {
			Name = string.sub(firsts[i], 1, 1) .. ". " .. lasts[i],
			IsPlayer = false,
			Skill = skill,
			Tau = rng:NextNumber(1.16, 1.34),
		})
	end
end

local youAthlete: Athlete = {
	Name = player.DisplayName,
	IsPlayer = true,
	Skill = {},
	Tau = CONFIG.PlayerTau,
}

-- season bests: [eventName] = { {name, time, isPlayer} }
local seasonBests: { [string]: { { name: string, time: number, isPlayer: boolean } } } = {}
for _, ev in ipairs(EVENTS) do
	seasonBests[ev.Name] = {}
end

local function recordBest(eventName: string, athlete: Athlete, t: number)
	local list = seasonBests[eventName]
	for _, e in ipairs(list) do
		if e.name == athlete.Name then
			if t < e.time then
				e.time = t
			end
			table.sort(list, function(a, b)
				return a.time < b.time
			end)
			return
		end
	end
	table.insert(list, { name = athlete.Name, time = t, isPlayer = athlete.IsPlayer })
	table.sort(list, function(a, b)
		return a.time < b.time
	end)
end

local function playerBest(eventName: string): number?
	for _, e in ipairs(seasonBests[eventName]) do
		if e.isPlayer then
			return e.time
		end
	end
	return nil
end

---------------------------------------------------------------------
-- UI
---------------------------------------------------------------------
local FONT_BLACK = Enum.Font.GothamBlack
local FONT_BOLD = Enum.Font.GothamBold
local FONT_REG = Enum.Font.GothamMedium
local C_PANEL = Color3.fromRGB(16, 18, 26)
local C_PANEL2 = Color3.fromRGB(28, 31, 44)
local C_ACCENT = Color3.fromRGB(255, 196, 40)
local C_TEXT = Color3.fromRGB(240, 242, 248)
local C_MUTED = Color3.fromRGB(150, 156, 175)
local C_GOOD = Color3.fromRGB(70, 210, 120)
local C_BAD = Color3.fromRGB(240, 70, 70)

local playerGui = player:WaitForChild("PlayerGui")
local oldGui = playerGui:FindFirstChild("TrackAndFieldUI")
if oldGui then
	oldGui:Destroy()
end

local gui = create("ScreenGui", {
	Name = "TrackAndFieldUI",
	ResetOnSpawn = false,
	IgnoreGuiInset = true,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	DisplayOrder = 5,
	Parent = playerGui,
})

local scales: { UIScale } = {}
local function scaled(frame: GuiObject): GuiObject
	local s = create("UIScale", { Parent = frame })
	table.insert(scales, s)
	return frame
end

local function corner(parent: Instance, r: number?)
	create("UICorner", { CornerRadius = UDim.new(0, r or 10), Parent = parent })
end

local function stroke(parent: Instance, color: Color3?, thickness: number?, transparency: number?)
	create("UIStroke", {
		Color = color or Color3.fromRGB(255, 255, 255),
		Thickness = thickness or 1,
		Transparency = transparency or 0.85,
		ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
		Parent = parent,
	})
end

local function label(props: { [string]: any }): TextLabel
	local base = {
		BackgroundTransparency = 1,
		Font = FONT_BOLD,
		TextColor3 = C_TEXT,
		TextSize = 16,
		TextXAlignment = Enum.TextXAlignment.Left,
	}
	for k, v in pairs(props) do
		base[k] = v
	end
	return create("TextLabel", base)
end

local function button(props: { [string]: any }): TextButton
	local base = {
		BackgroundColor3 = C_PANEL2,
		AutoButtonColor = true,
		Font = FONT_BOLD,
		TextColor3 = C_TEXT,
		TextSize = 15,
	}
	for k, v in pairs(props) do
		base[k] = v
	end
	local b = create("TextButton", base)
	corner(b, 8)
	return b
end

-- touch zones (invisible, no text): left half / right half of the screen
local touchLeft = create("TextButton", {
	Name = "TapZoneLeft",
	Size = UDim2.fromScale(0.5, 1),
	Position = UDim2.fromScale(0, 0),
	BackgroundTransparency = 1,
	Text = "",
	AutoButtonColor = false,
	Selectable = false,
	Visible = false,
	ZIndex = 0,
	Parent = gui,
})
local touchRight = create("TextButton", {
	Name = "TapZoneRight",
	Size = UDim2.fromScale(0.5, 1),
	Position = UDim2.fromScale(0.5, 0),
	BackgroundTransparency = 1,
	Text = "",
	AutoButtonColor = false,
	Selectable = false,
	Visible = false,
	ZIndex = 0,
	Parent = gui,
})

-- top bar
local topBar = scaled(create("Frame", {
	Name = "TopBar",
	AnchorPoint = Vector2.new(0.5, 0),
	Position = UDim2.new(0.5, 0, 0, 10),
	Size = UDim2.fromOffset(460, 70),
	BackgroundColor3 = C_PANEL,
	BackgroundTransparency = 0.15,
	Parent = gui,
}))
corner(topBar, 14)
stroke(topBar)
local titleLabel = label({
	Name = "Title",
	Text = "TRACK AND FIELD",
	Font = FONT_BLACK,
	TextSize = 13,
	TextColor3 = C_ACCENT,
	Position = UDim2.fromOffset(18, 10),
	Size = UDim2.new(0.6, 0, 0, 16),
	Parent = topBar,
})
titleLabel.Name = "Title"
local eventLabel = label({
	Name = "Event",
	Text = "Getting ready...",
	Font = FONT_BLACK,
	TextSize = 22,
	Position = UDim2.fromOffset(18, 30),
	Size = UDim2.new(0.65, 0, 0, 28),
	TextTruncate = Enum.TextTruncate.AtEnd,
	Parent = topBar,
})
local clockLabel = label({
	Name = "Clock",
	Text = "",
	Font = FONT_BLACK,
	TextSize = 30,
	TextXAlignment = Enum.TextXAlignment.Right,
	AnchorPoint = Vector2.new(1, 0.5),
	Position = UDim2.new(1, -18, 0.5, 0),
	Size = UDim2.fromOffset(140, 40),
	Parent = topBar,
})

-- left buttons
local leftButtons = scaled(create("Frame", {
	Name = "Menu",
	Position = UDim2.fromOffset(14, 74),
	Size = UDim2.fromOffset(170, 96),
	BackgroundTransparency = 1,
	Parent = gui,
}))
create("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder, Parent = leftButtons })
local lbButton = button({ Name = "LeaderboardButton", Text = "LEADERBOARD", Size = UDim2.fromOffset(170, 42), LayoutOrder = 1, BackgroundColor3 = C_PANEL, Parent = leftButtons })
stroke(lbButton, C_ACCENT, 1.5, 0.3)
local setButton = button({ Name = "SettingsButton", Text = "SETTINGS", Size = UDim2.fromOffset(170, 42), LayoutOrder = 2, BackgroundColor3 = C_PANEL, Parent = leftButtons })
stroke(setButton, Color3.fromRGB(120, 170, 255), 1.5, 0.3)

-- leaderboard panel (right)
local lbPanel = scaled(create("Frame", {
	Name = "Leaderboard",
	AnchorPoint = Vector2.new(1, 0),
	Position = UDim2.new(1, -14, 0, 74),
	Size = UDim2.fromOffset(310, 404),
	BackgroundColor3 = C_PANEL,
	BackgroundTransparency = 0.12,
	Parent = gui,
}))
corner(lbPanel, 14)
stroke(lbPanel)
label({ Text = "LEADERBOARD", Font = FONT_BLACK, TextSize = 16, TextColor3 = C_ACCENT, Position = UDim2.fromOffset(16, 12), Size = UDim2.fromOffset(200, 20), Parent = lbPanel })
local lbSub = label({ Name = "Sub", Text = "", Font = FONT_REG, TextSize = 13, TextColor3 = C_MUTED, Position = UDim2.fromOffset(16, 34), Size = UDim2.fromOffset(280, 16), Parent = lbPanel })
local tabRace = button({ Name = "TabRace", Text = "RACE", TextSize = 13, Position = UDim2.fromOffset(16, 58), Size = UDim2.fromOffset(134, 28), BackgroundColor3 = C_ACCENT, TextColor3 = C_PANEL, Parent = lbPanel })
local tabBests = button({ Name = "TabBests", Text = "SEASON BESTS", TextSize = 13, Position = UDim2.fromOffset(160, 58), Size = UDim2.fromOffset(134, 28), Parent = lbPanel })

type Row = { frame: Frame, place: TextLabel, name: TextLabel, info: TextLabel, value: TextLabel }
local lbRows: { Row } = {}
for i = 1, 8 do
	local f = create("Frame", {
		Name = "Row" .. i,
		Position = UDim2.fromOffset(12, 96 + (i - 1) * 37),
		Size = UDim2.fromOffset(286, 33),
		BackgroundColor3 = C_PANEL2,
		BackgroundTransparency = 0.2,
		Parent = lbPanel,
	})
	corner(f, 8)
	local place = label({ Text = tostring(i), Font = FONT_BLACK, TextSize = 15, TextXAlignment = Enum.TextXAlignment.Center, Position = UDim2.fromOffset(4, 0), Size = UDim2.fromOffset(28, 33), Parent = f })
	local name = label({ Text = "", TextSize = 14, Position = UDim2.fromOffset(36, 0), Size = UDim2.fromOffset(140, 33), TextTruncate = Enum.TextTruncate.AtEnd, Parent = f })
	local info = label({ Text = "", Font = FONT_REG, TextSize = 12, TextColor3 = C_MUTED, Position = UDim2.fromOffset(176, 0), Size = UDim2.fromOffset(34, 33), Parent = f })
	local value = label({ Text = "", Font = FONT_BLACK, TextSize = 14, TextXAlignment = Enum.TextXAlignment.Right, Position = UDim2.fromOffset(206, 0), Size = UDim2.fromOffset(72, 33), Parent = f })
	table.insert(lbRows, { frame = f, place = place, name = name, info = info, value = value })
end

-- settings panel (center)
local setPanel = scaled(create("Frame", {
	Name = "Settings",
	AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(0.5, 0.5),
	Size = UDim2.fromOffset(380, 330),
	BackgroundColor3 = C_PANEL,
	BackgroundTransparency = 0.05,
	Visible = false,
	ZIndex = 20,
	Parent = gui,
}))
corner(setPanel, 16)
stroke(setPanel, C_TEXT, 1, 0.8)
label({ Text = "SETTINGS", Font = FONT_BLACK, TextSize = 20, Position = UDim2.fromOffset(20, 16), Size = UDim2.fromOffset(200, 26), ZIndex = 21, Parent = setPanel })
local closeSettings = button({ Name = "Close", Text = "X", Font = FONT_BLACK, TextSize = 16, AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -14, 0, 14), Size = UDim2.fromOffset(34, 34), ZIndex = 21, Parent = setPanel })

type Option = { key: string, choices: { string }, buttons: { TextButton } }
local options: { Option } = {}
local function addOption(row: number, title: string, key: string, choices: { string }, labels: { string })
	local y = 62 + (row - 1) * 64
	label({ Text = title, Font = FONT_BOLD, TextSize = 14, TextColor3 = C_MUTED, Position = UDim2.fromOffset(20, y), Size = UDim2.fromOffset(154, 40), ZIndex = 21, Parent = setPanel })
	local opt: Option = { key = key, choices = choices, buttons = {} }
	for i, choice in ipairs(choices) do
		local b = button({
			Name = key .. "_" .. choice,
			Text = labels[i],
			TextSize = 14,
			Position = UDim2.fromOffset(176 + (i - 1) * 94, y + 2),
			Size = UDim2.fromOffset(86, 36),
			ZIndex = 21,
			Parent = setPanel,
		})
		table.insert(opt.buttons, b)
	end
	table.insert(options, opt)
end
addOption(1, "Track Colour", "TrackColor", { "Red", "Blue" }, { "RED", "BLUE" })
addOption(2, "Performance Mode", "PerformanceMode", { "on", "off" }, { "ON", "OFF" })
addOption(3, "Auto Race", "AutoRace", { "on", "off" }, { "ON", "OFF" })
addOption(4, "Camera", "Camera", { "Chase", "Side" }, { "CHASE", "SIDE" })

-- bottom HUD: stamina
local hud = scaled(create("Frame", {
	Name = "HUD",
	AnchorPoint = Vector2.new(0.5, 1),
	Position = UDim2.new(0.5, 0, 1, -14),
	Size = UDim2.fromOffset(440, 92),
	BackgroundColor3 = C_PANEL,
	BackgroundTransparency = 0.15,
	Parent = gui,
}))
corner(hud, 14)
stroke(hud)
label({ Text = "STAMINA", Font = FONT_BLACK, TextSize = 14, TextColor3 = C_MUTED, Position = UDim2.fromOffset(18, 10), Size = UDim2.fromOffset(120, 18), Parent = hud })
local staminaValue = label({ Name = "StaminaValue", Text = "100", Font = FONT_BLACK, TextSize = 20, TextXAlignment = Enum.TextXAlignment.Right, AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -18, 0, 7), Size = UDim2.fromOffset(80, 24), Parent = hud })
local staminaBack = create("Frame", {
	Name = "StaminaBar",
	Position = UDim2.fromOffset(18, 34),
	Size = UDim2.new(1, -36, 0, 16),
	BackgroundColor3 = Color3.fromRGB(40, 44, 60),
	Parent = hud,
})
corner(staminaBack, 8)
local staminaFill = create("Frame", {
	Name = "Fill",
	Size = UDim2.fromScale(1, 1),
	BackgroundColor3 = C_GOOD,
	Parent = staminaBack,
})
corner(staminaFill, 8)
create("UIGradient", {
	Color = ColorSequence.new(Color3.fromRGB(255, 255, 255), Color3.fromRGB(190, 190, 190)),
	Rotation = 90,
	Parent = staminaFill,
})
local speedLabel = label({ Name = "Speed", Text = "0.0 studs/s", Font = FONT_BOLD, TextSize = 13, TextColor3 = C_MUTED, Position = UDim2.fromOffset(18, 60), Size = UDim2.fromOffset(130, 20), Parent = hud })
local laneLabel = label({ Name = "Lane", Text = "", Font = FONT_BOLD, TextSize = 13, TextColor3 = C_ACCENT, TextXAlignment = Enum.TextXAlignment.Right, AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -18, 0, 60), Size = UDim2.fromOffset(130, 20), Parent = hud })
-- rhythm meter: marker sweeps after each step, green zone = next step timing (no text)
local rhythmBack = create("Frame", {
	Name = "Rhythm",
	AnchorPoint = Vector2.new(0.5, 0),
	Position = UDim2.new(0.5, 0, 0, 64),
	Size = UDim2.fromOffset(120, 12),
	BackgroundColor3 = Color3.fromRGB(40, 44, 60),
	Parent = hud,
})
corner(rhythmBack, 6)
local RHYTHM_SPAN = 0.8
create("Frame", {
	Name = "Zone",
	Position = UDim2.fromScale(CONFIG.PerfectMin / RHYTHM_SPAN, 0),
	Size = UDim2.fromScale((CONFIG.PerfectMax - CONFIG.PerfectMin) / RHYTHM_SPAN, 1),
	BackgroundColor3 = C_GOOD,
	BackgroundTransparency = 0.35,
	BorderSizePixel = 0,
	Parent = rhythmBack,
})
local rhythmMarker = create("Frame", {
	Name = "Marker",
	AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(0, 0.5),
	Size = UDim2.new(0, 4, 1, 6),
	BackgroundColor3 = C_TEXT,
	BorderSizePixel = 0,
	Parent = rhythmBack,
})

-- center messages
local bigText = label({
	Name = "BigText",
	Text = "",
	Font = FONT_BLACK,
	TextSize = 64,
	TextXAlignment = Enum.TextXAlignment.Center,
	TextStrokeTransparency = 0.5,
	AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(0.5, 0.33),
	Size = UDim2.new(1, 0, 0, 80),
	ZIndex = 10,
	Parent = gui,
})
local bigScale = create("UIScale", { Parent = bigText })
table.insert(scales, bigScale)
local subText = label({
	Name = "SubText",
	Text = "",
	Font = FONT_BOLD,
	TextSize = 22,
	TextXAlignment = Enum.TextXAlignment.Center,
	TextStrokeTransparency = 0.6,
	AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(0.5, 0.42),
	Size = UDim2.new(1, 0, 0, 30),
	ZIndex = 10,
	Parent = gui,
})
create("UIScale", { Parent = subText })

-- overlay panel (lane draw, results, finalists)
local overlay = scaled(create("Frame", {
	Name = "Overlay",
	AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(0.5, 0.52),
	Size = UDim2.fromOffset(600, 430),
	BackgroundColor3 = C_PANEL,
	BackgroundTransparency = 0.06,
	Visible = false,
	ZIndex = 15,
	Parent = gui,
}))
corner(overlay, 16)
stroke(overlay, C_ACCENT, 2, 0.4)
local ovTitle = label({ Name = "Title", Text = "", Font = FONT_BLACK, TextSize = 24, TextXAlignment = Enum.TextXAlignment.Center, Position = UDim2.fromOffset(0, 14), Size = UDim2.new(1, 0, 0, 30), ZIndex = 16, Parent = overlay })
local ovSub = label({ Name = "Sub", Text = "", Font = FONT_BOLD, TextSize = 15, TextColor3 = C_ACCENT, TextXAlignment = Enum.TextXAlignment.Center, Position = UDim2.fromOffset(0, 46), Size = UDim2.new(1, 0, 0, 20), ZIndex = 16, Parent = overlay })
type OvRow = { frame: Frame, cols: { TextLabel } }
local ovRows: { OvRow } = {}
local OV_COLS: { { any } } = { { 4, 44, Enum.TextXAlignment.Center }, { 50, 50, Enum.TextXAlignment.Left }, { 104, 200, Enum.TextXAlignment.Left }, { 310, 90, Enum.TextXAlignment.Left }, { 400, 100, Enum.TextXAlignment.Right }, { 508, 36, Enum.TextXAlignment.Center } }
local ovHeaders: { TextLabel } = {}
for c, spec in ipairs(OV_COLS) do
	ovHeaders[c] = label({
		Name = "Header" .. c,
		Text = "",
		Font = FONT_BOLD,
		TextSize = 12,
		TextColor3 = C_MUTED,
		TextXAlignment = spec[3],
		Position = UDim2.fromOffset(18 + spec[1], 74),
		Size = UDim2.fromOffset(spec[2], 16),
		ZIndex = 16,
		Parent = overlay,
	})
end
for i = 1, 8 do
	local f = create("Frame", {
		Name = "Row" .. i,
		Position = UDim2.fromOffset(18, 94 + (i - 1) * 38),
		Size = UDim2.new(1, -36, 0, 34),
		BackgroundColor3 = C_PANEL2,
		BackgroundTransparency = 0.15,
		ZIndex = 16,
		Parent = overlay,
	})
	corner(f, 8)
	local cols = {}
	for c, spec in ipairs(OV_COLS) do
		cols[c] = label({
			Text = "",
			Font = if c == 1 or c == 5 then FONT_BLACK else FONT_BOLD,
			TextSize = if c == 4 then 13 else 15,
			TextColor3 = if c == 4 then C_MUTED else C_TEXT,
			TextXAlignment = spec[3],
			Position = UDim2.fromOffset(spec[1], 0),
			Size = UDim2.fromOffset(spec[2], 34),
			TextTruncate = Enum.TextTruncate.AtEnd,
			ZIndex = 17,
			Parent = f,
		})
	end
	table.insert(ovRows, { frame = f, cols = cols })
end
local ovFooter = label({ Name = "Footer", Text = "", Font = FONT_BLACK, TextSize = 18, TextXAlignment = Enum.TextXAlignment.Center, AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 0, 1, -10), Size = UDim2.new(1, 0, 0, 24), ZIndex = 16, Parent = overlay })

-- UI scaling for phones / big screens
local function updateScale()
	local cam = Workspace.CurrentCamera
	if not cam then
		return
	end
	local vp = cam.ViewportSize
	local s = math.clamp(math.min(vp.X / 1280, vp.Y / 720), 0.5, 1.3)
	for _, sc in ipairs(scales) do
		sc.Scale = s
	end
	-- on narrow screens put the leaderboard lower so it doesn't cover the top bar
	if vp.X < 900 then
		lbPanel.Position = UDim2.new(1, -8, 0, 64)
	else
		lbPanel.Position = UDim2.new(1, -14, 0, 74)
	end
end

local function flash(text: string, color: Color3?, sub: string?, duration: number?)
	bigText.Text = text
	bigText.TextColor3 = color or C_TEXT
	subText.Text = sub or ""
	bigText.TextTransparency = 0
	subText.TextTransparency = 0
	bigScale.Scale = 0.6 * (scales[1] and scales[1].Scale or 1)
	TweenService:Create(bigScale, TweenInfo.new(0.25, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = scales[1] and scales[1].Scale or 1 }):Play()
	local token = {}
	bigText:SetAttribute("Token", tostring(token))
	if duration then
		task.delay(duration, function()
			if bigText:GetAttribute("Token") == tostring(token) then
				bigText.Text = ""
				subText.Text = ""
			end
		end)
	end
end

local function clearFlash()
	bigText.Text = ""
	subText.Text = ""
	bigText:SetAttribute("Token", "")
end

---------------------------------------------------------------------
-- SETTINGS LOGIC
---------------------------------------------------------------------
local function settingValue(key: string): string
	local v = (Settings :: any)[key]
	if typeof(v) == "boolean" then
		return if v then "on" else "off"
	end
	return v
end

local function refreshSettingsUI()
	for _, opt in ipairs(options) do
		local current = settingValue(opt.key)
		for i, b in ipairs(opt.buttons) do
			local on = opt.choices[i] == current
			b.BackgroundColor3 = if on then C_ACCENT else C_PANEL2
			b.TextColor3 = if on then C_PANEL else C_TEXT
		end
	end
end

local function applyPerformance()
	local perf = Settings.PerformanceMode
	DecorFolder.Parent = if perf then nil else World
	Lighting.GlobalShadows = not perf
	for _, name in ipairs({ "TF_Bloom", "TF_SunRays", "TF_Color" }) do
		local e = Lighting:FindFirstChild(name)
		if e and e:IsA("PostEffect") then
			e.Enabled = not perf
		end
	end
	for _, info in ipairs(texturedParts) do
		info.part.Material = if perf then Enum.Material.SmoothPlastic else info.material
	end
end

for _, opt in ipairs(options) do
	for i, b in ipairs(opt.buttons) do
		b.Activated:Connect(function()
			local choice = opt.choices[i]
			if opt.key == "TrackColor" then
				Settings.TrackColor = choice
				applyTrackColor()
			elseif opt.key == "PerformanceMode" then
				Settings.PerformanceMode = choice == "on"
				applyPerformance()
			elseif opt.key == "AutoRace" then
				Settings.AutoRace = choice == "on"
			elseif opt.key == "Camera" then
				Settings.Camera = choice
			end
			refreshSettingsUI()
		end)
	end
end
refreshSettingsUI()

setButton.Activated:Connect(function()
	setPanel.Visible = not setPanel.Visible
end)
closeSettings.Activated:Connect(function()
	setPanel.Visible = false
end)
lbButton.Activated:Connect(function()
	lbPanel.Visible = not lbPanel.Visible
end)

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
}

type Race = {
	event: Event,
	round: string,
	runners: { Runner },
	phase: string, -- "intro" | "marks" | "set" | "running" | "done"
	clock: number,
	goal: number,
	falseStartBy: Runner?,
	you: Runner?,
	order: { Runner },
}

local race: Race? = nil
local uiTab = "race"
local lastResults: { title: string, rows: { { string } } }? = nil

---------------------------------------------------------------------
-- RUNNER PHYSICS
---------------------------------------------------------------------
local function tapQualityFor(gap: number): number
	if gap < CONFIG.PerfectMin then
		return 0.93 + 0.07 * math.clamp((gap - CONFIG.MinTapGap) / (CONFIG.PerfectMin - CONFIG.MinTapGap), 0, 1)
	elseif gap <= CONFIG.PerfectMax then
		return 1
	end
	return math.max(0.9, 1 - (gap - CONFIG.PerfectMax) * 0.4)
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

	local meters = r.dist / SPM
	local fatigue = 1
	if event.Meters >= 400 then
		fatigue = 1 - 0.065 * math.clamp((meters - 300) / 100, 0, 1)
	elseif event.Meters >= 200 then
		fatigue = 1 - 0.015 * math.clamp((meters - 150) / 50, 0, 1)
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
	if not r.finished and r.dist >= goal then
		local over = r.dist - goal
		r.finishTime = t - (if r.speed > 0 then over / r.speed else 0)
		r.finished = true
		r.finishClock = t
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
			else rng:NextNumber(CONFIG.BotReactionMin, CONFIG.BotReactionMax),
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
		phase = rng:NextNumber(0, math.pi * 2),
		poseState = "stand",
		poseClock = 0,
		celebrate = "tired",
		wobbleRate = rng:NextNumber(0.6, 1.4),
		wobblePhase = rng:NextNumber(0, 6.28),
	}
end

-- simulate a whole heat without models (the other semifinal)
local function simulateHeat(event: Event, athletes: { Athlete }): { Runner }
	local goal = event.Meters * SPM + START_BACK
	local runners = {}
	for i, a in ipairs(athletes) do
		table.insert(runners, newRunner(a, i, event))
	end
	local dt = 1 / 60
	local t = 0
	local left = #runners
	while left > 0 and t < 200 do
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

---------------------------------------------------------------------
-- RUNNER BODY POSITION
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

---------------------------------------------------------------------
-- POSES PER FRAME
---------------------------------------------------------------------
-- 1 at the blocks, easing to 0 at the end of the drive phase
local function driveAmount(r: Runner, event: Event): number
	if r.finished then
		return 0
	end
	local x = math.clamp(r.dist / (event.DriveMeters * SPM), 0, 1)
	return 1 - x * x * (3 - 2 * x)
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
			local pose = poseRun(r.phase, math.clamp(frac * 1.3, 0.15, 1), 0, isR15)
			pose.root[1] += 0.22 * (1 - frac)
			return pose
		end
		local drive = driveAmount(r, event)
		local amp = math.clamp(0.6 + frac * 0.45 + drive * 0.3, 0, 1)
		return poseRun(r.phase, amp, drive, isR15)
	elseif state == "dip" then
		return poseDip(isR15)
	elseif state == "celebrate" then
		return poseCelebrate(r.celebrate, r.poseClock, isR15)
	end
	return poseStand(r.poseClock, isR15)
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
			local cyclesPerSec = 1.15 + r.speed / 28 + 0.5 * driveAmount(r, current.event)
			if r.speed > 0.2 then
				r.phase = (r.phase + dt * math.pi * 2 * cyclesPerSec) % (math.pi * 2)
			end
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
	mode = "chase", -- "start" | "chase" | "finish"
	offset = Vector3.new(0, 6, 14),
	look = Vector3.new(0, 2, 0),
	snap = true,
	fov = 70,
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
	local r = cam.target
	if not camera or not r then
		return
	end
	camera.CameraType = Enum.CameraType.Scriptable
	local base: Vector3
	local _, dir = runnerSample(r)
	if r.root and r.root.Parent then
		local rp = r.root.Position
		base = Vector3.new(rp.X, FLOOR_TOP, rp.Z)
	else
		local p = runnerSample(r)
		base = p
	end
	local up = Vector3.yAxis
	local right = dir:Cross(up)
	local offset: Vector3
	local look: Vector3
	local mode = cam.mode
	if mode == "start" then
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
	local k = if cam.snap then 1 else 1 - math.exp(-dt * 5)
	cam.offset = cam.offset:Lerp(offset, k)
	cam.look = cam.look:Lerp(look, k)
	cam.snap = false
	local speedFrac = math.clamp(r.speed / 37, 0, 1)
	local fovTarget = if mode == "chase" then 68 + 10 * speedFrac else 62
	cam.fov += (fovTarget - cam.fov) * math.min(1, dt * 4)
	camera.FieldOfView = cam.fov
	camera.CFrame = CFrame.lookAt(base + cam.offset, base + cam.look)
end

RunService:BindToRenderStep("TrackAndFieldCamera", Enum.RenderPriority.Camera.Value + 1, updateCamera)

---------------------------------------------------------------------
-- INPUT (tap left / right)
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
		staminaFill.BackgroundColor3 = C_BAD
		return
	end
	r.tapQuality = if r.lastSide == nil then 1 else tapQualityFor(gap)
	r.lastSide = side
	r.lastTap = t
end

local LEFT_KEYS = {
	[Enum.KeyCode.A] = true,
	[Enum.KeyCode.Left] = true,
	[Enum.KeyCode.Q] = true,
	[Enum.KeyCode.ButtonL1] = true,
	[Enum.KeyCode.ButtonL2] = true,
	[Enum.KeyCode.DPadLeft] = true,
}
local RIGHT_KEYS = {
	[Enum.KeyCode.D] = true,
	[Enum.KeyCode.Right] = true,
	[Enum.KeyCode.E] = true,
	[Enum.KeyCode.ButtonR1] = true,
	[Enum.KeyCode.ButtonR2] = true,
	[Enum.KeyCode.DPadRight] = true,
}

UserInputService.InputBegan:Connect(function(input: InputObject, _processed: boolean)
	if UserInputService:GetFocusedTextBox() then
		return
	end
	if LEFT_KEYS[input.KeyCode] then
		onTap("L")
	elseif RIGHT_KEYS[input.KeyCode] then
		onTap("R")
	end
end)

local function hookZone(zone: TextButton, side: string)
	zone.InputBegan:Connect(function(input: InputObject)
		if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
			onTap(side)
		end
	end)
end
hookZone(touchLeft, "L")
hookZone(touchRight, "R")

---------------------------------------------------------------------
-- UI UPDATES
---------------------------------------------------------------------
local function setRow(row: Row, place: string, name: string, info: string, value: string, highlight: boolean, visible: boolean)
	row.frame.Visible = visible
	row.place.Text = place
	row.name.Text = name
	row.info.Text = info
	row.value.Text = value
	row.frame.BackgroundColor3 = if highlight then Color3.fromRGB(92, 74, 20) else C_PANEL2
	row.name.TextColor3 = if highlight then C_ACCENT else C_TEXT
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

local function refreshLeaderboard()
	tabRace.BackgroundColor3 = if uiTab == "race" then C_ACCENT else C_PANEL2
	tabRace.TextColor3 = if uiTab == "race" then C_PANEL else C_TEXT
	tabBests.BackgroundColor3 = if uiTab == "bests" then C_ACCENT else C_PANEL2
	tabBests.TextColor3 = if uiTab == "bests" then C_PANEL else C_TEXT
	local current = race
	if uiTab == "bests" then
		local evName = if current then current.event.Name else EVENTS[1].Name
		lbSub.Text = evName .. " season bests"
		local list = seasonBests[evName]
		for i, row in ipairs(lbRows) do
			local e = list[i]
			if e then
				setRow(row, tostring(i), e.name, "", formatTime(e.time), e.isPlayer, true)
			else
				setRow(row, tostring(i), "-", "", "", false, true)
			end
		end
		return
	end
	if current and current.phase ~= "intro" then
		lbSub.Text = current.event.Name .. " " .. current.round .. (if current.phase == "running" then "  -  LIVE" else "")
		local order = sortedOrder(current.runners)
		local leader = order[1]
		for i, row in ipairs(lbRows) do
			local r = order[i]
			if r then
				local value
				if r.dq then
					value = "DQ"
				elseif r.dnf then
					value = "DNF"
				elseif r.finished then
					value = formatTime(r.finishTime)
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
		lbSub.Text = lastResults.title
		for i, row in ipairs(lbRows) do
			local data = lastResults.rows[i]
			if data then
				setRow(row, data[1], data[2], data[3], data[4], data[5] == "you", true)
			else
				setRow(row, "", "", "", "", false, false)
			end
		end
	else
		lbSub.Text = "Waiting for the first race"
		for _, row in ipairs(lbRows) do
			setRow(row, "", "", "", "", false, false)
		end
	end
end

tabRace.Activated:Connect(function()
	uiTab = "race"
	refreshLeaderboard()
end)
tabBests.Activated:Connect(function()
	uiTab = "bests"
	refreshLeaderboard()
end)

local function showOverlay(title: string, sub: string, headers: { string }, rows: { { string } }, footer: string, footerColor: Color3?)
	overlay.Visible = true
	ovTitle.Text = title
	ovSub.Text = sub
	for c, h in ipairs(ovHeaders) do
		h.Text = headers[c] or ""
	end
	ovFooter.Text = footer
	ovFooter.TextColor3 = footerColor or C_TEXT
	for i, row in ipairs(ovRows) do
		local data = rows[i]
		row.frame.Visible = data ~= nil
		if data then
			for c = 1, #OV_COLS do
				row.cols[c].Text = data[c] or ""
			end
			local isYou = data[7] == "you"
			row.frame.BackgroundColor3 = if isYou then Color3.fromRGB(92, 74, 20) else C_PANEL2
			row.cols[3].TextColor3 = if isYou then C_ACCENT else C_TEXT
			local q = data[6] or ""
			row.cols[6].TextColor3 = if q == "Q" or q == "q" then C_GOOD elseif q == "DQ" then C_BAD else C_ACCENT
		end
	end
	overlay.Size = UDim2.fromOffset(600, 136 + 38 * #rows)
end

local function hideOverlay()
	overlay.Visible = false
end

local function updateHud(r: Runner?, event: Event?)
	local stamina = if r then r.stamina else CONFIG.StaminaMax
	local frac = math.clamp(stamina / CONFIG.StaminaMax, 0, 1)
	staminaFill.Size = UDim2.fromScale(frac, 1)
	staminaValue.Text = tostring(math.floor(stamina + 0.5))
	local target = if frac > 0.5 then C_GOOD elseif frac > 0.25 then Color3.fromRGB(250, 200, 40) else C_BAD
	staminaFill.BackgroundColor3 = if r then staminaFill.BackgroundColor3:Lerp(target, 0.15) else target
	if r and event then
		speedLabel.Text = string.format("%.1f / %.1f studs/s", r.speed, event.MaxSpeed)
		laneLabel.Text = "LANE " .. r.lane
		local current = race
		local since = if current and r.started and not r.finished then current.clock - r.lastTap else 0
		rhythmMarker.Position = UDim2.fromScale(math.clamp(since / RHYTHM_SPAN, 0, 1), 0.5)
		rhythmBack.Visible = current ~= nil and current.phase == "running" and not r.finished
	else
		speedLabel.Text = ""
		laneLabel.Text = ""
		rhythmBack.Visible = false
	end
end

---------------------------------------------------------------------
-- RACE FLOW
---------------------------------------------------------------------
type Result = { athlete: Athlete, lane: number, time: number?, rt: number, status: string, heat: string, mark: string }

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
	BlocksFolder:ClearAllChildren()
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
		if r.isPlayer then
			r.cap = 1
			r.reaction = if r.falseStarts > 0
				then CONFIG.ReactionAfterFalseStart
				else rng:NextNumber(CONFIG.ReactionMin, CONFIG.ReactionMax)
		elseif r.falseStarts > 0 then
			r.reaction = math.max(r.reaction, CONFIG.ReactionAfterFalseStart)
		end
		if r.isPlayer and not r.dq then
			placePlayerAt(r)
		end
	end
end

local function runHeat(event: Event, round: string, athletes: { Athlete }): { Result }
	-- random lanes
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

	local current: Race = {
		event = event,
		round = round,
		runners = runners,
		phase = "intro",
		clock = 0,
		goal = event.Meters * SPM + START_BACK,
		falseStartBy = nil,
		you = you,
		order = runners,
	}
	race = current
	eventLabel.Text = event.Name .. "  " .. string.upper(round)
	clockLabel.Text = ""
	local evLabel = boardGui:FindFirstChild("Event")
	if evLabel and evLabel:IsA("TextLabel") then
		evLabel.Text = string.upper(event.Name .. " " .. round)
	end
	local boardTime = boardGui:FindFirstChild("Time") :: TextLabel?

	-- lane draw
	local drawRows = {}
	for _, r in ipairs(runners) do
		local pb = if r.isPlayer then playerBest(event.Name) else nil
		local sb = nil
		for _, e in ipairs(seasonBests[event.Name]) do
			if e.name == r.athlete.Name then
				sb = e.time
			end
		end
		table.insert(drawRows, {
			tostring(r.lane),
			"",
			r.athlete.Name,
			if pb then "PB" elseif sb then "SB" else "",
			formatTime(pb or sb),
			"",
			if r.isPlayer then "you" else "",
		})
	end
	showOverlay(
		event.Name .. "  " .. string.upper(round),
		"LANE DRAW (random)",
		{ "LANE", "", "ATHLETE", "", "BEST", "" },
		drawRows,
		if you then ("You are in lane " .. you.lane) else "Not racing - live results on the leaderboard",
		C_ACCENT
	)
	refreshLeaderboard()
	waitFor(CONFIG.IntroTime, function(left)
		subText.Text = ""
		bigText.Text = ""
		ovFooter.Text = (if you then ("You are in lane " .. you.lane .. "  -  ") else "Not racing - live results on the leaderboard  -  ") .. "starting in " .. math.ceil(left)
	end)
	hideOverlay()

	-- only you are on the track (rivals are times on the leaderboard)
	if you then
		placeBlocks(you.lane, you.sStart)
		lockPlayer(true)
		placePlayerAt(you)
	end
	touchLeft.Visible = you ~= nil
	touchRight.Visible = you ~= nil

	local function leaderRunner(): Runner
		local order = sortedOrder(runners)
		for _, r in ipairs(order) do
			if not r.finished and not r.dq then
				return r
			end
		end
		return order[1]
	end
	if you then
		startCamera(you, "start")
	end

	-- starting sequence (repeats after a false start)
	while true do
		current.phase = "marks"
		current.falseStartBy = nil
		setPoses(current, "marks")
		refreshLeaderboard()
		flash("ON YOUR MARKS", C_TEXT, nil, nil)
		waitFor(2.2)
		current.phase = "set"
		setPoses(current, "set")
		flash("SET", C_ACCENT, nil, nil)
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
		if isDQ then
			fs.dq = true
			fs.poseState = "celebrate"
			fs.celebrate = "dq"
		end
		setPoses(current, "stand")
		if fs.isPlayer then
			flash(
				"FALSE START",
				C_BAD,
				if isDQ then "Disqualified! (second false start)" else "Warning - your reaction time is now 0.15",
				nil
			)
			if isDQ then
				local _, hum = getPlayerParts()
				if hum then
					hum:Move(Vector3.zero)
				end
				touchLeft.Visible = false
				touchRight.Visible = false
			end
		end
		if fs.dq then
			fs.poseState = "celebrate"
			fs.celebrate = "dq"
		end
		waitFor(2.6)
		resetForRestart(current)
	end

	-- GO
	current.phase = "running"
	current.clock = 0
	flash("GO!", C_GOOD, nil, 0.7)
	cam.mode = "chase"
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

	while true do
		local dt = RunService.Heartbeat:Wait()
		dt = math.min(dt, 0.1)
		current.clock += dt
		local t = current.clock
		local unfinished = 0
		local rivalsUnfinished = 0
		for _, r in ipairs(runners) do
			local wasFinished = r.finished
			stepRunner(r, dt, t, event, current.goal)
			if not r.dq then
				if r.started and r.poseState == "set" then
					r.poseState = "run"
					r.phase = math.pi * 1.5 -- block clearance: the back (right) leg drives through first
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
			end
			if r.finished and not wasFinished then
				-- assign the place right away (finish order = time order)
				local place = 1
				for _, o in ipairs(runners) do
					if o ~= r and o.finished and (o.finishTime or 0) < (r.finishTime or 0) then
						place += 1
					end
				end
				r.place = place
				r.celebrate = if place == 1 then "win" elseif place <= 3 then "podium" else "tired"
				if r.isPlayer and not youFinishShown then
					youFinishShown = true
					cam.mode = "finish"
					touchLeft.Visible = false
					touchRight.Visible = false
					flash(ordinal(place), if place == 1 then C_ACCENT elseif place <= 3 then C_TEXT else C_MUTED, formatTime(r.finishTime) .. " s", nil)
				end
			end
		end
		-- places can shift by milliseconds; fix celebrations once everyone is in
		if rivalsUnfinished == 0 and not rivalsDoneAt then
			rivalsDoneAt = t
		end
		if you and not you.finished and not you.dq and rivalsDoneAt and t - rivalsDoneAt > 10 then
			you.dnf = true -- stopped tapping
			flash("DNF", C_BAD, "Did not finish", 2)
		end
		if unfinished == 0 and not allDoneAt then
			allDoneAt = t
		end
		if t - lastBoard > 0.05 then
			lastBoard = t
			local leaderShown = leaderRunner()
			local shownTime = t
			if leaderShown and leaderShown.finished and leaderShown.finishTime then
				shownTime = leaderShown.finishTime
			end
			if you and you.finished and you.finishTime then
				clockLabel.Text = formatTime(you.finishTime)
			else
				clockLabel.Text = string.format("%.2f", shownTime)
			end
			if boardTime then
				local winner = sortedOrder(runners)[1]
				boardTime.Text = if winner and winner.finished then formatTime(winner.finishTime) else string.format("%.2f", t)
			end
		end
		if t - lastUi > 0.1 then
			lastUi = t
			refreshLeaderboard()
		end
		updateHud(you, event)
		if allDoneAt and t - allDoneAt > 3 then
			break
		end
		if t > 240 then
			break
		end
	end
	current.phase = "done"
	touchLeft.Visible = false
	touchRight.Visible = false

	-- results
	local order = sortedOrder(runners)
	local results: { Result } = {}
	for i, r in ipairs(order) do
		local status = if r.dq then "DQ" elseif r.dnf or not r.finished then "DNF" else "OK"
		r.place = i
		table.insert(results, {
			athlete = r.athlete,
			lane = r.lane,
			time = if status == "OK" then r.finishTime else nil,
			rt = r.reaction,
			status = status,
			heat = round,
			mark = "",
		})
		if status == "OK" and r.finishTime then
			recordBest(event.Name, r.athlete, r.finishTime)
		end
	end
	race = current -- keep the runners visible while results show
	return results
end

local function resultRows(results: { Result }, withRT: boolean): { { string } }
	local rows = {}
	for i, res in ipairs(results) do
		table.insert(rows, {
			if res.status == "OK" then tostring(i) else "-",
			"L" .. res.lane,
			res.athlete.Name,
			if withRT then string.format("RT %.3f", res.rt) else res.heat,
			if res.status == "OK" then formatTime(res.time) else res.status,
			res.mark,
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
			if res.status == "OK" then formatTime(res.time) else res.status,
			if res.athlete.IsPlayer then "you" else "",
		})
	end
	lastResults = { title = title, rows = rows }
end

local function finishRaceScreen(current: Race, title: string, sub: string, results: { Result }, footer: string, footerColor: Color3?)
	clearFlash()
	showOverlay(title, sub, { "PL", "LANE", "ATHLETE", "REACTION", "TIME", "" }, resultRows(results, true), footer, footerColor)
	storeLastResults(title, results)
	waitFor(CONFIG.ResultsTime)
	hideOverlay()
	cleanupRace(current)
	race = nil
	stopCamera()
	lockPlayer(false)
	updateHud(nil, nil)
	clockLabel.Text = ""
	refreshLeaderboard()
end

---------------------------------------------------------------------
-- TOURNAMENT LOOP:  semifinals -> finalists -> final, for every event
---------------------------------------------------------------------
local function playerCanRace(): boolean
	local _, hum, root = getPlayerParts()
	return Settings.AutoRace and hum ~= nil and root ~= nil
end

local function runEvent(event: Event)
	local pool = shuffle(table.clone(roster))
	local youIn = playerCanRace()
	local heatA: { Athlete } = {}
	local heatB: { Athlete } = {}
	if youIn then
		table.insert(heatA, youAthlete)
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

	-- your semifinal (raced live)
	local roundName = "Semifinal " .. yourSemi
	local resultsA = runHeat(event, roundName, heatA)
	local currentA = race :: Race

	-- the other semifinal (simulated)
	local simRunners = simulateHeat(event, heatB)
	local resultsB: { Result } = {}
	for _, r in ipairs(sortedOrder(simRunners)) do
		local ok = r.finished and r.finishTime ~= nil
		table.insert(resultsB, {
			athlete = r.athlete,
			lane = r.lane,
			time = if ok then r.finishTime else nil,
			rt = r.reaction,
			status = if ok then "OK" else "DNF",
			heat = "Semifinal " .. otherSemi,
			mark = "",
		})
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

	-- results of your semi
	local youResult: Result? = nil
	for _, res in ipairs(resultsA) do
		if res.athlete.IsPlayer then
			youResult = res
		end
	end
	local semiFooter = "Qualifying: top 3 (Q) + 2 fastest times (q)"
	local semiColor = C_TEXT
	if youResult then
		if youResult.mark == "Q" or youResult.mark == "q" then
			semiFooter = "You placed " .. ordinal(table.find(resultsA, youResult) or 0) .. " - through to the final!"
			semiColor = C_GOOD
		elseif youResult.status == "DQ" then
			semiFooter = "Disqualified for a false start"
			semiColor = C_BAD
		end
	end
	finishRaceScreen(currentA, event.Name .. "  " .. string.upper(roundName), "RESULTS", resultsA, semiFooter, semiColor)

	-- finalists screen
	table.sort(finalists, function(a, b)
		return (a.time or 999) < (b.time or 999)
	end)
	local finalRows = {}
	local youThrough = false
	for i, res in ipairs(finalists) do
		if res.athlete.IsPlayer then
			youThrough = true
		end
		table.insert(finalRows, {
			tostring(i),
			if res.heat == roundName then "SF" .. yourSemi else "SF" .. otherSemi,
			res.athlete.Name,
			res.heat,
			formatTime(res.time),
			res.mark,
			if res.athlete.IsPlayer then "you" else "",
		})
	end
	local finFooter = if youThrough then "YOU MADE THE FINAL!" elseif youIn then "You did not qualify - watch the final" else "Here are the finalists"
	showOverlay(event.Name .. "  FINALISTS", "These 8 athletes are making it to the final", { "#", "HEAT", "ATHLETE", "SEMIFINAL", "TIME", "" }, finalRows, finFooter, if youThrough then C_GOOD else C_ACCENT)
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
	local resultsF = runHeat(event, "Final", finalAthletes)
	local currentF = race :: Race
	local medals = { "GOLD", "SILVER", "BRONZE" }
	for i, res in ipairs(resultsF) do
		if i <= 3 and res.status == "OK" then
			res.mark = string.sub(medals[i], 1, 1)
		end
	end
	local champion = resultsF[1]
	local footer = "Champion: " .. champion.athlete.Name .. "  " .. formatTime(champion.time)
	local footerColor = C_ACCENT
	for i, res in ipairs(resultsF) do
		if res.athlete.IsPlayer then
			if i <= 3 and res.status == "OK" then
				footer = "You won " .. medals[i] .. "!  " .. formatTime(res.time)
				footerColor = C_ACCENT
			elseif res.status == "OK" then
				footer = "You finished " .. ordinal(i) .. "  -  " .. formatTime(res.time)
				footerColor = C_TEXT
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

player.CharacterAdded:Connect(function()
	-- the old character is gone: forget its locked state
	controlsLocked = false
	local current = race
	local you = current and current.you
	if current and you and not you.dq and current.phase ~= "done" then
		-- respawned mid race: put the new character back in its lane
		task.wait(0.5)
		lockPlayer(true)
		you.rig = nil
		placePlayerAt(you)
	else
		-- make sure movement works on the new character
		local controls = getControls()
		if controls then
			pcall(function()
				controls:Enable()
			end)
		end
	end
end)

task.spawn(function()
	flash("TRACK AND FIELD", C_ACCENT, "Demo  -  60m  100m  200m  400m", nil)
	task.wait(4)
	clearFlash()
	if not player.Character then
		player.CharacterAdded:Wait()
	end
	task.wait(1)
	while true do
		for _, event in ipairs(EVENTS) do
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
				stopCamera()
				lockPlayer(false)
				task.wait(2)
			end
		end
	end
end)
