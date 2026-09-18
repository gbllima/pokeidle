local ExtendsOpcodes = {
	DialyReward = 95,
	SendClaimReward = 3,
	ParseOpenWindow = 2,
	SendRewardsInfo = 1
}

local DailyRewardWindow, DailyRewardConfirmWindow, DailyRewardButton
local PlayerDailyRewardConfigDefault = {
	stack = 0,
	hasClaimed = 0,
	rewards = {},
	vipRewards = {},
	secondsToNextReward = 0,
	isPremium = false
}

local messages = {
	willWin = "Voce recebera\n%d x %s"
}

PlayerDailyRewardConfig = {}

function init()
	connect(g_game, {
		onGameEnd = closeWindow
	})

	DailyRewardButton = modules.client_topmenu.addRightButton("dailyrewardButton", tr("Daily Reward"), "/images/topbuttons/icon_daily_gift", toggle, false, 5)
	DailyRewardWindow = g_ui.displayUI("dailyreward")

	DailyRewardWindow:setVisible(false)
	ProtocolGame.registerExtendedJSONOpcode(ExtendsOpcodes.DialyReward, parseDailyReward)
end

function terminate()
	disconnect(g_game, {
		onGameEnd = closeWindow
	})
	ProtocolGame.unregisterExtendedJSONOpcode(ExtendsOpcodes.DialyReward)
	closeConfirmWindow()
	closeWindow()
	DailyRewardWindow:destroy()
	DailyRewardButton:destroy()

	PlayerDailyRewardConfig = PlayerDailyRewardConfigDefault
end

function closeWindow()
	closeConfirmWindow()
	DailyRewardButton:setOn(false)
	DailyRewardWindow:setVisible(false)
end

function showWindow()
	DailyRewardWindow:setVisible(true)
	DailyRewardButton:setOn(true)
	DailyRewardWindow:focus()
end

function closeConfirmWindow()
	if DailyRewardConfirmWindow then
		DailyRewardConfirmWindow:destroy()
		DailyRewardConfirmWindow = nil
	end
end

function toggle()
	if DailyRewardButton:isOn() then
		closeWindow()
	else
		loadDailyReward()
	end
end

function parseDailyReward(protocol, opcode, json_data)
	local action = json_data.action
	local data = json_data.data

	if action == ExtendsOpcodes.ParseOpenWindow then
		showWindow()
		loadDailyReward()
	else
		PlayerDailyRewardConfig = PlayerDailyRewardConfigDefault
		PlayerDailyRewardConfig.stack = data.stack
		PlayerDailyRewardConfig.hasClaimed = data.hasClaimed
		PlayerDailyRewardConfig.secondsToNextReward = data.secondsToNextReward or 0
		PlayerDailyRewardConfig.isPremium = data.isPremium

		for index, config in pairs(data.rewardStacks) do
			PlayerDailyRewardConfig.rewards[tonumber(index)] = config
		end

		for index, config in pairs(data.vipRewardStacks) do
			PlayerDailyRewardConfig.vipRewards[tonumber(index)] = config
		end

		PlayerDailyRewardConfig.rewardMaxStacks = data.rewardMaxStacks

		displayRewards()
	end
end

