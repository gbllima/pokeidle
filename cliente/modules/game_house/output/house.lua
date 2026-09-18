-- chunkname: @/modules/game_house/house.lua

PokeHouse = {}

local windowHouse, windoControls
local protocol = runinsandbox("protocol")
local actionHouse = {
	{
		command = "!subowner",
		title = "Invite as Sub Owner",
		subOwner = false
	},
	{
		command = "!invite",
		title = "Invite as visitor",
		subOwner = true
	},
	{
		command = "!sellhouse",
		title = "Sell house",
		subOwner = false
	},
	{
		command = "!leavehouse",
		title = "Leave house",
		subOwner = false
	}
}

local function onOpen(params)
	if windowHouse and not windowHouse:isHidden() then
		return
	end

	destroy()

	windowHouse = g_ui.displayUI("house")

	windowHouse:onVisibilityChange(true)

	local myHouse = params.owner == g_game.getLocalPlayer():getName()
	local houseNobody = params.owner == tr("Nobody")

	for i, child in pairs(windowHouse:getChildren()) do
		child:setOn(myHouse)
	end

	windowHouse.params = params

	windowHouse:setOn(myHouse)
	windowHouse:setChecked(not myHouse and not houseNobody)
	windowHouse.manageButton:setVisible(myHouse or houseNobody)
	windowHouse:setText(params.name)
	windowHouse.onwerLabel:setText(params.owner)
	windowHouse.dateLabel:setText(params.rentDate)
	windowHouse.priceLabel:setText(formatMoney(params.price))
	windowHouse.sizeLabel:setText(tr("%d Tiles", params.size))
	windowHouse.rentLabel:setText(formatMoney(params.price / 2))

	function windowHouse.copyButton.onClick()
		g_window.setClipboardText(string.format("House: %s. Owner: %s. Size: %s. Price: %s", params.name, params.owner, params.size, formatMoney(params.price)))
	end
end

function init()
	protocol.initProtocol()
	connect(g_game, {
		onGameEnd = destroy
	})
	connect(LocalPlayer, {
		onPositionChange = onHousePositionChange
	})
	connect(PokeHouse, {
		onOpen = onOpen
	})
end

function terminate()
	protocol.initProtocol()
	disconnect(g_game, {
		onGameEnd = destroy
	})
	disconnect(LocalPlayer, {
		onPositionChange = onHousePositionChange
	})
	disconnect(PokeHouse, {
		onOpen = onOpen
	})
	destroy()
end

function destroy()
	if windowHouse then
		windowHouse:destroy()

		windowHouse = nil
	end

	if windoControls then
		windoControls:destroy()

		windoControls = nil
	end
end

function onHousePositionChange()
	destroy()
end

function sellHouse(params)
	if windowSell and not windowSell:isDestroyed() then
		return
	end

	windoControls = g_ui.createWidget("HouseControls", rootWidget)

	windoControls:onVisibilityChange(true)

	local height = windoControls:getPaddingTop() + windoControls:getPaddingBottom() + 48

	for i, action in pairs(actionHouse) do
		if not params.isSubOwner or params.isSubOwner and action.subOwner then
			local button = g_ui.createWidget("ButtonBlueSmall", windoControls.list)

			height = height + button:getHeight() + 5

			button:setMarginTop(5)
			button:setText(tr(action.title))

			function button.onClick()
				g_game.talkChannel(MessageModes.None, 0, action.command)
			end
		end
	end

	windowHouse:hide()

	windoControls.params = params

	windoControls:setHeight(height)
end
