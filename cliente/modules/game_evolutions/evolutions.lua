local evolutionWindow
local ExtendsOpcode = {
	Evolution = 63,
	SendOpen = 2,
	SendEvolution = 3,
	ParseData = 1
}

local function canRequestEnvolve(pokemon)
	for i, item in pairs(pokemon.requiredItems) do
		if item.playerCount < item.count then
			return string.format("Voc\xEA precisa de %dx %s para evoluir o pokemon.", item.count - item.playerCount, item.name)
		end
	end

	return nil
end

function parseData(data)
	if evolutionWindow and not evolutionWindow:isHidden() then
		return
	end

	offline()

	evolutionWindow = g_ui.displayUI("evolutions")

	for i, pokemon in pairs(data) do
		local panel = g_ui.createWidget("EvolutionPanel", evolutionWindow.list)

		panel.pokemon = pokemon

		panel.name:setText(pokemon.name)
		panel.image:setImageSource(getPokemonPortrait(pokemon.name))
		panel.level:setText(tr("Level: %d", pokemon.requiredLevel))

		for i, item in pairs(pokemon.requiredItems) do
			local stone = g_ui.createWidget("EvolutionStone", panel.stones)
			local tmpItem = Item.create(item.clientId)
			local hasItem = item.playerCount >= item.count

			tmpItem:setTooltip(tr("%s (%sx).", item.name, item.count))
			stone:setItem(tmpItem)
			stone.count:setText(item.count)
			stone.count:setOn(hasItem)
			panel.stones:addChildReverse(stone)
		end
	end
end

function sendAction(action, data)
	local protocolGame = g_game.getProtocolGame()

	if protocolGame then
		protocolGame:sendExtendedJSONOpcode(ExtendsOpcode.Evolution, {
			action = action,
			data = data
		})
	end
end

function requestOpen()
	sendAction(ExtendsOpcode.SendOpen, {})
end

function requestEnvolvePokemon()
	local focusedChild = evolutionWindow.list:getFocusedChild()

	if focusedChild then
		local result = canRequestEnvolve(focusedChild.pokemon)

		if result then
			displayInfoBox(evolutionWindow:getText(), result)

			return
		end

		sendAction(ExtendsOpcode.SendEvolution, focusedChild.pokemon.name)
		offline()
	end
end

local parseOpcodesCallbacks = {
	[ExtendsOpcode.ParseData] = parseData
}

local function parseOpcode(protocol, opcode, json_data)
	local executeAction = parseOpcodesCallbacks[json_data.action]

	if executeAction then
		executeAction(json_data.data)
	end
end

function init()
	connect(g_game, {
		onGameEnd = offline
	})
	ProtocolGame.registerExtendedJSONOpcode(ExtendsOpcode.Evolution, parseOpcode)
end

function terminate()
	disconnect(g_game, {
		onGameEnd = offline
	})
	ProtocolGame.unregisterExtendedJSONOpcode(ExtendsOpcode.Evolution)
	offline()
end

function offline()
	if evolutionWindow then
		evolutionWindow:destroy()

		evolutionWindow = nil
	end
end
