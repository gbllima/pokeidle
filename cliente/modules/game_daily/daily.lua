local window, confirmWindow, panelCategory, panelDaily, dailyButton
local idclass = 1
local dailyData = {}
local DailyType = {
	Catch = 2,
	Defeat = 1,
	Weekly = 3
}
local iconColor = {
	[DailyType.Defeat] = "#CA35FE",
	[DailyType.Catch] = "#FF9401",
	[DailyType.Weekly] = "#01FFA4"
}
local ExtendsOpcodes = {
	SendCancel = 8,
	SendRandom = 7,
	ParseShop = 6,
	ParseOpen = 5,
	SendShop = 4,
	SendFinish = 3,
	SendStart = 2,
	SendOpen = 1,
	CatchSystem = 101,
	DefeatSystem = 106,
	WeeklySystem = 107,
	ShopSystem = 110
}

local function kNumber(number)
	if not number or not tonumber(number) then
		return false
	end

	local left, num, right = string.match(number, "^([^%d]*%d)(%d*)(.-)$")

	return left .. num:reverse():gsub("(%d%d%d)", "%1,"):reverse() .. right
end

local function getOpcodeForDailyType(dailyType)
	local opcodeMap = {
		[DailyType.Catch] = ExtendsOpcodes.CatchSystem,
		[DailyType.Defeat] = ExtendsOpcodes.DefeatSystem,
		[DailyType.Weekly] = ExtendsOpcodes.WeeklySystem
	}
	local selectedOpcode = opcodeMap[dailyType] or ExtendsOpcodes.CatchSystem
	return selectedOpcode
end

local function sendAction(action, data, opcode)
	local protocolGame = g_game.getProtocolGame()

	if protocolGame then
		protocolGame:sendExtendedJSONOpcode(opcode, {
			action = action,
			data = data
		})
	end
end

local function sendOpen(dailyType, openShop)
	local data = {
		dailyType = dailyType,
		openShop = openShop
	}

	local opcode = openShop and ExtendsOpcodes.ShopSystem or getOpcodeForDailyType(dailyType)
	sendAction(ExtendsOpcodes.SendOpen, data, opcode)
end

local function sendStart(dailyType, classId, pokemonName)
	local data = {
		dailyType = dailyType,
		classId = classId,
		pokemonName = pokemonName
	}

	sendAction(ExtendsOpcodes.SendStart, data, getOpcodeForDailyType(dailyType))
end

local function sendFinish(dailyType, classId, pokemonName)
	local data = {
		dailyType = dailyType,
		classId = classId,
		pokemonName = pokemonName
	}

	sendAction(ExtendsOpcodes.SendFinish, data, getOpcodeForDailyType(dailyType))
end

local function sendCancel(dailyType, classId, pokemonName)
	local data = {
		dailyType = dailyType,
		classId = classId,
		pokemonName = pokemonName
	}

	sendAction(ExtendsOpcodes.SendCancel, data, getOpcodeForDailyType(dailyType))
end

local function sendBuyShop(id)
	local data = {
		id = id
	}

	sendAction(ExtendsOpcodes.SendShop, data, ExtendsOpcodes.ShopSystem)
end

local function sendRandomize(dailyType, classId)
	local data = {
		dailyType = dailyType,
		classId = classId
	}

	sendAction(ExtendsOpcodes.SendRandom, data, getOpcodeForDailyType(dailyType))
end

