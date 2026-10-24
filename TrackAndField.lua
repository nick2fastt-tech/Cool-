--[[
	=====================================================================
	  TRACK AND FIELD  v5 (demo)                         one script
	=====================================================================
	  INSTALL (one script does everything)
	    0. Installed an older version before? DELETE it first - look for an old
	       LocalScript in StarterPlayer > StarterPlayerScripts (and any older
	       Script in ServerScriptService). Two copies running at once fight over
	       your character. (This version also finds old copies and switches them
	       off, and shows "OLD VERSION FOUND" if it had to.)
	    1. Roblox Studio -> an empty Baseplate place, published, with
	       Game Settings > Security > "Enable Studio Access to API Services" ON
	       (needed to save PBs and world records).
	    2. Explorer: ServerScriptService -> insert a Script, paste this whole file, Play.
	       The server half saves progress, runs the 40-yard dash line and puts the
	       uniform on everyone; it copies itself to every player as the client half.
	    (No server access? Paste it into a LocalScript in StarterPlayerScripts
	     instead: everything works, but nothing is saved and only you see the kit.)
	    The menu (top left) shows "TRACK AND FIELD v5" so you know which version runs.

	  EVENTS   60m, 100m, 200m, 400m, 4x100m, 4x200m, 4x400m
	    Every event: semifinal -> finalists screen -> final introductions
	    (username + semifinal time) -> final -> podium. An announcer calls
	    the race and says the winner's name (captions + voice).
	    Bots on Track (Settings) shows your 7 rivals running beside you;
	    off = you race alone and rivals are leaderboard times.

	  RUNNING  tap left / right in rhythm, one tap every 0.3 s holds top speed.
	    Your body really runs down the lane (pushed by physics every frame, never
	    teleported), and nothing - not even Roblox's default controls - can stop it.
	    PC:       A / D (rebindable), Left / Right arrows, mouse left / right click
	              Relays: Space (or W / Up) to pass - the PASS button turns green
	              in the perfect window; your teammate runs the next leg
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
	    block clearance, a 20-frame drive-phase cycle (45 degree lean, full
	    extension), a 20-frame top-speed cycle (high knee, heel tucked under the
	    hips, foot clawed back under the body, big arm swing), bend lean, finish
	    dip, braking jog, celebrations, idle and walk. Other players see Roblox's
	    normal animations on you; the camera swings around you, never through you.

	  UNIFORM  White & royal blue singlet with side panels, collar, sash and crest,
	    a race bib with your lane number, your name on the back, half tights with
	    hip numbers, socks, spikes and wristbands (toggle in Settings).

	  SAVING  Your PBs and settings are saved. World records are shared by
	    everyone in the game and stay until another player beats them.

	  40-YARD DASH  Optional, on the grass in the infield. Walk to the blue pad
	    to join the line (other players wait their turn). It has its own WR.

	  SETTINGS  Event, AFK, bots on/off, white & royal blue uniform, track
	    colour, camera, celebration, announcer voice, performance mode, keys.
	    Top right: INDOOR arena button (coming soon).

	  Scale: 1 stud = 0.28 m, so 100 m = 357 studs.
	=====================================================================
]]

---------------------------------------------------------------------
-- UNIFORM KIT: white & royal blue singlet, half tights, socks and spikes, with a bib,
-- hip numbers and your name on the back. The server puts it on your character so every
-- player sees it (without the server half, your own client puts it on just for you).
---------------------------------------------------------------------
local KIT: { [string]: any } = {}
KIT.VERSION = 5
KIT.WHITE = Color3.fromRGB(236, 239, 246) -- soft white: pure white glows in the sunlight bloom
KIT.ROYAL = Color3.fromRGB(28, 70, 204)
KIT.NAVY = Color3.fromRGB(14, 32, 104)
KIT.PIN = Color3.fromRGB(120, 172, 255)
KIT.INK = Color3.fromRGB(20, 22, 30)
KIT.BIB = Color3.fromRGB(252, 252, 250)
KIT.METAL = Color3.fromRGB(176, 182, 194)
KIT.SIDES = { Enum.NormalId.Front, Enum.NormalId.Back, Enum.NormalId.Left, Enum.NormalId.Right }

KIT.new = function(className: string, props: { [string]: any }, parent: Instance?): any
	local o: any = Instance.new(className)
	for k, v in pairs(props) do
		o[k] = v
	end
	if parent then
		o.Parent = parent
	end
	return o
end
-- a rectangle in fractions of its parent: x, y, width, height
KIT.box = function(parent: Instance, x: number, y: number, w: number, h: number, color: Color3, z: number?, rot: number?): any
	return KIT.new("Frame", { Position = UDim2.fromScale(x, y), Size = UDim2.fromScale(w, h), BackgroundColor3 = color, BorderSizePixel = 0, ZIndex = z or 1, Rotation = rot or 0 }, parent)
end
KIT.text = function(parent: Instance, x: number, y: number, w: number, h: number, text: string, color: Color3, z: number?): any
	return KIT.new("TextLabel", { Position = UDim2.fromScale(x, y), Size = UDim2.fromScale(w, h), BackgroundTransparency = 1, Text = text, TextScaled = true, Font = Enum.Font.GothamBlack, TextColor3 = color, ZIndex = z or 4 }, parent)
end
KIT.circle = function(parent: Instance, cx: number, cy: number, size: number, color: Color3, z: number?, ring: number?): any
	local f = KIT.new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(cx, cy), Size = UDim2.fromScale(size, size), BackgroundColor3 = color, BackgroundTransparency = if ring then 1 else 0, BorderSizePixel = 0, ZIndex = z or 3 }, parent)
	KIT.new("UICorner", { CornerRadius = UDim.new(0.5, 0) }, f)
	KIT.new("UIAspectRatioConstraint", { AspectRatio = 1, DominantAxis = Enum.DominantAxis.Width }, f)
	if ring then
		KIT.new("UIStroke", { Color = color, Thickness = ring }, f)
	end
	return f
end
KIT.gui = function(st: any, part: BasePart, face: Enum.NormalId, build: (any) -> ())
	local sg = KIT.new("SurfaceGui", { Name = "TF_Kit", Face = face, SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud, PixelsPerStud = 90, LightInfluence = 1, ClipsDescendants = true, ZIndexBehavior = Enum.ZIndexBehavior.Sibling }, part)
	build(sg)
	table.insert(st.guis, sg)
end
-- a race number on a white bib (front / back of the singlet) - it follows your lane
KIT.bib = function(st: any, sg: any, x: number, y: number, w: number, h: number, pins: boolean)
	local bib = KIT.box(sg, x, y, w, h, KIT.BIB, 5)
	KIT.new("UIStroke", { Color = Color3.fromRGB(150, 156, 170), Thickness = 1.5 }, bib)
	local head = KIT.box(bib, 0, 0, 1, 0.24, KIT.ROYAL, 6)
	KIT.text(head, 0.05, 0.1, 0.9, 0.8, "TRACK AND FIELD", KIT.BIB, 7)
	table.insert(st.numbers, KIT.text(bib, 0.08, 0.26, 0.84, 0.72, "1", KIT.INK, 7))
	if pins then
		for _, p in ipairs({ { 0.07, 0.34 }, { 0.93, 0.34 }, { 0.07, 0.9 }, { 0.93, 0.9 } }) do
			KIT.circle(bib, p[1], p[2], 0.06, KIT.METAL, 8)
		end
	end
end
-- singlet on a torso face area (y0 .. y0 + h of the face)
KIT.singlet = function(st: any, part: BasePart, y0: number, h: number, name: string)
	KIT.gui(st, part, Enum.NormalId.Front, function(sg)
		KIT.box(sg, 0, y0, 0.12, h, KIT.ROYAL, 2)
		KIT.box(sg, 0.88, y0, 0.12, h, KIT.ROYAL, 2)
		KIT.box(sg, 0.12, y0, 0.018, h, KIT.PIN, 2)
		KIT.box(sg, 0.862, y0, 0.018, h, KIT.PIN, 2)
		KIT.circle(sg, 0.5, y0, 0.3, KIT.ROYAL, 3, 6) -- collar
		-- royal sash across the chest with light-blue pin lines
		KIT.box(sg, -0.25, y0 + h * 0.44, 1.5, h * 0.15, KIT.ROYAL, 2, -26)
		KIT.box(sg, -0.25, y0 + h * 0.405, 1.5, h * 0.022, KIT.PIN, 2, -26)
		KIT.box(sg, -0.25, y0 + h * 0.61, 1.5, h * 0.022, KIT.PIN, 2, -26)
		KIT.text(sg, 0.6, y0 + h * 0.23, 0.25, h * 0.13, "T&F", KIT.ROYAL, 4)
		local crest = KIT.circle(sg, 0.28, y0 + h * 0.3, 0.12, KIT.ROYAL, 4)
		KIT.text(crest, 0.12, 0.2, 0.76, 0.6, "TF", KIT.WHITE, 5)
		KIT.bib(st, sg, 0.25, y0 + h * 0.5, 0.5, h * 0.42, true)
	end)
	KIT.gui(st, part, Enum.NormalId.Back, function(sg)
		KIT.box(sg, 0, y0, 0.12, h, KIT.ROYAL, 2)
		KIT.box(sg, 0.88, y0, 0.12, h, KIT.ROYAL, 2)
		KIT.box(sg, 0.12, y0, 0.018, h, KIT.PIN, 2)
		KIT.box(sg, 0.862, y0, 0.018, h, KIT.PIN, 2)
		KIT.circle(sg, 0.5, y0, 0.3, KIT.ROYAL, 3, 6)
		KIT.text(sg, 0.15, y0 + h * 0.12, 0.7, h * 0.17, string.upper(name), KIT.ROYAL, 4)
		KIT.box(sg, 0.3, y0 + h * 0.31, 0.4, h * 0.02, KIT.PIN, 2)
		KIT.bib(st, sg, 0.28, y0 + h * 0.38, 0.44, h * 0.42, true)
	end)
	for _, face in ipairs({ Enum.NormalId.Left, Enum.NormalId.Right }) do
		KIT.gui(st, part, face, function(sg)
			KIT.box(sg, 0, y0, 1, h, KIT.ROYAL, 2)
			KIT.box(sg, 0.12, y0, 0.06, h, KIT.PIN, 2)
			KIT.box(sg, 0.82, y0, 0.06, h, KIT.PIN, 2)
		end)
	end
	KIT.gui(st, part, Enum.NormalId.Top, function(sg)
		KIT.box(sg, 0, 0, 1, 0.14, KIT.ROYAL, 2)
		KIT.box(sg, 0, 0.86, 1, 0.14, KIT.ROYAL, 2)
	end)
end
-- a white side stripe and a hip number on the outside of the shorts
KIT.hipNumber = function(st: any, sg: any, x: number, y: number, w: number, h: number)
	local tag = KIT.box(sg, x, y, w, h, KIT.BIB, 5)
	KIT.new("UIStroke", { Color = Color3.fromRGB(150, 156, 170), Thickness = 1 }, tag)
	table.insert(st.numbers, KIT.text(tag, 0.1, 0.08, 0.8, 0.84, "1", KIT.INK, 6))
end
-- socks / wristbands: a band near the bottom of a limb part, all four sides
KIT.band = function(st: any, part: BasePart, y: number, h: number, color: Color3, stripe: Color3?)
	for _, face in ipairs(KIT.SIDES) do
		KIT.gui(st, part, face, function(sg)
			KIT.box(sg, 0, y, 1, h, color, 2)
			if stripe then
				KIT.box(sg, 0, y, 1, math.min(0.07, h * 0.3), stripe, 3)
			end
		end)
	end
end
-- spikes: royal shoe, white sole and stripe, metal spike plate underneath
KIT.spikes = function(st: any, part: BasePart, outer: Enum.NormalId, y: number)
	for _, face in ipairs(KIT.SIDES) do
		KIT.gui(st, part, face, function(sg)
			if y > 0 then
				KIT.box(sg, 0, y, 1, 1 - y, KIT.ROYAL, 2)
			end
			KIT.box(sg, 0, y + (1 - y) * 0.7, 1, (1 - y) * 0.3, KIT.WHITE, 3)
			if face == outer then
				KIT.box(sg, 0.12, y + (1 - y) * 0.28, 0.76, (1 - y) * 0.16, KIT.WHITE, 3, -18)
			end
		end)
	end
	KIT.gui(st, part, Enum.NormalId.Bottom, function(sg)
		KIT.box(sg, 0, 0, 1, 1, KIT.METAL, 2)
		for i = 0, 5 do
			KIT.circle(sg, 0.3 + (i % 2) * 0.4, 0.2 + math.floor(i / 2) * 0.3, 0.14, KIT.INK, 3)
		end
	end)
end

