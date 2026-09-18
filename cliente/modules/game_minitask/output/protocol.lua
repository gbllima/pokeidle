-- chunkname: @/modules/game_minitask/protocol.lua

local PokemonMiniTaskOpcode = 203
local Actions = {
	Cancel = 5,
	Start = 2,
	Generate = 4,
	End = 3,
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
		protocolGame:sendExtendedJSONOpcode(PokemonMiniTaskOpcode, {
			action = action,
			data = data
		})
	end
end

function sendStart(npcName)
	sendAction(Actions.Start, npcName)
end

function sendEnd(npcName)
	sendAction(Actions.End, npcName)
end

function sendCancel(npcName)
	sendAction(Actions.Cancel, npcName)
end

function sendGenerateMission(npcName)
	sendAction(Actions.Generate, npcName)
end

local function parseOpen(params)
	signalcall(MiniTask.onOpen, params)
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
	ProtocolGame.registerExtendedJSONOpcode(PokemonMiniTaskOpcode, parseAction)
	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})

	if g_game.isOnline() then
		onGameStart()
	end
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedJSONOpcode(PokemonMiniTaskOpcode)
	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end
