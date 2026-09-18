-- chunkname: @/modules/game_pokemonseller/protocol.lua

local PokemonSellerOpcode = 103
local Actions = {
	Show = 1,
	Sell = 5,
	ResetSellInfo = 4,
	QuerySellInfo = 3,
	Hide = 2
}
local protocolGame

local function onGameStart()
	protocolGame = g_game.getProtocolGame()
end

local function onGameEnd()
	protocolGame = nil
end

local function parseShowAction(data)
	showWindow(data.npcName)
end

local function parseHideAction(data)
	destroyWindow()
end

local function parseQuerySellInfo(data)
	setupSellInfo(data.pokemonName, data.stars, data.price)
end

local function parseResetSellInfo()
	cleanUpSellInfo()
end

local function sendAction(action, data)
	if protocolGame then
		protocolGame:sendExtendedJSONOpcode(PokemonSellerOpcode, {
			action = action,
			data = data
		})
	end
end

function sendSell(item)
	local data = {
		spriteId = item:getId(),
		position = item:getPosition(),
		stackpos = item:getStackPos()
	}

	sendAction(Actions.Sell, data)
end

function sendQuerySellInfo(item)
	local data = {
		spriteId = item:getId(),
		position = item:getPosition(),
		stackpos = item:getStackPos()
	}

	sendAction(Actions.QuerySellInfo, data)
end

local ActionParser = {
	[Actions.Show] = parseShowAction,
	[Actions.Hide] = parseHideAction,
	[Actions.QuerySellInfo] = parseQuerySellInfo,
	[Actions.ResetSellInfo] = parseResetSellInfo
}

local function parseAction(protocol, opcode, jsonData)
	local parser = ActionParser[jsonData.action]

	if parser then
		parser(jsonData.data)
	end
end

function initProtocol()
	ProtocolGame.registerExtendedJSONOpcode(PokemonSellerOpcode, parseAction)
	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedJSONOpcode(PokemonSellerOpcode)
	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end