-- dress a character. Returns what is needed to take it all off again, or nil
KIT.wear = function(char: Model, name: string, number: number): any
	local hum = char:FindFirstChildOfClass("Humanoid")
	if not hum then
		return nil
	end
	local isR15 = hum.RigType == Enum.HumanoidRigType.R15
	local st: any = { char = char, colors = {}, textures = {}, hidden = {}, transparency = {}, guis = {}, numbers = {} }
	-- your own skin tone for bare arms and legs
	local skin = Color3.fromRGB(204, 142, 105)
	local bodyColors = char:FindFirstChildOfClass("BodyColors")
	local head = char:FindFirstChild("Head")
	if bodyColors then
		skin = bodyColors.HeadColor3
	elseif head and head:IsA("BasePart") then
		skin = head.Color
	end
	-- take off what would cover the kit (clothes, shirt pictures, layered jackets, skin textures)
	for _, d in ipairs(char:GetDescendants()) do
		local parent = d.Parent
		if d:IsA("Clothing") or d:IsA("ShirtGraphic") or d:IsA("BodyColors")
			or (d:IsA("SurfaceAppearance") and parent ~= nil and parent.Parent == char and parent.Name ~= "Head")
		then
			local inst: Instance = d
			table.insert(st.hidden, { inst = inst, parent = parent })
			inst.Parent = nil
		elseif d:IsA("WrapLayer") and parent and parent:IsA("BasePart") then
			st.transparency[parent] = parent.Transparency
			parent.Transparency = 1
		end
	end
	local function paint(inst: Instance?, color: Color3): BasePart?
		if not inst or not inst:IsA("BasePart") then
			return nil
		end
		local part = inst :: BasePart
		if st.colors[part] == nil then
			st.colors[part] = part.Color
		end
		part.Color = color
		if part:IsA("MeshPart") and st.textures[part] == nil then
			local mp = part :: MeshPart
			local ok, tex = pcall(function()
				return mp.TextureID
			end)
			if ok then
				st.textures[part] = tex
				pcall(function()
					mp.TextureID = ""
				end)
			end
		end
		return part
	end
	if isR15 then
		local top = paint(char:FindFirstChild("UpperTorso"), KIT.WHITE)
		local shorts = paint(char:FindFirstChild("LowerTorso"), KIT.ROYAL)
		if top then
			KIT.singlet(st, top, 0, 1, name)
		end
		if shorts then
			for _, face in ipairs(KIT.SIDES) do
				KIT.gui(st, shorts, face, function(sg)
					KIT.box(sg, 0, 0, 1, 0.32, KIT.WHITE, 2)
					KIT.box(sg, 0, 0.13, 1, 0.07, KIT.ROYAL, 3)
					if face == Enum.NormalId.Left or face == Enum.NormalId.Right then
						KIT.box(sg, 0.42, 0.32, 0.16, 0.68, KIT.WHITE, 2)
					end
				end)
			end
		end
		for _, side in ipairs({ "Left", "Right" }) do
			local outer = if side == "Left" then Enum.NormalId.Left else Enum.NormalId.Right
			local thigh = paint(char:FindFirstChild(side .. "UpperLeg"), KIT.ROYAL)
			local shin = paint(char:FindFirstChild(side .. "LowerLeg"), skin)
			local foot = paint(char:FindFirstChild(side .. "Foot"), KIT.ROYAL)
			paint(char:FindFirstChild(side .. "UpperArm"), skin)
			local fore = paint(char:FindFirstChild(side .. "LowerArm"), skin)
			paint(char:FindFirstChild(side .. "Hand"), skin)
			if thigh then
				for _, face in ipairs(KIT.SIDES) do
					KIT.gui(st, thigh, face, function(sg)
						KIT.box(sg, 0, 0.9, 1, 0.1, KIT.WHITE, 2) -- hem
						if face == outer then
							KIT.box(sg, 0.4, 0, 0.2, 0.9, KIT.WHITE, 2)
							KIT.hipNumber(st, sg, 0.14, 0.08, 0.72, 0.34)
						elseif face == Enum.NormalId.Front and side == "Right" then
							KIT.text(sg, 0.48, 0.06, 0.44, 0.16, "T&F", KIT.WHITE, 4)
						end
					end)
				end
			end
			if shin then
				KIT.band(st, shin, 0.68, 0.32, KIT.WHITE, KIT.ROYAL)
			end
			if foot then
				KIT.spikes(st, foot, outer, 0)
			end
			if fore then
				KIT.band(st, fore, 0.74, 0.16, KIT.ROYAL, KIT.PIN)
			end
		end
	else
		local torso = paint(char:FindFirstChild("Torso"), KIT.WHITE)
		if torso then
			KIT.singlet(st, torso, 0, 0.8, name)
			for _, face in ipairs(KIT.SIDES) do
				KIT.gui(st, torso, face, function(sg)
					KIT.box(sg, 0, 0.8, 1, 0.2, KIT.ROYAL, 6)
					KIT.box(sg, 0, 0.8, 1, 0.045, KIT.WHITE, 7)
				end)
			end
		end
		for _, side in ipairs({ "Left", "Right" }) do
			local outer = if side == "Left" then Enum.NormalId.Left else Enum.NormalId.Right
			local leg = paint(char:FindFirstChild(side .. " Leg"), skin)
			local arm = paint(char:FindFirstChild(side .. " Arm"), skin)
			if leg then
				for _, face in ipairs(KIT.SIDES) do
					KIT.gui(st, leg, face, function(sg)
						KIT.box(sg, 0, 0, 1, 0.42, KIT.ROYAL, 2) -- shorts
						KIT.box(sg, 0, 0.42, 1, 0.035, KIT.WHITE, 3)
						if face == outer then
							KIT.box(sg, 0.4, 0, 0.2, 0.42, KIT.WHITE, 3)
							KIT.hipNumber(st, sg, 0.15, 0.05, 0.7, 0.22)
						end
						KIT.box(sg, 0, 0.64, 1, 0.2, KIT.WHITE, 2) -- sock
						KIT.box(sg, 0, 0.64, 1, 0.035, KIT.ROYAL, 3)
					end)
				end
				KIT.spikes(st, leg, outer, 0.84)
			end
			if arm then
				KIT.band(st, arm, 0.78, 0.1, KIT.ROYAL, KIT.PIN)
			end
		end
	end
	KIT.setNumber(st, number)
	return st
end

KIT.setNumber = function(st: any, number: number)
	for _, label in ipairs(st.numbers) do
		label.Text = tostring(number)
	end
end

-- take the kit off again and give the character its own look back
KIT.remove = function(st: any)
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
	if st.char.Parent then
		for _, h in ipairs(st.hidden) do
			pcall(function()
				h.inst.Parent = h.parent or st.char
			end)
		end
	end
end

---------------------------------------------------------------------
-- SERVER HALF: saves PBs + world records (DataStore), runs the 40-yard dash line, puts the
-- uniform on everyone, and gives every player the client half of this script.
---------------------------------------------------------------------
if game:GetService("RunService"):IsServer() then
	(function()
		local G = _G :: any
		local live = G.TrackAndFieldServer
		if typeof(live) == "Instance" and live ~= script and live.Parent ~= nil then
			return -- this version already runs from another Script
		end
		G.TrackAndFieldServer = script
		pcall(function()
			script:SetAttribute("TFVersion", KIT.VERSION)
		end)
		local Players = game:GetService("Players")
		local ReplicatedStorage = game:GetService("ReplicatedStorage")
		local DataStoreService = game:GetService("DataStoreService")
		-- default world records (just above a perfect run) until a player beats them
		local DEFAULT_WR: { [string]: number } = {
			["40yd"] = 4.83,
			["60m"] = 7.09,
			["100m"] = 10.70,
			["200m"] = 20.24,
			["400m"] = 43.32,
			["4x100m"] = 38.98,
			["4x200m"] = 77.20,
			["4x400m"] = 169.80,
		}
		local DEFAULT_HOLDER: { [string]: string } = {
			["40yd"] = "GridironGhost",
			["60m"] = "LegendLightning",
			["100m"] = "BoltLegacy_958",
			["200m"] = "BendMaster_LY",
			["400m"] = "IronLungs400",
			["4x100m"] = "Lightning AC",
			["4x200m"] = "Velocity TC",
			["4x400m"] = "Thunder Track",
		}

		-- an older copy of the game pasted into another Script would take over the remotes and the
		-- client copy (and run its old version for everyone): switch it off
		local warned: { [Instance]: boolean } = {}
		local function stopOldServerCopies()
			local roots: { Instance } = { game:GetService("ServerScriptService"), game:GetService("Workspace") }
			for _, root in ipairs(roots) do
				for _, d in ipairs(root:GetDescendants()) do
					if d ~= script and d:IsA("Script") and not d:IsA("LocalScript") and d:GetAttribute("TFVersion") == nil
						and (d :: Script).RunContext ~= Enum.RunContext.Client
					then
						local n = string.lower(d.Name)
						if n == "script" or string.find(n, "track", 1, true) ~= nil or string.find(n, "field", 1, true) ~= nil then
							pcall(function()
								(d :: any).Enabled = false
							end)
							pcall(function()
								(d :: any).Disabled = true
							end)
							if not warned[d] then
								warned[d] = true
								warn("[Track And Field] Switched off an older copy of the game: " .. d:GetFullName() .. " - delete it.")
							end
						end
					end
				end
			end
		end

		local playerStore: any, recordStore: any = nil, nil
		local storesOk = pcall(function()
			playerStore = DataStoreService:GetDataStore("TrackAndField_Players_v1")
			recordStore = DataStoreService:GetDataStore("TrackAndField_Records_v1")
		end)
		local remotes: { [string]: any } = {}
		local function fireAll(name: string, ...: any)
			local r = remotes[name]
			if r then
				r:FireAllClients(...)
			end
		end
		local records: { [string]: { time: number, holder: string } } = {}
		for name, t in pairs(DEFAULT_WR) do
			records[name] = { time = t, holder = DEFAULT_HOLDER[name] }
		end
		if storesOk then
			task.spawn(function()
				for name in pairs(DEFAULT_WR) do
					local ok, value = pcall(function()
						return recordStore:GetAsync("WR_" .. name)
					end)
					if ok and type(value) == "table" and type(value.time) == "number" and type(value.holder) == "string" then
						records[name] = { time = value.time, holder = value.holder }
						fireAll("Records", name, records[name])
					end
				end
			end)
		end

		type Profile = { pbs: { [string]: number }, settings: { [string]: any }, loaded: boolean }
		local profiles: { [Player]: Profile } = {}
		local function saveProfile(plr: Player)
			local profile = profiles[plr]
			if not profile or not profile.loaded or not storesOk then
				return
			end
			pcall(function()
				playerStore:SetAsync("u" .. plr.UserId, { pbs = profile.pbs, settings = profile.settings })
			end)
		end

		-- uniform: on by default, off if the player switched it off
		local kits: { [Model]: any } = {}
		local kitWanted: { [Player]: boolean } = {}
		local kitNumber: { [Player]: number } = {}
		local function applyKit(plr: Player)
			local char = plr.Character
			if not char or not char.Parent or not char:FindFirstChildOfClass("Humanoid") then
				return
			end
			local want = kitWanted[plr]
			if want == nil then
				local profile = profiles[plr]
				want = not (profile ~= nil and profile.settings.Uniform == false)
			end
			local st = kits[char]
			if want and not st then
				local ok, res = pcall(KIT.wear, char, plr.Name, kitNumber[plr] or 1)
				if ok and res then
					kits[char] = res
				elseif not ok then
					warn("[Track And Field] uniform: " .. tostring(res))
				end
			elseif not want and st then
				kits[char] = nil
				pcall(KIT.remove, st)
			end
		end

		local function loadProfile(plr: Player)
			local profile: Profile = { pbs = {}, settings = {}, loaded = false }
			profiles[plr] = profile
			if storesOk then
				local ok, value = pcall(function()
					return playerStore:GetAsync("u" .. plr.UserId)
				end)
				if ok and type(value) == "table" then
					if type(value.pbs) == "table" then
						for k, v in pairs(value.pbs) do
							if type(k) == "string" and type(v) == "number" then
								profile.pbs[k] = v
							end
						end
					end
					if type(value.settings) == "table" then
						for k, v in pairs(value.settings) do
							if type(k) == "string" and (type(v) == "string" or type(v) == "boolean") then
								profile.settings[k] = v
							end
						end
					end
				end
			end
			profile.loaded = true
			applyKit(plr) -- the saved setting may say "no uniform"
		end

		-- 40-yard dash line
		local queue: { Player } = {}
		local current: Player? = nil
		local currentSince = 0
		local started = false
		local function broadcast()
			local names = {}
			for _, p in ipairs(queue) do
				table.insert(names, p.Name)
			end
			fireAll("Dash", "state", if current then current.Name else "", if current then current.UserId else 0, names)
		end
		local function advance()
			if not current and #queue > 0 then
				current = table.remove(queue, 1)
				currentSince = os.clock()
				started = false
			end
			broadcast()
		end
		local function leave(plr: Player)
			local i = table.find(queue, plr)
			if i then
				table.remove(queue, i)
			end
			if current == plr then
				current = nil
			end
		end
		task.spawn(function()
			while true do
				task.wait(1)
				if current and os.clock() - currentSince > (if started then 30 else 15) then
					current = nil
					advance()
				end
			end
		end)

		-- the remotes the client half talks to (rebuilt if an older copy ever replaces them)
		local net: Instance? = nil
		local function buildNet()
			local old = ReplicatedStorage:FindFirstChild("TrackAndFieldNet")
			if old and old ~= net then
				if old:GetAttribute("TFVersion") == nil then
					stopOldServerCopies()
				end
				old:Destroy()
			end
			local folder = Instance.new("Folder")
			folder.Name = "TrackAndFieldNet"
			folder:SetAttribute("TFVersion", KIT.VERSION)
			local function remote(className: string, name: string): any
				local r = Instance.new(className)
				r.Name = name
				r.Parent = folder
				remotes[name] = r
				return r
			end
			local getData = remote("RemoteFunction", "GetData")
			local submit = remote("RemoteEvent", "Submit")
			local saveSettings = remote("RemoteEvent", "SaveSettings")
			remote("RemoteEvent", "Records")
			local dashEvent = remote("RemoteEvent", "Dash")
			local kitEvent = remote("RemoteEvent", "Kit")

			getData.OnServerInvoke = function(plr: Player)
				local t0 = os.clock()
				while not (profiles[plr] and profiles[plr].loaded) and os.clock() - t0 < 10 do
					task.wait(0.1)
				end
				local profile = profiles[plr]
				return {
					pbs = if profile then profile.pbs else {},
					settings = if profile then profile.settings else {},
					records = records,
					saving = storesOk,
				}
			end

			submit.OnServerEvent:Connect(function(plr: Player, eventName: any, time: any)
				if type(eventName) ~= "string" or type(time) ~= "number" or DEFAULT_WR[eventName] == nil or time ~= time then
					return
				end
				time = math.ceil(time * 100 - 1e-6) / 100
				if time < DEFAULT_WR[eventName] - 0.3 or time > 900 then
					return -- not physically possible in this game
				end
				local profile = profiles[plr]
				if profile then
					local pb = profile.pbs[eventName]
					if not pb or time < pb then
						profile.pbs[eventName] = time
						task.spawn(saveProfile, plr)
					end
				end
				-- world record: only counts when beaten by 0.01 - 0.05 s
				local wr = records[eventName]
				if wr and time < wr.time then
					local margin = math.floor((wr.time - time) * 100 + 0.5) / 100
					if margin >= 0.01 and margin <= 0.05 then
						local new = { time = time, holder = plr.Name }
						records[eventName] = new
						fireAll("Records", eventName, new)
						if storesOk then
							task.spawn(function()
								pcall(function()
									recordStore:UpdateAsync("WR_" .. eventName, function(stored: any): any
										if type(stored) == "table" and type(stored.time) == "number" and stored.time <= time then
											return nil
										end
										return new
									end)
								end)
							end)
						end
					end
				end
			end)

			saveSettings.OnServerEvent:Connect(function(plr: Player, settings: any)
				local profile = profiles[plr]
				if not profile or type(settings) ~= "table" then
					return
				end
				local clean = {}
				local count = 0
				for k, v in pairs(settings) do
					if type(k) == "string" and #k < 32 and (type(v) == "boolean" or (type(v) == "string" and #v < 32)) then
						clean[k] = v
						count += 1
					end
					if count > 24 then
						break
					end
				end
				profile.settings = clean
			end)

			dashEvent.OnServerEvent:Connect(function(plr: Player, action: any)
				if action == "join" then
					if current ~= plr and not table.find(queue, plr) then
						table.insert(queue, plr)
					end
				elseif action == "leave" then
					leave(plr)
				elseif action == "start" then
					if current == plr then
						started = true
						currentSince = os.clock()
					end
				elseif action == "done" then
					if current == plr then
						current = nil
					end
				elseif action == "defer" then
					-- it's their turn but they're mid-race: let the next person go, keep their spot at the front
					if current == plr and not started then
						if #queue > 0 then
							current = table.remove(queue, 1)
							table.insert(queue, 1, plr)
							started = false
						end
						currentSince = os.clock()
					end
				end
				advance()
			end)

			kitEvent.OnServerEvent:Connect(function(plr: Player, action: any, value: any)
				if action == "wear" and type(value) == "boolean" then
					kitWanted[plr] = value
					applyKit(plr)
				elseif action == "number" and type(value) == "number" and value == value then
					local n = math.clamp(math.floor(value), 1, 99)
					kitNumber[plr] = n
					local char = plr.Character
					local st = char and kits[char]
					if st then
						KIT.setNumber(st, n)
					end
				end
			end)

			folder.Parent = ReplicatedStorage
			net = folder
		end

		-- give every player the client half of this script
		local function deployClient()
			local have = false
			for _, c in ipairs(ReplicatedStorage:GetChildren()) do
				if c.Name == "TrackAndFieldClient" then
					if c:GetAttribute("TFVersion") == KIT.VERSION and not have then
						have = true
					else
						c:Destroy() -- an older (or duplicate) client copy
					end
				end
			end
			if have then
				return
			end
			local ok, err = pcall(function()
				local copy = (script :: any):Clone()
				copy.Name = "TrackAndFieldClient"
				copy.RunContext = Enum.RunContext.Client
				copy:SetAttribute("TFVersion", KIT.VERSION)
				copy.Parent = ReplicatedStorage
			end)
			if not ok then
				warn("[Track And Field] Could not start the game for players automatically (" .. tostring(err) .. "). Also paste this script into a LocalScript in StarterPlayer > StarterPlayerScripts.")
			end
		end

		buildNet()
		deployClient()
		-- if an older copy replaces the remotes or the client copy later, take them back
		ReplicatedStorage.ChildRemoved:Connect(function(c: Instance)
			if c == net then
				net = nil
				task.defer(function()
					stopOldServerCopies()
					buildNet()
				end)
			end
		end)
		ReplicatedStorage.ChildAdded:Connect(function(c: Instance)
			if c.Name == "TrackAndFieldClient" and c:GetAttribute("TFVersion") ~= KIT.VERSION then
				task.defer(function()
					stopOldServerCopies()
					deployClient()
				end)
			end
		end)

		local function onPlayer(plr: Player)
			plr.CharacterAppearanceLoaded:Connect(function()
				applyKit(plr)
			end)
			plr.CharacterRemoving:Connect(function(char: Model)
				kits[char] = nil
			end)
			if plr.Character and plr:HasAppearanceLoaded() then
				applyKit(plr)
			end
			loadProfile(plr)
		end
		Players.PlayerAdded:Connect(onPlayer)
		for _, p in ipairs(Players:GetPlayers()) do
			task.spawn(onPlayer, p)
		end
		Players.PlayerRemoving:Connect(function(plr: Player)
			saveProfile(plr)
			profiles[plr] = nil
			kitWanted[plr] = nil
			kitNumber[plr] = nil
			leave(plr)
			advance()
		end)
		game:BindToClose(function()
			for plr in pairs(profiles) do
				saveProfile(plr)
			end
		end)
	end)()
	return