local function parseCurrentDaily()
	local focusedChild = panelDaily.panelInfo.list:getFocusedChild()

	if not focusedChild then
		return
	end

	local dailyPlayer = dailyData.player

	if not dailyPlayer then
		return
	end

	local focusedClass = panelDaily.classList:getFocusedChild()
	local focusCategory = panelCategory:getFocusedChild()

	if not focusCategory then
		return
	end

	local isWeekly = focusCategory.dailyType == DailyType.Weekly
	local dailyName = isWeekly and "Semanal" or "Diário"
	local pokemonName = focusedChild.name
	local class = dailyData.classes[dailyPlayer.id] or focusedClass and focusedClass.class

	if not class then
		return
	end

	local defeats = class.defeats or 1
	local isCompleted = false
	local task, count, isDoing

	if isWeekly then
		if dailyPlayer.pokemon then
			for name, value in pairs(dailyPlayer.pokemon) do
				if panelDaily.panelInfo.list[name] then
					pokemonName = name
					task = value

					break
				end
			end
		end

		count = task and task.count or defeats
		isDoing = task ~= nil
		isCompleted = task and count == -1
	else
		count = dailyPlayer.count or defeats
		isDoing = dailyPlayer.count ~= nil and dailyPlayer.count >= 0

		if isDoing then
			pokemonName = dailyPlayer.name
		end
	end

	local isFinished = count == 0
	local progressText = not isDoing and tr("%s", defeats) or isFinished and tr("Completed") or tr("%s/%s", defeats - count, defeats)

	panelDaily.panelInfo.panel:setOn(isWeekly)
	panelDaily.currentDaily.panel:setOn(isWeekly)
	panelDaily.panelInfo.panel:setVisible(isVisiblePanel)
	panelDaily.currentDaily.panel:setVisible(isVisiblePanel)

	if dailyData.steps then
		local step = math.min(dailyData.steps, dailyPlayer.step or 0)
		local isVisiblePanel = step >= dailyData.steps or focusedClass:isOn()

		panelDaily.panelInfo.panel:setOn(isWeekly)
		panelDaily.currentDaily.panel:setOn(isWeekly)
		panelDaily.panelInfo.panel:setVisible(isVisiblePanel)
		panelDaily.currentDaily.panel:setVisible(isVisiblePanel)
		panelDaily.panelInfo.step:setText(tr("Limite %s: %s/%s", dailyName, step, dailyData.steps))
	else
		local isVisiblePanel = dailyPlayer.count == -1 or focusedClass:isOn()

		panelDaily.panelInfo.panel:setOn(isWeekly)
		panelDaily.currentDaily.panel:setOn(isWeekly)
		panelDaily.panelInfo.panel:setVisible(isVisiblePanel)
		panelDaily.currentDaily.panel:setVisible(isVisiblePanel)
	end

	panelDaily.panelInfo.randomize:setVisible(not isDoing or focusedClass:isOn())
	panelDaily.panelInfo.step:setVisible(dailyData.steps)
	panelDaily.currentDaily.class:setText(class.name)
	panelDaily.currentDaily.name:setText(tr("%s: %s", dailyName, pokemonName))
	panelDaily.currentDaily.image:setImageSource(getPokemonPortrait(pokemonName))
	panelDaily.currentDaily.progress:setText(progressText)
	panelDaily.currentDaily.progress:setValue(isDoing and defeats - count or 0, 0, defeats)
	panelDaily.currentDaily.finish:setVisible(isDoing and not isCompleted)
	panelDaily.currentDaily.finish:setEnabled(isFinished)

	if isWeekly then
		panelDaily.currentDaily.start:setVisible(not isDoing and not isFinished)
	else
		panelDaily.currentDaily.start:setVisible(not isDoing or isFinished)
	end

	panelDaily.currentDaily.cancel:setVisible(isDoing and not isFinished)

	function panelDaily.currentDaily.finish.onClick()
		idclass = class.id

		sendFinish(panelCategory:getFocusedChild().dailyType, class.id, pokemonName)
	end

	function panelDaily.currentDaily.cancel.onClick()
		confirmWindow = displayConfirmBox(tr("Confirm"), tr("Você realmente deseja cancelar sua tarefa? Será cobrado um valor de %s.", formatMoney(class.priceCancel)), function()
			idclass = class.id

			sendCancel(panelCategory:getFocusedChild().dailyType, class.id, pokemonName)
		end)
	end
end

