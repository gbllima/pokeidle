-- chunkname: @/modules/game_minigame/designer.lua

DesignerGame = {}

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

function doGeneratePositionTarget(position, count)
	local positions, minimum, maximum = {
		position
	}, panel.area["1"]:getWidth(), panel.area:getWidth() - panel.area["1"]:getWidth()

	while #positions ~= count do
		local pos = math.random(minimum, maximum)
		local has = table.filterFind(positions, function(i, value)
			return math.abs(value - pos) < minimum + 4
		end)

		if not has then
			positions[#positions + 1] = pos
		end
	end

	return positions
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
	panel = g_ui.createWidget("MiniGameDesignerPanel", modules.game_interface.getMapPanel())

	local marginBottom = panel:getHeight() + OutfitSize + 26
	local marginRight = OutfitSize + panel:getHeight() / 2 - 12

	panel:setMarginBottom(marginBottom)
	panel:setMarginRight(marginRight)
end

local function setTargetPosition(position, animate)
	if animate then
		for i, pos in pairs(doGeneratePositionTarget(position, 3)) do
			g_effects.moveToMargin(panel.area[i], MarginLeft, panel.area[i]:getMarginLeft(), pos, 500, Easing.linear)
		end
	else
		for i, pos in pairs(doGeneratePositionTarget(position, 3)) do
			panel.area[i]:setMarginLeft(pos)
		end
	end
end

local function bindKeyDown()
	if isDone then
		return
	end

	local posIndicator = panel.area.indicator:getMarginLeft()
	local posTarget = panel.area["1"]:getMarginLeft()
	local isFail = posIndicator < posTarget or posIndicator + panel.area.indicator:getWidth() > posTarget + panel.area["1"]:getWidth()

	if isFail then
		isDone = true

		setState(false)

		return scheduleEvent(function()
			modules.game_minigame.sendDesignerGame(Actions.Action, Positions)
		end, 1350)
	end

	Positions[#Positions + 1] = posIndicator

	setState(true)

	if #Positions >= ServData.score then
		isDone = true

		return scheduleEvent(function()
			modules.game_minigame.sendDesignerGame(Actions.Action, Positions)
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
	g_effects.startBlink(panel.hotkey)
	signalcall(MiniGame.onStart)
	g_keyboard.bindKeyDown(KeyBind, bindKeyDown)
end

local ActionParser = {
	[Actions.Start] = parseStart,
	[Actions.End] = parseEnd
}

local function onDesigner(params)
	local parser = ActionParser[params.action]

	if parser then
		parser(params.data)
	end
end

function DesignerGame.init()
	connect(DesignerGame, {
		onDesigner = onDesigner
	})
	connect(g_game, {
		onGameEnd = parseEnd
	})
end

function DesignerGame.terminate()
	disconnect(DesignerGame, {
		onDesigner = onDesigner
	})
	disconnect(g_game, {
		onGameEnd = parseEnd
	})
	hide()
end
