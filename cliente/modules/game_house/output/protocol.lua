-- chunkname: @/modules/game_house/protocol.lua

local PokemonHouseOpcode = 199

local function parseAction(protocol, opcode, jsonData)
	signalcall(PokeHouse.onOpen, jsonData.data)
end

function initProtocol()
	ProtocolGame.registerExtendedJSONOpcode(PokemonHouseOpcode, parseAction)
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedJSONOpcode(PokemonHouseOpcode)
end
