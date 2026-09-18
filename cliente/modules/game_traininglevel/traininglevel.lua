-- chunkname: @/modules/game_traininglevel/traininglevel.lua

local window, chooseWindow, guideWindow, trainingList, selectedPanel, elementImageInfo, elementDescriptionInfo
local TRAINING_OPCODE = 97
local TRAINING_ACTIONS = {
	SEND_CHOOSE_TRAINING = 10,
	SEND_RESET_COOLDOWN = 9,
	SEND_PAID_SLOT = 8,
	SEND_SLOT = 7,
	SEND_SWITCH = 6,
	SEND_START = 5,
	PARSE_PERCENT = 4,
	PARSE_ITEM_SLOT = 3,
	PARSE_MESSAGE = 2,
	PARSE_TRAINING_SLOT = 1
}
local TRAINING_CONFIG = {
	TRAINING_SLOT = 1800,
	PRICE_RESET_COOLDOW = 2500000
}
local TRAINING_SLOT_TYPE = {
	BOOST = 3,
	PLATE = 2,
	POKEBALL = 1
}
local TRAINING_SLOT_PAID = {
	[6] = 50,
	[5] = 25
}
local percentTraining = 0
local slotTypeItem = {
	[TRAINING_SLOT_TYPE.POKEBALL] = nil,
	[TRAINING_SLOT_TYPE.PLATE] = nil,
	[TRAINING_SLOT_TYPE.BOOST] = nil
}

local function isString(str)
	return type(str) == "string"
end

local function isShinyName(name)
	return tostring(name) and string.find(name, "Shiny")
end

local function getImageElement(element)
	return IMAGE_TRAINING_PATH .. element
end

local function getImageNameElement(slot)
	return slot.cooldown > 0 and "cooldown" or not slot.isUnlocked and IMAGE_TRAINING_SLOTS[slot.slotId] or slot.element
end

local function getDescriptionElement(element)
	return ELEMENTS_DESCRIPTION[element]
end

local function getTrainingElement(slot)
	return TRAINING_ELEMENT[slot.element]
end

local function getPlateElement(item)
	return PLATE_ELEMENT[item:getId()]
end

local function getShinyPlateElement(item)
	return PLATE_SHINY_ELEMENT[item:getId()]
end

local function getBoostElement(item)
	return COIN_ELEMENT[item:getId()]
end

local function getPokemonElements(pokemonName)
	return Pokedex_PokemonsByName[pokemonName:lower()].Types
end

function sendAction(action, data)
	local protocolGame = g_game.getProtocolGame()

	if protocolGame then
		protocolGame:sendExtendedJSONOpcode(TRAINING_OPCODE, {
			action = action,
			data = data
		})
	end
end

function sendChooseTraining()
	if not chooseWindow then
		return
	end

	local focusedChild = trainingList:getFocusedChild()

	if not focusedChild then
		return
	end

	local focusedElement = chooseWindow.list:getFocusedChild()

	if not focusedElement then
		return
	end

	local slotData = {
		slotId = focusedChild.slot.slotId,
		element = focusedElement:getId()
	}

	modules.game_pokeprey.showMessage(chooseWindow:getText(), tr("Voc\xEA realmente deseja escolher esse treinamento?"), function()
		onCloseChooseWindow()
		sendAction(TRAINING_ACTIONS.SEND_CHOOSE_TRAINING, slotData)
	end)
end

function sendResetCooldown()
	local focusedChild = trainingList:getFocusedChild()

	if not focusedChild then
		return
	end

	local slotData = {
		slotId = focusedChild.slot.slotId
	}
	local price = math.floor(TRAINING_CONFIG.PRICE_RESET_COOLDOW / TRAINING_CONFIG.TRAINING_SLOT) * focusedChild.slot.cooldown

	modules.game_pokeprey.showMessage(tr("Reset Time"), tr("Voc\xEA deseja remover o tempo de cooldown deste slot? Pre\xE7o {#de8407|%s}", formatMoney(price)), function()
		if focusedChild.slot.cooldown > 0 then
			sendAction(TRAINING_ACTIONS.SEND_RESET_COOLDOWN, slotData)
		end
	end)
end

