-- chunkname: @/modules/game_pokemoves/protocol.lua

local PokemonMovesOpcode = 52
local Actions = {
	Moves = 3,
	Open = 1,
	Close = 2,
	Cooldown = 4
}

local function parseOpen()
	signalcall(SkillBar.onOpen)
end

local function parseClose()
	signalcall(SkillBar.onClose)
end

local function parseMoves(params)
	signalcall(SkillBar.onSkills, params)
end

local function parseCooldown(params)
	signalcall(SkillBar.onCooldown, params)
end

local ActionParser = {
	[Actions.Open] = parseOpen,
	[Actions.Close] = parseClose,
	[Actions.Moves] = parseMoves,
	[Actions.Cooldown] = parseCooldown
}

local function parseAction(protocol, opcode, jsonData)
	local parser = ActionParser[jsonData.action]

	if parser then
		parser(jsonData.data)
	end
end

function initProtocol()
	ProtocolGame.registerExtendedJSONOpcode(PokemonMovesOpcode, parseAction)
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedJSONOpcode(PokemonMovesOpcode)
end
