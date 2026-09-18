-- chunkname: @/modules/game_starboost/starBoost.lua

StarBoost = {}

local starBoostWindow, lastPosition
local protocol = runinsandbox("protocol")

local function capitalize(str)
	return str:gsub("^%l", string.upper)
end

local function onOpen()
	onOffline()

	starBoostWindow = g_ui.createWidget("StarBoostWindow", rootWidget)

	starBoostWindow:onVisibilityChange(true)
end

local function onMessage(message)
	if not starBoostWindow then
		return
	end

	local messageLabel = starBoostWindow.messageLabel

	removeEvent(messageLabel.event)
	messageLabel:setMultiColorText(message)

	messageLabel.event = scheduleEvent(function()
		messageLabel:clearText()
	end, 6000)
end

local function onPokemon(params)
	if not starBoostWindow then
		return
	end

	local pokemonNameLabel = starBoostWindow.pokemonNameLabel
	local pokemonImage = starBoostWindow.pokemonImage
	local pokemonElements = starBoostWindow.pokemonElements
	local starList = starBoostWindow.starList
	local requiredList = starBoostWindow.requiredList
	local upgradeButton = starBoostWindow.upgradeButton
	local elementList = starBoostWindow.elementList

	pokemonNameLabel:setText(params.pokemonName)
	pokemonImage:setImageSource(getPokemonImage(params.pokemonName))

	for star = 1, 5 do
		starList[star]:setOn(star <= params.star)
	end

	requiredList:destroyChildren()
	elementList:destroyChildren()

	local hasItem = true

	for i, requiredItem in pairs(params.stones) do
		local itemUI = g_ui.createWidget("StarBoostRequiredItem", requiredList)
		local item = Item.create(requiredItem.itemId)
		local hasPlayerItem = requiredItem.player >= requiredItem.count

		if not hasPlayerItem then
			hasItem = false
		end

		item:setTooltip(requiredItem.name)
		itemUI:setItem(item)
		itemUI.count:setOn(hasPlayerItem)
		itemUI.count:setText(requiredItem.count)
	end

	local elementWidth = 0

	for i, element in pairs(params.elements) do
		local correctElementName = capitalize(element)
		local elementUI = g_ui.createWidget(string.format("Element%sIcon-24px", correctElementName), elementList)

		elementUI:setTooltip(correctElementName)

		elementWidth = elementWidth + elementUI:getWidth() + elementUI:getMarginLeft()
	end

	local canUpgrade = params.star < 5 and hasItem
	local widthRequiredList = #params.stones * 34

	elementList:setWidth(elementWidth)
	upgradeButton:setEnabled(canUpgrade)
	requiredList:setWidth(widthRequiredList)
end

function onOffline()
	if starBoostWindow then
		starBoostWindow:destroy()

		starBoostWindow = nil
	end
end

function onClearSlot()
	lastPosition = starBoostWindow:getPosition()

	onOpen()
	starBoostWindow:breakAnchors()
	starBoostWindow:setPosition(lastPosition)
end

function onDropSlotItem(self, widget, mousePos, forced)
	local className = widget:getClassName()

	if className ~= "UIItem" then
		return false
	end

	local item = widget:getItem()

	if not item or not (item:getPokemon():len() > 1) then
		return false
	end

	self:setItem(item)
	protocol.sendPokemon(item)

	return true
end

function onInit()
	protocol.initProtocol()
	connect(g_game, {
		onGameEnd = onOffline
	})
	connect(LocalPlayer, {
		onPositionChange = onOffline
	})
	connect(StarBoost, {
		onOpen = onOpen,
		onMessage = onMessage,
		onPokemon = onPokemon
	})
	g_ui.importStyle("starBoost")
end

function onTerminate()
	protocol.terminateProtocol()
	disconnect(g_game, {
		onGameStart = onOnline,
		onGameEnd = onOffline
	})
	disconnect(LocalPlayer, {
		onPositionChange = onOffline
	})
	disconnect(StarBoost, {
		onOpen = onOpen,
		onMessage = onMessage,
		onPokemon = onPokemon
	})
	onOffline()
end

function onUpgrade()
	if not starBoostWindow then
		return
	end

	local item = starBoostWindow.pokemonItem:getItem()

	if item and starBoostWindow.upgradeButton:isEnabled() then
		protocol.sendUpgrade(item)
	end
end
