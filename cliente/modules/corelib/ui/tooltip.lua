-- chunkname: @/modules/corelib/ui/tooltip.lua

g_tooltip = {}

local toolTipLabel, toolTipReward, currentTooltip, currentHoveredWidget, lastHoveredWidget

local function moveToolTip(first)
	if not first and (currentTooltip or not currentTooltip:isVisible() or currentTooltip:getOpacity() < 0.1) then
		return
	end

	if currentHoveredWidget and not lastHoveredWidget and not g_keyboard.isShiftPressed() then
		g_tooltip.hide()

		currentHoveredWidget = nil

		return
	end

	if currentHoveredWidget and g_keyboard.isShiftPressed() then
		return
	end

	local pos = g_window.getMousePosition()
	local windowSize = g_window.getSize()
	local size = currentTooltip:getSize()

	pos.x = pos.x + 1
	pos.y = pos.y + 1

	if windowSize.width - (pos.x + size.width) < 10 then
		pos.x = pos.x - size.width - 3
	else
		pos.x = pos.x + 10
	end

	if windowSize.height - (pos.y + size.height) < 40 then
		pos.y = pos.y - size.height
	else
		pos.y = pos.y + 10
	end

	currentTooltip:setPosition(pos)
end

local function onWidgetHoverChange(widget, hovered)
	if hovered then
		if (widget.tooltip or widget.tooltipItems) and not g_mouse.isPressed() and not currentHoveredWidget then
			if widget.tooltip then
				g_tooltip.display(widget.tooltip)
			elseif widget.tooltipItems then
				g_tooltip.displayItems(widget.tooltipItems)
			end

			currentHoveredWidget = widget
			lastHoveredWidget = true
		end
	else
		if widget == currentHoveredWidget then
			lastHoveredWidget = false
		end

		if widget == currentHoveredWidget and not g_keyboard.isShiftPressed() then
			g_tooltip.hide()

			currentHoveredWidget = nil
		end
	end
end

local function onWidgetStyleApply(widget, styleName, styleNode)
	if styleNode.tooltip then
		widget.tooltip = styleNode.tooltip
	end
end

function g_tooltip.init()
	connect(UIWidget, {
		onStyleApply = onWidgetStyleApply,
		onHoverChange = onWidgetHoverChange
	})
	addEvent(function()
		toolTipLabel = g_ui.createWidget("TooltipLabel", rootWidget)

		toolTipLabel:setId("toolTip")
		toolTipLabel:setTextAlign(AlignCenter)
		toolTipLabel:hide()

		toolTipReward = g_ui.createWidget("TooltipRewardWindow", rootWidget)

		toolTipReward:setId("toolTip")
		toolTipReward:hide()
	end)
end

function g_tooltip.terminate()
	disconnect(UIWidget, {
		onStyleApply = onWidgetStyleApply,
		onHoverChange = onWidgetHoverChange
	})
	toolTipLabel:destroy()

	toolTipLabel = nil

	toolTipReward:destroy()

	toolTipReward = nil
	currentHoveredWidget = nil
	currentTooltip = nil
	g_tooltip = nil
end

function g_tooltip.display(text)
	if text == nil or text:len() == 0 or not toolTipLabel then
		return
	end

	toolTipLabel:setMultiColorText(text)
	toolTipLabel:resizeToText()
	toolTipLabel:resize(toolTipLabel:getWidth() + 14, toolTipLabel:getHeight() + 12)
	toolTipLabel:show()
	toolTipLabel:raise()
	toolTipLabel:enable()

	currentTooltip = toolTipLabel

	g_effects.fadeIn(toolTipLabel, 100)
	moveToolTip(true)
	connect(rootWidget, {
		onMouseMove = moveToolTip
	})
end

function g_tooltip.displayItems(items)
	if items == nil or #items == 0 or not toolTipReward then
		return
	end

	local width = 205

	toolTipReward:destroyChildren()

	for i, v in pairs(items) do
		local panel = g_ui.createWidget("TooltipRewardItem", toolTipReward)

		panel.item:setItemId(v.itemId)
		panel.item:setText(v.count)
		panel.name:setText(v.name)

		width = math.max(width, panel.item:getWidth() + panel.name:getWidth() + panel.name:getMarginLeft())
	end

	toolTipReward:setWidth(width + toolTipReward:getPaddingLeft() + toolTipReward:getPaddingRight())
	toolTipReward:show()
	toolTipReward:raise()
	toolTipReward:enable()

	currentTooltip = toolTipReward

	g_effects.fadeIn(toolTipReward, 100)
	moveToolTip(true)
	connect(rootWidget, {
		onMouseMove = moveToolTip
	})
end

function g_tooltip.hide()
	if currentTooltip then
		g_effects.fadeOut(currentTooltip, 100)
	end

	currentTooltip = nil

	disconnect(rootWidget, {
		onMouseMove = moveToolTip
	})
end

function UIWidget:setTooltip(text)
	self.tooltip = text
end

function UIWidget:setTooltipItems(items)
	self.tooltipItems = items
end

function UIWidget:removeTooltip()
	self.tooltip = nil
	self.tooltipItems = nil
end

function UIWidget:getTooltip()
	return self.tooltip
end

function UIWidget:getTooltipItems()
	return self.tooltipItems
end

g_tooltip.init()
connect(g_app, {
	onTerminate = g_tooltip.terminate
})
