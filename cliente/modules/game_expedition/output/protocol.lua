-- chunkname: @/modules/game_expedition/protocol.lua

local PokemonExpeditionsOpcode = 206
local Actions = {
	Leave = 2,
	Travel = 4,
	Open = 1,
	Buy = 3
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
		protocolGame:sendExtendedJSONOpcode(PokemonExpeditionsOpcode, {
			action = action,
			data = data
		})
	end
end

function sendBuy()
	sendAction(Actions.Buy, 1)
end

function sendTravel(id)
	sendAction(Actions.Travel, id)
end

function sendLeave(id)
	sendAction(Actions.Leave, id)
end

local function parseOpen(params)
	signalcall(Expeditions.onOpen, params)
end

local function parseLeave(params)
	signalcall(Expeditions.onLeave, params.id, params.name)
end

local ActionParser = {
	[Actions.Open] = parseOpen,
	[Actions.Leave] = parseLeave
}

local function parseAction(protocol, opcode, jsonData)
	local parser = ActionParser[jsonData.action]

	if parser then
		parser(jsonData.data)
	end
end

function initProtocol()
	ProtocolGame.registerExtendedJSONOpcode(PokemonExpeditionsOpcode, parseAction)
	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})

	if g_game.isOnline() then
		onGameStart()
	end
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedJSONOpcode(PokemonExpeditionsOpcode)
	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end
