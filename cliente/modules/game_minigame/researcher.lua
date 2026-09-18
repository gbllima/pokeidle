-- chunkname: @/modules/game_minigame/researcher.lua

ResearcherGame = {}

local panel
local KeyBind = "Space"
local isDone = false
local OutfitSize = 24
local ServData = {}
local Positions = {}
local Actions = {
	Start = 1,
	End = 3,
	Action = 2
}

local function startAnimate(widget, speed)
	local function animateBox(widget, marginType, initialMargin, finalMargin, speed, finishCallback)
		local direction = false

		local function animateDirection()
			g_effects.moveToMargin(widget, marginType, direction and initialMargin or finalMargin, direction and finalMargin or initialMargin, speed, Easing.linear, animateDirection)

			direction = not direction
		end

		g_effects.moveToMargin(widget, marginType, initialMargin, finalMargin, speed, Easing.linear, animateDirection)
	end

	animateBox(widget, MarginLeft, 0, widget:getParent():getWidth() - widget:getWidth(), speed)
end

local function setState(state)
	panel.state:setOn(state)
	g_effects.fadeIn(panel.state)
	scheduleEvent(function()
		if panel then
			g_effects.fadeOut(panel.state)
		end
	end, 1100)
end

local function hide()
	if panel then
		panel:destroy()

		panel = nil
	end
end

local function createTilePanel()
	panel = g_ui.createWidget("MiniGameResearcherPanel", modules.game_interface.getMapPanel())

	local marginBottom = panel:getHeight() + OutfitSize + 44
	local marginRight = OutfitSize + panel:getHeight() / 2

	panel:setMarginBottom(marginBottom)
	panel:setMarginRight(marginRight)
end

local function setTargetPosition(position, animate)
	for index, pos in pairs(position) do
		if animate then
			g_effects.moveToMargin(panel.area[index], MarginLeft, panel.area[index]:getMarginLeft(), pos, 500, Easing.linear)
		else
			panel.area[index]:setMarginLeft(pos)
		end
	end
end

local function bindKeyDown()
	if isDone then
		return
	end

	local posIndicator = panel.area.indicator:getMarginLeft()
	local posTarget = panel.area[Attempt]:getMarginLeft()
	local isFail = posIndicator < posTarget or posIndicator + panel.area.indicator:getWidth() > posTarget + panel.area[Attempt]:getWidth()

	if isFail then
		isDone = true

		setState(false)

		return scheduleEvent(function()
			modules.game_minigame.sendResearcherGame(Actions.Action, Positions)
		end, 1350)
	end

	Positions[Attempt] = posIndicator

	setState(true)

	if Attempt >= ServData.score then
		isDone = true

		return scheduleEvent(function()
			modules.game_minigame.sendResearcherGame(Actions.Action, Positions)
		end, 1350)
	end

	Attempt = Attempt + 1

	setTargetPosition(ServData.positions[Attempt], true)
end

local function parseEnd(params)
	Attempt = 1
	Positions = {}
	isDone = false

	hide()
	signalcall(MiniGame.onEnd)
	g_keyboard.unbindKeyDown(KeyBind)
end

local function parseStart(params)
	ServData = params

	parseEnd(params)
	createTilePanel()
	setTargetPosition(params.positions[1])
	startAnimate(panel.area.indicator, params.indicator)
	g_effects.startBlink(panel.hotkey)
	signalcall(MiniGame.onStart)
	g_keyboard.bindKeyDown(KeyBind, bindKeyDown)
end

local ActionParser = {
	[Actions.Start] = parseStart,
	[Actions.End] = parseEnd
}

local function onResearcher(params)
	local parser = ActionParser[params.action]

	if parser then
		parser(params.data)
	end
end

function ResearcherGame.init()
	connect(ResearcherGame, {
		onResearcher = onResearcher
	})
	connect(g_game, {
		onGameEnd = parseEnd
	})
end

function ResearcherGame.terminate()
	disconnect(ResearcherGame, {
		onResearcher = onResearcher
	})
	disconnect(g_game, {
		onGameEnd = parseEnd
	})
	hide()
end
