-- chunkname: @/modules/client_options/options.lua

local defaultOptions = {
	displayPokemonIcons= true,
	displayItemCountOnMap = true,
	displayNameEffects = true,
	displayCreatureTitles = true,
	displayPlayerBars = true,
	displayPlayerBarModule = true,
	showHealthManaCircle = false,
	displayHealthOnTop = false,
	displayMana = false,
	displayHealth = true,
	displayNames = true,
	optimizationLevel = 1,
	ambientLight = 100,
	crosshair = 1,
	floorFading = true,
	enableLights = false,
	useItem = true,
	dropContainer = true,
	enableAudio = true,
	backgroundFrameRate = 60,
	containerPanel = 8,
	rightPanels = 1,
	showPrivateMessagesOnScreen = true,
	showPrivateMessagesInConsole = true,
	showLevelsInConsole = true,
	showTimestampsInConsole = true,
	showInfoMessagesInConsole = true,
	showEventMessagesInConsole = true,
	showStatusMessagesInConsole = true,
	autoChaseOverride = true,
	dash = false,
	smartWalk = true,
	cacheMap = true,
	viewMode = 2,
    hdmodeBox = true,
	fullscreen = false,
	showPing = false,
	showFps = true,
	vsync = true,
	musicSoundVolume = 100,
	enableMusicSound = true, -- Habilitado por padrão para música de startup
	animationWindow = true,
	dropPokeball = true,
	actionBar2 = false,
	actionBar1 = true,
	walkCtrlTurnDelay = 150,
	walkTeleportDelay = 200,
	walkStairsDelay = 50,
	walkTurnDelay = 100,
	gameOpacity = 100,
	walkFirstStepDelay = 200,
	qezcWalking = true,
	wsadWalking = false,
	walkClick = true,
	antialiasing = true,
	hotkeyDelay = 30,
	turnDelay = 30,
	blurScreen = true,
	pokebar = true,
	dontStretchShrink = false,
	displayText = true,
	topHealthManaBar = false,
	highlightThingsUnderCursor = false,
	correctCreatureInformation = true,
	displayShakeScreen = true,
	layout = DEFAULT_LAYOUT,
	classicControl = not g_app.isMobile(),
	leftPanels = g_app.isMobile() and 1 or 2,
	visionMode = 1 + VisionMode.Big
}
local optionsWindow, confirmWindow, optionsButton, optionsTabBar
local options = {}
local extraOptions = {}
local generalPanel, interfacePanel, consolePanel, graphicsPanel, soundPanel, extrasPanel, accountPanel, audioButton, hotkeyPanel

function init()
	for k, v in pairs(defaultOptions) do
		g_settings.setDefault(k, v)

		options[k] = v
	end

	for _, v in ipairs(g_extras.getAll()) do
		extraOptions[v] = g_extras.get(v)

		g_settings.setDefault("extras_" .. v, extraOptions[v])
	end

	optionsWindow = g_ui.displayUI("options")

	optionsWindow:hide()

	optionsTabBar = optionsWindow:getChildById("optionsTabBar")

	optionsTabBar:setContentWidget(optionsWindow:getChildById("optionsTabContent"))
	g_keyboard.bindKeyDown("Ctrl+Shift+F", function()
		toggleOption("fullscreen")
	end)
	g_keyboard.bindKeyDown("Ctrl+N", toggleDisplays)

	generalPanel = g_ui.loadUI("game")

	optionsTabBar:addTab(tr("Game"), generalPanel)

	interfacePanel = g_ui.loadUI("interface")

	optionsTabBar:addTab(tr("Interface"), interfacePanel)

	consolePanel = g_ui.loadUI("console")

	optionsTabBar:addTab(tr("Console"), consolePanel)

	graphicsPanel = g_ui.loadUI("graphics")

	optionsTabBar:addTab(tr("Graphics"), graphicsPanel)

	hotkeyPanel = g_ui.loadUI("hotkey")

	optionsTabBar:addTab(tr("Hotkeys"), hotkeyPanel)

	accountPanel = g_ui.loadUI("account")

	optionsTabBar:addTab(tr("Account"), accountPanel):setEnabled(false)

	optionsButton = modules.client_topmenu.addLeftButton("optionsButton", tr("Options"), "/images/topbuttons/icon_config", toggle, false, 2)

	addEvent(function()
		setup()
	end)
	connect(g_game, {
		onGameStart = online,
		onGameEnd = offline
	})
end

