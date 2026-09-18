-- chunkname: @/modules/game_cam/cam.lua

PokemonCam = {}

local protocol = runinsandbox("protocol")
local window, listCam

local function onCreate(params)
	window = params.isOwner and StreamingPanel:new(params) or SpectatorPanel:new(params)
end

local function onUpdate(params)
	if window and window.cam then
		window.cam:onUpdate(params)
	end
end

local function onLeave()
	hideCamWindow()
end

local function onList(params)
	listCam = CamsPanel:new(params)
end

local function onWatching(isWatching)
	if not isWatching then
		hideCamWindow()
	end
end

function init()
	protocol.initProtocol()
	connect(g_game, {
		onGameEnd = onGameEnd
	})
	connect(PokemonCam, {
		onCreate = onCreate,
		onUpdate = onUpdate,
		onLeave = onLeave,
		onList = onList,
		onWatching = onWatching
	})
	g_ui.importStyle("cam")
end

function terminate()
	protocol.terminateProtocol()
	disconnect(g_game, {
		onGameEnd = onGameEnd
	})
	disconnect(PokemonCam, {
		onCreate = onCreate,
		onUpdate = onUpdate,
		onLeave = onLeave,
		onList = onList,
		onWatching = onWatching
	})
	hideCamWindow()
	hideListCam()
end

function onGameEnd()
	hideCamWindow()
	hideListCam()
end

function hideCamWindow()
	if window then
		window.contentsPanel:close()
		window:destroy()

		window = nil
	end
end

function hideListCam()
	if listCam then
		listCam:destroy()

		listCam = nil
	end
end
