-- chunkname: @/modules/game_contract/contract.lua

PoliceOperation = {}

local contractWindow, panelCitys, difficultyPanel, tokenWindow
local protocol = runinsandbox("protocol")

CityName = {
	[57] = "Cinnabar",
	[61] = "Goldenrod",
	[55] = "Fuchsia",
	[59] = "Violet",
	[54] = "Celadon",
	[50] = "Viridian",
	[52] = "Cerulean",
	[56] = "Saffron",
	[58] = "Lavander",
	[60] = "Olivine",
	[64] = "Ecruteak",
	[63] = "Cianwood",
	[62] = "Azalea",
	[51] = "Pewter",
	[53] = "Vermilion"
}

local function onOpenPhone(data)
	contractWindow:show()
	contractWindow:focus()

	for i, v in pairs(data) do
		local row = panelCitys[v.npcName]
		local isUnstarted = v.contract.status == -1
		local isFinished = v.defeats >= v.count

		if not row then
			row = g_ui.createWidget("DifficultyPanel", panelCitys)

			row:setId(v.npcName)
		end

		row.level = v.level
		row.contract = v.contract

		row.status:setVisible(isUnstarted)
		row.status:setOn(isFinished)
		row.outfit:setVisible(not isUnstarted and not isFinished)
		row.count:setText(("Investiga\xE7\xF5es feitas nesta cidade: %s de %s"):format(v.defeats, v.count))

		local npcName = isUnstarted and "" or tr(": {#F7A831|%s}", v.npcName)
		local description = isFinished and tr("Investiga\xE7\xE3o conclu\xEDda.") or isUnstarted and tr("Investiga\xE7\xE3o n\xE3o iniciada. Para come\xE7ar, aperte o bot\xE3o Iniciar.") or v.contract.description

		row.title:setMultiColorText(tr("%s%s", CityName[v.cityId], npcName))
		row.description:setText(description)
		row.finish:setEnabled(isFinished)

		if not isUnstarted and not isFinished then
			row.outfit:setOutfit(v.contract.outfit)
		end

		if v.contract.status == 0 and v.contract.disappear and v.contract.disappear > 0 then
			onUpdateNpcDisappear(row, v.contract.disappear)
		end

		onUpdateControls(panelCitys, row)
	end

	onUpdateControls(panelCitys, panelCitys:getFocusedChild())
end

local function onInformationPhone(difficulty, playerDifficulty, weeklyCount, totalCount, legendaryCount)
	for i, child in pairs(difficultyPanel:getChildren()) do
		local isOn = i == difficulty
		local isEnabled = i <= playerDifficulty

		child:setChecked(isOn)
		child:setEnabled(isEnabled)
	end

	contractWindow.panelDaily.dailyCount:setText(tr("Weekly Defeat: %s", weeklyCount))
	contractWindow.panelTotal.totalCount:setText(tr("Rockets Defeat: %s", totalCount))
	contractWindow.panelLegendary.legendaryCount:setText(tr("Admin Defeat: %s", legendaryCount))
end

local function onResetPhone()
	panelCitys:destroyChildren()
end

local function onOpenMachine()
	if tokenWindow then
		tokenWindow:destroy()

		tokenWindow = nil
	end

	tokenWindow = g_ui.createWidget("TokenMachineWindow", rootWidget)

	function tokenWindow.onDestroy(widget)
		if widget == tokenWindow then
			tokenWindow = nil
		end
	end

	tokenWindow:show()
	tokenWindow:raise()
	tokenWindow:focus()
end

function requestFinish()
	local focusChild = panelCitys:getFocusedChild()

	if focusChild then
		protocol.sendFinish(focusChild:getId())
	end
end

function requestStart()
	local focusChild = panelCitys:getFocusedChild()

	if focusChild then
		if g_game.getLocalPlayer():getLevel() >= focusChild.level then
			protocol.sendStart(focusChild:getId())
		else
			print(focusChild.level)
			displayInfoBox(contractWindow:getText(), tr("Voc\xEA precisa estar no minimo level %d para iniciar esta investiga\xE7\xE3o!", focusChild.level))
		end
	end
end

function requestDifficulty(difficulty)
	protocol.sendDifficulty(difficulty)
end

function requestToken()
	if tokenWindow then
		protocol.sendToken(tokenWindow:getFocusedChild().option)
	end
end

function init()
	protocol.initProtocol()
	connect(g_game, {
		onGameEnd = onContractGameEnd
	})
	connect(PoliceOperation, {
		onOpenPhone = onOpenPhone,
		onOpenMachine = onOpenMachine,
		onResetPhone = onResetPhone,
		onInformationPhone = onInformationPhone
	})

	contractWindow = g_ui.displayUI("contract.otui")
	panelCitys = contractWindow.panelCitys
	difficultyPanel = contractWindow.difficultyPanel

	connect(panelCitys, {
		onChildFocusChange = onUpdateControls
	})
end

function terminate()
	protocol.terminateProtocol()
	disconnect(g_game, {
		onGameEnd = onContractGameEnd
	})
	disconnect(panelCitys, {
		onChildFocusChange = onUpdateControls
	})
	disconnect(PoliceOperation, {
		onOpenPhone = onOpenPhone,
		onOpenMachine = onOpenMachine,
		onResetPhone = onResetPhone,
		onInformationPhone = onInformationPhone
	})
	contractWindow:destroy()

	if tokenWindow then
		tokenWindow:destroy()

		tokenWindow = nil
	end
end

function onContractGameEnd()
	panelCitys:destroyChildren()
	contractWindow:hide()

	if tokenWindow then
		tokenWindow:destroy()

		tokenWindow = nil
	end
end

function onUpdateControls(widget, focusChild, prevChild)
	if focusChild and focusChild.contract then
		local isUnstarted = focusChild.contract.status == -1
		local isDefeated = focusChild.contract.status == 1
		local isFinished = focusChild.status:isOn()

		focusChild.start:setOn(isFinished)
		focusChild.finish:setEnabled(isDefeated)
		focusChild.start:setEnabled(isUnstarted and not isFinished)
		focusChild.start:setVisible(isUnstarted)
		focusChild.finish:setVisible(not isUnstarted)
	end
end

function onUpdateNpcDisappear(widget, disappear)
	local params = {
		onExecute = function(cooldown)
			if contractWindow and contractWindow:isVisible() and widget and widget.finish then
				widget.finish:setText(formatTime(cooldown))
			end

			return contractWindow and contractWindow:isVisible() and widget and widget.finish
		end,
		onEnd = function(cooldown)
			if contractWindow and contractWindow:isVisible() and widget and widget.finish then
				widget.contract.status = -1

				onUpdateControls(panelCitys, widget, nil)
			end

			return true
		end
	}

	g_effects.onCooldown(widget, disappear - os.time(), params)
end
