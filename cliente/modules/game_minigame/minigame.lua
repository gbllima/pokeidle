-- chunkname: @/modules/game_minigame/minigame.lua

MiniGame = {}

local protocol = runinsandbox("protocol")
local state = false
local Ids = {
	Breeder = 3,
	Designer = 2,
	Photographer = 1,
	Researcher = 4
}

local function onStart()
	state = true
end

local function onEnd()
	state = false
end

function init()
	protocol.initProtocol()
	connect(MiniGame, {
		onStart = onStart,
		onEnd = onEnd
	})
	g_ui.importStyle("minigame")
end

function terminate()
	protocol.terminateProtocol()
	connect(MiniGame, {
		onStart = onStart,
		onEnd = onEnd
	})
end

function isPlaying()
	return state
end

function sendPhotographerGame(action, data)
	protocol.sendGameAction(Ids.Photographer, action, data)
end

function sendDesignerGame(action, data)
	protocol.sendGameAction(Ids.Designer, action, data)
end

function sendResearcherGame(action, data)
	protocol.sendGameAction(Ids.Researcher, action, data)
end

function sendBreederGame(action, data)
	protocol.sendGameAction(Ids.Breeder, action, data)
end