local function parseDaily()
	panelDaily.panelInfo.list:destroyChildren()

	local focusedChild = panelDaily.classList:getFocusedChild()

	if not focusedChild then
		return
	end

	local playerDaily = dailyData.player

	if playerDaily and playerDaily.list then
		local pokemons = playerDaily.list[focusedChild.class.id]
		local focusChild

		for i, pokemonName in pairs(pokemons) do
			local pokemon = g_ui.createWidget("PokemonDaily", panelDaily.panelInfo.list)

			if playerDaily.pokemon and playerDaily.pokemon[pokemonName] and playerDaily.pokemon[pokemonName].count == -1 or playerDaily.feats and table.contains(playerDaily.feats, pokemonName) then
				pokemon:disable()
			end

			if playerDaily.name and playerDaily.name == pokemonName and playerDaily.count > -1 or playerDaily.pokemon and playerDaily.pokemon[pokemonName] and playerDaily.pokemon[pokemonName].count > -1 or not focusChild and not pokemon:isDisabled() then
				focusChild = pokemon
			end

			pokemon.name = pokemonName

			pokemon:setId(pokemonName)
			pokemon:setTooltip(pokemonName)
			pokemon:setIcon(getPokemonPortrait(pokemonName))
		end

		if focusChild then
			panelDaily.panelInfo.list:focusChild(focusChild)
		end
	end

	if focusedChild.class then
		local dailyType = panelCategory:getFocusedChild().dailyType

		panelDaily.panelInfo.icon:setImageColor(iconColor[dailyType] or "#FFFFFF")
		panelDaily.panelInfo.rewards:setText(tr("Rewards: %s EXP, %d pts", kNumber(focusedChild.class.rewards.experience), focusedChild.class.rewards.points))
		panelDaily.panelInfo.items:destroyChildren()

		if focusedChild.class.rewards.items then
			for i, v in ipairs(focusedChild.class.rewards.items) do
				local uiItem = g_ui.createWidget("DailyItem", panelDaily.panelInfo.items)

				uiItem:setItemId(v.clientId)
				uiItem:setTooltip(v.name)
			end
		end
	end
end

local function parseClass(params)
	panelDaily.classList:destroyChildren()

	for i, v in pairs(dailyData.classes) do
		local class = g_ui.createWidget("TabButtonClass", panelDaily.classList)
		local isLocked = v.locked and not v.enabled
		local name = isLocked and tr("Level %d", v.level) or v.name

		if i == idclass then
			class:focus()
		end

		class.class = v

		class:setOn(isLocked)
		class:setText(name)
		class:setEnabled(not isLocked)
	end
end

local function parseData(params)
	dailyData = params

	parseClass()
	parseDaily()
	parseCurrentDaily()
end

local function parseShop(params)
	if params.gifts then
		panelShop.list:destroyChildren()

		for i, v in pairs(params.gifts) do
			local shop = g_ui.createWidget("PanelShopRow", panelShop.list)

			if v.itemId then
				shop.item:setItemId(v.itemId)
			elseif v.outfit then
				shop.outfit:setOutfit(v.outfit)
			elseif v.image and g_resources.fileExists(v.image .. ".png") then
				shop.image:setImageSource(v.image)
			end

			if v.count > 1 then
				shop.count:setText(tr("%dx", v.count))
			end

			shop.name:setText(v.name)
			shop.points:setText(tr("%d pts", v.amount))
			shop.points:setIconColor(iconColor[v.pointId])

			function shop.buy.onClick()
				local function onConfirm()
					local points = params.points[tostring(v.pointId)] or 0

					if points >= v.amount then
						sendBuyShop(i)

						params.points[tostring(v.pointId)] = points - v.amount
					else
						displayInfoBox(tr("Error"), tr("Você não possui pontos suficientes!"))
					end
				end

				confirmWindow = displayConfirmBox(tr("Confirm"), tr("Você realmente deseja comprar esse item?"), onConfirm)
			end
		end
	end

	if params.points then
		for i = 1, DailyType.Weekly do
			local points = panelShop[i]

			if points then
				points:setText(tr("Points: %d", params.points[tostring(i)] or 0))
			end
		end
	end
end

local parseCallbacks = {
	[ExtendsOpcodes.ParseOpen] = parseData,
	[ExtendsOpcodes.ParseShop] = parseShop
}

local function parseOpcode(protocol, opcode, jsonData)
	local parseAction = parseCallbacks[jsonData.action]

	if parseAction then
		parseAction(jsonData.data)
	end
