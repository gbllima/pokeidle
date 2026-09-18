-- chunkname: @/modules/game_helds/helds.lua

Helds = {}

local window
local protocol = runinsandbox("protocol")
local lastPosition, currentForge
local ForgeType = {
	Improvements = 2,
	Fragmentation = 1
}
local StylesWindow = {
	[ForgeType.Fragmentation] = "HeldFragmentWindow",
	[ForgeType.Improvements] = "HeldImprovimentWindow"
}

local function hide()
	if window then
		window:destroy()

		window = nil
	end
end

local function onOpen(forgeType)
	currentForge = forgeType

	hide()

	window = g_ui.createWidget(StylesWindow[forgeType], rootWidget)

	window:onVisibilityChange(true)
end

local function onClear()
	lastPosition = window:getPosition()

	onOpen(currentForge)
	window:breakAnchors()
	window:setPosition(lastPosition)
end

local function onHeld(params)
	local tooltip = tr("%s", params.dust.name)
	local canStart = true

	if currentForge == ForgeType.Improvements then
		canStart = params.dust.count <= params.dust.player
		tooltip = tr("%s (%d/%d)", params.dust.name, params.dust.player, params.dust.count)
	end

	local item = Item.create(params.dust.itemId)

	item:setTooltip(tooltip)
	window.dustItem:setItem(item)
	window.start:setEnabled(canStart)
	window.countLabel:setOn(canStart)
	window.countLabel:setText(params.dust.count)
	window.priceLabel:setText(formatMoney(params.price))
end

function init()
	protocol.initProtocol()
	connect(g_game, {
		onGameEnd = onGameEnd
	})
	connect(Helds, {
		onOpen = onOpen,
		onClear = onClear,
		onHeld = onHeld
	})
	connect(LocalPlayer, {
		onPositionChange = hide
	})
	g_ui.importStyle("helds")
end

function terminate()
	protocol.terminateProtocol()
	disconnect(g_game, {
		onGameEnd = onGameEnd
	})
	disconnect(Helds, {
		onOpen = onOpen,
		onClear = onClear,
		onHeld = onHeld
	})
	disconnect(LocalPlayer, {
		onPositionChange = hide
	})
	onGameEnd()
end

function onGameEnd()
	currentForge = nil

	hide()
end

function onStart()
	local item = window.heldItem:getItem()

	if not item or not window.start:isEnabled() then
		return
	end

	local action = ({
		[ForgeType.Fragmentation] = protocol.sendFragmentation,
		[ForgeType.Improvements] = protocol.sendImproviments
	})[currentForge]

	if action then
		action(currentForge, item)
	end
end

function onClearSlot()
	onClear()
end

function onDrop(self, widget, mousePos, forced)
	local thing = widget.currentDragThing

	if thing and thing:isItem() and thing:isPickupable() and thing:getPosition().x == 65535 then
		self:setItem(thing)
		protocol.sendHeld(currentForge, thing)
	end

	return thing
end
