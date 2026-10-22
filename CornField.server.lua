--[[
	=====================================================================
	  CORN FIELD  v1.01  -  a co-op horror game for Roblox  (ONE SCRIPT)
	=====================================================================

	HOW TO INSTALL
	  1. Open Roblox Studio.
	  2. In the Explorer, right-click ServerScriptService > Insert Object > Script.
	  3. Delete what is inside the new Script and paste this WHOLE file in.
	  4. Press Play. The lobby, elevators, both maps, the monster and the
	     farmer are all built by this script. You don't need anything else.

	BADGES + GAME PASS (do this on create.roblox.com > your game)
	  * Badge 1: "Escaped the Corn Field"  -> paste its ID into CONFIG.BadgeId
	  * Badge 2: "Survived the Nightmare"  -> paste its ID into CONFIG.NightmareBadgeId
	  * Game Pass: "Play as the Corn Monster", on sale for 100 Robux.
	    Paste its ID into CONFIG.MonsterGamepassId.
	    (Roblox only lets you set the price on the website, not in a script.)
	  * Beating Normal mode ALSO unlocks playing as the Corn Monster (saved).
	    To save it between servers: Game Settings > Security >
	    "Enable Studio Access to API Services" (for testing in Studio).

	CONTROLS
	  Shift (or the "Sprint" button on phones)  sprint (unlimited). Tap = toggle, hold = hold.
	  1 / click the Flashlight tool                    flashlight on / off
	  Q / E / R                                        the 3 gate buttons (Normal)
	  E                                                everything else

	NORMAL MODE (the Corn Field)
	  Find the 3 glowing symbols. Each has 1, 2 or 3 dots. Press them on the
	  gate panel in dot order. The gate opens. Run out of the field.

	NIGHTMARE MODE (the Farm)
	  You wake up locked in a barn. Find the loose boards to get out.
	  Find the rusty yellow key on the farmer's farm (he stabs trespassers
	  with his pitchfork), call the police from the shed phone, unlock the
	  gate by the road and get in the police car before it drives off.

	THE CORN MONSTER
	  He doesn't come out often. When he does, he rips a hole in the corn
	  wall about 10 studs BEHIND you (or IN FRONT if there's no wall behind).
	  In Nightmare he claws his way out of the ground instead. He growls when
	  he spots you and you can hear his heavy footsteps. Shine your
	  flashlight on him to make him go away.
=====================================================================]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")
local BadgeService = game:GetService("BadgeService")
local MarketplaceService = game:GetService("MarketplaceService")
local Lighting = game:GetService("Lighting")

-- ====================================================================
-- SETTINGS (change these)
-- ====================================================================
local CONFIG = {
	BadgeId = 0, -- badge for escaping the Corn Field (Normal)
	NightmareBadgeId = 0, -- badge for surviving Nightmare
	MonsterGamepassId = 0, -- game pass to play as the Corn Monster
	GamepassPrice = 100, -- only shown on the lobby sign

	ElevatorCount = 4,
	MaxPlayersPerElevator = 4,
	ElevatorCountdown = 15, -- seconds after the first player gets in
	NightmareUnlocked = true,

	MatchTime = 15 * 60, -- seconds before the night is over
	FirstPerson = true, -- survivors are locked in first person

	LobbyWalkSpeed = 16,
	LobbySprintSpeed = 24,
	WalkSpeed = 12, -- in the maps
	SprintSpeed = 20, -- unlimited sprint
	FlashlightBattery = 420, -- seconds of light

	MonsterScale = 0.95,
	EmergeDistance = 10, -- how far behind (or in front of) you he bursts out
	MonsterSightRange = 95,
	MonsterHearRange = 16, -- he hears you this close (more if you sprint)
	MonsterCatchRange = 4.5,
	MonsterPlayerSpeed = 19, -- walk speed when a PLAYER is the monster
	MonsterPlayerCatchRange = 6,

	FarmerWalkSpeed = 6,
	FarmerChaseSpeed = 15.5, -- you can outrun him if you sprint
	FarmerSightRange = 45,
	FarmerCatchRange = 4.5,
	PoliceDelay = 40, -- seconds after the call until the police arrive

	CornDetail = 2, -- 1 = low (faster), 2 = normal, 3 = high

	-- Swap these for your own sounds from the Creator Store if you want
	-- (paste "rbxassetid://12345"). The defaults are built into Roblox.
	Sounds = {
		Footstep = "rbxasset://sounds/action_footsteps_plastic.mp3",
		Growl = "rbxasset://sounds/uuhhh.mp3",
		Rustle = "rbxasset://sounds/action_footsteps_plastic.mp3",
		Ding = "rbxasset://sounds/electronicpingshort.wav",
		Stab = "rbxasset://sounds/swordlunge.wav",
		Whoosh = "rbxasset://sounds/swordslash.wav",
	},
	GrowlPitch = 0.38, -- low pitch turns the default sound into a growl
}

-- the monster doesn't come out a lot (rearm = seconds between appearances)
local MODES = {
	Normal = { firstEmerge = 50, rearmMin = 45, rearmMax = 80, hunt = 15, litSlow = 0.45, fleeLit = 2.5, giveUp = 7, twitch = 1 },
	Nightmare = { firstEmerge = 60, rearmMin = 40, rearmMax = 70, hunt = 16.5, litSlow = 0.5, fleeLit = 3, giveUp = 8, twitch = 1.5 },
}

-- ====================================================================
-- CONSTANTS + HELPERS
-- ====================================================================
local SIZE = 25 -- maze is SIZE x SIZE blocks (must be odd)
local BS = 10 -- block size in studs
local WALL_H = 16
local DIRS = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }
local SHAPES = { "Circle", "Triangle", "Square" }
local SHAPE_COLORS = {
	Circle = Color3.fromRGB(255, 70, 60),
	Triangle = Color3.fromRGB(80, 200, 255),
	Square = Color3.fromRGB(255, 210, 60),
}
local LOBBY = Vector3.new(0, 100, 0) -- lobby floor center
local C = CFrame.new
local A = CFrame.Angles

local function lerp(a, b, t)
	return a + (b - a) * t
end

local function lerpAngle(a, b, t)
	local d = (b - a + math.pi) % (2 * math.pi) - math.pi
	return a + d * t
end

local function key(x, y)
	return x * 100 + y
end

local function flat(v)
	return Vector3.new(v.X, 0, v.Z)
end

local function make(class, props, parent)
	local inst = Instance.new(class)
	for k, v in pairs(props) do
		inst[k] = v
	end
	if parent then
		inst.Parent = parent
	end
	return inst
end

local function applyPartProps(p, props)
	if props.Shape then
		p.Shape = props.Shape
	end
	if props.Size then
		p.Size = props.Size
	end
	for k, v in pairs(props) do
		if k ~= "Shape" and k ~= "Size" then
			p[k] = v
		end
	end
end

-- decoration part: anchored, no collision
local function part(props, parent)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	applyPartProps(p, props)
	p.Parent = parent
	return p
end

-- solid part: anchored, you can stand on it / bump into it
local function solid(props, parent)
	local p = part(props, nil)
	if props.CanCollide == nil then
		p.CanCollide = true
	end
	if props.CanQuery == nil then
		p.CanQuery = true
	end
	p.Parent = parent
	return p
end

local function wedge(props, parent)
	local p = Instance.new("WedgePart")
	p.Anchored = true
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	applyPartProps(p, props)
	p.Parent = parent
	return p
end

local yieldCounter = 0
local function maybeYield()
	yieldCounter += 1
	if yieldCounter % 250 == 0 then
		task.wait()
	end
end

local function surfaceText(partInst, face, text, color, font, bg)
	local gui = make("SurfaceGui", { Face = face, SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud, PixelsPerStud = 40, LightInfluence = 0 }, partInst)
	local label = make("TextLabel", {
		Size = UDim2.fromScale(1, 1), BackgroundTransparency = bg and 0 or 1, BackgroundColor3 = bg or Color3.new(0, 0, 0),
		Text = text, TextColor3 = color or Color3.new(1, 1, 1), Font = font or Enum.Font.Antique, TextScaled = true, TextWrapped = true,
	}, gui)
	make("UIPadding", { PaddingLeft = UDim.new(0.05, 0), PaddingRight = UDim.new(0.05, 0), PaddingTop = UDim.new(0.06, 0), PaddingBottom = UDim.new(0.06, 0) }, label)
	return label, gui
end

local function newSound(id, parent, volume, speed, maxDist)
	return make("Sound", {
		SoundId = id, Volume = volume or 1, PlaybackSpeed = speed or 1,
		RollOffMode = Enum.RollOffMode.InverseTapered, RollOffMinDistance = 8, RollOffMaxDistance = maxDist or 90,
	}, parent)
end

local function playSound(id, parent, volume, speed, maxDist)
	local s = newSound(id, parent, volume, speed, maxDist)
	s:Play()
	Debris:AddItem(s, 8)
	return s
end

-- ====================================================================
-- LIGHTING (night)
-- ====================================================================
Lighting.ClockTime = 0.3
Lighting.Brightness = 0.6
Lighting.Ambient = Color3.fromRGB(14, 14, 18)
Lighting.OutdoorAmbient = Color3.fromRGB(34, 36, 44)
Lighting.EnvironmentDiffuseScale = 0.2
Lighting.EnvironmentSpecularScale = 0.2
Lighting.GlobalShadows = true
local atmo = Lighting:FindFirstChildOfClass("Atmosphere") or make("Atmosphere", {}, Lighting)
atmo.Density = 0.36
atmo.Offset = 0.05
atmo.Color = Color3.fromRGB(46, 50, 42)
atmo.Decay = Color3.fromRGB(24, 26, 20)
atmo.Glare = 0
atmo.Haze = 1.4

-- ====================================================================
-- PLAYER STATE + HUD
-- ====================================================================
local PS = {} -- [player] = state

local function hud(plr)
	local st = PS[plr]
	return st and st.hud
end

local function buildHUD(plr)
	local pg = plr:WaitForChild("PlayerGui", 20)
	if not pg then
		return nil
	end
	local old = pg:FindFirstChild("CornHUD")
	if old then
		old:Destroy()
	end
	local gui = make("ScreenGui", { Name = "CornHUD", ResetOnSpawn = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling }, pg)
	local top = make("TextLabel", {
		Name = "Top", AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 6), Size = UDim2.new(0.62, 0, 0, 30),
		BackgroundColor3 = Color3.fromRGB(26, 16, 10), BackgroundTransparency = 0.35, TextColor3 = Color3.fromRGB(240, 220, 175),
		Font = Enum.Font.Antique, TextScaled = true, Text = "",
	}, gui)
	make("UICorner", { CornerRadius = UDim.new(0, 8) }, top)
	make("UIStroke", { Color = Color3.fromRGB(120, 80, 40), Thickness = 1.5, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, top)
	make("UITextSizeConstraint", { MaxTextSize = 22 }, top)

	local msg = make("TextLabel", {
		Name = "Msg", AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 0.8, 0), Size = UDim2.new(0.8, 0, 0, 44),
		BackgroundTransparency = 1, TextColor3 = Color3.fromRGB(255, 235, 200), TextStrokeTransparency = 0.3,
		Font = Enum.Font.Antique, TextScaled = true, Text = "", Visible = false,
	}, gui)
	make("UITextSizeConstraint", { MaxTextSize = 34 }, msg)

	local bars = make("Frame", {
		Name = "Bars", AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 12, 1, -14), Size = UDim2.new(0, 200, 0, 40),
		BackgroundTransparency = 1, Visible = false,
	}, gui)
	local function bar(y, color, label)
		local back = make("Frame", { Position = UDim2.new(0, 0, 0, y), Size = UDim2.new(1, 0, 0, 14), BackgroundColor3 = Color3.fromRGB(20, 16, 12), BackgroundTransparency = 0.2 }, bars)
		make("UICorner", { CornerRadius = UDim.new(0, 5) }, back)
		local fill = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = color }, back)
		make("UICorner", { CornerRadius = UDim.new(0, 5) }, fill)
		make("TextLabel", {
			Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Text = label, TextColor3 = Color3.new(1, 1, 1),
			TextStrokeTransparency = 0.5, Font = Enum.Font.GothamBold, TextSize = 11, ZIndex = 3,
		}, back)
		return fill
	end
	local batt = bar(20, Color3.fromRGB(170, 210, 255), "FLASHLIGHT")
	local old2 = pg:FindFirstChild("CornFX")
	if old2 then
		old2:Destroy()
	end
	local fx = make("ScreenGui", { Name = "CornFX", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 10 }, pg)
	local flashFrame = make("Frame", { Name = "Flash", Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 1, BorderSizePixel = 0 }, fx)
	return { gui = gui, top = top, msg = msg, bars = bars, batt = batt, flash = flashFrame, msgToken = 0 }
end

local function showMessage(plr, text, duration, color)
	local h = hud(plr)
	if not h then
		return
	end
	h.msgToken += 1
	local token = h.msgToken
	h.msg.Text = text
	h.msg.TextColor3 = color or Color3.fromRGB(255, 235, 200)
	h.msg.Visible = true
	task.delay(duration or 3, function()
		if h.msgToken == token and h.msg.Parent then
			h.msg.Visible = false
		end
	end)
end

local function setTop(plr, text)
	local h = hud(plr)
	if h and h.top.Text ~= text then
		h.top.Text = text
	end
end

-- ====================================================================
-- ANIMATIONS (walk + run for R6 and R15)
-- ====================================================================
local ANIMS = {
	R15 = {
		idle = "http://www.roblox.com/asset/?id=507766666",
		walk = "http://www.roblox.com/asset/?id=507777826",
		run = "http://www.roblox.com/asset/?id=507767714",
		jump = "http://www.roblox.com/asset/?id=507765000",
		fall = "http://www.roblox.com/asset/?id=507767968",
		climb = "http://www.roblox.com/asset/?id=507765644",
	},
	R6 = {
		idle = "http://www.roblox.com/asset/?id=180435571",
		walk = "http://www.roblox.com/asset/?id=180426354",
		run = "http://www.roblox.com/asset/?id=180426354",
		jump = "http://www.roblox.com/asset/?id=125750702",
		fall = "http://www.roblox.com/asset/?id=180436148",
		climb = "http://www.roblox.com/asset/?id=180436334",
	},
}

-- Backup animator, only used if the character has no "Animate" script.
local function runBackupAnimator(char, hum, hrp, ids, isR15)
	local animator = hum:FindFirstChildOfClass("Animator") or make("Animator", {}, hum)
	local tracks = {}
	for _, name in ipairs({ "idle", "walk", "run" }) do
		local anim = make("Animation", { AnimationId = ids[name] })
		local ok, track = pcall(function()
			return animator:LoadAnimation(anim)
		end)
		if ok and track then
			track.Looped = true
			track.Priority = Enum.AnimationPriority.Core
			tracks[name] = track
		end
	end
	if not tracks.idle or not tracks.walk then
		return
	end
	tracks.run = tracks.run or tracks.walk
	local current
	local conn
	conn = RunService.Heartbeat:Connect(function()
		if not char.Parent or hum.Health <= 0 or not hrp.Parent then
			conn:Disconnect()
			return
		end
		local speed = flat(hrp.AssemblyLinearVelocity).Magnitude
		local want = "idle"
		if speed > 17 then
			want = "run"
		elseif speed > 0.6 then
			want = "walk"
		end
		if want ~= current then
			if current then
				tracks[current]:Stop(0.2)
			end
			tracks[want]:Play(0.2)
			current = want
		end
		if want == "walk" then
			tracks.walk:AdjustSpeed(speed / (isR15 and 10 or 14.5))
		elseif want == "run" then
			tracks.run:AdjustSpeed(speed / (isR15 and 20 or 14.5))
		end
	end)
end

local function fixAnimations(char, hum, hrp)
	local isR15 = hum.RigType == Enum.HumanoidRigType.R15
	local ids = isR15 and ANIMS.R15 or ANIMS.R6
	local animate = char:WaitForChild("Animate", 4)
	if not animate then
		runBackupAnimator(char, hum, hrp, ids, isR15)
		return
	end
	-- fill in any missing walk/run/idle animations on the default Animate script
	for name, id in pairs(ids) do
		local value = animate:FindFirstChild(name)
		if value then
			local hasOne = false
			for _, a in ipairs(value:GetChildren()) do
				if a:IsA("Animation") then
					hasOne = true
					if a.AnimationId == "" then
						a.AnimationId = id
					end
				end
			end
			if not hasOne then
				make("Animation", { Name = name:gsub("^%l", string.upper) .. "Anim", AnimationId = id }, value)
			end
		end
	end
	if hum:FindFirstChildOfClass("Animator") == nil then
		make("Animator", {}, hum)
	end
end

-- ====================================================================
-- GAME PASS + BADGE
-- ====================================================================
local DataStoreService = game:GetService("DataStoreService")
local progressStore
pcall(function()
	progressStore = DataStoreService:GetDataStore("CornField_Progress_1")
end)

local function loadProgress(plr)
	local st = PS[plr]
	if not st then
		return
	end
	if progressStore then
		local ok, data = pcall(function()
			return progressStore:GetAsync(tostring(plr.UserId))
		end)
		if ok and type(data) == "table" and data.beatNormal then
			st.beatNormal = true
		end
	end
	if not st.beatNormal and CONFIG.BadgeId ~= 0 then
		local ok, has = pcall(function()
			return BadgeService:UserHasBadgeAsync(plr.UserId, CONFIG.BadgeId)
		end)
		if ok and has then
			st.beatNormal = true
		end
	end
end

local function checkPass(plr)
	local st = PS[plr]
	if not st then
		return
	end
	if CONFIG.MonsterGamepassId == 0 then
		st.ownsPass = RunService:IsStudio()
		return
	end
	local ok, owns = pcall(function()
		return MarketplaceService:UserOwnsGamePassAsync(plr.UserId, CONFIG.MonsterGamepassId)
	end)
	st.ownsPass = ok and owns or false
end

MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(plr, passId, purchased)
	local st = PS[plr]
	if st and purchased and passId == CONFIG.MonsterGamepassId then
		st.ownsPass = true
		st.wantMonster = true
		showMessage(plr, "You own the Corn Monster pass! Monster mode is ON.", 5, Color3.fromRGB(170, 255, 140))
	end
end)

local function awardBadge(plr, badgeId)
	if not badgeId or badgeId == 0 then
		return
	end
	task.spawn(function()
		local ok, has = pcall(function()
			return BadgeService:UserHasBadgeAsync(plr.UserId, badgeId)
		end)
		if ok and not has then
			pcall(function()
				BadgeService:AwardBadge(plr.UserId, badgeId)
			end)
		end
	end)
end

