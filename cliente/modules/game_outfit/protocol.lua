-- chunkname: @/modules/game_outfit/protocol.lua

local Opcodes = {
	Title = {
		Request = 54,
		Set = 55
	},
	NameEffect = {
		Request = 56,
		Set = 57
	}
}

local protocolGame

local function onGameStart()
	protocolGame = g_game.getProtocolGame()
end

local function onGameEnd()
	protocolGame = nil
end

function sendChooseTitle(titleId)
	if protocolGame then
		protocolGame:sendExtendedOpcode(Opcodes.Title.Set, tostring(titleId))
	end
end

function sendChooseNameEffect(nameEffectId)
	if protocolGame then
		protocolGame:sendExtendedOpcode(Opcodes.NameEffect.Set, tostring(nameEffectId))
	end
end

local function requestTitles()
	if protocolGame then
		protocolGame:sendExtendedOpcode(Opcodes.Title.Request, "")
	end
end

local function requestNameEffects()
	if protocolGame then
		protocolGame:sendExtendedOpcode(Opcodes.NameEffect.Request, "")
	end
end

local function parseTitle(protocol, opcode, buffer)
	local ok, data = pcall(function() return json.decode(buffer) end)
	if ok and data then
		signalcall(PlayerCustom.onTitles, data)
	end
end

local function parseNameEffects(protocol, opcode, buffer)
	local ok, data = pcall(function() return json.decode(buffer) end)
	if ok and data then
		signalcall(PlayerCustom.onNameEffects, data)
	end
end

local function parseOpen(outfit, outfits, creatureMount, mountList)
	local player = g_game.getLocalPlayer()
	local data = {
		outfit = table.copy(outfit),
		name = player:getName(),
		title = "",
		color = nil,
		titleId = 0,
		nameEffectId = 0
	}

	requestTitles()
	requestNameEffects()

	signalcall(PlayerCustom.onOpen, data, outfits)
end


function initProtocol()
	ProtocolGame.registerExtendedOpcode(Opcodes.Title.Request, parseTitle)
	ProtocolGame.registerExtendedOpcode(Opcodes.NameEffect.Request, parseNameEffects)

	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd,
		onOpenOutfitWindow = parseOpen
	})

	if g_game.isOnline() then
		onGameStart()
	end
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedOpcode(Opcodes.Title.Request)
	ProtocolGame.unregisterExtendedOpcode(Opcodes.NameEffect.Request)

	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd,
		onOpenOutfitWindow = parseOpen
	})
end