end

-- only one copy of the game runs per player (a copy that was removed no longer counts).
-- Older versions are found and switched off further down (see OLD COPIES).
do
	local G = _G :: any
	local live = G.TrackAndFieldClient
	if typeof(live) == "Instance" and live ~= script and live.Parent ~= nil then
		return
	end
	G.TrackAndFieldOlderFlag = G.TrackAndFieldClientRunning == true and live == nil
	G.TrackAndFieldClient = script
	G.TrackAndFieldClientRunning = true -- older versions see this and stay off
end


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
	Bots = false,
	LeftKey = Enum.KeyCode.A,
	RightKey = Enum.KeyCode.D,
	PassKey = Enum.KeyCode.Space,
}

-- colours + shared constants (kept in one table: Luau allows 200 locals)
local K: { [string]: any } = {}
local X: { [string]: any } = {} -- newer features (bots, relays, saving, 40-yard dash, free-roam animation)

---------------------------------------------------------------------
-- OLD COPIES: an older version of this game (for example an old LocalScript left in
-- StarterPlayerScripts) must never run next to this one. Two copies fight over your
-- character - one switches the default controls back on, the other snaps you forward.
-- They are found, switched off, and what they built is removed.
---------------------------------------------------------------------
X.VERSION = 5
X.oldWarned = false
X.isOldCopy = function(d: Instance): boolean
	if d == script or not d:IsA("BaseScript") or d:GetAttribute("TFVersion") ~= nil then
		return false
	end
	if not d:IsA("LocalScript") and (d :: BaseScript).RunContext ~= Enum.RunContext.Client then
		return false
	end
	local n = string.lower(d.Name)
	return n == "localscript" or n == "script" or string.find(n, "track", 1, true) ~= nil
		or string.find(n, "field", 1, true) ~= nil or string.find(n, "t&f", 1, true) ~= nil
end
X.oldCopySigns = function(): boolean
	if (_G :: any).TrackAndFieldOlderFlag then
		return true
	end
	if Workspace:FindFirstChild("TrackAndField_World") then
		return true
	end
	local pg = player:FindFirstChild("PlayerGui")
	return pg ~= nil and (pg:FindFirstChild("TrackAndFieldUI") ~= nil or pg:FindFirstChild("TrackAndFieldLoading") ~= nil)
end
X.stopOldCopies = function()
	if not X.oldCopySigns() then
		return
	end
	(_G :: any).TrackAndFieldOlderFlag = false
	local roots: { Instance } = {}
	local function add(inst: Instance?)
		if inst then
			table.insert(roots, inst)
		end
	end
	add(player:FindFirstChild("PlayerScripts"))
	add(player:FindFirstChild("PlayerGui"))
	add(player:FindFirstChild("Backpack"))
	add(player.Character)
	add(game:GetService("ReplicatedFirst"))
	add(game:GetService("ReplicatedStorage"))
	local stopped = 0
	for _, root in ipairs(roots) do
		for _, d in ipairs(root:GetDescendants()) do
			if X.isOldCopy(d) then
				pcall(function()
					(d :: any).Enabled = false
				end)
				pcall(function()
					(d :: any).Disabled = true
				end)
				stopped += 1
				warn("[Track And Field] Switched off an older copy of the game: " .. d:GetFullName() .. " - delete it.")
			end
		end
	end
	local oldWorld = Workspace:FindFirstChild("TrackAndField_World")
	if oldWorld then
		oldWorld:Destroy()
	end
	local pg = player:FindFirstChild("PlayerGui")
	if pg then
		for _, n in ipairs({ "TrackAndFieldUI", "TrackAndFieldLoading" }) do
			local g = pg:FindFirstChild(n)
			if g then
				g:Destroy()
			end
		end
	end
	local after = X.afterOldCopy
	if after then
		task.defer(after, stopped)
	else
		X.pendingOldRestore = true -- found while starting up: tidy up once the world is built
	end
end
Workspace.ChildAdded:Connect(function(c: Instance)
	if c.Name == "TrackAndField_World" then
		task.defer(X.stopOldCopies)
	end
end)
task.spawn(function()
	local pg = player:WaitForChild("PlayerGui")
	pg.ChildAdded:Connect(function(c: Instance)
		if c.Name == "TrackAndFieldUI" or c.Name == "TrackAndFieldLoading" then
			task.defer(X.stopOldCopies)
		end
	end)
end)
X.stopOldCopies()
task.delay(2, X.stopOldCopies)
task.delay(6, X.stopOldCopies)
K.ROYAL = Color3.fromRGB(35, 78, 214)
K.KITS = { Color3.fromRGB(220, 40, 40), Color3.fromRGB(250, 200, 30), Color3.fromRGB(20, 150, 70), Color3.fromRGB(240, 120, 20), Color3.fromRGB(130, 50, 180), Color3.fromRGB(20, 20, 24), Color3.fromRGB(0, 170, 190), Color3.fromRGB(200, 30, 120) }
K.SKINS = { Color3.fromRGB(255, 220, 177), Color3.fromRGB(234, 192, 134), Color3.fromRGB(198, 134, 66), Color3.fromRGB(141, 85, 36), Color3.fromRGB(97, 58, 30), Color3.fromRGB(66, 40, 22) }
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
K.INNER_APRON = 3.5
K.OUTER_APRON = 4
local BAND_IN = RC - K.INNER_APRON
local BAND_OUT = R_OUT + K.OUTER_APRON
local TRACK_TOP = 0.3
K.LINE_TOP = 0.33
K.MARK_TOP = 0.35
local FLOOR_TOP = 0.36
K.BEND_SEGMENTS = 36
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
for _, n in ipairs({ "TrackAndFieldWorld", "TrackAndField_World" }) do
	local o = Workspace:FindFirstChild(n)
	if o then
		o:Destroy()
	end
end
local World = create("Folder", { Name = "TrackAndFieldWorld", Parent = Workspace })
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
	local segAngle = math.pi / K.BEND_SEGMENTS
	local zMid = (RC + R_OUT) / 2
	local function len(r: number): number
		return 2 * r * math.tan(segAngle / 2)
	end
	-- bends: flat segments (no overlapping layers = no flicker)
	for _, sign in ipairs({ 1, -1 }) do
		local center = Vector3.new(sign * HALF, 0, 0)
		for i = 0, K.BEND_SEGMENTS - 1 do
			local a = (i + 0.5) * segAngle
			local out = Vector3.new(sign * math.sin(a), 0, sign * math.cos(a))
			local function segCF(r: number): CFrame
				local pos = center + out * r
				return CFrame.lookAt(pos, pos + out)
			end
			table.insert(trackSurfaces, flat("Bend", segCF(zMid), len(R_OUT) + 0.05, R_OUT - RC, TRACK_TOP, trackColor, K.TRACK_MATERIAL))
			table.insert(trackSurfaces, flat("OuterApron", segCF((R_OUT + BAND_OUT) / 2), len(BAND_OUT) + 0.05, K.OUTER_APRON, TRACK_TOP, trackColor, K.TRACK_MATERIAL))
			flat("InnerApron", segCF((BAND_IN + RC) / 2), len(RC) + 0.05, K.INNER_APRON, TRACK_TOP, K.APRON_COLOR, Enum.Material.Concrete)
			flat("Kerb", segCF(RC - 0.25), len(RC) + 0.02, 0.5, TRACK_TOP + 0.12, K.KERB_COLOR, Enum.Material.Metal, 0.17)
			for k = 1, LANES do
				local r = RC + k * LANE_W
				flat("BendLine", segCF(r), len(r) + 0.02, LINE_W, K.LINE_TOP, K.LINE_COLOR, Enum.Material.SmoothPlastic, 0.02)
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
		table.insert(trackSurfaces, flat("OuterApron", CFrame.new(0, 0, sign * (R_OUT + BAND_OUT) / 2), STRAIGHT, K.OUTER_APRON, TRACK_TOP, trackColor, K.TRACK_MATERIAL))
		flat("InnerApron", CFrame.new(0, 0, sign * (BAND_IN + RC) / 2), STRAIGHT, K.INNER_APRON, TRACK_TOP, K.APRON_COLOR, Enum.Material.Concrete)
		flat("Kerb", CFrame.new(0, 0, sign * (RC - 0.25)), STRAIGHT, 0.5, TRACK_TOP + 0.12, K.KERB_COLOR, Enum.Material.Metal, 0.17)
		for k = 1, LANES do
			flat("LaneLine", CFrame.new(0, 0, sign * (RC + k * LANE_W)), STRAIGHT, LINE_W, K.LINE_TOP, K.LINE_COLOR, Enum.Material.SmoothPlastic, 0.02)
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
	flat("FinishLine", CFrame.new(HALF, 0, zMid), 0.45, LANES * LANE_W, K.MARK_TOP, K.LINE_COLOR, Enum.Material.SmoothPlastic, 0.02)
	local seen = {}
	for _, e in ipairs(EVENTS) do
		for lane = 1, LANES do
			local s = startS(e, lane)
			local key = lane .. ":" .. math.floor(s * 2 + 0.5)
			if not seen[key] and math.abs(s - FINISH_S) > 0.5 then
				seen[key] = true
				local pos, dir = trackSample(lane, s)
				flat("StartLine", CFrame.lookAt(pos, pos + dir), LANE_W - LINE_W, 0.2, K.MARK_TOP, K.LINE_COLOR, Enum.Material.SmoothPlastic, 0.02)
			end
		end
	end

	-- lane numbers painted after the finish line
	for lane = 1, LANES do
		local pos = Vector3.new(HALF + 4, K.MARK_TOP, laneRadius(lane))
		local p = flat("LaneNumber" .. lane, CFrame.lookAt(pos, pos + Vector3.new(-1, 0, 0)), 3.2, 3.2, K.MARK_TOP + 0.005, K.LINE_COLOR, Enum.Material.SmoothPlastic, 0.02)
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

