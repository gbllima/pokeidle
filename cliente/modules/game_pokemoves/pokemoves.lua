-- chunkname: @/modules/game_pokemoves/pokemoves.lua

SkillBar = {}
movesBarWindow = nil

local protocol = runinsandbox("protocol")
local ProgressCallback = {
	Update = 1,
	Finish = 2
}
local Orientations = {
	Horizontal = 0,
	Vertical = 1
}
local COOLDOWN_RECTS = {}
local orientation = Orientations.Horizontal
local movesConfig
local currentSettings = {}
local pokemonName = ""
local skillsIndex = {}

function removeCooldown(progressRect)
	COOLDOWN_RECTS[progressRect].label:destroy()

	COOLDOWN_RECTS[progressRect] = nil

	removeEvent(progressRect.event)

	if progressRect.icon then
		progressRect.icon:destroy()

		progressRect.icon = nil
	end

	progressRect:destroy()

	progressRect = nil
end

function turnOffCooldown(progressRect)
	removeEvent(progressRect.event)

	if progressRect.icon then
		progressRect.icon:setOn(false)

		progressRect.icon = nil
	end

	progressRect = nil
end

local function initCooldown(progressRect, updateCallback, finishCallback)
	progressRect:setPercent(0)

	progressRect.callback = {
		[ProgressCallback.Update] = updateCallback,
		[ProgressCallback.Finish] = finishCallback
	}

	updateCallback()
end

local function updateCooldown(progressRect, timeStart, timeEnd)
	local timer = g_clock.seconds()

	if timer <= timeEnd then
		local percent = (timer - timeStart) / (timeEnd - timeStart) * 100
		local timeStr = string.format("%.0f", timeEnd - timer)

		progressRect:setPercent(percent)
		COOLDOWN_RECTS[progressRect].label:setText(timeStr)

		COOLDOWN_RECTS[progressRect].cooldown = timeEnd - timer

		removeEvent(progressRect.event)

		progressRect.event = scheduleEvent(function()
			if progressRect.callback then
				progressRect.callback[ProgressCallback.Update]()
			end
		end, 100)

		return true
	end

	progressRect.callback[ProgressCallback.Finish]()
end

local function reallocateIcons()
	movesBarWindow.moves:breakAnchors()

	if orientation == Orientations.Horizontal then
		movesBarWindow.moves:setOn(false)
		movesBarWindow.moves:addAnchor(AnchorTop, "parent", AnchorTop)
		movesBarWindow.moves:addAnchor(AnchorLeft, "parent", AnchorLeft)
		movesBarWindow.moves:addAnchor(AnchorRight, "parent", AnchorRight)
	else
		movesBarWindow.moves:setOn(true)
		movesBarWindow.moves:addAnchor(AnchorTop, "parent", AnchorTop)
		movesBarWindow.moves:addAnchor(AnchorRight, "parent", AnchorRight)
		movesBarWindow.moves:addAnchor(AnchorBottom, "parent", AnchorBottom)
	end

	for i, child in pairs(movesBarWindow.moves:getChildren()) do
		child:setOn(orientation == Orientations.Vertical)
	end
end

local function resize()
	if orientation == Orientations.Horizontal then
		local width = movesBarWindow:getPaddingLeft() + movesBarWindow:getPaddingRight() + movesBarWindow.moves:getMarginLeft()

		for k, v in pairs(movesBarWindow.moves:getChildren()) do
			width = width + v:getWidth() + 2
		end

		movesBarWindow:resize(width, 48)
	else
		local height = movesBarWindow:getPaddingTop() + movesBarWindow:getPaddingBottom() + movesBarWindow.moves:getMarginTop()

		for k, v in pairs(movesBarWindow.moves:getChildren()) do
			height = height + v:getHeight() + 2
		end

		movesBarWindow:resize(48, height)
	end
end

local function switchOrientation()
	orientation = orientation == Orientations.Horizontal and Orientations.Vertical or Orientations.Horizontal

	reallocateIcons()
	resize()
end

local function switchDraggable()
	movesBarWindow:setDraggable(not movesBarWindow:isDraggable())
end

