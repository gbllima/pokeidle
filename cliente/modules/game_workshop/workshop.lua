-- chunkname: @/modules/game_workshop/workshop.lua

local uiWindow, uiConfirmWindow, uiConfirmSpeedWindow, uiCraftList
local cooldownPriceReduction = 0
local ExtendsOpcodes = {
	RequestCollect = 4,
	RequestCraft = 3,
	ParseMessage = 2,
	Workshop = 85,
	ParseData = 1,
	RequestSpeed = 5
}

local function formatCooldown(cooldown)
	local result = {}
	local units = {
		{
			86400,
			"d"
		},
		{
			3600,
			"h"
		},
		{
			60,
			"m"
		},
		{
			1,
			"s"
		}
	}

	for i, v in ipairs(units) do
		local value, symbol = v[1], v[2]
		local amount = math.floor(cooldown / value)

		cooldown = cooldown % value

		if amount > 0 then
			table.insert(result, amount .. symbol)
		end
	end

	local formatted = table.concat(result, " ")

	return formatted ~= "" and formatted or "0s"
end

local function parseData(craft)
	for i, craftItem in ipairs(craft.list) do
		local uiCraftItem = uiCraftList[craftItem.name]

		if not uiCraftItem then
			uiCraftItem = g_ui.createWidget("CraftRowItem", uiCraftList)

			uiCraftItem:setId(craftItem.name)
		end

		uiCraftItem.craftItem = craftItem

		uiCraftItem:setOn(craftItem.playerCraft)
		uiCraftItem.name:setText(craftItem.name)
		uiCraftItem.item:setItemId(craftItem.itemId)
		uiCraftItem.item:setItemCount(craftItem.count)
		uiCraftItem:setTooltip(craftItem.description)

		if craftItem.cooldown > 0 then
			uiCraftItem.cooldown:show()
			uiCraftItem.cooldown:setText(formatCooldown(craftItem.cooldown))
		end

		onUpdateCraftItem(uiCraftItem, craftItem.playerCraft)

		for _, material in pairs(craftItem.requiredItems) do
			local uiMaterial = uiCraftItem.requiredPanel[material.name]
			local tmpItem = Item.create(material.itemId)

			if not uiMaterial then
				uiMaterial = g_ui.createWidget("WorkshopRequiredItem", uiCraftItem.requiredPanel)

				uiMaterial:setId(material.name)
			end

			tmpItem:setTooltip(tr("%s (%sx).", material.name, material.count))
			uiMaterial.item:setItem(tmpItem)
			uiMaterial.count:setText(material.count)
			uiMaterial.count:setOn(material.playerCount >= material.count)
		end

		uiCraftItem.requiredPanel:setWidth(uiCraftItem.requiredPanel:getChildCount() * 32)
	end

	cooldownPriceReduction = craft.price

	uiWindow:show()
	uiWindow:focus()
	uiWindow.banner:setImageSource(craft.banner or "/images/game/workshop/default")
	onUpdateCraftControls(uiCraftList, uiCraftList:getFocusedChild())
end

local function parseMessage(message)
	displayInfoBox(uiWindow:getText(), message)
end

function sendAction(action, data)
	local protocolGame = g_game.getProtocolGame()

	if protocolGame then
		protocolGame:sendExtendedJSONOpcode(ExtendsOpcodes.Workshop, {
			action = action,
			data = data
		})
	end
end

function requestCollect()
	local focusedChild = uiCraftList:getFocusedChild()

	if not focusedChild then
		return
	end

	local data = {
		id = focusedChild.craftItem.id,
		categoryId = focusedChild.craftItem.categoryId
	}

	sendAction(ExtendsOpcodes.RequestCollect, data)
end

function requestCraft()
	if not uiConfirmWindow then
		return
	end

	local focusedChild = uiCraftList:getFocusedChild()

	if not focusedChild then
		return
	end

	local data = {
		id = focusedChild.craftItem.id,
		count = uiConfirmWindow.uiScroll:getValue(),
		categoryId = focusedChild.craftItem.categoryId
	}

	hideConfirmWindow()
	sendAction(ExtendsOpcodes.RequestCraft, data)
end

function requestSpeed()
	if cooldownPriceReduction < 1 then
		return
	end

	local focusedChild = uiCraftList:getFocusedChild()

	if not focusedChild then
		return
	end

	local craftItem = focusedChild.craftItem

	if not craftItem.playerCraft then
		return
	end

	local function cancelCallback()
		uiConfirmSpeedWindow:destroy()

		uiConfirmSpeedWindow = nil
	end

	local function confirmCallback()
		local data = {
			id = craftItem.id,
			categoryId = craftItem.categoryId
		}

		sendAction(ExtendsOpcodes.RequestSpeed, data)
		cancelCallback()
	end

	local price = math.ceil((craftItem.playerCraft.cooldown - os.time()) / cooldownPriceReduction)

	hideConfirmSpeedWindow()

	uiConfirmSpeedWindow = displayGeneralBox(uiWindow:getText(), tr("Voc\xEA deseja por %s P-Bucks, concluir esse craft?", price), {
		{
			color = "Blue",
			text = tr("Yes"),
			callback = confirmCallback
		},
		{
			color = "Red",
			text = tr("No"),
			callback = cancelCallback
		},
		anchor = AnchorHorizontalCenter
	}, confirmCallback, cancelCallback)

	uiConfirmSpeedWindow:show()
	uiConfirmSpeedWindow:raise()
	uiConfirmSpeedWindow:focus()
