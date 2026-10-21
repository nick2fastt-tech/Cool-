--[[
	=====================================================================
	  CORN FIELD  -  a co-op horror game for Roblox  (ONE SCRIPT)
	=====================================================================

	HOW TO INSTALL
	  1. Open Roblox Studio.
	  2. In the Explorer, right-click ServerScriptService > Insert Object > Script.
	  3. Delete what is inside the new Script and paste this WHOLE file in.
	  4. Press Play. The lobby, elevators, corn maze and monster are all built
	     by this script, so you don't need anything else.

	BADGE + GAME PASS (do this on create.roblox.com > your game)
	  * Badge: make a badge called "Escaped the Corn Field" and paste its ID
	    into CONFIG.BadgeId below. Players get it when they escape.
	  * Game Pass: make a pass called "Play as the Corn Monster", put it
	    on sale for 100 Robux, and paste its ID into CONFIG.MonsterGamepassId.
	    (Roblox only lets you set the price on the website, not in a script.)
	  * While an ID is still 0: in Studio everyone can test the monster,
	    and the badge is skipped.
	  * Studio > Game Settings > Security: turn on "Allow HTTP Requests"
	    is NOT needed. Nothing extra is needed.

	CONTROLS
	  Shift (or the "Sprint" button on phones)  sprint. Tap = toggle, hold = hold.
	  1 / click the Flashlight tool                    flashlight on / off
	  Q / E / R                                        the 3 gate buttons
	  E                                                elevator mode buttons, prompts

	HOW TO WIN
	  Find the 3 glowing symbols in the corn. Each one has 1, 2 or 3 dots
	  under it. Press the symbols on the gate panel in dot order (1 > 2 > 3).
	  The gate opens. Run out of the field to escape and get the badge.

	THE CORN MONSTER
	  He hides inside the corn walls. When he comes out, he bursts out of the
	  wall about 10 studs BEHIND you. If there is no wall behind you, he comes
	  out of the wall IN FRONT of you. He growls when he spots you and you
	  can hear his heavy footsteps. Shine your flashlight on him and he slows
	  down and crawls back into the corn.
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
	BadgeId = 0, -- badge for escaping
	MonsterGamepassId = 0, -- game pass to play as the Corn Monster
	GamepassPrice = 100, -- only shown on the lobby sign

	ElevatorCount = 4,
	MaxPlayersPerElevator = 4,
	ElevatorCountdown = 15, -- seconds after the first player gets in
	NightmareUnlocked = false, -- Nightmare mode is still in progress

	MatchTime = 15 * 60, -- seconds before the night is over

	LobbyWalkSpeed = 16,
	LobbySprintSpeed = 24,
	WalkSpeed = 12, -- in the corn
	SprintSpeed = 21,
	StaminaMax = 100,
	StaminaDrain = 15, -- per second while sprinting
	StaminaRegen = 11, -- per second while not sprinting
	FlashlightBattery = 300, -- seconds of light

	MonsterScale = 0.95,
	EmergeDistance = 10, -- how far behind (or in front of) you he bursts out of the corn
	MonsterSightRange = 95,
	MonsterHearRange = 16, -- he hears you this close (more if you sprint)
	MonsterCatchRange = 4.5,
	MonsterPlayerSpeed = 19, -- walk speed when a PLAYER is the monster
	MonsterPlayerCatchRange = 6,

	CornDetail = 2, -- 1 = low (faster), 2 = normal, 3 = high

	-- Swap these for your own sounds from the Creator Store if you want
	-- (paste "rbxassetid://12345"). The defaults are built into Roblox.
	Sounds = {
		Footstep = "rbxasset://sounds/action_footsteps_plastic.mp3",
		Growl = "rbxasset://sounds/uuhhh.mp3",
		Rustle = "rbxasset://sounds/action_footsteps_plastic.mp3",
		Ding = "rbxasset://sounds/electronicpingshort.wav",
	},
	GrowlPitch = 0.38, -- low pitch turns the default sound into a growl
}

local MODES = {
	Normal = { firstEmerge = 30, rearmMin = 18, rearmMax = 34, hunt = 15, litSlow = 0.45, fleeLit = 2.5, giveUp = 7 },
	-- Nightmare is not finished yet (CONFIG.NightmareUnlocked = false)
	Nightmare = { firstEmerge = 12, rearmMin = 8, rearmMax = 16, hunt = 19, litSlow = 0.7, fleeLit = 4.5, giveUp = 12 },
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
	local stam = bar(0, Color3.fromRGB(230, 190, 70), "STAMINA")
	local batt = bar(20, Color3.fromRGB(170, 210, 255), "FLASHLIGHT")
	return { gui = gui, top = top, msg = msg, bars = bars, stam = stam, batt = batt, msgToken = 0 }
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

local function awardBadge(plr)
	if CONFIG.BadgeId == 0 then
		return
	end
	task.spawn(function()
		local ok, has = pcall(function()
			return BadgeService:UserHasBadgeAsync(plr.UserId, CONFIG.BadgeId)
		end)
		if ok and not has then
			pcall(function()
				BadgeService:AwardBadge(plr.UserId, CONFIG.BadgeId)
			end)
		end
	end)
end

-- ====================================================================
-- FLASHLIGHT TOOL
-- ====================================================================
local function makeFlashlight(plr)
	local tool = make("Tool", { Name = "Flashlight", RequiresHandle = true, CanBeDropped = false, ToolTip = "Click to turn on/off", Grip = C(0, 0, 0.4) })
	local handle = part({ Name = "Handle", Size = Vector3.new(0.42, 0.42, 1.5), Color = Color3.fromRGB(34, 34, 36), Material = Enum.Material.Metal, Anchored = false, Massless = true, CFrame = C() }, tool)
	local head = part({ Name = "Head", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.5, 0.62, 0.62), Color = Color3.fromRGB(24, 24, 26), Material = Enum.Material.Metal, Anchored = false, Massless = true, CFrame = C(0, 0, -0.95) * A(0, math.rad(90), 0) }, tool)
	local lens = part({ Name = "Lens", Shape = Enum.PartType.Cylinder, Size = Vector3.new(0.05, 0.52, 0.52), Color = Color3.fromRGB(70, 70, 70), Material = Enum.Material.Glass, Anchored = false, Massless = true, CFrame = C(0, 0, -1.21) * A(0, math.rad(90), 0) }, tool)
	local grip = part({ Name = "GripRing", Size = Vector3.new(0.46, 0.46, 0.5), Color = Color3.fromRGB(60, 40, 30), Material = Enum.Material.Fabric, Anchored = false, Massless = true, CFrame = C(0, 0, 0.35) }, tool)
	local beam = part({ Name = "Beam", Size = Vector3.new(0.1, 0.1, 0.1), Transparency = 1, Anchored = false, Massless = true, CFrame = C(0, 0, -1.4) }, tool)
	for _, p in ipairs({ head, lens, grip, beam }) do
		p.CastShadow = false
		make("WeldConstraint", { Part0 = handle, Part1 = p }, p)
	end
	handle.CastShadow = false
	local spot = make("SpotLight", { Face = Enum.NormalId.Front, Range = 60, Angle = 48, Brightness = 3.6, Color = Color3.fromRGB(255, 240, 210), Shadows = true, Enabled = false }, beam)
	local glow = make("PointLight", { Range = 9, Brightness = 0.6, Color = Color3.fromRGB(255, 235, 200), Enabled = false }, lens)

	local function setOn(on)
		local st = PS[plr]
		if on and st and st.battery <= 0 then
			showMessage(plr, "The flashlight is dead...", 2, Color3.fromRGB(255, 150, 120))
			on = false
		end
		if st then
			st.flashOn = on
		end
		spot.Enabled = on
		glow.Enabled = on
		lens.Material = on and Enum.Material.Neon or Enum.Material.Glass
		lens.Color = on and Color3.fromRGB(255, 245, 215) or Color3.fromRGB(70, 70, 70)
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

-- works out where every body segment goes this frame
function Monster:pose(rootCF, now, k, chasing, lit)
	local SC = self.scale
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
	local twitchY = math.noise(now * 1.7, 1.3) * 0.5
	local twitchZ = math.noise(now * 1.1, 7.7) * 0.35
	local tb = base * A(lean, math.sin(phase) * 0.12 * k, math.sin(phase) * 0.05) * C(0, 0.4 * SC, 0)

	out.Pelvis = base
	out.Torso = tb * C(0, 1.8 * SC, 0)
	local headTilt = 0.25 + c * 1.0
	if lit then
		headTilt = -0.4
	end
	local hp = tb * C(0, 4.6 * SC, -0.25 * SC) * A(headTilt, twitchY, twitchZ)
	out.Head = hp * C(0, 0.95 * SC, 0)
	local jawOpen = 0.12 + math.sin(now * 1.3) * 0.04
	if chasing then
		jawOpen = 0.5 + math.sin(now * 9) * 0.1
	end
	out.Jaw = hp * C(0, 0.1 * SC, -0.1 * SC) * A(jawOpen, 0, 0) * C(0, -0.2 * SC, 0)

	local function chain(upperName, lowerName, baseCF, a1, a2, l1, l2)
		local upperCF = baseCF * A(a1, 0, 0)
		out[upperName] = upperCF * C(0, -l1 / 2, 0)
		local elbowCF = upperCF * C(0, -l1, 0) * A(a2, 0, 0)
		out[lowerName] = elbowCF * C(0, -l2 / 2, 0)
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
	chain("UpperArmL", "ForeArmL", tb * C(-0.75 * SC, 3.3 * SC, 0), aL, bend, 3.3 * SC, 3.5 * SC)
	chain("UpperArmR", "ForeArmR", tb * C(0.75 * SC, 3.3 * SC, 0), aR, bend, 3.3 * SC, 3.5 * SC)

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
-- MATCH (one corn field per elevator)
-- ====================================================================
local Match = {}
Match.__index = Match
local activeMatches = {}

function Match.new(slot, mode)
	local self = setmetatable({}, Match)
	self.slot = slot
	self.mode = mode
	self.D = MODES[mode] or MODES.Normal
	self.origin = Vector3.new(3000 + (slot - 1) * 700, 0, 0)
	self.players = {} -- [plr] = { role, status }
	self.flickers = {}
	self.ended = false
	self.puzzle = { input = {}, opened = false }
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

-- --------------------------------------------------------------------
-- building the corn field
-- --------------------------------------------------------------------
function Match:build()
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
		TweenService:Create(r.root, TweenInfo.new(3.2, Enum.EasingStyle.Sine), { CFrame = r.base * C(0, 0, r.sign * 4.8) }):Play()
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
	info.status = status
	local st = PS[plr]
	if st then
		st.flashOn = false
	end
end

function Match:caught(plr)
	local info = self.players[plr]
	if not info or info.status ~= "alive" then
		return
	end
	self:removePlayer(plr, "caught")
	showMessage(plr, "The Corn Monster got you...", 3, Color3.fromRGB(255, 130, 110))
	self:broadcast(plr.DisplayName .. " was taken by the Corn Monster.", 4, Color3.fromRGB(255, 150, 120), plr)
	local st = PS[plr]
	if st and st.hum and st.hum.Parent then
		st.hum.WalkSpeed = 0
		st.hum.JumpPower = 0
		st.hum.JumpHeight = 0
	end
	task.delay(2.5, function()
		if PS[plr] and PS[plr].match == self then
			sendToLobby(plr)
		end
	end)
end

function Match:escaped(plr)
	self:removePlayer(plr, "escaped")
	showMessage(plr, "YOU ESCAPED THE CORN FIELD!", 5, Color3.fromRGB(150, 255, 170))
	self:broadcast(plr.DisplayName .. " escaped!", 4, Color3.fromRGB(150, 255, 170), plr)
	awardBadge(plr)
	task.delay(4, function()
		if PS[plr] and PS[plr].match == self then
			sendToLobby(plr)
		end
	end)
end

-- --------------------------------------------------------------------
-- monster: picking where he bursts out
-- --------------------------------------------------------------------
-- He comes out of the corn wall about EmergeDistance studs BEHIND the
-- player. If there is no wall there, he comes out IN FRONT instead.
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
			local amp = (1 - t / 1.3) * 0.14
			for _, e in ipairs(list) do
				if e.p.Parent then
					e.p.CFrame = e.cf * A(math.sin(t * 38 + e.cf.X) * amp, 0, math.sin(t * 31 + e.cf.Z) * amp)
				end
			end
			task.wait(1 / 30)
		end
		for _, e in ipairs(list) do
			if e.p.Parent then
				e.p.CFrame = e.cf
			end
		end
	end)
