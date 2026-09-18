-- chunkname: @/modules/game_custompokemon/custompokemon.lua

PokemonCustom = {}

local window, confirm, addonsPanel, shadersPanel, capsulesPanel, paintingsPanel, nicknamePanel
local protocol = runinsandbox("protocol")
local currentOutfit = {}

local function parseNickname(name, nick)
	local hasNick = nick and nick:trim():len() > 0
	local currentName = hasNick and nick or name

	currentOutfit.name = currentName

	nicknamePanel.name:setText(currentName)
	nicknamePanel.erase:setEnabled(hasNick)
	updatePreview()
end

local function parseAddons(list, currentAddonId)
	addonsPanel.list.onChildFocusChange = nil

	addonsPanel.list:destroyChildren()

	for i, addon in ipairs(list) do
		local button = g_ui.createWidget("PokemonCustomAddon", addonsPanel.list)
		local outfit = table.copy(currentOutfit)

		outfit.type = addon.looktype or addon.id

		button:setId(addon.id)
		button:setTooltip(addon.name)
		button.outfit:setOutfit(outfit)
		button.outfit:setOldScaling(true)
		button.locked:setVisible(addon.lock)
	end

	local currentAddon = nil
	if currentAddonId then
		for i = 1, addonsPanel.list:getChildCount() do
			local child = addonsPanel.list:getChildByIndex(i)
			local childId = child:getId()
			if tonumber(childId) == tonumber(currentAddonId) then
				currentAddon = child
				break
			end
		end
	end

	if currentAddon then
		currentAddon:focus()
		onAddonSelect(addonsPanel.list, currentAddon)
	end

	local isVisibleScroll = #list > 15

	addonsPanel.scroll:setVisible(isVisibleScroll)

	addonsPanel.list.onChildFocusChange = onAddonSelect
end

local function parseShaders(list, currentShaderId)
	shadersPanel.list.onChildFocusChange = nil

	shadersPanel.list:destroyChildren()

	for i, shader in ipairs(list) do
		local button = g_ui.createWidget("PokemonCustomPulseAura", shadersPanel.list)

		button.shaderId = shader.id
		button.shaderName = shader.name

		button:setId(shader.id)
		button:setTooltip(shader.name)
		button.locked:setVisible(shader.lock)
		button.color:setImageColor(shader.color)

	end

	local currentShader = nil
	if currentShaderId then
		for i = 1, shadersPanel.list:getChildCount() do
			local child = shadersPanel.list:getChildByIndex(i)
			local childId = child:getId()
			if tonumber(childId) == tonumber(currentShaderId) then
				currentShader = child
				break
			end
		end
	end

	if currentShader then
		currentShader:focus()
		onShaderSelect(shadersPanel.list, currentShader)
	else
		currentOutfit.shader = nil
		currentOutfit.shaderId = 0
	end

	local isVisibleScroll = #list > 28

	shadersPanel.scroll:setVisible(isVisibleScroll)

	shadersPanel.list.onChildFocusChange = onShaderSelect
end

local function onCustom(name, nick, outfit, addons, shaders, currentAddon, currentShader)
	currentOutfit = table.copy(outfit)

	parseAddons(addons, currentAddon)
	parseShaders(shaders, currentShader)
	parseNickname(name, nick)
end

local function onTabChange(tabBar, tab)
	local selectedTabId = tab.tabPanel:getId()

	if selectedTabId == "addonsPanel" then
		onAddonSelect(addonsPanel.list, addonsPanel.list:getFocusedChild())
	elseif selectedTabId == "shadersPanel" then
		onShaderSelect(shadersPanel.list, shadersPanel.list:getFocusedChild())
	elseif selectedTabId == "nicknamePanel" then
		currentOutfit.name = nicknamePanel.name:getText()
		currentOutfit.lock = false
	end

	updatePreview()
end

function init()
	protocol.initProtocol()
	connect(g_game, {
		onGameEnd = hide
	})
	connect(PokemonCustom, {
		onCustom = onCustom
	})

	window = g_ui.displayUI("custompokemon")

	window.mainTabBar:setContentWidget(window.mainTabContent)

	addonsPanel = g_ui.loadUI("ui/addonsPanel")
	shadersPanel = g_ui.loadUI("ui/shadersPanel")
	capsulesPanel = g_ui.loadUI("ui/capsulesPanel")
	paintingsPanel = g_ui.loadUI("ui/paintingsPanel")
	nicknamePanel = g_ui.loadUI("ui/nicknamePanel")

	window.mainTabBar:addTab(tr("Nickname"), nicknamePanel)
	window.mainTabBar:addTab(tr("Addons"), addonsPanel)
	window.mainTabBar:addTab(tr("Auras"), shadersPanel)
	window.mainTabBar:addTab(tr("Capsules"), capsulesPanel):setEnabled(false)
	window.mainTabBar:addTab(tr("Paintings"), paintingsPanel):setEnabled(false)

	window.mainTabBar.onTabChange = onTabChange