function sendPaidSlot()
	local focusedChild = trainingList:getFocusedChild()

	if not focusedChild then
		return
	end

	local slotData = {
		slotId = focusedChild.slot.slotId
	}

	if not TRAINING_SLOT_PAID[slotData.slotId] then
		return
	end

	modules.game_pokeprey.showMessage(tr("Buy"), tr("Voc\xEA deseja comprar um slot extra para o Pok\xE9mon Training? {#fac532|Valor: %d P-Bucks}", TRAINING_SLOT_PAID[slotData.slotId]), function()
		sendAction(TRAINING_ACTIONS.SEND_PAID_SLOT, slotData)
	end)
end

function sendStart()
	local focusedChild = trainingList:getFocusedChild()

	if not focusedChild then
		return
	end

	local itemData = {}

	for slotType, item in pairs(slotTypeItem) do
		itemData[slotType] = {
			slotId = focusedChild.slot.slotId,
			slotType = slotType,
			spriteId = item:getId(),
			position = item:getPosition(),
			stackpos = item:getStackPos()
		}
	end

	local slotData = {
		slotId = focusedChild.slot.slotId,
		items = itemData
	}

	sendAction(TRAINING_ACTIONS.SEND_START, slotData)
end

function sendSwitchSlot()
	local focusedChild = trainingList:getFocusedChild()

	if not focusedChild then
		return
	end

	local slotData = {
		slotId = focusedChild.slot.slotId
	}

	modules.game_pokeprey.showMessage(tr("Switch training"), "Voc\xEA deseja realmente trocar o treinamento?", function()
		sendAction(TRAINING_ACTIONS.SEND_SWITCH, slotData)
	end)
end

function sendSlotItem(slotType, item)
	local focusedChild = trainingList:getFocusedChild()

	if not focusedChild then
		return
	end

	local slotData = {
		slotId = focusedChild.slot.slotId,
		slotType = slotType,
		spriteId = item:getId(),
		position = item:getPosition(),
		stackpos = item:getStackPos()
	}

	slotTypeItem[slotType] = item

	sendAction(TRAINING_ACTIONS.SEND_SLOT, slotData)
end

function parsePokeball(params)
	if isString(params.item) then
		parseMessage(params.item)

		return onClearSlotPokeball()
	end

	selectedPanel.levelProgress:setPercent(params.item.xp)
	selectedPanel.slotPokeball:setTooltip(params.item.name)
	selectedPanel.levelProgress:setTooltip(tr("%d%%", params.item.xp))
	selectedPanel.pokemonLevel:setText(tr("Lv. %d", params.item.level))
	selectedPanel.countPlateLabel:setText(tr("/%d", params.item.count))
end

function parsePlate(params)
	if isString(params.item) then
		parseMessage(params.item)

		return onClearSlotPlate()
	end

	selectedPanel.slotPlate:setTooltip(params.item.name)
	selectedPanel.countPlayerLabel:setText(params.item.playerCount)
end

function parseBoost(params)
	if isString(params.item) then
		parseMessage(params.item)

		return onClearSlotBoost()
	end

	selectedPanel.slotBoost:setTooltip(params.item.name)
end

local parseSlotsCallbacks = {
	[TRAINING_SLOT_TYPE.POKEBALL] = parsePokeball,
	[TRAINING_SLOT_TYPE.PLATE] = parsePlate,
	[TRAINING_SLOT_TYPE.BOOST] = parseBoost
}

function parseSlotItem(params)
	local executeAction = parseSlotsCallbacks[params.slotType]

	if executeAction then
		executeAction(params)
	end
end

function parseTrainingSlot(params)
	local slotUI = trainingList[params.slotId]

	if not slotUI then
		slotUI = g_ui.createWidget("TrainingSlot", trainingList)

		slotUI:setId(params.slotId)
	end

	local isInCooldown = params.cooldown > 0
	local isVisibleIconSwitch = not isInCooldown and params.isUnlocked
	local elementImage = getImageNameElement(params)

	slotUI.slot = params

	slotUI.iconBuy:setVisible(not params.isUnlocked)
	slotUI.iconSwitch:setVisible(isVisibleIconSwitch)
	slotUI.iconChoose:setVisible(isVisibleIconSwitch)
	slotUI:setImageSource(getImageElement(elementImage))

	for i, widget in pairs({
		slotUI.cooldownLabel,
		slotUI.iconCooldown
	}) do
		widget:setVisible(isInCooldown)
	end

	removeEvent(slotUI.event)

	if isInCooldown then
		onUpdateSlotCooldown(slotUI, params.cooldown)
	end

	onUpdateTrainingInfo(trainingList, trainingList:getFocusedChild())
	window:show()
