-- chunkname: @/modules/game_twitchdrops/protocol.lua

local PokemonTwitchDropsOpcode = 202
local Actions = {
	Redeem = 2,
	Points = 1
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
		protocolGame:sendExtendedJSONOpcode(PokemonTwitchDropsOpcode, {
			action = action,
			data = data
		})
	end
end

local function parsePoints(params)
	signalcall(TwitchDrops.onPoints, params.points)
end

function sendRedeem()
	sendAction(Actions.Redeem, 1)
end

local ActionParser = {
	[Actions.Points] = parsePoints
}

local function parseAction(protocol, opcode, jsonData)
	local parser = ActionParser[jsonData.action]

	if parser then
		parser(jsonData.data)
	end
end

function initProtocol()
	ProtocolGame.registerExtendedJSONOpcode(PokemonTwitchDropsOpcode, parseAction)
	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})

	if g_game.isOnline() then
		onGameStart()
	end
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedJSONOpcode(PokemonTwitchDropsOpcode)
	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end
