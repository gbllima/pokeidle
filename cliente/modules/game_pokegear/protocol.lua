-- chunkname: @/modules/game_pokegear/protocol.lua

local PokemonPokeGearOpcode = 205
local Actions = {
	Open = 1,
	Claim = 2
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
		protocolGame:sendExtendedJSONOpcode(PokemonPokeGearOpcode, {
			action = action,
			data = data
		})
	end
end

function sendClaim(npcName)
	sendAction(Actions.Claim, npcName)
end

local function parseOpen(params)
	signalcall(PokeGear.onOpen, params)
end

local ActionParser = {
	[Actions.Open] = parseOpen
}

local function parseAction(protocol, opcode, jsonData)
	local parser = ActionParser[jsonData.action]

	if parser then
		parser(jsonData.data)
	end
end

function initProtocol()
	ProtocolGame.registerExtendedJSONOpcode(PokemonPokeGearOpcode, parseAction)
	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})

	if g_game.isOnline() then
		onGameStart()
	end
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedJSONOpcode(PokemonPokeGearOpcode)
	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end