end

function parseMessage(message)
	local messageLabel = selectedPanel.messageLabel

	removeEvent(messageLabel.event)
	messageLabel:setMultiColorText(message)

	messageLabel.event = scheduleEvent(function()
		messageLabel:clearText()
	end, 6000)
end

function parsePercent(percent)
	return
end

local parseOpcodeCallbacks = {
	[TRAINING_ACTIONS.PARSE_TRAINING_SLOT] = parseTrainingSlot,
	[TRAINING_ACTIONS.PARSE_MESSAGE] = parseMessage,
	[TRAINING_ACTIONS.PARSE_ITEM_SLOT] = parseSlotItem,
	[TRAINING_ACTIONS.PARSE_PERCENT] = parsePercent
}

function parseOpcode(opcode, protocol, jsonData)
	local executeAction = parseOpcodeCallbacks[jsonData.action]

	if executeAction then
		executeAction(jsonData.data)
	end
end

function init()
	connect(g_game, {
		onGameEnd = onOffline
	})
	connect(LocalPlayer, {
		onPositionChange = onTrainingPositionChange
	})
	ProtocolGame.registerExtendedJSONOpcode(TRAINING_OPCODE, parseOpcode)

	window = g_ui.displayUI("traininglevel")
	trainingList = window:recursiveGetChildById("trainingList")
	selectedPanel = window:recursiveGetChildById("selectedPanel")
	elementImageInfo = window:recursiveGetChildById("elementImageInfo")
	elementDescriptionInfo = window:recursiveGetChildById("elementDescriptionInfo")

	onOffline()
end

function terminate()
	disconnect(g_game, {
		onGameEnd = onOffline
	})
	disconnect(LocalPlayer, {
		onPositionChange = onTrainingPositionChange
	})
	ProtocolGame.unregisterExtendedJSONOpcode(TRAINING_OPCODE)
	onOffline()
	window:destroy()

	window = nil
end

function onOffline()
	for i, slotType in pairs(slotTypeItem) do
		slotTypeItem[slotType] = nil
	end

	for i, slotUI in pairs(trainingList:getChildren()) do
		removeEvent(slotUI.event)
	end

	percentTraining = 0

	trainingList:destroyChildren()
	onCloseChooseWindow()
	onCloseGuideWindow()
	window:hide()
	onClearSlotBoost()
	onClearSlotPlate()
	onClearSlotPokeball()
end

function onTrainingPositionChange()
	if window and window:isVisible() then
		onOffline()
	end
end

function onCloseGuideWindow()
	if guideWindow then
		guideWindow:destroy()

		guideWindow = nil
	end
end

function onShowGuideWindow()
	onCloseGuideWindow()

	guideWindow = g_ui.createWidget("TrainingGuide", rootWidget)
end

function onCloseChooseWindow()
	if chooseWindow then
		chooseWindow:destroy()

		chooseWindow = nil
	end
end

function onOpenChooseWindow()
	onCloseChooseWindow()

	chooseWindow = g_ui.createWidget("TrainingChooseWindow", window)

	for i, element in pairs(ELEMENTS) do
		if element ~= ELEMENTS.NEUTRAL then
			local slotUI = g_ui.createWidget("TrainingImage", chooseWindow.list)

			slotUI:setId(element)
			slotUI:setImageSource(getImageElement(element))
		end
	end
end