end

function Match:burst(pos)
	local p = part({ Name = "Burst", Size = Vector3.new(1, 1, 1), Position = pos, Transparency = 1 }, self.folder)
	local e = make("ParticleEmitter", {
		Texture = "rbxasset://textures/particles/smoke_main.dds", Rate = 90, Lifetime = NumberRange.new(0.8, 1.5),
		Speed = NumberRange.new(6, 14), SpreadAngle = Vector2.new(60, 60), Size = NumberSequence.new(1.5, 4),
		Transparency = NumberSequence.new(0.35, 1), Color = ColorSequence.new(Color3.fromRGB(90, 110, 50)),
		Acceleration = Vector3.new(0, -6, 0), RotSpeed = NumberRange.new(-120, 120),
	}, p)
	task.delay(0.4, function()
		e.Enabled = false
	end)
	Debris:AddItem(p, 3)
end

-- --------------------------------------------------------------------
-- monster AI (when no player is the monster)
-- --------------------------------------------------------------------
function Match:aiInit()
	local m = Monster.new(self.folder, CONFIG.MonsterScale)
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
	ai.lunged = false
	m.crawlAmt = 0
	m.pos = self:bc(sp.bx, sp.by)
	m.yaw = math.atan2(-sp.dx, -sp.dy)
	self:rustleWall(sp)
	m.rustleSound:Play()