-- Sprint cycle keyframes (degrees): 20 frames per stride, one every 5% of the cycle,
-- right side (the left side plays the same frames half a cycle later).
-- Frame 1 = right foot touchdown. Contact lasts ~20% of the cycle at top speed (Bolt:
-- 0.086 s on the ground, ~2.4 strides/s). Front-side mechanics (Lyles): the knee is driven
-- high in front, the heel folds tight under the hips, the foot is clawed back to land under
-- the body. Hip = thigh angle to the trunk, knee/elbow = flexion, ankle = dorsiflexion
-- (+ toes up), shoulder = arm swing (+ forward). The right arm swings with the left leg.
K.TOP = {
	--         TD    5%   10%   15%  TO20%  25%   30%   35%   40%   45%   50%   55%   60%   65%   70%   75%   80%   85%   90%   95%
	hip = { 24, 14, 3, -8, -16, -18, -12, 0, 16, 34, 52, 66, 74, 76, 70, 60, 48, 38, 31, 27 },
	knee = { 26, 38, 44, 36, 24, 40, 70, 98, 118, 128, 126, 112, 92, 70, 50, 36, 26, 20, 20, 22 },
	ankle = { -4, 8, 14, 4, -24, -28, -18, -6, 4, 12, 16, 18, 18, 16, 12, 8, 5, 2, 0, -2 },
	shoulder = { 58, 66, 70, 68, 58, 42, 22, 0, -20, -38, -50, -56, -58, -54, -42, -24, -2, 20, 38, 50 },
	elbow = { 70, 66, 64, 66, 70, 78, 86, 94, 102, 108, 112, 114, 112, 106, 98, 90, 82, 76, 72, 70 },
}
-- Drive phase (first steps out of the blocks): longer ground contact (~30% of the cycle),
-- full extension at toe-off - head, hips and ankle in one straight line - a low heel
-- recovery and a big, powerful arm swing. The trunk starts at ~45 degrees and rises.
K.DRIVE = {
	--         TD    5%   10%   15%   20%   25%  TO30%  35%   40%   45%   50%   55%   60%   65%   70%   75%   80%   85%   90%   95%
	hip = { 52, 40, 28, 16, 6, -1, -4, 2, 16, 34, 52, 68, 79, 84, 83, 77, 69, 62, 57, 54 },
	knee = { 62, 60, 54, 44, 30, 16, 8, 24, 50, 74, 90, 96, 94, 88, 80, 74, 70, 67, 64, 63 },
	ankle = { 12, 20, 22, 18, 8, -12, -32, -26, -10, 6, 16, 22, 24, 24, 22, 20, 18, 16, 14, 13 },
	shoulder = { 70, 80, 86, 86, 78, 60, 34, 6, -22, -46, -62, -70, -72, -66, -50, -26, 2, 30, 52, 64 },
	elbow = { 84, 80, 76, 76, 80, 88, 98, 108, 116, 122, 126, 128, 126, 120, 112, 104, 96, 90, 86, 84 },
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

-- one joint at stride phase u, blended between top speed (drive 0) and drive phase (drive 1), degrees
local function cycleDeg(name: string, u: number, drive: number): number
	local a = curve((K.TOP :: any)[name], u)
	local b = curve((K.DRIVE :: any)[name], u)
	return a + (b - a) * drive
end
local function cycle(name: string, u: number, drive: number): number
	return math.rad(cycleDeg(name, u, drive))
end

-- R6 limbs have no knees or elbows: aim the straight leg along the hip-to-foot line of the
-- bent leg (for two equal segments that is hip - knee/2), and swing the straight arm a bit less
local function legLineR6(u: number, drive: number): number
	return math.rad(cycleDeg("hip", u, drive) - cycleDeg("knee", u, drive) * 0.5)
end

-- u: stride phase 0..1, amp: 0..1 effort, drive: 1 = first step, 0 = upright,
-- bend: body lean into the curve (radians, + = left)
local function poseRun(u: number, amp: number, drive: number, bend: number, isR15: boolean): Pose
	local uL = (u + 0.5) % 1
	local lean = -math.rad(8 + 37 * drive)
	-- pelvis turns with the forward leg, shoulders counter-rotate (peaks at the knee lift)
	local twist = math.sin((u - 0.4) * math.pi * 2)
	if isR15 then
		-- lowest at mid-stance, highest in mid-flight: two bounces per stride
		local bob = (-0.1 * math.cos((u - 0.08) * math.pi * 4) - 0.02) * amp - 0.25 * drive
		local armOut = 0.1 + 0.04 * drive
		return {
			root = J(lean, math.rad(6) * twist * amp, bend, bob, -0.3 * drive),
			waist = J(-0.03, -math.rad(11) * twist * amp, -bend * 0.3),
			neck = J(-lean * 0.78 - 0.05 * drive, math.rad(5) * twist * amp, -bend * 0.4),
			hipR = J(cycle("hip", u, drive) * amp),
			hipL = J(cycle("hip", uL, drive) * amp),
			kneeR = J(-cycle("knee", u, drive) * amp),
			kneeL = J(-cycle("knee", uL, drive) * amp),
			ankleR = J(cycle("ankle", u, drive) * amp),
			ankleL = J(cycle("ankle", uL, drive) * amp),
			shoulderR = J(cycle("shoulder", u, drive) * amp, 0, armOut),
			shoulderL = J(cycle("shoulder", uL, drive) * amp, 0, -armOut),
			elbowR = J(cycle("elbow", u, drive)),
			elbowL = J(cycle("elbow", uL, drive)),
		}
	end
	local leanR6 = -math.rad(6 + 26 * drive)
	local bobR6 = (0.08 * math.abs(math.cos(u * math.pi * 2)) - 0.04) * amp - 0.2 * drive
	return {
		root = J(leanR6, math.rad(5) * twist * amp, bend, bobR6),
		neck = J(-leanR6 * 0.7, 0, -bend * 0.4),
		hipR = J(legLineR6(u, drive) * 0.85 * amp),
		hipL = J(legLineR6(uL, drive) * 0.85 * amp),
		shoulderR = J((cycle("shoulder", u, drive) * 0.85 + math.rad(4)) * amp, 0, 0.1),
		shoulderL = J((cycle("shoulder", uL, drive) * 0.85 + math.rad(4)) * amp, 0, -0.1),
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

-- after the line: celebration sequences that play out over time
local function airplane(t: number, isR15: boolean): Pose
	-- arms spread like wings while jogging it out
	local pose = poseRun((t * 1.5) % 1, 0.32, 0, 0, isR15)
	pose.root[1] = 0.05
	pose.root[3] = math.sin(t * 2.6) * 0.14
	pose.shoulderR = J(0.12, 0, 1.45)
	pose.shoulderL = J(0.12, 0, -1.45)
	pose.elbowR = J(0.1)
	pose.elbowL = J(0.1)
	pose.neck = J(0.3)
	return pose
end

local function poseCelebrate(kind: string, t: number, isR15: boolean): Pose
	if kind == "bolt" or kind == "lyles" then
		if t < 1.7 then
			return airplane(t, isR15)
		end
		local loopT = (t - 1.7) % 7
		if kind == "bolt" then
			if loopT < 4.5 then
				-- Usain Bolt's lightning pose: lean back, left arm to the sky, right arm drawn like a bow
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
			end
			-- chest thump
			local thump = math.max(0, math.sin(t * 9)) * 0.25
			return {
				root = J(0.05, 0, 0, math.abs(math.sin(t * 4.5)) * 0.06),
				neck = J(0.45),
				shoulderR = J(1.05 + thump, 0, 0.15),
				elbowR = J(2.2),
				shoulderL = J(2.6, 0, -0.35),
				elbowL = J(0.15),
			}
		end
		if loopT < 3.5 then
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
		end
		-- double-biceps flex
		local pulse = math.sin(t * 6) * 0.06
		return {
			root = J(0.06, 0, 0, -0.05),
			neck = J(0.35, math.sin(t * 1.5) * 0.3),
			shoulderR = J(0.25, 0, 1.45 + pulse),
			shoulderL = J(0.25, 0, -1.45 - pulse),
			elbowR = J(2.3),
			elbowL = J(2.3),
			hipR = J(0, 0, 0.12),
			hipL = J(0, 0, -0.12),
		}
	elseif kind == "podium" then
		if t < 2.2 then
			-- fist pump
			local pump = math.sin(t * 9) * 0.3
			return {
				root = J(0.05, 0, 0, math.abs(math.sin(t * 4.5)) * 0.08),
				neck = J(0.3),
				shoulderR = J(2.45 + pump, 0, 0.25),
				elbowR = J(isR15 and 0.7 or 0),
				shoulderL = J(0.1, 0, -0.15),
				elbowL = J(0.6),
			}
		end
		-- point to the sky, other hand on the hip
		return {
			root = J(0.1, 0, 0, math.sin(t * 2) * 0.02),
			neck = J(0.55),
			shoulderR = J(2.95, 0, 0.1),
			elbowR = J(0.05),
			shoulderL = J(-0.2, 0, -0.5),
			elbowL = J(1.7),
		}
	elseif kind == "watch" then
		-- relay runner after the handoff: hands on hips, watching the team
		local breathe = math.sin(t * 3) * 0.03
		return {
			root = J(-0.05, 0, 0, breathe),
			neck = J(0.1, 0.35, 0),
			shoulderR = J(-0.2, 0, 0.5),
			shoulderL = J(-0.2, 0, -0.5),
			elbowR = J(1.7),
			elbowL = J(1.7),
			hipR = J(0, 0, 0.1),
			hipL = J(0, 0, -0.1),
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
	-- tired: hands on knees, then stand up with hands on the head
	if t < 3 then
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
	return {
		root = J(0.03, 0, 0, math.sin(t * 3.5) * 0.04),
		neck = J(0.3, math.sin(t * 0.8) * 0.3),
		shoulderR = J(isR15 and 2.4 or 2.9, 0, isR15 and 1.05 or 0.55),
		shoulderL = J(isR15 and 2.4 or 2.9, 0, isR15 and -1.05 or -0.55),
		elbowR = J(2.3),
		elbowL = J(2.3),
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

X.DASH = makeEvent("40yd", 36.576, 36.5, 20) -- 40 yards on the grass
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
	["40yd"] = "GridironGhost",
}
local worldRecords: { [string]: { time: number, holder: string, isPlayer: boolean } } = {}
local seasonBests: { [string]: { { name: string, time: number, isPlayer: boolean } } } = {}
for _, e in ipairs(EVENTS) do
	seasonBests[e.Name] = {}
end
seasonBests["40yd"] = {}

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
for _, n in ipairs({ "TrackAndFieldHUD", "TrackAndFieldLoader", "TrackAndFieldUI", "TrackAndFieldLoading" }) do
	local o = UI.playerGui:FindFirstChild(n)
	if o then
		o:Destroy()
	end
end

UI.gui = create("ScreenGui", {
	Name = "TrackAndFieldHUD",
	ResetOnSpawn = false,
	IgnoreGuiInset = true,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	DisplayOrder = 5,
	Parent = UI.playerGui,
})
UI.loadGui = create("ScreenGui", {
	Name = "TrackAndFieldLoader",
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
do
	local specs: { { any } } = { { UDim2.fromScale(1, 0.2), UDim2.fromScale(0, 0), 90 }, { UDim2.fromScale(1, 0.2), UDim2.fromScale(0, 0.8), 270 }, { UDim2.fromScale(0.15, 1), UDim2.fromScale(0, 0), 0 }, { UDim2.fromScale(0.15, 1), UDim2.fromScale(0.85, 0), 180 } }
	K.vignetteSpecs = specs
end
for i, spec in ipairs(K.vignetteSpecs) do
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
UI.versionLabel = label({ Name = "Version", Text = "TRACK AND FIELD  v" .. X.VERSION, Font = K.FONT_BOLD, TextSize = 11, TextColor3 = K.C_MUTED, TextStrokeTransparency = 0.6, Size = UDim2.fromOffset(176, 14), LayoutOrder = 3, Parent = UI.menu })

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
UI.indoorButton = scaled(button({ Name = "IndoorButton", Text = "INDOOR ARENA  -  SOON", Font = K.FONT_BLACK, TextSize = 13, AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -14, 0, 12), Size = UDim2.fromOffset(312, 38), BackgroundColor3 = K.C_PANEL, Parent = UI.gui }))
stroke(UI.indoorButton, K.ROYAL_LIGHT, 1.5, 0.3)
UI.lbPanel = scaled(panel({ Name = "Leaderboard", AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -14, 0, 104), Size = UDim2.fromOffset(312, 446), Parent = UI.gui }))
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
UI.setPanel = scaled(panel({ Name = "Settings", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(470, 568), Visible = false, ZIndex = 25, Parent = UI.gui }))
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
addOption(3, "Bots on Track", "Bots", { "on", "off" }, { "ON", "OFF" })
addOption(4, "Uniform (white & blue)", "Uniform", { "on", "off" }, { "ON", "OFF" })
addOption(5, "Track Colour", "TrackColor", { "Red", "Blue" }, { "RED", "BLUE" })
addOption(6, "Camera  [C]", "Camera", { "Chase", "Side" }, { "CHASE", "SIDE" })
addOption(7, "Win Celebration", "Celebration", { "Bolt", "Lyles" }, { "BOLT", "LYLES" })
addOption(8, "Announcer Voice", "Voice", { "on", "off" }, { "ON", "OFF" })
addOption(9, "Performance Mode", "PerformanceMode", { "on", "off" }, { "ON", "OFF" })

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
		UI.indoorButton.Position = UDim2.new(1, -8, 0, 8)
		UI.lbPanel.Position = UDim2.new(1, -8, 0, 8 + 46 * uiScale)
	else
		UI.indoorButton.Position = UDim2.new(1, -14, 0, 12)
		UI.lbPanel.Position = UDim2.new(1, -14, 0, 12 + 50 * uiScale)
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
-- UNIFORM: the server dresses you (so everyone sees it); without the server half your
-- own client does it (only you see it). The kit itself is KIT at the top of the script.
---------------------------------------------------------------------
local uniformStates: { [Model]: any } = {}
X.bibNumber = 1
X.kitRemote = nil :: RemoteEvent?

local function applyUniform(char: Model)
	if uniformStates[char] then
		return
	end
	local ok, st = pcall(KIT.wear, char, player.Name, X.bibNumber)
	if ok and st then
		uniformStates[char] = st
	elseif not ok then
		warn("[Track And Field] uniform: " .. tostring(st))
	end
end

local function removeUniform(char: Model)
	local st = uniformStates[char]
	if st then
		uniformStates[char] = nil
		pcall(KIT.remove, st)
	end
end

-- your lane number on the bib and the hip numbers
local function setBib(lane: number)
	X.bibNumber = lane
	local remote = X.kitRemote
	if remote then
		remote:FireServer("number", lane)
		return
	end
	local char = player.Character
	local st = char and uniformStates[char]
	if st then
		KIT.setNumber(st, lane)
	end
end

local function refreshUniform()
	local remote = X.kitRemote
	if remote then
		remote:FireServer("wear", Settings.Uniform)
		return
	end
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
	external: boolean, -- true = distance comes from where your character really is (no teleporting)
	lastPos: Vector3?,
	line: { origin: Vector3, dir: Vector3 }?, -- straight path (40-yard dash) instead of a lane
	handoffAt: number,
	visOffset: number?, -- drawn this far ahead of r.dist (smooths the baton hand-over)
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
	relay: any,
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
	if not r.external then
		r.dist += r.speed * dt
	end

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
		external = false,
		lastPos = nil,
		line = nil,
		handoffAt = 0,
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
local allEvents = table.clone(EVENTS)
table.insert(allEvents, X.DASH)
for _, e in ipairs(allEvents) do
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
	local wr = math.floor((officialTime(r.finishTime or t) + (if e.Relay then 0.04 else 0.03)) * 100 + 0.5) / 100
	worldRecords[e.Name] = { time = wr, holder = K.WR_HOLDERS[e.Name] or "Legend", isPlayer = false }
end

---------------------------------------------------------------------
-- PLAYER CONTROL
---------------------------------------------------------------------
local function runnerSample(r: Runner): (Vector3, Vector3)
	local line = r.line
	local d = r.dist + (r.visOffset or 0)
	if line then
		return line.origin + line.dir * (d - START_BACK), line.dir
	end
	return trackSample(r.lane, r.sStart - START_BACK + d)
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
	if not lock then
		X.moverOff() -- always hand your body back to you
	end
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
		-- Roblox's own Animate keeps running: other players see its normal run animation,
		-- while on your screen this game's sprint animation is laid over it every frame
		if char then
			setAnimateEnabled(char, true)
		end
	elseif not lock and controlsLocked then
		controlsLocked = false
		local controls = getControls()
		if controls then
			pcall(function()
				controls:Enable()
			end)
		end
		X.moverOff()
		if hum then
			hum:Move(Vector3.zero)
			hum.WalkSpeed = if savedHumanoid.WalkSpeed > 0 then savedHumanoid.WalkSpeed else 16
			hum.JumpPower = if savedHumanoid.JumpPower > 0 then savedHumanoid.JumpPower else 50
			hum.JumpHeight = if savedHumanoid.JumpHeight > 0 then savedHumanoid.JumpHeight else 7.2
			hum.AutoRotate = true
		end
	end
end

-- Physics mover: a LinearVelocity (flat plane, gravity untouched) + AlignOrientation on your
-- HumanoidRootPart. Your body really runs - it is pushed along at your speed every physics step,
-- never teleported - and nothing else (the default controls, another script) can stop it.
X.motor = { lv = nil, ao = nil, root = nil }
X.mover = function(root: BasePart): (LinearVelocity, AlignOrientation)
	local m = X.motor
	local lv: LinearVelocity? = m.lv
	local ao: AlignOrientation? = m.ao
	if m.root ~= root or not lv or not lv.Parent or not ao or not ao.Parent then
		if lv then
			lv:Destroy()
		end
		if ao then
			ao:Destroy()
		end
		local found = root:FindFirstChild("TF_MoveAttachment")
		local att: Attachment = if found and found:IsA("Attachment") then found else create("Attachment", { Name = "TF_MoveAttachment", Parent = root })
		lv = create("LinearVelocity", {
			Name = "TF_Mover",
			Attachment0 = att,
			RelativeTo = Enum.ActuatorRelativeTo.World,
			VelocityConstraintMode = Enum.VelocityConstraintMode.Plane,
			PrimaryTangentAxis = Vector3.xAxis,
			SecondaryTangentAxis = Vector3.zAxis,
			ForceLimitsEnabled = true,
			MaxForce = 1e7,
			Enabled = false,
			Parent = root,
		})
		ao = create("AlignOrientation", {
			Name = "TF_Facing",
			Attachment0 = att,
			Mode = Enum.OrientationAlignmentMode.OneAttachment,
			Responsiveness = 45,
			MaxTorque = 1e7,
			Enabled = false,
			Parent = root,
		})
		m.lv = lv
		m.ao = ao
		m.root = root
	end
	return lv :: LinearVelocity, ao :: AlignOrientation
end

-- run your body at this velocity (studs/s, flat) facing this way
X.moveDir = nil :: Vector3?
X.drive = function(root: BasePart, hum: Humanoid, velocity: Vector3, face: Vector3)
	local lv, ao = X.mover(root)
	local flat = Vector3.new(velocity.X, 0, velocity.Z)
	lv.PlaneVelocity = Vector2.new(flat.X, flat.Z)
	lv.Enabled = true
	local f = Vector3.new(face.X, 0, face.Z)
	if f.Magnitude > 0.01 then
		ao.CFrame = CFrame.lookAt(Vector3.zero, f.Unit)
		ao.Enabled = true
	end
	hum.AutoRotate = false
	hum.WalkSpeed = flat.Magnitude
	local md = if flat.Magnitude > 0.05 then flat.Unit else Vector3.zero
	X.moveDir = md
	hum:Move(md)
end

X.moverOff = function()
	local m = X.motor
	local lv: LinearVelocity? = m.lv
	local ao: AlignOrientation? = m.ao
	if lv then
		lv.Enabled = false
	end
	if ao then
		ao.Enabled = false
	end
	X.moveDir = nil
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
	r.external = true
	r.lastPos = nil
	if not r.rig or r.rig.model ~= char then
		r.rig = newRig(char)
	end
	X.drive(root, hum, Vector3.zero, dir) -- stand still in your blocks until the gun
end

-- distance = how far your character really ran along the lane this frame
local function measurePlayer(r: Runner)
	local root = r.root
	if not r.external or not root then
		return
	end
	local rp = root.Position
	local lp = r.lastPos
	if lp then
		local _, dir = runnerSample(r)
		local d = Vector3.new(rp.X - lp.X, 0, rp.Z - lp.Z):Dot(dir)
		if d > 0 and d < 25 then
			r.dist += d
		end
	end
	r.lastPos = rp
end

local function drivePlayerCharacter(r: Runner)
	local char, hum, root = getPlayerParts()
	if not char or not hum or not root then
		return
	end
	if r.model ~= char then
		if r.external then
			placePlayerAt(r) -- respawned mid race
		end
		return
	end
	-- you are never moved by the game while running: the Humanoid runs at
	-- your speed along your lane and the race distance follows your body
	local pos, dir = runnerSample(r)
	local rp = root.Position
	local err = Vector3.new(pos.X - rp.X, 0, pos.Z - rp.Z)
	if r.speed < 0.05 then
		X.drive(root, hum, Vector3.zero, dir)
		return
	end
	-- run along the lane, gently steering back to its centre line
	local lateral = err - dir * err:Dot(dir)
	local steer = lateral * 4
	if steer.Magnitude > 6 then
		steer = steer.Unit * 6
	end
	X.drive(root, hum, dir * r.speed + steer, dir)
end

-- relay baton in your right hand
local baton: BasePart? = nil
local function giveBaton(give: boolean, holder: Model?)
	if baton then
		baton:Destroy()
		baton = nil
	end
	if not give then
		return
	end
	local char = holder or player.Character
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
	elseif state == "handoffGive" or state == "handoffTake" then
		-- baton exchange: incoming runner reaches forward, outgoing reaches back
		local frac = math.clamp(r.speed / event.MaxSpeed, 0, 1)
		local pose = poseRun(r.phase, math.clamp(0.6 + frac * 0.4, 0, 1), 0, r.bend, isR15)
		if state == "handoffGive" then
			pose.shoulderR = J(1.5, 0, 0.05)
			pose.elbowR = J(0.08)
			pose.root[1] -= 0.1
			pose.neck = J(0.25)
		else
			pose.shoulderR = J(-1.05, 0, 0.3)
			pose.elbowR = J(0.12)
			pose.neck = J(0.1, 0.25, 0)
		end
		return pose
	elseif state == "relayWait" then
		return X.poseRelayWait(r.poseClock, isR15)
	elseif state == "dip" then
		return poseDip(isR15)
	elseif state == "celebrate" then
		return poseCelebrate(r.celebrate, r.poseClock, isR15)
	end
	return poseStand(r.poseClock)
end

RunService.PreSimulation:Connect(function(dt: number)
	local current = race
	local animated: { [Model]: boolean } = {}
	if current then
		local bodies: { any } = table.clone(current.runners)
		local rs = current.relay
		if rs then
			if rs.mate then
				table.insert(bodies, rs.mate)
			end
			for _, b in ipairs(rs.trailing) do
				table.insert(bodies, b)
			end
		end
		for _, r in ipairs(bodies) do
			local rig = r.rig
			if rig and rig.model.Parent then
				animated[rig.model] = true
				r.poseClock += dt
				local frac = math.clamp(r.speed / current.event.MaxSpeed, 0, 1)
				if r.speed > 0.2 then
					-- 2.0 strides/s out of the blocks -> 2.6 at top speed (5.2 steps/s): a Roblox
					-- avatar is small for this speed, so its legs turn over a bit faster than Bolt's
					r.phase = (r.phase + dt * (2.0 + 0.62 * frac)) % 1
				end
				-- lean into the bend (Lyles-style bend running)
				local bendTarget = 0
				if not r.line and r.poseState == "run" and onBend(r.lane, r.sStart - START_BACK + r.dist) then
					bendTarget = 0.17 * frac * frac * (R1 / laneRadius(r.lane))
				end
				r.bend += (bendTarget - r.bend) * math.min(1, dt * 4)
				local alpha = math.min(1, dt * (if r.poseState == "run" then 18 else 9))
				applyPose(rig, runnerPose(r, current.event), alpha)
			end
		end
	end
	if X.freeRoam then
		X.freeRoam(dt, animated)
	end
end)

---------------------------------------------------------------------
-- CAMERA
---------------------------------------------------------------------
-- The camera orbits around its target (yaw / distance / height), so changing view - "set" to
-- chase at the gun, chase to the finish view - swings around you instead of through you.
-- yaw 0 = behind, pi/2 = your right side, pi = in front.
local cam = {
	active = false,
	target = nil :: Runner?,
	mode = "chase", -- "start" | "chase" | "finish" | "intro"
	yaw = 0,
	dist = 11,
	height = 6,
	lookFwd = 12,
	lookUp = 2,
	snap = true,
	fov = 70,
	introBase = Vector3.zero,
	introDir = Vector3.new(1, 0, 0),
	shake = 0,
	base = nil :: Vector3?, -- smoothed point the camera circles
	lastTargetBase = nil :: Vector3?,
	lastRoot = nil :: BasePart?,
	releasing = false,
	releaseClock = 0,
}

-- where each view wants to be: yaw, distance, height, look ahead, look up
K.CAM_VIEWS = {
	intro = { math.pi - 0.17, 12.2, 4.8, 0, 1.2 },
	start = { math.pi - 0.09, 16, 5, 0, 1.2 },
	finish = { math.pi - 0.29, 10.4, 3.4, 0, 2.2 },
	side = { math.pi / 2 + 0.09, 21, 12.5, 3, 1.5 },
	chase = { 0.045, 11, 6.2, 12, 2 },
	release = { 0, 12.5, 4.2, 4, 1.6 },
}

local function camTargetBase(): (Vector3?, Vector3, number, BasePart?)
	if cam.mode == "intro" then
		return cam.introBase, cam.introDir, 0, nil
	end
	local r = cam.target
	if not r then
		return nil, Vector3.new(0, 0, -1), 0, nil
	end
	local _, d = runnerSample(r)
	local root = r.root
	if root and root.Parent then
		local rp = root.Position
		return Vector3.new(rp.X, FLOOR_TOP, rp.Z), d, r.speed, root
	end
	return runnerSample(r), d, r.speed, nil
end

local function startCamera(target: Runner?, mode: string, smooth: boolean?)
	cam.active = true
	cam.releasing = false
	cam.target = target
	cam.mode = mode
	local camera = Workspace.CurrentCamera
	if camera then
		if smooth and camera.CameraType ~= Enum.CameraType.Scriptable then
			-- start from wherever the normal camera is, then glide into the new view
			local base, dir = camTargetBase()
			if base then
				local off = camera.CFrame.Position - base
				local right = dir:Cross(Vector3.yAxis)
				local flat = Vector3.new(off.X, 0, off.Z)
				cam.yaw = math.atan2(flat:Dot(right), -flat:Dot(dir))
				cam.dist = math.max(4, flat.Magnitude)
				cam.height = off.Y
				cam.base = base
				cam.lastTargetBase = base
				cam.lastRoot = if target then target.root else nil
				cam.snap = false
			else
				cam.snap = true
			end
		else
			cam.snap = true
		end
		camera.CameraType = Enum.CameraType.Scriptable
	end
end

local function finishRelease()
	cam.active = false
	cam.releasing = false
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

-- hand the camera back to Roblox: glide behind your character first, then let go
local function stopCamera()
	if not cam.active or cam.releasing then
		if not cam.active then
			finishRelease()
		end
		return
	end
	local _, _, root = getPlayerParts()
	if not root then
		finishRelease()
		return
	end
	cam.releasing = true
	cam.releaseClock = 0
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
	local targetBase: Vector3?, dir: Vector3, speed: number, root: BasePart?
	if cam.releasing then
		cam.releaseClock += dt
		local _, _, proot = getPlayerParts()
		if not proot or cam.releaseClock > 0.7 then
			finishRelease()
			return
		end
		local rp = proot.Position
		targetBase = Vector3.new(rp.X, FLOOR_TOP, rp.Z)
		local look = proot.CFrame.LookVector
		dir = if Vector3.new(look.X, 0, look.Z).Magnitude > 0.1 then Vector3.new(look.X, 0, look.Z).Unit else Vector3.new(0, 0, -1)
		speed = 0
		root = proot
	else
		targetBase, dir, speed, root = camTargetBase()
	end
	if not targetBase then
		return
	end
	-- follow the target exactly while it moves, but glide over any sudden jump
	-- (a new runner after a baton pass, the next lane in the final introductions)
	local prevBase = cam.base
	local last = cam.lastTargetBase
	local base: Vector3
	if cam.snap or not prevBase or not last then
		base = targetBase
	else
		base = prevBase
		local moved = targetBase - last
		local jumped = root ~= cam.lastRoot or moved.Magnitude > math.max(3, speed * dt * 2.5)
		if not jumped then
			base += moved
		end
		base += (targetBase - base) * (1 - math.exp(-dt * 5))
	end
	cam.base = base
	cam.lastTargetBase = targetBase
	cam.lastRoot = root

	local mode = cam.mode
	local key = if cam.releasing then "release" elseif mode == "chase" and Settings.Camera == "Side" then "side" else mode
	local view = K.CAM_VIEWS[key] or K.CAM_VIEWS.chase
	if cam.snap then
		cam.yaw, cam.dist, cam.height, cam.lookFwd, cam.lookUp = view[1], view[2], view[3], view[4], view[5]
	else
		local ky = 1 - math.exp(-dt * (if cam.releasing then 6 elseif mode == "intro" then 2.5 else 3.4))
		local kd = 1 - math.exp(-dt * (if cam.releasing then 7 else 4))
		local dy = (view[1] - cam.yaw + math.pi) % (2 * math.pi) - math.pi -- shortest way round
		cam.yaw += dy * ky
		cam.dist += (view[2] - cam.dist) * kd
		cam.height += (view[3] - cam.height) * kd
		cam.lookFwd += (view[4] - cam.lookFwd) * kd
		cam.lookUp += (view[5] - cam.lookUp) * kd
	end
	cam.snap = false
	local up = Vector3.yAxis
	local right = dir:Cross(up)
	local offset = (-dir * math.cos(cam.yaw) + right * math.sin(cam.yaw)) * cam.dist + up * cam.height
	local look = dir * cam.lookFwd + up * cam.lookUp
	local speedFrac = math.clamp(speed / 37, 0, 1)
	local fovTarget = if mode == "chase" and not cam.releasing then 68 + 12 * speedFrac else 62
	cam.fov += (fovTarget - cam.fov) * math.min(1, dt * 4)
	camera.FieldOfView = cam.fov
	local shake = Vector3.zero
	if cam.shake > 0 then
		cam.shake = math.max(0, cam.shake - dt * 2)
		shake = Vector3.new(rng:NextNumber(-1, 1), rng:NextNumber(-1, 1), rng:NextNumber(-1, 1)) * cam.shake * 0.25
	end
	camera.CFrame = CFrame.lookAt(base + offset + shake, base + look)
end

RunService:BindToRenderStep("TrackAndFieldCamera", Enum.RenderPriority.Camera.Value + 1, updateCamera)

-- while you race, your run direction is re-applied right after the default controls read their
-- input every frame, so they can never cancel it (the physics mover holds your speed as well)
RunService:BindToRenderStep("TrackAndFieldMove", Enum.RenderPriority.Input.Value + 1, function()
	local md = X.moveDir
	if md then
		local _, hum = getPlayerParts()
		if hum then
			hum:Move(md)
		end
	end
end)

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

K.leftKeys = { [Enum.KeyCode.Left] = true, [Enum.KeyCode.ButtonL1] = true, [Enum.KeyCode.ButtonL2] = true, [Enum.KeyCode.DPadLeft] = true }
K.rightKeys = { [Enum.KeyCode.Right] = true, [Enum.KeyCode.ButtonR1] = true, [Enum.KeyCode.ButtonR2] = true, [Enum.KeyCode.DPadRight] = true }
K.passKeys = { [Enum.KeyCode.W] = true, [Enum.KeyCode.Up] = true, [Enum.KeyCode.ButtonA] = true }

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
			if X.saveSettings then
				X.saveSettings()
			end
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
	if kc == Settings.LeftKey or K.leftKeys[kc] then
		onTap("L")
	elseif kc == Settings.RightKey or K.rightKeys[kc] then
		onTap("R")
	elseif kc == Settings.PassKey or K.passKeys[kc] then
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
			elseif opt.key == "Bots" then
				Settings.Bots = choice == "on"
			end
			refreshSettingsUI()
			if X.saveSettings then
				X.saveSettings()
			end
		end)
	end
end

UI.indoorButton.Activated:Connect(function()
	flash("INDOOR ARENA", K.ROYAL_LIGHT, "Coming soon!", 2.5)
	announce("The indoor arena is coming soon!")
end)

K.eventChoices = { "Rotation" }
for _, e in ipairs(EVENTS) do
	table.insert(K.eventChoices, e.Name)
end
local function stepEvent(delta: number)
	local idx = table.find(K.eventChoices, Settings.Event) or 1
	idx = ((idx - 1 + delta) % #K.eventChoices) + 1
	Settings.Event = K.eventChoices[idx]
	refreshSettingsUI()
	if X.saveSettings then
		X.saveSettings()
	end
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
				elseif m == "PB" then K.ROYAL_LIGHT
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

X.speedLineAlpha = 0
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
		X.speedLineAlpha = if running and not Settings.PerformanceMode then math.clamp((r.speed / event.MaxSpeed - 0.8) / 0.2, 0, 1) else 0
	else
		UI.speedValue.Text = "0.0"
		UI.speedBarFill.Size = UDim2.fromScale(0, 1)
		UI.laneChip.Text = if Settings.AFK then "AFK" else ""
		UI.legChip.Text = ""
		UI.rhythmBack.Visible = false
		UI.passButton.Visible = false
		X.speedLineAlpha = 0
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
		z.Visible = false
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
		if X.speedLineAlpha > 0.01 then
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
			line.frame.BackgroundTransparency = 1 - X.speedLineAlpha * 0.5 * math.clamp(line.dist, 0, 1)
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

-- starting blocks (relays: nothing on the track, just the PASS button)
local function placeRaceProps(current: Race, you: Runner)
	local pos, dir = trackSample(you.lane, you.sStart - START_BACK - 0.8)
	local cf = CFrame.lookAt(pos, pos + dir)
	block({ Name = "BlockRail", Size = Vector3.new(0.35, 0.18, 2.6), CFrame = cf * CFrame.new(0, 0.09 - FLOOR_TOP + TRACK_TOP, 0), Color = Color3.fromRGB(70, 70, 76), Material = Enum.Material.Metal, Parent = RaceFolder })
	for _, info in ipairs({ { -0.45, -0.55 }, { 0.45, 0.6 } }) do
		block({ Name = "Pedal", Size = Vector3.new(0.55, 0.6, 0.15), CFrame = cf * CFrame.new(info[1], 0.32 - FLOOR_TOP + TRACK_TOP, info[2]) * CFrame.Angles(math.rad(-50), 0, 0), Color = Color3.fromRGB(230, 230, 230), Material = Enum.Material.SmoothPlastic, Parent = RaceFolder })
	end
end

local function laneBoards(current: Race)
	for _, r in ipairs(current.runners) do
		if not r.isPlayer then
			local pos, dir = trackSample(r.lane, r.sStart + 2.5)
			local p = flat("LaneBoard", CFrame.lookAt(pos, pos + dir), LANE_W - 0.8, 3, K.MARK_TOP + 0.01, K.C_BG, Enum.Material.SmoothPlastic, 0.02, RaceFolder)
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
	local waitStart = os.clock()
	while X.dashRunning and os.clock() - waitStart < 80 do
		task.wait(0.2)
	end
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
		relay = { mate = nil, trailing = {} },
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
		showLoading(string.upper(event.Name .. "  " .. round), "LANE " .. yr.lane .. (if event.Relay then "  -  your team wears white & royal blue" else ""), 2.2, function()
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
	if Settings.Bots then
		for i, r in ipairs(runners) do
			if not r.isPlayer then
				X.addBot(r, i)
			end
		end
	end

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
			measurePlayer(r)
			stepRunner(r, dt, t, event, current.goal)
			if r.isPlayer and event.Relay and not r.dq then
				X.relayTick(current, r, dt, t)
			end
			if r.poseState == "handoffTake" and t - r.handoffAt > 0.35 then
				r.poseState = "run"
			end
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
			if not r.isPlayer and r.model then
				X.placeModel(r)
			end
			if r.isPlayer and not r.dq then
				if r.external then
					drivePlayerCharacter(r)
				else
					X.placeModel(r)
				end
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
					if not r.finished then
						X.handoff(current, r, t)
					end
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
			if r.isPlayer and prevDist <= START_BACK and r.dist > START_BACK and r.started then
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
			note = X.checkRecords(event.Name, r, r.finishTime)
		end
		r.note = note
		table.insert(results, { athlete = r.athlete, lane = r.lane, time = if status == "OK" then r.finishTime else nil, rt = r.reaction, status = status, heat = round, mark = "", note = note })
	end
	for _, res in ipairs(results) do
		X.recordFlash(res.note, res.athlete.Name, res.time)
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
-- BOTS (optional), RELAY TEAMMATES, FREE-ROAM ANIMATION, SAVING,
-- 40-YARD DASH
---------------------------------------------------------------------
-- move a body (bot / teammate / old relay runner) to its spot on the lane
X.placeModel = function(b: any)
	local root = b.root
	if not root or not root.Parent then
		return
	end
	local pos, dir = runnerSample(b)
	local p = pos + Vector3.new(0, b.rootHeight, 0)
	root.CFrame = CFrame.lookAt(p, p + dir)
end

X.stripModel = function(model: Model, keepKit: boolean)
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("BaseScript") or d:IsA("ModuleScript") or d:IsA("Sound") or d:IsA("ForceField") or d:IsA("Tool")
			or d:IsA("Animator") or d:IsA("BillboardGui") or d:IsA("ParticleEmitter") or d:IsA("Trail") or d.Name == "TF_Baton"
		then
			d:Destroy()
		elseif not keepKit and (d:IsA("Accessory") or d:IsA("Clothing") or d:IsA("ShirtGraphic") or d:IsA("BodyColors") or d:IsA("SurfaceAppearance") or d:IsA("SurfaceGui")) then
			d:Destroy()
		end
	end
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("BasePart") then
			d.Anchored = false
			d.CanCollide = false
			d.CanTouch = false
			d.CanQuery = false
			d.Massless = true
			d.CastShadow = not Settings.PerformanceMode
		end
	end
	local hum = model:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
		hum.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
		hum.BreakJointsOnDeath = false
		hum.RequiresNeck = false
	end
	local root = model:FindFirstChild("HumanoidRootPart")
	if root and root:IsA("BasePart") then
		root.Anchored = true
		root.Transparency = 1
		model.PrimaryPart = root
	end
end

-- copy of your avatar (keeps the uniform when keepKit is true)
X.cloneSelf = function(keepKit: boolean): Model?
	local char = player.Character
	if not char or not char:FindFirstChild("HumanoidRootPart") or not char:FindFirstChildOfClass("Humanoid") then
		return nil
	end
	local was = char.Archivable
	char.Archivable = true
	local ok, copy = pcall(function()
		return char:Clone()
	end)
	char.Archivable = was
	if not ok or not copy then
		return nil
	end
	X.stripModel(copy, keepKit)
	if not copy:FindFirstChild("HumanoidRootPart") then
		copy:Destroy()
		return nil
	end
	return copy
end

-- simple blocky R6 runner, used when your avatar can't be copied
X.blockRig = function(): Model
	local model = create("Model", { Name = "Runner" })
	local function limb(name: string, size: Vector3): any
		return create("Part", { Name = name, Size = size, TopSurface = Enum.SurfaceType.Smooth, BottomSurface = Enum.SurfaceType.Smooth, Material = Enum.Material.SmoothPlastic, CanCollide = false, Massless = true, Parent = model })
	end
	local root = limb("HumanoidRootPart", Vector3.new(2, 2, 1))
	root.Transparency = 1
	root.Anchored = true
	local torso = limb("Torso", Vector3.new(2, 2, 1))
	local head = limb("Head", Vector3.new(2, 1, 1))
	create("SpecialMesh", { MeshType = Enum.MeshType.Head, Scale = Vector3.new(1.25, 1.25, 1.25), Parent = head })
	local parts = { ["Left Arm"] = limb("Left Arm", Vector3.new(1, 2, 1)), ["Right Arm"] = limb("Right Arm", Vector3.new(1, 2, 1)), ["Left Leg"] = limb("Left Leg", Vector3.new(1, 2, 1)), ["Right Leg"] = limb("Right Leg", Vector3.new(1, 2, 1)) }
	local function motor(name: string, p0: BasePart, p1: BasePart, c0: CFrame, c1: CFrame)
		create("Motor6D", { Name = name, Part0 = p0, Part1 = p1, C0 = c0, C1 = c1, Parent = p0 })
	end
	motor("RootJoint", root, torso, CFrame.new(0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0), CFrame.new(0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0))
	motor("Neck", torso, head, CFrame.new(0, 1, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0), CFrame.new(0, -0.5, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0))
	motor("Right Shoulder", torso, parts["Right Arm"], CFrame.new(1, 0.5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0), CFrame.new(-0.5, 0.5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0))
	motor("Left Shoulder", torso, parts["Left Arm"], CFrame.new(-1, 0.5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0), CFrame.new(0.5, 0.5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0))
	motor("Right Hip", torso, parts["Right Leg"], CFrame.new(1, -1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0), CFrame.new(0.5, 1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0))
	motor("Left Hip", torso, parts["Left Leg"], CFrame.new(-1, -1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0), CFrame.new(-0.5, 1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0))
	create("Humanoid", { RigType = Enum.HumanoidRigType.R6, HipHeight = 0, DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None, Parent = model })
	model.PrimaryPart = root
	return model
end

-- bots on the track (Settings > Bots): your avatar's body in their own kit
X.addBot = function(r: Runner, index: number)
	local model = X.cloneSelf(false) or X.blockRig()
	model.Name = r.athlete.Name
	local hum = model:FindFirstChildOfClass("Humanoid")
	local isR15 = hum ~= nil and hum.RigType == Enum.HumanoidRigType.R15
	local kit = K.KITS[((index - 1) % #K.KITS) + 1]
	local shorts = kit:Lerp(Color3.new(0, 0, 0), 0.5)
	local skin = K.SKINS[((index * 3) % #K.SKINS) + 1]
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("BasePart") and d.Name ~= "HumanoidRootPart" then
			local n = d.Name
			if n == "UpperTorso" or n == "Torso" then
				d.Color = kit
			elseif n == "LowerTorso" or n == "LeftUpperLeg" or n == "RightUpperLeg" or (not isR15 and (n == "Left Leg" or n == "Right Leg")) then
				d.Color = shorts
			elseif n == "LeftFoot" or n == "RightFoot" then
				d.Color = K.WHITE
			else
				d.Color = skin
			end
			if d:IsA("MeshPart") then
				pcall(function()
					(d :: MeshPart).TextureID = ""
				end)
			end
		end
	end
	model.Parent = RaceFolder
	r.model = model
	r.root = model:FindFirstChild("HumanoidRootPart") :: BasePart?
	r.rig = newRig(model)
	r.rootHeight = rootHeightOf(model)
	X.placeModel(r)
end

-- relays: your teammates are copies of you in the team uniform. One waits in
-- the exchange zone, looks back, starts running, and you hand over the baton.
X.relayTick = function(current: Race, r: Runner, dt: number, t: number)
	local event = current.event
	local rs = current.relay
	local vo = r.visOffset
	if vo then
		vo *= math.exp(-dt * 2.5)
		r.visOffset = if vo > 0.02 then vo else nil
	end
	-- runners who already handed over: slow down and stop in their lane
	for _, b in ipairs(rs.trailing) do
		b.speed = math.max(0, b.speed - 14 * dt)
		if b.poseState == "handoffGive" and t - b.since > 0.4 then
			b.poseState = "run"
		end
		if b.poseState == "run" and b.speed < 3 then
			b.poseState = "celebrate"
			b.celebrate = "watch"
			b.poseClock = 0
		end
		if b.isCharacter then
			local char, hum = getPlayerParts()
			local _, _, broot = getPlayerParts()
			if hum and broot and char == b.model then
				local _, dir = runnerSample(b)
				X.drive(broot, hum, dir * (if b.speed > 0.3 then b.speed else 0), dir)
			end
		else
			b.dist += b.speed * dt
			X.placeModel(b)
		end
	end
	if r.finished or r.leg >= event.Legs then
		return
	end
	local line = legLine(event, r.leg)
	local zoneStart = line - CONFIG.ZoneBefore * SPM
	local mate = rs.mate
	if not mate and r.dist >= zoneStart - 45 * SPM then
		local m = X.cloneSelf(true) or X.blockRig()
		if m then
			m.Name = "Teammate" .. (r.leg + 1)
			mate = {
				model = m,
				root = m:FindFirstChild("HumanoidRootPart"),
				rig = newRig(m),
				rootHeight = rootHeightOf(m),
				lane = r.lane,
				sStart = r.sStart,
				dist = zoneStart,
				speed = 0,
				running = false,
				phase = 0.25,
				poseState = "relayWait",
				poseClock = 0,
				bend = 0,
				finished = false,
				celebrate = "watch",
				forLeg = r.leg,
			}
			m.Parent = RaceFolder
			rs.mate = mate
		end
	end
	if mate and mate.forLeg == r.leg then
		-- the teammate takes off when you're 10 m from the zone and is timed to be an arm's
		-- length ahead, at about your speed, right in the middle of the perfect-pass window
		local goAt = zoneStart - 10 * SPM
		local meetAt = line - (CONFIG.PerfectPassBefore - CONFIG.PerfectPassAfter) * 0.5 * SPM
		if not mate.running and r.dist >= goAt then
			mate.running = true
			mate.poseState = "run"
		end
		if mate.running then
			local before = mate.dist
			local dRunner = meetAt - goAt
			local dMate = meetAt + 1.8 - zoneStart
			local u = math.max(0, (r.dist - goAt) / dRunner)
			local target
			if u <= 1 then
				local k = math.clamp(0.97 * dRunner / dMate, 0.5, 2.9)
				local b = k - 2
				local a = 1 - b
				target = zoneStart + dMate * (a * u * u + b * u * u * u)
			else
				target = before + r.speed * 0.97 * dt
			end
			mate.dist = math.max(before, target, r.dist + 1.8)
			mate.speed = if dt > 0 then (mate.dist - before) / dt else mate.speed
		end
		X.placeModel(mate)
	end
end

-- the pass: baton goes from your hand to your teammate's, the camera stays with the baton
X.handoff = function(current: Race, r: Runner, t: number)
	local rs = current.relay
	local mate = rs.mate
	if not mate or not mate.root then
		return
	end
	table.insert(rs.trailing, {
		model = r.model,
		root = r.root,
		rig = r.rig,
		rootHeight = r.rootHeight,
		lane = r.lane,
		sStart = r.sStart,
		dist = r.dist,
		speed = r.speed,
		phase = r.phase,
		poseState = "handoffGive",
		poseClock = 0,
		since = t,
		bend = r.bend,
		finished = false,
		celebrate = "watch",
		isCharacter = r.external,
	})
	r.model = mate.model
	r.root = mate.root
	r.rig = mate.rig
	r.rootHeight = mate.rootHeight
	r.visOffset = math.max(0, mate.dist - r.dist) -- no free distance: the new runner eases back onto your line
	r.phase = mate.phase
	r.external = false
	r.poseState = "handoffTake"
	r.handoffAt = t
	giveBaton(true, mate.model)
	rs.mate = nil
end

X.poseRelayWait = function(t: number, isR15: boolean): Pose
	local bob = math.sin(t * 4) * 0.03
	return {
		root = J(-0.35, 0, 0, (isR15 and -0.2 or 0) + bob),
		waist = J(0, 0.35),
		neck = J(0.2, 1.1, 0), -- looking back for the incoming runner
		hipL = J(0.5),
		kneeL = J(-0.5),
		hipR = J(-0.15),
		kneeR = J(-0.25),
		shoulderR = J(-0.6, 0, 0.2),
		elbowR = J(0.3),
		shoulderL = J(0.6, 0, -0.1),
		elbowL = J(1.2),
	}
end

-- custom idle / walk / jump animations when you're not racing
X.poseIdle = function(t: number, isR15: boolean): Pose
	local cycle = t % 14
	local breathe = math.sin(t * 2.1) * 0.025
	local sway = math.sin(t * 0.7) * 0.04
	if cycle > 8.5 and cycle < 11 then
		-- shake the legs and arms out, like a sprinter before a race
		local s = math.sin(t * 22)
		return {
			root = J(0, 0, sway, math.abs(math.sin(t * 9)) * 0.08),
			neck = J(-0.1),
			shoulderR = J(0.1 + s * 0.12, 0, 0.25 + s * 0.1),
			shoulderL = J(0.1 - s * 0.12, 0, -0.25 - s * 0.1),
			elbowR = J(0.3 + s * 0.2),
			elbowL = J(0.3 - s * 0.2),
			kneeR = J(-0.15 - math.max(0, s) * 0.25),
			kneeL = J(-0.15 - math.max(0, -s) * 0.25),
		}
	elseif cycle >= 11 then
		-- hands on hips, looking around
		return {
			root = J(0, 0, 0, breathe),
			neck = J(0.05, math.sin((cycle - 11) * 2.1) * 0.7, 0),
			shoulderR = J(-0.2, 0, 0.5),
			shoulderL = J(-0.2, 0, -0.5),
			elbowR = J(1.7),
			elbowL = J(1.7),
			hipR = J(0, 0, 0.06),
			hipL = J(0, 0, -0.06),
		}
	end
	return {
		root = J(0, 0, sway, breathe),
		waist = J(0, sway * 1.5),
		neck = J(0.02, math.sin(t * 0.5) * 0.15),
		shoulderR = J(0.05, 0, 0.1),
		shoulderL = J(0.05, 0, -0.1),
		elbowR = J(0.2),
		elbowL = J(0.2),
		hipR = J(0, 0, 0.04),
		hipL = J(0, 0, -0.04),
	}
end

X.poseWalk = function(u: number, amp: number, isR15: boolean): Pose
	local s, c = math.sin(u * math.pi * 2), math.cos(u * math.pi * 2)
	if isR15 then
		return {
			root = J(-0.04, 0.06 * s * amp, 0, -0.05 * math.abs(c) * amp),
			waist = J(0, -0.08 * s * amp),
			neck = J(0.04, 0.04 * s),
			hipR = J(0.45 * amp * s),
			hipL = J(-0.45 * amp * s),
			kneeR = J(-(0.12 + 0.75 * amp * math.max(0, c))),
			kneeL = J(-(0.12 + 0.75 * amp * math.max(0, -c))),
			ankleR = J(0.15 * amp * c),
			ankleL = J(-0.15 * amp * c),
			shoulderR = J(-0.45 * amp * s, 0, 0.08),
			shoulderL = J(0.45 * amp * s, 0, -0.08),
			elbowR = J(0.25 + 0.2 * amp * math.max(0, -s)),
			elbowL = J(0.25 + 0.2 * amp * math.max(0, s)),
		}
	end
	return {
		root = J(-0.03, 0.05 * s * amp, 0, 0.05 * math.abs(c) * amp),
		hipR = J(0.6 * amp * s),
		hipL = J(-0.6 * amp * s),
		shoulderR = J(-0.65 * amp * s, 0, 0.06),
		shoulderL = J(0.65 * amp * s, 0, -0.06),
	}
end

X.poseAir = function(vy: number): Pose
	if vy > 0 then
		return { root = J(0.05), neck = J(0.2), shoulderR = J(0.7, 0, 0.35), shoulderL = J(0.7, 0, -0.35), elbowR = J(0.6), elbowL = J(0.6), hipR = J(0.6), kneeR = J(-1.0), hipL = J(0.2), kneeL = J(-0.45) }
	end
	return { root = J(0), neck = J(0.1), shoulderR = J(0.4, 0, 0.9), shoulderL = J(0.4, 0, -0.9), hipR = J(0.25), kneeR = J(-0.35), hipL = J(-0.1), kneeL = J(-0.2) }
end

X.free = { model = nil, rig = nil, lastPos = nil, speed = 0, vy = 0, phase = 0, clock = 0 }
X.freeRoam = function(dt: number, animated: { [Model]: boolean })
	local char = player.Character
	local f = X.free
	if not char or animated[char] then
		f.lastPos = nil
		return
	end
	local root = char:FindFirstChild("HumanoidRootPart")
	if not root or not root:IsA("BasePart") then
		return
	end
	if f.model ~= char or not f.rig then
		f.model = char
		f.rig = newRig(char)
	end
	local rig = f.rig
	if not rig then
		return
	end
	local pos = root.Position
	local v = Vector3.zero
	if f.lastPos and dt > 0 then
		v = (pos - f.lastPos) / dt
	end
	f.lastPos = pos
	local horizontal = Vector3.new(v.X, 0, v.Z).Magnitude
	if horizontal > 200 then
		horizontal = 0 -- a respawn / spawn, not movement
	end
	f.speed += (horizontal - f.speed) * math.min(1, dt * 8)
	f.vy += (math.clamp(v.Y, -200, 200) - f.vy) * math.min(1, dt * 10)
	f.clock += dt
	local pose: Pose
	if math.abs(f.vy) > 6 then
		pose = X.poseAir(f.vy)
	elseif f.speed > 0.6 then
		local running = f.speed > 19
		f.phase = (f.phase + dt * (if running then 1.6 + f.speed / 40 else 0.85 + f.speed / 14)) % 1
		pose = if running then poseRun(f.phase, 0.7, 0, 0, rig.isR15) else X.poseWalk(f.phase, math.clamp(f.speed / 16, 0.35, 1), rig.isR15)
	else
		pose = X.poseIdle(f.clock, rig.isR15)
	end
	applyPose(rig, pose, math.min(1, dt * 10))
end

-- records: world record (0.01 - 0.05 s rule), personal best, saving
X.checkRecords = function(eventName: string, r: Runner, time: number): string
	local note = ""
	if r.isPlayer then
		local off = officialTime(time)
		local wr = worldRecords[eventName]
		local oldBest = bestOf(eventName, r.athlete.Name)
		if wr and off < wr.time then
			local margin = math.floor((wr.time - off) * 100 + 0.5) / 100
			if margin >= CONFIG.WRMinMargin and margin <= CONFIG.WRMaxMargin then
				note = "WR"
				worldRecords[eventName] = { time = off, holder = player.Name, isPlayer = true }
			elseif margin > CONFIG.WRMaxMargin then
				note = "NR" -- beaten by more than 0.05: not ratified
			end
		end
		if note ~= "WR" and (not oldBest or time < oldBest - 1e-6) then
			note = if note == "NR" then "NR" else "PB"
		end
		X.submit(eventName, time)
	end
	recordBest(eventName, r.athlete, time)
	return note
end

X.recordFlash = function(note: string, name: string, time: number?)
	if note == "WR" then
		setVignette(0.5, K.GOLD)
		flash("NEW WORLD RECORD!", K.GOLD, name .. "  " .. fmtOfficial(time), 4)
		announce("A NEW WORLD RECORD! " .. name .. " runs " .. fmtOfficial(time) .. "!", "A new world record for " .. name .. "!")
	elseif note == "NR" then
		flash("WR NOT RATIFIED", K.C_BAD, "Beaten by more than 0.05 s - it doesn't count", 4)
		announce("That was under the world record by more than five hundredths, so it doesn't count!", "That world record does not count!")
	elseif note == "PB" then
		flash("NEW PERSONAL BEST!", K.ROYAL_LIGHT, fmtOfficial(time), 3)
	end
end

X.net = nil
X.submit = function(eventName: string, time: number)
	local net = X.net
	if net and net.Submit then
		net.Submit:FireServer(eventName, time)
	end
end

X.saveSettings = function()
	local net = X.net
	if not net or not net.SaveSettings then
		return
	end
	local s: any = Settings
	local out = {}
	for _, k in ipairs({ "Event", "TrackColor", "Camera", "Celebration" }) do
		out[k] = s[k]
	end
	for _, k in ipairs({ "Uniform", "Voice", "PerformanceMode", "Bots" }) do
		out[k] = s[k]
	end
	for _, k in ipairs({ "LeftKey", "RightKey", "PassKey" }) do
		out[k] = s[k].Name
	end
	net.SaveSettings:FireServer(out)
end

X.applyRecord = function(name: any, rec: any)
	if type(name) == "string" and worldRecords[name] and type(rec) == "table" and type(rec.time) == "number" and rec.time > 0 then
		worldRecords[name] = { time = rec.time, holder = tostring(rec.holder), isPlayer = rec.holder == player.Name }
	end
end

X.loadSettings = function(saved: { [string]: any })
	local s: any = Settings
	for _, k in ipairs({ "Event", "TrackColor", "Camera", "Celebration" }) do
		if type(saved[k]) == "string" then
			s[k] = saved[k]
		end
	end
	for _, k in ipairs({ "Uniform", "Voice", "PerformanceMode", "Bots" }) do
		if type(saved[k]) == "boolean" then
			s[k] = saved[k]
		end
	end
	for _, k in ipairs({ "LeftKey", "RightKey", "PassKey" }) do
		if type(saved[k]) == "string" then
			local ok, kc = pcall(function()
				return (Enum.KeyCode :: any)[saved[k]]
			end)
			if ok and kc then
				s[k] = kc
			end
		end
	end
	if not table.find(K.eventChoices, s.Event) then
		s.Event = "Rotation"
	end
	if not K.TRACK_COLORS[s.TrackColor] then
		s.TrackColor = "Red"
	end
	if s.Camera ~= "Chase" and s.Camera ~= "Side" then
		s.Camera = "Chase"
	end
	if s.Celebration ~= "Bolt" and s.Celebration ~= "Lyles" then
		s.Celebration = "Bolt"
	end
	applyTrackColor()
	applyPerformance()
	refreshUniform()
	refreshSettingsUI()
	refreshControlsUI()
end

X.netInit = function()
	local folder = game:GetService("ReplicatedStorage"):WaitForChild("TrackAndFieldNet", 6)
	if not folder then
		return -- running without the server half: nothing is saved this session
	end
	local getData = folder:WaitForChild("GetData", 5)
	if not getData or not getData:IsA("RemoteFunction") then
		return
	end
	local ok, data = pcall(function()
		return getData:InvokeServer()
	end)
	if not ok or type(data) ~= "table" then
		return
	end
	X.net = {
		Submit = folder:FindFirstChild("Submit"),
		SaveSettings = folder:FindFirstChild("SaveSettings"),
		Dash = folder:FindFirstChild("Dash"),
		Records = folder:FindFirstChild("Records"),
	}
	local kitRemote = folder:FindFirstChild("Kit")
	if kitRemote and kitRemote:IsA("RemoteEvent") then
		-- the server dresses everyone: take off a kit this client may have put on by itself
		local char = player.Character
		if char then
			removeUniform(char)
		end
		X.kitRemote = kitRemote
	end
	X.saving = data.saving == true
	if type(data.pbs) == "table" then
		for name, t in pairs(data.pbs) do
			if type(name) == "string" and seasonBests[name] and type(t) == "number" then
				recordBest(name, if string.sub(name, 1, 2) == "4x" then youTeam else youAthlete, t)
			end
		end
	end
	if type(data.records) == "table" then
		for name, rec in pairs(data.records) do
			X.applyRecord(name, rec)
		end
	end
	if type(data.settings) == "table" then
		X.loadSettings(data.settings)
	end
	local records = X.net.Records
	if records and records:IsA("RemoteEvent") then
		records.OnClientEvent:Connect(function(name: any, rec: any)
			X.applyRecord(name, rec)
			refreshLeaderboard()
			X.dashRefreshBoard()
			if type(rec) == "table" and rec.holder ~= player.Name and type(rec.time) == "number" then
				announce("New world record in the " .. tostring(name) .. " by " .. tostring(rec.holder) .. ": " .. fmtTime(rec.time) .. "!")
			end
		end)
	end
	local dash = X.net.Dash
	if dash and dash:IsA("RemoteEvent") then
		dash.OnClientEvent:Connect(function(kind: any, curName: any, curId: any, line: any)
			if kind == "state" then
				X.onDashState(tostring(curName or ""), tonumber(curId) or 0, if type(line) == "table" then line else {})
			end
		end)
		dash:FireServer("sync")
	end
	if not X.saving then
		announce("Saving is off: publish the game and turn on Studio Access to API Services.")
	end
	refreshLeaderboard()
end

-- 40-YARD DASH on the grass (optional, with a line and its own world record)
X.dashOrigin = Vector3.new(-70, 0, -46)
X.dashDir = Vector3.new(1, 0, 0)
X.dashRunning = false
X.dashQueued = false
X.dashWaiting = false
X.dashState = { current = "", currentId = 0, line = {} }
X.dashBoard = nil
X.lastLinePos = 0

X.dashBuild = function()
	local f = create("Folder", { Name = "FortyYardDash", Parent = World })
	local o, d = X.dashOrigin, X.dashDir
	local yard = 0.9144 * SPM
	local width = 16
	for y = 0, 40, 5 do
		local p = o + d * (y * yard)
		block({ Name = "YardLine", Size = Vector3.new(if y == 0 or y == 40 then 0.5 else 0.25, 0.04, width), CFrame = CFrame.new(p.X, 0.03, p.Z), Color = K.WHITE, Material = Enum.Material.SmoothPlastic, Parent = f })
	end
	for _, side in ipairs({ -1, 1 }) do
		local c = o + d * (20 * yard) + Vector3.new(0, 0, side * width / 2)
		block({ Name = "SideLine", Size = Vector3.new(40 * yard + 6, 0.04, 0.3), CFrame = CFrame.new(c.X, 0.03, c.Z), Color = K.WHITE, Material = Enum.Material.SmoothPlastic, Parent = f })
	end
	for _, y in ipairs({ 10, 20, 30, 40 }) do
		local p = o + d * (y * yard) + Vector3.new(0, 0, -width / 2 + 2.6)
		local numberPart = block({ Name = "YardNumber", Size = Vector3.new(3.2, 0.05, 2.6), CFrame = CFrame.new(p.X, 0.04, p.Z) * CFrame.Angles(0, math.pi / 2, 0), Transparency = 1, Parent = f })
		label3D(numberPart, Enum.NormalId.Top, 40, { { "N", UDim2.fromScale(0, 0), UDim2.fromScale(1, 1), tostring(y), K.WHITE } })
	end
	for _, y in ipairs({ 0, 40 }) do
		for _, side in ipairs({ -1, 1 }) do
			local p = o + d * (y * yard) + Vector3.new(0, 0, side * (width / 2 + 1.2))
			block({ Name = "Cone", Size = Vector3.new(1.1, 1.5, 1.1), CFrame = CFrame.new(p.X, 0.75, p.Z), Color = Color3.fromRGB(255, 120, 20), Material = Enum.Material.SmoothPlastic, Parent = f })
		end
	end
	local pad = block({ Name = "DashStartPad", Size = Vector3.new(3, 0.1, 5), CFrame = CFrame.new(o.X - 3.5, 0.05, o.Z), Color = K.ROYAL, Material = Enum.Material.SmoothPlastic, CanQuery = true, Parent = f })
	local prompt = create("ProximityPrompt", {
		ActionText = "Join the line",
		ObjectText = "40-Yard Dash",
		HoldDuration = 0,
		MaxActivationDistance = 14,
		RequiresLineOfSight = false,
		Parent = pad,
	})
	prompt.Triggered:Connect(function()
		X.dashJoin()
	end)
	for _, dx in ipairs({ -5, 5 }) do
		block({ Name = "DashBoardLeg", Size = Vector3.new(0.4, 5, 0.4), CFrame = CFrame.new(o.X - 2 + dx, 2.5, o.Z - width / 2 - 5), Color = Color3.fromRGB(60, 62, 70), Material = Enum.Material.Metal, Parent = f })
	end
	local board = block({ Name = "DashBoard", Size = Vector3.new(12, 6, 0.5), CFrame = CFrame.new(o.X - 2, 7, o.Z - width / 2 - 5), Color = Color3.fromRGB(14, 16, 24), Material = Enum.Material.SmoothPlastic, Parent = f })
	X.dashBoard = label3D(board, Enum.NormalId.Back, 20, {
		{ "Title", UDim2.fromScale(0.04, 0.04), UDim2.fromScale(0.92, 0.2), "40-YARD DASH", K.WHITE },
		{ "WR", UDim2.fromScale(0.04, 0.28), UDim2.fromScale(0.92, 0.18), "", K.GOLD },
		{ "Now", UDim2.fromScale(0.04, 0.52), UDim2.fromScale(0.92, 0.16), "", K.C_TEXT },
		{ "Line", UDim2.fromScale(0.04, 0.74), UDim2.fromScale(0.92, 0.18), "", K.C_MUTED },
	})
	X.dashRefreshBoard()
end

X.dashRefreshBoard = function()
	local b = X.dashBoard
	if not b then
		return
	end
	local wr = worldRecords["40yd"]
	b.WR.Text = if wr then ("WR  " .. fmtTime(wr.time) .. "  " .. wr.holder) else ""
	local st = X.dashState
	b.Now.Text = if st.current ~= "" then ("NOW RUNNING: " .. st.current) else "Walk to the blue pad to run"
	b.Line.Text = if #st.line > 0 then ("IN LINE: " .. table.concat(st.line, ", ")) else "Nobody waiting"
end

X.racing = function(): boolean
	local current = race
	return current ~= nil and current.you ~= nil and current.phase ~= "done" and current.event ~= X.DASH
end

X.dashJoin = function()
	if X.dashRunning or X.dashQueued then
		return
	end
	local net = X.net
	if net and net.Dash then
		X.dashQueued = true
		X.lastLinePos = 0
		net.Dash:FireServer("join")
		if X.racing() then
			announce("You joined the line for the 40-yard dash. You'll go after this race.")
		else
			announce("You joined the line for the 40-yard dash.")
		end
	elseif X.racing() then
		-- no server: run it as soon as this race is over
		X.dashQueued = true
		task.spawn(function()
			while X.racing() do
				task.wait(0.25)
			end
			X.dashQueued = false
			X.dashRun()
		end)
		flash("40-YARD DASH", K.C_ACCENT, "You're up after this race", 2)
	else
		task.spawn(X.dashRun)
	end
end

-- it's your turn: run now, or hold your spot (letting the next person go first) until your race is over
X.dashTurn = function()
	if X.dashWaiting then
		return
	end
	X.dashWaiting = true
	task.spawn(function()
		while X.dashState.currentId == player.UserId and not X.dashRunning do
			if not X.racing() then
				X.dashQueued = false
				X.dashWaiting = false
				X.dashRun()
				return
			end
			local net = X.net
			if net and net.Dash then
				net.Dash:FireServer("defer")
			end
			task.wait(3)
		end
		X.dashWaiting = false
	end)
end

X.onDashState = function(curName: string, curId: number, line: { string })
	X.dashState = { current = curName, currentId = curId, line = line }
	X.dashRefreshBoard()
	if curId == player.UserId and X.dashQueued and not X.dashRunning then
		X.dashTurn()
	elseif X.dashQueued then
		local spot = table.find(line, player.Name)
		if spot and spot ~= X.lastLinePos then
			X.lastLinePos = spot
			announce("You're number " .. spot .. " in line for the 40-yard dash.")
		end
	end
end

X.dashRun = function()
	X.dashRunning = true
	local net = X.net
	if net and net.Dash then
		net.Dash:FireServer("start")
	end
	local ok: boolean, err: any = pcall(function(): any
		local char, hum, root = getPlayerParts()
		if not char or not hum or not root then
			return nil
		end
		local o, d = X.dashOrigin, X.dashDir
		local event: Event = X.DASH
		-- walk (never teleport) to the start line
		local target = o - d * START_BACK
		lockPlayer(false) -- you may still be frozen from the last race
		local walkSpeed = hum.WalkSpeed
		hum.WalkSpeed = math.max(walkSpeed, 24) -- jog over
		flash("40-YARD DASH", K.C_ACCENT, "Head to the start line", 2)
		local t0 = os.clock()
		local lastMove = -10
		local arrived = false
		while os.clock() - t0 < 45 do
			local rp = root.Position
			if Vector3.new(rp.X - target.X, 0, rp.Z - target.Z).Magnitude < 2 then
				arrived = true
				break
			end
			if os.clock() - lastMove > 5 then -- MoveTo gives up after 8 s, so keep asking
				lastMove = os.clock()
				hum:MoveTo(Vector3.new(target.X, rp.Y, target.Z))
			end
			task.wait(0.1)
		end
		hum:Move(Vector3.zero)
		hum.WalkSpeed = walkSpeed
		if not arrived or not root.Parent then
			flash("40-YARD DASH", K.C_WARN, "Didn't reach the start line - join again", 2.5)
			return nil
		end
		lockPlayer(true)
		local rp = root.Position
		char:PivotTo(CFrame.lookAt(rp, rp + d)) -- turn to face the finish (same spot)
		local r = newRunner(youAthlete, 1, event)
		r.line = { origin = o, dir = d }
		r.model = char
		r.root = root
		r.rig = newRig(char)
		r.rootHeight = rootHeightOf(char)
		r.external = true
		r.dist = math.clamp(START_BACK + (rp - o):Dot(d), 0, START_BACK * 2)
		local current: Race = {
			event = event,
			round = "Dash",
			runners = { r },
			phase = "set",
			clock = 0,
			goal = event.Meters * SPM + START_BACK,
			falseStartBy = nil,
			you = r,
			splitMarks = {},
			said = {},
			relay = { mate = nil, trailing = {} },
		}
		race = current
		UI.evName.Text = "40 YARDS"
		UI.evRound.Text = "DASH ON THE GRASS"
		refreshLeaderboard()
		startCamera(r, "start", true)
		UI.touchLeft.Visible = true
		UI.touchRight.Visible = true
		-- 3-point stance, then GO (tapping during "set" = false start, just go again)
		while true do
			current.phase = "set"
			current.falseStartBy = nil
			setPoses(current, "set")
			flash("SET", K.GOLD, "40-yard dash", nil)
			local hold = rng:NextNumber(1.2, 2)
			local t1 = os.clock()
			while os.clock() - t1 < hold and not current.falseStartBy do
				task.wait()
			end
			if not current.falseStartBy then
				break
			end
			current.phase = "falsestart"
			setPoses(current, "stand")
			flash("FALSE START", K.C_BAD, "Try again", 1.5)
			waitFor(1.6)
		end
		current.phase = "running"
		current.clock = 0
		flash("GO!", K.C_GOOD, nil, 0.6)
		cam.mode = "chase"
		r.poseState = "set"
		while true do
			local dt = math.min(RunService.Heartbeat:Wait(), 0.1)
			current.clock += dt
			local t = current.clock
			local wasFinished = r.finished
			measurePlayer(r)
			stepRunner(r, dt, t, event, current.goal)
			if r.started and r.poseState == "set" then
				r.poseState = "run"
				r.phase = 0.25
			end
			if not r.finished and current.goal - r.dist < 2.2 * SPM and r.speed > 0 then
				r.poseState = "dip"
			elseif r.finished and r.poseState == "dip" and t - r.finishClock > 0.35 then
				r.poseState = "run"
			end
			if r.finished and r.poseState ~= "celebrate" and r.speed < 6 and t - r.finishClock > 1 then
				r.poseState = "celebrate"
				r.celebrate = "podium"
				r.poseClock = 0
			end
			drivePlayerCharacter(r)
			if r.finished and not wasFinished then
				cam.mode = "finish"
				screenFlash(0.4)
				flash(fmtOfficial(r.finishTime), K.GOLD, "40-yard dash", nil)
			end
			UI.clockLabel.Text = if r.finished then fmtOfficial(r.finishTime) else fmtClock(t)
			updateHud(r, event)
			updateProgress(current)
			if r.finished and t - r.finishClock > 2.5 then
				break
			end
			if t > 25 then
				break
			end
		end
		current.phase = "done"
		if r.finished and r.finishTime then
			local note = X.checkRecords(event.Name, r, r.finishTime)
			announce("40-yard dash: " .. player.Name .. " runs " .. fmtOfficial(r.finishTime) .. "!")
			X.recordFlash(note, player.Name, r.finishTime)
			X.dashRefreshBoard()
			waitFor(2.5)
		end
		return nil
	end)
	if not ok then
		warn("[Track And Field] 40-yard dash: " .. tostring(err))
	end
	local current = race
	if current and current.event == X.DASH then
		race = nil
	end
	stopCamera()
	lockPlayer(false)
	updateHud(nil, nil)
	UI.progress.Visible = false
	UI.posBadge.Text = ""
	UI.touchLeft.Visible = false
	UI.touchRight.Visible = false
	UI.clockLabel.Text = "0.00"
	clearFlash()
	setVignette(0)
	refreshLeaderboard()
	if net and net.Dash then
		net.Dash:FireServer("done")
	end
	X.dashRunning = false
end

---------------------------------------------------------------------
-- START
---------------------------------------------------------------------
X.camera0 = Workspace.CurrentCamera
if X.camera0 then
	X.camera0:GetPropertyChangedSignal("ViewportSize"):Connect(updateScale)
end
updateScale()
updateHud(nil, nil)
refreshLeaderboard()
refreshControlsUI()

-- an older copy was just switched off: put back what it may have changed
X.afterOldCopy = function(stopped: number)
	pcall(setupLighting) -- old versions delete this game's lighting when they start
	pcall(applyPerformance)
	local current = race
	if not (current and current.you and current.phase ~= "done") then
		local controls = getControls()
		if controls then
			pcall(function()
				controls:Enable()
			end)
		end
		local char, hum = getPlayerParts()
		if char then
			setAnimateEnabled(char, true)
		end
		if hum then
			if hum.WalkSpeed < 1 then
				hum.WalkSpeed = 16
			end
			if hum.JumpPower < 1 and hum.JumpHeight < 0.5 then
				hum.JumpPower = 50
				hum.JumpHeight = 7.2
			end
			hum.AutoRotate = true
		end
		local camera = Workspace.CurrentCamera
		if not cam.active and camera and camera.CameraType == Enum.CameraType.Scriptable then
			camera.CameraType = Enum.CameraType.Custom
			if hum then
				camera.CameraSubject = hum
			end
		end
	end
	if not X.oldWarned then
		X.oldWarned = true
		-- tell you after the welcome message (or right away if the game is already going)
		task.delay(if X.welcomed then 0.5 else 5.5, function()
			flash("OLD VERSION FOUND", K.C_WARN, "It's switched off now - delete old Track And Field scripts in StarterPlayerScripts", 6)
			announce("An old copy of Track and Field was running at the same time. It's switched off now - delete it from StarterPlayerScripts.", "An old copy of the game was switched off.")
		end)
	end
end

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
		if Settings.Uniform and player.Character == char and not X.kitRemote then
			applyUniform(char)
		end
	end)
	local current = race
	local you = current and current.you
	X.free.model = nil
	if current and you and not you.dq and current.phase ~= "done" and you.external then
		-- respawned mid race: put the new character back in its lane
		task.wait(0.5)
		lockPlayer(true)
		you.rig = nil
		placePlayerAt(you)
		setBib(you.lane)
		giveBaton(current.event.Relay and you.leg == 1)
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
		X.dashBuild()
		setupLighting()
		setupVoice()
		applyPerformance()
	end)
	X.netInit()
	if X.pendingOldRestore then
		X.pendingOldRestore = false
		X.afterOldCopy(0)
	end
	if player.Character then
		onCharacter(player.Character)
	end
	flash("TRACK AND FIELD", K.GOLD, "60m  100m  200m  400m  4x100m  4x200m  4x400m", 3.5)
	announce("Welcome to Track and Field, " .. player.Name .. "!", "Welcome to Track and Field, " .. player.Name)
	task.wait(4)
	X.welcomed = true
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
