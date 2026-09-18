-- chunkname: @/modules/game_custompokemon/protocol.lua

local PokemonCustomOpcode = 120
local Actions = {
	Request = 1,
	Nickname = 6,
	Addons = 2,
	Paintings = 5,
	Capsules = 4,
	Shaders = 3
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
		protocolGame:sendExtendedJSONOpcode(PokemonCustomOpcode, {
			action = action,
			data = data
		})
	end
end

function sendOpen()
	sendAction(Actions.Request, 1)
end

function sendChooseAddon(addonId)
	sendAction(Actions.Addons, addonId)
end

function sendChooseShader(shaderId)
	sendAction(Actions.Shaders, shaderId)
end

function sendChooseCapsule(capsuleId)
	sendAction(Actions.Capsules, capsuleId)
end

function sendChoosePainting(paintingId)
	sendAction(Actions.Paintings, paintingId)
end

function sendUpdateNickname(nickname)
	sendAction(Actions.Nickname, nickname)
end

local function parseOpen(params)
	-- Verificar se params existe
	if not params then
		print("ERROR: params is nil in parseOpen")
		return
	end
	
	if params.action == "open" then
		local pokemonName = params.pokemon or ""
		local nickname = params.nickname or ""
		local outfit = params.outfit or {type = 6}
		local addonsList = params.addons or {}
		local shadersList = params.shaders or {}
		local currentAddon = params.currentAddon or 1
		local currentShader = params.currentShader or 0
		
		signalcall(PokemonCustom.onCustom, pokemonName, nickname, outfit, addonsList, shadersList, currentAddon, currentShader)
		return
	end
	
	-- Formato antigo (compatibilidade)
	local player = g_game.getLocalPlayer()
	if not player then
		print("ERROR: no local player")
		return
	end
	
	local outfit = table.copy(player:getOutfit())

	-- Verificar se params tem a estrutura esperada (formato antigo)
	if params.addons and params.addons.current then
		outfit.type = params.addons.current
	end
	
	if params.shaders and params.shaders.current then
		outfit.shader = params.shaders.current  
	end

	local name = params.name or ""
	local nick = params.nick or ""
	local addonsList = (params.addons and params.addons.list) or {}
	local shadersList = (params.shaders and params.shaders.list) or {}

	signalcall(PokemonCustom.onCustom, name, nick, outfit, addonsList, shadersList)
end

local function parseAction(protocol, opcode, jsonData)
	if jsonData and jsonData.data then
		parseOpen(jsonData.data)
	elseif jsonData then
		parseOpen(jsonData)
	end
end

function initProtocol()
	ProtocolGame.registerExtendedJSONOpcode(PokemonCustomOpcode, parseAction)
	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})

	if g_game.isOnline() then
		onGameStart()
	end
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedJSONOpcode(PokemonCustomOpcode)
	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end
