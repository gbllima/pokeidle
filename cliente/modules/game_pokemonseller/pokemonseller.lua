-- chunkname: @/modules/game_pokemonseller/pokemonseller.lua

local window
local protocol = runinsandbox("protocol")
local maxStarCount = 5
local sellConfirmBox

local function onGameEnd()
	destroyWindow()
end

function onDragEnter(item, mousePos)
	if not window or #item:getPokemon() == 0 then
		return
	end

	if window.pokemonItem:getItem() == item then
		cleanUpSellInfo()
	end

	showDragArea()
end

function onDragLeave(item, droppedWidget, mousePos)
	if not window then
		return
	end

	hideDragArea()

	local targetWidget = rootWidget:recursiveGetChildByPos(mousePos)

	if targetWidget ~= window.dragArea and targetWidget ~= window then
		return
	end

	if #item:getPokemon() > 0 then
		setPokemonToSell(item)
	end
end

function showWindow(npcName)
	if window then
		window:raise()
		window:show()

		return
	end

	window = g_ui.displayUI("pokemonseller")

	window:onVisibilityChange(true)
	window:setText(npcName)
end

function destroyWindow()
	if window then
		window:destroy()

		window = nil
	end

	destroyConfirmationBox()
end

function destroyConfirmationBox()
	if sellConfirmBox then
		sellConfirmBox:destroy()

		sellConfirmBox = nil
	end
end

function setPokemonToSell(item)
	window.pokemonItem:setItem(item)
	window.pokemonItemIcon:show()
	window.descriptionLabel:hide()

	if not item then
		return
	end

	protocol.sendQuerySellInfo(item)
end

function setupSellInfo(pokemonName, starCount, price)
	window.starsLabel:show()
	window.priceConstLabel:show()
	window.pokemonNameConstLabel:show()
	window.pokemonNameLabel:setText(pokemonName)
	window.pokemonNameLabel:show()
	window.priceLabel:show()
	window.priceLabel:setText("$" .. formatMoney(price))
	window.starsPanel:show()
	window.sellButton:enable()
	window.starsPanel:destroyChildren()

	local blackStarCount = maxStarCount - starCount

	if blackStarCount > 0 then
		for i = 1, blackStarCount do
			g_ui.createWidget("StarIcon", window.starsPanel):disable()
		end
	end

	for i = 1, starCount do
		g_ui.createWidget("StarIcon", window.starsPanel)
	end
end

function cleanUpSellInfo()
	window.descriptionLabel:show()
	window.pokemonItem:clearItem()
	window.pokemonItemIcon:hide()
	window.starsLabel:hide()
	window.priceConstLabel:hide()
	window.pokemonNameConstLabel:hide()
	window.pokemonNameLabel:hide()
	window.priceLabel:hide()
	window.starsPanel:hide()
	window.sellButton:disable()
end

function showDragArea()
	window.dragArea:show()
end

function hideDragArea()
	window.dragArea:hide()
end

function sell()
	window.sellButton:disable()

	local description = ("Tem certeza que quer vender seu pok\xE9mon %s?"):format(window.pokemonNameLabel:getText())

	destroyConfirmationBox()

	sellConfirmBox = displayConfirmBox(window:getText(), description, function()
		protocol.sendSell(window.pokemonItem:getItem())
		window.sellButton:enable()

		sellConfirmBox = nil
	end, function()
		window.sellButton:enable()

		sellConfirmBox = nil
	end)
end

function cancel()
	destroyWindow()
end

function init()
	protocol.initProtocol()
	connect(g_game, {
		onGameEnd = onGameEnd
	})
end

function terminate()
	destroyWindow()
	protocol.terminateProtocol()
	disconnect(g_game, {
		onGameEnd = onGameEnd
	})
end