function displayRewards()
	DailyRewardWindow.rewardsList:destroyChildren()
	DailyRewardWindow.vipRewardsList:destroyChildren()

	local stack = PlayerDailyRewardConfig.stack
	local hasClaimed = PlayerDailyRewardConfig.hasClaimed
	local isPremium = PlayerDailyRewardConfig.isPremium

	for index = 1, 21 do
		local rewardConfig = PlayerDailyRewardConfig.rewards[index]

		if rewardConfig then
			local newWidget = g_ui.createWidget("RewardDay", DailyRewardWindow.rewardsList)
			local labelDay = newWidget.day
			local item = newWidget.item
			local labelVip = newWidget.vip

			labelVip:setVisible(false)
			labelDay:setText(index)
			item:setItemId(rewardConfig.itemId)
			item:setItemCount(rewardConfig.count)
			newWidget:setTooltip("Você receberá\n" .. rewardConfig.count .. "x " .. rewardConfig.itemName)

			if index <= stack then
				labelDay:setOn(true)
				item:setOpacity(0.5)
				newWidget:setTooltip("Você já recebeu\n" .. rewardConfig.count .. "x " .. rewardConfig.itemName)
			elseif index == stack + 1 and hasClaimed == 0 then
				newWidget:setOn(true)
			end
		end
	end

	for index = 1, 21 do
		local rewardConfig = PlayerDailyRewardConfig.vipRewards[index]

		if rewardConfig then
			local newWidget = g_ui.createWidget("RewardDay", DailyRewardWindow.vipRewardsList)
			local labelDay = newWidget.day
			local item = newWidget.item
			local labelVip = newWidget.vip

			labelVip:setVisible(true)
			labelDay:setText(index)
			item:setItemId(rewardConfig.itemId)
			item:setItemCount(rewardConfig.count)
			newWidget:setTooltip("Você receberá\n" .. rewardConfig.count .. "x " .. rewardConfig.itemName)

			if stack <= 21 then
				item:setOpacity(0.3)
				newWidget:setOn(false)
			else
				local vipDay = stack - 21
				if index <= vipDay then
					labelDay:setOn(true)
					item:setOpacity(0.5)
					newWidget:setTooltip("Você já recebeu\n" .. rewardConfig.count .. "x " .. rewardConfig.itemName)
				elseif index == vipDay + 1 and hasClaimed == 0 and isPremium then
					newWidget:setOn(true)
				end
			end
		end
	end

	local rewardMaxStacks = PlayerDailyRewardConfig.rewardMaxStacks
	if rewardMaxStacks then
		DailyRewardWindow.messageLabel.maxStackReward:setItemId(rewardMaxStacks.itemId)
		DailyRewardWindow.messageLabel.maxStackReward:setItemCount(rewardMaxStacks.count)
		DailyRewardWindow.messageLabel.maxStackReward:setTooltip("Você receberá\n" .. rewardMaxStacks.count .. "x " .. rewardMaxStacks.itemName)
		DailyRewardWindow.messageLabel:setMultiColorText(
			"Após coletar a recompensa #21,\n" ..
			"você receberá {#f3c402|" .. rewardMaxStacks.count .. "x " .. rewardMaxStacks.itemName .. "} " ..
			"todos os dias até o dia " .. getLastDayOfMonth() .. " de " .. getMonthString()
		)
	end

	DailyRewardWindow.claimButton:setEnabled(hasClaimed == 0)

	local timeLabel = DailyRewardWindow.timeLabel

	if hasClaimed == 1 and PlayerDailyRewardConfig.secondsToNextReward > 0 then
		timeLabel:setVisible(true)

		local function updateTimer()
			if PlayerDailyRewardConfig.secondsToNextReward <= 0 then
				timeLabel:setText("Disponível para coletar!")
				return
			end

			local remaining = PlayerDailyRewardConfig.secondsToNextReward
			local hours = math.floor(remaining / 3600)
			local minutes = math.floor((remaining % 3600) / 60)
			local seconds = remaining % 60
			timeLabel:setText(string.format("Próxima recompensa em %02d:%02d:%02d", hours, minutes, seconds))

			PlayerDailyRewardConfig.secondsToNextReward = PlayerDailyRewardConfig.secondsToNextReward - 1
			scheduleEvent(updateTimer, 1000)
		end

		updateTimer()
	else
		timeLabel:setVisible(false)
	end

	showWindow()
end

function claimReward()
	local protocol = g_game.getProtocolGame()

	if not protocol then
		return
	end

	closeConfirmWindow()

	local function confirmCallback()
		protocol:sendExtendedOpcode(ExtendsOpcodes.DialyReward, ExtendsOpcodes.SendClaimReward)
		closeConfirmWindow()
		loadDailyReward()
	end

	local playerName = g_game.getLocalPlayer():getName()

	DailyRewardConfirmWindow = displayGeneralBox(tr("Daily Gift"), ("Você tem certeza que deseja receber sua recompensa diária com este personagem ({#f3c402|%s})?"):format(playerName), {
		{
			color = "Blue",
			text = tr("Yes"),
			callback = confirmCallback
		},
		{
			color = "Red",
			text = tr("No"),
			callback = closeConfirmWindow
		},
		anchor = AnchorHorizontalCenter
	}, confirmCallback, closeConfirmWindow)

	DailyRewardConfirmWindow:show()
	DailyRewardConfirmWindow:raise()
	DailyRewardConfirmWindow:focus()
end

function loadDailyReward()
	local protocol = g_game.getProtocolGame()

	if not protocol then
		return
	end

	protocol:sendExtendedOpcode(ExtendsOpcodes.DialyReward, ExtendsOpcodes.SendRewardsInfo)
end

function getLastDayOfMonth()
	local currentDate = os.date("*t")
	local year, month, day = currentDate.year, currentDate.month, currentDate.day
	local lastDayOfMonth = os.date("%d", os.time({
		day = 0,
		year = year,
		month = month + 1
	}))

	if month == 2 and day == 28 and (year % 4 == 0 and year % 100 ~= 0 or year % 400 == 0) then
		lastDayOfMonth = 29
	end

	return tonumber(lastDayOfMonth)
end

function getMonthString()
	local month = tonumber(os.date("%m"))
	local monthNames = {
		"Janeiro",
		"Fevereiro",
		"Março",
		"Abril",
		"Maio",
		"Junho",
		"Julho",
		"Agosto",
		"Setembro",
		"Outubro",
		"Novembro",
		"Dezembro"
	}

	return monthNames[month]
end