local function editOrderMoves()
	if movesBarWindow.isEditMoves then
		currentSettings[pokemonName] = {}
	end

	for i, move in pairs(movesBarWindow.moves:getChildren()) do
		move:setOpacity(movesBarWindow.isEditMoves and 1 or 0.7)

		if movesBarWindow.isEditMoves then
			currentSettings[pokemonName][tostring(i)] = move.saveIndex
		end
	end

	g_mouse.popCursor("target")

	movesBarWindow.isEditMoves = not movesBarWindow.isEditMoves
end

local function resetOrderMoves()
	currentSettings[pokemonName] = nil

	local children = movesBarWindow.moves:getChildren()

	table.sort(children, function(a, b)
		return (skillsIndex[a:getId()] or 100) < (skillsIndex[b:getId()] or 100)
	end)
	movesBarWindow.moves:reorderChildren(children)
end

local function onMoveDragEnter(widget, mousePos, mouseMoved)
	if movesBarWindow.isEditMoves then
		widget.drag = true

		g_mouse.pushCursor("target")
	end

	return true
end

local function onMoveDragLeave(widget, droppedWidget, mousePos)
	if not movesBarWindow.isEditMoves then
		return true
	end

	local parent = widget:getParent()
	local move = parent:getChildByPos(mousePos)

	if move and move ~= widget and move.moveIcon then
		local moveIndex = parent:getChildIndex(move)
		local selfIndex = parent:getChildIndex(widget)
		local indexMove = move.index:getText()
		local indexSelf = widget.index:getText()

		widget.index:setText(indexMove)
		move.index:setText(indexSelf)
		parent:moveChildToIndex(move, selfIndex)
		parent:moveChildToIndex(widget, moveIndex)
	end

	widget.drag = false

	g_mouse.popCursor("target")

	return true
end

local function onMoveHoverChange(widget, hovered)
	if hovered then
		g_tooltip.display(widget.tooltip)

		if movesBarWindow.isEditMoves then
			widget:setOpacity(1)
		end
	else
		g_tooltip.hide()

		if movesBarWindow.isEditMoves and not widget.drag then
			widget:setOpacity(0.8)
		end
	end
end

function reset()
	movesBarWindow.moves:destroyChildren()

	movesBarWindow.isEditMoves = false

	resize()
end

function hide()
	movesBarWindow:hide()
end

function show()
	movesBarWindow:show()
end

function onGameStart()
	local settings = g_settings.getNode("movesBar")

	if settings then
		orientation = settings.orientation
		position = topoint(settings.pos)
	end

	hide()
	reset()
	movesBarWindow:breakAnchors()
	movesBarWindow:setOn(isHorizontalLayout() and isInRangeBottom())

	if movesBarWindow:isOn() then
		movesBarWindow:addAnchor(AnchorBottom, "actionBottomPanel", AnchorTop)
		movesBarWindow:addAnchor(AnchorHorizontalCenter, "actionBottomPanel", AnchorHorizontalCenter)
	end

	local playerName = g_game.getCharacterName()

	if not playerName then
		return
	end

	currentSettings = movesConfig:getNode(playerName) or {}
end

function onGameEnd()
	local settings = {
		orientation = orientation,
		pos = pointtostring(movesBarWindow:getPosition())
	}

	hide()
	reset()
	g_settings.setNode("movesBar", settings)

	local playerName = g_game.getCharacterName()

	if not playerName then
		return
	end

	movesConfig:setNode(playerName, currentSettings)
	movesConfig:save()
end

local function onOpen()
	show()
end

local function onClose()
	hide()
end

local function onCooldown(move)
	local widget = movesBarWindow.moves[move.name]

	if not widget then
		return
	end

	local progressRect = g_ui.createWidget("ProgressRect", widget)

	progressRect:fill("parent")
	progressRect:setBackgroundColor("#0000008C")

	local label = g_ui.createWidget("CooldownLabel", progressRect)

	label:setText(move.remaining)

	COOLDOWN_RECTS[progressRect] = {}
	COOLDOWN_RECTS[progressRect].cooldown = move.remaining
	COOLDOWN_RECTS[progressRect].label = label

	local timeStart, timeEnd = g_clock.seconds(), g_clock.seconds() + move.remaining

	local function updateFunc()
		updateCooldown(progressRect, timeStart, timeEnd)
	end

	local function finishFunc()
		removeCooldown(progressRect)
	end

	initCooldown(progressRect, updateFunc, finishFunc)
end

