-- chunkname: @/modules/game_starboost/protocol.lua

local PokemonStarBoostOpcode = 99
local Actions = {
	Pokemon = 3,
	Message = 2,
	Open = 1,
	Upgrade = 5
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
		protocolGame:sendExtendedJSONOpcode(PokemonStarBoostOpcode, {
			action = action,
			data = data
		})
	end
end

function sendPokemon(item)
	local data = {
		spriteId = item:getId(),
		position = item:getPosition(),
		stackpos = item:getStackPos()
	}

	sendAction(Actions.Pokemon + 1, data)
end

function sendUpgrade(item)
	local data = {
		spriteId = item:getId(),
		position = item:getPosition(),
		stackpos = item:getStackPos()
	}

	sendAction(Actions.Upgrade, data)
end

local function parseOpen()
	signalcall(StarBoost.onOpen)
end

local function parseMessage(message)
	signalcall(StarBoost.onMessage, message)
end

local function parsePokemon(params)
	signalcall(StarBoost.onPokemon, params)
end

local ActionParser = {
	[Actions.Open] = parseOpen,
	[Actions.Message] = parseMessage,
	[Actions.Pokemon] = parsePokemon
}

local function parseAction(protocol, opcode, jsonData)
	local parser = ActionParser[jsonData.action]

	if parser then
		parser(jsonData.data)
	end
end

function initProtocol()
	ProtocolGame.registerExtendedJSONOpcode(PokemonStarBoostOpcode, parseAction)
	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})

	if g_game.isOnline() then
		onGameStart()
	end
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedJSONOpcode(PokemonStarBoostOpcode)
	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end
