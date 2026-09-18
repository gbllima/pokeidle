-- chunkname: @/modules/game_minigame/breeder.lua

BreederGame = {}

local panel
local KeyBind = "Space"
local isDone = false
local OutfitSize = 38
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

local function startTargetAnimate(widget, visibleTime, invisibleTime)
	local function init()
		if widget:getOpacity() == 0 then
			g_effects.fadeIn(widget)
			scheduleEvent(init, visibleTime)
		else
			g_effects.fadeOut(widget)
			scheduleEvent(init, invisibleTime)
		end
	end

	init()
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
	panel = g_ui.createWidget("MiniGameBreederPanel", modules.game_interface.getMapPanel())

	local marginBottom = panel:getHeight() + OutfitSize + 27
	local marginRight = OutfitSize + panel:getHeight() / 2 - 12

	panel:setMarginBottom(marginBottom)
	panel:setMarginRight(marginRight)
end

local function setTargetPosition(position, animate)
	if animate then
		g_effects.moveToMargin(panel.area.target, MarginLeft, panel.area.target:getMarginLeft(), position, 500, Easing.linear)
	else
		panel.area.target:setMarginLeft(position)
	end
end

local function bindKeyDown()
	if isDone then
		return
	end

	local posIndicator = panel.area.indicator:getMarginLeft()
	local posTarget = panel.area.target:getMarginLeft()
	local isFail = posIndicator < posTarget or posIndicator + panel.area.indicator:getWidth() > posTarget + panel.area.target:getWidth()

	if isFail then
		isDone = true

		setState(false)

		return scheduleEvent(function()
			modules.game_minigame.sendBreederGame(Actions.Action, Positions)
		end, 1350)
	end

	Positions[#Positions + 1] = posIndicator

	setState(true)

	if #Positions >= ServData.score then
		isDone = true

		return scheduleEvent(function()
			modules.game_minigame.sendBreederGame(Actions.Action, Positions)
		end, 1350)
	end

	setTargetPosition(ServData.positions[#Positions + 1], true)
end

local function parseEnd(params)
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
	startTargetAnimate(panel.area.target, params.visible, params.invisible)
	g_effects.startBlink(panel.hotkey)
	signalcall(MiniGame.onStart)
	g_keyboard.bindKeyDown(KeyBind, bindKeyDown)
end

local ActionParser = {
	[Actions.Start] = parseStart,
	[Actions.End] = parseEnd
}

local function onBreeder(params)
	local parser = ActionParser[params.action]

	if parser then
		parser(params.data)
	end
end

function BreederGame.init()
	connect(BreederGame, {
		onBreeder = onBreeder
	})
	connect(g_game, {
		onGameEnd = parseEnd
	})
end

function BreederGame.terminate()
	disconnect(BreederGame, {
		onBreeder = onBreeder
	})
	disconnect(g_game, {
		onGameEnd = parseEnd
	})
	hide()
end