local function onSkills(params)
	hide()
	reset()

	skillsIndex = {}
	pokemonName = params.pokemonName

	local order = currentSettings[pokemonName] or {}

	if #params.skills > 0 then
		for i, move in pairs(params.skills) do
			local index = order[tostring(i)] or i
			local currentMove = params.skills[index]
			local widget = g_ui.createWidget("MoveIcon", movesBarWindow.moves)
			local imagePath = tr("/images/game/moves/%s_on.png", currentMove.name:lower())

			if g_resources.fileExists(imagePath) then
				widget:setImageSource(imagePath)
			end

			widget.onHoverChange = onMoveHoverChange
			widget.onDragEnter = onMoveDragEnter
			widget.onDragLeave = onMoveDragLeave
			skillsIndex[move.name] = i

			widget:setId(currentMove.name)
			widget.index:setText(i)

			widget.saveIndex = index

			widget:setTooltip(tr("Name: %s\nType: %s\nCooldown: %ss", currentMove.name, currentMove.element, currentMove.cooldown))

			function widget.onClick()
				g_game.talkChannel(0, 0, "m" .. index)
			end

			if currentMove.remaining > 0 then
				onCooldown(currentMove)
			end
		end

		reallocateIcons()
		resize()
		show()
	end
end

function init()
	protocol.initProtocol()
	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
	connect(SkillBar, {
		onOpen = onOpen,
		onClose = onClose,
		onSkills = onSkills,
		onCooldown = onCooldown
	})

	movesConfig = g_configs.create("/moves.otml")
	movesBarWindow = g_ui.loadUI("pokemoves", modules.game_interface.getRootPanel())

	function movesBarWindow:onMouseRelease(mousePosition, mouseButton)
		if mouseButton == MouseRightButton then
			local menu = g_ui.createWidget("PopupMenu")

			menu:addOption(tr("Switch Orientation"), switchOrientation)
			menu:addOption(self:isDraggable() and tr("Lock") or tr("Unlock"), switchDraggable)
			menu:addOption(self.isEditMoves and tr("Save order") or tr("Edit order"), editOrderMoves)
			menu:addOption(tr("Reset order"), resetOrderMoves)
			menu:display(mousePosition)

			return true
		end

		return false
	end

	function movesBarWindow:onDragEnter(mousePos)
		self:setOn(false)
		self:breakAnchors()

		self.movingReference = {
			x = mousePos.x - self:getX(),
			y = mousePos.y - self:getY()
		}

		return true
	end

	function movesBarWindow:onDragLeave(droppedWidget, mousePos)
		self:setOn(isHorizontalLayout() and isInRangeBottom())

		if self:isOn() then
			self:setOn(true)
			self:breakAnchors()
			self:addAnchor(AnchorBottom, "actionBottomPanel", AnchorTop)
			self:addAnchor(AnchorHorizontalCenter, "actionBottomPanel", AnchorHorizontalCenter)
		end

		return true
	end

	if g_game.isOnline() then
		onGameStart()
	end
end

function terminate()
	protocol.terminateProtocol()
	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
	disconnect(SkillBar, {
		onOpen = onOpen,
		onClose = onClose,
		onSkills = onSkills,
		onCooldown = onCooldown
	})
	movesBarWindow:destroy()
end

function isInRangeBottom()
	local movesBarPosition = movesBarWindow:getPosition()
	local areaBottom = modules.game_actionbar.actionBottomPanel.area
	local bottomPosition = areaBottom:getPosition()
	local fromPosition = {
		x = bottomPosition.x - movesBarWindow:getWidth() / 2,
		y = bottomPosition.y - areaBottom:getHeight() + 5
	}
	local toPosition = {
		x = bottomPosition.x + (areaBottom:getWidth() - movesBarWindow:getWidth() / 2),
		y = bottomPosition.y + areaBottom:getHeight() / 2
	}

	return movesBarPosition.x >= fromPosition.x and movesBarPosition.y >= fromPosition.y and movesBarPosition.x <= toPosition.x and movesBarPosition.y <= toPosition.y
end

function isHorizontalLayout()
	return orientation == Orientations.Horizontal
end

function getMovesBar()
	return movesBarWindow
end

function doUseSkill(index)
	local skillBar = movesBarWindow.moves:getChildByIndex(index)

	if skillBar then
		skillBar.onClick()
	end
end
