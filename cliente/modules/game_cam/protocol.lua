-- chunkname: @/modules/game_cam/protocol.lua

local PokemonCamOpcode = 209
local FollowCreature = 55
local Actions = {
	Create = 1,
	Name = 7,
	Watch = 9,
	Views = 8,
	Control = 6,
	Leave = 5,
	Update = 4,
	List = 3,
	Close = 2
}
local lastTimeAction = 0

local function onGameStart()
	protocolGame = g_game.getProtocolGame()
end

local function onGameEnd()
	protocolGame = nil
end

local function sendAction(action, data)
	local timeNow = os.time()

	if protocolGame and timeNow > lastTimeAction then
		lastTimeAction = timeNow + 0.8

		protocolGame:sendExtendedJSONOpcode(PokemonCamOpcode, {
			action = action,
			data = data
		})
	end
end

local function parseCreate(params)
	signalcall(PokemonCam.onCreate, params)
end

local function onClose(params)
	signalcall(PokemonCam.onClose)
end

local function parseList(params)
	signalcall(PokemonCam.onList, params)
end

local function parseUpdate(params)
	signalcall(PokemonCam.onUpdate, params)
end

local function parseLeave(params)
	signalcall(PokemonCam.onLeave)
end

function sendNext()
	g_game.talkChannel(MessageModes.None, 0, "!tvnext")
end

function sendPrev()
	g_game.talkChannel(MessageModes.None, 0, "!tvprev")
end

function sendShowSpectators()
	sendAction(Actions.Views, {})
end

function sendChangeName(name)
	sendAction(Actions.Name, name)
end

function sendWatchCam(channelId)
	sendAction(Actions.Watch, channelId)
end

local ActionParser = {
	[Actions.Create] = parseCreate,
	[Actions.Close] = parseClose,
	[Actions.List] = parseList,
	[Actions.Update] = parseUpdate,
	[Actions.Leave] = parseLeave
}

local function parseAction(protocol, opcode, jsonData)
	local parser = ActionParser[jsonData.action]

	if parser then
		parser(jsonData.data)
	end
end

local function parseFollowCreature(protocol, msg)
	local mType = msg:getU8()
	local creatureId = msg:getU32()
	local map = modules.game_interface.getMapPanel()

	if creatureId == 0 then
		if mType == 0 then
			_G.followCreatureMode = false
		else
			modules.game_tv.setWatchingTv(false)
			signalcall(PokemonCam.onWatching, false)
		end

		modules.game_tv.unlockWalk()
		map:followCreature(g_game.getLocalPlayer())
	else
		local followCreature = g_map.getCreatureById(creatureId)

		if followCreature then
			if mType == 0 then
				_G.followCreatureMode = true
			else
				modules.game_tv.setWatchingTv(true)
				signalcall(PokemonCam.onWatching, true)
			end

			modules.game_tv.lockWalk()
			map:followCreature(followCreature)
		end
	end
end

function initProtocol()
	ProtocolGame.registerExtendedJSONOpcode(PokemonCamOpcode, parseAction)
	ProtocolGame.registerOpcode(FollowCreature, parseFollowCreature)
	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})

	if g_game.isOnline() then
		onGameStart()
	end
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedJSONOpcode(PokemonCamOpcode)
	ProtocolGame.unregisterOpcode(FollowCreature)
	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end
