-- chunkname: @/modules/game_helds/protocol.lua

local PokemonHeldsOpcode = 204
local Actions = {
	Helds = 3,
	Fragmentation = 4,
	Improviments = 5,
	Clear = 2,
	Open = 1
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
		protocolGame:sendExtendedJSONOpcode(PokemonHeldsOpcode, {
			action = action,
			data = data
		})
	end
end

function sendHeld(forgeType, item)
	local data = {
		spriteId = item:getId(),
		position = item:getPosition(),
		stackpos = item:getStackPos(),
		forge = forgeType
	}

	sendAction(Actions.Helds, data)
end

function sendFragmentation(forgeType, item)
	local data = {
		spriteId = item:getId(),
		position = item:getPosition(),
		stackpos = item:getStackPos(),
		forge = forgeType
	}

	sendAction(Actions.Fragmentation, data)
end

function sendImproviments(forgeType, item)
	local data = {
		spriteId = item:getId(),
		position = item:getPosition(),
		stackpos = item:getStackPos(),
		forge = forgeType
	}

	sendAction(Actions.Improviments, data)
end

local function parseOpen(params)
	signalcall(Helds.onOpen, params)
end

local function parseClear()
	signalcall(Helds.onClear)
end

local function parseHelds(params)
	signalcall(Helds.onHeld, params)
end

local ActionParser = {
	[Actions.Open] = parseOpen,
	[Actions.Clear] = parseClear,
	[Actions.Helds] = parseHelds
}

local function parseAction(protocol, opcode, jsonData)
	local parser = ActionParser[jsonData.action]

	if parser then
		parser(jsonData.data)
	end
end

function initProtocol()
	ProtocolGame.registerExtendedJSONOpcode(PokemonHeldsOpcode, parseAction)
	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})

	if g_game.isOnline() then
		onGameStart()
	end
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedJSONOpcode(PokemonHeldsOpcode)
	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end
