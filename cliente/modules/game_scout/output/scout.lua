-- chunkname: @/modules/game_scout/scout.lua

ScoutClub = {}

local protocol = runinsandbox("protocol")
local scoutWindow, scoutTracker, messageWindow, rewardsWindow, gemShopWindow, dungeonWindow, panelList, pointsLabel, batteryLabel, rankPanel, cancelButton, controlButton
local imageScoutPath = "/images/game/scout/"
local trackerHeight = {
	78,
	116,
	157
}
local battery = -1
local transmissorItemId = 24844
local batteryItemId = 24842
local COIN_ITEM = 17614
local MEDAL_ITEM = 23276
local MedalsItemIds = {
	23667,
	23660,
	23662,
	23659,
	23668,
	23664,
	23661,
	23665
}

local function onPanelShow(params)
	for i, value in pairs(params) do
		local rowPanel = panelList[value.name]
		local isFinished = value.kills >= value.defeats

		if not rowPanel then
			rowPanel = g_ui.createWidget("RowPanel", panelList)

			rowPanel:setId(value.name)
		end

		rowPanel:setOn(value.isDoing)
		rowPanel:setChecked(isFinished)
		rowPanel.name:setText(value.name)
		rowPanel.creature:setOutfit(value.outfit)
		rowPanel.panelDefeats.count:setText(value.defeats)
		rowPanel.panelPoints.count:setText(tr("%d Points", value.points))
	end

	scoutWindow:show()
	scoutWindow:focus()
	onUpdateControls(panelList, panelList:getFocusedChild())
end

local function onInfoPanel(params)
	if params.rankId and params.playerRank then
		for i, rankChild in pairs(rankPanel:getChildren()) do
			local isOn = i == params.rankId
			local isEnabled = i <= params.playerRank

			rankChild:setChecked(isOn)
			rankChild:setEnabled(isEnabled)
		end
	end

	if params.battery then
		battery = params.battery

		scoutWindow:setOn(params.battery > -1)
		batteryLabel:setText(params.battery)
		batteryLabel:setVisible(params.battery > -1)
	end

	if params.points then
		pointsLabel:setText(params.points)
		rewardsWindow.points:setText(params.points)
	end
end

local function onResetPanel()
	panelList:destroyChildren()
end

local function onTrackerKill(params)
	local tracker = scoutTracker.contentsPanel[params.name]

	if not tracker then
		tracker = g_ui.createWidget("TrackerCreature", scoutTracker.contentsPanel)

		tracker:setId(params.name)
	end

	scoutTracker:show()
	tracker.name:setText(params.name)
	tracker.creature:setOutfit(params.outfit)
	tracker.progress:setValue(params.kills, 0, params.defeats)
	tracker.defeats:setText(tr("(%s/%s)", params.kills, params.defeats))
	scoutTracker:setHeight(trackerHeight[scoutTracker.contentsPanel:getChildCount()])
end

local function onTrackerRemove(pokemonName)
	local tracker = scoutTracker.contentsPanel[pokemonName]

	if tracker then
		tracker:destroy()
	end

	scoutTracker:setVisible(scoutTracker.contentsPanel:getChildCount() > 0)
	scoutTracker:setHeight(trackerHeight[scoutTracker.contentsPanel:getChildCount()])
end

local function onRewards(params)
	rewardsWindow.list:destroyChildren()

	for i, value in pairs(params) do
		local uiRewards

		if value.clientId then
			uiRewards = g_ui.createWidget("ScoutRewardItem", rewardsWindow.list)

			uiRewards.item:setItemId(value.clientId)
			uiRewards.item:setItemCount(value.count)
		elseif value.outfit then
			uiRewards = g_ui.createWidget("ScoutRewardCreature", rewardsWindow.list)

			uiRewards.creature:setOutfit(value.outfit)
		end

		uiRewards.name:setText(value.name)
		uiRewards.points:setText(value.points)
		uiRewards.points.medal:setItemId(value.coins and COIN_ITEM or MEDAL_ITEM)

		function uiRewards.points.onClick()
			modules.game_scout.requestReward(i, value)
		end
	end

	rewardsWindow:show()
	rewardsWindow:focus()
end