end

function terminate()
	protocol.terminateProtocol()
	disconnect(g_game, {
		onGameEnd = hide
	})
	disconnect(PokemonCustom, {
		onCustom = onCustom
	})

	if confirm then
		confirm:destroy()

		confirm = nil
	end

	window:destroy()

	window = nil
end

function hide()
	if confirm then
		confirm:destroy()

		confirm = nil
	end

	currentOutfit = {}

	window:hide()
end

function show()
	if not window:isVisible() then
		window:show()
		protocol.sendOpen()
	end
end

function onAddonSelect(list, focusedChild, unfocusedChild, reason)
	if focusedChild then
		currentOutfit = focusedChild.outfit:getOutfit()
		currentOutfit.name = focusedChild:getTooltip()
		currentOutfit.lock = focusedChild.locked:isVisible()
		currentOutfit.addonId = focusedChild:getId() -- Salvar o ID do addon

		updatePreview()
	end
end

function onShaderSelect(list, focusedChild, unfocusedChild, reason)
	if focusedChild then
		local shaderId = focusedChild:getId()  -- Agora o ID é o shader ID
		local shaderName = focusedChild.shaderName  -- O nome está salvo na propriedade shaderName

		-- Aplicar o shader usando o NOME do shader (igual ao pokemon_shaders antigo)
		if shaderName and shaderName ~= "" then
			currentOutfit.shader = shaderName  -- Usar nome, não ID
		else
			currentOutfit.shader = nil
		end
		
		currentOutfit.name = shaderName
		currentOutfit.lock = focusedChild.locked:isVisible()
		currentOutfit.shaderId = tonumber(shaderId) or 0

		-- Debug log para verificar se o shader está sendo aplicado
		print("Aplicando shader:", shaderName, "ID:", shaderId)

		updatePreview()
	else
		-- Se nenhum shader selecionado, remover shader
		currentOutfit.shader = nil
		currentOutfit.shaderId = 0
		print("Removendo shader da outfit")
		updatePreview()
	end
end

function updatePreview()
	window.previewPanel.confirm:setEnabled(not currentOutfit.lock)
	window.previewPanel.locked:setVisible(currentOutfit.lock)
	window.previewPanel.name:setText(currentOutfit.name)
	
	-- Debug log para verificar a outfit antes de aplicar
	print("updatePreview - Shader na outfit:", currentOutfit.shader, "Type:", type(currentOutfit.shader))
	
	-- Aplicar a outfit diretamente, incluindo o shader (igual ao pokemon_shaders antigo)
	window.previewPanel.outfit:setOutfit(currentOutfit)
	window.previewPanel.outfit:setOldScaling(true) -- Configuração necessária para shaders funcionarem corretamente
	
	-- Verificar se o shader foi aplicado na UICreature
	local appliedOutfit = window.previewPanel.outfit:getOutfit()
	print("updatePreview - Shader aplicado na UICreature:", appliedOutfit.shader)
	
	if currentOutfit.shader then
		print("updatePreview - Shader ativo:", currentOutfit.shader)
	else
		print("updatePreview - Nenhum shader ativo")
	end
end

function confirmChoose()
	local selectedTabId = window.mainTabBar:getCurrentTabPanel():getId()

	if selectedTabId == "nicknamePanel" then
		if isValidateNickname() then
			confirmUpdateNickname(nicknamePanel.nickInput:getText())
		end

		return
	end

	if selectedTabId == "addonsPanel" then
		protocol.sendChooseAddon(currentOutfit.addonId or currentOutfit.type)
	elseif selectedTabId == "shadersPanel" then
		protocol.sendChooseShader(currentOutfit.shaderId)
	end

	hide()
end

function confirmUpdateNickname(nickname)
	local function confirmCallback()
		protocol.sendUpdateNickname(nickname)
		nicknamePanel.nickInput:clearText()
		nicknamePanel.helperNickInput:clearText()
		hide()
	end

	local title = nickname:len() > 0 and "Change nickname" or "Erase nickname"
	local text = nickname:len() > 0 and "Realmente deseja fazer essa altera\xE7\xE3o? Custar\xE1 {#e2bb5b|3 P-bucks}." or "Voc\xEA realmente deseja remover o apelido do seu pok\xE9mon?"

	confirm = displayConfirmBox(tr(title), tr(text), confirmCallback)
end

function isValidateNickname()
	local isValidate = onInputName(nicknamePanel.nickInput)

	if isValidate then
		local isEqualNick = nicknamePanel.nickInput:getText() == currentOutfit.name

		if isEqualNick then
			isValidate = onInputError(nicknamePanel.nickInput, "O novo apelido n\xE3o pode corresponder ao atual.")
		end
	end

	return isValidate
end