function terminate()
	disconnect(g_game, {
		onGameStart = online,
		onGameEnd = offline
	})
	g_keyboard.unbindKeyDown("Ctrl+Shift+F")
	g_keyboard.unbindKeyDown("Ctrl+N")

	if confirmWindow then
		confirmWindow:destroy()

		confirmWindow = nil
	end

	optionsWindow:destroy()
	optionsButton:destroy()
end

function setup()
	for k, v in pairs(defaultOptions) do
		if type(v) == "boolean" then
			setOption(k, g_settings.getBoolean(k), true)
		elseif type(v) == "number" then
			setOption(k, g_settings.getNumber(k), true)
		elseif type(v) == "string" then
			setOption(k, g_settings.getString(k), true)
		end
	end

	if g_game.isOnline() then
		online()
	end

	configureKeybindsPanel()
end

function toggle()
	if optionsWindow:isVisible() then
		hide()
	else
		show()
	end
end

function show()
	optionsButton:setOn(true)
	optionsWindow:show()
	optionsWindow:raise()
	optionsWindow:focus()
	enableAccountPanel()
end

function hide()
	optionsButton:setOn(false)
	optionsWindow:hide()
end

function toggleDisplays()
	if options.displayNames and options.displayHealth and options.displayMana then
		setOption("displayNames", false)
	elseif options.displayHealth then
		setOption("displayHealth", false)
		setOption("displayMana", false)
	elseif not options.displayNames and not options.displayHealth then
		setOption("displayNames", true)
	else
		setOption("displayHealth", true)
		setOption("displayMana", false)
	end
end

function toggleOption(key)
	setOption(key, not getOption(key))
end