local function onGemShop(data)
	if data.medals then
		for i, itemId in pairs(MedalsItemIds) do
			gemShopWindow[i].item:setItemId(itemId)
			gemShopWindow[i]:setText(data.medals[tostring(i)] or 0)
		end
	end

	if data.gems then
		gemShopWindow.list:destroyChildren()

		for i, value in pairs(data.gems) do
			local uiRewards = g_ui.createWidget("ScoutRewardItem", gemShopWindow.list)

			uiRewards.item:setItemId(value.clientId)
			uiRewards.item:setItemCount(value.count)
			uiRewards:setId(i)
			uiRewards.name:setText(value.name)
			uiRewards.points:setText(value.points)
			uiRewards.points:setIconColor("alpha")
			uiRewards.points.medal:setItemId(MedalsItemIds[value.medal])

			function uiRewards.points.onClick()
				modules.game_scout.requestGem(i)
			end
		end
	end

	gemShopWindow:show()
	gemShopWindow:focus()
end

local function onEntryDungeon(params)
	onCloseDungeonWindow()

	dungeonWindow = g_ui.createWidget("ScoutDungeoWindow", rootWidget)

	dungeonWindow.item:setText(params.count)
	dungeonWindow.item:setItemId(params.itemId)
	dungeonWindow.message:setText(params.message)
	dungeonWindow.image:setImageSource(imageScoutPath .. params.image)

	function dungeonWindow.iniciar.onClick()
		onCloseDungeonWindow()
		protocol.sendEntryDungeon(params.dungeonId)
	end
end

function confirmAction(callback)
	if battery > -1 then
		modules.game_pokeprey.showMessage(tr("Scout Transmissor"), "Esta a\xE7\xE3o ir\xE1 consumir 1x {red|Scout Battery}, deseja prosseguir?", function()
			if battery > 0 then
				callback()
			else
				onScoutMessage({
					title = "Error",
					msg = "Voc\xEA n\xE3o possui {red|Scout Battery} para utilizar o Scout Transmissor."
				})
			end
		end)
	else
		callback()
	end
end

function requestStart()
	confirmAction(function()
		protocol.sendStart(panelList:getFocusedChild():getId(), battery)
	end)
end

function requestFinish()
	confirmAction(function()
		protocol.sendFinish(panelList:getFocusedChild():getId(), battery)
	end)
end

function requestRank(rankId)
	protocol.sendRank(rankId)
end

function requestReward(rewardId, reward)
	local item = reward.clientId and Item.create(reward.clientId, 1000)

	if item and item:isStackable() then
		modules.game_interface.moveStackableItem(rewardsWindow:getText(), item, nil, function(item, toPos, count)
			if count * reward.points > tonumber(rewardsWindow.points:getText()) then
				displayInfoBox(rewardsWindow:getText(), tr("Voc\xEA precisa de %s points", count * reward.points))
			else
				modules.game_pokeprey.showMessage(rewardsWindow:getText(), "Voc\xEA deseja reivindicar essa recompensa?", function()
					protocol.sendChooseReward(rewardId, count)
				end)
			end
		end)
		modules.game_interface.countWindow.countScrollBar:setValue(1)
	else
		modules.game_pokeprey.showMessage(rewardsWindow:getText(), "Voc\xEA deseja reivindicar essa recompensa?", function()
			protocol.sendChooseReward(rewardId, 1)
		end)
	end
end

function requestGem(gemId)
	modules.game_pokeprey.showMessage(gemShopWindow:getText(), "Voc\xEA deseja reivindicar essa recompensa?", function()
		protocol.sendChooseGemShop(gemId)
	end)
end

