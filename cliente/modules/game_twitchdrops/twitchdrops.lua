-- chunkname: @/modules/game_twitchdrops/twitchdrops.lua

TwitchDrops = {}

local window
local protocol = runinsandbox("protocol")
local curentPoints = 0

local function onPoints(points)
	if not window then
		show()
	end

	curentPoints = points

	window.reedem:setEnabled(points > 0)
	window.points:setText(tr("x %d", points))
end

function hide()
	if window then
		window:destroy()

		window = nil
		curentPoints = 0
	end
end

function show()
	if window then
		hide()
	end

	window = g_ui.displayUI("twitchdrops")
end

function init()
	protocol.initProtocol()
	connect(g_game, {
		onGameEnd = hide
	})
	connect(LocalPlayer, {
		onPositionChange = onPositionChange
	})
	connect(TwitchDrops, {
		onPoints = onPoints
	})
end

function terminate()
	protocol.terminateProtocol()
	disconnect(g_game, {
		onGameEnd = hide
	})
	disconnect(LocalPlayer, {
		onPositionChange = onPositionChange
	})
	disconnect(TwitchDrops, {
		onPoints = onPoints
	})
	hide()
end

function onPositionChange()
	if window and window:isVisible() then
		hide()
	end
end

function onReedem()
	if curentPoints > 0 and window.reedem:isEnabled() then
		protocol.sendRedeem()
		onPoints(curentPoints - 1)
	end
end