-- ====================================================================
-- FLASHLIGHT TOOL
-- ====================================================================
local function makeFlashlight(plr)
	local tool = make("Tool", { Name = "Flashlight", RequiresHandle = true, CanBeDropped = false, ToolTip = "Click to turn on/off", Grip = C(0, 0, 0.45) })
	-- the handle is invisible; the real flashlight is built around it (front = -Z)
	local handle = part({ Name = "Handle", Size = Vector3.new(0.4, 0.4, 1.6), Transparency = 1, Anchored = false, Massless = true, CFrame = C() }, tool)
	local metal = Color3.fromRGB(38, 40, 44)
	local dark = Color3.fromRGB(22, 22, 24)
	local silver = Color3.fromRGB(170, 172, 178)
	local parts = {}
	local function fp(name, shape, size, cf, color, mat)
		local p = part({ Name = name, Shape = shape, Size = size, CFrame = cf, Color = color, Material = mat or Enum.Material.Metal, Anchored = false, Massless = true, CastShadow = false }, tool)
		parts[#parts + 1] = p
		return p
	end
	local Cyl = Enum.PartType.Cylinder
	local along = A(0, math.rad(90), 0) -- turns a cylinder to point along Z
	fp("TailCap", Cyl, Vector3.new(0.28, 0.46, 0.46), C(0, 0, 0.98) * along, Color3.fromRGB(16, 16, 16), Enum.Material.SmoothPlastic)
	fp("LanyardRing", Cyl, Vector3.new(0.05, 0.3, 0.3), C(0, 0, 1.16) * A(0, 0, 0), silver)
	fp("Body", Cyl, Vector3.new(1.55, 0.42, 0.42), C(0, 0, 0.12) * along, metal)
	for i = 0, 5 do
		fp("Knurl", Cyl, Vector3.new(0.06, 0.45, 0.45), C(0, 0, 0.2 + i * 0.11) * along, dark, Enum.Material.DiamondPlate)
	end
	fp("Stripe", Cyl, Vector3.new(0.08, 0.44, 0.44), C(0, 0, -0.1) * along, Color3.fromRGB(210, 170, 40), Enum.Material.SmoothPlastic)
	fp("SwitchBase", nil, Vector3.new(0.18, 0.1, 0.42), C(0, 0.22, -0.32), dark)
	fp("Switch", nil, Vector3.new(0.12, 0.08, 0.2), C(0, 0.29, -0.32), Color3.fromRGB(150, 30, 30), Enum.Material.SmoothPlastic)
	fp("Clip", nil, Vector3.new(0.04, 0.12, 0.95), C(0.23, 0, 0.3), silver)
	fp("Neck", Cyl, Vector3.new(0.28, 0.52, 0.52), C(0, 0, -0.75) * along, metal)
	fp("Head", Cyl, Vector3.new(0.45, 0.66, 0.66), C(0, 0, -1.08) * along, dark)
	fp("Bezel", Cyl, Vector3.new(0.08, 0.7, 0.7), C(0, 0, -1.33) * along, silver)
	local reflector = fp("Reflector", Cyl, Vector3.new(0.03, 0.56, 0.56), C(0, 0, -1.34) * along, silver, Enum.Material.Metal)
	local bulb = fp("Bulb", Enum.PartType.Ball, Vector3.new(0.14, 0.14, 0.14), C(0, 0, -1.33), Color3.fromRGB(90, 90, 90), Enum.Material.Glass)
	local lens = fp("Lens", Cyl, Vector3.new(0.03, 0.54, 0.54), C(0, 0, -1.37) * along, Color3.fromRGB(200, 210, 220), Enum.Material.Glass)
	lens.Transparency = 0.5
	local beamPart = fp("Beam", nil, Vector3.new(0.1, 0.1, 0.1), C(0, 0, -1.45), Color3.new(1, 1, 1))
	beamPart.Transparency = 1
	for _, p in ipairs(parts) do
		make("WeldConstraint", { Part0 = handle, Part1 = p }, p)
	end
	local spot = make("SpotLight", { Face = Enum.NormalId.Front, Range = 60, Angle = 50, Brightness = 3.4, Color = Color3.fromRGB(255, 240, 210), Shadows = true, Enabled = false }, beamPart)
	local core = make("SpotLight", { Face = Enum.NormalId.Front, Range = 70, Angle = 18, Brightness = 2, Color = Color3.fromRGB(255, 248, 230), Shadows = false, Enabled = false }, beamPart)
	local glow = make("PointLight", { Range = 8, Brightness = 0.6, Color = Color3.fromRGB(255, 235, 200), Enabled = false }, beamPart)
	-- a faint visible light cone in the air
	local a0 = make("Attachment", { Position = Vector3.new(0, 0, 0) }, beamPart)
	local a1 = make("Attachment", { Position = Vector3.new(0, 0, -24) }, beamPart)
	local cone = make("Beam", {
		Attachment0 = a0, Attachment1 = a1, Width0 = 0.5, Width1 = 11, FaceCamera = true, LightEmission = 1, LightInfluence = 0,
		Color = ColorSequence.new(Color3.fromRGB(255, 240, 210)), Transparency = NumberSequence.new(0.9, 1), Segments = 1, Enabled = false,
	}, beamPart)

	local st0 = PS[plr]
	if st0 then
		st0.flashFx = { spot = spot, core = core, spotB = spot.Brightness, coreB = core.Brightness }
	end
	local function setOn(on)
		local st = PS[plr]
		if on and st and st.battery <= 0 then
			showMessage(plr, "The flashlight is dead...", 2, Color3.fromRGB(255, 150, 120))
			on = false
		end
		if st then
			st.flashOn = on
		end
		spot.Enabled, core.Enabled, glow.Enabled, cone.Enabled = on, on, on, on
		reflector.Material = on and Enum.Material.Neon or Enum.Material.Metal
		reflector.Color = on and Color3.fromRGB(255, 245, 220) or silver
		bulb.Material = on and Enum.Material.Neon or Enum.Material.Glass
		bulb.Color = on and Color3.fromRGB(255, 250, 230) or Color3.fromRGB(90, 90, 90)
		playSound(CONFIG.Sounds.Ding, handle, 0.25, 2.6, 20)
	end
	tool.Equipped:Connect(function()
		setOn(true)
	end)
	tool.Unequipped:Connect(function()
		setOn(false)
	end)
	tool.Activated:Connect(function()
		local st = PS[plr]
		setOn(not (st and st.flashOn))
	end)
	tool:SetAttribute("IsFlashlight", true)
	return tool, setOn
end

-- ====================================================================
-- MAZE MATH
-- ====================================================================
local function genMaze(rng)
	local wall = {}
	for x = 1, SIZE do
		wall[x] = {}
		for y = 1, SIZE do
			wall[x][y] = true
		end
	end
	local stack = { { 2, 2 } }
	wall[2][2] = false
	while #stack > 0 do
		local c = stack[#stack]
		local opts = {}
		for _, d in ipairs(DIRS) do
			local nx, ny = c[1] + d[1] * 2, c[2] + d[2] * 2
			if nx >= 2 and nx <= SIZE - 1 and ny >= 2 and ny <= SIZE - 1 and wall[nx][ny] then
				opts[#opts + 1] = { nx, ny, d }
			end
		end
		if #opts == 0 then
			table.remove(stack)
		else
			local o = opts[rng:NextInteger(1, #opts)]
			wall[c[1] + o[3][1]][c[2] + o[3][2]] = false
			wall[o[1]][o[2]] = false
			stack[#stack + 1] = { o[1], o[2] }
		end
	end
	-- a few loops so you are not always trapped in dead ends
	for x = 2, SIZE - 1 do
		for y = 2, SIZE - 1 do
			local between = (x % 2 == 1 and y % 2 == 0) or (x % 2 == 0 and y % 2 == 1)
			if wall[x][y] and between and rng:NextNumber() < 0.1 then
				wall[x][y] = false
			end
		end
	end
	-- the camp clearing
	for x = 2, 6 do
		for y = 2, 6 do
			wall[x][y] = false
		end
	end
	return wall
end

local function inGrid(x, y)
	return x >= 1 and x <= SIZE and y >= 1 and y <= SIZE
end

local function bfs(wall, sx, sy)
	local dist = { [key(sx, sy)] = 0 }
	if not inGrid(sx, sy) or wall[sx][sy] then
		return dist
	end
	local q = { { sx, sy } }
	local head = 1
	while head <= #q do
		local c = q[head]
		head += 1
		local d = dist[key(c[1], c[2])]
		for _, dd in ipairs(DIRS) do
			local nx, ny = c[1] + dd[1], c[2] + dd[2]
			if inGrid(nx, ny) and not wall[nx][ny] and dist[key(nx, ny)] == nil then
				dist[key(nx, ny)] = d + 1
				q[#q + 1] = { nx, ny }
			end
		end
	end
	return dist
end

local function findPath(wall, sx, sy, gx, gy)
	if not inGrid(sx, sy) or not inGrid(gx, gy) or wall[sx][sy] or wall[gx][gy] then
		return nil
	end
	local prev = { [key(sx, sy)] = false }
	local q = { { sx, sy } }
	local head = 1
	while head <= #q do
		local c = q[head]
		head += 1
		if c[1] == gx and c[2] == gy then
			local path = {}
			local cur = c
			while cur do
				table.insert(path, 1, cur)
				cur = prev[key(cur[1], cur[2])] or nil
			end
			return path
		end
		for _, dd in ipairs(DIRS) do
			local nx, ny = c[1] + dd[1], c[2] + dd[2]
			if inGrid(nx, ny) and not wall[nx][ny] and prev[key(nx, ny)] == nil then
				prev[key(nx, ny)] = c
				q[#q + 1] = { nx, ny }
			end
		end
	end
	return nil
end

-- ====================================================================
-- PROPS (shared by the lobby and the corn field)
-- ====================================================================
local Props = {}

local function lp(folder, cf, name, size, offset, color, mat, extra)
	local props = { Name = name, Size = size, CFrame = cf * offset, Color = color, Material = mat or Enum.Material.Wood }
	if extra then
		for k, v in pairs(extra) do
			props[k] = v
		end
	end
	return part(props, folder)
end

function Props.flicker(list, light, amount)
	list[#list + 1] = { light = light, base = light.Brightness, amt = amount or 0.3, seed = math.random() * 100 }
end

function Props.campfire(f, pos, flickers)
	local cf = C(pos)
	for i = 1, 9 do
		local a = i / 9 * math.pi * 2
		lp(f, cf, "Stone", Vector3.new(1.1, 0.7, 0.9), C(math.cos(a) * 2.2, 0.3, math.sin(a) * 2.2) * A(0, a, 0.2), Color3.fromRGB(78, 76, 72), Enum.Material.Slate)
	end
	for i = 1, 4 do
		local a = i / 4 * math.pi
		lp(f, cf, "Log", Vector3.new(3.4, 0.55, 0.55), C(0, 0.5, 0) * A(0, a, 0.35), Color3.fromRGB(70, 46, 28), Enum.Material.Wood, { Shape = Enum.PartType.Cylinder })
	end
	local ember = lp(f, cf, "Embers", Vector3.new(1.6, 0.3, 1.6), C(0, 0.25, 0), Color3.fromRGB(255, 110, 30), Enum.Material.Neon)
	make("Fire", { Size = 5, Heat = 9, Color = Color3.fromRGB(255, 140, 50), SecondaryColor = Color3.fromRGB(255, 60, 20) }, ember)
	local light = make("PointLight", { Color = Color3.fromRGB(255, 150, 70), Range = 30, Brightness = 2.2, Shadows = true }, ember)
	Props.flicker(flickers, light, 0.35)
end

function Props.logSeat(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	lp(f, cf, "LogSeat", Vector3.new(5, 1.3, 1.3), C(0, 0.6, 0), Color3.fromRGB(84, 58, 36), Enum.Material.Wood, { Shape = Enum.PartType.Cylinder, CanCollide = true })
	lp(f, cf, "LogEnd", Vector3.new(0.1, 1.15, 1.15), C(2.52, 0.6, 0), Color3.fromRGB(150, 118, 78), Enum.Material.Wood, { Shape = Enum.PartType.Cylinder })
	lp(f, cf, "LogEnd", Vector3.new(0.1, 1.15, 1.15), C(-2.52, 0.6, 0), Color3.fromRGB(150, 118, 78), Enum.Material.Wood, { Shape = Enum.PartType.Cylinder })
end

function Props.tent(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	local canvas = Color3.fromRGB(122, 108, 74)
	wedge({ Name = "TentL", Size = Vector3.new(7, 4.5, 3.2), CFrame = cf * C(0, 2.25, -1.6), Color = canvas, Material = Enum.Material.Fabric }, f)
	wedge({ Name = "TentR", Size = Vector3.new(7, 4.5, 3.2), CFrame = cf * C(0, 2.25, 1.6) * A(0, math.pi, 0), Color = canvas, Material = Enum.Material.Fabric }, f)
	lp(f, cf, "TentDoor", Vector3.new(0.1, 3, 1.6), C(-3.52, 1.5, 0), Color3.fromRGB(20, 18, 14), Enum.Material.Fabric)
	lp(f, cf, "TentPole", Vector3.new(0.2, 5, 0.2), C(-3.6, 2.4, 0), Color3.fromRGB(70, 50, 30))
	lp(f, cf, "TentPole", Vector3.new(0.2, 5, 0.2), C(3.6, 2.4, 0), Color3.fromRGB(70, 50, 30))
	lp(f, cf, "Sleepbag", Vector3.new(4, 0.4, 1.4), C(4.8, 0.2, 1.4) * A(0, 0.3, 0), Color3.fromRGB(60, 80, 110), Enum.Material.Fabric)
end

function Props.scarecrow(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	local wood = Color3.fromRGB(78, 56, 34)
	lp(f, cf, "Post", Vector3.new(0.5, 9, 0.5), C(0, 4.5, 0), wood)
	lp(f, cf, "Cross", Vector3.new(6, 0.4, 0.4), C(0, 6.6, 0), wood)
	lp(f, cf, "Shirt", Vector3.new(2.2, 2.8, 1.1), C(0, 5.6, 0), Color3.fromRGB(110, 46, 40), Enum.Material.Fabric)
	lp(f, cf, "SleeveL", Vector3.new(2.4, 0.8, 0.8), C(-2, 6.6, 0), Color3.fromRGB(100, 42, 36), Enum.Material.Fabric)
	lp(f, cf, "SleeveR", Vector3.new(2.4, 0.8, 0.8), C(2, 6.6, 0), Color3.fromRGB(100, 42, 36), Enum.Material.Fabric)
	lp(f, cf, "Pants", Vector3.new(2, 1.6, 1), C(0, 3.6, 0), Color3.fromRGB(56, 60, 80), Enum.Material.Fabric)
	lp(f, cf, "Sack", Vector3.new(1.7, 1.7, 1.7), C(0, 8, 0), Color3.fromRGB(176, 150, 104), Enum.Material.Fabric, { Shape = Enum.PartType.Ball })
	lp(f, cf, "EyeL", Vector3.new(0.3, 0.3, 0.1), C(-0.35, 8.2, -0.82), Color3.fromRGB(10, 10, 10), Enum.Material.Fabric)
	lp(f, cf, "EyeR", Vector3.new(0.3, 0.3, 0.1), C(0.35, 8.2, -0.82), Color3.fromRGB(10, 10, 10), Enum.Material.Fabric)
	lp(f, cf, "Stitch", Vector3.new(0.9, 0.08, 0.1), C(0, 7.6, -0.8), Color3.fromRGB(30, 20, 14), Enum.Material.Fabric)
	lp(f, cf, "Brim", Vector3.new(0.12, 3, 3), C(0, 8.75, 0) * A(0, 0, math.rad(90)), Color3.fromRGB(70, 56, 34), Enum.Material.Fabric, { Shape = Enum.PartType.Cylinder })
	lp(f, cf, "HatTop", Vector3.new(1.1, 1.5, 1.5), C(0, 9.3, 0) * A(0, 0, math.rad(90)), Color3.fromRGB(64, 50, 30), Enum.Material.Fabric, { Shape = Enum.PartType.Cylinder })
	for i = 1, 6 do
		local sx = (i <= 3) and -1 or 1
		lp(f, cf, "Straw", Vector3.new(0.6, 0.08, 0.08), C(sx * (3.2 + (i % 3) * 0.15), 6.6 + (i % 3 - 1) * 0.15, 0) * A(0, 0, (i % 3 - 1) * 0.4), Color3.fromRGB(210, 180, 90), Enum.Material.Fabric)
	end
end

function Props.hay(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	lp(f, cf, "Hay", Vector3.new(4, 2.2, 2.6), C(0, 1.1, 0), Color3.fromRGB(196, 168, 84), Enum.Material.Fabric, { CanCollide = true })
	lp(f, cf, "Twine", Vector3.new(0.12, 2.28, 2.68), C(-1, 1.1, 0), Color3.fromRGB(120, 92, 50), Enum.Material.Fabric)
	lp(f, cf, "Twine", Vector3.new(0.12, 2.28, 2.68), C(1, 1.1, 0), Color3.fromRGB(120, 92, 50), Enum.Material.Fabric)
end

function Props.pumpkin(f, pos, yaw, s, carved, flickers)
	local cf = C(pos) * A(0, yaw, 0)
	lp(f, cf, "Pumpkin", Vector3.new(s, s, s), C(0, s * 0.42, 0), Color3.fromRGB(214, 112, 30), Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Ball })
	for i = 1, 4 do
		lp(f, cf, "Rib", Vector3.new(s * 0.08, s * 0.86, s * 1.02), C(0, s * 0.42, 0) * A(0, i * math.pi / 4, 0), Color3.fromRGB(184, 90, 24), Enum.Material.SmoothPlastic)
	end
	lp(f, cf, "Stem", Vector3.new(s * 0.14, s * 0.32, s * 0.14), C(0, s * 0.95, 0) * A(0, 0, 0.2), Color3.fromRGB(70, 90, 30), Enum.Material.Wood)
	if carved then
		local glow = Color3.fromRGB(255, 200, 70)
		lp(f, cf, "EyeL", Vector3.new(s * 0.18, s * 0.16, 0.1), C(-s * 0.18, s * 0.55, -s * 0.48), glow, Enum.Material.Neon)
		lp(f, cf, "EyeR", Vector3.new(s * 0.18, s * 0.16, 0.1), C(s * 0.18, s * 0.55, -s * 0.48), glow, Enum.Material.Neon)
		local mouth = lp(f, cf, "Mouth", Vector3.new(s * 0.5, s * 0.1, 0.1), C(0, s * 0.3, -s * 0.47), glow, Enum.Material.Neon)
		local l = make("PointLight", { Color = Color3.fromRGB(255, 150, 50), Range = 11, Brightness = 1.2 }, mouth)
		if flickers then
			Props.flicker(flickers, l, 0.4)
		end
	end
end

function Props.lantern(f, pos, yaw, flickers)
	local cf = C(pos) * A(0, yaw, 0)
	local wood = Color3.fromRGB(62, 44, 28)
	lp(f, cf, "Post", Vector3.new(0.45, 8, 0.45), C(0, 4, 0), wood)
	lp(f, cf, "Arm", Vector3.new(0.3, 0.3, 1.6), C(0, 7.7, -0.7), wood)
	lp(f, cf, "Cap", Vector3.new(0.9, 0.2, 0.9), C(0, 7.3, -1.4), Color3.fromRGB(30, 30, 30), Enum.Material.Metal)
	local glass = lp(f, cf, "Glass", Vector3.new(0.7, 0.9, 0.7), C(0, 6.75, -1.4), Color3.fromRGB(255, 200, 110), Enum.Material.Neon)
	lp(f, cf, "Base", Vector3.new(0.8, 0.15, 0.8), C(0, 6.25, -1.4), Color3.fromRGB(30, 30, 30), Enum.Material.Metal)
	local light = make("PointLight", { Color = Color3.fromRGB(255, 190, 110), Range = 24, Brightness = 1.4, Shadows = true }, glass)
	if flickers then
		Props.flicker(flickers, light, 0.25)
	end
end

function Props.crates(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	local function crate(off, s)
		lp(f, cf, "Crate", Vector3.new(s, s, s), off, Color3.fromRGB(122, 88, 52), Enum.Material.WoodPlanks, { CanCollide = true })
		lp(f, cf, "Slat", Vector3.new(s + 0.06, 0.25, s + 0.06), off * C(0, s * 0.3, 0), Color3.fromRGB(86, 60, 34), Enum.Material.Wood)
		lp(f, cf, "Slat", Vector3.new(s + 0.06, 0.25, s + 0.06), off * C(0, -s * 0.3, 0), Color3.fromRGB(86, 60, 34), Enum.Material.Wood)
	end
	crate(C(0, 1.1, 0), 2.2)
	crate(C(2.3, 1, 0.3) * A(0, 0.3, 0), 2)
	crate(C(0.9, 3.1, 0.1) * A(0, -0.2, 0), 1.8)
end

function Props.barrel(f, pos, burning, flickers)
	local cf = C(pos)
	lp(f, cf, "Barrel", Vector3.new(3, 2.2, 2.2), C(0, 1.5, 0) * A(0, 0, math.rad(90)), Color3.fromRGB(96, 70, 44), Enum.Material.WoodPlanks, { Shape = Enum.PartType.Cylinder, CanCollide = true })
	for _, y in ipairs({ 0.5, 2.5 }) do
		lp(f, cf, "Band", Vector3.new(0.2, 2.3, 2.3), C(0, y, 0) * A(0, 0, math.rad(90)), Color3.fromRGB(46, 46, 46), Enum.Material.Metal, { Shape = Enum.PartType.Cylinder })
	end
	if burning then
		local top = lp(f, cf, "Coals", Vector3.new(0.1, 1.9, 1.9), C(0, 2.95, 0) * A(0, 0, math.rad(90)), Color3.fromRGB(255, 100, 30), Enum.Material.Neon, { Shape = Enum.PartType.Cylinder })
		make("Fire", { Size = 3, Heat = 7, Color = Color3.fromRGB(255, 130, 50), SecondaryColor = Color3.fromRGB(255, 50, 20) }, top)
		local l = make("PointLight", { Color = Color3.fromRGB(255, 140, 60), Range = 20, Brightness = 1.6 }, top)
		if flickers then
			Props.flicker(flickers, l, 0.4)
		end
	end
end

function Props.wheelbarrow(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	local metal = Color3.fromRGB(90, 60, 46)
	lp(f, cf, "Tray", Vector3.new(2.4, 0.2, 3), C(0, 1.6, 0), metal, Enum.Material.Metal)
	lp(f, cf, "SideL", Vector3.new(0.2, 0.9, 3), C(-1.2, 2, 0) * A(0, 0, 0.2), metal, Enum.Material.Metal)
	lp(f, cf, "SideR", Vector3.new(0.2, 0.9, 3), C(1.2, 2, 0) * A(0, 0, -0.2), metal, Enum.Material.Metal)
	lp(f, cf, "Front", Vector3.new(2.4, 0.9, 0.2), C(0, 2, -1.5) * A(-0.3, 0, 0), metal, Enum.Material.Metal)
	lp(f, cf, "Wheel", Vector3.new(0.4, 1.4, 1.4), C(0, 0.7, -1.6), Color3.fromRGB(24, 24, 24), Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Cylinder })
	lp(f, cf, "HandleL", Vector3.new(0.2, 0.2, 3.4), C(-0.9, 1.4, 2.4) * A(0.25, 0, 0), Color3.fromRGB(80, 56, 34))
	lp(f, cf, "HandleR", Vector3.new(0.2, 0.2, 3.4), C(0.9, 1.4, 2.4) * A(0.25, 0, 0), Color3.fromRGB(80, 56, 34))
end

function Props.fence(f, pos, yaw, n)
	local cf = C(pos) * A(0, yaw, 0)
	local wood = Color3.fromRGB(86, 66, 44)
	for i = 0, n do
		lp(f, cf, "FencePost", Vector3.new(0.4, 3.4, 0.4), C(i * 3, 1.7, 0) * A(0, 0, (i % 3 - 1) * 0.06), wood)
	end
	for _, y in ipairs({ 1.2, 2.6 }) do
		lp(f, cf, "FenceRail", Vector3.new(n * 3, 0.3, 0.2), C(n * 1.5, y, 0), wood)
	end
end

function Props.cross(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	local wood = Color3.fromRGB(70, 52, 34)
	lp(f, cf, "Grave", Vector3.new(0.35, 3.4, 0.35), C(0, 1.7, 0) * A(0, 0, 0.08), wood)
	lp(f, cf, "GraveBar", Vector3.new(1.8, 0.3, 0.3), C(0, 2.6, 0) * A(0, 0, 0.08), wood)
	lp(f, cf, "Mound", Vector3.new(2, 0.5, 3.4), C(0, 0.2, 1.6), Color3.fromRGB(58, 44, 30), Enum.Material.Ground)
end

function Props.well(f, pos)
	local cf = C(pos)
	for i = 1, 12 do
		local a = i / 12 * math.pi * 2
		lp(f, cf, "WellStone", Vector3.new(1.4, 2.2, 0.8), C(math.cos(a) * 2.2, 1.1, math.sin(a) * 2.2) * A(0, -a + math.pi / 2, 0), Color3.fromRGB(96, 94, 88), Enum.Material.Cobblestone, { CanCollide = true })
	end
	lp(f, cf, "WellWater", Vector3.new(0.2, 3.6, 3.6), C(0, 0.4, 0) * A(0, 0, math.rad(90)), Color3.fromRGB(10, 14, 12), Enum.Material.Glass, { Shape = Enum.PartType.Cylinder })
	lp(f, cf, "WellPost", Vector3.new(0.4, 5, 0.4), C(-2.2, 2.5, 0), Color3.fromRGB(70, 50, 30))
	lp(f, cf, "WellPost", Vector3.new(0.4, 5, 0.4), C(2.2, 2.5, 0), Color3.fromRGB(70, 50, 30))
	wedge({ Name = "WellRoof", Size = Vector3.new(5.4, 1.4, 1.8), CFrame = cf * C(0, 5.6, -0.9), Color = Color3.fromRGB(60, 40, 26), Material = Enum.Material.WoodPlanks }, f)
	wedge({ Name = "WellRoof", Size = Vector3.new(5.4, 1.4, 1.8), CFrame = cf * C(0, 5.6, 0.9) * A(0, math.pi, 0), Color = Color3.fromRGB(60, 40, 26), Material = Enum.Material.WoodPlanks }, f)
	lp(f, cf, "Bucket", Vector3.new(0.8, 0.8, 0.8), C(0, 3.4, 0) * A(0, 0, math.rad(90)), Color3.fromRGB(90, 70, 50), Enum.Material.WoodPlanks, { Shape = Enum.PartType.Cylinder })
	lp(f, cf, "Rope", Vector3.new(0.06, 1.4, 0.06), C(0, 4.5, 0), Color3.fromRGB(150, 130, 90), Enum.Material.Fabric)
end

function Props.bones(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	local bone = Color3.fromRGB(210, 200, 170)
	lp(f, cf, "Skull", Vector3.new(0.9, 0.9, 0.9), C(0, 0.45, 0), bone, Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Ball })
	lp(f, cf, "Socket", Vector3.new(0.2, 0.2, 0.1), C(-0.18, 0.55, -0.42), Color3.new(0, 0, 0))
	lp(f, cf, "Socket", Vector3.new(0.2, 0.2, 0.1), C(0.18, 0.55, -0.42), Color3.new(0, 0, 0))
	for i = 1, 4 do
		lp(f, cf, "Bone", Vector3.new(0.2, 0.2, 1.6), C(0.9 + i * 0.3, 0.1, (i - 2) * 0.5) * A(0, i * 0.7, 0), bone, Enum.Material.SmoothPlastic)
	end
end

function Props.deadTree(f, pos, h, rng)
	local bark = Color3.fromRGB(46, 38, 30)
	local trunk = part({ Name = "Trunk", Size = Vector3.new(1.4, h, 1.4), CFrame = C(pos + Vector3.new(0, h / 2, 0)) * A(0, rng:NextNumber() * 6, (rng:NextNumber() - 0.5) * 0.12), Color = bark, Material = Enum.Material.Wood }, f)
	trunk.CanCollide = true
	for i = 1, 5 do
		local y = h * (0.45 + i * 0.1)
		local yaw = rng:NextNumber() * math.pi * 2
		local len = 3 + rng:NextNumber() * 4
		local base = C(pos + Vector3.new(0, y, 0)) * A(0, yaw, 0)
		local br = part({ Name = "Branch", Size = Vector3.new(0.5, 0.5, len), CFrame = base * A(0.6, 0, 0) * C(0, 0, -len / 2), Color = bark, Material = Enum.Material.Wood }, f)
		part({ Name = "Twig", Size = Vector3.new(0.25, 0.25, len * 0.6), CFrame = br.CFrame * C(0, 0, -len / 2) * A(0.5, 0.6, 0) * C(0, 0, -len * 0.3), Color = bark, Material = Enum.Material.Wood }, f)
	end
end

function Props.barn(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	local red = Color3.fromRGB(110, 34, 28)
	local trim = Color3.fromRGB(200, 190, 170)
	lp(f, cf, "BarnBody", Vector3.new(30, 16, 22), C(0, 8, 0), red, Enum.Material.WoodPlanks, { CanCollide = true })
	wedge({ Name = "BarnRoof", Size = Vector3.new(31, 8, 11.6), CFrame = cf * C(0, 20, -5.8), Color = Color3.fromRGB(56, 50, 48), Material = Enum.Material.CorrodedMetal }, f)
	wedge({ Name = "BarnRoof", Size = Vector3.new(31, 8, 11.6), CFrame = cf * C(0, 20, 5.8) * A(0, math.pi, 0), Color = Color3.fromRGB(56, 50, 48), Material = Enum.Material.CorrodedMetal }, f)
	lp(f, cf, "BarnDoor", Vector3.new(0.4, 11, 9), C(-15.1, 5.5, 0), Color3.fromRGB(90, 28, 22), Enum.Material.WoodPlanks)
	lp(f, cf, "DoorX", Vector3.new(0.5, 13.8, 0.6), C(-15.3, 5.5, 0) * A(math.atan2(9, 11), 0, 0), trim, Enum.Material.Wood)
	lp(f, cf, "DoorX", Vector3.new(0.5, 13.8, 0.6), C(-15.3, 5.5, 0) * A(-math.atan2(9, 11), 0, 0), trim, Enum.Material.Wood)
	lp(f, cf, "Loft", Vector3.new(0.4, 3.4, 3.4), C(-15.1, 14, 0), Color3.fromRGB(10, 8, 6), Enum.Material.WoodPlanks)
	local loftLight = lp(f, cf, "LoftGlow", Vector3.new(0.2, 1, 1), C(-15.05, 14, 0), Color3.fromRGB(255, 170, 80), Enum.Material.Neon, { Transparency = 0.4 })
	make("PointLight", { Color = Color3.fromRGB(255, 160, 80), Range = 14, Brightness = 0.8 }, loftLight)
end

function Props.signpost(f, pos, yaw, text)
	local cf = C(pos) * A(0, yaw, 0)
	lp(f, cf, "SignPost", Vector3.new(0.4, 6, 0.4), C(0, 3, 0), Color3.fromRGB(70, 50, 30))
	local board = lp(f, cf, "SignBoard", Vector3.new(4.6, 2.8, 0.25), C(0, 5, -0.3), Color3.fromRGB(110, 80, 50), Enum.Material.WoodPlanks)
	surfaceText(board, Enum.NormalId.Front, text, Color3.fromRGB(30, 20, 12))
end

function Props.shape(name, cf, s, color, depth, folder)
	if name == "Circle" then
		part({ Name = "Circle", Shape = Enum.PartType.Cylinder, Size = Vector3.new(depth, s, s), CFrame = cf, Color = color, Material = Enum.Material.Neon }, folder)
	elseif name == "Square" then
		part({ Name = "Square", Size = Vector3.new(depth, s * 0.85, s * 0.85), CFrame = cf, Color = color, Material = Enum.Material.Neon }, folder)
	else
		wedge({ Name = "Triangle", Size = Vector3.new(depth, s * 0.9, s / 2), CFrame = cf * C(0, 0, -s / 4), Color = color, Material = Enum.Material.Neon }, folder)
		wedge({ Name = "Triangle", Size = Vector3.new(depth, s * 0.9, s / 2), CFrame = cf * C(0, 0, s / 4) * A(0, math.pi, 0), Color = color, Material = Enum.Material.Neon }, folder)
	end
end

function Props.pottedCorn(f, pos)
	local cf = C(pos)
	lp(f, cf, "Pot", Vector3.new(2.2, 2.4, 2.4), C(0, 1.1, 0) * A(0, 0, math.rad(90)), Color3.fromRGB(120, 60, 40), Enum.Material.Slate, { Shape = Enum.PartType.Cylinder })
	lp(f, cf, "Soil", Vector3.new(0.1, 2.1, 2.1), C(0, 2.2, 0) * A(0, 0, math.rad(90)), Color3.fromRGB(50, 36, 24), Enum.Material.Ground, { Shape = Enum.PartType.Cylinder })
	for i = 1, 3 do
		local a = i * 2.1
		local base = cf * C(math.cos(a) * 0.4, 2.2, math.sin(a) * 0.4)
		part({ Name = "Stalk", Size = Vector3.new(0.18, 6, 0.18), CFrame = base * C(0, 3, 0), Color = Color3.fromRGB(100, 120, 50), Material = Enum.Material.Wood }, f)
		for j = 1, 3 do
			part({ Name = "Leaf", Size = Vector3.new(2.2, 0.05, 0.45), CFrame = base * C(0, 1 + j * 1.3, 0) * A(0, a + j * 2, 0) * C(1, 0, 0) * A(0, 0, -0.5), Color = Color3.fromRGB(70, 100, 40), Material = Enum.Material.Grass }, f)
		end
	end
end

-- ====================================================================
-- THE CORN MONSTER (body + animation)
-- ====================================================================
local KERN = {
	{ -0.35, 0.7 }, { 0.0, 0.95 }, { 0.3, 0.6 }, { -0.2, 1.5 }, { 0.25, 1.35 },
	{ -0.4, 2.1 }, { 0.05, 2.3 }, { 0.35, 2.0 }, { -0.15, 2.9 }, { 0.3, 2.75 },
}
local SEGMENTS = { "Pelvis", "Torso", "Head", "Jaw", "UpperArmL", "ForeArmL", "UpperArmR", "ForeArmR", "ThighL", "ShinL", "ThighR", "ShinR" }

local Monster = {}
Monster.__index = Monster

function Monster.new(parent, SC)
	local m = setmetatable({}, Monster)
	m.scale = SC
	m.model = make("Model", { Name = "CornMonster" }, parent)
	m.seg, m.cfs, m.decor = {}, {}, {}
	m.pos, m.yaw, m.phase, m.crawlAmt, m.lastS = Vector3.new(), 0, 0, 0, 0
	m.twitch = 1

	local husk = Color3.fromRGB(128, 112, 60)
	local huskDark = Color3.fromRGB(92, 80, 42)
	local dark = Color3.fromRGB(32, 36, 24)
	local bone = Color3.fromRGB(196, 182, 138)
	local leaf = Color3.fromRGB(66, 90, 36)
	local kernel = Color3.fromRGB(222, 184, 70)
	local claw = Color3.fromRGB(214, 208, 182)
	local black = Color3.fromRGB(6, 6, 6)
	local eye = Color3.fromRGB(255, 220, 70)
	local Wood, Fabric, Grass, Smooth, Neon = Enum.Material.Wood, Enum.Material.Fabric, Enum.Material.Grass, Enum.Material.SmoothPlastic, Enum.Material.Neon

	local function O(x, y, z)
		return C(x * SC, y * SC, z * SC)
	end
	local function seg(name, w, h, d, color, mat)
		m.seg[name] = part({ Name = name, Size = Vector3.new(w * SC, h * SC, d * SC), Color = color, Material = mat or Wood }, m.model)
	end
	local function dec(segName, name, w, h, d, color, mat, cf)
		m.decor[#m.decor + 1] = { seg = segName, name = name, size = Vector3.new(w * SC, h * SC, d * SC), color = color, mat = mat or Wood, cf = cf }
	end

	seg("Pelvis", 1.0, 0.8, 0.6, dark)
	seg("Torso", 1.25, 3.6, 0.7, husk, Fabric)
	seg("Head", 0.95, 1.9, 0.95, husk)
	seg("Jaw", 0.7, 0.45, 0.75, bone)
	for _, s in ipairs({ "L", "R" }) do
		seg("UpperArm" .. s, 0.28, 3.3, 0.28, husk)
		seg("ForeArm" .. s, 0.24, 3.5, 0.24, husk)
		seg("Thigh" .. s, 0.4, 3.3, 0.4, dark)
		seg("Shin" .. s, 0.34, 3.4, 0.34, dark)
	end

	-- chest: ribs, spine, kernels, husk cape, shoulder pads
	for i = 1, 4 do
		local y = (0.8 + i * 0.62) - 1.8
		dec("Torso", "RibL" .. i, 0.7, 0.1, 0.8, bone, Wood, O(-0.42, y, -0.05) * A(0, 0, 0.12))
		dec("Torso", "RibR" .. i, 0.7, 0.1, 0.8, bone, Wood, O(0.42, y, -0.05) * A(0, 0, -0.12))
	end
	for i = 1, 6 do
		dec("Torso", "Spine" .. i, 0.16, 0.3, 0.2, bone, Wood, O(0, 0.35 + i * 0.52 - 1.8, 0.38) * A(0.25, 0, 0))
	end
	for i, kp in ipairs(KERN) do
		dec("Torso", "Kern" .. i, 0.2, 0.2, 0.08, kernel, Smooth, O(kp[1], kp[2] - 1.8, -0.37))
	end
	for i = 1, 4 do
		dec("Torso", "Cape" .. i, 0.5, 2.8, 0.1, leaf, Grass, O((i - 2.5) * 0.55, 1.6, 0.45) * A(-0.3 - (i % 2) * 0.1, 0, 0) * O(0, -1.4, 0))
	end
	dec("Torso", "PadL", 0.9, 0.5, 0.9, huskDark, Fabric, O(-0.78, 1.6, 0) * A(0, 0, 0.2))
	dec("Torso", "PadR", 0.9, 0.5, 0.9, huskDark, Fabric, O(0.78, 1.6, 0) * A(0, 0, -0.2))
	for i = 1, 2 do
		dec("Torso", "SpikeL" .. i, 0.14, 1.0, 0.14, bone, Wood, O(-0.95, 1.7 + i * 0.15, 0) * A(0, 0, 0.5 + 0.4 * i) * O(0, 0.5, 0))
		dec("Torso", "SpikeR" .. i, 0.14, 1.0, 0.14, bone, Wood, O(0.95, 1.7 + i * 0.15, 0) * A(0, 0, -(0.5 + 0.4 * i)) * O(0, 0.5, 0))
	end
	for i = 1, 3 do
		dec("Torso", "BackCob" .. i, 0.35, 1.6, 0.35, kernel, Smooth, O((i - 2) * 0.42, 1.3, 0.5) * A(0.55, 0, (i - 2) * 0.2) * O(0, 0.7, 0))
	end
	dec("Torso", "Neck", 0.32, 1.0, 0.32, bone, Wood, O(0, 2.3, -0.1))
	dec("Torso", "Collar", 1.0, 0.3, 1.0, leaf, Grass, O(0, 1.95, -0.05))
	-- leaf skirt
	for i = 1, 8 do
		local ang = (i / 8) * math.pi * 2
		dec("Pelvis", "Skirt" .. i, 0.45, 2.2, 0.1, leaf, Grass, A(0, ang, 0) * O(0, -0.4, 0.5) * A(-0.22, 0, 0) * O(0, -1.1, 0))
	end
	-- face
	dec("Head", "Face", 0.78, 1.2, 0.06, kernel, Smooth, O(0, 0.05, -0.49))
	dec("Head", "BrowL", 0.36, 0.1, 0.1, dark, Wood, O(-0.22, 0.55, -0.52) * A(0, 0, 0.35))
	dec("Head", "BrowR", 0.36, 0.1, 0.1, dark, Wood, O(0.22, 0.55, -0.52) * A(0, 0, -0.35))
	dec("Head", "SocketL", 0.34, 0.3, 0.08, black, Wood, O(-0.22, 0.3, -0.5))
	dec("Head", "SocketR", 0.34, 0.3, 0.08, black, Wood, O(0.22, 0.3, -0.5))
	dec("Head", "EyeL", 0.2, 0.1, 0.06, eye, Neon, O(-0.22, 0.3, -0.54))
	dec("Head", "EyeR", 0.2, 0.1, 0.06, eye, Neon, O(0.22, 0.3, -0.54))
	dec("Head", "Nose", 0.14, 0.3, 0.1, dark, Wood, O(0, 0, -0.53))
	dec("Head", "Mouth", 0.5, 0.12, 0.05, black, Wood, O(0, -0.4, -0.5))
	for i = 1, 6 do
		dec("Head", "TeethU" .. i, 0.08, 0.22, 0.06, bone, Wood, O((i - 3.5) * 0.12, -0.48, -0.5))
	end
	dec("Head", "EarL", 0.1, 0.7, 0.35, leaf, Grass, O(-0.52, -0.05, 0.1) * A(0, 0.5, 0))
	dec("Head", "EarR", 0.1, 0.7, 0.35, leaf, Grass, O(0.52, -0.05, 0.1) * A(0, -0.5, 0))
	dec("Head", "HornL", 0.12, 1.5, 0.12, bone, Wood, O(-0.3, 0.8, 0) * A(0, 0, 0.35) * O(0, 0.7, 0))
	dec("Head", "HornR", 0.12, 1.5, 0.12, bone, Wood, O(0.3, 0.8, 0) * A(0, 0, -0.35) * O(0, 0.7, 0))
	for i = 1, 8 do
		local ang = (i / 8) * math.pi * 2
		dec("Head", "Hair" .. i, 0.12, 2.2, 0.5, leaf, Grass, A(0, ang, 0) * O(0, 0.75, 0.35) * A(0.5, 0, 0) * O(0, 0.9, 0))
	end
	for i = 1, 5 do
		dec("Jaw", "TeethL" .. i, 0.08, 0.2, 0.06, bone, Wood, O((i - 3) * 0.13, 0.26, -0.3))
	end
	-- arms, hands, legs, feet
	for _, s in ipairs({ "L", "R" }) do
		dec("ForeArm" .. s, "ElbowSpike" .. s, 0.1, 0.8, 0.1, bone, Wood, O(0, 1.75, 0.2) * A(0.9, 0, 0) * O(0, 0.4, 0))
		for i = 1, 2 do
			dec("ForeArm" .. s, "ArmHusk" .. s .. i, 0.3, 1.2, 0.05, leaf, Grass, O((i - 1.5) * 0.3, 1.25 - i * 0.4, 0.15))
		end
		dec("ForeArm" .. s, "Wrist" .. s, 0.32, 0.3, 0.32, dark, Wood, O(0, -1.65, 0))
		for i = 1, 3 do
			local fcf = O(0, -1.75, 0) * O((i - 2) * 0.13, 0, 0) * A(0.35 + (i - 2) * 0.12, 0, 0)
			dec("ForeArm" .. s, "Finger" .. s .. i, 0.07, 1.2, 0.07, bone, Wood, fcf * O(0, -0.6, 0))
			dec("ForeArm" .. s, "Claw" .. s .. i, 0.05, 0.55, 0.05, claw, Smooth, fcf * O(0, -1.2, 0) * A(0.28, 0, 0) * O(0, -0.27, 0))
		end
		dec("Shin" .. s, "Foot" .. s, 0.45, 0.3, 1.1, dark, Wood, O(0, -1.8, -0.3))
		dec("Shin" .. s, "KneeSpike" .. s, 0.12, 0.7, 0.12, bone, Wood, O(0, 1.7, -0.2) * A(-0.9, 0, 0) * O(0, 0.35, 0))
		for i = 1, 3 do
			dec("Shin" .. s, "Toe" .. s .. i, 0.12, 0.12, 0.5, claw, Smooth, O((i - 2) * 0.15, -1.8, -0.95))
		end
	end

	-- sounds live in the pelvis, so they move with him
	local pelvis = m.seg.Pelvis
	m.stepA = newSound(CONFIG.Sounds.Footstep, pelvis, 2.2, 0.5, 110)
	m.stepB = newSound(CONFIG.Sounds.Footstep, pelvis, 2.2, 0.46, 110)
	m.growlSound = newSound(CONFIG.Sounds.Growl, pelvis, 3.5, CONFIG.GrowlPitch, 170)
	m.rustleSound = newSound(CONFIG.Sounds.Rustle, pelvis, 2, 0.32, 80)
	return m
end

-- sharp random spasms (twitching arms, legs and head)
local function jerk(now, seed, speed)
	local n = math.noise(now * speed, seed, 0.37)
	if math.abs(n) > 0.28 then
		return n * 2.4
	end
	return n * 0.35
end

-- works out where every body segment goes this frame
-- act (optional): { kind = "emerge"|"rise"|"sink"|"grab", ... }
function Monster:pose(rootCF, now, k, chasing, lit, act)
	local SC = self.scale
	local tw = self.twitch or 1
	local c = self.crawlAmt
	local phase = self.phase
	local out = self.cfs
	local bob = math.abs(math.sin(phase)) * 0.35 * SC * k * (1 - c * 0.6)
	local base = rootCF * C(0, lerp(7.0 * SC, 3.9 * SC, c) + bob, 0)

	local lean = -(0.12 + 0.28 * k) * (chasing and 1 or 0.4)
	if lit then
		lean = 0.3
	end
	lean = lerp(lean, -1.2, c)
	local twitchY = math.noise(now * 1.7, 1.3) * 0.5 + jerk(now, 11.1, 4.5) * 0.3 * tw
	local twitchZ = math.noise(now * 1.1, 7.7) * 0.35 + jerk(now, 12.7, 5.2) * 0.3 * tw
	local spasm = jerk(now, 8.8, 3.1) * 0.07 * tw
	local headTilt = 0.25 + c * 1.0
	if lit then
		headTilt = -0.4
	end
	local jawOpen = 0.12 + math.sin(now * 1.3) * 0.04
	if chasing then
		jawOpen = 0.5 + math.sin(now * 9) * 0.1
	end

	local swing = math.sin(phase) * 0.7 * k
	local reach = chasing and 0.65 or 0.12
	local bend = chasing and 0.55 or 0.2
	local aL, aR = -swing + reach, swing + reach
	if lit then
		aL, aR, bend = 2.2, 2.2, 1.4
	end
	if c > 0 then
		local cs = math.sin(phase) * 0.55
		aL = lerp(aL, -lean + 0.1 - cs, c)
		aR = lerp(aR, -lean + 0.1 + cs, c)
		bend = lerp(bend, 0.35, c)
	end

	if act then
		if act.kind == "emerge" then -- pulling himself out of the corn wall, arms first
			local a = act.a or 0
			lean = lerp(-0.7, -0.25, a)
			aL = lerp(1.9, 1.0, a) + math.sin(now * 16) * 0.15
			aR = lerp(1.9, 1.0, a) + math.sin(now * 16 + 1.3) * 0.15
			bend = 0.3
			headTilt = lerp(0.8, 0.2, a)
			jawOpen = 0.8 + math.sin(now * 20) * 0.1
		elseif act.kind == "rise" then -- clawing up out of the ground
			local a = act.a or 0
			lean = lerp(-0.35, -0.15, a)
			aL = lerp(2.9, 1.0, a) + math.sin(now * 14) * 0.3
			aR = lerp(2.9, 1.0, a) + math.sin(now * 14 + 1.7) * 0.3
			bend = 0.6
			headTilt = lerp(-0.5, 0.2, a)
			jawOpen = 0.85
		elseif act.kind == "sink" then -- flailing as he sinks away from the light
			lean = 0.25
			aL = 2.4 + math.sin(now * 22) * 0.45
			aR = 2.4 + math.sin(now * 22 + 2) * 0.45
			bend = 1.1
			headTilt = -0.5
			jawOpen = 1.0
		elseif act.kind == "grab" then -- picks you up... and throws you
			local r = act.reach or 0
			lean = 0.05
			aL = lerp(0.6, 1.5, r)
			aR = aL
			bend = lerp(0.5, 0.15, r)
			headTilt = -0.25
			jawOpen = lerp(0.5, 0.95, r)
			if act.hold then
				jawOpen = 1.0 + math.sin(now * 30) * 0.08
				twitchY += math.sin(now * 25) * 0.15
			end
			if act.throw then
				aL = lerp(1.5, 3.0, act.throw)
				aR = aL
				lean = lerp(0.05, 0.35, act.throw)
				bend = 0.1
			end
		end
	end

	-- twitching limbs
	local bendL = bend + math.abs(jerk(now, 3.7, 7)) * 0.45 * tw
	local bendR = bend + math.abs(jerk(now, 4.4, 7.4)) * 0.45 * tw
	aL += jerk(now, 1.3, 6) * 0.4 * tw
	aR += jerk(now, 2.9, 6.6) * 0.4 * tw

	local tb = base * A(lean, math.sin(phase) * 0.12 * k, math.sin(phase) * 0.05 + spasm) * C(0, 0.4 * SC, 0)
	out.Pelvis = base
	out.Torso = tb * C(0, 1.8 * SC, 0)
	local hp = tb * C(0, 4.6 * SC, -0.25 * SC) * A(headTilt, twitchY, twitchZ)
	out.Head = hp * C(0, 0.95 * SC, 0)
	out.Jaw = hp * C(0, 0.1 * SC, -0.1 * SC) * A(jawOpen, 0, 0) * C(0, -0.2 * SC, 0)

	local function chain(upperName, lowerName, baseCF, a1, a2, l1, l2)
		local upperCF = baseCF * A(a1, 0, 0)
		out[upperName] = upperCF * C(0, -l1 / 2, 0)
		local elbowCF = upperCF * C(0, -l1, 0) * A(a2, 0, 0)
		out[lowerName] = elbowCF * C(0, -l2 / 2, 0)
	end
	-- the arms flare out a little, which looks wrong in a good way
	chain("UpperArmL", "ForeArmL", tb * C(-0.75 * SC, 3.3 * SC, 0) * A(0, 0, -0.12 - math.abs(jerk(now, 6.6, 5)) * 0.15 * tw), aL, bendL, 3.3 * SC, 3.5 * SC)
	chain("UpperArmR", "ForeArmR", tb * C(0.75 * SC, 3.3 * SC, 0) * A(0, 0, 0.12 + math.abs(jerk(now, 7.7, 5.3)) * 0.15 * tw), aR, bendR, 3.3 * SC, 3.5 * SC)

	local legR = math.sin(phase) * 0.8 * k
	local kneeR = -math.max(0, math.sin(phase - 1.0)) * 1.1 * k
	local kneeL = -math.max(0, math.sin(phase + math.pi - 1.0)) * 1.1 * k
	local thL, thR, knL, knR = -legR, legR, kneeL, kneeR
	if c > 0 then
		local cs = math.sin(phase) * 0.5 * math.max(k, 0.3)
		thL = lerp(thL, 1.1 - cs, c)
		thR = lerp(thR, 1.1 + cs, c)
		knL = lerp(knL, -1.7, c)
		knR = lerp(knR, -1.7, c)
	end
	thL += jerk(now, 5.1, 5) * 0.15 * tw
	thR += jerk(now, 5.9, 5.4) * 0.15 * tw
	knL -= math.abs(jerk(now, 6.2, 5.5)) * 0.3 * tw
	knR -= math.abs(jerk(now, 6.9, 5.8)) * 0.3 * tw
	chain("ThighL", "ShinL", base * C(-0.38 * SC, -0.25 * SC, 0), thL, knL, 3.3 * SC, 3.4 * SC)
	chain("ThighR", "ShinR", base * C(0.38 * SC, -0.25 * SC, 0), thR, knR, 3.3 * SC, 3.4 * SC)
end

-- moves the (anchored) body to the last pose
function Monster:applyAnchored()
	local plist, clist = {}, {}
	for i, name in ipairs(SEGMENTS) do
		plist[i] = self.seg[name]
		clist[i] = self.cfs[name]
	end
	workspace:BulkMoveTo(plist, clist, Enum.BulkMoveMode.FireCFrameChanged)
end

-- moves the body when a player is wearing it
function Monster:applyWelds()
	for name, w in pairs(self.welds) do
		w.C0 = self.cfs[name]
	end
end

-- puts the decoration parts on and welds them to their segment
function Monster:assemble(rootCF)
	self:pose(rootCF, os.clock(), 0.05, false, false)
	for name, p in pairs(self.seg) do
		p.CFrame = self.cfs[name]
	end
	for _, d in ipairs(self.decor) do
		local segPart = self.seg[d.seg]
		local p = part({ Name = d.name, Size = d.size, Color = d.color, Material = d.mat, CFrame = segPart.CFrame * d.cf }, self.model)
		make("WeldConstraint", { Part0 = segPart, Part1 = p }, p)
		p.Anchored = false
		p.Massless = true
		if d.name == "EyeL" then
			make("PointLight", { Color = Color3.fromRGB(255, 220, 80), Range = 14, Brightness = 0.9 }, p)
		end
	end
end

-- a player wears the monster: every segment is welded to their root part
function Monster:attachTo(hrp, groundOffset)
	self.localRoot = C(0, -groundOffset, 0)
	self:assemble(hrp.CFrame * self.localRoot)
	self.welds = {}
	self:pose(self.localRoot, os.clock(), 0.05, false, false)
	for name, p in pairs(self.seg) do
		self.welds[name] = make("Weld", { Part0 = hrp, Part1 = p, C0 = self.cfs[name], C1 = C() }, p)
		p.Massless = true
		p.Anchored = false
	end
end

-- footstep sounds, timed with the legs
function Monster:steps(k)
	local s = math.sin(self.phase)
	if k > 0.25 and (s >= 0) ~= (self.lastS >= 0) then
		local snd = (s >= 0) and self.stepA or self.stepB
		snd.PlaybackSpeed = (self.crawlAmt > 0.5 and 0.7 or 0.48) + math.random() * 0.08
		snd.Volume = self.crawlAmt > 0.5 and 1.2 or 2.2
		snd.TimePosition = 0
		snd:Play()
		task.delay(0.3, function()
			if snd.Parent then
				snd:Stop()
			end
		end)
	end
	self.lastS = s
end

function Monster:growl()
	self.growlSound.PlaybackSpeed = CONFIG.GrowlPitch + math.random() * 0.05
	self.growlSound:Play()
end


-- ====================================================================
-- THE FARMER (Nightmare mode)
-- ====================================================================
local Farmer = {}
Farmer.__index = Farmer
local FARMER_SEGMENTS = { "Torso", "Head", "ArmL", "ArmR", "LegL", "LegR", "Fork" }

function Farmer.new(parent)
	local f = setmetatable({}, Farmer)
	local F = 1.15
	f.scale = F
	f.model = make("Model", { Name = "Farmer" }, parent)
	f.seg, f.cfs, f.decor = {}, {}, {}
	f.phase, f.lastS = 0, 0
	local flannel = Color3.fromRGB(112, 30, 26)
	local flannelDark = Color3.fromRGB(40, 14, 12)
	local denim = Color3.fromRGB(50, 64, 98)
	local skin = Color3.fromRGB(188, 150, 124)
	local straw = Color3.fromRGB(186, 156, 92)
	local wood = Color3.fromRGB(96, 70, 44)
	local metal = Color3.fromRGB(70, 70, 72)
	local blood = Color3.fromRGB(90, 8, 8)
	local Fabric, Wood, Metal, Smooth = Enum.Material.Fabric, Enum.Material.Wood, Enum.Material.Metal, Enum.Material.SmoothPlastic

	local function O(x, y, z)
		return C(x * F, y * F, z * F)
	end
	local function seg(name, w, h, d, color, mat)
		f.seg[name] = part({ Name = name, Size = Vector3.new(w * F, h * F, d * F), Color = color, Material = mat or Fabric }, f.model)
	end
	local function dec(segName, name, w, h, d, color, mat, cf, shape)
		f.decor[#f.decor + 1] = { seg = segName, name = name, size = Vector3.new(w * F, h * F, d * F), color = color, mat = mat or Fabric, cf = cf, shape = shape }
	end

	seg("Torso", 2, 2.1, 1, flannel)
	seg("Head", 1.1, 1.2, 1.1, skin, Smooth)
	seg("ArmL", 0.9, 2, 0.9, flannel)
	seg("ArmR", 0.9, 2, 0.9, flannel)
	seg("LegL", 0.95, 2.1, 0.95, denim)
	seg("LegR", 0.95, 2.1, 0.95, denim)
	seg("Fork", 0.18, 0.18, 5.5, wood, Wood)

	-- overalls + plaid shirt
	dec("Torso", "Bib", 1.4, 1.3, 0.06, denim, Fabric, O(0, -0.3, -0.52))
	dec("Torso", "StrapL", 0.25, 1.0, 0.06, denim, Fabric, O(-0.55, 0.55, -0.52))
	dec("Torso", "StrapR", 0.25, 1.0, 0.06, denim, Fabric, O(0.55, 0.55, -0.52))
	dec("Torso", "ButtonL", 0.14, 0.14, 0.05, metal, Metal, O(-0.55, 0.1, -0.56))
	dec("Torso", "ButtonR", 0.14, 0.14, 0.05, metal, Metal, O(0.55, 0.1, -0.56))
	dec("Torso", "BackDenim", 1.6, 1.0, 0.06, denim, Fabric, O(0, -0.5, 0.52))
	for i = 1, 3 do
		dec("Torso", "Plaid" .. i, 2.02, 0.08, 1.02, flannelDark, Fabric, O(0, -0.8 + i * 0.5, 0))
	end
	dec("Torso", "Stain", 0.5, 0.4, 0.05, blood, Smooth, O(0.3, -0.5, -0.56) * A(0, 0, 0.4))
	for _, s in ipairs({ "L", "R" }) do
		dec("Arm" .. s, "Hand" .. s, 0.85, 0.6, 0.85, skin, Smooth, O(0, -1.15, 0))
		dec("Arm" .. s, "Cuff" .. s, 0.95, 0.2, 0.95, flannelDark, Fabric, O(0, -0.85, 0))
		dec("Leg" .. s, "Boot" .. s, 1.0, 0.55, 1.3, Color3.fromRGB(52, 36, 24), Enum.Material.Fabric, O(0, -0.85, -0.15))
		dec("Leg" .. s, "Mud" .. s, 1.0, 0.4, 1.0, Color3.fromRGB(70, 54, 36), Fabric, O(0, -0.5, 0))
	end
	-- face: sunken eyes, grey beard, straw hat
	dec("Head", "EyeL", 0.22, 0.12, 0.05, Color3.fromRGB(8, 6, 6), Smooth, O(-0.24, 0.12, -0.56))
	dec("Head", "EyeR", 0.22, 0.12, 0.05, Color3.fromRGB(8, 6, 6), Smooth, O(0.24, 0.12, -0.56))
	dec("Head", "PupilL", 0.06, 0.06, 0.03, Color3.fromRGB(255, 60, 40), Enum.Material.Neon, O(-0.24, 0.12, -0.59))
	dec("Head", "PupilR", 0.06, 0.06, 0.03, Color3.fromRGB(255, 60, 40), Enum.Material.Neon, O(0.24, 0.12, -0.59))
	dec("Head", "BrowL", 0.32, 0.08, 0.06, Color3.fromRGB(110, 106, 100), Fabric, O(-0.24, 0.27, -0.57) * A(0, 0, -0.25))
	dec("Head", "BrowR", 0.32, 0.08, 0.06, Color3.fromRGB(110, 106, 100), Fabric, O(0.24, 0.27, -0.57) * A(0, 0, 0.25))
	dec("Head", "Nose", 0.18, 0.3, 0.14, Color3.fromRGB(170, 120, 100), Smooth, O(0, -0.02, -0.6))
	dec("Head", "Beard", 1.15, 0.65, 0.5, Color3.fromRGB(120, 116, 108), Fabric, O(0, -0.42, -0.35))
	dec("Head", "Mouth", 0.4, 0.07, 0.05, Color3.fromRGB(30, 10, 10), Smooth, O(0, -0.25, -0.62))
	dec("Head", "Brim", 0.1, 2.5, 2.5, straw, Fabric, O(0, 0.62, 0) * A(0, 0, math.rad(90)), Enum.PartType.Cylinder)
	dec("Head", "Crown", 0.75, 1.3, 1.3, straw, Fabric, O(0, 0.98, 0) * A(0, 0, math.rad(90)), Enum.PartType.Cylinder)
	dec("Head", "HatBand", 0.18, 1.34, 1.34, Color3.fromRGB(60, 30, 20), Fabric, O(0, 0.72, 0) * A(0, 0, math.rad(90)), Enum.PartType.Cylinder)
	-- the pitchfork (front is -Z)
	dec("Fork", "Ferrule", 0.3, 0.3, 0.4, metal, Metal, O(0, 0, -2.8))
	dec("Fork", "Crossbar", 1.3, 0.14, 0.14, metal, Metal, O(0, 0, -3.0))
	for i, x in ipairs({ -0.55, 0, 0.55 }) do
		dec("Fork", "Tine" .. i, 0.08, 0.08, 1.4, metal, Metal, O(x, 0, -3.7))
		dec("Fork", "TineBlood" .. i, 0.09, 0.09, 0.45, blood, Smooth, O(x, 0, -4.2))
	end

	local torso = f.seg.Torso
	f.stepSound = newSound(CONFIG.Sounds.Footstep, torso, 1.4, 0.8, 70)
	f.yell = newSound(CONFIG.Sounds.Growl, torso, 3, 0.85, 120)
	local bb = make("BillboardGui", { Size = UDim2.fromOffset(240, 50), StudsOffset = Vector3.new(0, 4.5, 0), AlwaysOnTop = false, MaxDistance = 80, Enabled = false }, f.seg.Head)
	make("TextLabel", { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Text = "GET OFF MY LAND!", TextColor3 = Color3.fromRGB(255, 70, 50), TextStrokeTransparency = 0.2, Font = Enum.Font.Antique, TextScaled = true }, bb)
	f.bubble = bb
	return f
end

-- mode: "idle", "walk", "chase", "stab"
function Farmer:pose(rootCF, now, k, mode, thrust)
	local F = self.scale
	local out = self.cfs
	local phase = self.phase
	local bob = math.abs(math.sin(phase)) * 0.15 * k
	local lean = (mode == "chase") and -0.18 or ((mode == "stab") and -0.1 or 0)
	local sw = math.sin(phase) * 0.7 * k
	local headTilt = 0.15 + math.noise(now * 0.7, 3.3) * 0.25
	local headRoll = 0.22 + math.noise(now * 0.5, 9.1) * 0.2 -- creepy tilted head
	local hip = rootCF * C(0, 2.1 * F + bob, 0)
	out.LegL = hip * C(-0.5 * F, 0, 0) * A(sw, 0, 0) * C(0, -1.05 * F, 0)
	out.LegR = hip * C(0.5 * F, 0, 0) * A(-sw, 0, 0) * C(0, -1.05 * F, 0)
	local torso = hip * A(lean, 0, 0) * C(0, 1.05 * F, 0)
	out.Torso = torso
	out.Head = torso * C(0, 1.05 * F, 0) * A(headTilt, 0, headRoll) * C(0, 0.6 * F, 0)
	local aL, aR = -sw * 0.8, sw * 0.8
	if mode == "chase" or mode == "stab" then
		aL, aR = 1.15, 1.0
		out.Fork = rootCF * C(0.2 * F, 2.75 * F, -(0.9 + (thrust or 0)))
	else
		aR = 0.35
		local hand = torso * C(1.45 * F, 0.8 * F, 0) * A(aR, 0, -0.08) * C(0, -2.15 * F, 0)
		out.Fork = C(hand.Position) * rootCF.Rotation * A(math.pi / 2, 0, 0) * C(0, 0, -0.9)
	end
	out.ArmL = torso * C(-1.45 * F, 0.8 * F, 0) * A(aL, 0, 0.08) * C(0, -1 * F, 0)
	out.ArmR = torso * C(1.45 * F, 0.8 * F, 0) * A(aR, 0, -0.08) * C(0, -1 * F, 0)
end

function Farmer:apply()
	local plist, clist = {}, {}
	for i, name in ipairs(FARMER_SEGMENTS) do
		plist[i] = self.seg[name]
		clist[i] = self.cfs[name]
	end
	workspace:BulkMoveTo(plist, clist, Enum.BulkMoveMode.FireCFrameChanged)
end

function Farmer:assemble(rootCF)
	self:pose(rootCF, os.clock(), 0, "idle", 0)
	for name, p in pairs(self.seg) do
		p.CFrame = self.cfs[name]
	end
	for _, d in ipairs(self.decor) do
		local segPart = self.seg[d.seg]
		local p = part({ Name = d.name, Shape = d.shape, Size = d.size, Color = d.color, Material = d.mat, CFrame = segPart.CFrame * d.cf }, self.model)
		make("WeldConstraint", { Part0 = segPart, Part1 = p }, p)
		p.Anchored = false
		p.Massless = true
	end
end

function Farmer:steps(k)
	local s = math.sin(self.phase)
	if k > 0.25 and (s >= 0) ~= (self.lastS >= 0) then
		local snd = self.stepSound
		snd.PlaybackSpeed = 0.75 + math.random() * 0.1
		snd.TimePosition = 0
		snd:Play()
		task.delay(0.25, function()
			if snd.Parent then
				snd:Stop()
			end
		end)
	end
	self.lastS = s
end

-- ====================================================================
-- MORE PROPS (farm, dead animals, police car)
-- ====================================================================
function Props.blood(f, pos, s)
	local red = Color3.fromRGB(72, 6, 6)
	part({ Name = "Blood", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.05, s, s), CFrame = C(pos + Vector3.new(0, 0.07, 0)) * A(0, 0, math.rad(90)), Color = red, Material = Enum.Material.SmoothPlastic, Reflectance = 0.08 }, f)
	for i = 1, 4 do
		local a = i * 1.7
		local d = s * (0.55 + (i % 2) * 0.2)
		local r = s * 0.25
		part({ Name = "BloodDrop", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.05, r, r), CFrame = C(pos + Vector3.new(math.cos(a) * d, 0.075, math.sin(a) * d)) * A(0, 0, math.rad(90)), Color = red, Material = Enum.Material.SmoothPlastic }, f)
	end
end

function Props.flies(f, pos)
	local p = part({ Name = "Flies", Size = Vector3.new(1, 1, 1), Position = pos + Vector3.new(0, 1.6, 0), Transparency = 1 }, f)
	make("ParticleEmitter", {
		Texture = "rbxasset://textures/particles/sparkles_main.dds", Color = ColorSequence.new(Color3.new(0, 0, 0)), LightEmission = 0,
		Size = NumberSequence.new(0.12), Rate = 10, Lifetime = NumberRange.new(1, 2), Speed = NumberRange.new(1, 3),
		SpreadAngle = Vector2.new(180, 180), Drag = 2, Acceleration = Vector3.new(0, 0.4, 0),
	}, p)
end

function Props.deadCow(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	local white = Color3.fromRGB(214, 208, 196)
	local black = Color3.fromRGB(26, 24, 22)
	lp(f, cf, "CowBody", Vector3.new(2.4, 2.2, 4.8), C(0, 1.1, 0), white, Enum.Material.Fabric)
	lp(f, cf, "Spot", Vector3.new(1.2, 0.05, 1.6), C(-0.3, 2.22, 0.8) * A(0, 0.4, 0), black, Enum.Material.Fabric)
	lp(f, cf, "Spot", Vector3.new(0.9, 0.05, 1.1), C(0.4, 2.22, -1.2) * A(0, -0.3, 0), black, Enum.Material.Fabric)
	lp(f, cf, "Spot", Vector3.new(0.05, 1.0, 1.4), C(-1.22, 1.3, -0.4), black, Enum.Material.Fabric)
	for _, z in ipairs({ -1.6, 1.6 }) do
		for _, y in ipairs({ 0.6, 1.5 }) do
			lp(f, cf, "Leg", Vector3.new(2.2, 0.45, 0.45), C(2.3, y, z) * A(0, 0, (y - 1) * 0.3), white, Enum.Material.Fabric)
			lp(f, cf, "Hoof", Vector3.new(0.35, 0.5, 0.5), C(3.45, y + (y - 1) * 0.35, z), black, Enum.Material.SmoothPlastic)
		end
	end
	lp(f, cf, "CowHead", Vector3.new(1.2, 1.1, 1.7), C(0.2, 0.55, -3.0) * A(0, 0.3, 1.2), white, Enum.Material.Fabric)
	lp(f, cf, "Snout", Vector3.new(1.0, 0.8, 0.5), C(0.6, 0.45, -3.8) * A(0, 0.3, 1.2), Color3.fromRGB(200, 150, 150), Enum.Material.SmoothPlastic)
	lp(f, cf, "Horn", Vector3.new(0.15, 0.6, 0.15), C(-0.3, 0.9, -2.8) * A(0.4, 0, 0.8), Color3.fromRGB(220, 210, 180), Enum.Material.SmoothPlastic)
	lp(f, cf, "Wound", Vector3.new(0.06, 1.2, 2.2), C(-1.22, 1.0, 0.6), Color3.fromRGB(110, 10, 10), Enum.Material.SmoothPlastic)
	for i = 1, 4 do
		lp(f, cf, "Rib", Vector3.new(0.12, 1.1, 0.12), C(-1.28, 1.0, -0.2 + i * 0.4) * A(0, 0, 0.1), Color3.fromRGB(220, 210, 190), Enum.Material.SmoothPlastic)
	end
	Props.blood(f, cf:PointToWorldSpace(Vector3.new(-2.2, 0, 0.4)), 4)
	Props.flies(f, cf.Position)
end

function Props.deadPig(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	local pink = Color3.fromRGB(214, 150, 150)
	lp(f, cf, "PigBody", Vector3.new(1.6, 1.5, 2.8), C(0, 0.75, 0), pink, Enum.Material.SmoothPlastic)
	lp(f, cf, "PigHead", Vector3.new(1.1, 1.1, 1.0), C(0.1, 0.55, -1.8) * A(0, 0.2, 0.9), pink, Enum.Material.SmoothPlastic)
	lp(f, cf, "PigSnout", Vector3.new(0.6, 0.45, 0.3), C(0.3, 0.45, -2.35) * A(0, 0.2, 0.9), Color3.fromRGB(190, 110, 110), Enum.Material.SmoothPlastic)
	for _, z in ipairs({ -0.8, 0.8 }) do
		for _, y in ipairs({ 0.4, 1.0 }) do
			lp(f, cf, "PigLeg", Vector3.new(0.9, 0.35, 0.35), C(1.2, y, z), pink, Enum.Material.SmoothPlastic)
		end
	end
	lp(f, cf, "Cut", Vector3.new(0.05, 0.25, 1.4), C(-0.82, 0.8, -0.3), Color3.fromRGB(110, 10, 10), Enum.Material.SmoothPlastic)
	Props.blood(f, cf:PointToWorldSpace(Vector3.new(-1.5, 0, 0)), 3)
	Props.flies(f, cf.Position)
end

function Props.deadChicken(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	lp(f, cf, "ChickenBody", Vector3.new(0.8, 0.8, 0.8), C(0, 0.35, 0), Color3.fromRGB(235, 232, 225), Enum.Material.Fabric, { Shape = Enum.PartType.Ball })
	lp(f, cf, "ChickenHead", Vector3.new(0.4, 0.4, 0.4), C(0, 0.2, -0.75), Color3.fromRGB(235, 232, 225), Enum.Material.Fabric, { Shape = Enum.PartType.Ball })
	lp(f, cf, "Comb", Vector3.new(0.08, 0.2, 0.25), C(0, 0.42, -0.75), Color3.fromRGB(200, 30, 30), Enum.Material.SmoothPlastic)
	for i = 1, 6 do
		local a = i * 1.1
		lp(f, cf, "Feather", Vector3.new(0.25, 0.03, 0.5), C(math.cos(a) * (1 + i * 0.2), 0.05, math.sin(a) * (1 + i * 0.2)) * A(0, a, 0), Color3.fromRGB(230, 226, 218), Enum.Material.Fabric)
	end
	Props.blood(f, cf.Position + Vector3.new(0.3, 0, 0.4), 1.6)
end

function Props.deadSheep(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	local wool = Color3.fromRGB(200, 196, 186)
	for i = 1, 5 do
		lp(f, cf, "Wool", Vector3.new(1.4, 1.4, 1.4), C((i % 2) * 0.4 - 0.2, 0.7, -1.2 + i * 0.5), wool, Enum.Material.Fabric, { Shape = Enum.PartType.Ball })
	end
	lp(f, cf, "SheepHead", Vector3.new(0.8, 0.8, 1.0), C(0.2, 0.4, -2.0) * A(0, 0, 1.1), Color3.fromRGB(30, 28, 26), Enum.Material.SmoothPlastic)
	for _, z in ipairs({ -0.8, 0.9 }) do
		lp(f, cf, "SheepLeg", Vector3.new(1.4, 0.25, 0.25), C(1.1, 0.5, z), Color3.fromRGB(30, 28, 26), Enum.Material.SmoothPlastic)
	end
	Props.blood(f, cf.Position + Vector3.new(-1.2, 0, 0), 3)
	Props.flies(f, cf.Position)
end

function Props.tractor(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	local rust = Color3.fromRGB(120, 60, 34)
	local green = Color3.fromRGB(46, 70, 40)
	lp(f, cf, "TractorBody", Vector3.new(3, 2.2, 6), C(0, 2.6, -0.5), green, Enum.Material.CorrodedMetal, { CanCollide = true })
	lp(f, cf, "Hood", Vector3.new(2.6, 1.6, 3), C(0, 3.9, -2), green, Enum.Material.CorrodedMetal)
	lp(f, cf, "Exhaust", Vector3.new(0.3, 2.4, 0.3), C(0.8, 5.6, -2.6), Color3.fromRGB(30, 30, 30), Enum.Material.Metal)
	lp(f, cf, "Seat", Vector3.new(1.4, 0.4, 1.2), C(0, 4.1, 1.6), Color3.fromRGB(30, 26, 22), Enum.Material.Fabric)
	lp(f, cf, "Wheel", Vector3.new(1.4, 4.4, 4.4), C(-2.2, 2.2, 1.6), Color3.fromRGB(22, 22, 22), Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Cylinder })
	lp(f, cf, "Wheel", Vector3.new(1.4, 4.4, 4.4), C(2.2, 2.2, 1.6), Color3.fromRGB(22, 22, 22), Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Cylinder })
	lp(f, cf, "Wheel", Vector3.new(0.8, 2.4, 2.4), C(-1.6, 1.2, -3), Color3.fromRGB(22, 22, 22), Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Cylinder })
	lp(f, cf, "Wheel", Vector3.new(0.8, 2.4, 2.4), C(1.6, 1.2, -3), Color3.fromRGB(22, 22, 22), Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Cylinder })
	lp(f, cf, "Rim", Vector3.new(1.42, 2, 2), C(-2.2, 2.2, 1.6), rust, Enum.Material.CorrodedMetal, { Shape = Enum.PartType.Cylinder })
	lp(f, cf, "Rim", Vector3.new(1.42, 2, 2), C(2.2, 2.2, 1.6), rust, Enum.Material.CorrodedMetal, { Shape = Enum.PartType.Cylinder })
	lp(f, cf, "Wheel2", Vector3.new(0.3, 0.3, 1.6), C(0, 4.9, 0.6) * A(0.6, 0, 0), Color3.fromRGB(30, 30, 30), Enum.Material.Metal)
end

function Props.trough(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	lp(f, cf, "Trough", Vector3.new(6, 1.6, 2), C(0, 0.8, 0), Color3.fromRGB(80, 80, 82), Enum.Material.CorrodedMetal, { CanCollide = true })
	lp(f, cf, "Water", Vector3.new(5.6, 0.1, 1.6), C(0, 1.55, 0), Color3.fromRGB(40, 30, 20), Enum.Material.Glass)
end

function Props.choppingBlock(f, pos, yaw)
	local cf = C(pos) * A(0, yaw, 0)
	lp(f, cf, "Stump", Vector3.new(2, 2.2, 2.2), C(0, 1, 0) * A(0, 0, math.rad(90)), Color3.fromRGB(96, 70, 44), Enum.Material.Wood, { Shape = Enum.PartType.Cylinder, CanCollide = true })
	lp(f, cf, "StumpTop", Vector3.new(0.05, 2, 2), C(0, 2.01, 0) * A(0, 0, math.rad(90)), Color3.fromRGB(170, 136, 90), Enum.Material.Wood, { Shape = Enum.PartType.Cylinder })
	lp(f, cf, "AxeHandle", Vector3.new(0.2, 2.6, 0.25), C(0.3, 3.1, 0) * A(0, 0, -0.35), Color3.fromRGB(110, 80, 50), Enum.Material.Wood)
	lp(f, cf, "AxeHead", Vector3.new(0.9, 0.5, 0.12), C(-0.05, 2.15, 0) * A(0, 0, -0.35), Color3.fromRGB(70, 70, 72), Enum.Material.Metal)
	Props.blood(f, cf.Position + Vector3.new(1.4, 0, 0.5), 2)
end

function Props.hangingLantern(f, pos, flickers)
	part({ Name = "LanternChain", Size = Vector3.new(0.1, 4, 0.1), Position = pos + Vector3.new(0, 2.6, 0), Color = Color3.fromRGB(40, 40, 40), Material = Enum.Material.Metal }, f)
	part({ Name = "LanternCap", Size = Vector3.new(0.9, 0.25, 0.9), Position = pos + Vector3.new(0, 0.6, 0), Color = Color3.fromRGB(30, 30, 30), Material = Enum.Material.Metal }, f)
	local glass = part({ Name = "LanternGlass", Size = Vector3.new(0.7, 1, 0.7), Position = pos, Color = Color3.fromRGB(255, 190, 100), Material = Enum.Material.Neon }, f)
	local l = make("PointLight", { Color = Color3.fromRGB(255, 170, 90), Range = 22, Brightness = 1.1, Shadows = true }, glass)
	if flickers then
		Props.flicker(flickers, l, 0.45)
	end
end

-- the rusty yellow key (returns the prompt part)
function Props.rustyKey(f, pos)
	local model = make("Model", { Name = "RustyKey" }, f)
	local rust = Color3.fromRGB(186, 150, 40)
	local cf = C(pos + Vector3.new(0, 0.35, 0)) * A(0, math.random() * 6, math.rad(80))
	local root = part({ Name = "KeyShaft", Size = Vector3.new(0.14, 0.14, 1.5), CFrame = cf, Color = rust, Material = Enum.Material.CorrodedMetal }, model)
	for i = 1, 8 do
		local a = i / 8 * math.pi * 2
		part({ Name = "KeyRing", Size = Vector3.new(0.12, 0.14, 0.24), CFrame = cf * C(math.cos(a) * 0.32, 0, 1.05 + math.sin(a) * 0.32) * A(0, -a, 0), Color = rust, Material = Enum.Material.CorrodedMetal }, model)
	end
	part({ Name = "KeyTooth", Size = Vector3.new(0.3, 0.14, 0.14), CFrame = cf * C(0.18, 0, -0.6), Color = rust, Material = Enum.Material.CorrodedMetal }, model)
	part({ Name = "KeyTooth", Size = Vector3.new(0.22, 0.14, 0.14), CFrame = cf * C(0.14, 0, -0.35), Color = rust, Material = Enum.Material.CorrodedMetal }, model)
	make("PointLight", { Color = Color3.fromRGB(255, 220, 90), Range = 7, Brightness = 0.8 }, root)
	make("ParticleEmitter", { Texture = "rbxasset://textures/particles/sparkles_main.dds", Color = ColorSequence.new(Color3.fromRGB(255, 230, 120)), Rate = 4, Lifetime = NumberRange.new(0.6, 1.2), Speed = NumberRange.new(0.3, 1), Size = NumberSequence.new(0.25, 0), LightEmission = 1 }, root)
	local hit = part({ Name = "KeyPickup", Size = Vector3.new(2, 2, 2), Position = pos + Vector3.new(0, 1, 0), Transparency = 1 }, model)
	return model, hit
end

-- police car: front is -Z in local space. Returns everything we need.
function Props.policeCar(f, cf)
	local model = make("Model", { Name = "PoliceCar" }, f)
	local root = part({ Name = "CarRoot", Size = Vector3.new(1, 1, 1), CFrame = cf, Transparency = 1 }, model)
	local list = {}
	local function cp(name, size, offset, color, mat, extra)
		local props = { Name = name, Size = size, CFrame = cf * offset, Color = color, Material = mat or Enum.Material.SmoothPlastic }
		if extra then
			for k, v in pairs(extra) do
				props[k] = v
			end
		end
		local p = part(props, model)
		list[#list + 1] = p
		return p
	end
	local black = Color3.fromRGB(18, 18, 20)
	local white = Color3.fromRGB(235, 235, 235)
	cp("Chassis", Vector3.new(6, 0.8, 14), C(0, 1.3, 0), black)
	cp("LowerFront", Vector3.new(6, 1.6, 4), C(0, 2.5, -5), black)
	cp("LowerRear", Vector3.new(6, 1.6, 3.6), C(0, 2.5, 5.2), black)
	local doorL = cp("DoorL", Vector3.new(0.2, 1.6, 6.4), C(-2.9, 2.5, 0.2), white)
	local doorR = cp("DoorR", Vector3.new(0.2, 1.6, 6.4), C(2.9, 2.5, 0.2), white)
	cp("Floor", Vector3.new(5.6, 0.3, 6.4), C(0, 1.85, 0.2), Color3.fromRGB(40, 40, 40))
	cp("Hood", Vector3.new(5.8, 0.4, 3.8), C(0, 3.4, -5), black)
	cp("Trunk", Vector3.new(5.8, 0.4, 3.4), C(0, 3.4, 5.2), black)
	cp("Roof", Vector3.new(5.4, 0.3, 5.6), C(0, 5.3, 0.4), white)
	for _, x in ipairs({ -2.65, 2.65 }) do
		for _, z in ipairs({ -2.3, 3.1 }) do
			cp("Pillar", Vector3.new(0.25, 1.9, 0.25), C(x, 4.3, z), black)
		end
		cp("SideGlass", Vector3.new(0.08, 1.4, 5.2), C(x, 4.25, 0.4), Color3.fromRGB(60, 70, 80), Enum.Material.Glass, { Transparency = 0.6 })
	end
	cp("Windshield", Vector3.new(5.2, 1.6, 0.1), C(0, 4.3, -2.4) * A(-0.35, 0, 0), Color3.fromRGB(60, 70, 80), Enum.Material.Glass, { Transparency = 0.6 })
	cp("RearGlass", Vector3.new(5.2, 1.5, 0.1), C(0, 4.3, 3.2) * A(0.35, 0, 0), Color3.fromRGB(60, 70, 80), Enum.Material.Glass, { Transparency = 0.6 })
	cp("LightBar", Vector3.new(4.2, 0.35, 0.9), C(0, 5.6, 0.4), black)
	local red = cp("LightRed", Vector3.new(1.9, 0.4, 0.8), C(-1.05, 5.8, 0.4), Color3.fromRGB(255, 30, 30), Enum.Material.Neon)
	local blue = cp("LightBlue", Vector3.new(1.9, 0.4, 0.8), C(1.05, 5.8, 0.4), Color3.fromRGB(30, 80, 255), Enum.Material.Neon)
	local redL = make("PointLight", { Color = Color3.fromRGB(255, 40, 40), Range = 40, Brightness = 3 }, red)
	local blueL = make("PointLight", { Color = Color3.fromRGB(40, 90, 255), Range = 40, Brightness = 3 }, blue)
	for _, x in ipairs({ -2.2, 2.2 }) do
		local hl = cp("Headlight", Vector3.new(1.2, 0.5, 0.1), C(x, 2.8, -7.05), Color3.fromRGB(255, 250, 220), Enum.Material.Neon)
		make("SpotLight", { Face = Enum.NormalId.Front, Range = 60, Angle = 50, Brightness = 3, Color = Color3.fromRGB(255, 245, 220) }, hl)
		cp("Taillight", Vector3.new(1.2, 0.5, 0.1), C(x, 2.8, 7.05), Color3.fromRGB(200, 20, 20), Enum.Material.Neon)
	end
	for _, x in ipairs({ -2.9, 2.9 }) do
		for _, z in ipairs({ -4.4, 4.6 }) do
			cp("Wheel", Vector3.new(0.9, 2.6, 2.6), C(x, 1.3, z), Color3.fromRGB(14, 14, 14), Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Cylinder })
			cp("Hubcap", Vector3.new(0.95, 1.2, 1.2), C(x, 1.3, z), Color3.fromRGB(160, 160, 165), Enum.Material.Metal, { Shape = Enum.PartType.Cylinder })
		end
	end
	surfaceText(doorL, Enum.NormalId.Left, "POLICE", Color3.fromRGB(20, 40, 120), Enum.Font.GothamBlack)
	surfaceText(doorR, Enum.NormalId.Right, "POLICE", Color3.fromRGB(20, 40, 120), Enum.Font.GothamBlack)
	-- the officer driving
	local blueShirt = Color3.fromRGB(30, 44, 90)
	cp("OfficerBody", Vector3.new(1.8, 1.8, 1), C(-1.3, 3.6, 0.4), blueShirt, Enum.Material.Fabric)
	cp("OfficerHead", Vector3.new(1, 1, 1), C(-1.3, 5.0, 0.4), Color3.fromRGB(200, 160, 130), Enum.Material.SmoothPlastic)
	cp("OfficerCap", Vector3.new(1.1, 0.35, 1.3), C(-1.3, 5.55, 0.3), Color3.fromRGB(20, 26, 50), Enum.Material.Fabric)
	cp("Badge", Vector3.new(0.3, 0.35, 0.05), C(-1.6, 3.9, -0.12), Color3.fromRGB(220, 190, 80), Enum.Material.Metal)
	cp("Wheel3", Vector3.new(1.2, 1.2, 0.15), C(-1.3, 3.8, -1.3) * A(-0.5, 0, 0), black)
	-- seats for the survivors
	local seats = {}
	for _, off in ipairs({ C(1.3, 2.6, 0.0), C(-1.3, 2.6, 2.6), C(1.3, 2.6, 2.6) }) do
		local seat = make("Seat", { Name = "CarSeat", Size = Vector3.new(2, 0.6, 1.8), CFrame = cf * off, Color = Color3.fromRGB(30, 30, 32), Material = Enum.Material.Fabric, Anchored = true, CanCollide = false, TopSurface = Enum.SurfaceType.Smooth, BottomSurface = Enum.SurfaceType.Smooth }, model)
		seats[#seats + 1] = seat
		list[#list + 1] = seat
	end
	local doorHit = cp("DoorHit", Vector3.new(8, 4, 8), C(0, 3, 0), white, nil, { Transparency = 1 })
	for _, p in ipairs(list) do
		make("WeldConstraint", { Part0 = root, Part1 = p }, p)
		p.Anchored = false
		p.Massless = true
	end
	return { model = model, root = root, seats = seats, red = red, blue = blue, redL = redL, blueL = blueL, doorHit = doorHit }
end

-- ====================================================================
-- NIGHTMARE MAP LAYOUT
-- ====================================================================
-- Block types: corn, barn, floor (barn inside), fence, farm, house, shed, gate
local function genNightmare(rng)
	local wall = genMaze(rng)
	local wtype = {}
	for x = 1, SIZE do
		wtype[x] = {}
		for y = 1, SIZE do
			wtype[x][y] = "corn"
		end
	end
	-- thin the maze into corn patches
	for x = 2, SIZE - 1 do
		for y = 2, SIZE - 1 do
			if wall[x][y] and rng:NextNumber() < 0.42 then
				wall[x][y] = false
			end
		end
	end
	local function set(x, y, isWall, t)
		wall[x][y] = isWall
		wtype[x][y] = t or "corn"
	end
	-- the barn and the yard around it
	for x = 2, 9 do
		for y = 2, 9 do
			set(x, y, false)
		end
	end
	for x = 3, 8 do
		for y = 3, 8 do
			local ring = x == 3 or x == 8 or y == 3 or y == 8
			set(x, y, ring, ring and "barn" or "floor")
		end
	end
	-- crossroads in the middle
	for x = 11, 13 do
		for y = 11, 13 do
			set(x, y, false)
		end
	end
	-- the farm (fenced), with 2 gaps and the farmhouse
	for x = 14, SIZE - 1 do
		for y = 14, SIZE - 1 do
			local ring = x == 14 or y == 14
			set(x, y, ring, ring and "fence" or "farm")
		end
	end
	set(14, 19, false, "farm")
	set(19, 14, false, "farm")
	for x = 20, 22 do
		for y = 20, 22 do
			set(x, y, true, "house")
		end
	end
	-- the tool shed with the phone
	for x = 18, 21 do
		for y = 3, 7 do
			set(x, y, false)
		end
	end
	set(20, 5, true, "shed")
	-- the locked exit gate (south edge)
	set(13, SIZE, true, "gate")
	for x = 12, 14 do
		set(x, SIZE - 1, false)
	end
	-- make sure the important places are reachable from the crossroads
	local function carve(fx, fy)
		local x, y = fx, fy
		local function open(cx, cy)
			if cx > 1 and cx < SIZE and cy > 1 and cy < SIZE and wtype[cx][cy] == "corn" then
				wall[cx][cy] = false
			end
		end
		while x ~= 12 do
			open(x, y)
			x += (12 > x) and 1 or -1
		end
		while y ~= 12 do
			open(x, y)
			y += (12 > y) and 1 or -1
		end
	end
	for _, s in ipairs({ { 9, 5 }, { 13, 19 }, { 19, 13 }, { 18, 5 }, { 13, SIZE - 1 } }) do
		local dm = bfs(wall, 12, 12)
		if not dm[key(s[1], s[2])] then
			carve(s[1], s[2])
		end
	end
	return wall, wtype
end

-- ====================================================================
-- MATCH (one map per elevator: the Corn Field or the Nightmare farm)
-- ====================================================================
local Match = {}
Match.__index = Match
local activeMatches = {}

local function smooth(a)
	a = math.clamp(a, 0, 1)
	return a * a * (3 - 2 * a)
end

-- full-screen flash for one player (jumpscares)
local function flash(plr, color, fromT, toT, dur)
	local st = PS[plr]
	local h = st and st.hud
	if not h or not h.flash then
		return
	end
	h.flash.BackgroundColor3 = color
	h.flash.BackgroundTransparency = fromT
	TweenService:Create(h.flash, TweenInfo.new(dur), { BackgroundTransparency = toT }):Play()
end

function Match.new(slot, mode)
	local self = setmetatable({}, Match)
	self.slot = slot
	self.mode = mode
	self.kind = (mode == "Nightmare") and "nightmare" or "corn"
	self.D = MODES[mode] or MODES.Normal
	self.origin = Vector3.new(3000 + (slot - 1) * 800, 0, 0)
	self.players = {} -- [plr] = { role, status }
	self.flickers = {}
	self.ended = false
	self.puzzle = { input = {}, opened = false }
	self.holes = {}
	return self
end

function Match:bc(bx, by)
	return self.origin + Vector3.new((bx - 0.5) * BS, 0, (by - 0.5) * BS)
end

function Match:toBlock(pos)
	local bx = math.clamp(math.floor((pos.X - self.origin.X) / BS) + 1, 1, SIZE)
	local by = math.clamp(math.floor((pos.Z - self.origin.Z) / BS) + 1, 1, SIZE)
	return bx, by
end

function Match:isOpen(bx, by)
	return inGrid(bx, by) and not self.wall[bx][by]
end

-- the closest walkable block to a position
function Match:nearestOpen(pos)
	local bx, by = self:toBlock(pos)
	if self:isOpen(bx, by) then
		return bx, by
	end
	local best, bd
	for _, d in ipairs(DIRS) do
		local nx, ny = bx + d[1], by + d[2]
		if self:isOpen(nx, ny) then
			local dd = (self:bc(nx, ny) - pos).Magnitude
			if not bd or dd < bd then
				best, bd = { nx, ny }, dd
			end
		end
	end
	if best then
		return best[1], best[2]
	end
	return bx, by
end

function Match:inCamp(pos)
	local bx, by = self:toBlock(pos)
	return bx <= 6 and by <= 6
end

function Match:inBarnBlock(bx, by)
	return bx >= 3 and bx <= 8 and by >= 3 and by <= 8
end

function Match:inBarn(pos)
	return self:inBarnBlock(self:toBlock(pos))
end

function Match:inFarm(pos)
	local bx, by = self:toBlock(pos)
	return bx >= 15 and by >= 15 and bx <= SIZE - 1 and by <= SIZE - 1
end

function Match:build()
	if self.kind == "nightmare" then
		self:buildNightmare()
	else
		self:buildCorn()
	end
end

function Match:buildCorn()
	local O = self.origin
	local GY = O.Y
	local rng = Random.new(os.time() + self.slot * 17)
	local deco = Random.new(os.time() + self.slot * 31 + 7)
	local detail = math.clamp(CONFIG.CornDetail, 1, 3)

	local folder = make("Folder", { Name = "CornField_" .. self.slot }, workspace)
	local blocks = make("Folder", { Name = "Blocks" }, folder)
	local stalks = make("Folder", { Name = "Stalks" }, folder)
	local props = make("Folder", { Name = "Props" }, folder)
	self.folder, self.blocks, self.stalks = folder, blocks, stalks

	local wall = genMaze(rng)
	self.wall = wall
	local span = SIZE * BS

	-- ground
	solid({ Name = "Ground", Size = Vector3.new(span + 320, 4, span + 320), Position = O + Vector3.new(span / 2, -2, span / 2), Material = Enum.Material.Grass, Color = Color3.fromRGB(36, 46, 26) }, folder)
	part({ Name = "Dirt", Size = Vector3.new(span, 0.1, span), Position = O + Vector3.new(span / 2, 0.03, span / 2), Material = Enum.Material.Ground, Color = Color3.fromRGB(72, 58, 40) }, folder)
	for _ = 1, 60 do
		local p = O + Vector3.new(deco:NextNumber() * span, 0.1, deco:NextNumber() * span)
		local j = deco:NextInteger(0, 16)
		part({ Name = "Mud", Size = Vector3.new(3 + deco:NextNumber() * 5, 0.05, 3 + deco:NextNumber() * 5), CFrame = C(p) * A(0, deco:NextNumber() * 6, 0), Material = Enum.Material.Mud, Color = Color3.fromRGB(56 + j, 44 + j, 30 + j) }, folder)
	end

	-- corn walls
	local stemColors = { Color3.fromRGB(96, 112, 46), Color3.fromRGB(110, 120, 52), Color3.fromRGB(84, 100, 40) }
	local leafColors = { Color3.fromRGB(60, 88, 36), Color3.fromRGB(74, 100, 40), Color3.fromRGB(88, 104, 44) }
	local coreColors = { Color3.fromRGB(58, 76, 36), Color3.fromRGB(70, 88, 40), Color3.fromRGB(80, 90, 42), Color3.fromRGB(52, 68, 32) }
	local stalksPerFace = detail == 1 and 1 or (detail == 2 and 2 or 3)
	local leavesPerStalk = detail == 3 and 3 or 2

	local function addStalk(base, height)
		part({ Name = "Stem", Shape = Enum.PartType.Cylinder, Size = Vector3.new(height, 0.3, 0.3), CFrame = C(base + Vector3.new(0, height / 2, 0)) * A(0, 0, math.rad(90)), Color = stemColors[deco:NextInteger(1, #stemColors)], Material = Enum.Material.Wood }, stalks)
		for i = 1, leavesPerStalk do
			local yaw = deco:NextNumber() * math.pi * 2
			local ly = base.Y + height * (0.3 + 0.2 * i + deco:NextNumber() * 0.1)
			part({ Name = "Leaf", Size = Vector3.new(2.6, 0.06, 0.55), CFrame = C(base.X, ly, base.Z) * A(0, yaw, 0) * C(1.2, 0, 0) * A(0, 0, -math.rad(28)), Color = leafColors[deco:NextInteger(1, #leafColors)], Material = Enum.Material.Grass }, stalks)
		end
		if deco:NextNumber() < 0.5 then
			part({ Name = "Ear", Size = Vector3.new(0.5, 1.5, 0.5), CFrame = C(base + Vector3.new(0.4, height * 0.55, 0)) * A(0, 0, math.rad(12)), Color = Color3.fromRGB(196, 160, 56), Material = Enum.Material.SmoothPlastic }, stalks)
		end
		if detail >= 2 and deco:NextNumber() < 0.6 then
			part({ Name = "Tassel", Size = Vector3.new(0.14, 1.3, 0.14), CFrame = C(base + Vector3.new(0, height + 0.5, 0)) * A(0, deco:NextNumber() * 6, math.rad(deco:NextInteger(-18, 18))), Color = Color3.fromRGB(176, 168, 110), Material = Enum.Material.Fabric }, stalks)
		end
		maybeYield()
	end

	for bx = 1, SIZE do
		for by = 1, SIZE do
			local isGate = (bx == 1 and by == 4)
			if wall[bx][by] and not isGate then
				local onRing = (bx == 1 or bx == SIZE or by == 1 or by == SIZE)
				local exposed = onRing
				if not exposed then
					for _, d in ipairs(DIRS) do
						if self:isOpen(bx + d[1], by + d[2]) then
							exposed = true
							break
						end
					end
				end
				if exposed then
					local c = self:bc(bx, by)
					solid({ Name = "CornWall", Size = Vector3.new(BS, WALL_H, BS), Position = c + Vector3.new(0, WALL_H / 2, 0), Material = Enum.Material.Grass, Color = coreColors[deco:NextInteger(1, #coreColors)] }, blocks)
					for _, d in ipairs(DIRS) do
						if self:isOpen(bx + d[1], by + d[2]) then
							local n = Vector3.new(d[1], 0, d[2])
							local t = Vector3.new(-d[2], 0, d[1])
							for k = 1, stalksPerFace do
								local off = (k - (stalksPerFace + 1) / 2) * (BS / (stalksPerFace + 0.3)) + (deco:NextNumber() - 0.5) * 1.2
								local p = c + n * (BS / 2 + 0.5 + deco:NextNumber() * 0.5) + t * off
								addStalk(p, deco:NextNumber() * 4 + 11)
							end
						end
					end
					if deco:NextNumber() < 0.18 then
						addStalk(c + Vector3.new((deco:NextNumber() - 0.5) * 4, WALL_H - 4, (deco:NextNumber() - 0.5) * 4), 9)
					end
				end
				maybeYield()
			end
		end
	end

	-- open blocks + cells
	local openBlocks, cells = {}, {}
	for bx = 1, SIZE do
		for by = 1, SIZE do
			if not wall[bx][by] then
				openBlocks[#openBlocks + 1] = { bx, by }
				if bx % 2 == 0 and by % 2 == 0 then
					cells[#cells + 1] = { bx, by }
				end
			end
		end
	end
	self.openBlocks = openBlocks

	-- ground clutter
	for _ = 1, (detail == 1 and 80 or 200) do
		local b = openBlocks[deco:NextInteger(1, #openBlocks)]
		local p = self:bc(b[1], b[2]) + Vector3.new((deco:NextNumber() - 0.5) * 7, 0, (deco:NextNumber() - 0.5) * 7)
		local yaw = deco:NextNumber() * math.pi
		local col = Color3.fromRGB(70 + deco:NextInteger(0, 30), 78 + deco:NextInteger(0, 20), 36)
		for k = 0, 1 do
			part({ Name = "Tuft", Size = Vector3.new(0.05, 1.3 + deco:NextNumber() * 0.8, 0.9), CFrame = C(p + Vector3.new(0, 0.7, 0)) * A(0, yaw + k * 1.2, math.rad(deco:NextInteger(-12, 12))), Color = col, Material = Enum.Material.Grass }, props)
		end
		maybeYield()
	end
	for _ = 1, 70 do
		local b = openBlocks[deco:NextInteger(1, #openBlocks)]
		local p = self:bc(b[1], b[2]) + Vector3.new((deco:NextNumber() - 0.5) * 6, 0, (deco:NextNumber() - 0.5) * 6)
		part({ Name = "Husk", Size = Vector3.new(0.5, 0.05, 1.8), CFrame = C(p + Vector3.new(0, 0.15, 0)) * A(0, deco:NextNumber() * 6, 0), Color = Color3.fromRGB(110 + deco:NextInteger(0, 30), 100 + deco:NextInteger(0, 20), 50), Material = Enum.Material.Fabric }, props)
		local b2 = openBlocks[deco:NextInteger(1, #openBlocks)]
		local p2 = self:bc(b2[1], b2[2]) + Vector3.new((deco:NextNumber() - 0.5) * 6, 0, (deco:NextNumber() - 0.5) * 6)
		part({ Name = "Rock", Size = Vector3.new(0.8 + deco:NextNumber(), 0.5 + deco:NextNumber() * 0.5, 0.8 + deco:NextNumber()), CFrame = C(p2 + Vector3.new(0, 0.2, 0)) * A(0, deco:NextNumber() * 6, 0), Color = Color3.fromRGB(70, 70, 66), Material = Enum.Material.Slate }, props)
		maybeYield()
	end

	-- the camp
	local ctr = self:bc(4, 4)
	self.center = ctr
	local fl = self.flickers
	Props.campfire(props, ctr, fl)
	for i = 1, 4 do
		local a = 0.4 + i * 1.5
		Props.logSeat(props, ctr + Vector3.new(math.cos(a) * 5.6, 0, math.sin(a) * 5.6), -a - math.pi / 2)
	end
	Props.tent(props, ctr + Vector3.new(14, 0, -5), math.rad(20))
	Props.tent(props, ctr + Vector3.new(12, 0, 8), math.rad(-35))
	Props.scarecrow(props, ctr + Vector3.new(-6, 0, 17), math.rad(200))
	Props.signpost(props, ctr + Vector3.new(10, 0, -14), math.rad(180), "CORN FIELD\nFind the 3 symbols.\nDots = the order.\nThe gate is the way out.")
	Props.hay(props, ctr + Vector3.new(3, 0, 15), math.rad(10))
	Props.hay(props, ctr + Vector3.new(7, 0, 15.5), math.rad(-5))
	Props.hay(props, ctr + Vector3.new(-3, 0, -16), math.rad(80))
	Props.pumpkin(props, ctr + Vector3.new(4, 0, -12), 0, 2.4, true, fl)
	Props.pumpkin(props, ctr + Vector3.new(6.5, 0, -11), 1, 1.8, false)
	Props.lantern(props, ctr + Vector3.new(-17, 0, -17), 0, fl)
	Props.lantern(props, ctr + Vector3.new(17, 0, 17), math.rad(180), fl)
	Props.crates(props, ctr + Vector3.new(-15, 0, 8), math.rad(15))
	Props.barrel(props, ctr + Vector3.new(-12, 0, -14), true, fl)
	Props.wheelbarrow(props, ctr + Vector3.new(8, 0, 14), math.rad(40))
	Props.fence(props, ctr + Vector3.new(18, 0, 7), math.rad(90), 4)

	-- dead ends get creepy stuff
	for _, c in ipairs(cells) do
		local bx, by = c[1], c[2]
		if not (bx <= 8 and by <= 8) then
			local openCount = 0
			for _, d in ipairs(DIRS) do
				if self:isOpen(bx + d[1], by + d[2]) then
					openCount += 1
				end
			end
			local center = self:bc(bx, by)
			local roll = rng:NextNumber()
			local yaw = rng:NextNumber() * math.pi * 2
			if openCount == 1 then
				if roll < 0.18 then
					Props.pumpkin(props, center + Vector3.new(-1.5, 0, 1), yaw, 2.2, true, fl)
					Props.pumpkin(props, center + Vector3.new(1.5, 0, -1.2), yaw, 1.6, false)
				elseif roll < 0.34 then
					Props.hay(props, center + Vector3.new(0, 0, 2), yaw)
					Props.cross(props, center + Vector3.new(0, 0, -1.5), yaw)
				elseif roll < 0.5 then
					Props.scarecrow(props, center, yaw)
				elseif roll < 0.62 then
					Props.well(props, center)
				elseif roll < 0.74 then
					Props.crates(props, center + Vector3.new(-1, 0, -1), yaw)
				elseif roll < 0.86 then
					Props.barrel(props, center, true, fl)
				elseif roll < 0.94 then
					Props.wheelbarrow(props, center, yaw)
					Props.bones(props, center + Vector3.new(2, 0, 2), yaw)
				else
					Props.bones(props, center, yaw)
					Props.cross(props, center + Vector3.new(0, 0, -2), yaw)
				end
			elseif openCount >= 3 and roll < 0.14 then
				Props.lantern(props, center + Vector3.new(BS / 2 - 1.2, 0, BS / 2 - 1.2), yaw, fl)
			elseif openCount == 2 and roll < 0.05 then
				Props.scarecrow(props, center + Vector3.new(2, 0, 2), yaw)
			end
			maybeYield()
		end
	end

	-- outside the field: dead trees and an old barn
	local gc = self:bc(1, 4)
	self.gatePos = gc
	for _ = 1, (detail == 1 and 12 or 26) do
		for _ = 1, 10 do
			local x = deco:NextNumber() * (span + 240) - 120
			local z = deco:NextNumber() * (span + 240) - 120
			local inside = x > -18 and x < span + 18 and z > -18 and z < span + 18
			local onRoad = x < 6 and math.abs(z - (gc.Z - O.Z)) < 18
			local nearBarn = x > span + 30 and math.abs(z - span / 2) < 42
			if not inside and not onRoad and not nearBarn then
				Props.deadTree(props, O + Vector3.new(x, 0, z), 14 + deco:NextNumber() * 10, deco)
				break
			end
		end
		maybeYield()
	end
	Props.barn(props, O + Vector3.new(span + 62, 0, span / 2), 0)
	Props.fence(props, O + Vector3.new(span + 40, 0, span / 2 - 30), math.rad(90), 8)

	-- the 3 symbols
	local order = { "Circle", "Triangle", "Square" }
	for i = #order, 2, -1 do
		local j = rng:NextInteger(1, i)
		order[i], order[j] = order[j], order[i]
	end
	self.puzzle.order = order
	local distMap = bfs(wall, 4, 4)
	local candidates = {}
	for bx = 3, SIZE - 2 do
		for by = 3, SIZE - 2 do
			if wall[bx][by] and not (bx <= 8 and by <= 8) then
				local faces = {}
				for _, d in ipairs(DIRS) do
					local nx, ny = bx + d[1], by + d[2]
					if not wall[nx][ny] then
						faces[#faces + 1] = { d[1], d[2], distMap[key(nx, ny)] or 0 }
					end
				end
				if #faces > 0 then
					local f = faces[rng:NextInteger(1, #faces)]
					candidates[#candidates + 1] = { bx = bx, by = by, dx = f[1], dy = f[2], dist = f[3] }
				end
			end
		end
	end
	for i = #candidates, 2, -1 do
		local j = rng:NextInteger(1, i)
		candidates[i], candidates[j] = candidates[j], candidates[i]
	end
	local picks = {}
	for _, att in ipairs({ { 10, 14 }, { 7, 10 }, { 4, 6 }, { 0, 0 } }) do
		picks = {}
		for _, c in ipairs(candidates) do
			if #picks >= 3 then
				break
			end
			local ok = c.dist >= att[2]
			if ok then
				for _, p in ipairs(picks) do
					if math.abs(p.bx - c.bx) + math.abs(p.by - c.by) < att[1] then
						ok = false
						break
					end
				end
			end
			if ok then
				picks[#picks + 1] = c
			end
		end
		if #picks >= 3 then
			break
		end
	end
	self.symbolBlocks = {}
	for i, c in ipairs(picks) do
		self.symbolBlocks[key(c.bx, c.by)] = true
		local n = Vector3.new(c.dx, 0, c.dy)
		local fc = self:bc(c.bx, c.by) + n * (BS / 2)
		local s = 4
		local shapeName = order[i]
		local color = SHAPE_COLORS[shapeName]
		local yCenter = GY + 7
		local plankCF = CFrame.fromMatrix(Vector3.new(fc.X, yCenter, fc.Z) + n * 0.25, n, Vector3.new(0, 1, 0))
		local shapeCF = CFrame.fromMatrix(Vector3.new(fc.X, yCenter, fc.Z) + n * 0.6, n, Vector3.new(0, 1, 0))
		part({ Name = "SymbolPlank", Size = Vector3.new(0.5, s + 3.4, s + 2.4), CFrame = plankCF, Color = Color3.fromRGB(58, 40, 26), Material = Enum.Material.WoodPlanks }, props)
		for _, z in ipairs({ -(s + 2.4) / 2 + 0.3, (s + 2.4) / 2 - 0.3 }) do
			part({ Name = "Nail", Size = Vector3.new(0.2, 0.2, 0.2), CFrame = plankCF * C(0.3, (s + 3.4) / 2 - 0.4, z), Color = Color3.fromRGB(60, 60, 60), Material = Enum.Material.Metal }, props)
		end
		Props.shape(shapeName, shapeCF, s, color, 0.2, props)
		for k = 1, i do
			part({ Name = "Dot", Shape = Enum.PartType.Ball, Size = Vector3.new(0.7, 0.7, 0.7), CFrame = shapeCF * C(0.05, -s / 2 - 0.85, (k - (i + 1) / 2) * 1.2), Color = color, Material = Enum.Material.Neon }, props)
		end
		local lightPart = part({ Name = "SymbolLight", Size = Vector3.new(0.4, 0.4, 0.4), Position = Vector3.new(fc.X, yCenter, fc.Z) + n * 2.2, Transparency = 1 }, props)
		local light = make("PointLight", { Color = color, Range = 18, Brightness = 1.1 }, lightPart)
		Props.flicker(fl, light, 0.3)
	end

	-- the exit gate
	local gateParts = {}
	local gateRoots = {}
	for _, zSign in ipairs({ -1, 1 }) do
		local zc = gc.Z + zSign * 2.5
		local root = part({ Name = "GateRoot", Size = Vector3.new(0.4, 0.4, 0.4), Position = Vector3.new(gc.X, GY + 6, zc), Transparency = 1 }, folder)
		gateRoots[#gateRoots + 1] = { root = root, sign = zSign, base = root.CFrame }
		local list = {}
		for i = 1, 7 do
			list[#list + 1] = solid({ Name = "Bar", Size = Vector3.new(0.35, 11.5, 0.35), Position = Vector3.new(gc.X, GY + 5.75, zc + (i - 4) * 0.68), Color = Color3.fromRGB(26, 26, 28), Material = Enum.Material.Metal }, folder)
		end
		for _, y in ipairs({ 1.2, 5.6, 10.5 }) do
			list[#list + 1] = solid({ Name = "Rail", Size = Vector3.new(0.5, 0.45, 4.9), Position = Vector3.new(gc.X, GY + y, zc), Color = Color3.fromRGB(34, 30, 28), Material = Enum.Material.Metal }, folder)
		end
		for _, p in ipairs(list) do
			make("WeldConstraint", { Part0 = root, Part1 = p }, p)
			p.Anchored = false
			gateParts[#gateParts + 1] = p
		end
	end
	solid({ Name = "GatePost", Size = Vector3.new(1.2, 14, 1.2), Position = Vector3.new(gc.X, GY + 7, gc.Z - 5.2), Color = Color3.fromRGB(50, 36, 24), Material = Enum.Material.Wood }, folder)
	solid({ Name = "GatePost", Size = Vector3.new(1.2, 14, 1.2), Position = Vector3.new(gc.X, GY + 7, gc.Z + 5.2), Color = Color3.fromRGB(50, 36, 24), Material = Enum.Material.Wood }, folder)
	solid({ Name = "GateBeam", Size = Vector3.new(1.2, 1.4, BS + 1.6), Position = Vector3.new(gc.X, GY + 12.8, gc.Z), Color = Color3.fromRGB(50, 36, 24), Material = Enum.Material.Wood }, folder)
	local gateLamp = part({ Name = "GateLamp", Size = Vector3.new(0.6, 0.6, 3), Position = Vector3.new(gc.X + 0.9, GY + 12.2, gc.Z), Color = Color3.fromRGB(255, 40, 30), Material = Enum.Material.Neon }, folder)
	local gateLight = make("PointLight", { Color = Color3.fromRGB(255, 60, 40), Range = 28, Brightness = 1.6 }, gateLamp)
	self.gate = { roots = gateRoots, parts = gateParts, lamp = gateLamp, light = gateLight }

	-- the code panel next to the gate
	local panelX = O.X + BS + 0.3
	local panelZ = gc.Z - 9
	local slab = solid({ Name = "CodePanel", Size = Vector3.new(0.6, 4.6, 5), Position = Vector3.new(panelX, GY + 3.4, panelZ), Color = Color3.fromRGB(46, 34, 24), Material = Enum.Material.WoodPlanks }, folder)
	local gui = make("SurfaceGui", { Face = Enum.NormalId.Right, PixelsPerStud = 50, LightInfluence = 0 }, slab)
	make("TextLabel", { Size = UDim2.fromScale(1, 0.2), BackgroundTransparency = 1, Text = "ENTER THE ORDER", TextColor3 = Color3.fromRGB(215, 190, 130), Font = Enum.Font.Antique, TextScaled = true }, gui)
	make("TextLabel", { Position = UDim2.fromScale(0, 0.82), Size = UDim2.fromScale(1, 0.16), BackgroundTransparency = 1, Text = "1 dot  >  2 dots  >  3 dots", TextColor3 = Color3.fromRGB(170, 150, 110), Font = Enum.Font.Antique, TextScaled = true }, gui)
	solid({ Name = "PanelLeg", Size = Vector3.new(0.6, 1.2, 0.6), Position = Vector3.new(panelX, GY + 0.6, panelZ), Color = Color3.fromRGB(46, 34, 24), Material = Enum.Material.Wood }, folder)
	local lamps = {}
	local keys = { Enum.KeyCode.Q, Enum.KeyCode.E, Enum.KeyCode.R }
	for i, shapeName in ipairs(SHAPES) do
		local zz = panelZ - (i - 2) * 1.5
		local btnPos = Vector3.new(panelX + 0.5, GY + 3.2, zz)
		local hit = solid({ Name = "Button_" .. shapeName, Size = Vector3.new(0.4, 1.2, 1.2), Position = btnPos, Color = Color3.fromRGB(28, 22, 18), Material = Enum.Material.Metal }, folder)
		Props.shape(shapeName, CFrame.fromMatrix(btnPos + Vector3.new(0.3, 0, 0), Vector3.new(1, 0, 0), Vector3.new(0, 1, 0)), 0.8, SHAPE_COLORS[shapeName], 0.12, folder)
		lamps[i] = part({ Name = "Lamp", Shape = Enum.PartType.Ball, Size = Vector3.new(0.45, 0.45, 0.45), Position = Vector3.new(panelX + 0.5, GY + 4.6, zz), Color = Color3.fromRGB(90, 10, 10), Material = Enum.Material.Neon }, folder)
		local prompt = make("ProximityPrompt", {
			ActionText = "Press", ObjectText = shapeName, HoldDuration = 0, MaxActivationDistance = 9, RequiresLineOfSight = false,
			KeyboardKeyCode = keys[i], Exclusivity = Enum.ProximityPromptExclusivity.AlwaysShow,
		}, hit)
		prompt.Triggered:Connect(function(who)
			self:pressButton(who, shapeName)
		end)
	end
	self.lamps = lamps

	-- the road and the escape truck outside
	for i = 0, 6 do
		part({ Name = "Road", Size = Vector3.new(10, 0.2, 12), Position = Vector3.new(O.X - 5 - i * 10, GY + 0.05, gc.Z), Material = Enum.Material.Ground, Color = Color3.fromRGB(58, 52, 44) }, folder)
	end
	for _, zs in ipairs({ -7, 7 }) do
		solid({ Name = "RoadLampPole", Size = Vector3.new(0.4, 12, 0.4), Position = Vector3.new(O.X - 14, GY + 6, gc.Z + zs), Color = Color3.fromRGB(44, 40, 36), Material = Enum.Material.Metal }, folder)
		local bulb = part({ Name = "RoadLamp", Size = Vector3.new(1.2, 0.6, 1.2), Position = Vector3.new(O.X - 14, GY + 12.2, gc.Z + zs), Color = Color3.fromRGB(255, 235, 190), Material = Enum.Material.Neon }, folder)
		make("PointLight", { Color = Color3.fromRGB(255, 230, 180), Range = 44, Brightness = 2.2 }, bulb)
	end
	local truckCF = C(O.X - 32, GY, gc.Z) * A(0, math.pi, 0)
	local rust = Color3.fromRGB(128, 62, 34)
	local function truckPart(name, size, offset, color, material)
		return solid({ Name = name, Size = size, CFrame = truckCF * C(offset), Color = color, Material = material or Enum.Material.Metal }, folder)
	end
	truckPart("TruckChassis", Vector3.new(13, 1, 6), Vector3.new(0, 2.2, 0), Color3.fromRGB(34, 32, 30))
	truckPart("TruckCab", Vector3.new(5, 3.4, 5.8), Vector3.new(-3.2, 4.4, 0), rust)
	truckPart("TruckHood", Vector3.new(3.6, 1.8, 5.6), Vector3.new(-6.6, 3.5, 0), rust)
	truckPart("TruckWindshield", Vector3.new(0.2, 1.8, 4.6), Vector3.new(-5.7, 5.0, 0), Color3.fromRGB(120, 150, 160), Enum.Material.Glass)
	truckPart("BedL", Vector3.new(6.4, 1.8, 0.3), Vector3.new(3.8, 3.5, -2.9), rust)
	truckPart("BedR", Vector3.new(6.4, 1.8, 0.3), Vector3.new(3.8, 3.5, 2.9), rust)
	truckPart("BedBack", Vector3.new(0.3, 1.8, 6), Vector3.new(6.9, 3.5, 0), rust)
	for _, wx in ipairs({ -4.6, 4.6 }) do
		for _, wz in ipairs({ -3.2, 3.2 }) do
			part({ Name = "Wheel", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.9, 2.8, 2.8), CFrame = truckCF * C(wx, 1.4, wz) * A(0, math.rad(90), 0), Color = Color3.fromRGB(20, 20, 20) }, folder)
		end
	end
	for _, hz in ipairs({ -2, 2 }) do
		part({ Name = "Headlight", Size = Vector3.new(0.3, 0.8, 0.8), CFrame = truckCF * C(-8.5, 3.6, hz), Color = Color3.fromRGB(255, 250, 220), Material = Enum.Material.Neon }, folder)
		local from = truckCF:PointToWorldSpace(Vector3.new(-8.8, 3.6, hz))
		local to = truckCF:PointToWorldSpace(Vector3.new(-30, 3.0, hz))
		local lightPart = part({ Name = "HeadlightLight", Size = Vector3.new(0.2, 0.2, 0.2), CFrame = CFrame.lookAt(from, to), Transparency = 1 }, folder)
		make("SpotLight", { Face = Enum.NormalId.Front, Range = 60, Angle = 55, Brightness = 4, Color = Color3.fromRGB(255, 245, 210) }, lightPart)
	end

	-- spots in the corn the monster can hide in and burst out of
	local lurk = {}
	for bx = 1, SIZE do
		for by = 1, SIZE do
			if wall[bx][by] and not (bx == 1 and by == 4) and not self.symbolBlocks[key(bx, by)] then
				for _, d in ipairs(DIRS) do
					local ox, oy = bx + d[1], by + d[2]
					if self:isOpen(ox, oy) then
						lurk[#lurk + 1] = { bx = bx, by = by, ox = ox, oy = oy, dx = d[1], dy = d[2] }
					end
				end
			end
		end
	end
	self.lurk = lurk

	self.rayParams = RaycastParams.new()
	self.rayParams.FilterType = Enum.RaycastFilterType.Include
	self.rayParams.FilterDescendantsInstances = { blocks }
	self.overlap = OverlapParams.new()
	self.overlap.FilterType = Enum.RaycastFilterType.Include
	self.overlap.FilterDescendantsInstances = { stalks }
	self:finishBuild()
end

-- --------------------------------------------------------------------
-- puzzle + gate
-- --------------------------------------------------------------------
function Match:openGate()
	if self.puzzle.opened then
		return
	end
	self.puzzle.opened = true
	local g = self.gate
	g.lamp.Color = Color3.fromRGB(70, 255, 110)
	g.light.Color = Color3.fromRGB(70, 255, 110)
	playSound(CONFIG.Sounds.Ding, g.lamp, 2, 0.6, 200)
	for _, r in ipairs(g.roots) do
		local off = (g.axis == "X") and C(r.sign * 4.8, 0, 0) or C(0, 0, r.sign * 4.8)
		TweenService:Create(r.root, TweenInfo.new(3.2, Enum.EasingStyle.Sine), { CFrame = r.base * off }):Play()
	end
	task.delay(3.3, function()
		for _, p in ipairs(g.parts) do
			if p.Parent then
				p.CanCollide = false
			end
		end
	end)
	for plr, info in pairs(self.players) do
		if info.status == "alive" then
			if info.role == "survivor" then
				showMessage(plr, "The gate is opening... RUN!", 5, Color3.fromRGB(150, 255, 170))
			else
				showMessage(plr, "They opened the gate! Stop them!", 5, Color3.fromRGB(255, 150, 120))
			end
		end
	end
end

function Match:pressButton(plr, shapeName)
	local info = self.players[plr]
	if self.ended or not info or info.role ~= "survivor" or info.status ~= "alive" or self.puzzle.opened then
		return
	end
	local pz = self.puzzle
	local idx = #pz.input + 1
	pz.input[idx] = shapeName
	if pz.order[idx] == shapeName then
		self.lamps[idx].Color = Color3.fromRGB(70, 255, 110)
		playSound(CONFIG.Sounds.Ding, self.lamps[idx], 1, 1.2, 40)
		if idx >= 3 then
			self:openGate()
		end
	else
		pz.input = {}
		for _, l in ipairs(self.lamps) do
			l.Color = Color3.fromRGB(90, 10, 10)
		end
		playSound(CONFIG.Sounds.Ding, self.lamps[1], 1, 0.4, 40)
		showMessage(plr, "Wrong order... something heard that.", 4, Color3.fromRGB(255, 120, 110))
		self:alert(plr)
	end
end

-- --------------------------------------------------------------------
-- building the Nightmare farm
-- --------------------------------------------------------------------
function Match:buildNightmare()
	local O = self.origin
	local rng = Random.new(os.time() + self.slot * 17)
	local deco = Random.new(os.time() + self.slot * 31 + 7)
	local detail = math.clamp(CONFIG.CornDetail, 1, 3)
	local fl = self.flickers

	local folder = make("Folder", { Name = "Nightmare_" .. self.slot }, workspace)
	local blocks = make("Folder", { Name = "Blocks" }, folder)
	local stalks = make("Folder", { Name = "Stalks" }, folder)
	local props = make("Folder", { Name = "Props" }, folder)
	local colliders = make("Folder", { Name = "Colliders" }, folder)
	self.folder, self.blocks, self.stalks, self.props = folder, blocks, stalks, props

	local wall, wtype = genNightmare(rng)
	self.wall, self.wtype = wall, wtype
	local span = SIZE * BS
	local function W(x, y, z)
		return O + Vector3.new(x, y, z)
	end

	-- ground
	solid({ Name = "Ground", Size = Vector3.new(span + 320, 4, span + 320), Position = W(span / 2, -2, span / 2), Material = Enum.Material.Grass, Color = Color3.fromRGB(32, 40, 24) }, folder)
	part({ Name = "FarmDirt", Size = Vector3.new(105, 0.1, 105), Position = W(192.5, 0.04, 192.5), Material = Enum.Material.Ground, Color = Color3.fromRGB(70, 54, 38) }, folder)
	part({ Name = "YardDirt", Size = Vector3.new(80, 0.1, 80), Position = W(50, 0.04, 50), Material = Enum.Material.Ground, Color = Color3.fromRGB(66, 52, 36) }, folder)
	for _ = 1, 50 do
		local p = W(deco:NextNumber() * span, 0.1, deco:NextNumber() * span)
		part({ Name = "Mud", Size = Vector3.new(3 + deco:NextNumber() * 5, 0.05, 3 + deco:NextNumber() * 5), CFrame = C(p) * A(0, deco:NextNumber() * 6, 0), Material = Enum.Material.Mud, Color = Color3.fromRGB(50, 40, 28) }, folder)
	end

	-- corn patches
	local stemColors = { Color3.fromRGB(90, 100, 44), Color3.fromRGB(100, 106, 50), Color3.fromRGB(78, 90, 38) }
	local leafColors = { Color3.fromRGB(56, 78, 34), Color3.fromRGB(68, 88, 38), Color3.fromRGB(80, 92, 42) }
	local coreColors = { Color3.fromRGB(52, 68, 32), Color3.fromRGB(62, 78, 36), Color3.fromRGB(46, 60, 30) }
	local stalksPerFace = detail == 1 and 1 or 2
	local function addStalk(base, height)
		part({ Name = "Stem", Shape = Enum.PartType.Cylinder, Size = Vector3.new(height, 0.3, 0.3), CFrame = C(base + Vector3.new(0, height / 2, 0)) * A(0, 0, math.rad(90)), Color = stemColors[deco:NextInteger(1, #stemColors)], Material = Enum.Material.Wood }, stalks)
		for i = 1, 2 do
			local yaw = deco:NextNumber() * math.pi * 2
			part({ Name = "Leaf", Size = Vector3.new(2.6, 0.06, 0.55), CFrame = C(base.X, base.Y + height * (0.35 + 0.25 * i), base.Z) * A(0, yaw, 0) * C(1.2, 0, 0) * A(0, 0, -math.rad(28)), Color = leafColors[deco:NextInteger(1, #leafColors)], Material = Enum.Material.Grass }, stalks)
		end
		if deco:NextNumber() < 0.4 then
			part({ Name = "Ear", Size = Vector3.new(0.5, 1.5, 0.5), CFrame = C(base + Vector3.new(0.4, height * 0.55, 0)) * A(0, 0, math.rad(12)), Color = Color3.fromRGB(176, 146, 52), Material = Enum.Material.SmoothPlastic }, stalks)
		end
		maybeYield()
	end
	for bx = 1, SIZE do
		for by = 1, SIZE do
			if wall[bx][by] and wtype[bx][by] == "corn" then
				local exposed = bx == 1 or by == 1 or bx == SIZE or by == SIZE
				for _, d in ipairs(DIRS) do
					if self:isOpen(bx + d[1], by + d[2]) then
						exposed = true
					end
				end
				if exposed then
					local c = self:bc(bx, by)
					solid({ Name = "CornWall", Size = Vector3.new(BS, WALL_H, BS), Position = c + Vector3.new(0, WALL_H / 2, 0), Material = Enum.Material.Grass, Color = coreColors[deco:NextInteger(1, #coreColors)] }, blocks)
					for _, d in ipairs(DIRS) do
						if self:isOpen(bx + d[1], by + d[2]) then
							local n = Vector3.new(d[1], 0, d[2])
							local t = Vector3.new(-d[2], 0, d[1])
							for k = 1, stalksPerFace do
								local off = (k - (stalksPerFace + 1) / 2) * (BS / (stalksPerFace + 0.3)) + (deco:NextNumber() - 0.5) * 1.2
								addStalk(c + n * (BS / 2 + 0.5 + deco:NextNumber() * 0.5) + t * off, deco:NextNumber() * 4 + 11)
							end
						end
					end
				end
				maybeYield()
			end
		end
	end

	-- THE BARN (you start inside)
	local barnRed = Color3.fromRGB(110, 30, 24)
	local trim = Color3.fromRGB(200, 192, 176)
	self.barnBlocks = {}
	for bx = 3, 8 do
		for by = 3, 8 do
			if wtype[bx][by] == "barn" then
				self.barnBlocks[key(bx, by)] = solid({ Name = "BarnWall", Size = Vector3.new(BS, 18, BS), Position = self:bc(bx, by) + Vector3.new(0, 9, 0), Material = Enum.Material.WoodPlanks, Color = barnRed }, blocks)
			end
		end
	end
	for _, c in ipairs({ { 20, 20 }, { 80, 20 }, { 20, 80 }, { 80, 80 } }) do
		part({ Name = "BarnCorner", Size = Vector3.new(1.4, 18.4, 1.4), Position = W(c[1], 9.2, c[2]), Color = trim, Material = Enum.Material.Wood }, props)
	end
	for _, e in ipairs({ { 50, 19.8, 61, 0.6 }, { 50, 80.2, 61, 0.6 } }) do
		part({ Name = "BarnTrim", Size = Vector3.new(e[3], 0.8, e[4]), Position = W(e[1], 17.8, e[2]), Color = trim, Material = Enum.Material.Wood }, props)
	end
	for _, e in ipairs({ 19.8, 80.2 }) do
		part({ Name = "BarnTrim", Size = Vector3.new(0.6, 0.8, 61), Position = W(e, 17.8, 50), Color = trim, Material = Enum.Material.Wood }, props)
	end
	local roofColor = Color3.fromRGB(58, 52, 50)
	wedge({ Name = "BarnRoof", Size = Vector3.new(64, 12, 32), CFrame = C(W(50, 24, 34)), Color = roofColor, Material = Enum.Material.CorrodedMetal }, props)
	wedge({ Name = "BarnRoof", Size = Vector3.new(64, 12, 32), CFrame = C(W(50, 24, 66)) * A(0, math.pi, 0), Color = roofColor, Material = Enum.Material.CorrodedMetal }, props)
	part({ Name = "BarnFloor", Size = Vector3.new(40, 0.2, 40), Position = W(50, 0.1, 50), Material = Enum.Material.WoodPlanks, Color = Color3.fromRGB(70, 50, 32) }, props)
	for _ = 1, 40 do
		part({ Name = "Straw", Size = Vector3.new(0.08, 0.04, 1.2 + deco:NextNumber()), CFrame = C(W(31 + deco:NextNumber() * 38, 0.22, 31 + deco:NextNumber() * 38)) * A(0, deco:NextNumber() * 6, 0), Color = Color3.fromRGB(196, 170, 90), Material = Enum.Material.Fabric }, props)
	end
	-- chained barn doors (north wall), inside and outside
	for _, side in ipairs({ { z = 30.3, s = 1 }, { z = 19.7, s = -1 } }) do
		for _, x in ipairs({ 45, 55 }) do
			part({ Name = "BarnDoor", Size = Vector3.new(9.6, 12, 0.4), Position = W(x, 6, side.z), Color = Color3.fromRGB(90, 24, 20), Material = Enum.Material.WoodPlanks }, props)
			part({ Name = "DoorBrace", Size = Vector3.new(0.6, 15, 0.45), CFrame = C(W(x, 6, side.z + side.s * 0.05)) * A(0, 0, math.atan2(9.6, 12)), Color = trim, Material = Enum.Material.Wood }, props)
		end
		for i = -5, 5 do
			part({ Name = "ChainLink", Size = Vector3.new(0.6, 0.18, 0.18), CFrame = C(W(50 + i * 0.55, 6 + math.cos(i * 0.3) * 0.3, side.z + side.s * 0.35)) * A(i % 2 == 0 and math.rad(90) or 0, 0, 0), Color = Color3.fromRGB(80, 80, 82), Material = Enum.Material.Metal }, props)
		end
		part({ Name = "Padlock", Size = Vector3.new(0.9, 1.1, 0.4), Position = W(50, 5.4, side.z + side.s * 0.5), Color = Color3.fromRGB(60, 60, 60), Material = Enum.Material.Metal }, props)
	end
	local doorHint = part({ Name = "DoorHint", Size = Vector3.new(4, 4, 1), Position = W(50, 5, 31), Transparency = 1 }, props)
	local doorPrompt = make("ProximityPrompt", { ActionText = "Open", ObjectText = "Barn Doors", HoldDuration = 0.4, MaxActivationDistance = 8, RequiresLineOfSight = false }, doorHint)
	doorPrompt.Triggered:Connect(function(plr)
		showMessage(plr, "The doors are chained shut... find another way out.", 4, Color3.fromRGB(255, 190, 140))
	end)
	-- writing on the wall
	local writing = part({ Name = "Writing", Size = Vector3.new(30, 3, 0.1), Position = W(50, 15, 30.25), Transparency = 1 }, props)
	surfaceText(writing, Enum.NormalId.Back, "HE COMES FROM THE GROUND", Color3.fromRGB(140, 10, 10), Enum.Font.Antique)
	-- stalls with hay and a dead cow
	for _, z in ipairs({ 34, 42, 50, 58, 66 }) do
		part({ Name = "StallWall", Size = Vector3.new(8, 4.5, 0.4), Position = W(34, 2.25, z), Color = Color3.fromRGB(86, 62, 40), Material = Enum.Material.WoodPlanks }, props)
		part({ Name = "StallPost", Size = Vector3.new(0.6, 6, 0.6), Position = W(38, 3, z), Color = Color3.fromRGB(70, 50, 30), Material = Enum.Material.Wood }, props)
	end
	Props.hay(props, W(33, 0, 38), 0.2)
	Props.hay(props, W(33, 0, 54), -0.1)
	Props.hay(props, W(33, 2.2, 54), 0.4)
	Props.deadCow(props, W(33.5, 0, 46), math.rad(90))
	Props.blood(props, W(40, 0, 44), 2.4)
	Props.blood(props, W(44, 0, 42), 1.6)
	-- the hay loft (climb the ladder)
	solid({ Name = "Loft", Size = Vector3.new(40, 0.8, 8), Position = W(50, 9, 66), Color = Color3.fromRGB(80, 58, 36), Material = Enum.Material.WoodPlanks }, props)
	for _, x in ipairs({ 32, 50, 68 }) do
		part({ Name = "LoftPost", Size = Vector3.new(0.7, 9, 0.7), Position = W(x, 4.5, 62.5), Color = Color3.fromRGB(70, 50, 30), Material = Enum.Material.Wood }, props)
	end
	part({ Name = "LoftRail", Size = Vector3.new(40, 0.3, 0.3), Position = W(50, 11.5, 62.2), Color = Color3.fromRGB(70, 50, 30), Material = Enum.Material.Wood }, props)
	local ladder = make("TrussPart", { Name = "Ladder", Anchored = true, Size = Vector3.new(2, 10, 2), Position = W(42, 5, 61), Color = Color3.fromRGB(96, 70, 44), Material = Enum.Material.Wood, Style = Enum.Style.NoSupports }, props)
	ladder.CanCollide = true
	Props.hay(props, W(56, 9.4, 66), 0)
	Props.hay(props, W(61, 9.4, 66.5), 0.3)
	Props.crates(props, W(36, 9.4, 66), 0.2)
	-- lanterns, tools, cart
	Props.hangingLantern(props, W(45, 12, 45), fl)
	Props.hangingLantern(props, W(58, 12, 55), fl)
	Props.wheelbarrow(props, W(60, 0, 58), math.rad(30))
	Props.crates(props, W(62, 0, 34), 0.5)
	part({ Name = "ToolRack", Size = Vector3.new(0.3, 4, 6), Position = W(69.7, 4, 56), Color = Color3.fromRGB(70, 50, 30), Material = Enum.Material.Wood }, props)
	for i = 1, 2 do
		part({ Name = "RackFork", Size = Vector3.new(0.18, 6, 0.18), CFrame = C(W(69.4, 4.5, 54 + i * 1.6)) * A(0, 0, 0.06), Color = Color3.fromRGB(96, 70, 44), Material = Enum.Material.Wood }, props)
		part({ Name = "RackTines", Size = Vector3.new(0.12, 1.2, 1.2), Position = W(69.4, 8, 54 + i * 1.6), Color = Color3.fromRGB(70, 70, 72), Material = Enum.Material.Metal }, props)
	end
	-- the loose boards on the east wall (the way out)
	local boards = make("Folder", { Name = "LooseBoards" }, props)
	for i = 0, 4 do
		local z = 41 + i * 2
		part({ Name = "LooseBoard", Size = Vector3.new(0.3, 7.5, 1.7), CFrame = C(W(69.75, 3.75, z)) * A(0, 0, (i % 2 == 0 and 1 or -1) * 0.03), Color = Color3.fromRGB(96, 34, 26), Material = Enum.Material.WoodPlanks }, boards)
		if i < 4 then
			part({ Name = "Moonlight", Size = Vector3.new(0.05, 6, 0.12), Position = W(69.6, 3.6, z + 1), Color = Color3.fromRGB(150, 170, 220), Material = Enum.Material.Neon }, boards)
		end
	end
	Props.hay(props, W(67, 0, 40.5), math.rad(90))
	Props.hay(props, W(67, 0, 49.5), math.rad(90))
	Props.hay(props, W(67, 2.2, 49.5), math.rad(95))
	local boardHit = part({ Name = "BoardHit", Size = Vector3.new(1, 6, 8), Position = W(69, 3.5, 45), Transparency = 1 }, boards)
	local boardPrompt = make("ProximityPrompt", { ActionText = "Pry loose", ObjectText = "Loose Boards", HoldDuration = 2.5, MaxActivationDistance = 8, RequiresLineOfSight = false }, boardHit)
	boardPrompt.Triggered:Connect(function(plr)
		self:openBarn(plr)
	end)
	self.boards = boards

	-- FENCE around the farm
	local fenceWood = Color3.fromRGB(88, 76, 62)
	for bx = 14, SIZE - 1 do
		for by = 14, SIZE - 1 do
			if wtype[bx][by] == "fence" then
				local c = self:bc(bx, by)
				local dirs = {}
				if bx == 14 then
					dirs[#dirs + 1] = Vector3.new(0, 0, 1)
				end
				if by == 14 then
					dirs[#dirs + 1] = Vector3.new(1, 0, 0)
				end
				for _, dir in ipairs(dirs) do
					local alongZ = dir.Z ~= 0
					for i = -4, 4 do
						local h = 7 + deco:NextNumber() * 1.2
						part({ Name = "Picket", Size = alongZ and Vector3.new(0.35, h, 1) or Vector3.new(1, h, 0.35), CFrame = C(c + dir * (i * 1.1) + Vector3.new(0, h / 2, 0)) * A(0, 0, (deco:NextNumber() - 0.5) * 0.06), Color = fenceWood, Material = Enum.Material.WoodPlanks }, props)
					end
					for _, y in ipairs({ 2, 5.5 }) do
						part({ Name = "FenceRail", Size = alongZ and Vector3.new(0.3, 0.4, BS) or Vector3.new(BS, 0.4, 0.3), Position = c + Vector3.new(0, y, 0) + (alongZ and Vector3.new(0.3, 0, 0) or Vector3.new(0, 0, 0.3)), Color = Color3.fromRGB(70, 60, 48), Material = Enum.Material.Wood }, props)
					end
					part({ Name = "BarbedWire", Size = alongZ and Vector3.new(0.06, 0.06, BS) or Vector3.new(BS, 0.06, 0.06), Position = c + Vector3.new(0, 8.6, 0), Color = Color3.fromRGB(60, 60, 60), Material = Enum.Material.Metal }, props)
					solid({ Name = "FenceCollider", Size = alongZ and Vector3.new(1.6, 12, BS) or Vector3.new(BS, 12, 1.6), Position = c + Vector3.new(0, 6, 0), Transparency = 1, CanQuery = false }, colliders)
				end
				maybeYield()
			end
		end
	end
	Props.signpost(props, self:bc(13, 18) + Vector3.new(-2, 0, 0), math.rad(-90), "PRIVATE PROPERTY\nKEEP OUT\nTRESPASSERS WILL BE\nDEALT WITH")
	Props.signpost(props, self:bc(18, 13) + Vector3.new(0, 0, -2), math.rad(180), "KEEP OUT")

	-- THE FARMHOUSE
	local hcf = C(W(205, 0, 205)) * A(0, math.pi / 2, 0) -- front faces the farm (-X)
	local siding = Color3.fromRGB(132, 122, 104)
	lp(props, hcf, "Foundation", Vector3.new(31, 1, 31), C(0, 0.5, 0), Color3.fromRGB(80, 78, 74), Enum.Material.Cobblestone)
	local houseBody = lp(blocks, hcf, "House", Vector3.new(30, 14, 30), C(0, 7.5, 0), siding, Enum.Material.WoodPlanks, { CanCollide = true, CanQuery = true })
	houseBody.Name = "Farmhouse"
	wedge({ Name = "HouseRoof", Size = Vector3.new(32, 9, 16), CFrame = hcf * C(0, 19, -8), Color = Color3.fromRGB(50, 40, 36), Material = Enum.Material.Slate }, props)
	wedge({ Name = "HouseRoof", Size = Vector3.new(32, 9, 16), CFrame = hcf * C(0, 19, 8) * A(0, math.pi, 0), Color = Color3.fromRGB(50, 40, 36), Material = Enum.Material.Slate }, props)
	lp(props, hcf, "Chimney", Vector3.new(3, 12, 3), C(9, 20, 4), Color3.fromRGB(110, 50, 40), Enum.Material.Brick)
	for _, wp in ipairs({ { -8, 4.5 }, { 8, 4.5 }, { -8, 11 }, { 0, 11 }, { 8, 11 } }) do
		lp(props, hcf, "WindowFrame", Vector3.new(4.4, 4.4, 0.3), C(wp[1], wp[2] + 0.5, -15.1), Color3.fromRGB(200, 196, 186), Enum.Material.Wood)
		local glass = lp(props, hcf, "Window", Vector3.new(3.6, 3.6, 0.2), C(wp[1], wp[2] + 0.5, -15.25), Color3.fromRGB(150, 110, 50), Enum.Material.Neon, { Transparency = 0.35 })
		lp(props, hcf, "Mullion", Vector3.new(0.2, 3.6, 0.1), C(wp[1], wp[2] + 0.5, -15.37), Color3.fromRGB(40, 30, 20), Enum.Material.Wood)
		if wp[2] < 5 then
			make("PointLight", { Color = Color3.fromRGB(255, 170, 80), Range = 12, Brightness = 0.6 }, glass)
		end
	end
	lp(props, hcf, "FrontDoor", Vector3.new(4, 7.5, 0.3), C(0, 4.75, -15.15), Color3.fromRGB(50, 30, 20), Enum.Material.WoodPlanks)
	lp(props, hcf, "HandPrint", Vector3.new(0.8, 0.9, 0.05), C(0.8, 5.5, -15.32) * A(0, 0, 0.3), Color3.fromRGB(110, 8, 8), Enum.Material.SmoothPlastic)
	lp(props, hcf, "Porch", Vector3.new(30, 0.6, 6), C(0, 1.1, -18), Color3.fromRGB(90, 70, 50), Enum.Material.WoodPlanks, { CanCollide = true })
	for _, x in ipairs({ -14, -5, 5, 14 }) do
		lp(props, hcf, "PorchPost", Vector3.new(0.6, 8, 0.6), C(x, 5, -20.6), Color3.fromRGB(190, 186, 176), Enum.Material.Wood)
	end
	lp(props, hcf, "PorchRoof", Vector3.new(31, 0.5, 7), C(0, 9.2, -18.2) * A(-0.12, 0, 0), Color3.fromRGB(50, 40, 36), Enum.Material.Slate)
	local porchBulb = lp(props, hcf, "PorchLight", Vector3.new(0.6, 0.8, 0.6), C(3, 8.2, -15.6), Color3.fromRGB(255, 200, 120), Enum.Material.Neon)
	local porchL = make("PointLight", { Color = Color3.fromRGB(255, 180, 100), Range = 26, Brightness = 1.4, Shadows = true }, porchBulb)
	Props.flicker(fl, porchL, 0.5)
	lp(props, hcf, "RockingChair", Vector3.new(2, 0.4, 2), C(-8, 2.6, -17.6), Color3.fromRGB(70, 50, 34), Enum.Material.Wood)
	lp(props, hcf, "ChairBack", Vector3.new(2, 3, 0.3), C(-8, 4, -16.6) * A(0.2, 0, 0), Color3.fromRGB(70, 50, 34), Enum.Material.Wood)

	-- THE SHED with the phone
	local sc = self:bc(20, 5)
	solid({ Name = "Shed", Size = Vector3.new(9, 9, 9), Position = sc + Vector3.new(0, 4.5, 0), Color = Color3.fromRGB(70, 56, 44), Material = Enum.Material.WoodPlanks }, blocks)
	wedge({ Name = "ShedRoof", Size = Vector3.new(10, 2.4, 10), CFrame = C(sc + Vector3.new(0, 10.2, 0)) * A(0, math.pi / 2, 0), Color = Color3.fromRGB(60, 58, 56), Material = Enum.Material.CorrodedMetal }, props)
	part({ Name = "ShedDoor", Size = Vector3.new(0.2, 7, 3.6), Position = sc + Vector3.new(4.55, 3.5, 0), Color = Color3.fromRGB(50, 40, 30), Material = Enum.Material.WoodPlanks }, props)
	local phoneBox = part({ Name = "Phone", Size = Vector3.new(0.4, 1.6, 1), Position = sc + Vector3.new(-4.7, 4.6, 0), Color = Color3.fromRGB(200, 186, 150), Material = Enum.Material.SmoothPlastic }, props)
	part({ Name = "Handset", Size = Vector3.new(0.3, 1.3, 0.3), Position = sc + Vector3.new(-4.95, 4.7, 0.6), Color = Color3.fromRGB(30, 30, 30), Material = Enum.Material.SmoothPlastic }, props)
	part({ Name = "Cord", Size = Vector3.new(0.08, 1.4, 0.08), CFrame = C(sc + Vector3.new(-4.95, 3.6, 0.45)) * A(0.2, 0, 0), Color = Color3.fromRGB(30, 30, 30), Material = Enum.Material.Fabric }, props)
	part({ Name = "Dial", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.1, 0.6, 0.6), Position = sc + Vector3.new(-4.92, 4.9, -0.1), Color = Color3.fromRGB(40, 40, 40), Material = Enum.Material.Metal }, props)
	local phoneBulb = part({ Name = "ShedBulb", Size = Vector3.new(0.5, 0.6, 0.5), Position = sc + Vector3.new(-5, 7.8, 0), Color = Color3.fromRGB(255, 220, 160), Material = Enum.Material.Neon }, props)
	Props.flicker(fl, make("PointLight", { Color = Color3.fromRGB(255, 210, 150), Range = 16, Brightness = 1 }, phoneBulb), 0.5)
	local phoneSign = part({ Name = "PhoneSign", Size = Vector3.new(0.2, 1, 3), Position = sc + Vector3.new(-4.6, 6.6, 0), Color = Color3.fromRGB(30, 24, 18), Material = Enum.Material.Wood }, props)
	surfaceText(phoneSign, Enum.NormalId.Left, "PHONE", Color3.fromRGB(230, 220, 190))
	local phonePrompt = make("ProximityPrompt", { ActionText = "Call the police", ObjectText = "Phone", HoldDuration = 1.5, MaxActivationDistance = 8, RequiresLineOfSight = false }, phoneBox)
	phonePrompt.Triggered:Connect(function(plr)
		self:callPolice(plr)
	end)

	-- THE EXIT GATE (needs the rusty key)
	local gc = self:bc(13, SIZE)
	self.gatePos = gc
	local gateParts, gateRoots = {}, {}
	for _, xSign in ipairs({ -1, 1 }) do
		local xc = gc.X + xSign * 2.5
		local root = part({ Name = "GateRoot", Size = Vector3.new(0.4, 0.4, 0.4), Position = Vector3.new(xc, 6, gc.Z), Transparency = 1 }, folder)
		gateRoots[#gateRoots + 1] = { root = root, sign = xSign, base = root.CFrame }
		local list = {}
		for i = 1, 7 do
			list[#list + 1] = solid({ Name = "Bar", Size = Vector3.new(0.35, 11.5, 0.35), Position = Vector3.new(xc + (i - 4) * 0.68, 5.75, gc.Z), Color = Color3.fromRGB(56, 40, 26), Material = Enum.Material.CorrodedMetal }, folder)
		end
		for _, y in ipairs({ 1.2, 5.6, 10.5 }) do
			list[#list + 1] = solid({ Name = "Rail", Size = Vector3.new(4.9, 0.45, 0.5), Position = Vector3.new(xc, y, gc.Z), Color = Color3.fromRGB(50, 36, 24), Material = Enum.Material.CorrodedMetal }, folder)
		end
		for _, p in ipairs(list) do
			make("WeldConstraint", { Part0 = root, Part1 = p }, p)
			p.Anchored = false
			gateParts[#gateParts + 1] = p
		end
	end
	for _, xs in ipairs({ -5.2, 5.2 }) do
		solid({ Name = "GatePost", Size = Vector3.new(1.2, 14, 1.2), Position = Vector3.new(gc.X + xs, 7, gc.Z), Color = Color3.fromRGB(50, 36, 24), Material = Enum.Material.Wood }, folder)
	end
	local chain = {}
	for i = -3, 3 do
		chain[#chain + 1] = part({ Name = "GateChain", Size = Vector3.new(0.5, 0.16, 0.16), CFrame = C(Vector3.new(gc.X + i * 0.45, 5.6, gc.Z - 0.4)) * A(i % 2 == 0 and math.rad(90) or 0, 0, 0), Color = Color3.fromRGB(80, 80, 82), Material = Enum.Material.Metal }, folder)
	end
	local lock = part({ Name = "GatePadlock", Size = Vector3.new(0.9, 1.1, 0.4), Position = Vector3.new(gc.X, 5, gc.Z - 0.6), Color = Color3.fromRGB(150, 120, 40), Material = Enum.Material.CorrodedMetal }, folder)
	chain[#chain + 1] = lock
	local gateLamp = part({ Name = "GateLamp", Size = Vector3.new(3, 0.6, 0.6), Position = Vector3.new(gc.X, 12.4, gc.Z - 0.9), Color = Color3.fromRGB(255, 40, 30), Material = Enum.Material.Neon }, folder)
	local gateLight = make("PointLight", { Color = Color3.fromRGB(255, 60, 40), Range = 26, Brightness = 1.5 }, gateLamp)
	solid({ Name = "GateBeam", Size = Vector3.new(BS + 1.6, 1.4, 1.2), Position = Vector3.new(gc.X, 13, gc.Z), Color = Color3.fromRGB(50, 36, 24), Material = Enum.Material.Wood }, folder)
	self.gate = { roots = gateRoots, parts = gateParts, lamp = gateLamp, light = gateLight, chain = chain, axis = "X" }
	local lockPrompt = make("ProximityPrompt", { ActionText = "Unlock", ObjectText = "Gate (needs the rusty key)", HoldDuration = 1, MaxActivationDistance = 8, RequiresLineOfSight = false }, lock)
	lockPrompt.Triggered:Connect(function(plr)
		self:unlockGate(plr)
	end)
	self.lockPrompt = lockPrompt

	-- the road outside, and invisible walls so nobody wanders off
	for i = -16, 40 do
		part({ Name = "Road", Size = Vector3.new(10, 0.2, 14), Position = W(i * 10, 0.08, span + 16), Material = Enum.Material.Asphalt, Color = Color3.fromRGB(40, 40, 42) }, folder)
		if i % 3 == 0 then
			part({ Name = "RoadLine", Size = Vector3.new(4, 0.05, 0.4), Position = W(i * 10, 0.2, span + 16), Material = Enum.Material.SmoothPlastic, Color = Color3.fromRGB(200, 180, 60) }, folder)
		end
	end
	part({ Name = "Path", Size = Vector3.new(8, 0.15, 10), Position = W(gc.X - O.X, 0.06, span + 4), Material = Enum.Material.Ground, Color = Color3.fromRGB(70, 56, 40) }, folder)
	for _, xo in ipairs({ -30, 30 }) do
		solid({ Name = "RoadLampPole", Size = Vector3.new(0.4, 12, 0.4), Position = Vector3.new(gc.X + xo, 6, O.Z + span + 8), Color = Color3.fromRGB(44, 40, 36), Material = Enum.Material.Metal }, folder)
		local bulb = part({ Name = "RoadLamp", Size = Vector3.new(1.2, 0.6, 1.2), Position = Vector3.new(gc.X + xo, 12.2, O.Z + span + 8), Color = Color3.fromRGB(255, 235, 190), Material = Enum.Material.Neon }, folder)
		Props.flicker(fl, make("PointLight", { Color = Color3.fromRGB(255, 230, 180), Range = 40, Brightness = 2 }, bulb), 0.2)
	end
	solid({ Name = "Boundary", Size = Vector3.new(span + 340, 40, 2), Position = W(span / 2, 20, span + 34), Transparency = 1, CanQuery = false }, folder)
	solid({ Name = "Boundary", Size = Vector3.new(2, 40, 36), Position = W(-170, 20, span + 17), Transparency = 1, CanQuery = false }, folder)
	solid({ Name = "Boundary", Size = Vector3.new(2, 40, 36), Position = W(span + 170, 20, span + 17), Transparency = 1, CanQuery = false }, folder)

	-- the police car waits far down the road until someone calls
	local carStart = C(W(-150, 0, span + 16)) * A(0, -math.pi / 2, 0) -- faces +X
	local car = Props.policeCar(folder, carStart)
	self.police = { state = "none", car = car, start = carStart, stop = C(Vector3.new(gc.X, 0, O.Z + span + 16)) * A(0, -math.pi / 2, 0), lightT = 0, flip = false }
	car.red.Material, car.blue.Material = Enum.Material.SmoothPlastic, Enum.Material.SmoothPlastic
	car.redL.Enabled, car.blueL.Enabled = false, false
	local carPrompt = make("ProximityPrompt", { ActionText = "Get in", ObjectText = "Police Car", HoldDuration = 0.4, MaxActivationDistance = 10, RequiresLineOfSight = false, Enabled = false }, car.doorHit)
	carPrompt.Triggered:Connect(function(plr)
		self:enterCar(plr)
	end)
	self.carPrompt = carPrompt

	-- the farm: dead animals, the rusty key, junk
	local farmBlocks = {}
	for bx = 15, SIZE - 1 do
		for by = 15, SIZE - 1 do
			if not wall[bx][by] and not (bx >= 19 and bx <= 23 and by >= 19 and by <= 23) then
				farmBlocks[#farmBlocks + 1] = { bx, by }
			end
		end
	end
	for i = #farmBlocks, 2, -1 do
		local j = rng:NextInteger(1, i)
		farmBlocks[i], farmBlocks[j] = farmBlocks[j], farmBlocks[i]
	end
	self.farmBlocks = farmBlocks
	local keyBlock
	for _, b in ipairs(farmBlocks) do
		if (b[1] >= 17 or b[2] >= 17) and not (b[1] <= 16 and b[2] == 19) and not (b[2] <= 16 and b[1] == 19) then
			keyBlock = b
			break
		end
	end
	keyBlock = keyBlock or farmBlocks[1]
	self.keyHome = self:bc(keyBlock[1], keyBlock[2]) + Vector3.new(1.5, 0, -1.5)
	self:spawnKey(self.keyHome)
	Props.crates(props, self:bc(keyBlock[1], keyBlock[2]) + Vector3.new(-2, 0, 2), rng:NextNumber() * 6)
	local animals = { Props.deadCow, Props.deadPig, Props.deadChicken, Props.deadSheep, Props.deadCow, Props.deadPig, Props.deadChicken, Props.deadSheep, Props.deadCow }
	for i, fn in ipairs(animals) do
		local b = farmBlocks[i + 1]
		if b and b ~= keyBlock then
			fn(props, self:bc(b[1], b[2]) + Vector3.new(rng:NextNumber() * 4 - 2, 0, rng:NextNumber() * 4 - 2), rng:NextNumber() * 6)
		end
		maybeYield()
	end
	Props.deadChicken(props, W(66, 0, 88), 1)
	Props.deadPig(props, W(92, 0, 30), 2)
	Props.tractor(props, self:bc(16, 22), math.rad(30))
	Props.trough(props, self:bc(17, 17) + Vector3.new(0, 0, 3), 0)
	Props.choppingBlock(props, self:bc(18, 20), 0.4)
	Props.scarecrow(props, self:bc(23, 16), math.rad(210))
	Props.hay(props, self:bc(16, 18), 0.7)
	Props.well(props, self:bc(23, 23))
	for _, b in ipairs({ { 16, 16 }, { 22, 17 }, { 16, 23 } }) do
		Props.lantern(props, self:bc(b[1], b[2]) + Vector3.new(3, 0, 3), 0, fl)
	end
	-- the rest of the map
	Props.signpost(props, self:bc(12, 12) + Vector3.new(2, 0, 2), math.rad(225), "FARM: SOUTH-EAST\nSHED + PHONE: EAST\nROAD + GATE: SOUTH")
	Props.lantern(props, self:bc(12, 12) - Vector3.new(3, 0, 3), 0, fl)
	Props.lantern(props, self:bc(10, 5), 0, fl)
	Props.lantern(props, self:bc(13, SIZE - 1) + Vector3.new(3, 0, 0), 0, fl)
	for _ = 1, 10 do
		local b = self:randomOpen(rng)
		if b and not self:inBarnBlock(b[1], b[2]) then
			local roll = rng:NextNumber()
			local p = self:bc(b[1], b[2])
			if roll < 0.3 then
				Props.scarecrow(props, p, rng:NextNumber() * 6)
			elseif roll < 0.55 then
				Props.cross(props, p, rng:NextNumber() * 6)
			elseif roll < 0.8 then
				Props.pumpkin(props, p, rng:NextNumber() * 6, 2.2, true, fl)
			else
				Props.bones(props, p, rng:NextNumber() * 6)
			end
		end
	end
	for _ = 1, (detail == 1 and 10 or 22) do
		local x = deco:NextNumber() * (span + 240) - 120
		local z = deco:NextNumber() * (span - 20) - 120
		if not (x > -18 and x < span + 18 and z > -18) then
			Props.deadTree(props, W(x, 0, z), 14 + deco:NextNumber() * 10, deco)
		end
	end

	self.center = W(50, 0, 50)
	self:finishBuild()
end

function Match:randomOpen(rng)
	for _ = 1, 40 do
		local bx, by = rng:NextInteger(2, SIZE - 1), rng:NextInteger(2, SIZE - 1)
		if self:isOpen(bx, by) then
			return { bx, by }
		end
	end
	return nil
end

-- shared at the end of both builds
function Match:finishBuild()
	local open = {}
	for bx = 1, SIZE do
		for by = 1, SIZE do
			if not self.wall[bx][by] then
				open[#open + 1] = { bx, by }
			end
		end
	end
	self.openBlocks = open
	self.holeFolder = make("Folder", { Name = "Holes" }, self.folder)
	self.rayParams = RaycastParams.new()
	self.rayParams.FilterType = Enum.RaycastFilterType.Include
	self.rayParams.FilterDescendantsInstances = { self.blocks }
	self.overlap = OverlapParams.new()
	self.overlap.FilterType = Enum.RaycastFilterType.Include
	self.overlap.FilterDescendantsInstances = { self.stalks }
end

-- --------------------------------------------------------------------
-- Nightmare objectives: barn, key, phone, gate, police car
-- --------------------------------------------------------------------
function Match:openBarn(plr)
	if self.barnOpen or self.ended then
		return
	end
	local info = self.players[plr]
	if not info or info.status ~= "alive" then
		return
	end
	self.barnOpen = true
	local bx, by = 8, 5
	local old = self.barnBlocks[key(bx, by)]
	if old then
		old:Destroy()
	end
	local c = self:bc(bx, by)
	solid({ Name = "BarnWall", Size = Vector3.new(BS, 10, BS), Position = c + Vector3.new(0, 13, 0), Material = Enum.Material.WoodPlanks, Color = Color3.fromRGB(110, 30, 24) }, self.blocks)
	self.wall[bx][by] = false
	self.wtype[bx][by] = "floor"
	if self.boards then
		self.boards:Destroy()
	end
	for i = 1, 7 do
		part({ Name = "BrokenBoard", Size = Vector3.new(0.3, 3 + math.random() * 3, 1.6), CFrame = C(c + Vector3.new(-6 + math.random() * 14, 0.3, (math.random() - 0.5) * 7)) * A(math.rad(90), math.random() * 6, 0), Color = Color3.fromRGB(96, 34, 26), Material = Enum.Material.WoodPlanks }, self.props)
	end
	playSound(CONFIG.Sounds.Stab, self.holeFolder, 2, 0.4, 80)
	self:burst(c + Vector3.new(-4, 4, 0), Color3.fromRGB(110, 80, 50))
	for p, i2 in pairs(self.players) do
		if i2.status == "alive" then
			if i2.role == "survivor" then
				showMessage(p, plr.DisplayName .. " broke the boards! Find the rusty key in the farm and call the police.", 6, Color3.fromRGB(150, 255, 170))
			else
				showMessage(p, "They got out of the barn...", 4, Color3.fromRGB(190, 255, 120))
			end
		end
	end
end

function Match:spawnKey(pos)
	if self.keyModel then
		self.keyModel:Destroy()
	end
	local model, hit = Props.rustyKey(self.props, Vector3.new(pos.X, self.origin.Y, pos.Z))
	self.keyModel = model
	local prompt = make("ProximityPrompt", { ActionText = "Take", ObjectText = "Rusty Yellow Key", HoldDuration = 0.5, MaxActivationDistance = 8, RequiresLineOfSight = false }, hit)
	prompt.Triggered:Connect(function(plr)
		local info = self.players[plr]
		if self.keyHolder or not info or info.role ~= "survivor" or info.status ~= "alive" then
			return
		end
		self.keyHolder = plr
		if self.keyModel then
			self.keyModel:Destroy()
			self.keyModel = nil
		end
		playSound(CONFIG.Sounds.Ding, PS[plr].hrp, 1, 1.5, 30)
		self:broadcast(plr.DisplayName .. " found the rusty key! Now unlock the gate by the road.", 5, Color3.fromRGB(255, 220, 110))
	end)
end

function Match:dropKey(plr)
	if self.keyHolder ~= plr then
		return
	end
	self.keyHolder = nil
	local st = PS[plr]
	local pos = self.keyHome
	if st and st.hrp and st.hrp.Parent and not self:inBarn(st.hrp.Position) then
		pos = st.hrp.Position
	end
	self:spawnKey(pos)
	self:broadcast("The rusty key was dropped!", 4, Color3.fromRGB(255, 200, 120), plr)
end

function Match:callPolice(plr)
	local info = self.players[plr]
	local pol = self.police
	if not info or info.role ~= "survivor" or info.status ~= "alive" or not pol then
		return
	end
	if pol.state ~= "none" then
		showMessage(plr, "The police are already on the way.", 3)
		return
	end
	pol.state = "called"
	pol.arriveAt = os.clock() + CONFIG.PoliceDelay
	playSound(CONFIG.Sounds.Ding, PS[plr].hrp, 1, 0.8, 30)
	self:broadcast("911 was called! The police will come down the road in " .. CONFIG.PoliceDelay .. " seconds.", 6, Color3.fromRGB(140, 190, 255))
end

function Match:unlockGate(plr)
	local info = self.players[plr]
	if self.gateUnlocked or not info or info.role ~= "survivor" or info.status ~= "alive" then
		return
	end
	if not self.keyHolder then
		showMessage(plr, "It's locked. You need the rusty yellow key from the farm.", 4, Color3.fromRGB(255, 190, 140))
		return
	end
	self.gateUnlocked = true
	for _, p in ipairs(self.gate.chain) do
		if p.Parent then
			p:Destroy()
		end
	end
	self.lockPrompt.Enabled = false
	self.puzzle.opened = false
	self:openGate()
	self:broadcast("The gate is open! Get to the road!", 5, Color3.fromRGB(150, 255, 170))
end

function Match:enterCar(plr)
	local pol = self.police
	local info = self.players[plr]
	local st = PS[plr]
	if not pol or pol.state ~= "here" or not info or info.role ~= "survivor" or info.status ~= "alive" or not st.hum then
		return
	end
	for _, seat in ipairs(pol.car.seats) do
		if seat.Occupant == nil then
			seat:Sit(st.hum)
			st.hum.JumpPower = 0
			st.hum.JumpHeight = 0
			showMessage(plr, "You're in the police car! Waiting for the others...", 4, Color3.fromRGB(140, 190, 255))
			return
		end
	end
	showMessage(plr, "The car is full!", 3)
end

function Match:policeStep(dt, now)
	local pol = self.police
	local car = pol.car
	if pol.state ~= "none" and pol.state ~= "called" then
		pol.lightT += dt
		if pol.lightT > 0.35 then
			pol.lightT = 0
			pol.flip = not pol.flip
			car.red.Material = pol.flip and Enum.Material.Neon or Enum.Material.SmoothPlastic
			car.blue.Material = pol.flip and Enum.Material.SmoothPlastic or Enum.Material.Neon
			car.redL.Enabled = pol.flip
			car.blueL.Enabled = not pol.flip
		end
	end
	if pol.state == "called" and now >= pol.arriveAt then
		pol.state = "arriving"
		car.root.CFrame = pol.start
		TweenService:Create(car.root, TweenInfo.new(7, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { CFrame = pol.stop }):Play()
		task.delay(7, function()
			if not self.ended and pol.state == "arriving" then
				pol.state = "here"
				self.carPrompt.Enabled = true
				self:broadcast("The police are here! Get in the car!", 5, Color3.fromRGB(140, 190, 255))
			end
		end)
	elseif pol.state == "here" then
		local seated, outside = {}, 0
		for _, s in ipairs(self:survivors()) do
			local seat = s.st.hum.SeatPart
			if seat and seat:IsDescendantOf(car.model) then
				seated[#seated + 1] = s.plr
			else
				outside += 1
			end
		end
		if #seated > 0 then
			pol.leaveAt = pol.leaveAt or (now + 15)
			if outside == 0 then
				pol.leaveAt = math.min(pol.leaveAt, now + 1.5)
			end
			if now >= pol.leaveAt then
				self:driveOff(seated)
			end
		else
			pol.leaveAt = nil
		end
	end
end

function Match:driveOff(seated)
	local pol = self.police
	pol.state = "leaving"
	pol.leaveAt = nil
	self.carPrompt.Enabled = false
	local far = pol.stop * C(0, 0, -400) -- forward along the road
	TweenService:Create(pol.car.root, TweenInfo.new(8, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { CFrame = far }):Play()
	for _, plr in ipairs(seated) do
		showMessage(plr, "The police car drives off into the night...", 4, Color3.fromRGB(140, 190, 255))
		task.delay(2.5, function()
			if self.players[plr] and self.players[plr].status == "alive" then
				self:escaped(plr)
			end
		end)
	end
	-- the police come back for anyone left behind
	task.delay(9, function()
		if self.ended then
			return
		end
		pol.car.root.CFrame = pol.start
		pol.state = "called"
		pol.arriveAt = os.clock() + 25
		self:broadcast("The police will come back for the rest of you in 25 seconds...", 5, Color3.fromRGB(140, 190, 255))
	end)
end

-- --------------------------------------------------------------------
-- players in the match
-- --------------------------------------------------------------------
function Match:survivors()
	local list = {}
	for plr, info in pairs(self.players) do
		if info.role == "survivor" and info.status == "alive" then
			local st = PS[plr]
			local hrp = st and st.hrp
			if hrp and hrp.Parent and st.hum and st.hum.Health > 0 then
				list[#list + 1] = { plr = plr, st = st, hrp = hrp }
			end
		end
	end
	return list
end

-- can the monster / farmer go after this survivor?
function Match:targetable(s)
	if s.st.hum.SeatPart then
		return false
	end
	if self.kind == "nightmare" then
		return not self:inBarn(s.hrp.Position)
	end
	return true
end

function Match:broadcast(text, dur, color, exceptPlr)
	for plr, info in pairs(self.players) do
		if plr ~= exceptPlr and info.status == "alive" then
			showMessage(plr, text, dur, color)
		end
	end
end

local sendToLobby -- defined later

function Match:removePlayer(plr, status)
	local info = self.players[plr]
	if not info or info.status ~= "alive" then
		return
	end
	if self.keyHolder == plr and status ~= "escaped" then
		self:dropKey(plr)
	end
	info.status = status
	local st = PS[plr]
	if st then
		st.flashOn = false
	end
end

function Match:caught(plr, delay, byText)
	local info = self.players[plr]
	if not info or info.status ~= "alive" then
		return
	end
	self:removePlayer(plr, "caught")
	local st = PS[plr]
	if st and st.hum and st.hum.Parent then
		st.hum.WalkSpeed = 0
		st.hum.JumpPower = 0
		st.hum.JumpHeight = 0
	end
	local who = byText or "the Corn Monster"
	self:broadcast(plr.DisplayName .. " was taken by " .. who .. ".", 4, Color3.fromRGB(255, 150, 120), plr)
	task.delay(math.max(0, (delay or 2.5) - 0.6), function()
		showMessage(plr, "You were caught by " .. who .. "...", 3, Color3.fromRGB(255, 130, 110))
	end)
	task.delay(delay or 2.5, function()
		if PS[plr] and PS[plr].match == self then
			sendToLobby(plr)
		end
	end)
end

local saveBeatNormal -- defined later

function Match:escaped(plr)
	self:removePlayer(plr, "escaped")
	self:broadcast(plr.DisplayName .. " escaped!", 4, Color3.fromRGB(150, 255, 170), plr)
	local st = PS[plr]
	if self.kind == "nightmare" then
		showMessage(plr, "YOU SURVIVED THE NIGHTMARE!", 5, Color3.fromRGB(150, 255, 170))
		awardBadge(plr, CONFIG.NightmareBadgeId)
	else
		awardBadge(plr, CONFIG.BadgeId)
		if st and not st.beatNormal then
			st.beatNormal = true
			saveBeatNormal(plr)
			showMessage(plr, "YOU ESCAPED! You can now play as the Corn Monster!", 6, Color3.fromRGB(190, 255, 120))
		else
			showMessage(plr, "YOU ESCAPED THE CORN FIELD!", 5, Color3.fromRGB(150, 255, 170))
		end
	end
	task.delay(4, function()
		if PS[plr] and PS[plr].match == self then
			sendToLobby(plr)
		end
	end)
end

-- --------------------------------------------------------------------
-- effects: smoke bursts, holes in the corn, cracks in the ground
-- --------------------------------------------------------------------
function Match:burst(pos, color)
	local p = part({ Name = "Burst", Size = Vector3.new(1, 1, 1), Position = pos, Transparency = 1 }, self.folder)
	local e = make("ParticleEmitter", {
		Texture = "rbxasset://textures/particles/smoke_main.dds", Rate = 90, Lifetime = NumberRange.new(0.8, 1.5),
		Speed = NumberRange.new(6, 14), SpreadAngle = Vector2.new(60, 60), Size = NumberSequence.new(1.5, 4),
		Transparency = NumberSequence.new(0.35, 1), Color = ColorSequence.new(color or Color3.fromRGB(90, 110, 50)),
		Acceleration = Vector3.new(0, -6, 0), RotSpeed = NumberRange.new(-120, 120),
	}, p)
	task.delay(0.4, function()
		e.Enabled = false
	end)
	Debris:AddItem(p, 3)
end

function Match:rustleWall(sp)
	local face = self:bc(sp.bx, sp.by) + Vector3.new(sp.dx, 0, sp.dy) * (BS / 2) + Vector3.new(0, 7, 0)
	local found = workspace:GetPartBoundsInRadius(face, 8, self.overlap)
	local list = {}
	for _, p in ipairs(found) do
		list[#list + 1] = { p = p, cf = p.CFrame }
	end
	task.spawn(function()
		local t0 = os.clock()
		while os.clock() - t0 < 1.3 do
			local t = os.clock() - t0
			local amp = (0.3 + t / 1.3) * 0.16
			for _, e in ipairs(list) do
				if e.p.Parent and e.p.CFrame.Position:FuzzyEq(e.cf.Position, 2) then
					e.p.CFrame = e.cf * A(math.sin(t * 38 + e.cf.X) * amp, 0, math.sin(t * 31 + e.cf.Z) * amp)
				end
			end
			task.wait(1 / 30)
		end
	end)
end

-- He tears a hole in the corn wall when he comes out
function Match:wallHole(sp)
	local id = key(sp.bx, sp.by) * 10 + (sp.dx + 1) * 3 + (sp.dy + 1)
	local n = Vector3.new(sp.dx, 0, sp.dy)
	local face = self:bc(sp.bx, sp.by) + n * (BS / 2)
	-- broken stalks fly out onto the ground
	local found = workspace:GetPartBoundsInRadius(face + Vector3.new(0, 6, 0), 5, self.overlap)
	for _, p in ipairs(found) do
		local land = Vector3.new(p.Position.X, self.origin.Y + 0.2 + math.random() * 0.3, p.Position.Z) + n * (2 + math.random() * 5)
		TweenService:Create(p, TweenInfo.new(0.45 + math.random() * 0.3, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { CFrame = C(land) * A(math.rad(90), math.random() * 6, 0) }):Play()
	end
	if self.holes[id] then
		return
	end
	self.holes[id] = true
	local up = Vector3.new(0, 1, 0)
	local dark = Color3.fromRGB(10, 12, 6)
	for i, h in ipairs({ 3.4, 6, 8.6 }) do
		local d = (i == 2) and 6.4 or 5.2
		part({ Name = "Hole", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.25, d, d), CFrame = CFrame.fromMatrix(face + n * 0.14 + Vector3.new(0, h, 0), n, up), Color = dark, Material = Enum.Material.Grass }, self.holeFolder)
	end
	for i = 1, 14 do
		local a = i / 14 * math.pi * 2
		local rim = face + n * 0.3 + Vector3.new(0, 6, 0) + (Vector3.new(-n.Z, 0, n.X) * math.cos(a) * 3.2) + Vector3.new(0, math.sin(a) * 4.4, 0)
		part({ Name = "TornLeaf", Size = Vector3.new(0.4, 0.06, 1.6), CFrame = CFrame.lookAt(rim, rim + n + Vector3.new(0, -0.4, 0)) * A(0, 0, a), Color = Color3.fromRGB(70 + math.random(0, 30), 90, 40), Material = Enum.Material.Grass }, self.holeFolder)
	end
	for _ = 1, 4 do
		local p = face + n * (1.5 + math.random() * 4) + Vector3.new((math.random() - 0.5) * 6, 0.25, (math.random() - 0.5) * 6)
		part({ Name = "Husk", Size = Vector3.new(0.6, 0.06, 2), CFrame = C(p) * A(0, math.random() * 6, 0), Color = Color3.fromRGB(150, 130, 70), Material = Enum.Material.Fabric }, self.holeFolder)
	end
	self:burst(face + Vector3.new(0, 6, 0) + n, Color3.fromRGB(80, 110, 46))
end

-- He bursts out of the ground (Nightmare): cracks first, then the hole
function Match:groundCrack(pos, burst)
	local g = Vector3.new(pos.X, self.origin.Y, pos.Z)
	if not burst then
		for i = 1, 9 do
			local a = i / 9 * math.pi * 2 + math.random() * 0.3
			local len = 3 + math.random() * 4
			local mid = g + Vector3.new(math.cos(a), 0, math.sin(a)) * (len / 2 + 1)
			part({ Name = "Crack", Size = Vector3.new(0.35, 0.06, len), CFrame = CFrame.lookAt(mid + Vector3.new(0, 0.1, 0), g + Vector3.new(0, 0.1, 0)), Color = Color3.fromRGB(14, 10, 8), Material = Enum.Material.Slate }, self.holeFolder)
		end
		playSound(CONFIG.Sounds.Footstep, self.holeFolder, 3, 0.18, 90)
		return
	end
	part({ Name = "GroundHole", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.12, 6.5, 6.5), CFrame = C(g + Vector3.new(0, 0.12, 0)) * A(0, 0, math.rad(90)), Color = Color3.fromRGB(8, 6, 4), Material = Enum.Material.Slate }, self.holeFolder)
	for i = 1, 12 do
		local a = i / 12 * math.pi * 2
		local s = 0.8 + math.random() * 1
		part({ Name = "Dirt", Shape = Enum.PartType.Ball, Size = Vector3.new(s, s, s), Position = g + Vector3.new(math.cos(a) * 3.7, s * 0.25, math.sin(a) * 3.7), Color = Color3.fromRGB(60 + math.random(0, 16), 44, 30), Material = Enum.Material.Ground }, self.holeFolder)
	end
	self:burst(g + Vector3.new(0, 2, 0), Color3.fromRGB(90, 66, 44))
end

-- --------------------------------------------------------------------
-- monster: picking where he comes out
-- --------------------------------------------------------------------
-- Corn Field: out of the corn wall about EmergeDistance studs BEHIND the
-- player. If there is no wall there, out of the wall IN FRONT instead.
function Match:pickEmergeSpot(hrp)
	local P = hrp.Position
	local look = flat(hrp.CFrame.LookVector)
	if look.Magnitude < 0.01 then
		look = Vector3.new(0, 0, -1)
	end
	look = look.Unit
	local pbx, pby = self:toBlock(P)
	local dm = bfs(self.wall, pbx, pby)
	local want = CONFIG.EmergeDistance

	local function search(sign)
		local best, bestScore
		for _, sp in ipairs(self.lurk) do
			local pd = dm[key(sp.ox, sp.oy)]
			if pd and pd <= 3 then
				local face = self:bc(sp.bx, sp.by) + Vector3.new(sp.dx, 0, sp.dy) * (BS / 2)
				local rel = flat(face - P)
				local dist = rel.Magnitude
				local outDist = flat(self:bc(sp.ox, sp.oy) - P).Magnitude
				if dist > 3 and outDist > 6.5 and dist < want + 9 and dist > want - 6 then
					local along = rel.Unit:Dot(look) * sign
					if along > 0.4 then
						local score = math.abs(dist - want) - along * 4
						if not bestScore or score < bestScore then
							best, bestScore = sp, score
						end
					end
				end
			end
		end
		return best
	end

	local spot = search(-1) -- behind you
	if not spot then
		spot = search(1) -- in front of you
	end
	if not spot then
		local cand = {}
		for _, sp in ipairs(self.lurk) do
			local pd = dm[key(sp.ox, sp.oy)]
			if pd and pd >= 1 and pd <= 4 then
				cand[#cand + 1] = sp
			end
		end
		spot = cand[math.random(math.max(#cand, 1))]
	end
	return spot
end

-- Nightmare: out of the ground about EmergeDistance studs behind you
-- (or in front of you if there's no room behind)
function Match:pickGroundSpot(hrp)
	local P = hrp.Position
	local look = flat(hrp.CFrame.LookVector)
	if look.Magnitude < 0.01 then
		look = Vector3.new(0, 0, -1)
	end
	look = look.Unit
	local pbx, pby = self:toBlock(P)
	local dm = bfs(self.wall, pbx, pby)
	local ground = Vector3.new(P.X, self.origin.Y, P.Z)
	local function ok(q)
		local bx, by = self:toBlock(q)
		if not self:isOpen(bx, by) or self:inBarnBlock(bx, by) then
			return false
		end
		local d = dm[key(bx, by)]
		if not d or d > 3 then
			return false
		end
		return self:clearLine(P + Vector3.new(0, 2, 0), q + Vector3.new(0, 2, 0))
	end
	for _, sign in ipairs({ -1, 1 }) do
		for _, ang in ipairs({ 0, 0.35, -0.35, 0.7, -0.7 }) do
			local dir = A(0, ang, 0):VectorToWorldSpace(look) * sign
			for _, dist in ipairs({ CONFIG.EmergeDistance, CONFIG.EmergeDistance - 2, CONFIG.EmergeDistance + 3 }) do
				local q = ground + dir * dist
				if ok(q) then
					return q
				end
			end
		end
	end
	return nil
end

-- --------------------------------------------------------------------
-- monster AI (when no player is the monster)
-- --------------------------------------------------------------------
function Match:aiInit()
	local m = Monster.new(self.folder, CONFIG.MonsterScale)
	m.twitch = self.D.twitch or 1
	m.pos = self.center - Vector3.new(0, 80, 0)
	m:assemble(C(m.pos))
	self.mon = m
	self.ai = {
		mode = "dormant", nextEmerge = os.clock() + self.D.firstEmerge, losT = 0, visible = {}, lastVis = {},
		lastGrowl = 0, chaseUntil = 0, litTime = 0, lastPath = 0,
	}
end

function Match:clearLine(fromPos, toPos)
	return workspace:Raycast(fromPos, toPos - fromPos, self.rayParams) == nil
end

function Match:alert(plr)
	if self.monPlr then
		showMessage(self.monPlr, plr.DisplayName .. " pressed the wrong code at the gate!", 4, Color3.fromRGB(190, 255, 120))
		return
	end
	local ai = self.ai
	if ai and ai.mode == "dormant" then
		ai.nextEmerge = math.min(ai.nextEmerge, os.clock() + 2.5)
		ai.target = plr
	end
end

function Match:startEmerge(sp, target)
	local m, ai = self.mon, self.ai
	ai.mode = "emerge"
	ai.t = 0
	ai.spot = sp
	ai.target = target
	ai.holed = false
	m.crawlAmt = 0
	m.pos = self:bc(sp.bx, sp.by)
	m.yaw = math.atan2(-sp.dx, -sp.dy)
	self:rustleWall(sp)
	m.rustleSound:Play()
end

function Match:startRise(pos, target)
	local m, ai = self.mon, self.ai
	ai.mode = "rise"
	ai.t = 0
	ai.risePos = Vector3.new(pos.X, self.origin.Y, pos.Z)
	ai.target = target
	ai.burstDone = false
	m.crawlAmt = 0
	m.pos = ai.risePos - Vector3.new(0, 16, 0)
	local st = PS[target]
	if st and st.hrp then
		local to = flat(st.hrp.Position - ai.risePos)
		if to.Magnitude > 0.1 then
			m.yaw = math.atan2(-to.X, -to.Z)
		end
	end
	self:groundCrack(ai.risePos, false)
end

function Match:startSink(lit)
	local m, ai = self.mon, self.ai
	ai.mode = "sink"
	ai.t = 0
	ai.sinkPos = Vector3.new(m.pos.X, self.origin.Y, m.pos.Z)
	ai.litSink = lit
	m.path = nil
	m:growl()
	self:groundCrack(ai.sinkPos, true)
end

function Match:retreat(crawl)
	local m, ai = self.mon, self.ai
	if self.kind == "nightmare" then
		self:startSink(crawl)
		return
	end
	local sx, sy = self:nearestOpen(m.pos)
	local dmM = bfs(self.wall, sx, sy)
	local dmPs = {}
	for _, s in ipairs(self:survivors()) do
		local bx, by = self:toBlock(s.hrp.Position)
		dmPs[#dmPs + 1] = bfs(self.wall, bx, by)
	end
	local minP = crawl and 6 or 4
	local best, bd
	for _, sp in ipairs(self.lurk) do
		local k = key(sp.ox, sp.oy)
		local dmv = dmM[k]
		if dmv and dmv >= 1 and dmv <= 22 then
			local far = true
			for _, dp in ipairs(dmPs) do
				if (dp[k] or 99) < minP then
					far = false
					break
				end
			end
			if far and (not bd or dmv < bd) then
				best, bd = sp, dmv
			end
		end
	end
	if not best then
		for _, sp in ipairs(self.lurk) do
			local dmv = dmM[key(sp.ox, sp.oy)]
			if dmv and dmv >= 1 and (not bd or dmv < bd) then
				best, bd = sp, dmv
			end
		end
	end
	ai.spot = best
	m.path = best and findPath(self.wall, sx, sy, best.ox, best.oy)
	m.idx = 2
	ai.crawling = crawl
	ai.litTime = 0
	if not m.path then
		self:goDormant()
		return
	end
	ai.mode = "retreat"
end

function Match:goDormant()
	local m, ai = self.mon, self.ai
	ai.mode = "dormant"
	ai.target = nil
	ai.nextEmerge = os.clock() + self.D.rearmMin + math.random() * (self.D.rearmMax - self.D.rearmMin)
	m.crawlAmt = 0
	m.path = nil
	m.pos = self.center - Vector3.new(0, 80, 0)
	m:pose(C(m.pos), os.clock(), 0.05, false, false)
	m:applyAnchored()
end

-- walk an agent (monster or farmer) along its path, or straight at chasePos
function Match:follow(agent, dt, speed, chasePos)
	local target
	if agent.path and agent.path[agent.idx] then
		target = self:bc(agent.path[agent.idx][1], agent.path[agent.idx][2])
	elseif chasePos then
		target = Vector3.new(chasePos.X, self.origin.Y, chasePos.Z)
	end
	if not target then
		return false, true
	end
	local to = flat(target - agent.pos)
	local dd = to.Magnitude
	if dd < 0.5 then
		if agent.path and agent.path[agent.idx] then
			agent.idx += 1
		end
		return false, (agent.path == nil or agent.path[agent.idx] == nil)
	end
	agent.pos = agent.pos + to.Unit * math.min(speed * dt, dd)
	agent.yaw = lerpAngle(agent.yaw, math.atan2(-to.X, -to.Z), math.min(1, dt * 8))
	return true, false
end

function Match:aiStep(dt, now)
	local m, ai, D = self.mon, self.ai, self.D
	local surv = self:survivors()

	if ai.mode == "dormant" then
		if now < ai.nextEmerge then
			return
		end
		local target = ai.target
		local tInfo
		for _, s in ipairs(surv) do
			if s.plr == target and self:targetable(s) then
				tInfo = s
			end
		end
		if not tInfo then
			local choices = {}
			for _, s in ipairs(surv) do
				if self:targetable(s) and not (self.kind == "corn" and self:inCamp(s.hrp.Position)) then
					choices[#choices + 1] = s
				end
			end
			tInfo = choices[math.random(math.max(#choices, 1))]
		end
		if tInfo then
			if self.kind == "nightmare" then
				local q = self:pickGroundSpot(tInfo.hrp)
				if q then
					self:startRise(q, tInfo.plr)
					return
				end
			else
				local sp = self:pickEmergeSpot(tInfo.hrp)
				if sp then
					self:startEmerge(sp, tInfo.plr)
					return
				end
			end
		end
		ai.target = nil
		ai.nextEmerge = now + 3
		return
	end

	if ai.mode == "emerge" then
		-- shakes the corn, rips a hole in the wall, and pulls himself out
		ai.t += dt
		local sp = ai.spot
		local inside, outside = self:bc(sp.bx, sp.by), self:bc(sp.ox, sp.oy)
		local a = 0
		if ai.t < 1.2 then
			m.pos = inside
		elseif ai.t < 2.8 then
			if not ai.holed then
				ai.holed = true
				self:wallHole(sp)
				m:growl()
				ai.lastGrowl = now
			end
			a = smooth((ai.t - 1.2) / 1.6)
			m.pos = inside:Lerp(outside, a)
		else
			ai.mode = "hunt"
			ai.chaseUntil = now + D.giveUp
			m.path = nil
			ai.lastPath = 0
		end
		m.phase += dt * ((ai.t > 1.2) and 6 or 1.5)
		local k = (ai.t > 1.2) and 0.6 or 0.05
		m:pose(C(m.pos) * A(0, m.yaw, 0), now, k, true, false, { kind = "emerge", a = a })
		m:applyAnchored()
		m:steps(k)
		return
	end

	if ai.mode == "rise" then
		-- the ground cracks, then he claws his way up
		ai.t += dt
		local a = 0
		if ai.t >= 1.4 then
			if not ai.burstDone then
				ai.burstDone = true
				self:groundCrack(ai.risePos, true)
				m:growl()
				ai.lastGrowl = now
			end
			a = smooth((ai.t - 1.4) / 1.8)
		end
		m.pos = ai.risePos - Vector3.new(0, 16 * (1 - a), 0)
		if ai.t >= 3.3 then
			ai.mode = "hunt"
			ai.chaseUntil = now + D.giveUp
			m.path = nil
			ai.lastPath = 0
		end
		m.phase += dt * 3
		m:pose(C(m.pos) * A(0, m.yaw, 0), now, 0.3, true, false, { kind = "rise", a = a })
		m:applyAnchored()
		return
	end

	if ai.mode == "sink" then
		-- flails, then sinks back into the dirt
		ai.t += dt
		local a = smooth((ai.t - 0.5) / 1.5)
		m.pos = ai.sinkPos - Vector3.new(0, 16 * a, 0)
		m.phase += dt * 4
		m:pose(C(m.pos) * A(0, m.yaw, 0), now, 0.3, false, true, { kind = "sink" })
		m:applyAnchored()
		if ai.t >= 2.1 then
			self:goDormant()
		end
		return
	end

	if ai.mode == "grab" then
		return -- handled by grabStep
	end

	if ai.mode == "burrow" then
		ai.t += dt
		local sp = ai.spot
		local a = math.clamp(ai.t / 1.3, 0, 1)
		m.pos = self:bc(sp.ox, sp.oy):Lerp(self:bc(sp.bx, sp.by), a)
		m.yaw = lerpAngle(m.yaw, math.atan2(sp.dx, sp.dy), math.min(1, dt * 10))
		m.phase += dt * 8
		m.crawlAmt = lerp(m.crawlAmt, ai.crawling and 1 or 0, math.min(1, dt * 6))
		m:pose(C(m.pos) * A(0, m.yaw, 0), now, 0.7, false, false)
		m:applyAnchored()
		m:steps(0.7)
		if a >= 1 then
			self:goDormant()
		end
		return
	end

	-- hunt / retreat: who can he see?
	local eye = m.pos + Vector3.new(0, 11 * m.scale, 0)
	ai.losT -= dt
	if ai.losT <= 0 then
		ai.losT = 0.2
		ai.visible = {}
		for _, s in ipairs(surv) do
			local d = flat(s.hrp.Position - m.pos).Magnitude
			if self:targetable(s) and d < CONFIG.MonsterSightRange and self:clearLine(eye, s.hrp.Position + Vector3.new(0, 1.5, 0)) then
				ai.visible[s.plr] = true
				-- he growls when he spots you
				if now - (ai.lastVis[s.plr] or 0) > 3 and now - ai.lastGrowl > 3 then
					m:growl()
					ai.lastGrowl = now
				end
				ai.lastVis[s.plr] = now
			end
		end
	end

	-- flashlight: slows him down, then he runs off
	local lit = false
	for _, s in ipairs(surv) do
		if s.st.flashOn and ai.visible[s.plr] then
			local head = s.hrp.Position + Vector3.new(0, 1.5, 0)
			local toM = (m.pos + Vector3.new(0, 7 * m.scale, 0)) - head
			if toM.Magnitude < 55 and flat(toM).Magnitude > 0.5 and flat(s.hrp.CFrame.LookVector).Unit:Dot(flat(toM).Unit) > 0.8 then
				lit = true
				if ai.mode == "hunt" then
					ai.litBy = s.plr
				end
			end
		end
	end
	if lit then
		ai.litTime += dt
	else
		ai.litTime = math.max(0, ai.litTime - dt * 0.5)
	end

	if ai.mode == "hunt" then
		if lit and ai.litTime >= D.fleeLit then
			ai.lastGrowl = now
			if ai.litBy then
				showMessage(ai.litBy, self.kind == "nightmare" and "He sinks back into the ground!" or "It crawls away from the light!", 3, Color3.fromRGB(255, 230, 150))
			end
			if self.kind ~= "nightmare" then
				m:growl()
			end
			self:retreat(true)
			return
		end

		-- choose who to chase
		local best, bestD
		for _, s in ipairs(surv) do
			if self:targetable(s) then
				local d = flat(s.hrp.Position - m.pos).Magnitude
				local hear = CONFIG.MonsterHearRange * ((s.st.sprinting and s.st.moving) and 1.8 or 1)
				if ai.visible[s.plr] or d < hear then
					if not bestD or d < bestD then
						best, bestD = s, d
					end
				end
			end
		end
		if best then
			ai.target = best.plr
			ai.chaseUntil = now + D.giveUp
		end
		local tInfo
		for _, s in ipairs(surv) do
			if s.plr == ai.target and self:targetable(s) then
				tInfo = s
			end
		end
		if not tInfo or now > ai.chaseUntil then
			self:retreat(false)
			return
		end
		local tPos = tInfo.hrp.Position
		local dist = flat(tPos - m.pos).Magnitude

		local speed = D.hunt * (lit and D.litSlow or 1)
		local moved
		if ai.visible[tInfo.plr] and dist < BS * 1.4 then
			m.path = nil
			moved = self:follow(m, dt, speed, tPos)
		else
			if m.path == nil or now - ai.lastPath > 0.35 then
				ai.lastPath = now
				local sx, sy = self:nearestOpen(m.pos)
				local gx, gy = self:toBlock(tPos)
				if self.wall[gx][gy] then
					for _, d in ipairs(DIRS) do
						if self:isOpen(gx + d[1], gy + d[2]) then
							gx, gy = gx + d[1], gy + d[2]
							break
						end
					end
				end
				m.path = findPath(self.wall, sx, sy, gx, gy)
				m.idx = 2
			end
			moved = self:follow(m, dt, speed, ai.visible[tInfo.plr] and tPos or nil)
		end

		if dist < CONFIG.MonsterCatchRange and math.abs(tPos.Y - (m.pos.Y + 3)) < 8 then
			self:startGrab(tInfo, false)
			return
		end

		local k = moved and math.clamp(speed / 12, 0.3, 1.5) or 0.05
		m.phase += dt * (moved and speed * 0.7 or 1.2)
		m.crawlAmt = lerp(m.crawlAmt, 0, math.min(1, dt * 6))
		m:pose(C(m.pos) * A(0, m.yaw, 0), now, k, true, lit)
		m:applyAnchored()
		m:steps(k)
		return
	end

	-- retreat (Corn Field only): crawl back to a wall
	local speed = ai.crawling and 16 or 9
	local moved, finished = self:follow(m, dt, speed, nil)
	if finished then
		ai.mode = "burrow"
		ai.t = 0
		m.rustleSound:Play()
		self:rustleWall(ai.spot)
		self:wallHole(ai.spot)
		return
	end
	if not ai.crawling then
		for _, s in ipairs(surv) do
			if ai.visible[s.plr] and flat(s.hrp.Position - m.pos).Magnitude < CONFIG.MonsterHearRange * 1.5 then
				ai.mode = "hunt"
				ai.target = s.plr
				ai.chaseUntil = now + D.giveUp
				m.path = nil
				return
			end
		end
	end
	local k = moved and math.clamp(speed / 12, 0.3, 1.5) or 0.05
	m.phase += dt * (moved and speed * 0.7 or 1.2)
	m.crawlAmt = lerp(m.crawlAmt, ai.crawling and 1 or 0, math.min(1, dt * 6))
	m:pose(C(m.pos) * A(0, m.yaw, 0), now, k, false, false)
	m:applyAnchored()
	m:steps(k)
end

-- --------------------------------------------------------------------
-- JUMPSCARE: the Corn Monster picks you up and throws you (2 seconds)
-- --------------------------------------------------------------------
function Match:startGrab(s, byPlayer)
	if self.grab then
		return
	end
	local m = self.mon
	local hrp = s.hrp
	self:caught(s.plr, 2.8)
	hrp.Anchored = true
	s.st.hum.AutoRotate = false
	local look = flat(hrp.CFrame.LookVector)
	look = (look.Magnitude > 0.01) and look.Unit or Vector3.new(0, 0, -1)
	local ground, front
	if byPlayer then
		local mh = PS[self.monPlr].hrp
		ground = Vector3.new(mh.Position.X, self.origin.Y, mh.Position.Z)
		front = flat(mh.CFrame.LookVector)
		front = (front.Magnitude > 0.01) and front.Unit or Vector3.new(0, 0, -1)
		mh.Anchored = true
	else
		-- he steps right in front of where you're looking
		ground = Vector3.new(hrp.Position.X, self.origin.Y, hrp.Position.Z) + look * 4.2
		front = -look
		m.pos = ground
		m.yaw = math.atan2(look.X, look.Z)
		m.crawlAmt = 0
		m.path = nil
		self.ai.mode = "grab"
	end
	self.grab = { plr = s.plr, hrp = hrp, t = 0, ground = ground, front = front, start = hrp.CFrame, byPlayer = byPlayer }
end

function Match:grabStep(dt, now)
	local g = self.grab
	local m = self.mon
	local SC = m.scale
	g.t += dt
	local t = g.t
	local hold = g.ground + g.front * 2.9 + Vector3.new(0, 9.6 * SC, 0)
	local land = g.ground - g.front * 24 + Vector3.new(0, 1.2, 0)
	local apex = g.ground - g.front * 6 + Vector3.new(0, 24, 0)
	local rot = g.start.Rotation
	local act = { kind = "grab", reach = 1 }
	local cf
	if t < 0.55 then
		local a = smooth(t / 0.55)
		act.reach = a
		cf = CFrame.new(g.start.Position:Lerp(hold, a)) * rot
	elseif t < 1.25 then
		act.hold = true
		if not g.roared then
			g.roared = true
			m.growlSound.Volume = 5
			m:growl()
			flash(g.plr, Color3.fromRGB(150, 0, 0), 0.35, 1, 0.7)
		end
		cf = CFrame.new(hold + Vector3.new(math.random() - 0.5, math.random() - 0.5, math.random() - 0.5) * 0.3) * rot
	elseif t < 2.0 then
		local a = (t - 1.25) / 0.75
		act.throw = smooth(a)
		if not g.thrown then
			g.thrown = true
			m.growlSound.Volume = 3.5
			playSound(CONFIG.Sounds.Whoosh, m.seg.Torso, 2.5, 0.6, 80)
		end
		local p = hold * ((1 - a) ^ 2) + apex * (2 * (1 - a) * a) + land * (a * a)
		cf = CFrame.new(p) * rot * A(-a * 6, 0, a * 2)
	else
		act.throw = 1
		cf = CFrame.new(land) * rot * A(-math.pi / 2, 0, 0)
		if not g.done then
			g.done = true
			flash(g.plr, Color3.new(0, 0, 0), 1, 0, 0.4)
		end
	end
	if g.hrp.Parent then
		g.hrp.CFrame = cf
	end
	m.phase += dt
	if g.byPlayer then
		m:pose(m.localRoot, now, 0.05, true, false, act)
		m:applyWelds()
	else
		m:pose(C(m.pos) * A(0, m.yaw, 0), now, 0.05, true, false, act)
		m:applyAnchored()
	end
	if t >= 2.4 then
		self.grab = nil
		if g.byPlayer then
			local st = self.monPlr and PS[self.monPlr]
			if st and st.hrp then
				st.hrp.Anchored = false
			end
		else
			self:retreat(true)
		end
	end
end

-- --------------------------------------------------------------------
-- monster PLAYER (game pass or beat Normal)
-- --------------------------------------------------------------------
function Match:setupMonsterPlayer(plr)
	local st = PS[plr]
	local char, hum, hrp = st.char, st.hum, st.hrp
	-- spawn far away from the survivors
	local fromX, fromY = 4, 4
	if self.kind == "nightmare" then
		fromX, fromY = 9, 5
	end
	local dm = bfs(self.wall, fromX, fromY)
	local far, fd = self.openBlocks[1], -1
	for _, b in ipairs(self.openBlocks) do
		local d = dm[key(b[1], b[2])] or 0
		local okSpot = not (self.kind == "nightmare" and (self:inFarm(self:bc(b[1], b[2])) or self:inBarnBlock(b[1], b[2])))
		if okSpot and d > fd then
			far, fd = b, d
		end
	end
	local spawnPos = self:bc(far[1], far[2]) + Vector3.new(0, 4, 0)
	char:PivotTo(CFrame.lookAt(spawnPos, Vector3.new(self.center.X, spawnPos.Y, self.center.Z)))
	hrp.AssemblyLinearVelocity = Vector3.zero

	-- hide the player's own body and wear the monster
	for _, d in ipairs(char:GetDescendants()) do
		if d:IsA("BasePart") or d:IsA("Decal") then
			d.Transparency = 1
		end
	end
	self.hideConn = char.DescendantAdded:Connect(function(d)
		if d:FindFirstAncestor("CornMonster") then
			return
		end
		if d:IsA("BasePart") or d:IsA("Decal") then
			d.Transparency = 1
		end
	end)
	hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	hum.WalkSpeed = CONFIG.MonsterPlayerSpeed
	hum.UseJumpPower = true
	hum.JumpPower = 0
	hum.CameraOffset = Vector3.new(0, 7, 0)
	plr.CameraMode = Enum.CameraMode.Classic
	plr.CameraMinZoomDistance = 12
	plr.CameraMaxZoomDistance = 30

	local groundOffset
	if hum.RigType == Enum.HumanoidRigType.R6 then
		groundOffset = 3
	else
		groundOffset = hum.HipHeight + hrp.Size.Y / 2
	end
	local m = Monster.new(char, CONFIG.MonsterScale)
	m.twitch = self.D.twitch or 1
	m:attachTo(hrp, groundOffset)
	self.mon = m
	self.monPlr = plr
	self.mp = { lastVis = {}, lastGrowl = 0, losT = 0, visible = {} }

	-- Growl button (G) for the monster player
	local att = make("Attachment", { Name = "GrowlAttach", Position = Vector3.new(2, -1, -3) }, hrp)
	local prompt = make("ProximityPrompt", {
		ActionText = "Growl", ObjectText = "", KeyboardKeyCode = Enum.KeyCode.G, HoldDuration = 0, MaxActivationDistance = 8,
		RequiresLineOfSight = false, Exclusivity = Enum.ProximityPromptExclusivity.OnePerButton,
	}, att)
	prompt.Triggered:Connect(function(who)
		if who == plr and os.clock() - self.mp.lastGrowl > 3 then
			self.mp.lastGrowl = os.clock()
			m:growl()
		end
	end)
	showMessage(plr, "You are the CORN MONSTER. Catch them before they escape!", 6, Color3.fromRGB(190, 255, 120))
end

function Match:monPlayerStep(dt, now)
	local plr = self.monPlr
	local st = PS[plr]
	local info = self.players[plr]
	if not st or not info or info.status ~= "alive" or not st.hrp or not st.hrp.Parent or st.hum.Health <= 0 then
		-- the monster player is gone: the AI takes over
		self.monPlr = nil
		if self.hideConn then
			self.hideConn:Disconnect()
		end
		self:aiInit()
		self.ai.nextEmerge = now + 10
		self:broadcast("Something is moving out there...", 4)
		return
	end
	local m = self.mon
	local hrp = st.hrp
	local surv = self:survivors()
	local speed = flat(hrp.AssemblyLinearVelocity).Magnitude
	local moving = speed > 1
	local k = moving and math.clamp(speed / 12, 0.3, 1.5) or 0.05

	-- sight + growl when he spots someone
	local eye = hrp.Position + Vector3.new(0, 8, 0)
	local mp = self.mp
	mp.losT -= dt
	if mp.losT <= 0 then
		mp.losT = 0.2
		mp.visible = {}
		for _, s in ipairs(surv) do
			local d = flat(s.hrp.Position - hrp.Position).Magnitude
			if d < CONFIG.MonsterSightRange and self:clearLine(eye, s.hrp.Position + Vector3.new(0, 1.5, 0)) then
				mp.visible[s.plr] = true
				if now - (mp.lastVis[s.plr] or 0) > 3 and now - mp.lastGrowl > 3 then
					m:growl()
					mp.lastGrowl = now
				end
				mp.lastVis[s.plr] = now
			end
		end
	end

	-- flashlight slows the monster player
	local lit = false
	for _, s in ipairs(surv) do
		if s.st.flashOn and mp.visible[s.plr] then
			local toM = (hrp.Position + Vector3.new(0, 4, 0)) - s.hrp.Position
			if toM.Magnitude < 55 and flat(toM).Magnitude > 0.5 and flat(s.hrp.CFrame.LookVector).Unit:Dot(flat(toM).Unit) > 0.8 then
				lit = true
			end
		end
	end
	st.hum.WalkSpeed = CONFIG.MonsterPlayerSpeed * (lit and 0.55 or 1)

	-- catching
	for _, s in ipairs(surv) do
		local d = flat(s.hrp.Position - hrp.Position).Magnitude
		if self:targetable(s) and d < CONFIG.MonsterPlayerCatchRange and math.abs(s.hrp.Position.Y - hrp.Position.Y) < 8 then
			showMessage(plr, "You caught " .. s.plr.DisplayName .. "!", 3, Color3.fromRGB(190, 255, 120))
			self:startGrab(s, true)
			return
		end
	end

	m.phase += dt * (moving and speed * 0.7 or 1.2)
	m:pose(m.localRoot, now, k, moving, lit)
	m:applyWelds()
	m:steps(k)
end

-- --------------------------------------------------------------------
-- THE FARMER (Nightmare): stay off his farm
-- --------------------------------------------------------------------
function Match:farmerInit()
	local rig = Farmer.new(self.folder)
	local home = self:bc(19, 21)
	rig:assemble(C(home) * A(0, math.pi / 2, 0))
	self.farmer = { rig = rig, pos = home, yaw = math.pi / 2, mode = "patrol", losT = 0, waitUntil = os.clock() + 3, lastSeen = 0, lastPath = 0 }
end

function Match:farmerStep(dt, now)
	local f = self.farmer
	local rig = f.rig
	if self.stab then
		self:stabStep(dt, now)
		return
	end
	local surv = self:survivors()
	f.losT -= dt
	if f.losT <= 0 then
		f.losT = 0.2
		local best, bd
		for _, s in ipairs(surv) do
			if self:targetable(s) then
				local p = s.hrp.Position
				local d = flat(p - f.pos).Magnitude
				local seen = d < CONFIG.FarmerSightRange and self:clearLine(f.pos + Vector3.new(0, 6, 0), p + Vector3.new(0, 1.5, 0))
				local chasingThis = f.mode == "chase" and f.target == s.plr
				if (self:inFarm(p) and (d < 18 or seen)) or (chasingThis and seen and d < 40) then
					if not bd or d < bd then
						best, bd = s, d
					end
				end
			end
		end
		if best then
			if f.mode ~= "chase" then
				rig.yell:Play()
				showMessage(best.plr, "THE FARMER SAW YOU! Get off his farm!", 3, Color3.fromRGB(255, 120, 100))
			end
			f.mode = "chase"
			f.target = best.plr
			f.lastSeen = now
		end
	end
	rig.bubble.Enabled = f.mode == "chase"
	if f.mode == "chase" and now - f.lastSeen > 4 then
		f.mode = "patrol"
		f.path = nil
		f.waitUntil = now + 1
	end

	local moved = false
	local speed = CONFIG.FarmerWalkSpeed
	local poseMode = "walk"
	if f.mode == "chase" then
		local tInfo
		for _, s in ipairs(surv) do
			if s.plr == f.target and self:targetable(s) then
				tInfo = s
			end
		end
		if not tInfo then
			f.mode = "patrol"
			f.path = nil
		else
			local tPos = tInfo.hrp.Position
			local dist = flat(tPos - f.pos).Magnitude
			speed = CONFIG.FarmerChaseSpeed
			poseMode = "chase"
			if dist < 12 and self:clearLine(f.pos + Vector3.new(0, 4, 0), tPos) then
				f.path = nil
				moved = self:follow(f, dt, speed, tPos)
			else
				if f.path == nil or now - f.lastPath > 0.4 then
					f.lastPath = now
					local sx, sy = self:nearestOpen(f.pos)
					local gx, gy = self:nearestOpen(tPos)
					f.path = findPath(self.wall, sx, sy, gx, gy)
					f.idx = 2
				end
				moved = self:follow(f, dt, speed, nil)
			end
			if dist < CONFIG.FarmerCatchRange then
				self:startStab(tInfo)
				return
			end
		end
	else
		local finished = false
		if f.path then
			moved, finished = self:follow(f, dt, speed, nil)
		end
		if (not f.path or finished) and now >= f.waitUntil then
			local b = self.farmBlocks[math.random(#self.farmBlocks)]
			local sx, sy = self:nearestOpen(f.pos)
			f.path = findPath(self.wall, sx, sy, b[1], b[2])
			f.idx = 2
			f.waitUntil = now + 2 + math.random() * 4
		elseif finished then
			f.path = nil
		end
	end
	local k = moved and math.clamp(speed / 12, 0.4, 1.4) or 0
	f.phase = (f.phase or 0) + dt * (moved and speed * 0.75 or 0)
	rig.phase = f.phase
	rig:pose(C(f.pos) * A(0, f.yaw, 0), now, k, moved and poseMode or (poseMode == "chase" and "chase" or "idle"), 0)
	rig:apply()
	rig:steps(k)
end

-- JUMPSCARE: the farmer stabs you in the stomach with his pitchfork
function Match:startStab(s)
	local f = self.farmer
	local hrp = s.hrp
	self:caught(s.plr, 2.8, "the Farmer")
	hrp.Anchored = true
	s.st.hum.AutoRotate = false
	local look = flat(hrp.CFrame.LookVector)
	look = (look.Magnitude > 0.01) and look.Unit or Vector3.new(0, 0, -1)
	f.pos = Vector3.new(hrp.Position.X, self.origin.Y, hrp.Position.Z) + look * 3.4
	f.yaw = math.atan2(look.X, look.Z)
	f.mode = "stab"
	f.path = nil
	f.rig.yell:Play()
	self.stab = { plr = s.plr, hrp = hrp, t = 0, start = hrp.CFrame }
end

function Match:stabStep(dt, now)
	local s = self.stab
	local f = self.farmer
	s.t += dt
	local t = s.t
	local thrust = 0
	local cf = s.start
	if t < 0.45 then
		thrust = lerp(0, -2.4, smooth(t / 0.45))
	elseif t < 0.6 then
		thrust = lerp(-2.4, -1.1, (t - 0.45) / 0.15)
		if not s.hit then
			s.hit = true
			playSound(CONFIG.Sounds.Stab, f.rig.seg.Torso, 3, 0.8, 60)
			flash(s.plr, Color3.fromRGB(170, 0, 0), 0.1, 1, 1.2)
		end
	elseif t < 1.5 then
		thrust = -1.1
		cf = s.start * C((math.random() - 0.5) * 0.12, 0.6 + (math.random() - 0.5) * 0.12, 0)
	elseif t < 2.0 then
		local a = smooth((t - 1.5) / 0.5)
		thrust = lerp(-1.1, -2.2, a)
		cf = s.start * C(0, 0.6 - a * 2.2, 0) * A(a * 1.3, 0, 0)
		if not s.dark then
			s.dark = true
			flash(s.plr, Color3.new(0, 0, 0), 1, 0, 0.5)
		end
	else
		thrust = -2.2
		cf = s.start * C(0, -1.6, 0) * A(1.3, 0, 0)
	end
	if s.hrp.Parent then
		s.hrp.CFrame = cf
	end
	local rig = f.rig
	rig:pose(C(f.pos) * A(0, f.yaw, 0), now, 0, "stab", thrust)
	rig:apply()
	if t >= 2.3 then
		self.stab = nil
		f.mode = "patrol"
		f.path = nil
		f.waitUntil = now + 2
	end
end

-- --------------------------------------------------------------------
-- start, loop, end
-- --------------------------------------------------------------------
function Match:start(plrs, monsterPlr)
	activeMatches[self] = true
	for _, plr in ipairs(plrs) do
		self.players[plr] = { role = (plr == monsterPlr) and "monster" or "survivor", status = "alive" }
		local st = PS[plr]
		st.match = self
		st.role = self.players[plr].role
	end

	-- survivors spawn around the campfire (Corn Field) or inside the barn (Nightmare)
	local i = 0
	for plr, info in pairs(self.players) do
		local st = PS[plr]
		if info.role == "survivor" and st.char and st.hrp then
			i += 1
			local a = i * (math.pi * 2 / 4) + 0.6
			local r = (self.kind == "nightmare") and 6 or 9
			local p = self.center + Vector3.new(math.cos(a) * r, 4, math.sin(a) * r)
			st.char:PivotTo(CFrame.lookAt(p, Vector3.new(self.center.X, p.Y, self.center.Z)))
			st.hrp.AssemblyLinearVelocity = Vector3.zero
			st.battery = CONFIG.FlashlightBattery
			st.flashOn = false
			plr.CameraMode = CONFIG.FirstPerson and Enum.CameraMode.LockFirstPerson or Enum.CameraMode.Classic
			plr.CameraMaxZoomDistance = CONFIG.FirstPerson and 0.5 or 14
			plr.CameraMinZoomDistance = 0.5
			local tool = makeFlashlight(plr)
			tool.Parent = plr:FindFirstChildOfClass("Backpack") or plr
			st.tool = tool
			if self.kind == "nightmare" then
				showMessage(plr, "You're locked in the barn... find a way out. Stay off the farmer's land.", 7, Color3.fromRGB(255, 200, 160))
			else
				showMessage(plr, "Find the 3 symbols. Press them at the gate in dot order. Stay quiet...", 7)
			end
		end
	end

	if monsterPlr then
		self:setupMonsterPlayer(monsterPlr)
	else
		self:aiInit()
	end
	if self.kind == "nightmare" then
		self:farmerInit()
	end

	self.startTime = os.clock()
	self.hudT = 0
	self.flickT = 0
	self.conn = RunService.Heartbeat:Connect(function(dt)
		local ok, err = pcall(function()
			self:step(math.min(dt, 0.1))
		end)
		if not ok then
			warn("[CornField] match error: " .. tostring(err))
		end
	end)
end

function Match:step(dt)
	if self.ended then
		return
	end
	local now = os.clock()
	local left = CONFIG.MatchTime - (now - self.startTime)
	local flick = false
	self.flickT += dt
	if self.flickT > 0.1 then
		self.flickT = 0
		flick = true
	end

	-- survivors: escaping, flashlight battery
	for plr, info in pairs(self.players) do
		local st = PS[plr]
		if info.status == "alive" then
			if not st or not st.hrp or not st.hrp.Parent or not st.hum or st.hum.Health <= 0 then
				if info.role == "survivor" then
					self:removePlayer(plr, "caught")
				end
			elseif info.role == "survivor" then
				if self.kind == "corn" and self.puzzle.opened and st.hrp.Position.X < self.origin.X - 3 then
					self:escaped(plr)
				end
				if st.flashOn then
					st.battery = math.max(0, st.battery - dt)
					local fx = st.flashFx
					if fx and flick then
						-- the light flickers when the battery is low
						local low = st.battery < CONFIG.FlashlightBattery * 0.2
						local mul = low and (0.45 + 0.55 * math.clamp(0.5 + math.noise(now * 9, plr.UserId % 97), 0, 1)) or 1
						fx.spot.Brightness = fx.spotB * mul
						fx.core.Brightness = fx.coreB * mul
					end
					if st.battery <= 0 and st.tool then
						st.hum:UnequipTools()
						showMessage(plr, "The flashlight died...", 3, Color3.fromRGB(255, 150, 120))
					end
				end
			end
		end
	end

	-- the monster (and the farmer)
	if self.grab then
		self:grabStep(dt, now)
	elseif self.monPlr then
		self:monPlayerStep(dt, now)
	elseif self.mon then
		self:aiStep(dt, now)
	end
	if self.farmer then
		self:farmerStep(dt, now)
	end
	if self.police then
		self:policeStep(dt, now)
	end

	-- flickering lights
	if flick then
		for _, f in ipairs(self.flickers) do
			if f.light.Parent then
				f.light.Brightness = f.base * (1 - f.amt + f.amt * 2 * math.clamp(0.5 + math.noise(now * 3, f.seed), 0, 1))
			end
		end
	end

	-- HUD
	self.hudT += dt
	if self.hudT > 0.25 then
		self.hudT = 0
		local clock = string.format("%d:%02d", math.max(0, math.floor(left / 60)), math.max(0, math.floor(left % 60)))
		local alive = #self:survivors()
		local survivorText
		if self.kind == "nightmare" then
			if not self.barnOpen then
				survivorText = "Get out of the barn  |  " .. clock
			else
				local pol = self.police
				local polText = "Police: call from the shed"
				if pol.state == "called" then
					polText = "Police: " .. math.max(0, math.ceil(pol.arriveAt - now)) .. "s"
				elseif pol.state == "arriving" then
					polText = "Police: coming!"
				elseif pol.state == "here" then
					polText = "Police: GET IN THE CAR"
				elseif pol.state == "leaving" then
					polText = "Police: leaving"
				end
				local keyText = self.keyHolder and "Key: YES" or "Key: in the farm"
				local gateText = self.gateUnlocked and "Gate: OPEN" or "Gate: locked"
				survivorText = keyText .. "  |  " .. polText .. "  |  " .. gateText .. "  |  " .. clock
			end
		else
			local gate = self.puzzle.opened and "GATE OPEN - GET OUT!" or ("Gate code: " .. #self.puzzle.input .. "/3")
			survivorText = "Find the symbols  |  " .. gate .. "  |  " .. clock
		end
		for plr, info in pairs(self.players) do
			if info.status == "alive" then
				if info.role == "survivor" then
					setTop(plr, survivorText)
				else
					setTop(plr, "CORN MONSTER  |  Survivors left: " .. alive .. "  |  " .. clock)
				end
			end
		end
	end

	-- end of the match?
	if self.grab or self.stab then
		return
	end
	local anyAlive = #self:survivors() > 0
	if not anyAlive or left <= 0 then
		if left <= 0 then
			for plr, info in pairs(self.players) do
				if info.status == "alive" and info.role == "survivor" then
					showMessage(plr, "The night swallowed you... time is up.", 4, Color3.fromRGB(255, 130, 110))
					self:removePlayer(plr, "caught")
				end
			end
		end
		if self.monPlr and self.players[self.monPlr] and self.players[self.monPlr].status == "alive" then
			local caughtAll = true
			for _, info in pairs(self.players) do
				if info.role == "survivor" and info.status == "escaped" then
					caughtAll = false
				end
			end
			showMessage(self.monPlr, caughtAll and "You caught everyone!" or "Some of them got away...", 4)
		end
		self:finish()
	end
end

function Match:finish()
	if self.ended then
		return
	end
	self.ended = true
	if self.conn then
		self.conn:Disconnect()
	end
	if self.hideConn then
		self.hideConn:Disconnect()
	end
	task.delay(4.5, function()
		for plr in pairs(self.players) do
			local st = PS[plr]
			if st and st.match == self then
				sendToLobby(plr)
			end
		end
		task.wait(1)
		if self.folder then
			self.folder:Destroy()
		end
		activeMatches[self] = nil
		if self.onFinished then
			self.onFinished()
		end
	end)
end

-- ====================================================================
-- THE LOBBY (wooden walls, red carpets, couch, 4 elevators)
-- ====================================================================
local lobbyFolder = make("Folder", { Name = "Lobby" }, workspace)
local elevators = {}

local function L(x, y, z)
	return LOBBY + Vector3.new(x, y, z)
end

local WOOD = Color3.fromRGB(112, 68, 40)
local WOOD_DARK = Color3.fromRGB(74, 44, 26)
local WOOD_TRIM = Color3.fromRGB(58, 34, 20)
local RED = Color3.fromRGB(150, 22, 28)
local RED_DARK = Color3.fromRGB(105, 14, 20)
local GOLD = Color3.fromRGB(196, 156, 72)
local ROOM_W, ROOM_D, ROOM_H = 100, 72, 26
local HW, HD = ROOM_W / 2, ROOM_D / 2

local function buildLobby()
	local f = lobbyFolder
	-- floor + ceiling
	solid({ Name = "Floor", Size = Vector3.new(ROOM_W + 4, 2, ROOM_D + 4), Position = L(0, -1, 0), Material = Enum.Material.WoodPlanks, Color = Color3.fromRGB(96, 60, 34) }, f)
	solid({ Name = "Ceiling", Size = Vector3.new(ROOM_W + 4, 2, ROOM_D + 4), Position = L(0, ROOM_H + 1, 0), Material = Enum.Material.WoodPlanks, Color = Color3.fromRGB(66, 42, 26) }, f)
	for x = -HW + 8, HW - 8, 14 do
		part({ Name = "Beam", Size = Vector3.new(1.6, 1.6, ROOM_D), Position = L(x, ROOM_H - 0.8, 0), Material = Enum.Material.Wood, Color = WOOD_TRIM }, f)
	end

	-- walls (brown wood) with dark wainscoting, trim and pillars
	local function wallPiece(size, pos)
		solid({ Name = "Wall", Size = size, Position = pos, Material = Enum.Material.Wood, Color = WOOD }, f)
	end
	wallPiece(Vector3.new(ROOM_W + 4, ROOM_H, 2), L(0, ROOM_H / 2, -HD - 1)) -- south
	wallPiece(Vector3.new(2, ROOM_H, ROOM_D), L(-HW - 1, ROOM_H / 2, 0)) -- west
	wallPiece(Vector3.new(2, ROOM_H, ROOM_D), L(HW + 1, ROOM_H / 2, 0)) -- east
	-- north wall has 4 elevator openings
	local doorW, doorH = 8, 11
	local ex = { -33, -11, 11, 33 }
	wallPiece(Vector3.new(ROOM_W + 4, ROOM_H - doorH, 2), L(0, doorH + (ROOM_H - doorH) / 2, HD + 1))
	local edges = { -HW - 2 }
	for _, x in ipairs(ex) do
		edges[#edges + 1] = x - doorW / 2
		edges[#edges + 1] = x + doorW / 2
	end
	edges[#edges + 1] = HW + 2
	for i = 1, #edges, 2 do
		local a, b = edges[i], edges[i + 1]
		wallPiece(Vector3.new(b - a, doorH, 2), L((a + b) / 2, doorH / 2, HD + 1))
	end

	-- wainscoting (lower dark panels) on the walls
	local function wainscot(size, pos)
		part({ Name = "Wainscot", Size = size, Position = pos, Material = Enum.Material.WoodPlanks, Color = WOOD_DARK }, f)
	end
	wainscot(Vector3.new(ROOM_W, 4, 0.3), L(0, 2, -HD + 0.15))
	wainscot(Vector3.new(0.3, 4, ROOM_D), L(-HW + 0.15, 2, 0))
	wainscot(Vector3.new(0.3, 4, ROOM_D), L(HW - 0.15, 2, 0))
	for i = 1, #edges, 2 do
		local a, b = math.max(edges[i], -HW), math.min(edges[i + 1], HW)
		wainscot(Vector3.new(b - a, 4, 0.3), L((a + b) / 2, 2, HD - 0.15))
	end
	-- chair rail + crown molding
	for _, y in ipairs({ 4.1, ROOM_H - 0.4 }) do
		part({ Name = "Trim", Size = Vector3.new(ROOM_W, 0.4, 0.5), Position = L(0, y, -HD + 0.25), Material = Enum.Material.Wood, Color = WOOD_TRIM }, f)
		part({ Name = "Trim", Size = Vector3.new(0.5, 0.4, ROOM_D), Position = L(-HW + 0.25, y, 0), Material = Enum.Material.Wood, Color = WOOD_TRIM }, f)
		part({ Name = "Trim", Size = Vector3.new(0.5, 0.4, ROOM_D), Position = L(HW - 0.25, y, 0), Material = Enum.Material.Wood, Color = WOOD_TRIM }, f)
	end
	part({ Name = "Trim", Size = Vector3.new(ROOM_W, 0.4, 0.5), Position = L(0, ROOM_H - 0.4, HD - 0.25), Material = Enum.Material.Wood, Color = WOOD_TRIM }, f)
	-- pillars
	for _, x in ipairs({ -HW + 0.6, -22, 0, 22, HW - 0.6 }) do
		part({ Name = "Pillar", Size = Vector3.new(1.6, ROOM_H, 1.2), Position = L(x, ROOM_H / 2, -HD + 0.6), Material = Enum.Material.Wood, Color = WOOD_TRIM }, f)
	end
	for _, z in ipairs({ -HD + 12, -12, 12, HD - 12 }) do
		part({ Name = "Pillar", Size = Vector3.new(1.2, ROOM_H, 1.6), Position = L(-HW + 0.6, ROOM_H / 2, z), Material = Enum.Material.Wood, Color = WOOD_TRIM }, f)
		part({ Name = "Pillar", Size = Vector3.new(1.2, ROOM_H, 1.6), Position = L(HW - 0.6, ROOM_H / 2, z), Material = Enum.Material.Wood, Color = WOOD_TRIM }, f)
	end

	-- red carpets with gold trim
	local function carpet(size, pos, color)
		part({ Name = "Carpet", Size = size, Position = pos, Material = Enum.Material.Fabric, Color = color or RED }, f)
		part({ Name = "CarpetTrim", Size = Vector3.new(size.X + 0.6, size.Y - 0.02, size.Z + 0.6), Position = pos - Vector3.new(0, 0.01, 0), Material = Enum.Material.Fabric, Color = GOLD }, f)
	end
	carpet(Vector3.new(ROOM_W - 6, 0.12, 9), L(0, 0.07, HD - 6))
	carpet(Vector3.new(10, 0.12, 39), L(0, 0.08, 4.5))
	carpet(Vector3.new(28, 0.12, 18), L(0, 0.08, -25), RED_DARK)
	part({ Name = "RugPattern", Size = Vector3.new(22, 0.13, 12), Position = L(0, 0.09, -25), Material = Enum.Material.Fabric, Color = RED }, f)
	carpet(Vector3.new(10, 0.12, 22), L(-38, 0.08, 0), RED_DARK)

	-- spawn point
	local spawn = make("SpawnLocation", { Name = "LobbySpawn", Anchored = true, Neutral = true, Size = Vector3.new(6, 0.2, 6), Position = L(0, 0.1, -8), Transparency = 1, CanCollide = false, Duration = 0 }, f)
	local spawnDecal = spawn:FindFirstChildOfClass("Decal")
	if spawnDecal then
		spawnDecal:Destroy()
	end

	-- the couch (players can sit on it)
	local couchCF = C(L(0, 0, -29)) * A(0, math.pi, 0)
	local leather = Color3.fromRGB(116, 64, 40)
	local leatherDark = Color3.fromRGB(86, 46, 28)
	lp(f, couchCF, "CouchBase", Vector3.new(15, 1.6, 4.6), C(0, 1.3, 0), leatherDark, Enum.Material.Fabric, { CanCollide = true })
	lp(f, couchCF, "CouchBack", Vector3.new(15, 3.6, 1.2), C(0, 3.6, 2.1) * A(-0.1, 0, 0), leatherDark, Enum.Material.Fabric, { CanCollide = true })
	for _, x in ipairs({ -8, 8 }) do
		lp(f, couchCF, "Armrest", Vector3.new(1.2, 2.6, 4.8), C(x, 2, 0), leatherDark, Enum.Material.Fabric, { CanCollide = true })
		lp(f, couchCF, "ArmTop", Vector3.new(1.5, 0.5, 4.9), C(x, 3.35, 0), leather, Enum.Material.Fabric)
	end
	for i = -1, 1 do
		local seat = make("Seat", { Name = "CouchSeat", Anchored = true, Size = Vector3.new(4.8, 0.8, 3.8), CFrame = couchCF * C(i * 4.9, 2.5, -0.3), Color = leather, Material = Enum.Material.Fabric, TopSurface = Enum.SurfaceType.Smooth, BottomSurface = Enum.SurfaceType.Smooth }, f)
		seat.CanCollide = true
		lp(f, couchCF, "BackCushion", Vector3.new(4.6, 2.6, 0.7), C(i * 4.9, 4.1, 1.45) * A(-0.12, 0, 0), leather, Enum.Material.Fabric)
		for _, bx in ipairs({ -1.2, 0, 1.2 }) do
			lp(f, couchCF, "Button", Vector3.new(0.18, 0.18, 0.1), C(i * 4.9 + bx, 4.3, 1.08) * A(-0.12, 0, 0), leatherDark, Enum.Material.Fabric)
		end
	end
	for _, x in ipairs({ -8, 8 }) do
		for _, z in ipairs({ -2, 2 }) do
			lp(f, couchCF, "CouchLeg", Vector3.new(0.5, 0.5, 0.5), C(x, 0.25, z), WOOD_TRIM, Enum.Material.Wood)
		end
	end
	lp(f, couchCF, "Pillow", Vector3.new(2, 1.8, 0.6), C(-6, 3.5, 0.9) * A(-0.2, 0.3, 0.1), RED, Enum.Material.Fabric)
	lp(f, couchCF, "Pillow", Vector3.new(2, 1.8, 0.6), C(6, 3.5, 0.9) * A(-0.2, -0.3, -0.1), RED, Enum.Material.Fabric)

	-- coffee table
	local tcf = C(L(0, 0, -22.5))
	lp(f, tcf, "TableTop", Vector3.new(8, 0.4, 3.6), C(0, 1.9, 0), WOOD_DARK, Enum.Material.Wood, { CanCollide = true })
	for _, x in ipairs({ -3.6, 3.6 }) do
		for _, z in ipairs({ -1.5, 1.5 }) do
			lp(f, tcf, "TableLeg", Vector3.new(0.35, 1.7, 0.35), C(x, 0.85, z), WOOD_TRIM, Enum.Material.Wood)
		end
	end
	lp(f, tcf, "Book", Vector3.new(1.4, 0.3, 1), C(-2, 2.25, 0.3) * A(0, 0.3, 0), Color3.fromRGB(60, 20, 20), Enum.Material.SmoothPlastic)
	lp(f, tcf, "Book", Vector3.new(1.3, 0.25, 0.9), C(-2, 2.52, 0.3) * A(0, -0.1, 0), Color3.fromRGB(30, 50, 40), Enum.Material.SmoothPlastic)
	lp(f, tcf, "Mug", Vector3.new(0.6, 0.45, 0.45), C(1.8, 2.4, -0.4) * A(0, 0, math.rad(90)), Color3.fromRGB(220, 220, 210), Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Cylinder })
	local candle = lp(f, tcf, "Candle", Vector3.new(0.3, 0.8, 0.3), C(0.4, 2.5, 0.5), Color3.fromRGB(240, 230, 200), Enum.Material.SmoothPlastic)
	local flame = lp(f, tcf, "Flame", Vector3.new(0.15, 0.3, 0.15), C(0.4, 3.05, 0.5), Color3.fromRGB(255, 190, 80), Enum.Material.Neon)
	make("PointLight", { Color = Color3.fromRGB(255, 180, 90), Range = 10, Brightness = 0.8 }, flame)
	candle.Name = "Candle"

	-- floor lamps next to the couch
	for _, x in ipairs({ -11, 11 }) do
		local cf = C(L(x, 0, -30))
		lp(f, cf, "LampBase", Vector3.new(0.3, 1.8, 1.8), C(0, 0.15, 0) * A(0, 0, math.rad(90)), WOOD_TRIM, Enum.Material.Metal, { Shape = Enum.PartType.Cylinder })
		lp(f, cf, "LampPole", Vector3.new(0.25, 7, 0.25), C(0, 3.6, 0), GOLD, Enum.Material.Metal)
		local shade = lp(f, cf, "LampShade", Vector3.new(1.8, 2.2, 2.2), C(0, 7.5, 0) * A(0, 0, math.rad(90)), Color3.fromRGB(240, 210, 160), Enum.Material.Fabric, { Shape = Enum.PartType.Cylinder })
		make("PointLight", { Color = Color3.fromRGB(255, 200, 130), Range = 20, Brightness = 1.2, Shadows = true }, shade)
	end

	-- fireplace on the west wall
	local fcf = C(L(-HW, 0, 0)) * A(0, -math.pi / 2, 0) -- faces +X into the room
	lp(f, fcf, "Hearth", Vector3.new(12, 0.6, 4), C(0, 0.3, -1.6), Color3.fromRGB(80, 74, 70), Enum.Material.Slate, { CanCollide = true })
	lp(f, fcf, "BrickL", Vector3.new(2.4, 9, 2), C(-4.6, 4.5, -1), Color3.fromRGB(120, 54, 40), Enum.Material.Brick, { CanCollide = true })
	lp(f, fcf, "BrickR", Vector3.new(2.4, 9, 2), C(4.6, 4.5, -1), Color3.fromRGB(120, 54, 40), Enum.Material.Brick, { CanCollide = true })
	lp(f, fcf, "BrickTop", Vector3.new(11.6, 3, 2), C(0, 7.5, -1), Color3.fromRGB(120, 54, 40), Enum.Material.Brick, { CanCollide = true })
	lp(f, fcf, "Firebox", Vector3.new(6.8, 6, 0.6), C(0, 3, -0.3), Color3.fromRGB(16, 12, 10), Enum.Material.Slate)
	lp(f, fcf, "Mantel", Vector3.new(13, 0.6, 2.8), C(0, 9.3, -1.3), WOOD_TRIM, Enum.Material.Wood)
	for i = 1, 3 do
		lp(f, fcf, "FireLog", Vector3.new(4, 0.5, 0.5), C(0, 0.9 + i * 0.1, -1.4 - i * 0.2) * A(0, i * 0.4, 0), Color3.fromRGB(70, 44, 26), Enum.Material.Wood, { Shape = Enum.PartType.Cylinder })
	end
	local fireCore = lp(f, fcf, "FireCore", Vector3.new(2.6, 0.3, 0.8), C(0, 1, -1.6), Color3.fromRGB(255, 110, 30), Enum.Material.Neon)
	make("Fire", { Size = 4, Heat = 8, Color = Color3.fromRGB(255, 140, 50), SecondaryColor = Color3.fromRGB(255, 60, 20) }, fireCore)
	make("PointLight", { Color = Color3.fromRGB(255, 140, 60), Range = 26, Brightness = 2, Shadows = true }, fireCore)
	lp(f, fcf, "PaintingFrame", Vector3.new(7, 5, 0.3), C(0, 14.5, -0.2), GOLD, Enum.Material.Wood)
	local canvas = lp(f, fcf, "Painting", Vector3.new(6.2, 4.2, 0.1), C(0, 14.5, -0.4), Color3.fromRGB(24, 34, 20), Enum.Material.Fabric)
	surfaceText(canvas, Enum.NormalId.Front, "THE HARVEST", Color3.fromRGB(200, 170, 70), Enum.Font.Antique)

	-- monster statue + game pass stand on the east side
	local statueCF = C(L(HW - 9, 0, -6)) * A(0, math.pi / 2, 0) -- faces -X into the room
	lp(f, statueCF, "Pedestal", Vector3.new(6, 2, 6), C(0, 1, 0), Color3.fromRGB(60, 56, 52), Enum.Material.Marble, { CanCollide = true })
	lp(f, statueCF, "PedestalTrim", Vector3.new(6.4, 0.4, 6.4), C(0, 2.1, 0), GOLD, Enum.Material.Metal)
	local statue = Monster.new(f, 0.6)
	statue:assemble(statueCF * C(0, 2.3, 0))
	statue.model.Name = "CornMonsterStatue"
	for _, s in ipairs({ statue.stepA, statue.stepB, statue.growlSound, statue.rustleSound }) do
		s:Destroy()
	end
	local plaque = lp(f, statueCF, "Plaque", Vector3.new(5, 1.6, 0.3), C(0, 1, -3.1), WOOD_TRIM, Enum.Material.Wood)
	surfaceText(plaque, Enum.NormalId.Front, "PLAY AS THE CORN MONSTER\nBEAT NORMAL MODE or " .. CONFIG.GamepassPrice .. " R$ GAME PASS", GOLD)
	local spotPart = part({ Name = "StatueLight", Size = Vector3.new(0.4, 0.4, 0.4), CFrame = CFrame.lookAt(L(HW - 14, 14, -6), L(HW - 9, 5, -6)), Transparency = 1 }, f)
	make("SpotLight", { Face = Enum.NormalId.Front, Range = 22, Angle = 40, Brightness = 3, Color = Color3.fromRGB(190, 255, 140) }, spotPart)
	local prompt = make("ProximityPrompt", {
		ActionText = "Play as Monster", ObjectText = "Beat Normal or get the Game Pass", HoldDuration = 0.3, MaxActivationDistance = 10,
		RequiresLineOfSight = false,
	}, plaque)
	prompt.Triggered:Connect(function(plr)
		local st = PS[plr]
		if not st then
			return
		end
		if st.ownsPass or st.beatNormal then
			st.wantMonster = not st.wantMonster
			if st.wantMonster then
				showMessage(plr, "Monster mode ON. Get in an elevator with friends - you'll be the Corn Monster!", 5, Color3.fromRGB(190, 255, 120))
			else
				showMessage(plr, "Monster mode OFF. You'll play as a survivor.", 4)
			end
		elseif CONFIG.MonsterGamepassId ~= 0 then
			showMessage(plr, "Beat Normal mode to unlock the Corn Monster - or get the game pass!", 5, Color3.fromRGB(255, 220, 140))
			MarketplaceService:PromptGamePassPurchase(plr, CONFIG.MonsterGamepassId)
		else
			showMessage(plr, "Beat Normal mode to unlock playing as the Corn Monster!", 5, Color3.fromRGB(255, 220, 140))
		end
	end)

	-- how to play board on the west wall
	local board = part({ Name = "RulesBoard", Size = Vector3.new(0.3, 9, 13), Position = L(-HW + 0.4, 9, -22), Color = WOOD_TRIM, Material = Enum.Material.Wood }, f)
	surfaceText(board, Enum.NormalId.Right, "HOW TO PLAY\n\nNORMAL: find the 3 glowing symbols, press them at the gate in dot order, escape the field.\n\nNIGHTMARE: get out of the barn, find the rusty key on the farm, call the police, unlock the gate, get in the car.\n\nShift = sprint   Flashlight = makes him go away", Color3.fromRGB(235, 215, 170), Enum.Font.Antique, Color3.fromRGB(34, 22, 14))

	-- title sign over the elevators
	local title = part({ Name = "TitleSign", Size = Vector3.new(34, 4.5, 0.4), Position = L(0, 20.5, HD - 0.3), Color = WOOD_TRIM, Material = Enum.Material.Wood }, f)
	surfaceText(title, Enum.NormalId.Front, "CORN FIELD", Color3.fromRGB(230, 190, 90), Enum.Font.Antique)

	-- chandeliers
	for _, x in ipairs({ -26, 0, 26 }) do
		local cf = C(L(x, 0, 0))
		lp(f, cf, "Chain", Vector3.new(0.2, 4, 0.2), C(0, ROOM_H - 2, 0), GOLD, Enum.Material.Metal)
		lp(f, cf, "Ring", Vector3.new(0.4, 6, 6), C(0, ROOM_H - 4.2, 0) * A(0, 0, math.rad(90)), GOLD, Enum.Material.Metal, { Shape = Enum.PartType.Cylinder })
		for i = 1, 6 do
			local a = i / 6 * math.pi * 2
			lp(f, cf, "Candle", Vector3.new(0.3, 0.8, 0.3), C(math.cos(a) * 2.6, ROOM_H - 3.6, math.sin(a) * 2.6), Color3.fromRGB(240, 230, 200), Enum.Material.SmoothPlastic)
			lp(f, cf, "Flame", Vector3.new(0.18, 0.3, 0.18), C(math.cos(a) * 2.6, ROOM_H - 3.05, math.sin(a) * 2.6), Color3.fromRGB(255, 200, 100), Enum.Material.Neon)
		end
		local glow = lp(f, cf, "ChandelierGlow", Vector3.new(0.5, 0.5, 0.5), C(0, ROOM_H - 4.5, 0), Color3.new(1, 1, 1), Enum.Material.SmoothPlastic, { Transparency = 1 })
		make("PointLight", { Color = Color3.fromRGB(255, 205, 140), Range = 42, Brightness = 1.3, Shadows = true }, glow)
	end

	-- wall sconces
	local function sconce(pos, normal)
		local cf = CFrame.lookAt(pos, pos + normal)
		lp(f, cf, "SconcePlate", Vector3.new(0.8, 1.4, 0.2), C(0, 0, 0), GOLD, Enum.Material.Metal)
		local bulb = lp(f, cf, "SconceBulb", Vector3.new(0.5, 0.7, 0.5), C(0, 0.4, -0.45), Color3.fromRGB(255, 210, 140), Enum.Material.Neon)
		make("PointLight", { Color = Color3.fromRGB(255, 190, 120), Range = 14, Brightness = 0.9 }, bulb)
	end
	for _, z in ipairs({ -32, -10, 10 }) do
		sconce(L(-HW + 0.2, 9, z), Vector3.new(1, 0, 0))
		sconce(L(HW - 0.2, 9, z), Vector3.new(-1, 0, 0))
	end
	for _, x in ipairs({ -40, -14, 14, 40 }) do
		sconce(L(x, 9, -HD + 0.2), Vector3.new(0, 0, 1))
	end

	-- potted corn plants + bookshelf
	for _, p in ipairs({ L(-HW + 3, 0, -HD + 3), L(HW - 3, 0, -HD + 3), L(-HW + 3, 0, HD - 2), L(HW - 3, 0, HD - 2) }) do
		Props.pottedCorn(f, p)
	end
	local shelfCF = C(L(HW - 1.4, 0, 16)) * A(0, math.pi / 2, 0)
	lp(f, shelfCF, "Bookshelf", Vector3.new(10, 11, 2), C(0, 5.5, 0), WOOD_DARK, Enum.Material.Wood, { CanCollide = true })
	for row = 0, 3 do
		lp(f, shelfCF, "Shelf", Vector3.new(9.6, 0.25, 1.9), C(0, 1.2 + row * 2.6, -0.1), WOOD_TRIM, Enum.Material.Wood)
		local x = -4.4
		while x < 4.2 do
			local w = 0.35 + math.random() * 0.3
			local h = 1.4 + math.random() * 0.8
			local col = Color3.fromHSV(math.random(), 0.5, 0.25 + math.random() * 0.3)
			lp(f, shelfCF, "Book", Vector3.new(w, h, 1.4), C(x + w / 2, 1.35 + row * 2.6 + h / 2, -0.2), col, Enum.Material.SmoothPlastic)
			x += w + 0.04
		end
	end
	Props.hay(f, L(-30, 0, -30), 0.3)
	Props.pumpkin(f, L(-26, 0, -31), 0.4, 2.2, true)
	Props.pumpkin(f, L(26, 0, -31), -0.4, 2.2, true)
end

-- more lobby details (v1.01)
local UPDATE_LOG = [[UPDATE LOG

v1.01
- NIGHTMARE MODE! Escape the barn, find the rusty key, call the police, drive away
- New enemy: the Farmer. Stay off his farm...
- The Corn Monster rips holes in the corn walls (and the ground)
- Scarier, twitchier monster + new jumpscares
- He comes out less often (but you'll know when he does)
- New detailed flashlight, first person view
- Unlimited sprint
- Beat Normal mode to unlock playing as the Corn Monster
- Lobby: update log, clock, front desk, trophy case and more

v1.0
- Corn Field release: lobby, 4 elevators, Normal mode, badge, game pass]]

local clockHands
local function buildLobbyExtras()
	local f = lobbyFolder

	-- update log on the west wall
	local logFrame = part({ Name = "UpdateLogFrame", Size = Vector3.new(0.4, 12, 10), Position = L(-HW + 0.3, 10, 18), Color = GOLD, Material = Enum.Material.Wood }, f)
	local log = part({ Name = "UpdateLog", Size = Vector3.new(0.2, 11.4, 9.4), Position = L(-HW + 0.55, 10, 18), Color = Color3.fromRGB(30, 20, 12), Material = Enum.Material.Wood }, f)
	local label = surfaceText(log, Enum.NormalId.Right, UPDATE_LOG, Color3.fromRGB(240, 222, 180), Enum.Font.Antique)
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.TextYAlignment = Enum.TextYAlignment.Top
	local _ = logFrame

	-- grandfather clock (south wall) with moving hands and a swinging pendulum
	local ccf = C(L(-36, 0, -HD + 1)) * A(0, math.pi, 0) -- faces +Z into the room
	lp(f, ccf, "ClockBase", Vector3.new(2.8, 1, 1.6), C(0, 0.5, 0), WOOD_TRIM, Enum.Material.Wood, { CanCollide = true })
	lp(f, ccf, "ClockCase", Vector3.new(2.4, 8, 1.4), C(0, 5, 0), WOOD_DARK, Enum.Material.Wood, { CanCollide = true })
	lp(f, ccf, "ClockTop", Vector3.new(2.8, 0.6, 1.6), C(0, 9.3, 0), WOOD_TRIM, Enum.Material.Wood)
	lp(f, ccf, "ClockGlass", Vector3.new(1.6, 3.6, 0.05), C(0, 3.6, -0.73), Color3.fromRGB(160, 170, 175), Enum.Material.Glass, { Transparency = 0.6 })
	lp(f, ccf, "ClockFace", Vector3.new(0.05, 1.9, 1.9), C(0, 7.6, -0.72) * A(0, math.rad(90), 0), Color3.fromRGB(235, 225, 200), Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Cylinder })
	lp(f, ccf, "ClockRim", Vector3.new(0.04, 2.1, 2.1), C(0, 7.6, -0.7) * A(0, math.rad(90), 0), GOLD, Enum.Material.Metal, { Shape = Enum.PartType.Cylinder })
	for i = 1, 12 do
		local a = i / 12 * math.pi * 2
		lp(f, ccf, "Tick", Vector3.new(0.08, 0.18, 0.02), C(math.sin(a) * 0.78, 7.6 + math.cos(a) * 0.78, -0.76) * A(0, 0, -a), Color3.fromRGB(30, 20, 14), Enum.Material.SmoothPlastic)
	end
	local hourHand = lp(f, ccf, "HourHand", Vector3.new(0.09, 0.5, 0.02), C(0, 7.85, -0.78), Color3.fromRGB(20, 14, 10), Enum.Material.SmoothPlastic)
	local minuteHand = lp(f, ccf, "MinuteHand", Vector3.new(0.06, 0.75, 0.02), C(0, 7.97, -0.79), Color3.fromRGB(20, 14, 10), Enum.Material.SmoothPlastic)
	local pendulum = lp(f, ccf, "Pendulum", Vector3.new(0.1, 2.6, 0.05), C(0, 4.3, -0.5), GOLD, Enum.Material.Metal)
	local bob = lp(f, ccf, "PendulumBob", Vector3.new(0.05, 0.7, 0.7), C(0, 3.0, -0.5) * A(0, math.rad(90), 0), GOLD, Enum.Material.Metal, { Shape = Enum.PartType.Cylinder })
	clockHands = { cf = ccf, hour = hourHand, minute = minuteHand, pendulum = pendulum, bob = bob }

	-- front desk with a bell and a guest book
	local dcf = C(L(37, 0, 6)) * A(0, math.pi / 2, 0) -- faces -X
	lp(f, dcf, "Desk", Vector3.new(7, 3.6, 2.4), C(0, 1.8, 0), WOOD_DARK, Enum.Material.WoodPlanks, { CanCollide = true })
	lp(f, dcf, "DeskTop", Vector3.new(7.4, 0.3, 2.8), C(0, 3.75, 0), WOOD_TRIM, Enum.Material.Wood)
	lp(f, dcf, "DeskPanel", Vector3.new(6.4, 2.6, 0.05), C(0, 1.9, -1.23), WOOD, Enum.Material.Wood)
	lp(f, dcf, "BellBase", Vector3.new(0.1, 0.7, 0.7), C(-2, 3.95, -0.3) * A(0, 0, math.rad(90)), GOLD, Enum.Material.Metal, { Shape = Enum.PartType.Cylinder })
	local bell = lp(f, dcf, "Bell", Vector3.new(0.6, 0.6, 0.6), C(-2, 4.15, -0.3), GOLD, Enum.Material.Metal, { Shape = Enum.PartType.Ball })
	lp(f, dcf, "GuestBook", Vector3.new(1.6, 0.15, 1.1), C(1, 3.98, -0.2) * A(0, 0.2, 0), Color3.fromRGB(90, 20, 20), Enum.Material.Fabric)
	lp(f, dcf, "Pen", Vector3.new(0.05, 0.05, 0.7), C(1.6, 4.08, -0.2) * A(0, 0.6, 0), Color3.fromRGB(20, 20, 20), Enum.Material.SmoothPlastic)
	local lampShade = lp(f, dcf, "DeskLamp", Vector3.new(0.8, 0.9, 0.9), C(2.8, 4.9, 0.4) * A(0, 0, math.rad(90)), Color3.fromRGB(40, 90, 50), Enum.Material.Glass, { Shape = Enum.PartType.Cylinder })
	lp(f, dcf, "DeskLampPole", Vector3.new(0.12, 1, 0.12), C(2.8, 4.3, 0.4), GOLD, Enum.Material.Metal)
	make("PointLight", { Color = Color3.fromRGB(255, 210, 150), Range = 12, Brightness = 0.9 }, lampShade)
	local deskSign = lp(f, dcf, "DeskSign", Vector3.new(3, 0.8, 0.1), C(0, 3.2, -1.27), GOLD, Enum.Material.Metal)
	surfaceText(deskSign, Enum.NormalId.Front, "FRONT DESK", Color3.fromRGB(40, 24, 12), Enum.Font.Antique)
	local bellPrompt = make("ProximityPrompt", { ActionText = "Ring", ObjectText = "Bell", HoldDuration = 0, MaxActivationDistance = 7, RequiresLineOfSight = false }, bell)
	bellPrompt.Triggered:Connect(function()
		playSound(CONFIG.Sounds.Ding, bell, 1.2, 1.8, 50)
	end)

	-- two armchairs by the coffee table
	for _, side in ipairs({ -1, 1 }) do
		local acf = C(L(side * 12.5, 0, -22)) * A(0, side * math.rad(70), 0)
		local leather = Color3.fromRGB(116, 64, 40)
		lp(f, acf, "ArmchairBase", Vector3.new(4.2, 1.6, 4), C(0, 1.1, 0), Color3.fromRGB(86, 46, 28), Enum.Material.Fabric, { CanCollide = true })
		lp(f, acf, "ArmchairBack", Vector3.new(4.2, 3.4, 0.9), C(0, 3.1, 1.6) * A(-0.12, 0, 0), Color3.fromRGB(86, 46, 28), Enum.Material.Fabric, { CanCollide = true })
		for _, x in ipairs({ -2.3, 2.3 }) do
			lp(f, acf, "ArmchairArm", Vector3.new(0.7, 2.2, 4), C(x, 1.9, 0), leather, Enum.Material.Fabric)
		end
		local seat = make("Seat", { Name = "ArmchairSeat", Anchored = true, Size = Vector3.new(3.4, 0.6, 3.2), CFrame = acf * C(0, 2.2, -0.2), Color = leather, Material = Enum.Material.Fabric, TopSurface = Enum.SurfaceType.Smooth, BottomSurface = Enum.SurfaceType.Smooth }, f)
		seat.CanCollide = true
	end

	-- windows on the east wall: a cold moon outside
	for _, z in ipairs({ -18, 29 }) do
		part({ Name = "WindowFrame", Size = Vector3.new(0.4, 8, 6), Position = L(HW - 0.2, 10, z), Color = WOOD_TRIM, Material = Enum.Material.Wood }, f)
		local glass = part({ Name = "WindowGlass", Size = Vector3.new(0.1, 7, 5), Position = L(HW - 0.45, 10, z), Color = Color3.fromRGB(30, 40, 70), Material = Enum.Material.Neon, Transparency = 0.55 }, f)
		make("SurfaceLight", { Face = Enum.NormalId.Left, Color = Color3.fromRGB(140, 160, 220), Range = 14, Brightness = 0.6, Angle = 70 }, glass)
		part({ Name = "WindowCross", Size = Vector3.new(0.12, 7, 0.25), Position = L(HW - 0.55, 10, z), Color = WOOD_TRIM, Material = Enum.Material.Wood }, f)
		part({ Name = "WindowCross", Size = Vector3.new(0.12, 0.25, 5), Position = L(HW - 0.55, 10, z), Color = WOOD_TRIM, Material = Enum.Material.Wood }, f)
		for _, s2 in ipairs({ -1, 1 }) do
			part({ Name = "Curtain", Size = Vector3.new(0.3, 9.5, 1.6), Position = L(HW - 0.8, 9.4, z + s2 * 3.4), Color = RED_DARK, Material = Enum.Material.Fabric }, f)
		end
		part({ Name = "CurtainRod", Size = Vector3.new(0.2, 0.2, 9), Position = L(HW - 0.9, 14.4, z), Color = GOLD, Material = Enum.Material.Metal }, f)
	end

	-- trophy case (north-west corner)
	local tcf = C(L(-HW + 1.6, 0, 29)) * A(0, -math.pi / 2, 0) -- faces +X
	lp(f, tcf, "CaseBase", Vector3.new(6, 2.4, 2.6), C(0, 1.2, 0), WOOD_DARK, Enum.Material.Wood, { CanCollide = true })
	lp(f, tcf, "CaseGlass", Vector3.new(6, 4, 2.6), C(0, 4.4, 0), Color3.fromRGB(180, 200, 210), Enum.Material.Glass, { Transparency = 0.75, CanCollide = true })
	lp(f, tcf, "CaseTop", Vector3.new(6.2, 0.3, 2.8), C(0, 6.55, 0), WOOD_TRIM, Enum.Material.Wood)
	lp(f, tcf, "TrophyCup", Vector3.new(1.2, 1.4, 1.4), C(-1.5, 3.4, 0) * A(0, 0, math.rad(90)), GOLD, Enum.Material.Metal, { Shape = Enum.PartType.Cylinder })
	lp(f, tcf, "TrophyCob", Vector3.new(0.6, 1.8, 0.6), C(-1.5, 5, 0), Color3.fromRGB(230, 190, 70), Enum.Material.Metal)
	lp(f, tcf, "TrophyBadge", Vector3.new(1.6, 1.6, 0.2), C(1.5, 4, 0), Color3.fromRGB(120, 20, 20), Enum.Material.SmoothPlastic)
	local plate = lp(f, tcf, "TrophyPlate", Vector3.new(4, 0.8, 0.1), C(0, 1.6, -1.32), GOLD, Enum.Material.Metal)
	surfaceText(plate, Enum.NormalId.Front, "ESCAPED THE CORN FIELD", Color3.fromRGB(40, 24, 12), Enum.Font.Antique)
	make("PointLight", { Color = Color3.fromRGB(255, 220, 160), Range = 8, Brightness = 0.8 }, plate)

	-- coat rack, paintings
	local rcf = C(L(-41, 0, -33))
	lp(f, rcf, "RackPole", Vector3.new(0.3, 7, 0.3), C(0, 3.5, 0), WOOD_TRIM, Enum.Material.Wood)
	lp(f, rcf, "RackFoot", Vector3.new(2, 0.3, 0.3), C(0, 0.15, 0), WOOD_TRIM, Enum.Material.Wood)
	lp(f, rcf, "RackFoot", Vector3.new(0.3, 0.3, 2), C(0, 0.15, 0), WOOD_TRIM, Enum.Material.Wood)
	lp(f, rcf, "Coat", Vector3.new(1.4, 3, 0.7), C(0.5, 5, 0.2) * A(0, 0.3, 0.05), Color3.fromRGB(60, 50, 40), Enum.Material.Fabric)
	lp(f, rcf, "StrawHat", Vector3.new(0.1, 1.8, 1.8), C(0, 7.1, 0) * A(0, 0, math.rad(90)), Color3.fromRGB(186, 156, 92), Enum.Material.Fabric, { Shape = Enum.PartType.Cylinder })
	for _, x in ipairs({ -30, 30 }) do
		part({ Name = "PaintingFrame", Size = Vector3.new(6.4, 4.4, 0.3), Position = L(x, 14.5, -HD + 0.15), Color = GOLD, Material = Enum.Material.Wood }, f)
		local canvas = part({ Name = "Painting", Size = Vector3.new(5.6, 3.6, 0.1), Position = L(x, 14.5, -HD + 0.35), Color = Color3.fromRGB(26, 34, 22), Material = Enum.Material.Fabric }, f)
		surfaceText(canvas, Enum.NormalId.Back, x < 0 and "THE FARM, 1953" or "HE WATCHES", Color3.fromRGB(190, 160, 80), Enum.Font.Antique)
	end

	-- call buttons next to every elevator
	for _, ex in ipairs({ -33, -11, 11, 33 }) do
		part({ Name = "CallPlate", Size = Vector3.new(0.9, 1.8, 0.1), Position = L(ex + 5.4, 4.6, HD - 0.05), Color = GOLD, Material = Enum.Material.Metal }, f)
		part({ Name = "CallUp", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.1, 0.4, 0.4), CFrame = C(L(ex + 5.4, 5.1, HD - 0.12)) * A(0, math.rad(90), 0), Color = Color3.fromRGB(255, 220, 140), Material = Enum.Material.Neon }, f)
		part({ Name = "CallDown", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.1, 0.4, 0.4), CFrame = C(L(ex + 5.4, 4.2, HD - 0.12)) * A(0, math.rad(90), 0), Color = Color3.fromRGB(120, 100, 70), Material = Enum.Material.SmoothPlastic }, f)
	end
end

-- clock hands follow the real time; the pendulum swings
local function runLobbyClock()
	task.spawn(function()
		while clockHands do
			local t = os.date("*t")
			local h = clockHands
			local hourA = ((t.hour % 12) + t.min / 60) / 12 * math.pi * 2
			local minA = (t.min + t.sec / 60) / 60 * math.pi * 2
			local center = h.cf * C(0, 7.6, 0)
			h.hour.CFrame = center * C(0, 0, -0.78) * A(0, 0, hourA) * C(0, 0.25, 0)
			h.minute.CFrame = center * C(0, 0, -0.79) * A(0, 0, minA) * C(0, 0.37, 0)
			local swing = math.sin(os.clock() * math.pi) * 0.18
			local pivot = h.cf * C(0, 5.6, -0.5) * A(0, 0, swing)
			h.pendulum.CFrame = pivot * C(0, -1.3, 0)
			h.bob.CFrame = pivot * C(0, -2.6, 0) * A(0, math.rad(90), 0)
			task.wait(0.1)
		end
	end)
end

-- --------------------------------------------------------------------
-- elevators
-- --------------------------------------------------------------------
local function buildElevator(index, ex)
	local f = make("Model", { Name = "Elevator" .. index }, lobbyFolder)
	local z0 = HD + 2 -- inside of the shaft starts here
	local depth = 12
	local zc = z0 + depth / 2
	local cabColor = Color3.fromRGB(70, 42, 26)

	solid({ Name = "CabFloor", Size = Vector3.new(14, 1, depth), Position = L(ex, -0.5, zc), Material = Enum.Material.Fabric, Color = RED }, f)
	solid({ Name = "CabCeiling", Size = Vector3.new(14, 1, depth + 1), Position = L(ex, 14.5, zc), Material = Enum.Material.Wood, Color = WOOD_TRIM }, f)
	solid({ Name = "CabLeft", Size = Vector3.new(1, 15, depth), Position = L(ex - 6.5, 7, zc), Material = Enum.Material.Wood, Color = cabColor }, f)
	solid({ Name = "CabRight", Size = Vector3.new(1, 15, depth), Position = L(ex + 6.5, 7, zc), Material = Enum.Material.Wood, Color = cabColor }, f)
	solid({ Name = "CabBack", Size = Vector3.new(14, 15, 1), Position = L(ex, 7, z0 + depth + 0.5), Material = Enum.Material.Wood, Color = cabColor }, f)
	part({ Name = "Mirror", Size = Vector3.new(8, 7, 0.1), Position = L(ex, 6.5, z0 + depth - 0.05), Material = Enum.Material.Glass, Color = Color3.fromRGB(160, 170, 175), Reflectance = 0.35, Transparency = 0.1 }, f)
	for _, x in ipairs({ -5.9, 5.9 }) do
		part({ Name = "Rail", Size = Vector3.new(0.3, 0.3, depth - 1), Position = L(ex + x, 3.5, zc), Material = Enum.Material.Metal, Color = GOLD }, f)
		part({ Name = "Panel", Size = Vector3.new(0.15, 6, depth - 1.5), Position = L(ex + (x > 0 and 5.95 or -5.95), 8.5, zc), Material = Enum.Material.WoodPlanks, Color = WOOD_DARK }, f)
	end
	part({ Name = "Rail", Size = Vector3.new(11, 0.3, 0.3), Position = L(ex, 3.5, z0 + depth - 0.4), Material = Enum.Material.Metal, Color = GOLD }, f)
	local lightPanel = part({ Name = "CabLight", Size = Vector3.new(6, 0.2, 6), Position = L(ex, 13.9, zc), Material = Enum.Material.Neon, Color = Color3.fromRGB(255, 225, 170) }, f)
	make("PointLight", { Color = Color3.fromRGB(255, 220, 160), Range = 18, Brightness = 1.1 }, lightPanel)

	-- door frame + sliding doors
	part({ Name = "FrameL", Size = Vector3.new(0.8, 11.4, 0.5), Position = L(ex - 4.4, 5.7, HD - 0.2), Material = Enum.Material.Metal, Color = GOLD }, f)
	part({ Name = "FrameR", Size = Vector3.new(0.8, 11.4, 0.5), Position = L(ex + 4.4, 5.7, HD - 0.2), Material = Enum.Material.Metal, Color = GOLD }, f)
	part({ Name = "FrameTop", Size = Vector3.new(9.6, 0.8, 0.5), Position = L(ex, 11.4, HD - 0.2), Material = Enum.Material.Metal, Color = GOLD }, f)
	part({ Name = "Threshold", Size = Vector3.new(8, 0.15, 2.4), Position = L(ex, 0.08, HD + 1), Material = Enum.Material.DiamondPlate, Color = GOLD }, f)
	local doorL = solid({ Name = "DoorL", Size = Vector3.new(4, 11, 0.5), Position = L(ex - 6, 5.5, HD + 1), Material = Enum.Material.Metal, Color = Color3.fromRGB(150, 116, 60) }, f)
	local doorR = solid({ Name = "DoorR", Size = Vector3.new(4, 11, 0.5), Position = L(ex + 6, 5.5, HD + 1), Material = Enum.Material.Metal, Color = Color3.fromRGB(150, 116, 60) }, f)

	-- sign over the door
	local sign = part({ Name = "Sign", Size = Vector3.new(9.4, 3.2, 0.3), Position = L(ex, 14, HD - 0.3), Material = Enum.Material.SmoothPlastic, Color = Color3.fromRGB(16, 12, 10) }, f)
	local sgui = make("SurfaceGui", { Face = Enum.NormalId.Front, PixelsPerStud = 40, LightInfluence = 0 }, sign)
	local function signLine(y, h, color, font)
		return make("TextLabel", { Position = UDim2.fromScale(0, y), Size = UDim2.fromScale(1, h), BackgroundTransparency = 1, TextColor3 = color, Font = font or Enum.Font.Antique, TextScaled = true, Text = "" }, sgui)
	end
	local titleL = signLine(0.02, 0.34, GOLD)
	local countL = signLine(0.36, 0.3, Color3.fromRGB(240, 230, 210), Enum.Font.GothamBold)
	local statusL = signLine(0.68, 0.3, Color3.fromRGB(160, 230, 140), Enum.Font.GothamBold)
	titleL.Text = "ELEVATOR " .. index

	-- mode buttons inside (Normal on the right wall, Nightmare on the left)
	local function modePanel(xSide, label, color, sub)
		local face = xSide > 0 and Enum.NormalId.Left or Enum.NormalId.Right
		local plate = part({ Name = label .. "Panel", Size = Vector3.new(0.3, 3.4, 3), Position = L(ex + xSide * 5.85, 5.2, z0 + 3.5), Material = Enum.Material.Metal, Color = Color3.fromRGB(30, 26, 22) }, f)
		local g = make("SurfaceGui", { Face = face, PixelsPerStud = 50, LightInfluence = 0 }, plate)
		make("TextLabel", { Size = UDim2.fromScale(1, 0.55), BackgroundTransparency = 1, Text = label, TextColor3 = color, Font = Enum.Font.GothamBlack, TextScaled = true }, g)
		make("TextLabel", { Position = UDim2.fromScale(0, 0.58), Size = UDim2.fromScale(1, 0.38), BackgroundTransparency = 1, Text = sub, TextColor3 = Color3.fromRGB(200, 190, 170), Font = Enum.Font.Gotham, TextScaled = true }, g)
		local btn = part({ Name = label .. "Button", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.3, 0.9, 0.9), Position = L(ex + xSide * 5.65, 3.6, z0 + 3.5), Material = Enum.Material.Neon, Color = color }, f)
		return btn
	end
	local normalBtn = modePanel(1, "NORMAL", Color3.fromRGB(110, 230, 110), "Select")
	local nightBtn = modePanel(-1, "NIGHTMARE", Color3.fromRGB(150, 90, 200), CONFIG.NightmareUnlocked and "Select" or "IN PROGRESS")

	local ev = {
		index = index, x = ex, z0 = z0, depth = depth, players = {}, state = "waiting", mode = "Normal", countdown = nil,
		doorL = doorL, doorR = doorR, countL = countL, statusL = statusL, sign = sign,
	}

	local normalPrompt = make("ProximityPrompt", { ActionText = "Select", ObjectText = "Normal Mode", HoldDuration = 0, MaxActivationDistance = 7, RequiresLineOfSight = false }, normalBtn)
	normalPrompt.Triggered:Connect(function(plr)
		if table.find(ev.players, plr) then
			ev.mode = "Normal"
			for _, p in ipairs(ev.players) do
				showMessage(p, "Mode: NORMAL", 2, Color3.fromRGB(150, 255, 150))
			end
		end
	end)
	local nightPrompt = make("ProximityPrompt", { ActionText = "Select", ObjectText = CONFIG.NightmareUnlocked and "Nightmare Mode" or "Nightmare Mode (In Progress)", HoldDuration = 0, MaxActivationDistance = 7, RequiresLineOfSight = false }, nightBtn)
	nightPrompt.Triggered:Connect(function(plr)
		if CONFIG.NightmareUnlocked and table.find(ev.players, plr) then
			ev.mode = "Nightmare"
			for _, p in ipairs(ev.players) do
				showMessage(p, "Mode: NIGHTMARE", 2, Color3.fromRGB(200, 140, 255))
			end
		else
			showMessage(plr, "Nightmare mode is still in progress. Coming soon!", 3, Color3.fromRGB(200, 150, 255))
		end
	end)

	elevators[index] = ev
	return ev
end

local function setDoors(ev, open)
	local info = TweenInfo.new(1.2, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut)
	local y, z = LOBBY.Y + 5.5, LOBBY.Z + HD + 1
	TweenService:Create(ev.doorL, info, { Position = Vector3.new(LOBBY.X + ev.x - (open and 6 or 2), y, z) }):Play()
	TweenService:Create(ev.doorR, info, { Position = Vector3.new(LOBBY.X + ev.x + (open and 6 or 2), y, z) }):Play()
	playSound(CONFIG.Sounds.Ding, ev.sign, 1.2, 1, 60)
end

local function insideElevator(ev, pos)
	local rel = pos - LOBBY
	return math.abs(rel.X - ev.x) < 6 and rel.Z > ev.z0 and rel.Z < ev.z0 + ev.depth and rel.Y > -2 and rel.Y < 14
end

local startMatchFromElevator -- defined below

local function updateElevator(ev, dt)
	if ev.state == "waiting" then
		-- who is standing inside?
		for i = #ev.players, 1, -1 do
			local plr = ev.players[i]
			local st = PS[plr]
			if not st or not st.hrp or not st.hrp.Parent or not insideElevator(ev, st.hrp.Position) or plr.Parent ~= Players then
				table.remove(ev.players, i)
			end
		end
		for plr, st in pairs(PS) do
			if not st.match and st.hrp and st.hrp.Parent and insideElevator(ev, st.hrp.Position) and not table.find(ev.players, plr) then
				if #ev.players >= CONFIG.MaxPlayersPerElevator then
					st.char:PivotTo(CFrame.new(L(ev.x, 3.5, HD - 6)))
					showMessage(plr, "This elevator is full (4/4). Try another one!", 3, Color3.fromRGB(255, 170, 120))
				else
					table.insert(ev.players, plr)
					showMessage(plr, "Elevator " .. ev.index .. ": pick a mode on the wall buttons.", 3)
				end
			end
		end
		if #ev.players > 0 then
			ev.countdown = (ev.countdown or CONFIG.ElevatorCountdown) - dt
			if ev.countdown <= 0 then
				ev.countdown = nil
				ev.state = "departing"
				setDoors(ev, false)
				local group = table.clone(ev.players)
				task.spawn(startMatchFromElevator, ev, group)
			end
		else
			ev.countdown = nil
		end
	end
	-- sign
	local n = #ev.players
	ev.countL.Text = n .. "/" .. CONFIG.MaxPlayersPerElevator .. " PLAYERS  -  " .. string.upper(ev.mode)
	if ev.state == "waiting" then
		if ev.countdown then
			ev.statusL.Text = "LEAVING IN " .. math.ceil(ev.countdown)
			ev.statusL.TextColor3 = Color3.fromRGB(255, 220, 120)
		else
			ev.statusL.Text = "WALK IN TO PLAY"
			ev.statusL.TextColor3 = Color3.fromRGB(160, 230, 140)
		end
	elseif ev.state == "departing" then
		ev.statusL.Text = "GOING DOWN..."
		ev.statusL.TextColor3 = Color3.fromRGB(255, 160, 110)
	else
		ev.statusL.Text = "GAME IN PROGRESS"
		ev.statusL.TextColor3 = Color3.fromRGB(255, 110, 100)
	end
end

startMatchFromElevator = function(ev, group)
	for _, plr in ipairs(group) do
		showMessage(plr, "Going down into the corn...", 4)
	end
	local match = Match.new(ev.index, ev.mode)
	local ok, err = pcall(function()
		match:build()
	end)
	if not ok then
		warn("[CornField] build failed: " .. tostring(err))
		if match.folder then
			match.folder:Destroy()
		end
		ev.state = "waiting"
		ev.players = {}
		setDoors(ev, true)
		return
	end
	-- only players who are still here and still alive go in
	local final = {}
	for _, plr in ipairs(group) do
		local st = PS[plr]
		if st and plr.Parent == Players and st.hrp and st.hrp.Parent and st.hum and st.hum.Health > 0 and not st.match then
			final[#final + 1] = plr
		end
	end
	ev.players = {}
	if #final == 0 then
		match.folder:Destroy()
		ev.state = "waiting"
		setDoors(ev, true)
		return
	end
	-- who is the monster? A random player who unlocked it (game pass or
	-- beat Normal) and turned monster mode on at the statue.
	local monsterPlr
	local eligible = {}
	for _, plr in ipairs(final) do
		local st = PS[plr]
		if st.wantMonster and (st.ownsPass or st.beatNormal) then
			eligible[#eligible + 1] = plr
		end
	end
	if #eligible > 0 then
		if #final >= 2 then
			monsterPlr = eligible[math.random(#eligible)]
			for _, plr in ipairs(final) do
				if plr == monsterPlr then
					showMessage(plr, "You were picked to be the CORN MONSTER!", 5, Color3.fromRGB(190, 255, 120))
				else
					showMessage(plr, "Someone in your group is the Corn Monster...", 5, Color3.fromRGB(255, 200, 140))
				end
			end
		else
			showMessage(eligible[1], "You need at least 1 survivor with you to be the monster. Playing as a survivor.", 5, Color3.fromRGB(255, 200, 120))
		end
	end
	ev.state = "ingame"
	match.onFinished = function()
		ev.state = "waiting"
		ev.mode = "Normal"
		setDoors(ev, true)
	end
	match:start(final, monsterPlr)
end

-- ====================================================================
-- PLAYERS
-- ====================================================================
saveBeatNormal = function(plr)
	if not progressStore then
		return
	end
	task.spawn(function()
		pcall(function()
			progressStore:UpdateAsync(tostring(plr.UserId), function(old)
				local data = type(old) == "table" and old or {}
				data.beatNormal = true
				return data
			end)
		end)
	end)
end

local function lobbyCFrame()
	local a = math.random() * math.pi * 2
	local p = L(math.cos(a) * 4, 4, -8 + math.sin(a) * 4)
	return CFrame.lookAt(p, L(0, 4, HD))
end

sendToLobby = function(plr)
	local st = PS[plr]
	if not st then
		return
	end
	if st.match then
		local info = st.match.players[plr]
		if info and info.status == "alive" then
			info.status = "left"
		end
	end
	st.match = nil
	st.role = nil
	st.flashOn = false
	st.tool = nil
	st.sprinting = false
	plr.CameraMode = Enum.CameraMode.Classic
	plr.CameraMinZoomDistance = 0.5
	plr.CameraMaxZoomDistance = 25
	if plr.Parent == Players then
		plr:LoadCharacter()
	end
end

local function makeSprintPrompt(plr, st, hrp)
	local att = make("Attachment", { Name = "SprintAttach", Position = Vector3.new(0, -1.2, -3.5) }, hrp)
	local prompt = make("ProximityPrompt", {
		Name = "SprintPrompt", ActionText = "Sprint", ObjectText = "", KeyboardKeyCode = Enum.KeyCode.LeftShift,
		GamepadKeyCode = Enum.KeyCode.ButtonL3, HoldDuration = 0, MaxActivationDistance = 6, RequiresLineOfSight = false,
		Exclusivity = Enum.ProximityPromptExclusivity.OnePerButton,
	}, att)
	-- (if two players stand close, you might press a friend's button:
	-- it always toggles the sprint of whoever pressed it)
	prompt.Triggered:Connect(function(who)
		local s2 = PS[who]
		if s2 then
			s2.pressT = os.clock()
			s2.sprinting = not s2.sprinting
		end
	end)
	prompt.TriggerEnded:Connect(function(who)
		local s2 = PS[who]
		if s2 and os.clock() - (s2.pressT or 0) > 0.35 then
			s2.sprinting = false -- it was held, so releasing stops it
		end
	end)
end

local function onCharacterAdded(plr, char)
	local st = PS[plr]
	if not st then
		return
	end
	local hum = char:WaitForChild("Humanoid", 10)
	local hrp = char:WaitForChild("HumanoidRootPart", 10)
	if not hum or not hrp then
		return
	end
	st.char, st.hum, st.hrp = char, hum, hrp
	st.sprinting = false
	st.exhausted = false
	task.spawn(fixAnimations, char, hum, hrp)
	makeSprintPrompt(plr, st, hrp)
	hum.Died:Connect(function()
		local m = st.match
		if m and m.players[plr] and m.players[plr].status == "alive" then
			if m.players[plr].role == "survivor" then
				m:caught(plr)
			else
				m.players[plr].status = "left"
			end
		end
	end)
	if not st.match then
		hum.WalkSpeed = CONFIG.LobbyWalkSpeed
		task.wait(0.15)
		local rel = hrp.Position - LOBBY
		if char.Parent and (math.abs(rel.X) > HW or math.abs(rel.Z) > HD or rel.Y < -3 or rel.Y > ROOM_H) then
			char:PivotTo(lobbyCFrame())
		end
	end
end

local function onPlayerAdded(plr)
	local st = { battery = CONFIG.FlashlightBattery, wantMonster = false, ownsPass = false, beatNormal = false }
	PS[plr] = st
	plr.CameraMaxZoomDistance = 25
	plr.CharacterAdded:Connect(function(char)
		onCharacterAdded(plr, char)
	end)
	if plr.Character then
		task.spawn(onCharacterAdded, plr, plr.Character)
	end
	task.spawn(function()
		st.hud = buildHUD(plr)
	end)
	task.spawn(checkPass, plr)
	task.spawn(loadProgress, plr)
end

Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(function(plr)
	local st = PS[plr]
	if st and st.match then
		local info = st.match.players[plr]
		if info and info.status == "alive" then
			info.status = "left"
		end
	end
	for _, ev in ipairs(elevators) do
		local i = table.find(ev.players, plr)
		if i then
			table.remove(ev.players, i)
		end
	end
	PS[plr] = nil
end)

-- ====================================================================
-- BUILD THE LOBBY + MAIN LOOPS
-- ====================================================================
buildLobby()
buildLobbyExtras()
runLobbyClock()
for i, x in ipairs({ -33, -11, 11, 33 }) do
	if i <= CONFIG.ElevatorCount then
		local ev = buildElevator(i, x)
		setDoors(ev, true)
	end
end

for _, plr in ipairs(Players:GetPlayers()) do
	task.spawn(onPlayerAdded, plr)
end

-- sprint for everyone (unlimited, runs every frame)
RunService.Heartbeat:Connect(function()
	for _, st in pairs(PS) do
		local hum, hrp = st.hum, st.hrp
		if hum and hrp and hrp.Parent and hum.Health > 0 and st.role ~= "monster" then
			local inMatch = st.match ~= nil
			local moving = flat(hrp.AssemblyLinearVelocity).Magnitude > 2
			st.moving = moving
			local speed = inMatch and CONFIG.WalkSpeed or CONFIG.LobbyWalkSpeed
			if st.sprinting and moving then
				speed = inMatch and CONFIG.SprintSpeed or CONFIG.LobbySprintSpeed
			end
			if hum.WalkSpeed > 0 and hum.WalkSpeed ~= speed then
				hum.WalkSpeed = speed
			end
		end
	end
end)

-- elevators, lobby HUD and bars (4 times a second)
task.spawn(function()
	while true do
		local dt = 0.25
		for _, ev in ipairs(elevators) do
			updateElevator(ev, dt)
		end
		for plr, st in pairs(PS) do
			local h = st.hud
			if h then
				local survivorInMatch = st.match and st.role == "survivor"
				h.bars.Visible = survivorInMatch and true or false
				if survivorInMatch then
					h.batt.Size = UDim2.fromScale(math.clamp(st.battery / CONFIG.FlashlightBattery, 0, 1), 1)
				end
				if not st.match then
					local myEv
					for _, ev in ipairs(elevators) do
						if table.find(ev.players, plr) then
							myEv = ev
						end
					end
					if myEv then
						local t = myEv.countdown and (" - leaving in " .. math.ceil(myEv.countdown)) or ""
						setTop(plr, "Elevator " .. myEv.index .. "  |  " .. #myEv.players .. "/" .. CONFIG.MaxPlayersPerElevator .. "  |  Mode: " .. myEv.mode .. t)
					else
						local monsterNote = ((st.ownsPass or st.beatNormal) and st.wantMonster) and "  |  Monster mode ON" or ""
						setTop(plr, "Walk into an elevator to play (4 players max)" .. monsterNote)
					end
				end
			end
		end
		task.wait(dt)
	end
end)

print("[CornField] Loaded! Walk into an elevator to play.")
