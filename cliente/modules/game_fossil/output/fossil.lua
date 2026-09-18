-- chunkname: @/modules/game_fossil/fossil.lua

local window, windowConfirm, windowPosition
local SLOT_TYPE = {
	FOSSIL_TWO = 2,
	FOSSIL_ONE = 1
}
local FOSSIL_ITEM = {
	DOME = 11910,
	DINO = 26135,
	DRAKE = 26136,
	FISH = 26134,
	BIRD = 26133,
	JAW = 26139,
	SAIL = 26138,
	COVER = 26137,
	PLUME = 26140,
	ARMOR = 26142,
	SKULL = 26141,
	CLAW = 26143,
	ROOT = 26144,
	OLD_AMBER = 11912,
	HELIX = 11911
}
local ExtendsOpcode = {
	ParseFossil = 2,
	Fossil = 200,
	ParseOpen = 1,
	SendRevive = 4,
	SendFossil = 3
}
local slotData = {
	[SLOT_TYPE.FOSSIL_ONE] = -1,
	[SLOT_TYPE.FOSSIL_TWO] = -1
}

local function capitalize(str)
	return str:gsub("^%l", string.upper)
end

local function sendAction(action, data)
	local protocolGame = g_game.getProtocolGame()

	if protocolGame then
		protocolGame:sendExtendedJSONOpcode(ExtendsOpcode.Fossil, {
			action = action,
			data = data
		})
	end
end

local function sendSlotFossil(slotType, item)
	slotData[slotType] = item:getId()

	sendAction(ExtendsOpcode.SendFossil, slotData)
end

local function sendReviveFossil(pokemonName)
	sendAction(ExtendsOpcode.SendRevive, pokemonName)
end

local function parseOpen()
	onGameEnd()

	window = g_ui.createWidget("FossilMachine", rootWidget)

	window:onVisibilityChange(true)
end

local function parseFossil(params)
	local pokemonImage = window.pokemonImage
	local reviveButton = window.reviveButton
	local priceLabel = window.priceLabel
	local nameLabel = window.nameLabel
	local dnaItem = window.dnaItem
	local countLabel = window.countLabel
	local elementList = window.elementList
	local hasPlayerDnaItem = params.dnaSample.player >= params.dnaSample.count
	local elementWidth = 0

	for i, element in pairs(params.elements) do
		local correctElementName = capitalize(element)
		local elementUI = g_ui.createWidget(string.format("Element%sIcon-24px", correctElementName), elementList)

		elementUI:setTooltip(correctElementName)

		elementWidth = elementWidth + elementUI:getWidth() + elementUI:getMarginLeft()
	end

	countLabel:setOn(hasPlayerDnaItem)
	elementList:setWidth(elementWidth)
	nameLabel:setText(params.pokemonName)
	reviveButton:setEnabled(hasPlayerDnaItem)
	dnaItem:setItemId(params.dnaSample.itemId)
	countLabel:setText(params.dnaSample.count)
	priceLabel:setText(formatMoney(params.price))
	pokemonImage:setImageSource(getPokemonImage(params.pokemonName))
end

local function parseOpcode(protocol, opcode, jsonData)
	local parseOpcodeCallbacks = {
		[ExtendsOpcode.ParseOpen] = parseOpen,
		[ExtendsOpcode.ParseFossil] = parseFossil
	}
	local executeAction = parseOpcodeCallbacks[jsonData.action]

	if executeAction then
		executeAction(jsonData.data)
	end
end

function init()
	connect(g_game, {
		onGameEnd = onGameEnd
	})
	connect(LocalPlayer, {
		onPositionChange = onFossilPositionChange
	})
	ProtocolGame.registerExtendedJSONOpcode(ExtendsOpcode.Fossil, parseOpcode)
	g_ui.importStyle("fossil")
end

function terminate()
	disconnect(g_game, {
		onGameEnd = onGameEnd
	})
	disconnect(LocalPlayer, {
		onPositionChange = onFossilPositionChange
	})
	ProtocolGame.unregisterExtendedJSONOpcode(ExtendsOpcode.Fossil)
	onGameEnd()
end

function onGameEnd()
	slotData = {
		[SLOT_TYPE.FOSSIL_ONE] = -1,
		[SLOT_TYPE.FOSSIL_TWO] = -1
	}

	if windowConfirm then
		windowConfirm:destroy()

		windowConfirm = nil
	end

	if window then
		window:destroy()

		window = nil
	end
end

function onFossilPositionChange()
	if window then
		onGameEnd()
	end
end

function onClearSlot(widget)
	if not widget:getItem() then
		return
	end

	windowPosition = window:getPosition()

	parseOpen()
	window:breakAnchors()
	window:setPosition(windowPosition)
end

function onDropSlot(slot, widget, mousePos)
	if widget:getClassName() == "UIItem" and widget:getItem() and table.contains(FOSSIL_ITEM, widget:getItem():getId()) then
		local item = widget:getItem()

		slot:setItem(item)
		sendSlotFossil(slot:getParent().slotType, item)

		return true
	end

	return false
end

function revivePokemon()
	local pokemonName = window.nameLabel:getText()

	if pokemonName ~= "???" then
		windowConfirm = displayConfirmBox(tr("Confirm"), tr("Do you really want to revive this fossil?"), function()
			sendReviveFossil(pokemonName)
		end)
	end
end