function onUpdateTrainingInfo(self, focusedChild, oldFocused, reason)
	if focusedChild and focusedChild.slot then
		local elementImage = getImageNameElement(focusedChild.slot)
		local plateItem = slotTypeItem[TRAINING_SLOT_TYPE.PLATE]
		local boostItem = slotTypeItem[TRAINING_SLOT_TYPE.BOOST]

		if plateItem and isString(canDropSlotPlate(focusedChild.slot, plateItem)) then
			onClearSlotPlate()
		end

		if boostItem and isString(canDropSlotBoost(focusedChild.slot, boostItem)) then
			onClearSlotBoost()
		end

		updatePercent()
		elementImageInfo:setImageSource(getImageElement(elementImage))
		elementDescriptionInfo:setText(getDescriptionElement(elementImage))
	end
end

function onUpdateSlotCooldown(slotUI, cooldown)
	if not slotUI.slot then
		return
	end

	if cooldown < 0 then
		for i, widget in pairs({
			slotUI.cooldownLabel,
			slotUI.iconCooldown
		}) do
			widget:hide()
		end

		slotUI.iconSwitch:show()
		slotUI.iconChoose:show()
		slotUI:setImageSource(getImageElement(getImageNameElement(slotUI.slot)))
		onUpdateTrainingInfo(trainingList, trainingList:getFocusedChild())

		return
	end

	slotUI.slot.cooldown = cooldown

	slotUI.cooldownLabel:setText(formatTime(cooldown))

	slotUI.event = scheduleEvent(function()
		onUpdateSlotCooldown(slotUI, cooldown - 1)
	end, 1000)
end

function onDropSlotItem(self, widget, mousePos, forced)
	local className = widget:getClassName()

	if className ~= "UIItem" then
		return false
	end

	local item = widget:getItem()

	if not item then
		return false
	end

	local result = canDropItem(self.slotType, item)

	if isString(result) then
		return parseMessage(result)
	end

	self:setOn(false)
	self:setItem(item)
	self:setShowCount(false)
	sendSlotItem(self.slotType, item)
	updatePercent()

	return true
end

function canDropSlotPokeball(slot, item)
	if item:getPokemon():len() < 1 then
		return "Coloque um {#ed3939|Pok\xE9mon} neste slot."
	end

	if not table.contains(getPokemonElements(item:getPokemon()), getTrainingElement(slot)) and not table.contains({
		ELEMENTS.NEUTRAL
	}, getTrainingElement(slot)) then
		return "Este treinador n\xE3o pode treinar Pok\xE9mon\ndeste {#0555f5|elemento}."
	end

	local plateItem = slotTypeItem[TRAINING_SLOT_TYPE.PLATE]

	if plateItem then
		local plateElement = getPlateElement(plateItem)
		local shinyPlateElement = getShinyPlateElement(plateItem)
		local isShinyPokemon = isShinyName(item:getPokemon())

		if isShinyPokemon and plateElement then
			return "Este Pok\xE9mon n\xE3o pode usar {#ff1100|Plates B\xE1sicas} em seu treinamento."
		end

		if not isShinyPokemon and shinyPlateElement then
			return "Este Pok\xE9mon n\xE3o pode usar {#ff1100|Shining Plate} em seu treinamento."
		end

		if not table.contains(getPokemonElements(item:getPokemon()), plateElement) and not table.contains({
			ELEMENTS.NEUTRAL
		}, getTrainingElement(slot)) then
			return "Coloque uma {#ff1100|Plate} do elemento do Pok\xE9mon."
		end
	end

	return true
end

function canDropSlotPlate(slot, item)
	if not getPlateElement(item) and not getShinyPlateElement(item) then
		return "Coloque uma {#de8407|Plate} v\xE1lida neste slot."
	end

	local pokeballItem = slotTypeItem[TRAINING_SLOT_TYPE.POKEBALL]

	if pokeballItem then
		local isShinyPokemon = isShinyName(pokeballItem:getPokemon())
		local plateElement = getPlateElement(item)
		local shinyPlateElement = getShinyPlateElement(item)

		if isShinyPokemon and plateElement then
			return "Este Pok\xE9mon n\xE3o pode usar {#ff1100|Plates B\xE1sicas} em seu treinamento."
		end

		if not isShinyPokemon and shinyPlateElement then
			return "Este Pok\xE9mon n\xE3o pode usar {#ff1100|Shining Plate} em seu treinamento."
		end

		if not table.contains(getPokemonElements(pokeballItem:getPokemon()), plateElement or shinyPlateElement) and not table.contains({
			ELEMENTS.NEUTRAL
		}, getTrainingElement(slot)) then
			return "Coloque uma {#ff1100|Plate} do elemento do Pok\xE9mon."
		end
	end

	return true