function requestCancel()
	if battery > -1 then
		return confirmAction(function()
			protocol.sendCancel(panelList:getFocusedChild():getId(), battery)
		end)
	end

	if messageWindow then
		messageWindow:destroy()
	end

	local function cancelCallback()
		messageWindow:destroy()

		messageWindow = nil
	end

	local function confirmCallback()
		protocol.sendCancel(panelList:getFocusedChild():getId(), battery)
		cancelCallback()
	end

	local title = tr("Cancel")
	local msg = tr("Do you want to cancel the {%s|%s} task?", "#e2bb5b", panelList:getFocusedChild():getId())

	messageWindow = displayGeneralBox(title, msg, {
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

	messageWindow:show()
	messageWindow:raise()
	messageWindow:focus()
	messageWindow:raise()
end

function init()
	protocol.initProtocol()
	connect(g_game, {
		onGameEnd = onScoutGameEnd
	})
	connect(LocalPlayer, {
		onPositionChange = onScoutPositionChange
	})
	connect(UIItem, {
		onMouseItemRelease = onMouseItemRelease
	})
	connect(ScoutClub, {
		onPanelShow = onPanelShow,
		onInfoPanel = onInfoPanel,
		onResetPanel = onResetPanel,
		onTrackerKill = onTrackerKill,
		onTrackerRemove = onTrackerRemove,
		onRewards = onRewards,
		onEntryDungeon = onEntryDungeon,
		onGemShop = onGemShop
	})

	scoutWindow = g_ui.displayUI("scout.otui")
	scoutTracker = g_ui.createWidget("ScoutTracker", modules.game_interface.getRightPanel())
	rewardsWindow = g_ui.createWidget("RewardsWindow", rootWidget)
	gemShopWindow = g_ui.createWidget("GemShopWindow", rootWidget)
	panelList = scoutWindow.panelList
	pointsLabel = scoutWindow.pointsLabel
	batteryLabel = scoutWindow.batteryLabel
	rankPanel = scoutWindow.rankPanel
	cancelButton = scoutWindow.cancelButton
	controlButton = scoutWindow.controlButton

	scoutTracker:setContentMaximumHeight(125)
	scoutTracker:setup()
	connect(panelList, {
		onChildFocusChange = onUpdateControls
	})
end

function terminate()
	protocol.terminateProtocol()
	disconnect(g_game, {
		onGameEnd = onScoutGameEnd
	})
	disconnect(LocalPlayer, {
		onPositionChange = onScoutPositionChange
	})
	disconnect(panelList, {
		onChildFocusChange = onUpdateControls
	})
	disconnect(UIItem, {
		onMouseItemRelease = onMouseItemRelease
	})
	disconnect(ScoutClub, {
		onPanelShow = onPanelShow,
		onInfoPanel = onInfoPanel,
		onResetPanel = onResetPanel,
		onTrackerKill = onTrackerKill,
		onTrackerRemove = onTrackerRemove,
		onRewards = onRewards,
		onEntryDungeon = onEntryDungeon,
		onGemShop = onGemShop
	})
	scoutWindow:destroy()
	scoutTracker:destroy()
	rewardsWindow:destroy()
	gemShopWindow:destroy()

	if messageWindow then
		messageWindow:destroy()
	end

	onCloseDungeonWindow()
end

function onScoutGameEnd()
	panelList:destroyChildren()
	scoutWindow:hide()
	scoutTracker.contentsPanel:destroyChildren()
	scoutTracker:hide()
	rewardsWindow.list:destroyChildren()
	rewardsWindow:hide()
	gemShopWindow.list:destroyChildren()
	gemShopWindow:hide()
end

function onScoutPositionChange()
	if scoutWindow:isVisible() then
		panelList:destroyChildren()
		scoutWindow:hide()
	end
end

function onUpdateControls(widget, focusChild)
	if focusChild ~= nil then
		local isDoing = focusChild:isOn()
		local isFinished = focusChild:isChecked()

		controlButton.onClick = isDoing and requestFinish or requestStart

		controlButton:setOn(focusChild:isOn())
		cancelButton:setVisible(isDoing and not isFinished)
		controlButton:setVisible(isFinished or not isDoing)
	end
end

function onScoutMessage(data)
	if messageWindow then
		messageWindow:destroy()
	end

	local title = tr(data.title)
	local msg = data.msg

	messageWindow = displayInfoBox(title, msg)

	function messageWindow.onDestroy(widget)
		if widget == messageWindow then
			messageWindow = nil
		end
	end

	messageWindow:show()
	messageWindow:raise()
	messageWindow:focus()
end

function onSearchPokemon(searchValue)
	for i, child in pairs(panelList:getChildren()) do
		local searchCondition = searchValue == "" or searchValue ~= "" and string.find(child:getId():lower(), searchValue:lower()) ~= nil

		child:setVisible(searchCondition)
	end
end

function onCloseDungeonWindow()
	if dungeonWindow then
		dungeonWindow:destroy()

		dungeonWindow = nil
	end
end

function onMouseItemRelease(mousePosition, mouseButton, item)
	if item:getId() == batteryItemId then
		modules.game_interface.startUseWith(item, 0, function(fromThing, toThing)
			if toThing:getId() == transmissorItemId then
				modules.game_interface.moveStackableItem("Add", item, nil, function(item, toPos, count)
					protocol.sendBattery(item, toThing, count)
				end)
			end
		end)
	end
end