function setOption(key, value, force)
	if extraOptions[key] ~= nil then
		g_extras.set(key, value)
		g_settings.set("extras_" .. key, value)

		if key == "debugProxy" and modules.game_proxy then
			if value then
				modules.game_proxy.show()
			else
				modules.game_proxy.hide()
			end
		end

		return
	end

	if modules.game_interface == nil then
		return
	end

	if not force and options[key] == value then
		return
	end

	local gameMapPanel = modules.game_interface.getMapPanel()

	if key == "vsync" then
		g_window.setVerticalSync(value)
	elseif key == "showFps" then
		modules.client_topmenu.setFpsVisible(value)

		if modules.game_stats and modules.game_stats.ui.fps then
			modules.game_stats.ui.fps:setVisible(value)
		end
	elseif key == "showPing" then
		modules.client_topmenu.setPingVisible(value)

		if modules.game_stats and modules.game_stats.ui.ping then
			modules.game_stats.ui.ping:setVisible(value)
		end
	elseif key == "fullscreen" then
		g_window.setFullscreen(value)
	elseif key == "enableAudio" then
		if g_sounds ~= nil then
			g_sounds.setAudioEnabled(value)
		end

		if value then
			-- block empty
		end
	elseif key == "enableMusicSound" then
		if g_sounds ~= nil then
			g_sounds.getChannel(SoundChannels.Music):setEnabled(value)
		end
	elseif key == "musicSoundVolume" then
		if g_sounds ~= nil then
			g_sounds.getChannel(SoundChannels.Music):setGain(value / 100)
		end
  elseif key == 'hdmodeBox' then
    g_sprites.setHDMode(value)
	elseif key == "backgroundFrameRate" then
		local text, v = value, value

		if value <= 0 or value >= 201 then
			text = "max"
			v = 0
		end

		graphicsPanel:recursiveGetChildById("backgroundFrameRateLabel"):setText(tr("Game framerate limit: %s", text))
		g_app.setMaxFps(v)
	elseif key == "enableLights" then
		gameMapPanel:setDrawLights(value and options.ambientLight < 100)
		graphicsPanel:recursiveGetChildById("ambientLight"):setEnabled(value)
		graphicsPanel:recursiveGetChildById("ambientLightLabel"):setEnabled(value)
	elseif key == "floorFading" then
		local fadingMs = 500

		if value then
			gameMapPanel:setFloorFading(fadingMs)
		else
			gameMapPanel:setFloorFading(0)
		end
	elseif key == "crosshair" then
		gameMapPanel:setCrosshair("")
	elseif key == "ambientLight" then
		graphicsPanel:recursiveGetChildById("ambientLightLabel"):setText(tr("Ambient light: %s%%", value))
		gameMapPanel:setMinimumAmbientLight(value / 100)
		gameMapPanel:setDrawLights(options.enableLights and value < 100)
	elseif key == "optimizationLevel" then
		g_adaptiveRenderer.setLevel(value - 2)
	elseif key == "displayNames" then
		gameMapPanel:setDrawNames(value)
	elseif key == "displayHealth" then
		gameMapPanel:setDrawHealthBars(value)
	elseif key == "displayMana" then
		gameMapPanel:setDrawManaBar(value)
	elseif key == "displayHealthOnTop" then
		gameMapPanel:setDrawHealthBarsOnTop(value)
	elseif key == "displayPlayerBars" then
		gameMapPanel:setDrawPlayerBars(value)
	elseif key == "displayPlayerBarModule" then
		if modules.game_playerbar and modules.game_playerbar.playerBarWindow then
			if value then
				modules.game_playerbar.refresh()
			else
				modules.game_playerbar.playerBarWindow:setVisible(false)
			end
		end
	
    -- elseif key == "displayCreatureTitles" then
	--  	gameMapPanel:setDrawTitles(value)
	-- elseif key == "displayNameEffects" then
	--  	gameMapPanel:setDrawNameEffects(value)
	-- elseif key == "displayShakeScreen" then
	--  	gameMapPanel:setDrawShakeScreen(value)
	-- elseif key == "displayItemCountOnMap" then
	-- 	if value then
	-- 		g_game.enableFeature(GameMapDrawItemCount)
	-- 	else
	-- 		g_game.disableFeature(GameMapDrawItemCount)
	-- 	end
      elseif key == "displayPokemonIcons" then
        g_game.talk("##icontalkpk## " .. (value and "on" or "off"))
	-- elseif key == "correctCreatureInformation" then
	-- 	gameMapPanel:setDrawInformationDisplacement(value)
	elseif key == "displayText" then
		gameMapPanel:setDrawTexts(value)
	elseif key == "pokebar" then
		modules.game_pokebar.getPokemonBar():setVisible(value)
	elseif key == "blurScreen" then
		modules.game_interface.gameMapPanel:setShader("")
	elseif key == "dontStretchShrink" then
		addEvent(function()
			modules.game_interface.updateStretchShrink()
		end)
	elseif key == "dash" then
		if value then
			g_game.setMaxPreWalkingSteps(2)
		else
			g_game.setMaxPreWalkingSteps(1)
		end
	elseif key == "wsadWalking" then
		if modules.game_console and modules.game_console.consoleToggleChat:isChecked() ~= value then
			modules.game_console.consoleToggleChat:setChecked(value)
		end
	elseif key == "qezcWalking" then
		if value then
			if modules.game_console and modules.game_console.consoleToggleChat:isChecked() then
				modules.game_walking.enableQEZC()
			end
		else
			modules.game_walking.disableQEZC()
		end
	elseif key == "hotkeyDelay" then
		generalPanel:recursiveGetChildById("hotkeyDelayLabel"):setText(tr("Hotkey delay: %s ms", value))
	elseif key == "walkFirstStepDelay" then
		generalPanel:recursiveGetChildById("walkFirstStepDelayLabel"):setText(tr("Walk delay after first step: %s ms", value))
	elseif key == "walkTurnDelay" then
		generalPanel:recursiveGetChildById("walkTurnDelayLabel"):setText(tr("Walk delay after turn: %s ms", value))
	elseif key == "walkStairsDelay" then
		generalPanel:recursiveGetChildById("walkStairsDelayLabel"):setText(tr("Walk delay after floor change: %s ms", value))
	elseif key == "walkTeleportDelay" then
		generalPanel:recursiveGetChildById("walkTeleportDelayLabel"):setText(tr("Walk delay after teleport: %s ms", value))
	elseif key == "walkCtrlTurnDelay" then
		generalPanel:recursiveGetChildById("walkCtrlTurnDelayLabel"):setText(tr("Walk delay after ctrl turn: %s ms", value))
	elseif key == "antialiasing" then
		g_app.setSmooth(value)
	elseif key == 'gameOpacity' then
		graphicsPanel:recursiveGetChildById('gameOpacityLabel'):setText(tr('Efeitos e opacidade do missil: %s%%', value))
		g_game.setEffectOpacity(value)
	elseif key == "visionMode" then
		local mode = value - 1

		if g_map.getVisionMode() ~= mode then
			g_map.setVisionMode(value - 1)
		end
	end

	for _, panel in pairs(optionsTabBar:getTabsPanel()) do
		local widget = panel:recursiveGetChildById(key)

		if widget then
			if widget:getStyle().__class == "UICheckBox" then
				widget:setChecked(value)

				break
			end

			if widget:getStyle().__class == "UIScrollBar" then
				widget:setValue(value)

				break
			end

			if widget:getStyle().__class == "UIComboBox" then
				if type(value) == "string" then
					widget:setCurrentOption(value, true)

					break
				end

				if value == nil or value < 1 then
					value = 1
				end

				if widget.currentIndex ~= value then
					widget:setCurrentIndex(value, true)
				end
			end

			break
		end
	end

	g_settings.set(key, value)

	options[key] = value

	if key == "viewMode" or key == "rightPanels" or key == "leftPanels" or key == "cacheMap" then
		modules.game_interface.refreshViewMode()
	elseif key == "actionBar1" then
		modules.game_actionbar.show()
	end
