-- chunkname: @/modules/game_scout/protocol.lua

local PokemonScoutOpcode = 83
local Actions = {
	EntryDungeon = 11,
	Rewards = 10,
	TrackerRemove = 9,
	Tracker = 8,
	Rank = 7,
	Panel = 1,
	Cancel = 5,
	Finish = 6,
	Start = 4,
	Reset = 3,
	Info = 2,
	AddBatery = 13,
	GemShop = 12
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
		protocolGame:sendExtendedJSONOpcode(PokemonScoutOpcode, {
			action = action,
			data = data
		})
	end
end

local function parsePanel(params)
	signalcall(ScoutClub.onPanelShow, params)
end

local function parseInfo(params)
	signalcall(ScoutClub.onInfoPanel, params)
end

local function parseReset()
	signalcall(ScoutClub.onResetPanel)
end

local function parseTracker(params)
	signalcall(ScoutClub.onTrackerKill, params)
end

local function parseTrackerRemove(params)
	signalcall(ScoutClub.onTrackerRemove, params)
end

local function parseRewards(params)
	signalcall(ScoutClub.onRewards, params)
end

local function parseEntryDungeon(params)
	signalcall(ScoutClub.onEntryDungeon, params)
end

local function parseGemShop(params)
	signalcall(ScoutClub.onGemShop, params)
end

function sendStart(pokemonName, battery)
	sendAction(Actions.Start, {
		pokemonName = pokemonName,
		battery = battery
	})
end

function sendFinish(pokemonName, battery)
	sendAction(Actions.Finish, {
		pokemonName = pokemonName,
		battery = battery
	})
end

function sendCancel(pokemonName, battery)
	sendAction(Actions.Cancel, {
		pokemonName = pokemonName,
		battery = battery
	})
end

function sendRank(rankId)
	sendAction(Actions.Rank, rankId)
end

function sendChooseReward(rewardId, count)
	sendAction(Actions.Rewards, {
		rewardId = rewardId,
		count = count
	})
end

function sendEntryDungeon(dungeonId)
	sendAction(Actions.EntryDungeon, dungeonId)
end

function sendChooseGemShop(gemId)
	sendAction(Actions.GemShop, gemId)
end

function sendBattery(battery, transmissor, count)
	local batteryItem = {
		spriteId = battery:getId(),
		pos = battery:getPosition(),
		stackpos = battery:getStackPos()
	}
	local transmissorItem = {
		spriteId = transmissor:getId(),
		pos = transmissor:getPosition(),
		stackpos = transmissor:getStackPos()
	}

	sendAction(Actions.AddBatery, {
		battery = batteryItem,
		transmissor = transmissorItem,
		count = count
	})
end

local ActionParser = {
	[Actions.Panel] = parsePanel,
	[Actions.Info] = parseInfo,
	[Actions.Reset] = parseReset,
	[Actions.Tracker] = parseTracker,
	[Actions.TrackerRemove] = parseTrackerRemove,
	[Actions.Rewards] = parseRewards,
	[Actions.EntryDungeon] = parseEntryDungeon,
	[Actions.GemShop] = parseGemShop
}

local function parseAction(protocol, opcode, jsonData)
	local parser = ActionParser[jsonData.action]

	if parser then
		parser(jsonData.data)
	end
end

function initProtocol()
	ProtocolGame.registerExtendedJSONOpcode(PokemonScoutOpcode, parseAction)
	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})

	if g_game.isOnline() then
		onGameStart()
	end
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedJSONOpcode(PokemonScoutOpcode)
	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end