end

local parseOpcodesMap = {
	[ExtendsOpcodes.ParseData] = parseData,
	[ExtendsOpcodes.ParseMessage] = parseMessage
}

function init()
	connect(g_game, {
		onGameEnd = offline
	})
	ProtocolGame.registerExtendedJSONOpcode(ExtendsOpcodes.Workshop, parseOpcodeWorkshop)

	uiWindow = g_ui.displayUI("workshop.otui")
	uiCraftList = uiWindow.uiCraftList

	connect(uiCraftList, {
		onChildFocusChange = onUpdateCraftControls
	})
end

function terminate()
	disconnect(g_game, {
		onGameEnd = offline
	})
	disconnect(uiCraftList, {
		onChildFocusChange = onUpdateCraftControls
	})
	ProtocolGame.unregisterExtendedJSONOpcode(ExtendsOpcodes.Workshop)
	offline()
	uiWindow:destroy()

	uiWindow = nil
end

function offline()
	uiWindow:hide()
	removeCraftEvents()
	uiCraftList:destroyChildren()
	hideConfirmWindow()
	hideConfirmSpeedWindow()
end

function parseOpcodeWorkshop(protocol, opcode, json_data)
	local executeAction = parseOpcodesMap[json_data.action]

	if executeAction then
		executeAction(json_data.data)
	end
end

function removeCraftEvents()
	for i, child in pairs(uiCraftList:getChildren()) do
		removeEvent(child.event)
	end
end

function onUpdateCraftControls(widget, focusChild)
	if focusChild then
		uiWindow.uiControltButton.onClick = focusChild:isOn() and requestCollect or showConfirmWindow

		uiWindow.uiControltButton:setOn(focusChild:isOn())
		uiWindow.uiSpeedButton:setVisible(focusChild:isOn() and cooldownPriceReduction > 0)
	end
end

function onUpdateCraftItem(uiCraftItem, playerCraft)
	local uiProgress = uiCraftItem.uiProgress

	removeEvent(uiCraftItem.event)

	if not playerCraft then
		uiProgress:hide()
		uiCraftItem.background:hide()

		return
	end

	local function updateCooldown()
		local elapsedTime = math.max(0, playerCraft.cooldown - os.time())
		local cooldownDuration = uiCraftItem.craftItem.cooldown * playerCraft.count
		local percent = math.max(1, math.floor((cooldownDuration - elapsedTime) / cooldownDuration * 1000))
		local available = math.floor(percent / 1000 * playerCraft.count)
		local availableCollected = available - playerCraft.collected
		local strCollected = availableCollected > 0 and tr("(%d) ", availableCollected) or ""

		uiProgress:setPercent(percent)
		uiProgress:setText(tr("%s[%d/%d] - %s", strCollected, playerCraft.collected, playerCraft.count, formatCooldown(elapsedTime)))

		if elapsedTime < 1 then
			removeEvent(uiCraftItem.event)
			uiWindow.uiSpeedButton:hide()
		end
	end

	uiCraftItem.background:show()
	uiProgress:show()
	updateCooldown()

	uiCraftItem.event = cycleEvent(updateCooldown, 1000)
end

function searchWorkShopItem(searchValue)
	for i, child in pairs(uiCraftList:getChildren()) do
		local searchCondition = searchValue == "" or searchValue ~= "" and string.find(child:getId():lower(), searchValue:lower()) ~= nil

		child:setVisible(searchCondition)
	end
end

function hideConfirmSpeedWindow()
	if uiConfirmSpeedWindow then
		uiConfirmSpeedWindow:destroy()

		uiConfirmSpeedWindow = nil
	end
end

function hideConfirmWindow()
	if uiConfirmWindow then
		uiConfirmWindow:destroy()

		uiConfirmWindow = nil
	end
end

function showConfirmWindow()
	local focusedChild = uiCraftList:getFocusedChild()

	if not focusedChild then
		return
	end

	hideConfirmWindow()

	uiConfirmWindow = g_ui.createWidget("ConfirmWorkshopHeadlessWindow", rootWidget)

	local uiScroll = uiConfirmWindow.uiScroll
	local uiMaterialList = uiConfirmWindow.uiMaterialList
	local uiUnitLabel = uiConfirmWindow.uiUnitLabel
	local craftItem = focusedChild.craftItem

	uiConfirmWindow.uiName:setText(craftItem.name)
	uiConfirmWindow.uiItem:setItemId(craftItem.itemId)
	uiConfirmWindow.uiCooldownLabel:setText(tr("Cooldown: %s", formatCooldown(craftItem.cooldown)))

	for i, material in ipairs(craftItem.requiredItems) do
		local tmpItem = Item.create(material.itemId)

		tmpItem:setTooltip(material.name)
		uiMaterialList[i]:setItem(tmpItem)
		uiMaterialList[i].count:setText(material.count)
		uiMaterialList[i].count:setOn(material.playerCount >= material.count)
	end

	function uiScroll:onValueChange(value)
		uiUnitLabel:setText(tr("Unit total") .. ": " .. value)
		uiConfirmWindow.uiCooldownLabel:setText(tr("Cooldown: %s", formatCooldown(craftItem.cooldown * value)))

		for i, material in ipairs(craftItem.requiredItems) do
			uiMaterialList[i].count:setText(material.count * value)
			uiMaterialList[i].count:setOn(material.playerCount >= material.count * value)
		end
	end

	uiConfirmWindow:show()
	uiConfirmWindow:focus()
end
