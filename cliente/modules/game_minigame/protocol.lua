-- chunkname: @/modules/game_minigame/protocol.lua

local PokemonMiniGameOpcode = 207
local Actions = {
	Breeder = 3,
	Designer = 2,
	Photographer = 1,
	Researcher = 4
}
local protocolGame

local function onGameStart()
	protocolGame = g_game.getProtocolGame()
end

local function onGameEnd()
	protocolGame = nil
end

local function sendAction(action, data)
	if protocolGame then
		protocolGame:sendExtendedJSONOpcode(PokemonMiniGameOpcode, {
			action = action,
			data = data
		})
	end
end

local function parsePhotographer(params)
	signalcall(PhotographerGame.onPhotographer, params)
end

local function parseDesigner(params)
	signalcall(DesignerGame.onDesigner, params)
end

local function parseBreeder(params)
	signalcall(BreederGame.onBreeder, params)
end

local function parseResearcher(params)
	signalcall(ResearcherGame.onResearcher, params)
end

function sendGameAction(minigameId, action, data)
	local miniGameData = {
		minigameId = minigameId,
		data = data
	}

	sendAction(action, miniGameData)
end

local ActionParser = {
	[Actions.Photographer] = parsePhotographer,
	[Actions.Designer] = parseDesigner,
	[Actions.Breeder] = parseBreeder,
	[Actions.Researcher] = parseResearcher
}

function parseAction(protocol, opcode, jsonData)
	local parser = ActionParser[jsonData.action]

	if parser then
		parser(jsonData.data)
	end
end

function initProtocol()
	ProtocolGame.registerExtendedJSONOpcode(PokemonMiniGameOpcode, parseAction)
	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})

	if g_game.isOnline() then
		onGameStart()
	end
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedJSONOpcode(PokemonMiniGameOpcode)
	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end