end

function canDropSlotBoost(slot, item)
	local boostElement = getBoostElement(item)

	if not boostElement then
		return "Coloque um {#d3de02|Elemental Coin} neste slot."
	end

	if getTrainingElement(slot) ~= boostElement then
		return "Voc\xEA n\xE3o pode usar este {#d3de02|Elemental Coin} neste treinamento."
	end

	return true
end

function canDropItem(slotType, item)
	local focusedChild = trainingList:getFocusedChild()

	if not focusedChild or not focusedChild.slot then
		return "Selecione um treinamento."
	end

	if not focusedChild.slot.isUnlocked then
		return "Treinamento bloqueado."
	end

	local dropItemCallbacks = {
		[TRAINING_SLOT_TYPE.POKEBALL] = canDropSlotPokeball,
		[TRAINING_SLOT_TYPE.PLATE] = canDropSlotPlate,
		[TRAINING_SLOT_TYPE.BOOST] = canDropSlotBoost
	}

	return dropItemCallbacks[slotType](focusedChild.slot, item)
end

function onClearSlotPokeball()
	slotTypeItem[TRAINING_SLOT_TYPE.POKEBALL] = nil

	updatePercent()
	selectedPanel.slotPokeball:clearItem()
	selectedPanel.slotPokeball:removeTooltip()
	selectedPanel.levelProgress:setPercent(0)
	selectedPanel.levelProgress:removeTooltip()
	selectedPanel.pokemonLevel:setText("Lv. 0")
	selectedPanel.countPlateLabel:setText("/0")
end

function onClearSlotPlate()
	slotTypeItem[TRAINING_SLOT_TYPE.PLATE] = nil

	updatePercent()
	selectedPanel.slotPlate:clearItem()
	selectedPanel.slotPlate:removeTooltip()
	selectedPanel.countPlayerLabel:setText("0")
end

function onClearSlotBoost()
	slotTypeItem[TRAINING_SLOT_TYPE.BOOST] = nil

	updatePercent()
	selectedPanel.slotBoost:clearItem()
	selectedPanel.slotBoost:removeTooltip()
end

function updatePercent()
	local focusedChild = trainingList:getFocusedChild()

	if not focusedChild then
		return false
	end

	local slot = focusedChild.slot

	if not slot then
		return false
	end

	local trainerElement = getTrainingElement(slot)
	local hasCommomElement = table.contains({
		ELEMENTS.NEUTRAL
	}, trainerElement)
	local pokemonElements = {}
	local percent = 0
	local pokeballItem = slotTypeItem[TRAINING_SLOT_TYPE.POKEBALL]

	if pokeballItem then
		pokemonElements = getPokemonElements(pokeballItem:getPokemon())
		percent = 25

		if table.contains(pokemonElements, trainerElement) then
			percent = 45
		end
	end

	local plateItem = slotTypeItem[TRAINING_SLOT_TYPE.PLATE]

	if plateItem then
		local plateElement = getPlateElement(plateItem) or getShinyPlateElement(plateItem)
		local hasPlateElement = table.contains(pokemonElements, plateElement)

		if not hasCommomElement and plateElement ~= trainerElement then
			percent = percent - 20
		end

		if hasPlateElement then
			percent = percent + 25
		end

		if not hasPlateElement then
			percent = 0
		end
	end

	local boostItem = slotTypeItem[TRAINING_SLOT_TYPE.BOOST]

	if boostItem and (not hasCommomElement or getBoostElement(boostItem) == trainerElement) then
		percent = percent + 30
	end

	local isEnabledStart = pokeballItem and plateItem and focusedChild.slot.isUnlocked and focusedChild.slot.cooldown < 1
	local coloredPercent = percent < 1 and "#FFFFF" or percent < 51 and "#DE8407" or "#39ED69"

	selectedPanel.startButton:setEnabled(isEnabledStart)
	selectedPanel.percentLabel:setMultiColorText(tr("Training\nSucess rate:\n{%s|%d%%}", coloredPercent, percent))
end