end

function getOption(key)
	return options[key]
end

function addTab(name, panel, icon)
	optionsTabBar:addTab(name, panel, icon)
end

function addButton(name, func, icon)
	optionsTabBar:addButton(name, func, icon)
end

function online()
	setLightOptionsVisibility(not g_game.getFeature(GameForceLight))
	g_app.setSmooth(g_settings.getBoolean("antialiasing"))
	enableAccountPanel()
end

function offline()
	setLightOptionsVisibility(true)

	local accountTab = optionsTabBar:getTab(tr("Account"))

	if accountTab then
		if optionsTabBar:getCurrentTab() == accountTab then
			optionsTabBar:selectPrevTab()
		end

		accountTab:setEnabled(false)
	end
end

function enableAccountPanel()
	local accountTab = optionsTabBar:getTab(tr("Account"))

	if accountTab and g_game.isOnline() then
		accountTab:setEnabled(true)

		local changeEmailButton = accountPanel:recursiveGetChildById("changeEmail")
		local daysToEmailChange = G.characterAccount.daysToEmailChange

		if daysToEmailChange and daysToEmailChange >= 0 then
			changeEmailButton:setText(tr("Cancel e-mail exchange") .. tr(" (%d days left)", daysToEmailChange))
		else
			changeEmailButton:setText(tr("Change e-mail"))
		end
	end
end

function setLightOptionsVisibility(value)
	graphicsPanel:recursiveGetChildById("enableLights"):setEnabled(value)
	graphicsPanel:recursiveGetChildById("ambientLightLabel"):setEnabled(value)
	graphicsPanel:recursiveGetChildById("ambientLight"):setEnabled(value)
	interfacePanel:recursiveGetChildById("floorFading"):setChecked(value)
end

function getKeybindsPanel()
	return hotkeyPanel.panel
end

function configureKeybindsPanel()
	hotkeyPanel.panel.content:destroyChildren()

	for categoryIndex, categoryObject in pairs(KeybindManager:getCategories()) do
		categoryObject:injectAsOption()

		for keybindIndex, keybindObject in pairs(categoryObject.keybinds) do
			keybindObject:injectAsOption()
		end
	end

	local profilesPanel = hotkeyPanel.panel.profilesPanel
	local profilePicker = profilesPanel.profilePicker

	for _, profile in pairs(KeybindManager.profiles) do
		profilePicker:addOption(profile:getName(), profile:getName())
	end

	profilePicker:setCurrentOption(KeybindManager.currentProfile:getName())

	function profilePicker:onOptionChange()
		KeybindManager:getProfileByName(self:getCurrentOption().text):activate()
	end

	function profilesPanel.createProfile.onClick()
		modules.client_textedit.edit("", {
			title = tr("Create profile")
		}, function(text)
			if text:trim():len() > 0 then
				local profile = KeybindManager:createProfile(text)

				if profile then
					profile:activate()
				end
			end
		end)
	end

	function profilesPanel.deleteProfile.onClick()
		local currentProfileName = profilePicker:getCurrentOption().text

		local function callbackCancel()
			if confirmWindow then
				confirmWindow:destroy()

				confirmWindow = nil
			end

			profilePicker:enable()
		end

		local function callbackConfirm()
			local profile = KeybindManager:getProfileByName(currentProfileName)

			if profile:delete() then
				profilePicker:removeOption(currentProfileName)
			end

			profilePicker:enable()
		end

		profilePicker:disable()

		confirmWindow = displayConfirmBox(tr("Are you sure?"), tr("Are you sure you want to delete profile {%s|%s}?", "#e2bb5b", currentProfileName), callbackConfirm, callbackCancel)
	end

	KeybindManager:propagate()

	local resetAllButton = hotkeyPanel.panel:recursiveGetChildById("resetAllButton")

	function resetAllButton.onClick()
		KeybindManager:resetToDefaults()
	end
end