end

function Match:retreat(crawl)
	local m, ai = self.mon, self.ai
	local sx, sy = self:nearestOpen(m.pos)
	local dmM = bfs(self.wall, sx, sy)
	local surv = self:survivors()
	local dmPs = {}
	for _, s in ipairs(surv) do
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
	ai.path = best and findPath(self.wall, sx, sy, best.ox, best.oy)
	ai.idx = 2
	ai.crawling = crawl
	ai.litTime = 0
	if not ai.path then
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
	m.pos = self.center - Vector3.new(0, 80, 0)
	m:pose(C(m.pos), os.clock(), 0.05, false, false)
	m:applyAnchored()
end

function Match:follow(dt, speed, chasePos)
	local m, ai = self.mon, self.ai
	local target
	if ai.path and ai.path[ai.idx] then
		target = self:bc(ai.path[ai.idx][1], ai.path[ai.idx][2])
	elseif chasePos then
		target = Vector3.new(chasePos.X, self.origin.Y, chasePos.Z)
	end
	if not target then
		return false, true
	end
	local to = flat(target - m.pos)
	local dd = to.Magnitude
	if dd < 0.5 then
		if ai.path and ai.path[ai.idx] then
			ai.idx += 1
		end
		return false, (ai.path == nil or ai.path[ai.idx] == nil)
	end
	m.pos = m.pos + to.Unit * math.min(speed * dt, dd)
	m.yaw = lerpAngle(m.yaw, math.atan2(-to.X, -to.Z), math.min(1, dt * 8))
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
			if s.plr == target then
				tInfo = s
			end
		end
		if not tInfo then
			local choices = {}
			for _, s in ipairs(surv) do
				if not self:inCamp(s.hrp.Position) then
					choices[#choices + 1] = s
				end
			end
			tInfo = choices[math.random(math.max(#choices, 1))]
		end
		if tInfo then
			local sp = self:pickEmergeSpot(tInfo.hrp)
			if sp then
				self:startEmerge(sp, tInfo.plr)
				return
			end
		end
		ai.target = nil
		ai.nextEmerge = now + 3
		return
	end

	if ai.mode == "emerge" then
		ai.t += dt
		local sp = ai.spot
		local inside, outside = self:bc(sp.bx, sp.by), self:bc(sp.ox, sp.oy)
		local moving = false
		if ai.t < 1.2 then
			m.pos = inside
		elseif ai.t < 2.0 then
			local a = (ai.t - 1.2) / 0.8
			a = a * a * (3 - 2 * a)
			m.pos = inside:Lerp(outside, a)
			moving = true
			if not ai.lunged then
				ai.lunged = true
				self:burst(self:bc(sp.bx, sp.by) + Vector3.new(sp.dx, 0, sp.dy) * (BS / 2) + Vector3.new(0, 6, 0))
				m:growl()
				ai.lastGrowl = now
			end
		else
			ai.mode = "hunt"
			ai.chaseUntil = now + D.giveUp
			ai.path = nil
			ai.lastPath = 0
		end
		m.phase += dt * (moving and 8 or 1.5)
		local k = moving and 0.8 or 0.05
		m:pose(C(m.pos) * A(0, m.yaw, 0), now, k, moving, false)
		m:applyAnchored()
		m:steps(k)
		return
	end

	if ai.mode == "pause" then
		m.phase += dt * 1.2
		m:pose(C(m.pos) * A(0, m.yaw, 0), now, 0.05, false, false)
		m:applyAnchored()
		if now > ai.pauseUntil then
			self:retreat(false)
		end
		return
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
			if d < CONFIG.MonsterSightRange and self:clearLine(eye, s.hrp.Position + Vector3.new(0, 1.5, 0)) then
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

	-- flashlight: slows him down, then he crawls away
	local lit = false
	for _, s in ipairs(surv) do
		if s.st.flashOn and ai.visible[s.plr] then
			local head = s.hrp.Position + Vector3.new(0, 1.5, 0)
			local toM = (m.pos + Vector3.new(0, 7 * m.scale, 0)) - head
			if toM.Magnitude < 50 and flat(toM).Magnitude > 0.5 and flat(s.hrp.CFrame.LookVector).Unit:Dot(flat(toM).Unit) > 0.82 then
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
			m:growl()
			ai.lastGrowl = now
			if ai.litBy then
				showMessage(ai.litBy, "It crawls away from the light!", 3, Color3.fromRGB(255, 230, 150))
			end
			self:retreat(true)
			return
		end

		-- choose who to chase
		local best, bestD
		for _, s in ipairs(surv) do
			local d = flat(s.hrp.Position - m.pos).Magnitude
			local hear = CONFIG.MonsterHearRange * ((s.st.sprinting and s.st.moving) and 1.8 or 1)
			if ai.visible[s.plr] or d < hear then
				if not bestD or d < bestD then
					best, bestD = s, d
				end
			end
		end
		if best then
			ai.target = best.plr
			ai.chaseUntil = now + D.giveUp
		end
		local tInfo
		for _, s in ipairs(surv) do
			if s.plr == ai.target then
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
			ai.path = nil
			moved = self:follow(dt, speed, tPos)
		else
			if ai.path == nil or now - ai.lastPath > 0.35 then
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
				ai.path = findPath(self.wall, sx, sy, gx, gy)
				ai.idx = 2
			end
			moved = self:follow(dt, speed, ai.visible[tInfo.plr] and tPos or nil)
		end

		if dist < CONFIG.MonsterCatchRange and math.abs(tPos.Y - (m.pos.Y + 3)) < 8 then
			self:caught(tInfo.plr)
			ai.mode = "pause"
			ai.pauseUntil = now + 2.5
			ai.path = nil
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

	-- retreat
	local speed = ai.crawling and 16 or 9
	local moved, finished = self:follow(dt, speed, nil)
	if finished then
		ai.mode = "burrow"
		ai.t = 0
		m.rustleSound:Play()
		self:rustleWall(ai.spot)
		return
	end
	if not ai.crawling then
		for _, s in ipairs(surv) do
			if ai.visible[s.plr] and flat(s.hrp.Position - m.pos).Magnitude < CONFIG.MonsterHearRange * 1.5 then
				ai.mode = "hunt"
				ai.target = s.plr
				ai.chaseUntil = now + D.giveUp
				ai.path = nil
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
-- monster PLAYER (game pass)
-- --------------------------------------------------------------------
function Match:setupMonsterPlayer(plr)
	local st = PS[plr]
	local char, hum, hrp = st.char, st.hum, st.hrp
	-- spawn far from the camp
	local dm = bfs(self.wall, 4, 4)
	local far, fd = nil, -1
	for _, b in ipairs(self.openBlocks) do
		local d = dm[key(b[1], b[2])] or 0
		if d > fd then
			far, fd = b, d
		end
	end
	local spawnPos = self:bc(far[1], far[2]) + Vector3.new(0, 4, 0)
	char:PivotTo(CFrame.lookAt(spawnPos, Vector3.new(self.center.X, spawnPos.Y, self.center.Z)))
	hrp.AssemblyLinearVelocity = Vector3.zero

	-- hide the player's own body and wear the monster
	for _, d in ipairs(char:GetDescendants()) do
		if d:IsA("BasePart") then
			d.Transparency = 1
		elseif d:IsA("Decal") then
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
	plr.CameraMinZoomDistance = 12
	plr.CameraMaxZoomDistance = 30

	local groundOffset
	if hum.RigType == Enum.HumanoidRigType.R6 then
		groundOffset = 3
	else
		groundOffset = hum.HipHeight + hrp.Size.Y / 2
	end
	local m = Monster.new(char, CONFIG.MonsterScale)
	m:attachTo(hrp, groundOffset)
	self.mon = m
	self.monPlr = plr
	self.mp = { lastVis = {}, lastGrowl = 0, losT = 0, visible = {} }

	-- Growl button (G) for the monster player
	local att = make("Attachment", { Name = "GrowlAttach", Position = Vector3.new(0, -2.6, 0) }, hrp)
	local prompt = make("ProximityPrompt", {
		ActionText = "Growl", ObjectText = "", KeyboardKeyCode = Enum.KeyCode.G, HoldDuration = 0, MaxActivationDistance = 6,
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
		self.ai.nextEmerge = now + 6
		self:broadcast("The corn is moving again...", 4)
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
			if toM.Magnitude < 50 and flat(toM).Magnitude > 0.5 and flat(s.hrp.CFrame.LookVector).Unit:Dot(flat(toM).Unit) > 0.82 then
				lit = true
			end
		end
	end
	st.hum.WalkSpeed = CONFIG.MonsterPlayerSpeed * (lit and 0.55 or 1)

	-- catching
	for _, s in ipairs(surv) do
		local d = flat(s.hrp.Position - hrp.Position).Magnitude
		if d < CONFIG.MonsterPlayerCatchRange and math.abs(s.hrp.Position.Y - hrp.Position.Y) < 8 then
			self:caught(s.plr)
			showMessage(plr, "You caught " .. s.plr.DisplayName .. "!", 3, Color3.fromRGB(190, 255, 120))
		end
	end

	m.phase += dt * (moving and speed * 0.7 or 1.2)
	m:pose(m.localRoot, now, k, moving, lit)
	m:applyWelds()
	m:steps(k)
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

	-- survivors spawn around the campfire
	local i = 0
	for plr, info in pairs(self.players) do
		local st = PS[plr]
		if info.role == "survivor" and st.char and st.hrp then
			i += 1
			local a = i * (math.pi * 2 / 4) + 0.6
			local p = self.center + Vector3.new(math.cos(a) * 9, 4, math.sin(a) * 9)
			st.char:PivotTo(CFrame.lookAt(p, Vector3.new(self.center.X, p.Y, self.center.Z)))
			st.hrp.AssemblyLinearVelocity = Vector3.zero
			st.stamina = CONFIG.StaminaMax
			st.battery = CONFIG.FlashlightBattery
			st.flashOn = false
			plr.CameraMaxZoomDistance = 14
			plr.CameraMinZoomDistance = 0.5
			local tool = makeFlashlight(plr)
			tool.Parent = plr:FindFirstChildOfClass("Backpack") or plr
			st.tool = tool
			showMessage(plr, "Find the 3 symbols. Press them at the gate in dot order. Stay quiet...", 7)
		end
	end

	if monsterPlr then
		self:setupMonsterPlayer(monsterPlr)
	else
		self:aiInit()
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

	-- survivors: escaping, flashlight battery
	for plr, info in pairs(self.players) do
		local st = PS[plr]
		if info.status == "alive" then
			if not st or not st.hrp or not st.hrp.Parent or not st.hum or st.hum.Health <= 0 then
				if info.role == "survivor" then
					self:removePlayer(plr, "caught")
				end
			elseif info.role == "survivor" then
				if self.puzzle.opened and st.hrp.Position.X < self.origin.X - 3 then
					self:escaped(plr)
				end
				if st.flashOn then
					st.battery = math.max(0, st.battery - dt)
					if st.battery <= 0 and st.tool then
						local hum = st.hum
						hum:UnequipTools()
						showMessage(plr, "The flashlight died...", 3, Color3.fromRGB(255, 150, 120))
					end
				end
			end
		end
	end

	-- the monster
	if self.monPlr then
		self:monPlayerStep(dt, now)
	elseif self.mon then
		self:aiStep(dt, now)
	end

	-- flickering lights
	self.flickT += dt
	if self.flickT > 0.1 then
		self.flickT = 0
		for _, f in ipairs(self.flickers) do
			if f.light.Parent then
				f.light.Brightness = f.base * (1 - f.amt + f.amt * 2 * math.noise(now * 3, f.seed))
			end
		end
	end

	-- HUD
	self.hudT += dt
	if self.hudT > 0.25 then
		self.hudT = 0
		local mins = math.max(0, math.floor(left / 60))
		local secs = math.max(0, math.floor(left % 60))
		local clock = string.format("%d:%02d", mins, secs)
		local alive = #self:survivors()
		for plr, info in pairs(self.players) do
			if info.status == "alive" then
				if info.role == "survivor" then
					local gate = self.puzzle.opened and "GATE OPEN - GET OUT!" or ("Gate code: " .. #self.puzzle.input .. "/3")
					setTop(plr, "Find the symbols  |  " .. gate .. "  |  " .. clock)
				else
					setTop(plr, "CORN MONSTER  |  Survivors left: " .. alive .. "  |  " .. clock)
				end
			end
		end
	end

	-- end of the match?
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
	surfaceText(plaque, Enum.NormalId.Front, "PLAY AS THE CORN MONSTER\n" .. CONFIG.GamepassPrice .. " R$ GAME PASS", GOLD)
	local spotPart = part({ Name = "StatueLight", Size = Vector3.new(0.4, 0.4, 0.4), CFrame = CFrame.lookAt(L(HW - 14, 14, -6), L(HW - 9, 5, -6)), Transparency = 1 }, f)
	make("SpotLight", { Face = Enum.NormalId.Front, Range = 22, Angle = 40, Brightness = 3, Color = Color3.fromRGB(190, 255, 140) }, spotPart)
	local prompt = make("ProximityPrompt", {
		ActionText = "Play as Monster", ObjectText = "Corn Monster Game Pass", HoldDuration = 0.3, MaxActivationDistance = 10,
		RequiresLineOfSight = false,
	}, plaque)
	prompt.Triggered:Connect(function(plr)
		local st = PS[plr]
		if not st then
			return
		end
		if st.ownsPass then
			st.wantMonster = not st.wantMonster
			if st.wantMonster then
				showMessage(plr, "Monster mode ON. Get in an elevator with friends - you'll be the Corn Monster!", 5, Color3.fromRGB(190, 255, 120))
			else
				showMessage(plr, "Monster mode OFF. You'll play as a survivor.", 4)
			end
		elseif CONFIG.MonsterGamepassId ~= 0 then
			MarketplaceService:PromptGamePassPurchase(plr, CONFIG.MonsterGamepassId)
		else
			showMessage(plr, "The Corn Monster game pass is not set up yet.", 4, Color3.fromRGB(255, 170, 120))
		end
	end)

	-- how to play board on the west wall
	local board = part({ Name = "RulesBoard", Size = Vector3.new(0.3, 9, 13), Position = L(-HW + 0.4, 9, -22), Color = WOOD_TRIM, Material = Enum.Material.Wood }, f)
	surfaceText(board, Enum.NormalId.Right, "HOW TO PLAY\n\n1. Get in an elevator (4 players max)\n2. Find the 3 glowing symbols in the corn\n3. Count the dots: press them at the gate in order\n4. Escape the field!\n\nShift = sprint   Flashlight = scares him off\nHe hides in the corn walls...", Color3.fromRGB(235, 215, 170), Enum.Font.Antique, Color3.fromRGB(34, 22, 14))

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
	for _, z in ipairs({ -32, -10, 10, 28 }) do
		sconce(L(-HW + 0.2, 9, z), Vector3.new(1, 0, 0))
		sconce(L(HW - 0.2, 9, z), Vector3.new(-1, 0, 0))
	end
	for _, x in ipairs({ -40, -14, 14, 40 }) do
		sconce(L(x, 9, -HD + 0.2), Vector3.new(0, 0, 1))
	end

	-- potted corn plants + bookshelf
	for _, p in ipairs({ L(-HW + 3, 0, -HD + 3), L(HW - 3, 0, -HD + 3), L(-HW + 3, 0, HD - 4), L(HW - 3, 0, HD - 4) }) do
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
	local nightBtn = modePanel(-1, "NIGHTMARE", Color3.fromRGB(150, 90, 200), "IN PROGRESS")

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
	local nightPrompt = make("ProximityPrompt", { ActionText = "Select", ObjectText = "Nightmare Mode (In Progress)", HoldDuration = 0, MaxActivationDistance = 7, RequiresLineOfSight = false }, nightBtn)
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
	-- who is the monster? (game pass owners who turned monster mode on)
	local monsterPlr
	for _, plr in ipairs(final) do
		local st = PS[plr]
		if st.wantMonster and st.ownsPass then
			if #final >= 2 then
				monsterPlr = plr
				break
			else
				showMessage(plr, "You need at least 1 survivor with you to be the monster. Playing as a survivor.", 5, Color3.fromRGB(255, 200, 120))
			end
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
	plr.CameraMinZoomDistance = 0.5
	plr.CameraMaxZoomDistance = 25
	if plr.Parent == Players then
		plr:LoadCharacter()
	end
end

local function makeSprintPrompt(plr, st, hrp)
	local att = make("Attachment", { Name = "SprintAttach", Position = Vector3.new(0, -2.6, 0) }, hrp)
	local prompt = make("ProximityPrompt", {
		Name = "SprintPrompt", ActionText = "Sprint", ObjectText = "", KeyboardKeyCode = Enum.KeyCode.LeftShift,
		GamepadKeyCode = Enum.KeyCode.ButtonL3, HoldDuration = 0, MaxActivationDistance = 6, RequiresLineOfSight = false,
		Exclusivity = Enum.ProximityPromptExclusivity.OnePerButton, UIOffset = Vector2.new(0, 40),
	}, att)
	prompt.Triggered:Connect(function(who)
		if who ~= plr then
			return
		end
		st.pressT = os.clock()
		if st.sprinting then
			st.sprinting = false
		elseif not st.exhausted then
			st.sprinting = true
		end
	end)
	prompt.TriggerEnded:Connect(function(who)
		if who == plr and os.clock() - (st.pressT or 0) > 0.35 then
			st.sprinting = false -- it was held, so releasing stops it
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
	st.stamina = CONFIG.StaminaMax
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
	local st = { stamina = CONFIG.StaminaMax, battery = CONFIG.FlashlightBattery, wantMonster = false, ownsPass = false }
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
for i, x in ipairs({ -33, -11, 11, 33 }) do
	if i <= CONFIG.ElevatorCount then
		local ev = buildElevator(i, x)
		setDoors(ev, true)
	end
end

for _, plr in ipairs(Players:GetPlayers()) do
	task.spawn(onPlayerAdded, plr)
end

-- sprint + stamina for everyone (runs every frame)
RunService.Heartbeat:Connect(function(dt)
	for _, st in pairs(PS) do
		local hum, hrp = st.hum, st.hrp
		if hum and hrp and hrp.Parent and hum.Health > 0 and st.role ~= "monster" then
			local inMatch = st.match ~= nil
			local moving = flat(hrp.AssemblyLinearVelocity).Magnitude > 2
			st.moving = moving
			local walk = inMatch and CONFIG.WalkSpeed or CONFIG.LobbyWalkSpeed
			local run = inMatch and CONFIG.SprintSpeed or CONFIG.LobbySprintSpeed
			local speed = walk
			if st.sprinting and moving and not st.exhausted then
				speed = run
				if inMatch then
					st.stamina = math.max(0, st.stamina - CONFIG.StaminaDrain * dt)
				end
			else
				st.stamina = math.min(CONFIG.StaminaMax, st.stamina + CONFIG.StaminaRegen * dt * (moving and 0.6 or 1))
			end
			if st.stamina <= 0 then
				st.exhausted = true
				st.sprinting = false
			elseif st.exhausted and st.stamina >= CONFIG.StaminaMax * 0.3 then
				st.exhausted = false
			end
			if hum.WalkSpeed > 0 then
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
					h.stam.Size = UDim2.fromScale(math.clamp(st.stamina / CONFIG.StaminaMax, 0, 1), 1)
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
						local monsterNote = (st.ownsPass and st.wantMonster) and "  |  Monster mode ON" or ""
						setTop(plr, "Walk into an elevator to play (4 players max)" .. monsterNote)
					end
				end
			end
		end
		task.wait(dt)
	end
end)

print("[CornField] Loaded! Walk into an elevator to play.")
