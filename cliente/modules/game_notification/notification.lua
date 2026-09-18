local OPCODE = 81
local panelNotification
local notifyCreateIcon = {
	item = function(widget, value)
		g_ui.createWidget("ItemNotify", widget):setItemId(value)
	end,
	outfit = function(widget, value)
		g_ui.createWidget("OutfitNotify", widget):setOutfit(value)
	end,
	image = function(widget, value)
		g_ui.createWidget("ImageNotify", widget):setImageSource(value)
	end
}

function init()
	g_ui.importStyle("notification")
	ProtocolGame.registerExtendedJSONOpcode(OPCODE, function(protocol, opcode, json_data)
		local action = json_data.action
		local data = json_data.data

		createNotify(data)
	end)

	panelNotification = g_ui.createWidget("PanelNotification", modules.game_interface.getRootPanel())
end

function terminate()
	ProtocolGame.unregisterExtendedJSONOpcode(OPCODE)
	panelNotification:destroy()
	panelNotification = nil
end

function createNotify(param)
	local notify = g_ui.createWidget("PanelNotify", panelNotification)

	setMessage(notify, param)
	setLink(notify, param)
	setCooldown(notify, param.timer)
	setIcon(notify, param)
	setResize(notify)
end

function destroyNotify(notify)
	g_effects.fadeOut(notify)
	scheduleEvent(function()
		notify:destroy()
	end, 350)
end

function setMessage(notify, param)
	local titleText = param.title or ""
	local messageText = param.message or ""

	if notify.title then
		notify.title:setText(titleText, true)

		if param.font then
			notify.title:setFont(param.font)
		end

		if param.titleColor then
			notify.title:setColor(param.titleColor)
		elseif param.color then
			notify.title:setColor(param.color)
		end

		notify.title:resizeToText()
		if notify.separator1 then
			notify.separator1:setVisible(titleText ~= "" and messageText ~= "")
		end
	end

	if notify.message then
		notify.message:setText(messageText, true)

		if param.font then
			notify.message:setFont(param.font)
		end

		if param.color then
			notify.message:setColor(param.color)
		end

		notify.message:resizeToText()
		if notify.separator2 and notify.link then
			notify.separator2:setVisible(messageText ~= "" and notify.link:isVisible())
		end
	end
end

function setLink(notify, param)
	local linkLabel = notify.link
	if not linkLabel then
		return
	end

	if param.linkText and param.linkUrl then
		linkLabel:setText(param.linkText)
		linkLabel:setVisible(true)

		if param.linkColor then
			linkLabel:setColor(param.linkColor)
		else
			linkLabel:setColor("#00BFFF")
		end

		if param.font then
			linkLabel:setFont(param.font)
		end

		linkLabel.onClick = function(widget)
			g_platform.openUrl(param.linkUrl)
		end
	else
		linkLabel:setVisible(false)
	end
end

function setCooldown(notify, timer)
	Cooldown:init(notify.progress, timer).finish = function()
		destroyNotify(notify)
	end
end

function setIcon(notify, icon)
	local widget = notify.icon
	local iconType = icon.image and "image" or icon.itemId and "item" or icon.outfit and "outfit"
	local value = icon.image or icon.itemId or icon.outfit

	if iconType and value then
		widget:setOn(true)
		notify.message:setOn(true)
		notifyCreateIcon[iconType](widget, value)
	else
		widget:setOn(false)
	end
end

function setResize(notify)
	local title = notify.title
	local message = notify.message
	local link = notify.link
	local progress = notify.progress
	local height = 0

	height = height + notify:getPaddingTop()

	if progress and not progress:isPhantom() then
		height = height + progress:getHeight() + (progress:getMarginTop() or 0)
	end

	if title and title:getText() ~= "" then
		local marginTop = title:getMarginTop() or 0
		local size = title:getTextSize(title:getWidth())
		title:setHeight(size.height)
		height = height + marginTop + size.height
	else
		if title then
			title:setHeight(0)
		end
	end

	if notify.separator1 and notify.separator1:isVisible() then
		local marginTop = notify.separator1:getMarginTop() or 0
		height = height + marginTop + notify.separator1:getHeight()
	end

	if message and message:getText() ~= "" then
		local marginTop = message:getMarginTop() or 0
		local size = message:getTextSize(message:getWidth())
		message:setHeight(size.height)
		height = height + marginTop + size.height
	else
		if message then
			message:setHeight(0)
		end
	end

	if notify.separator2 and notify.separator2:isVisible() then
		local marginTop = notify.separator2:getMarginTop() or 0
		height = height + marginTop + notify.separator2:getHeight()
	end

	if link and link:isVisible() then
		local marginTop = link:getMarginTop() or 0
		local size = link:getTextSize(link:getWidth())
		link:setHeight(size.height)
		height = height + marginTop + size.height
	else
		if link then
			link:setHeight(0)
		end
	end

	height = height + notify:getPaddingBottom()
	height = height + 30

	notify:setHeight(height)
end