end

function init()
	connect(g_game, {
		onGameEnd = hide
	})
	
	ProtocolGame.registerExtendedJSONOpcode(ExtendsOpcodes.CatchSystem, parseOpcode)
	ProtocolGame.registerExtendedJSONOpcode(ExtendsOpcodes.DefeatSystem, parseOpcode)
	ProtocolGame.registerExtendedJSONOpcode(ExtendsOpcodes.WeeklySystem, parseOpcode)
	ProtocolGame.registerExtendedJSONOpcode(ExtendsOpcodes.ShopSystem, parseOpcode)

	dailyButton = modules.client_topmenu.addRightGameButton("dailyButton", tr("Daily and Weekly"), "/images/topbuttons/icon_daily", toggle, false, 2)
	window = g_ui.displayUI("daily")
	panelCategory = window.panelCategory
	panelDaily = window.panelDaily
	panelShop = window.panelShop
end

function terminate()
	disconnect(g_game, {
		onGameEnd = hide
	})
	
	ProtocolGame.unregisterExtendedJSONOpcode(ExtendsOpcodes.CatchSystem)
	ProtocolGame.unregisterExtendedJSONOpcode(ExtendsOpcodes.DefeatSystem)
	ProtocolGame.unregisterExtendedJSONOpcode(ExtendsOpcodes.WeeklySystem)
	ProtocolGame.unregisterExtendedJSONOpcode(ExtendsOpcodes.ShopSystem)

	if confirmWindow then
		confirmWindow:destroy()

		confirmWindow = nil
	end

	closeConfirm()
	dailyButton:destroy()

	dailyButton = nil

	window:destroy()

	window = nil
end

function hide()
	dailyData = {}
	idclass = 1

	window:hide()
	closeConfirm()
	dailyButton:setOn(false)
end

function show()
	window:show()
	dailyButton:setOn(true)
end

function closeConfirm()
	if confirmWindow then
		confirmWindow:destroy()

		confirmWindow = nil
	end
end

function toggle()
	if dailyButton:isOn() then
		hide()
	else
		show()
		onSelectedCategory(panelCategory, panelCategory:getFocusedChild())
	end
end

function onSelectedCategory(widget, focusedChild)
	if focusedChild and window and window:isVisible() then
		if focusedChild.dailyType then
			sendOpen(focusedChild.dailyType)
		elseif focusedChild.openShop then
			sendOpen(nil, focusedChild.openShop)
		end

		idclass = 1

		panelShop:setVisible(focusedChild.openShop)
		panelDaily:setVisible(focusedChild.dailyType)
	end
end

function onSelectedClass(widget, focusedChild)
	if focusedChild and focusedChild.class then
		parseDaily()
		parseCurrentDaily()
	end
end

function onSelectedPokemon(widget, focusedChild)
	if focusedChild and focusedChild.name then
		parseCurrentDaily()
	end
end

function onConfirmDaily()
	local focusedChild = panelDaily.panelInfo.list:getFocusedChild()

	if not focusedChild then
		return
	end

	local function onConfirm()
		local focus = panelDaily.classList:getFocusedChild()

		idclass = focus.class.id
		sendStart(panelCategory:getFocusedChild().dailyType, focus.class.id, focusedChild.name)
	end

	confirmWindow = displayConfirmBox(tr("Confirm"), tr("Você realmente deseja fazer a %s do %s?", panelCategory:getFocusedChild():getText(), focusedChild.name), onConfirm)
end

function onConfirmRandomize()
	local focusCategory = panelCategory:getFocusedChild()

	if not focusCategory then
		return
	end

	local focus = panelDaily.classList:getFocusedChild()

	local function onConfirm()
		idclass = focus.class.id

		sendRandomize(focusCategory.dailyType, focus.class.id)
	end

	confirmWindow = displayConfirmBox(tr("Tem certeza?"), tr("Você realmente deseja gastar {%s|%s} para randomizar?", "#e2bb5b", formatMoney(focus.class.priceRandomize)), onConfirm)
end
