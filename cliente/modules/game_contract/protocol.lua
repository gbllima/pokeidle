-- chunkname: @/modules/game_contract/protocol.lua

local PokemonPoliceOperationOpcode = 89
local Actions = {
	Machine = 7,
	Difficulty = 6,
	Finish = 5,
	Start = 4,
	Reset = 3,
	Info = 2,
	Open = 1,
	Token = 8
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
		protocolGame:sendExtendedJSONOpcode(PokemonPoliceOperationOpcode, {
			action = action,
			data = data
		})
	end
end

function sendStart(npcName)
	sendAction(Actions.Start, npcName)
end

function sendFinish(npcName)
	sendAction(Actions.Finish, npcName)
end

function sendDifficulty(difficulty)
	sendAction(Actions.Difficulty, difficulty)
end

function sendToken(option)
	sendAction(Actions.Token, option)
end

local function parseOpen(params)
	table.sort(params, function(a, b)
		return a.cityId < b.cityId
	end)
	signalcall(PoliceOperation.onOpenPhone, params)
end

local function parseReset()
	signalcall(PoliceOperation.onResetPhone)
end

local function parseInfo(params)
	signalcall(PoliceOperation.onInformationPhone, params.difficulty, params.playerDifficulty, params.weeklyCount, params.totalCount, params.legendaryCount)
end

local function parseMachine()
	signalcall(PoliceOperation.onOpenMachine)
end

local ActionParser = {
	[Actions.Open] = parseOpen,
	[Actions.Info] = parseInfo,
	[Actions.Reset] = parseReset,
	[Actions.Machine] = parseMachine
}

local function parseAction(protocol, opcode, jsonData)
	local parser = ActionParser[jsonData.action]

	if parser then
		parser(jsonData.data)
	end
end

function initProtocol()
	ProtocolGame.registerExtendedJSONOpcode(PokemonPoliceOperationOpcode, parseAction)
	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})

	if g_game.isOnline() then
		onGameStart()
	end
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedJSONOpcode(PokemonPoliceOperationOpcode)
	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end
